/* ============================================================
   Výletní deník – tiskový / exportní dokument (čisté sestavení HTML, bez DOM)
   Mapa a výškový profil jsou SVG (bez mapových dlaždic), takže dokument
   funguje offline, v tisku i jako samostatný HTML soubor.
   ============================================================ */
(function () {
  'use strict';
  const D = typeof module !== 'undefined' ? require('./jadro.js') : window.DENIK;
  const x = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const odst = s => x(s).split(/\n{2,}/).map(p => '<p>' + p.replace(/\n/g, '<br>') + '</p>').join('');

  const merkX = lon => (lon + 180) / 360;
  const merkY = lat => { const s = Math.sin(lat * Math.PI / 180); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };

  /** Promítne body do obdélníku š×v (Web Mercator, zachová poměr). Vrací {p(lat,lon)→[x,y], mPerPx} nebo null. */
  function projekce(bbox, s, v, okraj) {
    if (!bbox) return null;
    okraj = okraj == null ? 16 : okraj;
    let [la1, lo1, la2, lo2] = bbox;
    if (la2 - la1 < 0.002) { la1 -= 0.001; la2 += 0.001; }
    if (lo2 - lo1 < 0.002) { lo1 -= 0.001; lo2 += 0.001; }
    const x1 = merkX(lo1), x2 = merkX(lo2), y1 = merkY(la2), y2 = merkY(la1);
    const k = Math.min((s - 2 * okraj) / (x2 - x1), (v - 2 * okraj) / (y2 - y1));
    const ox = (s - (x2 - x1) * k) / 2, oy = (v - (y2 - y1) * k) / 2;
    const latS = (la1 + la2) / 2;
    // obvod Země na rovnoběžce / šířka světa v px
    const mPerPx = 2 * Math.PI * D.R_ZEME * Math.cos(latS * Math.PI / 180) / k;
    return { p: (lat, lon) => [ox + (merkX(lon) - x1) * k, oy + (merkY(lat) - y1) * k], mPerPx };
  }
  function meritko(mPerPx, maxPx) {
    const cil = mPerPx * maxPx;
    const r = Math.pow(10, Math.floor(Math.log10(cil)));
    const kroky = [5, 2, 1].map(k => k * r).find(k => k <= cil) || r;
    return { m: kroky, px: kroky / mPerPx, text: kroky >= 1000 ? D.cislo(kroky / 1000, 0) + ' km' : D.cislo(kroky, 0) + ' m' };
  }

  /** SVG mapa výletu: linie (pole polí [lat,lon]), body [{lat,lon,cislo}], fotky [{lat,lon}]. */
  function svgMapa(linie, body, fotky, s, v) {
    s = s || 640; v = v || 360;
    let bb = null;
    for (const l of linie || []) for (const [a, b] of l) bb = D.bboxSjednot(bb, [a, b, a, b]);
    for (const p of (body || []).concat(fotky || [])) if (p.lat != null) bb = D.bboxSjednot(bb, [p.lat, p.lon, p.lat, p.lon]);
    if (!bb) return '';
    const pr = projekce(bb, s, v, 22);
    const f = n => (Math.round(n * 10) / 10).toString();
    let o = `<svg class="t-mapa" viewBox="0 0 ${s} ${v}" width="${s}" height="${v}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mapa trasy">`;
    o += `<rect x="0" y="0" width="${s}" height="${v}" fill="#f4f1e8" stroke="#b9b2a0"/>`;
    for (const l of linie || []) {
      if (l.length < 2) continue;
      const pts = l.map(([a, b]) => pr.p(a, b).map(f).join(',')).join(' ');
      o += `<polyline points="${pts}" fill="none" stroke="#ffffff" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>`;
      o += `<polyline points="${pts}" fill="none" stroke="#c0392b" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;
      const [sx, sy] = pr.p(l[0][0], l[0][1]), [kx, ky] = pr.p(l[l.length - 1][0], l[l.length - 1][1]);
      o += `<circle cx="${f(sx)}" cy="${f(sy)}" r="5" fill="#1e8449" stroke="#fff" stroke-width="1.5"/><circle cx="${f(kx)}" cy="${f(ky)}" r="5" fill="#1b2631" stroke="#fff" stroke-width="1.5"/>`;
    }
    for (const p of fotky || []) {
      if (p.lat == null) continue;
      const [a, b] = pr.p(p.lat, p.lon);
      o += `<rect x="${f(a - 3.5)}" y="${f(b - 3.5)}" width="7" height="7" fill="#2471a3" stroke="#fff" stroke-width="1"/>`;
    }
    for (const p of body || []) {
      if (p.lat == null) continue;
      const [a, b] = pr.p(p.lat, p.lon);
      o += `<circle cx="${f(a)}" cy="${f(b)}" r="9" fill="#f39c12" stroke="#1b2631" stroke-width="1"/><text x="${f(a)}" y="${f(b + 3.5)}" font-size="10" font-family="sans-serif" text-anchor="middle" fill="#1b2631" font-weight="700">${p.cislo}</text>`;
    }
    const m = meritko(pr.mPerPx, s / 4);
    o += `<g transform="translate(12 ${v - 14})"><rect x="-4" y="-14" width="${f(m.px + 8)}" height="20" fill="#ffffff" opacity=".8"/><line x1="0" y1="0" x2="${f(m.px)}" y2="0" stroke="#1b2631" stroke-width="2"/><line x1="0" y1="-4" x2="0" y2="2" stroke="#1b2631" stroke-width="2"/><line x1="${f(m.px)}" y1="-4" x2="${f(m.px)}" y2="2" stroke="#1b2631" stroke-width="2"/><text x="${f(m.px / 2)}" y="-4" font-size="10" font-family="sans-serif" text-anchor="middle" fill="#1b2631">${x(m.text)}</text></g>`;
    o += `<text x="${s - 10}" y="16" font-size="12" font-family="sans-serif" text-anchor="end" fill="#1b2631">S ↑</text>`;
    return o + '</svg>';
  }

  /** SVG výškový profil z D.vyskovyProfil. */
  function svgProfil(profil, s, v) {
    s = s || 640; v = v || 160;
    if (!profil || profil.length < 2) return '';
    const ml = 44, mr = 10, mt = 10, mb = 24;
    const dMax = profil[profil.length - 1].d || 1;
    let eMin = Infinity, eMax = -Infinity;
    for (const p of profil) { eMin = Math.min(eMin, p.ele); eMax = Math.max(eMax, p.ele); }
    if (eMax - eMin < 20) { const st = (eMax + eMin) / 2; eMin = st - 10; eMax = st + 10; }
    const krokE = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find(k => (eMax - eMin) / k <= 5) || 1000;
    eMin = Math.floor(eMin / krokE) * krokE; eMax = Math.ceil(eMax / krokE) * krokE;
    const X = d => ml + d / dMax * (s - ml - mr), Y = e => mt + (eMax - e) / (eMax - eMin) * (v - mt - mb);
    const f = n => (Math.round(n * 10) / 10).toString();
    let o = `<svg class="t-profil" viewBox="0 0 ${s} ${v}" width="${s}" height="${v}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Výškový profil">`;
    for (let e = eMin; e <= eMax + 1e-9; e += krokE) o += `<line x1="${ml}" x2="${s - mr}" y1="${f(Y(e))}" y2="${f(Y(e))}" stroke="#d5d8dc"/><text x="${ml - 4}" y="${f(Y(e) + 3)}" font-size="9" font-family="sans-serif" text-anchor="end" fill="#34495e">${D.cislo(e, 0)}</text>`;
    const krokD = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000].find(k => dMax / k <= 8) || 100000;
    for (let d = 0; d <= dMax; d += krokD) o += `<text x="${f(X(d))}" y="${v - 8}" font-size="9" font-family="sans-serif" text-anchor="middle" fill="#34495e">${D.cislo(d / 1000, krokD < 1000 ? 1 : 0)}</text>`;
    o += `<text x="${s - mr}" y="${v - 0}" font-size="9" font-family="sans-serif" text-anchor="end" fill="#34495e">km</text>`;
    const pts = profil.map(p => f(X(p.d)) + ',' + f(Y(p.eleHladka != null ? p.eleHladka : p.ele))).join(' ');
    o += `<polygon points="${f(X(0))},${f(Y(eMin))} ${pts} ${f(X(dMax))},${f(Y(eMin))}" fill="#a9cce3" opacity=".7"/>`;
    o += `<polyline points="${pts}" fill="none" stroke="#1f618d" stroke-width="1.6"/>`;
    return o + '</svg>';
  }

  const STYL = `
:root{--p-text:#1b2631;--p-tlumeny:#4d5656;--p-cara:#ccd1d1;--p-akcent:#1f618d;--p-pozadi:#ffffff}
*{box-sizing:border-box}
body{margin:0;background:var(--p-pozadi);color:var(--p-text);font:11pt/1.45 Georgia,'Times New Roman',serif}
.denik-tisk{max-width:190mm;margin:0 auto;padding:10mm 0}
.denik-tisk h1{font:700 22pt/1.2 sans-serif;margin:0 0 4mm;color:var(--p-akcent)}
.denik-tisk .uvod{color:var(--p-tlumeny);font-size:10pt;margin-bottom:8mm}
.denik-tisk .obsah{columns:2;font-size:10pt;margin-bottom:6mm}
.denik-tisk .obsah li{break-inside:avoid;margin-bottom:1mm}
.titulni{text-align:center;break-after:page;page-break-after:always}
.titulni h1{font-size:30pt;margin:6mm 0 2mm}
.titulni .obdobi{font:12pt sans-serif;color:var(--p-tlumeny);margin-bottom:6mm}
.titulni svg{margin:2mm auto}
.titulni table{margin:2mm auto;width:auto;font:10pt sans-serif;border-collapse:collapse}
.titulni th,.titulni td{border-bottom:1px solid var(--p-cara);padding:1mm 4mm;text-align:right}
.cisla-t{display:flex;justify-content:center;gap:8mm;flex-wrap:wrap;margin:4mm 0}
.cisla-t div{font:9pt sans-serif;color:var(--p-tlumeny)}
.cisla-t b{display:block;font:700 16pt sans-serif;color:var(--p-text)}
.obsah-strana{break-after:page;page-break-after:always}
.obsah-strana h2{font:700 17pt sans-serif}
.vylet{break-before:page;page-break-before:always}
.obsah-strana + .vylet,.uvod + .vylet{break-before:auto;page-break-before:auto}
.vylet h2{font:700 17pt/1.25 sans-serif;margin:0 0 1mm}
.vylet .kdy{font:10pt sans-serif;color:var(--p-tlumeny);margin-bottom:4mm}
.vylet h3{font:700 11pt sans-serif;margin:5mm 0 2mm;color:var(--p-akcent);break-after:avoid}
.vylet table{border-collapse:collapse;font:9.5pt sans-serif;width:100%;margin:2mm 0}
.vylet th,.vylet td{border-bottom:1px solid var(--p-cara);padding:1.2mm 2mm;text-align:left;vertical-align:top}
.vylet th{color:var(--p-tlumeny);font-weight:600;width:32%}
.vylet .cisla td{text-align:right}
.vylet svg{max-width:100%;height:auto;display:block;margin:2mm 0;break-inside:avoid}
.vylet .body li{margin-bottom:1mm}
.galerie{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm}
.galerie figure{margin:0;break-inside:avoid;page-break-inside:avoid}
.galerie img{width:100%;height:auto;display:block;border:1px solid var(--p-cara)}
.galerie figcaption{font:8.5pt/1.3 sans-serif;color:var(--p-tlumeny);margin-top:1mm}
.poznamka{font:8.5pt sans-serif;color:var(--p-tlumeny);margin-top:6mm}
@page{size:A4;margin:14mm 12mm}
@media screen{body{padding:0 4mm}.denik-tisk{padding:8mm 0}}
@media (max-width:600px){.galerie{grid-template-columns:repeat(2,1fr)}.denik-tisk .obsah{columns:1}}
`;

  /**
   * Sestaví HTML deníku.
   * polozky: [{vylet, trasy, profil, fotky:[{src, popis, datum, bodCislo, lat, lon}]}]
   * volby: {titulek, samostatny (celý dokument s <html>), vytvoreno, metodaVysek}
   */
  function dokument(polozky, volby) {
    volby = volby || {};
    const tit = volby.titulek || 'Výletní deník';
    let o = '<div class="denik-tisk">';
    const vsech = polozky.map(p => p.vylet);
    if (polozky.length > 1) {
      // titulní strana: období, souhrn, přehledová mapa a tabulka po letech
      const dny = vsech.map(v => D.rozsahDni(v)).filter(Boolean);
      const od = dny.length ? D.denText(Math.min(...dny.map(r => r[0]))) : '', doD = dny.length ? D.denText(Math.max(...dny.map(r => r[1]))) : '';
      const roky = D.statistikyPodleLet(vsech, volby.pocetFotek), su = D.souhrn(roky);
      o += `<section class="titulni"><h1>${x(tit)}</h1>`;
      if (od) o += `<div class="obdobi">${x(D.datumCesky(od))} – ${x(D.datumCesky(doD))}</div>`;
      o += `<div class="cisla-t"><div><b>${polozky.length}</b>výletů</div><div><b>${su.dni}</b>dní</div><div><b>${x(D.km(su.delka))}</b>tras</div><div><b>${x(D.metry(su.stoupani))}</b>stoupání</div></div>`;
      const linie = [], body = [];
      vsech.forEach((v, i) => {
        for (const l of v.nahled || []) linie.push(l);
        const st = v.nahled && v.nahled[0] && v.nahled[0][0] ? { lat: v.nahled[0][0][0], lon: v.nahled[0][0][1] } : (v.body && v.body[0]) || null;
        if (st) body.push({ lat: st.lat, lon: st.lon, cislo: i + 1 });
      });
      const prehled = svgMapa(linie, body, [], 640, 420);
      if (prehled) o += '<h3>Přehledová mapa (čísla podle obsahu)</h3>' + prehled;
      if (roky.length) {
        o += '<h3>Podle let</h3><table class="cisla"><tr><th>Rok</th><td>Výletů</td><td>Dní</td><td>Délka</td><td>Stoupání</td></tr>' +
          roky.map(r => `<tr><th>${r.rok}</th><td>${r.vyletu}</td><td>${r.dni}</td><td>${x(D.km(r.delka))}</td><td>${x(D.metry(r.stoupani))}</td></tr>`).join('') + '</table>';
      }
      o += `<div class="uvod">Vytvořeno ${x(volby.vytvoreno || '')}</div></section>`;
      o += '<section class="obsah-strana"><h2>Obsah</h2><ol class="obsah">' + polozky.map(p => `<li>${x(p.vylet.nazev)} – ${x(D.rozsahCesky(p.vylet))}${p.vylet.statistika && p.vylet.statistika.delka ? ' · ' + x(D.km(p.vylet.statistika.delka)) : ''}</li>`).join('') + '</ol></section>';
    } else {
      o += `<div class="uvod">Výletní deník · vytvořeno ${x(volby.vytvoreno || '')}</div>`;
    }
    for (const p of polozky) {
      const v = p.vylet, st = v.statistika;
      o += `<section class="vylet"><h2>${polozky.length > 1 ? (polozky.indexOf(p) + 1) + '. ' : ''}${x(v.nazev || 'Bez názvu')}</h2>`;
      o += `<div class="kdy">${x(D.rozsahCesky(v))}${v.oblast ? ' · ' + x(v.oblast) : ''}${v.hodnoceni ? ' · ' + '★'.repeat(v.hodnoceni) + '☆'.repeat(5 - v.hodnoceni) : ''}</div>`;
      const radky = [];
      if ((v.ucastnici || []).length) radky.push(['Účastníci', x(v.ucastnici.join(', '))]);
      if ((v.doprava || []).length) radky.push(['Doprava', x(v.doprava.join(', '))]);
      if ((v.stitky || []).length) radky.push(['Štítky', x(v.stitky.join(', '))]);
      if (v.pocasi && v.pocasi.dny && v.pocasi.dny.length) radky.push(['Počasí', x(D.pocasiText(v.pocasi.dny)) + ' <small>(Open-Meteo)</small>']);
      const n = D.soucetNakladu(v.naklady);
      if (Object.keys(n).length) radky.push(['Náklady', x(D.naklText(n)) + (v.naklady.length ? '<br><small>' + v.naklady.filter(k => k.popis || k.castka).map(k => x((k.popis || '–') + ': ' + D.cislo(D.parseCislo(k.castka), 2) + ' ' + (k.mena || 'CZK'))).join('; ') + '</small>' : '')]);
      if (st && st.pocetBodu) {
        radky.push(['Délka trasy', D.km(st.delka)]);
        if (st.maVysky) {
          radky.push(['Stoupání / klesání', `${D.metry(st.stoupani)} / ${D.metry(st.klesani)} <small>(vyhlazeno; syrově ${D.metry(st.stoupaniSyrove)})</small>`]);
          radky.push(['Nejnižší / nejvyšší bod', `${D.metry(st.minEle)} / ${D.metry(st.maxEle)}`]);
        }
        if (st.maCasy) radky.push(['Čas celkem / v pohybu', `${D.doba(st.casCelkem)} / ${D.doba(st.casPohyb)}`]);
      }
      if (radky.length) o += '<table>' + radky.map(r => `<tr><th>${r[0]}</th><td>${r[1]}</td></tr>`).join('') + '</table>';
      if (v.popis) o += '<h3>Popis</h3>' + odst(v.popis);
      const body = (v.body || []).map((b, i) => Object.assign({ cislo: i + 1 }, b));
      const linie = (p.trasy || []).flatMap(t => t.segmenty.map(s => D.zjednodus(s, 3)));
      const fotkyMisto = (p.fotky || []).filter(f => f.lat != null);
      const mapa = svgMapa(linie.length ? linie : (v.nahled || []), body, fotkyMisto, 640, 380);
      if (mapa) o += '<h3>Mapa</h3>' + mapa;
      if (p.profil && p.profil.length > 1) o += '<h3>Výškový profil</h3>' + svgProfil(p.profil, 640, 160);
      if (body.length) {
        o += '<h3>Místa</h3><ol class="body">' + body.map(b => `<li><b>${x(b.nazev)}</b>${b.popis ? ' – ' + x(b.popis) : ''} <small>(${D.cislo(b.lat, 5)}, ${D.cislo(b.lon, 5)})</small></li>`).join('') + '</ol>';
      }
      if (v.poznamky) o += '<h3>Poznámky</h3>' + odst(v.poznamky);
      if ((p.fotky || []).length) {
        o += '<h3>Fotografie</h3><div class="galerie">';
        for (const f of p.fotky) {
          const pop = [f.popis, f.bodCislo ? 'místo ' + f.bodCislo : '', f.datum ? f.datum.replace('T', ' ').slice(0, 16) : ''].filter(Boolean).join(' · ');
          o += `<figure><img src="${x(f.src)}" alt="${x(f.popis || 'fotografie')}" loading="eager">${pop ? `<figcaption>${x(pop)}</figcaption>` : ''}</figure>`;
        }
        o += '</div>';
      }
      o += '</section>';
    }
    if (volby.metodaVysek) o += `<p class="poznamka">${x(volby.metodaVysek)}</p>`;
    o += '</div>';
    if (!volby.samostatny) return o;
    return `<!DOCTYPE html>\n<html lang="cs"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${x(tit)}</title><style>${STYL}</style></head><body>${o}</body></html>\n`;
  }

  const API = { svgMapa, svgProfil, dokument, projekce, meritko, STYL };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else window.DENIK_TISK = API;
})();
