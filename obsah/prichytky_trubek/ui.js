/* Příchytky trubek – ovládání stránky nad společným zapojením gen3d/aplikace.js
   (tady jen to, co je pro příchytky zvláštní: viditelnost polí, souhrny, výsledky, mechanika, kusovník, režimy náhledu,
   exporty po dílech, výkres a vrtací šablona). Náhled = KNOF_NAHLED. Režimy: sestava (na zdi s trubkou), tisk, kalibrace. */
/* global PRICH, PRICH_VYK, KNOF_NAHLED, KRAB, CLEAT, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = PRICH.fmt;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let p, wasm = null, model = null, chybaStavby = '', chybaJadra = '', mech = null;
  const stavZobr = { rezim: 'sestava', okoli: true };
  const nahled = KNOF_NAHLED.vytvorNahled($('platno'), { drzPohled: true });

  const app = G3D.aplikace({
    typ: 'prichytky_trubek', nazev: 'Příchytky trubek', klic: 'webapp_prichytky_trubek', soubor: 'prichytka',
    normalizuj: PRICH.normalizuj, vychozi: () => PRICH.predvolba('klip16'),
    ulozProjekt: PRICH.ulozProjekt, nactiProjekt: PRICH.nactiProjekt, popis: PRICH.popis,
    vezmi: PRICH.vezmi, poloz: PRICH.poloz,
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(),
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportVse('stl'),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(kusy(dilyKTisku()), app.p.nazev || 'Příchytka'), pripona: '.3mf' } : null),
    zkratky: { r: 'tRez', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka', o: 'tOkoli' },
    zmenaTematu: () => prepocitej(),
  });

  /* ---------- výběry ---------- */
  $('f_material').innerHTML = Object.entries(PRICH.MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev}</option>`).join('');
  $('f_vrut').innerHTML = Object.entries(PRICH.VRUTY).map(([k, v]) => `<option value="${k}">${fmt(v.d)} mm (hm. Ø ${fmt(v.hmozdinka)})</option>`).join('');
  $('f_podk').innerHTML = Object.entries(PRICH.PODKLADY).map(([k, v]) => `<option value="${k}">${v.nazev}</option>`).join('');
  $('f_prof').innerHTML = Object.entries(PRICH.PROFILY).map(([k, v]) => `<option value="${k}">${k} (drážka ${fmt(v.drazka, 1)}, ${v.sroub})</option>`).join('');
  $('f_csys').innerHTML += Object.entries(CLEAT.SYSTEMY).map(([k, v]) => `<option value="${k}">${esc(v.nazev)}</option>`).join('');
  $('f_csys').addEventListener('change', e => {
    const s = CLEAT.SYSTEMY[e.target.value]; if (!s) return;
    app.zmen(q => { q.cleat.tl = s.s.tl; q.cleat.vyska = s.s.vyska; q.cleat.uhel = s.s.uhel; q.cleat.vule = s.s.vule; });
    app.naplnFormular();
  });

  const seznam = a => (a || '').split(/\s+/).filter(Boolean);
  function viditelnost() {
    p = app.p;
    document.querySelectorAll('[data-druh],[data-nedruh],[data-uch],[data-stojna],[data-zpusob]').forEach(el => {
      const d = el.dataset;
      let vid = true;
      if (d.druh && !seznam(d.druh).includes(p.druh)) vid = false;
      if (d.nedruh && seznam(d.nedruh).includes(p.druh)) vid = false;
      if (d.uch && !seznam(d.uch).includes(p.zakl.uchyceni)) vid = false;
      if (d.stojna && d.stojna !== p.objimka.stojna) vid = false;
      if (d.zpusob && d.zpusob !== p.drazka.zpusob) vid = false;
      el.hidden = !vid;
    });
    // nepovolená uchycení v nabídce označit (zůstanou volitelná – kontrola nabídne opravu)
    for (const o of $('f_uch').options) o.textContent = o.textContent.replace(/ – nejde u tohoto druhu$/, '') + (PRICH.POVOLENA[p.druh].includes(o.value) ? '' : ' – nejde u tohoto druhu');
    const cs = Object.entries(CLEAT.SYSTEMY).find(([, v]) => v.s.tl === p.cleat.tl && v.s.vyska === p.cleat.vyska && v.s.uhel === p.cleat.uhel && v.s.vule === p.cleat.vule);
    $('f_csys').value = cs ? cs[0] : '';
    $('napDruh').textContent = {
      klip: 'Trubka se do oblouku zacvakne zepředu. Obepnutí určuje, jak pevně drží a jak moc se oblouk při nasazení ohne.',
      omega: 'Oblouk přes trubku se dvěma přírubami na šrouby – drží pevně, trubku přitlačí ke zdi.',
      objimka: 'Dva díly stažené šrouby v uších (matice zespodu v kapse). Odstup od zdi nastavíte sloupkem nebo závitovou tyčí.',
      rada: 'Jedna lišta s klipy pro více trubek nebo kabelů – každý může mít jiný průměr.',
      hadice: 'Sedlo s poloměrem, přes který se hadice nebo kabel navine bez zalomení; lem ji drží na sedle.',
    }[p.druh];
    $('napUch').textContent = {
      sroub: 'Vruty do hmoždinek; díry v plastu jsou kapkovité (tisk na boku), zápustná hlava má kužel 90°.',
      paska: 'Oboustranná montážní páska na celou plochu základny – na hladký, odmaštěný povrch.',
      drazka: 'Pero nebo zobáčky v drážce profilu drží příchytku ve směru; šroub do T-matice ji přitáhne.',
      cleat: 'Zámek nahoře se zavěsí za lištu s úkosem – příchytku lze kdykoli přesunout.',
      stah: 'Tunelem v základně se provlékne stahovací páska kolem sloupku, zábradlí nebo jiné trubky.',
    }[p.zakl.uchyceni];
    $('napTisk').innerHTML = p.druh === 'hadice'
      ? 'Držák se tiskne <b>nastojato</b> – spodek sedla a desky leží na podložce, sedlo nese hadici jako konzola a ohyb leží ve vrstvách. Dutina sedla má střechu 45°. Doporučeno PETG nebo ASA venku, 4 perimetry, 25 % výplně.'
      : 'Díly se tisknou <b>na boku</b>: průřez leží na podložce, takže se oblouk ohýbá podél vláken. Naležato by se klip lámal mezi vrstvami. Doporučeno PETG, PP nebo nylon, 3–4 perimetry. <b>Kalibrace:</b> hřebínek má 5 klipů s vůlí −2…+2 kroky (zářezy pod klipem = pořadí) – vůli toho, který drží nejlépe, zapište do pole <i>Vůle na poloměr</i>.';
  }

  /* ---------- přepočet ---------- */
  function prepocitej() {
    p = app.p;
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    let H = PRICH.kontroly(p);
    model = null; chybaStavby = chybaJadra; mech = null;
    const zasadni = H.some(h => h.uroven === 'chyba' && h.pole && h.pole[0] === 'zakl.uchyceni');
    if (wasm && !zasadni) {
      try {
        model = PRICH.postav(wasm, p, { kalibrace: stavZobr.rezim === 'kalibrace' || p.tisk.kalibrace });
        H = H.concat(PRICH.kontrolyModelu(p, model));
      } catch (e) { chybaStavby = 'Model nelze sestavit: ' + (e && e.message || e); }
    } else if (wasm) chybaStavby = 'Model nelze sestavit – opravte chybu v záložce Kontrola.';
    mech = PRICH.mechanika(p);
    const st = $('stav3d');
    st.textContent = wasm || chybaJadra ? chybaStavby : 'Načítám geometrické jádro…';
    st.classList.toggle('chyba', !!chybaStavby);
    zobraz(false);
    app.hlaseni(H, { chybaStavby, boxy: ['boxTrubka', 'boxUchyceni'] });
    vypisVysledky();
    vypisMechaniku();
    vypisKusovnik();
    souhrny();
    if (!$('vykresObsah').closest('[hidden]')) kresliVykres();
  }
  function souhrny() {
    const N = PRICH.NAZVY;
    TrubkyGui.souhrn('sTrubka', p.druh === 'rada' ? `řada Ø ${PRICH.prumeryRady(p.rada.prumery).map(x => fmt(x)).join(' + ')}` : `${N.druh[p.druh]} Ø ${fmt(p.trubka.D)}`, true);
    TrubkyGui.souhrn('sKlip', `stěna ${fmt(p.klip.stena, 1)} · ${fmt(p.klip.obepnuti, 0)}°`, true);
    TrubkyGui.souhrn('sRada', `${PRICH.prumeryRady(p.rada.prumery).length} klipů · mezera ${fmt(p.rada.mezera, 1)}`, true);
    TrubkyGui.souhrn('sOmega', `stěna ${fmt(p.omega.stena, 1)}`, true);
    TrubkyGui.souhrn('sObjimka', `${p.objimka.sroub} · ${N.stojna[p.objimka.stojna]}`, true);
    TrubkyGui.souhrn('sHadice', `${p.hadice.zavitu} závity · ${fmt(p.hadice.uhel, 0)}°`, true);
    TrubkyGui.souhrn('sZakl', `${N.uchyceni[p.zakl.uchyceni]}${p.zakl.odstup > 0 ? ` · odstup ${fmt(p.zakl.odstup)}` : ''}`, true);
    TrubkyGui.souhrn('sSroub', `vrut ${fmt(p.sroub.vrut)} · ${N.hlava[p.sroub.hlava]}`, true);
    TrubkyGui.souhrn('sDrazka', `${p.drazka.profil} · ${N.zpusob[p.drazka.zpusob]}`, true);
    TrubkyGui.souhrn('sCleat', `${fmt(p.cleat.tl)} × ${fmt(p.cleat.vyska)} · ${fmt(p.cleat.uhel)}°`, true);
    if (p.druh === 'hadice' && model) {
      const r = model.o.hadice;
      $('napHadice').textContent = `Sedlo R ${fmt(r.Rs, 0)} mm (nejmenší doporučený poloměr ohybu ≈ ${fmt(r.minR, 0)} mm), výška ${fmt(r.vys, 1)} mm, vyložení od desky ${fmt(r.hloubka, 0)} mm.`;
    }
    if ((p.druh === 'klip' || p.druh === 'rada') && model) {
      const r = model.o.kruhy[0];
      $('napKlip').textContent = `Ústí ${fmt(r.w, 1)} mm, vnitřní Ø ${fmt(2 * r.R, 2)} mm – trubka Ø ${fmt(r.D)} rozevře ústí o ${fmt(r.D - r.w, 1)} mm.`;
    }
  }
  const box = (a, b, c, d) => G3D.dlazdice(a, b, c, d);
  function dilyKTisku() { return model ? model.dily.concat(p.tisk.kalibrace ? model.kalibrace : []) : []; }
  const rozmer = d => { const b = G3D.obal(d.pozSestava || d.poz); return `${fmt(b[3] - b[0], 1)} × ${fmt(b[4] - b[1], 1)} × ${fmt(b[5] - b[2], 1)}`; };
  function vypisVysledky() {
    const el = $('vVysledky'), karta = $('karta3d');
    if (!model) { el.innerHTML = box('Model', wasm || chybaJadra ? 'nelze sestavit' : 'načítám…', chybaStavby); karta.innerHTML = ''; $('vSit').innerHTML = ''; return; }
    const mat = PRICH.MATERIALY[p.tisk.material], o = model.o, dily = dilyKTisku();
    const V = dily.reduce((s, d) => s + d.objem, 0) * p.tisk.sad, od = G3D.odhadTisku(V, mat.hustota, { dilu: dily.length * p.tisk.sad });
    let h = '';
    if (p.druh === 'hadice') {
      const r = o.hadice;
      h += box('Sedlo', `R ${fmt(r.Rs, 0)} mm`, `oblouk ${fmt(p.hadice.uhel, 0)}°, ${p.hadice.zavitu} závity vedle sebe`);
      h += box('Vyložení od zdi', `${fmt(r.zSedla[1] + (p.hadice.lem > 0 ? Math.max(3, r.tl) : 0), 0)} mm`, `deska ${fmt(r.sirkaDesky, 0)} × ${fmt(r.vyskaDesky, 0)} mm`);
    } else {
      const r = o.kruhy[0];
      h += box('Osa trubky od zdi', `${fmt(o.osaOdZdi, 1)} mm`, o.cleat ? 'od zdi za lištou' : o.tyc ? 'nad patkou (+ vyčnívající tyč)' : 'od plochy, na které příchytka sedí');
      h += box('Vnitřní Ø', o.kruhy.length > 1 ? o.kruhy.map(x => fmt(2 * x.R, 1)).join(' / ') : `${fmt(2 * r.R, 2)} mm`, p.trubka.vule < 0 ? `sevře o ${fmt(-p.trubka.vule, 2)} mm na poloměr` : p.trubka.vule > 0 ? `vůle ${fmt(p.trubka.vule, 2)} mm na poloměr` : 'přesně na trubku');
      if (mech.klipy) {
        const k = mech.klipy[0];
        h += box('Síla nasazení', `${fmt(k.Fin, 0)} N`, Number.isFinite(k.Fout) ? `vytažení ${fmt(k.Fout, 0)} N` : 'vytáhnout jen s rozevřením', k.epsMax <= k.dov ? 'ok-t' : k.epsMax <= k.mez ? 'mez-t' : 'chyba-t');
        h += box('Drží průměry', `${fmt(k.Dmin, 1)}–${fmt(k.Dmax, 1)} mm`, 'od ústí po mez trvalého roztažení');
      }
    }
    const b = model.sestava.filter(d => !d.okoli).reduce((B, d) => { const q = G3D.obal(d.poz); for (let i = 0; i < 3; i++) { B[i] = Math.min(B[i], q[i]); B[i + 3] = Math.max(B[i + 3], q[i + 3]); } return B; }, [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
    h += box('Rozměry', `${fmt(b[4] - b[1], 0)} × ${fmt(b[5] - b[2], 0)} × ${fmt(b[3] - b[0], 0)} mm`, 'šířka × výška × od zdi');
    h += box('Objem', `${fmt(V / 1000, 1)} cm³`, p.tisk.sad > 1 ? `${p.tisk.sad} kusy` : `${model.dily.length} ${model.dily.length > 1 ? 'díly' : 'díl'}`);
    h += box('Hmotnost', `${fmt(od.g, od.g < 10 ? 1 : 0)} g`, `${mat.nazev}, plné díly`);
    h += box('Filament', `${fmt(od.metru, 1)} m`, 'průměr 1,75 mm');
    h += box('Doba tisku', `≈ ${od.minut < 60 ? od.minut + ' min' : fmt(od.minut / 60, 1) + ' h'}`, `${dily.length * p.tisk.sad} dílů · hrubý odhad`);
    if (mech.uchyceni) h += box('Uchycení', `${fmt(mech.uchyceni.vyuziti * 100, 0)} %`, `využití: ${mech.uchyceni.coNese.toLowerCase()}`, mech.uchyceni.vyuziti <= 0.7 ? 'ok-t' : mech.uchyceni.vyuziti <= 1 ? 'mez-t' : 'chyba-t');
    el.innerHTML = h;
    const titul = { sestava: 'Sestava', tisk: 'Díly k tisku', kalibrace: 'Kalibrační hřebínek' }[stavZobr.rezim];
    karta.innerHTML = `<div class="titul">${titul}</div>${p.druh === 'hadice' ? `sedlo <b>R ${fmt(o.hadice.Rs, 0)}</b>` : `osa <b>${fmt(o.osaOdZdi, 1)}</b> mm od zdi`}<br><b>${fmt(od.g, 0)}</b> g ${mat.nazev}`;
    const kont = model.dily.concat(model.kalibrace).map(d => ({ d, k: KRAB.kontrolaSite(d.poz, d.idx) }));
    $('vSit').innerHTML = kont.map(({ d, k }) => box('Síť – ' + d.nazev, k.uzavrena && d.teles === 1 ? '✔ těsná' : '✖ netěsná', `${k.trojuhelniku} trojúhelníků, ${d.teles === 1 ? '1 těleso' : d.teles + ' tělesa'}`, k.uzavrena && d.teles === 1 ? 'ok-t' : 'chyba-t')).join('')
      + box('Stavba', `${model.cas} ms`, 'manifold-3d');
  }

  /* ---------- mechanika ---------- */
  function vypisMechaniku() {
    const m = mech, z = m.zatez;
    let h = box('Zatížení příchytky', `${fmt(z.F, z.F < 10 ? 1 : 0)} N`, p.druh === 'hadice' ? `${fmt(z.kg, 1)} kg hadice${z.odhad ? ' (odhad: plná vody)' : ''}` : `${fmt(z.kgm, 2)} kg/m${z.odhad ? ' (odhad: plná vody)' : ''} × ${fmt(p.zatez.rozestup / 1000, 2)} m`);
    if (m.M > 0) h += box('Klopný moment', `${fmt(m.M / 1000, 2)} N·m`, `rameno ${fmt(m.e, 1)} mm od zdi`);
    const u = m.uchyceni;
    if (u) {
      const tr = u.vyuziti <= 0.7 ? 'ok-t' : u.vyuziti <= 1 ? 'mez-t' : 'chyba-t';
      if (u.jednotka === 'N' && u.tahy) {
        h += box('Tah šroubu', `${fmt(u.potreba, u.potreba < 10 ? 1 : 0)} N`, `nejvíc namáhaný z ${u.n} · střih ${fmt(u.strih, 1)} N na šroub`, tr);
        h += box('Únosnost šroubu v tahu', `${fmt(u.kapacita, 0)} N`, `${u.popisK}: ${fmt(u.kotva, 0)} N · protržení plastu ${fmt(u.plast, 0)} N`, tr);
      } else if (u.jednotka === 'N/cm²') {
        h += box('Napětí v pásce', `${fmt(u.potreba, 2)} N/cm²`, `plocha ${fmt(u.A / 100, 1)} cm² · únosnost ${fmt(u.kapacita, 1)} N/cm²`, tr);
      } else h += box(u.coNese, `${fmt(u.potreba, 0)} N`, `pevnost pásky ≈ ${fmt(u.pevnost, 0)} N, dovoleno ${fmt(u.kapacita, 0)} N`, tr);
      h += box('Využití uchycení', `${fmt(u.vyuziti * 100, 0)} %`, u.vyuziti <= 1 ? 'vyhoví' : 'nevyhoví', tr);
    } else if (p.zakl.uchyceni === 'cleat') h += box('Uchycení', 'French cleat', 'únosnost určuje lišta na zdi a její šrouby – viz stránka French cleat');
    else if (model && model.o.tyc) h += box('Uchycení', `tyč ${model.o.tyc.M}`, 'únosnost určuje hmoždinka tyče');
    else if (p.zakl.uchyceni === 'drazka') h += box('Uchycení', 'zaklapnutí', 'drží třením a zobáčky – jen lehké kabely a hadičky');
    if (m.sedlo) h += box('Ohyb sedla', `${fmt(m.sedlo.sigma, 2)} MPa`, `dovoleno ${fmt(m.sedlo.dov, 1)} MPa (mez / 3, podél vrstev)`, m.sedlo.vyuziti <= 1 ? 'ok-t' : 'chyba-t');
    $('vMech').innerHTML = h;
    const t = $('tabKlipy');
    if (!m.klipy) { t.innerHTML = ''; return; }
    t.innerHTML = '<thead><tr><th>Klip</th><th class="c">Ústí</th><th class="c">Nasazení</th><th class="c">Vytažení</th><th class="c">Přetvoření</th><th class="c">Napětí</th><th class="c">Drží Ø</th></tr></thead><tbody>'
      + m.klipy.map(k => {
        const tr = k.epsMax <= k.dov ? 'ok-t' : k.epsMax <= k.mez ? 'mez-t' : 'chyba-t';
        return `<tr><td>Ø ${fmt(k.D)}</td><td class="c">${fmt(k.w, 1)} mm</td><td class="c">${fmt(k.Fin, 0)} N</td><td class="c">${Number.isFinite(k.Fout) ? fmt(k.Fout, 0) + ' N' : 'samosvorné'}</td>`
          + `<td class="c ${tr}">${fmt(k.epsMax * 100, 2)} % <span class="pozn">/ ${fmt(k.dov * 100, 1)}</span></td><td class="c">${fmt(k.sigma, 0)} MPa</td><td class="c">${fmt(k.Dmin, 1)}–${fmt(k.Dmax, 1)}</td></tr>`;
      }).join('') + '</tbody>';
  }

  /* ---------- kusovník ---------- */
  function polozkyKusovniku() {
    const out = [], n = p.tisk.sad, o = model ? model.o : PRICH.odvozene(p);
    if (model) for (const d of model.dily) out.push([d.nazev, n, d]);
    if (model && p.tisk.kalibrace) for (const d of model.kalibrace) out.push([d.nazev, 1, d]);
    const navic = [];
    const dir = o.diry ? o.diry.length : 0;
    if (p.zakl.uchyceni === 'sroub' && dir && !o.tyc) { const v = PRICH.VRUTY[p.sroub.vrut]; navic.push([p.sroub.hlava === 'zapustna' ? `Vrut ${fmt(v.d)} mm se zápustnou hlavou` : `Vrut ${fmt(v.d)} mm s čočkovou hlavou`, dir * n], [`Hmoždinka Ø ${fmt(v.hmozdinka)} mm`, dir * n]); }
    if (p.zakl.uchyceni === 'drazka' && !o.tyc) {
      if (dir) navic.push([`Šroub ${o.sroub.M} s válcovou hlavou (ISO 4762)`, dir * n], [`T-matice ${o.sroub.M} do drážky ${p.drazka.profil}`, dir * n]);
    }
    if (p.zakl.uchyceni === 'paska' && !o.tyc) navic.push([`Oboustranná montážní páska ${fmt(o.uRozsah[1] - o.uRozsah[0], 0)} × ${fmt(p.druh === 'hadice' ? o.hadice.vyskaDesky : o.b + o.wExt, 0)} mm`, n]);
    if (p.zakl.uchyceni === 'stah' && !o.tyc) navic.push([`Stahovací páska ${fmt(p.stah.sirka, 1)} mm`, n]);
    if (p.zakl.uchyceni === 'cleat' && !o.tyc) navic.push([`Lišta French cleat ${fmt(p.cleat.tl)} × ${fmt(p.cleat.vyska)} mm, úkos ${fmt(p.cleat.uhel)}° (na zdi)`, 1]);
    if (p.druh === 'objimka') {
      navic.push([`Šroub ${p.objimka.sroub} s válcovou hlavou + matice (uši)`, 2 * n]);
      if (o.tyc) navic.push([`Závitová tyč ${o.tyc.M} + 2 matice, hmoždinka nebo vrut se závitem ${o.tyc.M}`, n]);
    }
    return { out, navic };
  }
  function vypisKusovnik() {
    const { out, navic } = polozkyKusovniku();
    $('kusovnik').innerHTML = `<table class="tabulka"><thead><tr><th>Díl</th><th class="c">Kusů</th><th class="c">Rozměr (mm)</th><th class="c">Objem</th></tr></thead><tbody>`
      + out.map(([nz, ks, d]) => `<tr><td>${esc(nz)}</td><td class="c">${ks}</td><td class="c">${rozmer(d)}</td><td class="c">${fmt(d.objem / 1000, 2)} cm³</td></tr>`).join('')
      + navic.map(([tx, ks]) => `<tr><td>+ ${esc(tx)}</td><td class="c">${ks}</td><td colspan="2"></td></tr>`).join('') + '</tbody></table>';
  }

  /* ---------- náhled ---------- */
  function zobraz(novyPohled) {
    document.querySelectorAll('[data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === stavZobr.rezim)));
    if (!model) { nahled.nastav(null); return; }
    const r = stavZobr.rezim;
    if (r === 'tisk') nahled.nastav(G3D.tiskoveRozlozeni(dilyKTisku(), p.tisk.sad, 5, p.tisk.podlozka), { tisk: true, novyPohled, uhel: p.tisk.uhel });
    else if (r === 'kalibrace') nahled.nastav(G3D.tiskoveRozlozeni(model.kalibrace, 1, 5, 160), { tisk: true, novyPohled, uhel: p.tisk.uhel });
    else nahled.nastav(model.sestava.filter(d => stavZobr.okoli || !d.okoli), { novyPohled });
    $('legPrevisy').hidden = !((r === 'tisk' || r === 'kalibrace') && nahled.stav.previsy);
  }
  function nastavRezim(r) {
    if (r === 'kalibrace' && p.druh === 'hadice') { Dialog.info('Držák hadice nemá lícování – kalibrační hřebínek je jen u klipů, omegy, objímky a řady.'); return; }
    const tisk = $('tTisk').getAttribute('aria-pressed') === 'true';
    const predchozi = stavZobr.rezim;
    stavZobr.rezim = r;
    const chybiKal = () => r === 'kalibrace' && model && !model.kalibrace.length;
    if ((r === 'tisk') !== tisk) { $('tTisk').click(); if (!chybiKal()) return; }
    if (chybiKal()) { prepocitej(); return; }
    zobraz(predchozi !== r);
    vypisVysledky();
  }
  document.querySelectorAll('[data-rezim]').forEach(b => b.addEventListener('click', () => nastavRezim(b.dataset.rezim)));

  /* ---------- nabídky, export ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_prichytky_trubek_gui', pohled: j => nahled.pohled(j) });
  let skupina = null;
  for (const v of PRICH.PREDVOLBY) {
    if (v.skupina !== skupina) {
      skupina = v.skupina;
      const nd = document.createElement('div'); nd.className = 'nab-skupina'; nd.textContent = PRICH.NAZVY.druh[skupina];
      $('seznamPredvoleb').appendChild(nd);
    }
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
    b.addEventListener('click', () => {
      const q = PRICH.predvolba(v.id);
      q.tisk = PRICH.kopie(app.p.tisk);
      app.nahrad(q);
      nahled.pohled('iso');
    });
    $('seznamPredvoleb').appendChild(b);
  }
  function lzeExport() {
    if (!model) { Dialog.chyba(chybaStavby || 'Geometrické jádro se ještě načítá.'); return false; }
    return true;
  }
  const kusy = dily => G3D.tiskoveRozlozeni(dily, app.p.tisk.sad, 5, app.p.tisk.podlozka);
  function exportVse(druh) {
    if (!lzeExport()) return;
    if (druh === 'stl') app.stahni(KRAB.stlBinarni(kusy(dilyKTisku()), 'prichytky trubek - github_site'), app.jmeno('.stl'), 'model/stl');
    else app.stahni(KRAB.soubor3mf(kusy(dilyKTisku()), app.p.nazev || 'Příchytka'), app.jmeno('.3mf'), 'model/3mf');
  }
  $('btnStl').addEventListener('click', () => exportVse('stl'));
  $('btn3mf').addEventListener('click', () => exportVse('3mf'));
  $('btnZip').addEventListener('click', () => {
    if (!lzeExport()) return;
    const soubory = dilyKTisku().map(d => ({ name: app.jmeno('_' + G3D.jmenoSouboru(d.nazev, d.jmeno, '.stl')), data: KRAB.stlBinarni(G3D.tiskoveRozlozeni([d], 1, 5, 200), 'prichytky trubek - ' + d.jmeno) }));
    app.stahni(KRAB.zip(soubory), app.jmeno('_dily.zip'), 'application/zip');
  });
  $('btnKalStl').addEventListener('click', () => {
    if (!lzeExport()) return;
    if (app.p.druh === 'hadice') { Dialog.info('Držák hadice nemá lícování – kalibrační hřebínek je jen u klipů, omegy, objímky a řady.'); return; }
    let kal = model.kalibrace;
    if (!kal.length) { try { kal = PRICH.postav(wasm, app.p, { kalibrace: true }).kalibrace; } catch (e) { Dialog.chyba('Kalibrační hřebínek nelze sestavit: ' + (e && e.message || e)); return; } }
    app.stahni(KRAB.stlBinarni(G3D.tiskoveRozlozeni(kal, 1, 5, 200), 'prichytky trubek - kalibrace'), app.jmeno('_kalibrace.stl'), 'model/stl');
  });

  /* ---------- výkres ---------- */
  function metaVykresu() {
    const d = new Date(), o = model.o, { out, navic } = polozkyKusovniku(), m = mech;
    const radky = [['Druh', PRICH.NAZVY.druh[p.druh]], ['Uchycení', PRICH.NAZVY.uchyceni[p.zakl.uchyceni]]];
    if (p.druh === 'hadice') radky.push(['Poloměr sedla', `R ${fmt(o.hadice.Rs, 0)} mm`], ['Hadice', `Ø ${fmt(p.trubka.D)} mm, ${p.hadice.zavitu} závity`]);
    else {
      radky.push(['Trubka', o.kruhy.map(r => 'Ø ' + fmt(r.D)).join(' + ') + ' mm'], ['Vnitřní Ø / vůle', `${fmt(2 * o.kruhy[0].R, 2)} / ${fmt(p.trubka.vule, 2)} mm`], ['Osa od zdi', `${fmt(o.osaOdZdi, 1)} mm`], ['Šířka příchytky', `${fmt(o.b)} mm`]);
      if (m.klipy) radky.push(['Síla nasazení / přetvoření', `${fmt(m.klipy[0].Fin, 0)} N / ${fmt(m.klipy[0].epsMax * 100, 1)} %`]);
    }
    radky.push(['Materiál', PRICH.MATERIALY[p.tisk.material].nazev]);
    if (m.uchyceni) radky.push(['Využití uchycení', `${fmt(m.uchyceni.vyuziti * 100, 0)} %`]);
    const v = PRICH.VRUTY[p.sroub.vrut];
    return {
      datum: `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`, nazev: p.nazev, popis: PRICH.popis(p), radky,
      kusovnik: out.map(([a, b]) => [a, `${b} ks`]).concat(navic.map(([a, b]) => [a, `${b} ks`])),
      vrtak: p.zakl.uchyceni === 'sroub' ? `Vrtat Ø ${fmt(v.hmozdinka)} mm pro hmoždinku, vrut ${fmt(v.d)} mm.` : p.zakl.uchyceni === 'drazka' ? `Šrouby ${o.sroub ? o.sroub.M : ''} do T-matic v drážce.` : '',
    };
  }
  const vykresTed = () => PRICH_VYK.vykres(app.p, model, metaVykresu());
  function kresliVykres() {
    if (!model) { $('vykresObsah').innerHTML = `<p class="napoveda">${esc(chybaStavby || 'Model se ještě načítá.')}</p>`; return; }
    $('vykresObsah').innerHTML = PRICH_VYK.svg(vykresTed());
  }
  let pismoSlib = null;
  function nactiPismo() {
    if (window.FONTY_JS && window.FONTY_JS['LiberationSans-Regular.ttf']) return Promise.resolve(window.FONTY_JS['LiberationSans-Regular.ttf']);
    if (pismoSlib) return pismoSlib;
    pismoSlib = new Promise(ok => {
      const s = document.createElement('script'); s.src = 'stitky_panely/fonty/LiberationSans-Regular.ttf.js';
      s.onload = () => ok((window.FONTY_JS || {})['LiberationSans-Regular.ttf'] || null);
      s.onerror = () => { pismoSlib = null; ok(null); };
      document.head.appendChild(s);
    });
    return pismoSlib;
  }
  async function pdf(sablona) {
    if (!lzeExport()) return;
    try {
      if (!window.jspdf) throw new Error('Knihovna jsPDF se nenačetla.');
      const pismo = await nactiPismo();
      const v = sablona ? PRICH_VYK.sablona(app.p, model, metaVykresu()) : vykresTed();
      const doc = PRICH_VYK.pdf(window.jspdf.jsPDF, v, { pismo, nazev: app.p.nazev || 'Příchytka' });
      app.stahni(doc.output('blob'), app.jmeno(sablona ? '_sablona.pdf' : '_vykres.pdf'), 'application/pdf');
      if (!pismo) Dialog.info('Písmo se nepodařilo načíst – PDF je bez diakritiky.');
    } catch (e) { Dialog.chyba('PDF se nepodařilo vytvořit: ' + (e && e.message || e)); }
  }
  const svgVykres = () => { if (lzeExport()) app.stahni(PRICH_VYK.svg(vykresTed()), app.jmeno('_vykres.svg'), 'image/svg+xml'); };
  $('btnVykres').addEventListener('click', () => { TrubkyGui.otevriZalozku('vykres'); kresliVykres(); });
  for (const id of ['btnVykresSvg', 'btnVykresSvg2']) $(id).addEventListener('click', svgVykres);
  for (const id of ['btnVykresPdf', 'btnVykresPdf2']) $(id).addEventListener('click', () => pdf(false));
  for (const id of ['btnSablona', 'btnSablona2']) $(id).addEventListener('click', () => pdf(true));
  document.querySelector('[data-zalozka="vykres"]').addEventListener('click', () => kresliVykres());

  app.prepinac('tRez', h => { nahled.prepni('rez', h); $('legRez').hidden = !h; });
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !(h && (stavZobr.rezim === 'tisk' || stavZobr.rezim === 'kalibrace')); }, true);
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);
  app.prepinac('tOkoli', h => { stavZobr.okoli = h; if (model && stavZobr.rezim === 'sestava') zobraz(false); }, true);
  app.prepinac('tTisk', h => {
    if (h) stavZobr.rezim = 'tisk';
    else if (stavZobr.rezim === 'tisk') stavZobr.rezim = 'sestava';
    zobraz(true);
    if (model) vypisVysledky();
  });

  /* ---------- start ---------- */
  app.start({
    manifold: {
      ok: w => { wasm = w; prepocitej(); },
      chyba: e => { chybaJadra = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – model ani export nejsou k dispozici.'; prepocitej(); },
    },
  });
  window.PRICH_UI = { get p() { return app.p; }, get model() { return model; }, zmen: app.zmen, nahrad: app.nahrad, prepocitej, nahled, app, nastavRezim };
})();
