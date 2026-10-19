/* Voynichův rukopis – aplikace: přepisy, navigace, prohlížeč, panel s přepisem, poznámky.
 * Výzkumné režimy (hledání, analýza, srovnání, folia, poznámky) jsou ve vyzkum.js, texty v info.js.
 * Sdílený stav a pomocné funkce jsou na window.Voynich. */
(function () {
  'use strict';
  const J = window.VoynichJadro, G = window.VoynichGrafy, esc = G.esc;
  const SN = window.VOYNICH_SNIMKY;
  const SNIMKY = SN.snimky;
  const $ = s => document.querySelector(s);
  const KLIC_STAV = 'webapp_voynich_stav', KLIC_POZN = 'webapp_voynich_poznamky', KLIC_ZAL = 'webapp_voynich_zalozky';

  const cti = (k, vych) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : vych; } catch (_) { return vych; } };
  const pis = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* plné nebo zakázané úložiště */ } };

  // ---------- stav ----------
  const vychozi = {
    snimek: 2, rezim: 'prohlizec', prepis: 'zl', volby: { nejisteMezery: true, alternativy: 'prvni' },
    tab: 'prepis', nahledy: true, panel: true, zobrazeni: 'text', porovnat: '', zvyrazni: '',
    obraz: { jas: 100, kontrast: 100, sytost: 100, odstin: 0, sede: false, negativ: false },
    srovnani: false, druhy: 3, sync: false
  };
  const ulozeny = cti(KLIC_STAV, {});
  const stav = Object.assign({}, vychozi, ulozeny, {
    volby: Object.assign({}, vychozi.volby, ulozeny.volby),
    obraz: Object.assign({}, vychozi.obraz, ulozeny.obraz)
  });
  let ulozTimer = null;
  function ulozStav() { clearTimeout(ulozTimer); ulozTimer = setTimeout(() => pis(KLIC_STAV, stav), 250); }

  // ---------- přepisy ----------
  const PREPISY = [
    { kod: 'zl', nazev: 'Zandbergen–Landini (ZL)' },
    { kod: 'it', nazev: 'Takahashi (IT)' },
    { kod: 'rf', nazev: 'Referenční ZL+GC (RF)' }
  ];
  const precteno = {}, korpusy = {};
  function nactiPrepis(kod) {
    if (precteno[kod]) return Promise.resolve(precteno[kod]);
    const hotovo = () => {
      const d = window.VOYNICH_PREPISY && window.VOYNICH_PREPISY[kod];
      if (!d) throw new Error('přepis ' + kod + ' chybí');
      precteno[kod] = Object.assign(J.ctiIVTFF(d.text), { kod, nazev: d.nazev, popis: d.popis, zdroj: d.zdroj });
      return precteno[kod];
    };
    if (window.VOYNICH_PREPISY && window.VOYNICH_PREPISY[kod]) return Promise.resolve(hotovo());
    return new Promise((ok, chyba) => {
      const s = document.createElement('script');
      s.src = 'voynich/data/prepis_' + kod + '.js';
      s.onload = () => { try { ok(hotovo()); } catch (e) { chyba(e); } };
      s.onerror = () => chyba(new Error('Nepodařilo se načíst přepis ' + kod));
      document.head.appendChild(s);
    });
  }
  function klicVoleb() { return stav.volby.nejisteMezery + '|' + stav.volby.alternativy; }
  function korpus(kod) {
    kod = kod || stav.prepis;
    const k = kod + '|' + klicVoleb();
    if (!korpusy[k]) korpusy[k] = J.korpus(precteno[kod], stav.volby);
    return korpusy[k];
  }
  function prepis(kod) { return precteno[kod || stav.prepis]; }

  // ---------- snímky a stránky ----------
  const snimekStranky = {};
  SNIMKY.forEach((s, i) => s.stranky.forEach(id => { if (!(id in snimekStranky)) snimekStranky[id] = i; }));
  const urlSnimku = s => 'voynich/strany/' + s.soubor;
  const urlNahledu = s => 'voynich/nahledy/' + s.soubor;
  const urlOriginalu = s => SN.iiif + s.yale + '/full/full/0/default.jpg';
  function popisSnimku(s) {
    if (s.stranky.length) return s.stranky.map(J.popisStranky).join(' + ');
    return s.popis || s.yale_popisek;
  }
  function kratkyPopis(s) {
    if (!s.stranky.length) return s.popis.replace(/ \(.*\)$/, '').replace('Vnitřní strana přední desky', 'Vnitřek desky');
    if (s.stranky.length === 1) return J.popisStranky(s.stranky[0]).replace(/ \(.*\)$/, '');
    return s.stranky[0] + '–' + s.stranky[s.stranky.length - 1].replace(/^f/, '');
  }
  function sekceSnimku(s) {
    const zl = precteno.zl;
    if (!s.stranky.length || !zl) return 'Vazba a desky';
    const typy = s.stranky.map(id => zl.podleId[id].vars.I);
    const t = typy.find(x => x !== 'T') || typy[0];
    return { H: 'Bylinná', A: 'Astronomická', Z: 'Zvěrokruh', C: 'Kosmologická', B: 'Biologická', P: 'Farmaceutická', S: 'Recepty (hvězdičky)', T: 'Text' }[t] || 'Jiné';
  }
  function najdiFolio(text) {
    let t = (text || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!t) return -1;
    if (/^#?\d+$/.test(t) && t.startsWith('#')) return Math.min(SNIMKY.length, Math.max(1, +t.slice(1))) - 1;
    if (t === 'ros' || t === 'fros' || t.startsWith('rozet')) return snimekStranky.fRos;
    if (!t.startsWith('f')) t = 'f' + t;
    if (t in snimekStranky) return snimekStranky[t];
    // f68r → první část f68r1, f70v → f70v2 …
    const id = Object.keys(snimekStranky).find(k => k.startsWith(t) && /^\d$/.test(k.slice(t.length)));
    if (id) return snimekStranky[id];
    const m = /^f(\d+)([rv]?)$/.exec(t);
    if (m) {
      // nejbližší existující folio (chybějící listy 12, 59–64, 74, 91, 92, 97, 98, 109, 110)
      const n = +m[1];
      for (let d = 0; d < 20; d++) for (const x of [n + d, n - d]) {
        const kl = Object.keys(snimekStranky).find(k => new RegExp('^f' + x + (m[2] || '[rv]') + '\\d?$').test(k));
        if (kl) return snimekStranky[kl];
      }
    }
    return -1;
  }

  // ---------- poznámky a záložky ----------
  let poznamky = cti(KLIC_POZN, {}), zalozky = cti(KLIC_ZAL, []);
  function ulozPoznamky() { pis(KLIC_POZN, poznamky); }
  function ulozZalozky() { pis(KLIC_ZAL, zalozky); }

  // ---------- režimy ----------
  const rezimy = {};
  function prepniRezim(r, bezHistorie) {
    if (!document.getElementById('m-' + r)) r = 'prohlizec';
    stav.rezim = r;
    document.querySelectorAll('#rezimy button').forEach(b => b.classList.toggle('zap', b.dataset.rezim === r));
    document.querySelectorAll('section.rezim').forEach(s => s.classList.toggle('zap', s.id === 'm-' + r));
    if (rezimy[r] && rezimy[r].ukaz) rezimy[r].ukaz();
    if (r === 'prohlizec') plochy.forEach(p => p.prizpusobeno && p.prizpusob(p.prizpusobeno));
    if (!bezHistorie) zapisHash();
    ulozStav();
  }

  // ---------- náhledy ----------
  function kresliNahledy() {
    const el = $('#nahledy');
    let html = '', posl = '';
    SNIMKY.forEach((s, i) => {
      const sek = sekceSnimku(s);
      if (sek !== posl) { html += `<div class="sekce-nadpis">${esc(sek)}</div>`; posl = sek; }
      html += `<button class="nahled" data-i="${i}" title="${esc(popisSnimku(s))}"><img loading="lazy" src="${urlNahledu(s)}" alt=""><span>${esc(kratkyPopis(s))}</span><b class="znacky"></b></button>`;
    });
    el.innerHTML = html;
    el.addEventListener('click', e => {
      const b = e.target.closest('.nahled');
      if (b) jdiNa(+b.dataset.i);
    });
    oznacNahledy();
  }
  function oznacNahledy() {
    const zasahy = zasahyPoSnimcich();
    document.querySelectorAll('#nahledy .nahled').forEach(b => {
      const i = +b.dataset.i;
      b.classList.toggle('zap', i === aktivniSnimek());
      const zn = [];
      if (zalozky.includes(i)) zn.push('<i title="záložka">★</i>');
      if (poznamky[i] && poznamky[i].text) zn.push('<i title="poznámka">✎</i>');
      b.querySelector('.znacky').innerHTML = zn.join('');
      let z = b.querySelector('.zasahy');
      if (zasahy && zasahy[i]) {
        if (!z) { z = document.createElement('b'); z.className = 'zasahy'; b.appendChild(z); }
        z.textContent = zasahy[i];
        z.title = 'výskytů zvýrazněného hledání';
      } else if (z) z.remove();
    });
  }
  function posunNahledy() {
    const b = document.querySelector(`#nahledy .nahled[data-i="${aktivniSnimek()}"]`);
    if (b) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // ---------- zvýraznění ----------
  let zvyrDotaz = null;
  function nastavZvyrazneni(dotaz, rezimHledani) {
    stav.zvyrazni = dotaz || '';
    stav.zvyrazniRezim = rezimHledani || stav.zvyrazniRezim || 'slovo';
    zvyrDotaz = null;
    if (stav.zvyrazni) {
      try { zvyrDotaz = J.sestavDotaz(stav.zvyrazni, stav.zvyrazniRezim); } catch (_) { zvyrDotaz = null; }
    }
    _zasahy = null;
    ulozStav();
    oznacNahledy();
    kresliPanel();
  }
  let _zasahy = null;
  function zasahyPoSnimcich() {
    if (!zvyrDotaz || !precteno[stav.prepis]) return null;
    if (_zasahy) return _zasahy;
    const nal = J.hledej(korpus(), stav.zvyrazni, stav.zvyrazniRezim);
    const z = {};
    for (const n of nal) {
      const i = snimekStranky[n.r.stranka.id];
      z[i] = (z[i] || 0) + 1;
    }
    _zasahy = z;
    return z;
  }
  // indexy slov řádku, které zvýraznit
  function zvyrazneneVRadku(r) {
    const out = new Set();
    if (!zvyrDotaz) return out;
    if (!zvyrDotaz.radek) { r.slova.forEach((w, i) => { if (zvyrDotaz.re.test(w)) out.add(i); }); return out; }
    for (const n of J.hledej({ lokusy: [r], slova: [] }, stav.zvyrazni, 'regex')) for (let i = n.od; i <= n.do; i++) out.add(i);
    return out;
  }

  // ---------- prohlížeč ----------
  const plochy = [];
  let aktivni = 0;
  const snimkyPloch = [stav.snimek, stav.druhy];
  function aktivniSnimek() { return snimkyPloch[aktivni]; }

  function vytvorPlochy() {
    const kont = $('#plochy');
    kont.innerHTML = '';
    plochy.length = 0;
    const pocet = stav.srovnani ? 2 : 1;
    if (!stav.srovnani) aktivni = 0;
    for (let i = 0; i < pocet; i++) {
      const el = document.createElement('div');
      el.className = 'plocha';
      el.tabIndex = 0;
      el.setAttribute('aria-label', 'Snímek rukopisu – táhnout pro posun, kolečko pro přiblížení');
      kont.appendChild(el);
      const p = new window.VoynichPlocha(el, {
        naZmenu: pl => {
          if (plochy.indexOf(pl) === aktivni) $('#zoomHodnota').textContent = Math.round(pl.s * 100) + ' %';
          if (stav.sync && plochy.length === 2 && !synchronizuji) {
            synchronizuji = true;
            const druha = plochy[1 - plochy.indexOf(pl)];
            druha.nastavRelativni(pl.relativni());
            synchronizuji = false;
          }
        },
        naAktivaci: pl => { const i = plochy.indexOf(pl); if (i !== aktivni) { aktivni = i; poAktivaci(); } }
      });
      plochy.push(p);
      nactiDoPlochy(i);
    }
    poAktivaci();
    pouzijObraz();
    $('#tlSrovnat').classList.toggle('zap', !!stav.srovnani);
  }
  let synchronizuji = false;
  function nactiDoPlochy(i, zachovat) {
    const s = SNIMKY[snimkyPloch[i]];
    plochy[i].nastav({ url: urlSnimku(s), nahled: urlNahledu(s), w: s.w, h: s.h, popis: (stav.srovnani ? (i ? 'B · ' : 'A · ') : '') + popisSnimku(s) }, zachovat);
    // předem načíst sousední snímky
    [snimkyPloch[i] - 1, snimkyPloch[i] + 1].forEach(j => { if (SNIMKY[j]) { const im = new Image(); im.src = urlSnimku(SNIMKY[j]); } });
  }
  function poAktivaci() {
    plochy.forEach((p, i) => p.el.classList.toggle('vybrana', plochy.length > 1 && i === aktivni));
    const s = SNIMKY[aktivniSnimek()];
    $('#vstupFolio').value = s.stranky[0] || '#' + s.n;
    $('#poradiSnimku').textContent = `snímek ${s.n}/${SNIMKY.length}`;
    $('#odkazPlne').href = urlOriginalu(s);
    $('#tlZalozka').textContent = zalozky.includes(aktivniSnimek()) ? '★' : '☆';
    $('#tlZalozka').classList.toggle('zap', zalozky.includes(aktivniSnimek()));
    const p = plochy[aktivni];
    if (p) $('#zoomHodnota').textContent = Math.round(p.s * 100) + ' %';
    oznacNahledy();
    posunNahledy();
    kresliPanel();
  }
  function jdiNa(i, bezHistorie) {
    if (i < 0 || i >= SNIMKY.length || isNaN(i)) return;
    snimkyPloch[aktivni] = i;
    if (aktivni === 0) stav.snimek = i; else stav.druhy = i;
    if (stav.rezim !== 'prohlizec') prepniRezim('prohlizec', true);
    nactiDoPlochy(aktivni);
    poAktivaci();
    if (!bezHistorie) zapisHash();
    ulozStav();
  }
  // otevře stránku IVTFF (a případně zvýrazní řádek)
  function otevriStranku(id, lokusId) {
    const i = snimekStranky[id];
    if (i == null) return;
    stav.tab = 'prepis';
    jdiNa(i);
    if (lokusId) setTimeout(() => {
      const el = document.querySelector(`#panelObsah .lokus[data-lok="${CSS.escape(lokusId)}"]`);
      if (el) { el.scrollIntoView({ block: 'center' }); el.animate([{ background: 'var(--zvyrazneni-silne)' }, { background: 'transparent' }], { duration: 1800 }); }
    }, 30);
  }

  function pouzijObraz() {
    const o = stav.obraz;
    const f = [];
    if (o.jas !== 100) f.push(`brightness(${o.jas}%)`);
    if (o.kontrast !== 100) f.push(`contrast(${o.kontrast}%)`);
    if (o.sytost !== 100) f.push(`saturate(${o.sytost}%)`);
    if (o.odstin) f.push(`hue-rotate(${o.odstin}deg)`);
    if (o.sede) f.push('grayscale(1)');
    if (o.negativ) f.push('invert(1)');
    plochy.forEach(p => p.filtr(f.join(' ')));
    $('#tlFiltry').classList.toggle('zap', f.length > 0);
  }
  const PREDVOLBY_OBRAZU = {
    'Původní': { jas: 100, kontrast: 100, sytost: 100, odstin: 0, sede: false, negativ: false },
    'Inkoust': { jas: 110, kontrast: 230, sytost: 100, odstin: 0, sede: true, negativ: false },
    'Vybledlé písmo': { jas: 95, kontrast: 320, sytost: 60, odstin: 0, sede: false, negativ: false },
    'Pigmenty': { jas: 100, kontrast: 120, sytost: 260, odstin: 0, sede: false, negativ: false },
    'Negativ': { jas: 100, kontrast: 140, sytost: 100, odstin: 0, sede: true, negativ: true }
  };
  let otevrenyPopup = null;
  function zavriPopup() { if (otevrenyPopup) { otevrenyPopup.remove(); otevrenyPopup = null; } }
  function popupU(tlacitko, html, nastav) {
    const byl = otevrenyPopup && otevrenyPopup._tl === tlacitko;
    zavriPopup();
    if (byl) return null;
    const d = document.createElement('div');
    d.className = 'vyskakovaci';
    d.innerHTML = html;
    d._tl = tlacitko;
    document.body.appendChild(d);
    const r = tlacitko.getBoundingClientRect();
    d.style.position = 'fixed';
    d.style.top = (r.bottom + 6) + 'px';
    d.style.left = Math.max(6, Math.min(innerWidth - d.offsetWidth - 6, r.left)) + 'px';
    otevrenyPopup = d;
    if (nastav) nastav(d);
    return d;
  }
  document.addEventListener('pointerdown', e => {
    if (otevrenyPopup && !otevrenyPopup.contains(e.target) && !otevrenyPopup._tl.contains(e.target)) zavriPopup();
  });
  function popupObraz() {
    const o = stav.obraz;
    const posuvnik = (k, n, min, max, jed) => `<div class="radek"><label for="ob-${k}">${n}</label><input type="range" id="ob-${k}" data-k="${k}" min="${min}" max="${max}" value="${o[k]}"><span id="obv-${k}">${o[k]}${jed}</span></div>`;
    popupU($('#tlFiltry'),
      `<b>Obraz</b> <span class="tlumeny male">(platí pro všechny snímky)</span>
      ${posuvnik('jas', 'Jas', 30, 250, ' %')}${posuvnik('kontrast', 'Kontrast', 30, 400, ' %')}
      ${posuvnik('sytost', 'Sytost', 0, 400, ' %')}${posuvnik('odstin', 'Odstín', -180, 180, '°')}
      <div class="radek"><span></span><span><label class="prep"><input type="checkbox" id="ob-sede" ${o.sede ? 'checked' : ''}> Odstíny šedi</label>
      <label class="prep"><input type="checkbox" id="ob-negativ" ${o.negativ ? 'checked' : ''}> Negativ</label></span><span></span></div>
      <div class="predvolby">${Object.keys(PREDVOLBY_OBRAZU).map(k => `<button class="btn" data-predvolba="${esc(k)}">${esc(k)}</button>`).join('')}</div>`,
      d => {
        const obnov = () => {
          for (const k of ['jas', 'kontrast', 'sytost', 'odstin']) { d.querySelector('#ob-' + k).value = o[k]; d.querySelector('#obv-' + k).textContent = o[k] + (k === 'odstin' ? '°' : ' %'); }
          d.querySelector('#ob-sede').checked = o.sede; d.querySelector('#ob-negativ').checked = o.negativ;
        };
        d.addEventListener('input', e => {
          const k = e.target.dataset.k;
          if (k) { o[k] = +e.target.value; d.querySelector('#obv-' + k).textContent = o[k] + (k === 'odstin' ? '°' : ' %'); }
          if (e.target.id === 'ob-sede') o.sede = e.target.checked;
          if (e.target.id === 'ob-negativ') o.negativ = e.target.checked;
          pouzijObraz(); ulozStav();
        });
        d.addEventListener('click', e => {
          const p = e.target.dataset.predvolba;
          if (p) { Object.assign(o, PREDVOLBY_OBRAZU[p]); obnov(); pouzijObraz(); ulozStav(); }
        });
      });
  }
  function prepniSrovnani() {
    zavriPopup();
    stav.srovnani = !stav.srovnani;
    if (stav.srovnani) {
      snimkyPloch[1] = Math.min(SNIMKY.length - 1, snimkyPloch[0] + 1);
      stav.druhy = snimkyPloch[1];
      aktivni = 1;
      Dialog.info('Srovnání: klikněte na plochu A nebo B a vyberte jí snímek v náhledech nebo šipkami.');
    } else aktivni = 0;
    vytvorPlochy();
    ulozStav();
  }

  // ---------- panel ----------
  function kresliPanel() {
    document.querySelectorAll('#panelTaby button').forEach(b => b.classList.toggle('zap', b.dataset.tab === stav.tab));
    const volby = $('#panelVolby'), obsah = $('#panelObsah');
    const s = SNIMKY[aktivniSnimek()];
    if (!s || !precteno[stav.prepis]) { obsah.innerHTML = '<p class="tlumeny">Načítám přepis…</p>'; return; }
    if (stav.tab === 'prepis') {
      volby.classList.remove('skryto');
      volby.innerHTML = `
        <label class="prep" title="Zobrazit čistý text, nebo surový zápis IVTFF se všemi značkami">Zobrazit
          <select id="pvZobrazeni"><option value="text">text</option><option value="surovy">surový IVTFF</option></select></label>
        <label class="prep" title="Barevně vyznačit rozdíly proti jinému přepisu">Rozdíly proti
          <select id="pvPorovnat"><option value="">–</option>${PREPISY.filter(p => p.kod !== stav.prepis).map(p => `<option value="${p.kod}">${esc(p.nazev)}</option>`).join('')}</select></label>
        <label class="prep" title="Zvýraznit slovo nebo vzor (* a ?) na stránce i v náhledech">Zvýraznit
          <input type="search" id="pvZvyraznit" class="eva" style="width:110px" placeholder="např. qok*" value="${esc(stav.zvyrazni)}"></label>`;
      $('#pvZobrazeni').value = stav.zobrazeni;
      $('#pvPorovnat').value = stav.porovnat && stav.porovnat !== stav.prepis ? stav.porovnat : '';
      kresliPrepis(obsah, s);
    } else if (stav.tab === 'stranka') {
      volby.classList.add('skryto');
      kresliMetadata(obsah, s);
    } else {
      volby.classList.add('skryto');
      kresliPoznamku(obsah);
    }
  }

  const POPIS_DRUHU = { P: '¶', L: 'popisek', C: '◯', R: '↕' };
  function stitkyStranky(st) {
    const v = st.vars, out = [];
    if (v.I) out.push(`<span class="stitek-m" title="${esc(J.ILUSTRACE_POPIS[v.I] || '')}">${esc(J.ILUSTRACE[v.I] || v.I)}</span>`);
    if (v.L) out.push(`<span class="stitek-m" title="Currierův jazyk">jazyk ${esc(v.L)}</span>`);
    if (v.H) out.push(`<span class="stitek-m" title="Písař podle L. F. Davis">${v.H === '@' ? 'víc písařů' : 'písař ' + esc(v.H)}</span>`);
    if (v.Q) out.push(`<span class="stitek-m" title="Kvaternion (složka), pořadí strany ve složce">sl. ${esc(v.Q)}${v.P ? '/' + esc(v.P) : ''}</span>`);
    return out.join('');
  }

  function kresliPrepis(obsah, s) {
    if (!s.stranky.length) {
      obsah.innerHTML = `<p class="tlumeny">Na tomto snímku (${esc(s.popis)}) není text rukopisu.</p>` + kartaSlovaHtml();
      return;
    }
    const k = korpus();
    const kPor = stav.porovnat && stav.porovnat !== stav.prepis && precteno[stav.porovnat] ? korpus(stav.porovnat) : null;
    const radkyStranky = id => k.lokusy.filter(r => r.stranka.id === id);
    const porMapa = kPor ? new Map(kPor.lokusy.map(r => [r.lokus.id, r])) : null;
    let html = kartaSlovaHtml();
    for (const id of s.stranky) {
      const st = prepis().podleId[id];
      html += `<div class="pstrana"><div class="pstrana-hlava"><b class="eva">${esc(J.popisStranky(id))}</b><span class="stitky">${st ? stitkyStranky(st) : ''}</span></div>`;
      if (!st) { html += `<p class="tlumeny male">Tento přepis stránku ${esc(id)} neobsahuje.</p></div>`; continue; }
      const radky = radkyStranky(id);
      if (!radky.length) html += '<p class="tlumeny male">Bez textu.</p>';
      for (const r of radky) {
        const l = r.lokus;
        const tipLok = `${l.id}\n${J.TYP_LOKUSU[l.typ] || l.typ}\nPoloha: ${J.LOKATOR[l.lokator] || l.lokator}` + (r.H ? `\nPísař ${r.H}` : '');
        html += `<div class="lokus druh-${l.druh}${l.zacatekOdstavce ? ' odstavec-zacatek' : ''}" data-lok="${esc(l.id)}"><span class="lid" title="${esc(tipLok)}"><b>${l.cislo}</b> ${POPIS_DRUHU[l.druh] === '¶' ? l.typ : esc(POPIS_DRUHU[l.druh] || l.typ)}</span>`;
        if (stav.zobrazeni === 'surovy') {
          html += `<span class="surovy eva">${esc(l.surovy)}</span></div>`;
          continue;
        }
        const zv = zvyrazneneVRadku(r);
        let slova;
        if (porMapa) {
          const druhy = porMapa.get(l.id);
          const d = J.rozdilSlov(r.slova, druhy ? druhy.slova : []);
          let i = 0;
          slova = d.map(x => {
            if (x.t === '+') return `<span class="w d-navic eva" title="jen v druhém přepisu" data-w="${esc(x.b)}">${esc(x.b)}</span>`;
            const idx = i++;
            const tr = (x.t === '~' ? ' d-zmena' : x.t === '-' ? ' d-chybi' : '') + (zv.has(idx) ? ' hl' : '') + (x.a.indexOf('?') >= 0 ? ' nejiste' : '');
            const tt = x.t === '~' ? ` title="druhý přepis: ${esc(x.b)}"` : x.t === '-' ? ' title="v druhém přepisu chybí"' : '';
            return `<span class="w${tr} eva" data-w="${esc(x.a)}"${tt}>${esc(x.a)}</span>`;
          });
        } else {
          slova = r.slova.map((w, i) => `<span class="w eva${zv.has(i) ? ' hl' : ''}${w.indexOf('?') >= 0 ? ' nejiste' : ''}${w === vybraneSlovo ? ' hl-vyber' : ''}" data-w="${esc(w)}">${esc(w)}</span>`);
        }
        html += `<span class="ltext">${slova.join('<span class="sep">.</span>')}${l.poznamky.length ? `<span class="pozn" title="${esc(l.poznamky.join('\n'))}">✱</span>` : ''}</span></div>`;
      }
      html += '</div>';
    }
    html += `<p class="tlumeny male">Přepis: ${esc(prepis().nazev)} · <a href="${esc(prepis().zdroj)}" target="_blank" rel="noopener">zdroj</a>. Klikněte na slovo pro jeho četnost, výskyty a podobná slova. Podtečkovaná slova obsahují nečitelný znak „?“.</p>`;
    obsah.innerHTML = html;
  }

  // ---------- karta slova ----------
  let vybraneSlovo = '';
  function vyberSlovo(w) {
    vybraneSlovo = w;
    kresliPanel();
    $('#panelObsah').scrollTop = 0;
  }
  function kartaSlovaHtml() {
    if (!vybraneSlovo) return '';
    const k = korpus();
    const w = vybraneSlovo;
    const frek = frekvence();
    const z = frek.find(x => x.w === w);
    const n = z ? z.n : 0;
    const nal = J.hledej(k, w, 'slovo');
    const stranek = new Set(nal.map(x => x.r.stranka.id)).size;
    const podleL = J.rozlozeni(k, w, 'L').filter(x => x.v !== '?' || x.n);
    const podleI = J.rozlozeni(k, w, 'I').filter(x => x.n).sort((a, b) => b.podil - a.podil);
    const podobna = J.podobnaSlova(w, frek.slice(0, 4000), 1).slice(0, 14);
    const promile = x => G.cislo(Math.round(x * 10000) / 10, 1) + ' ‰';
    let h = `<div class="karta-slova"><h4><span class="eva">${esc(w)}</span><span class="tlumeny male">${n}× · ${z ? z.poradi + '. nejčastější' : 'nenalezeno'} · na ${stranek} stránkách</span><button class="btn ikona zavrit" data-akce="zavritSlovo" aria-label="Zavřít">✕</button></h4>`;
    h += `<table class="meta"><tr><th>Jazyk</th><td>${podleL.map(x => `${x.v === '?' ? 'neurčen' : x.v}: ${x.n}× (${promile(x.podil)})`).join(' · ')}</td></tr>`;
    h += `<tr><th>Sekce</th><td>${podleI.map(x => `${esc(J.ILUSTRACE[x.v] || x.v)}: ${x.n}× (${promile(x.podil)})`).join(' · ') || '–'}</td></tr>`;
    h += `<tr><th>Podobná</th><td class="eva">${podobna.map(p => `<a href="#" data-slovo="${esc(p.w)}">${esc(p.w)}</a> <span class="tlumeny">${p.n}</span>`).join(', ') || '–'}</td></tr></table>`;
    h += `<div class="radek-formu" style="margin:8px 0 4px"><button class="btn" data-akce="hledatSlovo">🔤 Všechny výskyty</button><button class="btn" data-akce="zvyraznitSlovo">🖍 Zvýraznit všude</button></div>`;
    h += kwicHtml(k, nal.slice(0, 25), 4);
    if (nal.length > 25) h += `<p class="tlumeny male">… a dalších ${nal.length - 25} výskytů (všechny v režimu Hledání).</p>`;
    return h + '</div>';
  }
  function kwicHtml(k, nalezy, n) {
    return '<div class="kwic eva">' + nalezy.map(x => {
      const c = J.kontext(k, x, n || 5);
      return `<div><span class="lok"><a data-lok="${esc(x.r.lokus.id)}" data-str="${esc(x.r.stranka.id)}" title="otevřít v prohlížeči">${esc(x.r.lokus.id)}</a></span><span class="l"><bdi>${esc(c.vlevo.join('.'))}</bdi></span><span class="s">${esc(c.shoda.join('.'))}</span><span class="p">${esc(c.vpravo.join('.'))}</span></div>`;
    }).join('') + '</div>';
  }
  let _frek = null, _frekKlic = '';
  function frekvence() {
    const kl = stav.prepis + '|' + klicVoleb();
    if (_frekKlic !== kl) { _frek = J.frekvenceSlov(korpus()); _frekKlic = kl; }
    return _frek;
  }

  // ---------- metadata ----------
  function kresliMetadata(obsah, s) {
    let h = `<table class="meta"><tr><th>Snímek</th><td>${s.n} z ${SNIMKY.length} · ${s.w}×${s.h} px na webu</td></tr>
      <tr><th>Popisek Yale</th><td>${esc(s.yale_popisek)}</td></tr>
      <tr><th>Originál</th><td><a href="${esc(urlOriginalu(s))}" target="_blank" rel="noopener">plné rozlišení (IIIF)</a> · <a href="${esc(SN.katalog)}" target="_blank" rel="noopener">katalog Yale</a> · <a href="${esc(urlSnimku(s))}" download="voynich_${String(s.n).padStart(3, '0')}.webp">stáhnout WebP</a></td></tr></table>`;
    const zl = precteno.zl;
    for (const id of s.stranky) {
      const st = zl.podleId[id];
      const v = st.vars;
      const r = korpus('zl').lokusy.filter(x => x.stranka.id === id);
      const slov = r.reduce((a, x) => a + x.slova.length, 0);
      const druhy = J.cetnosti(r.map(x => x.lokus.druh));
      h += `<h3 class="eva">${esc(J.popisStranky(id))}</h3><table class="meta">
        <tr><th>Ilustrace</th><td>${esc(J.ILUSTRACE_POPIS[v.I] || v.I || '–')}</td></tr>
        <tr><th>Currierův jazyk</th><td>${esc(v.L || 'neurčen')}</td></tr>
        <tr><th>Písař (Davis)</th><td>${v.H === '@' ? 'víc písařů – viz řádky' : esc(v.H || 'neurčen')}</td></tr>
        <tr><th>Currierova ruka</th><td>${esc(v.C || '–')}</td></tr>
        <tr><th>Složka (kvaternion)</th><td>${esc(v.Q || '–')} · strana ve složce ${esc(v.P || '–')} · list ${esc(v.F || '–')} · dvojlist ${esc(v.B || '–')}</td></tr>
        <tr><th>Cizí písmo</th><td>${v.X ? esc(J.MALBA.X[v.X] || v.X) : 'ne'}</td></tr>
        <tr><th>Text (ZL)</th><td>${r.length} položek, ${slov} slov · ${Array.from(druhy.entries()).map(([d, n]) => `${J.DRUH_LOKUSU[d] || d}: ${n}`).join(', ')}</td></tr>
      </table>`;
      if (st.komentare.length) h += `<p class="male tlumeny" style="margin:8px 0 4px">Poznámky k transliteraci (R. Zandbergen, anglicky):</p><div class="komentar-zl">${esc(st.komentare.join('\n').replace(/\n{3,}/g, '\n\n').trim())}</div>`;
    }
    obsah.innerHTML = h;
  }

  // ---------- poznámka ----------
  function kresliPoznamku(obsah) {
    const i = aktivniSnimek(), s = SNIMKY[i];
    const p = poznamky[i] || { text: '' };
    obsah.innerHTML = `<p class="male tlumeny" style="margin-top:0">Poznámka ke snímku <b>${esc(popisSnimku(s))}</b>. Ukládá se jen v tomto prohlížeči; zálohu stáhnete v režimu Poznámky.</p>
      <textarea class="poznamka" id="poleZnamky" placeholder="Vaše pozorování, hypotézy, odkazy na literaturu…">${esc(p.text)}</textarea>
      <p class="male tlumeny" id="stavPoznamky">${p.zmeneno ? 'Naposledy upraveno ' + new Date(p.zmeneno).toLocaleString('cs-CZ') : ''}</p>
      <div class="radek-formu"><button class="btn" id="tlZalozka2">${zalozky.includes(i) ? '★ Odebrat záložku' : '☆ Přidat záložku'}</button></div>`;
    const ta = $('#poleZnamky');
    let t = null;
    ta.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const text = ta.value;
        if (text.trim()) poznamky[i] = { text, zmeneno: Date.now() }; else delete poznamky[i];
        ulozPoznamky();
        $('#stavPoznamky').textContent = 'Uloženo ' + new Date().toLocaleTimeString('cs-CZ');
        oznacNahledy();
      }, 400);
    });
    $('#tlZalozka2').addEventListener('click', () => { prepniZalozku(); kresliPanel(); });
  }
  function prepniZalozku(i) {
    i = i == null ? aktivniSnimek() : i;
    const j = zalozky.indexOf(i);
    if (j >= 0) zalozky.splice(j, 1); else { zalozky.push(i); zalozky.sort((a, b) => a - b); }
    ulozZalozky();
    poAktivaci();
  }

  // ---------- adresa ----------
  function zapisHash() {
    let h = '';
    if (stav.rezim === 'prohlizec') {
      const s = SNIMKY[snimkyPloch[0]];
      h = s.stranky.length ? s.stranky[0] : 's=' + s.n;
    } else if (stav.rezim === 'hledani' && window.Voynich.dotazHledani) {
      h = 'hledat=' + encodeURIComponent(window.Voynich.dotazHledani());
    } else h = 'rezim=' + stav.rezim;
    try { history.replaceState(null, '', '#' + h); } catch (_) { /* file:// v některých prohlížečích */ }
  }
  function ctiHash() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (!h) return false;
    if (h.startsWith('rezim=')) { prepniRezim(h.slice(6), true); return 'rezim'; }
    if (h.startsWith('hledat=')) { prepniRezim('hledani', true); if (window.Voynich.hledej) window.Voynich.hledej(h.slice(7)); return 'hledat'; }
    let i = -1;
    if (h.startsWith('s=')) i = Math.max(0, Math.min(SNIMKY.length - 1, (+h.slice(2) || 1) - 1));
    else i = najdiFolio(h);
    if (i < 0) return false;
    snimkyPloch[0] = i; stav.snimek = i; stav.rezim = 'prohlizec';
    return 'stranka';
  }
  function odkazNaStranku() {
    const s = SNIMKY[aktivniSnimek()];
    return location.href.split('#')[0] + '#' + (s.stranky[0] || 's=' + s.n);
  }

  // ---------- ovládání ----------
  function napojOvladani() {
    $('#rezimy').addEventListener('click', e => { const b = e.target.closest('button'); if (b) prepniRezim(b.dataset.rezim); });
    $('#tlPredchozi').addEventListener('click', () => jdiNa(aktivniSnimek() - 1));
    $('#tlDalsi').addEventListener('click', () => jdiNa(aktivniSnimek() + 1));
    $('#vstupFolio').addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const i = najdiFolio(e.target.value);
      if (i >= 0) { jdiNa(i); e.target.blur(); } else Dialog.chyba('Folio „' + e.target.value + '“ nenalezeno');
    });
    $('#vstupFolio').addEventListener('change', e => { const i = najdiFolio(e.target.value); if (i >= 0 && i !== aktivniSnimek()) jdiNa(i); });
    $('#seznamFolii').innerHTML = Object.keys(snimekStranky).map(id => `<option value="${id}">${esc(J.popisStranky(id))}</option>`).join('');
    const p = () => plochy[aktivni];
    $('#tlPriblizit').addEventListener('click', () => p().zoomKolem(1.4));
    $('#tlOddalit').addEventListener('click', () => p().zoomKolem(1 / 1.4));
    $('#tlCele').addEventListener('click', () => p().prizpusob('cele'));
    $('#tlSirka').addEventListener('click', () => p().prizpusob('sirka'));
    $('#tl11').addEventListener('click', () => p().prizpusob('1:1'));
    $('#tlOtocit').addEventListener('click', () => p().otoc(90));
    $('#tlFiltry').addEventListener('click', popupObraz);
    $('#tlSrovnat').addEventListener('click', e => {
      if (!stav.srovnani) { prepniSrovnani(); return; }
      popupU(e.currentTarget, `<b>Srovnání dvou snímků</b>
        <p class="male tlumeny" style="margin:6px 0">Aktivní plocha je orámovaná; náhledy a šipky mění její snímek.</p>
        <label class="prep"><input type="checkbox" id="srSync" ${stav.sync ? 'checked' : ''}> Synchronizovat přiblížení a posun</label>
        <div class="predvolby"><button class="btn" id="srProhodit">⇄ Prohodit</button><button class="btn" id="srKonec">Ukončit srovnání</button></div>`, d => {
        d.querySelector('#srSync').addEventListener('change', ev => { stav.sync = ev.target.checked; ulozStav(); if (stav.sync) plochy[1 - aktivni].nastavRelativni(plochy[aktivni].relativni()); });
        d.querySelector('#srProhodit').addEventListener('click', () => { snimkyPloch.reverse(); stav.snimek = snimkyPloch[0]; stav.druhy = snimkyPloch[1]; nactiDoPlochy(0); nactiDoPlochy(1); poAktivaci(); ulozStav(); });
        d.querySelector('#srKonec').addEventListener('click', prepniSrovnani);
      });
    });
    $('#tlZalozka').addEventListener('click', () => prepniZalozku());
    $('#tlOdkaz').addEventListener('click', () => {
      const u = odkazNaStranku();
      (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => Dialog.info('Odkaz zkopírován'), () => Dialog.zeptej('Odkaz na stránku', u));
    });
    $('#tlNahledy').addEventListener('click', () => prepniNahledy());
    $('#tlPanel').addEventListener('click', () => prepniPanel());
    $('#vratNahledy').addEventListener('click', () => prepniNahledy(true));
    $('#vratPanel').addEventListener('click', () => prepniPanel(true));
    $('#panelTaby').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { stav.tab = b.dataset.tab; ulozStav(); kresliPanel(); } });
    $('#panelVolby').addEventListener('change', async e => {
      if (e.target.id === 'pvZobrazeni') { stav.zobrazeni = e.target.value; ulozStav(); kresliPanel(); }
      if (e.target.id === 'pvPorovnat') {
        stav.porovnat = e.target.value;
        ulozStav();
        if (stav.porovnat) { try { await nactiPrepis(stav.porovnat); } catch (er) { Dialog.chyba(er.message); } }
        kresliPanel();
      }
    });
    let zvTimer = null;
    $('#panelVolby').addEventListener('input', e => {
      if (e.target.id !== 'pvZvyraznit') return;
      clearTimeout(zvTimer);
      const v = e.target.value.trim();
      zvTimer = setTimeout(() => {
        nastavZvyrazneni(v, /[*?]/.test(v) ? 'vzor' : 'slovo');
        const el = $('#pvZvyraznit');
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      }, 350);
    });
    $('#panelObsah').addEventListener('click', e => {
      const w = e.target.closest('.w');
      if (w && w.dataset.w) { vyberSlovo(w.dataset.w); return; }
      const a = e.target.closest('[data-slovo]');
      if (a) { e.preventDefault(); vyberSlovo(a.dataset.slovo); return; }
      const lok = e.target.closest('a[data-lok]');
      if (lok) { e.preventDefault(); otevriStranku(lok.dataset.str, lok.dataset.lok); return; }
      const akce = e.target.closest('[data-akce]');
      if (!akce) return;
      if (akce.dataset.akce === 'zavritSlovo') { vybraneSlovo = ''; kresliPanel(); }
      if (akce.dataset.akce === 'hledatSlovo' && window.Voynich.hledej) { prepniRezim('hledani'); window.Voynich.hledej(vybraneSlovo, 'slovo'); }
      if (akce.dataset.akce === 'zvyraznitSlovo') nastavZvyrazneni(vybraneSlovo, 'slovo');
    });
    $('#volbaPrepisu').innerHTML = PREPISY.map(p => `<option value="${p.kod}">${esc(p.nazev)}</option>`).join('');
    $('#volbaPrepisu').value = stav.prepis;
    $('#volbaPrepisu').addEventListener('change', e => zmenPrepis(e.target.value));
    $('#tlVolby').addEventListener('click', e => {
      popupU(e.currentTarget, `<b>Výklad přepisu</b>
        <p class="male tlumeny" style="margin:6px 0 8px">Platí pro zobrazení, hledání i statistiky.</p>
        <label class="prep"><input type="checkbox" id="vbMezery" ${stav.volby.nejisteMezery ? 'checked' : ''}> Nejisté mezery „,“ brát jako mezery mezi slovy</label><br>
        <label class="prep" style="margin-top:6px">Nejisté čtení [a:b]: <select id="vbAlt"><option value="prvni">první (nejpravděpodobnější) varianta</option><option value="druha">druhá varianta</option></select></label>`, d => {
        d.querySelector('#vbAlt').value = stav.volby.alternativy;
        d.addEventListener('change', () => {
          stav.volby.nejisteMezery = d.querySelector('#vbMezery').checked;
          stav.volby.alternativy = d.querySelector('#vbAlt').value;
          zmenaDat();
        });
      });
    });
    document.addEventListener('keydown', klavesy);
    window.addEventListener('hashchange', () => {
      if (ctiHash() !== 'stranka') return;
      aktivni = 0;
      prepniRezim('prohlizec', true);
      nactiDoPlochy(0);
      poAktivaci();
    });
  }
  async function zmenPrepis(kod) {
    try { await nactiPrepis(kod); } catch (er) { Dialog.chyba(er.message); $('#volbaPrepisu').value = stav.prepis; return; }
    stav.prepis = kod;
    if (stav.porovnat === kod) stav.porovnat = '';
    zmenaDat();
  }
  function zmenaDat() {
    _zasahy = null; _frekKlic = '';
    if (stav.zvyrazni) nastavZvyrazneni(stav.zvyrazni, stav.zvyrazniRezim); else kresliPanel();
    ulozStav();
    Object.values(rezimy).forEach(r => r.zmenaDat && r.zmenaDat());
    if (rezimy[stav.rezim] && rezimy[stav.rezim].ukaz) rezimy[stav.rezim].ukaz();
  }
  function prepniNahledy(zap) {
    stav.nahledy = zap == null ? !stav.nahledy : zap;
    pouzijRozlozeni();
    if (!stav.nahledy) Dialog.info('Náhledy skryty – vrátíte je ouškem „Náhledy“ u okraje snímku, tlačítkem ▤ nebo klávesou N.');
  }
  function prepniPanel(zap) {
    stav.panel = zap == null ? !stav.panel : zap;
    pouzijRozlozeni();
    if (!stav.panel) Dialog.info('Panel s přepisem skryt – vrátíte ho ouškem „Přepis“ u okraje snímku, tlačítkem ◨ nebo klávesou P.');
  }
  function pouzijRozlozeni() {
    const m = $('#m-prohlizec');
    m.classList.toggle('bez-nahledu', !stav.nahledy);
    m.classList.toggle('bez-panelu', !stav.panel);
    $('#tlNahledy').classList.toggle('zap', stav.nahledy);
    $('#tlPanel').classList.toggle('zap', stav.panel);
    $('#vratNahledy').classList.toggle('skryto', stav.nahledy);
    $('#vratPanel').classList.toggle('skryto', stav.panel);
    ulozStav();
    if (stav.nahledy) posunNahledy();
  }
  function klavesy(e) {
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') { zavriPopup(); return; }
    if (stav.rezim !== 'prohlizec') return;
    const p = plochy[aktivni];
    const k = e.key;
    let hotovo = true;
    if (k === 'ArrowLeft' || k === 'PageUp') jdiNa(aktivniSnimek() - 1);
    else if (k === 'ArrowRight' || k === 'PageDown') jdiNa(aktivniSnimek() + 1);
    else if (k === 'Home') jdiNa(0);
    else if (k === 'End') jdiNa(SNIMKY.length - 1);
    else if (k === '+' || k === '=' || e.code === 'NumpadAdd') p.zoomKolem(1.4);
    else if (k === '-' || e.code === 'NumpadSubtract' || e.code === 'Minus') p.zoomKolem(1 / 1.4);
    else if (e.code === 'Digit0' || e.code === 'Numpad0') p.prizpusob('cele');
    else if (e.code === 'Digit1' || e.code === 'Numpad1') p.prizpusob('1:1');
    else if (k === 'w' || k === 'W') p.prizpusob('sirka');
    else if (k === 'r' || k === 'R') p.otoc(e.shiftKey ? -90 : 90);
    else if (k === 'f' || k === 'F') popupObraz();
    else if (k === 's' || k === 'S') prepniSrovnani();
    else if (k === 'n' || k === 'N') prepniNahledy();
    else if (k === 'p' || k === 'P') prepniPanel();
    else if (k === 'b' || k === 'B') prepniZalozku();
    else if (k === '/') { $('#vstupFolio').focus(); $('#vstupFolio').select(); }
    else if (k === 'ArrowUp') p.posun(0, 80);
    else if (k === 'ArrowDown') p.posun(0, -80);
    else hotovo = false;
    if (hotovo) e.preventDefault();
  }

  // ---------- start ----------
  window.Voynich = {
    stav, J, G, esc, SN, SNIMKY, PREPISY, snimekStranky, rezimy,
    nactiPrepis, korpus, prepis, precteno, frekvence, kwicHtml,
    jdiNa, otevriStranku, prepniRezim, nastavZvyrazneni, vyberSlovo, popisSnimku, kratkyPopis, urlNahledu, urlSnimku, urlOriginalu,
    poznamky: () => poznamky, nastavPoznamky: p => { poznamky = p; ulozPoznamky(); oznacNahledy(); },
    zalozky: () => zalozky, nastavZalozky: z => { zalozky = z; ulozZalozky(); oznacNahledy(); },
    ulozStav, zapisHash, cti, pis,
    _test: { plochy, aktivniSnimek, najdiFolio, snimkyPloch }
  };

  document.addEventListener('DOMContentLoaded', async () => {
    if (window.self === window.top) document.body.classList.add('samostatne');
    G.zapniTipy();
    try { await nactiPrepis('zl'); } catch (e) { Dialog.chyba('Přepis se nenačetl: ' + e.message); }
    if (stav.prepis !== 'zl') { try { await nactiPrepis(stav.prepis); } catch (_) { stav.prepis = 'zl'; } }
    if (stav.porovnat) { try { await nactiPrepis(stav.porovnat); } catch (_) { stav.porovnat = ''; } }
    if (stav.zvyrazni) { try { zvyrDotaz = J.sestavDotaz(stav.zvyrazni, stav.zvyrazniRezim || 'slovo'); } catch (_) { stav.zvyrazni = ''; } }
    snimkyPloch[0] = Math.max(0, Math.min(SNIMKY.length - 1, stav.snimek | 0));
    snimkyPloch[1] = Math.max(0, Math.min(SNIMKY.length - 1, stav.druhy | 0));
    napojOvladani();
    kresliNahledy();
    pouzijRozlozeni();
    Object.values(rezimy).forEach(r => r.init && r.init());
    ctiHash();
    vytvorPlochy();
    prepniRezim(stav.rezim, true);
    zapisHash();
    window.__voynichPripraven = true;
  });
})();
