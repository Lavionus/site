/* Leonardův zápisník – rozhraní: prohlížeč Codexu Atlanticus, texty s překladem, témata, poznámky.
 * Plocha s lupou je sdílená s Voynichovým rukopisem (voynich/prohlizec.js). */
(function () {
  'use strict';
  const J = window.LeoJadro;
  const DATA = window.LEO_LISTY, LISTY = DATA.listy;
  const TX = window.LEO_TEXTY, URYVKY = TX.uryvky;
  const NA_LISTU = J.uryvkyNaListech(URYVKY);
  // Richter 1883 – anglické úryvky z listů CA, které Solmi nemá
  const NA_RICHTER = {};
  (window.LEO_RICHTER || []).forEach(r => r.ca.forEach(i => { (NA_RICHTER[i] = NA_RICHTER[i] || []).push(r); }));
  const SLAVNE = new Set((window.LEO_SLAVNE || []).map(x => x.i));
  const CESTA = 'leonardo/';
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const KLIC_STAV = 'webapp_leonardo_stav', KLIC_POZN = 'webapp_leonardo_poznamky', KLIC_ZAL = 'webapp_leonardo_zalozky';
  const cti = (k, v) => { try { const x = localStorage.getItem(k); return x ? JSON.parse(x) : v; } catch (_) { return v; } };
  const pis = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* plné úložiště */ } };

  const vychozi = {
    list: 653, rezim: 'prohlizec', jazyk: 'obe', tab: 'text', nahledy: true, panel: true,
    zrcadlo: false, materie: '', jenText: false, obraz: { jas: 100, kontrast: 100, sepie: 0, negativ: false },
    textyOddil: '', textyDotaz: ''
  };
  // uložená data mohou být z jiné verze nebo poškozená – nic z nich nesmí stránku shodit
  const objekt = v => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  const platnyList = i => Number.isInteger(i) && i >= 0 && i < LISTY.length;
  const ulozeny = objekt(cti(KLIC_STAV, {}));
  const stav = Object.assign({}, vychozi, ulozeny, { obraz: Object.assign({}, vychozi.obraz, objekt(ulozeny.obraz)) });
  if (!platnyList(stav.list)) stav.list = vychozi.list;
  if (!['obe', 'cs', 'it'].includes(stav.jazyk)) stav.jazyk = vychozi.jazyk;
  if (!['text', 'list', 'poznamka'].includes(stav.tab)) stav.tab = vychozi.tab;
  if (stav.materie && !DATA.materie[stav.materie]) stav.materie = '';
  let casovac = null;
  const ulozStav = () => { clearTimeout(casovac); casovac = setTimeout(() => pis(KLIC_STAV, stav), 250); };
  // klíčem je pořadí strany (1r = 0, 1v = 1 …), pevně dané číslováním listů
  const poznamky = objekt(cti(KLIC_POZN, {}));
  Object.keys(poznamky).forEach(k => { if (!platnyList(+k) || typeof poznamky[k] !== 'string') delete poznamky[k]; });
  let zalozky = cti(KLIC_ZAL, []);
  zalozky = Array.isArray(zalozky) ? zalozky.filter(platnyList) : [];

  // texty skládané z proměnných a texty uvnitř úryvků (data-i18n="ne") se překládají tady
  const T = (s, p) => (window.I18N && I18N.t ? I18N.t(s, p) : s.replace(/\{(\w+)\}/g, (_, k) => p[k]));
  const popisListu = i => 'f. ' + J.popis(LISTY[i]);
  const stareCislo = l => (l.h || []).map(J.kratkeStare).join(', ');

  // ---------- režimy a adresa ----------
  const rezimy = {};
  function prepniRezim(r, bezHash) {
    if (!document.getElementById('m-' + r)) r = 'prohlizec';
    stav.rezim = r;
    document.querySelectorAll('#rezimy button').forEach(b => b.classList.toggle('zap', b.dataset.rezim === r));
    document.querySelectorAll('section.rezim').forEach(s => s.classList.toggle('zap', s.id === 'm-' + r));
    if (rezimy[r]) rezimy[r]();
    if (r === 'prohlizec' && plocha.prizpusobeno) plocha.prizpusob(plocha.prizpusobeno);
    if (!bezHash) zapisHash(true);
    ulozStav();
  }
  // novyZaznam: přepnutí režimu a skok z textu jdou do historie (Zpět funguje), listování po stranách ne
  function zapisHash(novyZaznam) {
    const h = stav.rezim === 'prohlizec' ? '#' + J.souborListu(LISTY[stav.list]).replace(/^0+/, '') : '#' + stav.rezim;
    if (location.hash !== h) history[novyZaznam ? 'pushState' : 'replaceState'](null, '', h);
  }
  // vrací 'list', 'rezim' nebo false
  function ctiHash() {
    let h = '';
    try { h = decodeURIComponent(location.hash.slice(1)); } catch (_) { return false; }   // poškozené %xx
    if (!h) return false;
    if (document.getElementById('m-' + h)) { prepniRezim(h, true); return 'rezim'; }
    const i = J.najdiList(LISTY, h);
    if (i >= 0) { jdiNa(i, true); prepniRezim('prohlizec', true); return 'list'; }
    return false;
  }
  document.querySelectorAll('#rezimy button').forEach(b => b.addEventListener('click', () => prepniRezim(b.dataset.rezim)));
  window.addEventListener('hashchange', ctiHash);

  // ---------- plocha ----------
  const plocha = new window.VoynichPlocha($('#plocha'), {
    naZmenu: p => { $('#zoomHodnota').textContent = Math.round(p.s / p.meritkoCelku() * 100) + ' %'; }
  });
  function nastavObraz() {
    const o = stav.obraz;
    plocha.filtr(`brightness(${o.jas}%) contrast(${o.kontrast}%) sepia(${o.sepie}%)${o.negativ ? ' invert(1)' : ''}`);
    $('#tlFiltry').classList.toggle('zap', o.jas !== 100 || o.kontrast !== 100 || o.sepie !== 0 || o.negativ);
  }
  function nastavZrcadlo() {
    plocha.zrcadli(stav.zrcadlo);
    $('#tlZrcadlo').classList.toggle('zap', stav.zrcadlo);
    $('#tlZrcadlo').setAttribute('aria-pressed', stav.zrcadlo);
  }

  function jdiNa(i, bezHash) {
    i = Math.max(0, Math.min(LISTY.length - 1, i));
    stav.list = i;
    const l = LISTY[i];
    const pocet = (NA_LISTU[i] || []).length;
    plocha.nastav({
      url: J.urlSnimku(DATA, l, CESTA), nahled: J.urlNahledu(DATA, l, CESTA), w: l.w || 1000, h: l.h_px || 1000,
      popis: popisListu(i) + (l.h ? ' · ' + T('dříve {l}', { l: stareCislo(l) }) : '') + (l.rok ? ' · ' + l.rok : '') + (pocet ? ' · 📜 ' + pocet : '')
    });
    $('#vstupFolio').value = J.popis(l).replace(' ', '');
    $('#poradi').textContent = (i + 1) + ' / ' + LISTY.length;
    $('#odkazCommons').href = J.stranaCommons(l);
    $('#tlZalozka').textContent = zalozky.includes(i) ? '★' : '☆';
    $('#tlZalozka').setAttribute('aria-pressed', zalozky.includes(i));
    oznacNahled();
    kresliPanel();
    if (window.Leonardo && Leonardo.poPrechodu) Leonardo.poPrechodu(i);
    if (!bezHash) zapisHash();
    ulozStav();
  }

  // ---------- náhledy ----------
  function vyhovujeFiltru(i) {
    const l = LISTY[i];
    if (stav.jenText && !NA_LISTU[i] && !NA_RICHTER[i]) return false;
    if (stav.materie && !(l.t || []).some(t => t[0] === stav.materie)) return false;
    return true;
  }
  function nahledHtml(i, popisek) {
    const l = LISTY[i];
    const zn = (SLAVNE.has(i) ? `<i title="${esc(T('Slavný list – v prohlídce'))}">⭐</i>` : '') + (NA_LISTU[i] ? `<i title="${esc(T('Je zde text s překladem'))}">📜</i>` : NA_RICHTER[i] ? `<i title="${esc(T('Anglický překlad (Richter 1883)'))}">EN</i>` : '') + (zalozky.includes(i) ? '<i>★</i>' : '') + (poznamky[i] ? '<i>📝</i>' : '');
    return `<button class="nahled" data-i="${i}" title="${esc(popisListu(i) + (l.h ? ' (' + T('dříve {l}', { l: stareCislo(l) }) + ')' : ''))}"><img loading="lazy" src="${esc(J.urlNahledu(DATA, l, CESTA))}" alt=""><span>${esc(popisek || J.popis(l))}</span><b class="znacky">${zn}</b></button>`;
  }
  function kresliNahledy() {
    let html = '', blok = -1, n = 0;
    LISTY.forEach((l, i) => {
      if (!vyhovujeFiltru(i)) return;
      const b = Math.floor((l.n - 1) / 100);
      if (b !== blok) { html += `<div class="sekce-nadpis">${esc(T('Listy {b}–{b2}', { b: b * 100 + 1, b2: Math.min(1119, b * 100 + 100) }))}</div>`; blok = b; }
      html += nahledHtml(i);
      n++;
    });
    $('#nahledy').innerHTML = html || `<p class="tlumeny male">${esc(T('Filtru nic neodpovídá.'))}</p>`;
    oznacNahled(true);
    return n;
  }
  // jedna změna (záložka, poznámka) nemusí překreslovat 2238 náhledů
  function obnovNahled(i) {
    const b = document.querySelector(`#nahledy .nahled[data-i="${i}"]`);
    if (!b) return;
    b.outerHTML = nahledHtml(i);
    oznacNahled(false);
  }
  function oznacNahled(posun) {
    const el = $('#nahledy');
    el.querySelectorAll('.nahled.zap').forEach(b => b.classList.remove('zap'));
    const b = el.querySelector(`.nahled[data-i="${stav.list}"]`);
    if (b) {
      b.classList.add('zap');
      if (posun !== false) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('.nahled[data-i]');   // náhledy jiných kodexů mají vlastní obsluhu
    if (!b) return;
    jdiNa(+b.dataset.i);
    if (stav.rezim !== 'prohlizec') prepniRezim('prohlizec');
  });
  const selMat = $('#filtrMaterie');
  selMat.innerHTML = '<option value="">všechny obory</option>' + Object.entries(DATA.materie).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
  selMat.value = stav.materie;
  $('#filtrText').checked = stav.jenText;
  selMat.addEventListener('change', () => { stav.materie = selMat.value; kresliNahledy(); ulozStav(); });
  $('#filtrText').addEventListener('change', e => { stav.jenText = e.target.checked; kresliNahledy(); ulozStav(); });

  // posun na další/předchozí stranu – respektuje filtr náhledů
  function krok(d) {
    let i = stav.list;
    for (let k = 0; k < LISTY.length; k++) {
      i += d;
      if (i < 0 || i >= LISTY.length) return;
      if (vyhovujeFiltru(i)) { jdiNa(i); return; }
    }
  }

  // ---------- panel ----------
  function uryvekHtml(u, volby) {
    volby = volby || {};
    const jaz = stav.jazyk, dotaz = volby.dotaz || '';
    const z = t => J.zvyrazni(esc(t), dotaz);
    const oddil = T(TX.oddily[u.o] || u.o);
    const nazev = jaz === 'it' ? u.ni : (u.nc || u.ni);
    let ref = '';
    if (u.ref) {
      const ruk = T(TX.rukopisy[u.ref.s] || u.ref.s);
      ref = `<span class="stitek-m${u.ca.length ? ' ca' : ''}" ${u.ca.length ? `data-skok="${u.ca[0]}"` : ''} title="${esc(ruk + (u.ref.z ? ' – ' + T('Solmi uvádí odkaz společně pro celou skupinu úryvků') : ''))}">${esc(u.ref.raw.replace(/\.$/, ''))}${u.ref.z ? ' ≈' : ''}</span>`;
      if (u.rr) ref += `<span class="stitek-m${u.ca.length ? ' ca' : ''}" ${u.ca.length ? `data-skok="${u.ca[0]}"` : ''} title="${esc(T('Rukopis a list podle Richtera'))}">→ ${esc(u.rr)}</span>`;
    }
    let telo = '';
    const cs = u.cs.length ? u.cs : null;
    if (jaz === 'obe' && cs) {
      telo = u.it.map((p, k) => `<div class="dvojice"><p class="odst it" lang="it">${z(p)}</p><p class="odst">${z(cs[k])}</p></div>`).join('');
    } else if (jaz === 'cs' && cs) {
      telo = cs.map(p => `<p class="odst">${z(p)}</p>`).join('');
    } else {
      telo = u.it.map(p => `<p class="odst it" lang="it">${z(p)}</p>`).join('');
      if (jaz !== 'it' && !cs) telo = `<p class="upozorneni">${esc(T('Překlad tohoto úryvku zatím chybí.'))}</p>` + telo;
    }
    let pozn = '';
    if (volby.naListu && u.ca.length > 1) {
      pozn = `<p class="upozorneni">${T('Solmi uvádí starý list {s}; ten se dnes dělí na strany {i}. Úryvek je na jedné z nich.', {
        s: esc(u.ref.raw.replace(/^C\.\s*A\.\s*/, '').replace(/\.$/, '')), i: u.ca.map(i => `<a href="#" data-skok="${i}">${esc(J.popis(LISTY[i]))}</a>`).join(', ') })}</p>`;
    }
    if (volby.mimoProhlizec && u.ca.length) {
      pozn = `<p class="upozorneni">Codex Atlanticus: ${u.ca.map(i => `<a href="#" data-skok="${i}">f. ${esc(J.popis(LISTY[i]))}</a>`).join(', ')}</p>`;
    }
    return `<article class="uryvek" id="u-${u.id}" data-i18n="ne"><div class="uryvek-hlava"><b>${esc(nazev.charAt(0).toUpperCase() + nazev.slice(1))}</b><span class="stitek-m">${esc(oddil)} ${esc(u.c)}</span>${ref}</div>${pozn}${telo}</article>`;
  }

  function kresliPanel() {
    document.querySelectorAll('#panelTaby button').forEach(b => b.classList.toggle('zap', b.dataset.tab === stav.tab));
    const i = stav.list, l = LISTY[i], el = $('#panelObsah');
    if (stav.tab === 'text') {
      const u = NA_LISTU[i] || [], r = NA_RICHTER[i] || [];
      const rich = r.length ? `<h3>${esc(T('Richter 1883 – anglický překlad'))}</h3><p class="upozorneni">${esc(T('Úryvky, které Solmi nevybral; Richterův odkaz na starý list, proto někdy víc kandidátních stran.'))}</p>` +
        r.map(x => `<article class="uryvek" data-i18n="ne" lang="en"><div class="uryvek-hlava"><b>Richter ${esc(x.c)}</b><span class="stitek-m">${esc(x.ref)}</span></div>${x.en.map(p => `<p class="odst">${esc(p)}</p>`).join('')}</article>`).join('') : '';
      el.innerHTML = u.length || r.length ? u.map(x => uryvekHtml(x, { naListu: true })).join('') + rich
        : `<p class="tlumeny">K této straně zatím nemáme přepsaný text.</p>
           <p class="male tlumeny">Přepis s překladem má ${Object.keys(NA_LISTU).length} stran Codexu Atlanticus – zapněte vlevo „jen s textem“, nebo projděte všech ${URYVKY.length} úryvků v režimu <a href="#texty">📖 Texty</a>.</p>
           <p class="male tlumeny">Tip: Leonardo psal levou rukou zprava doleva – tlačítko 🪞 Zrcadlo převrátí stranu, aby se písmo dalo číst.</p>`;
    } else if (stav.tab === 'list') {
      const temata = (l.t || []).map(([m, t, pod]) => `<div class="tema-radek">${esc(T(DATA.materie[m] || m))} › <b>${esc(T(DATA.temata[t] || ''))}</b>${pod ? ` <span class="pod" lang="it">(${esc(pod)})</span>` : ''}</div>`).join('');
      el.innerHTML = `<table class="meta">
          <tr><th>Nové číslo</th><td>f. ${esc(J.popis(l))}${l.m && l.m.length > 1 ? ` <span class="tlumeny">(části ${esc(l.m.join(', '))})</span>` : ''}</td></tr>
          <tr><th>Dříve (Hoepli)</th><td>${l.h ? esc(stareCislo(l)) : '<span class="tlumeny">–</span>'}</td></tr>
          <tr><th>Antické číslo</th><td>${l.st ? esc(l.st.join(', ')) : '<span class="tlumeny">–</span>'}</td></tr>
          <tr><th>Datace</th><td>${l.rok ? esc(l.rok) + ` <span class="tlumeny">${esc(T('(přibližně, podle Ambrosiany)'))}</span>` : '<span class="tlumeny">neuvedena</span>'}</td></tr>
          <tr><th>Snímek</th><td><a href="${esc(J.stranaCommons(l))}" target="_blank" rel="noopener">Wikimedia Commons</a> · volné dílo</td></tr>
        </table>
        <h3>Co je na straně</h3>${temata || '<p class="tlumeny male">Témata této strany nejsou v katalogu uvedena.</p>'}
        <p class="male tlumeny">„Nové číslo“ je číslování po restaurování v letech 1962–1972 (1119 listů). „Dříve“ je číslo z vydání Hoepli/Piumati, které používá i Solmi; jeden starý list se často rozpadl na několik nových.</p>`;
    } else {
      el.innerHTML = `<p class="male tlumeny">Poznámka k f. ${esc(J.popis(l))} – zůstává jen v tomto prohlížeči.</p><textarea class="poznamka" id="poleP" placeholder="Co na straně vidíte, co jste přečetli…">${esc(poznamky[i] || '')}</textarea>`;
      $('#poleP').addEventListener('input', e => {
        const v = e.target.value;
        const mela = !!poznamky[i];
        if (v.trim()) poznamky[i] = v; else delete poznamky[i];
        pis(KLIC_POZN, poznamky);
        if (mela !== !!poznamky[i]) obnovNahled(i);
      });
    }
  }
  document.querySelectorAll('#panelTaby button').forEach(b => b.addEventListener('click', () => { stav.tab = b.dataset.tab; kresliPanel(); ulozStav(); }));
  document.addEventListener('click', e => {
    const s = e.target.closest('[data-skok]');
    if (!s) return;
    e.preventDefault();
    jdiNa(+s.dataset.skok, true);
    if (stav.rezim !== 'prohlizec') prepniRezim('prohlizec'); else zapisHash(true);
  });

  // ---------- nástroje ----------
  function prepniNahledy(v) {
    stav.nahledy = v;
    $('#tlNahledy').setAttribute('aria-pressed', v);
    $('#m-prohlizec').classList.toggle('bez-nahledu', !v);
    $('#vratNahledy').classList.toggle('skryto', v);
    ulozStav();
  }
  function prepniPanel(v) {
    stav.panel = v;
    $('#tlPanel').setAttribute('aria-pressed', v);
    $('#m-prohlizec').classList.toggle('bez-panelu', !v);
    $('#vratPanel').classList.toggle('skryto', v);
    ulozStav();
  }
  $('#tlNahledy').onclick = () => prepniNahledy(!stav.nahledy);
  $('#vratNahledy').onclick = () => prepniNahledy(true);
  $('#tlPanel').onclick = () => prepniPanel(!stav.panel);
  $('#vratPanel').onclick = () => prepniPanel(true);
  $('#tlPredchozi').onclick = () => krok(-1);
  $('#tlNahodny').onclick = () => {
    const kandidati = LISTY.map((_, i) => i).filter(vyhovujeFiltru);
    if (kandidati.length) jdiNa(kandidati[Math.floor(Math.random() * kandidati.length)]);
  };
  $('#tlDalsi').onclick = () => krok(1);
  $('#tlPriblizit').onclick = () => plocha.zoomKolem(1.4);
  $('#tlOddalit').onclick = () => plocha.zoomKolem(1 / 1.4);
  $('#tlCele').onclick = () => plocha.prizpusob('cele');
  $('#tlOtocit').onclick = () => plocha.otoc(90);
  $('#tlZrcadlo').onclick = () => { stav.zrcadlo = !stav.zrcadlo; nastavZrcadlo(); ulozStav(); };
  $('#tlZalozka').onclick = () => {
    const i = stav.list, k = zalozky.indexOf(i);
    if (k >= 0) zalozky.splice(k, 1); else zalozky.push(i);
    pis(KLIC_ZAL, zalozky);
    $('#tlZalozka').textContent = zalozky.includes(i) ? '★' : '☆';
    $('#tlZalozka').setAttribute('aria-pressed', zalozky.includes(i));
    obnovNahled(i);
  };
  $('#tlOdkaz').onclick = async () => {
    const url = location.href.split('#')[0] + '#' + J.souborListu(LISTY[stav.list]).replace(/^0+/, '');
    try { await navigator.clipboard.writeText(url); Dialog.info('Odkaz zkopírován:\n' + url); }
    catch (_) { Dialog.info(url); }
  };
  $('#vstupFolio').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const i = J.najdiList(LISTY, e.target.value);
    if (i >= 0) jdiNa(i);
    else Dialog.chyba('List „' + e.target.value + '“ nenalezen. Zadejte nové číslo (např. 327v) nebo staré se „s“ (s119v).');
  });

  // filtry obrazu
  let okno = null;
  $('#tlFiltry').onclick = e => {
    if (okno) { okno.remove(); okno = null; return; }
    okno = document.createElement('div');
    okno.className = 'vyskakovaci';
    const r = e.currentTarget.getBoundingClientRect();
    okno.style.left = Math.max(8, Math.min(innerWidth - 290, r.left)) + 'px';
    okno.style.top = (r.bottom + 6) + 'px';
    okno.style.position = 'fixed';
    const o = stav.obraz;
    const rad = (k, nazev, min, max) => `<div class="radek"><span>${nazev}</span><input type="range" min="${min}" max="${max}" value="${o[k]}" data-k="${k}"><output>${o[k]}</output></div>`;
    okno.innerHTML = rad('jas', 'Jas', 40, 200) + rad('kontrast', 'Kontrast', 50, 300) + rad('sepie', 'Sépie', 0, 100) +
      `<label class="prep"><input type="checkbox" data-k="negativ" ${o.negativ ? 'checked' : ''}> negativ (inkoust světle)</label>
       <div style="margin-top:8px;display:flex;gap:6px"><button class="btn" data-predvolba="inkoust">Zvýraznit inkoust</button><button class="btn" data-predvolba="nula">Původní</button></div>`;
    document.body.appendChild(okno);
    okno.addEventListener('input', ev => {
      const k = ev.target.dataset.k;
      if (!k) return;
      o[k] = ev.target.type === 'checkbox' ? ev.target.checked : +ev.target.value;
      if (ev.target.nextElementSibling) ev.target.nextElementSibling.textContent = o[k];
      nastavObraz(); ulozStav();
    });
    okno.addEventListener('click', ev => {
      const p = ev.target.dataset.predvolba;
      if (!p) return;
      Object.assign(o, p === 'inkoust' ? { jas: 110, kontrast: 190, sepie: 0, negativ: false } : vychozi.obraz);
      nastavObraz(); ulozStav();
      okno.remove(); okno = null; $('#tlFiltry').click();
    });
  };
  document.addEventListener('pointerdown', e => {
    if (okno && !okno.contains(e.target) && e.target.id !== 'tlFiltry') { okno.remove(); okno = null; }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && okno) { okno.remove(); okno = null; $('#tlFiltry').focus(); }
  });

  // klávesy
  document.addEventListener('keydown', e => {
    if (stav.rezim !== 'prohlizec' || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && t.closest && t.closest('input, textarea, select')) return;
    const akce = {
      ArrowLeft: () => krok(-1), PageUp: () => krok(-1), ArrowRight: () => krok(1), PageDown: () => krok(1),
      '+': () => plocha.zoomKolem(1.4), '=': () => plocha.zoomKolem(1.4), '-': () => plocha.zoomKolem(1 / 1.4),
      '0': () => plocha.prizpusob('cele'), r: () => plocha.otoc(90), m: () => $('#tlZrcadlo').click(),
      f: () => $('#tlFiltry').click(), b: () => $('#tlZalozka').click(), n: () => prepniNahledy(!stav.nahledy),
      p: () => prepniPanel(!stav.panel), '?': () => $('#tlNahodny').click()
    }[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (akce) { e.preventDefault(); akce(); }
  });

  // jazyk textů
  const selJ = $('#volbaJazyka');
  selJ.value = stav.jazyk;
  selJ.addEventListener('change', () => {
    stav.jazyk = selJ.value; ulozStav();
    kresliPanel();
    if (stav.rezim === 'texty' || stav.rezim === 'proroctvi') rezimy[stav.rezim]();
  });

  // ---------- režim Texty ----------
  let textyPostaveno = false;
  rezimy.texty = function () {
    const el = $('#obsahTexty');
    if (!textyPostaveno) {
      const oddily = [...new Set(URYVKY.map(u => u.o))];
      el.innerHTML = `<div class="filtry"><input type="search" id="hledatText" placeholder="Hledat v textech (česky i italsky, bez diakritiky; „fráze“)" value="${esc(stav.textyDotaz)}">
        <div class="cipy" id="cipyOddilu"><button class="cip" data-o="">vše</button>${oddily.map(o => `<button class="cip" data-o="${esc(o)}">${esc(TX.oddily[o] || o)}</button>`).join('')}</div>
        <span class="male tlumeny" id="pocetTextu"></span></div><div id="seznamTextu"></div>`;
      let t = null;
      $('#hledatText').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { stav.textyDotaz = e.target.value; ulozStav(); kresliTexty(); }, 200); });
      $('#cipyOddilu').addEventListener('click', e => {
        const b = e.target.closest('.cip');
        if (!b) return;
        stav.textyOddil = b.dataset.o; ulozStav(); kresliTexty();
      });
      textyPostaveno = true;
    }
    kresliTexty();
  };
  function kresliTexty() {
    document.querySelectorAll('#cipyOddilu .cip').forEach(b => b.classList.toggle('zap', b.dataset.o === stav.textyOddil));
    const nalez = J.hledej(URYVKY, stav.textyDotaz, stav.jazyk, stav.textyOddil);
    $('#pocetTextu').textContent = nalez.length + ' z ' + URYVKY.length + ' úryvků';
    let html = '', posl = '';
    const limit = 250;
    nalez.slice(0, limit).forEach(u => {
      if (u.o !== posl) { html += `<h2 class="oddil-nadpis">${esc(TX.oddily[u.o] || u.o)}</h2>`; posl = u.o; }
      html += uryvekHtml(u, { dotaz: stav.textyDotaz, mimoProhlizec: true });
    });
    if (nalez.length > limit) html += `<p class="tlumeny">… a dalších ${nalez.length - limit} úryvků – upřesněte hledání nebo vyberte oddíl.</p>`;
    $('#seznamTextu').innerHTML = html || '<p class="tlumeny">Nic nenalezeno.</p>';
  }

  // ---------- režim Témata a roky ----------
  // kde Leonardo žil (přibližně; přechody mezi obdobími se překrývají o rok)
  const OBDOBI = [
    { od: 1469, do: 1481, nazev: 'Florencie', popis: 'učení u Verrocchia, první samostatné zakázky' },
    { od: 1482, do: 1499, nazev: 'Milán', popis: 've službách Ludovica Sforzy – jezdecká socha, Poslední večeře, technické studie' },
    { od: 1500, do: 1506, nazev: 'Florencie', popis: 'po pádu Sforzů přes Mantovu a Benátky zpět do Florencie; Mona Lisa, Anghiarská bitva, ve službách Cesara Borgii (1502–1503)' },
    { od: 1507, do: 1513, nazev: 'Milán', popis: 'u francouzských místodržících; anatomie, geologie, vodní stavby' },
    { od: 1514, do: 1516, nazev: 'Řím', popis: 'pod ochranou Giuliana de’ Medici; zrcadla, geometrie' },
    { od: 1517, do: 1519, nazev: 'Francie', popis: 'Amboise u krále Františka I.; zemřel 2. května 1519' }
  ];
  let vyberTemat = null;
  rezimy.temata = function () {
    const el = $('#obsahTemata');
    const mat = J.souhrnTemat(LISTY), roky = J.souhrnRoku(LISTY);
    const rr = Object.keys(roky).map(Number).sort((a, b) => a - b);
    const od = rr[0], doR = rr[rr.length - 1], max = Math.max(...rr.map(r => roky[r].length));
    let graf = '';
    for (let r = od; r <= doR; r++) {
      const n = (roky[r] || []).length;
      graf += `<button data-rok="${r}" style="height:${Math.max(n ? 3 : 0, n / max * 100)}%" title="${r}: ${n} stran" aria-label="${r}: ${n} stran" ${n ? '' : 'disabled'}></button>`;
    }
    const karty = Object.entries(DATA.materie).filter(([k]) => mat[k]).map(([k, v]) => {
      const tem = Object.entries(mat[k].temata).sort((a, b) => b[1].size - a[1].size);
      return `<div class="karta"><h3><span>${esc(v)}</span><span class="tlumeny male">${mat[k].listy.size} stran</span></h3>
        <div class="cipy">${tem.map(([t, s]) => `<button class="cip" data-mat="${k}" data-tema="${t}">${esc(DATA.temata[t] || t)} <span class="tlumeny">${s.size}</span></button>`).join('')}</div></div>`;
    }).join('');
    el.innerHTML = `<h2>Kdy Leonardo psal</h2>
      <p class="male tlumeny">Počet stran Codexu Atlanticus podle přibližné datace (katalog Ambrosiany). Klikněte na rok.</p>
      <div class="graf-roky" id="grafRoky">${graf}</div>
      <div class="obdobi" id="obdobi">${OBDOBI.filter(o => o.do >= od && o.od <= doR).map(o => {
        const a = Math.max(o.od, od), b = Math.min(o.do, doR);
        return `<button data-od="${a}" data-do="${b}" style="flex:${b - a + 1}" title="${esc(T(o.nazev) + ' ' + o.od + '–' + o.do + ': ' + T(o.popis))}">${esc(T(o.nazev))}</button>`;
      }).join('')}</div>
      <div class="graf-popis"><span>${od}</span><span>${Math.round((od + doR) / 2)}</span><span>${doR}</span></div>
      <p class="male tlumeny">Pruh pod grafem: kde Leonardo žil (klikněte na období).</p>
      <h2>Témata</h2><p class="male tlumeny">Obory a témata podle katalogu Ambrosiany; číslo je počet stran. Jedna strana často řeší víc věcí najednou.</p>
      <div class="materie">${karty}</div>
      <div id="vyberTemat"></div>`;
    $('#obdobi').addEventListener('click', e => {
      const b = e.target.closest('button[data-od]');
      if (!b) return;
      const sez = [];
      for (let r = +b.dataset.od; r <= +b.dataset.do; r++) sez.push(...(roky[r] || []));
      vyberTemat = { nadpis: b.textContent + ' ' + b.dataset.od + '–' + b.dataset.do, listy: sez };
      kresliVyber();
    });
    $('#grafRoky').addEventListener('click', e => {
      const b = e.target.closest('button[data-rok]');
      if (!b) return;
      vyberTemat = { nadpis: T('Rok {rok}', { rok: b.dataset.rok }), listy: roky[b.dataset.rok] };
      kresliVyber();
    });
    el.querySelector('.materie').addEventListener('click', e => {
      const b = e.target.closest('.cip');
      if (!b) return;
      vyberTemat = { nadpis: T(DATA.materie[b.dataset.mat]) + ' › ' + T(DATA.temata[b.dataset.tema]), listy: [...mat[b.dataset.mat].temata[b.dataset.tema]], tema: +b.dataset.tema };
      kresliVyber();
    });
    if (vyberTemat) kresliVyber(true);
  };
  function kresliVyber(bezPosunu) {
    const v = vyberTemat, el = $('#vyberTemat');
    el.innerHTML = `<h2>${esc(v.nadpis)} <span class="tlumeny male">${v.listy.length} stran</span></h2><div class="mrizka-listu">${v.listy.map(i => {
      const pod = v.tema ? (LISTY[i].t || []).filter(t => t[1] === v.tema).map(t => t[2]).filter(Boolean).join(', ') : LISTY[i].rok;
      return nahledHtml(i, J.popis(LISTY[i]) + (pod ? ' · ' + pod : ''));
    }).join('')}</div>`;
    if (!bezPosunu) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- režim Poznámky ----------
  rezimy.poznamky = function () {
    const el = $('#obsahPoznamky');
    const pz = Object.keys(poznamky).map(Number).sort((a, b) => a - b);
    el.innerHTML = `<h2>Záložky</h2>${zalozky.length ? `<div class="mrizka-listu">${zalozky.slice().sort((a, b) => a - b).map(i => nahledHtml(i)).join('')}</div>` : '<p class="tlumeny">Zatím žádné – v prohlížeči tlačítko ☆ nebo klávesa B.</p>'}
      <h2>Poznámky</h2>${pz.length ? pz.map(i => `<div class="karta"><b><a href="#" data-skok="${i}">f. ${esc(J.popis(LISTY[i]))}</a></b><p style="white-space:pre-wrap;margin:6px 0 0">${esc(poznamky[i])}</p></div>`).join('') : '<p class="tlumeny">Zatím žádné – v prohlížeči panel „Poznámka“.</p>'}
      <p class="male tlumeny">Poznámky a záložky se ukládají jen v tomto prohlížeči (localStorage).</p>`;
  };

  // ---------- režim O zápisnících ----------
  rezimy.info = function () {
    const ca = Object.keys(NA_LISTU).length;
    $('#obsahInfo').innerHTML = `
      <h2>Codex Atlanticus</h2>
      <p>Největší sbírka Leonardových papírů: 1119 listů z let zhruba 1478–1519 – stroje, létání, voda, geometrie, opevnění, astronomie, bajky i nákupní seznamy. Po Leonardově smrti listy zdědil žák Francesco Melzi, sochař Pompeo Leoni je koncem 16. století rozstříhal a nalepil do obřího alba (odtud „atlantický“ – formát atlasu). Dnes je v Biblioteca Ambrosiana v Miláně. Při restaurování v letech 1962–1972 byly listy vyňaty z alba a znovu očíslovány, proto má každý list „nové“ a „staré“ číslo.</p>
      <h2>Kodex o letu ptáků</h2>
      <p>Malý sešit z let 1505–1506 (18 listů), dnes v Turíně: jak ptáci využívají vítr, jak udržet rovnováhu a jak by mohl létat člověk se strojem. V režimu 🐦 Let ptáků jsou všechny strany s italským textem a překladem.</p>
      <h2>Zrcadlové písmo</h2>
      <p>Leonardo byl levák a psal zprava doleva, se zrcadlově obrácenými písmeny. Tlačítko 🪞 Zrcadlo (klávesa M) stranu převrátí – písmo pak běží zleva doprava jako obyčejná italská kurzíva té doby. Pomůže i 🎚️ Obraz → „Zvýraznit inkoust“.</p>
      <h2>Texty a překlad</h2>
      <p>${URYVKY.length} úryvků vybral a uspořádal Edmondo Solmi v knize <i>Frammenti letterari e filosofici</i> (Florencie 1900): bajky, bestiář, myšlenky o vědě, přírodě a malířství, proroctví a žerty. Italský text je převzat z přepisu na Wikisource, český překlad vznikl pro tuto stránku z italského originálu. Solmi u úryvků uvádí rukopis a list; u ${ca} stran Codexu Atlanticus je proto text přímo u snímku. Ostatní úryvky pocházejí z pařížských rukopisů (A–M), z Codexu Trivulzianus, z Windsoru a z Pojednání o malířství – v režimu 📖 Texty je u nich uvedený zdroj.</p>
      <p class="male tlumeny">Solmi používá staré číslování Codexu Atlanticus. Starý list se často skládal z několika kusů, které mají dnes samostatná čísla – stránka pak ukazuje všechny kandidáty. U několika skupin úryvků uvádí Solmi jediný odkaz pro celou skupinu (značka ≈).</p>
      <h2>Ovládání</h2>
      <div class="zkratky">
        <div><kbd>←</kbd> <kbd>→</kbd> předchozí / další strana</div><div><kbd>+</kbd> <kbd>−</kbd> přiblížit / oddálit, <kbd>0</kbd> celá strana</div>
        <div><kbd>M</kbd> zrcadlo</div><div><kbd>R</kbd> otočit o 90°</div><div><kbd>F</kbd> jas a kontrast</div><div><kbd>B</kbd> záložka</div>
        <div><kbd>N</kbd> náhledy, <kbd>P</kbd> panel s textem</div><div>kolečko myši / dva prsty: lupa, dvojklik: přiblížit</div>
        <div>do pole listu: <code>327v</code> = nové číslo, <code>s119v</code> = staré číslo</div>
      </div>
      <h2>Zdroje a licence</h2>
      <ul class="male">
        <li>Snímky: Biblioteca Ambrosiana přes <a href="https://commons.wikimedia.org/wiki/Category:Codex_Atlanticus_(codex-atlanticus.it)" target="_blank" rel="noopener">Wikimedia Commons</a> – volné dílo (PD-Art). Strany s textem jsou uložené na tomto webu, ostatní se načítají přímo z Commons.</li>
        <li>Převod starého a nového číslování: <a href="https://teche.museogalileo.it/leonardo/" target="_blank" rel="noopener">leonardo//thek@</a>, Museo Galileo, Florencie.</li>
        <li>Datace a témata stran: <a href="https://codex-atlanticus.ambrosiana.it/" target="_blank" rel="noopener">Codex Atlanticus – Biblioteca Ambrosiana</a> (The Visual Agency); české názvy témat přeložené pro tuto stránku.</li>
        <li>Italský text: E. Solmi (ed.), <i>Frammenti letterari e filosofici</i>, Barbèra, Firenze 1900 – volné dílo; přepis <a href="https://it.wikisource.org/wiki/Frammenti_letterari_e_filosofici" target="_blank" rel="noopener">it.wikisource.org</a> (CC BY-SA).</li>
        <li>Český překlad: vlastní, pro tuto stránku (strojově asistovaný, bez odborné redakce – berte ho jako pomůcku ke čtení originálu).</li>
        <li>Kodex o letu ptáků (Biblioteca Reale, Turín): snímky z Wikimedia Commons (PD-Art); italský text podle vydání Sabachnikoff – Piumati – Ravaisson-Mollien, Paříž 1893 (volné dílo, <a href="https://archive.org/details/IManoscrittiDiLeonardoDaVinci" target="_blank" rel="noopener">archive.org</a>); překlad a shrnutí vlastní.</li>
        <li>Anglické úryvky a Richterova čísla: J. P. Richter, <i>The Literary Works of Leonardo da Vinci</i>, Londýn 1883 (volné dílo; text <a href="https://www.gutenberg.org/ebooks/5000" target="_blank" rel="noopener">Project Gutenberg</a>, odkazy na listy z OCR na archive.org – místy nejisté).</li>
        <li>Popisy slavných listů a životní období: vlastní texty pro tuto stránku.</li>
      </ul>`;
  };

  // ---------- start ----------
  prepniNahledy(stav.nahledy);
  prepniPanel(stav.panel);
  kresliNahledy();
  nastavObraz();
  nastavZrcadlo();
  const zHashe = ctiHash();
  if (zHashe !== 'list') jdiNa(stav.list, true);   // jinak by se načetly dva snímky
  if (!zHashe) prepniRezim(stav.rezim, true);
  zapisHash();
  Object.assign(window.Leonardo = window.Leonardo || {}, {
    stav, jdiNa, prepniRezim, LISTY, URYVKY, NA_LISTU, NA_RICHTER, DATA, TX, J, esc, T, rezimy, ulozStav, nahledHtml, uryvekHtml, kresliPanel, $
  });
})();
