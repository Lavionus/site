/* Vykrajovátka – ovládání stránky nad společným zapojením gen3d/aplikace.js:
   tady jen to, co je pro vykrajovátka zvláštní (galerie, text a obrázek z plátna, posuvníky, půdorys, výsledky).
   Stav = plochý projekt CC.VYCHOZI (+ vlastni), stejný jako dřív ve „vykrajovatko_nastaveni“ a v uložených tvarech. */
/* global CC, CC_NAHLED, KRAB, G3D, Dialog, TrubkyGui, Tvary, THREE */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const css = (n, z) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || z;
  const fmt = G3D.fmt;
  let vys = null, sbirka = null, obrazekPlatno = null, zpravyVlastni = [], na2d = false;
  const stavZobr = { tisk: true };
  const nahled = CC_NAHLED.vytvorNahled($('platno'));

  // dřívější uložené nastavení (klíč bez předpony webapp_) převezme projekt gen3d
  try {
    if (!localStorage.getItem('webapp_vykrajovatko_projekt')) {
      const s = localStorage.getItem('vykrajovatko_nastaveni');
      if (s) localStorage.setItem('webapp_vykrajovatko_projekt', s);
    }
  } catch (e) { /* bez úložiště */ }
  // Tvary.pripoj volá aplikace – obal si podrží sbírku kvůli jménu souboru (aktivní uložený tvar)
  const puvPripoj = typeof Tvary !== 'undefined' && Tvary.pripoj;
  if (puvPripoj) Tvary.pripoj = c => (sbirka = puvPripoj.call(Tvary, c));

  const app = G3D.aplikace({
    typ: 'vykrajovatko', nazev: 'Vykrajovátko', klic: 'webapp_vykrajovatko', soubor: 'vykrajovatko',
    normalizuj: CC.normalizuj, vychozi: () => G3D.kopie(CC.VYCHOZI), popis: CC.popis,
    viditelnost: () => viditelnost(),
    poNaplneni: q => vyplnVlastni(q),
    prepocitej: () => naplanuj(),
    png: () => (na2d ? $('obrys-plocha').toDataURL('image/png') : nahled.png()),
    pohled: j => pohled(j),
    exportStl: () => exportuj('stl'),
    doModelare: () => (lzeExport() ? { data: soubor3mf(), pripona: '.3mf' } : null),
    nahodny: q => {
      const t = CC.KATALOG.filter(x => x.id !== 'text' && x.id !== 'image' && x.id !== q.shapeType);
      const n = Object.assign(G3D.kopie(q), { shapeType: t[Math.floor(Math.random() * t.length)].id });
      if (n.lockAspect) n.length = CC.delkaPodlePomeru(n);
      return n;
    },
    zkratky: { r: 'tRez', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka', g: 'tMrizka' },
    zmenaTematu: () => { naplanuj(); nakresliNahledy(); },
  });
  if (puvPripoj) Tvary.pripoj = puvPripoj;

  /* ---------- galerie a nabídka tvarů (z jednoho katalogu) ---------- */
  function postavNabidku() {
    const sel = $('shapeType'), gal = $('galerie');
    let skupina = null, optg = null;
    for (const t of CC.KATALOG) {
      if (t.skupina !== skupina) {
        skupina = t.skupina;
        optg = document.createElement('optgroup'); optg.label = skupina; sel.appendChild(optg);
        const h = document.createElement('div'); h.className = 'galerie-skupina'; h.textContent = skupina; gal.appendChild(h);
      }
      const o = document.createElement('option'); o.value = t.id; o.textContent = t.nazev; optg.appendChild(o);
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.tvar = t.id; b.title = t.nazev;
      b.setAttribute('role', 'option'); b.setAttribute('aria-selected', 'false');
      const c = document.createElement('canvas'); c.width = 80; c.height = 80;
      const popis = document.createElement('span'); popis.textContent = t.nazev.replace(/^\S+\s/, '');
      b.append(c, popis);
      b.addEventListener('click', () => zmenTvar(t.id));
      gal.appendChild(b);
    }
    $('galerieInfo').textContent = CC.KATALOG.length + ' tvarů';
  }
  function nakresliNahled(platno, body, znak) {
    const ctx = platno.getContext('2d');
    ctx.clearRect(0, 0, platno.width, platno.height);
    if (!body) {
      ctx.fillStyle = css('--text-muted', '#b0b0b0'); ctx.font = '40px ' + css('--font', 'sans-serif');
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(znak || '?', platno.width / 2, platno.height / 2 + 2);
      return;
    }
    const r = CC.rozsah(body);
    const mer = Math.min((platno.width - 12) / (r.sirka || 1), (platno.height - 12) / (r.vyska || 1));
    const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
    ctx.beginPath();
    body.forEach((p, i) => { const x = platno.width / 2 + (p.x - cx) * mer, y = platno.height / 2 - (p.y - cy) * mer; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.closePath();
    ctx.fillStyle = css('--accent-soft', 'rgba(106,166,253,.15)'); ctx.fill();
    ctx.strokeStyle = css('--accent', '#6aa6fd'); ctx.lineWidth = 3; ctx.stroke();
  }
  const nahledyObrysu = new Map();
  // náhledy galerie se kreslí až po prvním modelu a hrubší mřížkou, ať padesát obrysů nezdrží start
  function nakresliNahledy() {
    const v = Object.assign({}, CC.VYCHOZI, { resolution: 90, nahled: true });
    for (const b of $('galerie').querySelectorAll('button')) {
      const id = b.dataset.tvar, platno = b.querySelector('canvas');
      if (id === 'text' || id === 'image') { nakresliNahled(platno, null, id === 'text' ? '🔤' : '🖼'); continue; }
      if (!nahledyObrysu.has(id)) {
        let obrys = null;
        try { const z = CC.PREDLOHY[id](v); if (z && z.length > 2) obrys = CC.prevzorkuj(CC.sjednotSmer(CC.normalizujObrys(z)), 120); } catch (e) { obrys = null; }
        nahledyObrysu.set(id, obrys);
      }
      nakresliNahled(platno, nahledyObrysu.get(id), '?');
    }
  }

  /* ---------- vlastní předlohy: text a obrázek (plátno prohlížeče) ---------- */
  // Text se vykreslí na plátno, obtáhne se (aby se písmena slepila) a z vybarvených pixelů se obkrouží obrys.
  function obrysZTextu(text, pismo, ztucneni) {
    const platno = document.createElement('canvas');
    const ctx = platno.getContext('2d');
    ctx.font = pismo;
    const m = ctx.measureText(text || 'A');
    const velikost = parseFloat((pismo.match(/(\d+(?:\.\d+)?)px/) || [])[1] || '200');
    const tah = velikost * ztucneni / 100;
    const okraj = Math.ceil(velikost * 0.35 + tah + 8);
    platno.width = Math.max(32, Math.ceil(m.width) + okraj * 2);
    platno.height = Math.ceil(velikost * 1.6) + okraj * 2;
    const c2 = platno.getContext('2d');
    c2.font = pismo; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.lineJoin = 'round'; c2.lineCap = 'round';
    c2.fillStyle = '#000'; c2.strokeStyle = '#000';
    const x = platno.width / 2, y = platno.height / 2;
    if (tah > 0) { c2.lineWidth = tah; c2.strokeText(text, x, y); }
    c2.fillText(text, x, y);
    return obrysZPlatna(platno, 60, false, true);
  }
  // Z plátna udělá masku: je-li obrázek průhledný, rozhoduje průhlednost, jinak jas.
  function obrysZPlatna(platno, prah, obratit, dlePruhlednosti) {
    const max = 420;
    const mer = Math.min(1, max / Math.max(platno.width, platno.height));
    const w = Math.max(8, Math.round(platno.width * mer)), h = Math.max(8, Math.round(platno.height * mer));
    const pom = document.createElement('canvas'); pom.width = w; pom.height = h;
    const ctx = pom.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(platno, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    let pruhledne = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] < 200) pruhledne++;
    const dleAlfy = dlePruhlednosti || pruhledne > w * h * 0.04;
    const maska = new Uint8Array(w * h), mez = prah / 100 * 255;
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      let uvnitr;
      if (dleAlfy) uvnitr = data[i + 3] >= mez;
      else uvnitr = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] <= 255 - mez;
      if (obratit) uvnitr = !uvnitr;
      maska[p] = uvnitr ? 1 : 0;
    }
    // okraj se vynuluje, aby pozadí nikdy nebylo „tvar“
    for (let x = 0; x < w; x++) { maska[x] = 0; maska[(h - 1) * w + x] = 0; }
    for (let y = 0; y < h; y++) { maska[y * w] = 0; maska[y * w + w - 1] = 0; }
    return CC.obrysZMasky(maska, w, h);
  }
  function nactiObrazek(soubor) {
    return new Promise((splnit, zamitnout) => {
      const url = URL.createObjectURL(soubor), img = new Image();
      img.onload = () => {
        const w = img.naturalWidth || img.width || 512, h = img.naturalHeight || img.height || 512;
        const platno = document.createElement('canvas'); platno.width = w; platno.height = h;
        platno.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url); splnit(platno);
      };
      img.onerror = () => { URL.revokeObjectURL(url); zamitnout(new Error('obrázek se nepodařilo načíst')); };
      img.src = url;
    });
  }
  /** Do projektu q dá obrys z textu (q.vlastni), zprávy si nechá pro kontrolu. */
  function obnovText(q) {
    const v = obrysZTextu(q.textValue || 'A', q.textFont, q.textFat);
    if (!v) { delete q.vlastni; zpravyVlastni = [{ uroven: 'chyba', text: 'Z textu se nepodařilo získat obrys — zkuste jiný znak nebo větší ztučnění.', pole: ['textFat'] }]; return; }
    q.vlastni = CC.vlastniZBodu('text', v.body);
    zpravyVlastni = v.pocetPloch > 1 ? [{ uroven: 'varovani', text: `Text se rozpadá na ${v.pocetPloch} oddělené kusy — použije se jen největší. Zvyšte ztučnění obrysu.`, pole: ['textFat'] }] : [];
  }
  function obnovObrazek(q) {
    if (!obrazekPlatno) { zpravyVlastni = q.vlastni && q.vlastni.typ === 'image' ? [] : [{ uroven: 'chyba', text: 'Vyberte soubor s obrázkem.', pole: [] }]; return; }
    const v = obrysZPlatna(obrazekPlatno, q.imgThreshold, q.imgInvert, false);
    if (!v) { delete q.vlastni; zpravyVlastni = [{ uroven: 'chyba', text: 'Z obrázku se nepodařilo získat obrys — zkuste posunout práh nebo zapnout obrácení.', pole: [] }]; return; }
    q.vlastni = CC.vlastniZBodu('image', v.body);
    zpravyVlastni = v.pocetPloch > 3 ? [{ uroven: 'varovani', text: `Obrázek má ${v.pocetPloch} oddělených ploch — použije se jen ta největší.`, pole: [] }] : [];
  }

  /* ---------- formulář: pole mimo [data-p] (posuvníky živě, poměr stran, text, obrázek) ---------- */
  const POMER = new Set(['shapeType', 'textValue', 'textFont', 'textFat', 'width', 'length', 'lockAspect']);
  /** Změna jednoho klíče projektu včetně odvozených věcí; slouceni = tažení se slije do jednoho kroku zpět. */
  function nastav(k, h, slouceni) {
    app.zmen(q => {
      q[k] = h;
      if (k === 'bgColor') q.bgAuto = false;
      if (q.shapeType === 'text' && (k === 'shapeType' || k === 'textValue' || k === 'textFont' || k === 'textFat')) obnovText(q);
      if (q.shapeType === 'image' && (k === 'shapeType' || k === 'imgThreshold' || k === 'imgInvert')) obnovObrazek(q);
      if (q.lockAspect && POMER.has(k)) { if (k === 'length') q.width = CC.sirkaPodlePomeru(q); else q.length = CC.delkaPodlePomeru(q); }
    }, slouceni);
    app.naplnFormular();
  }
  function zmenTvar(id) { if (id !== app.p.shapeType || id === 'text') nastav('shapeType', id); }
  const POPISKY = { scalePercent: 'scaleValue', opacity: 'opacityValue' };
  const casovace = {};
  document.querySelectorAll('[data-r]').forEach(el => {
    const k = el.dataset.r, pomale = k === 'textFat' || k === 'imgThreshold';   // obrys z plátna – jako dřív s malým zpožděním
    el.addEventListener('input', () => {
      popisek(k, +el.value);
      clearTimeout(casovace[k]);
      if (pomale) casovace[k] = setTimeout(() => nastav(k, +el.value, k), k === 'textFat' ? 180 : 120);
      else nastav(k, +el.value, k);
    });
  });
  function popisek(k, x) {
    const s = $(POPISKY[k] || k + 'Value'); if (!s) return;
    s.textContent = k === 'cornerRadius' ? x.toFixed(1) : k === 'opacity' ? x + ' %' : String(x);
  }
  document.querySelectorAll('[data-pp]').forEach(el => {
    const k = el.dataset.pp;
    if (k === 'textValue') return;
    if (el.type === 'checkbox') el.addEventListener('change', () => nastav(k, el.checked));
    else if (el.type === 'color') el.addEventListener('input', () => { nahled.s.scena.background = new THREE.Color(el.value); nahled.prekresli(); clearTimeout(casovace.bg); casovace.bg = setTimeout(() => nastav(k, el.value, k), 150); });
    else if (el.tagName === 'SELECT') el.addEventListener('change', () => (k === 'shapeType' ? zmenTvar(el.value) : nastav(k, el.value)));
    else el.addEventListener('change', () => {   // šířka, délka
      const x = G3D.ctiCislo(el.value);
      if (!Number.isFinite(x)) { el.classList.add('spatne'); return; }
      el.classList.remove('spatne'); nastav(k, x);
    });
  });
  $('textValue').addEventListener('input', () => { clearTimeout(casovace.text); casovace.text = setTimeout(() => nastav('textValue', $('textValue').value, 'textValue'), 180); });
  // barva objektu a průhlednost hned při tažení (bez přestavby sítě)
  $('objectColorPicker').addEventListener('input', () => nahled.vzhled(0, $('objectColorPicker').value));
  $('imageFile').addEventListener('change', async e => {
    const soubor = e.target.files && e.target.files[0];
    if (!soubor) return;
    try {
      obrazekPlatno = await nactiObrazek(soubor);
      nastav('shapeType', 'image');
    } catch (chyba) { Dialog.chyba('Obrázek se nepodařilo načíst: ' + chyba.message); }
  });

  /** Pole mimo [data-p] podle projektu (po načtení, zpět, předvolbě…). */
  function vyplnVlastni(q) {
    $('shapeType').value = q.shapeType;
    $('textFont').value = q.textFont;
    if ($('textValue').value !== q.textValue) $('textValue').value = q.textValue;
    $('imgInvert').checked = q.imgInvert;
    $('lockAspect').checked = q.lockAspect;
    $('bgColorPicker').value = q.bgColor;
    for (const k of ['width', 'length']) if (document.activeElement !== $(k) || $(k).value === '') $(k).value = String(q[k]).replace('.', ',');
    document.querySelectorAll('[data-r]').forEach(el => { el.value = q[el.dataset.r]; popisek(el.dataset.r, q[el.dataset.r]); });
    $('tHrany').setAttribute('aria-pressed', String(q.showEdges));
    $('tMrizka').setAttribute('aria-pressed', String(q.showGrid));
  }
  function viditelnost() {
    const q = app.p;
    const mapa = { star: 'starOptions', polygon: 'polygonOptions', flower: 'flowerOptions', snowflake: 'snowOptions', tree: 'treeOptions', text: 'textOptions', image: 'imageOptions' };
    document.querySelectorAll('.shape-options').forEach(e => e.classList.toggle('active', e.id === mapa[q.shapeType]));
    $('galerie').querySelectorAll('button').forEach(b => {
      const vybrany = b.dataset.tvar === q.shapeType;
      if (vybrany && b.getAttribute('aria-selected') !== 'true') b.scrollIntoView({ block: 'nearest' });
      b.setAttribute('aria-selected', String(vybrany));
    });
    $('collarFields').style.opacity = q.collarOn ? '1' : '.45';
    $('collarHeight').disabled = $('collarWidth').disabled = !q.collarOn;
  }
  // hrany a mřížka jsou součástí projektu (jako dřív), proto přes zmen
  $('tHrany').addEventListener('click', () => nastav('showEdges', !app.p.showEdges));
  $('tMrizka').addEventListener('click', () => nastav('showGrid', !app.p.showGrid));

  /* ---------- přepočet ---------- */
  let planovano = false;
  function naplanuj() {
    if (planovano) return;
    planovano = true;
    requestAnimationFrame(() => { planovano = false; prepocitej(); });
  }
  function projektKVypoctu() {
    let q = app.p;
    // písmeno bez uloženého obrysu (např. starý odkaz) – obrys se dopočítá, do historie nejde
    if (q.shapeType === 'text' && !(q.vlastni && q.vlastni.typ === 'text')) { q = G3D.kopie(q); obnovText(q); }
    return q;
  }
  function prepocitej(novyPohled) {
    const q = projektKVypoctu();
    if (q.shapeType !== 'text' && q.shapeType !== 'image') zpravyVlastni = [];
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    vys = CC.vypocet(q);
    const H = zpravyVlastni.concat(vys.H);
    const chyba = vys.chyba || '';
    const st = $('stav3d');
    st.textContent = chyba; st.classList.toggle('chyba', !!chyba);
    nahled.prepni('hrany', q.showEdges);
    nahled.stav.mrizka = q.showGrid;
    zobrazModel(novyPohled);
    app.hlaseni(chyba && vys.polePlochy ? H.concat([{ uroven: 'info', text: 'Upravte: ' + vys.polePlochy.map(c => ({ wallThickness: 'tloušťku stěny', collarWidth: 'šířku límce' }[c])).join(', '), pole: vys.polePlochy }]) : H,
      { chybaStavby: chyba, boxy: ['boxTvar', 'boxKonstrukce'] });
    vypisVysledky(q);
    souhrny(q);
    vykresliPudorys();
  }
  /** Ostřím dolů (jak se vykrajuje): otočení o 180° kolem osy X, zase na Z = 0. */
  function preklop(poz, vyska) {
    const P = new Float32Array(poz.length);
    for (let i = 0; i < P.length; i += 3) { P[i] = poz[i]; P[i + 1] = -poz[i + 1]; P[i + 2] = vyska - poz[i + 2]; }
    return P;
  }
  function zobrazModel(novyPohled) {
    if (!vys || !vys.poz) { nahled.nastav(null); return; }
    const q = app.p;
    const poz = stavZobr.tisk ? vys.poz : preklop(vys.poz, vys.v.height);
    nahled.nastav([{ poz, idx: vys.idx, barva: q.objectColor, kryti: q.opacity / 100 }],
      { tisk: stavZobr.tisk, uhel: 45, pozadi: q.bgAuto ? null : q.bgColor, novyPohled });
    $('legPrevisy').hidden = !(stavZobr.tisk && nahled.stav.previsy);
  }
  const box = G3D.dlazdice, mm = x => x.toFixed(1).replace('.', ',');
  function vypisVysledky(q) {
    const el = $('vVysledky');
    if (!vys || !vys.poz) {
      el.innerHTML = box('Model', 'nelze sestavit', vys && vys.chyba);
      for (const id of ['dimensionsInfo', 'wallInfo', 'volumeInfo', 'triInfo']) $(id).textContent = '';
      $('infoShape').textContent = CC.NAZVY[q.shapeType] || ''; $('vSit').innerHTML = '';
      return;
    }
    const r = vys.rozsah, rz = vys.rozsahRezu, o = vys.o, v = vys.v;
    const odh = G3D.odhadTisku(vys.objem, CC.HUSTOTA_PLA * 1000);
    $('infoShape').textContent = CC.NAZVY[q.shapeType] || '';
    $('dimensionsInfo').textContent = `řez ${mm(rz.sirka)} × ${mm(rz.vyska)} mm, výška ${mm(v.height)} mm` + (o.limec ? ` (s límcem ${mm(r.sirka)} × ${mm(r.vyska)})` : '');
    $('wallInfo').textContent = `stěna ${mm(v.wallThickness)} mm · ostří ${mm(v.bladeThickness)} mm`;
    $('volumeInfo').textContent = `≈ ${mm(vys.gramu)} g PLA`;
    $('triInfo').textContent = `${vys.troj.toLocaleString('cs-CZ')} trojúhelníků`;
    let h = box('Řez cukroví', `${fmt(rz.sirka)} × ${fmt(rz.vyska)} mm`, 'vnější obrys stěny');
    h += box('Celkem', `${fmt(r.sirka)} × ${fmt(r.vyska)} × ${fmt(v.height)} mm`, o.limec ? 's límcem, š × d × v' : 'bez límce, š × d × v');
    h += box('Stěna / ostří', `${fmt(v.wallThickness, 2)} / ${fmt(v.bladeThickness, 2)} mm`, `ostří ${fmt(v.bladeHeight)} mm vysoko` + (o.limec ? `, límec ${fmt(v.collarWidth)} × ${fmt(v.collarHeight)} mm` : ''));
    h += box('Objem', `${fmt(vys.objem / 1000, 2)} cm³`, 'plný díl');
    h += box('Hmotnost', `${fmt(odh.g, 1)} g`, 'PLA 1,24 g/cm³');
    h += box('Filament', `${fmt(odh.metru, 2)} m`, 'průměr 1,75 mm');
    h += box('Doba tisku', `≈ ${odh.minut < 60 ? odh.minut + ' min' : fmt(odh.minut / 60, 1) + ' h'}`, 'hrubý odhad, vrstva 0,2 mm');
    el.innerHTML = h;
    const s = CC.svar(vys.poz, vys.idx), k = KRAB.kontrolaSite(s.poz, s.idx);
    $('vSit').innerHTML = box('Síť', k.uzavrena ? '✔ těsná' : '✖ netěsná', `${vys.troj} trojúhelníků, ${k.teles} těleso`, k.uzavrena && k.teles === 1 ? 'ok-t' : 'chyba-t');
  }
  function souhrny(q) {
    TrubkyGui.souhrn('sTvar', (CC.NAZVY[q.shapeType] || '').replace(/^\S+\s/, '') + (q.shapeRotate ? ` · ${q.shapeRotate}°` : '') + (q.mirrorShape ? ' · zrcadlo' : ''), true);
    const k = q.scalePercent / 100;
    TrubkyGui.souhrn('sRozmery', `${fmt(q.width * k)} × ${fmt(q.length * k)} × ${fmt(q.height)} mm`, true);
    TrubkyGui.souhrn('sKonstrukce', `stěna ${fmt(q.wallThickness, 2)} · ostří ${fmt(q.bladeThickness, 2)}${q.collarOn ? ' · límec' : ''}`, true);
    TrubkyGui.souhrn('sVzhled', q.opacity < 100 ? `průhlednost ${q.opacity} %` : '', q.opacity < 100 || !q.bgAuto);
  }

  /* ---------- půdorys (2D) ---------- */
  function vykresliPudorys() {
    const platno = $('obrys-plocha');
    if (!na2d || !vys || !vys.o) return;
    const sirkaCss = platno.clientWidth || 400, vyskaCss = platno.clientHeight || 400;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    platno.width = Math.max(1, Math.round(sirkaCss * dpr)); platno.height = Math.max(1, Math.round(vyskaCss * dpr));
    const ctx = platno.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = css('--bg-deep', '#121212'); ctx.fillRect(0, 0, sirkaCss, vyskaCss);
    const o = vys.o, vse = [o.limec, o.zaklad, o.vnitrni].filter(Boolean);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const c of vse) for (const p of c) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    const mer = Math.min(sirkaCss / (x1 - x0 + 16), (vyskaCss - 40) / (y1 - y0 + 16));
    const cx = sirkaCss / 2 - (x0 + x1) / 2 * mer, cy = vyskaCss / 2 + 10 + (y0 + y1) / 2 * mer;
    // mřížka po 10 mm
    ctx.strokeStyle = css('--border', '#404040'); ctx.lineWidth = 1; ctx.beginPath();
    for (let x = Math.ceil((x0 - 10) / 10) * 10; x <= x1 + 10; x += 10) { const px = cx + x * mer; ctx.moveTo(px, 0); ctx.lineTo(px, vyskaCss); }
    for (let y = Math.ceil((y0 - 10) / 10) * 10; y <= y1 + 10; y += 10) { const py = cy - y * mer; ctx.moveTo(0, py); ctx.lineTo(sirkaCss, py); }
    ctx.stroke();
    const cesta = (c, barva, sirka, dash) => {
      ctx.save(); ctx.setLineDash(dash || []); ctx.strokeStyle = barva; ctx.lineWidth = sirka; ctx.beginPath();
      c.forEach((p, i) => { const px = cx + p.x * mer, py = cy - p.y * mer; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
      ctx.closePath(); ctx.stroke(); ctx.restore();
    };
    if (o.limec) cesta(o.limec, css('--text-faint', '#888'), 1.5, [6, 4]);
    cesta(o.zaklad, css('--accent', '#6aa6fd'), 2.5);
    if (o.vnitrni) cesta(o.vnitrni, css('--danger', '#e05d5d'), 1.8, [5, 3]);
    // legenda dole (nahoře je přepínač náhledu a karta)
    ctx.fillStyle = css('--text-muted', '#b0b0b0'); ctx.font = '13px ' + css('--font', 'sans-serif');
    ctx.fillText('— vnější obrys   – – vnitřní líc stěny   ⋯ límec   ▫ čtverec mřížky 10 mm', 12, vyskaCss - 30);
  }
  function prepniNahled(dvaD) {
    na2d = dvaD;
    $('tab3d').setAttribute('aria-selected', String(!dvaD)); $('tab2d').setAttribute('aria-selected', String(dvaD));
    $('obrys-plocha').hidden = !dvaD;
    if (dvaD) vykresliPudorys(); else nahled.prekresli();
  }
  $('tab3d').addEventListener('click', () => prepniNahled(false));
  $('tab2d').addEventListener('click', () => prepniNahled(true));
  new ResizeObserver(() => vykresliPudorys()).observe($('canvas-container'));
  function pohled(j) { prepniNahled(false); nahled.pohled(j); }

  /* ---------- nabídky, export ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_vykrajovatko_gui', pohled: j => pohled(j) });
  const PREDVOLBY = [
    { nazev: '🍪 Drobné linecké', popis: '40 mm, stěna 1 mm', s: { width: 40, height: 12, wallThickness: 1, bladeThickness: 0.5, bladeHeight: 2, scalePercent: 100 } },
    { nazev: '🍪 Běžné cukroví', popis: '60 mm, výška 15', s: { width: 60, height: 15, wallThickness: 1.2, bladeThickness: 0.6, bladeHeight: 2, scalePercent: 100 } },
    { nazev: '🧍 Perník', popis: '90 mm, výška 20', s: { width: 90, height: 20, wallThickness: 1.4, bladeThickness: 0.6, bladeHeight: 3, scalePercent: 100 } },
    { nazev: '🎂 Velké na dort', popis: '120 mm, výška 25', s: { width: 120, height: 25, wallThickness: 1.6, bladeThickness: 0.8, bladeHeight: 3, scalePercent: 100 } },
  ];
  for (const v of PREDVOLBY) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${v.nazev}<span class="pozn">${v.popis}</span>`;
    b.addEventListener('click', () => {
      const q = Object.assign(G3D.kopie(app.p), v.s);
      q.length = q.lockAspect ? CC.delkaPodlePomeru(q) : v.s.width;
      app.nahrad(q);
    });
    $('seznamPredvoleb').appendChild(b);
  }
  function lzeExport() {
    if (!vys || !vys.poz) { Dialog.chyba(vys && vys.chyba || 'Nejdřív je potřeba vykrajovátko vygenerovat.'); return false; }
    return true;
  }
  function jmenoSouboru(pripona) {
    const q = app.p;
    const zaklad = q.nazev || (sbirka && sbirka.aktivni && sbirka.aktivni())
      || `${(CC.NAZVY[q.shapeType] || 'tvar').replace(/^\S+\s/, '')}_${Math.round(q.width * q.scalePercent / 100)}x${Math.round(q.length * q.scalePercent / 100)}`;
    const cisty = zaklad.replace(/[^\p{L}\p{N}._-]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'tvar';
    return `vykrajovatko_${cisty}.${pripona}`;
  }
  const soubor3mf = () => { const s = CC.svar(vys.poz, vys.idx); return KRAB.soubor3mf([{ nazev: 'Vykrajovátko', poz: s.poz, idx: s.idx, barva: app.p.objectColor }], app.p.nazev || 'Vykrajovátko'); };
  function exportuj(druh) {
    if (!lzeExport()) return;
    if (druh === 'stl') { app.stahni(CC.stl(vys.poz, vys.idx), jmenoSouboru('stl'), 'model/stl'); Dialog.info('STL uloženo (mm, Z nahoru, stojí na podložce).'); }
    else if (druh === '3mf') app.stahni(soubor3mf(), jmenoSouboru('3mf'), 'model/3mf');
    else if (druh === 'obj') { app.stahni(CC.obj(vys.poz, vys.idx), jmenoSouboru('obj'), 'text/plain'); Dialog.info('OBJ uloženo.'); }
    else { app.stahni(CC.svg(vys.o, jmenoSouboru('svg')), jmenoSouboru('svg'), 'image/svg+xml'); Dialog.info('SVG půdorysu uloženo — v měřítku 1:1 v milimetrech.'); }
  }
  $('btnStl').addEventListener('click', () => exportuj('stl'));
  $('btn3mf').addEventListener('click', () => exportuj('3mf'));
  $('btnObj').addEventListener('click', () => exportuj('obj'));
  $('btnSvg').addEventListener('click', () => exportuj('svg'));
  $('btnFit').addEventListener('click', () => { prepniNahled(false); nahled.pohled('ponech'); });
  $('btnGenerate').addEventListener('click', () => { prepocitej(true); });
  app.prepinac('tRez', h => { nahled.prepni('rez', h); $('legRez').hidden = !h; });
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !(h && stavZobr.tisk); }, true);
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);
  app.prepinac('tTisk', h => { stavZobr.tisk = h; zobrazModel(true); });

  /* ---------- start ---------- */
  postavNabidku();
  app.start();
  setTimeout(nakresliNahledy, 60);
  window.CC_UI = { get p() { return app.p; }, get vys() { return vys; }, nastav, prepocitej, nahled, app };
})();
