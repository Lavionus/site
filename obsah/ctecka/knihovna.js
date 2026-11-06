/* Univerzální čtečka knih (obsah/ctecka_knih.html) – rozhraní knihovny a spuštění společné čtečky.
   Data (IndexedDB, web, záloha, deník) jsou v ctecka/knihovna_data.js (KNIH_DATA), převod formátů v ctecka/prevod.js.
   ctecka_knih.html = knihovna, ctecka_knih.html?id=<kniha> = čtení. */
(async () => {
  'use strict';
  const J = window.KRONIKY_JADRO, P = window.CTECKA_PREVOD, D = window.KNIH_DATA;
  const nast = { razeni: 'cteno', cil: 0, ...D.cti(D.KLIC) };
  const ulozNast = () => { try { localStorage.setItem(D.KLIC, JSON.stringify(nast)); } catch (e) {} };
  const esc = s => J.esc(String(s == null ? '' : s));

  const id = new URLSearchParams(location.search).get('id');
  if (id) return ctiKnihu(id);
  return spravce();

  /* =================== čtení: společná čtečka nad knihou z IndexedDB =================== */
  async function ctiKnihu(id) {
    let meta = await D.metaKnihy(id);
    if (!meta) { location.replace('ctecka_knih.html'); return; }
    // napojená kniha z webu: před čtením stáhnout novější verzi (offline / pomalá síť = čte se uložená)
    if (meta.web) {
      const seznam = await D.seznamWeb(3000);
      if ((await D.aktualizujZWebu([meta], seznam)).length) Dialog.info('🌐 Kniha aktualizována z webu');
    }
    const obsah = await D.obsahKnihy(id);
    // nová kniha převezme vzhled (písmo, motiv…) z naposledy čtené
    if (!localStorage.getItem(D.klicKnihy(id)) && nast.posledni) {
      const s = D.stavKnihy(nast.posledni);
      if (s.nast) try { localStorage.setItem(D.klicKnihy(id), JSON.stringify({ nast: s.nast })); } catch (e) {}
    }
    nast.posledni = id; ulozNast();
    meta.otevreno = Date.now();
    if (!meta.zacato) meta.zacato = Date.now();
    D.ulozMeta(meta);
    const urls = {};
    for (const [jm, blob] of Object.entries(obsah.obrazky || {})) urls[jm] = URL.createObjectURL(blob);
    window.CTECKA_DILO = {
      id: 'vlastni_' + id, nazev: meta.nazev, ikona: '📖', autor: meta.autor || undefined,
      stranka: 'ctecka_knih.html?id=' + encodeURIComponent(id), klic: D.klicKnihy(id),
      soubor: J.normalizuj(meta.nazev).replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').slice(0, 60) || 'kniha',
      zdroj: {
        knihy: async () => [{ id: 'kniha', nazev: meta.nazev, podtitul: meta.autor || meta.soubor, kapitoly: meta.kapitoly, obalka: meta.obalka || undefined }],
        kapitola: async (k, soubor) => obsah.md[soubor] || '',
        obrazek: (k, src) => urls[src] || '',
      },
    };
    await nactiSkript('ctecka/sablona.js');
    upravCtecku();
    await nactiSkript('ctecka/ctecka.js');
  }
  function nactiSkript(src) {
    return new Promise((ok, ko) => {
      const s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = ko;
      document.body.appendChild(s);
    });
  }
  // vlastní kniha není na webu: bez sazby, odkazů, betačtení a stahování „pro offline“ (je už v zařízení)
  function upravCtecku() {
    ['odkaz', 'tisk-knihy', 'sazba-kapitoly', 'offline', 'odeslat-poznamky', 'nacist-poznamky', 'odkaz-beta']
      .forEach(p => document.querySelectorAll(`[data-prikaz="${p}"]`).forEach(b => b.remove()));
    document.querySelectorAll('.nabidka .titulek').forEach(t => {
      if (/^Sdílet/.test(t.textContent)) t.remove();
      if (/^Betačtení/.test(t.textContent)) t.textContent = 'Poznámky';
    });
    document.getElementById('hledat').placeholder = '🔍 Hledat v knize…';
    const h1 = document.querySelector('#lista h1');
    h1.insertAdjacentHTML('beforebegin', '<button class="tl" id="tlKnihovna" title="Zpět do knihovny">📚<span class="txt"> Knihovna</span></button>');
    document.getElementById('tlKnihovna').onclick = () => { location.href = 'ctecka_knih.html'; };
  }

  /* =================== správce knihovny =================== */
  async function spravce() {
    document.body.insertAdjacentHTML('afterbegin', `
<header class="lista">
  <h1>📚<span class="nazev-webu"> Čtečka knih</span></h1>
  <div class="skup" role="group" aria-label="Knihovna"><span class="skup-nazev" aria-hidden="true">Knihovna</span><div class="skup-tl">
    <button class="tl" id="tlPridat" data-nab="nabPridat" title="Přidat knihu ze zařízení, celou složku nebo moje knihy z webu">➕<span class="txt"> Přidat</span> ▾</button>
    <button class="tl" id="tlRazeni" data-nab="nabRazeni" title="Řazení a filtr knih">↕<span class="txt"> Řadit a filtr</span> ▾</button>
    <button class="tl" id="tlDenik" title="Čtenářský deník: dočtené knihy, statistiky, roční cíl">📊<span class="txt"> Deník</span></button>
    <button class="tl" id="tlNastroje" data-nab="nabNastroje" title="Záloha a obnova knihovny, nápověda">🧰<span class="txt"> Nástroje</span> ▾</button>
  </div></div>
  <div class="skup skup-hledat"><input class="vstup" id="hledat" type="search" placeholder="Hledat název, autora, sérii…" aria-label="Hledat v knihovně"></div>
</header>
<div class="nabidka" id="nabPridat" hidden>
  <button class="tl" data-prikaz="soubory">📄 Soubory ze zařízení… <kbd>EPUB, MOBI, MD, TXT</kbd></button>
  <button class="tl" data-prikaz="slozka">🗂 Celá složka s knihami…</button>
  <hr>
  <button class="tl" data-prikaz="web">🌐 Moje knihy z webu…</button>
</div>
<div class="nabidka" id="nabRazeni" hidden>
  <div class="titulek">Řadit podle</div>
  <button class="tl prep" data-razeni="cteno">Naposledy čtené</button>
  <button class="tl prep" data-razeni="pridano">Naposledy přidané</button>
  <button class="tl prep" data-razeni="nazev">Názvu</button>
  <button class="tl prep" data-razeni="autor">Autora</button>
  <button class="tl prep" data-razeni="serie">Série (po policích)</button>
  <button class="tl prep" data-razeni="pokrok">Pokroku čtení</button>
  <button class="tl prep" data-razeni="hodnoceni">Hodnocení</button>
  <hr><div class="titulek">Zobrazit</div>
  <button class="tl prep" data-filtr="">Všechny knihy</button>
  <button class="tl prep" data-filtr="rozectene">Rozečtené</button>
  <button class="tl prep" data-filtr="neprectene">Nepřečtené</button>
  <button class="tl prep" data-filtr="doctene">Dočtené</button>
  <button class="tl prep" data-filtr="web">Moje knihy z webu</button>
</div>
<div class="nabidka" id="nabNastroje" hidden>
  <button class="tl" data-prikaz="zaloha">💾 Zálohovat celou knihovnu (ZIP)</button>
  <button class="tl" data-prikaz="obnova">📂 Obnovit knihovnu ze zálohy…</button>
  <hr>
  <button class="tl" data-prikaz="aktualizovat">🔄 Zkontrolovat knihy z webu</button>
  <button class="tl" data-prikaz="napoveda">❓ Nápověda</button>
</div>
<input type="file" id="soubor" multiple accept=".epub,.mobi,.prc,.azw,.azw3,.md,.markdown,.txt,.text,image/*" hidden>
<input type="file" id="slozka" webkitdirectory multiple hidden>
<input type="file" id="souborZaloha" accept=".zip,application/zip" hidden>
<main class="knihovna" id="knihovna"></main>

<div class="modal" id="mWeb" hidden><div class="okno siroke">
  <button class="tl zavrit" data-zavrit>✕</button>
  <h2>🌐 Moje knihy z webu</h2>
  <p class="napoveda">Knihy, které autor nahrál na web. Přidaná kniha je <b>napojená</b>: když se na webu změní, knihovna i čtečka si ji samy stáhnou znovu – pozice, záložky a poznámky zůstanou.</p>
  <div id="webSeznam"></div>
</div></div>

<div class="modal" id="mUprava" hidden><div class="okno siroke">
  <button class="tl zavrit" data-zavrit>✕</button>
  <h2>✏️ Upravit knihu</h2>
  <div class="uprava">
    <div class="uprava-obal">
      <div class="obal" id="upObal"></div>
      <button class="tl" id="upObalNahrat">🖼 Obálka z obrázku…</button>
      <button class="tl" id="upObalOdebrat">Bez obálky</button>
      <input type="file" id="upObalSoubor" accept="image/*" hidden>
    </div>
    <div class="uprava-pole">
      <label>Název <input class="vstup" id="upNazev"></label>
      <label>Autor <input class="vstup" id="upAutor"></label>
      <div class="dva"><label>Série <input class="vstup" id="upSerie" list="seznamSerii"></label><label class="uzke">Díl <input class="vstup" id="upDil" type="number" min="0" step="0.5"></label></div>
      <datalist id="seznamSerii"></datalist>
      <div class="pole-nazev">Hodnocení</div>
      <div class="hvezdy" id="upHvezdy">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="hvezda" data-hvezda="${n}" aria-label="${n} z 5">★</button>`).join('')}<button type="button" class="tl" data-hvezda="0" title="Bez hodnocení">✕</button></div>
      <div class="dva"><label>Začato <input class="vstup" id="upZacato" type="date"></label><label>Dočteno <input class="vstup" id="upDokonceno" type="date"></label></div>
      <label>Poznámka do deníku <textarea class="vstup" id="upPoznamka" rows="3"></textarea></label>
    </div>
  </div>
  <h3 id="upKapNadpis">Kapitoly</h3>
  <p class="napoveda" id="upKapNapoveda">Když převod rozdělil knihu špatně: přejmenujte kapitolu, spojte ji s předchozí (⤒) nebo odeberte (🗑).</p>
  <div id="upKapitoly" class="kap-seznam"></div>
  <div class="tlacitka"><button class="tl" data-zavrit>Zrušit</button><button class="tl hlavni" id="upUlozit">💾 Uložit</button></div>
</div></div>

<div class="modal" id="mDenik" hidden><div class="okno siroke">
  <button class="tl zavrit" data-zavrit>✕</button>
  <h2>📊 Čtenářský deník <select class="vstup" id="dRok" aria-label="Rok" style="width:auto;margin-left:8px"></select></h2>
  <div id="denikObsah"></div>
  <label class="cil">Roční cíl: <input class="vstup" id="dCil" type="number" min="0" max="999" style="width:80px"> knih</label>
</div></div>`);
    const $ = id => document.getElementById(id);
    let knihy = await D.vsechnyMeta();
    const obalkyUrl = new Map();
    const barva = t => { let h = 0; for (const z of t) h = (h * 31 + z.charCodeAt(0)) % 360; return `linear-gradient(160deg,hsl(${h} 45% 38%),hsl(${(h + 40) % 360} 50% 22%))`; };
    function obalHtml(m) {
      if (m.obalkaBlob) {
        if (!obalkyUrl.has(m.id)) obalkyUrl.set(m.id, URL.createObjectURL(m.obalkaBlob));
        return `<img src="${obalkyUrl.get(m.id)}" alt="" loading="lazy">`;
      }
      return `<div class="gen" style="background:${barva(m.nazev)}"><b>${esc(m.nazev)}</b><span>${esc(m.autor)}</span></div>`;
    }
    const procentaZbyva = (m, p) => p >= 0.999 ? '100 %' : `${Math.floor(p * 100)} % · zbývá ${J.formatCas(m.slov * (1 - p) / 220)}`;
    const hvezdy = n => n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '';
    const dil = m => m.dil != null && m.dil !== '' ? `${String(m.dil).replace('.', ',')}. díl` : '';
    const otevriKnihu = m => { location.href = 'ctecka_knih.html?id=' + encodeURIComponent(m.id); };

    /* ---------- vykreslení ---------- */
    function karta(m, p, d) {
      const sirka = d ? 100 : p * 100;
      return `<div class="karta${d ? ' docteno' : ''}" data-id="${esc(m.id)}">
        <button class="obal" data-akce="cti" title="Číst: ${esc(m.nazev)}">${obalHtml(m)}<span class="format">${m.web ? '🌐 web' : esc(m.format)}</span>${d ? '<span class="znacka-docteno">✔ Dočteno</span>' : ''}</button>
        <div class="nazev" title="${esc(m.nazev)}">${esc(m.nazev)}</div>
        <div class="autor">${esc(m.autor || '—')}</div>
        ${m.serie ? `<div class="serie" title="${esc(m.serie)}">${esc(m.serie)}${dil(m) ? ' · ' + dil(m) : ''}</div>` : ''}
        <div class="pokrok" title="${d ? 'Dočteno' : `Přečteno ${Math.floor(p * 100)} %`}"><i style="width:${sirka.toFixed(1)}%"></i></div>
        <div class="info">${d ? '✔ Dočteno' + (m.hodnoceni ? ' <span class="hv">' + hvezdy(m.hodnoceni) + '</span>' : '') : procentaZbyva(m, p)} · ${m.kapitoly.length} kap.</div>
        <div class="akce"><button class="tl" data-akce="cti">📖 ${d ? 'Číst znovu' : p > 0 ? 'Pokračovat' : 'Číst'}</button>
          <button class="tl" data-akce="docteno" aria-pressed="${d}" title="${d ? 'Označit jako nedočtenou' : 'Označit jako dočtenou'}" aria-label="${d ? 'Označit jako nedočtenou' : 'Označit jako dočtenou'}">✔</button>
          <button class="tl" data-akce="upravit" title="Upravit knihu: název, série, obálka, hodnocení, kapitoly" aria-label="Upravit">✏️</button>
          <button class="tl" data-akce="smazat" title="Odebrat z knihovny" aria-label="Odebrat">🗑</button></div>
      </div>`;
    }
    function vykresli() {
      const q = J.normalizuj($('hledat').value.trim());
      const pk = new Map(knihy.map(m => [m.id, D.pokrok(m)]));
      const hotovo = new Map(knihy.map(m => [m.id, D.docteno(m, pk.get(m.id))]));
      // deník: kniha dočtená do konce dostane datum dočtení sama
      knihy.forEach(m => { if (hotovo.get(m.id) && !m.dokonceno) { m.dokonceno = Date.now(); D.ulozMeta(m); } });
      const skupina = m => hotovo.get(m.id) ? 'doctene' : pk.get(m.id) > 0 ? 'rozectene' : 'neprectene';
      const podleNazvu = (a, b) => a.nazev.localeCompare(b.nazev, 'cs');
      const razeni = {
        cteno: (a, b) => (b.otevreno || 0) - (a.otevreno || 0) || b.pridano - a.pridano,
        pridano: (a, b) => b.pridano - a.pridano,
        nazev: podleNazvu,
        autor: (a, b) => (a.autor || '￿').localeCompare(b.autor || '￿', 'cs') || podleNazvu(a, b),
        serie: (a, b) => (a.serie || '￿').localeCompare(b.serie || '￿', 'cs') || (+a.dil || 0) - (+b.dil || 0) || podleNazvu(a, b),
        pokrok: (a, b) => (hotovo.get(b.id) ? 1 : pk.get(b.id)) - (hotovo.get(a.id) ? 1 : pk.get(a.id)),
        hodnoceni: (a, b) => (b.hodnoceni || 0) - (a.hodnoceni || 0) || podleNazvu(a, b),
      }[nast.razeni] || podleNazvu;
      const vyber = knihy.filter(m => (!q || J.normalizuj(`${m.nazev} ${m.autor || ''} ${m.serie || ''}`).includes(q))
        && (!nast.filtr || (nast.filtr === 'web' ? !!m.web : nast.filtr === skupina(m)))).sort(razeni);
      document.querySelectorAll('[data-razeni]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.razeni === nast.razeni)));
      document.querySelectorAll('[data-filtr]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filtr === (nast.filtr || ''))));
      $('tlRazeni').classList.toggle('filtr-aktivni', !!nast.filtr);
      if (!knihy.length) {
        $('knihovna').innerHTML = `<div class="uvod"><h2>Vaše knihovna je prázdná</h2>
          <p>Nahrajte e-knihu ve formátu <b>EPUB</b>, <b>MOBI</b>, <b>Markdown</b> nebo <b>TXT</b> – tlačítkem níže, celou složku najednou, nebo soubory přetáhněte do okna.
          Kniha se otevře ve stejné čtečce jako Kroniky vyhnanství: obsah, hledání, záložky, zvýraznění a poznámky, předčítání, motivy čtení.</p>
          <p><button class="tl" data-prikaz="soubory">📄 Přidat knihu</button> <button class="tl" data-prikaz="slozka">🗂 Celá složka</button> <button class="tl" data-prikaz="web">🌐 Moje knihy z webu</button></p>
          <p style="font-size:.85rem">Knihy zůstávají jen v tomto prohlížeči (IndexedDB), nikam se neodesílají. Chráněné knihy (DRM) otevřít nejde.</p></div>`;
        return;
      }
      // pruh „Pokračovat ve čtení“ – jen v základním pohledu
      let h = '';
      const rozectene = knihy.filter(m => skupina(m) === 'rozectene').sort((a, b) => (b.otevreno || 0) - (a.otevreno || 0)).slice(0, 4);
      if (!q && !nast.filtr && rozectene.length) {
        h += `<section class="pokracovat"><h2>Pokračovat ve čtení</h2><div class="pruh">${rozectene.map(m => {
          const p = pk.get(m.id), kap = D.kapitolaNaPozici(m);
          return `<button class="rozect" data-id="${esc(m.id)}" data-akce="cti" title="Pokračovat: ${esc(m.nazev)}">
            <span class="obal mini">${obalHtml(m)}</span>
            <span class="rozect-text"><b>${esc(m.nazev)}</b><span>${esc(kap)}</span>
            <span class="pokrok"><i style="width:${(p * 100).toFixed(1)}%"></i></span><span>${procentaZbyva(m, p)}</span></span></button>`;
        }).join('')}</div></section>`;
      }
      if (!vyber.length) h += '<p class="uvod">Nic nenalezeno.</p>';
      else if (nast.razeni === 'serie') {
        const police = new Map();
        vyber.forEach(m => { const k = m.serie || ''; if (!police.has(k)) police.set(k, []); police.get(k).push(m); });
        for (const [serie, seznam] of police)
          h += `<section class="police"><h2>${serie ? '📚 ' + esc(serie) : 'Bez série'} <span>${seznam.length}</span></h2><div class="mrizka">${seznam.map(m => karta(m, pk.get(m.id), hotovo.get(m.id))).join('')}</div></section>`;
      } else h += `<div class="mrizka">${vyber.map(m => karta(m, pk.get(m.id), hotovo.get(m.id))).join('')}</div>`;
      $('knihovna').innerHTML = h + '<div class="paticka-knihovny" id="paticka"></div>';
      paticka();
    }
    async function paticka() {
      let t = `${knihy.length} ${knihy.length === 1 ? 'kniha' : knihy.length < 5 ? 'knihy' : 'knih'}`;
      if (navigator.storage && navigator.storage.estimate) {
        try { const e = await navigator.storage.estimate(); t += ` · úložiště prohlížeče: ${(e.usage / 1e6).toFixed(1)} MB z ${(e.quota / 1e9).toFixed(1)} GB`; } catch (e) {}
      }
      if ($('paticka')) $('paticka').textContent = t + ' · knihy jsou jen v tomto zařízení';
    }

    /* ---------- průběh dlouhých operací ---------- */
    let zrusit = false;
    function prubeh(text, i, n) {
      if (!$('prubeh')) {
        document.body.insertAdjacentHTML('beforeend', '<div class="ukol" id="prubeh"><span id="prubehText"></span> <progress id="prubehPruh"></progress> <button class="tl" id="prubehZrus">Zrušit</button></div>');
        $('prubehZrus').onclick = () => { zrusit = true; $('prubehZrus').disabled = true; };
      }
      $('prubehText').textContent = n > 1 ? `⏳ ${i + 1} / ${n} · ${text}` : '⏳ ' + text;
      if (n > 1) { $('prubehPruh').max = n; $('prubehPruh').value = i; } else $('prubehPruh').removeAttribute('value');
      $('prubehZrus').hidden = !(n > 1);
    }
    const konecPrubehu = () => { $('prubeh') && $('prubeh').remove(); zrusit = false; };
    const dokoncePridani = n => { if (n && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); };   // ať prohlížeč knihy sám nesmaže

    /* ---------- přidání knih ze zařízení (i celé složky) ---------- */
    async function pridej(soubory) {
      soubory = [...soubory];
      const knizni = soubory.filter(f => P.PRIPONY.test(f.name));
      if (!knizni.length) { Dialog.chyba('Podporované formáty: EPUB, MOBI (PRC, AZW), Markdown, TXT.'); return; }
      const obr = P.obrazkyZeSouboru(soubory), hromadne = knizni.length > 1;
      let pridano = 0, preskoceno = 0;
      const chyby = [];
      for (const [i, f] of knizni.entries()) {
        if (zrusit) break;
        prubeh(f.name, i, knizni.length);
        const stejna = knihy.find(m => m.soubor === f.name && m.velikost === f.size);
        // jedna kniha: zeptat se; celá složka: duplicity tiše přeskočit
        if (stejna && (hromadne || !(await Dialog.potvrd(`Kniha „${stejna.nazev}“ už v knihovně je. Přidat ji znovu?`, { ok: 'Přidat znovu', zrus: 'Přeskočit' })))) { preskoceno++; continue; }
        try { knihy.push(await D.ulozKnihu(await P.nactiSoubor(f, obr))); pridano++; }
        catch (e) { chyby.push(`${f.name}: ${e.message || e}`); }
        if (hromadne && i % 10 === 9) vykresli();
      }
      const zruseno = zrusit;
      konecPrubehu();
      dokoncePridani(pridano);
      vykresli();
      if (!hromadne && !chyby.length) { if (pridano) Dialog.info('📚 Kniha přidána do knihovny'); return; }
      if (!hromadne) { Dialog.chyba(chyby[0]); return; }
      Dialog.potvrd(`${zruseno ? 'Načítání zrušeno.\n\n' : ''}Přidáno knih: ${pridano}` + (preskoceno ? `\nUž v knihovně (přeskočeno): ${preskoceno}` : '') +
        (chyby.length ? `\nNepodařilo se: ${chyby.length}\n\n` + chyby.slice(0, 12).join('\n') + (chyby.length > 12 ? '\n…' : '') : ''), { ok: 'OK', zrus: 'Zavřít' });
    }
    // přetažená složka: projít položky rekurzivně (dataTransfer.files složku neobsahuje)
    async function souboryZPretazeni(dt) {
      const polozky = [...(dt.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
      if (!polozky.some(p => p.isDirectory)) return [...dt.files];
      const vysl = [];
      const projdi = async p => {
        if (p.isFile) vysl.push(await new Promise((ok, ko) => p.file(ok, ko)));
        else {
          const ctecka = p.createReader();
          for (;;) {
            const davka = await new Promise((ok, ko) => ctecka.readEntries(ok, ko));
            if (!davka.length) break;
            for (const x of davka) await projdi(x);
          }
        }
      };
      for (const p of polozky) await projdi(p);
      return vysl;
    }

    /* ---------- knihy z webu ---------- */
    async function otevriWeb() {
      otevriModal('mWeb');
      $('webSeznam').innerHTML = '<p class="napoveda">⏳ Načítám seznam…</p>';
      const seznam = await D.seznamWeb();
      if (seznam === null) { $('webSeznam').innerHTML = '<p class="napoveda">Web je teď nedostupný (offline?). Už přidané knihy jdou číst dál.</p>'; return; }
      if (!seznam.length) { $('webSeznam').innerHTML = '<p class="napoveda">Na webu zatím žádné knihy nejsou.</p>'; return; }
      const vykresliWeb = () => {
        $('webSeznam').innerHTML = `<div class="web-seznam">${seznam.map(pol => {
          const m = knihy.find(x => x.web && x.web.id === pol.id);
          return `<div class="web-kniha" data-web="${esc(pol.id)}">
            <div><b>${esc(pol.nazev)}</b>${pol.autor ? ' · ' + esc(pol.autor) : ''}${pol.serie ? ` <span class="napoveda">(${esc(pol.serie)}${pol.dil ? ' ' + pol.dil : ''})</span>` : ''}
              <div class="napoveda">${pol.popis ? esc(pol.popis) + ' · ' : ''}${pol.slov ? `${pol.slov.toLocaleString('cs')} slov · ~${J.formatCas(pol.slov / 220)}` : ''}${pol.zmeneno ? ' · změněno ' + new Date(pol.zmeneno).toLocaleDateString('cs') : ''}</div></div>
            ${m ? `<button class="tl" data-web-cti="${esc(m.id)}">✔ V knihovně – číst</button>` : '<button class="tl hlavni" data-web-pridej>➕ Přidat</button>'}
          </div>`;
        }).join('')}</div>`;
      };
      vykresliWeb();
      $('webSeznam').onclick = async e => {
        const cti = e.target.closest('[data-web-cti]');
        if (cti) return otevriKnihu({ id: cti.dataset.webCti });
        const b = e.target.closest('[data-web-pridej]');
        if (!b) return;
        const pol = seznam.find(x => x.id === b.closest('[data-web]').dataset.web);
        b.disabled = true; b.textContent = '⏳ Stahuji…';
        try { knihy.push(await D.pridejZWebu(pol)); dokoncePridani(1); Dialog.info(`📚 Přidáno: ${pol.nazev}`); }
        catch (err) { Dialog.chyba(`${pol.nazev}: ${err.message || err}`); }
        vykresliWeb(); vykresli();
      };
    }
    async function aktualizujWeb(potichu) {
      if (!knihy.some(m => m.web)) { if (!potichu) Dialog.info('V knihovně nejsou žádné knihy z webu.'); return; }
      const hotovo = await D.aktualizujZWebu(knihy);
      if (hotovo.length) { Dialog.info('🌐 Aktualizováno z webu: ' + hotovo.join(', ')); vykresli(); }
      else if (!potichu) Dialog.info('Knihy z webu jsou aktuální.');
    }

    /* ---------- záloha a obnova ---------- */
    async function zalohuj() {
      try {
        const blob = await D.zaloha((i, n, t) => prubeh('Zálohuji: ' + t, i, n));
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = `knihovna_zaloha_${new Date().toLocaleDateString('sv')}.zip`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
        Dialog.info(`💾 Záloha knihovny stažena (${(blob.size / 1e6).toFixed(1)} MB)`);
      } catch (e) { Dialog.chyba('Zálohu se nepodařilo vytvořit: ' + (e.message || e)); }
      konecPrubehu();
    }
    async function obnov(soubor) {
      try {
        const z = await D.prectiZalohu(soubor);
        let prepsat = false;
        if (z.existujici) {
          prepsat = await Dialog.potvrd(`Záloha obsahuje ${z.data.knihy.length} knih, ${z.existujici} z nich už v knihovně je. Nahradit je verzí ze zálohy (včetně pokroku a poznámek)?`, { ok: 'Nahradit', zrus: 'Ponechat moje' });
        } else if (!(await Dialog.potvrd(`Obnovit ${z.data.knihy.length} knih ze zálohy?`, { ok: 'Obnovit', zrus: 'Zrušit' }))) return;
        const n = await D.obnovZalohu(z, prepsat, (i, n, t) => prubeh('Obnovuji: ' + t, i, n));
        if (z.data.nast && z.data.nast.cil && !nast.cil) { nast.cil = z.data.nast.cil; ulozNast(); }
        knihy = await D.vsechnyMeta();
        dokoncePridani(n);
        Dialog.info(`📂 Obnoveno knih: ${n}`);
      } catch (e) { Dialog.chyba(e.message || String(e)); }
      konecPrubehu();
      vykresli();
    }

    /* ---------- úprava knihy (údaje, obálka, hodnocení, kapitoly) ---------- */
    let uprava = null;   // {m, obsah, kapitoly: [{soubor, nazev, md, slov}], hodnoceni, obalka: Blob|null|undefined}
    async function upravKnihu(m) {
      const obsah = await D.obsahKnihy(m.id);
      uprava = { m, obsah, hodnoceni: m.hodnoceni || 0, obalka: undefined,
        kapitoly: m.kapitoly.map(c => ({ ...c, md: obsah.md[c.soubor] || '' })) };
      $('upNazev').value = m.nazev; $('upAutor').value = m.autor || '';
      $('upSerie').value = m.serie || ''; $('upDil').value = m.dil != null ? m.dil : '';
      $('upPoznamka').value = m.poznamka || '';
      const datum = t => t ? new Date(t).toLocaleDateString('sv') : '';
      $('upZacato').value = datum(m.zacato); $('upDokonceno').value = datum(m.dokonceno);
      $('seznamSerii').innerHTML = [...new Set(knihy.map(x => x.serie).filter(Boolean))].map(s => `<option value="${esc(s)}">`).join('');
      $('upKapNapoveda').textContent = m.web
        ? 'Kniha je napojená na web – úpravy kapitol přepíše další aktualizace z webu (opravte raději rukopis).'
        : 'Když převod rozdělil knihu špatně: přejmenujte kapitolu, spojte ji s předchozí (⤒) nebo odeberte (🗑).';
      kresliUpravu();
      otevriModal('mUprava');
    }
    function kresliUpravu() {
      const u = uprava, m = u.m;
      const ob = u.obalka !== undefined ? u.obalka : m.obalkaBlob;
      $('upObal').innerHTML = ob ? `<img src="${URL.createObjectURL(ob)}" alt="">` : `<div class="gen" style="background:${barva($('upNazev').value || m.nazev)}"><b>${esc($('upNazev').value || m.nazev)}</b></div>`;
      document.querySelectorAll('#upHvezdy .hvezda').forEach(b => b.classList.toggle('plna', +b.dataset.hvezda <= u.hodnoceni));
      $('upKapNadpis').textContent = `Kapitoly (${u.kapitoly.length})`;
      $('upKapitoly').innerHTML = u.kapitoly.map((c, i) => `<div class="kap-radek" data-i="${i}">
        <span class="kap-c">${i + 1}.</span><input class="vstup" data-kap-nazev value="${esc(c.nazev)}" aria-label="Název kapitoly ${i + 1}">
        <span class="kap-slov">${c.slov.toLocaleString('cs')} sl.</span>
        <button class="tl" data-kap="spojit" ${i ? '' : 'disabled'} title="Spojit s předchozí kapitolou" aria-label="Spojit s předchozí">⤒</button>
        <button class="tl" data-kap="smazat" ${u.kapitoly.length > 1 ? '' : 'disabled'} title="Odebrat kapitolu" aria-label="Odebrat kapitolu">🗑</button></div>`).join('');
    }
    $('mUprava').addEventListener('click', e => {
      const hv = e.target.closest('[data-hvezda]');
      if (hv) { uprava.hodnoceni = +hv.dataset.hvezda === uprava.hodnoceni ? 0 : +hv.dataset.hvezda; kresliUpravu(); return; }
      const k = e.target.closest('[data-kap]');
      if (!k) return;
      const i = +k.closest('[data-i]').dataset.i, seznam = uprava.kapitoly;
      if (k.dataset.kap === 'spojit') {
        seznam[i - 1].md += '\n\n' + seznam[i].md;
        seznam[i - 1].slov += seznam[i].slov;
        seznam.splice(i, 1);
      } else seznam.splice(i, 1);
      kresliUpravu();
    });
    $('upKapitoly').addEventListener('input', e => {
      if (e.target.matches('[data-kap-nazev]')) uprava.kapitoly[+e.target.closest('[data-i]').dataset.i].nazev = e.target.value;
    });
    $('upNazev').addEventListener('input', () => { if (!uprava.m.obalkaBlob && uprava.obalka == null) kresliUpravu(); });
    $('upObalNahrat').onclick = () => $('upObalSoubor').click();
    $('upObalSoubor').onchange = e => { const f = e.target.files[0]; if (f) { uprava.obalka = f; kresliUpravu(); } e.target.value = ''; };
    $('upObalOdebrat').onclick = () => { uprava.obalka = null; kresliUpravu(); };
    $('upUlozit').onclick = async () => {
      const u = uprava, m = u.m, rucne = { ...(m.rucne || {}) };
      const nazev = $('upNazev').value.trim() || m.nazev, autor = $('upAutor').value.trim();
      const serie = $('upSerie').value.trim(), dilV = $('upDil').value === '' ? null : +$('upDil').value;
      if (nazev !== m.nazev) rucne.nazev = true;
      if (autor !== (m.autor || '')) rucne.autor = true;
      if (serie !== (m.serie || '') || dilV !== (m.dil == null ? null : +m.dil)) rucne.serie = true;
      Object.assign(m, { nazev, autor, serie, dil: serie ? dilV : null, hodnoceni: u.hodnoceni, poznamka: $('upPoznamka').value.trim(), rucne });
      const datum = v => v ? new Date(v + 'T12:00').getTime() : null;
      m.zacato = datum($('upZacato').value);
      const dokonceno = datum($('upDokonceno').value);
      if (dokonceno && !m.dokonceno) m.docteno = true;
      if (!dokonceno && m.dokonceno) m.docteno = m.docteno === true ? null : m.docteno;
      m.dokonceno = dokonceno;
      if (u.obalka !== undefined) { m.obalkaBlob = u.obalka; m.obalka = null; rucne.obalka = true; }
      // kapitoly: přejmenování přepíše i nadpis v textu; soubory zůstávají (pozice a záložky platí dál)
      const zmenaKap = u.kapitoly.length !== m.kapitoly.length || u.kapitoly.some((c, i) => c.nazev !== m.kapitoly[i].nazev || c.md !== (u.obsah.md[c.soubor] || ''));
      if (zmenaKap) {
        const md = {};
        u.kapitoly.forEach(c => {
          const puv = m.kapitoly.find(x => x.soubor === c.soubor);
          if (puv && c.nazev.trim() && c.nazev !== puv.nazev) c.md = c.md.replace(/^#\s+.*$/m, '# ' + c.nazev.trim());
          c.nazev = c.nazev.trim() || (puv && puv.nazev) || 'Kapitola';
          md[c.soubor] = c.md;
        });
        m.kapitoly = u.kapitoly.map(c => ({ soubor: c.soubor, nazev: c.nazev, slov: D.slovMd(c.md) }));
        m.slov = m.kapitoly.reduce((s, c) => s + c.slov, 0);
        await D.ulozObsah({ ...u.obsah, md });
      }
      await D.ulozMeta(m);
      obalkyUrl.delete(m.id);
      $('mUprava').hidden = true;
      vykresli();
    };

    /* ---------- čtenářský deník ---------- */
    function kresliDenik() {
      const rok = +$('dRok').value || new Date().getFullYear();
      const d = D.denik(knihy, rok), cil = +nast.cil || 0;
      const rozect = knihy.filter(m => !D.docteno(m) && D.pokrok(m) > 0).length;
      const hod = s => s < 3600 ? Math.round(s / 60) + ' min' : (s / 3600).toFixed(1).replace('.', ',') + ' h';
      const maxK = Math.max(1, ...d.knihMesice), maxC = Math.max(1, ...d.casMesice);
      const MES = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];
      $('denikObsah').innerHTML = `<div class="dlazdice">
          <div><b>${d.doctene.length}${cil ? ' / ' + cil : ''}</b><span>dočtených knih</span>${cil ? `<span class="pokrok"><i style="width:${Math.min(100, d.doctene.length / cil * 100)}%"></i></span>` : ''}</div>
          <div><b>${d.slov.toLocaleString('cs')}</b><span>slov v dočtených</span></div>
          <div><b>${hod(d.cas)}</b><span>čas čtení</span></div>
          <div><b>${rozect}</b><span>rozečtených teď</span></div></div>
        <div class="mesice" aria-label="Dočtené knihy a čas čtení po měsících">${MES.map((n, i) =>
          `<div class="mesic" title="${n}: ${d.knihMesice[i]} knih, ${hod(d.casMesice[i])}"><span class="sl cas" style="height:${d.casMesice[i] / maxC * 100}%"></span><span class="sl knihy" style="height:${d.knihMesice[i] / maxK * 100}%"></span><em>${n}</em></div>`).join('')}</div>
        <p class="napoveda legenda"><span class="tecka knihy"></span> dočtené knihy <span class="tecka cas"></span> čas čtení</p>
        <h3>Dočteno v roce ${rok}</h3>
        ${d.doctene.length ? `<table class="denik-tab">${d.doctene.map(m => `<tr data-id="${esc(m.id)}">
          <td>${new Date(m.dokonceno).toLocaleDateString('cs')}</td>
          <td><b>${esc(m.nazev)}</b>${m.autor ? '<br><span class="napoveda">' + esc(m.autor) + '</span>' : ''}${m.poznamka ? '<div class="pozn">' + esc(m.poznamka) + '</div>' : ''}</td>
          <td class="hv">${hvezdy(m.hodnoceni)}</td><td><button class="tl" data-denik-upravit title="Hodnocení a poznámka" aria-label="Upravit">✏️</button></td></tr>`).join('')}</table>`
          : '<p class="napoveda">Zatím nic. Dočtená kniha se sem zapíše sama, nebo ji označte ✔ v knihovně.</p>'}`;
    }
    function otevriDenik() {
      const roky = D.denik(knihy, new Date().getFullYear()).roky;
      $('dRok').innerHTML = roky.map(r => `<option>${r}</option>`).join('');
      $('dCil').value = nast.cil || '';
      kresliDenik();
      otevriModal('mDenik');
    }
    $('dRok').onchange = kresliDenik;
    $('dCil').onchange = e => { nast.cil = Math.max(0, Math.round(+e.target.value || 0)); ulozNast(); kresliDenik(); };
    $('denikObsah').onclick = e => {
      const b = e.target.closest('[data-denik-upravit]');
      if (b) { $('mDenik').hidden = true; upravKnihu(knihy.find(m => m.id === b.closest('[data-id]').dataset.id)); }
    };

    /* ---------- ostatní akce ---------- */
    async function smaz(m) {
      if (!(await Dialog.potvrd(`Odebrat knihu „${m.nazev}“ z knihovny? Smažou se i její záložky, poznámky a pokrok čtení.`, { ok: '🗑 Odebrat', zrus: 'Zrušit' }))) return;
      await D.smazKnihu(m.id);
      if (nast.posledni === m.id) { delete nast.posledni; ulozNast(); }
      knihy = knihy.filter(x => x !== m);
      vykresli();
    }
    function prepniDocteno(m) {
      m.docteno = !D.docteno(m);
      m.dokonceno = m.docteno ? Date.now() : null;
      D.ulozMeta(m); vykresli();
    }
    const napoveda = () => Dialog.potvrd(
      'Čtečka knih\n\n• Formáty: EPUB, MOBI (i PRC/AZW bez DRM), Markdown (.md) a prostý text (.txt). K Markdownu můžete vybrat zároveň i jeho obrázky – použijí se jako ilustrace. Najednou jde přidat celá složka (i přetažením do okna).\n' +
      '• Moje knihy z webu: rukopisy nahrané na web. Přidaná kniha je napojená a sama se aktualizuje, když se na webu změní.\n' +
      '• Kapitoly se poznají z obsahu e-knihy, v Markdownu podle nadpisů #, v TXT podle řádků „Kapitola…“, „Část…“. Špatné rozdělení opravíte v ✏️ Upravit.\n' +
      '• Při čtení: obsah (T), hledání (Ctrl+F), záložky (B), zvýraznění a poznámky, předčítání (R), motivy, písmo a stránkování v nabídce Zobrazení. Pokrok se ukládá sám.\n' +
      '• Deník: dočtené knihy s datem, hodnocením a poznámkou, statistiky a roční cíl.\n' +
      '• Knihy i poznámky jsou jen v tomto prohlížeči. Celou knihovnu přenesete jinam přes 🧰 Nástroje → Zálohovat / Obnovit.\n' +
      '• MOBI s kompresí HUFF/CDIC (některé knihy z Amazonu) a knihy s DRM otevřít nejde – převeďte je na EPUB.',
      { ok: 'Rozumím', zrus: 'Zavřít' });

    function otevriModal(id) { $(id).hidden = false; const z = $(id).querySelector('[data-zavrit]'); z && z.focus(); }
    document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-zavrit]')) m.hidden = true; }));

    const PRIKAZY = {
      soubory: () => $('soubor').click(),
      slozka: () => $('slozka').click(),
      web: otevriWeb,
      zaloha: zalohuj,
      obnova: () => $('souborZaloha').click(),
      aktualizovat: () => aktualizujWeb(false),
      napoveda,
    };
    const zavriNabidky = () => document.querySelectorAll('.nabidka').forEach(n => { n.hidden = true; });
    document.querySelectorAll('[data-nab]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const n = $(b.dataset.nab), bylo = !n.hidden;
      zavriNabidky();
      if (bylo) return;
      n.hidden = false;
      const r = b.getBoundingClientRect();
      n.style.top = (r.bottom + 4) + 'px';
      n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
    }));
    document.addEventListener('click', e => {
      const p = e.target.closest('[data-prikaz]');
      if (p && PRIKAZY[p.dataset.prikaz]) { zavriNabidky(); PRIKAZY[p.dataset.prikaz](); return; }
      const r = e.target.closest('[data-razeni], [data-filtr]');
      if (r) {
        if (r.dataset.razeni) nast.razeni = r.dataset.razeni; else nast.filtr = r.dataset.filtr;
        ulozNast(); zavriNabidky(); vykresli(); return;
      }
      if (!e.target.closest('.nabidka')) zavriNabidky();
    });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      const m = document.querySelector('.modal:not([hidden])');
      if (m) m.hidden = true; else zavriNabidky();
    });
    $('knihovna').addEventListener('click', e => {
      const b = e.target.closest('[data-akce]'), el = e.target.closest('[data-id]');
      if (!b || !el) return;
      const m = knihy.find(x => x.id === el.dataset.id);
      if (b.dataset.akce === 'cti') otevriKnihu(m);
      if (b.dataset.akce === 'smazat') smaz(m);
      if (b.dataset.akce === 'upravit') upravKnihu(m);
      if (b.dataset.akce === 'docteno') prepniDocteno(m);
    });
    $('tlDenik').onclick = otevriDenik;
    $('soubor').onchange = e => { if (e.target.files.length) pridej(e.target.files); e.target.value = ''; };
    $('slozka').onchange = e => { if (e.target.files.length) pridej(e.target.files); e.target.value = ''; };
    $('souborZaloha').onchange = e => { if (e.target.files[0]) obnov(e.target.files[0]); e.target.value = ''; };
    $('hledat').addEventListener('input', vykresli);
    // přetažení souborů nebo celé složky do okna
    let hloubka = 0;
    addEventListener('dragenter', e => { if (e.dataTransfer.types.includes('Files')) { hloubka++; document.body.classList.add('pretahovani'); } });
    addEventListener('dragleave', () => { if (--hloubka <= 0) { hloubka = 0; document.body.classList.remove('pretahovani'); } });
    addEventListener('dragover', e => e.preventDefault());
    addEventListener('drop', async e => {
      e.preventDefault(); hloubka = 0; document.body.classList.remove('pretahovani');
      const soubory = await souboryZPretazeni(e.dataTransfer);
      if (soubory.length) pridej(soubory);
    });

    // starší knihy bez série: jednou odhadnout z názvu
    for (const m of knihy) {
      if (m.serieZjistena) continue;
      m.serieZjistena = true;
      const o = !m.serie && (P.serieZNazvu(m.nazev) || P.serieZNazvu(String(m.soubor || '').replace(/\.[a-z0-9]+$/i, '')));
      if (o) { m.serie = o.serie; m.dil = o.dil; }
      D.ulozMeta(m);
    }
    vykresli();
    aktualizujWeb(true);   // napojené knihy z webu na pozadí
    window.KNIHOVNA = { pridej, knihy: () => knihy, vykresli, aktualizujWeb, otevriWeb, upravKnihu, otevriDenik, zalohuj, obnov };
  }
})();
