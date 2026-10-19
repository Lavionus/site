/* ============================================================
   mapa_souvislosti/ui_nastroje.js – nástroje editoru:
   import/export (JSON, SVG, PNG, formáty z formaty.js), sdílení odkazem, tisk,
   minimapa, paleta příkazů, prezentace, Wikipedie, obrázky uzlů, verze mapy.
   Na konci spouští aplikaci (A.start()).
   ============================================================ */
(function () {
  'use strict';
  const A = window.MapaApp, J = A.J, $ = A.$, esc = A.esc;
  const F = () => window.MapaFormaty;

  /* ================= soubory ================= */
  function stahni(obsah, nazev, mime) {
    const blob = obsah instanceof Blob ? obsah : new Blob([obsah], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function jmenoSouboru(pripona) {
    const z = J.bezDiakritiky(A.mapa.nazev).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mapa';
    return z.slice(0, 60) + (pripona.indexOf('.') === 0 ? pripona : '.' + pripona);
  }

  /* ================= SVG / PNG ================= */
  const PALETY = {
    svetle: { pozadi: '#ffffff', panel: '#ffffff', text: '#24292f', tlumeny: '#4b535b', hrana: '#6e7781', stitekPozadi: '#ffffff', odkaz: '#2862bb' },
    tmave: { pozadi: '#121212', panel: '#242424', text: '#e0e0e0', tlumeny: '#b0b0b0', hrana: '#8a8a8a', stitekPozadi: '#121212', odkaz: '#6aa6fd' }
  };
  function barvyExportu() {
    const v = $('exportBarvy').value;
    if (v !== 'tema') return PALETY[v];
    const cs = getComputedStyle(document.documentElement);
    const g = n => cs.getPropertyValue(n).trim();
    return { pozadi: g('--bg-deep'), panel: g('--bg-panel'), text: g('--text'), tlumeny: g('--text-muted'), hrana: g('--text-faint'), stitekPozadi: g('--bg-deep'), odkaz: g('--accent') };
  }
  /* uzly do exportu: výběr, nebo co je vidět (filtry) */
  function uzlyExportu() {
    if ($('exportVybrane').checked && A.vybUzly.size) return [...A.vybUzly];
    return A.filtrAktivni() && A.filtr.rezim === 'skryt' ? A.mapa.uzly.filter(A.prosel).map(u => u.id) : null;
  }
  /* obrázky z webu se do souboru vloží jako data URL (jinak by PNG nešlo vytvořit a SVG by nebylo samostatné) */
  const cacheDat = new Map();
  async function pripravObrazky(ids) {
    const s = ids ? new Set(ids) : null;
    const urls = [...new Set(A.mapa.uzly.filter(u => u.rozbaleny && u.obrazek && /^https?:/.test(u.obrazek) && (!s || s.has(u.id))).map(u => u.obrazek))];
    const vysl = new Map();
    await Promise.all(urls.map(async url => {
      if (cacheDat.has(url)) { if (cacheDat.get(url)) vysl.set(url, cacheDat.get(url)); return; }
      try {
        const r = await fetch(url, { mode: 'cors' });
        if (!r.ok) throw new Error(r.status);
        const b = await r.blob();
        const d = await new Promise((ok, chyba) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = chyba; fr.readAsDataURL(b); });
        cacheDat.set(url, d); vysl.set(url, d);
      } catch (e) { cacheDat.set(url, null); }
    }));
    return vysl;
  }
  function meritkaAPomery() {
    const meritka = new Map(), pomery = new Map();
    for (const u of A.mapa.uzly) {
      const g = A.geo.get(u.id);
      if (g) meritka.set(u.id, g.k);
      if (u.obrazek) pomery.set(u.id, A.pomery.get(u.obrazek) || 0);
    }
    return { meritka, pomery };
  }
  function svgText(obrazky, bezCizich) {
    const jen = uzlyExportu();
    const { meritka, pomery } = meritkaAPomery();
    let m = A.mapa;
    if (bezCizich) {
      /* obrázky, které nešlo stáhnout, vynechat (cizí obrázek by „zašpinil“ plátno PNG) */
      m = Object.assign({}, m, { uzly: m.uzly.map(u => (u.obrazek && /^https?:/.test(u.obrazek) && !(obrazky && obrazky.get(u.obrazek))) ? Object.assign({}, u, { obrazek: '' }) : u) });
    }
    /* barvy podle komunit / metrik se do exportu přenesou */
    if (A.nastaveni.barvaPodle && A.nastaveni.barvaPodle !== 'typ') m = Object.assign({}, m, { uzly: m.uzly.map(u => Object.assign({}, u, { barva: A.barvaUzlu(u) })) });
    return J.exportSVG(m, A.mer, { barvy: barvyExportu(), pismo: A.PISMO, jen, legenda: $('exportLegenda').checked, meritka, pomery, obrazky });
  }
  async function exportPNG() {
    const obr = await pripravObrazky(uzlyExportu());
    const s = svgText(obr, true);
    const img = new Image();
    const url = URL.createObjectURL(new Blob([s], { type: 'image/svg+xml' }));
    img.onload = () => {
      const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      const k = Math.max(0.25, Math.min(2, 12000 / Math.max(w, h), Math.sqrt(60e6 / (w * h))));
      const c = document.createElement('canvas');
      c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      try {
        c.toBlob(b => { if (b) stahni(b, jmenoSouboru('png')); else Dialog.chyba('PNG se nepodařilo vytvořit (obrázek je příliš velký).'); }, 'image/png');
      } catch (e) { Dialog.chyba('PNG se nepodařilo vytvořit: ' + e.message); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); Dialog.chyba('PNG se nepodařilo vytvořit.'); };
    img.src = url;
  }
  async function tisk() {
    const obr = await pripravObrazky(uzlyExportu());
    const s = svgText(obr, false).replace(/^<\?xml[^>]*>\s*/, '');
    const okno = window.open('', '_blank');
    if (!okno) { Dialog.chyba('Prohlížeč zablokoval nové okno. Povolte vyskakovací okna, nebo použijte export SVG/PNG.'); return; }
    okno.document.write('<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>' + esc(A.mapa.nazev) + '</title>' +
      '<style>@page{size:landscape;margin:10mm}html,body{margin:0;background:#fff}svg{width:100%;height:auto;max-height:100vh;display:block}</style></head><body>' + s +
      '<script>window.onload=function(){setTimeout(function(){window.print()},200)}<\/script></body></html>');
    okno.document.close();
  }

  async function exportuj(druh) {
    const m = A.mapa;
    if (druh === 'json') { stahni(J.naJSON(m), jmenoSouboru('json'), 'application/json'); return; }
    if (druh === 'text') { stahni(J.naText(m), jmenoSouboru('txt'), 'text/plain;charset=utf-8'); return; }
    if (druh === 'odkaz') { sdilej(); return; }
    if (!m.uzly.length) { Dialog.chyba('Mapa je prázdná.'); return; }
    if (druh === 'svg') { const obr = await pripravObrazky(uzlyExportu()); stahni(svgText(obr, false), jmenoSouboru('svg'), 'image/svg+xml'); return; }
    if (druh === 'png') { exportPNG(); return; }
    if (druh === 'tisk') { tisk(); return; }
    const f = F() && F().FORMATY.find(x => x.id === druh);
    if (!f) return;
    try {
      if (druh === 'csv') {
        const v = F().doCSV(m, { oddelovac: ';' });
        stahni(v.uzly, jmenoSouboru('-uzly.csv'), f.mime || 'text/csv;charset=utf-8');
        setTimeout(() => stahni(v.hrany, jmenoSouboru('-vztahy.csv'), f.mime || 'text/csv;charset=utf-8'), 400);
        return;
      }
      const fn = F()[{ graphml: 'doGraphML', gexf: 'doGEXF', dot: 'doDOT', mermaid: 'doMermaid', markdown: 'doMarkdown', md: 'doMarkdown' }[druh]];
      if (!fn) { Dialog.chyba('Formát není k dispozici.'); return; }
      stahni(fn(m), jmenoSouboru(f.pripona || druh), f.mime || 'text/plain;charset=utf-8');
    } catch (e) { Dialog.chyba('Export se nezdařil: ' + e.message); }
  }

  /* položky menu Export: vlastní + formáty z formaty.js */
  function vykresliMenuExportu() {
    const zakl = [['json', '{ } JSON – celá mapa (záloha)'], ['svg', '🖼 SVG – vektorový obrázek'], ['png', '🖼 PNG – obrázek'], ['tisk', '🖨 Tisk / PDF']];
    const dalsi = F() ? F().FORMATY.filter(f => ['json', 'svg', 'png'].indexOf(f.id) < 0) : [];
    $('exportPolozky').innerHTML = zakl.map(([id, t]) => '<button data-export="' + id + '">' + t + '</button>').join('') +
      '<button data-export="odkaz">🔗 Odkaz ke sdílení</button>' +
      '<div class="nadpis">Další formáty</div>' +
      dalsi.map(f => '<button data-export="' + esc(f.id) + '" title="' + esc(f.popis || '') + '">' + esc(f.nazev) + '</button>').join('') +
      '<button data-export="text">📝 Text (rychlé zadání)</button>';
  }
  $('menuExport').addEventListener('click', e => { const b = e.target.closest('button[data-export]'); if (b) { A.zavriMenu(); exportuj(b.dataset.export); } });

  /* ================= import ================= */
  const jeSoubor = t => /^\s*[{[<]/.test(t) || /^\s*(strict\s+)?(di)?graph\b/i.test(t);
  async function importujText(text, nazevSouboru) {
    const t = String(text).replace(/^﻿/, '');
    if (!t.trim()) return;
    let data = null, varovani = [], format = 'text';
    try {
      if (F() && F().rozpoznej) {
        const r = F().rozpoznej(t, nazevSouboru || '');
        format = r.format; varovani = r.varovani || [];
        if (r.data) data = r.data;
      } else if (/^\s*[{[]/.test(t)) format = 'json';
      if (format === 'json') { const j = JSON.parse(t); data = Array.isArray(j) ? { nodes: j } : j; }
    } catch (e) { Dialog.chyba('Soubor se nepodařilo přečíst: ' + e.message); return; }
    let m;
    if (data) {
      let r;
      try { r = J.nactiData(data); } catch (e) { Dialog.chyba(e.message); return; }
      m = r.mapa; varovani = varovani.concat(r.varovani);
      if (nazevSouboru && (!m.nazev || m.nazev === 'Importovaná mapa')) m.nazev = nazevSouboru.replace(/\.[^.]+$/, '');
    } else {
      const r = J.parsujText(t);
      if (!r.mapa.uzly.length) { Dialog.chyba('V textu nejsou žádné uzly.'); return; }
      m = r.mapa; varovani = r.chyby;
      if (nazevSouboru) m.nazev = nazevSouboru.replace(/\.[^.]+$/, '');
    }
    /* uzly bez pozic rozmístit */
    if (m.uzly.some(u => !isFinite(u.x) || !isFinite(u.y))) {
      const bez = m.uzly.every(u => !isFinite(u.x) || !isFinite(u.y));
      const g = new Map(m.uzly.map(u => [u.id, J.geometrieUzlu(m, u, A.mer, {})]));
      if (bez) (window.MapaRozlozeni ? window.MapaRozlozeni.rozmistiSilove : J.rozmistiSilove)(m, g, { iterace: 400 });
    }
    A.vlozNovouMapu(m);
    Dialog.info('Načteno (' + format.toUpperCase() + '): ' + m.uzly.length + ' uzlů, ' + m.hrany.length + ' vztahů' + (varovani.length ? '\n' + varovani.slice(0, 5).join('\n') : ''));
  }
  $('tlImport').onclick = () => $('soubor').click();
  $('soubor').onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    importujText(await f.text(), f.name);
    e.target.value = '';
  };
  const obalPlatna = $('platnoObal');
  obalPlatna.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); obalPlatna.classList.add('pretahovani'); } });
  obalPlatna.addEventListener('dragleave', () => obalPlatna.classList.remove('pretahovani'));
  obalPlatna.addEventListener('drop', async e => {
    e.preventDefault(); obalPlatna.classList.remove('pretahovani');
    const f = e.dataTransfer.files[0];
    if (!f) return;
    if (/^image\//.test(f.type) && A.vybUzly.size === 1) { nastavObrazekZeSouboru(J.najdiUzel(A.mapa, [...A.vybUzly][0]), f); return; }
    importujText(await f.text(), f.name);
  });

  /* ================= sdílení odkazem ================= */
  async function sdilej() {
    if (!F() || !F().zakodujOdkaz) { Dialog.chyba('Sdílení odkazem není k dispozici.'); return; }
    try {
      const r = await F().zakodujOdkaz(A.mapa);
      const url = location.href.split('#')[0] + '#m=' + r.kod;
      try { await navigator.clipboard.writeText(url); } catch (e) { /* nic */ }
      let pozn = 'Odkaz obsahuje celou mapu (' + r.delka.toLocaleString('cs-CZ') + ' znaků) a je zkopírovaný do schránky.';
      if (r.vynechanoObrazku) pozn += ' Vložené obrázky (' + r.vynechanoObrazku + ') se do odkazu nevejdou – pro ně použijte export JSON.';
      if (r.delka > 30000) pozn += ' Pozor: takhle dlouhý odkaz některé aplikace (e-mail, chat) zkrátí.';
      await Dialog.zeptej(pozn, url);
    } catch (e) { Dialog.chyba('Odkaz se nepodařilo vytvořit: ' + e.message); }
  }
  async function zpracujOdkaz() {
    const h = location.hash;
    if (!/^#m=/.test(h)) return false;
    try {
      const data = await F().dekodujOdkaz(h.slice(3));
      const r = J.nactiData(data);
      r.mapa.nazev = r.mapa.nazev || 'Sdílená mapa';
      A.vlozNovouMapu(r.mapa);
      Dialog.info('Otevřena sdílená mapa „' + r.mapa.nazev + '“ – uložila se mezi vaše mapy.');
    } catch (e) { Dialog.chyba('Odkaz na mapu je poškozený nebo neúplný: ' + e.message); }
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* nic */ }
    return true;
  }

  /* odkaz vložený do adresy otevřené stránky (bez znovunačtení) */
  window.addEventListener('hashchange', () => { if (/^#m=/.test(location.hash)) zpracujOdkaz(); });

  /* ================= obrázky uzlů ================= */
  function nahrajObrazek(u) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = () => { if (inp.files[0]) nastavObrazekZeSouboru(u, inp.files[0]); };
    inp.click();
  }
  /* zmenší obrázek na nejvýš 480 px (WebP, jinak JPEG), ať se mapa vejde do úložiště */
  function nastavObrazekZeSouboru(u, soubor) {
    const url = URL.createObjectURL(soubor);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 480 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let d = c.toDataURL('image/webp', 0.82);
      if (!/^data:image\/webp/.test(d)) d = c.toDataURL('image/jpeg', 0.85);
      if (!J.jeObrazek(d)) { Dialog.chyba('Obrázek je i po zmenšení příliš velký.'); return; }
      A.zaloha(); u.obrazek = d; u.rozbaleny = true; A.pomery.set(d, c.width / c.height);
      A.uvolniMisto([u.id]);
      Dialog.info('Obrázek vložen (' + Math.round(d.length / 1024) + ' kB)');
    };
    img.onerror = () => { URL.revokeObjectURL(url); Dialog.chyba('Soubor není obrázek, který prohlížeč umí přečíst.'); };
    img.src = url;
  }

  /* ================= Wikipedie ================= */
  async function wikiJSON(url) {
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
    return r.json();
  }
  async function wikipedie(u) {
    const tl = $('dWiki');
    if (tl) { tl.disabled = true; tl.textContent = '⏳ Hledám…'; }
    try {
      let vysledky = [];
      for (const jazyk of ['cs', 'en']) {
        const d = await wikiJSON('https://' + jazyk + '.wikipedia.org/w/api.php?action=query&list=search&srlimit=6&format=json&origin=*&srsearch=' + encodeURIComponent(u.nazev));
        vysledky = ((d.query && d.query.search) || []).map(x => ({ jazyk, nazev: x.title, ukazka: x.snippet.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&') }));
        if (vysledky.length) break;
      }
      if (!vysledky.length) { Dialog.info('Na Wikipedii jsem k „' + u.nazev + '“ nic nenašel.'); return; }
      const volba = await vyberZeSeznamu('Který článek o „' + u.nazev + '“?', vysledky.map(v => ({ titulek: v.nazev + ' (' + v.jazyk + ')', popis: v.ukazka })));
      if (volba == null) return;
      const v = vysledky[volba];
      const s = await wikiJSON('https://' + v.jazyk + '.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(v.nazev.replace(/ /g, '_')));
      const extract = (s.extract || '').trim();
      const obr = s.thumbnail && s.thumbnail.source && J.jeObrazek(s.thumbnail.source) ? s.thumbnail.source : '';
      const odkaz = s.content_urls && s.content_urls.desktop ? s.content_urls.desktop.page : '';
      const co = [extract && 'popis', obr && 'obrázek', odkaz && 'odkaz', s.description && 'vlastnost „Wikipedie“'].filter(Boolean).join(', ');
      if (!await Dialog.potvrd('Doplnit z článku „' + s.title + '“: ' + co + '?' + (u.popis && extract ? '\nStávající popis se nahradí.' : '') + '\n\n' + extract.slice(0, 300) + (extract.length > 300 ? '…' : '') + '\n\nText: Wikipedie, CC BY-SA 4.0.')) return;
      A.zaloha();
      if (extract) u.popis = extract;
      if (obr) u.obrazek = obr;
      if (odkaz) u.odkaz = odkaz;
      if (s.description && !u.atributy.some(a => a[0] === 'Wikipedie')) u.atributy.push(['Wikipedie', s.description]);
      u.rozbaleny = true;
      A.uvolniMisto([u.id]);
    } catch (e) {
      Dialog.chyba('Wikipedie není dostupná (' + (e.message || e) + '). Jste připojeni k internetu?');
    } finally {
      const t2 = $('dWiki');
      if (t2) { t2.disabled = false; t2.textContent = '📖 Doplnit z Wikipedie'; }
    }
  }
  /* malý výběrový dialog (položky jako tlačítka) → index nebo null */
  function vyberZeSeznamu(otazka, polozky) {
    return new Promise(ok => {
      const d = document.createElement('dialog');
      d.className = 'vyber-dialog';
      d.innerHTML = '<div class="vd-telo"><b>' + esc(otazka) + '</b><div class="vd-seznam">' +
        polozky.map((p, i) => '<button data-i="' + i + '"><b>' + esc(p.titulek) + '</b><span>' + esc(p.popis || '') + '</span></button>').join('') +
        '</div><div class="radek" style="justify-content:flex-end"><button data-zrus>Zrušit</button></div></div>';
      document.body.appendChild(d);
      const konec = v => { d.close(); d.remove(); ok(v); };
      d.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (b && b.dataset.i != null) konec(+b.dataset.i);
        else if (b && b.hasAttribute('data-zrus')) konec(null);
        else if (e.target === d) konec(null);
      });
      d.addEventListener('cancel', e => { e.preventDefault(); konec(null); });
      d.showModal();
      const prvni = d.querySelector('[data-i]'); if (prvni) prvni.focus();
    });
  }

  /* ================= verze ================= */
  const klicVerzi = () => A.KLIC + '_verze_' + A.idMapy;
  function nactiVerze() { try { return JSON.parse(localStorage.getItem(klicVerzi()) || '[]'); } catch (e) { return []; } }
  function ulozVerze(v) {
    try { localStorage.setItem(klicVerzi(), JSON.stringify(v)); return true; }
    catch (e) { Dialog.chyba('Verzi nelze uložit – úložiště prohlížeče je plné. Smažte staré verze nebo exportujte JSON.'); return false; }
  }
  async function ulozVerzi(pozn) {
    if (pozn == null) pozn = await Dialog.zeptej('Poznámka k verzi', 'Verze ' + new Date().toLocaleString('cs-CZ'));
    if (pozn == null) return;
    const v = nactiVerze();
    v.unshift({ cas: Date.now(), poznamka: pozn.trim(), uzlu: A.mapa.uzly.length, hran: A.mapa.hrany.length, data: JSON.parse(J.naJSON(A.mapa)) });
    if (v.length > 30) v.length = 30;
    if (ulozVerze(v)) { Dialog.info('Verze uložena'); A.vykresliPanely(); }
  }
  function rozdil(data) {
    const nyni = new Set(A.mapa.uzly.map(u => u.id)), tehdy = new Set(data.uzly.map(u => u.id));
    let plus = 0, minus = 0;
    for (const id of nyni) if (!tehdy.has(id)) plus++;
    for (const id of tehdy) if (!nyni.has(id)) minus++;
    return { plus, minus };
  }
  function kresliVerze(el) {
    if (!el) return;
    const v = nactiVerze();
    el.innerHTML = '<div class="napoveda">Pojmenovaný snímek mapy, ke kterému se můžete vrátit (ukládá se v prohlížeči, nejvýš 30).</div>' +
      '<div class="radek"><button id="vUlozit" class="hlavni">💾 Uložit verzi</button></div>' +
      (v.length ? '<div class="seznam verze">' + v.map((x, i) => {
        const r = rozdil(x.data);
        return '<div class="verze-radek"><div><b>' + esc(x.poznamka || 'bez poznámky') + '</b><br><span class="popisek">' + new Date(x.cas).toLocaleString('cs-CZ') + ' · ' + x.uzlu + ' uzlů, ' + x.hran + ' vztahů' +
          (r.plus || r.minus ? ' · od té doby +' + r.plus + ' / −' + r.minus + ' uzlů' : '') + '</span></div>' +
          '<button data-obnov="' + i + '" title="Obnovit tuto verzi (jde vrátit přes Zpět)">↺</button><button class="ikona nebezpeci" data-smazv="' + i + '" title="Smazat verzi">✕</button></div>';
      }).join('') + '</div>' : '<div class="popisek">Zatím žádná uložená verze.</div>');
    $('vUlozit').onclick = () => ulozVerzi();
    for (const b of el.querySelectorAll('[data-obnov]')) b.onclick = async () => {
      const x = v[+b.dataset.obnov];
      if (!await Dialog.potvrd('Obnovit verzi „' + (x.poznamka || '') + '“? Současný stav půjde vrátit tlačítkem Zpět.')) return;
      A.nahradMapu(J.nactiData(x.data).mapa);
      A.prizpusobit();
    };
    for (const b of el.querySelectorAll('[data-smazv]')) b.onclick = () => { v.splice(+b.dataset.smazv, 1); ulozVerze(v); kresliVerze(el); };
  }

  /* ================= minimapa ================= */
  const mini = $('minimapa');
  const minimapa = {
    meritko: null,
    kresli() {
      const m = A.mapa;
      const zobraz = A.nastaveni.minimapa && m && m.uzly.length > 1;
      mini.hidden = !zobraz;
      if (!zobraz) return;
      if (this._ceka) return;
      this._ceka = true;
      requestAnimationFrame(() => { this._ceka = false; this._kresli(); });
    },
    _kresli() {
      const m = A.mapa, geo = A.geo;
      if (!m) return;
      const W = mini.clientWidth || 200, H = mini.clientHeight || 130, dpr = window.devicePixelRatio || 1;
      if (mini.width !== W * dpr) { mini.width = W * dpr; mini.height = H * dpr; }
      const c = mini.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, W, H);
      const ob = J.obal(m, geo, m.uzly.filter(A.viditelny).map(u => u.id));
      const v = A.vyrez(0);
      const x1 = Math.min(ob.x, v.x1), y1 = Math.min(ob.y, v.y1), x2 = Math.max(ob.x + ob.w, v.x2), y2 = Math.max(ob.y + ob.h, v.y2);
      const k = Math.min((W - 10) / (x2 - x1 || 1), (H - 10) / (y2 - y1 || 1));
      const ox = (W - (x2 - x1) * k) / 2 - x1 * k, oy = (H - (y2 - y1) * k) / 2 - y1 * k;
      this.meritko = { k, ox, oy };
      const cs = getComputedStyle(document.documentElement);
      c.fillStyle = cs.getPropertyValue('--bg-panel').trim() || '#242424';
      c.globalAlpha = 0.92; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
      c.strokeStyle = cs.getPropertyValue('--text-faint').trim() || '#999';
      c.globalAlpha = 0.35; c.lineWidth = 0.7;
      c.beginPath();
      const uz = new Map(m.uzly.map(u => [u.id, u]));
      for (const h of m.hrany) {
        const a = uz.get(h.od), b = uz.get(h.do);
        if (!a || !b || !A.viditelny(a) || !A.viditelny(b)) continue;
        c.moveTo(a.x * k + ox, a.y * k + oy); c.lineTo(b.x * k + ox, b.y * k + oy);
      }
      c.stroke(); c.globalAlpha = 1;
      for (const u of m.uzly) {
        if (!A.viditelny(u)) continue;
        const g = geo.get(u.id); if (!g) continue;
        c.fillStyle = A.barvaUzlu(u);
        c.fillRect((u.x - g.w / 2) * k + ox, (u.y - g.h / 2) * k + oy, Math.max(2, g.w * k), Math.max(1.5, g.h * k));
      }
      c.strokeStyle = cs.getPropertyValue('--accent').trim() || '#6aa6fd';
      c.lineWidth = 1.5;
      c.strokeRect(v.x1 * k + ox, v.y1 * k + oy, (v.x2 - v.x1) * k, (v.y2 - v.y1) * k);
    }
  };
  A.minimapa = minimapa;
  let tahMini = false;
  function presunNaMinimapu(e) {
    const mm = minimapa.meritko;
    if (!mm) return;
    const r = mini.getBoundingClientRect();
    const wx = (e.clientX - r.left - mm.ox) / mm.k, wy = (e.clientY - r.top - mm.oy) / mm.k;
    const s = $('platno').getBoundingClientRect();
    const p = A.pohled;
    A.pohled = { z: p.z, x: s.width / 2 - wx * p.z, y: s.height / 2 - wy * p.z };
  }
  mini.addEventListener('pointerdown', e => { tahMini = true; try { mini.setPointerCapture(e.pointerId); } catch (err) { /* nic */ } presunNaMinimapu(e); e.preventDefault(); });
  mini.addEventListener('pointermove', e => { if (tahMini) presunNaMinimapu(e); });
  mini.addEventListener('pointerup', () => { tahMini = false; A.ulozPozdeji(); A.prekresli(); });

  /* ================= prezentace ================= */
  let prez = null;   /* {pribeh, i} */
  const prezentace = {
    bezi: () => !!prez,
    aktualni: () => prez ? prez.pribeh.kroky[prez.i] : null,
    start(pid, i) {
      const p = (A.mapa.pribehy || []).find(x => x.id === pid);
      if (!p || !p.kroky.length) return;
      A.zrusRezim();
      prez = { pribeh: p, i: Math.max(0, Math.min(p.kroky.length - 1, i || 0)) };
      document.body.classList.add('prezentuje');
      $('prezentace').hidden = false;
      this.ukaz();
    },
    ukaz() {
      const k = this.aktualni();
      if (!k) return;
      const ids = k.uzly.filter(id => J.najdiUzel(A.mapa, id));
      $('prTitulek').textContent = k.titulek || prez.pribeh.nazev;
      $('prPoznamka').textContent = k.poznamka || '';
      $('prPoznamka').hidden = !k.poznamka;
      $('prPocet').textContent = (prez.i + 1) + ' / ' + prez.pribeh.kroky.length;
      $('prZpet').disabled = prez.i === 0;
      $('prDal').textContent = prez.i === prez.pribeh.kroky.length - 1 ? 'Konec ✓' : 'Další ▶';
      A.vyber([], []);
      requestAnimationFrame(() => A.preletNa(A.cilPohledu(ids.length ? ids : null, 1.6), 600));
    },
    dalsi() { if (!prez) return; if (prez.i < prez.pribeh.kroky.length - 1) { prez.i++; this.ukaz(); } else this.konec(); },
    predchozi() { if (prez && prez.i > 0) { prez.i--; this.ukaz(); } },
    konec() {
      prez = null;
      document.body.classList.remove('prezentuje');
      $('prezentace').hidden = true;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      A.prekresli();
    },
    celaObrazovka() {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else if (obalPlatna.requestFullscreen) obalPlatna.requestFullscreen().catch(() => Dialog.info('Celá obrazovka není v tomto okně povolená.'));
    }
  };
  A.prezentace = prezentace;
  $('prZpet').onclick = () => prezentace.predchozi();
  $('prDal').onclick = () => prezentace.dalsi();
  $('prKonec').onclick = () => prezentace.konec();
  $('prCela').onclick = () => prezentace.celaObrazovka();
  document.addEventListener('fullscreenchange', () => setTimeout(() => { A.aplikujPohled(); if (prez) prezentace.ukaz(); }, 80));

  function pribehZCesty(c) {
    const m = A.mapa;
    const nazev = u => (J.najdiUzel(m, u) || {}).nazev || '?';
    const kroky = c.uzly.map((id, i) => {
      const h = i < c.hrany.length ? J.najdiHranu(m, c.hrany[i]) : null;
      const dalsi = i < c.uzly.length - 1 ? c.uzly[i + 1] : null;
      return { titulek: nazev(id), poznamka: h && dalsi ? '→ ' + (J.stitekHrany(m, h) || 'souvisí s') + ' → ' + nazev(dalsi) : (J.najdiUzel(m, id).popis || '').split('\n')[0].slice(0, 300), uzly: dalsi ? [id, dalsi] : [id] };
    });
    kroky.unshift({ titulek: 'Od „' + nazev(c.uzly[0]) + '“ k „' + nazev(c.uzly[c.uzly.length - 1]) + '“', poznamka: c.hrany.length + ' kroků', uzly: c.uzly.slice() });
    A.prepniZalozku('pribeh');
    if (A.novyPribeh) A.novyPribeh('Cesta: ' + nazev(c.uzly[0]) + ' → ' + nazev(c.uzly[c.uzly.length - 1]), kroky);
  }

  /* ================= paleta příkazů ================= */
  const dlg = $('paleta'), vstup = $('paletaVstup'), seznamP = $('paletaSeznam');
  let polozkyP = [], indexP = 0;
  function prikazy() {
    const m = A.mapa, n = A.nastaveni;
    const p = [
      ['Nový uzel', 'N', () => A.novyUzel()],
      ['Spojovat uzly kliknutím', 'L', () => A.nastavRezimSpojit(true)],
      ['Nová souvislost z vybraného uzlu', 'Tab', () => A.vybUzly.size === 1 && A.pridejSouvislost([...A.vybUzly][0])],
      ['Smazat vybrané', 'Del', () => A.smazVybrane()],
      ['Seskupit vybrané', 'Ctrl+G', () => A.vybUzly.size && A.seskupit([...A.vybUzly])],
      ['Vybrat vše', 'Ctrl+A', () => A.vyber(m.uzly.filter(A.viditelny).map(u => u.id), [])],
      ['Zpět', 'Ctrl+Z', () => A.krokZpet()],
      ['Znovu', 'Ctrl+Y', () => A.krokZnovu()],
      ['Celá mapa (přizpůsobit)', 'F', () => A.prizpusobit()],
      ['Rozbalit všechny uzly', '', () => { A.zaloha(); for (const u of m.uzly) u.rozbaleny = true; A.uvolniMisto([]); }],
      ['Sbalit všechny uzly', '', () => { A.zaloha(); for (const u of m.uzly) u.rozbaleny = false; A.zmena(); }],
      ['Rozmístit: silově', '', () => A.rozmisti('silove')],
      ['Rozmístit: hierarchicky shora dolů', '', () => A.rozmisti('hierarchicky')],
      ['Rozmístit: hierarchicky zleva doprava', '', () => A.rozmisti('hierarchickyVodorovne')],
      ['Rozmístit: strom od vybraného', '', () => A.rozmisti('strom')],
      ['Rozmístit: radiální strom', '', () => A.rozmisti('radialni')],
      ['Rozmístit: časová osa', '', () => A.rozmisti('casove')],
      ['Rozmístit: kruhově kolem vybraného', '', () => A.rozmisti('kruhove')],
      ['Rozmístit: mřížka podle typu', '', () => A.rozmisti('mrizka')],
      ['Rozmístit: setřást oddělené části k sobě', '', () => A.rozmisti('zabalit')],
      [(n.minimapa ? 'Skrýt' : 'Zobrazit') + ' minimapu', 'M', () => { n.minimapa = !n.minimapa; A.ulozNastaveni(); $('chMinimapa').checked = n.minimapa; minimapa.kresli(); }],
      ['Přichytávání k mřížce ' + (n.mrizka ? 'vypnout' : 'zapnout'), 'G', () => { n.mrizka = !n.mrizka; A.ulozNastaveni(); $('chMrizka').checked = n.mrizka; }],
      ['Popisky vztahů ' + (n.stitky ? 'skrýt' : 'zobrazit'), '', () => { n.stitky = !n.stitky; A.ulozNastaveni(); $('chStitky').checked = n.stitky; A.prekresli(); }],
      ['Barvy podle komunit (témat)', '', () => { n.barvaPodle = 'komunita'; A.ulozNastaveni(); A.prekresli(); A.vykresliPanely(); }],
      ['Barvy podle typu', '', () => { n.barvaPodle = 'typ'; A.ulozNastaveni(); A.prekresli(); A.vykresliPanely(); }],
      ['Velikost uzlů podle mezilehlosti', '', () => { n.velikostPodle = 'betweenness'; A.ulozNastaveni(); A.prekresli(); A.vykresliPanely(); }],
      ['Velikost uzlů stejná', '', () => { n.velikostPodle = ''; A.ulozNastaveni(); A.prekresli(); A.vykresliPanely(); }],
      ['Zrušit filtry', '', () => A.zrusFiltry()],
      ['Uložit verzi mapy', '', () => ulozVerzi()],
      ['Spustit prezentaci', '', () => { const pr = (m.pribehy || [])[0]; if (pr) prezentace.start(pr.id, 0); else A.prepniZalozku('pribeh'); }],
      ['Sdílet odkazem', '', () => sdilej()],
      ['Tisk / PDF', '', () => exportuj('tisk')],
      ['Export JSON', '', () => exportuj('json')],
      ['Export SVG', '', () => exportuj('svg')],
      ['Export PNG', '', () => exportuj('png')],
      ['Import ze souboru…', '', () => $('soubor').click()],
      ['Nová prázdná mapa', '', () => A.vlozNovouMapu(J.novaMapa('Nová mapa'))]
    ];
    if (F()) for (const f of F().FORMATY.filter(f => ['json', 'svg', 'png'].indexOf(f.id) < 0)) p.push(['Export ' + f.nazev, '', () => exportuj(f.id)]);
    for (const [z, t] of [['detail', 'Detail'], ['prehled', 'Přehled'], ['analyza', 'Analýza'], ['filtry', 'Filtry'], ['pribeh', 'Příběh'], ['typy', 'Typy'], ['text', 'Text']]) p.push(['Panel: ' + t, '', () => A.prepniZalozku(z)]);
    for (const x of A.ulozene.mapy) if (x.id !== A.idMapy) p.push(['Otevřít mapu: ' + x.nazev, '', () => A.otevriMapu(x.id)]);
    return p.map(([nazev, klavesa, proved]) => ({ nazev, klavesa, proved, druh: 'prikaz' }));
  }
  function filtrujPaletu() {
    const q = J.bezDiakritiky(vstup.value.trim().toLowerCase());
    const shoda = t => { const s = J.bezDiakritiky(t.toLowerCase()); if (!q) return 1; if (s.indexOf(q) === 0) return 3; if (s.indexOf(q) >= 0) return 2; let i = 0; for (const ch of s) if (ch === q[i]) i++; return i === q.length ? 1 : 0; };
    let pol = prikazy().map(p => Object.assign(p, { s: shoda(p.nazev) })).filter(p => p.s);
    if (q) {
      const uzly = J.hledej(A.mapa, vstup.value).slice(0, 8).map(id => ({ nazev: '→ ' + J.najdiUzel(A.mapa, id).nazev, klavesa: 'uzel', druh: 'uzel', s: 4,
        proved: () => { A.vyber([id], []); A.vycentruj(id, true); } }));
      pol = uzly.concat(pol);
    }
    pol.sort((a, b) => b.s - a.s);
    polozkyP = pol.slice(0, 60);
    indexP = 0;
    kresliPaletu();
  }
  function kresliPaletu() {
    seznamP.innerHTML = polozkyP.map((p, i) => '<li role="option" data-i="' + i + '" aria-selected="' + (i === indexP) + '"><span>' + esc(p.nazev) + '</span>' + (p.klavesa ? '<kbd>' + esc(p.klavesa) + '</kbd>' : '') + '</li>').join('') ||
      '<li class="prazdne">Nic nenalezeno</li>';
    const a = seznamP.querySelector('[aria-selected="true"]');
    if (a) a.scrollIntoView({ block: 'nearest' });
  }
  function proved(i) {
    const p = polozkyP[i];
    zavriPaletu();
    if (p) setTimeout(() => p.proved(), 10);
  }
  function zavriPaletu() { if (dlg.open) dlg.close(); }
  vstup.addEventListener('input', filtrujPaletu);
  vstup.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); indexP = Math.min(polozkyP.length - 1, indexP + 1); kresliPaletu(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); indexP = Math.max(0, indexP - 1); kresliPaletu(); }
    else if (e.key === 'Enter') { e.preventDefault(); proved(indexP); }
    else if (e.key === 'Escape') { e.preventDefault(); zavriPaletu(); }
  });
  seznamP.addEventListener('click', e => { const li = e.target.closest('[data-i]'); if (li) proved(+li.dataset.i); });
  dlg.addEventListener('click', e => { if (e.target === dlg) zavriPaletu(); });
  A.paleta = {
    otevrena: () => dlg.open,
    otevri(text) {
      vstup.value = text === '?' ? '' : (text || '');
      if (!dlg.open) dlg.showModal();
      filtrujPaletu();
      vstup.focus();
    }
  };
  $('tlPaleta').onclick = () => A.paleta.otevri();

  A.nastroje = { stahni, jmenoSouboru, svgText, exportuj, importujText, jeSoubor, sdilej, zpracujOdkaz, nahrajObrazek, wikipedie, kresliVerze, ulozVerzi, pribehZCesty, pripravObrazky, vyberZeSeznamu };
  Object.assign(A, { svgText: () => svgText(null, false), importujText });

  vykresliMenuExportu();
  A.start();
})();
