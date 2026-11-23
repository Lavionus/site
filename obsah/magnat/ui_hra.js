/* Dopravní magnát – herní část rozhraní: nástroje stavby, okna (finance, vozidla, stanice, garáže),
   zprávy, ukládání (IndexedDB + soubor). Načítá se PŘED ui.js a napojuje se přes háčky v U = MAG.UI. */
(function () {
  'use strict';
  const MAG = window.MAG, D = MAG.data, M = MAG.mapa, H = MAG.hra, C = MAG.cesty, Z = MAG.zeleznice;
  const U = MAG.UI = MAG.UI || {};
  const $ = id => document.getElementById(id);
  const penize = n => (n < 0 ? '−' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('cs-CZ');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const datumText = (h, den) => { const d = H.datum(h, den); return `${d.den}. ${d.mesic}. ${d.rok}`; };
  const NAZVY_MES = ['led', 'úno', 'bře', 'dub', 'kvě', 'čer', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];

  // --- ikony z atlasů (obrázek, když je načtený; jinak emoji) ----------------------------
  function ikona(atlas, k, px = 18, popis = '') {
    const A = MAG.ATLAS && MAG.ATLAS[atlas], f = A && A.snimky[k], im = MAG.grafika.OBR[atlas];
    if (!f || !im) return null;
    const s = px / Math.max(f[2], f[3]);
    return `<span class="ik" role="img" aria-label="${popis}" style="width:${px}px;height:${px}px;background-image:url(${A.obr});`
      + `background-size:${(im.naturalWidth * s).toFixed(1)}px ${(im.naturalHeight * s).toFixed(1)}px;`
      + `background-position:${(-f[0] * s + (px - f[2] * s) / 2).toFixed(1)}px ${(-f[1] * s + (px - f[3] * s) / 2).toFixed(1)}px"></span>`;
  }
  const INDEX_NAKLADU = Object.fromEntries(D.NAKLADY.map((n, k) => [n.id, k]));
  const ikN = (id, px) => ikona('ikony1', INDEX_NAKLADU[id], px, D.NAKLADY_PODLE_ID[id].nazev) || D.NAKLADY_PODLE_ID[id].ikona;
  U.ikona = ikona; U.ikN = ikN;

  // --- zprávy ------------------------------------------------------------------------
  const plocha = $('plocha');
  const zpravyEl = document.createElement('div');
  zpravyEl.className = 'zpravy'; zpravyEl.setAttribute('aria-live', 'polite');
  plocha.appendChild(zpravyEl);
  function zprava(text, kam, chyba) {
    const el = document.createElement('div');
    el.className = 'zprava' + (chyba ? ' chyba' : '') + (kam ? ' klik' : '');
    el.textContent = text;
    if (kam) el.addEventListener('click', () => { if (kam.vozidlo !== undefined) oknoVozidla(kam.vozidlo); else U.naPole(kam.x, kam.y); });
    zpravyEl.appendChild(el);
    while (zpravyEl.children.length > 4) zpravyEl.firstChild.remove();
    setTimeout(() => { el.classList.add('pryc'); setTimeout(() => el.remove(), 400); }, chyba ? 4000 : 6500);
  }
  U.zprava = zprava;
  const plovouci = [];   // „+$123“ nad stanicí

  // --- lišta (datum, peníze) --------------------------------------------------------------
  function aktualizujListu() {
    const h = U.hra; if (!h) return;
    $('stDatum').textContent = datumText(h);
    const kr = $('stKrize'); if (kr) kr.hidden = !(h.ekonomika && h.ekonomika.krize > 0);
    const p = $('stPenize');
    p.textContent = penize(h.firma.penize);
    p.classList.toggle('minus', h.firma.penize < 0);
  }

  // --- nástroje stavby -------------------------------------------------------------------------
  const NASTROJE = {
    silnice: { nazev: '🛣️ Silnice', napoveda: 'Táhni po poli: rovná silnice' },
    bus: { nazev: '🚏 Zastávka autobusu', napoveda: 'Klikni na rovný úsek silnice' },
    nakl: { nazev: '🚚 Nákladní stanoviště', napoveda: 'Klikni na rovný úsek silnice u podniku' },
    garaz: { nazev: '🅿️ Garáž', napoveda: 'Klikni na volné pole vedle silnice' },
    zbor: { nazev: '🚜 Buldozer', napoveda: 'Táhni obdélník: bourá tvé stavby a kácí stromy' },
    kolej: { nazev: '🛤️ Kolej', napoveda: 'Táhni rovně; oblouk = navázat další úsek; přes vodu postaví most' },
    nadrazi: { nazev: '🚉 Nádraží', napoveda: 'Táhni podél koleje nebo po volném poli (1–8 polí)' },
    depo: { nazev: '🏭 Železniční depo', napoveda: 'Klikni na volné pole vedle koleje' },
    navest: { nazev: '🚦 Cestové návěstidlo', napoveda: 'Klikni na rovnou kolej: směr A → B → oba → žádné' },
    navestJ: { nazev: '⛔ Jednosměrné návěstidlo', napoveda: 'Klikni na rovnou kolej: proti směru se nesmí jet (A → B → žádné)' },
  };
  let nahled = null;         // {pole:[[x,y]], cena, chyba, oblast:[x0,y0,x1,y1], kde:[sx,sy]}
  let cekaRozkaz = null;     // id vozidla, kterému klikem přidáváme zastávku
  function vyberNastroj(id) {
    cekaRozkaz = null;
    if (U.nastroj === id || !id) { U.zrusNastroj(); return; }
    U.nastroj = id; nahled = null;
    $('stNastroj').textContent = `${NASTROJE[id].nazev} – ${NASTROJE[id].napoveda} (Esc konec)`;
    $('stNastroj').hidden = false;
    document.querySelectorAll('[data-nastroj]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.nastroj === id)));
    $('platno').style.cursor = 'crosshair';
    U.prekresli();
  }
  U.zrusNastroj = () => {
    U.nastroj = null; nahled = null; cekaRozkaz = null;
    $('stNastroj').hidden = true;
    document.querySelectorAll('[data-nastroj]').forEach(b => b.setAttribute('aria-pressed', 'false'));
    $('platno').style.cursor = '';
    U.prekresli();
  };
  function zpracujZmeny() {
    const h = U.hra;
    if (!h.zmeny.length) return;
    for (const [x0, y0, x1, y1] of h.zmeny) U.kreslic.zneplatni(x0, y0, x1, y1);
    h.zmeny.length = 0;
    U.pripravMinimapu();
  }
  function obdelnik(a, b) { return [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)]; }
  function provedNastroj(a, b, ostre) {
    const h = U.hra, n = U.nastroj, R = D.DOSAH_ZASTAVKY;
    if (!a || !b) return null;
    let r, pole = [], oblast = null;
    if (n === 'silnice') { r = H.postavSilnici(h, a.x, a.y, b.x, b.y, !ostre); pole = H.cara(a.x, a.y, b.x, b.y); }
    else if (n === 'bus' || n === 'nakl') { r = H.postavZastavku(h, b.x, b.y, n, !ostre); pole = [[b.x, b.y]]; oblast = [b.x - R, b.y - R, b.x + R, b.y + R]; }
    else if (n === 'garaz') { r = H.postavGaraz(h, b.x, b.y, !ostre); pole = [[b.x, b.y]]; }
    else if (n === 'kolej') { r = Z.postavKolej(h, a.x, a.y, b.x, b.y, !ostre); pole = H.cara(a.x, a.y, b.x, b.y); }
    else if (n === 'nadrazi') {
      r = Z.postavNadrazi(h, a.x, a.y, b.x, b.y, !ostre); pole = H.cara(a.x, a.y, b.x, b.y);
      const R4 = D.DOSAH_NADRAZI, [x0, y0, x1, y1] = obdelnik(a, b);
      oblast = [x0 - R4, y0 - R4, x1 + R4, y1 + R4];
    }
    else if (n === 'depo') { r = Z.postavDepo(h, b.x, b.y, !ostre); pole = [[b.x, b.y]]; }
    else if (n === 'navest' || n === 'navestJ') { r = Z.prepniNavest(h, b.x, b.y, n === 'navestJ', !ostre); pole = [[b.x, b.y]]; }
    else if (n === 'zbor') {
      const [x0, y0, x1, y1] = obdelnik(a, b);
      r = H.zbor(h, x0, y0, x1, y1, !ostre);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) pole.push([x, y]);
    }
    return { r, pole, oblast };
  }
  U.tahNastroje = (faze, a, b, kde) => {
    if (faze === 'zrus') { nahled = null; U.prekresli(); return; }
    if (cekaRozkaz !== null) return;
    if (faze === 'konec') {
      const v = provedNastroj(a, b, true);
      nahled = null;
      if (!v) return;
      if (v.r.ok) {
        zpracujZmeny(); aktualizujListu(); obnovOkna();
        if (v.r.cena) plovouci.push({ x: b.x + 0.5, y: b.y + 0.5, text: penize(-v.r.cena), barva: '#ff9b8a', t: performance.now() });
        if (v.r.varovani) zprava(v.r.varovani, null, true);
        // garáž: rovnou otevřít okno
        if (U.nastroj === 'garaz' || U.nastroj === 'depo') { const g = U.hra.depa[U.mapa.depo[b.y * U.mapa.W + b.x] - 1]; if (g) oknoGaraze(g.id); }
      } else zprava(v.r.chyba, null, true);
      return;
    }
    const v = provedNastroj(a, b, false);
    nahled = v && { pole: v.pole, cena: v.r.cena, chyba: v.r.ok ? null : v.r.chyba, oblast: v.oblast, b };
    U.prekresli();
  };

  // --- kreslení navrch ----------------------------------------------------------------------------
  function obrys(g, x, y, z, ox, oy, vypln, cara) {
    const o = U.kreslic.obrysPole(x, y);
    g.beginPath(); o.forEach(([a, b], i) => g[i ? 'lineTo' : 'moveTo'](a * z + ox, b * z + oy)); g.closePath();
    if (vypln) { g.fillStyle = vypln; g.fill(); }
    if (cara) { g.strokeStyle = cara; g.lineWidth = 1.5; g.stroke(); }
  }
  function oblastObrys(g, pole, z, ox, oy, barva) {
    const m = U.mapa;
    for (const i of pole) obrys(g, i % m.W, (i / m.W) | 0, z, ox, oy, barva, null);
  }
  let vybranaStanice = null, sledovane = null, vybraneVozidlo = null;
  function seznamVozidel(h) {
    const out = [];
    for (const v of h.vozidla) {
      if (!H.aktivni(v) || v.stav === 'depo') continue;
      if (v.druh === 'vlak') {
        for (const voz of Z.vozyVlaku(h, v)) out.push({ ...voz, barva: voz.druh === 'lok' ? h.firma.barva : voz.barva, vybrane: voz.druh === 'lok' && v.id === vybraneVozidlo, id: v.id });
        continue;
      }
      const p = H.polohaVozidla(h, v);
      if (!p) continue;
      const nk = v.oddily[0] && D.NAKLADY_PODLE_ID[v.oddily[0].typ];
      out.push({ x: p.x, y: p.y, d: p.d, druh: v.druh, barva: h.firma.barva, naklad: nk && nk.barva, plny: v.oddily.some(o => o.n > 0), vybrane: v.id === vybraneVozidlo, id: v.id });
    }
    return out;
  }
  U.poKresleni = (g, z, ox, oy) => {
    const h = U.hra; if (!h) return;
    const m = h.m;
    if (vybranaStanice !== null && h.stanice[vybranaStanice]) oblastObrys(g, H.oblast(h, h.stanice[vybranaStanice]), z, ox, oy, 'rgba(120,200,255,.18)');
    if (nahled) {
      if (nahled.oblast) {
        const [x0, y0, x1, y1] = nahled.oblast;
        for (let y = Math.max(0, y0); y <= Math.min(m.H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(m.W - 1, x1); x++) obrys(g, x, y, z, ox, oy, 'rgba(120,200,255,.16)', null);
      }
      const barva = nahled.chyba ? 'rgba(255,90,70,.35)' : 'rgba(120,255,140,.3)', cara = nahled.chyba ? '#ff6a5a' : '#8dffa0';
      for (const [x, y] of nahled.pole) if (M.uvnitr(m, x, y)) obrys(g, x, y, z, ox, oy, barva, cara);
    }
    kresliNavestidla(g, z, ox, oy);
    G_vozidla(g, z, ox, oy);
    // plovoucí částky
    const ted = performance.now();
    for (let k = plovouci.length - 1; k >= 0; k--) {
      const p = plovouci[k], st = (ted - p.t) / 1600;
      if (st >= 1) { plovouci.splice(k, 1); continue; }
      const [wx, wy] = U.kreslic.svetNaObr(p.x, p.y);
      g.font = '700 13px system-ui, sans-serif'; g.textAlign = 'center';
      g.fillStyle = `rgba(0,0,0,${0.6 * (1 - st)})`; g.fillText(p.text, wx * z + ox + 1, wy * z + oy - 28 - st * 30 + 1);
      g.fillStyle = p.barva; g.globalAlpha = 1 - st; g.fillText(p.text, wx * z + ox, wy * z + oy - 28 - st * 30); g.globalAlpha = 1;
      U.prekresli();
    }
    // cena / chyba u kurzoru
    if (nahled && (nahled.cena || nahled.chyba)) {
      const [wx, wy] = U.kreslic.stredPole(nahled.b.x, nahled.b.y);
      const text = nahled.chyba || `Cena ${penize(nahled.cena)}`;
      g.font = '600 12px system-ui, sans-serif';
      const w = g.measureText(text).width + 14, sx = wx * z + ox, sy = wy * z + oy - 34;
      g.fillStyle = nahled.chyba ? 'rgba(120,20,16,.92)' : 'rgba(16,40,22,.92)';
      g.beginPath(); (g.roundRect ? g.roundRect(sx - w / 2, sy - 11, w, 22, 11) : g.rect(sx - w / 2, sy - 11, w, 22)); g.fill();
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, sx, sy);
    }
  };
  // seznam návěstidel se přepočítá při změně sítě; barva podle rezervace / obsazení pole za ním
  let navestidla = [], navestVerze = -1;
  function kresliNavestidla(g, z, ox, oy) {
    const h = U.hra, m = h.m;
    if (z < 0.5) return;
    if (navestVerze !== (h.sitVerze || 0) || navestVerze === -1) {
      navestVerze = h.sitVerze || 0; navestidla = [];
      for (let i = 0; i < m.navest.length; i++) if (m.navest[i]) for (let d = 0; d < 4; d++) if (m.navest[i] & (1 << d)) navestidla.push([i, d, (m.navestJ[i] & (1 << d)) !== 0]);
    }
    if (!navestidla.length) return;
    const obsazeno = new Set();
    for (const v of h.vozidla) if (H.aktivni(v) && v.druh === 'vlak' && v.telo) for (const i of v.telo) obsazeno.add(i);
    for (const [i, d, jedno] of navestidla) {
      const x = i % m.W, y = (i / m.W) | 0, [dx, dy] = M.SOUSEDE4[d];
      // sloupek vpravo od koleje, u výjezdu z pole
      const px = x + 0.5 + dx * 0.32 - dy * 0.34, py = y + 0.5 + dy * 0.32 + dx * 0.34;
      const [wx, wy] = U.kreslic.svetNaObr(px, py);
      const sx = wx * z + ox, sy = wy * z + oy;
      if (sx < -20 || sy < -40 || sx > U.platnoW + 20 || sy > U.platnoH + 20) continue;
      const j = C.soused(m, i, d);
      const cervena = j < 0 || h.rez[j] !== undefined || obsazeno.has(j);
      g.fillStyle = '#3a3a3a'; g.fillRect(sx - 0.8 * z, sy - 16 * z, 1.6 * z, 16 * z);
      g.beginPath(); g.arc(sx, sy - 17 * z, 3.4 * z, 0, Math.PI * 2);
      g.fillStyle = cervena ? '#ff3b2f' : '#38e36b'; g.fill();
      g.lineWidth = Math.max(1, z); g.strokeStyle = jedno ? '#ffffff' : '#1a1a1a'; g.stroke();
    }
  }

  function G_vozidla(g, z, ox, oy) {
    const h = U.hra, sez = seznamVozidel(h);
    // jen viditelná
    const W = U.platnoW, Hh = U.platnoH;
    const vid = sez.filter(v => { const [a, b] = U.kreslic.svetNaObr(v.x, v.y); const sx = a * z + ox, sy = b * z + oy; return sx > -40 && sx < W + 40 && sy > -40 && sy < Hh + 40; });
    U.kreslic.kresliVozidla(g, vid, z, ox, oy);
    if (vid.length) U.prekresli();
  }
  U.vozidloNa = (sx, sy) => {
    const h = U.hra; if (!h) return null;
    const z = U.zoom, ox = U.platnoW / 2 - U.kamera.x * z, oy = U.platnoH / 2 - U.kamera.y * z;
    let nej = null, nd = 16;
    for (const v of seznamVozidel(h)) {
      const [a, b] = U.kreslic.svetNaObr(v.x, v.y);
      const d = Math.hypot(a * z + ox - sx, b * z + oy - 5 * z - sy);
      if (d < nd) { nd = d; nej = h.vozidla[v.id]; }
    }
    return nej;
  };
  U.klikVozidlo = v => oknoVozidla(v.id);
  U.klikPole = (pole) => {
    const h = U.hra, m = h.m, i = pole.y * m.W + pole.x;
    if (cekaRozkaz !== null) {
      if (!m.stan[i]) { zprava('Klikni na zastávku nebo stanoviště', null, true); return true; }
      const r = H.pridejRozkaz(h, cekaRozkaz, m.stan[i] - 1);
      if (!r.ok) zprava(r.chyba, null, true);
      else { zprava(`Přidáno: ${h.stanice[m.stan[i] - 1].jmeno}`); oknoVozidla(cekaRozkaz); }
      return true;
    }
    if (U.nastroj) return true;
    if (m.stan[i]) { oknoStanice(m.stan[i] - 1); return true; }
    if (m.depo[i]) { oknoGaraze(m.depo[i] - 1); return true; }
    return false;
  };

  // --- klávesy -----------------------------------------------------------------------------------------
  U.klavesa = ev => {
    const k = ev.key.toLowerCase();
    const mapa = { r: 'silnice', b: 'bus', t: 'nakl', d: 'garaz', x: 'zbor', k: 'kolej', s: 'nadrazi', j: 'depo', q: 'navest', w: 'navestJ' };
    if (mapa[k]) { vyberNastroj(mapa[k]); return true; }
    if (k === 'f') { oknoFinance(); return true; }
    if (k === 'v') { oknoSeznamVozidel(); return true; }
    if (ev.key === 'Escape' && cekaRozkaz !== null) { cekaRozkaz = null; U.zrusNastroj(); return true; }
    return false;
  };

  // --- běh: lišta, zprávy, okna, automatické ukládání ----------------------------------------------------
  let mesicUlozeni = -1;
  U.poKroku = (h, novyDen) => {
    for (const z of h.zpravy) {
      if (z.penize) plovouci.push({ x: z.x + 0.5, y: z.y + 0.5, text: '+' + penize(z.penize), barva: '#9dffb0', t: performance.now() });
      if (!z.tiche) zprava(z.text, z.vozidlo !== undefined ? { vozidlo: z.vozidlo } : z.x !== undefined ? { x: z.x, y: z.y } : null);
    }
    h.zpravy.length = 0;
    if (sledovane !== null) {
      const v = h.vozidla[sledovane];
      const p = v && H.aktivni(v) && v.stav !== 'depo' && v.druh !== 'vlak' && H.polohaVozidla(h, v);
      const q = v && v.druh === 'vlak' && v.stav !== 'depo' ? Z.vozyVlaku(h, v)[0] : p;
      if (q) { const [wx, wy] = U.kreslic.svetNaObr(q.x, q.y); U.kamera.x = wx; U.kamera.y = wy; } else sledovane = null;
    }
    if (novyDen) {
      aktualizujListu(); obnovOkna();
      const d = H.datum(h);
      if (d.den === 1 && d.mesic !== mesicUlozeni) { mesicUlozeni = d.mesic; ulozAuto(); }
    }
  };
  U.poNacteni = h => {
    U.zrusNastroj(); vybranaStanice = null; sledovane = null; vybraneVozidlo = null;
    mesicUlozeni = H.datum(h).mesic;
    aktualizujListu();
  };

  // živá okna se obnovují každý herní den (ne pod myší – nerušit klikání)
  const ziva = new Map();   // id okna → funkce, která ho znovu vykreslí
  function obnovOkna() {
    for (const [id, fn] of ziva) {
      const o = U.okna.get(id);
      if (!o) { ziva.delete(id); continue; }
      if (o.matches(':hover') || o.contains(document.activeElement)) continue;
      const tel = o.querySelector('.ok-telo'), sc = tel.scrollTop;
      fn(); tel.scrollTop = sc;
    }
  }
  function zive(id, fn) { ziva.set(id, fn); fn(); }
  function el(html) { const d = document.createElement('div'); d.innerHTML = html; return d; }
  const tl = (text, fn, tit) => { const b = U.tlacitko(text, fn); if (tit) b.title = tit; return b; };

  // --- finance --------------------------------------------------------------------------------------------
  const KATEGORIE = [['prijemVlak', 'Tržby – vlaky'], ['prijemBus', 'Tržby – autobusy'], ['prijemNakl', 'Tržby – nákladní a pošta'], ['provoz', 'Provoz vozidel'],
    ['vozidla', 'Nákup a prodej vozidel'], ['stavba', 'Stavby'], ['uroky', 'Úroky z úvěru']];
  function oknoFinance() {
    zive('finance', () => {
      const h = U.hra, f = h.firma, r = H.rok(h);
      const radky = KATEGORIE.map(([k, n]) => `<tr><td>${n}</td><td class="cis">${penize(h.fin.letos[k] || 0)}</td><td class="cis">${penize(h.fin.loni[k] || 0)}</td></tr>`).join('');
      const soucet = o => Object.values(o).reduce((a, b) => a + b, 0);
      const tel = el(`<table class="fin">
        <tr><th></th><th class="cis">${r}</th><th class="cis">${r - 1}</th></tr>${radky}
        <tr class="soucet"><td>Celkem</td><td class="cis">${penize(soucet(h.fin.letos))}</td><td class="cis">${penize(soucet(h.fin.loni))}</td></tr>
      </table>
      <table style="margin-top:8px">
        <tr><td>Peníze</td><td><b>${penize(f.penize)}</b></td></tr>
        <tr><td>Úvěr</td><td>${penize(f.uver)} z ${penize(f.maxUver)} (úrok ${Math.round(f.urok * 100)} % ročně)</td></tr>
        <tr><td>Hodnota firmy</td><td>${penize(H.hodnotaFirmy(h))}</td></tr>
      </table>`);
      const r2 = document.createElement('div'); r2.className = 'radek-tl';
      r2.append(tl('➕ Půjčit $10 000', () => { const x = H.uver(h, 10000); if (!x.ok) zprava(x.chyba, null, true); aktualizujListu(); oknoFinance(); }),
        tl('➖ Splatit $10 000', () => { const x = H.uver(h, -10000); if (!x.ok) zprava(x.chyba, null, true); aktualizujListu(); oknoFinance(); }));
      tel.append(r2);
      // graf peněz za posledních 24 měsíců
      const mes = h.fin.mesice.slice(-24);
      if (mes.length > 1) {
        const c = document.createElement('canvas'); c.width = 300; c.height = 70; c.className = 'graf';
        const g = c.getContext('2d'), mn = Math.min(0, ...mes.map(x => x.penize)), mx = Math.max(1, ...mes.map(x => x.penize));
        const yy = v => 64 - (v - mn) / (mx - mn || 1) * 58;
        g.strokeStyle = 'rgba(128,128,128,.5)'; g.beginPath(); g.moveTo(0, yy(0)); g.lineTo(300, yy(0)); g.stroke();
        g.strokeStyle = '#4fb06a'; g.lineWidth = 2; g.beginPath();
        mes.forEach((x, k) => g[k ? 'lineTo' : 'moveTo'](k / (mes.length - 1) * 296 + 2, yy(x.penize))); g.stroke();
        const pop = document.createElement('small');
        pop.textContent = `Peníze: ${NAZVY_MES[mes[0].mesic - 1]} ${mes[0].rok} – ${NAZVY_MES[mes[mes.length - 1].mesic - 1]} ${mes[mes.length - 1].rok}`;
        tel.append(c, pop);
      }
      U.okno('finance', '💰 Finance', tel, [10, 10]);
    });
  }

  // --- vozidla --------------------------------------------------------------------------------------------------
  function stavVozidla(h, v) {
    if (v.stav === 'depo') return '🅿️ V garáži';
    if (v.hlasenoZtraceni) return '⚠️ Nemůže najít cestu';
    if (!v.bezi) return '⏸ Stojí';
    if (v.stav === 'naklada') { const st = h.stanice[v.cil && v.cil.st]; return `⏳ Nakládá – ${st ? st.jmeno : ''}`; }
    if (v.doGaraze) return '➡️ Do garáže';
    const r = v.rozkazy[v.ri], st = r && h.stanice[r.st];
    return st ? `➡️ Jede do ${st.jmeno}` : '➡️ Jede';
  }
  function oknoVozidla(id) {
    vybraneVozidlo = id;
    const kresli = () => {
      const h = U.hra, v = h.vozidla[id];
      if (!H.aktivni(v)) { U.zavriOkno('voz' + id); return; }
      const t = D.VOZIDLA_PODLE_ID[v.typ];
      // náklad sečtený podle druhu (vlak má víc vagonů)
      const souhrn = {};
      for (const o of v.oddily) { const x = souhrn[o.typ] || (souhrn[o.typ] = [0, 0]); x[0] += o.n; x[1] += o.kap; }
      const nakladHtml = Object.entries(souhrn).map(([k, [n, kap]]) => `${ikN(k)} ${n} / ${kap} · ${esc(D.NAKLADY_PODLE_ID[k].nazev)}`).join('<br>') || '<small>žádné vagony</small>';
      const tel = el(`<div class="stavvoz">${esc(stavVozidla(h, v))}</div>
        <table>
          <tr><td>Typ</td><td>${t.ikona} ${esc(t.nazev)} · ${v.druh === 'vlak' ? `${Z.maxRychlost(v)} km/h · ${Math.round(Z.hmotnost(v))} t${v.stav === 'jede' ? ` · jede ${Math.round(v.rych)} km/h` : ''}` : `${t.rychlost} km/h`}</td></tr>
          <tr><td>Náklad</td><td>${nakladHtml}</td></tr>
          <tr><td>Zisk letos</td><td class="${v.zisk.letos < 0 ? 'minus' : ''}">${penize(v.zisk.letos)}</td></tr>
          <tr><td>Zisk loni</td><td class="${v.zisk.loni < 0 ? 'minus' : ''}">${penize(v.zisk.loni)}</td></tr>
          <tr><td>Stáří · hodnota</td><td>${(v.stari / 365).toFixed(1)} roku · ${penize(H.hodnotaVozidla(h, v))}</td></tr>
        </table>
        <div class="nadpis-roz">Rozkazy</div>`);
      if (v.druh === 'vlak') {
        tel.querySelector('.nadpis-roz').before(vagonyVlaku(h, v, kresli));
      }
      const roz = document.createElement('ol'); roz.className = 'rozkazy';
      v.rozkazy.forEach((r, k) => {
        const st = h.stanice[r.st], li = document.createElement('li');
        if (k === v.ri && v.stav !== 'depo') li.className = 'aktualni';
        const n = document.createElement('button'); n.className = 'jm'; n.textContent = st ? st.jmeno : '?';
        n.addEventListener('click', () => st && U.naPole(st.x, st.y));
        const p = tl(r.plne ? '☑ plně' : '☐ plně', () => { H.prepniPlne(h, id, k); kresli(); }, 'Čekat na plné naložení');
        const x = tl('✕', () => { H.odeberRozkaz(h, id, k); kresli(); }, 'Odebrat');
        li.append(n, p, x); roz.append(li);
      });
      if (!v.rozkazy.length) { const li = document.createElement('li'); li.className = 'prazdne'; li.textContent = 'Žádné – přidej aspoň dvě zastávky'; roz.append(li); }
      tel.append(roz);
      const r1 = document.createElement('div'); r1.className = 'radek-tl';
      r1.append(tl('➕ Přidat zastávku', () => {
        U.zrusNastroj(); cekaRozkaz = id;
        $('stNastroj').textContent = `➕ ${v.jmeno}: klikni na zastávku, kterou má obsluhovat (Esc konec)`; $('stNastroj').hidden = false;
      }));
      const r2 = document.createElement('div'); r2.className = 'radek-tl';
      r2.append(
        tl(v.bezi ? '⏸ Zastavit' : '▶ Spustit', () => { const x = H.spust(h, id); if (!x.ok && x.chyba) zprava(x.chyba, null, true); kresli(); }),
        tl('🎯 Ukázat', () => { const p = H.polohaVozidla(h, v); if (p) U.naPole(Math.floor(p.x), Math.floor(p.y)); else { const g = h.depa[v.depo]; if (g) U.naPole(g.x, g.y); } }),
        tl(sledovane === id ? '👁 Nesledovat' : '👁 Sledovat', () => { sledovane = sledovane === id ? null : id; kresli(); }),
      );
      const r3 = document.createElement('div'); r3.className = 'radek-tl';
      if (v.stav !== 'depo') r3.append(tl(v.druh === 'vlak' ? '🏭 Do depa' : '🅿️ Do garáže', () => { H.doGaraze(h, id); kresli(); }));
      else r3.append(tl(`💲 Prodat za ${penize(H.hodnotaVozidla(h, v))}`, async () => {
        if (!(await Dialog.potvrd(`Prodat ${v.jmeno}?`))) return;
        H.prodej(h, id); aktualizujListu(); U.zavriOkno('voz' + id); obnovOkna();
      }));
      r3.append(tl('✏️ Přejmenovat', async () => { const j = await Dialog.zeptej('Nové jméno vozidla', v.jmeno); if (j && j.trim()) { v.jmeno = j.trim().slice(0, 40); kresli(); } }));
      tel.append(r1, r2, r3);
      U.okno('voz' + id, `${t.ikona} ${v.jmeno}`, tel);
    };
    zive('voz' + id, kresli);
  }
  // vagony: seznam, přidání a odebrání (jen v depu)
  function vagonyVlaku(h, v, kresli) {
    const box = document.createElement('div');
    box.append(el(`<div class="nadpis-roz">Vagony (${v.oddily.length}) · délka ${Z.delkaVlaku(v).toFixed(1)} pole</div>`));
    const sez = document.createElement('div'); sez.className = 'vagony';
    v.oddily.forEach((o, k) => {
      const w = D.VAGONY_PODLE_ID[o.vagon], n = D.NAKLADY_PODLE_ID[o.typ];
      const radek = document.createElement('span'); radek.className = 'vagon'; radek.style.setProperty('--b', w.barva);
      radek.title = `${w.nazev}: ${n.nazev} ${o.n}/${o.kap}`;
      radek.innerHTML = ikN(o.typ, 18);
      if (v.stav === 'depo') radek.append(tl('✕', () => { const x = Z.odeberVagon(h, v.id, k); if (!x.ok) zprava(x.chyba, null, true); aktualizujListu(); kresli(); }, 'Odebrat (vrátí 60 % ceny)'));
      sez.append(radek);
    });
    box.append(sez);
    if (v.stav === 'depo') {
      const r = document.createElement('div'); r.className = 'radek-tl';
      const vyber = document.createElement('select'); vyber.setAttribute('aria-label', 'Vagon');
      for (const w of D.VAGONY.filter(w => H.rok(h) >= w.od)) for (const k of w.naklady) {
        const o = document.createElement('option'); o.value = w.id + ':' + k;
        o.textContent = `${D.NAKLADY_PODLE_ID[k].ikona} ${w.nazev} – ${D.NAKLADY_PODLE_ID[k].nazev} (${penize(w.cena)})`; vyber.append(o);
      }
      if (box.dataset.posledni) vyber.value = box.dataset.posledni;
      r.append(vyber, tl('➕ Přidat vagon', () => {
        const [w, k] = vyber.value.split(':');
        const x = Z.pridejVagon(h, v.id, w, k);
        if (!x.ok) zprava(x.chyba, null, true);
        posledniVagon = vyber.value; aktualizujListu(); kresli();
      }));
      if (posledniVagon) vyber.value = posledniVagon;
      box.append(r);
    } else box.append(el('<small>Vagony jde měnit jen v depu.</small>'));
    return box;
  }
  let posledniVagon = null;

  function oknoSeznamVozidel() {
    zive('seznamVoz', () => {
      const h = U.hra, tel = document.createElement('div'); tel.className = 'seznam';
      const vs = h.vozidla.filter(H.aktivni);
      if (!vs.length) tel.append(el('<p>Zatím žádná vozidla. Postav garáž (D) a kup v ní vozidlo.</p>'));
      for (const v of vs) {
        const b = tl('', () => oknoVozidla(v.id));
        b.innerHTML = `<span>${D.VOZIDLA_PODLE_ID[v.typ].ikona} ${esc(v.jmeno)}<br><small>${esc(stavVozidla(h, v))}</small></span><small class="${v.zisk.loni < 0 ? 'minus' : ''}">${penize(v.zisk.letos)}<br>${penize(v.zisk.loni)}</small>`;
        tel.append(b);
      }
      U.okno('seznamVoz', `🚌 Vozidla (${vs.length}) – zisk letos / loni`, tel, [10, 10]);
    });
  }

  // --- stanice ------------------------------------------------------------------------------------------------
  function oknoStanice(id) {
    vybranaStanice = id; U.prekresli();
    zive('st' + id, () => {
      const h = U.hra, st = h.stanice[id];
      if (!st) { U.zavriOkno('st' + id); return; }
      const nak = Object.entries(st.naklady).filter(([, z]) => z.navst);
      const bus = st.casti.filter(c => c.druh === 'bus').length, vlak = st.casti.filter(c => c.druh === 'vlak').length, nakl = st.casti.length - bus - vlak;
      const prijima = Object.keys(st.prijima).map(k => `<span class="stitek">${ikN(k, 16)} ${esc(D.NAKLADY_PODLE_ID[k].nazev)}</span>`).join(' ') || '<small>nic</small>';
      const tel = el(`<table>
        <tr><td>Části</td><td>${vlak ? `🚉 ${vlak}× nástupiště` : ''} ${bus ? `🚏 ${bus}× zastávka` : ''} ${nakl ? `🚚 ${nakl}× stanoviště` : ''}</td></tr>
        <tr><td>Přijímá</td><td>${prijima}</td></tr>
      </table>
      <table class="fin" style="margin-top:6px"><tr><th>Čeká</th><th class="cis">množství</th><th class="cis">hodnocení</th></tr>
        ${nak.map(([k, z]) => `<tr><td>${ikN(k)} ${esc(D.NAKLADY_PODLE_ID[k].nazev)}</td><td class="cis">${z.ceka}</td><td class="cis"><span class="hodn" style="--h:${Math.round(z.hodn / 2.55)}%">${Math.round(z.hodn / 2.55)} %</span></td></tr>`).join('') || '<tr><td colspan="3"><small>Zatím sem nepřijelo žádné vozidlo – náklad se začne hromadit po první návštěvě.</small></td></tr>'}
      </table>`);
      const r = document.createElement('div'); r.className = 'radek-tl';
      r.append(tl('🎯 Ukázat', () => U.naPole(st.x, st.y)),
        tl('✏️ Přejmenovat', async () => { const j = await Dialog.zeptej('Nové jméno stanice', st.jmeno); if (j && j.trim()) { st.jmeno = j.trim().slice(0, 40); obnovOkna(); } }));
      tel.append(r);
      const o = U.okno('st' + id, `🚏 ${st.jmeno}`, tel);
      if (!o.dataset.hlidam) { o.dataset.hlidam = 1; o.querySelector('.ok-hlava button').addEventListener('click', () => { if (vybranaStanice === id) { vybranaStanice = null; U.prekresli(); } }); }
    });
  }
  function oknoSeznamStanic() {
    zive('seznamSt', () => {
      const h = U.hra, tel = document.createElement('div'); tel.className = 'seznam';
      const sts = h.stanice.filter(Boolean);
      if (!sts.length) tel.append(el('<p>Zatím žádné stanice. Zastávka autobusu (B) se staví na silnici ve městě.</p>'));
      for (const st of sts) {
        const b = tl('', () => { U.naPole(st.x, st.y); oknoStanice(st.id); });
        const cek = Object.entries(st.naklady).filter(([, z]) => z.ceka).map(([k, z]) => `${ikN(k, 16)}${z.ceka}`).join(' ');
        b.innerHTML = `<span>${esc(st.jmeno)}</span><small>${cek}</small>`;
        tel.append(b);
      }
      U.okno('seznamSt', `🚏 Stanice (${sts.length})`, tel, [10, 10]);
    });
  }

  // --- garáž a nákup ------------------------------------------------------------------------------------------
  function oknoGaraze(id) {
    zive('gar' + id, () => {
      const h = U.hra, g = h.depa[id];
      if (!g) { U.zavriOkno('gar' + id); return; }
      const tel = document.createElement('div');
      const vs = h.vozidla.filter(v => H.aktivni(v) && v.stav === 'depo' && v.depo === id);
      const sez = document.createElement('div'); sez.className = 'seznam';
      for (const v of vs) { const b = tl('', () => oknoVozidla(v.id)); b.innerHTML = `<span>${D.VOZIDLA_PODLE_ID[v.typ].ikona} ${esc(v.jmeno)}</span><small>${v.rozkazy.length} rozkazů</small>`; sez.append(b); }
      if (!vs.length) sez.append(el('<small>Garáž je prázdná.</small>'));
      tel.append(sez);
      const r = document.createElement('div'); r.className = 'radek-tl';
      r.append(tl(g.druh === 'kolej' ? '🛒 Koupit lokomotivu' : '🛒 Koupit vozidlo', () => oknoKatalogu(id)), tl('🎯 Ukázat', () => U.naPole(g.x, g.y)));
      tel.append(r);
      U.okno('gar' + id, g.druh === 'kolej' ? `🏭 Depo ${id + 1}` : `🅿️ Garáž ${id + 1}`, tel);
    });
  }
  function oknoKatalogu(gId) {
    const h = U.hra, r = H.rok(h), zelezn = h.depa[gId] && h.depa[gId].druh === 'kolej';
    const tel = document.createElement('div'); tel.className = 'katalog';
    const skupiny = zelezn ? [['vlak', '🚂 Lokomotivy']] : [['bus', '🚌 Autobusy'], ['posta', '📮 Pošta'], ['nakl', '🚚 Nákladní auta']];
    if (zelezn) tel.append(el('<small>Vagony se přidávají v okně vlaku, dokud stojí v depu.</small>'));
    for (const [sk, nazev] of skupiny) {
      const typy = D.VOZIDLA.filter(t => r >= t.od && r <= t.do && (sk === 'vlak' ? t.druh === 'vlak' : sk === 'bus' ? t.druh === 'bus' : sk === 'posta' ? t.naklady[0] === 'posta' : t.druh === 'nakl' && t.naklady[0] !== 'posta'));
      if (!typy.length) continue;
      tel.append(el(`<div class="nadpis-roz">${nazev}</div>`));
      for (const t of typy) {
        const box = document.createElement('div'); box.className = 'model';
        const nk = t.naklady.map(k => D.NAKLADY_PODLE_ID[k]);
        box.innerHTML = `<div><b>${t.ikona} ${esc(t.nazev)}</b> <small>od ${t.od}</small><br>
          <small>${t.rychlost} km/h · ${t.druh === 'vlak' ? `${t.vykon} kW · ${t.hmotnost} t · ${t.trakce === 'para' ? 'pára' : 'diesel'}` : `${t.kapacita} ${t.druh === 'bus' ? 'míst' : t.naklady[0] === 'posta' ? 'pytlů' : 't'}`} · provoz ${penize(t.provoz)}/rok · životnost ${t.zivot} let</small></div>`;
        const radek = document.createElement('div'); radek.className = 'radek-tl';
        let vyber = null;
        if (nk.length > 1) {
          vyber = document.createElement('select');
          vyber.setAttribute('aria-label', 'Náklad');
          for (const n of nk) { const o = document.createElement('option'); o.value = n.id; o.textContent = `${n.ikona} ${n.nazev}`; vyber.append(o); }
          radek.append(vyber);
        }
        radek.append(tl(`Koupit za ${penize(t.cena)}`, () => {
          const x = H.kup(h, gId, t.id, vyber ? vyber.value : t.naklady[0]);
          if (!x.ok) { zprava(x.chyba, null, true); return; }
          aktualizujListu(); obnovOkna();
          const v = h.vozidla[h.vozidla.length - 1];
          U.zavriOkno('katalog');
          oknoVozidla(v.id);
          zprava(v.druh === 'vlak' ? `Koupeno: ${v.jmeno}. Přidej vagony a rozkazy, pak ho spusť.` : `Koupeno: ${v.jmeno}. Přidej mu rozkazy a spusť ho.`);
        }));
        box.append(radek); tel.append(box);
      }
    }
    U.okno('katalog', `🛒 Koupit vozidlo (${r})`, tel);
  }

  // --- ukládání --------------------------------------------------------------------------------------------------------
  const DB = 'webapp_hra_magnat', STORE = 'hry';
  function otevriDb() {
    return new Promise((ok, chyba) => {
      if (!window.indexedDB) return chyba(new Error('Prohlížeč neumí IndexedDB'));
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => ok(r.result); r.onerror = () => chyba(r.error);
    });
  }
  async function dbOp(mod, fn) {
    const db = await otevriDb();
    return new Promise((ok, chyba) => {
      const tx = db.transaction(STORE, mod), st = tx.objectStore(STORE), r = fn(st);
      tx.oncomplete = () => { db.close(); ok(r && r.result); }; tx.onerror = () => { db.close(); chyba(tx.error); };
    });
  }
  async function zabal(obj) {
    const json = JSON.stringify(obj);
    if (typeof CompressionStream === 'undefined') return new Blob([json], { type: 'application/json' });
    return new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
  }
  async function rozbal(blob) {
    const zac = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
    if (zac[0] === 0x1f && zac[1] === 0x8b) return JSON.parse(await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text());
    return JSON.parse(await blob.text());
  }
  async function uloz(slot, nazev) {
    const h = U.hra;
    const data = await zabal({ ...H.serializuj(h), kamera: { x: U.kamera.x, y: U.kamera.y } });
    await dbOp('readwrite', st => st.put({ nazev: nazev || h.firma.jmeno, datum: datumText(h), penize: Math.round(h.firma.penize), ulozeno: Date.now(), data }, slot));
  }
  let ukladam = false;
  async function ulozAuto() {
    if (ukladam || !U.hra) return;
    ukladam = true;
    try { await uloz('auto', 'Automaticky'); } catch (e) { /* bez úložiště hra běží dál */ }
    ukladam = false;
  }
  U.nactiAuto = async () => {
    try {
      const z = await dbOp('readonly', st => st.get('auto'));
      if (!z) return null;
      const o = await rozbal(z.data);
      return { hra: H.deserializuj(o), kamera: o.kamera };
    } catch (e) { return null; }
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) ulozAuto(); });
  window.addEventListener('pagehide', ulozAuto);

  async function oknoUlozeni() {
    let sloty = {};
    try { const klice = await dbOp('readonly', st => st.getAllKeys()); for (const k of klice) sloty[k] = await dbOp('readonly', st => st.get(k)); }
    catch (e) { zprava('Úložiště prohlížeče není dostupné – použij export do souboru', null, true); }
    const tel = document.createElement('div');
    const sez = document.createElement('div'); sez.className = 'sloty';
    for (const k of ['auto', 'slot1', 'slot2', 'slot3', 'slot4', 'slot5']) {
      const z = sloty[k], radek = document.createElement('div'); radek.className = 'slot';
      radek.innerHTML = `<div><b>${k === 'auto' ? '⏱ Automaticky' : `Pozice ${k.slice(4)}`}</b><br><small>${z ? `${esc(z.datum)} · ${penize(z.penize)} · ${new Date(z.ulozeno).toLocaleString('cs-CZ')}` : 'prázdná'}</small></div>`;
      const b = document.createElement('div'); b.className = 'radek-tl';
      if (k !== 'auto') b.append(tl('💾 Uložit', async () => {
        if (z && !(await Dialog.potvrd('Přepsat uloženou hru?'))) return;
        try { await uloz(k); zprava('Hra uložena'); oknoUlozeni(); } catch (e) { zprava('Uložení se nepovedlo: ' + e.message, null, true); }
      }));
      if (z) b.append(tl('📂 Načíst', async () => {
        if (!(await Dialog.potvrd('Načíst uloženou hru? Neuložený postup se ztratí.'))) return;
        try { const o = await rozbal(z.data); U.zacniHru(H.deserializuj(o), o.kamera); zprava(`Načteno: ${z.datum}`); } catch (e) { zprava('Načtení se nepovedlo: ' + e.message, null, true); }
      }));
      if (z && k !== 'auto') b.append(tl('🗑', async () => { if (await Dialog.potvrd('Smazat uloženou hru?')) { await dbOp('readwrite', st => st.delete(k)); oknoUlozeni(); } }, 'Smazat'));
      radek.append(b); sez.append(radek);
    }
    tel.append(sez);
    const r = document.createElement('div'); r.className = 'radek-tl';
    r.append(tl('⬇️ Export do souboru', async () => {
      const blob = await zabal({ ...H.serializuj(U.hra), kamera: { x: U.kamera.x, y: U.kamera.y } });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const d = H.datum(U.hra);
      a.download = `magnat_${d.rok}-${String(d.mesic).padStart(2, '0')}.magnat`;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }), tl('⬆️ Import ze souboru', () => $('souborHry').click()));
    tel.append(r);
    U.okno('ulozeni', '💾 Uložit a načíst', tel, [10, 10]);
  }
  $('souborHry').addEventListener('change', async ev => {
    const f = ev.target.files[0]; ev.target.value = '';
    if (!f) return;
    try { const o = await rozbal(f); U.zacniHru(H.deserializuj(o), o.kamera); zprava('Hra načtena ze souboru'); }
    catch (e) { zprava('Soubor se nepodařilo načíst: ' + e.message, null, true); }
  });

  // --- nabídky ------------------------------------------------------------------------------------------------------------
  document.querySelectorAll('[data-nastroj]').forEach(b => b.addEventListener('click', () => vyberNastroj(b.dataset.nastroj)));
  $('miFinance').addEventListener('click', oknoFinance);
  $('miVozidla').addEventListener('click', oknoSeznamVozidel);
  $('miStanice').addEventListener('click', oknoSeznamStanic);
  $('miUlozit').addEventListener('click', oknoUlozeni);
  $('stPenize').addEventListener('click', oknoFinance);

  // po načtení atlasů: ikony nástrojů do nabídek, úvodní obraz do dialogu a nápovědy
  U.poAtlasech = () => {
    const IK = { silnice: 0, bus: 1, nakl: 2, garaz: 3, kolej: 4, nadrazi: 5, depo: 6, navest: 7, navestJ: 8, zbor: 9,
      miFinance: 10, miVozidla: 11, miStanice: 12, miUlozit: 13, miNapoveda: 14, miNova: 15 };
    for (const [k, idx] of Object.entries(IK)) {
      const b = document.querySelector(`[data-nastroj="${k}"]`) || document.getElementById(k);
      const html = b && ikona('ikony2', idx, 18);
      if (!html || b.dataset.ikona) continue;
      b.dataset.ikona = 1;
      const t = b.firstChild;
      if (t && t.nodeType === 3) t.textContent = t.textContent.replace(/^\S+\s/, ' ');
      b.insertAdjacentHTML('afterbegin', html);
    }
    if (MAG.ATLAS && MAG.ATLAS.uvod) for (const [cil, trida] of [[document.querySelector('#dlgNova .dlg'), 'uvod'], [document.querySelector('#napoveda .ok-telo'), 'napoveda-uvod']]) {
      if (!cil || cil.querySelector('img.' + trida)) continue;
      const im = document.createElement('img'); im.className = trida; im.alt = ''; im.src = MAG.ATLAS.uvod.obr;
      cil.prepend(im);
    }
  };

  Object.assign(U, { oknoVozidla, oknoStanice, oknoGaraze, oknoFinance, oknoUlozeni, vyberNastroj, ulozAuto, nactiAutoTest: U.nactiAuto });
})();
