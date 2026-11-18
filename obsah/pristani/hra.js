/* ============================================================
   Přistání na Měsíci – vykreslování, ovládání, zvuk a UI.
   Fyzika je celá v jadro.js (PRISTANI); tady se jen kreslí a
   sbírají vstupy z klávesnice, dotyku a gamepadu.
   ============================================================ */
(function () {
  'use strict';
  const P = window.PRISTANI;
  const $ = id => document.getElementById(id);
  const KLIC = 'webapp_hra_pristani_';
  const fmt = (v, d) => (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d).replace('.', ',').replace('-', '−');

  if (window.self === window.top) document.body.classList.add('samostatne');

  /* ---------- uložená data ---------- */
  function cti(k, vychozi) { try { const v = JSON.parse(localStorage.getItem(KLIC + k)); return v === null ? vychozi : v; } catch { return vychozi; } }
  function uloz(k, v) { try { localStorage.setItem(KLIC + k, JSON.stringify(v)); } catch { /* plné úložiště */ } }
  const nast = Object.assign({ zvuk: true, ghost: true, sas: true, drah: true, dotyk: matchMedia('(pointer: coarse)').matches }, cti('nastaveni', {}));
  let postup = cti('postup', 0);                     // index nejvyšší odemčené úrovně

  const rekordy = {};
  function rekord(id) {
    if (!rekordy[id]) rekordy[id] = Rekord.sleduj(KLIC + 'body_' + id, { vyssiLepsi: true, popisek: 'Rekord úrovně', format: v => v + ' b.' });
    return rekordy[id];
  }

  /* ---------- palety světů (kreslení) ---------- */
  const PALETY = {
    mesic:    { nebe: ['#020308', '#0b0d16'], teren: ['#8d8c88', '#3c3b39'], obrys: '#c9c7c0', hvezdy: 1, planeta: { barva: '#3d7bd9', pevnina: '#5aa05a', r: 0.07, x: 0.78, y: 0.2 } },
    asteroid: { nebe: ['#030306', '#0a0a10'], teren: ['#6b5d4f', '#2a241e'], obrys: '#a48f78', hvezdy: 1, slunce: { r: 0.012, x: 0.15, y: 0.15 } },
    mars:     { nebe: ['#3a1f1a', '#b87455'], teren: ['#a4512c', '#4c2213'], obrys: '#d98a5f', hvezdy: 0.15, slunce: { r: 0.02, x: 0.8, y: 0.18 } },
    europa:   { nebe: ['#020308', '#0a0d18'], teren: ['#d8dde4', '#7d8794'], obrys: '#f2f6fb', hvezdy: 1, planeta: { barva: '#c9a27c', pruhy: '#8e6447', r: 0.16, x: 0.75, y: 0.28 }, praskliny: '#9a5a3a' },
    titan:    { nebe: ['#5c3d12', '#c08a3e'], teren: ['#6d5130', '#2c1f10'], obrys: '#a77c45', hvezdy: 0, mlha: 'rgba(214,160,80,0.18)' },
    io:       { nebe: ['#030306', '#0d0b10'], teren: ['#d8c048', '#6b5420'], obrys: '#f1e27a', hvezdy: 1, planeta: { barva: '#c9a27c', pruhy: '#8e6447', r: 0.22, x: 0.2, y: 0.3 } },
    merkur:   { nebe: ['#04040a', '#13121a'], teren: ['#7b746e', '#2f2b28'], obrys: '#b3aaa2', hvezdy: 1, slunce: { r: 0.05, x: 0.85, y: 0.12 } },
  };
  const IKONA = { mesic: '🌙', asteroid: '☄️', mars: '🔴', europa: '🧊', titan: '🟠', io: '🌋', merkur: '☿️' };

  /* ---------- herní stav ---------- */
  let U, T, s, ghost = null, gStav = null, zaznam = [], kampanIdx = 0, volny = null;
  let rezim = 'intro', autopilot = false;           // intro | let | pauza | konec
  let kamera = null, castice = [], hvezdy = [];
  const platno = $('platno'), ctx = platno.getContext('2d');
  const radar = $('radar'), rctx = radar.getContext('2d');

  function nactiUroven(idx, svetVolny, seed) {
    if (svetVolny) { volny = { svet: svetVolny, seed: seed || (1 + Math.floor(Math.random() * 99999)) }; U = P.volnyLet(volny.svet, volny.seed); }
    else { volny = null; kampanIdx = idx; U = P.uroven(P.UROVNE[idx]); uloz('posledni', idx); }
    T = P.teren(U);
    ghost = null;
    if (!volny) {
      const g = cti('ghost_' + U.id, null);
      if (g && g.z) ghost = P.dekoduj(g.z);
      rekord(U.id).prvek($('rekordBox'));
      $('rekordBox').hidden = false;
    } else $('rekordBox').hidden = true;
    const r = P.rng(U.seed + 17);
    hvezdy = Array.from({ length: 160 }, () => [r(), r(), r() * 1.3 + 0.2, r()]);
    restart();
    zobrazIntro();
  }

  function restart() {
    s = P.start(U, T);
    gStav = ghost ? P.start(U, T) : null;
    zaznam = []; castice = []; kamera = null; akum = 0; autopilot = false;
    sas = nast.sas;
    $('iNazev').textContent = U.nazev;
    $('iSvet').textContent = `${IKONA[U.svet]} ${P.SVETY[U.svet].nazev} · g = ${fmt(U.g, 2)} m/s²`;
    const atm = U.odpor > 0;
    $('hVitrL').hidden = $('hVitr').hidden = !atm;
  }

  /* ---------- vstupy ---------- */
  const klavesy = new Set();
  const dotyk = { vlevo: false, vpravo: false, tah: false };
  let sas = true;
  function vstup() {
    if (autopilot && s && !s.konec) {
      const cil = T.plochy.reduce((a, p) => p.nasobic > a.nasobic ? p : a);
      return P.kvantuj(P.bot(U, T, s, cil));
    }
    let tah = 0, rot = 0;
    if (klavesy.has('ArrowUp') || klavesy.has('KeyW') || klavesy.has('Space')) tah = klavesy.has('ShiftLeft') || klavesy.has('ShiftRight') ? 0.5 : 1;
    if (klavesy.has('ArrowLeft') || klavesy.has('KeyA')) rot -= 1;
    if (klavesy.has('ArrowRight') || klavesy.has('KeyD')) rot += 1;
    if (dotyk.tah) tah = 1;
    if (dotyk.vlevo) rot -= 1;
    if (dotyk.vpravo) rot += 1;
    const gp = gamepad();
    if (gp) { tah = Math.max(tah, gp.tah); if (Math.abs(gp.rot) > Math.abs(rot)) rot = gp.rot; }
    return P.kvantuj({ tah, rot: Math.max(-1, Math.min(1, rot)), sas });
  }
  let gpTlacitka = {};
  function gamepad() {
    const pady = navigator.getGamepads ? navigator.getGamepads() : [];
    const g = Array.from(pady || []).find(x => x && x.connected);
    if (!g) return null;
    const stisk = i => !!(g.buttons[i] && g.buttons[i].pressed);
    const nove = i => { const b = stisk(i), bylo = gpTlacitka[i]; gpTlacitka[i] = b; return b && !bylo; };
    if (nove(9)) prikazy.pauza();
    if (nove(2)) prikazy.znovu();
    if (nove(3)) prepni('sas');
    if (nove(0) && rezim !== 'let') potvrdKartu();
    let rot = g.axes[0] || 0;
    if (Math.abs(rot) < 0.15) rot = 0;
    if (stisk(14)) rot = -1; if (stisk(15)) rot = 1;
    const rt = g.buttons[7] ? g.buttons[7].value : 0;
    return { tah: Math.max(rt, stisk(0) && rezim === 'let' ? 1 : 0), rot };
  }

  addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input,select,textarea,dialog')) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    Zvuk.probud();
    if (e.repeat) { klavesy.add(e.code); return; }
    klavesy.add(e.code);
    if (e.code === 'KeyP' || e.code === 'Escape') prikazy.pauza();
    else if (e.code === 'KeyR') prikazy.znovu();
    else if (e.code === 'KeyG') prepni('ghost');
    else if (e.code === 'KeyM') prepni('zvuk');
    else if (e.code === 'KeyS') prepni('sas');
    else if (e.code === 'Enter' && rezim !== 'let') { e.preventDefault(); potvrdKartu(); }
    else if (rezim === 'intro' && ['ArrowUp', 'KeyW', 'Space'].includes(e.code)) spustLet();
  });
  addEventListener('keyup', e => klavesy.delete(e.code));
  addEventListener('blur', () => { klavesy.clear(); if (rezim === 'let') prikazy.pauza(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && rezim === 'let') prikazy.pauza(); });

  function dotykoveTl(id, klic) {
    const el = $(id);
    const dolu = e => { e.preventDefault(); el.setPointerCapture && el.setPointerCapture(e.pointerId); dotyk[klic] = true; el.classList.add('drzi'); Zvuk.probud(); if (klic === 'tah' && rezim === 'intro') spustLet(); };
    const nahoru = () => { dotyk[klic] = false; el.classList.remove('drzi'); };
    el.addEventListener('pointerdown', dolu);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => el.addEventListener(t, nahoru));
  }
  dotykoveTl('dVlevo', 'vlevo'); dotykoveTl('dVpravo', 'vpravo'); dotykoveTl('dTah', 'tah');
  $('dPauza').addEventListener('click', () => prikazy.pauza());
  addEventListener('touchstart', () => { if (!nast.dotyk) { nast.dotyk = true; ulozNast(); obnovPrepinace(); } }, { once: true, passive: true });

  /* ---------- zvuk (WebAudio) ---------- */
  const Zvuk = (() => {
    let ac = null, motor = null, motorF = null, rcs = null, hlavni = null;
    function sum(ac) {
      const b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return b;
    }
    function probud() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      hlavni = ac.createGain(); hlavni.gain.value = nast.zvuk ? 0.7 : 0; hlavni.connect(ac.destination);
      const buf = sum(ac);
      const z1 = ac.createBufferSource(); z1.buffer = buf; z1.loop = true;
      motorF = ac.createBiquadFilter(); motorF.type = 'lowpass'; motorF.frequency.value = 300;
      motor = ac.createGain(); motor.gain.value = 0;
      z1.connect(motorF); motorF.connect(motor); motor.connect(hlavni); z1.start();
      const z2 = ac.createBufferSource(); z2.buffer = buf; z2.loop = true; z2.playbackRate.value = 1.3;
      const f2 = ac.createBiquadFilter(); f2.type = 'highpass'; f2.frequency.value = 2500;
      rcs = ac.createGain(); rcs.gain.value = 0;
      z2.connect(f2); f2.connect(rcs); rcs.connect(hlavni); z2.start();
    }
    function nastav(tah, rcsSila) {
      if (!ac) return;
      const t = ac.currentTime;
      motor.gain.setTargetAtTime(tah * 0.55, t, 0.04);
      motorF.frequency.setTargetAtTime(220 + tah * 650, t, 0.05);
      rcs.gain.setTargetAtTime(Math.min(1, Math.abs(rcsSila)) * 0.07, t, 0.03);
    }
    function ton(f, delka, typ, hlasitost, zpozdeni) {
      if (!ac || !nast.zvuk) return;
      const t = ac.currentTime + (zpozdeni || 0);
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = typ || 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(hlasitost || 0.15, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + delka);
      o.connect(g); g.connect(hlavni); o.start(t); o.stop(t + delka + 0.05);
    }
    function vybuch() {
      if (!ac || !nast.zvuk) return;
      const t = ac.currentTime, z = ac.createBufferSource(); z.buffer = sum(ac);
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(80, t + 1.6);
      const g = ac.createGain(); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
      z.connect(f); f.connect(g); g.connect(hlavni); z.start(t); z.stop(t + 2);
    }
    function fanfara() { [523, 659, 784, 1047].forEach((f, i) => ton(f, 0.35, 'triangle', 0.14, i * 0.12)); }
    function ztlum(ano) { if (hlavni) hlavni.gain.setTargetAtTime(ano ? 0 : 0.7, ac.currentTime, 0.02); }
    return { probud, nastav, ton, vybuch, fanfara, ztlum };
  })();
  ['pointerdown', 'click'].forEach(t => addEventListener(t, () => Zvuk.probud(), { passive: true }));

  /* ---------- herní smyčka (pevný krok jádra) ---------- */
  let akum = 0, posledni = 0, pipCas = 0;
  function smycka(t) {
    const dt = Math.min(0.1, (t - (posledni || t)) / 1000);
    posledni = t;
    const v = vstup();
    if (rezim === 'let') {
      akum += dt;
      let n = 0;
      while (akum >= P.DT && n < 6 && !s.konec) {
        zaznam.push(v);
        P.krok(U, T, s, v);
        if (gStav && !gStav.konec && gStav.kroky < ghost.length) P.krok(U, T, gStav, ghost[gStav.kroky]);
        akum -= P.DT; n++;
      }
      if (akum > P.DT * 6) akum = 0;
      if (s.konec) konecLetu();
      Zvuk.nastav(s.konec ? 0 : s.tah, s.konec ? 0 : s.rcs);
      varovani(t);
    } else Zvuk.nastav(0, 0);
    if (rezim === 'let' || rezim === 'konec' || rezim === 'intro') aktualizujCastice(dt);
    kresli(dt);
    if (s) hud();
    requestAnimationFrame(smycka);
  }

  function varovani(t) {
    const h = P.prehled(U, T, s);
    let text = '';
    if (h.agl < 80 && -h.vy > U.limity.vy * 2.2) text = '⚠ Příliš rychlý sestup';
    else if (h.agl < 25 && Math.abs(h.uhel) > U.limity.uhel * 1.5) text = '⚠ Vyrovnej modul';
    else if (h.palivo < 0.15) text = h.palivo <= 0 ? '⛽ Došlo palivo' : '⛽ Málo paliva';
    const el = $('varovani');
    el.hidden = !text; el.textContent = text;
    if (text && t - pipCas > (text.includes('palivo') || text.includes('paliva') ? 1000 : 400)) { pipCas = t; Zvuk.ton(text.includes('palivo') || text.includes('paliva') ? 620 : 1250, 0.08, 'square', 0.06); }
  }

  /* ---------- konec letu, rekordy, ghost ---------- */
  function konecLetu() {
    rezim = 'konec';
    $('varovani').hidden = true;
    const k = s.konec;
    let novyRekord = false;
    if (k.druh === 'pristani') {
      Zvuk.fanfara();
      prach(s.x, s.y - 2.6, 40);
      if (!volny && !autopilot) {
        novyRekord = rekord(U.id).zapis(k.body);
        const g = cti('ghost_' + U.id, null);
        if (!g || k.body > g.body) { uloz('ghost_' + U.id, { body: k.body, z: P.zakoduj(zaznam) }); }
        if (kampanIdx >= postup && kampanIdx < P.UROVNE.length - 1) { postup = kampanIdx + 1; uloz('postup', postup); }
        if (kampanIdx === P.UROVNE.length - 1) uloz('dohrano', true);
        sestavUrovne();
      }
    } else if (k.druh === 'havarie') { Zvuk.vybuch(); vybuch(s.x, s.y); }
    else Zvuk.ton(330, 0.4, 'sine', 0.12);
    setTimeout(() => zobrazVysledek(novyRekord), k.druh === 'havarie' ? 900 : 500);
  }

  function radek(a, b) { return `<tr><td>${a}</td><td>${b}</td></tr>`; }
  function karta(html) { $('karta').innerHTML = html; $('zprava').hidden = false; const b = $('karta').querySelector('.primary'); if (b) b.focus({ preventScroll: true }); }
  function skryjKartu() { $('zprava').hidden = true; }
  function potvrdKartu() { const b = $('karta').querySelector('.primary'); if (!$('zprava').hidden && b) b.click(); }

  function zobrazIntro() {
    rezim = 'intro';
    const L = U.limity, atm = U.odpor > 0;
    const plochy = T.plochy.map(p => '×' + p.nasobic).join(', ');
    const g = !volny && cti('ghost_' + U.id, null);
    karta(`<h2>${IKONA[U.svet]} ${esc(U.nazev)}</h2>
      <div class="svet">${volny ? '' : `Úroveň ${kampanIdx + 1} z ${P.UROVNE.length} · `}${esc(P.SVETY[U.svet].nazev)}</div>
      <p>${esc(U.popis)}</p>
      <table>
        ${radek('Gravitace', fmt(U.g, 3).replace(/0$/, '') + ' m/s²')}
        ${radek('Atmosféra', atm ? (U.odpor >= 0.01 ? 'hustá' : 'řídká') + (U.vitr[0] ? ` · vítr ${fmt(U.vitr[0], 0)} ± ${fmt(U.vitr[1], 0)} m/s` : '') : 'žádná')}
        ${radek('Palivo', fmt(U.palivo, 0) + ' kg')}
        ${radek('Tah motoru', fmt(U.tah / 1000, 1) + ' kN')}
        ${radek('Plochy (násobiče)', plochy)}
        ${radek('Limity dosednutí', `↕ ${fmt(L.vy, 1)} · ↔ ${fmt(L.vx, 1)} m/s · ${L.uhel}°`)}
        ${g ? radek('Ghost', g.body + ' b.') : ''}
      </table>
      <div class="tlacitka"><button class="btn" type="button" data-prikaz="napoveda">❓ Ovládání</button><button class="btn primary" type="button" data-akce="start">🚀 Start</button></div>`);
  }

  function zobrazVysledek(novyRekord) {
    const k = s.konec, uspech = k.druh === 'pristani';
    const titul = { pristani: k.poskozeni ? '🛬 Tvrdé přistání' : '✅ Měkké přistání!', havarie: '💥 Havárie', mimo: '⚠️ Mimo plochu', ztracen: '🛰️ Ztracen v prostoru' }[k.druh];
    const posledni = !volny && kampanIdx === P.UROVNE.length - 1;
    let tl = '<button class="btn" type="button" data-prikaz="znovu">🔁 Znovu</button>';
    if (uspech && !volny && !posledni) tl += '<button class="btn primary" type="button" data-akce="dalsi">Další úroveň ▶</button>';
    else if (uspech && volny) tl += '<button class="btn primary" type="button" data-akce="novyTeren">🎲 Nový terén</button>';
    else tl = tl.replace('class="btn"', 'class="btn primary"');
    karta(`<h2>${titul}</h2>
      <p>${esc(k.duvod)}${autopilot ? ' (autopilot – nepočítá se)' : ''}</p>
      ${novyRekord ? '<div class="novy">🏆 Nový rekord úrovně!</div>' : ''}
      ${posledni && uspech ? '<div class="novy">🎉 Kampaň dokončena – přistál jsi na všech tělesech!</div>' : ''}
      <table>
        ${k.vy !== undefined ? radek('Svislá rychlost', fmt(k.vy, 2) + ' m/s') + radek('Vodorovná rychlost', fmt(k.vx, 2) + ' m/s') + radek('Náklon', fmt(k.uhel, 1) + '°') : ''}
        ${radek('Čas letu', fmt(s.cas, 1) + ' s')}
        ${radek('Zbylé palivo', fmt(s.palivo, 0) + ' kg (' + Math.round(s.palivo / U.palivo * 100) + ' %)')}
        ${uspech ? radek('Poškození', k.poskozeni + ' %') + radek('Násobič plochy', '×' + k.nasobic) + radek('Body', '<b>' + k.body + '</b>') : ''}
      </table>
      <div class="tlacitka">${tl}</div>`);
  }

  function spustLet() { if (rezim !== 'intro') return; skryjKartu(); rezim = 'let'; posledni = 0; akum = 0; }

  /* ---------- příkazy a menu ---------- */
  const prikazy = {
    kampan() { nactiUroven(Math.min(postup, cti('posledni', postup))); },
    znovu() { skryjKartu(); restart(); zobrazIntro(); },
    pauza() {
      if (rezim === 'let') { rezim = 'pauza'; karta(`<h2>⏸️ Pauza</h2><p>${esc(U.nazev)} – ${fmt(s.cas, 1)} s letu.</p><div class="tlacitka"><button class="btn" type="button" data-prikaz="znovu">🔁 Znovu</button><button class="btn primary" type="button" data-akce="pokracuj">▶ Pokračovat</button></div>`); }
      else if (rezim === 'pauza') pokracuj();
    },
    napoveda() { $('dlgNapoveda').showModal(); },
    autopilot() {
      skryjKartu(); restart(); autopilot = true; rezim = 'let'; posledni = 0;
      Dialog.info('Autopilot letí na plochu s nejvyšším násobičem – výsledek se nepočítá do rekordů.');
    },
    async smazPostup() {
      if (!await Dialog.potvrd('Smazat postup kampaně, rekordy všech úrovní a uložené ghosty?')) return;
      P.UROVNE.forEach(u => { rekord(u.id).vynuluj(); try { localStorage.removeItem(KLIC + 'ghost_' + u.id); } catch { /* nic */ } });
      postup = 0; uloz('postup', 0); uloz('posledni', 0); try { localStorage.removeItem(KLIC + 'dohrano'); } catch { /* nic */ }
      sestavUrovne(); nactiUroven(0);
      Dialog.info('Postup smazán.');
    },
  };
  function pokracuj() { skryjKartu(); rezim = 'let'; posledni = 0; akum = 0; }
  const akce = {
    start: spustLet,
    pokracuj,
    dalsi() { nactiUroven(Math.min(kampanIdx + 1, P.UROVNE.length - 1)); },
    novyTeren() { nactiUroven(0, volny.svet); },
  };
  $('zavritNapovedu').addEventListener('click', () => $('dlgNapoveda').close());

  function zavriNabidky() {
    document.querySelectorAll('.nabidka:not([hidden])').forEach(n => { n.hidden = true; });
    document.querySelectorAll('[data-nabidka][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const n = $(b.dataset.nabidka), bylo = !n.hidden;
    zavriNabidky();
    if (bylo) return;
    if (rezim === 'let') prikazy.pauza();
    n.hidden = false; b.setAttribute('aria-expanded', 'true');
    const r = b.getBoundingClientRect();
    n.style.top = (r.bottom + 4) + 'px';
    n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
  }));
  document.addEventListener('click', e => {
    const p = e.target.closest('[data-prikaz]');
    if (p) { e.stopPropagation(); zavriNabidky(); p.blur(); return prikazy[p.dataset.prikaz](); }
    const a = e.target.closest('[data-akce]');
    if (a) { a.blur(); return akce[a.dataset.akce](); }
    const u = e.target.closest('[data-uroven]');
    if (u) { zavriNabidky(); return nactiUroven(+u.dataset.uroven); }
    const sv = e.target.closest('[data-svet]');
    if (sv) { zavriNabidky(); return nactiUroven(0, sv.dataset.svet); }
    const pr = e.target.closest('[data-prepinac]');
    if (pr) { e.stopPropagation(); return prepni(pr.dataset.prepinac); }
    if (!e.target.closest('.nabidka')) zavriNabidky();
  });

  function ulozNast() { uloz('nastaveni', nast); }
  function prepni(co) {
    if (co === 'sas') { sas = !sas; nast.sas = sas; }
    else nast[co] = !nast[co];
    if (co === 'zvuk') Zvuk.ztlum(!nast.zvuk);
    ulozNast(); obnovPrepinace();
    if (co === 'sas' || co === 'ghost') Dialog.info((co === 'sas' ? 'SAS ' : 'Ghost ') + (nast[co] ? 'zapnut' : 'vypnut'));
  }
  function obnovPrepinace() {
    document.querySelectorAll('[data-prepinac]').forEach(b => b.setAttribute('aria-pressed', String(!!nast[b.dataset.prepinac])));
    $('dotyk').hidden = !nast.dotyk;
  }

  function esc(t) { return String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
  function sestavUrovne() {
    $('seznamUrovni').innerHTML = P.UROVNE.map((u, i) => {
      const zamceno = i > postup, r = rekord(u.id).hodnota();
      return `<button class="tl" type="button" data-uroven="${i}" ${zamceno ? 'disabled' : ''}>${zamceno ? '🔒' : IKONA[u.svet]} ${i + 1}. ${esc(u.nazev)}<span class="vpr">${r !== null ? r + ' b.' : ''}</span></button>`;
    }).join('');
    $('seznamSvetu').innerHTML = Object.keys(P.SVETY).map(k => `<button class="tl" type="button" data-svet="${k}">${IKONA[k]} ${esc(P.SVETY[k].nazev)}<span class="vpr">${fmt(P.SVETY[k].g, 2)} m/s²</span></button>`).join('');
  }

  /* ---------- přístroje a radar ---------- */
  function hud() {
    const h = P.prehled(U, T, s), L = U.limity;
    const tr = (el, txt, stav) => { const e = $(el); e.textContent = txt; e.className = stav || ''; };
    const stav = (v, lim) => v <= lim ? 'ok' : v <= lim * 2 ? 'pozor' : 'zle';
    const blizkoZeme = h.agl < 60;
    tr('hVyska', fmt(Math.max(0, h.agl), h.agl < 100 ? 1 : 0) + ' m');
    tr('hVy', fmt(h.vy, 1) + ' m/s', blizkoZeme ? stav(Math.max(0, -h.vy), L.vy) : '');
    tr('hVx', fmt(h.vx, 1) + ' m/s', blizkoZeme ? stav(Math.abs(h.vx), L.vx) : '');
    tr('hUhel', fmt(h.uhel, 0) + '°', blizkoZeme ? stav(Math.abs(h.uhel), L.uhel) : '');
    tr('hPalivo', fmt(s.palivo, 0) + ' kg', h.palivo < 0.15 ? 'zle' : h.palivo < 0.3 ? 'pozor' : '');
    const pr = $('hPalivoPruh');
    pr.style.width = (h.palivo * 100).toFixed(1) + '%';
    pr.style.background = h.palivo < 0.15 ? 'var(--danger)' : h.palivo < 0.3 ? 'var(--warn)' : 'var(--ok)';
    tr('hTah', Math.round(s.tah * 100) + ' %' + (sas ? ' · SAS' : ''));
    if (U.odpor) tr('hVitr', (h.vitr >= 0 ? '→ ' : '← ') + fmt(Math.abs(h.vitr), 1) + ' m/s');
    tr('hCas', fmt(s.cas, 1) + ' s');
    if (h.cil) $('rCil').textContent = `×${h.cil.plocha.nasobic} ${h.cil.dx >= 0 ? '→' : '←'} ${fmt(Math.abs(h.cil.dx), 0)} m · ↓ ${fmt(Math.max(0, h.cil.dy), 0)} m`;
    kresliRadar(h);
  }

  function velikostPlatna(c, x) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(c.clientWidth * dpr), hh = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== hh) { c.width = w; c.height = hh; }
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    return [c.clientWidth, c.clientHeight];
  }

  function kresliRadar(h) {
    const [W, H] = velikostPlatna(radar, rctx);
    const pol = 150, x0 = s.x - pol;               // ±150 m kolem modulu
    rctx.fillStyle = '#04140c'; rctx.fillRect(0, 0, W, H);
    const yMin = Math.min(P.vyskaTerenu(T, s.x) - 10, s.y - 40), rozsah = Math.max(60, Math.min(400, h.agl * 1.6 + 30));
    const sy = y => H - (y - yMin) / rozsah * H, sx = x => (x - x0) / (2 * pol) * W;
    rctx.strokeStyle = 'rgba(90,255,150,0.18)'; rctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) { rctx.beginPath(); rctx.moveTo(0, H * i / 4); rctx.lineTo(W, H * i / 4); rctx.stroke(); }
    rctx.beginPath();
    for (let i = 0; i <= 60; i++) { const x = x0 + i / 60 * 2 * pol; rctx.lineTo(sx(x), sy(P.vyskaTerenu(T, Math.max(0, Math.min(T.sirka, x))))); }
    rctx.lineTo(W, H); rctx.lineTo(0, H); rctx.closePath();
    rctx.fillStyle = 'rgba(60,200,110,0.25)'; rctx.fill();
    rctx.strokeStyle = '#5cff96'; rctx.stroke();
    for (const p of T.plochy) {
      if (p.x2 < x0 || p.x1 > x0 + 2 * pol) continue;
      rctx.fillStyle = '#ffd34d'; rctx.fillRect(sx(p.x1), sy(p.y) - 2, sx(p.x2) - sx(p.x1), 4);
    }
    // modul a vektor rychlosti
    const mx = sx(s.x), my = Math.max(4, sy(s.y));
    rctx.fillStyle = '#fff'; rctx.beginPath(); rctx.arc(mx, my, 3, 0, 7); rctx.fill();
    rctx.strokeStyle = '#fff'; rctx.beginPath(); rctx.moveTo(mx, my); rctx.lineTo(mx + s.vx * 1.5, my - s.vy * 1.5); rctx.stroke();
    // šipka k nejbližší ploše mimo radar
    if (h.cil && Math.abs(h.cil.dx) > pol) {
      rctx.fillStyle = '#ffd34d'; rctx.font = 'bold 13px system-ui'; rctx.textBaseline = 'top';
      rctx.textAlign = h.cil.dx > 0 ? 'right' : 'left';
      rctx.fillText(h.cil.dx > 0 ? '▶' : '◀', h.cil.dx > 0 ? W - 3 : 3, 3);
    }
  }

  /* ---------- kamera a scéna ---------- */
  function aktualizujKameru(W, H, dt) {
    const h = P.prehled(U, T, s);
    const wMax = Math.min(T.sirka, Math.max(300, 1100 * W / H));      // na výšku telefonu nezmenšovat modul do tečky
    const cil = Math.max(140, Math.min(wMax, h.agl * 3.2 + 120));
    if (!kamera) kamera = { w: cil, x0: 0, y0: 0 };
    kamera.w += (cil - kamera.w) * Math.min(1, dt * 2.2);
    const k = W / kamera.w, viewH = H / k;
    const xCil = Math.max(0, Math.min(T.sirka - kamera.w, s.x - kamera.w / 2));
    const zem = P.vyskaTerenu(T, s.x);
    const yCil = Math.max(zem - 0.28 * viewH, s.y - 0.78 * viewH);
    if (kamera.prvni === undefined) { kamera.x0 = xCil; kamera.y0 = yCil; kamera.prvni = false; }
    kamera.x0 += (xCil - kamera.x0) * Math.min(1, dt * 4);
    kamera.y0 += (yCil - kamera.y0) * Math.min(1, dt * 4);
    return k;
  }

  function kresli(dt) {
    if (!s) return;
    const [W, H] = velikostPlatna(platno, ctx);
    const k = aktualizujKameru(W, H, dt);
    const X = x => (x - kamera.x0) * k, Y = y => H - (y - kamera.y0) * k;
    const pal = PALETY[U.svet];
    // nebe
    const gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, pal.nebe[0]); gr.addColorStop(1, pal.nebe[1]);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    if (pal.hvezdy) {
      ctx.fillStyle = '#fff';
      for (const [hx, hy, r, j] of hvezdy) {
        ctx.globalAlpha = pal.hvezdy * (0.35 + 0.65 * j);
        ctx.fillRect(((hx * W * 1.2 - kamera.x0 * 0.02) % W + W) % W, hy * H * 0.9, r, r);
      }
      ctx.globalAlpha = 1;
    }
    const m = Math.min(W, H);
    if (pal.planeta) kresliPlanetu(pal.planeta, W, H, m);
    if (pal.slunce) {
      const sl = pal.slunce, sx = sl.x * W, sy = sl.y * H, r = Math.max(4, sl.r * m);
      const g2 = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 4);
      g2.addColorStop(0, 'rgba(255,250,230,1)'); g2.addColorStop(0.25, 'rgba(255,240,200,0.6)'); g2.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(sx, sy, r * 4, 0, 7); ctx.fill();
    }
    // terén
    const i0 = Math.max(0, Math.floor(kamera.x0 / T.krok) - 1), i1 = Math.min(T.h.length - 1, Math.ceil((kamera.x0 + W / k) / T.krok) + 1);
    ctx.beginPath(); ctx.moveTo(X(i0 * T.krok), H + 5);
    for (let i = i0; i <= i1; i++) ctx.lineTo(X(i * T.krok), Y(T.h[i]));
    ctx.lineTo(X(i1 * T.krok), H + 5); ctx.closePath();
    const gt = ctx.createLinearGradient(0, Y(T.max), 0, Y(T.min - 60));
    gt.addColorStop(0, pal.teren[0]); gt.addColorStop(1, pal.teren[1]);
    ctx.fillStyle = gt; ctx.fill();
    ctx.strokeStyle = pal.obrys; ctx.lineWidth = 1.5; ctx.stroke();
    if (pal.praskliny) {
      ctx.strokeStyle = pal.praskliny; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
      for (let i = i0; i < i1; i += 3) { const x = i * T.krok + 3; ctx.beginPath(); ctx.moveTo(X(x), Y(T.h[i] - 1)); ctx.lineTo(X(x + 6), Y(T.h[i] - 14)); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    // okraje oblasti
    ctx.fillStyle = 'rgba(255,60,60,0.12)';
    if (X(0) > 0) ctx.fillRect(0, 0, X(0), H);
    if (X(T.sirka) < W) ctx.fillRect(X(T.sirka), 0, W - X(T.sirka), H);
    // přistávací plochy
    const blik = (performance.now() / 500 | 0) % 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    for (const p of T.plochy) {
      const x1 = X(p.x1), x2 = X(p.x2), y = Y(p.y);
      if (x2 < -40 || x1 > W + 40) continue;
      ctx.fillStyle = '#e8e8e8'; ctx.fillRect(x1, y - 1, x2 - x1, Math.max(3, 0.6 * k));
      ctx.fillStyle = blik ? '#ffd34d' : '#ff9a1f';
      const r = Math.max(2, 0.5 * k);
      ctx.beginPath(); ctx.arc(x1 + r, y - r, r, 0, 7); ctx.arc(x2 - r, y - r, r, 0, 7); ctx.fill();
      ctx.font = `700 ${Math.round(Math.max(12, Math.min(22, 2.6 * k)))}px system-ui,sans-serif`;
      ctx.fillStyle = '#ffd34d';
      if (k > 5) { ctx.textAlign = 'left'; ctx.fillText('×' + p.nasobic, x2 + 6, y - 2); ctx.textAlign = 'center'; }   // při přiblížení vedle plochy, ne pod modulem
      else ctx.fillText('×' + p.nasobic, (x1 + x2) / 2, y - 6);
    }
    // předpověď dráhy
    if (nast.drah && rezim === 'let') {
      const kopie = Object.assign({}, s), v = vstup();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (let i = 1; i <= 180 && !kopie.konec; i++) {
        P.krok(U, T, kopie, v);
        if (i % 10 === 0) ctx.fillRect(X(kopie.x) - 1, Y(kopie.y) - 1, 2.5, 2.5);
      }
    }
    // ghost
    if (nast.ghost && gStav) { ctx.globalAlpha = 0.35; kresliModul(gStav, X, Y, k, true); ctx.globalAlpha = 1; }
    // částice
    for (const c of castice) {
      ctx.globalAlpha = Math.max(0, c.zivot / c.max);
      ctx.fillStyle = c.barva;
      const r = Math.max(1, c.vel * k);
      ctx.fillRect(X(c.x) - r / 2, Y(c.y) - r / 2, r, r);
    }
    ctx.globalAlpha = 1;
    if (!(s.konec && s.konec.druh === 'havarie')) {
      kresliModul(s, X, Y, k, false);
      if (k * 6.4 < 16) {                       // malý modul ve velkém pohledu: kroužek, ať se neztratí
        ctx.strokeStyle = 'rgba(255,211,77,0.7)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(X(s.x), Y(s.y), 11, 0, 7); ctx.stroke();
      }
    }
    if (pal.mlha) { ctx.fillStyle = pal.mlha; ctx.fillRect(0, 0, W, H); }
  }

  function kresliPlanetu(pl, W, H, m) {
    const x = pl.x * W, y = pl.y * H, r = pl.r * m;
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.clip();
    ctx.fillStyle = pl.barva; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    if (pl.pruhy) {
      ctx.fillStyle = pl.pruhy;
      for (let i = -3; i <= 3; i++) ctx.fillRect(x - r, y + i * r * 0.27 - r * 0.05, 2 * r, r * (0.06 + 0.04 * (i & 1)));
      ctx.fillStyle = '#b5523a'; ctx.beginPath(); ctx.ellipse(x + r * 0.35, y + r * 0.3, r * 0.16, r * 0.09, 0, 0, 7); ctx.fill();
    }
    if (pl.pevnina) {
      ctx.fillStyle = pl.pevnina;
      ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.1, r * 0.35, r * 0.5, 0.4, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + r * 0.4, y + r * 0.35, r * 0.25, r * 0.2, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(x - r, y - r * 0.15, 2 * r, r * 0.07);
    }
    const st = ctx.createLinearGradient(x - r, y, x + r, y);       // terminátor
    st.addColorStop(0, 'rgba(0,0,0,0)'); st.addColorStop(0.55, 'rgba(0,0,0,0.1)'); st.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = st; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    ctx.restore();
  }

  /* Modul „Vážka" v lokálních metrech (y nahoru). */
  function kresliModul(st, X, Y, k, jeGhost) {
    ctx.save();
    ctx.translate(X(st.x), Y(st.y));
    ctx.rotate(st.uhel);
    ctx.scale(k, -k);
    ctx.lineWidth = 0.18; ctx.lineJoin = 'round';
    // plamen
    if (st.tah > 0 && !st.konec) {
      const d = (2 + st.tah * 5) * (0.85 + Math.random() * 0.3);
      const g = ctx.createLinearGradient(0, -1.8, 0, -1.8 - d);
      g.addColorStop(0, jeGhost ? '#9cf' : '#fff6c0'); g.addColorStop(0.4, jeGhost ? '#69c' : '#ffa030'); g.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-0.75, -1.8); ctx.quadraticCurveTo(0, -1.8 - d * 1.3, 0.75, -1.8); ctx.closePath(); ctx.fill();
    }
    // RCS obláčky
    if (!jeGhost && Math.abs(st.rcs) > 0.05 && !st.konec) {
      ctx.fillStyle = 'rgba(230,240,255,0.8)';
      const str = st.rcs > 0 ? 1 : -1;
      ctx.beginPath(); ctx.arc(-2.6 * str, 2.2, 0.35 + Math.random() * 0.2, 0, 7); ctx.arc(2.6 * str, 0.2, 0.35 + Math.random() * 0.2, 0, 7); ctx.fill();
    }
    const barvy = jeGhost ? { zlato: '#8fd8ff', sede: '#bfe9ff', obrys: '#dff6ff', okno: '#335' } : { zlato: '#d8a53a', sede: '#c9ccd2', obrys: '#2a2a2a', okno: '#1b2a44' };
    ctx.strokeStyle = barvy.obrys;
    // nohy
    ctx.lineWidth = 0.22;
    for (const str of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(2.0 * str, -0.4); ctx.lineTo(3.2 * str, -2.4); ctx.moveTo(1.2 * str, -1.0); ctx.lineTo(3.2 * str, -2.4); ctx.strokeStyle = jeGhost ? barvy.obrys : '#9a9a9a'; ctx.stroke();
      ctx.fillStyle = jeGhost ? barvy.obrys : '#bbb'; ctx.fillRect(3.2 * str - 0.6, -2.6, 1.2, 0.25);
    }
    ctx.strokeStyle = barvy.obrys; ctx.lineWidth = 0.15;
    // tryska
    ctx.fillStyle = '#555'; ctx.beginPath(); ctx.moveTo(-0.5, -1.0); ctx.lineTo(0.5, -1.0); ctx.lineTo(0.8, -1.8); ctx.lineTo(-0.8, -1.8); ctx.closePath(); ctx.fill(); ctx.stroke();
    // sestupový stupeň (zlatá fólie)
    ctx.fillStyle = barvy.zlato;
    ctx.beginPath(); ctx.moveTo(-2.4, -0.4); ctx.lineTo(-1.9, -1.0); ctx.lineTo(1.9, -1.0); ctx.lineTo(2.4, -0.4); ctx.lineTo(2.4, 0.7); ctx.lineTo(-2.4, 0.7); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (!jeGhost) { ctx.strokeStyle = 'rgba(120,80,10,0.6)'; ctx.beginPath(); ctx.moveTo(-0.8, -1); ctx.lineTo(-0.8, 0.7); ctx.moveTo(0.8, -1); ctx.lineTo(0.8, 0.7); ctx.stroke(); ctx.strokeStyle = barvy.obrys; }
    // vzletový stupeň
    ctx.fillStyle = barvy.sede;
    ctx.beginPath(); ctx.moveTo(-2.0, 0.7); ctx.lineTo(-2.2, 1.8); ctx.lineTo(-1.2, 2.6); ctx.lineTo(1.4, 2.6); ctx.lineTo(2.1, 1.7); ctx.lineTo(2.0, 0.7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = barvy.okno; ctx.beginPath(); ctx.moveTo(-1.5, 1.6); ctx.lineTo(-1.0, 2.2); ctx.lineTo(-0.2, 2.2); ctx.lineTo(-0.2, 1.6); ctx.closePath(); ctx.fill();
    // anténa
    ctx.beginPath(); ctx.moveTo(1.0, 2.6); ctx.lineTo(1.0, 3.3); ctx.stroke();
    ctx.beginPath(); ctx.arc(1.0, 3.35, 0.25, 0, 7); ctx.fillStyle = barvy.sede; ctx.fill();
    ctx.restore();
  }

  /* ---------- částice (jen efekt, mimo fyziku) ---------- */
  function aktualizujCastice(dt) {
    if (rezim === 'let' && s.tah > 0.2 && !s.konec) {
      const zem = P.vyskaTerenu(T, s.x), agl = s.y - 2.6 - zem;
      if (agl < 25 && Math.cos(s.uhel) > 0.5) {
        const n = Math.round(s.tah * (25 - agl) / 6);
        for (let i = 0; i < n; i++) {
          const str = Math.random() < 0.5 ? -1 : 1;
          castice.push({ x: s.x + Math.random() * 2 - 1, y: zem + 0.3, vx: str * (6 + Math.random() * 14) * (1 - agl / 30), vy: Math.random() * 2.5, zivot: 0.8 + Math.random() * 0.6, max: 1.4, barva: PALETY[U.svet].obrys, vel: 0.3 + Math.random() * 0.3, g: 0.4 });
        }
      }
    }
    for (const c of castice) {
      c.zivot -= dt; c.vy -= U.g * (c.g || 1) * dt;
      c.x += c.vx * dt; c.y += c.vy * dt;
      const zem = P.vyskaTerenu(T, c.x);
      if (c.y < zem) { c.y = zem; c.vy *= -0.3; c.vx *= 0.6; }
    }
    castice = castice.filter(c => c.zivot > 0);
    if (castice.length > 600) castice.splice(0, castice.length - 600);
  }
  function prach(x, y, n) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI; castice.push({ x, y, vx: Math.cos(a) * (3 + Math.random() * 6), vy: Math.sin(a) * 2, zivot: 1 + Math.random(), max: 2, barva: PALETY[U.svet].obrys, vel: 0.35, g: 0.3 }); }
  }
  function vybuch(x, y) {
    const barvy = ['#ffd34d', '#ff8a1f', '#ff4d1f', '#d8a53a', '#c9ccd2', '#888'];
    for (let i = 0; i < 140; i++) {
      const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 18;
      castice.push({ x, y, vx: Math.cos(a) * v, vy: Math.abs(Math.sin(a)) * v + 2, zivot: 1 + Math.random() * 2, max: 3, barva: barvy[i % barvy.length], vel: 0.3 + Math.random() * 0.7 });
    }
  }

  /* ---------- start ---------- */
  obnovPrepinace();
  sestavUrovne();
  const hash = location.hash.match(/^#(\d+)$/);
  nactiUroven(hash ? Math.min(+hash[1] - 1, postup) : Math.min(cti('posledni', postup), postup));
  requestAnimationFrame(smycka);
  window.PRISTANI_HRA = { prikazy, akce, stav: () => s, rezim: () => rezim, nactiUroven, uroven: () => [U, T], ghost: () => gStav };
})();
