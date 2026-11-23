/* Zrcátko, blinkr, jeď! – vykreslení na plátno (pohled shora).
   Statická vrstva (tráva, domy, silnice, značení, značky) se kreslí jednou do pomocného plátna,
   každý snímek pak semafory, auta, chodci a cíl. Sprity aut a okolí (kreslené, z Codexu) jsou
   volitelné – bez nich se kreslí jednoduchými tvary. */
(function () {
  'use strict';
  const J = window.BLINKR_JADRO, SV = window.BLINKR_SVET;
  const D = J.SMERY;
  const W2 = J.PRUH;                  // polovina šířky vozovky
  const CHODNIK = 1.8;

  const sprity = { auta: null, okoli: null };
  function nactiSprity(zaklad, hotovo) {
    let zbyva = 2;
    for (const jm of ['auta', 'okoli']) {
      const img = new Image();
      img.onload = () => { sprity[jm] = img; if (--zbyva === 0 && hotovo) hotovo(); };
      img.onerror = () => { if (--zbyva === 0 && hotovo) hotovo(); };
      img.src = zaklad + jm + '.webp';
    }
  }

  // Deterministická „náhoda“ podle souřadnic dlaždice
  const hash = (x, y, k = 0) => { let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  /* ---------- statická vrstva ---------- */

  const OKRAJ_MAPY = 3;               // dlaždic kolem mapy (domy a silnice vedoucí „ven“, u ostrova moře)
  const CTVEREC = 8;                  // statická vrstva se kreslí po čtvercích nejvýš 8 × 8 dlaždic (velké mapy)
  const KROKY_SK = [4, 6, 8, 12, 16, 22, 30, 40];   // px na metr ve statické vrstvě
  const LIMIT_PX = 30e6;

  // Znak okolí na dlaždici (i mimo mapu): uvnitř mapy z definice, venku podle def.okoli (výchozí domy a parky).
  function znakOkoli(svet, x, y) {
    if (x >= 0 && y >= 0 && x < svet.W && y < svet.H) return (svet.def.mapa[y] || '')[x] || ' ';
    if (svet.def.okoli) return svet.def.okoli;
    return hash(x, y, 77) < 0.75 ? '.' : 'p';
  }

  // Silnice vedoucí ven z mapy (pokračují až na okraj kreslené plochy)
  function silniceVen(svet) {
    if (svet._ven) return svet._ven;
    const T = svet.T, M = OKRAJ_MAPY, ven = new Set();
    for (const t of svet.dl.values()) for (const k of t.ven) for (let i = 1; i <= M; i++) ven.add((t.x + D[k][0] * i) + ',' + (t.y + D[k][1] * i) + ',' + k);
    svet._ven = [...ven].map(s => { const [x, y, k] = s.split(',').map(Number); return { x, y, cx: (x + 0.5) * T, cy: (y + 0.5) * T, ramena: [k, (k + 2) % 4], typ: 'rovna' }; });
    svet._venKlice = new Set(svet._ven.map(v => v.x + ',' + v.y));
    return svet._ven;
  }

  // Jeden čtverec statické vrstvy (cx, cy = index čtverce). Kreslí se i dlaždice o 1 kolem a ořízne se.
  function ctverec(svet, cx, cy, SK, N) {
    const T = svet.T;
    const x0 = cx * N, y0 = cy * N;
    const cv = document.createElement('canvas');
    cv.width = Math.round(N * T * SK); cv.height = Math.round(N * T * SK);
    const g = cv.getContext('2d');
    if (!g) return cv;                         // nedostatek paměti pro plátno – čtverec zůstane prázdný
    g.scale(SK, SK);
    g.translate(-x0 * T, -y0 * T);
    g.beginPath(); g.rect(x0 * T, y0 * T, N * T, N * T); g.clip();
    g.fillStyle = '#86bf6b'; g.fillRect(x0 * T, y0 * T, N * T, N * T);
    const v = (x, y) => x >= x0 - 1 && x <= x0 + N && y >= y0 - 1 && y <= y0 + N;
    const venDl = silniceVen(svet).filter(d => v(d.x, d.y));
    for (let y = y0 - 1; y <= y0 + N; y++) for (let x = x0 - 1; x <= x0 + N; x++) {
      if (svet.dlazdice(x, y) || svet._venKlice.has(x + ',' + y)) continue;
      okoliDlazdice(g, svet, x, y, znakOkoli(svet, x, y));
    }
    for (const d of venDl) silnice(g, d, 'chodnik');
    for (const d of venDl) silnice(g, d, 'asfalt');
    g.strokeStyle = '#f2f2ee'; g.lineWidth = 0.15;
    for (const d of venDl) naRameno(g, d, d.ramena[0], () => carkovane(g, -SV.POL, 0, SV.POL, 0, 3, 3));
    const dl = [];
    for (let y = y0 - 1; y <= y0 + N; y++) for (let x = x0 - 1; x <= x0 + N; x++) { const t = svet.dlazdice(x, y); if (t) dl.push(t); }
    for (const t of dl) silnice(g, t, 'chodnik');
    for (const t of dl) silnice(g, t, 'asfalt');
    for (const t of dl) znaceni(g, svet, t);
    for (const p of svet.prechody) if (v(p.tile.x, p.tile.y)) prechod(g, svet, p);
    for (const t of dl) znacky(g, svet, t);
    return cv;
  }

  function okoliDlazdice(g, svet, x, y, ch) {
    const T = svet.T, x0 = x * T, y0 = y * T;
    g.fillStyle = '#86bf6b'; g.fillRect(x0, y0, T, T);
    if (ch === '~') {                                   // moře: tmavší dál od pobřeží, vlnky
      const pobr = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const c = znakOkoli(svet, x + dx, y + dy); return c !== '~'; });
      g.fillStyle = pobr ? '#4aa3cf' : '#3586bd'; g.fillRect(x0, y0, T, T);
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 0.35;
      for (let i = 0; i < 4; i++) {
        const vx = x0 + 3 + hash(x, y, i) * (T - 8), vy = y0 + 3 + hash(x, y, i + 5) * (T - 6);
        g.beginPath(); g.arc(vx, vy, 1.6, Math.PI * 1.15, Math.PI * 1.85); g.arc(vx + 3.2, vy, 1.6, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
      }
      return;
    }
    if (ch === '_') {                                   // pláž
      g.fillStyle = '#ecdcab'; g.fillRect(x0, y0, T, T);
      g.fillStyle = 'rgba(160,130,80,.25)';
      for (let i = 0; i < 14; i++) g.fillRect(x0 + hash(x, y, i) * T, y0 + hash(x, y, i + 30) * T, 0.4, 0.4);
      if (hash(x, y, 90) < 0.5) strom(g, x0 + 6 + hash(x, y, 91) * (T - 12), y0 + 6 + hash(x, y, 92) * (T - 12), 2.4, 3);
      return;
    }
    if (ch === 'c') {                                   // pole cukrové třtiny (řádky)
      g.fillStyle = hash(x, y, 3) < 0.5 ? '#9ccc5c' : '#a9d466'; g.fillRect(x0, y0, T, T);
      g.strokeStyle = 'rgba(60,110,40,.35)'; g.lineWidth = 0.45;
      const svisle = hash(x, y, 4) < 0.5;
      g.beginPath();
      for (let u = 1; u < T; u += 1.6) { if (svisle) { g.moveTo(x0 + u, y0 + 0.5); g.lineTo(x0 + u, y0 + T - 0.5); } else { g.moveTo(x0 + 0.5, y0 + u); g.lineTo(x0 + T - 0.5, y0 + u); } }
      g.stroke();
      return;
    }
    if (ch === 'h') {                                   // hory a lesy
      g.fillStyle = '#5b8a45'; g.fillRect(x0, y0, T, T);
      for (let i = 0; i < 7; i++) strom(g, x0 + 3 + hash(x, y, i) * (T - 6), y0 + 3 + hash(x, y, i + 9) * (T - 6), 3 + hash(x, y, i + 3) * 2.5, i + 1);
      return;
    }
    if (ch === 'p') {
      g.fillStyle = '#79b35f'; g.fillRect(x0, y0, T, T);
      for (let i = 0; i < 5; i++) strom(g, x0 + 4 + hash(x, y, i) * (T - 8), y0 + 4 + hash(x, y, i + 9) * (T - 8), 3 + hash(x, y, i + 3) * 2.5, i);
      for (let i = 0; i < 3; i++) dekorace(g, 12 + ((i + x + y) % 2) * (i === 2 ? 3 : 1), x0 + 3 + hash(x, y, i + 30) * (T - 6), y0 + 3 + hash(x, y, i + 40) * (T - 6), 1.6 + hash(x, y, i + 50));
      return;
    }
    if (ch === '.') {
      // dva domy se zahrádkou
      const n = hash(x, y) < 0.5 ? 1 : 2;
      for (let i = 0; i < n; i++) {
        const w = n === 1 ? 15 + hash(x, y, 1) * 5 : 10 + hash(x, y, i + 2) * 3;
        const h = n === 1 ? 12 + hash(x, y, 2) * 5 : 11 + hash(x, y, i + 5) * 4;
        const cx = x0 + (n === 1 ? T / 2 : T / 4 + i * T / 2), cy = y0 + T / 2 + (hash(x, y, i + 7) - 0.5) * 4;
        strecha(g, cx, cy, w, h, Math.floor(hash(x, y, i + 11) * 8), hash(x, y, i + 13) < 0.5);
      }
      if (hash(x, y, 20) < 0.7) strom(g, x0 + 3 + hash(x, y, 21) * 5, y0 + 3 + hash(x, y, 22) * 4, 2.5, 1);
    }
  }

  function strecha(g, cx, cy, w, h, druh, otoc) {
    if (sprity.okoli) {
      const sx = (druh % 4) * sprity.okoli.width / 4, sy = Math.floor(druh / 4) * sprity.okoli.height / 4;
      g.save(); g.translate(cx, cy); if (otoc) g.rotate(Math.PI / 2);
      const [ww, hh] = otoc ? [h, w] : [w, h];
      g.drawImage(sprity.okoli, sx, sy, sprity.okoli.width / 4, sprity.okoli.height / 4, -ww / 2, -hh / 2, ww, hh);
      g.restore();
      return;
    }
    const barvy = ['#b5543c', '#8c4a32', '#6f7880', '#a0623a', '#c2703f', '#556b5a', '#7a4b3a', '#9b8b6e'];
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(cx - w / 2 + 0.8, cy - h / 2 + 0.8, w, h);
    g.fillStyle = barvy[druh]; g.fillRect(cx - w / 2, cy - h / 2, w, h);
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 0.25; g.strokeRect(cx - w / 2, cy - h / 2, w, h);
    g.fillStyle = 'rgba(255,255,255,.12)';
    if (otoc) g.fillRect(cx - w / 2, cy - h / 2, w / 2, h); else g.fillRect(cx - w / 2, cy - h / 2, w, h / 2);
    g.beginPath();
    if (otoc) { g.moveTo(cx, cy - h / 2); g.lineTo(cx, cy + h / 2); } else { g.moveTo(cx - w / 2, cy); g.lineTo(cx + w / 2, cy); }
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.35; g.stroke();
  }

  function strom(g, x, y, r, i) {
    if (sprity.okoli) {
      const k = 8 + (i % 4);
      g.drawImage(sprity.okoli, (k % 4) * sprity.okoli.width / 4, Math.floor(k / 4) * sprity.okoli.height / 4, sprity.okoli.width / 4, sprity.okoli.height / 4, x - r * 1.2, y - r * 1.2, r * 2.4, r * 2.4);
      return;
    }
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.arc(x + 0.6, y + 0.6, r, 0, 7); g.fill();
    g.fillStyle = ['#3f7d3a', '#4b8a3f', '#356f33', '#5a9446'][i % 4]; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.15)'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.5, 0, 7); g.fill();
  }

  // Keře (12, 13), kašna (14), záhon (15) z archu okolí
  function dekorace(g, k, x, y, r) {
    if (!sprity.okoli) return;
    const s = sprity.okoli.width / 4;
    g.drawImage(sprity.okoli, (k % 4) * s, Math.floor(k / 4) * s, s, s, x - r, y - r, 2 * r, 2 * r);
  }

  function silnice(g, t, vrstva) {
    const sir = vrstva === 'chodnik' ? W2 + CHODNIK : W2;
    g.fillStyle = vrstva === 'chodnik' ? '#cfc9bb' : '#5a6068';
    const POL = SV.POL;
    for (const k of t.ramena) {
      const [dx, dy] = D[k];
      const x1 = t.cx, y1 = t.cy, x2 = t.cx + dx * POL, y2 = t.cy + dy * POL;
      g.fillRect(Math.min(x1, x2) - (dx ? 0 : sir), Math.min(y1, y2) - (dy ? 0 : sir), Math.abs(x2 - x1) + (dx ? 0 : 2 * sir), Math.abs(y2 - y1) + (dy ? 0 : 2 * sir));
    }
    if (t.typ === 'kruhac') {
      g.beginPath(); g.arc(t.cx, t.cy, SV.KR.vnejsi + (vrstva === 'chodnik' ? CHODNIK : 0), 0, 7); g.fill();
      if (vrstva === 'asfalt') {
        g.fillStyle = '#cfc9bb'; g.beginPath(); g.arc(t.cx, t.cy, SV.KR.ostrov + 0.6, 0, 7); g.fill();
        g.fillStyle = '#7fb764'; g.beginPath(); g.arc(t.cx, t.cy, SV.KR.ostrov, 0, 7); g.fill();
        if (sprity.okoli) dekorace(g, 14, t.cx, t.cy, SV.KR.ostrov - 0.6); else strom(g, t.cx, t.cy, 2.2, 2);
      }
    } else if (t.typ === 'krizovatka') {
      // čtverec křižovatky se zaoblenými vnitřními rohy (oblouky obrubníku), chodník kopíruje obrubník
      const r = J.OKRAJ, z = r - W2;
      const o = vrstva === 'chodnik' ? CHODNIK : 0;
      const a = r + o;
      g.save();
      g.beginPath(); g.rect(t.cx - a, t.cy - a, 2 * a, 2 * a); g.clip();
      g.fillRect(t.cx - a, t.cy - a, 2 * a, 2 * a);
      g.fillStyle = vrstva === 'chodnik' ? '#86bf6b' : '#cfc9bb';
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        const kx = sx > 0 ? 1 : 3, ky = sy > 0 ? 2 : 0;
        if (!t.ramena.includes(kx) || !t.ramena.includes(ky)) continue;
        g.beginPath(); g.arc(t.cx + sx * r, t.cy + sy * r, z - o, 0, 7); g.fill();
        // za obloukem je (u asfaltu) chodník, u chodníku tráva až do rohu čtverce
        g.fillRect(t.cx + (sx > 0 ? r : -a), t.cy + (sy > 0 ? r : -a), a - r, a - r);
      }
      // chybějící rameno (T): rovná hrana
      for (let k = 0; k < 4; k++) if (!t.ramena.includes(k)) {
        const [dx, dy] = D[k];
        const pas = (od, do_, barva) => {
          g.fillStyle = barva;
          if (dx) g.fillRect(t.cx + (dx > 0 ? od : -do_), t.cy - a, do_ - od, 2 * a);
          else g.fillRect(t.cx - a, t.cy + (dy > 0 ? od : -do_), 2 * a, do_ - od);
        };
        if (vrstva === 'chodnik') pas(W2 + CHODNIK, a, '#86bf6b');
        else { pas(W2, W2 + CHODNIK, '#cfc9bb'); pas(W2 + CHODNIK, a, '#86bf6b'); }
      }
      g.restore();
    } else {
      g.beginPath(); g.arc(t.cx, t.cy, sir, 0, 7); g.fill();
    }
  }

  // Na rameni k: transformace tak, že osa +x vede ze středu ven po rameni.
  function naRameno(g, t, k, f) {
    g.save(); g.translate(t.cx, t.cy); g.rotate(Math.atan2(D[k][1], D[k][0])); f(); g.restore();
  }

  function carkovane(g, x1, y1, x2, y2, delka, mezera) {
    g.setLineDash([delka, mezera]); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.setLineDash([]);
  }

  function vzdalCary(t, k) {
    const sPrech = (t.prechodyRamena.includes(k) || t.mistaRamena.includes(k)) && t.typ !== 'kruhac';
    return (t.typ === 'kruhac' ? SV.KR.okraj : J.OKRAJ) + 0.6 + (sPrech ? SV.ZA_PRECHODEM : 0);
  }

  function znaceni(g, svet, t) {
    const s = svet.profil.strana, uk = svet.profil.id === 'uk';
    g.strokeStyle = '#f2f2ee'; g.fillStyle = '#f2f2ee';
    const zac = t.box ? (t.typ === 'kruhac' ? SV.KR.okraj : J.OKRAJ) + 1 : 0;
    // osa vozovky
    g.lineWidth = 0.15;
    for (const k of t.ramena) naRameno(g, t, k, () => {
      const kde = t.box ? vzdalCary(t, k) : zac;
      carkovane(g, kde + 0.5, 0, SV.POL, 0, 3, 3);
    });
    if (t.typ === 'kruhac') {
      g.lineWidth = 0.15; g.setLineDash([1.5, 1.5]);
      g.beginPath(); g.arc(t.cx, t.cy, SV.KR.vnejsi - 0.3, 0, 7); g.stroke(); g.setLineDash([]);
    }
    if (!t.box) return;
    // příčné čáry (strana vjezdu: v ramenu je vjezd na straně −strana·vpravoOd(ven) = y = −s·(W2/2) v otočených souřadnicích)
    for (const k of t.ramena) {
      const r = t.rizeni[k];
      if (!r || r === 'hlavni' || r === 'neoznacena') continue;
      const d = vzdalCary(t, k);
      naRameno(g, t, k, () => {
        // ve vlastních souřadnicích ramene je vjezd na y = −s·… (pravá ruka jízdy dovnitř = −y pro s=+1)
        const y1 = 0, y2 = -s * W2;
        if (r === 'stop' || r === 'semafor') {
          g.lineWidth = 0.5; g.beginPath(); g.moveTo(d, y1); g.lineTo(d, y2); g.stroke();
          if (r === 'stop') napis(g, 'STOP', d + 2.2, (y1 + y2) / 2, -Math.PI / 2);     // čitelné pro přijíždějícího
        } else {
          g.lineWidth = 0.4;
          carkovane(g, d, y1, d, y2, 0.6, 0.6);
          if (uk) carkovane(g, d + 0.8, y1, d + 0.8, y2, 0.6, 0.6);
          trojuhelnikNaSilnici(g, d + (uk ? 3.2 : 2.6), (y1 + y2) / 2);
        }
      });
    }
  }

  function napis(g, text, x, y, rot) {
    g.save(); g.translate(x, y); g.rotate(rot); g.font = 'bold 1.6px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 0, 0); g.restore();
  }
  function trojuhelnikNaSilnici(g, x, y) {
    g.save(); g.translate(x, y); g.lineWidth = 0.25;
    g.beginPath(); g.moveTo(-1, -1.1); g.lineTo(-1, 1.1); g.lineTo(1.4, 0); g.closePath(); g.stroke(); g.restore();
  }

  function prechod(g, svet, p) {
    const [cx, cy] = p.stred;
    const napric = p.smer;                 // směr přes silnici
    const podel = [napric[1], napric[0]];  // směr silnice
    g.save(); g.translate(cx, cy); g.rotate(Math.atan2(napric[1], napric[0]));
    if (p.typ === 'zebra') {
      g.fillStyle = '#f2f2ee';
      for (let u = -W2 + 0.25; u < W2 - 0.2; u += 1) g.fillRect(u, -1.6, 0.5, 3.2);
    } else {
      g.strokeStyle = 'rgba(242,242,238,.85)'; g.lineWidth = 0.18;
      carkovane(g, -W2, -1.5, W2, -1.5, 0.5, 0.5); carkovane(g, -W2, 1.5, W2, 1.5, 0.5, 0.5);
    }
    g.restore();
    if (p.typ === 'zebra') {
      for (const sgn of [-1, 1]) {
        const x = cx + napric[0] * sgn * (W2 + 0.9) + podel[0] * 2.2 * sgn, y = cy + napric[1] * sgn * (W2 + 0.9) + podel[1] * 2.2 * sgn;
        if (svet.profil.id === 'uk') {          // Belishovy majáky
          g.fillStyle = '#222'; g.beginPath(); g.arc(x, y, 0.35, 0, 7); g.fill();
          g.fillStyle = '#f5b400'; g.beginPath(); g.arc(x, y, 0.6, 0, 7); g.fill();
        } else {                                  // IP 6 Přechod pro chodce
          g.fillStyle = '#1f5fbf'; g.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
          g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x - 0.55, y + 0.5); g.lineTo(x + 0.55, y + 0.5); g.lineTo(x, y - 0.55); g.closePath(); g.fill();
          g.fillStyle = '#1f5fbf'; g.fillRect(x - 0.1, y - 0.15, 0.2, 0.55);
        }
      }
    }
  }

  // Svislé značky u vjezdů – na straně jízdy (ČR vpravo, UK vlevo).
  function polohaZnacky(svet, t, k, d) {
    const s = svet.profil.strana;
    // jízda dovnitř po rameni k: směr −D[k], pravá ruka = vpravoOd(−D[k]) = (D[k][1], −D[k][0])
    const pr = [D[k][1], -D[k][0]];
    const bok = s * (W2 + 1.0);
    return [t.cx + D[k][0] * d + pr[0] * bok, t.cy + D[k][1] * d + pr[1] * bok];
  }

  function znacky(g, svet, t) {
    if (!t.box) return;
    const cz = svet.profil.id === 'cz';
    for (const k of t.ramena) {
      const r = t.rizeni[k];
      const [x, y] = polohaZnacky(svet, t, k, vzdalCary(t, k) + 1.4);
      if (t.typ === 'kruhac') {
        if (t.bezZnacky) continue;                 // ČR: kruháč bez C 1 + P 4 je neoznačená křižovatka
        znackaKruhac(g, x, y, svet.profil);
        const [x2, y2] = polohaZnacky(svet, t, k, vzdalCary(t, k) + 4.2);
        znackaDejPrednost(g, x2, y2, cz);
        continue;
      }
      if (r === 'dej_prednost') znackaDejPrednost(g, x, y, cz);
      else if (r === 'stop') znackaStop(g, x, y);
      else if (r === 'hlavni' && cz && t.ramena.some(j => t.rizeni[j] === 'dej_prednost' || t.rizeni[j] === 'stop')) znackaHlavni(g, x, y);
    }
  }
  function sloupek(g, x, y) { g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(x + 0.25, y + 0.25, 1.15, 0, 7); g.fill(); }
  function znackaDejPrednost(g, x, y, cz) {
    sloupek(g, x, y);
    g.beginPath(); g.moveTo(x - 1.1, y - 0.75); g.lineTo(x + 1.1, y - 0.75); g.lineTo(x, y + 1.15); g.closePath();
    g.fillStyle = '#d0202a'; g.fill();
    g.beginPath(); g.moveTo(x - 0.68, y - 0.5); g.lineTo(x + 0.68, y - 0.5); g.lineTo(x, y + 0.6); g.closePath();
    g.fillStyle = cz ? '#fff' : '#fff'; g.fill();
    if (!cz) { g.fillStyle = '#111'; g.font = 'bold 0.26px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('GIVE', x, y - 0.24); g.fillText('WAY', x, y + 0.04); }
  }
  function znackaStop(g, x, y) {
    sloupek(g, x, y);
    g.beginPath();
    for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; g.lineTo(x + Math.cos(a) * 1.1, y + Math.sin(a) * 1.1); }
    g.closePath(); g.fillStyle = '#d0202a'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 0.1; g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 0.62px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('STOP', x, y + 0.02);
  }
  function znackaHlavni(g, x, y) {
    sloupek(g, x, y);
    g.beginPath(); g.moveTo(x, y - 1.15); g.lineTo(x + 1.15, y); g.lineTo(x, y + 1.15); g.lineTo(x - 1.15, y); g.closePath();
    g.fillStyle = '#fff'; g.fill(); g.strokeStyle = '#333'; g.lineWidth = 0.06; g.stroke();
    g.beginPath(); g.moveTo(x, y - 0.75); g.lineTo(x + 0.75, y); g.lineTo(x, y + 0.75); g.lineTo(x - 0.75, y); g.closePath();
    g.fillStyle = '#f2c200'; g.fill();
  }
  function znackaKruhac(g, x, y, profil) {
    sloupek(g, x, y);
    g.fillStyle = '#1f5fbf'; g.beginPath(); g.arc(x, y, 1.1, 0, 7); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 0.18;
    const proti = profil.strana > 0;     // ČR proti hodinám
    for (let i = 0; i < 3; i++) {
      const a0 = i * 2 * Math.PI / 3, a1 = a0 + 1.3;
      g.beginPath(); g.arc(x, y, 0.62, proti ? -a0 : a0, proti ? -a1 : a1, proti); g.stroke();
      const ak = proti ? -a1 : a1, hx = x + Math.cos(ak) * 0.62, hy = y + Math.sin(ak) * 0.62;
      const tx = -Math.sin(ak) * (proti ? -1 : 1), ty = Math.cos(ak) * (proti ? -1 : 1);
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(hx + tx * 0.3, hy + ty * 0.3); g.lineTo(hx - ty * 0.2, hy + tx * 0.2); g.lineTo(hx + ty * 0.2, hy - tx * 0.2); g.closePath(); g.fill();
    }
  }

  /* ---------- dynamické prvky ---------- */

  function semafory(g, sim) {
    const svet = sim.svet;
    for (const t of svet.dl.values()) {
      if (!t.semafor) continue;
      for (const k of t.ramena) {
        const [x, y] = polohaZnacky(svet, t, k, vzdalCary(t, k) + 0.6);
        const barva = svet.barva(t, k, sim.cas);
        const u = Math.atan2(-D[k][1], -D[k][0]);     // hlava semaforu natočená proti přijíždějícím
        g.save(); g.translate(x, y); g.rotate(u + Math.PI / 2);
        g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-0.5, -1.4, 1.2, 2.9);
        g.fillStyle = '#1d1f22'; g.fillRect(-0.6, -1.5, 1.2, 2.9);
        const sv = [['#ff3b30', barva === 'cervena' || barva === 'cervena_zluta'], ['#ffcc00', barva === 'zluta' || barva === 'cervena_zluta'], ['#34c759', barva === 'zelena']];
        sv.forEach(([c, on], i) => { g.fillStyle = on ? c : '#3a3d42'; g.beginPath(); g.arc(0, -0.95 + i * 0.9, 0.36, 0, 7); g.fill(); if (on) { g.fillStyle = c + '55'; g.beginPath(); g.arc(0, -0.95 + i * 0.9, 0.7, 0, 7); g.fill(); } });
        if (t.sipky.includes(k)) {
          const on = svet.sipkaSviti(t, k, sim.cas);
          const strana = svet.profil.strana;     // šipka ke krajnici: ČR vpravo, UK vlevo
          g.fillStyle = '#1d1f22'; g.fillRect(0.6 * strana - (strana < 0 ? 1.1 : 0), 0.0, 1.1, 1.0);
          g.fillStyle = on ? '#34c759' : '#3a3d42';
          const cx = strana > 0 ? 1.15 : -1.15;
          g.beginPath(); g.moveTo(cx + 0.38 * strana, 0.5); g.lineTo(cx - 0.12 * strana, 0.18); g.lineTo(cx - 0.12 * strana, 0.82); g.closePath(); g.fill();
          g.fillRect(Math.min(cx - 0.35 * strana, cx - 0.1 * strana), 0.42, 0.28, 0.16);
        }
        g.restore();
      }
    }
  }

  const BARVY_SPRITU = ['#d94b3d', '#3d7dd9', '#e2b93b', '#4caf6a', '#8e5bd1', '#e07b39', '#5fb6c9', '#ffffff'];
  function auto(g, a, cas, jeHrac) {
    const L = 4.4, W = 1.9;
    g.save(); g.translate(a.x, a.y); g.rotate(a.uhel);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.roundRect(-L / 2 + 0.3, -W / 2 + 0.3, L, W, 0.6); g.fill();
    const idx = BARVY_SPRITU.indexOf(a.barva);
    if (sprity.auta && idx >= 0) {
      const cw = sprity.auta.width / 2, ch = sprity.auta.height / 4;
      g.drawImage(sprity.auta, (idx % 2) * cw, Math.floor(idx / 2) * ch, cw, ch, -L / 2 - 0.1, -L / 4 - 0.05, L + 0.2, L / 2 + 0.1);
    } else {
      g.fillStyle = a.barva; g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 0.12;
      g.beginPath(); g.roundRect(-L / 2, -W / 2, L, W, 0.55); g.fill(); g.stroke();
      g.fillStyle = 'rgba(30,40,55,.75)';
      g.beginPath(); g.roundRect(0.35, -W / 2 + 0.22, 0.85, W - 0.44, 0.2); g.fill();          // přední sklo
      g.beginPath(); g.roundRect(-1.55, -W / 2 + 0.28, 0.55, W - 0.56, 0.15); g.fill();         // zadní sklo
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(-0.95, -W / 2 + 0.25, 1.25, W - 0.5);  // střecha
    }
    // brzdová světla
    if (a.brzdi) { g.fillStyle = '#ff2a2a'; g.fillRect(-L / 2 - 0.05, -W / 2 + 0.1, 0.25, 0.45); g.fillRect(-L / 2 - 0.05, W / 2 - 0.55, 0.25, 0.45); }
    // blinkry (bliká 1,5× za sekundu)
    if (a.blinkr && a.blinkr !== 'zadny' && (cas * 1.5) % 1 < 0.55) {
      const y = a.blinkr === 'vpravo' ? W / 2 - 0.12 : -W / 2 + 0.12;
      g.fillStyle = '#ffb000';
      for (const x of [L / 2 - 0.25, -L / 2 + 0.25]) { g.beginPath(); g.arc(x, y, 0.32, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(255,176,0,.35)';
      for (const x of [L / 2 - 0.25, -L / 2 + 0.25]) { g.beginPath(); g.arc(x, y, 0.75, 0, 7); g.fill(); }
    }
    if (jeHrac) { g.strokeStyle = '#ffe14d'; g.lineWidth = 0.22; g.setLineDash([0.6, 0.4]); g.beginPath(); g.roundRect(-L / 2 - 0.45, -W / 2 - 0.45, L + 0.9, W + 0.9, 0.9); g.stroke(); g.setLineDash([]); }
    g.restore();
  }

  function chodec(g, ch, cas) {
    g.save(); g.translate(ch.x, ch.y); g.rotate(ch.uhel);
    const krok = ch.stav === 'na_prechodu' || ch.stav === 'jde' || ch.stav === 'odchazi' ? Math.sin(cas * 9) * 0.25 : 0;
    g.fillStyle = '#2b2b2b'; g.beginPath(); g.ellipse(krok, -0.18, 0.2, 0.12, 0, 0, 7); g.ellipse(-krok, 0.18, 0.2, 0.12, 0, 0, 7); g.fill();
    g.fillStyle = ch.barva; g.beginPath(); g.ellipse(0, 0, 0.3, 0.5, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 0.06; g.stroke();
    g.fillStyle = '#f0c8a0'; g.beginPath(); g.arc(0.02, 0, 0.22, 0, 7); g.fill();
    g.fillStyle = '#4a3020'; g.beginPath(); g.arc(-0.04, 0, 0.18, Math.PI * 0.5, Math.PI * 1.5); g.fill();
    if (ch.stav === 'ceka') { g.strokeStyle = 'rgba(255,225,77,.9)'; g.lineWidth = 0.1; g.beginPath(); g.arc(0, 0, 0.75 + 0.12 * Math.sin(cas * 5), 0, 7); g.stroke(); }
    g.restore();
  }

  function cil(g, sim, cas) {
    const t = sim.cil;
    if (!t) return;
    const r = 2.6 + 0.4 * Math.sin(cas * 4);
    g.save(); g.translate(t.cx, t.cy);
    g.fillStyle = 'rgba(255,225,77,.25)'; g.beginPath(); g.arc(0, 0, r + 2, 0, 7); g.fill();
    g.fillStyle = '#ffd400'; g.strokeStyle = '#7a5b00'; g.lineWidth = 0.2;
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.closePath(); g.fill(); g.stroke();
    g.restore();
  }

  // Názvy měst (stálá velikost na obrazovce) a zdroj dat u velkých map
  function popisky(ctx, sim, kam, z, dpr) {
    const def = sim.svet.def, T = sim.svet.T;
    if (!def.mesta && !def.zdroj) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const m of def.mesta || []) {
      const sx = W / 2 + ((m.px + 0) * T - kam.x) * z, sy = H / 2 + ((m.py + 0) * T - kam.y) * z;
      if (sx < -200 || sx > W + 200 || sy < -50 || sy > H + 50) continue;
      ctx.font = `700 ${Math.round((m.mesto ? 17 : 14) * dpr)}px system-ui, sans-serif`;
      ctx.lineWidth = 4 * dpr; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.fillStyle = '#2a2a2a';
      ctx.strokeText(m.nazev, sx, sy); ctx.fillText(m.nazev, sx, sy);
    }
    if (def.zdroj) {
      ctx.font = `${Math.round(10 * dpr)}px system-ui, sans-serif`; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(W - 210 * dpr, H - 15 * dpr, 210 * dpr, 15 * dpr);
      const txt = '© ' + (window.I18N && I18N.t ? I18N.t('přispěvatelé OpenStreetMap (ODbL)') : 'přispěvatelé OpenStreetMap (ODbL)');
      ctx.fillStyle = '#333'; ctx.fillText(txt, W - 4 * dpr, H - 2 * dpr);
    }
    ctx.restore();
  }

  // Minimapa (jedna barva na dlaždici) – jen pro velké mapy
  function minimapa(cv, svet) {
    const g = cv.getContext('2d'), k = 3;
    cv.width = svet.W * k; cv.height = svet.H * k;
    const barvy = { '~': '#3586bd', '_': '#ecdcab', 'c': '#a2cf60', 'h': '#5b8a45', '.': '#c99c7a', 'p': '#79b35f' };
    for (let y = 0; y < svet.H; y++) for (let x = 0; x < svet.W; x++) {
      const t = svet.dlazdice(x, y);
      g.fillStyle = t ? (t.typ === 'kruhac' ? '#fff' : '#3b3f45') : (barvy[znakOkoli(svet, x, y)] || '#86bf6b');
      g.fillRect(x * k, y * k, k, k);
    }
  }

  /* ---------- snímek ---------- */

  function vytvor(platno) {
    const ctx = platno.getContext('2d');
    const cache = new Map();
    let svetStat = null, pixely = 0;
    const vymaz = () => { for (const c of cache.values()) c.width = c.height = 0; cache.clear(); pixely = 0; };
    return {
      zneplatni() { vymaz(); },
      kresli(sim, kam) {
        const dpr = window.devicePixelRatio || 1;
        const w = platno.clientWidth, h = platno.clientHeight;
        if (platno.width !== Math.round(w * dpr) || platno.height !== Math.round(h * dpr)) { platno.width = Math.round(w * dpr); platno.height = Math.round(h * dpr); }
        if (svetStat !== sim.svet) { vymaz(); svetStat = sim.svet; }
        const z = kam.zoom * dpr;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#7fb764'; ctx.fillRect(0, 0, platno.width, platno.height);
        ctx.setTransform(z, 0, 0, z, platno.width / 2 - kam.x * z, platno.height / 2 - kam.y * z);
        ctx.imageSmoothingEnabled = true;
        // viditelné čtverce statické vrstvy (s mezipamětí, nejvýš ~60)
        // Rozlišení čtverců podle skutečného přiblížení (ostré i na HiDPI), v krocích, aby zoom nepřekresloval pořád;
        // velikost čtverce v dlaždicích tak, aby měl ~1 Mpx. Mezipaměť omezená počtem pixelů (~30 Mpx ≈ 120 MB).
        const svet = sim.svet, T = svet.T;
        const SK = KROKY_SK.find(k => k >= z) || KROKY_SK[KROKY_SK.length - 1];
        const N = Math.max(1, Math.min(CTVEREC, Math.floor(1024 / (T * SK)))), delka = N * T;
        const pw = platno.width / z / 2, ph = platno.height / z / 2;
        const M = OKRAJ_MAPY;
        const cx0 = Math.max(Math.floor((kam.x - pw) / delka), Math.floor(-M / N) - 1), cx1 = Math.min(Math.floor((kam.x + pw) / delka), Math.ceil((svet.W + M) / N));
        const cy0 = Math.max(Math.floor((kam.y - ph) / delka), Math.floor(-M / N) - 1), cy1 = Math.min(Math.floor((kam.y + ph) / delka), Math.ceil((svet.H + M) / N));
        for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
          const klic = cx + ',' + cy + ',' + SK + ',' + N;
          let cv = cache.get(klic);
          if (!cv) {
            cv = ctverec(svet, cx, cy, SK, N);
            cache.set(klic, cv);
            pixely += cv.width * cv.height;
            for (const [k, c] of cache) {                       // nejstarší pryč, dokud je přes limit
              if (pixely <= LIMIT_PX || k === klic) break;
              pixely -= c.width * c.height; cache.delete(k);
              c.width = c.height = 0;                            // uvolnit paměť plátna hned (Safari)
            }
          } else { cache.delete(klic); cache.set(klic, cv); }
          ctx.drawImage(cv, cx * delka, cy * delka, delka + 0.05, delka + 0.05);
        }
        semafory(ctx, sim);
        cil(ctx, sim, sim.cas);
        for (const ch of sim.chodci) chodec(ctx, ch, sim.cas);
        for (const a of sim.auta) auto(ctx, a, sim.cas, false);
        if (sim.hrac) auto(ctx, sim.hrac, sim.cas, true);
        popisky(ctx, sim, kam, z, dpr);
      },
    };
  }

  window.BLINKR_KRESBA = { vytvor, nactiSprity, sprity, BARVY_SPRITU, minimapa };
})();
