/* Země v kostce – vlastní schematické kresby zásuvek typů A–O (pohled na zásuvku ve zdi).
   Otvory = barva textu, zemnicí kolík/pera = barva zvýraznění. window.ZVK_SVG(typ) → řetězec SVG. */
(function () {
  'use strict';
  const kruh = '<circle cx="50" cy="50" r="44" class="tvar"/>';
  const ctv = '<rect x="8" y="8" width="84" height="84" rx="16" class="tvar"/>';
  const sest = '<path d="M30 10h40l22 40-22 40H30L8 50z" class="tvar"/>';
  const d = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r || 5.5}" class="otvor"/>`;
  const s = (x, y, w, h, uhel) => `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="1.5" class="otvor"${uhel ? ` transform="rotate(${uhel} ${x} ${y})"` : ''}/>`;
  const TVARY = {
    A: ctv + s(36, 48, 6.5, 24) + s(64, 48, 5.5, 22),
    B: ctv + s(36, 42, 6.5, 22) + s(64, 42, 5.5, 20) + '<path d="M44 72a6 6 0 0 1 12 0v6H44z" class="otvor"/>',
    C: kruh + d(34, 50) + d(66, 50),
    D: ctv + d(50, 30, 8) + d(32, 66, 6) + d(68, 66, 6),
    E: kruh + '<circle cx="50" cy="50" r="34" class="vybrani"/>' + d(32, 54) + d(68, 54) + '<circle cx="50" cy="28" r="5" class="pin"/>',
    F: kruh + '<circle cx="50" cy="50" r="34" class="vybrani"/>' + d(32, 50) + d(68, 50) + '<rect x="43" y="14" width="14" height="6" class="pin"/><rect x="43" y="80" width="14" height="6" class="pin"/>',
    G: ctv + s(50, 32, 8, 20) + s(30, 64, 20, 8) + s(70, 64, 20, 8),
    H: ctv + s(32, 40, 5, 18, 35) + s(68, 40, 5, 18, -35) + s(50, 70, 5, 18),
    I: ctv + s(34, 42, 5, 20, 30) + s(66, 42, 5, 20, -30) + s(50, 70, 5, 18),
    J: sest + d(30, 46) + d(70, 46) + d(50, 62),
    K: kruh + d(32, 44) + d(68, 44) + '<path d="M42 66a8 8 0 0 0 16 0z" class="otvor"/>',
    L: '<rect x="8" y="26" width="84" height="48" rx="24" class="tvar"/>' + d(28, 50, 5) + d(50, 50, 5) + d(72, 50, 5),
    M: ctv + d(50, 28, 9) + d(30, 66, 7) + d(70, 66, 7),
    N: sest + d(32, 55) + d(68, 55) + d(50, 40),
    O: kruh + d(32, 46) + d(68, 46) + d(50, 70)
  };
  window.ZVK_SVG = typ => TVARY[typ]
    ? `<svg viewBox="0 0 100 100" class="zas" role="img" aria-label="Zásuvka typu ${typ}"><title>Typ ${typ}</title>${TVARY[typ]}</svg>`
    : '';
})();
