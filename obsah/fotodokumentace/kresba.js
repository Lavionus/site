/* Fotodokumentace – kreslení fotky s vrstvou anotací (sdílí editor, fototabulka i karta entity spisu).
   window.FOTODOK_KRESBA.kresliVse(ctx, obrázek, anotace, měřítko, { stopy: {id → entita stopy}, editor?, z? })
   ctx je v souřadnicích obrázku (px). Potřebuje window.FOTODOK (fotodokumentace/jadro.js). */
(function () {
  'use strict';
  const J = window.FOTODOK;
  const cisloZnacky = (z, ms) => { const s = (ms || {})[z.stopa]; return s ? String(s.data.cislo || '?') : (z.cislo || '?'); };
  const ZLUTA = '#ffd400', CERNA = '#000000', MERENI = '#00e5ff', MERITKO = '#ff3df5';
  let mimo = null;
  function efekt(c, img, a) {
    const [x0, y0, x1, y1] = J.obal({ b: a.b }).map(Math.round), w = x1 - x0, h = y1 - y0;
    if (w < 2 || h < 2) return;
    if (a.efekt === 'cerna') { c.fillStyle = CERNA; c.fillRect(x0, y0, w, h); return; }
    // buňka aspoň čtvrtina kratší strany oblasti (jako „bezpečné“ v Anonymizaci) – oči, ústa i znaky SPZ zaniknou
    // i u velké oblasti na detailním snímku; dřív se odvozovala jen od velikosti fotky (obličej přes půl snímku zůstal čitelný)
    const vel = Math.max(img.width, img.height), bunka = Math.max(a.efekt === 'pixely' ? Math.max(4, vel / 90) : Math.max(3, vel / 140), Math.min(w, h) / 4);
    const sw = Math.max(1, Math.round(w / bunka)), sh = Math.max(1, Math.round(h / bunka));
    mimo = mimo || document.createElement('canvas');
    mimo.width = sw; mimo.height = sh;
    mimo.getContext('2d').drawImage(img, x0, y0, w, h, 0, 0, sw, sh);
    c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip();
    c.imageSmoothingEnabled = a.efekt !== 'pixely';
    c.drawImage(mimo, 0, 0, sw, sh, x0, y0, w, h);
    c.restore();
  }
  // obsah výřezu pro lupu: originál s už zakrytými místy – lupa nesmí ukázat obličej či SPZ pod zakrytím
  function zdrojLupy(img, anot, x0, y0, x1, y1) {
    const v = document.createElement('canvas');
    v.width = Math.max(1, Math.round(x1 - x0)); v.height = Math.max(1, Math.round(y1 - y0));
    const g = v.getContext('2d');
    g.translate(-x0, -y0); g.drawImage(img, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    for (const a of anot) if (a.druh === 'zakryt') efekt(g, img, a);
    return v;
  }
  function stitek(c, text, x, y, s, barva) {
    c.font = 'bold ' + 15 * s + 'px Arial, sans-serif';
    const w = c.measureText(text).width + 10 * s, h = 21 * s;
    c.fillStyle = 'rgba(0,0,0,.72)'; c.fillRect(x - w / 2, y - h / 2, w, h);
    c.fillStyle = barva; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, x, y + s);
    c.textBaseline = 'alphabetic';
  }
  function cara(c, body, barva, s, uzavrit) {
    c.beginPath(); body.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); if (uzavrit) c.closePath();
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.strokeStyle = 'rgba(0,0,0,.75)'; c.lineWidth = 6 * s; c.stroke();
    c.strokeStyle = barva; c.lineWidth = 3 * s; c.stroke();
  }
  function hrot(c, a, b, s, barva) {
    const u = Math.atan2(b[1] - a[1], b[0] - a[0]), d = 20 * s;
    const p1 = [b[0] - d * Math.cos(u - 0.45), b[1] - d * Math.sin(u - 0.45)], p2 = [b[0] - d * Math.cos(u + 0.45), b[1] - d * Math.sin(u + 0.45)];
    c.beginPath(); c.moveTo(...p1); c.lineTo(...b); c.lineTo(...p2); c.closePath();
    c.fillStyle = barva; c.strokeStyle = 'rgba(0,0,0,.75)'; c.lineWidth = 2 * s; c.fill(); c.stroke();
  }
  // c je v souřadnicích obrázku; o = { editor, z (px obrazovky na px obrázku), vyber, stopy }
  function kresliVse(c, img, anot, m, o) {
    const s = Math.max(img.width, img.height) / 900, ms = o.stopy || {};
    c.drawImage(img, 0, 0);
    for (const a of anot) if (a.druh === 'zakryt') {
      efekt(c, img, a);
      if (o.editor) { c.setLineDash([8 / o.z, 6 / o.z]); c.strokeStyle = ZLUTA; c.lineWidth = 1.5 / o.z; const [x0, y0, x1, y1] = J.obal(a); c.strokeRect(x0, y0, x1 - x0, y1 - y0); c.setLineDash([]); }
    }
    for (const a of anot) {
      const b = a.b;
      switch (a.druh) {
        case 'sipka': cara(c, b.slice(0, 2), ZLUTA, s); hrot(c, b[0], b[1], s, ZLUTA); break;
        case 'kruh': {
          const [x0, y0, x1, y1] = J.obal(a);
          c.beginPath(); c.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.max(1, (x1 - x0) / 2), Math.max(1, (y1 - y0) / 2), 0, 0, 7);
          c.strokeStyle = 'rgba(0,0,0,.75)'; c.lineWidth = 6 * s; c.stroke(); c.strokeStyle = ZLUTA; c.lineWidth = 3 * s; c.stroke(); break;
        }
        case 'obdelnik': { const [x0, y0, x1, y1] = J.obal(a); cara(c, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], ZLUTA, s, true); break; }
        case 'text': {
          c.font = 'bold ' + 24 * s + 'px Arial, sans-serif'; c.textAlign = 'left';
          c.lineWidth = 5 * s; c.strokeStyle = 'rgba(0,0,0,.85)'; c.lineJoin = 'round'; c.strokeText(a.text, b[0][0], b[0][1]);
          c.fillStyle = '#ffffff'; c.fillText(a.text, b[0][0], b[0][1]); break;
        }
        case 'vyrez': {
          const [x0, y0, x1, y1] = J.obal({ b: b.slice(0, 2) }), l = J.lupa(a);
          c.setLineDash([10 * s, 6 * s]); cara(c, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], ZLUTA, s * 0.7, true); c.setLineDash([]);
          const cx = Math.max(x0, Math.min(x1, (l[0] + l[2]) / 2)), cy = Math.max(y0, Math.min(y1, (l[1] + l[3]) / 2));
          cara(c, [[cx, cy], [Math.max(l[0], Math.min(l[2], cx)), Math.max(l[1], Math.min(l[3], cy))]], ZLUTA, s * 0.7);
          if (x1 - x0 > 1 && y1 - y0 > 1) c.drawImage(zdrojLupy(img, anot, x0, y0, x1, y1), 0, 0, Math.round(x1 - x0), Math.round(y1 - y0), l[0], l[1], l[2] - l[0], l[3] - l[1]);
          cara(c, [[l[0], l[1]], [l[2], l[1]], [l[2], l[3]], [l[0], l[3]]], '#ffffff', s, true);
          stitek(c, '×' + J.fmt(a.k, 1), l[2] - 26 * s, l[1] + 16 * s, s * 0.8, '#ffffff'); break;
        }
        case 'delka': case 'uhel': case 'plocha': {
          if (a.druh === 'plocha') { c.beginPath(); b.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath(); c.fillStyle = 'rgba(0,229,255,.16)'; c.fill(); }
          cara(c, b, MERENI, s * 0.7, a.druh === 'plocha');
          if (a.druh === 'delka') for (const [p, q] of [[b[0], b[1]], [b[1], b[0]]]) {
            const u = Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI / 2, d = 9 * s;
            cara(c, [[p[0] + d * Math.cos(u), p[1] + d * Math.sin(u)], [p[0] - d * Math.cos(u), p[1] - d * Math.sin(u)]], MERENI, s * 0.7);
          }
          const t = J.textMereni(J.zmer(a, m, { vzorku: 200 }));
          const st = a.druh === 'uhel' ? b[1] : a.druh === 'delka' ? [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2 - 20 * s]
            : [b.reduce((v, p) => v + p[0], 0) / b.length, b.reduce((v, p) => v + p[1], 0) / b.length];
          stitek(c, t, st[0], st[1] + (a.druh === 'uhel' ? 22 * s : 0), s, MERENI); break;
        }
      }
    }
    for (const a of anot) if (a.druh === 'znacka') {       // značky navrch
      const [x, y] = a.b[0], r = 17 * s;
      c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = ZLUTA; c.fill(); c.lineWidth = 3 * s; c.strokeStyle = CERNA; c.stroke();
      c.fillStyle = CERNA; c.font = 'bold ' + 20 * s + 'px Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(cisloZnacky(a, ms), x, y + s); c.textBaseline = 'alphabetic';
    }
    if (m) {
      const kb = m.b;
      cara(c, kb, MERITKO, s * 0.5, m.druh === 'obdelnik');
      if (m.druh === 'obdelnik') kb.forEach((p, i) => stitek(c, String(i + 1), p[0], p[1] - 16 * s, s * 0.7, MERITKO));
      const [p, q] = m.druh === 'delka' ? kb : [kb[2], kb[3]], st = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2 + (m.druh === 'delka' ? 20 : -16) * s];
      stitek(c, m.druh === 'delka' ? '◆ ' + J.fmt(m.mm, 0) + ' mm' : '◆ ' + J.fmt(m.w, 0) + ' × ' + J.fmt(m.h, 0) + ' mm', st[0], st[1], s * 0.75, MERITKO);
    }
  }

  window.FOTODOK_KRESBA = { kresliVse, ZLUTA, CERNA, MERENI, MERITKO };
})();
