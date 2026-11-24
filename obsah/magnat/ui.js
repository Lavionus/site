/* Dopravní magnát – prohlížeč: plátno, kamera, ovládání, minimapa, okna, dialog nové mapy, běh času.
   Logika mapy je v mapa.js, hry v hra.js (bez DOM), kreslení v grafika.js.
   Herní okna, nástroje stavby a ukládání jsou v ui_hra.js – navazují přes objekt U = MAG.UI
   (háčky U.poKresleni, U.klikNastroje, U.tahNastroje, U.klavesa, U.poKroku, U.poNacteni). */
(function () {
  'use strict';
  const MAG = window.MAG, D = MAG.data, M = MAG.mapa, G = MAG.grafika, H = MAG.hra;   // H = logika hry (hra je proměnná se stavem)
  const U = MAG.UI = MAG.UI || {};
  const $ = id => document.getElementById(id);
  const KLIC = 'webapp_hra_magnat_nastaveni';

  // --- nastavení (jen pohodlí; bez úložiště hra funguje) ----------------------
  let nast = { opt: { ...M.VYCHOZI }, kod: null, mrizka: false, minimapa: true, popisky: true, prumPopisky: false, vrstva: 'teren', noc: false, nalozeni: false, staniceJm: true };
  try { nast = { ...nast, ...JSON.parse(localStorage.getItem(KLIC) || '{}') }; } catch (e) { /* bez úložiště */ }
  const ulozNast = () => { try { localStorage.setItem(KLIC, JSON.stringify(nast)); } catch (e) { /* bez úložiště */ } };

  // --- stav ----------------------------------------------------------------------
  let mapa = null, kreslic = null, hra = null;
  let rychlost = 1, zbyvaTicku = 0;    // násobek rychlosti času (0 = pauza)
  const kamera = { x: 0, y: 0 };
  let zoomI = 2;                       // index v G.ZOOMY (1×)
  let najeto = null;                   // pole pod myší
  let platnoW = 0, platnoH = 0, dpr = 1;
  let spinave = true, chybi = false, vykreslenaMapa = null, animuje = false;
  const platno = $('platno'), g = platno.getContext('2d');
  const Z = () => G.ZOOMY[zoomI];

  // --- nová hra / načtená hra ----------------------------------------------------------
  function nactiMapu(seed, opt) {
    $('nacitani').hidden = false;
    // nechat prohlížeč vykreslit hlášku, pak generovat
    setTimeout(() => {
      const m = M.generuj(seed, opt);
      nast.kod = MAG.kodSeedu(seed); nast.opt = { ...m.opt, rok: opt.rok || nast.opt.rok || 1950 };
      ulozNast();
      zacniHru(H.novaHra(m, { rok: nast.opt.rok, barva: opt.barva }));
      if (U.zprava) U.zprava(`Vítej v roce ${hra.rok0}! Postav silnici mezi městy, zastávky a garáž a kup první autobus.`);
    }, 20);
  }
  function zacniHru(h, kam) {
    hra = h; mapa = h.m;
    kreslic = G.Kreslic(mapa);
    kreslic.nastavDpr(dpr);
    kreslic.nastav({ mrizka: nast.mrizka, barvaFirmy: h.firma.barva, stanice: h.stanice });
    zavriVsechnaOkna();
    zbyvaTicku = 0;
    if (kam) { kamera.x = kam.x; kamera.y = kam.y; omezKameru(); }
    else {
      // kamera na největší město
      const velke = mapa.mesta.reduce((a, c) => !a || c.obyv > a.obyv ? c : a, null);
      if (velke) naPole(velke.x, velke.y); else naStred();
    }
    pripravMinimapu();
    $('stKod').textContent = MAG.kodSeedu(mapa.seedZadany ?? mapa.seed);
    $('stVel').textContent = `${mapa.W} × ${mapa.H} · ${mapa.mesta.length} měst · ${mapa.prumysl.filter(q => !q.zrusen).length} podniků`;
    $('nacitani').hidden = true;
    if (U.poNacteni) U.poNacteni(h);
    prekresli();
  }

  // --- běh času ----------------------------------------------------------------------------
  function nastavRychlost(r) {
    rychlost = r; zbyvaTicku = 0;
    document.querySelectorAll('#rychlost button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.r === r)));
  }
  let posledniCas = performance.now();
  function simuluj(t) {
    const dt = Math.min(0.25, (t - posledniCas) / 1000); posledniCas = t;
    if (!hra || !rychlost || document.hidden) return false;
    zbyvaTicku += dt * D.TICKU_ZA_S * rychlost;
    let n = Math.floor(zbyvaTicku);
    zbyvaTicku -= n;
    if (n > 400) n = 400;
    const den = hra.den;
    const t0 = performance.now();
    for (let k = 0; k < n; k++) { H.krok(hra); if (performance.now() - t0 > 30) { zbyvaTicku = 0; break; } }
    // změny mapy → překreslit bloky a minimapu
    if (hra.zmeny.length) {
      for (const [x0, y0, x1, y1] of hra.zmeny) kreslic.zneplatni(x0, y0, x1, y1);
      hra.zmeny.length = 0;
      obnovMinimapu = true;
    }
    if (U.poKroku) U.poKroku(hra, hra.den !== den);
    return n > 0;
  }
  let obnovMinimapu = false;

  function naPole(x, y) {
    const [wx, wy] = kreslic.stredPole(x, y);
    kamera.x = wx; kamera.y = wy; omezKameru(); prekresli();
  }
  function naStred() { naPole(mapa.W >> 1, mapa.H >> 1); }
  function omezKameru() {
    if (!mapa) return;
    kamera.x = Math.max(-mapa.H * G.PW, Math.min(mapa.W * G.PW, kamera.x));
    kamera.y = Math.max(-D.MAX_VYSKA * G.VH, Math.min((mapa.W + mapa.H) * G.PH, kamera.y));
  }

  // --- kreslení -------------------------------------------------------------------
  function velikost() {
    const r = platno.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    platnoW = r.width; platnoH = r.height;
    platno.width = Math.max(1, Math.round(r.width * dpr)); platno.height = Math.max(1, Math.round(r.height * dpr));
    if (kreslic) kreslic.nastavDpr(dpr);
    prekresli();
  }
  function prekresli() { spinave = true; }

  function snimek(t) {
    requestAnimationFrame(snimek);
    if (simuluj(t || performance.now())) spinave = true;
    if (obnovMinimapu && hra && hra.tick === 0) { obnovMinimapu = false; pripravMinimapu(); }
    if (!mapa || (!spinave && !chybi)) return;
    spinave = false; vykreslenaMapa = mapa; animuje = !!(U.animuje && U.animuje());
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#1c2530'; g.fillRect(0, 0, platno.width, platno.height);
    chybi = kreslic.kresli(g, platnoW, platnoH, kamera, Z());
    const z = Z(), ox = platnoW / 2 - kamera.x * z, oy = platnoH / 2 - kamera.y * z;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // zvýrazněné pole
    if (najeto) {
      const o = kreslic.obrysPole(najeto.x, najeto.y);
      g.beginPath(); o.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](x * z + ox, y * z + oy)); g.closePath();
      g.strokeStyle = 'rgba(255,236,140,.95)'; g.lineWidth = 2; g.stroke();
      g.fillStyle = 'rgba(255,236,140,.15)'; g.fill();
    }
    kreslic.kresliPrumysl(g, z, ox, oy, platnoW, platnoH);
    if (U.poKresleni) U.poKresleni(g, z, ox, oy);
    // popisky
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const stitek = (text, x, y, pozadi, barva, vel) => {
      g.font = `600 ${vel}px system-ui, sans-serif`;
      const w = g.measureText(text).width + 12;
      g.fillStyle = pozadi; g.beginPath();
      if (g.roundRect) g.roundRect(x - w / 2, y - vel * 0.8, w, vel * 1.6, vel * 0.8); else g.rect(x - w / 2, y - vel * 0.8, w, vel * 1.6);
      g.fill(); g.fillStyle = barva; g.fillText(text, x, y + 0.5);
    };
    if (nast.prumPopisky && z >= 0.5) for (const q of mapa.prumysl) {
      if (q.zrusen) continue;
      const [wx, wy] = kreslic.stredPole(q.x + (q.w >> 1), q.y + (q.h >> 1));
      const sx = wx * z + ox, sy = wy * z + oy - 30 * z;
      if (sx < -150 || sx > platnoW + 150 || sy < -20 || sy > platnoH + 20) continue;
      stitek(`${D.PRUMYSL_PODLE_ID[q.typ].ikona} ${q.jmeno}`, sx, sy, 'rgba(40,30,20,.78)', '#f3e2c8', 11);
    }
    // cedulky stanic: jméno a čekající náklad (barva firmy)
    if (nast.staniceJm && hra && z >= 0.5) {
      const IK = { vlak: '🚉', bus: '🚏', nakl: '🚚', lod: '⚓', let: '✈️' };
      for (const st of hra.stanice) {
        if (!st || st.boje) continue;
        const [wx, wy] = kreslic.stredPole(st.x, st.y);
        const sx = wx * z + ox, sy = wy * z + oy - 20 * z;
        if (sx < -150 || sx > platnoW + 150 || sy < -20 || sy > platnoH + 20) continue;
        const druh = ['vlak', 'let', 'lod', 'nakl', 'bus'].find(d => st.casti.some(c => c.druh === d));
        const ceka = Object.entries(st.naklady).filter(([, x]) => x.ceka > 0).sort((a, b) => b[1].ceka - a[1].ceka).slice(0, 3)
          .map(([k, x]) => `${D.NAKLADY_PODLE_ID[k].ikona}${x.ceka}`).join(' ');
        stitek(`${IK[druh] || '🚏'} ${st.jmeno}${ceka && z >= 1 ? '  ' + ceka : ''}`, sx, sy, hra.firma.barva, '#ffffff', 10.5);
      }
    }
    if (nast.popisky) for (const c of mapa.mesta) {
      const [wx, wy] = kreslic.stredPole(c.x, c.y);
      const sx = wx * z + ox, sy = wy * z + oy - 26 * z - 8;
      if (sx < -150 || sx > platnoW + 150 || sy < -20 || sy > platnoH + 20) continue;
      stitek(z >= 0.5 ? `${c.jmeno} (${c.obyv.toLocaleString('cs-CZ')})` : c.jmeno, sx, sy, 'rgba(18,26,36,.82)', '#ffffff', z >= 1 ? 13 : 12);
    }
    kresliRamecekMinimapy();
    $('stZoom').textContent = `${z}×`;
  }

  // --- minimapa --------------------------------------------------------------------
  const mm = $('mm'), mg = mm.getContext('2d');
  let mmPodklad = null, mmS = 1;
  function pripravMinimapu() {
    const W = mapa.W, H = mapa.H;
    const cil = Math.min(220, Math.max(140, window.innerWidth * 0.22));
    mmS = cil / (W + H);
    const md = Math.min(2, window.devicePixelRatio || 1);
    mm.width = Math.round(cil * md); mm.height = Math.round(cil / 2 * md);
    mm.style.width = cil + 'px'; mm.style.height = cil / 2 + 'px';
    const src = document.createElement('canvas'); src.width = W; src.height = H;
    const sg = src.getContext('2d'), img = sg.createImageData(W, H);
    for (let i = 0; i < W * H; i++) {
      const c = G.barvaMinimapy(mapa, i, nast.vrstva);
      img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
    }
    sg.putImageData(img, 0, 0);
    mmPodklad = document.createElement('canvas'); mmPodklad.width = mm.width; mmPodklad.height = mm.height;
    const pg = mmPodklad.getContext('2d');
    const s = mmS * md;
    pg.imageSmoothingEnabled = false;
    pg.setTransform(s, s / 2, -s, s / 2, H * s, 0);
    pg.drawImage(src, 0, 0);
    $('minimapa').hidden = !nast.minimapa;
    document.querySelectorAll('.mm-lista button').forEach(b => b.classList.toggle('on', b.dataset.vrstva === nast.vrstva));
  }
  function kresliRamecekMinimapy() {
    if (!mmPodklad || !nast.minimapa) return;
    const md = mm.width / parseFloat(mm.style.width);
    mg.setTransform(1, 0, 0, 1, 0, 0);
    mg.clearRect(0, 0, mm.width, mm.height);
    mg.drawImage(mmPodklad, 0, 0);
    // světový bod (Z = 1) → minimapa: X = wx/32·s + H·s, Y = wy/32·s
    const z = Z(), s = mmS * md;
    const x0 = (kamera.x - platnoW / 2 / z) / G.PW * s + mapa.H * s, x1 = (kamera.x + platnoW / 2 / z) / G.PW * s + mapa.H * s;
    const y0 = (kamera.y - platnoH / 2 / z) / G.PW * s, y1 = (kamera.y + platnoH / 2 / z) / G.PW * s;
    mg.strokeStyle = '#fff'; mg.lineWidth = Math.max(1, md);
    mg.strokeRect(x0, y0, x1 - x0, y1 - y0);
  }
  function minimapaNaKameru(ev) {
    const r = mm.getBoundingClientRect();
    const mx = ev.clientX - r.left, my = ev.clientY - r.top;
    kamera.x = (mx - mapa.H * mmS) / mmS * G.PW;
    kamera.y = my / mmS * G.PW;
    omezKameru(); prekresli();
  }
  let mmTahne = false;
  mm.addEventListener('pointerdown', ev => { mmTahne = true; mm.setPointerCapture(ev.pointerId); minimapaNaKameru(ev); });
  mm.addEventListener('pointermove', ev => { if (mmTahne) minimapaNaKameru(ev); });
  mm.addEventListener('pointerup', () => { mmTahne = false; });
  document.querySelectorAll('.mm-lista button').forEach(b => b.addEventListener('click', () => {
    nast.vrstva = b.dataset.vrstva; ulozNast(); pripravMinimapu(); prekresli();
  }));

  // --- přiblížení --------------------------------------------------------------------
  function priblizeni(smer, sx = platnoW / 2, sy = platnoH / 2) {
    const nove = Math.max(0, Math.min(G.ZOOMY.length - 1, zoomI + smer));
    if (nove === zoomI) return;
    // bod pod kurzorem zůstane na místě
    const z0 = Z(), wx = kamera.x + (sx - platnoW / 2) / z0, wy = kamera.y + (sy - platnoH / 2) / z0;
    zoomI = nove;
    const z1 = Z();
    kamera.x = wx - (sx - platnoW / 2) / z1; kamera.y = wy - (sy - platnoH / 2) / z1;
    omezKameru(); prekresli();
  }

  // --- myš a dotyk --------------------------------------------------------------------
  const ukazatele = new Map();
  let tah = null, stipnuti = null;
  const naSvet = (sx, sy) => [kamera.x + (sx - platnoW / 2) / Z(), kamera.y + (sy - platnoH / 2) / Z()];
  const bodPlatna = ev => { const r = platno.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };

  platno.addEventListener('pointerdown', ev => {
    platno.setPointerCapture(ev.pointerId);
    ukazatele.set(ev.pointerId, bodPlatna(ev));
    if (ukazatele.size === 2) {
      const [a, b] = [...ukazatele.values()];
      if (tah && tah.stavi && U.tahNastroje) U.tahNastroje('zrus');
      stipnuti = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), stred: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; tah = null;
    } else if (ukazatele.size === 1) {
      // s nástrojem stavby: levé tlačítko / prst staví, pravé a prostřední posouvají
      const stavi = U.nastroj && (ev.pointerType !== 'mouse' || ev.button === 0);
      tah = { start: bodPlatna(ev), kam: { ...kamera }, posunuto: false, stavi, tlacitko: ev.button };
      if (stavi && mapa) { const pole = kreslic.poleNa(...naSvet(...tah.start)); tah.polePocatek = pole; if (U.tahNastroje) U.tahNastroje('start', pole, pole); }
    }
  });
  platno.addEventListener('pointermove', ev => {
    const p = bodPlatna(ev);
    if (ukazatele.has(ev.pointerId)) ukazatele.set(ev.pointerId, p);
    if (stipnuti && ukazatele.size === 2) {
      const [a, b] = [...ukazatele.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      // dva prsty: posun středem, roztažení přibližuje
      const st = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      kamera.x -= (st[0] - stipnuti.stred[0]) / Z(); kamera.y -= (st[1] - stipnuti.stred[1]) / Z();
      stipnuti.stred = st; omezKameru(); prekresli();
      if (d / stipnuti.d > 1.35) { priblizeni(1, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); stipnuti.d = d; }
      else if (d / stipnuti.d < 0.74) { priblizeni(-1, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); stipnuti.d = d; }
      return;
    }
    if (tah && tah.stavi) {
      const pole = kreslic.poleNa(...naSvet(p[0], p[1]));
      if (pole && (!najeto || pole.x !== najeto.x || pole.y !== najeto.y)) { najeto = pole; if (U.tahNastroje) U.tahNastroje('tah', tah.polePocatek, pole); prekresli(); }
      return;
    }
    if (tah) {
      const dx = p[0] - tah.start[0], dy = p[1] - tah.start[1];
      if (!tah.posunuto && Math.hypot(dx, dy) > 5) { tah.posunuto = true; platno.classList.add('tahne'); }
      if (tah.posunuto) { kamera.x = tah.kam.x - dx / Z(); kamera.y = tah.kam.y - dy / Z(); omezKameru(); prekresli(); }
      return;
    }
    if (ev.pointerType === 'mouse' && mapa) {
      const pole = kreslic.poleNa(...naSvet(p[0], p[1]));
      if ((pole && najeto && pole.x === najeto.x && pole.y === najeto.y) || (!pole && !najeto)) return;
      najeto = pole; prekresli();
      if (U.nastroj && U.tahNastroje) U.tahNastroje('najeti', pole, pole);
      $('stPole').textContent = pole ? `${pole.x}, ${pole.y} · výška ${M.minR(mapa, pole.x, pole.y)}` : '–';
    }
  });
  const pust = ev => {
    ukazatele.delete(ev.pointerId);
    if (ukazatele.size < 2) stipnuti = null;
    if (tah && ukazatele.size === 0) {
      if (tah.stavi) {
        const pole = kreslic.poleNa(...naSvet(...bodPlatna(ev))) || najeto;
        if (U.tahNastroje) U.tahNastroje(ev.type === 'pointerup' ? 'konec' : 'zrus', tah.polePocatek, pole, bodPlatna(ev));
      } else if (!tah.posunuto && ev.type === 'pointerup' && mapa) {
        if (tah.tlacitko === 2 && U.nastroj) { U.zrusNastroj(); }
        else {
          const p = bodPlatna(ev);
          const v = U.vozidloNa ? U.vozidloNa(p[0], p[1]) : null;
          if (v && U.klikVozidlo) U.klikVozidlo(v, p);
          else {
            const pole = kreslic.poleNa(...naSvet(...p));
            if (pole) { najeto = pole; prekresli(); if (!(U.klikPole && U.klikPole(pole, p))) infoPole(pole.x, pole.y, p); }
          }
        }
      }
      tah = null; platno.classList.remove('tahne');
      prekresli();
    }
  };
  platno.addEventListener('pointerup', pust);
  platno.addEventListener('pointercancel', pust);
  platno.addEventListener('contextmenu', ev => ev.preventDefault());
  platno.addEventListener('pointerleave', ev => { if (ev.pointerType === 'mouse' && najeto && !tah) { najeto = null; prekresli(); } });
  platno.addEventListener('wheel', ev => {
    ev.preventDefault();
    const p = bodPlatna(ev);
    priblizeni(ev.deltaY < 0 ? 1 : -1, p[0], p[1]);
  }, { passive: false });

  // --- klávesnice --------------------------------------------------------------------
  const drzene = new Set();
  // posun mapy i klávesami W A S D (podle fyzické klávesy – funguje i v jiném rozložení klávesnice)
  const WASD = { KeyW: 'arrowup', KeyA: 'arrowleft', KeyS: 'arrowdown', KeyD: 'arrowright' };
  document.addEventListener('keydown', ev => {
    if (ev.target.closest('input, textarea') || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (!$('dlgNova').hidden) { if (ev.key === 'Escape') zavriDialog(); return; }
    if (document.querySelector('dialog[open]')) return;
    const k = ev.key;
    if (U.klavesa && U.klavesa(ev)) { ev.preventDefault(); return; }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(k)) { drzene.add(k.toLowerCase()); ev.preventDefault(); }
    else if (!ev.shiftKey && WASD[ev.code]) { drzene.add(WASD[ev.code]); ev.preventDefault(); }
    else if (k === '+' || k === '=') priblizeni(1);
    else if (k === '-' || k === '_') priblizeni(-1);
    else if (k === 'g' || k === 'G') prepni('mrizka');
    else if (k === 'm' || k === 'M') prepni('minimapa');
    else if (k === 'n' || k === 'N') prepni('popisky');
    else if (k === 'Home') naStred();
    else if (k === ' ') { nastavRychlost(rychlost ? 0 : 1); ev.preventDefault(); }
    else if (k === 'Escape') { if (U.nastroj) U.zrusNastroj(); else zavriHorniOkno(); }
  });
  document.addEventListener('keyup', ev => { drzene.delete(ev.key.toLowerCase()); if (WASD[ev.code]) drzene.delete(WASD[ev.code]); });
  window.addEventListener('blur', () => drzene.clear());
  let posledni = performance.now();
  (function posun(t) {
    requestAnimationFrame(posun);
    const dt = Math.min(0.05, (t - posledni) / 1000); posledni = t;
    if (!drzene.size || !mapa) return;
    const v = 700 / Z() * dt;
    if (drzene.has('arrowleft')) kamera.x -= v;
    if (drzene.has('arrowright')) kamera.x += v;
    if (drzene.has('arrowup')) kamera.y -= v;
    if (drzene.has('arrowdown')) kamera.y += v;
    omezKameru(); prekresli();
  })(posledni);

  // --- přepínače pohledu ---------------------------------------------------------------
  function prepni(co) {
    nast[co] = !nast[co]; ulozNast();
    if (co === 'mrizka' && kreslic) kreslic.nastav({ mrizka: nast.mrizka });
    if (co === 'minimapa') $('minimapa').hidden = !nast.minimapa;
    oznacPrepinace(); prekresli();
  }
  function oznacPrepinace() {
    $('miMrizka').setAttribute('aria-pressed', String(!!nast.mrizka));
    $('miMinimapa').setAttribute('aria-pressed', String(!!nast.minimapa));
    $('miPopisky').setAttribute('aria-pressed', String(!!nast.popisky));
    $('miPrumPopisky').setAttribute('aria-pressed', String(!!nast.prumPopisky));
    $('miNoc').setAttribute('aria-pressed', String(!!nast.noc));
    $('miNalozeni').setAttribute('aria-pressed', String(!!nast.nalozeni));
    $('miStaniceJm').setAttribute('aria-pressed', String(!!nast.staniceJm));
  }

  // --- okna ------------------------------------------------------------------------------
  const plocha = $('plocha');
  let zOkna = 20;
  const okna = new Map();
  function okno(id, titulek, telo, kde) {
    let o = okna.get(id);
    if (!o) {
      o = document.createElement('section');
      o.className = 'okno'; o.setAttribute('role', 'dialog');
      // zavírací tlačítko je v DOM první (háčky jinde hledají „.ok-hlava button“), sbalení se řadí před něj přes CSS order
      o.innerHTML = '<div class="ok-hlava"><span></span><button class="zavrit" aria-label="Zavřít" title="Zavřít (Esc)">✕</button><button class="sbalit" aria-label="Sbalit" title="Sbalit / rozbalit (dvojklik na záhlaví)">▁</button></div><div class="ok-telo"></div>';
      plocha.appendChild(o);
      okna.set(id, o);
      o.querySelector('.zavrit').addEventListener('click', () => zavriOkno(id));
      const sbal = () => { o.classList.toggle('sbalene'); o.querySelector('.sbalit').textContent = o.classList.contains('sbalene') ? '▢' : '▁'; };
      o.querySelector('.sbalit').addEventListener('click', sbal);
      const hlava = o.querySelector('.ok-hlava');
      hlava.addEventListener('dblclick', ev => { if (!ev.target.closest('button')) sbal(); });
      // poloha se pamatuje podle druhu okna (vozidlo, stanice, garáž…), ne podle konkrétního
      const druh = id.replace(/\d+$/, '');
      let t = null;
      hlava.addEventListener('pointerdown', ev => {
        if (ev.target.closest('button')) return;
        hlava.setPointerCapture(ev.pointerId);
        t = { x: ev.clientX - o.offsetLeft, y: ev.clientY - o.offsetTop, posunuto: false };
      });
      hlava.addEventListener('pointermove', ev => {
        if (!t) return;
        t.posunuto = true;
        o.style.left = Math.max(0, Math.min(plocha.clientWidth - 60, ev.clientX - t.x)) + 'px';
        o.style.top = Math.max(0, Math.min(plocha.clientHeight - 30, ev.clientY - t.y)) + 'px';
      });
      hlava.addEventListener('pointerup', () => {
        if (t && t.posunuto) { nast.okna = { ...(nast.okna || {}), [druh]: [o.offsetLeft, o.offsetTop] }; ulozNast(); }
        t = null;
      });
      o.addEventListener('pointerdown', () => { o.style.zIndex = ++zOkna; });
      // zapamatovaná poloha druhu, jinak zadaná, jinak kaskádou; víc oken stejného druhu se posune, ať se nekryjí přesně
      const stejnych = [...okna.keys()].filter(k => k !== id && k.replace(/\d+$/, '') === druh).length;
      const zapam = nast.okna && nast.okna[druh];
      const posun = (zapam ? stejnych : (okna.size - 1)) % 7 * 28;
      let x, y;
      if (zapam) { [x, y] = zapam; x += posun; y += posun; }
      else { [x, y] = kde || [plocha.clientWidth / 2 - 130, 60]; x += 16 + (kde ? 0 : posun); y += 10 + (kde ? 0 : posun); }
      o.style.left = Math.max(6, Math.min(plocha.clientWidth - 250, x)) + 'px';
      o.style.top = Math.max(6, Math.min(plocha.clientHeight - 160, y)) + 'px';
    }
    if (!U.obnova) o.style.zIndex = ++zOkna;   // živé obnovení okno nevytahuje navrch
    o.querySelector('.ok-hlava span').textContent = titulek;
    const t = o.querySelector('.ok-telo');
    t.replaceChildren();
    if (typeof telo === 'string') t.innerHTML = telo; else t.appendChild(telo);
    return o;
  }
  function zavriOkno(id) { const o = okna.get(id); if (o) { o.remove(); okna.delete(id); prekresli(); } }   // překreslit: trasa vozidla, oblast stanice
  function zavriVsechnaOkna() { for (const id of [...okna.keys()]) zavriOkno(id); }
  function zavriHorniOkno() {
    let nej = null, z = -1;
    for (const [id, o] of okna) if (+o.style.zIndex > z) { z = +o.style.zIndex; nej = id; }
    if (nej) zavriOkno(nej);
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tlacitko = (text, fn) => { const b = document.createElement('button'); b.textContent = text; b.addEventListener('click', fn); return b; };

  const NAZVY_TERENU = { [D.T.TRAVA]: 'Tráva', [D.T.VODA]: 'Voda', [D.T.PISEK]: 'Písek', [D.T.SKALA]: 'Skály', [D.T.SNIH]: 'Sníh', [D.T.POLE]: 'Pole' };
  function infoPole(x, y, kde) {
    const i = M.idx(mapa, x, y);
    if (mapa.dum[i]) return infoMesto(mapa.mesta[mapa.domy[mapa.dum[i] - 1].mesto], kde, mapa.domy[mapa.dum[i] - 1]);
    if (mapa.prum[i]) return infoPrumysl(mapa.prumysl[mapa.prum[i] - 1], kde);
    const mn = M.minR(mapa, x, y), mx = M.maxR(mapa, x, y);
    let co = NAZVY_TERENU[mapa.typ[i]];
    if (mapa.typ[i] === D.T.VODA) co = 'Moře';
    if (mapa.les[i]) co += ' · les';
    if (mapa.reka[i]) co = 'Řeka';
    if (mapa.cesta[i]) co = 'Silnice (obec)';
    const mesto = mapa.mesta.reduce((a, c) => !a || Math.hypot(c.x - x, c.y - y) < Math.hypot(a.x - x, a.y - y) ? c : a, null);
    okno('pole', `📍 Pole ${x}, ${y}`, `<table>
      <tr><td>Povrch</td><td>${esc(co)}</td></tr>
      <tr><td>Výška</td><td>${mn === mx ? mn : `${mn}–${mx} (svah)`}</td></tr>
      ${mesto ? `<tr><td>Nejbližší město</td><td>${esc(mesto.jmeno)} (${Math.round(Math.hypot(mesto.x - x, mesto.y - y))} polí)</td></tr>` : ''}
    </table>`, kde);
  }
  const lista = (...t) => { const d = document.createElement('div'); d.className = 'lista'; d.append(...t.filter(Boolean)); return d; };
  function infoMesto(c, kde, dum) {
    const domy = mapa.domy.filter(d => d.mesto === c.id);
    const tel = document.createElement('div');
    tel.append(lista(tlacitko('🎯 Ukázat', () => naPole(c.x, c.y))));
    tel.insertAdjacentHTML('beforeend', `<table>
      <tr><td>Obyvatel</td><td><b>${c.obyv.toLocaleString('cs-CZ')}</b></td></tr>
      <tr><td>Domů</td><td>${domy.length}</td></tr>
      <tr><td>Střed</td><td>${c.x}, ${c.y}</td></tr>
      ${dum ? `<tr><td>Tenhle dům</td><td>${dum.obyv ? dum.obyv + ' obyvatel' : 'kostel'}</td></tr>` : ''}
      ${statMesta(c)}
    </table>`);
    // vlastní stanice ve městě (klik = okno stanice)
    const sts = hra ? hra.stanice.filter(st => st && st.mesto === c.id) : [];
    if (sts.length && U.oknoStanice) {
      const sez = document.createElement('div'); sez.className = 'seznam';
      for (const st of sts) { const b = tlacitko('', () => U.oknoStanice(st.id)); b.innerHTML = `<span>🚏 ${esc(st.jmeno)}</span><small>${Object.entries(st.naklady).filter(([, z]) => z.ceka).map(([k, z]) => `${U.ikN ? U.ikN(k, 14) : ''}${z.ceka}`).join(' ')}</small>`; sez.append(b); }
      tel.insertAdjacentHTML('beforeend', `<div class="nadpis-roz">Moje stanice (${sts.length})</div>`); tel.append(sez);
    }
    // akce u obce (kampaň, výstavba, dar)
    const cs = hra && hra.mestaStat && hra.mestaStat[c.id];
    if (cs) {
      tel.insertAdjacentHTML('beforeend', '<div class="nadpis-roz">Akce u obce</div>');
      const box = document.createElement('div'); box.className = 'akce-obce';
      for (const [id, a] of Object.entries(H.AKCE_OBCE)) {
        const r = H.akceObce(hra, c.id, id, true);
        const bezi = a.bonus ? cs.kampan && cs.kampan.do > hra.den && `běží ještě ${cs.kampan.do - hra.den} dní` : id === 'vystavba' ? cs.vystavbaDo > hra.den && `běží ještě ${cs.vystavbaDo - hra.den} dní` : '';
        const b = tlacitko(`${a.ikona} ${a.nazev} · ${H.penizeText(r.cena || 0)}`, () => {
          const x = H.akceObce(hra, c.id, id);
          if (!x.ok) { if (U.zprava) U.zprava(x.chyba, null, true); return; }
          if (U.poKroku) U.poKroku(hra, true);
          infoMesto(c, null, dum);
        });
        b.title = a.bonus ? `Na ${a.dni} dní zvedne hodnocení tvých stanic ve městě (víc cestujících a nákladu)` : id === 'vystavba' ? 'Rok rychlejšího růstu města' : 'Zlepší hodnocení firmy obcí (povolení stavět a bourat)';
        if (bezi) { b.disabled = true; b.textContent += ` – ${bezi}`; }
        box.append(b);
      }
      tel.append(box);
    }
    okno('mesto' + c.id, `🏘️ ${c.jmeno}`, tel, kde);
  }
  // hodnocení firmy a minulý měsíc (cestující, pošta, potraviny) – jen když běží hra
  function statMesta(c) {
    const cs = hra && hra.mestaStat && hra.mestaStat[c.id];
    if (!cs) return '';
    const mm = cs.minuly || {}, pct = (a, b) => b ? Math.round(a / b * 100) + ' %' : '–';
    const n = cs.hodn, barva = n >= 100 ? 'var(--ok,#2e9e55)' : n < -100 ? 'var(--danger,#e5533d)' : 'inherit';
    return `<tr><td>Hodnocení firmy</td><td style="color:${barva}"><span class="hodn" style="--h:${Math.round((n + 1000) / 20)}%"><b>${H.hodnoceniText(n)}</b></span> <small>(${n})</small></td></tr>
      <tr><td>Cestující min. měsíc</td><td>${mm.lideOdv || 0} z ${mm.lide || 0} odvezeno (${pct(mm.lideOdv, mm.lide)})</td></tr>
      <tr><td>Pošta min. měsíc</td><td>${mm.postaOdv || 0} z ${mm.posta || 0} (${pct(mm.postaOdv, mm.posta)})</td></tr>
      ${c.obyv > 1500 ? `<tr><td>Potraviny</td><td>${mm.dodano_potraviny ? `dovezeno ${mm.dodano_potraviny} t ✓` : '<b>potřebuje dovoz potravin</b> (jinak roste pomalu)'}</td></tr>` : ''}
      ${c.obyv > 3000 ? `<tr><td>Voda</td><td>${mm.dodano_voda ? `dovezeno ${mm.dodano_voda} t ✓` : '<b>potřebuje dovoz vody z vodárny</b>'}</td></tr>` : ''}
      ${mm.dodano_zbozi ? `<tr><td>Zboží</td><td>dovezeno ${mm.dodano_zbozi}</td></tr>` : ''}`;
  }
  const nakladText = id => { const n = D.NAKLADY.find(n => n.id === id); return n ? n.nazev : id; };
  const nakladHtml = (id, px = 16) => `${U.ikN ? U.ikN(id, px) : ''} ${esc(nakladText(id))}`;
  function infoPrumysl(q, kde) {
    const p = D.PRUMYSL_PODLE_ID[q.typ];
    const vyr = Object.entries(q.vyroba).filter(([, v]) => v > 0);
    const zpracuje = Object.keys(p.vyroba).filter(k => !p.vyroba[k]);
    const tel = document.createElement('div');
    tel.append(lista(tlacitko('🎯 Ukázat', () => naPole(q.x + (q.w >> 1), q.y + (q.h >> 1)))));
    tel.insertAdjacentHTML('beforeend', `<table>
      ${vyr.length ? `<tr><td>Těží / pěstuje</td><td>${vyr.map(([k, v]) => `<span class="stitek">${nakladHtml(k)} ${v} t/měs.</span>`).join(' ')}</td></tr>` : ''}
      ${p.prijima.length ? `<tr><td>Přijímá</td><td>${p.prijima.map(k => `<span class="stitek">${nakladHtml(k)}</span>`).join(' ')}</td></tr>` : ''}
      ${zpracuje.length ? `<tr><td>Vyrábí</td><td>${zpracuje.map(k => `<span class="stitek">${nakladHtml(k)}</span>`).join(' ')}<br><small>podle dovezených surovin</small></td></tr>` : ''}
      ${statPodniku(q)}
      <tr><td>Poloha</td><td>${q.x}, ${q.y} · ${q.w} × ${q.h} polí</td></tr>
    </table>`);
    okno('prum' + q.id, `${p.ikona} ${q.jmeno}`, tel, kde);
  }
  function statPodniku(q) {
    const s = hra && hra.prum && hra.prum[q.id];
    if (!s) return '';
    const mm = s.minuly || {};
    const radky = Object.keys(mm).filter(k => k.startsWith('vyrobeno_')).map(k => {
      const t = k.slice(9), v = mm[k], o = mm['odvezeno_' + t] || 0;
      return `<span class="stitek">${nakladHtml(t)} ${v} t, odvezeno ${Math.round(o / v * 100)} %</span>`;
    });
    const dod = Object.keys(mm).filter(k => k.startsWith('dodano_')).map(k => `<span class="stitek">${nakladHtml(k.slice(7))} ${mm[k]}</span>`);
    return `${radky.length ? `<tr><td>Minulý měsíc</td><td>${radky.join(' ')}</td></tr>` : ''}
      ${dod.length ? `<tr><td>Dodáno min. měsíc</td><td>${dod.join(' ')}</td></tr>` : ''}`;
  }
  function seznamMest() {
    const tel = document.createElement('div'); tel.className = 'seznam';
    for (const c of [...mapa.mesta].sort((a, b) => b.obyv - a.obyv)) {
      const b = tlacitko('', () => { naPole(c.x, c.y); infoMesto(c); });
      const hd = hra && hra.mestaStat && hra.mestaStat[c.id] ? hra.mestaStat[c.id].hodn : null;
      b.innerHTML = `<span>${esc(c.jmeno)}${hd ? `<br><small>${H.hodnoceniText(hd)}</small>` : ''}</span><small>${c.obyv.toLocaleString('cs-CZ')}</small>`;
      tel.append(b);
    }
    const celkem = mapa.mesta.reduce((a, c) => a + c.obyv, 0);
    okno('seznamMest', `🏘️ Města (${mapa.mesta.length}, ${celkem.toLocaleString('cs-CZ')} obyv.)`, tel, [10, 10]);
  }
  function seznamPrumyslu() {
    const tel = document.createElement('div'); tel.className = 'seznam';
    const aktivni = mapa.prumysl.filter(q => !q.zrusen);
    for (const q of aktivni.sort((a, b) => a.jmeno.localeCompare(b.jmeno, 'cs'))) {
      const b = tlacitko('', () => { naPole(q.x + (q.w >> 1), q.y + (q.h >> 1)); infoPrumysl(q); });
      const mm = hra && hra.prum && hra.prum[q.id] ? hra.prum[q.id].minuly || {} : {};
      const vyr = Object.keys(mm).filter(k => k.startsWith('vyrobeno_')).reduce((a, k) => a + mm[k], 0), odv = Object.keys(mm).filter(k => k.startsWith('odvezeno_')).reduce((a, k) => a + mm[k], 0);
      b.innerHTML = `<span>${D.PRUMYSL_PODLE_ID[q.typ].ikona} ${esc(q.jmeno)}</span>${vyr ? `<small title="Odvezeno minulý měsíc">odvoz ${Math.round(odv / vyr * 100)} %</small>` : ''}`;
      tel.append(b);
    }
    okno('seznamPrum', `🏭 Průmysl (${aktivni.length})`, tel, [10, 10]);
  }

  // --- dialog nové mapy ------------------------------------------------------------------
  let volbyDlg = {};
  function otevriDialog() {
    volbyDlg = { rok: 1950, ...nast.opt };
    document.querySelectorAll('#dlgNova .volby[data-volba]').forEach(sk => {
      sk.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(String(volbyDlg[sk.dataset.volba]) === b.dataset.h)));
    });
    $('kodMapy').value = MAG.kodSeedu((Math.random() * 1073741824) >>> 0);
    $('dlgNova').hidden = false;
    $('dlgVytvor').focus();
  }
  function zavriDialog() { $('dlgNova').hidden = true; }
  document.querySelectorAll('#dlgNova .volby[data-volba]').forEach(sk => sk.addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    volbyDlg[sk.dataset.volba] = ['velikost', 'rok'].includes(sk.dataset.volba) ? +b.dataset.h : b.dataset.h;
    sk.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  }));
  $('kodNahodne').addEventListener('click', () => { $('kodMapy').value = MAG.kodSeedu((Math.random() * 1073741824) >>> 0); });
  $('dlgZrusit').addEventListener('click', zavriDialog);
  $('dlgNova').addEventListener('click', ev => { if (ev.target === $('dlgNova')) zavriDialog(); });
  $('dlgVytvor').addEventListener('click', async () => {
    if (hra && hra.den > 0 && !(await Dialog.potvrd('Začít novou hru? Rozehraná hra se ztratí, pokud ji neuložíš do pozice.'))) return;
    const seed = MAG.seedZKodu($('kodMapy').value) ?? ((Math.random() * 1073741824) >>> 0);
    zavriDialog();
    nactiMapu(seed, volbyDlg);
  });

  // --- nabídky ------------------------------------------------------------------------------
  if (window.TrubkyGui) TrubkyGui.pripoj({});
  document.querySelector('.horni').addEventListener('click', ev => {
    const b = ev.target.closest('.pol'); if (b) { if (window.TrubkyGui) TrubkyGui.zavriNabidky(); setTimeout(() => b.blur(), 0); }
  });
  $('miNova').addEventListener('click', otevriDialog);
  $('miDne').addEventListener('click', async () => {
    if (hra && hra.den > 0 && !(await Dialog.potvrd('Začít mapu dne? Rozehraná hra se ztratí, pokud ji neuložíš do pozice.'))) return;
    nactiMapu(MAG.seedDne(new Date()), { ...M.VYCHOZI, rok: 1950 });
  });
  document.querySelectorAll('#rychlost button').forEach(b => b.addEventListener('click', () => nastavRychlost(+b.dataset.r)));
  $('miPribliz').addEventListener('click', () => priblizeni(1));
  $('miOddal').addEventListener('click', () => priblizeni(-1));
  $('miStred').addEventListener('click', naStred);
  $('miMrizka').addEventListener('click', () => prepni('mrizka'));
  $('miMinimapa').addEventListener('click', () => prepni('minimapa'));
  $('miPopisky').addEventListener('click', () => prepni('popisky'));
  $('miPrumPopisky').addEventListener('click', () => prepni('prumPopisky'));
  $('miNoc').addEventListener('click', () => prepni('noc'));
  $('miNalozeni').addEventListener('click', () => prepni('nalozeni'));
  $('miStaniceJm').addEventListener('click', () => prepni('staniceJm'));
  $('miMesta').addEventListener('click', seznamMest);
  $('miPrumysl').addEventListener('click', seznamPrumyslu);
  $('miNapoveda').addEventListener('click', () => $('napoveda').showModal());
  $('napovedaZavrit').addEventListener('click', () => $('napoveda').close());

  // --- start ---------------------------------------------------------------------------------
  new ResizeObserver(() => { velikost(); if (mapa) pripravMinimapu(); }).observe(platno);
  oznacPrepinace();
  velikost();
  requestAnimationFrame(snimek);
  nastavRychlost(1);
  // obrázky z atlasů: po načtení překreslit vše (do té doby kreslí kód)
  G.nactiAtlasy(() => { if (kreslic) kreslic.zneplatni(); prekresli(); if (U.poAtlasech) U.poAtlasech(); });
  G.nactiVozidla(() => { prekresli(); if (U.poAtlasech) U.poAtlasech(); });
  const novaZeSeedu = () => nactiMapu((nast.kod && MAG.seedZKodu(nast.kod)) ?? MAG.seedDne(new Date()), nast.opt);
  // rozehraná hra z automatického uložení, jinak nová
  (U.nactiAuto ? U.nactiAuto() : Promise.resolve(null)).then(h => { if (h) zacniHru(h.hra, h.kamera); else novaZeSeedu(); }).catch(novaZeSeedu);

  // defineProperties (ne assign) – gettery musí zůstat živé
  Object.defineProperties(U, Object.getOwnPropertyDescriptors({
    get hra() { return hra; }, get mapa() { return mapa; }, get kreslic() { return kreslic; }, get zoom() { return Z(); },
    get platnoW() { return platnoW; }, get platnoH() { return platnoH; }, get rychlost() { return rychlost; }, get noc() { return !!nast.noc; }, get nalozeni() { return !!nast.nalozeni; },
    kamera, naPole, prekresli, okno, zavriOkno, esc, tlacitko, zacniHru, nastavRychlost, infoMesto, infoPrumysl, pripravMinimapu,
    naSvet, zavriVsechnaOkna, otevriDialog, okna,
  }));
  // pro testy
  window.MAG_UI = { get mapa() { return mapa; }, get hra() { return hra; }, kamera, naPole, priblizeni, infoPole, seznamMest, seznamPrumyslu, nactiMapu,
    zacniHru, nastavRychlost, get zoom() { return Z(); }, get hotovo() { return !!mapa && vykreslenaMapa === mapa && !chybi && (!spinave || animuje); } };   // bloky dokreslené (animace kouře / vozidel překreslují stále)
})();
