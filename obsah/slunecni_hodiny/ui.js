/* ============================================================
   Sluneční hodiny – uživatelské rozhraní
   ============================================================ */
(function () {
  'use strict';
  const SH = window.SH, SHV = window.SHV;
  const $ = (id) => document.getElementById(id);
  const KLIC = 'webapp_slunecni_hodiny';
  const f1 = (x, d) => (x == null || !isFinite(x) ? '–' : Number(x).toFixed(d == null ? 1 : d).replace('.', ',').replace('-', '−'));
  const toast = (t, ch) => (window.Dialog ? (ch ? Dialog.chyba(t) : Dialog.info(t)) : console.log(t));

  const TYPY = [
    { id: 'vodorovne', nazev: 'vodorovné', ikona: '<ellipse cx="17" cy="18" rx="15" ry="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M17 18 L26 6 L26 18" fill="currentColor" opacity=".7"/>' },
    { id: 'svisle', nazev: 'svislé jižní', ikona: '<rect x="5" y="2" width="24" height="22" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M17 4 L17 20 M17 4 L8 18 M17 4 L26 18 M17 4 L5 10 M17 4 L29 10" stroke="currentColor" stroke-width="1"/>' },
    { id: 'deklinujici', nazev: 'deklinující', ikona: '<path d="M6 3 L28 6 L28 25 L6 22 Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 6 L14 22 M12 6 L7 17 M12 6 L22 21 M12 6 L27 15" stroke="currentColor" stroke-width="1"/>' },
    { id: 'polarni', nazev: 'polární', ikona: '<path d="M3 22 L13 6 L31 6 L21 22 Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 22 L17 6 M14 22 L21 6 M19 22 L25 6" stroke="currentColor" stroke-width="1"/>' },
    { id: 'ekvatorialni', nazev: 'ekvatoriální', ikona: '<ellipse cx="17" cy="14" rx="8" ry="11" fill="none" stroke="currentColor" stroke-width="1.6" transform="rotate(35 17 14)"/><path d="M6 24 L28 4" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'analematicke', nazev: 'analematické', ikona: '<ellipse cx="17" cy="15" rx="15" ry="9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 2"/><path d="M17 9 L17 21" stroke="currentColor" stroke-width="2.4"/><circle cx="17" cy="5" r="2.2" fill="currentColor"/>' },
    { id: 'kapesni', nazev: 'kapesní výškové', ikona: '<rect x="13" y="5" width="8" height="20" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M17 1 L17 5 M9 9 L17 9" stroke="currentColor" stroke-width="1.6"/><path d="M17 9 L17 19" stroke="currentColor" stroke-width="2.4" opacity=".55"/>' },
  ];
  const MESTA = [
    ['Praha', 50.0755, 14.4378, 1], ['Brno', 49.1951, 16.6068, 1], ['Ostrava', 49.8209, 18.2625, 1], ['Plzeň', 49.7384, 13.3736, 1],
    ['České Budějovice', 48.9745, 14.4743, 1], ['Hradec Králové', 50.2104, 15.8327, 1], ['Olomouc', 49.5938, 17.2509, 1],
    ['Liberec', 50.7671, 15.0562, 1], ['Ústí nad Labem', 50.6607, 14.0323, 1], ['Zlín', 49.2265, 17.6707, 1], ['Jihlava', 49.3961, 15.5912, 1],
    ['Karlovy Vary', 50.2319, 12.8720, 1], ['Bratislava', 48.1486, 17.1077, 1], ['Košice', 48.7164, 21.2611, 1], ['Vídeň', 48.2082, 16.3738, 1],
    ['Berlín', 52.52, 13.405, 1], ['Londýn', 51.5074, -0.1278, 0], ['Řím', 41.9028, 12.4964, 1], ['Sydney', -33.8688, 151.2093, 10],
  ];
  const ROZMERY = {
    vodorovne: { tvar: 'kruh', sirkaMm: 250, vyskaMm: 250, nodusMm: 30 },
    svisle: { tvar: 'obd', sirkaMm: 400, vyskaMm: 480, nodusMm: 50 },
    deklinujici: { tvar: 'obd', sirkaMm: 420, vyskaMm: 480, nodusMm: 50 },
    polarni: { tvar: 'obd', sirkaMm: 400, vyskaMm: 240, nodusMm: 40 },
    ekvatorialni: { tvar: 'kruh', sirkaMm: 200, vyskaMm: 200, nodusMm: 20 },
    analematicke: { tvar: 'obd', sirkaMm: 500, vyskaMm: 400, nodusMm: 150 },
    kapesni: { tvar: 'obd', sirkaMm: 30, vyskaMm: 120, nodusMm: 40, tloustkaMm: 10, prumerTyce: 2.5 },
  };
  const VYCH = () => ({
    p: Object.assign({}, SH.VYCHOZI, { rok: new Date().getFullYear(), typ: 'vodorovne', letniCas: true }, ROZMERY.vodorovne),
    rozmery: JSON.parse(JSON.stringify(ROZMERY)),
    tisk: { papir: 'a4', okraj: 8, prekryv: 12, papirW: 210, papirH: 297, cernobile: false },
    sim: { den: null, cas: null },
  });

  let S = VYCH();
  try {
    const u = JSON.parse(localStorage.getItem(KLIC) || 'null');
    if (u && u.p) { S.p = Object.assign(S.p, u.p); S.rozmery = Object.assign(S.rozmery, u.rozmery || {}); S.tisk = Object.assign(S.tisk, u.tisk || {}); }
  } catch (e) { /* nic */ }
  let ulozTimer = 0;
  const uloz = () => { clearTimeout(ulozTimer); ulozTimer = setTimeout(() => { try { localStorage.setItem(KLIC, JSON.stringify({ p: S.p, rozmery: S.rozmery, tisk: S.tisk })); } catch (e) { /* plné úložiště */ } }, 300); };

  /* ---------- naplnění ovládacích prvků ---------- */
  $('mesto').innerHTML = '<option value="">– vlastní poloha –</option>' + MESTA.map((m, i) => `<option value="${i}">${m[0]}</option>`).join('');
  {
    let o = '';
    for (let h = -12; h <= 14; h++) {
      const pop = h === 1 ? ' – SEČ (střední Evropa)' : h === 0 ? ' – GMT/UTC' : h === 2 ? ' – VEČ (východní Evropa)' : '';
      o += `<option value="${h}">UTC${h >= 0 ? '+' : '−'}${Math.abs(h)}${pop}</option>`;
    }
    $('posun').innerHTML = o;
  }
  $('typy').innerHTML = TYPY.map((t, i) => `<button type="button" data-typ="${t.id}" title="${t.nazev} (klávesa ${i + 1})"><svg viewBox="0 0 34 26" aria-hidden="true">${t.ikona}</svg>${t.nazev}</button>`).join('');

  const POLE_P = ['sirka', 'delka', 'posun', 'rok', 'letniCas', 'korekceDelky', 'deklinace', 'tvar', 'sirkaMm', 'vyskaMm', 'nodusAuto', 'nodusMm', 'posunX', 'posunY',
    'mezVysky', 'prumerTyce', 'kapSteny', 'kapSloupce', 'kapCasy', 'tloustkaMm', 'styl', 'cislice', 'krok', 'datum', 'caryMeziDaty', 'analema', 'tabulka', 'popisky', 'motto'];
  const POLE_T = ['papir', 'okraj', 'prekryv', 'papirW', 'papirH', 'cernobile'];
  const klicP = (id) => (id === 'posun' ? 'posunUTC' : id);

  function doFormulare() {
    for (const id of POLE_P) {
      const el = $(id), v = S.p[klicP(id)];
      if (el.type === 'checkbox') el.checked = !!v; else el.value = v == null ? '' : (typeof v === 'number' && id !== 'rok' && id !== 'posun' ? +v.toFixed(4) : v);
    }
    for (const id of POLE_T) { const el = $(id); if (el.type === 'checkbox') el.checked = !!S.tisk[id]; else el.value = S.tisk[id]; }
    for (const b of $('typy').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.typ === S.p.typ));
    const i = MESTA.findIndex((m) => Math.abs(m[1] - S.p.sirka) < 1e-3 && Math.abs(m[2] - S.p.delka) < 1e-3);
    $('mesto').value = i >= 0 ? String(i) : '';
    viditelnost();
  }
  function zFormulare(id) {
    const el = $(id);
    if (POLE_T.includes(id)) S.tisk[id] = el.type === 'checkbox' ? el.checked : (el.tagName === 'SELECT' ? el.value : +el.value);
    else {
      const k = klicP(id);
      if (el.type === 'checkbox') S.p[k] = el.checked;
      else if (el.type === 'number' || el.type === 'range' || id === 'posun' || id === 'krok') { const v = parseFloat(String(el.value).replace(',', '.')); if (isFinite(v)) S.p[k] = v; }
      else S.p[k] = el.value;
      if (id === 'kapSteny') S.p.kapSteny = +el.value;
      if (['tvar', 'sirkaMm', 'vyskaMm', 'nodusMm', 'tloustkaMm', 'prumerTyce'].includes(id)) S.rozmery[S.p.typ][id] = S.p[id];
    }
  }
  function viditelnost() {
    const t = S.p.typ;
    $('blokDeklinace').classList.toggle('skryte', t !== 'deklinujici');
    const kap = t === 'kapesni';
    $('blokKapesni').classList.toggle('skryte', !kap);
    $('btnStl').classList.toggle('skryte', !kap);
    $('tloustkaMm').parentElement.classList.toggle('skryte', +S.p.kapSteny !== 2);
    for (const el of [$('mezVysky'), document.querySelector('label[for=mezVysky]'), $('styl').parentElement, $('krok').parentElement.parentElement, $('motto'), document.querySelector('label[for=motto]'), $('tabulka').parentElement]) el.classList.toggle('skryte', kap);
    $('lNodusAuto').textContent = kap ? 'Délku kolíku navrhnout automaticky (letní poledne na konci sloupce)' : 'Výšku nodu a jeho polohu navrhnout automaticky';
    $('lTyc').textContent = kap ? 'Průměr kolíku (mm)' : 'Průměr tyče (mm)';
    $('blokTvar').classList.toggle('skryte', t !== 'vodorovne' && t !== 'svisle' && t !== 'deklinujici');
    const kruh = (t === 'ekvatorialni') || ((t === 'vodorovne' || t === 'svisle' || t === 'deklinujici') && S.p.tvar === 'kruh');
    $('blokVyska').classList.toggle('skryte', kruh);
    $('lSirkaMm').textContent = kap ? 'Šířka stěny (mm)' : kruh ? 'Průměr desky (mm)' : 'Šířka desky (mm)';
    document.querySelector('label[for=vyskaMm]').textContent = kap ? 'Výška hranolu (mm)' : 'Výška (mm)';
    $('blokTyc').classList.toggle('skryte', t !== 'ekvatorialni' && !kap);
    $('lNodus').textContent = kap ? 'Délka kolíku (mm)' : t === 'analematicke' ? 'Výška gnomonu (mm)' : t === 'ekvatorialni' ? 'Nodus od desky (mm)' : 'Výška nodu (mm)';
    $('blokNodus').classList.toggle('skryte', !!S.p.nodusAuto && t !== 'analematicke');
    $('posunX').parentElement.classList.toggle('skryte', t === 'ekvatorialni' || t === 'analematicke' || kap);
    $('posunY').parentElement.classList.toggle('skryte', t === 'ekvatorialni' || t === 'analematicke' || kap);
    $('nodusAuto').parentElement.classList.toggle('skryte', t === 'analematicke');
    $('analema').parentElement.classList.toggle('skryte', t === 'analematicke' || t === 'ekvatorialni' || kap);
    $('caryMeziDaty').parentElement.classList.toggle('skryte', t === 'analematicke' || kap);
    $('blokPapir').classList.toggle('skryte', S.tisk.papir !== 'vlastni');
    $('mezVyskyH').textContent = S.p.mezVysky + '°';
  }

  /* ---------- výpočet a vykreslení ---------- */
  let R = null;
  function prepocti() {
    try { R = SH.navrh(S.p); }
    catch (e) { console.error(e); toast('Chyba výpočtu: ' + e.message, true); return; }
    if (S.p.nodusAuto && R.info.posunPaty) {
      S.p.nodusMm = +R.info.vyskaNodu.toFixed(1); S.p.posunX = +R.info.posunPaty[0].toFixed(1); S.p.posunY = +R.info.posunPaty[1].toFixed(1);
      $('nodusMm').value = S.p.nodusMm; $('posunX').value = S.p.posunX; $('posunY').value = S.p.posunY;
    }
    $('nahled').innerHTML = SHV.svg(R.cifernik, { sirkaPx: true, simulace: true, pomoc: S.p.popisky, okraj: 3 });
    $('nadpisNahled').textContent = 'Ciferník – ' + TYPY.find((t) => t.id === S.p.typ).nazev;
    $('rozmerNahled').textContent = f1(R.cifernik.w, 0) + ' × ' + f1(R.cifernik.h, 0) + ' mm';
    $('nahledGnomon').innerHTML = SHV.svg(R.gnomon, { sirkaPx: true, okraj: 4 });
    $('graf').innerHTML = SHV.svg(SH.grafRovniceCasu(S.p, 180, 90), { sirkaPx: true, okraj: 2 });
    infoPoloha(); kontrola(); tabulkaRovnice(); navod(); infoListy(); mereni();
    simuluj();
    uloz();
  }

  function korekceMin() { return SH.korekceDelkyMin(S.p.delka, S.p.posunUTC); }
  function infoPoloha() {
    const kd = korekceMin(), dnes = new Date();
    const s = SH.slunce(Date.UTC(dnes.getFullYear(), dnes.getMonth(), dnes.getDate(), 12));
    const poledne = 12 - (s.rovniceCasu + kd) / 60 + (S.p.letniCas && SH.jeLetniCasEU(dnes.getTime()) ? 1 : 0);
    $('infoPoloha').innerHTML = `Střední poledník pásma <b>${f1(15 * S.p.posunUTC, 0)}°</b>; místní střední čas je ${kd >= 0 ? 'napřed' : 'pozadu'} o <b>${f1(Math.abs(kd))} min</b>.<br>` +
      `Pravé poledne dnes: <b>${SH.fmtCas(poledne)}</b> (hodinky${S.p.letniCas && SH.jeLetniCasEU(dnes.getTime()) ? ', letní čas' : ''}).`;
  }

  function kontrolaKapesni() {
    const I = R.info, h = [];
    h.push(`Kolík vyčnívá <b>${f1(I.vyskaNodu)} mm</b> kolmo ze stěny; použitelná délka sloupce pod osou kolíku <b>${f1(I.delkaSloupce)} mm</b>. Rozvin pláště ${f1(I.rozvin.sirka, 0)} × ${f1(I.rozvin.vyska, 0)} mm, ${I.rozvin.steny} stěny, ${I.rozvin.sloupcuNaStenu} sloupce na stěnu.`);
    h.push('Stín konce kolíku leží o <b>d = L · tan h</b> níž než osa kolíku (h = výška Slunce): vysoké Slunce = dlouhý stín, v zimě jsou značky těsně pod otvorem.');
    for (const v of I.varovani) h.push(`<span class="varovani">⚠ ${v}</span>`);
    $('kontrola').innerHTML = h.join('<br>');
    const casy = [...new Set(I.sloupce.flatMap((c) => c.znacky.map((z) => z.txt)))];
    const rad = I.sloupce.map((c) => `<tr><td>${c.nazev}<br><small style="color:var(--text-faint)">${c.obdobi.join(' + ')}</small></td><td>${f1(c.d, 2)}°<br><small style="color:var(--text-faint)">${f1(c.dMin, 1)} … ${f1(c.dMax, 1)}°</small></td>` +
      casy.map((tx) => { const z = c.znacky.find((q) => q.txt === tx); return `<td>${z ? (z.mimo ? '<span class="varovani">' : '') + f1(z.pad, 1) + ' mm<br><small style="color:var(--text-faint)">h ' + f1(z.h, 1) + '°</small>' + (z.mimo ? '</span>' : '') : '–'}</td>`; }).join('') + '</tr>');
    $('tabHodin').innerHTML = `<thead><tr><th>Sloupec</th><th>deklinace (rozptyl)</th>${casy.map((x) => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rad.join('')}</tbody>`;
    $('infoGnomon').innerHTML = `Kolík (gnomon) délky <b>${f1(I.vyskaNodu)} mm</b> nad stěnou, průměr ${f1(S.p.prumerTyce)} mm. Na originálu je kolík zlatý, zakončený zvířecí hlavou, a dal se uschovat v hranolu.`;
  }
  function kontrola() {
    if (S.p.typ === 'kapesni') { kontrolaKapesni(); return; }
    const I = R.info, t = S.p.typ, h = [];
    if (t === 'analematicke') {
      h.push(`Velká poloosa elipsy <b>${f1(R.analema.M)} mm</b>, malá <b>${f1(R.analema.M * Math.abs(Math.sin(S.p.sirka * Math.PI / 180)))} mm</b>. Datová stupnice ±<b>${f1(R.analema.M * Math.cos(S.p.sirka * Math.PI / 180) * Math.tan(23.44 * Math.PI / 180))} mm</b> od středu.`);
    } else {
      h.push(`Výška nodu <b>${f1(I.vyskaNodu)} mm</b>${t === 'ekvatorialni' ? ' (od každé strany desky)' : ''}. Styl svírá s ciferníkem <b>${f1(I.vyskaStylu)}°</b>${t === 'vodorovne' ? ' (= zeměpisná šířka)' : ''}.`);
      if (I.podstyl != null && t !== 'ekvatorialni') h.push(`Patka stylu C je <b>${f1(I.podstyl)} mm</b> od paty nodu; podstyl je odkloněn od svislice o <b>${f1(Math.abs(((I.uhelPodstylu - (t === 'vodorovne' ? 0 : 180) + 540) % 360) - 180))}°</b>.`);
    }
    for (const k of I.kontrola) {
      if (t === 'analematicke') break;
      if (!k.vejde.length && !k.mimo.length) continue;
      const ano = k.vejde.length ? k.vejde.map((x) => SH.textHodiny(x, 'arabske')).join(', ') : '–';
      h.push(`<span class="${k.mimo.length ? 'varovani' : 'ok'}">${k.datum}: stín nodu na ciferníku v ${ano} h${k.mimo.length ? '; mimo: ' + k.mimo.join(', ') + ' h' : ''}</span>`);
    }
    for (const v of I.varovani) h.push(`<span class="varovani">⚠ ${v}</span>`);
    $('kontrola').innerHTML = h.join('<br>');
    // tabulka hodinových čar
    const radky = I.hodiny.map((x) => {
      const sl = t === 'polarni' ? f1(x.x, 1) + ' mm' : t === 'analematicke' ? f1(x.x, 1) + ' / ' + f1(x.y, 1) + ' mm' : f1(x.uhel, 2) + '°';
      return `<tr><td>${SH.textHodiny(x.T, 'arabske')}${S.p.letniCas ? ' <span style="color:var(--danger)">(' + SH.textHodiny(x.T + 1, 'arabske') + ')</span>' : ''}${x.strana ? ' · ' + x.strana : ''}</td><td>${f1(x.t, 2)}°</td><td>${sl}</td></tr>`;
    });
    const nad = t === 'polarni' ? 'vzdálenost od podstylu' : t === 'analematicke' ? 'bod x / y od středu' : t === 'vodorovne' ? 'úhel od polední čáry' : 'úhel od svislice';
    $('tabHodin').innerHTML = `<thead><tr><th>Hodina</th><th>hod. úhel</th><th>${nad}</th></tr></thead><tbody>${radky.join('')}</tbody>`;
    $('infoGnomon').innerHTML = t === 'analematicke'
      ? 'Gnomon je svislá tyč (nebo člověk), která se staví na datovou stupnici podle dnešního data.'
      : t === 'ekvatorialni' ? 'Klín vytiskněte 2× a podlepte desku; tyč prostrčte kolmo středem, aby mířila k nebeskému pólu.'
        : t === 'polarni' ? 'Styl polárních hodin je rovnoběžný s deskou; destičku postavte na čárkovaný podstyl.'
          : `Šablona trojúhelníku: úhel u špičky C = <b>${f1(I.vyskaStylu)}°</b>, výška nodu <b>${f1(I.vyskaNodu)} mm</b>. Vytiskněte 1:1 a obkreslete na plech/překližku.`;
  }

  function tabulkaRovnice() {
    const kd = korekceMin(), rows = [];
    for (let m = 0; m < 12; m++) for (const d of [1, 8, 15, 22]) {
      const s = SH.slunce(Date.UTC(S.p.rok, m, d, 12));
      const k = -s.rovniceCasu - (S.p.korekceDelky ? 0 : kd);
      const pol = 12 - (s.rovniceCasu + kd) / 60;
      rows.push(`<tr><td>${d}. ${m + 1}.</td><td>${f1(s.rovniceCasu, 1)}</td><td><b>${(k >= 0 ? '+' : '') + f1(k, 1)}</b></td><td>${f1(s.deklinace, 2)}°</td><td>${SH.fmtCas(pol)}</td></tr>`);
    }
    $('tabRovnice').innerHTML = '<thead><tr><th>Datum</th><th>rovnice času (min)</th><th>korekce (min)</th><th>deklinace</th><th>pravé poledne (SEČ)</th></tr></thead><tbody>' + rows.join('') + '</tbody>';
  }

  function navodKapesni() {
    const k = [];
    k.push(`<h3>Historie</h3><p>Kapesní sluneční hodiny z Canterbury jsou anglosaské, nejspíš z 10. století. Našli je v roce 1938 při úpravách v rajském dvoře (Great Cloister) katedrály v Canterbury. Jde o stříbrnou destičku o délce asi 6 cm (udává se 61 × 16 mm) se zlatou hlavicí a řetízkem a se samostatným zlatým kolíkem. Na obou širokých stranách jsou tři sloupce s latinskými zkratkami dvojic měsíců – podle popisu replik IAN·DEC, FEB·NOV, MAR·OCT na jedné a MAI·AVG, IVN·IVL, APR·SEP na druhé straně; nahoře v každém sloupci je otvor pro kolík. Po bocích je nápis +SALVS FACTORI / +PAX POSSESSORI („zdraví tvůrci, pokoj majiteli“). Hodiny měří <b>výšku Slunce</b> a ukazovaly tři denní časy – podle literatury nejspíš modlitby tercie, sexty (poledne) a nony; A. Mills je popsal jako výškové hodiny pro <b>nestejné (sezónní) hodiny</b>.</p>`);
    k.push(`<h3>Použití</h3><ol><li>Kolík zasuňte vodorovně do otvoru sloupce s dnešním měsícem.</li><li>Hodiny zavěste za řetízek (visí svisle) a natočte je stěnou ke Slunci tak, aby <b>stín kolíku padal přesně svisle dolů po sloupci</b> – stěna pak míří k azimutu Slunce.</li><li>Konec stínu ukazuje čas: u nejnižší značky je poledne (sexta), výše tercie / nona. Dopoledne a odpoledne se nerozliší – v jednom sloupci je výška Slunce v 9 a 15 h stejná.</li></ol>`);
    k.push(`<h3>Výroba</h3><ul><li>Rozvin vytiskněte 1:1 (kontrolní úsečka 50 mm), nalepte na dřevěný hranolek přesných rozměrů (${f1(S.p.sirkaMm, 0)} × ${+S.p.kapSteny === 2 ? f1(S.p.tloustkaMm, 0) + ' × ' : ''}${f1(S.p.vyskaMm, 0)} mm), přeložte po čárkovaných hranách.</li><li>Otvory provrtejte kolmo ke stěně. Délka kolíku nad stěnou musí přesně odpovídat (${f1(R.info.vyskaNodu)} mm) – chyba 1 mm posune polední značku v létě asi o 2 mm.</li><li>STL je hranol s otvory a rýhami značek pro 3D tisk (nápisy se nerývají).</li></ul>`);
    k.push(`<h3>Historické hodiny × přesná astronomie</h3><ul><li><b>Dvojice měsíců</b> mají jednu stupnici, ale jejich deklinace nejsou stejné: např. březen má střední deklinaci asi −1,6°, říjen −8,9° (rozdíl kolem 7°). Párování Jan–Dec, Feb–Nov… předpokládá slunovrat na rozhraní měsíců (tradiční datum VIII Kal. Ian. = 25. 12.), astronomicky je však 21. 12. (gregoriánsky); v juliánském kalendáři 10. století připadal zhruba na 15.–16. 12. Volba „6 dvojic znamení“ páruje období se shodnou deklinací.</li><li>Výškové hodiny platí jen pro jednu zeměpisnou šířku. Podle článku D. Sherlocka v časopise Kentské archeologické společnosti se pro přesné čtení hodí spíš šířka severní Anglie než Canterbury, takže hodiny možná nevznikly v Kentu. Výklad značek a poloh kolíku je předmětem diskuse (A. Mills 1995, M. Arnaldi 2011–12, P. Drinkwater 2012); J. Davis (BSS Monograph 14) spojuje kov hodin s Edgarovou mincovní reformou roku 973.</li><li>Tercie a nona jsou zde spočítané jako konec 3. a 9. nestejné hodiny (pravý sluneční čas, polovina doby mezi východem Slunce a polednem); středověké tabulky stínů (např. tabulka připojená k Řeholi sv. Benedikta v Canterbury) byly jen přibližné.</li><li>Kolem poledne se výška Slunce téměř nemění, takže výškové hodiny tam čtou čas nejhůř (chyba i čtvrt hodiny); nejpřesnější jsou dopoledne a odpoledne.</li><li>Čtení je v <b>pravém slunečním čase</b>; na hodinky ho převedete korekcí z tabulky Rovnice času.</li></ul>`);
    $('navod').innerHTML = k.join('');
  }
  function navod() {
    if (S.p.typ === 'kapesni') { navodKapesni(); return; }
    const t = S.p.typ, kd = korekceMin(), sev = S.p.sirka >= 0;
    const pol = sev ? 'severní' : 'jižní', svet = sev ? 'sever' : 'jih';
    const k = [];
    k.push('<h3>1. Tisk a výroba</h3><ol><li>Vytiskněte PDF ve skutečné velikosti (100 %, bez „přizpůsobit stránce“) a změřte kontrolní úsečku 50 mm / čtverec 50 × 50 mm.</li><li>Velký ciferník je rozdělený na listy – ořízněte okraje podle textu na listu a přiložte k čárkované čáře sousedního listu.</li><li>Šablonu přeneste na kámen, dřevo nebo plech (propiska přes kopírák, důlčík); pro laser/CNC použijte DXF (vrstva OBRYS = řez, ostatní gravírování).</li></ol>');
    if (t === 'vodorovne') k.push(`<h3>2. Osazení vodorovných hodin</h3><ol><li>Desku vyrovnejte <b>vodováhou</b> ve dvou směrech.</li><li>Gnomon postavte kolmo na desku podél čárkovaného podstylu, špičkou C do středu čar; hrana stylu svírá s deskou <b>${f1(R.info.vyskaStylu)}°</b> a míří k ${pol}nímu nebeskému pólu.</li><li>Polední čáru natočte přesně na zeměpisný ${svet} (viz orientace níže).</li></ol>`);
    if (t === 'svisle' || t === 'deklinujici') k.push(`<h3>2. Osazení na stěnu</h3><ol><li>Deklinace stěny musí odpovídat zadání (${f1(t === 'svisle' ? 0 : S.p.deklinace)}°) – ověřte ji měřením stínu (kalkulačka u volby typu).</li><li>Desku přiložte svisle (olovnice); ${t === 'svisle' ? 'polední čára je svislá' : 'svislice prochází patou nodu (křížek)'}.</li><li>Gnomon kolmo k desce po čárkovaném podstylu, špička C do středu čar. Styl svírá se stěnou <b>${f1(R.info.vyskaStylu)}°</b>.</li></ol>`);
    if (t === 'polarni') k.push(`<h3>2. Osazení polárních hodin</h3><ol><li>Deska je skloněná k jihu o <b>${f1(Math.abs(S.p.sirka))}°</b> od vodorovné roviny (je rovnoběžná se zemskou osou), čáry hodin běží sever–jih.</li><li>Styl (hrana destičky) je rovnoběžný s deskou ve výšce ${f1(R.info.vyskaNodu)} mm nad čárkovaným podstylem.</li></ol>`);
    if (t === 'ekvatorialni') k.push(`<h3>2. Osazení ekvatoriálních (oboustranných) hodin</h3><ol><li>Strany A a B nalepte na obě strany desky tak, aby se středy kryly a <b>polední čáry ležely na sobě</b> (obě míří k dolnímu okraji).</li><li>Deska se skloní o <b>${f1(90 - Math.abs(S.p.sirka))}°</b> od vodorovné (klín), nižší okraj míří na ${svet}.</li><li>Tyč prostrčte kolmo středem – míří k ${pol}nímu pólu pod úhlem ${f1(Math.abs(S.p.sirka))}°. Od jarní do podzimní rovnodennosti svítí Slunce na stranu A, v zimě na B; kolem rovnodenností je stín téměř v rovině desky.</li></ol>`);
    if (t === 'analematicke') k.push(`<h3>2. Osazení analematických hodin</h3><ol><li>Elipsu vyznačte na vodorovné ploše, velká osa leží přesně <b>východ–západ</b>, datová stupnice <b>sever–jih</b>.</li><li>Gnomon (svislá tyč nebo člověk) se postaví na stupnici k dnešnímu datu (vlevo leden–červen, vpravo červenec–prosinec). Stín ukazuje čas tam, kde protne elipsu.</li></ol>`);
    k.push(`<h3>3. Orientace na zeměpisný ${svet}</h3><ul><li><b>Pravé poledne</b> (nejspolehlivější): v čase pravého poledne (tabulka „Rovnice času“, dnes ${SH.fmtCas(12 - (SH.slunce(Date.now()).rovniceCasu + kd) / 60 + (S.p.letniCas && SH.jeLetniCasEU(Date.now()) ? 1 : 0))} na hodinkách) natočte hodiny tak, aby stín padl na polední čáru${S.p.korekceDelky ? ' místního času (u korigovaných hodin je to čáru posunutá o ' + f1(Math.abs(kd)) + ' min oproti čáře 12)' : ''}.</li>
      <li><b>Kompas</b>: střelka ukazuje magnetický sever. V ČR je magnetická deklinace v roce ${new Date().getFullYear()} asi <b>+5 až +6° (na východ)</b>, zeměpisný azimut = magnetický + deklinace. Aktuální hodnotu ověřte (např. model WMM/NOAA) a měřte dál od železa a aut.</li>
      <li><b>Polárka</b> (v noci) leží do 1° od severního pólu; olovnicí zaměřte svislou rovinu k ní.</li>
      <li>Ve dne lze použít i stín svislé tyče a <b>azimut Slunce</b> ze simulace (posuňte čas na aktuální hodinu).</li></ul>`);
    k.push(`<h3>4. Kontrola a čtení času</h3><ul><li>V pravé poledne musí stín stylu ležet na polední čáře; nodus (vrchol gnomonu) ukazuje datum na datových křivkách.</li><li>Hodiny ukazují <b>${S.p.korekceDelky ? 'čas pásma bez rovnice času' : 'místní pravý sluneční čas'}</b>. Na hodinkový čas převedete údaj přičtením korekce z tabulky (od −16 do +16 min${S.p.korekceDelky ? '' : ', včetně ' + f1(-kd) + ' min za zeměpisnou délku'}).</li>${S.p.letniCas ? '<li>V době letního času čtěte <b style="color:var(--danger)">červená čísla</b> (o hodinu víc).</li>' : ''}<li>Tloušťka gnomonu: dopoledne vrhá stín západní hrana, odpoledne východní – tlustý styl buď zbruste do ostří, nebo ciferník podél podstylu rozdělte o jeho tloušťku.</li></ul>`);
    $('navod').innerHTML = k.join('');
  }

  /* ---------- měření deklinace stěny ---------- */
  function mereni() {
    if (S.p.typ !== 'deklinujici') return;
    const d = $('mDatum').value, c = $('mCas').value, b = parseFloat($('mBeta').value);
    if (!d || !c || !isFinite(b)) { $('mVysledek').textContent = 'Zadejte datum, čas a úhel.'; return; }
    const [rr, mm, dd] = d.split('-').map(Number), [hh, mi] = c.split(':').map(Number);
    let ms = SH.msZCasu(rr, mm, dd, hh + mi / 60, S.p.posunUTC, false);
    if (S.p.letniCas && SH.jeLetniCasEU(ms - 3600000)) ms -= 3600000;
    const v = SH.deklinaceSteny(ms, S.p.sirka, S.p.delka, b);
    $('mVysledek').innerHTML = v.vyskaSlunce <= 0 ? '<span class="chyba">V tu dobu je Slunce pod obzorem.</span>'
      : `Azimut Slunce ${f1(v.azimutSlunce)}° (výška ${f1(v.vyskaSlunce)}°) → deklinace stěny <b>D = ${f1(v.D)}°</b> (${v.D > 0 ? 'na západ' : v.D < 0 ? 'na východ' : 'přesně jih'}).`;
    $('mPouzit').dataset.d = v.D.toFixed(1);
  }

  /* ---------- simulace ---------- */
  const rokSim = () => S.p.rok;
  const dniRoku = () => ((rokSim() % 4 === 0 && rokSim() % 100 !== 0) || rokSim() % 400 === 0 ? 366 : 365);
  function msSim() {
    const den = S.sim.den, min = S.sim.cas;
    let ms = SH.denVRoce(rokSim(), den) + (min / 60 - S.p.posunUTC) * 3600000;
    const dst = S.p.letniCas && SH.jeLetniCasEU(ms - 3600000);
    if (dst) ms -= 3600000;
    return { ms, dst };
  }
  function simuluj() {
    if (!R) return;
    if (S.sim.den == null) simTed(true);
    $('simDen').max = dniRoku();
    $('simDen').value = S.sim.den; $('simCas').value = S.sim.cas;
    const datum = new Date(SH.denVRoce(rokSim(), S.sim.den));
    $('simDatum').value = datum.toISOString().slice(0, 10);
    const { ms, dst } = msSim();
    $('simCasH').textContent = SH.fmtCas(S.sim.cas / 60) + (dst ? ' letní' : '');
    const v = R.sim(ms), pol = v.poloha, g = document.getElementById('simStin');
    if (g) g.innerHTML = v.prvky ? SHV.svgPrvky(v.prvky) : '';
    const kd = korekceMin();
    if (S.p.typ === 'kapesni') {
      const st = pol.vyska <= 0 ? '<span class="chyba">Slunce je pod obzorem.</span>' : v.mimo ? '<span class="varovani">Stín kolíku přesahuje sloupec.</span>' : '<span class="ok">Stín kolíku je ve sloupci ' + v.sloupec + '.</span>';
      const ct = v.cteni == null ? '–' : SH.fmtCas(v.cteni) + ' / ' + SH.fmtCas(v.cteni2);
      $('simUdaje').innerHTML = `<div class="velky"><span>${st}</span><span></span></div>
        <div><span>hodinky</span><span>${SH.fmtCas(S.sim.cas / 60)} ${dst ? 'SELČ' : S.p.posunUTC === 1 ? 'SEČ' : ''}</span></div>
        <div><span>sloupec</span><span>${v.sloupec || '–'}</span></div>
        <div><span>výška Slunce</span><span>${f1(pol.vyska, 2)}°</span></div>
        <div><span>délka stínu</span><span>${v.pad != null ? f1(v.pad, 1) + ' mm' : '–'}</span></div>
        <div><span>hodiny ukazují (dop./odp.)</span><span>${ct}</span></div>
        <div><span>pravý sluneční čas</span><span>${SH.fmtCas(pol.pravyCas)}</span></div>
        <div><span>deklinace dnes / sloupce</span><span>${f1(pol.deklinace, 1)}° / ${v.deklinaceSloupce != null ? f1(v.deklinaceSloupce, 1) + '°' : '–'}</span></div>
        <div><span>azimut (natočit k)</span><span>${f1(pol.azimut, 1)}°</span></div>
        <div><span>rovnice času</span><span>${SH.fmtMin(pol.rovniceCasu)} min</span></div>`;
      return;
    }
    const stav = pol.vyska <= 0 ? '<span class="chyba">Slunce je pod obzorem.</span>' : !v.prvky ? '<span class="varovani">Slunce na tuto plochu ciferníku nesvítí.</span>' : !v.naCifernku && S.p.typ !== 'analematicke' && S.p.typ !== 'ekvatorialni' ? '<span class="varovani">Stín nodu padá mimo ciferník.</span>' : '<span class="ok">Stín je na ciferníku.</span>';
    let sc = '';
    if (window.SunCalc) {
      const b = SunCalc.getPosition(new Date(ms), S.p.sirka, S.p.delka);
      const dv = pol.vyska - b.altitude * 180 / Math.PI, da = ((pol.azimut - (b.azimuth * 180 / Math.PI + 180) + 540) % 360) - 180;
      sc = `<div><span>kontrola SunCalc Δ</span><span>${f1(dv, 2)}° / ${f1(da, 2)}°</span></div>`;
    }
    const cteni = v.cteni + (dst ? 1 : 0), hodinky = S.sim.cas / 60;
    let rozdil = (hodinky - cteni) * 60; rozdil = ((rozdil + 720) % 1440) - 720;
    $('simUdaje').innerHTML = `<div class="velky"><span>${stav}</span><span></span></div>
      <div><span>hodinky</span><span>${SH.fmtCas(hodinky)} ${dst ? 'SELČ' : S.p.posunUTC === 1 ? 'SEČ' : ''}</span></div>
      <div><span>hodiny ukazují</span><span>${pol.vyska > 0 ? SH.fmtCas(cteni) : '–'}</span></div>
      <div><span>rozdíl (hodinky − hodiny)</span><span>${pol.vyska > 0 ? (rozdil >= 0 ? '+' : '') + f1(rozdil) + ' min' : '–'}</span></div>
      <div><span>pravý sluneční čas</span><span>${SH.fmtCas(pol.pravyCas)}</span></div>
      <div><span>výška Slunce</span><span>${f1(pol.vyska, 2)}°</span></div>
      <div><span>azimut</span><span>${f1(pol.azimut, 2)}°</span></div>
      <div><span>deklinace</span><span>${f1(pol.deklinace, 2)}°</span></div>
      <div><span>rovnice času</span><span>${SH.fmtMin(pol.rovniceCasu)} min</span></div>
      <div><span>korekce délky</span><span>${SH.fmtMin(kd)} min</span></div>${sc}`;
  }
  function simTed(tiche) {
    const d = new Date();
    const rok = rokSim();
    const z = Date.UTC(rok, d.getMonth(), d.getDate());
    S.sim.den = Math.min(dniRoku(), Math.round((z - Date.UTC(rok, 0, 1)) / 86400000) + 1);
    // hodinky v pásmu stránky
    const utcMin = d.getUTCHours() * 60 + d.getUTCMinutes();
    const dst = S.p.letniCas && SH.jeLetniCasEU(d.getTime());
    S.sim.cas = ((utcMin + (S.p.posunUTC + (dst ? 1 : 0)) * 60) % 1440 + 1440) % 1440;
    if (!tiche) simuluj();
  }
  let hraje = null, posledni = 0;
  function prehraj(rezim) {
    if (hraje) { hraje = null; $('simHraj').textContent = '▶ Přehrát den'; $('simRok').textContent = '📅 Rok ve 12:00'; return; }
    hraje = rezim;
    if (rezim === 'rok') { S.sim.cas = 12 * 60 + (S.p.letniCas ? 0 : 0); $('simRok').textContent = '⏸ Zastavit'; }
    else $('simHraj').textContent = '⏸ Zastavit';
    const krok = (t) => {
      if (!hraje) return;
      if (t - posledni > 40) {
        posledni = t;
        if (hraje === 'den') { S.sim.cas = (S.sim.cas + 3) % 1440; }
        else {
          S.sim.den = S.sim.den % dniRoku() + 1;
          // poledne v hodinkovém čase bez letního času (osmička analemy)
          const { dst } = msSim(); S.sim.cas = dst ? 13 * 60 : 12 * 60;
        }
        simuluj();
      }
      requestAnimationFrame(krok);
    };
    requestAnimationFrame(krok);
  }

  /* ---------- export ---------- */
  function stahni(obsah, nazev, typ) {
    const blob = obsah instanceof Blob ? obsah : new Blob([obsah], { type: typ });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const nazevSouboru = (pripona, x) => `slunecni_hodiny_${S.p.typ}${x || ''}.${pripona}`;
  function papir() {
    const t = S.tisk;
    if (t.papir === 'a3') return [297, 420];
    if (t.papir === 'letter') return [215.9, 279.4];
    if (t.papir === 'vlastni') return [Math.max(50, +t.papirW || 210), Math.max(50, +t.papirH || 297)];
    return [210, 297];
  }
  function infoListy() {
    if (!R) return;
    const [w, h] = papir();
    const a = SHV.rozvrhListu(R.cifernik, w, h, +S.tisk.okraj || 8, +S.tisk.prekryv || 0);
    const g = SHV.rozvrhListu(R.gnomon, w, h, +S.tisk.okraj || 8, +S.tisk.prekryv || 0);
    $('infoListy').innerHTML = `Ciferník: <b>${a.listy.length}</b> ${a.listy.length === 1 ? 'list' : a.listy.length < 5 ? 'listy' : 'listů'}${a.listy.length > 1 ? ` (${a.nx} × ${a.ny})` : ''}, gnomon: ${g.listy.length}, + strana s rovnicí času a návodem.`;
  }
  let pismoSlib = null;
  function nactiPismo() {
    if (window.FONTY_JS && window.FONTY_JS['LiberationSans-Regular.ttf']) return Promise.resolve(window.FONTY_JS['LiberationSans-Regular.ttf']);
    if (pismoSlib) return pismoSlib;
    pismoSlib = new Promise((ok) => {
      const s = document.createElement('script'); s.src = 'stitky_panely/fonty/LiberationSans-Regular.ttf.js';
      s.onload = () => ok((window.FONTY_JS || {})['LiberationSans-Regular.ttf'] || null);
      s.onerror = () => { pismoSlib = null; ok(null); };
      document.head.appendChild(s);
    });
    return pismoSlib;
  }
  function textNavodu() {
    const p = S.p, I = R.info, kd = korekceMin(), out = [];
    out.push('# Parametry');
    out.push(`Typ: ${TYPY.find((t) => t.id === p.typ).nazev}; poloha ${f1(p.sirka, 4)}° ${p.sirka >= 0 ? 'S' : 'J'}, ${f1(Math.abs(p.delka), 4)}° ${p.delka >= 0 ? 'V' : 'Z'}; pásmo UTC${p.posunUTC >= 0 ? '+' : '−'}${Math.abs(p.posunUTC)}${p.typ === 'deklinujici' ? '; deklinace stěny ' + f1(p.deklinace) + '°' : ''}.`);
    out.push(`Hodinové čáry ukazují ${p.korekceDelky ? 'čas pásma (korigováno o ' + f1(kd) + ' min na zeměpisnou délku)' : 'místní pravý sluneční čas'}; ${p.letniCas ? 'červená čísla = letní čas.' : ''}`);
    if (p.typ !== 'analematicke') out.push(`Výška nodu ${f1(I.vyskaNodu)} mm, styl svírá s ciferníkem ${f1(I.vyskaStylu)}°.`);
    out.push('# Korekce: hodinky = údaj hodin + korekce (min, bez letního času)');
    const k = SH.korekce(p);
    for (let m = 0; m < 12; m += 3) out.push(k.slice(m * 2, m * 2 + 6).map((x) => `${x.den}. ${x.mesic}.: ${x.k >= 0 ? '+' : '−'}${Math.abs(x.k).toFixed(1).replace('.', ',')}`).join('    '));
    out.push('# Osazení');
    const tmp = document.createElement('div'); tmp.innerHTML = $('navod').innerHTML;
    for (const el of tmp.querySelectorAll('h3, li')) out.push(el.tagName === 'H3' ? '# ' + el.textContent : '• ' + el.textContent.replace(/\s+/g, ' ').trim());
    return out;
  }
  async function pdfStahnout() {
    const b = $('btnPdf'), puv = b.textContent; b.disabled = true; b.textContent = 'Připravuji PDF…';
    try {
      if (!window.jspdf) throw new Error('Knihovna jsPDF se nenačetla.');
      const pismo = await nactiPismo();
      if (!pismo) toast('Písmo se nepodařilo načíst – PDF bude bez diakritiky.');
      const nazev = 'Sluneční hodiny – ' + TYPY.find((t) => t.id === S.p.typ).nazev;
      const doc = SHV.pdf(window.jspdf.jsPDF, [
        { scena: R.cifernik, nadpis: nazev + ' – ciferník' },
        { scena: R.gnomon, nadpis: nazev + ' – gnomon / šablona' },
        { nadpis: nazev + ' – rovnice času a návod', scena: SH.grafRovniceCasu(S.p, 180, 90), text: textNavodu(), ctverec: true },
      ], { papir: papir(), okraj: +S.tisk.okraj || 8, prekryv: +S.tisk.prekryv || 0, pismo, cernobile: S.tisk.cernobile, pomoc: S.p.popisky, nazev });
      stahni(doc.output('blob'), nazevSouboru('pdf'));
    } catch (e) { console.error(e); toast('Chyba PDF: ' + e.message, true); }
    finally { b.disabled = false; b.textContent = puv; }
  }

  /* ---------- události ---------- */
  let timer = 0;
  const naplanuj = () => { clearTimeout(timer); timer = setTimeout(prepocti, 90); };
  for (const id of POLE_P.concat(POLE_T)) {
    const el = $(id);
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => {
      zFormulare(id);
      if (id === 'sirka' || id === 'delka') $('mesto').value = '';
      if (id === 'nodusMm' || id === 'posunX' || id === 'posunY') { S.p.nodusAuto = false; $('nodusAuto').checked = false; }
      viditelnost();
      if (POLE_T.includes(id)) { infoListy(); uloz(); } else naplanuj();
    });
  }
  $('mesto').addEventListener('change', () => {
    const m = MESTA[+$('mesto').value]; if (!m) return;
    S.p.sirka = m[1]; S.p.delka = m[2]; S.p.posunUTC = m[3];
    doFormulare(); prepocti();
  });
  $('btnGps').addEventListener('click', () => {
    if (!navigator.geolocation) { toast('Prohlížeč neumí zjistit polohu.', true); return; }
    $('btnGps').disabled = true;
    navigator.geolocation.getCurrentPosition((p) => {
      $('btnGps').disabled = false;
      S.p.sirka = +p.coords.latitude.toFixed(5); S.p.delka = +p.coords.longitude.toFixed(5);
      const tz = -new Date().getTimezoneOffset() / 60 - (SH.jeLetniCasEU(Date.now()) ? 1 : 0);
      if (Number.isInteger(tz) && tz >= -12 && tz <= 14) S.p.posunUTC = tz;
      doFormulare(); prepocti(); toast('Poloha nastavena (přesnost ±' + Math.round(p.coords.accuracy) + ' m).');
    }, (e) => { $('btnGps').disabled = false; toast('Polohu nelze zjistit: ' + e.message, true); }, { enableHighAccuracy: true, timeout: 15000 });
  });
  function nastavTyp(typ) {
    if (S.p.typ === typ) return;
    S.rozmery[S.p.typ] = { tvar: S.p.tvar, sirkaMm: S.p.sirkaMm, vyskaMm: S.p.vyskaMm, nodusMm: S.p.nodusMm };
    S.p.typ = typ;
    Object.assign(S.p, S.rozmery[typ] || ROZMERY[typ]);
    if (typ === 'analematicke') S.p.nodusAuto = false;
    else if (!S.p.nodusAuto) S.p.nodusAuto = true;
    doFormulare(); prepocti();
  }
  $('typy').addEventListener('click', (e) => { const b = e.target.closest('button[data-typ]'); if (b) nastavTyp(b.dataset.typ); });
  for (const id of ['mDatum', 'mCas', 'mBeta']) $(id).addEventListener('input', mereni);
  $('mPouzit').addEventListener('click', () => { const d = parseFloat($('mPouzit').dataset.d); if (!isFinite(d)) return; S.p.deklinace = d; $('deklinace').value = d; prepocti(); toast('Deklinace stěny nastavena na ' + f1(d) + '°.'); });
  {
    const d = new Date(); $('mDatum').value = d.toISOString().slice(0, 10); $('mCas').value = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  $('simDen').addEventListener('input', () => { S.sim.den = +$('simDen').value; simuluj(); });
  $('simCas').addEventListener('input', () => { S.sim.cas = +$('simCas').value; simuluj(); });
  $('simDatum').addEventListener('change', () => {
    const v = $('simDatum').value; if (!v) return;
    const [r, m, d] = v.split('-').map(Number);
    if (r !== S.p.rok) { S.p.rok = r; $('rok').value = r; }
    S.sim.den = Math.round((Date.UTC(r, m - 1, d) - Date.UTC(r, 0, 1)) / 86400000) + 1;
    if (r !== R.p.rok) prepocti(); else simuluj();
  });
  $('simTed').addEventListener('click', () => {
    const r = new Date().getFullYear();
    if (S.p.rok !== r) { S.p.rok = r; $('rok').value = r; simTed(true); prepocti(); } else simTed();
  });
  $('simHraj').addEventListener('click', () => { if (hraje === 'rok') prehraj(); prehraj('den'); });
  $('simRok').addEventListener('click', () => { if (hraje === 'den') prehraj(); prehraj('rok'); });
  $('btnPdf').addEventListener('click', pdfStahnout);
  let manifoldSlib = null;
  function nactiSkript(src) { return new Promise((ok, chyba) => { const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = () => chyba(new Error('nejde načíst ' + src)); document.head.appendChild(el); }); }
  function nactiManifold() {
    if (manifoldSlib) return manifoldSlib;
    manifoldSlib = (async () => {
      globalThis.MANIFOLD_URL = new URL('lib/manifold/manifold.klasicky.js', location.href).href;
      if (!globalThis.ManifoldModule) await nactiSkript('lib/manifold/manifold.klasicky.js');
      let volby;
      if (location.protocol === 'file:') {
        await nactiSkript('lib/manifold/manifold.wasm.js');
        const b = atob(globalThis.MANIFOLD_WASM_B64), bin = new Uint8Array(b.length);
        for (let i = 0; i < b.length; i++) bin[i] = b.charCodeAt(i);
        delete globalThis.MANIFOLD_WASM_B64; volby = { wasmBinary: bin };
      } else volby = { locateFile: (f) => new URL('lib/manifold/' + f, location.href).href };
      const w = await globalThis.ManifoldModule(volby); w.setup(); return w;
    })();
    manifoldSlib.catch(() => { manifoldSlib = null; });
    return manifoldSlib;
  }
  async function stlSit() { const w = await nactiManifold(); return SHSTL.postavKapesni(w, R); }
  $('btnStl').addEventListener('click', async () => {
    const b = $('btnStl'), puv = b.textContent; b.disabled = true; b.textContent = 'Počítám STL…';
    try { const m = await stlSit(); stahni(new Blob([SHSTL.stlBinarni(m.poz, m.idx, 'kapesni slunecni hodiny')], { type: 'model/stl' }), nazevSouboru('stl')); toast('STL: ' + (m.idx.length / 3) + ' trojúhelníků, objem ' + f1(m.objem / 1000, 1) + ' cm³.'); }
    catch (e) { console.error(e); toast('STL se nepodařilo vytvořit: ' + e.message, true); }
    finally { b.disabled = false; b.textContent = puv; }
  });
  $('btnCanterbury').addEventListener('click', () => {
    // poloha katedrály v Canterbury; rozměry podle popisu originálu (61 × 16 mm celkem i s hlavicí) – tloušťka a délka kolíku jsou odhad
    Object.assign(S.p, { sirka: 51.2798, delka: 1.0828, posunUTC: 0, kapSteny: 2, kapSloupce: 'canterbury', kapCasy: 'historicke', sirkaMm: 16, vyskaMm: 48, tloustkaMm: 5, prumerTyce: 1.5, nodusAuto: true, cislice: 'rimske' });
    S.rozmery.kapesni = { tvar: 'obd', sirkaMm: 16, vyskaMm: 48, nodusMm: S.p.nodusMm, tloustkaMm: 5, prumerTyce: 1.5 };
    doFormulare(); prepocti(); toast('Předvolba Canterbury: 51,28° s. š., destička 16 × 48 mm (tloušťka a kolík odhadem).');
  });
  $('btnSvg').addEventListener('click', () => stahni(SHV.svg(R.cifernik, { pomoc: S.p.popisky, cernobile: S.tisk.cernobile, okraj: 2 }), nazevSouboru('svg'), 'image/svg+xml'));
  $('btnGnSvg').addEventListener('click', () => stahni(SHV.svg(R.gnomon, { cernobile: S.tisk.cernobile, okraj: 2 }), nazevSouboru('svg', '_gnomon'), 'image/svg+xml'));
  $('btnDxf').addEventListener('click', () => stahni(SHV.dxf(R.cifernik, { pomoc: S.p.popisky }), nazevSouboru('dxf'), 'application/dxf'));
  $('btnReset').addEventListener('click', async () => {
    if (!(await Dialog.potvrd('Vrátit všechna nastavení na výchozí hodnoty?'))) return;
    S = VYCH(); try { localStorage.removeItem(KLIC); } catch (e) { /* nic */ }
    doFormulare(); simTed(true); prepocti();
  });
  for (const b of $('zalozky').querySelectorAll('button')) b.addEventListener('click', () => {
    for (const x of $('zalozky').querySelectorAll('button')) x.setAttribute('aria-selected', String(x === b));
    for (const p of document.querySelectorAll('.panel')) p.hidden = p.dataset.p !== b.dataset.z;
  });
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' && t.type !== 'range' && t.type !== 'checkbox' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const m = /^Digit([1-7])$/.exec(e.code);
    if (m) { nastavTyp(TYPY[+m[1] - 1].id); e.preventDefault(); return; }
    if (e.code === 'Space') { e.preventDefault(); $('simHraj').click(); return; }
    if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && (!t || t.type !== 'range')) {
      e.preventDefault(); const k = (e.shiftKey ? 60 : 5) * (e.code === 'ArrowLeft' ? -1 : 1);
      S.sim.cas = ((S.sim.cas + k) % 1440 + 1440) % 1440; simuluj();
    }
  });

  doFormulare();
  simTed(true);
  prepocti();
  // ladění / testy
  window.SHApp = { get S() { return S; }, get R() { return R; }, prepocti, simuluj, nastavTyp, doFormulare, stlSit };
})();
