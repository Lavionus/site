// Nad krajinou — vegetace: lesy a solitérní stromy, keře, tráva, polní plodiny, kapradí, rákos,
// květiny a kameny. Vlastník: VEGETACE. Smlouva rozhraní viz Dron_PLAN.md.
//
// Jak to funguje:
//  • Textury: listí, jehličí a kůra se při startu namalují na plátno do jednoho atlasu (2048×1280),
//    průhledné okraje se „rozlijí“ průměrnou barvou buňky (žádné tmavé lemy v mipmapách). Nic se nestahuje.
//  • Stromy: procedurální modely každého druhu z D.STROMY ve dvou úrovních detailu. Kmen a větve jsou
//    trubky s kůrou, koruna jsou karty (shluky listí / větvičky jehličí) s normálami ohnutými ven
//    ze středu koruny (objem), zastíněním uvnitř a dole, prosvítáním proti slunci a barvou podle instance.
//  • Daleko impostory: každý druh se při startu vyrenderuje z 6×6 směrů nad polokoulí (hemi-oktaedrická
//    mřížka) do atlasu albeda a normál; impostor míchá 4 nejbližší pohledy a svítí se stejnou funkcí
//    jako 3D model, takže sedí ke slunci i při pohledu shora.
//  • LOD: mřížka buněk 64 m, přepočet seznamů jen když se kamera posune / otočí (ne každý snímek),
//    instance mimo rozšířený výhled se vynechají. Přechody LOD0 → LOD1 → impostor jsou rozpouštěné
//    (dither podle obrazovky) přímo v shaderech podle skutečné vzdálenosti, takže nic neskáče.
//    Impostory jsou statické bloky 1024 m (ořez frustem), blízké stromy samy skryjí.
//  • Tráva: dlaždice instancí kolem kamery (2 prstence), výška z mapy výšek, druh a hustota z masky
//    terénu (louka, pole s řádky, kapradí v lese, rákos u vody, květiny), vlny větru a proplach vrtulí.
//  • Kameny: data.objekty.kameny (nebo náhradní rozmístění), instancované deformované koule.
(function (D) {
  'use strict';
  if (typeof THREE === 'undefined') return;

  // ======================================================================
  // Nastavení
  // ======================================================================
  const BUNKA = 64;          // buňka mřížky pro výběr LOD (m)
  const BLOK = 1024;         // blok impostorů (m)
  const G = 6;               // impostor: G×G pohledů nad polokoulí
  const OKRAJ = 6;           // rezerva seznamů LOD (m) – o tolik se smí kamera posunout bez přepočtu
  const MAX_DALKA = 3600;    // impostory dál už nekreslit (opar)

  // r0 = konec LOD0, r1 = konec LOD1 (dál impostory), p0/p1 = šířka pásma prolnutí
  const NAST = [
    { r0: 0, p0: 8, r1: 140, p1: 24, imp: 64, ramce4: false, stinLod1: false, kamenyR: 160, kamenyBlizko: 0, trava: null },
    { r0: 55, p0: 10, r1: 190, p1: 30, imp: 96, ramce4: true, stinLod1: false, kamenyR: 220, kamenyBlizko: 40,
      trava: [{ rIn: 0, rOut: 10, s: 0.42, B: 6, S: 3, kvety: 2, T: 3, sir: 1.1 },
              { rIn: 10, rOut: 36, s: 1.15, B: 5, S: 2, kvety: 1, T: 4, sir: 2.3 }] },
    { r0: 85, p0: 12, r1: 270, p1: 36, imp: 112, ramce4: true, stinLod1: false, kamenyR: 300, kamenyBlizko: 60,
      trava: [{ rIn: 0, rOut: 14, s: 0.38, B: 7, S: 3, kvety: 2, T: 3, sir: 1 },
              { rIn: 14, rOut: 50, s: 1.0, B: 6, S: 2, kvety: 1, T: 4, sir: 2.2 }] },
    { r0: 130, p0: 15, r1: 380, p1: 44, imp: 128, ramce4: true, stinLod1: true, kamenyR: 400, kamenyBlizko: 90,
      trava: [{ rIn: 0, rOut: 20, s: 0.33, B: 7, S: 4, kvety: 2, T: 4, sir: 1 },
              { rIn: 20, rOut: 70, s: 0.9, B: 6, S: 2, kvety: 1, T: 4, sir: 2.1 }] },
  ];

  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  const hladce = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const vyber = (r, pole) => pole[Math.floor(r() * pole.length)];

  // malá vektorová pomůcka nad poli [x, y, z]
  const V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: a => Math.hypot(a[0], a[1], a[2]),
    norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    mix: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  };
  const nahodnyVektor = r => { let u; do { u = [r() * 2 - 1, r() * 2 - 1, r() * 2 - 1]; } while (V.len(u) > 1 || V.len(u) < 0.15); return V.norm(u); };

  // ======================================================================
  // Atlas textur (malovaný na plátno)
  // ======================================================================
  const ATL_W = 2048, ATL_H = 1280;
  const BUNKY = {
    kura_smrk: [0, 0, 256, 512], kura_bordol: [256, 0, 256, 512], kura_borhor: [512, 0, 256, 512],
    kura_buk: [768, 0, 256, 512], kura_briza: [1024, 0, 256, 512], kura_dub: [1280, 0, 256, 512],
    kura_vetev: [1536, 0, 256, 512],
    smrk_a: [0, 512, 256, 512], smrk_b: [256, 512, 256, 512],
    bor_a: [512, 512, 256, 512], bor_b: [768, 512, 256, 512],
    prut_a: [1024, 512, 256, 512], prut_b: [1280, 512, 256, 512],
    buk_a: [1536, 512, 256, 256], buk_b: [1792, 512, 256, 256], buk_c: [1536, 768, 256, 256], dub_c: [1792, 768, 256, 256],
    dub_a: [1792, 0, 256, 256], dub_b: [1792, 256, 256, 256],
    briza_a: [1536, 1024, 256, 256], briza_b: [1792, 1024, 256, 256],
    ker_a: [0, 1024, 256, 256], ker_b: [256, 1024, 256, 256],
  };
  const ATL = jm => { const b = BUNKY[jm]; return [b[0] / ATL_W, b[1] / ATL_H, b[2] / ATL_W, b[3] / ATL_H]; };

  function barva(hex, k) {
    const n = parseInt(hex.slice(1), 16); k = k == null ? 1 : k;
    return 'rgb(' + Math.min(255, ((n >> 16) & 255) * k | 0) + ',' + Math.min(255, ((n >> 8) & 255) * k | 0) + ',' + Math.min(255, (n & 255) * k | 0) + ')';
  }
  // vykreslení tvaru i s kopiemi přes okraj (dlaždicová kůra)
  function obtoc(w, h, x, y, m, fn) {
    const xs = [x], ys = [y];
    if (x < m) xs.push(x + w); if (x > w - m) xs.push(x - w);
    if (y < m) ys.push(y + h); if (y > h - m) ys.push(y - h);
    for (const a of xs) for (const b of ys) fn(a, b);
  }
  function elipsa(g, x, y, rx, ry, rot) { g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, 6.2832); g.fill(); }
  function zrno(g, w, h, r, n, barvy, vel) {
    for (let i = 0; i < n; i++) { g.fillStyle = vyber(r, barvy); g.fillRect(r() * w, r() * h, vel * (0.5 + r()), vel * (0.5 + r())); }
  }

  const KURA = {
    smrk(g, w, h, r) {
      g.fillStyle = '#56443a'; g.fillRect(0, 0, w, h);
      zrno(g, w, h, r, 2500, ['#4a3a30', '#65503f', '#5c4a3e', '#3f322a'], 3);
      const bb = ['#6e5646', '#4b3a2f', '#7d6553', '#5f4a3c', '#8a705c', '#54423a'];
      for (let i = 0; i < 950; i++) {
        const x = r() * w, y = r() * h, rx = 4 + r() * 6, ry = 2.5 + r() * 3.5, c = vyber(r, bb), rot = (r() - 0.5) * 0.4;
        obtoc(w, h, x, y, 14, (a, b) => { g.fillStyle = 'rgba(28,20,15,0.55)'; elipsa(g, a, b + 1.8, rx, ry, rot); g.fillStyle = c; elipsa(g, a, b, rx, ry, rot); });
      }
    },
    bordol(g, w, h, r) {
      g.fillStyle = '#211a15'; g.fillRect(0, 0, w, h);
      const bb = ['#5b4a3e', '#66543f', '#4f4036', '#6f5c4a', '#5e5048', '#73604d'];
      for (let i = 0; i < 300; i++) {
        const x = r() * w, y = r() * h, pw = 14 + r() * 26, ph = 26 + r() * 50, c = vyber(r, bb);
        obtoc(w, h, x, y, 60, (a, b) => {
          g.fillStyle = c; g.beginPath();
          g.moveTo(a + r() * 3, b); g.lineTo(a + pw - r() * 4, b + r() * 4); g.lineTo(a + pw - r() * 3, b + ph); g.lineTo(a + r() * 4, b + ph - r() * 4); g.closePath(); g.fill();
          g.fillStyle = 'rgba(160,140,120,0.18)'; g.fillRect(a + 2, b + 1, pw * 0.5, 2);
        });
      }
    },
    borhor(g, w, h, r) {
      g.fillStyle = '#b5693a'; g.fillRect(0, 0, w, h);
      zrno(g, w, h, r, 1500, ['#a85f33', '#c27443', '#9b5530'], 3);
      const bb = ['#c97c47', '#a55a2f', '#d9925c', '#9a5230', '#e0a070', '#b86a3a'];
      for (let i = 0; i < 650; i++) {
        const x = r() * w, y = r() * h, rx = 6 + r() * 12, ry = 1.8 + r() * 3.5, c = vyber(r, bb);
        obtoc(w, h, x, y, 20, (a, b) => { g.fillStyle = 'rgba(90,45,20,0.4)'; elipsa(g, a, b + 1.5, rx, ry); g.fillStyle = c; elipsa(g, a, b, rx, ry); });
      }
      for (let i = 0; i < 80; i++) { g.fillStyle = 'rgba(70,35,18,0.6)'; g.fillRect(r() * w, r() * h, 2 + r() * 6, 1.5); }
    },
    buk(g, w, h, r) {
      g.fillStyle = '#8b8a83'; g.fillRect(0, 0, w, h);
      const bb = ['rgba(110,110,102,0.13)', 'rgba(170,170,160,0.13)', 'rgba(125,124,112,0.13)', 'rgba(95,96,90,0.13)'];
      for (let i = 0; i < 260; i++) { const x = r() * w, y = r() * h, rx = 10 + r() * 32, ry = 8 + r() * 26, c = vyber(r, bb); obtoc(w, h, x, y, 45, (a, b) => { g.fillStyle = c; elipsa(g, a, b, rx, ry); }); }
      zrno(g, w, h, r, 1200, ['#7f7e77', '#97968e', '#868579'], 2);
      for (let i = 0; i < 40; i++) { const x = r() * w, y = r() * h, l = 8 + r() * 26; obtoc(w, h, x, y, 30, (a, b) => { g.fillStyle = 'rgba(85,84,78,0.45)'; g.fillRect(a, b, l, 1.5); }); }
      for (let i = 0; i < 60; i++) { const x = r() * w, y = r() * h, s = 2 + r() * 7, c = vyber(r, ['rgba(168,176,150,0.55)', 'rgba(196,199,176,0.5)', 'rgba(120,135,100,0.4)']); obtoc(w, h, x, y, 10, (a, b) => { g.fillStyle = c; elipsa(g, a, b, s, s * 0.7); }); }
    },
    briza(g, w, h, r) {
      g.fillStyle = '#e4e0d5'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 320; i++) { const x = r() * w, y = r() * h, rx = 6 + r() * 24, ry = 4 + r() * 10, c = vyber(r, ['rgba(205,200,186,0.3)', 'rgba(245,243,236,0.35)', 'rgba(200,190,175,0.25)']); obtoc(w, h, x, y, 30, (a, b) => { g.fillStyle = c; elipsa(g, a, b, rx, ry); }); }
      for (let i = 0; i < 30; i++) { const x = r() * w, y = r() * h, rx = 8 + r() * 18, ry = 2 + r() * 3; obtoc(w, h, x, y, 30, (a, b) => { g.fillStyle = 'rgba(225,190,160,0.45)'; elipsa(g, a, b, rx, ry); }); }
      for (let i = 0; i < 280; i++) {
        const x = r() * w, y = r() * h, l = 5 + r() * 30, t = 1.2 + r() * 3, c = r() < 0.8 ? 'rgba(38,32,28,0.85)' : 'rgba(110,92,80,0.7)';
        obtoc(w, h, x, y, 40, (a, b) => { g.fillStyle = c; g.beginPath(); g.ellipse(a, b, l / 2, t / 2, 0, 0, 6.2832); g.fill(); });
      }
      for (let i = 0; i < 16; i++) {
        const x = r() * w, y = r() * h, sw = 18 + r() * 40, sh = 6 + r() * 22;
        obtoc(w, h, x, y, 50, (a, b) => {
          g.fillStyle = 'rgba(28,24,21,0.92)';
          for (let k = 0; k < 6; k++) elipsa(g, a + (r() - 0.5) * sw, b + (r() - 0.5) * sh * 0.6, sw * (0.15 + r() * 0.25), sh * (0.2 + r() * 0.3));
        });
      }
    },
    dub(g, w, h, r) {
      g.fillStyle = '#1f1a15'; g.fillRect(0, 0, w, h);
      const bb = ['#4e463c', '#5b5245', '#453d34', '#665c4e', '#575046'];
      for (let i = 0; i < 170; i++) {
        const x = r() * w, y = r() * h, sw = 7 + r() * 13, sh = 40 + r() * 180, c = vyber(r, bb);
        obtoc(w, h, x, y, 220, (a, b) => {
          g.fillStyle = c; g.beginPath(); g.moveTo(a, b);
          const n = 6;
          for (let k = 1; k <= n; k++) g.lineTo(a + (r() - 0.5) * 4, b + sh * k / n);
          for (let k = n; k >= 0; k--) g.lineTo(a + sw + (r() - 0.5) * 4, b + sh * k / n);
          g.closePath(); g.fill();
          g.fillStyle = 'rgba(150,140,120,0.16)'; g.fillRect(a + 1, b, 2, sh);
        });
      }
      for (let i = 0; i < 70; i++) { g.fillStyle = 'rgba(20,16,12,0.8)'; g.fillRect(r() * w, r() * h, 8 + r() * 14, 2); }
    },
    vetev(g, w, h, r) {
      g.fillStyle = '#4a3d33'; g.fillRect(0, 0, w, h);
      zrno(g, w, h, r, 3000, ['#3e332b', '#56483c', '#5f5143', '#433830'], 3);
      for (let i = 0; i < 80; i++) { g.fillStyle = 'rgba(25,20,16,0.5)'; g.fillRect(r() * w, r() * h, 1.5, 6 + r() * 20); }
    },
  };

  // křivka: body [x, y, úhel] od (x, y) směrem úhel, s postupným stáčením
  function krivka(x, y, uhel, delka, stoceni, n) {
    const body = [[x, y, uhel]], krok = delka / n;
    for (let i = 0; i < n; i++) { uhel += stoceni * krok; x += Math.cos(uhel) * krok; y += Math.sin(uhel) * krok; body.push([x, y, uhel]); }
    return body;
  }
  function bodNa(body, t) { return body[Math.min(body.length - 1, Math.round(t * (body.length - 1)))]; }
  function prut(g, body, w0, w1, c) {
    g.strokeStyle = c; g.lineCap = 'round';
    for (let i = 1; i < body.length; i++) {
      g.lineWidth = w0 + (w1 - w0) * i / body.length;
      g.beginPath(); g.moveTo(body[i - 1][0], body[i - 1][1]); g.lineTo(body[i][0], body[i][1]); g.stroke();
    }
  }
  function jehla(g, x, y, uhel, d, w, c) {
    g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(uhel) * d, y + Math.sin(uhel) * d); g.stroke();
  }
  function list(g, x, y, uhel, d, s, c, tvar) {
    g.save(); g.translate(x, y); g.rotate(uhel);
    g.strokeStyle = 'rgba(60,45,25,0.8)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-4, 0); g.lineTo(1, 0); g.stroke();
    g.beginPath();
    if (tvar === 'dub') {
      const N = 14; g.moveTo(0, 0);
      const pw = t => s * 0.5 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.08 + t * 0.95)), 0.7) * (0.5 + 0.5 * Math.abs(Math.sin(t * Math.PI * 4.5)));
      for (let i = 1; i <= N; i++) g.lineTo(d * i / N, -pw(i / N));
      for (let i = N; i >= 0; i--) g.lineTo(d * i / N, pw(i / N));
    } else if (tvar === 'briza') {
      g.moveTo(0, 0); g.quadraticCurveTo(d * 0.22, -s * 0.7, d, 0); g.quadraticCurveTo(d * 0.22, s * 0.7, 0, 0);
    } else {
      g.moveTo(0, 0); g.bezierCurveTo(d * 0.3, -s * 0.62, d * 0.75, -s * 0.5, d, 0); g.bezierCurveTo(d * 0.75, s * 0.5, d * 0.3, s * 0.62, 0, 0);
    }
    g.closePath(); g.fillStyle = c; g.fill();
    g.save(); g.clip();
    g.fillStyle = 'rgba(255,255,215,0.11)'; g.fillRect(0, -s, d, s);                 // světlejší polovina = objem listu
    g.fillStyle = 'rgba(0,20,0,0.10)'; g.fillRect(d * 0.75, -s, d, 2 * s);            // tmavší špička
    g.restore();
    g.strokeStyle = 'rgba(25,40,12,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 0); g.lineTo(d * 0.92, 0); g.stroke();
    if (d > 28) {
      g.strokeStyle = 'rgba(25,40,12,0.18)'; g.beginPath();
      for (let k = 1; k < 5; k++) { const x0 = d * k / 5.5; g.moveTo(x0, 0); g.lineTo(x0 + d * 0.13, -s * 0.33); g.moveTo(x0, 0); g.lineTo(x0 + d * 0.13, s * 0.33); }
      g.stroke();
    }
    g.restore();
  }
  // je list celý uvnitř buňky?
  function vBunce(w, h, x, y, uhel, d) {
    const x2 = x + Math.cos(uhel) * d, y2 = y + Math.sin(uhel) * d, m = 5;
    return x > m && x < w - m && y > m && y < h - m && x2 > m && x2 < w - m && y2 > m && y2 < h - m;
  }

  const LISTI = {
    // smrková větvička: osa od základny (dole) ke špičce (nahoře), boční větvičky hustě obalené jehlicemi
    smrk(g, w, h, r) {
      const osa = krivka(w / 2, h - 6, -Math.PI / 2 + (r() - 0.5) * 0.1, h - 26, (r() - 0.5) * 0.002, 40);
      const vetv = [osa];
      const N = 22;
      for (let k = 0; k < N; k++) {
        const t = 0.04 + 0.92 * k / N;
        for (const str of [-1, 1]) {
          const p = bodNa(osa, t + (str > 0 ? 0.01 : 0));
          const d = (Math.pow(1 - t, 0.7) * 92 + 12) * (0.8 + 0.35 * r());
          vetv.push(krivka(p[0], p[1], p[2] + str * (0.85 + 0.25 * r()), d, -str * 0.004, 12));
        }
      }
      const tmave = ['#1c3a2a', '#21422f', '#284c35', '#183225', '#2b5238'];
      for (const v of vetv) prut(g, v, v === osa ? 3.2 : 1.6, v === osa ? 1.2 : 0.8, '#4b3826');
      for (const vrstva of [0, 1]) {
        for (const v of vetv) {
          const hl = v === osa;
          for (let i = 1; i < v.length; i++) {
            const t = i / (v.length - 1), p = v[i];
            for (const str of [-1, 1]) {
              const u = p[2] + str * (0.7 + r() * 0.5), d = (hl ? 13 : 10) * (0.8 + 0.4 * r()) * (t > 0.85 ? 0.75 : 1);
              let c = vyber(r, tmave);
              if (vrstva === 1 && t > 0.7 && r() < 0.35) c = vyber(r, ['#3f6b40', '#4d7d48', '#45733f']);
              if (vrstva === 0) jehla(g, p[0] + 1.2, p[1] + 1.6, u, d, 2.2, barva(c, 0.6));
              else jehla(g, p[0], p[1], u, d, 1.5, c);
            }
          }
        }
      }
    },
    // borovice: větvička s dlouhými jehlicemi do štětky
    bor(g, w, h, r) {
      const osa = krivka(w / 2, h - 6, -Math.PI / 2 + (r() - 0.5) * 0.15, h * 0.7, (r() - 0.5) * 0.003, 30);
      prut(g, osa, 5, 2.5, '#7a5236');
      const bb = ['#3b5d46', '#47694f', '#526f55', '#2f4b39', '#5d7b5c', '#43644b'];
      for (let i = 6; i < osa.length; i++) {
        const t = i / (osa.length - 1), p = osa[i];
        const n = 7 + Math.floor(r() * 4);
        for (let k = 0; k < n; k++) {
          const u = p[2] + (r() - 0.5) * 2 * (0.4 + 0.75 * (1 - t)), d = (55 + 40 * r()) * (0.75 + 0.3 * t);
          const c = vyber(r, bb);
          const x2 = p[0] + Math.cos(u) * d, y2 = p[1] + Math.sin(u) * d;
          g.strokeStyle = c; g.lineWidth = 1.8; g.beginPath(); g.moveTo(p[0], p[1]);
          g.quadraticCurveTo((p[0] + x2) / 2 + (r() - 0.5) * 6, (p[1] + y2) / 2 + (r() - 0.5) * 6, x2, y2); g.stroke();
        }
      }
      const kon = osa[osa.length - 1];
      for (let k = 0; k < 40; k++) jehla(g, kon[0], kon[1], kon[2] + (r() - 0.5) * 1.3, 50 + r() * 45, 1.8, vyber(r, bb));
    },
    // bříza: převislý proutek s drobnými listy
    prut(g, w, h, r) {
      const osa = krivka(w / 2, h - 6, -Math.PI / 2 + (r() - 0.5) * 0.2, h * 0.92, (r() - 0.5) * 0.004, 40);
      const vetv = [osa];
      for (let k = 0; k < 3; k++) { const p = bodNa(osa, 0.25 + 0.4 * r()); const str = k % 2 ? 1 : -1; vetv.push(krivka(p[0], p[1], p[2] + str * (0.3 + 0.3 * r()), h * (0.25 + 0.2 * r()), -str * 0.003, 16)); }
      for (const v of vetv) prut(g, v, v === osa ? 2.2 : 1.4, 0.8, '#4a2e22');
      const bb = ['#79a446', '#6c983c', '#88b253', '#5f8c36', '#93b85c'];
      for (const v of vetv) {
        let str = 1;
        for (let i = 2; i < v.length; i += 2 + (r() < 0.5 ? 1 : 0)) {
          const p = v[i]; str = -str;
          const u = p[2] + str * (0.55 + 0.45 * r()), d = 16 + r() * 9;
          if (vBunce(w, h, p[0], p[1], u, d)) list(g, p[0], p[1], u, d, d * 0.72, vyber(r, bb), 'briza');
        }
      }
    },
  };

  // shluk listnáče: větvička s listy, základna dole uprostřed
  function malujShluk(g, w, h, r, o) {
    const osa = krivka(w / 2, h - 4, -Math.PI / 2 + (r() - 0.5) * 0.4, h * 0.74, (r() - 0.5) * 0.004, 20);
    const vetv = [osa];
    for (let i = 0; i < o.vetvi; i++) {
      const t = 0.12 + 0.72 * r(), p = bodNa(osa, t), str = i % 2 ? 1 : -1;
      vetv.push(krivka(p[0], p[1], p[2] + str * (0.5 + 0.5 * r()), h * (0.22 + 0.25 * r()) * (1 - t * 0.4), -str * 0.004, 12));
    }
    for (const v of vetv) prut(g, v, v === osa ? 3 : 1.8, 1, o.prut);
    const listy = [];
    for (const v of vetv) {
      let str = 1;
      for (let i = 2; i < v.length; i += o.krok) {
        const p = v[i]; str = -str;
        if (o.ruzice && i < v.length - 3) continue;
        const n = o.ruzice ? 5 : 1;
        for (let k = 0; k < n; k++) {
          const u = o.ruzice ? p[2] + (k - 2) * 0.55 + (r() - 0.5) * 0.3 : p[2] + str * (0.6 + 0.4 * r());
          listy.push([p[0], p[1], u, o.delka[0] + r() * (o.delka[1] - o.delka[0])]);
        }
      }
    }
    for (let i = 0; i < o.navic; i++) {
      const a = r() * 6.283, rr = Math.sqrt(r()) * w * 0.36;
      listy.push([w / 2 + Math.cos(a) * rr, h * 0.47 + Math.sin(a) * rr * 0.9, r() * 6.283, o.delka[0] + r() * (o.delka[1] - o.delka[0])]);
    }
    // tmavší (vzadu) dřív, světlejší navrch
    const s = listy.map(l => [l, r()]).sort((a, b) => a[1] - b[1]);
    for (const [l, j] of s) {
      if (!vBunce(w, h, l[0], l[1], l[2], l[3])) continue;
      list(g, l[0], l[1], l[2], l[3], l[3] * o.pomer, barva(vyber(r, o.barvy), 0.72 + 0.4 * j), o.tvar);
    }
  }
  const SHLUKY = {
    buk: { vetvi: 5, krok: 2, delka: [32, 44], pomer: 0.58, tvar: 'oval', navic: 16, prut: '#5a4a3a', barvy: ['#4f7d30', '#5b8c36', '#45722a', '#689a3f', '#3d6726'] },
    dub: { vetvi: 6, krok: 3, delka: [38, 52], pomer: 0.55, tvar: 'dub', navic: 10, ruzice: true, prut: '#4a3c30', barvy: ['#41652a', '#4b712d', '#395c25', '#557b34'] },
    briza: { vetvi: 6, krok: 2, delka: [17, 25], pomer: 0.72, tvar: 'briza', navic: 18, prut: '#4a2e22', barvy: ['#79a446', '#6c983c', '#88b253', '#5f8c36'] },
    ker: { vetvi: 6, krok: 2, delka: [18, 28], pomer: 0.6, tvar: 'oval', navic: 40, prut: '#4f4033', barvy: ['#4b7432', '#3f6629', '#58823a', '#6a8f3f', '#365a24'] },
  };

  function malujAtlas(skala) {
    const cv = document.createElement('canvas');
    cv.width = ATL_W * skala; cv.height = ATL_H * skala;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.scale(skala, skala);
    for (const jm in BUNKY) {
      const b = BUNKY[jm], r = D.Nahoda('vegetace:' + jm);
      g.save(); g.beginPath(); g.rect(b[0], b[1], b[2], b[3]); g.clip(); g.translate(b[0], b[1]);
      const [druh] = jm.split('_');
      if (druh === 'kura') KURA[jm.slice(5)](g, b[2], b[3], r);
      else if (LISTI[druh]) LISTI[druh](g, b[2], b[3], r);
      else malujShluk(g, b[2], b[3], r, SHLUKY[druh]);
      g.restore();
    }
    const img = g.getImageData(0, 0, cv.width, cv.height), d = img.data, W = cv.width;
    // průhledné pixely dostanou průměrnou barvu své buňky (mipmapy pak netmavnou na okrajích)
    for (const jm in BUNKY) {
      const b = BUNKY[jm].map(v => Math.round(v * skala));
      let sr = 0, sg = 0, sb = 0, n = 0;
      for (let y = b[1]; y < b[1] + b[3]; y += 2) for (let x = b[0]; x < b[0] + b[2]; x += 2) {
        const i = (y * W + x) * 4; if (d[i + 3] > 200) { sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; n++; }
      }
      if (!n) continue;
      sr /= n; sg /= n; sb /= n;
      for (let y = b[1]; y < b[1] + b[3]; y++) for (let x = b[0]; x < b[0] + b[2]; x++) {
        const i = (y * W + x) * 4, a = d[i + 3] / 255;
        if (a < 1) { d[i] = d[i] * a + sr * (1 - a); d[i + 1] = d[i + 1] * a + sg * (1 - a); d[i + 2] = d[i + 2] * a + sb * (1 - a); }
      }
    }
    cv.width = cv.height = 1;
    const tex = new THREE.DataTexture(d, img.width, img.height, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4; tex.needsUpdate = true;
    tex.onUpdate = function () { this.image = { width: img.width, height: img.height, data: null }; };  // uvolnit RAM
    return tex;
  }

  function texturaKamene() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const g = cv.getContext('2d'), r = D.Nahoda('vegetace:kamen');
    g.fillStyle = '#7b7973'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 400; i++) { const x = r() * 256, y = r() * 256, s = 6 + r() * 30, c = vyber(r, ['rgba(95,93,88,0.18)', 'rgba(140,138,130,0.18)', 'rgba(110,104,95,0.2)']); obtoc(256, 256, x, y, 40, (a, b) => { g.fillStyle = c; elipsa(g, a, b, s, s * 0.7); }); }
    zrno(g, 256, 256, r, 5000, ['#5f5d58', '#95938c', '#6e6c66', '#a8a59c', '#4e4c48'], 2);
    for (let i = 0; i < 70; i++) { const x = r() * 256, y = r() * 256, s = 2 + r() * 9, c = vyber(r, ['rgba(160,165,120,0.6)', 'rgba(200,196,160,0.55)', 'rgba(110,125,70,0.5)']); obtoc(256, 256, x, y, 12, (a, b) => { g.fillStyle = c; elipsa(g, a, b, s, s * 0.8); }); }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    return t;
  }

  // ======================================================================
  // Geometrie stromů
  // ======================================================================
  function Stavitel(r) {
    this.r = r; this.pos = []; this.nor = []; this.uv = []; this.atl = []; this.par = []; this.idx = [];
    this.ao = () => 1; this.aoKmen = () => 0.6; this.normala = (p, n) => n;
  }
  Stavitel.prototype.v = function (p, n, u, v, rect, ao, list, faze) {
    this.pos.push(p[0], p[1], p[2]); this.nor.push(n[0], n[1], n[2]); this.uv.push(u, v);
    this.atl.push(rect[0], rect[1], rect[2], rect[3]); this.par.push(ao, list, 0, faze);
  };
  Stavitel.prototype.pocet = function () { return this.pos.length / 3; };
  // váha ohybu ve větru: roste s výškou, listí víc
  Stavitel.prototype.dokonci = function (H) {
    for (let i = 0, n = this.pocet(); i < n; i++) {
      const y = this.pos[i * 3 + 1], rr = Math.hypot(this.pos[i * 3], this.pos[i * 3 + 2]);
      let w = Math.pow(clamp(y / H, 0, 1.2), 1.7) * H / 20;
      if (this.par[i * 4 + 1] > 0.5) w += 0.04 * rr;
      this.par[i * 4 + 2] = w;
    }
  };
  Stavitel.prototype.geometrie = function () {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aAtlas', new THREE.Float32BufferAttribute(this.atl, 4));
    g.setAttribute('aPar', new THREE.Float32BufferAttribute(this.par, 4));
    g.setIndex(this.idx);
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  };

  // trubka po lomené čáře (kmen, větev); opak = kolik metrů výšky na jedno opakování textury
  function trubka(S, body, polomery, seg, rect, opak) {
    const n = body.length, zac = S.pocet();
    let delka = 0;
    for (let i = 0; i < n; i++) {
      const p = body[i];
      const t = V.norm(V.sub(body[Math.min(i + 1, n - 1)], body[Math.max(i - 1, 0)]));
      const ref = Math.abs(t[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
      const b = V.norm(V.cross(t, ref)), nn = V.cross(b, t);
      if (i > 0) delka += V.len(V.sub(p, body[i - 1]));
      const ao = S.aoKmen(p);
      for (let j = 0; j <= seg; j++) {
        const a = j / seg * 6.28318, dir = V.add(V.mul(nn, Math.cos(a)), V.mul(b, Math.sin(a)));
        S.v(V.add(p, V.mul(dir, polomery[i])), dir, j / seg, delka / opak, rect, ao, 0, 0);
      }
    }
    const k = seg + 1;
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) {
      const a = zac + i * k + j, b = a + 1, c = a + k, d = c + 1;
      S.idx.push(a, c, b, b, c, d);
    }
  }

  // karta listí / jehličí: od základny (v = 1 v textuře) ke špičce (v = 0); prehyb > 0 = okraje dolů (stříška)
  function karta(S, zakl, osa, napric, delka, sirka, rect, o) {
    o = o || {};
    const nk = V.norm(V.cross(napric, osa));
    const sloupce = o.prehyb ? [0, 0.5, 1] : [0, 1];
    const zac = S.pocet(), faze = S.r() * 6.283;
    for (const s of [0, 1]) for (const u of sloupce) {
      const q = u - 0.5;
      let p = V.add(zakl, V.add(V.mul(osa, delka * s), V.mul(napric, sirka * q)));
      if (o.prehyb) p = V.add(p, V.mul(nk, -Math.abs(q) * sirka * o.prehyb));
      S.v(p, S.normala(p, nk), u, 1 - s, rect, S.ao(p), 1, faze);
    }
    const nc = sloupce.length;
    for (let j = 0; j < nc - 1; j++) { const a = zac + j, b = a + 1, c = a + nc, d = c + 1; S.idx.push(a, b, d, a, d, c); }
  }

  // bod na kmeni v dané výšce (lineárně po lomené čáře)
  function naKmeni(body, y) {
    for (let i = 1; i < body.length; i++) if (body[i][1] >= y) {
      const a = body[i - 1], b = body[i], t = (y - a[1]) / Math.max(1e-3, b[1] - a[1]);
      return V.mix(a, b, clamp(t, 0, 1));
    }
    return body[body.length - 1].slice();
  }

  // normála koruny = elipsoid (+ trochu ke středu nejbližšího shluku) s příměsí normály karty
  function nastavKorunu(S, C, P, sub) {
    S.normala = (p, nk) => {
      let rad = V.norm([(p[0] - C[0]) / (P[0] * P[0]), (p[1] - C[1]) / (P[1] * P[1]), (p[2] - C[2]) / (P[2] * P[2])]);
      if (sub && sub.length) {
        let best = sub[0], bd = 1e9;
        for (const s of sub) { const d = V.len(V.sub(p, s.c)) / s.r; if (d < bd) { bd = d; best = s; } }
        rad = V.norm(V.add(V.mul(rad, 0.62), V.mul(V.norm(V.sub(p, best.c)), 0.38)));
      }
      const zn = V.dot(nk, rad) >= 0 ? 1 : -1;
      return V.norm(V.add(V.mul(rad, 0.8), V.mul(nk, 0.2 * zn)));
    };
    S.ao = p => {
      const q = Math.hypot((p[0] - C[0]) / P[0], (p[1] - C[1]) / P[1], (p[2] - C[2]) / P[2]);
      const vy = clamp((p[1] - (C[1] - P[1])) / (2 * P[1]), 0, 1);
      return clamp(0.26 + 0.74 * hladce(0.15, 1.0, q), 0.24, 1) * (0.66 + 0.34 * vy);
    };
  }

  function smrk(S, T, lod, r) {
    const H = T.vyska, R = T.korunaR, od = T.korunaOd, kr = T.kmenR;
    const kuzel = h => R * Math.pow(Math.max(0, (H - h) / (H - od)), 0.92);
    S.aoKmen = p => p[1] < od ? 0.6 + 0.3 * clamp(p[1] / od, 0, 1) : 0.42;
    S.ao = p => { const rr = Math.hypot(p[0], p[2]) / (kuzel(p[1]) + 0.4); return clamp(0.28 + 0.78 * rr, 0.26, 1) * (0.6 + 0.4 * clamp((p[1] - od) / (H - od), 0, 1)); };
    S.normala = (p, nk) => {
      const d = Math.hypot(p[0], p[2]) || 1, rad = V.norm([p[0] / d, 0.55, p[2] / d]);
      const zn = V.dot(nk, rad) >= 0 ? 1 : -1;
      return V.norm(V.add(V.mul(rad, 0.75), V.mul(nk, 0.25 * zn)));
    };
    trubka(S, [[0, -0.8, 0], [0, od, 0], [0, H * 0.6, 0], [0, H - 0.3, 0]], [kr * 1.25, kr, kr * 0.5, 0.03], lod ? 5 : 7, ATL('kura_smrk'), 4 * Math.PI * kr);
    const krok = lod ? 1.9 : 0.8, nb = lod ? 3 : 5;
    let rot = r() * 6.283;
    for (let h = od + 0.3; h < H - 1.6; h += krok * (0.85 + 0.3 * r())) {
      const t = (h - od) / (H - od), cr = kuzel(h) * (0.88 + 0.24 * r()) + 0.3;
      rot += 2.39996;
      for (let k = 0; k < nb; k++) {
        const az = rot + k * 6.283 / nb + (r() - 0.5) * 0.6, ca = Math.cos(az), sa = Math.sin(az);
        const osa = V.norm([ca, -0.1 - 0.35 * (1 - t) + (r() - 0.5) * 0.12, sa]);
        const delka = cr / Math.hypot(osa[0], osa[2]);
        const sirka = (delka * 0.62 + 0.35) * (lod ? 1.4 : 1);
        karta(S, [ca * 0.1, h, sa * 0.1], osa, [-sa, 0, ca], delka, sirka, ATL(r() < 0.5 ? 'smrk_a' : 'smrk_b'), { prehyb: 0.3 });
      }
    }
    for (const nap of [[1, 0, 0], [0, 0, 1]]) karta(S, [0, H - 2.6, 0], [0, 1, 0], nap, 2.7, 1.1, ATL('smrk_a'));
  }

  function borovice(S, T, lod, r) {
    const H = T.vyska, R = T.korunaR, od = T.korunaOd, kr = T.kmenR;
    const body = [], pol = [];
    let x = 0, z = 0;
    for (const h of [-0.8, 3, 7, 11, 15, 18.5, H - 2]) {
      if (h > 3) { x += (r() - 0.5) * 0.55; z += (r() - 0.5) * 0.55; }
      body.push([x, h, z]); pol.push(kr * 1.2 + (0.1 - kr * 1.2) * clamp(h / (H - 2), 0, 1));
    }
    pol[0] = kr * 1.35;
    const vrch = body[body.length - 1];
    const C = [vrch[0], H - 2.6, vrch[2]], P = [R, 1.9, R];
    S.aoKmen = p => p[1] < od ? 0.65 + 0.3 * clamp(p[1] / od, 0, 1) : 0.7;
    nastavKorunu(S, C, [P[0], P[1] * 1.4, P[2]], null);
    const seg = lod ? 5 : 7;
    trubka(S, body.slice(0, 3), pol.slice(0, 3), seg, ATL('kura_bordol'), 4 * Math.PI * kr);
    trubka(S, body.slice(2), pol.slice(2), seg, ATL('kura_borhor'), 4 * Math.PI * 0.16);
    const nv = lod ? 3 : 6;
    for (let i = 0; i < nv; i++) {
      const a = i * 2.4 + r(), hh = od + (H - 3 - od) * (i / nv) * 0.85;
      const zac = naKmeni(body, hh);
      const kon = [C[0] + Math.cos(a) * R * 0.65, Math.min(H - 1, hh + 2.2 + r() * 1.5), C[2] + Math.sin(a) * R * 0.65];
      const stred = V.add(V.mix(zac, kon, 0.5), [0, 0.6, 0]);
      trubka(S, [zac, stred, kon], [0.14, 0.08, 0.04], lod ? 3 : 4, ATL('kura_borhor'), 1.0);
    }
    const nc = lod ? 14 : 36, nk = lod ? 2 : 3, vel = lod ? 2.6 : 1.8;
    for (let i = 0; i < nc; i++) {
      const a = r() * 6.283, rr = R * Math.sqrt(0.06 + 0.94 * r());
      const c = [C[0] + Math.cos(a) * rr, C[1] + 1.1 - Math.pow(rr / R, 2) * 2.3 + (r() - 0.5) * 0.8, C[2] + Math.sin(a) * rr];
      for (let j = 0; j < nk; j++) {
        const osa = V.norm([Math.cos(a) * 0.6 + (r() - 0.5) * 0.9, 0.55 + r() * 0.5, Math.sin(a) * 0.6 + (r() - 0.5) * 0.9]);
        const nap = V.norm(V.cross(osa, nahodnyVektor(r)));
        karta(S, V.sub(c, V.mul(osa, vel * 0.4)), osa, nap, vel, vel * 0.62, ATL(r() < 0.5 ? 'bor_a' : 'bor_b'));
      }
    }
  }

  // listnáče a keř: kmen, větve ke shlukům koruny, karty listí rozmístěné po shlucích
  function listnac(S, T, lod, r, k) {
    const H = T.vyska, od = T.korunaOd, C = k.C, P = k.P;
    // shluky koruny
    const sub = [];
    for (let i = 0; i < k.nSub; i++) {
      const d = nahodnyVektor(r); d[1] = Math.abs(d[1]) * 0.85 + 0.1;
      const dn = V.norm(d), f = 0.42 + 0.22 * r();
      sub.push({ c: [C[0] + dn[0] * P[0] * f, C[1] + dn[1] * P[1] * f * 0.9, C[2] + dn[2] * P[2] * f], r: k.relSub * (P[0] + P[1] + P[2]) / 3 * (0.85 + 0.3 * r()), smer: dn });
    }
    sub.push({ c: [C[0], C[1] + P[1] * 0.35, C[2]], r: k.relSub * (P[0] + P[1]) / 2, smer: [0, 1, 0] });
    nastavKorunu(S, C, P, sub);
    S.aoKmen = p => p[1] < od ? 0.62 + 0.33 * clamp(p[1] / Math.max(od, 0.5), 0, 1) : 0.5;
    let body = null;
    if (k.kmen) {
      body = k.kmen.body;
      trubka(S, body, k.kmen.pol, lod ? 5 : 8, ATL(k.kura), 4 * Math.PI * T.kmenR);
    }
    // větve: od kmene ke středům shluků
    const nv = Math.min(sub.length, k.vetve[lod]);
    for (let i = 0; i < nv; i++) {
      const s = sub[i];
      const zac = body ? naKmeni(body, od + (C[1] - od) * (0.25 + 0.6 * r())) : [(r() - 0.5) * 0.3, -0.2, (r() - 0.5) * 0.3];
      const kon = V.mix(C, s.c, 1.05);
      const kroky = k.krive ? 4 : 3, b = [zac], pr = [k.vetevR];
      for (let j = 1; j <= kroky; j++) {
        const t = j / kroky;
        let p = V.mix(zac, kon, t);
        p = V.add(p, [0, Math.sin(t * Math.PI) * 0.8, 0]);
        if (k.krive && j < kroky) p = V.add(p, V.mul(nahodnyVektor(r), 0.9));
        b.push(p); pr.push(k.vetevR * (1 - t * 0.75));
      }
      trubka(S, b, pr, lod ? 3 : 5, ATL(k.kuraVetvi || k.kura), 4 * Math.PI * k.vetevR);
    }
    // listí
    const n = k.n[lod], vel = k.vel[lod];
    for (let i = 0; i < n; i++) {
      const s = sub[Math.floor(r() * sub.length)];
      let u = nahodnyVektor(r);
      if (V.dot(u, s.smer) < -0.35) u = V.mul(u, -1);
      let p = V.add(s.c, V.mul(u, s.r * (0.45 + 0.55 * Math.sqrt(r()))));
      const q = Math.hypot((p[0] - C[0]) / P[0], (p[1] - C[1]) / P[1], (p[2] - C[2]) / P[2]);
      if (q > 1) p = V.add(C, V.mul(V.sub(p, C), 1 / q));
      if (p[1] < k.minY) p[1] = k.minY + r() * 0.2;
      const osa = V.norm(V.add(V.add(V.mul(u, 0.55), V.mul(nahodnyVektor(r), 0.45)), [0, k.nahoru, 0]));
      const nap = V.norm(V.cross(osa, nahodnyVektor(r)));
      const d = vel * (0.8 + 0.4 * r());
      karta(S, V.sub(p, V.mul(osa, d * 0.45)), osa, nap, d, d * 0.95, ATL(vyber(r, k.rects)));
    }
    // převislé proutky (bříza)
    if (k.prameny) {
      const pn = k.prameny.n[lod], pv = k.prameny.vel[lod];
      for (let i = 0; i < pn; i++) {
        const u = nahodnyVektor(r); u[1] = Math.abs(u[1]) * 0.6 + 0.1;
        const un = V.norm(u);
        const p = [C[0] + un[0] * P[0] * (0.6 + 0.35 * r()), C[1] + un[1] * P[1] * 0.85, C[2] + un[2] * P[2] * (0.6 + 0.35 * r())];
        const osa = V.norm([un[0] * 0.35, -1, un[2] * 0.35]);
        const nap = V.norm([-un[2], 0, un[0]]);
        karta(S, p, osa, nap, pv, pv * 0.45, ATL(r() < 0.5 ? 'prut_a' : 'prut_b'));
      }
    }
  }

  function stavStrom(typ, lod) {
    const T = D.STROMY[typ], r = D.Nahoda('vegetace:strom:' + typ), S = new Stavitel(r);
    const H = T.vyska, R = T.korunaR, od = T.korunaOd, kr = T.kmenR;
    if (typ === 0) smrk(S, T, lod, r);
    else if (typ === 1) borovice(S, T, lod, r);
    else if (typ === 2) {
      const C = [0, od + (H - od) * 0.55, 0], P = [R, (H - od) * 0.48, R];
      listnac(S, T, lod, r, { C, P, nSub: 7, relSub: 0.5, n: [140, 56], vel: [2.6, 3.9], rects: ['buk_a', 'buk_b', 'buk_c'], nahoru: 0.25, minY: od,
        kmen: { body: [[0, -0.8, 0], [0, od, 0], [0.2, C[1], 0.1], [0.3, C[1] + P[1] * 0.6, 0]], pol: [kr * 1.25, kr, kr * 0.6, 0.08] },
        kura: 'kura_buk', vetve: [7, 3], vetevR: 0.17 });
    } else if (typ === 3) {
      const C = [0, od + (H - od) * 0.58, 0], P = [R, (H - od) * 0.5, R];
      listnac(S, T, lod, r, { C, P, nSub: 5, relSub: 0.55, n: [70, 30], vel: [1.9, 2.9], rects: ['briza_a', 'briza_b'], nahoru: 0.1, minY: od,
        kmen: { body: [[0, -0.6, 0], [0.15, od, 0], [0.05, (od + H) / 2, 0.1], [0.2, H - 1, 0]], pol: [kr * 1.2, kr, kr * 0.6, 0.04] },
        kura: 'kura_briza', kuraVetvi: 'kura_vetev', vetve: [6, 3], vetevR: 0.07,
        prameny: { n: [30, 14], vel: [2.8, 3.4] } });
    } else if (typ === 4) {
      const C = [0, od + 7.5, 0], P = [R, 6.5, R * 0.92];
      listnac(S, T, lod, r, { C, P, nSub: 9, relSub: 0.42, n: [150, 60], vel: [2.8, 4.0], rects: ['dub_a', 'dub_b', 'dub_c'], nahoru: 0.15, minY: od - 1, krive: true,
        kmen: { body: [[0, -0.8, 0], [0.1, 2, 0], [-0.3, od, 0.2], [0.2, od + 2.5, -0.1]], pol: [kr * 1.3, kr, kr * 0.9, kr * 0.7] },
        kura: 'kura_dub', vetve: [6, 4], vetevR: 0.3 });
    } else {
      const C = [0, 1.05, 0], P = [R, 1.15, R];
      listnac(S, T, lod, r, { C, P, nSub: 4, relSub: 0.6, n: [34, 12], vel: [1.15, 1.7], rects: ['ker_a', 'ker_b'], nahoru: 0.2, minY: 0.2,
        kmen: null, kura: 'kura_vetev', vetve: [4, 0], vetevR: 0.04 });
    }
    S.dokonci(H);
    return S.geometrie();
  }

  // ======================================================================
  // GLSL
  // ======================================================================
  const VS_SPOL = /* glsl */`
uniform float uTime; uniform vec2 uWind; uniform vec3 uDronPos; uniform float uDronTah;
float vegHash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec4 vegHash42(vec2 p) { vec4 p4 = fract(vec4(p.xyxy) * vec4(.1031, .1030, .0973, .1099)); p4 += dot(p4, p4.wzxy + 33.33); return fract((p4.xxyz + p4.yzzw) * p4.zywx); }
float vegSum(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(vegHash12(i), vegHash12(i + vec2(1.0, 0.0)), f.x), mix(vegHash12(i + vec2(0.0, 1.0)), vegHash12(i + vec2(1.0, 1.0)), f.x), f.y);
}
// poryvy větru: vlny putují krajinou po větru (0..1)
float vegNaraz(vec2 p) {
  float s = length(uWind); vec2 dir = s > 0.01 ? uWind / s : vec2(1.0, 0.0);
  vec2 q = vec2(dot(p, dir), dot(p, vec2(-dir.y, dir.x)));
  q.x -= uTime * (2.0 + s * 0.9);
  float n = vegSum(q * vec2(0.035, 0.022)) * 0.65 + vegSum(q * vec2(0.11, 0.07) + 7.3) * 0.35;
  return smoothstep(0.25, 0.85, n);
}
// posun vrcholu stromu větrem a proplachem vrtulí
vec3 vegVitrStrom(vec3 wp, vec3 koren, float ohyb, float faze, float list) {
  float s = length(uWind); vec2 dir = s > 0.01 ? uWind / s : vec2(0.0);
  float g = vegNaraz(koren.xz);
  float sila = s * s * 0.0035 + s * 0.012;
  float kmit = sin(uTime * 1.3 + koren.x * 0.13 + koren.z * 0.11) * 0.35 + sin(uTime * 2.1 + faze) * 0.12;
  vec3 d = vec3(dir.x, 0.0, dir.y) * sila * ohyb * (0.45 + 0.9 * g + kmit);
  float tr = list * (0.02 + s * 0.01) * (0.5 + g);
  vec3 rel = wp - uDronPos; float r = length(rel);
  float pp = uDronTah * exp(-r * 0.3);
  tr += list * pp * 0.25;
  d += tr * vec3(sin(uTime * 7.0 + faze * 6.0 + wp.y), sin(uTime * 8.3 + faze * 4.0) * 0.6, cos(uTime * 6.1 + faze * 5.0));
  d += vec3(rel.x / max(r, 0.1) * 0.5, -1.0, rel.z / max(r, 0.1) * 0.5) * pp * (0.15 + 0.5 * list) * min(ohyb, 1.0);
  d.y -= dot(d.xz, d.xz) * 0.04;
  return d;
}
`;

  const FS_TEX = /* glsl */`
// vzorek z atlasu: kůra se opakuje (fract), listí ne; textureGrad = žádné švy na hraně opakování,
// průhlednost se v menších mipmapách zesílí, aby koruny do dálky neřídly
vec4 vegAtlas(sampler2D t, vec2 uv, vec4 rect, float list) {
  vec2 lok = list > 0.5 ? clamp(uv, 0.0, 1.0) : fract(uv);
  vec2 g = uv * rect.zw;
  vec2 dx = dFdx(g), dy = dFdy(g);
  vec4 c = textureGrad(t, rect.xy + lok * rect.zw, dx, dy);
  vec2 px = vec2(textureSize(t, 0));
  float mip = max(0.0, 0.5 * log2(max(dot(dx * px, dx * px), dot(dy * px, dy * px))));
  c.a *= 1.0 + mip * 0.28;
  return c;
}
float vegDither() { return fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))); }
vec3 vegTon(float b, float j, float list) {
  vec3 t = mix(vec3(0.86, 0.97, 0.80), vec3(1.12, 1.04, 0.84), b) * (0.84 + 0.32 * j);
  return mix(vec3(0.9 + 0.2 * j), t, list);
}
`;

  const FS_SVETLO = /* glsl */`
uniform float uAmbZaloha;
// osvětlení vegetace (stejná funkce pro 3D stromy, impostory i trávu): ambient z hemisféry/sondy
// (nebo z uSkyColor, když scéna žádné ambientní světlo nemá), slunce s obalovou difúzí, prosvítání listí
vec3 vegOsvetli(vec3 alb, vec3 nW, vec3 wp, float ao, float list, float stin) {
  vec3 n = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
  vec3 v = normalize((viewMatrix * vec4(cameraPosition - wp, 0.0)).xyz);
  vec3 irr = ambientLightColor;
  #if NUM_HEMI_LIGHTS > 0
  for (int i = 0; i < NUM_HEMI_LIGHTS; i++) irr += getHemisphereLightIrradiance(hemisphereLights[i], n);
  #endif
  #if defined( USE_LIGHT_PROBES )
  irr += getLightProbeIrradiance(lightProbe, n);
  #endif
  irr = mix(irr, uSkyColor * (0.7 + 0.3 * nW.y) * PI, uAmbZaloha);
  vec3 c = alb * irr * ao * RECIPROCAL_PI;
  #if NUM_DIR_LIGHTS > 0
  float s = stin * dronMraky(wp);
  for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
    vec3 l = directionalLights[i].direction;
    vec3 sc = directionalLights[i].color * s * RECIPROCAL_PI;
    float w = 0.2 + list * 0.3;
    float dif = max((dot(n, l) + w) / (1.0 + w), 0.0);
    c += alb * sc * dif * mix(1.0, ao, 0.45);
    float pr = pow(max(dot(-v, l), 0.0), 5.0) * list;
    c += alb * sc * pr * vec3(1.15, 1.3, 0.55) * (0.35 + 0.65 * ao) * 1.3;
  }
  #endif
  return c;
}
`;

  let VS_TEREN_STIN = '', FS_TEREN_STIN = '';     // doplní se v init(), pokud TERÉN-VYKRESLENÍ dodá uTerenStin

  function fsHlavicka() {
    return '#include <common>\n#include <packing>\n#include <lights_pars_begin>\n#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>\n' +
      D.GLSL.atmo + FS_TEX + FS_SVETLO + FS_TEREN_STIN;
  }

  const STROM_VS_TELO = /* glsl */`
attribute vec4 aAtlas; attribute vec4 aPar; attribute vec4 aPoloha; attribute vec4 aOtoc;
vec3 vegStromPoloha(out vec3 nW) {
  float c = aOtoc.x, s = aOtoc.y, m = aPoloha.w;
  vec3 p = position * m;
  p = vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  nW = vec3(c * normal.x + s * normal.z, normal.y, -s * normal.x + c * normal.z);
  vec3 wp = p + aPoloha.xyz;
  return wp + vegVitrStrom(wp, aPoloha.xyz, aPar.z * m, aPar.w, aPar.y);
}
`;

  function stromVS() {
    return '#include <common>\n#include <shadowmap_pars_vertex>\n' + VS_SPOL + STROM_VS_TELO + /* glsl */`
uniform vec4 uLod;
varying vec2 vUv; varying vec4 vAtlas; varying vec3 vN; varying vec3 vWp; varying vec4 vPar; varying vec2 vFade; varying vec2 vBarva;
void main() {
  vec3 nW;
  vec3 wp = vegStromPoloha(nW);
  float dist = distance(cameraPosition, aPoloha.xyz);
  vFade = vec2(1.0 - smoothstep(uLod.x - uLod.y * 0.5, uLod.x + uLod.y * 0.5, dist), 1.0 - smoothstep(uLod.z - uLod.w * 0.5, uLod.z + uLod.w * 0.5, dist));
  vUv = uv; vAtlas = aAtlas; vPar = aPar; vN = nW; vWp = wp; vBarva = aOtoc.zw;
  vec4 worldPosition = vec4(wp, 1.0);
  vec3 transformedNormal = (viewMatrix * vec4(nW, 0.0)).xyz;
  #include <shadowmap_vertex>
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}`;
  }
  function stromFS() {
    return fsHlavicka() + /* glsl */`
uniform sampler2D uAtlas;
varying vec2 vUv; varying vec4 vAtlas; varying vec3 vN; varying vec3 vWp; varying vec4 vPar; varying vec2 vFade; varying vec2 vBarva;
void main() {
  vec4 tx = vegAtlas(uAtlas, vUv, vAtlas, vPar.y);
  if (tx.a < 0.5) discard;
  float h = vegDither();
  #if VEG_LOD == 0
  if (h >= vFade.x) discard;
  #else
  if (h < vFade.x || h >= vFade.y) discard;
  #endif
  vec3 alb = tx.rgb * vegTon(vBarva.x, vBarva.y, vPar.y);
  float stin = getShadowMask() * vegTerenStin(vWp);
  vec3 c = vegOsvetli(alb, normalize(vN), vWp, vPar.x, vPar.y, stin);
  gl_FragColor = vec4(dronAtmo(c, vWp, cameraPosition), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
  }
  // hloubka pro stínovou mapu (s průhledností listí a větrem)
  function hloubkaVS() {
    return '#include <common>\n' + VS_SPOL + STROM_VS_TELO + /* glsl */`
varying vec2 vUv; varying vec4 vAtlas; varying float vList; varying vec2 vHighPrecisionZW;
void main() {
  vec3 nW;
  vec3 wp = vegStromPoloha(nW);
  vUv = uv; vAtlas = aAtlas; vList = aPar.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  vHighPrecisionZW = gl_Position.zw;
}`;
  }
  function hloubkaFS() {
    return '#include <common>\n#include <packing>\n' + FS_TEX + /* glsl */`
uniform sampler2D uAtlas;
varying vec2 vUv; varying vec4 vAtlas; varying float vList; varying vec2 vHighPrecisionZW;
void main() {
  vec4 tx = vegAtlas(uAtlas, vUv, vAtlas, vList);
  if (tx.a < 0.5) discard;
  gl_FragColor = packDepthToRGBA(0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5);
}`;
  }

  const OKT = /* glsl */`
#define VEG_G ${G}
vec2 vegHemiOkt(vec3 d) { d /= (abs(d.x) + abs(d.y) + abs(d.z)); return vec2(d.x + d.z, d.z - d.x) * 0.5 + 0.5; }
vec3 vegHemiOktDek(vec2 uv) { vec2 e = uv * 2.0 - 1.0; vec3 d = vec3((e.x - e.y) * 0.5, 0.0, (e.x + e.y) * 0.5); d.y = 1.0 - abs(d.x) - abs(d.z); return normalize(d); }
vec3 vegVpravo(vec3 d) { vec3 v = cross(vec3(0.0, 1.0, 0.0), d); return dot(v, v) < 1e-6 ? vec3(1.0, 0.0, 0.0) : normalize(v); }
`;

  // pečení impostorů: každá instance = jeden pohled, kreslí se rovnou do své buňky atlasu
  function peceVS() {
    return '#include <common>\n' + OKT + /* glsl */`
attribute vec4 aAtlas; attribute vec4 aPar; attribute vec2 aRamec;
uniform vec3 uStred; uniform float uR; uniform vec2 uTyp; uniform vec3 uBunka;  // buňka px, šířka, výška
varying vec2 vUv; varying vec4 vAtlas; varying vec4 vPar; varying vec3 vN;
void main() {
  vec3 d = vegHemiOktDek(aRamec / float(VEG_G - 1));
  vec3 vp = vegVpravo(d), nh = cross(d, vp);
  vec3 q = position - uStred;
  vec3 l = vec3(dot(q, vp), dot(q, nh), dot(q, d)) / uR;
  vec2 px = (uTyp * float(VEG_G) + aRamec) * uBunka.x + 1.0 + (l.xy * 0.5 + 0.5) * (uBunka.x - 2.0);
  gl_Position = vec4(px / uBunka.yz * 2.0 - 1.0, -l.z * 0.9, 1.0);
  vUv = uv; vAtlas = aAtlas; vPar = aPar; vN = normal;
}`;
  }
  function peceFS() {
    return '#include <common>\n' + FS_TEX + /* glsl */`
uniform sampler2D uAtlas;
varying vec2 vUv; varying vec4 vAtlas; varying vec4 vPar; varying vec3 vN;
void main() {
  vec4 tx = vegAtlas(uAtlas, vUv, vAtlas, vPar.y);
  if (tx.a < 0.5) discard;
  #ifdef PECE_NORMALA
  gl_FragColor = vec4(normalize(vN) * 0.5 + 0.5, vPar.y > 0.5 ? 0.5 + 0.5 * vPar.x : 0.5 * vPar.x);
  #else
  gl_FragColor = vec4(pow(tx.rgb, vec3(1.0 / 2.2)), 1.0);
  #endif
}`;
  }

  function impVS() {
    return '#include <common>\n#include <shadowmap_pars_vertex>\n' + OKT + /* glsl */`
attribute vec4 aPoloha; attribute vec4 aOtoc;     // x, y, z, měřítko | cos, sin, druh, barva
uniform vec4 uImp[6];                              // výška středu, poloměr, sloupec, řádek
uniform vec4 uLod; uniform float uMaxDist;
varying vec2 vUv; varying vec2 vRamec; varying vec2 vPodil; varying vec3 vWp; varying float vFade; varying vec4 vInst;
void main() {
  int ti = int(aOtoc.z + 0.5);
  vec4 T = uImp[ti];
  float m = aPoloha.w;
  vec3 c = aPoloha.xyz + vec3(0.0, T.x * m, 0.0);
  vec3 k = cameraPosition - c; float dc = length(k); vec3 d = k / max(dc, 1e-3);
  float dist = distance(cameraPosition, aPoloha.xyz);
  float f1 = 1.0 - smoothstep(uLod.z - uLod.w * 0.5, uLod.z + uLod.w * 0.5, dist);
  if (f1 > 0.999 || dist > uMaxDist) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vFade = f1;
  float cs = aOtoc.x, sn = aOtoc.y;
  vec3 dl = vec3(cs * d.x - sn * d.z, max(d.y, 0.0), sn * d.x + cs * d.z);
  dl = normalize(dl + vec3(0.0, 1e-4, 0.0));
  vec2 uvF = vegHemiOkt(dl) * float(VEG_G - 1);
  vec2 zakl = clamp(floor(uvF), 0.0, float(VEG_G - 2));
  vRamec = zakl; vPodil = clamp(uvF - zakl, 0.0, 1.0);
  vec3 vp = vegVpravo(d), nh = cross(d, vp);
  float R = T.y * m;
  vec3 wp = c + (vp * position.x + nh * position.y) * R + d * R * 0.5;
  vUv = position.xy * 0.5 + 0.5;
  vWp = wp; vInst = vec4(cs, sn, aOtoc.z, aOtoc.w);
  vec4 worldPosition = vec4(wp, 1.0);
  vec3 transformedNormal = (viewMatrix * vec4(d, 0.0)).xyz;
  #include <shadowmap_vertex>
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}`;
  }
  function impFS() {
    return fsHlavicka() + '#define VEG_G ' + G + '\n' + /* glsl */`
uniform sampler2D uImpAlb; uniform sampler2D uImpNor; uniform vec4 uImp[6]; uniform vec3 uImpVel;
varying vec2 vUv; varying vec2 vRamec; varying vec2 vPodil; varying vec3 vWp; varying float vFade; varying vec4 vInst;
vec2 vegRamecUv(vec2 f, vec4 T) {
  vec2 px = (T.zw * float(VEG_G) + f) * uImpVel.x + 1.0 + vUv * (uImpVel.x - 2.0);
  return px / uImpVel.yz;
}
void main() {
  vec4 T = uImp[int(vInst.z + 0.5)];
  #ifdef VEG_RAMCE4
  vec2 f = vPodil;
  float w00 = (1.0 - f.x) * (1.0 - f.y), w10 = f.x * (1.0 - f.y), w01 = (1.0 - f.x) * f.y, w11 = f.x * f.y;
  vec2 u00 = vegRamecUv(vRamec, T), u10 = vegRamecUv(vRamec + vec2(1.0, 0.0), T), u01 = vegRamecUv(vRamec + vec2(0.0, 1.0), T), u11 = vegRamecUv(vRamec + vec2(1.0, 1.0), T);
  vec4 a = texture(uImpAlb, u00) * w00 + texture(uImpAlb, u10) * w10 + texture(uImpAlb, u01) * w01 + texture(uImpAlb, u11) * w11;
  vec4 nr = texture(uImpNor, u00) * w00 + texture(uImpNor, u10) * w10 + texture(uImpNor, u01) * w01 + texture(uImpNor, u11) * w11;
  #else
  vec2 uu = vegRamecUv(vRamec + floor(vPodil + 0.5), T);
  vec4 a = texture(uImpAlb, uu), nr = texture(uImpNor, uu);
  #endif
  vec2 g = vUv * uImpVel.x;
  float mip = max(0.0, log2(max(length(dFdx(g)), length(dFdy(g)))));
  a.a *= 1.0 + mip * 0.3;
  if (a.a < 0.5) discard;
  if (vegDither() < vFade) discard;
  vec3 nl = nr.rgb * 2.0 - 1.0;
  vec3 nW = normalize(vec3(vInst.x * nl.x + vInst.y * nl.z, nl.y, -vInst.y * nl.x + vInst.x * nl.z));
  float list = step(0.5, nr.a), ao = list > 0.5 ? (nr.a - 0.5) * 2.0 : nr.a * 2.0;
  float j = vegHash(vInst.xy * 13.7);
  vec3 alb = pow(a.rgb, vec3(2.2)) * vegTon(vInst.w, j, list);
  float stin = vegTerenStin(vWp) * (0.72 + 0.28 * ao);
  vec3 c = vegOsvetli(alb, nW, vWp, ao, list, stin);
  gl_FragColor = vec4(dronAtmo(c, vWp, cameraPosition), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
  }

  // tráva, plodiny, kapradí, rákos a květiny (dlaždice kolem kamery)
  function travaVS() {
    return '#include <common>\n#include <shadowmap_pars_vertex>\n' + VS_SPOL + /* glsl */`
attribute vec2 aMrizka; attribute vec4 aCepel; attribute vec3 aTvar;
uniform sampler2D uVyska; uniform sampler2D uMaska; uniform sampler2D uVoda;
uniform vec4 uMapa;     // polovina světa, krok mřížky, n, 0
uniform vec4 uPrsten;   // vnitřní r, vnější r, rozestup, šíře shluku
varying vec3 vBarva; varying vec3 vN; varying vec3 vWp; varying float vAo; varying vec3 vKvet;
vec3 vegTeren(vec2 xz) {
  vec2 f = clamp((xz + uMapa.x) / uMapa.y, vec2(0.0), vec2(uMapa.z - 1.001));
  ivec2 i = ivec2(f); vec2 t = f - vec2(i);
  float a = texelFetch(uVyska, i, 0).r, b = texelFetch(uVyska, i + ivec2(1, 0), 0).r;
  float c = texelFetch(uVyska, i + ivec2(0, 1), 0).r, d = texelFetch(uVyska, i + ivec2(1, 1), 0).r;
  return vec3(mix(mix(a, b, t.x), mix(c, d, t.x), t.y), vec2(mix(b - a, d - c, t.y), mix(c - a, d - b, t.x)) / uMapa.y);
}
void main() {
  float s = uPrsten.z;
  vec2 bod = modelMatrix[3].xz + aMrizka;
  vec2 id = floor(bod / s + 0.5);
  vec4 h = vegHash42(id), h2 = vegHash42(id + 17.31);
  vec2 zakl = bod + (h.xy - 0.5) * s;
  float pat = vegSum(zakl * 0.045), pat2 = vegSum(zakl * 0.13 + 3.1);
  vec2 uvM = ((zakl + uMapa.x) / uMapa.y + 0.5) / uMapa.z;
  vec4 m = texture(uMaska, uvM);
  float hloubka = texture(uVoda, uvM).r * 4.0;
  // druh porostu: 0 louka, 1 pole, 2 lesní podrost, 3 rákos
  float druh = 0.0, hust = 0.9;
  mat2 rotP = mat2(0.955, 0.296, -0.296, 0.955);
  vec2 pq = rotP * zakl;
  float plodina = vegHash12(floor(pq / vec2(140.0, 90.0)));
  if (hloubka > 0.03) { druh = 3.0; hust = hloubka < 0.5 ? 0.8 * smoothstep(0.3, 0.55, pat) : 0.0; }
  else {
    hust *= 1.0 - smoothstep(0.15, 0.45, m.b);
    if (m.g > 0.45) {
      druh = 1.0; hust = plodina > 0.86 ? 0.3 * hust : hust;
      // řádky: posun na nejbližší řádek ve směru pole
      pq.y = (floor(pq.y / s) + 0.5) * s; zakl = transpose(rotP) * pq;
    }
    else if (m.r > 0.4) { druh = 2.0; hust *= 0.08 + 0.38 * smoothstep(0.35, 0.65, pat2); }
    else if (m.a > 0.82 && pat > 0.5) { druh = 3.0; hust *= 0.6; }
    else hust *= mix(0.5, 1.0, smoothstep(0.2, 0.6, pat));
  }
  vec3 ter = vegTeren(zakl);
  float zem = ter.x;
  hust *= 1.0 - smoothstep(0.75, 1.3, length(ter.yz));
  float dist = distance(vec3(zakl.x, zem, zakl.y), cameraPosition);
  float vel = 1.0 - smoothstep(uPrsten.y * 0.78, uPrsten.y, dist);
  if (uPrsten.x > 0.0) vel *= smoothstep(uPrsten.x * 0.72, uPrsten.x, dist);
  if (h.z > hust) vel = 0.0;
  if (vel <= 0.001) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }

  // parametry druhu
  float vys, sir, rozp, nakl, kvety = 0.0, hlava = 0.035, klas = 0.0;
  vec3 cDol, cHor, cKvet = vec3(1.0), cTerc = vec3(0.9, 0.6, 0.03);
  if (druh < 0.5) {
    vys = mix(0.16, 0.55, smoothstep(0.2, 0.8, pat2)); sir = 0.028; rozp = 0.2; nakl = 0.35;
    float sucho = smoothstep(0.55, 0.85, vegSum(zakl * 0.02 + 9.0));
    cDol = vec3(0.022, 0.04, 0.01); cHor = mix(vec3(0.12, 0.21, 0.04), vec3(0.30, 0.27, 0.10), sucho * 0.65);
    float kv = vegSum(zakl * 0.07 + 21.0);
    kvety = smoothstep(0.6, 0.7, kv) * step(h2.x, 0.85);
    float kd = vegSum(zakl * 0.031 + 40.0);
    cKvet = kd < 0.4 ? vec3(0.85, 0.85, 0.8) : kd < 0.62 ? vec3(0.95, 0.72, 0.03) : vec3(0.32, 0.1, 0.5);
    if (kd >= 0.4) cTerc = cKvet * 0.7;
  } else if (druh < 1.5) {
    rozp = 0.07; nakl = 0.06; sir = 0.014;
    if (plodina < 0.42) { vys = 0.85; cDol = vec3(0.22, 0.16, 0.05); cHor = vec3(0.55, 0.42, 0.16); klas = 1.0; }
    else if (plodina < 0.66) { vys = 0.45; cDol = vec3(0.04, 0.09, 0.015); cHor = vec3(0.13, 0.27, 0.05); }
    else if (plodina < 0.86) { vys = 1.05; cDol = vec3(0.05, 0.09, 0.02); cHor = vec3(0.16, 0.24, 0.05); kvety = 1.0; hlava = 0.07; cKvet = vec3(0.95, 0.8, 0.02); cTerc = cKvet; }
    else { vys = 0.12; cDol = vec3(0.25, 0.2, 0.09); cHor = vec3(0.45, 0.38, 0.18); sir = 0.01; }
  } else if (druh < 2.5) {
    vys = 0.55; sir = 0.075; rozp = 0.16; nakl = 1.0;
    cDol = vec3(0.02, 0.05, 0.01); cHor = vec3(0.09, 0.2, 0.04);
  } else {
    vys = 1.6; sir = 0.022; rozp = 0.12; nakl = 0.12;
    cDol = vec3(0.07, 0.08, 0.03); cHor = vec3(0.28, 0.3, 0.12);
    kvety = step(0.5, h2.y); hlava = 0.09; cKvet = vec3(0.13, 0.07, 0.03); cTerc = cKvet;
  }
  rozp *= uPrsten.w; sir *= mix(1.0, uPrsten.w, 0.6);

  // čepel
  float uhelShl = h.w * 6.2832;
  vec2 cs = vec2(cos(uhelShl), sin(uhelShl));
  vec2 off = vec2(cs.x * aCepel.x - cs.y * aCepel.y, cs.y * aCepel.x + cs.x * aCepel.y) * rozp;
  vec2 koren = zakl + off;
  float bv = vys * (0.6 + 0.65 * aCepel.w) * vel * (0.85 + 0.3 * h2.z);
  if (aTvar.z > 0.5) bv *= 1.12;
  float jeHlava = step(1.5, aTvar.z);
  float t = jeHlava > 0.5 ? 1.0 : aTvar.x;
  float fac = aCepel.z + uhelShl;
  vec2 smerL = vec2(cos(fac), sin(fac));
  vec2 B = normalize(off + vec2(-smerL.y, smerL.x) * 0.05 * rozp + 1e-4) * nakl * (0.5 + aCepel.w);
  float g = vegNaraz(koren), vs = length(uWind);
  B += uWind * (0.02 + 0.05 * g) * (0.75 + 0.25 * sin(uTime * 3.0 + h.z * 6.28 + aCepel.w * 3.0)) * (druh > 2.5 ? 0.5 : 1.0);
  // proplach vrtulí: rozfoukání do kruhu + vlnky
  vec2 rel = koren - uDronPos.xz; float r = length(rel);
  float vd = max(uDronPos.y - zem, 0.0);
  float pp = uDronTah * (1.0 - smoothstep(1.5, 9.0, vd)) * exp(-r * r / (1.5 + vd * vd * 1.4));
  float vlnka = 0.75 + 0.45 * sin(r * 3.2 - uTime * 16.0 + aCepel.w * 2.0);
  B += rel / max(r, 0.05) * pp * 2.4 * vlnka;
  float bl = length(B), th = min(bl, 1.45);
  vec2 bd = B / max(bl, 1e-4);
  float ug = th * t;
  float hor = th > 0.001 ? (1.0 - cos(ug)) / th : 0.0;
  float ver = th > 0.001 ? sin(ug) / th : t;
  vec3 p = vec3(koren.x, zem, koren.y) + vec3(bd.x * hor, ver, bd.y * hor) * bv;
  vec3 tang = normalize(vec3(bd.x * sin(ug), cos(ug), bd.y * sin(ug)));
  vec3 strana = vec3(smerL.x, 0.0, smerL.y);
  float w = sir * pow(1.0 - t * 0.92, 0.8) * (1.0 + klas * 1.8 * smoothstep(0.62, 0.75, t));
  p += strana * aTvar.y * w * 0.5 * (1.0 - jeHlava) * min(1.0, vel * 2.0);
  vKvet = vec3(0.0);
  float ukazHlavu = (kvety > h2.w || (kvety > 0.5 && druh > 0.5)) ? 1.0 : 0.0;
  if (jeHlava > 0.5) {
    vec3 fw = normalize(cross(strana, vec3(0.0, 1.0, 0.0)));
    float hs = hlava * ukazHlavu * min(1.0, vel * 2.0);
    if (druh > 2.5) p += strana * aTvar.x * hs * 0.25 + vec3(0.0, (aTvar.y * 0.5 + 0.5) * hs * 1.6, 0.0);
    else p += (strana * aTvar.x + fw * aTvar.y) * hs + tang * hs * 0.2;
    vKvet = vec3(aTvar.xy, druh > 2.5 ? 2.0 : 1.0);
  }
  vec3 nb = normalize(cross(tang, strana));
  if (dot(nb, cameraPosition - p) < 0.0) nb = -nb;
  vec3 nTer = normalize(vec3(-ter.y, 1.0, -ter.z));
  vN = normalize(mix(nb, nTer, druh > 1.5 && druh < 2.5 ? 0.35 : 0.55));
  if (jeHlava > 0.5) vN = normalize(mix(nTer, vec3(0.0, 1.0, 0.0), 0.5));
  float jas = 0.8 + 0.35 * h2.y;
  vBarva = mix(cDol, cHor, smoothstep(0.0, 0.9, t)) * jas;
  vBarva *= 1.0 + g * vs * 0.03 * t;                         // lesk vln ve větru
  if (jeHlava > 0.5) vBarva = cKvet;
  vAo = mix(0.35, 1.0, t);
  vWp = p;
  vec4 worldPosition = vec4(p, 1.0);
  vec3 transformedNormal = (viewMatrix * vec4(vN, 0.0)).xyz;
  #include <shadowmap_vertex>
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}`;
  }
  function travaFS() {
    return fsHlavicka() + /* glsl */`
varying vec3 vBarva; varying vec3 vN; varying vec3 vWp; varying float vAo; varying vec3 vKvet;
void main() {
  vec3 alb = vBarva;
  float ao = vAo;
  if (vKvet.z > 0.5 && vKvet.z < 1.5) {
    float rr = length(vKvet.xy), a = atan(vKvet.y, vKvet.x);
    if (rr > 0.72 + 0.28 * cos(a * 6.0)) discard;
    if (rr < 0.3) alb = vBarva.r > 0.7 && vBarva.b > 0.5 ? vec3(0.9, 0.6, 0.03) : vBarva * 0.6;
    ao = 1.0;
  } else if (vKvet.z > 1.5) {
    if (abs(vKvet.x) > 0.8) discard;
    ao = 0.8;
  }
  float stin = getShadowMask() * vegTerenStin(vWp);
  vec3 n = normalize(vN);
  vec3 c = vegOsvetli(alb, n, vWp, ao, 1.0, stin);
  gl_FragColor = vec4(dronAtmo(c, vWp, cameraPosition), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
  }

  // ======================================================================
  // Stav modulu
  // ======================================================================
  const S = {
    ctx: null, pripraveno: false, nast: NAST[2], q: 2,
    stromy: new Float32Array(0), typy: null, inst: null, mriz: null,
    geo: [], obal: [], sady: [[], []], impBloky: [], trava: [], kameny: null,
    skupina: null, travaSkupina: null,
    posl: { x: 1e9, y: 0, z: 0, dx: 0, dy: 0, dz: 0, cas: -1e9 }, vynutit: true, cas: 0, svetlaCas: -1e9,
    rozdelMs: 0, impBunka: 0, rtA: null, rtN: null, kamFr: null, frustum: null, koule: null, mat4: null,
  };
  const U = {
    uAtlas: { value: null }, uAmbZaloha: { value: 0 }, uLod: { value: new THREE.Vector4(-1000, 1, 200, 30) },
    uMaxDist: { value: MAX_DALKA },
    uImpAlb: { value: null }, uImpNor: { value: null }, uImpVel: { value: new THREE.Vector3(96, 1, 1) },
    uImp: { value: [0, 1, 2, 3, 4, 5].map(() => new THREE.Vector4()) },
    uVyska: { value: null }, uMaska: { value: null }, uVoda: { value: null }, uMapa: { value: new THREE.Vector4() },
  };

  function uniformy(vlastni) {
    const u = THREE.UniformsUtils.merge([THREE.UniformsLib.lights]);
    return Object.assign(u, D.U, U, vlastni || {});
  }
  function shader(vs, fs, o) {
    return new THREE.ShaderMaterial(Object.assign({ vertexShader: vs, fragmentShader: fs, lights: true, side: THREE.DoubleSide, uniforms: uniformy(o && o.u) }, o && o.m));
  }

  // ---------- mřížka buněk pro rychlý výběr podle vzdálenosti ----------
  function mrizka(pole, krok) {
    const k = pole.length / krok, NB = 4096 / BUNKA, pul = 2048;
    const id = new Uint16Array(k), zac = new Uint32Array(NB * NB + 1);
    const minY = new Float32Array(NB * NB).fill(1e9), maxY = new Float32Array(NB * NB).fill(-1e9);
    for (let i = 0; i < k; i++) {
      const o = i * krok;
      const bx = clamp(Math.floor((pole[o] + pul) / BUNKA), 0, NB - 1), bz = clamp(Math.floor((pole[o + 2] + pul) / BUNKA), 0, NB - 1);
      const b = bz * NB + bx; id[i] = b; zac[b + 1]++;
      if (pole[o + 1] < minY[b]) minY[b] = pole[o + 1]; if (pole[o + 1] > maxY[b]) maxY[b] = pole[o + 1];
    }
    for (let b = 0; b < NB * NB; b++) zac[b + 1] += zac[b];
    const kurzor = zac.slice(0, NB * NB), poradi = new Uint32Array(k);
    for (let i = 0; i < k; i++) poradi[kurzor[id[i]]++] = i;
    return { NB, zac, poradi, minY, maxY };
  }

  // ---------- stromy: data, impostorové bloky, instanční sady ----------
  function nastavStromy(pole) {
    const k = pole.length / 6;
    S.stromy = pole;
    S.typy = new Uint8Array(k);
    S.inst = new Float32Array(k * 4);
    S.pocty = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < k; i++) {
      const t = clamp(Math.round(pole[i * 6 + 3]) | 0, 0, 5), a = pole[i * 6 + 5];
      S.typy[i] = t; S.pocty[t]++;
      S.inst[i * 4] = Math.cos(a); S.inst[i * 4 + 1] = Math.sin(a);
      S.inst[i * 4 + 2] = D.hash2(i, 7, 11); S.inst[i * 4 + 3] = D.hash2(i, 3, 5);
    }
    S.mriz = mrizka(pole, 6);
    // nejvíc stromů daného druhu v jedné buňce (pro velikost instančních bufferů)
    S.maxVBunce = [0, 0, 0, 0, 0, 0];
    const M = S.mriz, c = [0, 0, 0, 0, 0, 0];
    for (let b = 0; b < M.NB * M.NB; b++) {
      if (M.zac[b] === M.zac[b + 1]) continue;
      c.fill(0);
      for (let q = M.zac[b]; q < M.zac[b + 1]; q++) c[S.typy[M.poradi[q]]]++;
      for (let t = 0; t < 6; t++) if (c[t] > S.maxVBunce[t]) S.maxVBunce[t] = c[t];
    }
    postavImpostory();
    if (S.pripraveno) postavSady();
    S.vynutit = true;
  }

  const QUAD_POS = new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3);
  const QUAD_IDX = new THREE.Uint16BufferAttribute([0, 1, 2, 0, 2, 3], 1);

  function postavImpostory() {
    for (const m of S.impBloky) { S.skupina.remove(m); m.geometry.dispose(); }
    S.impBloky = [];
    const st = S.stromy, k = st.length / 6, NBb = 4096 / BLOK, seznamy = [];
    for (let b = 0; b < NBb * NBb; b++) seznamy.push([]);
    for (let i = 0; i < k; i++) {
      const bx = clamp(Math.floor((st[i * 6] + 2048) / BLOK), 0, NBb - 1), bz = clamp(Math.floor((st[i * 6 + 2] + 2048) / BLOK), 0, NBb - 1);
      seznamy[bz * NBb + bx].push(i);
    }
    for (const sez of seznamy) {
      if (!sez.length) continue;
      const n = sez.length, aP = new Float32Array(n * 4), aO = new Float32Array(n * 4);
      const box = new THREE.Box3();
      for (let j = 0; j < n; j++) {
        const i = sez[j], o = i * 6;
        aP[j * 4] = st[o]; aP[j * 4 + 1] = st[o + 1]; aP[j * 4 + 2] = st[o + 2]; aP[j * 4 + 3] = st[o + 4];
        aO[j * 4] = S.inst[i * 4]; aO[j * 4 + 1] = S.inst[i * 4 + 1]; aO[j * 4 + 2] = S.typy[i]; aO[j * 4 + 3] = S.inst[i * 4 + 2];
        box.expandByPoint(new THREE.Vector3(st[o], st[o + 1], st[o + 2]));
      }
      box.max.y += 40;
      const g = new THREE.InstancedBufferGeometry();
      g.setIndex(QUAD_IDX); g.setAttribute('position', QUAD_POS);
      const uvol = function () { this.array = null; };
      g.setAttribute('aPoloha', new THREE.InstancedBufferAttribute(aP, 4).onUpload(uvol));
      g.setAttribute('aOtoc', new THREE.InstancedBufferAttribute(aO, 4).onUpload(uvol));
      g.instanceCount = n;
      g.boundingSphere = box.getBoundingSphere(new THREE.Sphere()); g.boundingSphere.radius += 15;
      g.boundingBox = box;
      const m = new THREE.Mesh(g, S.matImp);
      m.frustumCulled = true; m.castShadow = false; m.receiveShadow = false; m.name = 'vegetace-impostory';
      S.impBloky.push(m); S.skupina.add(m);
    }
  }

  function odhadKapacity(t, R) {
    const bunek = Math.ceil(Math.PI * Math.pow(R / BUNKA + 1.5, 2));
    return Math.max(16, Math.min(S.pocty[t], S.maxVBunce[t] * bunek) + 16);
  }

  function postavSady() {
    for (const l of [0, 1]) for (const s of S.sady[l]) if (s) { S.skupina.remove(s.mesh); s.ig.dispose(); }
    S.sady = [[], []];
    const n = S.nast;
    for (const l of [0, 1]) for (let t = 0; t < 6; t++) {
      if (!S.pocty[t] || (l === 0 && n.r0 <= 0)) { S.sady[l][t] = null; continue; }
      const R = l === 0 ? n.r0 + n.p0 / 2 + OKRAJ : n.r1 + n.p1 / 2 + OKRAJ;
      const cap = odhadKapacity(t, R), geo = S.geo[t][l];
      const ig = new THREE.InstancedBufferGeometry();
      ig.setIndex(geo.index);
      for (const jm in geo.attributes) ig.setAttribute(jm, geo.attributes[jm]);
      const p = new Float32Array(cap * 4), o = new Float32Array(cap * 4);
      const aP = new THREE.InstancedBufferAttribute(p, 4).setUsage(THREE.DynamicDrawUsage);
      const aO = new THREE.InstancedBufferAttribute(o, 4).setUsage(THREE.DynamicDrawUsage);
      ig.setAttribute('aPoloha', aP); ig.setAttribute('aOtoc', aO);
      ig.instanceCount = 0;
      const mesh = new THREE.Mesh(ig, S.matStrom[l]);
      mesh.frustumCulled = false; mesh.visible = false; mesh.name = 'vegetace-' + D.STROMY[t].jmeno + '-lod' + l;
      mesh.customDepthMaterial = S.matHloubka;
      mesh.castShadow = S.q >= 1 && (l === 0 || n.stinLod1);
      mesh.receiveShadow = true;
      S.skupina.add(mesh);
      S.sady[l][t] = { mesh, ig, aP, aO, p, o, cap, n: 0, troj: geo.index.count / 3 };
    }
    S.vynutit = true;
  }

  function zapis(s, i) {
    if (!s || s.n >= s.cap) return;
    const j = s.n++ * 4, o = i * 6, st = S.stromy, I = S.inst;
    s.p[j] = st[o]; s.p[j + 1] = st[o + 1]; s.p[j + 2] = st[o + 2]; s.p[j + 3] = st[o + 4];
    s.o[j] = I[i * 4]; s.o[j + 1] = I[i * 4 + 1]; s.o[j + 2] = I[i * 4 + 2]; s.o[j + 3] = I[i * 4 + 3];
  }
  function odesli(a, n) {
    if (a.clearUpdateRanges) { a.clearUpdateRanges(); a.addUpdateRange(0, Math.max(4, n * 4)); }
    else a.updateRange = { offset: 0, count: Math.max(4, n * 4) };
    a.needsUpdate = true;
  }

  // rozšířený výhled kamery (aby otočení hlavy nebo zpoždění přepočtu nic neodkrylo)
  function pripravFrustum(k, dalka) {
    const f = S.kamFr;
    f.position.copy(k.position); f.quaternion.copy(k.quaternion);
    f.fov = Math.min(165, (k.fov || 65) * 1.3 + 16); f.aspect = k.aspect || 1.6; f.near = 0.1; f.far = dalka;
    f.updateProjectionMatrix(); f.updateMatrixWorld(true);
    S.mat4.multiplyMatrices(f.projectionMatrix, f.matrixWorldInverse);
    S.frustum.setFromProjectionMatrix(S.mat4);
  }
  function bunkaVidet(M, b, x0, z0, vnitr) {
    if (vnitr) return true;
    S.koule.center.set(x0 + BUNKA / 2, (M.minY[b] + M.maxY[b]) / 2 + 12, z0 + BUNKA / 2);
    S.koule.radius = BUNKA * 0.71 + (M.maxY[b] - M.minY[b]) / 2 + 30;
    return S.frustum.intersectsSphere(S.koule);
  }

  // přiřazení stromů do LOD0 / LOD1 podle vzdálenosti od kamery
  function rozdel() {
    const t0 = performance.now();
    const k = S.ctx.kamera, n = S.nast, st = S.stromy, M = S.mriz;
    k.updateMatrixWorld();
    const cx = k.position.x, cy = k.position.y, cz = k.position.z;
    const d0 = n.r0 > 0 ? n.r0 + n.p0 * 0.5 + OKRAJ : -1;
    const d1a = n.r0 > 0 ? Math.max(0, n.r0 - n.p0 * 0.5 - OKRAJ) : 0, d1b = n.r1 + n.p1 * 0.5 + OKRAJ;
    const d0q = d0 > 0 ? d0 * d0 : -1, d1aq = d1a * d1a, d1bq = d1b * d1b;
    pripravFrustum(k, d1b + 200);
    for (const l of [0, 1]) for (const s of S.sady[l]) if (s) s.n = 0;
    if (M && st.length) {
      const NB = M.NB, pul = 2048;
      const bx0 = Math.max(0, Math.floor((cx - d1b + pul) / BUNKA)), bx1 = Math.min(NB - 1, Math.floor((cx + d1b + pul) / BUNKA));
      const bz0 = Math.max(0, Math.floor((cz - d1b + pul) / BUNKA)), bz1 = Math.min(NB - 1, Math.floor((cz + d1b + pul) / BUNKA));
      const S0 = S.sady[0], S1 = S.sady[1];
      for (let bz = bz0; bz <= bz1; bz++) for (let bx = bx0; bx <= bx1; bx++) {
        const b = bz * NB + bx, a = M.zac[b], e = M.zac[b + 1];
        if (a === e) continue;
        const x0 = bx * BUNKA - pul, z0 = bz * BUNKA - pul;
        const ddx = Math.max(x0 - cx, 0, cx - x0 - BUNKA), ddz = Math.max(z0 - cz, 0, cz - z0 - BUNKA);
        if (ddx * ddx + ddz * ddz > d1bq) continue;
        if (!bunkaVidet(M, b, x0, z0, ddx === 0 && ddz === 0)) continue;
        for (let q = a; q < e; q++) {
          const i = M.poradi[q], o = i * 6;
          const dx = st[o] - cx, dy = st[o + 1] - cy, dz = st[o + 2] - cz, dd = dx * dx + dy * dy + dz * dz;
          if (dd < d0q) zapis(S0[S.typy[i]], i);
          if (dd >= d1aq && dd < d1bq) zapis(S1[S.typy[i]], i);
        }
      }
    }
    for (const l of [0, 1]) for (const s of S.sady[l]) if (s) {
      s.ig.instanceCount = s.n; s.mesh.visible = s.n > 0;
      if (s.n) { odesli(s.aP, s.n); odesli(s.aO, s.n); }
    }
    rozdelKameny(cx, cy, cz);
    S.posl.x = cx; S.posl.y = cy; S.posl.z = cz; S.posl.cas = S.cas;
    const dir = k.getWorldDirection(S.v3); S.posl.dx = dir.x; S.posl.dy = dir.y; S.posl.dz = dir.z;
    S.vynutit = false;
    S.rozdelMs = performance.now() - t0;
  }

  // ---------- pečení impostorů ----------
  function pecImpostory(bunka) {
    const r = S.ctx.renderer;
    const W = 3 * G * bunka, H = 2 * G * bunka;
    if (S.rtA) { S.rtA.dispose(); S.rtN.dispose(); }
    const opt = { minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true, depthBuffer: true };
    S.rtA = new THREE.WebGLRenderTarget(W, H, opt); S.rtN = new THREE.WebGLRenderTarget(W, H, opt);
    const scena = new THREE.Scene(), kam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const ramce = new Float32Array(G * G * 2);
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { ramce[(j * G + i) * 2] = i; ramce[(j * G + i) * 2 + 1] = j; }
    const aRamec = new THREE.InstancedBufferAttribute(ramce, 2);
    const meshe = [];
    for (let t = 0; t < 6; t++) {
      const geo = S.geo[t][0], b = S.obal[t];
      const ig = S.peceGeo[t] || (S.peceGeo[t] = new THREE.InstancedBufferGeometry());
      ig.setIndex(geo.index);
      for (const jm in geo.attributes) ig.setAttribute(jm, geo.attributes[jm]);
      ig.setAttribute('aRamec', aRamec); ig.instanceCount = G * G;
      const u = { uAtlas: U.uAtlas, uStred: { value: b.stred }, uR: { value: b.R }, uTyp: { value: new THREE.Vector2(t % 3, Math.floor(t / 3)) }, uBunka: { value: new THREE.Vector3(bunka, W, H) } };
      const mA = new THREE.ShaderMaterial({ vertexShader: peceVS(), fragmentShader: peceFS(), uniforms: u, side: THREE.DoubleSide });
      const mN = new THREE.ShaderMaterial({ vertexShader: peceVS(), fragmentShader: peceFS(), uniforms: u, side: THREE.DoubleSide, defines: { PECE_NORMALA: 1 } });
      const m = new THREE.Mesh(ig, mA); m.frustumCulled = false; scena.add(m);
      meshe.push({ m, mA, mN });
      U.uImp.value[t].set(b.stred.y, b.R, t % 3, Math.floor(t / 3));
    }
    const puvC = r.getClearColor(new THREE.Color()), puvA = r.getClearAlpha(), puvRT = r.getRenderTarget();
    const puvAuto = r.autoClear; r.autoClear = true;
    r.setClearColor(new THREE.Color().setRGB(0.2, 0.26, 0.13, THREE.LinearSRGBColorSpace), 0);
    r.setRenderTarget(S.rtA); r.render(scena, kam);
    for (const x of meshe) x.m.material = x.mN;
    r.setClearColor(new THREE.Color().setRGB(0.5, 1.0, 0.5, THREE.LinearSRGBColorSpace), 0.9);
    r.setRenderTarget(S.rtN); r.render(scena, kam);
    r.setRenderTarget(puvRT); r.setClearColor(puvC, puvA); r.autoClear = puvAuto;
    for (const x of meshe) { x.mA.dispose(); x.mN.dispose(); }
    U.uImpAlb.value = S.rtA.texture; U.uImpNor.value = S.rtN.texture;
    U.uImpVel.value.set(bunka, W, H);
    S.impBunka = bunka;
  }

  // ---------- tráva ----------
  function stavShluk(B, Sg, nKvet, r) {
    const cep = [], tv = [], idx = [];
    for (let b = 0; b < B; b++) {
      const a = r() * 6.283, rad = Math.sqrt(r()) * (b === 0 ? 0.2 : 1);
      const bx = Math.cos(a) * rad, bz = Math.sin(a) * rad, fac = r() * 6.283, nah = r();
      const kvet = b < nKvet ? 1 : 0, zac = cep.length / 4;
      for (let i = 0; i <= Sg; i++) {
        const t = i / Sg;
        if (i < Sg) { cep.push(bx, bz, fac, nah, bx, bz, fac, nah); tv.push(t, -1, kvet, t, 1, kvet); }
        else { cep.push(bx, bz, fac, nah); tv.push(1, 0, kvet); }
      }
      for (let i = 0; i < Sg - 1; i++) { const p = zac + 2 * i; idx.push(p, p + 1, p + 3, p, p + 3, p + 2); }
      const p = zac + 2 * (Sg - 1); idx.push(p, p + 1, zac + 2 * Sg);
      if (kvet) {
        const h = cep.length / 4;
        for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { cep.push(bx, bz, fac, nah); tv.push(u, v, 2); }
        idx.push(h, h + 1, h + 2, h, h + 2, h + 3);
      }
    }
    return { cep, tv, idx };
  }

  function postavTravu() {
    for (const pr of S.trava) { for (const m of pr.meshe) S.travaSkupina.remove(m); pr.geo.dispose(); pr.mat.dispose(); }
    S.trava = [];
    const cfg = S.nast.trava;
    if (!cfg) return;
    cfg.forEach((c, ip) => {
      const r = D.Nahoda('vegetace:trava:' + ip);
      const sh = stavShluk(c.B, c.S, c.kvety, r);
      const strana = 2 * c.rOut + 2 * c.s;
      const n = Math.ceil(strana / c.T / c.s), dlazdice = n * c.s;
      const mriz = new Float32Array(n * n * 2);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { mriz[(j * n + i) * 2] = i * c.s; mriz[(j * n + i) * 2 + 1] = j * c.s; }
      const geo = new THREE.InstancedBufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(sh.tv.length), 3));   // jen kvůli počtu vrcholů
      geo.setAttribute('aCepel', new THREE.Float32BufferAttribute(sh.cep, 4));
      geo.setAttribute('aTvar', new THREE.Float32BufferAttribute(sh.tv, 3));
      geo.setIndex(sh.idx);
      geo.setAttribute('aMrizka', new THREE.InstancedBufferAttribute(mriz, 2));
      geo.instanceCount = n * n;
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(dlazdice / 2, 0, dlazdice / 2), dlazdice * 0.75 + 30);
      const mat = shader(travaVS(), travaFS(), { u: { uPrsten: { value: new THREE.Vector4(c.rIn, c.rOut, c.s, c.sir) } } });
      const meshe = [];
      for (let k = 0; k < c.T * c.T; k++) {
        const m = new THREE.Mesh(geo, mat);
        m.frustumCulled = true; m.receiveShadow = true; m.castShadow = false; m.matrixAutoUpdate = true; m.name = 'vegetace-trava';
        meshe.push(m); S.travaSkupina.add(m);
      }
      S.trava.push({ c, geo, mat, meshe, n, dlazdice, troj: sh.idx.length / 3 });
    });
  }
  function posunTravu() {
    const k = S.ctx.kamera.position, t = S.ctx.teren;
    let maxR = 0;
    for (const pr of S.trava) {
      const c = pr.c, pul = Math.floor(c.T * pr.n / 2);
      const ox = (Math.round(k.x / c.s) - pul) * c.s, oz = (Math.round(k.z / c.s) - pul) * c.s;
      for (let j = 0; j < c.T; j++) for (let i = 0; i < c.T; i++) {
        const x = ox + i * pr.dlazdice, z = oz + j * pr.dlazdice;
        pr.meshe[j * c.T + i].position.set(x, t.vyska(x + pr.dlazdice / 2, z + pr.dlazdice / 2), z);
      }
      maxR = Math.max(maxR, c.rOut);
    }
    S.travaSkupina.visible = S.trava.length > 0 && k.y - t.vyska(k.x, k.z) < maxR;
  }

  // ---------- kameny ----------
  function hladkeNormaly(geo) {
    const p = geo.attributes.position, n = p.count, mapa = new Map(), sum = [];
    const klic = i => Math.round(p.getX(i) * 1e4) + ',' + Math.round(p.getY(i) * 1e4) + ',' + Math.round(p.getZ(i) * 1e4);
    geo.computeVertexNormals();
    const nr = geo.attributes.normal;
    for (let i = 0; i < n; i++) { const k = klic(i); let s = mapa.get(k); if (!s) { s = [0, 0, 0]; mapa.set(k, s); } s[0] += nr.getX(i); s[1] += nr.getY(i); s[2] += nr.getZ(i); sum.push(s); }
    for (let i = 0; i < n; i++) { const s = V.norm(sum[i]); nr.setXYZ(i, s[0], s[1], s[2]); }
  }
  function stavKamen(detail, seed) {
    const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position;
    const s1 = D.Simplex(seed + ':a'), s2 = D.Simplex(seed + ':b');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = 0.3 * s1(x * 1.3 + y * 0.4, z * 1.3 - y * 0.7) + 0.1 * s2(x * 3.1 - z, y * 3.1 + z * 0.5);
      let r = 1 + n, yy = y * r * 0.62;
      if (yy < -0.2) yy = -0.2 + (yy + 0.2) * 0.3;
      p.setXYZ(i, x * r, yy, z * r * 0.9);
    }
    hladkeNormaly(g);
    const nr = g.attributes.normal, barvy = new Float32Array(p.count * 3), uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const ny = nr.getY(i), mech = hladce(0.45, 0.85, ny) * (0.5 + 0.5 * s2(p.getX(i) * 2, p.getZ(i) * 2));
      const tma = 0.65 + 0.35 * hladce(-0.6, 0.3, ny);
      barvy[i * 3] = (1 - mech * 0.55) * tma; barvy[i * 3 + 1] = (1 - mech * 0.2) * tma; barvy[i * 3 + 2] = (1 - mech * 0.7) * tma;
      uv.setXY(i, (p.getX(i) + p.getZ(i) * 0.7) * 0.5, (p.getY(i) + p.getZ(i) * 0.3) * 0.5);
    }
    g.setAttribute('color', new THREE.BufferAttribute(barvy, 3));
    return g;
  }
  function nahradniKameny(t) {
    const r = D.Nahoda((S.ctx.seed || 'x') + ':vegetace-kameny'), out = [], m = [0, 0, 0, 0];
    for (let k = 0; k < 80000 && out.length < 2500 * 5; k++) {
      const x = r.mezi(-2000, 2000), z = r.mezi(-2000, 2000);
      if (t.hladina(x, z) > -Infinity) continue;
      const sk = t.sklon(x, z); t.maska(x, z, m);
      if (m[2] > 60) continue;
      const p = sk > 0.45 ? 0.5 : m[1] > 120 ? 0.004 : m[0] > 100 ? 0.05 : 0.012;
      if (r() > p) continue;
      out.push(x, t.vyska(x, z), z, r.mezi(0.25, 1.0) * (r() < 0.1 ? 2.4 : 1), r() * 6.283);
    }
    return new Float32Array(out);
  }
  function nastavKameny(pole) {
    if (S.kameny) { for (const m of S.kameny.meshe) { S.skupina.remove(m); m.dispose && m.dispose(); } }
    const k = pole.length / 5;
    if (!k) { S.kameny = null; return; }
    const mat = S.matKamen, mtx = new Float32Array(k * 16), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
    for (let i = 0; i < k; i++) {
      const o = i * 5, s = pole[o + 3], h1 = D.hash2(i, 1, 99), h2 = D.hash2(i, 2, 99), h3 = D.hash2(i, 3, 99);
      e.set((h1 - 0.5) * 0.35, pole[o + 4], (h2 - 0.5) * 0.35); q.setFromEuler(e);
      sc.set(s * (0.8 + 0.5 * h1), s * (0.65 + 0.45 * h3), s * (0.8 + 0.4 * h2));
      ps.set(pole[o], pole[o + 1] - 0.18 * sc.y, pole[o + 2]);
      m4.compose(ps, q, sc); m4.toArray(mtx, i * 16);
    }
    const cap = Math.min(k, 6000);
    const meshe = [S.geoKamen[0], S.geoKamen[1]].map((g, l) => {
      const m = new THREE.InstancedMesh(g, mat, cap);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; m.frustumCulled = false;
      m.castShadow = l === 0; m.receiveShadow = true; m.name = 'vegetace-kameny-lod' + l;
      S.skupina.add(m); return m;
    });
    S.kameny = { pole, mtx, mriz: mrizka(pole, 5), meshe, cap, n: [0, 0] };
  }
  function rozdelKameny(cx, cy, cz) {
    const K = S.kameny; if (!K) return;
    const n = S.nast, R = n.kamenyR, Rb = n.kamenyBlizko, M = K.mriz, NB = M.NB, pul = 2048;
    K.n = [0, 0];
    const a0 = K.meshe[0].instanceMatrix.array, a1 = K.meshe[1].instanceMatrix.array;
    const bx0 = Math.max(0, Math.floor((cx - R + pul) / BUNKA)), bx1 = Math.min(NB - 1, Math.floor((cx + R + pul) / BUNKA));
    const bz0 = Math.max(0, Math.floor((cz - R + pul) / BUNKA)), bz1 = Math.min(NB - 1, Math.floor((cz + R + pul) / BUNKA));
    for (let bz = bz0; bz <= bz1; bz++) for (let bx = bx0; bx <= bx1; bx++) {
      const b = bz * NB + bx, a = M.zac[b], e = M.zac[b + 1];
      if (a === e) continue;
      const x0 = bx * BUNKA - pul, z0 = bz * BUNKA - pul;
      const ddx = Math.max(x0 - cx, 0, cx - x0 - BUNKA), ddz = Math.max(z0 - cz, 0, cz - z0 - BUNKA);
      if (ddx * ddx + ddz * ddz > R * R) continue;
      if (!bunkaVidet(M, b, x0, z0, ddx === 0 && ddz === 0)) continue;
      for (let q = a; q < e; q++) {
        const i = M.poradi[q], o = i * 5, p = K.pole;
        const dx = p[o] - cx, dy = p[o + 1] - cy, dz = p[o + 2] - cz, dd = dx * dx + dy * dy + dz * dz;
        if (dd > R * R) continue;
        const l = dd < Rb * Rb ? 0 : 1;
        if (K.n[l] >= K.cap) continue;
        (l ? a1 : a0).set(K.mtx.subarray(i * 16, i * 16 + 16), K.n[l]++ * 16);
      }
    }
    for (const l of [0, 1]) {
      const m = K.meshe[l]; m.count = K.n[l]; m.visible = K.n[l] > 0;
      const a = m.instanceMatrix;
      if (a.clearUpdateRanges) { a.clearUpdateRanges(); a.addUpdateRange(0, Math.max(16, K.n[l] * 16)); } else a.updateRange = { offset: 0, count: Math.max(16, K.n[l] * 16) };
      a.needsUpdate = true;
    }
  }

  // ---------- textury terénu pro trávu ----------
  function texturyTerenu(t) {
    const n = t.n;
    const ext = D.U.uVyskaMapa && D.U.uVyskaMapa.value;
    if (ext && ext.image && ext.image.data instanceof Float32Array && ext.image.width === n && ext.image.height === n &&
        ext.image.data.length === n * n && Math.abs(ext.image.data[(n >> 1) * n + (n >> 1)] - t.vysky[(n >> 1) * n + (n >> 1)]) < 0.01) {
      U.uVyska.value = ext; S.vlastniVyska = false;
    } else {
      const h = new THREE.DataTexture(t.vysky, n, n, THREE.RedFormat, THREE.FloatType);
      h.minFilter = h.magFilter = THREE.NearestFilter; h.generateMipmaps = false; h.needsUpdate = true;
      U.uVyska.value = h; S.vlastniVyska = true;
    }
    const m = new THREE.DataTexture(t.maska, n, n, THREE.RGBAFormat, THREE.UnsignedByteType);
    m.minFilter = m.magFilter = THREE.LinearFilter; m.generateMipmaps = false; m.needsUpdate = true;
    U.uMaska.value = m;
    const w = new Uint8Array(n * n);
    if (t.voda) for (let i = 0; i < n * n; i++) { const d = t.voda[i] - t.vysky[i]; if (t.voda[i] > -9999 && d > 0) w[i] = Math.min(255, d / 4 * 255); }
    const vt = new THREE.DataTexture(w, n, n, THREE.RedFormat, THREE.UnsignedByteType);
    vt.minFilter = vt.magFilter = THREE.LinearFilter; vt.generateMipmaps = false; vt.unpackAlignment = 1; vt.needsUpdate = true;
    U.uVoda.value = vt;
    U.uMapa.value.set(t.velikost / 2, t.krok, n, 0);
  }

  function kontrolaSvetel() {
    let amb = false;
    S.ctx.scene.traverseVisible(o => { if (o.isAmbientLight || o.isHemisphereLight || o.isLightProbe) amb = true; });
    U.uAmbZaloha.value = amb ? 0 : 1;
  }

  function nastavLod() {
    const n = S.nast;
    U.uLod.value.set(n.r0 > 0 ? n.r0 : -1000, n.p0, n.r1, n.p1);
  }

  // ======================================================================
  // Modul
  // ======================================================================
  D.modul('vegetace', {
    poradi: 40,
    popis: 'lesy a louky',
    async init(ctx) {
      const t0 = performance.now();
      S.ctx = ctx;
      S.kamFr = new THREE.PerspectiveCamera(); S.frustum = new THREE.Frustum(); S.koule = new THREE.Sphere(); S.mat4 = new THREE.Matrix4(); S.v3 = new THREE.Vector3();
      S.q = ctx.kvalita; S.nast = NAST[S.q];
      S.skupina = new THREE.Group(); S.skupina.name = 'vegetace';
      S.travaSkupina = new THREE.Group(); S.travaSkupina.name = 'vegetace-trava';
      S.skupina.add(S.travaSkupina); ctx.scene.add(S.skupina);

      // stín terénu od TERÉN-VYKRESLENÍ (pokud ho zveřejní): sampler2D přes celý svět, R = 1 osvětleno
      if (D.GLSL.teren && D.U.uTerenStin && D.U.uTerenStinOblast && D.U.uVyskaMapa) {
        FS_TEREN_STIN = (D.GLSL.atmo.includes('dronTerenSvetlo') ? '' : D.GLSL.teren) + 'float vegTerenStin(vec3 wp) { return dronTerenSvetlo(wp); }\n';
      } else FS_TEREN_STIN = 'float vegTerenStin(vec3 wp) { return 1.0; }\n';
      FS_TEREN_STIN += 'float vegHash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }\n';

      U.uAtlas.value = malujAtlas(ctx.kvalita === 0 ? 0.5 : 1);
      await new Promise(ok => setTimeout(ok, 0));

      // modely stromů
      for (let t = 0; t < 6; t++) {
        S.geo[t] = [stavStrom(t, 0), stavStrom(t, 1)];
        const bb = S.geo[t][0].boundingBox, stred = bb.getCenter(new THREE.Vector3());
        const p = S.geo[t][0].attributes.position; let R = 0;
        for (let i = 0; i < p.count; i++) R = Math.max(R, Math.hypot(p.getX(i) - stred.x, p.getY(i) - stred.y, p.getZ(i) - stred.z));
        S.obal[t] = { stred, R: R * 1.02 };
      }
      S.peceGeo = [];

      S.matStrom = [0, 1].map(l => shader(stromVS(), stromFS(), { m: { defines: { VEG_LOD: l } } }));
      S.matHloubka = new THREE.ShaderMaterial({ vertexShader: hloubkaVS(), fragmentShader: hloubkaFS(), uniforms: Object.assign({}, D.U, U), side: THREE.DoubleSide });
      S.matImp = shader(impVS(), impFS(), { m: { side: THREE.FrontSide, defines: { VEG_RAMCE4: 1 } } });

      texturyTerenu(ctx.teren);

      // kameny
      S.geoKamen = [stavKamen(2, 'k1'), stavKamen(1, 'k1')];
      S.matKamen = D.upravMaterial(new THREE.MeshStandardMaterial({ map: texturaKamene(), vertexColors: true, roughness: 0.92, metalness: 0 }), null, 'vegetace-kamen');
      const obj = ctx.teren.objekty || {};
      const kam = obj.kameny && obj.kameny.length ? obj.kameny : nahradniKameny(ctx.teren);
      S.kameny_nahradni = !(obj.kameny && obj.kameny.length);
      nastavKameny(kam);

      nastavStromy(obj.stromy || new Float32Array(0));
      S.pripraveno = true;
      S.initMs = performance.now() - t0;
    },

    kvalita(ctx, q) {
      if (!S.pripraveno) return;
      S.q = q; S.nast = NAST[q];
      nastavLod();
      if (S.impBunka !== S.nast.imp) pecImpostory(S.nast.imp);
      const rf = !!S.nast.ramce4;
      if (!!S.matImp.defines.VEG_RAMCE4 !== rf) { if (rf) S.matImp.defines.VEG_RAMCE4 = 1; else delete S.matImp.defines.VEG_RAMCE4; S.matImp.needsUpdate = true; }
      postavSady();
      postavTravu();
      if (S.kameny) S.kameny.meshe[0].castShadow = q >= 1;
      S.vynutit = true;
    },

    update(ctx, dt) {
      if (!S.pripraveno) return;
      S.cas += dt || 0;
      if (!S.impBunka) this.kvalita(ctx, ctx.kvalita);
      const k = ctx.kamera, p = S.posl;
      const dir = k.getWorldDirection(S.v3);
      const posun = Math.hypot(k.position.x - p.x, k.position.y - p.y, k.position.z - p.z);
      const otoc = dir.x * p.dx + dir.y * p.dy + dir.z * p.dz;
      if (S.vynutit || posun > OKRAJ * 0.7 || otoc < 0.9976 || S.cas - p.cas > 1.5) rozdel();
      if (S.trava.length) posunTravu(); else S.travaSkupina.visible = false;
      if (S.cas - S.svetlaCas > 2 || S.svetlaCas < 0) { S.svetlaCas = S.cas; kontrolaSvetel(); }
    },
  });

  // ======================================================================
  // Veřejné rozhraní
  // ======================================================================
  D.vegetace = {
    NAST,
    statistika() {
      const lod = [0, 1].map(l => S.sady[l].reduce((a, s) => a + (s ? s.n : 0), 0));
      const troj = [0, 1].map(l => S.sady[l].reduce((a, s) => a + (s ? s.n * s.troj : 0), 0));
      const travaInst = S.trava.reduce((a, pr) => a + pr.n * pr.n * pr.c.T * pr.c.T, 0);
      const travaTroj = S.trava.reduce((a, pr) => a + pr.n * pr.n * pr.c.T * pr.c.T * pr.troj, 0);
      const imp = S.impBunka ? 2 * (3 * G * S.impBunka) * (2 * G * S.impBunka) * 4 * 1.33 : 0;
      const atlas = ATL_W * ATL_H * 4 * 1.33 * (S.q === 0 ? 0.25 : 1);
      const buf = [0, 1].reduce((a, l) => a + S.sady[l].reduce((b, s) => b + (s ? s.cap * 32 : 0), 0), 0) + S.stromy.length * 4 * 32 / 6;
      return {
        kvalita: S.q, stromu: S.stromy.length / 6, druhy: S.pocty && S.pocty.slice(),
        lod0: lod[0], lod1: lod[1], trojLod0: troj[0], trojLod1: troj[1],
        impostoru: S.stromy.length / 6, impBloku: S.impBloky.length, impBloku_videt: S.impBloky.filter(m => m.visible).length,
        travaInstanci: travaInst, travaTrojMax: travaTroj, travaVidet: S.travaSkupina && S.travaSkupina.visible,
        kamenu: S.kameny ? S.kameny.pole.length / 5 : 0, kamenyNahradni: !!S.kameny_nahradni, kamenyVykresleno: S.kameny ? S.kameny.n.slice() : [0, 0],
        vzdalenosti: { lod0: S.nast.r0, lod1: S.nast.r1, trava: S.nast.trava ? S.nast.trava[S.nast.trava.length - 1].rOut : 0, kameny: S.nast.kamenyR, impostoryDo: MAX_DALKA },
        pametMB: { atlas: +(atlas / 1048576).toFixed(1), impostory: +(imp / 1048576).toFixed(1), mapyTerenu: +((S.vlastniVyska ? 4 : 0) + 5).toFixed(1), buffery: +(buf / 1048576).toFixed(1) },
        rozdelMs: +S.rozdelMs.toFixed(2), initMs: Math.round(S.initMs || 0), ambZaloha: U.uAmbZaloha.value,
        trojModelu: S.geo.map(g => g.map(x => x.index.count / 3)),
      };
    },
    // přehlídka: všech 6 druhů v řadě (x, z = střed řady, smer = kurz kolmice řady); okolní stromy se odklidí
    ukazka(x, z, smer, rozestup) {
      const t = S.ctx.teren, st = S.stromy, out = [];
      rozestup = rozestup || 16; smer = smer || 0;
      for (let i = 0; i < st.length; i += 6) if (Math.hypot(st[i] - x, st[i + 2] - z) > 70) for (let j = 0; j < 6; j++) out.push(st[i + j]);
      for (let i = 0; i < 6; i++) {
        const px = x + Math.cos(smer) * (i - 2.5) * rozestup, pz = z - Math.sin(smer) * (i - 2.5) * rozestup;
        out.push(px, t.vyska(px, pz), pz, i, 1, i * 1.1);
      }
      nastavStromy(new Float32Array(out));
      return out.length / 6;
    },
    nastavStromy, nastavKameny,
    prepocti() { S.vynutit = true; },
    _S: S, _U: U,
  };
})(globalThis.DRON = globalThis.DRON || {});
