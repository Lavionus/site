/* ============================================================
   animace_gif/stranka.js – ovládání stránky (DOM). Logika souborů je v jadro.js,
   kódování GIF/APNG běží ve worker.js.
   ============================================================ */
(function () {
  'use strict';
  const A = window.ANIMACE_GIF;
  const $ = id => document.getElementById(id);
  const LS = 'webapp_animace_gif_nastaveni';
  const MAX_ZPET = 40;

  // ---------- stav ----------
  let dalsiId = 1;
  const S = { sirka: 0, vyska: 0, snimky: [], akt: 0, vyber: new Set(), kotva: 0 };   // snimky: [{ id, obr, delka }]
  let zpet = [], vpred = [];
  const V = { zoom: 0, pixel: true, sach: true, cibule: false, cibuleDalsi: false, format: 'gif' };
  const POLE_NAST = ['gifBarev', 'gifPaleta', 'gifMetoda', 'gifDither', 'gifOpt', 'gifPrah', 'apngOpt', 'webmKvalita', 'webmPozadi',
    'spRezim', 'spSloupcu', 'spMezera', 'spOkraj', 'spFormat', 'spOrez', 'spMocnina', 'spPredpona', 'zipPredpona', 'prehrani', 'nazevSouboru'];

  function nactiNast() {
    try {
      const n = JSON.parse(localStorage.getItem(LS) || '{}');
      Object.assign(V, n.V || {});
      for (const id of POLE_NAST) if (n.pole && id in n.pole) { const e = $(id); if (e.type === 'checkbox') e.checked = n.pole[id]; else e.value = n.pole[id]; }
    } catch { /* poškozené nastavení – výchozí */ }
  }
  function ulozNast() {
    const pole = {};
    for (const id of POLE_NAST) { const e = $(id); pole[id] = e.type === 'checkbox' ? e.checked : e.value; }
    try { localStorage.setItem(LS, JSON.stringify({ V, pole })); } catch { /* plné úložiště */ }
  }

  // ---------- pomocné ----------
  const platna = new WeakMap();
  function platnoObr(obr) {
    let c = platna.get(obr);
    if (!c) {
      c = document.createElement('canvas'); c.width = obr.sirka; c.height = obr.vyska;
      c.getContext('2d').putImageData(new ImageData(obr.data, obr.sirka, obr.vyska), 0, 0);
      platna.set(obr, c);
    }
    return c;
  }
  function obrZPlatna(zdroj, w, h) {
    w = w || zdroj.width; h = h || zdroj.height;
    let c = zdroj;
    if (!(zdroj.getContext && zdroj.width === w && zdroj.height === h)) {
      c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(zdroj, 0, 0, w, h);
    }
    const d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h);
    return A.novyObr(w, h, d.data);
  }
  /* Přizpůsobí obrázek velikosti projektu (vejít se celý, na střed). */
  function prizpusob(obr, w, h) {
    if (obr.sirka === w && obr.vyska === h) return obr;
    const k = Math.min(w / obr.sirka, h / obr.vyska), nw = Math.round(obr.sirka * k), nh = Math.round(obr.vyska * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = !(V.pixel && Number.isInteger(k));
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(platnoObr(obr), Math.floor((w - nw) / 2), Math.floor((h - nh) / 2), nw, nh);
    return obrZPlatna(c);
  }
  const velikostTxt = b => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1).replace('.', ',') + ' kB' : (b / 1048576).toFixed(2).replace('.', ',') + ' MB';
  const celkovaDelka = () => S.snimky.reduce((s, x) => s + x.delka, 0);
  const novySnimek = (obr, delka) => ({ id: dalsiId++, obr, delka: Math.max(10, Math.round(delka || 100)) });
  function stahni(data, nazev, typ) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: typ });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = nazev; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  const pngBlob = c => new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('PNG se nepodařilo vytvořit (příliš velký obraz?)')), 'image/png'));
  const pngCache = new WeakMap();
  async function pngObr(obr) {
    let b = pngCache.get(obr);
    if (!b) { b = await pngBlob(platnoObr(obr)); pngCache.set(obr, b); }
    return b;
  }

  // ---------- historie ----------
  const snimek = () => ({ sirka: S.sirka, vyska: S.vyska, snimky: S.snimky.map(s => Object.assign({}, s)), akt: S.akt });
  function zaznam() { zpet.push(snimek()); if (zpet.length > MAX_ZPET) zpet.shift(); vpred = []; }
  function obnov(st) {
    S.sirka = st.sirka; S.vyska = st.vyska; S.snimky = st.snimky; S.akt = Math.min(st.akt, Math.max(0, st.snimky.length - 1));
    S.vyber = new Set(); S.kotva = S.akt;
  }
  function vratit() { if (!zpet.length) return; vpred.push(snimek()); obnov(zpet.pop()); hotovo(); }
  function znovu() { if (!vpred.length) return; zpet.push(snimek()); obnov(vpred.pop()); hotovo(); }

  /* Po každé změně: překreslit, uložit, přepočítat odhad. */
  function hotovo() {
    if (S.akt >= S.snimky.length) S.akt = Math.max(0, S.snimky.length - 1);
    for (const id of [...S.vyber]) if (!S.snimky.some(s => s.id === id)) S.vyber.delete(id);
    vykresliVse();
    planujUlozeni();
    planujOdhad();
  }

  // ---------- vykreslení ----------
  const platno = $('platno');
  function meritko() {
    if (V.zoom > 0) return V.zoom;
    const o = $('platnoObal');
    const k = Math.min((o.clientWidth - 34) / S.sirka, (o.clientHeight - 34) / S.vyska);
    if (!(k > 0)) return 1;
    return k >= 1 && V.pixel ? Math.max(1, Math.floor(k)) : Math.min(k, 8);
  }
  function vykresliNahled() {
    const prazdno = !S.snimky.length;
    $('prazdne').hidden = !prazdno;
    $('platnoRam').hidden = prazdno;
    if (prazdno) return;
    if (platno.width !== S.sirka || platno.height !== S.vyska) { platno.width = S.sirka; platno.height = S.vyska; }
    const k = meritko();
    platno.style.width = Math.round(S.sirka * k) + 'px';
    platno.style.height = Math.round(S.vyska * k) + 'px';
    platno.classList.toggle('pixel', V.pixel);
    $('platnoRam').classList.toggle('bez-sachovnice', !V.sach);
    const ctx = platno.getContext('2d');
    ctx.clearRect(0, 0, S.sirka, S.vyska);
    ctx.drawImage(platnoObr(S.snimky[S.akt].obr), 0, 0);
    if (V.cibule && !hraje) {
      const n = S.snimky.length;
      if (S.akt > 0) { ctx.globalAlpha = 0.35; ctx.drawImage(platnoObr(S.snimky[S.akt - 1].obr), 0, 0); }
      if (V.cibuleDalsi && S.akt < n - 1) { ctx.globalAlpha = 0.2; ctx.drawImage(platnoObr(S.snimky[S.akt + 1].obr), 0, 0); }
      ctx.globalAlpha = 1;
    }
    const s = S.snimky[S.akt];
    $('infoSnimek').textContent = `Snímek ${S.akt + 1} / ${S.snimky.length} · ${s.delka} ms`;
  }
  function vykresliOsu() {
    const osa = $('osa');
    osa.textContent = '';
    const vyskaN = 64;
    S.snimky.forEach((s, i) => {
      const el = document.createElement('div');
      el.className = 'snimek';
      el.dataset.i = i;
      el.draggable = true;
      el.setAttribute('role', 'option');
      const c = document.createElement('canvas');
      const sirkaN = Math.max(8, Math.min(120, Math.round(vyskaN * S.sirka / S.vyska)));
      c.width = sirkaN; c.height = vyskaN;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = !V.pixel;
      ctx.drawImage(platnoObr(s.obr), 0, 0, sirkaN, vyskaN);
      const cislo = document.createElement('span');
      cislo.className = 'cislo'; cislo.textContent = i + 1;
      const vstup = document.createElement('input');
      vstup.type = 'number'; vstup.min = 10; vstup.max = 65000; vstup.step = 10; vstup.value = s.delka;
      vstup.className = 'vstup'; vstup.title = 'Délka snímku v ms'; vstup.setAttribute('aria-label', `Délka snímku ${i + 1} v ms`);
      vstup.addEventListener('change', () => {
        const v = Math.max(10, Math.min(65000, Math.round(+vstup.value || 100)));
        zaznam(); s.delka = v; hotovo();
      });
      el.append(c, cislo, vstup);
      osa.appendChild(el);
    });
    oznacVyber();
  }
  function oznacVyber() {
    document.querySelectorAll('#osa .snimek').forEach(el => {
      const i = +el.dataset.i, s = S.snimky[i];
      el.classList.toggle('aktualni', i === S.akt);
      el.classList.toggle('vybrany', S.vyber.has(s.id));
      el.setAttribute('aria-selected', S.vyber.has(s.id) || i === S.akt ? 'true' : 'false');
    });
    const n = S.snimky.length, v = vybrane().length;
    $('infoVyber').textContent = n ? (S.vyber.size > 1 ? `Vybráno ${v} z ${n}` : `Snímek ${S.akt + 1} z ${n}`) : 'Žádné snímky';
  }
  function videtAkt() {
    const el = document.querySelector(`#osa .snimek[data-i="${S.akt}"]`);
    if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function vykresliVse() {
    vykresliNahled();
    vykresliOsu();
    const n = S.snimky.length;
    $('pocet').textContent = n ? `${S.sirka}×${S.vyska} · ${n} sn. · ${(celkovaDelka() / 1000).toFixed(2).replace('.', ',')} s` : '';
    $('tlUlozit').disabled = !n;
    document.querySelectorAll('[data-prikaz="zpet"]').forEach(b => { b.disabled = !zpet.length; });
    document.querySelectorAll('[data-prikaz="znovu"]').forEach(b => { b.disabled = !vpred.length; });
  }
  function nastavAkt(i, vyber) {
    if (!S.snimky.length) return;
    S.akt = Math.max(0, Math.min(S.snimky.length - 1, i));
    if (vyber === 'rozsir') {
      S.vyber = new Set();
      const [a, b] = [Math.min(S.kotva, S.akt), Math.max(S.kotva, S.akt)];
      for (let k = a; k <= b; k++) S.vyber.add(S.snimky[k].id);
    } else if (vyber === 'prepni') {
      const id = S.snimky[S.akt].id;
      if (S.vyber.has(id)) S.vyber.delete(id); else S.vyber.add(id);
      S.kotva = S.akt;
    } else { S.vyber = new Set([S.snimky[S.akt].id]); S.kotva = S.akt; }
    vykresliNahled(); oznacVyber(); videtAkt();
  }
  /* Indexy vybraných snímků (bez výběru = aktuální). */
  function vybrane() {
    const out = [];
    S.snimky.forEach((s, i) => { if (S.vyber.has(s.id)) out.push(i); });
    return out.length ? out : (S.snimky.length ? [S.akt] : []);
  }

  // ---------- přehrávání ----------
  let hraje = false, posledniCas = 0, zbyva = 0;
  function prehrat(ano) {
    hraje = ano === undefined ? !hraje : ano;
    if (S.snimky.length < 2) hraje = false;
    $('tlPrehrat').textContent = hraje ? '⏸ Zastavit' : '▶ Přehrát';
    if (hraje) { posledniCas = performance.now(); zbyva = S.snimky[S.akt].delka; requestAnimationFrame(krok); }
    else { vykresliNahled(); oznacVyber(); }
  }
  function krok(t) {
    if (!hraje) return;
    const dt = Math.min(1000, t - posledniCas);
    posledniCas = t;
    zbyva -= dt * +$('rychlost').value;
    let zmena = false;
    while (zbyva <= 0 && S.snimky.length) { S.akt = (S.akt + 1) % S.snimky.length; zbyva += Math.max(10, S.snimky[S.akt].delka); zmena = true; }
    if (zmena) { vykresliNahled(); oznacVyber(); }
    requestAnimationFrame(krok);
  }

  // ---------- vkládání snímků ----------
  /* seznam: [{ obr, delka }]; rezim 'nahradit' | 'pridat' */
  function vlozSnimky(seznam, rezim, prehrani) {
    if (!seznam.length) return;
    zaznam();
    prehrat(false);
    if (rezim === 'nahradit' || !S.snimky.length) {
      S.sirka = seznam[0].obr.sirka; S.vyska = seznam[0].obr.vyska;
      S.snimky = [];
      if (prehrani !== undefined) { const p = $('prehrani'); p.value = [...p.options].some(o => +o.value === prehrani) ? prehrani : 0; ulozNast(); }
    }
    const od = S.snimky.length;
    for (const s of seznam) S.snimky.push(novySnimek(prizpusob(s.obr, S.sirka, S.vyska), s.delka));
    S.akt = od; S.kotva = od;
    S.vyber = new Set();
    hotovo();
    Dialog.info(`Načteno ${seznam.length} ${seznam.length === 1 ? 'snímek' : seznam.length < 5 ? 'snímky' : 'snímků'} (${S.sirka}×${S.vyska}).`);
  }

  async function nactiSoubory(soubory, rezim) {
    const pole = [...soubory];
    const video = pole.find(f => f.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|m4v|ogv)$/i.test(f.name));
    if (video) return otevriVideo(video);
    const obrazky = pole.filter(f => f.type.startsWith('image/') || /\.(gif|png|apng|jpe?g|webp|bmp|avif)$/i.test(f.name))
      .sort((a, b) => a.name.localeCompare(b.name, 'cs', { numeric: true }));
    if (!obrazky.length) return Dialog.chyba('Nenašel jsem žádný obrázek ani video.');
    const seznam = [];
    let prehrani;
    for (const f of obrazky) {
      try {
        const data = new Uint8Array(await f.arrayBuffer());
        if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) {
          const g = A.dekodujGif(data);
          if (prehrani === undefined) prehrani = g.prehrani;
          for (const s of g.snimky) seznam.push(s);
        } else {
          const bmp = await createImageBitmap(new Blob([data], { type: f.type }));
          seznam.push({ obr: obrZPlatna(bmp, bmp.width, bmp.height), delka: 100 });
          bmp.close && bmp.close();
        }
      } catch (e) {
        Dialog.chyba(`${f.name}: ${e.message || e}`);
      }
    }
    vlozSnimky(seznam, rezim, prehrani);
  }

  // ---------- ukázka ----------
  function ukazka() {
    const W = 160, H = 120, N = 16, seznam = [];
    for (let k = 0; k < N; k++) {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#7ec8f2'); g.addColorStop(1, '#d9f1ff');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#5aa04a'; ctx.fillRect(0, 96, W, 24);
      ctx.fillStyle = '#467f3a'; for (let x = 0; x < W; x += 8) ctx.fillRect(x, 96, 4, 3);
      const f = k / N, vys = Math.abs(Math.sin(f * Math.PI)), y = 84 - vys * 64;
      const sq = vys < 0.15 ? 1 - (0.15 - vys) * 2.2 : 1;
      ctx.fillStyle = 'rgba(0,0,0,.22)';
      ctx.beginPath(); ctx.ellipse(W / 2, 97, 16 - vys * 7, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(W / 2, y + 12 * (1 - sq)); ctx.scale(1 / sq, sq);
      const r = ctx.createRadialGradient(-4, -5, 2, 0, 0, 13);
      r.addColorStop(0, '#ffb36b'); r.addColorStop(1, '#e0452b');
      ctx.fillStyle = r; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#1d3b57'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('GIF', 8, 18);
      seznam.push({ obr: obrZPlatna(c), delka: 60 });
    }
    vlozSnimky(seznam, 'nahradit', 0);
  }

  // ---------- příkazy nad snímky ----------
  function duplikovat() {
    const idx = vybrane();
    if (!idx.length) return;
    zaznam();
    const posl = idx[idx.length - 1], kopie = idx.map(i => novySnimek(S.snimky[i].obr, S.snimky[i].delka));
    S.snimky.splice(posl + 1, 0, ...kopie);
    S.vyber = new Set(kopie.map(s => s.id)); S.akt = posl + 1; S.kotva = S.akt;
    hotovo();
  }
  async function smazat() {
    const idx = vybrane();
    if (!idx.length) return;
    if (idx.length === S.snimky.length && !(await Dialog.potvrd('Smazat všechny snímky?', { ok: 'Smazat' }))) return;
    zaznam();
    const mn = new Set(idx);
    S.snimky = S.snimky.filter((_, i) => !mn.has(i));
    S.akt = Math.min(idx[0], S.snimky.length - 1); S.vyber = new Set(); S.kotva = S.akt;
    hotovo();
  }
  function posun(smer) {
    const idx = vybrane();
    if (!idx.length) return;
    const cil = smer < 0 ? idx[0] - 1 : idx[idx.length - 1] + 2;
    if (cil < 0 || cil > S.snimky.length) return;
    presunNa(idx, cil);
  }
  function presunNa(idx, cil) {
    zaznam();
    const ids = idx.map(i => S.snimky[i].id), aktId = S.snimky[S.akt].id;
    const r = A.presun(S.snimky, idx, cil);
    S.snimky = r.pole;
    S.vyber = new Set(ids);
    S.akt = Math.max(0, S.snimky.findIndex(s => s.id === aktId));
    hotovo();
  }
  function nahradUseky(fn) {
    // obrátit / ping-pong: na výběr (souvislý úsek ≥ 2 snímky), jinak na celou animaci
    const idx = vybrane();
    zaznam();
    if (idx.length >= 2 && idx[idx.length - 1] - idx[0] + 1 === idx.length) {
      const usek = S.snimky.slice(idx[0], idx[idx.length - 1] + 1);
      S.snimky.splice(idx[0], usek.length, ...fn(usek));
    } else S.snimky = fn(S.snimky);
    // ping-pong přidává tytéž objekty – každý snímek potřebuje vlastní id
    const videne = new Set();
    S.snimky = S.snimky.map(s => { if (videne.has(s.id)) return novySnimek(s.obr, s.delka); videne.add(s.id); return s; });
    hotovo();
  }
  function prazdny() {
    if (!S.snimky.length) return Dialog.chyba('Nejdřív otevřete nebo vytvořte animaci.');
    zaznam();
    S.snimky.splice(S.akt + 1, 0, novySnimek(A.novyObr(S.sirka, S.vyska), S.snimky[S.akt].delka));
    S.akt++; S.vyber = new Set(); S.kotva = S.akt;
    hotovo();
  }
  function upravVse(fn) {
    if (!S.snimky.length) return;
    zaznam();
    S.snimky = S.snimky.map(s => Object.assign({}, s, { obr: fn(s.obr) }));
    S.sirka = S.snimky[0].obr.sirka; S.vyska = S.snimky[0].obr.vyska;
    hotovo();
  }
  function orezPruhledne() {
    if (!S.snimky.length) return;
    let x0 = S.sirka, y0 = S.vyska, x1 = 0, y1 = 0;
    for (const s of S.snimky) {
      const r = A.orezPruhledne(s.obr);
      if (r.w === 1 && r.h === 1 && !s.obr.data[3]) continue;
      x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h);
    }
    if (x1 <= x0 || (x0 === 0 && y0 === 0 && x1 === S.sirka && y1 === S.vyska)) return Dialog.info('Žádné průhledné okraje k oříznutí.');
    upravVse(o => A.orez(o, x0, y0, x1 - x0, y1 - y0));
    Dialog.info(`Oříznuto na ${x1 - x0}×${y1 - y0}.`);
  }

  // ---------- modální okna ----------
  function otevriModal(id) { zavriNabidky(); prehrat(false); $(id).classList.add('zobraz'); const f = $(id).querySelector('input,select,button.primary'); if (f) f.focus(); }
  function zavriModal(el) { (el || document.querySelector('.modal-bg.zobraz'))?.classList.remove('zobraz'); }
  document.querySelectorAll('.modal-bg').forEach(bg => {
    bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-zavrit]')) zavriModal(bg); });
  });
  const otevrenyModal = () => document.querySelector('.modal-bg.zobraz');
  function vyzadujSnimky() { if (!S.snimky.length) { Dialog.chyba('Nejdřív otevřete nebo vytvořte animaci.'); return false; } return true; }

  // ---------- video ----------
  let vidSoubor = null, vidUrl = null;
  const vid = $('vidNahled');
  function otevriVideo(f) {
    vidSoubor = f;
    if (vidUrl) URL.revokeObjectURL(vidUrl);
    vidUrl = URL.createObjectURL(f);
    vid.src = vidUrl;
    $('vidInfo').textContent = `${f.name} – načítám…`;
    $('vidVlozit').value = S.snimky.length ? 'pridat' : 'nahradit';
    vid.onloadedmetadata = async () => {
      let delka = vid.duration;
      if (!isFinite(delka) && window.Mediabunny) {
        // WebM bez délky v hlavičce: spočítat z paketů
        try {
          const MB = window.Mediabunny, inp = new MB.Input({ source: new MB.BlobSource(f), formats: MB.ALL_FORMATS });
          delka = await inp.computeDuration();
          inp.dispose && inp.dispose();
        } catch { /* necháme odhad níže */ }
      }
      if (!isFinite(delka) || delka <= 0) delka = 3;
      $('vidInfo').textContent = `${f.name} · ${vid.videoWidth}×${vid.videoHeight} · ${delka.toFixed(1).replace('.', ',')} s`;
      $('vidOd').value = 0;
      $('vidDo').value = Math.min(delka, 3).toFixed(2);
      $('vidSirka').value = Math.min(480, vid.videoWidth);
      vidPocet();
    };
    vid.onerror = () => { $('vidInfo').textContent = `${f.name} – prohlížeč video neumí přehrát, zkusím knihovnu Mediabunny.`; };
    otevriModal('mVideo');
  }
  function vidParametry() {
    const od = Math.max(0, +$('vidOd').value || 0), konec = Math.max(od + 0.01, +$('vidDo').value || 0);
    const fps = Math.max(1, Math.min(60, +$('vidFps').value || 10));
    const sirka = Math.max(16, Math.min(4096, Math.round(+$('vidSirka').value || 480)));
    const pomer = vid.videoWidth ? vid.videoHeight / vid.videoWidth : 9 / 16;
    const n = Math.max(1, Math.floor((konec - od) * fps + 1e-6));
    return { od, konec, fps, sirka, vyska: Math.max(1, Math.round(sirka * pomer)), n };
  }
  function vidPocet() {
    const p = vidParametry();
    $('vidPocet').textContent = `${p.n} snímků ${p.sirka}×${p.vyska}, každý ${Math.round(1000 / p.fps)} ms` + (p.n > 300 ? ' – hodně snímků, GIF bude velký.' : '');
  }
  ['vidOd', 'vidDo', 'vidFps', 'vidSirka'].forEach(id => $(id).addEventListener('input', vidPocet));
  $('vidOdTed').onclick = () => { $('vidOd').value = vid.currentTime.toFixed(2); vidPocet(); };
  $('vidDoTed').onclick = () => { $('vidDo').value = vid.currentTime.toFixed(2); vidPocet(); };
  $('vidImport').onclick = async () => {
    if (!vidSoubor) return;
    const p = vidParametry(), delka = 1000 / p.fps;
    if (p.n > 1500) return Dialog.chyba('Najednou jde načíst nejvýš 1500 snímků – zkraťte úsek nebo snižte FPS.');
    const casy = Array.from({ length: p.n }, (_, i) => p.od + (i + 0.5) / p.fps);
    const pr = $('vidPrubeh'); pr.hidden = false;
    const ukaz = i => { pr.firstElementChild.style.width = (i / p.n * 100) + '%'; };
    $('vidImport').disabled = true;
    const seznam = [];
    try {
      const MB = window.Mediabunny;
      let hotovoMB = false;
      if (MB) {
        try {
          const input = new MB.Input({ source: new MB.BlobSource(vidSoubor), formats: MB.ALL_FORMATS });
          const vt = await input.getPrimaryVideoTrack();
          if (vt && await vt.canDecode()) {
            const sink = new MB.CanvasSink(vt, { width: p.sirka, height: p.vyska, fit: 'fill', poolSize: 0 });
            for await (const w of sink.canvasesAtTimestamps(casy)) {
              if (w) seznam.push({ obr: obrZPlatna(w.canvas, p.sirka, p.vyska), delka });
              else if (seznam.length) seznam.push({ obr: seznam[seznam.length - 1].obr, delka });
              ukaz(seznam.length);
            }
            hotovoMB = seznam.length > 0;
          }
          input.dispose && input.dispose();
        } catch (e) { console.warn('Mediabunny nezvládl video, zkusím přehrávač:', e); seznam.length = 0; }
      }
      if (!hotovoMB) {
        // záloha: posouvání přehrávače
        if (!vid.videoWidth) throw new Error('Video nejde v tomto prohlížeči dekódovat.');
        const c = document.createElement('canvas'); c.width = p.sirka; c.height = p.vyska;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        for (const t of casy) {
          await new Promise(res => { vid.onseeked = res; vid.currentTime = Math.min(t, vid.duration - 0.001); });
          ctx.drawImage(vid, 0, 0, p.sirka, p.vyska);
          seznam.push({ obr: obrZPlatna(c), delka });
          ukaz(seznam.length);
        }
      }
      zavriModal($('mVideo'));
      vlozSnimky(seznam, $('vidVlozit').value);
    } catch (e) {
      Dialog.chyba('Načtení videa selhalo: ' + (e.message || e));
    } finally {
      pr.hidden = true; $('vidImport').disabled = false;
    }
  };

  // ---------- sprite sheet ----------
  let spObr = null, spRects = [];
  async function otevriSprite(f) {
    try {
      const bmp = await createImageBitmap(f);
      spObr = obrZPlatna(bmp, bmp.width, bmp.height);
    } catch (e) { return Dialog.chyba('Obrázek nejde otevřít: ' + (e.message || e)); }
    $('spInfo').textContent = `${f.name} · ${spObr.sirka}×${spObr.vyska} px`;
    $('spVlozit').value = S.snimky.length ? 'pridat' : 'nahradit';
    // výchozí odhad mřížky: čtvercové buňky podle výšky
    if (spObr.sirka > spObr.vyska && spObr.sirka % spObr.vyska === 0) { $('spSl').value = spObr.sirka / spObr.vyska; $('spRa').value = 1; }
    $('spBW').value = Math.min(spObr.sirka, spObr.vyska); $('spBH').value = Math.min(spObr.sirka, spObr.vyska);
    otevriModal('mSprite');
    spPrepocti();
  }
  function spNastaveni() {
    const mod = document.querySelector('input[name=spMod]:checked').value;
    const podle = document.querySelector('input[name=spPodle]:checked').value;
    return { mod, podle };
  }
  function spPrepocti() {
    if (!spObr) return;
    const { mod, podle } = spNastaveni();
    document.querySelectorAll('[data-sp]').forEach(f => { f.hidden = f.dataset.sp !== mod; });
    document.querySelectorAll('[data-podle]').forEach(f => { f.hidden = f.dataset.podle !== podle; });
    if (mod === 'mrizka') {
      const o = { okrajX: +$('spOX').value || 0, okrajY: +$('spOY').value || 0, mezeraX: +$('spMX').value || 0, mezeraY: +$('spMY').value || 0 };
      if (podle === 'pocet') Object.assign(o, A.bunkaZPoctu(spObr.sirka, spObr.vyska, Math.max(1, +$('spSl').value || 1), Math.max(1, +$('spRa').value || 1), o));
      else { o.bunkaW = +$('spBW').value || 1; o.bunkaH = +$('spBH').value || 1; }
      spRects = o.bunkaW > 0 && o.bunkaH > 0 ? A.rezMrizka(spObr.sirka, spObr.vyska, o) : [];
      if ($('spVynechat').checked) spRects = spRects.filter(r => !A.jePrazdny(spObr, r, null, 0));
    } else {
      const pozadi = $('spPozadi').value === 'roh' ? [spObr.data[0], spObr.data[1], spObr.data[2]] : null;
      spRects = A.rezAuto(spObr, { pozadi, tolerance: +$('spTol').value || 0, spoj: +$('spSpoj').value || 0, minPlocha: +$('spMin').value || 1 });
    }
    spKresli();
  }
  function spKresli() {
    const c = $('spNahled'), sirkaObl = Math.max(200, c.parentElement.clientWidth - 20);
    const k = Math.min(8, sirkaObl / spObr.sirka, 1200 / spObr.vyska);
    c.width = Math.round(spObr.sirka * k); c.height = Math.round(spObr.vyska * k);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = k < 1;
    ctx.drawImage(platnoObr(spObr), 0, 0, c.width, c.height);
    const akc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#6aa6fd';
    ctx.lineWidth = 1.5; ctx.font = '11px sans-serif'; ctx.textBaseline = 'top';
    spRects.forEach((r, i) => {
      ctx.strokeStyle = '#000'; ctx.strokeRect(r.x * k + 1.5, r.y * k + 1.5, r.w * k - 1, r.h * k - 1);
      ctx.strokeStyle = akc; ctx.strokeRect(r.x * k + 0.5, r.y * k + 0.5, r.w * k - 1, r.h * k - 1);
      if (r.w * k > 16) { ctx.fillStyle = akc; ctx.fillRect(r.x * k + 1, r.y * k + 1, 18, 13); ctx.fillStyle = '#000'; ctx.fillText(i + 1, r.x * k + 3, r.y * k + 2); }
    });
    $('spImport').textContent = `Načíst ${spRects.length} snímků`;
    $('spImport').disabled = !spRects.length;
  }
  $('mSprite').addEventListener('input', e => { if (e.target.id !== 'spDelka') spPrepocti(); });
  $('spImport').onclick = () => {
    if (!spRects.length) return;
    const delka = +$('spDelka').value || 100;
    let obr = spRects.map(r => A.orez(spObr, r.x, r.y, r.w, r.h));
    const W = Math.max(...obr.map(o => o.sirka)), H = Math.max(...obr.map(o => o.vyska));
    obr = obr.map(o => o.sirka === W && o.vyska === H ? o : A.umisti(o, W, H, $('spZarovnani').value));
    zavriModal($('mSprite'));
    vlozSnimky(obr.map(o => ({ obr: o, delka })), $('spVlozit').value);
  };

  // ---------- ořez ----------
  const OR = { x: 0, y: 0, w: 1, h: 1, k: 1 };
  function otevriOrez() {
    if (!vyzadujSnimky()) return;
    Object.assign(OR, { x: 0, y: 0, w: S.sirka, h: S.vyska });
    otevriModal('mOrez');
    orezDoPoli(); orezKresli();
  }
  function orezDoPoli() { $('orezX').value = OR.x; $('orezY').value = OR.y; $('orezW').value = OR.w; $('orezH').value = OR.h; }
  function orezZPoli() {
    OR.x = Math.max(0, Math.min(S.sirka - 1, Math.round(+$('orezX').value || 0)));
    OR.y = Math.max(0, Math.min(S.vyska - 1, Math.round(+$('orezY').value || 0)));
    OR.w = Math.max(1, Math.min(S.sirka - OR.x, Math.round(+$('orezW').value || 1)));
    OR.h = Math.max(1, Math.min(S.vyska - OR.y, Math.round(+$('orezH').value || 1)));
  }
  function orezKresli() {
    const c = $('orezNahled'), sirkaObl = Math.max(200, c.parentElement.clientWidth - 20);
    OR.k = Math.min(8, sirkaObl / S.sirka, 900 / S.vyska);
    c.width = Math.round(S.sirka * OR.k); c.height = Math.round(S.vyska * OR.k);
    const ctx = c.getContext('2d'), k = OR.k;
    ctx.imageSmoothingEnabled = !V.pixel;
    ctx.drawImage(platnoObr(S.snimky[S.akt].obr), 0, 0, c.width, c.height);
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(0, 0, c.width, OR.y * k);
    ctx.fillRect(0, (OR.y + OR.h) * k, c.width, c.height);
    ctx.fillRect(0, OR.y * k, OR.x * k, OR.h * k);
    ctx.fillRect((OR.x + OR.w) * k, OR.y * k, c.width, OR.h * k);
    ctx.strokeStyle = '#fff'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5;
    ctx.strokeRect(OR.x * k + 0.75, OR.y * k + 0.75, OR.w * k - 1.5, OR.h * k - 1.5);
    ctx.setLineDash([]);
  }
  ['orezX', 'orezY', 'orezW', 'orezH'].forEach(id => $(id).addEventListener('input', () => { orezZPoli(); orezKresli(); }));
  $('orezVse').onclick = () => { Object.assign(OR, { x: 0, y: 0, w: S.sirka, h: S.vyska }); orezDoPoli(); orezKresli(); };
  (() => {
    const c = $('orezNahled');
    let start = null;
    const bod = e => { const r = c.getBoundingClientRect(); return [Math.max(0, Math.min(S.sirka, Math.round((e.clientX - r.left) / r.width * S.sirka))), Math.max(0, Math.min(S.vyska, Math.round((e.clientY - r.top) / r.height * S.vyska)))]; };
    c.addEventListener('pointerdown', e => { start = bod(e); c.setPointerCapture(e.pointerId); });
    c.addEventListener('pointermove', e => {
      if (!start) return;
      let [x, y] = bod(e);
      const pomer = +$('orezPomer').value;
      let w = Math.abs(x - start[0]), h = Math.abs(y - start[1]);
      if (pomer) { h = Math.round(w / pomer); if (h > S.vyska) { h = S.vyska; w = Math.round(h * pomer); } y = start[1] + (y >= start[1] ? h : -h); x = start[0] + (x >= start[0] ? w : -w); }
      OR.x = Math.max(0, Math.min(x, start[0])); OR.y = Math.max(0, Math.min(y, start[1]));
      OR.w = Math.max(1, Math.min(S.sirka - OR.x, w)); OR.h = Math.max(1, Math.min(S.vyska - OR.y, h));
      orezDoPoli(); orezKresli();
    });
    c.addEventListener('pointerup', () => { start = null; });
  })();
  $('orezOk').onclick = () => {
    orezZPoli();
    zavriModal($('mOrez'));
    if (OR.x === 0 && OR.y === 0 && OR.w === S.sirka && OR.h === S.vyska) return;
    upravVse(o => A.orez(o, OR.x, OR.y, OR.w, OR.h));
  };

  // ---------- změna velikosti ----------
  function otevriVelikost() {
    if (!vyzadujSnimky()) return;
    $('velW').value = S.sirka; $('velH').value = S.vyska;
    $('velMetoda').value = V.pixel ? 'nejblizsi' : 'plynule';
    otevriModal('mVelikost');
  }
  $('velW').addEventListener('input', () => { if ($('velZamek').checked) $('velH').value = Math.max(1, Math.round(+$('velW').value * S.vyska / S.sirka)); });
  $('velH').addEventListener('input', () => { if ($('velZamek').checked) $('velW').value = Math.max(1, Math.round(+$('velH').value * S.sirka / S.vyska)); });
  document.querySelectorAll('[data-proc]').forEach(b => b.addEventListener('click', () => {
    const p = +b.dataset.proc / 100;
    $('velW').value = Math.max(1, Math.round(S.sirka * p)); $('velH').value = Math.max(1, Math.round(S.vyska * p));
  }));
  $('velOk').onclick = () => {
    const w = Math.round(+$('velW').value), h = Math.round(+$('velH').value);
    if (!(w >= 1 && h >= 1 && w <= 8192 && h <= 8192)) return Dialog.chyba('Rozměr musí být 1 až 8192 px.');
    zavriModal($('mVelikost'));
    if (w === S.sirka && h === S.vyska) return;
    const metoda = $('velMetoda').value;
    upravVse(o => A.zmenVelikost(o, w, h, metoda));
  };

  // ---------- text ----------
  const TX = { x: 0.5, y: 0.85 };
  function otevriText() {
    if (!vyzadujSnimky()) return;
    $('txtRozsah').value = S.vyber.size > 1 ? 'vyber' : 'vse';
    $('txtOstre').checked = V.pixel && S.sirka <= 256;
    if (!$('txtVel').dataset.upraveno) $('txtVel').value = Math.max(8, Math.round(S.vyska / 7));
    otevriModal('mText');
    textKresli();
  }
  /* Vrstva s textem ve velikosti animace (průhledné pozadí). */
  function textVrstva() {
    const c = document.createElement('canvas'); c.width = S.sirka; c.height = S.vyska;
    const ctx = c.getContext('2d');
    const vel = Math.max(4, +$('txtVel').value || 32), obrys = Math.max(0, +$('txtObrys').value || 0);
    const radky = $('txtText').value.split('\n');
    ctx.font = `${$('txtTucne').checked ? 'bold ' : ''}${vel}px ${$('txtPismo').value}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.lineJoin = 'round';
    const lh = vel * 1.15, celkem = radky.length * lh, okraj = Math.round(vel * 0.3) + obrys;
    const pol = $('txtPoloha').value;
    let x = S.sirka / 2, y;
    if (pol === 'nahore') y = okraj;
    else if (pol === 'stred') y = (S.vyska - celkem) / 2;
    else if (pol === 'vlastni') { x = TX.x * S.sirka; y = TX.y * S.vyska - celkem / 2; }
    else y = S.vyska - okraj - celkem;
    radky.forEach((r, i) => {
      if (obrys) { ctx.strokeStyle = $('txtObrysB').value; ctx.lineWidth = obrys * 2; ctx.strokeText(r, x, y + i * lh); }
      ctx.fillStyle = $('txtBarva').value; ctx.fillText(r, x, y + i * lh);
    });
    if ($('txtOstre').checked) {
      // bez vyhlazení: alfa jen 0 nebo 255
      const d = ctx.getImageData(0, 0, c.width, c.height);
      for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] >= 128 ? 255 : 0;
      ctx.putImageData(d, 0, 0);
    }
    return c;
  }
  function textKresli() {
    const c = $('textNahled'), sirkaObl = Math.max(200, c.parentElement.clientWidth - 20);
    const k = Math.min(8, sirkaObl / S.sirka, 700 / S.vyska);
    c.width = Math.round(S.sirka * k); c.height = Math.round(S.vyska * k);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = !V.pixel;
    ctx.drawImage(platnoObr(S.snimky[S.akt].obr), 0, 0, c.width, c.height);
    ctx.drawImage(textVrstva(), 0, 0, c.width, c.height);
  }
  $('mText').addEventListener('input', e => { if (e.target.id === 'txtVel') $('txtVel').dataset.upraveno = 1; textKresli(); });
  $('textNahled').addEventListener('pointerdown', e => {
    const r = e.currentTarget.getBoundingClientRect();
    TX.x = (e.clientX - r.left) / r.width; TX.y = (e.clientY - r.top) / r.height;
    $('txtPoloha').value = 'vlastni';
    textKresli();
  });
  $('txtOk').onclick = () => {
    if (!$('txtText').value.trim()) return Dialog.chyba('Zadejte text.');
    const vrstva = textVrstva();
    const idx = new Set($('txtRozsah').value === 'vyber' ? vybrane() : S.snimky.map((_, i) => i));
    zavriModal($('mText'));
    zaznam();
    S.snimky = S.snimky.map((s, i) => {
      if (!idx.has(i)) return s;
      const c = document.createElement('canvas'); c.width = S.sirka; c.height = S.vyska;
      const ctx = c.getContext('2d');
      ctx.drawImage(platnoObr(s.obr), 0, 0); ctx.drawImage(vrstva, 0, 0);
      return Object.assign({}, s, { obr: obrZPlatna(c) });
    });
    hotovo();
  };

  // ---------- délka snímků ----------
  function otevriDelku() {
    if (!vyzadujSnimky()) return;
    const idx = vybrane();
    $('dlRozsah').value = idx.length > 1 ? 'vyber' : 'vse';
    $('dlMs').value = S.snimky[idx[0]].delka;
    dlFps();
    $('delkaInfo').textContent = `Vybráno ${idx.length} z ${S.snimky.length} snímků, celková délka ${(celkovaDelka() / 1000).toFixed(2).replace('.', ',')} s.`;
    otevriModal('mDelka');
  }
  function dlFps() { $('dlFps').textContent = (1000 / Math.max(10, +$('dlMs').value || 100)).toFixed(1).replace('.', ',').replace(',0', ''); }
  $('dlMs').addEventListener('input', () => { dlFps(); document.querySelector('input[name=dlMod][value=ms]').checked = true; });
  $('dlNasob').addEventListener('change', () => { document.querySelector('input[name=dlMod][value=nasob]').checked = true; });
  $('dlOk').onclick = () => {
    const mod = document.querySelector('input[name=dlMod]:checked').value;
    const idx = new Set($('dlRozsah').value === 'vyber' ? vybrane() : S.snimky.map((_, i) => i));
    zavriModal($('mDelka'));
    zaznam();
    S.snimky.forEach((s, i) => {
      if (!idx.has(i)) return;
      s.delka = mod === 'ms' ? Math.max(10, Math.min(65000, Math.round(+$('dlMs').value || 100))) : Math.max(10, Math.min(65000, Math.round(s.delka * +$('dlNasob').value)));
    });
    hotovo();
  };

  // ---------- výstup ----------
  const NAZVY_FORMATU = { gif: 'GIF', apng: 'APNG', webm: 'WebM', sprite: 'sprite sheet (ZIP)', zip: 'ZIP snímků' };
  function nastavFormat(f) {
    V.format = f;
    document.querySelectorAll('[data-format]').forEach(b => b.setAttribute('aria-pressed', b.dataset.format === f ? 'true' : 'false'));
    document.querySelectorAll('.vystup .formular[data-pro]').forEach(el => { el.hidden = !el.dataset.pro.split(' ').includes(f); });
    $('tlUlozit').textContent = '💾 Uložit ' + NAZVY_FORMATU[f];
    if (f === 'webm') zjistiWebm();
    ulozNast();
    planujOdhad();
  }
  document.querySelectorAll('[data-format]').forEach(b => b.addEventListener('click', () => nastavFormat(b.dataset.format)));
  function volbyGif() {
    return { barev: +$('gifBarev').value, paleta: $('gifPaleta').value, metoda: $('gifMetoda').value, dither: $('gifDither').checked,
      optimalizace: $('gifOpt').checked, prah: +$('gifPrah').value, prehrani: +$('prehrani').value };
  }
  const volbyApng = () => ({ optimalizace: $('apngOpt').checked, prehrani: +$('prehrani').value });
  const proWorker = sn => sn.map(s => ({ obr: s.obr, delka: s.delka }));

  // worker: jeden na export, druhý na odhad
  function vytvorWorker() {
    try { return new Worker('animace_gif/worker.js'); } catch { return null; }
  }
  let wOdhad = null, idUlohy = 1;
  function uloha(worker, typ, snimky, volby, priPrubehu) {
    if (!worker) {
      // bez workeru (např. file://) přímo v hlavním vlákně
      if (typ === 'gif') return Promise.resolve(A.kodujGif(snimky, Object.assign({}, volby, { priPrubehu })));
      if (typ === 'apng') return A.zapisApng(snimky, Object.assign({}, volby, { priPrubehu }));
      return A.odhadVelikosti(snimky, volby.format, volby, 6, volby.celkem);
    }
    return new Promise((res, rej) => {
      const id = idUlohy++;
      const h = e => {
        if (e.data.id !== id) return;
        if (e.data.prubeh !== undefined) { priPrubehu && priPrubehu(e.data.prubeh); return; }
        worker.removeEventListener('message', h);
        if (e.data.chyba) rej(new Error(e.data.chyba)); else res(e.data.hotovo);
      };
      worker.addEventListener('message', h);
      worker.postMessage({ id, typ, snimky, volby });
    });
  }

  let casOdhadu = null, genOdhadu = 0;
  function planujOdhad() { clearTimeout(casOdhadu); casOdhadu = setTimeout(spoctiOdhad, 500); }
  async function spoctiOdhad() {
    const el = $('odhad');
    const n = S.snimky.length;
    if (!n) { el.textContent = '–'; return; }
    const gen = ++genOdhadu;
    const f = V.format;
    if (f === 'webm') {
      const bpp = { LOW: 0.03, MEDIUM: 0.06, HIGH: 0.1, VERY_HIGH: 0.16 }[$('webmKvalita').value];
      const s = celkovaDelka() / 1000, fps = n / Math.max(0.01, s);
      el.textContent = '≈ ' + velikostTxt(Math.round(S.sirka * S.vyska * Math.min(fps, 60) * bpp * s / 8 + 2000)) + ' (hrubě)';
      return;
    }
    el.textContent = 'počítám…';
    const k = Math.min(n, 6), od = Math.max(0, Math.floor((n - k) / 2));
    const vzorek = proWorker(S.snimky.slice(od, od + k));
    const volby = f === 'gif' ? volbyGif() : f === 'apng' ? volbyApng() : { optimalizace: false };
    volby.format = f === 'gif' ? 'gif' : 'apng';
    volby.celkem = n;
    if (!wOdhad) wOdhad = vytvorWorker();
    try {
      let b = await uloha(wOdhad, 'odhad', vzorek, volby);
      if (gen !== genOdhadu) return;
      if (f === 'zip') b += n * 100 + 22;
      if (f === 'sprite') b = Math.round(b * 0.95) + n * 180;
      el.textContent = '≈ ' + velikostTxt(b);
    } catch (e) { if (gen === genOdhadu) el.textContent = '?'; }
  }

  let webmKodek;
  async function zjistiWebm() {
    if (webmKodek !== undefined) return;
    const MB = window.Mediabunny;
    try {
      webmKodek = MB ? await MB.getFirstEncodableVideoCodec(['vp9', 'vp8', 'av1'], { width: 320, height: 240 }) : null;
    } catch { webmKodek = null; }
    $('webmStav').textContent = webmKodek ? `Prohlížeč umí kódovat WebM (${webmKodek.toUpperCase()}). Průhlednost se nahradí barvou pozadí.` : 'Tento prohlížeč neumí video kódovat (chybí WebCodecs). Použijte GIF nebo APNG.';
  }

  let exportBezi = false;
  async function ulozit() {
    if (!vyzadujSnimky() || exportBezi) return;
    zavriNabidky();
    prehrat(false);
    exportBezi = true;
    $('tlUlozit').disabled = true;
    const pr = $('prubeh'); pr.hidden = false;
    const ukaz = p => { pr.firstElementChild.style.width = Math.round(p * 100) + '%'; };
    ukaz(0);
    const nazev = ($('nazevSouboru').value.trim() || 'animace').replace(/[\\/:*?"<>|]+/g, '_');
    const t0 = performance.now();
    try {
      const f = V.format;
      let data, soubor, typ;
      if (f === 'gif' || f === 'apng') {
        const w = vytvorWorker();
        try { data = await uloha(w, f, proWorker(S.snimky), f === 'gif' ? volbyGif() : volbyApng(), ukaz); }
        finally { w && w.terminate(); }
        soubor = nazev + (f === 'gif' ? '.gif' : '.png'); typ = f === 'gif' ? 'image/gif' : 'image/png';
      } else if (f === 'webm') {
        data = await kodujWebm(ukaz); soubor = nazev + '.webm'; typ = 'video/webm';
      } else if (f === 'sprite') {
        const r = A.spriteSheet(S.snimky, {
          rezim: $('spRezim').value, sloupcu: +$('spSloupcu').value || 0, mezera: +$('spMezera').value || 0, okraj: +$('spOkraj').value || 0,
          orez: $('spOrez').checked, mocninaDvou: $('spMocnina').checked, format: $('spFormat').value,
          predpona: $('spPredpona').value, obrazek: nazev + '.png',
        });
        if (r.obr.sirka > 16384 || r.obr.vyska > 16384) throw new Error(`List by měl ${r.obr.sirka}×${r.obr.vyska} px – víc, než prohlížeč zvládne (16384). Zmenšete snímky nebo nastavte počet sloupců.`);
        ukaz(0.5);
        const png = new Uint8Array(await (await pngBlob(platnoObr(r.obr))).arrayBuffer());
        data = A.zip([{ name: nazev + '.png', data: png }, { name: nazev + '.json', data: JSON.stringify(r.json, null, 2) }]);
        soubor = nazev + '_sprite.zip'; typ = 'application/zip';
        Dialog.info(`List ${r.obr.sirka}×${r.obr.vyska} px, ${S.snimky.length} snímků.`);
      } else {
        const pred = $('zipPredpona').value || 'snimek_', cislic = String(S.snimky.length).length;
        const polozky = [], meta = [];
        for (let i = 0; i < S.snimky.length; i++) {
          const jm = pred + String(i + 1).padStart(Math.max(3, cislic), '0') + '.png';
          polozky.push({ name: jm, data: new Uint8Array(await (await pngObr(S.snimky[i].obr)).arrayBuffer()) });
          meta.push({ soubor: jm, delka_ms: S.snimky[i].delka });
          ukaz((i + 1) / S.snimky.length);
        }
        polozky.push({ name: 'snimky.json', data: JSON.stringify({ sirka: S.sirka, vyska: S.vyska, snimky: meta }, null, 2) });
        data = A.zip(polozky); soubor = nazev + '_snimky.zip'; typ = 'application/zip';
      }
      ukaz(1);
      stahni(data, soubor, typ);
      $('odhad').textContent = velikostTxt(data.length || data.size);
      Dialog.info(`Uloženo ${soubor} – ${velikostTxt(data.length || data.size)} za ${((performance.now() - t0) / 1000).toFixed(1).replace('.', ',')} s.`);
    } catch (e) {
      Dialog.chyba('Uložení selhalo: ' + (e.message || e));
    } finally {
      exportBezi = false; $('tlUlozit').disabled = !S.snimky.length;
      setTimeout(() => { pr.hidden = true; }, 600);
    }
  }
  async function kodujWebm(ukaz) {
    const MB = window.Mediabunny;
    if (!MB) throw new Error('Knihovna Mediabunny se nenačetla.');
    const W = S.sirka + (S.sirka % 2), H = S.vyska + (S.vyska % 2);   // kodéry chtějí sudé rozměry
    const kodek = await MB.getFirstEncodableVideoCodec(['vp9', 'vp8', 'av1'], { width: W, height: H });
    if (!kodek) throw new Error('Prohlížeč neumí kódovat video WebM. Použijte GIF nebo APNG.');
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const output = new MB.Output({ format: new MB.WebMOutputFormat(), target: new MB.BufferTarget() });
    const zdroj = new MB.CanvasSource(c, { codec: kodek, bitrate: MB['QUALITY_' + $('webmKvalita').value] });
    output.addVideoTrack(zdroj);
    await output.start();
    let t = 0;
    for (let i = 0; i < S.snimky.length; i++) {
      const s = S.snimky[i];
      ctx.fillStyle = $('webmPozadi').value; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(platnoObr(s.obr), 0, 0);
      await zdroj.add(t / 1000, s.delka / 1000);
      t += s.delka;
      ukaz((i + 1) / S.snimky.length * 0.95);
    }
    zdroj.close();
    await output.finalize();
    return new Uint8Array(output.target.buffer);
  }

  // ---------- automatické ukládání (IndexedDB) ----------
  const DB_JMENO = 'webapp_animace_gif', DB_STORE = 'projekt';
  let db = null;
  function otevriDB() {
    if (db) return Promise.resolve(db);
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB_JMENO, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(DB_STORE);
      r.onsuccess = () => { db = r.result; res(db); };
      r.onerror = () => rej(r.error);
    });
  }
  function dbOperace(fn) {
    return otevriDB().then(d => new Promise((res, rej) => {
      const tx = d.transaction(DB_STORE, 'readwrite'), st = tx.objectStore(DB_STORE);
      const r = fn(st);
      tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error);
    }));
  }
  let casUlozeni = null, ukladam = false, znovuUlozit = false;
  function planujUlozeni() { clearTimeout(casUlozeni); casUlozeni = setTimeout(ulozProjekt, 1500); }
  async function ulozProjekt() {
    if (ukladam) { znovuUlozit = true; return; }
    ukladam = true;
    try {
      if (!S.snimky.length) await dbOperace(st => st.delete('posledni'));
      else {
        const snimky = [];
        for (const s of S.snimky) snimky.push({ png: await pngObr(s.obr), delka: s.delka });
        await dbOperace(st => st.put({ sirka: S.sirka, vyska: S.vyska, snimky, cas: Date.now() }, 'posledni'));
      }
    } catch (e) { console.warn('Uložení rozpracované animace selhalo:', e); }
    ukladam = false;
    if (znovuUlozit) { znovuUlozit = false; planujUlozeni(); }
  }
  async function obnovProjekt() {
    try {
      const p = await dbOperace(st => st.get('posledni'));
      if (!p || !p.snimky || !p.snimky.length || S.snimky.length) return;
      const seznam = [];
      for (const s of p.snimky) {
        const bmp = await createImageBitmap(s.png);
        const obr = obrZPlatna(bmp, bmp.width, bmp.height);
        pngCache.set(obr, s.png);
        seznam.push(novySnimek(obr, s.delka));
      }
      if (S.snimky.length) return;   // mezitím uživatel něco otevřel
      S.sirka = p.sirka; S.vyska = p.vyska; S.snimky = seznam; S.akt = 0;
      hotovo();
      Dialog.info(`Obnovena rozpracovaná animace (${seznam.length} snímků).`);
    } catch (e) { console.warn('Obnovení animace selhalo:', e); }
  }

  // ---------- nabídky a příkazy ----------
  const souborVstup = (id, fn) => { const el = $(id); el.onchange = () => { if (el.files.length) fn(el.files); el.value = ''; }; return () => el.click(); };
  const otevritSoubory = souborVstup('souborOtevrit', f => nactiSoubory(f, 'nahradit'));
  const pridatSoubory = souborVstup('souborPridat', f => nactiSoubory(f, 'pridat'));
  const vybratVideo = souborVstup('souborVideo', f => otevriVideo(f[0]));
  const vybratSprite = souborVstup('souborSprite', f => otevriSprite(f[0]));
  function nastavZoom(z) { V.zoom = z; ulozNast(); oznacZobrazit(); vykresliNahled(); }
  function oznacZobrazit() {
    document.querySelectorAll('[data-zoom]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.zoom === V.zoom ? 'true' : 'false'));
    $('tlPixel').setAttribute('aria-pressed', V.pixel ? 'true' : 'false');
    $('tlSach').setAttribute('aria-pressed', V.sach ? 'true' : 'false');
    $('tlCibuleDalsi').setAttribute('aria-pressed', V.cibuleDalsi ? 'true' : 'false');
    document.querySelector('[data-prikaz="cibule"]').setAttribute('aria-pressed', V.cibule ? 'true' : 'false');
  }
  const prepni = klic => () => { V[klic] = !V[klic]; ulozNast(); oznacZobrazit(); vykresliVse(); };

  const PRIKAZY = {
    otevrit: otevritSoubory, pridat: pridatSoubory, video: vybratVideo, sprite: vybratSprite,
    ukazka, ulozit,
    novy: async () => { if (!S.snimky.length || await Dialog.potvrd('Vyprázdnit animaci? (Lze vrátit přes Zpět.)', { ok: 'Vyprázdnit' })) { zaznam(); prehrat(false); S.snimky = []; S.vyber = new Set(); hotovo(); } },
    zpet: vratit, znovu,
    vybratVse: () => { S.vyber = new Set(S.snimky.map(s => s.id)); oznacVyber(); },
    duplikovat, smazat, prazdny,
    vlevo: () => posun(-1), vpravo: () => posun(1),
    obratit: () => vyzadujSnimky() && nahradUseky(A.obrat),
    pingpong: () => vyzadujSnimky() && nahradUseky(A.pingPong),
    delka: otevriDelku,
    orez: otevriOrez, orezPruhl: orezPruhledne, velikost: otevriVelikost, text: otevriText,
    otocVpravo: () => upravVse(o => A.otoc90(o, true)), otocVlevo: () => upravVse(o => A.otoc90(o, false)),
    zrcadliH: () => upravVse(o => A.zrcadli(o, false)), zrcadliV: () => upravVse(o => A.zrcadli(o, true)),
    'zoom-0': () => nastavZoom(0), 'zoom-1': () => nastavZoom(1), 'zoom-2': () => nastavZoom(2), 'zoom-4': () => nastavZoom(4),
    pixel: prepni('pixel'), sachovnice: prepni('sach'), cibule: prepni('cibule'), cibuleDalsi: prepni('cibuleDalsi'),
    napoveda: () => otevriModal('mNapoveda'),
    prehrat: () => prehrat(), prvni: () => { prehrat(false); nastavAkt(0); }, posledni: () => { prehrat(false); nastavAkt(S.snimky.length - 1); },
    predchozi: () => { prehrat(false); nastavAkt(S.akt - 1); }, dalsi: () => { prehrat(false); nastavAkt(S.akt + 1); },
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
  addEventListener('resize', () => { zavriNabidky(); vykresliNahled(); });

  // ---------- časová osa: výběr a tažení ----------
  const osa = $('osa');
  osa.addEventListener('click', e => {
    const el = e.target.closest('.snimek');
    if (!el || e.target.tagName === 'INPUT') return;
    prehrat(false);
    nastavAkt(+el.dataset.i, e.shiftKey ? 'rozsir' : (e.ctrlKey || e.metaKey) ? 'prepni' : null);
  });
  let tazene = null;
  osa.addEventListener('dragstart', e => {
    const el = e.target.closest('.snimek');
    if (!el) return;
    const i = +el.dataset.i;
    if (!S.vyber.has(S.snimky[i].id)) { S.vyber = new Set([S.snimky[i].id]); S.akt = i; oznacVyber(); }
    tazene = vybrane();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'snimky');
  });
  const cilTazeni = e => {
    const el = e.target.closest('.snimek');
    if (!el) return null;
    const r = el.getBoundingClientRect(), za = e.clientX > r.left + r.width / 2;
    return { el, cil: +el.dataset.i + (za ? 1 : 0), za };
  };
  const zrusZnacky = () => osa.querySelectorAll('.cil-pred,.cil-za').forEach(x => x.classList.remove('cil-pred', 'cil-za'));
  osa.addEventListener('dragover', e => {
    if (!tazene) return;
    e.preventDefault();
    const c = cilTazeni(e);
    zrusZnacky();
    if (c) c.el.classList.add(c.za ? 'cil-za' : 'cil-pred');
  });
  osa.addEventListener('dragleave', e => { if (!osa.contains(e.relatedTarget)) zrusZnacky(); });
  osa.addEventListener('drop', e => {
    if (!tazene) return;
    e.preventDefault(); e.stopPropagation();
    const c = cilTazeni(e);
    zrusZnacky();
    const idx = tazene; tazene = null;
    if (c) presunNa(idx, c.cil);
  });
  osa.addEventListener('dragend', () => { tazene = null; zrusZnacky(); });

  // ---------- přetažení souborů na stránku ----------
  let hloubka = 0;
  addEventListener('dragenter', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { hloubka++; document.body.classList.add('pretahuji'); } });
  addEventListener('dragleave', () => { if (--hloubka <= 0) { hloubka = 0; document.body.classList.remove('pretahuji'); } });
  addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  addEventListener('drop', e => {
    hloubka = 0; document.body.classList.remove('pretahuji');
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault();
    nactiSoubory(e.dataTransfer.files, S.snimky.length ? 'pridat' : 'nahradit');
  });

  // ---------- klávesnice ----------
  addEventListener('keydown', e => {
    if (otevrenyModal()) { if (e.key === 'Escape') zavriModal(); return; }
    if (e.key === 'Escape') return zavriNabidky();
    const t = e.target;
    if (t.closest && t.closest('input,textarea,select,[contenteditable]')) return;
    const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    let p = null;
    if (ctrl && k === 'z' && !e.shiftKey) p = 'zpet';
    else if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) p = 'znovu';
    else if (ctrl && k === 'a') p = 'vybratVse';
    else if (ctrl && k === 'd') p = 'duplikovat';
    else if (ctrl && k === 'o') p = 'otevrit';
    else if (ctrl && k === 's') p = 'ulozit';
    else if (ctrl) return;
    else if (e.key === ' ') p = 'prehrat';
    else if (e.key === 'Delete' || e.key === 'Backspace') p = 'smazat';
    else if (e.key === 'F1') p = 'napoveda';
    else if (e.key === 'Home') p = 'prvni';
    else if (e.key === 'End') p = 'posledni';
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const d = e.key === 'ArrowLeft' ? -1 : 1;
      e.preventDefault();
      if (e.altKey) return posun(d);
      prehrat(false);
      return nastavAkt(S.akt + d, e.shiftKey ? 'rozsir' : null);
    }
    else if (k === 'o') p = 'cibule';
    else if (k === 't') p = 'delka';
    else if (k === 'c') p = 'orez';
    else if (k === 'r') p = 'velikost';
    else if (['0', '1', '2', '4'].includes(e.key)) p = 'zoom-' + e.key;
    if (!p) return;
    e.preventDefault();
    prikaz(p);
  });

  // ---------- nastavení výstupu ----------
  $('panelVystup').addEventListener('input', e => {
    if (e.target.id === 'gifBarev') $('barevHodn').textContent = e.target.value;
    if (e.target.id === 'gifPrah') $('prahHodn').textContent = e.target.value;
    ulozNast(); planujOdhad();
  });
  $('panelVystup').addEventListener('change', () => { ulozNast(); planujOdhad(); });

  // ---------- start ----------
  nactiNast();
  $('barevHodn').textContent = $('gifBarev').value;
  $('prahHodn').textContent = $('gifPrah').value;
  oznacZobrazit();
  nastavFormat(V.format);
  vykresliVse();
  obnovProjekt();

  // pro testy
  window.ANIMACE_GIF_UI = { S, vlozSnimky, ukazka, ulozit, nastavFormat, prikaz, obrZPlatna, spoctiOdhad, otevriSprite, nactiSoubory, kodujWebm, otevriModal };
})();
