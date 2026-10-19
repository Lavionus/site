/* ============================================================
   tco/ui.js – uživatelské rozhraní kalkulátoru TCO.
   Výpočty dělá tco/jadro.js (window.TCO), grafy tco/grafy.js,
   PDF tco/pdf.js. Data: localStorage webapp_tco_*.
   ============================================================ */
(function () {
  'use strict';
  const T = window.TCO, GR = window.TCO_GRAFY, DEMA = window.TCO_DEMA.DEMA;
  const KL = 'webapp_tco_';
  const MAX_VARIANT = 6;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- úložiště ---------- */
  function lsNacti(k, z) { try { const s = localStorage.getItem(KL + k); return s ? JSON.parse(s) : z; } catch (e) { return z; } }
  function lsUloz(k, v) { try { localStorage.setItem(KL + k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  /* ---------- formátování ---------- */
  const nf = d => new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: d, minimumFractionDigits: 0 });
  const nfp = d => new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: d, minimumFractionDigits: d });
  const kc = x => x == null || !isFinite(x) ? '–' : (Math.abs(x) < 100 && x !== 0 ? nfp(2).format(x) : nf(0).format(x)) + ' Kč';
  const kc2 = x => x == null || !isFinite(x) ? '–' : nfp(2).format(x) + ' Kč';
  const proc = (x, d = 2) => x == null || !isFinite(x) ? '–' : nf(d).format(x * 100) + ' %';
  const cisloDoPole = x => (x == null || (typeof x === 'number' && isNaN(x))) ? '' : String(x).replace('.', ',');
  const parseCislo = s => { s = String(s).replace(/[\s ]/g, '').replace(',', '.'); return s === '' ? NaN : Number(s); };
  const roky = L => { const r = L / 12; return Number.isInteger(r) ? nf(0).format(r) + ' ' + (r === 1 ? 'rok' : r < 5 ? 'roky' : 'let') : nf(1).format(r) + ' roku'; };

  /* ---------- stav ---------- */
  let sc, akt = 0, ulozeneId = null, zmeneno = false, casTyp = 'kum', R = null, tiskovaPaleta = false;
  const grafy = {};

  function nactiStav() {
    const s = lsNacti('aktualni', null);
    if (s && s.scenar) {
      try { sc = T.nactiScenar(s.scenar); akt = Math.min(s.akt || 0, sc.varianty.length - 1); ulozeneId = s.ulozeneId || null; zmeneno = !!s.zmeneno; return; }
      catch (e) { /* poškozený stav – začni ukázkou */ }
    }
    sc = T.nactiScenar(DEMA[0].scenar); akt = 0;
  }
  function ulozStav() { lsUloz('aktualni', { scenar: sc, akt, ulozeneId, zmeneno }); }

  /* ---------- předpoklady ---------- */
  function vyplnGlob() {
    document.querySelectorAll('[data-g]').forEach(el => {
      const k = el.dataset.g;
      el.value = el.tagName === 'SELECT' ? sc.glob[k] : cisloDoPole(sc.glob[k]);
    });
    $('scNazev').value = sc.nazev;
    $('poleHorizontLet').classList.toggle('skryty', sc.glob.horizontTyp !== 'vlastni');
    document.querySelectorAll('[data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === sc.glob.rezim)));
  }
  function fisherText() {
    const g = sc.glob;
    if (T.validujGlob(g).length) { $('fisherText').textContent = ''; return; }
    const s = T.sazby(g);
    $('fisherText').innerHTML = g.diskontTyp === 'realna'
      ? `Reálná sazba ${proc(s.realna)} + inflace ${proc(s.inflace)} → <b>nominální ${proc(s.nominalni, 3)}</b> (Fisher: (1 + n) = (1 + r)(1 + π)). Toky se diskontují nominální sazbou, EAC reálnou.`
      : `Nominální sazba ${proc(s.nominalni)} při inflaci ${proc(s.inflace)} → <b>reálná ${proc(s.realna, 3)}</b> (Fisher: (1 + r) = (1 + n)/(1 + π)). Toky se diskontují nominální sazbou, EAC reálnou.`;
  }

  /* ---------- formulář varianty ---------- */
  const jp = v => v.jednotkaPouziti || 'použití', je = v => v.jednotkaEnergie || 'jedn.';
  const POLE = [
    { sekce: 'Pořízení a konec životnosti', pole: [
      { k: 'nazev', l: () => 'Název varianty', typ: 'text', sirka: 2 },
      { k: 'cena', l: () => 'Pořizovací cena', j: () => 'Kč', n: 'Včetně dopravy a instalace. Dotaci odečti.' },
      { k: 'zivotnost', l: () => 'Životnost', j: () => 'let', n: 'Doba, po kterou zařízení používáš (lze i 2,5).' },
      { k: 'zustatek', l: () => 'Zůstatková hodnota na konci', j: () => 'Kč', sirka: 2, n: 'Za kolik zařízení prodáš (v dnešních cenách). Záporné číslo = náklad na likvidaci.' }] },
    { sekce: 'Používání', pole: [
      { k: 'pouzitiRocne', l: v => 'Četnost používání', j: v => jp(v) + '/rok' },
      { k: 'jednotkaPouziti', l: () => 'Jednotka použití', typ: 'text', seznam: 'seznamJP', n: 'km, h, praní, kus, tisk…' }] },
    { sekce: 'Energie', pole: [
      { k: 'energieNaPouziti', l: v => 'Spotřeba na 1 ' + jp(v), j: v => je(v) },
      { k: 'jednotkaEnergie', l: () => 'Jednotka energie', typ: 'text', seznam: 'seznamJE' },
      { k: 'energieRocne', l: () => 'Pevná spotřeba za rok', j: v => je(v) + '/rok', n: 'Pohotovostní režim, chod nezávislý na použití.' },
      { k: 'cenaEnergie', l: () => 'Cena energie', j: v => 'Kč/' + je(v), n: 'Celková cena vč. distribuce a poplatků.' }] },
    { sekce: 'Provoz', pole: [
      { k: 'servisRocne', l: () => 'Pravidelný servis', j: () => 'Kč/rok' },
      { k: 'materialNaPouziti', l: v => 'Spotřební materiál na 1 ' + jp(v), j: () => 'Kč', n: 'Pneumatiky, voda, toner, filtry…' },
      { k: 'servisPeriodicky', l: () => 'Velký servis / oprava', j: () => 'Kč' },
      { k: 'servisPeriodaLet', l: () => 'jednou za', j: () => 'let' },
      { k: 'ostatniRocne', l: () => 'Ostatní pevné náklady', j: () => 'Kč/rok', sirka: 2, n: 'Pojištění, daň, poplatky, předplatné, parkování.' }] }
  ];

  function poleHtml(p, v) {
    const val = p.typ === 'text' ? esc(v[p.k]) : cisloDoPole(v[p.k]);
    const vstup = `<input type="text" id="f_${p.k}" data-k="${p.k}" value="${val}" ${p.typ === 'text' ? 'maxlength="80"' : 'inputmode="decimal"'} ${p.seznam ? `list="${p.seznam}"` : ''} aria-describedby="s_${p.k}">`;
    return `<div class="pole" ${p.sirka === 2 ? 'style="grid-column:1/-1"' : ''}>
      <label for="f_${p.k}" data-lk="${p.k}">${esc(p.l(v))}</label>
      ${p.j ? `<div class="s-jednotkou">${vstup}<span data-jk="${p.k}">${esc(p.j(v))}</span></div>` : vstup}
      ${p.n ? `<div class="napoveda" style="margin-top:2px">${esc(p.n)}</div>` : ''}
      <div class="pole-stav" id="s_${p.k}"></div></div>`;
  }

  function finHtml(v) {
    const f = v.financovani;
    return `<fieldset><legend>Financování</legend>
      <label class="zaskrt"><input type="checkbox" id="f_fin_zapnuto" data-f="zapnuto" ${f.zapnuto ? 'checked' : ''}> Kupuji na úvěr (anuitní splátky)</label>
      <div class="mrizka2 ${f.zapnuto ? '' : 'skryty'}" id="finPole">
        <div class="pole"><label for="f_fin_akontace">Akontace (první platba)</label>
          <div class="s-jednotkou"><input type="text" inputmode="decimal" id="f_fin_akontace" data-f="akontace" value="${cisloDoPole(f.akontace)}">
          <select data-f="akontaceTyp" aria-label="Jednotka akontace" style="width:auto"><option value="procenta" ${f.akontaceTyp === 'procenta' ? 'selected' : ''}>%</option><option value="kc" ${f.akontaceTyp === 'kc' ? 'selected' : ''}>Kč</option></select></div>
          <div class="pole-stav" id="s_fin.akontace"></div></div>
        <div class="pole"><label for="f_fin_mesicu">Počet měsíčních splátek</label>
          <input type="text" inputmode="numeric" id="f_fin_mesicu" data-f="mesicu" value="${cisloDoPole(f.mesicu)}">
          <div class="pole-stav" id="s_fin.mesicu"></div></div>
        <div class="pole"><label for="f_fin_sazba">Sazba</label>
          <div class="s-jednotkou"><input type="text" inputmode="decimal" id="f_fin_sazba" data-f="sazba" value="${cisloDoPole(f.sazba)}"><span>% p.a.</span></div>
          <div class="pole-stav" id="s_fin.sazba"></div></div>
        <div class="pole"><label for="f_fin_sazbaTyp">Zadaná sazba je</label>
          <select id="f_fin_sazbaTyp" data-f="sazbaTyp"><option value="urok" ${f.sazbaTyp === 'urok' ? 'selected' : ''}>úroková (nominální)</option><option value="rpsn" ${f.sazbaTyp === 'rpsn' ? 'selected' : ''}>RPSN (vč. nákladů)</option></select></div>
        <div class="pole ${f.sazbaTyp === 'rpsn' ? 'skryty' : ''}" id="polePoplatek"><label for="f_fin_poplatek">Poplatek za sjednání</label>
          <div class="s-jednotkou"><input type="text" inputmode="decimal" id="f_fin_poplatek" data-f="poplatek" value="${cisloDoPole(f.poplatek)}"><span>Kč</span></div>
          <div class="pole-stav" id="s_fin.poplatek"></div></div>
        <div class="napoveda" id="finVysledek" style="grid-column:1/-1" aria-live="polite"></div>
      </div></fieldset>`;
  }

  function vykresliZalozky() {
    const P = GR.paleta();
    $('zalozky').innerHTML = sc.varianty.map((v, i) =>
      `<button role="tab" aria-selected="${i === akt}" data-i="${i}" title="${esc(v.nazev)}"><span class="tecka" style="background:${P.serie[i % 6]}"></span>${esc(v.nazev.length > 24 ? v.nazev.slice(0, 23) + '…' : v.nazev || '(bez názvu)')}</button>`).join('');
    $('pocetVariant').textContent = sc.varianty.length + ' / ' + MAX_VARIANT;
    $('btnPridat').disabled = $('btnDuplikovat').disabled = sc.varianty.length >= MAX_VARIANT;
    $('btnSmazat').disabled = sc.varianty.length <= 1;
  }

  function vykresliFormular() {
    const v = sc.varianty[akt];
    $('formVarianta').innerHTML =
      `<datalist id="seznamJP"><option value="km"><option value="h"><option value="praní"><option value="den"><option value="kus"><option value="tisk"><option value="cyklus"></datalist>
       <datalist id="seznamJE"><option value="kWh"><option value="l"><option value="m³"><option value="kg"><option value="GJ"></datalist>` +
      POLE.map(s => `<fieldset><legend>${esc(s.sekce)}</legend><div class="mrizka2">${s.pole.map(p => poleHtml(p, v)).join('')}</div></fieldset>`).join('') +
      finHtml(v) + `<label for="f_poznamka" style="margin-top:12px">Poznámka ke scénáři</label><textarea id="f_poznamka" maxlength="4000">${esc(sc.poznamka || '')}</textarea>`;
    zobrazValidaci();
  }

  function obnovPopisky() {
    const v = sc.varianty[akt];
    for (const s of POLE) for (const p of s.pole) {
      const l = document.querySelector(`[data-lk="${p.k}"]`); if (l) l.textContent = p.l(v);
      const j = document.querySelector(`[data-jk="${p.k}"]`); if (j && p.j) j.textContent = p.j(v);
    }
  }

  function zobrazValidaci() {
    const v = sc.varianty[akt];
    const { chyby, varovani } = T.validujVariantu(v);
    document.querySelectorAll('#formVarianta .pole-stav').forEach(el => { el.textContent = ''; el.className = 'pole-stav'; });
    document.querySelectorAll('#formVarianta input').forEach(el => el.classList.remove('chyba', 'mez'));
    const oznac = (x, cls) => {
      const s = document.getElementById('s_' + x.pole);
      const inp = x.pole.startsWith('fin.') ? $('f_fin_' + x.pole.slice(4)) : $('f_' + x.pole);
      if (s && !s.textContent) { s.textContent = x.text; s.className = 'pole-stav ' + cls; }
      if (inp) inp.classList.add(cls);
    };
    varovani.forEach(x => oznac(x, 'mez')); chyby.forEach(x => oznac(x, 'chyba'));
    // náhled úvěru
    const fv = $('finVysledek');
    if (fv && v.financovani.zapnuto) {
      if (chyby.some(c => c.pole.startsWith('fin.') || c.pole === 'cena') || !(v.cena > 0)) fv.textContent = '';
      else {
        const u = T.parametryUveru(v, v.cena, v.financovani.poplatek);
        const r = T.rpsn(u.jistina - u.poplatek, u.splatka, u.n);
        fv.innerHTML = u.jistina > 0
          ? `Jistina <b>${kc(u.jistina)}</b>, splátka <b>${kc2(u.splatka)}</b> měsíčně × ${u.n}, přeplatek ${kc(u.splatka * u.n + u.poplatek - u.jistina)}, vypočtená <b>RPSN ${proc(r)}</b> (v dnešních cenách, 1. pořízení).`
          : 'Akontace pokrývá celou cenu – úvěr nevzniká.';
      }
    }
    // chyby v ostatních variantách
    sc.varianty.forEach((x, i) => {
      const b = document.querySelector(`#zalozky [data-i="${i}"]`);
      if (b) b.style.borderColor = T.validujVariantu(x).chyby.length ? 'var(--danger)' : '';
    });
  }

  /* ---------- přepočet ---------- */
  let casovac = null;
  function zmena(hned) {
    zmeneno = true; ulozStav();
    clearTimeout(casovac);
    casovac = setTimeout(prepocitej, hned ? 0 : 220);
  }

  function chybyScenare() {
    const ch = T.validujGlob(sc.glob).map(c => 'Předpoklady: ' + c.text);
    sc.varianty.forEach(v => T.validujVariantu(v).chyby.forEach(c => ch.push((v.nazev || 'varianta') + ': ' + c.text)));
    return ch;
  }

  function prepocitej() {
    const gch = T.validujGlob(sc.glob);
    $('gStav').textContent = gch.map(c => c.text).join(' · ');
    document.querySelectorAll('[data-g]').forEach(el => el.classList.toggle('chyba', gch.some(c => c.pole === el.dataset.g)));
    fisherText();
    const ch = chybyScenare();
    if (ch.length) {
      $('rezimText').innerHTML = '<b>Výpočet čeká na opravu vstupů:</b> ' + esc(ch.slice(0, 4).join(' · '));
      return;
    }
    try { R = T.vyhodnotScenar(sc); }
    catch (e) { $('rezimText').textContent = 'Chyba výpočtu: ' + e.message; return; }
    vykresliVysledky();
    vykresliCas();
    vykresliStrukturu();
    vykresliCitlivost();
    vykresliUver();
  }

  /* ---------- výsledky ---------- */
  function rezimPopis() {
    const g = sc.glob, s = R.sazby;
    const infl = (g.inflace || g.rustEnergie) ? `s obecnou inflací ${nf(2).format(g.inflace)} % a růstem ceny energie ${nf(2).format(g.rustEnergie)} % ročně` : 'bez inflace (všechny ceny stálé)';
    return g.rezim === 'diskontovane'
      ? `<b>Diskontovaně:</b> všechny toky (${infl}) přepočtené na dnešní hodnotu nominální sazbou <b>${proc(s.nominalni)}</b>. Roční a měsíční částky jsou <b>ekvivalentní anuity (EAC)</b> v dnešních cenách při reálné sazbě ${proc(s.realna)}; náklad na jednotku je nivelizovaný.`
      : `<b>Nominálně:</b> prostý součet korun v okamžiku platby, ${infl}. <b>Bez diskontování</b> – koruna za 10 let má stejnou váhu jako dnešní. Roční a měsíční částky jsou prosté průměry za životnost.`;
  }

  function vykresliVysledky() {
    const disk = sc.glob.rezim === 'diskontovane';
    $('rezimText').innerHTML = rezimPopis();
    const V = R.vysledky, P = GR.paleta();
    const jednotky = new Set(R.varianty.map(v => v.jednotkaPouziti));
    const stejneJednotky = jednotky.size === 1;
    const radky = disk ? [
      ['Životnost', r => roky(r.L)],
      ['Současná hodnota nákladů za životnost (NPV)', r => kc(r.pv), r => r.pv, false],
      ['Ekvivalentní roční náklad (EAC)', r => kc(r.eacRocni), r => r.eacRocni, true, true],
      ['Ekvivalentní měsíční náklad', r => kc(r.eacMesicni), r => r.eacMesicni, true],
      ['Nivelizovaný náklad na jednotku', (r, v) => kc2(r.nivelizovanyNaJednotku) + ' / ' + esc(v.jednotkaPouziti), r => r.nivelizovanyNaJednotku, stejneJednotky],
      [`NPV za společný horizont ${roky(R.H)}`, r => kc(r.horizont.pv) + (r.horizont.cykly > 1 ? ` <span class="stitek">${r.horizont.cykly}× pořízení</span>` : ''), r => r.horizont.pv, true],
      ['Úroky a poplatky úvěru (nominálně)', r => r.uver ? kc(r.uroky + r.poplatky) : '–']
    ] : [
      ['Životnost', r => roky(r.L)],
      ['Celkové náklady za životnost (TCO)', r => kc(r.tco), r => r.tco, false],
      ['Průměr za rok', r => kc(r.rocniPrumer), r => r.rocniPrumer, true, true],
      ['Průměr za měsíc', r => kc(r.mesicniPrumer), r => r.mesicniPrumer, true],
      ['Náklad na jednotku použití', (r, v) => kc2(r.naJednotku) + ' / ' + esc(v.jednotkaPouziti), r => r.naJednotku, stejneJednotky],
      [`Celkem za společný horizont ${roky(R.H)}`, r => kc(r.horizont.tco) + (r.horizont.cykly > 1 ? ` <span class="stitek">${r.horizont.cykly}× pořízení</span>` : ''), r => r.horizont.tco, true],
      ['z toho úroky a poplatky úvěru', r => r.uver ? kc(r.uroky + r.poplatky) : '–']
    ];
    let h = '<thead><tr><th scope="col">' + (disk ? 'Diskontovaně' : 'Nominálně') + '</th>' +
      V.map((r, i) => `<th scope="col"><span class="tecka" style="background:${P.serie[i % 6]}"></span> ${esc(r.nazev)}</th>`).join('') + '</tr></thead><tbody>';
    for (const [nazev, f, hod, porovnat, hlavni] of radky) {
      let min = null;
      if (hod && porovnat && V.length > 1) { const xs = V.map(hod).filter(x => x != null && isFinite(x)); if (xs.length === V.length) min = Math.min(...xs); }
      h += `<tr class="${hlavni ? 'hlavni-radek' : ''}"><th scope="row">${esc(nazev)}</th>` + V.map((r, i) => {
        const nej = min != null && Math.abs(hod(r) - min) < 1e-6;
        return `<td class="${nej ? 'nej' : ''}">${f(r, R.varianty[i])}${nej ? ' ✓' : ''}</td>`;
      }).join('') + '</tr>';
    }
    $('tabVysledky').innerHTML = h + '</tbody>';

    // dlaždice
    const klic = r => disk ? r.eacRocni : r.rocniPrumer;
    const serazene = V.map((r, i) => ({ r, i })).sort((a, b) => klic(a.r) - klic(b.r));
    let d = '';
    if (V.length > 1) {
      const a = serazene[0], b = serazene[1];
      d += `<div class="dlazdice"><div class="t"><span class="tecka" style="background:${P.serie[a.i % 6]}"></span>Nejlevnější za rok (${disk ? 'EAC' : 'průměr'})</div>
        <div class="h">${esc(a.r.nazev)}</div><div class="p">${kc(klic(a.r))} ročně, o ${kc(klic(b.r) - klic(a.r))} méně než ${esc(b.r.nazev)}</div></div>`;
      const hz = r => disk ? r.horizont.pv : r.horizont.tco;
      const hs = V.map((r, i) => ({ r, i })).sort((x, y) => hz(x.r) - hz(y.r));
      d += `<div class="dlazdice"><div class="t"><span class="tecka" style="background:${P.serie[hs[0].i % 6]}"></span>Nejlevnější za ${roky(R.H)}</div>
        <div class="h">${esc(hs[0].r.nazev)}</div><div class="p">${kc(hz(hs[0].r))} ${disk ? '(NPV)' : 'celkem'}; úspora ${kc(hz(hs[1].r) - hz(hs[0].r))}</div></div>`;
      const zv = R.body.filter(b => b.prusecky.length);
      if (zv.length) {
        const prvni = zv.map(b => ({ b, p: b.prusecky[0] })).sort((x, y) => x.p.mesic - y.p.mesic)[0];
        d += `<div class="dlazdice"><div class="t">První bod zvratu</div><div class="h">${GR.mesicText(prvni.p.mesic)}</div>
          <div class="p">${esc(V[prvni.b.a].nazev)} × ${esc(V[prvni.b.b].nazev)}</div></div>`;
      }
    } else {
      const r = V[0];
      d += `<div class="dlazdice"><div class="t">${disk ? 'EAC' : 'Průměr'} za rok</div><div class="h">${kc(klic(r))}</div><div class="p">${kc(disk ? r.eacMesicni : r.mesicniPrumer)} měsíčně</div></div>`;
    }
    $('dlazdice').innerHTML = d;
    const typy = { nejdelsi: 'nejdelší životnost', nsn: 'nejmenší společný násobek životností', vlastni: 'vlastní volba' };
    $('horizontText').innerHTML = `Společný horizont <b>${roky(R.H)}</b> (${typy[sc.glob.horizontTyp]}). Varianta s kratší životností se po jejím konci koupí znovu; ` +
      `rozpracovaný cyklus na konci horizontu se oceňuje lineárně odepsanou hodnotou. ${esc(R.poznamka)}` +
      (stejneJednotky ? '' : ' <b>Náklad na jednotku se neporovnává</b> – varianty mají různé jednotky použití.') +
      ` Zaškrtnutí ✓ označuje nejnižší hodnotu v řádku; ${disk ? 'NPV' : 'TCO'} za vlastní životnost se mezi variantami s různou životností nesrovnává.`;
  }

  function kresli(id, konfig) {
    if (typeof Chart === 'undefined') return;
    if (grafy[id]) grafy[id].destroy();
    grafy[id] = new Chart($(id), konfig);
  }
  const paleta = () => GR.paleta(tiskovaPaleta ? 'tisk' : undefined);

  function vykresliCas() {
    kresli('grafCas', GR.konfigCas(R, casTyp, paleta()));
    const V = R.vysledky, disk = sc.glob.rezim === 'diskontovane';
    let h = `<h3>Body zvratu (${disk ? 'diskontovaně' : 'nominálně'}, kumulativní náklady na společném horizontu)</h3>`;
    if (V.length < 2) { $('zvratText').innerHTML = h + '<p class="napoveda">Pro bod zvratu přidej aspoň dvě varianty.</p>'; return; }
    h += '<ul>';
    for (const b of R.body) {
      const A = V[b.a].nazev, B = V[b.b].nazev;
      const kA = disk ? V[b.a].horizont.kumPV : V[b.a].horizont.kum, kB = disk ? V[b.b].horizont.kumPV : V[b.b].horizont.kum;
      if (!b.prusecky.length) {
        const levnejsi = kA[R.H] < kB[R.H] ? A : B, drazsi = levnejsi === A ? B : A;
        h += `<li><b>${esc(A)}</b> × <b>${esc(B)}</b>: bez bodu zvratu – <b>${esc(levnejsi)}</b> je levnější po celý horizont (na konci o ${kc(Math.abs(kA[R.H] - kB[R.H]))} než ${esc(drazsi)}).</li>`;
      } else {
        const casti = b.prusecky.map(p => `v ${GR.mesicText(p.mesic)} (měsíc ${nf(1).format(p.mesic)}) se dosud levnější ${esc(p.levnejsiPred === 'a' ? A : B)} stává dražší`);
        h += `<li><b>${esc(A)}</b> × <b>${esc(B)}</b>: ${casti.join('; ')}. Na konci horizontu je levnější ${esc(kA[R.H] < kB[R.H] ? A : B)} o ${kc(Math.abs(kA[R.H] - kB[R.H]))}.</li>`;
      }
    }
    $('zvratText').innerHTML = h + '</ul>';
  }

  function vykresliStrukturu() {
    kresli('grafStruktura', GR.konfigStruktura(R, paleta(), T));
    const disk = sc.glob.rezim === 'diskontovane', V = R.vysledky;
    let h = `<thead><tr><th>${disk ? 'Současná hodnota' : 'Nominálně'}</th>${V.map(r => `<th>${esc(r.nazev)}</th>`).join('')}</tr></thead><tbody>`;
    for (const k of T.KATEGORIE) h += `<tr><th scope="row">${esc(T.NAZVY_KATEGORII[k])}</th>${V.map(r => `<td>${kc((disk ? r.strukturaPV : r.struktura)[k])}</td>`).join('')}</tr>`;
    h += `<tr class="hlavni-radek"><th scope="row">Celkem za životnost</th>${V.map(r => `<td>${kc(disk ? r.pv : r.tco)}</td>`).join('')}</tr>`;
    $('tabStruktura').innerHTML = h + '</tbody>';
    $('grafStruktura').parentElement.style.height = Math.max(160, 70 + V.length * 46) + 'px';
  }

  /* ---------- citlivost ---------- */
  function naplnCitlivostVolby() {
    const sel = $('cVarianta'), puv = sel.value;
    let o = sc.varianty.map((v, i) => `<option value="${i}">${esc(v.nazev)}</option>`).join('');
    for (let a = 0; a < sc.varianty.length; a++) for (let b = a + 1; b < sc.varianty.length; b++)
      o += `<option value="${a}-${b}">Rozdíl: ${esc(sc.varianty[a].nazev)} − ${esc(sc.varianty[b].nazev)}</option>`;
    sel.innerHTML = o;
    if ([...sel.options].some(x => x.value === puv)) sel.value = puv;
  }

  function vykresliCitlivost() {
    naplnCitlivostVolby();
    const vyb = $('cVarianta').value || '0', typ = $('cMetrika').value, delta = Number($('cDelta').value);
    const [ia, ib] = vyb.split('-').map(Number);
    const idxB = isNaN(ib) ? null : ib;
    const disk = sc.glob.rezim === 'diskontovane';
    const fmt = typ === 'jednotka' ? kc2 : kc;
    let c;
    try { c = T.citlivost(sc, { idxA: ia, idxB, typ, delta, deltaPb: 2 }); } catch (e) { return; }
    if (!isFinite(c.zaklad)) {
      $('citlivostPopis').textContent = 'Ukazatel nelze spočítat (např. nulová četnost používání u nákladu na jednotku).';
      if (grafy.grafTornado) { grafy.grafTornado.destroy(); delete grafy.grafTornado; }
      return;
    }
    const popisMetriky = {
      rocni: disk ? 'ekvivalentní roční náklad EAC (v dnešních cenách)' : 'průměrný roční náklad (nominálně)',
      jednotka: disk ? 'nivelizovaný náklad na jednotku použití' : 'náklad na jednotku použití (nominálně)',
      horizont: disk ? 'NPV nákladů za společný horizont' : 'součet nákladů za společný horizont (nominálně)'
    }[typ];
    $('citlivostPopis').innerHTML = `Sleduji <b>${popisMetriky}</b>${idxB != null ? ` jako <b>rozdíl</b> „${esc(sc.varianty[ia].nazev)}“ minus „${esc(sc.varianty[idxB].nazev)}“ (kladné = první je dražší)` : ` varianty „${esc(sc.varianty[ia].nazev)}“`}.
      Každý parametr se změní u všech variant zároveň o ±${nf(0).format(delta * 100)} % (sazby o ±2 procentní body), ostatní zůstanou. Svislá osa pruhů = základní hodnota ${fmt(c.zaklad)}.`;
    const popisZmeny = p => p.typ === 'pb' ? '(±2 p. b.)' : '(±' + nf(0).format(p.zmena * 100) + ' %)';
    kresli('grafTornado', GR.konfigTornado(c, paleta(), fmt, popisZmeny));
    $('grafTornado').parentElement.style.height = Math.max(220, 60 + c.polozky.length * 34) + 'px';
    $('tabCitlivost').innerHTML = `<thead><tr><th>Parametr</th><th>Snížen</th><th>Zvýšen</th><th>Rozpětí</th></tr></thead><tbody>` +
      c.polozky.map(p => `<tr><th scope="row">${esc(p.nazev)} ${popisZmeny(p)}</th><td>${fmt(p.nizka)}</td><td>${fmt(p.vysoka)}</td><td>${fmt(p.rozpeti)}</td></tr>`).join('') + '</tbody>';
    // průběh
    const klic = $('pParametr').value;
    const pr = T.prubeh(sc, klic, -0.5, 0.5, 20, typ);
    const nazevP = T.PARAMETRY[klic].nazev.toLowerCase();
    kresli('grafPrubeh', GR.konfigPrubeh(pr, sc.varianty.map(v => v.nazev), paleta(), fmt, 'změna parametru „' + nazevP + '“'));
    let t = '';
    for (let a = 0; a < sc.varianty.length; a++) for (let b = a + 1; b < sc.varianty.length; b++) {
      const x = T.prahVyrovnani(sc, klic, a, b, -0.9, 3, typ);
      if (x == null) continue;
      let det = '';
      if (klic === 'cenaEnergie') det = ' – tj. ' + [a, b].map(i => `${esc(sc.varianty[i].nazev)} ${kc2(sc.varianty[i].cenaEnergie * (1 + x))}/${esc(sc.varianty[i].jednotkaEnergie)}`).join(', ');
      if (klic === 'cetnost') det = ' – tj. ' + [a, b].map(i => `${nf(0).format(sc.varianty[i].pouzitiRocne * (1 + x))} ${esc(sc.varianty[i].jednotkaPouziti)}/rok`).join(' a ');
      if (klic === 'zivotnost') det = ' – tj. ' + [a, b].map(i => `${nf(1).format(sc.varianty[i].zivotnost * (1 + x))} let`).join(' a ');
      t += `<li><b>${esc(sc.varianty[a].nazev)}</b> a <b>${esc(sc.varianty[b].nazev)}</b> vyjdou stejně při změně o <b>${x >= 0 ? '+' : '−'}${nf(1).format(Math.abs(x) * 100)} %</b>${det}.</li>`;
    }
    $('prahText').innerHTML = sc.varianty.length > 1
      ? `<h3>Kritická hodnota parametru (hledáno v rozsahu −90 % až +300 %)</h3>${t ? '<ul>' + t + '</ul>' : '<p class="napoveda">Pořadí variant se v tomto rozsahu nezmění.</p>'}` : '';
  }

  /* ---------- financování ---------- */
  function vykresliUver() {
    const s = R.vysledky.map((r, i) => ({ r, v: R.varianty[i] })).filter(x => x.r.uver);
    $('kartaUver').classList.toggle('skryty', !s.length);
    if (!s.length) return;
    const radky = [
      ['Akontace', x => kc(x.r.uver.akontace)],
      ['Jistina úvěru', x => kc(x.r.uver.jistina)],
      ['Měsíční splátka', x => kc2(x.r.uver.splatka)],
      ['Počet splátek', x => x.r.uver.n],
      ['Zadaná sazba', x => nf(2).format(x.v.financovani.sazba) + ' % ' + (x.v.financovani.sazbaTyp === 'rpsn' ? '(RPSN)' : 'p.a. (úrok)')],
      ['Vypočtená RPSN', x => proc(x.r.uver.rpsn)],
      ['Poplatek', x => kc(x.r.uver.poplatek)],
      ['Úroky za životnost (nominálně)', x => kc(x.r.uroky)],
      ['Doplatek jistiny při vyřazení', x => x.r.doplatky > 0 ? kc(x.r.doplatky) : '–']
    ];
    $('tabUver').innerHTML = `<thead><tr><th>1. pořízení</th>${s.map(x => `<th>${esc(x.r.nazev)}</th>`).join('')}</tr></thead><tbody>` +
      radky.map(([n, f]) => `<tr><th scope="row">${esc(n)}</th>${s.map(x => `<td>${f(x)}</td>`).join('')}</tr>`).join('') + '</tbody>';
    $('kalendare').innerHTML = s.map(x => {
      const u = x.r.uver; if (!(u.jistina > 0)) return '';
      const kal = T.splatkovyKalendar(u.jistina, u.i, u.n), roky = [];
      kal.forEach(k => { const r = Math.ceil(k.k / 12); roky[r] = roky[r] || { splatky: 0, urok: 0, umor: 0, zustatek: 0 }; roky[r].splatky += k.splatka; roky[r].urok += k.urok; roky[r].umor += k.umor; roky[r].zustatek = k.zustatek; });
      return `<details><summary>Splátkový kalendář – ${esc(x.r.nazev)} (po letech)</summary><div class="tabulka-obal"><table>
        <thead><tr><th>Rok</th><th>Zaplaceno</th><th>z toho úrok</th><th>úmor</th><th>Zbývá</th></tr></thead><tbody>` +
        roky.map((r, i) => r ? `<tr><td>${i}</td><td>${kc(r.splatky)}</td><td>${kc(r.urok)}</td><td>${kc(r.umor)}</td><td>${kc(r.zustatek)}</td></tr>` : '').join('') +
        `</tbody></table></div></details>`;
    }).join('');
  }

  /* ---------- scénáře ---------- */
  const seznam = () => { const s = lsNacti('scenare', []); return Array.isArray(s) ? s : []; };
  const novyId = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const datum = iso => { try { return new Date(iso).toLocaleString('cs-CZ', { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return ''; } };

  function vykresliSeznam() {
    const s = seznam();
    $('seznamSc').innerHTML = s.length ? s.map(x => `<li>
      <input type="checkbox" data-porovnat="${esc(x.id)}" aria-label="Vybrat k porovnání: ${esc(x.nazev)}">
      <span class="jm">${esc(x.nazev)} ${x.id === ulozeneId ? '<span class="stitek ok">otevřený</span>' : ''}<br><span class="kdy">${esc(datum(x.ulozeno))} · ${x.scenar.varianty.length} variant</span></span>
      <button class="male" data-nacist="${esc(x.id)}">Otevřít</button>
      <button class="male nebezpecne" data-smazat="${esc(x.id)}" aria-label="Smazat ${esc(x.nazev)}">Smazat</button></li>`).join('')
      : '<li class="napoveda">Zatím žádný uložený scénář.</li>';
    aktualizujPorovnat();
  }
  function aktualizujPorovnat() { $('btnPorovnat').disabled = document.querySelectorAll('[data-porovnat]:checked').length < 2; }

  function ulozDoSeznamu(jako) {
    const s = seznam();
    const zaznam = { id: ulozeneId, nazev: sc.nazev, ulozeno: new Date().toISOString(), scenar: JSON.parse(JSON.stringify(sc)) };
    const i = s.findIndex(x => x.id === ulozeneId);
    if (jako || i < 0) { zaznam.id = novyId(); s.unshift(zaznam); } else s[i] = zaznam;
    if (!lsUloz('scenare', s)) { Dialog.chyba('Uložení se nepovedlo (úložiště prohlížeče je plné nebo zakázané).'); return; }
    ulozeneId = zaznam.id; zmeneno = false; ulozStav(); vykresliSeznam();
    Dialog.info('Scénář „' + sc.nazev + '“ uložen.');
  }

  async function muzuZahodit() {
    if (!zmeneno) return true;
    return Dialog.potvrd('Aktuální scénář má neuložené změny. Zahodit je?', { ok: 'Zahodit' });
  }

  function otevriScenar(s, id) {
    sc = s; akt = 0; ulozeneId = id || null; zmeneno = false; ulozStav();
    vse();
  }

  function porovnej() {
    const ids = [...document.querySelectorAll('[data-porovnat]:checked')].map(x => x.dataset.porovnat);
    const s = seznam().filter(x => ids.includes(x.id));
    const radky = [], predp = new Set();
    for (const x of s) {
      let r; try { r = T.vyhodnotScenar(T.nactiScenar(x.scenar)); } catch (e) { continue; }
      predp.add(`${r.sazby.nominalni}|${r.g.inflace}|${r.g.rustEnergie}`);
      r.vysledky.forEach((v, i) => radky.push({ sc: x.nazev, v, jedn: r.varianty[i].jednotkaPouziti, s: r.sazby, g: r.g }));
    }
    if (!radky.length) { $('porovnani').innerHTML = ''; return; }
    const minR = Math.min(...radky.map(x => x.v.rocniPrumer)), minE = Math.min(...radky.map(x => x.v.eacRocni));
    $('porovnani').innerHTML = `<h3>Porovnání scénářů</h3>
      ${predp.size > 1 ? '<p class="napoveda" style="color:var(--warn)">⚠️ Scénáře mají různé předpoklady (diskontní sazba, inflace nebo růst ceny energie) – diskontované hodnoty proto nejsou přímo srovnatelné.</p>' : ''}
      <p class="napoveda">Nominální sloupce = prosté součty; diskontované = současná hodnota / EAC při sazbě daného scénáře. Oba pohledy jsou v oddělených sloupcích.</p>
      <div class="tabulka-obal"><table><thead><tr><th>Scénář / varianta</th><th>Životnost</th><th>TCO nominálně</th><th>Průměr za rok nominálně</th><th>Na jednotku nominálně</th><th>NPV</th><th>EAC roční</th><th>Diskont nom. / inflace</th></tr></thead><tbody>` +
      radky.map(x => `<tr><td>${esc(x.sc)}<br><b>${esc(x.v.nazev)}</b></td><td>${roky(x.v.L)}</td><td>${kc(x.v.tco)}</td>
        <td class="${Math.abs(x.v.rocniPrumer - minR) < 1e-6 ? 'nej' : ''}">${kc(x.v.rocniPrumer)}${Math.abs(x.v.rocniPrumer - minR) < 1e-6 ? ' ✓' : ''}</td>
        <td>${kc2(x.v.naJednotku)} / ${esc(x.jedn)}</td><td>${kc(x.v.pv)}</td>
        <td class="${Math.abs(x.v.eacRocni - minE) < 1e-6 ? 'nej' : ''}">${kc(x.v.eacRocni)}${Math.abs(x.v.eacRocni - minE) < 1e-6 ? ' ✓' : ''}</td>
        <td>${proc(x.s.nominalni)} / ${nf(2).format(x.g.inflace)} %</td></tr>`).join('') + '</tbody></table></div>';
  }

  /* ---------- export ---------- */
  function stahni(obsah, nazev, typ) {
    const blob = new Blob([obsah], { type: typ });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const souborNazev = (pripona) => (sc.nazev || 'tco').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) + '.' + pripona;

  function exportJson() {
    const data = Object.assign({ aplikace: 'Kalkulátor TCO', exportovano: new Date().toISOString() }, sc);
    stahni(JSON.stringify(data, null, 2), souborNazev('json'), 'application/json');
  }
  function exportCsv() {
    if (chybyScenare().length) { Dialog.chyba('Nejdřív oprav chybné vstupy.'); return; }
    stahni(T.exportCSV(sc), souborNazev('csv'), 'text/csv;charset=utf-8');
  }
  async function importJson(soubor) {
    let obj;
    try { obj = JSON.parse(await soubor.text()); } catch (e) { Dialog.chyba('Soubor není platný JSON.'); return; }
    try {
      if (obj && obj.typ === 'tco-sada' && Array.isArray(obj.scenare)) {
        const s = seznam(); let n = 0;
        for (const x of obj.scenare) { try { const p = T.nactiScenar(x.scenar || x); s.unshift({ id: novyId(), nazev: p.nazev, ulozeno: new Date().toISOString(), scenar: p }); n++; } catch (e) { /* přeskoč vadný */ } }
        lsUloz('scenare', s); vykresliSeznam();
        Dialog.info(`Načteno ${n} z ${obj.scenare.length} scénářů do seznamu uložených.`);
        return;
      }
      const p = T.nactiScenar(obj);
      if (!(await muzuZahodit())) return;
      otevriScenar(p, null); zmeneno = true; ulozStav();
      Dialog.info('Scénář „' + p.nazev + '“ načten. Ulož ho, pokud ho chceš mít v seznamu.');
    } catch (e) { Dialog.chyba(e.message); }
  }

  /** Graf do obrázku (světlá paleta, bílé pozadí) pro PDF. */
  function grafObrazek(konfig, w, h) {
    const obal = document.createElement('div');
    obal.style.cssText = `position:fixed;left:-10000px;top:0;width:${w}px;height:${h}px`;
    const cv = document.createElement('canvas'); cv.width = w * 2; cv.height = h * 2; cv.style.width = w + 'px'; cv.style.height = h + 'px';
    obal.appendChild(cv); document.body.appendChild(obal);
    konfig.options.responsive = false; konfig.options.devicePixelRatio = 2; konfig.options.animation = false;
    konfig.plugins = [{ id: 'bile', beforeDraw: c => { const x = c.ctx; x.save(); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.restore(); } }];
    const ch = new Chart(cv, konfig);
    const url = cv.toDataURL('image/png');
    ch.destroy(); obal.remove();
    return url;
  }

  async function exportPdf() {
    if (chybyScenare().length || !R) { Dialog.chyba('Nejdřív oprav chybné vstupy.'); return; }
    const btn = $('btnPdf'); btn.disabled = true;
    try {
      const P = GR.paleta('tisk');
      const obrazky = [
        { titul: 'Náklady v čase (' + (sc.glob.rezim === 'diskontovane' ? 'kumulativně, současná hodnota' : 'kumulativně, nominálně') + ')', url: grafObrazek(GR.konfigCas(R, 'kum', P), 900, 420), pomer: 420 / 900 },
        { titul: 'Struktura nákladů za životnost', url: grafObrazek(GR.konfigStruktura(R, P, T), 900, 80 + R.vysledky.length * 50), pomer: (80 + R.vysledky.length * 50) / 900 }
      ];
      if (grafy.grafTornado) {
        const k = grafy.grafTornado.config;
        const vyb = $('cVarianta').value || '0', [ia, ib] = vyb.split('-').map(Number);
        const c = T.citlivost(sc, { idxA: ia, idxB: isNaN(ib) ? null : ib, typ: $('cMetrika').value, delta: Number($('cDelta').value) });
        const fmt = $('cMetrika').value === 'jednotka' ? kc2 : kc;
        const hT = 60 + c.polozky.length * 34;
        obrazky.push({ titul: 'Citlivost: ' + $('cVarianta').selectedOptions[0].textContent + ' – ' + $('cMetrika').selectedOptions[0].textContent,
          url: grafObrazek(GR.konfigTornado(c, P, fmt, p => p.typ === 'pb' ? '(±2 p. b.)' : '(±' + Math.round(p.zmena * 100) + ' %)'), 900, hT), pomer: hT / 900 });
        void k;
      }
      const tab = $('tabVysledky');
      const tabulka = [...tab.rows].map(r => [...r.cells].map(c => c.textContent.replace(/\s+/g, ' ').trim()));
      const zvrat = [...$('zvratText').querySelectorAll('li')].map(li => li.textContent.replace(/\s+/g, ' ').trim());
      await window.TCO_PDF.vytvor({ sc, R, tabulka, zvrat, rezim: $('rezimText').textContent.trim(), horizont: $('horizontText').textContent.trim(),
        fisher: $('fisherText').textContent.trim(), obrazky, nazevSouboru: souborNazev('pdf'), demo: aktivniDemo() });
    } catch (e) {
      Dialog.chyba('PDF se nepodařilo vytvořit: ' + e.message + ' Zkus tlačítko Tisk (uložit jako PDF).');
    } finally { btn.disabled = false; }
  }
  function aktivniDemo() { return DEMA.find(d => d.scenar.nazev === sc.nazev) || null; }

  /* ---------- tisk: grafy ve světlé paletě ---------- */
  addEventListener('beforeprint', () => { tiskovaPaleta = true; if (R) { vykresliCas(); vykresliStrukturu(); vykresliCitlivost(); } });
  addEventListener('afterprint', () => { tiskovaPaleta = false; if (R) { vykresliCas(); vykresliStrukturu(); vykresliCitlivost(); } });

  /* ---------- demo ---------- */
  function vykresliDemoInfo() {
    const d = aktivniDemo();
    const el = $('demoInfo');
    el.classList.toggle('skryty', !d);
    if (d) {
      const [r, m, den] = d.datumCen.split('-');
      el.innerHTML = `<b>Ukázka – ceny orientační, stav k ${Number(den)}. ${Number(m)}. ${r}.</b> Zdroj: ${esc(d.zdroj)}${sc.poznamka ? '<br>' + esc(sc.poznamka) : ''}`;
    }
  }

  /* ---------- vše ---------- */
  function vse() {
    vyplnGlob(); vykresliZalozky(); vykresliFormular(); vykresliSeznam(); vykresliDemoInfo();
    $('porovnani').innerHTML = '';
    prepocitej();
  }

  function init() {
    $('demoVyber').innerHTML += DEMA.map((d, i) => `<option value="${i}">${esc(d.nazev)}</option>`).join('');
    nactiStav();
    const ui = lsNacti('ui', {});
    if (ui.casTyp === 'roky') casTyp = 'roky';
    if (ui.metrika) $('cMetrika').value = ui.metrika;
    document.querySelectorAll('[data-casgraf]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.casgraf === casTyp)));
    const ulozUi = () => lsUloz('ui', { casTyp, metrika: $('cMetrika').value });

    // předpoklady
    document.querySelectorAll('[data-g]').forEach(el => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
      const k = el.dataset.g;
      sc.glob[k] = el.tagName === 'SELECT' ? el.value : parseCislo(el.value);
      if (k === 'horizontTyp') $('poleHorizontLet').classList.toggle('skryty', el.value !== 'vlastni');
      zmena();
    }));
    $('scNazev').addEventListener('input', e => { sc.nazev = e.target.value.slice(0, 120); vykresliDemoInfo(); zmena(); });
    document.querySelectorAll('[data-rezim]').forEach(b => b.addEventListener('click', () => {
      sc.glob.rezim = b.dataset.rezim;
      document.querySelectorAll('[data-rezim]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      zmena(true);
    }));
    document.querySelectorAll('[data-casgraf]').forEach(b => b.addEventListener('click', () => {
      casTyp = b.dataset.casgraf; ulozUi();
      document.querySelectorAll('[data-casgraf]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      if (R) vykresliCas();
    }));

    // formulář varianty (delegace)
    const form = $('formVarianta');
    form.addEventListener('input', e => {
      const el = e.target, v = sc.varianty[akt];
      if (el.id === 'f_poznamka') { sc.poznamka = el.value; zmena(); return; }
      if (el.dataset.k) {
        const k = el.dataset.k;
        v[k] = typeof T.VYCHOZI_VARIANTA[k] === 'number' ? parseCislo(el.value) : el.value;
        if (k === 'nazev') { vykresliZalozky(); }
        if (k === 'jednotkaPouziti' || k === 'jednotkaEnergie') obnovPopisky();
      } else if (el.dataset.f && el.type !== 'checkbox' && el.tagName !== 'SELECT') {
        v.financovani[el.dataset.f] = parseCislo(el.value);
      } else return;
      zobrazValidaci(); zmena();
    });
    form.addEventListener('change', e => {
      const el = e.target, v = sc.varianty[akt];
      if (!el.dataset.f) return;
      if (el.type === 'checkbox') { v.financovani.zapnuto = el.checked; $('finPole').classList.toggle('skryty', !el.checked); }
      else if (el.tagName === 'SELECT') {
        v.financovani[el.dataset.f] = el.value;
        if (el.dataset.f === 'sazbaTyp') $('polePoplatek').classList.toggle('skryty', el.value === 'rpsn');
      } else return;
      zobrazValidaci(); zmena();
    });
    $('zalozky').addEventListener('click', e => {
      const b = e.target.closest('[data-i]'); if (!b) return;
      akt = Number(b.dataset.i); ulozStav(); vykresliZalozky(); vykresliFormular();
    });
    $('zalozky').addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      akt = (akt + (e.key === 'ArrowRight' ? 1 : -1) + sc.varianty.length) % sc.varianty.length;
      vykresliZalozky(); vykresliFormular(); document.querySelector(`#zalozky [data-i="${akt}"]`).focus();
    });
    $('btnPridat').addEventListener('click', () => {
      if (sc.varianty.length >= MAX_VARIANT) return;
      const v = T.normalizujVariantu({}); v.nazev = 'Varianta ' + String.fromCharCode(65 + sc.varianty.length);
      const vzor = sc.varianty[akt];
      Object.assign(v, { zivotnost: vzor.zivotnost, pouzitiRocne: vzor.pouzitiRocne, jednotkaPouziti: vzor.jednotkaPouziti, jednotkaEnergie: vzor.jednotkaEnergie, cenaEnergie: vzor.cenaEnergie });
      sc.varianty.push(v); akt = sc.varianty.length - 1; vykresliZalozky(); vykresliFormular(); zmena(true);
      $('f_nazev').focus(); $('f_nazev').select();
    });
    $('btnDuplikovat').addEventListener('click', () => {
      if (sc.varianty.length >= MAX_VARIANT) return;
      const v = JSON.parse(JSON.stringify(sc.varianty[akt])); v.nazev = (v.nazev + ' (kopie)').slice(0, 80);
      sc.varianty.splice(akt + 1, 0, v); akt++; vykresliZalozky(); vykresliFormular(); zmena(true);
    });
    $('btnSmazat').addEventListener('click', async () => {
      if (sc.varianty.length <= 1) return;
      if (!(await Dialog.potvrd('Smazat variantu „' + sc.varianty[akt].nazev + '“?', { ok: 'Smazat' }))) return;
      sc.varianty.splice(akt, 1); akt = Math.max(0, akt - 1); vykresliZalozky(); vykresliFormular(); zmena(true);
    });

    // citlivost
    ['cVarianta', 'cMetrika', 'cDelta', 'pParametr'].forEach(id => $(id).addEventListener('change', () => { ulozUi(); if (R) vykresliCitlivost(); }));

    // scénáře
    $('demoVyber').addEventListener('change', async e => {
      const i = e.target.value; e.target.value = '';
      if (i === '' || !(await muzuZahodit())) return;
      otevriScenar(T.nactiScenar(DEMA[Number(i)].scenar), null);
    });
    $('btnNovy').addEventListener('click', async () => { if (await muzuZahodit()) otevriScenar(T.novyScenar('Nový scénář'), null); });
    $('btnUlozit').addEventListener('click', () => ulozDoSeznamu(false));
    $('btnUlozitJako').addEventListener('click', async () => {
      const n = await Dialog.zeptej('Název nového scénáře', sc.nazev + (ulozeneId ? ' (kopie)' : ''));
      if (n == null || !n.trim()) return;
      sc.nazev = n.trim().slice(0, 120); $('scNazev').value = sc.nazev; ulozDoSeznamu(true);
    });
    $('seznamSc').addEventListener('click', async e => {
      const n = e.target.closest('[data-nacist]'), s = e.target.closest('[data-smazat]');
      if (n) {
        const z = seznam().find(x => x.id === n.dataset.nacist); if (!z) return;
        if (!(await muzuZahodit())) return;
        try { otevriScenar(T.nactiScenar(z.scenar), z.id); } catch (er) { Dialog.chyba(er.message); }
      } else if (s) {
        const z = seznam().find(x => x.id === s.dataset.smazat); if (!z) return;
        if (!(await Dialog.potvrd('Smazat uložený scénář „' + z.nazev + '“?', { ok: 'Smazat' }))) return;
        lsUloz('scenare', seznam().filter(x => x.id !== z.id));
        if (ulozeneId === z.id) { ulozeneId = null; ulozStav(); }
        vykresliSeznam();
      }
    });
    $('seznamSc').addEventListener('change', aktualizujPorovnat);
    $('btnPorovnat').addEventListener('click', porovnej);
    $('btnExportVse').addEventListener('click', () => {
      const s = seznam(); if (!s.length) { Dialog.info('Není co exportovat – žádný uložený scénář.'); return; }
      stahni(JSON.stringify({ typ: 'tco-sada', aplikace: 'Kalkulátor TCO', exportovano: new Date().toISOString(), scenare: s.map(x => x.scenar) }, null, 2), 'tco_scenare.json', 'application/json');
    });

    // export / import
    $('btnJson').addEventListener('click', exportJson);
    $('btnCsv').addEventListener('click', exportCsv);
    $('btnPdf').addEventListener('click', exportPdf);
    $('btnTisk').addEventListener('click', () => window.print());
    $('btnImport').addEventListener('click', () => $('souborImport').click());
    $('souborImport').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importJson(f); });

    // změna tématu → přebarvit grafy
    new MutationObserver(() => { vykresliZalozky(); if (R) { vykresliVysledky(); vykresliCas(); vykresliStrukturu(); vykresliCitlivost(); } })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    vse();
  }

  // pro testy
  window.TCO_UI = { stav: () => ({ sc, akt, R }), otevriDemo: i => otevriScenar(T.nactiScenar(DEMA[i].scenar), null), prepocitej, exportPdf, grafy };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
