/* Krabičky – ovládání stránky: formulář ↔ projekt, přestavba modelu, kontroly, exporty, JSON, zpět/znovu. */
/* global KRAB, KRAB_GEO, KRAB_NAHLED, Dialog */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const KLIC = 'webapp_krabicky_projekt';
  const fmt = KRAB.fmt;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* ---------- stav ---------- */
  let p = null, hlaseniVstupu = [], wasm = null, model = null, kontrolyModelu = [], chybaStavby = null;
  const historie = [], budoucnost = [];
  function nactiUlozeny() {
    try { const s = localStorage.getItem(KLIC); if (s) return KRAB.nactiProjekt(s).p; } catch (e) { /* poškozený záznam */ }
    return KRAB.normalizuj(KRAB.vychoziProjekt('arduino_uno')).p;
  }
  function ulozMistne() { try { localStorage.setItem(KLIC, KRAB.ulozProjekt(p)); } catch (e) { /* plné úložiště */ } }

  /* ---------- 3D náhled ---------- */
  let nahled = null;
  try {
    nahled = KRAB_NAHLED.vytvorNahled($('platno'), { priMereni: ukazMereni });
  } catch (e) {
    $('stav3d').textContent = 'WebGL není k dispozici – náhled nejde zobrazit, generování a export fungují dál.';
    $('stav3d').classList.add('chyba');
  }
  const vychoziNapoveda = $('mereniVysl').innerHTML;
  function ukazMereni(m) {
    const el = $('mereniVysl');
    if (!m) { el.innerHTML = vychoziNapoveda; return; }
    if (m.jen) { el.innerHTML = '<b>Měření:</b> klikněte na druhý bod.'; return; }
    el.innerHTML = `<b>Vzdálenost ${fmt(m.d, 2)} mm</b> · ΔX ${fmt(m.dx, 2)} · ΔY ${fmt(m.dy, 2)} · ΔZ ${fmt(m.dz, 2)} mm`
      + ` · body [${fmt(m.a.x, 2)}; ${fmt(m.a.y, 2)}; ${fmt(m.a.z, 2)}] → [${fmt(m.b.x, 2)}; ${fmt(m.b.y, 2)}; ${fmt(m.b.z, 2)}]`;
  }

  /* ---------- manifold ---------- */
  function nactiSkript(src) {
    return new Promise((ok, chyba) => {
      const el = document.createElement('script'); el.src = src; el.onload = ok;
      el.onerror = () => chyba(new Error('nejde načíst ' + src)); document.head.appendChild(el);
    });
  }
  async function nactiManifold() {
    globalThis.MANIFOLD_URL = new URL('lib/manifold/manifold.klasicky.js', location.href).href;
    if (!globalThis.ManifoldModule) await nactiSkript('lib/manifold/manifold.klasicky.js');
    let volby;
    if (location.protocol === 'file:') {
      // z file:// prohlížeč .wasm nestáhne – vezme se z base64
      await nactiSkript('lib/manifold/manifold.wasm.js');
      const b64 = globalThis.MANIFOLD_WASM_B64, s = atob(b64), bin = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) bin[i] = s.charCodeAt(i);
      delete globalThis.MANIFOLD_WASM_B64;
      volby = { wasmBinary: bin };
    } else volby = { locateFile: f => new URL('lib/manifold/' + f, location.href).href };
    const w = await globalThis.ManifoldModule(volby);
    w.setup();
    return w;
  }

  /* ---------- formulář: skalární pole ---------- */
  const vezmi = (o, c) => c.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function poloz(o, c, h) { const k = c.split('.'); const l = k.pop(); k.reduce((a, x) => a[x], o)[l] = h; }
  const zobrazCislo = x => (Number.isFinite(x) ? String(Math.round(x * 1e4) / 1e4).replace('.', ',') : '');
  const ctiCislo = s => { const t = String(s).trim().replace(/\s/g, '').replace(',', '.').replace('−', '-'); return t === '' ? NaN : Number(t); };

  function naplnFormular() {
    document.querySelectorAll('[data-p]').forEach(el => {
      const h = vezmi(p, el.dataset.p);
      if (el.dataset.typ === 'bool') el.checked = !!h;
      else if (el.dataset.typ === 'text') el.value = h == null ? '' : h;
      else el.value = zobrazCislo(h);
      el.classList.remove('spatne');
    });
    vykresliSeznamy();
    viditelnost();
  }
  document.querySelectorAll('[data-p]').forEach(el => {
    const udalost = el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input';
    el.addEventListener(udalost, () => {
      let h;
      if (el.dataset.typ === 'bool') h = el.checked;
      else if (el.dataset.typ === 'text') h = el.value;
      else {
        h = ctiCislo(el.value);
        if (!Number.isFinite(h)) { el.classList.add('spatne'); return; }
        el.classList.remove('spatne');
      }
      zmen(q => poloz(q, el.dataset.p, h), el.dataset.p);
    });
    if (!el.dataset.typ) el.addEventListener('change', () => { if (!el.classList.contains('spatne')) el.value = zobrazCislo(vezmi(p, el.dataset.p)); });
  });

  function viditelnost() {
    const typ = p.viko.typ;
    $('gViko').hidden = typ === 'zadne';
    $('lOsazeni').hidden = typ !== 'sroubovaci';
    $('gOsazeni').hidden = !(typ === 'nasazovaci' || p.viko.osazeni);
    $('gZapadky').hidden = typ !== 'nasazovaci';
    $('gSrouby').hidden = typ !== 'sroubovaci';
    $('pHloubkaHlavy').hidden = p.viko.sroub.zahloubeni !== 'valcove';
    $('gDeska').hidden = !p.deska.pouzit;
    document.querySelectorAll('.gUsi').forEach(e => { e.hidden = p.montaz.typ !== 'usi'; });
    $('gMontDno').hidden = p.montaz.typ !== 'dno';
    $('f_mp').closest('.pole').hidden = p.montaz.typ === 'zadne';
    $('btnPodleDesky').disabled = !p.deska.pouzit;
    $('btnStlViko').disabled = typ === 'zadne';
  }

  /* ---------- seznamy ---------- */
  const PLOCHY_STENY = KRAB.PLOCHY.map(k => [k, KRAB.NAZVY_PLOCH[k]]);
  const SEZNAMY = {
    diry: { el: 'seznamDiry', data: () => p.deska.otvory, titul: i => `Sloupek ${i + 1}`, pary: [['x', 'x od rohu desky'], ['y', 'y od rohu desky']], nove: () => [5, 5] },
    montaz: { el: 'seznamMontaz', data: () => p.montaz.otvory, titul: i => `Otvor ${i + 1}`, pary: [['x', 'x'], ['y', 'y']], nove: () => [0, 0] },
    konektory: {
      el: 'seznamKonektory', data: () => p.konektory, titul: (i, k) => `${i + 1}. ${esc(k.nazev)}`,
      pole: [
        { k: 'nazev', l: 'Název', typ: 'text', siroke: true },
        { k: 'plocha', l: 'Plocha', moznosti: PLOCHY_STENY },
        { k: 'vztah', l: 'Vazba', moznosti: [['krabicka', 'ke krabičce'], ['deska', 'k desce']] },
        { k: 'u', l: 'u', mm: true }, { k: 'v', l: 'v', mm: true },
        { k: 'sirka', l: 'Šířka', mm: true }, { k: 'vyska', l: 'Výška', mm: true }, { k: 'zaobleni', l: 'Zaoblení', mm: true },
      ],
      nove: () => { const t = $('selKonektor').value, d = KRAB.KONEKTORY[t];
        return { nazev: d.nazev, typ: t, plocha: 'x-', vztah: p.deska.pouzit ? 'deska' : 'krabicka', u: p.deska.pouzit ? p.deska.sirka / 2 : 0, v: p.deska.pouzit ? d.vyska / 2 : 10, sirka: d.sirka, vyska: d.vyska, zaobleni: d.zaobleni }; },
    },
    pruchodky: {
      el: 'seznamPruchodky', data: () => p.pruchodky, titul: (i, k) => `${i + 1}. ${esc((KRAB.PRUCHODKY[k.typ] || KRAB.PRUCHODKY.vlastni).nazev)}`,
      pole: [
        { k: 'typ', l: 'Typ', moznosti: Object.entries(KRAB.PRUCHODKY).map(([k, d]) => [k, d.nazev]), priZmene: (q, i) => { const d = KRAB.PRUCHODKY[q.pruchodky[i].typ]; if (d && q.pruchodky[i].typ !== 'vlastni') q.pruchodky[i].prumer = d.prumer; } },
        { k: 'plocha', l: 'Plocha', moznosti: PLOCHY_STENY },
        { k: 'u', l: 'u', mm: true }, { k: 'v', l: 'v', mm: true }, { k: 'prumer', l: 'Průměr', mm: true },
      ],
      nove: () => { const t = $('selPruchodka').value; return { typ: t, plocha: 'x+', u: 0, v: Math.max(6, p.vnitrni.vyska / 2), prumer: KRAB.PRUCHODKY[t].prumer }; },
    },
    vetrani: {
      el: 'seznamVetrani', data: () => p.vetrani, titul: (i, k) => `${i + 1}. ${k.pocet}× štěrbina – ${esc(KRAB.NAZVY_PLOCH[k.plocha])}`,
      pole: [
        { k: 'plocha', l: 'Plocha', moznosti: PLOCHY_STENY },
        { k: 'orientace', l: 'Štěrbiny', moznosti: [['svisle', 'svislé / podél Y'], ['vodorovne', 'vodorovné / podél X']] },
        { k: 'pocet', l: 'Počet', cele: true }, { k: 'sirka', l: 'Šířka', mm: true }, { k: 'delka', l: 'Délka', mm: true },
        { k: 'rozestup', l: 'Rozteč', mm: true }, { k: 'u', l: 'u středu', mm: true }, { k: 'v', l: 'v středu', mm: true },
      ],
      nove: () => ({ plocha: 'y-', u: 0, v: Math.max(5, p.vnitrni.vyska / 2), pocet: 5, sirka: 2, delka: Math.min(10, p.vnitrni.vyska * 0.4), rozestup: 5, orientace: 'svisle' }),
    },
  };
  function vykresliSeznamy() {
    for (const [klic, s] of Object.entries(SEZNAMY)) {
      const data = s.data(), el = $(s.el);
      if (!data.length) { el.innerHTML = '<div class="prazdny">Žádné položky.</div>'; continue; }
      el.innerHTML = data.map((it, i) => {
        let h = `<div class="polozka" data-seznam="${klic}" data-i="${i}"><div class="hlav"><span>${s.titul(i, it)}</span>`
          + `<button class="male smaz" data-smaz="${klic}" data-i="${i}" aria-label="Odebrat položku ${i + 1}" title="Odebrat">✕</button></div><div class="mrizka">`;
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
  document.addEventListener('input', e => {
    const el = e.target; if (!el.dataset || !el.dataset.sez || el.tagName === 'SELECT') return;
    const i = +el.dataset.i;
    if (el.dataset.text) { zmen(q => { cesta(q, el.dataset.sez)[i][el.dataset.k] = el.value; }, "seznam"); return; }
    const h = ctiCislo(el.value);
    if (!Number.isFinite(h)) { el.classList.add('spatne'); return; }
    el.classList.remove('spatne');
    zmen(q => { const it = cesta(q, el.dataset.sez)[i]; if (el.dataset.j !== undefined) it[+el.dataset.j] = h; else it[el.dataset.k] = h; }, 'seznam');
  });
  document.addEventListener('change', e => {
    const el = e.target; if (!el.dataset || !el.dataset.sez || el.tagName !== 'SELECT') return;
    const s = SEZNAMY[el.dataset.sez], i = +el.dataset.i, f = s.pole.find(x => x.k === el.dataset.k);
    zmen(q => { cesta(q, el.dataset.sez)[i][el.dataset.k] = el.value; if (f && f.priZmene) f.priZmene(q, i); }, 'seznam');
    vykresliSeznamy();
  });
  function cesta(q, klic) {
    return { diry: q.deska.otvory, montaz: q.montaz.otvory, konektory: q.konektory, pruchodky: q.pruchodky, vetrani: q.vetrani }[klic];
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.smaz) { const k = b.dataset.smaz, i = +b.dataset.i; zmen(q => cesta(q, k).splice(i, 1), 'seznam'); vykresliSeznamy(); }
    if (b.dataset.pridej) { const k = b.dataset.pridej; const it = SEZNAMY[k].nove(); zmen(q => cesta(q, k).push(it), 'seznam'); vykresliSeznamy(); }
    if (b.dataset.pohled && nahled) nahled.pohled(b.dataset.pohled);
  });
  $('selKonektor').innerHTML = Object.entries(KRAB.KONEKTORY).map(([k, d]) => `<option value="${k}">${esc(d.nazev)} (${fmt(d.sirka)} × ${fmt(d.vyska)})</option>`).join('');
  $('selPruchodka').innerHTML = Object.entries(KRAB.PRUCHODKY).map(([k, d]) => `<option value="${k}">${esc(d.nazev)} – Ø ${fmt(d.prumer)}</option>`).join('');

  /* ---------- změny, zpět/znovu ---------- */
  let posledniKlic = null, posledniCas = 0;
  function zmen(fn, klic) {
    const pred = JSON.stringify(p);
    const q = KRAB.kopie(p); fn(q);
    const r = KRAB.normalizuj(q);
    // souvislé psaní do jednoho pole = jeden krok zpět
    const now = Date.now();
    if (!(klic && klic === posledniKlic && now - posledniCas < 1500 && klic !== 'seznam')) { historie.push(pred); if (historie.length > 100) historie.shift(); }
    posledniKlic = klic; posledniCas = now;
    budoucnost.length = 0;
    p = r.p; hlaseniVstupu = r.hlaseni;
    viditelnost();
    naplanuj();
  }
  function zpet() { if (!historie.length) return; budoucnost.push(JSON.stringify(p)); p = JSON.parse(historie.pop()); posledniKlic = null; naplnFormular(); naplanuj(); }
  function znovu() { if (!budoucnost.length) return; historie.push(JSON.stringify(p)); p = JSON.parse(budoucnost.pop()); posledniKlic = null; naplnFormular(); naplanuj(); }
  $('btnZpet').onclick = zpet; $('btnZnovu').onclick = znovu;

  let casovac = null;
  function naplanuj() {
    $('btnZpet').disabled = !historie.length; $('btnZnovu').disabled = !budoucnost.length;
    clearTimeout(casovac); casovac = setTimeout(prestav, 160);
    souhrny();
  }

  /* ---------- přestavba modelu ---------- */
  function prestav() {
    ulozMistne();
    kontrolyModelu = KRAB.kontroly(p);
    if (!wasm) { vypisHlaseni(); return; }
    const stav = $('stav3d');
    try {
      const r = KRAB_GEO.postav(wasm, p);
      model = { dily: r.dily, cas: r.cas, kontroly: r.dily.map(d => KRAB.kontrolaSite(d.poz, d.idx)), odv: KRAB.odvozene(p) };
      chybaStavby = null;
      stav.textContent = ''; stav.classList.remove('chyba');
      if (nahled) nahled.nastavDily(model.dily, model.odv, p);
      $('tloustkyVysl').textContent = '';
    } catch (e) {
      chybaStavby = String(e && e.message || e);
      model = null;
      stav.textContent = 'Model nejde sestavit: ' + chybaStavby; stav.classList.add('chyba');
    }
    vypisVysledky();
    vypisHlaseni();
  }

  function souhrny() {
    const o = KRAB.odvozene(p);
    $('sRozmery').textContent = `${fmt(o.celkem[0])} × ${fmt(o.celkem[1])} × ${fmt(o.celkem[2])} mm`;
    $('vnejsiRozmery').textContent = `Vnější rozměry: ${fmt(o.Lo, 2)} × ${fmt(o.Wo, 2)} × ${fmt(o.Hb, 2)} mm (bez víka)` + (o.maViko ? `, s víkem ${fmt(o.Hb + o.Hv, 2)} mm.` : '.');
    $('sViko').textContent = { nasazovaci: 'nasazovací', sroubovaci: 'šroubované', zadne: 'bez víka' }[p.viko.typ];
    $('sDeska').textContent = p.deska.pouzit ? `${p.deska.nazev}, ${p.deska.otvory.length} sloupky` : 'bez desky';
    $('sMontaz').textContent = { zadne: 'žádná', usi: 'uši', dno: `${p.montaz.otvory.length} otvory ve dně` }[p.montaz.typ];
    $('sVyrezy').textContent = `${p.konektory.length} + ${p.pruchodky.length} + ${p.vetrani.length}`;
  }

  function vypisVysledky() {
    const el = $('vysledky');
    if (!model) { el.innerHTML = `<div class="box"><div class="popis">Stav</div><div class="cislo chyba-t">${wasm ? 'Chyba stavby' : 'Načítám…'}</div></div>`; return; }
    const o = model.odv;
    let h = `<div class="box"><div class="popis">Celkové rozměry</div><div class="cislo">${fmt(o.celkem[0])} × ${fmt(o.celkem[1])} × ${fmt(o.celkem[2])}</div><div class="dalsi">mm (X × Y × Z, sestava)</div></div>`;
    model.dily.forEach((d, i) => {
      const c = model.kontroly[i];
      const ok = c.uzavrena && c.normalyVen && c.teles === 1 && c.dutin === 0;
      const g = d.objem / 1000 * 1.24;
      h += `<div class="box"><div class="popis">${esc(d.nazev)}</div><div class="cislo ${ok ? 'ok-t' : 'chyba-t'}">${ok ? '✓ tisknutelné' : '✗ problém'}</div>`
        + `<div class="dalsi">${c.uzavrena ? 'uzavřená síť' : `<span class="chyba-t">otevřená síť (${c.hranOkrajovych} okr. hran)</span>`} · `
        + `${c.normalyVen ? 'normály ven' : '<span class="chyba-t">normály dovnitř</span>'}<br>`
        + `${c.teles} těleso${c.teles > 1 ? ' <span class="chyba-t">(víc těles!)</span>' : ''}${c.dutin ? ` · <span class="chyba-t">${c.dutin} uzavřené dutiny</span>` : ''} · otvorů (rod) ${c.rod}<br>`
        + `${c.trojuhelniku.toLocaleString('cs-CZ')} trojúhelníků · ${fmt(d.objem / 1000, 2)} cm³ ≈ ${fmt(g, 1)} g PLA (100 % výplň)</div></div>`;
    });
    h += `<div class="box"><div class="popis">Výpočet</div><div class="cislo">${model.cas} ms</div><div class="dalsi">manifold-3d, ${p.segmenty} segmentů na kružnici</div></div>`;
    el.innerHTML = h;
  }

  function vypisHlaseni() {
    const sez = [];
    if (chybaStavby) sez.push({ uroven: 'chyba', text: 'Geometrie: ' + chybaStavby });
    for (const t of hlaseniVstupu) sez.push({ uroven: 'varovani', text: 'Vstup opraven – ' + t });
    if (model) model.kontroly.forEach((c, i) => {
      const jm = model.dily[i].nazev;
      if (!c.uzavrena) sez.push({ uroven: 'chyba', text: `${jm}: síť není uzavřená – export se nedoporučuje.` });
      if (c.teles > 1) sez.push({ uroven: 'chyba', text: `${jm}: obsahuje ${c.teles} oddělená tělesa (volně ležící kusy) – zkontrolujte kolize prvků.` });
      if (c.dutin) sez.push({ uroven: 'varovani', text: `${jm}: ${c.dutin} uzavřené vnitřní dutiny (např. díra sloupku ukrytá uvnitř rohového sloupku).` });
    });
    sez.push(...kontrolyModelu);
    const poradi = { chyba: 0, varovani: 1, info: 2 };
    sez.sort((a, b) => poradi[a.uroven] - poradi[b.uroven]);
    if (!sez.some(h => h.uroven !== 'info')) sez.unshift({ uroven: 'ok', text: 'Bez chyb a varování.' });
    const ikona = { chyba: '⛔ ', varovani: '⚠️ ', info: 'ℹ️ ', ok: '✓ ' };
    $('hlaseni').innerHTML = sez.map(h => `<li class="${h.uroven}">${ikona[h.uroven]}${esc(h.text)}</li>`).join('');
  }

  /* ---------- tloušťky ---------- */
  $('btnTloustky').onclick = () => {
    if (!model) return;
    const el = $('tloustkyVysl'); el.textContent = 'Počítám…';
    setTimeout(() => {
      const t0 = performance.now(), body = [], texty = [];
      for (const d of model.dily) {
        const r = KRAB.tloustky(d.poz, d.idx, { vzorku: 2500, limit: p.minTloustka });
        r.tenke.forEach(b => { const q = b.slice(0, 3); q.dil = d.jmeno; body.push(q); });
        texty.push(`${d.nazev}: min ${fmt(r.min, 2)} mm` + (r.tenke.length ? ` (${r.tenke.length} míst pod ${fmt(p.minTloustka, 2)} mm)` : ''));
      }
      if (nahled) nahled.oznacTenke(body);
      el.innerHTML = esc(texty.join(' · ')) + ` <span class="${body.length ? 'mez-t' : 'ok-t'}">${body.length ? '– tenká místa jsou v náhledu červeně' : '✓'}</span> (${Math.round(performance.now() - t0)} ms)`;
    }, 20);
  };

  /* ---------- export ---------- */
  function stahni(data, jmeno, typ) {
    const url = URL.createObjectURL(new Blob([data], { type: typ }));
    const a = document.createElement('a'); a.href = url; a.download = jmeno; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  const slug = () => (p.nazev || 'krabicka').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase() || 'krabicka';
  async function pripravExport(jmena) {
    if (!model) { Dialog.chyba('Model není sestavený.'); return null; }
    const vybrane = model.dily.map((d, i) => ({ d, c: model.kontroly[i] })).filter(x => jmena.includes(x.d.jmeno));
    if (!vybrane.length) { Dialog.chyba('Díl neexistuje.'); return null; }
    if (vybrane.some(x => !x.c.uzavrena || !x.c.normalyVen)) { Dialog.chyba('Síť neprošla kontrolou těsnosti – export zablokován.'); return null; }
    const chyby = kontrolyModelu.filter(h => h.uroven === 'chyba').length + vybrane.filter(x => x.c.teles > 1).length;
    if (chyby && !(await Dialog.potvrd(`Model má ${chyby} chyb v kontrolách (viz Hlášení). Přesto exportovat?`))) return null;
    let dily = vybrane.map(x => x.d);
    if ($('chkTisk').checked) dily = KRAB.tiskoveRozlozeni(dily);
    return dily;
  }
  async function exportStl(jmena, pripona) {
    const dily = await pripravExport(jmena); if (!dily) return;
    stahni(KRAB.stlBinarni(dily, 'krabicky: ' + slug()), `${slug()}${pripona}.stl`, 'model/stl');
    Dialog.info('STL uloženo.');
  }
  $('btnStlKrab').onclick = () => exportStl(['krabicka'], '_krabicka');
  $('btnStlViko').onclick = () => exportStl(['viko'], '_viko');
  $('btnStlVse').onclick = () => exportStl(['krabicka', 'viko'], '');
  $('btn3mf').onclick = async () => {
    const dily = await pripravExport(['krabicka', 'viko']); if (!dily) return;
    const barvy = { krabicka: '#4F86D9', viko: '#E0A63F' };
    stahni(KRAB.soubor3mf(dily.map(d => Object.assign({ barva: barvy[d.jmeno] }, d)), p.nazev), `${slug()}.3mf`, 'model/3mf');
    Dialog.info('3MF uloženo.');
  };
  $('btnPng').onclick = () => {
    if (!nahled) return;
    const url = nahled.snimekPNG();
    const a = document.createElement('a'); a.href = url; a.download = `${slug()}.png`; document.body.appendChild(a); a.click(); a.remove();
  };

  /* ---------- projekt ---------- */
  $('selPredvolba').innerHTML = Object.entries(KRAB.PREDVOLBY).map(([k, d]) => `<option value="${k}">${esc(d.nazev)}</option>`).join('');
  const ukazZdroj = () => { const d = KRAB.PREDVOLBY[$('selPredvolba').value]; $('zdrojPredvolby').textContent = d && d.zdroj ? 'Zdroj rozměrů: ' + d.zdroj : ''; };
  $('selPredvolba').onchange = ukazZdroj;
  function vyberPredvolbu() {
    const shoda = Object.keys(KRAB.PREDVOLBY).find(k => k !== 'prazdna' && p.deska.pouzit && p.deska.nazev === KRAB.vychoziProjekt(k).deska.nazev);
    $('selPredvolba').value = shoda || 'prazdna';
    ukazZdroj();
  }
  $('btnPredvolba').onclick = async () => {
    const k = $('selPredvolba').value;
    if (!(await Dialog.potvrd(`Použít předvolbu „${KRAB.PREDVOLBY[k].nazev}“? Přepíše desku, rozměry dutiny a výřezy (víko, stěny a tolerance zůstanou).`))) return;
    zmen(q => {
      const n = KRAB.vychoziProjekt();
      n.stena = q.stena; n.dno = q.dno; n.zaobleni = q.zaobleni; n.segmenty = q.segmenty; n.tolerance = q.tolerance;
      n.tryska = q.tryska; n.minTloustka = q.minTloustka; n.viko = q.viko; n.montaz = q.montaz; n.nazev = q.nazev;
      KRAB.PREDVOLBY[k].uprav(n);
      if (k !== 'prazdna') n.nazev = 'Krabička – ' + KRAB.PREDVOLBY[k].nazev;
      Object.keys(q).forEach(x => delete q[x]); Object.assign(q, n);
    }, 'predvolba');
    naplnFormular();
  };
  $('btnPodleDesky').onclick = () => {
    zmen(q => {
      const d = q.deska, okraj = 1.5;
      const presahX = Math.max(0, d.x);
      q.vnitrni.delka = Math.round((presahX + d.delka + okraj) * 10) / 10;
      d.y = okraj; q.vnitrni.sirka = Math.round((d.sirka + 2 * okraj) * 10) / 10;
      q.vnitrni.vyska = Math.ceil(d.sloupky.vyska + d.tloustka + d.vyskaSoucastek + 1);
    }, 'podle');
    naplnFormular();
  };
  $('btnUlozit').onclick = () => { stahni(KRAB.ulozProjekt(p), `${slug()}.json`, 'application/json'); Dialog.info('Projekt uložen.'); };
  $('btnNacist').onclick = () => $('soubor').click();
  $('soubor').onchange = async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const r = KRAB.nactiProjekt(await f.text());
      zmen(q => { Object.keys(q).forEach(x => delete q[x]); Object.assign(q, r.p); }, 'nacist');
      hlaseniVstupu = r.hlaseni;
      naplnFormular();
      Dialog.info(r.hlaseni.length ? `Projekt načten, ${r.hlaseni.length} hodnot opraveno (viz Hlášení).` : 'Projekt načten.');
    } catch (err) { Dialog.chyba(err.message); }
  };

  /* ---------- náhled: přepínače ---------- */
  function prepinac(id, fn) {
    const b = $(id);
    b.onclick = () => { const v = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(v)); if (nahled) fn(v); };
  }
  prepinac('tPruhledne', v => nahled.pruhledne(v));
  prepinac('tRozlozit', v => nahled.rozlozit(v));
  prepinac('tDeska', v => nahled.deska(v));
  prepinac('tKoty', v => nahled.koty(v));
  prepinac('tMerit', v => nahled.mereni(v));
  $('tRez').onchange = () => { $('rRez').disabled = !$('tRez').checked; if (nahled) nahled.rez($('tRez').checked ? $('rRez').value / 100 : null); };
  $('rRez').oninput = () => { if (nahled && $('tRez').checked) nahled.rez($('rRez').value / 100); };

  document.addEventListener('keydown', e => {
    const t = e.target;
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !(t && /INPUT|SELECT|TEXTAREA/.test(t.tagName))) { e.preventDefault(); e.shiftKey ? znovu() : zpet(); return; }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY' && !(t && /INPUT|SELECT|TEXTAREA/.test(t.tagName))) { e.preventDefault(); znovu(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || (t && /INPUT|SELECT|TEXTAREA/.test(t.tagName)) || document.querySelector('dialog[open]')) return;
    const pohledy = { Digit1: 'izo', Digit2: 'shora', Digit3: 'zepredu', Digit4: 'zboku', Numpad1: 'izo', Numpad2: 'shora', Numpad3: 'zepredu', Numpad4: 'zboku' };
    if (pohledy[e.code] && nahled) { nahled.pohled(pohledy[e.code]); return; }
    if (e.code === 'KeyT') $('tPruhledne').click();
    else if (e.code === 'KeyE') $('tRozlozit').click();
    else if (e.code === 'KeyM') $('tMerit').click();
    else if (e.code === 'Escape' && nahled) nahled.smazMereni();
  });

  /* ---------- start ---------- */
  p = nactiUlozeny();
  naplnFormular();
  vyberPredvolbu();
  souhrny();
  kontrolyModelu = KRAB.kontroly(p);
  vypisVysledky(); vypisHlaseni();
  nactiManifold().then(w => { wasm = w; prestav(); }).catch(e => {
    const st = $('stav3d'); st.textContent = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e); st.classList.add('chyba');
    chybaStavby = 'manifold-3d se nenačetl – model ani export nejsou k dispozici.';
    vypisHlaseni();
  });
  // pro testy
  window.__krabicky = { get p() { return p; }, get model() { return model; }, get nahled() { return nahled; }, zmen, prestav };
})();
