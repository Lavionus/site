/* Atlas a bestiář Kronik vyhnanství – stránka. Data: data.js (tools/atlas_export.py), odemykání: odemykani.js.
   Zamčené položky se do DOM vůbec nedostanou: vše se kreslí z ATLAS_ODEMYK.filtruj(). */
(function () {
  'use strict';
  const O = window.ATLAS_ODEMYK, DATA = window.ATLAS_DATA;
  const $ = id => document.getElementById(id);
  const KLIC = 'webapp_kroniky_atlas', KLIC_K = 'webapp_kroniky', KLIC_P = 'webapp_kniha_povidky_kronik';
  const KARTY = ['populace', 'postavy', 'mista', 'osa', 'pojmy'];
  const POR = O.poradi(DATA.kapitoly);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const cti = k => { try { return JSON.parse(localStorage.getItem(k)) || null; } catch (e) { return null; } };

  let volba = { rezim: 'ctecka', do: '', povidky: [], karta: 'populace', skryteKnihy: [], mapa: 'moderni', ...(cti(KLIC) || {}) };
  if (!KARTY.includes(volba.karta)) volba.karta = 'populace';
  const uloz = () => { try { localStorage.setItem(KLIC, JSON.stringify(volba)); } catch (e) {} };

  let poz, vid, dotaz = '';

  /* ---------- odkazy na místo ve čtečce ---------- */
  const zkratka = t => {
    if (t.startsWith('P:')) { const p = DATA.povidky.find(x => x.slug === t.slice(2)); return p ? '📜 ' + p.nazev : ''; }
    const [k, c] = t.slice(1).split(':');
    return `${O.RIM[k] || k}·${c}`;
  };
  function misto(t) {
    const href = O.odkazMista(t, DATA);
    if (!href) return '';
    return `<a class="misto" href="${esc(href)}" data-ctecka title="${esc(O.popisMista(t, DATA))} – otevřít ve čtečce">${esc(zkratka(t))}</a>`;
  }
  // v rozcestníku (iframe) otevřít čtečku jako jeho stránku, jinak normální odkaz
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-ctecka]');
    if (!a || window.parent === window) return;
    e.preventDefault();
    window.parent.postMessage({ otevri: 'obsah/' + a.getAttribute('href') }, location.origin);
  });

  /* ---------- karty položek ---------- */
  const fakta = seznam => seznam && seznam.length
    ? `<ul class="fakta">${seznam.map(f => `<li>${esc(f.t)} ${misto(f.od)}</li>`).join('')}</ul>` : '';
  const nazevPolozky = p => p.nazev || p.jmeno;
  const najdi = id => { for (const sb of KARTY) { const p = vid[sb].find(x => x.id === id); if (p) return { p, sb }; } return null; };
  function vazby(p) {
    const v = (p.vazby || []).map(x => {
      const id = typeof x === 'string' ? x : x.id, cil = najdi(id);
      if (!cil) return '';
      const vztah = typeof x === 'string' ? '' : `<span class="vztah">${esc(x.vztah)}</span> `;
      return `<button class="vazba" data-skok="${esc(id)}">${vztah}${esc(nazevPolozky(cil.p))}</button>`;
    }).join('');
    return v ? `<div class="vazby"><span class="popisek">Souvisí:</span> ${v}</div>` : '';
  }
  const poprve = p => p.od && p.od !== '0' ? `<span class="poprve">poprvé ${misto(p.od)}</span>` : '';
  const vic = p => p.vic ? '<p class="vic">Dalším čtením se dozvíš víc.</p>' : '';

  const PRESNOST = { presne: 'skutečné místo', oblast: 'přibližná oblast', fikce_u: 'smyšlené místo – poloha na mapě je přibližná (u skutečné předlohy)' };
  // místa: knihy = [1, 5, "P:kavyl"]
  const popisKnihy = k => typeof k === 'string' ? 'povídka ' + ((DATA.povidky.find(x => 'P:' + x.slug === k) || {}).nazev || '') : 'kniha ' + O.RIM[k];
  const tridaKnihy = k => typeof k === 'string' ? 'kP' : 'k' + (k || 0);
  const skupinaKnihy = k => typeof k === 'string' ? 'P' : String(k);

  /* obrázky položky: hlavní (odemyká se s položkou) + další, které už filtruj() propustil podle vlastního „od“.
     Do DOM jde jen pořadí v tomhle seznamu – o zamčených obrázcích stránka nic neví. */
  const obrazkyPolozky = p => [...(p.obrazek ? [{ src: p.obrazek, popis: nazevPolozky(p) }] : []),
    ...(p.obrazky || []).map(o => ({ src: o.soubor, popis: o.popis || nazevPolozky(p), od: o.od }))];
  function galerie(p, sb) {
    const obr = obrazkyPolozky(p);
    if (!obr.length) return '';
    const tl = (o, i, trida, img) => `<button class="${trida}" data-galerie="${esc(p.id)}" data-i="${i}" title="${esc(o.popis)} – zvětšit" aria-label="Zvětšit obrázek: ${esc(o.popis)}">${img}</button>`;
    return tl(obr[0], 0, 'obr-hlavni', `<img class="ilustrace${sb === 'populace' ? '' : sb === 'postavy' ? ' portret' : ' veduta'}" src="${esc(obr[0].src)}" alt="${esc(obr[0].popis)}" loading="lazy">`) +
      (obr.length > 1 ? `<div class="galerie">${obr.slice(1).map((o, i) => tl(o, i + 1, 'nahled', `<img src="${esc(o.src)}" alt="${esc(o.popis)}" loading="lazy">`)).join('')}</div>` : '');
  }

  function karta(p, sb) {
    let hlava = galerie(p, sb), telo = '';
    if (sb === 'populace') {
      if (p.taxon) telo += `<p class="taxon">${esc(p.taxon.t)} ${misto(p.taxon.od)}</p>`;
      if (p.jmena && p.jmena.length) telo += `<p class="jmena"><span class="popisek">Říká se jim:</span> ${p.jmena.map(j => esc(j.t) + ' ' + misto(j.od)).join(' · ')}</p>`;
      telo += fakta(p.fakta);
      if (p.vystupuje && p.vystupuje.length) telo += `<p class="popisek">Kde vystupují</p>${fakta(p.vystupuje)}`;
    } else if (sb === 'postavy') {
      if (p.role) telo += `<p class="taxon">${esc(p.role.t)}</p>`;
      telo += fakta(p.fakta);
    } else if (sb === 'pojmy') {
      telo += `<p class="taxon">${esc({ artefakt: 'artefakt', pojem: 'pojem', organizace: 'organizace', misto_v_textu: 'místo v textu' }[p.druh] || p.druh)}</p>` + fakta(p.fakta);
      // ptačí písmo knihy rodu – vlastní font webu (tools/ptaci_pismo.js); id je v datech anonymizované, proto podle názvu
      if (/^Kniha rodu/.test(p.nazev)) telo += `<p class="ptaci-ukazka" data-i18n="ne" title="Kniha rodu, znak úřadu Merin">Kniha rodu [merin]</p>
        <p class="ptaci-odkazy">Ptačí písmo si můžete vyzkoušet v <a href="prevod_pisma.html">Převodníku písma</a>, v <a href="sifry.html">Šifrách</a> (Šifrovačky) nebo v <a href="pismolijna.html">Písmolijně</a>.</p>`;
    } else if (sb === 'mista') {
      telo += `<p class="taxon">${esc(PRESNOST[p.presnost] || '')}${p.knihy && p.knihy.length ? ' · ' + esc(p.knihy.map(popisKnihy).join(', ')) : ''}</p>` + fakta(p.fakta);
    } else if (sb === 'osa') {
      telo += fakta(p.fakta);
    }
    const kdy = sb === 'osa' ? `<span class="kdy">${esc(p.kdy.text || p.kdy.rok)}</span>` : '';
    return `<article class="polozka" id="p-${esc(p.id)}" data-id="${esc(p.id)}">${hlava}<div class="obsah-polozky">
      ${kdy}<h3>${esc(nazevPolozky(p))}</h3>${telo}${vazby(p)}${vic(p)}<div class="pata">${poprve(p)}</div></div></article>`;
  }

  /* ---------- hledání a filtr knih ---------- */
  const textPolozky = p => norm([nazevPolozky(p), p.taxon && p.taxon.t, p.role && p.role.t, p.kdy && p.kdy.text,
    ...['jmena', 'fakta', 'vystupuje'].flatMap(k => (p[k] || []).map(f => f.t))].join(' '));
  const sedi = p => !dotaz || norm(dotaz).split(/\s+/).every(s => textPolozky(p).includes(s));
  const skryta = k => volba.skryteKnihy.includes(String(k));
  const knihaPostavy = p => typeof p.kniha === 'string' ? 'P' : String(p.kniha);
  const projdeFiltr = (p, sb) => sb === 'postavy' ? !skryta(knihaPostavy(p))
    : sb === 'mista' ? !(p.knihy && p.knihy.length) || p.knihy.some(k => !skryta(skupinaKnihy(k))) : true;
  const polozky = sb => vid[sb].filter(p => projdeFiltr(p, sb) && sedi(p));

  const prazdno = sb => `<p class="prazdno">${dotaz ? 'Nic nenalezeno.'
    : sb === 'mista' ? 'Zatím žádná místa – odemknou se čtením.' : 'Zatím tu nic není – odemkne se čtením.'}</p>`;

  /* ---------- vykreslení záložek ---------- */
  function kresliMrizku(sb) {
    const s = polozky(sb);
    if (!s.length) return prazdno(sb);
    if (sb === 'postavy') {
      const skup = new Map();
      for (const p of s) { const k = knihaPostavy(p); if (!skup.has(k)) skup.set(k, []); skup.get(k).push(p); }
      const klice = [...skup.keys()].sort((a, b) => (a === 'P') - (b === 'P') || a - b);
      return klice.map(k => {
        const kn = DATA.knihy.find(x => String(x.k) === k);
        return `<h2 class="skupina">${esc(k === 'P' ? 'Povídky' : kn ? kn.n : 'Kniha ' + k)}</h2><div class="mrizka">${skup.get(k).map(p => karta(p, sb)).join('')}</div>`;
      }).join('');
    }
    if (sb === 'pojmy') {
      const druhy = [['artefakt', 'Artefakty'], ['pojem', 'Pojmy'], ['organizace', 'Organizace'], ['misto_v_textu', 'Místa v textu']];
      return druhy.map(([d, n]) => {
        const x = s.filter(p => p.druh === d);
        return x.length ? `<h2 class="skupina">${n}</h2><div class="mrizka">${x.map(p => karta(p, sb)).join('')}</div>` : '';
      }).join('');
    }
    return `<div class="mrizka${sb === 'populace' ? ' bestiar' : ''}">${s.map(p => karta(p, sb)).join('')}</div>`;
  }

  /* časová osa: hluboký čas v logaritmickém měřítku (roky před dneškem), dějiny a naše doba lineárně */
  const DNES = 2026;
  function useky(s) {
    const u = [
      { nazev: 'Hluboký čas', pozn: 'logaritmické měřítko – čím hlouběji do minulosti, tím víc let na centimetr', x: s.filter(p => p.kdy.rok < 1000), log: true },
      { nazev: 'Dějiny', pozn: 'lineárně', x: s.filter(p => p.kdy.rok >= 1000 && p.kdy.rok < 2000) },
      { nazev: 'Naše doba a blízká budoucnost', pozn: 'lineárně', x: s.filter(p => p.kdy.rok >= 2000) },
    ].filter(x => x.x.length);
    for (const us of u) {
      if (us.log) {
        const pred = us.x.map(p => Math.max(1, DNES - p.kdy.rok));
        const a = Math.log10(Math.max(...pred) * 1.6), b = Math.log10(Math.min(...pred) / 1.6);
        us.poloha = rok => (a - Math.log10(Math.max(1, DNES - rok))) / (a - b);
        us.znacky = [];
        const nasobky = a - b < 4 ? [1, 2, 5] : [1];   // úzký rozsah: i mezidílky, ať je z čeho číst
        for (let r = Math.floor(b); r <= Math.ceil(a); r++) for (const n of nasobky) {
          const pred = n * 10 ** r, l = Math.log10(pred);
          if (l >= b && l <= a) us.znacky.push({ rok: DNES - pred, text: 'před ' + pred.toLocaleString('cs') + ' lety' });
        }
      } else {
        const roky = us.x.map(p => p.kdy.rok), krok = us.nazev === 'Dějiny' ? 100 : 5;
        const a = Math.floor(Math.min(...roky) / krok) * krok, b = Math.max(Math.ceil((Math.max(...roky) + 1) / krok) * krok, a + krok);
        us.poloha = rok => (rok - a) / (b - a);
        const dil = (b - a) / krok > 10 ? krok * 2 : krok;
        us.znacky = [];
        for (let r = a; r <= b; r += dil) us.znacky.push({ rok: r, text: String(r) });
      }
    }
    return u;
  }
  function kresliOsu() {
    const s = polozky('osa').slice().sort((a, b) => a.kdy.rok - b.kdy.rok);
    if (!s.length) return prazdno('osa');
    return useky(s).map(u => `<section class="usek"><h2 class="skupina">${esc(u.nazev)} <small>${esc(u.pozn)}</small></h2>
      <div class="pruh">${u.znacky.map(z => `<span class="dilek" style="left:${(u.poloha(z.rok) * 100).toFixed(2)}%">${esc(z.text)}</span>`).join('')}
      ${u.x.map(p => `<button class="bod" data-skok="${esc(p.id)}" style="left:${(u.poloha(p.kdy.rok) * 100).toFixed(2)}%" title="${esc((p.kdy.text || p.kdy.rok) + ' – ' + p.nazev)}" aria-label="${esc(p.nazev)}"></button>`).join('')}</div>
      <div class="udalosti">${u.x.map(p => karta(p, 'osa')).join('')}</div></section>`).join('');
  }

  /* mapa: Leaflet bez preferCanvas (SVG značky jdou kliknout). Dva vzhledy (volba.mapa):
     „moderni“ = dlaždice OpenTopoMap + kroužky v barvách knih,
     „stara“ = kreslený pergamen z Natural Earth (stara_mapa.js) + ikony podle druhu místa s popisky. */
  let mapa = null, vrstva = null, vybraneMisto = null, prvniZobrazeni = true;
  let moderni = null, stara = null;   // stara = {podklad, sepie, ozdoby[]} po načtení dat světa
  const ATRIBUCE_TOPO = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)';
  const jeStara = () => volba.mapa === 'stara' && !!stara;
  function nastavVzhled() {
    document.querySelectorAll('[data-vzhled]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.vzhled === volba.mapa)));
    if (!mapa) return;
    if (volba.mapa === 'stara' && !stara) {
      const S = window.ATLAS_STARA;
      S.nacti(DATA.mapa || {}).then(() => {
        mapa.createPane('sepie');
        stara = {
          podklad: S.podklad(),
          // velký zoom: skutečný terén v sépii pod kresbou (Natural Earth na úroveň vesnic nestačí)
          sepie: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { pane: 'sepie', minZoom: S.SEPIE_OD, maxZoom: 17, attribution: ATRIBUCE_TOPO }),
          ozdoby: S.ozdoby(L, DATA.mapa || {}),
        };
        nastavVzhled(); kresliMapu();
      }).catch(() => { volba.mapa = 'moderni'; uloz(); nastavVzhled(); });
      return;
    }
    const st = jeStara();
    $('mapa').classList.toggle('stara', st);
    if (st) {
      if (mapa.hasLayer(moderni)) mapa.removeLayer(moderni);
      if (!mapa.hasLayer(stara.podklad)) { stara.podklad.addTo(mapa); stara.sepie.addTo(mapa); stara.ozdoby.forEach(o => o.addTo(mapa)); }
    } else {
      if (stara && mapa.hasLayer(stara.podklad)) { mapa.removeLayer(stara.podklad); mapa.removeLayer(stara.sepie); stara.ozdoby.forEach(o => o.remove()); }
      if (!mapa.hasLayer(moderni)) moderni.addTo(mapa);
    }
  }
  document.querySelectorAll('[data-vzhled]').forEach(b => b.addEventListener('click', () => {
    volba.mapa = b.dataset.vzhled; uloz(); nastavVzhled(); kresliMapu();
  }));
  function znackaStare(p) {
    const html = `<span class="ik-obal">${window.ATLAS_STARA.ikona(p.druh, (DATA.mapa || {}).ikony)}</span><span class="jm">${esc(p.nazev)}</span>`;
    const m = L.marker([p.lat, p.lon], {
      icon: L.divIcon({ className: `stara-znacka${p.id === vybraneMisto ? ' vybrana' : ''}${p.presnost === 'oblast' ? ' oblast' : ''}`, html, iconSize: [30, 30], iconAnchor: [15, 15] }),
      alt: p.nazev, riseOnHover: true,
    });
    m._atlasPoradi = window.ATLAS_STARA.poradiDruhu(p.druh) - (p.id === vybraneMisto ? 100 : 0);
    return m;
  }
  // staré mapě se značky v hustých místech (Chebsko) nesmí slít: skrýt překryté ikony a popisky
  function rozmistiStare() {
    if (!jeStara() || $('k-mista').hidden) return;
    const zn = [];
    vrstva.eachLayer(m => { if (m._icon) zn.push(m); });
    zn.forEach(m => m._icon.classList.remove('skryta', 'bez-jmena'));
    zn.sort((a, b) => a._atlasPoradi - b._atlasPoradi);
    const ikony = [], jmena = [];
    const prekryv = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
    for (const m of zn) {
      const b = mapa.latLngToContainerPoint(m.getLatLng());
      if (ikony.some(i => Math.hypot(i[0] - b.x, i[1] - b.y) < 26)) { m._icon.classList.add('skryta'); continue; }
      ikony.push([b.x, b.y]);
      const w = m._icon.querySelector('.jm').offsetWidth;
      const r = [b.x + 15, b.y - 9, b.x + 19 + w, b.y + 9];
      if (jmena.some(j => prekryv(j, r)) || ikony.some(i => i !== ikony[ikony.length - 1] && prekryv(r, [i[0] - 13, i[1] - 13, i[0] + 13, i[1] + 13]))) m._icon.classList.add('bez-jmena');
      else jmena.push(r);
    }
  }
  function kresliMapu() {
    const s = polozky('mista');
    if (!mapa && typeof L !== 'undefined') {
      mapa = L.map('mapa', { zoomControl: true, worldCopyJump: true }).setView([50, 12.5], 5);
      moderni = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: ATRIBUCE_TOPO });
      vrstva = L.layerGroup().addTo(mapa);
      mapa.on('zoomend', rozmistiStare);
      nastavVzhled();
    }
    if (mapa) {
      vrstva.clearLayers();
      if (jeStara()) for (const p of s) {
        const m = znackaStare(p).addTo(vrstva);
        m.on('click', () => ukazMisto(p.id, false));
        m._atlasId = p.id;
      }
      else for (const p of s) {
        const kn = tridaKnihy(p.knihy && p.knihy[0]);
        const m = L.circleMarker([p.lat, p.lon], {
          radius: p.presnost === 'oblast' ? 11 : 8, weight: 2, fillOpacity: p.presnost === 'oblast' ? 0.35 : 0.85,
          dashArray: p.presnost === 'fikce_u' ? '3 3' : null, className: `znacka ${kn}${p.id === vybraneMisto ? ' vybrana' : ''}`,
        }).addTo(vrstva);
        m.bindTooltip(esc(p.nazev) + (p.presnost === 'fikce_u' ? ' <small>(poloha přibližná)</small>' : p.presnost === 'oblast' ? ' <small>(oblast)</small>' : ''));
        m.on('click', () => ukazMisto(p.id, false));
        m._atlasId = p.id;
      }
      if (prvniZobrazeni && s.length && !$('k-mista').hidden) {
        prvniZobrazeni = false;
        // většina děje je v jedné oblasti (Chebsko) – začít tam, vzdálená místa jsou o oddálení dál
        const med = k => s.map(p => p[k]).sort((a, b) => a - b)[s.length >> 1], la = med('lat'), lo = med('lon');
        const blizko = s.filter(p => Math.abs(p.lat - la) < 4 && Math.abs(p.lon - lo) < 6);
        const vyber = blizko.length * 2 >= s.length ? blizko : s;
        mapa.fitBounds(L.latLngBounds(vyber.map(p => [p.lat, p.lon])), { padding: [30, 30], maxZoom: 9 });
      }
      rozmistiStare();
    } else $('mapa').innerHTML = '<p class="prazdno">Mapu se nepodařilo načíst.</p>';
    $('seznamMist').innerHTML = s.length ? '<h2 class="skupina">Místa</h2>' + s.map(p =>
      `<button class="radek-mista${p.id === vybraneMisto ? ' aktivni' : ''}" data-misto="${esc(p.id)}"><span class="tecka ${tridaKnihy(p.knihy && p.knihy[0])}"></span>${esc(p.nazev)}${p.presnost === 'fikce_u' ? ' <small class="pribl">≈ přibližně</small>' : ''}</button>`).join('') : prazdno('mista');
    const p = s.find(x => x.id === vybraneMisto);
    $('mistoDetail').innerHTML = p ? karta(p, 'mista') : (s.length ? '<p class="napoveda-mapy">Klepněte na značku nebo na místo v seznamu.</p>' : '');
  }
  function ukazMisto(id, priblizit) {
    vybraneMisto = id;
    kresliMapu();
    const p = vid.mista.find(x => x.id === id);
    if (p && mapa && priblizit) mapa.setView([p.lat, p.lon], Math.max(mapa.getZoom(), 7));
  }

  function kresliKartu(sb) {
    if (sb === 'mista') return kresliMapu();
    $('k-' + sb).innerHTML = sb === 'osa' ? kresliOsu() : kresliMrizku(sb);
  }

  /* ---------- stav, lišta, záložky ---------- */
  function prepocti() {
    poz = O.pozice(volba, cti(KLIC_K), cti(KLIC_P), POR, DATA.povidky.map(p => p.slug));
    vid = O.filtruj(DATA, poz);
    const popis = O.popisPozice(poz, DATA);
    $('popisPozice').textContent = popis === 'vše' ? 'vše' : popis === 'nic' ? 'zatím nic' : popis;
    $('stavRadek').innerHTML = (DATA.ukazka ? '<strong class="ukazka">Ukázková data – skutečný atlas se teprve připravuje.</strong> ' : '') + (volba.rezim === 'vse' ? 'Ukazuji celý atlas, včetně všeho, co odhaluje konec ságy.'
      : `${volba.rezim === 'rucne' ? 'Nastaveno ručně' : 'Podle čtečky'}: ${popis === 'nic' ? 'zatím nic přečteno – vidíte jen to, co je známo předem' : 'přečteno do: ' + esc(popis)}${poz.povidky.size ? ` · povídky: ${poz.povidky.size}` : ''}. Co jste ještě nečetli, tu není.`);
    vse();
  }
  function vse() {
    for (const sb of KARTY) {
      const n = polozky(sb).length;
      document.querySelector(`[data-karta="${sb}"] .pocet`).textContent = n ? `(${n})` : '';
      kresliKartu(sb);
    }
  }
  function prepniKartu(sb) {
    volba.karta = sb; uloz();
    document.querySelectorAll('[data-karta]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.karta === sb)));
    for (const k of KARTY) $('k-' + k).hidden = k !== sb;
    if (sb === 'mista' && mapa) { mapa.invalidateSize(); kresliMapu(); }
  }
  document.querySelectorAll('[data-karta]').forEach(b => b.addEventListener('click', () => prepniKartu(b.dataset.karta)));

  // skok na související položku (jiná záložka, zvýraznit)
  function skok(id) {
    const c = najdi(id);
    if (!c) return;
    if (c.sb === 'mista') { prepniKartu('mista'); ukazMisto(id, true); return; }
    if (!polozky(c.sb).some(p => p.id === id)) { dotaz = ''; $('hledat').value = ''; volba.skryteKnihy = []; vse(); }
    prepniKartu(c.sb);
    const el = $('p-' + id);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.remove('zvyraznit'); void el.offsetWidth; el.classList.add('zvyraznit');
    }
  }
  /* ---------- zvětšení obrázku (lightbox) ---------- */
  let lb = null;   // {obr: [...], i, zpet: prvek s fokusem před otevřením}
  function ukazLb() {
    const o = lb.obr[lb.i];
    $('lbObr').src = o.src; $('lbObr').alt = o.popis;
    $('lbPopis').innerHTML = `${esc(o.popis)} ${o.od ? misto(o.od) : ''}`;
    $('lbPocet').textContent = lb.obr.length > 1 ? `${lb.i + 1} / ${lb.obr.length}` : '';
    $('lbPredchozi').hidden = $('lbDalsi').hidden = lb.obr.length < 2;
  }
  function otevriLb(id, i) {
    const c = najdi(id);
    if (!c) return;
    lb = { obr: obrazkyPolozky(c.p), i: +i || 0, zpet: document.activeElement };
    ukazLb();
    $('lightbox').hidden = false;
    $('lbZavrit').focus();
  }
  function zavriLb() {
    if (!lb) return false;
    $('lightbox').hidden = true; $('lbObr').removeAttribute('src');
    const z = lb.zpet; lb = null;
    if (z && z.focus) z.focus();
    return true;
  }
  const posunLb = d => { if (lb && lb.obr.length > 1) { lb.i = (lb.i + d + lb.obr.length) % lb.obr.length; ukazLb(); } };
  $('lbZavrit').onclick = zavriLb;
  $('lbPredchozi').onclick = () => posunLb(-1);
  $('lbDalsi').onclick = () => posunLb(1);
  $('lightbox').addEventListener('click', e => { if (e.target === $('lightbox') || e.target.classList.contains('lb-figura')) zavriLb(); });
  // přejetí prstem na mobilu
  let tah0 = null;
  $('lightbox').addEventListener('pointerdown', e => { tah0 = [e.clientX, e.clientY]; });
  $('lightbox').addEventListener('pointerup', e => {
    if (!tah0) return;
    const dx = e.clientX - tah0[0], dy = e.clientY - tah0[1]; tah0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) posunLb(dx < 0 ? 1 : -1);
  });

  document.addEventListener('click', e => {
    const g = e.target.closest('[data-galerie]'); if (g) return otevriLb(g.dataset.galerie, g.dataset.i);
    const s = e.target.closest('[data-skok]'); if (s) return skok(s.dataset.skok);
    const m = e.target.closest('[data-misto]'); if (m) return ukazMisto(m.dataset.misto, true);
  });

  /* ---------- nabídky ---------- */
  function vykresliNabCteni() {
    document.querySelectorAll('#nabCteni .prep').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.prikaz === 'rezim-' + volba.rezim)));
    $('rucne').hidden = volba.rezim !== 'rucne';
    const akt = DATA.kapitoly.find(k => k.t === volba.do), kniha = akt ? akt.k : (+$('selKniha').value || 1);
    $('selKniha').innerHTML = DATA.knihy.map(k => `<option value="${k.k}"${k.k === kniha ? ' selected' : ''}>${esc(k.n)}</option>`).join('');
    naplnKapitoly(kniha);
    $('volbaPovidek').innerHTML = DATA.povidky.map(p => `<label class="radek"><input type="checkbox" value="${esc(p.slug)}"${(volba.povidky || []).includes(p.slug) ? ' checked' : ''}><span>${esc(p.nazev)}</span></label>`).join('');
    $('poznCteni').textContent = volba.rezim === 'ctecka'
      ? 'Pozice se čte ze čtečky Kronik a Povídek v tomto prohlížeči. Kapitola se počítá, když je dočtená nebo už čtete další.'
      : volba.rezim === 'rucne' ? 'Ruční volba platí, dokud ji nevrátíte na „Podle čtečky“.' : 'Pozor: ukazuje i rozuzlení celé ságy.';
  }
  function naplnKapitoly(kniha) {
    const kap = DATA.kapitoly.filter(k => k.k === kniha), i0 = DATA.kapitoly.indexOf(kap[0]);
    const pred = i0 > 0 ? DATA.kapitoly[i0 - 1].t : '';
    $('selKap').innerHTML = `<option value="${esc(pred)}">— tuto knihu teprve začínám —</option>` +
      kap.map(k => `<option value="${esc(k.t)}"${k.t === volba.do ? ' selected' : ''}>${esc(k.n)}</option>`).join('');
  }
  $('selKniha').onchange = e => { naplnKapitoly(+e.target.value); volba.do = $('selKap').value; uloz(); prepocti(); };
  $('selKap').onchange = e => { volba.do = e.target.value; uloz(); prepocti(); };
  $('volbaPovidek').addEventListener('change', () => {
    volba.povidky = [...$('volbaPovidek').querySelectorAll('input:checked')].map(i => i.value); uloz(); prepocti();
  });
  function vykresliNabFiltr() {
    const polozkyFiltru = [...DATA.knihy.map(k => [String(k.k), k.n]), ['P', 'Povídky']];
    $('filtrKnih').innerHTML = polozkyFiltru.map(([k, n]) => `<button class="tl prep" data-prikaz="filtr-${k}" aria-pressed="${!skryta(k)}">${esc(n)}</button>`).join('');
    $('tlFiltr').setAttribute('aria-pressed', String(volba.skryteKnihy.length > 0));
  }

  const PRIKAZY = {
    'rezim-ctecka': () => { volba.rezim = 'ctecka'; },
    'rezim-rucne': () => {
      if (volba.rezim !== 'rucne') {   // výchozí ruční volba = kam došla čtečka
        const p = O.poziceZCtecky(cti(KLIC_K), cti(KLIC_P), POR);
        volba.do = p.hranice > 0 ? DATA.kapitoly[p.hranice - 1].t : '';
        volba.povidky = [...p.povidky];
      }
      volba.rezim = 'rucne';
    },
    'rezim-vse': () => { volba.rezim = 'vse'; },
    'filtr-vse': () => { volba.skryteKnihy = []; },
  };
  function prikaz(id) {
    if (id.startsWith('filtr-') && id !== 'filtr-vse') {
      const k = id.slice(6);
      volba.skryteKnihy = skryta(k) ? volba.skryteKnihy.filter(x => x !== k) : [...volba.skryteKnihy, k];
    } else if (PRIKAZY[id]) PRIKAZY[id]();
    else return;
    uloz(); prepocti();
    if (!$('nabCteni').hidden) vykresliNabCteni();
    vykresliNabFiltr();
  }

  function zavriNabidky() {
    document.querySelectorAll('.nabidka:not([hidden])').forEach(n => { n.hidden = true; });
    document.querySelectorAll('[data-nabidka][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const n = $(b.dataset.nabidka), bylo = !n.hidden;
    zavriNabidky();
    if (bylo) return;
    if (n.id === 'nabCteni') vykresliNabCteni();
    if (n.id === 'nabFiltr') vykresliNabFiltr();
    n.hidden = false; b.setAttribute('aria-expanded', 'true');
    const r = b.getBoundingClientRect();
    n.style.top = (r.bottom + 4) + 'px';
    n.style.maxHeight = Math.max(160, innerHeight - r.bottom - 12) + 'px';
    n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
  }));
  document.addEventListener('click', e => {
    const b = e.target.closest('.nabidka [data-prikaz]');
    if (b) { e.stopPropagation(); return prikaz(b.dataset.prikaz); }
    if (!e.target.closest('.nabidka')) zavriNabidky();
  });
  addEventListener('resize', zavriNabidky);

  /* ---------- hledání, klávesy, změny ve čtečce ---------- */
  let casovac = 0;
  $('hledat').addEventListener('input', e => { clearTimeout(casovac); casovac = setTimeout(() => { dotaz = e.target.value.trim(); vse(); }, 150); });
  document.addEventListener('keydown', e => {
    if (lb) {
      if (e.key === 'Escape') zavriLb();
      else if (e.key === 'ArrowLeft') posunLb(-1);
      else if (e.key === 'ArrowRight') posunLb(1);
      else if (e.key === 'Tab') {   // fokus zůstává v okně
        const f = [...$('lightbox').querySelectorAll('button:not([hidden]), a[href]')];
        const i = f.indexOf(document.activeElement);
        e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
      return;
    }
    if (e.key === 'Escape') return zavriNabidky();
    if (e.target.closest('input, select, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); $('hledat').focus(); }
    else if (/^[1-5]$/.test(e.key)) prepniKartu(KARTY[+e.key - 1]);
  });
  // čtečka v jiné kartě/záložce rozcestníku posunula pozici
  addEventListener('storage', e => { if (e.key === KLIC_K || e.key === KLIC_P) prepocti(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && volba.rezim === 'ctecka') prepocti(); });

  prepocti();
  prepniKartu(volba.karta);
  window.ATLAS = { prepocti, prepniKartu, skok, ukazMisto, otevriLb, zavriLb, mapa: () => mapa, viditelne: () => vid, pozice: () => poz, jeStara };
})();
