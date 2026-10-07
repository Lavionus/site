// Nad krajinou — vstup: klávesnice, gamepad, RC vysílačka přes USB, dotykové páky, nastavení ovládání.
// Rozhraní je závazné, viz Dron_PLAN.md › Vstup:
//   D.vstup.cti(ctx) → { plyn 0..1, yaw, pitch, roll, gimbal ∈ −1..1, plynStred, prepinace { arm, rezim, sport }, udalosti [] }
//   pitch +1 = páka od sebe (nos dolů, vpřed), roll +1 = doprava, yaw +1 = doprava,
//   gimbal = rychlost naklápění kamery (+1 nahoru, −1 dolů).
//   prepinace.rezim = poloha přepínače režimu na vysílačce (0, 1, 2), jinak undefined (klávesa M posílá událost 'rezim').
// Čistá logika (mapování, expo, kalibrace) je v D.VSTUP a testuje se v node (_test/dron_vstup_test.js).
(function (D) {
  'use strict';
  const KLIC = 'webapp_dron_ovladani';
  const PROHLIZEC = typeof window !== 'undefined' && typeof document !== 'undefined';
  const FUNKCE = ['plyn', 'yaw', 'pitch', 'roll'];

  // ======================================================================
  // Čistá logika
  // ======================================================================
  const L = {};
  L.clamp = (x, a, b) => x < a ? a : x > b ? b : x;

  // expo jako ve vysílačkách: e = 0 lineární, e = 1 kubické; střed je jemnější, krajní výchylka zůstává 1
  L.expo = (x, e) => (1 - e) * x + e * x * x * x;

  // mrtvá zóna s přeškálováním (za hranou zóny začíná výstup od nuly, ne skokem)
  L.mrtvaZona = (x, dz) => {
    const a = Math.abs(x);
    if (a <= dz) return 0;
    return Math.sign(x) * Math.min(1, (a - dz) / (1 - dz));
  };

  // plynulé „páky z kláves“: k cíli rychlostí nabeh (od středu ven), navrat (zpět ke středu / přes střed)
  L.rampa = (akt, cil, dt, nabeh, navrat) => {
    const ven = cil !== 0 && (akt === 0 || Math.sign(cil) === Math.sign(akt)) && Math.abs(cil) > Math.abs(akt);
    const krok = (ven ? nabeh : navrat) * dt;
    if (Math.abs(cil - akt) <= krok) return cil;
    return akt + Math.sign(cil - akt) * krok;
  };

  // dvě páky (x doprava +, y nahoru/od sebe +) → funkce podle módu.
  // Mode 2: levá = plyn (y) + yaw (x), pravá = pitch (y) + roll (x).  Mode 1: levá = pitch + yaw, pravá = plyn + roll.
  // plynOsa je −1..1 (střed páky = 0).
  L.mapujPaky = (p, mode) => mode === 1
    ? { plynOsa: p.ry, yaw: p.lx, pitch: p.ly, roll: p.rx }
    : { plynOsa: p.ly, yaw: p.lx, pitch: p.ry, roll: p.rx };
  // a zpět (pro náhled pák v nastavení)
  L.pakyZFunkci = (f, mode) => mode === 1
    ? { lx: f.yaw, ly: f.pitch, rx: f.roll, ry: f.plynOsa }
    : { lx: f.yaw, ly: f.plynOsa, rx: f.roll, ry: f.pitch };

  // jedna osa páky: mrtvá zóna → expo → citlivost → obrácení
  L.zpracujOsu = (x, o) => {
    let v = L.mrtvaZona(L.clamp(x, -1, 1), o.mrtvaZona || 0);
    if (o.expo) v = L.expo(v, o.expo);
    if (o.citlivost != null) v *= o.citlivost;
    return o.invert ? -v : v;
  };

  // kalibrovaná osa vysílačky → −1..1 (po částech: min..střed, střed..max), smer −1 obrací
  L.osaZKalibrace = (raw, k) => {
    const d = raw - k.stred;
    let v = d >= 0 ? d / Math.max(1e-6, k.max - k.stred) : d / Math.max(1e-6, k.stred - k.min);
    v = L.clamp(v, -1, 1);
    return k.smer < 0 ? -v : v;
  };
  // kalibrovaný plyn → 0..1 (páka dole = 0)
  L.plynZKalibrace = (raw, k) => {
    let v = (raw - k.min) / Math.max(1e-6, k.max - k.min);
    v = L.clamp(v, 0, 1);
    return k.smer < 0 ? 1 - v : v;
  };
  // poloha přepínače z hodnoty osy −1..1 (2 nebo 3 polohy)
  L.poloha = (v, n) => n === 2 ? (v > 0 ? 1 : 0) : (v < -0.33 ? 0 : v > 0.33 ? 2 : 1);

  // ---- kalibrace vysílačky (krok za krokem, data jen čísla) ----
  L.novaKalibrace = (osy) => ({ min: osy.slice(), max: osy.slice(), stred: osy.slice(), klid: osy.slice() });
  L.kalibraceExtremy = (kal, osy) => {
    for (let i = 0; i < osy.length; i++) {
      if (!(osy[i] >= kal.min[i])) kal.min[i] = osy[i];
      if (!(osy[i] <= kal.max[i])) kal.max[i] = osy[i];
    }
    return kal;
  };
  // osa s největší poměrnou výchylkou od středu (vyloucene = indexy už přiřazených os)
  L.najdiOsu = (kal, osy, vyloucene, prah) => {
    let nej = null;
    for (let i = 0; i < osy.length; i++) {
      if (vyloucene && vyloucene.includes(i)) continue;
      const rozsah = Math.max(1e-6, (kal.max[i] - kal.min[i]) / 2);
      if (rozsah < 0.2) continue;                                   // osa, která se během kalibrace nehnula
      const odch = (osy[i] - kal.stred[i]) / rozsah;
      if (Math.abs(odch) >= (prah || 0.5) && (!nej || Math.abs(odch) > Math.abs(nej.odchylka))) nej = { index: i, smer: Math.sign(odch), odchylka: odch };
    }
    return nej;
  };
  // přiřazení funkce: index + směr + rozsahy z kalibrace
  L.prirazeni = (kal, nalez) => ({ index: nalez.index, smer: nalez.smer, min: kal.min[nalez.index], stred: kal.stred[nalez.index], max: kal.max[nalez.index] });
  // přepínač: co se změnilo proti snímku na začátku kroku (osa o víc než 0,5, nebo tlačítko)
  L.najdiPrepinac = (predOsy, predTl, osy, tl, vyloucene) => {
    let nej = null;
    for (let i = 0; i < osy.length; i++) {
      if (vyloucene && vyloucene.includes(i)) continue;
      const d = Math.abs(osy[i] - predOsy[i]);
      if (d > 0.5 && (!nej || d > nej.zmena)) nej = { typ: 'osa', index: i, zap: osy[i], vyp: predOsy[i], zmena: d };
    }
    if (nej) return nej;
    for (let i = 0; i < tl.length; i++) if (!!tl[i] !== !!predTl[i]) return { typ: 'tlacitko', index: i, zap: tl[i] ? 1 : 0, vyp: predTl[i] ? 1 : 0, zmena: 1 };
    return null;
  };
  // hodnota přepínače (osa nebo tlačítko) z dat gamepadu
  L.hodnotaPrepinace = (p, osy, tl) => p.typ === 'osa' ? (osy[p.index] || 0) : (tl[p.index] ? 1 : 0);
  L.armZPrepinace = (p, osy, tl) => {
    const v = L.hodnotaPrepinace(p, osy, tl);
    return Math.abs(v - p.zap) < Math.abs(v - p.vyp);
  };
  L.rezimZPrepinace = (p, osy, tl) => p.typ === 'osa' ? L.poloha(osy[p.index] || 0, p.polohy || 3) : (tl[p.index] ? 1 : 0);

  // vypadá zařízení jako vysílačka? (nestandardní mapování, známá jména)
  L.jeRc = (gp) => {
    if (!gp) return false;
    if (/radiomaster|jumper|frsky|taranis|edgetx|opentx|betafpv|tx16|tx12|zorro|boxer|t-?lite|flysky|spektrum|literadio|pocket|rc ?joystick|stm32/i.test(gp.id || '')) return true;
    return gp.mapping !== 'standard' && (gp.axes ? gp.axes.length : 0) >= 4 && !/xbox|playstation|dualshock|dualsense|gamepad|controller|8bitdo|wireless/i.test(gp.id || '');
  };
  // výchozí odhad bez kalibrace: AETR (EdgeTX/OpenTX joystick: CH1 křidélka, CH2 výškovka, CH3 plyn, CH4 směrovka)
  L.vychoziRcOsy = () => ({
    roll: { index: 0, smer: 1, min: -1, stred: 0, max: 1 },
    pitch: { index: 1, smer: 1, min: -1, stred: 0, max: 1 },
    plyn: { index: 2, smer: 1, min: -1, stred: 0, max: 1 },
    yaw: { index: 3, smer: 1, min: -1, stred: 0, max: 1 },
  });

  L.vychoziNastaveni = () => ({
    verze: 1,
    zdroj: 'auto',              // auto | klavesnice | gamepad | rc | dotyk
    mode: 2,
    rozlozeni: 'wasd',          // wasd: WASD = levá páka, šipky = pravá; obracene: naopak
    plynDrzi: false,            // klávesnice: plyn drží polohu (W/S přidává a ubírá)
    autoArm: true,              // klávesnice/gamepad/dotyk: plyn nahoru nastartuje motory
    citlivost: 1,
    expo: 0.3,
    mrtvaZona: 0.08,
    invert: { plyn: false, yaw: false, pitch: false, roll: false },
    rc: { kalibrovano: false, id: '', osy: null, arm: null, rezim: null, mrtvaZona: 0.02, expo: false },
  });
  // sloučení uloženého nastavení s výchozím (chybějící nebo vadné položky → výchozí)
  L.sloucNastaveni = (u) => {
    const n = L.vychoziNastaveni();
    if (!u || typeof u !== 'object') return n;
    if (['auto', 'klavesnice', 'gamepad', 'rc', 'dotyk'].includes(u.zdroj)) n.zdroj = u.zdroj;
    if (u.mode === 1 || u.mode === 2) n.mode = u.mode;
    if (u.rozlozeni === 'wasd' || u.rozlozeni === 'obracene') n.rozlozeni = u.rozlozeni;
    if (typeof u.plynDrzi === 'boolean') n.plynDrzi = u.plynDrzi;
    if (typeof u.autoArm === 'boolean') n.autoArm = u.autoArm;
    for (const [k, a, b] of [['citlivost', 0.2, 1], ['expo', 0, 1], ['mrtvaZona', 0, 0.4]]) if (typeof u[k] === 'number' && isFinite(u[k])) n[k] = L.clamp(u[k], a, b);
    if (u.invert) for (const f of FUNKCE) n.invert[f] = !!u.invert[f];
    if (u.rc && typeof u.rc === 'object') {
      const r = u.rc;
      if (typeof r.mrtvaZona === 'number' && isFinite(r.mrtvaZona)) n.rc.mrtvaZona = L.clamp(r.mrtvaZona, 0, 0.3);
      n.rc.expo = !!r.expo;
      n.rc.id = String(r.id || '');
      const okOsa = o => o && Number.isInteger(o.index) && o.index >= 0 && [o.min, o.stred, o.max].every(Number.isFinite) && (o.smer === 1 || o.smer === -1);
      if (r.osy && FUNKCE.every(f => okOsa(r.osy[f]))) { n.rc.osy = r.osy; n.rc.kalibrovano = !!r.kalibrovano; }
      const okPr = p => p && (p.typ === 'osa' || p.typ === 'tlacitko') && Number.isInteger(p.index) && Number.isFinite(p.zap) && Number.isFinite(p.vyp);
      if (okPr(r.arm)) n.rc.arm = r.arm;
      if (okPr(r.rezim)) n.rc.rezim = r.rezim;
    }
    return n;
  };

  // klávesy → cíle pák (−1, 0, 1). dole = Set kódů kláves.
  const KL_LEVA = { nahoru: ['KeyW'], dolu: ['KeyS'], vlevo: ['KeyA'], vpravo: ['KeyD'] };
  const KL_PRAVA = { nahoru: ['ArrowUp', 'KeyI'], dolu: ['ArrowDown', 'KeyK'], vlevo: ['ArrowLeft', 'KeyJ'], vpravo: ['ArrowRight', 'KeyL'] };
  L.pakyZKlaves = (dole, rozlozeni) => {
    const [le, pr] = rozlozeni === 'obracene' ? [KL_PRAVA, KL_LEVA] : [KL_LEVA, KL_PRAVA];
    const m = sez => sez.some(k => dole.has(k)) ? 1 : 0;
    return { lx: m(le.vpravo) - m(le.vlevo), ly: m(le.nahoru) - m(le.dolu), rx: m(pr.vpravo) - m(pr.vlevo), ry: m(pr.nahoru) - m(pr.dolu) };
  };
  // klávesy událostí (fyzický kód klávesy)
  L.UDALOSTI_KLAVES = { KeyC: 'kamera', KeyF: 'foto', KeyR: 'reset', KeyP: 'pauza', Escape: 'pauza', KeyM: 'rezim', KeyH: 'domu', Space: 'arm' };
  // standardní gamepad: tlačítko → událost (hrany stisku)
  L.UDALOSTI_GAMEPADU = { 0: 'arm', 1: 'kamera', 2: 'foto', 3: 'rezim', 5: 'domu', 8: 'reset', 9: 'pauza' };

  D.VSTUP = L;

  // ======================================================================
  // Stav vstupu (prohlížeč)
  // ======================================================================
  let N = L.vychoziNastaveni();
  function nacti() {
    try { N = L.sloucNastaveni(JSON.parse(localStorage.getItem(KLIC) || 'null')); } catch (e) { N = L.vychoziNastaveni(); }
  }
  function uloz() { try { localStorage.setItem(KLIC, JSON.stringify(N)); } catch (e) { /* soukromé okno */ } }
  if (PROHLIZEC) nacti();

  const dole = new Set();                 // stisknuté klávesy
  const fronta = [];                      // události do příštího cti()
  const klav = { plyn: 0, yaw: 0, pitch: 0, roll: 0, plynDrzi: 0 };   // rampy kláves (plyn −1..1, plynDrzi 0..1)
  const dotyk = { lx: 0, ly: 0, rx: 0, ry: 0, aktivni: false, el: null };
  const gp = { pred: {}, ref: null, posledniId: '', aktivni: false };
  let armSw = false, armCas = 0, disarmCas = 0, aktivniZdroj = 'klavesnice', posledniCas = 0;

  function pridej(u) {
    if (u === 'arm') { armSw = !armSw; return; }
    fronta.push(u);
  }

  function vInputu(t) {
    return t && (/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(t.tagName) || t.isContentEditable);
  }

  if (PROHLIZEC) {
    addEventListener('keydown', e => {
      if (vInputu(e.target)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;              // Ctrl+R, Ctrl+F … nechat prohlížeči
      const k = e.code;
      if (!e.repeat && L.UDALOSTI_KLAVES[k]) pridej(L.UDALOSTI_KLAVES[k]);
      dole.add(k);
      if (/^(Arrow|Page)|^Space$/.test(k)) e.preventDefault();
      if (/^Key[WASDIJKL]$|^Arrow/.test(k) && (N.zdroj === 'auto')) aktivniZdroj = 'klavesnice';
    });
    addEventListener('keyup', e => dole.delete(e.code));
    addEventListener('blur', () => dole.clear());
    // po havárii, resetu a novém letu motory vypnout (nový start = znovu nastartovat)
    D.na && D.na('havarie', () => { armSw = false; });
    D.na && D.na('novyLet', () => { armSw = false; klav.plynDrzi = 0; });
    D.na && D.na('reset', () => { armSw = false; klav.plynDrzi = 0; });
  }

  // ---------- gamepad / vysílačka ----------
  function vsechnyGamepady() {
    if (!PROHLIZEC || !navigator.getGamepads) return [];
    try { return Array.from(navigator.getGamepads()).filter(g => g && g.connected !== false); } catch (e) { return []; }
  }
  // vybere zařízení: pro RC přednostně vysílačku (podle uloženého id nebo odhadu), jinak první standardní
  function vyberGamepad(chciRc) {
    const vse = vsechnyGamepady();
    if (!vse.length) return null;
    if (chciRc) return vse.find(g => N.rc.id && g.id === N.rc.id) || vse.find(L.jeRc) || vse[0];
    return vse.find(g => g.mapping === 'standard') || vse.find(g => !L.jeRc(g)) || vse[0];
  }
  const osyGp = g => Array.from(g.axes || [], v => +v || 0);
  const tlGp = g => Array.from(g.buttons || [], b => !!(b && (b.pressed || b.value > 0.5)));

  // změnilo se na zařízení něco (pro automatickou volbu zdroje)? Porovnává s referencí, ne s nulou (plyn RC stojí dole).
  function gpPohyb(g) {
    const o = osyGp(g), t = tlGp(g);
    if (!gp.ref || gp.ref.id !== g.id || gp.ref.o.length !== o.length) { gp.ref = { id: g.id, o, t }; return false; }
    let pohyb = t.some((x, i) => x && !gp.ref.t[i]);
    for (let i = 0; i < o.length; i++) if (Math.abs(o[i] - gp.ref.o[i]) > 0.25) pohyb = true;
    if (pohyb) gp.ref = { id: g.id, o, t };
    return pohyb;
  }

  // hrany stisku tlačítek → události
  function tlacitkaNaUdalosti(g, mapa) {
    const t = tlGp(g), pred = gp.pred[g.index] || [];
    for (const i in mapa) if (t[i] && !pred[i]) pridej(mapa[i]);
    gp.pred[g.index] = t;
  }

  function ctiGamepad(g) {
    const a = osyGp(g), b = g.buttons || [];
    const bv = i => b[i] ? (+b[i].value || (b[i].pressed ? 1 : 0)) : 0;
    const p = L.mapujPaky({ lx: a[0] || 0, ly: -(a[1] || 0), rx: a[2] || 0, ry: -(a[3] || 0) }, N.mode);
    const o = { mrtvaZona: N.mrtvaZona, expo: N.expo, citlivost: N.citlivost };
    const plynOsa = L.zpracujOsu(p.plynOsa, { mrtvaZona: N.mrtvaZona, invert: N.invert.plyn });
    tlacitkaNaUdalosti(g, L.UDALOSTI_GAMEPADU);
    return {
      plyn: 0.5 + 0.5 * plynOsa,
      yaw: L.zpracujOsu(p.yaw, Object.assign({ invert: N.invert.yaw }, o)),
      pitch: L.zpracujOsu(p.pitch, Object.assign({ invert: N.invert.pitch }, o)),
      roll: L.zpracujOsu(p.roll, Object.assign({ invert: N.invert.roll }, o)),
      gimbal: L.clamp(bv(6) - bv(7) + bv(12) - bv(13), -1, 1),    // LT / kříž nahoru = kamera nahoru, RT / dolů = dolů
      plynStred: true,
      sport: bv(4) > 0.5,                                           // LB držet = sport
    };
  }

  function ctiRc(g) {
    const a = osyGp(g), t = tlGp(g);
    const R = N.rc, osy = R.osy || L.vychoziRcOsy();
    const val = f => a[osy[f].index] || 0;
    const o = f => ({ mrtvaZona: R.mrtvaZona, expo: R.expo ? N.expo : 0, invert: N.invert[f] });
    let plyn = L.plynZKalibrace(val('plyn'), osy.plyn);
    if (N.invert.plyn) plyn = 1 - plyn;
    const v = {
      plyn,
      yaw: L.zpracujOsu(L.osaZKalibrace(val('yaw'), osy.yaw), o('yaw')),
      pitch: L.zpracujOsu(L.osaZKalibrace(val('pitch'), osy.pitch), o('pitch')),
      roll: L.zpracujOsu(L.osaZKalibrace(val('roll'), osy.roll), o('roll')),
      gimbal: 0, plynStred: false, sport: false,
    };
    if (R.arm) v.arm = L.armZPrepinace(R.arm, a, t);
    if (R.rezim) v.rezim = L.rezimZPrepinace(R.rezim, a, t);
    return v;
  }

  // ---------- klávesnice ----------
  function ctiKlavesnici(dt) {
    const cil = L.mapujPaky(L.pakyZKlaves(dole, N.rozlozeni), N.mode);
    const c = N.citlivost, NABEH = 3.2, NAVRAT = 5.5;
    klav.yaw = L.rampa(klav.yaw, cil.yaw * c, dt, NABEH, NAVRAT);
    klav.pitch = L.rampa(klav.pitch, cil.pitch * c, dt, NABEH, NAVRAT);
    klav.roll = L.rampa(klav.roll, cil.roll * c, dt, NABEH, NAVRAT);
    const e = N.expo * 0.6;                                         // kláves je málo, expo jen mírně
    const v = { yaw: L.expo(klav.yaw, e), pitch: L.expo(klav.pitch, e), roll: L.expo(klav.roll, e), plynStred: !N.plynDrzi };
    if (N.plynDrzi) {
      klav.plynDrzi = L.clamp(klav.plynDrzi + cil.plynOsa * 0.55 * dt, 0, 1);
      v.plyn = klav.plynDrzi;
    } else {
      klav.plyn = L.rampa(klav.plyn, cil.plynOsa, dt, 2.6, 4);
      v.plyn = 0.5 + 0.5 * klav.plyn;
    }
    const k = n => dole.has(n) ? 1 : 0;
    v.gimbal = k('KeyE') + k('PageUp') - k('KeyQ') - k('PageDown');
    v.sport = dole.has('ShiftLeft') || dole.has('ShiftRight');
    return v;
  }

  // ---------- dotyk ----------
  function ctiDotyk() {
    const p = L.mapujPaky(dotyk, N.mode);
    const o = { mrtvaZona: 0.06, expo: N.expo, citlivost: N.citlivost };
    return {
      plyn: 0.5 + 0.5 * L.clamp(p.plynOsa, -1, 1),
      yaw: L.zpracujOsu(p.yaw, o), pitch: L.zpracujOsu(p.pitch, o), roll: L.zpracujOsu(p.roll, o),
      gimbal: 0, plynStred: true, sport: false,
    };
  }

  // ---------- hlavní čtení ----------
  const NULA = () => ({ plyn: 0.5, yaw: 0, pitch: 0, roll: 0, gimbal: 0, plynStred: true, sport: false });
  function cti(ctx, jenNahled) {
    const ted = PROHLIZEC && typeof performance !== 'undefined' ? performance.now() : Date.now();
    const dt = posledniCas ? L.clamp((ted - posledniCas) / 1000, 0, 0.1) : 0.016;
    posledniCas = ted;

    // který zdroj
    let zdroj = N.zdroj === 'auto' ? aktivniZdroj : N.zdroj;
    const g = (zdroj === 'rc' || zdroj === 'gamepad' || N.zdroj === 'auto') ? vyberGamepad(zdroj === 'rc' || (N.zdroj === 'auto' && vsechnyGamepady().some(L.jeRc))) : null;
    if (N.zdroj === 'auto' && g && gpPohyb(g)) zdroj = aktivniZdroj = L.jeRc(g) || (N.rc.id && g.id === N.rc.id) ? 'rc' : 'gamepad';
    gp.posledniId = g ? g.id : '';

    const kl = ctiKlavesnici(dt);                                   // rampy běží vždy (klávesy událostí taky)
    let v;
    if ((zdroj === 'gamepad' || zdroj === 'rc') && g) v = zdroj === 'rc' ? ctiRc(g) : ctiGamepad(g);
    else if (zdroj === 'dotyk') v = ctiDotyk();
    else { v = kl; if (zdroj !== 'dotyk') zdroj = 'klavesnice'; }
    // sport a gimbal z klávesnice platí vždy navíc
    v.sport = v.sport || kl.sport;
    if (!v.gimbal) v.gimbal = kl.gimbal;
    if (g && zdroj !== 'gamepad' && zdroj !== 'rc') gp.pred[g.index] = tlGp(g);
    else if (g && zdroj === 'rc') tlacitkaNaUdalosti(g, {});       // jen zapamatovat stav tlačítek
    D.vstup.zdroj = zdroj;

    // motory: vysílačka s přepínačem ARM ho má přímo, jinak vnitřní přepínač (mezerník / A / tlačítko)
    let arm;
    if (zdroj === 'rc' && v.arm !== undefined) arm = v.arm;
    else {
      if (!jenNahled && N.autoArm && zdroj !== 'rc' && !armSw && v.plyn > 0.75) { armCas += dt; if (armCas > 0.25) armSw = true; } else armCas = 0;
      // na zemi: plyn dolů a držet 1,5 s = vypnout motory
      const d = ctx && ctx.dron;
      if (!jenNahled && armSw && d && d.naZemi && v.plyn < 0.15) { disarmCas += dt; if (disarmCas > 1.5) armSw = false; } else disarmCas = 0;
      arm = armSw;
    }

    const vysl = {
      plyn: L.clamp(v.plyn, 0, 1), yaw: L.clamp(v.yaw, -1, 1), pitch: L.clamp(v.pitch, -1, 1), roll: L.clamp(v.roll, -1, 1),
      gimbal: L.clamp(v.gimbal || 0, -1, 1), plynStred: v.plynStred,
      prepinace: { arm, rezim: v.rezim, sport: !!v.sport },
      udalosti: jenNahled ? [] : fronta.splice(0),
    };
    if (dotyk.tlArm && dotyk.tlArm.classList.contains('zap') !== arm) dotyk.tlArm.classList.toggle('zap', arm);
    D.vstup.posledni = vysl; D.vstup.posledniCas = ted;
    return vysl;
  }

  // ======================================================================
  // Dotykové páky (#dotyk) — zobrazí se jen s třídou body.dotykove (první dotyk)
  // ======================================================================
  const STYL = `
#dotyk .dt-zona, #dotyk .dt-tlacitka { display: none; }
body.dotykove #dotyk .dt-zona { display: block; position: absolute; bottom: 0; width: 46%; height: 62%; touch-action: none; }
body.dotykove #dotyk .dt-zona.leva { left: 0; } body.dotykove #dotyk .dt-zona.prava { right: 0; }
#dotyk .dt-paka { position: absolute; width: 132px; height: 132px; margin: -66px 0 0 -66px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.28); background: radial-gradient(circle, rgba(255,255,255,0.08), rgba(0,0,0,0.18)); pointer-events: none; }
#dotyk .dt-paka::before, #dotyk .dt-paka::after { content: ''; position: absolute; background: rgba(255,255,255,0.14); }
#dotyk .dt-paka::before { left: 50%; top: 10%; bottom: 10%; width: 1px; } #dotyk .dt-paka::after { top: 50%; left: 10%; right: 10%; height: 1px; }
#dotyk .dt-knoflik { position: absolute; left: 50%; top: 50%; width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 50%;
  background: rgba(127, 209, 255, 0.55); border: 2px solid rgba(255,255,255,0.7); box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
#dotyk .dt-popis { position: absolute; left: 0; right: 0; top: 100%; margin-top: 6px; text-align: center; font-size: 11px; color: rgba(255,255,255,0.55); white-space: nowrap; }
body.dotykove #dotyk .dt-tlacitka { display: flex; gap: 8px; position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); }
#dotyk .dt-tlacitka button { font: 13px system-ui, sans-serif; color: var(--fg, #fff); background: var(--panel, rgba(0,0,0,0.6)); border: 1px solid var(--okraj, #555);
  border-radius: 18px; padding: 8px 12px; min-width: 52px; touch-action: manipulation; }
#dotyk .dt-tlacitka button.zap { border-color: var(--akcent, #7fd1ff); color: var(--akcent, #7fd1ff); }
`;
  function pridejStyl(id, css) {
    if (document.getElementById(id)) return;
    const s = document.createElement('style'); s.id = id; s.textContent = css; document.head.appendChild(s);
  }

  function pripravDotyk() {
    const kont = document.getElementById('dotyk');
    if (!kont || dotyk.el) return;
    pridejStyl('dron-dotyk-styl', STYL);
    const R = 56;                                    // poloměr výchylky v px
    const zona = (strana) => {
      const z = document.createElement('div'); z.className = 'dt-zona ' + strana;
      const p = document.createElement('div'); p.className = 'dt-paka';
      const k = document.createElement('div'); k.className = 'dt-knoflik';
      const popis = document.createElement('div'); popis.className = 'dt-popis';
      p.append(k, popis); z.appendChild(p); kont.appendChild(z);
      const st = { id: null, cx: 0, cy: 0 };
      const klid = () => { p.style.left = strana === 'leva' ? '96px' : 'calc(100% - 96px)'; p.style.top = 'calc(100% - 120px)'; k.style.transform = ''; };
      klid();
      const nastav = (dx, dy) => {
        const d = Math.hypot(dx, dy), s = d > R ? R / d : 1;
        dx *= s; dy *= s;
        k.style.transform = `translate(${dx}px, ${dy}px)`;
        if (strana === 'leva') { dotyk.lx = dx / R; dotyk.ly = -dy / R; } else { dotyk.rx = dx / R; dotyk.ry = -dy / R; }
      };
      z.addEventListener('pointerdown', e => {
        if (st.id !== null) return;
        st.id = e.pointerId;
        try { z.setPointerCapture(e.pointerId); } catch (x) { /* nic */ }
        const r = z.getBoundingClientRect();
        st.cx = e.clientX; st.cy = e.clientY;                       // plovoucí páka: střed tam, kam sáhne prst
        p.style.left = (e.clientX - r.left) + 'px'; p.style.top = (e.clientY - r.top) + 'px';
        nastav(0, 0);
        if (N.zdroj === 'auto') aktivniZdroj = 'dotyk';
        e.preventDefault();
      });
      z.addEventListener('pointermove', e => { if (e.pointerId === st.id) nastav(e.clientX - st.cx, e.clientY - st.cy); });
      const pust = e => {
        if (e.pointerId !== st.id) return;
        st.id = null; nastav(0, 0); klid();                         // obě páky se vrací na střed (i plyn)
      };
      z.addEventListener('pointerup', pust); z.addEventListener('pointercancel', pust); z.addEventListener('lostpointercapture', pust);
      return popis;
    };
    const pl = zona('leva'), pp = zona('prava');
    const popisy = () => {
      pl.textContent = N.mode === 1 ? 'výška · otáčení' : 'plyn · otáčení';
      pp.textContent = N.mode === 1 ? 'plyn · náklon' : 'vpřed · náklon';
    };
    popisy(); dotyk.popisy = popisy;
    const tl = document.createElement('div'); tl.className = 'dt-tlacitka';
    const tlacitka = [['Motory', 'arm'], ['Kamera', 'kamera'], ['Foto', 'foto'], ['Režim', 'rezim'], ['Pauza', 'pauza']];
    for (const [text, u] of tlacitka) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.dataset.u = u;
      b.addEventListener('pointerdown', e => { e.stopPropagation(); });
      b.addEventListener('click', () => pridej(u));
      tl.appendChild(b);
    }
    kont.appendChild(tl);
    dotyk.el = kont; dotyk.tlArm = tl.querySelector('[data-u="arm"]');
  }

  if (PROHLIZEC) {
    const priDotyku = () => {
      if (!document.body.classList.contains('dotykove')) document.body.classList.add('dotykove');
      if (N.zdroj === 'auto') aktivniZdroj = 'dotyk';
    };
    addEventListener('touchstart', priDotyku, { passive: true, capture: true });
    addEventListener('pointerdown', e => { if (e.pointerType === 'touch') priDotyku(); }, true);
    if (document.readyState === 'loading') addEventListener('DOMContentLoaded', pripravDotyk); else pripravDotyk();
  }

  // ======================================================================
  // Nastavení ovládání (otevriNastaveni)
  // ======================================================================
  const STYL_NAST = `
.dv-panel { position: relative; margin: 3vh auto; width: min(880px, calc(100% - 24px)); max-height: calc(100% - 6vh); overflow-y: auto;
  background: var(--panel); border: 1px solid var(--okraj); border-radius: 12px; color: var(--fg); padding: 16px 18px 18px;
  font: 14px/1.4 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  user-select: none; pointer-events: auto; }
.dv-panel h2 { font-size: 18px; font-weight: 500; margin: 0 0 10px; letter-spacing: 0.02em; }
.dv-panel h3 { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--tlumena); margin: 14px 0 6px; }
.dv-mrizka { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 4px 22px; }
@media (max-width: 620px) { .dv-mrizka { grid-template-columns: 1fr; } }
.dv-radek { display: flex; align-items: center; justify-content: space-between; gap: 6px 10px; min-height: 30px; flex-wrap: wrap; }
.dv-radek > span, .dv-radek > label { white-space: nowrap; }
.dv-radek label { color: var(--fg); }
.dv-panel select, .dv-panel button { font: inherit; color: var(--fg); background: rgba(255,255,255,0.06); border: 1px solid var(--okraj); border-radius: 6px; padding: 4px 8px; }
.dv-panel select option { background: #141c26; }
.dv-panel button { cursor: pointer; padding: 6px 12px; }
.dv-panel button:hover { border-color: var(--akcent); }
.dv-panel button.hlavni { background: var(--akcent); color: #06131d; border-color: var(--akcent); font-weight: 600; }
.dv-panel input[type=range] { width: 110px !important; vertical-align: middle; accent-color: var(--akcent); }
.dv-panel input[type=checkbox], .dv-panel input[type=radio] { accent-color: var(--akcent); }
.dv-hodnota { color: var(--tlumena); font-variant-numeric: tabular-nums; min-width: 34px; text-align: right; display: inline-block; }
.dv-tlumene { color: var(--tlumena); font-size: 13px; }
.dv-naheled { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.dv-naheled canvas { width: 104px; height: 104px; border-radius: 8px; background: rgba(0,0,0,0.25); border: 1px solid var(--okraj); }
.dv-klavesy { display: grid; grid-template-columns: max-content 1fr max-content 1fr; gap: 4px 8px; font-size: 12.5px; align-items: center; margin-top: 6px; }
.dv-klavesy span { white-space: nowrap; }
.dv-klavesy kbd { font: 12px ui-monospace, monospace; border: 1px solid var(--okraj); border-bottom-width: 2px; border-radius: 4px; padding: 0 5px; background: rgba(255,255,255,0.06); white-space: nowrap; }
.dv-pruvodce { border: 1px solid var(--akcent); border-radius: 8px; padding: 10px 12px; margin-top: 8px; background: rgba(127,209,255,0.06); }
.dv-pruvodce .krok { font-weight: 600; margin-bottom: 4px; }
.dv-osy { display: grid; grid-template-columns: auto 1fr auto; gap: 2px 8px; align-items: center; font-size: 12px; margin-top: 8px; }
.dv-osy .pruh { position: relative; height: 8px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; }
.dv-osy .pruh i { position: absolute; top: 0; bottom: 0; width: 3px; margin-left: -1px; background: var(--akcent); }
.dv-osy .pruh b { position: absolute; top: 0; bottom: 0; left: 50%; width: 1px; background: rgba(255,255,255,0.25); }
.dv-tlacitka { display: flex; gap: 8px; justify-content: flex-end; margin-top: 14px; flex-wrap: wrap; }
.dv-ok { color: #8be08b; } .dv-pozor { color: #ffc46b; }
`;

  const KLAVESY_POMOC = () => {
    const ob = N.rozlozeni === 'obracene';
    const plyn = N.mode === 1 ? (ob ? 'W / S' : '↑ / ↓') : (ob ? '↑ / ↓' : 'W / S');
    const pitch = N.mode === 1 ? (ob ? '↑ / ↓' : 'W / S') : (ob ? 'W / S' : '↑ / ↓');
    const yaw = ob ? '← / →' : 'A / D', roll = ob ? 'A / D' : '← / →';
    return [
      [plyn, 'plyn (výška)'], [yaw, 'otáčení (yaw)'], [pitch, 'vpřed / vzad'], [roll, 'náklon'],
      ['Shift', 'sport (držet)'], ['Q / E', 'kamera ↓ / ↑'], ['Mezerník', 'motory'], ['M', 'letový režim'],
      ['C', 'pohled'], ['F', 'fotka'], ['H', 'návrat domů'], ['R', 'reset'], ['P / Esc', 'pauza'], ['IJKL', 'jako šipky'],
    ].map(([k, t]) => `<kbd>${k}</kbd><span>${t}</span>`).join('');
  };

  function otevriNastaveni(element, volby) {
    volby = volby || {};
    if (!element) return null;
    pridejStyl('dron-vstup-styl', STYL_NAST);
    const stary = element.querySelector(':scope > .dv-panel');
    if (stary) stary.remove();
    const panel = document.createElement('div');
    panel.className = 'dv-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Nastavení ovládání');
    const rozsah = (id, text, min, max, krok) => `<div class="dv-radek"><label for="${id}">${text}</label><span><input type="range" id="${id}" min="${min}" max="${max}" step="${krok}"> <span class="dv-hodnota" data-pro="${id}"></span></span></div>`;
    const zaskrt = (id, text) => `<div class="dv-radek"><label for="${id}">${text}</label><input type="checkbox" id="${id}"></div>`;
    panel.innerHTML = `
<h2>Ovládání</h2>
<div class="dv-mrizka">
  <div>
    <h3>Zdroj</h3>
    <div class="dv-radek"><label for="dv-zdroj">Ovládat</label><select id="dv-zdroj">
      <option value="auto">Automaticky (co právě používám)</option><option value="klavesnice">Klávesnice</option>
      <option value="gamepad">Gamepad</option><option value="rc">RC vysílačka (USB)</option><option value="dotyk">Dotykové páky</option></select></div>
    <div class="dv-tlumene" id="dv-stav"></div>
    <h3>Režim pák</h3>
    <div class="dv-radek"><label><input type="radio" name="dv-mode" value="2"> Mode 2 (plyn vlevo)</label><label><input type="radio" name="dv-mode" value="1"> Mode 1 (plyn vpravo)</label></div>
    <h3>Citlivost</h3>
    ${rozsah('dv-citlivost', 'Citlivost', 0.2, 1, 0.05)}
    ${rozsah('dv-expo', 'Expo (jemný střed)', 0, 1, 0.05)}
    ${rozsah('dv-mz', 'Mrtvá zóna gamepadu', 0, 0.3, 0.01)}
    <h3>Obrátit osy</h3>
    <div class="dv-radek"><label><input type="checkbox" id="dv-inv-plyn"> plyn</label><label><input type="checkbox" id="dv-inv-yaw"> yaw</label>
      <label><input type="checkbox" id="dv-inv-pitch"> pitch</label><label><input type="checkbox" id="dv-inv-roll"> roll</label></div>
  </div>
  <div>
    <h3>Náhled pák</h3>
    <div class="dv-naheled"><canvas id="dv-leva" width="116" height="116"></canvas><canvas id="dv-prava" width="116" height="116"></canvas>
      <div class="dv-tlumene" id="dv-hodnoty" style="font-size:12px;white-space:nowrap"></div></div>
    <h3>Klávesnice</h3>
    <div class="dv-radek"><label for="dv-rozlozeni">Rozložení</label><select id="dv-rozlozeni">
      <option value="wasd">WASD = levá páka, šipky = pravá</option><option value="obracene">Šipky = levá páka, WASD = pravá</option></select></div>
    ${zaskrt('dv-plyndrzi', 'Plyn drží polohu (W/S přidává a ubírá)')}
    ${zaskrt('dv-autoarm', 'Plynem nahoru nastartovat motory')}
    <div class="dv-klavesy" id="dv-klavesy"></div>
  </div>
</div>
<h3>RC vysílačka</h3>
<div class="dv-tlumene">Vysílačku (RadioMaster, Jumper, FrSky…) připoj kabelem v režimu <b>USB Joystick (HID)</b>. Kanály se přiřadí kalibrací.
Rates a expo obvykle řeší letový kontrolér dronu, proto se u vysílačky expo nepřidává.</div>
<div class="dv-radek"><span id="dv-rcstav"></span><button type="button" id="dv-kalibrace">Kalibrovat vysílačku</button></div>
${rozsah('dv-rcmz', 'Mrtvá zóna vysílačky', 0, 0.1, 0.005)}
${zaskrt('dv-rcexpo', 'Přidat expo i u vysílačky')}
<div id="dv-pruvodce"></div>
<div class="dv-tlacitka"><button type="button" id="dv-vychozi">Výchozí nastavení</button><button type="button" class="hlavni" id="dv-zavrit">Hotovo</button></div>`;
    element.appendChild(panel);
    const $ = s => panel.querySelector(s);

    // ---- vazba ovládacích prvků na N ----
    const obnov = () => {
      $('#dv-zdroj').value = N.zdroj;
      panel.querySelectorAll('input[name=dv-mode]').forEach(r => { r.checked = +r.value === N.mode; });
      $('#dv-citlivost').value = N.citlivost; $('#dv-expo').value = N.expo; $('#dv-mz').value = N.mrtvaZona;
      for (const f of FUNKCE) $('#dv-inv-' + f).checked = N.invert[f];
      $('#dv-rozlozeni').value = N.rozlozeni; $('#dv-plyndrzi').checked = N.plynDrzi; $('#dv-autoarm').checked = N.autoArm;
      $('#dv-rcmz').value = N.rc.mrtvaZona; $('#dv-rcexpo').checked = N.rc.expo;
      panel.querySelectorAll('.dv-hodnota').forEach(s => { const v = +$('#' + s.dataset.pro).value; s.textContent = s.dataset.pro === 'dv-citlivost' ? Math.round(v * 100) + ' %' : v.toFixed(2); });
      $('#dv-klavesy').innerHTML = KLAVESY_POMOC();
      $('#dv-rcstav').innerHTML = N.rc.kalibrovano
        ? `<span class="dv-ok">Kalibrováno</span> <span class="dv-tlumene">${N.rc.id ? esc(N.rc.id.slice(0, 40)) : ''}${N.rc.arm ? ' · ARM přepínač' : ''}${N.rc.rezim ? ' · přepínač režimu' : ''}</span>`
        : '<span class="dv-pozor">Nekalibrováno</span> <span class="dv-tlumene">(odhad AETR)</span>';
      if (dotyk.popisy) dotyk.popisy();
    };
    const zmena = () => { uloz(); obnov(); };
    $('#dv-zdroj').addEventListener('change', e => { N.zdroj = e.target.value; if (N.zdroj !== 'auto') aktivniZdroj = N.zdroj; zmena(); });
    panel.querySelectorAll('input[name=dv-mode]').forEach(r => r.addEventListener('change', e => { N.mode = +e.target.value; zmena(); }));
    for (const [id, k] of [['dv-citlivost', 'citlivost'], ['dv-expo', 'expo'], ['dv-mz', 'mrtvaZona']]) $('#' + id).addEventListener('input', e => { N[k] = +e.target.value; zmena(); });
    for (const f of FUNKCE) $('#dv-inv-' + f).addEventListener('change', e => { N.invert[f] = e.target.checked; zmena(); });
    $('#dv-rozlozeni').addEventListener('change', e => { N.rozlozeni = e.target.value; zmena(); });
    $('#dv-plyndrzi').addEventListener('change', e => { N.plynDrzi = e.target.checked; klav.plynDrzi = 0; zmena(); });
    $('#dv-autoarm').addEventListener('change', e => { N.autoArm = e.target.checked; zmena(); });
    $('#dv-rcmz').addEventListener('input', e => { N.rc.mrtvaZona = +e.target.value; zmena(); });
    $('#dv-rcexpo').addEventListener('change', e => { N.rc.expo = e.target.checked; zmena(); });
    $('#dv-vychozi').addEventListener('click', () => { const rc = N.rc; N = L.vychoziNastaveni(); N.rc = rc; N.rc.mrtvaZona = 0.02; N.rc.expo = false; zmena(); });
    const zavri = () => { panel.remove(); if (volby.priZavreni) try { volby.priZavreni(); } catch (e) { console.error(e); } };
    $('#dv-zavrit').addEventListener('click', zavri);
    $('#dv-kalibrace').addEventListener('click', () => pruvodce.start());
    obnov();

    // ---- průvodce kalibrací vysílačky ----
    const pruvodce = {
      krok: null, kal: null, osy: {}, snimek: null, nalez: null,
      KROKY: [
        { id: 'klid', titul: '1/8 Výchozí poloha', text: 'Plyn úplně dolů, ostatní páky na střed, přepínače do výchozí polohy (ARM vypnuto). Pak klikni <b>Dál</b>.' },
        { id: 'extremy', titul: '2/8 Rozsahy', text: 'Krouži oběma pákami po celém obvodu, několikrát až do rohů. Pak klikni <b>Dál</b>.' },
        { id: 'stred', titul: '3/8 Střed', text: 'Pusť páky na střed — <b>plyn dej také doprostřed</b>. Pak klikni <b>Dál</b>.' },
        { id: 'plyn', titul: '4/8 Plyn', text: 'Dej plyn <b>úplně nahoru</b> a drž.', funkce: 'plyn' },
        { id: 'yaw', titul: '5/8 Otáčení (yaw)', text: 'Páku otáčení (směrovku) dej <b>úplně doprava</b> a drž.', funkce: 'yaw' },
        { id: 'pitch', titul: '6/8 Vpřed (pitch)', text: 'Páku výškovky dej <b>od sebe</b> (nahoru) a drž.', funkce: 'pitch' },
        { id: 'roll', titul: '7/8 Náklon (roll)', text: 'Páku křidélek dej <b>úplně doprava</b> a drž.', funkce: 'roll' },
        { id: 'arm', titul: '8/8 Přepínače', text: 'Přepni přepínač <b>ARM</b> (motory) do polohy ZAPNUTO. Pokud ho nechceš používat, klikni <b>Přeskočit</b> — motory pak zapíná mezerník.', prepinac: 'arm' },
        { id: 'rezim', titul: '8/8 Přepínače', text: 'Přepni přepínač <b>letového režimu</b> (2 nebo 3 polohy) do jiné polohy. Nebo <b>Přeskočit</b> — režim pak přepíná klávesa M.', prepinac: 'rezim' },
        { id: 'hotovo', titul: 'Hotovo', text: 'Kalibrace je hotová. Zkontroluj náhled pák nahoře a klikni <b>Uložit</b>.' },
      ],
      start() {
        const g = vyberGamepad(true);
        const el = $('#dv-pruvodce');
        if (!g) { el.innerHTML = '<div class="dv-pruvodce"><div class="krok">Vysílačka nenalezena</div>Připoj vysílačku kabelem (režim USB Joystick / HID) a pohni pákou — prohlížeč ji ukáže až po prvním pohybu. Pak to zkus znovu.</div>'; return; }
        this.g = g.index; this.id = g.id; this.krok = 0; this.osy = {}; this.prepinace = {};
        this.kal = L.novaKalibrace(osyGp(g));
        this.zobraz();
      },
      gamepad() { return vsechnyGamepady().find(x => x.index === this.g) || null; },
      zobraz() {
        const K = this.KROKY[this.krok], el = $('#dv-pruvodce');
        const g = this.gamepad();
        if (g) { this.snimek = { o: osyGp(g), t: tlGp(g) }; }
        this.nalez = null;
        const osy = g ? osyGp(g) : [];
        el.innerHTML = `<div class="dv-pruvodce"><div class="krok">${K.titul}</div><div>${K.text}</div>
          <div class="dv-tlumene" id="dv-nalez"></div>
          <div class="dv-osy">${osy.map((_, i) => `<span>Osa ${i}</span><span class="pruh"><b></b><i data-osa="${i}"></i></span><span class="dv-hodnota" data-osah="${i}"></span>`).join('')}</div>
          <div class="dv-tlacitka">${K.prepinac ? '<button type="button" data-a="preskoc">Přeskočit</button>' : ''}<button type="button" data-a="zrus">Zrušit</button>
          <button type="button" class="hlavni" data-a="dal">${K.id === 'hotovo' ? 'Uložit' : 'Dál'}</button></div></div>`;
        el.querySelector('[data-a=zrus]').onclick = () => { this.krok = null; el.innerHTML = ''; };
        el.querySelector('[data-a=dal]').onclick = () => this.dal();
        const pr = el.querySelector('[data-a=preskoc]'); if (pr) pr.onclick = () => { this.prepinace[K.prepinac] = null; this.dalsi(); };
      },
      tik() {
        if (this.krok == null) return;
        const g = this.gamepad(); if (!g) return;
        const o = osyGp(g), t = tlGp(g), K = this.KROKY[this.krok];
        panel.querySelectorAll('[data-osa]').forEach(i => { const v = o[+i.dataset.osa] || 0; i.style.left = ((v + 1) * 50) + '%'; });
        panel.querySelectorAll('[data-osah]').forEach(s => { s.textContent = (o[+s.dataset.osah] || 0).toFixed(2); });
        if (K.id === 'extremy' || K.id === 'klid' || K.id === 'stred') L.kalibraceExtremy(this.kal, o);
        const info = panel.querySelector('#dv-nalez');
        if (K.funkce) {
          const vyl = Object.values(this.osy).map(x => x.index);
          this.nalez = L.najdiOsu(this.kal, o, vyl, 0.6);
          if (info) info.innerHTML = this.nalez ? `Nalezeno: <b>osa ${this.nalez.index}</b>${this.nalez.smer < 0 ? ' (obráceně)' : ''}` : 'Čekám na pohyb páky…';
        } else if (K.prepinac) {
          const vyl = Object.values(this.osy).map(x => x.index);
          this.nalez = L.najdiPrepinac(this.snimek.o, this.snimek.t, o, t, vyl) || this.nalez;
          if (info) info.innerHTML = this.nalez ? `Nalezeno: <b>${this.nalez.typ === 'osa' ? 'osa' : 'tlačítko'} ${this.nalez.index}</b>` : 'Čekám na přepnutí…';
        }
      },
      dal() {
        const K = this.KROKY[this.krok], g = this.gamepad();
        const o = g ? osyGp(g) : [];
        if (K.id === 'klid') { this.kal.klid = o.slice(); }
        else if (K.id === 'stred') { this.kal.stred = o.slice(); }
        else if (K.funkce) {
          if (!this.nalez) { const i = panel.querySelector('#dv-nalez'); if (i) i.innerHTML = '<span class="dv-pozor">Páka zatím nebyla poznána — pohni s ní až na doraz.</span>'; return; }
          const p = L.prirazeni(this.kal, this.nalez);
          // u plynu je střed nepodstatný, rozsah je min..max
          this.osy[K.funkce] = p;
        } else if (K.prepinac) {
          if (!this.nalez) { const i = panel.querySelector('#dv-nalez'); if (i) i.innerHTML = '<span class="dv-pozor">Žádný přepínač se nepohnul. Přepni ho, nebo klikni Přeskočit.</span>'; return; }
          const n = this.nalez;
          this.prepinace[K.prepinac] = { typ: n.typ, index: n.index, zap: n.zap, vyp: n.vyp, polohy: 3 };
        } else if (K.id === 'hotovo') {
          N.rc = Object.assign(N.rc, { kalibrovano: true, id: this.id, osy: this.osy, arm: this.prepinace.arm || null, rezim: this.prepinace.rezim || null });
          if (N.zdroj !== 'auto') N.zdroj = 'rc';
          aktivniZdroj = 'rc';
          uloz(); this.krok = null; $('#dv-pruvodce').innerHTML = ''; obnov(); return;
        }
        this.dalsi();
      },
      dalsi() { this.krok++; this.zobraz(); },
    };

    // ---- živý náhled ----
    const kresliPaku = (cv, x, y, popisX, popisY) => {
      const c = cv.getContext('2d'), w = cv.width, h = cv.height, r = w / 2 - 10;
      c.clearRect(0, 0, w, h);
      c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1;
      c.strokeRect(10.5, 10.5, w - 21, h - 21);
      c.beginPath(); c.moveTo(w / 2, 10); c.lineTo(w / 2, h - 10); c.moveTo(10, h / 2); c.lineTo(w - 10, h / 2); c.stroke();
      const akc = getComputedStyle(panel).getPropertyValue('--akcent').trim() || '#7fd1ff';
      c.fillStyle = akc;
      c.beginPath(); c.arc(w / 2 + x * r, h / 2 - y * r, 7, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.5)'; c.font = '10px system-ui, sans-serif'; c.textAlign = 'center';
      c.fillText(popisY, w / 2, 9); c.fillText(popisX, w / 2, h - 1);
    };
    const smycka = () => {
      if (!panel.isConnected) return;
      requestAnimationFrame(smycka);
      let v = D.vstup.posledni;
      const ted = performance.now();
      if (!v || ted - (D.vstup.posledniCas || 0) > 250) v = cti(D.ctx || null, true);    // hra neběží → číst sami
      const f = { plynOsa: v.plyn * 2 - 1, yaw: v.yaw, pitch: v.pitch, roll: v.roll };
      const p = L.pakyZFunkci(f, N.mode);
      kresliPaku($('#dv-leva'), p.lx, p.ly, N.mode === 1 ? 'yaw' : 'yaw', N.mode === 1 ? 'pitch' : 'plyn');
      kresliPaku($('#dv-prava'), p.rx, p.ry, 'roll', N.mode === 1 ? 'plyn' : 'pitch');
      const jm = { klavesnice: 'klávesnice', gamepad: 'gamepad', rc: 'RC vysílačka', dotyk: 'dotyk' };
      $('#dv-hodnoty').innerHTML = `plyn ${Math.round(v.plyn * 100)} %<br>yaw ${v.yaw.toFixed(2)}<br>pitch ${v.pitch.toFixed(2)}<br>roll ${v.roll.toFixed(2)}<br>`
        + `motory: ${v.prepinace.arm ? '<span class="dv-ok">zap</span>' : 'vyp'}${v.prepinace.sport ? ' · sport' : ''}${v.prepinace.rezim != null ? ' · režim ' + v.prepinace.rezim : ''}`;
      const gps = vsechnyGamepady();
      $('#dv-stav').textContent = 'Právě: ' + (jm[D.vstup.zdroj] || D.vstup.zdroj) + ' · ' + (gps.length ? 'připojeno: ' + gps.map(g => g.id.replace(/\s*\(.*?\)\s*/g, ' ').trim().slice(0, 36) + (L.jeRc(g) ? ' [RC]' : '')).join(', ') : 'žádný gamepad ani vysílačka');
      pruvodce.tik();
    };
    smycka();
    return panel;
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  D.vstup = {
    zdroj: 'klavesnice',
    posledni: null, posledniCas: 0,
    cti,
    otevriNastaveni,
    nastaveni: () => N,                                   // pro ui.js (jen čtení)
    nastav(zmeny) { N = L.sloucNastaveni(Object.assign({}, N, zmeny)); uloz(); if (dotyk.popisy) dotyk.popisy(); },
    jeArm: () => armSw,
    nastavArm(b) { armSw = !!b; },
  };
})(globalThis.DRON = globalThis.DRON || {});
