/* ============================================================
   Barefoot vložky – režim „Na míru“: projekty (IndexedDB, automatické ukládání),
   předlohy (obrázky), měřítko, hledání obrysů, šablony (strana, zarovnání,
   kalibrace délky/šířky, offset X/Y), editor předlohy s uzly.
   Napojení na ui.js: window.BFV_UI { aktivuj, sestav, ulozVyrobu }, zpětně volá window.BF_UI.
   ============================================================ */
(function () {
  'use strict';
  const J = window.BFJ, C = window.BFC;
  const $ = (id) => document.getElementById(id);
  const fmt = J.fmt;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const UI = () => window.BF_UI;
  const toast = (t, chyba) => (UI() ? UI().toast(t, chyba) : console.log(t));
  const KLIC_POSL = 'webapp_barefoot_vlozky_projekt';
  const DB = 'webapp_barefoot_vlozky', ST = 'projekty';
  const VYROBA = C.VYROBA;
  const MAX_PX = 2400;
  const novId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const cislo = (el) => { const x = parseFloat(String(el.value).replace(',', '.')); return Number.isFinite(x) ? x : null; };

  /* ---------- IndexedDB ---------- */
  let dbP = null;
  function db() {
    if (!dbP) dbP = new Promise((ok, chyba) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST, { keyPath: 'id' }); r.onsuccess = () => ok(r.result); r.onerror = () => chyba(r.error); });
    return dbP;
  }
  async function tx(rezim, f) {
    const d = await db();
    return new Promise((ok, chyba) => { const t = d.transaction(ST, rezim), r = f(t.objectStore(ST)); t.oncomplete = () => ok(r && r.result); t.onerror = () => chyba(t.error); t.onabort = () => chyba(t.error); });
  }
  const dbVse = () => tx('readonly', (s) => s.getAll());
  const dbDej = (id) => tx('readonly', (s) => s.get(id));
  const dbUloz = (x) => tx('readwrite', (s) => s.put(x));
  const dbSmaz = (id) => tx('readwrite', (s) => s.delete(id));

  /* ---------- stav ---------- */
  let pr = null;                       // aktivní projekt
  const cache = new Map();             // id obrázku → { zdroj, klic, m, img, url }
  const E = { kresba: [], nahledVh: null, obr: null, sab: null, rezim: 'posun', klik: [], vb: null, vbPro: '', url: '', ukazVlozku: true, uzel: -1, zpet: [], tah: null };
  const aktObr = () => (pr ? pr.obrazky.find((o) => o.id === E.obr) : null);
  const aktSab = () => (pr ? pr.sablony.find((s) => s.id === E.sab) : null);
  const sablonyObr = (o) => pr.sablony.filter((s) => s.obr === o.id);

  function novyProjekt(nazev) {
    const d = new Date();
    return { id: novId(), nazev: nazev || 'Projekt ' + d.toLocaleDateString('cs-CZ'), klient: '', poznamka: '', vytvoreno: d.toISOString(), upraveno: d.toISOString(), obrazky: [], sablony: [], spolecne: { ox: 0, oy: 0, spicka: 0 }, vyroba: vyrobaZ(UI() ? UI().p : J.VYCHOZI) };
  }
  const vyrobaZ = (p) => Object.fromEntries(VYROBA.map((k) => [k, p[k]]));

  /* ---------- ukládání ---------- */
  let casUlozeni = 0, hlaseno = false;
  let cekajici = null;   // projekt čekající na uložení (zachycený, ne globální pr)
  function ulozPozdeji() {
    if (!pr) return;
    $('vpStav').textContent = 'ukládám…';
    cekajici = pr;
    clearTimeout(casUlozeni);
    casUlozeni = setTimeout(ulozHned, 500);
  }
  async function ulozHned() {
    clearTimeout(casUlozeni);
    const x = cekajici; cekajici = null;
    if (!x) return;
    {
      x.upraveno = new Date().toISOString();
      try { await dbUloz(x); hlaseno = false; $('vpStav').textContent = '✓ uloženo ' + new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }); }
      catch (e) {
        $('vpStav').textContent = '⚠ neuloženo';
        if (!hlaseno) toast('Projekt se nepodařilo uložit (' + e.message + '). Úložiště prohlížeče je vypnuté nebo plné – zálohujte exportem projektu.', true);
        hlaseno = true;
      }
    }
  }
  addEventListener('pagehide', ulozHned);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') ulozHned(); });
  /* historie verzí: záznam před velkou změnou (nové hledání, měřítko, mazání, zapečení), nejvýš 20 */
  function verze(popis) {
    if (!pr) return;
    pr.historie = (pr.historie || []).concat([C.snimek(pr, popis)]).slice(-20);
  }
  /* po každé změně dat projektu */
  function zmena(bezEditoru) {
    kresliPanely();
    if (!bezEditoru) kresliEditor();
    if (UI()) UI().prepocitej();
    ulozPozdeji();
  }

  /* ---------- obrázky ---------- */
  function dekoduj(src) {
    return new Promise((ok, chyba) => {
      const im = new Image();
      im.onload = () => { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext('2d'); g.drawImage(im, 0, 0); ok({ w: c.width, h: c.height, data: g.getImageData(0, 0, c.width, c.height).data }); };
      im.onerror = () => chyba(new Error('obrázek nejde načíst'));
      im.src = src;
    });
  }
  /* soubor → zmenšený JPEG (do MAX_PX) jako data URL */
  function zmensi(soubor) {
    return new Promise((ok, chyba) => {
      const url = URL.createObjectURL(soubor), im = new Image();
      im.onload = () => {
        const k = Math.min(1, MAX_PX / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        ok({ src: c.toDataURL('image/jpeg', 0.9), w: c.width, h: c.height });
      };
      im.onerror = () => { URL.revokeObjectURL(url); chyba(new Error(soubor.name + ' není obrázek')); };
      im.src = url;
    });
  }
  async function pripravObr(o) {
    let c = cache.get(o.id);
    if (!c) { c = { zdroj: await dekoduj(o.src) }; cache.set(o.id, c); }
    return c;
  }
  /* srovnaný pracovní obrázek v mm (přepočítá se při změně měřítka) */
  function srovnany(o) {
    const c = cache.get(o.id);
    if (!c || !c.zdroj) return null;
    const klic = JSON.stringify(o.kalibrace);
    if (c.klic !== klic) {
      const m = C.meritko(o.kalibrace, o.w, o.h), img = C.srovnej(c.zdroj, m, C.rozliseni(m));
      const cv = document.createElement('canvas'); cv.width = img.w; cv.height = img.h;
      cv.getContext('2d').putImageData(new ImageData(img.rgba, img.w, img.h), 0, 0);
      Object.assign(c, { klic, m, img, url: cv.toDataURL('image/jpeg', 0.85) });
    }
    return c;
  }
  async function pridejObrazky(soubory) {
    if (!pr) return;
    let posledni = null;
    for (const f of soubory) {
      try {
        const z = await zmensi(f);
        const o = { id: novId(), nazev: f.name.replace(/\.[^.]+$/, ''), src: z.src, w: z.w, h: z.h, kalibrace: { typ: 'odhad' }, kalVolba: 'odhad', detekce: Object.assign({}, C.DETEKCE), rezy: [] };
        pr.obrazky.push(o); await pripravObr(o); posledni = o;
        E.obr = o.id; E.vb = null;
        autoMeritko(o, true);
        const kv = C.hodnotKvalitu(cache.get(o.id).zdroj, o.kalibrace.rohy);
        o.kvalita = { skore: kv.skore, varovani: kv.varovani };
        const vv = kv.varovani.filter((q) => q.uroven === 'varovani');
        if (vv.length) setTimeout(() => toast('Kvalita fotky ' + kv.skore + ' %: ' + vv.map((q) => q.text).join(' '), true), 900);
        await najdi(o, { auto: true });
        /* jednoduchý režim: rovnou vyhladit a nastavit obvyklé přídavky */
        if (UI() && UI().jednoduse) {
          for (const t of sablonyObr(o)) t.body = C.vyhladObrys(t, {});
          if (!pr.spolecne.ox && !pr.spolecne.oy && !pr.spolecne.spicka) pr.spolecne = { ox: 1, oy: 1, spicka: 10 };
        }
      } catch (e) { console.error(e); toast(e.message, true); }
    }
    if (posledni) { ukazEditor(); zmena(); }
  }

  /* ---------- měřítko ---------- */
  function zmenKalibraci(o, nova) {
    verze('před změnou měřítka');
    const m0 = C.meritko(o.kalibrace, o.w, o.h), m1 = C.meritko(nova, o.w, o.h), Hi = C.inverze3(m0.H);
    const T = (q) => C.hBod(m1.H, ...C.hBod(Hi, q[0], q[1]));
    let zruseno = 0;
    for (const s of sablonyObr(o)) {
      s.body = s.body.map(T);
      /* měřítko teď dává obrázek – dřívější dorovnání délky/šířky by se násobilo */
      if (!m1.odhad && (Math.abs(s.sx - 1) > 1e-9 || Math.abs(s.sy - 1) > 1e-9)) { s.sx = 1; s.sy = 1; zruseno++; }
    }
    o.rezy = o.rezy.map(([a, b, c, d]) => [...T([a, b]), ...T([c, d])]);
    o.kalibrace = nova; o.kalVolba = nova.typ; E.vb = null; E.zpet = [];
    zmena();
    if (!m1.odhad) toast(`Měřítko nastaveno – pracovní plocha ${fmt(m1.sirka)} × ${fmt(m1.vyska)} mm.` + (zruseno ? ` Ruční kalibrace délky/šířky u ${zruseno} ${zruseno === 1 ? 'šablony' : 'šablon'} zrušena – zkontrolujte rozměry.` : ''));
  }
  /* karta (4 čtverce) má přednost, jinak okraj listu; tichy = při přidání obrázku bez hlášky o neúspěchu */
  function autoMeritko(o, tichy) {
    const c = cache.get(o.id); if (!c || !c.zdroj) return false;
    const K = C.najdiKartu(c.zdroj);
    if (K) { prevedKalibraci(o, { typ: 'karta', rohy: K }); toast('Nalezena kalibrační karta – měřítko a perspektiva nastaveny automaticky.'); return true; }
    const R = C.najdiList(c.zdroj);
    if (R) { prevedKalibraci(o, { typ: 'list', rohy: R, papir: $('vpPapir').value || 'a4' }); toast(`Nalezen list papíru, počítám s formátem ${$('vpPapir').selectedOptions[0].textContent}. Jiný formát vyberte v Měřítku; rohy jde zkontrolovat přes „Klikat rohy“.`); return true; }
    if (!tichy) toast('List ani kalibrační kartu se nepodařilo najít – papír musí být celý vidět a kontrastní proti podložce. Klikněte rohy ručně.', true);
    return false;
  }
  /* změna měřítka bez překreslení (při přidání obrázku se kreslí až nakonec) */
  function prevedKalibraci(o, nova) {
    const m0 = C.meritko(o.kalibrace, o.w, o.h), m1 = C.meritko(nova, o.w, o.h), Hi = C.inverze3(m0.H);
    const T = (q) => C.hBod(m1.H, ...C.hBod(Hi, q[0], q[1]));
    for (const s of sablonyObr(o)) s.body = s.body.map(T);
    o.rezy = o.rezy.map(([a, b, c, d]) => [...T([a, b]), ...T([c, d])]);
    o.kalibrace = nova; o.kalVolba = nova.typ; E.vb = null; E.zpet = [];
  }
  function popisKalibrace(o) {
    const k = o.kalibrace, m = C.meritko(k, o.w, o.h);
    if (m.odhad) return '⚠ Měřítko neznámé (obrázek brán jako 210 mm široký) – kalibrujte šablony skutečnou délkou a šířkou, nebo nastavte měřítko.';
    if (k.typ === 'dpi') return `✓ Sken ${fmt(k.dpi)} DPI = ${fmt(25.4 / k.dpi, 3)} mm na pixel.`;
    if (k.typ === 'body') return `✓ Dva body vzdálené ${fmt(k.mm, 1)} mm.`;
    if (k.typ === 'karta') return '✓ Kalibrační karta A4 podle čtyř čtverců – perspektiva srovnaná.';
    return `✓ List ${fmt(m.sirka)} × ${fmt(m.vyska)} mm podle čtyř rohů – perspektiva srovnaná.`;
  }

  /* ---------- hledání obrysů ---------- */
  /* volby: auto (po přidání obrázku, bez dotazu), rezy (nové dělicí čáry – uloží se až po potvrzení) */
  async function najdi(o, volby) {
    volby = volby || {};
    const stare = sablonyObr(o);
    if (!volby.auto && stare.some((s) => s.upraveno) && !(await Dialog.potvrd('Šablony z této předlohy mají ruční úpravy uzlů. Najít obrysy znovu a úpravy zahodit?'))) { kresliPanely(); kresliEditor(); return false; }
    const c = srovnany(o);
    if (!c) { toast('Předlohu se nepodařilo načíst – odeberte ji a přidejte znovu.', true); return false; }
    if (!volby.auto && stare.length) verze('před novým hledáním obrysů');
    if (volby.rezy) o.rezy = volby.rezy;
    let nalez = C.najdiObrysy(c.img, o.detekce, o.rezy);
    if (volby.auto && !nalez.length && o.detekce.rezim === 'cara') {   // nic jako čára → zkusit plný tmavý předmět
      const z = C.najdiObrysy(c.img, Object.assign({}, o.detekce, { rezim: 'tmavy' }), o.rezy);
      if (z.length) { o.detekce.rezim = 'tmavy'; nalez = z; }
    }
    pr.sablony = pr.sablony.filter((s) => s.obr !== o.id);
    const strany = nalez.map((n) => C.odhadStrany(n.body));
    if (nalez.length === 2 && strany[0] === strany[1]) { strany[0] = 'L'; strany[1] = 'P'; }
    /* nastavení starých šablon převzít podle nejbližšího těžiště (do 60 mm) */
    const volne = stare.map((q) => ({ q, t: C.teziste(q.body) }));
    const nove = nalez.map((n, i) => {
      const s = Object.assign({}, C.SABLONA, { id: novId(), obr: o.id, strana: strany[i], body: n.body }), t = C.teziste(n.body);
      let nej = -1, m = 60;
      volne.forEach((x, j) => { const d = Math.hypot(x.t[0] - t[0], x.t[1] - t[1]); if (d < m) { m = d; nej = j; } });
      if (nej >= 0) { const st = volne.splice(nej, 1)[0].q; for (const k of ['strana', 'aktivni', 'zarovnani', 'uhelPlus', 'zrcadlit', 'sx', 'sy', 'ox', 'oy', 'spicka']) s[k] = st[k]; }
      return s;
    });
    E.zpet = [];
    pr.sablony.push(...nove);
    E.sab = nove.length ? nove[0].id : null;
    if (!volby.auto) zmena();
    const cara = nalez.length && o.detekce.rezim === 'cara' ? ` Čára asi ${fmt(nalez[0].cara, 1)} mm.` : '';
    if (!volby.auto || nalez.length) toast(nalez.length ? `Nalezeno obrysů: ${nalez.length}.${cara}${C.meritko(o.kalibrace, o.w, o.h).odhad ? ' Nastavte měřítko nebo skutečnou délku a šířku.' : ''}` : 'Žádný obrys nenalezen – zkuste jiný typ předlohy nebo citlivost.', !nalez.length);
    else toast('Na obrázku se nenašel žádný uzavřený obrys. Nastavte „Co je na obrázku“ a citlivost, pak „Najít obrysy“.', true);
    return true;
  }

  /* ---------- panely ---------- */
  function kresliPanely() {
    if (!pr) return;
    if (document.activeElement !== $('vpNazev')) $('vpNazev').value = pr.nazev;
    if (document.activeElement !== $('vpKlient')) $('vpKlient').value = pr.klient;
    if (document.activeElement !== $('vpPoznamka')) $('vpPoznamka').value = pr.poznamka;
    $('vpDatum').value = new Date(pr.vytvoreno).toLocaleDateString('cs-CZ');
    $('vpZStav').value = pr.stav || 'rozpracovano'; $('vpTermin').value = pr.termin || ''; if (document.activeElement !== $('vpPary')) $('vpPary').value = pr.pary || 1;
    $('vpSpOx').value = pr.spolecne.ox; $('vpSpOy').value = pr.spolecne.oy; $('vpSpSp').value = pr.spolecne.spicka;

    $('vpObrSeznam').innerHTML = pr.obrazky.map((o) => {
      const n = sablonyObr(o).length, od = C.meritko(o.kalibrace, o.w, o.h).odhad;
      return `<li data-obr="${o.id}" role="option" tabindex="0" aria-selected="${o.id === E.obr}"><span class="nz">${od ? '⚠️' : '📏'} ${esc(o.nazev)} <small>· ${n} ${n === 1 ? 'obrys' : n > 1 && n < 5 ? 'obrysy' : 'obrysů'}</small></span><button class="mini" data-smazobr title="Odebrat předlohu i její šablony">✕</button></li>`;
    }).join('') || '<li style="cursor:default"><span class="nz" style="color:var(--text-faint)">Zatím žádná předloha.</span></li>';
    const o = aktObr();
    $('vpObrDetail').classList.toggle('skryte', !o);
    $('predlohaZadna').classList.toggle('skryte', !!o);
    $('vpObrStav').classList.toggle('skryte', !o);
    if (o) {
      const m = C.meritko(o.kalibrace, o.w, o.h), n = sablonyObr(o).length;
      $('vpObrStavText').innerHTML = (m.odhad ? '<span class="warn-t">⚠ měřítko neznámé</span>' : `<span class="ok-t">✓</span> ${{ dpi: 'sken ' + fmt(o.kalibrace.dpi) + ' DPI', body: 'pravítko', list: 'list papíru', karta: 'kalibrační karta' }[o.kalibrace.typ]}`) + ` · ${n} ${n === 1 ? 'obrys' : n > 1 && n < 5 ? 'obrysy' : 'obrysů'}` + (o.kvalita ? ` · <span class="${o.kvalita.skore >= 75 ? 'ok-t' : o.kvalita.skore >= 50 ? 'warn-t' : 'err-t'}" title="${esc(o.kvalita.varovani.map((q) => q.text).join(' ') || 'bez výhrad')}">kvalita ${o.kvalita.skore} %</span>` : '');
    }
    kresliRychle();
    $('vpZakazkaSouhrn').textContent = `${C.ZAKAZKA.nazvy[pr.stav] || 'rozpracováno'}${pr.termin ? ' · ' + new Date(pr.termin).toLocaleDateString('cs-CZ') : ''}`;
    if (o) {
      const volba = o.kalVolba || o.kalibrace.typ;
      $('vpKalTyp').value = volba;
      $('vpKalDpi').classList.toggle('skryte', volba !== 'dpi');
      $('vpKalList').classList.toggle('skryte', volba !== 'list');
      $('vpAutoMeritko').classList.toggle('skryte', !['odhad', 'list', 'karta'].includes(volba));
      $('vpKalBody').classList.toggle('skryte', volba !== 'body');
      if (o.kalibrace.typ === 'dpi') $('vpDpi').value = o.kalibrace.dpi;
      if (o.kalibrace.typ === 'list') $('vpPapir').value = o.kalibrace.papir || 'a4';
      $('vpKalInfo').textContent = popisKalibrace(o);
      const d = o.detekce;
      $('vpRezim').value = d.rezim; $('vpHrana').value = d.hrana; $('vpCitlivost').value = d.citlivost;
      $('vpUzavrit').value = d.uzavrit; $('vpVyhlazeni').value = d.vyhlazeni; $('vpKorekce').value = d.korekce;
      $('vpHranaBlok').classList.toggle('skryte', d.rezim !== 'cara');
      $('vpUzavrit').disabled = d.rezim !== 'cara';
      $('vpRezSmazat').disabled = !o.rezy.length;
    }

    const serazene = pr.sablony.slice().sort((a, b) => (a.strana === b.strana ? 0 : a.strana === 'L' ? -1 : 1));
    $('vpSabSeznam').innerHTML = serazene.map((s) => {
      const g = C.geometrie(s, pr.spolecne), r = J.rozmery(g.vlozka), ob = pr.obrazky.find((q) => q.id === s.obr);
      return `<li data-sab="${s.id}" role="option" tabindex="0" aria-selected="${s.id === E.sab}"><input type="checkbox" data-akt ${s.aktivni !== false ? 'checked' : ''} title="Tisknout tuto šablonu"><select data-strana aria-label="Strana"><option value="L"${s.strana === 'L' ? ' selected' : ''}>L</option><option value="P"${s.strana === 'P' ? ' selected' : ''}>P</option></select><span class="nz">${s.role === 'stelka' ? '👟 ' : s.role === 'vlozka' ? '🩴 ' : ''}${fmt(r.delka)} × ${fmt(r.sirka)} mm <small>· ${esc(ob ? ob.nazev : '?')}${s.upraveno ? ' · upraveno' : ''}${Math.abs(s.sx - 1) > 1e-9 || Math.abs(s.sy - 1) > 1e-9 ? ' · kalibr.' : ''}</small></span><button class="mini" data-kopie title="Vytvořit druhou nohu zrcadlením">⇋</button><button class="mini" data-smazsab title="Smazat šablonu">✕</button></li>`;
    }).join('') || '<li style="cursor:default"><span class="nz" style="color:var(--text-faint)">Šablony vzniknou z nalezených obrysů.</span></li>';
    const s = aktSab();
    $('vpSabDetail').classList.toggle('skryte', !s);
    if (s) {
      const g = C.geometrie(s, pr.spolecne), rn = J.rozmery(g.noha), rv = J.rozmery(g.vlozka);
      $('vpZarovnani').value = s.zarovnani; $('vpUhel').value = s.uhelPlus; $('vpZrcadlit').checked = !!s.zrcadlit;
      $('vpRole').value = s.role || 'noha';
      const jine = pr.sablony.filter((t) => t.id !== s.id);
      $('vpDruha').innerHTML = jine.map((t) => `<option value="${t.id}">${t.strana} · ${esc(C.ROLE[t.role || 'noha'])} · ${fmt(C.geometrie(t, pr.spolecne).zmereno.delka * t.sy)} mm</option>`).join('') || '<option value="">(žádná další šablona)</option>';
      ['vpPrumer', 'vpDorovnat'].forEach((id) => { $(id).disabled = !jine.length; });
      $('vpZeStelky').disabled = s.role !== 'stelka';
      const ps = Object.assign({}, C.SABLONA.prsty, s.prsty);
      $('vpPrstyRezim').value = ps.rezim; $('vpPrstySila').value = ps.sila; $('vpPrstyOd').value = Math.round(ps.od * 100);
      $('vpPrstySilaH').textContent = fmt(ps.sila, 1); $('vpPrstyOdH').textContent = Math.round(ps.od * 100) + ' %';
      $('vpPrstySila').disabled = $('vpPrstyOd').disabled = ps.rezim === 'zadne';
      $('vpPrstySouhrn').textContent = ps.rezim === 'zadne' ? 'vypnuto' : `${ps.rezim === 'obalka' ? 'obálka' : 'vyhlazení'} ${fmt(ps.sila, 1)}`;
      $('vpRoleSouhrn').textContent = `${C.ROLE[s.role || 'noha']} · ${s.zarovnani === 'tecna' ? 'tečna' : 'osa'}${s.uhelPlus ? ' ' + fmt(s.uhelPlus, 1) + '°' : ''}${s.zrcadlit ? ' · zrcadlená' : ''}`;
      $('vpZmereno').innerHTML = `Z předlohy změřeno <b>${fmt(g.zmereno.delka, 1)} × ${fmt(g.zmereno.sirka, 1)} mm</b>` + (Math.abs(s.sx - 1) > 1e-9 || Math.abs(s.sy - 1) > 1e-9 ? ` · měřítko X ${fmt(s.sx, 4)}, Y ${fmt(s.sy, 4)}` : ' · bez kalibrace');
      if (document.activeElement !== $('vpSkDelka')) $('vpSkDelka').value = Math.round(rn.delka * 10) / 10;
      if (document.activeElement !== $('vpSkSirka')) $('vpSkSirka').value = Math.round(rn.sirka * 10) / 10;
      $('vpOx').value = s.ox; $('vpOy').value = s.oy; $('vpSp').value = s.spicka;
      $('vpVysledek').innerHTML = `Předloha ${fmt(rn.delka, 1)} × ${fmt(rn.sirka, 1)} mm (pata ${fmt(rn.pata, 1)}) → <b>vložka ${fmt(rv.delka, 1)} × ${fmt(rv.sirka, 1)} mm</b> (pata ${fmt(rv.pata, 1)}). Offset celkem X ${fmt(g.off.ox, 1)}, Y ${fmt(g.off.oy, 1)}, špička ${fmt(g.off.spicka, 1)} mm.`;
    }
  }

  let navstiveno = {};

  /* ---------- editor předlohy ---------- */
  const edSvg = () => $('edSvg');
  function bodSvg(e) { const s = edSvg(), pt = s.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const q = pt.matrixTransform(s.getScreenCTM().inverse()); return [q.x, q.y]; }
  const puvodni = () => E.rezim === 'kal-body' || E.rezim === 'kal-list';
  function kresliEditor() {
    const o = aktObr(), c = o && cache.get(o.id);
    $('edPrazdny').classList.toggle('skryte', !!(o && c));
    $('editor').className = 'r-' + (puvodni() || E.rezim === 'rez' || E.rezim === 'merit' ? (E.rezim === 'kal-body' || E.rezim === 'kal-list' ? 'kal' : 'rez') : E.rezim);
    document.querySelectorAll('[data-edrezim]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.edrezim === E.rezim)));
    $('edVlozka').setAttribute('aria-pressed', String(E.ukazVlozku));
    $('edZpet').disabled = !E.zpet.length;
    obnovSmazUzel();
    $('edDosah').classList.toggle('skryte', E.rezim !== 'uzly');
    if (!o || !c) { if (edSvg()) edSvg().remove(); E.url = ''; stav(); return; }
    let W, H, url;
    if (puvodni()) { W = o.w; H = o.h; url = o.src; }
    else { const s = srovnany(o); W = s.m.sirka; H = s.m.vyska; url = s.url; }
    const pro = (puvodni() ? 'p' : 's') + o.id + url.length;
    if (E.vbPro !== pro || !E.vb) { E.vb = { x: -W * 0.03, y: -H * 0.03, w: W * 1.06, h: H * 1.06 }; E.vbPro = pro; }
    if (E.url !== url || !edSvg()) {
      if (edSvg()) edSvg().remove();
      $('editor').insertAdjacentHTML('beforeend', `<svg id="edSvg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet"><rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/><image href="${esc(url)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none"/><g id="edG"></g></svg>`);
      E.url = url;
    }
    edSvg().setAttribute('viewBox', `${E.vb.x} ${E.vb.y} ${E.vb.w} ${E.vb.h}`);
    kresliVrstvu();
    stav();
  }
  function kresliVrstvu() {
    const o = aktObr(), g = $('edG'); if (!o || !g) return;
    const k = E.vb.w / Math.max(1, edSvg().clientWidth || 600), r = 4.5 * k, cara = (b, w, extra) => `stroke="${b}" stroke-width="${w}" vector-effect="non-scaling-stroke" ${extra || ''}`;
    let h = '';
    if (puvodni()) {
      const kal = o.kalibrace;
      if (kal.typ === 'list' && E.rezim === 'kal-list' && !E.klik.length) { const R = C.seradRohy(kal.rohy); if (R) h += `<path d="M${R.map((q) => q.join(' ')).join('L')}Z" fill="none" ${cara('#1f7ae0', 2, 'stroke-dasharray="6 4"')}/>`; }
      if (E.klik.length > 1) h += `<path d="M${E.klik.map((q) => q.join(' ')).join('L')}${E.klik.length === 4 ? 'Z' : ''}" fill="none" ${cara('#e67e22', 2)}/>`;
      h += E.klik.map((q, i) => `<circle cx="${q[0]}" cy="${q[1]}" r="${r * 1.4}" fill="#e67e22" fill-opacity=".85" ${cara('#fff', 1.5)}/><text x="${q[0] + r * 2}" y="${q[1] - r * 2}" font-size="${14 * k}" fill="#e67e22" font-weight="700">${i + 1}</text>`).join('');
      g.innerHTML = h; return;
    }
    for (const [ax, ay, bx, by] of o.rezy) h += `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" ${cara('#e67e22', 3, 'stroke-dasharray="8 5"')}/>`;
    for (const s of sablonyObr(o)) {
      const vyb = s.id === E.sab, P = J.spline(s.body, 6), ct = C.teziste(s.body);
      if (E.ukazVlozku) {
        const geo = C.geometrie(s, pr.spolecne), Q = geo.vlozka.map(geo.zpet);
        h += `<path d="M${Q.map((q) => q[0].toFixed(2) + ' ' + q[1].toFixed(2)).join('L')}Z" fill="none" ${cara('#1e9e4a', vyb ? 2 : 1.4, 'stroke-dasharray="7 4"')} pointer-events="none"/>`;
      }
      h += `<path data-sab="${s.id}" d="M${P.map((q) => q[0].toFixed(2) + ' ' + q[1].toFixed(2)).join('L')}Z" fill="${vyb ? 'rgba(31,122,224,.10)' : 'rgba(31,122,224,.04)'}" ${cara(vyb ? '#1f7ae0' : '#4b8fd6', vyb ? 2.6 : 1.6)} style="cursor:pointer"/>`;
      h += `<text x="${ct[0]}" y="${ct[1]}" font-size="${28 * k}" text-anchor="middle" dominant-baseline="middle" fill="${s.aktivni === false ? '#999' : '#1f7ae0'}" font-weight="700" pointer-events="none" style="paint-order:stroke" stroke="#fff" stroke-width="${3 * k}">${s.strana}${s.aktivni === false ? ' (vyp.)' : ''}</text>`;
      if (vyb && E.rezim === 'uzly') h += s.body.map((q, i) => `<circle data-uzel="${i}" cx="${q[0]}" cy="${q[1]}" r="${r}" fill="${i === E.uzel ? '#e67e22' : '#fff'}" ${cara('#1f7ae0', 1.6)} style="cursor:move"/>`).join('');
    }
    if (E.nahledVh) for (const [, B] of E.nahledVh) { const S = J.spline(B, 6); h += `<path d="M${S.map((q) => q[0].toFixed(2) + ' ' + q[1].toFixed(2)).join('L')}Z" fill="none" ${cara('#e67e22', 2.4, 'stroke-dasharray="6 3"')} pointer-events="none"/>`; }
    if (E.rezim === 'kreslit' && E.kresba.length) {
      h += `<path d="M${E.kresba.map((q) => q[0].toFixed(2) + ' ' + q[1].toFixed(2)).join('L')}" fill="none" ${cara('#e67e22', 2.4)}/>`;
      h += `<circle cx="${E.kresba[0][0]}" cy="${E.kresba[0][1]}" r="${r * 2}" fill="#e67e22" fill-opacity=".5" ${cara('#fff', 1.5)}/>`;
    }
    if (E.rezim === 'merit' && E.klik.length > 1) h += `<path d="M${E.klik.map((q) => q.join(' ')).join('L')}" fill="none" ${cara('#e67e22', 2)}/>`;
    h += E.klik.map((q) => `<circle cx="${q[0]}" cy="${q[1]}" r="${r}" fill="#e67e22" ${cara('#fff', 1.2)}/>`).join('');
    g.innerHTML = h;
  }
  function stav(t) {
    const o = aktObr();
    const H = {
      posun: 'Táhněte obrázek, kolečkem přibližte. Kliknutím na obrys ho vyberete.',
      uzly: 'Táhněte uzly vybraného obrysu. Dvojklik na obrys přidá uzel; ťuknutý uzel smaže 🗑, pravé tlačítko nebo Delete. Ctrl+Z vrátí.',
      rez: 'Klikněte dva body dělicí čáry přes místo, kde se obrysy dotýkají (tažením posunete pohled, Esc = zrušit).',
      'kal-body': `Klikněte dva body na pravítku se známou vzdáleností (${E.klik.length}/2, Esc = zrušit).`,
      'kal-list': `Klikněte čtyři rohy listu papíru v libovolném pořadí (${E.klik.length}/4, Esc = zrušit).`,
      merit: 'Klikněte 2 body = vzdálenost, 3. bod = úhel u prostředního bodu (např. odklon palce). Další klik začne znovu.',
      kreslit: `Obkreslete obrys: klikejte body nebo táhněte myší/prstem po okraji. Uzavřete klikem na první (oranžový) bod nebo Enter, Esc = zrušit. Bodů: ${E.kresba.length}.`,
    };
    if (E.rezim === 'merit' && E.klik.length >= 2 && !t) { $('edStav').innerHTML = popisMereni(); return; }
    $('edStav').innerHTML = t || (o ? esc(H[E.rezim]) : '');
  }
  function celek() { E.vb = null; kresliEditor(); }
  const ukazEditor = () => { if (UI() && UI().typ === 'vlastni') UI().zalozka('editor'); };
  function nastavRezim(r) {
    if (r !== 'posun') ukazEditor();
    const bylKal = puvodni();
    E.rezim = r; E.klik = []; E.uzel = -1; E.kresba = []; E.vb = puvodni() || bylKal ? null : E.vb;
    if (bylKal && !puvodni() && aktObr()) { aktObr().kalVolba = aktObr().kalibrace.typ; kresliPanely(); }
    kresliEditor();
  }

  /* události editoru */
  const ed = $('editor');
  ed.addEventListener('wheel', (e) => {
    if (!edSvg()) return; e.preventDefault();
    const [x, y] = bodSvg(e), f = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    E.vb = { x: x - (x - E.vb.x) * f, y: y - (y - E.vb.y) * f, w: E.vb.w * f, h: E.vb.h * f };
    edSvg().setAttribute('viewBox', `${E.vb.x} ${E.vb.y} ${E.vb.w} ${E.vb.h}`); kresliVrstvu();
  }, { passive: false });
  /* dva prsty = přiblížení (dotyk nemá kolečko) */
  const dotyky = new Map();
  const vzdDotyku = () => { const [a, b] = [...dotyky.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  ed.addEventListener('pointerdown', async (e) => {
    const o = aktObr(); if (!o || !edSvg() || e.button === 2) return;
    if (e.pointerType === 'touch') {
      dotyky.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (dotyky.size === 2) {
        const [a, b] = [...dotyky.values()], st = bodSvg({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
        if (E.tah && E.tah.uzel) dokonciUzel();
        E.tah = { pinch: true, d0: vzdDotyku(), vb: Object.assign({}, E.vb), st };
        return;
      }
      if (dotyky.size > 2) return;
    }
    const cil = e.target;
    if (E.rezim === 'kreslit') {
      const q = bodSvg(e), k = E.vb.w / Math.max(1, edSvg().clientWidth);
      if (E.kresba.length >= 6 && Math.hypot(q[0] - E.kresba[0][0], q[1] - E.kresba[0][1]) < 12 * k) { dokonciKresbu(); return; }
      E.kresba.push(q); E.tah = { kresli: true }; ed.setPointerCapture(e.pointerId); kresliVrstvu(); stav(); return;
    }
    const iu = E.rezim === 'uzly' ? uzelU(e) : -1;
    if (iu >= 0) {
      const s = aktSab(); E.zpet.push({ id: s.id, body: s.body.map((b) => b.slice()) }); if (E.zpet.length > 60) E.zpet.shift();
      E.uzel = iu; E.tah = { uzel: true, start: s.body.map((b) => b.slice()), dosah: +$('edDosah').value || 0 }; ed.setPointerCapture(e.pointerId); kresliVrstvu(); obnovSmazUzel(); return;
    }
    if (cil.dataset && cil.dataset.sab) { if (E.sab !== cil.dataset.sab) { E.sab = cil.dataset.sab; E.uzel = -1; kresliPanely(); kresliVrstvu(); } }
    E.tah = { x: e.clientX, y: e.clientY, vb: Object.assign({}, E.vb), klik: E.rezim === 'rez' || E.rezim === 'merit' || puvodni() || E.rezim === 'uzly' }; ed.setPointerCapture(e.pointerId);
  });
  /* měření na předloze (mm po srovnání měřítka; kalibrace šablony se do něj nepočítá) */
  function popisMereni() {
    const [a, b, c] = E.klik, d1 = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let t = `Vzdálenost 1–2: <b>${fmt(d1, 1)} mm</b>`;
    if (c) {
      const d2 = Math.hypot(c[0] - b[0], c[1] - b[1]), u1 = Math.atan2(a[1] - b[1], a[0] - b[0]), u2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
      let u = Math.abs(u1 - u2) * 180 / Math.PI; if (u > 180) u = 360 - u;
      t += ` · 2–3: <b>${fmt(d2, 1)} mm</b> · úhel u bodu 2: <b>${fmt(u, 1)}°</b> (odklon od přímky ${fmt(180 - u, 1)}°)`;
    }
    const o = aktObr();
    if (o && C.meritko(o.kalibrace, o.w, o.h).odhad) t += ' <span class="warn-t">– měřítko obrázku je jen odhad</span>';
    return t;
  }
  /* klik (bez tažení) v režimu řezu, kalibrace a měření přidá bod */
  async function klikBod(e) {
    const o = aktObr(); if (!o) return;
    const q = bodSvg(e);
    if (E.rezim === 'merit' && E.klik.length >= 3) E.klik = [];
    E.klik.push(q); kresliVrstvu(); stav();
    if (E.rezim === 'merit') return;
    if (E.rezim === 'rez' && E.klik.length === 2) { const rez = [...E.klik[0], ...E.klik[1]]; nastavRezim('posun'); await najdi(o, { rezy: o.rezy.concat([rez]) }); return; }
    if (E.rezim === 'kal-body' && E.klik.length === 2) {
      const [a, b] = E.klik, s = await Dialog.zeptej(`Skutečná vzdálenost bodů v mm (na obrázku ${fmt(Math.hypot(b[0] - a[0], b[1] - a[1]))} px):`, '100');
      const mm = parseFloat(String(s || '').replace(',', '.'));
      nastavRezim('posun');
      if (mm > 0) zmenKalibraci(o, { typ: 'body', a, b, mm });
      return;
    }
    if (E.rezim === 'kal-list' && E.klik.length === 4) {
      const rohy = E.klik.slice(); nastavRezim('posun');
      if (!C.seradRohy(rohy)) { toast('Rohy se nepodařilo seřadit – klikněte je znovu.', true); return; }
      zmenKalibraci(o, { typ: 'list', rohy, papir: $('vpPapir').value });
    }
  }
  function dokonciUzel() {
    const s = aktSab();
    if (s && E.tah.pohnul) { s.upraveno = true; zmena(true); kresliVrstvu(); } else E.zpet.pop();
    $('edZpet').disabled = !E.zpet.length; obnovSmazUzel();
  }
  ed.addEventListener('pointermove', (e) => {
    if (dotyky.has(e.pointerId)) dotyky.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!E.tah || !edSvg()) return;
    if (E.tah.pinch) {
      if (dotyky.size < 2) return;
      const f = E.tah.d0 / vzdDotyku(), v0 = E.tah.vb, [x, y] = E.tah.st;
      E.vb = { x: x - (x - v0.x) * f, y: y - (y - v0.y) * f, w: v0.w * f, h: v0.h * f };
      edSvg().setAttribute('viewBox', `${E.vb.x} ${E.vb.y} ${E.vb.w} ${E.vb.h}`); kresliVrstvu();
      return;
    }
    if (E.tah.kresli) {
      const q = bodSvg(e), p0 = E.kresba[E.kresba.length - 1];
      if (Math.hypot(q[0] - p0[0], q[1] - p0[1]) > 1.5) { E.kresba.push(q); kresliVrstvu(); }
      return;
    }
    if (E.tah.uzel) {
      /* plynulé tažení: sousední uzly do dosahu se posunou s vahou podle vzdálenosti (Gaussova křivka) */
      const s = aktSab(), q = bodSvg(e), st = E.tah.start, a = st[E.uzel], dx = q[0] - a[0], dy = q[1] - a[1], R = E.tah.dosah;
      s.body = st.map((b, j) => { const w = j === E.uzel ? 1 : R ? Math.exp(-2.3 * (Math.hypot(b[0] - a[0], b[1] - a[1]) / R) ** 2) : 0; return w > 0.01 ? [b[0] + dx * w, b[1] + dy * w] : b.slice(); });
      E.tah.pohnul = true; kresliVrstvu(); return;
    }
    const sk = 1 / edSvg().getScreenCTM().a;   // px obrazovky → jednotky obrázku
    E.vb.x = E.tah.vb.x - (e.clientX - E.tah.x) * sk; E.vb.y = E.tah.vb.y - (e.clientY - E.tah.y) * sk;
    edSvg().setAttribute('viewBox', `${E.vb.x} ${E.vb.y} ${E.vb.w} ${E.vb.h}`);
  });
  const pust = (e) => {
    dotyky.delete(e.pointerId);
    if (E.tah && E.tah.pinch) { if (!dotyky.size) E.tah = null; return; }
    if (E.tah && E.tah.kresli) { E.tah = null; stav(); return; }
    if (E.tah && E.tah.uzel) dokonciUzel();
    else if (E.tah && E.tah.klik && e.type === 'pointerup' && Math.hypot(e.clientX - E.tah.x, e.clientY - E.tah.y) < 6) {
      if (E.rezim === 'uzly') { if (E.uzel >= 0) { E.uzel = -1; kresliVrstvu(); obnovSmazUzel(); } }
      else klikBod(e);
    }
    E.tah = null;
  };
  ed.addEventListener('pointerup', pust);
  ed.addEventListener('pointercancel', pust);
  ed.addEventListener('dblclick', (e) => {
    const s = aktSab(); if (E.rezim !== 'uzly' || !s || !edSvg()) return;
    const [x, y] = bodSvg(e); let nej = -1, m = Infinity;
    for (let i = 0; i < s.body.length; i++) {
      const a = s.body[i], b = s.body[(i + 1) % s.body.length], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1e-9;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)), d = Math.hypot(a[0] + t * dx - x, a[1] + t * dy - y);
      if (d < m) { m = d; nej = i; }
    }
    if (m > 15 * E.vb.w / Math.max(1, edSvg().clientWidth)) return;
    E.zpet.push({ id: s.id, body: s.body.map((b) => b.slice()) });
    s.body.splice(nej + 1, 0, [x, y]); E.uzel = nej + 1; s.upraveno = true; zmena(true); kresliVrstvu(); $('edZpet').disabled = false;
  });
  /* nejbližší uzel vybrané šablony do 14 px od kurzoru (prstem se do malého kroužku netrefí) */
  function uzelU(e) {
    const s = aktSab(); if (!s || !edSvg()) return -1;
    const [x, y] = bodSvg(e), lim = 14 * E.vb.w / Math.max(1, edSvg().clientWidth);
    let nej = -1, m = lim;
    s.body.forEach((q, i) => { const d = Math.hypot(q[0] - x, q[1] - y); if (d < m) { m = d; nej = i; } });
    return nej;
  }
  function obnovSmazUzel() { $('edSmazUzel').disabled = !(E.rezim === 'uzly' && E.uzel >= 0 && aktSab()); }
  $('edSmazUzel').addEventListener('click', () => smazUzel(E.uzel));
  function smazUzel(i) {
    const s = aktSab(); if (!s || i < 0) return;
    if (s.body.length <= 8) { toast('Obrys musí mít aspoň 8 uzlů.', true); return; }
    E.zpet.push({ id: s.id, body: s.body.map((b) => b.slice()) });
    s.body.splice(i, 1); E.uzel = -1; s.upraveno = true; zmena(true); kresliVrstvu(); $('edZpet').disabled = false; obnovSmazUzel();
  }
  ed.addEventListener('contextmenu', (e) => { const i = E.rezim === 'uzly' ? uzelU(e) : -1; if (i >= 0) { e.preventDefault(); smazUzel(i); } });
  /* hromadné vyhlazení trasy všech obrysů vybrané předlohy (jedno Zpět vrátí všechny) */
  function vyhladitVlnky() {
    const o = aktObr(); if (!o) { toast('Nejdřív přidejte obrázek.', true); return; }
    const L = sablonyObr(o); if (!L.length) { toast('Na předloze zatím nejsou žádné obrysy.', true); return; }
    verze('před vyhlazením vlnek');
    E.zpet.push({ vice: L.map((s) => ({ id: s.id, body: s.body.map((b) => b.slice()) })) }); if (E.zpet.length > 60) E.zpet.shift();
    for (const s of L) { s.body = C.vyhladObrys(s, {}); s.upraveno = true; }
    navstiveno.obrysy = true; E.uzel = -1;
    zmena();
    toast(`Vyhlazeno ${L.length} ${L.length === 1 ? 'obrys' : L.length < 5 ? 'obrysy' : 'obrysů'}: u prstů vyplněné zářezy, jinde narovnané vlnky. Další klik vyhladí víc, Zpět (Ctrl+Z) vrátí.`);
  }
  /* nabídka Vyhladit: nastavení + oranžový náhled v editoru, použije se až tlačítkem */
  const volbyVh = () => ({ prsty: +$('vhPrsty').value, celek: +$('vhCelek').value, od: +$('vhOd').value / 100, obalka: $('vhObalka').checked });
  const cileVh = () => { const o = aktObr(); if (!o) return []; return $('vhRozsah').value === 'vybrana' ? sablonyObr(o).filter((t) => t.id === E.sab) : sablonyObr(o); };
  function nahledVyhlazeni() {
    $('vhPrstyH').textContent = fmt(+$('vhPrsty').value, 1); $('vhCelekH').textContent = fmt(+$('vhCelek').value, 1); $('vhOdH').textContent = $('vhOd').value + ' %';
    if ($('nabVyhladit').hidden) { E.nahledVh = null; kresliVrstvu(); return; }
    const o = volbyVh(); E.nahledVh = new Map(cileVh().map((t) => [t.id, C.vyhladObrys(t, o)])); kresliVrstvu();
  }
  ['vhPrsty', 'vhCelek', 'vhOd', 'vhObalka', 'vhRozsah'].forEach((id) => $(id).addEventListener('input', nahledVyhlazeni));
  new MutationObserver(nahledVyhlazeni).observe($('nabVyhladit'), { attributes: true, attributeFilter: ['hidden'] });
  function vyhladitVlnky(volby) {
    const o = aktObr(); if (!o) { toast('Nejdřív přidejte obrázek.', true); return; }
    const L = $('vhRozsah').value === 'vybrana' && volby ? sablonyObr(o).filter((t) => t.id === E.sab) : sablonyObr(o);
    if (!L.length) { toast('Na předloze zatím nejsou žádné obrysy (nebo žádný není vybraný).', true); return; }
    verze('před vyhlazením vlnek');
    E.zpet.push({ vice: L.map((t) => ({ id: t.id, body: t.body.map((b) => b.slice()) })) }); if (E.zpet.length > 60) E.zpet.shift();
    for (const t of L) { t.body = (E.nahledVh && E.nahledVh.get(t.id)) || C.vyhladObrys(t, volby || {}); t.upraveno = true; }
    navstiveno.obrysy = true; E.uzel = -1; E.nahledVh = null;
    zmena();
    toast(`Vyhlazeno ${L.length} ${L.length === 1 ? 'obrys' : L.length < 5 ? 'obrysy' : 'obrysů'}. Další použití vyhladí víc, Zpět (Ctrl+Z) vrátí.`);
  }
  $('vhPouzit').addEventListener('click', () => { const o = volbyVh(); vyhladitVlnky(o); if (UI()) UI().zavriNabidky(); });
  $('vhZrusit').addEventListener('click', () => UI() && UI().zavriNabidky());
  $('nstVyhladit').addEventListener('click', (e) => { ukazEditor(); ed.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => otevriNabidku(null, 'edVyhladit'), 350); e.stopPropagation(); });
  /* ruční obkreslení */
  function dokonciKresbu() {
    const o = aktObr(); if (!o || E.kresba.length < 6) { toast('Obrys potřebuje aspoň 6 bodů.', true); return; }
    const hust = C.vyhlad(C.prevzorkuj(E.kresba, 1), 2), body = C.ridiciBody(hust, 0.25);
    if (body.length < 8 || Math.abs(J.plocha(hust)) < 2000) { toast('Obrys je příliš malý – obkreslete celé chodidlo.', true); return; }
    verze('před ručním obrysem');
    const t = Object.assign({}, C.SABLONA, { id: novId(), obr: o.id, strana: C.odhadStrany(body), body, upraveno: true });
    pr.sablony.push(t); E.sab = t.id; nastavRezim('posun'); zmena();
    toast(`Ručně obkreslený obrys přidán jako ${t.strana === 'P' ? 'pravá' : 'levá'} šablona – stranu lze změnit v seznamu.`);
  }
  $('nstKreslit').addEventListener('click', () => { if (!aktObr()) { toast('Nejdřív přidejte obrázek.', true); return; } nastavRezim('kreslit'); ed.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  /* další úpravy šablony */
  const druha = () => pr.sablony.find((t) => t.id === $('vpDruha').value);
  $('vpPrumer').addEventListener('click', () => {
    const a = aktSab(), b = druha(); if (!a || !b) return;
    const r = C.prumerSablon(a, b, pr.spolecne);
    verze('před průměrem obrysů');
    const t = Object.assign({}, a, { id: novId(), body: r.body, upraveno: true, prsty: Object.assign({}, a.prsty) });
    a.aktivni = false; b.aktivni = false; pr.sablony.push(t); E.sab = t.id; zmena();
    toast(`Průměrný obrys přidán (původní dvě šablony se netisknou). Obkreslení se liší průměrně o ${fmt(r.prumer, 1)} mm, nejvíc o ${fmt(r.max, 1)} mm` + (r.max > 4 ? ' – to je hodně, zkontrolujte obě předlohy.' : '.'));
  });
  $('vpDorovnat').addEventListener('click', async () => {
    const a = aktSab(), b = druha(); if (!a || !b) return;
    if (!(await Dialog.potvrd(`Přenést tvar šablony ${b.strana} na ${a.strana} (zachová se délka a šířka ${a.strana})? Hodí se, když je předloha jedné nohy poškozená.`))) return;
    verze('před dorovnáním tvaru');
    E.zpet.push({ id: a.id, body: a.body.map((q) => q.slice()) });
    a.body = C.dorovnatPodle(a, b, pr.spolecne); a.upraveno = true; zmena(); toast('Tvar dorovnán. Zpět vrátí původní.');
  });
  $('vpZeStelky').addEventListener('click', () => {
    const a = aktSab(); if (!a || a.role !== 'stelka') return;
    a.role = 'vlozka'; a.aktivni = true; a.ox = -1; a.oy = -1; zmena();
    toast('Stélka z boty se teď tiskne jako vložka do té boty – o 1 mm menší po obvodu (offset −1 mm lze upravit).');
  });
  function zpet() {
    const z = E.zpet.pop(); if (!z) return;
    if (z.vice) {
      for (const q of z.vice) { const s = pr.sablony.find((t) => t.id === q.id); if (s) s.body = q.body; }
      E.uzel = -1; zmena(); $('edZpet').disabled = !E.zpet.length; return;
    }
    const s = pr.sablony.find((q) => q.id === z.id);
    if (s) { s.body = z.body; E.sab = s.id; E.uzel = -1; if (E.obr !== s.obr) { E.obr = s.obr; E.vb = null; } zmena(); }
    $('edZpet').disabled = !E.zpet.length;
  }
  document.addEventListener('keydown', (e) => {
    if (!UI() || UI().typ !== 'vlastni' || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
    if (e.key === 'Escape' && E.rezim !== 'posun') { nastavRezim('posun'); return; }
    if (e.key === 'Enter' && E.rezim === 'kreslit') { e.preventDefault(); dokonciKresbu(); return; }
    if (!e.ctrlKey && !e.metaKey && !e.altKey && aktObr() && !document.querySelector('dialog[open]')) {
      const kl = e.key.toLowerCase();
      if (kl === 'p') { nastavRezim('posun'); return; }
      if (kl === 'm') { nastavRezim('merit'); return; }
      if (kl === 'k') { nastavRezim('kreslit'); return; }
      if (kl === 'u' && aktSab()) { nastavRezim('uzly'); return; }
      if (kl === 'h') { otevriNabidku(null, 'edVyhladit'); return; }
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && E.rezim === 'uzly' && E.uzel >= 0) { e.preventDefault(); smazUzel(E.uzel); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); zpet(); }
  });
  document.querySelectorAll('[data-edrezim]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.edrezim === 'uzly' && !aktSab()) { toast('Nejdřív vyberte obrys (kliknutím na něj nebo v seznamu šablon).', true); return; } nastavRezim(b.dataset.edrezim); }));
  $('edCelek').addEventListener('click', celek);
  function zoom(f) {
    if (!edSvg()) return;
    const cx = E.vb.x + E.vb.w / 2, cy = E.vb.y + E.vb.h / 2;
    E.vb = { x: cx - E.vb.w * f / 2, y: cy - E.vb.h * f / 2, w: E.vb.w * f, h: E.vb.h * f };
    edSvg().setAttribute('viewBox', `${E.vb.x} ${E.vb.y} ${E.vb.w} ${E.vb.h}`); kresliVrstvu();
  }
  $('edPlus').addEventListener('click', () => zoom(1 / 1.4));
  $('edMinus').addEventListener('click', () => zoom(1.4));
  $('edPridat').addEventListener('click', () => $('vpObrazky').click());
  $('edZpet').addEventListener('click', zpet);
  $('edVlozka').addEventListener('click', () => { E.ukazVlozku = !E.ukazVlozku; kresliEditor(); });
  new ResizeObserver(() => { if (edSvg()) kresliVrstvu(); }).observe(ed);

  /* ---------- formuláře ---------- */
  $('vpNazev').addEventListener('input', () => { pr.nazev = $('vpNazev').value; zmena(true); });
  $('vpKlient').addEventListener('input', () => { pr.klient = $('vpKlient').value; zmena(true); });
  $('vpPoznamka').addEventListener('input', () => { pr.poznamka = $('vpPoznamka').value; zmena(true); });
  $('vpZStav').addEventListener('change', () => { pr.stav = $('vpZStav').value; zmena(true); });
  $('vpTermin').addEventListener('change', () => { pr.termin = /^\d{4}-\d{2}-\d{2}$/.test($('vpTermin').value) ? $('vpTermin').value : ''; zmena(true); });
  $('vpPary').addEventListener('change', () => { pr.pary = Math.max(1, Math.min(100, Math.round(+$('vpPary').value || 1))); zmena(true); });
  $('vpKarta').addEventListener('click', () => UI() && UI().stahniKartu());
  /* otevřít nabídku z jiného místa: klik nesmí doběhnout k dokumentu, ten nabídky zavírá */
  const otevriNabidku = (e, id) => { if (e) e.stopPropagation(); const b = $(id); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); };
  $('vpOtevritMeritko').addEventListener('click', (e) => otevriNabidku(e, 'btnPredlohaVl'));
  $('btnPridatLista').addEventListener('click', () => $('vpObrazky').click());
  $('nstMerit').addEventListener('click', () => { nastavRezim('merit'); ed.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  /* tlačítka, která přepnou editor do klikání, nabídku zavřou (jinak by překážela) */
  for (const id of ['vpKlikRohy', 'vpKlikBody', 'vpRez', 'vpNajit', 'vpAutoMeritko']) $(id).addEventListener('click', () => UI() && UI().zavriNabidky());
  $('vpAutoMeritko').addEventListener('click', () => { const o = aktObr(); if (o && autoMeritko(o, false)) zmena(); });
  $('vpRole').addEventListener('change', () => {
    const s = aktSab(); s.role = $('vpRole').value;
    if (s.role === 'stelka' && s.aktivni !== false) { s.aktivni = false; toast('Stélka z boty se netiskne – slouží k porovnání s chodidlem (záložka Porovnání).'); }
    zmena();
  });
  const prsty = (o) => { const s = aktSab(); s.prsty = Object.assign({}, C.SABLONA.prsty, s.prsty, o); navstiveno.obrysy = true; zmena(); };
  $('vpPrstyRezim').addEventListener('change', () => prsty({ rezim: $('vpPrstyRezim').value }));
  $('vpPrstySila').addEventListener('input', () => { $('vpPrstySilaH').textContent = fmt(+$('vpPrstySila').value, 1); });
  $('vpPrstySila').addEventListener('change', () => prsty({ sila: +$('vpPrstySila').value }));
  $('vpPrstyOd').addEventListener('input', () => { $('vpPrstyOdH').textContent = $('vpPrstyOd').value + ' %'; });
  $('vpPrstyOd').addEventListener('change', () => prsty({ od: +$('vpPrstyOd').value / 100 }));
  $('vpZapect').addEventListener('click', () => {
    const s = aktSab(); if (!s) return;
    const tol = Math.max(0.05, Math.min(3, parseFloat(String($('vpTolerance').value).replace(',', '.')) || 0.3)), pred = s.body.length;
    verze('před zapečením obrysu');
    E.zpet.push({ id: s.id, body: s.body.map((b) => b.slice()) });
    s.body = C.zapect(s, tol); s.prsty = Object.assign({}, C.SABLONA.prsty, s.prsty, { rezim: 'zadne' }); s.upraveno = true;
    zmena(); toast(`Obrys zjednodušen: ${pred} → ${s.body.length} uzlů (odchylka do ${fmt(tol, 2)} mm). Vrátit jde přes Zpět nebo historii verzí.`);
  });
  [['vpSpOx', 'ox'], ['vpSpOy', 'oy'], ['vpSpSp', 'spicka']].forEach(([id, k]) => $(id).addEventListener('change', () => { navstiveno.offset = true; const x = cislo($(id)); if (x !== null) pr.spolecne[k] = Math.max(-20, Math.min(40, x)); zmena(); }));
  $('vpPridat').addEventListener('click', () => $('vpObrazky').click());
  $('vpObrazky').addEventListener('change', async () => { const f = [...$('vpObrazky').files]; $('vpObrazky').value = ''; await pridejObrazky(f); });

  for (const id of ['vpObrSeznam', 'vpSabSeznam']) $(id).addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('li[role=option]')) { e.preventDefault(); e.target.click(); } });
  $('vpObrSeznam').addEventListener('click', async (e) => {
    const li = e.target.closest('[data-obr]'); if (!li) return;
    const o = pr.obrazky.find((q) => q.id === li.dataset.obr);
    if (e.target.closest('[data-smazobr]')) {
      if (!(await Dialog.potvrd(`Odebrat předlohu „${o.nazev}“ i s jejími ${sablonyObr(o).length} šablonami?`))) return;
      pr.obrazky = pr.obrazky.filter((q) => q !== o); pr.sablony = pr.sablony.filter((s) => s.obr !== o.id); cache.delete(o.id);
      if (E.obr === o.id) { E.obr = pr.obrazky.length ? pr.obrazky[0].id : null; E.sab = null; E.vb = null; }
      zmena(); return;
    }
    if (E.obr !== o.id) { E.obr = o.id; E.vb = null; E.klik = []; const s = sablonyObr(o)[0]; E.sab = s ? s.id : null; kresliPanely(); kresliEditor(); }
  });
  $('vpKalTyp').addEventListener('change', () => {
    const o = aktObr(), t = $('vpKalTyp').value; o.kalVolba = t;
    if (t === 'odhad') zmenKalibraci(o, { typ: 'odhad' });
    else if (t === 'karta') { const K = cache.get(o.id) && C.najdiKartu(cache.get(o.id).zdroj); if (K) zmenKalibraci(o, { typ: 'karta', rohy: K }); else { toast('Na obrázku nejsou vidět čtyři černé čtverce kalibrační karty.', true); o.kalVolba = o.kalibrace.typ; kresliPanely(); } }
    else if (t === 'dpi') zmenKalibraci(o, { typ: 'dpi', dpi: cislo($('vpDpi')) || 300 });
    else { kresliPanely(); if (UI()) UI().zavriNabidky(); nastavRezim(t === 'body' ? 'kal-body' : 'kal-list'); ed.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  });
  $('vpDpi').addEventListener('change', () => { const o = aktObr(), d = cislo($('vpDpi')); if (d > 10) zmenKalibraci(o, { typ: 'dpi', dpi: d }); });
  $('vpPapir').addEventListener('change', () => { const o = aktObr(); if (o.kalibrace.typ === 'list') zmenKalibraci(o, Object.assign({}, o.kalibrace, { papir: $('vpPapir').value })); });
  $('vpKlikRohy').addEventListener('click', () => { nastavRezim('kal-list'); ed.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  $('vpKlikBody').addEventListener('click', () => { nastavRezim('kal-body'); ed.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  [['vpRezim', 'rezim', 's'], ['vpHrana', 'hrana', 's'], ['vpCitlivost', 'citlivost', 'n'], ['vpUzavrit', 'uzavrit', 'n'], ['vpVyhlazeni', 'vyhlazeni', 'n'], ['vpKorekce', 'korekce', 'n']].forEach(([id, k, t]) => $(id).addEventListener('change', async () => {
    const o = aktObr(); if (!o) return;
    if (t === 's') o.detekce[k] = $(id).value; else { const x = cislo($(id)); if (x === null) return; o.detekce[k] = x; }
    await najdi(o);
  }));
  $('vpNajit').addEventListener('click', () => { const o = aktObr(); if (o) najdi(o); });
  $('vpRez').addEventListener('click', () => { if (!aktObr()) return; nastavRezim('rez'); ed.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  $('vpRezSmazat').addEventListener('click', async () => { const o = aktObr(); if (!o) return; o.rezy = []; await najdi(o); });

  $('vpSabSeznam').addEventListener('click', async (e) => {
    const li = e.target.closest('[data-sab]'); if (!li) return;
    const s = pr.sablony.find((q) => q.id === li.dataset.sab);
    if (e.target.closest('[data-smazsab]')) { if (await Dialog.potvrd(`Smazat šablonu ${s.strana}?`)) { verze('před smazáním šablony'); pr.sablony = pr.sablony.filter((q) => q !== s); if (E.sab === s.id) E.sab = null; zmena(); } return; }
    if (e.target.closest('[data-kopie]')) {
      const k = Object.assign({}, s, { id: novId(), body: s.body.map((b) => b.slice()), zrcadlit: !s.zrcadlit, strana: s.strana === 'P' ? 'L' : 'P', upraveno: false });
      pr.sablony.push(k); E.sab = k.id; zmena(); toast(`Vytvořena ${k.strana === 'P' ? 'pravá' : 'levá'} šablona zrcadlením.`); return;
    }
    if (e.target.matches('input,select')) return;
    if (E.sab !== s.id) { E.sab = s.id; E.uzel = -1; if (E.obr !== s.obr) { E.obr = s.obr; E.vb = null; } kresliPanely(); kresliEditor(); }
  });
  $('vpSabSeznam').addEventListener('change', (e) => {
    const li = e.target.closest('[data-sab]'); if (!li) return;
    const s = pr.sablony.find((q) => q.id === li.dataset.sab);
    if (e.target.matches('[data-akt]')) s.aktivni = e.target.checked;
    if (e.target.matches('[data-strana]')) s.strana = e.target.value;
    zmena();
  });
  $('vpZarovnani').addEventListener('change', () => { aktSab().zarovnani = $('vpZarovnani').value; zmena(); });
  $('vpUhel').addEventListener('change', () => { const x = cislo($('vpUhel')); if (x !== null) aktSab().uhelPlus = Math.max(-180, Math.min(180, x)); zmena(); });
  $('vpZrcadlit').addEventListener('change', () => { aktSab().zrcadlit = $('vpZrcadlit').checked; zmena(); });
  function kalibruj(osa) {
    const s = aktSab(), x = cislo($(osa === 'y' ? 'vpSkDelka' : 'vpSkSirka')); if (!s || !(x > 20)) { kresliPanely(); return; }
    const z = C.geometrie(s, pr.spolecne).zmereno;
    if (osa === 'y') s.sy = x / z.delka; else s.sx = x / z.sirka;
    zmena();
  }
  $('vpSkDelka').addEventListener('change', () => kalibruj('y'));
  $('vpSkSirka').addEventListener('change', () => kalibruj('x'));
  $('vpKalPrenest').addEventListener('click', () => { const s = aktSab(); if (!s) return; let n = 0; for (const q of pr.sablony) if (q !== s && q.obr === s.obr) { q.sx = s.sx; q.sy = s.sy; n++; } zmena(); toast(n ? `Měřítko přeneseno na ${n} ${n === 1 ? 'šablonu' : 'šablony'}.` : 'Na předloze není jiná šablona.'); });
  $('vpKalZrusit').addEventListener('click', () => { const s = aktSab(); if (!s) return; s.sx = 1; s.sy = 1; zmena(); });
  [['vpOx', 'ox'], ['vpOy', 'oy'], ['vpSp', 'spicka']].forEach(([id, k]) => $(id).addEventListener('change', () => { const x = cislo($(id)); if (x !== null) aktSab()[k] = Math.max(-20, Math.min(40, x)); zmena(); }));

  /* ---------- projekty: nabídka ---------- */
  function kresliHistorii() {
    const H = (pr && pr.historie) || [];
    $('vpHistorie').innerHTML = H.length ? H.map((h, i) => `<li><span>${new Date(h.cas).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${esc(h.popis)} <small>(${h.data.sablony.length} šabl.)</small></span><button type="button" data-verze="${i}">Obnovit</button></li>`).reverse().join('') : '<li><span style="color:var(--text-faint)">Zatím žádná uložená verze.</span></li>';
  }
  $('vpHistorie').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-verze]'); if (!b || !pr) return;
    const h = pr.historie[+b.dataset.verze]; UI().zavriNabidky();
    if (!(await Dialog.potvrd(`Obnovit verzi „${h.popis}“ z ${new Date(h.cas).toLocaleString('cs-CZ')}? Současný stav se uloží jako další verze.`))) return;
    verze('před obnovou verze');
    C.obnovSnimek(pr, h); E.zpet = []; E.vb = null;
    E.sab = pr.sablony.some((t) => t.id === E.sab) ? E.sab : (pr.sablony[0] ? pr.sablony[0].id : null);
    zmena(); toast('Verze obnovena.');
  });
  $('vpUlozVerzi').addEventListener('click', async () => {
    if (!pr) return;
    const n = await Dialog.zeptej('Popis verze:', 'ručně uložená verze'); if (n === null) return;
    verze(n.trim().slice(0, 80) || 'verze'); ulozPozdeji(); toast('Verze uložena (Projekt → Historie verzí).');
  });
  $('vpCsv').addEventListener('click', async () => {
    let L = [];
    try { await ulozHned(); L = await dbVse(); } catch (e) { toast('Projekty nejde načíst: ' + e.message, true); return; }
    L.sort((a, b) => String(a.termin || '9999').localeCompare(String(b.termin || '9999')));
    const p0 = UI() ? UI().p : J.VYCHOZI, rad = [['nazev', 'klient', 'stav', 'termin', 'paru', 'sablony', 'rozmery_mm', 'material', 'vytvoreno', 'upraveno', 'poznamka']];
    for (const q0 of L) {
      const q = C.ocisti(q0), v = C.sestav(q, Object.assign({}, p0, q.vyroba || {}));
      rad.push([q.nazev, q.klient, C.ZAKAZKA.nazvy[q.stav], q.termin, q.pary, v.nohy.length, v.nohy.map((n) => `${n.strana} ${Math.round(n.roz.delka)}x${Math.round(n.roz.sirka)}`).join(', '), (J.MATERIALY[(q.vyroba || {}).material] || J.MATERIALY.plst).nazev, q.vytvoreno.slice(0, 10), q.upraveno.slice(0, 10), q.poznamka]);
    }
    const csv = '\ufeff' + rad.map((r) => r.map((c) => (/[;"\n]/.test(String(c)) ? '"' + String(c).replace(/"/g, '""') + '"' : c)).join(';')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'zakazky_vlozky.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  });
  async function kresliSeznamProjektu() {
    kresliHistorii();
    let L = [];
    try { L = await dbVse(); } catch (e) { $('vpSeznam').innerHTML = '<li><span>Úložiště není dostupné.</span></li>'; return; }
    L.sort((a, b) => String(b.upraveno).localeCompare(String(a.upraveno)));
    $('vpSeznam').innerHTML = L.map((q) => `<li data-proj="${q.id}"><span title="${esc(q.nazev)}">${q.id === (pr && pr.id) ? '▶ ' : ''}${esc(q.nazev)}${q.klient ? ' <small style="color:var(--text-faint)">· ' + esc(q.klient) + '</small>' : ''}<span class="stitek-stav">${esc(C.ZAKAZKA.nazvy[q.stav] || 'rozpracováno')}${/^\d{4}-\d{2}-\d{2}$/.test(q.termin || '') ? ' · ' + esc(q.termin.slice(8) + '. ' + q.termin.slice(5, 7) + '.') : ''}</span></span><button type="button">Otevřít</button></li>`).join('') || '<li><span>Žádné projekty.</span></li>';
  }
  document.querySelector('[data-nabidka="nabProjekt"]').addEventListener('click', kresliSeznamProjektu);
  $('vpSeznam').addEventListener('click', async (e) => { const li = e.target.closest('[data-proj]'); if (!li) return; UI().zavriNabidky(); await otevri(li.dataset.proj); });
  async function otevri(id) {
    await ulozHned();
    let x = null;
    try { x = await dbDej(id); } catch (e) { toast('Projekt nejde načíst: ' + e.message, true); return; }
    if (!x) { toast('Projekt nenalezen.', true); return; }
    pr = C.ocisti(x);
    if (!pr.vyroba) pr.vyroba = vyrobaZ(UI() ? UI().p : J.VYCHOZI);
    try { localStorage.setItem(KLIC_POSL, pr.id); } catch (e) { /* nevadí */ }
    cache.clear(); navstiveno = {}; E.obr = pr.obrazky.length ? pr.obrazky[0].id : null; E.sab = null; E.vb = null; E.zpet = []; E.rezim = 'posun'; E.klik = [];
    const s0 = E.obr && pr.sablony.find((s) => s.obr === E.obr); E.sab = s0 ? s0.id : null;
    $('vpStav').textContent = '';
    for (const o of pr.obrazky) { try { await pripravObr(o); } catch (e) { toast(`Předlohu „${o.nazev}“ se nepodařilo načíst.`, true); } }
    if (pr.vyroba && UI()) UI().nastav(pr.vyroba);
    kresliPanely(); kresliEditor(); if (UI()) UI().prepocitej();
  }
  async function zalozNovy(nazev) {
    const n = novyProjekt(nazev);
    try { await dbUloz(n); await otevri(n.id); }
    catch (e) { toast('Úložiště prohlížeče není dostupné – projekt poběží jen do zavření stránky. ' + e.message, true); pr = n; kresliPanely(); kresliEditor(); }
  }
  $('vpNovy').addEventListener('click', async () => { const n = await Dialog.zeptej('Název nového projektu (např. jméno a typ bot):', 'Projekt ' + new Date().toLocaleDateString('cs-CZ')); if (n === null) return; await zalozNovy(n.trim() || undefined); toast('Nový projekt založen. Přidejte předlohu.'); });
  $('vpDuplikovat').addEventListener('click', async () => {
    if (!pr) return;
    const k = JSON.parse(JSON.stringify(pr)); k.id = novId(); k.nazev += ' (kopie)'; k.vytvoreno = new Date().toISOString();
    try { await dbUloz(k); await otevri(k.id); toast('Projekt zduplikován.'); } catch (e) { toast('Duplikace selhala: ' + e.message, true); }
  });
  $('vpSmazat').addEventListener('click', async () => {
    if (!pr || !(await Dialog.potvrd(`Smazat projekt „${pr.nazev}“ včetně předloh? Nejde vrátit.`))) return;
    try {
      clearTimeout(casUlozeni); cekajici = null;
      await dbSmaz(pr.id); pr = null; const L = await dbVse();
      if (L.length) { L.sort((a, b) => String(b.upraveno).localeCompare(String(a.upraveno))); await otevri(L[0].id); } else await zalozNovy();
    } catch (e) { toast('Smazání selhalo: ' + e.message, true); }
  });
  $('vpExport').addEventListener('click', () => {
    if (!pr) return;
    const a = document.createElement('a'), jm = (pr.nazev || 'projekt').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ format: 'barefoot-vlozky-projekt', verze: 1, projekt: pr })], { type: 'application/json' }));
    a.download = 'vlozky_' + jm + '.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  });
  $('vpImport').addEventListener('click', () => $('vpSoubor').click());
  $('vpSoubor').addEventListener('change', async () => {
    const f = $('vpSoubor').files[0]; $('vpSoubor').value = ''; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d || d.format !== 'barefoot-vlozky-projekt' || !d.projekt) throw new Error('soubor není projekt vložek na míru');
      const n = C.ocisti(Object.assign({}, d.projekt, { id: novId() }));
      await dbUloz(n); await otevri(n.id); toast('Importováno: ' + n.nazev);
    } catch (e) { toast('Import selhal: ' + e.message, true); }
  });

  /* ---------- okno Kalibrace: měřítko předlohy a rozměry šablon ---------- */
  const potrebaKalibrace = () => !!pr && pr.obrazky.some((o) => C.meritko(o.kalibrace, o.w, o.h).odhad && sablonyObr(o).some((t) => t.sx === 1 && t.sy === 1));
  function kresliKalibraci() {
    if (!pr) return;
    const o = aktObr();
    $('kalPredlohaInfo').innerHTML = o ? `Předloha <b>${esc(o.nazev)}</b>: ${esc(popisKalibrace(o))}` : 'Nejdřív přidejte předlohu (sken nebo fotku).';
    $('kalKvalita').innerHTML = o && o.kvalita ? `<li class="${o.kvalita.skore >= 75 ? 'ok' : o.kvalita.skore >= 50 ? 'varovani' : 'chyba'}">Kvalita fotky ${o.kvalita.skore} %</li>` + o.kvalita.varovani.map((q) => `<li class="${q.uroven}">${esc(q.text)}</li>`).join('') : '';
    ['kalAuto', 'kalRohy', 'kalBody', 'kalDpiPouzit'].forEach((id) => { $(id).disabled = !o; });
    if (o && o.kalibrace.typ === 'dpi') $('kalDpi').value = o.kalibrace.dpi;
    $('kalSablony').innerHTML = pr.sablony.length ? '<tr><th>Šablona</th><th class="c">Z předlohy</th><th>Skutečná délka</th><th>Skutečná šířka</th><th></th></tr>' + pr.sablony.map((t) => {
      const z = C.geometrie(t, pr.spolecne).zmereno, kal = Math.abs(t.sx - 1) > 1e-9 || Math.abs(t.sy - 1) > 1e-9;
      return `<tr data-ks="${t.id}"><td>${t.strana} · ${esc(C.ROLE[t.role || 'noha'])}</td><td class="c">${fmt(z.delka, 1)} × ${fmt(z.sirka, 1)}</td><td><input type="number" step="0.5" data-osa="y" value="${Math.round(z.delka * t.sy * 10) / 10}" aria-label="Skutečná délka mm"></td><td><input type="number" step="0.5" data-osa="x" value="${Math.round(z.sirka * t.sx * 10) / 10}" aria-label="Skutečná šířka mm"></td><td>${kal ? '<button class="mini" data-zrus>zrušit</button>' : ''}</td></tr>`;
    }).join('') : '<tr><td class="info">Zatím žádné šablony.</td></tr>';
  }
  $('kalSablony').addEventListener('change', (e) => {
    const tr = e.target.closest('[data-ks]'), osa = e.target.dataset.osa; if (!tr || !osa) return;
    const t = pr.sablony.find((q) => q.id === tr.dataset.ks), x = cislo(e.target); if (!t || !(x > 20)) return;
    const z = C.geometrie(t, pr.spolecne).zmereno;
    if (osa === 'y') t.sy = x / z.delka; else t.sx = x / z.sirka;
    zmena(); kresliKalibraci();
  });
  $('kalSablony').addEventListener('click', (e) => { const tr = e.target.closest('[data-ks]'); if (!tr || !e.target.closest('[data-zrus]')) return; const t = pr.sablony.find((q) => q.id === tr.dataset.ks); t.sx = 1; t.sy = 1; zmena(); kresliKalibraci(); });
  const zavriKal = () => { const d = $('dlgKalibrace'); if (d.open) d.close(); };
  $('kalAuto').addEventListener('click', () => { const o = aktObr(); if (o && autoMeritko(o, false)) { zmena(); kresliKalibraci(); } });
  $('kalRohy').addEventListener('click', () => { $('vpPapir').value = $('kalPapir').value; zavriKal(); nastavRezim('kal-list'); ed.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  $('kalBody').addEventListener('click', () => { zavriKal(); nastavRezim('kal-body'); ed.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  $('kalDpiPouzit').addEventListener('click', () => { const o = aktObr(), d = cislo($('kalDpi')); if (o && d > 10) { zmenKalibraci(o, { typ: 'dpi', dpi: d }); kresliKalibraci(); } });
  $('kalKarta').addEventListener('click', () => UI() && UI().stahniKartu());

  /* ---------- fotoaparát ---------- */
  let proud = null;
  const zastavKameru = () => { if (proud) { proud.getTracks().forEach((t) => t.stop()); proud = null; } $('kamVideo').srcObject = null; };
  async function vyfotit() {
    if (UI()) UI().zavriNabidky();
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { $('vpFoto').click(); return; }
    try {
      proud = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } }, audio: false });
      $('kamVideo').srcObject = proud; await $('kamVideo').play();
      $('dlgKamera').showModal();
    } catch (e) { zastavKameru(); toast('Fotoaparát nejde spustit (' + e.message + ') – otevírám výběr fotky.', true); $('vpFoto').click(); }
  }
  $('dlgKamera').addEventListener('close', zastavKameru);
  $('kamFoto').addEventListener('click', () => {
    const vid = $('kamVideo'); if (!vid.videoWidth) return;
    const c = document.createElement('canvas'); c.width = vid.videoWidth; c.height = vid.videoHeight; c.getContext('2d').drawImage(vid, 0, 0);
    c.toBlob(async (b) => { $('dlgKamera').close(); if (b) await pridejObrazky([new File([b], 'foto_' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.jpg', { type: 'image/jpeg' })]); }, 'image/jpeg', 0.92);
  });
  $('kamSoubor').addEventListener('click', () => { $('dlgKamera').close(); $('vpFoto').click(); });
  $('vpFoto').addEventListener('change', async () => { const f = [...$('vpFoto').files]; $('vpFoto').value = ''; await pridejObrazky(f); });
  for (const id of ['vpFotit', 'btnFotoLista', 'rchFoto']) $(id).addEventListener('click', vyfotit);

  /* ---------- jednoduchý režim ---------- */
  function kresliRychle() {
    if (!pr) return;
    const n = pr.sablony.filter((t) => t.aktivni !== false).length, o = aktObr();
    $('rchStav').innerHTML = !pr.obrazky.length ? 'Zatím žádná fotka.' : !n ? '<span class="warn-t">Na fotce se nenašel obrys – zkuste ji vyfotit znovu, ostře a kolmo.</span>' :
      `${n} ${n === 1 ? 'šablona' : n < 5 ? 'šablony' : 'šablon'} připraveno · ${o && !C.meritko(o.kalibrace, o.w, o.h).odhad ? '<span class="ok-t">měřítko ✓</span>' : '<span class="warn-t">měřítko jen odhadem – použijte kalibrační kartu</span>'}` + (o && o.kvalita ? ` · kvalita fotky ${o.kvalita.skore} %` : '');
  }
  $('rchNahrat').addEventListener('click', () => $('vpObrazky').click());
  $('rchPdf').addEventListener('click', () => $('btnPdf').click());
  $('rchKarta').addEventListener('click', (e) => { e.preventDefault(); if (UI()) UI().stahniKartu(); });

  /* ---------- QR (knihovna se načte až při potřebě) ---------- */
  let qrLib = null;
  const nactiQR = () => qrLib || (qrLib = new Promise((ok, chyba) => { if (window.QRCode) { ok(window.QRCode); return; } const sc = document.createElement('script'); sc.src = 'lib/qrcode.min.js'; sc.onload = () => ok(window.QRCode); sc.onerror = () => chyba(new Error('QR knihovna se nenačetla')); document.head.appendChild(sc); }));
  async function qrObrazek(text) {
    const Q = await nactiQR(), div = document.createElement('div');
    new Q(div, { text, width: 512, height: 512, correctLevel: Q.CorrectLevel.L });
    const c = div.querySelector('canvas'); return c ? c.toDataURL('image/png') : null;
  }
  const bilyObrazek = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); return c.toDataURL('image/png'); };
  const odkazNa = (kod) => location.href.split('#')[0] + '#bv=' + kod;

  /* ---------- sdílení odkazem ---------- */
  $('vpSdilet').addEventListener('click', async () => {
    if (!pr || !pr.sablony.length) { toast('Projekt zatím nemá žádné obrysy ke sdílení.', true); return; }
    try {
      const url = odkazNa(await C.zakoduj(pr));
      $('sdilOdkaz').value = url; $('sdilQr').innerHTML = '';
      if (url.length <= 2900) { const Q = await nactiQR(); new Q($('sdilQr'), { text: url, width: 600, height: 600, correctLevel: Q.CorrectLevel.L }); $('sdilInfo').textContent = `Odkaz má ${url.length} znaků; QR načtete fotoaparátem telefonu.`; }
      else $('sdilInfo').textContent = `Odkaz má ${url.length} znaků – na QR kód je příliš dlouhý, pošlete ho jako text.`;
      $('dlgSdilet').showModal();
    } catch (e) { toast('Odkaz se nepodařilo vytvořit: ' + e.message, true); }
  });
  $('sdilKopirovat').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('sdilOdkaz').value); toast('Odkaz zkopírován.'); } catch (e) { $('sdilOdkaz').select(); toast('Zkopírujte odkaz ručně (Ctrl+C).'); } });
  /* otevření sdíleného odkazu: kopie projektu */
  async function zkontrolujOdkaz() {
    const m = location.hash.match(/^#bv=([A-Za-z0-9_-]+)$/); if (!m) return;
    history.replaceState(null, '', location.href.split('#')[0]);
    if (!(await Dialog.potvrd('Otevřít sdílené obrysy vložek jako nový projekt?'))) return;
    try {
      const n = C.ocisti(Object.assign(await C.dekoduj(m[1], bilyObrazek), { id: novId() }));
      n.nazev = (n.nazev || 'Sdílený projekt') + ' (sdíleno)';
      await dbUloz(n); await otevri(n.id); toast('Sdílené obrysy otevřeny – fotky nejsou součástí odkazu.');
    } catch (e) { toast('Odkaz se nepodařilo otevřít: ' + e.message, true); }
  }
  addEventListener('hashchange', () => { if (/^#bv=/.test(location.hash)) { if (UI() && UI().typ !== 'vlastni') UI().nastavTyp('vlastni'); else zkontrolujOdkaz(); } });

  /* ---------- štítek zakázky ---------- */
  $('vpStitek').addEventListener('click', async () => {
    if (!pr || !UI()) return;
    try {
      if (!window.jspdf) throw new Error('jsPDF se nenačetl');
      const v = UI().v, p = UI().p;
      const radky = [pr.nazev, ...v.nohy.map((n) => `${n.strana === 'P' ? 'pravá' : 'levá'}: ${fmt(n.roz.delka)} × ${fmt(n.roz.sirka)} mm (EU ~${fmt(n.vel.eu, n.vel.eu % 1 ? 1 : 0)})`),
        p.rezim === 'vlozka' ? `${J.MATERIALY[p.material].nazev} ${fmt(p.tloustka, 1)} mm${p.vrstvy ? ' + ' + J.MATERIALY[p.material2].nazev.toLowerCase() + ' ' + fmt(p.tloustka2, 1) + ' mm' : ''}` : 'kontrolní šablona',
        `${C.ZAKAZKA.nazvy[pr.stav] || ''}${pr.termin ? ' · termín ' + new Date(pr.termin).toLocaleDateString('cs-CZ') : ''} · ${pr.pary || 1} pár`].slice(0, 7);
      let qrText = '';
      try { const u = odkazNa(await C.zakoduj(pr)); qrText = u.length <= 1800 ? u : ''; } catch (e) { /* bez odkazu */ }
      if (!qrText) qrText = [pr.klient || pr.nazev, ...radky].join('\n');
      const doc = V.pdfStitek(window.jspdf.jsPDF, { titul: pr.klient || pr.nazev, radky: radky.map((t) => t.slice(0, 48)) }, await qrObrazek(qrText), { pismo: await UI().nactiPismo() });
      const a = document.createElement('a'); a.href = URL.createObjectURL(doc.output('blob')); a.download = 'stitek_' + (pr.klient || pr.nazev).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '_').toLowerCase() + '.pdf'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (e) { toast('Štítek se nepodařilo vytvořit: ' + e.message, true); }
  });

  /* ---------- zálohy všech projektů ---------- */
  $('vpZalohaVse').addEventListener('click', async () => {
    try {
      await ulozHned(); const L = await dbVse();
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ format: 'barefoot-vlozky-zaloha', verze: 1, datum: new Date().toISOString(), projekty: L })], { type: 'application/json' }));
      a.download = 'vlozky_zaloha_' + new Date().toISOString().slice(0, 10) + '.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast(`Záloha ${L.length} projektů stažena.`);
    } catch (e) { toast('Zálohu se nepodařilo vytvořit: ' + e.message, true); }
  });
  $('vpZalohaObnov').addEventListener('click', () => $('vpZalohaSoubor').click());
  $('vpZalohaSoubor').addEventListener('change', async () => {
    const f = $('vpZalohaSoubor').files[0]; $('vpZalohaSoubor').value = ''; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d || d.format !== 'barefoot-vlozky-zaloha' || !Array.isArray(d.projekty)) throw new Error('soubor není záloha projektů vložek');
      const ids = new Set((await dbVse()).map((q) => q.id)); let n = 0;
      for (const x of d.projekty.slice(0, 500)) { const q = C.ocisti(x); if (ids.has(q.id)) { q.id = novId(); q.nazev += ' (obnoveno)'; } await dbUloz(q); n++; }
      toast(`Obnoveno ${n} projektů ze zálohy.`); kresliSeznamProjektu();
    } catch (e) { toast('Obnova selhala: ' + e.message, true); }
  });

  /* ---------- vývoj nohou klienta ---------- */
  async function kresliVyvoj() {
    let L = [];
    try { await ulozHned(); L = (await dbVse()).map(C.ocisti); } catch (e) { $('vyvTab').innerHTML = ''; return; }
    const klic = (k) => (k || '').trim().toLowerCase() || '(bez klienta)';
    const klienti = [...new Set(L.map((q) => klic(q.klient)))].sort();
    const vyb = $('vyvKlient').value && klienti.includes($('vyvKlient').value) ? $('vyvKlient').value : klic(pr && pr.klient);
    $('vyvKlient').innerHTML = klienti.map((k) => `<option value="${esc(k)}"${k === vyb ? ' selected' : ''}>${esc(k)}</option>`).join('');
    const p0 = UI() ? UI().p : J.VYCHOZI;
    const zaznamy = L.filter((q) => klic(q.klient) === vyb).sort((a, b) => a.vytvoreno.localeCompare(b.vytvoreno)).map((q) => {
      const n = C.sestav(q, Object.assign({}, p0, q.vyroba || {}), { vse: true }).nohy.filter((x) => x.role !== 'stelka');
      const st = (s) => { const x = n.find((y) => y.strana === s); return x ? { d: x.m.delka, w: x.m.sirka } : null; };
      return { datum: new Date(q.vytvoreno), nazev: q.nazev, L: st('L'), P: st('P') };
    });
    $('vyvTab').innerHTML = '<tr><th>Datum</th><th>Projekt</th><th class="c">Levá d × š</th><th class="c">Pravá d × š</th></tr>' + zaznamy.map((z) => `<tr><td>${z.datum.toLocaleDateString('cs-CZ')}</td><td>${esc(z.nazev)}</td><td class="c">${z.L ? fmt(z.L.d) + ' × ' + fmt(z.L.w) : '–'}</td><td class="c">${z.P ? fmt(z.P.d) + ' × ' + fmt(z.P.w) : '–'}</td></tr>`).join('');
    const body = zaznamy.flatMap((z) => [z.L, z.P].filter(Boolean).map((q) => q.d));
    if (zaznamy.length < 2 || !body.length) { $('vyvGraf').innerHTML = '<p class="info">Graf se ukáže, až budou pro klienta aspoň dva projekty v různých dnech.</p>'; return; }
    const t0 = +zaznamy[0].datum, t1 = Math.max(t0 + 864e5, +zaznamy[zaznamy.length - 1].datum), dmin = Math.min(...body) - 3, dmax = Math.max(...body) + 3, W = 560, H = 200, m = 36;
    const X = (t) => m + (t - t0) / (t1 - t0) * (W - 2 * m), Y = (d) => H - 24 - (d - dmin) / (dmax - dmin) * (H - 44);
    const cara = (s, barva) => { const P = zaznamy.filter((z) => z[s]).map((z) => [X(+z.datum), Y(z[s].d)]); return P.length ? `<path d="M${P.map((q) => q.map((x) => x.toFixed(1)).join(' ')).join('L')}" fill="none" stroke="${barva}" stroke-width="2"/>` + P.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="${barva}"/>`).join('') : ''; };
    const mes = (t1 - t0) / (30.44 * 864e5), prv = zaznamy.find((z) => z.P || z.L), pos = [...zaznamy].reverse().find((z) => z.P || z.L), dd = (pos.P || pos.L).d - (prv.P || prv.L).d;
    $('vyvGraf').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Délka nohou v čase"><line x1="${m}" y1="${H - 24}" x2="${W - m}" y2="${H - 24}" stroke="currentColor" stroke-opacity=".3"/><text x="${m}" y="${H - 8}" font-size="11" fill="currentColor">${zaznamy[0].datum.toLocaleDateString('cs-CZ')}</text><text x="${W - m}" y="${H - 8}" font-size="11" text-anchor="end" fill="currentColor">${zaznamy[zaznamy.length - 1].datum.toLocaleDateString('cs-CZ')}</text><text x="4" y="${Y(dmax - 3) + 4}" font-size="11" fill="currentColor">${fmt(dmax - 3)}</text><text x="4" y="${Y(dmin + 3) + 4}" font-size="11" fill="currentColor">${fmt(dmin + 3)}</text>${cara('L', '#c0392b')}${cara('P', '#1f5fa8')}</svg><p class="info">Délka: <span style="color:#c0392b">levá</span>, <span style="color:#1f5fa8">pravá</span>. Za ${fmt(mes, 1)} měsíce ${dd >= 0 ? '+' : '−'}${fmt(Math.abs(dd), 1)} mm${mes >= 1 ? ` (asi ${fmt(dd / mes, 1)} mm za měsíc)` : ''}.</p>`;
  }
  $('vyvKlient').addEventListener('change', kresliVyvoj);

  /* ---------- napojení na ui.js ---------- */
  let aktivovano = false, jine = [];
  window.BFV_UI = {
    async aktivuj() {
      if (aktivovano) { if (pr && pr.vyroba && UI()) UI().nastav(pr.vyroba); kresliEditor(); await zkontrolujOdkaz(); return; }
      aktivovano = true;
      try {
        let id = null; try { id = localStorage.getItem(KLIC_POSL); } catch (e) { /* nevadí */ }
        const L = await dbVse();
        if (id && L.some((q) => q.id === id)) await otevri(id);
        else if (L.length) { L.sort((a, b) => String(b.upraveno).localeCompare(String(a.upraveno))); await otevri(L[0].id); }
        else await zalozNovy();
      } catch (e) { console.error(e); toast('Projekty nejde načíst (IndexedDB): ' + e.message, true); pr = novyProjekt(); kresliPanely(); }
      await zkontrolujOdkaz();
    },
    sestav(p) { return C.sestav(pr || { obrazky: [], sablony: [] }, p); },
    /* i vypnuté šablony a stélky – pro porovnání */
    nohyVse(p) { return C.sestav(pr || { obrazky: [], sablony: [] }, p, { vse: true }); },
    /* ostatní projekty (pro arch) – načtou se jednou při otevření výběru */
    async jineProjekty() {
      try { await ulozHned(); jine = (await dbVse()).filter((q) => !pr || q.id !== pr.id).map(C.ocisti); } catch (e) { jine = []; }
      return jine.map((q) => ({ id: q.id, nazev: q.nazev, klient: q.klient }));
    },
    sadyMix(mix, p) {
      return Object.entries(mix || {}).map(([id, pary]) => {
        const q = jine.find((x) => x.id === id); if (!q || !pary) return null;
        const nohy = C.sestav(q, Object.assign({}, p, q.vyroba || {})).nohy;
        return nohy.length ? { nohy, pary, nazev: q.klient || q.nazev } : null;
      }).filter(Boolean);
    },
    ulozVyrobu(p) { if (!pr) return; const v = vyrobaZ(p); if (JSON.stringify(v) !== JSON.stringify(pr.vyroba)) { pr.vyroba = v; ulozPozdeji(); } },
    get projekt() { return pr; },
    potrebaKalibrace, kresliKalibraci, kresliVyvoj, vyfotit, vyhladitVlnky,
    get editor() { return E; },
    najdi: (o) => najdi(o || aktObr()),
    pridejObrazky,
    zmenKalibraci: (k) => zmenKalibraci(aktObr(), k),
  };
})();
