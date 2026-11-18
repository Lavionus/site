/* Ověření pravosti fotografie – UI. Jádro: pravost_fotky/jadro.js (PRAVOST), výpočty: pravost_fotky/worker.js.
   Test: python3 _test/pravost_fotky_ui.py */
(function () {
  'use strict';
  const P = window.PRAVOST, $ = id => document.getElementById(id);
  if (window.self === window.top) document.body.classList.add('samostatne');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cislo = (v, d) => Number(v).toLocaleString(document.documentElement.lang || 'cs', { maximumFractionDigits: d == null ? 1 : d });
  const velikost = b => b < 1024 ? b + ' B' : b < 1048576 ? cislo(b / 1024) + ' kB' : cislo(b / 1048576, 2) + ' MB';
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';

  /* ---------- nastavení (localStorage) ---------- */
  const KLIC = 'webapp_pravost_fotky';
  const VYCHOZI = { kvalitaEla: 90, zesileni: 15, prekryv: false, kryti: 70 };
  let nast = Object.assign({}, VYCHOZI);
  try { Object.assign(nast, JSON.parse(localStorage.getItem(KLIC) || '{}')); } catch (e) { /* bez úložiště */ }
  const ulozNast = () => { try { localStorage.setItem(KLIC, JSON.stringify(nast)); } catch (e) { /* plné / zakázané */ } };

  /* ---------- worker ---------- */
  let worker = null, dalsiId = 1;
  const cekajici = new Map();
  const zpravaWorkeru = e => {
    const d = e.data, c = cekajici.get(d.id);
    if (!c) return;
    if (d.prubeh != null) { if (c.prubeh) c.prubeh(d.prubeh, d.faze); return; }
    cekajici.delete(d.id);
    if (d.chyba) c.ne(new Error(d.chyba)); else c.ok(d);
  };
  const chybaWorkeru = e => { for (const c of cekajici.values()) c.ne(new Error(e.message || 'chyba workeru')); cekajici.clear(); };
  function novyWorker() { worker = new Worker('pravost_fotky/worker.js'); worker.onmessage = zpravaWorkeru; worker.onerror = chybaWorkeru; }
  novyWorker();
  /** Zrušení běžícího výpočtu (velká fotka trvá desítky sekund): worker ukončit a založit nový. */
  function zrusVypocet() {
    if (!cekajici.size) return;
    worker.terminate();
    for (const c of cekajici.values()) c.ne(Object.assign(new Error('Výpočet zrušen.'), { zruseno: true }));
    cekajici.clear(); novyWorker();
  }
  const prace = (zprava, prenos, prubeh) => new Promise((ok, ne) => { const id = dalsiId++; cekajici.set(id, { ok, ne, prubeh }); worker.postMessage(Object.assign({ id }, zprava), prenos || []); });

  /* ---------- stav ---------- */
  let stav = null;          // načtený soubor a výsledky
  let vrstva = 'original', zalozka = 'souhrn', bezi = null;

  const FAZE = { ela: 'ELA ve více kvalitách', sum: 'šumový reziduál', klon: 'hledání klonů', hotovo: 'dokončuji' };
  function ukazPrubeh(text, p) {
    $('prubeh').hidden = text == null;
    if (text != null) { $('prubehText').textContent = text; $('prubehPruh').value = p || 0; }
  }

  async function dekoduj(bajty, typ) {
    const bmp = await createImageBitmap(new Blob([bajty], { type: typ }));
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0);
    const d = g.getImageData(0, 0, bmp.width, bmp.height);
    if (bmp.close) bmp.close();
    return { rgba: d.data, w: d.width, h: d.height };
  }

  const MIME = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  const MAX_PIX = 40e6;

  /** Načte soubor (File) a spustí analýzy. ukazka = údaje syntetické ukázky (pravda, maska) nebo null. */
  async function nacti(soubor, ukazka) {
    if (bezi) return bezi;
    bezi = (async () => {
      try {
        ukazPrubeh('Čtu soubor…', 0);
        const buf = await soubor.arrayBuffer(), bajty = new Uint8Array(buf);
        let hash = null;
        try { if (crypto.subtle) hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buf)), b => b.toString(16).padStart(2, '0')).join(''); } catch (e) { hash = null; }
        const rozbor = P.rozborSouboru(bajty);
        const s = { soubor: { nazev: soubor.name || 'bez názvu', velikost: soubor.size, typ: soubor.type || '', zmena: soubor.lastModified || null },
          bajty, hash, rozbor, ukazka: ukazka || null, cas: new Date(), varovani: rozbor.varovani.slice(), vysl: null, obraz: null, nahled: null };
        stav = s;
        $('uvod').hidden = true;
        $('tlProtokol').disabled = false; $('tlZnovu').disabled = !MIME[rozbor.typ];
        $('vrstvy').querySelector('[data-vrstva=pravda]').hidden = !ukazka;
        if (MIME[rozbor.typ]) {
          let o;
          try { o = await dekoduj(bajty, MIME[rozbor.typ]); }
          catch (e) { s.varovani.push('Prohlížeč obrázek nedekódoval (' + e.message + ') – obrazové analýzy nejdou.'); o = null; }
          if (o) {
            const orient = rozbor.exif && +rozbor.exif.ifd0.Orientation;
            if (orient > 1 && orient <= 8 && rozbor.sof) {
              // prohlížeč orientaci použil → vrátit do uloženého stavu (mřížka 8×8 a souřadnice jako v souboru)
              const otoceno = orient >= 5 ? (o.w === rozbor.sof.vyska && o.h === rozbor.sof.sirka) : true;
              if (otoceno) { o = P.zrusOrientaci(o.rgba, o.w, o.h, orient); s.varovani.push(`EXIF orientace ${orient}: obrázek se zobrazuje a analyzuje v uložené orientaci (jak je v souboru), ne otočený pro prohlížení.`); }
            }
            s.obraz = o;
          }
          if (s.obraz && rozbor.nahledBajty) {
            try { s.nahled = await dekoduj(rozbor.nahledBajty, 'image/jpeg'); } catch (e) { s.varovani.push('Náhled v EXIF nejde dekódovat – je poškozený nebo v neobvyklém formátu.'); }
          }
        }
        vrstva = 'original';
        kresli(); vykresliPanel();
        if (s.obraz && s.obraz.w * s.obraz.h > MAX_PIX) s.varovani.push(`Obrázek má ${cislo(s.obraz.w * s.obraz.h / 1e6)} Mpx – obrazové analýzy se nad ${MAX_PIX / 1e6} Mpx nespouštějí (paměť prohlížeče).`);
        else if (s.obraz) await analyzuj();
        s.metadata = P.indicieMetadat(rozbor, s.obraz);
        vykresliPanel(); kresli();
      } catch (e) {
        Dialog.chyba('Soubor nelze zpracovat: ' + e.message);
      } finally { ukazPrubeh(null); bezi = null; }
    })();
    return bezi;
  }

  async function analyzuj() {
    const s = stav;
    if (!s || !s.obraz) return;
    ukazPrubeh('Analyzuji…', 0);
    const t0 = performance.now();
    const kopie = s.obraz.rgba.slice();
    const zprava = { ukol: 'analyza', rgba: kopie.buffer, w: s.obraz.w, h: s.obraz.h, kvalitaEla: nast.kvalitaEla,
      rozbor: { typ: s.rozbor.typ, dqt: s.rozbor.dqt, sof: s.rozbor.sof }, nahled: s.nahled ? { rgba: s.nahled.rgba, w: s.nahled.w, h: s.nahled.h } : null };
    let d;
    try { d = await prace(zprava, [kopie.buffer], (p, f) => ukazPrubeh('Analyzuji – ' + (FAZE[f] || f) + '…', p)); }
    catch (e) { if (!e.zruseno) throw e; s.varovani.push('Obrazové analýzy byly zrušeny – výsledky obsahují jen metadata a strukturu souboru (lze spustit znovu).'); return; }
    if (s !== stav) return;
    s.vysl = d.vysledky;
    s.trvani = Math.round(performance.now() - t0);
    s.verdikty = P.verdikty(Object.assign({ metadata: P.indicieMetadat(s.rozbor, s.obraz) }, s.vysl, { nahled: s.vysl.nahled }));
  }

  async function prepocitejEla() {
    if (!stav || !stav.vysl || !stav.vysl.elaMapa) return;
    const d = await prace({ ukol: 'ela', q: nast.kvalitaEla });
    stav.vysl.elaMapa = d.ela;
    kresli(); if (zalozka === 'analyzy') vykresliPanel();
  }

  /* ---------- kreslení vrstev ---------- */
  const STUPNICE = [[0, 0, 0], [60, 15, 110], [170, 45, 100], [240, 120, 30], [252, 240, 150]];
  function barva(t) {
    t = Math.max(0, Math.min(1, t)) * (STUPNICE.length - 1);
    const i = Math.min(STUPNICE.length - 2, Math.floor(t)), f = t - i, a = STUPNICE[i], b = STUPNICE[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }
  const gradientCss = () => 'linear-gradient(90deg,' + STUPNICE.map(c => `rgb(${c.join(',')})`).join(',') + ')';

  /** Vykreslí vrstvu do daného plátna (i pro protokol). */
  function kresliDo(cv, jaka) {
    const s = stav, o = s && s.obraz;
    if (!o) { cv.width = 320; cv.height = 200; const g = cv.getContext('2d'); g.fillStyle = css('--bg-control'); g.fillRect(0, 0, 320, 200); g.fillStyle = css('--text-muted'); g.font = '14px system-ui'; g.fillText('Obrázek nelze zobrazit', 80, 104); return; }
    cv.width = o.w; cv.height = o.h;
    const g = cv.getContext('2d'), v = s.vysl, w = o.w, h = o.h;
    const img = new ImageData(new Uint8ClampedArray(o.rgba), w, h);
    const prekryv = nast.prekryv, kr = nast.kryti / 100;
    const smichej = (i, c) => { const p = i * 4; if (prekryv) { img.data[p] = img.data[p] * (1 - kr) + c[0] * kr; img.data[p + 1] = img.data[p + 1] * (1 - kr) + c[1] * kr; img.data[p + 2] = img.data[p + 2] * (1 - kr) + c[2] * kr; } else { img.data[p] = c[0]; img.data[p + 1] = c[1]; img.data[p + 2] = c[2]; } };
    if (jaka === 'ela' && v && v.elaMapa) {
      const m = v.elaMapa.mapa, z = nast.zesileni / 255;
      for (let i = 0; i < m.length; i++) smichej(i, barva(m[i] * z));
    } else if (jaka === 'rezidual' && v) {
      const r = v.sum.rezidual;
      for (let i = 0; i < r.length; i++) { const t = Math.max(0, Math.min(255, 128 + r[i] * 8)); smichej(i, [t, t, t]); }
    } else if (jaka === 'mapaSumu' && v) {
      const { sigma, okoli, bw, bh, B } = v.sum;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const bx = Math.min(bw - 1, (x / B) | 0), by = Math.min(bh - 1, (y / B) | 0), k = by * bw + bx;
        smichej(y * w + x, barva(Math.min(1, sigma[k] / Math.max(0.3, okoli[k]) / 2)));
      }
    } else if ((jaka === 'klon' || jaka === 'indicie' || jaka === 'pravda') && !prekryv) {
      for (let i = 0; i < img.data.length; i += 4) { img.data[i] = img.data[i] * 0.55 + 40; img.data[i + 1] = img.data[i + 1] * 0.55 + 40; img.data[i + 2] = img.data[i + 2] * 0.55 + 40; }
    }
    if (jaka === 'pravda' && s.ukazka && s.ukazka.maska) {
      const m = s.ukazka.maska, c = [255, 60, 60];
      for (let i = 0; i < m.length; i++) if (m[i]) { const p = i * 4; img.data[p] = img.data[p] * 0.4 + c[0] * 0.6; img.data[p + 1] = img.data[p + 1] * 0.4 + c[1] * 0.6; img.data[p + 2] = img.data[p + 2] * 0.4 + c[2] * 0.6; }
    }
    g.putImageData(img, 0, 0);
    const lw = Math.max(2, Math.round(Math.max(w, h) / 320));
    g.lineWidth = lw; g.font = `600 ${Math.max(12, lw * 6)}px system-ui,sans-serif`;
    const lem = css('--bg');
    const ramecek = (r, barvaR, popis) => {
      // lem v barvě pozadí, aby byl rámeček vidět i na stejně barevném podkladu
      g.lineWidth = lw * 2.2; g.strokeStyle = lem; g.strokeRect(r.x + lw / 2, r.y + lw / 2, r.w - lw, r.h - lw);
      g.lineWidth = lw; g.strokeStyle = barvaR; g.strokeRect(r.x + lw / 2, r.y + lw / 2, r.w - lw, r.h - lw);
      if (popis) { const tx = r.x + lw * 2, ty = Math.max(lw * 7, r.y - lw * 2); g.lineWidth = lw * 1.5; g.strokeStyle = lem; g.strokeText(popis, tx, ty); g.fillStyle = barvaR; g.fillText(popis, tx, ty); g.lineWidth = lw; }
    };
    if (!v) return;
    const cDanger = css('--danger'), cWarn = css('--warn'), cAccent = css('--accent');
    if ((jaka === 'ela' || jaka === 'indicie') && v.ela) v.ela.oblasti.forEach(r => ramecek(r, cWarn, jaka === 'indicie' ? 'ELA' : `q${r.q}`));
    if ((jaka === 'mapaSumu' || jaka === 'indicie') && v.sum) v.sum.oblasti.forEach(r => ramecek(r, cAccent, jaka === 'indicie' ? 'šum' : ''));
    if ((jaka === 'klon' || jaka === 'indicie') && v.klon) v.klon.nalezy.forEach((k, j) => {
      if (jaka === 'klon') {
        g.strokeStyle = cWarn; g.globalAlpha = 0.35; g.lineWidth = Math.max(1, lw / 2); g.beginPath();
        const B = v.klon.B / v.klon.meritko / 2, krok = Math.max(1, Math.floor(k.body.length / 2 / 60));
        for (let i = 0; i < k.body.length; i += 2 * krok) { g.moveTo(k.body[i] + B, k.body[i + 1] + B); g.lineTo(k.body[i] + k.dx + B, k.body[i + 1] + k.dy + B); }
        g.stroke(); g.globalAlpha = 1; g.lineWidth = lw;
      }
      ramecek(k.zdroj, cAccent, j === 0 ? 'A' : ''); ramecek(k.cil, cDanger, j === 0 ? 'B' : '');
    });
    if (jaka === 'indicie' && v.nahled && v.nahled.lokalniMax > 30) {
      g.strokeStyle = cDanger; g.beginPath(); g.arc(v.nahled.misto.x * w, v.nahled.misto.y * h, Math.max(w, h) / 18, 0, 2 * Math.PI); g.stroke();
      g.fillStyle = cDanger; g.fillText('náhled ≠', v.nahled.misto.x * w + Math.max(w, h) / 16, v.nahled.misto.y * h);
    }
  }

  const POPIS_VRSTVY = {
    original: () => stav && stav.obraz ? `Fotka ${stav.obraz.w} × ${stav.obraz.h} px v uložené orientaci.` : '',
    indicie: () => 'Oblasti nalezené automaticky: <b>ELA</b> (žlutě), <b>šum</b> (modře), <b>klon</b> A → B, rozdíl proti náhledu EXIF (kroužek). Žádný rámeček neznamená „pravé“.',
    ela: () => `ELA: rozdíl po přeuložení v kvalitě <b>${nast.kvalitaEla}</b>, zesíleno ${nast.zesileni}× <span class="stupnice" style="background:${gradientCss()}"></span> malý → velký. Hrany a textury jsou světlé vždy – porovnávejte podobné povrchy. Rámečky = automaticky nalezené oblasti (kvalita, ve které byly nejvýraznější).`,
    rezidual: () => 'Šumový reziduál: jas minus medián 3×3, zesíleno 8×. Šedá = bez šumu; zrnitost má být po celém snímku podobná. Hladká „díra“ v zrnité ploše = podezřelá.',
    mapaSumu: () => `Mapa šumu: odhad šumu bloku 32×32 vůči okolí <span class="stupnice" style="background:${gradientCss()}"></span> hladší → zašuměnější (střed = jako okolí). Rámečky = oblasti pod 50 % okolí.`,
    klon: () => 'Klonování: dvojice shodných oblastí <b>A</b> ↔ <b>B</b> (která je originál a která kopie, metoda neurčí), čáry spojují vzorek shodných bloků. Opakující se vzory (okna, dlaždice) dávají falešné shody.',
    pravda: () => 'Pravda ukázky: červeně oblast, která byla skutečně upravena (u ukázek bez místní úpravy prázdné).'
  };
  function kresli() {
    kresliDo($('platno'), vrstva);
    document.querySelectorAll('[data-vrstva]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.vrstva === vrstva)));
    const bezVysl = stav && !stav.vysl && vrstva !== 'original' && vrstva !== 'pravda';
    $('legenda').innerHTML = !stav ? '' : bezVysl ? 'Tato vrstva potřebuje obrazové analýzy (JPEG/PNG/WebP).' : (POPIS_VRSTVY[vrstva] || (() => ''))();
  }

  /* ---------- panel ---------- */
  const VAHA = { 3: 'silná', 2: 'střední', 1: 'slabá', 0: 'informace' };
  const VERDIKT_TXT = { nalezena: 'indicie nalezena', nenalezena: 'nenalezena', nelze: 'nelze posoudit' };
  function vsechnyIndicie() {
    if (!stav) return [];
    const ind = (stav.metadata || P.indicieMetadat(stav.rozbor, stav.obraz)).concat(stav.vysl ? P.indicieObrazu(stav.vysl) : []);
    return ind.sort((a, b) => b.vaha - a.vaha);
  }
  const karta = i => `<div class="karta v${i.vaha}"><b><span class="stitek v${i.vaha}">${VAHA[i.vaha]}</span>${esc(i.text)}</b><span class="vys">${esc(i.vysvetleni)}</span></div>`;

  function panelSouhrn() {
    const s = stav, ind = vsechnyIndicie(), sil = ind.filter(i => i.vaha >= 2), sl = ind.filter(i => i.vaha === 1);
    const u = s.ukazka, def = u && P.UKAZKY.find(x => x.klic === u.klic);
    const bezOtisku = 'nedostupné (prohlížeč bez crypto.subtle)';
    let h = '';
    if (def) h += `<div class="ukazka-info"><h4>🧪 Ukázka: ${esc(def.nazev)}</h4><p>${esc(def.popis)}</p><p><b>Co zkusit:</b> ${esc(def.co)}</p>
      <p>Co by měla která analýza najít (pravda ukázky); vrstva <b>Pravda ukázky</b> ukáže upravenou oblast:</p>
      <table><tbody>${Object.entries(def.pravda).map(([k, v]) => `<tr><th>${NAZVY_ANALYZ[k]}</th><td>${VERDIKT_TXT[v]}</td></tr>`).join('')}</tbody></table></div>`;
    h += `<h3>Soubor</h3><div class="tab-obal"><table><tbody>
      <tr><th>Název souboru</th><td class="hod" data-i18n="ne">${esc(s.soubor.nazev)}</td></tr>
      <tr><th>Velikost</th><td>${velikost(s.soubor.velikost)} (${cislo(s.soubor.velikost, 0)} B)</td></tr>
      <tr><th>Formát</th><td>${esc(s.rozbor.typ.toUpperCase())}${s.obraz ? `, ${s.obraz.w} × ${s.obraz.h} px` : ''}</td></tr>
      <tr><th>SHA-256</th><td class="mono hod" id="otisk"${s.hash ? ' data-i18n="ne"' : ''}>${s.hash || bezOtisku}</td></tr>
    </tbody></table></div>
    <p class="vys" style="font-size:.76rem;color:var(--text-muted)">Soubor se nikam neodeslal. Otisk SHA-256 identifikuje přesně tento soubor – jakákoli změna (i jen metadat) dá jiný otisk.</p>`;
    h += '<h3>Závěr</h3>';
    const zaver = !s.vysl && s.obraz ? ['⏳ Analýzy běží…', ''] :
      sil.length ? [`⚠️ Indicie možné úpravy: ${sil.length} (z toho silných ${sil.filter(i => i.vaha === 3).length}).`, 'Indicie nejsou důkaz – každá má i nevinné vysvětlení (viz text u ní). Rozhodující je posouzení v kontextu: původ souboru, další snímky, výpověď autora.']
        : sl.length ? ['ℹ️ Jen slabé indicie (přeuložení, stopy softwaru).', 'Soubor nejspíš prošel programem, ale analýzy nenašly místní úpravu obsahu. To NENÍ důkaz pravosti.']
          : ['✓ Nenalezeny stopy úpravy.', 'To NENÍ důkaz pravosti: pečlivá úprava, přeuložení se zmenšením nebo obrázek vytvořený umělou inteligencí nemusí zanechat stopy, které tyto metody zachytí.'];
    h += `<div class="zaver"><strong>${zaver[0]}</strong>${esc(zaver[1])}</div>`;
    if (s.verdikty) h += `<div class="tab-obal"><table><tbody>${Object.entries(s.verdikty).map(([k, v]) => `<tr><th>${NAZVY_ANALYZ[k]}</th><td class="verdikt ${v}">${VERDIKT_TXT[v]}</td></tr>`).join('')}</tbody></table></div>`;
    if (s.varovani.length) h += s.varovani.map(t => `<div class="varovani">${esc(t)}</div>`).join('');
    h += `<h3>Indicie (${ind.length})</h3>` + (ind.length ? ind.map(karta).join('') : '<p>Žádné.</p>');
    if (s.trvani) h += `<p style="font-size:.74rem;color:var(--text-muted)">Obrazové analýzy trvaly ${cislo(s.trvani / 1000, 1)} s.</p>`;
    return h;
  }

  const POPISKY = { Make: 'Výrobce', Model: 'Model', Software: 'Software', DateTime: 'Datum změny', DateTimeOriginal: 'Datum pořízení', DateTimeDigitized: 'Datum digitalizace',
    Orientation: 'Orientace', PixelXDimension: 'Šířka v EXIF', PixelYDimension: 'Výška v EXIF', ExposureTime: 'Expozice', FNumber: 'Clona', ISOSpeedRatings: 'ISO',
    FocalLength: 'Ohnisko', LensModel: 'Objektiv', Artist: 'Autor', Copyright: 'Copyright', OffsetTimeOriginal: 'Časové pásmo pořízení', ImageUniqueID: 'Jedinečné ID',
    BodySerialNumber: 'Výrobní číslo', GPSLatitude: 'Zeměpisná šířka', GPSLongitude: 'Zeměpisná délka', GPSAltitude: 'Nadm. výška', GPSDateStamp: 'Datum GPS', GPSTimeStamp: 'Čas GPS',
    ImageWidth: 'Šířka', ImageLength: 'Výška', JPEGInterchangeFormatLength: 'Velikost náhledu', ImageDescription: 'Popis', UserComment: 'Komentář' };
  const SKRYT = new Set(['ExifIFDPointer', 'GPSInfoIFDPointer', 'InteropIFDPointer', 'JPEGInterchangeFormat']);
  function hodnota(k, v) {
    if (v instanceof Uint8Array && v.length <= 8) return Array.from(v).join('.');
    if (v instanceof Uint8Array || (v && typeof v === 'object' && !Array.isArray(v))) return `[${v.length || 0} B]`;
    if (k === 'ExposureTime' && v > 0 && v < 1) return '1/' + Math.round(1 / v) + ' s';
    if (k === 'FNumber') return 'f/' + cislo(v, 1);
    if (k === 'FocalLength') return cislo(v, 1) + ' mm';
    if (k === 'Orientation') return ({ 1: '1 – normální', 3: '3 – 180°', 6: '6 – 90° po směru', 8: '8 – 90° proti směru' })[v] || String(v);
    if (Array.isArray(v)) return v.map(x => typeof x === 'number' ? cislo(x, 4) : x).join(', ');
    return typeof v === 'number' ? cislo(v, 4) : String(v);
  }
  function panelMetadata() {
    const r = stav.rozbor, e = r.exif;
    let h = '';
    if (!e) h += '<div class="varovani">Soubor nemá EXIF. Typické pro fotky ze sociálních sítí, messengerů, snímky obrazovky a exporty pro web.</div>';
    else {
      const sekce = [['IFD0 – fotoaparát a soubor', e.ifd0], ['Exif – snímání', e.exif], ['GPS', e.gps], ['IFD1 – náhled', e.ifd1]];
      h += `<h3>EXIF <span style="font-weight:400;color:var(--text-muted);font-size:.76rem">(pořadí bajtů ${esc(e.poradi)})</span></h3><div class="tab-obal"><table><tbody>`;
      for (const [nazev, o] of sekce) {
        const kl = Object.keys(o).filter(k => !SKRYT.has(k));
        if (!kl.length) continue;
        h += `<tr class="sk"><th colspan="2">${nazev}</th></tr>` + kl.map(k => `<tr><th title="${esc(k)}">${esc(POPISKY[k] || k)}</th><td class="hod" data-i18n="ne">${esc(hodnota(k, o[k]))}</td></tr>`).join('');
      }
      h += '</tbody></table></div>';
      if (e.poloha) h += `<p>📍 Poloha z GPS: <span data-i18n="ne">${e.poloha.lat}, ${e.poloha.lon}</span> – <a href="https://www.openstreetmap.org/?mlat=${e.poloha.lat}&mlon=${e.poloha.lon}#map=16/${e.poloha.lat}/${e.poloha.lon}" target="_blank" rel="noopener">mapa OpenStreetMap ↗</a> (otevře se mimo nástroj).</p>`;
    }
    if (r.xmp) {
      const x = r.xmp;
      const pole = [['Nástroj (CreatorTool)', x.creatorTool], ['Vznik', x.createDate], ['Úprava', x.modifyDate], ['Metadata změněna', x.metadataDate],
        ['DocumentID', x.documentId], ['OriginalDocumentID', x.originalDocumentId], ['Programy v historii', x.agenti.join('; ')], ['Akce v historii', x.akce.join(', ')]];
      h += `<h3>XMP</h3><div class="tab-obal"><table><tbody>${pole.filter(([, v]) => v).map(([k, v]) => `<tr><th>${k}</th><td class="hod" data-i18n="ne">${esc(v)}</td></tr>`).join('')}</tbody></table></div>`;
    }
    if (r.komentare && r.komentare.length) h += `<h3>Komentáře (COM)</h3>${r.komentare.map(k => `<p class="mono" data-i18n="ne">${esc(k)}</p>`).join('')}`;
    if (r.texty && Object.keys(r.texty).length) h += `<h3>Texty PNG</h3><div class="tab-obal"><table><tbody>${Object.entries(r.texty).map(([k, v]) => `<tr><th data-i18n="ne">${esc(k)}</th><td class="hod" data-i18n="ne">${esc(v)}</td></tr>`).join('')}</tbody></table></div>`;
    const jednotkyJfif = r.jfif ? ['bez jednotek (poměr stran)', 'dpi', 'dpcm'][r.jfif.jednotky] || '' : '';
    if (r.jfif) h += `<p>JFIF ${esc(r.jfif.verze)}, hustota ${r.jfif.hustotaX} × ${r.jfif.hustotaY} ${jednotkyJfif}.</p>`;
    // náhled
    h += '<h3>Náhled v EXIF proti obrázku</h3>';
    const n = stav.vysl && stav.vysl.nahled;
    if (!r.nahledBajty) h += '<p>Soubor nemá náhled v EXIF – porovnání nelze provést.</p>';
    else if (!stav.nahled) h += '<p>Náhled se nepodařilo dekódovat.</p>';
    else if (!n) h += '<p>⏳ Porovnání běží…</p>';
    else {
      const shodaTxt = n.nalezena ? 'rozpor' : 'odpovídá';
      h += `<div class="nahledy"><figure><canvas id="cvNahled"></canvas>náhled ${stav.nahled.w} × ${stav.nahled.h}</figure><figure><canvas id="cvZmenseny"></canvas>obrázek zmenšený</figure><figure><canvas id="cvRozdil"></canvas>rozdíl (zesílený)</figure></div>
        <div class="analyza"><h4>Shoda náhledu <span class="verdikt ${n.nalezena ? 'nalezena' : 'nenalezena'}">${shodaTxt}</span></h4>
        průměrná odchylka ${cislo(n.prumer)} · místní maximum ${cislo(n.lokalniMax)} (0–255) · rozdíl poměru stran ${cislo(n.rozdilPomeru * 100)} %
        <details><summary>Jak to číst</summary>Náhled zapisuje fotoaparát. Když program obrázek změní a náhled nepřepíše, náhled ukáže původní stav – na rozdílové mapě je to světlé místo.
        Malé odchylky (do ~10) způsobuje komprese náhledu. Jiný poměr stran = ořez. Náhled lze ale také podvrhnout nebo smazat.</details></div>`;
    }
    return h;
  }
  function kresliNahledy() {
    const n = stav && stav.vysl && stav.vysl.nahled, c1 = $('cvNahled');
    if (!n || !c1) return;
    const nh = stav.nahled;
    c1.width = nh.w; c1.height = nh.h; c1.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(nh.rgba), nh.w, nh.h), 0, 0);
    const c2 = $('cvZmenseny'); c2.width = n.w; c2.height = n.h; c2.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(n.zmenseny), n.w, n.h), 0, 0);
    const c3 = $('cvRozdil'); c3.width = n.w; c3.height = n.h;
    const d = new ImageData(n.w, n.h);
    for (let i = 0; i < n.rozdil.length; i++) { const c = barva(n.rozdil[i] / 60); d.data[i * 4] = c[0]; d.data[i * 4 + 1] = c[1]; d.data[i * 4 + 2] = c[2]; d.data[i * 4 + 3] = 255; }
    c3.getContext('2d').putImageData(d, 0, 0);
  }

  function tabulkaDqt(t, ref) {
    const max = Math.max(...t.hodnoty);
    let h = '<table class="dqt"><tbody>';
    for (let y = 0; y < 8; y++) {
      h += '<tr>';
      for (let x = 0; x < 8; x++) { const v = t.hodnoty[y * 8 + x], pct = Math.round(10 + 60 * v / max); h += `<td style="background:color-mix(in srgb,var(--accent) ${pct}%,var(--bg-panel))" class="${ref && ref[y * 8 + x] !== v ? 'jine' : ''}" title="${ref ? 'IJG: ' + ref[y * 8 + x] : ''}">${v}</td>`; }
      h += '</tr>';
    }
    return h + '</tbody></table>';
  }
  function histSvg(hist, N) {
    const vals = hist.slice(N - 20, N + 21), max = Math.max(1, ...vals);
    const sirka = 100 / vals.length;
    return `<svg viewBox="0 0 100 46" preserveAspectRatio="none" aria-hidden="true">${vals.map((v, i) => {
      const n = i - 20, a = vals[i - 1], b = vals[i + 1], propad = Math.abs(n) >= 2 && a != null && b != null && Math.min(a, b) >= 30 && v < 0.5 * Math.min(a, b);
      const hgt = 44 * Math.sqrt(v / max);
      return `<rect x="${(i * sirka).toFixed(2)}" y="${(45 - hgt).toFixed(2)}" width="${(sirka * 0.8).toFixed(2)}" height="${hgt.toFixed(2)}" fill="currentColor"${propad ? ' class="propad"' : ''}/>`;
    }).join('')}</svg>`;
  }
  function panelStruktura() {
    const r = stav.rozbor;
    if (r.typ !== 'jpeg') return `<p>Formát ${esc(r.typ.toUpperCase())} – struktura JPEG (kvantizační tabulky, markery, dvojitá komprese) se nezkoumá.</p>`
      + (r.markery.length ? `<h3>Bloky souboru</h3><div class="tab-obal"><table><thead><tr><th>Pozice</th><th>Blok</th><th>Délka</th></tr></thead><tbody>${r.markery.map(m => `<tr><td class="mono">${m.offset}</td><td>${esc(m.kod)}</td><td>${m.delka}</td></tr>`).join('')}</tbody></table></div>` : '');
    const q = r.kvalita, sof = r.sof;
    let h = '<h3>Přehled</h3><div class="tab-obal"><table><tbody>';
    const kodovani = sof && (sof.progresivni ? 'progresivní' : sof.typ === 0xC0 ? 'baseline' : 'SOF' + (sof.typ - 0xC0));
    if (sof) h += `<tr><th>Kódování</th><td>${kodovani}, ${sof.presnost} bitů, složek ${sof.slozky.length}</td></tr>
      <tr><th>Rozměry v hlavičce</th><td>${sof.sirka} × ${sof.vyska}</td></tr><tr><th>Podvzorkování barev</th><td>${esc(r.podvzorkovani)}</td></tr>`;
    h += `<tr><th>Skenů</th><td>${r.skenu}</td></tr><tr><th>Interval restartu</th><td>${r.restart || '–'}</td></tr>
      <tr><th>Segmenty APP</th><td>${r.app.map(a => `APP${a.n} ${esc(a.id)}`).join(', ') || '–'}</td></tr>
      <tr><th>Data za koncem (EOI)</th><td>${r.zaEOI ? velikost(r.zaEOI) : '–'}</td></tr></tbody></table></div>`;
    if (q) {
      const refY = P.tabulkaIJG(P.IJG_Y, q.kvalita), refC = P.tabulkaIJG(P.IJG_C, q.kvalita);
      const druhQ = q.standardni ? 'standardní IJG' : 'vlastní tabulka';
      const popisQ = q.standardni ? `Tabulky se přesně shodují s knihovnou libjpeg (IJG) v kvalitě ${q.kvalita}. Takto ukládají editory, prohlížeče a mnoho aplikací; fotoaparáty spíše ne.`
        : `Tabulky nejsou standardní IJG – nejbližší je kvalita ${q.kvalita} (průměrná odchylka ${cislo(q.odchylka, 2)}). Vlastní tabulky mají fotoaparáty, telefony a některé programy (např. Photoshop); orámované buňky se liší od IJG.`;
      h += `<h3>Kvantizační tabulky</h3><div class="analyza"><h4>Odhad kvality: ${q.kvalita} <span class="verdikt ${q.standardni ? 'nenalezena' : 'nelze'}">${druhQ}</span></h4>
        <p>${popisQ}</p><p>Průměrný krok jasové tabulky ${cislo(q.prumerKrok)} (menší = vyšší kvalita).</p></div>`;
      r.dqt.forEach(t => { const slozka = t.id === 0 ? 'jas' : 'barva'; h += `<p style="margin:6px 0 0">Tabulka ${t.id} (${slozka}, ${t.presnost} bitů):</p>` + tabulkaDqt(t, t.id === 0 ? refY : refC); });
    }
    const d = stav.vysl && stav.vysl.dvojita;
    h += '<h3>Dvojitá komprese</h3>';
    if (!d) h += stav.obraz ? '<p>⏳ Počítá se…</p>' : '<p>Nelze – obrázek nebyl dekódován.</p>';
    else {
      const vybrane = d.detail.map((x, j) => Object.assign({ j }, x)).filter(x => !x.vynechano).sort((a, b) => (b.propadu - a.propadu) || (b.posuzovano - a.posuzovano)).slice(0, 6);
      const dvojTxt = d.nalezena ? 'známky dvojité komprese' : 'nenalezeny';
      const obrazky = vybrane.map(x => `<figure>${histSvg(d.hist[x.j], d.N)}<figcaption>frekvence (${x.pozice % 8}, ${Math.floor(x.pozice / 8)}), krok ${x.krok}, propadů ${x.propadu}</figcaption></figure>`).join('');
      h += `<div class="analyza"><h4>Histogramy DCT koeficientů jasu <span class="verdikt ${d.nalezena ? 'nalezena' : 'nenalezena'}">${dvojTxt}</span></h4>
        ${d.propadu} propadů z ${d.posuzovano} posuzovaných přihrádek (${cislo(d.podil * 100)} %), ${cislo(d.bloku, 0)} bloků 8×8.
        <div class="histy">${obrazky}</div>
        <details><summary>Jak to číst</summary>Sloupce = počet bloků s danou kvantovanou hodnotou (−20…20, odmocninové měřítko). Po jedné kompresi klesají plynule; po dvou kompresích, kdy první byla v nižší kvalitě,
        některé hodnoty skoro chybějí (červeně). Neprokáže se, když byla první komprese v kvalitě vyšší nebo stejné, když byl obrázek ořezán mimo mřížku 8 px nebo zmenšen.
        Poslední kvalita ≥ 95 má kroky 1–2 a test pak nemá data.</details></div>`;
    }
    h += `<h3>Markery (${r.markery.length})</h3><div class="tab-obal"><table><thead><tr><th>Pozice</th><th>Kód</th><th>Význam</th><th>Délka</th></tr></thead><tbody>${r.markery.map(m =>
      `<tr><td class="mono">0x${m.offset.toString(16).toUpperCase()}</td><td class="mono">${m.kod}</td><td>${esc(m.nazev)}</td><td>${m.delka || ''}${m.data ? ' + ' + velikost(m.data) : ''}</td></tr>`).join('')}</tbody></table></div>
      <p style="font-size:.76rem;color:var(--text-muted)">Pořadí markerů prozrazuje program, který soubor zapsal (fotoaparáty: SOI, APP1 EXIF, DQT…; editory často APP0 JFIF, APP13 Photoshop, APP14 Adobe). Podrobněji: <a href="exif_viewer.html">jednoduchý EXIF prohlížeč</a>.</p>`;
    return h;
  }

  const NAZVY_ANALYZ = { ela: 'ELA', sum: 'Šum', klon: 'Klonování', metadata: 'Metadata', nahled: 'Náhled EXIF', dvojita: 'Dvojitá komprese' };
  function panelAnalyzy() {
    const v = stav.vysl;
    if (!stav.obraz) return '<p>Obrazové analýzy nejdou – obrázek nebyl dekódován.</p>';
    if (!v) return '<p>⏳ Analýzy běží…</p>';
    const ver = stav.verdikty || {}, tlZobraz = vr => `<button class="btn mini" type="button" data-zobraz="${vr}">👁 Zobrazit</button>`;
    const blok = (klic, vr, nazev, telo, jak) => `<div class="analyza"><h4>${nazev} <span class="verdikt ${ver[klic] || 'nelze'}">${VERDIKT_TXT[ver[klic] || 'nelze']}</span></h4>${telo}
      <div style="margin-top:4px">${tlZobraz(vr)}</div><details><summary>Co ukazuje a kdy klame</summary>${jak}</details></div>`;
    let h = '';
    const elaTxt = v.ela && v.ela.oblasti.length ? v.ela.oblasti.map(o => `oblast ${o.x}, ${o.y} (${o.w} × ${o.h} px) v kvalitě ${o.q}, ${cislo(o.pomer)}× medián`).join('; ') : 'bez odlehlé oblasti';
    const sumTxt = v.sum.oblasti.length ? v.sum.oblasti.map(o => `hladší oblast ${o.x}, ${o.y} (${o.w} × ${o.h} px, ${Math.round(o.pomer * 100)} % okolí)`).join('; ') : 'Žádná oblast výrazně hladší než okolí.';
    const klonTxt = v.klon.nalezy.length ? v.klon.nalezy.map(k => `Posun ${k.dx}, ${k.dy} px: ${k.par} shodných bloků, oblast A ${k.zdroj.x}, ${k.zdroj.y} ↔ B ${k.cil.x}, ${k.cil.y}`).join('; ') : 'Žádná dvojice oblastí se shodným posunem.';
    const zmenseno = v.klon.meritko < 1 ? `<p>Pro hledání zmenšeno na ${v.klon.w} × ${v.klon.h} px.</p>` : '';
    const nahledTxt = v.nahled ? `Průměrná odchylka ${cislo(v.nahled.prumer)}, místní maximum ${cislo(v.nahled.lokalniMax)}, rozdíl poměru stran ${cislo(v.nahled.rozdilPomeru * 100)} %. Podrobnosti v záložce Metadata.` : 'Soubor nemá náhled v EXIF.';
    if (v.ela) h += blok('ela', 'ela', 'ELA – error level analysis', `
      <div class="pole">Kvalita přeuložení pro mapu: <span class="spolu"><input type="range" min="50" max="98" value="${nast.kvalitaEla}" data-nast="kvalitaEla"><b>${nast.kvalitaEla}</b></span></div>
      <div class="pole">Zesílení: <span class="spolu"><input type="range" min="1" max="50" value="${nast.zesileni}" data-nast="zesileni"><b>${nast.zesileni}×</b></span></div>
      <p>Průměrná chyba v kvalitě ${v.elaMapa.kvalita}: ${cislo(v.elaMapa.prumer, 2)}. Automatické hledání (kvality ${v.ela.kvality.join(', ')}): ${elaTxt}.</p>`,
    'Obrázek se znovu uloží jako JPEG a zobrazí se rozdíl. Oblast, která má jinou historii komprese (vložená z jiného souboru, uložená méněkrát), se mění jinak než okolí. Světlé jsou ale vždy hrany, jemné textury a sytě barevné plochy; tmavé jednolité plochy. Porovnávejte podobné povrchy. Hladkou retuš (rozmazání, výplň) ELA nevidí – ta nemá co „chybovat“. Po přeuložení celého obrázku nebo zmenšení se rozdíly smažou.');
    else h += '<div class="analyza"><h4>ELA <span class="verdikt nelze">jen u JPEG</span></h4>Soubor není JPEG – error level analysis nemá smysl.</div>';
    h += blok('sum', 'mapaSumu', 'Šum a šumový reziduál', `<p>Medián šumu σ ${cislo(v.sum.median, 2)} (úrovně jasu), bloky 32 × 32.</p><p>${sumTxt}</p>
      <div style="margin-top:4px"><button class="btn mini" type="button" data-zobraz="rezidual">👁 Reziduál</button></div>`,
    'Senzor přidává do celého snímku podobný šum. Retuš (rozmazání, výplň), vložený objekt z jiného zdroje nebo dokreslení umělou inteligencí bývají hladší. Šum ale mění i textura, rozostření (hloubka ostrosti), pohyb a komprese – hladké jsou přirozeně obloha a rozmazané pozadí. Nástroj hlásí jen místo hladší než jeho okolí; velkou plochu nebo celkově upravený obrázek nezachytí.');
    h += blok('klon', 'klon', 'Klonování (copy-move)', `<p>Bloků s texturou: ${cislo(v.klon.bloku, 0)}.</p>${zmenseno}<p>${klonTxt}</p>`,
    'Hledá části obrázku zkopírované jinam v témž obrázku (zakrytí předmětu trávou, zdvojení osoby). Najde jen kopii bez otočení a změny velikosti a jen na ploše s texturou. Falešné shody dávají opakující se vzory – okna, dlaždice, plot, text.');
    h += blok('nahled', 'indicie', 'Náhled EXIF', `<p>${nahledTxt}</p>`,
      'Porovnává náhled, který zapsal fotoaparát, se zmenšeným obrázkem. Rozpor = obrázek se změnil po pořízení a náhled ne. Náhled ale jde smazat nebo přegenerovat, takže shoda nic nedokazuje.');
    return h;
  }

  function vykresliPanel() {
    document.querySelectorAll('[data-zal]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.zal === zalozka)));
    const t = $('panelTelo');
    if (!stav) { t.innerHTML = '<p>Otevřete fotografii nebo ukázku z galerie.</p>'; return; }
    t.innerHTML = { souhrn: panelSouhrn, metadata: panelMetadata, struktura: panelStruktura, analyzy: panelAnalyzy }[zalozka]();
    if (zalozka === 'metadata') kresliNahledy();
  }

  /* ---------- protokol ---------- */
  function snimek(jaka, max) {
    const c = document.createElement('canvas'); kresliDo(c, jaka);
    const k = Math.min(1, (max || 700) / Math.max(c.width, c.height));
    const z = document.createElement('canvas'); z.width = Math.round(c.width * k); z.height = Math.round(c.height * k);
    z.getContext('2d').drawImage(c, 0, 0, z.width, z.height);
    return z.toDataURL('image/jpeg', 0.85);
  }
  function protokolHtml() {
    const s = stav, r = s.rozbor, e = r.exif, ind = vsechnyIndicie(), v = s.vysl;
    const radek = (k, h, ne) => `<tr><th>${k}</th><td${ne ? ' data-i18n="ne"' : ''}>${h}</td></tr>`;
    const POZN_UKAZKA = 'syntetická ukázka z galerie nástroje (známá pravda)', NEDOSTUPNE = 'nedostupné';
    const rNazev = radek('Název souboru', esc(s.soubor.nazev), true);
    const rVelikost = radek('Velikost', cislo(s.soubor.velikost, 0) + ' B');
    const rFormat = radek('Formát', esc(r.typ.toUpperCase()) + (s.obraz ? `, ${s.obraz.w} × ${s.obraz.h} px` : ''));
    const rZmena = s.soubor.zmena ? radek('Datum souboru (systém)', esc(new Date(s.soubor.zmena).toLocaleString('cs-CZ')), true) : '';
    const rOtisk = radek('SHA-256', `<span class="otisk">${s.hash || NEDOSTUPNE}</span>`, !!s.hash);
    const rPozn = s.ukazka ? radek('Poznámka', POZN_UKAZKA) : '';
    const nahledEx = r.nahledBajty ? `ano (${velikost(r.nahledBajty.length)})` : 'ne';
    const rNahled = radek('Náhled v EXIF', nahledEx), rGps = e && e.poloha ? radek('GPS', `${e.poloha.lat}, ${e.poloha.lon}`, true) : '';
    const kod = r.sof ? (r.sof.progresivni ? 'progresivní' : 'baseline') : '?';
    const tabTxt = r.kvalita ? (r.kvalita.standardni ? 'standardní IJG' : 'vlastní (nestandardní)') : 'bez tabulek';
    const elaP = v && v.ela ? (v.ela.oblasti.length ? v.ela.oblasti.map(o => `oblast ${o.x}, ${o.y}, ${o.w} × ${o.h} px (q ${o.q}, ${cislo(o.pomer)}×)`).join('; ') : 'bez odlehlé oblasti') : '';
    const sumP = v ? (v.sum.oblasti.length ? v.sum.oblasti.map(o => `hladší oblast ${o.x}, ${o.y}, ${o.w} × ${o.h} px`).join('; ') : 'bez výrazně hladší oblasti') : '';
    const klonP = v ? (v.klon.nalezy.length ? v.klon.nalezy.map(k => `posun ${k.dx}, ${k.dy} px, ${k.par} shodných bloků (A ${k.zdroj.x}, ${k.zdroj.y} ↔ B ${k.cil.x}, ${k.cil.y})`).join('; ') : 'nenalezeno') : '';
    const dvojP = v && v.dvojita ? (v.dvojita.nalezena ? 'známky nalezeny' : 'nenalezena') : '';
    const nahlP = v && v.nahled ? (v.nahled.nalezena ? 'neodpovídá obrázku' : 'odpovídá') : '';
    let h = `<div class="prot"><h2>Protokol o kontrole pravosti fotografie</h2>
      <p>Vytvořeno: <span data-i18n="ne">${esc(s.cas.toLocaleString('cs-CZ'))}</span> · nástroj „Ověření pravosti fotografie“ (výpočet v prohlížeči, soubor nebyl odeslán)</p>
      <div class="upozorneni">Výsledky jsou indicie, ne důkaz. Nenalezení stop úpravy neznamená, že je fotografie pravá. Nejde o certifikovaný znalecký nástroj.</div>
      <h3>1. Zkoumaný soubor</h3><table><tbody>
      ${rNazev}${rVelikost}${rFormat}${rZmena}${rOtisk}${rPozn}</tbody></table>`;
    h += '<h3>2. Metadata</h3>';
    if (!e) h += '<p>Soubor nemá EXIF.</p>';
    else {
      const vyber = [['Make', e.ifd0], ['Model', e.ifd0], ['Software', e.ifd0], ['DateTime', e.ifd0], ['DateTimeOriginal', e.exif], ['Orientation', e.ifd0], ['PixelXDimension', e.exif], ['PixelYDimension', e.exif], ['ExposureTime', e.exif], ['FNumber', e.exif], ['ISOSpeedRatings', e.exif], ['FocalLength', e.exif]];
      h += '<table><tbody>' + vyber.filter(([k, o]) => o[k] != null).map(([k, o]) => radek(POPISKY[k] || k, esc(hodnota(k, o[k])), true)).join('')
        + rGps + rNahled + '</tbody></table>';
    }
    if (r.xmp && r.xmp.creatorTool) h += `<p>XMP CreatorTool: <span data-i18n="ne">${esc(r.xmp.creatorTool)}</span></p>`;
    if (r.typ === 'jpeg') h += `<p>Struktura JPEG: ${kod}, podvzorkování ${esc(r.podvzorkovani || '?')}, kvantizační tabulky: ${tabTxt}; odhad kvality: ${r.kvalita ? r.kvalita.kvalita : '–'}.</p><p>Markery: <span class="mono">${r.markery.map(m => m.kod).join(' ')}</span></p>`;
    h += '<h3>3. Výsledky analýz</h3>';
    if (s.verdikty) h += '<table><thead><tr><th>Analýza</th><th>Výsledek</th></tr></thead><tbody>' + Object.entries(s.verdikty).map(([k, x]) => `<tr><td>${NAZVY_ANALYZ[k]}</td><td>${VERDIKT_TXT[x]}</td></tr>`).join('') + '</tbody></table>';
    if (v) {
      if (v.ela) h += `<p>ELA: mapa v kvalitě ${v.elaMapa.kvalita}, zesílení ${nast.zesileni}×; automatické hledání v kvalitách ${v.ela.kvality.join(', ')}: ${elaP}.</p>`;
      h += `<p>Šum: medián σ ${cislo(v.sum.median, 2)}; ${sumP}.</p>`;
      h += `<p>Klonování: ${klonP}.</p>`;
      if (v.dvojita) h += `<p>Dvojitá komprese: ${dvojP} (${v.dvojita.propadu} propadů z ${v.dvojita.posuzovano} přihrádek).</p>`;
      if (v.nahled) h += `<p>Náhled EXIF: ${nahlP} (průměrná odchylka ${cislo(v.nahled.prumer)}, místní maximum ${cislo(v.nahled.lokalniMax)}).</p>`;
      const sn = [['original', 'Fotka (uložená orientace)'], ['indicie', 'Automaticky nalezené oblasti'], ['ela', `ELA, kvalita ${nast.kvalitaEla}`], ['mapaSumu', 'Mapa šumu vůči okolí']];
      if (v.klon.nalezy.length) sn.push(['klon', 'Klonování (shodné oblasti A ↔ B)']);
      if (s.ukazka) sn.push(['pravda', 'Pravda ukázky (upravená oblast)']);
      const puvodni = nast.prekryv; nast.prekryv = false;
      h += '<div class="snimky">' + sn.map(([k, popis]) => `<figure><img src="${snimek(k)}" alt=""><figcaption>${popis}</figcaption></figure>`).join('') + '</div>';
      nast.prekryv = puvodni;
    } else if (s.obraz) h += '<p>Obrazové analýzy nebyly dokončeny.</p>';
    h += `<h3>4. Indicie (${ind.length})</h3>` + (ind.length ? '<ul>' + ind.map(i => `<li><b>${VAHA[i.vaha]}:</b> ${esc(i.text)} <i>${esc(i.vysvetleni)}</i></li>`).join('') + '</ul>' : '<p>Žádné.</p>');
    if (s.varovani.length) h += '<ul>' + s.varovani.map(t => `<li>${esc(t)}</li>`).join('') + '</ul>';
    h += `<h3>5. Meze</h3><ul>
      <li>Nenalezení stop úpravy není důkaz pravosti; nalezená indicie není důkaz úpravy – každá má i nevinné vysvětlení.</li>
      <li>Sociální sítě a messengery mažou metadata a překomprimují fotky; metadata lze přepsat.</li>
      <li>ELA má mnoho falešných poplachů (hrany, textury, jednolité plochy); hladkou retuš nevidí.</li>
      <li>Obrázky vytvořené nebo dokreslené umělou inteligencí tyto metody spolehlivě neodhalí. Nástroj nedělá identifikaci fotoaparátu podle šumu senzoru (PRNU).</li>
      <li>Prahy automatických indicií byly nastaveny a ověřeny na syntetických ukázkách, ne na skutečných úpravách.</li></ul></div>`;
    return h;
  }

  /* ---------- příkazy ---------- */
  const PRIKAZY = {
    otevrit: () => $('soubor').click(),
    galerie: () => { $('dlgGalerie').showModal(); },
    protokol: () => {
      if (!stav) return;
      $('protokolNahled').innerHTML = protokolHtml();
      $('dlgProtokol').showModal();
    },
    znovu: async () => { if (stav && stav.obraz && !bezi) { bezi = analyzuj().catch(e => Dialog.chyba(e.message)).finally(() => { ukazPrubeh(null); bezi = null; vykresliPanel(); kresli(); }); } },
    napoveda: () => $('dlgNapoveda').showModal(),
    vychozi: () => { nast = Object.assign({}, VYCHOZI); ulozNast(); syncNast(); prepocitejEla(); kresli(); }
  };
  async function otevriUkazku(klic) {
    if (bezi) return;
    if ($('dlgGalerie').open) $('dlgGalerie').close();
    ukazPrubeh('Vytvářím ukázku…', 0);
    try {
      const d = await prace({ ukol: 'ukazka', klic });
      const u = d.ukazka;
      const f = new File([u.bajty], `ukazka_${klic}.jpg`, { type: 'image/jpeg', lastModified: Date.UTC(2026, 5, 20, 12) });
      await nacti(f, { klic, maska: u.maska, posun: u.posun, zdroj: u.zdroj, pravda: u.pravda });
    } catch (e) { ukazPrubeh(null); if (!e.zruseno) Dialog.chyba('Ukázku nelze vytvořit: ' + e.message); }
  }

  /* ---------- nabídky, ovládání ---------- */
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
    const p = e.target.closest('[data-prikaz]');
    if (p) { e.preventDefault(); zavriNabidky(); return PRIKAZY[p.dataset.prikaz](); }
    if (e.target.closest('[data-metoda]')) zavriNabidky();
    const u = e.target.closest('[data-ukazka]');
    if (u) return otevriUkazku(u.dataset.ukazka);
    const vr = e.target.closest('[data-vrstva],[data-zobraz]');
    if (vr) { vrstva = vr.dataset.vrstva || vr.dataset.zobraz; kresli(); if (vr.dataset.zobraz && innerWidth <= 900) $('prohlizec').scrollIntoView({ behavior: 'smooth' }); return; }
    const z = e.target.closest('[data-zal]');
    if (z) { zalozka = z.dataset.zal; vykresliPanel(); return; }
    if (!e.target.closest('.nabidka')) zavriNabidky();
  });
  $('prubehZrusit').addEventListener('click', zrusVypocet);
  $('soubor').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) nacti(f, null); });
  // přetažení souboru
  let tah = 0;
  document.addEventListener('dragenter', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { tah++; document.body.classList.add('tahne'); } });
  document.addEventListener('dragleave', () => { if (--tah <= 0) { tah = 0; document.body.classList.remove('tahne'); } });
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => { e.preventDefault(); tah = 0; document.body.classList.remove('tahne'); const f = e.dataTransfer.files[0]; if (f) nacti(f, null); });

  // nastavení
  function syncNast() {
    $('kvalitaEla').value = nast.kvalitaEla; $('kvalitaHod').textContent = nast.kvalitaEla;
    $('zesileni').value = nast.zesileni; $('zesileniHod').textContent = nast.zesileni + '×';
    $('prekryv').checked = !!nast.prekryv; $('kryti').value = nast.kryti; $('krytiHod').textContent = nast.kryti + ' %';
  }
  let casovac = null;
  function zmenaNast(klic, hodnota) {
    nast[klic] = hodnota; ulozNast(); syncNast();
    if (klic === 'kvalitaEla') { clearTimeout(casovac); casovac = setTimeout(() => { if (vrstva !== 'ela') vrstva = 'ela'; prepocitejEla(); }, 250); }
    else { if (klic === 'zesileni' && vrstva !== 'ela') vrstva = 'ela'; kresli(); }
  }
  $('kvalitaEla').addEventListener('input', e => zmenaNast('kvalitaEla', +e.target.value));
  $('zesileni').addEventListener('input', e => zmenaNast('zesileni', +e.target.value));
  $('prekryv').addEventListener('change', e => zmenaNast('prekryv', e.target.checked));
  $('kryti').addEventListener('input', e => zmenaNast('kryti', +e.target.value));
  $('panelTelo').addEventListener('input', e => {
    const k = e.target.dataset.nast; if (!k) return;
    e.target.nextElementSibling.textContent = e.target.value + (k === 'zesileni' ? '×' : '');
    zmenaNast(k, +e.target.value);
  });

  $('protokolTisk').addEventListener('click', () => { $('tisk').innerHTML = $('protokolNahled').innerHTML; print(); });
  $('protokolUlozit').addEventListener('click', () => {
    const styl = [...document.styleSheets].map(ss => { try { return [...ss.cssRules].map(r => r.cssText).filter(t => /\.prot|:root|\[data-theme/.test(t)).join('\n'); } catch (e) { return ''; } }).join('\n');
    const html = `<!DOCTYPE html><html lang="cs"><head><meta charset="UTF-8"><title>Protokol – ${esc(stav.soubor.nazev)}</title><style>${styl}body{max-width:900px;margin:20px auto;padding:0 12px;background:var(--bg,#fff)}</style></head><body>${$('protokolNahled').innerHTML}</body></html>`;
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    a.download = 'protokol_' + stav.soubor.nazev.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_') + '.html'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') zavriNabidky();
    if (e.target.closest('input,textarea,select') || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
    const k = e.key.toLowerCase();
    if (k === 'o') PRIKAZY.otevrit();
    else if (k === 'g') PRIKAZY.galerie();
    else if (k === 'p') PRIKAZY.protokol();
    else if (/^[1-6]$/.test(k) && stav) { vrstva = ['original', 'indicie', 'ela', 'rezidual', 'mapaSumu', 'klon'][+k - 1]; kresli(); }
  });

  /* ---------- galerie ---------- */
  $('galerie').innerHTML = P.UKAZKY.map(u => `<div class="uk"><h3>${esc(u.nazev)}</h3><div class="co">${esc(u.popis)}</div><div class="najde">${esc(u.co)}</div>
    <button class="btn primary" type="button" data-ukazka="${u.klic}">Otevřít ukázku</button></div>`).join('');
  $('uvodUkazky').innerHTML = P.UKAZKY.map(u => `<button class="btn" type="button" data-ukazka="${u.klic}">🧪 ${esc(u.nazev)}</button>`).join('');

  syncNast();
  vykresliPanel();
  window.PRAVOST_APP = { stav: () => stav, nacti, otevriUkazku, PRIKAZY, bezi: () => bezi, vrstva: v => { if (v) { vrstva = v; kresli(); } return vrstva; }, zalozka: z => { zalozka = z; vykresliPanel(); }, protokolHtml };
})();
