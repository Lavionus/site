/* ============================================================
   Návrh skříní – uživatelské rozhraní
   Stav S = projekt {nazev, N (nastavení), korpusy[]}; formuláře se vážou přes data-k="cesta":
   N.… = nastavení, K.… = vybraný korpus, C<i>.… = sloupec i vybraného korpusu, nazev = název projektu.
   ============================================================ */
(function () {
  'use strict';
  const NS = window.NS, NSV = window.NSV;
  const $ = (id) => document.getElementById(id);
  const KLIC = 'webapp_navrh_skrini', KLIC_PROJEKTY = 'webapp_navrh_skrini_projekty', KLIC_UI = 'webapp_navrh_skrini_ui';
  const cz = (x) => (x == null || !isFinite(x) ? '–' : String(Math.round(x * 10) / 10).replace('.', ',').replace('-', '−'));
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const toast = (t, ch) => (window.Dialog ? (ch ? Dialog.chyba(t) : Dialog.info(t)) : console.log(t));

  /* ---------- stav ---------- */
  function nactiStav() {
    try { const u = JSON.parse(localStorage.getItem(KLIC) || 'null'); if (u && Array.isArray(u.korpusy)) return NS.normalizuj(u); } catch (e) { /* poškozené úložiště */ }
    return NS.vychoziProjekt();
  }
  let S = nactiStav(), V = null;
  let U = { k: 0, pohled: 'sestava', zalozka: 'kusovnik', dilec: '', strana: '' };
  try { Object.assign(U, JSON.parse(localStorage.getItem(KLIC_UI) || '{}')); } catch (e) { /* nic */ }
  let ulozTimer = 0;
  const uloz = () => { clearTimeout(ulozTimer); ulozTimer = setTimeout(() => { try { localStorage.setItem(KLIC, JSON.stringify(S)); localStorage.setItem(KLIC_UI, JSON.stringify(U)); } catch (e) { /* plné úložiště */ } }, 300); };
  const kor = () => S.korpusy[Math.min(U.k, S.korpusy.length - 1)];
  const projekty = () => { try { return JSON.parse(localStorage.getItem(KLIC_PROJEKTY) || '{}') || {}; } catch (e) { return {}; } };
  const ulozProjekty = (o) => { try { localStorage.setItem(KLIC_PROJEKTY, JSON.stringify(o)); return true; } catch (e) { toast('Úložiště prohlížeče je plné.', true); return false; } };

  /* ---------- vazba formulářů ---------- */
  function cesta(p) {
    const c = p.split('.');
    let o;
    if (c[0] === 'N') o = S.N; else if (c[0] === 'K') o = kor(); else if (/^C\d+$/.test(c[0])) o = kor().sloupce[+c[0].slice(1)]; else return [S, c[0]];
    for (let i = 1; i < c.length - 1; i++) { if (o[c[i]] == null || typeof o[c[i]] !== 'object') o[c[i]] = {}; o = o[c[i]]; }
    return [o, c[c.length - 1]];
  }
  function hodnota(el) {
    if (el.type === 'checkbox') return el.checked;
    if (el.dataset.typ === 'pole') return el.value.split(/[;,\s]+/).map((x) => NS.cislo(x, NaN)).filter((x) => isFinite(x) && x > 0);
    if (el.type === 'number') return NS.cislo(el.value, 0);
    return el.value;
  }
  function napln(koren) {
    for (const el of (koren || document).querySelectorAll('[data-k]')) {
      const [o, k] = cesta(el.dataset.k), v = o ? o[k] : '';
      if (el.type === 'checkbox') el.checked = !!v;
      else if (el.dataset.typ === 'pole') el.value = (v || []).join(', ');
      else if (document.activeElement !== el) el.value = v == null ? '' : v;
    }
  }
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-k]');
    if (!el || el.type === 'checkbox' || el.tagName === 'SELECT') return;
    nastav(el);
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-k]');
    if (!el) return;
    nastav(el);
    if (el.dataset.k === 'N.zasuvky.vysuv' && NS.VYSUVY[el.value]) { S.N.zasuvky.vule = NS.VYSUVY[el.value].vule; napln(); }
    if (el.dataset.prekreslit) { vykresliKorpusy(); }
  });
  function nastav(el) {
    const [o, k] = cesta(el.dataset.k);
    if (!o) return;
    const v = hodnota(el);
    if (el.type === 'number' && el.value.trim() === '') return;
    o[k] = v;
    if (el.dataset.k.startsWith('K.') || /^C\d/.test(el.dataset.k)) vykresliSeznam();
    prepocti();
  }

  /* ---------- předvolby ---------- */
  function vykresliPredvolby() {
    $('predvolby').innerHTML = Object.entries(NS.PREDVOLBY).map(([id, p]) => `<button type="button" data-p="${id}" aria-pressed="${S.predvolba === id}" title="${esc(p.popis)}">${esc(p.nazev)}</button>`).join('');
    const p = NS.PREDVOLBY[S.predvolba];
    $('popisPredvolby').textContent = p ? p.popis : 'Vlastní projekt.';
  }
  $('predvolby').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-p]');
    if (!b) return;
    if (!(await Dialog.potvrd(`Načíst předvolbu „${NS.PREDVOLBY[b.dataset.p].nazev}“? Rozpracovaný návrh se přepíše (uložte si ho v Projektech).`))) return;
    S = NS.projektZPredvolby(b.dataset.p); U.k = 0; U.dilec = '';
    vse();
  });

  /* ---------- seznam korpusů a formulář korpusu ---------- */
  function vykresliSeznam() {
    $('seznamKorpusu').innerHTML = S.korpusy.map((k, i) => `<button type="button" role="tab" data-i="${i}" aria-pressed="${i === U.k}" aria-selected="${i === U.k}">K${i + 1} ${esc(k.nazev)} <small>${k.rada === 'horni' ? '▲' : '▼'} ${cz(k.sirka)}</small></button>`).join('');
    $('pocetKorpusu').textContent = `${S.korpusy.length} ks · ▼ dolní / stojící, ▲ horní`;
  }
  const opt = (pole, v) => pole.map(([a, b]) => `<option value="${a}"${String(v) === String(a) ? ' selected' : ''}>${esc(b)}</option>`).join('');
  function vykresliKorpusy() {
    U.k = Math.max(0, Math.min(U.k, S.korpusy.length - 1));
    vykresliSeznam();
    const k = kor(), horni = k.rada === 'horni';
    let h = `<div class="r2"><div><label for="k_nazev">Název</label><input id="k_nazev" data-k="K.nazev" type="text" maxlength="40"></div>
      <div><label for="k_rada">Řada</label><select id="k_rada" data-k="K.rada" data-prekreslit="1">${opt([['dolni', 'dolní / stojící'], ['horni', 'horní (zavěšená)']], k.rada)}</select></div></div>
      <div class="r4"><div><label for="k_s">Šířka</label><input id="k_s" data-k="K.sirka" type="number" min="100" max="3000" step="1"></div>
      <div><label for="k_v">Výška</label><input id="k_v" data-k="K.vyska" type="number" min="150" max="2800" step="1"></div>
      <div><label for="k_h">Hloubka</label><input id="k_h" data-k="K.hloubka" type="number" min="100" max="1200" step="1"></div>
      <div><label for="k_m">Mezera před</label><input id="k_m" data-k="K.mezeraPred" type="number" min="0" max="2000" step="1" title="volné místo vlevo od korpusu (spotřebič, lednice)"></div></div>
      <div class="skupina">Konstrukce</div>
      <div class="r3"><div><label for="k_dno">Dno</label><select id="k_dno" data-k="K.dno">${opt([['mezi', 'mezi boky (bok přes dno)'], ['pod', 'pod boky (dno přes bok)']], k.dno)}</select></div>
      <div><label for="k_strop">Strop</label><select id="k_strop" data-k="K.strop">${opt([['mezi', 'mezi boky'], ['nad', 'přes boky'], ['traverzy', 'traverzy']], k.strop)}</select></div>
      <div><label for="k_spoj">Spojování</label><select id="k_spoj" data-k="K.spoj">${opt([['konfirmat', 'konfirmáty'], ['kolik', 'kolíky (lepené)'], ['excentr', 'excentry + kolíky']], k.spoj)}</select></div></div>
      <div class="r2"><div><label for="k_zada">Záda</label><select id="k_zada" data-k="K.zada">${opt([['drazka', 'v drážce'], ['pribita', 'přibitá zezadu'], ['vlozena', 'vložená mezi boky']], k.zada)}</select></div>
      <div>${!horni ? `<label class="chk"><input type="checkbox" data-k="K.podDeskou"> pod pracovní deskou</label>` : ''}</div></div>`;
    if (!horni) h += `<div class="r3"><div><label for="k_sokl">Sokl</label><select id="k_sokl" data-k="K.sokl.typ">${opt([['zadny', 'bez soklu'], ['boky', 'boky na zem + lišta'], ['nozicky', 'nožičky + klip. sokl']], k.sokl.typ)}</select></div>
      <div><label for="k_sv">Výška soklu</label><input id="k_sv" data-k="K.sokl.vyska" type="number" min="0" max="300" step="1"></div>
      <div><label for="k_so">Odsazení soklu</label><input id="k_so" data-k="K.sokl.odsazeni" type="number" min="0" max="150" step="1"></div></div>`;
    $('formKorpus').innerHTML = h;
    napln($('formKorpus'));
    vykresliSloupce();
  }
  function vykresliSloupce() {
    const k = kor();
    $('pocetSloupcu').value = k.sloupce.length;
    $('formSloupce').innerHTML = k.sloupce.map((s, i) => `<div class="sloupec"><h3>Sloupec ${i + 1}</h3>
      <div class="r3"><div><label for="c${i}s">Šířka světle</label><input id="c${i}s" data-k="C${i}.sirka" type="number" min="0" max="3000" step="1"></div>
      <div><label for="c${i}d">Dvířka</label><select id="c${i}d" data-k="C${i}.dvirka">${opt([['zadne', 'žádná (otevřené)'], ['L', 'jedna – závěsy vlevo'], ['P', 'jedna – závěsy vpravo'], ['dvoje', 'dvoje']], s.dvirka)}</select></div>
      <div><label for="c${i}z">Zásuvky (ks)</label><input id="c${i}z" data-k="C${i}.zasuvky" type="number" min="0" max="10" step="1"></div></div>
      <div class="r4"><div><label for="c${i}zv">Zóna zás. (mm)</label><input id="c${i}zv" data-k="C${i}.vyskaZas" type="number" min="0" max="2500" step="1" title="světlá výška zóny zásuvek; 0 = automaticky"></div>
      <div><label for="c${i}zp">Poměry čel</label><input id="c${i}zp" data-k="C${i}.pomeryZas" type="text" placeholder="1:1:2" title="poměry výšek čel zdola, např. 1:1:2"></div>
      <div><label for="c${i}p">Police (ks)</label><input id="c${i}p" data-k="C${i}.police" type="number" min="0" max="20" step="1"></div>
      <div><label for="c${i}pt">Typ polic</label><select id="c${i}pt" data-k="C${i}.typPolic">${opt([['stavitelne', 'stavitelné'], ['pevne', 'pevné']], s.typPolic)}</select></div></div></div>`).join('');
    napln($('formSloupce'));
  }
  $('pocetSloupcu').addEventListener('change', () => {
    const n = Math.max(1, Math.min(8, Math.round(NS.cislo($('pocetSloupcu').value, 1)))), k = kor();
    while (k.sloupce.length < n) k.sloupce.push(NS.novySloupec(Object.assign({}, k.sloupce[k.sloupce.length - 1], { sirka: 0 })));
    k.sloupce.length = n;
    vykresliSloupce(); prepocti();
  });
  $('seznamKorpusu').addEventListener('click', (e) => { const b = e.target.closest('button[data-i]'); if (!b) return; U.k = +b.dataset.i; vykresliKorpusy(); prepocti(); });
  $('kPridat').addEventListener('click', () => { S.korpusy.push(NS.novyKorpus({ nazev: 'Skříňka ' + (S.korpusy.length + 1) })); U.k = S.korpusy.length - 1; vykresliKorpusy(); prepocti(); });
  $('kPridatH').addEventListener('click', () => { S.korpusy.push(NS.novyKorpus({ nazev: 'Horní ' + (S.korpusy.length + 1), rada: 'horni', vyska: 720, hloubka: 320, strop: 'mezi', podDeskou: false, sloupce: [{ police: 2, dvirka: 'L' }] })); U.k = S.korpusy.length - 1; vykresliKorpusy(); prepocti(); });
  $('kDuplikovat').addEventListener('click', () => { const c = NS.kopie(kor()); c.nazev += ' (kopie)'; S.korpusy.splice(U.k + 1, 0, c); U.k++; vykresliKorpusy(); prepocti(); });
  $('kSmazat').addEventListener('click', async () => {
    if (S.korpusy.length < 2) { toast('Projekt musí mít aspoň jeden korpus.'); return; }
    if (!(await Dialog.potvrd(`Smazat korpus K${U.k + 1} „${kor().nazev}“?`))) return;
    S.korpusy.splice(U.k, 1); vykresliKorpusy(); prepocti();
  });
  const posun = (d) => { const j = U.k + d; if (j < 0 || j >= S.korpusy.length) return; [S.korpusy[U.k], S.korpusy[j]] = [S.korpusy[j], S.korpusy[U.k]]; U.k = j; vykresliKorpusy(); prepocti(); };
  $('kVlevo').addEventListener('click', () => posun(-1));
  $('kVpravo').addEventListener('click', () => posun(1));

  /* ---------- materiály ---------- */
  function vykresliMaterialy() {
    const radky = [['korpusMat', 'Korpus'], ['celaMat', 'Čela a sokl'], ['zadaMat', 'Záda'], ['zasMat', 'Korpus zásuvek'], ['dnoZasMat', 'Dno zásuvek'], ['pracMat', 'Pracovní deska']];
    const druhy = Object.entries(NS.MATERIALY).map(([a, b]) => [a, b.nazev]), dekory = Object.entries(NS.DEKORY).map(([a, b]) => [a, b.nazev]);
    $('formMaterialy').innerHTML = radky.map(([k, n]) => `<div class="skupina">${n}</div><div class="r3">
      <div><label for="m_${k}_d">Materiál</label><select id="m_${k}_d" data-k="N.${k}.druh">${opt(druhy, S.N[k].druh)}</select></div>
      <div><label for="m_${k}_e">Dekor</label><select id="m_${k}_e" data-k="N.${k}.dekor">${opt(dekory, S.N[k].dekor)}</select></div>
      <div><label for="m_${k}_t">Tloušťka</label><input id="m_${k}_t" data-k="N.${k}.tl" type="number" min="2" max="60" step="0.5"></div></div>`).join('');
    $('v_typ').innerHTML = opt(Object.entries(NS.VYSUVY).map(([a, b]) => [a, b.nazev]), S.N.zasuvky.vysuv);
  }

  /* ---------- výpočet a vykreslení ---------- */
  let ramec = 0;
  function prepocti() { cancelAnimationFrame(ramec); ramec = requestAnimationFrame(prepoctiTed); }
  function prepoctiTed() {
    try { V = NS.vypocet(S); } catch (e) { console.error(e); $('varovani').innerHTML = `<li class="chyba">Chyba výpočtu: ${esc(e.message)}</li>`; return; }
    vykresliNahled();
    vykresliSouhrn();
    vykresliZalozku();
    aktualizuj3d();
    uloz();
  }
  function scenaPohledu() {
    const ki = Math.min(U.k, V.korpusy.length - 1);
    if (U.pohled === 'korpus') return NSV.pohledZepredu(V, { cela: true, korpus: ki });
    if (U.pohled === 'bezcel') return NSV.pohledZepredu(V, { cela: false, korpus: ki });
    if (U.pohled === 'rez') return NSV.rezBokem(V, { korpus: ki });
    if (U.pohled === 'pudorys') return NSV.pudorys(V);
    return NSV.pohledZepredu(V, { cela: true });
  }
  function vykresliNahled() {
    $('nahled').innerHTML = NSV.svg(scenaPohledu(), { sirkaPx: true });
    for (const b of $('zalPohled').querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.z === U.pohled));
  }
  function vykresliSouhrn() {
    const s = V.sestava, hr = NS.souhrnHran(V.kusovnik), mat = NS.souhrnMaterialu(V.kusovnik);
    const desky = NS.reznyPlan(V.kusovnik, V.projekt.N).reduce((a, g) => a + g.desky.length, 0);
    $('souhrn').innerHTML = `<span>Sestava <b>${cz(s.x1 - s.x0)} × ${cz(s.y1 - s.y0)} × ${cz(s.z1 - s.z0)}</b> mm</span><span><b>${V.dilce.length}</b> dílců (${V.kusovnik.length} pozic)</span>
      <span><b>${V.diry.length}</b> děr</span><span>desek k nařezání <b>${desky}</b></span><span>hrany ${hr.map((h) => `${cz(h.tl)} mm: <b>${cz(h.bm)}</b> bm`).join(', ') || '–'}</span>
      <span>${mat.map((m) => `${esc(m.material)}: <b>${cz(m.plocha)}</b> m²`).join(' · ')}</span>`;
    const v = V.varovani;
    $('varovani').innerHTML = v.length ? v.map((x) => `<li>${esc(x)}</li>`).join('') : `<li class="ok" style="list-style:none;margin-left:0">✓ Bez kolizí dílců i děr, všechna čela a zásuvky se vejdou.</li>`;
  }

  /* ---------- záložky výstupů ---------- */
  function vykresliZalozku() {
    for (const b of $('zalozky').querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.z === U.zalozka));
    for (const p of document.querySelectorAll('#zalozky ~ .panel')) p.hidden = p.dataset.p !== U.zalozka;
    if (U.zalozka === 'kusovnik') vykresliKusovnik();
    else if (U.zalozka === 'kovani') vykresliKovani();
    else if (U.zalozka === 'rezani') vykresliRezani();
    else if (U.zalozka === 'vrtani') vykresliVrtani();
  }
  $('zalozky').addEventListener('click', (e) => { const b = e.target.closest('button[data-z]'); if (!b) return; U.zalozka = b.dataset.z; vykresliZalozku(); uloz(); });
  $('zalPohled').addEventListener('click', (e) => { const b = e.target.closest('button[data-z]'); if (!b) return; U.pohled = b.dataset.z; vykresliNahled(); uloz(); });

  function vykresliKusovnik() {
    let h = '<thead><tr><th>poz.</th><th class="l">název</th><th>délka</th><th>šířka</th><th>tl.</th><th>ks</th><th class="l">materiál</th><th class="l">vlákna</th><th class="l">hrany</th><th>řez. rozměr</th><th class="l">dílce</th></tr></thead><tbody>';
    for (const x of V.kusovnik) h += `<tr><td>${x.pozice}</td><td class="l">${esc(x.nazev)}</td><td>${cz(x.delka)}</td><td>${cz(x.sirka)}</td><td>${cz(x.tl)}</td><td><b>${x.ks}</b></td><td class="l">${esc(x.material)}</td><td class="l">${x.smerVlaken === 'delka' ? '↔ podél délky' : 'libovolně'}</td><td class="l">${esc(NSV.textHran(x.hrany))}</td><td>${cz(x.rezDelka)} × ${cz(x.rezSirka)}</td><td class="l" style="font-size:.72rem;color:var(--text-faint)">${esc(x.dilce.join(', '))}</td></tr>`;
    $('tabKusovnik').innerHTML = h + '</tbody>';
    $('infoKusovnik').innerHTML = `Celkem <b>${V.dilce.length}</b> dílců. Délka = rozměr podél vláken (u dekorů dřeva). Hrany: D = podél délky (d1/d2), Š = podél šířky (s1/s2); řezný rozměr ${V.projekt.N.hrany.odecist ? 'je zmenšený o tloušťku hran' : '= hotový rozměr (hrany se neodečítají)'}.`;
  }
  function vykresliKovani() {
    let h = '<thead><tr><th class="l">položka</th><th>ks</th><th class="l">poznámka</th></tr></thead><tbody>';
    for (const k of V.kovani) h += `<tr><td class="l">${esc(k.nazev)}</td><td><b>${k.ks}</b></td><td class="l">${esc(k.pozn)}</td></tr>`;
    for (const x of NS.souhrnHran(V.kusovnik)) h += `<tr><td class="l">ABS hrana ${cz(x.tl)} mm</td><td><b>${cz(x.bm)} bm</b></td><td class="l">bez prořezu, přidejte ~10 %</td></tr>`;
    $('tabKovani').innerHTML = h + '</tbody>';
  }
  function vykresliRezani() {
    const RP = NS.reznyPlan(V.kusovnik, V.projekt.N);
    let h = '', info = [];
    for (const g of RP) {
      info.push(`${esc(g.material)}: <b>${g.desky.length}</b> × ${cz(g.format[0])} × ${cz(g.format[1])}${g.nevejde.length ? ` <span style="color:var(--danger)">(nevejde se ${g.nevejde.length} ks)</span>` : ''}`);
      g.desky.forEach((d, i) => { h += `<div><h4>${esc(g.material)} – deska ${i + 1}/${g.desky.length} · využití ${cz(d.vyuziti)} %</h4><div class="papir">${NSV.svg(NSV.scenaDesky(g, d), { sirkaPx: true })}</div></div>`; });
    }
    $('infoRezani').innerHTML = info.join(' · ') + '. Jednoduché gilotinové dělení; dílce s vlákny se neotáčejí. Pro optimalizaci použijte JSON v Řezném plánu.';
    $('desky').innerHTML = h;
  }
  function vykresliVrtani() {
    const sel = $('vyberDilce');
    const pocty = new Map();
    for (const q of V.diry) pocty.set(q.dil, (pocty.get(q.dil) || 0) + 1);
    if (!V.dilce.some((d) => d.id === U.dilec)) U.dilec = (V.dilce.find((d) => pocty.get(d.id)) || V.dilce[0]).id;
    sel.innerHTML = V.dilce.map((d) => `<option value="${d.id}"${d.id === U.dilec ? ' selected' : ''}>${d.id} – ${esc(d.nazev)} (${pocty.get(d.id) || 0} děr)</option>`).join('');
    $('vyberStrany').value = U.strana || '';
    const vk = NSV.vykresDilce(V, U.dilec, { strana: U.strana || undefined });
    $('vykresDilce').innerHTML = NSV.svg(vk, { sirkaPx: true });
    let h = '<thead><tr><th>#</th><th class="l">plocha</th><th>x</th><th>y</th><th>Ø</th><th>hloubka</th><th class="l">účel</th></tr></thead><tbody>';
    for (const r of vk.tabulka) h += `<tr${r.kolize ? ' class="chyba"' : ''}><td>${r.c}</td><td class="l">${r.plocha} ${esc(r.nazevPlochy)}</td><td>${cz(r.x)}</td><td>${cz(r.y)}</td><td>${cz(r.d)}</td><td>${r.hl == null ? 'skrz' : cz(r.hl)}</td><td class="l">${esc(r.popis)}</td></tr>`;
    $('tabDiry').innerHTML = h + '</tbody>';
  }
  $('vyberDilce').addEventListener('change', () => { U.dilec = $('vyberDilce').value; vykresliVrtani(); uloz(); });
  $('vyberStrany').addEventListener('change', () => { U.strana = $('vyberStrany').value; vykresliVrtani(); uloz(); });

  /* ---------- soubory ---------- */
  function stahni(obsah, nazev, typ) {
    const blob = obsah instanceof Blob ? obsah : new Blob([obsah], { type: typ || 'application/octet-stream' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const zaklad = () => String(S.nazev || 'navrh_skrini').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'navrh_skrini';
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
      const nazev = S.nazev || 'Návrh skříní';
      const st = NSV.strany(V, { papir: $('pdfPapir').value, vykresy: $('pdfVykresy').checked, nazev, datum: new Date().toLocaleDateString('cs-CZ') });
      const doc = NSV.pdf(window.jspdf.jsPDF, st, { pismo, nazev });
      stahni(doc.output('blob'), zaklad() + '.pdf');
    } catch (e) { console.error(e); toast('Chyba PDF: ' + e.message, true); }
    finally { b.disabled = false; b.textContent = puv; }
  });
  $('btnSvgPohled').addEventListener('click', () => stahni(NSV.svg(scenaPohledu(), {}), `${zaklad()}_${U.pohled}.svg`, 'image/svg+xml'));
  $('btnDxfVse').addEventListener('click', () => stahni(NSV.dxfDilce(V, V.dilce.map((d) => d.id)), zaklad() + '_dilce.dxf', 'application/dxf'));
  $('btnSvgDilec').addEventListener('click', () => stahni(NSV.svg(NSV.vykresDilce(V, U.dilec, { strana: U.strana || undefined }), {}), `${zaklad()}_${U.dilec}.svg`, 'image/svg+xml'));
  $('btnDxfDilec').addEventListener('click', () => stahni(NSV.dxfDilce(V, [U.dilec]), `${zaklad()}_${U.dilec}.dxf`, 'application/dxf'));
  $('btnCsvDiry').addEventListener('click', () => {
    const out = ['dilec;cislo;plocha;x;y;w;prumer;hloubka;ucel'];
    for (const d of V.dilce) NS.diryDilce(V, d.id).forEach((q, i) => out.push([d.id, i + 1, q.plocha, cz(q.u), cz(q.v), cz(q.w), cz(q.d), q.hl == null ? 'skrz' : cz(q.hl), '"' + q.popis + '"'].join(';')));
    stahni('﻿' + out.join('\r\n') + '\r\n', zaklad() + '_diry.csv', 'text/csv;charset=utf-8');
  });
  $('btnCsv').addEventListener('click', () => stahni('﻿' + NSV.csvKusovnik(V), zaklad() + '_kusovnik.csv', 'text/csv;charset=utf-8'));
  $('btnJsonRez').addEventListener('click', () => stahni(JSON.stringify(NS.exportReznyPlan(V.kusovnik, { projekt: S.nazev }), null, 1), zaklad() + '_dilce.json', 'application/json'));
  $('btnOtevritRez').addEventListener('click', () => {
    try { localStorage.setItem('webapp_rezny_plan_vstup', JSON.stringify(NS.exportReznyPlan(V.kusovnik, { projekt: S.nazev || 'Návrh skříní' }))); }
    catch (e) { toast('Nepodařilo se předat data (plné úložiště).', true); return; }
    window.open('rezny_plan.html', '_blank');
  });

  /* ---------- projekty ---------- */
  function vykresliProjekty() {
    const P = projekty(), jm = Object.keys(P).sort((a, b) => a.localeCompare(b, 'cs'));
    $('seznamProjektu').innerHTML = jm.length ? jm.map((n) => `<option>${esc(n)}</option>`).join('') : '<option value="">– žádné –</option>';
  }
  $('btnUlozit').addEventListener('click', async () => {
    let n = (S.nazev || '').trim();
    if (!n) { n = await Dialog.zeptej('Název projektu', 'Moje skříň'); if (!n) return; S.nazev = n; napln(); }
    const P = projekty();
    if (P[n] && !(await Dialog.potvrd(`Projekt „${n}“ už existuje. Přepsat?`))) return;
    P[n] = NS.kopie(S); if (ulozProjekty(P)) { vykresliProjekty(); $('seznamProjektu').value = n; toast('Uloženo'); }
  });
  $('btnNacist').addEventListener('click', () => { const n = $('seznamProjektu').value, P = projekty(); if (!n || !P[n]) return; S = NS.normalizuj(P[n]); U.k = 0; vse(); toast('Načteno: ' + n); });
  $('btnSmazat').addEventListener('click', async () => { const n = $('seznamProjektu').value, P = projekty(); if (!n || !P[n]) return; if (!(await Dialog.potvrd(`Smazat uložený projekt „${n}“?`))) return; delete P[n]; ulozProjekty(P); vykresliProjekty(); });
  $('btnExport').addEventListener('click', () => stahni(JSON.stringify({ format: 'navrh_skrini', verze: 1, projekt: S }, null, 1), zaklad() + '.json', 'application/json'));
  $('btnImport').addEventListener('click', () => $('souborProjekt').click());
  $('souborProjekt').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { const j = JSON.parse(await f.text()); const p = j.projekt || j; if (!Array.isArray(p.korpusy)) throw new Error('chybí korpusy'); S = NS.normalizuj(p); U.k = 0; vse(); toast('Projekt načten.'); }
    catch (err) { toast('Soubor není projekt návrhu skříní: ' + err.message, true); }
  });

  /* ---------- 3D ---------- */
  let p3d = null, nacita3d = false, t3d = 0;
  function nactiSkript(src) { return new Promise((ok, chyba) => { const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = () => chyba(new Error('nejde načíst ' + src)); document.head.appendChild(el); }); }
  function nacti3d() {
    if (p3d || nacita3d) return;
    nacita3d = true;
    const hotovo = () => {
      try { p3d = window.NS3D.vytvor($('obal3d')); $('stav3d').textContent = ''; aktualizuj3d(true); }
      catch (e) { console.error(e); $('stav3d').textContent = 'WebGL není k dispozici: ' + e.message; }
    };
    if (window.THREE) hotovo(); else nactiSkript('lib/three.0.160.0.min.js').then(hotovo).catch((e) => { nacita3d = false; $('stav3d').textContent = 'three.js se nenačetl: ' + e.message; });
  }
  function aktualizuj3d(hned) {
    if (!p3d || !V) return;
    clearTimeout(t3d);
    t3d = setTimeout(() => p3d.postav(V), hned ? 0 : 120);
  }
  new IntersectionObserver((z) => { if (z.some((x) => x.isIntersecting)) nacti3d(); }, { rootMargin: '200px' }).observe($('obal3d'));
  const prepni3d = (id, klic) => {
    const b = $(id), v = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(v));
    if (klic === 'rozlozit') { $('r3dRozlozit').value = v ? 70 : 0; $('r3dRozlozitH').textContent = (v ? 70 : 0) + ' %'; }
    if (p3d) p3d.nastav({ [klic]: v ? (klic === 'rozlozit' ? 0.7 : 1) : 0 });
  };
  $('b3dDvere').addEventListener('click', () => prepni3d('b3dDvere', 'dvere'));
  $('b3dZasuvky').addEventListener('click', () => prepni3d('b3dZasuvky', 'zasuvky'));
  $('b3dRozlozit').addEventListener('click', () => prepni3d('b3dRozlozit', 'rozlozit'));
  $('r3dRozlozit').addEventListener('input', () => { const v = +$('r3dRozlozit').value; $('r3dRozlozitH').textContent = v + ' %'; $('b3dRozlozit').setAttribute('aria-pressed', String(v > 0)); if (p3d) p3d.nastav({ rozlozit: v / 100 }); });
  $('b3dVychozi').addEventListener('click', () => p3d && p3d.pohled(-28, 18));
  $('b3dZepredu').addEventListener('click', () => p3d && p3d.pohled(0, 4));

  /* ---------- klávesy ---------- */
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const pohledy = { Digit1: 'sestava', Digit2: 'korpus', Digit3: 'bezcel', Digit4: 'rez', Digit5: 'pudorys', Numpad1: 'sestava', Numpad2: 'korpus', Numpad3: 'bezcel', Numpad4: 'rez', Numpad5: 'pudorys' };
    if (pohledy[e.code]) { U.pohled = pohledy[e.code]; vykresliNahled(); uloz(); e.preventDefault(); }
    else if (e.code === 'KeyO') prepni3d('b3dDvere', 'dvere');
    else if (e.code === 'KeyZ') prepni3d('b3dZasuvky', 'zasuvky');
    else if (e.code === 'KeyE') prepni3d('b3dRozlozit', 'rozlozit');
  });

  /* ---------- start ---------- */
  function vse() { vykresliPredvolby(); vykresliMaterialy(); vykresliKorpusy(); napln(); vykresliProjekty(); prepocti(); }
  $('princip').innerHTML = window.NSPrincip.princip();
  $('postup').innerHTML = window.NSPrincip.postup();
  vse();
  // pro testy
  window.NavrhSkrini = { get S() { return S; }, get V() { return V; }, get U() { return U; }, get p3d() { return p3d; }, prepoctiTed, vse, nastavStav(p) { S = NS.normalizuj(p); U.k = 0; vse(); } };
})();
