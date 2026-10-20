/* ============================================================
   Dřevěné hračky a dětský nábytek – uživatelské rozhraní
   ============================================================ */
(function () {
  'use strict';
  const DH = window.DH, DHV = window.DHV, DHSTL = window.DHSTL;
  const $ = (id) => document.getElementById(id);
  const KLIC = 'webapp_drevene_hracky', KLIC_PROJEKTY = 'webapp_drevene_hracky_projekty';
  const cz = DH.cz;
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const toast = (t, ch) => (window.Dialog ? (ch ? Dialog.chyba(t) : Dialog.info(t)) : console.log(t));
  const REZIMY = DH.PORADI.filter((k) => DH.GEN[k]);
  const SPOL_POLE = ['vek', 'material', 'povrch', 'zaobleni', 'kerf'];
  const NAST_POLE = ['papir', 'okraj', 'prekryv', 'papirW', 'papirH', 'stulW', 'stulH', 'stulMezera', 'popisy', 'kalibX', 'kalibY', 'stlVule', 'stlStul'];

  /* ---------- stav ---------- */
  function slouc(P, u) {
    if (DH.GEN[u.rezim]) P.rezim = u.rezim;
    for (const r of REZIMY) if (u.p && u.p[r]) P.p[r] = Object.assign(P.p[r], u.p[r]);
    P.spol = Object.assign(P.spol, u.spol || {});
    P.nast = Object.assign(P.nast, u.nast || {});
    P.nazev = u.nazev || '';
    P.data = Object.assign({}, u.data || {});
    return P;
  }
  function nacistStav() {
    const P = DH.vychoziProjekt();
    try { const u = JSON.parse(localStorage.getItem(KLIC) || 'null'); if (u && u.p) return slouc(P, u); } catch (e) { /* poškozené úložiště */ }
    P.data = {};
    return P;
  }
  let S = nacistStav(), N = null, ulozTimer = 0, importPolys = null, obrazek = null;   // obrazek: {data (dataURL JPEG), w, h, img}
  const uloz = () => { clearTimeout(ulozTimer); ulozTimer = setTimeout(() => { try { localStorage.setItem(KLIC, JSON.stringify(S)); } catch (e) { /* plné úložiště */ } }, 250); };
  const projekty = () => { try { return JSON.parse(localStorage.getItem(KLIC_PROJEKTY) || '{}') || {}; } catch (e) { return {}; } };
  const ulozProjekty = (o) => { try { localStorage.setItem(KLIC_PROJEKTY, JSON.stringify(o)); return true; } catch (e) { toast('Úložiště prohlížeče je plné.', true); return false; } };

  /* ---------- IndexedDB pro obrázek puzzle ---------- */
  const IDB = 'webapp_drevene_hracky_obrazky';
  function db() {
    return new Promise((ok, chyba) => {
      if (!window.indexedDB) { chyba(new Error('IndexedDB není k dispozici')); return; }
      const r = indexedDB.open(IDB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('obrazky');
      r.onsuccess = () => ok(r.result); r.onerror = () => chyba(r.error);
    });
  }
  async function idbUloz(klic, hodnota) { try { const d = await db(); await new Promise((ok, ch) => { const t = d.transaction('obrazky', 'readwrite'); hodnota == null ? t.objectStore('obrazky').delete(klic) : t.objectStore('obrazky').put(hodnota, klic); t.oncomplete = ok; t.onerror = () => ch(t.error); }); } catch (e) { console.warn(e); } }
  async function idbNacti(klic) { try { const d = await db(); return await new Promise((ok, ch) => { const r = d.transaction('obrazky').objectStore('obrazky').get(klic); r.onsuccess = () => ok(r.result || null); r.onerror = () => ch(r.error); }); } catch (e) { return null; } }

  /* ---------- režimy ---------- */
  function vykresliRezimy() {
    $('rezimy').innerHTML = REZIMY.map((k, i) => { const g = DH.GEN[k]; return `<button type="button" data-rezim="${k}" aria-pressed="${k === S.rezim}" title="${esc(g.popis)} (klávesa ${i + 1})"><span class="ik" aria-hidden="true">${g.ikona}</span>${esc(g.nazev)}<kbd>${i + 1}</kbd></button>`; }).join('');
  }
  function nastavRezim(k) {
    if (!DH.GEN[k] || k === S.rezim) return;
    S.rezim = k;
    for (const b of $('rezimy').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.rezim === k));
    vykresliPole(); prepocti(); if (pohled3d) pohled3d.zastav();
  }
  $('rezimy').addEventListener('click', (e) => { const b = e.target.closest('button[data-rezim]'); if (b) nastavRezim(b.dataset.rezim); });

  /* ---------- formulář ---------- */
  function vykresliPole() {
    const g = DH.GEN[S.rezim], p = S.p[S.rezim];
    $('nazevRezimu').textContent = g.nazev;
    $('popisRezimu').textContent = g.popis;
    $('predvolba').innerHTML = '<option value="">– vyberte předvolbu –</option>' + g.predvolby.map((q) => `<option value="${esc(q.id)}">${esc(q.nazev)}</option>`).join('');
    let h = '';
    for (const f of g.pole) {
      if (f.sk) { h += `<div class="skupina" data-sk="${esc(f.sk)}">${esc(f.sk)}</div>`; continue; }
      const id = 'p_' + f.k, v = p[f.k];
      if (f.t === 'b') h += `<div class="cela" data-pole="${f.k}"><label class="chk"><input type="checkbox" id="${id}"${v ? ' checked' : ''}> ${esc(f.n)}</label></div>`;
      else if (f.t === 'v') h += `<div class="${f.n.length > 30 ? 'cela' : ''}" data-pole="${f.k}"><label for="${id}">${esc(f.n)}</label><select id="${id}">${f.m.map(([a, b]) => `<option value="${esc(a)}"${String(v) === String(a) ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select></div>`;
      else h += `<div class="${f.n.length > 34 ? 'cela' : ''}" data-pole="${f.k}"><label for="${id}">${esc(f.n)}</label><input id="${id}" type="number" inputmode="decimal" value="${esc(v)}"${f.min != null ? ` min="${f.min}"` : ''}${f.max != null ? ` max="${f.max}"` : ''} step="${f.krok || 1}"></div>`;
    }
    $('pole').innerHTML = h;
    viditelnostPoli();
  }
  function viditelnostPoli() {
    const g = DH.GEN[S.rezim], p = DH.normalizuj(S.rezim, S.p[S.rezim]);
    let sk = null, vid = false;
    const zavri = () => { if (sk) { const el = $('pole').querySelector(`[data-sk="${CSS.escape(sk)}"]`); if (el) el.classList.toggle('skryte', !vid); } };
    for (const f of g.pole) {
      if (f.sk) { zavri(); sk = f.sk; vid = false; continue; }
      const el = $('pole').querySelector(`[data-pole="${f.k}"]`), ukaz = !(f.ukaz && !f.ukaz(p));
      if (el) el.classList.toggle('skryte', !ukaz);
      if (ukaz) vid = true;
    }
    zavri();
    $('blokSvg').classList.toggle('skryte', !(S.rezim === 'zviratka' && p.tvar === 'import'));
    $('blokObrazek').classList.toggle('skryte', S.rezim !== 'puzzle');
  }
  const zmenaPole = (e) => {
    const el = e.target; if (!el.id || !el.id.startsWith('p_')) return;
    const k = el.id.slice(2), f = DH.GEN[S.rezim].pole.find((q) => q.k === k); if (!f) return;
    S.p[S.rezim][k] = f.t === 'b' ? el.checked : f.t === 'v' ? el.value : el.value === '' ? S.p[S.rezim][k] : parseFloat(String(el.value).replace(',', '.'));
    viditelnostPoli(); naplanuj();
  };
  $('pole').addEventListener('input', zmenaPole);
  $('pole').addEventListener('change', (e) => { if (e.target.tagName === 'SELECT' || e.target.type === 'checkbox') zmenaPole(e); });
  $('predvolba').addEventListener('change', () => {
    const g = DH.GEN[S.rezim], q = g.predvolby.find((x) => x.id === $('predvolba').value); if (!q) return;
    S.p[S.rezim] = Object.assign(JSON.parse(JSON.stringify(g.vychozi)), q.p);
    vykresliPole(); $('predvolba').value = q.id; prepocti();
  });

  /* ---------- společné, tisk, STL ---------- */
  $('material').innerHTML = Object.entries(DH.MATERIALY).map(([k, m]) => `<option value="${k}">${esc(m.nazev)}</option>`).join('');
  $('povrch').innerHTML = Object.entries(DH.POVRCHY).map(([k, m]) => `<option value="${k}">${esc(m.nazev)}</option>`).join('');
  function doFormulare() {
    for (const id of SPOL_POLE) { const el = $(id); el.value = S.spol[id]; }
    for (const id of NAST_POLE) { const el = $(id); if (!el) continue; if (el.type === 'checkbox') el.checked = S.nast[id] !== false; else el.value = S.nast[id]; }
    $('nazevProjektu').value = S.nazev || '';
    $('blokPapir').classList.toggle('skryte', S.nast.papir !== 'vlastni');
  }
  for (const id of SPOL_POLE) $(id).addEventListener(($(id).tagName === 'SELECT') ? 'change' : 'input', () => { const el = $(id); S.spol[id] = el.tagName === 'SELECT' ? el.value : (isFinite(parseFloat(el.value)) ? parseFloat(String(el.value).replace(',', '.')) : S.spol[id]); naplanuj(); });
  for (const id of NAST_POLE) {
    const el = $(id); if (!el) continue;
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => {
      if (el.type === 'checkbox') S.nast[id] = el.checked; else if (el.tagName === 'SELECT') S.nast[id] = el.value;
      else { const x = parseFloat(String(el.value).replace(',', '.')); if (isFinite(x)) S.nast[id] = x; }
      $('blokPapir').classList.toggle('skryte', S.nast.papir !== 'vlastni');
      naplanujVystupy();
    });
  }
  $('nazevProjektu').addEventListener('input', () => { S.nazev = $('nazevProjektu').value; uloz(); });

  /* ---------- přepočet ---------- */
  let timer = 0, timerV = 0;
  const naplanuj = () => { clearTimeout(timer); timer = setTimeout(prepocti, 90); };
  const naplanujVystupy = () => { clearTimeout(timerV); timerV = setTimeout(() => { vykresliNahledy(); uloz(); }, 120); };
  const dataNavrhu = () => ({ importPolys, importNazev: S.data.svgNazev || 'vlastní tvar', obrazekPomer: obrazek ? obrazek.w / obrazek.h : S.data.obrazekPomer || 0, maObrazek: !!obrazek });
  function prepocti() {
    try { N = DH.navrh(Object.assign({}, S, { data: dataNavrhu() })); }
    catch (e) { console.error(e); $('varovani').innerHTML = `<li class="chyba">${esc(e.message)}</li>`; return; }
    $('info').innerHTML = N.info.map((t) => `<p>${esc(t)}</p>`).join('');
    $('varovani').innerHTML = N.varovani.map((v) => `<li>${esc(v)}</li>`).join('');
    const m = DH.MATERIALY[S.spol.material];
    $('infoMat').textContent = m ? `${m.hustota} kg/m³ – ${m.pozn}` : '';
    vykresliKusovnik(); vykresliBezpecnost(); vykresliTabulky(); vykresliNahledy(); vykresliStl();
    $('princip').innerHTML = DHPrincip.princip(S.rezim);
    $('postup').innerHTML = DHPrincip.postup(S.rezim);
    $('zdroje').innerHTML = DHPrincip.zdroje();
    $('b3dKulicka').classList.toggle('skryte', !N.sim);
    $('b3dSklad').classList.toggle('skryte', !(N.animace && N.animace.sklad));
    $('zalRezplan').classList.toggle('skryte', !N.rezPlan);
    if (!N.rezPlan && $('zalRezplan').getAttribute('aria-selected') === 'true') prepniZalozku('zalozkyNahled', 'dily');
    aktualizuj3d();
    uloz();
  }
  function vykresliKusovnik() {
    $('tabKusovnik').innerHTML = '<tr><th>poz.</th><th>název</th><th>ks</th><th>rozměr (mm)</th><th>materiál</th><th>poznámka</th></tr>' + N.kusovnik.map((k) => `<tr><td class="c">${k.poz}</td><td>${esc(k.nazev)}</td><td class="c">${esc(k.ks)}</td><td>${esc(k.rozmer)}</td><td>${esc(k.mat || '')}</td><td>${esc(k.pozn)}</td></tr>`).join('');
    $('infoHmotnost').textContent = N.hmotnost ? `Hmotnost dřeva ≈ ${cz(N.hmotnost, 2)} kg (${(DH.MATERIALY[S.spol.material] || {}).nazev}, ${DH.hustota(S.spol.material)} kg/m³).` : '';
  }
  function vykresliBezpecnost() {
    const poc = { ok: 0, pozor: 0, chyba: 0 };
    for (const b of N.bezpecnost) poc[b.u]++;
    $('souhrnBezp').innerHTML = `<span class="ok">✓ ${poc.ok} v pořádku</span><span style="color:var(--warn)">! ${poc.pozor} pozor</span><span class="chyba">✕ ${poc.chyba} nevyhovuje</span><span>věk ${cz(+S.spol.vek, 1)} r.</span>`;
    const por = { chyba: 0, pozor: 1, ok: 2 };
    $('seznamBezp').innerHTML = N.bezpecnost.slice().sort((a, b) => por[a.u] - por[b.u]).map((b) => `<li class="${b.u}"><span class="z" aria-hidden="true">${b.u === 'ok' ? '✓' : b.u === 'pozor' ? '!' : '✕'}</span><span>${esc(b.t)}</span></li>`).join('');
    const zal = document.querySelector('#zalozky button[data-z="bezpecnost"]');
    zal.textContent = 'Bezpečnost' + (poc.chyba ? ` (${poc.chyba} ✕)` : poc.pozor ? ` (${poc.pozor} !)` : ' ✓');
  }
  function vykresliTabulky() {
    let h = '';
    if (N.sim) {
      h += `<h3 class="podnadpis" style="margin:4px 0">Simulace kuličky</h3><p class="info">Čas jízdy ${cz(N.sim.cas, 2)} s, max. rychlost ${cz(N.sim.vMax / 1000, 2)} m/s${N.sim.zastavena ? ` – <b class="chyba">kulička se zastaví v modulu ${N.sim.zastavena.bunka + 1}</b>` : ''}.</p>`;
      if (N.sim.zatacky.length) h += `<div class="tab-obal" style="max-height:260px"><table><tr><th>modul</th><th>rychlost</th><th>mez vyjetí</th><th>stav</th></tr>${N.sim.zatacky.map((z) => `<tr><td class="c">${z.bunka + 1}</td><td class="c">${cz(z.v / 1000, 2)} m/s</td><td class="c">${cz(z.vMax / 1000, 2)} m/s</td><td>${z.ok ? '<span class="ok">v pořádku</span>' : '<span class="chyba">vyjede</span>'}</td></tr>`).join('')}</table></div>`;
      if (N.draha) h += `<h3 class="podnadpis" style="margin:10px 0 4px">Moduly dráhy (pořadí jízdy)</h3><div class="tab-obal" style="max-height:300px"><table><tr><th>#</th><th>patro</th><th>pozice</th><th>typ</th><th>hloubka vstup → výstup</th></tr>${N.draha.bunky.map((c, i) => `<tr><td class="c">${i + 1}</td><td class="c">${c.patro + 1}</td><td>${c.i + 1}/${c.j + 1}/${c.k + 1}</td><td>${esc(c.dilId)} ${c.start ? '(start)' : c.cil ? '(cíl)' : ''}</td><td class="c">${cz(c.eIn)} → ${cz(c.eOut)} mm</td></tr>`).join('')}</table></div>`;
    }
    for (const t of N.tabulky) h += `<h3 class="podnadpis" style="margin:10px 0 4px">${esc(t.nadpis)}</h3><div class="tab-obal" style="max-height:340px"><table><tr>${t.hlavicka.map((x) => `<th>${esc(x)}</th>`).join('')}</tr>${t.radky.map((r) => `<tr>${r.map((x, i) => `<td${i && /^[\d−,.\s]+(mm|kg|N|°|%)?/.test(String(x)) ? ' class="c"' : ''}>${x === 'chyba' ? '<span class="chyba">nevyhovuje</span>' : x === 'pozor' ? '<span style="color:var(--warn)">pozor</span>' : x === 'ok' ? '<span class="ok">v pořádku</span>' : esc(x)}</td>`).join('')}</tr>`).join('')}</table></div>`;
    if (N.kontrola) h += `<h3 class="podnadpis" style="margin:10px 0 4px">Kontrola dílků</h3><p class="info">Plocha obrysu ${cz(N.kontrola.plochaObrysu / 100, 2)} cm², součet dílků ${cz(N.kontrola.plochaDilku / 100, 2)} cm² (rozdíl ${cz(100 * N.kontrola.rozdil, 4)} %), součet překryvů ${cz(N.kontrola.prekryv, 3)} mm², nepokryto ${cz(N.kontrola.zbytek, 3)} mm². Nejužší dílek ${cz(N.kontrola.minSirka)} mm.</p>`;
    if (N.dilky && N.dilky.length) {
      const male = N.dilky.filter((d) => d.malyTest && d.malyTest.maly).length;
      h += `<p class="info">Zkouška malých dílů: ${male ? `<b class="chyba">${male} z ${N.dilky.length} dílků projde válcem Ø 31,7 mm</b>` : `žádný z ${N.dilky.length} dílků neprojde válcem Ø 31,7 mm`}.</p>`;
    }
    if (!h) h = '<p class="info">Pro tento výrobek nejsou další výpočty – viz Bezpečnost a Kusovník.</p>';
    $('tabulky').innerHTML = h;
  }

  /* ---------- náhledy 2D ---------- */
  function vykresliNahledy() {
    if (!N) return;
    const n = S.nast;
    // deska laseru / CNC
    const R = DHV.deska(N, { W: +n.stulW || 600, H: +n.stulH || 400, mezera: +n.stulMezera || 4, popisy: n.popisy !== false, sablony: true });
    let h = '';
    R.plochy.forEach((P, i) => {
      let pod = '';
      if (obrazek && S.rezim === 'puzzle') for (const s of P.sceny) { const sc = R.sceny[s.i]; if (!sc.dil.obrazek) continue; const b = sc.bbDil; pod += `<image href="${obrazek.data}" x="${b.x0 + s.ox}" y="${-(b.y1 + s.oy)}" width="${b.w}" height="${b.h}" preserveAspectRatio="none" opacity="0.85"/>`; }
      const ram = { x0: 0, y0: 0, x1: +n.stulW || 600, y1: +n.stulH || 400 };
      const svg = DHV.svg(P.prvky.concat([{ t: 'l', b: DH.obdelnik(0, 0, ram.x1, ram.y1), s: 0.4, c: '#bbbbbb', z: true, v: 'ram', d: 'c' }]), ram, { sirka100: true, okraj: 4, pod });
      h += `<div><div class="popis">Deska ${i + 1} z ${R.plochy.length} – ${cz(ram.x1, 0)} × ${cz(ram.y1, 0)} mm, ${P.sceny.length} ${P.sceny.length === 1 ? 'díl' : P.sceny.length < 5 ? 'díly' : 'dílů'} (kusy se opakují podle počtu)</div><div class="papir">${svg}</div></div>`;
    });
    for (const i of R.velke) {
      const sc = R.sceny[i];
      let pod = '';
      if (obrazek && sc.dil.obrazek) { const b = sc.bbDil; pod = `<image href="${obrazek.data}" x="${b.x0}" y="${-b.y1}" width="${b.w}" height="${b.h}" preserveAspectRatio="none" opacity="0.85"/>`; }
      h += `<div><div class="popis">${esc(sc.dil.id)} – ${esc(sc.dil.nazev)}: ${cz(sc.x1 - sc.x0, 0)} × ${cz(sc.y1 - sc.y0, 0)} mm – větší než deska laseru (v PDF se rozdělí na listy)</div><div class="papir">${DHV.svg(sc.prvky, sc, { sirka100: true, okraj: 4, pod })}</div></div>`;
    }
    $('nahledDily').innerHTML = h || '<p class="info">Žádné díly.</p>';
    nahledDesky = R;
    // pohledy
    const pv = DHV.pohledy(N);
    $('nahledPohledy').innerHTML = pv.svg || '<p class="info" style="color:#555;padding:10px">Bez 3D těles.</p>';
    // listy PDF
    try {
      const st = DHV.strany(N, n, { nazev: nazevProjektu(), obrazek: obrazek ? { data: obrazek.data, format: 'JPEG' } : null });
      const kus = st.slice(0, 24).map((q, i) => `<div><div class="papir">${stranaSvg(q)}</div><div class="cislo">list ${i + 1}${q.typ === 'text' ? ' – kusovník' : ''}</div></div>`).join('');
      $('nahledListy').innerHTML = kus + (st.length > 24 ? `<p class="info">… a dalších ${st.length - 24} listů</p>` : '');
      const [pw, ph] = DHV.rozmerPapiru(n);
      $('infoListy').innerHTML = `PDF: <b>${st.length}</b> ${st.length === 1 ? 'list' : st.length < 5 ? 'listy' : 'listů'} ${cz(pw, 0)} × ${cz(ph, 0)} mm (kusovník, bezpečnost a šablony 1:1 s kontrolními úsečkami 50/100 mm). Laser: ${R.plochy.length} ${R.plochy.length === 1 ? 'deska' : R.plochy.length < 5 ? 'desky' : 'desek'}${R.velke.length ? ` + ${R.velke.length} větší díl` : ''}.`;
      $('infoListyNahled').textContent = `Náhled listů (${st.length}). Čárkovaně dělení velkých dílů s přesahem ${cz(+n.prekryv, 0)} mm.`;
    } catch (e) { console.error(e); }
    const K = DHV.korekce(n.kalibX, n.kalibY);
    $('kalibVysl').innerHTML = K.platne ? `X ×${cz(K.kx, 4)}<br>Y ×${cz(K.ky, 4)}` : '<span class="chyba">mimo 80–120 mm</span>';
    $('nahledRezplan').innerHTML = N.rezPlan ? DHV.rezPlanSvg(N) : '';
  }
  let nahledDesky = null;
  /** strana PDF → malé SVG (mm papíru, y dolů) */
  function stranaSvg(st) {
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${st.W} ${st.H}" font-family="Liberation Sans, Arial"><rect width="${st.W}" height="${st.H}" fill="#fff"/>`;
    for (const im of st.obrazky || []) s += `<image href="${im.data}" x="${im.x}" y="${im.y}" width="${im.w}" height="${im.h}" preserveAspectRatio="none"/>`;
    const kresli = (e) => {
      if (e.t === 'l') return `<path d="${e.b.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(2) + ' ' + q[1].toFixed(2)).join('')}${e.z ? 'Z' : ''}" fill="none" stroke="${e.c}" stroke-width="${Math.max(0.25, e.s || 0.2)}"${e.d ? ' stroke-dasharray="2 1.5"' : ''}/>`;
      if (e.t === 'e') return `<ellipse cx="${e.x}" cy="${e.y}" rx="${e.rx}" ry="${e.ry}" fill="${e.f ? e.c : 'none'}" stroke="${e.c}" stroke-width="0.25"/>`;
      if (e.t === 'r') return `<rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" fill="${e.f ? '#000' : 'none'}" stroke="${e.c}" stroke-width="0.25"/>`;
      if (e.t === 'm') return e.osa === 'x' ? `<path d="M${e.x0} ${e.y}H${e.x1}" stroke="#000" stroke-width="0.4"/>` : `<path d="M${e.x0} ${e.y}V${e.y1}" stroke="#000" stroke-width="0.4"/>`;
      if (e.t === 'txt') return `<text x="${e.x}" y="${e.y}" font-size="${e.h}" fill="${e.c}" text-anchor="${e.a === 'r' ? 'end' : e.a === 'c' ? 'middle' : 'start'}">${esc(e.txt)}</text>`;
      return '';
    };
    if (st.clip) s += `<clipPath id="k${st.clip.x}"><rect x="${st.clip.x}" y="${st.clip.y}" width="${st.clip.w}" height="${st.clip.h}"/></clipPath><g clip-path="url(#k${st.clip.x})">`;
    s += st.obsah.map(kresli).join('');
    if (st.clip) s += '</g>';
    s += st.navrch.map(kresli).join('');
    return s + '</svg>';
  }

  /* ---------- soubory ---------- */
  function stahni(obsah, nazev, typ) {
    const blob = obsah instanceof Blob ? obsah : new Blob([obsah], { type: typ || 'application/octet-stream' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const nazevProjektu = () => (S.nazev || DH.GEN[S.rezim].nazev);
  const zaklad = () => String(S.nazev || 'drevene_hracky_' + S.rezim).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'drevene_hracky';
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
  $('btnPdf').addEventListener('click', async () => {
    const b = $('btnPdf'), puv = b.textContent; b.disabled = true; b.textContent = 'Připravuji PDF…';
    try {
      if (!window.jspdf) throw new Error('Knihovna jsPDF se nenačetla.');
      const pismo = await nactiPismo();
      if (!pismo) toast('Písmo se nepodařilo načíst – PDF bude bez diakritiky.');
      const st = DHV.strany(N, S.nast, { nazev: nazevProjektu(), obrazek: obrazek ? { data: obrazek.data, format: 'JPEG' } : null });
      const doc = DHV.pdf(window.jspdf.jsPDF, st, { pismo, nazev: nazevProjektu() });
      stahni(doc.output('blob'), zaklad() + '.pdf');
    } catch (e) { console.error(e); toast('Chyba PDF: ' + e.message, true); }
    finally { b.disabled = false; b.textContent = puv; }
  });
  function soubory(typ) {
    const R = nahledDesky || DHV.deska(N, { W: +S.nast.stulW, H: +S.nast.stulH, mezera: +S.nast.stulMezera, popisy: S.nast.popisy !== false });
    const sady = R.plochy.map((P, i) => ({ prvky: P.prvky, ram: { x0: 0, y0: 0, x1: +S.nast.stulW, y1: +S.nast.stulH }, jm: `deska${i + 1}` }));
    for (const i of R.velke) { const sc = R.sceny[i]; sady.push({ prvky: sc.prvky, ram: sc, jm: sc.dil.id }); }
    if (!sady.length) { toast('Žádné díly k exportu.', true); return; }
    for (const s of sady) {
      if (typ === 'svg') stahni(DHV.svg(s.prvky, s.ram, { laser: true, popisy: S.nast.popisy !== false, okraj: 0 }), `${zaklad()}_${s.jm}.svg`, 'image/svg+xml');
      else stahni(DHV.dxf(s.prvky, { popisy: S.nast.popisy !== false }), `${zaklad()}_${s.jm}.dxf`, 'application/dxf');
    }
    if (sady.length > 1) toast(`Staženo ${sady.length} souborů (každá deska zvlášť).`);
  }
  $('btnSvg').addEventListener('click', () => soubory('svg'));
  $('btnDxf').addEventListener('click', () => soubory('dxf'));
  $('btnCsv').addEventListener('click', () => { if (N) stahni('﻿' + DHV.csv(N), zaklad() + '_kusovnik.csv', 'text/csv;charset=utf-8'); });

  /* ---------- import SVG a obrázku ---------- */
  function nactiImport() {
    importPolys = null;
    if (S.data && S.data.svgText) { try { const r = DH.importSvg(S.data.svgText); importPolys = r.polys; $('infoSvg').textContent = `${S.data.svgNazev || 'SVG'}: ${r.pocet} tvarů → ${r.polys.length} obrysů.${r.varovani.length ? ' ' + r.varovani.join(' ') : ''}`; } catch (e) { $('infoSvg').textContent = 'SVG nejde načíst: ' + e.message; } }
    else $('infoSvg').textContent = 'Vyplněné tvary (path, polygon, rect, circle, ellipse) se sjednotí a zmenší na zadanou šířku.';
  }
  $('btnSvgImport').addEventListener('click', () => $('souborSvg').click());
  $('souborSvg').addEventListener('change', async () => {
    const f = $('souborSvg').files[0]; $('souborSvg').value = ''; if (!f) return;
    try {
      const txt = await f.text();
      if (txt.length > 600000) throw new Error('SVG je větší než 600 kB – zjednodušte ho.');
      const r = DH.importSvg(txt);
      if (!r.polys.length) throw new Error(r.varovani.join(' ') || 'žádné tvary');
      S.data.svgText = txt; S.data.svgNazev = f.name.replace(/\.svg$/i, '');
      nactiImport(); prepocti(); toast(`Import: ${r.polys.length} obrysů.`);
    } catch (e) { toast('Import SVG se nepodařil: ' + e.message, true); }
  });
  $('btnSvgSmaz').addEventListener('click', () => { delete S.data.svgText; delete S.data.svgNazev; nactiImport(); prepocti(); });

  async function nastavObrazek(dataUrl) {
    if (!dataUrl) { obrazek = null; $('nahledObrazku').classList.add('skryte'); return; }
    const img = new Image();
    await new Promise((ok, ch) => { img.onload = ok; img.onerror = ch; img.src = dataUrl; });
    obrazek = { data: dataUrl, w: img.naturalWidth, h: img.naturalHeight, img };
    S.data.obrazekPomer = obrazek.w / obrazek.h;
    $('nahledObrazku').src = dataUrl; $('nahledObrazku').classList.remove('skryte');
    $('infoObrazek').textContent = `${obrazek.w} × ${obrazek.h} px · pro tisk 1:1 na ${cz(+S.p.puzzle.W, 0)} mm ≈ ${cz(obrazek.w / (+S.p.puzzle.W / 25.4), 0)} dpi. Uloženo jen v tomto prohlížeči.`;
  }
  $('btnObrazek').addEventListener('click', () => $('souborObrazek').click());
  $('souborObrazek').addEventListener('change', async () => {
    const f = $('souborObrazek').files[0]; $('souborObrazek').value = ''; if (!f) return;
    try {
      const url = URL.createObjectURL(f), img = new Image();
      await new Promise((ok, ch) => { img.onload = ok; img.onerror = () => ch(new Error('soubor není obrázek')); img.src = url; });
      const max = 2400, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const data = c.toDataURL('image/jpeg', 0.9);
      await nastavObrazek(data); await idbUloz('puzzle', data);
      prepocti(); if (pohled3d) aktualizuj3d(true);
    } catch (e) { toast('Obrázek nejde načíst: ' + e.message, true); }
  });
  $('btnObrazekSmaz').addEventListener('click', async () => { await nastavObrazek(null); await idbUloz('puzzle', null); delete S.data.obrazekPomer; prepocti(); aktualizuj3d(true); $('infoObrazek').textContent = 'Obrázek zůstane jen v tomto prohlížeči (IndexedDB).'; });

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
  function vykresliStl() {
    const st = N.stl || [];
    $('kartaStl').classList.toggle('skryte', !st.length);
    const puv = $('stlDil').value;
    $('stlDil').innerHTML = st.map((q) => `<option value="${esc(q.id)}">${esc(q.nazev)}${q.ks ? ` (potřeba ${q.ks} ks)` : ''}</option>`).join('');
    if (st.some((q) => q.id === puv)) $('stlDil').value = puv;
    infoStl();
  }
  function infoStl() {
    const id = $('stlDil').value, q = (N.stl || []).find((x) => x.id === id);
    const mat = id === 'kolo' ? 'PETG (houževnaté, nepraská), stěny 3+ perimetry, výplň 30 %' : id === 'kolik' ? 'PETG 100 % výplň + ocelový drát Ø 3 vlepený do středu' : id.startsWith('modul') ? 'PLA, 3 perimetry, výplň 15 %; drážku nahoře – bez podpor' : 'PETG nebo PLA, 100 % výplň (malý díl)';
    $('infoStl').innerHTML = q ? `Tisk bez podpor, ${esc(mat)}. Vůle ${cz(+S.nast.stlVule, 2)} mm se odečte od průměru dříku / přičte k otvoru. Tištěné díly pro děti do 3 let jen tam, kde jsou pevně spojené – volné malé díly ne.` : '';
  }
  $('stlDil').addEventListener('change', infoStl);
  $('btnStl').addEventListener('click', async () => {
    const b = $('btnStl'), puv = b.textContent; b.disabled = true; b.textContent = 'Počítám STL…';
    try {
      await new Promise((r) => setTimeout(r, 20));
      const w = await nactiManifold(), id = $('stlDil').value;
      const m = DHSTL.dil(w, id, N, S.nast, Math.max(1, Math.round(+$('stlKusu').value || 1)));
      stahni(new Blob([DHSTL.stlBinarni(m.poz, m.idx, m.popis)], { type: 'model/stl' }), `${zaklad()}_${id.replace(':', '_')}.stl`);
      for (const v of m.varovani) toast(v);
      toast(`${m.popis}. ${m.kusu} ${m.kusu === 1 ? 'kus' : m.kusu < 5 ? 'kusy' : 'kusů'} na ploše ${cz(m.rozmer[0], 0)} × ${cz(m.rozmer[1], 0)} mm, objem ${cz(m.objem / 1000, 1)} cm³ (uzavřené těleso).`);
    } catch (e) { console.error(e); toast('Chyba STL: ' + e.message, true); }
    finally { b.disabled = false; b.textContent = puv; }
  });

  /* ---------- 3D ---------- */
  let pohled3d = null, nacita3d = false, obrazekVe3d = null;
  function aktualizuj3d(noveObrazky) {
    if (!pohled3d || !N) return;
    const o = {};
    if (noveObrazky || obrazekVe3d !== (obrazek && obrazek.data)) { o.obrazek = obrazek && S.rezim === 'puzzle' ? obrazek.img : null; obrazekVe3d = obrazek && obrazek.data; }
    if (S.rezim !== 'puzzle') o.obrazek = null;
    pohled3d.aktualizuj(N, o);
    $('stav3d').textContent = '';
    $('cas3d').textContent = N.sim ? `jízda ${cz(N.sim.cas, 1)} s` : '';
  }
  function nacti3d() {
    if (pohled3d || nacita3d) return;
    nacita3d = true;
    const hotovo = () => { try { pohled3d = DH3D.vytvor($('obal3d')); pohled3d.rychlost = +$('b3dRychlost').value; aktualizuj3d(true); } catch (e) { $('stav3d').textContent = '3D se nepodařilo spustit: ' + e.message; } };
    if (window.THREE) { hotovo(); return; }
    nactiSkript('lib/three.0.160.0.min.js').then(hotovo).catch((e) => { nacita3d = false; $('stav3d').textContent = 'three.js se nenačetl: ' + e.message; });
  }
  new IntersectionObserver((z) => { if (z.some((x) => x.isIntersecting)) nacti3d(); }, { rootMargin: '200px' }).observe($('obal3d'));
  $('b3dVychozi').addEventListener('click', () => pohled3d && pohled3d.pohled(-35, 28));
  $('b3dShora').addEventListener('click', () => pohled3d && pohled3d.pohled(0, 89));
  $('b3dZepredu').addEventListener('click', () => pohled3d && pohled3d.pohled(0, 4));
  $('b3dSklad').addEventListener('click', () => pohled3d && pohled3d.skladej());
  $('b3dKulicka').addEventListener('click', () => { if (pohled3d && !pohled3d.pustKulicku((t) => { $('cas3d').textContent = `${cz(t, 2)} s / ${cz(N.sim.cas, 1)} s`; })) toast('Kulička není k dispozici.'); });
  $('b3dRychlost').addEventListener('change', () => { if (pohled3d) pohled3d.rychlost = +$('b3dRychlost').value; });

  /* ---------- projekty ---------- */
  function vykresliProjekty() {
    const P = projekty(), jm = Object.keys(P).sort((a, b) => a.localeCompare(b, 'cs'));
    $('seznamProjektu').innerHTML = jm.length ? jm.map((j) => `<option value="${esc(j)}">${esc(j)} – ${esc((DH.GEN[P[j].rezim] || {}).nazev || '')}</option>`).join('') : '<option value="">– zatím nic –</option>';
  }
  $('btnUlozit').addEventListener('click', async () => {
    let jm = (S.nazev || '').trim();
    if (!jm) { jm = await Dialog.zeptej('Název projektu', DH.GEN[S.rezim].nazev); if (!jm) return; jm = jm.trim(); S.nazev = jm; $('nazevProjektu').value = jm; }
    const P = projekty();
    if (P[jm] && !(await Dialog.potvrd(`Projekt „${jm}“ už existuje. Přepsat?`))) return;
    P[jm] = JSON.parse(JSON.stringify(S)); P[jm].ulozeno = new Date().toISOString();
    if (ulozProjekty(P)) { vykresliProjekty(); $('seznamProjektu').value = jm; toast('Projekt uložen' + (obrazek ? ' (obrázek puzzle zůstává jen v tomto prohlížeči).' : '.')); }
    uloz();
  });
  function nactiProjekt(u) { S = slouc(DH.vychoziProjekt(), u); vykresliRezimy(); vykresliPole(); doFormulare(); nactiImport(); prepocti(); }
  $('btnNacist').addEventListener('click', () => { const j = $('seznamProjektu').value, P = projekty(); if (!P[j]) return; nactiProjekt(P[j]); toast('Načteno: ' + j); });
  $('btnSmazat').addEventListener('click', async () => {
    const j = $('seznamProjektu').value, P = projekty(); if (!P[j]) return;
    if (!(await Dialog.potvrd(`Smazat projekt „${j}“?`))) return;
    delete P[j]; ulozProjekty(P); vykresliProjekty();
  });
  $('btnExport').addEventListener('click', () => stahni(JSON.stringify(Object.assign({ aplikace: 'drevene_hracky', exportovano: new Date().toISOString() }, JSON.parse(JSON.stringify(S))), null, 1), zaklad() + '.json', 'application/json'));
  $('btnImport').addEventListener('click', () => $('souborProjekt').click());
  $('souborProjekt').addEventListener('change', async () => {
    const f = $('souborProjekt').files[0]; $('souborProjekt').value = ''; if (!f) return;
    try {
      const u = JSON.parse(await f.text());
      if (!u || typeof u !== 'object' || !u.p || !DH.GEN[u.rezim]) throw new Error('soubor není projekt dřevěných hraček');
      nactiProjekt(u); toast('Projekt importován.');
    } catch (e) { toast('Import se nepodařil: ' + e.message, true); }
  });
  $('btnReset').addEventListener('click', async () => {
    if (!(await Dialog.potvrd('Vrátit všechny parametry na výchozí hodnoty? (Uložené projekty zůstanou.)'))) return;
    const r = S.rezim, d = S.data; S = DH.vychoziProjekt(r); S.data = d || {}; vykresliRezimy(); vykresliPole(); doFormulare(); prepocti();
  });

  /* ---------- záložky a klávesy ---------- */
  function prepniZalozku(obal, z) {
    const o = $(obal);
    for (const x of o.querySelectorAll('button[data-z]')) x.setAttribute('aria-selected', String(x.dataset.z === z));
    for (const p of o.parentElement.querySelectorAll(':scope > .panel')) p.hidden = p.dataset.p !== z;
  }
  for (const id of ['zalozky', 'zalozkyNahled']) $(id).addEventListener('click', (e) => { const b = e.target.closest('button[data-z]'); if (b) prepniZalozku(id, b.dataset.z); });
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    if (m && REZIMY[+m[1] - 1]) { e.preventDefault(); nastavRezim(REZIMY[+m[1] - 1]); }
  });

  /* ---------- start ---------- */
  vykresliRezimy(); vykresliPole(); doFormulare(); vykresliProjekty(); nactiImport(); prepocti();
  idbNacti('puzzle').then(async (d) => { if (d) { try { await nastavObrazek(d); prepocti(); aktualizuj3d(true); } catch (e) { /* poškozený obrázek */ } } });
  window.DHApp = { get stav() { return S; }, get navrh() { return N; }, nastavRezim, prepocti, nactiManifold, get pohled3d() { return pohled3d; }, nastavObrazek, stranaSvg };
})();
