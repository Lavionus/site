/* ============================================================
   obrazky_davka/vykresli.js – provedení řetězu kroků na plátně.
   Běží ve workeru (OffscreenCanvas) i v hlavním vlákně (záložně).
   Potřebuje jadro.js (OBRAZKY_DAVKA). Vystavuje self.OBRAZKY_DAVKA_KRESLENI.
   ============================================================ */
(function (koren) {
'use strict';
const J = koren.OBRAZKY_DAVKA;

function platno(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function ctx2d(c) {
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  return x;
}
function naBlob(c, mime, kvalita) {
  if (c.convertToBlob) return c.convertToBlob({ type: mime, quality: kvalita });
  return new Promise((ok, chyba) => c.toBlob(b => b ? ok(b) : chyba(new Error('Kódování selhalo')), mime, kvalita));
}
const rozmer = z => ({ w: z.width, h: z.height });

/** Zmenšení po polovinách, dokud je cíl menší než polovina – bez „schodů“ i v prohlížečích s horším drawImage. */
function zmensi(zdroj, w, h) {
  let z = zdroj, zw = z.width, zh = z.height;
  while (zw / 2 >= w && zh / 2 >= h) {
    const c = platno(Math.round(zw / 2), Math.round(zh / 2));
    ctx2d(c).drawImage(z, 0, 0, zw, zh, 0, 0, c.width, c.height);
    z = c; zw = c.width; zh = c.height;
  }
  const c = platno(w, h);
  ctx2d(c).drawImage(z, 0, 0, zw, zh, 0, 0, w, h);
  return c;
}

function otoc(zdroj, k) {
  const { w, h } = rozmer(zdroj), u = Number(k.uhel) % 360;
  const r = J.rozmerPoKroku(w, h, k);
  const c = platno(r.w, r.h), x = ctx2d(c);
  x.translate(r.w / 2, r.h / 2);
  x.rotate(u * Math.PI / 180);
  if (k.zrcadlo === 'h') x.scale(-1, 1);
  if (k.zrcadlo === 'v') x.scale(1, -1);
  x.drawImage(zdroj, -w / 2, -h / 2);
  return c;
}

function vodoznakText(c, k) {
  const x = ctx2d(c), W = c.width, H = c.height;
  const vel = Math.max(6, Math.round(Math.min(W, H) * (Number(k.velikost) || 4) / 100));
  const ods = Math.round(Math.min(W, H) * (Number(k.odsazeni) || 0) / 100);
  x.font = `600 ${vel}px system-ui, "Segoe UI", Roboto, Arial, sans-serif`;
  x.textBaseline = 'top';
  x.globalAlpha = Math.max(0, Math.min(1, 1 - (Number(k.pruhlednost) || 0) / 100));
  x.fillStyle = k.barva || '#fff';
  if (k.stin) { x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = vel / 6; x.shadowOffsetX = x.shadowOffsetY = vel / 16; }
  const text = String(k.text || '');
  const tw = Math.ceil(x.measureText(text).width), th = Math.ceil(vel * 1.15);
  if (Number(k.pozice) === 9) {                       // dlaždice přes celý obrázek, šikmo
    x.translate(W / 2, H / 2); x.rotate(-Math.PI / 6);
    const krokX = tw + vel * 3, krokY = th * 4, d = Math.hypot(W, H);
    for (let y = -d / 2; y < d / 2; y += krokY)
      for (let xx = -d / 2 + ((y / krokY) % 2 ? krokX / 2 : 0); xx < d / 2; xx += krokX) x.fillText(text, xx, y);
  } else {
    const p = J.poziceVodoznaku(W, H, tw, th, Number(k.pozice) || 0, ods);
    x.fillText(text, p.x, p.y);
  }
}

function vodoznakObrazek(c, k, obr) {
  if (!obr) return;
  const x = ctx2d(c), W = c.width, H = c.height;
  const w = Math.max(1, Math.round(W * (Number(k.sirkaObr) || 20) / 100)), h = Math.max(1, Math.round(w * obr.height / obr.width));
  const ods = Math.round(Math.min(W, H) * (Number(k.odsazeni) || 0) / 100);
  x.globalAlpha = Math.max(0, Math.min(1, 1 - (Number(k.pruhlednost) || 0) / 100));
  if (Number(k.pozice) === 9) {
    for (let y = ods; y < H; y += h * 2) for (let xx = ods; xx < W; xx += w * 2) x.drawImage(obr, xx, y, w, h);
  } else {
    const p = J.poziceVodoznaku(W, H, w, h, Number(k.pozice) || 0, ods);
    x.drawImage(obr, p.x, p.y, w, h);
  }
}

/** Provede zapnuté kroky; zdroj = ImageBitmap (už otočený podle EXIF). Vrací plátno. */
function vykresli(zdroj, kroky, vodoznakObr) {
  let c = platno(zdroj.width, zdroj.height);
  ctx2d(c).drawImage(zdroj, 0, 0);
  for (const k of kroky) {
    if (!k.zap) continue;
    const { w, h } = rozmer(c);
    switch (k.typ) {
      case 'otoc': c = otoc(c, k); break;
      case 'orez': {
        const o = J.orezStred(w, h, k.pomer, k.podleOrientace);
        const n = platno(o.w, o.h);
        ctx2d(n).drawImage(c, o.x, o.y, o.w, o.h, 0, 0, o.w, o.h);
        c = n; break;
      }
      case 'zmensi': {
        const r = J.cilovyRozmer(w, h, k);
        if (r.w !== w || r.h !== h) c = zmensi(c, r.w, r.h);
        break;
      }
      case 'upravy':
      case 'seda': {
        const x = ctx2d(c), d = x.getImageData(0, 0, w, h);
        J.upravPixely(d.data, k.typ === 'seda' ? { seda: true } : k);
        x.putImageData(d, 0, 0);
        break;
      }
      case 'okraj': {
        const b = J.sirkaOkraje(w, h, k);
        if (!b) break;
        const n = platno(w + 2 * b, h + 2 * b), x = ctx2d(n);
        x.fillStyle = k.barva || '#fff'; x.fillRect(0, 0, n.width, n.height);
        x.drawImage(c, b, b);
        c = n; break;
      }
      case 'vodoznak':
        if (k.druh === 'obrazek') vodoznakObrazek(c, k, vodoznakObr); else vodoznakText(c, k);
        break;
    }
  }
  return c;
}

/**
 * Zakóduje plátno. JPEG nemá průhlednost → podklad barvou pozadí.
 * Cílová velikost (cilKB) hledá kvalitu binárně; u PNG kvalita nejde, cíl se ignoruje.
 * → { blob, kvalita (0–100 | null), splneno, format }
 */
async function koduj(c, vystup, typVstupu) {
  const format = J.vystupniFormat(vystup.format, typVstupu), f = J.FORMATY[format];
  if (format === 'jpeg') {
    const n = platno(c.width, c.height), x = ctx2d(n);
    x.fillStyle = vystup.pozadi || '#ffffff'; x.fillRect(0, 0, n.width, n.height);
    x.drawImage(c, 0, 0);
    c = n;
  }
  const zakoduj = q => naBlob(c, f.mime, q);
  if (f.kvalita && vystup.cilKB > 0) {
    const r = await J.hledejKvalitu(zakoduj, vystup.cilKB * 1024, { max: Math.min(1, (Number(vystup.kvalita) || 85) / 100) });
    return { blob: r.vysledek, kvalita: Math.round(r.kvalita * 100), splneno: r.splneno, format };
  }
  const blob = await zakoduj(f.kvalita ? (Number(vystup.kvalita) || 85) / 100 : undefined);
  if (blob.type && blob.type !== f.mime) throw new Error('Prohlížeč neumí zakódovat ' + format.toUpperCase());
  return { blob, kvalita: f.kvalita ? Number(vystup.kvalita) : null, splneno: true, format };
}

/** Celý soubor: dekódování (s EXIF orientací) → kroky → kódování. */
async function zpracujSoubor(soubor, kroky, vystup, typVstupu, vodoznakObr) {
  const bmp = await createImageBitmap(soubor, { imageOrientation: 'from-image' });
  let c;
  try { c = vykresli(bmp, kroky, vodoznakObr); } finally { bmp.close && bmp.close(); }
  const r = await koduj(c, vystup, typVstupu);
  r.w = c.width; r.h = c.height;
  return r;
}

koren.OBRAZKY_DAVKA_KRESLENI = { platno, naBlob, vykresli, koduj, zpracujSoubor };
})(typeof self !== 'undefined' ? self : this);
