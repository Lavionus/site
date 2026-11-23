/* Zarážky a aretace – ovládání stránky nad společným zapojením gen3d/aplikace.js
   (tady jen to, co je pro zarážky zvláštní: viditelnost polí, souhrny, výsledky, výpočty, kusovník, režimy náhledu,
   exporty po dílech, písmo pro ražený text, výkres a vrtací šablona). Náhled = KNOF_NAHLED. */
/* global ZARAZ, ZARAZ_VYK, KNOF_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = ZARAZ.fmt;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let p, wasm = null, model = null, chybaStavby = '', chybaJadra = '', mech = null;
  const stavZobr = { rezim: 'sestava', okoli: true };
  const nahled = KNOF_NAHLED.vytvorNahled($('platno'), { drzPohled: true });

  const app = G3D.aplikace({
    typ: 'zarazky_dveri', nazev: 'Zarážky a aretace', klic: 'webapp_zarazky_dveri', soubor: 'zarazka',
    normalizuj: ZARAZ.normalizuj, vychozi: () => ZARAZ.predvolba('klin'),
    ulozProjekt: ZARAZ.ulozProjekt, nactiProjekt: ZARAZ.nactiProjekt, popis: ZARAZ.popis,
    vezmi: ZARAZ.vezmi, poloz: ZARAZ.poloz,
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(),
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportVse('stl'),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(kusy(dilyKTisku()), app.p.nazev || 'Zarážka'), pripona: '.3mf' } : null),
    zkratky: { r: 'tRez', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka', o: 'tOkoli' },
    zmenaTematu: () => prepocitej(),
    diry: true,
  });
  document.querySelectorAll('#paletaDruhu [data-druh-dl]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.druhDl === app.p.druh) return;
    app.zmen(q => { q.druh = b.dataset.druhDl; if (q.druh !== 'klin' && q.tisk.material === 'TPU') q.tisk.material = 'PETG'; if (q.druh === 'klin' && q.tisk.material === 'PETG') q.tisk.material = 'TPU'; });
    app.naplnFormular();
  }));

  /* ---------- výběry ---------- */
  $('f_material').innerHTML = Object.entries(ZARAZ.MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev}</option>`).join('');
  $('f_vrut').innerHTML = Object.entries(ZARAZ.VRUTY).map(([k, v]) => `<option value="${k}">${fmt(v.d)} mm (hlava Ø ${fmt(v.hlava)})</option>`).join('');
  $('f_podk').innerHTML = Object.entries(ZARAZ.PODKLADY).map(([k, v]) => `<option value="${k}">${v.nazev}</option>`).join('');
  $('f_podlaha').innerHTML = Object.entries(ZARAZ.PODLAHY).map(([k, v]) => `<option value="${k}">${v.nazev}</option>`).join('');
  $('f_mrych').innerHTML += ZARAZ.MAGNETY.map(([d, h]) => `<option value="${d}x${h}">Ø ${d} × ${h} mm</option>`).join('');
  $('f_mrych').addEventListener('change', e => {
    const [d, h] = e.target.value.split('x').map(Number); if (!d) return;
    app.zmen(q => { q.magnet.magnetD = d; q.magnet.magnetH = h; if (q.magnet.podlozkaD < d) q.magnet.podlozkaD = d + 2; });
    app.naplnFormular();
  });

  const seznam = a => (a || '').split(/\s+/).filter(Boolean);
  function viditelnost() {
    p = app.p;
    const nn = p.druh === 'aretace' && p.aretace.typ === 'nabytek';
    document.querySelectorAll('[data-druh],[data-spodek],[data-oko],[data-tlum],[data-montaz],[data-vloz],[data-atyp],[data-nnar],[data-uch],[data-pk],[data-magsekce]').forEach(el => {
      const d = el.dataset;
      let vid = true;
      if (d.druh && !seznam(d.druh).includes(p.druh)) vid = false;
      if (d.spodek && d.spodek !== p.klin.spodek) vid = false;
      if (d.oko && !p.klin.oko) vid = false;
      if (d.tlum && d.tlum !== p.magnet.tlumeni) vid = false;
      if (d.montaz && d.montaz !== p.magnet.montaz) vid = false;
      if (d.vloz && d.vloz !== p.magnet.vlozeni) vid = false;
      if (d.atyp && d.atyp !== p.aretace.typ) vid = false;
      if (d.nnar && (!nn || d.nnar !== p.nabytek.narazy)) vid = false;
      if (d.uch && d.uch !== p.magnet.uchyceni) vid = false;
      if (d.pk && d.pk !== p.magnet.protikus) vid = false;
      if (d.magsekce && !(p.druh === 'magnet' || (nn && p.nabytek.narazy === 'magnet'))) vid = false;
      el.hidden = !vid;
    });
    // vruty nemá klín ani zarážka na pásce
    $('f_vrut').closest('details').hidden = p.druh === 'klin' || (p.druh === 'magnet' && p.magnet.uchyceni === 'paska');
    const mr = ZARAZ.MAGNETY.find(([d, h]) => d === p.magnet.magnetD && h === p.magnet.magnetH);
    $('f_mrych').value = mr ? `${mr[0]}x${mr[1]}` : '';
    document.querySelectorAll('#paletaDruhu [data-druh-dl]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.druhDl === p.druh)));
    $('napDruh').textContent = {
      klin: 'Klín se zasune pod dveře špičkou napřed. Z mezery pod dveřmi a sklonu vyjde délka; menší sklon méně klouže.',
      magnet: 'Sloupek s magnetem zastaví dveře a podrží je otevřené; protikus na dveřích nese ocelovou podložku nebo druhý magnet.',
      aretace: p.aretace.typ === 'hreben' ? 'Rameno se zářezy se otáčí na čepu na rámu a zapadne na kolík na křídle – každý zářez je jedna poloha pootevření.' : 'Úhelník do skříňky, o který se dvířka nebo šuplík zastaví – s kapsou na samolepicí nárazník nebo magnet.',
    }[p.druh];
    $('napSroub').textContent = p.sroub.hlava === 'zapustna' ? 'Díry mají zápustný kužel 90° podle hlav vrutů DIN 7997 / ISO 7050.' : 'Čočková hlava sedí na rovné ploše – díra je bez kuželu.';
    $('napTisk').innerHTML = {
      klin: 'Klín se tiskne <b>spodkem na podložce</b> – šikmá plocha nahoru, V-drážky mají boky 45°. Nejlépe drží <b>TPU</b> (20–30 mm/s, 2–3 perimetry, výplň 20–40 %).',
      magnet: 'Sloupek stojí <b>přírubou na podložce</b>, kapsa magnetu je nahoře; terčík leží zadní stranou dolů, úhelník jazykem dolů. TPU kroužek tiskněte zvlášť z pružného filamentu. <b>Kalibrace:</b> vzorek má 5 kapes s vůlí −2…+2 kroky (zářezy na hraně = pořadí) – vůli kapsy, do které magnet jde ztuha, ale celý, zapište do pole <i>Vůle na poloměr</i>.',
      aretace: 'Rameno se tiskne <b>naplocho</b>, patky <b>deskou dolů</b> s čepem nahoru – vše bez podpor. Doporučeno PETG nebo ASA (na slunci u okna ne PLA), 3–4 perimetry.',
    }[p.druh];
  }

  /* ---------- písmo pro ražený text (opentype.js + Liberation Sans Bold, OFL) ---------- */
  let pismo = null, pismoNacitam = null;
  function potrebujePismo() {
    if (pismo || app.p.druh !== 'klin' || !app.p.klin.text.trim()) return;
    if (pismoNacitam) return;
    pismoNacitam = (async () => {
      try {
        if (!window.opentype) await G3D.nactiSkript('lib/opentype.min.js');
        let buf = null;
        try { const r = await fetch('fonty/LiberationSans-Bold.ttf'); if (r.ok) buf = await r.arrayBuffer(); } catch (e) { buf = null; }
        if (!buf) {
          await G3D.nactiSkript('fonty/js/LiberationSans-Bold.ttf.js');
          const b = atob(window.FONTY_JS['LiberationSans-Bold.ttf']), u = new Uint8Array(b.length);
          for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
          buf = u.buffer;
        }
        pismo = window.opentype.parse(buf);
        prepocitej();
      } catch (e) { pismoNacitam = null; }
    })();
  }

  /* ---------- přepočet ---------- */
  function prepocitej() {
    p = app.p;
    potrebujePismo();
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    let H = ZARAZ.kontroly(p);
    model = null; chybaStavby = chybaJadra; mech = null;
    if (wasm) {
      try {
        model = ZARAZ.postav(wasm, p, { kalibrace: stavZobr.rezim === 'kalibrace' || p.tisk.kalibrace, pismo });
        H = H.concat(ZARAZ.kontrolyModelu(p, model));
      } catch (e) { chybaStavby = 'Model nelze sestavit: ' + (e && e.message || e); }
    }
    mech = ZARAZ.mechanika(p);
    const st = $('stav3d');
    st.textContent = wasm || chybaJadra ? chybaStavby : 'Načítám geometrické jádro…';
    st.classList.toggle('chyba', !!chybaStavby);
    zobraz(false);
    app.hlaseni(H, { chybaStavby, boxy: ['boxDil', 'boxMontaz'] });
    vypisVysledky();
    vypisVypocty();
    vypisKusovnik();
    souhrny();
    if (!$('vykresObsah').closest('[hidden]')) kresliVykres();
  }
  function souhrny() {
    const N = ZARAZ.NAZVY, o = model ? model.o : ZARAZ.odvozene(p);
    TrubkyGui.souhrn('sKlin', `${fmt(p.klin.hMin)}–${fmt(p.klin.hMax)} mm · ${fmt(p.klin.sklon, 1)}°`, true);
    TrubkyGui.souhrn('sSpodek', `${N.spodek[p.klin.spodek]} · ${ZARAZ.PODLAHY[p.klin.podlaha].nazev}`, true);
    TrubkyGui.souhrn('sOko', `${p.klin.oko ? 'očko' : 'bez očka'}${p.klin.text.trim() ? ` · „${p.klin.text.trim()}“` : ''}`, true);
    TrubkyGui.souhrn('sSloupek', `Ø ${fmt(p.magnet.prumer)} × ${fmt(p.magnet.vyska)} · ${p.magnet.montaz === 'stena' ? 'zeď' : 'podlaha'}`, true);
    TrubkyGui.souhrn('sKapsa', `Ø ${fmt(p.magnet.magnetD)} × ${fmt(p.magnet.magnetH)} ${p.magnet.trida}`, true);
    TrubkyGui.souhrn('sAretace', p.aretace.typ === 'hreben' ? `${ZARAZ.polohyHrebenu(p.aretace.polohy).length} polohy · kolík Ø ${fmt(p.aretace.kolikD)}` : N.narazy[p.nabytek.narazy], true);
    TrubkyGui.souhrn('sUch', N.uchyceni[p.magnet.uchyceni], true);
    TrubkyGui.souhrn('sSroub', `vrut ${fmt(p.sroub.vrut)} · ${N.hlava[p.sroub.hlava]}`, true);
    TrubkyGui.souhrn('sProtikus', N.protikus[p.magnet.protikus], true);
    if (o.klin) $('napKlin').textContent = `Délka klínu ${fmt(o.klin.L, 1)} mm, zadní hrana ${fmt(o.klin.hZad, 1)} mm. Dveře s mezerou ${fmt(p.klin.hMin)}–${fmt(p.klin.hMax)} mm se zaklíní ${fmt(o.klin.xMin, 0)}–${fmt(o.klin.xMax, 0)} mm od špičky.`;
    if (o.mag) {
      const r = o.mag;
      $('napSloupek').textContent = `Příruba Ø ${fmt(2 * r.Rp, 1)}${r.auto ? ' (automaticky)' : ''}${r.oring ? ` · O-kroužek ${fmt(r.oring.ID, 1)} × ${fmt(r.oring.d, 1)} mm` : ''}${r.tpu ? ` · kroužek vnitřní Ø ${fmt(2 * r.tpu.ri, 1)} (nasadit ztuha)` : ''}.`;
      $('napKapsa').textContent = p.magnet.vlozeni === 'pauza'
        ? `Kapsa Ø ${fmt(2 * r.rk, 2)} × ${fmt(r.hk, 2)} mm zakrytá ${fmt(r.krytiSkut, 2)} mm plastu. Pauza tisku před vrstvou ve výšce ${fmt(r.pauza, 2)} mm${r.pk.pauza ? `, u protikusu ${fmt(r.pk.pauza, 2)} mm` : ''}.`
        : `Kapsa Ø ${fmt(2 * r.rk, 2)} × ${fmt(r.hk, 2)} mm, otevřená – magnet se zalisuje po tisku (vůli ověřte kalibračním vzorkem).`;
      $('napProtikus').textContent = `Kapsa protikusu Ø ${fmt(2 * r.pk.rk, 2)} × ${fmt(r.pk.hk, 2)} mm · mezera magnet–protikus ${fmt(r.mezera, 1)} mm.`;
    }
    if (o.hreben) $('napAretace').textContent = `Rameno ${fmt(o.hreben.Lr, 0)} mm, zářezy ${o.hreben.xs.map(x => fmt(x, 0)).join(' / ')} mm od čepu, nad zářezem zbývá ${fmt(o.hreben.zbytek, 1)} mm.`;
    else if (o.nabytek) $('napAretace').textContent = `Úhelník ${fmt(o.nabytek.L, 0)} × ${fmt(o.nabytek.b, 0)} mm, výška ${fmt(o.nabytek.hw, 0)} mm, ${o.nabytek.diry.length} vruty.`;
    else $('napAretace').textContent = '';
  }
  const box = (a, b, c, d) => G3D.dlazdice(a, b, c, d);
  const dilu = n => `${n} ${n === 1 ? 'díl' : n < 5 ? 'díly' : 'dílů'}`;
  const trida = v => (v <= 0.7 ? 'ok-t' : v <= 1 ? 'mez-t' : 'chyba-t');
  function dilyKTisku() { return model ? model.dily.concat(p.tisk.kalibrace ? model.kalibrace : []) : []; }
  const rozmer = d => { const b = G3D.obal(d.poz); return `${fmt(b[3] - b[0], 1)} × ${fmt(b[4] - b[1], 1)} × ${fmt(b[5] - b[2], 1)}`; };
  function vypisVysledky() {
    const el = $('vVysledky'), karta = $('karta3d');
    if (!model) { el.innerHTML = box('Model', wasm || chybaJadra ? 'nelze sestavit' : 'načítám…', chybaStavby); karta.innerHTML = ''; $('vSit').innerHTML = ''; return; }
    const mat = ZARAZ.MATERIALY[p.tisk.material], o = model.o, dily = dilyKTisku();
    const tpu = ZARAZ.MATERIALY.TPU;
    const V = dily.reduce((s, d) => s + d.objem, 0) * p.tisk.sad;
    const g = dily.reduce((s, d) => s + d.objem / 1000 * (d.tpu ? tpu.hustota : mat.hustota), 0) * p.tisk.sad;
    const od = G3D.odhadTisku(V, mat.hustota, { dilu: dily.length * p.tisk.sad });
    let h = '', kartaTxt = '';
    if (o.klin) {
      const k = o.klin, m = mech.klin;
      h += box('Délka klínu', `${fmt(k.L, 1)} mm`, `zadní hrana ${fmt(k.hZad, 1)} mm, šířka ${fmt(k.b)} mm`);
      h += box('Zaklíní mezeru', `${fmt(p.klin.hMin)}–${fmt(p.klin.hMax)} mm`, `${fmt(k.xMin, 0)}–${fmt(k.xMax, 0)} mm od špičky`);
      h += box('Prokluz', `${fmt(p.klin.sklon, 1)}° / mez ${fmt(m.alfaMax, 1)}°`, `μ ≈ ${fmt(m.mu, 2)} (${ZARAZ.PODLAHY[p.klin.podlaha].nazev}) – orientačně`, trida(k.ta / m.mu));
      kartaTxt = `<b>${fmt(k.L, 0)}</b> mm · ${fmt(p.klin.sklon, 1)}°<br>mezera <b>${fmt(p.klin.hMin)}–${fmt(p.klin.hMax)}</b> mm`;
    } else if (o.mag) {
      const r = o.mag, m = mech.magnet;
      h += box('Přídržná síla', `≈ ${fmt(m.F, 1)} N`, `orientačně · přes ${fmt(r.mezera, 1)} mm (v dotyku ${fmt(m.F0, 0)} N)`, m.F >= 5 ? 'ok-t' : m.F >= 3 ? 'mez-t' : 'chyba-t');
      h += box('Udrží dveře', `do ${fmt(m.Fklika, 1)} N na klice`, `průvan do ≈ ${fmt(m.pruvan, 0)} Pa`);
      h += box('Náraz', `≈ ${fmt(m.Fnaraz, 0)} N`, `${fmt(p.dvere.rychlost, 1)} m/s na klice, stlačení ${fmt(m.delta, 1)} mm`);
      if (p.magnet.vlozeni === 'pauza') h += box('Pauza tisku', `Z = ${fmt(r.pauza, 2)} mm`, `${r.pk.pauza ? `protikus Z = ${fmt(r.pk.pauza, 2)} mm · ` : ''}vrstva ${fmt(p.tisk.vrstva, 2)} mm`);
      kartaTxt = `magnet <b>Ø ${fmt(p.magnet.magnetD)} × ${fmt(p.magnet.magnetH)}</b><br>≈ <b>${fmt(m.F, 1)}</b> N přes ${fmt(r.mezera, 1)} mm`;
    } else if (o.hreben) {
      const r = o.hreben, m = mech.hreben;
      h += box('Polohy', r.pol.map(x => fmt(x)).join(' / ') + ' mm', `úhel křídla ${m.pol.map(x => fmt(x.uhel, 0) + '°').join(' / ')}`);
      h += box('Rameno', `${fmt(r.Lr, 0)} × ${fmt(r.hb)} × ${fmt(r.tr)} mm`, `čep Ø ${fmt(p.aretace.cepD)}, kolík Ø ${fmt(p.aretace.kolikD)}`);
      h += box('Síla na kolík', `${fmt(m.F, 0)} N`, `vítr ${fmt(p.aretace.vitr)} m/s · orientačně`, trida(m.sigK / m.dovK));
      kartaTxt = `<b>${r.pol.length}</b> polohy · rameno <b>${fmt(r.Lr, 0)}</b> mm`;
    } else {
      const r = o.nabytek, m = mech.nabytek;
      h += box('Doraz', `${fmt(r.L, 0)} × ${fmt(r.b, 0)} × ${fmt(r.hw, 0)} mm`, `stěna ${fmt(r.tw, 1)} mm, ${r.diry.length} vruty`);
      h += box('Náraz', `≈ ${fmt(m.F, 0)} N`, `ohyb stěny ${fmt(m.sigma, 1)} / ${fmt(m.dov, 1)} MPa`, trida(m.vyuziti));
      if (m.magnet) h += box('Magnet drží', `≈ ${fmt(m.magnet.F, 1)} N`, 'proti plíšku 0,8 mm, orientačně');
      kartaTxt = `doraz <b>${fmt(r.hw, 0)}</b> mm · ${ZARAZ.NAZVY.narazy[p.nabytek.narazy]}`;
    }
    h += box('Objem', `${fmt(V / 1000, 1)} cm³`, p.tisk.sad > 1 ? `${p.tisk.sad} sady` : dilu(dily.length));
    h += box('Hmotnost', `${fmt(g, g < 10 ? 1 : 0)} g`, `${mat.nazev}${model.dily.some(d => d.tpu) ? ' + TPU' : ''}, plné díly`);
    h += box('Filament', `${fmt(od.metru, 1)} m`, 'průměr 1,75 mm');
    h += box('Doba tisku', `≈ ${od.minut < 60 ? od.minut + ' min' : fmt(od.minut / 60, 1) + ' h'}`, `${dilu(dily.length * p.tisk.sad)} · hrubý odhad`);
    if (mech.uchyceni) h += box('Uchycení', `${fmt(mech.uchyceni.vyuziti * 100, 0)} %`, `využití: ${mech.uchyceni.coNese.toLowerCase()}`, trida(mech.uchyceni.vyuziti));
    el.innerHTML = h;
    const titul = { sestava: 'Sestava', tisk: 'Díly k tisku', kalibrace: 'Kalibrační vzorek' }[stavZobr.rezim];
    karta.innerHTML = `<div class="titul">${titul}</div>${kartaTxt}<br><b>${fmt(g, 0)}</b> g ${mat.nazev}`;
    const kont = model.dily.concat(model.kalibrace).map(d => ({ d, k: KRAB.kontrolaSite(d.poz, d.idx) }));
    $('vSit').innerHTML = kont.map(({ d, k }) => box('Síť – ' + d.nazev, k.uzavrena && d.teles === 1 ? '✔ těsná' : '✖ netěsná', `${k.trojuhelniku} trojúhelníků, ${d.teles === 1 ? '1 těleso' : d.teles + ' tělesa'}`, k.uzavrena && d.teles === 1 ? 'ok-t' : 'chyba-t')).join('')
      + box('Stavba', `${model.cas} ms`, 'manifold-3d');
  }

  /* ---------- výpočty ---------- */
  function vypisVypocty() {
    const m = mech, o = model ? model.o : ZARAZ.odvozene(p), t = $('tabVypocty');
    let h = '', tab = '', nap = '';
    if (m.klin) {
      const k = m.klin;
      h += box('Sklon klínu', `${fmt(p.klin.sklon, 1)}°`, `tg α = ${fmt(o.klin.ta, 3)}`);
      h += box('Tření o podlahu', `μ ≈ ${fmt(k.mu, 2)}`, `${{ tvrdy: 'tvrdý plast', tpu: 'TPU', pryz: 'pryžové nožičky' }[k.druhSpodku]} – orientačně`);
      h += box('Mez prokluzu', `${fmt(k.alfaMax, 1)}°`, `doporučeno do ${fmt(Math.atan(0.7 * k.mu) * 180 / Math.PI, 1)}° (rezerva 1,4×)`, trida(o.klin.ta / k.mu));
      h += box('Rezerva tření', `${fmt(k.rezerva, 2)}×`, 'μ / tg α – nad 1,4 drží spolehlivě', k.rezerva >= 1.4 ? 'ok-t' : k.rezerva >= 1 ? 'mez-t' : 'chyba-t');
      tab = `<thead><tr><th>Podlaha</th><th class="c">μ</th><th class="c">Mez sklonu</th><th class="c">Při ${fmt(p.klin.sklon, 1)}°</th></tr></thead><tbody>`
        + k.tabulka.map(r => `<tr${r.id === p.klin.podlaha ? ' class="vybrano"' : ''}><td>${esc(r.nazev)}</td><td class="c">${fmt(r.mu, 2)}</td><td class="c">${fmt(r.alfaMax, 1)}°</td><td class="c ${trida(o.klin.ta / r.mu)}">${o.klin.ta <= 0.7 * r.mu ? 'drží' : o.klin.ta <= r.mu ? 'na mezi' : 'klouže'}</td></tr>`).join('') + '</tbody>';
      nap = '<b>Klín:</b> hrana dveří tlačí kolmo na šikmou plochu; vodorovná složka síly je tg α krát svislá. Klín drží, dokud tg α ≤ μ (součinitel tření spodku o podlahu) – nezávisle na síle, kterou dveře tlačí. Tření hrany dveří o klín a vlastní tíha se zanedbávají. Prach, vlhko a vosk μ snižují.';
    } else if (m.magnet) {
      const g = m.magnet, r = o.mag;
      h += box('Síla v dotyku', `${fmt(g.F0, 1)} N`, `${p.magnet.trida} Ø ${fmt(p.magnet.magnetD)} × ${fmt(p.magnet.magnetH)} na silné oceli`);
      h += box('Přes mezeru', `${fmt(g.F, 1)} N`, `mezera ${fmt(r.mezera, 2)} mm = plast + tlumení + vzduch (${fmt(g.pomer * 100, 0)} % pole)`, g.F >= 5 ? 'ok-t' : g.F >= 3 ? 'mez-t' : 'chyba-t');
      h += box('Přídržný moment', `${fmt(g.Mdrz, 2)} N·m`, `zarážka ${fmt(p.dvere.poloha)} mm od pantu`);
      h += box('Síla na klice', `${fmt(g.Fklika, 1)} N`, 'tolik je potřeba k odtržení dveří');
      h += box('Průvan', `do ${fmt(g.pruvan, 0)} Pa`, `rovnoměrný tlak na křídlo ${fmt(p.dvere.sirka)} × ${fmt(p.dvere.vyska)} mm`);
      h += box('Energie nárazu', `${fmt(g.E, 2)} J`, `${fmt(p.dvere.hmotnost)} kg, ${fmt(p.dvere.rychlost, 1)} m/s na klice`);
      h += box('Síla nárazu', `≈ ${fmt(g.Fnaraz, 0)} N`, `stlačení ${fmt(g.delta, 1)} mm (tlumení + pružnost)`);
      if (m.uchyceni) h += box(m.uchyceni.coNese, `${fmt(m.uchyceni.potreba, 0)} / ${fmt(m.uchyceni.kapacita, 0)} N`, `využití ${fmt(m.uchyceni.vyuziti * 100, 0)} %`, trida(m.uchyceni.vyuziti));
      if (m.sloupek) h += box('Ohyb sloupku', `${fmt(m.sloupek.sigma, 1)} MPa`, `dovoleno ${fmt(m.sloupek.dov, 1)} MPa (napříč vrstvami / 2)`, trida(m.sloupek.vyuziti));
      tab = '<thead><tr><th>Mezera</th>' + [0, 0.5, 1, 1.5, 2, 3].map(x => `<th class="c">${fmt(x, 1)} mm</th>`).join('') + '</tr></thead><tbody>'
        + [['Na ocel', false], ['Na magnet', true]].map(([nz, mm]) => `<tr><td>${nz}</td>` + [0, 0.5, 1, 1.5, 2, 3].map(x => `<td class="c">${fmt(ZARAZ.silaMagnetu(p.magnet.magnetD, p.magnet.magnetH, p.magnet.trida, x, mm, mm ? 0 : p.magnet.podlozkaT).F, 1)} N</td>`).join('') + '</tr>').join('') + '</tbody>';
      nap = '<b>Magnet:</b> síla v dotyku F ≈ K·A·h/√(h² + r²) (nafitováno na katalogy, ±30 %), přes mezeru klesá s kvadrátem pole na ose (ocel jako zrcadlo); tenká ocel (pod polovinu výšky magnetu) sílu úměrně sníží. <b>Náraz:</b> křídlo = deska otáčející se kolem pantu (I = m·š²/3), energie se pohltí stlačením δ – síla 2E/δ. Hrubý inženýrský odhad.';
    } else if (m.hreben) {
      const g = m.hreben;
      h += box('Tlak větru', `${fmt(g.q, 0)} Pa`, `${fmt(p.aretace.vitr)} m/s, q = ½ ρ v²`);
      h += box('Moment na pantech', `${fmt(g.M, 1)} N·m`, `křídlo ${fmt(p.aretace.kridloS)} × ${fmt(p.aretace.kridloV)} mm`);
      h += box('Síla na kolík', `${fmt(g.F, 0)} N`, `kolík ${fmt(p.aretace.odZavesu)} mm od pantů`);
      h += box('Ohyb kolíku', `${fmt(g.sigK, 1)} MPa`, `dovoleno ${fmt(g.dovK, 1)} MPa (tištěn nastojato)`, trida(g.sigK / g.dovK));
      h += box('Tah ramene', `${fmt(g.sigR, 1)} MPa`, `nad zářezem, dovoleno ${fmt(g.dovR, 1)} MPa`, trida(g.sigR / g.dovR));
      h += box(g.uchyceni.coNese, `${fmt(g.uchyceni.potreba, 0)} / ${fmt(g.uchyceni.kapacita, 0)} N`, `využití ${fmt(g.uchyceni.vyuziti * 100, 0)} %`, trida(g.uchyceni.vyuziti));
      tab = '<thead><tr><th>Zářez</th><th class="c">Pootevření</th><th class="c">Od čepu</th><th class="c">Úhel křídla</th></tr></thead><tbody>'
        + g.pol.map((x, i) => `<tr${i === o.hreben.nahled ? ' class="vybrano"' : ''}><td>${i + 1}.</td><td class="c">${fmt(x.x)} mm</td><td class="c">${fmt(o.hreben.xs[i], 1)} mm</td><td class="c">${fmt(x.uhel, 1)}°</td></tr>`).join('') + '</tbody>';
      nap = '<b>Hřeben:</b> vítr tlačí na křídlo rovnoměrně, výslednice v polovině šířky; moment kolem pantů nese kolík ve vzdálenosti od pantů. Kolík je tištěný nastojato – ohyb namáhá spoje vrstev (poloviční pevnost, bezpečnost 2). Úhel křídla = 2·asin(pootevření / 2·vzdálenost kolíku od pantů).';
    } else {
      const g = m.nabytek;
      h += box('Energie nárazu', `${fmt(g.E * 1000, 0)} mJ`, `${fmt(p.nabytek.hmotnost, 1)} kg, ${fmt(p.nabytek.rychlost, 1)} m/s`);
      h += box('Síla nárazu', `≈ ${fmt(g.F, 0)} N`, `stlačení ${fmt(g.delta, 1)} mm`);
      h += box('Ohyb stěny', `${fmt(g.sigma, 1)} MPa`, `dovoleno ${fmt(g.dov, 1)} MPa (napříč vrstvami / 2)`, trida(g.vyuziti));
      if (g.magnet) h += box('Magnet drží', `≈ ${fmt(g.magnet.F, 1)} N`, 'proti plíšku 0,8 mm, mezera 0,3 mm');
      if (m.uchyceni) h += box(m.uchyceni.coNese, `${fmt(m.uchyceni.potreba, 0)} / ${fmt(m.uchyceni.kapacita, 0)} N`, `využití ${fmt(m.uchyceni.vyuziti * 100, 0)} %`, trida(m.uchyceni.vyuziti));
      nap = '<b>Doraz:</b> kinetická energie šuplíku nebo dvířek (účinná hmotnost) se pohltí stlačením nárazníku a pružností korpusu; síla 2E/δ ohýbá stěnu dorazu v patě (stěna tištěná nastojato – ohyb napříč vrstvami).';
    }
    $('vVypocty').innerHTML = h;
    t.innerHTML = tab;
    $('napVypocty').innerHTML = nap;
  }

  /* ---------- kusovník ---------- */
  function polozkyKusovniku() {
    const out = [], n = p.tisk.sad, o = model ? model.o : ZARAZ.odvozene(p), navic = [];
    if (model) for (const d of model.dily) out.push([d.nazev + (d.tpu ? ' – TPU' : ''), n, d]);
    if (model && p.tisk.kalibrace) for (const d of model.kalibrace) out.push([d.nazev, 1, d]);
    const v = ZARAZ.VRUTY[p.sroub.vrut], vrut = (ks, dl) => navic.push([`Vrut ${fmt(v.d)} × ${dl} mm, hlava ${p.sroub.hlava === 'zapustna' ? 'zápustná' : 'čočková'}`, ks * n]);
    if (o.klin) {
      if (o.klin.kapsy.length) navic.push([`Samolepicí pryžová nožička Ø ${fmt(p.klin.nozickaD)} mm, výška ≥ ${fmt(p.klin.nozickaH + 1, 1)} mm`, o.klin.kapsy.length * n]);
    } else if (o.mag) {
      const r = o.mag;
      navic.push([`Neodymový magnet ${p.magnet.trida} Ø ${fmt(p.magnet.magnetD)} × ${fmt(p.magnet.magnetH)} mm`, (r.pk.magnet ? 2 : 1) * n]);
      if (!r.pk.magnet) navic.push([`Ocelová podložka Ø ${fmt(p.magnet.podlozkaD)} × ${fmt(p.magnet.podlozkaT, 1)} mm (magnetická)`, n]);
      if (r.oring) navic.push([`O-kroužek ${fmt(r.oring.ID, 1)} × ${fmt(r.oring.d, 1)} mm (NBR)`, n]);
      if (r.diry.length) { vrut(r.diry.length, Math.ceil((r.tp + 25) / 5) * 5); if (p.sroub.podklad !== 'drevo') navic.push([`Hmoždinka Ø ${fmt(v.hmozdinka)} mm`, r.diry.length * n]); }
      if (r.pk.diry.length) vrut(r.pk.diry.length, Math.ceil(((r.pk.tl || r.pk.tpl) + 14) / 5) * 5);
      if (p.magnet.uchyceni === 'paska') navic.push([`Oboustranná montážní páska Ø ${fmt(2 * r.Rp, 0)} mm${p.magnet.montaz === 'stena' ? ' (+ pod terčík)' : ''}`, n]);
    } else if (o.hreben) {
      vrut(4, 16);
      navic.push(['Podložka M3 (pojistka ramene na čepu) + vrut 3 × 12', n]);
    } else {
      vrut(o.nabytek.diry.length, Math.max(12, Math.ceil((o.nabytek.tp + 10) / 2) * 2));
      if (p.nabytek.narazy === 'kapsa') navic.push([`Samolepicí nárazník Ø ${fmt(p.nabytek.narazD)} mm`, n]);
      if (p.nabytek.narazy === 'magnet') navic.push([`Neodymový magnet Ø ${fmt(p.magnet.magnetD)} × ${fmt(p.magnet.magnetH)} mm + ocelový plíšek na dvířka`, n]);
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
  const bezKalibrace = () => 'Kalibrační vzorek je jen pro lisovaný magnet (zarážka s otevřenou kapsou nebo magnetická západka nábytku).';
  function nastavRezim(r) {
    if (r === 'kalibrace' && !ZARAZ.maKalibraci(p)) { Dialog.info(bezKalibrace()); return; }
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
  TrubkyGui.pripoj({ klic: 'webapp_zarazky_dveri_gui', pohled: j => nahled.pohled(j) });
  let skupina = null;
  for (const v of ZARAZ.PREDVOLBY) {
    if (v.skupina !== skupina) {
      skupina = v.skupina;
      const nd = document.createElement('div'); nd.className = 'nab-skupina'; nd.textContent = ZARAZ.NAZVY.druh[skupina];
      $('seznamPredvoleb').appendChild(nd);
    }
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
    b.addEventListener('click', () => {
      const q = ZARAZ.predvolba(v.id), t = app.p.tisk;
      Object.assign(q.tisk, { vrstva: t.vrstva, uhel: t.uhel, podlozka: t.podlozka, krokKalibrace: t.krokKalibrace });
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
    if (druh === 'stl') app.stahni(KRAB.stlBinarni(kusy(dilyKTisku()), 'zarazky dveri - github_site'), app.jmeno('.stl'), 'model/stl');
    else app.stahni(KRAB.soubor3mf(kusy(dilyKTisku()), app.p.nazev || 'Zarážka'), app.jmeno('.3mf'), 'model/3mf');
  }
  $('btnStl').addEventListener('click', () => exportVse('stl'));
  $('btn3mf').addEventListener('click', () => exportVse('3mf'));
  $('btnZip').addEventListener('click', () => {
    if (!lzeExport()) return;
    const soubory = dilyKTisku().map(d => ({ name: app.jmeno('_' + G3D.jmenoSouboru(d.nazev, d.jmeno, '.stl')), data: KRAB.stlBinarni(G3D.tiskoveRozlozeni([d], app.p.tisk.sad, 5, app.p.tisk.podlozka), 'zarazky dveri - ' + d.jmeno) }));
    app.stahni(KRAB.zip(soubory), app.jmeno('_dily.zip'), 'application/zip');
  });
  $('btnKalStl').addEventListener('click', () => {
    if (!lzeExport()) return;
    if (!ZARAZ.maKalibraci(app.p)) { Dialog.info(bezKalibrace()); return; }
    let kal = model.kalibrace;
    if (!kal.length) { try { kal = ZARAZ.postav(wasm, app.p, { kalibrace: true, pismo }).kalibrace; } catch (e) { Dialog.chyba('Kalibrační vzorek nelze sestavit: ' + (e && e.message || e)); return; } }
    app.stahni(KRAB.stlBinarni(G3D.tiskoveRozlozeni(kal, 1, 5, 200), 'zarazky dveri - kalibrace'), app.jmeno('_kalibrace.stl'), 'model/stl');
  });

  /* ---------- výkres ---------- */
  function metaVykresu() {
    const d = new Date(), o = model.o, { out, navic } = polozkyKusovniku(), m = mech, N = ZARAZ.NAZVY;
    const radky = [['Druh', N.druh[p.druh]]];
    if (o.klin) radky.push(['Mezera pod dveřmi', `${fmt(p.klin.hMin)}–${fmt(p.klin.hMax)} mm`], ['Sklon / délka', `${fmt(p.klin.sklon, 1)}° / ${fmt(o.klin.L, 1)} mm`], ['Spodek', N.spodek[p.klin.spodek]], ['Mez prokluzu', `${fmt(m.klin.alfaMax, 1)}° (μ ≈ ${fmt(m.klin.mu, 2)})`]);
    else if (o.mag) {
      radky.push(['Montáž', N.montaz[p.magnet.montaz]], ['Magnet', `${p.magnet.trida} Ø ${fmt(p.magnet.magnetD)} × ${fmt(p.magnet.magnetH)} mm`], ['Kapsa', `Ø ${fmt(2 * o.mag.rk, 2)} × ${fmt(o.mag.hk, 2)} mm`], ['Vložení', N.vlozeni[p.magnet.vlozeni]]);
      if (p.magnet.vlozeni === 'pauza') radky.push(['Pauza tisku', `Z = ${fmt(o.mag.pauza, 2)} mm${o.mag.pk.pauza ? ` / protikus ${fmt(o.mag.pk.pauza, 2)} mm` : ''}`]);
      radky.push(['Přídržná síla (orientačně)', `≈ ${fmt(m.magnet.F, 1)} N`]);
    } else if (o.hreben) radky.push(['Polohy', o.hreben.pol.map(x => fmt(x)).join(' / ') + ' mm'], ['Zářezy od čepu', o.hreben.xs.map(x => fmt(x, 1)).join(' / ') + ' mm'], ['Kolík / čep', `Ø ${fmt(p.aretace.kolikD)} / Ø ${fmt(p.aretace.cepD)} mm`], ['Vůle zářezu', `${fmt(p.aretace.vule, 2)} mm`]);
    else radky.push(['Čelo', N.narazy[p.nabytek.narazy]], ['Rozměr', `${fmt(o.nabytek.L, 0)} × ${fmt(o.nabytek.b, 0)} × ${fmt(o.nabytek.hw, 0)} mm`]);
    radky.push(['Materiál', ZARAZ.MATERIALY[p.tisk.material].nazev]);
    const v = ZARAZ.VRUTY[p.sroub.vrut];
    return {
      datum: `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`, nazev: p.nazev, popis: ZARAZ.popis(p), radky,
      kusovnik: out.map(([a, b]) => [a, `${b} ks`]).concat(navic.map(([a, b]) => [a, `${b} ks`])),
      vrtak: p.druh === 'klin' ? '' : `Vruty ${fmt(v.d)} mm: do dřeva předvrtat Ø ${fmt(v.d * 0.6, 1)} mm, do zdi vrtat Ø ${fmt(v.hmozdinka)} mm pro hmoždinku.`,
    };
  }
  const vykresTed = () => ZARAZ_VYK.vykres(app.p, model, metaVykresu());
  function kresliVykres() {
    if (!model) { $('vykresObsah').innerHTML = `<p class="napoveda">${esc(chybaStavby || 'Model se ještě načítá.')}</p>`; return; }
    $('vykresObsah').innerHTML = ZARAZ_VYK.svg(vykresTed());
  }
  let pismoSlib = null;
  function nactiPismoPdf() {
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
      const pismoPdf = await nactiPismoPdf();
      const v = sablona ? ZARAZ_VYK.sablona(app.p, model, metaVykresu()) : vykresTed();
      if (sablona && !v.der) { Dialog.info('Tento díl se nepřišroubovává – vrtací šablona není potřeba.'); return; }
      const doc = ZARAZ_VYK.pdf(window.jspdf.jsPDF, v, { pismo: pismoPdf, nazev: app.p.nazev || 'Zarážka' });
      app.stahni(doc.output('blob'), app.jmeno(sablona ? '_sablona.pdf' : '_vykres.pdf'), 'application/pdf');
      if (!pismoPdf) Dialog.info('Písmo se nepodařilo načíst – PDF je bez diakritiky.');
    } catch (e) { Dialog.chyba('PDF se nepodařilo vytvořit: ' + (e && e.message || e)); }
  }
  const svgVykres = () => { if (lzeExport()) app.stahni(ZARAZ_VYK.svg(vykresTed()), app.jmeno('_vykres.svg'), 'image/svg+xml'); };
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
  window.ZARAZ_UI = { get p() { return app.p; }, get model() { return model; }, zmen: app.zmen, nahrad: app.nahrad, prepocitej, nahled, app, nastavRezim };
})();
