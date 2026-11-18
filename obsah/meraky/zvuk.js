/* Měřáky – ladička (YIN nad mikrofonem z app.js) a generátor tónu/šumu. */
(function () {
  'use strict';
  const M = window.MerakyApp, { J, $, C, nast, uloz, barvy, platno } = M;

  /* ---------- 🔈 generátor (vlastní AudioContext, sdílí ho i referenční tón ladičky) ---------- */
  nast.gen = Object.assign({ f: 440, tvar: 'sine', kanal: 'oba', hlas: 0.2 }, nast.gen);
  const GN = { ctx: null, zdroj: null, osc: null, hlas: null, gL: null, gR: null, bezi: false, sweep: null, vypni: 0, raf: 0 };
  function ctxGen() {
    if (!GN.ctx) GN.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (GN.ctx.state === 'suspended') GN.ctx.resume().catch(() => {});
    return GN.ctx;
  }
  function bufferSumu(ctx, druh) {
    const n = ctx.sampleRate * 4, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0), b = new Array(7).fill(0);
    let hn = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (druh === 'ruzovy') d[i] = J.ruzovy(b, w);
      else if (druh === 'hnedy') { hn = (hn + 0.02 * w) / 1.02; d[i] = hn * 3.5; }
      else d[i] = w * 0.5;
    }
    return buf;
  }
  function smerovani() {
    const k = nast.gen.kanal, t = GN.ctx.currentTime;
    GN.gL.gain.setTargetAtTime(k === 'R' ? 0 : 1, t, 0.01);
    GN.gR.gain.setTargetAtTime(k === 'L' ? 0 : k === 'proti' ? -1 : 1, t, 0.01);
  }
  function hraj() {
    zastavGen();
    const ctx = ctxGen(), t = ctx.currentTime;
    GN.hlas = ctx.createGain(); GN.hlas.gain.setValueAtTime(0, t); GN.hlas.gain.linearRampToValueAtTime(nast.gen.hlas ** 2, t + 0.05);
    const merge = ctx.createChannelMerger(2);
    GN.gL = ctx.createGain(); GN.gR = ctx.createGain();
    GN.hlas.connect(GN.gL).connect(merge, 0, 0); GN.hlas.connect(GN.gR).connect(merge, 0, 1);
    merge.connect(ctx.destination);
    if (['bily', 'ruzovy', 'hnedy'].includes(nast.gen.tvar)) {
      const s = ctx.createBufferSource(); s.buffer = bufferSumu(ctx, nast.gen.tvar); s.loop = true; s.connect(GN.hlas); s.start(); GN.zdroj = s; GN.osc = null;
    } else {
      const o = ctx.createOscillator(); o.type = nast.gen.tvar; o.frequency.value = nast.gen.f; o.connect(GN.hlas); o.start(); GN.zdroj = o; GN.osc = o;
    }
    smerovani();
    GN.bezi = true; $('genStart').textContent = '⏹ Zastavit';
    GN.vypni = setTimeout(zastavGen, 600000);
  }
  function zastavGen() {
    clearTimeout(GN.vypni); cancelAnimationFrame(GN.raf);
    if (GN.zdroj) {
      const z = GN.zdroj, h = GN.hlas, t = GN.ctx.currentTime;
      h.gain.cancelScheduledValues(t); h.gain.setValueAtTime(h.gain.value, t); h.gain.linearRampToValueAtTime(0, t + 0.04);
      try { z.stop(t + 0.06); } catch (e) { /* už stojí */ }
    }
    Object.assign(GN, { zdroj: null, osc: null, bezi: false, sweep: null });
    $('genStart').textContent = '▶ Hrát'; $('genSweep').textContent = '〰️ Spustit přeladění';
    ukazF();
  }
  function nastavF(f, zPosuvniku) {
    if (!(f > 0)) return;
    nast.gen.f = Math.min(24000, Math.max(1, Math.round(f * 10) / 10)); uloz();
    if (GN.osc && !GN.sweep) GN.osc.frequency.setTargetAtTime(nast.gen.f, GN.ctx.currentTime, 0.015);
    ukazF(zPosuvniku);
  }
  function ukazF(zPosuvniku, f) {
    f = f || nast.gen.f;
    const tvar = nast.gen.tvar, sum = ['bily', 'ruzovy', 'hnedy'].includes(tvar);
    $('genVelke').innerHTML = sum ? $('genTvar').selectedOptions[0].text : (f < 1000 ? C(f, 1) : C(f / 1000, 3)) + '<small>' + (f < 1000 ? 'Hz' : 'kHz') + '</small>';
    if (!zPosuvniku) $('genPosuv').value = J.fNaPosuvnik(Math.max(20, f));
    $('genF').value = Math.round(f * 10) / 10;
  }
  function sweep() {
    if (GN.sweep) return zastavGen();
    if (['bily', 'ruzovy', 'hnedy'].includes(nast.gen.tvar)) { nast.gen.tvar = 'sine'; $('genTvar').value = 'sine'; uloz(); }
    const f1 = Math.max(1, +$('genOd').value || 20), f2 = Math.max(1, +$('genDo').value || 20000), T = Math.max(1, +$('genDoba').value || 20);
    hraj();
    const t = GN.ctx.currentTime;
    GN.osc.frequency.cancelScheduledValues(t); GN.osc.frequency.setValueAtTime(f1, t); GN.osc.frequency.exponentialRampToValueAtTime(f2, t + T);
    GN.sweep = { f1, f2, T, t0: t };
    $('genSweep').textContent = '⏹ Zastavit přeladění';
    const s = () => {
      if (!GN.sweep) return;
      const uplynulo = GN.ctx.currentTime - GN.sweep.t0;
      if (uplynulo >= T) { nast.gen.f = f2; return zastavGen(); }
      ukazF(false, J.sweepLog(f1, f2, uplynulo, T));
      GN.raf = requestAnimationFrame(s);
    };
    s();
  }
  $('genRychle').innerHTML = [50, 100, 440, 1000, 4000, 10000, 15000, 17400].map(f => `<button class="btn mini" data-genf="${f}">${f >= 1000 ? f / 1000 + ' k' : f}</button>`).join('');
  $('genRychle').addEventListener('click', e => { const f = e.target.dataset.genf; if (f) { if (['bily', 'ruzovy', 'hnedy'].includes(nast.gen.tvar)) { nast.gen.tvar = 'sine'; $('genTvar').value = 'sine'; if (GN.bezi) hraj(); } nastavF(+f); } });
  $('genPosuv').addEventListener('input', e => nastavF(J.posuvnikNaF(+e.target.value), true));
  $('genF').addEventListener('change', e => nastavF(parseFloat(e.target.value)));
  $('genTvar').value = nast.gen.tvar; $('genKanal').value = nast.gen.kanal; $('genHlas').value = nast.gen.hlas;
  $('genTvar').addEventListener('change', e => { nast.gen.tvar = e.target.value; uloz(); ukazF(); if (GN.bezi && !GN.sweep) hraj(); });
  $('genKanal').addEventListener('change', e => { nast.gen.kanal = e.target.value; uloz(); if (GN.bezi) smerovani(); });
  $('genHlas').addEventListener('input', e => { nast.gen.hlas = +e.target.value; uloz(); if (GN.hlas) GN.hlas.gain.setTargetAtTime(nast.gen.hlas ** 2, GN.ctx.currentTime, 0.02); });
  $('genStart').addEventListener('click', () => GN.bezi ? zastavGen() : hraj());
  $('genSweep').addEventListener('click', sweep);
  ukazF();
  document.addEventListener('visibilitychange', () => { if (document.hidden && GN.bezi) zastavGen(); });
  M.registruj('generator', {   // při přepnutí záložky hraje dál – jde tak měřit vlastní reproduktor 📊 spektrem
    zapis: () => ({ hodnota: ['bily', 'ruzovy', 'hnedy'].includes(nast.gen.tvar) ? $('genTvar').selectedOptions[0].text : C(nast.gen.f, 1) + ' Hz', detail: $('genTvar').selectedOptions[0].text + ' · ' + $('genKanal').selectedOptions[0].text + ' · hlasitost ' + Math.round(nast.gen.hlas * 100) + ' %' })
  });

  /* ---------- 🎵 ladička ---------- */
  nast.lad = Object.assign({ nastroj: 'chromaticky', a4: 440 }, nast.lad);
  const L = { analyza: 0, prazdne: 0, ticho: 0, raf: 0, buf: new Float32Array(4096), hist: [], f: null, posl: 0 };
  $('ladNastroj').innerHTML = Object.entries(J.LADENI).map(([k, v]) => `<option value="${k}">${v.nazev}</option>`).join('');
  $('ladNastroj').value = nast.lad.nastroj; $('ladA4').value = nast.lad.a4;
  function kresliStruny() {
    const s = J.LADENI[nast.lad.nastroj].struny;
    $('ladStruny').innerHTML = s.map(n => `<button class="btn mini" data-struna="${n}" aria-pressed="false" title="Zahrát referenční tón ${C(J.frekvenceNoty(n, nast.lad.a4), 2)} Hz">${n.replace(/\d/, m => '<sub>' + m + '</sub>')}</button>`).join('');
    L.aktivni = null;
  }
  function oznacStrunu(aktivni) {   // jen přepnout označení – překreslením by se ztrácela klepnutí
    L.aktivni = aktivni;
    $('ladStruny').querySelectorAll('[data-struna]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.struna === aktivni)));
  }
  kresliStruny();
  $('ladNastroj').addEventListener('change', e => { nast.lad.nastroj = e.target.value; uloz(); kresliStruny(); });
  $('ladA4').addEventListener('change', e => { const v = parseFloat(e.target.value); if (v >= 400 && v <= 480) { nast.lad.a4 = v; uloz(); kresliStruny(); } else e.target.value = nast.lad.a4; });
  $('ladStruny').addEventListener('click', e => {
    const b = e.target.closest('[data-struna]'); if (!b) return;
    const ctx = ctxGen(), t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = J.frekvenceNoty(b.dataset.struna, nast.lad.a4); o.type = 'triangle';
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 2.5);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 2.6);
    L.ticho = performance.now() + 2700;   // mikrofon by změřil referenční tón – detekci zatím pozastavit
  });
  function analyzuj() {
    const Z = M.Z;
    if (!Z.ctx || !Z.anZ || Z.ctx.state !== 'running') return null;
    Z.anZ.getFloatTimeDomainData(L.buf);
    if (J.dbfs(L.buf) < -65) return null;               // ticho
    const r = J.yin(L.buf, Z.ctx.sampleRate, 40, 2000, 0.12);
    return r && r.jistota > 0.75 ? r.f : null;
  }
  function kresliLadicku() {
    const t = performance.now();
    let f = null;
    if (t - L.analyza >= 80 && !(t < L.ticho)) { L.analyza = t; f = analyzuj(); if (!f) L.prazdne = t; }   // YIN je drahý – stačí ~12× za s
    if (f) { L.hist.push(f); if (L.hist.length > 5) L.hist.shift(); L.posl = t; }
    else if (t - L.posl > 600 && L.prazdne === L.analyza) L.hist = [];
    const s = L.hist.slice().sort((a, b) => a - b), fm = s.length >= 3 ? s[s.length >> 1] : null;
    const struny = J.LADENI[nast.lad.nastroj].struny;
    let nazev = '—', centy = null, cil = null, aktivni = null;
    if (fm) {
      if (struny.length) { const n = J.nejblizsiStruna(fm, struny, nast.lad.a4); aktivni = n.struna; centy = n.centy; nazev = n.struna; cil = J.frekvenceNoty(n.struna, nast.lad.a4); }
      else { const n = J.nota(fm, nast.lad.a4); nazev = n.nazev; centy = n.centy; cil = fm / Math.pow(2, centy / 1200); }
      L.f = fm;
    }
    if (aktivni !== L.aktivni && struny.length) oznacStrunu(aktivni);
    const ok = centy != null && Math.abs(centy) <= 5;
    $('ladNota').innerHTML = nazev.replace(/(-?\d)$/, '<small>$1</small>');
    $('ladNota').className = 'velke' + (ok ? ' ok' : centy != null && Math.abs(centy) <= 15 ? ' pozor' : '');
    $('ladHz').textContent = fm ? C(fm, 2) + ' Hz' + (cil ? ' · cíl ' + C(cil, 2) + ' Hz · ' + (centy >= 0 ? '+' : '−') + C(Math.abs(centy), 0) + ' centů' + (Math.abs(centy) > 5 ? (centy > 0 ? ' – povolit' : ' – přitáhnout') : ' ✔') : '') : (M.Z.ctx ? 'Zahrajte tón…' : 'Spusťte mikrofon.');
    // stupnice −50…+50 centů
    const { x, w, h } = platno($('platnoLadicka'), $('platnoLadicka').clientWidth < 500 ? 0.55 : 0.33), B = barvy();
    const cx = w / 2, cy = h - 16, R = Math.min(w / 2 - 20, h - 34), uhel = c => (-90 + Math.max(-50, Math.min(50, c)) * 1.2) * Math.PI / 180;
    x.lineWidth = 1; x.font = '12px system-ui'; x.textAlign = 'center';
    x.fillStyle = B.ok; x.globalAlpha = 0.18; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, R, uhel(-5), uhel(5)); x.closePath(); x.fill(); x.globalAlpha = 1;
    for (let c = -50; c <= 50; c += 5) {
      const a = uhel(c), d = c % 25 === 0 ? 16 : c % 10 === 0 ? 10 : 6;
      x.strokeStyle = c === 0 ? B.ok : B.muted; x.lineWidth = c === 0 ? 2 : 1;
      x.beginPath(); x.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); x.lineTo(cx + Math.cos(a) * (R - d), cy + Math.sin(a) * (R - d)); x.stroke();
      if (c % 25 === 0) { x.fillStyle = B.muted; x.fillText((c > 0 ? '+' : '') + c, cx + Math.cos(a) * (R - 28), cy + Math.sin(a) * (R - 28) + 4); }
    }
    if (centy != null) {
      const a = uhel(centy);
      x.strokeStyle = ok ? B.ok : Math.abs(centy) <= 15 ? B.warn : B.danger; x.lineWidth = 3;
      x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4)); x.stroke();
    }
    x.fillStyle = B.text; x.beginPath(); x.arc(cx, cy, 5, 0, 7); x.fill();
    x.textAlign = 'left';
  }
  M.registruj('ladicka', {
    start() { cancelAnimationFrame(L.raf); const s = () => { L.raf = requestAnimationFrame(s); if (!document.hidden) kresliLadicku(); }; s(); },
    stop() { cancelAnimationFrame(L.raf); },
    zapis: () => L.f ? { hodnota: C(L.f, 2) + ' Hz', detail: $('ladNota').textContent + ' · ' + $('ladHz').textContent + ' · A4 = ' + nast.lad.a4 + ' Hz' } : null
  });
})();
