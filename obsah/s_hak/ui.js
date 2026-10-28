/* S hák – ovládání stránky: formulář, historie, nabídky, paleta a editor průřezu, kresby, export. */
/* global SHAK, SHAK_NAHLED, SHAK_EDITOR, KRAB, Dialog, Tvary */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const KLIC = 'webapp_s_hak_projekt';
  const fmt = SHAK.fmt;

  const PREDVOLBY = [
    { nazev: 'Šatní tyč 25 mm → ramínko', popis: 'Ø 25 nahoře, Ø 8 dole (drát ramínka), deska se žebrem',
      p: { trubka1: 25, trubka2: 8, presah: 2.5, presah2: 0.4, roztec: 55, prurez: { typ: 'zebro', sirka: 10, vyska: 5, deska: 2, zebro: 5 } } },
    { nazev: 'Kuchyňská hrazdička 16 mm', popis: 'Ø 16 / Ø 16, malý hák na utěrky a naběračky',
      p: { trubka1: 16, trubka2: 16, presah: 2, presah2: 2, roztec: 50, prurez: { typ: 'zebro', sirka: 8, vyska: 4, deska: 1.8, zebro: 4 } } },
    { nazev: 'Garážová tyč 32 mm → kbelík', popis: 'Ø 32 / Ø 12, deska s kýlem 45° pro větší zatížení (tiskne se bez podpor)',
      p: { trubka1: 32, trubka2: 12, presah: 3, presah2: 0.7, roztec: 75, prurez: { typ: 'kyl', sirka: 14, vyska: 7, deska: 2.5, zebro: 4 } } },
    { nazev: 'Dvě trubky 25 mm (náčrt)', popis: 'Ø 25 / Ø 25, otvor S − 3, výchozí tvar',
      p: { trubka1: 25, trubka2: 25, presah: 3, presah2: 3, roztec: 70, prurez: { typ: 'zebro', sirka: 12, vyska: 5, deska: 2.2, zebro: 6 } } },
    { nazev: 'Zábradlí 42 mm → květináč', popis: 'Ø 42 / Ø 20, dvě žebra',
      p: { trubka1: 42, trubka2: 20, presah: 4, presah2: 2, roztec: 90, prurez: { typ: 'dvojite', sirka: 16, vyska: 6, deska: 2.5, zebro: 5 } } },
    { nazev: 'Malý háček Ø 10 / Ø 6', popis: 'kulatý průřez 5 mm, třeba na ramínka nebo kuchyňské náčiní',
      p: { trubka1: 10, trubka2: 6, presah: 0.8, presah2: 0.4, roztec: 36, prurez: { typ: 'elipsa', sirka: 5, vyska: 5 } } },
  ];

  /* ---------- stav a historie ---------- */
  let p, model = null, pev = null;
  const zpet = [], znovu = [];
  function nactiUlozeny() {
    try {
      const t = localStorage.getItem(KLIC);
      if (t) { const r = SHAK.normalizuj(JSON.parse(t)); hlasPrevod(r.hlaseni, 'Uložený hák'); return r.p; }
    } catch (e) { /* poškozený záznam */ }
    return SHAK.normalizuj({}).p;
  }
  /** Hlášení z normalizace (převod starších dat, omezené hodnoty) – uživatel musí vědět, že se něco změnilo. */
  function hlasPrevod(hlaseni, co) { if (hlaseni && hlaseni.length) setTimeout(() => Dialog.info(`${co} upraven: ${hlaseni.join('; ')}.`), 300); }
  function uloz() { try { localStorage.setItem(KLIC, JSON.stringify(p)); } catch (e) { /* plné úložiště */ } }
  function zmen(fn, slouceni) {
    const pred = JSON.stringify(p);
    fn(p);
    p = SHAK.normalizuj(p).p;
    if (JSON.stringify(p) === pred) return;
    const posl = zpet[zpet.length - 1];
    if (!(slouceni && posl && posl.klic === slouceni && Date.now() - posl.cas < 1200)) zpet.push({ stav: pred, klic: slouceni, cas: Date.now() });
    else posl.cas = Date.now();
    if (zpet.length > 100) zpet.shift();
    znovu.length = 0;
    po();
  }
  function krokHistorie(z, do_) {
    if (!z.length) return;
    do_.push({ stav: JSON.stringify(p), cas: 0 });
    p = SHAK.normalizuj(JSON.parse(z.pop().stav)).p;
    naplnFormular(); po();
  }
  function po() {
    $('btnZpet').disabled = !zpet.length; $('btnZnovu').disabled = !znovu.length;
    uloz(); prepocitej();
  }

  /* ---------- formulář ---------- */
  const pole = [...document.querySelectorAll('[data-p]')];
  function naplnFormular() {
    for (const el of pole) {
      const h = SHAK.vezmi(p, el.dataset.p);
      if (el.type === 'checkbox') el.checked = !!h;
      else if (document.activeElement !== el) el.value = el.dataset.typ === 'text' ? (h ?? '') : String(h).replace('.', ',');
      el.classList.remove('spatne');
    }
    $('f_body').value = editor.bodyNaText(p.prurez.vlastni);
    oznacPaletu();
    kresliPrurez();
  }
  for (const el of pole) {
    const akce = () => {
      const c = el.dataset.p;
      let h;
      if (el.type === 'checkbox') h = el.checked;
      else if (el.dataset.typ === 'text') h = el.value;
      else {
        h = SHAK.cislo(el.value, NaN);
        el.classList.toggle('spatne', !Number.isFinite(h));
        if (!Number.isFinite(h)) return;
      }
      zmen(x => SHAK.poloz(x, c, h), c);
    };
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', akce);
    if (el.tagName === 'INPUT' && el.type !== 'checkbox') el.addEventListener('change', () => {
      // po potvrzení ukázat hodnotu, se kterou model opravdu počítá (omezení rozsahu), a upozornit na ni
      const psano = SHAK.cislo(el.value, NaN), h = SHAK.vezmi(p, el.dataset.p);
      naplnFormular();
      if (el.dataset.typ !== 'text' && typeof h === 'number') {
        el.value = String(h).replace('.', ',');
        const rozsah = SHAK.ROZSAHY[el.dataset.p];
        if (Number.isFinite(psano) && Math.abs(psano - h) > 1e-9 && rozsah) {
          el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
          Dialog.info(`${el.labels[0] ? el.labels[0].textContent : 'Hodnota'}: omezeno na ${fmt(rozsah[0], 2)}–${fmt(rozsah[1], 2)}, použito ${fmt(h, 2)}.`);
        }
      }
    });
  }
  // ↑/↓ v číselném poli: ± 1, Shift × 10, Alt po 0,1 (jako v CAD programech)
  for (const el of pole) if (el.tagName === 'INPUT' && el.type === 'text' && el.dataset.typ !== 'text') el.addEventListener('keydown', e => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    const h = SHAK.cislo(el.value, NaN); if (!Number.isFinite(h)) return;
    e.preventDefault();
    const krok = (e.shiftKey ? 10 : e.altKey ? 0.1 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
    el.value = fmt(Math.round((h + krok) * 1000) / 1000, 3);
    el.dispatchEvent(new Event('input'));
  });
  $('f_mat').innerHTML = Object.entries(SHAK.MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev} – ${m.pevnost} MPa</option>`).join('');

  /* ---------- barvy a plátna ---------- */
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function pripravPlatno(c) {
    const dpr = window.__dprTisk || Math.min(window.devicePixelRatio || 1, 3), w = c.clientWidth || 300, h = c.clientHeight || 150;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    return { g, w, h };
  }
  /** Měřítko, aby obdélník [x0,y0,x1,y1] (mm) se vešel; osa y míří nahoru, pokud dolu = false. */
  function meritko(b, w, h, okraj, dolu) {
    const s = Math.min((w - 2 * okraj) / Math.max(1e-6, b[2] - b[0]), (h - 2 * okraj) / Math.max(1e-6, b[3] - b[1]));
    const ox = (w - s * (b[2] - b[0])) / 2 - s * b[0], oy = (h - s * (b[3] - b[1])) / 2;
    return { s, X: x => ox + s * x, Y: dolu ? y => oy + s * (y - b[1]) : y => h - (oy + s * (y - b[1])) };
  }

  /* ---------- obrys háku v rovině (pro kresbu i SVG) ---------- */
  function obrysHaku(m) {
    const A = [], B = [];
    for (const st of m.S) {
      const Q = SHAK.prolnutyPrurez(m.pr, st.w);
      let lo = Infinity, hi = -Infinity; for (const q of Q) { lo = Math.min(lo, q[1]); hi = Math.max(hi, q[1]); }
      const E = [-st.t[1] * m.tr.E0, st.t[0] * m.tr.E0];
      A.push([st.p[0] + E[0] * lo, st.p[1] + E[1] * lo]); B.push([st.p[0] + E[0] * hi, st.p[1] + E[1] * hi]);
    }
    return A.concat(B.reverse());
  }
  const trubky = m => [[m.tr.C1, m.p.trubka1], [m.tr.C2, m.p.trubka2]];
  function hraniceTrasy(m, obr) {
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    const pridej = (x, y) => { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); };
    obr.forEach(q => pridej(q[0], q[1]));
    for (const [C, D] of trubky(m)) { pridej(C[0] - D / 2, C[1] - D / 2); pridej(C[0] + D / 2, C[1] + D / 2); }
    return b;
  }
  /** Úsečky otvorů: špička → pata na rovném středu. */
  function otvory(m) {
    const tr = m.tr, out = [];
    for (const [C, r, a, T] of [[tr.C1, tr.r1, tr.a1 - tr.s1 * tr.W1, tr.T1], [tr.C2, tr.r2, tr.a2 + tr.s2 * tr.W2, tr.T2]]) {
      const tip = [C[0] + r * Math.cos(a), C[1] + r * Math.sin(a)];
      const s = (tip[0] - T[0]) * tr.t[0] + (tip[1] - T[1]) * tr.t[1];
      out.push([tip, [T[0] + tr.t[0] * s, T[1] + tr.t[1] * s]]);
    }
    return out;
  }

  function kresliTrasu() {
    const c = $('cTrasa'), { g, w, h } = pripravPlatno(c);
    if (!model || model.chyba) { g.fillStyle = css('--text-muted'); g.font = '13px sans-serif'; g.fillText('Trasu nelze sestavit.', 12, 22); return; }
    const obr = obrysHaku(model), b = hraniceTrasy(model, obr), M = meritko(b, w, h, 22, false);
    // trubky
    g.setLineDash([4, 3]); g.strokeStyle = css('--text-muted'); g.lineWidth = 1;
    for (const [C, D] of trubky(model)) {
      g.beginPath(); g.arc(M.X(C[0]), M.Y(C[1]), D / 2 * M.s, 0, 2 * Math.PI); g.stroke();
      g.beginPath(); g.moveTo(M.X(C[0]) - 6, M.Y(C[1])); g.lineTo(M.X(C[0]) + 6, M.Y(C[1])); g.moveTo(M.X(C[0]), M.Y(C[1]) - 6); g.lineTo(M.X(C[0]), M.Y(C[1]) + 6); g.stroke();
    }
    g.setLineDash([]);
    g.beginPath(); obr.forEach((q, i) => (i ? g.lineTo : g.moveTo).call(g, M.X(q[0]), M.Y(q[1]))); g.closePath();
    g.fillStyle = css('--accent-soft'); g.fill(); g.strokeStyle = css('--accent'); g.lineWidth = 1.5; g.stroke();
    // úsek prolnutí
    const tr = model.tr, pz = s => [tr.T1[0] + tr.t[0] * s, tr.T1[1] + tr.t[1] * s];
    g.strokeStyle = css('--warn'); g.lineWidth = 3;
    const a = pz(model.z0), bb = pz(model.z1);
    g.beginPath(); g.moveTo(M.X(a[0]), M.Y(a[1])); g.lineTo(M.X(bb[0]), M.Y(bb[1])); g.stroke();
    // otvory
    g.strokeStyle = css('--danger'); g.lineWidth = 1.2; g.font = '11px sans-serif'; g.fillStyle = css('--text');
    // popisek otvoru za špičkou (ven od trubky), průměr pod středem trubky – nepřekrývají se
    otvory(model).forEach(([q, r], i) => {
      g.beginPath(); g.moveTo(M.X(q[0]), M.Y(q[1])); g.lineTo(M.X(r[0]), M.Y(r[1])); g.stroke();
      const C = i ? tr.C2 : tr.C1, ven = [q[0] - C[0], q[1] - C[1]], l = Math.hypot(...ven) || 1;
      const t = `otvor ${fmt(i ? tr.otvSkut2 : tr.otvSkut1)}`, tw = g.measureText(t).width;
      const x = M.X(q[0]) + ven[0] / l * 14, y = M.Y(q[1]) - ven[1] / l * 14;
      g.fillText(t, ven[0] < 0 ? x - tw : x, y + 4);
    });
    g.fillStyle = css('--text-muted');
    trubky(model).forEach(([C, D]) => { const t = `Ø ${fmt(D)}`; g.fillText(t, M.X(C[0]) - g.measureText(t).width / 2, M.Y(C[1]) + 16); });
    g.fillText(`rozteč ${fmt(model.p.roztec)} mm`, 8, h - 8);
    g.fillStyle = css('--warn'); g.fillText('▬ prolnutí žebra', w - 100, h - 8);
  }

  /* ---------- kresba a editor průřezu (editor.js) ---------- */
  const editor = SHAK_EDITOR.vytvorEditor({ $, ziskej: () => p, zmen, obnov: () => naplnFormular(), css, fmt });
  const kresliPrurez = () => { editor.kresli(); editor.oznac(); };
  $('btnNaVlastni').addEventListener('click', () => { zmen(x => { x.prurez.vlastni = SHAK.naVlastni(x); x.prurez.typ = 'vlastni'; }); naplnFormular(); });
  $('selZPalety').innerHTML = Object.entries(SHAK.TYPY).filter(([t]) => t !== 'vlastni').map(([t, x]) => `<option value="${t}">${x.nazev}</option>`).join('');
  $('btnZPalety').addEventListener('click', () => {
    const typ = $('selZPalety').value;
    zmen(x => { x.prurez.vlastni = SHAK.naVlastni(Object.assign({}, x, { prurez: Object.assign({}, x.prurez, { typ }) })); });
    naplnFormular();
  });
  $('btnVzorVl').addEventListener('click', () => { zmen(x => { x.prurez.vlastni = SHAK.kopie(SHAK.VLASTNI_VZOR); }); naplnFormular(); });

  /* ---------- paleta ---------- */
  const paleta = $('paleta');
  for (const [typ, t] of Object.entries(SHAK.TYPY)) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.typ = typ; b.title = t.nazev;
    b.innerHTML = `<canvas></canvas><span>${t.nazev} <b class="tisk-ok" aria-label="tiskne se bez podpor" hidden>✓</b></span>`;
    // typy, kde pole znamená něco jiného (bočnice U, hřbet kýlů), dostanou při výběru rozumnou výchozí hodnotu
    b.addEventListener('click', () => { zmen(x => { if (x.prurez.typ !== typ) Object.assign(x.prurez, t.vychozi || {}); x.prurez.typ = typ; }); naplnFormular(); });
    paleta.appendChild(b);
  }
  function kresliPaletu() {
    for (const b of paleta.children) {
      const c = b.querySelector('canvas'), { g, w, h } = pripravPlatno(c);
      // typické rozměry palety (ne aktuální – při 5 × 5 by T profil vypadal jako čtverec); vlastní kreslí aktuální body
      const typ = b.dataset.typ, zaklad = typ === 'vlastni' ? p.prurez : Object.assign({}, SHAK.VYCHOZI.prurez, SHAK.TYPY[typ].vychozi || {}, SHAK.TYPY[typ].vzor || {}, { vlastni: p.prurez.vlastni });
      const pr = SHAK.prurez(Object.assign({}, p, { prurez: Object.assign({}, zaklad, { typ }), tisk: { srazit: 0, krok: 3 } }));
      if (pr.chyba) continue;
      const M = meritko([0, 0, pr.sirka, pr.vyska], w, h, 3, true);
      g.beginPath(); pr.body.forEach((q, i) => (i ? g.lineTo : g.moveTo).call(g, M.X(q[0]), M.Y(q[1]))); g.closePath();
      g.fillStyle = css('--accent'); g.fill();
      // ✓ = tiskne se bez podpor i bez doplňování převisů (podle skutečného obrysu a nastaveného úhlu)
      if (typ !== 'vlastni') {
        const prBez = SHAK.prurez(Object.assign({}, p, { prurez: Object.assign({}, zaklad, { typ }), tisk: Object.assign({}, p.tisk, { bezPodpor: false, srazit: 0, plocha: 0 }) }));
        const ok = !prBez.chyba && SHAK.previsy(prBez, p.tisk.uhel).delka <= 0.2;
        b.querySelector('.tisk-ok').hidden = !ok;
        b.title = SHAK.TYPY[typ].nazev + (ok ? ' – tiskne se bez podpor i bez doplňování převisů' : ' – bez podpor jen s doplněním převisů');
      }
    }
  }
  function oznacPaletu() {
    for (const b of paleta.children) b.setAttribute('aria-pressed', String(b.dataset.typ === p.prurez.typ));
    const pole = SHAK.TYPY[p.prurez.typ].pole;
    const typ = p.prurez.typ;
    for (const el of document.querySelectorAll('#gPrurez [data-pole]')) el.hidden = !(pole.includes(el.dataset.pole) || (el.dataset.pole === 'vl' && typ === 'vlastni'));
    $('lZebro').textContent = { lichobeznik: 'Šířka vnější strany', T: 'Šířka stojiny', U: 'Tloušťka bočnic', kyl: 'Šířka hřbetu kýlu', kyl2: 'Šířka hřbetu kýlů' }[typ] || 'Šířka žebra';
    $('lZaobleni').textContent = typ === 'zkoseny' ? 'Zkosení hran 45°' : 'Zaoblení hran';
    $('gVlastni').hidden = p.prurez.typ !== 'vlastni';
    $('gNeVlastni').hidden = p.prurez.typ === 'vlastni';
  }

  /* ---------- prolnutí v místě ---------- */
  function kresliProlnuti() {
    const c = $('cProlnuti'), { g, w, h } = pripravPlatno(c);
    const pr = model && !model.chyba ? model.pr : null;
    if (!pr) return;
    const t = +$('rMisto').value / 100;
    $('oMisto').textContent = Math.round(t * 100) + ' %';
    const wv = t <= 0 ? 0 : t >= 1 ? 1 : (x => x * x * x * (x * (6 * x - 15) + 10))(t);
    const M = meritko([-pr.sirka * 0.05, -pr.vyska * 1.1, pr.sirka * 1.05, pr.vyska * 1.1], w, h, 10, true);
    g.strokeStyle = css('--text-muted'); g.setLineDash([5, 4]);
    g.beginPath(); g.moveTo(0, M.Y(0)); g.lineTo(w, M.Y(0)); g.stroke(); g.setLineDash([]);
    const Q = SHAK.prolnutyPrurez(pr, wv);
    g.beginPath(); Q.forEach((q, i) => (i ? g.lineTo : g.moveTo).call(g, M.X(q[0]), M.Y(q[1]))); g.closePath();
    g.fillStyle = css('--accent-soft'); g.fill(); g.strokeStyle = css('--accent'); g.lineWidth = 1.6; g.stroke();
    g.fillStyle = css('--text-muted'); g.font = '11px sans-serif';
    g.fillText('líc háku (trasa)', 6, M.Y(0) - 4);
    g.fillText(t < 0.5 ? 'k trubce 1 ↑' : 'k trubce 2 ↓', w - 80, 14);
    g.fillText(`plocha ${fmt(Math.abs(SHAK.plochaPolygonu(Q)), 2)} mm²`, 6, h - 6);
  }
  $('rMisto').addEventListener('input', kresliProlnuti);

  /* ---------- výsledky ---------- */
  const box = (popis, cislo, dalsi, tr) => `<div class="dlazdice"><div class="popis">${popis}</div><div class="cislo ${tr || ''}">${cislo}</div>${dalsi ? `<div class="dalsi">${dalsi}</div>` : ''}</div>`;
  const deg = r => fmt(r * 180 / Math.PI, 0) + '°';
  function vypis(H, k) {
    const tr = model && model.tr;
    if (model && !model.chyba) {
      const pr = model.pr;
      $('vTrasa').innerHTML = box('Otvor horní / dolní', `${fmt(tr.otvSkut1)} / ${fmt(tr.otvSkut2)} mm`, 'nejužší místo kolmo na rovný střed')
        + box('Obtočení', `${deg(tr.W1)} / ${deg(tr.W2)}`, 'úhel oblouku kolem trubky')
        + box('Rovný střed', `${fmt(tr.L)} mm`, `volno pro prolnutí ${fmt(Math.max(0, tr.volno))} mm`)
        + box('Rozměr háku', `${fmt(k.bbox[3] - k.bbox[0])} × ${fmt(k.bbox[4] - k.bbox[1])} mm`, `tisková výška ${fmt(k.bbox[5] - k.bbox[2])} mm`);
      $('vPrurez').innerHTML = box('Průřez', `${fmt(pr.sirka)} × ${fmt(pr.vyska)} mm`, `plocha ${fmt(Math.abs(pr.plocha), 2)} mm²`)
        + box('Bodů obrysu', String(pr.body.length), SHAK.TYPY[p.prurez.typ].nazev);
      const mat = SHAK.MATERIALY[p.material];
      const objem = k.objem / 1000, hm = objem * mat.hustota;
      if (pev && pev.drzi) {
        const kg = SHAK.nosnost(pev, p.material, p.bezpecnost);
        $('vPevnost').innerHTML = box('Odhad nosnosti', `${fmt(kg, kg < 10 ? 2 : 1)} kg`, `${mat.nazev}, bezpečnost ${fmt(p.bezpecnost)} → ${fmt(kg * 9.81, 0)} N`, kg < 1 ? 'mez-t' : 'ok-t')
          + box('Napětí na 1 kg', `${fmt(pev.max * 9.81, 2)} MPa`, `nejvíc ${popisMista(pev.kde)}`)
          + box('Hmotnost', `${fmt(hm, 1)} g`, `objem ${fmt(objem, 2)} cm³`) + boxZacvaknuti(mat);
        $('sPevnost').textContent = `≈ ${fmt(kg, kg < 10 ? 1 : 0)} kg`;
      } else {
        $('vPevnost').innerHTML = box('Odhad nosnosti', '—', 'hák trubku nedrží', 'chyba-t') + box('Hmotnost', `${fmt(hm, 1)} g`, `objem ${fmt(objem, 2)} cm³`);
        $('sPevnost').textContent = '—';
      }
      const dobra = k.uzavrena && !k.degenerovanych;
      $('vSit').innerHTML = box('Síť', dobra ? 'uzavřená' : 'vadná', `${k.trojuhelniku.toLocaleString('cs-CZ')} trojúhelníků`, dobra ? 'ok-t' : 'chyba-t');
      $('sTrubky').textContent = `Ø ${fmt(p.trubka1)} / Ø ${fmt(p.trubka2)} · ${fmt(p.roztec)} mm`;
      $('sPrurez').textContent = `${SHAK.TYPY[p.prurez.typ].nazev} ${fmt(pr.sirka)} × ${fmt(pr.vyska)}`;
      $('sProlnuti').textContent = `${fmt(model.z1 - model.z0)} mm`;
      $('sZesileni').textContent = p.zesileni.max > 0 ? `+${fmt(p.zesileni.max)} mm od ${fmt(p.zesileni.prah, 0)} %` : 'vypnuto';
      $('sTisk').textContent = `${p.tisk.bezPodpor ? 'bez podpor' : 'převisy nedoplněné'}${p.tisk.kusu > 1 ? `, ${p.tisk.kusu} ks` : ''}`;
      $('sKonce').textContent = (p.konce.zaobleni ? 'oblé' : 'rovné') + (p.konce.naber ? `, náběh ${fmt(p.konce.naber)}°` : '');
    } else {
      for (const id of ['vTrasa', 'vPrurez', 'vPevnost', 'vSit']) $(id).innerHTML = '';
    }
    // hlášení
    const ul = $('hlaseni'); ul.innerHTML = '';
    for (const x of H) {
      const li = document.createElement('li'); li.className = x.uroven + (x.pole.length ? ' skok' : '');
      li.textContent = x.text;
      if (x.pole.length) {
        li.tabIndex = 0;
        const kam = document.createElement('span'); kam.className = 'kam'; kam.textContent = '→ upravit'; li.appendChild(kam);
        const jdi = () => jdiNaPole(x.pole[0]);
        li.addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') jdi(); });
        li.addEventListener('keydown', e => { if (e.key === 'Enter') jdi(); });
      }
      if (x.oprava) {
        const b = document.createElement('button'); b.className = 'tl oprava'; b.textContent = '🔧 ' + x.oprava.text;
        b.addEventListener('click', () => { zmen(q => SHAK.poloz(q, x.oprava.pole, x.oprava.hodnota)); naplnFormular(); });
        li.appendChild(b);
      }
      ul.appendChild(li);
    }
    const nch = H.filter(x => x.uroven === 'chyba').length, nv = H.filter(x => x.uroven === 'varovani').length;
    if (model && model.chyba) TrubkyGui.otevriZalozku('kontrola');   // model nejde sestavit – oprava musí být hned vidět
    const o = $('stavOdznak');
    o.className = 'odznak ' + (nch ? 'chyba' : nv ? 'mez' : 'ok');
    o.textContent = nch ? `✖ ${nch}` : nv ? `⚠ ${nv}` : '✔';
    const chyb = n => n === 1 ? 'chyba' : n < 5 ? 'chyby' : 'chyb';
    $('sKontrola').textContent = nch ? `${nch} ${chyb(nch)}` : nv ? `${nv} varování` : 'v pořádku';
  }
  function boxZacvaknuti(mat) {
    const z = SHAK.zacvaknuti(model), e = Math.max(z[0].eps, z[1].eps);
    return box('Protažení při zacvaknutí', `${fmt(z[0].eps, 2)} / ${fmt(z[1].eps, 2)} %`, `horní / dolní, mez ${mat.nazev} ≈ ${fmt(mat.mez)} %`,
      e > mat.mez ? 'chyba-t' : e > 0.7 * mat.mez ? 'mez-t' : 'ok-t');
  }
  /** Karta v rohu 3D: co to je, rozměry, hmotnost, nosnost, tisk. */
  function kartaNahledu(k) {
    const el = $('karta3d');
    if (!model || model.chyba || !k) { el.innerHTML = ''; return; }
    const mat = SHAK.MATERIALY[p.material], tr = model.tr;
    const kg = pev && pev.drzi ? SHAK.nosnost(pev, p.material, p.bezpecnost) : null;
    el.innerHTML = `<div class="titul">S hák · ${SHAK.TYPY[p.prurez.typ].nazev}</div>`
      + `<b>${fmt(k.bbox[3] - k.bbox[0])} × ${fmt(k.bbox[4] - k.bbox[1])} × ${fmt(k.bbox[5] - k.bbox[2])}</b> mm · <b>${fmt(k.objem / 1000 * mat.hustota, 1)}</b> g ${mat.nazev}<br>`
      + (kg ? `nosnost ≈ <b>${fmt(kg, kg < 10 ? 1 : 0)} kg</b> (bezpečnost ${fmt(p.bezpecnost)})<br>` : '')
      + `tisk naležato, výška <b>${fmt(k.bbox[5] - k.bbox[2])}</b> mm${SHAK.previsy(model.pr, p.tisk.uhel).delka <= 0.2 ? ', bez podpor' : ', <b>s podporami</b>'}`;
  }
  function popisMista(i) {
    if (i < 0) return '';
    const st = model.S[i];
    return st.w <= 0 ? 'na horním oblouku' : st.w >= 1 ? 'na dolním oblouku' : 'na rovném středu';
  }
  function jdiNaPole(cesta) {
    let el = document.querySelector(`[data-p="${cesta}"]`) || $('paleta');
    const det = el.closest('details'); if (det) det.open = true;
    const tel = el.closest('.zalozka-telo'); if (tel) TrubkyGui.otevriZalozku(tel.dataset.telo);
    if (el.closest('[hidden]')) el = p.prurez.typ === 'vlastni' ? $('cPrurez') : $('paleta');   // pole skryté pro tento typ průřezu
    const bx = el.closest('[data-box]'); TrubkyGui.ukazBox(bx ? bx.dataset.box : 'obecne');   // na úzkém displeji ukázat jeho box
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (el.focus) el.focus({ preventScroll: true });
    el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
  }

  /* ---------- přepočet ---------- */
  const nahled = SHAK_NAHLED.vytvorNahled($('platno'));
  function barvyNapeti() {
    if (!pev || !pev.max) return null;
    const nV = model.poz.length / 3, col = new Float32Array(nV * 3);
    const zast = [[0.19, 0.38, 0.82], [0.19, 0.69, 0.44], [0.88, 0.75, 0.19], [0.88, 0.25, 0.19]];
    const barva = t => { const x = Math.max(0, Math.min(0.999, t)) * 3, i = Math.floor(x), f = x - i; return [0, 1, 2].map(k => zast[i][k] + (zast[i + 1][k] - zast[i][k]) * f); };
    for (let v = 0; v < nV; v++) {
      const ring = Math.floor(v / model.M);
      const st = ring < model.kruhyStanic.length ? model.kruhyStanic[ring] : (v === nV - 1 ? model.S.length - 1 : 0);
      const c = barva(pev.sigma[st] / pev.max);
      col[3 * v] = c[0]; col[3 * v + 1] = c[1]; col[3 * v + 2] = c[2];
    }
    return col;
  }
  function prepocitej() {
    nahled.barvy(css('--bg-input'), css('--border-strong'), css('--border'), css('--text'));
    model = SHAK.sestav(p);
    pev = model.chyba ? null : SHAK.pevnost(model);
    const H = SHAK.kontroly(model);
    const k = model.chyba ? null : KRAB.kontrolaSite(model.poz, model.idx);
    nahled.nastav(model, model.chyba ? null : barvyNapeti());
    const st = $('stav3d');
    st.textContent = model.chyba || ''; st.classList.toggle('chyba', !!model.chyba);
    $('legNapeti').hidden = !(nahled.stav.napeti && pev && pev.max);
    if (pev && pev.max) $('legMax').textContent = `${fmt(pev.max * 9.81, 2)} MPa / kg`;
    vypis(H, k);
    kartaNahledu(k);
    kresliTrasu(); kresliPrurez(); kresliProlnuti(); kresliPaletu();
  }

  /* ---------- nabídky a lišta (sdílené s generátory trubek) ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_s_hak_gui', pohled: j => nahled.pohled(j) });

  const seznam = $('seznamPredvoleb');
  for (const v of PREDVOLBY) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${v.nazev}<span class="pozn">${v.popis}</span>`;
    b.addEventListener('click', () => {
      zmen(x => { Object.assign(x, { zesileni: { max: 0, prah: 55 } }, SHAK.kopie(v.p), { prurez: Object.assign({}, x.prurez, v.p.prurez) }); });
      naplnFormular();
    });
    seznam.appendChild(b);
  }

  const jmenoSouboru = pripona => ((p.nazev || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w-]+/g, '_').replace(/^_|_$/g, '') || 'S_hak') + pripona;
  function stahni(data, nazev, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: typ }));
    a.download = nazev; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const lzeExport = () => {
    if (!model || model.chyba) { Dialog.chyba('Model nelze sestavit: ' + (model ? model.chyba : '')); return false; }
    return true;
  };
  const kusy = () => {
    const n = Math.round(p.tisk.kusu) || 1, d = { poz: model.poz, idx: model.idx, barva: '#4F86D9' };
    return SHAK.rozmisti(Array.from({ length: n }, (_, i) => Object.assign({ nazev: (p.nazev || 'S hák') + (n > 1 ? ` ${i + 1}` : '') }, d)));
  };
  function exportStl() { if (lzeExport()) stahni(KRAB.stlBinarni(kusy(), 'S hak - github_site'), jmenoSouboru('.stl'), 'model/stl'); }
  $('btnStl').addEventListener('click', exportStl);
  $('btn3mf').addEventListener('click', () => {
    if (lzeExport()) stahni(KRAB.soubor3mf(kusy(), p.nazev || 'S hák'), jmenoSouboru('.3mf'), 'model/3mf');
  });
  for (const k of [1, 2]) $('btnKlip' + k).addEventListener('click', () => {
    if (!lzeExport()) return;
    const kl = SHAK.zkusebniKlipy(p, k);
    if (!kl.length) { Dialog.chyba('Zkušební klipy nelze sestavit.'); return; }
    const BARVY = { '-0.5': ['#D98A4F', 'oranžový'], '0': ['#4F86D9', 'modrý'], '0.5': ['#4FB07A', 'zelený'] };
    stahni(KRAB.soubor3mf(SHAK.rozmisti(kl.map(d => Object.assign(d, { barva: BARVY[d.odchylka][0] }))), 'Zkušební klipy'),
      jmenoSouboru(`_klipy_${k === 1 ? 'horni' : 'dolni'}.3mf`), 'model/3mf');
    Dialog.info(`Klipy: ${kl.map(d => `${BARVY[d.odchylka][1]} ${fmt(d.presah)} mm${d.odchylka === 0 ? ' (zadaný)' : ''}`).join(', ')}. Vyberte ten, který zacvakne pevně a nepraskne, a jeho přesah zadejte.`);
  });
  $('btnSvg').addEventListener('click', () => { if (lzeExport()) stahni(svgTrasy(), jmenoSouboru('_trasa.svg'), 'image/svg+xml'); });
  const xmlEsc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function svgTrasy() {
    const obr = obrysHaku(model), b = hraniceTrasy(model, obr), ok = 12;
    const W = b[2] - b[0] + 2 * ok, Hh = b[3] - b[1] + 2 * ok + 14;
    const X = x => (x - b[0] + ok).toFixed(3), Y = y => (b[3] - y + ok).toFixed(3);
    const tr = model.tr, r = [];
    r.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(2)}mm" height="${Hh.toFixed(2)}mm" viewBox="0 0 ${W.toFixed(3)} ${Hh.toFixed(3)}">`);
    const cesta = P => `<path d="M${P.map(q => X(q[0]) + ' ' + Y(q[1])).join('L')}Z" fill="#dbe7fb" stroke="#1d4fa8" stroke-width="0.3"/>`;
    r.push(cesta(obr));
    for (const [C, D] of trubky(model)) {
      r.push(`<circle cx="${X(C[0])}" cy="${Y(C[1])}" r="${(D / 2).toFixed(3)}" fill="none" stroke="#666" stroke-width="0.25" stroke-dasharray="2 1.2"/>`);
      r.push(`<path d="M${X(C[0] - 3)} ${Y(C[1])}H${X(C[0] + 3)}M${X(C[0])} ${Y(C[1] - 3)}V${Y(C[1] + 3)}" stroke="#666" stroke-width="0.2"/>`);
      r.push(`<text x="${X(C[0] + 2)}" y="${Y(C[1] + 2)}" font-size="3" font-family="sans-serif">Ø ${fmt(D)}</text>`);
    }
    otvory(model).forEach(([q, s], i) => {
      r.push(`<path d="M${X(q[0])} ${Y(q[1])}L${X(s[0])} ${Y(s[1])}" stroke="#c0392b" stroke-width="0.25"/>`);
      r.push(`<text x="${X((q[0] + s[0]) / 2) }" y="${Y((q[1] + s[1]) / 2)}" font-size="2.6" font-family="sans-serif" fill="#c0392b">otvor ${fmt(i ? tr.otvSkut2 : tr.otvSkut1)}</text>`);
    });
    r.push(`<path d="M${ok} ${(Hh - 5).toFixed(2)}h50" stroke="#000" stroke-width="0.3"/><text x="${ok}" y="${(Hh - 1.5).toFixed(2)}" font-size="3" font-family="sans-serif">kontrolní úsečka 50 mm · ${xmlEsc(p.nazev || 'S hák')} · rozteč ${fmt(p.roztec)} mm · tiskněte ve 100 %</text>`);
    r.push('</svg>');
    return r.join('\n');
  }

  /** Technický list: jedna stránka A4 k tisku nebo uložení do PDF (tiskem prohlížeče). */
  function technickyList() {
    if (!lzeExport()) return;
    const k = KRAB.kontrolaSite(model.poz, model.idx), tr = model.tr, pr = model.pr, mat = SHAK.MATERIALY[p.material];
    const kg = pev && pev.drzi ? SHAK.nosnost(pev, p.material, p.bezpecnost) : null, z = SHAK.zacvaknuti(model);
    // kresby pro papír: dočasně světlé téma, překreslit, zachytit, vrátit
    const koren = document.documentElement, tema0 = koren.getAttribute('data-theme');
    const sekce = ['dTrubky', 'dProlnuti'].map(id => [$(id), $(id).open]);
    sekce.forEach(([d]) => { d.open = true; });
    tichoTematu = true;   // vlastní přepnutí tématu nemá spouštět další přepočty přes MutationObserver
    window.__dprTisk = 3;   // kresby pro tisk ve trojnásobném rozlišení
    koren.setAttribute('data-theme', 'light'); prepocitej();
    const snimky = {};
    for (const id of ['cTrasa', 'cPrurez', 'cProlnuti']) { const c = $(id); snimky[id] = c && c.width && c.offsetParent ? c.toDataURL('image/png') : ''; }
    const png3d = nahled.png(3);
    delete window.__dprTisk;
    if (tema0 === null) koren.removeAttribute('data-theme'); else koren.setAttribute('data-theme', tema0);
    sekce.forEach(([d, o]) => { d.open = o; });
    prepocitej();
    setTimeout(() => { tichoTematu = false; }, 0);
    const obr = id => snimky[id] ? `<img src="${snimky[id]}" alt="">` : '';
    const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const druh = 'S hák mezi dvě trubky';
    const radky = [['Typ', druh], ['Průřez', `${SHAK.TYPY[p.prurez.typ].nazev}, ${fmt(pr.sirka)} × ${fmt(pr.vyska)} mm, plocha ${fmt(Math.abs(pr.plocha), 2)} mm²`]];
    radky.push(['Trubky', `Ø ${fmt(p.trubka1)} / Ø ${fmt(p.trubka2)} mm, přesah ${fmt(p.presah)} / ${fmt(p.presah2)} mm, rozteč ${fmt(p.roztec)} mm`],
      ['Otvory', `${fmt(tr.otvSkut1)} / ${fmt(tr.otvSkut2)} mm`]);
    if (p.zesileni.max > 0) radky.push(['Zesílení', `+${fmt(p.zesileni.max)} mm od ${fmt(p.zesileni.prah, 0)} % napětí`]);
    radky.push(['Rozměr', `${fmt(k.bbox[3] - k.bbox[0])} × ${fmt(k.bbox[4] - k.bbox[1])} × ${fmt(k.bbox[5] - k.bbox[2])} mm (tisková poloha)`],
      ['Hmotnost', `${fmt(k.objem / 1000 * mat.hustota, 1)} g ${mat.nazev} (${fmt(k.objem / 1000, 2)} cm³)`],
      ['Nosnost', kg ? `≈ ${fmt(kg, 1)} kg při bezpečnosti ${fmt(p.bezpecnost)} (${mat.nazev} ${mat.pevnost} MPa, max. napětí ${popisMista(pev.kde)})` : '—'],
      ...(z[0].eps || z[1].eps ? [['Zacvaknutí', `protažení ${fmt(z[0].eps, 2)} / ${fmt(z[1].eps, 2)} % (mez ${mat.nazev} ≈ ${fmt(mat.mez)} %)`]] : []),
      ['Síť', `${k.trojuhelniku.toLocaleString('cs-CZ')} trojúhelníků, ${k.uzavrena && !k.degenerovanych ? 'uzavřená' : 'VADNÁ'}`]);
    const H = SHAK.kontroly(model).filter(h => h.uroven !== 'ok');
    const doporuc = [
      'Tisknout naležato přesně v exportované poloze – vrstvy pak vedou podél háku a ohyb je nenamáhá na odtržení.',
      `Obvodové stěny: aspoň ${Math.max(3, Math.ceil(pr.vyska / 1.2))} (pevnost dává hlavně obvod, výplň 30–50 %).`,
      SHAK.previsy(pr, p.tisk.uhel).delka <= 0.2 ? `Podpory nejsou potřeba – žádná část průřezu nepřevisí víc než ${fmt(p.tisk.uhel, 0)}° od svislice${pr.doplneno ? ' (převisy jsou doplněné náběhem)' : ''}.`
        : `Pozor: průřez má převisy až ${fmt(SHAK.previsy(pr, p.tisk.uhel).max, 0)}° – zapněte „Doplnit převisy“ v sekci Tisk, nebo ve sliceru podpory.`,
      `Materiál ${mat.nazev}: nosnost platí pro pokojovou teplotu, PLA na slunci nebo v autě měkne – venku PETG nebo ASA.`,
    ];
    const html = `<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>${esc(p.nazev || 'S hák')} – technický list</title><style>
      @page { size: A4; margin: 14mm; } body { font: 10.5pt/1.4 system-ui, sans-serif; color: #111; margin: 0 auto; max-width: 182mm; }
      h1 { font-size: 16pt; margin: 0 0 2mm; } .pod { color: #555; font-size: 9pt; margin-bottom: 5mm; }
      .obr { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-bottom: 4mm; } .obr img { width: 100%; height: 64mm; object-fit: contain; border: 1px solid #ccc; border-radius: 2mm; background: #fff; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 4mm; } td { border-bottom: 1px solid #ddd; padding: 1.4mm 2mm; vertical-align: top; } td:first-child { color: #555; width: 30mm; }
      h2 { font-size: 11pt; margin: 4mm 0 1.5mm; } ul { margin: 0; padding-left: 5mm; } li.chyba { color: #b00020; } li.varovani { color: #8a5a00; }
      .tlac { position: fixed; right: 8mm; top: 8mm; } @media print { .tlac { display: none; } }</style></head><body>
      <button class="tlac" onclick="print()">Tisk / PDF</button>
      <h1>${esc(p.nazev || 'S hák')}</h1><div class="pod">${druh} · technický list · ${new Date().toLocaleDateString('cs-CZ')} · generátor S háku (github_site)</div>
      <div class="obr"><img src="${png3d}" alt="">${obr('cTrasa')}${obr('cPrurez')}${obr('cProlnuti')}</div>
      <table>${radky.map(([a, b]) => `<tr><td>${a}</td><td>${esc(b)}</td></tr>`).join('')}</table>
      <h2>Kontroly</h2><ul>${H.length ? H.map(h => `<li class="${h.uroven}">${esc(h.text)}</li>`).join('') : '<li>Geometrie v pořádku.</li>'}</ul>
      <h2>Doporučení pro tisk</h2><ul>${doporuc.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      <p class="pod" style="margin-top:5mm">Pevnost je zjednodušený odhad (prostý ohyb a tah, bez vrubů a únavy). Před zatížením vyzkoušejte.</p></body></html>`;
    const okno = window.open('', '_blank');
    if (!okno) { stahni(html, jmenoSouboru('_technicky_list.html'), 'text/html'); Dialog.info('Prohlížeč zablokoval nové okno – technický list se stáhl jako HTML.'); return; }
    okno.document.open(); okno.document.write(html); okno.document.close();
  }
  $('btnList').addEventListener('click', technickyList);
  $('btnUlozit').addEventListener('click', () => stahni(SHAK.ulozProjekt(p), jmenoSouboru('.json'), 'application/json'));
  $('btnNacist').addEventListener('click', () => $('soubor').click());
  $('soubor').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const { p: q, hlaseni } = SHAK.nactiProjekt(await f.text());
      zmen(x => { Object.keys(x).forEach(k => delete x[k]); Object.assign(x, q); }); naplnFormular();
      if (hlaseni.length) hlasPrevod(hlaseni, 'Projekt'); else Dialog.info('Projekt načten.');
    }
    catch (err) { Dialog.chyba(err.message); }
  });
  $('btnVychozi').addEventListener('click', async () => {
    if (!await Dialog.potvrd('Vrátit všechny parametry na výchozí hodnoty?')) return;
    zmen(x => { Object.keys(x).forEach(k => delete x[k]); Object.assign(x, SHAK.normalizuj({}).p); }); naplnFormular();
  });
  $('btnPng').addEventListener('click', () => { fetch(nahled.png()).then(r => r.blob()).then(b => stahni(b, jmenoSouboru('.png'))); });
  $('btnZpet').addEventListener('click', () => krokHistorie(zpet, znovu));
  $('btnZnovu').addEventListener('click', () => krokHistorie(znovu, zpet));
  function prepinac(id, co) {
    const b = $(id);
    b.addEventListener('click', () => {
      const h = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(h)); nahled.prepni(co, h);
      if (co === 'napeti') prepocitej();
    });
  }
  prepinac('tTrubky', 'trubky'); prepinac('tNapeti', 'napeti'); prepinac('tTisk', 'tisk'); prepinac('tHrany', 'hrany');
  $('stavOdznak').addEventListener('click', () => TrubkyGui.otevriZalozku('kontrola'));
  $('btnNapoveda').addEventListener('click', () => $('dlgNapoveda').showModal());
  $('btnZavritNap').addEventListener('click', () => $('dlgNapoveda').close());
  document.addEventListener('keydown', e => {
    const a = document.activeElement;
    const vPoli = a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || (a.tagName === 'INPUT' && !/checkbox|range|radio|button/.test(a.type));
    if ((e.ctrlKey || e.metaKey) && !vPoli && e.key.toLowerCase() === 'z') { e.preventDefault(); krokHistorie(e.shiftKey ? znovu : zpet, e.shiftKey ? zpet : znovu); return; }
    if ((e.ctrlKey || e.metaKey) && !vPoli && e.key.toLowerCase() === 'y') { e.preventDefault(); krokHistorie(znovu, zpet); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); exportStl(); return; }
    if (e.key === 'F1') { e.preventDefault(); $('dlgNapoveda').showModal(); return; }
    if (vPoli || e.ctrlKey || e.metaKey || e.altKey || document.activeElement === $('cPrurez') || $('dlgNapoveda').open) return;
    const k = e.key.toLowerCase();
    if (k === '1') nahled.pohled('iso'); else if (k === '2') nahled.pohled('shora'); else if (k === '3') nahled.pohled('zboku');
    else if (k === 't') $('tTrubky').click(); else if (k === 'n') $('tNapeti').click(); else if (k === 'm') $('tTisk').click(); else if (k === 'h') $('tHrany').click();
  });
  // plátna překreslit při každé změně velikosti (posuvník panelu, otevření sekce) – jinak editor zasahuje podle starého měřítka
  const kresby = new Map([['cTrasa', kresliTrasu], ['cPrurez', kresliPrurez], ['cProlnuti', kresliProlnuti]]);
  const odloz = f => { let ceka = false; return () => { if (ceka || !model) return; ceka = true; requestAnimationFrame(() => { ceka = false; f(); }); }; };
  for (const [id, f] of kresby) new ResizeObserver(odloz(f)).observe($(id));
  new ResizeObserver(odloz(kresliPaletu)).observe(paleta);
  let tichoTematu = false;
  new MutationObserver(() => { if (!tichoTematu) prepocitej(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  if (typeof Tvary !== 'undefined') Tvary.pripoj({
    klic: 'webapp_s_hak_tvary', typ: 's_hak', nazev: 'S hák', kontejner: $('tvary'),
    parametry: () => SHAK.kopie(p),
    pouzij: q => { const n = SHAK.normalizuj(q), r = n.p; hlasPrevod(n.hlaseni, 'Uložený hák'); zmen(x => { Object.keys(x).forEach(k => delete x[k]); Object.assign(x, r); }); naplnFormular(); },
    popis: q => `${q.nazev || 'S hák'} – Ø ${fmt(q.trubka1)} / Ø ${fmt(q.trubka2)}, rozteč ${fmt(q.roztec)} mm`,
  });

  /* ---------- start ---------- */
  p = nactiUlozeny();
  naplnFormular();
  prepocitej();
  window.SHAK_UI = { nahled, technickyList, get ed() { return editor.ed; }, get p() { return p; }, get model() { return model; }, zmen, naplnFormular, prepocitej, svgTrasy };
})();
