/* Origami – ovládání stránky (návody, papír k tisku, Sonobe, legenda). Jádro: OrigamiJadro, modely: OrigamiModely. */
(function () {
  'use strict';
  const J = window.OrigamiJadro, M = window.OrigamiModely;
  const $ = id => document.getElementById(id);
  const KLIC = 'webapp_origami_nastaveni';

  /* ---------- nastavení ---------- */
  const VYCHOZI = {
    lic: '#d9534f', rub: '#fbf8f1', pohled: 'navody', model: '',
    papir: { a: 150, okraj: 6, spad: 1.5, licTyp: 'seigaiha', licB1: '#1f4e8c', licB2: '#7fb2e5', licM: 14, oboustranne: true,
      rubTyp: 'plna', rubB1: '#fdfbf5', rubB2: '#e5ddc8', rubM: 10, otaceni: 'dlouha', model: '', cpStrana: 'rub', cpBarva: '#7a7a7a', znacky: true },
    sonobe: { teleso: '12', n: 12, a: 75, k: 3, barvy: ['#d9534f', '#f0ad4e', '#3b6fb6', '#5cb85c', '#8e5ea2', '#333333'], ryhy: true, cisla: false }
  };
  let nast = (() => {
    try {
      const u = JSON.parse(localStorage.getItem(KLIC) || '{}');
      return Object.assign({}, VYCHOZI, u, { papir: Object.assign({}, VYCHOZI.papir, u.papir), sonobe: Object.assign({}, VYCHOZI.sonobe, u.sonobe) });
    } catch (e) { return JSON.parse(JSON.stringify(VYCHOZI)); }
  })();
  const uloz = () => { try { localStorage.setItem(KLIC, JSON.stringify(nast)); } catch (e) { /* plné úložiště – nevadí */ } };
  const barvy = () => ({ lic: nast.lic, rub: nast.rub });
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* sestavy modelů se počítají líně a pamatují */
  const sestavy = {};
  const sestava = id => sestavy[id] || (sestavy[id] = J.sestav(M.MODELY.find(m => m.id === id)));
  const model = id => M.MODELY.find(m => m.id === id);
  const hvezdy = n => '★'.repeat(n) + '☆'.repeat(3 - n);
  const OBTIZNOST = ['', 'snadné', 'střední', 'náročnější'];
  const maVzor = m => m.vzor !== false;

  /* ---------- pohledy ---------- */
  function ukazPohled(p) {
    nast.pohled = p; uloz();
    for (const s of ['navody', 'papir', 'sonobe', 'legenda']) $('pohled-' + s).hidden = s !== p;
    document.querySelectorAll('[data-pohled]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pohled === p)));
    zastavAnimaci();
    if (p === 'papir') kresliPapir();
    if (p === 'sonobe') kresliSonobe();
    if (p === 'legenda') kresliLegendu();
  }

  /* ---------- katalog ---------- */
  function kresliKatalog() {
    const f = Number($('filtrObtiznost').value);
    $('katalog').innerHTML = M.MODELY.filter(m => !f || m.obtiznost === f).map(m => {
      const s = sestava(m.id);
      return `<button class="karta" data-model="${m.id}"><div class="nahl papir-plocha">${J.svgKroku(s, s.kroky.length, 0, { barvy: barvy() })}</div>
        <b>${m.emoji} ${esc(m.nazev)}</b><small><span class="hvezdy" title="${OBTIZNOST[m.obtiznost]}">${hvezdy(m.obtiznost)}</span> · ${s.kroky.length} kroků<br>${esc(m.papir)}</small></button>`;
    }).join('');
  }

  /* ---------- detail návodu ---------- */
  let akt = null, krok = 0, anim = null, n3d = null;
  function otevriModel(id) {
    const m = model(id);
    if (!m) return;
    akt = m; krok = 0; nast.model = id; uloz();
    ukazPohled('navody');
    $('katalogBlok').hidden = true; $('detailBlok').hidden = false;
    $('dNazev').textContent = `${m.emoji} ${m.nazev}`;
    $('dMeta').innerHTML = `<span class="hvezdy">${hvezdy(m.obtiznost)}</span> ${OBTIZNOST[m.obtiznost]} · ${sestava(id).kroky.length} kroků · papír: ${esc(m.papir)}`;
    $('dPopis').textContent = m.popis;
    $('tl3d').hidden = !m.nahled3d;
    if (!m.nahled3d) prepni3d(false);
    $('tlPapir').disabled = !maVzor(m);
    kresliPas();
    ukazKrok(0);
    document.querySelector('main').scrollTop = 0;
  }
  function zavriModel() {
    zastavAnimaci();
    akt = null; nast.model = ''; uloz();
    $('katalogBlok').hidden = false; $('detailBlok').hidden = true;
  }
  function kresliPas() {
    const s = sestava(akt.id);
    let h = '';
    for (let i = 0; i <= s.kroky.length; i++) h += `<button data-krok="${i}" aria-label="Krok ${i + 1}"><span>${i < s.kroky.length ? i + 1 : '✓'}</span>${J.svgKroku(s, i, 0, { barvy: barvy(), znacky: false })}</button>`;
    $('pas').innerHTML = h;
  }
  function popisKroku(s, i) {
    if (i >= s.kroky.length) return akt.hotovo || 'Hotovo.';
    const op = s.kroky[i].op;
    return op.text || (op.op === 'otoc' ? 'Otočte papír na druhou stranu.' : '');
  }
  function ukazKrok(i, t = 0) {
    const s = sestava(akt.id);
    krok = Math.max(0, Math.min(s.kroky.length, i));
    const ram = krok < s.kroky.length ? J.ramec([s.kroky[krok]]) : undefined;
    $('diagram').innerHTML = J.svgKroku(s, krok, t, { barvy: barvy(), ramec: ram });
    $('cisloKroku').textContent = krok < s.kroky.length ? `krok ${krok + 1} / ${s.kroky.length}` : 'hotovo';
    $('krokText').textContent = popisKroku(s, krok);
    $('predchozi').disabled = $('prvni').disabled = krok === 0;
    $('dalsi').disabled = krok >= s.kroky.length;
    $('animace').disabled = krok >= s.kroky.length;
    document.querySelectorAll('#pas button').forEach(b => b.setAttribute('aria-current', String(Number(b.dataset.krok) === krok)));
    const aktivni = document.querySelector('#pas button[aria-current="true"]');
    if (aktivni && aktivni.scrollIntoView && !t) aktivni.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (n3d) kresli3d(t);
  }

  /* animace přechodu krokem: t 0 → 1, pak přejde na další krok */
  function prehraj(celyPostup) {
    zastavAnimaci();
    const s = sestava(akt.id);
    if (krok >= s.kroky.length) { if (!celyPostup) return; ukazKrok(0); }
    const delka = () => {
      const k = s.kroky[krok];
      const casti = k.anim.typ === 'vice' ? k.anim.casti.length : 1;
      return (k.anim.typ === 'prolnuti' ? 900 : 1300) * Math.min(casti, 3) * ($('pomalu').checked ? 2.2 : 1);
    };
    let zacatek = null;
    const ram = () => J.ramec([s.kroky[krok]]);
    let r = ram();
    const tik = cas => {
      if (zacatek === null) zacatek = cas;
      const t = Math.min(1, (cas - zacatek) / delka());
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // plynulý rozjezd i dojezd
      $('diagram').innerHTML = J.svgKroku(s, krok, e, { barvy: barvy(), ramec: r });
      if (n3d) kresli3d(e);
      if (t < 1) { anim = requestAnimationFrame(tik); return; }
      anim = null;
      ukazKrok(krok + 1);
      if (celyPostup && krok < s.kroky.length) {
        anim = setTimeout(() => { zacatek = null; r = ram(); anim = requestAnimationFrame(tik); }, 700);
      } else $('animace').textContent = '▶ Ukázat přehyb';
    };
    anim = requestAnimationFrame(tik);
    $('animace').textContent = '⏹ Zastavit';
  }
  function zastavAnimaci() {
    if (anim !== null) { cancelAnimationFrame(anim); clearTimeout(anim); anim = null; }
    $('animace').textContent = '▶ Ukázat přehyb';
  }

  /* ---------- 3D náhled (three.js se načte až na požádání) ---------- */
  let threeSlib = null;
  function nactiSkript(src) {
    return new Promise((ok, chyba) => { const e = document.createElement('script'); e.src = src; e.onload = ok; e.onerror = () => chyba(new Error(src)); document.head.appendChild(e); });
  }
  async function prepni3d(zapnout) {
    $('tl3d').setAttribute('aria-pressed', String(zapnout));
    $('plocha3d').hidden = !zapnout;
    $('prohlizec').classList.toggle('s3d', zapnout);
    if (!zapnout) return;
    try {
      threeSlib = threeSlib || (async () => { if (!window.THREE) await nactiSkript('lib/three.r128.min.js'); await nactiSkript('origami/nahled3d.js'); })();
      await threeSlib;
      if (!n3d) n3d = window.OrigamiNahled3D.vytvor($('plocha3d'));
      kresli3d(0, true);
    } catch (e) {
      threeSlib = null;
      prepni3d(false);
      Dialog.chyba('3D náhled se nepodařilo spustit (WebGL nebo knihovna three.js).');
    }
  }
  function kresli3d(t, centruj) {
    if (!n3d || $('plocha3d').hidden || !akt) return;
    const s = sestava(akt.id);
    const k = krok < s.kroky.length ? s.kroky[krok] : { pred: s.konec, anim: null };
    if (centruj || !t) n3d.vycentruj(k.pred);
    n3d.zobraz(t >= 1 && k.po ? k.po : k.pred, J.snimek(k, t), barvy());
  }

  /* ---------- tisk návodu ---------- */
  function svgLegendy(druh) {
    if (druh === 'udoli' || druh === 'hora') return `<svg viewBox="0 0 100 30"><line x1="5" y1="15" x2="95" y2="15" stroke="#1d1d1f" stroke-width="1.6" stroke-dasharray="${J.POMLCKY[druh]}" vector-effect="non-scaling-stroke"/></svg>`;
    return '';
  }
  function tiskNavodu() {
    if (!akt) { Dialog.info('Nejdřív otevřete návod některého modelu.'); return; }
    const s = sestava(akt.id);
    let kroky = '';
    for (let i = 0; i <= s.kroky.length; i++) {
      kroky += `<div class="krok">${J.svgKroku(s, i, 0, { barvy: barvy() })}<p><b>${i < s.kroky.length ? i + 1 : '✓'}.</b> ${esc(popisKroku(s, i))}</p></div>`;
    }
    $('tisk').innerHTML = `<div class="navod"><h1>${akt.emoji} ${esc(akt.nazev)}</h1>
      <p class="meta">Obtížnost: ${hvezdy(akt.obtiznost)} ${OBTIZNOST[akt.obtiznost]} · Papír: ${esc(akt.papir)} · ${esc(akt.popis)}</p>
      <div class="kroky">${kroky}</div>
      <div class="legenda-tisk"><span>${svgLegendy('udoli')} údolní přehyb</span><span>${svgLegendy('hora')} horský přehyb</span><span>tenká čára = existující rýha</span></div></div>`;
    window.print();
  }

  /* ---------- papír k tisku ---------- */
  const fP = $('formPapir');
  function naplnFormular(f, data) {
    for (const el of f.elements) {
      if (!el.name || !(el.name in data)) continue;
      if (el.type === 'checkbox') el.checked = !!data[el.name]; else el.value = data[el.name];
    }
  }
  function ctiFormular(f, data) {
    for (const el of f.elements) {
      if (!el.name || !(el.name in data)) continue;
      data[el.name] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
    }
  }
  function volbyPapiru(strana) {
    const p = nast.papir;
    const a = Math.max(20, Math.min(J.maxCtverec(p.okraj), Number(p.a) || 150));
    const v = { a, okraj: p.okraj, mezera: 4, spad: p.spad, strana, otaceni: p.otaceni, znacky: p.znacky,
      vzorLic: { typ: p.licTyp, b1: p.licB1, b2: p.licB2, m: p.licM }, vzorRub: { typ: p.rubTyp, b1: p.rubB1, b2: p.rubB2, m: p.rubM } };
    if (p.model && model(p.model)) {
      const s = sestava(p.model), list = s.konec.listy[0];
      const pohled = p.cpStrana === 'rub' ? 'rub' : 'lic';
      v.cp = { vzor: J.vzorPrehybu(s, pohled, 0, p.otaceni === 'kratka' ? 'y' : 'x'), list, strana: pohled, barva: p.cpBarva };
    }
    return v;
  }
  function kresliPapir() {
    const p = nast.papir;
    const lic = J.stranaPapiru(volbyPapiru('lic'));
    let h = `<figure><figcaption>Líc (1. strana)</figcaption><div class="stranka">${lic.svg}</div></figure>`;
    if (p.oboustranne) h += `<figure><figcaption>Rub (2. strana, zrcadlově)</figcaption><div class="stranka">${J.stranaPapiru(volbyPapiru('rub')).svg}</div></figure>`;
    $('nahledPapir').innerHTML = h;
    const a = volbyPapiru('lic').a;
    const m = p.model && model(p.model);
    $('souhrnPapir').innerHTML = lic.pocet ? `Na jeden list A4 se vejde <b>${lic.pocet}</b> ${lic.pocet === 1 ? 'čtverec' : lic.pocet < 5 ? 'čtverce' : 'čtverců'} o straně <b>${a} mm</b>.` +
      (m ? ` Předkreslené přehyby: <b>${esc(m.nazev)}</b> (${p.cpStrana === 'rub' ? 'na rubu' : 'na lícu'}).` : '') +
      (m && m.listy[0].w !== m.listy[0].h ? ' <i>Model se skládá z obdélníku – vzor je vložen do čtverce, papír po vytištění ořízněte podle čar.</i>' : '')
      : 'Čtverec se při zadaném okraji na A4 nevejde – zmenšete ho.';
  }
  function tiskPapiru() {
    const p = nast.papir;
    let h = `<div class="list-a4">${J.stranaPapiru(volbyPapiru('lic')).svg}</div>`;
    if (p.oboustranne) h += `<div class="list-a4">${J.stranaPapiru(volbyPapiru('rub')).svg}</div>`;
    $('tisk').innerHTML = h;
    window.print();
  }
  function stahniSvg() {
    const svg = J.stranaPapiru(volbyPapiru('lic')).svg;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    a.download = `origami_papir_${nast.papir.a}mm.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ---------- Sonobe ---------- */
  const fS = $('formSonobe');
  function stranySonobe() {
    const o = nast.sonobe, k = Math.max(1, Math.min(6, o.k | 0)), n = Math.max(1, Math.min(300, o.n | 0));
    const a = Math.max(30, Math.min(J.maxCtverec(6), o.a | 0));
    const pocty = J.rozdelBarvy(n, k);
    const barvyCtv = [], popisky = [];
    pocty.forEach((c, b) => { for (let i = 0; i < c; i++) { barvyCtv.push(o.barvy[b]); popisky.push(`${barvyCtv.length}`); } });
    const naStranu = J.rozvrzeni(a, 6, 4).pozice.length;
    const stranky = [];
    const s = sestava('sonobe');
    for (let od = 0; od < n; od += naStranu) {
      const kus = barvyCtv.slice(od, od + naStranu);
      const v = { a, okraj: 6, mezera: 4, spad: 1, strana: 'lic', znacky: true, pocet: kus.length, barvy: kus, popisky: o.cisla ? popisky.slice(od, od + naStranu) : null,
        vzorLic: { typ: 'plna', b1: kus[0] }, vzorRub: { typ: 'plna', b1: '#ffffff' } };
      const st = [J.stranaPapiru(v).svg];
      if (o.ryhy) st.push(J.stranaPapiru(Object.assign({}, v, { strana: 'rub', otaceni: 'dlouha', cp: { vzor: J.vzorPrehybu(s, 'rub'), list: s.konec.listy[0], strana: 'rub', barva: '#888' } })).svg);
      stranky.push(st);
    }
    return { stranky, pocty, a, n, naStranu };
  }
  function kresliSonobe() {
    const o = nast.sonobe;
    $('barvyModulu').innerHTML = Array.from({ length: Math.max(1, Math.min(6, o.k | 0)) }, (_, i) => `<input type="color" data-barva="${i}" value="${o.barvy[i]}" aria-label="Barva ${i + 1}">`).join('');
    const r = stranySonobe();
    $('souhrnSonobe').innerHTML = `<b>${r.n}</b> modulů ze čtverců <b>${r.a} mm</b>, ${r.naStranu} na list → <b>${r.stranky.length}</b> ${r.stranky.length === 1 ? 'list' : r.stranky.length < 5 ? 'listy' : 'listů'} A4` +
      `${o.ryhy ? ' (každý oboustranně – rýhy na rubu)' : ''}. Barvy: ` + r.pocty.map((c, i) => `<span style="display:inline-block;width:.9em;height:.9em;border-radius:3px;vertical-align:-2px;border:1px solid var(--border);background:${o.barvy[i]}"></span> ${c}×`).join(', ');
    $('nahledSonobe').innerHTML = r.stranky.slice(0, 2).map((st, i) => `<figure><figcaption>List ${i + 1}</figcaption><div class="stranka">${st[0]}</div></figure>`).join('') +
      (r.stranky.length > 2 ? `<p class="tip">… a dalších ${r.stranky.length - 2} listů.</p>` : '');
  }
  function tiskSonobe() {
    $('tisk').innerHTML = stranySonobe().stranky.flat().map(svg => `<div class="list-a4">${svg}</div>`).join('');
    window.print();
  }

  /* ---------- legenda ---------- */
  function kresliLegendu() {
    if ($('legenda').innerHTML) return;
    const ram = 'viewBox="0 0 110 70"';
    const cara = d => `<line x1="8" y1="35" x2="102" y2="35" stroke="#fff" stroke-width="3.4"/><line x1="8" y1="35" x2="102" y2="35" stroke="#1d1d1f" stroke-width="1.6" stroke-dasharray="${J.POMLCKY[d]}"/>`;
    const pol = (x) => `<rect x="${x}" y="10" width="40" height="50" fill="${nast.lic}" stroke="#1d1d1f"/>`;
    const sipkaTyp = typ => J.sipka([25, 45], [85, 45], 6, typ, 0.6).replace(/ vector-effect="non-scaling-stroke"/g, '');
    const P = [
      [cara('udoli'), 'Údolní přehyb', 'Čárkovaná čára – papír se ohne k vám, vznikne „údolí“.'],
      [cara('hora'), 'Horský přehyb', 'Čerchovaná čára (čárka-tečka-tečka) – papír se ohne od vás, dozadu.'],
      [`<line x1="8" y1="35" x2="102" y2="35" stroke="#8c8c8c" stroke-width="0.8"/>`, 'Rýha', 'Tenká čára – přehyb, který už byl udělán a rozložen.'],
      [sipkaTyp('udoli'), 'Přehnout sem', 'Plná šipka – směr údolního přehybu (k vám).'],
      [sipkaTyp('hora'), 'Přehnout dozadu', 'Šipka s otevřeným hrotem – horský přehyb, díl jde za papír.'],
      [sipkaTyp('rozlozit'), 'Přehnout a rozložit', 'Hrot na obou koncích – přehněte, ostře uhlaďte a vraťte zpět.'],
      [J.symbolOtoceni(55, 30, 22).replace(/ vector-effect="non-scaling-stroke"/g, ''), 'Otočit papír', 'Celý model obraťte na druhou stranu.'],
      [J.sipkaRovna([12, 35], [70, 35], 9).replace(/ vector-effect="non-scaling-stroke"/g, ''), 'Zatlačit / rozevřít', 'Dutá šipka – zatlačte dovnitř nebo rozevřete a zploštěte (obrácený přehyb, sklad).'],
      [pol(10) + `<rect x="60" y="10" width="40" height="50" fill="${nast.rub}" stroke="#1d1d1f"/>`, 'Líc a rub', 'Barevná a bílá strana papíru – barvy změníte v liště.']
    ];
    $('legenda').innerHTML = P.map(([g, n, t]) => `<figure><svg ${ram}>${g}</svg><figcaption><b>${n}</b>${t}</figcaption></figure>`).join('');
  }

  /* ---------- nabídky a události ---------- */
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
  const PRIKAZY = {
    napoveda: () => $('dlgNapoveda').showModal(),
    tiskNavodu, tiskPapiru, tiskSonobe, svgPapiru: stahniSvg
  };
  document.addEventListener('click', e => {
    const p = e.target.closest('[data-prikaz]');
    if (p) { e.stopPropagation(); zavriNabidky(); return PRIKAZY[p.dataset.prikaz](); }
    if (!e.target.closest('.nabidka')) zavriNabidky();
    const pv = e.target.closest('[data-pohled]');
    if (pv) return ukazPohled(pv.dataset.pohled);
    const mo = e.target.closest('[data-model]');
    if (mo) { e.preventDefault(); return otevriModel(mo.dataset.model); }
    const kr = e.target.closest('[data-krok]');
    if (kr) { zastavAnimaci(); return ukazKrok(Number(kr.dataset.krok)); }
  });
  $('zpet').addEventListener('click', zavriModel);
  $('prvni').addEventListener('click', () => { zastavAnimaci(); ukazKrok(0); });
  $('predchozi').addEventListener('click', () => { zastavAnimaci(); ukazKrok(krok - 1); });
  $('dalsi').addEventListener('click', () => { zastavAnimaci(); ukazKrok(krok + 1); });
  $('animace').addEventListener('click', () => { if (anim !== null) { zastavAnimaci(); ukazKrok(krok); } else prehraj(false); });
  $('vse').addEventListener('click', () => prehraj(true));
  $('tl3d').addEventListener('click', () => prepni3d($('tl3d').getAttribute('aria-pressed') !== 'true'));
  $('tlPapir').addEventListener('click', () => { nast.papir.model = akt.id; naplnFormular(fP, nast.papir); ukazPohled('papir'); });
  $('filtrObtiznost').addEventListener('change', kresliKatalog);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') zavriNabidky();
    if ($('detailBlok').hidden || $('pohled-navody').hidden || e.target.closest('input,select,textarea') || document.querySelector('dialog[open]')) return;
    if (e.key === 'ArrowRight') { zastavAnimaci(); ukazKrok(krok + 1); }
    else if (e.key === 'ArrowLeft') { zastavAnimaci(); ukazKrok(krok - 1); }
    else if (e.key === ' ') { e.preventDefault(); $('animace').click(); }
  });
  addEventListener('resize', zavriNabidky);

  function zmenaBarev() {
    nast.lic = $('barvaLic').value; nast.rub = $('barvaRub').value; uloz();
    kresliKatalog();
    $('legenda').innerHTML = '';
    if (!$('pohled-legenda').hidden) kresliLegendu();
    if (akt) { kresliPas(); ukazKrok(krok); }
  }
  $('barvaLic').addEventListener('input', zmenaBarev);
  $('barvaRub').addEventListener('input', zmenaBarev);

  fP.addEventListener('input', e => {
    if (e.target.name === 'predvolba') {
      if (e.target.value) fP.a.value = e.target.value === 'max' ? J.maxCtverec(Number(fP.okraj.value) || 0) : e.target.value;
      e.target.value = '';
    }
    ctiFormular(fP, nast.papir); uloz(); kresliPapir();
  });
  fS.addEventListener('input', e => {
    if (e.target.dataset.barva !== undefined) { nast.sonobe.barvy[Number(e.target.dataset.barva)] = e.target.value; uloz(); kresliSonobe(); return; }
    if (e.target.name === 'teleso' && e.target.value) {
      const t = J.SONOBE.find(x => String(x.n) === e.target.value);
      if (t) { fS.n.value = t.n; fS.k.value = t.barev; }
    }
    if (e.target.name === 'n') fS.teleso.value = J.SONOBE.some(x => String(x.n) === fS.n.value) ? fS.n.value : '';
    ctiFormular(fS, nast.sonobe); uloz(); kresliSonobe();
  });

  /* ---------- start ---------- */
  const moznosti = J.VZORY.map(v => `<option value="${v.id}">${v.nazev}</option>`).join('');
  fP.licTyp.innerHTML = moznosti; fP.rubTyp.innerHTML = moznosti;
  fP.model.innerHTML += M.MODELY.filter(maVzor).map(m => `<option value="${m.id}">${m.emoji} ${esc(m.nazev)}</option>`).join('');
  fS.teleso.innerHTML = J.SONOBE.map(t => `<option value="${t.n}">${t.nazev}</option>`).join('') + '<option value="">vlastní počet</option>';
  naplnFormular(fP, nast.papir);
  naplnFormular(fS, nast.sonobe);
  $('barvaLic').value = nast.lic; $('barvaRub').value = nast.rub;
  kresliKatalog();
  if (nast.model && model(nast.model) && nast.pohled === 'navody') otevriModel(nast.model);
  else ukazPohled(nast.pohled || 'navody');
  window.ORIGAMI_APP = { otevriModel, ukazKrok, ukazPohled, prepni3d, nast: () => nast, prehraj };
})();
