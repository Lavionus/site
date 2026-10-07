// Nad krajinou — OSD a HUD: FPV ve stylu Betaflightu, kamerový HUD s minimapou, zprávy, focení.
(function (D) {
  'use strict';

  const CSS = `
  #osd { font-family: 'DejaVu Sans Mono', 'Consolas', monospace; color: #fff; }
  #osd .o-stin { text-shadow: 0 0 2px #000, 0 0 2px #000, 1px 1px 1px #000; }
  #osd .fpv { position: absolute; inset: 0; font-size: clamp(12px, 1.7vw, 18px); font-weight: bold; letter-spacing: 0.04em; }
  #osd .fpv .r { position: absolute; white-space: pre; }
  #osd .fpv canvas, #osd .mm canvas { position: absolute; }
  #osd .hud { position: absolute; inset: 0; font-family: system-ui, sans-serif; font-size: 13px; }
  #osd .hud .lista { position: absolute; left: 0; right: 0; top: 0; display: flex; gap: 18px; align-items: center; padding: 6px 14px;
    background: linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0)); }
  #osd .hud .lista b { font-weight: 600; }
  #osd .hud .dole { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); display: flex; gap: 6px; }
  #osd .hud .dole div { background: rgba(10,14,20,0.55); border-radius: 6px; padding: 4px 10px; min-width: 76px; text-align: center; backdrop-filter: blur(3px); }
  #osd .hud .dole small { display: block; font-size: 10px; color: #b8c4d0; letter-spacing: 0.06em; }
  #osd .hud .dole span { font-size: 17px; font-variant-numeric: tabular-nums; }
  #osd .mm { position: absolute; right: 12px; bottom: 12px; width: 150px; height: 150px; border-radius: 50%; overflow: hidden;
    border: 2px solid rgba(255,255,255,0.35); box-shadow: 0 2px 10px rgba(0,0,0,0.4); background: #233; }
  #osd .ram { position: absolute; inset: 9% 12%; border: 1px solid rgba(255,255,255,0.0); }
  #osd .ram i { position: absolute; width: 22px; height: 22px; border: 2px solid rgba(255,255,255,0.7); }
  #osd .ram i:nth-child(1) { left: 0; top: 0; border-right: 0; border-bottom: 0; }
  #osd .ram i:nth-child(2) { right: 0; top: 0; border-left: 0; border-bottom: 0; }
  #osd .ram i:nth-child(3) { left: 0; bottom: 0; border-right: 0; border-top: 0; }
  #osd .ram i:nth-child(4) { right: 0; bottom: 0; border-left: 0; border-top: 0; }
  #osd .tretiny { position: absolute; inset: 0; background:
    linear-gradient(90deg, transparent calc(33.33% - 0.5px), rgba(255,255,255,0.22) 33.33%, transparent calc(33.33% + 0.5px), transparent calc(66.66% - 0.5px), rgba(255,255,255,0.22) 66.66%, transparent calc(66.66% + 0.5px)),
    linear-gradient(0deg, transparent calc(33.33% - 0.5px), rgba(255,255,255,0.22) 33.33%, transparent calc(33.33% + 0.5px), transparent calc(66.66% - 0.5px), rgba(255,255,255,0.22) 66.66%, transparent calc(66.66% + 0.5px)); }
  #osd .zpravy { position: absolute; left: 50%; top: 16%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 6px;
    font-family: system-ui, sans-serif; }
  #osd .zpravy div { background: rgba(10,14,20,0.72); padding: 7px 16px; border-radius: 8px; font-size: 16px; transition: opacity 0.4s; text-align: center; max-width: 80vw; }
  #osd .zpravy div.varovani { background: rgba(150,30,20,0.8); }
  #osd .panel { position: absolute; left: 12px; top: 44px; max-width: min(340px, 60vw); background: rgba(10,14,20,0.66); border-radius: 8px;
    padding: 8px 12px; font: 14px/1.45 system-ui, sans-serif; }
  #osd .panel:empty { display: none; }
  #osd .panel h3 { font-size: 13px; font-weight: 600; color: var(--akcent); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 2px; }
  #osd .blesk { position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; }
  #osd .foto { position: absolute; right: 14px; top: 44px; width: 200px; border: 3px solid #fff; box-shadow: 0 3px 14px rgba(0,0,0,0.5);
    transform: rotate(2deg); transition: opacity 0.5s, transform 0.5s; opacity: 0; }
  #osd .foto img { display: block; width: 100%; }
  #osd .foto div { background: #fff; color: #222; font: 12px system-ui, sans-serif; padding: 3px 6px; }
  #osd .nad { position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%); font: 600 clamp(28px, 6vw, 64px) system-ui, sans-serif;
    text-shadow: 0 2px 12px rgba(0,0,0,0.6); pointer-events: none; }
  #osd .skryto { display: none !important; }
  `;

  const el = (tag, cls, rodic, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (rodic) rodic.appendChild(e); return e; };
  const f1 = x => (Math.round(x * 10) / 10).toFixed(1);
  const mmss = s => { s = Math.max(0, s | 0); return String(s / 60 | 0).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const REZIMY = { gps: 'GPS', uhel: 'ANGLE', horizont: 'HORIZON', acro: 'ACRO' };
  const REZIMY_CZ = { gps: 'GPS', uhel: 'Úhel', horizont: 'Horizont', acro: 'Acro' };

  let koren, fpv, hud, mm, mmCv, mmZaklad, hor, horCx, zpravy, panel, blesk, foto, nad, ram, tretiny;
  let r = {};            // řádky FPV
  let h = {};            // hodnoty HUD
  let cas10 = 0;

  // minimapa: stínovaný reliéf + barvy povrchu, jednou při startu
  function zakladMapy(t) {
    const N = 512, cv = document.createElement('canvas'); cv.width = cv.height = N;
    const g = cv.getContext('2d'), img = g.createImageData(N, N), m = [0, 0, 0, 0], k = t.velikost / N;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = -t.velikost / 2 + (i + 0.5) * k, z = -t.velikost / 2 + (j + 0.5) * k;
      const hx = t.vyska(x + k, z) - t.vyska(x - k, z), hz = t.vyska(x, z + k) - t.vyska(x, z - k);
      const sv = D.clamp(0.75 + (-hx * 0.6 - hz * 0.8) / (2 * k), 0.35, 1.25);
      t.maska(x, z, m);
      let c = [118, 150, 82];
      const les = m[0] / 255, pole = m[1] / 255, cesta = m[2] / 255;
      c = c.map((v, n) => v + ([52, 82, 44][n] - v) * les);
      c = c.map((v, n) => v + ([196, 178, 112][n] - v) * pole * 0.8);
      c = c.map((v, n) => v + ([200, 196, 184][n] - v) * cesta);
      if (t.hladina(x, z) > t.vyska(x, z)) c = [64, 104, 140];
      const o = (j * N + i) * 4;
      img.data[o] = c[0] * sv; img.data[o + 1] = c[1] * sv; img.data[o + 2] = c[2] * sv; img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    for (const s of t.stavby || []) { g.fillStyle = s.typ === 'kostel' || s.typ === 'vez' ? '#f3ecd8' : '#c8705a'; g.fillRect((s.x / k + N / 2) - 1.5, (s.z / k + N / 2) - 1.5, 3, 3); }
    return cv;
  }

  function kresliMapu(ctx) {
    const g = mmCv.getContext('2d'), W = mmCv.width, t = ctx.teren, d = ctx.dron;
    const mer = 1.4;                                      // px minimapy na px základu (≈ 600 m průměr)
    const k = t.velikost / mmZaklad.width;
    const yaw = D.yawZQ(d.q);
    g.save(); g.clearRect(0, 0, W, W); g.translate(W / 2, W / 2);
    g.rotate(yaw);                                        // mapa se točí, nos dronu míří nahoru
    g.scale(mer, mer);
    g.translate(-(d.p[0] / k + mmZaklad.width / 2), -(d.p[2] / k + mmZaklad.width / 2));
    g.drawImage(mmZaklad, 0, 0);
    const bod = (x, z) => [x / k + mmZaklad.width / 2, z / k + mmZaklad.width / 2];
    // domov
    const s = t.start, [hx, hz] = bod(s.x, s.z);
    g.fillStyle = '#ffd34d'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.beginPath(); g.arc(hx, hz, 5, 0, 7); g.fill(); g.fillStyle = '#000'; g.fillText('H', hx, hz + 0.5);
    // cíle mise
    const cile = D.mise && D.mise.cileNaMape ? D.mise.cileNaMape() : [];
    for (const c of cile) { const [cx, cz] = bod(c.x, c.z); g.strokeStyle = c.barva || '#7fd1ff'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cz, 4, 0, 7); g.stroke(); }
    g.restore();
    // dron uprostřed
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(W / 2, W / 2 - 8); g.lineTo(W / 2 + 6, W / 2 + 6); g.lineTo(W / 2, W / 2 + 3); g.lineTo(W / 2 - 6, W / 2 + 6); g.closePath(); g.fill(); g.stroke();
  }

  function kresliHorizont(ctx) {
    const W = hor.width, H = hor.height, g = horCx, d = ctx.dron, kam = ctx.kamera;
    g.clearRect(0, 0, W, H);
    // pozice horizontu z pohledu kamery: promítneme bod daleko ve směru kurzu ve výšce kamery
    const yaw = D.yawZQ(d.q);
    const p = new THREE.Vector3(kam.position.x - Math.sin(yaw) * 1000, kam.position.y, kam.position.z - Math.cos(yaw) * 1000).project(kam);
    const p2 = new THREE.Vector3(kam.position.x - Math.sin(yaw) * 1000 + Math.cos(yaw) * 200, kam.position.y, kam.position.z - Math.cos(yaw) * 1000 - Math.sin(yaw) * 200).project(kam);
    if (p.z > 1 || p2.z > 1) return;
    const ax = (p.x * 0.5 + 0.5) * W, ay = (-p.y * 0.5 + 0.5) * H, bx = (p2.x * 0.5 + 0.5) * W, by = (-p2.y * 0.5 + 0.5) * H;
    const ux = bx - ax, uy = by - ay, l = Math.hypot(ux, uy) || 1, L = W * 0.16;
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.shadowColor = '#000'; g.shadowBlur = 3;
    g.beginPath();
    g.moveTo(ax - ux / l * L, ay - uy / l * L); g.lineTo(ax - ux / l * L * 0.35, ay - uy / l * L * 0.35);
    g.moveTo(ax + ux / l * L * 0.35, ay + uy / l * L * 0.35); g.lineTo(ax + ux / l * L, ay + uy / l * L);
    g.stroke();
    // zaměřovač uprostřed
    g.beginPath(); g.moveTo(W / 2 - 14, H / 2); g.lineTo(W / 2 - 5, H / 2); g.moveTo(W / 2 + 5, H / 2); g.lineTo(W / 2 + 14, H / 2);
    g.moveTo(W / 2, H / 2 - 5); g.lineTo(W / 2, H / 2 - 10); g.stroke();
  }

  function rozmer() {
    if (!hor) return;
    hor.width = koren.clientWidth; hor.height = koren.clientHeight;
  }

  function sipkaDomu(ctx) {
    const d = ctx.dron, s = ctx.teren.start, yaw = D.yawZQ(d.q);
    const uhel = Math.atan2(-(s.x - d.p[0]), -(s.z - d.p[2]));    // kurz k domovu
    let rel = uhel - yaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    const sip = ['↑', '↖', '←', '↙', '↓', '↘', '→', '↗'];
    return sip[((Math.round(rel / (Math.PI / 4)) % 8) + 8) % 8];
  }

  D.osd = {
    // krátká zpráva uprostřed nahoře
    zprava(text, trvani = 2.5, varovani = false) {
      if (!zpravy) return;
      const z = el('div', varovani ? 'varovani' : '', zpravy); z.textContent = text;
      setTimeout(() => { z.style.opacity = 0; setTimeout(() => z.remove(), 450); }, trvani * 1000);
      while (zpravy.children.length > 3) zpravy.firstChild.remove();
    },
    // panel mise vlevo nahoře (HTML), prázdný řetězec = skrýt
    panel(html) { if (panel) panel.innerHTML = html || ''; },
    // velký nápis uprostřed (odpočet), prázdný = skrýt
    nadpis(text) { if (nad) nad.textContent = text || ''; },
    zobrazeno: true,
    prepni() { this.zobrazeno = !this.zobrazeno; koren.classList.toggle('skryto', !this.zobrazeno); },
    // snímek z kamery (synchronně po vykreslení, bez preserveDrawingBuffer)
    vyfot(ctx, popisek) {
      ctx.vykresli();
      let url = '';
      try { url = ctx.renderer.domElement.toDataURL('image/jpeg', 0.88); } catch (e) { /* nevadí */ }
      blesk.style.transition = 'none'; blesk.style.opacity = 0.75;
      requestAnimationFrame(() => { blesk.style.transition = 'opacity 0.5s'; blesk.style.opacity = 0; });
      if (url) {
        foto.innerHTML = ''; el('img', '', foto).src = url; if (popisek) el('div', '', foto).textContent = popisek;
        foto.style.opacity = 1; foto.style.transform = 'rotate(2deg)';
        clearTimeout(this._t); this._t = setTimeout(() => { foto.style.opacity = 0; foto.style.transform = 'rotate(6deg) translateY(20px)'; }, 3500);
      }
      return url;
    },
  };

  D.modul('osd', {
    poradi: 95,
    popis: 'přístroje',
    init(ctx) {
      const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
      koren = document.getElementById('osd');
      // FPV
      fpv = el('div', 'fpv o-stin', koren);
      hor = el('canvas', '', fpv); horCx = hor.getContext('2d'); hor.style.cssText = 'left:0;top:0;width:100%;height:100%';
      const R = (k, css) => { r[k] = el('div', 'r', fpv); r[k].style.cssText = css; };
      R('napeti', 'left:6%;bottom:9%'); R('cas', 'right:6%;bottom:9%'); R('rezim', 'left:50%;bottom:9%;transform:translateX(-50%)');
      R('vyska', 'right:7%;top:50%;transform:translateY(-50%)'); R('rychlost', 'left:7%;top:50%;transform:translateY(-50%)');
      R('domu', 'left:50%;top:8%;transform:translateX(-50%)'); R('varov', 'left:50%;top:62%;transform:translateX(-50%);color:#ff5a4a');
      R('proud', 'left:6%;bottom:14%'); R('mah', 'right:6%;bottom:14%');
      // HUD kamerového dronu
      hud = el('div', 'hud', koren);
      const lista = el('div', 'lista', hud);
      h.rezim = el('span', '', lista); h.baterie = el('span', '', lista); h.signal = el('span', '', lista, '📶 <b>100 %</b>'); h.kamera = el('span', '', lista);
      h.cas = el('span', '', lista); h.cas.style.marginLeft = 'auto';
      const dole = el('div', 'dole', hud);
      const H = (k, popis) => { const b = el('div', '', dole); el('small', '', b, popis); h[k] = el('span', '', b); };
      H('H', 'VÝŠKA'); H('D', 'VZDÁLENOST'); H('HS', 'RYCHLOST'); H('VS', 'STOUPÁNÍ');
      ram = el('div', 'ram', hud, '<i></i><i></i><i></i><i></i>');
      tretiny = el('div', 'tretiny skryto', hud);
      // minimapa
      mm = el('div', 'mm', koren); mmCv = el('canvas', '', mm); mmCv.width = mmCv.height = 150; mmCv.style.cssText = 'left:0;top:0;width:100%;height:100%';
      try { mmZaklad = zakladMapy(ctx.teren); } catch (e) { console.error(e); mmZaklad = document.createElement('canvas'); }
      // společné
      panel = el('div', 'panel', koren); zpravy = el('div', 'zpravy', koren); nad = el('div', 'nad o-stin', koren);
      blesk = el('div', 'blesk', koren); foto = el('div', 'foto', koren);
      rozmer(); D.na('rozmer', rozmer);
      D.na('naraz', e => { if (e && e.sila > 3) D.osd.zprava('Náraz ' + f1(e.sila) + ' m/s', 1.6, e.sila > 6); });
      D.na('havarie', e => D.osd.zprava('Havárie' + (e && e.duvod ? ': ' + e.duvod : '') + ' — R = znovu', 5, true));
      D.na('pristani', () => D.osd.zprava('Přistáno', 1.5));
      D.na('rezim', () => { if (ctx.dron) D.osd.zprava('Režim: ' + (REZIMY_CZ[ctx.dron.rezim] || ctx.dron.rezim), 1.5); });
      D.na('kamera', () => setTimeout(() => D.osd.zprava('Kamera: ' + ({ fpv: 'FPV', chase: 'za dronem', gimbal: 'gimbal', los: 'pilot na zemi' }[ctx.kam.rezim] || ctx.kam.rezim), 1.2), 0));
      if (D.param.osd === '0' || D.param.pohled) koren.classList.add('skryto');
    },
    update(ctx, dt) {
      if (!koren || koren.classList.contains('skryto')) return;
      const d = ctx.dron, rez = ctx.kam.rezim;
      const vMenu = rez === 'volna' || (D.ui && D.ui.otevreno());
      for (const e of [fpv, hud, mm]) if (vMenu) e.classList.add('skryto');
      if (vMenu) return;
      const jeFPV = rez === 'fpv', jeHud = rez === 'gimbal' || rez === 'chase', jeLos = rez === 'los';
      fpv.classList.toggle('skryto', !jeFPV);
      hud.classList.toggle('skryto', !jeHud);
      ram.classList.toggle('skryto', rez !== 'gimbal');
      tretiny.classList.toggle('skryto', !(rez === 'gimbal' && ctx.nastaveni.tretiny));
      mm.classList.toggle('skryto', jeLos || (jeFPV && !ctx.nastaveni.mapaFPV));
      if (jeFPV) kresliHorizont(ctx);
      cas10 += dt || 0.016; if (cas10 < 0.1) return; cas10 = 0;

      const zem = ctx.teren.vyska(d.p[0], d.p[2]);
      const vyska = d.vyskaNadZemi != null ? d.vyskaNadZemi : d.p[1] - zem;
      const vyskaStart = d.p[1] - ctx.teren.start.y;
      const rychl = d.rychlost != null ? d.rychlost : Math.hypot(d.v[0], d.v[2]);
      const vs = d.vertikalni != null ? d.vertikalni : d.v[1];
      const dist = Math.hypot(d.p[0] - ctx.teren.start.x, d.p[2] - ctx.teren.start.z);
      const bat = d.baterie || { procent: 100, napeti: 16.8, clanky: 4 };
      const casLetu = d.casLetu != null ? d.casLetu : d.cas;
      const varovani = [];
      if (bat.procent < 20) varovani.push(bat.procent < 10 ? 'BATERIE KRITICKÁ' : 'SLABÁ BATERIE');
      if (!d.armed && d.stav !== 'havarie') varovani.push('DISARMED');
      if (d.stav === 'havarie') varovani.push('HAVÁRIE');
      if (jeFPV) {
        r.napeti.textContent = '⚡' + bat.napeti.toFixed(1) + 'V ' + (bat.napeti / (bat.clanky || 4)).toFixed(2);
        r.cas.textContent = mmss(casLetu);
        r.rezim.textContent = (REZIMY[d.rezim] || d.rezim) + (d.sport ? ' S' : '');
        r.vyska.textContent = Math.round(vyskaStart) + ' m';
        r.rychlost.textContent = Math.round(rychl * 3.6) + ' km/h';
        r.domu.textContent = sipkaDomu(ctx) + ' ' + Math.round(dist) + ' m';
        r.proud.textContent = d.proudA != null ? Math.round(d.proudA) + ' A' : '';
        r.mah.textContent = bat.spotrebaMah != null ? Math.round(bat.spotrebaMah) + ' mAh' : Math.round(bat.procent) + ' %';
        r.varov.textContent = varovani.join('  ');
      } else if (jeHud) {
        h.rezim.innerHTML = '<b>' + (REZIMY_CZ[d.rezim] || d.rezim) + (d.sport ? ' · Sport' : '') + '</b>' + (d.armed ? '' : ' · <span style="color:#ffb35a">motory stojí</span>');
        const bc = bat.procent < 20 ? '#ff6a5a' : bat.procent < 35 ? '#ffd34d' : '#9cf59c';
        h.baterie.innerHTML = '🔋 <b style="color:' + bc + '">' + Math.round(bat.procent) + ' %</b>';
        h.kamera.textContent = rez === 'gimbal' ? '🎥 ' + Math.round(-ctx.kam.gimbalNaklon) + '°' : '';
        h.cas.textContent = mmss(casLetu);
        h.H.textContent = f1(vyskaStart) + ' m'; h.D.textContent = Math.round(dist) + ' m';
        h.HS.textContent = f1(rychl) + ' m/s'; h.VS.textContent = f1(vs) + ' m/s';
        h.H.style.color = vyska < 2 && !d.naZemi ? '#ffd34d' : '';
      }
      if (!mm.classList.contains('skryto')) kresliMapu(ctx);
      // varování jako zpráva jednou za čas (HUD)
      if (!jeFPV && bat.procent < 20 && !this._bat) { this._bat = true; D.osd.zprava(bat.procent < 10 ? 'Baterie je kritická — přistaň!' : 'Slabá baterie — vrať se domů', 4, true); }
    },
  });
})(globalThis.DRON = globalThis.DRON || {});
