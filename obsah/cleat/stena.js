/* French cleat – plánovač stěny: řady lišt a rozmístění držáků v pohledu zepředu (SVG), kolize, souhrn.
   CLEAT_STENA.pripoj({ kontejner, katalog: () => [{klic, nazev, p}], info: p → {W, dole, horni, H, gramy, minut} | null,
                        fmt, klic: 'webapp_cleat_stena', zmena: () => {} })
   Souřadnice v mm: x podél stěny od levého kraje, z nad podlahou. Lišta řady i má horní hranu v z = horni − i·roztec;
   držák s rozměry z CLEAT.odvozene (spodek lišty = 0) sahá od z_i − H + dole po z_i − H + horni.
   kolize(stav, info) a souhrn(stav, info) jsou bez DOM (testují se v node). Kreslí se až voláním kresli() (při otevření záložky). */
(function () {
  'use strict';
  const VYCHOZI = { sirka: 1200, rady: 3, roztec: 220, horni: 1500, polozky: [] };

  /** Obdélníky držáků v pohledu zepředu. */
  function obdelniky(st, info) {
    return st.polozky.map((it, i) => {
      const f = info(it.p);
      if (!f) return null;
      const zLista = st.horni - it.rada * st.roztec - f.H;   // spodek lišty řady
      return { i, x0: it.x, x1: it.x + f.W, z0: zLista + f.dole, z1: zLista + f.horni, f };
    });
  }
  const prekryv = (a, b) => a.x0 < b.x1 - 0.01 && b.x0 < a.x1 - 0.01 && a.z0 < b.z1 - 0.01 && b.z0 < a.z1 - 0.01;
  /** Indexy kolidujících držáků (překryv v pohledu zepředu, mimo stěnu, nebo jiná výška lišty než H). */
  function kolize(st, info, H) {
    const ob = obdelniky(st, info), vadne = new Set();
    ob.forEach((a, i) => {
      if (!a) return;
      if (a.x0 < -0.01 || a.x1 > st.sirka + 0.01) vadne.add(i);
      if (H && Math.abs(a.f.H - H) > 0.5) vadne.add(i);
      ob.forEach((b, j) => { if (b && j > i && prekryv(a, b)) { vadne.add(i); vadne.add(j); } });
    });
    return vadne;
  }
  /** Souhrn: počty dílů, lišty, vruty do zdi, plast a čas tisku. */
  function souhrn(st, info) {
    const dily = new Map();
    let gramy = 0, minut = 0, nezname = 0;
    for (const it of st.polozky) {
      // stejný název může mít víc různých nastavení → klíč podle parametrů, v tabulce název
      const f = info(it.p), klic = JSON.stringify(it.p), d = dily.get(klic);
      if (d) d[1]++; else dily.set(klic, [it.nazev, 1]);
      if (f && Number.isFinite(f.gramy)) { gramy += f.gramy; minut += f.minut; } else nezname++;
    }
    const vrutuNaRadu = Math.ceil(st.sirka / 400) + 1;   // vrut do každého sloupku / po 40 cm
    return { dily: [...dily.values()], listyMetru: st.rady * st.sirka / 1000, vrutu: st.rady * vrutuNaRadu, gramy, minut, nezname };
  }

  function pripoj(cfg) {
    const el = cfg.kontejner, fmt = cfg.fmt, info = cfg.info;
    let st;
    try { st = Object.assign({}, VYCHOZI, JSON.parse(localStorage.getItem(cfg.klic)) || {}); } catch (e) { st = Object.assign({}, VYCHOZI); }
    if (!Array.isArray(st.polozky)) st.polozky = [];
    let vybrany = -1;
    const uloz = () => { try { localStorage.setItem(cfg.klic, JSON.stringify(st)); } catch (e) { /* plné úložiště */ } };
    el.innerHTML = `
      <div class="stena-ovladani">
        <label>Šířka stěny <input type="text" inputmode="numeric" data-s="sirka"> mm</label>
        <label>Řad lišt <input type="text" inputmode="numeric" data-s="rady"></label>
        <label>Rozteč řad <input type="text" inputmode="numeric" data-s="roztec"> mm</label>
        <label>Horní lišta <input type="text" inputmode="numeric" data-s="horni"> mm nad podlahou</label>
      </div>
      <div class="stena-ovladani">
        <select class="stena-katalog" aria-label="Držák k přidání"></select>
        <button type="button" class="tl" data-a="pridat">➕ Přidat na stěnu</button>
        <button type="button" class="tl" data-a="smazat">🗑 Odebrat vybraný</button>
        <button type="button" class="tl" data-a="vycistit">Vyčistit</button>
      </div>
      <div class="stena-obal"><svg class="stena-svg" role="img" aria-label="Stěna s lištami a držáky – tažením přesunete"></svg></div>
      <div class="stena-souhrn"></div>`;
    const svg = el.querySelector('svg'), sel = el.querySelector('.stena-katalog');
    const vstupy = [...el.querySelectorAll('[data-s]')];
    const meze = { sirka: [200, 6000], rady: [1, 12], roztec: [60, 800], horni: [200, 3000] };
    for (const v of vstupy) {
      v.value = st[v.dataset.s];
      v.addEventListener('change', () => {
        const [a, b] = meze[v.dataset.s], h = Math.min(b, Math.max(a, Math.round(parseFloat(String(v.value).replace(',', '.')) || st[v.dataset.s])));
        st[v.dataset.s] = h; v.value = h;
        st.polozky.forEach(it => { it.rada = Math.min(it.rada, st.rady - 1); });
        uloz(); kresli();
      });
    }
    function katalog() {
      const k = cfg.katalog(), byl = sel.value;
      sel.innerHTML = k.map((x, i) => `<option value="${i}">${esc(x.nazev)}</option>`).join('');
      if (byl && +byl < k.length) sel.value = byl;
      return k;
    }
    const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    el.querySelector('[data-a="pridat"]').addEventListener('click', () => {
      const k = cfg.katalog()[+sel.value || 0];   // index přečíst dřív, než se seznam přestaví
      if (!k) return;
      const f = info(k.p);
      if (!f) return;
      // první volné místo zleva v horní řadě (pak níž) – testuje se jen nový obdélník proti ostatním
      const ob = obdelniky(st, info).filter(Boolean);
      for (let r = 0; r < st.rady; r++) for (let x = 0; x + f.W <= st.sirka; x += 5) {
        const zl = st.horni - r * st.roztec - f.H, a = { x0: x, x1: x + f.W, z0: zl + f.dole, z1: zl + f.horni };
        if (!ob.some(b => prekryv(a, b))) { st.polozky.push({ nazev: k.nazev, p: k.p, x, rada: r }); vybrany = st.polozky.length - 1; uloz(); kresli(); return; }
      }
      st.polozky.push({ nazev: k.nazev, p: k.p, x: 0, rada: 0 }); vybrany = st.polozky.length - 1; uloz(); kresli();
    });
    el.querySelector('[data-a="smazat"]').addEventListener('click', () => { if (vybrany >= 0) { st.polozky.splice(vybrany, 1); vybrany = -1; uloz(); kresli(); } });
    el.querySelector('[data-a="vycistit"]').addEventListener('click', () => { st.polozky = []; vybrany = -1; uloz(); kresli(); });
    svg.tabIndex = 0;
    svg.addEventListener('keydown', e => {
      if (vybrany < 0) return;
      const it = st.polozky[vybrany];
      if (e.key === 'Delete' || e.key === 'Backspace') { st.polozky.splice(vybrany, 1); vybrany = -1; }
      else if (e.key === 'ArrowLeft') it.x -= e.shiftKey ? 50 : 5;
      else if (e.key === 'ArrowRight') it.x += e.shiftKey ? 50 : 5;
      else if (e.key === 'ArrowUp') it.rada = Math.max(0, it.rada - 1);
      else if (e.key === 'ArrowDown') it.rada = Math.min(st.rady - 1, it.rada + 1);
      else return;
      e.preventDefault(); uloz(); kresli();
    });
    // tažení: x po 5 mm, svisle skok na nejbližší řadu
    let tah = null;
    const bod = e => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const q = pt.matrixTransform(svg.getScreenCTM().inverse()); return [q.x, -q.y]; };
    svg.addEventListener('pointerdown', e => {
      const g = e.target.closest('[data-i]');
      vybrany = g ? +g.dataset.i : -1;
      if (g) { const [x] = bod(e); tah = { i: vybrany, dx: x - st.polozky[vybrany].x }; try { svg.setPointerCapture(e.pointerId); } catch (er) { /* syntetická událost */ } }
      kresli();
    });
    svg.addEventListener('pointermove', e => {
      if (!tah) return;
      const [x, z] = bod(e), it = st.polozky[tah.i], f = info(it.p);
      it.x = Math.round((x - tah.dx) / 5) * 5;
      const zStred = z - ((f ? (f.dole + f.horni) / 2 - f.H : 0));
      it.rada = Math.min(st.rady - 1, Math.max(0, Math.round((st.horni - zStred) / st.roztec)));
      kresli(false);
    });
    const konec = () => { if (tah) { tah = null; uloz(); } };
    svg.addEventListener('pointerup', konec); svg.addEventListener('pointercancel', konec);

    function kresli(plna = true) {
      if (plna) katalog();
      const Hl = cfg.vyskaListy ? cfg.vyskaListy() : 80;
      const ob = obdelniky(st, info), vadne = kolize(st, info, Hl);
      const zTop = Math.max(st.horni + 60, ...ob.filter(Boolean).map(a => a.z1 + 30));
      const zDol = Math.min(st.horni - (st.rady - 1) * st.roztec - 200, ...ob.filter(Boolean).map(a => a.z0 - 30));
      const vb = [-30, -zTop, st.sirka + 60, zTop - zDol], text = Math.max(12, st.sirka / 70);
      let h = `<rect x="0" y="${-zTop}" width="${st.sirka}" height="${zTop - zDol}" class="stena-zed"/>`;
      for (let r = 0; r < st.rady; r++) {
        const zl = st.horni - r * st.roztec;
        const H = Hl;
        h += `<rect x="0" y="${-zl}" width="${st.sirka}" height="${H}" class="stena-lista"/><text x="${-6}" y="${-zl + H / 2}" class="stena-popis" text-anchor="end" font-size="${text}">${r + 1}</text>`;
      }
      ob.forEach((a, i) => {
        if (!a) return;
        const it = st.polozky[i];
        h += `<g data-i="${i}" class="stena-dil${vadne.has(i) ? ' kolize' : ''}${i === vybrany ? ' vybrany' : ''}"><rect x="${a.x0}" y="${-a.z1}" width="${a.x1 - a.x0}" height="${a.z1 - a.z0}" rx="3"/>`
          + `<text x="${(a.x0 + a.x1) / 2}" y="${-(a.z0 + a.z1) / 2}" text-anchor="middle" dominant-baseline="middle" font-size="${Math.min(text, (a.x1 - a.x0) / 4)}">${esc(String(it.nazev).slice(0, 18))}</text></g>`;
      });
      svg.setAttribute('viewBox', vb.join(' '));
      svg.innerHTML = h;
      const s = souhrn(st, info);
      el.querySelector('.stena-souhrn').innerHTML = `<table class="tabulka"><tr><th class="c">Ks</th><th>Díl</th></tr>`
        + s.dily.map(([n, c]) => `<tr><td class="c">${c}</td><td>${esc(n)}</td></tr>`).join('')
        + `<tr><td class="c">${fmt(s.listyMetru, 2)} m</td><td>nástěnná lišta (${st.rady} × ${fmt(st.sirka, 0)} mm)</td></tr>`
        + `<tr><td class="c">${s.vrutu}</td><td>vruty do zdi pro lišty (po ~40 cm)</td></tr>`
        + `<tr><td class="c">${fmt(s.gramy, 0)} g</td><td>plast na všechny díly${s.minut ? `, tisk ≈ ${fmt(s.minut / 60, 1)} h` : ''}${s.nezname ? ` (${s.nezname} dílů bez odhadu)` : ''}</td></tr></table>`
        + (vadne.size ? `<p class="napoveda chyba-t">⚠ Dílů s překryvem, mimo stěnu nebo pro jinou lištu: ${vadne.size} (červeně).</p>` : '');
      if (cfg.zmena) cfg.zmena(st);
    }
    return { kresli, get stav() { return st; } };
  }

  const API = { pripoj, kolize, souhrn, obdelniky, VYCHOZI };
  if (typeof module !== 'undefined') module.exports = API; else window.CLEAT_STENA = API;
})();
