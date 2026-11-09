/* Společná čtečka knih (UI nad KRONIKY_JADRO) – jedna pro všechna díla (Kroniky vyhnanství, povídky…).
   Dílo popisuje window.CTECKA_DILO, které nastaví stránka díla (vygenerovaná tools/knihy_export.py):
   {id, nazev, ikona, data (složka s knihy.json, relativně k obsah/), stranka, klic, serie?, soubor?}.
   localStorage: <klic> (nastavení, pozice, pokrok, čas čtení), <klic>_poznamky (záložky, zvýraznění,
   cizi = načtené poznámky betačtenářů). Kroniky mají kvůli starším uloženým datům klic webapp_kroniky. */
(async () => {
  'use strict';
  const J = window.KRONIKY_JADRO;
  const $ = id => document.getElementById(id);
  const DILO = window.CTECKA_DILO;   // nastavení díla ze stránky díla (tools/knihy_export.py)
  const KLIC = DILO.klic, KLIC_P = DILO.klic + '_poznamky';
  const SOUBOR = DILO.soubor || J.normalizuj(DILO.nazev).replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
  const plocha = $('plocha'), text = $('text');
  if (window.top === window) document.body.classList.add('samostatne');

  /* ---------- uložená data ---------- */
  const VYCHOZI_NAST = { motiv: 'web', pismo: 'patkove', velikost: 1, radkovani: 1.7, sirkaPct: 90, blok: true, knizni: false, obrazky: true, nezhasinat: false, strankovani: false, bublina: 'dole', wpm: 220, tts: 1, hlas: '' };
  const cti = k => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } };
  let stav = cti(KLIC);
  // starší verze čtečky ukládala jen {kniha, kapitola, velikost}
  if (typeof stav.kapitola === 'number') stav = { kniha: stav.kniha, staraKapitola: stav.kapitola, nast: { velikost: stav.velikost } };
  stav = { kniha: 0, pozice: {}, precteno: {}, cas: 0, dny: {}, panel: null, ...stav };
  stav.nast = { ...VYCHOZI_NAST, ...stav.nast };
  let data = { zalozky: [], zvyrazneni: [], cizi: [], ...cti(KLIC_P) };
  const nast = () => stav.nast;
  let casUlozeni = 0;
  function ulozStav(hned) {
    clearTimeout(casUlozeni);
    const zapis = () => { try { localStorage.setItem(KLIC, JSON.stringify(stav)); } catch (e) {} };
    if (hned) zapis(); else casUlozeni = setTimeout(zapis, 400);
  }
  const ulozData = () => { try { localStorage.setItem(KLIC_P, JSON.stringify(data)); } catch (e) { Dialog.chyba('Poznámky se nepodařilo uložit (plné úložiště prohlížeče).'); } };
  const noveId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ---------- knihy a kapitoly ---------- */
  // knihy.json vždy čerstvý (?t – obejde i CDN GitHub Pages); kapitoly a obrázky s otiskem obsahu (?h).
  // DILO.zdroj = knihy nahrané uživatelem (ctecka_knih.html): {knihy(), kapitola(kniha, soubor), obrazek(kniha, src)}
  const ZDROJ = DILO.zdroj;
  // Po probuzení tabletu bývá síť pár sekund pryč – první pokus selže a kapitola by zůstala prázdná.
  // Proto několik pokusů s rostoucí pauzou (a další pokus, jakmile je prohlížeč zase online).
  async function sOpakovanim(fn, pokusu = 4) {
    for (let i = 0; ; i++) {
      try { return await fn(); }
      catch (e) {
        if (i >= pokusu - 1) throw e;
        await new Promise(ok => { const t = setTimeout(ok, 700 * (i + 1)); addEventListener('online', () => { clearTimeout(t); ok(); }, { once: true }); });
      }
    }
  }
  const stahniText = url => sOpakovanim(async () => {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const t = await r.text();
    if (!t.trim()) throw new Error('prázdná odpověď');
    return t;
  });
  // až bude zase síť (událost online) nebo se tablet probudí (návrat do karty), zkusit to samo znovu
  function znovuAz(fn) {
    const zkus = () => {
      if (document.visibilityState !== 'visible') return;
      removeEventListener('online', zkus); document.removeEventListener('visibilitychange', zkus);
      fn();
    };
    addEventListener('online', zkus); document.addEventListener('visibilitychange', zkus);
  }
  let knihy;
  try { knihy = ZDROJ ? await ZDROJ.knihy() : JSON.parse(await stahniText(DILO.data + 'knihy.json?t=' + Date.now())); }
  catch (e) {
    // bez seznamu kapitol čtečka nemůže nic – místo prázdné stránky hláška a nové načtení
    text.innerHTML = `<p class="nenacteno">Knihu se nepodařilo načíst – asi chvíli chybí připojení.</p><p><button class="tl" id="znovuNacist">↻ Zkusit znovu</button></p>`;
    $('znovuNacist').onclick = () => location.reload();
    znovuAz(() => location.reload());
    return;
  }
  const sOtiskem = (k, src) => { if (ZDROJ) return ZDROJ.obrazek(k, src); const h = k.otisky && k.otisky[src]; return `${DILO.data}${k.id}/${src}` + (h ? '?h=' + h : ''); };
  knihy.forEach(k => { k.slov = k.kapitoly.reduce((s, c) => s + c.slov, 0); });
  const mezipamet = new Map();
  function nactiKapitolu(kniha, soubor) {
    const c = kniha.kapitoly.find(x => x.soubor === soubor), h = c && c.h ? '?h=' + c.h : '';
    const klic = kniha.id + '/' + soubor + h;
    if (!mezipamet.has(klic)) {
      mezipamet.set(klic, (ZDROJ ? Promise.resolve(ZDROJ.kapitola(kniha, soubor)) : stahniText(DILO.data + klic)).then(md => ({ md, bloky: J.rozeber(md) })).catch(e => { mezipamet.delete(klic); throw e; }));
    }
    return mezipamet.get(klic);
  }
  const nactiKnihu = kniha => Promise.all(kniha.kapitoly.map(c => nactiKapitolu(kniha, c.soubor)));
  const knihaPodleId = id => knihy.find(k => k.id === id);
  const indexKap = (kniha, soubor) => kniha.kapitoly.findIndex(c => c.soubor === soubor);

  let kniha = null, kapIdx = 0, bloky = [], kum = [];   // kum[i] = slova před blokem i
  const kap = () => kniha.kapitoly[kapIdx];

  /* ---------- nastavení vzhledu ---------- */
  const PISMA = {
    patkove: 'Georgia, "Times New Roman", serif',
    bezpatkove: 'system-ui, "Segoe UI", Roboto, sans-serif',
    sirsi: 'Verdana, "DejaVu Sans", sans-serif',
  };
  // barevné motivy „rodina-stupeň“ (sepie-2…) se dopočítávají v jádru; pevné motivy (papir, sepie, noc) jsou v CSS
  const PROMENNE_MOTIVU = Object.keys(J.barvyMotivu('seda', 1).promenne);
  const rozlozMotiv = m => { const x = /^([a-z]+)-([1-5])$/.exec(m || ''); return x && J.barvyMotivu(x[1], +x[2]); };
  $('motivyBarvy').innerHTML = J.RODINY_MOTIVU.map(r => `<div class="motiv-radek"><span class="motiv-nazev">${r.nazev}</span>${J.STUPNE_MOTIVU.map((st, i) => {
    const m = J.barvyMotivu(r.id, i + 1).promenne;
    return `<button class="vzorek" data-prikaz="motiv-${r.id}-${i + 1}" title="Motiv: ${r.nazev}, ${st.nazev}" aria-label="Motiv: ${r.nazev}, ${st.nazev}" style="background:${m['--bg']};color:${m['--text']};border-color:${m['--border-strong']}">Aa</button>`;
  }).join('')}</div>`).join('');
  function pouzijNastaveni() {
    const n = nast(), s = document.body.style;
    const blok = aktualniBlok();
    const barvy = rozlozMotiv(n.motiv);
    document.body.dataset.motiv = barvy ? 'barevny' : n.motiv;
    document.body.classList.toggle('motiv-tmavy', !!(barvy && barvy.tmavy));
    PROMENNE_MOTIVU.forEach(v => barvy ? s.setProperty(v, barvy.promenne[v]) : s.removeProperty(v));
    s.setProperty('--velikost', n.velikost);
    s.setProperty('--radkovani', n.radkovani);
    s.setProperty('--sirka', n.sirkaPct + '%');
    s.setProperty('--pismo', PISMA[n.pismo] || PISMA.patkove);
    text.classList.toggle('blok', n.blok);
    text.classList.toggle('knizni', n.knizni);
    text.classList.toggle('bez-obrazku', !n.obrazky);
    document.body.classList.toggle('strankovani', !!n.strankovani);
    aktualizujZamek();
    $('rVelikost').value = n.velikost; $('oVelikost').value = Math.round(n.velikost * 100) + ' %';
    $('rRadkovani').value = n.radkovani; $('oRadkovani').value = n.radkovani.toFixed(1);
    $('rSirka').value = n.sirkaPct; $('oSirka').value = n.sirkaPct + ' %';
    document.querySelectorAll('#nabZobrazeni .vzorek').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.prikaz === 'motiv-' + n.motiv)));
    document.querySelectorAll('#nabZobrazeni .prep').forEach(b => {
      const [co, hodnota] = b.dataset.prikaz.split('-');
      b.setAttribute('aria-pressed', String(co === 'motiv' ? n.motiv === hodnota : co === 'pismo' ? n.pismo === hodnota : co === 'bublina' ? n.bublina === hodnota : !!n[co]));
    });
    if (bloky.length) skocNaBlok(blok, false);
    ulozStav();
  }
  const nastav = zmena => { Object.assign(stav.nast, zmena); pouzijNastaveni(); };
  [['rVelikost', 'velikost'], ['rRadkovani', 'radkovani'], ['rSirka', 'sirkaPct']].forEach(([id, klic]) =>
    $(id).addEventListener('input', e => nastav({ [klic]: +e.target.value })));

  /* ---------- vykreslení kapitoly ---------- */
  const htmlBloku = (b, i, knihaId = kniha.id) => b.typ === 'hr' ? `<hr data-i="${i}">`
    : b.typ === 'img' ? `<figure data-i="${i}"><img src="${J.esc(sOtiskem(knihaPodleId(knihaId) || kniha, b.src))}" alt="${J.esc(b.popis)}" loading="lazy" decoding="async">${b.popis ? `<figcaption>${J.esc(b.popis)}</figcaption>` : ''}</figure>`
    : b.typ === 'h' ? `<h1 data-i="${i}">${J.inline(b.md)}</h1>` : `<p data-i="${i}">${J.inline(b.md)}</p>`;
  const prvekBloku = i => text.querySelector(`[data-i="${i}"]`);

  async function otevri(kIdx, cIdx, blok = 0, volby = {}) {
    const nova = knihy[kIdx];
    if (!nova || !nova.kapitoly[cIdx]) return;
    if (!volby.zTts) zastavTts();
    let obsah;
    try { obsah = await nactiKapitolu(nova, nova.kapitoly[cIdx].soubor); }
    catch (e) {
      // nenechat prázdnou stránku: hláška s tlačítkem, a sama se zkusí znovu, až bude síť
      if (!text.children.length || !kniha) {
        text.innerHTML = `<p class="nenacteno">Kapitolu se nepodařilo načíst – asi chvíli chybí připojení.</p><p><button class="tl" id="znovuNacist">↻ Zkusit znovu</button></p>`;
        $('znovuNacist').onclick = () => otevri(kIdx, cIdx, blok, volby);
        znovuAz(() => { if ($('znovuNacist')) otevri(kIdx, cIdx, blok, volby); });
      } else Dialog.chyba('Kapitolu se nepodařilo načíst. Jste offline?');
      return;
    }
    kniha = nova; kapIdx = cIdx; stav.kniha = kIdx;
    bloky = obsah.bloky;
    kum = []; let s = 0;
    bloky.forEach((b, i) => { kum[i] = s; s += J.slov(b.text); });
    text.innerHTML = bloky.map((b, i) => htmlBloku(b, i)).join('');
    kotvy = new WeakMap();
    prekresliText();
    zavriVyber();
    $('zahlavi').textContent = `${kniha.nazev} · ${kniha.podtitul}`;
    $('tlKniha').title = `${kniha.nazev} – výběr knihy a pokrok čtení`;
    $('nabKnihaNazev').textContent = kniha.nazev;
    const prvni = cIdx === 0 && kIdx === 0, posledni = cIdx === kniha.kapitoly.length - 1 && kIdx === knihy.length - 1;
    ['tlPred', 'dolePred'].forEach(id => { $(id).disabled = prvni; });
    ['tlDalsi', 'doleDalsi'].forEach(id => { $(id).disabled = posledni; });
    $('doleDalsi').textContent = cIdx === kniha.kapitoly.length - 1 && !posledni ? `${knihy[kIdx + 1].nazev} ▶` : 'Další ▶';
    document.title = `${kap().nazev} – ${kniha.nazev} – ${DILO.nazev}`;
    skocNaBlok(blok, false);
    poScrollu();
    if (stav.panel) vykresliPanel();
  }

  function skocNaBlok(i, plynule = true) {
    const el = prvekBloku(i);
    const cil = el && i > 0 ? Math.max(0, el.offsetTop - 14) : 0;
    plocha.scrollTo({ top: cil, behavior: plynule ? 'smooth' : 'auto' });
  }

  // první blok, jehož spodek je pod horní hranou plochy
  function aktualniBlok() {
    const prvky = text.children, hrana = plocha.scrollTop + 16;
    let lo = 0, hi = prvky.length - 1, vysl = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1, el = prvky[mid];
      if (el.offsetTop + el.offsetHeight > hrana) { vysl = mid; hi = mid - 1; } else lo = mid + 1;
    }
    return prvky[vysl] ? +prvky[vysl].dataset.i : 0;
  }

  const slovPred = (k, c) => k.kapitoly.slice(0, c).reduce((s, x) => s + x.slov, 0);
  const pokrokKnihy = k => {
    const p = stav.pozice[k.id];
    if (!p) return 0;
    const c = indexKap(k, p.soubor);
    return c < 0 ? 0 : (slovPred(k, c) + (p.slov || 0)) / k.slov;
  };

  // Přečteno = slova před blokem nahoře na obrazovce. Na konci kapitoly je přečtená i poslední
  // obrazovka – jinak by po dočtení zůstávalo „zbývá ~2 min“ / 97 %.
  const naKonciKapitoly = () => plocha.scrollTop + plocha.clientHeight >= plocha.scrollHeight - 40;
  const prectenoSlov = () => naKonciKapitoly() ? kap().slov : (kum[aktualniBlok()] || 0);
  const zbyvaText = slov => slov <= 0 ? 'dočteno' : `zbývá ~${J.formatCas(slov / nast().wpm)}`;

  let ramec = 0;
  function poScrollu() {
    ramec = 0;
    if (!kniha) return;
    const i = aktualniBlok(), slovZde = prectenoSlov();
    stav.pozice[kniha.id] = { soubor: kap().soubor, blok: i, slov: slovZde };
    zapamatujMisto(i);
    if (naKonciKapitoly()) {
      (stav.precteno[kniha.id] = stav.precteno[kniha.id] || {})[kap().soubor] = true;
    }
    const podil = (slovPred(kniha, kapIdx) + slovZde) / kniha.slov;
    $('prubeh').style.width = (podil * 100).toFixed(2) + '%';
    const zbyvaKap = kap().slov - slovZde, zbyvaKniha = kniha.slov - slovPred(kniha, kapIdx) - slovZde;
    // každý kus ve vlastním <span> – překlad (i18n) pak přeloží každý zvlášť
    $('stavCteni').innerHTML = `<span>Kapitola ${kapIdx + 1} z ${kniha.kapitoly.length}</span> · <span>${zbyvaKap <= 0 ? 'kapitola dočtena' : `do konce kapitoly ~${J.formatCas(zbyvaKap / nast().wpm)}`}</span> · <span>kniha ${Math.floor(podil * 100)} %</span>, <span>${zbyvaText(zbyvaKniha)}</span>`;
    const okno = plocha.getBoundingClientRect();
    const maZalozku = [...text.querySelectorAll('mark.zal-slovo')].some(m => { const r = m.getBoundingClientRect(); return r.bottom > okno.top && r.top < okno.bottom; });
    $('tlZalozka').setAttribute('aria-pressed', String(maZalozku));
    kresliPosuvnik();
    aktualizujMasku();
    ulozStav();
  }
  plocha.addEventListener('scroll', () => { aktivita(); if (!ramec) ramec = requestAnimationFrame(poScrollu); }, { passive: true });

  const posun = smer => {
    let k = stav.kniha, c = kapIdx + smer;
    if (c < 0) { k--; if (k < 0) return; c = knihy[k].kapitoly.length - 1; }
    if (c >= knihy[k].kapitoly.length) { k++; if (k >= knihy.length) return; c = 0; }
    return otevri(k, c);
  };

  async function skok(knihaId, soubor, blok, hledany, zalozkaId) {
    const k = knihy.findIndex(x => x.id === knihaId), c = k < 0 ? -1 : indexKap(knihy[k], soubor);
    if (c < 0) { Dialog.chyba('Toto místo už v knize není.'); return; }
    const pred = mistoCteni();
    if (k !== stav.kniha || c !== kapIdx) await otevri(k, c, blok);
    if (hledany) vyznacBlok(blok, hledany);
    const slovo = zalozkaId && text.querySelector(`mark.zal-slovo[data-zal="${zalozkaId}"]`);
    if (slovo) {
      // slovo záložky do horní třetiny plochy, jeho věta krátce blikne
      const cil = plocha.scrollTop + slovo.getBoundingClientRect().top - plocha.getBoundingClientRect().top - plocha.clientHeight / 3;
      poSkoku(pred, cil);
      plocha.scrollTo({ top: cil, behavior: 'smooth' });
      const veta = text.querySelectorAll(`.zal-veta[data-zal="${zalozkaId}"]`);
      veta.forEach(v => v.classList.add('blik'));
      setTimeout(() => veta.forEach(v => v.classList.remove('blik')), 1800);
    } else {
    const el = prvekBloku(blok);
    if (el) {
      poSkoku(pred, el.offsetTop);
      skocNaBlok(blok);
      el.classList.add('blik');
      setTimeout(() => el.classList.remove('blik'), 1600);
    }
    }
    if (matchMedia('(max-width:760px)').matches) zavriPanel();
  }

  /* ---------- zvýraznění, záložky, nálezy v textu ---------- */
  // obalí znaky od–do (v textContent prvku) do nových prvků, i přes hranice <em>
  function obal(el, od, do_, vytvor) {
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), uzly = [];
    let pos = 0, n;
    while ((n = tw.nextNode())) { uzly.push([n, pos]); pos += n.length; }
    for (const [uzel0, start] of uzly) {
      const a = Math.max(od, start), b = Math.min(do_, start + uzel0.length);
      if (a >= b) continue;
      let uzel = uzel0;
      if (b - start < uzel.length) uzel.splitText(b - start);
      if (a - start > 0) uzel = uzel.splitText(a - start);
      const m = vytvor();
      uzel.parentNode.insertBefore(m, uzel);
      m.appendChild(uzel);
    }
  }

  // text knihy se může po redakci změnit – zvýraznění se dohledá podle citace
  function ukotvi(z) {
    if (bloky[z.blok] && bloky[z.blok].text.slice(z.od, z.do) === z.text) return true;
    for (let i = 0; i < bloky.length; i++) {
      const p = bloky[(z.blok + i) % bloky.length].text.indexOf(z.text);
      if (p >= 0) { z.blok = (z.blok + i) % bloky.length; z.od = p; z.do = p + z.text.length; ulozData(); return true; }
    }
    return false;
  }

  // záložka = slovo + věta; po redakci se dohledá podle věty, pak podle slova; stará záložka na odstavec → první slovo
  function ukotviZalozku(z) {
    const t = bloky[z.blok] && bloky[z.blok].text;
    const nastav = (blok, rozsah) => {
      const txt = bloky[blok].text, v = J.vetaKolem(txt, rozsah.od);
      Object.assign(z, { blok, od: rozsah.od, do: rozsah.do, slovo: txt.slice(rozsah.od, rozsah.do), veta: txt.slice(v.od, v.do), vOd: rozsah.od - v.od });
      ulozData();
      return true;
    };
    if (z.od == null) { const w = t && J.slovoKolem(t, 0); return w ? nastav(z.blok, w) : false; }
    if (t && t.slice(z.od, z.do) === z.slovo) return true;
    for (let k = 0; k < bloky.length; k++) {
      const i = (z.blok + k) % bloky.length, p = z.veta ? bloky[i].text.indexOf(z.veta) : -1;
      if (p >= 0) return nastav(i, { od: p + z.vOd, do: p + z.vOd + z.slovo.length });
    }
    if (t) {
      const slova = [...t.matchAll(new RegExp(z.slovo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))].map(m => m.index);
      if (slova.length) { const p = slova.reduce((a, b) => Math.abs(b - z.od) < Math.abs(a - z.od) ? b : a); return nastav(z.blok, { od: p, do: p + z.slovo.length }); }
      const w = J.slovoKolem(t, 0);
      if (w) return nastav(z.blok, w);
    }
    return false;
  }

  // Dohledání po redakci prochází celou kapitolu – u dlouhé knihy (TXT bez nadpisů = jedna kapitola o tisících
  // odstavců) a značky, jejíž text už v knize není, by to pro každý odstavec trvalo sekundy. Proto se každá
  // značka ukotví jen jednou za otevření kapitoly (otevri vynuluje kotvy).
  let kotvy = new WeakMap();
  const ukotvena = (z, fn) => { if (!kotvy.has(z)) kotvy.set(z, fn(z)); return kotvy.get(z); };
  function znackyKapitoly() {
    const soubor = kap().soubor, zde = z => z.kniha === kniha.id && z.soubor === soubor;
    return {
      zv: data.zvyrazneni.filter(z => zde(z) && ukotvena(z, ukotvi)),
      cizi: data.cizi.filter(c => !c.skryta).flatMap(c => c.zvyrazneni.filter(z => zde(z) && ukotvena(z, ukotvi)).map(z => [c, z])),
      zal: data.zalozky.filter(z => zde(z) && ukotvena(z, ukotviZalozku)),
    };
  }
  function vyznacBlok(i, hledany) {
    const el = prvekBloku(i), b = bloky[i];
    if (!el || !b || (b.typ !== 'p' && b.typ !== 'h')) return;
    el.innerHTML = J.inline(b.md);
    const zn = znackyKapitoly();
    zn.zv.filter(z => z.blok === i)
      .sort((a, b) => a.od - b.od)
      .forEach(z => obal(el, z.od, z.do, () => {
        const m = document.createElement('mark');
        m.className = 'zv' + (z.poznamka ? ' ma-pozn' : '');
        m.dataset.id = z.id; m.dataset.barva = z.barva;
        if (z.poznamka) m.title = z.poznamka;
        return m;
      }));
    zn.cizi.filter(([, z]) => z.blok === i)
      .forEach(([c, z]) => obal(el, z.od, z.do, () => {
        const m = Object.assign(document.createElement('mark'), { className: 'zv cizi', title: `👤 ${c.jmeno || 'čtenář'}` + (z.poznamka ? ': ' + z.poznamka : '') });
        m.dataset.cizi = c.id; m.dataset.id = z.id;
        return m;
      }));
    zn.zal.filter(z => z.blok === i)
      .forEach(z => {
        const v = J.vetaKolem(b.text, z.od);
        obal(el, v.od, v.do, () => { const sp = document.createElement('span'); sp.className = 'zal-veta'; sp.dataset.zal = z.id; return sp; });
        obal(el, z.od, z.do, () => {
          const m = Object.assign(document.createElement('mark'), { className: 'zal-slovo', title: 'Záložka – klepnutím odeberete' });
          m.dataset.zal = z.id;
          return m;
        });
      });
    if (tts.aktivni && i === tts.blok) vyznacVetu(el);
    planujZnacky();
    if (hledany) {
      const t = J.normalizuj(b.text), q = J.normalizuj(hledany);
      const pozice = [];
      for (let p = t.indexOf(q); p >= 0 && q; p = t.indexOf(q, p + q.length)) pozice.push(p);
      pozice.reverse().forEach(p => obal(el, p, p + q.length, () => Object.assign(document.createElement('mark'), { className: 'nalez' })));
    }
  }

  // první slovo na prvním celém řádku nahoře (bez označeného textu)
  function prvniViditelneSlovo() {
    const p = plocha.getBoundingClientRect(), t = text.getBoundingClientRect();
    for (let y = p.top + 20; y < p.top + 260; y += 10) {
      let uzel, off;
      if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(t.left + 2, y); if (r) { uzel = r.startContainer; off = r.startOffset; } }
      else if (document.caretPositionFromPoint) { const r = document.caretPositionFromPoint(t.left + 2, y); if (r) { uzel = r.offsetNode; off = r.offset; } }
      const el = uzel && blokZUzlu(uzel);
      if (!el || !/^(P|H1)$/.test(el.tagName)) continue;
      const i = +el.dataset.i, w = J.slovoKolem(bloky[i].text, offsetV(el, uzel, off));
      if (w) return { blok: i, ...w };
    }
    for (let i = aktualniBlok(); i < bloky.length; i++) { const w = bloky[i].text && J.slovoKolem(bloky[i].text, 0); if (w) return { blok: i, ...w }; }
    return null;
  }

  // záložka na označeném slově (výběr se rozšíří na celá slova), jinak na prvním viditelném slově
  function prepniZalozku() {
    if (!kniha) return;
    const cil = vyber && vyber.rezim === 'novy'
      ? (w => w && { blok: vyber.blok, ...w })(J.slovoKolem(bloky[vyber.blok].text, vyber.od, vyber.do))
      : prvniViditelneSlovo();
    zavriVyber(); getSelection().removeAllRanges();
    if (!cil) { Dialog.info('Tady není slovo, ke kterému by šla záložka připnout.'); return; }
    const soubor = kap().soubor;
    const idx = data.zalozky.findIndex(z => z.kniha === kniha.id && z.soubor === soubor && z.blok === cil.blok && z.od < cil.do && cil.od < z.do);
    if (idx >= 0) { data.zalozky.splice(idx, 1); Dialog.info('Záložka odebrána'); }
    else {
      const t = bloky[cil.blok].text, v = J.vetaKolem(t, cil.od);
      const z = { id: noveId(), kniha: kniha.id, soubor, blok: cil.blok, od: cil.od, do: cil.do,
        slovo: t.slice(cil.od, cil.do), veta: t.slice(v.od, v.do), vOd: cil.od - v.od, cas: Date.now() };
      data.zalozky.push(z);
      Dialog.info(`🔖 Záložka u slova „${z.slovo.length > 40 ? z.slovo.slice(0, 40) + '…' : z.slovo}“`);
    }
    ulozData(); vyznacBlok(cil.blok); poScrollu();
    if (stav.panel === 'zalozky') vykresliPanel();
  }
  async function odeberZalozku(id) {
    const z = data.zalozky.find(x => x.id === id);
    if (!z || !(await Dialog.potvrd(`Odebrat záložku u slova „${z.slovo || ''}“?`))) return;
    data.zalozky = data.zalozky.filter(x => x !== z);
    ulozData();
    if (kniha && z.kniha === kniha.id && z.soubor === kap().soubor) vyznacBlok(z.blok);
    poScrollu();
    if (stav.panel === 'zalozky') vykresliPanel();
  }

  /* ---------- výběr textu → plovoucí lišta ---------- */
  const lista = $('vyber');
  let vyber = null;   // {rezim:'novy', blok, od, do, text} | {rezim:'uprava', id}
  function ukazListu(rect) {
    lista.hidden = false;
    const dolu = matchMedia('(pointer:coarse)').matches || rect.top < 70;
    const top = dolu ? rect.bottom + 10 : rect.top - lista.offsetHeight - 8;
    lista.style.top = Math.max(6, Math.min(innerHeight - lista.offsetHeight - 6, top)) + 'px';
    lista.style.left = Math.max(6, Math.min(innerWidth - lista.offsetWidth - 6, rect.left + rect.width / 2 - lista.offsetWidth / 2)) + 'px';
    lista.querySelector('[data-vyber="smazat"]').hidden = vyber.rezim !== 'uprava';
    lista.querySelector('[data-vyber="zalozka"]').hidden = vyber.rezim !== 'novy';
  }
  function zavriVyber() {
    const docasny = vyber && vyber.dotyk ? vyber.blok : null;
    lista.hidden = true; vyber = null;
    if (docasny !== null && text.querySelector('mark.vyb')) vyznacBlok(docasny);
  }
  const blokZUzlu = u => { const el = (u.nodeType === 3 ? u.parentElement : u).closest('#text [data-i]'); return el; };
  const offsetV = (el, uzel, off) => { const r = document.createRange(); r.setStart(el, 0); r.setEnd(uzel, off); return r.toString().length; };

  let casVyberu = 0;
  document.addEventListener('selectionchange', () => {
    clearTimeout(casVyberu);
    casVyberu = setTimeout(() => {
      const sel = getSelection();
      if (!sel.rangeCount || sel.isCollapsed) { if (vyber && vyber.rezim === 'novy' && !vyber.dotyk) zavriVyber(); return; }
      const r = sel.getRangeAt(0), el = blokZUzlu(r.startContainer);
      if (!el || el !== blokZUzlu(r.endContainer) || !/^(P|H1)$/.test(el.tagName)) { if (vyber && vyber.rezim === 'novy' && !vyber.dotyk) zavriVyber(); return; }
      const od = offsetV(el, r.startContainer, r.startOffset), do_ = offsetV(el, r.endContainer, r.endOffset);
      const i = +el.dataset.i, t = bloky[i].text.slice(od, do_);
      if (!t.trim()) return;
      vyber = { rezim: 'novy', blok: i, od, do: do_, text: t };
      ukazListu(r.getBoundingClientRect());
    }, 180);
  });
  text.addEventListener('click', e => {
    if (Date.now() - dotyk.konec < 700) return;   // „klepnutí“, které prohlížeč pošle po dotykovém výběru
    const zal = e.target.closest('mark.zal-slovo');
    if (zal && getSelection().isCollapsed) { odeberZalozku(zal.dataset.zal); return; }
    const ciz = e.target.closest('mark.cizi');
    if (ciz && getSelection().isCollapsed) { ukazCizi(ciz.dataset.cizi, ciz.dataset.id); return; }
    const m = e.target.closest('mark.zv');
    if (!m || !getSelection().isCollapsed) return;
    vyber = { rezim: 'uprava', id: m.dataset.id };
    ukazListu(m.getBoundingClientRect());
  });
  lista.addEventListener('pointerdown', e => e.preventDefault());   // výběr nezmizí kliknutím do lišty

  /* ---------- výběr prstem (iPad, telefon) ----------
     Nativní výběr textu ukáže na iPadOS systémovou nabídku (Kopírovat, Sdílet…) a stránka ji nemůže skrýt.
     Při dotyku je proto nativní výběr v textu vypnutý (body.dotyk) a výběr dělá čtečka:
     podržet prst = slovo, táhnout bez zvednutí = rozšířit po slovech, zvednout = lišta čtečky. */
  const pozicePodBodem = (x, y) => {
    let uzel, off;
    if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); if (r) { uzel = r.startContainer; off = r.startOffset; } }
    else if (document.caretPositionFromPoint) { const r = document.caretPositionFromPoint(x, y); if (r) { uzel = r.offsetNode; off = r.offset; } }
    const el = uzel && blokZUzlu(uzel);
    return el && /^(P|H1)$/.test(el.tagName) ? { blok: +el.dataset.i, off: offsetV(el, uzel, off) } : null;
  };
  const dotyk = { cas: 0, start: null, kotva: null, rozsah: null, konec: 0 };
  // Odstavec se tu NEpřekresluje (vyznacBlok): prvek pod prstem (třeba <em> kurzívy) musí zůstat v dokumentu,
  // jinak mu prohlížeč pošle touchend už odpojenému a výběr nikdy neskončí (lišta nevyskočí).
  function ukazDotykovyVyber() {
    const { blok, od, do: do_ } = dotyk.rozsah, el = prvekBloku(blok);
    text.querySelectorAll('mark.vyb').forEach(m => m.replaceWith(...m.childNodes));
    el.normalize();
    obal(el, od, do_, () => Object.assign(document.createElement('mark'), { className: 'vyb' }));
  }
  addEventListener('pointerdown', e => document.body.classList.toggle('dotyk', e.pointerType === 'touch'), true);
  text.addEventListener('touchstart', e => {
    clearTimeout(dotyk.cas);
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    dotyk.start = { x: t.clientX, y: t.clientY }; dotyk.kotva = null;
    const zv = e.target.closest && e.target.closest('mark.zv:not(.cizi)');
    dotyk.cas = setTimeout(() => {
      if (zv) {   // podržení na zvýraznění = jeho úprava (barva, poznámka, smazání)
        dotyk.konec = Date.now();
        vyber = { rezim: 'uprava', id: zv.dataset.id };
        ukazListu(zv.getBoundingClientRect());
        return;
      }
      const p = pozicePodBodem(dotyk.start.x, dotyk.start.y), w = p && J.slovoKolem(bloky[p.blok].text, p.off);
      if (!w) return;
      zavriVyber();
      dotyk.kotva = { blok: p.blok, ...w }; dotyk.rozsah = { ...dotyk.kotva };
      ukazDotykovyVyber();
    }, 450);
  }, { passive: true });
  // touchmove/touchend poslouchá dokument: výběr překresluje odstavec, a když prst začal na kurzívě (<em>),
  // prohlížeč posílá další události už odpojenému <em> – k #text by nedobublaly a lišta by nevyskočila
  document.addEventListener('touchmove', e => {
    if (!dotyk.start) return;
    const t = e.touches[0];
    if (!dotyk.kotva) {   // prst se pohnul dřív, než vypršelo podržení → posouvání stránky
      if (dotyk.start && Math.hypot(t.clientX - dotyk.start.x, t.clientY - dotyk.start.y) > 10) clearTimeout(dotyk.cas);
      return;
    }
    e.preventDefault();   // během výběru se stránka neposouvá
    const p = pozicePodBodem(t.clientX, t.clientY), k = dotyk.kotva;
    const w = p && p.blok === k.blok && J.slovoKolem(bloky[k.blok].text, p.off);
    if (!w) return;
    const novy = { blok: k.blok, od: Math.min(k.od, w.od), do: Math.max(k.do, w.do) };
    if (novy.od !== dotyk.rozsah.od || novy.do !== dotyk.rozsah.do) { dotyk.rozsah = novy; ukazDotykovyVyber(); }
  }, { passive: false });
  const konecDotyku = e => {
    clearTimeout(dotyk.cas);
    const zText = dotyk.start; dotyk.start = null;
    if (!dotyk.kotva) { if (zText && Date.now() - dotyk.konec < 700 && e.cancelable) e.preventDefault(); return; }
    if (e.cancelable) e.preventDefault();   // bez následného „kliknutí“, které by lištu hned zavřelo
    const { blok, od, do: do_ } = dotyk.rozsah;
    dotyk.kotva = null; dotyk.konec = Date.now();
    vyber = { rezim: 'novy', blok, od, do: do_, text: bloky[blok].text.slice(od, do_), dotyk: true };
    const znacky = [...text.querySelectorAll('mark.vyb')];
    const r = znacky[0].getBoundingClientRect(), r2 = znacky[znacky.length - 1].getBoundingClientRect();
    ukazListu({ top: r.top, bottom: r2.bottom, left: Math.min(r.left, r2.left), width: Math.max(r.right, r2.right) - Math.min(r.left, r2.left) });
  };
  document.addEventListener('touchend', konecDotyku, { passive: false });
  document.addEventListener('touchcancel', () => { clearTimeout(dotyk.cas); dotyk.start = null; if (dotyk.kotva) { dotyk.kotva = null; vyznacBlok(dotyk.rozsah.blok); } });
  text.addEventListener('contextmenu', e => { if (document.body.classList.contains('dotyk')) e.preventDefault(); });
  lista.addEventListener('click', async e => {
    const tl = e.target.closest('button');
    if (!tl || !vyber) return;
    if (tl.dataset.vyber === 'zalozka') { if (vyber.rezim === 'novy') prepniZalozku(); return; }
    const v = vyber;
    let z = v.rezim === 'uprava' ? data.zvyrazneni.find(x => x.id === v.id) : null;
    const nove = barva => {
      z = { id: noveId(), kniha: kniha.id, soubor: kap().soubor, blok: v.blok, od: v.od, do: v.do, text: v.text, barva, poznamka: '', cas: Date.now() };
      data.zvyrazneni.push(z);
    };
    if (tl.dataset.barva) {
      if (z) z.barva = tl.dataset.barva; else nove(tl.dataset.barva);
    } else if (tl.dataset.vyber === 'poznamka') {
      zavriVyber(); getSelection().removeAllRanges();
      zapamatujMisto();
      const p = await Dialog.zeptej('Poznámka k vybranému textu', z ? z.poznamka : '', { ok: 'Uložit' });
      scrollTo(0, 0);
      if (p === null) return;
      if (!z) nove('zluta');
      z.poznamka = p.trim();
    } else if (tl.dataset.vyber === 'citace') {
      kopiruj(citace(z ? z.text : v.text), 'Citace zkopírována');
    } else if (tl.dataset.vyber === 'slovnik') {
      zavriVyber(); getSelection().removeAllRanges();
      if (v.dotyk) vyznacBlok(v.blok);
      return vyznam(z ? z.text : v.text);
    } else if (tl.dataset.vyber === 'smazat' && z) {
      data.zvyrazneni = data.zvyrazneni.filter(x => x !== z);
    }
    ulozData();
    zavriVyber(); getSelection().removeAllRanges();
    vyznacBlok(z ? z.blok : v.blok);
    if (stav.panel === 'poznamky') vykresliPanel();
  });
  const citace = t => `„${t.trim()}“\n— ${DILO.nazev}, ${kniha.nazev}, ${kap().nazev}`;

  /* ---------- význam slova a překlad (Wikislovník přes jeho API, ostatní odkazem) ---------- */
  // z textu stránky Wikislovníku vytáhnout první oddíl „význam“ (u slov z jiných jazyků jsou významy česky)
  // ohýbaný tvar („genitiv singuláru substantiva hrad“) → zaklad = hrad; ukázkové věty (delší, s tečkou) se vynechají
  function vyznamyZWikislovniku(extract) {
    // oddíly jsou oddělené prázdnými řádky, nadpis oddílu je první řádek („význam\nopevněné sídlo\n…“)
    const oddil = extract.split(/\n{2,}/).map(c => c.trim()).find(c => /^význam\n/i.test(c));
    if (!oddil) return { vyznamy: [], zaklad: '' };
    const radky = oddil.split('\n').slice(1).map(x => x.trim()).filter(Boolean)
      .filter(x => !(/([.…!?“"]|\(…\))$/.test(x) && x.split(/\s+/).length > 2));   // definice tečkou nekončí, ukázkové věty ano
    const tvar = radky.map(x => x.match(/(?:substantiva|adjektiva|slovesa|zájmena|číslovky|příslovce)\s+(\S+)$/)).find(Boolean);
    return { vyznamy: radky.slice(0, 6), zaklad: tvar ? tvar[1] : '' };
  }
  async function hledejWikislovnik(slovo) {
    const url = 'https://cs.wiktionary.org/w/api.php?action=query&prop=extracts&explaintext=1&exsectionformat=plain&redirects=1&format=json&origin=*&titles=' + encodeURIComponent(slovo);
    const strana = Object.values((await (await fetch(url)).json()).query.pages)[0];
    return strana && strana.extract ? vyznamyZWikislovniku(strana.extract) : null;
  }
  async function vyznam(vybrany) {
    const t = vybrany.replace(/\s+/g, ' ').trim().replace(/^[„“"'(]+|[.,;:!?…“"')]+$/g, '');
    if (!t) return;
    const jednoSlovo = !/\s/.test(t) && t.length <= 40;
    const q = encodeURIComponent(t);
    $('slovnikSlovo').textContent = t.length > 60 ? t.slice(0, 60) + '…' : t;
    $('slovnikOdkazy').innerHTML = [
      jednoSlovo && [`https://cs.wiktionary.org/wiki/${encodeURIComponent(t.toLowerCase())}`, '📘 Wikislovník'],
      jednoSlovo && [`https://prirucka.ujc.cas.cz/?slovo=${q}`, '📗 Jazyková příručka'],
      [`https://translate.google.com/?sl=auto&tl=cs&op=translate&text=${q}`, '🌐 Přeložit do češtiny'],
      [`https://translate.google.com/?sl=auto&tl=en&op=translate&text=${q}`, '🌐 Do angličtiny'],
      [`https://cs.wikipedia.org/w/index.php?search=${q}`, '🔎 Wikipedie'],
    ].filter(Boolean).map(([u, n]) => `<a class="tl" href="${J.esc(u)}" target="_blank" rel="noopener">${n}</a>`).join('');
    const vyznamEl = $('slovnikVyznam');
    vyznamEl.innerHTML = jednoSlovo ? '<p class="napoveda">Hledám ve Wikislovníku…</p>' : '';
    otevriModal('slovnik');
    if (!jednoSlovo) return;
    try {
      let v = await hledejWikislovnik(t.toLowerCase()), tvar = '';
      if ((!v || !v.vyznamy.length) && t !== t.toLowerCase()) v = await hledejWikislovnik(t);   // vlastní jména
      if (v && v.zaklad) {   // ohýbaný tvar → význam základního slova
        tvar = `<p class="napoveda">${J.esc(v.vyznamy[0])}</p>`;
        const z = await hledejWikislovnik(v.zaklad);
        if (z && z.vyznamy.length) v = z;
      }
      vyznamEl.innerHTML = v && v.vyznamy.length
        ? tvar + '<ol>' + v.vyznamy.map(x => `<li>${J.esc(x)}</li>`).join('') + '</ol><p class="napoveda">Zdroj: Wikislovník (CC BY-SA)</p>'
        : '<p class="napoveda">Slovo jsem ve Wikislovníku nenašel – zkuste odkazy níže (u ohýbaných tvarů pomůže Jazyková příručka).</p>';
    } catch (e) { vyznamEl.innerHTML = '<p class="napoveda">Wikislovník je teď nedostupný (offline?).</p>'; }
  }
  async function kopiruj(t, hlaska) {
    try { await navigator.clipboard.writeText(t); Dialog.info(hlaska); }
    catch (e) { await Dialog.zeptej('Zkopírujte si text:', t, { ok: 'Hotovo' }); }
  }

  /* ---------- postranní panel ---------- */
  const panel = $('panel'), panelObsah = $('panelObsah');
  function otevriPanel(karta) {
    stav.panel = karta; panel.hidden = false; vykresliPanel(); ulozStav();
  }
  function zavriPanel() { stav.panel = null; panel.hidden = true; $('tlObsah').setAttribute('aria-pressed', 'false'); ulozStav(); }
  const prepniPanel = karta => (stav.panel === karta && !panel.hidden ? zavriPanel() : otevriPanel(karta));
  panel.querySelector('.karty').addEventListener('click', e => { const b = e.target.closest('[data-karta]'); if (b) otevriPanel(b.dataset.karta); });

  const datum = t => new Date(t).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
  const poradi = x => { const k = knihy.findIndex(b => b.id === x.kniha); return [k, indexKap(knihy[k] || knihy[0], x.soubor), x.blok, x.od || 0]; };
  const podlePoradi = (a, b) => { const pa = poradi(a), pb = poradi(b); for (let i = 0; i < 4; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i]; return 0; };
  const nazevKap = x => { const soubor = x.soubor || x.kap, k = knihaPodleId(x.kniha), c = k && k.kapitoly[indexKap(k, soubor)]; return c ? c.nazev : soubor; };
  const skokAttr = (x, hledany, zal) => `data-skok="${x.kniha}|${x.soubor || x.kap}|${x.blok}"${hledany ? ` data-hledany="${J.esc(hledany)}"` : ''}${zal ? ` data-zal="${zal}"` : ''}`;
  // věta záložky s vyznačeným slovem (dlouhé okraje zkrácené)
  const vetaZalozky = (z, f = (pred, slovo, po) => J.esc(pred) + '<b>' + J.esc(slovo) + '</b>' + J.esc(po)) => {
    if (!z.veta) return f(z.ukazka || '', '', '');
    const pred = z.veta.slice(0, z.vOd), po = z.veta.slice(z.vOd + z.slovo.length);
    return f(pred.length > 90 ? '…' + pred.slice(-90) : pred, z.slovo, po.length > 120 ? po.slice(0, 120) + '…' : po);
  };

  let vysledky = null, dotaz = '';
  function vykresliPanel() {
    panel.querySelectorAll('[data-karta]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.karta === stav.panel)));
    $('tlObsah').setAttribute('aria-pressed', String(stav.panel === 'obsah'));
    const e = J.esc;
    let h = '';
    if (stav.panel === 'obsah') {
      knihy.forEach((k, ki) => {
        h += `<h3>${k.obalka ? `<img class="obalka-mini" src="${e(sOtiskem(k, k.obalka))}" alt="">` : ''}${e(k.nazev)} · ${Math.floor(pokrokKnihy(k) * 100)} %</h3>`;
        k.kapitoly.forEach((c, ci) => {
          const precteno = stav.precteno[k.id] && stav.precteno[k.id][c.soubor];
          const akt = kniha && k.id === kniha.id && ci === kapIdx;
          h += `<button class="polozka${akt ? ' aktivni' : ''}" data-kap="${ki}|${ci}"><span class="znak">${precteno ? '✓' : ''}</span><span>${e(c.nazev)}</span><span class="meta">${J.formatCas(c.slov / nast().wpm)}</span></button>`;
        });
      });
    } else if (stav.panel === 'hledani') {
      if (!dotaz) h = '<p class="prazdne">Napište hledaný text do pole 🔍 v liště (aspoň 2 znaky). Hledá se v celém díle bez ohledu na diakritiku a velká písmena.</p>';
      else if (!vysledky) h = '<p class="prazdne">Hledám…</p>';
      else if (!vysledky.length) h = `<p class="prazdne">„${e(dotaz)}“ v knihách není.</p>`;
      else {
        h = `<p class="prazdne">${vysledky.length >= 300 ? 'Prvních 300' : vysledky.length} výskytů „${e(dotaz)}“</p>`;
        let skupina = '';
        vysledky.forEach(v => {
          const s = v.kniha + v.kap;
          if (s !== skupina) { skupina = s; h += `<h3>${e(knihaPodleId(v.kniha).nazev)} – ${e(nazevKap(v))}</h3>`; }
          h += `<button class="polozka vysledek" ${skokAttr(v, dotaz)}><span>${e(v.pred)}<mark class="nalez">${e(v.shoda)}</mark>${e(v.po)}</span></button>`;
        });
      }
    } else if (stav.panel === 'zalozky') {
      const z = [...data.zalozky].sort(podlePoradi);
      h = z.length ? '' : '<p class="prazdne">Zatím žádné záložky. Označte v textu slovo a klepněte na 🔖 (nebo klávesa B). Bez označení se záložka připne na první slovo nahoře na obrazovce.</p>';
      z.forEach(x => {
        h += `<div class="polozka pozn" role="button" tabindex="0" ${skokAttr(x, '', x.id)}><small>🔖 ${e(knihaPodleId(x.kniha)?.nazev || '')} · ${e(nazevKap(x))} · ${datum(x.cas)}</small><span class="veta-zal">${vetaZalozky(x)}</span>
          <span class="panel-akce"><button class="tl" data-smaz-z="${x.id}">✕ Odebrat</button></span></div>`;
      });
    } else if (stav.panel === 'poznamky') {
      const z = [...data.zvyrazneni].sort(podlePoradi);
      h = `<div class="panel-akce"><button class="tl" data-prikaz="odeslat-poznamky">📤 Odeslat autorovi</button><button class="tl" data-prikaz="exp-poznamky">⬇ Markdown</button><button class="tl" data-prikaz="nacist-poznamky">📂 Načíst od čtenáře</button></div>`;
      if (!z.length) h += '<p class="prazdne">Zatím žádné poznámky. Označte v textu pár slov a vyberte barvu nebo 📝.</p>';
      let skupina = '';
      z.forEach(x => {
        const s = x.kniha + x.soubor;
        if (s !== skupina) { skupina = s; h += `<h3>${e(knihaPodleId(x.kniha)?.nazev || '')} – ${e(nazevKap(x))}</h3>`; }
        h += `<div class="polozka pozn" role="button" tabindex="0" ${skokAttr(x)} style="border-left:4px solid var(--zv-${x.barva})"><q>${e(x.text)}</q>${x.poznamka ? `<span class="text-pozn">📝 ${e(x.poznamka)}</span>` : ''}
          <span class="panel-akce"><button class="tl" data-uprav-p="${x.id}">📝 Poznámka</button><button class="tl" data-smaz-p="${x.id}">✕ Smazat</button></span></div>`;
      });
      data.cizi.forEach(c => {
        h += `<h3 class="cizi-hlava">👤 ${e(c.jmeno || 'Čtenář bez jména')} · ${c.zvyrazneni.length} pozn. · ${datum(c.cas)}</h3>
          <div class="panel-akce"><button class="tl" data-cizi-skryj="${c.id}">${c.skryta ? '👁 Zobrazit v textu' : '🙈 Skrýt v textu'}</button><button class="tl" data-cizi-smaz="${c.id}">✕ Odebrat</button></div>`;
        [...c.zvyrazneni].sort(podlePoradi).forEach(x => {
          h += `<div class="polozka pozn cizi" role="button" tabindex="0" data-pozn="${x.id}" ${skokAttr(x)}><small>${e(knihaPodleId(x.kniha)?.nazev || '')} · ${e(nazevKap(x))}</small><q>${e(x.text)}</q>${x.poznamka ? `<span class="text-pozn">📝 ${e(x.poznamka)}</span>` : ''}</div>`;
        });
        [...c.zalozky].sort(podlePoradi).forEach(x => {
          h += `<div class="polozka pozn cizi" role="button" tabindex="0" ${skokAttr(x)}><small>🔖 ${e(knihaPodleId(x.kniha)?.nazev || '')} · ${e(nazevKap(x))}</small><span class="veta-zal">${vetaZalozky(x)}</span></div>`;
        });
      });
    }
    panelObsah.innerHTML = h;
    const akt = panelObsah.querySelector('.aktivni');
    if (akt) akt.scrollIntoView({ block: 'center' });
  }
  document.body.style.cssText += ';--zv-zluta:#ffd54f;--zv-zelena:#81c784;--zv-modra:#64b5f6;--zv-ruzova:#f06292';

  panelObsah.addEventListener('click', async e => {
    const t = e.target.closest('[data-kap],[data-skok],[data-smaz-z],[data-smaz-p],[data-uprav-p],[data-cizi-skryj],[data-cizi-smaz]');
    if (!t) return;
    if (t.dataset.ciziSkryj || t.dataset.ciziSmaz) {
      const c = data.cizi.find(x => x.id === (t.dataset.ciziSkryj || t.dataset.ciziSmaz));
      if (!c) return;
      if (t.dataset.ciziSkryj) c.skryta = !c.skryta;
      else if (await Dialog.potvrd(`Odebrat poznámky čtenáře ${c.jmeno || 'bez jména'}?`)) data.cizi = data.cizi.filter(x => x !== c);
      else return;
      ulozData(); vykresliPanel(); prekresliText();
      return;
    }
    if (t.dataset.smazZ) {
      data.zalozky = data.zalozky.filter(z => z.id !== t.dataset.smazZ);
      ulozData(); vykresliPanel(); if (kniha) { new Set([...text.querySelectorAll('mark.zal-slovo')].map(m => +m.closest('[data-i]').dataset.i)).forEach(vyznacBlok); poScrollu(); }
      return;
    }
    if (t.dataset.smazP || t.dataset.upravP) {
      const z = data.zvyrazneni.find(x => x.id === (t.dataset.smazP || t.dataset.upravP));
      if (!z) return;
      if (t.dataset.smazP) {
        if (z.poznamka && !(await Dialog.potvrd('Smazat zvýraznění i s poznámkou?'))) return;
        data.zvyrazneni = data.zvyrazneni.filter(x => x !== z);
      } else {
        const p = await Dialog.zeptej('Poznámka', z.poznamka, { ok: 'Uložit' });
        if (p === null) return;
        z.poznamka = p.trim();
      }
      ulozData(); vykresliPanel();
      if (kniha && z.kniha === kniha.id && z.soubor === kap().soubor) vyznacBlok(z.blok);
      return;
    }
    if (t.dataset.kap) {
      const [k, c] = t.dataset.kap.split('|').map(Number), pred = mistoCteni();
      await otevri(k, c);
      poSkoku(pred);
      if (matchMedia('(max-width:760px)').matches) zavriPanel();
      return;
    }
    const [k, soubor, blok] = t.dataset.skok.split('|');
    skok(k, soubor, +blok, t.dataset.hledany, t.dataset.zal);
  });
  panelObsah.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[role=button]')) e.target.click(); });

  /* ---------- hledání ---------- */
  let casHledani = 0, cisloHledani = 0;
  $('hledat').addEventListener('input', e => {
    clearTimeout(casHledani);
    casHledani = setTimeout(() => hledej(e.target.value), 250);
  });
  $('hledat').addEventListener('keydown', e => {
    if (e.key === 'Enter') { const prvni = panelObsah.querySelector('.vysledek'); if (prvni) prvni.click(); }
    if (e.key === 'Escape') { e.target.value = ''; hledej(''); e.target.blur(); }
  });
  async function hledej(q) {
    dotaz = q.trim();
    const cislo = ++cisloHledani;
    if (dotaz.length < 2) { vysledky = null; dotaz = ''; if (stav.panel === 'hledani') vykresliPanel(); return; }
    vysledky = null; otevriPanel('hledani');
    try {
      const vse = [];
      for (const k of knihy) {
        const obsahy = await nactiKnihu(k);
        k.kapitoly.forEach((c, i) => vse.push({ kniha: k.id, kap: c.soubor, bloky: obsahy[i].bloky }));
      }
      if (cislo !== cisloHledani) return;
      vysledky = J.hledej(vse, dotaz);
    } catch (e) { vysledky = []; Dialog.chyba('Některé kapitoly se nepodařilo načíst.'); }
    vykresliPanel();
  }

  /* ---------- předčítání ---------- */
  const tts = { aktivni: false, pauza: false, blok: 0, vety: [], vi: 0, gen: 0 };
  const synt = window.speechSynthesis;
  // Piper (ctecka/piper.js, načte se až tady): hlas „piper:<klíč>“, přehrává <audio> – hraje i při zamčené obrazovce
  const zvuk = new Audio();
  let PIPER = null;
  const piperSlib = new Promise(ok => {
    const sk = document.createElement('script');
    sk.src = 'ctecka/piper.js';
    sk.onload = () => { PIPER = window.CTECKA_PIPER; PIPER.lze ? PIPER.zjistiStazene().then(() => ok(PIPER)) : ok(null); };
    sk.onerror = () => ok(null);
    document.head.appendChild(sk);
  });
  const jePiper = () => /^piper:/.test(nast().hlas || '') && PIPER;
  if (!synt) $('tlPredcitat').disabled = true;
  piperSlib.then(p => { if (p) { $('tlPredcitat').disabled = false; naplnHlasy(); } });
  function hlasy() {
    if (!synt) return [];
    const v = synt.getVoices(), cs = v.filter(x => /^cs/i.test(x.lang));
    return cs.length ? cs : v;
  }
  function naplnHlasy() {
    const v = hlasy();
    let h = '<option value="">Výchozí hlas</option>' + v.map(x => `<option value="${J.esc(x.name)}">${J.esc(x.name)} (${x.lang})</option>`).join('');
    if (PIPER && PIPER.lze) h += '<optgroup label="Lepší hlasy – Piper (stáhnou se jednou)">' + PIPER.HLASY.map(x =>
      `<option value="piper:${x.klic}">${x.nazev}${PIPER.stazene.has(x.klic) ? ' ✓' : ` (stáhnout ~${x.mb} MB)`}</option>`).join('') + '</optgroup>';
    $('ttsHlas').innerHTML = h;
    const hodnota = nast().hlas || '';
    $('ttsHlas').value = [...$('ttsHlas').options].some(o => o.value === hodnota) ? hodnota : '';
  }
  if (synt) { naplnHlasy(); synt.addEventListener?.('voiceschanged', naplnHlasy); }
  $('ttsRychlost').value = String(nast().tts);
  $('ttsRychlost').onchange = e => { nast().tts = +e.target.value; ulozStav(); predpripraveno.clear(); if (tts.aktivni && !tts.pauza) mluv(); };
  // stažení hlasu Piper se souhlasem; uvod = proč se nabízí (např. prohlížeč nemá žádný hlas)
  async function stahniPiper(klic, uvod = '') {
    const h = PIPER.hlas(klic);
    if (!(await Dialog.potvrd(`${uvod}Hlas ${h.nazev} (Piper) se jednou stáhne (asi ${h.mb} MB) a pak funguje i bez internetu. Předčítá přirozeněji než hlas prohlížeče a hraje i při zamčené obrazovce. Stáhnout?`, { ok: 'Stáhnout', zrus: 'Zrušit' }))) return false;
    let posledni = -1;
    try {
      await PIPER.stahni(klic, x => { const p = Math.floor(x * 10); if (p !== posledni) { posledni = p; Dialog.info(`Stahuji hlas ${h.nazev}: ${p * 10} %`); } });
      Dialog.info(`Hlas ${h.nazev} je připravený`);
      return true;
    } catch (err) { Dialog.chyba('Hlas se nepodařilo stáhnout: ' + (err.message || err)); return false; }
  }
  $('ttsHlas').onchange = async e => {
    const v = e.target.value, klic = v.replace(/^piper:/, '');
    if (/^piper:/.test(v) && !PIPER.stazene.has(klic) && !(await stahniPiper(klic))) { naplnHlasy(); return; }
    nast().hlas = v; ulozStav(); predpripraveno.clear(); naplnHlasy();
    if (tts.aktivni && !tts.pauza) mluv();
  };

  // Piper: věty se syntetizují dopředu (aktuální + 2 další), ať mezi nimi není ticho
  const predpripraveno = new Map();
  const klicVety = (blok, vi) => `${kniha.id}|${kap().soubor}|${blok}|${vi}|${nast().hlas}|${nast().tts}`;
  function vetyBloku(i) { return bloky[i] && bloky[i].text ? J.vety(bloky[i].text) : []; }
  function zvukVety(blok, vi) {
    const k = klicVety(blok, vi);
    if (!predpripraveno.has(k)) {
      const v = vetyBloku(blok);
      const p = PIPER.veta(nast().hlas.slice(6), v[vi] || '', nast().tts, vi === v.length - 1 ? 0.55 : 0.25);
      p.catch(() => predpripraveno.delete(k));
      predpripraveno.set(k, p);
      if (predpripraveno.size > 12) predpripraveno.delete(predpripraveno.keys().next().value);
    }
    return predpripraveno.get(k);
  }
  function dalsiVety(blok, vi, n) {
    const out = [];
    while (out.length < n && blok < bloky.length) {
      const v = vetyBloku(blok);
      if (vi + 1 < v.length) { vi++; out.push([blok, vi]); } else { blok++; vi = -1; }
    }
    return out;
  }
  async function mluvPiper(gen) {
    let blob;
    try { blob = await zvukVety(tts.blok, tts.vi); }
    catch (e) { if (gen === tts.gen) { Dialog.chyba('Předčítání hlasem Piper selhalo: ' + (e.message || e)); zastavTts(); } return; }
    if (gen !== tts.gen) return;
    dalsiVety(tts.blok, tts.vi, 2).forEach(([b, v]) => zvukVety(b, v));
    URL.revokeObjectURL(zvuk.src);
    zvuk.src = URL.createObjectURL(blob);
    zvuk.onended = () => {
      if (gen !== tts.gen) return;
      aktivita();
      if (++tts.vi >= tts.vety.length) { tts.blok++; tts.vi = 0; tts.vety = []; }
      mluv();
    };
    zvuk.play().catch(e => { if (gen === tts.gen && e.name !== 'AbortError') { Dialog.chyba('Prohlížeč nedovolil přehrát zvuk: ' + e.message); zastavTts(); } });
    if ('mediaSession' in navigator) {
      try { navigator.mediaSession.metadata = new MediaMetadata({ title: kap().nazev, artist: DILO.nazev, album: kniha.nazev }); } catch (e) {}
    }
  }
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', () => { if (tts.aktivni && tts.pauza) pauzaTts(); });
      navigator.mediaSession.setActionHandler('pause', () => { if (tts.aktivni && !tts.pauza) pauzaTts(); });
      navigator.mediaSession.setActionHandler('nexttrack', () => tts.aktivni && ttsSkok(1));
      navigator.mediaSession.setActionHandler('previoustrack', () => tts.aktivni && ttsSkok(-1));
    } catch (e) { /* starší prohlížeč */ }
  }

  // právě čtená věta: <span class="cte-veta"> (víc kusů, když věta jde přes kurzívu)
  function zrusVetu() { text.querySelectorAll('span.cte-veta').forEach(sp => { const r = sp.parentNode; sp.replaceWith(...sp.childNodes); r.normalize(); }); }
  function vyznacVetu(el) {
    const v = tts.pozice && tts.pozice[tts.vi];
    // během výběru prstem odstavec neměnit (viz ukazDotykovyVyber)
    if (v && !dotyk.kotva) obal(el, v.od, v.do, () => Object.assign(document.createElement('span'), { className: 'cte-veta' }));
  }
  function oznacCteny() {
    text.querySelectorAll('.cte').forEach(el => el.classList.remove('cte'));
    zrusVetu();
    const el = prvekBloku(tts.blok);
    if (!el) return;
    el.classList.add('cte');
    vyznacVetu(el);
    // na obrazovce má být celá čtená věta (u dlouhého odstavce nestačí jeho začátek)
    const kusy = el.querySelectorAll('.cte-veta'), p = plocha.getBoundingClientRect();
    const r = kusy.length ? { top: kusy[0].getBoundingClientRect().top, bottom: kusy[kusy.length - 1].getBoundingClientRect().bottom } : el.getBoundingClientRect();
    const mimo = r.top < p.top + 10 || r.top > p.bottom - 60;
    if (nast().strankovani) {   // při listování se nejede plynule: věta dole useknutá = další stránka
      if (mimo) { plocha.scrollTop += r.top - p.top - 14; zarovnejStranu(); }
      else if (r.bottom > p.bottom) strana(1);
    } else if (mimo || r.bottom > p.bottom - 20) plocha.scrollTo({ top: plocha.scrollTop + r.top - p.top - plocha.clientHeight / 3, behavior: 'smooth' });
  }
  async function mluv() {
    const gen = ++tts.gen;
    synt && synt.cancel();
    zvuk.pause();
    while (tts.blok < bloky.length && !bloky[tts.blok].text) tts.blok++;
    if (tts.blok >= bloky.length) {
      const k = stav.kniha, posledniKap = kapIdx === kniha.kapitoly.length - 1;
      if (posledniKap && k === knihy.length - 1) return zastavTts();
      if (casovac.kapitola) return vypnutoCasovacem();   // pokračování (▶) otevře další kapitolu
      await otevri(posledniKap ? k + 1 : k, posledniKap ? 0 : kapIdx + 1, 0, { zTts: true });
      if (gen !== tts.gen) return;
      tts.blok = 0; tts.vi = 0; tts.vety = [];
      return mluv();
    }
    if (casovac.konec && Date.now() >= casovac.konec) return vypnutoCasovacem();
    if (!tts.vety.length) {
      const t = bloky[tts.blok].text;
      tts.pozice = J.vetyPozice(t); tts.vety = tts.pozice.map(v => t.slice(v.od, v.do));
    }
    oznacCteny();
    if (jePiper()) return mluvPiper(gen);
    const u = new SpeechSynthesisUtterance(tts.vety[tts.vi] || '');
    u.lang = 'cs-CZ'; u.rate = nast().tts;
    const hlas = hlasy().find(x => x.name === nast().hlas);
    if (hlas) u.voice = hlas;
    u.onend = () => {
      if (gen !== tts.gen) return;
      aktivita();
      if (++tts.vi >= tts.vety.length) { tts.blok++; tts.vi = 0; tts.vety = []; }
      mluv();
    };
    u.onerror = e => {
      if (gen !== tts.gen || e.error === 'interrupted' || e.error === 'canceled') return;
      Dialog.chyba('Předčítání selhalo: ' + e.error); zastavTts();
    };
    synt.speak(u);
  }
  async function spustTts() {
    if (!kniha) return;
    if (tts.aktivni) return pauzaTts();
    // Chrome načítá systémové hlasy až po chvíli
    if (synt && !synt.getVoices().length) await new Promise(ok => { const t = setTimeout(ok, 800); synt.addEventListener?.('voiceschanged', () => { clearTimeout(t); ok(); }); });
    await piperSlib;
    // bez systémového hlasu (Chrome na Linuxu ho obvykle nemá) rovnou nabídnout hlas Piper
    if (!jePiper() && !(synt && synt.getVoices().length)) {
      if (!(PIPER && PIPER.lze)) {
        Dialog.chyba(location.protocol === 'file:'
          ? 'Prohlížeč nemá žádný hlas pro předčítání a u stránky otevřené jako soubor (file://) nejdou použít ani hlasy Piper. Otevřete čtečku přes web nebo místní server (./test_local.sh → http://localhost:8000).'
          : 'Prohlížeč nemá žádný hlas pro předčítání (v systému chybí řečový modul).');
        return;
      }
      const h = PIPER.HLASY[0];
      if (!PIPER.stazene.has(h.klic) && !(await stahniPiper(h.klic, 'Prohlížeč nemá žádný systémový hlas pro předčítání. '))) return;
      nast().hlas = 'piper:' + h.klic; ulozStav(); naplnHlasy();
    }
    Object.assign(tts, { aktivni: true, pauza: false, blok: aktualniBlok(), vi: 0, vety: [] });
    $('tts').hidden = false; $('ttsPauza').textContent = '⏸';
    $('tlPredcitat').setAttribute('aria-pressed', 'true');
    aktualizujZamek();
    if (!jePiper() && !hlasy().some(x => /^cs/i.test(x.lang))) Dialog.info('Prohlížeč nemá český hlas – čte se výchozím hlasem. Lepší český hlas (Piper) vyberete v liště předčítání.');
    mluv();
  }
  function pauzaTts() {
    tts.pauza = !tts.pauza;
    $('ttsPauza').textContent = tts.pauza ? '▶' : '⏸';
    if (tts.pauza) { tts.gen++; synt && synt.cancel(); zvuk.pause(); } else mluv();
    aktualizujZamek();
  }
  function zastavTts() {
    if (!tts.aktivni) return;
    tts.aktivni = false; tts.gen++;
    synt && synt.cancel();
    zvuk.pause();
    $('tts').hidden = true;
    $('tlPredcitat').setAttribute('aria-pressed', 'false');
    aktualizujZamek();
    text.querySelectorAll('.cte').forEach(el => el.classList.remove('cte'));
    zrusVetu();
    zrusCasovac();
  }
  const ttsSkok = smer => {
    let i = tts.blok + smer;
    while (bloky[i] && !bloky[i].text) i += smer;
    tts.blok = Math.max(0, i); tts.vi = 0; tts.vety = []; tts.pauza = false; $('ttsPauza').textContent = '⏸';
    mluv();
  };
  // časovač vypnutí (usínání u předčítání): po N minutách nebo na konci kapitoly se předčítání pozastaví;
  // hlídá se na začátku každé věty, takže funguje i s hlasem Piper při zamčené obrazovce
  const casovac = { konec: 0, kapitola: false };
  function ukazCasovac() {
    $('ttsZbyva').textContent = casovac.konec ? Math.max(1, Math.ceil((casovac.konec - Date.now()) / 60e3)) + '′' : '';
  }
  function zrusCasovac() { casovac.konec = 0; casovac.kapitola = false; $('ttsCasovac').value = ''; ukazCasovac(); }
  function vypnutoCasovacem() {
    zrusCasovac();
    if (!tts.pauza) pauzaTts();
    Dialog.info('⏾ Předčítání pozastaveno časovačem');
  }
  $('ttsCasovac').onchange = e => {
    const v = e.target.value;
    casovac.kapitola = v === 'kap';
    casovac.konec = /^\d+$/.test(v) ? Date.now() + v * 60e3 : 0;
    ukazCasovac();
  };
  $('ttsPauza').onclick = pauzaTts;
  $('ttsStop').onclick = zastavTts;
  $('ttsZpet').onclick = () => ttsSkok(-1);
  $('ttsVpred').onclick = () => ttsSkok(1);
  addEventListener('pagehide', () => { synt && synt.cancel(); zvuk.pause(); ulozStav(true); });
  // Karta otevřená celé dny (tablet) by běžela na starém kódu, zatímco kapitoly se stahují nové –
  // po návratu do karty porovnat skripty se serverem a při změně stránku obnovit (pozice je uložená).
  const otiskSkriptu = () => Promise.all(['ctecka/jadro.js', 'ctecka/ctecka.js', 'ctecka/sablona.js', 'ctecka/ctecka.css', ...(ZDROJ ? [] : [DILO.data + 'knihy.json?t=' + Date.now()])].map(u => fetch(u, { cache: 'no-cache' }).then(r => r.ok ? r.text() : '')))
    .then(t => t.join('\n')).catch(() => '');
  const puvodniOtisk = otiskSkriptu();
  let skrytoOd = 0;
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'hidden') { skrytoOd = Date.now(); ulozStav(true); return; }
    if (skrytoOd && Date.now() - skrytoOd > 10 * 60e3 && !tts.aktivni) {
      const [stary, novy] = await Promise.all([puvodniOtisk, otiskSkriptu()]);
      if (stary && novy && stary !== novy) { ulozStav(true); location.reload(); return; }
    }
    aktualizujZamek();   // zámek obrazovky se při skrytí stránky sám uvolní
    // zamčený telefon řeč prohlížeče zastaví – po odemčení pokračovat od přerušené věty
    // (Piper hraje přes <audio> dál i při zamčení – ten se nerestartuje)
    if (tts.aktivni && !tts.pauza && !jePiper() && synt && !synt.speaking) mluv();
  });

  /* ---------- obrazovka nezhasne během předčítání (nebo vždy, je-li zapnuto) ---------- */
  let zamek = null, zadamZamek = false;
  async function aktualizujZamek() {
    const chci = (tts.aktivni && !tts.pauza) || nast().nezhasinat;
    if (chci && !zamek && !zadamZamek && navigator.wakeLock && document.visibilityState === 'visible') {
      zadamZamek = true;
      try {
        zamek = await navigator.wakeLock.request('screen');
        zamek.addEventListener('release', () => { zamek = null; });
      } catch (e) { /* prohlížeč nebo rámec zámek nedovolí – nevadí */ }
      zadamZamek = false;
    } else if (!chci && zamek) { zamek.release().catch(() => {}); zamek = null; }
  }

  /* ---------- soustředěné čtení ---------- */
  // Brave/Chrome na iPadu a iPhonu celou obrazovku webu nepovolí (lišta prohlížeče zůstane) –
  // jednou za návštěvu poradit přidání na plochu, odkud se čtečka spouští bez lišt
  let radaPlocha = false;
  function celaObrazovka() {
    const el = document.documentElement;
    let pozadavek;
    try { pozadavek = el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen ? el.webkitRequestFullscreen() : Promise.reject(); }
    catch (e) { pozadavek = Promise.reject(e); }
    Promise.resolve(pozadavek).catch(() => {
      const ios = /iP(ad|hone|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const zPlochy = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
      if (!ios || zPlochy || radaPlocha) return;
      radaPlocha = true;
      Dialog.info('Prohlížeč na iPadu nedovolí skrýt svou lištu. Pro čtení přes celou obrazovku přidejte čtečku na plochu (v nabídce prohlížeče Sdílet → Přidat na plochu) a spouštějte ji odtud.');
    });
  }
  // jenLisy = klepnutí doprostřed stránky při listování: schovat/ukázat lišty bez celé obrazovky
  function soustredeni(zapnout = !document.body.classList.contains('soustredeni'), jenLisy = false) {
    document.body.classList.toggle('soustredeni', zapnout);
    $('ven').hidden = !zapnout || jenLisy;
    $('tlCelaObr').setAttribute('aria-pressed', String(zapnout));
    if (zapnout && !jenLisy) celaObrazovka();
    else if (!zapnout && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else if (!zapnout && document.webkitFullscreenElement) document.webkitExitFullscreen?.();
    // místo čtení drží ResizeObserver plochy (zapamatujMisto)
  }
  $('ven').onclick = () => soustredeni(false);
  const poZmeneCeleObr = () => { if (!document.fullscreenElement && !document.webkitFullscreenElement && document.body.classList.contains('soustredeni')) soustredeni(false); };
  document.addEventListener('fullscreenchange', poZmeneCeleObr);
  document.addEventListener('webkitfullscreenchange', poZmeneCeleObr);

  /* ---------- čas čtení ---------- */
  let posledniAktivita = Date.now();
  function aktivita() { posledniAktivita = Date.now(); }
  ['keydown', 'pointerdown', 'wheel'].forEach(t => addEventListener(t, aktivita, { passive: true }));
  const dnes = () => new Date().toLocaleDateString('sv');   // RRRR-MM-DD
  setInterval(() => {
    ukazCasovac();
    const cte = (tts.aktivni && !tts.pauza) || Date.now() - posledniAktivita < 120000;
    if (document.visibilityState !== 'visible' || !cte || !kniha) return;
    stav.cas += 15;
    stav.dny[dnes()] = (stav.dny[dnes()] || 0) + 15;
    const dny = Object.keys(stav.dny).sort();
    while (dny.length > 400) delete stav.dny[dny.shift()];
    ulozStav();
  }, 15000);

  function ukazStatistiky() {
    const t = s => s < 60 ? '0 min' : J.formatCas(s / 60);
    const tyden = Object.entries(stav.dny).filter(([d]) => (Date.now() - new Date(d)) / 864e5 < 7).reduce((s, [, v]) => s + v, 0);
    let h = `<table><tr><td>Celkový čas čtení</td><td>${t(stav.cas)}</td></tr><tr><td>Dnes</td><td>${t(stav.dny[dnes()] || 0)}</td></tr>
      <tr><td>Posledních 7 dní</td><td>${t(tyden)}</td></tr><tr><td>Dní se čtením</td><td>${Object.keys(stav.dny).length}</td></tr>`;
    knihy.forEach(k => {
      const prec = Object.keys(stav.precteno[k.id] || {}).length, p = pokrokKnihy(k);
      h += `<tr><td><strong>${J.esc(k.nazev)}</strong></td><td>${Math.floor(p * 100)} % · ${prec}/${k.kapitoly.length} kapitol · ${zbyvaText(Math.round(k.slov * (1 - p)))}</td></tr>`;
    });
    h += `<tr><td>Záložky</td><td>${data.zalozky.length}</td></tr><tr><td>Zvýraznění / s poznámkou</td><td>${data.zvyrazneni.length} / ${data.zvyrazneni.filter(z => z.poznamka).length}</td></tr></table>`;
    $('statObsah').innerHTML = h;
    $('wpm').value = nast().wpm;
    otevriModal('statistiky');
  }
  $('wpm').addEventListener('change', e => { const v = Math.round(+e.target.value); if (v >= 80 && v <= 600) { nast().wpm = v; ulozStav(); poScrollu(); ukazStatistiky(); } });

  /* ---------- export, tisk, offline, záloha ---------- */
  // Kroniky_vyhnanstvi_I_Posledni_drak; dílo s jedinou knihou stejného jména jen jednou (ne treti_breh_treti_breh)
  const souborNazev = k => {
    const kn = J.normalizuj(k.nazev).replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
    return !kn || kn.toLowerCase() === SOUBOR.toLowerCase() ? SOUBOR : SOUBOR + '_' + kn;
  };
  function stahni(jmeno, obsah, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([obsah], { type: typ }));
    a.download = jmeno;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function exportKnihy(format) {
    try {
      const obsahy = await nactiKnihu(kniha);
      if (format === 'epub' || format === 'mobi') {
        Dialog.info('Připravuji e-knihu s ilustracemi…');
        const kapitoly = kniha.kapitoly.map((c, i) => ({ nazev: c.nazev, bloky: obsahy[i].bloky }));
        const obrazky = await jpegyKnihy(kniha, kapitoly, format === 'mobi' ? 120000 : 400000);
        if (format === 'epub') stahni(souborNazev(kniha) + '.epub', J.epub(kniha, kapitoly, obrazky, DILO.autor, DILO.nazev), 'application/epub+zip');
        else stahni(souborNazev(kniha) + '.mobi', J.mobi(kniha, kapitoly, obrazky, DILO.autor, DILO.nazev), 'application/x-mobipocket-ebook');
      } else {
        const md = `# ${DILO.nazev} – ${kniha.nazev}\n\n_${kniha.podtitul}_\n\n` + obsahy.map(o => o.md.replace(/^# /, '## ')).join('\n\n');
        stahni(souborNazev(kniha) + '.md', md, 'text/markdown;charset=utf-8');
      }
    } catch (e) { Dialog.chyba('Knihu se nepodařilo načíst celou. Jste offline?'); }
  }
  // ilustrace pro e-knihy jako JPEG (WebP starší čtečky neumí, MOBI má limit ~127 kB na obrázek)
  async function jpegyKnihy(k, kapitoly, maxBajtu) {
    const srcs = new Set(k.obalka ? [k.obalka] : []);
    kapitoly.forEach(c => c.bloky.forEach(b => { if (b.typ === 'img') srcs.add(b.src); }));
    const vysl = {};
    for (const src of srcs) {
      try {
        const bmp = await createImageBitmap(await (await fetch(sOtiskem(k, src))).blob());
        let sirka = Math.min(bmp.width, 1000), kvalita = 0.82, data;
        do {
          const c = document.createElement('canvas');
          c.width = sirka; c.height = Math.round(bmp.height * sirka / bmp.width);
          const g = c.getContext('2d');
          g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
          g.drawImage(bmp, 0, 0, c.width, c.height);
          data = new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/jpeg', kvalita))).arrayBuffer());
          if (kvalita > 0.5) kvalita -= 0.1; else sirka = Math.round(sirka * 0.8);
        } while (data.length > maxBajtu && sirka > 200);
        vysl[src] = data;
      } catch (e) { /* chybějící obrázek e-knihu nezastaví */ }
    }
    return vysl;
  }
  const mojeBalik = () => J.balikPoznamek(stav.jmeno, data);
  const jmenoSouboru = (pripona) => `${SOUBOR}_poznamky${stav.jmeno ? '_' + J.normalizuj(stav.jmeno).replace(/[^a-z0-9]+/gi, '_') : ''}_${dnes()}.${pripona}`;
  const exportPoznamek = () => stahni(jmenoSouboru('md'), J.poznamkyMd(mojeBalik(), knihy, DILO.nazev), 'text/markdown;charset=utf-8');
  const exportPoznamekJson = () => stahni(jmenoSouboru('json'), JSON.stringify(mojeBalik(), null, 1), 'application/json');
  // čtenář pošle poznámky autorovi: telefon → sdílení souboru (e-mail, zprávy…), jinak stažení + předvyplněný e-mail
  async function odeslatPoznamky() {
    if (!data.zvyrazneni.length && !data.zalozky.length) { Dialog.info('Zatím nemáte žádné poznámky ani záložky.'); return; }
    const jm = await Dialog.zeptej('Vaše jméno – podle něj autor pozná, od koho poznámky jsou:', stav.jmeno || '', { ok: 'Pokračovat' });
    if (jm === null) return;
    stav.jmeno = jm.trim(); ulozStav(true);
    const nazev = jmenoSouboru('md'), md = J.poznamkyMd(mojeBalik(), knihy, DILO.nazev);
    const predmet = `${DILO.nazev} – poznámky${stav.jmeno ? ' od ' + stav.jmeno : ''}`;
    const soubor = new File([md], nazev, { type: 'text/markdown' });
    if (navigator.canShare && navigator.canShare({ files: [soubor] })) {
      try { await navigator.share({ files: [soubor], title: predmet, text: predmet }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    stahni(nazev, md, 'text/markdown;charset=utf-8');
    const telo = `Dobrý den,\n\nposílám poznámky ke knize ${DILO.nazev}. Soubor ${nazev} je v příloze (najdete ho ve Stažených souborech).\n\n${stav.jmeno}`;
    if (await Dialog.potvrd(`Soubor ${nazev} je stažený ve Stažených souborech. Otevřít e-mail${stav.prijemce ? ' pro ' + stav.prijemce : ''}? Soubor do něj přiložte (přetáhněte).`, { ok: '✉ Otevřít e-mail', zrus: 'Ne, pošlu sám' }))
      location.href = `mailto:${encodeURIComponent(stav.prijemce || '')}?subject=${encodeURIComponent(predmet)}&body=${encodeURIComponent(telo)}`;
  }
  // autor načte poznámky od betačtenářů (MD i JSON, víc souborů); stejné jméno = novější verze nahradí starší
  async function nactiPoznamky(soubory) {
    let nacteno = 0;
    for (const f of soubory) {
      const b = J.prectiPoznamky(await f.text());
      if (!b) { Dialog.chyba(`${f.name}: soubor neobsahuje poznámky z čtečky.`); continue; }
      const jmeno = b.jmeno || f.name.replace(/\.[a-z]+$/i, '');
      const stara = data.cizi.find(c => c.jmeno === jmeno);
      const sada = { id: stara ? stara.id : noveId(), jmeno, cas: b.cas || Date.now(), skryta: false, zvyrazneni: b.zvyrazneni, zalozky: b.zalozky };
      data.cizi = stara ? data.cizi.map(c => c === stara ? sada : c) : [...data.cizi, sada];
      nacteno++;
      Dialog.info(`${stara ? 'Aktualizováno' : 'Načteno'}: ${jmeno} – ${b.zvyrazneni.length} poznámek, ${b.zalozky.length} záložek`);
    }
    if (!nacteno) return;
    ulozData(); prekresliText(); otevriPanel('poznamky');
  }
  $('souborPoznamky').onchange = e => { if (e.target.files.length) nactiPoznamky([...e.target.files]); e.target.value = ''; };
  // překreslí jen odstavce se značkami (dřívějšími v textu i současnými v datech)
  function prekresliText() {
    if (!kniha) return;
    const zn = znackyKapitoly(), bl = new Set([...text.querySelectorAll('mark')].map(m => +m.closest('[data-i]').dataset.i));
    [...zn.zv, ...zn.cizi.map(x => x[1]), ...zn.zal].forEach(z => bl.add(z.blok));
    bl.forEach(i => vyznacBlok(i));
  }
  async function ukazCizi(sadaId, id) {
    const c = data.cizi.find(x => x.id === sadaId), z = c && c.zvyrazneni.find(x => x.id === id);
    if (!z) return;
    if (await Dialog.potvrd(`👤 ${c.jmeno || 'Čtenář'}\n\n„${z.text}“${z.poznamka ? '\n\n📝 ' + z.poznamka : ''}`, { ok: 'Zavřít', zrus: 'Seznam poznámek' })) return;
    otevriPanel('poznamky');
    const el = panelObsah.querySelector(`[data-pozn="${CSS.escape(id)}"]`);
    if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('blik'); setTimeout(() => el.classList.remove('blik'), 1600); }
  }
  const adresaCtecky = () => { try { if (window.top !== window) return top.location.origin + top.location.pathname + '#obsah/' + DILO.stranka; } catch (e) {} return location.origin + location.pathname; };
  async function odkazBeta() {
    const em = await Dialog.zeptej('Odkaz pro betačtenáře. Na jaký e-mail mají poslat poznámky?', stav.prijemce || '', { ok: 'Kopírovat odkaz' });
    if (em === null) return;
    stav.prijemce = em.trim(); ulozStav(true);
    const p = 'beta=1' + (stav.prijemce ? '&email=' + encodeURIComponent(stav.prijemce) : '');
    const url = adresaCtecky();
    kopiruj(url + '?' + p, '🔗 Odkaz pro betačtenáře zkopírován');
  }
  // tisk celé knihy dělá samostatná stránka Sazba knihy (obsah/sazba.html): obálka, obsah s čísly stran, záhlaví, okraje v mm
  const sazba = (kapitola) => window.open(`sazba.html?dilo=${encodeURIComponent(DILO.id)}&kniha=${encodeURIComponent(kniha.id)}` + (kapitola == null ? '' : `&kapitola=${kapitola}`), '_blank');
  async function offline() {
    Dialog.info('Ukládám kapitoly…');
    try {
      for (const k of knihy) await nactiKnihu(k);
      Dialog.info(navigator.serviceWorker && navigator.serviceWorker.controller
        ? `📥 Uloženo ${knihy.reduce((s, k) => s + k.kapitoly.length, 0)} kapitol – knihy jdou číst i bez internetu.`
        : 'Kapitoly jsou načtené, ale offline mezipaměť webu tu není aktivní (otevřete čtečku přes rozcestník webu).');
    } catch (e) { Dialog.chyba('Některé kapitoly se nepodařilo stáhnout.'); }
  }
  function odkaz() {
    const p = `kniha=${stav.kniha + 1}&kap=${encodeURIComponent(kap().soubor.replace(/\.md$/, ''))}&blok=${aktualniBlok()}`;
    let url;
    try { url = window.top !== window ? top.location.origin + top.location.pathname + '#obsah/' + DILO.stranka + '?' + p : null; } catch (e) { url = null; }
    kopiruj(url || location.origin + location.pathname + '?' + p, '🔗 Odkaz zkopírován');
  }
  async function obnova(soubor) {
    try {
      const z = JSON.parse(await soubor.text());
      if (z.format !== 'kroniky-zaloha' || (z.dilo || 'kroniky') !== (DILO.id || 'kroniky')) throw new Error();
      if (!(await Dialog.potvrd('Nahradit současné poznámky, záložky a pokrok obsahem zálohy?'))) return;
      stav = { ...stav, ...z.stav, nast: { ...VYCHOZI_NAST, ...z.stav.nast } };
      data = { zalozky: [], zvyrazneni: [], cizi: [], ...z.data };
      ulozStav(true); ulozData(); pouzijNastaveni(); obnovPozici();
      Dialog.info('Záloha obnovena');
    } catch (e) { Dialog.chyba(`Soubor není záloha čtečky tohoto díla (${DILO.nazev}).`); }
  }
  $('souborObnova').onchange = e => { if (e.target.files[0]) obnova(e.target.files[0]); e.target.value = ''; };

  /* ---------- okna a nabídky ---------- */
  function otevriModal(id) { $(id).hidden = false; $(id).querySelector('[data-zavrit]').focus(); }
  const otevrenyModal = () => document.querySelector('.modal:not([hidden])');
  document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-zavrit]')) m.hidden = true; }));

  function vykresliNabKniha() {
    $('nabKniha').innerHTML = '<div class="titulek">Kniha</div>' + knihy.map((k, i) =>
      `<button class="tl prep" data-prikaz="kniha-${i}" aria-pressed="${kniha && k.id === kniha.id}"><span data-i18n="ne">${J.esc(k.nazev)}</span><span class="procento">${Math.floor(pokrokKnihy(k) * 100)} %</span></button>`).join('') +
      '<hr><button class="tl" data-prikaz="panel-obsah">☰ Obsah knihy <kbd>T</kbd></button><button class="tl" data-prikaz="od-zacatku">⏮ Číst tuto knihu od začátku</button>';
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
    if (n.id === 'nabKniha') vykresliNabKniha();
    n.hidden = false; b.setAttribute('aria-expanded', 'true');
    const r = b.getBoundingClientRect();
    n.style.top = (r.bottom + 4) + 'px';
    n.style.maxHeight = Math.max(160, innerHeight - r.bottom - 12) + 'px';   // iOS: 100vh je vyšší než viditelná část
    n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
  }));

  const PRIKAZY = {
    predchozi: () => posun(-1),
    dalsi: () => posun(1),
    'od-zacatku': () => { const pred = mistoCteni(); otevri(stav.kniha, 0).then(() => poSkoku(pred)); },
    'panel-obsah': () => prepniPanel('obsah'),
    'panel-zalozky': () => prepniPanel('zalozky'),
    'panel-poznamky': () => prepniPanel('poznamky'),
    zalozka: prepniZalozku,
    predcitat: spustTts,
    soustredeni: () => soustredeni(),
    blok: () => nastav({ blok: !nast().blok }),
    knizni: () => nastav({ knizni: !nast().knizni }),
    obrazky: () => nastav({ obrazky: !nast().obrazky }),
    nezhasinat: () => nastav({ nezhasinat: !nast().nezhasinat }),
    strankovani: () => { nastav({ strankovani: !nast().strankovani }); requestAnimationFrame(() => zarovnejStranu()); },
    'vychozi-zobrazeni': () => nastav({ ...VYCHOZI_NAST, wpm: nast().wpm, tts: nast().tts, hlas: nast().hlas }),
    odkaz,
    epub: () => exportKnihy('epub'),
    markdown: () => exportKnihy('md'),
    mobi: () => exportKnihy('mobi'),
    'exp-poznamky': exportPoznamek,
    'exp-poznamky-json': exportPoznamekJson,
    'odeslat-poznamky': odeslatPoznamky,
    'nacist-poznamky': () => $('souborPoznamky').click(),
    'odkaz-beta': odkazBeta,
    'tisk-kapitoly': () => print(),
    'tisk-knihy': () => sazba(),
    'sazba-kapitoly': () => sazba(kapIdx),
    offline,
    statistiky: ukazStatistiky,
    napoveda: () => otevriModal('napoveda'),
    zaloha: () => stahni(`${SOUBOR}_zaloha_${dnes()}.json`, JSON.stringify({ format: 'kroniky-zaloha', verze: 1, dilo: DILO.id, stav, data }, null, 1), 'application/json'),
    obnova: () => $('souborObnova').click(),
    'smazat-data': async () => {
      if (!(await Dialog.potvrd('Smazat všechny záložky, zvýraznění, poznámky, pokrok a statistiky čtení? Vzhled čtečky zůstane.'))) return;
      stav = { kniha: stav.kniha, pozice: {}, precteno: {}, cas: 0, dny: {}, panel: stav.panel, nast: stav.nast, jmeno: stav.jmeno, prijemce: stav.prijemce };
      data = { zalozky: [], zvyrazneni: [], cizi: data.cizi };
      ulozStav(true); ulozData(); otevri(stav.kniha, 0);
    },
  };
  function prikaz(id) {
    zavriNabidky();
    if (PRIKAZY[id]) return PRIKAZY[id]();
    const [co, hodnota] = id.split('-');
    if (co === 'kniha') { const k = knihy[+hodnota], p = stav.pozice[k.id], c = p ? Math.max(0, indexKap(k, p.soubor)) : 0, pred = mistoCteni(); otevri(+hodnota, c, p && c === indexKap(k, p.soubor) ? p.blok : 0).then(() => poSkoku(pred)); }
    if (co === 'motiv') nastav({ motiv: id.slice(6) });   // i „motiv-sepie-2“
    if (co === 'pismo') nastav({ pismo: hodnota });
    if (co === 'bublina') nastav({ bublina: hodnota });
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-prikaz]');
    if (b && !b.disabled) { e.stopPropagation(); return prikaz(b.dataset.prikaz); }
    if (!e.target.closest('.nabidka')) zavriNabidky();
    if (!e.target.closest('#vyber, mark.zv') && getSelection().isCollapsed) zavriVyber();
    // na úzkém displeji panel překrývá text – klepnutí vedle ho zavře
    if (stav.panel && matchMedia('(max-width:760px)').matches && !e.target.closest('aside, .lista, .nabidka, .modal, dialog, #vyber')) zavriPanel();
  });
  let sirkaOkna = innerWidth;
  addEventListener('resize', () => { if (innerWidth === sirkaOkna) return; sirkaOkna = innerWidth; zavriNabidky(); zavriVyber(); });

  /* ---------- klávesnice ---------- */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!$('lupa').hidden) { $('lupa').hidden = true; return; }
      if (otevrenyModal()) { otevrenyModal().hidden = true; return; }
      if (!lista.hidden) { zavriVyber(); return; }
      if (document.querySelector('.nabidka:not([hidden])')) { zavriNabidky(); return; }
      if (document.body.classList.contains('soustredeni')) { soustredeni(false); return; }
      if (tts.aktivni) { zastavTts(); return; }
      if (stav.panel && matchMedia('(max-width:760px)').matches) zavriPanel();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); $('hledat').focus(); $('hledat').select(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || otevrenyModal() || document.querySelector('dialog[open]')) return;
    const cil = e.target.closest ? e.target : document.body;
    if (cil.closest('input, textarea, select, [contenteditable]')) return;
    if ((e.key === ' ' || e.key === 'Enter') && cil.closest('button, [role=button]')) return;
    const vyska = plocha.clientHeight * 0.9;
    // stránkování: šipky, mezerník a PgUp/PgDn listují po stránkách (kapitoly dál tlačítky ◀ ▶)
    const listovani = nast().strankovani ? {
      ArrowLeft: () => strana(-1), ArrowRight: () => strana(1), ArrowUp: () => strana(-1), ArrowDown: () => strana(1),
      PageUp: () => strana(-1), PageDown: () => strana(1), ' ': () => strana(e.shiftKey ? -1 : 1),
    } : {};
    const akce = {
      ArrowLeft: () => posun(-1), ArrowRight: () => posun(1),
      ArrowDown: () => plocha.scrollBy({ top: 60 }), ArrowUp: () => plocha.scrollBy({ top: -60 }),
      PageDown: () => plocha.scrollBy({ top: vyska }), PageUp: () => plocha.scrollBy({ top: -vyska }),
      ' ': () => plocha.scrollBy({ top: e.shiftKey ? -vyska : vyska }),
      Home: () => plocha.scrollTo({ top: 0 }), End: () => plocha.scrollTo({ top: plocha.scrollHeight }),
      '/': () => { $('hledat').focus(); $('hledat').select(); },
      t: () => prepniPanel('obsah'), b: prepniZalozku, z: () => prepniPanel('zalozky'), n: () => prepniPanel('poznamky'),
      r: spustTts, f: () => soustredeni(), Backspace: () => navrat && vratSe(),
      '+': () => nastav({ velikost: Math.min(1.8, +(nast().velikost + 0.05).toFixed(2)) }),
      '=': () => nastav({ velikost: Math.min(1.8, +(nast().velikost + 0.05).toFixed(2)) }),
      '-': () => nastav({ velikost: Math.max(0.8, +(nast().velikost - 0.05).toFixed(2)) }),
      '?': () => otevriModal('napoveda'), F1: () => otevriModal('napoveda'),
      ...listovani,
    }[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (akce) { e.preventDefault(); akce(); }
  });

  /* ---------- zpět na místo před skokem (obsah, hledání, záložky, poznámky, tažení posuvníku) ---------- */
  let navrat = null, casNavratu = 0;
  const mistoCteni = () => kniha && { k: stav.kniha, c: kapIdx, blok: aktualniBlok(), top: plocha.scrollTop };
  // pred = místo před skokem, cilTop = kam skok vede (plynulé posouvání ještě nedojelo); bližší skok než o obrazovku se nenabízí
  function poSkoku(pred, cilTop = plocha.scrollTop) {
    if (!pred || !kniha) return;
    if (pred.k === stav.kniha && pred.c === kapIdx && Math.abs(cilTop - pred.top) < plocha.clientHeight) return;
    navrat = pred;
    $('zpetMisto').hidden = false;
    clearTimeout(casNavratu);
    casNavratu = setTimeout(() => { $('zpetMisto').hidden = true; navrat = null; }, 120e3);
  }
  // návrat; tlačítko pak vede zase na místo skoku (přepínání mezi dvěma místy)
  async function vratSe() {
    const cil = navrat, ted = mistoCteni();
    if (!cil) return;
    $('zpetMisto').hidden = true; navrat = null;
    if (cil.k !== stav.kniha || cil.c !== kapIdx) await otevri(cil.k, cil.c, cil.blok);
    else plocha.scrollTo({ top: cil.top });
    poSkoku(ted);
  }
  $('zpetMisto').onclick = vratSe;

  /* ---------- posuvník kapitoly ---------- */
  const posuvnik = $('posuvnik'), jezdec = $('jezdec'), bublina = $('bublina'), drazka = posuvnik.querySelector('.drazka');
  let casBubliny = 0, tazeni = false;
  function kresliPosuvnik() {
    const max = plocha.scrollHeight - plocha.clientHeight, h = drazka.clientHeight;
    const vyska = Math.max(28, h * plocha.clientHeight / Math.max(1, plocha.scrollHeight));
    const podil = max > 0 ? plocha.scrollTop / max : 0;
    jezdec.style.height = vyska + 'px';
    jezdec.style.top = (podil * (h - vyska)) + 'px';
    if (!kniha) return;
    const zbyva = kap().slov - prectenoSlov();
    // nastavení: u posuvníku (sleduje jezdec), dole v okně (neruší text), nebo vůbec
    const kde = nast().bublina || 'dole';
    if (kde === 'ne') return;
    const str = nast().strankovani ? cisloStrany() : null;
    bublina.innerHTML = (str ? `<span>strana ${str.akt} z ${str.z}</span> · ` : '') + `<span>${Math.round(podil * 100)} % kapitoly</span> · <span>${zbyvaText(zbyva)}</span>`;
    bublina.classList.toggle('dole', kde === 'dole');
    bublina.style.top = kde === 'dole' ? '' : (8 + podil * (h - vyska) + vyska / 2) + 'px';
    bublina.classList.remove('skryt');
    clearTimeout(casBubliny);
    if (!tazeni) casBubliny = setTimeout(() => bublina.classList.add('skryt'), 1200);
  }
  // značky záložek a zvýraznění podél posuvníku
  let ramecZnacek = 0;
  function planujZnacky() { if (!ramecZnacek) ramecZnacek = requestAnimationFrame(kresliZnacky); }
  function kresliZnacky() {
    ramecZnacek = 0;
    const vyska = Math.max(1, plocha.scrollHeight), h = drazka.clientHeight;
    $('znacky').innerHTML = [...text.querySelectorAll('mark.zal-slovo, mark.zv')].map(el => {
      const top = (el.closest('[data-i]').offsetTop + el.offsetTop) / vyska * h;
      return el.classList.contains('zv') ? `<div class="znacka" style="top:${top.toFixed(1)}px;background:var(--zv-${el.dataset.barva})"></div>`
        : `<div class="znacka zal" style="top:${top.toFixed(1)}px"></div>`;
    }).join('');
    kresliPosuvnik();
  }
  function posunNa(e) {
    const r = drazka.getBoundingClientRect(), vyska = jezdec.offsetHeight;
    const podil = Math.min(1, Math.max(0, (e.clientY - r.top - vyska / 2) / Math.max(1, r.height - vyska)));
    plocha.scrollTop = podil * (plocha.scrollHeight - plocha.clientHeight);
  }
  let predTazenim = null;
  posuvnik.addEventListener('pointerdown', e => {
    predTazenim = mistoCteni();
    tazeni = true; posuvnik.classList.add('tazeni'); posuvnik.setPointerCapture(e.pointerId); posunNa(e); e.preventDefault();
  });
  posuvnik.addEventListener('pointermove', e => { if (tazeni) posunNa(e); });
  const konecTazeni = () => { if (!tazeni) return; tazeni = false; posuvnik.classList.remove('tazeni'); kresliPosuvnik(); poSkoku(predTazenim); };
  posuvnik.addEventListener('pointerup', konecTazeni);
  posuvnik.addEventListener('pointercancel', konecTazeni);
  new ResizeObserver(planujZnacky).observe(text);   // dorazily obrázky, změna písma, šířky…

  /* ---------- místo čtení drží i při změně velikosti plochy ----------
     Klávesnice u poznámky, otočení tabletu, schování lišty prohlížeče nebo iframe, který dostane
     rozměry až po načtení – bez tohohle text uskočil a značky u posuvníku zůstaly na starých místech. */
  let misto = null;   // {blok, podil} – horní blok a jak daleko v něm je horní hrana plochy
  function zapamatujMisto(i = aktualniBlok()) {
    const el = prvekBloku(i);
    if (el) misto = { blok: i, podil: Math.max(0, (plocha.scrollTop - el.offsetTop) / Math.max(1, el.offsetHeight)) };
  }
  let rozmerPlochy = '';
  new ResizeObserver(() => {
    const r = plocha.clientWidth + 'x' + plocha.clientHeight;
    if (r === rozmerPlochy) return;
    rozmerPlochy = r;
    const el = misto && kniha && prvekBloku(misto.blok);
    if (el && !tazeni) {
      plocha.scrollTop = el.offsetTop + misto.podil * el.offsetHeight;
      if (nast().strankovani) zarovnejStranu();
    }
    planujZnacky();
  }).observe(plocha);
  new ResizeObserver(planujZnacky).observe(drazka);
  // iOS při psaní do okna posune celou stránku nahoru a sám ji nevrátí
  const srovnejOkno = () => { if (!document.activeElement || !document.activeElement.matches('input, textarea')) scrollTo(0, 0); };
  if (window.visualViewport) visualViewport.addEventListener('resize', srovnejOkno);
  addEventListener('focusout', () => setTimeout(srovnejOkno, 50));

  /* ---------- stránkování: listování po obrazovkách jako na čtečce e-knih ----------
     Plocha se neposouvá prstem ani kolečkem; stránka končí posledním celým řádkem –
     useknutý řádek dole zakryje maska a na další stránce je nahoře celý. */
  const maska = document.createElement('div');
  maska.id = 'maskaStrany'; maska.hidden = true;
  plocha.parentElement.insertBefore(maska, posuvnik);
  // obdélník řádku textu, který protíná výšku y (souřadnice okna); null = mezera mezi odstavci, obrázek
  function radekNa(y) {
    const t = text.getBoundingClientRect();
    for (const x of [t.left + 24, t.left + t.width / 2]) {
      let uzel, off;
      if (document.caretRangeFromPoint) { const g = document.caretRangeFromPoint(x, y); if (g) { uzel = g.startContainer; off = g.startOffset; } }
      else if (document.caretPositionFromPoint) { const g = document.caretPositionFromPoint(x, y); if (g) { uzel = g.offsetNode; off = g.offset; } }
      if (!uzel || uzel.nodeType !== 3 || !text.contains(uzel) || !uzel.length) continue;
      const g = document.createRange(), o = Math.min(off, uzel.length - 1);
      g.setStart(uzel, o); g.setEnd(uzel, o + 1);
      const rect = [...g.getClientRects()].find(q => q.top <= y + 0.5 && q.bottom >= y - 0.5);
      if (rect && rect.height) return rect;
    }
    return null;
  }
  function aktualizujMasku() {
    if (!nast().strankovani) { maska.hidden = true; return; }
    const p = plocha.getBoundingClientRect(), r = radekNa(p.bottom - 1);
    const vyska = r && r.bottom > p.bottom + 0.5 && r.top > p.top + 20 ? p.bottom - r.top : 0;
    maska.hidden = !vyska;
    maska.style.height = vyska + 'px';
    maska.style.right = posuvnik.offsetWidth + 'px';
  }
  // horní řádek nesmí být useknutý – raději ukázat celý
  function zarovnejStranu() {
    if (!nast().strankovani) return aktualizujMasku();
    const p = plocha.getBoundingClientRect(), r = radekNa(p.top + 1);
    if (r && r.top < p.top - 0.5) plocha.scrollTop -= p.top - r.top;
    aktualizujMasku();
  }
  const cisloStrany = () => {
    const v = Math.max(1, plocha.clientHeight - 20), z = Math.max(1, Math.ceil((plocha.scrollHeight - 20) / v));
    return { akt: Math.min(z, plocha.scrollTop >= plocha.scrollHeight - plocha.clientHeight - 2 ? z : Math.floor(plocha.scrollTop / v) + 1), z };
  };
  async function strana(smer) {
    const p = plocha.getBoundingClientRect(), max = plocha.scrollHeight - plocha.clientHeight;
    if (smer > 0) {
      if (plocha.scrollTop >= max - 2) { if (!$('tlDalsi').disabled) await posun(1); return; }
      const r = radekNa(p.bottom - 1);
      // další stránka začíná useknutým řádkem; když dole žádný není, celá výška bez malé rezervy
      const o = r && r.top > p.top + 20 ? (r.bottom > p.bottom + 0.5 ? r.top : r.bottom) - p.top : plocha.clientHeight - 24;
      plocha.scrollTop = Math.min(max, plocha.scrollTop + o);
    } else {
      if (plocha.scrollTop <= 2) {
        if ($('tlPred').disabled) return;
        await posun(-1);
        plocha.scrollTop = plocha.scrollHeight;   // předchozí kapitola od konce
      } else plocha.scrollTop = Math.max(0, plocha.scrollTop - plocha.clientHeight + 24);
    }
    zarovnejStranu();
  }
  // klepnutí: levá třetina zpět, jinak dál (s prodlevou – dvojklik vybírá slovo, ne list)
  let casKlepnuti = 0, prejeti = null, posledniKolecko = 0;
  plocha.addEventListener('click', e => {
    if (!nast().strankovani || e.defaultPrevented) return;
    if (e.target.closest('a, button, input, mark, figure, .dole') || !getSelection().isCollapsed || Date.now() - dotyk.konec < 700) return;
    const x = e.clientX - plocha.getBoundingClientRect().left;
    clearTimeout(casKlepnuti);
    // levá třetina zpět, pravá dál, prostředek schová / ukáže lišty (jako čtečka e-knih)
    casKlepnuti = setTimeout(() => {
      if (!getSelection().isCollapsed || !lista.hidden) return;
      const w = plocha.clientWidth;
      if (x < w / 3) strana(-1); else if (x > w * 2 / 3) strana(1); else soustredeni(undefined, true);
    }, 260);
  });
  plocha.addEventListener('dblclick', () => clearTimeout(casKlepnuti));
  plocha.addEventListener('touchstart', e => { prejeti = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : null; }, { passive: true });
  plocha.addEventListener('touchend', e => {
    if (!nast().strankovani || !prejeti || dotyk.kotva) return;
    const t = e.changedTouches[0], dx = t.clientX - prejeti.x, dy = t.clientY - prejeti.y;
    prejeti = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { clearTimeout(casKlepnuti); dotyk.konec = Date.now(); strana(dx < 0 ? 1 : -1); }
    else if (Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx) * 1.5) { dotyk.konec = Date.now(); strana(dy < 0 ? 1 : -1); }
  }, { passive: true });
  plocha.addEventListener('wheel', e => {
    if (!nast().strankovani) return;
    e.preventDefault();
    if (Date.now() - posledniKolecko < 350 || Math.abs(e.deltaY) < 4) return;
    posledniKolecko = Date.now();
    strana(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });
  addEventListener('resize', () => requestAnimationFrame(zarovnejStranu));

  /* ---------- lupa na ilustrace ---------- */
  text.addEventListener('click', e => {
    const img = e.target.closest('figure img');
    if (!img) return;
    $('lupa').querySelector('img').src = img.src;
    $('lupa').querySelector('img').alt = img.alt;
    $('lupa').hidden = false;
  });
  $('lupa').onclick = () => { $('lupa').hidden = true; };

  /* ---------- start ---------- */
  function obnovPozici() {
    const q = new URLSearchParams(location.search);
    let k = Math.min(knihy.length - 1, Math.max(0, stav.kniha | 0)), c = 0, b = 0;
    if (q.get('kniha') && knihy[q.get('kniha') - 1]) {
      k = q.get('kniha') - 1;
      const kapQ = q.get('kap');
      if (kapQ) { c = Math.max(0, knihy[k].kapitoly.findIndex(x => x.soubor === kapQ + '.md' || x.soubor === kapQ)); b = +q.get('blok') || 0; }
      else { const p = stav.pozice[knihy[k].id]; if (p) { c = Math.max(0, indexKap(knihy[k], p.soubor)); b = p.blok; } }
    } else if (typeof stav.staraKapitola === 'number') {
      c = Math.min(stav.staraKapitola, knihy[k].kapitoly.length - 1); delete stav.staraKapitola;
    } else {
      const p = stav.pozice[knihy[k].id];
      if (p && indexKap(knihy[k], p.soubor) >= 0) { c = indexKap(knihy[k], p.soubor); b = p.blok; }
    }
    return otevri(k, c, b);
  }
  pouzijNastaveni();
  const dotazUrl = new URLSearchParams(location.search);
  if (dotazUrl.has('beta')) {
    if (dotazUrl.get('email')) stav.prijemce = dotazUrl.get('email');
    if (!stav.betaNavod) {
      stav.betaNavod = true;
      Dialog.potvrd(`Vítejte u betačtení – ${DILO.nazev}.\n\nKdyž vás něco zarazí, označte v textu pár slov a vyberte barvu nebo 📝 a napište poznámku. Poznámky se ukládají jen ve vašem prohlížeči.\n\nAž budete chtít poslat poznámky autorovi, otevřete panel 📝 Poznámky (klávesa N) a klepněte na 📤 Odeslat autorovi.`, { ok: 'Rozumím', zrus: 'Zavřít' });
    }
    ulozStav(true);
  }
  if (stav.panel && matchMedia('(max-width:760px)').matches) stav.panel = null;
  await obnovPozici();
  if (stav.panel) otevriPanel(stav.panel);
  // písmo a rozložení se můžou dopočítat až po prvním vykreslení – znovu dojet na uložené místo
  addEventListener('load', () => { const p = kniha && stav.pozice[kniha.id]; if (p && p.soubor === kap().soubor && p.blok) skocNaBlok(p.blok, false); });
  window.CTECKA = window.KRONIKY_CTECKA = { otevri, skok, hledej, stav: () => stav, data: () => data, aktualniBlok, tts, zvuk, strana, vyznam, radekNa };
})();
