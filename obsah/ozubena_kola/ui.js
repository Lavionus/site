/* Návrhář ozubených soukolí – ovládání stránky nad gen3d/aplikace.js (historie, projekt, Moje…, sdílení, klávesy).
   Jádro (Ozub, Soukoli, OZK) je v ozubena_kola/jadro.js, 3D náhled v ozubena_kola/nahled.js nad G3D.scena.
   Stav = projekt app.p {nazev, typ, hodnoty: {typ: {…}}, spol}; formulář se staví z OZK.POLE (formular: false). */
/* global Ozub, Soukoli, OZK, OZK_NAHLED, G3D, Dialog, TrubkyGui, THREE */
(function () {
  'use strict';
  const O = Ozub, MOD = Soukoli, f = MOD.f;
  const { PI, TAU } = O;
  const el = id => document.getElementById(id);
  const { TYPY, EVOL, OZUB, POLE, VYCHOZI, PREDVOLBY } = OZK;
  const KLIC = 'webapp_ozubena_kola';

  /* ==================================================================
     1. IKONY TYPŮ (popis parametrů, výchozí hodnoty a předvolby jsou v OZK)
     ================================================================== */
  const IKONY = {
    celni: '<circle cx="9" cy="13" r="6"/><circle cx="19.5" cy="13" r="4"/><path d="M9 5v2M9 19v2M3 13h-2M15 13h1M4.8 8.8l-1.4-1.4M4.8 17.2l-1.4 1.4M19.5 7.5v1.5M19.5 17v1.5M24 13h1"/>',
    vnitrni: '<circle cx="13" cy="13" r="11"/><circle cx="13" cy="13" r="8.5" stroke-dasharray="2 1.6"/><circle cx="16" cy="13" r="4.5"/>',
    hreben: '<path d="M1 8h3l1-3h3l1 3h2l1-3h3l1 3h2l1-3h3l1 3h2"/><circle cx="13" cy="17.5" r="5.5"/>',
    planeta: '<circle cx="13" cy="13" r="11.5"/><circle cx="13" cy="13" r="3.2"/><circle cx="13" cy="6" r="3.3"/><circle cx="7" cy="16.6" r="3.3"/><circle cx="19" cy="16.6" r="3.3"/>',
    cevove: '<circle cx="8" cy="13" r="5.5"/><circle cx="8" cy="7.5" r="1"/><circle cx="8" cy="18.5" r="1"/><circle cx="2.5" cy="13" r="1"/><circle cx="13.5" cy="13" r="1"/><path d="M16 5l3 1.5M16 21l3-1.5M15.5 9.5l7-2M15.5 16.5l7 2"/>',
    hodinove: '<circle cx="11" cy="13" r="9"/><path d="M11 13V7M11 13l4 2"/><circle cx="22" cy="6" r="3"/>',
    maltez: '<path d="M13 2v7M13 17v7M2 13h7M17 13h7"/><path d="M6 6q3 4 0 7M20 6q-3 4 0 7M6 20q3-4 0-7M20 20q-3-4 0-7" /><circle cx="13" cy="13" r="2"/>',
    rohatka: '<path d="M13 3l2 4 4-1-1 4 4 2-4 2 1 4-4-1-2 4-2-4-4 1 1-4-4-2 4-2-1-4 4 1z"/><path d="M15 3.5l8-2"/>',
  };

  /* ==================================================================
     2. STAV – projekt v G3D.aplikace (převod starého klíče webapp_ozubena_kola)
     ================================================================== */
  let app = null, noveZobrazeni = true;
  const zobrazCislo = x => (Number.isFinite(x) ? String(Math.round(x * 1e4) / 1e4).replace('.', ',') : '');
  (function prevedStaryStav() {
    try {
      if (localStorage.getItem(KLIC + '_projekt')) return;
      const d = JSON.parse(localStorage.getItem(KLIC) || 'null');
      if (!d || !d.typ) return;
      localStorage.setItem(KLIC + '_projekt', JSON.stringify(OZK.slij(null, d).p));
      if (d.pohled === '3d') {
        const z = JSON.parse(localStorage.getItem(KLIC + '_zobrazeni') || '{}');
        z.t3d = true; localStorage.setItem(KLIC + '_zobrazeni', JSON.stringify(z));
      }
    } catch (e) { /* bez úložiště nebo poškozený záznam */ }
  })();
  const P = () => app.p;
  const typAkt = () => app.p.typ;
  function stav() { return OZK.stav(app.p); }
  /** Změna projektu; nove = přepočet hned a nové přizpůsobení náhledu (typ, předvolba). */
  function zmen(fn, slouceni, nove) {
    if (nove) noveZobrazeni = true;
    app.zmen(fn, slouceni);
    if (nove) { app.naplnFormular(); prepocitejHned(); }
  }

  /* ==================================================================
     3. FORMULÁŘ
     ================================================================== */
  function textLabel(p) { return typeof p.label === 'string' ? p.label : (p.label[typAkt()] || Object.values(p.label)[0]); }

  function postavFormular() {
    const typy = el('typy');
    typy.innerHTML = TYPY.map(t => `<button type="button" class="typ" data-typ="${t.id}" aria-pressed="false">
        <svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IKONY[t.id]}</svg>
        <span><b>${t.nazev}</b><small>${t.popis}</small></span></button>`).join('');
    typy.addEventListener('click', e => {
      const b = e.target.closest('.typ');
      if (b) zmenTyp(b.dataset.typ);
    });
    // předvolby seskupené podle typu převodu
    const pv = el('seznamPredvoleb');
    for (const t of TYPY) {
      const moje = PREDVOLBY.map((p, i) => [p, i]).filter(([p]) => p.typ === t.id);
      if (!moje.length) continue;
      pv.insertAdjacentHTML('beforeend', `<div class="nab-nadpis">${t.nazev}</div>` +
        moje.map(([p, i]) => `<button class="pol" role="menuitem" data-predvolba="${i}">${p.nazev}</button>`).join(''));
    }
    pv.addEventListener('click', e => {
      const b = e.target.closest('[data-predvolba]');
      if (b) pouzijPredvolbu(+b.dataset.predvolba);
    });

    for (const p of POLE) {
      const idIn = 'p_' + p.id;
      if (p.s === 'zobrazeni') {   // vrstvy 2D půdorysu = přepínače v nabídce Zobrazení
        const b = document.createElement('button');
        b.className = 'pol'; b.id = idIn; b.setAttribute('role', 'menuitemcheckbox'); b.dataset.pole = p.id;
        b.innerHTML = `<span class="lbl"></span>`;
        b.addEventListener('click', () => zmen(q => { q.spol[p.id] = !q.spol[p.id]; }));
        el('sekce-zobrazeni').appendChild(b);
        continue;
      }
      const box = el('sekce-' + p.s);
      const w = document.createElement('div');
      w.className = 'fg pole' + (p.cely || p.typ === 'zatrzitko' ? ' cely' : '');
      w.dataset.pole = p.id;
      if (p.typ === 'zatrzitko') {
        w.innerHTML = `<label class="zatr" for="${idIn}" style="text-transform:none;letter-spacing:0;font-weight:500;font-size:.84rem;color:var(--text);justify-content:flex-start"><input type="checkbox" id="${idIn}"><span class="lbl"></span></label>`;
      } else if (p.typ === 'vyber') {
        w.innerHTML = `<label for="${idIn}"><span class="lbl"></span></label><select id="${idIn}"></select>`;
      } else {
        w.innerHTML = `<label for="${idIn}"><span class="lbl"></span>${p.j ? `<span class="j">${p.j}</span>` : ''}</label>
          <input type="text" id="${idIn}" inputmode="decimal" autocomplete="off">` +
          (p.nap ? `<div class="nap">${p.nap}</div>` : '');
      }
      box.appendChild(w);
      const inp = w.querySelector('#' + idIn);
      const zmena = () => {
        let v;
        if (p.typ === 'zatrzitko') v = inp.checked;
        else if (p.typ === 'vyber') v = inp.value;
        else {
          v = G3D.ctiCislo(inp.value);
          const ok = isFinite(v) && v >= p.min && v <= p.max && (!p.cele || Number.isInteger(v));
          inp.classList.toggle('chyba', !ok);
          if (!ok) return;
        }
        if (OZK.hodnota(app.p, p.id) === v) return;
        zmen(q => OZK.nastav(q, p.id, v), 'p_' + p.id);
      };
      if (p.typ === 'zatrzitko' || p.typ === 'vyber') inp.addEventListener('change', zmena);
      else {
        inp.addEventListener('input', zmena);
        inp.addEventListener('change', zmena);
        inp.addEventListener('blur', () => { if (inp.classList.contains('chyba')) { inp.value = zobrazCislo(OZK.hodnota(app.p, p.id)); inp.classList.remove('chyba'); } });
        // šipky: ± krok pole, Shift × 10
        inp.addEventListener('keydown', e => {
          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
          const x = G3D.ctiCislo(inp.value); if (!isFinite(x)) return;
          e.preventDefault();
          const k = p.krok * (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
          inp.value = zobrazCislo(Math.min(p.max, Math.max(p.min, Math.round((x + k) * 1e4) / 1e4)));
          zmena();
        });
      }
    }
    el('btnProtiPodrezani').addEventListener('click', () => {
      const S = stav();
      const an = O.rad(+S.alfa), beta = S.zuby === 'prime' ? 0 : O.rad(S.beta);
      const xmin = z => Math.max(0, Math.round((S.ha - z * Math.sin(Math.atan(Math.tan(an) / Math.cos(beta))) ** 2 / (2 * Math.cos(beta))) * 100 + 0.5) / 100);
      zmen(q => {
        if (q.typ === 'celni') { OZK.nastav(q, 'x1', xmin(S.z1)); OZK.nastav(q, 'x2', xmin(S.z2)); OZK.nastav(q, 'aw', 0); }
        else if (q.typ === 'hreben') OZK.nastav(q, 'x1', xmin(S.z1));
      });
      app.naplnFormular();
    });
    el('btnBezKorekce').addEventListener('click', () => {
      zmen(q => {
        if (q.typ === 'celni') { OZK.nastav(q, 'x1', 0); OZK.nastav(q, 'x2', 0); OZK.nastav(q, 'aw', 0); }
        else if (q.typ === 'hreben') OZK.nastav(q, 'x1', 0);
      });
      app.naplnFormular();
    });
  }

  /** Viditelnost polí, popisky podle typu a cesty data-p (pro skok z hlášení a testy). */
  function aktualizujViditelnost() {
    const p = app.p, typ = p.typ;
    document.querySelectorAll('.typ').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.typ === typ)));
    for (const q of POLE) {
      const w = document.querySelector(`[data-pole="${q.id}"]`);
      w.classList.toggle('skryt', !OZK.viditelne(p, q));
      w.querySelector('.lbl').innerHTML = textLabel(q);
      const inp = el('p_' + q.id);
      if (q.s === 'zobrazeni') inp.setAttribute('aria-pressed', String(!!p.spol[q.id]));
      else inp.dataset.p = OZK.cesta(p, q.id);
    }
    // šípové zuby jen tam, kde dávají smysl
    const zs = el('p_zuby');
    if (zs) for (const o of zs.options) o.disabled = o.value === 'sipove' && !['celni', 'planeta'].includes(typAkt());
    el('det-korekce').classList.toggle('skryt', !OZUB.includes(typAkt()));
    el('korekce-btn').classList.toggle('skryt', !['celni', 'hreben'].includes(typAkt()));
  }

  function obnovFormular() {
    const p = app.p;
    for (const q of POLE) {
      if (q.s === 'zobrazeni') continue;
      const inp = el('p_' + q.id);
      const v = OZK.hodnota(p, q.id);
      if (q.typ === 'vyber') {
        const moz = q.moznosti;
        if (inp.options.length !== moz.length) inp.innerHTML = moz.map(([k, t]) => `<option value="${k}">${t}</option>`).join('');
        inp.value = v == null ? moz[0][0] : String(v);
      } else if (q.typ === 'zatrzitko') inp.checked = !!v;
      else { inp.value = v == null ? '' : zobrazCislo(v); inp.classList.remove('chyba'); }
    }
    el('f_nazev').value = p.nazev || '';
    aktualizujViditelnost();
  }

  function zmenTyp(t) {
    if (t === typAkt()) return;
    zmen(q => { q.typ = t; }, null, true);
  }
  function pouzijPredvolbu(i) {
    if (!PREDVOLBY[i]) return;
    zmen(q => { const r = OZK.predvolba(q, i); Object.keys(q).forEach(k => delete q[k]); Object.assign(q, r); }, null, true);
  }

  /* ==================================================================
     4. PŘEPOČET MODELU
     ================================================================== */
  let model = null, cesty = [], chybaModelu = null;
  let casovac = 0;
  function naplanujPrepocet() {
    clearTimeout(casovac);
    casovac = setTimeout(() => prepocitej(), 110);
  }
  function prepocitejHned() { clearTimeout(casovac); prepocitej(); }

  function cestaTelesa(t) {
    const p = new Path2D();
    for (const smycka of [t.obrys, ...(t.otvory || [])]) {
      smycka.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y));
      p.closePath();
    }
    return p;
  }

  function prepocitej() {
    const nove = noveZobrazeni; noveZobrazeni = false;
    const S = stav();
    S.alfa = +S.alfa;
    try {
      model = MOD.sestav(S, 'normal');
      chybaModelu = null;
    } catch (e) {
      model = null;
      chybaModelu = e.message || String(e);
      vykresliVarovani();
      const st = el('stav3d'); st.textContent = 'Soukolí nejde sestavit: ' + chybaModelu; st.classList.add('chyba');
      nahled.nastav(null); prekresli();
      return;
    }
    el('stav3d').textContent = ''; el('stav3d').classList.remove('chyba');
    cesty = model.dily.map(d => d.telesa.map(cestaTelesa));
    spinave3d = true;
    vykresliVysledky();
    vykresliKusovnik();
    naplnExportDilu();
    naplnRucniDily();
    vykresliRucni();
    aktualizujLegendu();
    souhrny();
    if (nove || !pohled2d.nastaveno) prizpusob2d();
    if (nove) umisteno3d = false;
    if (rezim === '3d') postav3d();
    else vypisTisk(null);
    prekresli();
  }
  function souhrny() {
    const S = stav(), t = TYPY.find(x => x.id === S.typ);
    const oz = S.typ === 'maltez' ? `${S.mzN} drážek · C ${f(S.mzC, 1)} mm` : S.typ === 'rohatka' ? `${S.roZ} zubů · Ø ${f(S.roD, 1)} mm`
      : `${t.nazev}${S.m ? ` · m ${f(S.m, 2)}` : ''}`;
    TrubkyGui.souhrn('sOzubeni', oz, true);
    TrubkyGui.souhrn('sKorekce', S.typ === 'celni' ? `x₁ ${f(S.x1, 2)} · x₂ ${f(S.x2, 2)} · j ${f(S.jt, 2)}` : S.jt != null ? `j ${f(S.jt, 2)} mm` : '', true);
    TrubkyGui.souhrn('sHridele', `Ø ${f(S.d1, 1)}${S.d2 != null && OZK.viditelne(app.p, POLE.find(q => q.id === 'd2')) ? ' / ' + f(S.d2, 1) : ''} · ${{ kruh: 'kruhový', pero: 'pero', D: 'D', sestihran: 'šestihran' }[S.otvor]}${S.odlehceni ? ' · odlehčení' : ''}`, true);
    TrubkyGui.souhrn('sZatizeni', `${f(S.M1, 2)} N·m · ${f(S.n1, 0)} min⁻¹ · ${MOD.MATERIALY[S.material].nazev}`, true);
    TrubkyGui.souhrn('sExport', `${el('expRozlozeni').value === 'sestava' ? 'v sestavě' : 'na podložku'} · ${el('expJemnost').value === 'jemna' ? 'jemná síť' : 'normální síť'}`, true);
  }

  /* ==================================================================
     5. VÝSLEDKY, VAROVÁNÍ, KUSOVNÍK
     ================================================================== */
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // varování sestavy → hlášení gen3d (záložka Kontrola + odznak v liště)
  function vykresliVarovani() {
    const UR = { chyba: 'chyba', pozor: 'varovani', info: 'info', ok: 'ok' };
    const text = t => String(t).replace(/<[^>]+>/g, '');
    const H = (model && !chybaModelu ? model.varovani : []).map(x => ({ uroven: UR[x.u] || 'info', text: text(x.t) }));
    if (!chybaModelu && !H.some(x => x.uroven !== 'info')) H.unshift({ uroven: 'ok', text: 'Geometrie je v pořádku — bez podřezání, špičatých zubů a interference.' });
    app.hlaseni(H, { chybaStavby: chybaModelu ? 'Soukolí nejde sestavit: ' + chybaModelu : '', boxy: ['boxSoukoli', 'boxHridele'] });
  }

  function vykresliVysledky() {
    el('kpi').innerHTML = model.souhrn.slice(0, 4).map(([l, v, p]) => `<div><small>${l}</small><b>${v}</b><span>${p || '&nbsp;'}</span></div>`).join('');
    vykresliVarovani();
    let h = '<table class="t"><tbody>';
    for (const g of model.skupiny) {
      h += `<tr><td colspan="3" class="sk">${g.nadpis}</td></tr>`;
      for (const [l, v, j] of g.radky) h += `<tr><td>${l}</td><td class="c">${v}</td><td class="j">${j || ''}</td></tr>`;
    }
    el('vypocet').innerHTML = h + '</tbody></table>';
    if (model.tabulky.length) {
      const t = model.tabulky[0];
      let s = `<table class="t"><thead><tr>${t.hlavicka.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>`;
      for (const r of t.radky) s += `<tr><td>${r[0]}</td>${r.slice(1, -1).map(x => `<td class="c">${x}</td>`).join('')}<td class="j">${r[r.length - 1]}</td></tr>`;
      s += '</tbody></table>';
      const S = stav();
      s += `<p class="poznamka">Základní profil: α = ${f(+S.alfa, 1)}°, h<sub>a</sub>* = ${f(S.ha, 2)}, c* = ${f(S.c, 2)}, ρ* = ${f(S.rho, 2)}. Rozměr přes zuby platí pro nulovou vůli.</p>`;
      el('tabulkaKol').innerHTML = s;
    } else {
      el('tabulkaKol').innerHTML = '<p class="prazdne">Tento převod nemá evolventní ozubení — hlavní rozměry jsou ve výpočtu vlevo.</p>';
    }
  }

  // Díly se stejnou skupinou (satelity) se v kusovníku sečtou do jednoho řádku.
  function polozkyKusovniku() {
    const S = stav();
    const mat = MOD.MATERIALY[S.material];
    const radky = [];
    const skupiny = new Map();
    for (const d of model.dily) {
      const klic = d.skupina || d.id;
      if (skupiny.has(klic)) { skupiny.get(klic).pocet++; continue; }
      const r = { nazev: d.skupina ? d.nazev.replace(/\s*\d+$/, '') : d.nazev, barva: d.barva, pocet: 1, druh: d.bom.druh, rozmer: d.bom.rozmer, param: d.bom.param, material: mat.nazev, hm: d.hmotnost };
      skupiny.set(klic, r);
      radky.push(r);
    }
    for (const n of model.nakup) radky.push({ nazev: n.nazev, pocet: n.pocet, druh: 'nakupovaný / normalizovaný díl', rozmer: n.rozmer, param: n.pozn, material: '—', hm: null });
    return radky;
  }

  function vykresliKusovnik() {
    const radky = polozkyKusovniku();
    let celkem = 0;
    let h = '<table class="t"><thead><tr><th>Poz.</th><th>Název</th><th>Ks</th><th>Rozměr</th><th>Parametry</th><th>Materiál</th><th>Hmotnost / ks</th><th>Celkem</th></tr></thead><tbody>';
    radky.forEach((r, i) => {
      const c = r.hm != null ? r.hm * r.pocet : null;
      if (c != null) celkem += c;
      h += `<tr><td>${i + 1}</td><td>${r.barva ? `<span class="barva" style="background:${r.barva}"></span>` : ''}${esc(r.nazev)}<br><small style="color:var(--text-faint)">${esc(r.druh)}</small></td>
        <td class="c">${r.pocet}</td><td>${esc(r.rozmer)}</td><td>${esc(r.param || '')}</td><td>${esc(r.material)}</td>
        <td class="c">${r.hm != null ? f(r.hm, 1) + ' g' : '—'}</td><td class="c">${c != null ? f(c, 1) + ' g' : '—'}</td></tr>`;
    });
    h += `<tr class="sum"><td></td><td>Celkem vyráběné díly</td><td></td><td></td><td></td><td></td><td></td><td class="c">${f(celkem, 1)} g</td></tr></tbody></table>`;
    h += '<p class="poznamka">Hmotnost je pro plný materiál. U tištěných dílů s výplní 20–40 % vyjde zhruba o třetinu až polovinu menší.</p>';
    el('kusovnik').innerHTML = h;
  }

  function csvKusovnik() {
    const radky = polozkyKusovniku();
    const q = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
    const out = [['Pozice', 'Název', 'Druh', 'Kusů', 'Rozměr', 'Parametry', 'Materiál', 'Hmotnost/ks [g]', 'Celkem [g]'].map(q).join(';')];
    radky.forEach((r, i) => out.push([i + 1, r.nazev, r.druh, r.pocet, r.rozmer, r.param, r.material,
      r.hm != null ? f(r.hm, 2) : '', r.hm != null ? f(r.hm * r.pocet, 2) : ''].map(q).join(';')));
    stahni(new Blob(['﻿' + out.join('\r\n')], { type: 'text/csv;charset=utf-8' }), jmeno('kusovnik', 'csv'));
  }

  function aktualizujLegendu() {
    const S = stav();
    const polozky = [];
    if (S.kruznice) {
      polozky.push(['roztečná', barvaKruznice('roztecna'), '6 4']);
      if (EVOL.includes(typAkt())) polozky.push(['základní', barvaKruznice('zakladni'), '2 3']);
    }
    if (S.primka && EVOL.includes(typAkt()) && model && model.primky.length) polozky.push(['dráha záběru', barvy.akcent, '']);
    el('legenda').innerHTML = polozky.map(([t, c, d]) => `<span><i style="border-color:${c};${d ? 'border-top-style:dashed' : ''}"></i>${t}</span>`).join('');
    el('legenda').classList.toggle('skryt', !polozky.length || rezim === '3d');
  }

  /* ==================================================================
     6. 2D NÁHLED S ANIMACÍ
     ================================================================== */
  const platno = el('platno2d'), ctx = platno.getContext('2d');
  const pohled2d = { cx: 0, cy: 0, meritko: 4, nastaveno: false };
  let W = 0, H = 0, DPR = 1;
  let cas = 0, hraje = true, otackyVstupu = 8;
  let rezim = '2d';
  const barvy = {};

  function nactiBarvy() {
    const cs = getComputedStyle(document.documentElement);
    const v = (n, d) => (cs.getPropertyValue(n).trim() || d);
    barvy.pozadi = v('--bg-deep', '#121212');
    barvy.text = v('--text', '#e0e0e0');
    barvy.slaby = v('--text-faint', '#888');
    barvy.stredni = v('--text-muted', '#b0b0b0');
    barvy.mrizka = v('--border', '#404040');
    barvy.akcent = v('--accent', '#6aa6fd');
    barvy.ok = v('--ok', '#4caf7d');
    barvy.svetle = document.documentElement.dataset.theme === 'light';
    barvy.pismo = getComputedStyle(document.body).fontFamily || 'sans-serif';
  }
  function barvaKruznice(druh) {
    return { roztecna: barvy.stredni, zakladni: barvy.ok, hlavova: barvy.slaby, patni: barvy.slaby, draha: barvy.slaby }[druh] || barvy.slaby;
  }

  function velikost2d() {
    const box = el('canvas-container');
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    const zmena = box.clientWidth !== W || box.clientHeight !== H;
    W = box.clientWidth; H = box.clientHeight;
    platno.width = Math.max(1, Math.round(W * DPR));
    platno.height = Math.max(1, Math.round(H * DPR));
    if (zmena && model && !pohled2d.rucne) prizpusob2d();   // náhled změnil velikost a uživatel ho neposouval
    prekresli();
  }

  function uhel() { return model ? model.uhel(cas) : 0; }

  function obalka(fi) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const d of model.dily) {
      const p = d.poloha(fi), c = Math.cos(p.rot), s = Math.sin(p.rot);
      for (const t of d.telesa) for (const [x, y] of t.obrys) {
        const X = x * c - y * s + p.x, Y = x * s + y * c + p.y;
        if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
      }
    }
    return { x0, x1, y0, y1 };
  }

  function prizpusob2d() {
    if (!model || !W) return;
    const b = obalka(uhel());
    pohled2d.cx = (b.x0 + b.x1) / 2;
    pohled2d.cy = (b.y0 + b.y1) / 2;
    pohled2d.meritko = Math.min((W - 40) / (b.x1 - b.x0 || 1), (H - 70) / (b.y1 - b.y0 || 1)) * 0.94;
    pohled2d.nastaveno = true; pohled2d.rucne = false;
    prekresli();
  }

  function detailZaberu() {
    if (!model) return;
    const bod = model.primky.find(p => p.druh === 'bod');
    let cx, cy;
    if (bod) [cx, cy] = bod.a;
    else if (model.dily.length > 1) {
      const a = model.dily[0].poloha(uhel()), b = model.dily[1].poloha(uhel());
      cx = (a.x + b.x) / 2; cy = (a.y + b.y) / 2;
    } else return;
    const S = stav();
    const m = S.m || (S.mzDc ? S.mzDc / 2 : S.roH / 2) || 2;
    pohled2d.rucne = true;
    pohled2d.cx = cx; pohled2d.cy = cy;
    pohled2d.meritko = Math.min(W, H) / (m * 9);
    prekresli();
  }

  let pozadavek = 0;
  function prekresli() {
    if (pozadavek) return;
    pozadavek = requestAnimationFrame(() => { pozadavek = 0; kresli(); });
  }

  function kresli() {
    if (rezim === '3d') { kresli3d(); aktualizujHud(); return; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = barvy.pozadi;
    ctx.fillRect(0, 0, platno.width, platno.height);
    if (!model) return;
    const S = stav();
    const k = pohled2d.meritko * DPR;
    const ox = W * DPR / 2 - pohled2d.cx * k, oy = H * DPR / 2 + pohled2d.cy * k;
    const svet = () => ctx.setTransform(k, 0, 0, -k, ox, oy);
    const px = 1 / k * DPR;                       // jeden CSS pixel ve světových jednotkách

    // jemná mřížka po 10 mm (po 1 mm při velkém přiblížení)
    svet();
    const krokM = pohled2d.meritko > 25 ? 1 : pohled2d.meritko > 2.5 ? 10 : 100;
    const vx0 = pohled2d.cx - W / 2 / pohled2d.meritko, vx1 = pohled2d.cx + W / 2 / pohled2d.meritko;
    const vy0 = pohled2d.cy - H / 2 / pohled2d.meritko, vy1 = pohled2d.cy + H / 2 / pohled2d.meritko;
    ctx.beginPath();
    for (let x = Math.ceil(vx0 / krokM) * krokM; x <= vx1; x += krokM) { ctx.moveTo(x, vy0); ctx.lineTo(x, vy1); }
    for (let y = Math.ceil(vy0 / krokM) * krokM; y <= vy1; y += krokM) { ctx.moveTo(vx0, y); ctx.lineTo(vx1, y); }
    ctx.strokeStyle = barvy.mrizka; ctx.globalAlpha = 0.35; ctx.lineWidth = px; ctx.stroke(); ctx.globalAlpha = 1;

    const fi = uhel();
    const pozice = model.dily.map(d => d.poloha(fi));

    // tělesa: nejdřív průhledná (unašeč, čela cevníku, klika), pak ostatní
    for (const pruhl of [true, false]) {
      model.dily.forEach((d, i) => {
        const p = pozice[i];
        d.telesa.forEach((t, j) => {
          const jePruhl = !!(t.pruhledne || (d.pruhledneCela && !t.kolik));
          if (jePruhl !== pruhl) return;
          svet();
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          const cesta = cesty[i][j];
          if (jePruhl) {
            ctx.globalAlpha = 0.16; ctx.fillStyle = d.barva; ctx.fill(cesta, 'evenodd');
            ctx.globalAlpha = 0.8; ctx.setLineDash([5 * px, 4 * px]); ctx.strokeStyle = d.barva; ctx.lineWidth = px * 1.2; ctx.stroke(cesta);
            ctx.setLineDash([]); ctx.globalAlpha = 1;
          } else {
            ctx.globalAlpha = t.kolik ? 1 : 0.82; ctx.fillStyle = t.kolik ? tmavsi(d.barva) : d.barva; ctx.fill(cesta, 'evenodd');
            ctx.globalAlpha = 1; ctx.lineJoin = 'round'; ctx.strokeStyle = tmavsi(d.barva); ctx.lineWidth = px * 1.1; ctx.stroke(cesta);
          }
        });
        // značka sledující otáčení
        if (!pruhl && S.znacky && d.kruznice.length) {
          const r0 = Math.min(...d.kruznice.map(c => c.r));
          svet(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.beginPath(); ctx.arc(r0 * 0.72, 0, Math.max(3 * px, r0 * 0.04), 0, TAU);
          ctx.fillStyle = barvy.svetle ? '#ffffff' : '#101010'; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1;
        }
      });
    }

    // kružnice (neotáčejí se, jen se posouvají se středem dílu)
    if (S.kruznice) {
      model.dily.forEach((d, i) => {
        const p = pozice[i];
        for (const c of d.kruznice) {
          svet();
          ctx.beginPath(); ctx.arc(p.x, p.y, c.r, 0, TAU);
          ctx.strokeStyle = barvaKruznice(c.druh);
          ctx.lineWidth = px * (c.druh === 'roztecna' ? 1.2 : 0.9);
          ctx.setLineDash(c.druh === 'roztecna' ? [6 * px, 4 * px] : c.druh === 'zakladni' ? [2 * px, 3 * px] : [1.5 * px, 5 * px]);
          ctx.globalAlpha = c.druh === 'hlavova' || c.druh === 'patni' ? 0.6 : 0.95;
          ctx.stroke();
        }
        ctx.setLineDash([]); ctx.globalAlpha = 1;
        // středový křížek
        svet(); ctx.beginPath();
        const kr = 6 * px;
        ctx.moveTo(p.x - kr, p.y); ctx.lineTo(p.x + kr, p.y); ctx.moveTo(p.x, p.y - kr); ctx.lineTo(p.x, p.y + kr);
        ctx.strokeStyle = barvy.stredni; ctx.lineWidth = px; ctx.stroke();
      });
    }

    // přímka a dráha záběru
    if (S.primka && EVOL.includes(typAkt())) {
      for (const p of model.primky) {
        svet();
        if (p.druh === 'bod') {
          ctx.beginPath(); ctx.arc(p.a[0], p.a[1], 3.2 * px, 0, TAU);
          ctx.fillStyle = barvy.akcent; ctx.fill();
          continue;
        }
        ctx.beginPath(); ctx.moveTo(p.a[0], p.a[1]); ctx.lineTo(p.b[0], p.b[1]);
        ctx.strokeStyle = barvy.akcent;
        ctx.lineWidth = p.druh === 'draha' ? 3.2 * px : px;
        ctx.globalAlpha = p.druh === 'draha' ? 0.95 : 0.6;
        ctx.stroke(); ctx.globalAlpha = 1;
      }
    }

    // kóta osové vzdálenosti
    if (S.koty && model.dily.length >= 2 && !['hreben', 'planeta', 'rohatka'].includes(typAkt())) {
      const a = pozice[0], b = pozice[1];
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      if (L > 1e-6) {
        const r = Math.max(...model.dily[0].kruznice.map(c => c.r), ...model.dily[1].kruznice.map(c => c.r), 5);
        const off = -(r + 18 / pohled2d.meritko);
        const nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L;
        const A = [a.x + nx * off, a.y + ny * off], B = [b.x + nx * off, b.y + ny * off];
        // pomocné čáry od středů za kótu a kótovací čára
        const pres = 5 * px * Math.sign(off);
        svet(); ctx.beginPath();
        ctx.moveTo(a.x + nx * off * 0.88, a.y + ny * off * 0.88); ctx.lineTo(A[0] + nx * pres, A[1] + ny * pres);
        ctx.moveTo(b.x + nx * off * 0.88, b.y + ny * off * 0.88); ctx.lineTo(B[0] + nx * pres, B[1] + ny * pres);
        ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]);
        ctx.strokeStyle = barvy.stredni; ctx.lineWidth = px; ctx.globalAlpha = 0.8; ctx.stroke(); ctx.globalAlpha = 1;
        // šipky
        const sip = (P, dir) => {
          const ux = (b.x - a.x) / L * dir, uy = (b.y - a.y) / L * dir, s = 7 * px;
          ctx.beginPath(); ctx.moveTo(P[0], P[1]);
          ctx.lineTo(P[0] + ux * s + nx * s * 0.35, P[1] + uy * s + ny * s * 0.35);
          ctx.lineTo(P[0] + ux * s - nx * s * 0.35, P[1] + uy * s - ny * s * 0.35);
          ctx.closePath(); ctx.fillStyle = barvy.stredni; ctx.fill();
        };
        sip(A, 1); sip(B, -1);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const sx = ((A[0] + B[0]) / 2) * k + ox, sy = -((A[1] + B[1]) / 2) * k + oy;
        ctx.font = `${12 * DPR}px ${barvy.pismo}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        const txt = (typAkt() === 'maltez' ? 'C = ' : 'a = ') + f(L, 3) + ' mm';
        ctx.fillStyle = barvy.pozadi; const tw = ctx.measureText(txt).width;
        ctx.fillRect(sx - tw / 2 - 4 * DPR, sy - 17 * DPR, tw + 8 * DPR, 15 * DPR);
        ctx.fillStyle = barvy.text; ctx.fillText(txt, sx, sy - 3 * DPR);
      }
    }

    // popisky dílů
    if (S.popisky) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.font = `600 ${12 * DPR}px ${barvy.pismo}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const hotovo = new Set();
      model.dily.forEach((d, i) => {
        if (d.skupina && hotovo.has(d.skupina)) return;
        if (d.skupina) hotovo.add(d.skupina);
        const p = pozice[i];
        let x = p.x, y = p.y;
        if (d.stitek) { x += d.stitek[0]; y += d.stitek[1]; }
        if (d.id === 'hr') y += (stav().hrTelo || 0) / 2 + 2;
        if (d.id === 'un') return;
        const sx = x * k + ox, sy = -y * k + oy - 16 * DPR;
        const txt = d.skupina ? d.nazev.replace(/\s*\d+$/, '') : d.nazev;
        const tw = ctx.measureText(txt).width;
        ctx.fillStyle = barvy.pozadi; ctx.globalAlpha = 0.8;
        ctx.fillRect(sx - tw / 2 - 5 * DPR, sy - 9 * DPR, tw + 10 * DPR, 18 * DPR);
        ctx.globalAlpha = 1; ctx.fillStyle = barvy.text; ctx.fillText(txt, sx, sy);
      });
    }
    aktualizujHud();
  }

  function tmavsi(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255, q = barvy.svetle ? 0.62 : 0.55;
    return `rgb(${Math.round(r * q)},${Math.round(g * q)},${Math.round(b * q)})`;
  }

  function aktualizujHud() {
    if (!model || !model.kinematika || (rezim === '3d' && zobr.tisk)) { el('hud').textContent = ''; return; }
    const K = model.kinematika, fi = uhel();
    const deg = a => f(((a * 180 / PI) % 360 + 360) % 360, 1) + '°';
    let r2 = '';
    if (typAkt() === 'hreben') {
      const p = model.dily[1].poloha(fi);
      r2 = `posuv hřebene <b>${f(p.x, 2)} mm</b>`;
    } else if (typAkt() === 'maltez') {
      const p = model.dily[1].poloha(fi);
      r2 = `kříž <b>${deg(p.rot - PI)}</b>`;
    } else if (typAkt() === 'rohatka') {
      const p = model.dily[1].poloha(fi);
      r2 = `zdvih západky <b>${f(-(p.rot - model.dily[1].poloha(0).rot) * 180 / PI, 1)}°</b>`;
    } else if (K.i) {
      r2 = `${K.vystup} <b>${f(otackyVstupu / K.i, 2)} ot/min</b> · i = ${f(K.i, 3)}`;
    }
    el('hud').innerHTML = `${K.vstup} <b>${otackyVstupu} ot/min</b> · φ = ${deg(fi)}<br>${r2}` + (K.smer ? ` · smysl ${K.smer}` : '');
  }

  // posun a zoom myší / prsty
  (function () {
    const prsty = new Map();
    let minVzd = 0;
    platno.addEventListener('pointerdown', e => {
      try { platno.setPointerCapture(e.pointerId); } catch { /* syntetická událost */ }
      prsty.set(e.pointerId, { x: e.clientX, y: e.clientY });
      minVzd = 0;
      platno.style.cursor = 'grabbing';
    });
    platno.addEventListener('pointermove', e => {
      const p = prsty.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (prsty.size >= 2) {
        const [a, b] = [...prsty.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (minVzd) zoom2d(d / minVzd, (a.x + b.x) / 2, (a.y + b.y) / 2);
        minVzd = d;
        return;
      }
      pohled2d.rucne = true;
      pohled2d.cx -= dx / pohled2d.meritko;
      pohled2d.cy += dy / pohled2d.meritko;
      prekresli();
    });
    const konec = e => { prsty.delete(e.pointerId); minVzd = 0; platno.style.cursor = ''; };
    platno.addEventListener('pointerup', konec);
    platno.addEventListener('pointercancel', konec);
    platno.addEventListener('wheel', e => { e.preventDefault(); zoom2d(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); }, { passive: false });
    platno.addEventListener('dblclick', prizpusob2d);
  })();

  function zoom2d(nasobek, clientX, clientY) {
    const r = platno.getBoundingClientRect();
    const mx = clientX - r.left - W / 2, my = clientY - r.top - H / 2;
    const wx = pohled2d.cx + mx / pohled2d.meritko, wy = pohled2d.cy - my / pohled2d.meritko;
    pohled2d.rucne = true;
    pohled2d.meritko = Math.max(0.05, Math.min(800, pohled2d.meritko * nasobek));
    pohled2d.cx = wx - mx / pohled2d.meritko;
    pohled2d.cy = wy + my / pohled2d.meritko;
    prekresli();
  }

  /* ==================================================================
     7. 3D MODEL — vytlačení obrysů, šroubovice (síť OZK.sitTelesa, náhled OZK_NAHLED nad G3D.scena)
     ================================================================== */
  const sitTelesa = OZK.sitTelesa;
  const nahled = OZK_NAHLED.vytvor(el('platno'));
  const zobr = { tisk: false };
  let spinave3d = true, umisteno3d = false, tiskove = null;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  // díly sestavy (každé těleso jako síť), polohu dává poloz() v kresli3d
  function dilySestavy() {
    return model.dily.map(d => ({ nazev: d.nazev, barva: d.barva, telesa: d.telesa.map(t => Object.assign(sitTelesa(t, false), { barva: t.kolik ? tmavsi(d.barva) : d.barva, pruhledne: !!t.pruhledne })) }));
  }
  // tisková poloha = všechny díly vedle sebe na podložce (jako export „Vedle sebe na podložku“)
  function dilyTiskove() {
    return siteExportu(false, { vyber: 'vse', rozl: 'podlozka', M: model }).map(({ d, site }) => ({ nazev: d.nazev, barva: d.barva, d,
      telesa: site.map((m, i) => Object.assign(m, { barva: d.telesa[i].kolik ? tmavsi(d.barva) : d.barva, pruhledne: !!d.telesa[i].pruhledne })) }));
  }

  function postav3d() {
    if (!model) return;
    spinave3d = false;
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    tiskove = dilyTiskove();
    if (zobr.tisk) nahled.nastav(tiskove, { tisk: true, novyPohled: !umisteno3d });
    else { nahled.nastav(dilySestavy(), { novyPohled: false }); kresli3d(); if (!umisteno3d) nahled.pohled('iso'); }
    umisteno3d = true;
    vypisTisk(tiskove);
    el('legPrevisy').hidden = !(zobr.tisk && nahled.stav.previsy);
  }
  function prizpusob3d() { nahled.pohled('iso'); }
  function kresli3d() {
    if (!model) return;
    if (spinave3d) { postav3d(); return; }
    if (zobr.tisk) return;
    const fi = uhel();
    nahled.poloz(model.dily.map(d => d.poloha(fi)));
  }

  // těsnost sítě: každá orientovaná hrana má právě jednu opačnou
  function tesna(pos, idx) {
    const h = new Map(), k = (a, b) => a * 4294967296 + b;
    for (let t = 0; t < idx.length; t += 3) for (let j = 0; j < 3; j++) { const a = idx[t + j], b = idx[t + (j + 1) % 3]; h.set(k(a, b), (h.get(k(a, b)) || 0) + 1); }
    for (const [x, n] of h) { const a = Math.floor(x / 4294967296), b = x % 4294967296; if (n !== 1 || h.get(k(b, a)) !== 1) return false; }
    return true;
  }
  /** Záložka Tisk: rozměry, objem, hmotnost, filament, doba tisku po dílech (+ těsnost sítí, když je 3D postavené). */
  function vypisTisk(td) {
    if (!model) { el('vTisk').innerHTML = ''; el('vSit').innerHTML = ''; return; }
    const S = stav(), mat = MOD.MATERIALY[S.material], box = G3D.dlazdice;
    const V = model.dily.reduce((s, d) => s + d.objem, 0), o = G3D.odhadTisku(V, mat.rho, { dilu: model.dily.length });
    let h = box('Celkem', `${model.dily.length} ${model.dily.length === 1 ? 'díl' : model.dily.length < 5 ? 'díly' : 'dílů'}`, mat.nazev);
    h += box('Objem', `${f(V / 1000, 2)} cm³`, 'plné díly');
    h += box('Hmotnost', `${f(o.g, o.g < 10 ? 1 : 0)} g`, `při 30 % výplni zhruba ${f(o.g * 0.55, 0)} g`);
    h += box('Filament', `${f(o.metru, 2)} m`, 'průměr 1,75 mm, plné díly');
    h += box('Doba tisku', `≈ ${o.minut < 60 ? o.minut + ' min' : f(o.minut / 60, 1) + ' h'}`, 'hrubý odhad, vrstva 0,2 mm');
    for (const d of model.dily) {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const t of d.telesa) {
        z0 = Math.min(z0, t.z0); z1 = Math.max(z1, t.z0 + t.h);
        for (const [x, y] of t.obrys) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      }
      h += box(d.nazev, `${f(x1 - x0, 1)} × ${f(y1 - y0, 1)} × ${f(z1 - z0, 1)} mm`, `${f(d.objem / 1000, 2)} cm³ · ${f(d.hmotnost, 1)} g`);
    }
    el('vTisk').innerHTML = h;
    el('vSit').innerHTML = td ? td.map(x => {
      const ok = x.telesa.every(t => tesna(t.pos, t.idx)), n = x.telesa.reduce((s, t) => s + t.idx.length / 3, 0);
      return box('Síť – ' + x.nazev, ok ? '✔ těsná' : '✖ netěsná', `${n.toLocaleString('cs-CZ')} trojúhelníků, ${x.telesa.length} ${x.telesa.length === 1 ? 'těleso' : 'tělesa'}`, ok ? 'ok-t' : 'chyba-t');
    }).join('') : '';
  }

  function prepniRezim(r) {
    rezim = r;
    el('btn2d').setAttribute('aria-pressed', String(r === '2d'));
    el('btn3d').setAttribute('aria-pressed', String(r === '3d'));
    platno.hidden = r === '3d';
    el('platno').hidden = r !== '3d';
    el('canvas-container').classList.toggle('je3d', r === '3d');
    el('btnDetail').classList.toggle('skryt', r === '3d');
    el('napovedaNahled').textContent = r === '3d'
      ? 'tažení = otáčení · pravé tl./Shift = posun · kolečko = přiblížení · dvojklik = vše'
      : 'tažení = posun · kolečko = přiblížení · dvojklik = vše';
    el('legRez').hidden = !(r === '3d' && nahled.stav.rez);
    el('legPrevisy').hidden = !(r === '3d' && zobr.tisk && nahled.stav.previsy);
    aktualizujLegendu();
    if (r === '3d') postav3d();
    else velikost2d();
    prekresli();
  }
  const do3d = () => { if (rezim !== '3d') el('t3d').click(); };

  /* ==================================================================
     8. ANIMACE
     ================================================================== */
  let posledni = 0;
  function smycka(ts) {
    // pojistka: změna velikosti náhledu, kterou ResizeObserver při načítání nestihl
    const box = el('canvas-container');
    if (rezim === '2d' && (box.clientWidth !== W || box.clientHeight !== H)) velikost2d();
    if (hraje && model) {
      const dt = posledni ? Math.min(0.1, (ts - posledni) / 1000) : 0;
      cas += dt * otackyVstupu * TAU / 60;
      kresli();
    }
    posledni = ts;
    requestAnimationFrame(smycka);
  }
  function prepniHrani(h) {
    hraje = h;
    el('btnPlay').textContent = h ? '⏸ Pauza' : '▶ Přehrát';
    el('btnPlay').setAttribute('aria-pressed', String(h));
    posledni = 0;
  }

  /* ==================================================================
     9. EXPORT
     ================================================================== */
  function jmeno(zaklad, pripona) {
    const S = stav();
    const t = { celni: 'soukoli', vnitrni: 'vnitrni', hreben: 'hreben', planeta: 'planetova', cevove: 'cevove', hodinove: 'hodinove', maltez: 'maltez', rohatka: 'rohatka' }[typAkt()];
    const m = S.m ? '_m' + String(S.m).replace('.', ',') : '';
    if (app.p.nazev) return G3D.jmenoSouboru(app.p.nazev, t, `_${zaklad}.${pripona}`);
    return `${zaklad}_${t}${m}.${pripona}`.replace(/[^\w.,-]+/g, '_');
  }
  const stahni = (blob, nazev) => app.stahni(blob, nazev);

  function naplnExportDilu() {
    const s = el('expDil'), puv = s.value;
    s.innerHTML = '<option value="vse">Všechny díly</option>' + model.dily.map(d => `<option value="${d.id}">${esc(d.nazev)}</option>`).join('');
    if ([...s.options].some(o => o.value === puv)) s.value = puv;
    // každý díl zvlášť (STL, na podložku) – v nabídce Soubor
    const ex = el('exportDilu'); ex.innerHTML = '';
    if (model.dily.length < 2) return;
    for (const d of model.dily) {
      const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
      b.innerHTML = `⬇ STL – ${esc(d.nazev)}<span class="pozn">jen tento díl</span>`;
      b.addEventListener('click', () => stahni(stlBinarni(siteExportu(el('expJemnost').value === 'jemna', { vyber: d.id, rozl: 'podlozka' })), jmeno('ozubeni_' + d.id, 'stl')));
      ex.appendChild(b);
    }
  }

  // Díly připravené k exportu: tělesa + umístění (x, y, rot, dz).
  // v = volitelně {vyber, rozl, M} místo voleb v boxu Export (díly zvlášť, tisková poloha náhledu)
  function dilyProExport(v = {}) {
    const S = stav(); S.alfa = +S.alfa;
    const jem = el('expJemnost').value;
    const M = v.M || (jem === 'jemna' ? MOD.sestav(S, 'jemna') : model);
    const vyber = v.vyber || el('expDil').value;
    const rozl = v.rozl || el('expRozlozeni').value;
    let dily = M.dily.filter(d => vyber === 'vse' || d.id === vyber);
    const fi = uhel();
    const out = [];
    if (rozl === 'sestava' && vyber === 'vse') {
      for (const d of dily) { const p = d.poloha(fi); out.push({ d, x: p.x, y: p.y, rot: p.rot, dz: 0 }); }
    } else {
      // rozložení na podložku: řady do šířky 220 mm, každý díl stojí na z = 0
      let x = 0, y = 0, radek = 0;
      for (const d of dily) {
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity;
        for (const t of d.telesa) {
          z0 = Math.min(z0, t.z0);
          for (const [px, py] of t.obrys) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
        }
        const w = x1 - x0, h = y1 - y0;
        if (x > 0 && x + w > 220) { x = 0; y += radek + 6; radek = 0; }
        out.push({ d, x: x - x0, y: y - y0, rot: 0, dz: -z0 });
        x += w + 6; radek = Math.max(radek, h);
      }
    }
    return out;
  }

  function siteExportu(jemna, v) {
    return dilyProExport(v).map(({ d, x, y, rot, dz }) => {
      const c = Math.cos(rot), s = Math.sin(rot);
      const site = d.telesa.map(t => {
        const m = sitTelesa(t, jemna);
        const p = m.pos;
        for (let i = 0; i < p.length; i += 3) {
          const X = p[i], Y = p[i + 1];
          p[i] = X * c - Y * s + x; p[i + 1] = X * s + Y * c + y; p[i + 2] += dz;
        }
        return m;
      });
      return { d, site };
    });
  }

  function stlBinarni(dily) {
    let n = 0;
    for (const { site } of dily) for (const m of site) n += m.idx.length / 3;
    const buf = new ArrayBuffer(84 + n * 50), dv = new DataView(buf);
    const hl = 'Navrhar ozubenych soukoli - mm, Z nahoru';
    for (let i = 0; i < hl.length; i++) dv.setUint8(i, hl.charCodeAt(i));
    dv.setUint32(80, n, true);
    let o = 84;
    for (const { site } of dily) for (const { pos, idx } of site) {
      for (let t = 0; t < idx.length; t += 3) {
        const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
        const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
        const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const L = Math.hypot(nx, ny, nz) || 1;
        dv.setFloat32(o, nx / L, true); dv.setFloat32(o + 4, ny / L, true); dv.setFloat32(o + 8, nz / L, true); o += 12;
        for (const v of [a, b, c]) { dv.setFloat32(o, pos[v], true); dv.setFloat32(o + 4, pos[v + 1], true); dv.setFloat32(o + 8, pos[v + 2], true); o += 12; }
        dv.setUint16(o, 0, true); o += 2;
      }
    }
    return new Blob([buf], { type: 'model/stl' });
  }

  function objText(dily) {
    const r = ['# Navrhar ozubenych soukoli (mm, Z nahoru)'];
    let off = 1;
    for (const { d, site } of dily) {
      r.push('o ' + d.nazev.replace(/\s+/g, '_'));
      for (const { pos, idx } of site) {
        for (let i = 0; i < pos.length; i += 3) r.push(`v ${pos[i].toFixed(4)} ${pos[i + 1].toFixed(4)} ${pos[i + 2].toFixed(4)}`);
        for (let t = 0; t < idx.length; t += 3) r.push(`f ${idx[t] + off} ${idx[t + 1] + off} ${idx[t + 2] + off}`);
        off += pos.length / 3;
      }
    }
    return new Blob([r.join('\n') + '\n'], { type: 'text/plain' });
  }

  // ZIP bez komprese (metoda „uloženo“) — stačí pro 3MF a nepotřebuje knihovnu.
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[i] = c >>> 0; }
    return t;
  })();
  function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(polozky, typMime) {
    const enc = new TextEncoder(), casti = [], centr = [];
    let off = 0;
    for (const p of polozky) {
      const data = typeof p.data === 'string' ? enc.encode(p.data) : p.data, jm = enc.encode(p.name), crc = crc32(data);
      const lok = new Uint8Array(30 + jm.length), dv = new DataView(lok.buffer);
      dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(12, 0x21, true);
      dv.setUint32(14, crc, true); dv.setUint32(18, data.length, true); dv.setUint32(22, data.length, true); dv.setUint16(26, jm.length, true);
      lok.set(jm, 30); casti.push(lok, data);
      const cen = new Uint8Array(46 + jm.length), cv = new DataView(cen.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(14, 0x21, true);
      cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, jm.length, true);
      cv.setUint32(42, off, true); cen.set(jm, 46); centr.push(cen);
      off += lok.length + data.length;
    }
    const vel = centr.reduce((s, c) => s + c.length, 0), kon = new Uint8Array(22), kv = new DataView(kon.buffer);
    kv.setUint32(0, 0x06054b50, true); kv.setUint16(8, polozky.length, true); kv.setUint16(10, polozky.length, true);
    kv.setUint32(12, vel, true); kv.setUint32(16, off, true);
    return new Blob([...casti, ...centr, kon], { type: typMime });
  }

  function soubor3mf(dily) {
    const xe = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const barvyMat = dily.map(({ d }) => `<base name="${xe(d.nazev)}" displaycolor="${d.barva.toUpperCase()}FF"/>`).join('');
    const obj = [], polozky = [];
    dily.forEach(({ d, site }, i) => {
      const id = i + 2;
      const v = [], t = [];
      let off = 0;
      for (const { pos, idx } of site) {
        for (let k = 0; k < pos.length; k += 3) v.push(`<vertex x="${pos[k].toFixed(4)}" y="${pos[k + 1].toFixed(4)}" z="${pos[k + 2].toFixed(4)}"/>`);
        for (let k = 0; k < idx.length; k += 3) t.push(`<triangle v1="${idx[k] + off}" v2="${idx[k + 1] + off}" v3="${idx[k + 2] + off}"/>`);
        off += pos.length / 3;
      }
      obj.push(`<object id="${id}" type="model" name="${xe(d.nazev)}" pid="1" pindex="${i}"><mesh><vertices>${v.join('')}</vertices><triangles>${t.join('')}</triangles></mesh></object>`);
      polozky.push(`<item objectid="${id}"/>`);
    });
    const modelXml = `<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="cs-CZ" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">` +
      `<metadata name="Title">${xe(document.title)}</metadata><metadata name="Application">Navrhar ozubenych soukoli</metadata>` +
      `<resources><basematerials id="1">${barvyMat}</basematerials>${obj.join('')}</resources><build>${polozky.join('')}</build></model>`;
    return zip([
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>' },
      { name: '3D/3dmodel.model', data: modelXml },
    ], 'model/3mf');
  }

  // 2D obrysy (spodní řez těles) v souřadnicích sestavy nebo rozložení.
  function obrysy2d() {
    return dilyProExport().map(({ d, x, y, rot }) => {
      const c = Math.cos(rot), s = Math.sin(rot);
      const tr = sm => sm.map(([px, py]) => [px * c - py * s + x, px * s + py * c + y]);
      return { d, telesa: d.telesa.map(t => ({ t, smycky: [t.obrys, ...(t.otvory || [])].map(tr) })) };
    });
  }

  function svgText(dily) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const { telesa } of dily) for (const { smycky } of telesa) for (const [x, y] of smycky[0]) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    const ok = 5, w = x1 - x0 + 2 * ok, h = y1 - y0 + 2 * ok;
    const P = ([x, y]) => `${(x - x0 + ok).toFixed(4)},${(y1 - y + ok).toFixed(4)}`;
    const g = dily.map(({ d, telesa }) => `<g id="${d.id}" inkscape:label="${esc(d.nazev)}">` + telesa.map(({ t, smycky }) =>
      `<path d="${smycky.map(sm => 'M' + sm.map(P).join('L') + 'Z').join(' ')}" fill="${t.pruhledne ? 'none' : d.barva}" fill-opacity="0.25" fill-rule="evenodd" stroke="${d.barva}" stroke-width="0.1"/>`).join('') + '</g>').join('\n');
    const txt = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${w.toFixed(3)}mm" height="${h.toFixed(3)}mm" viewBox="0 0 ${w.toFixed(4)} ${h.toFixed(4)}">\n<title>${esc(document.title)}</title>\n${g}\n</svg>\n`;
    return new Blob([txt], { type: 'image/svg+xml' });
  }

  function dxfText(dily) {
    const r = [];
    const p = (k, v) => r.push(String(k), String(v));
    const vrstvy = dily.map(({ d }) => d.nazev.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_').toUpperCase());
    p(0, 'SECTION'); p(2, 'HEADER'); p(9, '$ACADVER'); p(1, 'AC1009'); p(9, '$INSUNITS'); p(70, 4); p(0, 'ENDSEC');
    p(0, 'SECTION'); p(2, 'TABLES');
    p(0, 'TABLE'); p(2, 'LTYPE'); p(70, 1); p(0, 'LTYPE'); p(2, 'CONTINUOUS'); p(70, 0); p(3, 'Solid line'); p(72, 65); p(73, 0); p(40, 0); p(0, 'ENDTAB');
    p(0, 'TABLE'); p(2, 'LAYER'); p(70, vrstvy.length);
    vrstvy.forEach((v, i) => { p(0, 'LAYER'); p(2, v); p(70, 0); p(62, (i % 6) + 1); p(6, 'CONTINUOUS'); });
    p(0, 'ENDTAB'); p(0, 'ENDSEC');
    p(0, 'SECTION'); p(2, 'ENTITIES');
    dily.forEach(({ telesa }, i) => {
      for (const { smycky } of telesa) for (const sm of smycky) {
        p(0, 'POLYLINE'); p(8, vrstvy[i]); p(66, 1); p(70, 1); p(10, 0); p(20, 0); p(30, 0);
        for (const [x, y] of sm) { p(0, 'VERTEX'); p(8, vrstvy[i]); p(10, x.toFixed(5)); p(20, y.toFixed(5)); p(30, 0); }
        p(0, 'SEQEND'); p(8, vrstvy[i]);
      }
    });
    p(0, 'ENDSEC'); p(0, 'EOF');
    return new Blob([r.join('\r\n') + '\r\n'], { type: 'application/dxf' });
  }

  function exportuj(druh) {
    if (!model) { Dialog.chyba('Nejdřív opravte parametry — soukolí zatím nejde sestavit.'); return; }
    try {
      const jemna = el('expJemnost').value === 'jemna';
      if (druh === 'stl') stahni(stlBinarni(siteExportu(jemna)), jmeno('ozubeni', 'stl'));
      else if (druh === 'obj') stahni(objText(siteExportu(jemna)), jmeno('ozubeni', 'obj'));
      else if (druh === '3mf') stahni(soubor3mf(siteExportu(jemna)), jmeno('ozubeni', '3mf'));
      else if (druh === 'svg') stahni(svgText(obrysy2d()), jmeno('obrysy', 'svg'));
      else if (druh === 'dxf') stahni(dxfText(obrysy2d()), jmeno('obrysy', 'dxf'));
      Dialog.info(`${druh.toUpperCase()} uloženo.`);
    } catch (e) {
      Dialog.chyba('Export se nepovedl: ' + (e.message || e));
    }
  }


  /* ==================================================================
     10. PROTOKOL K TISKU
     ================================================================== */
  function tiskProtokolu() {
    if (!model) return;
    const obr = rezim === '3d' ? nahled.png() : (kresli(), platno.toDataURL('image/png'));
    const S = stav();
    const nazevTypu = TYPY.find(t => t.id === typAkt()).nazev;
    let h = `<h1>${nazevTypu}</h1><p class="meta">Návrhář ozubených soukolí · ${new Date().toLocaleString('cs-CZ')}</p><img src="${obr}" alt="">`;
    h += '<h2>Souhrn</h2><table>' + model.souhrn.map(([l, v, p]) => `<tr><td>${l}</td><td><b>${v}</b></td><td>${p || ''}</td></tr>`).join('') + '</table>';
    if (model.varovani.length) h += '<h2>Upozornění</h2><ul>' + model.varovani.map(v => `<li>${v.t}</li>`).join('') + '</ul>';
    h += '<h2>Výpočet</h2>' + el('vypocet').innerHTML;
    if (model.tabulky.length) h += '<h2>Tabulka ozubení</h2>' + el('tabulkaKol').innerHTML;
    h += '<h2>Kusovník</h2>' + el('kusovnik').innerHTML;
    h += `<p class="meta">Materiál: ${esc(MOD.MATERIALY[S.material].nazev)} · moment ${f(S.M1, 2)} N·m · ${f(S.n1, 0)} min⁻¹</p>`;
    el('protokol').innerHTML = h;
    setTimeout(() => window.print(), 60);
  }

  /* ==================================================================
     10b. RUČNÍ VÝROBA — dílenský list, dělicí přístroj, šablona 1 : 1
     ================================================================== */
  const KOTOUCE = {
    bs: [15, 16, 17, 18, 19, 20, 21, 23, 27, 29, 31, 33, 37, 39, 41, 43, 47, 49],
    cin: [24, 25, 28, 30, 34, 37, 38, 39, 41, 42, 43, 46, 47, 49, 51, 53, 54, 57, 58, 59, 62, 66],
  };
  const VYMENNA = [24, 24, 28, 32, 40, 44, 48, 56, 64, 72, 86, 100];   // výměnná kola B&S
  // sada 8 modulových kotoučových fréz: číslo frézy a rozsah zubů
  const FREZY = [[8, 12, 13], [7, 14, 16], [6, 17, 20], [5, 21, 25], [4, 26, 34], [3, 35, 54], [2, 55, 134], [1, 135, Infinity]];

  function kruhyDer() {
    const t = el('ruKotouce').value;
    if (t !== 'vlastni') return KOTOUCE[t];
    return [...new Set(el('ruKruhy').value.split(/[^\d]+/).map(Number).filter(n => n >= 5 && n <= 400))].sort((a, b) => a - b);
  }

  // Jednoduché dělení: N/z otáček kliky = celé otáčky + p/q; hledá kruh děr dělitelný q.
  function deleni(N, z, kruhy) {
    const cele = Math.floor(N / z), zb = N - cele * z;
    if (!zb) return { cele, p: 0, q: 1, moznosti: [] };
    const g = MOD.gcd(zb, z), p = zb / g, q = z / g;
    return { cele, p, q, moznosti: kruhy.filter(c => c % q === 0).map(c => ({ kruh: c, dery: p * c / q })) };
  }

  // Výměnná kola s poměrem r (hnací / hnaná); nejdřív jednoduchý, pak složený převod.
  function vymennaKola(r, jenPresne) {
    const K = VYMENNA, n = K.length;
    let nej = null;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const e = Math.abs(K[i] / K[j] - r) / r;
      if (e < 1e-9) return { kola: [K[i], K[j]], chyba: 0 };
      if (!nej || e < nej.chyba) nej = { kola: [K[i], K[j]], chyba: e };
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) for (let l = 0; l < n; l++) {
      if (new Set([i, j, k, l]).size < 4) continue;
      const e = Math.abs(K[i] * K[k] / (K[j] * K[l]) - r) / r;
      if (e < 1e-9) return { kola: [K[i], K[j], K[k], K[l]], chyba: 0 };
      if (e < nej.chyba) nej = { kola: [K[i], K[j], K[k], K[l]], chyba: e };
    }
    return jenPresne ? null : nej;
  }

  // Diferenciální dělení: pomocný počet A s jednoduchým dělením + výměnná kola N·(A − z)/A.
  function diferencialni(N, z, kruhy) {
    for (let dA = 1; dA <= 12; dA++) for (const A of [z + dA, z - dA]) {
      if (A < 2) continue;
      const d = deleni(N, A, kruhy);
      if (d.p && !d.moznosti.length) continue;
      const r = N * Math.abs(A - z) / A;
      const kola = vymennaKola(r, true);
      if (kola) return { A, d, r, kola };
    }
    return null;
  }

  const textKol = k => k.length === 2 ? `hnací ${k[0]} / hnané ${k[1]}` : `${k[0]} / ${k[1]} · ${k[2]} / ${k[3]} (hnací / hnané)`;

  function textDeleni(N, z, kruhy) {
    const d = deleni(N, z, kruhy);
    const zaklad = `${N}/${z} = ${d.cele} ${d.p ? `+ ${d.p}/${d.q}` : ''} otáčky kliky na zub`;
    if (!d.p) return { radky: [['Dělení', `<b>${d.cele} celých otáček</b> kliky na každý zub`, '']], zaklad };
    if (d.moznosti.length) {
      const m = d.moznosti[0];
      const dalsi = d.moznosti.slice(1, 4).map(o => `${o.dery} děr na kruhu ${o.kruh}`).join(' · ');
      return {
        radky: [
          ['Dělení', `<b>${d.cele} ot. + ${m.dery} děr</b> na kruhu <b>${m.kruh}</b>`, ''],
          ['Ramínka sektoru', `rozevřít přes ${m.dery + 1} děr (posun o ${m.dery})`, ''],
          ...(dalsi ? [['Jiné kruhy', dalsi, '']] : []),
        ], zaklad,
      };
    }
    const df = diferencialni(N, z, kruhy);
    if (!df) return { radky: [['Dělení', 'jednoduše ani diferenciálně nevychází — zvolte jiné kotouče', '']], zaklad };
    const m = df.d.moznosti[0];
    return {
      radky: [
        ['Dělení', `jednoduše nejde → <b>diferenciální</b> podle A = ${df.A}`, ''],
        ['Klika na zub', df.d.p ? `${df.d.cele} ot. + ${m.dery} děr na kruhu ${m.kruh}` : `${df.d.cele} ot.`, ''],
        ['Výměnná kola', `${textKol(df.kola.kola)} (poměr ${f(df.r, 4)})`, ''],
        ['Smysl kotouče', df.A > z ? 'stejný jako klika' : 'opačný než klika', 'počtem vložených kol'],
      ], zaklad,
    };
  }

  function textKliky(dt) {
    if (!dt) return 'jeden díl';
    const r = dt.radky.find(x => x[0] === 'Klika na zub') || dt.radky[0];
    return r[1].replace(/<[^>]+>/g, '') + (dt.radky.some(x => x[0] === 'Výměnná kola') ? ' (diferenciální dělení, viz tabulka)' : '');
  }

  function frezaCislo(zv) {
    const r = FREZY.find(([, a, b]) => zv >= a - 0.5 && zv <= b + 0.5);
    return r ? r[0] : null;
  }

  // Tětivová tloušťka a výška pro posuvku na zuby (náhradní kolo u šikmých zubů).
  function tetiva(v) {
    const cb = Math.cos(v.beta || 0);
    const zv = v.z / cb ** 3, dn = zv * v.mn;
    const s = v.mn * (PI / 2 + 2 * v.x * Math.tan(v.an)) - (v.jt || 0) * cb / 2;
    const psi = s / dn;
    const ha = (v.da - v.d) / 2;
    return { s: dn * Math.sin(psi), h: ha + dn / 2 * (1 - Math.cos(psi)), zv };
  }

  function dilyRucni() {
    if (!model) return [];
    const videne = new Set();
    return model.dily.filter(d => {
      if (!d.skupina) return true;
      if (videne.has(d.skupina)) return false;
      videne.add(d.skupina); return true;
    });
  }

  function naplnRucniDily() {
    const s = el('ruDil'), puv = s.value;
    s.innerHTML = dilyRucni().map(d => `<option value="${d.id}">${esc(d.skupina ? d.nazev.replace(/\s*\d+$/, '') : d.nazev)}</option>`).join('');
    if ([...s.options].some(o => o.value === puv)) s.value = puv;
  }

  function vybranyDil() { return model && model.dily.find(d => d.id === el('ruDil').value) || (model && model.dily[0]); }

  // Údaje a postup pro zvolený díl a způsob výroby.
  function rucniData() {
    const d = vybranyDil();
    if (!d) return null;
    const v = d.vyroba || { druh: 'deska' };
    const metoda = el('ruMetoda').value, N = +el('ruPrevod').value, kruhy = kruhyDer();
    const S = stav();
    const mat = MOD.MATERIALY[S.material].nazev;
    const u = [], k = [];                    // údaje [popis, hodnota, jednotka], kroky
    const pocet = d.skupina ? model.dily.filter(x => x.skupina === d.skupina).length : 1;
    const jmeno = d.skupina ? d.nazev.replace(/\s*\d+$/, '') : d.nazev;
    const ot = v.otvor > 0 ? `Ø${f(v.otvor, 2)} mm` + ({ pero: ' s drážkou pro pero', D: ' se zploštěním (D)', sestihran: ' — šestihran na klíč' }[S.otvor] || '') : 'bez otvoru';
    const sikme = v.beta > 1e-9;
    let deleniT = null;
    if (v.z && metoda === 'freza') deleniT = textDeleni(N, v.z, kruhy);

    u.push(['Díl', `${esc(jmeno)}${pocet > 1 ? ` (${pocet} ks)` : ''}`, '']);
    u.push(['Materiál', esc(mat), '']);
    if (v.druh === 'evol' || v.druh === 'venec') {
      u.push(['Počet zubů z', v.z, '']);
      u.push(['Modul m' + (sikme ? '<sub>n</sub>' : ''), f(v.mn, 3), 'mm']);
      u.push(['Úhel záběru α', f(O.deg(v.an), 1), '°']);
      if (sikme) u.push(['Úhel sklonu β', f(O.deg(v.beta), 2) + (v.zuby === 'sipove' ? ' (šípové)' : ''), '°']);
      if (v.druh === 'evol') u.push(['Korekce x', f(v.x, 3), '']);
    }
    if (v.druh === 'evol') {
      const t = tetiva(v);
      u.push(['Průměr polotovaru d<sub>a</sub>', f(v.da, 3), 'mm']);
      u.push(['Roztečný průměr d', f(v.d, 3), 'mm']);
      u.push(['Patní průměr d<sub>f</sub>', f(v.df, 3), 'mm']);
      u.push(['Hloubka zubu h', f((v.da - v.df) / 2, 3), 'mm']);
      u.push(['Šířka b', f(v.b, 2), 'mm']);
      u.push(['Posuvka na zuby: tloušťka s̄', `<b>${f(t.s, 3)}</b> na výšce h̄ = ${f(t.h, 3)}`, 'mm']);
      if (isFinite(v.Wk)) u.push(['Rozměr přes ' + v.kz + ' zuby W<sub>k</sub>', f(v.Wk - (v.jt || 0) * Math.cos(v.an) / 2, 3), 'mm']);
      u.push(['Otvor', ot, '']);
      if (metoda === 'freza') {
        const c = frezaCislo(t.zv);
        u.push(['Modulová fréza', c ? `<b>č. ${c}</b> (sada 8 ks), m ${f(v.mn, 2)}, α ${f(O.deg(v.an), 1)}°` : 'pod 12 zubů: tvarová fréza podle šablony', sikme ? `z<sub>v</sub> = ${f(t.zv, 1)}` : '']);
        u.push(['Hloubka řezu', f((v.da - v.df) / 2, 3) + ' (2–3 třísky)', 'mm']);
        if (sikme) {
          const L = PI * v.d / Math.tan(v.beta), r = +el('ruStroj').value / L;
          const kola = r > 0 ? vymennaKola(r, false) : null;
          u.push(['Stoupání šroubovice', f(L, 2), 'mm']);
          u.push(['Natočení stolu', f(O.deg(v.beta), 2) + '°', 'proti smyslu stoupání']);
          if (kola) u.push(['Kola na stoupání', `${textKol(kola.kola)}`, kola.chyba ? `odchylka ${f(kola.chyba * 100, 3)} %` : 'přesně']);
        }
      }
      if (metoda === 'kruzidlo') {
        u.push(['Úhel dělení', f(360 / v.z, 4), '°']);
        u.push(['Tětiva rozteče na d', f(v.d * Math.sin(PI / v.z), 3), 'mm']);
        u.push(['Tětiva rozteče na d<sub>a</sub>', f(v.da * Math.sin(PI / v.z), 3), 'mm']);
      }
    } else if (v.druh === 'venec') {
      u.push(['Vnitřní průměr (hlavy zubů)', f(v.da, 3), 'mm']);
      u.push(['Roztečný průměr d', f(v.d, 3), 'mm']);
      u.push(['Průměr pat zubů', f(v.df, 3), 'mm']);
      u.push(['Vnější průměr věnce', f(v.dVnejsi, 2), 'mm']);
      u.push(['Hloubka zubu', f((v.df - v.da) / 2, 3), 'mm']);
    } else if (v.druh === 'hreben') {
      const h = (2 * v.ha + v.c) * v.mn;
      const p = v.roz;
      u.push(['Modul m<sub>n</sub>', f(v.mn, 3), 'mm']);
      u.push(['Rozteč (posuv na zub)', `<b>${f(p, 4)}</b>`, 'mm']);
      u.push(['Hloubka zubu h', f(h, 3), 'mm']);
      u.push(['Tloušťka zubu na roztečné přímce', f(p / 2 - (v.jt || 0) / 2, 3), 'mm']);
      u.push(['Počet zubů / délka', `${v.n} / ${f(v.delka, 2)}`, 'mm']);
      if (sikme) u.push(['Sklon zubů β', f(O.deg(v.beta), 2), '°']);
      if (metoda === 'freza') {
        u.push(['Modulová fréza', `<b>č. 1</b> (hřeben = nekonečně zubů), m ${f(v.mn, 2)}`, '']);
        const polohy = Array.from({ length: Math.min(v.n, 12) }, (_, i) => f(i * p, 3)).join(' · ');
        u.push(['Polohy zubů od prvního', polohy + (v.n > 12 ? ' …' : ''), 'mm']);
      }
    } else if (v.druh === 'cevnik') {
      u.push(['Počet cévek', v.z, '']);
      u.push(['Kružnice cévek', f(v.d, 3), 'mm']);
      u.push(['Průměr cévky', f(v.dc, 2), 'mm']);
      u.push(['Úhel mezi cévkami', f(360 / v.z, 4), '°']);
      u.push(['Tětiva mezi středy cévek', `<b>${f(v.d * Math.sin(PI / v.z), 3)}</b>`, 'mm']);
      u.push(['Čela: průměr × tloušťka', `${f(v.dCelo, 1)} × ${f(v.tf, 1)} (2 ks)`, 'mm']);
      u.push(['Délka cévky', f(v.b + 2 * v.tf, 1), 'mm']);
      u.push(['Otvor', ot, '']);
    } else if (v.druh === 'cevkolo' || v.druh === 'cykloida' || v.druh === 'rohatka' || v.druh === 'maltez') {
      u.push([v.druh === 'maltez' ? 'Počet drážek' : v.pastorek ? 'Počet listů' : 'Počet zubů', v.z, '']);
      u.push(['Průměr polotovaru', f(v.da, 3), 'mm']);
      if (v.d) u.push(['Roztečný průměr', f(v.d, 3), 'mm']);
      if (v.df) u.push(['Patní průměr', f(v.df, 3), 'mm']);
      if (v.druh === 'maltez') { u.push(['Šířka drážky', f(v.sirka, 2), 'mm']); u.push(['Dno drážky od středu', f(v.s0, 3), 'mm']); }
      if (v.list) u.push(['Tloušťka listu', f(v.list, 3), 'mm']);
      u.push(['Úhel dělení', f(360 / v.z, 4), '°']);
      u.push(['Tloušťka', f(v.b, 2), 'mm']);
      u.push(['Otvor', ot, '']);
    } else if (v.druh === 'klika') {
      u.push(['Poloměr kliky (střed čepu)', f(v.Rd, 3), 'mm']);
      u.push(['Průměr čepu', f(v.dc, 2), 'mm']);
      u.push(['Uzavírací deska R', f(v.Rl, 3), 'mm']);
      u.push(['Otvor', ot, '']);
    } else if (v.druh === 'zapadka') {
      u.push(['Délka (čep → hrot)', f(v.L, 1), 'mm']);
      u.push(['Šířka', f(v.sirka, 1), 'mm']);
      u.push(['Čep', 'Ø' + f(v.dCep, 1), 'mm']);
      u.push(['Poloha čepu od středu kola', `x ${f(v.cep[0], 2)}, y ${f(v.cep[1], 2)}`, 'mm']);
    } else if (v.druh === 'deska') {
      if (v.kruhCepu) u.push(['Čepy satelitů', `${v.pocetCepu} × Ø${f(v.dCepu, 1)} na Ø${f(v.kruhCepu, 3)}`, 'mm']);
      u.push(['Tloušťka', f(v.b, 1), 'mm']);
    }
    if (deleniT && v.druh !== 'hreben') {
      u.push(['Rozdělení', deleniT.zaklad, '']);
      u.push(...deleniT.radky);
    }

    // ---------- postup ----------
    const tl = v.b ? f(v.b, 1) + ' mm' : '';
    const sablonaKroky = () => {
      k.push('Vytiskněte šablonu tlačítkem <b>Šablona 1 : 1</b> v měřítku 100 % a změřte kontrolní úsečku (musí mít 100 mm). Vícelistovou šablonu slepte podle křížků v přesahu.');
      k.push(`Šablonu nalepte lepidlem ve spreji nebo lepicí tyčinkou na desku tloušťky <b>${tl}</b> (${esc(mat)}). U dřeva orientujte vlákna úhlopříčně, nejlépe použijte překližku.`);
      k.push('Důlčíkem nebo šídlem označte střed a středy všech otvorů přes křížky na šabloně.');
      k.push(`Vyvrtejte otvor${v.otvor ? ` Ø${f(v.otvor, 1)} mm` : ''} — nejdřív menším vrtákem, pak na míru; kvůli souososti nejlépe ve stojanové vrtačce. Pak odlehčovací otvory.`);
      if (v.z) k.push('Obrys hrubě vyřízněte (pásová/lupínková pila) asi 1 mm vně čáry. Zubové mezery řežte dvěma řezy od hlavy k patě, dno mezery vyberte vrtákem nebo pilkou.');
      else k.push('Obrys vyřízněte lupínkovou nebo pásovou pilou asi 0,5 mm vně čáry.');
      k.push('Dočistěte pilníkem (jehlové pilníky do zubových mezer) přesně na čáru — čára má zůstat napůl vidět. Hrany lehce sražte.');
      if (pocet > 1 || v.z) k.push('Více stejných dílů řežte najednou: desky sešroubujte nebo slepte oboustrannou páskou („stack cutting“).');
    };
    if (v.druh === 'evol' && metoda === 'freza') {
      const t = tetiva(v);
      k.push(`Na soustruhu připravte polotovar <b>Ø${f(v.da, 3)} mm</b>, šířka ${tl}, a vyvrtejte/vystružte otvor${v.otvor ? ` Ø${f(v.otvor, 2)}` : ''}. Čela zarovnejte na jedno upnutí s obvodem.`);
      k.push('Polotovar nasaďte na trn a upněte mezi hroty dělicího přístroje a koníku; ověřte házení obvodu (do 0,02 mm).');
      k.push(`Upněte modulovou frézu${frezaCislo(t.zv) ? ` č. ${frezaCislo(t.zv)}` : ''} m ${f(v.mn, 2)} a vystřeďte ji na osu polotovaru (dotykem obou čel nebo podle hrotu).`);
      if (sikme) k.push(`Šikmé zuby: stůl natočte o β = ${f(O.deg(v.beta), 2)}° a dělicí přístroj spojte výměnnými koly se šroubem stolu podle tabulky (stoupání ${f(PI * v.d / Math.tan(v.beta), 1)} mm). ${v.zuby === 'sipove' ? 'Šípové zuby frézkou vcelku nejdou — vyrobte dvě poloviny s opačným sklonem a spojte je.' : ''}`);
      k.push(`Frézu přiveďte k obvodu (dotyk na papírek), vyjeďte do volna a nastavte hloubku <b>${f((v.da - v.df) / 2, 3)} mm</b> — hrubovat ve 2–3 třískách, poslední tříska 0,2–0,3 mm.`);
      k.push(`Po každém zubu otočte klikou dělicího přístroje o ${textKliky(deleniT)}. Před otočením vždy vyjeďte frézou ze záběru a vůli vybírejte stále stejným směrem.`);
      k.push(`Po prvních dvou mezerách změřte tloušťku zubu posuvkou na zuby: <b>s̄ = ${f(t.s, 3)} mm</b> na výšce h̄ = ${f(t.h, 3)} mm${isFinite(v.Wk) ? `, nebo mikrometrem přes ${v.kz} zuby W = ${f(v.Wk - (v.jt || 0) * Math.cos(v.an) / 2, 3)} mm` : ''}. Hloubku upravte a dofrézujte.`);
      k.push('Odjehlete hrany zubů, zkontrolujte záběr s protikolem na pevné osové vzdálenosti (barvou nebo fixem na bocích).');
    } else if (v.druh === 'hreben' && metoda === 'freza') {
      k.push(`Polotovar ofrézujte na rozměr, na horní ploše nechte přídavek; výška zubu ${f((2 * v.ha + v.c) * v.mn, 3)} mm.`);
      k.push('Hřeben upněte do svěráku rovnoběžně s pohybem stolu (ustavit úchylkoměrem).' + (sikme ? ` Pro šikmé zuby natočte svěrák o β = ${f(O.deg(v.beta), 2)}°.` : ''));
      k.push(`Upněte modulovou frézu č. 1 m ${f(v.mn, 2)}, nastavte hloubku a vyfrézujte první mezeru.`);
      k.push(`Každou další mezeru posuňte stůl o rozteč <b>${f(v.roz, 4)} mm</b>. Polohy počítejte vždy od první mezery (tabulka), ne přičítáním k předchozí — chyby se jinak sčítají. Nejlépe s digitálním odměřováním.`);
      k.push('Tloušťku zubu kontrolujte posuvkou na zuby: ' + f(v.roz / 2 - (v.jt || 0) / 2, 3) + ` mm na výšce ${f(v.ha * v.mn, 3)} mm.`);
    } else if (metoda === 'freza' && v.z && v.druh !== 'evol') {
      k.push(`Na soustruhu připravte polotovar Ø${f(v.da, 3)} mm, tloušťka ${tl}, s otvorem${v.otvor ? ` Ø${f(v.otvor, 2)}` : ''}.`);
      k.push(v.druh === 'venec'
        ? 'Vnitřní ozubení běžnou modulovou frézou nevyrobíte — zuby se obrážejí nožem tvaru mezery (obrážečka, hoblovka s dělicím přístrojem) nebo se vyřežou podle šablony a dopilují.'
        : `Vyrobte tvarovou frézu (nebo nůž do obrážení) přesně podle mezery na šabloně — ${v.druh === 'cykloida' ? 'hodinářské cykloidní frézy se prodávají podle modulu a počtu zubů' : v.druh === 'maltez' ? 'drážky jdou stopkovou frézou o průměru šířky drážky' : 'tvar mezery je na šabloně 1 : 1'}.`);
      k.push(`Polotovar upněte na trn do dělicího přístroje a po každé ${v.druh === 'maltez' ? 'drážce' : 'mezeře'} otočte klikou o ${textKliky(deleniT)} (${f(360 / v.z, 3)}°).`);
      if (v.druh === 'maltez') k.push('Vydutá vybrání mezi drážkami vyfrézujte na otočném stole nebo vyřízněte podle šablony a dopilujte.');
      k.push('Obrys dočistěte podle šablony, zkontrolujte záběr s protikusem.');
    } else if (metoda === 'kruzidlo') {
      const Rn = v.druh === 'cevnik' ? v.d : (v.d || v.da);
      k.push(`Na desku narýsujte středové osy a kružnice: ${v.da ? `hlavová Ø${f(v.da, 2)}, ` : ''}${v.d ? `roztečná Ø${f(v.d, 2)}` : ''}${v.df ? `, patní Ø${f(v.df, 2)}` : ''}${v.druh === 'cevnik' ? `kružnice cévek Ø${f(v.d, 3)}` : ''} mm. Kružidlo s aretací, rýsovací jehla místo tužky.`);
      if (v.z) {
        k.push(`Odpichovátkem rozměřte na ${v.druh === 'cevnik' ? 'kružnici cévek' : 'roztečné kružnici'} ${v.z} dílů: rozevření <b>${f(Rn * Math.sin(PI / v.z), 3)} mm</b> (tětiva). Chyby se sčítají — po obejití kruhu změřte, o kolik poslední díl nesedí, a rozevření opravte o tuto chybu dělenou ${v.z}. Opakujte, dokud se kruh nesejde.`);
        k.push('Alternativa bez odpichovátka: úhloměrem po ' + f(360 / v.z, 3) + '°, nebo proužkem papíru ovinutým kolem polotovaru a rozděleným pravítkem.');
      }
      if (v.druh === 'evol') {
        const t = tetiva(v);
        k.push(`Od každé značky naneste na roztečnou kružnici tloušťku zubu ${f(t.s, 3)} mm; tím máte oba boky zubu na roztečné kružnici.`);
        k.push(`Boky zubů narýsujte kruhovým obloukem (dílenská náhrada evolventy): střed na základní kružnici Ø${f(v.db, 2)} mm, poloměr ${f(v.d / 2 * Math.sin(v.an), 2)} mm — tj. tětiva od bodu na roztečné kružnici k jejímu tečnému bodu. Pod základní kružnicí veďte bok radiálně k patě.`);
      } else if (v.druh === 'cevnik') {
        k.push(`Obě čela sešroubujte k sobě a vrtejte cévky Ø${f(v.dc, 2)} mm naráz skrz — jen tak budou díry v obou čelech proti sobě.`);
        k.push('Cévky zalisujte nebo zalepte; u dřevěného cevníku je nechte volně otočné, méně se opotřebují.');
      } else if (v.z) {
        k.push('Tvar zubu přeneste z šablony (stačí vytisknout jeden zub) nebo narýsujte podle tabulky výše.');
      }
      k.push('Vyřízněte a dopilujte na čáry, jako u šablony.');
    } else {
      sablonaKroky();
      if (v.druh === 'cevnik') k.push(`Cévky Ø${f(v.dc, 2)} mm vrtejte do obou čel sešroubovaných k sobě — naráz skrz, aby díry lícovaly.`);
      if (v.druh === 'venec') k.push('Vnitřní zuby: nejdřív vyvrtejte v každé mezeře díru pro plátek pily, pak vyřezávejte zevnitř.');
      if (v.druh === 'zapadka') k.push(`Západku nasaďte na čep ve vzdálenosti podle tabulky a přitlačte ji pružinou; hrot musí padnout až do paty zubu.`);
    }
    if (v.druh === 'evol' && metoda !== 'freza') {
      const t = tetiva(v);
      k.push(`Kontrola: tloušťka zubu posuvkou ${f(t.s, 3)} mm na výšce ${f(t.h, 3)} mm${isFinite(v.Wk) ? `, nebo přes ${v.kz} zuby W = ${f(v.Wk - (v.jt || 0) * Math.cos(v.an) / 2, 3)} mm` : ''}.`);
    }
    k.push(`Smontujte na osovou vzdálenost ${model.dily.length > 1 ? 'podle výpočtu' : ''} a ručně protočte o celou otáčku — nesmí nikde drhnout ani mít velkou vůli. Místa, kde drhne, označte fixem a lehce přepilujte.`);
    return { d, v, u, k, jmeno };
  }

  function vykresliRucni() {
    const metoda = el('ruMetoda').value;
    document.querySelectorAll('.ru-freza').forEach(e => e.classList.toggle('skryt', metoda !== 'freza'));
    el('kartaRucni').querySelector('.ru-vlastni').classList.toggle('skryt', metoda !== 'freza' || el('ruKotouce').value !== 'vlastni');
    const r = rucniData();
    if (!r) { el('ruUdaje').innerHTML = ''; el('ruPostup').innerHTML = ''; return; }
    el('ruUdaje').innerHTML = '<div class="postup-nadpis">Výrobní údaje</div><table class="t dul"><tbody>' +
      r.u.map(([a, b, c]) => `<tr><td>${a}</td><td class="c" style="white-space:normal">${b}</td><td class="j">${c}</td></tr>`).join('') + '</tbody></table>';
    el('ruPostup').innerHTML = '<div class="postup-nadpis">Postup</div><ol class="postup">' + r.k.map(x => `<li>${x}</li>`).join('') + '</ol>';
  }

  /* ---------- šablona 1 : 1 (SVG v milimetrech, osa y dolů) ---------- */
  function sablonaSvg(d) {
    const v = d.vyroba || {};
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const roz = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
    const cesta = sm => 'M' + sm.map(([x, y]) => { roz(x, -y); return `${x.toFixed(3)},${(-y).toFixed(3)}`; }).join('L') + 'Z';
    const tvary = [], vrtani = [];
    const stred = sm => {
      let a = Infinity, b = -Infinity, c = Infinity, e = -Infinity;
      for (const [x, y] of sm) { a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, y); e = Math.max(e, y); }
      return { x: (a + b) / 2, y: (c + e) / 2, w: b - a, h: e - c, n: sm.length };
    };
    for (const t of d.telesa) {
      if (t.naboj) continue;
      const cark = t.pruhledne ? ' stroke-dasharray="3 2" stroke="#666"' : ' stroke="#000"';
      tvary.push(`<path d="${[t.obrys, ...(t.otvory || [])].map(cesta).join(' ')}" fill="none"${cark} stroke-width="${t.kolik ? 0.2 : 0.3}"/>`);
      const kruhove = t.kolik ? [t.obrys] : (t.otvory || []);
      for (const h of kruhove) {
        const s = stred(h);
        const kulate = s.n > 10 && Math.abs(s.w - s.h) < 0.12 * Math.max(s.w, s.h);
        vrtani.push({ ...s, popis: kulate ? 'Ø' + f(s.w, 1) : '' });
      }
    }
    const R = Math.max(x1 - x0, y1 - y0) / 2;
    const el2 = [];
    const ztm = 'stroke="#888" stroke-width="0.15"';
    if (v.druh !== 'hreben') {
      const L = R + 6;
      el2.push(`<path d="M${-L},0H${L}M0,${-L}V${L}" ${ztm} stroke-dasharray="6 1.5 1 1.5"/>`);
      roz(-L, -L); roz(L, L);
    } else {
      el2.push(`<path d="M${(x0 - 5).toFixed(2)},0H${(x1 + 5).toFixed(2)}" ${ztm} stroke-dasharray="6 1.5 1 1.5"/>`);
      el2.push(`<text x="${(x0).toFixed(2)}" y="-1" font-size="2.5" fill="#666">roztečná přímka</text>`);
    }
    if (v.d && v.druh !== 'hreben') el2.push(`<circle cx="0" cy="0" r="${(v.d / 2).toFixed(3)}" fill="none" ${ztm} stroke-dasharray="4 1.5"/>`);
    for (const h of vrtani) {
      const q = Math.max(1.5, Math.min(4, h.w * 0.35));
      el2.push(`<path d="M${(h.x - q).toFixed(3)},${(-h.y).toFixed(3)}h${2 * q}M${h.x.toFixed(3)},${(-h.y - q).toFixed(3)}v${2 * q}" stroke="#000" stroke-width="0.15"/>`);
      if (h.popis && h.w > 5) el2.push(`<text x="${(h.x + q * 0.6).toFixed(2)}" y="${(-h.y - q * 0.6).toFixed(2)}" font-size="2.2" fill="#444">${h.popis}</text>`);
    }
    // číslování zubů
    if (v.z && ['evol', 'cykloida', 'cevkolo', 'rohatka', 'maltez', 'venec', 'cevnik'].includes(v.druh)) {
      const krok = v.z > 60 ? 10 : v.z > 20 ? 5 : 1;
      const rr = R + 3.5;
      for (let i = 0; i < v.z; i += krok) {
        const a = TAU * i / v.z;
        el2.push(`<text x="${(rr * Math.cos(a)).toFixed(2)}" y="${(-rr * Math.sin(a) + 1).toFixed(2)}" font-size="2.6" text-anchor="middle" fill="#555">${i + 1}</text>`);
      }
      roz(-rr - 3, -rr - 3); roz(rr + 3, rr + 3);
    }
    // popisový blok a kontrolní úsečka 100 mm
    const S = stav();
    const radky = [
      `${d.nazev} — ${TYPY.find(t => t.id === typAkt()).nazev}`,
      [v.z ? `z = ${v.z}` : '', v.mn ? `m = ${f(v.mn, 3)}` : v.m ? `m = ${f(v.m, 3)}` : '', v.da ? `polotovar Ø${f(v.da, 2)}` : '', v.b ? `tl. ${f(v.b, 1)} mm` : '', MOD.MATERIALY[S.material].nazev].filter(Boolean).join(' · '),
      'Tisk v měřítku 100 % · čárkovaně roztečná kružnice · křížky = středy děr',
    ];
    const ty = y1 + 8;
    radky.forEach((r, i) => el2.push(`<text x="${x0.toFixed(2)}" y="${(ty + i * 5).toFixed(2)}" font-size="${i ? 3 : 3.8}" font-weight="${i ? 400 : 700}" fill="#000">${esc(r)}</text>`));
    const uy = ty + radky.length * 5 + 3;
    let u = `<path d="M${x0},${uy}h100" stroke="#000" stroke-width="0.35"/>`;
    for (let i = 0; i <= 10; i++) u += `<path d="M${x0 + i * 10},${uy}v${i % 5 ? -1.5 : -3}" stroke="#000" stroke-width="0.25"/>`;
    u += `<text x="${x0 + 102}" y="${uy + 1}" font-size="3" fill="#000">kontrola: 100 mm</text>`;
    el2.push(u);
    roz(x0, uy + 3); roz(x0 + 135, uy);
    return { obsah: tvary.join('') + el2.join(''), x0: x0 - 4, y0: y0 - 4, x1: x1 + 4, y1: y1 + 4 };
  }

  // Rozdělení šablony na listy A4 (190 × 277 mm tisknutelné plochy, přesah 10 mm).
  function listySablony(d) {
    const s = sablonaSvg(d);
    const PW = 190, PH = 277, OV = 10;
    const W = s.x1 - s.x0, H = s.y1 - s.y0;
    const nx = W <= PW ? 1 : Math.ceil((W - OV) / (PW - OV)), ny = H <= PH ? 1 : Math.ceil((H - OV) / (PH - OV));
    // značky pro slepení uprostřed přesahů (jsou na obou sousedních listech)
    let znacky = '';
    for (let i = 1; i < nx; i++) for (let j = 0; j <= ny; j++) {
      const x = s.x0 + i * (PW - OV) + OV / 2, y = s.y0 + Math.min(j * (PH - OV) + OV / 2, H - 5);
      znacky += `<path d="M${x - 3},${y}h6M${x},${y - 3}v6" stroke="#c00" stroke-width="0.2"/><circle cx="${x}" cy="${y}" r="1.6" fill="none" stroke="#c00" stroke-width="0.2"/>`;
    }
    for (let j = 1; j < ny; j++) for (let i = 0; i <= nx; i++) {
      const y = s.y0 + j * (PH - OV) + OV / 2, x = s.x0 + Math.min(i * (PW - OV) + OV / 2, W - 5);
      znacky += `<path d="M${x - 3},${y}h6M${x},${y - 3}v6" stroke="#c00" stroke-width="0.2"/><circle cx="${x}" cy="${y}" r="1.6" fill="none" stroke="#c00" stroke-width="0.2"/>`;
    }
    const listy = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const vx = s.x0 + i * (PW - OV), vy = s.y0 + j * (PH - OV);
      const stitek = nx * ny > 1 ? `<text x="${vx + 2}" y="${vy + 4}" font-size="3" fill="#c00">list ${j * nx + i + 1}/${nx * ny} (řada ${j + 1}, sloupec ${i + 1}) — přesah ${OV} mm</text>` : '';
      listy.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${PW}mm" height="${PH}mm" viewBox="${vx.toFixed(3)} ${vy.toFixed(3)} ${PW} ${PH}" font-family="sans-serif">${s.obsah}${znacky}${stitek}</svg>`);
    }
    return { listy, s, nx, ny };
  }

  function stahniSablonu() {
    const d = vybranyDil();
    if (!d) return;
    const s = sablonaSvg(d);
    const w = s.x1 - s.x0, h = s.y1 - s.y0;
    const txt = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(3)}mm" height="${h.toFixed(3)}mm" viewBox="${s.x0.toFixed(3)} ${s.y0.toFixed(3)} ${w.toFixed(3)} ${h.toFixed(3)}" font-family="sans-serif">\n<rect x="${s.x0}" y="${s.y0}" width="${w}" height="${h}" fill="#fff"/>\n${s.obsah}\n</svg>\n`;
    stahni(new Blob([txt], { type: 'image/svg+xml' }), jmeno('sablona_' + d.id, 'svg'));
  }

  function tiskRucni(sDilenskymListem) {
    const d = vybranyDil();
    if (!d) return;
    const L = listySablony(d);
    let h = '';
    if (sDilenskymListem) {
      const r = rucniData();
      const metoda = el('ruMetoda').selectedOptions[0].textContent;
      h += `<h1>Dílenský list: ${esc(r.jmeno)}</h1><p class="meta">${TYPY.find(t => t.id === typAkt()).nazev} · ${esc(metoda)} · ${new Date().toLocaleDateString('cs-CZ')}</p>`;
      h += '<h2>Výrobní údaje</h2><table>' + r.u.map(([a, b, c]) => `<tr><td>${a}</td><td>${b}</td><td>${c}</td></tr>`).join('') + '</table>';
      h += '<h2>Postup</h2><ol>' + r.k.map(x => `<li>${x}</li>`).join('') + '</ol>';
      h += `<p class="meta">Šablona 1 : 1 následuje na ${L.listy.length} ${L.listy.length === 1 ? 'listu' : 'listech'} A4.</p>`;
      h += '<div class="zlom"></div>';
    }
    h += L.listy.map(x => `<div class="list">${x}</div>`).join('');
    el('protokol').innerHTML = h;
    if (L.listy.length > 1) Dialog.info(`Šablona se tiskne na ${L.listy.length} listů A4 (${L.nx} × ${L.ny}). Slepte je podle červených křížků.`);
    setTimeout(() => window.print(), 80);
  }

  /* ==================================================================
     11. HLEDÁNÍ PŘEVODU
     ================================================================== */
  function hledej() {
    const cil = parseFloat(String(el('hlI').value).replace(',', '.'));
    const zmin = Math.max(5, parseInt(el('hlZmin').value, 10) || 12);
    const zmax = Math.max(zmin + 1, Math.min(300, parseInt(el('hlZmax').value, 10) || 80));
    const st = +el('hlStupne').value;
    if (!(cil > 0)) { Dialog.chyba('Zadejte kladný převodový poměr.'); return; }
    const vys = [];
    for (let a = zmin; a <= zmax; a++) {
      const b = Math.round(cil * a);
      if (b >= zmin && b <= zmax) vys.push({ z: [a, b], i: b / a });
    }
    if (st === 2) {
      const hranice = Math.min(zmax, 60);
      for (let a = zmin; a <= hranice; a++) for (let c = a; c <= hranice; c++) for (let b = zmin; b <= zmax; b++) {
        const d = Math.round(cil * a * c / b);
        if (d < zmin || d > zmax) continue;
        vys.push({ z: [a, b, c, d], i: (b * d) / (a * c) });
      }
    }
    const soucet = v => v.z.reduce((s, x) => s + x, 0);
    vys.forEach(v => { v.chyba = Math.abs(v.i - cil) / cil; });
    vys.sort((p, q) => (p.chyba - q.chyba) || (soucet(p) - soucet(q)));
    const videne = new Set(), top = [];
    for (const v of vys) {
      const k = v.z.join(',');
      if (videne.has(k)) continue;
      videne.add(k); top.push(v);
      if (top.length >= 16) break;
    }
    if (!top.length) { el('hlVysledky').innerHTML = '<p class="prazdne">V zadaném rozsahu zubů nic nevyšlo — rozšiřte ho.</p>'; return; }
    let h = '<table class="t"><thead><tr><th>Dvojice zubů</th><th>Dosažený poměr</th><th>Odchylka</th><th>Lovecký zub</th><th></th></tr></thead><tbody>';
    top.forEach((v, n) => {
      const dv = v.z.length === 2 ? `${v.z[0]} → ${v.z[1]}` : `${v.z[0]} → ${v.z[1]} · ${v.z[2]} → ${v.z[3]}`;
      const lov = v.z.length === 2 ? MOD.gcd(v.z[0], v.z[1]) === 1 : MOD.gcd(v.z[0], v.z[1]) === 1 && MOD.gcd(v.z[2], v.z[3]) === 1;
      h += `<tr><td>${dv}</td><td class="c">${f(v.i, 6)}</td><td class="c">${v.chyba < 1e-12 ? 'přesně' : f(v.chyba * 100, 4) + ' %'}</td><td>${lov ? 'ano' : '—'}</td>
        <td><button type="button" class="btn" data-pouzij="${n}">${v.z.length === 2 ? 'Použít' : 'Použít 1. stupeň'}</button></td></tr>`;
    });
    el('hlVysledky').innerHTML = h + '</tbody></table>';
    el('hlVysledky').querySelectorAll('[data-pouzij]').forEach(b => b.addEventListener('click', () => {
      const v = top[+b.dataset.pouzij];
      zmen(q => { q.typ = 'celni'; Object.assign(q.hodnoty.celni, { z1: v.z[0], z2: v.z[1], aw: 0 }); }, null, true);
      el('canvas-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  /* ==================================================================
     12. OVLÁDÁNÍ
     ================================================================== */
  function pripojOvladani() {
    el('btn2d').addEventListener('click', () => { if (rezim !== '2d') el('t3d').click(); });
    el('btn3d').addEventListener('click', do3d);
    el('platno').addEventListener('dblclick', prizpusob3d);
    el('btnPlay').addEventListener('click', () => prepniHrani(!hraje));
    el('btnNula').addEventListener('click', () => { cas = 0; prekresli(); });
    el('rychlost').addEventListener('input', e => { otackyVstupu = +e.target.value; el('rychlostTxt').textContent = otackyVstupu + ' ot/min'; prekresli(); });
    el('btnFit').addEventListener('click', () => rezim === '3d' ? prizpusob3d() : prizpusob2d());
    el('btnDetail').addEventListener('click', detailZaberu);
    el('btnCsv').addEventListener('click', () => model && csvKusovnik());
    el('btnProtokol').addEventListener('click', tiskProtokolu);
    document.querySelectorAll('[data-export]').forEach(b => b.addEventListener('click', () => exportuj(b.dataset.export)));
    el('btnStl').addEventListener('click', () => exportuj('stl'));
    el('btn3mf').addEventListener('click', () => exportuj('3mf'));
    el('btnObj').addEventListener('click', () => exportuj('obj'));
    ['expDil', 'expRozlozeni', 'expJemnost'].forEach(id => el(id).addEventListener('change', () => model && souhrny()));
    el('btnHledat').addEventListener('click', hledej);
    ['ruDil', 'ruMetoda', 'ruPrevod', 'ruKotouce', 'ruKruhy', 'ruStroj'].forEach(id => el(id).addEventListener(id === 'ruKruhy' || id === 'ruStroj' ? 'input' : 'change', vykresliRucni));
    el('btnSablonaSvg').addEventListener('click', stahniSablonu);
    el('btnSablonaTisk').addEventListener('click', () => tiskRucni(false));
    el('btnDilenskyList').addEventListener('click', () => tiskRucni(true));
    el('hlI').addEventListener('keydown', e => { if (e.key === 'Enter') hledej(); });
    el('f_nazev').addEventListener('change', () => zmen(q => { q.nazev = el('f_nazev').value; }));

    document.addEventListener('keydown', e => {
      if (e.key !== ' ' || e.target.closest('input, select, textarea, button') || document.querySelector('dialog[open]')) return;
      e.preventDefault(); prepniHrani(!hraje);
    });
    if (window.ResizeObserver) new ResizeObserver(() => { if (rezim === '2d') velikost2d(); }).observe(el('canvas-container'));
    window.addEventListener('resize', () => { if (rezim === '2d') velikost2d(); });
  }

  /* ==================================================================
     13. START
     ================================================================== */
  app = G3D.aplikace({
    typ: 'ozubena_kola', nazev: 'Ozubená soukolí', klic: KLIC, soubor: 'soukoli', formular: false,
    normalizuj: OZK.normalizuj,
    vychozi: () => (app ? OZK.vychoziTypu(app.p) : OZK.vychozi()),   // ✨ Výchozí = jen aktuální typ (jako dřív ↺)
    // soubor .json: nový projekt gen3d nebo starý návrh {v: 1, typ, hodnoty, spol} (ostatní typy si ponechají hodnoty)
    nactiProjekt: text => {
      let j; try { j = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON.'); }
      if (j && j.projekt === undefined) return OZK.slij(app.p, j);
      return G3D.nactiProjektJson(text, 'ozubena_kola', OZK.normalizuj, 'Ozubená soukolí');
    },
    popis: q => { const t = TYPY.find(x => x.id === q.typ), h = q.hodnoty[q.typ]; return t.nazev + (h.z1 && h.z2 ? ` ${h.z1} : ${h.z2}` : '') + (h.m ? `, m ${String(h.m).replace('.', ',')}` : ''); },
    predNaplnenim: () => {}, poNaplneni: () => obnovFormular(),
    viditelnost: () => aktualizujViditelnost(),
    prepocitej: () => naplanujPrepocet(),
    png: () => { if (rezim === '3d') return nahled.png(); kresli(); return platno.toDataURL('image/png'); },
    pohled: j => { do3d(); nahled.pohled(j); },
    exportStl: () => exportuj('stl'),
    doModelare: () => {
      if (!model) { Dialog.chyba('Nejdřív opravte parametry — soukolí zatím nejde sestavit.'); return null; }
      return { data: soubor3mf(siteExportu(false, { vyber: 'vse', rozl: 'podlozka' })), pripona: '.3mf' };
    },
    zkratky: { r: 'tRez', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka', d: 't3d' },
    zmenaTematu: () => { nactiBarvy(); aktualizujLegendu(); if (rezim === '3d') postav3d(); prekresli(); },
  });

  nactiBarvy();
  postavFormular();
  pripojOvladani();
  TrubkyGui.pripoj({ klic: KLIC + '_gui', pohled: j => { do3d(); nahled.pohled(j); } });
  app.prepinac('t3d', h => prepniRezim(h ? '3d' : '2d'), true);
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); el('legPrevisy').hidden = !(h && zobr.tisk && rezim === '3d'); }, true);
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);
  app.prepinac('tRez', h => { nahled.prepni('rez', h); el('legRez').hidden = !(h && rezim === '3d'); if (h) do3d(); });
  app.prepinac('tTisk', h => {
    zobr.tisk = h;
    if (!model) return;
    if (h) do3d();
    umisteno3d = false;
    if (rezim === '3d') postav3d();
  });
  obnovFormular();
  velikost2d();
  prepocitejHned();
  hledej();
  requestAnimationFrame(smycka);
  app.start().then(() => {
    // odkaz ze Skládačky soukolí a dřívější „Odkaz na návrh“: #n=<base64url JSON>, nese jeden typ
    const m = location.hash.match(/#n=([\w-]+)/);
    if (!m) return;
    try { const r = OZK.slij(app.p, OZK.dekodujN(m[1])); noveZobrazeni = true; app.nahrad(r.p); prepocitejHned(); }
    catch (e) { Dialog.chyba('Odkaz je poškozený – návrh z něj nejde načíst.'); }
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* sandbox */ }
  });
  window.OZUBENI = { stav, model: () => model, prepocitej: prepocitejHned, sitTelesa, stlBinarni, siteExportu, obrysy2d, dxfText, svgText, soubor3mf, objText, zmenTyp, pouzijPredvolbu,
    nastav: (id, v) => { zmen(q => OZK.nastav(q, id, v)); app.naplnFormular(); prepocitejHned(); }, obnovFormular: () => app.naplnFormular(), prepniRezim: r => { if (r !== rezim) el('t3d').click(); },
    hledej, polozkyKusovniku, rucniData, listySablony, deleni, diferencialni, vymennaKola, nastavCas: t => { cas = t; kresli(); }, app, nahled };
})();
