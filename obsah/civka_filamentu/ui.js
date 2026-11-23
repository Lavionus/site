/* Držák a adaptér cívky filamentu – ovládání stránky nad společným zapojením gen3d/aplikace.js
   (tady jen to, co je pro cívku zvláštní: druh dílu, databáze cívek, viditelnost polí, souhrny, výsledky, výpočty, kusovník, výkres, export).
   Náhled = KNOF_NAHLED. Režimy: sestava (s cívkou a ložisky), díly, tisk (díly na podložce), kalibrace. */
/* global CIVKA, CIVKA_MECH, CIVKA_VYK, KNOF_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = CIVKA.fmt, N = CIVKA.NAZVY;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let p, o = null, wasm = null, model = null, mech = null, chybaStavby = '', chybaJadra = '';
  const stavZobr = { rezim: 'sestava', kontext: true };
  const nahled = KNOF_NAHLED.vytvorNahled($('platno'));

  const app = G3D.aplikace({
    typ: 'civka_filamentu', nazev: 'Držák a adaptér cívky filamentu', klic: 'webapp_civka_filamentu', soubor: 'civka',
    normalizuj: CIVKA.normalizuj, vychozi: () => CIVKA.predvolba('redukce608'),
    ulozProjekt: CIVKA.ulozProjekt, nactiProjekt: CIVKA.nactiProjekt, popis: CIVKA.popis,
    vezmi: CIVKA.vezmi, poloz: CIVKA.poloz,
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(),
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportVse('stl'),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(kusy(), app.p.nazev || 'Cívka'), pripona: '.3mf' } : null),
    zkratky: { r: 'tRez', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka', c: 'tKontext' },
    diry: true,
    zmenaTematu: () => prepocitej(),
  });

  /* ---------- nabídky formuláře ---------- */
  const moznosti = (sel, obj) => { sel.innerHTML = Object.entries(obj).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join(''); };
  document.querySelectorAll('#paletaDruhu button').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.dlazdice === app.p.druh) return;
    app.zmen(q => {
      q.druh = b.dataset.dlazdice;
      // stojan a kladka potřebují ložisko; redukce je nejčastěji s 608
      if (q.druh === 'stojan' && ['623', '624', '625', '688'].includes(q.ulozeni.lozisko)) q.ulozeni.lozisko = '608';
    });
    app.naplnFormular();
  }));
  moznosti($('f_utyp'), N.ulozeni);
  moznosti($('f_rsev'), N.sevreni);
  moznosti($('f_ssp'), N.spoj);
  moznosti($('f_vt'), N.vtyp);
  moznosti($('f_vu'), N.uchyt);
  moznosti($('f_vs'), N.spojka);
  moznosti($('f_material'), Object.fromEntries(Object.entries(CIVKA.MATERIALY).map(([k, m]) => [k, m.nazev])));
  (() => {
    const L = CIVKA.LOZISKA, txt = l => `${l.o} – ${fmt(l.d)} × ${fmt(l.D)} × ${fmt(l.B)}`;
    let h = '<optgroup label="Nejčastější">' + CIVKA.CASTA.map(o2 => L.find(l => l.o === o2)).filter(Boolean).map(l => `<option value="${l.o}">${txt(l)}</option>`).join('') + '</optgroup>';
    const rady = {};
    for (const l of L) if (!CIVKA.CASTA.includes(l.o)) (rady[l.rada] = rady[l.rada] || []).push(l);
    const jm = { mini: 'Miniaturní 6xx', MR: 'Miniaturní MR', 618: 'Řada 618 (68xx)', 619: 'Řada 619 (69xx)', 160: 'Řada 160', 60: 'Řada 60', 62: 'Řada 62' };
    for (const [r, s] of Object.entries(rady)) h += `<optgroup label="${jm[r] || r}">` + s.map(l => `<option value="${l.o}">${txt(l)}</option>`).join('') + '</optgroup>';
    h += '<option value="vlastni">vlastní rozměry…</option>';
    $('f_loz').innerHTML = h;
  })();
  // databáze cívek – výběr jen vyplní rozměry (dál se dají měnit)
  $('selCivka').innerHTML = '<option value="">— vyberte typickou cívku —</option>' + CIVKA.CIVKY.map(c => `<option value="${c.id}">${esc(c.nazev)} (Ø ${fmt(c.prumer)} × ${fmt(c.sirka)})</option>`).join('');
  $('selCivka').addEventListener('change', e => {
    const c = CIVKA.CIVKY.find(x => x.id === e.target.value);
    e.target.value = '';
    if (c) { app.zmen(q => { for (const k of ['otvor', 'prumer', 'sirka', 'bok', 'hmotnost', 'tara']) q.civka[k] = c[k]; }); app.naplnFormular(); }
  });

  const seznam = a => (a || '').split(/\s+/).filter(Boolean);
  function viditelnost() {
    p = app.p;
    const od = CIVKA.odvozene(p), u = p.ulozeni, kladka = p.druh === 'vodidlo' && p.vodidlo.typ === 'kladka';
    const lozisko = p.druh === 'stojan' || (u.typ === 'lozisko' && (p.druh === 'redukce' || kladka));
    document.querySelectorAll('[data-druh],[data-nedruh],[data-lozisko],[data-vlastni],[data-trn],[data-osa],[data-sevreni],[data-dvoj],[data-nedvoj],[data-dute],[data-spoj],[data-vtyp],[data-uchyt],[data-dve]').forEach(el => {
      const d = el.dataset;
      let vid = true;
      if (d.druh && !seznam(d.druh).includes(p.druh)) vid = false;
      if (d.nedruh && seznam(d.nedruh).includes(p.druh)) vid = false;
      if (d.lozisko && !lozisko) vid = false;
      if (d.vlastni && !(lozisko && u.lozisko === 'vlastni')) vid = false;
      if (d.trn && (p.druh === 'stojan' || u.typ !== 'trn')) vid = false;
      if (d.osa && !(p.druh === 'stojan' || u.typ === 'trn')) vid = false;
      if (d.sevreni && !seznam(d.sevreni).includes(p.redukce.sevreni)) vid = false;
      if (d.dvoj && !p.redukce.dvoudilna) vid = false;
      if (d.nedvoj && p.redukce.dvoudilna) vid = false;
      if (d.dute && !od.dute) vid = false;
      if (d.spoj && !seznam(d.spoj).includes(p.stojan.spoj)) vid = false;
      if (d.vtyp && !seznam(d.vtyp).includes(p.vodidlo.typ)) vid = false;
      if (d.uchyt && !seznam(d.uchyt).includes(p.vodidlo.uchyt)) vid = false;
      if (d.dve && !(p.vodidlo.uchyt === 'deska' && p.vodidlo.der === 2)) vid = false;
      el.hidden = !vid;
    });
    document.querySelector('[data-oddil="ulozeni"]').hidden = p.druh === 'vodidlo' && !kladka;
    $('lVuleTrnu').textContent = p.druh === 'stojan' ? 'Vůle díry osy' : 'Vůle trnu';
    $('nadpisDilu').textContent = { redukce: 'Redukce', stojan: 'Stojan', vodidlo: 'Vodítko' }[p.druh];
    $('napCivka').textContent = `Rozměry cívek jsou typické (stav ${CIVKA.AKTUALIZACE}) – výrobci se liší, ověřte posuvkou.`;
    const L = od.L;
    $('napUlozeni').textContent = !L ? `Otvor Ø ${fmt(2 * (od.rb || od.rk || 0), 2)} na trn Ø ${fmt(u.trn)} – kluzně, víc brzdí (viz Výpočty).`
      : p.druh === 'stojan' ? `${L.o}: d ${fmt(L.d)} × D ${fmt(L.D)} × B ${fmt(L.B)} mm, osa ${od.M || 'Ø ' + fmt(L.d)}, díra Ø ${fmt(2 * od.rOsa, 2)}.`
        : p.druh === 'redukce' ? `${L.o}: d ${fmt(L.d)} × D ${fmt(L.D)} × B ${fmt(L.B)} mm. Kapsa Ø ${fmt(2 * od.rk, 2)} (strana příruby), osazení Ø ${fmt(2 * od.rl, 1)}.`
          : `${L.o}: d ${fmt(L.d)} × D ${fmt(L.D)} × B ${fmt(L.B)} mm. Kapsa Ø ${fmt(2 * od.rk, 2)}.`;
    if (p.druh === 'redukce') {
      const r = p.redukce;
      $('napRedukce').innerHTML = `<span>Redukce Ø ${fmt(2 * od.R, 2)} do otvoru ${fmt(p.civka.otvor)}, příruba Ø ${fmt(2 * od.Rp, 1)}.</span> ` + (od.dute ? `<span>Dutá s ${r.paprsku} paprsky.</span>` : '<span>Plná.</span>')
        + (r.dvoudilna ? ` <span>Výška dílu A ${fmt(od.HA, 1)} mm, dílu B ${fmt(od.HB, 1)} mm + trn ${fmt(r.prekryv, 1)} mm.</span>` : '');
    }
    if (p.druh === 'stojan') {
      $('napStojan').innerHTML = `<span>Ložiska po ${fmt(2 * od.e, 1)} mm ve výšce ${fmt(od.zl, 1)} mm.</span> <span>Cívka ${fmt(od.vuleStul, 1)} mm nad stolem.</span> `
        + (p.stojan.spoj === 'zamek' ? `<span>Nad lištou ${fmt(od.vuleLista, 1)} mm.</span> ` : `<span>Nad tyčí ${fmt(od.vuleLista, 1)} mm.</span> `)
        + (od.deleni ? `<span>Bočnice ${fmt(od.sirkaDesky, 0)} × ${fmt(od.vyskaDesky, 0)} mm ze dvou půlek.</span>` : `<span>Bočnice ${fmt(od.sirkaDesky, 0)} × ${fmt(od.vyskaDesky, 0)} mm.</span>`);
      $('napSpoj').innerHTML = p.stojan.spoj === 'zamek'
        ? (od.segmentu > 1 ? `<span>Lišta ${fmt(od.Lb, 1)} mm mezi bočnicemi z ${od.segmentu} dílů (podložka ${fmt(p.tisk.podlozkaX)} × ${fmt(p.tisk.podlozkaY)}).</span>` : `<span>Lišta ${fmt(od.Lb, 1)} mm mezi bočnicemi.</span>`) + ' <span>Rybina se do bočnice nasadí shora.</span>'
        : `<span>2× závitová tyč M8 × ${od.lTyc} mm s maticemi z obou stran každé bočnice.</span>`;
    }
    if (p.druh === 'vodidlo') {
      const v = p.vodidlo;
      $('napVodidlo').textContent = {
        ocko: `Očko Ø ${fmt(v.ocko, 1)} se sražením 45° z obou stran – filament nedře o hranu.`,
        ptfe: od.rS ? `Kapsa pro trubičku Ø ${fmt(2 * od.rPtfe, 2)}, předvrt spojky Ø ${fmt(2 * od.rS, 1)} (závit ${v.spojka}), průchod filamentu Ø ${fmt(2 * od.rFil, 2)}.` : `Kapsa pro trubičku Ø ${fmt(2 * od.rPtfe, 2)}, průchod filamentu Ø ${fmt(2 * od.rFil, 2)}.`,
        kladka: `Kladka Ø ${fmt(v.kladka)} s V drážkou (hloubka ${fmt(od.gv, 2)}) na šroubu Ø ${fmt(od.osa)}, tiskne se zvlášť naplocho.`,
      }[v.typ];
    }
  }

  /* ---------- přepočet ---------- */
  function prepocitej() {
    p = app.p;
    document.querySelectorAll('#paletaDruhu button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.dlazdice === p.druh)));
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    let H = CIVKA.kontroly(p);
    o = CIVKA.odvozene(p);
    model = null; chybaStavby = chybaJadra;
    const chyby = H.some(h => h.uroven === 'chyba');
    if (wasm && !chyby) {
      try {
        model = CIVKA.postav(wasm, p, { kalibrace: true });
        o = model.o;
        H = H.concat(CIVKA.kontrolyModelu(p, model));
      } catch (e) { chybaStavby = 'Model nelze sestavit: ' + (e && e.message || e); }
    } else if (wasm) chybaStavby = 'Model nelze sestavit – opravte chybu v záložce Kontrola.';
    mech = CIVKA_MECH.spocitej(p, o);
    H = H.concat(mech.hlaseni);
    const st = $('stav3d');
    st.textContent = wasm || chybaJadra ? chybaStavby : 'Načítám geometrické jádro…';
    st.classList.toggle('chyba', !!chybaStavby);
    zobraz(false);
    app.hlaseni(H, { chybaStavby, boxy: ['boxCivka', 'boxDil'] });
    souhrny();
    vypisVysledky();
    vypisMechaniku();
    vypisTisk();
    vypisKusovnik();
    exportDilu();
    if (!$('vykresNahled').closest('[hidden]')) kresliVykres();
  }
  function souhrny() {
    const c = p.civka, u = p.ulozeni, r = p.redukce, s = p.stojan, v = p.vodidlo;
    TrubkyGui.souhrn('sCivka', `Ø ${fmt(c.prumer)} × ${fmt(c.sirka)} · otvor ${fmt(c.otvor)}`, true);
    TrubkyGui.souhrn('sUlozeni', o.L ? `${o.L.o}` : `trn Ø ${fmt(u.trn)}`, true);
    TrubkyGui.souhrn('sRedukce', `Ø ${fmt(c.otvor - r.vule, 1)}${r.dvoudilna ? '' : ` × ${fmt(r.hloubka)}`} · ${r.dvoudilna ? 'A + B' : r.kusu + ' ks'}`, true);
    TrubkyGui.souhrn('sSevreni', N.sevreni[r.sevreni], r.sevreni !== 'hladke');
    TrubkyGui.souhrn('sDvoj', r.dvoudilna ? `překryv ${fmt(r.prekryv)}` : 'jednodílná', r.dvoudilna);
    TrubkyGui.souhrn('sStojan', `${fmt(s.uhel, 0)}° · ${s.civek}× cívka`, true);
    TrubkyGui.souhrn('sSpoj', s.spoj === 'zamek' ? (o.segmentu > 1 ? `lišty z ${o.segmentu} dílů` : 'lišty') : 'tyče M8', true);
    TrubkyGui.souhrn('sVodidlo', `${N.vtyp[v.typ]} · ${fmt(v.filament, 2)}`, true);
    TrubkyGui.souhrn('sUchyt', v.uchyt === 'profil' ? 'profil 2020' : `${v.der}× Ø ${fmt(v.dira, 1)}`, true);
  }
  const box = (a, b, c, d) => G3D.dlazdice(a, b, c, d);
  const tridaVyuziti = x => (x > 1 ? 'chyba-t' : x > 0.7 ? 'mez-t' : 'ok-t');
  function vypisVysledky() {
    const el = $('vVysledky'), karta = $('karta3d');
    if (!model) { el.innerHTML = box('Model', wasm || chybaJadra ? 'nelze sestavit' : 'načítám…', chybaStavby); karta.innerHTML = ''; $('vSit').innerHTML = ''; $('tabRozmery').innerHTML = ''; return; }
    const mat = CIVKA.MATERIALY[p.tisk.material], K = CIVKA.kusyTisku(model);
    const V = K.reduce((s, d) => s + d.objem, 0), g = V * mat.hustota / 1000;
    const od = G3D.odhadTisku(V, mat.hustota, { dilu: K.length });
    const dily = model.sestava.filter(d => !d.kontext);
    const B = dily.reduce((A, d) => { const q = G3D.obal(d.poz); for (let i = 0; i < 3; i++) { A[i] = Math.min(A[i], q[i]); A[i + 3] = Math.max(A[i + 3], q[i + 3]); } return A; }, [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
    const tah = mech[mech.aktivni];
    let h = '';
    if (p.druh === 'redukce') h += box('Redukce', `Ø ${fmt(2 * o.R, 2)} mm`, `do otvoru ${fmt(p.civka.otvor)} · příruba Ø ${fmt(2 * o.Rp, 1)}`);
    if (p.druh === 'stojan') {
      h += box('Stojan', `${fmt(B[3] - B[0], 0)} × ${fmt(B[4] - B[1], 0)} × ${fmt(o.vyskaDesky, 0)} mm`, `bez cívky · s cívkou výška ${fmt(o.zc + o.Rc, 0)} mm`);
      h += box('Cívka nad stolem', `${fmt(o.vuleStul, 1)} mm`, p.stojan.spoj === 'zamek' ? `nad lištou ${fmt(o.vuleLista, 1)} mm – nedře` : `nad tyčí ${fmt(o.vuleLista, 1)} mm – nedře`, o.vuleStul >= 1 && o.vuleLista >= 1 ? 'ok-t' : 'chyba-t');
    }
    if (p.druh === 'vodidlo') h += box('Vodítko', `${fmt(B[3] - B[0], 0)} × ${fmt(B[4] - B[1], 0)} × ${fmt(B[5] - B[2], 0)} mm`, `${N.vtyp[p.vodidlo.typ]} · osa ve výšce ${fmt(o.H, 1)} mm`);
    if (p.druh !== 'vodidlo') h += box('Tah filamentu', `${fmt(tah.prazdna, 2)} N`, `na konci cívky (plná ${fmt(tah.plna, 2)} N)`, tah.prazdna > CIVKA_MECH.MEZ_TAHU ? 'mez-t' : 'ok-t');
    h += box('Dílů k tisku', `${K.length}`, `typů dílů ${model.dily.length} · podložek ${CIVKA.podlozky(K, p).length}`);
    h += box('Objem', `${fmt(V / 1000, 1)} cm³`, 'všechny díly, plné');
    h += box('Hmotnost', `${fmt(g, g < 10 ? 1 : 0)} g`, mat.nazev);
    h += box('Filament', `${fmt(od.metru, 1)} m`, 'průměr 1,75 mm, plné díly');
    h += box('Doba tisku', `≈ ${od.minut < 60 ? od.minut + ' min' : fmt(od.minut / 60, 1) + ' h'}`, 'hrubý odhad');
    el.innerHTML = h;
    // lícované rozměry
    const r = [], u = p.ulozeni;
    if (p.druh === 'redukce') {
      r.push(['Plášť redukce', `Ø ${fmt(2 * o.R, 2)}`, `otvor ${fmt(p.civka.otvor)} − vůle ${fmt(p.redukce.vule, 2)}`]);
      if (o.sevreni === 'zebra') r.push(['Přes žebra', `Ø ${fmt(2 * (o.R + p.redukce.vyskaZebra), 2)}`, `${p.redukce.zeber} žeber – otlačí se`]);
      if (o.sevreni === 'pera' && !p.redukce.dvoudilna) r.push(['Přes výstupky per', `Ø ${fmt(2 * (o.R + p.redukce.presahPer), 2)}`, `${p.redukce.per} per`]);
      if (o.L) { r.push([`Kapsa ložiska ${o.L.o}`, `Ø ${fmt(2 * o.rk, 2)}`, `D ${fmt(o.L.D)} + vůle ${fmt(u.vule, 2)}, hloubka ${fmt(o.L.B)}`]); r.push(['Osazení', `Ø ${fmt(2 * o.rl, 1)}`, 'opírá vnější kroužek']); }
      else r.push(['Otvor na trn', `Ø ${fmt(2 * o.rb, 2)}`, `trn Ø ${fmt(u.trn)}, vůle ${fmt(u.vuleTrnu, 2)}`]);
      if (p.redukce.dvoudilna) r.push(['Spoj A/B', `Ø ${fmt(2 * o.rs, 2)}`, `paprsky B v plášti A Ø ${fmt(2 * o.rc, 2)}`]);
    } else if (p.druh === 'stojan') {
      r.push(['Díra osy ložiska', `Ø ${fmt(2 * o.rOsa, 2)}`, `osa ${o.M || 'Ø ' + fmt(o.L.d)}, vůle ${fmt(u.vuleTrnu, 2)}`]);
      r.push(['Rozteč ložisek', fmt(2 * o.e, 2), `úhel ${fmt(p.stojan.uhel, 0)}°, osa ve výšce ${fmt(o.zl, 2)}`]);
      r.push(['Rozteč bočnic', fmt(o.P, 2), `šířka cívky ${fmt(p.civka.sirka)} + 2 × ${fmt(p.stojan.mezera, 1)} + ${fmt(o.t)}`]);
      if (p.stojan.spoj === 'zamek') r.push(['Rybina lišty', `${fmt(o.wn, 1)} → ${fmt(o.we, 1)}`, `délka ${fmt(o.ld)}, vůle ${fmt(p.stojan.vuleZamku, 2)} na stranu`]);
    } else {
      const v = p.vodidlo;
      if (v.typ === 'ocko') r.push(['Očko', `Ø ${fmt(v.ocko, 2)}`, `filament ${fmt(v.filament, 2)}`]);
      if (v.typ === 'ptfe') { r.push(['Kapsa PTFE', `Ø ${fmt(2 * o.rPtfe, 2)}`, `trubička Ø ${fmt(v.ptfe)}, vůle ${fmt(v.vulePtfe, 2)}`]); if (o.rS) r.push(['Předvrt spojky', `Ø ${fmt(2 * o.rS, 1)}`, N.spojka[v.spojka]]); }
      if (v.typ === 'kladka') { r.push(['Kladka', `Ø ${fmt(v.kladka)}`, `V drážka ${fmt(o.gv, 2)}`]); if (o.L) r.push([`Kapsa ložiska ${o.L.o}`, `Ø ${fmt(2 * o.rk, 2)}`, `vůle ${fmt(u.vule, 2)}`]); r.push(['Díra osy', `Ø ${fmt(2 * o.rOsa, 2)}`, `šroub Ø ${fmt(o.osa)}`]); }
      r.push(['Díry úchytu', `Ø ${fmt(v.dira, 1)}`, p.diry === 'kruh' ? 'kruhové' : 'kapkovité (tisk na boku)']);
    }
    $('tabRozmery').innerHTML = '<tr><th>Lícovaný prvek</th><th class="c">Rozměr</th><th>Pozn.</th></tr>' + r.map(x => `<tr><td>${esc(x[0])}</td><td class="c">${x[1]}</td><td>${esc(x[2])}</td></tr>`).join('');
    const tit = { sestava: 'Sestava', dily: 'Díly', tisk: 'Díly k tisku', kalibrace: 'Kalibrační vzorek' }[stavZobr.rezim];
    karta.innerHTML = `<div class="titul">${tit}</div>` + (p.druh === 'redukce' ? `<b>Ø ${fmt(2 * o.R, 1)}</b> mm · ${o.L ? o.L.o : 'trn Ø ' + fmt(u.trn)}<br>${N.sevreni[p.redukce.sevreni]}`
      : p.druh === 'stojan' ? `<b>${o.loziska}× ${o.L.o}</b> · opora ${fmt(p.stojan.uhel, 0)}°<br>cívka <b>${fmt(o.vuleStul, 1)}</b> mm nad stolem`
        : `<b>${N.vtyp[p.vodidlo.typ]}</b><br>filament ${fmt(p.vodidlo.filament, 2)} mm`) + `<br>${fmt(g, 0)} g · ${K.length} dílů`;
    const kont = model.dily.concat(model.kalibrace).map(d => ({ d, k: KRAB.kontrolaSite(d.poz, d.idx) }));
    $('vSit').innerHTML = kont.map(({ d, k }) => box('Síť', k.uzavrena && d.teles === 1 ? '✔ těsná' : '✖ netěsná', `<span>${esc(d.nazev)}</span> · <span>${k.trojuhelniku} trojúhelníků</span>${d.teles === 1 ? '' : ` · <span>těles: ${d.teles}</span>`}`, k.uzavrena && d.teles === 1 ? 'ok-t' : 'chyba-t')).join('')
      + box('Stavba', `${model.cas} ms`, 'manifold-3d');
  }
  function vypisMechaniku() {
    const m = mech, f2 = x => fmt(x, x < 1 ? 3 : 2);
    let h = box('Hmotnost cívky', `${fmt(m.m, 2)} kg`, `filament ${fmt(p.civka.hmotnost, 2)} + prázdná ${fmt(p.civka.tara, 2)} kg = ${fmt(m.W, 1)} N`);
    const t = m[m.aktivni];
    h += box('Brzdný moment', `${f2(t.moment)} N·mm`, { kluzne: 'kluzně na trnu', lozisko: 'ložiska v redukcích', stojan: 'odvalování po 4 ložiskách' }[m.aktivni]);
    h += box('Tah – plná cívka', `${f2(t.plna)} N`, `≈ ${fmt(t.plna / 9.81 * 1000, 0)} g na filamentu (r ${fmt(o.rPlna, 0)} mm)`, t.plna > CIVKA_MECH.MEZ_TAHU ? 'mez-t' : 'ok-t');
    h += box('Tah – prázdná cívka', `${f2(t.prazdna)} N`, `≈ ${fmt(t.prazdna / 9.81 * 1000, 0)} g (r ${fmt(o.rPrazdna, 0)} mm)`, t.prazdna > CIVKA_MECH.MEZ_TAHU ? 'mez-t' : 'ok-t');
    if (p.druh === 'stojan' && m.stojan.sOsa !== undefined) {
      const s = m.stojan;
      h += box('Síla na ložisko', `${fmt(s.N, 1)} N`, `vodorovně ${fmt(s.Hs, 1)} N (roztahuje bočnici)`);
      h += box('Ohyb osy', `${fmt(s.sOsa, 1)} MPa`, `rameno ${fmt(s.rameno, 1)} mm · šroub 8.8 snese ~200 MPa`, s.sOsa > 200 ? 'chyba-t' : 'ok-t');
      h += box('Bočnice pod cívkou', `${fmt(s.sPod, 2)} MPa`, `mez ${p.tisk.material} ≈ ${fmt(s.dov)} MPa · využití ${fmt(s.vyuzitiPod * 100, 0)} %`, tridaVyuziti(s.vyuzitiPod));
      h += box('Otlačení díry osy', `${fmt(s.otlaceni, 2)} MPa`, `využití ${fmt(s.vyuzitiOtl * 100, 0)} %`, tridaVyuziti(s.vyuzitiOtl));
      h += box('Cívka vyskočí', `při ${fmt(s.vyskoci, 1)} N`, 'vodorovně v ose – W · tg α');
    }
    if (p.druh === 'vodidlo') {
      const v = m.vodidlo;
      h += box('Ohyb filamentu', `${fmt(v.ohyb, 0)}°`, 'změna směru ve vodítku');
      h += box('Tah za vodítkem', `${fmt(v.pomery[v.typ], 3)} ×`, `${N.vtyp[v.typ]} · T₂ = T₁ · e^(μθ)`, v.pomery[v.typ] > 1.3 ? 'mez-t' : 'ok-t');
    }
    $('vMech').innerHTML = h;
    // porovnání uložení
    const rad = [['kluzne', 'Kluzně na trnu (redukce bez ložiska)'], ['lozisko', 'Ložiska v redukcích'], ['stojan', 'Stojan – cívka na 4 ložiskách']];
    let tab = '<thead><tr><th>Uložení</th><th class="c">Moment</th><th class="c">Tah plná</th><th class="c">Tah prázdná</th></tr></thead><tbody>'
      + rad.map(([k, n]) => `<tr class="${k === m.aktivni ? 'aktivni' : ''}"><td>${esc(n)}${k === m.aktivni ? ' ◀' : ''}</td><td class="c">${f2(m[k].moment)} N·mm</td><td class="c">${f2(m[k].plna)} N</td><td class="c">${f2(m[k].prazdna)} N</td></tr>`).join('');
    if (p.druh === 'vodidlo') tab += Object.entries(m.vodidlo.pomery).map(([k, x]) => `<tr class="${k === m.vodidlo.typ ? 'aktivni' : ''}"><td>➰ ${esc(N.vtyp[k])}</td><td class="c">μ ${fmt(CIVKA_MECH.MU_VOD[k], 2)}</td><td class="c" colspan="2">tah × ${fmt(x, 3)}</td></tr>`).join('');
    $('tabMech').innerHTML = tab + '</tbody>';
    $('napMech').innerHTML = `<span>Ložisko: μ ≈ ${fmt(CIVKA_MECH.MU_LOZ, 4)} na průměru díry + odpor těsnění 2RS ≈ ${fmt(CIVKA_MECH.M_TESNENI, 1)} N·mm (ZZ brzdí méně).</span> `
      + `<span>Kluzně: μ ${fmt(p.mech.muKluz, 2)} na průměru trnu ${fmt(p.ulozeni.trn)} mm.</span> <span>Stojan: moment ložisek se převádí poměrem poloměru cívky a ložiska – proto brzdí víc než ložisko v redukci, ale méně než trn.</span> `
      + `<span>Nad ${fmt(CIVKA_MECH.MEZ_TAHU)} N už extruder může prokluzovat. Hodnoty jsou orientační (stav ${CIVKA.AKTUALIZACE}).</span>`;
  }
  function vypisTisk() {
    const mat = CIVKA.MATERIALY[p.tisk.material];
    let h = box('Materiál', mat.nazev, p.tisk.material === 'PLA' ? 'do pokoje; v sušicím boxu měkne' : 'vhodný i do sušicího boxu');
    if (model) {
      const pod = CIVKA.podlozky(CIVKA.kusyTisku(model), p);
      h += box('Podložek', `${pod.length}`, `${fmt(p.tisk.podlozkaX)} × ${fmt(p.tisk.podlozkaY)} mm`);
    }
    h += box('Doporučení', p.druh === 'stojan' ? '3 perimetry, 30 %' : '4 perimetry, 25 %', p.druh === 'redukce' ? 'žebra a pera potřebují plné stěny' : 'gyroid / kubická výplň');
    $('vTisk').innerHTML = h;
  }

  /* ---------- kusovník ---------- */
  function vypisKusovnik() {
    if (!model) { $('kusovnik').innerHTML = '<p class="napoveda">Kusovník se ukáže po sestavení modelu.</p>'; return; }
    const r = CIVKA.kusovnik(p, model);
    $('kusovnik').innerHTML = `<table class="tabulka"><thead><tr><th>Položka</th><th class="c">Kusů</th><th class="c">Rozměr</th><th>Pozn.</th></tr></thead><tbody>`
      + r.map(x => {
        let roz = '';
        if (x.d) { const b = G3D.obal(x.d.poz); roz = `${fmt(b[3] - b[0], 1)} × ${fmt(b[4] - b[1], 1)} × ${fmt(b[5] - b[2], 1)}`; }
        return `<tr class="${x.druh}"><td>${esc(x.nazev)}</td><td class="c">${x.ks}</td><td class="c">${roz}</td><td>${esc(x.pozn)}</td></tr>`;
      }).join('') + '</tbody></table><p class="napoveda">🖨 = tištěný díl (rozměr v tiskové poloze), 🛒 = nakupovaný díl.</p>';
  }

  /* ---------- náhled ---------- */
  const kusy = () => G3D.tiskoveRozlozeni(CIVKA.kusyTisku(model), 1, 6, app.p.tisk.podlozkaX);
  function zobraz(novyPohled) {
    document.querySelectorAll('[data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === stavZobr.rezim)));
    if (!model) { nahled.nastav(null); return; }
    const r = stavZobr.rezim;
    if (r === 'tisk') nahled.nastav(kusy(), { tisk: true, novyPohled, uhel: p.tisk.uhel });
    else if (r === 'kalibrace') nahled.nastav(model.kalibrace.length ? G3D.tiskoveRozlozeni(model.kalibrace, 1, 8, 400) : null, { tisk: true, novyPohled, uhel: p.tisk.uhel });
    else nahled.nastav(model.sestava.filter(d => !d.kontext || (r === 'sestava' && stavZobr.kontext)), { novyPohled });
    $('legPrevisy').hidden = !((r === 'tisk' || r === 'kalibrace') && nahled.stav.previsy);
    $('stav3d').textContent = r === 'kalibrace' && model && !model.kalibrace.length ? 'Očko se nelícuje – kalibrační vzorek není potřeba.' : chybaStavby;
  }
  function nastavRezim(r) {
    const tisk = $('tTisk').getAttribute('aria-pressed') === 'true', pred = stavZobr.rezim;
    stavZobr.rezim = r;
    if ((r === 'tisk') !== tisk) { $('tTisk').click(); return; }
    zobraz(pred !== r);
    if (model) vypisVysledky();
  }
  document.querySelectorAll('[data-rezim]').forEach(b => b.addEventListener('click', () => nastavRezim(b.dataset.rezim)));

  /* ---------- předvolby ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_civka_filamentu_gui', pohled: j => nahled.pohled(j) });
  {
    let skup = '';
    for (const v of CIVKA.PREDVOLBY) {
      if (v.skupina !== skup) { skup = v.skupina; const d = document.createElement('div'); d.className = 'nab-skupina'; d.textContent = skup; $('seznamPredvoleb').appendChild(d); }
      const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
      b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
      b.addEventListener('click', () => {
        const q = CIVKA.predvolba(v.id);
        // tisk zůstává uživatelův (předvolba smí změnit jen velikost podložky), výpočty také
        q.tisk = Object.assign(CIVKA.kopie(app.p.tisk), v.p.tisk || {});
        q.mech = CIVKA.kopie(app.p.mech);
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
  function exportVse(co) {
    if (!lzeExport()) return;
    if (co === 'stl') app.stahni(KRAB.stlBinarni(kusy(), 'civka filamentu - github_site'), app.jmeno('.stl'), 'model/stl');
    else app.stahni(KRAB.soubor3mf(kusy(), app.p.nazev || 'Cívka'), app.jmeno('.3mf'), 'model/3mf');
  }
  $('btnStl').addEventListener('click', () => exportVse('stl'));
  $('btn3mf').addEventListener('click', () => exportVse('3mf'));
  $('btnPodlozky').addEventListener('click', () => {
    if (!lzeExport()) return;
    const desky = CIVKA.podlozky(CIVKA.kusyTisku(model), app.p);
    const soubory = desky.map((d, i) => ({ name: app.jmeno(`_podlozka_${i + 1}.stl`), data: KRAB.stlBinarni(G3D.tiskoveRozlozeni(d, 1, 6, app.p.tisk.podlozkaX), 'civka - podlozka ' + (i + 1)) }));
    app.stahni(KRAB.zip(soubory), app.jmeno('_podlozky.zip'), 'application/zip');
  });
  function exportDilu() {
    const el = $('exportDilu'); el.innerHTML = '';
    if (!model || model.dily.length < 2) return;
    for (const d of model.dily) {
      const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
      b.innerHTML = `⬇ STL – ${esc(d.nazev)}<span class="pozn">${d.ks} ks</span>`;
      b.addEventListener('click', () => app.stahni(KRAB.stlBinarni(G3D.tiskoveRozlozeni([d], d.ks, 6, app.p.tisk.podlozkaX), 'civka - ' + d.jmeno), app.jmeno('_' + d.jmeno + '.stl'), 'model/stl'));
      el.appendChild(b);
    }
  }
  function exportKalibrace() {
    if (!lzeExport()) return;
    if (!model.kalibrace.length) { Dialog.info('U očka se nic nelícuje – kalibrační vzorek je u redukce, stojanu, kladky a nástavce PTFE.'); return; }
    app.stahni(KRAB.stlBinarni(G3D.tiskoveRozlozeni(model.kalibrace, 1, 8, 400), 'civka - kalibrace'), app.jmeno('_kalibrace.stl'), 'model/stl');
  }
  $('btnKalibrace').addEventListener('click', exportKalibrace);
  $('btnKalibrace2').addEventListener('click', exportKalibrace);

  /* ---------- výkres ---------- */
  function vykresTed() {
    const d = new Date(), mat = CIVKA.MATERIALY[app.p.tisk.material];
    const kus = CIVKA.kusovnik(app.p, model).map(x => [x.nazev, x.ks, x.pozn]);
    const g = model ? CIVKA.kusyTisku(model).reduce((s, x) => s + x.objem * mat.hustota / 1000, 0) : 0;
    return CIVKA_VYK.vykres(app.p, model ? model.o : CIVKA.odvozene(app.p), {
      datum: `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`, kusovnik: kus, hmotnost: g, material: mat.nazev, obrysy: model ? model.obrysy : null,
    });
  }
  function kresliVykres() { $('vykresNahled').innerHTML = CIVKA_VYK.svg(vykresTed()); }
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
      const doc = CIVKA_VYK.pdf(window.jspdf.jsPDF, vykresTed(), { pismo, nazev: app.p.nazev || 'Cívka' });
      app.stahni(doc.output('blob'), app.jmeno('_vykres.pdf'), 'application/pdf');
      if (!pismo) Dialog.info('Písmo se nepodařilo načíst – PDF je bez diakritiky.');
    } catch (e) { Dialog.chyba('PDF se nepodařilo vytvořit: ' + (e && e.message || e)); }
  }
  const vykresSvg = () => app.stahni(CIVKA_VYK.svg(vykresTed()), app.jmeno('_vykres.svg'), 'image/svg+xml');
  $('btnVykresPdf').addEventListener('click', vykresPdf); $('btnVykresPdf2').addEventListener('click', vykresPdf);
  $('btnVykresSvg').addEventListener('click', vykresSvg); $('btnVykresSvg2').addEventListener('click', vykresSvg);
  $('btnVykresZobraz').addEventListener('click', () => { TrubkyGui.otevriZalozku('vykres'); kresliVykres(); });
  document.querySelector('[data-zalozka="vykres"]').addEventListener('click', () => setTimeout(kresliVykres, 0));

  app.prepinac('tRez', h => { nahled.prepni('rez', h); $('legRez').hidden = !h; });
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !(h && (stavZobr.rezim === 'tisk' || stavZobr.rezim === 'kalibrace')); }, true);
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);
  app.prepinac('tKontext', h => { stavZobr.kontext = h; zobraz(false); }, true);
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
  window.CIVKA_UI = { get p() { return app.p; }, get model() { return model; }, zmen: app.zmen, nahrad: app.nahrad, prepocitej, nahled, app, nastavRezim };
})();
