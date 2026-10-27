/* ============================================================
   Barefoot vložky – ovládání stránky
   ============================================================ */
(function () {
  'use strict';
  const J = window.BFJ, V = window.BFV, P = window.BFP, A = window.BFA;
  const $ = (id) => document.getElementById(id);
  const fmt = J.fmt;
  const KLIC = 'webapp_barefoot_vlozky', KLIC_PROJ = 'webapp_barefoot_vlozky_projekty', KLIC_TYP = 'webapp_barefoot_vlozky_typ';
  const toast = (t, chyba) => { try { chyba ? Dialog.chyba(t) : Dialog.info(t); } catch (e) { console.log(t); } };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  if (window.self === window.top) document.body.classList.add('samostatne');
  const poKliku = (f) => window.BFV_UI.poKliku(f);   // překreslení až po dokončení kliknutí (vlastni_ui.js)

  const CISLA = ['pDelka', 'pSirka', 'pPata', 'lDelka', 'lSirka', 'lPata', 'rezPrsty', 'rezBok', 'rezPata', 'klenba', 'pas', 'tloustka', 'orezKrok', 'orezPocet', 'perfRozt', 'perfPrumer', 'perfOkraj', 'jazyk',
    'delkaBoty', 'tloustka2', 'vrstvaOds', 'pelotaDelka', 'pelotaSirka', 'pelotaPoz', 'podpatenkaPrumer'];
  const ZASKRT = ['orez', 'perforace', 'znacky', 'vrstvy', 'pelota', 'podpatenka'];
  const PREDVOLBY = [
    ['Dospělý – běžná chůze', { rezPrsty: 12, rezBok: 2, rezPata: 0 }],
    ['Dítě – s rezervou na růst', { rezPrsty: 15, rezBok: 2.5, rezPata: 0 }],
    ['Běh a sport – těsněji', { rezPrsty: 10, rezBok: 1.5, rezPata: 0 }],
    ['Zimní bota se silnou ponožkou', { rezPrsty: 15, rezBok: 3, rezPata: 1 }],
    ['Přesně na obrys (bez rezervy)', { rezPrsty: 0, rezBok: 0, rezPata: 0 }],
  ];
  const PAPIRY = { a4: [210, 297], a3: [297, 420], letter: [215.9, 279.4] };

  /* nastavení univerzálního režimu žije v localStorage; režim Na míru má výrobu v projektu (BFV_UI) */
  const nactiUni = () => { try { return J.normalizuj(JSON.parse(localStorage.getItem(KLIC) || 'null')); } catch (e) { return J.normalizuj({}); } };
  let p = nactiUni();
  let v = null;
  /* typ: 'uni' = spočítaná z rozměrů, 'vlastni' = na míru z předloh (vlastni_ui.js, window.BFV_UI) */
  let typ = (() => { try { return localStorage.getItem(KLIC_TYP) === 'vlastni' ? 'vlastni' : 'uni'; } catch (e) { return 'uni'; } })();
  const vlastni = () => typ === 'vlastni' && window.BFV_UI;
  /* volby náhledu a tisku – jen pohodlí jednoho prohlížeče */
  const KLIC_ZOBR = 'webapp_barefoot_vlozky_zobrazeni';
  const ulozene = (() => { try { const x = JSON.parse(localStorage.getItem(KLIC_ZOBR) || '{}'); return x && typeof x === 'object' ? x : {}; } catch (e) { return {}; } })();
  const zobr = Object.assign({ koty: true, prsty: true, mrizka: false, legenda: true }, ulozene.zobr);
  const tisk = Object.assign({ souhrn: true, navod: true, zrcadlit: false }, ulozene.tisk);
  const rez = Object.assign({ profil: 'laser', kerf: 0.15, gravirovat: false, bigovat: false }, ulozene.rez);
  zobr.jednoduse = !!zobr.jednoduse;
  const ulozZobr = () => { try { localStorage.setItem(KLIC_ZOBR, JSON.stringify({ zobr, tisk, rez })); } catch (e) { /* nevadí */ } };
  /* korekce tiskárny: poměr skutečné / vytištěné délky (150 mm vodorovně, 200 mm svisle) */
  const KLIC_TISKARNA = 'webapp_barefoot_vlozky_tiskarna';
  let tiskarna = (() => { try { const t = JSON.parse(localStorage.getItem(KLIC_TISKARNA) || 'null'); return t && t.kx > 0.9 && t.kx < 1.1 && t.ky > 0.9 && t.ky < 1.1 ? t : null; } catch (e) { return null; } })();
  const ulozStav = () => { if (typ !== 'uni') return; try { localStorage.setItem(KLIC, JSON.stringify(p)); } catch (e) { /* úložiště zakázané – nevadí */ } };

  /* ---------- nabídky lišty ---------- */
  function zavriNabidky(vratitFokus) {
    const otevrene = document.querySelector('[data-nabidka][aria-expanded="true"]');
    document.querySelectorAll('.nabidka:not([hidden])').forEach((n) => { n.hidden = true; });
    document.querySelectorAll('[data-nabidka][aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    if (vratitFokus === true && otevrene) otevrene.focus();
  }
  document.querySelectorAll('[data-nabidka]').forEach((b) => { b.setAttribute('aria-controls', b.dataset.nabidka); b.setAttribute('aria-expanded', 'false'); });
  /* tlačítka lišty, která na úzké obrazovce ukazují jen ikonu, mají přístupné jméno */
  document.querySelectorAll('.lista button').forEach((b) => { if (!b.getAttribute('aria-label') && !/\p{L}{3}/u.test(b.textContent || '')) b.setAttribute('aria-label', (b.textContent || '').replace('▾', '').replace(/\s+/g, ' ').trim() || b.title); });
  document.querySelectorAll('[data-nabidka]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const n = $(b.dataset.nabidka), bylo = !n.hidden;
    zavriNabidky();
    if (bylo) return;
    if (n.id === 'nabTisk') infoListy();
    n.hidden = false; b.setAttribute('aria-expanded', 'true');
    const r = b.getBoundingClientRect();
    n.style.top = (r.bottom + 4) + 'px';
    n.style.maxHeight = Math.max(160, innerHeight - r.bottom - 12) + 'px';
    n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
    /* z klávesnice skočit do nabídky (nabídky jsou v DOM až za lištou) */
    if (e.detail === 0) { const prvni = n.querySelector('button:not([disabled]),input,select,textarea'); if (prvni) prvni.focus(); }
  }));
  document.addEventListener('click', (e) => { if (!e.target.closest('.nabidka')) zavriNabidky(); });
  /* Tab ven z nabídky ji zavře (fokus jinam než do nabídky nebo na její tlačítko) */
  document.addEventListener('focusout', (e) => {
    const n = e.target.closest && e.target.closest('.nabidka'); if (!n || n.hidden || !e.relatedTarget) return;
    if (!n.contains(e.relatedTarget) && e.relatedTarget.dataset.nabidka !== n.id && !e.relatedTarget.closest('dialog')) zavriNabidky();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { zavriNabidky(true); konecNastroje(); } });
  /* jen při změně šířky – na mobilu mění výšku okna vysunutá klávesnice a nabídka s polem by se hned zavřela */
  let sirkaOkna = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== sirkaOkna) { sirkaOkna = innerWidth; zavriNabidky(); } });
  /* tlačítka akcí v nabídce ji po kliknutí zavřou (pole a přepínače ne) */
  document.querySelectorAll('.nabidka button.tl:not(.prep)').forEach((b) => b.addEventListener('click', zavriNabidky));

  /* ---------- formulář ---------- */
  /* ikona tvaru prstů = přední část skutečného obrysu chodidla */
  const SVG_TVAR = (id) => {
    const n = J.spocitej({ tvar: id, strany: 'prava', rezPrsty: 0, rezBok: 0, rezPata: 0, rezim: 'vlozka' }).nohy[0];
    const y0 = 0.62 * n.Lt, k = 44 / n.Wt, X = (x) => (1 + x * k).toFixed(1), Y = (y) => (1 + (n.Lt - y) * k).toFixed(1);
    const obrys = n.noha.filter((q) => q[1] > y0).map((q) => X(q[0]) + ' ' + Y(q[1])).join('L');
    const prsty = n.prsty.map((q) => `<circle cx="${X(q.x)}" cy="${Y(q.y)}" r="${(q.r * k).toFixed(1)}"/>`).join('');
    return `<svg viewBox="0 0 46 ${(2 + (n.Lt - y0) * k).toFixed(1)}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M${obrys}"/>${prsty}</svg>`;
  };
  $('tvary').innerHTML = Object.entries(J.TVARY).map(([id, t]) => `<button type="button" data-tvar="${id}" title="${esc(t.popis)}">${SVG_TVAR(id)}${esc(t.nazev)}</button>`).join('');
  $('material').innerHTML = Object.entries(J.MATERIALY).map(([id, m]) => `<option value="${id}">${esc(m.nazev)}</option>`).join('');
  $('material2').innerHTML = $('material').innerHTML;
  $('predvolba').innerHTML = '<option value="">— vyberte —</option>' + PREDVOLBY.map((q, i) => `<option value="${i}">${esc(q[0])} (${q[1].rezPrsty} mm)</option>`).join('');
  $('princip').innerHTML = P.html();

  function obnovFormular() {
    document.body.classList.toggle('typ-vlastni', typ === 'vlastni');
    $('typUni').setAttribute('aria-pressed', String(typ === 'uni'));
    $('typVlastni').setAttribute('aria-pressed', String(typ === 'vlastni'));
    for (const k of CISLA) $(k).value = p[k];
    for (const k of ZASKRT) $(k).checked = p[k];
    $('material').value = p.material; $('jmeno').value = p.jmeno;
    document.querySelectorAll('[data-tvar]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tvar === p.tvar)));
    $('nohyStejne').setAttribute('aria-pressed', String(p.nohy === 'stejne'));
    $('nohyZvlast').setAttribute('aria-pressed', String(p.nohy === 'zvlast'));
    $('blokLeva').classList.toggle('skryte', p.nohy === 'stejne');
    $('hlavaP').textContent = p.nohy === 'stejne' ? 'Obě nohy (zadejte větší)' : 'Pravá noha';
    $('rzVlozka').setAttribute('aria-pressed', String(p.rezim === 'vlozka'));
    $('rzKontrolni').setAttribute('aria-pressed', String(p.rezim === 'kontrolni'));
    $('kartaMaterial').classList.toggle('skryte', p.rezim !== 'vlozka');
    $('vyrobaKontrolni').classList.toggle('skryte', p.rezim === 'vlozka');
    $('sekceVlozka').classList.toggle('skryte', p.rezim !== 'vlozka');
    $('kartaKontrolni').classList.toggle('skryte', p.rezim !== 'kontrolni');
    /* tlačítko Výroba ukazuje, co se právě vyrábí */
    const m1 = J.MATERIALY[p.material].nazev.split(' ').pop();
    $('vyrobaPopis').textContent = p.rezim === 'vlozka' ? ` ${m1[0].toUpperCase() + m1.slice(1)} ${fmt(p.tloustka, 1)} mm${p.vrstvy ? ' + ' + fmt(p.tloustka2, 1) : ''}` : ' Papír (zkoušení)';
    document.querySelectorAll('[data-tisk]').forEach((b) => b.setAttribute('aria-pressed', String(!!tisk[b.dataset.tisk])));
    document.querySelector('.legenda').classList.toggle('skryte', !zobr.legenda);
    document.body.classList.toggle('jednoduse', zobr.jednoduse);
    document.querySelectorAll('[data-rez]').forEach((b) => b.setAttribute('aria-pressed', String(!!rez[b.dataset.rez])));
    $('rezProfil').value = rez.profil; $('rezDil').value = rez.dil || 'horni'; if (document.activeElement !== $('rezKerf')) $('rezKerf').value = rez.kerf;
    $('blokOrez').classList.toggle('skryte', !p.orez);
    $('blokPerf').classList.toggle('skryte', !p.perforace);
    $('material2').value = p.material2;
    $('blokVrstvy').classList.toggle('skryte', !p.vrstvy);
    $('blokPelota').classList.toggle('skryte', !p.pelota);
    $('blokPodpatenka').classList.toggle('skryte', !p.podpatenka);
    if (p.pelota || p.podpatenka) document.querySelector('details.podpory').open = true;
    kresliVyberBot();
    document.querySelectorAll('[data-prep]').forEach((b) => b.setAttribute('aria-pressed', String(!!p[b.dataset.prep])));
    document.querySelectorAll('[data-strany]').forEach((b) => b.setAttribute('aria-pressed', String(p.strany === b.dataset.strany)));
    document.querySelectorAll('[data-zobr]').forEach((b) => b.setAttribute('aria-pressed', String(zobr[b.dataset.zobr])));
  }
  function zmena(o) { p = J.normalizuj(Object.assign({}, p, o)); obnovFormular(); prepocitej(); }

  for (const k of CISLA) $(k).addEventListener('change', () => { const x = parseFloat(String($(k).value).replace(',', '.')); if (Number.isFinite(x)) zmena({ [k]: x }); else obnovFormular(); });
  for (const k of ZASKRT) $(k).addEventListener('change', () => zmena({ [k]: $(k).checked }));
  $('material').addEventListener('change', () => {
    const m = J.MATERIALY[$('material').value], o = { material: $('material').value };
    if (p.tloustka < m.tl[0] || p.tloustka > m.tl[1]) o.tloustka = (m.tl[0] + m.tl[1]) / 2;
    zmena(o);
  });
  $('material2').addEventListener('change', () => {
    const m = J.MATERIALY[$('material2').value], o = { material2: $('material2').value };
    if (p.tloustka2 < m.tl[0] || p.tloustka2 > m.tl[1]) o.tloustka2 = (m.tl[0] + m.tl[1]) / 2;
    zmena(o);
  });
  let casJmeno = 0;
  $('jmeno').addEventListener('input', () => { p.jmeno = $('jmeno').value.slice(0, 40); clearTimeout(casJmeno); casJmeno = setTimeout(prepocitej, 300); });
  $('tvary').addEventListener('click', (e) => { const b = e.target.closest('[data-tvar]'); if (b) zmena({ tvar: b.dataset.tvar }); });
  $('nohyStejne').addEventListener('click', () => zmena({ nohy: 'stejne' }));
  $('nohyZvlast').addEventListener('click', () => zmena({ nohy: 'zvlast', lDelka: p.pDelka, lSirka: p.pSirka, lPata: p.pPata }));
  function nastavTyp(t) {
    if (t === typ) return;
    if (t === 'uni' && window.BFV_UI) window.BFV_UI.zrus();
    typ = t; try { localStorage.setItem(KLIC_TYP, t); } catch (e) { /* nevadí */ }
    konecNastroje();
    if (t === 'uni') p = nactiUni();
    zavriNabidky(); obnovFormular();
    zalozka(t === 'vlastni' ? 'editor' : zalozkaZ === 'editor' || zalozkaZ === 'vyvoj' ? 'sablona' : zalozkaZ);
    if (vlastni()) window.BFV_UI.aktivuj();
    prepocitej();
  }
  $('typUni').addEventListener('click', () => nastavTyp('uni'));
  $('typVlastni').addEventListener('click', () => nastavTyp('vlastni'));
  $('rzVlozka').addEventListener('click', () => zmena({ rezim: 'vlozka' }));
  $('rzKontrolni').addEventListener('click', () => zmena({ rezim: 'kontrolni' }));
  $('predvolba').addEventListener('change', () => { const q = PREDVOLBY[+$('predvolba').value]; if (q) { zmena(q[1]); toast('Předvolba: ' + q[0]); } $('predvolba').value = ''; });
  document.querySelectorAll('[data-prep]').forEach((b) => b.addEventListener('click', () => zmena({ [b.dataset.prep]: !p[b.dataset.prep] })));
  document.querySelectorAll('[data-strany]').forEach((b) => b.addEventListener('click', () => zmena({ strany: b.dataset.strany })));
  document.querySelectorAll('[data-zobr]').forEach((b) => b.addEventListener('click', () => {
    zobr[b.dataset.zobr] = !zobr[b.dataset.zobr]; ulozZobr(); obnovFormular(); kresliNahled();
    if (b.dataset.zobr === 'jednoduse' && zobr.jednoduse && !['editor', 'sablona', 'velikosti', 'princip'].includes(zalozkaZ)) zalozka(vlastni() ? 'editor' : 'sablona');
  }));
  document.querySelectorAll('[data-tisk]').forEach((b) => b.addEventListener('click', () => {
    tisk[b.dataset.tisk] = !tisk[b.dataset.tisk]; ulozZobr(); obnovFormular();
    if (b.dataset.tisk === 'zrcadlit') toast(tisk.zrcadlit ? 'Šablony v PDF, SVG a DXF budou zrcadlené – pro obkreslení na rub materiálu. Náhled zůstává lícem nahoru.' : 'Šablony se tisknou lícem nahoru.');
  }));
  document.querySelectorAll('[data-rez]').forEach((b) => b.addEventListener('click', () => { rez[b.dataset.rez] = !rez[b.dataset.rez]; ulozZobr(); obnovFormular(); }));
  $('rezDil').addEventListener('change', () => { rez.dil = $('rezDil').value; ulozZobr(); });
  $('rezProfil').addEventListener('change', () => { rez.profil = $('rezProfil').value; if (rez.profil === 'cricut') rez.kerf = 0; ulozZobr(); obnovFormular(); });
  $('rezKerf').addEventListener('change', () => { const x = parseFloat(String($('rezKerf').value).replace(',', '.')); rez.kerf = Number.isFinite(x) ? Math.max(0, Math.min(3, x)) : 0; ulozZobr(); obnovFormular(); });
  /* Nástroje: skok na záložku */
  document.querySelectorAll('[data-skok]').forEach((b) => b.addEventListener('click', () => { zalozka(b.dataset.skok); $('zalozky').scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
  $('btnOdhad').addEventListener('click', () => {
    const eu = parseFloat(String($('odhadEu').value).replace(',', '.'));
    if (!(eu >= 18 && eu <= 50)) { toast('Zadejte číslo EU mezi 18 a 50.', true); return; }
    const d = J.delkaZEu(eu, p.rezPrsty), s = Math.round(d * 0.385), pt = Math.round(s * 0.66);
    zmena({ pDelka: d, pSirka: s, pPata: pt, lDelka: d, lSirka: s, lPata: pt });
    toast(`Odhad pro EU ${eu}: ${d} × ${s} mm. Je to jen průměr – změřte nohu, jakmile to půjde.`);
  });

  /* ---------- přepočet a kreslení ---------- */
  function prepocitej() {
    v = vlastni() ? window.BFV_UI.sestav(p) : J.spocitej(p);
    ulozStav();
    if (vlastni()) window.BFV_UI.ulozVyrobu(p);
    $('nazevVysledku').textContent = v.nazev;
    $('infoNoha').innerHTML = v.nohy.map((n) => `<b>${n.nazev[0].toUpperCase() + n.nazev.slice(1)}:</b> ${n.sirka.nazev} noha (šířka ${fmt(n.sirka.r * 100)} % délky) – ${esc(n.sirka.pozn)}.`).join('<br>');
    $('infoTvar').textContent = J.TVARY[p.tvar].popis + '.';
    const m = J.MATERIALY[p.material];
    $('infoMaterial').innerHTML = `${esc(m.nazev)}: obvykle ${fmt(m.tl[0], 1)}–${fmt(m.tl[1], 1)} mm – ${esc(m.pozn)}.`;
    kresliNahled(); kresliTabulku();
    $('varovani').innerHTML = v.varovani.map((q) => `<li class="${q.uroven}">${esc(q.text)}</li>`).join('');
    const pocet = v.varovani.filter((q) => q.uroven === 'chyba' || q.uroven === 'varovani').length;
    document.querySelector('[data-z="kontrola"]').textContent = pocet ? `🩺 Kontrola (${pocet})` : '🩺 Kontrola';
    obnov3d();
    kresliZalozku();
    stavKalibrace();
  }
  /* tlačítko Kalibrace: oranžově pulzuje, dokud měřítko předlohy není známé; ✓ když je vše zkalibrované */
  function stavKalibrace() {
    const b = $('btnKalibrace2'), pozor = vlastni() && window.BFV_UI.potrebaKalibrace();
    const ok = vlastni() ? !pozor && v.nohy.length > 0 : !!tiskarna;
    b.classList.toggle('pozor', !!pozor); b.classList.toggle('ok', ok);
    $('kalStav').textContent = pozor ? '!' : ok ? '✓' : '';
    b.title = pozor ? 'Předloha nemá měřítko – rozměry jsou jen odhad. Klikněte a zkalibrujte.' : !vlastni() ? 'Kalibrace tiskárny (vyrovnání měřítka tisku)' : 'Kalibrace měřítka předlohy, rozměrů obrysů a tiskárny' + (tiskarna ? ' (tiskárna zkalibrovaná)' : '');
    const vk = $('vpKalibrace'); if (vk) { vk.classList.toggle('ok', !pozor); vk.textContent = pozor ? '📏 Kalibrovat měřítko a rozměry – zatím jen odhad!' : '📏 Kalibrace ✓ (upravit)'; }
  }
  /* ---------- okno Kalibrace ---------- */
  function otevriKalibraci(zal) {
    zavriNabidky();
    const z = zal || (vlastni() ? 'predloha' : 'tiskarna');
    kalZalozka(z);
    if (vlastni()) window.BFV_UI.kresliKalibraci();
    kresliTiskarnu();
    const d = $('dlgKalibrace'); if (!d.open) d.showModal();
  }
  document.querySelectorAll('#dlgKalibrace [data-kp]').forEach((el) => { el.id = 'kalPanel-' + el.dataset.kp; el.setAttribute('role', 'tabpanel'); });
  document.querySelectorAll('#kalZalozky [data-kz]').forEach((b) => { b.id = 'kalTab-' + b.dataset.kz; b.setAttribute('aria-controls', 'kalPanel-' + b.dataset.kz); $('kalPanel-' + b.dataset.kz).setAttribute('aria-labelledby', b.id); });
  function kalZalozka(z) {
    document.querySelectorAll('#kalZalozky [data-kz]').forEach((b) => { b.setAttribute('aria-selected', String(b.dataset.kz === z)); b.tabIndex = b.dataset.kz === z ? 0 : -1; });
    document.querySelectorAll('#dlgKalibrace [data-kp]').forEach((el) => { el.hidden = el.dataset.kp !== z; });
  }
  $('kalZalozky').addEventListener('click', (e) => { const b = e.target.closest('[data-kz]'); if (b) { kalZalozka(b.dataset.kz); if (vlastni()) window.BFV_UI.kresliKalibraci(); } });
  $('kalZalozky').addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const L = [...document.querySelectorAll('#kalZalozky [data-kz]')].filter((b) => b.offsetParent !== null), i = L.indexOf(document.activeElement);
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? L.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + L.length) % L.length;
    e.preventDefault(); L[j].click(); L[j].focus();
  });
  $('btnKalibrace2').addEventListener('click', () => otevriKalibraci());
  $('vpKalibrace').addEventListener('click', () => otevriKalibraci('predloha'));
  function kresliTiskarnu() {
    $('kalTiskInfo').innerHTML = tiskarna ? `Korekce zapnutá: vodorovně <b>${fmt((tiskarna.kx - 1) * 100, 2)} %</b>, svisle <b>${fmt((tiskarna.ky - 1) * 100, 2)} %</b> (šablony se tisknou o tolik upravené, aby po tisku seděly).` : 'Korekce vypnutá – tiskne se přesně 1:1.';
  }
  $('kalTiskList').addEventListener('click', async () => {
    if (!window.jspdf) { toast('jsPDF se nenačetl', true); return; }
    stahni(V.pdfTiskarna(window.jspdf.jsPDF, { pismo: await nactiPismo() }).output('blob'), 'kalibrace_tiskarny.pdf');
  });
  $('kalTiskUlozit').addEventListener('click', () => {
    const mx = parseFloat(String($('kalTiskX').value).replace(',', '.')), my = parseFloat(String($('kalTiskY').value).replace(',', '.'));
    if (!(mx > 135 && mx < 165) || !(my > 180 && my < 220)) { toast('Zadejte naměřené délky obou úseček (kolem 150 a 200 mm).', true); return; }
    tiskarna = { kx: 150 / mx, ky: 200 / my, datum: new Date().toISOString() };
    try { localStorage.setItem(KLIC_TISKARNA, JSON.stringify(tiskarna)); } catch (e) { /* nevadí */ }
    kresliTiskarnu(); stavKalibrace(); toast('Korekce tiskárny uložena – platí pro PDF šablon, archu i kalibrační karty.');
  });
  $('kalTiskZrusit').addEventListener('click', () => { tiskarna = null; try { localStorage.removeItem(KLIC_TISKARNA); } catch (e) { /* nevadí */ } $('kalTiskX').value = ''; $('kalTiskY').value = ''; kresliTiskarnu(); stavKalibrace(); });
  /* zavírací křížky všech dialogů */
  document.querySelectorAll('dialog [data-zavrit]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
  document.querySelectorAll('dialog.dlg').forEach((d) => d.addEventListener('click', (e) => {
    if (e.target !== d) return;
    const r = d.getBoundingClientRect();   // klik do odsazení dialogu má také target === d – zavírat jen mimo rámeček
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
  }));

  let sc = null;
  function kresliNahled() {
    if (!v.nohy.length) { sc = null; $('nahled').innerHTML = '<p class="info" style="padding:30px;text-align:center;color:#555">Zatím žádná šablona. Přidejte předlohu a najděte obrysy.</p>'; return; }
    sc = V.scena(v, { koty: zobr.koty, nahled: zobr.prsty });
    let pod = '';
    if (pred.src && typ === 'uni') pod = `<g id="predG" opacity="${pred.pruhl}" transform="${predTransform()}"><image id="predObr" href="${pred.src}" width="${pred.w}" height="${pred.h}" x="${-pred.w / 2}" y="${-pred.h / 2}"/></g>`;
    const body = mereni.body.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4" fill="#e67e22" stroke="#fff" stroke-width="0.4"/>`).join('') +
      (mereni.body.length === 2 ? `<line x1="${mereni.body[0][0]}" y1="${mereni.body[0][1]}" x2="${mereni.body[1][0]}" y2="${mereni.body[1][1]}" stroke="#e67e22" stroke-width="0.6"/>` : '');
    const pad = 4, w = sc.w + 2 * pad, h = sc.h + 2 * pad;
    const mrizka = zobr.mrizka ? `<defs><pattern id="mrizka1cm" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="#9ab" stroke-width="0.15"/></pattern></defs><rect x="${-pad}" y="${-pad}" width="${w}" height="${h}" fill="url(#mrizka1cm)"/>` : '';
    $('nahled').innerHTML = `<svg id="nahledSvg" xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${w} ${h}" role="img" aria-label="Náhled šablony">${mrizka}${pod}${V.svgPrvky(sc, 1.6)}${body}</svg>`;
  }
  function kresliTabulku() {
    if (!v.nohy.length) { $('tabVelikosti').innerHTML = ''; return; }
    const N = v.nohy, sl = N.map((n) => `<th class="c">${n.nazev}</th>`).join('');
    const r = (nazev, f) => `<tr><td>${nazev}</td>${N.map((n) => `<td class="c">${f(n)}</td>`).join('')}</tr>`;
    const veu = (x) => fmt(x, x % 1 ? 1 : 0);
    $('tabVelikosti').innerHTML = `<tr><th></th>${sl}</tr>` +
      r('Chodidlo délka × šířka × pata', (n) => `${fmt(n.m.delka)} × ${fmt(n.m.sirka)} × ${fmt(n.m.pata)}`) +
      r(p.rezim === 'kontrolni' ? 'Šablona délka × šířka × pata' : 'Vložka délka × šířka × pata', (n) => `<b>${fmt(n.roz.delka)} × ${fmt(n.roz.sirka)} × ${fmt(n.roz.pata)}</b>`) +
      r('Plocha vložky', (n) => `${fmt(n.roz.plocha / 100)} cm²`) +
      r('Obvod (délka střihu)', (n) => `${fmt(n.roz.obvod / 10, 1)} cm`) +
      r('Hledaná vnitřní délka boty', (n) => `≥ ${fmt(n.vel.vnitrni)} mm`) +
      r('Mondopoint', (n) => `${fmt(n.m.delka)}/${fmt(n.m.sirka)}`) +
      r('EU (orientačně)', (n) => veu(n.vel.eu)) +
      r('UK (orientačně)', (n) => (n.vel.detske ? 'dětská ' : '') + fmt(n.vel.uk, 1)) +
      r('US muži / ženy', (n) => (n.vel.detske ? '–' : `${fmt(n.vel.usM, 1)} / ${fmt(n.vel.usW, 1)}`)) +
      (N[0].orez.length ? r('Po ořezu (−mm → EU)', (n) => n.orez.map((q) => `−${fmt(q.d)} → ${veu(q.velikost.eu)}`).join('<br>')) : '');
  }
  const cisloPole = (id, d, a, b) => { const x = parseFloat(String($(id).value).replace(',', '.')); return Number.isFinite(x) ? Math.min(b, Math.max(a, x)) : d; };
  const okrajPdf = () => cisloPole('okraj', 8, 3, 25), prekryvPdf = () => cisloPole('prekryv', 15, 0, 40);
  function infoListy() {
    if (!v.nohy.length) { $('infoListy').textContent = 'Zatím není co tisknout.'; return; }
    const pw = PAPIRY[$('papir').value] || PAPIRY.a4, ok = okrajPdf(), pr = prekryvPdf();
    const plan = V.planSablon(v, pw[0], pw[1], ok, pr, tisk.zrcadlit, tiskarna ? tiskarna.kx : 1, tiskarna ? tiskarna.ky : 1), n = plan.reduce((a, q) => a + q.rv.listy.length, 0);
    $('infoListy').textContent = `Šablona se vejde na ${n} ${n === 1 ? 'list' : n < 5 ? 'listy' : 'listů'}` + (plan.some((q) => !q.rv.jeden) ? ' – dlouhé vložky se slepí z více listů s přesahem.' : '.') + ' K tomu souhrn s kontrolním čtvercem a návod.';
  }
  ['papir', 'okraj', 'prekryv'].forEach((id) => $(id).addEventListener('change', infoListy));

  /* ---------- porovnání L/P a arch materiálu (počítá se jen na otevřené záložce) ---------- */
  let zalozkaZ = 'sablona', porCo = 'noha';
  const KLIC_ARCH = 'webapp_barefoot_vlozky_arch';
  const arch = Object.assign({ sirka: 500, vyska: 500, okraj: 5, mezera: 3, pary: 0, otacet: true, smer: 'auto', vrstva: 'horni', cena: 0, mix: {} }, (() => { try { const x = JSON.parse(localStorage.getItem(KLIC_ARCH) || '{}'); return x && typeof x === 'object' && !Array.isArray(x) ? x : {}; } catch (e) { return {}; } })());
  for (const k of ['sirka', 'vyska', 'okraj', 'mezera', 'pary', 'cena']) if (!Number.isFinite(+arch[k])) arch[k] = { sirka: 500, vyska: 500, okraj: 5, mezera: 3, pary: 0, cena: 0 }[k];
  if (!arch.mix || typeof arch.mix !== 'object') arch.mix = {};
  let archVysledek = null;
  function kresliZalozku(prepnuto) {
    if (zalozkaZ === 'porovnani') kresliPorovnani();
    if (zalozkaZ === 'arch') kresliArch();
    if (zalozkaZ === 'boty') kresliBoty();
    if (zalozkaZ === '3d' && zastaraly3d) obnov3d();
    if (zalozkaZ === 'vyvoj' && vlastni() && prepnuto) window.BFV_UI.kresliVyvoj();
  }
  /* výběr obrysů k porovnání (režim Na míru): id A, id B, zrcadlit A (null = podle stran) */
  const porSel = { a: null, b: null, zrc: null };
  function kresliPorovnani() {
    document.querySelectorAll('[data-por]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.por === porCo)));
    let nA = null, nB = null, zrc = true;
    if (vlastni()) {
      const N = window.BFV_UI.nohyVse(p).nohy, C = window.BFC;
      const popis = (n) => `${n.strana} · ${C.ROLE[n.role] || 'chodidlo'} · ${fmt(n.m.delka)} × ${fmt(n.m.sirka)}${n.aktivni ? '' : ' (netiskne se)'}`;
      if (!N.some((n) => n.id === porSel.a) || !N.some((n) => n.id === porSel.b) || porSel.a === porSel.b) {
        const stelka = N.find((n) => n.role === 'stelka'), noha = N.find((n) => n.role !== 'stelka' && (!stelka || n.id !== stelka.id));
        const L = N.find((n) => n.strana === 'L' && n.role !== 'stelka'), P = N.find((n) => n.strana === 'P' && n.role !== 'stelka');
        [porSel.a, porSel.b] = stelka && noha ? [noha.id, stelka.id] : L && P ? [L.id, P.id] : [N[0] && N[0].id, N[1] && N[1].id];
        porSel.zrc = null;
      }
      const opt = N.map((n) => `<option value="${n.id}">${esc(popis(n))}</option>`).join('');
      for (const id of ['porA', 'porB']) if ($(id).innerHTML !== opt) $(id).innerHTML = opt;
      $('porA').value = porSel.a || ''; $('porB').value = porSel.b || '';
      nA = N.find((n) => n.id === porSel.a); nB = N.find((n) => n.id === porSel.b);
      zrc = porSel.zrc !== null ? porSel.zrc : !!(nA && nB && nA.strana !== nB.strana);
      $('porZrc').checked = zrc;
    } else {
      nA = v.nohy.find((n) => n.strana === 'L'); nB = v.nohy.find((n) => n.strana === 'P');
    }
    if (!nA || !nB || nA === nB) { $('porovnani').innerHTML = '<p class="info">Porovnání potřebuje dva obrysy' + (typ === 'uni' ? ' – v kartě Chodidlo zvolte „Každá zvlášť“ a v Tisku → Další „Obě nohy“.' : ' – např. levou a pravou nohu, chodidlo vestoje a vsedě, nebo chodidlo a stélku vyjmutou z boty.') + '</p>'; return; }
    const r = A.porovnejNohy(nA, nB, porCo, zrc);
    const z = (x, d) => { d = d === undefined ? 1 : d; const q = Math.round(x * 10 ** d) / 10 ** d; return (q > 0 ? '+' : q < 0 ? '−' : '±') + fmt(Math.abs(q), d); };
    const jmA = typ === 'uni' ? 'levá' : 'A', jmB = typ === 'uni' ? 'pravá' : 'B';
    let zaver;
    if (nB.role === 'stelka' || nA.role === 'stelka') {
      const [noha, st, pr] = nB.role === 'stelka' ? ['A', 'B', r.presahA] : ['B', 'A', r.presahB];
      const rez = nB.role === 'stelka' ? -r.rozdil.delka : r.rozdil.delka;
      zaver = pr.d > 1 ? `<b class="err-t">Chodidlo (${noha}) přesahuje stélku (${st}) až o ${fmt(pr.d, 1)} mm</b> – v tom místě bude bota tlačit (kroužek).` : `<b class="ok-t">Chodidlo se do stélky vejde.</b> Rezerva v délce ${fmt(rez, 1)} mm` + (rez < 8 ? ' – <span class="warn-t">na barefoot je to málo</span>.' : rez > 20 ? ' – bota bude volná.' : '.');
    } else zaver = r.max.d > 4 ? 'Rozdíl přes 4 mm – vyplatí se mít každou vložku podle vlastního obrysu.' : 'Obrysy jsou si podobné – rozdíl do 4 mm.';
    $('porovnani').innerHTML = `<div class="obr">${A.svgPorovnani(r)}</div><div><table>
      <tr><th></th><th class="c">${jmA}</th><th class="c">${jmB}</th><th class="c">${jmA} − ${jmB}</th></tr>
      <tr><td>Délka</td><td class="c">${fmt(r.ra.delka, 1)}</td><td class="c">${fmt(r.rb.delka, 1)}</td><td class="c"><b>${z(r.rozdil.delka)}</b></td></tr>
      <tr><td>Šířka</td><td class="c">${fmt(r.ra.sirka, 1)}</td><td class="c">${fmt(r.rb.sirka, 1)}</td><td class="c"><b>${z(r.rozdil.sirka)}</b></td></tr>
      <tr><td>Pata</td><td class="c">${fmt(r.ra.pata, 1)}</td><td class="c">${fmt(r.rb.pata, 1)}</td><td class="c">${z(r.rozdil.pata)}</td></tr>
      <tr><td>Plocha cm²</td><td class="c">${fmt(r.ra.plocha / 100)}</td><td class="c">${fmt(r.rb.plocha / 100)}</td><td class="c">${z(r.rozdil.plocha / 100, 0)}</td></tr>
      <tr><td><span class="err-t">■</span> ${jmA} přesahuje ${jmB}</td><td class="c" colspan="3">až ${fmt(r.presahA.d, 1)} mm, ${fmt(r.plochaA / 100, 1)} cm²</td></tr>
      <tr><td><span class="ok-t">■</span> ${jmB} přesahuje ${jmA}</td><td class="c" colspan="3">až ${fmt(r.presahB.d, 1)} mm, ${fmt(r.plochaB / 100, 1)} cm²</td></tr></table>
      <p class="info">${zrc ? `${jmA} je zrcadlená a ` : ''}obrysy jsou přiložené patou: <span class="err-t">červeně čárkovaně ${jmA}</span>, <span style="color:var(--accent)">modře ${jmB}</span>. ${zaver}</p></div>`;
  }
  $('porA').addEventListener('change', () => { porSel.a = $('porA').value; porSel.zrc = null; kresliPorovnani(); });
  $('porB').addEventListener('change', () => { porSel.b = $('porB').value; porSel.zrc = null; kresliPorovnani(); });
  $('porZrc').addEventListener('change', () => { porSel.zrc = $('porZrc').checked; kresliPorovnani(); });

  /* velikostní řada: pro každé číslo EU univerzální vložka se stejnými poměry a rezervami jako aktuální návrh */
  function sadyRady() {
    const od = +$('radaOd').value || 36, d = +$('radaDo').value || 46, krok = +$('radaKrok').value || 1, pary = Math.max(1, Math.min(20, Math.round(+$('radaPary').value || 1))), L = [];
    for (let eu = Math.min(od, d); eu <= Math.max(od, d) + 1e-9 && L.length < 60; eu += krok) {
      const del = J.delkaZEu(eu, p.rezPrsty), k = del / p.pDelka;
      const q = J.spocitej(Object.assign({}, p, { nohy: 'stejne', pDelka: del, pSirka: Math.round(p.pSirka * k), pPata: Math.round(p.pPata * k), strany: 'obe', jmeno: '' }));
      L.push({ nohy: q.nohy, pary, nazev: 'EU ' + fmt(eu, eu % 1 ? 1 : 0) });
    }
    return L;
  }
  ['radaZap', 'radaOd', 'radaDo', 'radaKrok', 'radaPary'].forEach((id) => $(id).addEventListener('change', () => kresliArch()));
  function kresliArch() {
    for (const k of ['sirka', 'vyska', 'okraj', 'mezera', 'pary']) if (document.activeElement !== $('arch' + k[0].toUpperCase() + k.slice(1))) $('arch' + k[0].toUpperCase() + k.slice(1)).value = arch[k];
    $('archOtacet').checked = arch.otacet; $('archSmer').value = arch.smer; $('archVrstva').value = arch.vrstva;
    if (document.activeElement !== $('archCena')) $('archCena').value = arch.cena || '';
    $('archVrstvaBlok').classList.toggle('skryte', !(p.vrstvy && p.rezim === 'vlozka'));
    $('archPredvolba').value = [...$('archPredvolba').options].some((o) => o.value === arch.sirka + 'x' + arch.vyska) ? arch.sirka + 'x' + arch.vyska : '';
    if (!v.nohy.length) { archVysledek = null; $('archInfo').textContent = 'Zatím není co rozvrhnout.'; $('archNahled').innerHTML = ''; return; }
    /* další projekty na arch (Na míru): jejich vložky jdou první, aktuální projekt doplní zbytek */
    let mix = vlastni() ? window.BFV_UI.sadyMix(arch.mix, p) : [];
    const rada = !vlastni() && $('radaZap').checked ? sadyRady() : null;
    if (rada) mix = rada;
    archVysledek = A.rozvrh(v, Object.assign({}, arch, { vrstva: p.vrstvy && p.rezim === 'vlozka' ? arch.vrstva : 'horni', sady: rada ? rada : mix.length ? mix.concat([{ nohy: v.nohy, pary: arch.pary, nazev: 'tento projekt' }]) : null }));
    const r = archVysledek, N = v.nohy.length, n = r.pary, sk = (a, b, c) => (n === 1 ? a : n > 1 && n < 5 ? b : c);
    const sada = N === 2 ? sk('pár', 'páry', 'párů') : N === 1 ? sk('kus', 'kusy', 'kusů') : sk('sada', 'sady', 'sad') + ` (po ${N} ks)`;
    const plochaPar = r.kusy.length ? r.plochaKusu / r.kusy.length * N : 0;
    const cena = arch.cena > 0 && r.pary ? ` Materiál na pár: <b>${fmt(arch.cena / r.pary, 1)} Kč</b> při spotřebě celého archu (čistě podle plochy dílů ${fmt(arch.cena * plochaPar / (arch.sirka * arch.vyska), 1)} Kč).` : '';
    $('archInfo').innerHTML = r.pary ? `Vejde se <b>${r.pary} ${sada}</b> (${r.kusy.length} ks)` + (mix.length ? ` – ${r.sady.filter((q) => q.pary).map((q) => `${esc(q.nazev)}: ${q.pary}`).join(', ')}` + (r.sady.some((q) => !q.pary) ? ` · <span class="warn-t">nevešlo se: ${r.sady.filter((q) => !q.pary).map((q) => esc(q.nazev)).join(', ')} – zvětšete arch</span>` : '') : '') + `, využití materiálu <b>${fmt(r.vyuziti * 100)} %</b>. Na jeden pár ${fmt(arch.sirka * arch.vyska / r.pary / 100)} cm² archu.` + cena
      : '<b>Na arch se nevejde ani jeden pár</b> – zvětšete arch nebo zmenšete okraj.';
    const sc = A.scenaArchu(r, true);
    $('archNahled').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${sc.w + 4} ${sc.h + 4}" role="img" aria-label="Rozvržení na arch">${V.svgPrvky(sc, Math.max(1, sc.w / 400))}</svg>`;
  }
  const ulozArch = () => { try { localStorage.setItem(KLIC_ARCH, JSON.stringify(arch)); } catch (e) { /* nevadí */ } };
  for (const k of ['sirka', 'vyska', 'okraj', 'mezera', 'pary']) {
    const el = $('arch' + k[0].toUpperCase() + k.slice(1)), [a, b] = [+el.min, +el.max];
    el.addEventListener('change', () => { const x = parseFloat(String(el.value).replace(',', '.')); if (Number.isFinite(x)) arch[k] = Math.min(b, Math.max(a, k === 'pary' ? Math.round(x) : x)); ulozArch(); kresliArch(); });
  }
  $('archVrstva').addEventListener('change', () => { arch.vrstva = $('archVrstva').value; ulozArch(); kresliArch(); });
  $('archCena').addEventListener('change', () => { const x = parseFloat(String($('archCena').value).replace(',', '.')); arch.cena = Number.isFinite(x) && x > 0 ? x : 0; ulozArch(); kresliArch(); });
  $('archMix').addEventListener('toggle', async () => {
    if (!$('archMix').open || !vlastni()) return;
    const L = await window.BFV_UI.jineProjekty();
    kresliArch();
    $('archMixSeznam').innerHTML = L.length ? L.map((q) => `<label class="chk" style="justify-content:space-between"><span>${esc(q.nazev)}${q.klient ? ' · ' + esc(q.klient) : ''}</span><input type="number" min="0" max="50" step="1" data-mix="${q.id}" value="${arch.mix[q.id] || 0}" style="width:70px" aria-label="Párů z projektu ${esc(q.nazev)}"></label>`).join('') + '<small>Počet párů z každého projektu (0 = nepřidávat).</small>' : 'Žádné další projekty.';
  });
  $('archMixSeznam').addEventListener('change', (e) => {
    const el = e.target.closest('[data-mix]'); if (!el) return;
    const x = Math.max(0, Math.min(50, Math.round(+el.value || 0)));
    if (x) arch.mix[el.dataset.mix] = x; else delete arch.mix[el.dataset.mix];
    ulozArch(); kresliArch();
  });
  $('archSmer').addEventListener('change', () => { arch.smer = $('archSmer').value; ulozArch(); kresliArch(); });
  $('archOtacet').addEventListener('change', () => { arch.otacet = $('archOtacet').checked; ulozArch(); kresliArch(); });
  $('archPredvolba').addEventListener('change', () => { const m = $('archPredvolba').value.split('x').map(Number); if (m.length === 2) { arch.sirka = m[0]; arch.vyska = m[1]; ulozArch(); kresliArch(); } });
  document.querySelectorAll('[data-por]').forEach((b) => b.addEventListener('click', () => { porCo = b.dataset.por; kresliPorovnani(); }));
  const archPrazdny = () => { if (archVysledek && archVysledek.pary) return false; toast('Na arch se nevejde žádný pár.', true); return true; };
  $('archSvg').addEventListener('click', () => { if (archPrazdny()) return; const sc = A.scenaArchu(archVysledek, true); stahni(new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${sc.w}mm" height="${sc.h}mm" viewBox="0 0 ${sc.w} ${sc.h}">\n${V.svgPrvky(sc)}\n</svg>\n`], { type: 'image/svg+xml' }), zaklad() + '_arch.svg'); });
  $('archPdf').addEventListener('click', async () => {
    if (archPrazdny()) return;
    try {
      if (!window.jspdf) throw new Error('jsPDF se nenačetl');
      const doc = V.pdfSceny(window.jspdf.jsPDF, A.scenaArchu(archVysledek, true), { papir: PAPIRY[$('papir').value] || PAPIRY.a4, okraj: okrajPdf(), prekryv: prekryvPdf(), pismo: await nactiPismo(), tiskarna, nazev: `Arch ${arch.sirka} × ${arch.vyska} mm – ${archVysledek.pary} párů` });
      stahni(doc.output('blob'), zaklad() + '_arch.pdf');
      toast(`PDF archu: ${doc.getNumberOfPages()} listů 1:1 (papír podle nabídky Tisk → Další).`);
    } catch (e) { console.error(e); toast('PDF se nepodařilo vytvořit: ' + e.message, true); }
  });
  $('archRez').addEventListener('click', () => { if (archPrazdny()) return; stahni(new Blob([V.svgRez(A.scenaArchu(archVysledek, rez.gravirovat), Object.assign({}, rez, { dil: 'horni' }))], { type: 'image/svg+xml' }), zaklad() + '_arch_' + rez.profil + '.svg'); });
  $('archDxf').addEventListener('click', () => { if (archPrazdny()) return; stahni(new Blob([V.dxfSceny(A.scenaArchu(archVysledek, true))], { type: 'application/dxf' }), zaklad() + '_arch.dxf'); });

  /* ---------- moje boty: vnitřní rozměry a jak sedí na nohy z návrhu ---------- */
  const KLIC_BOTY = 'webapp_barefoot_vlozky_boty';
  const boty = () => { try { const L = JSON.parse(localStorage.getItem(KLIC_BOTY) || '[]'); return Array.isArray(L) ? L.filter((b) => b && typeof b.nazev === 'string') : []; } catch (e) { return []; } };
  const ulozBoty = (L) => { try { localStorage.setItem(KLIC_BOTY, JSON.stringify(L)); } catch (e) { toast('Boty se nepodařilo uložit.', true); } };
  function kresliVyberBot() {
    const L = boty();
    $('botaVyber').innerHTML = '<option value="">—</option>' + L.map((b, i) => `<option value="${i}">${esc(b.nazev)} (${fmt(+b.delka || 0)} mm)</option>`).join('');
    const i = L.findIndex((b) => +b.delka === p.delkaBoty); $('botaVyber').value = i >= 0 ? String(i) : '';
  }
  $('botaVyber').addEventListener('change', () => { const b = boty()[+$('botaVyber').value]; if (b) zmena({ delkaBoty: +b.delka || 0 }); });
  function kresliBoty() {
    const L = boty(), nohy = v.nohy.filter((n) => (n.role || 'noha') !== 'stelka');
    const sedi = (b, n) => {
      const dl = (+b.delka || 0) - n.m.delka, sr = (+b.sirka || 0) - n.m.sirka;
      const tl = dl < 8 ? 'err-t' : dl > 20 ? 'warn-t' : 'ok-t', ts = !b.sirka ? '' : sr < 0 ? 'err-t' : 'ok-t';
      return `<span class="${tl}">${dl >= 0 ? '+' : '−'}${fmt(Math.abs(dl))}</span>` + (b.sirka ? ` / <span class="${ts}">${sr >= 0 ? '+' : '−'}${fmt(Math.abs(sr))}</span>` : '');
    };
    const fok = document.activeElement && document.activeElement.closest('#tabBoty [data-bota]') ? [document.activeElement.closest('[data-bota]').dataset.bota, document.activeElement.dataset.k] : null;
    $('tabBoty').innerHTML = `<tr><th>Bota</th><th class="c">Vnitřní délka</th><th class="c">Šířka</th>${nohy.map((n) => `<th class="c">${esc(n.nazev)}<br><small>délka / šířka</small></th>`).join('')}<th></th></tr>` +
      (L.map((b, i) => `<tr data-bota="${i}"><td><input data-k="nazev" value="${esc(b.nazev)}" maxlength="60" aria-label="Název boty"></td><td><input data-k="delka" type="number" min="0" max="400" step="1" value="${+b.delka || ''}" aria-label="Vnitřní délka mm"></td><td><input data-k="sirka" type="number" min="0" max="200" step="1" value="${+b.sirka || ''}" aria-label="Vnitřní šířka mm"></td>${nohy.map((n) => `<td class="c">${b.delka ? sedi(b, n) : ''}</td>`).join('')}<td style="white-space:nowrap"><button class="mini" data-orez title="Ořez vložky na délku této boty">✂ ořez</button> <button class="mini" data-smaz aria-label="Smazat">✕</button></td></tr>`).join('') ||
      `<tr><td colspan="${4 + nohy.length}" class="info">Zatím žádná bota.</td></tr>`);
    if (fok && fok[1]) { const el = document.querySelector(`#tabBoty [data-bota="${fok[0]}"] [data-k="${fok[1]}"]`); if (el) el.focus(); }
  }
  $('botaPridat').addEventListener('click', () => { const L = boty(); L.push({ nazev: 'Bota ' + (L.length + 1), delka: Math.round((v.nohy[0] ? v.nohy[0].m.delka : 255) + 12), sirka: 0 }); ulozBoty(L); kresliBoty(); kresliVyberBot(); });
  $('tabBoty').addEventListener('change', (e) => {
    const tr = e.target.closest('[data-bota]'), k = e.target.dataset.k; if (!tr || !k) return;
    const L = boty(), b = L[+tr.dataset.bota]; if (!b) return;
    b[k] = k === 'nazev' ? e.target.value.slice(0, 60) : Math.max(0, Math.min(400, +e.target.value || 0));
    ulozBoty(L); poKliku(() => { kresliBoty(); kresliVyberBot(); });   // až po přesunu fokusu (Tab) a po kliknutí, kvůli kterému pole ztratilo fokus
  });
  $('tabBoty').addEventListener('click', async (e) => {
    const tr = e.target.closest('[data-bota]'); if (!tr) return;
    const L = boty(), b = L[+tr.dataset.bota]; if (!b) return;
    if (e.target.closest('[data-orez]')) { zmena({ delkaBoty: +b.delka || 0 }); toast(`Ořez na délku boty ${fmt(+b.delka)} mm – plná červená čára v šabloně.`); }
    if (e.target.closest('[data-smaz]') && await Dialog.potvrd(`Smazat botu „${b.nazev}“?`)) { L.splice(+tr.dataset.bota, 1); ulozBoty(L); kresliBoty(); kresliVyberBot(); }
  });

  /* ---------- záložky ---------- */
  function zalozka(z) {
    zalozkaZ = z;
    document.querySelectorAll('#zalozky [data-z]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.z === z)));
    document.querySelectorAll('.panel[data-p]').forEach((el) => { el.hidden = el.dataset.p !== z; });
    document.querySelectorAll('#zalozky [data-z]').forEach((b) => { b.tabIndex = b.dataset.z === z ? 0 : -1; });
    kresliZalozku(true);
  }
  $('zalozky').addEventListener('click', (e) => { const b = e.target.closest('[data-z]'); if (b) zalozka(b.dataset.z); });
  /* šipky mezi záložkami (jen viditelné) */
  $('zalozky').addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const L = [...document.querySelectorAll('#zalozky [data-z]')].filter((b) => b.offsetParent !== null), i = L.findIndex((b) => b.dataset.z === zalozkaZ);
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? L.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + L.length) % L.length;
    e.preventDefault(); zalozka(L[j].dataset.z); L[j].focus();
  });
  $('btnNavod').addEventListener('click', () => { zalozka('princip'); $('princip').scrollIntoView({ behavior: 'smooth', block: 'start' }); });

  /* ---------- předloha a měření ---------- */
  /* střed předlohy je kotvený k levému okraji první vložky (dx) a k patě (dy), aby seděl i po vypnutí kót */
  const pred = { src: null, w: 1, h: 1, dx: 50, dy: -130, sirka: 200, uhel: 0, pruhl: 0.6 };
  const predX = () => sc.xPrvni + pred.dx, predY = () => sc.yPata + pred.dy;
  const predTransform = () => `translate(${predX()} ${predY()}) rotate(${pred.uhel}) scale(${pred.sirka / pred.w})`;
  function predObnov() { const g = $('predG'); if (!g) { kresliNahled(); return; } g.setAttribute('transform', predTransform()); g.setAttribute('opacity', pred.pruhl); }
  const mereni = { rezim: null, body: [] };   // rezim: 'kalibrace' | 'merit'
  const bodSvg = (e) => {
    const s = $('nahledSvg'), pt = s.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const q = pt.matrixTransform(s.getScreenCTM().inverse()); return [q.x, q.y];
  };
  function predlohaAktivni(a) { ['btnKalibrace', 'predUhel', 'predPruhl', 'btnOdebrat'].forEach((id) => { $(id).disabled = !a; }); $('nahled').classList.toggle('posun', a); }
  $('btnObrazek').addEventListener('click', () => $('souborObr').click());
  $('souborObr').addEventListener('change', () => {
    const f = $('souborObr').files[0]; if (!f) return;
    const url = URL.createObjectURL(f), img = new Image();
    {
      img.onload = () => {
        /* zmenšit (fotka z mobilu má i 10 MB) – náhled se pak hýbe plynule */
        const k = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        Object.assign(pred, { src: c.toDataURL('image/jpeg', 0.88), w: c.width, h: c.height, uhel: 0, pruhl: 0.6 });
        if (!sc) { toast('Nejdřív musí být vidět šablona.', true); return; }
        pred.sirka = Math.min(sc.w, 220); pred.dx = sc.w / 2 - sc.xPrvni; pred.dy = -(pred.sirka * pred.h / pred.w) / 2;
        $('predUhel').value = 0; $('predPruhl').value = 0.6;
        predlohaAktivni(true); kresliNahled();
        toast('Předloha načtena. Teď nastavte měřítko: Předloha → Měřítko obrázku a klikněte na dva body pravítka.');
      };
      img.onerror = () => { URL.revokeObjectURL(url); toast('Obrázek se nepodařilo načíst.', true); };
      img.src = url;
    }
    $('souborObr').value = '';
  });
  $('predUhel').addEventListener('input', () => { pred.uhel = +$('predUhel').value; predObnov(); });
  $('predPruhl').addEventListener('input', () => { pred.pruhl = +$('predPruhl').value; predObnov(); });
  $('btnOdebrat').addEventListener('click', () => { pred.src = null; predlohaAktivni(false); konecNastroje(); kresliNahled(); });
  function zacniNastroj(r) {
    mereni.rezim = r; mereni.body = [];
    $('nahled').classList.add('nastroj');
    $('nastrojLista').hidden = false; $('nastrojTlacitka').innerHTML = '';
    $('nastrojText').textContent = r === 'kalibrace' ? 'Klikněte na dva body předlohy, jejichž vzdálenost znáte (např. 0 a 20 cm na pravítku).' : 'Klikněte na dva body – změřím vzdálenost v mm.';
    kresliNahled();
    zalozka('sablona');
    $('nahled').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function konecNastroje() {
    if (!mereni.rezim && !mereni.body.length) return;
    mereni.rezim = null; mereni.body = [];
    $('nahled').classList.remove('nastroj'); $('nastrojLista').hidden = true;
    kresliNahled();
  }
  $('btnKalibrace').addEventListener('click', () => zacniNastroj('kalibrace'));
  $('btnMerit').addEventListener('click', () => zacniNastroj('merit'));
  $('btnNastrojKonec').addEventListener('click', konecNastroje);
  async function hotovyBod() {
    const [a, b] = mereni.body, d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (mereni.rezim === 'kalibrace') {
      const s = await Dialog.zeptej(`Jaká je skutečná vzdálenost těch dvou bodů v mm? (teď ${fmt(d, 1)} mm)`, '100');
      const x = parseFloat(String(s || '').replace(',', '.'));
      if (x > 0 && d > 0.5) {
        /* zvětšit kolem prvního bodu, aby zůstal na místě */
        const k = x / d, cx = predX(), cy = predY();
        pred.dx = a[0] + (cx - a[0]) * k - sc.xPrvni; pred.dy = a[1] + (cy - a[1]) * k - sc.yPata; pred.sirka *= k;
        toast(`Zkalibrováno: měřítko × ${fmt(k, 3)}. Teď můžete měřit (Předloha → Měřit).`);
      }
      konecNastroje();
      return;
    }
    $('nastrojText').innerHTML = `Vzdálenost <b>${fmt(d, 1)} mm</b> – převzít jako:`;
    const pole = p.nohy === 'zvlast' ? [['pDelka', 'délka P'], ['pSirka', 'šířka P'], ['pPata', 'pata P'], ['lDelka', 'délka L'], ['lSirka', 'šířka L'], ['lPata', 'pata L']] : [['pDelka', 'délka'], ['pSirka', 'šířka'], ['pPata', 'pata']];
    $('nastrojTlacitka').innerHTML = pole.map(([k, t]) => `<button class="btn btn-sec" type="button" data-prevzit="${k}">${t}</button>`).join(' ');
    $('nastrojTlacitka').onclick = (e) => {
      const t = e.target.closest('[data-prevzit]'); if (!t) return;
      zmena({ [t.dataset.prevzit]: Math.round(d) }); toast(`Převzato: ${t.textContent} = ${Math.round(d)} mm`);
      mereni.body = []; $('nastrojTlacitka').innerHTML = ''; $('nastrojText').textContent = 'Klikněte na další dva body, nebo Hotovo.'; kresliNahled();
    };
  }
  let tah = null;
  $('nahled').addEventListener('pointerdown', (e) => {
    if (!$('nahledSvg')) return;
    const q = bodSvg(e);
    if (mereni.rezim) {
      if (mereni.body.length >= 2) mereni.body = [];
      mereni.body.push(q); kresliNahled();
      if (mereni.body.length === 2) hotovyBod();
      return;
    }
    if (pred.src && e.target.id === 'predObr') { tah = { q, dx: pred.dx, dy: pred.dy }; $('nahled').setPointerCapture(e.pointerId); e.preventDefault(); }
  });
  $('nahled').addEventListener('pointermove', (e) => {
    if (!tah) return;
    const q = bodSvg(e); pred.dx = tah.dx + q[0] - tah.q[0]; pred.dy = tah.dy + q[1] - tah.q[1]; predObnov();
  });
  const pust = () => { tah = null; };
  $('nahled').addEventListener('pointerup', pust);
  $('nahled').addEventListener('pointercancel', pust);

  /* ---------- 3D ---------- */
  let S3 = null, nacitani3d = null;
  const nactiSkript = (src) => new Promise((ok, chyba) => { const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = () => chyba(new Error('nejde načíst ' + src)); document.head.appendChild(el); });
  function nacti3d() {
    if (nacitani3d) return nacitani3d;
    nacitani3d = (async () => {
      if (!window.THREE) await nactiSkript('lib/three.0.160.0.min.js');
      S3 = window.BF3D.vytvor($('obal3d'));
      $('stav3d').remove();
      obnov3d();
    })().catch((e) => { console.error(e); pozor3d.disconnect(); if ($('stav3d')) $('stav3d').textContent = '3D se nepodařilo zobrazit (prohlížeč nepodporuje WebGL?): ' + e.message; });
    return nacitani3d;
  }
  const pozor3d = new IntersectionObserver((z) => { if (z.some((x) => x.isIntersecting)) nacti3d(); }, { rootMargin: '200px' });
  pozor3d.observe($('obal3d'));
  let cas3d = 0;
  let zastaraly3d = false;   // 3D se staví jen na viditelné záložce, jinak až po přepnutí
  function obnov3d() { if (!S3) return; if (zalozkaZ !== '3d') { zastaraly3d = true; return; } zastaraly3d = false; clearTimeout(cas3d); cas3d = setTimeout(() => S3.nastav(v), 120); }
  document.querySelectorAll('[data-pohled]').forEach((b) => b.addEventListener('click', () => { if (S3) { const [a, e] = b.dataset.pohled.split(',').map(Number); S3.pohled(a, e); } }));

  /* ---------- export ---------- */
  const prazdne = () => { if (v.nohy.length) return false; toast('Zatím není co tisknout – nejdřív přidejte předlohu a najděte obrysy.', true); return true; };
  const zaklad = () => (p.rezim === 'kontrolni' ? 'kontrolni_sablona' : vlastni() ? 'vlozky_na_miru' : 'barefoot_vlozky') + (v.p.jmeno ? '_' + v.p.jmeno.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase() : '') + '_' + Math.round(v.nohy.length ? v.nohy[v.nohy.length - 1].m.delka : p.pDelka);
  function stahni(blob, jmeno) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = jmeno; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  $('btnSvg').addEventListener('click', () => !prazdne() && stahni(new Blob([V.svg(v, { zrcadlit: tisk.zrcadlit })], { type: 'image/svg+xml' }), zaklad() + (tisk.zrcadlit ? '_zrcadlene' : '') + '.svg'));
  $('btnDxf').addEventListener('click', () => !prazdne() && stahni(new Blob([V.dxf(v, { zrcadlit: tisk.zrcadlit })], { type: 'application/dxf' }), zaklad() + (tisk.zrcadlit ? '_zrcadlene' : '') + '.dxf'));
  const scenaStroj = () => V.scena(v, { zrcadlit: tisk.zrcadlit });
  $('btnSvgRez').addEventListener('click', () => !prazdne() && stahni(new Blob([V.svgRez(scenaStroj(), rez)], { type: 'image/svg+xml' }), zaklad() + '_' + rez.profil + (rez.dil && rez.dil !== 'horni' ? '_' + rez.dil : '') + '.svg'));
  $('btnDxfRez').addEventListener('click', () => !prazdne() && stahni(new Blob([V.dxfRez(scenaStroj(), rez)], { type: 'application/dxf' }), zaklad() + '_' + rez.profil + (rez.dil && rez.dil !== 'horni' ? '_' + rez.dil : '') + '.dxf'));
  $('btnPng').addEventListener('click', () => {
    if (prazdne()) return;
    const k = 4, vb = $('nahledSvg').viewBox.baseVal, kl = $('nahledSvg').cloneNode(true), img = new Image();
    kl.setAttribute('width', vb.width * k); kl.setAttribute('height', vb.height * k);   // Firefox bez rozměrů SVG nevykreslí
    const s = new XMLSerializer().serializeToString(kl);
    img.onerror = () => toast('Obrázek náhledu se nepodařilo vytvořit.', true);
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = Math.round(vb.width * k); c.height = Math.round(vb.height * k);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => stahni(b, zaklad() + '_nahled.png'), 'image/png');
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  });
  function nactiPismo() {
    if (window.FONTY_JS && window.FONTY_JS['LiberationSans-Regular.ttf']) return Promise.resolve(window.FONTY_JS['LiberationSans-Regular.ttf']);
    return new Promise((ok) => { const s = document.createElement('script'); s.src = 'stitky_panely/fonty/LiberationSans-Regular.ttf.js'; s.onload = () => ok((window.FONTY_JS || {})['LiberationSans-Regular.ttf'] || null); s.onerror = () => ok(null); document.head.appendChild(s); });
  }
  async function stahniKartu() {
    try {
      if (!window.jspdf) throw new Error('jsPDF se nenačetl');
      stahni(V.pdfKarty(window.jspdf.jsPDF, { pismo: await nactiPismo(), tiskarna }).output('blob'), 'kalibracni_karta_A4.pdf');
      toast('Kalibrační karta: vytiskněte na A4 ve skutečné velikosti, obkreslete na ní nohu a vyfoťte i se čtyřmi černými čtverci.');
    } catch (e) { toast('Kartu se nepodařilo vytvořit: ' + e.message, true); }
  }
  $('nstKarta').addEventListener('click', stahniKartu);
  $('btnPdf').addEventListener('click', async () => {
    if (prazdne()) return;
    const b = $('btnPdf'), puv = b.textContent; b.disabled = true; b.textContent = 'Připravuji…';
    try {
      if (!window.jspdf) throw new Error('jsPDF se nenačetl');
      const doc = V.pdf(window.jspdf.jsPDF, v, { papir: PAPIRY[$('papir').value] || PAPIRY.a4, okraj: okrajPdf(), prekryv: prekryvPdf(), pismo: await nactiPismo(), texty: tisk.navod ? P.radky() : null, souhrn: tisk.souhrn, zrcadlit: tisk.zrcadlit, tiskarna });
      stahni(doc.output('blob'), zaklad() + '.pdf');
      toast(`PDF: ${doc.getNumberOfPages()} stran. Tiskněte ve skutečné velikosti (100 %, ne „přizpůsobit stránce“) a změřte kontrolní čtverec.`);
    } catch (e) { console.error(e); toast('PDF se nepodařilo vytvořit: ' + e.message, true); }
    finally { b.disabled = false; b.textContent = puv; }
  });

  /* ---------- projekty a JSON ---------- */
  const projekty = () => { try { const L = JSON.parse(localStorage.getItem(KLIC_PROJ) || '[]'); return Array.isArray(L) ? L.filter((q) => q && typeof q.nazev === 'string' && q.p) : []; } catch (e) { return []; } };
  const ulozProjekty = (L) => { try { localStorage.setItem(KLIC_PROJ, JSON.stringify(L)); return true; } catch (e) { toast('Projekt se nepodařilo uložit (úložiště je plné nebo zakázané).', true); return false; } };
  function kresliProjekty() {
    const L = projekty(), ul = $('projekty');
    ul.innerHTML = L.length ? '' : '<li><span style="color:var(--text-faint)">Zatím nic – uložte třeba vložky pro každého v rodině.</span></li>';
    L.forEach((q) => {
      const li = document.createElement('li');
      li.innerHTML = `<span title="${esc(q.nazev)}">${esc(q.nazev)}</span><button type="button">Načíst</button><button type="button" aria-label="Smazat">✕</button>`;
      li.children[1].addEventListener('click', () => { p = J.normalizuj(q.p); zavriNabidky(); obnovFormular(); prepocitej(); toast('Načteno: ' + q.nazev); });
      li.children[2].addEventListener('click', async (e) => { e.stopPropagation(); if (await Dialog.potvrd(`Smazat projekt „${q.nazev}“?`)) { ulozProjekty(projekty().filter((x) => x.nazev !== q.nazev)); kresliProjekty(); } });
      ul.appendChild(li);
    });
  }
  $('btnUlozit').addEventListener('click', async () => {
    const n = ((await Dialog.zeptej('Název projektu:', p.jmeno || `Vložky ${fmt(p.pDelka)} mm`)) || '').trim();
    if (!n) return;
    const L = projekty(), i = L.findIndex((q) => q.nazev === n), z = { nazev: n, p, datum: new Date().toISOString() };
    if (i >= 0) L[i] = z; else L.unshift(z);
    if (ulozProjekty(L.slice(0, 50))) { kresliProjekty(); toast('Uloženo: ' + n); }
  });
  $('btnExportJson').addEventListener('click', () => stahni(new Blob([JSON.stringify({ format: 'barefoot-vlozky', verze: 1, p }, null, 2)], { type: 'application/json' }), zaklad() + '.json'));
  $('btnImportJson').addEventListener('click', () => $('souborJson').click());
  $('souborJson').addEventListener('change', async () => {
    const f = $('souborJson').files[0]; if (!f) return;
    try { const d = JSON.parse(await f.text()); if (!d || d.format !== 'barefoot-vlozky' || !d.p) throw new Error('soubor neobsahuje nastavení vložek'); p = J.normalizuj(d.p); obnovFormular(); prepocitej(); toast('Načteno: ' + f.name); }
    catch (e) { toast('Import selhal: ' + e.message, true); }
    $('souborJson').value = '';
  });
  $('btnReset').addEventListener('click', async () => { if (await Dialog.potvrd('Vrátit všechny parametry na výchozí hodnoty?')) { p = J.normalizuj({}); obnovFormular(); prepocitej(); } });

  obnovFormular(); kresliProjekty(); prepocitej();
  /* ---------- paleta příkazů (Ctrl+K) a zkratky ---------- */
  function prikazy() {
    const viditelny = (el) => { const n = el.closest('.nabidka'); if (!n) return el.offsetParent !== null; const t = document.querySelector(`[data-nabidka="${n.id}"]`); return !!t && t.offsetParent !== null && !el.closest('.skryte'); };
    const L = [], vid = (el) => viditelny(el) && !(el.closest('.jen-uni') && typ !== 'uni') && !(el.closest('.jen-vlastni') && typ !== 'vlastni') && !el.disabled;
    document.querySelectorAll('.lista button, .nabidka button.tl, #zalozky [data-z], .edLista button').forEach((el) => {
      if (!vid(el) || el.id === 'nstPaleta') return;
      const t = (el.textContent || '').replace(/\s+/g, ' ').replace('▾', '').trim(), sk = el.closest('.nabidka') ? ((document.querySelector(`[data-nabidka="${el.closest('.nabidka').id}"]`) || {}).textContent || '').replace('▾', '').trim() || 'nabídka' : el.closest('#zalozky') ? 'záložka' : el.closest('.edLista') ? 'editor' : 'lišta';
      if (t) L.push({ t: (el.closest('#zalozky') ? 'Záložka: ' : '') + t, sk: String(sk).trim(), el });
    });
    return L;
  }
  let palL = [], palI = 0;
  function kresliPaletu() {
    const q = $('palHledat').value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    palL = prikazy().filter((x) => (x.t + ' ' + x.sk).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q)).slice(0, 40);
    palI = Math.min(palI, Math.max(0, palL.length - 1));
    $('palSeznam').innerHTML = palL.map((x, i) => `<li role="option" data-i="${i}" aria-selected="${i === palI}">${esc(x.t)}<small>${esc(x.sk)}</small></li>`).join('') || '<li>Nic nenalezeno.</li>';
  }
  function spustPrikaz(i) { const x = palL[i]; if (!x) return; $('dlgPaleta').close(); setTimeout(() => x.el.click(), 30); }
  function otevriPaletu() { zavriNabidky(); $('palHledat').value = ''; palI = 0; kresliPaletu(); $('dlgPaleta').showModal(); $('palHledat').focus(); }
  $('nstPaleta').addEventListener('click', otevriPaletu);
  $('palHledat').addEventListener('input', () => { palI = 0; kresliPaletu(); });
  $('palHledat').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); palI = Math.min(palL.length - 1, palI + 1); kresliPaletu(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); palI = Math.max(0, palI - 1); kresliPaletu(); }
    if (e.key === 'Enter') { e.preventDefault(); spustPrikaz(palI); }
  });
  $('palSeznam').addEventListener('click', (e) => { const li = e.target.closest('[data-i]'); if (li) spustPrikaz(+li.dataset.i); });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); otevriPaletu(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p' && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); $('btnPdf').click(); }
  });

  zalozka(vlastni() ? 'editor' : 'sablona');
  window.BF_UI = { get v() { return v; }, get p() { return p; }, get typ() { return typ; }, nastav: zmena, prepocitej, nastavTyp, toast, zavriNabidky, stahniKartu, nactiPismo, zalozka, otevriKalibraci, stavKalibrace, get tiskarna() { return tiskarna; }, get jednoduse() { return zobr.jednoduse; }, get S3() { return S3; } };
  if (/^#bv=/.test(location.hash) && typ !== 'vlastni') nastavTyp('vlastni');   // sdílený odkaz na obrysy
  else if (vlastni()) window.BFV_UI.aktivuj();
})();
