/* Krabička s víčkem na pantu – ovládání stránky nad společným zapojením gen3d/aplikace.js:
   tady jen to, co je pro krabičku zvláštní (tažení úchytů, přestavba modelu, kontrola sítí a pohybu,
   exporty po dílech a ZIP, měrka vůlí a zkušební chlopně, text na víku, odhad tisku, varianty, otevírání víka). */
/* global KRAB, KPANT, KPANT_GEO, KPANT_NAHLED, G3D, Dialog, TrubkyGui, FONTY */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = KPANT.fmt, esc = G3D.esc, box = G3D.dlazdice;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const zobrazCislo = x => (Number.isFinite(x) ? String(Math.round(x * 1e4) / 1e4).replace('.', ',') : '');
  const OSY = { x: 'vnitrni.delka', y: 'vnitrni.sirka', z: 'vnitrni.vyska' };
  const BARVY = { krabicka: '#4F86D9', viko: '#E0A63F', chlopen: '#4CAF7A', vlozka: '#A77BD6', cepPant: '#D8D8D8', cepZap: '#D8D8D8' };

  let hlaseniVstupu = [], hlaseniPrepnuti = null, wasm = null, model = null, chybaStavby = null, vysledekPohybu = null, tiskDily = null;
  const stavZobr = { tisk: false };

  /* ---------- 3D náhled ---------- */
  let nahled = null;
  try {
    nahled = KPANT_NAHLED.vytvorNahled($('platno'), {
      hodnoty: () => ({ x: app.p.vnitrni.delka, y: app.p.vnitrni.sirka, z: app.p.vnitrni.vyska }),
      priTazeni,
    });
  } catch (e) {
    $('stav3d').textContent = 'WebGL není k dispozici – náhled nejde zobrazit, generování a export fungují dál.';
    $('stav3d').classList.add('chyba');
  }
  function priTazeni(osa, h, konec) {
    app.zmen(q => G3D.poloz(q, OSY[osa], h), 'tah-' + osa);
    const el = document.querySelector(`[data-p="${OSY[osa]}"]`);
    if (el) { el.value = zobrazCislo(G3D.vezmi(app.p, OSY[osa])); el.classList.remove('spatne'); }
    if (konec) naplanuj();   // po puštění úchytu hned plná přestavba a kontrola pohybu
  }

  /* starý uložený stav (localStorage) má obal {format, projekt}; opravy vstupu se ukážou v Kontrole */
  function normalizuj(q) {
    const r = KPANT.normalizuj(q && q.format === KPANT.FORMAT && q.projekt ? q.projekt : q);
    hlaseniVstupu = r.hlaseni;
    return r;
  }
  /* Tištěný čep pod 2,5 mm je křehký: při přepnutí se zvětší čep a podle potřeby i články (stěna ≥ 1,2 mm).
     Obsluha se registruje před G3D.aplikace (formulář [data-p]) a její zastaví, aby přepnutí bylo jeden krok zpět. */
  $('f_cd').addEventListener('change', e => {
    e.stopImmediatePropagation();
    const h = e.target.value;
    hlaseniPrepnuti = null;
    app.zmen(q => { q.cep.druh = h; if (h === 'plast') prizpusobPlastu(q); });
    app.naplnFormular();
  });
  // hlášení o přizpůsobení čepu platí jen do další změny
  document.addEventListener('change', e => { if (e.target.dataset && e.target.dataset.p && e.target.id !== 'f_cd') hlaseniPrepnuti = null; }, true);
  const app = G3D.aplikace({
    typ: 'krabicka_pant', nazev: 'Krabička s víčkem', klic: 'webapp_krabicka_pant', soubor: 'krabicka', zive: true,
    normalizuj, vychozi: () => KPANT.normalizuj(KPANT.VYCHOZI).p,
    ulozProjekt: KPANT.ulozProjekt, nactiProjekt: KPANT.nactiProjekt,
    popis: q => `${q.nazev || 'Krabička'} – ${q.vnitrni.delka} × ${q.vnitrni.sirka} × ${q.vnitrni.vyska} mm`,
    viditelnost: () => viditelnost(),
    prepocitej: () => naplanuj(),
    png: () => nahled.png(), pohled: j => nahled && nahled.pohled(j),
    POHLEDY: ['iso', 'shora', 'zepredu', 'zboku', 'zespodu', 'zezadu'],
    exportStl: () => exportVse(),
    doModelare: async () => (model && await pripravExport(tiskoveDily())) ? { data: KRAB.soubor3mf(KPANT.tiskoveRozlozeni(vsechnyKusy()), app.p.nazev), pripona: '.3mf' } : null,
    zkratky: { h: 'tHrany', m: 'tTisk', p: 'tPrevisy', r: 'tRez', l: 'tPravitka', t: 'tPruhledne', u: 'tUchyty', o: 'btnOtevrit', v: 'btnVarianta', g: 'btnMerka', z: 'btnSadaChl' },
    zmenaTematu: () => barvy(),
  });
  const p = () => app.p;

  /* ---------- text na víku: opentype.js a písmo se načtou až při prvním použití ---------- */
  let textData = null, textNacita = null;            // textData = {klic, obrysy, rozmer}
  const klicTextu = () => `${p().text.pismo}|${p().text.obsah.trim()}|${p().text.velikost}`;
  const textModel = () => (textData && textData.klic === klicTextu() ? textData : null);
  async function pripravText() {
    const klic = klicTextu(), q = p();
    if (!q.text.obsah.trim()) { $('stavTextu').textContent = ''; return; }
    if (textModel() || textNacita === klic) return;
    textNacita = klic; $('stavTextu').textContent = 'Načítám písmo…';
    try {
      if (!window.opentype) await G3D.nactiSkript('lib/opentype.min.js');
      const font = await FONTY.opentype(q.text.pismo);
      const r = KPANT.textNaObrysy(font, q.text.obsah.trim(), q.text.velikost);
      textData = { klic, obrysy: r.obrysy, rozmer: r.rozmer };
    } catch (e) {
      $('stavTextu').textContent = 'Písmo se nenačetlo: ' + (e && e.message || e);
      textNacita = null; return;
    }
    textNacita = null; $('stavTextu').textContent = '';
    if (klic === klicTextu()) naplanuj();
  }
  const doplnky = () => { const tm = textModel(); return tm ? { textRozmer: tm.rozmer } : {}; };
  const kontrolyNavrhu = () => KPANT.kontroly(p(), KPANT.odvozene(p()), doplnky());
  if (typeof FONTY !== 'undefined') FONTY.seznam().then(sez => {
    const sel = $('f_tp');
    sel.innerHTML = sez.filter(f => f.pro3d !== false && (!f.pismo || f.pismo === 'latinka'))
      .map(f => `<option value="${esc(f.id)}">${esc(f.nazev)}</option>`).join('');
    sel.value = p().text.pismo;
  }).catch(() => { /* zůstane výchozí písmo */ });

  function prizpusobPlastu(q) {
    if (q.cep.prumer >= 2.5) return;
    q.cep.prumer = 3;
    const rd = q.cep.prumer / 2 + q.cep.vule, potreba = Math.ceil((2 * (rd * (q.cep.slza ? Math.SQRT2 : 1) + 1.2)) * 5) / 5;
    if (q.pant.prumer < potreba) q.pant.prumer = potreba;
    q.cep.hlavaD = Math.max(q.cep.hlavaD, q.cep.prumer + 2);
    hlaseniPrepnuti = `Pro tištěný čep zvětšen průměr čepu na 3 mm` + (q.pant.prumer === potreba ? ` a článku na ${fmt(potreba)} mm.` : '.');
  }
  function viditelnost() {
    const q = p(), zap = !!(q.zapinani.pocet || q.zapinani.boky);
    $('gZap').hidden = $('napZap').hidden = $('lChlopen').hidden = $('lTreni').hidden = $('tolZap').hidden = $('gSadaChl').hidden = !zap;
    $('btnSadaChl').disabled = !zap;
    $('gVlozka').hidden = q.prihradky.typ !== 'vlozka';
    $('gMagnety').hidden = !(q.magnety.zavirani || q.magnety.stohovani);
    $('f_prx').disabled = !!q.prihradky.pomeryDelka; $('f_pry').disabled = !!q.prihradky.pomerySirka;
    $('gOsazeni').hidden = !q.viko.osazeni;
    $('gPlast').hidden = q.cep.druh !== 'plast';
    $('gTesny').hidden = !q.cep.tesnyKonec;
  }

  /* ---------- přestavba: při tažení průběžně (nejvýš každých 60 ms), jinak 160 ms po poslední změně ---------- */
  let casovac = null, casovacPohybu = null, pohledPoStavbe = null;
  function naplanuj() {
    clearTimeout(casovacPohybu);
    if (nahled && nahled.tahne()) { if (!casovac) casovac = setTimeout(prestav, 60); }
    else { clearTimeout(casovac); casovac = setTimeout(prestav, 160); }
    souhrny();
  }
  function prestav() {
    casovac = null;
    const q = p();
    if (wasm) {
      try {
        pripravText();
        const tm = textModel();
        const r = KPANT_GEO.postav(wasm, q, { text: tm ? tm.obrysy : null });
        model = { dily: r.dily, cas: r.cas, kontroly: r.dily.map(d => KRAB.kontrolaSite(d.poz, d.idx)), odv: KPANT.odvozene(q) };
        chybaStavby = null;
      } catch (e) {
        chybaStavby = String(e && e.message || e);
        model = null;
      }
    }
    const st = $('stav3d');
    st.textContent = wasm ? (chybaStavby ? 'Model nejde sestavit: ' + chybaStavby : '') : (chybaStavby || 'Načítám geometrické jádro…');
    st.classList.toggle('chyba', !!chybaStavby);
    tiskDily = model ? KPANT.tiskoveRozlozeni(vsechnyKusy()) : null;
    zobraz(pohledPoStavbe === 'iso');
    if (model && nahled && pohledPoStavbe) { nahled.pohled(pohledPoStavbe); pohledPoStavbe = null; }
    vysledekPohybu = null;
    vypisVysledky(); vypisExport(); vypisHlaseni();
    if (model && !(nahled && nahled.tahne())) casovacPohybu = setTimeout(overPohyb, 350);
  }
  function zobraz(novyPohled) {
    if (!nahled) return;
    if (!model) { nahled.nastavDily(null); return; }
    const q = p();
    nahled.nastavDily(model.dily, model.odv, {
      x: `Délka ${fmt(q.vnitrni.delka)} mm`, y: `Šířka ${fmt(q.vnitrni.sirka)} mm`, z: `Výška ${fmt(q.vnitrni.vyska)} mm`,
    }, q.cep.druh === 'kov', { tisk: stavZobr.tisk ? tiskDily : null, uhel: 45, novyPohled });
  }
  function overPohyb() {
    if (!model || !wasm) return;
    try { vysledekPohybu = KPANT_GEO.pohyb(wasm, p()); } catch (e) { vysledekPohybu = { chyba: String(e && e.message || e) }; }
    vypisHlaseni();
  }

  function souhrny() {
    const q = p(), o = KPANT.odvozene(q), S = TrubkyGui.souhrn;
    S('sRozmery', `${fmt(o.Lo)} × ${fmt(o.Wo)} × ${fmt(o.Hb + o.tv)} mm`, true);
    $('vnejsiRozmery').textContent = `Vnější rozměry ${fmt(o.Lo, 2)} × ${fmt(o.Wo, 2)} × ${fmt(o.Hb + o.tv, 2)} mm (bez pantu a zapínání), `
      + `s pantem a chlopněmi ${fmt(o.celkem[0], 1)} × ${fmt(o.celkem[1], 1)} mm.`;
    S('sViko', `${fmt(q.viko.tloustka)} mm` + (q.viko.osazeni ? ', s osazením' : ''), true);
    S('sPant', `${q.pant.pocet}× ${fmt(o.pant.L)} mm, ${q.pant.clanku} článků` + (o.pant.zarazka ? `, zarážka ${fmt(o.pant.zarazka.uhel)}°` : ''), true);
    S('sCep', `${q.cep.druh === 'kov' ? 'kovový' : 'tištěný'} Ø ${fmt(q.cep.prumer, 2)} mm`, true);
    const z = q.zapinani;
    S('sZap', z.pocet || z.boky ? [z.pocet ? `${z.pocet}× vpředu` : '', z.boky ? `${z.boky}× na bocích` : ''].filter(Boolean).join(', ') : 'bez zapínání', !!(z.pocet || z.boky));
    // rozbor tolerance zapínání
    if (o.zap.pocet) {
      const t = KPANT.toleranceZapinani(q);
      const slovo = { ok: ['ok-t', '✓ v pořádku'], volne: ['chyba-t', '⚠ příliš volné – může vyskočit'], tesne: ['mez-t', '⚠ příliš těsné – nemusí zapadnout'] }[t.verdikt];
      $('tolZap').innerHTML = `<div class="popis">Tolerance zapínání</div><div class="cislo ${slovo[0]}">${slovo[1]}</div>`
        + `<div class="dalsi">Záběr ${fmt(t.zaber, 2)} mm, s vůlí čepů nejhůř ${fmt(t.zaberMin, 2)} mm (doporučeno ≥ 0,3) · `
        + `víko se zvedne o ${fmt(t.hra, 2)} mm, než chlopeň zabere · vůle okénka ${fmt(q.zapinani.vule, 2)} mm (doporučeno ≥ 0,15).<br>`
        + `Po tisku moc volné → doladění +0,1 až +0,2 mm; moc tuhé → vůle okénka +0,1 mm nebo doladění −0,1 mm. Mění se jen chlopeň.</div>`;
    }
    const pr = o.prihradky;
    S('sPrihradky', (pr.ma ? `${pr.pocetX} × ${pr.pocetY}` : 'nedělené') + (pr.typ === 'vlozka' ? ', vložka' : ''), pr.ma);
    $('rozmerPrihradky').textContent = pr.ma ? `Nejmenší přihrádka ${fmt(pr.sirkaX, 1)} × ${fmt(pr.sirkaY, 1)} mm, přepážky vysoké ${fmt(pr.vyska, 1)} mm.` : '';
    S('sMagnety', [q.magnety.zavirani ? 'zavírání' : '', q.magnety.stohovani ? 'stohování' : ''].filter(Boolean).join(' + ') || 'bez', q.magnety.zavirani || q.magnety.stohovani);
    const tx = q.text.obsah.trim();
    S('sText', tx ? `„${tx.slice(0, 14)}${tx.length > 14 ? '…' : ''}“` : 'bez', !!tx);
    $('sTisk').textContent = `${fmt(q.tisk.vypln, 0)} % · ${KPANT.MATERIALY[q.tisk.material].nazev}`;
  }

  /* ---------- výsledky, kusovník, odhad tisku ---------- */
  const tiskoveDily = () => model.dily.filter(d => d.tisk);
  const cas = min => (min >= 60 ? `${Math.floor(min / 60)} h ${Math.round(min % 60)} min` : `${Math.max(1, Math.round(min))} min`);
  function odhad() {
    const q = p(), suma = { g: 0, m: 0, min: 0, V: 0 };
    const radky = tiskoveDily().map(d => {
      const e = KPANT.odhadTisku(d.objem, model.kontroly[model.dily.indexOf(d)].plocha, q.tisk);
      suma.g += e.g * d.kusu; suma.m += e.m * d.kusu; suma.min += e.min * d.kusu; suma.V += d.objem * d.kusu;
      return { d, e };
    });
    return { radky, suma };
  }
  function vypisVysledky() {
    const el = $('vysledky');
    if (!model) { el.innerHTML = box('Stav', wasm ? 'Chyba stavby' : 'Načítám…', chybaStavby ? esc(chybaStavby) : '', 'chyba-t'); return; }
    const o = model.odv, q = p(), { suma } = odhad(), mat = KPANT.MATERIALY[q.tisk.material];
    let h = box('Celkové rozměry', `${fmt(o.celkem[0])} × ${fmt(o.celkem[1])} × ${fmt(o.celkem[2])}`, 'mm (X × Y × Z, zavřená sestava)');
    h += box('Objem', `${fmt(suma.V / 1000, 2)} cm³`, `${vsechnyKusy().length} tištěných kusů, plné`);
    h += box('Hmotnost', `${fmt(suma.g, 0)} g`, `${esc(mat.nazev)}, výplň ${fmt(q.tisk.vypln, 0)} %`);
    h += box('Filament', `${fmt(suma.m, 1)} m`, 'průměr 1,75 mm');
    h += box('Doba tisku', `≈ ${cas(suma.min)}`, `průtok ${fmt(q.tisk.prutok, 1)} mm³/s, hrubý odhad`);
    model.dily.forEach((d, i) => {
      if (!d.tisk) return;
      const c = model.kontroly[i], ok = c.uzavrena && c.normalyVen && c.teles === 1 && c.dutin === 0;
      h += box(`${esc(d.nazev)}${d.kusu > 1 ? ` × ${d.kusu}` : ''}`, ok ? '✓ tisknutelné' : '✗ problém',
        `${c.uzavrena ? 'uzavřená síť' : `<span class="chyba-t">otevřená síť (${c.hranOkrajovych} okr. hran)</span>`} · `
        + `${c.teles} těleso${c.teles > 1 ? ' <span class="chyba-t">(víc těles!)</span>' : ''} · otvorů ${c.rod}<br>`
        + `${c.trojuhelniku.toLocaleString('cs-CZ')} trojúhelníků · ${fmt(d.objem / 1000, 2)} cm³ ≈ ${fmt(d.objem / 1000 * 1.24, 1)} g PLA (100 % výplň)`, ok ? 'ok-t' : 'chyba-t');
    });
    h += box('Výpočet', `${model.cas} ms`, `manifold-3d, ${q.segmenty} segmentů na kružnici`);
    el.innerHTML = h;
  }
  /** Všechny kusy (chlopně a čepy zapínání tolikrát, kolik jich je) s pořadovým názvem. */
  function vsechnyKusy() {
    const out = [];
    for (const d of tiskoveDily()) for (let i = 0; i < d.kusu; i++) out.push(Object.assign({}, d, { nazev: d.kusu > 1 ? `${d.nazev} ${i + 1}` : d.nazev, barva: BARVY[d.jmeno] }));
    return out;
  }
  function vypisExport() {
    $('kusovnik').innerHTML = KPANT.kusovnik(p()).map(r => `<tr><td>${esc(r.co)}</td><td class="ks">${r.ks}</td><td>${esc(r.tisk)}</td></tr>`).join('');
    const el = $('exportDily');
    if (!model) { el.innerHTML = ''; $('odhad').innerHTML = ''; return; }
    el.innerHTML = tiskoveDily().map(d => `<button class="pol" role="menuitem" data-stl="${d.jmeno}">⬇ STL – ${esc(d.nazev)}<span class="pozn">${d.kusu > 1 ? `tisknout ${d.kusu}×` : 'jen tento díl'}</span></button>`).join('');
    const { radky, suma } = odhad();
    $('odhad').innerHTML = radky.map(({ d, e }) => `<tr><td>${esc(d.nazev)}</td><td class="ks">${d.kusu}</td><td>${fmt(e.g * d.kusu, 1)} g</td><td>${fmt(e.m * d.kusu, 2)} m</td><td>${cas(e.min * d.kusu)}</td></tr>`).join('')
      + `<tr><td><b>Celkem</b></td><td></td><td><b>${fmt(suma.g, 0)} g</b></td><td><b>${fmt(suma.m, 1)} m</b></td><td><b>${cas(suma.min)}</b></td></tr>`;
  }
  $('f_km').innerHTML = Object.entries(KPANT.MATERIALY).map(([k, m]) => `<option value="${k}">${esc(m.nazev)} (${fmt(m.hustota, 2)} g/cm³)</option>`).join('');

  /* ---------- kontroly: hlášení návrhu + pohyb; odznak sčítá obojí ---------- */
  const poleExistuje = c => !!document.querySelector(`[data-p="${c}"]`);
  const sPolem = H => H.map(h => Object.assign({}, h, { pole: (h.pole || []).filter(poleExistuje) }));
  function hlaseniPohybu() {
    const v = vysledekPohybu, q = p();
    if (!model) return [];
    if (!v) return [{ uroven: 'info', text: 'Ověřuji pohyb víka a chlopní…' }];
    if (v.chyba) return [{ uroven: 'chyba', text: 'Kontrolu pohybu nejde spočítat: ' + v.chyba }];
    const sez = [];
    const kolize = (s, co, plny, pole) => {
      if (s.max === null) return { uroven: 'chyba', text: `${co} koliduje už v zavřené poloze (průnik ${fmt(s.vzorky[0][1], 2)} mm³).`, pole };
      if (s.max >= plny) return { uroven: 'ok', text: `${co} se otevře až o ${s.max}° bez kolize.` };
      const dalsi = s.vzorky[s.vzorky.length - 1];
      return { uroven: s.max >= 90 ? 'varovani' : 'chyba', text: `${co} se otevře jen do ${s.max}°, při ${dalsi[0]}° narazí (průnik ${fmt(dalsi[1], 2)} mm³).`, pole };
    };
    if (v.viko.zarazka && v.viko.max !== null) {
      // se zarážkou má víko narazit kousek za zadaným úhlem
      const ok = v.viko.max >= v.viko.zarazka - 10;
      sez.push({ uroven: ok ? 'ok' : 'varovani', text: ok ? `Víko se otevře do ${v.viko.max}° a zastaví se o zarážku.`
        : `Víko narazí už při ${v.viko.vzorky[v.viko.vzorky.length - 1][0]}°, dřív než na zarážku (${fmt(v.viko.zarazka)}°).` });
    } else sez.push(kolize(v.viko, 'Víko', 180, ['prihradky.vyska', 'viko.vyskaOsazeni', 'pant.odstup', 'pant.prumer']));
    if (!v.chlopen) { sez.push({ uroven: 'info', text: `Bez zapínání – výpočet průniků ${v.cas} ms.` }); return sez; }
    sez.push(kolize(v.chlopen, 'Chlopeň zapínání', 120, ['zapinani.odstup', 'zapinani.dolad', 'zapinani.tloustka']));
    sez.push(v.cepVChlopni > 0.01
      ? { uroven: 'chyba', text: `Čep zapínání se v chlopni dře (průnik ${fmt(v.cepVChlopni, 2)} mm³) – zvětšete vůli.`, pole: ['cep.vule', 'zapinani.treni'] }
      : { uroven: 'ok', text: 'Čepy se v pohyblivých článcích otáčejí s vůlí.' });
    if (v.drzi) sez.push({ uroven: 'ok', text: `Zapínání drží: při pootevření víka o ${fmt(v.zdvih, 2)}° se příčka chlopně zapře o výstupek.`
      + (v.uvolneni ? ` Víko se uvolní po odklopení chlopně o ${v.uvolneni}°.` : '') });
    else sez.push({ uroven: 'chyba', text: 'Zapínání nedrží – zavřená chlopeň se při zvednutí víka o výstupek nezapře (zvětšete přesah výstupku nebo doladění záběru).',
      pole: ['zapinani.presah', 'zapinani.dolad', 'zapinani.vule'], oprava: { text: 'doladění +0,2 mm', pole: 'zapinani.dolad', hodnota: Math.min(q.zapinani.odstup - 0.1, Math.round((q.zapinani.dolad + 0.2) * 100) / 100) } });
    if (v.drzi && !v.uvolneni) sez.push({ uroven: 'varovani', text: 'Chlopeň se ani po odklopení o 45° z výstupku neuvolní.', pole: ['zapinani.presah', 'zapinani.dolad'] });
    sez.push({ uroven: 'info', text: `Výpočet průniků ${v.cas} ms (víko po 15° do 180°, chlopně po 15° do 120°).` });
    return sez;
  }
  const textOpravy = h => {
    const el = document.querySelector(`[data-p="${h.oprava.pole}"]`), l = el && document.querySelector(`label[for="${el.id}"]`);
    const x = h.oprava.hodnota;
    return `${l ? l.textContent.trim() : h.oprava.pole} → ${typeof x === 'boolean' ? (x ? 'zapnuto' : 'vypnuto') : typeof x === 'number' ? fmt(x, 2) : ({ pevne: 'pevné přepážky' }[x] || x)}`;
  };
  function vypisHlaseni() {
    const sez = [];
    if (hlaseniPrepnuti) sez.push({ uroven: 'info', text: hlaseniPrepnuti, pole: ['cep.prumer', 'pant.prumer'] });
    // „cesta: …“ na začátku opravy vstupu = pole, kterého se týká
    for (const t of hlaseniVstupu) sez.push({ uroven: 'varovani', text: 'Vstup opraven – ' + t, pole: [String(t).split(':')[0]] });
    if (model) model.kontroly.forEach((c, i) => {
      const jm = model.dily[i].nazev;
      if (!c.uzavrena) sez.push({ uroven: 'chyba', text: `${jm}: síť není uzavřená – export se nedoporučuje.` });
      if (c.teles > 1) sez.push({ uroven: 'chyba', text: `${jm}: obsahuje ${c.teles} oddělená tělesa – zkontrolujte rozměry.` });
    });
    sez.push(...kontrolyNavrhu().map(h => (h.oprava && !h.oprava.text ? Object.assign({}, h, { oprava: Object.assign({ text: textOpravy(h) }, h.oprava) }) : h)));
    const H = sPolem(sez), P = sPolem(hlaseniPohybu());
    const boxy = ['boxKrabicka', 'boxPant'];
    if (P.length) app.hlaseni(P, { ul: $('pohyb'), boxy }); else $('pohyb').innerHTML = '';
    app.hlaseni(H, { chybaStavby: chybaStavby && 'Geometrie: ' + chybaStavby, boxy });
    // odznak a vykřičníky boxů za obě kontroly dohromady (seznam mimo stránku)
    app.hlaseni(H.concat(P), { ul: document.createElement('ul'), chybaStavby: chybaStavby && 'Geometrie: ' + chybaStavby, boxy });
  }

  /* ---------- export ---------- */
  async function pripravExport(dily) {
    if (!model) { Dialog.chyba(chybaStavby ? 'Model není sestavený: ' + chybaStavby : 'Geometrické jádro se ještě načítá.'); return false; }
    const i = d => model.dily.indexOf(d);
    if (dily.some(d => !model.kontroly[i(d)].uzavrena || !model.kontroly[i(d)].normalyVen)) { Dialog.chyba('Síť neprošla kontrolou těsnosti – export zablokován.'); return false; }
    const chyby = kontrolyNavrhu().filter(h => h.uroven === 'chyba').length;
    if (chyby && !(await Dialog.potvrd(`Návrh má ${chyby} chyb v kontrolách (viz Kontrola). Přesto exportovat?`))) return false;
    return true;
  }
  const hlavicka = co => `krabicka_pant: ${app.jmeno('')}${co ? ' ' + co : ''}`;
  async function exportVse() {
    if (!model || !(await pripravExport(tiskoveDily()))) { if (!model) Dialog.chyba('Geometrické jádro se ještě načítá.'); return; }
    app.stahni(KRAB.stlBinarni(KPANT.tiskoveRozlozeni(vsechnyKusy()), hlavicka()), app.jmeno('.stl'), 'model/stl');
  }
  $('btnStl').onclick = exportVse;
  $('btn3mf').onclick = async () => {
    if (!model || !(await pripravExport(tiskoveDily()))) return;
    app.stahni(KRAB.soubor3mf(KPANT.tiskoveRozlozeni(vsechnyKusy()), app.p.nazev), app.jmeno('.3mf'), 'model/3mf');
  };
  $('btnZip').onclick = async () => {
    if (!model || !(await pripravExport(tiskoveDily()))) return;
    const zaklad = app.jmeno('');
    const polozky = tiskoveDily().map(d => ({
      name: `${zaklad}_${d.jmeno}${d.kusu > 1 ? `_${d.kusu}x` : ''}.stl`,
      data: KRAB.stlBinarni(KPANT.tiskoveRozlozeni([d]), hlavicka(d.jmeno)),
    }));
    polozky.push({ name: `${zaklad}.json`, data: KPANT.ulozProjekt(app.p) });
    app.stahni(KRAB.zip(polozky, new Date()), app.jmeno('.zip'), 'application/zip');
  };
  $('exportDily').addEventListener('click', async e => {
    const b = e.target.closest('button[data-stl]'); if (!b) return;
    const d = model && model.dily.find(x => x.jmeno === b.dataset.stl);
    if (!d || !(await pripravExport([d]))) return;
    app.stahni(KRAB.stlBinarni(KPANT.tiskoveRozlozeni([d]), hlavicka(d.jmeno)), app.jmeno(`_${d.jmeno}.stl`), 'model/stl');
  });

  /* ---------- zkušební díly (měrka vůlí, sada chlopní): okno s náhledem v tiskové poloze, stažení až odtud ---------- */
  let prohlizecZk = null, zkouska = null;            // zkouska = {dily, soubor}
  /** Otevře okno: titul, popis, hlavička a řádky tabulky (HTML), postup, díly v tiskové poloze a popisky. */
  function otevriZkousku(cfg) {
    zkouska = cfg;
    $('zkTitul').textContent = cfg.titul; $('zkPopis').textContent = cfg.popis;
    $('zkHlava').innerHTML = cfg.hlava; $('zkTabulka').innerHTML = cfg.radky; $('zkPostup').innerHTML = cfg.postup;
    if (!$('dlgZkouska').open) $('dlgZkouska').showModal();
    try {
      if (!prohlizecZk) prohlizecZk = KPANT_NAHLED.vytvorProhlizec($('zkNahled'));
      prohlizecZk.zobraz(cfg.dily, cfg.popisky);
    } catch (e) { $('zkNahled').textContent = 'Náhled není k dispozici (WebGL).'; }
  }
  $('btnZkStahnout').onclick = () => {
    if (!zkouska) return;
    app.stahni(KRAB.stlBinarni(zkouska.stl, 'krabicka_pant: ' + zkouska.soubor), app.jmeno(`_${zkouska.soubor}.stl`), 'model/stl');
    Dialog.info(`${zkouska.titul.replace(/^\S+\s/, '')} – STL uloženo.`);
  };
  $('btnZkZavrit').onclick = $('btnZkZpet').onclick = () => $('dlgZkouska').close();
  $('dlgZkouska').addEventListener('click', e => { if (e.target === $('dlgZkouska')) $('dlgZkouska').close(); });
  const pripraveno = () => { if (!wasm) { Dialog.chyba('Geometrické jádro se ještě načítá.'); return false; } return true; };

  function otevriMerku() {
    if (!pripraveno()) return;
    const q = p();
    let m;
    try { m = KPANT_GEO.merka(wasm, q); } catch (e) { Dialog.chyba('Měrku nejde sestavit: ' + (e && e.message || e)); return; }
    const { dily, otvory, rozmer } = m, d = q.cep.prumer;
    // zvýrazní se otvor s vůlí nejbližší té, která je teď nastavená
    const blizka = otvory.reduce((a, o) => (Math.abs(o.vule - q.cep.vule) < Math.abs(a.vule - q.cep.vule) ? o : a));
    otevriZkousku({
      titul: '📏 Měrka vůlí čepu', soubor: 'merka_vuli', stl: KPANT.tiskoveRozlozeni(dily),
      popis: `Hranolek ${fmt(rozmer[0], 1)} × ${fmt(rozmer[1], 1)} × ${fmt(rozmer[2], 1)} mm s ${otvory.length} otvory pro `
        + (q.cep.druh === 'plast' ? `tištěný čep Ø ${fmt(d, 2)} mm (zkušební kousek čepu je vytištěný vedle).` : `kovový čep Ø ${fmt(d, 2)} mm.`),
      hlava: '<tr><th>Rýh nahoře</th><th>Vůle (na poloměru)</th><th>Průměr otvoru</th></tr>',
      radky: otvory.map(o => `<tr${o === blizka ? ' style="font-weight:700"' : ''}><td>${o.rez}</td><td>${fmt(o.vule, 2)} mm${o === blizka ? ' (nastaveno)' : ''}</td><td>${fmt(d + 2 * o.vule, 2)} mm</td></tr>`).join(''),
      postup: '<b>Postup:</b> vytiskněte měrku stejným materiálem a nastavením jako krabičku. Zkoušejte čep od nejtěsnějšího otvoru: vyberte ten, '
        + 've kterém se čep otáčí lehce, ale nehází se, a jeho vůli zadejte do pole <b>Čep → Vůle v otvoru</b>. Otvor, kterým čep jde jen silou, '
        + 'je vhodný pro těsný koncový článek.',
      dily: dily.map(x => Object.assign({ barva: x.jmeno === 'merka' ? 0x4f86d9 : 0xd8d8d8 }, x)),
      popisky: otvory.map(o => ({ bod: [o.x, o.y, o.z + 2], text: `${o.rez}: ${fmt(o.vule, 2)}`, zvyraznit: o === blizka })),
    });
  }
  function otevriSaduChlopni() {
    if (!pripraveno()) return;
    const q = p();
    if (!KPANT.odvozene(q).zap.pocet) { Dialog.chyba('Krabička nemá zapínání – nastavte počet chlopní vpředu nebo na bocích.'); return; }
    let sada;
    try { sada = KPANT_GEO.sadaChlopni(wasm, q); } catch (e) { Dialog.chyba('Sadu nejde sestavit: ' + (e && e.message || e)); return; }
    // tisková poloha, pak vedle sebe do řady podél X (v náhledu zepředu je každá vidět)
    let x = 0;
    const stl = KPANT.tiskoveRozlozeni(sada.dily).map(d => {
      const b = KRAB.obal(d.poz), posun = KRAB.presun(d, x - b[0], -(b[1] + b[4]) / 2, 0);
      x += b[3] - b[0] + 6;
      return Object.assign({}, d, posun);
    }).map(d => Object.assign({}, d, KRAB.presun(d, -(x - 6) / 2, 0, 0)));
    const verdikt = { ok: 'v pořádku', volne: 'může vyskočit', tesne: 'nemusí zapadnout' };
    otevriZkousku({
      titul: '🧪 Sada zkušebních chlopní', soubor: 'zkusebni_chlopne', stl,
      popis: `5 chlopní ${fmt(q.zapinani.sirka)} mm od nejtužší (1 zářez v jazýčku) po nejvolnější (5 zářezů). Prostřední = současné nastavení.`
        + (q.cep.druh === 'plast' ? ' Čep zapínání použijte z hotové krabičky.' : ''),
      hlava: '<tr><th>Zářezů</th><th>Vůle okénka</th><th>Doladění</th><th>Záběr (nejhůř)</th><th></th></tr>',
      radky: sada.varianty.map(v => `<tr${v.i === 3 ? ' style="font-weight:700"' : ''}><td>${v.i}</td><td>${fmt(v.vule, 2)} mm</td>`
        + `<td>${v.dolad > 0 ? '+' : ''}${fmt(v.dolad, 2)} mm</td><td>${fmt(v.zaber, 2)} (${fmt(v.zaberMin, 2)}) mm – ${verdikt[v.verdikt]}</td>`
        + `<td><button class="tl" data-pouzij-chlopen="${v.i}">${v.i === 3 ? 'nastaveno' : 'Použít'}</button></td></tr>`).join(''),
      postup: '<b>Postup:</b> vytiskněte krabičku s víkem a tuto sadu. Nasaďte chlopně postupně na kloub (čepem) a zkuste zavřít a otevřít víko. '
        + 'Volná chlopeň se při zatažení za víko vysmekne, tuhá nejde přes výstupek nebo nedosedne. Nejlepší chlopeň nechte na krabičce '
        + '(zářezy nevadí) a tlačítkem <b>Použít</b> přeneste její nastavení – další chlopně už vytisknete správně.',
      dily: stl.map((s, i) => Object.assign({ barva: i === 2 ? 0x4caf7a : 0x8bc9a6 }, s)),
      popisky: stl.map((s, i) => { const b = KRAB.obal(s.poz); return { bod: [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, b[5] + 1], text: String(i + 1), zvyraznit: i === 2 }; }),
      varianty: sada.varianty,
    });
  }
  $('zkTabulka').addEventListener('click', e => {
    const b = e.target.closest('[data-pouzij-chlopen]'); if (!b || !zkouska || !zkouska.varianty) return;
    const v = zkouska.varianty.find(x => x.i === +b.dataset.pouzijChlopen);
    if (!v || v.i === 3) return;
    app.zmen(q => { q.zapinani.vule = v.vule; q.zapinani.dolad = v.dolad; });
    app.naplnFormular();
    $('dlgZkouska').close();
    Dialog.info(`Použito nastavení chlopně ${v.i}: vůle okénka ${fmt(v.vule, 2)} mm, doladění ${fmt(v.dolad, 2)} mm.`);
  });
  document.querySelectorAll('.btnMerka').forEach(b => b.addEventListener('click', otevriMerku));
  document.querySelectorAll('.btnSadaChl').forEach(b => b.addEventListener('click', otevriSaduChlopni));
  $('legendaMerky').textContent = 'Počet rýh → vůle: ' + KPANT.VULE_MERKY.map((v, i) => `${i + 1} = ${fmt(v, 2)} mm`).join(', ') + '.';

  /* ---------- předvolby (varianty) ---------- */
  for (const [k, v] of Object.entries(KPANT.VARIANTY)) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
    b.addEventListener('click', async () => {
      if (!(await Dialog.potvrd(`Použít variantu „${v.nazev}“? Přepíše rozměry, panty, přihrádky a zapínání (krok jde vrátit tlačítkem Zpět).`))) return;
      pohledPoStavbe = 'iso';
      app.nahrad(KPANT.varianta(k, app.p));
    });
    $('seznamPredvoleb').appendChild(b);
  }

  /* ---------- zobrazení: přepínače, otevírání, řez ---------- */
  function barvy() { if (nahled) nahled.barvy(css('--border-strong'), css('--border'), css('--text')); }
  const legenda = () => { $('legPrevisy').hidden = !(stavZobr.tisk && nahled && nahled.stav.previsy); $('posuvniky').hidden = stavZobr.tisk; };
  app.prepinac('tHrany', h => nahled && nahled.prepni('hrany', h));
  app.prepinac('tTisk', h => { stavZobr.tisk = h; legenda(); zobraz(true); });
  app.prepinac('tPrevisy', h => { if (nahled) nahled.prepni('previsy', h); legenda(); }, true);
  app.prepinac('tPravitka', h => nahled && nahled.prepni('pravitka', h), true);
  app.prepinac('tPruhledne', h => nahled && nahled.pruhledne(h));
  app.prepinac('tUchyty', h => nahled && nahled.zobrazUchyty(h));
  const nastavRez = () => { if (nahled) nahled.rez($('tRez').getAttribute('aria-pressed') === 'true' ? $('selRez').value : null, $('rRez').value / 100); };
  app.prepinac('tRez', h => { $('gRez').hidden = !h; nastavRez(); });
  $('selRez').onchange = $('rRez').oninput = nastavRez;
  function nastavUhly() {
    $('oViko').textContent = $('rViko').value + '°'; $('oChlopen').textContent = $('rChlopen').value + '°';
    if (nahled) nahled.uhly(+$('rViko').value, +$('rChlopen').value);
  }
  $('rViko').oninput = $('rChlopen').oninput = () => { animace = null; nastavUhly(); };
  /* Animace: odklopit chlopně → otevřít víko, nebo opačně zavřít. */
  let animace = null;
  $('btnOtevrit').onclick = () => {
    const otevreno = +$('rViko').value > 0;
    const zar = KPANT.odvozene(p()).pant.zarazka;
    const cil = otevreno ? [[0, 'rViko'], [0, 'rChlopen']] : [[60, 'rChlopen'], [Math.min(110, zar ? Math.floor(zar.uhel) : 110), 'rViko']];
    const id = {}; animace = id;
    $('txtOtevrit').textContent = otevreno ? 'Otevřít' : 'Zavřít';
    const krok = () => {
      if (animace !== id || !cil.length) return;
      const [c, k] = cil[0], el = $(k), h = +el.value;
      if (h === c) { cil.shift(); } else el.value = h + Math.sign(c - h) * Math.min(3, Math.abs(c - h));
      nastavUhly();
      requestAnimationFrame(krok);
    };
    krok();
  };
  TrubkyGui.pripoj({ klic: 'webapp_krabicka_pant_gui', pohled: j => nahled && nahled.pohled(j) });
  barvy();

  /* ---------- start ---------- */
  app.start({
    manifold: {
      ok: w => { wasm = w; prestav(); },
      chyba: e => {
        chybaStavby = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – model ani export nejsou k dispozici.';
        prestav();
      },
    },
  });
  // pro testy
  window.__krabicka_pant = { get p() { return app.p; }, get model() { return model; }, get pohyb() { return vysledekPohybu; }, get nahled() { return nahled; }, zmen: app.zmen, prestav, overPohyb, app };
})();
