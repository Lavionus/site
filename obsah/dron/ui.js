// Nad krajinou — menu: hlavní nabídka (s kamerou kroužící nad krajinou), volný let, pauza,
// nastavení, ovládání, nápověda, automatická kvalita.
(function (D) {
  'use strict';

  const CSS = `
  #menu .m-obal { position: absolute; inset: 0; display: flex; align-items: center; justify-content: flex-start; padding: 0 clamp(16px, 6vw, 80px);
    background: linear-gradient(90deg, rgba(8,12,18,0.78) 0%, rgba(8,12,18,0.45) 38%, rgba(8,12,18,0) 70%); pointer-events: auto; }
  #menu .m-obal.stred { justify-content: center; background: rgba(8,12,18,0.55); }
  #menu .m-karta { width: min(460px, 100%); max-height: calc(100% - 32px); overflow-y: auto; color: var(--fg); }
  #menu .m-karta.siroka { width: min(760px, 100%); background: var(--panel); border: 1px solid var(--okraj); border-radius: 14px; padding: 18px 20px; backdrop-filter: blur(6px); }
  #menu h1 { font-weight: 300; font-size: clamp(34px, 6vw, 60px); letter-spacing: 0.04em; line-height: 1.05; text-shadow: 0 2px 18px rgba(0,0,0,0.5); }
  #menu .podtitul { color: #c9d6e2; margin: 6px 0 22px; font-size: 15px; text-shadow: 0 1px 6px rgba(0,0,0,0.6); }
  #menu h2 { font-weight: 400; font-size: 22px; margin-bottom: 12px; }
  #menu h3 { font-size: 12px; font-weight: 600; color: var(--tlumena); text-transform: uppercase; letter-spacing: 0.08em; margin: 14px 0 6px; }
  #menu .m-tl { display: block; width: 100%; text-align: left; margin: 6px 0; padding: 11px 16px; font: 500 17px system-ui, sans-serif; color: var(--fg);
    background: rgba(255,255,255,0.07); border: 1px solid var(--okraj); border-radius: 10px; cursor: pointer; transition: background 0.15s, transform 0.15s; }
  #menu .m-tl:hover, #menu .m-tl:focus-visible { background: rgba(127,209,255,0.18); transform: translateX(3px); outline: none; }
  #menu .m-tl small { display: block; font-size: 12.5px; font-weight: 400; color: var(--tlumena); margin-top: 2px; }
  #menu .m-tl.hlavni { background: rgba(127,209,255,0.25); border-color: rgba(127,209,255,0.55); }
  #menu .m-rada { display: flex; gap: 8px; flex-wrap: wrap; }
  #menu .m-volba { flex: 1 1 120px; padding: 9px 10px; border-radius: 9px; border: 1px solid var(--okraj); background: rgba(255,255,255,0.05); color: var(--fg);
    cursor: pointer; text-align: left; font: 14px system-ui, sans-serif; }
  #menu .m-volba small { display: block; color: var(--tlumena); font-size: 12px; margin-top: 2px; }
  #menu .m-volba.vybrano { border-color: var(--akcent); background: rgba(127,209,255,0.16); }
  #menu label.m-pos { display: grid; grid-template-columns: 110px 1fr 64px; align-items: center; gap: 10px; margin: 6px 0; font-size: 14px; }
  #menu label.m-pos output { text-align: right; color: var(--tlumena); font-variant-numeric: tabular-nums; }
  #menu input[type=range] { width: 100%; accent-color: var(--akcent); }
  #menu label.m-chk { display: flex; gap: 8px; align-items: center; margin: 6px 0; font-size: 14px; }
  #menu input[type=text] { background: rgba(0,0,0,0.3); color: var(--fg); border: 1px solid var(--okraj); border-radius: 6px; padding: 5px 8px; font: 14px system-ui; width: 140px; }
  #menu .m-zpet { background: none; border: 0; color: var(--tlumena); font: 14px system-ui; cursor: pointer; margin-bottom: 8px; }
  #menu .m-zpet:hover { color: var(--fg); }
  #menu .m-pozn { font-size: 12.5px; color: var(--tlumena); margin-top: 6px; }
  #menu .m-seznam { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 8px; }
  #menu .m-seznam .m-tl { margin: 0; }
  #menu .hvezdy { color: #ffd34d; letter-spacing: 2px; }
  #menu table { border-collapse: collapse; width: 100%; font-size: 14px; }
  #menu td { padding: 4px 8px; border-bottom: 1px solid var(--okraj); vertical-align: top; }
  #menu td:first-child { white-space: nowrap; color: var(--akcent); font-family: monospace; font-size: 13px; }
  #menu kbd { font-family: monospace; }
  #menu .m-akce { display: flex; gap: 8px; margin-top: 14px; }
  #menu .m-akce .m-tl { text-align: center; }
  @media (max-width: 640px) { #menu .m-obal { background: rgba(8,12,18,0.6); } #menu label.m-pos { grid-template-columns: 90px 1fr 52px; } }
  `;

  const MAPY = [
    { id: 'udoli', jmeno: 'Údolí', popis: 'vesnice, řeka a jezero' },
    { id: 'jezero', jmeno: 'Jezero', popis: 'velká vodní nádrž' },
    { id: 'hrebeny', jmeno: 'Hřebeny', popis: 'zalesněné kopce' },
  ];
  const POPIS_DRONU = {
    kamera: 'Klidný a stabilní, drží pozici, 25 min letu. Na focení krajiny.',
    fpv: 'Silný a rychlý, režim Acro, pár minut letu. Na freestyle a závody.',
    whoop: 'Malý s ochranou vrtulí, snese náraz. Na průlety mezi stromy.',
  };
  const REZIM_JM = { gps: 'GPS', uhel: 'Úhel', horizont: 'Horizont', acro: 'Acro' };
  const REZIM_POPIS = { gps: 'puštěné páky = dron stojí', uhel: 'samo se vyrovná', horizont: 'úhel + přemety', acro: 'nic se samo nevyrovná' };

  const KLIC = 'webapp_dron_nastaveni';
  function nactiNast() { try { return JSON.parse(localStorage.getItem(KLIC)) || {}; } catch (e) { return {}; } }
  function ulozNast(n) { try { localStorage.setItem(KLIC, JSON.stringify(n)); } catch (e) { /* nevadí */ } }

  let ctx, menuEl, otevreno = false, obrazovka = null, predRezim = null, orbit = 0, orbitStred = null;
  let volba = null;                  // výběr pro volný let
  let obrazovkaZ = 'hlavni';         // odkud se přišlo do podobrazovky (pauza / hlavní)
  let auto = { pomalu: 0, kvalitaMax: 3 };

  const el = (tag, cls, rodic, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (rodic) rodic.appendChild(e); return e; };
  function tlacitko(rodic, text, popis, akce, cls) {
    const b = el('button', 'm-tl' + (cls ? ' ' + cls : ''), rodic); b.type = 'button';
    b.innerHTML = text + (popis ? '<small>' + popis + '</small>' : ''); b.onclick = akce; return b;
  }
  function posuvnik(rodic, jmeno, min, max, krok, hodnota, format, zmena) {
    const l = el('label', 'm-pos', rodic); el('span', '', l, jmeno);
    const i = el('input', '', l); i.type = 'range'; i.min = min; i.max = max; i.step = krok; i.value = hodnota;
    const o = el('output', '', l); o.textContent = format(+hodnota);
    i.oninput = () => { o.textContent = format(+i.value); zmena(+i.value); };
    return i;
  }
  function zaskrt(rodic, jmeno, hodnota, zmena) {
    const l = el('label', 'm-chk', rodic); const i = el('input', '', l); i.type = 'checkbox'; i.checked = !!hodnota; el('span', '', l, jmeno);
    i.onchange = () => zmena(i.checked); return i;
  }
  const hodinyTxt = h => String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.round((h % 1) * 60) % 60).padStart(2, '0');

  // ---------- otevření / zavření ----------
  function otevri(nazev) {
    if (!otevreno) {
      otevreno = true;
      ctx.pauza = true;
      predRezim = ctx.kam.rezim;
      if (nazev === 'hlavni') { ctx.kam.rezim = 'volna'; orbitStred = null; }
    }
    obrazovka = nazev;
    if (nazev === 'hlavni' || nazev === 'pauza') obrazovkaZ = nazev;
    menuEl.innerHTML = '';
    OBRAZOVKY[nazev]();
    const prvni = menuEl.querySelector('button.m-tl'); if (prvni) try { prvni.focus({ preventScroll: true }); } catch (e) { /* nic */ }
  }
  function zavri() {
    otevreno = false; obrazovka = null; menuEl.innerHTML = '';
    ctx.pauza = false;
    if (ctx.kam.rezim === 'volna' && !D.param.pohled) ctx.kam.rezim = predRezim && predRezim !== 'volna' ? predRezim : vychoziKamera(ctx.dron.typ);
  }
  const vychoziKamera = typ => typ === 'kamera' ? 'chase' : 'fpv';

  function obal(stred, siroka) {
    const o = el('div', 'm-obal' + (stred ? ' stred' : ''), menuEl);
    return el('div', 'm-karta' + (siroka ? ' siroka' : ''), o);
  }
  function zpet(k, kam) { const b = el('button', 'm-zpet', k, '← zpět'); b.type = 'button'; b.onclick = () => otevri(kam); }

  // spustí let (případně s misí); když je potřeba jiná krajina, načte stránku znovu s parametry
  function startLetu(o) {
    if (o.mapa !== ctx.mapa || String(o.seed) !== String(ctx.seed)) {
      const q = new URLSearchParams({ mapa: o.mapa, seed: o.seed, typ: o.dron, rezim: o.rezim, cas: o.cas, oblacnost: o.oblacnost, vitr: o.vitr,
        start: o.mise || 'volny' });
      if (o.miseId != null) q.set('miseId', o.miseId);
      if (D.param.kvalita) q.set('kvalita', D.param.kvalita);
      location.search = q.toString();
      return;
    }
    ctx.hodina = o.cas; ctx.pocasi.oblacnost = o.oblacnost; ctx.pocasi.vitr = o.vitr; ctx.pocasi.dest = o.dest || 0;
    zavri();
    if (D.mise) D.mise.spust(o.mise || 'volny', o.miseId, { dron: o.dron, rezim: o.rezim });
    else { D.novyLet(o.dron); ctx.dron.rezim = o.rezim; }
    ctx.kam.rezim = vychoziKamera(ctx.dron.typ);
  }

  // ---------- obrazovky ----------
  const OBRAZOVKY = {
    hlavni() {
      const k = obal();
      el('h1', '', k, 'Nad krajinou');
      el('div', 'podtitul', k, 'Simulátor letu dronem nad českou krajinou');
      tlacitko(k, 'Volný let', 'Vyber si dron, denní dobu a počasí a leť', () => otevri('volny'), 'hlavni');
      tlacitko(k, 'Letová škola', 'Deset krátkých lekcí od vznášení po Acro', () => otevri('skola'));
      tlacitko(k, 'Fotomise', 'Vyfoť zajímavá místa krajiny', () => otevri('foto'));
      tlacitko(k, 'Závody', 'FPV tratě brankami na čas, proti duchovi', () => otevri('zavody'));
      const r = el('div', 'm-rada', k);
      tlacitko(r, 'Nastavení', '', () => otevri('nastaveni')).style.flex = '1';
      tlacitko(r, 'Ovládání', '', () => otevri('ovladani')).style.flex = '1';
      tlacitko(r, 'Nápověda', '', () => otevri('napoveda')).style.flex = '1';
    },
    volny() {
      const k = obal(true, true); zpet(k, 'hlavni');
      el('h2', '', k, 'Volný let');
      if (!volba) volba = { dron: ctx.dron.typ, rezim: ctx.dron.rezim, mapa: ctx.mapa, seed: ctx.seed, cas: ctx.hodina,
        oblacnost: ctx.pocasi.oblacnost, vitr: ctx.pocasi.vitr, dest: ctx.pocasi.dest };
      el('h3', '', k, 'Dron');
      const rd = el('div', 'm-rada', k), rr = el('div', 'm-rada', null);
      const kresliRezimy = () => {
        rr.innerHTML = '';
        const T = D.TYPY_DRONU[volba.dron];
        if (!T.rezimy.includes(volba.rezim)) volba.rezim = T.vychoziRezim;
        for (const z of T.rezimy) {
          const b = el('button', 'm-volba' + (z === volba.rezim ? ' vybrano' : ''), rr, REZIM_JM[z] + '<small>' + REZIM_POPIS[z] + '</small>'); b.type = 'button';
          b.onclick = () => { volba.rezim = z; kresliRezimy(); };
        }
      };
      for (const typ of Object.keys(D.TYPY_DRONU)) {
        const b = el('button', 'm-volba' + (typ === volba.dron ? ' vybrano' : ''), rd, '<b>' + D.TYPY_DRONU[typ].jmeno + '</b><small>' + (POPIS_DRONU[typ] || '') + '</small>'); b.type = 'button';
        b.onclick = () => { volba.dron = typ; rd.querySelectorAll('.m-volba').forEach(x => x.classList.toggle('vybrano', x === b)); kresliRezimy(); };
      }
      el('h3', '', k, 'Režim letu'); k.appendChild(rr); kresliRezimy();
      el('h3', '', k, 'Krajina');
      const rm = el('div', 'm-rada', k);
      for (const m of MAPY) {
        const b = el('button', 'm-volba' + (m.id === volba.mapa ? ' vybrano' : ''), rm, '<b>' + m.jmeno + '</b><small>' + m.popis + '</small>'); b.type = 'button';
        b.onclick = () => { volba.mapa = m.id; rm.querySelectorAll('.m-volba').forEach(x => x.classList.toggle('vybrano', x === b)); };
      }
      const ls = el('label', 'm-chk', k); el('span', '', ls, 'Semínko krajiny:');
      const sd = el('input', '', ls); sd.type = 'text'; sd.value = volba.seed; sd.oninput = () => { volba.seed = sd.value.trim() || 'udoli'; };
      const nah = el('button', 'm-zpet', ls, '🎲 náhodné'); nah.type = 'button'; nah.style.margin = 0;
      nah.onclick = () => { sd.value = volba.seed = Math.random().toString(36).slice(2, 8); };
      el('div', 'm-pozn', k, 'Jiná krajina nebo semínko se vytvoří znovu (pár vteřin).');
      el('h3', '', k, 'Podmínky');
      posuvnik(k, 'Denní doba', 4.5, 21.5, 0.25, volba.cas, hodinyTxt, v => { volba.cas = v; ctx.hodina = v; });
      posuvnik(k, 'Oblačnost', 0, 1, 0.05, volba.oblacnost, v => Math.round(v * 100) + ' %', v => { volba.oblacnost = v; ctx.pocasi.oblacnost = v; });
      posuvnik(k, 'Vítr', 0, 12, 0.5, volba.vitr, v => v.toFixed(1) + ' m/s', v => { volba.vitr = v; ctx.pocasi.vitr = v; });
      zaskrt(k, 'Déšť', volba.dest > 0, v => { volba.dest = v ? 0.7 : 0; ctx.pocasi.dest = volba.dest; });
      const a = el('div', 'm-akce', k);
      tlacitko(a, 'Vzlétnout ▶', '', () => startLetu(Object.assign({}, volba, { mise: 'volny' })), 'hlavni').style.flex = '1';
    },
    skola() {
      const k = obal(true, true); zpet(k, 'hlavni');
      el('h2', '', k, 'Letová škola');
      el('div', 'm-pozn', k, 'Lekce jdou po sobě, ale můžeš začít kteroukoli. Hvězdičky za přesnost a čas.');
      const s = el('div', 'm-seznam', k); s.style.marginTop = '10px';
      const lekce = D.mise ? D.mise.lekce() : [];
      lekce.forEach((l, i) => {
        tlacitko(s, (i + 1) + '. ' + l.jmeno + ' <span class="hvezdy">' + '★'.repeat(l.hvezdy || 0) + '☆'.repeat(3 - (l.hvezdy || 0)) + '</span>', l.popis,
          () => startLetu({ mise: 'skola', miseId: l.id, dron: l.dron, rezim: l.rezim, mapa: ctx.mapa, seed: ctx.seed, cas: ctx.hodina, oblacnost: ctx.pocasi.oblacnost, vitr: l.vitr != null ? l.vitr : 1.5 }));
      });
    },
    foto() {
      const k = obal(true, true); zpet(k, 'hlavni');
      el('h2', '', k, 'Fotomise');
      el('div', 'm-pozn', k, 'Doleť k cíli, zaměř ho kamerou (gimbal) a stiskni F. Hodnotí se záběr, kompozice a klid.');
      const s = el('div', 'm-seznam', k); s.style.marginTop = '10px';
      for (const m of (D.mise ? D.mise.fotomise() : [])) {
        tlacitko(s, m.jmeno + ' <span class="hvezdy">' + '★'.repeat(m.hvezdy || 0) + '☆'.repeat(3 - (m.hvezdy || 0)) + '</span>', m.popis,
          () => startLetu({ mise: 'foto', miseId: m.id, dron: 'kamera', rezim: 'gps', mapa: ctx.mapa, seed: ctx.seed, cas: m.cas != null ? m.cas : ctx.hodina, oblacnost: ctx.pocasi.oblacnost, vitr: ctx.pocasi.vitr }));
      }
    },
    zavody() {
      const k = obal(true, true); zpet(k, 'hlavni');
      el('h2', '', k, 'Závody');
      el('div', 'm-pozn', k, 'Proleť všechny branky v pořadí. Nejlepší kolo se uloží a příště s tebou letí jako duch.');
      const trate = D.mise ? D.mise.trate() : [];
      if (!trate.length) el('div', 'm-pozn', k, 'Tahle krajina nemá žádnou trať.');
      for (const t of trate) {
        el('h3', '', k, t.jmeno + ' · ' + t.branek + ' branek' + (t.rekord != null ? ' · rekord ' + t.rekord.toFixed(2) + ' s' : ''));
        const r = el('div', 'm-rada', k);
        for (const typ of ['fpv', 'whoop']) {
          tlacitko(r, D.TYPY_DRONU[typ].jmeno, typ === 'fpv' ? 'Acro (nebo Úhel v nastavení)' : 'Úhel, odolný', () =>
            startLetu({ mise: 'zavod', miseId: t.id, dron: typ, rezim: typ === 'fpv' ? (ctx.nastaveni.zavodRezim || 'acro') : 'uhel', mapa: ctx.mapa, seed: ctx.seed, cas: ctx.hodina, oblacnost: ctx.pocasi.oblacnost, vitr: Math.min(ctx.pocasi.vitr, 3) })).style.flex = '1';
        }
      }
      el('h3', '', k, 'Režim FPV dronu v závodě');
      const rr = el('div', 'm-rada', k);
      for (const z of ['acro', 'horizont', 'uhel']) {
        const b = el('button', 'm-volba' + ((ctx.nastaveni.zavodRezim || 'acro') === z ? ' vybrano' : ''), rr, REZIM_JM[z]); b.type = 'button';
        b.onclick = () => { ctx.nastaveni.zavodRezim = z; ulozNast(ctx.nastaveni); otevri('zavody'); };
      }
    },
    pauza() {
      const k = obal(true);
      el('h2', '', k, 'Pauza');
      tlacitko(k, 'Pokračovat', '<kbd>Esc</kbd>', () => zavri(), 'hlavni');
      tlacitko(k, 'Začít znovu', 'zpět na start', () => { zavri(); D.vyvolej('reset'); });
      if (D.zaznam && D.zaznam.delka() > 2) tlacitko(k, 'Přehrát let', 'posledních ' + Math.round(D.zaznam.delka()) + ' s s filmovou kamerou', () => { zavri(); D.zaznam.prehraj(); });
      tlacitko(k, 'Nastavení', '', () => otevri('nastaveni'));
      tlacitko(k, 'Ovládání', '', () => otevri('ovladani'));
      tlacitko(k, 'Nápověda', '', () => otevri('napoveda'));
      tlacitko(k, 'Hlavní menu', '', () => { if (D.mise) D.mise.konec(); otevreno = false; ctx.kam.rezim = 'volna'; otevri('hlavni'); });
    },
    nastaveni() {
      const k = obal(true, true); zpet(k, obrazovkaZ === 'pauza' ? 'pauza' : 'hlavni');
      const N = ctx.nastaveni;
      el('h2', '', k, 'Nastavení');
      el('h3', '', k, 'Kvalita grafiky');
      const rq = el('div', 'm-rada', k);
      D.KVALITY.forEach((q, i) => {
        const b = el('button', 'm-volba' + (i === ctx.kvalita ? ' vybrano' : ''), rq, q.jmeno); b.type = 'button';
        b.onclick = () => { N.kvalita = i; N.autoKvalita = false; ulozNast(N); D.nastavKvalitu(i); otevri('nastaveni'); };
      });
      zaskrt(k, 'Automaticky snížit, když se hra zadrhává', N.autoKvalita !== false, v => { N.autoKvalita = v; ulozNast(N); });
      el('h3', '', k, 'Zvuk');
      posuvnik(k, 'Hlasitost', 0, 1, 0.05, D.zvuk && D.zvuk.hlasitost ? D.zvuk.hlasitost() : 0.7, v => Math.round(v * 100) + ' %', v => { if (D.zvuk && D.zvuk.hlasitost) D.zvuk.hlasitost(v); });
      if (D.zvuk && D.zvuk.ztlum) zaskrt(k, 'Ztlumit zvuk', D.zvuk.ztlum(), v => D.zvuk.ztlum(v));
      el('h3', '', k, 'Kamera');
      posuvnik(k, 'Náklon FPV', 0, 50, 1, ctx.kam.fpvNaklon, v => v + '°', v => { ctx.kam.fpvNaklon = v; N.fpvNaklon = v; ulozNast(N); });
      posuvnik(k, 'Zorné pole FPV', 80, 130, 1, ctx.kam.fovFPV, v => v + '°', v => { ctx.kam.fovFPV = v; N.fovFPV = v; ulozNast(N); });
      zaskrt(k, 'Analogový FPV obraz (šum, linky)', N.analog, v => { N.analog = v; ulozNast(N); });
      zaskrt(k, 'Mřížka třetin v gimbalu', N.tretiny, v => { N.tretiny = v; ulozNast(N); });
      zaskrt(k, 'Minimapa i v FPV', N.mapaFPV, v => { N.mapaFPV = v; ulozNast(N); });
    },
    ovladani() {
      const k = obal(true, true); zpet(k, obrazovkaZ === 'pauza' ? 'pauza' : 'hlavni');
      el('h2', '', k, 'Ovládání');
      const c = el('div', '', k);
      if (D.vstup && D.vstup.otevriNastaveni) D.vstup.otevriNastaveni(c);
      else c.innerHTML = 'Nastavení ovládání není k dispozici.';
    },
    napoveda() {
      const k = obal(true, true); zpet(k, obrazovkaZ === 'pauza' ? 'pauza' : 'hlavni');
      el('h2', '', k, 'Nápověda');
      el('div', '', k, `<table>
        <tr><td>W / S</td><td>plyn — stoupání a klesání (páka se vrací na střed = drží výšku)</td></tr>
        <tr><td>A / D</td><td>otáčení doleva a doprava (yaw)</td></tr>
        <tr><td>šipky</td><td>náklon — let vpřed, vzad a do stran</td></tr>
        <tr><td>Shift</td><td>sport — rychlejší let kamerového dronu</td></tr>
        <tr><td>Q / E</td><td>náklon kamery gimbalu</td></tr>
        <tr><td>C</td><td>přepnout kameru: FPV · za dronem · gimbal · pilot na zemi</td></tr>
        <tr><td>F</td><td>vyfotit</td></tr>
        <tr><td>M</td><td>přepnout letový režim</td></tr>
        <tr><td>H</td><td>návrat domů (kamerový dron)</td></tr>
        <tr><td>R</td><td>znovu na start</td></tr>
        <tr><td>Esc / P</td><td>pauza a menu</td></tr>
      </table>
      <h3>Letové režimy</h3>
      <p class="m-pozn"><b>GPS</b> — dron drží polohu i ve větru, páky řídí rychlost. Nejjednodušší.<br>
      <b>Úhel</b> — páka určuje náklon, po puštění se dron vyrovná, ale vítr ho unáší.<br>
      <b>Horizont</b> — jako Úhel, při plné páce udělá přemet.<br>
      <b>Acro</b> — páka určuje rychlost otáčení a nic se samo nevyrovná. Tak létají FPV piloti.</p>
      <h3>Rady</h3>
      <p class="m-pozn">Stín dronu na zemi pomáhá odhadnout výšku. Když dron letí k tobě (kamera „pilot na zemi“), jsou levá a pravá prohozené.
      Vysílačku připojenou přes USB nastavíš v Ovládání.</p>`);
    },
  };

  D.ui = {
    otevri,
    zavri, otevreno: () => otevreno,
  };

  D.modul('ui', {
    poradi: 96,
    popis: 'menu',
    init(c) {
      ctx = c;
      const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
      menuEl = document.getElementById('menu');
      const N = ctx.nastaveni = Object.assign({ autoKvalita: true }, nactiNast());
      if (N.fpvNaklon != null) ctx.kam.fpvNaklon = N.fpvNaklon;
      if (N.fovFPV != null) ctx.kam.fovFPV = N.fovFPV;
      if (N.kvalita != null && D.param.kvalita == null && N.kvalita !== ctx.kvalita) D.nastavKvalitu(N.kvalita);
      auto.kvalitaMax = ctx.kvalita;

      D.na('pauza', () => {
        if (D.param.pohled) return;
        if (!otevreno) D.ui.otevri('pauza');
        else if (obrazovka === 'pauza') zavri();
        else if (obrazovka !== 'hlavni') otevri(obrazovkaZ === 'pauza' ? 'pauza' : 'hlavni');
      });

      if (D.param.pohled || D.param.menu === '0') return;          // snímky / přímý let bez menu
      if (D.param.start) {                                          // po znovunačtení s jinou krajinou
        const typ = D.param.typ || 'kamera';
        setTimeout(() => {
          if (D.mise) D.mise.spust(D.param.start, D.param.miseId, { dron: typ, rezim: D.param.rezim });
          ctx.kam.rezim = vychoziKamera(ctx.dron.typ);
        }, 0);
        return;
      }
      D.ui.otevri('hlavni');
    },
    update(c, dt) {
      // kamera v menu krouží nad krajinou
      if (otevreno && ctx.kam.rezim === 'volna' && !D.param.pohled) {
        const t = ctx.teren;
        if (!orbitStred) {
          const kostel = (t.stavby || []).find(s => s.typ === 'kostel');
          const s = kostel || t.start;
          orbitStred = new THREE.Vector3(s.x, t.vyska(s.x, s.z) + 25, s.z);
          orbit = 0.6;
        }
        orbit += (performance.now() - (this._t || performance.now())) / 1000 * 0.025; this._t = performance.now();
        const R = 260, k = ctx.kamera;
        const x = orbitStred.x + Math.sin(orbit) * R, z = orbitStred.z + Math.cos(orbit) * R;
        const y = Math.max(t.vyska(x, z) + 45, orbitStred.y + 70);
        k.position.set(x, y, z); k.lookAt(orbitStred);
        if (Math.abs(k.fov - 55) > 0.01) { k.fov = 55; k.updateProjectionMatrix(); }
      } else this._t = performance.now();
      // automatické snížení kvality
      if (!otevreno && ctx.nastaveni.autoKvalita !== false && ctx.kvalita > 0 && ctx.fps) {
        auto.pomalu = ctx.fps < 32 ? auto.pomalu + (dt || 0.016) : Math.max(0, auto.pomalu - (dt || 0.016) * 2);
        if (auto.pomalu > 5 && !D.param.kvalita && !navigator.webdriver) {
          auto.pomalu = 0; D.nastavKvalitu(ctx.kvalita - 1);
          if (D.osd) D.osd.zprava('Grafika snížena na: ' + D.KVALITY[ctx.kvalita].jmeno, 3);
        }
      }
    },
  });
})(globalThis.DRON = globalThis.DRON || {});
