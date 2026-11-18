/* Potápění k vraku – kreslení na plátno (vše vlastní, procedurální).
   Kreslí se ve světových souřadnicích (metry), transformaci nastavuje hra.js. */
(function () {
  'use strict';
  const J = window.VrakJadro;
  const T = 24, NAD = 8;   // px na metr v předkresleném terénu, metrů nad hladinou

  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const c = k => Math.round(((pa >> k) & 255) * (1 - t) + ((pb >> k) & 255) * t);
    return `rgb(${c(16)},${c(8)},${c(0)})`;
  }
  // barva vody podle hloubky
  const VODA = [[0, '#41c6d9'], [8, '#1d93ba'], [20, '#10629a'], [35, '#073c69'], [60, '#021a33']];
  function barvaVody(h) {
    if (h <= 0) return VODA[0][1];
    for (let i = 1; i < VODA.length; i++) if (h <= VODA[i][0]) {
      const [h0, c0] = VODA[i - 1], [h1, c1] = VODA[i];
      return mix(c0, c1, (h - h0) / (h1 - h0));
    }
    return VODA[VODA.length - 1][1];
  }
  // korály v hloubce ztrácejí červenou
  const vyblednout = (c, h) => mix(c, '#2a6f8f', Math.min(0.75, h / 45));

  /** Předkreslí terén a vrak do skrytého plátna. */
  function pripravTeren(m) {
    const cv = document.createElement('canvas');
    cv.width = m.W * T; cv.height = (m.H + NAD) * T;
    const c = cv.getContext('2d');
    c.setTransform(T, 0, 0, T, 0, NAD * T);
    const rnd = J.rng(m.W * 7 + m.D);
    // ostrov nad hladinou
    c.fillStyle = '#e6cf94';
    c.beginPath(); c.moveTo(0, 0.2); c.lineTo(0, -2.6); c.quadraticCurveTo(m.ostrov * 0.6, -3.2, m.ostrov + 2.5, 0.2); c.fill();
    c.fillStyle = '#5e9a3a';
    c.beginPath(); c.moveTo(0, -2.4); c.quadraticCurveTo(m.ostrov * 0.4, -3.4, m.ostrov * 0.8, -2.2); c.lineTo(0, -2); c.fill();
    for (const [px, ph] of [[1.5, 6], [3.6, 5]]) {
      c.strokeStyle = '#7a5530'; c.lineWidth = 0.35;
      c.beginPath(); c.moveTo(px, -2.6); c.quadraticCurveTo(px + 1, -2.6 - ph / 2, px + 0.6, -2.6 - ph); c.stroke();
      c.strokeStyle = '#2f7d32'; c.lineWidth = 0.28;
      for (let k = 0; k < 6; k++) {
        const u = k / 6 * Math.PI * 2;
        c.beginPath(); c.moveTo(px + 0.6, -2.6 - ph);
        c.quadraticCurveTo(px + 0.6 + Math.cos(u) * 1.4, -2.6 - ph - 0.9, px + 0.6 + Math.cos(u) * 2.4, -2.6 - ph + 0.6 + Math.abs(Math.sin(u)));
        c.stroke();
      }
    }
    // tělo dna
    const gr = c.createLinearGradient(0, 0, 0, m.H);
    gr.addColorStop(0, '#e9d7a0'); gr.addColorStop(0.35, '#c9b27a'); gr.addColorStop(1, '#5a4a35');
    c.fillStyle = gr;
    c.beginPath(); c.moveTo(0, m.H);
    for (let x = 0; x < m.W; x++) c.lineTo(x + 0.5, m.dno[x]);
    c.lineTo(m.W, m.dno[m.W - 1]); c.lineTo(m.W, m.H); c.fill();
    // zrnitost písku
    for (let i = 0; i < m.W * 30; i++) {
      const x = rnd() * m.W, y = m.dno[Math.floor(x)] + rnd() * (m.H - m.dno[Math.floor(x)]);
      c.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,.12)' : 'rgba(60,40,20,.15)';
      c.fillRect(x, y, 0.08, 0.08);
    }
    // vlnky písku
    c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 0.06;
    for (let x = m.ostrov; x < m.W - 1; x += 1.3) { const y = m.dno[Math.floor(x)] + 0.35; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 0.35, y - 0.12, x + 0.7, y); c.stroke(); }
    // skály
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
      if (m.g[y * m.W + x] !== J.SKALA) continue;
      if (!J.pruchozi(J.bunka(m, x, y - 1)) && !J.pruchozi(J.bunka(m, x - 1, y)) && !J.pruchozi(J.bunka(m, x + 1, y))) continue;
      c.fillStyle = mix('#7d7466', '#3f3a35', rnd() * 0.6);
      c.beginPath(); c.ellipse(x + 0.5, y + 0.55, 0.62, 0.55, rnd(), 0, 7); c.fill();
      c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.ellipse(x + 0.4, y + 0.35, 0.3, 0.15, 0, 0, 7); c.fill();
    }
    const v = m.vrak;
    // vrak
    const drevo = m.styl === 'drevo';
    for (let y = 0; y < m.H; y++) for (let x = v.x0 - 1; x < v.x0 + v.L + 1; x++) {
      const k = m.g[y * m.W + x];
      if (k === J.VNITREK || k === J.ZAVAL) {
        c.fillStyle = drevo ? '#3a2816' : '#2f2926'; c.fillRect(x, y, 1.02, 1.02);
        c.fillStyle = drevo ? 'rgba(150,100,50,.22)' : 'rgba(170,100,60,.16)';
        if (x % 3 === 0) c.fillRect(x + 0.4, y, 0.18, 1.02);
      } else if (k === J.TRUP) {
        c.fillStyle = drevo ? (y % 2 ? '#6e4b2c' : '#61422a') : (y % 2 ? '#6a4532' : '#623f2e');
        c.fillRect(x, y, 1.02, 1.02);
        c.fillStyle = 'rgba(0,0,0,.3)';
        if (drevo) { c.fillRect(x, y + 0.94, 1.02, 0.06); if ((x + y * 3) % 4 === 0) c.fillRect(x, y, 0.05, 1); }
        else { c.fillRect(x + 0.45, y + 0.15, 0.08, 0.08); c.fillRect(x + 0.45, y + 0.75, 0.08, 0.08); if (rnd() < 0.3) { c.fillStyle = 'rgba(200,110,40,.35)'; c.fillRect(x + rnd() * 0.6, y + 0.3, 0.22, 0.7); } }
      }
    }
    // stěžeň galeony
    if (m.stezen) {
      const sx = v.x0 + v.L * 0.62;
      c.strokeStyle = '#4a321c'; c.lineWidth = 0.45;
      c.beginPath(); c.moveTo(sx, v.yt); c.lineTo(sx + 2.5, v.yt - 9); c.stroke();
      c.lineWidth = 0.3; c.beginPath(); c.moveTo(sx + 1.6, v.yt - 6); c.lineTo(sx + 4.2, v.yt - 5.2); c.stroke();
      c.strokeStyle = 'rgba(70,55,40,.7)'; c.lineWidth = 0.06;
      c.beginPath(); c.moveTo(sx + 2.4, v.yt - 8.7); c.lineTo(v.x0 + v.L - 1, v.yt); c.moveTo(sx + 2.4, v.yt - 8.7); c.lineTo(v.x0 + 4, v.yt); c.stroke();
    }
    // korály a houby (ne pod vrakem)
    const nKor = Math.round(m.W * 0.9);
    for (let i = 0; i < nKor; i++) {
      const x = m.ostrov + 2 + rnd() * (m.W - m.ostrov - 4), cx = Math.floor(x);
      if (x > v.x0 - 1 && x < v.x0 + v.L + 1) continue;
      const y = m.dno[cx] + 0.15, h = y;
      const typ = rnd();
      if (typ < 0.3) koralVetveny(c, x, y, vyblednout(['#ff7b54', '#f6c344', '#c86bd8'][Math.floor(rnd() * 3)], h), 0.8 + rnd(), rnd);
      else if (typ < 0.5) { c.fillStyle = vyblednout(rnd() < 0.5 ? '#c9a24a' : '#9fb35a', h); c.beginPath(); c.ellipse(x, y, 0.6 + rnd() * 0.4, 0.45, 0, Math.PI, 0); c.fill(); c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 0.05; for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(x, y + 0.1, 0.2 + k * 0.13, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); } }
      else if (typ < 0.65) { c.strokeStyle = vyblednout('#b2457a', h); c.lineWidth = 0.05; const r = 0.9 + rnd() * 0.6; for (let k = 0; k < 9; k++) { const u = Math.PI * (1.1 + k * 0.1); c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(u) * r, y + Math.sin(u) * r); c.stroke(); } c.beginPath(); c.arc(x, y, r * 0.7, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
      else if (typ < 0.78) { c.fillStyle = vyblednout(rnd() < 0.5 ? '#e0663c' : '#8a5ad8', h); for (let k = 0; k < 3; k++) { const hh = 0.5 + rnd() * 0.8; c.fillRect(x + k * 0.28 - 0.4, y - hh, 0.22, hh); } }
      else if (h < 20) { c.strokeStyle = vyblednout('#4f9a3a', h); c.lineWidth = 0.08; for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(x + k * 0.15, y); c.quadraticCurveTo(x + k * 0.15 + 0.3, y - 0.6, x + k * 0.15 - 0.1, y - 1 - rnd() * 0.6); c.stroke(); } }
    }
    // porost na palubě vraku
    for (let x = v.x0 + 1; x < v.x0 + v.L - 1; x += 1 + rnd() * 3) {
      if (J.pruchozi(J.bunka(m, x, v.yt))) continue;
      koralVetveny(c, x, v.yt + 0.05, vyblednout(['#ff9a6a', '#f2d16a'][Math.floor(rnd() * 2)], v.yt), 0.5 + rnd() * 0.5, rnd);
    }
    // řasy (živé) – pozice pro animaci
    m.rasy = [];
    for (let i = 0; i < m.W * 0.4; i++) {
      const x = m.ostrov + 3 + rnd() * (m.W - m.ostrov - 6);
      if (x > v.x0 - 1 && x < v.x0 + v.L + 1) continue;
      m.rasy.push([x, m.dno[Math.floor(x)] + 0.1, 1 + rnd() * 2]);
    }
    return cv;
  }
  function koralVetveny(c, x, y, barva, vel, rnd) {
    c.strokeStyle = barva; c.lineCap = 'round';
    const vetev = (x, y, u, l, w, n) => {
      const x2 = x + Math.cos(u) * l, y2 = y + Math.sin(u) * l;
      c.lineWidth = w; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke();
      if (n > 0) { vetev(x2, y2, u - 0.4 - rnd() * 0.3, l * 0.72, w * 0.7, n - 1); vetev(x2, y2, u + 0.4 + rnd() * 0.3, l * 0.72, w * 0.7, n - 1); }
    };
    vetev(x, y, -Math.PI / 2, 0.45 * vel, 0.14 * vel, 3);
  }

  // ---------- předměty ----------
  function predmet(c, typ, x, y, t) {
    c.save(); c.translate(x, y);
    const zlato = '#e8b93a', stribro = '#cfd6dc', mosaz = '#b8913c';
    c.lineWidth = 0.05;
    switch (typ) {
      case 'mince_s': case 'mince_z': case 'dublon':
        c.fillStyle = typ === 'mince_s' ? stribro : zlato;
        for (const [dx, dy] of [[-0.12, 0.05], [0.1, 0.08], [0, -0.04]]) { c.beginPath(); c.ellipse(dx, dy, 0.17, 0.07, 0, 0, 7); c.fill(); c.strokeStyle = 'rgba(0,0,0,.3)'; c.stroke(); }
        break;
      case 'lahev': c.fillStyle = '#2f7a4a'; c.save(); c.rotate(1.3); c.fillRect(-0.12, -0.3, 0.24, 0.45); c.fillRect(-0.05, -0.45, 0.1, 0.15); c.restore(); break;
      case 'zavazi': c.fillStyle = '#6d7277'; c.beginPath(); c.moveTo(-0.15, 0.1); c.lineTo(0.15, 0.1); c.lineTo(0.07, -0.18); c.lineTo(-0.07, -0.18); c.fill(); break;
      case 'kompas': case 'hodinky': case 'astrolab': case 'pecet':
        c.fillStyle = typ === 'astrolab' ? zlato : mosaz; c.beginPath(); c.arc(0, -0.05, typ === 'astrolab' ? 0.3 : 0.2, 0, 7); c.fill();
        c.fillStyle = typ === 'hodinky' || typ === 'kompas' ? '#f3ecd6' : '#7a5a1c'; c.beginPath(); c.arc(0, -0.05, typ === 'astrolab' ? 0.2 : 0.13, 0, 7); c.fill();
        c.strokeStyle = '#3a2a10'; c.beginPath(); c.moveTo(0, -0.05); c.lineTo(0.08, -0.14); c.stroke(); break;
      case 'lucerna': c.fillStyle = '#5a5048'; c.fillRect(-0.15, -0.45, 0.3, 0.5); c.fillStyle = '#e8c56a'; c.fillRect(-0.1, -0.38, 0.2, 0.32); break;
      case 'kotva': c.strokeStyle = '#4a4f55'; c.lineWidth = 0.12; c.beginPath(); c.moveTo(0, -0.7); c.lineTo(0, 0.1); c.moveTo(-0.3, -0.55); c.lineTo(0.3, -0.55); c.moveTo(-0.45, -0.1); c.quadraticCurveTo(0, 0.35, 0.45, -0.1); c.stroke(); break;
      case 'porcelan': c.fillStyle = '#eef1f5'; c.beginPath(); c.ellipse(0, 0, 0.28, 0.08, 0, 0, 7); c.fill(); c.strokeStyle = '#3a63b8'; c.beginPath(); c.ellipse(0, 0, 0.18, 0.04, 0, 0, 7); c.stroke(); break;
      case 'dalekohled': c.fillStyle = mosaz; c.save(); c.rotate(-0.2); c.fillRect(-0.4, -0.1, 0.8, 0.12); c.fillRect(-0.45, -0.13, 0.15, 0.18); c.restore(); break;
      case 'sextant': c.strokeStyle = mosaz; c.lineWidth = 0.06; c.beginPath(); c.moveTo(0, -0.4); c.lineTo(-0.25, 0.05); c.arc(0, -0.4, 0.45, Math.PI * 0.6, Math.PI * 0.4, true); c.lineTo(0, -0.4); c.stroke(); break;
      case 'telegraf': c.fillStyle = mosaz; c.fillRect(-0.08, -0.6, 0.16, 0.6); c.beginPath(); c.arc(0, -0.75, 0.3, 0, 7); c.fill(); c.fillStyle = '#f3ecd6'; c.beginPath(); c.arc(0, -0.75, 0.2, 0, 7); c.fill(); break;
      case 'zvon': c.fillStyle = mosaz; c.beginPath(); c.moveTo(-0.4, 0.05); c.quadraticCurveTo(-0.3, -0.55, 0, -0.6); c.quadraticCurveTo(0.3, -0.55, 0.4, 0.05); c.fill(); c.fillRect(-0.06, -0.75, 0.12, 0.16); break;
      case 'trezor': c.fillStyle = '#3f4a52'; c.fillRect(-0.45, -0.8, 0.9, 0.85); c.fillStyle = '#9aa3a8'; c.beginPath(); c.arc(0.1, -0.4, 0.15, 0, 7); c.fill(); break;
      case 'amfora': c.fillStyle = '#b8643a'; c.beginPath(); c.ellipse(0, -0.25, 0.22, 0.32, 0.4, 0, 7); c.fill(); c.fillRect(-0.05, -0.75, 0.12, 0.25); break;
      case 'krucifix': c.fillStyle = zlato; c.fillRect(-0.04, -0.4, 0.08, 0.45); c.fillRect(-0.16, -0.3, 0.32, 0.07); break;
      case 'delo': c.fillStyle = '#9a7a3a'; c.save(); c.rotate(-0.05); c.beginPath(); c.moveTo(-0.9, -0.3); c.lineTo(0.9, -0.2); c.lineTo(0.9, 0.0); c.lineTo(-0.9, 0.08); c.fill(); c.beginPath(); c.arc(-0.9, -0.11, 0.2, 0, 7); c.fill(); c.restore(); break;
      case 'smaragd': c.fillStyle = '#2bd28a'; c.beginPath(); c.moveTo(0, -0.3); c.lineTo(0.18, -0.1); c.lineTo(0, 0.05); c.lineTo(-0.18, -0.1); c.fill(); break;
      case 'truhla':
        c.fillStyle = '#6b4220'; c.fillRect(-0.6, -0.6, 1.2, 0.65); c.beginPath(); c.ellipse(0, -0.6, 0.6, 0.25, 0, Math.PI, 0); c.fill();
        c.fillStyle = zlato; c.fillRect(-0.6, -0.42, 1.2, 0.07); c.fillRect(-0.08, -0.52, 0.16, 0.2); break;
      default: c.fillStyle = '#ccc'; c.fillRect(-0.15, -0.15, 0.3, 0.3);
    }
    // třpyt
    const z = (Math.sin(t * 3 + x * 7) + 1) / 2;
    if (z > 0.75) { c.strokeStyle = `rgba(255,255,230,${(z - 0.75) * 3.5})`; c.lineWidth = 0.04; c.beginPath(); c.moveTo(-0.25, -0.3); c.lineTo(0.25, -0.3); c.moveTo(0, -0.55); c.lineTo(0, -0.05); c.stroke(); }
    c.restore();
  }
  function zaval(c, x, y) {
    c.fillStyle = '#3a2717'; c.fillRect(x, y, 1, 1);
    c.strokeStyle = '#8a6237'; c.lineWidth = 0.18;
    c.beginPath(); c.moveTo(x + 0.05, y + 0.1); c.lineTo(x + 0.95, y + 0.9); c.moveTo(x + 0.95, y + 0.15); c.lineTo(x + 0.1, y + 0.95); c.stroke();
  }
  function zvedaciVak(c, x, y) {
    c.strokeStyle = '#ddd'; c.lineWidth = 0.04; c.beginPath(); c.moveTo(x, y - 0.3); c.lineTo(x, y - 1.2); c.stroke();
    c.fillStyle = '#ff7a1a'; c.beginPath(); c.ellipse(x, y - 1.7, 0.45, 0.6, 0, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(x - 0.15, y - 1.9, 0.12, 0.25, 0, 0, 7); c.fill();
  }

  // ---------- potápěč ----------
  function potapec(c, p, t, plave) {
    c.save(); c.translate(p.x, p.y);
    let u = Math.atan2(p.vy, Math.abs(p.vx) + 0.05);
    u = Math.max(-1.1, Math.min(1.1, u));
    if (p.y < 0.3 && p.vy >= 0) u = 0;
    c.scale(p.smer, 1); c.rotate(u);
    const kop = plave ? Math.sin(t * 9) * 0.25 : Math.sin(t * 2) * 0.06;
    // ploutve
    c.fillStyle = '#f2c230';
    for (const s of [1, -1]) { c.save(); c.translate(-0.95, 0.05 * s); c.rotate(kop * s); c.beginPath(); c.moveTo(0, -0.05); c.lineTo(-0.55, -0.16); c.lineTo(-0.55, 0.14); c.lineTo(0, 0.05); c.fill(); c.restore(); }
    // nohy a tělo
    c.fillStyle = '#1b2430';
    c.beginPath(); c.ellipse(-0.6, 0.02, 0.38, 0.11, kop * 0.3, 0, 7); c.fill();
    c.beginPath(); c.ellipse(-0.05, 0, 0.45, 0.2, 0, 0, 7); c.fill();
    c.fillStyle = '#2a7bd0'; c.fillRect(-0.3, 0.02, 0.5, 0.06);
    // láhev
    c.fillStyle = '#c8ccd2'; c.beginPath(); c.ellipse(-0.05, -0.2, 0.42, 0.11, 0, 0, 7); c.fill();
    c.fillStyle = '#e2b200'; c.fillRect(0.25, -0.27, 0.08, 0.14);
    // hlava, maska
    c.fillStyle = '#1b2430'; c.beginPath(); c.arc(0.48, -0.05, 0.16, 0, 7); c.fill();
    c.fillStyle = '#9fe0ff'; c.beginPath(); c.ellipse(0.6, -0.05, 0.06, 0.09, 0, 0, 7); c.fill();
    c.fillStyle = '#333'; c.fillRect(0.55, 0.06, 0.08, 0.06);
    // ruka se svítilnou
    c.strokeStyle = '#1b2430'; c.lineWidth = 0.1; c.beginPath(); c.moveTo(0.2, 0.08); c.lineTo(0.62, 0.2); c.stroke();
    c.fillStyle = p.svetlo ? '#ffe9a0' : '#666'; c.fillRect(0.6, 0.15, 0.14, 0.08);
    c.restore();
  }

  // ---------- tvorové ----------
  function ryba(c, x, y, smer, d, telo, ocas, t) {
    c.save(); c.translate(x, y); c.scale(smer, 1);
    c.fillStyle = telo; c.beginPath(); c.ellipse(0, 0, d, d * 0.4, 0, 0, 7); c.fill();
    c.fillStyle = ocas; c.beginPath(); c.moveTo(-d * 0.8, 0); c.lineTo(-d * 1.4, -d * 0.4 + Math.sin(t * 10) * d * 0.1); c.lineTo(-d * 1.4, d * 0.4); c.fill();
    c.fillStyle = '#111'; c.beginPath(); c.arc(d * 0.55, -d * 0.08, d * 0.08, 0, 7); c.fill();
    c.restore();
  }
  function tvor(c, tv, t, h) {
    const smer = tv.vx < -0.01 ? -1 : 1;
    switch (tv.typ) {
      case 'ryby': {
        const barvy = [['#ffd23f', '#3a86ff'], ['#ff8c42', '#ffffff'], ['#5ee0d6', '#1a5f7a']][Math.floor(tv.hx) % 3];
        for (let i = 0; i < 9; i++) {
          const ox = Math.sin(i * 2.1 + t * 0.7) * 1.4, oy = Math.cos(i * 1.7 + t * 0.9) * 0.7;
          ryba(c, tv.x + ox, tv.y + oy, smer, 0.18, vyblednout(barvy[0], h), vyblednout(barvy[1], h), t + i);
        }
        break;
      }
      case 'barakuda': ryba(c, tv.x, tv.y, smer, 0.8, '#9fb0bf', '#6f8090', t); c.fillStyle = 'rgba(30,40,50,.5)'; for (let k = 0; k < 4; k++) c.fillRect(tv.x - 0.4 + k * 0.25, tv.y - 0.2, 0.08, 0.3); break;
      case 'zralok': {
        c.save(); c.translate(tv.x, tv.y); c.scale(smer, 1);
        c.fillStyle = '#6c7f8e';
        c.beginPath(); c.moveTo(1.3, 0); c.quadraticCurveTo(0.6, -0.45, -0.8, -0.15); c.lineTo(-1.6, -0.6 + Math.sin(t * 4) * 0.1); c.lineTo(-1.4, 0); c.lineTo(-1.6, 0.4); c.lineTo(-0.8, 0.15); c.quadraticCurveTo(0.6, 0.35, 1.3, 0); c.fill();
        c.beginPath(); c.moveTo(0.1, -0.3); c.lineTo(-0.3, -0.85); c.lineTo(-0.45, -0.25); c.fill();
        c.beginPath(); c.moveTo(0.3, 0.2); c.lineTo(-0.1, 0.6); c.lineTo(-0.2, 0.2); c.fill();
        c.fillStyle = '#dfe6ea'; c.beginPath(); c.moveTo(1.2, 0.05); c.quadraticCurveTo(0.4, 0.3, -0.6, 0.12); c.lineTo(1.2, 0.05); c.fill();
        c.fillStyle = '#111'; c.beginPath(); c.arc(0.9, -0.08, 0.05, 0, 7); c.fill();
        c.restore(); break;
      }
      case 'zelva': {
        c.save(); c.translate(tv.x, tv.y); c.scale(smer, 1);
        const m = Math.sin(t * 2) * 0.3;
        c.fillStyle = '#8a9a5b';
        c.save(); c.translate(0.2, 0.15); c.rotate(0.5 + m); c.fillRect(0, -0.07, 0.6, 0.14); c.restore();
        c.save(); c.translate(-0.3, 0.15); c.rotate(2.4 - m); c.fillRect(0, -0.05, 0.35, 0.1); c.restore();
        c.beginPath(); c.arc(0.65, -0.02, 0.15, 0, 7); c.fill();
        c.fillStyle = '#5b4a2a'; c.beginPath(); c.ellipse(0, 0, 0.55, 0.3, 0, 0, 7); c.fill();
        c.strokeStyle = '#c9a55a'; c.lineWidth = 0.04; c.beginPath(); c.moveTo(-0.3, -0.1); c.lineTo(0.3, -0.1); c.moveTo(0, -0.28); c.lineTo(0, 0.25); c.stroke();
        c.restore(); break;
      }
      case 'perutyn': {
        c.save(); c.translate(tv.x, tv.y); c.scale(smer, 1);
        c.strokeStyle = vyblednout('#c0392b', h); c.lineWidth = 0.03;
        for (let k = 0; k < 9; k++) { const u = -Math.PI / 2 - 1 + k * 0.25; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(u) * 0.5, Math.sin(u) * 0.5); c.stroke(); }
        for (let k = 0; k < 5; k++) { const u = Math.PI / 2 - 0.6 + k * 0.3; c.beginPath(); c.moveTo(0.05, 0); c.lineTo(Math.cos(u) * 0.45 - 0.1, Math.sin(u) * 0.4); c.stroke(); }
        c.fillStyle = vyblednout('#e8d5c0', h); c.beginPath(); c.ellipse(0, 0, 0.32, 0.14, 0, 0, 7); c.fill();
        c.fillStyle = vyblednout('#a0281c', h); for (let k = 0; k < 4; k++) c.fillRect(-0.22 + k * 0.13, -0.13, 0.05, 0.26);
        c.restore(); break;
      }
      case 'meduza': {
        const pul = 1 + Math.sin(t * 3 + tv.hx) * 0.12;
        c.fillStyle = 'rgba(210,235,255,.55)'; c.beginPath(); c.ellipse(tv.x, tv.y, 0.32 * pul, 0.28 / pul, 0, Math.PI, 0); c.fill();
        c.strokeStyle = 'rgba(210,235,255,.45)'; c.lineWidth = 0.025;
        for (let k = 0; k < 4; k++) { const x = tv.x - 0.22 + k * 0.15; c.beginPath(); c.moveTo(x, tv.y); c.quadraticCurveTo(x + Math.sin(t * 2 + k) * 0.15, tv.y + 0.5, x, tv.y + 1.1); c.stroke(); }
        break;
      }
      case 'murena': {
        const v = tv.vysun, s = tv.smer;
        c.save(); c.translate(tv.x - s * 0.3, tv.y + 0.1); c.scale(s, 1);
        c.strokeStyle = '#5d6b2d'; c.lineWidth = 0.22; c.lineCap = 'round';
        c.beginPath(); c.moveTo(0, 0.1); c.quadraticCurveTo(0.3 * v + 0.1, -0.3 * v, 0.4 + 0.7 * v, -0.2 * v); c.stroke();
        const hx = 0.4 + 0.7 * v, hy = -0.2 * v;
        c.fillStyle = '#6f7d35'; c.beginPath(); c.ellipse(hx, hy, 0.2, 0.12, 0, 0, 7); c.fill();
        if (v > 0.5) { c.fillStyle = '#300'; c.beginPath(); c.moveTo(hx + 0.05, hy); c.lineTo(hx + 0.22, hy - 0.05 - v * 0.05); c.lineTo(hx + 0.22, hy + 0.06 + v * 0.05); c.fill(); }
        c.fillStyle = '#ff0'; c.beginPath(); c.arc(hx + 0.05, hy - 0.06, 0.03, 0, 7); c.fill();
        c.restore(); break;
      }
      case 'rejnok': {
        c.fillStyle = '#9b8b6a'; c.beginPath(); c.ellipse(tv.x, tv.y, 0.6, 0.12, 0, 0, 7); c.fill();
        c.strokeStyle = '#7d6e52'; c.lineWidth = 0.04; c.beginPath(); c.moveTo(tv.x - 0.55, tv.y); c.lineTo(tv.x - 1.3, tv.y + 0.05); c.stroke();
        c.fillStyle = '#222'; c.fillRect(tv.x + 0.2, tv.y - 0.1, 0.05, 0.04);
        break;
      }
    }
  }

  function lod(c, x, t) {
    const vl = Math.sin(t * 1.2) * 0.08;
    c.save(); c.translate(x, vl);
    c.fillStyle = '#f4f4f0'; c.beginPath(); c.moveTo(-4, -0.9); c.lineTo(4.3, -0.9); c.lineTo(3.6, 0.5); c.lineTo(-3.6, 0.5); c.fill();
    c.fillStyle = '#2163a8'; c.fillRect(-3.85, -0.35, 7.9, 0.25);
    c.fillStyle = '#e9e6dc'; c.fillRect(-1.5, -2.4, 3, 1.5);
    c.fillStyle = '#5ab0d8'; c.fillRect(-1.2, -2.1, 0.8, 0.5); c.fillRect(0.1, -2.1, 0.8, 0.5);
    c.strokeStyle = '#555'; c.lineWidth = 0.08; c.beginPath(); c.moveTo(2.6, -0.9); c.lineTo(2.6, -3.6); c.stroke();
    // vlajka „potápěč pod vodou"
    c.fillStyle = '#d42a2a'; c.fillRect(2.65, -3.6, 1, 0.7);
    c.strokeStyle = '#fff'; c.lineWidth = 0.14; c.beginPath(); c.moveTo(2.65, -3.6); c.lineTo(3.65, -2.9); c.stroke();
    // žebřík
    c.strokeStyle = '#999'; c.lineWidth = 0.06; c.beginPath(); c.moveTo(-3.4, -0.9); c.lineTo(-3.6, 0.9); c.moveTo(-3.1, -0.9); c.lineTo(-3.3, 0.9); c.stroke();
    c.restore();
  }

  window.VrakGrafika = { T, NAD, barvaVody, pripravTeren, predmet, zaval, zvedaciVak, potapec, tvor, lod, mix };
})();
