/* ============================================================
   Rostoucí židle – uživatelské rozhraní
   ============================================================ */
(function () {
  'use strict';
  const RZ = window.RZ, DH = window.DH, DHV = window.DHV, RZSTL = window.RZSTL;
  const $ = (id) => document.getElementById(id);
  const KLIC = 'webapp_rostouci_zidle', KLIC_PROJEKTY = 'webapp_rostouci_zidle_projekty';
  const cz = DH.cz, esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const toast = (t, ch) => (window.Dialog ? (ch ? Dialog.chyba(t) : Dialog.info(t)) : console.log(t));
  const NAST_V = { papir: 'a4', papirW: 210, papirH: 297, okraj: 8, prekryv: 12, stulW: 1250, stulH: 1250, stulMezera: 6, popisy: true, kalibX: 100, kalibY: 100, stlVule: 0.2, stlStul: 220 };
  const POLE1 = [
    { k: 'stul', n: 'Výška stolu (mm)', min: 600, max: 900, krok: 5 }, { k: 'podStolem', n: 'Spodek desky / lubu (mm)', min: 450, max: 850, krok: 5 },
    { k: 'vekOd', n: 'Věk od (roky)', min: 1, max: 18, krok: 0.5 }, { k: 'vekDo', n: 'Věk do (18 = dospělý)', min: 1, max: 18, krok: 0.5 },
    { k: 'tolSed', n: 'Tolerance výšky sedu ± (mm)', min: 5, max: 40, krok: 1 }, { k: 'kolenoMax', n: 'Největší úhel kolene (°)', min: 95, max: 130, krok: 1 },
  ];
  const POLE2 = [
    { k: 'material', n: 'Materiál', t: 'v', m: () => Object.entries(DH.MATERIALY).filter(([k]) => ['buk', 'briza', 'dub', 'javor', 'smrk'].includes(k)).map(([k, m]) => [k, m.nazev]) },
    { k: 'tBok', n: 'Tloušťka boků (mm)', min: 18, max: 40, krok: 1 }, { k: 'tDeska', n: 'Tloušťka sedáku a podnožky', min: 9, max: 27, krok: 1 },
    { k: 'tOpera', n: 'Tloušťka příček opěradla', min: 12, max: 30, krok: 1 }, { k: 'B', n: 'Šířka boku (mm)', min: 120, max: 400, krok: 5 },
    { k: 'sklon', n: 'Sklon boků od svislice (°)', min: 0, max: 35, krok: 0.5 }, { k: 'sirka', n: 'Šířka sedáku – vnitřní (mm)', min: 250, max: 600, krok: 5 },
    { k: 'hlDrazky', n: 'Hloubka drážky (mm)', min: 4, max: 15, krok: 0.5 }, { k: 'vule', n: 'Vůle v drážce (mm)', min: 0, max: 3, krok: 0.1 },
    { k: 'roztec', n: 'Rozteč drážek (0 = optimalizovat)', min: 0, max: 80, krok: 0.5 }, { k: 'prvni', n: 'První drážka z (0 = auto)', min: 0, max: 400, krok: 1 },
    { k: 'Ds', n: 'Hloubka desky sedáku (mm)', min: 200, max: 500, krok: 5 }, { k: 'Dp', n: 'Hloubka podnožky (mm)', min: 150, max: 400, krok: 5 },
    { k: 'hl', n: 'Výška ližiny (mm)', min: 25, max: 80, krok: 1 }, { k: 'opery', n: 'Příčky opěradla', t: 'v', m: () => [['1', '1 (horní)'], ['2', '2 (horní + bederní)']] },
    { k: 'vpred', n: 'Ližina vpředu (0 = výpočet)', min: 0, max: 500, krok: 5 }, { k: 'vzad', n: 'Ližina vzadu (0 = výpočet)', min: 0, max: 600, krok: 5 },
    { k: 'sila', n: 'Síla opření (% váhy dítěte)', min: 5, max: 60, krok: 1 }, { k: 'bezpecnost', n: 'Požadovaná bezpečnost', min: 1, max: 3, krok: 0.1 },
    { k: 'madlo', n: 'Bezpečnostní madlo pro batolata', t: 'b' }, { k: 'popruh', n: 'Popruh s pásem mezi nohama', t: 'b' },
  ];

  /* ---------- stav ---------- */
  function vychozi() { return { p: JSON.parse(JSON.stringify(RZ.VYCHOZI)), nast: Object.assign({}, NAST_V), nazev: '', vek: 3 }; }
  function slouc(u) { const S = vychozi(); if (u && u.p) { S.p = Object.assign(S.p, u.p); S.nast = Object.assign(S.nast, u.nast || {}); S.nazev = u.nazev || ''; S.vek = u.vek || 3; S.vyber = u.vyber || null; } return S; }
  let S; try { S = slouc(JSON.parse(localStorage.getItem(KLIC) || 'null')); } catch (e) { S = vychozi(); }
  let N = null, t1 = 0, tU = 0;
  const uloz = () => { clearTimeout(tU); tU = setTimeout(() => { try { localStorage.setItem(KLIC, JSON.stringify(S)); } catch (e) { /* plné */ } }, 250); };
  const projekty = () => { try { return JSON.parse(localStorage.getItem(KLIC_PROJEKTY) || '{}') || {}; } catch (e) { return {}; } };

  /* ---------- formuláře ---------- */
  function pole(obal, def) {
    $(obal).innerHTML = def.map((f) => {
      const id = 'p_' + f.k, v = S.p[f.k];
      if (f.t === 'b') return `<div class="cela"><label class="chk"><input type="checkbox" id="${id}"${v ? ' checked' : ''}> ${esc(f.n)}</label></div>`;
      if (f.t === 'v') return `<div><label for="${id}">${esc(f.n)}</label><select id="${id}">${f.m().map(([a, b]) => `<option value="${esc(a)}"${String(v) === String(a) ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select></div>`;
      return `<div><label for="${id}">${esc(f.n)}</label><input id="${id}" type="number" inputmode="decimal" value="${esc(v)}" min="${f.min}" max="${f.max}" step="${f.krok}"></div>`;
    }).join('');
  }
  function formulare() {
    pole('pole1', POLE1); pole('pole2', POLE2);
    $('predvolba').innerHTML = '<option value="">– vyberte předvolbu –</option>' + RZ.PREDVOLBY.map((q) => `<option value="${q.id}">${esc(q.nazev)}</option>`).join('');
    vykresliDeti();
    for (const id of Object.keys(NAST_V)) { const el = $(id); if (!el) continue; if (el.type === 'checkbox') el.checked = S.nast[id] !== false; else el.value = S.nast[id]; }
    $('blokPapir').classList.toggle('skryte', S.nast.papir !== 'vlastni');
    $('nazevProjektu').value = S.nazev || '';
  }
  const zmena = (e) => {
    const el = e.target; if (!el.id || !el.id.startsWith('p_')) return;
    const k = el.id.slice(2), f = POLE1.concat(POLE2).find((q) => q.k === k); if (!f) return;
    S.p[k] = f.t === 'b' ? el.checked : f.t === 'v' ? (k === 'opery' ? +el.value : el.value) : (isFinite(parseFloat(el.value)) ? parseFloat(String(el.value).replace(',', '.')) : S.p[k]);
    naplanuj();
  };
  for (const o of ['pole1', 'pole2']) { $(o).addEventListener('input', zmena); $(o).addEventListener('change', zmena); }
  $('predvolba').addEventListener('change', () => { const q = RZ.PREDVOLBY.find((x) => x.id === $('predvolba').value); if (!q) return; S.p = Object.assign(JSON.parse(JSON.stringify(RZ.VYCHOZI)), JSON.parse(JSON.stringify(q.p))); formulare(); $('predvolba').value = q.id; prepocti(); });
  function vykresliDeti() {
    const d = S.p.deti || [];
    $('deti').innerHTML = '<label style="margin:0">jméno</label><label style="margin:0">věk</label><label style="margin:0">výška mm</label><span></span>' + d.map((q, i) => `<input data-i="${i}" data-k="jmeno" value="${esc(q.jmeno)}" aria-label="jméno dítěte ${i + 1}"><input data-i="${i}" data-k="vek" type="number" min="0.5" max="18" step="0.5" value="${esc(q.vek)}" aria-label="věk dítěte ${i + 1}"><input data-i="${i}" data-k="vyska" type="number" min="0" max="2100" step="10" value="${esc(q.vyska)}" aria-label="výška dítěte ${i + 1}"><button class="btn btn-sec btn-mini" type="button" data-smaz="${i}" aria-label="odebrat dítě ${i + 1}">✕</button>`).join('');
  }
  $('deti').addEventListener('input', (e) => { const i = e.target.dataset.i, k = e.target.dataset.k; if (i == null) return; const q = S.p.deti[+i]; q[k] = k === 'jmeno' ? e.target.value : +e.target.value || 0; naplanuj(); });
  $('deti').addEventListener('click', (e) => { const b = e.target.closest('[data-smaz]'); if (!b) return; S.p.deti.splice(+b.dataset.smaz, 1); vykresliDeti(); prepocti(); });
  $('btnDite').addEventListener('click', () => { (S.p.deti = S.p.deti || []).push({ jmeno: 'dítě ' + (S.p.deti.length + 1), vek: 4, vyska: 0 }); vykresliDeti(); prepocti(); });
  for (const id of Object.keys(NAST_V)) {
    const el = $(id); if (!el) continue;
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => {
      if (el.type === 'checkbox') S.nast[id] = el.checked; else if (el.tagName === 'SELECT') S.nast[id] = el.value; else { const x = parseFloat(el.value); if (isFinite(x)) S.nast[id] = x; }
      $('blokPapir').classList.toggle('skryte', S.nast.papir !== 'vlastni'); clearTimeout(t1); t1 = setTimeout(() => { vykresliVystupy(); uloz(); }, 120);
    });
  }
  $('nazevProjektu').addEventListener('input', () => { S.nazev = $('nazevProjektu').value; uloz(); });

  /* ---------- výpočet ---------- */
  const naplanuj = () => { clearTimeout(t1); t1 = setTimeout(prepocti, 150); };
  const popisPolohy = (q) => (q.dite ? `${q.dite}${q.vek ? ' (' + cz(q.vek, 1) + ' r.)' : ''}` : q.vek >= 18 ? 'dospělý' : cz(q.vek, 1) + ' r.');
  function prepocti() {
    try { N = RZ.vypocet(S.p); } catch (e) { console.error(e); $('varovani').innerHTML = `<li class="chyba">${esc(e.message)}</li>`; return; }
    $('info').innerHTML = N.info.map((t) => `<p>${esc(t)}</p>`).join('');
    $('varovani').innerHTML = N.varovani.map((t) => `<li>${esc(t)}</li>`).join('');
    // věk – posuvník
    $('vek3d').min = N.P.vekOd; $('vek3d').max = N.P.vekDo;
    $('ditko').innerHTML = N.polohy.filter((q) => q.dite).map((q, i) => `<button type="button" data-dite="${esc(q.dite)}" aria-pressed="${S.vyber === q.dite}">${esc(popisPolohy(q))}</button>`).join('');
    vykresliTabulky(); vykresliBezpecnost(); vykresliVystupy();
    $('princip').innerHTML = RZPrincip.princip(); $('postup').innerHTML = RZPrincip.postup(); $('zdroje').innerHTML = RZPrincip.zdroje();
    $('stlDil').innerHTML = N.stl.map((q) => `<option value="${q.id}">${esc(q.nazev)} (potřeba ${q.ks} ks)</option>`).join('');
    if (pohled3d) pohled3d.aktualizuj(N, vybranaPoloha());
    ukazPolohu(vybranaPoloha(), false);
    uloz();
  }
  function vybranaPoloha() {
    if (!N) return null;
    if (S.vyber) { const q = N.polohy.find((x) => x.dite === S.vyber); if (q) return q; }
    const v = Math.max(N.P.vekOd, Math.min(N.P.vekDo, +S.vek || 3));
    const q = N.polohy.filter((x) => !x.dite).reduce((m, x) => (Math.abs(x.vek - v) < Math.abs(m.vek - v) ? x : m));
    return q;
  }
  function ukazPolohu(q, anim) {
    if (!q) return;
    $('vek3d').value = q.dite ? (q.vek || S.vek) : q.vek;
    $('vekHodnota').textContent = `${popisPolohy(q)} · ${cz(q.S / 10, 0)} cm`;
    $('infoPoloha').innerHTML = `Sedák v drážce <b>D${q.ks + 1}</b> (sed ${cz(q.sedTop, 0)} mm, cíl ${cz(q.cilSed, 0)}), ${RZ.posunTxt(N, q, true)} · podnožka <b>${q.kp < 0 ? 'dole / vyjmout – chodidla na podlaze' : 'D' + (q.kp + 1)}</b> · koleno ${cz(q.koleno, 0)}° · hloubka sedu ${cz(q.hloubka, 0)} mm.`;
    for (const tr of document.querySelectorAll('#tabNastaveni tr[data-i]')) tr.classList.toggle('vyber', N.polohy[+tr.dataset.i] === q);
    for (const b of $('ditko').children) b.setAttribute('aria-pressed', String(b.dataset.dite === q.dite));
    if (pohled3d && anim) pohled3d.poloha(q);
    // výkres pro vybranou polohu
    const N2 = Object.assign({}, N, { telesa: RZ.telesa(N.P, N.G, N.K, q), koty: [{ pohled: 'bok', a: [N.K.y1 + 30, q.sedTop], b: [N.K.y1 + 30, 0], txt: `sed ${cz(q.sedTop, 0)}`, o: 0 }].concat(q.gp != null ? [{ pohled: 'bok', a: [N.K.y0 - 30, q.podTop], b: [N.K.y0 - 30, 0], txt: `podnožka ${cz(q.podTop, 0)}`, o: 0 }] : []) });
    $('nahledPohledy').innerHTML = DHV.pohledy(N2).svg;
  }
  $('vek3d').addEventListener('input', () => { S.vek = +$('vek3d').value; S.vyber = null; ukazPolohu(vybranaPoloha(), true); uloz(); });
  $('ditko').addEventListener('click', (e) => { const b = e.target.closest('[data-dite]'); if (!b) return; S.vyber = S.vyber === b.dataset.dite ? null : b.dataset.dite; ukazPolohu(vybranaPoloha(), true); uloz(); });
  function tabulka(t, klik) {
    return `<h3 class="podnadpis" style="margin:8px 0 4px">${esc(t.nadpis)}</h3><div class="tab-obal" style="max-height:420px"><table><tr>${t.hlavicka.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>${t.radky.map((r, i) => `<tr${klik ? ` data-i="${i}" style="cursor:pointer"` : ''}>${r.map((x, j) => `<td${j ? ' class="c"' : ''}>${x === 'ok' ? '<span class="ok">v pořádku</span>' : x === 'pozor' ? '<span style="color:var(--warn)">pozor</span>' : x === 'PŘEVRHNE' ? '<b class="chyba">PŘEVRHNE</b>' : esc(x)}</td>`).join('')}</tr>`).join('')}</table></div>`;
  }
  function vykresliTabulky() {
    $('tabNastaveni').innerHTML = tabulka(N.tabulky[0], true);
    $('tabStabilita').innerHTML = N.tabulky.slice(1).map((t) => tabulka(t)).join('') + `<p class="info">Bezpečnost = moment tíhy (židle + dítě) k hraně ližiny / moment síly opření. Ližiny: vpředu ${cz(N.K.ext.vpred, 0)} mm, vzadu ${cz(N.K.ext.vzad, 0)} mm.</p>`;
    $('tabKusovnik').innerHTML = '<tr><th>poz.</th><th>název</th><th>ks</th><th>rozměr (mm)</th><th>materiál</th><th>poznámka</th></tr>' + N.kusovnik.map((k) => `<tr><td class="c">${k.poz}</td><td>${esc(k.nazev)}</td><td class="c">${k.ks}</td><td>${esc(k.rozmer)}</td><td>${esc(k.mat)}</td><td>${esc(k.pozn)}</td></tr>`).join('');
    $('infoHmotnost').textContent = `Hmotnost dřevěných dílů ≈ ${cz(N.hmotnost, 1)} kg.`;
  }
  $('tabNastaveni').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-i]'); if (!tr) return; const q = N.polohy[+tr.dataset.i]; S.vyber = q.dite || null; if (!q.dite) S.vek = q.vek; ukazPolohu(q, true); uloz(); });
  function vykresliBezpecnost() {
    const p = { ok: 0, pozor: 0, chyba: 0 }; for (const b of N.bezpecnost) p[b.u]++;
    $('souhrnBezp').innerHTML = `<span class="ok">✓ ${p.ok}</span><span style="color:var(--warn)">! ${p.pozor}</span><span class="chyba">✕ ${p.chyba}</span>`;
    const por = { chyba: 0, pozor: 1, ok: 2 };
    $('seznamBezp').innerHTML = N.bezpecnost.slice().sort((a, b) => por[a.u] - por[b.u]).map((b) => `<li class="${b.u}"><span class="z" aria-hidden="true">${b.u === 'ok' ? '✓' : b.u === 'pozor' ? '!' : '✕'}</span><span>${esc(b.t)}</span></li>`).join('');
  }
  let deskaR = null;
  function vykresliVystupy() {
    if (!N) return;
    const n = S.nast;
    const R = DHV.deska(N, { W: +n.stulW, H: +n.stulH, mezera: +n.stulMezera, popisy: n.popisy !== false, sablony: true });
    deskaR = R;
    let h = '';
    R.plochy.forEach((P, i) => { const ram = { x0: 0, y0: 0, x1: +n.stulW, y1: +n.stulH }; h += `<div><div class="popis">Deska ${i + 1}/${R.plochy.length} – ${cz(ram.x1, 0)} × ${cz(ram.y1, 0)} mm</div><div class="papir">${DHV.svg(P.prvky.concat([{ t: 'l', b: DH.obdelnik(0, 0, ram.x1, ram.y1), s: 0.5, c: '#bbbbbb', z: true, v: 'ram', d: 'c' }]), ram, { sirka100: true, okraj: 4 })}</div></div>`; });
    for (const i of R.velke) { const sc = R.sceny[i]; h += `<div><div class="popis">${esc(sc.dil.nazev)} – větší než deska</div><div class="papir">${DHV.svg(sc.prvky, sc, { sirka100: true, okraj: 4 })}</div></div>`; }
    $('nahledDily').innerHTML = h;
    try {
      const st = DHV.strany(N, n, { nazev: nazev() });
      $('nahledListy').innerHTML = st.slice(0, 30).map((q, i) => `<div><div class="papir">${stranaSvg(q)}</div><div class="cislo">list ${i + 1}</div></div>`).join('');
      $('infoListy').innerHTML = `PDF: <b>${st.length}</b> listů – kusovník a bezpečnost, šablony 1:1 (boky s drážkami a otvory, ližiny, desky, štítek nastavení) s úsečkami 50/100 mm v X i Y.`;
    } catch (e) { console.error(e); }
    const K = DHV.korekce(n.kalibX, n.kalibY);
    $('kalibVysl').innerHTML = K.platne ? `X ×${cz(K.kx, 4)}<br>Y ×${cz(K.ky, 4)}` : '<span class="chyba">mimo 80–120</span>';
  }
  function stranaSvg(st) {
    const k = (e) => e.t === 'l' ? `<path d="${e.b.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(2) + ' ' + q[1].toFixed(2)).join('')}${e.z ? 'Z' : ''}" fill="none" stroke="${e.c}" stroke-width="${Math.max(0.25, e.s || 0.2)}"/>`
      : e.t === 'e' ? `<ellipse cx="${e.x}" cy="${e.y}" rx="${e.rx}" ry="${e.ry}" fill="none" stroke="${e.c}" stroke-width="0.25"/>`
        : e.t === 'r' ? `<rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" fill="${e.f ? '#000' : 'none'}" stroke="${e.c}" stroke-width="0.25"/>`
          : e.t === 'm' ? (e.osa === 'x' ? `<path d="M${e.x0} ${e.y}H${e.x1}" stroke="#000" stroke-width="0.4"/>` : `<path d="M${e.x0} ${e.y}V${e.y1}" stroke="#000" stroke-width="0.4"/>`)
            : e.t === 'txt' ? `<text x="${e.x}" y="${e.y}" font-size="${e.h}" fill="${e.c}" text-anchor="${e.a === 'r' ? 'end' : e.a === 'c' ? 'middle' : 'start'}">${esc(e.txt)}</text>` : '';
    const id = 'k' + Math.random().toString(36).slice(2, 7);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${st.W} ${st.H}" font-family="Liberation Sans, Arial"><rect width="${st.W}" height="${st.H}" fill="#fff"/>${st.clip ? `<clipPath id="${id}"><rect x="${st.clip.x}" y="${st.clip.y}" width="${st.clip.w}" height="${st.clip.h}"/></clipPath><g clip-path="url(#${id})">` : '<g>'}${st.obsah.map(k).join('')}</g>${st.navrch.map(k).join('')}</svg>`;
  }

  /* ---------- soubory ---------- */
  function stahni(obsah, jm, typ) { const b = obsah instanceof Blob ? obsah : new Blob([obsah], { type: typ || 'application/octet-stream' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = jm; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  const nazev = () => S.nazev || 'Rostoucí židle';
  const zaklad = () => String(S.nazev || 'rostouci_zidle').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'rostouci_zidle';
  let pismo = null;
  const nactiPismo = () => pismo || (pismo = new Promise((ok) => { if (window.FONTY_JS && FONTY_JS['LiberationSans-Regular.ttf']) { ok(FONTY_JS['LiberationSans-Regular.ttf']); return; } const s = document.createElement('script'); s.src = 'stitky_panely/fonty/LiberationSans-Regular.ttf.js'; s.onload = () => ok((window.FONTY_JS || {})['LiberationSans-Regular.ttf'] || null); s.onerror = () => { pismo = null; ok(null); }; document.head.appendChild(s); }));
  $('btnPdf').addEventListener('click', async () => {
    const b = $('btnPdf'), puv = b.textContent; b.disabled = true; b.textContent = 'Připravuji PDF…';
    try { if (!window.jspdf) throw new Error('jsPDF se nenačetl'); const f = await nactiPismo(); if (!f) toast('Písmo se nenačetlo – PDF bez diakritiky.'); const doc = DHV.pdf(window.jspdf.jsPDF, DHV.strany(N, S.nast, { nazev: nazev() }), { pismo: f, nazev: nazev() }); stahni(doc.output('blob'), zaklad() + '.pdf'); }
    catch (e) { toast('Chyba PDF: ' + e.message, true); } finally { b.disabled = false; b.textContent = puv; }
  });
  function cnc(typ) {
    const R = deskaR, sady = R.plochy.map((P, i) => ({ prvky: P.prvky, ram: { x0: 0, y0: 0, x1: +S.nast.stulW, y1: +S.nast.stulH }, jm: 'deska' + (i + 1) })).concat(R.velke.map((i) => ({ prvky: R.sceny[i].prvky, ram: R.sceny[i], jm: R.sceny[i].dil.id })));
    for (const s of sady) typ === 'svg' ? stahni(DHV.svg(s.prvky, s.ram, { laser: true, popisy: S.nast.popisy !== false, okraj: 0 }), `${zaklad()}_${s.jm}.svg`, 'image/svg+xml') : stahni(DHV.dxf(s.prvky, { popisy: S.nast.popisy !== false }), `${zaklad()}_${s.jm}.dxf`, 'application/dxf');
    toast(`Vrstvy: REZ = obrys (řezat skrz), DRAZKA = kapsa hl. ${cz(N.P.hlDrazky, 1)} mm na vnitřním líci, OTVOR = skrz, GRAVIR = vyznačení.`);
  }
  $('btnSvg').addEventListener('click', () => cnc('svg'));
  $('btnDxf').addEventListener('click', () => cnc('dxf'));
  $('btnCsv').addEventListener('click', () => stahni('﻿' + DHV.csv(N), zaklad() + '_kusovnik.csv', 'text/csv;charset=utf-8'));
  $('btnRezJson').addEventListener('click', () => stahni(JSON.stringify(RZ.exportReznyPlan(N, { projekt: nazev() }), null, 1), zaklad() + '_dilce.json', 'application/json'));
  $('btnRezny').addEventListener('click', () => {
    try { localStorage.setItem('webapp_rezny_plan_vstup', JSON.stringify(RZ.exportReznyPlan(N, { projekt: nazev() }))); } catch (e) { toast('Nepodařilo se předat data (plné úložiště).', true); return; }
    window.open('rezny_plan.html', '_blank');
  });
  /* STL */
  let manifold = null;
  const nactiSkript = (src) => new Promise((ok, ch) => { const e = document.createElement('script'); e.src = src; e.onload = ok; e.onerror = () => ch(new Error('nejde načíst ' + src)); document.head.appendChild(e); });
  function nactiManifold() {
    if (manifold) return manifold;
    manifold = (async () => {
      globalThis.MANIFOLD_URL = new URL('lib/manifold/manifold.klasicky.js', location.href).href;
      if (!globalThis.ManifoldModule) await nactiSkript('lib/manifold/manifold.klasicky.js');
      let v;
      if (location.protocol === 'file:') { await nactiSkript('lib/manifold/manifold.wasm.js'); const b = atob(globalThis.MANIFOLD_WASM_B64), bin = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) bin[i] = b.charCodeAt(i); delete globalThis.MANIFOLD_WASM_B64; v = { wasmBinary: bin }; }
      else v = { locateFile: (f) => new URL('lib/manifold/' + f, location.href).href };
      const w = await globalThis.ManifoldModule(v); w.setup(); return w;
    })();
    manifold.catch(() => { manifold = null; });
    return manifold;
  }
  $('btnStl').addEventListener('click', async () => {
    const b = $('btnStl'), puv = b.textContent; b.disabled = true; b.textContent = 'Počítám…';
    try { const w = await nactiManifold(), id = $('stlDil').value, m = RZSTL.dil(w, id, N, S.nast, +$('stlKusu').value || 1); stahni(new Blob([DHSTL.stlBinarni(m.poz, m.idx, m.popis)], { type: 'model/stl' }), `${zaklad()}_${id}.stl`); for (const v of m.varovani) toast(v); toast(`${m.popis}; ${m.kusu} ks, objem ${cz(m.objem / 1000, 1)} cm³.`); }
    catch (e) { toast('Chyba STL: ' + e.message, true); } finally { b.disabled = false; b.textContent = puv; }
  });

  /* ---------- 3D ---------- */
  let pohled3d = null, nacita = false;
  function nacti3d() {
    if (pohled3d || nacita) return; nacita = true;
    const hotovo = () => { try { pohled3d = RZ3D.vytvor($('obal3d')); $('stav3d').textContent = ''; if (N) pohled3d.aktualizuj(N, vybranaPoloha()); } catch (e) { $('stav3d').textContent = '3D se nepodařilo spustit: ' + e.message; } };
    if (window.THREE) hotovo(); else nactiSkript('lib/three.0.160.0.min.js').then(hotovo).catch((e) => { nacita = false; $('stav3d').textContent = 'three.js se nenačetl: ' + e.message; });
  }
  new IntersectionObserver((z) => { if (z.some((x) => x.isIntersecting)) nacti3d(); }, { rootMargin: '200px' }).observe($('obal3d'));
  $('b3dVychozi').addEventListener('click', () => pohled3d && pohled3d.pohled(-125, 20));
  $('b3dBok').addEventListener('click', () => pohled3d && pohled3d.pohled(-90, 4));
  $('b3dRozloz').addEventListener('click', () => { const a = $('b3dRozloz').getAttribute('aria-pressed') !== 'true'; $('b3dRozloz').setAttribute('aria-pressed', String(a)); if (pohled3d) pohled3d.rozloz(a); });
  $('b3dMontaz').addEventListener('click', () => { $('b3dRozloz').setAttribute('aria-pressed', 'false'); if (pohled3d) pohled3d.montaz(); });
  for (const [id, k] of [['b3dDite', 'dite'], ['b3dStul', 'stul']]) $(id).addEventListener('click', () => { const a = $(id).getAttribute('aria-pressed') !== 'true'; $(id).setAttribute('aria-pressed', String(a)); if (pohled3d) pohled3d.zobrazit({ [k]: a }); });

  /* ---------- projekty ---------- */
  function vykresliProjekty() { const P = projekty(), j = Object.keys(P).sort((a, b) => a.localeCompare(b, 'cs')); $('seznamProjektu').innerHTML = j.length ? j.map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join('') : '<option value="">– zatím nic –</option>'; }
  $('btnUlozit').addEventListener('click', async () => {
    let j = (S.nazev || '').trim(); if (!j) { j = await Dialog.zeptej('Název projektu', 'Rostoucí židle'); if (!j) return; j = j.trim(); S.nazev = j; $('nazevProjektu').value = j; }
    const P = projekty(); if (P[j] && !(await Dialog.potvrd(`Projekt „${j}“ už existuje. Přepsat?`))) return;
    P[j] = JSON.parse(JSON.stringify(S)); try { localStorage.setItem(KLIC_PROJEKTY, JSON.stringify(P)); vykresliProjekty(); $('seznamProjektu').value = j; toast('Uloženo.'); } catch (e) { toast('Úložiště je plné.', true); }
  });
  const nactiProj = (u) => { S = slouc(u); formulare(); prepocti(); };
  $('btnNacist').addEventListener('click', () => { const P = projekty(), j = $('seznamProjektu').value; if (P[j]) nactiProj(P[j]); });
  $('btnSmazat').addEventListener('click', async () => { const P = projekty(), j = $('seznamProjektu').value; if (!P[j] || !(await Dialog.potvrd(`Smazat „${j}“?`))) return; delete P[j]; try { localStorage.setItem(KLIC_PROJEKTY, JSON.stringify(P)); } catch (e) { /* */ } vykresliProjekty(); });
  $('btnExport').addEventListener('click', () => stahni(JSON.stringify(Object.assign({ aplikace: 'rostouci_zidle' }, S), null, 1), zaklad() + '.json', 'application/json'));
  $('btnImport').addEventListener('click', () => $('souborProjekt').click());
  $('souborProjekt').addEventListener('change', async () => { const f = $('souborProjekt').files[0]; $('souborProjekt').value = ''; if (!f) return; try { const u = JSON.parse(await f.text()); if (!u || !u.p || u.p.stul == null) throw new Error('soubor není projekt rostoucí židle'); nactiProj(u); toast('Importováno.'); } catch (e) { toast('Import se nepodařil: ' + e.message, true); } });
  $('btnReset').addEventListener('click', async () => { if (await Dialog.potvrd('Vrátit výchozí nastavení?')) { S = vychozi(); formulare(); prepocti(); } });

  /* ---------- záložky ---------- */
  for (const id of ['zalozky', 'zalozkyNahled']) $(id).addEventListener('click', (e) => {
    const b = e.target.closest('button[data-z]'); if (!b) return;
    for (const x of $(id).querySelectorAll('button[data-z]')) x.setAttribute('aria-selected', String(x === b));
    for (const p of $(id).parentElement.querySelectorAll(':scope > .panel')) p.hidden = p.dataset.p !== b.dataset.z;
  });

  formulare(); vykresliProjekty(); prepocti();
  window.RZApp = { get stav() { return S; }, get navrh() { return N; }, prepocti, ukazPolohu, get pohled3d() { return pohled3d; }, nactiManifold };
})();
