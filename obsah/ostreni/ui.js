/* ============================================================
   Ostření dlát a hoblíků – uživatelské rozhraní
   ============================================================ */
(function () {
  'use strict';
  const O = window.OSTR, V = window.OSTRV, ST = window.OSTRSTL, PR = window.OSTRPrincip;
  const $ = (id) => document.getElementById(id);
  const KLIC = 'webapp_ostreni', KLIC_PROJEKTY = 'webapp_ostreni_projekty';
  const cz = V.cz;
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const toast = (t, ch) => (window.Dialog ? (ch ? Dialog.chyba(t) : Dialog.info(t)) : console.log(t));

  /* ---------- stav ---------- */
  function nacistStav() {
    const P = O.vychoziProjekt();
    try { const u = JSON.parse(localStorage.getItem(KLIC) || 'null'); if (u && u.vozik) return O.slouc(P, u); } catch (e) { /* poškozené úložiště */ }
    return P;
  }
  let S = nacistStav(), v = null, g = null, pripravekId = 'vozik', dilIdx = 0, ulozTimer = 0, J = null;
  try { const u = JSON.parse(localStorage.getItem(KLIC + '_ui') || 'null'); if (u && O.PRIPRAVKY.some((p) => p.id === u.pripravek)) { pripravekId = u.pripravek; dilIdx = u.dil || 0; } } catch (e) { /* nic */ }
  const uloz = () => { clearTimeout(ulozTimer); ulozTimer = setTimeout(() => { try { localStorage.setItem(KLIC, JSON.stringify(S)); localStorage.setItem(KLIC + '_ui', JSON.stringify({ pripravek: pripravekId, dil: dilIdx })); } catch (e) { /* plné úložiště */ } }, 250); };
  const projekty = () => { try { return JSON.parse(localStorage.getItem(KLIC_PROJEKTY) || '{}') || {}; } catch (e) { return {}; } };
  const ulozProjekty = (o) => { try { localStorage.setItem(KLIC_PROJEKTY, JSON.stringify(o)); return true; } catch (e) { toast('Úložiště prohlížeče je plné.', true); return false; } };

  const cesta = (k) => k.split('.');
  const ziskej = (k) => cesta(k).reduce((o, x) => (o == null ? o : o[x]), S);
  const nastav = (k, val) => { const c = cesta(k), last = c.pop(); c.reduce((o, x) => o[x], S)[last] = val; };

  /* ---------- formulář ---------- */
  const opts = (obj, f) => Object.entries(obj).map(([k, q]) => `<option value="${k}">${esc(f ? f(q) : q.nazev)}</option>`).join('');
  $('pouziti').innerHTML = opts(O.POUZITI); $('drevo').innerHTML = opts(O.DREVO); $('ocel').innerHTML = opts(O.OCEL); $('cTyp').innerHTML = opts(O.CAMBER);
  const pole = [...document.querySelectorAll('[data-k]')];
  function doFormulare() {
    for (const el of pole) {
      const val = ziskej(el.dataset.k);
      if (el.type === 'checkbox') el.checked = !!val; else el.value = val == null ? '' : String(val);
    }
    $('nazevProjektu').value = S.nazev || '';
    viditelnost();
  }
  function viditelnost() {
    $('blokKolo').classList.toggle('skryte', S.vozik.valec !== 'kolo');
    $('blokVlastni').classList.toggle('skryte', S.vozik.valec !== 'vlastni');
    $('pocetLozisek').disabled = S.vozik.valec === 'vlastni';
    $('blokPapir').classList.toggle('skryte', S.tisk.papir !== 'vlastni');
  }
  for (const el of pole) {
    const h = () => {
      let val;
      if (el.type === 'checkbox') val = el.checked;
      else if (el.type === 'number') { val = parseFloat(String(el.value).replace(',', '.')); if (!isFinite(val)) return; }
      else val = el.value;
      if (el.dataset.k === 'vozik.pocetLozisek') val = +val;
      nastav(el.dataset.k, val);
      if (el.dataset.k === 'camber.typ' && O.CAMBER[val] && O.CAMBER[val].c != null) { S.camber.prohnuti = O.CAMBER[val].c; $('cProhnuti').value = S.camber.prohnuti; }
      if (el.dataset.k === 'camber.prohnuti') { S.camber.typ = 'vlastni'; $('cTyp').value = 'vlastni'; }
      if (el.dataset.k === 'nuz.tloustka' || el.dataset.k.startsWith('vozik.') || el.dataset.k.startsWith('kamen.')) drzetUhel = true;
      if (el.dataset.k === 'pouziti') { const p = O.POUZITI[val]; if (p) { S.nuz.sirka = p.sirka; S.nuz.tloustka = p.tloustka; if (p.loze) { S.hoblik.loze = p.loze; S.hoblik.orientace = p.orientace; } doporuc(); doFormulare(); } }
      if (el.dataset.k === 'uhly.primarni') S.vylozeni = null;
      viditelnost(); prepocti();
    };
    el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', h);
  }
  function doporuc() { const d = O.doporuceneUhly(S.pouziti, S.drevo, S.ocel); S.uhly.primarni = d.primarni; S.uhly.mikro = d.mikro; S.vylozeni = null; }
  $('btnDoporucit').addEventListener('click', () => { doporuc(); doFormulare(); prepocti(); });
  $('nazevProjektu').addEventListener('input', () => { S.nazev = $('nazevProjektu').value; uloz(); });

  /* ---------- simulace ---------- */
  let drzetUhel = false, posledniTheta = null;
  const svgDo = (id, prvky, o) => { $(id).innerHTML = V.svg(prvky, Object.assign({ sirkaPx: true, okraj: 4 }, o || {})); };
  function vysl(id, polozky) { $(id).innerHTML = polozky.map(([n, h, c]) => `<div class="${c || ''}"><b>${h}</b><span>${n}</span></div>`).join(''); }
  function prepocti() {
    v = O.vozik(S); g = O.modelVoziku(S, v);
    // při změně vozíku/nože drží úhel (přepočte vyložení), při posuvníku drží vyložení
    if (drzetUhel && posledniTheta != null) S.vylozeni = Math.round(O.vylozeniZUhlu(posledniTheta, g) * 10) / 10;
    drzetUhel = false;
    if (S.vylozeni == null || !isFinite(S.vylozeni)) S.vylozeni = Math.round(O.vylozeniZUhlu(O.cislo(S.uhly.primarni, 25), g) * 10) / 10;
    const Lmin = Math.max(2, Math.ceil(O.vylozeniZUhlu(Math.min(55, v.uhelMax + 8), g))), Lmax = Math.min(250, Math.floor(O.vylozeniZUhlu(12, g)));
    S.vylozeni = Math.min(Lmax, Math.max(Lmin, S.vylozeni));
    $('rozsahL').min = Lmin; $('rozsahL').max = Lmax; $('rozsahL').value = S.vylozeni; $('vylozeni').value = S.vylozeni;
    vykresliSim(); vykresliTabulku(); vykresliPripravek(); vykresliBrusku(); vykresliHoblik(); infa();
    aktualizuj3d(); uloz();
  }
  function vykresliSim() {
    const L = S.vylozeni, th = O.uhelZVylozeni(L, g);
    posledniTheta = th;
    const sc = V.scenaVoziku(S, v, L);
    svgDo('nahledSim', sc.prvky);
    const c = O.citlivost(L, g), Lp = O.vylozeniZUhlu(O.cislo(S.uhly.primarni, 25), g), Lm = O.vylozeniZUhlu(O.cislo(S.uhly.mikro, 30), g);
    const vt = O.vuleTela(v.profil, v.r, th, v.s);
    vysl('vysledkySim', [
      ['úhel ostří', cz(th, 2) + '°', 'hl'],
      ['vyložení L', cz(L, 1) + ' mm'],
      ['pro fazetu ' + cz(S.uhly.primarni, 1) + '°', cz(Lp, 1) + ' mm'],
      ['pro mikro ' + cz(S.uhly.mikro, 1) + '° (Δ)', cz(Lm, 1) + ' mm (' + cz(Lm - Lp, 1) + ')'],
      ['změna na 1 mm vyložení', cz(c.naMmVylozeni, 2) + '°'],
      ['nůž o 1 mm tlustší', (c.naMmTloustky > 0 ? '+' : '') + cz(c.naMmTloustky, 2) + '°'],
      ['délka fazety', cz(O.delkaFazety(g.t, th), 1) + ' mm'],
      ['vůle těla nad kamenem', cz(vt, 1) + ' mm', vt < 0.5 ? 'hl' : ''],
    ]);
    $('popisSim').textContent = `váleček Ø${cz(v.D, 1)}, H ${cz(g.H, 2)}${S.vozik.kalibrace ? ' (kalibrováno)' : ''}, a ${cz(v.a, 1)} mm`;
    const w = [];
    if (vt < 0.5) w.push(`Tělo vozíku při ${cz(th, 1)}° drhne o kámen (${cz(vt, 1)} mm) – zvyšte „max. úhel“ vozíku nebo použijte delší vyložení.`);
    if (th > v.uhelMax + 0.01) w.push(`Úhel je nad navrženým maximem vozíku (${cz(v.uhelMax, 0)}°).`);
    if (O.cislo(S.nuz.sirka, 0) > v.sevreni - 2 * O.cislo(S.vozik.vule, 0.5) + 1e-9) w.push(`Nůž ${cz(S.nuz.sirka, 0)} mm je širší než světlost čelistí ${cz(v.sevreni, 1)} mm – zvětšete max. šířku vozíku.`);
    if (O.cislo(S.nuz.tloustka, 0) > O.cislo(S.vozik.maxTl, 10)) w.push('Nůž je tlustší než max. tloušťka vozíku – šrouby budou krátké.');
    if (S.kamen.valecek === 'deska') w.push(`Váleček jede po desce vedle kamene: broušená plocha je o ${cz(v.s, 1)} mm výš (výška kamene + podstava držáku).`);
    $('varovaniSim').innerHTML = w.map((x) => `<li>${esc(x)}</li>`).join('');
  }
  $('rozsahL').addEventListener('input', () => { S.vylozeni = +$('rozsahL').value; prepocti(); });
  $('vylozeni').addEventListener('input', () => { const x = parseFloat($('vylozeni').value.replace(',', '.')); if (isFinite(x)) { S.vylozeni = x; prepocti(); } });
  $('btnNaPrimarni').addEventListener('click', () => { S.vylozeni = Math.round(O.vylozeniZUhlu(O.cislo(S.uhly.primarni, 25), g) * 10) / 10; prepocti(); });
  $('btnNaMikro').addEventListener('click', () => { S.vylozeni = Math.round(O.vylozeniZUhlu(O.cislo(S.uhly.mikro, 30), g) * 10) / 10; prepocti(); });

  function uhlyTabulky() {
    const s = new Set(); for (let u = 15; u <= 45; u++) s.add(u);
    s.add(O.cislo(S.uhly.primarni, 25)); s.add(O.cislo(S.uhly.mikro, 30));
    return [...s].filter((u) => u >= 10 && u <= 55).sort((a, b) => a - b);
  }
  function vykresliTabulku() {
    const rows = O.tabulkaVylozeni(g, uhlyTabulky(), O.cislo(S.uhly.primarni, 25)), p = O.cislo(S.uhly.primarni, 25), m = O.cislo(S.uhly.mikro, 30);
    $('tabVylozeni').innerHTML = '<thead><tr><th>úhel</th><th>vyložení L</th><th>od fazety</th><th>ostří od dotyku</th><th>délka fazety</th><th>° / mm</th><th class="vl">pozn.</th></tr></thead><tbody>' +
      rows.map((q) => `<tr class="${q.uhel === p || q.uhel === m ? 'akt' : ''}"><td>${cz(q.uhel, 1)}°</td><td>${cz(q.L, 1)}</td><td>${q.delta > 0 ? '+' : ''}${cz(q.delta, 1)}</td><td>${cz(q.Ex, 1)}</td><td>${cz(q.fazeta, 1)}</td><td>${cz(q.citl, 2)}</td><td class="vl">${q.uhel === p ? 'fazeta' : q.uhel === m ? 'mikrofazeta' : q.uhel > v.uhelMax ? 'nad max. vozíku' : ''}</td></tr>`).join('') + '</tbody>';
    $('popisTab').textContent = `nůž tl. ${cz(g.t, 1)} mm · L od čela vozíku`;
  }

  /* ---------- přípravky ---------- */
  function vykresliVyber() {
    $('vyberPripravku').innerHTML = O.PRIPRAVKY.map((p, i) => `<button type="button" role="tab" data-p="${p.id}" aria-selected="${p.id === pripravekId}" title="klávesa ${i + 1}">${p.ikona} ${esc(p.nazev)}<kbd>${i + 1}</kbd></button>`).join('');
  }
  $('vyberPripravku').addEventListener('click', (e) => { const b = e.target.closest('button[data-p]'); if (b) vyberPripravek(b.dataset.p); });
  function vyberPripravek(id) { if (id === pripravekId) return; pripravekId = id; dilIdx = 0; vykresliVyber(); vykresliPripravek(); uloz(); }
  $('vyberDilu').addEventListener('click', (e) => { const b = e.target.closest('button[data-d]'); if (b) { dilIdx = +b.dataset.d; vykresliPripravek(); uloz(); } });
  const dil = () => (J && J.dily[Math.min(dilIdx, J.dily.length - 1)]) || null;
  function vykresliPripravek() {
    J = O.pripravek(S, pripravekId, v);
    if (dilIdx >= J.dily.length) dilIdx = 0;
    $('vyberDilu').innerHTML = J.dily.length > 1 ? J.dily.map((d, i) => `<button type="button" role="tab" data-d="${i}" aria-selected="${i === dilIdx}">${esc(d.nazev)}</button>`).join('') : '';
    const d = dil();
    svgDo('vykres', V.vykresDilu(d).prvky, { okraj: 6 });
    let info = `<b>${esc(d.nazev)}</b> · ${d.kusu} ks · materiál: ${esc(d.material)}<br>Tisk: ${esc(d.tisk)}.`;
    if (pripravekId === 'merka') info += '<br>Stupně: ' + J.stupne.map((q) => `${cz(q.uhel, 1)}° → ${cz(q.X, 1)} mm od osy válečku (vyložení ${cz(q.L, 1)}, nášlap ${cz(q.nasl, 1)})`).join('; ') + '.';
    if (pripravekId === 'vozik') info += `<br>Světlost čelistí ${cz(v.sevreni, 1)} mm (nože do ${cz(S.vozik.maxSirka, 0)} mm + vůle ${cz(S.vozik.vule, 1)} na stranu), svěrka s V-drážkou pro dláta 4–${cz(v.zuziti.sirka - 1, 0)} mm. Lože H = ${cz(v.H, 2)} mm nad osou, čelo a = ${cz(v.a, 1)} mm.`;
    if (pripravekId === 'drzak') info += `<br>Světlost ${cz(J.Wi, 1)} mm pro ${J.sklo ? 'sklo' : 'kámen'} ${cz(J.Lk, 0)} × ${cz(J.Wk, 0)} × ${cz(J.Tk, 1)} mm${J.sklo ? '; papír přeložte přes obě čela skla – sevře ho čelist A a přítlačná destička.' : '.'}`;
    if (pripravekId === 'uhlomer') info += `<br>Horní hrana: jednostranné fazety ${J.horni.map((q) => cz(q.uhel, 1) + '°').join(', ')}; dolní: oboustranné ostří (vrcholový úhel) ${J.dolni.map((q) => cz(2 * q.uhel, 1) + '°').join(', ')}. Ve špičkách zářezů jsou odlehčovací otvory, aby ostří dosedlo.`;
    if (pripravekId === 'camber') info += `<br>Poloměr oblouku R = ${cz(J.Rc, 0)} mm. Ubrat od středu: ${J.pasy.map((q) => `${cz(q.x, 1)} mm → ${cz(J.c - q.ubrat, 2)} mm`).join(', ')} (na kraji celá hloubka).`;
    if (pripravekId === 'opera' && J.nast) info += `<br>Pro ${cz(J.theta, 1)}° na kotouči Ø${cz(J.D, 0)}: sklon opěrky β = ${cz(J.nast.beta, 1)}° (stupnice na bočnici), čep ${cz(J.nast.hx, 1)} mm od osy kotouče.`;
    $('infoDilu').innerHTML = info;
    $('kontroly').innerHTML = J.kontroly.map((k) => `<li class="${k.ok ? 'ok' : 'chyba'}">${esc(k.nazev)} <span style="color:var(--text-faint)">(${cz(k.hodnota, 2)}${k.mez != null ? ' / ' + cz(k.mez, 2) : ''})</span></li>`).join('');
    $('varovaniDilu').innerHTML = (J.varovani || []).map((x) => `<li>${esc(x)}</li>`).join('');
    const kus = (J.kusovnik || []).filter((q) => q.ks > 0);
    $('kusovnik').innerHTML = kus.length ? '<thead><tr><th class="vl">položka</th><th>ks</th><th class="vl">poznámka</th></tr></thead><tbody>' + kus.map((q) => `<tr><td class="vl">${esc(q.pol)}</td><td>${q.ks}</td><td class="vl">${esc(q.pozn)}</td></tr>`).join('') + '</tbody>' : '<tbody><tr><td class="vl">Bez kovových dílů – jen tištěný díl.</td></tr></tbody>';
    $('bezpecnostDilu').innerHTML = pripravekId === 'opera' ? '<div class="bezpecnost"><b>Bruska:</b> brýle/štít, mezera opěrky ke kotouči max. 2–3 mm (po každé změně sklonu znovu přisunout), aretační šrouby utažené, na opěrnou plochu plech. Plast z 3D tisku jiskry taví – PETG/ASA, nikdy PLA. Nůž veďte po opěrce, prsty nikdy mezi opěrku a kotouč.</div>'
      : pripravekId === 'vozik' ? '<div class="bezpecnost">Šrouby utahujte střídavě a rovnoměrně – jednostranně utažená svěrka natočí nůž a ostří nebude kolmé. Ostří po broušení řeže: prsty tlačte na nůž za ostřím, ne na kámen.</div>' : '';
  }
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    if (m && O.PRIPRAVKY[+m[1] - 1]) { e.preventDefault(); vyberPripravek(O.PRIPRAVKY[+m[1] - 1].id); }
  });

  /* ---------- bruska a hoblík ---------- */
  function vykresliBrusku() {
    const B = O.opera(S);
    svgDo('nahledBrusky', V.scenaBrusky(B.D / 2, B.nast, B.t).prvky);
    const q = B.nast;
    vysl('vysledkyBrusky', q ? [
      ['sklon opěrky β', cz(q.beta, 1) + '°', 'hl'],
      ['čep od osy kotouče', cz(q.hx, 1) + ' mm'],
      ['hloubka výbrusu', cz(O.hloubkaVybrusu(B.D / 2, B.t, B.theta), 2) + ' mm'],
      ['délka fazety', cz(O.delkaFazety(B.t, B.theta), 1) + ' mm'],
    ] : [['nastavení', 'mimo rozsah', 'hl']]);
    $('tabBrusky').innerHTML = '<thead><tr><th>Ø kotouče</th><th>β pro ' + cz(B.theta, 1) + '°</th><th>úhel při stejném β</th><th>hloubka</th></tr></thead><tbody>' +
      B.tabulka.map((r) => `<tr><td>${cz(r.D, 0)}</td><td>${cz(r.beta, 1)}°</td><td>${cz(r.pevneTheta, 1)}°</td><td>${cz(r.hloubka, 2)}</td></tr>`).join('') + '</tbody>' +
      '<thead><tr><th>úhel</th><th>β</th><th>čep od osy</th><th></th></tr></thead><tbody>' + B.uhlyTab.map((r) => `<tr><td>${r.uhel}°</td><td>${cz(r.beta, 1)}°</td><td>${cz(r.hx, 1)}</td><td></td></tr>`).join('') + '</tbody>';
    $('popisBrusky').textContent = `Ø${cz(B.D, 0)} mm, čep ${cz(B.hz, 0)} mm nad osou`;
    $('varovaniBrusky').innerHTML = B.varovani.map((x) => `<li>${esc(x)}</li>`).join('') + '<li>Opotřebený kotouč při stejném sklonu opěrky brousí jiný úhel – po orovnání kotouče sklon přepočítejte.</li>';
  }
  function vykresliHoblik() {
    const f = Math.max(O.cislo(S.uhly.primarni, 25), O.cislo(S.uhly.mikro, 25)), H = S.hoblik;
    const sc = V.scenaHobliku(O.cislo(H.loze, 45), f, H.orientace, O.cislo(H.zadni, 0));
    svgDo('nahledHobliku', sc.prvky);
    vysl('vysledkyHobliku', [['úhel řezu', cz(sc.h.rez, 1) + '°', 'hl'], ['vůle (clearance)', cz(sc.h.vule, 1) + '°'], ['lože', cz(H.loze, 1) + '°'], ['fazeta na ostří (mikro)', cz(f, 1) + '°']]);
    $('varovaniHobliku').innerHTML = sc.h.varovani.map((x) => `<li>${esc(x)}</li>`).join('');
  }
  function infa() {
    const p = O.POUZITI[S.pouziti];
    const d = O.doporuceneUhly(S.pouziti, S.drevo, S.ocel);
    $('infoPouziti').innerHTML = `${esc(p ? p.pozn : '')} <b>Typicky ${cz(d.primarni, 1)}° + ${cz(d.mikro, 1)}°</b> pro zvolené dřevo a ocel (orientační, upravte podle zkušenosti).${p && p.oboustranne ? ' Úhel je na jednu stranu.' : ''}`;
    const g0 = O.modelVoziku(Object.assign({}, S, { vozik: Object.assign({}, S.vozik, { kalibrace: false }) }), v);
    const Hk = O.kalibrujH(O.cislo(S.vozik.kalL, 40), O.cislo(S.vozik.kalUhel, 30), g0);
    $('infoKal').innerHTML = `Návrhová výška lože ${cz(v.H, 2)} mm, z měření vychází <b>${cz(Hk, 2)} mm</b> (rozdíl ${cz(Hk - v.H, 2)} mm).${Math.abs(Hk - v.H) > 2 ? ' Velký rozdíl – zkontrolujte měření a průměr válečku.' : ''}`;
    $('infoKamen').textContent = S.kamen.rezim === 'sklo' ? 'Plavené sklo 6–10 mm, papír za mokra přeložený přes čela skla. Držák sklo sevře šroubem s destičkou.' : 'Vodní kámen namočte podle výrobce; rovnejte ho po každém ostření.';
    $('infoPravitko').textContent = `Trik s pravítkem: zadní fazeta ${cz(O.pravitkovyTrik(O.cislo(S.hoblik.pravitko, 0.5), O.cislo(S.hoblik.pravitkoVzd, 50)), 2)}° (pravítko ${cz(S.hoblik.pravitko, 1)} mm, ${cz(S.hoblik.pravitkoVzd, 0)} mm od ostří).`;
    const C = O.camber(S);
    $('infoCamber').textContent = `Poloměr zakulacení ${cz(C.Rc, 0)} mm na šířce ${cz(C.W, 0)} mm. ${C.varovani.join(' ')}`;
  }

  /* ---------- soubory ---------- */
  function stahni(obsah, nazev, typ) {
    const blob = obsah instanceof Blob ? obsah : new Blob([obsah], { type: typ || 'application/octet-stream' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const zaklad = () => String(S.nazev || 'ostreni').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'ostreni';
  const nazevSouboru = (pripona, x) => `${zaklad()}${x ? '_' + x : ''}.${pripona}`;
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
  function dataPdf(jenSablony) {
    const sab = new Set([15, 20, 25, 30, 35, 40, O.cislo(S.uhly.primarni, 25), O.cislo(S.uhly.mikro, 30), ...O.seznamUhlu(S.uhly.seznam)]);
    const d = { nazev: S.nazev || 'Ostření – přípravky', sablony: [...sab].sort((a, b) => a - b).slice(0, 10), camber: O.camber(S) };
    if (jenSablony) return d;
    d.g = g; d.tabulka = O.tabulkaVylozeni(g, uhlyTabulky(), O.cislo(S.uhly.primarni, 25));
    d.dily = [];
    for (const p of O.PRIPRAVKY) { const X = O.pripravek(S, p.id, v); for (const dl of X.dily) d.dily.push({ dil: dl, kusovnik: (X.kusovnik || []).filter((q) => q.ks > 0) }); }
    d.bruska = O.opera(S);
    return d;
  }
  async function pdfStahnout(jen) {
    const b = jen ? $('btnPdfSablony') : $('btnPdf'), puv = b.textContent; b.disabled = true; b.textContent = 'Připravuji PDF…';
    try {
      const pismo = await nactiPismo();
      if (!pismo) toast('Písmo se nepodařilo načíst – PDF bude bez diakritiky.');
      if (!window.jspdf) throw new Error('knihovna jsPDF se nenačetla');
      const st = V.strany(S, dataPdf(jen));
      const doc = V.pdf(window.jspdf.jsPDF, st, { pismo, nazev: S.nazev || 'Ostření – přípravky' });
      stahni(doc.output('blob'), nazevSouboru('pdf', jen ? 'sablony' : ''));
    } catch (e) { console.error(e); toast('Chyba PDF: ' + e.message, true); }
    finally { b.disabled = false; b.textContent = puv; }
  }
  $('btnPdf').addEventListener('click', () => pdfStahnout(false));
  $('btnPdfSablony').addEventListener('click', () => pdfStahnout(true));
  $('btnSvg').addEventListener('click', () => { const d = dil(); stahni(V.svg(V.vykresDilu(d).prvky, { okraj: 5 }), nazevSouboru('svg', d.id), 'image/svg+xml'); });
  $('btnDxf').addEventListener('click', () => { const d = dil(); stahni(V.dxf(V.vykresDilu(d).prvky), nazevSouboru('dxf', d.id), 'application/dxf'); });

  /* ---------- STL (manifold se načte až na vyžádání) ---------- */
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
  async function sPrubehem(id, text, fn) {
    const b = $(id), puv = b.textContent; b.disabled = true; b.textContent = text;
    try { await new Promise((r) => setTimeout(r, 20)); return await fn(); } catch (e) { console.error(e); toast('Chyba STL: ' + e.message, true); return null; }
    finally { b.disabled = false; b.textContent = puv; }
  }
  const stlDilu = async (d) => { const w = await nactiManifold(); return ST.sitDilu(w, d, true); };
  $('btnStl').addEventListener('click', () => sPrubehem('btnStl', 'Počítám STL…', async () => {
    const d = dil(), m = await stlDilu(d);
    stahni(new Blob([ST.stlBinarni(m.poz, m.idx, d.nazev)], { type: 'model/stl' }), nazevSouboru('stl', pripravekId + '_' + d.id));
    toast(`${d.nazev}: ${cz(m.rozmer[0], 1)} × ${cz(m.rozmer[1], 1)} × ${cz(m.rozmer[2], 1)} mm, objem ${cz(m.objem / 1000, 1)} cm³ (uzavřené těleso, tisková poloha).`);
  }));
  $('btnStlVse').addEventListener('click', () => sPrubehem('btnStlVse', 'Počítám STL…', async () => {
    for (const d of J.dily) {
      const m = await stlDilu(d);
      stahni(new Blob([ST.stlBinarni(m.poz, m.idx, d.nazev)], { type: 'model/stl' }), nazevSouboru('stl', pripravekId + '_' + d.id));
      await new Promise((r) => setTimeout(r, 350));
    }
    toast(`Staženo ${J.dily.length} STL (${J.dily.map((d) => d.nazev).join(', ')}).`);
  }));
  $('btnStl3d').addEventListener('click', () => sPrubehem('btnStl3d', 'Počítám…', async () => {
    const w = await nactiManifold(), d = dil(), sit = ST.sitDilu(w, d, true);
    rezim3d = 'dil'; sit3d = sit; aktualizuj3d();
    $('obal3d').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));

  /* ---------- 3D ---------- */
  let pohled3d = null, nacita3d = false, rezim3d = 'vozik', sit3d = null, tah = false, t3d = 0;
  function aktualizuj3d() {
    if (!pohled3d) return;
    clearTimeout(t3d);
    t3d = setTimeout(() => {
      if (rezim3d === 'dil' && sit3d) { pohled3d.aktualizuj({ rezim: 'dil', data: { sit: sit3d } }); $('stav3d').textContent = 'Díl v tiskové poloze: ' + sit3d.nazev; return; }
      const th = O.uhelZVylozeni(S.vylozeni, g);
      if (!isFinite(th)) return;
      pohled3d.aktualizuj({ rezim: 'vozik', data: { v, theta: th, L: S.vylozeni, nuz: { sirka: O.cislo(S.nuz.sirka, 50), tloustka: g.t }, kamen: { delka: O.cislo(S.kamen.delka, 200), sirka: O.cislo(S.kamen.sirka, 65), vyska: O.cislo(S.kamen.vyska, 25), rezim: S.kamen.rezim }, s: v.s } });
      pohled3d.animace(tah);
      $('stav3d').textContent = '';
    }, 60);
  }
  function nacti3d() {
    if (pohled3d || nacita3d) return;
    nacita3d = true;
    const hotovo = () => { try { pohled3d = OSTR3D.vytvor($('obal3d')); $('stav3d').textContent = ''; aktualizuj3d(); } catch (e) { $('stav3d').textContent = '3D se nepodařilo spustit: ' + e.message; } };
    if (window.THREE) { hotovo(); return; }
    nactiSkript('lib/three.0.160.0.min.js').then(hotovo).catch((e) => { nacita3d = false; $('stav3d').textContent = 'three.js se nenačetl: ' + e.message; });
  }
  new IntersectionObserver((z) => { if (z.some((x) => x.isIntersecting)) nacti3d(); }, { rootMargin: '200px' }).observe($('obal3d'));
  $('b3dVozik').addEventListener('click', () => { rezim3d = 'vozik'; aktualizuj3d(); });
  $('b3dTah').addEventListener('click', () => { tah = !tah; $('b3dTah').setAttribute('aria-pressed', String(tah)); $('b3dTah').textContent = tah ? '⏸ Zastavit tah' : '▶ Tah po kameni'; if (rezim3d !== 'vozik') { rezim3d = 'vozik'; aktualizuj3d(); } else if (pohled3d) pohled3d.animace(tah); });
  $('b3dVychozi').addEventListener('click', () => pohled3d && pohled3d.pohled(28, 22));
  $('b3dBok').addEventListener('click', () => pohled3d && pohled3d.pohled(0, 2));
  $('b3dShora').addEventListener('click', () => pohled3d && pohled3d.pohled(0, 89));

  /* ---------- projekty ---------- */
  function vykresliProjekty() {
    const P = projekty(), jm = Object.keys(P).sort((a, b) => a.localeCompare(b, 'cs'));
    $('seznamProjektu').innerHTML = jm.length ? jm.map((j) => `<option value="${esc(j)}">${esc(j)}</option>`).join('') : '<option value="">– zatím nic –</option>';
  }
  $('btnUlozit').addEventListener('click', async () => {
    let jm = (S.nazev || '').trim();
    if (!jm) { jm = await Dialog.zeptej('Název projektu', (O.POUZITI[S.pouziti] || {}).nazev || 'Ostření'); if (!jm) return; jm = jm.trim(); S.nazev = jm; $('nazevProjektu').value = jm; }
    const P = projekty();
    if (P[jm] && !(await Dialog.potvrd(`Projekt „${jm}“ už existuje. Přepsat?`))) return;
    P[jm] = JSON.parse(JSON.stringify(S)); P[jm].ulozeno = new Date().toISOString();
    if (ulozProjekty(P)) { vykresliProjekty(); $('seznamProjektu').value = jm; toast('Projekt uložen.'); }
    uloz();
  });
  function nactiProjekt(u) { S = O.slouc(O.vychoziProjekt(), JSON.parse(JSON.stringify(u))); doFormulare(); prepocti(); }
  $('btnNacist').addEventListener('click', () => { const j = $('seznamProjektu').value, P = projekty(); if (!P[j]) return; nactiProjekt(P[j]); toast('Načteno: ' + j); });
  $('btnSmazat').addEventListener('click', async () => {
    const j = $('seznamProjektu').value, P = projekty(); if (!P[j]) return;
    if (!(await Dialog.potvrd(`Smazat projekt „${j}“?`))) return;
    delete P[j]; ulozProjekty(P); vykresliProjekty();
  });
  $('btnExport').addEventListener('click', () => {
    const data = Object.assign({ aplikace: 'ostreni', exportovano: new Date().toISOString() }, JSON.parse(JSON.stringify(S)));
    stahni(JSON.stringify(data, null, 1), nazevSouboru('json'), 'application/json');
  });
  $('btnImport').addEventListener('click', () => $('souborProjekt').click());
  $('souborProjekt').addEventListener('change', async () => {
    const f = $('souborProjekt').files[0]; $('souborProjekt').value = '';
    if (!f) return;
    try {
      const u = JSON.parse(await f.text());
      if (!u || typeof u !== 'object' || !u.vozik || !u.uhly) throw new Error('soubor není projekt ostření');
      nactiProjekt(u); toast('Projekt importován.');
    } catch (e) { toast('Import se nepodařil: ' + e.message, true); }
  });
  $('btnReset').addEventListener('click', async () => {
    if (!(await Dialog.potvrd('Vrátit všechny parametry na výchozí hodnoty? (Uložené projekty zůstanou.)'))) return;
    S = O.vychoziProjekt(); doFormulare(); prepocti();
  });

  /* ---------- záložky ---------- */
  $('zalozky').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-z]'); if (!b) return;
    for (const x of $('zalozky').children) x.setAttribute('aria-selected', String(x === b));
    for (const p of document.querySelectorAll('.panel')) p.hidden = p.dataset.p !== b.dataset.z;
  });
  $('princip').innerHTML = PR.princip(); $('postup').innerHTML = PR.postup(); $('bezpecnost').innerHTML = PR.bezpecnost(O); $('zrnitosti').innerHTML = PR.zrnitosti(O);

  /* ---------- start ---------- */
  doFormulare(); vykresliVyber(); vykresliProjekty(); prepocti();
  window.OSTRApp = { get stav() { return S; }, get vozik() { return v; }, get model() { return g; }, get pripravek() { return J; }, prepocti, vyberPripravek, nactiManifold, stlDilu, dataPdf, get pohled3d() { return pohled3d; } };
})();
