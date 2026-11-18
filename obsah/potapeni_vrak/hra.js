/* Potápění k vraku – rozhraní, smyčka hry, panely. Logika je v jadro.js, kreslení v grafika.js. */
(function () {
  'use strict';
  const J = window.VrakJadro, G = window.VrakGrafika;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (v, d = 1) => v.toFixed(d).replace('.', ',');
  const casText = cas => { const d = J.denCas(cas); return `den ${d.den}, ${String(d.hodiny).padStart(2, '0')}:${String(d.minuty).padStart(2, '0')}`; };
  const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  // ---------- uložení ----------
  let hra;
  try { hra = J.migruj(JSON.parse(localStorage.getItem(J.KLIC))); } catch { hra = J.novaHra(); }
  const uloz = () => { try { localStorage.setItem(J.KLIC, JSON.stringify(hra)); } catch { /* plné / zakázané úložiště */ } };
  let volba = { misto: 'zatoka', plyn: 'vzduch' };
  try { Object.assign(volba, JSON.parse(localStorage.getItem('webapp_potapeni_vrak_volba')) || {}); } catch { /* nic */ }
  if (!J.misto(volba.misto) || !J.odemceno(hra, volba.misto)) volba.misto = 'zatoka';
  const ulozVolbu = () => { try { localStorage.setItem('webapp_potapeni_vrak_volba', JSON.stringify(volba)); } catch { /* nic */ } };

  // ---------- stav ----------
  let p = null, mapa = null, teren = null, pauza = false, zrychli = false, sprint = false, rizeny = false;
  let cas = 0, svetloUhel = 0, plave = false, posledniZprava = 0, zpravaDo = 0, pocitac = null, pocitacCas = -9;
  const klavesy = new Set();
  let ukazatel = null;   // {x,y} v px plátna, když je stisknuto
  const castice = [], bubliny = [];
  let dechCas = 0;

  const cv = $('platno'), ctx = cv.getContext('2d');
  const tma = document.createElement('canvas'), tctx = tma.getContext('2d');
  const kopie = document.createElement('canvas'), kctx = kopie.getContext('2d');
  let cw = 0, ch = 0, dpr = 1, s = 24, kamX = 0, kamY = 0;

  function nactiMisto(id) {
    mapa = p ? p.mapa : J.mapaProHru(hra, id);
    teren = G.pripravTeren(mapa);
    castice.length = 0;
    for (let i = 0; i < 90; i++) castice.push({ x: mapa.lodX + Math.random() * 40 - 20, y: Math.random() * 30 - 8, r: Math.random() });
  }
  function velikost() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cw = r.width; ch = r.height;
    for (const c of [cv, tma, kopie]) { c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); }
    s = Math.max(20, Math.min(44, Math.min(cw / 18, ch / 13)));
  }
  new ResizeObserver(velikost).observe(cv);

  // ---------- vstup ----------
  const KL = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd' };
  addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input,select,textarea,dialog')) return;
    if (KL[e.code]) { klavesy.add(KL[e.code]); if (p) e.preventDefault(); }
    if (e.key === 'Shift') klavesy.add('shift');
    if (e.repeat) return;
    if ((e.code === 'KeyE' || e.code === 'Space') && p) { e.preventDefault(); akce(); }
    else if (e.code === 'KeyF') prepniSvetlo();
    else if (e.code === 'KeyR') prepniRizeny();
    else if (e.code === 'KeyT') prepniZrychleni();
    else if (e.code === 'KeyP' || e.code === 'Escape') prepniPauzu();
    else if (e.key === '?') ukazZalozku('napoveda');
    else if (e.code === 'Enter' && !p) skok();
  });
  addEventListener('keyup', e => { if (KL[e.code]) klavesy.delete(KL[e.code]); if (e.key === 'Shift') klavesy.delete('shift'); });
  addEventListener('blur', () => { klavesy.clear(); ukazatel = null; });
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); ukazatel = { x: e.offsetX, y: e.offsetY }; });
  cv.addEventListener('pointermove', e => { if (ukazatel) ukazatel = { x: e.offsetX, y: e.offsetY }; });
  for (const t of ['pointerup', 'pointercancel']) cv.addEventListener(t, () => { ukazatel = null; });

  function vstup() {
    let dx = 0, dy = 0;
    if (klavesy.has('l')) dx -= 1; if (klavesy.has('r')) dx += 1;
    if (klavesy.has('u')) dy -= 1; if (klavesy.has('d')) dy += 1;
    if (ukazatel && p) {
      const wx = (ukazatel.x - cw / 2) / s + kamX, wy = (ukazatel.y - ch / 2) / s + kamY;
      const vx = wx - p.x, vy = wy - p.y, l = Math.hypot(vx, vy);
      if (l > 0.4) { dx = vx / l * Math.min(1, l / 1.5); dy = vy / l * Math.min(1, l / 1.5); }
    }
    // narkóza: ruce nejdou přesně tam, kam chceš
    const n = J.narkoza(p.y, p.fN2);
    if (n > 0 && (dx || dy)) {
      const u = Math.sin(cas * 0.7) * n * 0.45, c = Math.cos(u), sn = Math.sin(u);
      [dx, dy] = [dx * c - dy * sn, dx * sn + dy * c];
    }
    if (dx || dy) svetloUhel = Math.atan2(dy, dx);
    else svetloUhel = p.smer > 0 ? 0.25 : Math.PI - 0.25;
    plave = Math.hypot(dx, dy) > 0.1;
    if (plave && Math.abs(dy) > 0.3 && rizeny) { rizeny = false; aktualizujTlacitka(); }
    return { dx, dy, rychle: sprint || klavesy.has('shift'), rizeny };
  }

  // ---------- akce ----------
  function akce() {
    if (!p || pauza) return;
    J.interakce(p);
  }
  function prepniSvetlo() { if (!p) return; if (p.baterie > 0) p.svetlo = !p.svetlo; aktualizujTlacitka(); }
  function prepniRizeny() { if (!p) return; rizeny = !rizeny; aktualizujTlacitka(); }
  function prepniZrychleni() { zrychli = !zrychli; aktualizujTlacitka(); }
  function prepniPauzu() { if (!p) return; pauza = !pauza; $('pauza').hidden = !pauza; aktualizujTlacitka(); }
  function aktualizujTlacitka() {
    $('bZrychli').setAttribute('aria-pressed', zrychli);
    $('bPauza').textContent = pauza ? '▶' : '⏸';
    $('ovl').hidden = !p; $('bSkok').hidden = !!p;
    if (!p) return;
    $('tSvetlo').setAttribute('aria-pressed', p.svetlo);
    $('tSprint').setAttribute('aria-pressed', sprint);
    $('tVystup').setAttribute('aria-pressed', rizeny);
  }
  $('tSvetlo').onclick = prepniSvetlo;
  $('tSprint').onclick = () => { sprint = !sprint; aktualizujTlacitka(); };
  $('tVystup').onclick = prepniRizeny;
  $('tAkce').onclick = akce;
  $('bZrychli').onclick = prepniZrychleni;
  $('bPauza').onclick = prepniPauzu;
  $('bSkok').onclick = () => skok();

  function skok() {
    if (p) return;
    if (!J.odemceno(hra, volba.misto)) return;
    p = J.novyPonor(hra, volba.misto, volba.plyn);
    nactiMisto(volba.misto);
    rizeny = false; sprint = false; pauza = false; posledniZprava = 0; pocitacCas = -9;
    $('pauza').hidden = true;
    aktualizujTlacitka(); vykresliPlan();
    zobrazZpravu('Ponor začal. Jsi u lodi – kotevní lano vede k vraku.', '');
  }
  async function nouzovyVystup() {
    zavriNabidky();
    if (!p) { Dialog.info('Teď se nepotápíš.'); return; }
    if (await Dialog.potvrd('Ukončit ponor nouzovým výstupem? Síťku s nálezy pustíš a výstup bude rychlý – hrozí dekompresní nemoc.')) {
      p.nouze = 'vlastni';
    }
  }
  $('mNouze').onclick = nouzovyVystup;
  $('mNapoveda').onclick = () => { zavriNabidky(); ukazZalozku('napoveda'); };
  $('mNova').onclick = async () => {
    zavriNabidky();
    if (!await Dialog.potvrd('Začít novou kariéru? Peníze, výbava, sbírka i deník se smažou.')) return;
    hra = J.novaHra(); p = null; volba = { misto: 'zatoka', plyn: 'vzduch' }; uloz(); ulozVolbu();
    nactiMisto('zatoka'); aktualizujTlacitka(); vykresliVse();
  };

  // ---------- nabídky lišty ----------
  function zavriNabidky() { document.querySelectorAll('.nabidka').forEach(n => { n.hidden = true; }); }
  document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const n = $(b.dataset.nabidka), bylo = !n.hidden;
    zavriNabidky(); if (bylo) return;
    n.hidden = false;
    const r = b.getBoundingClientRect();
    n.style.top = (r.bottom + 4) + 'px';
    n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
  }));
  document.addEventListener('click', e => { if (!e.target.closest('.nabidka')) zavriNabidky(); });

  // ---------- konec ponoru ----------
  function konecPonoru() {
    const sh = J.vyhodnot(hra, p);
    const misto = J.misto(p.misto);
    p = null; rizeny = false; uloz();
    nactiMisto(volba.misto); aktualizujTlacitka(); vykresliVse();
    const nazvy = a => a.length ? a.map(t => esc(J.PREDMETY[t].nazev)).join(', ') : '–';
    const duvody = { lod: 'Vylezl jsi na loď.', vzduch: 'Došel vzduch – nouzový výstup.', zraneni: 'Zranění – parťák tě vytáhl na hladinu.', kyslik: 'Kyslíková otrava – parťák tě vytáhl na hladinu.', vlastni: 'Nouzový výstup.' };
    let nemoc = '<p class="ok">✓ Bez příznaků dekompresní nemoci.</p>';
    if (sh.nemoc === 'lehka') nemoc = '<p class="varovani">⚠ Lehké příznaky dekompresní nemoci (únava, svědění kůže). Dnes už nepotápět – odpočinek 12 h.</p>';
    if (sh.nemoc === 'tezka') nemoc = `<p class="varovani">🚑 Dekompresní nemoc! Převoz do přetlakové komory – den mimo vodu, léčba ${sh.poplatek} $.</p>`;
    $('souhrnObsah').innerHTML = `<h2>${sh.vyhra ? '🏆 Truhla San Esteban je tvoje!' : '🤿 Ponor č. ' + sh.c + ' – ' + esc(misto.nazev)}</h2>
      <p>${duvody[sh.duvod] || ''}</p>
      ${sh.vyhra ? '<p>Legendární poklad galeony je na palubě. Gratulace – můžeš se dál potápět a dosbírat zbytek.</p>' : ''}
      <table>
        <tr><td>Délka ponoru</td><td>${sh.delka} min</td></tr>
        <tr><td>Max. / průměrná hloubka</td><td>${fmt(sh.maxH)} / ${fmt(sh.prumH)} m</td></tr>
        <tr><td>Vzduch</td><td>${sh.barStart} → ${sh.barKonec} bar</td></tr>
        <tr><td>Bezpečnostní zastávka</td><td>${sh.bezp ? '✓' : '–'}</td></tr>
        <tr><td>Riziko DCS (body)</td><td>${fmt(sh.riziko, 2)}</td></tr>
        <tr><td>Nálezy</td><td>${nazvy(sh.nalezy)}</td></tr>
        ${sh.ztraceno.length ? `<tr><td>Ztraceno (síťka)</td><td>${nazvy(sh.ztraceno)}</td></tr>` : ''}
        <tr><td>Výdělek</td><td>+${sh.zisk} $${sh.poplatek ? ` / −${sh.poplatek} $` : ''}</td></tr>
      </table>${nemoc}`;
    $('souhrn').showModal();
  }
  $('souhrnOk').onclick = () => $('souhrn').close();

  // ---------- zprávy ----------
  function zobrazZpravu(text, druh) {
    const z = $('zprava');
    z.textContent = text; z.className = 'zprava ' + (druh || ''); z.style.opacity = 1;
    zpravaDo = performance.now() + 4000;
  }

  // ---------- smyčka ----------
  let posledni = performance.now();
  function snimek(ted) {
    const dt = Math.min(0.1, (ted - posledni) / 1000); posledni = ted;
    cas += dt;
    if (p && !pauza) {
      const v = vstup();
      J.krok(p, v, dt * J.CAS * (zrychli ? 4 : 1));
      while (posledniZprava < p.zpravy.length) { const z = p.zpravy[posledniZprava++]; zobrazZpravu(z.text, z.druh); }
      if (p.zpravy.length < posledniZprava) posledniZprava = p.zpravy.length;
      if (p.y < 0.4 && Math.abs(p.x - mapa.lodX) < 4 && !p.nouze && p.t > 20) {
        $('stav').textContent = 'U lodi – zmáčkni E / ✋ a vylez na palubu.';
      }
      if (p.konec) { konecPonoru(); }
    }
    if (zpravaDo && ted > zpravaDo) { $('zprava').style.opacity = 0; zpravaDo = 0; }
    if (mapa) kresli(dt);
    if (p) hud();
    requestAnimationFrame(snimek);
  }

  // ---------- kreslení ----------
  function kresli(dt) {
    const W = mapa.W;
    let cx, cy;
    if (p) { cx = p.x; cy = p.y; } else { cx = mapa.lodX; cy = 1.5; }
    const viditW = cw / s, viditH = ch / s;
    kamX += ((Math.max(viditW / 2, Math.min(W - viditW / 2, cx))) - kamX) * (kamX ? Math.min(1, dt * 4) : 1);
    kamY += ((Math.max(-G.NAD + viditH / 2, Math.min(mapa.H - viditH / 2, cy))) - kamY) * (kamY ? Math.min(1, dt * 4) : 1);
    if (!kamX) kamX = cx;
    const sv = (x, y) => ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (cw / 2 - kamX * s) + x, dpr * (ch / 2 - kamY * s) + y);
    const yTop = kamY - viditH / 2, yBot = kamY + viditH / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // obloha a voda
    const gr = ctx.createLinearGradient(0, 0, 0, ch);
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const y = yTop + (yBot - yTop) * i / n;
      gr.addColorStop(i / n, y < 0 ? G.mix('#bfe9f7', '#7cc8ee', Math.min(1, -y / 8)) : G.barvaVody(y));
    }
    ctx.fillStyle = gr; ctx.fillRect(0, 0, cw, ch);
    // přesné rozhraní hladiny
    if (yTop < 0 && yBot > 0) {
      const yh = (0 - yTop) * s;
      const g2 = ctx.createLinearGradient(0, 0, 0, yh);
      g2.addColorStop(0, '#7cc8ee'); g2.addColorStop(1, '#d8f3fb');
      ctx.fillStyle = g2; ctx.fillRect(0, 0, cw, yh);
      ctx.fillStyle = 'rgba(255,240,180,.9)'; ctx.beginPath(); ctx.arc(cw * 0.8, Math.max(30, yh - 5.5 * s), s * 0.9, 0, 7); ctx.fill();
    }
    sv(0, 0);
    // paprsky světla
    if (yTop < 15) {
      ctx.fillStyle = 'rgba(255,255,255,.05)';
      for (let i = -3; i < 6; i++) {
        const x = Math.floor(kamX / 7) * 7 + i * 7 + Math.sin(cas * 0.3 + i) * 1.5;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 1.6, 0); ctx.lineTo(x + 6, 22); ctx.lineTo(x + 3, 22); ctx.fill();
      }
    }
    // kotevní lano
    ctx.strokeStyle = 'rgba(220,210,180,.6)'; ctx.lineWidth = 0.05;
    ctx.beginPath(); ctx.moveTo(mapa.lodX + 4, 0.3); ctx.lineTo(mapa.vrak.x0 + mapa.vrak.L - 2, mapa.vrak.yt); ctx.stroke();
    // terén
    ctx.drawImage(teren, 0, -G.NAD, W, mapa.H + G.NAD);
    // řasy
    ctx.strokeStyle = 'rgba(70,140,60,.8)'; ctx.lineWidth = 0.09; ctx.lineCap = 'round';
    for (const [x, y, h] of mapa.rasy) {
      if (x < kamX - viditW || x > kamX + viditW) continue;
      const w = Math.sin(cas * 1.3 + x) * 0.4 + (p ? J.proud(mapa, x, y - 1, p.t) * 3 : 0);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + w * 0.5, y - h * 0.5, x + w, y - h); ctx.stroke();
    }
    for (const z of mapa.zavaly) for (const [x, y] of z.bunky) G.zaval(ctx, x, y);
    for (const it of mapa.predmety) G.predmet(ctx, it.typ, it.x, it.y, cas);
    if (p) {
      for (const it of p.stoupajici) { G.predmet(ctx, it.typ, it.x, it.y, cas); G.zvedaciVak(ctx, it.x, it.y); }
      for (const tv of p.tvorove) if (Math.abs(tv.x - kamX) < viditW) G.tvor(ctx, tv, cas, tv.y);
    }
    // loď a potápěč
    G.lod(ctx, mapa.lodX, cas);
    if (p) G.potapec(ctx, p, cas, plave);
    // bubliny
    if (p && p.y > 0.6) {
      dechCas -= dt * J.CAS * (zrychli ? 4 : 1) * (p.sacAktualni || 15) / 15;
      if (dechCas <= 0) { dechCas = 4; for (let i = 0; i < 6; i++) bubliny.push({ x: p.x + p.smer * 0.5, y: p.y - 0.15, r: 0.05 + Math.random() * 0.08, v: 0.6 + Math.random() * 0.6, f: Math.random() * 6 }); }
    }
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 0.025;
    for (const b of bubliny) {
      b.y -= b.v * dt * 1.6; b.x += Math.sin(cas * 5 + b.f) * 0.01;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.stroke();
    }
    for (let i = bubliny.length - 1; i >= 0; i--) if (bubliny[i].y < 0 || !J.pruchozi(J.bunka(mapa, bubliny[i].x, bubliny[i].y))) bubliny.splice(i, 1);
    // částice (ukazují proud)
    ctx.fillStyle = 'rgba(230,240,255,.35)';
    const tok = J.CAS * (zrychli && p && !pauza ? 4 : 1) * (pauza ? 0 : 1);
    for (const c of castice) {
      c.x += (J.proud(mapa, c.x, c.y, p ? p.t : 0) * tok + Math.sin(cas + c.r * 9) * 0.05) * dt;
      c.y += 0.03 * dt;
      // mimo výhled → přenést na druhou stranu
      if (c.x < kamX - viditW / 2 - 1) c.x += viditW + 2; else if (c.x > kamX + viditW / 2 + 1) c.x -= viditW + 2;
      if (c.y < kamY - viditH / 2 - 1) c.y += viditH + 2; else if (c.y > kamY + viditH / 2 + 1) c.y -= viditH + 2;
      if (c.y > 0.3 && J.pruchozi(J.bunka(mapa, c.x, c.y))) ctx.fillRect(c.x, c.y, 0.06, 0.06);
    }
    // vlnky hladiny
    if (yTop < 1) {
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 0.07;
      ctx.beginPath();
      for (let x = Math.floor(kamX - viditW / 2) - 1; x < kamX + viditW / 2 + 1; x += 0.5) ctx.lineTo(x, Math.sin(x * 1.3 + cas * 2) * 0.06);
      ctx.stroke();
    }
    if (p) tmaASvetlo(yTop, yBot);
    if (p) narkozaEfekt();
    if (p) pocitacKresli();
  }

  function tmaASvetlo(yTop, yBot) {
    const W = tma.width, H = tma.height;
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.globalCompositeOperation = 'source-over';
    tctx.clearRect(0, 0, W, H);
    const uvnitr = J.bunka(mapa, p.x, p.y) === J.VNITREK;
    const g = tctx.createLinearGradient(0, 0, 0, H);
    for (let i = 0; i <= 4; i++) {
      const y = yTop + (yBot - yTop) * i / 4;
      let a = y <= 0 ? 0 : (1 - Math.exp(-y / 30)) * 0.8;
      if (uvnitr) a = 1 - (1 - a) * 0.4;
      g.addColorStop(i / 4, `rgba(1,8,20,${Math.min(0.95, a).toFixed(3)})`);
    }
    tctx.fillStyle = g; tctx.fillRect(0, 0, W, H);
    const sx = dpr * ((p.x - kamX) * s + cw / 2), sy = dpr * ((p.y - kamY) * s + ch / 2);
    tctx.globalCompositeOperation = 'destination-out';
    let r = dpr * s * 1.6;
    let rg = tctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    rg.addColorStop(0, 'rgba(0,0,0,.55)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    tctx.fillStyle = rg; tctx.beginPath(); tctx.arc(sx, sy, r, 0, 7); tctx.fill();
    if (p.svetlo) {
      const blik = p.baterie < 300 && Math.sin(cas * 23) > 0.6 ? 0.4 : 1;
      r = dpr * s * p.par.dosah;
      rg = tctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      rg.addColorStop(0, `rgba(0,0,0,${blik})`); rg.addColorStop(0.6, `rgba(0,0,0,${0.75 * blik})`); rg.addColorStop(1, 'rgba(0,0,0,0)');
      tctx.fillStyle = rg; tctx.beginPath(); tctx.moveTo(sx, sy); tctx.arc(sx, sy, r, svetloUhel - 0.42, svetloUhel + 0.42); tctx.closePath(); tctx.fill();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(tma, 0, 0);
    if (p.svetlo) {
      ctx.globalCompositeOperation = 'lighter';
      const r2 = dpr * s * p.par.dosah;
      const rg2 = ctx.createRadialGradient(sx, sy, 0, sx, sy, r2);
      rg2.addColorStop(0, 'rgba(255,230,160,.18)'); rg2.addColorStop(1, 'rgba(255,230,160,0)');
      ctx.fillStyle = rg2; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.arc(sx, sy, r2, svetloUhel - 0.42, svetloUhel + 0.42); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  function narkozaEfekt() {
    const n = J.narkoza(p.y, p.fN2);
    if (n <= 0) return;
    const W = cv.width, H = cv.height;
    kctx.setTransform(1, 0, 0, 1, 0, 0); kctx.clearRect(0, 0, W, H); kctx.drawImage(cv, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const pas = Math.round(8 * dpr);
    for (let y = 0; y < H; y += pas) ctx.drawImage(kopie, 0, y, W, pas, Math.sin(y * 0.02 + cas * 2.2) * n * 10 * dpr, y, W, pas);
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * (0.5 - n * 0.25), W / 2, H / 2, Math.max(W, H) * 0.7);
    vg.addColorStop(0, 'rgba(20,0,30,0)'); vg.addColorStop(1, `rgba(20,0,30,${(n * 0.55).toFixed(2)})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  // počítač na plátně
  function pocitacKresli() {
    if (p.t - pocitacCas > 3 || p.t < pocitacCas) {
      pocitacCas = p.t;
      pocitac = { ndl: J.ndl(p.tkane, p.y, p.fN2), plan: J.planVystupu(p.tkane, p.y, p.fN2) };
    }
    const n = J.narkoza(p.y, p.fN2), sum = v => v + (n > 0 ? (Math.random() - 0.5) * n * 4 : 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const x = 8, y = 8, w = Math.min(230, Math.max(170, cw * 0.5)), r = 15;
    const rad = [];
    rad.push([`${fmt(Math.max(0, sum(p.y)))} m`, `⏱ ${mmss(p.t)}`]);
    if (p.strop > 0 || pocitac.ndl === 0) {
      const z = pocitac.plan.zastavky[0];
      rad.push([`DEKO ${z ? z.h + ' m ' + z.min + "'" : ''}`, `TTS ${pocitac.plan.tts}'`, '#ffb347']);
      rad.push([`strop ${fmt(p.strop)} m`, '', p.y < p.strop - 0.3 ? '#ff5a5a' : '#ffb347']);
    } else rad.push([`NDL ${pocitac.ndl >= 99 ? '>99' : Math.max(0, Math.round(sum(pocitac.ndl)))}'`, `${Math.round(p.plyn / p.par.V)} bar`]);
    const po2 = J.ppO2(p.y, p.fO2), pr = J.proud(mapa, p.x, p.y, p.t);
    rad.push([`ppO₂ ${fmt(po2, 2)}`, Math.abs(pr) > 0.02 ? `${pr > 0 ? '→' : '←'} ${fmt(Math.abs(pr), 2)} m/s` : '', po2 > 1.4 ? '#ff5a5a' : null]);
    if (p.bezpZastavka > 0 && !p.bezpHotovo && p.maxH > 10 && p.y < 7) rad.push([`bezp. zastávka ${mmss(Math.max(0, 180 - p.bezpZastavka))}`, '', '#8fe3ff']);
    const varov = [];
    if (p.rychlostVystupu > J.MAX_VYSTUP) varov.push('POMALU!');
    if (p.y < p.strop - 0.5) varov.push('STROP!');
    if (p.plyn / p.par.V < 50) varov.push('REZERVA');
    if (po2 > 1.6) varov.push('O₂!');
    if (n > 0.15) varov.push('narkóza');
    const h = 12 + rad.length * r + (varov.length ? r : 0);
    ctx.fillStyle = 'rgba(10,20,18,.82)'; ctx.strokeStyle = 'rgba(160,220,200,.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill(); ctx.stroke();
    ctx.font = '600 12px ui-monospace, Menlo, Consolas, monospace'; ctx.textBaseline = 'top';
    rad.forEach(([a, b, barva], i) => {
      ctx.fillStyle = barva || '#bff5df';
      ctx.textAlign = 'left'; ctx.fillText(a, x + 8, y + 7 + i * r);
      ctx.textAlign = 'right'; ctx.fillText(b, x + w - 26, y + 7 + i * r);
    });
    if (varov.length && Math.sin(cas * 8) > -0.3) {
      ctx.fillStyle = '#ff5a5a'; ctx.textAlign = 'left';
      let vx = x + 8;
      for (const v of varov) { ctx.fillText(v, vx, y + 7 + rad.length * r); vx += ctx.measureText(v).width + 7; }
    }
    // ukazatel rychlosti výstupu
    const bx = x + w - 18, bh = h - 12;
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(bx, y + 6, 10, bh);
    const pod = Math.max(0, Math.min(1.5, p.rychlostVystupu / J.MAX_VYSTUP));
    ctx.fillStyle = pod > 1 ? '#ff5a5a' : pod > 0.8 ? '#ffb347' : '#5fe3a1';
    ctx.fillRect(bx, y + 6 + bh * (1 - pod / 1.5), 10, bh * pod / 1.5);
    ctx.fillStyle = '#fff'; ctx.fillRect(bx - 2, y + 6 + bh * (1 - 1 / 1.5), 14, 1);
    // sonar
    if (p.sonar) {
      const so = J.sonar(p);
      if (so) {
        const sx = (p.x - kamX) * s + cw / 2, sy = (p.y - kamY) * s + ch / 2, rr = s * 1.6;
        ctx.save(); ctx.translate(sx + Math.cos(so.uhel) * rr, sy + Math.sin(so.uhel) * rr); ctx.rotate(so.uhel);
        ctx.fillStyle = 'rgba(120,255,200,.75)'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.fill();
        ctx.restore();
        ctx.fillStyle = 'rgba(120,255,200,.9)'; ctx.textAlign = 'center'; ctx.font = '11px system-ui, sans-serif';
        ctx.fillText(`${Math.round(so.d)} m`, sx + Math.cos(so.uhel) * rr * 1.7, sy + Math.sin(so.uhel) * rr * 1.7 - 5);
      }
    }
    // tlačítko akce
    const mo = J.moznost(p), b = $('tAkce');
    const text = mo ? '✋ ' + mo.text : '✋';
    if (b.textContent !== text) b.textContent = text;
    b.disabled = !mo;
  }

  // ---------- HUD ----------
  let hudKlic = '';
  function hud() {
    const bar = Math.round(p.plyn / p.par.V), pod = bar / p.par.P;
    const bat = p.baterie / (p.par.baterie * 60);
    const polozky = [
      ['🫁', `${bar} bar`, pod, bar < 50],
      ['❤️', `${Math.round(p.zdravi)}`, p.zdravi / 100, p.zdravi < 40],
      ['🔦', `${Math.round(p.baterie / 60)} min`, bat, bat < 0.15],
      ['🧺', `${p.sitka.length}/${p.par.mista}`, null, false],
      ['🎈', `${p.vaky}`, null, false],
      ['😰', p.stres > 0.5 ? 'stres' : p.stres > 0.2 ? 'neklid' : 'klid', null, p.stres > 0.5]
    ];
    const klic = polozky.map(x => x[1] + x[3]).join('|') + Math.round(pod * 30) + Math.round(bat * 30);
    if (klic === hudKlic) return;
    hudKlic = klic;
    $('hud').innerHTML = polozky.map(([ik, t, v, n]) => `<span class="chip${n ? ' nizko' : ''}">${ik} ${t}${v !== null ? `<span class="bar"><i style="width:${Math.max(0, Math.min(100, v * 100))}%"></i></span>` : ''}</span>`).join('');
  }
  function hudLod() {
    hudKlic = '';
    $('hud').innerHTML = `<span class="chip">💰 ${hra.penize} $</span><span class="chip">🕗 ${casText(hra.cas)}</span><span class="chip">🤿 ponorů ${hra.cisloPonoru}</span><span class="chip">🎈 vaky ${hra.vaky}</span>`;
    $('stav').textContent = '';
  }

  // ---------- panely ----------
  function ukazZalozku(z) {
    document.querySelectorAll('.zalozky button').forEach(b => b.classList.toggle('on', b.dataset.z === z));
    document.querySelectorAll('.panel').forEach(pn => pn.classList.toggle('on', pn.id === 'p-' + z));
  }
  document.querySelectorAll('.zalozky button').forEach(b => b.onclick = () => ukazZalozku(b.dataset.z));

  function vykresliPlan() {
    const el = $('p-plan');
    if (p) {
      const M = J.misto(p.misto);
      el.innerHTML = `<h3>Probíhá ponor</h3><div class="info"><span>${esc(M.nazev)}</span> – <span>${esc(M.vrak)}</span><br>Směs: <b>${esc(p.smes.nazev)}</b> · max. hloubka dna ${M.dno} m</div>
        <p class="slabe">Vzduch se počítá podle tlaku, dusík v 16 tkáních. Na lodi se vrátíš přes ✋ u žebříku.</p>`;
      return;
    }
    const M = J.misto(volba.misto), par = J.parametry(hra);
    const smes = volba.plyn === 'ean32' && hra.kurzy.nitrox ? J.EAN32 : J.VZDUCH;
    const ndlD = J.ndl(hra.tkane, M.dno, smes.fN2), ndlV = J.ndl(hra.tkane, J.generujMapu(M.id).vrak.yt, smes.fN2);
    const litry = par.V * par.P, rezerva = par.V * 50;
    const vydrz = Math.floor((litry - rezerva) / (21 * par.sac * J.tlak(M.dno)));
    const mod = J.mod(smes.fO2);
    const strop0 = J.strop(hra.tkane);
    el.innerHTML = `<h3>Místo ponoru</h3>
      <div class="radek"><select id="volMisto" aria-label="Místo ponoru">${J.MISTA.map(m => `<option value="${m.id}"${m.id === volba.misto ? ' selected' : ''}${J.odemceno(hra, m.id) ? '' : ' disabled'}>${esc(m.nazev)} (${m.dno} m)${J.odemceno(hra, m.id) ? '' : ' – ' + esc(J.KURZY[m.kurz].nazev)}</option>`).join('')}</select></div>
      <div class="info">${esc(M.popis)}<br><span class="slabe">Vrak: ${esc(M.vrak)}</span></div>
      <h3>Dýchací směs</h3>
      <div class="radek"><select id="volPlyn" aria-label="Směs"><option value="vzduch">Vzduch (21 % O₂)</option><option value="ean32"${hra.kurzy.nitrox ? '' : ' disabled'}>Nitrox EAN32${hra.kurzy.nitrox ? '' : ' – potřebuješ kurz'}</option></select></div>
      ${M.dno > mod ? `<p class="varovani">⚠ Dno (${M.dno} m) je hlouběji než MOD směsi (${fmt(mod)} m) – hrozí kyslíková otrava.</p>` : ''}
      <h3>Plán</h3>
      <div class="info">NDL na palubě vraku (${J.generujMapu(M.id).vrak.yt} m): <b>${ndlV >= 99 ? '>99' : ndlV} min</b><br>
      NDL u dna (${M.dno} m): <b>${ndlD >= 99 ? '>99' : ndlD} min</b><br>
      Vzduch ${par.V} l × ${par.P} bar = ${litry} l → u dna při klidném plavání cca <b>${vydrz} min</b> do rezervy 50 bar.</div>
      ${strop0 > 0 ? '<p class="varovani">Ještě máš v těle dusík nad limit – počkej na lodi.</p>' : ''}
      <h3>Dusík v tkáních</h3>
      <canvas id="tkaneGraf"></canvas>
      <p class="slabe">Sloupce = 16 tkání od nejrychlejší (vlevo, poločas 5 min) po nejpomalejší (635 min). Plná výška = limit pro výstup na hladinu.</p>
      <div class="radek"><label>Povrchový interval</label><button class="btn" data-cekej="30">+30 min</button><button class="btn" data-cekej="60">+1 h</button><button class="btn" data-cekej="180">+3 h</button></div>
      <div class="radek"><button class="btn primary" id="bSkok2"${J.odemceno(hra, volba.misto) ? '' : ' disabled'}>🤿 Skočit do vody</button></div>`;
    $('volMisto').onchange = e => { volba.misto = e.target.value; ulozVolbu(); nactiMisto(volba.misto); vykresliPlan(); };
    $('volPlyn').value = smes.id;
    $('volPlyn').onchange = e => { volba.plyn = e.target.value; ulozVolbu(); vykresliPlan(); };
    el.querySelectorAll('[data-cekej]').forEach(b => b.onclick = () => { J.cekej(hra, +b.dataset.cekej); uloz(); vykresliVse(); });
    $('bSkok2').onclick = () => skok();
    grafTkani($('tkaneGraf'), hra.tkane);
  }
  function grafTkani(c, tk) {
    const r = c.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
    c.width = Math.max(10, r.width * d); c.height = r.height * d;
    const x = c.getContext('2d'); x.scale(d, d);
    const w = r.width / 16, sat = J.nasyceniPovrch()[0];
    const st = getComputedStyle(document.body);
    tk.forEach((v, i) => {
      const [, a, b] = J.ZHL16C[i], lim = a * J.GF + 1 * (J.GF / b + 1 - J.GF);   // tlak tkáně, při kterém je strop přesně na hladině
      const pod = Math.max(0, Math.min(1.2, (v - sat) / (lim - sat)));
      x.fillStyle = pod > 1 ? st.getPropertyValue('--danger') || '#c33' : pod > 0.7 ? st.getPropertyValue('--warn') || '#c90' : '#4fb3e8';
      x.fillRect(i * w + 1, r.height * (1 - pod / 1.2), w - 2, r.height * pod / 1.2);
    });
    x.strokeStyle = st.getPropertyValue('--text-faint') || '#888'; x.setLineDash([3, 3]);
    x.beginPath(); x.moveTo(0, r.height * (1 - 1 / 1.2)); x.lineTo(r.width, r.height * (1 - 1 / 1.2)); x.stroke();
  }

  function vykresliObchod() {
    const el = $('p-obchod');
    const radek = (nazev, popis, cena, co, mozno, stupne) => `<div class="polozka"><span><b>${esc(nazev)}</b>${stupne || ''}<small>${esc(popis)}</small></span>${mozno ? `<button class="btn" data-kup="${co}"${hra.penize < cena ? ' disabled' : ''}>${cena} $</button>` : '<span class="slabe" style="flex:0">✓</span>'}</div>`;
    let h = `<div class="info">💰 Peníze: <b>${hra.penize} $</b> <span class="slabe">· nálezy se prodávají po návratu na loď</span></div><h3>Výbava</h3>`;
    for (const k in J.VYBAVA) {
      const V = J.VYBAVA[k], u = hra.vybava[k], dalsi = V.urovne[u + 1];
      const stupne = ` <span class="stupne">${'●'.repeat(u + 1)}${'○'.repeat(V.urovne.length - u - 1)}</span>`;
      h += radek(V.nazev, dalsi ? `Teď: ${V.urovne[u].popis} → ${dalsi.popis}` : V.urovne[u].popis, dalsi ? dalsi.cena : 0, 'vybava:' + k, !!dalsi, stupne);
    }
    h += '<h3>Doplňky</h3>';
    for (const k in J.DOPLNKY) {
      const D = J.DOPLNKY[k], mam = k === 'vak' ? hra.vaky >= D.max : hra[k];
      h += radek(D.nazev + (k === 'vak' ? ` (${hra.vaky}/${D.max})` : ''), D.popis, D.cena, 'doplnek:' + k, !mam);
    }
    h += '<h3>Kurzy</h3>';
    for (const k in J.KURZY) { const K = J.KURZY[k]; h += radek(K.nazev, K.popis, K.cena, 'kurz:' + k, !hra.kurzy[k]); }
    el.innerHTML = h;
    el.querySelectorAll('[data-kup]').forEach(b => b.onclick = () => {
      if (p) { Dialog.info('Nakupovat jde jen na lodi.'); return; }
      const r = J.kup(hra, b.dataset.kup);
      Dialog.info(r.zprava); if (r.ok) { uloz(); vykresliVse(); }
    });
  }

  function vykresliSbirku() {
    const el = $('p-sbirka');
    let h = '';
    for (const M of J.MISTA) {
      const st = hra.mista[M.id] || { sebrane: [] };
      h += `<h3>${esc(M.nazev)} – ${st.sebrane.length}/${M.predmety.length}</h3><div class="mriz">`;
      const typy = [...new Set(M.predmety.map(x => x[0]))];
      for (const t of typy) {
        const celkem = M.predmety.filter(x => x[0] === t).length;
        const mam = st.sebrane.filter(id => M.predmety[+id.split('-')[1]][0] === t).length;
        const P = J.PREDMETY[t];
        h += `<div class="${mam ? '' : 'nezn'}"><canvas data-predmet="${t}"></canvas>${mam ? esc(P.nazev) : '???'}<br><small>${mam}/${celkem} · ${P.cena} $${P.tezky ? ' · 🎈' : ''}</small></div>`;
      }
      h += '</div>';
    }
    h += '<h3>Atlas tvorů</h3><div class="mriz">';
    for (const k in J.TVOROVE) {
      const T = J.TVOROVE[k], vid = hra.videno[k];
      h += `<div class="${vid ? '' : 'nezn'}"><canvas data-tvor="${k}"></canvas><b>${vid ? esc(T.nazev) : '???'}</b> ${vid && T.nebezpecny ? '⚠' : ''}<br><small>${vid ? esc(T.popis) : 'Zatím neviděno.'}</small></div>`;
    }
    h += '</div>';
    el.innerHTML = h;
    el.querySelectorAll('canvas').forEach(c => {
      const r = c.getBoundingClientRect(); if (!r.width) return;
      const d = Math.min(2, devicePixelRatio || 1); c.width = r.width * d; c.height = r.height * d;
      const x = c.getContext('2d'); const sc = r.height / 1.4 * d;
      x.setTransform(sc, 0, 0, sc, c.width / 2, c.height * 0.8);
      const nezn = c.parentElement.classList.contains('nezn');
      if (nezn) x.filter = 'brightness(0) opacity(.35)';
      if (c.dataset.predmet) G.predmet(x, c.dataset.predmet, 0, 0, 0);
      else { const k = { zralok: 0.28, barakuda: 0.45, zelva: 0.6, ryby: 0.4, rejnok: 0.6, meduza: 0.5 }[c.dataset.tvor] || 0.9; x.setTransform(sc * k, 0, 0, sc * k, c.width / 2, c.height * (c.dataset.tvor === 'meduza' ? 0.3 : 0.5)); G.tvor(x, { typ: c.dataset.tvor, x: 0, y: 0, vx: 1, vy: 0, hx: 1, smer: 1, vysun: 1 }, 1, 0); }
    });
  }

  function vykresliDenik() {
    const el = $('p-denik');
    if (!hra.denik.length) { el.innerHTML = '<p class="slabe">Zatím žádný ponor. Skoč do vody!</p>'; return; }
    el.innerHTML = hra.denik.slice().reverse().map((z, i) => {
      const M = J.misto(z.misto);
      return `<div class="zaznam"><b>#${z.c} · ${esc(M ? M.nazev : z.misto)}</b> <span class="slabe">${casText(z.zacatek)}</span><br>
        ${z.delka} min · max ${fmt(z.maxH)} m · ${z.barStart}→${z.barKonec} bar · ${z.plyn === 'ean32' ? 'EAN32' : 'vzduch'}${z.bezp ? ' · bezp. zastávka ✓' : ''}<br>
        ${z.nalezy.length ? '🏺 ' + z.nalezy.map(t => esc(J.PREDMETY[t].nazev)).join(', ') + ` (+${z.zisk} $)` : '<span class="slabe">bez nálezů</span>'}
        ${z.nemoc ? `<br><span class="nemoc">${z.nemoc === 'tezka' ? '🚑 dekompresní nemoc' : '⚠ lehké příznaky DCS'}</span>` : ''}
        ${z.duvod !== 'lod' ? '<br><span class="nemoc">nouzový výstup</span>' : ''}
        <canvas data-profil="${hra.denik.length - 1 - i}"></canvas></div>`;
    }).join('');
    el.querySelectorAll('[data-profil]').forEach(c => {
      const z = hra.denik[+c.dataset.profil], r = c.getBoundingClientRect(); if (!r.width || !z.profil) return;
      const d = Math.min(2, devicePixelRatio || 1); c.width = r.width * d; c.height = r.height * d;
      const x = c.getContext('2d'); x.scale(d, d);
      const tMax = Math.max(1, z.profil[z.profil.length - 1][0]), hMax = Math.max(5, z.maxH);
      x.fillStyle = 'rgba(79,179,232,.25)'; x.strokeStyle = '#4fb3e8'; x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(0, 2);
      for (const [t, h] of z.profil) x.lineTo(t / tMax * (r.width - 2) + 1, 2 + h / hMax * (r.height - 6));
      x.lineTo(r.width, 2); x.fill(); x.stroke();
      x.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-faint') || '#888'; x.font = '10px system-ui, sans-serif';
      x.fillText(`${fmt(z.maxH)} m`, 4, r.height - 4);
    });
  }
  $('napTvorove').innerHTML = Object.values(J.TVOROVE).map(t => `<li><b>${esc(t.nazev)}</b>${t.nebezpecny ? ' ⚠' : ''} – ${esc(t.popis)}</li>`).join('');

  function vykresliVse() { vykresliPlan(); vykresliObchod(); vykresliSbirku(); vykresliDenik(); if (!p) hudLod(); }
  // panely se vykreslí i při přepnutí (plátna potřebují rozměr)
  document.querySelectorAll('.zalozky button').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.z === 'sbirka') vykresliSbirku();
    if (b.dataset.z === 'denik') vykresliDenik();
    if (b.dataset.z === 'plan') vykresliPlan();
  }));
  $('souhrn').addEventListener('close', () => { vykresliVse(); });

  // ---------- start ----------
  velikost();
  nactiMisto(volba.misto);
  aktualizujTlacitka();
  vykresliVse();
  window.__vrak = { get hra() { return hra; }, get p() { return p; }, skok, akce, konecPonoru };
  requestAnimationFrame(snimek);
})();
