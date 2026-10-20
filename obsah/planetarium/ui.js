/* ============================================================
   Planetárium – uživatelské rozhraní
   ============================================================ */
(function () {
  'use strict';
  const P = window.PLAN, SIT = window.PLANSit, V = window.PLANVystup, KR = window.PLANKresba, EK = window.EvolKola;
  const $ = (id) => document.getElementById(id);
  const KLIC = 'webapp_planetarium';
  const f = (x, d) => P.fmt(x, d == null ? 1 : d);
  const toast = (t, ch) => (window.Dialog ? (ch ? Dialog.chyba(t) : Dialog.info(t)) : console.log(t));
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const MODULY = [0.5, 0.6, 0.7, 0.8, 1, 1.25, 1.5, 2, 2.5, 3];

  const POLE = ['m', 'b', 'mezera', 'zMin', 'zMax', 'D', 'zemeTyp', 'zC', 'dRemenice', 'dStred', 'dHridel', 'tlRamene', 'vuleOtvor', 'vuleZub', 'zK', 'zA',
    'mesicStupne', 'mesicR', 'globus', 'mesicD', 'lampa'];
  const ZASKRT = ['mesic', 'naklon', 'uzly', 'den', 'planety'];
  const VYCH = () => ({
    p: Object.assign({}, P.VYCHOZI, { mesicKola: null, uzlyKola: null, denKola: null }),
    tisk: { papir: 'a4', okraj: 10, prekryv: 10, papirW: 210, papirH: 297, sirkaDesky: 300, sirkaStolu: 220 },
    sim: { jd: null, rezim: 'model', rychlost: 30 },
    hl: { volba: 'mesic', cil: P.CILE.mesicSyn, stupne: 2, razeni: 'chyba', souose: false },
  });
  let S = VYCH();
  try {
    const u = JSON.parse(localStorage.getItem(KLIC) || 'null');
    if (u && u.p) { S.p = Object.assign(S.p, u.p); S.tisk = Object.assign(S.tisk, u.tisk || {}); S.sim = Object.assign(S.sim, u.sim || {}); S.hl = Object.assign(S.hl, u.hl || {}); }
  } catch (e) { /* nic */ }
  let ulozT = 0;
  const uloz = () => { clearTimeout(ulozT); ulozT = setTimeout(() => { try { localStorage.setItem(KLIC, JSON.stringify({ p: S.p, tisk: S.tisk, sim: S.sim, hl: S.hl })); } catch (e) { /* plné */ } }, 300); };

  const PRESETY = [
    { id: 'mesic', nazev: 'Měsíc – novoluní za rok (soukolí na rameni)', cil: P.CILE.mesicSyn, stupne: 2, vlak: 'mesic' },
    { id: 'mesicAbs', nazev: 'Měsíc – oběhy vůči hvězdám za rok (pohon z podstavce)', cil: P.CILE.mesicAbs, stupne: 2 },
    { id: 'uzly', nazev: 'Uzly – soukolí na rameni (1 + 1/18,61)', cil: 1 - P.CILE.uzly, stupne: 2, vlak: 'uzly' },
    { id: 'den', nazev: 'Rotace Země – soukolí na rameni (365,2422)', cil: P.CILE.den - 1, stupne: 3, vlak: 'den' },
    { id: 'venuse', nazev: 'Venuše vůči Zemi (365,2422 / 224,701)', cil: P.CILE.venuse, stupne: 2 },
    { id: 'merkur', nazev: 'Merkur vůči Zemi (365,2422 / 87,969)', cil: P.CILE.merkur, stupne: 2 },
    { id: 'meton', nazev: 'Metonův cyklus – 235 lunací za 19 let', cil: 235 / 19, stupne: 2 },
    { id: 'vlastni', nazev: 'vlastní poměr…', cil: null, stupne: 2 },
  ];

  /* ---------- naplnění ovládacích prvků ---------- */
  $('m').innerHTML = MODULY.map((m) => `<option value="${m}">${f(m, m < 1 ? 2 : m % 1 ? 2 : 0)}</option>`).join('');
  $('hCilVolba').innerHTML = PRESETY.map((q) => `<option value="${q.id}">${q.nazev}</option>`).join('');
  function doFormulare() {
    for (const k of POLE) { const el = $(k); if (el) el.value = S.p[k]; }
    for (const k of ZASKRT) $(k).checked = !!S.p[k];
    for (const k of ['papir', 'okraj', 'prekryv', 'papirW', 'papirH', 'sirkaDesky', 'sirkaStolu']) $(k).value = S.tisk[k];
    $('hCilVolba').value = S.hl.volba; $('hCil').value = S.hl.cil; $('hStupne').value = S.hl.stupne; $('hRazeni').value = S.hl.razeni; $('hSouose').checked = !!S.hl.souose;
    $('simRychlost').value = String(S.sim.rychlost);
    viditelnost();
  }
  function viditelnost() {
    const rem = S.p.zemeTyp === 'remen';
    $('blokZC').classList.toggle('skryte', rem); $('blokRem').classList.toggle('skryte', !rem);
    $('blokPapir').classList.toggle('skryte', S.tisk.papir !== 'vlastni');
    for (const k of ['naklon', 'mesicStupne', 'mesicR', 'mesicD']) $(k).disabled = !S.p.mesic;
    $('uzly').disabled = !S.p.mesic || !S.p.naklon;
  }

  /* ---------- výpočet ---------- */
  let M = null, sc3d = null, vybraneKolo = null;
  let prepT = 0;
  function prepocitejPozdeji() { clearTimeout(prepT); prepT = setTimeout(prepocitej, 220); }
  function prepocitej() {
    try { M = P.navrh(S.p); } catch (e) { console.error(e); toast('Návrh selhal: ' + e.message, true); return; }
    if (S.sim.jd == null) S.sim.jd = P.jdZData(new Date());
    vykresli();
    if (sc3d) sc3d.postav(M);
    aktualizujSim();
    uloz();
  }

  function infoVlaku() {
    const v = M.vystupy, out = [];
    const radek = (nazev, o, cilTxt, chybaTxt, id) => {
      const st = M.vlaky.find((x) => x.id === id);
      const kola = st ? st.stupne.map(([a, b]) => `${a}/${b}`).join(' · ') + (st.rozvrh && st.rozvrh.mezi.length ? ` + mezikol${st.rozvrh.mezi.length > 1 ? 'a' : 'o'} z${st.rozvrh.mezi.join(', z')}` : '') : '';
      const vlastni = S.p[id + 'Kola'] ? ' <button class="btn btn-sec" style="padding:1px 6px;font-size:.72rem" data-auto="' + id + '" type="button">↺ auto</button>' : '';
      out.push(`<div><b>${nazev}</b>: ${kola}${vlastni}<br>${f(o.abs, 6)} ot./rok (cíl ${cilTxt}) · ${chybaTxt}</div>`);
    };
    if (v.mesic) radek('Měsíc', v.mesic, f(P.CILE.mesicAbs, 6), `fáze se rozejde o 1 den za <b>${f(v.mesic.denZaRoku, 0)} let</b>`, 'mesic');
    if (v.uzly) radek('Uzly', v.uzly, f(P.CILE.uzly, 6), `chyba ${f(v.uzly.stupnuZaRok, 4)}°/rok · 1 den za ${f(v.uzly.denZaRoku, 0)} let`, 'uzly');
    if (v.den) radek('Rotace Země', v.den, f(P.CILE.den, 4), `1 den za ${f(v.den.denZaRoku, 0)} let`, 'den');
    for (const pl of M.planety) out.push(`<div><b>${pl.nazev}</b>: z${pl.zK} → z${pl.z} (souosé ${pl.souose ? '✓' : '✗'}), ${f(pl.pomer, 5)}× rychleji než Země (cíl ${f(pl.cil, 5)}, chyba ${f(pl.chyba * 100, 3)} %)</div>`);
    $('infoVlaky').innerHTML = out.join('');
    $('infoVlaky').querySelectorAll('[data-auto]').forEach((b) => b.addEventListener('click', () => { S.p[b.dataset.auto + 'Kola'] = null; prepocitej(); }));
  }

  function vykresli() {
    const p = M.p;
    const chyb = M.chyby.map((t) => `<div class="chyba">✗ ${esc(t)}</div>`).join('');
    const var_ = M.varovani.filter((t, i, a) => a.indexOf(t) === i).map((t) => `<div class="varovani">⚠ ${esc(t)}</div>`).join('');
    $('infoMech').innerHTML = `Rameno <b>D = ${f(M.D, 1)} mm</b> · deska ${f(M.rameno.delka, 0)} × ${f(M.rameno.sirka, 0)} mm · ${M.vrstev} ${M.vrstev < 5 ? 'vrstvy' : 'vrstev'} kol · výška glóbu ${f(M.Hg, 0)} mm nad ramenem · ${M.kola.length + 2 + M.planety.length * 2} kol celkem.<br>1 otáčka kliky = <b>${f(M.pohon.dnuNaOtacku, 2)} dne</b>; rok = ${f(M.pohon.otacekZaRok, 2)} otáček.` + chyb + var_;
    infoVlaku();
    $('vykPudorys').innerHTML = KR.pudorys(M, { vybrane: vybraneKolo });
    $('vykBok').innerHTML = KR.bok(M);
    $('vykSchema').innerHTML = KR.schema(M);
    $('legenda').innerHTML = M.vlaky.map((v) => `<span><i style="background:${KR.BARVY[v.id]}"></i>${esc(v.nazev)}</span>`).join('');
    // kusovník
    let t = '<tr><th>Poz.</th><th class="l">Název</th><th>z</th><th>Ø rozteč.</th><th>Ø hlav.</th><th>otvor</th><th>vrstva</th><th>osa</th><th>ot./rok</th><th class="l">uchycení / rozměr / poznámka</th></tr>';
    for (const k of M.kusovnik) t += `<tr class="${k.z ? 'vyber' : ''}${k.poz === vybraneKolo ? ' aktivni' : ''}" data-poz="${k.poz}"><td>${k.poz}</td><td class="l">${esc(k.nazev)}${k.ks > 1 ? ` (${k.ks} ks)` : ''}</td><td>${k.z || ''}</td><td>${k.d ? f(k.d, 2) : ''}</td><td>${k.da ? f(k.da, 2) : ''}</td><td>${k.otvor ? f(k.otvor, 2) : ''}</td><td>${k.vrstva || ''}</td><td>${k.osa || ''}</td><td>${k.otacekRok != null ? f(k.otacekRok, 4) : ''}</td><td class="l">${esc([k.uchyceni, k.rozmer, k.poznamka].filter(Boolean).join(' · '))}</td></tr>`;
    $('tabKusovnik').innerHTML = t;
    $('tabKusovnik').querySelectorAll('tr.vyber').forEach((tr) => tr.addEventListener('click', () => vyberKolo(tr.dataset.poz)));
    // kontroly
    const ok = M.kontroly.every((k) => k.ok);
    let k = `<div class="${ok ? 'ok' : 'chyba'}"><b>${ok ? '✓ Všechny rozteče sedí' : '✗ Rozteče nesedí'}</b> (vzdálenost os = (z₁+z₂)·m/2 s přesností 10⁻⁶ mm).</div>`;
    k += `<div class="${M.kolize.length ? 'chyba' : 'ok'}"><b>${M.kolize.length ? '✗ ' + M.kolize.length + ' kolizí' : '✓ Bez kolizí'}</b>: kola v téže vrstvě se nedotýkají hlavovými kružnicemi a žádné kolo nezasahuje do cizí hřídele (vůle ${f(p.vuleKolize, 1)} mm).</div>`;
    k += `<div class="${Math.abs(M.vystupy.zeme ? M.vystupy.zeme.abs : 0) < 1e-12 ? 'ok' : 'chyba'}"><b>✓ Osa Země</b>: nosič glóbu se za rok otočí ${f(M.vystupy.zeme ? M.vystupy.zeme.abs : 0, 9)}× vůči podstavci (musí být 0).</div>`;
    k += '<ul style="margin:6px 0 0 18px">' + M.kontroly.map((q) => `<li class="${q.ok ? '' : 'chyba'}">${q.ok ? '✓' : '✗'} ${esc(q.text)}</li>`).join('') + '</ul>';
    k += M.chyby.map((t2) => `<div class="chyba">✗ ${esc(t2)}</div>`).join('') + M.varovani.map((t2) => `<div class="varovani">⚠ ${esc(t2)}</div>`).join('');
    $('kontroly').innerHTML = k;
    let o = '<tr><th>Osa</th><th class="l">Popis</th><th>x (mm)</th><th>y (mm)</th><th>od O (mm)</th><th class="l">kola (vrstva)</th></tr>';
    for (const h of M.hridele) o += `<tr><td>${h.id}</td><td class="l">${esc(h.nazev)}</td><td>${f(h.x, 2)}</td><td>${f(h.y, 2)}</td><td>${f(Math.hypot(h.x, h.y), 2)}</td><td class="l">${M.kola.filter((g) => g.hr === h).map((g) => (g.remenice ? 'Ø' + f(g.d, 0) : 'z' + g.z) + ' (' + (g.vrstva + 1) + ')').join(', ')}</td></tr>`;
    $('tabOsy').innerHTML = o;
    // rozcházení
    const v = M.vystupy;
    let r = '<tr><th>Po letech</th>' + (v.mesic ? '<th>fáze Měsíce</th>' : '') + (v.uzly ? '<th>uzly</th>' : '') + (v.den ? '<th>rotace Země</th>' : '') + M.planety.map((pl) => `<th>${pl.nazev}</th>`).join('') + '</tr>';
    for (const roky of [1, 5, 10, 19, 50, 100, 500, 1000]) {
      r += `<tr><td>${roky}</td>`;
      if (v.mesic) { const dd = v.mesic.delta * roky * P.K.SYN; r += `<td>${Math.abs(dd) < 1 ? f(dd * 24, 2) + ' h' : f(dd, 2) + ' d'}</td>`; }
      if (v.uzly) r += `<td>${f(v.uzly.delta * roky * 360, 3)}°</td>`;
      if (v.den) { const dd = v.den.delta * roky * P.K.DEN_SID * 1440; r += `<td>${Math.abs(dd) < 120 ? f(dd, 1) + ' min' : f(dd / 1440, 2) + ' d'}</td>`; }
      for (const pl of M.planety) r += `<td>${f(pl.chyba * pl.cil * roky * 360, 1)}°</td>`;
      r += '</tr>';
    }
    $('tabRozch').innerHTML = r;
    $('rozchazeni').innerHTML = `Model je seřízený k <b>${P.dataZJd(p.jd0).toLocaleDateString('cs-CZ')}</b>. Rameno je kalendář (1 otáčka = tropický rok), ostatní pohyby určují převody. Tabulka ukazuje, o kolik se model rozejde se <b>středním</b> pohybem (kladné = model předbíhá).` +
      (v.mesic ? ` Měsíc: ${f(v.mesic.abs, 7)} oběhu za rok místo ${f(P.CILE.mesicAbs, 7)}, rozdíl ${f(v.mesic.delta * 1e6, 2)} × 10⁻⁶ oběhu/rok.` : '') +
      ' Skutečný Měsíc navíc kolem středního pohybu kolísá až o ±14 h (eliptická dráha, rušení od Slunce). Tuto odchylku žádný kruhový převod nenapodobí. Při přehrávání ji vidíte v řádku „skutečnost“.';
    $('princip').innerHTML = window.PLANPrincip.html(M);
    $('navod').innerHTML = navodHtml();
    // STL výběr
    const dily = SIT.dilyStl(M);
    const sel = $('stlDil'), pred = sel.value;
    sel.innerHTML = dily.map((d) => `<option value="${d.id}">${esc(d.nazev)}</option>`).join('');
    if (dily.some((d) => d.id === pred)) sel.value = pred;
    $('infoExport').innerHTML = `${dily.length} dílů k tisku. Otvory kol: vůle +${f(p.vuleOtvor, 2)} mm, zuby ztenčené o ${f(p.vuleZub, 2)} mm (boční vůle). Na laser jdou kola a rameno z desky tl. ${f(p.b, 1)} / ${f(p.tlRamene, 1)} mm. SVG/DXF: červeně řez, modře gravírování.`;
  }

  /* ---------- montážní návod ---------- */
  function navodRadky() {
    const p = M.p, R = [], naE = M.trubky;
    const pevna = M.kola.filter((g) => g.hr.id === 'O').sort((a, b) => a.vrstva - b.vrstva);
    R.push('# 1. Tisk a kontrola');
    R.push('Vytiskněte PDF ve skutečné velikosti (bez „přizpůsobit stránce“) a pravítkem ověřte kontrolní čtverec 50 × 50 mm. Kola a rameno vyřízněte laserem z SVG/DXF, nebo vytiskněte z STL. U 3D tisku nejdřív zkuste jedno malé kolo na hřídeli a podle potřeby upravte vůli otvoru.');
    R.push('# 2. Rameno');
    R.push(`Deska ${f(M.rameno.delka, 0)} × ${f(M.rameno.sirka, 0)} × ${f(p.tlRamene, 1)} mm. Otvory: O (sloup) Ø${f(p.dStred + p.vuleOtvor, 2)}, E (osa Země) Ø${f(2 * (M.hridele[1].rVnejsi || 2) + p.vuleOtvor, 2)}, čepy Ø${f(p.dHridel - 0.05, 2)} (nalisovat). Souřadnice os vůči středu sloupu:`);
    for (const h of M.hridele) if (h.id !== 'O') R.push(`• ${h.id}: x = ${f(h.x, 2)} mm, y = ${f(h.y, 2)} mm (${h.nazev})`);
    R.push(`Čepy Ø${f(p.dHridel, 1)} nalisujte kolmo do ramene. Kolo ramene z${p.zA} přišroubujte zespodu soustředně s otvorem O.`);
    R.push('# 3. Centrální sloup (nehybný)');
    R.push(`Sloup Ø${f(p.dStred, 1)} pevně ukotvěte do podstavce. Rameno nasaďte na sloup (ložisko / kluzné pouzdro, pod ním axiální podložka). Nad rameno navlékněte pevná kola zdola nahoru: ${pevna.map((g) => (g.remenice ? 'řemenice Ø' + f(g.d, 0) : 'z' + g.z) + ' (vrstva ' + (g.vrstva + 1) + ', ' + f(g.z0, 1) + ' mm nad ramenem)').join(', ')}. Každé zajistěte proti otočení (lepidlo, kolík, plochá ploška na sloupu). Výšky dodržte distančními podložkami ${f(p.mezera, 1)} mm.`);
    R.push('# 4. Osa Země');
    R.push(`Na ose E jsou soustředné trubky, zevnitř: ${naE.map((t) => `${t.vlak === 'zeme' ? 'nosič osy Země' : t.vlak === 'mesic' ? 'nosič Měsíce' : t.vlak === 'uzly' ? 'kotouč uzlů' : 'hřídel dne'} Ø${f(t.dVnejsi, 1)} s kolem ${t.kolo.remenice ? 'Ø' + f(t.kolo.d, 0) : 'z' + t.kolo.z} (vrstva ${t.kolo.vrstva + 1})`).join(', ')}. Nejvnitřnější má kolo nejníž, každá další trubka je kratší a její kolo leží o vrstvu výš. Kola na trubky přilepte.`);
    R.push('# 5. Mezikola a dvojkola');
    R.push('Na čepy nasaďte mezikola a dvojkola (dvě kola slepená k sobě s podložkou, která drží mezeru vrstev). Každé kolo musí sedět ve vrstvě svého soukolí – viz boční pohled a schéma převodu. Nahoru dejte pojistný kroužek nebo kapku lepidla na konec čepu (ne na kolo).');
    if (p.zemeTyp === 'remen') R.push(`Řemínek (O-kroužek) natáhněte přes obě řemenice Ø${f(p.dRemenice, 0)}; délka středem průřezu ≈ ${f(2 * M.D + Math.PI * p.dRemenice, 0)} mm, kupte o 5–8 % kratší kvůli předpětí.`);
    R.push('# 6. Glóbus, Měsíc, lampa');
    R.push(`Na horní konec nosiče osy Země připevněte šikmý čep se sklonem ${f(p.sklon, 2)}° od svislice a nasaďte glóbus Ø${f(p.globus, 0)} mm.` + (p.mesic ? ` Rameno Měsíce (r = ${f(p.mesicR, 0)} mm) připevněte na trubku nosiče Měsíce.` + (p.naklon ? ' Tyčka Měsíce se v něm musí volně posouvat svisle a spodkem jezdí po šikmém kotouči uzlů.' : '') : '') + ` Lampu Ø${f(p.lampa, 0)} mm dejte na vrchol sloupu tak, aby její střed byl ve výšce středu glóbu (${f(M.Hg, 0)} mm nad ramenem).`);
    R.push('# 7. Seřízení k datu');
    const id = P.idealni(p.jd0);
    R.push(`Nastavte rameno na datum seřízení ${P.dataZJd(p.jd0).toLocaleDateString('cs-CZ')} podle kalendáře na podstavci. Země je na heliocentrické délce ${f(id.zeme, 1)}°, tj. na ${f(id.zeme, 1)}° od směru jarního bodu proti směru hodin při pohledu shora.`);
    R.push('Osa glóbu se musí sklánět přesně ke Slunci, když rameno ukazuje letní slunovrat (21. 6.). Před zasunutím kola nosiče do záběru natočte glóbus tímto směrem.');
    if (p.mesic) R.push(`Měsíc nastavte na elongaci ${f(id.D, 1)}° od směru ke Slunci (${P.faze(id.D).nazev}). Při novoluní stojí mezi Zemí a lampou, při úplňku za Zemí.`);
    if (p.mesic && p.naklon) R.push(`Vystupující uzel (místo, kde kotouč stoupá) natočte na ekliptikální délku ${f(id.uzel, 1)}°.`);
    R.push('# 8. Kontrola');
    R.push('Otočte klikou celý rok. Glóbus musí po celou dobu mířit osou stejným směrem (vůči místnosti), nesmí se natáčet s ramenem. Měsíc musí za rok projít 12 novoluními a o něco víc. Kola mají mít malou vůli a nikde nesmí drhnout.');
    return R;
  }
  function navodHtml() {
    let h = '', seznam = false;
    for (const r of navodRadky()) {
      if (r.startsWith('# ')) { if (seznam) { h += '</ul>'; seznam = false; } h += `<h3>${esc(r.slice(2))}</h3>`; }
      else if (r.startsWith('• ')) { if (!seznam) { h += '<ul>'; seznam = true; } h += `<li>${esc(r.slice(2))}</li>`; }
      else { if (seznam) { h += '</ul>'; seznam = false; } h += `<p>${esc(r)}</p>`; }
    }
    return h + (seznam ? '</ul>' : '');
  }

  /* ---------- výběr kola ---------- */
  function vyberKolo(poz) {
    vybraneKolo = poz;
    if (sc3d) sc3d.vyber(poz);
    $('vykPudorys').innerHTML = KR.pudorys(M, { vybrane: poz });
    $('tabKusovnik').querySelectorAll('tr').forEach((tr) => tr.classList.toggle('aktivni', tr.dataset.poz === poz));
    const g = M.kola.find((k) => k.poz === poz) || M.kusovnik.find((k) => k.poz === poz);
    const el = $('vyber3d');
    if (!g) { el.classList.add('skryte'); return; }
    const vlak = M.vlaky.find((v) => v.id === g.vlak);
    el.innerHTML = `<b>${poz}</b> ${g.remenice ? 'řemenice Ø' + f(g.d, 0) : 'z' + g.z + ', m ' + f(g.m || M.p.m, 2) + ', Ø' + f(g.d, 2)} · ${vlak ? esc(vlak.nazev) : 'pohon'}${g.vrstva != null ? ' · vrstva ' + (typeof g.vrstva === 'number' && g.hr ? g.vrstva + 1 : g.vrstva) : ''} · ${g.omegaAbs != null ? f(g.omegaAbs, 5) + ' ot./rok vůči podstavci, ' + f(g.omegaRel, 5) + ' vůči rameni' : f(g.otacekRok, 4) + ' ot./rok'}`;
    el.classList.remove('skryte');
  }

  /* ---------- simulace ---------- */
  let hraje = false, posledni = 0, klikaAnim = null;
  function aktualizujSim() {
    if (!M) return;
    const st = P.stav(M, S.sim.jd), rez = S.sim.rezim;
    const datum = P.dataZJd(S.sim.jd);
    const iso = datum.toISOString().slice(0, 10);
    if ($('simDatum').value !== iso) $('simDatum').value = iso;
    $('simPosun').value = Math.round(S.sim.jd - M.p.jd0);
    const fz = rez === 'idealni' ? st.faze.idealni : st.faze.model;
    $('ikonaFaze').innerHTML = KR.faze(fz.D, 64);
    const sk = P.skutecne(S.sim.jd), fsk = P.faze(sk.D);
    const ob = st.obdobi;
    const dl = P.delkaDne(50, ob.deklinace);
    const rows = [
      ['Datum', datum.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })],
      ['Roční období (sever)', `${ob.sever} · jih: ${ob.jih}`],
      ['Deklinace Slunce', f(ob.deklinace, 2) + '°'],
      ['Den na 50° s. š.', `${Math.floor(dl)} h ${Math.round((dl % 1) * 60)} min`],
      ['Fáze ' + (rez === 'idealni' ? '(ideál)' : '(model)'), `${fz.nazev}, ${f(fz.osvetleni * 100, 0)} %`],
      ['Stáří Měsíce', f(fz.stari, 1) + ' d'],
      ['Model − ideál', (st.faze.rozdilHod >= 0 ? '+' : '') + f(st.faze.rozdilHod, 2) + ' h'],
      ['Skutečnost (elipsa)', `${fsk.nazev}, ${f((P.norm180(sk.D - st.idealni.D)) / 360 * P.K.SYN * 24, 1)} h od ideálu`],
      ['Měsíc nad ekliptikou', f(rez === 'idealni' || !M.p.naklon ? st.betaI : st.betaM, 2) + '°' + (M.p.naklon || rez === 'idealni' ? '' : ' (model bez náklonu)')],
      ['Osa Země vůči podstavci', f(st.model.osaZeme > 180 ? st.model.osaZeme - 360 : st.model.osaZeme, 6) + '°'],
      ['Otáčky ramene od seřízení', f(st.otacky, 3)],
    ];
    if (M.planety.length) for (const q of st.planety) rows.push([q.id === 'venuse' ? 'Venuše model/ideál' : 'Merkur model/ideál', f(q.model, 1) + '° / ' + f(q.idealni, 1) + '°']);
    $('simUdaje').innerHTML = rows.map(([a, b]) => `<div><span>${a}</span><span>${b}</span></div>`).join('');
    const zm = st.zatmeniModel, zi = st.zatmeniIdeal;
    const popisZ = (z, kdo) => {
      if (z.bezSklonu) return z.uNovoluni || z.uUplnku ? `${kdo}: bez náklonu dráhy by bylo zatmění při každém ${z.uNovoluni ? 'novoluní' : 'úplňku'}.` : `${kdo}: bez náklonu dráhy (zatmění při každém novoluní/úplňku).`;
      if (z.typ) return `${kdo}: <b>${z.typ === 'slunce' ? '🌑 zatmění Slunce' : '🌕 zatmění Měsíce'}</b> – Měsíc je ${f(z.uUzlu, 1)}° od uzlu.`;
      return `${kdo}: ${z.uNovoluni ? 'novoluní' : z.uUplnku ? 'úplněk' : 'bez zatmění'}${(z.uNovoluni || z.uUplnku) ? ` daleko od uzlu (${f(z.uUzlu, 1)}°) – Měsíc projde ${(rez === 'idealni' ? st.betaI : st.betaM) > 0 ? 'nad' : 'pod'} stínem` : ''}.`;
    };
    const dalsi = P.dalsiZatmeni(S.sim.jd, 3);
    $('simZatm').innerHTML = popisZ(zm, 'Model') + '<br>' + popisZ(zi, 'Ideál') + '<br><span style="color:var(--text-faint)">Nejbližší skutečná zatmění: ' + dalsi.map((z) => `${P.dataZJd(z.jd).toLocaleDateString('cs-CZ')} ${z.typ === 'slunce' ? 'Slunce' : 'Měsíce'} (${z.druh})`).join(' · ') + '</span>';
    $('simZatm').classList.toggle('aktivni', !!(zm.typ || zi.typ));
    if (sc3d) sc3d.aktualizuj(st, rez);
  }
  function smycka(t) {
    if (!hraje && !klikaAnim) { posledni = 0; return; }
    const dt = posledni ? Math.min(0.1, (t - posledni) / 1000) : 0; posledni = t;
    if (klikaAnim) {
      const k = Math.min(1, (t - klikaAnim.t0) / 900);
      S.sim.jd = klikaAnim.od + (klikaAnim.do - klikaAnim.od) * (1 - Math.pow(1 - k, 2));
      if (k >= 1) klikaAnim = null;
    } else S.sim.jd += dt * S.sim.rychlost;
    aktualizujSim();
    requestAnimationFrame(smycka);
  }
  function hraj(stav) {
    hraje = stav == null ? !hraje : stav;
    $('simHraj').innerHTML = (hraje ? '⏸ Pozastavit' : '▶ Přehrát') + ' <kbd>mezera</kbd>';
    if (hraje) requestAnimationFrame(smycka); else uloz();
  }
  function otocKlikou() {
    const od = S.sim.jd;
    klikaAnim = { od, do: od + M.pohon.dnuNaOtacku, t0: performance.now() };
    requestAnimationFrame(smycka);
  }

  /* ---------- hledání převodů ---------- */
  function hledej() {
    const cil = +$('hCil').value, n = +$('hStupne').value;
    if (!(cil > 0)) { $('infoHledani').innerHTML = '<span class="chyba">Zadejte kladný poměr.</span>'; return; }
    $('infoHledani').textContent = 'Hledám…';
    setTimeout(() => {
      const t0 = performance.now();
      let r = P.hledejPrevody({ cil, stupne: n, zMin: S.p.zMin, zMax: S.p.zMax, pocet: 40, souose: n === 2 && $('hSouose').checked });
      const ms = performance.now() - t0;
      if (S.hl.razeni === 'velikost') r = r.filter((x) => x.zaRokDni <= Math.max(0.05, r[0] ? r[0].zaRokDni * 50 : 0)).sort((a, b) => a.soucet - b.soucet);
      const pr = PRESETY.find((q) => q.id === S.hl.volba), vlak = pr && pr.vlak;
      const aktivni = vlak && M ? (M.vlaky.find((v) => v.id === vlak) || {}).stupne : null;
      let t = '<tr><th class="l">Kola (hnací/hnané)</th><th>Poměr</th><th>Chyba</th><th>1 den za</th><th>Σz</th></tr>';
      for (const x of r.slice(0, 30)) {
        const akt = aktivni && JSON.stringify(aktivni) === JSON.stringify(x.kola);
        t += `<tr class="vyber${akt ? ' aktivni' : ''}" data-k='${JSON.stringify(x.kola)}'><td class="l">${x.kola.map(([a, b]) => `${a}/${b}`).join(' · ')}</td><td>${x.pomer.toFixed(7)}</td><td>${f(x.chyba * 1e6, 3)} ppm</td><td>${x.denZaRoku > 1e7 ? '> 10⁷ let' : f(x.denZaRoku, 0) + ' let'}</td><td>${x.soucet}</td></tr>`;
      }
      $('tabHledani').innerHTML = r.length ? t : '<tr><td>Nic nenalezeno – rozšiřte rozsah zubů.</td></tr>';
      $('infoHledani').innerHTML = `${r.length} výsledků za ${f(ms, 0)} ms (zuby ${S.p.zMin}–${S.p.zMax}). „1 den za X let“ = za kolik let se výstup rozejde o 1 den (relativní chyba × čas).` + (vlak ? ` <b>Klepnutím na řádek převod použijete v modelu</b> (${vlak === 'mesic' ? 'Měsíc' : vlak === 'uzly' ? 'uzly' : 'rotace Země'}).` : '');
      $('tabHledani').querySelectorAll('tr.vyber').forEach((tr) => tr.addEventListener('click', () => {
        if (!vlak) { toast('Tento poměr se v modelu nepoužívá – jen výpočet.'); return; }
        const kola = JSON.parse(tr.dataset.k);
        S.p[vlak + 'Kola'] = kola;
        if (vlak === 'mesic') { S.p.mesic = true; S.p.mesicStupne = kola.length; }
        if (vlak === 'uzly') { S.p.mesic = S.p.naklon = S.p.uzly = true; S.p.uzlyStupne = kola.length; }
        if (vlak === 'den') { S.p.den = true; S.p.denStupne = kola.length; }
        doFormulare(); prepocitej(); hledej();
      }));
      // řetězový zlomek
      const rz = P.retezovyZlomek(cil, 12, 1e7);
      let q = `<tr><th class="l">Sblížený zlomek</th><th>Hodnota</th><th>Chyba</th><th class="l">Kola (${n} st.)</th></tr>`;
      for (const s of rz.sblizene) {
        const kola = P.zlomekNaKola(s.p, s.q, n, S.p.zMin, S.p.zMax);
        q += `<tr><td class="l">${s.p}/${s.q}</td><td>${s.v.toFixed(7)}</td><td>${f(s.chyba * 1e6, 2)} ppm</td><td class="l">${kola ? kola.map(([a, b]) => `${a}/${b}`).join(' · ') : '–'}</td></tr>`;
      }
      $('tabRetez').innerHTML = `<caption style="caption-side:top;text-align:left;font-size:.78rem;color:var(--text-faint);padding:2px 0 6px">[${rz.cleny.join('; ')}] – členy řetězového zlomku</caption>` + q;
    }, 20);
  }

  /* ---------- export ---------- */
  function stahni(data, jmeno, typ) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: typ || 'application/octet-stream' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = jmeno;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
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
  async function exportPdf() {
    if (!window.jspdf) { toast('Knihovna jsPDF se ještě načítá, zkuste to za chvíli.', true); return; }
    if (M.chyby.length && window.Dialog && !(await Dialog.potvrd('Návrh obsahuje chyby (kolize). Přesto vytvořit PDF?'))) return;
    $('btnPdf').disabled = true;
    try {
      const pismo = await nactiPismo();
      const doc = V.pdf(M, window.jspdf.jsPDF, Object.assign({}, S.tisk, { pismo, navod: navodRadky(), datum: P.dataZJd(M.p.jd0).toLocaleDateString('cs-CZ') }));
      doc.save('planetarium.pdf');
    } catch (e) { console.error(e); toast('PDF se nepodařilo vytvořit: ' + e.message, true); }
    $('btnPdf').disabled = false;
  }
  function stl(sit, jmeno) { stahni(new Blob([EK.stlBinarni([sit], jmeno)], { type: 'model/stl' }), jmeno + '.stl'); }

  /* ---------- události ---------- */
  for (const k of POLE) $(k).addEventListener('input', () => {
    const el = $(k);
    S.p[k] = el.tagName === 'SELECT' && isNaN(+el.value) ? el.value : +el.value;
    if (['zMin', 'zMax', 'mesicStupne'].includes(k)) { S.p.mesicKola = null; S.p.uzlyKola = null; S.p.denKola = null; }
    viditelnost(); prepocitejPozdeji();
  });
  for (const k of ZASKRT) $(k).addEventListener('change', () => { S.p[k] = $(k).checked; viditelnost(); prepocitej(); });
  for (const k of ['papir', 'okraj', 'prekryv', 'papirW', 'papirH', 'sirkaDesky', 'sirkaStolu']) $(k).addEventListener('input', () => { S.tisk[k] = $(k).tagName === 'SELECT' ? $(k).value : +$(k).value; viditelnost(); uloz(); });
  $('hCilVolba').addEventListener('change', () => {
    S.hl.volba = $('hCilVolba').value;
    const pr = PRESETY.find((q) => q.id === S.hl.volba);
    if (pr.cil) { S.hl.cil = +pr.cil.toFixed(7); $('hCil').value = S.hl.cil; S.hl.stupne = pr.stupne; $('hStupne').value = pr.stupne; }
    uloz(); hledej();
  });
  $('hCil').addEventListener('input', () => { S.hl.cil = +$('hCil').value; uloz(); });
  $('hCil').addEventListener('keydown', (e) => { if (e.key === 'Enter') hledej(); });
  $('hStupne').addEventListener('change', () => { S.hl.stupne = +$('hStupne').value; uloz(); hledej(); });
  $('hRazeni').addEventListener('change', () => { S.hl.razeni = $('hRazeni').value; uloz(); hledej(); });
  $('hSouose').addEventListener('change', () => { S.hl.souose = $('hSouose').checked; uloz(); hledej(); });
  $('btnHledej').addEventListener('click', hledej);
  $('btnPdf').addEventListener('click', exportPdf);
  $('btnSvg').addEventListener('click', () => stahni(V.svg(M, { sirka: S.tisk.sirkaDesky }), 'planetarium_profily.svg', 'image/svg+xml'));
  $('btnDxf').addEventListener('click', () => stahni(V.dxf(M, { sirka: S.tisk.sirkaDesky }), 'planetarium_profily.dxf', 'application/dxf'));
  $('btnStlDil').addEventListener('click', () => { const d = SIT.dilyStl(M).find((x) => x.id === $('stlDil').value); if (d) stl(d.sit(), 'planetarium_' + d.nazev); });
  $('btnStlVse').addEventListener('click', () => {
    const site = SIT.rozlozeni(SIT.dilyStl(M), S.tisk.sirkaStolu, 4);
    stahni(new Blob([EK.stlBinarni(site, 'planetarium - vsechny dily')], { type: 'model/stl' }), 'planetarium_vsechny_dily.stl');
  });
  $('btnStlKazdy').addEventListener('click', async () => {
    const dily = SIT.dilyStl(M);
    if (window.Dialog && !(await Dialog.potvrd(`Stáhnout ${dily.length} souborů STL? Prohlížeč se může zeptat na povolení více stahování.`))) return;
    for (const d of dily) { stl(d.sit(), 'planetarium_' + d.nazev); await new Promise((r) => setTimeout(r, 350)); }
  });
  $('btnReset').addEventListener('click', async () => {
    if (window.Dialog && !(await Dialog.potvrd('Vrátit všechna nastavení na výchozí hodnoty?'))) return;
    const jd = S.sim.jd; S = VYCH(); S.sim.jd = jd; doFormulare(); prepocitej();
  });
  $('rezModel').addEventListener('click', () => nastavRezim('model'));
  $('rezIdeal').addEventListener('click', () => nastavRezim('idealni'));
  function nastavRezim(r) { S.sim.rezim = r; $('rezModel').setAttribute('aria-pressed', r === 'model'); $('rezIdeal').setAttribute('aria-pressed', r === 'idealni'); aktualizujSim(); uloz(); }
  $('simPosun').addEventListener('input', () => { S.sim.jd = M.p.jd0 + +$('simPosun').value + 0.5; aktualizujSim(); });
  $('simDatum').addEventListener('change', () => { const d = new Date($('simDatum').value + 'T12:00:00Z'); if (!isNaN(d)) { S.sim.jd = P.jdZData(d); aktualizujSim(); uloz(); } });
  $('simHraj').addEventListener('click', () => hraj());
  $('simRychlost').addEventListener('change', () => { S.sim.rychlost = +$('simRychlost').value; uloz(); });
  $('simKlika').addEventListener('click', otocKlikou);
  $('simDnes').addEventListener('click', () => { S.sim.jd = P.jdZData(new Date()); aktualizujSim(); uloz(); });
  $('simZatmeni').addEventListener('click', () => { const z = P.dalsiZatmeni(S.sim.jd + 0.6, 1)[0]; if (z) { hraj(false); S.sim.jd = z.jd; nastavRezim('idealni'); } });
  document.querySelectorAll('#zalozky button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('#zalozky button').forEach((x) => x.setAttribute('aria-selected', x === b));
    document.querySelectorAll('.panel').forEach((p) => { p.hidden = p.dataset.p !== b.dataset.z; });
  }));
  document.addEventListener('keydown', (e) => {
    const t = e.target, vePoli = t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
    if (vePoli || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Space') { e.preventDefault(); hraj(); }
    else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') { S.sim.jd += (e.code === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 30 : 1); aktualizujSim(); }
    else if (/^Digit[1-4]$/.test(e.code)) { const r = [1, 7, 30, 365][+e.code.slice(5) - 1]; S.sim.rychlost = r; $('simRychlost').value = String(r); uloz(); }
    else if (e.code === 'KeyM') nastavRezim(S.sim.rezim === 'model' ? 'idealni' : 'model');
    else if (e.code === 'KeyK') otocKlikou();
  });
  $('b3dVychozi').addEventListener('click', () => sc3d && sc3d.vychoziPohled());
  $('b3dShora').addEventListener('click', () => sc3d && sc3d.pohled(0, 89, 1));
  $('b3dBok').addEventListener('click', () => sc3d && sc3d.pohled(0, 4, 1));
  $('b3dBlizko').addEventListener('click', () => {
    if (!sc3d || !M) return;
    const st = P.stav(M, S.sim.jd);
    sc3d.pohled(st.rameno + 90 + 70, 16, 0.32, 'zeme');
  });

  /* ---------- 3D: líně, až je karta vidět ---------- */
  function spust3d() {
    if (sc3d || !window.THREE) return;
    try {
      $('stav3d').remove();
      sc3d = window.PLAN3D.vytvor($('obal3d'), { naKolo: (poz) => { if (poz) vyberKolo(poz); else { vybraneKolo = null; $('vyber3d').classList.add('skryte'); sc3d.vyber(null); } }, naKliku: otocKlikou, textura: 'textures/8k_earth_daymap.jpg' });
      sc3d.postav(M); aktualizujSim();
      window.__plan3d = sc3d;
    } catch (e) { console.error(e); const d = document.createElement('div'); d.className = 'info'; d.style.padding = '12px'; d.textContent = '3D se nepodařilo spustit (WebGL?): ' + e.message; $('obal3d').appendChild(d); }
  }
  doFormulare();
  nastavRezim(S.sim.rezim);
  prepocitej();
  hledej();
  const io = new IntersectionObserver((z) => { if (z.some((x) => x.isIntersecting)) { io.disconnect(); spust3d(); } }, { rootMargin: '200px' });
  io.observe($('karta3d'));
  window.__plan = { get M() { return M; }, S, prepocitej, aktualizujSim, hledej };
})();
