/* Fotodokumentace – syntetické fotky modelového případu 17/2026 (kresba na plátně, žádné cizí obrázky)
   s předpřipravenými anotacemi napojenými na stopy 1–4 modelového spisu (id model-17-stopa-N).
   window.FOTODOK_UKAZKA = { fotky: [{ id, nazev, typ, popis, kdy, autor, w, h, kresli(ctx), anotace, meritko }] }
   Data (bez kreslení) jdou načíst i v node – test ověřuje stopy a změřené délky. */
(function (koren) {
  'use strict';
  const STOPA = c => 'model-17-stopa-' + c;
  const AUTOR = 'prap. Petr Ukázkový (fiktivní)';
  const W = 1200, H = 800;

  /* ---------- pomůcky kresby ---------- */
  function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
  function mnohouhelnik(ctx, body, vypln, obrys, lw) {
    ctx.beginPath(); body.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
    if (vypln) { ctx.fillStyle = vypln; ctx.fill(); }
    if (obrys) { ctx.strokeStyle = obrys; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  function obdelnik(ctx, x, y, w, h, f) { ctx.fillStyle = f; ctx.fillRect(x, y, w, h); }
  // primitiva FOTOMER (mm, y dolů) → plátno s měřítkem k px/mm, počátek ox, oy
  function kresliPrvky(ctx, prvky, k, ox, oy) {
    const X = v => ox + v * k, Y = v => oy + v * k;
    for (const q of prvky) {
      ctx.lineWidth = Math.max(0.6, (q.lw || 0.2) * k);
      if (q.t === 'r') { if (q.f) obdelnik(ctx, X(q.x), Y(q.y), q.w * k, q.h * k, q.f); if (q.s) { ctx.strokeStyle = q.s; ctx.strokeRect(X(q.x), Y(q.y), q.w * k, q.h * k); } }
      else if (q.t === 'l') { ctx.strokeStyle = q.s; ctx.beginPath(); ctx.moveTo(X(q.x1), Y(q.y1)); ctx.lineTo(X(q.x2), Y(q.y2)); ctx.stroke(); }
      else if (q.t === 'c') { ctx.beginPath(); ctx.arc(X(q.x), Y(q.y), q.r * k, 0, 7); if (q.f) { ctx.fillStyle = q.f; ctx.fill(); } if (q.s) { ctx.strokeStyle = q.s; ctx.stroke(); } }
      else if (q.t === 'p') mnohouhelnik(ctx, q.b.map(([a, b]) => [X(a), Y(b)]), q.f, q.s, ctx.lineWidth);
      else if (q.t === 'x') {
        ctx.save(); ctx.translate(X(q.x), Y(q.y)); if (q.rot) ctx.rotate(-q.rot * Math.PI / 180);
        ctx.fillStyle = q.f; ctx.font = (q.b ? 'bold ' : '') + (q.v * k) + 'px Arial, sans-serif';
        ctx.textAlign = q.a === 'l' ? 'left' : q.a === 'r' ? 'right' : 'center'; ctx.fillText(q.s, 0, 0); ctx.restore();
      }
    }
  }
  function sum(ctx, n, seed, alfa) {
    const r = rng(seed);
    for (let i = 0; i < n; i++) { ctx.fillStyle = `rgba(${r() < .5 ? '0,0,0' : '255,255,255'},${alfa})`; ctx.fillRect(r() * W, r() * H, 2, 2); }
  }

  /* ---------- 1: přehled – prodejna z ulice ---------- */
  function kresli1(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, 200); g.addColorStop(0, '#9fb8cf'); g.addColorStop(1, '#d6dde3');
    obdelnik(ctx, 0, 0, W, 200, g);
    obdelnik(ctx, 0, 60, W, 520, '#c9b79c');                       // fasáda
    for (let y = 80; y < 580; y += 26) { ctx.fillStyle = 'rgba(0,0,0,.035)'; ctx.fillRect(0, y, W, 2); }
    obdelnik(ctx, 120, 110, 960, 70, '#24476b');                   // štít
    ctx.fillStyle = '#f4f1e8'; ctx.font = 'bold 46px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('ELEKTRO NOVOTNÝ', 600, 162);
    ctx.font = '22px Arial, sans-serif'; ctx.fillStyle = '#3b2f22'; ctx.fillText('Hlavní 17', 1130, 240);
    // levá výloha (celá), dveře, pravá výloha (rozbitá)
    obdelnik(ctx, 120, 220, 330, 300, '#5e6f7d'); obdelnik(ctx, 130, 230, 310, 280, '#7f95a6');
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.moveTo(150, 500); ctx.lineTo(260, 240); ctx.lineTo(300, 240); ctx.lineTo(190, 500); ctx.fill();
    obdelnik(ctx, 500, 220, 170, 340, '#4a3a2c'); obdelnik(ctx, 515, 235, 140, 150, '#7f95a6'); ctx.fillStyle = '#c8a24a'; ctx.fillRect(640, 400, 18, 8);
    obdelnik(ctx, 720, 220, 360, 300, '#5e6f7d'); obdelnik(ctx, 730, 230, 340, 280, '#7f95a6');
    const dira = [[800, 300], [850, 268], [905, 292], [960, 262], [1005, 318], [990, 380], [1020, 430], [950, 470], [880, 448], [820, 470], [790, 410], [812, 360]];
    mnohouhelnik(ctx, dira, '#1d2228', '#e8eef2', 3);
    ctx.strokeStyle = '#dfe7ec'; ctx.lineWidth = 1.5;
    for (const [a, b] of [[[800, 300], [740, 240]], [[960, 262], [1000, 232]], [[1020, 430], [1066, 500]], [[820, 470], [760, 505]], [[1005, 318], [1068, 300]]]) { ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); }
    // chodník, obrubník, silnice
    obdelnik(ctx, 0, 580, W, 120, '#a9a59d');
    for (let x = -40; x < W; x += 90) { ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 700); ctx.lineTo(x + 40, 580); ctx.stroke(); }
    obdelnik(ctx, 0, 696, W, 12, '#d8d4cb'); obdelnik(ctx, 0, 708, W, 92, '#4f5257');
    // střepy na chodníku pod výlohou
    const r = rng(5);
    for (let i = 0; i < 26; i++) { const x = 760 + r() * 280, y = 590 + r() * 50; mnohouhelnik(ctx, [[x, y], [x + 6 + r() * 10, y + r() * 4], [x + r() * 8, y + 5 + r() * 6]], 'rgba(220,235,240,.9)'); }
    // nedopalek u vchodu
    obdelnik(ctx, 560, 640, 22, 6, '#f2efe6'); obdelnik(ctx, 582, 640, 8, 6, '#c98b45');
    // zaparkované auto se SPZ
    mnohouhelnik(ctx, [[30, 760], [40, 700], [110, 690], [170, 640], [330, 636], [400, 690], [470, 700], [480, 760]], '#7a1f24', '#3a0d10', 2);
    mnohouhelnik(ctx, [[185, 650], [320, 648], [370, 690], [140, 692]], '#9fb4c4');
    for (const x of [120, 390]) { ctx.beginPath(); ctx.arc(x, 762, 34, 0, 7); ctx.fillStyle = '#1b1b1b'; ctx.fill(); ctx.beginPath(); ctx.arc(x, 762, 14, 0, 7); ctx.fillStyle = '#9a9a9a'; ctx.fill(); }
    obdelnik(ctx, 410, 718, 62, 20, '#f6f6f2'); obdelnik(ctx, 410, 718, 8, 20, '#1d4fa0');
    ctx.fillStyle = '#111'; ctx.font = 'bold 13px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('4HL 2158', 446, 733);
    sum(ctx, 9000, 11, 0.05);
  }

  /* ---------- 2: detail – střepy s krevní stopou (měřítko 2 px/mm) ---------- */
  function kresli2(ctx) {
    obdelnik(ctx, 0, 0, W, H, '#b9b2a6');
    ctx.strokeStyle = 'rgba(70,60,50,.35)'; ctx.lineWidth = 3;
    for (let x = 100; x < W; x += 600) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 200; y < H; y += 600) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    const r = rng(9);
    for (let i = 0; i < 40; i++) {
      const x = 80 + r() * 1040, y = 60 + r() * 520, s = 14 + r() * 60;
      mnohouhelnik(ctx, [[x, y], [x + s, y + r() * s * .4], [x + s * (.3 + r() * .5), y + s * (.6 + r() * .5)], [x - s * .2, y + s * .5]], 'rgba(214,232,236,.75)', 'rgba(255,255,255,.9)', 1.5);
    }
    // velký střep s krví
    mnohouhelnik(ctx, [[520, 250], [700, 230], [760, 360], [610, 420], [500, 360]], 'rgba(214,232,236,.8)', '#ffffff', 2);
    ctx.fillStyle = '#7d0f12'; ctx.beginPath(); ctx.ellipse(640, 320, 34, 20, -0.4, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(690, 300, 9, 6, -0.4, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(602, 345, 6, 4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#a3161b'; ctx.beginPath(); ctx.ellipse(636, 316, 18, 9, -0.4, 0, 7); ctx.fill();
    // přímé pravítko 15 cm (2 px/mm) pod střepem
    const F = koren.FOTOMER;
    if (F) kresliPrvky(ctx, F.pravitko({ od: 0, do: 150, sirka: 22 }).prvky, 2, 400, 600);
    sum(ctx, 9000, 21, 0.06);
  }

  /* ---------- 3: detail – šlápěcí stopa s L-měřítkem (2 px/mm) ---------- */
  const PODRAZKA = { x0: 300, x1: 890, y: 380 };   // délka 590 px = 295 mm
  function kresli3(ctx) {
    obdelnik(ctx, 0, 0, W, H, '#8f8b84');
    const r = rng(3);
    for (let i = 0; i < 6000; i++) { ctx.fillStyle = `rgba(${200 + r() * 40},${195 + r() * 40},${185 + r() * 40},.18)`; ctx.fillRect(r() * W, r() * H, 3, 3); }
    // podrážka: prašný otisk se vzorkem
    const { x0, x1, y } = PODRAZKA, L = x1 - x0;
    ctx.save(); ctx.beginPath();
    ctx.ellipse(x0 + L * 0.72, y, L * 0.28, 100, 0, 0, 7);
    ctx.ellipse(x0 + L * 0.17, y, L * 0.17, 76, 0, 0, 7);
    ctx.rect(x0 + L * 0.2, y - 56, L * 0.35, 112);
    ctx.fillStyle = 'rgba(236,232,224,.55)'; ctx.fill(); ctx.clip();
    ctx.strokeStyle = 'rgba(70,64,58,.75)'; ctx.lineWidth = 7;
    for (let x = x0 - 40; x < x1 + 40; x += 24) { ctx.beginPath(); ctx.moveTo(x, y - 100); ctx.lineTo(x + 30, y); ctx.lineTo(x, y + 100); ctx.stroke(); }
    ctx.restore();
    // L-měřítko 100 mm vlevo dole: roh (počátek stupnic) v bodě [x, y] obrázku
    const F = koren.FOTOMER;
    if (F) { const m = F.meritkoL({ rameno: 100, sirka: 25, popisek: '17/2026 · stopa 2' }); kresliPrvky(ctx, m.prvky, 2, MERITKO3.ox, MERITKO3.oy); }
    sum(ctx, 9000, 31, 0.05);
  }
  // L-měřítko: šířka/výška 106 mm, počátek stupnic v levém dolním rohu (0, 106) → obrázek ox, oy + 212
  const MERITKO3 = { ox: 300, oy: 520 };
  const nula3 = [MERITKO3.ox, MERITKO3.oy + 106 * 2];

  /* ---------- 4: orientační – páčidlo na dvoře (perspektiva) ---------- */
  // rovina dvora v mm (X doprava, Y od fotografa) → obrázek; homografie ze 4 dvojic
  const ROVINA = [[0, 0], [2000, 0], [2000, 2000], [0, 2000]], OBRAZ = [[250, 780], [1050, 780], [860, 420], [400, 420]];
  let J = null, H4 = null;
  function do4(x, y) {
    if (!H4) { J = koren.FOTODOK || require('./jadro.js'); H4 = J.homografie(ROVINA, OBRAZ); }
    return J.aplikujH(H4, x, y).map(v => Math.round(v * 10) / 10);
  }
  const PACIDLO = [[700, 600], [700 + 600 * Math.cos(20 * Math.PI / 180), 600 + 600 * Math.sin(20 * Math.PI / 180)]];
  function kresli4(ctx) {
    obdelnik(ctx, 0, 0, W, H, '#8d877d');
    obdelnik(ctx, 0, 0, W, 330, '#b9a68a');                        // zeď dvora
    for (let y = 20; y < 330; y += 30) for (let x = (y / 30 % 2) * 40; x < W; x += 80) { ctx.strokeStyle = 'rgba(90,70,50,.3)'; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, 80, 30); }
    // popelnice u zdi
    for (const [x, f] of [[160, '#2f5d34'], [300, '#3a3d42'], [930, '#2d4f86']]) { obdelnik(ctx, x, 210, 110, 160, f); obdelnik(ctx, x - 6, 200, 122, 18, f); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + 8, 230, 6, 130); }
    // dlažba 500 × 500 mm
    ctx.save(); ctx.beginPath(); ctx.rect(0, 330, W, H - 330); ctx.clip();
    obdelnik(ctx, 0, 330, W, H, '#9c968c');
    ctx.strokeStyle = '#5f5a52'; ctx.lineWidth = 2;
    for (let X = -3000; X <= 5000; X += 500) { const a = do4(X, -600), b = do4(X, 6000); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); }
    for (let Y = -500; Y <= 6000; Y += 500) { const a = do4(-3000, Y), b = do4(5000, Y); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); }
    ctx.restore();
    // páčidlo: tyč + zahnuté konce
    const [a, b] = PACIDLO.map(p => do4(p[0], p[1]));
    ctx.lineCap = 'round'; ctx.strokeStyle = '#1e2a3a'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
    ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(...b); ctx.quadraticCurveTo(b[0] + 18, b[1] - 4, b[0] + 16, b[1] - 22); ctx.stroke();
    ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(a[0] - 10, a[1] + 8); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a[0], a[1] - 3); ctx.lineTo(b[0], b[1] - 3); ctx.stroke();
    ctx.lineCap = 'butt';
    sum(ctx, 9000, 41, 0.05);
  }

  /* ---------- fotky s anotacemi ---------- */
  const z = (id, x, y, c) => ({ id, druh: 'znacka', b: [[x, y]], stopa: STOPA(c), cislo: String(c) });
  const blok = [[500, 500], [1500, 500], [1500, 1500], [500, 1500]];
  const fotky = [
    { id: 'model-17-foto-1', nazev: 'Prodejna z ulice – přehled', typ: 'prehled', kdy: '2026-11-15T08:36', autor: AUTOR, w: W, h: H, kresli: kresli1,
      popis: 'Přehledový snímek průčelí prodejny Elektro Novotný z protějšího chodníku. Pravá výloha rozbita, střepy na chodníku i uvnitř; u vchodu nedopalek.',
      anotace: [z('m1z1', 905, 365, 1), z('m1z4', 571, 615, 4),
        { id: 'm1s1', druh: 'sipka', b: [[1120, 470], [1030, 420]] },
        { id: 'm1t1', druh: 'text', b: [[1000, 560]], text: 'rozbitá výloha' },
        { id: 'm1k1', druh: 'kruh', b: [[535, 620], [612, 664]] },
        { id: 'm1zk', druh: 'zakryt', b: [[404, 712], [478, 744]], efekt: 'pixely' }] },
    { id: 'model-17-foto-2', nazev: 'Střepy s krevní stopou – detail', typ: 'detail', kdy: '2026-11-15T08:52', autor: AUTOR, w: W, h: H, kresli: kresli2,
      popis: 'Detail střepů pod výlohou (vnitřní strana) s krevní stopou na největším střepu; pravítko v rovině podlahy.',
      meritko: { druh: 'delka', b: [[408, 600], [708, 600]], mm: 150, presnost: 1.5 },
      anotace: [z('m2z1', 560, 220, 1),
        { id: 'm2v1', druh: 'vyrez', b: [[590, 285], [700, 355], [930, 160]], k: 2.6 },
        { id: 'm2d1', druh: 'delka', b: [[606, 340], [674, 300]] }] },
    { id: 'model-17-foto-3', nazev: 'Šlápěcí stopa obuvi s měřítkem – detail', typ: 'detail', kdy: '2026-11-15T09:14', autor: AUTOR, w: W, h: H, kresli: kresli3,
      popis: 'Prašná šlápěcí stopa na prodejní ploše 1,8 m od výlohy. L-měřítko v rovině stopy, snímáno kolmo shora.',
      meritko: { druh: 'delka', b: [nula3, [nula3[0] + 200, nula3[1]]], mm: 100, presnost: 1.5 },
      anotace: [z('m3z2', 960, 230, 2),
        { id: 'm3d1', druh: 'delka', b: [[PODRAZKA.x0, 260], [PODRAZKA.x1, 260]] },
        { id: 'm3d2', druh: 'delka', b: [[PODRAZKA.x0 + 590 * 0.72, PODRAZKA.y - 100], [PODRAZKA.x0 + 590 * 0.72, PODRAZKA.y + 100]] }] },
    { id: 'model-17-foto-4', nazev: 'Páčidlo na dvoře – orientační', typ: 'orientacni', kdy: '2026-11-15T09:31', autor: AUTOR, w: W, h: H, kresli: kresli4,
      popis: 'Odhozené páčidlo na dlažbě dvora za prodejnou u popelnic. Měřítko: blok 2 × 2 dlaždic 1000 × 1000 mm (srovnání perspektivy).',
      get meritko() { return { druh: 'obdelnik', b: blok.map(p => do4(p[0], p[1])), w: 1000, h: 1000, presnost: 1.5 }; },
      get anotace() {
        const [a, b] = PACIDLO.map(p => do4(p[0], p[1]));
        return [z('m4z3', b[0] + 40, b[1] - 50, 3),
          { id: 'm4s1', druh: 'sipka', b: [[a[0] - 120, a[1] + 60], [a[0] - 14, a[1] + 8]] },
          { id: 'm4t1', druh: 'text', b: [[a[0] - 330, a[1] + 90]], text: 'páčidlo (stopa 3)' },
          { id: 'm4d1', druh: 'delka', b: [a, b] }];
      } }
  ];

  /* modelové fotky nemají skutečný EXIF – ohnisko (ekv. 35 mm) je zapsané ručně, ať náčrt umí nakreslit kužel záběru
     fotopozice F1–F4 (S5); přístroj to říká otevřeně */
  const EXIF = { foto1: 35, foto2: 50, foto3: 50, foto4: 28 };
  fotky.forEach((f, i) => { f.exif = { pristroj: 'modelová kresba (ohnisko doplněno ručně)', ohnisko35: EXIF['foto' + (i + 1)] }; });

  /* založí ukázkové fotky do spisu případu (jen chybějící – nic nezdvojí ani neobnoví smazané); vrátí počet přidaných.
     S = SPIS, J = FOTODOK (jádro). Kreslí na plátno → jen v prohlížeči. Používá ji Fotodokumentace i Náčrt (S5). */
  async function zaloz(S, J, pripad) {
    let pridano = 0;
    for (const [i, f] of fotky.entries()) {
      if (await S.entita(f.id)) continue;
      const c = document.createElement('canvas'); c.width = f.w; c.height = f.h;
      f.kresli(c.getContext('2d'));
      const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.9));
      const s = await S.ulozSoubor(blob, { nazev: f.id + '.jpg', pripad });
      const e = await S.uloz({ id: f.id, pripad, typ: 'foto', nazev: f.nazev, data: { soubor: s.id, sha256: s.sha256, typ: f.typ, popis: f.popis, kdy: f.kdy,
        autor: f.autor, poradi: i + 1, w: f.w, h: f.h, exif: f.exif, anotace: J.cisti(f.anotace), meritko: f.meritko } }, { nastroj: J.NASTROJ });
      await J.synchronizujVazby(S, e, e.data.anotace, J.NASTROJ);
      pridano++;
    }
    return pridano;
  }

  const API = { fotky, kresliPrvky, PACIDLO, PODRAZKA, zaloz };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else koren.FOTODOK_UKAZKA = API;
})(typeof window !== 'undefined' ? window : globalThis);
