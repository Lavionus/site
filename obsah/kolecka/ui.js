/* Kolečka a pojezdy – ovládání stránky nad společným zapojením gen3d/aplikace.js
   (tady jen to, co je pro kolečka zvláštní: nabídky, viditelnost polí, souhrny, výsledky, mechanika, kusovník, výkres, export).
   Náhled = KNOF_NAHLED. Režimy: sestava (montážní poloha), kolo, tisk (díly na podložce), kalibrace. */
/* global KOLA, KOLA_MECH, KOLA_VYK, KNOF_NAHLED, KRAB, G3D, Dialog, TrubkyGui, LoziskaJadro */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = KOLA.fmt;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let p, o = null, wasm = null, model = null, mech = null, chybaStavby = '', chybaJadra = '';
  const stavZobr = { rezim: 'sestava' };
  const nahled = KNOF_NAHLED.vytvorNahled($('platno'));

  const app = G3D.aplikace({
    typ: 'kolecka', nazev: 'Kolečka a pojezdy', klic: 'webapp_kolecka', soubor: 'kolecko',
    normalizuj: KOLA.normalizuj, vychozi: () => KOLA.predvolba('vozik'),
    ulozProjekt: KOLA.ulozProjekt, nactiProjekt: KOLA.nactiProjekt, popis: KOLA.popis,
    vezmi: KOLA.vezmi, poloz: KOLA.poloz,
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(),
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportVse('stl'),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(kusy(), app.p.nazev || 'Kolečko'), pripona: '.3mf' } : null),
    zkratky: { r: 'tRez', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka' },
    zmenaTematu: () => prepocitej(),
  });

  /* ---------- nabídky formuláře ---------- */
  const moznosti = (sel, obj) => { sel.innerHTML = Object.entries(obj).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join(''); };
  moznosti($('f_profil'), KOLA.NAZVY.profil);
  moznosti($('f_utyp'), KOLA.NAZVY.ulozeni);
  moznosti($('f_deleni'), KOLA.NAZVY.deleni);
  moznosti($('f_spoj'), KOLA.NAZVY.spoj);
  moznosti($('f_dtyp'), KOLA.NAZVY.drzak);
  moznosti($('f_mostek'), KOLA.NAZVY.mostek);
  moznosti($('f_material'), Object.fromEntries(Object.entries(KOLA.MATERIALY).map(([k, m]) => [k, m.nazev])));
  moznosti($('f_pod'), Object.fromEntries(Object.entries(KOLA_MECH.PODLOZKY).map(([k, m]) => [k, m.nazev])));
  (() => {
    // ložiska: nejčastější nahoře, pak po řadách z katalogu ložisek
    const L = KOLA.LOZISKA, txt = l => `${l.o} – ${fmt(l.d)} × ${fmt(l.D)} × ${fmt(l.B)}`;
    let h = '<optgroup label="Nejčastější">' + KOLA.CASTA.map(o2 => L.find(l => l.o === o2)).filter(Boolean).map(l => `<option value="${l.o}">${txt(l)}</option>`).join('') + '</optgroup>';
    const rady = {};
    for (const l of L) if (!KOLA.CASTA.includes(l.o)) (rady[l.rada] = rady[l.rada] || []).push(l);
    const jm = { mini: 'Miniaturní 6xx', MR: 'Miniaturní MR', 618: 'Řada 618 (68xx)', 619: 'Řada 619 (69xx)', 160: 'Řada 160', 60: 'Řada 60', 62: 'Řada 62', 63: 'Řada 63' };
    for (const [r, s] of Object.entries(rady)) h += `<optgroup label="${jm[r] || r}">` + s.map(l => `<option value="${l.o}">${txt(l)}</option>`).join('') + '</optgroup>';
    h += '<option value="vlastni">vlastní rozměry…</option>';
    $('f_loz').innerHTML = h;
  })();

  const seznam = a => (a || '').split(/\s+/).filter(Boolean);
  function viditelnost() {
    p = app.p;
    const od = KOLA.odvozene(p);
    document.querySelectorAll('[data-profil],[data-neprofil],[data-ulozeni],[data-vlastni],[data-pulky],[data-odlehceni],[data-drzak],[data-excentr]').forEach(el => {
      const d = el.dataset;
      let vid = true;
      if (d.profil && !seznam(d.profil).includes(p.kolo.profil)) vid = false;
      if (d.neprofil && seznam(d.neprofil).includes(p.kolo.profil)) vid = false;
      if (d.ulozeni && !seznam(d.ulozeni).includes(p.ulozeni.typ)) vid = false;
      if (d.vlastni && !(p.ulozeni.typ === 'lozisko' && p.ulozeni.lozisko === 'vlastni')) vid = false;
      if (d.pulky && (od.deleni !== 'pulky' || (d.pulky !== '1' && od.spoj !== d.pulky))) vid = false;
      if (d.odlehceni && !p.kolo.odlehceni) vid = false;
      if (d.drzak && !seznam(d.drzak).includes(p.drzak.typ)) vid = false;
      if (d.excentr && !p.excentr.pouzit) vid = false;
      el.hidden = !vid;
    });
    $('napProfil').textContent = {
      plochy: 'Válcový běhoun – nejmenší tlak na podlahu (čárový styk), ale v zatáčce kolo dře.',
      korunka: 'Mírně vypouklý běhoun – kolo se snáz otáčí na místě a nevadí mu nerovná podlaha. Stačí 0,2–0,5 mm.',
      vhrot: 'V hrot jede v drážce profilu V-slot (90°) nebo ve V kolejnici. Rozměry V-slot ověřte měřením kupovaného kola.',
      vdrazka: 'V drážka jede po hraně úhelníku (vrata) nebo po kulaté tyči. Úhel drážky = úhel úhelníku (90°).',
      u: 'Půlkruhová drážka na trubku, kulatinu nebo lanko (kladka). Vůle na poloměr, hloubka nejvýš poloměr drážky.',
      oring: '',
      tpu: 'Jádro z tvrdého plastu + běhoun z TPU 95A tištěný zvlášť a nalisovaný přes horní lem – tiché kolo, nedělá rýhy.',
    }[p.kolo.profil];
    if (p.kolo.profil === 'oring') {
      const r = KOLA.okrouzek(p, od);
      $('napProfil').textContent = `Drážka pro O-kroužek: dno Ø ${fmt(r.Dg, 1)} mm, vnitřní průměr kroužku asi Ø ${fmt(r.d1Idealni, 1)} (natažení 5 %)` +
        (r.krouzek ? ` – vhodný ${r.krouzek.oznaceni}, natažení ${fmt(r.krouzek.natazeni * 100, 0)} %.` : ' – v katalogu kroužek tohoto průřezu nenalezen, změřte vlastní.');
    }
    const L = od.L;
    $('napUlozeni').textContent = p.ulozeni.typ === 'lozisko'
      ? `${L.o}: d ${fmt(L.d)} × D ${fmt(L.D)} × B ${fmt(L.B)} mm${L.C ? `, C ${fmt(L.C, 2)} kN, C0 ${fmt(L.C0, 2)} kN` : ''}. Sedlo Ø ${fmt(2 * od.rp, 2)} mm, osazení Ø ${fmt(2 * od.rr, 1)} mm. Data: katalog ložisek (únosnosti orientační).`
      : p.ulozeni.typ === 'kluzne' ? `Otvor Ø ${fmt(2 * od.rb, 2)} mm – kolo se točí přímo na ose (šroub, čep). Namazat.`
        : `Otvor Ø ${fmt(2 * od.rb, 2)} mm s ploškou – kolo pevně na hřídeli motoru (D-hřídel). Vůli vylaďte kalibračním vzorkem.`;
    $('napDeleni').textContent = od.deleni === 'pulky'
      ? `Kolo se tiskne jako dvě poloviny (${od.tiskKolo}).` + ({ srouby: ' Šrouby s hlavou a maticí zapuštěnými v čelech.', lepeni: ' Tři kolíky z filamentu 1,75 mm a lepidlo na styk.', loziska: ' Poloviny drží ložiska sevřená na ose.' }[od.spoj] || '')
      : `Kolo se tiskne celé, ${od.tiskKolo} – největší převis profilu ${fmt(od.previsCele, 0)}°.`;
    $('napDrzak').textContent = {
      zadny: 'Jen kolo (a distance / excentr) – na vlastní osu ve stroji nebo vašem držáku.',
      vidlice: 'Pevná vidlice s plotýnkou na 4 vruty nebo šrouby – tiskne se deskou dolů.',
      otocna: 'Otočná vidlice: talíř se otáčí pod deskou na čepu (zápustný šroub + samojistná matice), kluzně bez ložiska.',
      uchyt: 'Deska s dírami podle starého úchytu, náboj s osou kola. Matice osy v kapse v zadní straně.',
    }[p.drzak.typ];
  }

  /* ---------- přepočet ---------- */
  function prepocitej() {
    p = app.p;
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    let H = KOLA.kontroly(p);
    o = KOLA.odvozene(p);
    model = null; chybaStavby = chybaJadra;
    const chyby = H.some(h => h.uroven === 'chyba');
    if (wasm && !chyby) {
      try {
        model = KOLA.postav(wasm, p, { kalibrace: stavZobr.rezim === 'kalibrace' });
        H = H.concat(KOLA.kontrolyModelu(p, model));
      } catch (e) { chybaStavby = 'Model nelze sestavit: ' + (e && e.message || e); }
    } else if (wasm) chybaStavby = 'Model nelze sestavit – opravte chybu v záložce Kontrola.';
    mech = KOLA_MECH.spocitej(p, o);
    H = H.concat(mech.hlaseni);
    const st = $('stav3d');
    st.textContent = wasm || chybaJadra ? chybaStavby : 'Načítám geometrické jádro…';
    st.classList.toggle('chyba', !!chybaStavby);
    zobraz(false);
    app.hlaseni(H, { chybaStavby, boxy: ['boxKolo', 'boxDrzak'] });
    souhrny();
    vypisVysledky();
    vypisMechaniku();
    vypisTisk();
    vypisKusovnik();
    exportDilu();
    if (!$('vykresNahled').closest('[hidden]')) kresliVykres();
  }
  function souhrny() {
    const k = p.kolo, u = p.ulozeni, d = p.drzak, N = KOLA.NAZVY;
    TrubkyGui.souhrn('sBehoun', `Ø ${fmt(k.prumer)} × ${fmt(k.sirka)} · ${N.profil[k.profil].split(' – ')[0].split(' (')[0]}`, true);
    TrubkyGui.souhrn('sUlozeni', u.typ === 'lozisko' ? `${u.pocet}× ${o.L.o}` : u.typ === 'kluzne' ? `kluzně Ø ${fmt(u.osa)}` : `hřídel Ø ${fmt(u.osa)} s ploškou`, true);
    TrubkyGui.souhrn('sDeleni', o.deleni === 'pulky' ? `dvě poloviny · ${N.spoj[o.spoj]}` : 'celé kolo' + (o.odlehceni ? ' · odlehčené' : ''), true);
    TrubkyGui.souhrn('sDrzak', N.drzak[d.typ] + (o.zPT ? ` · výška ${fmt(o.zPT, 0)} mm` : ''), true);
    TrubkyGui.souhrn('sDeska', `${fmt(d.a)} × ${fmt(d.b)} · díry ${fmt(d.roztecX)} × ${fmt(d.roztecY)}`, true);
    TrubkyGui.souhrn('sUchyt', `${fmt(d.delka)} × ${fmt(d.vyska)} · ${d.der}× Ø ${fmt(d.dira, 1)}${d.der > 1 ? ` po ${fmt(d.roztec)}` : ''}`, true);
    TrubkyGui.souhrn('sExcentr', p.excentr.pouzit ? `e ${fmt(p.excentr.e, 2)} · čep Ø ${fmt(p.excentr.prumer, 1)}` : 'bez excentru', p.excentr.pouzit);
  }
  const box = (a, b, c, d) => G3D.dlazdice(a, b, c, d);
  const hustota = d => (d.material === 'TPU' ? KOLA.MATERIALY.TPU : KOLA.MATERIALY[p.tisk.material]).hustota;
  function vypisVysledky() {
    const el = $('vVysledky'), karta = $('karta3d');
    if (!model) { el.innerHTML = box('Model', wasm || chybaJadra ? 'nelze sestavit' : 'načítám…', chybaStavby); karta.innerHTML = ''; $('vSit').innerHTML = ''; $('tabRozmery').innerHTML = ''; return; }
    const mat = KOLA.MATERIALY[p.tisk.material], n = p.tisk.kusu;
    const V = model.dily.reduce((s, d) => s + d.objem, 0) * n, g = model.dily.reduce((s, d) => s + d.objem * hustota(d) / 1000, 0) * n;
    const od = G3D.odhadTisku(V, mat.hustota, { dilu: model.dily.length * n });
    const B = model.sestava.reduce((A, d) => { const q = G3D.obal(d.poz); for (let i = 0; i < 3; i++) { A[i] = Math.min(A[i], q[i]); A[i + 3] = Math.max(A[i + 3], q[i + 3]); } return A; }, [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
    let h = box('Kolo', `Ø ${fmt(p.kolo.prumer, 1)} × ${fmt(p.kolo.sirka, 1)} mm`, `${KOLA.NAZVY.profil[p.kolo.profil].split(' – ')[0]} · ${o.tiskKolo}`);
    h += box('Sestava', `${fmt(B[3] - B[0], 0)} × ${fmt(B[4] - B[1], 0)} × ${fmt(B[5] - B[2], 0)} mm`, o.zPT ? `montážní výška ${fmt(o.zPT, 1)} mm (podlaha – horní plocha desky)` : 'š × h × v v montážní poloze');
    h += box('Zatížení kola', `${fmt(mech.F, 0)} N`, `≈ ${fmt(mech.F / 9.81, 1)} kg včetně rázů · Hertz ${fmt(mech.kontakt.pmax, 0)} MPa`, mech.kontakt.vyuziti > 1 ? 'chyba-t' : mech.kontakt.vyuziti > 0.7 ? 'mez-t' : 'ok-t');
    h += box('Objem', `${fmt(V / 1000, 1)} cm³`, n > 1 ? `počet dílů ${model.dily.length * n} (${n} komplety)` : `počet dílů ${model.dily.length}`);
    h += box('Hmotnost', `${fmt(g, g < 10 ? 1 : 0)} g`, `${mat.nazev}${model.dily.some(d => d.material === 'TPU') ? ' + TPU' : ''}, plné díly`);
    h += box('Filament', `${fmt(od.metru, 1)} m`, 'průměr 1,75 mm, plné díly');
    h += box('Doba tisku', `≈ ${od.minut < 60 ? od.minut + ' min' : fmt(od.minut / 60, 1) + ' h'}`, 'hrubý odhad');
    el.innerHTML = h;
    // tabulka lícovaných rozměrů
    const r = [];
    if (o.L) {
      r.push([`Sedlo ložiska ${o.L.o}`, `Ø ${fmt(2 * o.rp, 2)}`, `D ${fmt(o.L.D)} + vůle ${fmt(p.ulozeni.vule, 2)}, hloubka ${fmt(o.L.B)}`]);
      r.push(['Osazení (otvor)', `Ø ${fmt(2 * o.rr, 1)}`, `opírá vnější kroužek, ${fmt(p.ulozeni.osazeni, 1)} mm`]);
    } else r.push([p.ulozeni.typ === 'hridel' ? 'Otvor s ploškou' : 'Otvor na osu', `Ø ${fmt(2 * o.rb, 2)}`, p.ulozeni.typ === 'hridel' ? `přes plošku ${fmt(o.plocha, 2)}` : `osa Ø ${fmt(p.ulozeni.osa)}`]);
    if (o.prof.rDno && o.prof.rDno < o.R - 0.05) r.push(['Dno profilu', `Ø ${fmt(2 * o.prof.rDno, 2)}`, o.prof.h ? `hloubka ${fmt(o.prof.h, 2)}` : '']);
    if (p.drzak.typ === 'vidlice' || p.drzak.typ === 'otocna') r.push(['Díra osy ve vidlici', `Ø ${fmt(2 * o.rOsa, 2)}`, 'kapkovitá (tisk deskou dolů)']);
    if (p.excentr.pouzit) r.push(['Díra pro čep excentru', `Ø ${fmt(p.excentr.prumer + 0.3, 2)}`, `čep Ø ${fmt(p.excentr.prumer, 1)}, e ${fmt(p.excentr.e, 2)}`]);
    if (o.prof.behoun) r.push(['Běhoun TPU – vnitřní', `Ø ${fmt(2 * (o.prof.Rc - p.kolo.tpuPresah / 2), 2)}`, `kanál jádra Ø ${fmt(2 * o.prof.Rc, 2)}`]);
    $('tabRozmery').innerHTML = '<tr><th>Lícovaný prvek</th><th class="c">Rozměr</th><th>Pozn.</th></tr>' + r.map(x => `<tr><td>${esc(x[0])}</td><td class="c">${x[1]}</td><td>${esc(x[2])}</td></tr>`).join('');
    const tit = { sestava: 'Sestava', kolo: 'Kolo', tisk: 'Díly k tisku', kalibrace: 'Kalibrační vzorek' }[stavZobr.rezim];
    karta.innerHTML = `<div class="titul">${tit}</div><b>Ø ${fmt(p.kolo.prumer, 1)} × ${fmt(p.kolo.sirka, 1)}</b> mm · ${o.L ? `${o.pocet}× ${o.L.o}` : KOLA.NAZVY.ulozeni[p.ulozeni.typ].split(' (')[0]}<br>`
      + `${KOLA.NAZVY.drzak[p.drzak.typ]}${o.zPT ? ` · výška <b>${fmt(o.zPT, 0)}</b> mm` : ''}<br><b>${fmt(mech.F, 0)}</b> N na kolo · ${fmt(g / n, 0)} g`;
    const kont = model.dily.map(d => ({ d, k: KRAB.kontrolaSite(d.poz, d.idx) }));
    $('vSit').innerHTML = kont.map(({ d, k }) => box('Síť – ' + d.nazev, k.uzavrena && d.teles === 1 ? '✔ těsná' : '✖ netěsná', `${k.trojuhelniku} trojúhelníků, ${d.teles === 1 ? '1 těleso' : d.teles + ' tělesa'}`, k.uzavrena && d.teles === 1 ? 'ok-t' : 'chyba-t')).join('')
      + box('Stavba', `${model.cas} ms`, 'manifold-3d');
  }
  function vypisMechaniku() {
    const c = mech.kontakt, m = p.mech;
    let h = box('Zatížení kola', `${fmt(mech.F, 0)} N`, `${fmt(m.hmotnost, 1)} kg / ${m.kol} kola × rázy ${fmt(m.raz, 1)}`);
    h += box('Hertzův tlak', `${fmt(c.pmax, c.pmax < 10 ? 1 : 0)} MPa`, c.mezPodlozka ? `${c.popis}; mez podložky ≈ ${fmt(c.pDov, 0)} MPa` : `${c.popis}; mez kola ≈ ${fmt(c.pDov, 0)} MPa`, c.vyuziti > 1 ? 'chyba-t' : c.vyuziti > 0.7 ? 'mez-t' : 'ok-t');
    h += box('Stopa kola', c.delka ? `${fmt(c.sirka, 2)} × ${fmt(c.delka, 1)} mm` : `Ø ${fmt(c.sirka, 2)} mm`, c.N ? `síla na bok ${fmt(c.N, 0)} N` : 'šířka styku ve směru jízdy');
    if (mech.lozisko) {
      const l = mech.lozisko;
      h += box('Ložisko – statika', l.s0 ? `C0/P = ${fmt(l.s0, 1)}` : '–', `${l.L.o}: ${fmt(l.Fr, 0)} N na ložisko${l.C0 ? `, C0 ${fmt(l.C0, 2)} kN` : ''}`, l.s0 === undefined ? '' : l.s0 >= 2 ? 'ok-t' : l.s0 >= 1 ? 'mez-t' : 'chyba-t');
      h += box('Ložisko – trvanlivost', l.L10h ? (l.L10h > 1e6 ? '> 1 000 000 h' : `${fmt(l.L10h, 0)} h`) : '–', l.C ? `L10 při ${fmt(mech.n, 0)} ot/min bez rázů` : 'vlastní ložisko – zadejte únosnost v katalogu ložisek', l.L10h && m.zivot > 0 && l.L10h < m.zivot ? 'mez-t' : '');
      h += box('Otáčky', `${fmt(mech.n, 0)} ot/min`, l.nMez ? `mez ložiska s těsněním ≈ ${fmt(l.nMez, 0)} ot/min` : `při ${fmt(m.rychlost, 2)} m/s`, l.nMez && mech.n > l.nMez ? 'chyba-t' : '');
    } else if (mech.kluzne) {
      const k = mech.kluzne;
      h += box('Kluzné uložení – p', `${fmt(k.p, 2)} MPa`, 'tlak na průmět otvoru');
      h += box('pv', `${fmt(k.pv, 3)} MPa·m/s`, `mez ${p.tisk.material} ≈ ${fmt(k.pvMez, 2)} · v ${fmt(k.v, 3)} m/s`, p.ulozeni.typ === 'kluzne' ? (k.pv > k.pvMez ? 'chyba-t' : 'ok-t') : '');
      h += box('Otáčky', `${fmt(mech.n, 0)} ot/min`, `při ${fmt(m.rychlost, 2)} m/s`);
    }
    const d = mech.drzak;
    if (d.otlaceni) h += box('Otlačení díry osy', `${fmt(d.otlaceni, 1)} MPa`, p.drzak.typ === 'uchyt' ? `v desce a náboji, mez ≈ ${fmt(d.pDov, 0)} MPa` : `v nohách vidlice, mez ≈ ${fmt(d.pDov, 0)} MPa`, d.otlaceni > d.pDov ? 'chyba-t' : 'ok-t');
    if (d.ohyb) h += box('Ohyb osy', `${fmt(d.ohyb, 0)} MPa`, `rameno ${fmt(d.rameno, 1)} mm, šroub 8.8 snese ~200 MPa`, d.ohyb > 200 ? 'chyba-t' : 'ok-t');
    else if (d.smyk) h += box('Smyk osy', `${fmt(d.smyk, 1)} MPa`, 'dvojstřižně ve vidlici – ocel bez potíží');
    h += box('Valivý odpor', `${fmt(mech.odpor.mu * 1000, 2)} ‰`, `odvalování ${fmt(mech.odpor.pomer * 1000, 2)} ‰ + uložení ${fmt(mech.odpor.muUl * 1000, 2)} ‰`);
    h += box('Síla na tlačení', `${fmt(mech.odpor.Fvoz, 1)} N`, `celý náklad po rovině (rozjezd zhruba 2×)`);
    $('vMech').innerHTML = h;
    $('tabMech').innerHTML = '';
    const vzorec = c.typ === 'čárový' ? 'čárový styk válce s rovinou' : 'bodový styk (přiblížení kruhovým stykem)';
    $('napMech').innerHTML = `<span>Hertzův tlak: ${vzorec}, E kola ${fmt(c.mat.E, 0)} MPa, podložka ${esc(mech.podlozka.nazev)} ${fmt(mech.podlozka.E, 0)} MPa.</span> `
      + `<span>Valivý odpor podle hystereze materiálu (Tabor), ložisko μ ≈ 0,003.</span> <span>Materiálové meze jsou orientační, stav ${KOLA_MECH.AKTUALIZACE} – tištěný díl se liší podle výplně, teploty a vlhkosti; pod trvalým zatížením plast pomalu teče.</span>`;
  }
  function vypisTisk() {
    const t = mech.tisk, mat = KOLA.MATERIALY[p.tisk.material];
    let h = box('Doporučené stěny', `${t.steny} perimetrů`, `využití nejvíc namáhaného místa ${fmt(t.vyuziti * 100, 0)} %`, t.vyuziti > 1 ? 'chyba-t' : '');
    h += box('Doporučená výplň', `${t.vypln} %`, t.vypln >= 100 ? 'plné kolo – velký tlak na běhoun' : 'gyroid / kubická');
    h += box('Kolo', o.tiskKolo, o.mostky.length ? `${KOLA.NAZVY.mostek[p.tisk.mostek]}, vrstva ${fmt(p.tisk.vrstva, 2)} mm` : 'bez stropů nad kapsami');
    if (p.kolo.profil === 'tpu') h += box('Běhoun', 'TPU 95A', 'tisknout zvlášť, pomalu (20–30 mm/s), 100 % výplň');
    h += box('Materiál', mat.nazev, p.tisk.material === 'PLA' ? 'pod zátěží teče – lépe PETG / PC' : 'vhodný na kolečka');
    $('vTisk').innerHTML = h;
  }

  /* ---------- kusovník ---------- */
  function polozky() {
    if (!model) return [];
    const n = p.tisk.kusu, out = [], k = p.kolo, dz = p.drzak, S = o.Ms;
    const tisk = (d, ks) => out.push({ nazev: d.nazev, ks: ks * n, pozn: d.material === 'TPU' ? 'TPU 95A' : KOLA.MATERIALY[p.tisk.material].nazev, d, druh: 'tisk' });
    const nakup = (nazev, ks, pozn = '') => out.push({ nazev, ks: ks * n, pozn, druh: 'nakup' });
    for (const d of model.dily) tisk(d, 1);
    if (o.L) nakup(`Ložisko ${o.L.o}-2RS (${fmt(o.L.d)} × ${fmt(o.L.D)} × ${fmt(o.L.B)})`, o.pocet, 'nebo ZZ');
    if (p.ulozeni.typ !== 'hridel') {
      const osa = S ? `Šroub ${o.M} × ${o.lSroubu} ISO 4762 / 4017 (osa)` : `Osa / čep Ø ${fmt(o.osa)} × ${fmt(Math.ceil(o.lOsy))}`;
      nakup(osa, 1, dz.typ === 'zadny' ? 'délku upravte podle stroje' : '');
      if (S) nakup(`Matice samojistná ${o.M} ISO 7040`, 1, dz.typ === 'uchyt' && dz.matice ? 'nebo běžná v kapse' : '');
      if (S && dz.typ !== 'uchyt') nakup(`Podložka ${o.M} ISO 7089`, 2);
    }
    if (dz.typ === 'otocna') {
      const C = o.cep, l = KOLA.delkaSroubu(dz.deska + C.tp + o.tTal + C.mn + 1.5);
      nakup(`Šroub zápustný ${dz.cep} × ${l} ISO 10642 (čep)`, 1);
      nakup(`Matice samojistná ${dz.cep} ISO 7040`, 1);
      nakup(`Podložka velká ${dz.cep} ISO 7093 (Ø ${fmt(C.Dp)})`, 1, 'mezi desku a talíř, namazat');
    }
    if ((dz.typ === 'vidlice' || dz.typ === 'otocna') && dz.dira > 0) nakup(`Vrut / šroub Ø ${fmt(Math.max(2, dz.dira - 0.5), 1)}`, 4, 'do nábytku / vozíku');
    if (dz.typ === 'uchyt' && dz.der > 0) nakup(`Vrut ${dz.zapustne ? 'se zápustnou hlavou' : ''} Ø ${fmt(Math.max(2, dz.dira - 0.5), 1)}`.replace('  ', ' '), dz.der);
    if (o.deleni === 'pulky' && o.spoj === 'srouby') {
      const Sp = o.spojS, l = Math.max(...[6, 8, 10, 12, 16, 20, 25, 30].filter(x => x <= k.sirka - Sp.k - 0.2), 6);
      nakup(`Šroub ${k.sroub} × ${l} ISO 4762 + matice (spoj polovin)`, k.sroubu);
    }
    if (o.deleni === 'pulky' && o.spoj === 'lepeni') nakup('Kolík z filamentu 1,75 × 7 mm + lepidlo', 3);
    if (k.profil === 'oring') { const r = KOLA.okrouzek(p, o); nakup(r.krouzek ? `O-kroužek ${r.krouzek.oznaceni}` : `O-kroužek Ø ${fmt(r.d1Idealni, 1)} × ${fmt(k.oring, 2)}`, k.oringu, 'NBR 70'); }
    return out;
  }
  function vypisKusovnik() {
    const r = polozky();
    if (!r.length) { $('kusovnik').innerHTML = '<p class="napoveda">Kusovník se ukáže po sestavení modelu.</p>'; return; }
    $('kusovnik').innerHTML = `<table class="tabulka"><thead><tr><th>Položka</th><th class="c">Kusů</th><th class="c">Rozměr</th><th>Pozn.</th></tr></thead><tbody>`
      + r.map(x => {
        let roz = '';
        if (x.d) { const b = G3D.obal(x.d.poz); roz = `${fmt(b[3] - b[0], 1)} × ${fmt(b[4] - b[1], 1)} × ${fmt(b[5] - b[2], 1)}`; }
        return `<tr class="${x.druh}"><td>${esc(x.nazev)}</td><td class="c">${x.ks}</td><td class="c">${roz}</td><td>${esc(x.pozn)}</td></tr>`;
      }).join('') + '</tbody></table><p class="napoveda">' + (p.tisk.kusu > 1 ? `🖨 = tištěný díl, 🛒 = nakupovaný díl. Počty pro ${p.tisk.kusu} komplety.` : '🖨 = tištěný díl, 🛒 = nakupovaný díl. Počty pro jeden komplet.') + '</p>';
  }

  /* ---------- náhled ---------- */
  function zobraz(novyPohled) {
    document.querySelectorAll('[data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === stavZobr.rezim)));
    if (!model) { nahled.nastav(null); return; }
    const r = stavZobr.rezim;
    if (r === 'tisk') nahled.nastav(G3D.tiskoveRozlozeni(model.dily, p.tisk.kusu, 6, 200), { tisk: true, novyPohled, uhel: p.tisk.uhel });
    else if (r === 'kalibrace') nahled.nastav(G3D.tiskoveRozlozeni(model.kalibrace, 1), { tisk: true, novyPohled, uhel: p.tisk.uhel });
    else if (r === 'kolo') nahled.nastav(model.sestava.filter(d => /^kolo|behoun/.test(d.jmeno)), { novyPohled });
    else nahled.nastav(model.sestava, { novyPohled });
    $('legPrevisy').hidden = !((r === 'tisk' || r === 'kalibrace') && nahled.stav.previsy);
  }
  function nastavRezim(r) {
    const tisk = $('tTisk').getAttribute('aria-pressed') === 'true', pred = stavZobr.rezim;
    stavZobr.rezim = r;
    if ((r === 'tisk') !== tisk) { $('tTisk').click(); return; }
    if (r === 'kalibrace' && model && !model.kalibrace.length) { prepocitej(); return; }
    zobraz(pred !== r);
    if (model) vypisVysledky();
  }
  document.querySelectorAll('[data-rezim]').forEach(b => b.addEventListener('click', () => nastavRezim(b.dataset.rezim)));

  /* ---------- předvolby ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_kolecka_gui', pohled: j => nahled.pohled(j) });
  {
    let skup = '';
    for (const v of KOLA.PREDVOLBY) {
      if (v.skupina !== skup) { skup = v.skupina; const d = document.createElement('div'); d.className = 'nab-skupina'; d.textContent = skup; $('seznamPredvoleb').appendChild(d); }
      const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
      b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
      b.addEventListener('click', () => {
        const q = KOLA.predvolba(v.id);
        // tisk zůstává uživatelův (předvolba smí doporučit jen materiál), mechanika z předvolby, jinak uživatelova
        q.tisk = Object.assign(KOLA.kopie(app.p.tisk), v.p.tisk || {});
        if (!v.p.mech) q.mech = KOLA.kopie(app.p.mech);
        app.nahrad(q);
      });
      $('seznamPredvoleb').appendChild(b);
    }
  }

  /* ---------- export ---------- */
  function lzeExport() {
    if (!model) { Dialog.chyba(chybaStavby || 'Geometrické jádro se ještě načítá.'); return false; }
    return true;
  }
  const kusy = () => G3D.tiskoveRozlozeni(model.dily, app.p.tisk.kusu, 6, 200);
  function exportVse(co) {
    if (!lzeExport()) return;
    if (co === 'stl') app.stahni(KRAB.stlBinarni(kusy(), 'kolecka - github_site'), app.jmeno('.stl'), 'model/stl');
    else app.stahni(KRAB.soubor3mf(kusy(), app.p.nazev || 'Kolečko'), app.jmeno('.3mf'), 'model/3mf');
  }
  $('btnStl').addEventListener('click', () => exportVse('stl'));
  $('btn3mf').addEventListener('click', () => exportVse('3mf'));
  function exportDilu() {
    const el = $('exportDilu'); el.innerHTML = '';
    if (!model || model.dily.length < 2) return;
    for (const d of model.dily) {
      const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
      b.innerHTML = `⬇ STL – ${esc(d.nazev)}<span class="pozn">jen tento díl</span>`;
      b.addEventListener('click', () => app.stahni(KRAB.stlBinarni(G3D.tiskoveRozlozeni([d], app.p.tisk.kusu, 6, 200), 'kolecka - ' + d.jmeno), app.jmeno('_' + d.jmeno + '.stl'), 'model/stl'));
      el.appendChild(b);
    }
  }
  function exportKalibrace() {
    if (!lzeExport()) return;
    let kal = model.kalibrace;
    if (!kal.length) { try { kal = KOLA.postav(wasm, app.p, { kalibrace: true }).kalibrace; } catch (e) { Dialog.chyba('Kalibrační vzorek nelze sestavit: ' + (e && e.message || e)); return; } }
    app.stahni(KRAB.stlBinarni(G3D.tiskoveRozlozeni(kal, 1), 'kolecka - kalibrace'), app.jmeno('_kalibrace.stl'), 'model/stl');
  }
  $('btnKalibrace').addEventListener('click', exportKalibrace);
  $('btnKalibrace2').addEventListener('click', exportKalibrace);

  /* ---------- výkres ---------- */
  function vykresTed() {
    const d = new Date(), mat = KOLA.MATERIALY[app.p.tisk.material];
    const kus = polozky().map(x => [x.nazev, x.ks, x.druh === 'tisk' ? x.pozn : '']);
    const g = model ? model.dily.reduce((s, x) => s + x.objem * hustota(x) / 1000, 0) : 0;
    return KOLA_VYK.vykres(app.p, KOLA.odvozene(app.p), {
      datum: `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`, kusovnik: kus, hmotnost: g, material: mat.nazev,
      unosnost: mech ? `${fmt(mech.F, 0)} N, Hertz ${fmt(mech.kontakt.pmax, 0)} MPa` : '',
    });
  }
  function kresliVykres() { $('vykresNahled').innerHTML = KOLA_VYK.svg(vykresTed()); }
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
  async function vykresPdf() {
    try {
      if (!window.jspdf) throw new Error('Knihovna jsPDF se nenačetla.');
      const pismo = await nactiPismo();
      const doc = KOLA_VYK.pdf(window.jspdf.jsPDF, vykresTed(), { pismo, nazev: app.p.nazev || 'Kolečko' });
      app.stahni(doc.output('blob'), app.jmeno('_vykres.pdf'), 'application/pdf');
      if (!pismo) Dialog.info('Písmo se nepodařilo načíst – PDF je bez diakritiky.');
    } catch (e) { Dialog.chyba('PDF se nepodařilo vytvořit: ' + (e && e.message || e)); }
  }
  const vykresSvg = () => app.stahni(KOLA_VYK.svg(vykresTed()), app.jmeno('_vykres.svg'), 'image/svg+xml');
  $('btnVykresPdf').addEventListener('click', vykresPdf); $('btnVykresPdf2').addEventListener('click', vykresPdf);
  $('btnVykresSvg').addEventListener('click', vykresSvg); $('btnVykresSvg2').addEventListener('click', vykresSvg);
  $('btnVykresZobraz').addEventListener('click', () => { TrubkyGui.otevriZalozku('vykres'); kresliVykres(); });
  document.querySelector('[data-zalozka="vykres"]').addEventListener('click', () => setTimeout(kresliVykres, 0));

  app.prepinac('tRez', h => { nahled.prepni('rez', h); $('legRez').hidden = !h; });
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !(h && (stavZobr.rezim === 'tisk' || stavZobr.rezim === 'kalibrace')); }, true);
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);
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
  window.KOLA_UI = { get p() { return app.p; }, get model() { return model; }, zmen: app.zmen, nahrad: app.nahrad, prepocitej, nahled, app, nastavRezim, polozky };
})();
