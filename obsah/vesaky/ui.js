/* Věšáky – ovládání stránky nad společným zapojením gen3d/aplikace.js (historie, projekt, Moje…, sdílení, hlášení, klávesy, manifold):
   tady formulář s živou odezvou, editor ramen a trasy, galerie a náhodné tvary, přepočet, výsledky, pevnost, tisk, kontroly,
   skicář profilu a štítku, výkres a export. Náhled vesaky/nahled.js nad gen3d/scena.js (rovina z = 0, y nahoru). */
/* global VESAKY, VESAKY_GEOM, VESAKY_VYKRES, VESAKY_NAHLED, VESAKY_PROFIL, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const K = VESAKY, fmt = K.fmt;
  const KLIC_VZHLED = 'webapp_vesaky_vzhled';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const des = x => String(x).replace('.', ',');

  /* ---------- stav (historie, ukládání, projekt, sdílení a klávesy drží G3D.aplikace) ---------- */
  let p, wasm = null, model = null, chybaStavby = null, chybaJadra = null, aktivni = 0, nasazeni = false;
  const nahled = VESAKY_NAHLED.vytvorNahled($('platno'));
  nahled.stav.duchove = true;
  const app = G3D.aplikace({
    typ: 'vesaky', nazev: 'Věšáky', klic: 'webapp_vesaky', soubor: 'vesak',
    normalizuj: K.normalizuj, vychozi: () => K.zPredvolby(0),
    ulozProjekt: K.ulozProjekt, nactiProjekt: K.nactiProjekt, vezmi: K.vezmi, poloz: K.poloz,
    popis: q => `${q.nazev || 'Věšák'} – ${K.popis(q)}`,
    hlasitOpravyUlozeneho: true,
    formular: false,   // pole mají živou odezvu (input) a hlášení o omezení rozsahu – napoj() níž
    predNaplnenim: q => { p = q; if (aktivni >= p.ramena.length) aktivni = Math.max(0, p.ramena.length - 1); editorRamen(); },
    viditelnost: q => { p = q; viditelnost(); naplnPole($('f_uvys')); },   // automatická výška úchytu se mění s tvarem štítku
    prepocitej: () => prepocitej(), zpozdeni: 40,
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportStl(),
    doModelare: () => (maModel() ? { data: KRAB.soubor3mf(kusyNaPodlozku(), p.nazev || 'Věšák'), pripona: '.3mf' } : null),
    zkratky: { m: 'tTisk', d: 'tDuchove', v: 'tPrevisy', p: 'tPrevisy', h: 'tHrany', r: 'tRozpad', n: 'tNasazeni', l: 'tPravitka', g: 'btnNahodny', o: 'btnObmena' },
    hlaseniNavic: (li, x) => hlaseniNavic(li, x),
    zmenaTematu: () => app.prepocitej(),
  });
  p = app.p;
  const zmen = (fn, slouceni) => { app.zmen(fn, slouceni); p = app.p; };
  const nahrad = q => { app.nahrad(q); p = app.p; };
  const naplnFormular = () => app.naplnFormular();

  /* ---------- formulář ---------- */
  const opt = (sel, obj, f) => { $(sel).innerHTML = Object.entries(obj).map(([k, v]) => `<option value="${k}">${esc(f(k, v))}</option>`).join(''); };
  opt('f_thtyp', K.HRANY, (k, v) => v);
  opt('f_sroub', K.SROUBY, (k, v) => `${v.nazev} (hlava Ø ${fmt(v.hlava)})`);
  opt('f_mat', K.MATERIALY, (k, v) => v.nazev);
  opt('f_zed', K.ZDI, (k, v) => v.nazev);
  opt('f_orient', K.ORIENTACE, (k, v) => v);
  /* tvary štítku: dlaždice s malým náhledem zepředu */
  (function () {
    const vzor = K.zPredvolby(0);
    $('tvaryStitku').innerHTML = Object.entries(K.TVARY_STITKU).map(([kl, v]) => {
      const q = K.kopie(vzor); q.telo.tvar = kl; q.telo.sirka = 30; q.telo.vyska = 40; q.telo.roh = 4;
      let ikona = '';
      if (kl === 'vlastni') ikona = '<text x="20" y="27" font-size="20" text-anchor="middle">✏️</text>';
      else {
        const obs = K.stitekObrysy(K.normalizuj(q).p), b = K.obalObrysu(obs), m = 34 / Math.max(b[2] - b[0], b[3] - b[1]);
        ikona = obs.map(ob => `<path${ob.dira ? ' class="dira"' : ''} d="${VESAKY_VYKRES.cestaObrysu(ob, x => 20 + (x - (b[0] + b[2]) / 2) * m, y => 20 - (y - (b[1] + b[3]) / 2) * m)}"/>`).join('');
      }
      return `<button type="button" data-tvar-stitku="${kl}" title="${esc(v.nazev)}"><svg viewBox="0 0 40 40" aria-hidden="true">${ikona}</svg>${esc(v.nazev)}</button>`;
    }).join('');
  })();
  $('tvaryStitku').addEventListener('click', e => {
    const b = e.target.closest('[data-tvar-stitku]'); if (!b) return;
    const tvar = b.dataset.tvarStitku;
    zmen(x => {
      if (tvar === 'vlastni' && !x.telo.vlastni.some(ob => !ob.dira)) x.telo.vlastni = K.kopie(K.stitekObrysy(x));
      x.telo.tvar = tvar;
      // když se kapsa do tvaru nevejde, štítek rovnou zvětšit na nejmenší vyhovující
      const q = K.normalizuj(x).p, kr = K.odvozene(q).kryti;
      if ((kr.bok < 2 || kr.vrch < 3 || (q.uchyt.vyskaAuto && !K.autoVyskaUchytu(q))) && tvar !== 'zadny' && tvar !== 'vlastni') {
        const n = K.nejmensiStitek(q);
        if (n) { x.telo.sirka = n.sirka; x.telo.vyska = n.vyska; setTimeout(() => { $('profilZprava').textContent = `Štítek zvětšen na ${fmt(n.sirka)} × ${fmt(n.vyska)} mm, aby zakryl úchyt.`; }, 0); }
      }
    });
    naplnFormular();
    if (tvar === 'vlastni') zobraz('cela');
  });
  $('btnUpravitStitek').addEventListener('click', () => zobraz('cela'));
  $('segProfil').innerHTML = Object.entries(K.PROFILY_UCHYTU).map(([k, v]) => `<button type="button" data-seg="uchyt.profil" data-hodnota="${k}" title="${esc(v.popis)}"><span aria-hidden="true">${v.znak}</span>${esc(v.nazev)}</button>`).join('');
  document.querySelectorAll('[data-seg]').forEach(b => b.addEventListener('click', () => { zmen(x => K.poloz(x, b.dataset.seg, b.dataset.hodnota)); naplnFormular(); }));

  /** Rozsah čísla pro cestu (i v ramenech a úsecích trasy). */
  function rozsah(c) {
    if (K.ROZSAHY[c]) return K.ROZSAHY[c];
    const m = c.split('.'), kl = m[m.length - 1];
    if (m[0] === 'ramena' && m.length === 3) return K.ROZSAHY_RAMENE[kl];
    if (m[0] === 'ramena' && m.length === 5) return K.ROZSAHY_SEGMENTU[kl];
    return null;
  }
  /** Napojí pole s data-p na projekt (statická i vytvořená editorem ramen). */
  function napoj(el) {
    const akce = () => {
      const c = el.dataset.p;
      let h;
      if (el.type === 'checkbox') h = el.checked;
      else if (el.dataset.typ === 'text') h = el.value;
      else {
        h = K.cislo(el.value, NaN);
        el.classList.toggle('spatne', !Number.isFinite(h));
        if (!Number.isFinite(h)) return;
      }
      zmen(x => K.poloz(x, c, h), c);
    };
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', akce);
    if (el.tagName === 'INPUT' && el.type === 'text' && el.dataset.typ !== 'text') {
      el.addEventListener('change', () => {
        akce();   // i bez předchozího „input“ (vložení, skript)
        const psano = K.cislo(el.value, NaN), h = K.vezmi(p, el.dataset.p), roz = rozsah(el.dataset.p);
        if (h == null) return;
        el.value = des(h);
        if (roz && Number.isFinite(psano) && Math.abs(psano - h) > 1e-9) {
          el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
          Dialog.info(`${el.labels[0] ? el.labels[0].textContent.trim() : 'Hodnota'}: omezeno na ${fmt(roz[0], 2)}–${fmt(roz[1], 2)}, použito ${fmt(h, 2)}.`);
        }
      });
      // ↑/↓ ± 1, Shift × 10, Alt po 0,1
      el.addEventListener('keydown', e => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        const h = K.cislo(el.value, NaN); if (!Number.isFinite(h)) return;
        e.preventDefault();
        const krok = (e.shiftKey ? 10 : e.altKey ? 0.1 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
        el.value = fmt(Math.round((h + krok) * 1000) / 1000, 3);
        el.dispatchEvent(new Event('input'));
      });
    }
  }
  const pole = [...document.querySelectorAll('[data-p]')];
  pole.forEach(napoj);
  function naplnPole(el) {
    if (!el || !p) return;
    const h = K.vezmi(p, el.dataset.p);
    if (el.type === 'checkbox') el.checked = !!h;
    else if (document.activeElement !== el) el.value = el.dataset.typ === 'text' ? (h ?? '') : des(h);
    el.classList.remove('spatne');
  }
  function viditelnost() {
    for (const el of document.querySelectorAll('[data-profil]')) el.hidden = el.dataset.profil !== p.uchyt.profil;
    for (const el of document.querySelectorAll('[data-tvar]')) el.hidden = !el.dataset.tvar.split(' ').includes(p.telo.tvar);
    for (const el of document.querySelectorAll('[data-posun]')) el.hidden = p.uchyt.posunAuto;
    for (const el of document.querySelectorAll('[data-okraj]')) el.hidden = !p.uchyt.vyskaAuto;
    $('f_uvys').readOnly = p.uchyt.vyskaAuto; $('f_uvys').title = p.uchyt.vyskaAuto ? 'Počítá se automaticky – vypněte „Výška automaticky“ pro ruční zadání' : '';
    document.querySelectorAll('[data-tvar-stitku]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tvarStitku === p.telo.tvar)));
    document.querySelectorAll('[data-seg]').forEach(b => b.setAttribute('aria-pressed', String(K.vezmi(p, b.dataset.seg) === b.dataset.hodnota)));
    for (const el of document.querySelectorAll('[data-koule]')) el.hidden = !p.ramena[aktivni] || p.ramena[aktivni].konec !== 'koule';
  }

  /* ---------- editor ramen a trasy ---------- */
  const POLE_SEGMENTU = { d: ['Délka', 'mm'], r: ['Poloměr', 'mm'], r1: ['Poloměr konce', 'mm'], u: ['Úhel', '°'] };
  const polePrvek = (cesta, popis, jedn, titul = '') => {
    const id = 'f_' + cesta.replace(/\./g, '_');
    return `<div class="pole"><label for="${id}">${popis}</label><input type="text" inputmode="decimal" class="mm" id="${id}" data-p="${cesta}"${titul ? ` title="${esc(titul)}"` : ''}><span class="jedn">${jedn}</span></div>`;
  };
  function editorRamen() {
    const zal = $('ramenaZal');
    zal.innerHTML = p.ramena.map((r, i) => `<button type="button" data-rameno="${i}" aria-pressed="${i === aktivni}">${K.DRUHY_RAMEN[r.druh].znak} ${i + 1}</button>`).join('')
      + (p.ramena.length < K.MAX_RAMEN ? '<button type="button" data-rameno="+" title="Přidat rameno">+ rameno</button>' : '');
    const ed = $('editorRamene');
    const r = p.ramena[aktivni];
    if (!r) { ed.innerHTML = '<p class="napoveda">Věšák nemá žádné rameno.</p>'; return; }
    const c = `ramena.${aktivni}`;
    // druh ramene
    let h = '<div class="segment" role="group" aria-label="Druh ramene">' + Object.entries(K.DRUHY_RAMEN).map(([k, v]) =>
      `<button type="button" data-druh-ramene="${k}" aria-pressed="${k === r.druh}"><span aria-hidden="true">${v.znak}</span>${esc(v.nazev)}</button>`).join('') + '</div>';
    const spolecne = polePrvek(c + '.y', r.druh === 'blok' ? 'Výška horní hrany' : r.druh === 'hrib' ? 'Výška osy' : 'Výška kořene', 'mm', 'U čela štítku, měřeno od spodku štítku')
      + polePrvek(c + '.uhel', 'Úhel u štítku', '°', '0° = vodorovně od zdi, kladný nahoru')
      + polePrvek(c + '.x', 'Posun do strany', 'mm', 'Zepředu: 0 = na ose štítku, záporný doleva, kladný doprava')
      + polePrvek(c + '.sirka', 'Šířka ramene', 'mm', '0 = šířka ramen ze štítku');
    if (r.druh === 'blok') {
      h += '<div class="mrizka">' + spolecne + polePrvek(c + '.delka', 'Délka (vyložení)', 'mm') + polePrvek(c + '.h0', 'Výška u štítku', 'mm')
        + polePrvek(c + '.h1', 'Výška na konci', 'mm', 'Menší než u štítku = klín') + polePrvek(c + '.sklon', 'Sklon horní plochy', '°', 'Kladný = konec výš, poutko drží líp')
        + polePrvek(c + '.zub', 'Zub na konci', 'mm', 'Výška lemu nahoru na konci, 0 = bez zubu') + polePrvek(c + '.zubTl', 'Tloušťka zubu', 'mm')
        + polePrvek(c + '.zaobleni', 'Zaoblení rohů', 'mm') + '</div>';
    } else if (r.druh === 'hrib') {
      h += '<div class="mrizka">' + spolecne + polePrvek(c + '.delka', 'Délka (vyložení)', 'mm') + polePrvek(c + '.tl', 'Tloušťka dříku', 'mm')
        + polePrvek(c + '.nahoru', 'Hlava nahoru', 'mm', 'O kolik hlava přesahuje dřík nahoru – drží poutko') + polePrvek(c + '.dolu', 'Hlava dolů', 'mm')
        + polePrvek(c + '.hlavaTl', 'Tloušťka hlavy', 'mm') + '</div>';
    }
    if (r.druh !== 'trasa') {
      h += `<div class="pridat-seg" style="margin-top:10px"><button type="button" class="tl" id="btnKopieRamene"${p.ramena.length < K.MAX_RAMEN ? '' : ' disabled'}>⧉ Zdvojit rameno</button>`
        + `<button type="button" class="tl" id="btnSmazRameno">🗑 Odebrat rameno ${aktivni + 1}</button></div>`;
      ed.innerHTML = h;
      ed.querySelectorAll('[data-p]').forEach(el => { napoj(el); naplnPole(el); });
      viditelnost();
      return;
    }
    h += '<div class="mrizka">' + spolecne
      + polePrvek(c + '.tl0', 'Tloušťka u těla', 'mm')
      + polePrvek(c + '.tl1', 'Tloušťka na konci', 'mm')
      + `<div class="pole"><label for="f_konec">Konec</label><select id="f_konec" data-p="${c}.konec" data-typ="text">${Object.entries(K.KONCE).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>`
      + `<div data-koule>${polePrvek(c + '.rKonec', 'Poloměr koule', 'mm')}</div>`
      + '</div>';
    h += '<div class="popisek" style="margin-top:10px">Trasa ramene od těla ke konci</div><div class="segmenty">';
    r.trasa.forEach((g, j) => {
      const cs = `${c}.trasa.${j}`;
      h += `<div class="seg-radek"><span class="cislo-seg">${j + 1}.</span><div class="seg-pole">`
        + `<div class="pole"><label for="f_${cs.replace(/\./g, '_')}_t">Úsek</label><select id="f_${cs.replace(/\./g, '_')}_t" data-druh="${j}">`
        + Object.entries(K.DRUHY_SEGMENTU).map(([k, v]) => `<option value="${k}"${k === g.t ? ' selected' : ''}>${v.znak} ${v.nazev}</option>`).join('') + '</select></div>'
        + Object.keys(K.VYCHOZI_SEGMENT[g.t]).filter(k => k !== 't').map(k => polePrvek(`${cs}.${k}`, g.t === 's' && k === 'r' ? 'Poloměr od' : POLE_SEGMENTU[k][0], POLE_SEGMENTU[k][1],
          k === 'u' ? (g.t === 'z' ? 'Ostrá změna směru: + nahoru, − dolů' : '+ stáčí nahoru (proti směru hodinek při pohledu zprava), − dolů') : '')).join('')
        + `</div><div class="seg-tl"><button type="button" class="tl" data-posun="${j}:-1" title="Posunout výš" aria-label="Posunout úsek ${j + 1} výš"${j ? '' : ' disabled'}>↑</button>`
        + `<button type="button" class="tl" data-posun="${j}:1" title="Posunout níž" aria-label="Posunout úsek ${j + 1} níž"${j < r.trasa.length - 1 ? '' : ' disabled'}>↓</button>`
        + `<button type="button" class="tl" data-smaz="${j}" title="Odebrat úsek" aria-label="Odebrat úsek ${j + 1}">✕</button></div></div>`;
    });
    h += '</div>';
    if (r.trasa.length < K.MAX_SEGMENTU) h += '<div class="pridat-seg">' + Object.entries(K.DRUHY_SEGMENTU).map(([k, v]) => `<button type="button" class="tl" data-pridat="${k}">+ ${v.znak} ${v.nazev}</button>`).join('') + '</div>';
    h += `<div class="pridat-seg" style="margin-top:10px"><button type="button" class="tl" id="btnKopieRamene"${p.ramena.length < K.MAX_RAMEN ? '' : ' disabled'}>⧉ Zdvojit rameno</button>`
      + `<button type="button" class="tl" id="btnSmazRameno">🗑 Odebrat rameno ${aktivni + 1}</button></div>`;
    ed.innerHTML = h;
    ed.querySelectorAll('[data-p]').forEach(el => { napoj(el); naplnPole(el); });
    viditelnost();
  }
  const upravTrasu = fn => { zmen(x => fn(x.ramena[aktivni].trasa, x.ramena[aktivni])); naplnFormular(); };
  $('ramenaZal').addEventListener('click', e => {
    const b = e.target.closest('[data-rameno]'); if (!b) return;
    if (b.dataset.rameno === '+') {
      zmen(x => {
        const posl = x.ramena[x.ramena.length - 1], q = K.kopie(K.VYCHOZI_RAMENO);
        q.y = posl ? Math.min(x.telo.vyska - q.tl0 / 2, posl.y + 25) : x.telo.vyska * 0.6;
        if (posl) { q.druh = posl.druh; q.sirka = posl.sirka; q.x = posl.x; }
        x.ramena.push(q);
      });
      aktivni = p.ramena.length - 1;
    } else aktivni = +b.dataset.rameno;
    naplnFormular();
  });
  $('editorRamene').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.druhRamene) { zmen(x => { x.ramena[aktivni].druh = b.dataset.druhRamene; }); naplnFormular(); return; }
    if (b.dataset.pridat) upravTrasu(t => t.push(K.kopie(K.VYCHOZI_SEGMENT[b.dataset.pridat])));
    else if (b.dataset.smaz) upravTrasu(t => t.splice(+b.dataset.smaz, 1));
    else if (b.dataset.posun) { const [j, d] = b.dataset.posun.split(':').map(Number); upravTrasu(t => { const x = t[j]; t[j] = t[j + d]; t[j + d] = x; }); }
    else if (b.id === 'btnKopieRamene') { zmen(x => { const q = K.kopie(x.ramena[aktivni]); q.y = Math.min(x.telo.vyska, q.y + 20); x.ramena.splice(aktivni + 1, 0, q); }); aktivni++; naplnFormular(); }
    else if (b.id === 'btnSmazRameno') { zmen(x => x.ramena.splice(aktivni, 1)); naplnFormular(); }
  });
  $('editorRamene').addEventListener('change', e => {
    const s = e.target.closest('[data-druh]'); if (!s) return;
    // nový druh úseku: převzít, co se dá (poloměr, úhel)
    upravTrasu(t => { const j = +s.dataset.druh, st = t[j], q = K.kopie(K.VYCHOZI_SEGMENT[s.value]); for (const k of Object.keys(q)) if (k !== 't' && st[k] != null) q[k] = st[k]; t[j] = q; });
  });

  /* ---------- galerie tvarů (profil zboku jako SVG) ---------- */
  const profilSvg = VESAKY_VYKRES.profilSvg;
  let skupinaGal = null;
  K.PREDVOLBY.forEach((v, i) => {
    if (v.skupina !== skupinaGal) { skupinaGal = v.skupina; const hd = document.createElement('div'); hd.className = 'galerie-skupina'; hd.textContent = v.skupina; $('galerie').appendChild(hd); }
    const b = document.createElement('button'); b.type = 'button'; b.title = `${v.nazev} – ${v.popis} (úchyt a tisk zůstanou)`;
    b.innerHTML = profilSvg(K.zPredvolby(i)) + esc(v.nazev);
    b.addEventListener('click', () => {
      const q = K.zPredvolby(i);
      nahrad(Object.assign(q, { uchyt: Object.assign(K.kopie(p.uchyt), v.p.uchyt || {}), tisk: p.tisk, zatez: p.zatez }));
      aktivni = 0; naplnFormular();
    });
    $('galerie').appendChild(b);
  });
  let semeno = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  function generuj(obmenit) {
    semeno = (semeno * 1664525 + 1013904223) >>> 0;
    const r = obmenit ? K.obmena(p, semeno) : K.nahodnyTvar(p, semeno);
    if (!r.pokusu) { $('pPokusu').textContent = obmenit ? 'Obměna nenašla vyhovující tvar – zkuste znovu.' : 'Nepodařilo se najít tvar, který by na toto tělo vyhověl – zkuste znovu nebo zvětšete tělo.'; return; }
    const vlastni = p.nazev && !/^(Věšák|Náhodný tvar \d+)$/.test(p.nazev) && !K.PREDVOLBY.some(v => v.nazev === p.nazev);
    if (!obmenit) r.p.nazev = vlastni ? p.nazev : `Náhodný tvar ${semeno % 10000}`;
    aktivni = 0;
    nahrad(r.p);
    $('pPokusu').textContent = `${obmenit ? 'Obměna' : 'Tvar'} vyhověl na ${r.pokusu}. pokus.`;
  }
  $('btnNahodny').addEventListener('click', () => generuj(false));
  $('btnObmena').addEventListener('click', () => generuj(true));

  /* ---------- přepočet ---------- */
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const posun = (poz, dx, dy) => { const out = Float32Array.from(poz); for (let i = 0; i < out.length; i += 3) { out[i] += dx; out[i + 1] += dy; } return out; };
  /** Díly v tiskové poloze. Věšák: na boku nebo zády dolů (automaticky = méně převisů, při shodě na boku kvůli pevnosti). */
  function sestavTisk(r) {
    const hr = p.telo.hranaTyp === 'zkoseni' ? p.telo.hrana : 0;
    const polohy = { bok: { R: K.rotaceDolu([1, 0, 0]), hrana: hr, nazev: 'na boku' }, zada: { R: K.rotaceDolu([0, 0, -1]), hrana: 0, nazev: 'zády dolů' } };
    for (const v of Object.values(polohy)) Object.assign(v, K.previsyDilu(r.hacek, v.R, p, v.hrana));
    let orient = p.tisk.orientace;
    if (orient === 'auto') orient = polohy.zada.volne < polohy.bok.volne * 0.7 - 5 ? 'zada' : 'bok';
    const hv = polohy[orient];
    const hacek = { dil: 'hacek', nazev: 'Věšák', sit: r.hacek, barva: '#3F7BD6', role: 'hlavni', poz: hv.poz, tridy: hv.tridy, volne: hv.volne, most: hv.most, vyska: hv.vyska, orient, polohy };
    const uv = K.previsyDilu(r.uchyt, K.rotaceDolu([0, 0, -1]), p, 0);
    const uchyt = { dil: 'uchyt', nazev: 'Úchyt na zeď', sit: r.uchyt, barva: '#8FA9CF', role: 'deska', poz: uv.poz, tridy: uv.tridy, volne: uv.volne, most: uv.most, vyska: uv.vyska };
    return [hacek, uchyt].map(d => Object.assign(d, { idx: d.sit.idx, objem: d.sit.objem, plocha: d.sit.plocha, ks: KRAB.kontrolaSite(d.poz, d.sit.idx) }));
  }
  function kusyNaPodlozku(jen) {
    const out = [], ks = p.tisk.ks;
    for (const d of model.tisk) {
      if (jen && d.dil !== jen) continue;
      for (let i = 0; i < ks; i++) out.push({ jmeno: d.dil, nazev: (p.nazev || 'Věšák') + ' – ' + d.nazev + (ks > 1 ? ` ${i + 1}` : ''), poz: d.poz, idx: d.idx, tridy: d.tridy, role: d.role, barva: d.barva });
    }
    return rozloz(out, 6);
  }
  /** Díly do řad na podložku ≈ 220 mm, vystředěné kolem počátku, vše na z = 0. */
  function rozloz(dily, mezera, sirka = 220) {
    const obal = poz => { const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      for (let i = 0; i < poz.length; i += 3) for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], poz[i + k]); b[k + 3] = Math.max(b[k + 3], poz[i + k]); } return b; };
    const s = dily.map(d => ({ d, b: obal(d.poz) }));
    let x = 0, y = 0, rada = 0, maxX = 0;
    const umisteni = s.map(({ d, b }) => {
      const w = b[3] - b[0], h = b[4] - b[1];
      if (x > 0 && x + w > sirka) { x = 0; y += rada + mezera; rada = 0; }
      const pos = [x - b[0], y - b[1], -b[2]];
      x += w + mezera; rada = Math.max(rada, h); maxX = Math.max(maxX, x - mezera);
      return { d, pos };
    });
    const cx = maxX / 2, cy = (y + rada) / 2;
    return umisteni.map(({ d, pos }) => {
      const poz = new Float32Array(d.poz.length);
      for (let i = 0; i < poz.length; i += 3) { poz[i] = d.poz[i] + pos[0] - cx; poz[i + 1] = d.poz[i + 1] + pos[1] - cy; poz[i + 2] = d.poz[i + 2] + pos[2]; }
      return Object.assign({}, d, { poz });
    });
  }
  /** Vrut se zápustnou hlavou v ose z: vrchol hlavy v zHlava, délka L (síť pro náhled). */
  function sitVrutu(x, y, d, hlava, L, zHlava) {
    const N = VESAKY_NAHLED, hk = (hlava - d) / 2, r = d / 2 * 0.92;
    return N.spoj([N.sitValce(x, y, r, hlava / 2, zHlava - hk, zHlava, 24), N.sitValce(x, y, r, r, zHlava - L + 2.5, zHlava - hk + 0.01, 18),
      N.sitValce(x, y, 0.15, r, zHlava - L, zHlava - L + 2.5, 18)]);
  }
  function nastavNahled() {
    if (!model) { nahled.nastav(null); return; }
    const o = model.o, uch = o.uch, u = p.uchyt, dy = nasazeni ? uch.vrchKapsy + 12 : 0;
    // řada věšáků na zdi (v náhledu nejvýš 8); u každého dílu vektor rozpadu a kotva montážní čáry
    const kolik = Math.min(8, p.montaz.pocet), roz = p.montaz.rozestup, montaz = [], duchove = [];
    const zHlava = u.hloubka - 0.35, vrt = K.vrtak(p), delkaHm = Math.min(o.zed.kotva + p.montaz.omitka, o.delkaVrutu - 4);
    for (let i = 0; i < kolik; i++) {
      const x = i * roz;
      montaz.push({ poz: posun(model.hacek.poz, x, dy), idx: model.hacek.idx, role: 'hlavni', rozpad: [0, uch.vrchKapsy + 18, 60], kotva: [x, p.telo.vyska, p.telo.hloubka / 2] });
      montaz.push({ poz: posun(model.uchyt.poz, x, uch.dole), idx: model.uchyt.idx, role: 'deska', rozpad: [0, 0, 24], kotva: [x, uch.dole + u.vyska / 2, u.hloubka] });
      for (const ys of uch.srouby) {
        const y = ys + uch.dole, vr = sitVrutu(x, y, uch.sr.d, uch.sr.hlava, o.delkaVrutu, zHlava);
        montaz.push({ poz: vr.poz, idx: vr.idx, role: 'deska', barva: '#c9b26b', kov: true, rozpad: [0, 0, 24 + o.delkaVrutu + 12], kotva: [x, y, zHlava] });
        if (p.montaz.zed !== 'drevo') {
          const hm = VESAKY_NAHLED.sitValce(x, y, vrt / 2, vrt / 2 * 0.8, -delkaHm, 0, 16);
          montaz.push({ poz: hm.poz, idx: hm.idx, role: 'deska', barva: '#e6e1d3', rozpad: [0, 0, delkaHm + 6], kotva: [x, y, 0] });
        }
      }
    }
    for (const d of model.duchove) if (d.druh === 'dvere') duchove.push({ druh: 'zed', min: [d.min[0], d.min[1], -Math.max(14, delkaHm + 6)], max: [d.max[0] + (kolik - 1) * roz, d.max[1], d.max[2]] });
    nahled.nastav({ klic: 'vesak' + kolik, montaz, tisk: model.podlozka, duchove });
  }
  function prepocitej() {
    p = app.p;
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    let o = K.odvozene(p);
    if (!profil.pracuje) profil.kresli(p, o);
    let H = K.kontroly(p, o);
    model = null; chybaStavby = null;
    const st = $('stav3d');
    if (!wasm) {
      st.textContent = chybaJadra || 'Načítám geometrické jádro…'; st.classList.toggle('chyba', !!chybaJadra);
      nastavNahled();
      vypis(chybaJadra ? H.concat([{ uroven: 'chyba', text: chybaJadra, pole: [] }]) : H, o, null);
      return;
    }
    {
      try {
        const t0 = performance.now();
        const r = VESAKY_GEOM.postav(wasm, p, o);
        model = { o, hacek: r.hacek, uchyt: r.uchyt, duchove: r.duchove, tisk: sestavTisk(r), cas: 0 };
        // zády dolů vedou vrstvy napříč rameny → pevnost a kontroly podle skutečné orientace
        if (model.tisk[0].orient === 'zada') { o = K.odvozene(p, 'zada'); model.o = o; H = K.kontroly(p, o); }
        model.podlozka = kusyNaPodlozku();
        model.cas = performance.now() - t0;
        for (const d of model.tisk) {
          if (!d.ks.uzavrena) H.push({ uroven: 'chyba', text: `Síť dílu „${d.nazev}“ není uzavřená – export by nemusel jít vytisknout.`, pole: [] });
          if (d.ks.teles > 1) H.push({ uroven: 'chyba', text: `${d.nazev} se rozpadl na ${d.ks.teles} kusy – nějaká část nedrží s tělem (rameno mimo tělo, kapsa přes celou tloušťku).`, pole: [] });
          // tvarovaný štítek nebo užší ramena / obrysy vedle sebe = záměr, podpory jsou nutné → jen informace
          const zamer = p.telo.tvar !== 'obdelnik' || p.telo.sirkaRamen > 0 || p.ramena.some(r => r.sirka > 0 || r.x) || p.obrysy.some(ob => ob.sirka > 0 || ob.x);
          if (d.volne > 3) H.push({ uroven: d.dil === 'hacek' && zamer ? 'info' : 'varovani',
            text: `${d.nazev}: při tisku ${d.orient ? (d.orient === 'zada' ? 'zády dolů ' : 'na boku ') : ''}visí ${fmt(d.volne, 0)} mm² bez opory${d.dil === 'hacek' && p.telo.hranaTyp === 'zaobleni' && d.orient === 'bok' ? ' (spodní zaoblená hrana) – zvolte zkosení, nebo tiskněte s podporami' : ' – tiskněte s podporami'}.`,
            pole: d.dil === 'hacek' ? ['tisk.orientace'] : [] });
          if (d.orient === 'zada' && o.ramena.length) H.push({ uroven: 'info', text: 'Věšák se tiskne zády dolů: vrstvy vedou napříč rameny, pevnost ramen je asi poloviční (počítá se s tím).', pole: ['tisk.orientace'] });
        }
      } catch (e) {
        chybaStavby = 'Těleso nejde sestavit: ' + (e && e.message || e);
        H.push({ uroven: 'chyba', text: chybaStavby, pole: [] });
        model = null;
      }
    }
    st.textContent = chybaStavby || ''; st.classList.toggle('chyba', !!chybaStavby);
    nastavNahled();
    vypis(H, o, model);
  }

  /* ---------- výpisy ---------- */
  const dl = (popis, cislo, dalsi = '', tr = '') => `<div class="dlazdice"><div class="popis">${popis}</div><div class="cislo ${tr}">${cislo}</div>${dalsi ? `<div class="dalsi">${dalsi}</div>` : ''}</div>`;
  const cas = m => (m < 90 ? fmt(m, 0) + ' min' : fmt(m / 60, 1) + ' h');
  const kg = x => (Number.isFinite(x) ? (x > 99 ? '> 99' : fmt(x, x < 10 ? 1 : 0)) + ' kg' : '–');
  const trida = k => (k >= 2 ? 'ok' : k >= 1.2 ? 'mez' : 'chyba');
  function vypis(H, o, m) {
    const mat = K.MATERIALY[p.tisk.material], ks = p.tisk.ks, uch = o.uch;
    let v = '';
    const celkem = { g: 0, min: 0 };
    const pev = K.pevnost(p, o);
    const kmin = pev.radky.length ? Math.min(...pev.radky.map(r => r.k)) : Infinity;
    // nosnost jen z ramen (u vlastních obrysů ji neumíme spočítat)
    const unese = pev.radky.some(r => r.rameno) ? Math.min(...pev.radky.map(r => r.unese)) : NaN;
    if (m) {
      for (const d of m.tisk) {
        const b = d.ks.bbox; d.odhad = K.odhadTisku(d.objem, d.plocha, b[5] - b[2], p);
        celkem.g += d.odhad.gramy * ks; celkem.min += d.odhad.minut * ks;
      }
    }
    v += dl('Rozměr', `${fmt(p.telo.sirka)} × ${fmt(o.yMax - o.yMin)} mm`, `od zdi ${fmt(o.zMax)} mm (šířka × výška × hloubka)`);
    const drzi = o.ramena.filter(a => a.drzi).length;
    v += dl('Ramena', `${drzi} / ${o.ramena.length} drží`, o.ramena.length ? `nejmělčí kapsa ${fmt(Math.min(...o.ramena.map(a => a.hloubka)))} mm` : '', drzi === o.ramena.length && drzi ? 'ok-t' : 'mez-t');
    v += Number.isFinite(unese) ? dl('Unese', kg(unese), `na rameno s bezpečností 2 (${mat.nazev})`, unese >= p.zatez.kg ? 'ok-t' : 'mez-t')
      : dl('Unese', '–', 'věšák zatím nemá nosné rameno ani obrys');
    v += dl('Úchyt', `${fmt(p.uchyt.sirka)} × ${fmt(p.uchyt.vyska)} × ${fmt(p.uchyt.hloubka)} mm`, `${K.PROFILY_UCHYTU[p.uchyt.profil].nazev.toLowerCase()}, ${K.SROUBY[p.uchyt.sroub].nazev} × ${p.uchyt.pocet}`);
    v += dl('Dosednutí', p.uchyt.klin > 0 ? `o ${fmt(uch.pokles)} mm níž` : 'na vršek úchytu', p.uchyt.klin > 0 ? 'klín vymezí vůli, pak věšák drží' : `vůle ${fmt(p.uchyt.vule, 2)} mm na stranu`);
    v += dl('Montáž', `vrut ${fmt(uch.sr.d)} × ${fmt(o.delkaVrutu)} mm`, `${o.zed.nazev}: ${o.zed.hmozdinka}, vrták Ø ${fmt(K.vrtak(p), 1)}`);
    if (m) {
      v += dl('Hmotnost', `≈ ${fmt(celkem.g, 0)} g`, `${mat.nazev}, výplň ${fmt(p.tisk.vypln, 0)} %${ks > 1 ? `, ${ks} kusy` : ''}`);
      v += dl('Doba tisku', `≈ ${cas(celkem.min)}`, 'věšák i úchyt, hrubý odhad (vrstva 0,2 mm)');
    } else v += dl('Model', wasm ? 'nesestaven' : 'načítám…', chybaStavby || '');
    $('vVysledky').innerHTML = v;
    $('sVysledky').textContent = m ? `≈ ${fmt(celkem.g, 0)} g` : '';
    $('tabRamena').innerHTML = o.ramena.length ? '<tr><th>Rameno</th><th class="c">Délka</th><th class="c">Kapsa</th><th class="c">Otvor</th><th class="c">Zátěž od zdi</th><th class="c">Průhyb</th><th class="c">Unese</th></tr>'
      + o.ramena.map((a, i) => `<tr class="klik" data-r="${i}" tabindex="0"><td>${i + 1}${a.drzi ? '' : ' <span class="mez-t">sklouzne</span>'}</td><td class="c">${fmt(a.delka, 0)} mm</td>`
        + `<td class="c ${a.drzi ? 'ok-t' : 'mez-t'}">${fmt(Math.max(0, a.hloubka))} mm</td><td class="c ${Number.isFinite(a.otvor) && a.otvor < 8 ? 'mez-t' : ''}">${Number.isFinite(a.otvor) ? fmt(Math.max(0, a.otvor)) + ' mm' : 'volný'}</td>`
        + `<td class="c">${fmt(a.odstup, 0)} mm</td><td class="c ${a.pruhyb > 3 ? 'mez-t' : ''}">${fmt(a.pruhyb, a.pruhyb < 1 ? 2 : 1)} mm</td><td class="c ${trida(a.unese / p.zatez.kg)}-t">${kg(a.unese)}</td></tr>`).join('') : '';

    // pevnost
    $('tabPevnost').innerHTML = '<tr><th>Místo</th><th class="c">Napětí</th><th class="c">Bezpečnost</th><th class="c">Unese</th><th>Poznámka</th></tr>'
      + pev.radky.map(r => `<tr><td>${esc(r.co)}</td><td class="c">${r.napeti != null ? fmt(r.napeti, 1) + ' MPa' : fmt(r.sila, 0) + ' N'}</td><td class="c ${trida(r.k)}-t">× ${r.k > 99 ? '>99' : fmt(r.k, 1)}</td>`
        + `<td class="c">${kg(r.unese)}</td><td>${esc(r.pozn)}</td></tr>`).join('');
    $('pSrouby').textContent = `Při ${fmt(p.zatez.kg)} kg na každém rameni tahá horní část úchytu ze zdi silou ≈ ${fmt(pev.tah, 0)} N, horní vrut ≈ ${fmt(pev.naSroub, 0)} N`
      + ` (věšák se opře spodkem o zeď a otáčí se kolem něj). Únosnost hmoždinky: ${o.zed.nazev} ≈ ${fmt(o.zed.tah, 0)} N na vrut – orientačně, stav ${K.DATUM_DAT}.`
      + (o.ramena.length ? ` Průhyb ramene pod zátěží ${o.ramena.map(a => fmt(a.pruhyb, 1)).join(' / ')} mm (E ≈ ${fmt(o.E, 0)} MPa${p.tisk.material === 'PLA' ? ', PLA se časem prohne víc' : ''}).` : '');
    $('sPevnost').textContent = Number.isFinite(kmin) ? `× ${kmin > 99 ? '>99' : fmt(kmin, 1)}` : '';

    // výkres a kusovník
    $('vykres').innerHTML = VESAKY_VYKRES.vykresSvg(p, o, 1e9).svg.replace(/ width="[\d.]+mm" height="[\d.]+mm"/, '');
    const kus = K.kusovnik(p, o), nr = p.montaz.pocet;
    const gramy = m ? m.tisk.reduce((s, d) => s + d.odhad.gramy, 0) * nr : 0, minut = m ? m.tisk.reduce((s, d) => s + d.odhad.minut, 0) * nr : 0;
    $('tabKusovnik').innerHTML = '<tr><th class="c">Ks</th><th>Položka</th><th>Poznámka</th></tr>'
      + kus.map(x => `<tr><td class="c">${x.ks}</td><td>${esc(x.co)}</td><td>${esc(x.pozn)}</td></tr>`).join('')
      + (m ? `<tr><td class="c">≈ ${fmt(gramy, 0)} g</td><td>Filament ${mat.nazev}</td><td>≈ ${fmt(m.tisk.reduce((s, d) => s + d.odhad.metru, 0) * nr, 1)} m, tisk ≈ ${cas(minut)} celkem</td></tr>` : '');
    $('pKusovnik').textContent = `Vrut = úchyt ${fmt(p.uchyt.hloubka)} mm + omítka ${fmt(p.montaz.omitka)} mm + kotevní hloubka ${fmt(o.zed.kotva)} mm → nejbližší vyšší délka ${fmt(o.delkaVrutu)} mm.`
      + ` Otvory vrtejte Ø ${fmt(K.vrtak(p), 1)} mm do hloubky ≈ ${fmt(o.zed.kotva + p.montaz.omitka + 5, 0)} mm. Údaje o hmoždinkách jsou orientační – řiďte se výrobcem.`;
    $('pMontaz').textContent = `${o.zed.hmozdinka[0].toUpperCase() + o.zed.hmozdinka.slice(1)}, vrták Ø ${fmt(K.vrtak(p), 1)} mm, vrut ${fmt(uch.sr.d)} × ${fmt(o.delkaVrutu)} mm.`
      + (nr > 1 ? ` Řada ${nr} věšáků zabere ${fmt((nr - 1) * p.montaz.rozestup + p.telo.sirka)} mm.` : '');
    TrubkyGui.souhrn('sMontaz', `${o.zed.nazev}${nr > 1 ? `, ${nr} ks po ${fmt(p.montaz.rozestup)}` : ''}`);
    TrubkyGui.souhrn('sZkouska', VESAKY_GEOM.vuleZkousky(p).map(x => fmt(x, 2)).join(' · '));

    // tisk
    $('pMaterial').textContent = mat.pozn + ` Orientační pevnost ve vrstvě ${mat.pevnost} MPa.`;
    $('tabTisk').innerHTML = m ? '<tr><th>Díl</th><th class="c">Ks</th><th class="c">Rozměr tisku</th><th class="c">Hmotnost</th><th class="c">Čas</th><th class="c">Bez opory</th></tr>'
      + m.tisk.map(d => { const b = d.ks.bbox; return `<tr><td>${esc(d.nazev)}</td><td class="c">${ks}</td><td class="c">${fmt(b[3] - b[0], 0)} × ${fmt(b[4] - b[1], 0)} × ${fmt(b[5] - b[2], 0)} mm</td>`
        + `<td class="c">${fmt(d.odhad.gramy, 0)} g</td><td class="c">${cas(d.odhad.minut)}</td><td class="c ${d.volne > 3 ? 'mez-t' : 'ok-t'}">${d.volne > 3 ? fmt(d.volne, 0) + ' mm²' : 'bez podpor'}</td></tr>`; }).join('') : '';
    if (m) {
      // srovnání orientací věšáku
      const hk = m.tisk[0];
      $('tabTisk').innerHTML += `<tr><th colspan="6">Věšák – orientace</th></tr>` + Object.entries(hk.polohy).map(([kl, v]) => `<tr class="klik${kl === hk.orient ? ' vybrana' : ''}" data-orient="${kl}" tabindex="0">`
        + `<td>${kl === hk.orient ? '★ ' : ''}${v.nazev}</td><td></td><td class="c">výška ${fmt(v.vyska, 0)} mm</td><td class="c">mosty ${fmt(v.most, 0)} mm²</td><td>${kl === 'bok' ? 'vrstvy podél ramen' : 'vrstvy napříč (× 0,5)'}</td>`
        + `<td class="c ${v.volne > 3 ? 'mez-t' : 'ok-t'}">${v.volne > 3 ? fmt(v.volne, 0) + ' mm²' : 'bez podpor'}</td></tr>`).join('');
    }
    $('sTisk').textContent = m ? (m.tisk.some(d => d.volne > 3) ? 's podporami' : 'bez podpor') : '';

    $('vSit').innerHTML = m ? m.tisk.map(d => dl('Síť – ' + d.nazev.toLowerCase(), d.ks.uzavrena ? '✔ uzavřená' : '✖ otevřená',
      `${d.ks.trojuhelniku} trojúhelníků, ${d.ks.teles} těleso`, d.ks.uzavrena && d.ks.teles === 1 ? 'ok-t' : 'chyba-t')).join('') + dl('Výpočet', `${fmt(m.cas, 0)} ms`, 'stavba a rozbor tisku') : '';
    $('karta3d').innerHTML = m ? `<div class="titul">Věšák</div><b>${esc(p.nazev || 'Věšák')}</b><br>${esc(K.popis(p))}<br>`
      + `<b>${fmt(celkem.g, 0)}</b> g ${mat.nazev} · unese <b>${kg(unese)}</b>` : '';
    legenda();
    TrubkyGui.souhrn('sTelo', `${fmt(p.telo.sirka)} × ${fmt(p.telo.vyska)} × ${fmt(p.telo.hloubka)}`);
    TrubkyGui.souhrn('sUchyt', `${K.PROFILY_UCHYTU[p.uchyt.profil].nazev.split(' ')[0]} ${fmt(p.uchyt.sirka)} × ${fmt(p.uchyt.vyska)}${p.uchyt.klin ? ', klín' : ''}`);
    TrubkyGui.souhrn('sSrouby', `${p.uchyt.pocet} × ${fmt(K.SROUBY[p.uchyt.sroub].d)} mm`);
    TrubkyGui.souhrn('sRamena', `${p.ramena.length}`);

    if (!wasm && !chybaJadra) H = H.concat([{ uroven: 'info', text: 'Načítám geometrické jádro (manifold-3d)…', pole: [] }]);
    if (!H.some(x => x.uroven !== 'info')) H.unshift({ uroven: 'ok', text: 'Vše v pořádku – věšák drží, dá se vytisknout bez podpor.', pole: [] });
    app.hlaseni(H, { boxy: ['boxUchyt'] });
    // ramena se kreslí jen pro vybrané – chyba ve kterémkoli ramenu označí box Tvar
    TrubkyGui.oznacChybu('boxTvar', H.some(x => x.uroven === 'chyba' && x.pole.some(c => c.startsWith('ramena') || c.startsWith('obrysy'))));
  }
  /** Hlášení vypisuje G3D.aplikace; skok vede přes vlastní jdiNaPole (přepne rameno, najde viditelné pole)
      a oprava může měnit víc polí naráz (oprava.vice) – posluchače v zachytávací fázi předběhnou ty z jádra. */
  function hlaseniNavic(li, x) {
    if (x.pole.length) {
      const jdi = e => {
        if ((e.type === 'keydown' && e.key !== 'Enter') || e.target.tagName === 'BUTTON') return;
        e.stopImmediatePropagation(); jdiNaPole(x.pole[0]);
      };
      li.addEventListener('click', jdi, true); li.addEventListener('keydown', jdi, true);
    }
    const b = x.oprava && x.oprava.vice && li.querySelector('.oprava');
    if (b) b.addEventListener('click', e => {
      e.stopImmediatePropagation();
      zmen(q2 => { K.poloz(q2, x.oprava.pole, x.oprava.hodnota); for (const [c, h] of x.oprava.vice) K.poloz(q2, c, h); }); naplnFormular();
    }, true);
  }
  function jdiNaPole(cesta) {
    const m = /^ramena\.(\d+)/.exec(cesta);
    if (m && +m[1] !== aktivni) { aktivni = +m[1]; naplnFormular(); }
    const el = [...document.querySelectorAll(`[data-p="${cesta}"]`)].find(e => !e.closest('[hidden]')) || document.querySelector(`[data-p="${cesta}"]`)
      || (cesta.endsWith('.trasa') ? document.querySelector('#editorRamene .segmenty [data-p]') : null);
    if (!el) return;
    const det = el.closest('details'); if (det) det.open = true;
    const tel = el.closest('.zalozka-telo'); if (tel) TrubkyGui.otevriZalozku(tel.dataset.telo);
    const bx = el.closest('[data-box]'); TrubkyGui.ukazBox(bx ? bx.dataset.box : 'obecne');
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.focus({ preventScroll: true });
    el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
  }
  $('tabTisk').addEventListener('click', e => { const tr = e.target.closest('tr[data-orient]'); if (tr) { zmen(x => { x.tisk.orientace = tr.dataset.orient; }); naplnFormular(); } });
  $('tabRamena').addEventListener('click', e => { const tr = e.target.closest('tr[data-r]'); if (tr) { aktivni = +tr.dataset.r; naplnFormular(); TrubkyGui.ukazBox('out'); } });

  /* ---------- 2D skicář: profil zboku a štítek zepředu ---------- */
  const zprava = t => { $('profilZprava').textContent = t; };
  const profil = VESAKY_PROFIL.vytvor($('profilSvg'), {
    zmen: (fn, klic) => { zmen(fn, klic); },
    vyberRameno: i => { aktivni = i; naplnFormular(); },
    stav: zprava,
    kurzor: (b, rz) => { $('profilKurzor').textContent = `${rz === 'bok' ? 'z' : 'x'} ${fmt(b[0], 1)} · y ${fmt(b[1], 1)} mm`; },
    nastroj: nz => document.querySelectorAll('[data-nastroj]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.nastroj === nz))),
    vyber: (v, obrysy) => {
      const P = v.ob != null && v.bod != null && obrysy[v.ob] ? obrysy[v.ob].body[v.bod] : null;
      $('profilBod').hidden = !P;
      if (P) for (const [id, h] of [['pbX', P.x], ['pbY', P.y]]) if (document.activeElement !== $(id)) $(id).value = des(h);
      seznamObrysu();
    },
    symetrie: z => $('btnSymetrie').setAttribute('aria-pressed', String(z)),
    wasm: () => wasm,
  });
  document.querySelectorAll('[data-nastroj]').forEach(b => b.addEventListener('click', () => { profil.nastroj(b.dataset.nastroj); profil.svg.focus(); }));
  const cisloZ = async (otazka, vychozi) => { const t = await Dialog.zeptej(otazka, vychozi); return t == null ? NaN : K.cislo(t, NaN); };
  const PAKCE = {
    otocL: () => profil.akce.otoc(15), otocP: () => profil.akce.otoc(-15),
    sjednot: () => profil.akce.bool('sjednot'), odecti: () => profil.akce.bool('odecti'), prunik: () => profil.akce.bool('prunik'),
    async meritko() { if (profil.st.vyber.ob == null) return zprava('Vyberte obrys.'); const k = await cisloZ('Změna velikosti vybraného obrysu v procentech:', '100'); if (k > 0) profil.akce.meritko(k / 100); },
    async zaobli() { if (profil.st.vyber.bod == null) return zprava('Vyberte rohový bod.'); const r = await cisloZ('Poloměr zaoblení rohu (mm):', '3'); if (r > 0) profil.akce.zaobli(r); },
    async odsad() { if (profil.st.vyber.ob == null) return zprava('Vyberte obrys.'); const d = await cisloZ('Odsazení obrysu v mm (kladné = ven, záporné = dovnitř); vznikne nový obrys:', '2'); if (Number.isFinite(d) && d) profil.akce.odsad(d, true); },
  };
  document.querySelectorAll('[data-pakce]').forEach(b => b.addEventListener('click', () => { (PAKCE[b.dataset.pakce] || profil.akce[b.dataset.pakce])(); }));
  for (const [id, osa] of [['pbX', 'x'], ['pbY', 'y']]) $(id).addEventListener('change', () => profil.akce.souradnice(osa, K.cislo($(id).value, NaN)));
  $('selKrok').addEventListener('change', () => { const k = +$('selKrok').value; profil.st.mrizka = k > 0; if (k > 0) profil.st.krok = k; });
  $('btnBody').addEventListener('click', () => { profil.st.body = !profil.st.body; $('btnBody').setAttribute('aria-pressed', String(profil.st.body)); });
  $('btnSymetrie').addEventListener('click', () => { profil.st.symetrie = !profil.st.symetrie; $('btnSymetrie').setAttribute('aria-pressed', String(profil.st.symetrie)); profil.kresli(); });
  $('btnCele').addEventListener('click', () => profil.cele());
  $('btnRamenoObrys').addEventListener('click', () => {
    const r = p.ramena[aktivni];
    if (!r) return zprava('Není vybrané žádné rameno.');
    if (p.obrysy.length + 2 > K.MAX_OBRYSU) return zprava(`Nejvýš ${K.MAX_OBRYSU} obrysů.`);
    zmen(x => { const a = K.odvozene(x).ramena[aktivni]; x.obrysy.push(...K.ramenoNaObrys(x.ramena[aktivni], a, x.telo)); x.ramena.splice(aktivni, 1); });
    naplnFormular(); zobraz('bok');
    zprava(`Rameno ${aktivni + 1} je teď vlastní obrys – body můžete táhnout, převádět na křivky (◇/◯, ⌇).`);
  });

  /* podkladový obrázek k obkreslení (jen v této relaci, neukládá se) */
  function ukazPodklad() {
    const pk = profil.podklady[profil.st.rezim];
    $('podkladLista').hidden = !pk;
    if (pk) { if (document.activeElement !== $('pkSirka')) $('pkSirka').value = des(Math.round(pk.sirka * 10) / 10); $('pkPruh').value = pk.pruhlednost; }
  }
  $('btnPodklad').addEventListener('click', () => $('souborPodklad').click());
  $('souborPodklad').addEventListener('change', e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        const o = K.odvozene(p), rz = profil.st.rezim, vys = Math.max(40, o.yMax - o.yMin), sirka = vys * img.naturalWidth / img.naturalHeight;
        profil.podklad(rz, { src: rd.result, pomer: img.naturalHeight / img.naturalWidth, sirka, vyska: vys, x: rz === 'bok' ? 0 : -sirka / 2, y: o.yMin, pruhlednost: 0.5 });
        ukazPodklad(); profil.nastroj('podklad');
        zprava('Podklad načten – táhněte ho na místo, velikost nastavte podle známého rozměru (šířka v mm). Podklad se neukládá.');
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(f);
  });
  $('pkSirka').addEventListener('change', () => {
    const pk = profil.podklady[profil.st.rezim], w = K.cislo($('pkSirka').value, NaN);
    if (pk && w > 0) { pk.sirka = w; pk.vyska = w * pk.pomer; profil.podklad(profil.st.rezim, pk); }
  });
  $('pkPruh').addEventListener('input', () => { const pk = profil.podklady[profil.st.rezim]; if (pk) { pk.pruhlednost = +$('pkPruh').value; profil.podklad(profil.st.rezim, pk); } });
  $('pkSmaz').addEventListener('click', () => { profil.podklad(profil.st.rezim, null); ukazPodklad(); if (profil.st.nastroj === 'podklad') profil.nastroj('vyber'); });

  /* seznam obrysů skici (podle pohledu) */
  const cestaObrysu = () => (profil.st.rezim === 'bok' ? 'obrysy' : 'telo.vlastni');
  function seznamObrysu() {
    if (!p) return;
    const bok = profil.st.rezim === 'bok', arr = bok ? p.obrysy : p.telo.tvar === 'vlastni' ? p.telo.vlastni : [];
    const v = profil.st.vyber, sel = new Set(v.obs.concat(v.ob != null ? [v.ob] : []));
    $('pObrysyRezim').textContent = bok ? 'Háček zboku – vlastní obrysy (ramena se upravují níž). Šířka 0 = jako ramena, posun = do strany zepředu.'
      : p.telo.tvar === 'vlastni' ? 'Štítek zepředu – plné obrysy tvoří štítek, díry jsou ozdobné průřezy.' : `Štítek má přednastavený tvar (${K.TVARY_STITKU[p.telo.tvar].nazev.toLowerCase()}) – první úprava ve skicáři ho převede na vlastní.`;
    TrubkyGui.souhrn('sObrysy', `${p.obrysy.length} + ${p.telo.tvar === 'vlastni' ? p.telo.vlastni.length : 0}`);
    $('seznamObrysu').innerHTML = arr.map((ob, i) => `<div class="obrys-radek${sel.has(i) ? ' vybrany' : ''}" data-i="${i}">`
      + `<input type="text" data-k="nazev" value="${esc(ob.nazev)}" placeholder="Obrys ${i + 1}" aria-label="Název obrysu ${i + 1}" maxlength="40">`
      + `<select data-k="dira" aria-label="Plný nebo díra"><option value="0"${ob.dira ? '' : ' selected'}>plný</option><option value="1"${ob.dira ? ' selected' : ''}>díra</option></select>`
      + (bok ? `<input type="text" data-k="sirka" inputmode="decimal" value="${des(ob.sirka)}" title="Šířka obrysu v mm, 0 = jako ramena" aria-label="Šířka obrysu ${i + 1}">`
        + `<input type="text" data-k="x" inputmode="decimal" value="${des(ob.x || 0)}" title="Posun do strany (zepředu) v mm" aria-label="Posun obrysu ${i + 1}">` : '<span></span><span></span>')
      + `<span><button type="button" class="tl" data-pos="-1" title="Výš v pořadí"${i ? '' : ' disabled'}>↑</button><button type="button" class="tl" data-pos="1" title="Níž v pořadí"${i < arr.length - 1 ? '' : ' disabled'}>↓</button>`
      + `<button type="button" class="tl" data-smaz title="Smazat obrys">🗑</button></span></div>`).join('') || '<p class="napoveda">Zatím žádné obrysy – nakreslete je perem ✒ ve skicáři.</p>';
  }
  const radekObrysu = e => { const r = e.target.closest('.obrys-radek'); return r ? +r.dataset.i : -1; };
  $('seznamObrysu').addEventListener('click', e => {
    const i = radekObrysu(e); if (i < 0) return;
    const c = cestaObrysu(), b = e.target.closest('button');
    if (b && b.dataset.pos) { const d = +b.dataset.pos; zmen(x => { const a = K.vezmi(x, c); const t = a[i]; a[i] = a[i + d]; a[i + d] = t; }); return; }
    if (b && b.hasAttribute('data-smaz')) { zmen(x => { K.vezmi(x, c).splice(i, 1); }); profil.st.vyber = { ob: null, obs: [], bod: null, usek: null }; return; }
    if (e.target.closest('input, select')) return;
    profil.st.vyber = { ob: i, obs: [i], bod: null, usek: null }; profil.kresli(); zobraz(profil.st.rezim);
  });
  $('seznamObrysu').addEventListener('change', e => {
    const i = radekObrysu(e), k = e.target.dataset.k; if (i < 0 || !k) return;
    const c = cestaObrysu(), h = k === 'dira' ? e.target.value === '1' : k === 'sirka' || k === 'x' ? K.cislo(e.target.value, 0) : e.target.value;
    zmen(x => { K.vezmi(x, c)[i][k] = h; });
  });

  /** SVG soubor → texty cest (path, polygon/polyline, rect, circle, ellipse); transformace se nepoužijí. */
  function cestySvg(text) {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml'), out = [], c = (e, a) => parseFloat(e.getAttribute(a)) || 0;
    for (const e of doc.querySelectorAll('path, polygon, polyline, rect, circle, ellipse')) {
      const t = e.tagName.toLowerCase();
      if (t === 'path') out.push(e.getAttribute('d') || '');
      else if (t === 'polygon' || t === 'polyline') out.push('M' + (e.getAttribute('points') || '').trim() + 'Z');
      else if (t === 'rect') { const x = c(e, 'x'), y = c(e, 'y'), w = c(e, 'width'), h = c(e, 'height'); out.push(`M${x} ${y}H${x + w}V${y + h}H${x}Z`); }
      else {
        const cx = c(e, 'cx'), cy = c(e, 'cy'), rx = t === 'circle' ? c(e, 'r') : c(e, 'rx'), ry = t === 'circle' ? c(e, 'r') : c(e, 'ry'), kx = 0.5523 * rx, ky = 0.5523 * ry;
        out.push(`M${cx + rx} ${cy}C${cx + rx} ${cy + ky} ${cx + kx} ${cy + ry} ${cx} ${cy + ry}C${cx - kx} ${cy + ry} ${cx - rx} ${cy + ky} ${cx - rx} ${cy}`
          + `C${cx - rx} ${cy - ky} ${cx - kx} ${cy - ry} ${cx} ${cy - ry}C${cx + kx} ${cy - ry} ${cx + rx} ${cy - ky} ${cx + rx} ${cy}Z`);
      }
    }
    return out;
  }
  $('btnImportSvg').addEventListener('click', () => $('souborSvg').click());
  $('souborSvg').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    const bok = profil.st.rezim === 'bok';
    try {
      let obrysy = [];
      for (const d of cestySvg(await f.text())) obrysy = obrysy.concat(K.importSvg(d));
      if (!obrysy.length) throw new Error('V souboru není žádná uzavřená cesta.');
      const uz = bok ? p.obrysy.length : (p.telo.tvar === 'vlastni' ? p.telo.vlastni.length : 0);
      obrysy = obrysy.slice(0, K.MAX_OBRYSU - uz);
      if (!obrysy.length) throw new Error(`Už je tu ${K.MAX_OBRYSU} obrysů.`);
      // velikost: jednotka = mm; nesmyslně velké / malé přeškálovat na výšku štítku; profil přiložit k čelu, štítek na osu
      const b = K.obalObrysu(obrysy), vys = b[3] - b[1] || 1;
      const k = vys > 250 || vys < 3 ? p.telo.vyska / vys : 1;
      const dx = bok ? p.telo.hloubka - 2 - b[0] * k : -(b[0] + b[2]) / 2 * k, dy = bok ? p.telo.vyska / 2 - (b[1] + b[3]) / 2 * k : -b[1] * k;
      for (const ob of obrysy) for (const P of ob.body) {
        P.x = Math.round((P.x * k + dx) * 1000) / 1000; P.y = Math.round((P.y * k + dy) * 1000) / 1000;
        if (P.a) P.a = P.a.map(v => v * k); if (P.b) P.b = P.b.map(v => v * k);
      }
      zmen(x => {
        if (bok) x.obrysy.push(...obrysy);
        else { if (x.telo.tvar !== 'vlastni') x.telo.vlastni = []; x.telo.vlastni.push(...obrysy); x.telo.tvar = 'vlastni'; }
      });
      naplnFormular(); zobraz(profil.st.rezim);
      zprava(`Načteno ${obrysy.length} obrysů${k !== 1 ? `, zvětšeno ${fmt(k * 100, 0)} % na výšku štítku` : ''}${bok ? '' : ' jako tvar štítku'}. Transformace z SVG se nepoužívají.`);
    } catch (err) { Dialog.chyba('Import SVG: ' + err.message); }
  });

  /* zobrazení: 3D / profil zboku / štítek zepředu, skicář vedle 3D */
  let zobrazeni = { m: 'bok', vedle: true };
  try { zobrazeni = Object.assign(zobrazeni, JSON.parse(localStorage.getItem('webapp_vesaky_rezim')) || {}); } catch (e) { /* bez úložiště / starý formát */ }
  function zobraz(m) {
    if (!['3d', 'bok', 'cela'].includes(m)) m = 'bok';
    zobrazeni.m = m;
    $('nahledy').dataset.rezim = m === '3d' ? '3d' : zobrazeni.vedle ? 'oba' : 'profil';
    if (m !== '3d') { profil.rezim(m); for (const b of document.querySelectorAll('[data-jen]')) b.hidden = b.dataset.jen !== m; ukazPodklad(); }
    document.querySelectorAll('[data-zobraz]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.zobraz === m)));
    $('btnVedle3d').setAttribute('aria-pressed', String(zobrazeni.vedle));
    try { localStorage.setItem('webapp_vesaky_rezim', JSON.stringify(zobrazeni)); } catch (e) { /* bez úložiště */ }
    requestAnimationFrame(() => { profil.kresli(); seznamObrysu(); });
  }
  document.querySelectorAll('[data-zobraz]').forEach(b => b.addEventListener('click', () => zobraz(b.dataset.zobraz)));
  $('btnVedle3d').addEventListener('click', () => { zobrazeni.vedle = !zobrazeni.vedle; zobraz(zobrazeni.m === '3d' ? 'bok' : zobrazeni.m); });
  zobraz(zobrazeni.m);
  profil.nastroj('vyber');

  /* ---------- nabídky, export ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_vesaky_gui', pohled: j => nahled.pohled(j) });
  let skupinaMenu = null;
  K.PREDVOLBY.forEach((v, i) => {
    if (v.skupina !== skupinaMenu) { skupinaMenu = v.skupina; const hd = document.createElement('div'); hd.className = 'nab-nadpis'; hd.textContent = v.skupina; $('seznamPredvoleb').appendChild(hd); }
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
    b.addEventListener('click', () => { aktivni = 0; nahrad(K.zPredvolby(i)); });
    $('seznamPredvoleb').appendChild(b);
  });
  let vzhled = 'plast';
  try { vzhled = localStorage.getItem(KLIC_VZHLED) || 'plast'; } catch (e) { /* bez úložiště */ }
  if (!VESAKY_NAHLED.VZHLEDY[vzhled]) vzhled = 'plast';
  nahled.stav.vzhled = vzhled;
  for (const [k, v] of Object.entries(VESAKY_NAHLED.VZHLEDY)) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitemradio'); b.dataset.vzhled = k;
    b.textContent = v.nazev; b.setAttribute('aria-checked', String(k === vzhled));
    b.addEventListener('click', () => {
      document.querySelectorAll('[data-vzhled]').forEach(x => x.setAttribute('aria-checked', String(x === b)));
      nahled.prepni('vzhled', k);
      try { localStorage.setItem(KLIC_VZHLED, k); } catch (e) { /* bez úložiště */ }
    });
    $('vzhledy').appendChild(b);
  }
  const jmenoSouboru = app.jmeno, stahni = app.stahni;
  function maModel() {
    if (model) return true;
    Dialog.chyba(chybaStavby || chybaJadra || (wasm ? 'Model nelze sestavit – viz záložka Kontrola.' : 'Geometrické jádro se ještě načítá.'));
    return false;
  }
  function exportStl(jen) {
    if (!maModel()) return;
    stahni(KRAB.stlBinarni(kusyNaPodlozku(jen), 'vesaky - github_site'), jmenoSouboru(jen ? '_' + jen + '.stl' : '.stl'), 'model/stl');
  }
  $('btnStl').addEventListener('click', () => exportStl());
  $('btnStlHacek').addEventListener('click', () => exportStl('hacek'));
  $('btnStlUchyt').addEventListener('click', () => exportStl('uchyt'));
  $('btn3mf').addEventListener('click', () => { if (maModel()) stahni(KRAB.soubor3mf(kusyNaPodlozku(), p.nazev || 'Věšák'), jmenoSouboru('.3mf'), 'model/3mf'); });
  /** Tisk na papír přes #sablona (technický list nebo šablona 1:1). */
  function tiskniPapir(html) {
    $('sablona').innerHTML = html;
    document.documentElement.classList.add('tisk-sablony');
    const konec = () => { document.documentElement.classList.remove('tisk-sablony'); window.removeEventListener('afterprint', konec); };
    window.addEventListener('afterprint', konec);
    setTimeout(() => { window.print(); setTimeout(konec, 500); }, 50);
  }
  function technickyList() {
    const m = model, o = m ? m.o : K.odvozene(p);   // model.o už odpovídá skutečné orientaci tisku
    const souhrn = m ? `≈ ${fmt(m.tisk.reduce((s, d) => s + d.odhad.gramy, 0), 0)} g a ${cas(m.tisk.reduce((s, d) => s + d.odhad.minut, 0))} na kus` : '';
    tiskniPapir(VESAKY_VYKRES.technickyList(p, o, K.pevnost(p, o), souhrn));
  }
  function sablona() {
    const o = K.odvozene(p), s = VESAKY_VYKRES.sablonaSvg(p, o);
    tiskniPapir(`<div class="list-hlava"><b>Vrtací šablona 1:1 – ${esc(p.nazev || 'Věšák')}</b></div>`
      + '<div>Pohled na zeď. Tiskněte bez zmenšení („Skutečná velikost“ / 100 %) a ověřte měřítko 50 mm.</div>' + s.svg);
  }
  function stahniSvg() { stahni(VESAKY_VYKRES.vykresSvg(p, K.odvozene(p), 1e9).svg, jmenoSouboru('_vykres.svg'), 'image/svg+xml'); }
  function exportZkousky() {
    if (!wasm) { Dialog.chyba('Geometrické jádro se ještě načítá.'); return; }
    try {
      const z = VESAKY_GEOM.postavZkousku(wasm, p, K.odvozene(p)), naBok = K.rotaceDolu([1, 0, 0]);
      const dily = z.bloky.map((b, i) => ({ jmeno: 'blok' + (i + 1), nazev: `Zkouška vůle ${fmt(b.vule, 2)} mm (${i + 1} ${i ? (i < 4 ? 'zářezy' : 'zářezů') : 'zářez'})`,
        poz: K.previsyDilu(b.sit, naBok, p, 0).poz, idx: b.sit.idx, role: 'hlavni', barva: '#3F7BD6' }));
      dily.push({ jmeno: 'uchyt', nazev: 'Zkušební úchyt', poz: K.previsyDilu(z.uchyt, K.rotaceDolu([0, 0, -1]), p, 0).poz, idx: z.uchyt.idx, role: 'deska', barva: '#8FA9CF' });
      stahni(KRAB.stlBinarni(rozloz(dily, 5, 120), 'vesaky zkouska vule'), jmenoSouboru('_zkouska_vule.stl'), 'model/stl');
    } catch (e) { Dialog.chyba('Zkušební sadu nejde sestavit: ' + (e && e.message || e)); }
  }
  for (const [id, f] of [['btnList', technickyList], ['btnList2', technickyList], ['btnSablona', sablona], ['btnSablona2', sablona], ['btnSvg', stahniSvg], ['btnSvg2', stahniSvg],
    ['btnStlZkouska', exportZkousky], ['btnStlZkouska2', exportZkousky]]) $(id).addEventListener('click', f);

  /* ---------- přepínače zobrazení, klávesy, start ---------- */
  function legenda() { $('legPrevisy').hidden = !(model && nahled.stav.tisk && nahled.stav.previsy); }
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tTisk', h => { nahled.prepni('tisk', h); legenda(); });
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); legenda(); }, true);
  app.prepinac('tRozpad', h => nahled.prepni('rozpad', h));
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);
  app.prepinac('tDuchove', h => nahled.prepni('duchove', h));
  app.prepinac('tNasazeni', h => { nasazeni = h; nastavNahled(); });
  // česká klávesnice: horní řada bez Shiftu píše +ěščř – pohledy 1–5 i podle fyzické klávesy
  document.addEventListener('keydown', e => {
    const m = /^(?:Digit|Numpad)([1-5])$/.exec(e.code || ''), a = document.activeElement;
    if (!m || /^[1-5]$/.test(e.key) || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
    if (a && (/^(TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable || (a.tagName === 'INPUT' && !/checkbox|range|radio|button/.test(a.type)))) return;
    nahled.pohled(['iso', 'shora', 'zepredu', 'zboku', 'zespodu'][m[1] - 1]);
  });
  $('btnVykres').addEventListener('click', () => { TrubkyGui.otevriZalozku('vykres'); TrubkyGui.ukazBox('obecne'); });

  app.start({
    manifold: {
      ok: w => { wasm = w; prepocitej(); },
      chyba: e => { chybaJadra = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – model ani export nejsou k dispozici.'; prepocitej(); },
    },
  });
  window.VESAKY_UI = { get p() { return app.p; }, get model() { return model; }, get wasm() { return wasm; }, nahled, profil, zobraz, zmen, naplnFormular, prepocitej, nahrad, generuj, technickyList, sablona, exportZkousky, app };
})();
