/* ============================================================
   Ptačí budky a hmyzí hotely – uživatelské rozhraní
   ============================================================ */
(function () {
  'use strict';
  const PB = window.PB, PBV = window.PBV, PBSTL = window.PBSTL, PBP = window.PBP;
  const $ = (id) => document.getElementById(id);
  const KLIC = 'webapp_ptaci_budky', KLIC_PROJEKTY = 'webapp_ptaci_budky_projekty';
  const cz = PB.cz;
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const toast = (t, ch) => (typeof Dialog !== 'undefined' ? (ch ? Dialog.chyba(t) : Dialog.info(t)) : console.log(t));

  /* ---------- definice polí ---------- */
  const jeNet = (P) => PB.DRUHY[P.druh].typ === 'netopyr', jePolo = (P) => PB.DRUHY[P.druh].typ === 'polobudka';
  const maOtvor = (P) => !jeNet(P) && !jePolo(P);
  const POLE_BUDKA = [
    { sk: 'Dutina' },
    { id: 'W', n: 'Šířka dna', min: 40, max: 600 },
    { id: 'D', n: 'Hloubka dna', min: 40, max: 600, kdy: (P) => !jeNet(P) },
    { id: 'sterbina', n: 'Štěrbina', min: 8, max: 40, kdy: jeNet },
    { id: 'Hf', n: 'Výška u čela', min: 40, max: 900 },
    { id: 'sklon', n: 'Sklon stříšky °', min: 0, max: 40, step: 0.5 },
    { id: 't', n: 'Tloušťka prkna', min: 6, max: 50, step: 0.5 },
    { sk: 'Vletový otvor', kdy: (P) => !jeNet(P) },
    { id: 'predniVyska', n: 'Výška čela (polobudka)', min: 30, max: 400, kdy: jePolo },
    { id: 'otvorTvar', n: 'Tvar', typ: 'sel', vol: [['kruh', 'kruhový'], ['oval', 'oválný']], kdy: maOtvor },
    { id: 'otvorD', n: 'Ø otvoru', min: 15, max: 200, step: 0.5, kdy: (P) => maOtvor(P) && P.otvorTvar !== 'oval' },
    { id: 'otvorW', n: 'Šířka otvoru', min: 15, max: 200, step: 0.5, kdy: (P) => maOtvor(P) && P.otvorTvar === 'oval' },
    { id: 'otvorH', n: 'Výška otvoru', min: 15, max: 200, step: 0.5, kdy: (P) => maOtvor(P) && P.otvorTvar === 'oval' },
    { id: 'otvorZ', n: 'Sp. hrana nad dnem', min: 0, max: 800, kdy: maOtvor },
    { id: 'otvorStena', n: 'Ve stěně', typ: 'sel', vol: [['predni', 'přední'], ['bok', 'levý bok (u zadní)']], kdy: maOtvor },
    { id: 'otvorX', n: 'Střed od lev. boku', min: 0, max: 600, prazdne: true, kdy: (P) => maOtvor(P) && P.otvorStena !== 'bok' },
    { id: 'odZadu', n: 'Okraj od zadní st.', min: 0, max: 100, kdy: (P) => maOtvor(P) && P.otvorStena === 'bok' },
    { sk: 'Stříška, zadní stěna, čištění' },
    { id: 'presahPredni', n: 'Přesah vpředu', min: 0, max: 200 },
    { id: 'presahBok', n: 'Přesah do stran', min: 0, max: 100 },
    { id: 'zadDole', n: 'Zadní st. dolů', min: 0, max: 300 },
    { id: 'zadNahore', n: 'Zadní st. nahoru', min: 0, max: 300 },
    { id: 'cisteni', n: 'Otevírání', typ: 'sel', vol: [['strecha', 'stříška na pantu'], ['bok', 'otočný bok'], ['zadne', 'žádné']], kdy: (P) => !jeNet(P) },
    { id: 'mezeraBok', n: 'Mezera nad bokem', min: 1, max: 6, step: 0.5, kdy: (P) => !jeNet(P) && P.cisteni === 'bok' },
    { id: 'odvodneni', n: 'Odvodňovací otvory ve dně', typ: 'chk', kdy: (P) => !jeNet(P) },
    { id: 'vetrani', n: 'Větrací otvory v bocích', typ: 'chk', kdy: (P) => !jeNet(P) && P.cisteni !== 'bok' },
    { id: 'vroubky', n: 'Vroubky pod otvorem', typ: 'chk', kdy: maOtvor },
  ];
  const POLE_HOTEL = [
    { id: 'W', n: 'Vnitřní šířka', min: 100, max: 1000 },
    { id: 'D', n: 'Hloubka', min: 60, max: 400 },
    { id: 'Hf', n: 'Výška u čela', min: 100, max: 1500 },
    { id: 'sklon', n: 'Sklon stříšky °', min: 0, max: 35, step: 0.5 },
    { id: 't', n: 'Tloušťka prkna', min: 8, max: 50, step: 0.5 },
    { id: 'presahPredni', n: 'Přesah vpředu', min: 0, max: 200 },
    { id: 'rozestup', n: 'Rozestup otvorů', min: 3, max: 30, step: 0.5 },
    { id: 'okraj', n: 'Okraj bloku', min: 4, max: 40, step: 0.5 },
  ];
  const NAST_VYCHOZI = { papir: 'a4', okraj: 8, prekryv: 15, papirW: 210, papirH: 297, kalibX: 100, kalibY: 100 };
  const TUNEL_VYCHOZI = { delka: null, stena: 2.5, lem: 12, deska: 3, vule: 0.5, sroub: 3.5 };

  /* ---------- stav ---------- */
  function vychoziStav() {
    return { rezim: 'budka', budka: PB.vychoziBudka('konadra'), hotel: PB.vychoziHotel(), nast: Object.assign({}, NAST_VYCHOZI), tunel: Object.assign({}, TUNEL_VYCHOZI), stitek: { r1: '', r2: '', sirka: 90, vyska: 32, tl: 3 }, nazev: '', vykres: 'rez', dil: 'predni' };
  }
  function slouc(u) {
    const S = vychoziStav();
    if (!u || typeof u !== 'object') return S;
    if (u.rezim === 'hotel') S.rezim = 'hotel';
    if (u.budka && PB.DRUHY[u.budka.druh]) S.budka = Object.assign(PB.vychoziBudka(u.budka.druh), u.budka);
    if (u.hotel) { S.hotel = Object.assign(S.hotel, u.hotel); if (!Array.isArray(S.hotel.patra) || !S.hotel.patra.length) S.hotel.patra = PB.vychoziHotel().patra; }
    S.nast = Object.assign(S.nast, u.nast || {}); S.tunel = Object.assign(S.tunel, u.tunel || {}); S.stitek = Object.assign(S.stitek, u.stitek || {});
    S.nazev = u.nazev || ''; S.vykres = u.vykres || 'rez'; S.dil = u.dil || 'predni';
    return S;
  }
  let S;
  try { S = slouc(JSON.parse(localStorage.getItem(KLIC) || 'null')); } catch (e) { S = vychoziStav(); }
  let ulozTimer = null;
  const uloz = () => { clearTimeout(ulozTimer); ulozTimer = setTimeout(() => { try { localStorage.setItem(KLIC, JSON.stringify(S)); } catch (e) { /* plné úložiště */ } }, 250); };
  const projekty = () => { try { return JSON.parse(localStorage.getItem(KLIC_PROJEKTY) || '{}') || {}; } catch (e) { return {}; } };
  const ulozProjekty = (o) => { try { localStorage.setItem(KLIC_PROJEKTY, JSON.stringify(o)); return true; } catch (e) { toast('Úložiště prohlížeče je plné.', true); return false; } };

  /* ---------- formuláře ---------- */
  function vykresliPole(obal, defs, P, prefix) {
    let h = '';
    for (const f of defs) {
      if (f.kdy && !f.kdy(P)) continue;
      if (f.sk) { h += `<div class="skupina">${esc(f.sk)}</div>`; continue; }
      const id = prefix + f.id, v = P[f.id];
      if (f.typ === 'sel') h += `<div><label for="${id}">${esc(f.n)}</label><select id="${id}" data-k="${f.id}">${f.vol.map(([a, b]) => `<option value="${a}"${String(v) === a ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select></div>`;
      else if (f.typ === 'chk') h += `<div class="cela"><label class="chk"><input type="checkbox" id="${id}" data-k="${f.id}"${v !== false ? ' checked' : ''}> ${esc(f.n)}</label></div>`;
      else h += `<div><label for="${id}">${esc(f.n)}</label><input id="${id}" data-k="${f.id}" type="number" min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${v == null ? '' : esc(v)}"${f.prazdne ? ' placeholder="střed"' : ''}></div>`;
    }
    obal.innerHTML = h;
  }
  function napojPole(obal, defs, ziskejP, prefix) {
    obal.addEventListener('input', (e) => {
      const el = e.target, k = el.dataset.k; if (!k) return;
      const P = ziskejP(), f = defs.find((q) => q.id === k);
      if (el.type === 'checkbox') P[k] = el.checked;
      else if (el.tagName === 'SELECT') P[k] = el.value;
      else if (f && f.prazdne && el.value === '') P[k] = null;
      else { const n = parseFloat(el.value); if (isFinite(n)) P[k] = n; else return; }
      if (el.tagName === 'SELECT' || el.type === 'checkbox') vykresliPole(obal, defs, P, prefix);
      prepocet();
    });
  }
  function druhyTlacitka() {
    $('druhy').innerHTML = PB.PORADI_DRUHU.map((k, i) => {
      const d = PB.DRUHY[k], kl = i < 9 ? String(i + 1) : i === 9 ? '0' : '-';
      return `<button type="button" data-druh="${k}" aria-pressed="${S.budka.druh === k}"><kbd>${kl}</kbd><span class="ik">${d.ikona}</span>${esc(d.nazev.replace(/ \(.*\)/, ''))}</button>`;
    }).join('');
  }
  function vyberDruh(k) {
    if (!PB.DRUHY[k]) return;
    const zach = { prorez: S.budka.prorez };
    S.budka = Object.assign(PB.vychoziBudka(k), zach);
    S.tunel.delka = null; S.rezim = 'budka';
    if (!S.stitek.r1) { /* text štítku podle druhu se doplní automaticky */ }
    obnovFormulare(); prepocet();
  }
  $('druhy').addEventListener('click', (e) => { const b = e.target.closest('button[data-druh]'); if (b) vyberDruh(b.dataset.druh); });

  function vykresliPatra() {
    const H = S.hotel, typy = Object.keys(PB.MODULY);
    $('patra').innerHTML = H.patra.map((p, i) => `
      <div class="patro" data-p="${i}">
        <div class="patro-hlava"><b>Patro ${i + 1}${i === H.patra.length - 1 ? ' (nahoře)' : ''}</b>
          <span>${i === H.patra.length - 1 ? '<span class="info">výška = zbytek pod stříškou</span>' : `<input type="number" data-pk="vyska" min="30" max="600" value="${esc(p.vyska)}" aria-label="výška patra"> `}</span>
          <button class="btn btn-sec btn-mini" type="button" data-akce="smazPatro" title="Smazat patro">✕</button></div>
        ${(p.moduly || []).map((m, j) => `<div class="modul" data-m="${j}">
          <select data-mk="typ" aria-label="typ modulu">${typy.map((t) => `<option value="${t}"${m.typ === t ? ' selected' : ''}>${esc(PB.MODULY[t].nazev)}</option>`).join('')}</select>
          <input type="number" data-mk="sirka" min="20" max="1000" value="${esc(m.sirka)}" aria-label="šířka modulu" title="šířka modulu (mm)">
          <input type="text" data-mk="prumery" value="${esc((m.prumery || []).join(', '))}" aria-label="průměry" title="průměry otvorů (mm), oddělené čárkou" placeholder="Ø, Ø, …">
          <button class="btn btn-sec btn-mini" type="button" data-akce="smazModul" title="Smazat modul">✕</button></div>`).join('')}
        <div class="tlacitka" style="margin-top:5px"><button class="btn btn-sec btn-mini" type="button" data-akce="pridejModul">+ modul</button></div>
      </div>`).join('');
  }
  $('patra').addEventListener('input', (e) => {
    const el = e.target, pe = el.closest('[data-p]'); if (!pe) return;
    const p = S.hotel.patra[+pe.dataset.p];
    if (el.dataset.pk) { const n = parseFloat(el.value); if (isFinite(n)) p.vyska = n; }
    const me = el.closest('[data-m]');
    if (me && el.dataset.mk) {
      const m = p.moduly[+me.dataset.m];
      if (el.dataset.mk === 'typ') m.typ = el.value;
      else if (el.dataset.mk === 'sirka') { const n = parseFloat(el.value); if (isFinite(n)) m.sirka = n; }
      else m.prumery = el.value.split(/[,;\s]+/).map((x) => parseFloat(x.replace(',', '.'))).filter((x) => isFinite(x) && x > 0);
    }
    prepocet();
  });
  $('patra').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-akce]'); if (!b) return;
    const pe = b.closest('[data-p]'), i = +pe.dataset.p, H = S.hotel;
    if (b.dataset.akce === 'smazPatro') { if (H.patra.length <= 1) return toast('Hotel musí mít aspoň jedno patro.'); if (!(await Dialog.potvrd(`Smazat patro ${i + 1}?`))) return; H.patra.splice(i, 1); }
    if (b.dataset.akce === 'pridejModul') H.patra[i].moduly.push({ typ: 'drevo', sirka: 80, prumery: [4, 6, 8] });
    if (b.dataset.akce === 'smazModul') H.patra[i].moduly.splice(+b.closest('[data-m]').dataset.m, 1);
    vykresliPatra(); prepocet();
  });
  $('btnPatro').addEventListener('click', () => { S.hotel.patra.splice(S.hotel.patra.length - 1, 0, { vyska: 100, moduly: [{ typ: 'drevo', sirka: S.hotel.W, prumery: [4, 6, 8] }] }); vykresliPatra(); prepocet(); });

  const aktP = () => (S.rezim === 'hotel' ? S.hotel : S.budka);
  function obnovFormulare() {
    $('rezBudka').setAttribute('aria-pressed', S.rezim === 'budka'); $('rezHotel').setAttribute('aria-pressed', S.rezim === 'hotel');
    $('blokDruhy').classList.toggle('skryte', S.rezim !== 'budka'); $('kartaBudka').classList.toggle('skryte', S.rezim !== 'budka');
    $('kartaHotel').classList.toggle('skryte', S.rezim !== 'hotel'); $('kartaStl').classList.toggle('skryte', S.rezim !== 'budka');
    druhyTlacitka();
    vykresliPole($('poleBudka'), POLE_BUDKA, S.budka, 'b_');
    vykresliPole($('poleHotel'), POLE_HOTEL, S.hotel, 'h_');
    vykresliPatra();
    const P = aktP();
    $('prB').value = P.B; $('prL').value = P.L; $('prRez').value = P.prorez;
    for (const k of ['papir', 'okraj', 'prekryv', 'papirW', 'papirH', 'kalibX', 'kalibY']) $(k).value = S.nast[k];
    $('blokPapir').classList.toggle('skryte', S.nast.papir !== 'vlastni');
    for (const [id, k] of [['tuStena', 'stena'], ['tuLem', 'lem'], ['tuDeska', 'deska'], ['tuVule', 'vule'], ['tuSroub', 'sroub']]) $(id).value = S.tunel[k];
    for (const [id, k] of [['stW', 'sirka'], ['stH', 'vyska'], ['stT', 'tl']]) $(id).value = S.stitek[k];
    $('stR1').value = S.stitek.r1; $('stR2').value = S.stitek.r2;
    $('nazevProjektu').value = S.nazev || '';
  }
  napojPole($('poleBudka'), POLE_BUDKA, () => S.budka, 'b_');
  napojPole($('poleHotel'), POLE_HOTEL, () => S.hotel, 'h_');
  $('rezBudka').addEventListener('click', () => { S.rezim = 'budka'; obnovFormulare(); prepocet(); });
  $('rezHotel').addEventListener('click', () => { S.rezim = 'hotel'; obnovFormulare(); prepocet(); });
  for (const [id, k] of [['prB', 'B'], ['prL', 'L'], ['prRez', 'prorez']]) $(id).addEventListener('input', (e) => { const n = parseFloat(e.target.value); if (isFinite(n)) { aktP()[k] = n; prepocet(); } });
  $('btnDoporucit').addEventListener('click', () => { const P = aktP(), d = PB.doporucPrkno(sestava, P.prorez); P.B = d.B; P.L = d.L; $('prB').value = d.B; $('prL').value = d.L; prepocet(); });
  for (const k of ['papir', 'okraj', 'prekryv', 'papirW', 'papirH', 'kalibX', 'kalibY']) $(k).addEventListener('input', (e) => { S.nast[k] = e.target.tagName === 'SELECT' ? e.target.value : parseFloat(e.target.value); $('blokPapir').classList.toggle('skryte', S.nast.papir !== 'vlastni'); prepocet(); });
  for (const [id, k] of [['tuDelka', 'delka'], ['tuStena', 'stena'], ['tuLem', 'lem'], ['tuDeska', 'deska'], ['tuVule', 'vule'], ['tuSroub', 'sroub']]) $(id).addEventListener('input', (e) => { const n = parseFloat(e.target.value); if (isFinite(n)) { S.tunel[k] = n; uloz(); infoTunel(); } });
  for (const [id, k] of [['stW', 'sirka'], ['stH', 'vyska'], ['stT', 'tl']]) $(id).addEventListener('input', (e) => { const n = parseFloat(e.target.value); if (isFinite(n)) { S.stitek[k] = n; uloz(); } });
  $('stR1').addEventListener('input', (e) => { S.stitek.r1 = e.target.value; uloz(); });
  $('stR2').addEventListener('input', (e) => { S.stitek.r2 = e.target.value; uloz(); });

  /* ---------- přepočet a vykreslení ---------- */
  let sestava = null, plan = null, casovac = null;
  function prepocet() { clearTimeout(casovac); casovac = setTimeout(vykresli, 60); uloz(); }
  function tunelNast() { const v = PBSTL.vychoziTunel(sestava); return Object.assign(v, Object.fromEntries(Object.entries(S.tunel).filter(([, x]) => x != null && isFinite(x)))); }
  function infoTunel() {
    if (S.rezim !== 'budka' || !sestava || !sestava.info.otv) { $('infoTunel').textContent = 'Tunel lze vytvořit jen pro budku s vletovým otvorem.'; $('btnTunel').disabled = true; return; }
    const t = tunelNast(); $('btnTunel').disabled = false;
    if (S.tunel.delka == null) $('tuDelka').value = t.delka;
    $('infoTunel').innerHTML = `Světlost ${t.tvar === 'oval' ? cz(t.w + t.vule) + ' × ' + cz(t.h + t.vule) : 'Ø ' + cz(t.w + t.vule)} mm (otvor + ${cz(t.vule)} mm), tunel ${cz(t.delka, 0)} mm, příruba ~${cz(t.w + t.vule + 2 * (t.stena + t.lem), 0)} mm. Přišroubujte 4 vruty Ø ${cz(t.sroub)} mm (nerez) na čelo budky soustředně s otvorem.`;
  }
  function vykresli() {
    const hotel = S.rezim === 'hotel';
    try { sestava = hotel ? PB.hotel(S.hotel) : PB.budka(S.budka); }
    catch (e) { console.error(e); toast('Chyba výpočtu: ' + e.message, true); return; }
    const P = aktP();
    plan = PB.rezny(sestava, { B: P.B, L: P.L, prorez: P.prorez });
    // popis druhu
    if (!hotel) {
      const D = sestava.druh;
      for (const b of $('druhy').querySelectorAll('button')) b.setAttribute('aria-pressed', b.dataset.druh === S.budka.druh);
      $('popisDruhu').innerHTML = `<b>${esc(D.nazev)}</b> (<i>${esc(D.lat)}</i>) · zavěšení ${D.zav[0]}–${D.zav[1]} m · orientace ${esc(D.orient)}.<br>${esc(D.pozn)}`;
      if (!S.stitek.r1) $('stR1').placeholder = D.nazev.replace(/ \(.*\)/, '');
      if (!S.stitek.r2) $('stR2').placeholder = String(new Date().getFullYear());
    }
    $('varovani').innerHTML = hotel ? '' : sestava.varovani.map((v) => `<li>${esc(v)}</li>`).join('');
    $('varovaniHotel').innerHTML = hotel ? sestava.varovani.map((v) => `<li>${esc(v)}</li>`).join('') : '';
    // souhrn
    const u = sestava.dutina, vn = sestava.vnejsi, o = sestava.info.otv;
    $('nadpisSouhrn').textContent = hotel ? 'Hmyzí hotel' : sestava.druh.nazev;
    $('vnejsiRozmer').textContent = `vnější ${cz(vn.sirka, 0)} × ${cz(vn.hloubka, 0)} × ${cz(vn.vyska, 0)} mm`;
    const pol = [];
    pol.push(['Vnitřní půdorys', `${cz(u.W, 0)} × ${cz(u.D, 0)} mm`]);
    pol.push(['Vnitřní výška', `${cz(u.Hf, 0)} → ${cz(u.Hb, 0)} mm`]);
    if (!hotel) {
      if (o) pol.push(['Vletový otvor', o.tvar === 'oval' ? `${cz(o.w, 0)} × ${cz(o.h, 0)} mm` : `Ø ${cz(o.w, 1)} mm`], ['Otvor nad dnem', `${cz(o.c[1] - o.h / 2 - u.zd, 0)} mm`]);
      if (sestava.info.predniV) pol.push(['Výška čela', `${cz(sestava.info.predniV, 0)} mm`]);
      pol.push(['Zavěšení', `${sestava.druh.zav[0]}–${sestava.druh.zav[1]} m`], ['Objem dutiny', `${cz(u.objem / 1e6, 2)} l`]);
    } else {
      pol.push(['Otvorů ve dřevě', String(sestava.pocetDer)], ['Trubiček', String(sestava.moduly.reduce((a, m) => a + (m.trubicek || 0), 0))], ['Patra / moduly', `${sestava.umisteni.length} / ${sestava.moduly.length}`]);
    }
    pol.push(['Prkno', `${cz(plan.potreba, 0)} z ${cz(plan.delkaPrkna, 0)} mm`]);
    $('souhrn').innerHTML = pol.map(([a, b]) => `<div>${esc(a)}<b>${esc(b)}</b></div>`).join('');
    // výkres
    vykresliVykres();
    // plán
    $('plan').innerHTML = PBV.svg(PBV.scenaPrkna(plan, { text: Math.max(1, plan.delkaPrkna / 380) }), { sirkaPx: true, okraj: 4, tlouskaKoef: Math.max(1, plan.delkaPrkna / 600) });
    $('infoPlan').textContent = `${plan.segmenty.length} kusů, prořezy ${cz(plan.prorezy, 0)} mm, zbytek ${cz(plan.zbytek, 0)} mm`;
    $('chybyPlan').innerHTML = plan.chyby.map((c) => `<li class="chyba">${esc(c)}</li>`).join('');
    $('infoPrkno').innerHTML = `Potřeba: <b>${cz(plan.potreba, 0)} mm</b> (díly ${cz(plan.soucetDilu, 0)} + prořezy ${cz(plan.prorezy, 0)}), nejširší díl ${cz(plan.maxSirka, 0)} mm. ${plan.vejde ? '<span class="ok">Vejde se.</span>' : '<span class="chyba">Nevejde se – viz řezný plán.</span>'}`;
    $('tabRezy').innerHTML = '<tr><th>#</th><th>Díl</th><th class="c">Odměřit</th><th class="c">Šířka</th><th class="c">Od začátku</th><th>Řez</th></tr>' +
      PBV.tabulkaRezu(plan).map((r) => `<tr><td>${r.c}</td><td>${esc(r.nazev)}</td><td class="c">${cz(r.odmerit)}</td><td class="c">${cz(r.sirka)}</td><td class="c">${cz(r.od)}</td><td>${esc(r.rez)}</td></tr>`).join('');
    // kusovník
    const dilyRadky = sestava.dily.map((d) => `<tr><td class="c">${d.ks || 1}</td><td>${esc(d.nazev)} – ${cz(d.plocha.sirka)} × ${cz(d.plocha.delka)} × ${cz(u.t)} mm</td><td>${esc(d.plocha.popis || '')}</td></tr>`).join('');
    $('tabKusovnik').innerHTML = '<tr><th class="c">ks</th><th>Položka</th><th>Poznámka</th></tr>' + dilyRadky +
      sestava.kusovnik.filter((k) => k.ks).map((k) => `<tr><td class="c">${k.ks}</td><td>${esc(k.polozka)}</td><td>${esc(k.pozn || '')}</td></tr>`).join('');
    // texty
    if (hotel) { $('princip').innerHTML = PBP.hotelText(sestava); $('postup').innerHTML = PBP.postup(Object.assign({}, sestava, { P: S.hotel, typ: 'hotel' })).replace(/<li><b>Vletový otvor[\s\S]*?<\/li>/, '<li><b>Otvory v blocích</b> vrtejte na stojanové vrtačce s hloubkovým dorazem, blok upnutý ve svěráku; vrták pravidelně vytahujte (třísky). Šablonu 1:1 přilepte na čelo bloku.</li>'); }
    else { $('princip').innerHTML = PBP.princip(sestava); $('postup').innerHTML = PBP.postup(sestava); }
    infoTunel();
    infoTisk();
    aktualizuj3d();
  }
  function sablony() { return PBV.vsechnySablony(sestava); }
  function infoTisk() {
    const [pw, ph] = PB.rozmerPapiru(S.nast);
    let listu = 0;
    for (const s of sablony()) listu += PB.rozvrhListu(s.scena, pw, ph, S.nast).listy.length;
    $('infoTisk').textContent = `Šablony 1:1: ${sablony().length} dílů na ${listu} listech ${S.nast.papir === 'vlastni' ? cz(pw, 0) + '×' + cz(ph, 0) + ' mm' : S.nast.papir.toUpperCase()} + úvodní strany s řezným plánem a kusovníkem.`;
  }
  function vykresliVykres() {
    for (const b of $('zalVykres').querySelectorAll('button')) b.setAttribute('aria-selected', b.dataset.z === S.vykres);
    const sab = S.vykres === 'sablona';
    $('dily').classList.toggle('skryte', !sab);
    let sc;
    if (sab) {
      const vs = sablony();
      if (!vs.some((s) => s.id === S.dil)) S.dil = vs[0].id;
      $('dily').innerHTML = vs.map((s) => `<button type="button" role="tab" data-dil="${s.id}" aria-selected="${s.id === S.dil}">${esc(s.nazev)}</button>`).join('');
      sc = vs.find((s) => s.id === S.dil).scena;
    } else sc = S.vykres === 'predek' ? PBV.pohledZepredu(sestava) : S.vykres === 'shora' ? PBV.pohledShora(sestava) : PBV.rezBokem(sestava);
    $('vykres').innerHTML = PBV.svg(sc, { sirkaPx: true, okraj: 3 });
  }
  $('zalVykres').addEventListener('click', (e) => { const b = e.target.closest('button[data-z]'); if (!b) return; S.vykres = b.dataset.z; vykresliVykres(); uloz(); });
  $('dily').addEventListener('click', (e) => { const b = e.target.closest('button[data-dil]'); if (!b) return; S.dil = b.dataset.dil; vykresliVykres(); uloz(); });
  $('zalNavod').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-z]'); if (!b) return;
    for (const x of $('zalNavod').querySelectorAll('button')) x.setAttribute('aria-selected', x === b);
    for (const p of document.querySelectorAll('.panel[data-p]')) p.hidden = p.dataset.p !== b.dataset.z;
  });

  /* ---------- stahování ---------- */
  function stahni(obsah, nazev, typ) {
    const blob = obsah instanceof Blob ? obsah : new Blob([obsah], { type: typ || 'application/octet-stream' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const zaklad = () => String(S.nazev || (S.rezim === 'hotel' ? 'hmyzi_hotel' : 'budka_' + S.budka.druh)).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'budka';
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
  const nazevSestavy = () => (S.nazev ? S.nazev + ' – ' : '') + (S.rezim === 'hotel' ? 'Hmyzí hotel' : 'Budka: ' + sestava.druh.nazev);
  function prehled() {
    const u = sestava.dutina, hotel = S.rezim === 'hotel', D = sestava.druh;
    const info = hotel
      ? [`Rám ${cz(u.W, 0)} × ${cz(u.D, 0)} mm, výška ${cz(u.Hf, 0)}–${cz(u.Hb, 0)} mm, prkno ${cz(u.t, 0)} mm. ${sestava.umisteni.length} pater, ${sestava.moduly.length} modulů, ${sestava.pocetDer} otvorů.`, 'Umístění: slunné místo J–JV, chráněné před deštěm, 0,5–2 m nad zemí. Otvory hladké a neprůchozí.']
      : [`${D.nazev} (${D.lat}): vnitřní dno ${cz(u.W, 0)} × ${cz(u.D, 0)} mm, výška ${cz(u.Hf, 0)}–${cz(u.Hb, 0)} mm, prkno ${cz(u.t, 0)} mm, sklon stříšky ${cz(u.alfa)}°.`,
        sestava.info.otv ? `Vletový otvor ${sestava.info.otv.tvar === 'oval' ? cz(sestava.info.otv.w, 0) + ' × ' + cz(sestava.info.otv.h, 0) + ' mm' : 'Ø ' + cz(sestava.info.otv.w, 1) + ' mm'}, spodní hrana ${cz(sestava.info.otv.c[1] - sestava.info.otv.h / 2 - u.zd, 0)} mm nad dnem.` : '',
        `Zavěšení ${D.zav[0]}–${D.zav[1]} m, orientace ${D.orient}. Rozměry jsou doporučení (${D.zdroje.map((z) => z.toUpperCase()).join(', ')}).`].filter(Boolean);
    return {
      info, varovani: sestava.varovani.concat(plan.chyby),
      pohledy: [{ nazev: 'Řez bokem', scena: PBV.rezBokem(sestava) }, { nazev: 'Pohled zepředu', scena: PBV.pohledZepredu(sestava) }],
      prkno: PBV.scenaPrkna(plan, { text: Math.max(1, plan.delkaPrkna / 700) }), tabulka: PBV.tabulkaRezu(plan),
      kusovnik: sestava.kusovnik,
    };
  }
  async function pdfStahnout(jenDil) {
    const b = jenDil ? $('btnPdfDil') : $('btnPdf'), puv = b.textContent; b.disabled = true; b.textContent = 'Připravuji PDF…';
    try {
      if (!window.jspdf) throw new Error('Knihovna jsPDF se nenačetla.');
      const pismo = await nactiPismo();
      if (!pismo) toast('Písmo se nepodařilo načíst – PDF bude bez diakritiky.');
      let sab = sablony();
      if (jenDil) { const id = S.vykres === 'sablona' ? S.dil : sab[0].id; sab = sab.filter((s) => s.id === id); }
      const st = PBV.strany(sab, S.nast, { nazev: nazevSestavy(), prehled: jenDil ? null : prehled() });
      const doc = PBV.pdf(window.jspdf.jsPDF, st, { pismo, nazev: nazevSestavy() });
      stahni(doc.output('blob'), zaklad() + (jenDil ? '_' + sab[0].id : '') + '.pdf');
    } catch (e) { console.error(e); toast('Chyba PDF: ' + e.message, true); }
    finally { b.disabled = false; b.textContent = puv; }
  }
  $('btnPdf').addEventListener('click', () => pdfStahnout(false));
  $('btnPdfDil').addEventListener('click', () => pdfStahnout(true));
  $('btnSvg').addEventListener('click', () => {
    const sc = S.vykres === 'sablona' ? sablony().find((s) => s.id === S.dil).scena : S.vykres === 'predek' ? PBV.pohledZepredu(sestava) : S.vykres === 'shora' ? PBV.pohledShora(sestava) : PBV.rezBokem(sestava);
    stahni(PBV.svg(sc, { okraj: 3 }), `${zaklad()}_${S.vykres === 'sablona' ? S.dil : S.vykres}.svg`, 'image/svg+xml');
  });
  $('btnDxf').addEventListener('click', () => stahni(PBV.dxf([PBV.scenaPrkna(plan)].concat(sablony().map((s) => s.scena))), zaklad() + '.dxf', 'application/dxf'));

  /* ---------- STL ---------- */
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
  let fontSlib = null;
  function nactiFont() {
    if (fontSlib) return fontSlib;
    fontSlib = (async () => {
      if (!window.opentype) await nactiSkript('lib/opentype.min.js');
      const b64 = await nactiPismo(); if (!b64) throw new Error('písmo se nenačetlo');
      const s = atob(b64), bin = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) bin[i] = s.charCodeAt(i);
      return window.opentype.parse(bin.buffer);
    })();
    fontSlib.catch(() => { fontSlib = null; });
    return fontSlib;
  }
  async function sPrubehem(id, text, fn) {
    const b = $(id), puv = b.textContent; b.disabled = true; b.textContent = text;
    try { await new Promise((r) => setTimeout(r, 20)); return await fn(); } catch (e) { console.error(e); toast('Chyba STL: ' + e.message, true); return null; }
    finally { b.disabled = false; b.textContent = puv; }
  }
  $('btnTunel').addEventListener('click', () => sPrubehem('btnTunel', 'Počítám STL…', async () => {
    const w = await nactiManifold(), m = PBSTL.tunel(w, tunelNast()), k = PBSTL.kontrolaSite(m.poz, m.idx);
    stahni(new Blob([PBSTL.stlBinarni(m.poz, m.idx, 'tunel otvoru')], { type: 'model/stl' }), zaklad() + '_tunel.stl');
    for (const v of m.varovani) toast(v);
    toast(`Tunel ${m.rozmer.map((x) => cz(x, 1)).join(' × ')} mm, objem ${cz(m.objem / 1000, 1)} cm³, ${k.uzavrena ? 'uzavřená síť' : 'POZOR: síť není uzavřená'}.`);
  }));
  $('btnStitek').addEventListener('click', () => sPrubehem('btnStitek', 'Počítám STL…', async () => {
    const [w, font] = await Promise.all([nactiManifold(), nactiFont()]);
    const r1 = S.stitek.r1 || (S.rezim === 'hotel' ? 'Hmyzí hotel' : sestava.druh.nazev.replace(/ \(.*\)/, '')), r2 = S.stitek.r2 || String(new Date().getFullYear());
    const m = PBSTL.stitek(w, font, { radky: [r1, r2], sirka: S.stitek.sirka, vyska: S.stitek.vyska, tl: S.stitek.tl });
    stahni(new Blob([PBSTL.stlBinarni(m.poz, m.idx, 'stitek')], { type: 'model/stl' }), zaklad() + '_stitek.stl');
    for (const v of m.varovani) toast(v);
  }));

  /* ---------- 3D ---------- */
  let pohled3d = null, nacita3d = false;
  function aktualizuj3d() { if (pohled3d && sestava) pohled3d.aktualizuj(sestava); }
  const io = new IntersectionObserver((z) => {
    if (!z.some((x) => x.isIntersecting) || pohled3d || nacita3d) return;
    nacita3d = true;
    const hotovo = () => {
      try { pohled3d = window.PB3D.vytvor($('obal3d')); $('stav3d').remove(); window.__pb3d = pohled3d; aktualizuj3d(); }
      catch (e) { $('stav3d').textContent = '3D není k dispozici: ' + e.message; }
    };
    if (window.THREE) { hotovo(); return; }
    nactiSkript('lib/three.0.160.0.min.js').then(hotovo).catch((e) => { nacita3d = false; $('stav3d').textContent = 'three.js se nenačetl: ' + e.message; });
  }, { rootMargin: '200px' });
  io.observe($('obal3d'));
  $('b3dSlozit').addEventListener('click', () => { if (!pohled3d) return; pohled3d.nastav(0, 0); pohled3d.slozit(); });
  $('b3dRozlozit').addEventListener('click', () => pohled3d && pohled3d.rozlozit());
  $('b3dOtevrit').addEventListener('click', () => { if (!pohled3d) return; if (S.rezim === 'budka' && sestava.cisteni === 'zadne') return toast('Tato budka se neotevírá (netopýří budka se nečistí).'); pohled3d.otevrit(); });
  $('b3dVychozi').addEventListener('click', () => pohled3d && pohled3d.pohled(-38, 22));
  $('b3dPredek').addEventListener('click', () => pohled3d && pohled3d.pohled(0, 5));

  /* ---------- projekty ---------- */
  function seznam() { const P = projekty(); $('seznamProjektu').innerHTML = Object.keys(P).sort((a, b) => a.localeCompare(b, 'cs')).map((k) => `<option>${esc(k)}</option>`).join('') || '<option value="">(žádné)</option>'; }
  $('nazevProjektu').addEventListener('input', (e) => { S.nazev = e.target.value; uloz(); });
  $('btnUlozit').addEventListener('click', async () => {
    let jm = (S.nazev || '').trim();
    if (!jm) { jm = await Dialog.zeptej('Název projektu', S.rezim === 'hotel' ? 'Hmyzí hotel' : sestava.druh.nazev); if (!jm) return; jm = jm.trim(); S.nazev = jm; $('nazevProjektu').value = jm; }
    const P = projekty();
    if (P[jm] && !(await Dialog.potvrd(`Projekt „${jm}“ už existuje. Přepsat?`))) return;
    P[jm] = JSON.parse(JSON.stringify(S));
    if (ulozProjekty(P)) { seznam(); $('seznamProjektu').value = jm; toast('Uloženo.'); }
  });
  $('btnNacist').addEventListener('click', () => { const j = $('seznamProjektu').value, P = projekty(); if (!P[j]) return; S = slouc(P[j]); obnovFormulare(); prepocet(); });
  $('btnSmazat').addEventListener('click', async () => { const j = $('seznamProjektu').value, P = projekty(); if (!P[j]) return; if (!(await Dialog.potvrd(`Smazat projekt „${j}“?`))) return; delete P[j]; ulozProjekty(P); seznam(); });
  $('btnExport').addEventListener('click', () => stahni(JSON.stringify({ format: 'ptaci_budky', verze: 1, projekt: S }, null, 2), zaklad() + '.json', 'application/json'));
  $('btnImport').addEventListener('click', () => $('souborProjekt').click());
  $('souborProjekt').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { const j = JSON.parse(await f.text()); if (!j || (j.format && j.format !== 'ptaci_budky')) throw new Error('není to projekt ptačích budek'); S = slouc(j.projekt || j); obnovFormulare(); prepocet(); toast('Projekt načten.'); }
    catch (er) { toast('Import se nezdařil: ' + er.message, true); }
  });
  $('btnReset').addEventListener('click', async () => { if (!(await Dialog.potvrd('Vrátit všechny parametry na výchozí hodnoty? (Uložené projekty zůstanou.)'))) return; S = vychoziStav(); obnovFormulare(); prepocet(); });

  /* ---------- klávesy ---------- */
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    let i = -1;
    const m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
    if (m) i = m[1] === '0' ? 9 : +m[1] - 1;
    else if (e.code === 'Minus' || e.code === 'NumpadSubtract') i = 10;
    if (i < 0 || i >= PB.PORADI_DRUHU.length) return;
    e.preventDefault();
    if (S.rezim !== 'budka') S.rezim = 'budka';
    vyberDruh(PB.PORADI_DRUHU[i]);
  });

  obnovFormulare(); seznam(); vykresli();
  window.__pb = { get S() { return S; }, get sestava() { return sestava; }, get plan() { return plan; }, vyberDruh };
})();
