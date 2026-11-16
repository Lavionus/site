/* Atlas Měsíce – uživatelské rozhraní (výpočty v jadro.js, data v utvary.js) */
(function () {
  'use strict';
  const J = window.ATLASM;
  const $ = id => document.getElementById(id);
  const PREFIX = 'webapp_atlas_mesice_';
  const UTVARY = window.ATLAS_UTVARY.map(J.prevod);
  const PODLE_JMENA = new Map(UTVARY.map(u => [u.jmeno, u]));
  const RAD = Math.PI / 180;
  // výřez mapy: z globální mozaiky 8192 × 4096 px (−180° až 180°) sloupce 1820–6372
  const TEX_LON0 = -180 + 1820 * 360 / 8192, TEX_DLON = 4552 * 360 / 8192;

  /* ---------- uložená data ---------- */
  function nacti(klic, vychozi) {
    try { const v = JSON.parse(localStorage.getItem(PREFIX + klic)); return v == null ? vychozi : v; } catch (e) { return vychozi; }
  }
  function uloz(klic, v) { try { localStorage.setItem(PREFIX + klic, JSON.stringify(v)); } catch (e) { /* plné úložiště */ } }
  const nast = Object.assign({
    natoceni: 'atlas', optika: 'primo', osvetleni: true, terminator: true, popisky: true, zvyraznit: true, mrizka: false, pristani: true,
    misto: { lat: 50.08, lon: 14.42, nazev: 'Praha' }, zalozka: 'dnes', typ: '', obt: 0, jenCile: false, jenNepozorovane: false,
  }, nacti('nastaveni', {}));
  const vychoziSeznam = () => UTVARY.filter(u => u.cil).map(u => u.jmeno);
  let seznam = nacti('seznam', null);
  if (!Array.isArray(seznam)) seznam = vychoziSeznam();
  seznam = seznam.filter(j => PODLE_JMENA.has(j));
  let pozorovano = J.normPozorovani(nacti('pozorovano', {}));
  const ulozNast = () => uloz('nastaveni', nast);
  const ulozSeznam = () => { uloz('seznam', seznam); uloz('pozorovano', pozorovano); };

  /* ---------- stav ---------- */
  let datum = new Date();
  let ef = null, par = null, T = null, hledat = '';
  let vybrany = null;
  const pohled = { zoom: 1, x: 0, y: 0 };        // střed pohledu v jednotkách disku (po natočení)
  let tex = null;                                  // {sirka, vyska, data: Uint8Array}

  /* ---------- formátování ---------- */
  const f1 = (x, d = 1) => x.toLocaleString('cs-CZ', { minimumFractionDigits: d, maximumFractionDigits: d });
  const stupne = (x, d = 1) => f1(x, d) + '°';
  const sirka = x => f1(Math.abs(x), 1) + '° ' + (x >= 0 ? 'S' : 'J');
  const delka = x => f1(Math.abs(x), 1) + '° ' + (x >= 0 ? 'V' : 'Z');
  const casTxt = d => d.toLocaleString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
  const datumTxt = d => d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const dnesIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  function doInputu(d) {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  const nazevU = u => u.cesky ? `${u.cesky} <small>(${esc(u.jmeno)})</small>` : esc(u.jmeno);
  function cipStavu(s) {
    if (s.stav === 'neviditelny') return '<span class="cip noc">za okrajem</span>';
    if (s.stav === 'noc') return '<span class="cip noc">noc</span>';
    if (s.stav === 'terminator') return `<span class="cip term"><span>${s.rano ? '🌅 východ' : '🌇 západ'}</span> ${stupne(Math.max(0, s.h), 0)}</span>`;
    return `<span class="cip">☀ ${stupne(s.h, 0)}</span>`;
  }

  /* ---------- výpočet okamžiku ---------- */
  function prepocti() {
    ef = J.efemerida(datum);
    par = J.paralakticky(datum, nast.misto);
    T = J.transformace(J.uhelNatoceni(nast.natoceni, ef, par.q), nast.optika);
    $('cas').value = doInputu(datum);
    kresli(true);
    vykresliPanel();
  }

  /* ---------- mapa ---------- */
  const platno = $('mapa'), ctx = platno.getContext('2d');
  const pomocne = document.createElement('canvas'), pctx = pomocne.getContext('2d');
  let sirkaPx = 0, vyskaPx = 0, dpr = 1, casovac = 0;
  function velikost() {
    const r = platno.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    sirkaPx = Math.max(1, Math.round(r.width * dpr)); vyskaPx = Math.max(1, Math.round(r.height * dpr));
    platno.width = sirkaPx; platno.height = vyskaPx;
  }
  const polomer = () => Math.min(sirkaPx, vyskaPx) / 2 * 0.92 * pohled.zoom;
  // obrazovka (px) ↔ souřadnice disku
  function zObrazovky(px, py) {
    const R = polomer();
    return T.zpet((px - sirkaPx / 2) / R + pohled.x, -(py - vyskaPx / 2) / R + pohled.y);
  }
  function naObrazovku(x, y) {
    const R = polomer(), p = T.tam(x, y);
    return { x: sirkaPx / 2 + (p.x - pohled.x) * R, y: vyskaPx / 2 - (p.y - pohled.y) * R };
  }

  function kresliPodklad(meritko) {
    const w = Math.max(1, Math.round(sirkaPx * meritko)), h = Math.max(1, Math.round(vyskaPx * meritko));
    const img = pctx.createImageData(w, h), d = img.data;
    const R = polomer() * meritko, cx = w / 2, cy = h / 2;
    const sb = Math.sin(ef.b * RAD), cb = Math.cos(ef.b * RAD);
    const S = J.naDisku(ef.b0, ef.l0, ef);                    // směr ke Slunci v soustavě disku
    const tw = tex.sirka, th = tex.vyska, td = tex.data;
    const osv = nast.osvetleni;
    for (let j = 0; j < h; j++) {
      const Y = -(j - cy) / R + pohled.y;
      for (let i = 0; i < w; i++) {
        const k = (j * w + i) * 4;
        const X = (i - cx) / R + pohled.x;
        const p = T.zpet(X, Y);
        const r2 = p.x * p.x + p.y * p.y;
        if (r2 > 1) { d[k] = 7; d[k + 1] = 9; d[k + 2] = 13; d[k + 3] = 255; continue; }
        const z = Math.sqrt(1 - r2);
        const lat = Math.asin(p.y * cb + z * sb);
        let lon = Math.atan2(p.x, z * cb - p.y * sb) / RAD + ef.l;
        if (lon > 180) lon -= 360; else if (lon < -180) lon += 360;
        // bilineární vzorek mozaiky
        let u = (lon - TEX_LON0) / TEX_DLON * tw - 0.5, v = (90 - lat / RAD) / 180 * th - 0.5;
        if (u < 0) u = 0; else if (u > tw - 1.001) u = tw - 1.001;
        if (v < 0) v = 0; else if (v > th - 1.001) v = th - 1.001;
        const u0 = u | 0, v0 = v | 0, fu = u - u0, fv = v - v0, o = v0 * tw + u0;
        let a = (td[o] * (1 - fu) + td[o + 1] * fu) * (1 - fv) + (td[o + tw] * (1 - fu) + td[o + tw + 1] * fu) * fv;
        if (osv) {
          const c = p.x * S.x + p.y * S.y + z * S.z;          // kosinus zenitové vzdálenosti Slunce
          let f;
          if (c <= -0.012) f = 0.045;                           // noc (slabé popelavé světlo)
          else if (c < 0.03) f = 0.045 + (c + 0.012) / 0.042 * 0.4;
          else f = 0.445 + 0.555 * Math.min(1, (c - 0.03) / 0.4);
          a *= f;
        }
        a = a * 1.08;
        d[k] = d[k + 1] = d[k + 2] = a > 255 ? 255 : a; d[k + 3] = 255;
      }
    }
    pomocne.width = w; pomocne.height = h;
    pctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(pomocne, 0, 0, sirkaPx, vyskaPx);
  }

  function cara(body) {
    ctx.beginPath();
    body.forEach((b, i) => { const p = naObrazovku(b.x, b.y); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
    ctx.stroke();
  }
  function kresliVrstvy() {
    const R = polomer();
    ctx.save();
    ctx.lineWidth = 1 * dpr;
    // okraj disku
    ctx.strokeStyle = 'rgba(160,180,210,.35)';
    const st = naObrazovku(0, 0);
    ctx.beginPath(); ctx.arc(st.x, st.y, R, 0, 2 * Math.PI); ctx.stroke();
    if (nast.mrizka) {
      ctx.strokeStyle = 'rgba(120,170,255,.35)';
      for (let lon = -90; lon <= 90; lon += 15) {
        const b = []; for (let lat = -90; lat <= 90; lat += 3) { const d = J.naDisku(lat, lon + 0, ef); if (d.z >= 0) b.push(d); else if (b.length) { cara(b); b.length = 0; } }
        if (b.length) cara(b);
      }
      for (let lat = -75; lat <= 75; lat += 15) {
        const b = []; for (let lon = -180; lon <= 180; lon += 3) { const d = J.naDisku(lat, lon, ef); if (d.z >= 0) b.push(d); else if (b.length) { cara(b); b.length = 0; } }
        if (b.length) cara(b);
      }
      ctx.strokeStyle = 'rgba(120,170,255,.6)';
      const r = []; for (let lat = -90; lat <= 90; lat += 3) { const d = J.naDisku(lat, 0, ef); if (d.z >= 0) r.push(d); } cara(r);
    }
    if (nast.terminator && ef.k > 0.002 && ef.k < 0.998) {
      ctx.strokeStyle = 'rgba(255,200,70,.85)'; ctx.lineWidth = 1.5 * dpr; ctx.setLineDash([6 * dpr, 4 * dpr]);
      J.terminator(ef).forEach(cara);
      ctx.setLineDash([]);
    }
    // světové strany Měsíce (IAU): sever a východ
    ctx.font = `${12 * dpr}px system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const kolo = [['S', 0, 1.06], ['J', 0, -1.06], ['V', 1.06, 0], ['Z', -1.06, 0]];
    ctx.fillStyle = 'rgba(200,215,235,.75)';
    for (const [t, x, y] of kolo) { const p = naObrazovku(x, y); ctx.fillText(t, p.x, p.y); }
    if (nast.popisky || vybrany) kresliPopisky(R);
    ctx.restore();
  }
  let viditelne = [];                                 // [{u, x, y, r}] pro klepnutí
  function kresliPopisky(R) {
    viditelne = [];
    const hranaX = sirkaPx + 40, hranaY = vyskaPx + 40;
    const obsazeno = [];
    const kandidati = [];
    for (const u of UTVARY) {
      if (u.typ === 'pristani' && !nast.pristani && u !== vybrany) continue;
      const s = J.stavUtvaru(u, ef);
      if (s.z < 0.02) continue;
      const p = naObrazovku(s.x, s.y);
      if (p.x < -40 || p.y < -40 || p.x > hranaX || p.y > hranaY) continue;
      const r = Math.max(2.5 * dpr, u.prumer / 2 / 1737.4 * R * Math.sqrt(s.z));
      viditelne.push({ u, x: p.x, y: p.y, r, s });
      const velky = u.prumer / 1737.4 * R;
      let priorita = velky + (u.cil ? 25 * dpr : 0) + (s.stav === 'terminator' && nast.zvyraznit ? 30 * dpr : 0);
      if (u.typ === 'more') priorita += 40 * dpr;
      if (u === vybrany) priorita = 1e9;
      if (!nast.popisky && u !== vybrany) continue;
      if (u.typ !== 'more' && u.typ !== 'pristani' && velky < 9 * dpr && !(u.cil && pohled.zoom >= 1.6) && u !== vybrany) continue;
      kandidati.push({ u, p, r, s, priorita });
    }
    kandidati.sort((a, b) => b.priorita - a.priorita);
    const font = (sirkaPx / dpr < 500 ? 10 : 11.5) * dpr;
    for (const k of kandidati) {
      const { u, p, r, s } = k;
      const text = u.cesky && u.typ === 'more' ? u.cesky : u.jmeno;
      const vel = u.typ === 'more' ? font * 1.1 : font;
      ctx.font = `${u.typ === 'more' ? 'italic ' : ''}${u === vybrany ? '600 ' : ''}${vel}px system-ui,sans-serif`;
      const sir = ctx.measureText(text).width;
      const kruh = u === vybrany || (s.stav === 'terminator' && nast.zvyraznit) || pohled.zoom >= 2.5;
      const tx = p.x, ty = u.typ === 'more' ? p.y : p.y - (kruh ? r : 2 * dpr) - vel * 0.7;
      const box = [tx - sir / 2 - 2, ty - vel / 2 - 1, tx + sir / 2 + 2, ty + vel / 2 + 1];
      if (u !== vybrany && obsazeno.some(o => box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1])) continue;
      obsazeno.push(box);
      const term = s.stav === 'terminator' && nast.zvyraznit;
      const barva = u === vybrany ? '#7fd0ff' : u.typ === 'pristani' ? '#ff9b7a' : term ? '#ffd24a' : u.typ === 'more' ? 'rgba(200,220,255,.8)' : 'rgba(240,244,250,.92)';
      if (u.typ === 'pristani') {
        ctx.strokeStyle = barva; ctx.lineWidth = dpr; ctx.beginPath();
        ctx.moveTo(p.x - 4 * dpr, p.y); ctx.lineTo(p.x + 4 * dpr, p.y); ctx.moveTo(p.x, p.y - 4 * dpr); ctx.lineTo(p.x, p.y + 4 * dpr);
        ctx.stroke();
      } else if (u.typ !== 'more') {
        // obrys jen u vybraného a zvýrazněného útvaru nebo při přiblížení, jinak tečka
        if (kruh) {
          ctx.strokeStyle = barva; ctx.lineWidth = (u === vybrany ? 2 : 1) * dpr;
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 2 * Math.PI); ctx.stroke();
        } else {
          ctx.fillStyle = barva; ctx.beginPath(); ctx.arc(p.x, p.y, 1.6 * dpr, 0, 2 * Math.PI); ctx.fill();
        }
      }
      ctx.lineWidth = 3 * dpr; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.lineJoin = 'round';
      ctx.strokeText(text, tx, ty);
      ctx.fillStyle = barva; ctx.fillText(text, tx, ty);
    }
  }

  function kresli(hned) {
    if (!tex || !ef) return;
    cancelAnimationFrame(casovac);
    clearTimeout(kresli.t);
    const proved = meritko => { kresliPodklad(meritko); kresliVrstvy(); popisStavu(); };
    if (hned) { proved(1); return; }
    // během tahu nejdřív hrubě, po zastavení ostře
    casovac = requestAnimationFrame(() => proved(0.5));
    kresli.t = setTimeout(() => proved(1), 160);
  }

  function popisStavu() {
    const nad = par.alt > 0 ? `Měsíc ${stupne(par.alt, 0)} nad obzorem` : 'Měsíc je pod obzorem';
    $('mapaStav').innerHTML = `<b>${esc(ef.faze)}</b> · osvětleno ${Math.round(ef.k * 100)} % · stáří ${f1(ef.stari)} d · colong. ${stupne(ef.c0)}<br>${nad} (${esc(nast.misto.nazev || 'místo')}) · librace ${stupne(ef.l)} / ${stupne(ef.b)}`;
  }

  /* ---------- ovládání mapy ---------- */
  const ukazatele = new Map();
  let tah = null, pohnuto = false;
  platno.addEventListener('pointerdown', e => {
    platno.setPointerCapture(e.pointerId);
    ukazatele.set(e.pointerId, { x: e.offsetX * dpr, y: e.offsetY * dpr });
    pohnuto = false;
    tah = { x: pohled.x, y: pohled.y, zoom: pohled.zoom, start: [...ukazatele.values()].map(p => ({ ...p })) };
    platno.classList.add('tahne');
  });
  platno.addEventListener('pointermove', e => {
    if (!ukazatele.has(e.pointerId) || !tah) return;
    ukazatele.set(e.pointerId, { x: e.offsetX * dpr, y: e.offsetY * dpr });
    const body = [...ukazatele.values()];
    if (body.length !== tah.start.length) { tah = { x: pohled.x, y: pohled.y, zoom: pohled.zoom, start: body.map(p => ({ ...p })) }; return; }
    const R0 = Math.min(sirkaPx, vyskaPx) / 2 * 0.92;
    if (body.length === 1) {
      const dx = body[0].x - tah.start[0].x, dy = body[0].y - tah.start[0].y;
      if (Math.hypot(dx, dy) > 4 * dpr) pohnuto = true;
      pohled.x = tah.x - dx / (R0 * pohled.zoom); pohled.y = tah.y + dy / (R0 * pohled.zoom);
    } else {
      pohnuto = true;
      const d0 = Math.hypot(tah.start[0].x - tah.start[1].x, tah.start[0].y - tah.start[1].y);
      const d1 = Math.hypot(body[0].x - body[1].x, body[0].y - body[1].y);
      priblizKolem((tah.start[0].x + tah.start[1].x) / 2, (tah.start[0].y + tah.start[1].y) / 2, tah.zoom * d1 / Math.max(1, d0), tah);
    }
    omez(); kresli();
  });
  const konecTahu = e => {
    ukazatele.delete(e.pointerId);
    if (!ukazatele.size) {
      platno.classList.remove('tahne');
      if (!pohnuto && e.type === 'pointerup') klepnuti(e.offsetX * dpr, e.offsetY * dpr);
      tah = null;
    } else tah = { x: pohled.x, y: pohled.y, zoom: pohled.zoom, start: [...ukazatele.values()].map(p => ({ ...p })) };
  };
  platno.addEventListener('pointerup', konecTahu);
  platno.addEventListener('pointercancel', konecTahu);
  platno.addEventListener('wheel', e => {
    e.preventDefault();
    priblizKolem(e.offsetX * dpr, e.offsetY * dpr, pohled.zoom * Math.exp(-e.deltaY * 0.0015));
    omez(); kresli();
  }, { passive: false });
  // přiblížení tak, aby bod pod (px, py) zůstal na místě
  function priblizKolem(px, py, zoom, zaklad) {
    const z0 = zaklad ? zaklad.zoom : pohled.zoom, x0 = zaklad ? zaklad.x : pohled.x, y0 = zaklad ? zaklad.y : pohled.y;
    zoom = Math.max(0.8, Math.min(14, zoom));
    const R0 = Math.min(sirkaPx, vyskaPx) / 2 * 0.92;
    const ux = (px - sirkaPx / 2) / R0, uy = -(py - vyskaPx / 2) / R0;
    pohled.x = x0 + ux / z0 - ux / zoom; pohled.y = y0 + uy / z0 - uy / zoom; pohled.zoom = zoom;
  }
  function omez() { pohled.x = Math.max(-1.1, Math.min(1.1, pohled.x)); pohled.y = Math.max(-1.1, Math.min(1.1, pohled.y)); }
  function klepnuti(px, py) {
    let nej = null, nd = Infinity;
    for (const v of viditelne) {
      const d = Math.hypot(v.x - px, v.y - py);
      const dosah = Math.max(v.r, 14 * dpr);
      if (d <= dosah && d / dosah < nd) { nd = d / dosah; nej = v.u; }
    }
    vyber(nej, false);
  }
  function vyber(u, vystredit) {
    vybrany = u;
    if (u && vystredit) {
      const s = J.naDisku(u.lat, u.lon, ef), p = T.tam(s.x, s.y);
      pohled.x = p.x; pohled.y = p.y;
      if (pohled.zoom < 2.5 && u.typ !== 'more') pohled.zoom = 2.5;
    }
    kresli(true); vykresliDetail(); oznacRadky();
    if (u && window.matchMedia('(max-width:860px)').matches && !vystredit) $('detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ---------- panel ---------- */
  function vykresliDetail() {
    const el = $('detail');
    if (!vybrany) { el.innerHTML = ''; return; }
    const u = vybrany, s = J.stavUtvaru(u, ef), vz = J.vychodZapad(u, datum);
    const vSeznamu = seznam.includes(u.jmeno), poz = pozorovano[u.jmeno];
    const kdy = [];
    if (vz.vychod) kdy.push(`🌅 východ Slunce ${casTxt(vz.vychod)}`);
    if (vz.zapad) kdy.push(`🌇 západ ${casTxt(vz.zapad)}`);
    el.innerHTML = `<div class="detail">
      <h2><span>${u.cesky ? esc(u.cesky) : esc(u.jmeno)}</span><button class="btn mini" data-akce="zavrit" aria-label="Zavřít detail">✕</button></h2>
      <div class="meta">${u.cesky ? esc(u.jmeno) + ' · ' : ''}${esc(J.TYPY[u.typ])} · ${sirka(u.lat)}, ${delka(u.lon)}${u.prumer ? ' · ' + u.prumer + ' km' : ''} · obtížnost ${'★'.repeat(u.obt)}</div>
      <p>${esc(u.popis)}</p>
      <div>${cipStavu(s)} ${s.stav === 'terminator' ? '– teď je vidět nejlépe, stíny jsou dlouhé.' : ''}</div>
      <div class="meta" style="margin-top:4px">Nejbližší: ${kdy.join(' · ') || '—'}<br>Nejlepší reliéf bývá 1–2 dny po východu Slunce nad útvarem (ranní světlo) a před jeho západem.</div>
      <div class="akce">
        <button class="btn mini" data-akce="vystredit">🎯 Na mapě</button>
        <button class="btn mini" data-akce="seznam">${vSeznamu ? '★ Odebrat ze seznamu' : '☆ Přidat do seznamu'}</button>
        <button class="btn mini" data-akce="pozorovano">${poz ? '✅ Pozorováno ' + esc(poz.datum) : '☐ Označit jako pozorované'}</button>
      </div></div>`;
  }
  $('detail').addEventListener('click', e => {
    const a = e.target.closest('[data-akce]'); if (!a || !vybrany) return;
    const u = vybrany;
    if (a.dataset.akce === 'zavrit') return vyber(null);
    if (a.dataset.akce === 'vystredit') return vyber(u, true);
    if (a.dataset.akce === 'seznam') seznam = seznam.includes(u.jmeno) ? seznam.filter(j => j !== u.jmeno) : [...seznam, u.jmeno];
    if (a.dataset.akce === 'pozorovano') prepniPozorovani(u.jmeno);
    ulozSeznam(); vykresliDetail(); vykresliPanel();
  });
  function prepniPozorovani(jmeno) {
    if (pozorovano[jmeno]) delete pozorovano[jmeno];
    else pozorovano[jmeno] = { datum: dnesIso(), pozn: '' };
    if (!seznam.includes(jmeno)) seznam.push(jmeno);
  }

  function radek(u, extra = '', zaskrt = false) {
    const s = J.stavUtvaru(u, ef);
    const chk = zaskrt ? `<input type="checkbox" data-pozorovano="${esc(u.jmeno)}" ${pozorovano[u.jmeno] ? 'checked' : ''} aria-label="Pozorováno: ${esc(u.jmeno)}">` : '';
    return `<div class="radek-u${u === vybrany ? ' vybrany' : ''}" data-utvar="${esc(u.jmeno)}">${chk}<span class="jm">${nazevU(u)}</span>${extra}${cipStavu(s)}</div>`;
  }
  function oznacRadky() {
    document.querySelectorAll('.radek-u').forEach(r => r.classList.toggle('vybrany', !!vybrany && r.dataset.utvar === vybrany.jmeno));
  }

  function panelDnes() {
    const c = J.coPozorovat(UTVARY, ef, 24);
    const noc = J.noc(datum, nast.misto);
    let h = '';
    if (par.alt <= 0) h += `<div class="varovani">V zadaném čase je Měsíc pro ${esc(nast.misto.nazev || 'zvolené místo')} pod obzorem.${noc.nejlepsi ? ` Za tmy bude nejvýš ${casTxt(noc.nejlepsi.datum)} (${stupne(noc.nejlepsi.mesic, 0)}).` : ''}</div>`;
    else if (noc.nejlepsi) h += `<p class="tip">Za tmy (Slunce pod −6°) je Měsíc nejvýš ${casTxt(noc.nejlepsi.datum)} – ${stupne(noc.nejlepsi.mesic, 0)} nad obzorem.</p>`;
    if (ef.k < 0.03) h += '<div class="varovani">Kolem novu je Měsíc u Slunce a pozorovat ho nejde. Zkuste datum o 3–4 dny později.</div>';
    const rano = c.relief.filter(x => x.s.rano), vecer = c.relief.filter(x => !x.s.rano);
    if (rano.length) h += `<h3 class="sekce">🌅 Ranní terminátor – Slunce vychází</h3>` + rano.map(x => radek(x.u)).join('');
    if (vecer.length) h += `<h3 class="sekce">🌇 Večerní terminátor – Slunce zapadá</h3>` + vecer.map(x => radek(x.u)).join('');
    if (c.albedo.length) h += `<h3 class="sekce">✨ Za vysokého Slunce: paprsky a světlé skvrny</h3>` + c.albedo.map(x => radek(x.u)).join('');
    if (!c.relief.length && !c.albedo.length) h += '<p class="tip">Teď u terminátoru nic význačného neleží.</p>';
    h += '<p class="tip">Seřazeno podle toho, jak dobře je útvar teď vidět: nízké Slunce (0–12°), velikost, význam a vzdálenost od okraje disku.</p>';
    return h;
  }
  function panelUtvary() {
    const typy = Object.entries(J.TYPY).map(([k, v]) => `<option value="${k}" ${nast.typ === k ? 'selected' : ''}>${esc(v)}</option>`).join('');
    const sez = J.filtruj(UTVARY, { hledat, typ: nast.typ, jenCile: nast.jenCile, obt: nast.obt })
      .sort((a, b) => (a.cesky || a.jmeno).localeCompare(b.cesky || b.jmeno, 'cs'));
    return `<div class="filtry">
      <select class="vstup" id="fTyp" aria-label="Typ útvaru"><option value="">Všechny typy</option>${typy}</select>
      <select class="vstup" id="fObt" aria-label="Obtížnost">
        <option value="0">Každá obtížnost</option><option value="1" ${nast.obt === 1 ? 'selected' : ''}>★ malý dalekohled, triedr</option>
        <option value="2" ${nast.obt === 2 ? 'selected' : ''}>do ★★ (60–100 mm)</option></select>
      <label><input type="checkbox" id="fCile" ${nast.jenCile ? 'checked' : ''}> jen výběr cílů</label>
    </div><p class="tip">${sez.length} z ${UTVARY.length} útvarů${hledat ? ` pro „${esc(hledat)}“` : ''}</p>` +
      (sez.map(u => radek(u)).join('') || '<p class="tip">Nic nenalezeno.</p>');
  }
  function panelSeznam() {
    const pol = seznam.map(j => PODLE_JMENA.get(j)).filter(Boolean).sort((a, b) => a.obt - b.obt || (a.cesky || a.jmeno).localeCompare(b.cesky || b.jmeno, 'cs'));
    const hotovo = pol.filter(u => pozorovano[u.jmeno]).length;
    const ukaz = nast.jenNepozorovane ? pol.filter(u => !pozorovano[u.jmeno]) : pol;
    let h = `<div class="tip"><b>${hotovo} / ${pol.length}</b> pozorováno</div><div class="postup"><span style="width:${pol.length ? hotovo / pol.length * 100 : 0}%"></span></div>
      <div class="filtry"><label><input type="checkbox" id="fNepoz" ${nast.jenNepozorovane ? 'checked' : ''}> jen dosud nepozorované</label></div>`;
    for (const o of [1, 2, 3]) {
      const s = ukaz.filter(u => u.obt === o);
      if (s.length) h += `<h3 class="sekce">${'★'.repeat(o)} ${['', 'snadné – triedr a malý dalekohled', 'střední – dalekohled 60–100 mm', 'náročné – 150 mm a více, dobrý seeing, příznivá librace'][o]}</h3>` +
        s.map(u => radek(u, pozorovano[u.jmeno] ? `<span class="h">${esc(pozorovano[u.jmeno].datum)}</span>` : '', true)).join('');
    }
    h += '<p class="tip">Výchozí výběr 65 cílů je sestaven pro tento atlas. Další útvary přidáte tlačítkem ☆ v detailu útvaru. Odškrtnutí se ukládá jen v tomto prohlížeči – zálohu najdete v nabídce Soubor.</p>';
    return h;
  }
  function panelUdaje() {
    const dalsi = J.dalsiFaze(ef.jde, 4);
    const strana = (x, kl, zp) => Math.abs(x) < 0.5 ? 'střed' : x > 0 ? kl : zp;
    const radky = [
      ['Fáze', ef.faze], ['Osvětlená část', f1(ef.k * 100) + ' %'], ['Stáří od novu', f1(ef.stari) + ' dne'],
      ['Colongitude Slunce', stupne(ef.c0, 2)], ['Subsolární šířka b₀', stupne(ef.b0, 2)],
      ['Librace v délce', `${stupne(ef.l, 2)} (${strana(ef.l, 'odkrytý východní okraj', 'odkrytý západní okraj')})`],
      ['Librace v šířce', `${stupne(ef.b, 2)} (${strana(ef.b, 'odkrytý severní okraj', 'odkrytý jižní okraj')})`],
      ['Poziční úhel osy P', stupne(ef.P, 1)],
      ['Vzdálenost (střed Země)', Math.round(ef.vzdalenost).toLocaleString('cs-CZ') + ' km'], ['Úhlový průměr', f1(ef.prumer) + '′'],
      ['Výška nad obzorem', `${stupne(par.alt)} (azimut ${stupne(par.az, 0)})`], ['Paralaktický úhel', stupne(par.q)],
    ];
    let h = `<table class="tabulka">${radky.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</table>`;
    h += `<h3 class="sekce">Další fáze</h3><table class="tabulka">${dalsi.map(f => `<tr><td>${esc(J.FAZE[f.druh])}</td><td>${esc(casTxt(f.datum))}</td></tr>`).join('')}</table>`;
    h += `<p class="tip">Výpočet geocentrický (pro střed Země); topocentrická librace se od něj liší až o 1°. Místo: ${esc(nast.misto.nazev || '')} ${sirka(nast.misto.lat)}, ${f1(Math.abs(nast.misto.lon), 2)}° ${nast.misto.lon >= 0 ? 'v. d.' : 'z. d.'}</p>`;
    return h;
  }
  function vykresliPanel() {
    document.querySelectorAll('[data-zalozka]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.zalozka === nast.zalozka)));
    const obs = { dnes: panelDnes, utvary: panelUtvary, seznam: panelSeznam, udaje: panelUdaje }[nast.zalozka] || panelDnes;
    $('obsahPanelu').innerHTML = obs();
    vykresliDetail();
    $('mistoTxt').textContent = ' ' + (nast.misto.nazev || 'Místo');
  }
  $('obsahPanelu').addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'fTyp') nast.typ = t.value;
    else if (t.id === 'fObt') nast.obt = +t.value;
    else if (t.id === 'fCile') nast.jenCile = t.checked;
    else if (t.id === 'fNepoz') nast.jenNepozorovane = t.checked;
    else if (t.dataset.pozorovano) { prepniPozorovani(t.dataset.pozorovano); ulozSeznam(); }
    ulozNast(); vykresliPanel();
  });
  $('obsahPanelu').addEventListener('click', e => {
    if (e.target.matches('input')) return;
    const r = e.target.closest('[data-utvar]');
    if (r) vyber(PODLE_JMENA.get(r.dataset.utvar), true);
  });
  document.querySelectorAll('[data-zalozka]').forEach(b => b.addEventListener('click', () => { nast.zalozka = b.dataset.zalozka; ulozNast(); vykresliPanel(); }));

  /* ---------- lišta ---------- */
  function zavriNabidky() {
    document.querySelectorAll('.nabidka:not([hidden])').forEach(n => { n.hidden = true; });
    document.querySelectorAll('[data-nabidka][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  function oznacNabidky() {
    document.querySelectorAll('[data-nast]').forEach(b => b.setAttribute('aria-checked', String(nast[b.dataset.nast] === b.dataset.hodnota)));
    document.querySelectorAll('[data-prepinac]').forEach(b => b.setAttribute('aria-checked', String(!!nast[b.dataset.prepinac])));
  }
  document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const n = $(b.dataset.nabidka), bylo = !n.hidden;
    zavriNabidky();
    if (bylo) return;
    n.hidden = false; b.setAttribute('aria-expanded', 'true');
    const r = b.getBoundingClientRect();
    n.style.top = (r.bottom + 4) + 'px';
    n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
  }));
  document.addEventListener('click', e => {
    const p = e.target.closest('[data-prikaz]');
    if (p) { zavriNabidky(); return PRIKAZY[p.dataset.prikaz](); }
    const n = e.target.closest('[data-nast]');
    if (n) { nast[n.dataset.nast] = n.dataset.hodnota; ulozNast(); oznacNabidky(); pohled.x = pohled.y = 0; return prepocti(); }
    const pr = e.target.closest('[data-prepinac]');
    if (pr) { nast[pr.dataset.prepinac] = !nast[pr.dataset.prepinac]; ulozNast(); oznacNabidky(); return kresli(true); }
    const ps = e.target.closest('[data-posun]');
    if (ps) { datum = new Date(datum.getTime() + ps.dataset.posun * 60000); return prepocti(); }
    if (!e.target.closest('.nabidka')) zavriNabidky();
  });
  $('cas').addEventListener('change', e => { const d = new Date(e.target.value); if (!isNaN(d)) { datum = d; prepocti(); } });
  $('hledat').addEventListener('input', e => {
    hledat = e.target.value;
    if (nast.zalozka !== 'utvary') nast.zalozka = 'utvary';
    vykresliPanel();
  });
  $('hledat').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const prvni = J.filtruj(UTVARY, { hledat })[0];
    if (prvni) vyber(prvni, true);
  });

  const PRIKAZY = {
    ted() { datum = new Date(); prepocti(); },
    priblizit() { priblizKolem(sirkaPx / 2, vyskaPx / 2, pohled.zoom * 1.5); kresli(true); },
    oddalit() { priblizKolem(sirkaPx / 2, vyskaPx / 2, pohled.zoom / 1.5); omez(); kresli(true); },
    celek() { pohled.zoom = 1; pohled.x = pohled.y = 0; kresli(true); },
    napoveda() { $('dlgNapoveda').showModal(); },
    misto() {
      const f = $('dlgMisto').querySelector('form');
      f.lat.value = nast.misto.lat; f.lon.value = nast.misto.lon; f.nazev.value = nast.misto.nazev || '';
      $('dlgMisto').showModal();
    },
    export() {
      const blob = new Blob([JSON.stringify({ aplikace: 'atlas_mesice', verze: 1, seznam, pozorovano }, null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `atlas_mesice_seznam_${dnesIso()}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    import() { $('souborImport').click(); },
    async vychoziSeznam() {
      if (!await Dialog.potvrd('Nahradit seznam výchozím výběrem 65 cílů? Odškrtnutá pozorování zůstanou.')) return;
      seznam = vychoziSeznam(); ulozSeznam(); vykresliPanel();
    },
    async smazPozorovani() {
      if (!await Dialog.potvrd(`Smazat všech ${Object.keys(pozorovano).length} odškrtnutých pozorování?`)) return;
      pozorovano = {}; ulozSeznam(); vykresliPanel();
    },
    tiskSeznam() { nast.zalozka = 'seznam'; vykresliPanel(); setTimeout(() => window.print(), 50); },
  };
  $('souborImport').addEventListener('change', async e => {
    const s = e.target.files[0]; e.target.value = '';
    if (!s) return;
    try {
      const d = JSON.parse(await s.text());
      if (!d || d.aplikace !== 'atlas_mesice') throw new Error('Soubor není záloha Atlasu Měsíce.');
      const nove = (Array.isArray(d.seznam) ? d.seznam : []).filter(j => PODLE_JMENA.has(j));
      if (!await Dialog.potvrd(`Záloha obsahuje ${nove.length} cílů a ${Object.keys(d.pozorovano || {}).length} pozorování. Nahradit současný seznam?`)) return;
      seznam = nove; pozorovano = J.normPozorovani(d.pozorovano); ulozSeznam(); vykresliPanel();
    } catch (chyba) { Dialog.chyba('Zálohu nelze načíst: ' + chyba.message); }
  });
  $('dlgMisto').addEventListener('close', () => {
    if ($('dlgMisto').returnValue !== 'ok') return;
    const f = $('dlgMisto').querySelector('form');
    const lat = parseFloat(f.lat.value), lon = parseFloat(f.lon.value);
    if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return Dialog.chyba('Neplatné souřadnice.');
    nast.misto = { lat, lon, nazev: f.nazev.value.trim() };
    ulozNast(); prepocti();
  });
  $('polohaZarizeni').addEventListener('click', () => {
    if (!navigator.geolocation) return Dialog.chyba('Prohlížeč neumí zjistit polohu.');
    navigator.geolocation.getCurrentPosition(p => {
      const f = $('dlgMisto').querySelector('form');
      f.lat.value = p.coords.latitude.toFixed(2); f.lon.value = p.coords.longitude.toFixed(2);
      if (!f.nazev.value) f.nazev.value = 'Moje poloha';
    }, err => Dialog.chyba('Polohu se nepodařilo zjistit: ' + err.message), { timeout: 15000 });
  });

  /* ---------- start ---------- */
  new ResizeObserver(() => { velikost(); kresli(true); }).observe($('mapaObal'));
  velikost();
  oznacNabidky();
  prepocti();
  const obr = new Image();
  obr.onload = () => {
    const c = document.createElement('canvas');
    c.width = obr.naturalWidth; c.height = obr.naturalHeight;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(obr, 0, 0);
    const rgba = x.getImageData(0, 0, c.width, c.height).data;
    const data = new Uint8Array(c.width * c.height);
    for (let i = 0; i < data.length; i++) data[i] = rgba[i * 4];
    tex = { sirka: c.width, vyska: c.height, data };
    $('nacitani').hidden = true;
    kresli(true);
  };
  obr.onerror = () => { $('nacitani').textContent = 'Mapu Měsíce se nepodařilo načíst (atlas_mesice/mesic.webp). Výpočty v panelu fungují i bez ní.'; };
  obr.src = 'atlas_mesice/mesic.webp';
  window.ATLAS_APP = { vyber: j => vyber(PODLE_JMENA.get(j), true), nastavCas: d => { datum = new Date(d); prepocti(); }, pohled, nast };
})();
