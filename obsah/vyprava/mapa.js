/* ============================================================
   Dílna výprav – mapa.js
   Mapa pokladu jako SVG: pergamen s ohořelým okrajem, kompas,
   kartuše s názvem, mřížka souřadnic A–H × 1–8, značky kreslené
   „perem“ a trasa stopami. Čistá funkce z dat výpravy → text SVG,
   takže ji jde testovat v node a stejný výstup jde do tisku i PNG.
   ============================================================ */
(function (G) {
  'use strict';
  const V = G.VYPRAVA;
  const M = {};
  const { W, H, OKRAJ } = V.MAPA;
  M.W = W; M.H = H;
  const CERVENA = '#9a2a18';
  let INK = '#3d2714';   // barva inkoustu – nastaví M.svg z voleb
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = x => Math.round(x * 10) / 10;

  M.ZNACKY = {
    strom: 'Strom', les: 'Les', hora: 'Hora', skala: 'Skála / kámen', dum: 'Dům', chram: 'Chrám / stavba',
    studna: 'Studna', most: 'Most', voda: 'Voda / jezero', lod: 'Loď', lebka: 'Nebezpečí', stanoviste: 'Stanoviště (číslo)', poklad: 'Poklad ✕', text: 'Volný popisek'
  };

  /* Kresba značky se středem v 0,0 (asi 60×60). */
  function ikona(typ, popis) {
    const s = (fill, sirka) => `stroke="${INK}" stroke-width="${sirka || 3}" fill="${fill || 'none'}" stroke-linecap="round" stroke-linejoin="round"`;
    switch (typ) {
      case 'strom': return `<path d="M0 26V2" ${s()}/><path d="M0 4c-16 2-22-10-14-18-4-12 10-20 16-12 8-8 22 0 16 12 8 8 0 20-14 18z" ${s('#c9b27f')}/>`;
      case 'les': return [-18, 0, 18].map((x, i) => `<path d="M${x} ${i === 1 ? -26 : -16}l-12 ${i === 1 ? 34 : 28}h24z M${x} ${i === 1 ? 8 : 12}v8" ${s('#c9b27f')}/>`).join('');
      case 'hora': return `<path d="M-30 22L-8 -20L4 -2L14 -16L32 22Z" ${s('#d8c494')}/><path d="M-14 -8l6-12 6 10M10 -10l4-6 6 8" ${s()}/>`;
      case 'skala': return `<path d="M-24 18c-6-14 0-28 14-30 6-10 22-6 26 4 10 4 12 18 6 26z" ${s('#cdb98c')}/><path d="M-8 -4l6 10M8 0l4 8" ${s()}/>`;
      case 'dum': return `<path d="M-20 22V-4H20V22ZM-26 -2L0 -24L26 -2M-6 22V8H6V22" ${s('#d8c494')}/>`;
      case 'chram': return `<path d="M-28 -10L0 -28L28 -10Z" ${s('#d8c494')}/><path d="M-26 22H26M-22 -8V20M-8 -8V20M8 -8V20M22 -8V20M-28 -10H28" ${s()}/>`;
      case 'studna': return `<ellipse cx="0" cy="12" rx="16" ry="7" ${s('#9fb6b0')}/><path d="M-16 12V20Q0 28 16 20V12M-14 10V-16M14 10V-16M-20 -14L0 -26L20 -14" ${s()}/>`;
      case 'most': return `<path d="M-30 10Q0 -18 30 10M-30 10V18M30 10V18M-18 2V10M-6 -3V10M6 -3V10M18 2V10" ${s()}/>`;
      case 'voda': return `<path d="M-34 6c-4-16 14-24 30-18 14-8 34 0 30 16 6 12-12 22-30 16-16 8-34 0-30-14z" ${s('#a9c0bb')}/><path d="M-16 0q5-4 10 0t10 0M0 10q5-4 10 0t10 0" ${s('none', 2)}/>`;
      case 'lod': return `<path d="M-26 6H26L16 20H-16ZM0 6V-26L20 0H0" ${s('#d8c494')}/><path d="M-30 26q8-5 15 0t15 0 15 0 15 0" ${s('none', 2)}/>`;
      case 'lebka': return `<path d="M-16 4c-6-26 38-26 32 0v8h-6v6h-20v-6h-6z" ${s('#efe2c2')}/><circle cx="-6" cy="0" r="4" fill="${INK}"/><circle cx="6" cy="0" r="4" fill="${INK}"/><path d="M-20 24L20 34M20 24L-20 34" ${s()}/>`;
      case 'stanoviste': return `<circle r="17" ${s('#efe2c2')}/><text y="7" text-anchor="middle" font-size="21" fill="${INK}" class="mapa-pismo" font-weight="bold">${esc(popis || '?')}</text>`;
      case 'text': return '';
      case 'poklad': return `<path d="M-20 -20L20 20M20 -20L-20 20" stroke="${CERVENA}" stroke-width="9" stroke-linecap="round"/>`;
      default: return `<circle r="6" fill="${INK}"/>`;
    }
  }

  /* Catmull-Rom přes body → hladká cesta (Bézier). */
  function hladka(b) {
    if (b.length < 2) return '';
    let d = `M${f(b[0].x)} ${f(b[0].y)}`;
    for (let i = 0; i < b.length - 1; i++) {
      const p0 = b[i - 1] || b[i], p1 = b[i], p2 = b[i + 1], p3 = b[i + 2] || p2;
      d += `C${f(p1.x + (p2.x - p0.x) / 6)} ${f(p1.y + (p2.y - p0.y) / 6)} ${f(p2.x - (p3.x - p1.x) / 6)} ${f(p2.y - (p3.y - p1.y) / 6)} ${f(p2.x)} ${f(p2.y)}`;
    }
    return d;
  }
  M.hladka = hladka;

  /* Roztřepený okraj pergamenu (uzavřený mnohoúhelník podle semínka). */
  function okraj(rng) {
    const b = [], krok = 22;
    const kraj = (x0, y0, x1, y1) => {
      const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / krok));
      for (let i = 0; i < n; i++) {
        const t = i / n, nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny);
        const o = (rng() - 0.5) * 16 + (rng() < 0.08 ? -16 * rng() : 0);
        b.push(`${f(x0 + (x1 - x0) * t + nx / l * o)},${f(y0 + (y1 - y0) * t + ny / l * o)}`);
      }
    };
    const a = 14;
    kraj(a, a, W - a, a); kraj(W - a, a, W - a, H - a); kraj(W - a, H - a, a, H - a); kraj(a, H - a, a, a);
    return b.join(' ');
  }

  function kompas(x, y) {
    const r = 54, hrot = (uhel, d, w, fill) => {
      const a = uhel * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
      const p = [[0, -d], [w, 0], [0, 0], [-w, 0]].map(([px, py]) => `${f(x + px * ca - py * sa)},${f(y + px * sa + py * ca)}`);
      return `<polygon points="${p[0]} ${p[1]} ${p[2]}" fill="${fill}" stroke="${INK}" stroke-width="1.5"/><polygon points="${p[0]} ${p[2]} ${p[3]}" fill="${fill === INK ? '#efe2c2' : INK}" stroke="${INK}" stroke-width="1.5"/>`;
    };
    return `<g class="kompas"><circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${INK}" stroke-width="2"/><circle cx="${x}" cy="${y}" r="${r - 7}" fill="none" stroke="${INK}" stroke-width="1" stroke-dasharray="2 5"/>`
      + [45, 135, 225, 315].map(u => hrot(u, r - 18, 7, '#efe2c2')).join('') + [0, 90, 180, 270].map(u => hrot(u, r + 6, 11, INK)).join('')
      + `<text x="${x}" y="${y - r - 14}" text-anchor="middle" font-size="26" fill="${INK}" class="mapa-pismo">S</text></g>`;
  }

  /* Políčko mřížky (A–H × 1–8) → střed v souřadnicích mapy. */
  M.poleNaXY = function (pole) {
    const m = /^([A-H])([1-8])$/.exec(String(pole || '').toUpperCase());
    if (!m) return null;
    const sx = (W - 2 * OKRAJ) / 8, sy = (H - 2 * OKRAJ) / 8;
    return { x: OKRAJ + (m[1].charCodeAt(0) - 65 + 0.5) * sx, y: OKRAJ + (+m[2] - 0.5) * sy };
  };
  M.xyNaPole = V.xyNaPole;

  /* Stopy podél cesty: střídavě levá a pravá šlépěj. */
  function stopy(d, body) {
    const out = [];
    let delka = 0;
    for (let i = 1; i < body.length; i++) delka += Math.hypot(body[i].x - body[i - 1].x, body[i].y - body[i - 1].y);
    // vzorkování po úsecích lomené čáry (stačí pro rozmístění stop)
    const krok = 34; let zbyva = krok / 2, strana = 1;
    for (let i = 1; i < body.length; i++) {
      const a = body[i - 1], b = body[i], l = Math.hypot(b.x - a.x, b.y - a.y);
      if (!l) continue;
      const ux = (b.x - a.x) / l, uy = (b.y - a.y) / l, uhel = Math.atan2(uy, ux) * 180 / Math.PI + 90;
      let t = zbyva;
      while (t < l - 20) {
        if (t > 26) {
          const x = a.x + ux * t - uy * 6 * strana, y = a.y + uy * t + ux * 6 * strana;
          out.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="3.2" ry="6" transform="rotate(${f(uhel)} ${f(x)} ${f(y)})" fill="${INK}" opacity=".75"/>`);
          strana = -strana;
        }
        t += krok;
      }
      zbyva = t - l;
    }
    return delka ? out.join('') : '';
  }

  /* Hlavní kreslení. volby: { vybrana: id značky, interaktivni: true (třídy pro UI),
     pismo: CSS rodina písma popisků, fontData: dataURL písma pro export (vloží se jako 'MapaPismo'),
     ink: barva inkoustu, papir: 'pergamen' | 'stary' | 'cisty' } */
  M.svg = function (mapa, volby) {
    const v = volby || {}, rng = V.rng(mapa.seed || 1);
    INK = /^#[0-9a-f]{6}$/i.test(v.ink || '') ? v.ink : '#3d2714';
    const papir = v.papir || 'pergamen';
    const rodina = v.fontData ? "'MapaPismo'," : v.pismo ? String(v.pismo).replace(/[<>{}]/g, '') + ',' : '';
    const pismo = v.fontData ? `@font-face{font-family:'MapaPismo';src:url(${v.fontData})}` : '';
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="mapa-svg">`
      + `<style>${pismo}.mapa-pismo{font-family:${rodina}'IM Fell English','Palatino Linotype',Georgia,serif}</style>`
      + `<defs><filter id="papir" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".012 .02" numOctaves="4" seed="${(mapa.seed || 1) % 997}"/>`
      + `<feColorMatrix values="0 0 0 0 .55  0 0 0 0 .38  0 0 0 0 .18  0 0 0 .55 -.12"/><feComposite in2="SourceGraphic" operator="in"/></filter>`
      + `<filter id="ruka"><feTurbulence type="fractalNoise" baseFrequency=".04" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="3"/></filter>`
      + `<radialGradient id="vineta" cx="50%" cy="50%" r="70%"><stop offset="55%" stop-color="#7a4a1c" stop-opacity="0"/><stop offset="100%" stop-color="#5a3210" stop-opacity=".55"/></radialGradient></defs>`;
    const obrys = okraj(rng);
    if (papir === 'cisty') s += `<polygon points="${obrys}" fill="#fff" stroke="${INK}" stroke-width="2" stroke-dasharray="6 5"/>`;
    else s += `<polygon points="${obrys}" fill="${papir === 'stary' ? '#d6bb84' : '#e8d5a6'}"/><polygon points="${obrys}" filter="url(#papir)" fill="#000"/><polygon points="${obrys}" fill="url(#vineta)"${papir === 'stary' ? ' opacity="1"' : ' opacity=".8"'}/>`
      + `<polygon points="${obrys}" fill="none" stroke="#4a2a10" stroke-width="7" stroke-opacity=".55" filter="url(#ruka)"/>`;
    // skvrny (čaj, vosk)
    if (papir !== 'cisty') for (let i = 0; i < 4; i++) s += `<ellipse cx="${f(80 + rng() * (W - 160))}" cy="${f(80 + rng() * (H - 160))}" rx="${f(18 + rng() * 40)}" ry="${f(14 + rng() * 30)}" fill="#8a5a24" opacity="${f(0.05 + rng() * 0.07)}"/>`;
    s += '<g filter="url(#ruka)">';
    if (mapa.mrizka) {
      const sx = (W - 2 * OKRAJ) / 8, sy = (H - 2 * OKRAJ) / 8;
      for (let i = 0; i <= 8; i++) {
        s += `<line x1="${f(OKRAJ + i * sx)}" y1="${OKRAJ}" x2="${f(OKRAJ + i * sx)}" y2="${H - OKRAJ}" stroke="${INK}" stroke-width="1" stroke-dasharray="3 6" opacity=".55"/>`;
        s += `<line x1="${OKRAJ}" y1="${f(OKRAJ + i * sy)}" x2="${W - OKRAJ}" y2="${f(OKRAJ + i * sy)}" stroke="${INK}" stroke-width="1" stroke-dasharray="3 6" opacity=".55"/>`;
      }
      for (let i = 0; i < 8; i++) {
        s += `<text x="${f(OKRAJ + (i + 0.5) * sx)}" y="${OKRAJ - 10}" text-anchor="middle" font-size="20" fill="${INK}" class="mapa-pismo">${String.fromCharCode(65 + i)}</text>`;
        s += `<text x="${OKRAJ - 16}" y="${f(OKRAJ + (i + 0.5) * sy + 7)}" text-anchor="middle" font-size="20" fill="${INK}" class="mapa-pismo">${i + 1}</text>`;
      }
    }
    // trasa
    const podleId = new Map((mapa.znacky || []).map(z => [z.id, z]));
    const body = (mapa.trasa || []).map(id => podleId.get(id)).filter(Boolean);
    if (body.length > 1) {
      const d = hladka(body);
      s += `<path d="${d}" fill="none" stroke="${INK}" stroke-width="2.5" stroke-dasharray="10 9" opacity=".8"/>`;
      if (mapa.stopy) s += stopy(d, body);
    }
    s += '</g>';
    // dekorace krajiny (podle semínka, mimo značky)
    if (mapa.krajina) {
      const r2 = V.rng((mapa.seed || 1) + 17), zn = mapa.znacky || [];
      for (let i = 0, n = 0; i < 140 && n < 26; i++) {
        const x = 90 + r2() * (W - 180), y = 90 + r2() * (H - 180);
        if (zn.some(z => Math.hypot(z.x - x, z.y - y) < 70) || (x > W - 200 && y > H - 200) || (x < 380 && y < 150)) continue;
        n++;
        const typ = r2();
        s += typ < 0.5 ? `<path d="M${f(x - 8)} ${f(y)}q4-8 8 0q4-8 8 0" stroke="${INK}" stroke-width="1.6" fill="none" opacity=".6"/>`
          : typ < 0.8 ? `<path d="M${f(x)} ${f(y)}v-8M${f(x - 5)} ${f(y)}l-3-6M${f(x + 5)} ${f(y)}l3-6" stroke="${INK}" stroke-width="1.5" fill="none" opacity=".55"/>`
          : `<path d="M${f(x - 10)} ${f(y + 6)}l10-16 10 16" stroke="${INK}" stroke-width="1.8" fill="none" opacity=".6"/>`;
      }
    }
    // značky
    for (const z of mapa.znacky || []) {
      const vyb = v.vybrana === z.id;
      const k = Math.max(0.4, Math.min(3, +z.velikost || 1));
      s += `<g class="znacka${vyb ? ' vybrana' : ''}" data-id="${esc(z.id)}" transform="translate(${f(z.x)} ${f(z.y)})${k !== 1 ? ` scale(${k})` : ''}">`
        + (vyb ? `<circle r="38" fill="none" stroke="${CERVENA}" stroke-width="2" stroke-dasharray="4 4"/>` : '')
        + (v.interaktivni ? '<circle r="34" fill="transparent"/>' : '')
        + ikona(z.typ, z.popis);
      if (z.typ === 'text') s += `<text y="9" text-anchor="middle" font-size="28" fill="${INK}" class="mapa-pismo">${esc(z.popis || 'popisek')}</text>`;
      else if (z.popis && z.typ !== 'stanoviste') s += `<text y="50" text-anchor="middle" font-size="21" fill="${INK}" class="mapa-pismo">${esc(z.popis)}</text>`;
      s += '</g>';
    }
    // kartuše s názvem
    if (mapa.nazev) {
      const t = esc(mapa.nazev), w = Math.min(560, 60 + mapa.nazev.length * 15);
      s += `<g transform="translate(70 62)"><path d="M0 0H${w}q-14 22 0 44H0q14-22 0-44z" fill="#efe2c2" stroke="${INK}" stroke-width="2.5"/>`
        + `<text x="${w / 2}" y="31" text-anchor="middle" font-size="27" fill="${INK}" class="mapa-pismo">${t}</text></g>`;
    }
    s += kompas(W - 110, H - 115);
    if (mapa.meritko) s += `<g transform="translate(70 ${H - 70})"><path d="M0 0H160M0 -6V6M80 -4V4M160 -6V6" stroke="${INK}" stroke-width="2.5"/><text x="80" y="-12" text-anchor="middle" font-size="18" fill="${INK}" class="mapa-pismo">${esc(mapa.meritko)}</text></g>`;
    return s + '</svg>';
  };

  G.VYPRAVA_MAPA = M;
  if (typeof module !== 'undefined') module.exports = M;
})(typeof window !== 'undefined' ? window : globalThis);
