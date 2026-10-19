/* ============================================================
   epidemie/ui_kraje.js – záložka „Kraje“: metapopulační model 14 krajů ČR se schematickou mapou.
   ============================================================ */
(function () {
  'use strict';
  const App = window.EpiApp, Meta = window.EpiMeta, D = window.EpiData, $ = App.$;
  const { f, fc, fp, esc } = App;
  const n = () => App.nast;
  const g = App.graf('g-kr', { vyska: 300, formatY: (y) => fp(y, 1), formatBublina: (y) => fp(y, 2), titulek: 'Infekční v krajích' });
  const mapa = $('#mapa'), mctx = mapa.getContext('2d');
  let vys = null, vybrany = -1, prehravani = false;

  D.kraje.forEach((k, i) => { const o = document.createElement('option'); o.value = i; o.textContent = k.nazev; $('#kr-zdroj').appendChild(o); });
  function naplnit() { $('#kr-zdroj').value = String(n().metaZdroj); }
  $('#kr-zdroj').addEventListener('change', (e) => { n().metaZdroj = Number(e.target.value); App.ulozit(); spocti(); });

  function hex(c) { const m = /^#?([0-9a-f]{6})$/i.exec(c.trim()); if (!m) return [128, 128, 128]; const v = parseInt(m[1], 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; }
  function rampa(t) {
    const css = getComputedStyle(document.documentElement);
    const a = hex(css.getPropertyValue('--mapa-0')), b = hex(css.getPropertyValue('--mapa-1'));
    t = Math.max(0, Math.min(1, t));
    return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(',')})`;
  }

  function spocti() {
    try {
      vys = Meta.simuluj(App.parModel(), { mobilita: n().metaMobilita, exponent: n().metaExponent, zdroj: n().metaZdroj });
    } catch (e) { App.chyba('#kr-chyba', e.message); vys = null; kresliMapu(); return; }
    App.chyba('#kr-chyba', '');
    $('#kr-den').max = String(vys.t.length - 1);
    if (Number($('#kr-den').value) > vys.t.length - 1) $('#kr-den').value = '0';
    graf(); tabulka(); kresliMapu();
  }

  function maxPrevalence() { let m = 0; vys.I.forEach((r, i) => r.forEach(x => { m = Math.max(m, x / vys.regiony[i].N); })); return m; }

  function kresliMapu() {
    const w = mapa.clientWidth, h = mapa.clientHeight;
    if (!w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    if (mapa.width !== Math.round(w * dpr) || mapa.height !== Math.round(h * dpr)) { mapa.width = Math.round(w * dpr); mapa.height = Math.round(h * dpr); }
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mctx.clearRect(0, 0, w, h);
    if (!vys) return;
    const css = getComputedStyle(document.documentElement), barva = v => css.getPropertyValue(v).trim();
    const kr = vys.regiony;
    const kx = Math.cos(49.8 * Math.PI / 180);
    const lonMin = 12.0, lonMax = 18.95, latMin = 48.5, latMax = 51.15;
    const sirkaGeo = (lonMax - lonMin) * kx, vyskaGeo = latMax - latMin;
    const okraj = 30;
    const s = Math.min((w - 2 * okraj) / sirkaGeo, (h - 2 * okraj) / vyskaGeo);
    const ox = (w - sirkaGeo * s) / 2, oy = (h - vyskaGeo * s) / 2;
    const P = (k) => [ox + (k.lon - lonMin) * kx * s, oy + (latMax - k.lat) * s];
    // nejsilnější vazby mobility
    const vazby = [];
    for (let i = 0; i < kr.length; i++) for (let j = i + 1; j < kr.length; j++) vazby.push([i, j, vys.M[i][j] * kr[i].N + vys.M[j][i] * kr[j].N]);
    vazby.sort((a, b) => b[2] - a[2]);
    const maxV = vazby.length ? vazby[0][2] : 1;
    mctx.strokeStyle = barva('--text-faint');
    for (const [i, j, v] of vazby.slice(0, 24)) {
      if (v <= 0) continue;
      mctx.globalAlpha = 0.15 + 0.6 * v / maxV; mctx.lineWidth = 0.5 + 3 * v / maxV;
      const [x1, y1] = P(kr[i]), [x2, y2] = P(kr[j]);
      mctx.beginPath(); mctx.moveTo(x1, y1); mctx.lineTo(x2, y2); mctx.stroke();
    }
    mctx.globalAlpha = 1;
    const den = Math.min(vys.t.length - 1, Number($('#kr-den').value) || 0);
    const maxP = maxPrevalence() || 1;
    $('#kr-max').textContent = fp(maxP, 1);
    const maxN = Math.max(...kr.map(k => k.N));
    mctx.font = '600 11px ' + (barva('--font') || 'sans-serif'); mctx.textAlign = 'center'; mctx.textBaseline = 'middle';
    // větší kraje dřív, menší (a Praha uvnitř Středočeského) navrch
    kr.map((k, i) => i).sort((a, b) => kr[b].N - kr[a].N).forEach((i) => {
      const k = kr[i];
      const [x, y] = P(k);
      const r = Math.max(10, Math.min(w, h) / 14) * (0.45 + 0.6 * Math.sqrt(k.N / maxN));
      const prev = vys.I[i][den] / k.N;
      mctx.fillStyle = rampa(prev / maxP);
      mctx.beginPath(); mctx.arc(x, y, r, 0, 6.2832); mctx.fill();
      mctx.lineWidth = i === vybrany ? 3 : i === vys.zdroj ? 2.5 : 1;
      mctx.strokeStyle = i === vybrany ? barva('--c-i') : i === vys.zdroj ? barva('--text') : barva('--border-strong');
      mctx.stroke();
      const t = prev / maxP;
      const svetle = document.documentElement.dataset.theme === 'light';
      mctx.fillStyle = (svetle ? t > 0.55 : t <= 0.55) ? '#ffffff' : '#111111';
      mctx.fillText(k.zkratka, x, y);
    });
    $('#kr-den-popis').textContent = 'den ' + f(vys.t[den], 0);
  }

  function graf() {
    const rady = [];
    vys.I.forEach((r, i) => {
      const hl = i === vybrany, zd = i === vys.zdroj;
      rady.push({
        id: hl ? 'vyb' : zd ? 'zdroj' : 'ost', nazev: hl ? 'vybraný kraj' : zd ? 'kraj s ohniskem' : 'ostatní kraje', kratce: vys.regiony[i].zkratka,
        bezLegendy: !hl && !zd && rady.some(q => q.id === 'ost'), bezBubliny: !hl && !zd,
        barva: hl ? '--c-i' : zd ? '--c-s' : '--text-faint', x: vys.t, y: r.map(y => y / vys.regiony[i].N), sirka: hl || zd ? 2.5 : 1, pruhlednost: hl || zd ? 1 : 0.6, popisKonec: false
      });
    });
    rady.sort((a, b) => (a.id === 'ost' ? 0 : 1) - (b.id === 'ost' ? 0 : 1));
    g.nastav({ rady, pasma: App.pasma(), maxX: vys.par.dny, vLinie: [{ x: Number($('#kr-den').value) || 0 }] });
  }

  function tabulka() {
    const pr = vys.prichod;
    const poradi = vys.regiony.map((_, i) => i).sort((a, b) => (pr[a] == null ? 1e9 : pr[a]) - (pr[b] == null ? 1e9 : pr[b]));
    let h = '<table><thead><tr><th>Kraj</th><th>Obyvatel (2024)</th><th>Příchod (≥ 10 nákaz)</th><th>Vrchol</th><th>Vrchol I</th><th>Zasaženo</th></tr></thead><tbody>';
    for (const i of poradi) {
      const k = D.kraje[i], v = vys.vrchol[i];
      h += `<tr data-kraj="${i}" tabindex="0" style="cursor:pointer${i === vybrany ? '; background: var(--accent-soft)' : ''}"><td>${esc(k.nazev)}${i === vys.zdroj ? ' (ohnisko)' : ''}</td><td>${fc(k.N)}</td>` +
        `<td>${pr[i] == null ? 'nedorazí' : 'den ' + f(pr[i], 0)}</td><td>den ${f(v.t, 0)}</td><td>${fp(v.podil, 2)}</td><td>${fp(vys.zasazeni[i])}</td></tr>`;
    }
    $('#kr-tab').innerHTML = h + '</tbody></table>';
  }
  const vyber = (i) => { vybrany = vybrany === i ? -1 : i; graf(); tabulka(); kresliMapu(); };
  $('#kr-tab').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-kraj]'); if (tr) vyber(Number(tr.dataset.kraj)); });
  $('#kr-tab').addEventListener('keydown', (e) => { const tr = e.target.closest('tr[data-kraj]'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); vyber(Number(tr.dataset.kraj)); } });
  mapa.addEventListener('click', (e) => {
    if (!vys) return;
    const r = mapa.getBoundingClientRect(), w = mapa.clientWidth, h = mapa.clientHeight;
    const kx = Math.cos(49.8 * Math.PI / 180), sirkaGeo = (18.95 - 12) * kx, vyskaGeo = 51.15 - 48.5;
    const s = Math.min((w - 60) / sirkaGeo, (h - 60) / vyskaGeo), ox = (w - sirkaGeo * s) / 2, oy = (h - vyskaGeo * s) / 2;
    let nej = -1, d = 30 * 30;
    vys.regiony.forEach((k, i) => { const x = ox + (k.lon - 12) * kx * s, y = oy + (51.15 - k.lat) * s; const dd = (x - (e.clientX - r.left)) ** 2 + (y - (e.clientY - r.top)) ** 2; if (dd < d) { d = dd; nej = i; } });
    if (nej >= 0) vyber(nej);
  });
  $('#kr-den').addEventListener('input', () => { kresliMapu(); if (vys) graf(); });
  $('#b-kr-prehrat').addEventListener('click', () => {
    if (prehravani) { prehravani = false; $('#b-kr-prehrat').textContent = '▶ Přehrát'; return; }
    if (!vys) return;
    prehravani = true; $('#b-kr-prehrat').textContent = '⏸ Zastavit';
    if (Number($('#kr-den').value) >= vys.t.length - 1) $('#kr-den').value = '0';
    let posl = performance.now();
    const krok = (t) => {
      if (!prehravani || $('#p-kraje').hidden) { prehravani = false; $('#b-kr-prehrat').textContent = '▶ Přehrát'; return; }
      if (t - posl > 50) {
        posl = t;
        const d = Number($('#kr-den').value) + 1;
        if (d > vys.t.length - 1) { prehravani = false; $('#b-kr-prehrat').textContent = '▶ Přehrát'; return; }
        $('#kr-den').value = String(d); kresliMapu(); graf();
      }
      requestAnimationFrame(krok);
    };
    requestAnimationFrame(krok);
  });
  new ResizeObserver(() => kresliMapu()).observe(mapa);
  new MutationObserver(() => kresliMapu()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  App.zalozky.kraje = {
    naplnit,
    aktivuj() { if (this.zastarale || !vys) { spocti(); this.zastarale = false; } else kresliMapu(); },
    zmena() { spocti(); this.zastarale = false; }
  };
  App.kraje = { get vys() { return vys; } };
})();
