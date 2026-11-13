/* Krabičky – ovládání stránky nad společným zapojením gen3d/aplikace.js:
   tady jen to, co je pro krabičky zvláštní (seznamy výřezů a sloupků, předvolby desek, výsledky, tloušťky, exporty po dílech). */
/* global KRAB, KRAB_GEO, KRAB_NAHLED, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = KRAB.fmt, esc = G3D.esc, box = G3D.dlazdice;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const zobrazCislo = x => (Number.isFinite(x) ? String(Math.round(x * 1e4) / 1e4).replace('.', ',') : '');
  const BARVY = { krabicka: '#4F86D9', viko: '#E0A63F' };
  let wasm = null, model = null, chybaStavby = null, hlaseniVstupu = [];

  /* ---------- 3D náhled ---------- */
  let nahled = null;
  try {
    nahled = KRAB_NAHLED.vytvorNahled($('platno'), { priMereni: ukazMereni });
  } catch (e) {
    $('stav3d').textContent = 'WebGL není k dispozici – náhled nejde zobrazit, generování a export fungují dál.';
    $('stav3d').classList.add('chyba');
  }
  function ukazMereni(m) {
    const el = $('mereniVysl');
    if (!m) { el.innerHTML = ''; return; }
    if (m.jen) { el.innerHTML = '<b>Měření:</b> klikněte na druhý bod.'; return; }
    el.innerHTML = `<b>Vzdálenost ${fmt(m.d, 2)} mm</b> · ΔX ${fmt(m.dx, 2)} · ΔY ${fmt(m.dy, 2)} · ΔZ ${fmt(m.dz, 2)} mm`
      + ` · body [${fmt(m.a.x, 2)}; ${fmt(m.a.y, 2)}; ${fmt(m.a.z, 2)}] → [${fmt(m.b.x, 2)}; ${fmt(m.b.y, 2)}; ${fmt(m.b.z, 2)}]`;
  }

  /* starý uložený stav (localStorage) má obal {format, projekt}; opravy vstupu se ukážou v Kontrole */
  function normalizuj(q) {
    const r = KRAB.normalizuj(q && q.format === 'webapp_krabicky' && q.projekt ? q.projekt : q);
    hlaseniVstupu = r.hlaseni;
    return r;
  }
  const app = G3D.aplikace({
    typ: 'krabicky', nazev: 'Krabičky', klic: 'webapp_krabicky', soubor: 'krabicka', zive: true,
    normalizuj, vychozi: () => KRAB.normalizuj(KRAB.vychoziProjekt('arduino_uno')).p,
    ulozProjekt: KRAB.ulozProjekt, nactiProjekt: KRAB.nactiProjekt,
    popis: q => `${q.nazev || 'Krabička'} – ${fmt(q.vnitrni.delka)} × ${fmt(q.vnitrni.sirka)} × ${fmt(q.vnitrni.vyska)} mm`,
    poNaplneni: () => vykresliSeznamy(),
    viditelnost: () => viditelnost(),
    prepocitej: () => { souhrny(); prestav(); }, zpozdeni: 160,
    png: () => nahled.png(), pohled: j => nahled && nahled.pohled(j),
    exportStl: () => exportStl(['krabicka', 'viko'], ''),
    doModelare: async () => { const d = await pripravExport(['krabicka', 'viko']); return d ? { data: soubor3mf(d), pripona: '.3mf' } : null; },
    zkratky: { h: 'tHrany', m: 'tTisk', p: 'tPrevisy', r: 'tRez', l: 'tPravitka', t: 'tPruhledne', e: 'tRozlozit', d: 'tMerit' },
    zmenaTematu: () => barvy(),
  });
  const p = () => app.p;

  function viditelnost() {
    const q = p(), typ = q.viko.typ;
    $('gViko').hidden = typ === 'zadne';
    $('lOsazeni').hidden = typ !== 'sroubovaci';
    $('gOsazeni').hidden = !(typ === 'nasazovaci' || q.viko.osazeni);
    $('gZapadky').hidden = typ !== 'nasazovaci';
    $('gSrouby').hidden = typ !== 'sroubovaci';
    $('pHloubkaHlavy').hidden = q.viko.sroub.zahloubeni !== 'valcove';
    $('gDeska').hidden = !q.deska.pouzit;
    document.querySelectorAll('.gUsi').forEach(e => { e.hidden = q.montaz.typ !== 'usi'; });
    $('gMontDno').hidden = q.montaz.typ !== 'dno';
    $('f_mp').closest('.pole').hidden = q.montaz.typ === 'zadne';
    $('btnPodleDesky').disabled = !q.deska.pouzit;
    $('btnStlViko').disabled = typ === 'zadne';
  }

  /* ---------- seznamy (sloupky, otvory, konektory, průchodky, větrání) ---------- */
  const PLOCHY_STENY = KRAB.PLOCHY.map(k => [k, KRAB.NAZVY_PLOCH[k]]);
  const SEZNAMY = {
    diry: { el: 'seznamDiry', data: q => q.deska.otvory, titul: i => `Sloupek ${i + 1}`, pary: [['x', 'x od rohu desky'], ['y', 'y od rohu desky']], nove: () => [5, 5] },
    montaz: { el: 'seznamMontaz', data: q => q.montaz.otvory, titul: i => `Otvor ${i + 1}`, pary: [['x', 'x'], ['y', 'y']], nove: () => [0, 0] },
    konektory: {
      el: 'seznamKonektory', data: q => q.konektory, titul: (i, k) => `${i + 1}. ${esc(k.nazev)}`,
      pole: [
        { k: 'nazev', l: 'Název', typ: 'text' },
        { k: 'plocha', l: 'Plocha', moznosti: PLOCHY_STENY },
        { k: 'vztah', l: 'Vazba', moznosti: [['krabicka', 'ke krabičce'], ['deska', 'k desce']] },
        { k: 'u', l: 'u', mm: true }, { k: 'v', l: 'v', mm: true },
        { k: 'sirka', l: 'Šířka', mm: true }, { k: 'vyska', l: 'Výška', mm: true }, { k: 'zaobleni', l: 'Zaoblení', mm: true },
      ],
      nove: () => { const q = p(), t = $('selKonektor').value, d = KRAB.KONEKTORY[t];
        return { nazev: d.nazev, typ: t, plocha: 'x-', vztah: q.deska.pouzit ? 'deska' : 'krabicka', u: q.deska.pouzit ? q.deska.sirka / 2 : 0, v: q.deska.pouzit ? d.vyska / 2 : 10, sirka: d.sirka, vyska: d.vyska, zaobleni: d.zaobleni }; },
    },
    pruchodky: {
      el: 'seznamPruchodky', data: q => q.pruchodky, titul: (i, k) => `${i + 1}. ${esc((KRAB.PRUCHODKY[k.typ] || KRAB.PRUCHODKY.vlastni).nazev)}`,
      pole: [
        { k: 'typ', l: 'Typ', moznosti: Object.entries(KRAB.PRUCHODKY).map(([k, d]) => [k, d.nazev]), priZmene: (q, i) => { const d = KRAB.PRUCHODKY[q.pruchodky[i].typ]; if (d && q.pruchodky[i].typ !== 'vlastni') q.pruchodky[i].prumer = d.prumer; } },
        { k: 'plocha', l: 'Plocha', moznosti: PLOCHY_STENY },
        { k: 'u', l: 'u', mm: true }, { k: 'v', l: 'v', mm: true }, { k: 'prumer', l: 'Průměr', mm: true },
      ],
      nove: () => { const t = $('selPruchodka').value; return { typ: t, plocha: 'x+', u: 0, v: Math.max(6, p().vnitrni.vyska / 2), prumer: KRAB.PRUCHODKY[t].prumer }; },
    },
    vetrani: {
      el: 'seznamVetrani', data: q => q.vetrani, titul: (i, k) => `${i + 1}. ${k.pocet}× štěrbina – ${esc(KRAB.NAZVY_PLOCH[k.plocha])}`,
      pole: [
        { k: 'plocha', l: 'Plocha', moznosti: PLOCHY_STENY },
        { k: 'orientace', l: 'Štěrbiny', moznosti: [['svisle', 'svislé / podél Y'], ['vodorovne', 'vodorovné / podél X']] },
        { k: 'pocet', l: 'Počet', cele: true }, { k: 'sirka', l: 'Šířka', mm: true }, { k: 'delka', l: 'Délka', mm: true },
        { k: 'rozestup', l: 'Rozteč', mm: true }, { k: 'u', l: 'u středu', mm: true }, { k: 'v', l: 'v středu', mm: true },
      ],
      nove: () => ({ plocha: 'y-', u: 0, v: Math.max(5, p().vnitrni.vyska / 2), pocet: 5, sirka: 2, delka: Math.min(10, p().vnitrni.vyska * 0.4), rozestup: 5, orientace: 'svisle' }),
    },
  };
  function vykresliSeznamy() {
    for (const [klic, s] of Object.entries(SEZNAMY)) {
      const data = s.data(p()), el = $(s.el);
      if (!data.length) { el.innerHTML = '<div class="prazdny">Žádné položky.</div>'; continue; }
      el.innerHTML = data.map((it, i) => {
        let h = `<div class="polozka" data-seznam="${klic}" data-i="${i}"><div class="hlav"><span>${s.titul(i, it)}</span>`
          + `<button class="tl smaz" data-smaz="${klic}" data-i="${i}" aria-label="Odebrat položku ${i + 1}" title="Odebrat">✕</button></div><div class="mrizka">`;
        if (s.pary) {
          s.pary.forEach(([k, l], j) => {
            h += `<div class="pole"><label>${l}<input type="text" inputmode="decimal" class="mm" data-sez="${klic}" data-i="${i}" data-j="${j}" value="${zobrazCislo(it[j])}"></label><span class="jedn">mm</span></div>`;
          });
        } else {
          for (const f of s.pole) {
            if (f.moznosti) {
              h += `<div class="pole"><label>${f.l}<select data-sez="${klic}" data-i="${i}" data-k="${f.k}">`
                + f.moznosti.map(([v, t]) => `<option value="${v}"${it[f.k] === v ? ' selected' : ''}>${esc(t)}</option>`).join('') + '</select></label></div>';
            } else if (f.typ === 'text') {
              h += `<div class="pole" style="grid-column:1/-1"><label>${f.l}<input type="text" data-sez="${klic}" data-i="${i}" data-k="${f.k}" data-text="1" value="${esc(it[f.k])}" maxlength="60"></label></div>`;
            } else {
              h += `<div class="pole"><label>${f.l}<input type="text" inputmode="decimal"${f.mm ? ' class="mm"' : ''} data-sez="${klic}" data-i="${i}" data-k="${f.k}" value="${zobrazCislo(it[f.k])}"></label>${f.mm ? '<span class="jedn">mm</span>' : ''}</div>`;
            }
          }
        }
        return h + '</div></div>';
      }).join('');
    }
  }
  const cesta = (q, klic) => SEZNAMY[klic].data(q);
  // psaní do položky = jeden krok zpět (slučuje aplikace.js podle klíče)
  document.addEventListener('input', e => {
    const el = e.target; if (!el.dataset || !el.dataset.sez || el.tagName === 'SELECT') return;
    const i = +el.dataset.i, kl = `sez-${el.dataset.sez}-${i}-${el.dataset.k || el.dataset.j}`;
    if (el.dataset.text) { app.zmen(q => { cesta(q, el.dataset.sez)[i][el.dataset.k] = el.value; }, kl); return; }
    const h = G3D.ctiCislo(el.value);
    if (!Number.isFinite(h)) { el.classList.add('spatne'); return; }
    el.classList.remove('spatne');
    app.zmen(q => { const it = cesta(q, el.dataset.sez)[i]; if (el.dataset.j !== undefined) it[+el.dataset.j] = h; else it[el.dataset.k] = h; }, kl);
  });
  document.addEventListener('change', e => {
    const el = e.target; if (!el.dataset || !el.dataset.sez) return;
    if (el.tagName !== 'SELECT') return;
    const s = SEZNAMY[el.dataset.sez], i = +el.dataset.i, f = s.pole.find(x => x.k === el.dataset.k);
    app.zmen(q => { cesta(q, el.dataset.sez)[i][el.dataset.k] = el.value; if (f && f.priZmene) f.priZmene(q, i); });
    vykresliSeznamy();
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.smaz) { const k = b.dataset.smaz, i = +b.dataset.i; app.zmen(q => cesta(q, k).splice(i, 1)); vykresliSeznamy(); }
    if (b.dataset.pridej) { const k = b.dataset.pridej, it = SEZNAMY[k].nove(); app.zmen(q => cesta(q, k).push(it)); vykresliSeznamy(); }
  });
  $('selKonektor').innerHTML = Object.entries(KRAB.KONEKTORY).map(([k, d]) => `<option value="${k}">${esc(d.nazev)} (${fmt(d.sirka)} × ${fmt(d.vyska)})</option>`).join('');
  $('selPruchodka').innerHTML = Object.entries(KRAB.PRUCHODKY).map(([k, d]) => `<option value="${k}">${esc(d.nazev)} – Ø ${fmt(d.prumer)}</option>`).join('');

  /* ---------- přestavba modelu ---------- */
  function prestav() {
    const q = p();
    if (wasm) {
      try {
        const r = KRAB_GEO.postav(wasm, q);
        model = { dily: r.dily, cas: r.cas, kontroly: r.dily.map(d => KRAB.kontrolaSite(d.poz, d.idx)), odv: KRAB.odvozene(q) };
        chybaStavby = null;
        $('tloustkyVysl').textContent = '';
        if (nahled) { nahled.oznacTenke(null); nahled.nastav(model.dily, model.odv, q); }
      } catch (e) {
        chybaStavby = String(e && e.message || e);
        model = null;
        if (nahled) nahled.nastav(null);
      }
    }
    const st = $('stav3d');
    st.textContent = wasm ? (chybaStavby ? 'Model nejde sestavit: ' + chybaStavby : '') : (chybaStavby || 'Načítám geometrické jádro…');
    st.classList.toggle('chyba', !!chybaStavby);
    vypisVysledky();
    vypisHlaseni();
  }

  function souhrny() {
    const q = p(), o = KRAB.odvozene(q);
    TrubkyGui.souhrn('sRozmery', `${fmt(o.celkem[0])} × ${fmt(o.celkem[1])} × ${fmt(o.celkem[2])} mm`, true);
    $('vnejsiRozmery').textContent = `Vnější rozměry: ${fmt(o.Lo, 2)} × ${fmt(o.Wo, 2)} × ${fmt(o.Hb, 2)} mm (bez víka)` + (o.maViko ? `, s víkem ${fmt(o.Hb + o.Hv, 2)} mm.` : '.');
    TrubkyGui.souhrn('sSteny', `stěna ${fmt(q.stena, 2)} · dno ${fmt(q.dno, 2)} · R ${fmt(q.zaobleni)} mm`, true);
    TrubkyGui.souhrn('sViko', { nasazovaci: 'nasazovací', sroubovaci: 'šroubované', zadne: 'bez víka' }[q.viko.typ], q.viko.typ !== 'zadne');
    TrubkyGui.souhrn('sDeska', q.deska.pouzit ? `${q.deska.nazev}, ${q.deska.otvory.length} sloupky` : 'bez desky', q.deska.pouzit);
    TrubkyGui.souhrn('sMontaz', { zadne: 'žádná', usi: 'uši', dno: `${q.montaz.otvory.length} otvory ve dně` }[q.montaz.typ], q.montaz.typ !== 'zadne');
    TrubkyGui.souhrn('sVyrezy', `${q.konektory.length} konektory · ${q.pruchodky.length} průchodky · ${q.vetrani.length} větrání`, true);
    $('sTisk').textContent = `+${fmt(q.tolerance, 2)} mm`;
    const pv = predvolbaProjektu();
    $('zdrojPredvolby').textContent = pv && KRAB.PREDVOLBY[pv].zdroj ? 'Zdroj rozměrů: ' + KRAB.PREDVOLBY[pv].zdroj : '';
  }

  function vypisVysledky() {
    const el = $('vysledky');
    if (!model) { el.innerHTML = box('Stav', wasm ? 'Chyba stavby' : 'Načítám…', chybaStavby || '', 'chyba-t'); $('vSit').innerHTML = ''; $('kusovnik').innerHTML = ''; return; }
    const o = model.odv, q = p();
    const V = model.dily.reduce((s, d) => s + d.objem, 0), t = G3D.odhadTisku(V, 1.24, { dilu: model.dily.length });
    let h = box('Celkové rozměry', `${fmt(o.celkem[0])} × ${fmt(o.celkem[1])} × ${fmt(o.celkem[2])}`, 'mm (X × Y × Z, sestava)');
    h += box('Objem', `${fmt(V / 1000, 2)} cm³`, `${model.dily.length} ${model.dily.length > 1 ? 'díly' : 'díl'}, plné`);
    h += box('Hmotnost', `${fmt(t.g, 0)} g`, `PLA, 100 % výplň (při 30 % výplni zhruba ${fmt(t.g * 0.55, 0)} g)`);
    h += box('Filament', `${fmt(t.metru, 2)} m`, 'průměr 1,75 mm, plné díly');
    h += box('Doba tisku', `≈ ${t.minut < 60 ? t.minut + ' min' : fmt(t.minut / 60, 1) + ' h'}`, 'hrubý odhad, vrstva 0,2 mm');
    model.dily.forEach((d, i) => {
      const c = model.kontroly[i];
      const ok = c.uzavrena && c.normalyVen && c.teles === 1 && c.dutin === 0;
      h += box(esc(d.nazev), ok ? '✓ tisknutelné' : '✗ problém',
        `${c.uzavrena ? 'uzavřená síť' : `<span class="chyba-t">otevřená síť (${c.hranOkrajovych} okr. hran)</span>`} · `
        + `${c.normalyVen ? 'normály ven' : '<span class="chyba-t">normály dovnitř</span>'}<br>`
        + `${c.teles} těleso${c.teles > 1 ? ' <span class="chyba-t">(víc těles!)</span>' : ''}${c.dutin ? ` · <span class="chyba-t">${c.dutin} uzavřené dutiny</span>` : ''} · otvorů (rod) ${c.rod}<br>`
        + `${c.trojuhelniku.toLocaleString('cs-CZ')} trojúhelníků · ${fmt(d.objem / 1000, 2)} cm³ ≈ ${fmt(d.objem / 1000 * 1.24, 1)} g PLA (100 % výplň)`, ok ? 'ok-t' : 'chyba-t');
    });
    h += box('Výpočet', `${model.cas} ms`, `manifold-3d, ${q.segmenty} segmentů na kružnici`);
    el.innerHTML = h;
    $('vSit').innerHTML = model.dily.map((d, i) => { const c = model.kontroly[i]; return box('Síť – ' + esc(d.nazev), c.uzavrena ? '✔ těsná' : '✖ netěsná', `${c.trojuhelniku} trojúhelníků, ${c.teles} těleso, ${model.cas} ms`, c.uzavrena && c.teles === 1 ? 'ok-t' : 'chyba-t'); }).join('');
    const tiskem = { krabicka: 'dnem dolů', viko: 'převrácené, deskou dolů' };
    $('kusovnik').innerHTML = model.dily.map(d => {
      const b = KRAB.obal(d.poz);
      return `<tr><td>${esc(d.nazev)}</td><td class="c">${fmt(b[3] - b[0])} × ${fmt(b[4] - b[1])} × ${fmt(b[5] - b[2])}</td><td class="c">${fmt(d.objem / 1000, 2)} cm³</td>`
        + `<td class="c">${fmt(d.objem / 1000 * 1.24, 1)} g</td><td>${tiskem[d.jmeno] || ''}</td></tr>`;
    }).join('');
  }

  function vypisHlaseni() {
    const sez = [];
    for (const t of hlaseniVstupu) sez.push({ uroven: 'varovani', text: 'Vstup opraven – ' + t });
    if (model) model.kontroly.forEach((c, i) => {
      const jm = model.dily[i].nazev;
      if (!c.uzavrena) sez.push({ uroven: 'chyba', text: `${jm}: síť není uzavřená – export se nedoporučuje.` });
      if (c.teles > 1) sez.push({ uroven: 'chyba', text: `${jm}: obsahuje ${c.teles} oddělená tělesa (volně ležící kusy) – zkontrolujte kolize prvků.` });
      if (c.dutin) sez.push({ uroven: 'varovani', text: `${jm}: ${c.dutin} uzavřené vnitřní dutiny (např. díra sloupku ukrytá uvnitř rohového sloupku).` });
    });
    sez.push(...KRAB.kontroly(p()));
    app.hlaseni(sez, { chybaStavby: chybaStavby && 'Geometrie: ' + chybaStavby, boxy: ['boxKrabicka', 'boxVyrezy'] });
  }

  /* ---------- tloušťky ---------- */
  $('btnTloustky').onclick = () => {
    if (!model) return;
    const el = $('tloustkyVysl'), q = p(); el.textContent = 'Počítám…';
    setTimeout(() => {
      const t0 = performance.now(), body = [], texty = [];
      for (const d of model.dily) {
        const r = KRAB.tloustky(d.poz, d.idx, { vzorku: 2500, limit: q.minTloustka });
        r.tenke.forEach(b => { const x = b.slice(0, 3); x.dil = d.jmeno; body.push(x); });
        texty.push(`${d.nazev}: min ${fmt(r.min, 2)} mm` + (r.tenke.length ? ` (${r.tenke.length} míst pod ${fmt(q.minTloustka, 2)} mm)` : ''));
      }
      if (nahled) nahled.oznacTenke(body);
      el.innerHTML = esc(texty.join(' · ')) + ` <span class="${body.length ? 'mez-t' : 'ok-t'}">${body.length ? '– tenká místa jsou v náhledu červeně' : '✓'}</span> (${Math.round(performance.now() - t0)} ms)`;
    }, 20);
  };

  /* ---------- export ---------- */
  async function pripravExport(jmena) {
    if (!model) { Dialog.chyba(chybaStavby ? 'Model není sestavený: ' + chybaStavby : 'Geometrické jádro se ještě načítá.'); return null; }
    const vybrane = model.dily.map((d, i) => ({ d, c: model.kontroly[i] })).filter(x => jmena.includes(x.d.jmeno));
    if (!vybrane.length) { Dialog.chyba('Díl neexistuje.'); return null; }
    if (vybrane.some(x => !x.c.uzavrena || !x.c.normalyVen)) { Dialog.chyba('Síť neprošla kontrolou těsnosti – export zablokován.'); return null; }
    const chyby = KRAB.kontroly(p()).filter(h => h.uroven === 'chyba').length + vybrane.filter(x => x.c.teles > 1).length;
    if (chyby && !(await Dialog.potvrd(`Model má ${chyby} chyb v kontrolách (viz Kontrola). Přesto exportovat?`))) return null;
    const dily = vybrane.map(x => x.d);
    return $('chkTisk').checked ? KRAB.tiskoveRozlozeni(dily) : dily;
  }
  const soubor3mf = dily => KRAB.soubor3mf(dily.map(d => Object.assign({ barva: BARVY[d.jmeno] }, d)), p().nazev);
  async function exportStl(jmena, pripona) {
    const dily = await pripravExport(jmena); if (!dily) return;
    app.stahni(KRAB.stlBinarni(dily, 'krabicky: ' + app.jmeno('')), app.jmeno(pripona + '.stl'), 'model/stl');
  }
  $('btnStl').onclick = () => exportStl(['krabicka', 'viko'], '');
  $('btnStlKrab').onclick = () => exportStl(['krabicka'], '_krabicka');
  $('btnStlViko').onclick = () => exportStl(['viko'], '_viko');
  $('btn3mf').onclick = async () => {
    const dily = await pripravExport(['krabicka', 'viko']); if (!dily) return;
    app.stahni(soubor3mf(dily), app.jmeno('.3mf'), 'model/3mf');
  };

  /* ---------- předvolby desek ---------- */
  const predvolbaProjektu = () => {
    const q = p();
    return Object.keys(KRAB.PREDVOLBY).find(k => k !== 'prazdna' && q.deska.pouzit && q.deska.nazev === KRAB.vychoziProjekt(k).deska.nazev) || (q.deska.pouzit ? null : 'prazdna');
  };
  for (const [k, d] of Object.entries(KRAB.PREDVOLBY)) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${esc(d.nazev)}<span class="pozn">${d.zdroj ? 'Zdroj: ' + esc(d.zdroj.length > 140 ? d.zdroj.slice(0, 140) + '…' : d.zdroj) : ''}</span>`;
    b.title = d.zdroj || '';
    b.addEventListener('click', async () => {
      if (!(await Dialog.potvrd(`Použít předvolbu „${d.nazev}“? Přepíše desku, rozměry dutiny a výřezy (víko, stěny a tolerance zůstanou).`))) return;
      const q = p(), n = KRAB.vychoziProjekt();
      for (const x of ['stena', 'dno', 'zaobleni', 'segmenty', 'tolerance', 'tryska', 'minTloustka', 'viko', 'montaz', 'nazev']) n[x] = G3D.kopie(q[x]);
      d.uprav(n);
      if (k !== 'prazdna') n.nazev = 'Krabička – ' + d.nazev;
      app.nahrad(KRAB.normalizuj(n).p);
    });
    $('seznamPredvoleb').appendChild(b);
  }
  $('btnPodleDesky').onclick = () => {
    app.zmen(q => {
      const d = q.deska, okraj = 1.5;
      q.vnitrni.delka = Math.round((Math.max(0, d.x) + d.delka + okraj) * 10) / 10;
      d.y = okraj; q.vnitrni.sirka = Math.round((d.sirka + 2 * okraj) * 10) / 10;
      q.vnitrni.vyska = Math.ceil(d.sloupky.vyska + d.tloustka + d.vyskaSoucastek + 1);
    });
    app.naplnFormular();
  };

  /* ---------- zobrazení ---------- */
  function barvy() { if (nahled) nahled.barvy(css('--border-strong'), css('--border'), css('--text'), css('--text-muted')); }
  const prepni = (co, f) => h => { if (nahled) nahled.prepni(co, h); if (f) f(h); };
  const legenda = () => { $('legPrevisy').hidden = !(nahled && nahled.stav.tisk && nahled.stav.previsy); };
  app.prepinac('tHrany', prepni('hrany'));
  app.prepinac('tTisk', prepni('tisk', legenda));
  app.prepinac('tPrevisy', prepni('previsy', legenda), true);
  app.prepinac('tPravitka', prepni('pravitka'), true);
  app.prepinac('tRez', h => { $('gRez').hidden = $('legRez').hidden = !h; if (nahled) nahled.rez(h ? $('rRez').value / 100 : null); });
  $('rRez').oninput = () => { if (nahled && !$('gRez').hidden) nahled.rez($('rRez').value / 100); };
  app.prepinac('tPruhledne', prepni('pruhledne'));
  app.prepinac('tRozlozit', prepni('rozlozit'));
  app.prepinac('tDeska', prepni('deska'));
  app.prepinac('tKoty', prepni('koty'));
  app.prepinac('tMerit', prepni('mereni'));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && nahled && nahled.stav.mereni && !document.querySelector('dialog[open], .nabidka:not([hidden])')) nahled.smazMereni();
  });
  TrubkyGui.pripoj({ klic: 'webapp_krabicky_gui', pohled: j => nahled && nahled.pohled(j) });
  barvy();

  /* ---------- start ---------- */
  app.start({
    manifold: {
      ok: w => { wasm = w; prestav(); },
      chyba: e => {
        const st = $('stav3d'); st.textContent = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e); st.classList.add('chyba');
        chybaStavby = 'manifold-3d se nenačetl – model ani export nejsou k dispozici.';
        vypisHlaseni();
      },
    },
  });
  // pro testy
  window.__krabicky = { get p() { return app.p; }, get model() { return model; }, get nahled() { return nahled; }, zmen: app.zmen, prestav, app };
})();
