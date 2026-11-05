/* Fotokniha – editor (UI nad FOTOKNIHA a FK_ULOZ).
   Plocha = dvoustrana (di číslo) nebo obálka (di 'obalka'). */
(function () {
  'use strict';
  const F = window.FOTOKNIHA, U = window.FK_ULOZ;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KLIC_POSLEDNI = 'webapp_fotokniha_posledni', KLIC_NAST = 'webapp_fotokniha_nast';
  const NAHLED_PX = 1600, ZOOMY = [0.5, 0.75, 1, 1.5, 2, 3, 4, 6];

  const nast = Object.assign({ voditka: true, spad: true, prichyt: true, dpi: true, znacky: false, razeni: 'import' },
    (() => { try { return JSON.parse(localStorage.getItem(KLIC_NAST)) || {}; } catch (e) { return {}; } })());
  const ulozNast = () => localStorage.setItem(KLIC_NAST, JSON.stringify(nast));

  let K = null;                 // otevřená kniha
  let di = 0;                   // aktuální plocha: index dvoustrany nebo 'obalka'
  let vyb = null;               // id vybraného prvku
  let rezimVyrez = false;       // tažení posouvá fotku v rámečku
  let prohazovani = null;       // id rámečku, jehož fotka se prohodí s dalším klepnutým
  let vybFoto = null;           // vybraná fotka v šuplíku (klepnutím pak do rámečku)
  let schranka = null;          // kopírovaný prvek (JSON)
  let zoom = 1;                 // přiblížení plochy (1 = celá plocha)
  const zaznamy = new Map();    // id fotky → záznam z IndexedDB (bloby)
  const url = new Map();        // id fotky → objectURL náhledu
  let zpet = [], znovu = [];
  let pxMm = 1;                 // měřítko plochy

  /* ---------- pomocné ---------- */
  const fotoInfo = id => K.fotky.find(f => f.id === id);
  const dv = () => F.plocha(K, di);
  const G = () => F.geom(K, di);
  const prvek = id => dv().prvky.find(p => p.id === id);
  const jeObalka = () => di === 'obalka';
  const urlFoto = id => {
    if (!url.has(id) && zaznamy.get(id)) url.set(id, URL.createObjectURL(zaznamy.get(id).nahled));
    return url.get(id) || '';
  };
  const vsechnyPlochy = () => [...K.dvoustrany, K.obalka];
  function pouziti() {
    const m = new Map();
    for (const d of vsechnyPlochy()) for (const p of d.prvky) if (p.foto) m.set(p.foto, (m.get(p.foto) || 0) + 1);
    return m;
  }
  const stavDpi = r => r < F.DPI_CHYBA ? 'chyba' : r < F.DPI_VAROVANI ? 'varovani' : 'ok';
  const popisPlochy = (d = di) => d === 'obalka' ? 'Obálka' : 'Strany ' + F.popisDvoustrany(K, d);
  // výchozí strana pro nový prvek
  const vychoziStrana = () => jeObalka() ? 'P' : di === 0 ? 'P' : 'L';

  /* ---------- písma ---------- */
  const pismaP = new Map();
  function nactiPismo(id) {
    if (!pismaP.has(id)) pismaP.set(id, (async () => {
      const def = F.PISMA.find(p => p.id === id) || F.PISMA[0];
      const bytes = new Uint8Array(await (await fetch(def.soubor)).arrayBuffer());
      F.registrujPismo(def.id, window.fontkit.create(bytes));
      const ff = new FontFace(F.rodinaPisma(def.id), bytes);
      await ff.load(); document.fonts.add(ff);
      return bytes;
    })().catch(e => { pismaP.delete(id); throw e; }));
    return pismaP.get(id);
  }
  function pismaKnihy() {
    const ids = new Set();
    for (const d of vsechnyPlochy()) for (const p of d.prvky) if (p.typ === 'text') ids.add(p.pismo);
    if (K.cisla.zap) ids.add(K.cisla.pismo);
    return [...ids];
  }
  // načte chybějící písma a pak překreslí (rozložení textu závisí na metrikách)
  async function zajistiPisma(ids = pismaKnihy()) {
    const chybi = ids.filter(id => !F.nactenaPisma.has(id));
    if (!chybi.length) return;
    try { await Promise.all(chybi.map(nactiPismo)); } catch (e) { Dialog.chyba('Písmo se nenačetlo: ' + e.message); }
    if (K) vykresli(true);
  }

  /* ---------- zpět / uložení ---------- */
  const snimek = () => JSON.stringify({ nazev: K.nazev, format: K.format, vazba: K.vazba, dvoustrany: K.dvoustrany, obalka: K.obalka, cisla: K.cisla });
  function zaznam() { zpet.push(snimek()); if (zpet.length > 80) zpet.shift(); znovu = []; }
  function obnov(s) {
    Object.assign(K, JSON.parse(s));
    if (!jeObalka()) di = Math.min(di, K.dvoustrany.length - 1);
    if (vyb && !prvek(vyb)) vyb = null;
    zmeneno(true);
  }
  let casUlozeni = 0;
  function zmeneno(vse) {
    K.upraveno = Date.now();
    clearTimeout(casUlozeni);
    casUlozeni = setTimeout(() => U.ulozKnihu(K).catch(e => Dialog.chyba('Uložení selhalo: ' + e.message)), 350);
    vykresli(vse);
  }
  // obal pro změny: snímek pro zpět → změna → překreslení
  function zmena(fn, vse = false) { zaznam(); fn(); zmeneno(vse); }

  /* ---------- vykreslení plochy ---------- */
  function svgTextu(p, k) {
    const r = F.rozlozText(p);
    const tr = p.otoceni === 90 ? `translate(${p.w} 0) rotate(90)` : p.otoceni === 270 ? `translate(0 ${p.h}) rotate(-90)` : '';
    const radky = r.radky.map(l => `<text x="${l.u}" y="${l.v}">${esc(l.t)}</text>`).join('');
    return { pretece: r.pretece, html: `<svg width="${p.w * k}" height="${p.h * k}" viewBox="0 0 ${p.w} ${p.h}" aria-hidden="true"><g transform="${tr}" fill="${esc(p.barva || '#000')}" font-family="${F.rodinaPisma(p.pismo)}" font-size="${r.em}" xml:space="preserve">${radky}</g></svg>` };
  }
  function vykresliDv(idx, k, edit) {
    const g = F.geom(K, idx), d = F.plocha(K, idx), b = g.b, n = K.dvoustrany.length;
    const el = document.createElement('div');
    el.className = 'dv';
    el.style.cssText = `width:${(g.w + 2 * b) * k}px;height:${(g.v + 2 * b) * k}px;background:${d.pozadi || '#fff'}`;
    const X = x => (x + b) * k;
    const foto = new Map(K.fotky.map(f => [f.id, f]));
    let html = '';
    const prvky = [...d.prvky, ...F.prvkyCisel(K, idx).map(p => ({ ...p, cislo: true }))];
    for (const p of prvky) {
      const vybrany = edit && p.id === vyb;
      const styl = `left:${X(p.x)}px;top:${X(p.y)}px;width:${p.w * k}px;height:${p.h * k}px`;
      const uchyty = vybrany && !rezimVyrez ? ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(u => `<span class="uchop" data-u="${u}"></span>`).join('') : '';
      if (p.typ === 'text') {
        const t = svgTextu(p, k);
        const tridy = ['txt', p.cislo ? 'cislo-str' : 'ram'];
        if (vybrany) tridy.push('vybrany');
        if (edit && t.pretece && !p.cislo) tridy.push('pretece');
        html += `<div class="${tridy.join(' ')}"${p.cislo ? '' : ` data-id="${p.id}"`} style="${styl}"${t.pretece && edit ? ' title="Text se nevejde do pole"' : ''}>${t.html}${uchyty}</div>`;
        continue;
      }
      if (p.typ !== 'foto') continue;
      const f = p.foto && foto.get(p.foto);
      const tridy = ['ram'];
      if (!f) tridy.push('prazdny');
      if (vybrany) { tridy.push('vybrany'); if (rezimVyrez && f) tridy.push('vyrez'); }
      if (edit && prohazovani === p.id) tridy.push('zdroj-prohozeni');
      let vnitrek = '';
      if (f) {
        const vy = F.vyrez(p, f.w, f.h);
        const obr = `<img src="${urlFoto(p.foto)}" alt="" style="left:${-vy.sx * vy.s * k}px;top:${-vy.sy * vy.s * k}px;width:${f.w * vy.s * k}px;height:${f.h * vy.s * k}px">`;
        if (vybrany && rezimVyrez)
          html += `<img class="duch" src="${urlFoto(p.foto)}" alt="" style="left:${X(p.x - vy.sx * vy.s)}px;top:${X(p.y - vy.sy * vy.s)}px;width:${f.w * vy.s * k}px;height:${f.h * vy.s * k}px">`;
        vnitrek = vybrany ? `<div class="orezka">${obr}</div>` : obr;
        if (edit && nast.dpi) {
          const r = Math.round(F.dpi(p, f.w, f.h)), st = stavDpi(r);
          if (st !== 'ok') vnitrek += `<span class="dpi ${st}" title="Účinné rozlišení ${r} DPI">${r} DPI</span>`;
        }
      } else if (edit) vnitrek = p.w * k > 70 ? '<span>Přetáhněte sem fotku</span>' : '';
      if (p.okraj?.sirka > 0 && f) vnitrek += `<span class="lem" style="box-shadow:inset 0 0 0 ${p.okraj.sirka * k}px ${esc(p.okraj.barva || '#fff')}"></span>`;
      html += `<div class="${tridy.join(' ')}" data-id="${p.id}" style="${styl}">${vnitrek}${uchyty}</div>`;
    }
    if (nast.spad || !edit) {
      const W = (g.w + 2 * b) * k, H = (g.v + 2 * b) * k, B = b * k;
      html += `<div class="spad" style="left:0;top:0;width:${W}px;height:${B}px"></div><div class="spad" style="left:0;top:${H - B}px;width:${W}px;height:${B}px"></div>` +
        `<div class="spad" style="left:0;top:${B}px;width:${B}px;height:${H - 2 * B}px"></div><div class="spad" style="left:${W - B}px;top:${B}px;width:${B}px;height:${H - 2 * B}px"></div>`;
    }
    if (edit && nast.voditka) {
      const bz = g.bezpecna;
      html += `<div class="vod orez" style="left:${X(0)}px;top:${X(0)}px;width:${g.w * k}px;height:${g.v * k}px"></div>`;
      for (const u of g.strany) if (u.id !== 'H' && u.w > 2 * bz)
        html += `<div class="vod bezp" style="left:${X(u.x + bz)}px;top:${X(bz)}px;width:${(u.w - 2 * bz) * k}px;height:${(g.v - 2 * bz) * k}px"></div>`;
      if (g.hrbet) {
        html += `<div class="vod hrbet-zona" style="left:${X(g.hrbet[0])}px;top:${X(0)}px;width:${(g.hrbet[1] - g.hrbet[0]) * k}px;height:${g.v * k}px"></div>`;
        for (const x of g.hrbet) html += `<div class="vod ohyb" style="left:${X(x)}px;top:0;height:${(g.v + 2 * b) * k}px"></div>`;
      } else {
        if (K.vazba !== 'layflat') html += `<div class="vod hrbet-pas" style="left:${X(g.stred - 8)}px;top:${X(0)}px;width:${16 * k}px;height:${g.v * k}px"></div>`;
        html += `<div class="vod hrbet" style="left:${X(g.stred)}px;top:0;height:${(g.v + 2 * b) * k}px"></div>`;
      }
    }
    if (idx !== 'obalka') {
      const s = g.stred;
      if (idx === 0) html += `<div class="deska" style="left:0;width:${(s + b) * k}px">${edit ? 'vnitřek přední desky<br>(netiskne se)' : ''}</div>`;
      if (idx === n - 1) html += `<div class="deska" style="left:${X(s)}px;width:${(s + b) * k}px">${edit ? 'vnitřek zadní desky<br>(netiskne se)' : ''}</div>`;
    }
    if (edit) {
      if (idx === 'obalka') {
        html += `<span class="stitek" style="left:${X(4)}px">zadní deska</span><span class="stitek" style="right:${(b + 4) * k}px">přední deska</span>`;
      } else {
        const L = g.strany[0].cislo, P = g.strany[1].cislo;
        if (L) html += `<span class="stitek" style="left:${X(4)}px">strana ${L}</span>`;
        if (P) html += `<span class="stitek" style="right:${(b + 4) * k}px">strana ${P}</span>`;
      }
    }
    el.innerHTML = html;
    return el;
  }

  function spocitejMeritko() {
    const pl = $('plocha'), g = G();
    const W = pl.clientWidth - 40, H = pl.clientHeight - 40;
    pxMm = Math.max(0.2, Math.min(W / (g.w + 2 * g.b), H / (g.v + 2 * g.b))) * zoom;
  }
  function vykresliPlochu() {
    spocitejMeritko();
    const pl = $('platno');
    pl.classList.toggle('prohazovani', !!prohazovani);
    pl.replaceChildren(vykresliDv(di, pxMm, true));
  }
  const vyskaMini = 54;
  function miniatura(i) {
    const g = F.geom(K, i), t = document.createElement('button');
    t.className = 'mini' + (i === di ? ' aktivni' : '') + (i === 'obalka' ? ' ob' : '');
    t.dataset.di = i;
    t.title = popisPlochy(i);
    t.append(vykresliDv(i, vyskaMini / (g.v + 2 * g.b), false));
    t.insertAdjacentHTML('beforeend', `<span>${i === 'obalka' ? 'obálka' : F.popisDvoustrany(K, i)}</span>`);
    return t;
  }
  function vykresliPas() {
    const pas = $('pas'), sep = document.createElement('span');
    sep.className = 'mini-sep';
    pas.replaceChildren(miniatura('obalka'), sep, ...K.dvoustrany.map((d, i) => miniatura(i)));
    pas.querySelector('.aktivni')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function aktualizujMini() {
    const t = $('pas').querySelector(`[data-di="${di}"]`);
    if (!t) return vykresliPas();
    t.replaceWith(miniatura(di));
  }
  function vykresli(vse) {
    $('nazevKnihy').textContent = `${K.nazev} · ${F.pocetStran(K)} stran`;
    $('stranaInfo').textContent = jeObalka() ? 'obálka' : `${di + 1} / ${K.dvoustrany.length}`;
    $('btnZpet').disabled = !zpet.length; $('btnZnovu').disabled = !znovu.length;
    $('btnZoom').textContent = Math.round(zoom * 100) + ' %';
    vykresliPlochu();
    if (vse) { vykresliPas(); vykresliSuplik(); } else aktualizujMini();
    vykresliPanel();
  }

  /* ---------- šuplík ---------- */
  function serazene() {
    const sez = [...K.fotky];
    if (nast.razeni === 'datum') sez.sort((a, b) => (a.datum || 0) - (b.datum || 0));
    else if (nast.razeni === 'nazev') sez.sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs', { numeric: true }));
    return sez;
  }
  function vykresliSuplik() {
    const pou = pouziti(), jen = $('jenNepouzite').checked;
    $('pocetFotek').textContent = `${K.fotky.length} fotek · ${[...pou.keys()].length} použito`;
    $('razeni').value = nast.razeni;
    const box = $('fotky');
    if (!K.fotky.length) {
      box.innerHTML = '<div class="prazdny-suplik">📷 Klepněte na <b>Přidat fotky</b><br>nebo sem fotky přetáhněte.</div>';
      return;
    }
    const sez = serazene().filter(f => !jen || !pou.has(f.id));
    box.innerHTML = sez.map(f => `<div class="fot${f.id === vybFoto ? ' vybrana' : ''}" draggable="true" data-foto="${f.id}" title="${esc(f.nazev)} – ${f.w} × ${f.h} px${f.datum ? ' · ' + new Date(f.datum).toLocaleString('cs') : ''}. Přetáhněte do rámečku, dvojklik = vložit na stranu.">` +
      `<img src="${urlFoto(f.id)}" alt="" loading="lazy">${pou.has(f.id) ? `<span class="pouzito">${pou.get(f.id)}×</span>` : ''}` +
      `<button class="smaz" data-smaz="${f.id}" title="Odebrat fotku z knihy" aria-label="Odebrat fotku">✕</button></div>`).join('');
  }

  async function pridejFotky(soubory) {
    soubory = [...soubory].filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(f.name));
    if (!soubory.length) return;
    const chyby = [], bylo = new Set(K.fotky.map(f => f.nazev + '|' + (zaznamy.get(f.id)?.velikost)));
    let pridano = 0;
    const pr = prubeh('Načítám fotky…');
    try {
      for (let i = 0; i < soubory.length; i++) {
        const soubor = soubory[i];
        pr(`Načítám fotky… ${i + 1} / ${soubory.length}`);
        if (bylo.has(soubor.name + '|' + soubor.size)) continue;
        let bmp;
        try { bmp = await createImageBitmap(soubor); } catch (e) { chyby.push(soubor.name); continue; }
        const W = bmp.width, H = bmp.height;
        const q = Math.min(1, NAHLED_PX / Math.max(W, H));
        const nahled = await naJpeg(bmp, Math.round(W * q), Math.round(H * q), 0.85);
        let original = soubor, typ = 'jpg', orient = 1, datum = null;
        if (/jpe?g$/i.test(soubor.type) || /\.jpe?g$/i.test(soubor.name)) {
          const hlava = new Uint8Array(await soubor.slice(0, 256 * 1024).arrayBuffer());
          orient = PDFDILNA.exifOrientace(hlava);
          datum = F.exifDatum(hlava);
        } else if (soubor.type === 'image/png') typ = 'png';
        else original = await naJpeg(bmp, W, H, 0.95);   // webp, gif… → JPEG 95 %
        bmp.close();
        const zaz = { id: F.nid(), kniha: K.id, nazev: soubor.name, typ, velikost: soubor.size, w: W, h: H, orient,
          datum: datum || soubor.lastModified || Date.now(), original, nahled };
        await U.ulozFotku(zaz);
        zaznamy.set(zaz.id, zaz);
        K.fotky.push({ id: zaz.id, nazev: zaz.nazev, w: W, h: H, datum: zaz.datum });
        pridano++;
      }
    } finally { pr(null); }
    await U.ulozKnihu(K);
    vykresliSuplik();
    if (chyby.length) Dialog.chyba(`Nepodařilo se načíst: ${chyby.join(', ')}. Formát HEIC převeďte na JPEG.`);
    else if (pridano) Dialog.info(`Přidáno fotek: ${pridano}`);
  }
  function naJpeg(zdroj, w, h, kvalita) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(zdroj, 0, 0, w, h);
    return new Promise(ok => c.toBlob(ok, 'image/jpeg', kvalita));
  }
  async function odeberFotku(id) {
    const n = pouziti().get(id) || 0;
    if (n && !await Dialog.potvrd(`Fotka je v knize použitá ${n}×. Odebrat ji i z rámečků?`)) return;
    K.fotky = K.fotky.filter(f => f.id !== id);
    for (const d of vsechnyPlochy()) for (const p of d.prvky) if (p.foto === id) p.foto = null;
    zpet = []; znovu = [];          // fotka se maže z úložiště – zpět by odkazovalo do prázdna
    await U.smazFotku(id);
    zaznamy.delete(id);
    if (url.has(id)) { URL.revokeObjectURL(url.get(id)); url.delete(id); }
    zmeneno(true);
  }

  // vloží fotku: do rámečku kam, jinak do prvního prázdného, jinak nový rámeček
  function vlozFotku(idFoto, kam) {
    const f = fotoInfo(idFoto);
    zmena(() => {
      const cil = kam ? prvek(kam) : dv().prvky.find(p => p.typ === 'foto' && !p.foto);
      if (cil && cil.typ === 'foto') { Object.assign(cil, { foto: idFoto, zoom: 1, cx: 0.5, cy: 0.5 }); vyb = cil.id; return; }
      const o = F.oblast(K, vychoziStrana(), di), { okraj } = K.format;
      const h = Math.min(o.h - 2 * okraj, (o.w - 2 * okraj) * f.h / f.w), w = h * f.w / f.h;
      const p = F.novyRamecek({ x: o.x + (o.w - w) / 2, y: (o.h - h) / 2, w, h }, idFoto);
      dv().prvky.push(p); vyb = p.id;
    }, true);
  }
  function prohodFotky(a, b) {
    const kl = ['foto', 'zoom', 'cx', 'cy'];
    zmena(() => {
      const t = kl.map(x => a[x]);
      kl.forEach(x => { a[x] = b[x]; });
      kl.forEach((x, i) => { b[x] = t[i]; });
      vyb = b.id;
    }, true);
  }

  /* ---------- panel ---------- */
  function svgPredlohy(pr, strana) {
    const r = F.ramyPredlohy(K, strana, pr, di), o = F.oblast(K, strana, di), b = G().b;
    const vb = `${o.x - b} ${-b} ${o.w + 2 * b} ${o.h + 2 * b}`;
    return `<svg viewBox="${vb}" aria-hidden="true"><rect class="pl" x="${o.x}" y="0" width="${o.w}" height="${o.h}" stroke-width="${o.w / 60}"/>` +
      r.map(q => q.typ === 'text' ? `<rect class="r" x="${q.x + q.w * 0.2}" y="${q.y + q.h * 0.35}" width="${q.w * 0.6}" height="${q.h * 0.3}" opacity=".45"/>` : `<rect class="r" x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}"/>`).join('') + '</svg>';
  }
  function vykresliPanel() {
    const p = vyb && prvek(vyb), box = $('panel');
    if (p?.typ === 'text') return panelTextu(p, box);
    if (p) return panelRamecku(p, box);
    const tl = (pr, strana, zak) => `<button data-predloha="${pr.id}" data-strana="${strana}" title="${esc(pr.nazev)}" aria-label="${esc(pr.nazev)}"${zak ? ' disabled' : ''}>${svgPredlohy(pr, strana)}</button>`;
    const pozadi = `<div class="pole"><label for="pozadi">Pozadí</label><input type="color" id="pozadi" class="vstup" value="${dv().pozadi || '#ffffff'}"></div>`;
    const pridat = `<div class="tlacitka"><button class="tl" data-akce="pridejRamecek">▭ Rámeček</button><button class="tl" data-akce="pridejText">𝐓 Text</button>${jeObalka() ? '<button class="tl" data-akce="textHrbet" title="Svislý text na střed hřbetu">⫼ Text na hřbet</button>' : ''}</div>`;
    if (jeObalka()) {
      const h = F.hrbetMm(K), pred = F.PREDLOHY;
      box.innerHTML = `<h3>Obálka</h3>
        <p class="pozn">${K.obalka.typ === 'tvrda' ? 'Tvrdé desky' : 'Měkká brožura'} · deska ${K.obalka.s} × ${K.obalka.v} mm · hřbet <b>${h} mm</b> · přesah ${K.obalka.presah} mm</p>
        <div class="tlacitka"><button class="tl" data-akce="nastaveniObalky">⚙ Nastavení obálky…</button></div>
        ${pozadi}${pridat}
        <h3>Přední deska (vpravo)</h3><div class="predlohy">${pred.map(pr => tl(pr, 'P')).join('')}</div>
        <h3>Zadní deska (vlevo)</h3><div class="predlohy">${pred.map(pr => tl(pr, 'L')).join('')}</div>
        <h3>Přes celou obálku</h3><div class="predlohy dvou">${F.PREDLOHY_DVOUSTRANY.map(pr => tl(pr, 'D')).join('')}</div>
        <p class="pozn" style="margin-top:10px">Obálka se kreslí zvenku: vlevo zadní deska, uprostřed hřbet, vpravo přední deska. Šířku hřbetu a přesah ověřte u tiskárny.</p>`;
      return;
    }
    const n = K.dvoustrany.length, Ldeska = di === 0, Pdeska = di === n - 1;
    box.innerHTML = `<h3>${popisPlochy()}</h3>
      ${pozadi}
      ${K.cisla.zap ? `<label class="pozn" style="display:flex;gap:6px;margin-top:6px"><input type="checkbox" id="bezCisel"${dv().bezCisel ? ' checked' : ''}> bez čísel stran na této dvoustraně</label>` : ''}
      ${pridat}
      <h3>Rozvržení levé strany</h3><div class="predlohy">${F.PREDLOHY.map(pr => tl(pr, 'L', Ldeska)).join('')}</div>
      <h3>Rozvržení pravé strany</h3><div class="predlohy">${F.PREDLOHY.map(pr => tl(pr, 'P', Pdeska)).join('')}</div>
      <h3>Přes celou dvoustranu</h3><div class="predlohy dvou">${F.PREDLOHY_DVOUSTRANY.map(pr => tl(pr, 'D', Ldeska || Pdeska)).join('')}</div>
      <p class="pozn" style="margin-top:10px">Předloha nahradí rámečky na straně, fotky a texty se přenesou v pořadí čtení. Fotky přetáhněte ze šuplíku do rámečků; prázdná plocha = nový rámeček.</p>`;
  }
  const c1 = x => Math.round(x * 10) / 10;
  const panelPolohy = p => `<h3>Poloha a velikost (mm)</h3>
      <div class="mm4">
        <label>X <input class="vstup" type="number" step="0.5" data-mm="x" value="${c1(p.x)}"></label>
        <label>Y <input class="vstup" type="number" step="0.5" data-mm="y" value="${c1(p.y)}"></label>
        <label>Šířka <input class="vstup" type="number" step="0.5" min="2" data-mm="w" value="${c1(p.w)}"></label>
        <label>Výška <input class="vstup" type="number" step="0.5" min="2" data-mm="h" value="${c1(p.h)}"></label>
      </div>`;
  const panelAkci = `<div class="tlacitka">
        <button class="tl" data-akce="dopredu" title="Přenést do popředí">⬆ Dopředu</button>
        <button class="tl" data-akce="dozadu" title="Přenést do pozadí">⬇ Dozadu</button>
        <button class="tl" data-akce="vystredit" title="Vystředit na straně vodorovně">↔ Na střed</button>
        <button class="tl" data-akce="duplikat" title="Zkopírovat prvek">⎘ Kopie</button>
        <button class="tl" data-akce="smazat" title="Smazat prvek (Delete)">🗑 Smazat</button>
      </div>`;
  function panelRamecku(p, box) {
    const f = p.foto && fotoInfo(p.foto);
    let dpiHtml = '';
    if (f) {
      const r = Math.round(F.dpi(p, f.w, f.h)), st = stavDpi(r);
      const rada = st === 'ok' ? 'Na tisk v pořádku.' : st === 'varovani' ? 'Hraniční – zmenšete rámeček nebo oddalte.' : 'Málo – fotka bude rozmazaná. Zmenšete rámeček.';
      dpiHtml = `<div class="dpi-info ${st}"><b>${r} DPI</b> – ${rada}</div>`;
    }
    const ok = p.okraj || { sirka: 0, barva: '#ffffff' };
    box.innerHTML = `<h3>Rámeček s fotkou</h3>
      ${f ? `<div class="pozn" data-i18n="ne">${esc(f.nazev)} · ${f.w} × ${f.h} px</div>${dpiHtml}
        <div class="pole"><label for="zoom">Přiblížení</label><input type="range" id="zoom" min="1" max="5" step="0.01" value="${p.zoom || 1}"></div>
        <div class="tlacitka">
          <button class="tl" data-akce="vyrez" aria-pressed="${rezimVyrez}" title="Tažením posouvat fotku v rámečku (dvojklik na rámeček)">✋ Posunout fotku</button>
          <button class="tl" data-akce="stred" title="Fotku vycentrovat a vyplnit rámeček">⊙ Vycentrovat</button>
          <button class="tl" data-akce="pomer" title="Rámeček přizpůsobit poměru stran fotky">⧉ Podle fotky</button>
          <button class="tl" data-akce="prohodit" aria-pressed="${prohazovani === p.id}" title="Pak klepněte na jiný rámeček – fotky se prohodí (nebo Shift + tažení)">⇄ Prohodit</button>
          <button class="tl" data-akce="vyjmout" title="Fotku z rámečku vyjmout">⏏ Vyjmout</button>
        </div>` : '<p class="pozn">Prázdný rámeček – přetáhněte do něj fotku ze šuplíku, nebo ji v šuplíku vyberte a klepněte sem.</p>'}
      <h3>Lem kolem fotky</h3>
      <div class="pole"><label for="lemSirka">Šířka (mm)</label><input type="number" id="lemSirka" class="vstup" min="0" max="30" step="0.5" value="${ok.sirka || 0}">
        <label for="lemBarva">Barva</label><input type="color" id="lemBarva" class="vstup" value="${ok.barva || '#ffffff'}"></div>
      ${panelPolohy(p)}
      <div class="tlacitka"><button class="tl" data-akce="strana" title="Roztáhnout přes celou stranu až do spadávky">⛶ Na celou stranu</button></div>
      ${panelAkci}
      <p class="pozn" style="margin-top:10px">Tažení = přesun, úchyty = velikost, kolečko = přiblížení fotky, dvojklik = posun fotky v rámečku, Shift + tažení na jiný rámeček = prohození fotek. Šipky posunou o 1 mm (Shift 10 mm).</p>`;
  }
  function panelTextu(p, box) {
    const r = F.rozlozText(p);
    const seg = (pole, hodnoty) => `<div class="seg" role="group">${hodnoty.map(([v, z, t]) => `<button class="tl" data-nastav="${pole}" data-hodnota="${v}" aria-pressed="${String(p[pole]) === String(v)}" title="${t}">${z}</button>`).join('')}</div>`;
    box.innerHTML = `<h3>Textové pole</h3>
      <textarea id="txtText" class="vstup" rows="4" data-i18n="ne">${esc(p.text)}</textarea>
      ${r.pretece ? '<div class="varovani-txt">⚠ Text se nevejde – zvětšete pole nebo zmenšete písmo.</div>' : ''}
      <div class="pole" style="margin-top:6px">
        <label for="txtPismo">Písmo</label><select id="txtPismo" class="vstup">${F.PISMA.map(x => `<option value="${x.id}"${x.id === p.pismo ? ' selected' : ''}>${esc(x.nazev)}</option>`).join('')}</select>
        <label for="txtVel">Velikost (pt)</label><input id="txtVel" class="vstup" type="number" min="4" max="300" step="0.5" value="${p.velikost}">
        <label for="txtBarva">Barva</label><input id="txtBarva" class="vstup" type="color" value="${p.barva || '#000000'}">
        <label for="txtRadk">Řádkování</label><input id="txtRadk" class="vstup" type="number" min="0.8" max="3" step="0.05" value="${p.radkovani || 1.25}">
        <label>Zarovnání</label>${seg('zarovnani', [['vlevo', '⟸', 'Vlevo'], ['stred', '≡', 'Na střed'], ['vpravo', '⟹', 'Vpravo']])}
        <label>Svisle</label>${seg('svisle', [['nahoru', '⤒', 'Nahoru'], ['stred', '↕', 'Na střed'], ['dolu', '⤓', 'Dolů']])}
        <label>Otočení</label>${seg('otoceni', [[0, '0°', 'Vodorovně'], [270, '⤴ 90°', 'Zdola nahoru (hřbet v Evropě)'], [90, '⤵ 90°', 'Shora dolů (hřbet v USA/UK)']])}
      </div>
      ${panelPolohy(p)}
      ${panelAkci}
      <p class="pozn" style="margin-top:10px">Písmo se do PDF vloží celé jako vektor. Důležitý text držte uvnitř modré bezpečné zóny.</p>`;
  }
  function akcePrvku(akce, p) {
    const f = p.foto && fotoInfo(p.foto);
    if (akce === 'vyrez') { rezimVyrez = !rezimVyrez; return vykresli(); }
    if (akce === 'prohodit') { prohazovani = prohazovani === p.id ? null : p.id; if (prohazovani) Dialog.info('Klepněte na rámeček, se kterým se má fotka prohodit (Esc = zrušit)'); return vykresli(); }
    zmena(() => {
      const d = dv(), i = d.prvky.indexOf(p);
      if (akce === 'stred') Object.assign(p, { zoom: 1, cx: 0.5, cy: 0.5 });
      else if (akce === 'pomer' && f) { const h = p.w * f.h / f.w; p.y += (p.h - h) / 2; p.h = h; p.zoom = 1; }
      else if (akce === 'vyjmout') p.foto = null;
      else if (akce === 'strana') {
        const u = G().strany.find(u => p.x + p.w / 2 >= u.x && p.x + p.w / 2 < u.x + u.w) || G().strany[0];
        const r = F.ramyPredlohy(K, u.id, F.predloha('1b'), di)[0];
        Object.assign(p, { x: r.x, y: r.y, w: r.w, h: r.h });
      } else if (akce === 'vystredit') {
        const u = G().strany.find(u => p.x + p.w / 2 >= u.x && p.x + p.w / 2 < u.x + u.w) || G().strany[0];
        p.x = u.x + (u.w - p.w) / 2;
      } else if (akce === 'dopredu') { d.prvky.splice(i, 1); d.prvky.push(p); }
      else if (akce === 'dozadu') { d.prvky.splice(i, 1); d.prvky.unshift(p); }
      else if (akce === 'duplikat') { const q = { ...JSON.parse(JSON.stringify(p)), id: F.nid(), x: p.x + 5, y: p.y + 5 }; d.prvky.push(q); vyb = q.id; }
      else if (akce === 'smazat') { d.prvky.splice(i, 1); vyb = null; }
    }, ['smazat', 'duplikat', 'strana'].includes(akce));
  }
  function pridejText(textHrbet) {
    const g = G();
    let p;
    if (textHrbet) {
      const [a, b] = g.hrbet, w = b - a;
      p = { ...F.novyText({ x: a + w * 0.1, y: 15, w: w * 0.8, h: g.v - 30 }, K.nazev), otoceni: 270, velikost: Math.max(5, Math.min(14, w * 0.6 * 72 / 25.4)), pismo: 'sans-b' };
    } else {
      const o = F.oblast(K, vychoziStrana(), di), w = o.w * 0.7, h = 22;
      p = F.novyText({ x: o.x + (o.w - w) / 2, y: (o.h - h) / 2, w, h }, 'Text');
    }
    zmena(() => { dv().prvky.push(p); vyb = p.id; }, true);
    zajistiPisma([p.pismo]);
    setTimeout(() => { const t = $('txtText'); if (t) { t.focus(); t.select(); } }, 0);
  }

  /* ---------- myš na ploše ---------- */
  let tah = null;
  function mmZUdalosti(e) {
    const r = $('platno').firstChild.getBoundingClientRect(), b = G().b;
    return { x: (e.clientX - r.left) / pxMm - b, y: (e.clientY - r.top) / pxMm - b };
  }
  const ramPodBodem = e => document.elementFromPoint(e.clientX, e.clientY)?.closest('.ram');
  function ukazVodicka(xs, ys) {
    $('platno').querySelectorAll('.vodicko').forEach(e => e.remove());
    const dvEl = $('platno').firstChild, b = G().b;
    for (const x of xs) dvEl.insertAdjacentHTML('beforeend', `<div class="vodicko" style="left:${(x + b) * pxMm}px;top:0;width:1px;height:100%"></div>`);
    for (const y of ys) dvEl.insertAdjacentHTML('beforeend', `<div class="vodicko" style="top:${(y + b) * pxMm}px;left:0;height:1px;width:100%"></div>`);
  }
  $('platno').addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    const ram = e.target.closest('.ram'), u = e.target.closest('.uchop');
    if (!ram) {
      if (vyb || prohazovani) { vyb = null; rezimVyrez = false; prohazovani = null; vykresli(); }
      return;
    }
    const p = prvek(ram.dataset.id);
    if (!p) return;
    if (prohazovani && p.typ === 'foto' && p.id !== prohazovani) {
      const a = prvek(prohazovani); prohazovani = null;
      return a ? prohodFotky(a, p) : vykresli();
    }
    if (vybFoto && !u && p.typ === 'foto') { const id = vybFoto; vybFoto = null; return vlozFotku(id, p.id); }
    if (vyb !== p.id) { vyb = p.id; rezimVyrez = false; vykresli(); }
    const m = mmZUdalosti(e);
    tah = { p, u: u?.dataset.u, start: m, puv: { ...p }, pred: snimek(), pohnuto: false,
      rezim: u ? 'velikost' : rezimVyrez && p.foto ? 'vyrez' : 'presun' };
    $('platno').setPointerCapture(e.pointerId);
  });
  $('platno').addEventListener('pointermove', e => {
    if (!tah) return;
    const m = mmZUdalosti(e), p = tah.p, o = tah.puv;
    let dx = m.x - tah.start.x, dy = m.y - tah.start.y;
    if (!tah.pohnuto && Math.hypot(dx, dy) * pxMm < 3) return;
    tah.pohnuto = true;
    const prah = 6 / pxMm, snap = nast.prichyt && !e.altKey, c = F.cary(K, di, p);
    const sx = [], sy = [];
    if (tah.rezim === 'vyrez') {
      const f = fotoInfo(p.foto);
      Object.assign(p, { cx: o.cx, cy: o.cy });
      F.posunVyrez(p, f.w, f.h, dx, dy);
    } else if (tah.rezim === 'presun') {
      if (snap) {
        const ddx = F.prichyt([o.x + dx, o.x + dx + o.w / 2, o.x + dx + o.w], c.xs, prah);
        const ddy = F.prichyt([o.y + dy, o.y + dy + o.h / 2, o.y + dy + o.h], c.ys, prah);
        dx += ddx; dy += ddy;
        if (ddx) sx.push(...[o.x + dx, o.x + dx + o.w / 2, o.x + dx + o.w].filter(x => c.xs.some(q => Math.abs(q - x) < 1e-6)));
        if (ddy) sy.push(...[o.y + dy, o.y + dy + o.h / 2, o.y + dy + o.h].filter(y => c.ys.some(q => Math.abs(q - y) < 1e-6)));
      }
      p.x = o.x + dx; p.y = o.y + dy;
    } else {
      let x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h;
      const hrana = (h, d, cary, pole) => { let v = h + d; if (snap) { const q = F.prichyt([v], cary, prah); if (q) { v += q; pole.push(v); } } return v; };
      // Shift u rohu = zachovat poměr stran
      const pomer = e.shiftKey && tah.u.length === 2 ? o.w / o.h : 0;
      if (tah.u.includes('w')) x1 = Math.min(hrana(x1, dx, c.xs, sx), x2 - 2);
      if (tah.u.includes('e')) x2 = Math.max(hrana(x2, dx, c.xs, sx), x1 + 2);
      if (tah.u.includes('n')) y1 = Math.min(hrana(y1, dy, c.ys, sy), y2 - 2);
      if (tah.u.includes('s')) y2 = Math.max(hrana(y2, dy, c.ys, sy), y1 + 2);
      if (pomer) { const h = (x2 - x1) / pomer; if (tah.u.includes('n')) y1 = y2 - h; else y2 = y1 + h; }
      Object.assign(p, { x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
    }
    vykresliPlochu();
    ukazVodicka(sx, sy);
  });
  function konecTahu(e) {
    if (!tah) return;
    const t = tah; tah = null;
    ukazVodicka([], []);
    if (!t.pohnuto) return;
    // Shift + tažení rámečku na jiný rámeček = prohození fotek, rámeček zůstane na místě
    if (e?.shiftKey && t.rezim === 'presun' && t.p.typ === 'foto') {
      Object.assign(t.p, { x: t.puv.x, y: t.puv.y });
      vykresliPlochu();
      const cil = ramPodBodem(e), q = cil && prvek(cil.dataset.id);
      if (q && q !== t.p && q.typ === 'foto') return prohodFotky(t.p, q);
      return vykresli();
    }
    zpet.push(t.pred); znovu = []; zmeneno(false);
  }
  $('platno').addEventListener('pointerup', konecTahu);
  $('platno').addEventListener('pointercancel', () => konecTahu(null));
  $('platno').addEventListener('dblclick', e => {
    // po setPointerCapture míří click/dblclick na #platno → rámeček podle polohy
    const ram = ramPodBodem(e), p = ram && prvek(ram.dataset.id);
    if (!p) return;
    if (p.typ === 'text') { vyb = p.id; vykresli(); const t = $('txtText'); t?.focus(); t?.select(); return; }
    if (!p.foto) return;
    vyb = p.id; rezimVyrez = !rezimVyrez; vykresli();
  });
  let casKolecka = 0;
  $('plocha').addEventListener('wheel', e => {
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); return priblizeni(e.deltaY < 0 ? 1 : -1, e); }
    const ram = e.target.closest('.ram'), p = ram && prvek(ram.dataset.id);
    if (!p?.foto) return;
    e.preventDefault();
    if (!casKolecka) zaznam();
    clearTimeout(casKolecka);
    casKolecka = setTimeout(() => { casKolecka = 0; }, 600);
    vyb = p.id;
    p.zoom = F.omez((p.zoom || 1) * Math.exp(-e.deltaY * 0.0015), 1, 5);
    zmeneno(false);
  }, { passive: false });
  // přiblížení plochy; bod pod kurzorem zůstane na místě
  function priblizeni(smer, e) {
    const pl = $('plocha'), i = ZOOMY.findIndex(z => z >= zoom - 1e-9);
    const novy = smer === 0 ? 1 : ZOOMY[F.omez((i < 0 ? 2 : i) + smer, 0, ZOOMY.length - 1)];
    if (novy === zoom) return;
    const r = pl.getBoundingClientRect(), mx = e ? e.clientX - r.left : r.width / 2, my = e ? e.clientY - r.top : r.height / 2;
    const fx = (pl.scrollLeft + mx) / pl.scrollWidth, fy = (pl.scrollTop + my) / pl.scrollHeight;
    zoom = novy;
    vykresli();
    pl.scrollLeft = fx * pl.scrollWidth - mx; pl.scrollTop = fy * pl.scrollHeight - my;
  }

  // tažení fotek ze šuplíku a souborů z disku
  $('fotky').addEventListener('dragstart', e => {
    const f = e.target.closest('[data-foto]');
    if (f) { e.dataTransfer.setData('text/x-fotka', f.dataset.foto); e.dataTransfer.effectAllowed = 'copy'; }
  });
  const plocha = $('plocha');
  plocha.addEventListener('dragover', e => {
    e.preventDefault();
    plocha.querySelectorAll('.cil').forEach(x => x.classList.remove('cil'));
    const r = e.target.closest?.('.ram');
    if (r && !r.classList.contains('txt')) r.classList.add('cil');
  });
  plocha.addEventListener('dragleave', e => { if (e.target === plocha) plocha.querySelectorAll('.cil').forEach(x => x.classList.remove('cil')); });
  plocha.addEventListener('drop', e => {
    e.preventDefault();
    plocha.querySelectorAll('.cil').forEach(x => x.classList.remove('cil'));
    if (e.dataTransfer.files.length) return pridejFotky(e.dataTransfer.files);
    const id = e.dataTransfer.getData('text/x-fotka');
    if (!id || !fotoInfo(id)) return;
    const ram = e.target.closest('.ram'), p = ram && prvek(ram.dataset.id);
    if (p?.typ === 'foto') return zmena(() => { Object.assign(p, { foto: id, zoom: 1, cx: 0.5, cy: 0.5 }); vyb = p.id; }, true);
    // na prázdné místo: nový rámeček v poměru fotky, střed pod kurzorem
    const f = fotoInfo(id), m = mmZUdalosti(e), g = G(), s = g.strany[0].w;
    const h = g.v * 0.45, w = Math.min(h * f.w / f.h, s * 0.9), hh = w * f.h / f.w;
    zmena(() => { const q = F.novyRamecek({ x: m.x - w / 2, y: m.y - hh / 2, w, h: hh }, id); dv().prvky.push(q); vyb = q.id; }, true);
  });
  const suplik = $('suplik');
  suplik.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); suplik.classList.add('suplik-drop'); } });
  suplik.addEventListener('dragleave', () => suplik.classList.remove('suplik-drop'));
  suplik.addEventListener('drop', e => { suplik.classList.remove('suplik-drop'); if (e.dataTransfer.files.length) { e.preventDefault(); pridejFotky(e.dataTransfer.files); } });
  $('fotky').addEventListener('click', e => {
    const sm = e.target.closest('[data-smaz]');
    if (sm) return odeberFotku(sm.dataset.smaz);
    const f = e.target.closest('[data-foto]');
    if (!f) return;
    // vybraný prázdný rámeček → rovnou do něj; jinak fotka čeká na klepnutí do rámečku
    const p = vyb && prvek(vyb);
    if (p && p.typ === 'foto' && !p.foto) return vlozFotku(f.dataset.foto, p.id);
    vybFoto = vybFoto === f.dataset.foto ? null : f.dataset.foto;
    vykresliSuplik();
  });
  $('fotky').addEventListener('dblclick', e => {
    const f = e.target.closest('[data-foto]');
    if (f) { vybFoto = null; vlozFotku(f.dataset.foto); }
  });
  $('jenNepouzite').addEventListener('change', vykresliSuplik);
  $('razeni').addEventListener('change', e => { nast.razeni = e.target.value; ulozNast(); vykresliSuplik(); });
  $('soubor').addEventListener('change', e => { pridejFotky(e.target.files); e.target.value = ''; });
  $('zalohaSoubor').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) obnovZeZalohy(f); });

  // panel
  $('panel').addEventListener('click', e => {
    const pr = e.target.closest('[data-predloha]');
    if (pr && !pr.disabled) {
      const strana = pr.dataset.strana;
      zmena(() => { F.pouzijPredlohu(K, di, strana, pr.dataset.predloha); vyb = null; }, true);
      return zajistiPisma();
    }
    const nas = e.target.closest('[data-nastav]'), p = vyb && prvek(vyb);
    if (nas && p) {
      const v = nas.dataset.nastav === 'otoceni' ? +nas.dataset.hodnota : nas.dataset.hodnota;
      return zmena(() => {
        // otočení o 90° prohodí rozměr pole, ať se text vejde stejně
        if (nas.dataset.nastav === 'otoceni' && ((v === 0) !== !(p.otoceni === 90 || p.otoceni === 270))) {
          const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
          [p.w, p.h] = [p.h, p.w]; p.x = cx - p.w / 2; p.y = cy - p.h / 2;
        }
        p[nas.dataset.nastav] = v;
      });
    }
    const a = e.target.closest('[data-akce]');
    if (a) {
      const ak = a.dataset.akce;
      if (ak === 'pridejRamecek') return prikaz('novyRamecek');
      if (ak === 'pridejText') return pridejText(false);
      if (ak === 'textHrbet') return pridejText(true);
      if (ak === 'nastaveniObalky') return oknoObalky();
      if (p) return akcePrvku(ak, p);
    }
    if (!a && vybFoto && p && p.typ === 'foto' && !p.foto) { const id = vybFoto; vybFoto = null; vlozFotku(id, p.id); }
  });
  let zivyZaznam = false;   // jeden krok zpět za celé tažení posuvníku / psaní
  const zive = fn => { if (!zivyZaznam) { zaznam(); zivyZaznam = true; } fn(); };
  $('panel').addEventListener('input', e => {
    const p = vyb && prvek(vyb), id = e.target.id;
    if (id === 'pozadi') { zive(() => { dv().pozadi = e.target.value; }); vykresliPlochu(); aktualizujMini(); return; }
    if (!p) return;
    if (id === 'zoom') { zive(() => { p.zoom = +e.target.value; }); return vykresliPlochu(); }
    if (id === 'txtText') { zive(() => { p.text = e.target.value; }); vykresliPlochu(); aktualizujMini(); return; }
    if (id === 'txtBarva') { zive(() => { p.barva = e.target.value; }); return vykresliPlochu(); }
    if (id === 'lemBarva') { zive(() => { p.okraj = { ...(p.okraj || { sirka: 2 }), barva: e.target.value }; }); return vykresliPlochu(); }
  });
  $('panel').addEventListener('change', async e => {
    const p = vyb && prvek(vyb), id = e.target.id;
    if (['zoom', 'pozadi', 'txtText', 'txtBarva', 'lemBarva'].includes(id)) { zivyZaznam = false; return zmeneno(false); }
    if (id === 'bezCisel') return zmena(() => { dv().bezCisel = e.target.checked; });
    if (!p) return;
    if (id === 'txtPismo') { await zajistiPisma([e.target.value]); return zmena(() => { p.pismo = e.target.value; }); }
    if (id === 'txtVel' && +e.target.value > 0) return zmena(() => { p.velikost = F.omez(+e.target.value, 4, 300); });
    if (id === 'txtRadk' && +e.target.value > 0) return zmena(() => { p.radkovani = F.omez(+e.target.value, 0.8, 3); });
    if (id === 'lemSirka') return zmena(() => { p.okraj = { barva: '#ffffff', ...(p.okraj || {}), sirka: F.omez(+e.target.value || 0, 0, 30) }; });
    const k = e.target.dataset.mm;
    if (k && isFinite(+e.target.value)) zmena(() => { p[k] = (k === 'w' || k === 'h') ? Math.max(2, +e.target.value) : +e.target.value; });
  });
  $('pas').addEventListener('click', e => {
    const t = e.target.closest('[data-di]');
    if (t) jdi(t.dataset.di === 'obalka' ? 'obalka' : +t.dataset.di);
  });
  function jdi(i) {
    if (i === 'obalka' || i < 0) di = 'obalka';
    else di = F.omez(i, 0, K.dvoustrany.length - 1);
    vyb = null; rezimVyrez = false; prohazovani = null;
    vykresliPas();
    vykresli();
  }
  const posun = smer => jdi(jeObalka() ? (smer > 0 ? 0 : 'obalka') : di + smer);

  /* ---------- klávesnice ---------- */
  document.addEventListener('keydown', e => {
    if (document.querySelector('.nahled-bg')) return;
    if (e.target.closest?.('input, textarea, select') || document.querySelector('.modal-bg')) {
      if (e.key === 'Escape') document.querySelector('.modal-bg')?.remove();
      return;
    }
    const ctrl = e.ctrlKey || e.metaKey, p = vyb && prvek(vyb), kl = e.key.toLowerCase();
    if (ctrl && kl === 'z' && !e.shiftKey) { e.preventDefault(); return prikaz('zpet'); }
    if (ctrl && (kl === 'y' || (kl === 'z' && e.shiftKey))) { e.preventDefault(); return prikaz('znovu'); }
    if (ctrl && kl === 'k') { e.preventDefault(); return prikaz('paleta'); }
    if (ctrl && kl === 'c') { if (p) { e.preventDefault(); prikaz('kopirovat'); } return; }
    if (ctrl && kl === 'v') { if (schranka) { e.preventDefault(); prikaz('vlozit'); } return; }
    if (ctrl && (e.key === '+' || e.key === '=')) { e.preventDefault(); return priblizeni(1); }
    if (ctrl && e.key === '-') { e.preventDefault(); return priblizeni(-1); }
    if (ctrl && e.key === '0') { e.preventDefault(); return priblizeni(0); }
    if (ctrl) return;
    if (e.key === 'F1') { e.preventDefault(); return prikaz('napoveda'); }
    if (e.key === 'PageDown') { e.preventDefault(); return posun(1); }
    if (e.key === 'PageUp') { e.preventDefault(); return posun(-1); }
    if (e.key === 'Escape') { vyb = null; rezimVyrez = false; vybFoto = null; prohazovani = null; vykresliSuplik(); return vykresli(); }
    if (!p) {
      if (e.key === 'ArrowRight') posun(1);
      if (e.key === 'ArrowLeft') posun(-1);
      if (kl === 't') { e.preventDefault(); prikaz('novyText'); }
      if (kl === 'r') prikaz('novyRamecek');
      if (kl === 'p') prikaz('nahled');
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); return akcePrvku('smazat', p); }
    const krok = e.shiftKey ? 10 : 1, sm = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (sm) { e.preventDefault(); zmena(() => { p.x += sm[0] * krok; p.y += sm[1] * krok; }); }
  });

  /* ---------- nabídky lišty (vzor prompty.html) ---------- */
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
    if (b && !b.disabled) { e.stopPropagation(); if (!b.classList.contains('prep')) zavriNabidky(); return prikaz(b.dataset.prikaz, b); }
    if (!e.target.closest('.nabidka')) zavriNabidky();
  });
  addEventListener('resize', () => { zavriNabidky(); if (K) vykresliPlochu(); });
  const prepinace = () => document.querySelectorAll('[data-nast]').forEach(b => b.setAttribute('aria-pressed', String(!!nast[b.dataset.nast])));

  // příkazy: název pro paletu (Ctrl+K), klávesa, akce
  const PRIKAZY = {
    pridatFotky: ['📷 Přidat fotky', '', () => $('soubor').click()],
    zpet: ['↶ Zpět', 'Ctrl+Z', () => { if (zpet.length) { znovu.push(snimek()); obnov(zpet.pop()); } }],
    znovu: ['↷ Znovu', 'Ctrl+Y', () => { if (znovu.length) { zpet.push(snimek()); obnov(znovu.pop()); } }],
    novyRamecek: ['▭ Nový rámeček na fotku', 'R', () => {
      const o = F.oblast(K, vychoziStrana(), di), w = o.w * 0.5, h = o.h * 0.4;
      zmena(() => { const p = F.novyRamecek({ x: o.x + (o.w - w) / 2, y: (o.h - h) / 2, w, h }); dv().prvky.push(p); vyb = p.id; }, true);
    }],
    novyText: ['𝐓 Nové textové pole', 'T', () => pridejText(false)],
    automatika: ['🪄 Rozvrhnout fotky automaticky…', '', () => oknoAutomatiky()],
    kopirovat: ['⎘ Kopírovat prvek', 'Ctrl+C', () => { const p = vyb && prvek(vyb); if (p) { schranka = JSON.stringify(p); Dialog.info('Zkopírováno'); } }],
    vlozit: ['📋 Vložit prvek', 'Ctrl+V', () => {
      if (!schranka) return Dialog.info('Schránka je prázdná – nejdřív zkopírujte prvek.');
      const q = { ...JSON.parse(schranka), id: F.nid() };
      if (dv().prvky.some(p => Math.abs(p.x - q.x) < 0.01 && Math.abs(p.y - q.y) < 0.01)) { q.x += 5; q.y += 5; }
      zmena(() => { dv().prvky.push(q); vyb = q.id; }, true);
    }],
    prohodit: ['⇄ Prohodit fotku s jiným rámečkem', '', () => { const p = vyb && prvek(vyb); if (p?.typ === 'foto') akcePrvku('prohodit', p); else Dialog.info('Nejdřív vyberte rámeček s fotkou.'); }],
    smazatPrvek: ['🗑 Smazat vybraný prvek', 'Delete', () => { const p = vyb && prvek(vyb); if (p) akcePrvku('smazat', p); }],
    predchozi: ['◀ Předchozí dvoustrana', 'PageUp', () => posun(-1)],
    dalsi: ['▶ Další dvoustrana', 'PageDown', () => posun(1)],
    obalkaJdi: ['📕 Upravit obálku', '', () => jdi('obalka')],
    vlozitDvoustranu: ['➕ Vložit prázdnou dvoustranu', '', () => {
      const za = jeObalka() ? 0 : Math.min(di, K.dvoustrany.length - 2);
      zmena(() => { K.dvoustrany.splice(za + 1, 0, F.novaDvoustrana()); di = za + 1; vyb = null; }, true);
    }],
    duplikovatDvoustranu: ['⎘ Duplikovat dvoustranu', '', () => {
      if (jeObalka() || di === 0 || di === K.dvoustrany.length - 1) return Dialog.info('Duplikovat jde vnitřní dvoustranu (ne u desek).');
      zmena(() => {
        const kopie = JSON.parse(JSON.stringify(dv()));
        kopie.id = F.nid(); kopie.prvky.forEach(p => { p.id = F.nid(); });
        K.dvoustrany.splice(di + 1, 0, kopie); di++; vyb = null;
      }, true);
    }],
    posunDriv: ['⇤ Posunout dvoustranu dříve', '', () => {
      if (jeObalka() || di <= 1 || di >= K.dvoustrany.length - 1) return Dialog.info('První a poslední dvoustrana (u desek) se nepřesouvá.');
      zmena(() => { const [d] = K.dvoustrany.splice(di, 1); K.dvoustrany.splice(di - 1, 0, d); di--; }, true);
    }],
    posunPozdeji: ['⇥ Posunout dvoustranu později', '', () => {
      if (jeObalka() || di === 0 || di >= K.dvoustrany.length - 2) return Dialog.info('První a poslední dvoustrana (u desek) se nepřesouvá.');
      zmena(() => { const [d] = K.dvoustrany.splice(di, 1); K.dvoustrany.splice(di + 1, 0, d); di++; }, true);
    }],
    vyprazdnit: ['⌫ Vyprázdnit plochu', '', () => zmena(() => { dv().prvky = []; vyb = null; }, true)],
    smazatDvoustranu: ['🗑 Smazat dvoustranu', '', async () => {
      if (jeObalka() || di === 0 || di === K.dvoustrany.length - 1) return Dialog.info('Dvoustrany u desek nejde smazat – ubírejte strany ve vlastnostech knihy.');
      if (K.dvoustrany.length <= 3) return Dialog.info('Kniha musí mít aspoň 4 strany.');
      if (dv().prvky.length && !await Dialog.potvrd(`Smazat strany ${F.popisDvoustrany(K, di)} i s obsahem?`)) return;
      zmena(() => { K.dvoustrany.splice(di, 1); di = Math.min(di, K.dvoustrany.length - 1); vyb = null; }, true);
    }],
    priblizit: ['➕ Přiblížit plochu', 'Ctrl++', () => priblizeni(1)],
    oddalit: ['➖ Oddálit plochu', 'Ctrl+−', () => priblizeni(-1)],
    cela: ['⛶ Celá plocha', 'Ctrl+0', () => priblizeni(0)],
    nahled: ['📖 Náhled knihy', 'P', () => oknoNahledu()],
    prep: [null, '', b => { nast[b.dataset.nast] = !nast[b.dataset.nast]; ulozNast(); prepinace(); vykresli(); }],
    kontrola: ['✔ Kontrola před tiskem', '', () => oknoKontroly()],
    pdfStrany: ['📄 Export PDF – každá strana zvlášť', '', () => exportPdf('strany')],
    pdfDvoustrany: ['📖 Export PDF – po dvoustranách', '', () => exportPdf('dvoustrany')],
    pdfObalka: ['📕 Export PDF – obálka', '', () => exportPdf('obalka')],
    jpegZip: ['🖼 Export JPEG 300 DPI (ZIP)', '', () => exportJpeg()],
    jakTisknout: ['❔ Jak knihu nechat vytisknout', '', () => oknoTisk()],
    novaKniha: ['✚ Nová kniha', '', () => oknoKnihy(null)],
    vlastnosti: ['⚙ Formát, počet stran, vazba', '', () => oknoKnihy(K)],
    obalka: ['📕 Obálka a hřbet', '', () => oknoObalky()],
    cislaStran: ['#️⃣ Čísla stran', '', () => oknoCisel()],
    mojeKnihy: ['📚 Moje knihy', '', () => oknoMojeKnihy()],
    zaloha: ['💾 Zálohovat projekt (ZIP)', '', () => zalohuj()],
    obnova: ['📂 Obnovit ze zálohy', '', () => $('zalohaSoubor').click()],
    prejmenovat: ['✎ Přejmenovat knihu', '', async () => {
      const n = await Dialog.zeptej('Název knihy', K.nazev);
      if (n && n.trim()) zmena(() => { K.nazev = n.trim(); });
    }],
    paleta: ['⌘ Paleta příkazů', 'Ctrl+K', () => oknoPalety()],
    napoveda: ['❓ Nápověda', 'F1', () => oknoNapovedy()],
  };
  function prikaz(id, b) { const p = PRIKAZY[id]; if (p) p[2](b); }

  /* ---------- modální okna ---------- */
  function okno(html, sirka, trida = '') {
    document.querySelector('.modal-bg')?.remove();
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal ${trida}" role="dialog" aria-modal="true"${sirka ? ` style="max-width:${sirka}px"` : ''}>${html}</div>`;
    bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-zavrit]')) bg.remove(); });
    document.body.append(bg);
    bg.querySelector('input, select, button')?.focus();
    return bg;
  }
  function prubeh(text) {
    const el = document.createElement('div');
    el.className = 'prubeh'; el.innerHTML = `<div role="status">${esc(text)}</div>`;
    document.body.append(el);
    return t => { if (t === null) el.remove(); else el.firstChild.textContent = t; };
  }

  function oknoPalety() {
    const sez = Object.entries(PRIKAZY).filter(([, p]) => p[0]);
    const bg = okno(`<input class="vstup" id="palHledat" placeholder="Napište příkaz…" aria-label="Hledat příkaz"><ul id="palSeznam"></ul>`, 560, 'paleta');
    let akt = 0, vys = sez;
    const kresli = () => {
      bg.querySelector('#palSeznam').innerHTML = vys.map(([id, p], i) => `<li data-id="${id}" class="${i === akt ? 'akt' : ''}">${esc(p[0])}${p[1] ? `<kbd>${esc(p[1])}</kbd>` : ''}</li>`).join('');
    };
    const hl = bg.querySelector('#palHledat');
    const bez = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    hl.oninput = () => { const q = bez(hl.value); vys = sez.filter(([, p]) => bez(p[0]).includes(q)); akt = 0; kresli(); };
    hl.onkeydown = e => {
      if (e.key === 'ArrowDown') { akt = Math.min(akt + 1, vys.length - 1); kresli(); e.preventDefault(); }
      if (e.key === 'ArrowUp') { akt = Math.max(akt - 1, 0); kresli(); e.preventDefault(); }
      if (e.key === 'Enter' && vys[akt]) { bg.remove(); prikaz(vys[akt][0]); }
    };
    bg.querySelector('#palSeznam').onclick = e => { const li = e.target.closest('[data-id]'); if (li) { bg.remove(); prikaz(li.dataset.id); } };
    kresli(); hl.focus();
  }

  function oknoKnihy(k) {
    const f = k ? k.format : { id: '20x20', s: 200, v: 200, spad: 3, bezpecna: 6, okraj: 12, mezera: 4 };
    const formaty = F.FORMATY.map(x => `<option value="${x.id}"${x.id === f.id ? ' selected' : ''}>${x.nazev}</option>`).join('') +
      `<option value="vlastni"${f.id === 'vlastni' ? ' selected' : ''}>Vlastní rozměr…</option>`;
    const bg = okno(`<h2>${k ? 'Vlastnosti knihy' : 'Nová fotokniha'}</h2>
      <div class="pole">
        <label for="kNazev">Název</label><input id="kNazev" class="vstup" value="${esc(k ? k.nazev : 'Moje fotokniha')}">
        <label for="kFormat">Formát</label><select id="kFormat" class="vstup">${formaty}</select>
        <label>Rozměr strany</label><span><input id="kS" class="vstup" type="number" min="50" max="600" value="${f.s}" style="width:80px"> × <input id="kV" class="vstup" type="number" min="50" max="600" value="${f.v}" style="width:80px"> mm (po ořezu)</span>
        <label for="kStran">Počet stran</label><input id="kStran" class="vstup" type="number" min="4" max="400" step="2" value="${k ? F.pocetStran(k) : 24}">
        <label for="kVazba">Vazba</label><select id="kVazba" class="vstup">${F.VAZBY.map(x => `<option value="${x.id}"${(k ? k.vazba : 'lepena') === x.id ? ' selected' : ''}>${x.nazev}</option>`).join('')}</select>
        <label for="kSpad">Spadávka</label><span><input id="kSpad" class="vstup" type="number" min="0" max="10" step="0.5" value="${f.spad}" style="width:80px"> mm</span>
        <label for="kBezp">Bezpečná zóna</label><span><input id="kBezp" class="vstup" type="number" min="0" max="30" step="0.5" value="${f.bezpecna}" style="width:80px"> mm od ořezu</span>
        <label for="kOkraj">Okraj předloh</label><span><input id="kOkraj" class="vstup" type="number" min="0" max="60" step="1" value="${f.okraj}" style="width:80px"> mm, mezera <input id="kMez" class="vstup" type="number" min="0" max="30" step="0.5" value="${f.mezera}" style="width:70px"> mm</span>
      </div>
      <p class="pozn">Rozměry, spadávku a počet stran zjistěte u tiskárny (často po 2 nebo 4 stranách, min. 20–24). ${k ? 'Změna rozměru přepočítá rámečky poměrně.' : ''}</p>
      <div class="dole"><button class="tl" data-zavrit>Zrušit</button><button class="tl hlavni-tl" id="kOk">${k ? 'Uložit' : 'Vytvořit'}</button></div>`);
    const sel = bg.querySelector('#kFormat');
    const synchronizuj = () => {
      const x = F.FORMATY.find(q => q.id === sel.value);
      bg.querySelector('#kS').disabled = bg.querySelector('#kV').disabled = !!x;
      if (x) { bg.querySelector('#kS').value = x.s; bg.querySelector('#kV').value = x.v; }
    };
    sel.onchange = synchronizuj; synchronizuj();
    bg.querySelector('#kOk').onclick = async () => {
      const g = id => +bg.querySelector(id).value;
      const s = F.omez(g('#kS') || 200, 50, 600), v = F.omez(g('#kV') || 200, 50, 600);
      const fm = { id: sel.value, s, v, spad: F.omez(g('#kSpad'), 0, 10), bezpecna: F.omez(g('#kBezp'), 0, 30), okraj: F.omez(g('#kOkraj'), 0, 60), mezera: F.omez(g('#kMez'), 0, 30) };
      const nazev = bg.querySelector('#kNazev').value.trim() || 'Fotokniha', stran = F.omez(g('#kStran') || 24, 4, 400), vazba = bg.querySelector('#kVazba').value;
      if (!k) {
        const nova = F.novaKniha({ nazev, stran, vazba, s, v });
        nova.format = fm;
        Object.assign(nova.obalka, { s, v });
        await U.ulozKnihu(nova);
        bg.remove();
        return otevri(nova.id);
      }
      const ubude = K.dvoustrany.length - F.dvoustranProStran(stran);
      if (ubude > 0 && K.dvoustrany.slice(K.dvoustrany.length - 1 - ubude, -1).some(d => d.prvky.length) &&
        !await Dialog.potvrd(`Ubráním ${2 * ubude} stran před koncem knihy i s jejich obsahem. Pokračovat?`)) return;
      zmena(() => {
        const qx = s / K.format.s, qy = v / K.format.v;
        if (qx !== 1 || qy !== 1) {
          for (const d of K.dvoustrany) for (const p of d.prvky) { p.x *= qx; p.w *= qx; p.y *= qy; p.h *= qy; }
          // obálka měkké vazby kopíruje rozměr strany
          if (K.obalka.typ === 'mekka') Object.assign(K.obalka, { s, v });
        }
        K.nazev = nazev; K.format = fm; K.vazba = vazba;
        F.nastavPocetStran(K, stran);
        if (!jeObalka()) di = Math.min(di, K.dvoustrany.length - 1);
      }, true);
      bg.remove();
    };
  }

  function oknoObalky() {
    const o = K.obalka, { s, v } = K.format;
    const bg = okno(`<h2>📕 Obálka a hřbet</h2>
      <div class="pole">
        <label for="oTyp">Typ</label><select id="oTyp" class="vstup">
          <option value="mekka"${o.typ === 'mekka' ? ' selected' : ''}>Měkká brožura (V2) – obálka = rozměr strany</option>
          <option value="tvrda"${o.typ === 'tvrda' ? ' selected' : ''}>Tvrdé desky (V8) – potah přes desky se záhybem</option></select>
        <label>Rozměr desky</label><span><input id="oS" class="vstup" type="number" min="50" max="650" step="0.5" value="${o.s}" style="width:80px"> × <input id="oV" class="vstup" type="number" min="50" max="650" step="0.5" value="${o.v}" style="width:80px"> mm</span>
        <label for="oPresah">Přesah</label><span><input id="oPresah" class="vstup" type="number" min="0" max="30" step="0.5" value="${o.presah}" style="width:80px"> mm (spadávka, u tvrdých desek záhyb)</span>
        <label for="oHrbetAuto">Hřbet</label><span><label><input type="checkbox" id="oHrbetAuto"${o.hrbet == null ? ' checked' : ''}> spočítat z počtu stran</label></span>
        <label for="oTl">Tloušťka listu</label><span><input id="oTl" class="vstup" type="number" min="0.03" max="1" step="0.01" value="${o.tloustka}" style="width:80px"> mm (papír 170 g ≈ 0,15 mm)</span>
        <label for="oDesky">Desky</label><span><input id="oDesky" class="vstup" type="number" min="0" max="5" step="0.5" value="${o.desky}" style="width:80px"> mm každá (měkká vazba 0)</span>
        <label for="oHrbet">Šířka hřbetu</label><span><input id="oHrbet" class="vstup" type="number" min="1" max="120" step="0.5" value="${F.hrbetMm(K)}" style="width:80px"> mm</span>
      </div>
      <p class="pozn">Přesnou šířku hřbetu a rozměr potahu dá tiskárna podle papíru a počtu stran (${F.pocetStran(K)} stran). U tvrdých desek bývá deska o 3–4 mm větší než strana a záhyb 15–20 mm.</p>
      <div class="dole"><button class="tl" data-zavrit>Zrušit</button><button class="tl hlavni-tl" id="oOk">Uložit</button></div>`);
    const q = id => bg.querySelector(id);
    const prepocet = () => {
      const auto = q('#oHrbetAuto').checked;
      q('#oHrbet').disabled = auto; q('#oTl').disabled = q('#oDesky').disabled = !auto;
      if (auto) q('#oHrbet').value = Math.max(2, Math.round((F.pocetStran(K) / 2 * +q('#oTl').value + 2 * +q('#oDesky').value) * 2) / 2);
    };
    q('#oTyp').onchange = () => {
      const tvrda = q('#oTyp').value === 'tvrda';
      q('#oS').value = tvrda ? s + 3 : s; q('#oV').value = tvrda ? v + 6 : v;
      q('#oPresah').value = tvrda ? 17 : K.format.spad; q('#oDesky').value = tvrda ? 2 : 0;
      prepocet();
    };
    ['#oHrbetAuto', '#oTl', '#oDesky'].forEach(id => q(id).addEventListener('input', prepocet));
    prepocet();
    q('#oOk').onclick = () => {
      zmena(() => Object.assign(K.obalka, {
        typ: q('#oTyp').value, s: F.omez(+q('#oS').value || s, 50, 650), v: F.omez(+q('#oV').value || v, 50, 650),
        presah: F.omez(+q('#oPresah').value || 0, 0, 30), tloustka: F.omez(+q('#oTl').value || 0.15, 0.03, 1),
        desky: F.omez(+q('#oDesky').value || 0, 0, 5), hrbet: q('#oHrbetAuto').checked ? null : F.omez(+q('#oHrbet').value || 5, 1, 120),
      }), true);
      bg.remove();
      if (!jeObalka()) jdi('obalka');
    };
  }

  function oknoCisel() {
    const c = K.cisla;
    const bg = okno(`<h2>#️⃣ Čísla stran</h2>
      <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="cZap"${c.zap ? ' checked' : ''}> Číslovat strany</label>
      <div class="pole">
        <label for="cPismo">Písmo</label><select id="cPismo" class="vstup">${F.PISMA.map(x => `<option value="${x.id}"${x.id === c.pismo ? ' selected' : ''}>${esc(x.nazev)}</option>`).join('')}</select>
        <label for="cVel">Velikost</label><span><input id="cVel" class="vstup" type="number" min="5" max="30" step="0.5" value="${c.velikost}" style="width:80px"> pt</span>
        <label for="cBarva">Barva</label><input id="cBarva" class="vstup" type="color" value="${c.barva}">
        <label for="cPoz">Poloha</label><select id="cPoz" class="vstup"><option value="stred"${c.pozice === 'stred' ? ' selected' : ''}>Dole uprostřed</option><option value="vnejsi"${c.pozice === 'vnejsi' ? ' selected' : ''}>Dole u vnějšího okraje</option></select>
        <label for="cOd">Od spodního ořezu</label><span><input id="cOd" class="vstup" type="number" min="3" max="40" step="0.5" value="${c.odspodu}" style="width:80px"> mm</span>
      </div>
      <p class="pozn">Na jednotlivých dvoustranách je jde vypnout v panelu vpravo (např. u fotek přes celou stranu).</p>
      <div class="dole"><button class="tl" data-zavrit>Zrušit</button><button class="tl hlavni-tl" id="cOk">Uložit</button></div>`);
    const q = id => bg.querySelector(id);
    q('#cOk').onclick = async () => {
      const nove = { zap: q('#cZap').checked, pismo: q('#cPismo').value, velikost: F.omez(+q('#cVel').value || 9, 5, 30), barva: q('#cBarva').value, pozice: q('#cPoz').value, odspodu: F.omez(+q('#cOd').value || 8, 3, 40) };
      bg.remove();
      await zajistiPisma([nove.pismo]);
      zmena(() => Object.assign(K.cisla, nove), true);
    };
  }

  function oknoAutomatiky() {
    const pou = pouziti(), nepouzite = K.fotky.filter(f => !pou.has(f.id)).length;
    if (!K.fotky.length) return Dialog.info('Nejdřív přidejte fotky.');
    const bg = okno(`<h2>🪄 Rozvrhnout fotky automaticky</h2>
      <div class="pole">
        <label for="aKter">Fotky</label><select id="aKter" class="vstup"><option value="nepouzite">Jen nepoužité (${nepouzite})</option><option value="vse">Všechny (${K.fotky.length})</option></select>
        <label for="aPoradi">Pořadí</label><select id="aPoradi" class="vstup"><option value="datum">Podle data pořízení</option><option value="nazev">Podle názvu souboru</option><option value="import">Jak byly přidány</option></select>
        <label for="aNa">Fotek na stranu</label><select id="aNa" class="vstup"><option value="mix">Střídavě 1–4 (živější)</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select>
        <label for="aOd">Začít od</label><select id="aOd" class="vstup"><option value="0">Začátku knihy</option>${jeObalka() ? '' : `<option value="${di}" selected>Této dvoustrany (${F.popisDvoustrany(K, di)})</option>`}</select>
      </div>
      <label class="pozn" style="display:flex;gap:6px"><input type="checkbox" id="aBez"> samotnou fotku dát přes celou stranu (do spadávky)</label>
      <p class="pozn">Plní jen prázdné strany, chybějící dvoustrany přidá. Rozvržení se volí podle orientace fotek. Celé jde vrátit přes Zpět.</p>
      <div class="dole"><button class="tl" data-zavrit>Zrušit</button><button class="tl hlavni-tl" id="aOk">Rozvrhnout</button></div>`);
    const q = id => bg.querySelector(id);
    q('#aOk').onclick = () => {
      const p = nast.razeni; nast.razeni = q('#aPoradi').value;
      const ids = serazene().filter(f => q('#aKter').value === 'vse' || !pou.has(f.id)).map(f => f.id);
      nast.razeni = p;
      if (!ids.length) return Dialog.info('Žádné nepoužité fotky.');
      let n = 0;
      zmena(() => { n = F.automatickeRozvrzeni(K, ids, { naStranu: q('#aNa').value, odDi: +q('#aOd').value, bezOkraje: q('#aBez').checked }); }, true);
      bg.remove();
      Dialog.info(`Rozvrženo ${ids.length} fotek na ${n} stran`);
    };
  }

  async function oknoMojeKnihy() {
    const knihy = (await U.seznamKnih()).sort((a, b) => b.upraveno - a.upraveno);
    const bg = okno(`<h2>📚 Moje knihy</h2><div class="knihy">${knihy.map(k => `<div class="kniha-r${k.id === K.id ? ' aktivni' : ''}">
        <div class="n"><b data-i18n="ne">${esc(k.nazev)}</b><small>${F.pocetStran(k)} stran · ${k.fotky.length} fotek · ${new Date(k.upraveno).toLocaleString('cs')}</small></div>
        <button class="tl" data-otevri="${k.id}">Otevřít</button><button class="tl" data-smazat="${k.id}" title="Smazat knihu i fotky" aria-label="Smazat knihu">🗑</button></div>`).join('')}</div>
      <p class="pozn">Knihy i fotky jsou jen v tomto prohlížeči (IndexedDB). Zálohu udělá Kniha ▾ → Zálohovat projekt.</p>
      <div class="dole"><button class="tl" data-zavrit>Zavřít</button><button class="tl hlavni-tl" id="mkNova">✚ Nová kniha</button></div>`);
    bg.querySelector('#mkNova').onclick = () => oknoKnihy(null);
    bg.addEventListener('click', async e => {
      const o = e.target.closest('[data-otevri]'), s = e.target.closest('[data-smazat]');
      if (o) { bg.remove(); otevri(o.dataset.otevri); }
      if (s) {
        const k = knihy.find(x => x.id === s.dataset.smazat);
        if (!await Dialog.potvrd(`Smazat knihu „${k.nazev}“ včetně ${k.fotky.length} fotek? Nejde vrátit.`)) return;
        await U.smazKnihu(k.id);
        bg.remove();
        if (k.id === K.id) { K = null; await start(); } else oknoMojeKnihy();
      }
    });
  }

  function oknoKontroly() {
    const vys = F.kontrola(K), ikona = { chyba: '⛔', varovani: '⚠️', info: 'ℹ️' };
    const ch = vys.filter(x => x.uroven === 'chyba').length, va = vys.filter(x => x.uroven === 'varovani').length;
    const bg = okno(`<h2>✔ Kontrola před tiskem</h2>
      <p>${F.pocetStran(K)} stran, ${K.format.s} × ${K.format.v} mm, spadávka ${K.format.spad} mm, hřbet ${F.hrbetMm(K)} mm. ${vys.length ? `Chyb: <b>${ch}</b>, varování: <b>${va}</b>. Klepnutím přejdete na místo.` : '✅ Nic k připomínkám.'}</p>
      ${vys.length ? `<ul class="kontrola">${vys.map((x, i) => `<li data-i="${i}">${ikona[x.uroven]} ${esc(x.text)}</li>`).join('')}</ul>` : ''}
      <div class="dole"><button class="tl" data-zavrit>Zavřít</button></div>`, 720);
    bg.addEventListener('click', e => {
      const li = e.target.closest('[data-i]');
      if (!li) return;
      const x = vys[+li.dataset.i];
      if (x.di === null) return;
      bg.remove(); jdi(x.di); vyb = x.prvek; vykresli();
    });
  }

  // náhled jako hotová kniha: jen ořez, bez vodítek, listování šipkami
  function oknoNahledu() {
    const seznam = [...(K.obalka.prvky.length ? ['obalka'] : []), ...K.dvoustrany.map((d, i) => i)];
    let i = Math.max(0, seznam.indexOf(di));
    const bg = document.createElement('div');
    bg.className = 'nahled-bg';
    bg.innerHTML = `<div class="kniha" id="nhKniha"></div><div class="ovl"><button class="tl" data-nh="-1" aria-label="Předchozí">◀</button><span id="nhPopis"></span><button class="tl" data-nh="1" aria-label="Další">▶</button><button class="tl" data-nh="x">✕ Zavřít (Esc)</button></div>`;
    document.body.append(bg);
    const kresli = () => {
      const idx = seznam[i], g = F.geom(K, idx), b = g.b;
      const k = Math.min((innerWidth - 60) / g.w, (innerHeight - 110) / g.v);
      const kn = bg.querySelector('#nhKniha');
      kn.style.width = g.w * k + 'px'; kn.style.height = g.v * k + 'px';
      const el = vykresliDv(idx, k, false);
      el.querySelectorAll('.spad, .deska').forEach(x => x.remove());
      el.style.left = -b * k + 'px'; el.style.top = -b * k + 'px';
      kn.replaceChildren(el);
      if (idx !== 'obalka') {
        kn.insertAdjacentHTML('beforeend', `<div class="hrbet-stin" style="left:${g.stred * k}px"></div>`);
        // desky na krajních dvoustranách = tmavé
        if (idx === 0) kn.insertAdjacentHTML('beforeend', `<div style="position:absolute;left:0;top:0;bottom:0;width:${g.stred * k}px;background:#111"></div>`);
        if (idx === K.dvoustrany.length - 1) kn.insertAdjacentHTML('beforeend', `<div style="position:absolute;right:0;top:0;bottom:0;width:${g.stred * k}px;background:#111"></div>`);
      }
      bg.querySelector('#nhPopis').textContent = `${popisPlochy(idx)} (${i + 1} / ${seznam.length})`;
    };
    const zavri = () => { bg.remove(); removeEventListener('keydown', kl, true); };
    const kl = e => {
      if (e.key === 'Escape') { e.stopPropagation(); zavri(); }
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); i = Math.min(i + 1, seznam.length - 1); kresli(); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); i = Math.max(i - 1, 0); kresli(); }
    };
    addEventListener('keydown', kl, true);
    bg.addEventListener('click', e => {
      const t = e.target.closest('[data-nh]');
      if (!t) return;
      if (t.dataset.nh === 'x') return zavri();
      i = F.omez(i + +t.dataset.nh, 0, seznam.length - 1); kresli();
    });
    kresli();
  }

  function oknoTisk() {
    okno(`<h2>❔ Jak knihu nechat vytisknout</h2>
      <ol>
        <li><b>Služba, která přijímá PDF</b> (např. Blurb, Lulu, u vybraných produktů Saal Digital). Nastavte rozměr strany, spadávku a počet stran podle jejich předlohy a exportujte <i>PDF – každá strana zvlášť</i> a zvlášť <i>PDF – obálka</i>. Podmínky si ověřte přímo u služby.</li>
        <li><b>Místní digitální tiskárna / knihařství.</b> Pošlete <i>PDF po stranách</i> se zapnutými ořezovými značkami a PDF obálky (značky ukážou i ohyby hřbetu). Domluvte papír (např. 170–250 g lesk/mat) a vazbu: V2 lepená brožura, V8 tvrdé desky, nebo lay-flat. Malý náklad (1–5 ks) bývá bez problémů.</li>
        <li><b>Fotolab.</b> Exportujte <i>JPEG 300 DPI po dvoustranách</i> a nechte vyvolat jako fotografie ve velkém formátu – pak je knihař slepí do alba s tvrdými listy (tzv. flush mount).</li>
      </ol>
      <p><b>Co hlídat:</b> u fotek aspoň 220 DPI (aplikace varuje), důležité věci uvnitř modré bezpečné zóny, fotky „do kraje“ natáhnout až za červený ořez do spadávky. PDF má nastavený TrimBox a BleedBox, fotky jsou v plné kvalitě bez přepočítání, písma jsou vložená. Barvy jsou v sRGB – digitální tisk i fotolaby to zpracují; ofsetová tiskárna může chtít převod do CMYK (PDF/X) u sebe.</p>
      <p><b>Obálka:</b> šířka hřbetu závisí na papíru a počtu stran – nechte si ji od tiskárny potvrdit a zadejte ji v Kniha ▾ → Obálka a hřbet.</p>
      <div class="dole"><button class="tl" data-zavrit>Zavřít</button></div>`, 700);
  }

  function oknoNapovedy() {
    okno(`<h2>❓ Nápověda</h2>
      <div class="napoveda"><p>1) <b>Kniha ▾</b> – formát a počet stran. 2) <b>Přidat fotky</b> (nebo je přetáhněte do šuplíku vlevo). 3) Vpravo zvolte <b>rozvržení</b> strany, nebo nechte <b>Úpravy ▾ → Rozvrhnout automaticky</b>. 4) Doplňte texty a <b>obálku</b> (první miniatura dole). 5) <b>Kontrola</b> a <b>Export</b>.</p>
      <table>
        <tr><td>Přesun prvku</td><td>tažení (Alt = bez přichytávání)</td></tr>
        <tr><td>Velikost</td><td>úchyty vybraného prvku (Shift u rohu = zachovat poměr)</td></tr>
        <tr><td>Posun fotky v rámečku</td><td>dvojklik na rámeček, pak tažení</td></tr>
        <tr><td>Přiblížení fotky</td><td>kolečko myši nad rámečkem / posuvník</td></tr>
        <tr><td>Přiblížení plochy</td><td><kbd>Ctrl</kbd>+kolečko, <kbd>Ctrl++</kbd> / <kbd>Ctrl+−</kbd> / <kbd>Ctrl+0</kbd></td></tr>
        <tr><td>Prohodit fotky</td><td><kbd>Shift</kbd>+tažení rámečku na jiný, nebo tlačítko ⇄</td></tr>
        <tr><td>Fotka do rámečku</td><td>přetáhnout ze šuplíku; na dotyku: klepnout na fotku, pak na rámeček</td></tr>
        <tr><td>Vložit na stranu</td><td>dvojklik na fotku v šuplíku</td></tr>
        <tr><td>Nový rámeček / text</td><td><kbd>R</kbd> / <kbd>T</kbd>; úprava textu dvojklikem</td></tr>
        <tr><td>Kopírovat / vložit prvek</td><td><kbd>Ctrl+C</kbd> / <kbd>Ctrl+V</kbd> (i na jinou dvoustranu)</td></tr>
        <tr><td>Posun o 1 / 10 mm</td><td><kbd>←↑→↓</kbd> / <kbd>Shift</kbd>+šipky</td></tr>
        <tr><td>Smazat prvek</td><td><kbd>Delete</kbd></td></tr>
        <tr><td>Zpět / znovu</td><td><kbd>Ctrl+Z</kbd> / <kbd>Ctrl+Y</kbd></td></tr>
        <tr><td>Další / předchozí dvoustrana</td><td><kbd>PageDown</kbd> / <kbd>PageUp</kbd> (bez výběru i šipky)</td></tr>
        <tr><td>Náhled knihy / paleta příkazů</td><td><kbd>P</kbd> / <kbd>Ctrl+K</kbd></td></tr>
      </table>
      <p class="pozn" style="margin-top:8px">Červená čára = ořez, šedý pruh = spadávka (odřízne se), modrá přerušovaná = bezpečná zóna pro důležitý obsah, červený pás uprostřed = hřbet. Knihovny pdf-lib a fontkit (MIT), písma Liberation a Google Fonts (OFL).</p></div>
      <div class="dole"><button class="tl" data-zavrit>Zavřít</button></div>`, 660);
  }

  /* ---------- export ---------- */
  function stahni(blob, jmeno) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = jmeno;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  }
  const jmenoSouboru = s => (K.nazev || 'fotokniha').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_|_$/g, '') + s;
  async function predExportem(rezim) {
    const vys = F.kontrola(K).filter(x => rezim === 'obalka' ? x.di === 'obalka' : x.di !== 'obalka'), ch = vys.filter(x => x.uroven === 'chyba').length;
    const d = rezim === 'obalka' ? [K.obalka] : K.dvoustrany;
    if (!d.some(x => x.prvky.length)) { Dialog.info(rezim === 'obalka' ? 'Obálka je zatím prázdná.' : 'Kniha je zatím prázdná.'); return false; }
    await zajistiPisma();
    return !ch || Dialog.potvrd(`Kontrola našla ${ch} chyb (např. málo DPI nebo přetékající text). Exportovat i tak?`);
  }
  const nactiFoto = async id => {
    const z = zaznamy.get(id);
    return { bytes: new Uint8Array(await z.original.arrayBuffer()), typ: z.typ, orient: z.orient };
  };
  const moznostiPdf = rezim => ({ rezim, znacky: nast.znacky, fontkit: window.fontkit, pismo: id => nactiPismo(id) });
  async function exportPdf(rezim) {
    if (!await predExportem(rezim)) return;
    const pr = prubeh('Skládám PDF…');
    try {
      const pdf = await F.exportPdf(K, nactiFoto, { ...moznostiPdf(rezim), prubeh: (i, n) => pr(`Skládám PDF… ${i + 1} / ${n}`) });
      stahni(new Blob([pdf], { type: 'application/pdf' }), jmenoSouboru({ strany: '_strany.pdf', dvoustrany: '_dvoustrany.pdf', obalka: '_obalka.pdf' }[rezim]));
      Dialog.info(`PDF hotové (${(pdf.length / 1048576).toFixed(1)} MB)`);
    } catch (e) { Dialog.chyba('Export selhal: ' + e.message); }
    finally { pr(null); }
  }
  async function exportJpeg() {
    if (!await predExportem('dvoustrany')) return;
    const seznam = [...(K.obalka.prvky.length ? F.archy(K, 'obalka') : []), ...F.archy(K, 'dvoustrany')];
    const pr = prubeh('Kreslím dvoustrany…'), polozky = [], px = 300 / 25.4;
    try {
      for (let i = 0; i < seznam.length; i++) {
        const a = seznam[i], g = F.geom(K, a.di);
        pr(`Kreslím dvoustrany… ${i + 1} / ${seznam.length}`);
        const c = document.createElement('canvas');
        c.width = Math.round((a.w + 2 * g.b) * px); c.height = Math.round((g.v + 2 * g.b) * px);
        await F.kresliArch(c.getContext('2d'), K, a, px, id => createImageBitmap(zaznamy.get(id).original));
        const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.95));
        c.width = c.height = 0;
        const data = F.jfifDpi(new Uint8Array(await blob.arrayBuffer()), 300);
        polozky.push({ name: a.di === 'obalka' ? '00_obalka.jpg' : `${String(i + 1).padStart(2, '0')}_strany_${a.strany.join('-')}.jpg`, data });
      }
      stahni(new Blob([PDFDILNA.zip(polozky)], { type: 'application/zip' }), jmenoSouboru('_jpeg300.zip'));
    } catch (e) { Dialog.chyba('Export selhal: ' + e.message); }
    finally { pr(null); }
  }

  /* ---------- záloha projektu ---------- */
  async function zalohaZip() {
    const fotky = [], polozky = [];
    for (const f of K.fotky) {
      const z = zaznamy.get(f.id);
      if (!z) continue;
      fotky.push({ id: z.id, nazev: z.nazev, typ: z.typ, velikost: z.velikost, w: z.w, h: z.h, orient: z.orient, datum: z.datum });
      polozky.push({ name: `fotky/${z.id}.${z.typ}`, data: new Uint8Array(await z.original.arrayBuffer()) });
      polozky.push({ name: `nahledy/${z.id}.jpg`, data: new Uint8Array(await z.nahled.arrayBuffer()) });
    }
    polozky.unshift({ name: 'fotokniha.json', data: JSON.stringify({ format: 'fotokniha-zaloha', verze: 1, kniha: K, fotky }) });
    return PDFDILNA.zip(polozky);
  }
  async function zalohuj() {
    const pr = prubeh('Balím zálohu…');
    try {
      stahni(new Blob([await zalohaZip()], { type: 'application/zip' }), jmenoSouboru('_zaloha.zip'));
    } catch (e) { Dialog.chyba('Záloha selhala: ' + e.message); }
    finally { pr(null); }
  }
  async function obnovZeZalohy(soubor) {
    const pr = prubeh('Načítám zálohu…');
    try {
      const pol = new Map(F.rozbalZip(new Uint8Array(await soubor.arrayBuffer())).map(p => [p.name, p.data]));
      const hl = pol.get('fotokniha.json');
      const j = hl && JSON.parse(new TextDecoder().decode(hl));
      if (!j || j.format !== 'fotokniha-zaloha') throw new Error('to není záloha Fotoknihy');
      // nové id knihy i fotek – záloha jde obnovit i vedle originálu
      const k = F.doplnKnihu(j.kniha), mapa = new Map();
      k.id = F.nid(); k.nazev += ' (obnoveno)'; k.upraveno = Date.now();
      for (const f of j.fotky) {
        const id = F.nid(), orig = pol.get(`fotky/${f.id}.${f.typ}`), nah = pol.get(`nahledy/${f.id}.jpg`);
        if (!orig || !nah) continue;
        mapa.set(f.id, id);
        await U.ulozFotku({ ...f, id, kniha: k.id, original: new Blob([orig], { type: f.typ === 'png' ? 'image/png' : 'image/jpeg' }), nahled: new Blob([nah], { type: 'image/jpeg' }) });
      }
      k.fotky = k.fotky.filter(f => mapa.has(f.id)).map(f => ({ ...f, id: mapa.get(f.id) }));
      for (const d of [...k.dvoustrany, k.obalka]) for (const p of d.prvky) if (p.foto) p.foto = mapa.get(p.foto) || null;
      await U.ulozKnihu(k);
      await otevri(k.id);
      Dialog.info(`Obnoveno: ${k.nazev}`);
    } catch (e) { Dialog.chyba('Obnova selhala: ' + e.message); }
    finally { pr(null); }
  }

  /* ---------- start ---------- */
  async function otevri(id) {
    const k = await U.nactiKnihu(id);
    if (!k) return false;
    for (const u of url.values()) URL.revokeObjectURL(u);
    url.clear(); zaznamy.clear();
    for (const z of await U.fotkyKnihy(id)) zaznamy.set(z.id, z);
    K = F.doplnKnihu(k); di = 0; vyb = null; vybFoto = null; rezimVyrez = false; prohazovani = null; zpet = []; znovu = []; zoom = 1;
    // fotka bez záznamu (smazaná data) → pryč z knihy
    K.fotky = K.fotky.filter(f => zaznamy.has(f.id));
    localStorage.setItem(KLIC_POSLEDNI, id);
    vykresli(true);
    zajistiPisma();
    return true;
  }
  async function start() {
    prepinace();
    const posledni = localStorage.getItem(KLIC_POSLEDNI);
    if (posledni && await otevri(posledni)) return;
    const knihy = await U.seznamKnih();
    if (knihy.length) return otevri(knihy.sort((a, b) => b.upraveno - a.upraveno)[0].id);
    const k = F.novaKniha({});
    await U.ulozKnihu(k);
    await otevri(k.id);
  }
  window.FK_APP = { get kniha() { return K; }, get di() { return di; }, otevri, pridejFotky, jdi, prikaz, vlozFotku, zajistiPisma,
    vyber: id => { vyb = id; vykresli(); }, exportPdfBajty: async rezim => { await zajistiPisma(); return F.exportPdf(K, nactiFoto, moznostiPdf(rezim)); },
    zalohaZip, obnovZeZalohy };
  start().catch(e => Dialog.chyba('Start selhal: ' + e.message));
})();
