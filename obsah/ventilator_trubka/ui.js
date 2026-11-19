/* Ventilátor → trubka – ovládání stránky nad společným zapojením gen3d/aplikace.js
   (tady jen to, co je pro přechody a mřížky zvláštní: viditelnost polí, souhrny, výsledky, proudění s grafem, kusovník,
   režimy náhledu, export po dílech, výkres). Náhled = KNOF_NAHLED. Režimy: sestava (s ventilátorem), tisk (díly na podložce). */
/* global VENTT, VENTT_VYK, KHAD, KNOF_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = VENTT.fmt;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let p, wasm = null, model = null, chybaStavby = '', chybaJadra = '';
  const stavZobr = { rezim: 'sestava', ventilator: true };
  const nahled = KNOF_NAHLED.vytvorNahled($('platno'), { drzPohled: true });

  const app = G3D.aplikace({
    typ: 'ventilator_trubka', nazev: 'Ventilátor → trubka', klic: 'webapp_ventilator_trubka', soubor: 'ventilator',
    normalizuj: VENTT.normalizuj, vychozi: () => VENTT.predvolba('p120h100'),
    ulozProjekt: VENTT.ulozProjekt, nactiProjekt: VENTT.nactiProjekt, popis: VENTT.popis,
    vezmi: VENTT.vezmi, poloz: VENTT.poloz,
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(),
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportVse('stl'),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(kusy(dilyKTisku()), app.p.nazev || 'Ventilátor'), pripona: '.3mf' } : null),
    zkratky: { r: 'tRez', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka', v: 'tVentilator' },
    zmenaTematu: () => prepocitej(),
    diry: true,
  });

  /* ---------- formulář ---------- */
  const seznam = a => (a || '').split(/\s+/).filter(Boolean);
  function viditelnost() {
    p = app.p;
    const mr = p.druh === 'mrizka' || p.deska.mrizka || p.mrizka.ochrana || (p.druh !== 'mrizka' && p.vystup.typ === 'limec');
    const sukne = (p.druh === 'mrizka' && p.mrizka.uchyceni === 'nasazovaci') || (p.druh !== 'mrizka' && p.vystup.typ === 'limec') || (p.mrizka.ochrana && p.mrizka.uchyceni === 'nasazovaci');
    const hodnoty = { druh: p.druh, vystup: p.vystup.typ, filtr: p.filtr.typ !== 'zadny' ? 'ano' : 'ne', filtrtyp: p.filtr.typ,
      mrizka: mr ? 'ano' : 'ne', sukne: sukne ? 'ano' : 'ne', vzor: p.mrizka.vzor, stojan: p.stojan.typ };
    const sel = Object.keys(hodnoty).map(k => `[data-${k}]`).join(',');
    document.querySelectorAll(sel).forEach(el => {
      el.hidden = !Object.keys(hodnoty).every(k => !el.dataset[k] || seznam(el.dataset[k]).includes(hodnoty[k]));
    });
    // ochranná mřížka i nasazovací: uchycení se volí i u ochrany
    const mu = $('f_mu').closest('.pole'); mu.hidden = !(p.druh === 'mrizka' || p.mrizka.ochrana);
    document.querySelectorAll('#predVent button').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.a) === p.vent.A && VENTT.VENTILATORY.some(v => v.A === p.vent.A && v.roztec === p.vent.roztec))));
    const t = VENTT.TRUBKY.find(x => x.spoj === p.vystup.typ && (x.spoj === 'na' ? x.od === p.vystup.od && x.id === p.vystup.id : x.id === p.vystup.id));
    $('f_trub').value = t ? t.kod : '';
    document.querySelectorAll('#seznamDruhu [data-druh-vol]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.druhVol === p.druh)));
    document.querySelectorAll('#paletaDruhu [data-druh-dl]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.druhDl === p.druh)));
    $('napDiryCep').textContent = p.diry === 'kruh' ? 'díry pro čepy jsou kruhové – strop převisá, tiskněte s podporami' : 'díry pro čepy jsou kapkovité';
  }
  $('f_material').innerHTML = Object.entries(VENTT.MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev}</option>`).join('');
  $('datumVent').textContent = VENTT.DATUM_VENT;
  for (const v of VENTT.VENTILATORY) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tl'; b.dataset.a = v.A; b.textContent = `${v.A}`;
    b.title = `${v.A} × ${v.A} × ${v.tl} mm, rozteč ${fmt(v.roztec, 1)}, díra Ø ${fmt(v.dira, 1)} – typické, ověřit`;
    b.addEventListener('click', () => { app.zmen(q => { Object.assign(q.vent, { A: v.A, roztec: v.roztec, dira: v.dira, tl: v.tl, otvor: v.otvor, roh: v.roh, sroub: v.sroub, Qmax: v.Qmax, pmax: v.pmax }); }); app.naplnFormular(); });
    $('predVent').appendChild(b);
  }
  const bv = document.createElement('span'); bv.className = 'pozn'; bv.textContent = 'mm – typické rozměry'; bv.style.cssText = 'font-size:.72rem;color:var(--text-muted);align-self:center';
  $('predVent').appendChild(bv);
  $('f_trub').innerHTML = '<option value="">– vlastní rozměr –</option>' + VENTT.TRUBKY.map(t => `<option value="${t.kod}" title="${t.spoj === 'na' ? 'OD ' + fmt(t.od, 1) : 'ID ' + fmt(t.id, 1)} mm">${esc(t.nazev)}</option>`).join('');
  $('f_trub').addEventListener('change', e => {
    const t = VENTT.TRUBKY.find(x => x.kod === e.target.value); if (!t) return;
    app.zmen(q => { q.vystup.typ = t.spoj; q.vystup.od = t.od; q.vystup.id = t.id; }); app.naplnFormular();
  });
  // klouby z Kloubové hadice (předvolby s kanálem)
  for (const pv of KHAD.PREDVOLBY) {
    const kl = KHAD.predvolba(pv.id).kloub;
    if (!(kl.kanal > 0) || document.querySelector(`#predKloub [data-k="${kl.koule}-${kl.kanal}"]`)) continue;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tl'; b.dataset.k = `${kl.koule}-${kl.kanal}`;
    b.textContent = `koule ${fmt(kl.koule)} / kanál ${fmt(kl.kanal)}`; b.title = 'Rozměry kloubu z předvolby Kloubové hadice: ' + pv.nazev;
    b.addEventListener('click', () => { app.zmen(q => { Object.assign(q.jamka, { koule: kl.koule, kanal: kl.kanal, presah: kl.presah, vule: kl.vule, stena: kl.stena, zkoseni: kl.zkoseni }); }); app.naplnFormular(); });
    $('predKloub').appendChild(b);
  }

  /* ---------- přepočet ---------- */
  function prepocitej() {
    p = app.p;
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    let H = VENTT.kontroly(p);
    model = null; chybaStavby = '';
    const o = VENTT.odvozene(p);
    const lzeStavet = !o.chyba && !H.some(h => h.uroven === 'chyba');
    if (wasm && lzeStavet) {
      try {
        model = VENTT.postav(wasm, p, { kalibrace: p.tisk.kalibrace });
        H = H.concat(VENTT.kontrolyModelu(p, model));
      } catch (e) { chybaStavby = 'Model nelze sestavit: ' + (e && e.message || e); }
    } else if (wasm) chybaStavby = 'Model nejde sestavit – opravte chyby v záložce Kontrola.';
    const st = $('stav3d');
    st.textContent = chybaJadra || (wasm ? chybaStavby : 'Načítám geometrické jádro…');
    st.classList.toggle('chyba', !!(chybaJadra || chybaStavby));
    app.hlaseni(H, { chybaStavby: chybaJadra || (lzeStavet ? chybaStavby : ''), boxy: ['boxVentilator', 'boxVystup'] });
    zobraz(false);
    vypisVysledky(o);
    vypisProudeni(o);
    vypisKusovnik(o);
    souhrny(o);
    exportDilu();
  }
  const veta = (el, vety) => $(el).replaceChildren(...vety.filter(Boolean).flatMap((t, i) => { const sp = document.createElement('span'); sp.textContent = t; return i ? [' ', sp] : [sp]; }));
  function souhrny(o) {
    const N = VENTT.NAZVY, v = p.vent;
    TrubkyGui.souhrn('sDruh', N.druh[p.druh], true);
    TrubkyGui.souhrn('sVent', `${fmt(v.A)} × ${fmt(v.tl)} · rozteč ${fmt(v.roztec, 1)}`, true);
    veta('napDruh', [p.druh === 'prechod' ? 'Deska se přišroubuje na ventilátor, přechod vede vzduch do trubky nebo hadice (nebo z ní).'
      : p.druh === 'mrizka' ? 'Mřížka chrání prsty i kabely před oběžným kolem. Na šrouby se dá na rám zvenku, nasazovací drží sukní přes rám.'
        : 'Ventilátor saje přes filtr: nahoře sání (mřížka, hadice nebo kloubová hadice), uprostřed zásuvka s filtrem, dole ventilátor fouká ven.']);
    veta('napVent', [`Otvor rámu Ø ${fmt(v.otvor)} mm, díry Ø ${fmt(v.dira, 1)} mm v rozteči ${fmt(v.roztec, 1)} mm.`, 'Velikosti v tlačítkách jsou typické (' + VENTT.DATUM_VENT + ') – ověřte posuvkou.']);
    if (p.druh === 'mrizka') {
      TrubkyGui.souhrn('sMrizka', `${N.vzor[p.mrizka.vzor]} · volno ${fmt(o.vzor.podil * 100, 0)} %`, true);
      veta('napMrizka', [`Volná plocha ${fmt(o.vzor.podil * 100, 0)} % (${fmt(o.vzor.otvor / 100, 1)} cm² z ${fmt(o.vzor.oblast / 100, 1)} cm²), světlost otvorů ≈ ${fmt(o.vzor.svetlost, 1)} mm.`]);
      return;
    }
    TrubkyGui.souhrn('sDeska', `${fmt(o.tp, 1)} mm · ${v.sroub} ${p.vent.upevneni === 'samorez' ? 'do plastu' : 's maticí'}`, true);
    veta('napDeska', [v.upevneni === 'samorez' ? `Šrouby ${v.sroub} × ${o.delkaSroubu} vedou skrz rám ventilátoru do pilotních děr Ø ${fmt(o.diraD, 1)} mm v desce.`
      : `Šrouby ${v.sroub} × ${o.delkaSroubu} skrz rám ventilátoru, matice v šestihranných kapsách v desce.`]);
    if (o.chyba) return;
    const t = p.vystup.typ;
    TrubkyGui.souhrn('sVystup', t === 'na' ? `trubka OD ${fmt(p.vystup.od)} dovnitř` : t === 'do' ? `do hadice ID ${fmt(p.vystup.id)}` : t === 'jamka' ? `jamka koule ${fmt(p.jamka.koule)}` : `límec ${fmt(p.vystup.limec)} mm`, true);
    veta('napVystup', [t === 'na' ? `Hrdlo Ø ${fmt(2 * o.h.ri, 2)} mm uvnitř (OD trubky + vůle), průchod Ø ${fmt(2 * o.h.rp, 1)} mm.`
      : t === 'do' ? `Hrdlo Ø ${fmt(2 * o.h.ro, 2)} mm zvenku (ID − vůle)${p.vystup.kuzel ? `, u ústí Ø ${fmt(2 * o.h.roU, 2)}` : ''}, průchod Ø ${fmt(2 * o.h.ri, 1)} mm.`
        : t === 'jamka' ? `Jamka Ø ${fmt(2 * o.kh.Rs, 2)} mm s hrdlem Ø ${fmt(2 * o.kh.rl, 2)} mm – jako článek Kloubové hadice (koule Ø ${fmt(p.jamka.koule)}).`
          : `Límec ${fmt(p.vystup.limec)} mm vysoký, víčko s mřížkou se nasune sukní ${fmt(p.mrizka.sukne)} mm.`]);
    if (t !== 'limec') {
      TrubkyGui.souhrn('sPrechod', `${fmt(o.L, 1)} mm · ${N.profil[p.prechod.profil]}`, true);
      veta('napPrechod', [`Nejkratší přechod bez podpor při ${fmt(p.tisk.uhel)}° je ${fmt(o.Lmin, 1)} mm${p.prechod.delka > 0 ? '' : ' (použit)'}.`, `Nejtenčí stěna ${fmt(o.stenaMin, 2)} mm.`]);
    }
    TrubkyGui.souhrn('sFiltr', o.filtr ? `${VENTT.FILTRY[p.filtr.typ].nazev} ${fmt(p.filtr.tl)} mm` : 'bez filtru', true);
    veta('napFiltr', [o.filtr ? `Filtr přistřihněte na ${fmt(o.filtrRozmer, 0)} × ${fmt(o.filtrRozmer, 0)} mm. Zásuvka se zasouvá z boku (strana +Y), kapsa je ${fmt(o.hk, 1)} mm vysoká.` : 'Bez filtru – přechod je dutý od desky po hrdlo.',
      o.filtr ? `Čelní plocha ${fmt(o.filtrPlocha / 100, 0)} cm².` : '']);
    const vz = p.deska.mrizka ? o.vzorD : o.vicko ? o.vzor : o.ochrana ? o.vzorO : null;
    if (vz) {
      TrubkyGui.souhrn('sMrizka', `${N.vzor[p.mrizka.vzor]} · volno ${fmt(vz.podil * 100, 0)} %`, true);
      veta('napMrizka', [`Volná plocha ${fmt(vz.podil * 100, 0)} %, světlost otvorů ≈ ${fmt(vz.svetlost, 1)} mm.`]);
    }
    if (o.stojan) {
      TrubkyGui.souhrn('sStojan', `čepy Ø ${fmt(p.stojan.cep)} · ${p.stojan.sroub}`, true);
      veta('napStojan', [`Osa čepů ${fmt(o.Hp, 0)} mm nad podložkou – skříň se otočí dokola. Šrouby ${p.stojan.sroub} × ${o.delkaSroubuStojanu} do slepých děr v čepech, utažením se nastaví tření.`]);
    } else if (p.druh === 'odsavac') TrubkyGui.souhrn('sStojan', 'bez stojánku', true);
  }

  /* ---------- náhled ---------- */
  function dilyKTisku() { return model ? model.dily.concat(p.tisk.kalibrace ? model.kalibrace : []) : []; }
  const kusy = dily => G3D.tiskoveRozlozeni(dily, 1, 8, Math.max(160, p.tisk.podlozka));
  function zobraz(novyPohled) {
    const r = stavZobr.rezim;
    document.querySelectorAll('.rezimy [data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === r)));
    if (!model) { nahled.nastav(null); return; }
    const b = G3D.obal(model.sestava[0].poz), vel = Math.hypot(b[3] - b[0], b[4] - b[1], b[5] - b[2]);
    if (!stavZobr.vel || Math.abs(vel - stavZobr.vel) / stavZobr.vel > 0.25 || stavZobr.druh !== p.druh) { novyPohled = true; stavZobr.vel = vel; stavZobr.druh = p.druh; }
    if (r === 'tisk') nahled.nastav(kusy(dilyKTisku()), { tisk: true, novyPohled, uhel: p.tisk.uhel });
    else {
      const dily = model.sestava.filter(d => stavZobr.ventilator || (d.jmeno !== 'ventilator' && d.jmeno !== 'filtr'));
      nahled.nastav(dily, { tisk: false, novyPohled, uhel: p.tisk.uhel });
    }
    $('legPrevisy').hidden = !(r === 'tisk' && nahled.stav.previsy);
  }
  function nastavRezim(r) {
    const tisk = $('tTisk').getAttribute('aria-pressed') === 'true';
    if ((r === 'tisk') !== tisk) { $('tTisk').click(); return; }
    stavZobr.rezim = r; zobraz(true);
  }
  document.querySelectorAll('.rezimy [data-rezim]').forEach(b => b.addEventListener('click', () => nastavRezim(b.dataset.rezim)));

  /* ---------- výsledky ---------- */
  const box = G3D.dlazdice;
  const cas = m => (m < 60 ? m + ' min' : fmt(m / 60, 1) + ' h');
  function vypisVysledky(o) {
    const el = $('vVysledky'), karta = $('karta3d');
    if (!model) { el.innerHTML = box('Model', wasm ? 'nelze sestavit' : 'načítám…', esc(chybaStavby)); karta.innerHTML = ''; $('vSit').innerHTML = ''; return; }
    const mat = VENTT.MATERIALY[p.tisk.material];
    const B = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const d of model.sestava) { if (d.jmeno === 'ventilator' || d.jmeno === 'filtr') continue; const b = G3D.obal(d.poz); for (let i = 0; i < 3; i++) { B[i] = Math.min(B[i], b[i]); B[i + 3] = Math.max(B[i + 3], b[i + 3]); } }
    const V = model.dily.reduce((s, d) => s + d.objem, 0);
    const od = G3D.odhadTisku(V, mat.hustota, { dilu: model.dily.length });
    let h = box('Rozměry sestavy', `${fmt(B[3] - B[0], 0)} × ${fmt(B[4] - B[1], 0)} × ${fmt(B[5] - B[2], 0)} mm`, 'š × h × v bez ventilátoru');
    if (p.druh === 'mrizka') h += box('Volná plocha', `${fmt(o.vzor.podil * 100, 0)} %`, `${fmt(o.vzor.otvor / 100, 1)} cm² · otvory ≈ ${fmt(o.vzor.svetlost, 1)} mm`);
    else if (o.L > 0) h += box('Přechod', `${fmt(o.L, 1)} mm`, `nejkratší bez podpor ${fmt(o.Lmin, 1)} mm · stěna ≥ ${fmt(o.stenaMin, 2)} mm`);
    h += box('Objem', `${fmt(V / 1000, 1)} cm³`, model.dily.map(d => `<span>${esc(d.nazev.toLowerCase())} ${fmt(d.objem / 1000, 1)}</span>`).join(' · '));
    h += box('Hmotnost', `${fmt(od.g, 0)} g`, `${mat.nazev}, plné díly`);
    h += box('Filament', `${fmt(od.metru, 1)} m`, 'Ø 1,75 mm, plné díly (při 25 % výplni méně)');
    h += box('Doba tisku', `≈ ${cas(od.minut)}`, `${model.dily.length} ${model.dily.length === 1 ? 'díl' : model.dily.length < 5 ? 'díly' : 'dílů'} · hrubý odhad`);
    const r = VENTT.proudeni(p, o);
    if (r) h += box('Pracovní bod', `${fmt(r.Q, 0)} m³/h`, `${fmt(r.dp, 0)} Pa · ${fmt(r.podil * 100, 0)} % průtoku naprázdno`);
    el.innerHTML = h;
    karta.innerHTML = `<div class="titul">${esc(VENTT.NAZVY.druh[p.druh])}</div><b>${fmt(B[3] - B[0], 0)} × ${fmt(B[4] - B[1], 0)} × ${fmt(B[5] - B[2], 0)}</b> mm · <b>${fmt(od.g, 0)}</b> g<br>`
      + `ventilátor ${fmt(p.vent.A)} mm${r ? ` · <b>${fmt(r.Q, 0)}</b> m³/h` : ''}`;
    $('vSit').innerHTML = model.dily.concat(model.kalibrace).map(d => { const k = KRAB.kontrolaSite(d.poz, d.idx); return box('Síť – ' + esc(d.nazev), k.uzavrena ? '✔ těsná' : '✖ netěsná', `${k.trojuhelniku} trojúhelníků, ${d.teles} těleso`, k.uzavrena && d.teles === 1 ? 'ok-t' : 'chyba-t'); }).join('')
      + box('Sestava', Object.values(model.prunik).every(x => x < 0.5) ? '✔ bez kolize' : '✖ díly se prolínají', `${model.cas} ms`, Object.values(model.prunik).every(x => x < 0.5) ? 'ok-t' : 'chyba-t');
  }
  const tlak = x => (x >= 1000 ? fmt(x / 1000, 2) + ' kPa' : fmt(x, x < 10 ? 1 : 0) + ' Pa');
  function vypisProudeni(o) {
    const r = VENTT.proudeni(p, o);
    if (!r) { $('vProud').innerHTML = ''; $('grafProud').innerHTML = ''; $('tabProud').innerHTML = ''; return; }
    let h = box('Pracovní bod', `${fmt(r.Q, 1)} m³/h`, `${fmt(r.podil * 100, 0)} % průtoku naprázdno`, r.podil < 0.25 ? 'mez-t' : 'ok-t');
    h += box('Tlak ventilátoru', tlak(r.dp), `max ${tlak(p.vent.pmax)}`);
    h += box('Rychlost v rámu', `${fmt(r.vFan, 2)} m/s`, `otvor Ø ${fmt(o.Df, 0)} mm`);
    if (r.vKanal) h += box('Rychlost v trubce', `${fmt(r.vKanal, 1)} m/s`, `Ø ${fmt(o.Dkanal, 1)} mm`, r.vKanal > 20 ? 'mez-t' : '');
    $('vProud').innerHTML = h;
    $('grafProud').innerHTML = graf(r);
    $('tabProud').innerHTML = '<tr><th>Část</th><th class="c">Ztráta</th><th>Poznámka</th></tr>'
      + r.polozky.map(x => `<tr><td>${esc(x.nazev)}</td><td class="c">${tlak(x.dp)}</td><td>${esc(x.pozn)}</td></tr>`).join('')
      + `<tr><td><b>Celkem při ${fmt(r.Q, 1)} m³/h</b></td><td class="c"><b>${tlak(r.celkem)}</b></td><td></td></tr>`;
  }
  /** Graf křivky ventilátoru a soustavy (SVG, barvy z proměnných). */
  function graf(r) {
    const W = 520, H = 230, L = 52, R = 14, T = 14, Bm = 36, k = r.krivky;
    const qM = p.vent.Qmax, pM = Math.max(p.vent.pmax * 1.1, 1);
    const X = q => L + (W - L - R) * q / qM, Y = d => T + (H - T - Bm) * (1 - Math.min(d, pM) / pM);
    const cara = key => k.filter(b => b[key] <= pM * 1.0001 || key === 'vent').map((b, i) => `${i ? 'L' : 'M'}${X(b.Q).toFixed(1)} ${Y(b[key]).toFixed(1)}`).join('');
    let s = `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Pracovní bod ventilátoru">`;
    for (let i = 0; i <= 4; i++) {
      const q = qM * i / 4, d = pM * i / 4;
      s += `<line class="mriz" x1="${X(q)}" y1="${T}" x2="${X(q)}" y2="${H - Bm}"/><text x="${X(q)}" y="${H - Bm + 14}" text-anchor="middle">${fmt(q, 0)}</text>`;
      s += `<line class="mriz" x1="${L}" y1="${Y(d)}" x2="${W - R}" y2="${Y(d)}"/><text x="${L - 5}" y="${Y(d) + 4}" text-anchor="end">${fmt(d, 0)}</text>`;
    }
    s += `<line class="osa-g" x1="${L}" y1="${H - Bm}" x2="${W - R}" y2="${H - Bm}"/><line class="osa-g" x1="${L}" y1="${T}" x2="${L}" y2="${H - Bm}"/>`;
    s += `<path class="k-vent" d="${cara('vent')}"/><path class="k-sous" d="${cara('soustava')}"/>`;
    s += `<circle class="bod" cx="${X(r.Q)}" cy="${Y(r.dp)}" r="5"/>`;
    s += `<text x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle">průtok (m³/h)</text><text x="12" y="${T + 4}">Pa</text>`;
    s += `<text class="leg-v" x="${W - R - 4}" y="${T + 12}" text-anchor="end">— ventilátor</text><text class="leg-s" x="${W - R - 4}" y="${T + 27}" text-anchor="end">— ztráty soustavy</text>`;
    return s + '</svg>';
  }
  function vypisKusovnik(o) {
    $('tabKusovnik').innerHTML = '<tr><th>Položka</th><th class="c">Množství</th><th>Poznámka</th></tr>'
      + VENTT.kusovnik(p, o, model).map(r => `<tr><td>${esc(r[0])}</td><td class="c">${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('');
  }

  /* ---------- nabídky, export ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_ventilator_trubka_gui', pohled: j => nahled.pohled(j) });
  const zvolDruh = k => { app.zmen(q => { q.druh = k; if (k === 'odsavac') q.vent.strana = 'sani'; }); app.naplnFormular(); };
  document.querySelectorAll('#paletaDruhu [data-druh-dl]').forEach(b => b.addEventListener('click', () => zvolDruh(b.dataset.druhDl)));
  for (const [k, n] of Object.entries(VENTT.NAZVY.druh)) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitemradio'); b.dataset.druhVol = k;
    b.textContent = n.charAt(0).toUpperCase() + n.slice(1);
    b.addEventListener('click', () => zvolDruh(k));
    $('seznamDruhu').appendChild(b);
  }
  for (const v of VENTT.PREDVOLBY) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
    b.addEventListener('click', () => { const q = VENTT.predvolba(v.id); q.tisk = VENTT.kopie(app.p.tisk); app.nahrad(q); });
    $('seznamPredvoleb').appendChild(b);
  }
  function lzeExport() {
    if (!model) { Dialog.chyba(chybaJadra || chybaStavby || 'Geometrické jádro se ještě načítá.'); return false; }
    return true;
  }
  function exportVse(druh) {
    if (!lzeExport()) return;
    const d = kusy(dilyKTisku());
    if (druh === 'stl') app.stahni(KRAB.stlBinarni(d, 'ventilator trubka - github_site'), app.jmeno('.stl'), 'model/stl');
    else app.stahni(KRAB.soubor3mf(d, app.p.nazev || 'Ventilátor'), app.jmeno('.3mf'), 'model/3mf');
  }
  $('btnStl').addEventListener('click', () => exportVse('stl'));
  $('btn3mf').addEventListener('click', () => exportVse('3mf'));
  function exportDilu() {
    const el = $('exportDilu'); el.innerHTML = '';
    if (!model) return;
    const polozky = model.dily.length > 1 ? model.dily.map(d => [d.nazev, () => [d], d.jmeno]) : [];
    polozky.push(['kalibrační vzorek', () => (p.tisk.kalibrace ? model.kalibrace : VENTT.postav(wasm, p, { kalibrace: true }).kalibrace), 'kalibrace']);
    for (const [nazev, dily, jm] of polozky) {
      const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
      b.innerHTML = `⬇ STL – ${esc(nazev.toLowerCase())}<span class="pozn">jen tento díl</span>`;
      b.addEventListener('click', () => { if (lzeExport()) app.stahni(KRAB.stlBinarni(kusy(dily()), 'ventilator trubka - ' + jm), app.jmeno('_' + jm + '.stl'), 'model/stl'); });
      el.appendChild(b);
    }
  }
  /* ---------- výkres ---------- */
  function svgVykresu() {
    if (!lzeExport()) return null;
    const o = VENTT.odvozene(app.p), d = new Date();
    return VENTT_VYK.sestavVykres(app.p, o, model, { datum: `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`, kusovnik: VENTT.kusovnik(app.p, o, model).map(r => [r[0], r[1]]) });
  }
  const ukazVykres = () => { const svg = svgVykresu(); if (!svg) return; $('vykresObsah').innerHTML = svg; $('vykresDlg').showModal(); };
  const stahniSvg = () => { const svg = svgVykresu(); if (svg) app.stahni(svg, app.jmeno('_vykres.svg'), 'image/svg+xml'); };
  function tiskVykresu() {
    const svg = svgVykresu(); if (!svg) return;
    const ram = document.createElement('iframe');
    ram.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(ram);
    const d = ram.contentDocument;
    d.open(); d.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(app.jmeno(''))}</title><style>@page{size:A4 landscape;margin:0}html,body{margin:0;padding:0}svg{display:block;width:297mm;height:210mm}</style></head><body>${svg}</body></html>`); d.close();
    setTimeout(() => { try { ram.contentWindow.focus(); ram.contentWindow.print(); } finally { setTimeout(() => ram.remove(), 60000); } }, 250);
  }
  $('btnVykres').addEventListener('click', ukazVykres);
  $('btnVykresSvg').addEventListener('click', stahniSvg); $('btnVykresSvgM').addEventListener('click', stahniSvg);
  $('btnVykresTisk').addEventListener('click', tiskVykresu); $('btnVykresTiskM').addEventListener('click', tiskVykresu);
  $('btnZavritVyk').addEventListener('click', () => $('vykresDlg').close());

  app.prepinac('tRez', h => { nahled.prepni('rez', h); $('legRez').hidden = !h; });
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !(h && stavZobr.rezim === 'tisk'); }, true);
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);
  app.prepinac('tVentilator', h => { stavZobr.ventilator = h; zobraz(false); }, true);
  app.prepinac('tTisk', h => {
    if (h) stavZobr.rezim = 'tisk';
    else if (stavZobr.rezim === 'tisk') stavZobr.rezim = 'sestava';
    zobraz(true);
  });

  /* ---------- start ---------- */
  app.start({
    manifold: {
      ok: w => { wasm = w; prepocitej(); },
      chyba: e => { chybaJadra = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – model ani export nejsou k dispozici.'; prepocitej(); },
    },
  });
  window.VENTT_UI = { get p() { return app.p; }, get model() { return model; }, zmen: app.zmen, nahrad: app.nahrad, prepocitej, nahled, app, nastavRezim };
})();
