/* ============================================================
   Intarzie a parketáž – ovládání stránky
   ============================================================ */
(function () {
  'use strict';
  const J = window.INTJ, V = window.INTV, N = window.INTN, P = window.INTP;
  const $ = (id) => document.getElementById(id);
  const fmt = J.fmt;
  const KLIC = 'webapp_intarzie', KLIC_PROJ = 'webapp_intarzie_projekty';
  const toast = (t, chyba) => { try { chyba ? Dialog.chyba(t) : Dialog.info(t); } catch (e) { console.log(t); } };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* ---------- ukázkový motiv marketerie (vlastní kresba) ---------- */
  const UKAZKA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160">
<ellipse cx="120" cy="80" rx="112" ry="74" fill="#5a3d28"/>
<ellipse cx="120" cy="80" rx="105" ry="67" fill="#efe0bd"/>
<path d="M118 142C116 112 122 86 119 62L123 62C126 86 121 112 124 142Z" fill="#4f7a4f"/>
<path d="M119 120C95 114 78 98 70 80C92 84 110 98 120 113Z" fill="#5c8660"/>
<path d="M123 106C146 102 160 88 170 70C148 72 132 86 123 99Z" fill="#5c8660"/>
<path d="M121 68C99 64 92 42 99 21C110 33 116 44 121 51Z" fill="#c4532e"/>
<path d="M121 68C143 64 150 42 143 21C132 33 126 44 121 51Z" fill="#c4532e"/>
<path d="M121 66C110 54 111 35 121 17C131 35 132 54 121 66Z" fill="#8f3519"/>
<circle cx="58" cy="52" r="9" fill="#d6bf6d"/><circle cx="184" cy="116" r="7" fill="#d6bf6d"/>
<path d="M40 118Q60 104 82 122Q60 132 40 118Z" fill="#5c8660"/>
</svg>`;

  /* ---------- výchozí stav ---------- */
  const VYCHOZI = () => ({
    vzor: 'rybi_kost', par: {}, alfa: {}, posun: {}, prirazeni: {}, otoceni: {}, upravy: {},
    deska: { sirka: 900, vyska: 600, bordura: 40, linka: 3 },
    sloty: [{ drevina: 'dub', listD: 1000, listS: 220 }, { drevina: 'orech', listD: 1000, listS: 220 }, { drevina: 'javor', listD: 1000, listS: 220 }, { drevina: 'wenge', listD: 1000, listS: 200 }],
    shoda: 'slip', kerf: 0.15, rozestup: 2, okrajListu: 5, rezerva: 15, typ3d: 'deska', svgNazev: '', nazev: '',
  });
  const PREDVOLBY = [
    ['Stolní deska – rybí kost (dub / ořech)', { vzor: 'rybi_kost', deska: { sirka: 900, vyska: 600, bordura: 40, linka: 3 }, sloty: [['dub'], ['orech'], ['javor']], par: { L: 90, W: 22, n: 1 }, alfa: 45, shoda: 'slip', typ3d: 'deska' }],
    ['Šachovnice 8 × 8, pole 50 mm', { vzor: 'sachovnice', deska: { sirka: 460, vyska: 460, bordura: 30, linka: 0 }, sloty: [['javor'], ['orech'], ['javor'], ['tresen']], par: { s: 50 }, alfa: 0, posun: [0, 0], shoda: 'slip', typ3d: 'deska', prirazeni: [0, 1, 2, 3] }],
    ['Víko krabičky – kompasová růžice 16', { vzor: 'kompas', deska: { sirka: 240, vyska: 240, bordura: 14, linka: 2 }, sloty: [['javor'], ['orech'], ['tresen'], ['makassar']], par: { n: 16, D: 180, rv: 0.2, p2: 0.72, p3: 0.48, r: 6 }, alfa: 0, shoda: 'bookmatch', typ3d: 'krabicka', prirazeni: [0, 1, 2, 3, 2, 0, 3] }],
    ['Podnos – kostky (tumbling blocks)', { vzor: 'kostky', deska: { sirka: 450, vyska: 320, bordura: 25, linka: 2 }, sloty: [['javor'], ['tresen'], ['orech'], ['wenge']], par: { a: 25 }, alfa: 0, shoda: 'slip', typ3d: 'deska', prirazeni: [0, 1, 2, 0, 3] }],
    ['Dvířka – francouzská rybí kost', { vzor: 'francouzska', deska: { sirka: 400, vyska: 700, bordura: 30, linka: 2 }, sloty: [['dub'], ['dub'], ['orech'], ['javor']], par: { a: 60, w: 18, u: 45 }, alfa: 90, shoda: 'bookmatch', typ3d: 'deska', prirazeni: [0, 1, 3, 2] }],
    ['Koš (basket weave)', { vzor: 'kos', deska: { sirka: 500, vyska: 500, bordura: 30, linka: 0 }, sloty: [['jasan'], ['tresen'], ['orech']], par: { w: 15, n: 3 }, alfa: 0, shoda: 'slip', typ3d: 'deska', prirazeni: [0, 1, 0, 2] }],
    ['Versailles 3 × 3 panely', { vzor: 'versailles', deska: { sirka: 600, vyska: 600, bordura: 0, linka: 0 }, sloty: [['dub'], ['orech'], ['jasan'], ['wenge']], par: { P: 200, f: 20, m: 3, s: 10 }, alfa: 0, posun: [0, 0], shoda: 'slip', typ3d: 'deska', prirazeni: [1, 0, 2, 3, 0, 1] }],
    ['Hexagony ze tří dřevin', { vzor: 'hexagony', deska: { sirka: 400, vyska: 400, bordura: 20, linka: 0 }, sloty: [['javor'], ['tresen'], ['orech']], par: { a: 22 }, alfa: 0, shoda: 'nahodne', typ3d: 'krabicka', prirazeni: [0, 1, 2, 0, 2] }],
    ['Escherovská teselace p4', { vzor: 'escher', deska: { sirka: 420, vyska: 420, bordura: 20, linka: 2 }, sloty: [['javor'], ['orech'], ['sapeli']], par: { typ: 'rotace', s: 70 }, alfa: 0, shoda: 'souvisle', typ3d: 'deska', prirazeni: [0, 1, 0, 1, 0, 2] }],
    ['Marketerie – ukázkový motiv', { vzor: 'marketerie', deska: { sirka: 300, vyska: 220, bordura: 16, linka: 2 }, sloty: [['javor']], par: { okraj: 10 }, shoda: 'souvisle', typ3d: 'krabicka', ukazka: true }],
  ];

  let stav = VYCHOZI(), S = null, plan = null, tvarySvg = null, svgText = '';
  function nacti() { try { const s = JSON.parse(localStorage.getItem(KLIC) || 'null'); if (s && s.deska && s.sloty) stav = Object.assign(VYCHOZI(), s); } catch (e) { /* bez úložiště */ } }
  let casUlozeni = 0;
  function uloz() { clearTimeout(casUlozeni); casUlozeni = setTimeout(() => { try { localStorage.setItem(KLIC, JSON.stringify(stav)); } catch (e) { /* plné / zakázané */ } }, 300); }

  /* ---------- IndexedDB pro SVG motiv ---------- */
  function idb() { return new Promise((ok, chyba) => { try { const r = indexedDB.open('webapp_intarzie', 1); r.onupgradeneeded = () => r.result.createObjectStore('data'); r.onsuccess = () => ok(r.result); r.onerror = () => chyba(r.error); } catch (e) { chyba(e); } }); }
  async function idbUloz(k, v) { try { const db = await idb(); await new Promise((ok, ch) => { const t = db.transaction('data', 'readwrite'); t.objectStore('data').put(v, k); t.oncomplete = ok; t.onerror = () => ch(t.error); }); db.close(); } catch (e) { /* bez IDB */ } }
  async function idbNacti(k) { try { const db = await idb(); const v = await new Promise((ok, ch) => { const r = db.transaction('data').objectStore('data').get(k); r.onsuccess = () => ok(r.result); r.onerror = () => ch(r.error); }); db.close(); return v; } catch (e) { return null; } }

  /* ---------- SVG → tvary (DOM) ---------- */
  function naD(el) {
    const a = (n) => parseFloat(el.getAttribute(n)) || 0;
    switch (el.nodeName.toLowerCase()) {
      case 'path': return el.getAttribute('d');
      case 'rect': { const x = a('x'), y = a('y'), w = a('width'), h = a('height'); return w > 0 && h > 0 ? `M${x} ${y}H${x + w}V${y + h}H${x}Z` : null; }
      case 'circle': { const cx = a('cx'), cy = a('cy'), r = a('r'); return r > 0 ? `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z` : null; }
      case 'ellipse': { const cx = a('cx'), cy = a('cy'), rx = a('rx'), ry = a('ry'); return rx > 0 && ry > 0 ? `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z` : null; }
      case 'polygon': case 'polyline': { const p = (el.getAttribute('points') || '').trim(); return p ? 'M' + p + 'Z' : null; }
    }
    return null;
  }
  function parsujSvg(text) {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const kor = doc.documentElement;
    if (!kor || kor.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) throw new Error('Soubor není platné SVG.');
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:-20000px;top:0;width:400px;height:400px;overflow:hidden;opacity:0;pointer-events:none';
    const svg = document.importNode(kor, true);
    svg.querySelectorAll('script,foreignObject,image').forEach((e) => e.remove());
    host.appendChild(svg); document.body.appendChild(host);
    try {
      let vel = 100; try { const b = svg.getBBox(); vel = Math.max(b.width, b.height) || 100; } catch (e) { /* prázdné */ }
      const tol = vel / 1500, tvary = [];
      for (const el of svg.querySelectorAll('path,rect,circle,ellipse,polygon,polyline')) {
        if (el.closest('defs,clipPath,mask,symbol,pattern,marker')) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        let fill = cs.fill;
        if (!fill || fill === 'none') continue;
        if (fill.startsWith('url')) { const st = svg.querySelector((fill.match(/#[^)"']+/) || ['#x'])[0] + ' stop'); fill = st ? (getComputedStyle(st).stopColor || '#999999') : '#999999'; }
        if (parseFloat(cs.fillOpacity) === 0) continue;
        const d = naD(el); if (!d) continue;
        const M = el.getCTM() || { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
        const kr = J.cestaNaKruhy(d, tol).map((r) => r.map((p) => [M.a * p[0] + M.c * p[1] + M.e, M.b * p[0] + M.d * p[1] + M.f]));
        const c = J.hexRgb(fill); if (!c || !kr.length) continue;
        tvary.push({ barva: J.rgbHex(c), kruhy: kr, pravidlo: cs.fillRule === 'evenodd' ? 'evenodd' : 'nonzero' });
      }
      return tvary;
    } finally { host.remove(); }
  }
  /** po načtení motivu: dřeviny podle barev (doplní chybějící dřeviny) */
  function priradBarvy() {
    const p = Object.assign(J.vychoziPar('marketerie'), stav.par.marketerie || {});
    const D = stav.deska, b = (+D.bordura || 0) + (+D.linka || 0);
    const m = J.marketerie(tvarySvg || [], [b, b, D.sirka - b, D.vyska - b], p);
    const pr = [];
    m.barvy.forEach((c) => {
      const dr = J.nejblizsiDrevina(c || '#d6b98c');
      let i = stav.sloty.findIndex((s) => s.drevina === dr);
      if (i < 0 && stav.sloty.length < 10) { stav.sloty.push({ drevina: dr, listD: J.LIST_TYPICKY.delka, listS: J.LIST_TYPICKY.sirka }); i = stav.sloty.length - 1; }
      pr.push(Math.max(0, i));
    });
    pr.push(pr[0] || 0, stav.sloty.findIndex((s) => s.drevina === 'orech') >= 0 ? stav.sloty.findIndex((s) => s.drevina === 'orech') : 0);
    stav.prirazeni.marketerie = pr; stav.otoceni.marketerie = []; stav.upravy.marketerie = {};
  }
  async function nastavSvg(text, nazev, prirad) {
    tvarySvg = parsujSvg(text); svgText = text; stav.svgNazev = nazev || '';
    if (prirad) priradBarvy();
    idbUloz('svg', { text, nazev: stav.svgNazev });
    $('infoSvg').innerHTML = `Motiv <b>${esc(nazev || 'bez názvu')}</b>: ${tvarySvg.length} vyplněných tvarů. Každá barva = jedna dřevina, pozdější tvar překrývá dřívější, zbytek pole je podklad.`;
  }

  /* ---------- pomocné ---------- */
  const V_ = () => J.VZORY[stav.vzor];
  const parVzoru = () => Object.assign(J.vychoziPar(stav.vzor), stav.par[stav.vzor] || {});
  const alfa = () => (stav.alfa[stav.vzor] != null ? stav.alfa[stav.vzor] : V_().alfa);
  function prirazeni(G) {
    const pr = (stav.prirazeni[stav.vzor] || []).slice(), vs = V_().sloty || [], n = stav.sloty.length;
    for (let i = 0; i < G + 2; i++) if (pr[i] == null) pr[i] = i < G ? (vs[i] != null ? vs[i] : i % n) : (i === G ? 2 : 1);
    return pr.map((x) => Math.max(0, Math.min(n - 1, x)));
  }
  function stavProJadro() {
    return { vzor: stav.vzor, par: parVzoru(), deska: stav.deska, alfa: alfa(), posun: stav.posun[stav.vzor] || [0, 0], sloty: stav.sloty,
      prirazeni: stav.vzor === 'marketerie' ? (stav.prirazeni.marketerie || []).map((x) => Math.max(0, Math.min(stav.sloty.length - 1, x))) : prirazeni(V_().skupiny.length),
      otoceni: stav.otoceni[stav.vzor] || [], upravy: stav.upravy[stav.vzor] || {}, shoda: stav.shoda, tvary: tvarySvg || [] };
  }
  const drevina = (slot) => J.DREVINY[(stav.sloty[slot] || {}).drevina] || J.DREVINY.javor;

  /* ---------- ikony vzorů ---------- */
  const IK = {
    rybi_kost: '<g fill="#c99a63" stroke="currentColor" stroke-width=".6"><path d="M4 18l10-10 4 4-10 10z"/><path d="M18 12l10 10-4 4-10-10z" fill="#6a4630"/><path d="M18 4l10 10-4 4L14 8z" fill="#6a4630"/><path d="M28 14l-10 10 4 4 10-10z"/></g>',
    francouzska: '<g stroke="currentColor" stroke-width=".6"><path d="M4 10l14-6v6L4 16z" fill="#c99a63"/><path d="M18 4l14 6v6l-14-6z" fill="#6a4630"/><path d="M4 18l14-6v6L4 24z" fill="#c99a63"/><path d="M18 12l14 6v6l-14-6z" fill="#6a4630"/></g>',
    sachovnice: '<g stroke="currentColor" stroke-width=".5">' + [0, 1, 2, 3].map((i) => [0, 1, 2].map((j) => `<rect x="${4 + i * 8}" y="${2 + j * 8}" width="8" height="8" fill="${(i + j) % 2 ? '#5a3d28' : '#ecd9b0'}"/>`).join('')).join('') + '</g>',
    kos: '<g stroke="currentColor" stroke-width=".5"><path d="M4 2h12v4H4zM4 6h12v4H4zM4 10h12v4H4z" fill="#d9b27c"/><path d="M16 2h4v12h-4zM20 2h4v12h-4zM24 2h4v12h-4z" fill="#8a5a3a"/><path d="M4 14h4v12H4zM8 14h4v12H8zM12 14h4v12h-4z" fill="#8a5a3a"/><path d="M16 14h12v4H16zM16 18h12v4H16zM16 22h12v4H16z" fill="#d9b27c"/></g>',
    versailles: '<g stroke="currentColor" stroke-width=".5"><rect x="5" y="2" width="26" height="24" fill="#6a4630"/><rect x="9" y="6" width="18" height="16" fill="#d9b27c"/><path d="M9 6l18 16M27 6L9 22" stroke="#3b2a1c" stroke-width="2.4"/></g>',
    hexagony: '<g stroke="currentColor" stroke-width=".5"><path d="M10 4l6 3.5v7L10 18l-6-3.5v-7z" fill="#ecd9b0"/><path d="M22 4l6 3.5v7L22 18l-6-3.5v-7z" fill="#a8683e"/><path d="M16 14.5l6 3.5v7l-6 3.5-6-3.5v-7z" fill="#5a3d28"/></g>',
    kostky: '<g stroke="currentColor" stroke-width=".5"><path d="M18 3l10 6-10 6-10-6z" fill="#ecd9b0"/><path d="M8 9l10 6v12L8 21z" fill="#a8683e"/><path d="M28 9l-10 6v12l10-6z" fill="#4a3022"/></g>',
    kompas: '<g stroke="currentColor" stroke-width=".4"><circle cx="18" cy="14" r="12" fill="#a8683e"/><path d="M18 2l3 9-3 3zM30 14l-9 3-3-3zM18 26l-3-9 3-3zM6 14l9-3 3 3z" fill="#ecd9b0"/><path d="M18 2l-3 9 3 3zM30 14l-9-3-3 3zM18 26l3-9-3-3zM6 14l9 3 3-3z" fill="#3b2a1c"/></g>',
    escher: '<g stroke="currentColor" stroke-width=".5"><path d="M4 4q6 4 12 0q-2 6 2 12q-6-2-12 2q2-6-2-14z" fill="#ecd9b0"/><path d="M16 4q6-4 12 2q-4 6 0 10q-6 2-10 0q-4-6-2-12z" fill="#5a3d28"/><path d="M6 18q6-4 12-2q-2 6 2 10q-6 2-12-2q2-2-2-6z" fill="#5a3d28"/><path d="M20 16q4 2 8 0q0 6 2 10q-6 0-10-2q2-4 0-8z" fill="#ecd9b0"/></g>',
    marketerie: '<g stroke="currentColor" stroke-width=".5"><ellipse cx="18" cy="14" rx="14" ry="12" fill="#ecd9b0"/><path d="M18 26c-1-5 0-9 0-12" stroke="#4f7a4f" stroke-width="1.6" fill="none"/><path d="M18 14c-4-1-6-5-5-9 2 2 4 4 5 6 1-2 3-4 5-6 1 4-1 8-5 9z" fill="#c4532e"/><path d="M18 21c-4-1-6-3-8-6 4 0 6 2 8 4z" fill="#5c8660"/></g>',
  };

  /* ---------- tvorba ovládání ---------- */
  function postavTypy() {
    const el = $('typy'); el.innerHTML = '';
    J.PORADI_VZORU.forEach((id, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.vzor = id;
      b.title = `${J.VZORY[id].nazev} (${J.VZORY[id].en}) – klávesa ${(i + 1) % 10}`;
      b.innerHTML = `<svg viewBox="0 0 36 28" aria-hidden="true">${IK[id]}</svg>${J.VZORY[id].nazev.replace(' (basket weave)', '').replace(' (tumbling blocks)', '').replace(' (zjednodušeně)', '').replace('Escherovská teselace', 'Escher').replace('Francouzská rybí kost', 'Franc. rybí kost').replace('Kompasová růžice', 'Růžice')}`;
      b.addEventListener('click', () => zvolVzor(id));
      el.appendChild(b);
    });
  }
  function zvolVzor(id) {
    if (!J.VZORY[id]) return;
    stav.vzor = id;
    if (id === 'marketerie' && !tvarySvg) { nastavSvg(UKAZKA_SVG, 'ukázkový motiv (tulipán)', !stav.prirazeni.marketerie).then(() => { naplnFormular(); prepocti(); }).catch((e) => toast(e.message, true)); }
    vyber(null); naplnFormular(); prepocti();
  }
  function postavParametry() {
    const el = $('parVzoru'); el.innerHTML = '';
    const p = parVzoru();
    const vzor = V_();
    const mrizka = vzor.par.filter((q) => !(stav.vzor === 'kompas' && q[0] === 'p3' && +p.n !== 16));
    const box = document.createElement('div'); box.className = 'r2';
    for (const q of mrizka) {
      const [k, pop, mn, mx, kr, , volby] = q;
      const d = document.createElement('div');
      if (volby) d.innerHTML = `<label for="p_${k}">${esc(pop)}</label><select id="p_${k}">${volby.map(([v, t]) => `<option value="${v}"${String(p[k]) === String(v) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
      else d.innerHTML = `<label for="p_${k}">${esc(pop)}</label><input id="p_${k}" type="number" min="${mn}" max="${mx}" step="${kr}" value="${p[k]}">`;
      box.appendChild(d);
      const inp = d.querySelector('input,select');
      inp.addEventListener(volby ? 'change' : 'input', () => {
        const v = volby ? (isNaN(+inp.value) ? inp.value : +inp.value) : +inp.value;
        if (!volby && (!Number.isFinite(v) || v < mn || v > mx)) return;
        stav.par[stav.vzor] = Object.assign(parVzoru(), { [k]: v });
        if (k === 'n' && stav.vzor === 'kompas') postavParametry();
        naplanuj();
      });
    }
    el.appendChild(box);
    const jeMrizka = !vzor.vlastni;
    $('blokMrizka').classList.toggle('skryte', stav.vzor === 'marketerie');
    $('blokPosun').classList.toggle('skryte', !jeMrizka);
    $('blokSvg').classList.toggle('skryte', stav.vzor !== 'marketerie');
  }
  function postavSloty() {
    const el = $('sloty'); el.innerHTML = '';
    const volby = Object.entries(J.DREVINY).map(([k, d]) => `<option value="${k}">${esc(d.nazev)}</option>`).join('');
    stav.sloty.forEach((s, i) => {
      const r = document.createElement('div'); r.className = 'slot';
      const dr = J.DREVINY[s.drevina] || J.DREVINY.javor;
      r.innerHTML = `<b>${J.PISMENA[i]}</b><span class="vzorek" style="background:linear-gradient(180deg,${dr.sv},${dr.tm} 45%,${dr.sv} 70%,${dr.tm})"></span>
        <select aria-label="Dřevina ${J.PISMENA[i]}">${volby}</select>
        <input type="number" min="50" max="6000" step="10" value="${s.listD || J.LIST_TYPICKY.delka}" aria-label="Délka listu ${J.PISMENA[i]} (mm)" title="délka listu podél vláken (mm)">
        <input type="number" min="20" max="2000" step="5" value="${s.listS || J.LIST_TYPICKY.sirka}" aria-label="Šířka listu ${J.PISMENA[i]} (mm)" title="šířka listu (mm)">
        <button type="button" title="odebrat dřevinu" aria-label="Odebrat dřevinu ${J.PISMENA[i]}"${stav.sloty.length < 2 ? ' disabled' : ''}>✕</button>`;
      const [sel, d, w] = r.querySelectorAll('select,input');
      sel.value = s.drevina;
      sel.addEventListener('change', () => { s.drevina = sel.value; postavSloty(); postavSkupiny(); naplanuj(); });
      d.addEventListener('input', () => { if (+d.value >= 50) { s.listD = +d.value; naplanuj(); } });
      w.addEventListener('input', () => { if (+w.value >= 20) { s.listS = +w.value; naplanuj(); } });
      r.querySelector('button').addEventListener('click', () => odeberSlot(i));
      el.appendChild(r);
    });
    $('btnPridatSlot').disabled = stav.sloty.length >= 10;
  }
  function odeberSlot(i) {
    stav.sloty.splice(i, 1);
    const prem = (x) => (x === i ? 0 : x > i ? x - 1 : x);
    for (const k of Object.keys(stav.prirazeni)) stav.prirazeni[k] = stav.prirazeni[k].map(prem);
    for (const k of Object.keys(stav.upravy)) for (const u of Object.values(stav.upravy[k])) if (u.slot != null) u.slot = prem(u.slot);
    postavSloty(); postavSkupiny(); prepocti();
  }
  function postavSkupiny() {
    const el = $('skupiny'); el.innerHTML = '';
    if (!S) return;
    const G = S.skupiny.length - 2, pr = prirazeni(G), ot = stav.otoceni[stav.vzor] || [];
    const pouzite = new Set(S.dilky.map((d) => d.sk));
    S.skupiny.forEach((nazev, i) => {
      if (!pouzite.has(i)) return;
      const r = document.createElement('div'); r.className = 'skupina';
      const c = S.barvySk && S.barvySk[i] ? `<i style="display:inline-block;width:10px;height:10px;background:${S.barvySk[i]};border:1px solid var(--border-strong);margin-right:4px"></i>` : '';
      r.innerHTML = `<span title="${esc(nazev)}">${c}${esc(nazev)}</span><select aria-label="Dřevina skupiny ${esc(nazev)}">${stav.sloty.map((s, k) => `<option value="${k}">${J.PISMENA[k]} ${esc((J.DREVINY[s.drevina] || {}).nazev || '')}</option>`).join('')}</select>
        <select aria-label="Otočení vláken skupiny ${esc(nazev)}" title="přidané otočení vláken">${[0, 45, 90, 135].map((u) => `<option value="${u}">+${u}°</option>`).join('')}</select>`;
      const [s1, s2] = r.querySelectorAll('select');
      s1.value = pr[i]; s2.value = String(+ot[i] || 0);
      s1.addEventListener('change', () => { const a = prirazeni(G); a[i] = +s1.value; stav.prirazeni[stav.vzor] = a; naplanuj(); });
      s2.addEventListener('change', () => { const a = (stav.otoceni[stav.vzor] || []).slice(); a[i] = +s2.value; stav.otoceni[stav.vzor] = a; naplanuj(); });
      el.appendChild(r);
    });
  }
  function naplnFormular() {
    document.querySelectorAll('#typy button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.vzor === stav.vzor ? 'true' : 'false'));
    postavParametry();
    $('alfa').value = alfa(); $('alfaR').value = alfa();
    const ps = stav.posun[stav.vzor] || [0, 0]; $('posunX').value = ps[0]; $('posunY').value = ps[1];
    for (const k of ['sirka', 'vyska', 'bordura', 'linka']) $(k).value = stav.deska[k];
    for (const k of ['kerf', 'rozestup', 'okrajListu', 'rezerva']) $(k).value = stav[k];
    $('shoda').value = stav.shoda; $('typ3d').value = stav.typ3d; $('nazevProjektu').value = stav.nazev || '';
    postavSloty();
    $('postup').innerHTML = P.postup(stav.vzor);
  }

  /* ---------- přepočet ---------- */
  let casPrepoctu = 0, cas3d = 0;
  function naplanuj() { clearTimeout(casPrepoctu); casPrepoctu = setTimeout(prepocti, 120); }
  function prepocti() {
    let chyba = null;
    try { S = J.sestav(stavProJadro()); }
    catch (e) { chyba = e; console.error(e); }
    if (chyba) { $('varovani').innerHTML = `<li class="chyba">${esc(chyba.message)}</li>`; toast(chyba.message, true); return; }
    plan = J.reznyPlan(S.dilky, stav.sloty, { kerf: +stav.kerf || 0, rozestup: +stav.rozestup || 0, okrajListu: +stav.okrajListu || 0 });
    J.doplnListy(S.dilky, plan);
    $('rozmerDesky').textContent = `${fmt(stav.deska.sirka, 1)} × ${fmt(stav.deska.vyska, 1)} mm · ${S.dilky.length} dílků`;
    nahled.nastav(S, stav.sloty);
    postavSkupiny(); kresliEditor(); kresliPlan(); kresliSpotrebu(); kresliKontrolu(); kresliKusovnik(); kresliTvary(); infoListy();
    clearTimeout(cas3d); cas3d = setTimeout(() => { if (scena) scena.nastav(S, stav.sloty); }, 350);
    uloz();
  }

  /* ---------- 2D náhled ---------- */
  const nahled = N.vytvor($('platno'), {
    priKliku: (d) => vyber(d, true),
    priNajeti: (d) => { $('popisNajeti').textContent = d ? popisDilku(d) : ''; },
  });
  function popisDilku(d) {
    return `č. ${d.id} · ${J.PISMENA[d.slot]} ${drevina(d.slot).nazev} · ${S.skupiny[d.sk] || ''} · vlákna ${fmt(d.vlakno, 1)}° · ${fmt(d.plocha, 0)} mm²${d.listPlanu ? ' · list ' + d.listPlanu : ''}${d.zrcadlo ? ' · Z (obrácený list)' : ''}`;
  }
  let vybranyKlic = null;
  function vyber(d) { vybranyKlic = d ? d.klic : null; nahled.vyber(d); kresliEditor(); }
  function kresliEditor() {
    const el = $('editDilku'), d = vybranyKlic && S ? S.dilky.find((q) => q.klic === vybranyKlic) : null;
    if (!d) { el.classList.add('skryte'); el.innerHTML = ''; return; }
    el.classList.remove('skryte');
    const k = J.kusovnik({ dilky: [d], skupiny: S.skupiny }, stav.sloty)[0];
    el.innerHTML = `<b>Dílek č. ${d.id}</b> – ${esc(S.skupiny[d.sk] || '')}, ${fmt(k.podel, 1)} × ${fmt(k.napric, 1)} mm (podél × napříč vláken), vlákna ${fmt(d.vlakno, 1)}°${d.upraveno ? ' · <i>ručně upraveno</i>' : ''}
      <div class="r2" style="margin-top:6px"><select id="edSlot" aria-label="Dřevina dílku">${stav.sloty.map((s, i) => `<option value="${i}">${J.PISMENA[i]} ${esc((J.DREVINY[s.drevina] || {}).nazev || '')}</option>`).join('')}</select>
      <button class="btn btn-sec btn-mini" id="edZrusit" type="button"${d.upraveno ? '' : ' disabled'}>Zrušit úpravu</button></div>
      <div class="tlacitka"><button class="btn btn-sec btn-mini" data-ot="90" type="button">vlákna +90°</button><button class="btn btn-sec btn-mini" data-ot="45" type="button">+45°</button><button class="btn btn-sec btn-mini" data-ot="-45" type="button">−45°</button><button class="btn btn-sec btn-mini" data-ot="-15" type="button">−15°</button><button class="btn btn-sec btn-mini" data-ot="15" type="button">+15°</button></div>`;
    $('edSlot').value = d.slot;
    const up = () => { stav.upravy[stav.vzor] = stav.upravy[stav.vzor] || {}; return (stav.upravy[stav.vzor][d.klic] = stav.upravy[stav.vzor][d.klic] || {}); };
    $('edSlot').addEventListener('change', () => { up().slot = +$('edSlot').value; prepocti(); });
    el.querySelectorAll('[data-ot]').forEach((b) => b.addEventListener('click', () => { const u = up(); u.uhel = ((u.uhel || 0) + +b.dataset.ot) % 360; prepocti(); }));
    $('edZrusit').addEventListener('click', () => { if (stav.upravy[stav.vzor]) delete stav.upravy[stav.vzor][d.klic]; prepocti(); });
  }
  for (const [id, k] of [['zCisla', 'cisla'], ['zSipky', 'sipky'], ['zSpary', 'spary'], ['zTextura', 'textura']]) $(id).addEventListener('change', () => nahled.zobrazeni({ [k]: $(id).checked }));

  /* ---------- řezný plán, spotřeba, kontrola, kusovník ---------- */
  function kresliPlan() {
    const sel = $('planSlot'), puv = sel.value;
    const sloty = [...new Set(plan.listy.map((l) => l.slot).concat(Object.keys(plan.spotreba).map(Number)))].sort((a, b) => a - b);
    sel.innerHTML = sloty.map((s) => `<option value="${s}">${J.PISMENA[s]} ${esc(drevina(s).nazev)} – ${plan.spotreba[s] ? plan.spotreba[s].listu : 0} list(ů)</option>`).join('');
    if (puv !== '' && sloty.includes(+puv)) sel.value = puv;
    const s = +sel.value, L = plan.listy.filter((l) => l.slot === s), sp = plan.spotreba[s];
    if (!sp) { $('planNahled').innerHTML = ''; $('planInfo').textContent = ''; return; }
    const uk = L.slice(0, 10).map((l) => V.scenaListu(l, S, stav.sloty, { kerf: 0, cisla: true }));
    $('planNahled').innerHTML = uk.length ? V.svg(V.poskladej(uk, 10), { sirkaPx: true, okraj: 3 }) : '<p class="info" style="color:#333;padding:6px">Žádný dílek této dřeviny se nevejde na list – viz spárování ve Spotřebě.</p>';
    $('planInfo').innerHTML = `${sp.dilku} dílků · ${sp.listu} listů ${fmt(sp.delka, 0)} × ${fmt(sp.sirka, 0)} mm · využití ${fmt(sp.vyuziti * 100, 0)} %${L.length > 10 ? ` · zobrazeno 10 z ${L.length}` : ''}${sp.nevejde ? ` · <b class="stav-chyba">${sp.nevejde} dílků větších než list</b>` : ''}`;
  }
  $('planSlot').addEventListener('change', kresliPlan);
  function kresliSpotrebu() {
    const rez = 1 + (+stav.rezerva || 0) / 100;
    let h = '<tr><th>Dřevina</th><th class="c">dílků</th><th class="c">čistá plocha</th><th class="c">listů</th><th>list (d × š)</th><th class="c">využití</th><th class="c">objednat s rezervou</th><th>spárovat</th></tr>';
    let celkem = 0;
    for (const [s, sp] of Object.entries(plan.spotreba)) {
      const spar = sp.sparovat.reduce((a, q) => a + q.pasu * Math.max(q.delka + 2 * stav.okrajListu, 0) * sp.sirka, 0);
      const obj = (sp.plochaListu + spar) * rez; celkem += obj;
      h += `<tr><td>${J.PISMENA[s]} ${esc(drevina(+s).nazev)}</td><td class="c">${sp.dilku}</td><td class="c">${fmt(sp.plocha / 1e4, 2)} dm²</td><td class="c">${sp.listu}</td><td>${fmt(sp.delka, 0)} × ${fmt(sp.sirka, 0)}</td><td class="c">${fmt(sp.vyuziti * 100, 0)} %</td><td class="c">${fmt(obj / 1e6, 3)} m²</td><td>${sp.sparovat.length ? sp.sparovat.map((q) => `č. ${q.id}: ${q.pasu} pásy ${fmt(q.delka, 0)} mm${q.presDelku ? ' (delší než list!)' : ''}`).join('; ') : '–'}</td></tr>`;
    }
    $('tabSpotreba').innerHTML = h;
    const balik = stav.vzor === 'marketerie' ? ` Pro <b>řezání do balíku</b> potřebuje každá dřevina list alespoň ${fmt(S.pole[2] - S.pole[0], 0)} × ${fmt(S.pole[3] - S.pole[1], 0)} mm (celý motiv), tj. ${fmt((S.pole[2] - S.pole[0]) * (S.pole[3] - S.pole[1]) / 1e4, 1)} dm² na vrstvu.` : '';
    $('spotrebaInfo').innerHTML = `Celkem objednat přibližně <b>${fmt(celkem / 1e6, 2)} m²</b> dýhy (rezerva ${fmt(stav.rezerva, 0)} %), tloušťka typicky 0,6 mm. Plus protidýha na rub: ${fmt(stav.deska.sirka * stav.deska.vyska / 1e6 * rez, 2)} m².${balik} Dílky větší než list se slepí z pásů (spára podél vláken).`;
  }
  function kresliKontrolu() {
    const L = S.varovani.slice();
    const k = J.kontrolaPokryti(S.dilky, S.deska, { prekryvy: false });
    const rel = Math.abs(k.rozdil) / k.plochaPole;
    L.push(rel < 1e-5 ? { uroven: 'ok', text: `Součet ploch dílků = plocha desky (${fmt(k.plochaPole / 100, 1)} cm², odchylka ${fmt(k.rozdil, 4)} mm²).` } : { uroven: 'chyba', text: `Součet ploch dílků (${fmt(k.soucet, 1)} mm²) nesouhlasí s plochou desky (${fmt(k.plochaPole, 1)} mm²) – vzor má mezery nebo překryvy.` });
    if (plan.nevejde.length) L.push({ uroven: 'varovani', text: `${plan.nevejde.length} dílků je větších než list dýhy (č. ${plan.nevejde.slice(0, 12).join(', ')}${plan.nevejde.length > 12 ? '…' : ''}) – zadejte větší list nebo je spárujte z pásů.` });
    if (+stav.rozestup < +stav.kerf) L.push({ uroven: 'info', text: 'Rozestup dílků na listu je menší než šířka řezu – plán použije šířku řezu.' });
    $('varovani').innerHTML = L.map((v) => `<li class="${v.uroven}">${esc(v.text)}</li>`).join('');
    const spr = S.dilky.filter((d) => d.zrcadlo).length, uh = new Set(S.dilky.map((d) => Math.round(d.vlakno))).size;
    $('udaje').innerHTML = [['Dílků', S.dilky.length], ['Pole vzoru', `${fmt(S.pole[2] - S.pole[0], 1)} × ${fmt(S.pole[3] - S.pole[1], 1)} mm`], ['Různých směrů vláken', uh], ['Dílků z obráceného listu (Z)', spr],
      ['Nejmenší dílek', fmt(Math.min(...S.dilky.map((d) => d.plocha)), 1) + ' mm²'], ['Listů dýhy celkem', plan.listy.length], ['Šířka řezu (kerf)', fmt(stav.kerf, 2) + ' mm'], ['Ručně upravených dílků', S.dilky.filter((d) => d.upraveno).length]]
      .map(([a, b]) => `<div><span>${a}</span><span>${b}</span></div>`).join('');
    $('infoOvereni').textContent = '';
  }
  $('btnOverit').addEventListener('click', () => {
    const b = $('btnOverit'); b.disabled = true; $('infoOvereni').textContent = 'Počítám průniky…';
    setTimeout(() => {
      try {
        const t = performance.now(), k = J.kontrolaPokryti(S.dilky, S.deska, { vzorky: 3000 });
        const ok = k.prekryv < 1e-5 * k.plochaPole && Math.abs(k.rozdil) < 1e-5 * k.plochaPole && k.chybneBody === 0;
        $('infoOvereni').innerHTML = `${ok ? '<b class="stav-ok">✔ Bez mezer a překryvů.</b>' : '<b class="stav-chyba">✘ Nalezeny chyby.</b>'} Prověřeno ${k.paru} sousedních párů: součet průniků ${fmt(k.prekryv, 4)} mm², odchylka plochy ${fmt(k.rozdil, 4)} mm², 3000 náhodných bodů – v žádném nebo ve dvou dílcích: ${k.chybneBody}. (${fmt((performance.now() - t) / 1000, 1)} s)`;
      } catch (e) { $('infoOvereni').textContent = 'Kontrola selhala: ' + e.message; }
      b.disabled = false;
    }, 30);
  });
  function kresliKusovnik() {
    const K = J.kusovnik(S, stav.sloty), max = 400;
    let h = '<tr><th class="c">č.</th><th>dřevina</th><th>skupina</th><th class="c">podél × napříč (mm)</th><th class="c">plocha mm²</th><th class="c">vlákna °</th><th class="c">list</th><th>Z</th></tr>';
    for (const k of K.slice(0, max)) h += `<tr><td class="c">${k.id}</td><td>${J.PISMENA[k.slot]} ${esc(k.drevina)}</td><td>${esc(k.skupina)}</td><td class="c">${fmt(k.podel, 1)} × ${fmt(k.napric, 1)}</td><td class="c">${fmt(k.plocha, 0)}</td><td class="c">${fmt(k.vlakno, 1)}</td><td class="c">${k.list || '–'}</td><td>${k.zrcadlo ? 'Z' : ''}</td></tr>`;
    $('tabKusovnik').innerHTML = h;
    $('kusInfo').textContent = (K.length > max ? `Zobrazeno ${max} z ${K.length} dílků – celý kusovník je v CSV a PDF. ` : '') + 'Rozměr je obal dílku natočeného vlákny vodorovně (podél × napříč vláken). Z = dílek z obráceného listu (bookmatch).';
  }
  function kresliTvary() {
    const T = J.jedinecneTvary(S), sc = V.scenaTvaru(T, stav.sloty, { sirka: 260, max: 30 });
    $('tvaryNahled').innerHTML = sc.pocet ? V.svg(sc, { sirkaPx: true, okraj: 3 }) : '<p class="info" style="color:#333;padding:6px">Žádný tvar se neopakuje.</p>';
  }

  /* ---------- tisk a soubory ---------- */
  function papir() {
    const v = $('papir').value;
    $('blokPapir').classList.toggle('skryte', v !== 'vlastni');
    if (v === 'a3') return [297, 420]; if (v === 'letter') return [215.9, 279.4];
    if (v === 'vlastni') return [Math.max(50, +$('papirW').value || 210), Math.max(50, +$('papirH').value || 297)];
    return [210, 297];
  }
  function infoListy() {
    try {
      const [pw, ph] = papir(), ok = +$('okraj').value || 8, pr = +$('prekryv').value || 12;
      const n = V.rozvrhListu(V.scenaSestavy(S, stav.sloty, { cisla: false, sipky: false, barvy: false }), pw, ph, ok, pr).listy.length;
      $('infoListy').innerHTML = `Sestava 1:1 = <b>${n}</b> ${n === 1 ? 'list' : n < 5 ? 'listy' : 'listů'} papíru; listy řezného plánu: ${plan.listy.length} × (${plan.listy.length ? V.rozvrhListu(V.scenaListu(plan.listy[0], S, stav.sloty), pw, ph, ok, pr).listy.length : 0} str.). Na každé straně kontrolní úsečky 50 / 100 mm v X i Y.`;
    } catch (e) { $('infoListy').textContent = ''; }
  }
  for (const id of ['papir', 'okraj', 'prekryv', 'papirW', 'papirH']) $(id).addEventListener('input', infoListy);
  function stahni(blob, jmeno) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = jmeno;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  const zaklad = () => ('intarzie_' + stav.vzor + '_' + Math.round(stav.deska.sirka) + 'x' + Math.round(stav.deska.vyska));
  $('btnSvg').addEventListener('click', () => stahni(new Blob([V.svg(V.scenaSestavy(S, stav.sloty, { barvy: $('pdfBarvy').checked }), { meritko: true })], { type: 'image/svg+xml' }), zaklad() + '_sestava.svg'));
  $('btnDxf').addEventListener('click', () => stahni(new Blob([V.dxf(V.scenaSestavy(S, stav.sloty, { barvy: false }))], { type: 'application/dxf' }), zaklad() + '_sestava.dxf'));
  const laser = () => V.scenaLaser(plan, S, stav.sloty, { kerf: +stav.kerf || 0, gravir: $('gravir').checked });
  $('btnSvgLaser').addEventListener('click', () => stahni(new Blob([V.svg(laser(), { bezPozadi: true })], { type: 'image/svg+xml' }), zaklad() + '_laser_kerf' + String(stav.kerf).replace('.', '-') + '.svg'));
  $('btnDxfLaser').addEventListener('click', () => stahni(new Blob([V.dxf(laser())], { type: 'application/dxf' }), zaklad() + '_laser.dxf'));
  $('btnCsv').addEventListener('click', () => {
    const K = J.kusovnik(S, stav.sloty);
    const r = ['cislo;drevina;skupina;druh;podel_mm;napric_mm;plocha_mm2;vlakna_st;list;obraceny'].concat(K.map((k) => [k.id, J.PISMENA[k.slot] + ' ' + k.drevina, k.skupina, k.druh, fmt(k.podel, 2), fmt(k.napric, 2), fmt(k.plocha, 1), fmt(k.vlakno, 2), k.list || '', k.zrcadlo ? 'Z' : ''].join(';')));
    stahni(new Blob(['﻿' + r.join('\r\n')], { type: 'text/csv' }), zaklad() + '_kusovnik.csv');
  });
  $('btnPng').addEventListener('click', () => { const u = nahled.snimek(); fetch(u).then((r) => r.blob()).then((b) => stahni(b, zaklad() + '_nahled.png')); });
  function nactiPismo() {
    if (window.FONTY_JS && window.FONTY_JS['LiberationSans-Regular.ttf']) return Promise.resolve(window.FONTY_JS['LiberationSans-Regular.ttf']);
    return new Promise((ok) => {
      const s = document.createElement('script'); s.src = 'stitky_panely/fonty/LiberationSans-Regular.ttf.js';
      s.onload = () => ok((window.FONTY_JS || {})['LiberationSans-Regular.ttf'] || null); s.onerror = () => ok(null);
      document.head.appendChild(s);
    });
  }
  function textZHtml(h) {
    return h.replace(/<h3>(.*?)<\/h3>/g, '\n# $1\n').replace(/<li>/g, '\n• ').replace(/<\/?(ol|ul|li|p|b|i)[^>]*>/g, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')
      .split('\n').map((s) => s.trim()).filter(Boolean);
  }
  function strankyPdf() {
    const rez = 1 + (+stav.rezerva || 0) / 100, V0 = V_();
    const uvod = [
      `# ${stav.nazev || V0.nazev} – ${fmt(stav.deska.sirka, 1)} × ${fmt(stav.deska.vyska, 1)} mm`,
      `Vzor: ${V0.nazev} (${V0.en}), ${S.dilky.length} dílků, pole vzoru ${fmt(S.pole[2] - S.pole[0], 1)} × ${fmt(S.pole[3] - S.pole[1], 1)} mm, bordura ${fmt(stav.deska.bordura, 1)} mm, linka ${fmt(stav.deska.linka, 1)} mm. Sesazení dýh: ${$('shoda').selectedOptions[0].textContent}. Šířka řezu ${fmt(stav.kerf, 2)} mm.`,
      '# Dřeviny', ...stav.sloty.map((s, i) => `${J.PISMENA[i]} = ${(J.DREVINY[s.drevina] || {}).nazev} (${(J.DREVINY[s.drevina] || {}).en}), list ${fmt(s.listD, 0)} × ${fmt(s.listS, 0)} mm`),
      '# Značení', 'Číslo + písmeno = číslo dílku a dřevina. Šipka = směr vláken. Z = dílek z obráceného listu (bookmatch). Na listech řezného plánu běží vlákna vodorovně (podél listu).',
    ];
    if (S.varovani.length) uvod.push('# Upozornění', ...S.varovani.map((v) => v.text));
    const st = [{ nadpis: 'Intarzie a parketáž', text: uvod, ctverec: true, tabulka: {
      hlavicka: ['Dřevina', 'Dílků', 'Čistá plocha', 'Listů', 'List d × š', 'Objednat'], sloupce: ['l', 'r', 'r', 'r', 'l', 'r'], sirky: [52, 16, 30, 16, 34, 30],
      radky: Object.entries(plan.spotreba).map(([s, sp]) => [`${J.PISMENA[s]} ${drevina(+s).nazev}`, sp.dilku, fmt(sp.plocha / 1e4, 2) + ' dm²', sp.listu + (sp.sparovat.length ? ` + ${sp.listuSparovat} pásů` : ''), `${fmt(sp.delka, 0)} × ${fmt(sp.sirka, 0)}`, fmt(sp.plochaListu * rez / 1e6, 3) + ' m²']),
    } }];
    st.push({ scena: V.scenaSestavy(S, stav.sloty, { barvy: $('pdfBarvy').checked }), nadpis: 'Sestava 1:1', deleni: true });
    if ($('pdfTvary').checked) { const sc = V.scenaTvaru(J.jedinecneTvary(S), stav.sloty, { sirka: 180 }); if (sc.pocet) st.push({ scena: sc, nadpis: 'Šablony jedinečných dílků 1:1', deleni: true }); }
    if ($('pdfListy').checked) for (const l of plan.listy.slice(0, 60)) st.push({ scena: V.scenaListu(l, S, stav.sloty, { kerf: 0 }), nadpis: `Řezný plán ${J.PISMENA[l.slot]} ${drevina(l.slot).nazev} – list ${l.cislo}`, deleni: true });
    const K = J.kusovnik(S, stav.sloty);
    st.push({ nadpis: 'Kusovník', tabulka: { hlavicka: ['Č.', 'Dřevina', 'Skupina', 'Podél × napříč', 'Plocha mm²', 'Vlákna °', 'List', 'Z'], sloupce: ['r', 'l', 'l', 'r', 'r', 'r', 'r', 'l'], sirky: [12, 40, 44, 32, 22, 18, 12, 8],
      radky: K.map((k) => [k.id, `${J.PISMENA[k.slot]} ${k.drevina}`, k.skupina.slice(0, 24), `${fmt(k.podel, 1)} × ${fmt(k.napric, 1)}`, fmt(k.plocha, 0), fmt(k.vlakno, 1), k.list || '–', k.zrcadlo ? 'Z' : '']) } });
    st.push({ nadpis: 'Postup výroby', text: textZHtml(P.postup(stav.vzor)) });
    return st;
  }
  $('btnPdf').addEventListener('click', async () => {
    const b = $('btnPdf'), puv = b.textContent; b.disabled = true; b.textContent = 'Připravuji PDF…';
    try {
      if (!window.jspdf) throw new Error('jsPDF se nenačetl');
      const pismo = await nactiPismo();
      const doc = V.pdf(window.jspdf.jsPDF, strankyPdf(), { papir: papir(), okraj: +$('okraj').value || 8, prekryv: +$('prekryv').value || 12, pismo, cernobile: $('cernobile').checked, nazev: 'Intarzie – ' + V_().nazev });
      stahni(doc.output('blob'), zaklad() + '.pdf');
      toast(`PDF: ${doc.getNumberOfPages()} stran. Tiskněte ve skutečné velikosti (100 %).`);
    } catch (e) { console.error(e); toast('PDF se nepodařilo vytvořit: ' + e.message, true); }
    finally { b.disabled = false; b.textContent = puv; }
  });

  /* ---------- vstupy ---------- */
  const cislo = (id, fn, min) => $(id).addEventListener('input', () => { const v = +$(id).value; if (Number.isFinite(v) && v >= (min == null ? -1e9 : min)) { fn(v); naplanuj(); } });
  for (const k of ['sirka', 'vyska']) cislo(k, (v) => { stav.deska[k] = v; }, 20);
  for (const k of ['bordura', 'linka']) cislo(k, (v) => { stav.deska[k] = v; }, 0);
  for (const k of ['kerf', 'rozestup', 'okrajListu', 'rezerva']) cislo(k, (v) => { stav[k] = v; }, 0);
  cislo('alfa', (v) => { stav.alfa[stav.vzor] = v; $('alfaR').value = v; });
  $('alfaR').addEventListener('input', () => { stav.alfa[stav.vzor] = +$('alfaR').value; $('alfa').value = $('alfaR').value; naplanuj(); });
  cislo('posunX', (v) => { stav.posun[stav.vzor] = [v, (stav.posun[stav.vzor] || [0, 0])[1]]; });
  cislo('posunY', (v) => { stav.posun[stav.vzor] = [(stav.posun[stav.vzor] || [0, 0])[0], v]; });
  $('shoda').addEventListener('change', () => { stav.shoda = $('shoda').value; prepocti(); });
  $('btnPridatSlot').addEventListener('click', () => { if (stav.sloty.length < 10) { stav.sloty.push({ drevina: 'tresen', listD: J.LIST_TYPICKY.delka, listS: J.LIST_TYPICKY.sirka }); postavSloty(); prepocti(); } });
  $('btnSvgNacist').addEventListener('click', () => $('souborSvg').click());
  $('souborSvg').addEventListener('change', async () => {
    const f = $('souborSvg').files[0]; $('souborSvg').value = ''; if (!f) return;
    try { if (f.size > 8e6) throw new Error('SVG je větší než 8 MB.'); await nastavSvg(await f.text(), f.name, true); postavSloty(); prepocti(); toast(`Načteno ${tvarySvg.length} tvarů, dřeviny přiřazeny podle barev.`); }
    catch (e) { toast('SVG nelze načíst: ' + e.message, true); }
  });
  $('btnSvgUkazka').addEventListener('click', async () => { await nastavSvg(UKAZKA_SVG, 'ukázkový motiv (tulipán)', true); postavSloty(); prepocti(); });

  /* ---------- předvolby a projekty ---------- */
  $('predvolba').innerHTML = PREDVOLBY.map((p, i) => `<option value="${i}">${esc(p[0])}</option>`).join('');
  $('btnPredvolba').addEventListener('click', async () => {
    const [nazev, p] = PREDVOLBY[+$('predvolba').value];
    stav.vzor = p.vzor; stav.deska = Object.assign({}, p.deska);
    stav.sloty = p.sloty.map(([d]) => ({ drevina: d, listD: J.LIST_TYPICKY.delka, listS: J.LIST_TYPICKY.sirka }));
    stav.par[p.vzor] = Object.assign(J.vychoziPar(p.vzor), p.par || {});
    if (p.alfa != null) stav.alfa[p.vzor] = p.alfa;
    stav.posun[p.vzor] = p.posun || [0, 0];
    stav.prirazeni[p.vzor] = p.prirazeni ? p.prirazeni.slice() : undefined; if (!p.prirazeni) delete stav.prirazeni[p.vzor];
    stav.otoceni[p.vzor] = []; stav.upravy[p.vzor] = {};
    stav.shoda = p.shoda || 'slip'; stav.typ3d = p.typ3d || 'deska'; stav.nazev = nazev;
    if (p.ukazka) await nastavSvg(UKAZKA_SVG, 'ukázkový motiv (tulipán)', true);
    vyber(null); naplnFormular(); prepocti();
    if (scena) scena.typ(stav.typ3d);
  });
  const projekty = () => { try { return JSON.parse(localStorage.getItem(KLIC_PROJ) || '[]'); } catch (e) { return []; } };
  const ulozProjekty = (L) => { try { localStorage.setItem(KLIC_PROJ, JSON.stringify(L)); return true; } catch (e) { toast('Projekt se nepodařilo uložit (úložiště je plné nebo zakázané).', true); return false; } };
  function kresliProjekty() {
    const L = projekty();
    $('projekty').innerHTML = L.length ? L.map((p, i) => `<li><span title="${esc(p.nazev)}">${esc(p.nazev)} <small style="color:var(--text-faint)">${esc(p.datum || '')}</small></span><button type="button" data-nac="${i}">Načíst</button><button type="button" data-sm="${i}" aria-label="Smazat projekt">✕</button></li>`).join('') : '<li><span style="color:var(--text-faint)">Zatím žádné uložené projekty.</span></li>';
  }
  $('projekty').addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const L = projekty();
    if (b.dataset.nac != null) { await nactiProjekt(L[+b.dataset.nac]); }
    else if (b.dataset.sm != null && await Dialog.potvrd(`Smazat projekt „${L[+b.dataset.sm].nazev}“?`)) { L.splice(+b.dataset.sm, 1); ulozProjekty(L); kresliProjekty(); }
  });
  async function nactiProjekt(p) {
    if (!p || !p.stav) return;
    stav = Object.assign(VYCHOZI(), p.stav);
    if (p.svg) await nastavSvg(p.svg, p.stav.svgNazev, false).catch(() => {});
    vyber(null); naplnFormular(); prepocti(); if (scena) scena.typ(stav.typ3d);
  }
  $('btnUlozit').addEventListener('click', () => {
    const nazev = ($('nazevProjektu').value || '').trim() || `${V_().nazev} ${stav.deska.sirka}×${stav.deska.vyska}`;
    stav.nazev = nazev;
    const L = projekty().filter((p) => p.nazev !== nazev);
    const zaznam = { nazev, datum: new Date().toLocaleDateString('cs-CZ'), stav: JSON.parse(JSON.stringify(stav)) };
    if (stav.vzor === 'marketerie' && svgText) { if (svgText.length < 300000) zaznam.svg = svgText; else toast('SVG motiv je velký – v projektu se neuloží, použijte Export JSON.'); }
    L.unshift(zaznam);
    if (ulozProjekty(L)) { kresliProjekty(); toast('Projekt uložen.'); }
  });
  $('btnExportJson').addEventListener('click', () => stahni(new Blob([JSON.stringify({ typ: 'intarzie', verze: 1, nazev: stav.nazev, stav, svg: stav.vzor === 'marketerie' ? svgText : undefined, projekty: projekty() }, null, 1)], { type: 'application/json' }), zaklad() + '.json'));
  $('btnImportJson').addEventListener('click', () => $('souborJson').click());
  $('souborJson').addEventListener('change', async () => {
    const f = $('souborJson').files[0]; $('souborJson').value = ''; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (d.typ !== 'intarzie' || !d.stav) throw new Error('Soubor není projekt intarzie.');
      if (Array.isArray(d.projekty) && d.projekty.length && await Dialog.potvrd(`Soubor obsahuje i ${d.projekty.length} uložených projektů. Přidat je do seznamu?`)) {
        const L = projekty(); for (const p of d.projekty) if (!L.some((q) => q.nazev === p.nazev)) L.push(p); ulozProjekty(L); kresliProjekty();
      }
      await nactiProjekt({ stav: d.stav, svg: d.svg });
      toast('Projekt načten.');
    } catch (e) { toast('Import selhal: ' + e.message, true); }
  });
  $('btnReset').addEventListener('click', async () => { if (await Dialog.potvrd('Vrátit všechna nastavení na výchozí hodnoty?')) { stav = VYCHOZI(); vyber(null); naplnFormular(); prepocti(); if (scena) scena.typ(stav.typ3d); } });
  $('nazevProjektu').addEventListener('input', () => { stav.nazev = $('nazevProjektu').value; uloz(); });

  /* ---------- záložky ---------- */
  $('zalozky').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-z]'); if (!b) return;
    document.querySelectorAll('#zalozky button').forEach((x) => x.setAttribute('aria-selected', x === b ? 'true' : 'false'));
    document.querySelectorAll('.panel').forEach((p) => { p.hidden = p.dataset.p !== b.dataset.z; });
  });
  $('princip').innerHTML = P.princip();

  /* ---------- 3D ---------- */
  let scena = null, nacita3d = false;
  function nactiSkript(src) { return new Promise((ok, chyba) => { const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = () => chyba(new Error('nejde načíst ' + src)); document.head.appendChild(el); }); }
  function start3d() {
    if (scena || nacita3d) return; nacita3d = true;
    const hotovo = () => {
      try {
        $('obal3d').innerHTML = '';
        scena = window.INT3D.vytvor($('obal3d'));
        scena.priZmeneSvetla = (a) => { $('svetloAz').value = Math.round(a); };
        scena.typ(stav.typ3d); scena.chatoyance(+$('chat').value); scena.svetlo(+$('svetloAz').value);
        if (S) scena.nastav(S, stav.sloty);
      } catch (e) { console.error(e); $('obal3d').innerHTML = '<div class="info" style="padding:12px">3D nelze zobrazit (WebGL): ' + esc(e.message) + '</div>'; }
    };
    if (window.THREE) hotovo();
    else nactiSkript('lib/three.0.160.0.min.js').then(hotovo).catch((e) => { nacita3d = false; $('stav3d').textContent = 'three.js se nenačetl: ' + e.message; });
  }
  if ('IntersectionObserver' in window) new IntersectionObserver((z) => { const v = z.some((q) => q.isIntersecting); if (v) start3d(); if (scena) { scena.viditelne = v; if (v) scena.prekresli(); } }, { rootMargin: '200px' }).observe($('karta3d'));
  else start3d();
  $('typ3d').addEventListener('change', () => { stav.typ3d = $('typ3d').value; uloz(); if (scena) scena.typ(stav.typ3d); });
  $('chat').addEventListener('input', () => { $('chatHodn').textContent = fmt(+$('chat').value, 2); if (scena) scena.chatoyance(+$('chat').value); });
  $('svetloAz').addEventListener('input', () => { if (scena) { scena.otacetSvetlo(false); $('btnSvetlo').innerHTML = '▶ otáčet <kbd>mezera</kbd>'; scena.svetlo(+$('svetloAz').value); } });
  const otacej = () => { if (!scena) return; const a = scena.otacetSvetlo(); $('btnSvetlo').innerHTML = a ? '⏸ zastavit <kbd>mezera</kbd>' : '▶ otáčet <kbd>mezera</kbd>'; };
  $('btnSvetlo').addEventListener('click', otacej);
  document.querySelectorAll('[data-pohled]').forEach((b) => b.addEventListener('click', () => scena && scena.pohled(b.dataset.pohled)));

  /* ---------- klávesy ---------- */
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input,select,textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
    const m = /^(Digit|Numpad)([0-9])$/.exec(e.code);
    if (m) { const i = (+m[2] + 9) % 10; if (J.PORADI_VZORU[i]) { zvolVzor(J.PORADI_VZORU[i]); e.preventDefault(); } return; }
    if (e.code === 'Space') { e.preventDefault(); otacej(); }
    if (e.code === 'Escape') vyber(null);
  });

  /* ---------- start ---------- */
  async function start() {
    nacti();
    postavTypy();
    if (stav.vzor === 'marketerie' || stav.svgNazev) {
      const z = await idbNacti('svg');
      try { if (z && z.text) await nastavSvg(z.text, z.nazev, false); else if (stav.vzor === 'marketerie') await nastavSvg(UKAZKA_SVG, 'ukázkový motiv (tulipán)', !stav.prirazeni.marketerie); }
      catch (e) { console.warn(e); }
    }
    naplnFormular(); kresliProjekty(); prepocti();
  }
  start();
  window.INTUI = { get S() { return S; }, get plan() { return plan; }, get stav() { return stav; }, zvolVzor, prepocti, strankyPdf, get scena() { return scena; }, nahled, nastavSvg, UKAZKA_SVG };
})();
