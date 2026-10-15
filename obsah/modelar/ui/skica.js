/* Modelář 3D – editor 2D skici (okno přes celou plochu).
   Plátno v mm (y nahoru, osa Y = osa rotace), mřížka s přichycením na krok
   a na existující body. Nástroje: Výběr (klik vybere, tažení posune tvar
   nebo bod cesty), Obdélník, Kruh, N-úhelník (tažení od středu), Čára
   (klikání bodů, zavře klik na první bod, Enter nebo dvojklik), Text
   (klik → zadat text; písmo z fonty/fonty.js se převede na obrysy).
   Kolečko přibližuje ke kurzoru, pravé/prostřední tlačítko posouvá.
   Panel vpravo: těleso (vytažení/rotace a jejich parametry), nový tvar
   (otvor, počet stran, písmo), vybraný tvar a bod (přesná čísla, oblouk
   úseku = vyboulení, zaoblení rohů), podkladový obrázek. Vlastní
   zpět/znovu (Ctrl+Z/Y). Hotovo vytvoří nebo upraví uzel 'skica'. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const zaokr = x => Math.round(x * 1e4) / 1e4;
  const NASTROJE = [['vyber', '↖', 'Výběr a posun (V)', 'v'], ['obdelnik', '▭', 'Obdélník (R)', 'r'], ['kruh', '◯', 'Kruh (C)', 'c'],
    ['nuhelnik', '⬡', 'N-úhelník (N)', 'n'], ['cesta', '✎', 'Čára a oblouky (L)', 'l'], ['text', 'T', 'Text (T)', 't']];

  /** Obrysy textu z písma opentype.js (mm, účaří y = 0, y nahoru). */
  M.konturyTextu = function (font, text, velikost) {
    const p = font.getPath(text, 0, 0, velikost);
    const kontury = [];
    let akt = null, x = 0, y = 0;
    const bod = (px, py) => { akt.push([zaokr(px), zaokr(-py)]); x = px; y = py; };
    for (const c of p.commands) {
      if (c.type === 'M') { akt = []; kontury.push(akt); bod(c.x, c.y); }
      else if (c.type === 'L') bod(c.x, c.y);
      else if (c.type === 'Q') { const x0 = x, y0 = y; for (let i = 1; i <= 8; i++) { const t = i / 8, u = 1 - t; bod(u * u * x0 + 2 * u * t * c.x1 + t * t * c.x, u * u * y0 + 2 * u * t * c.y1 + t * t * c.y); } }
      else if (c.type === 'C') { const x0 = x, y0 = y; for (let i = 1; i <= 10; i++) { const t = i / 10, u = 1 - t; bod(u * u * u * x0 + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x, u * u * u * y0 + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y); } }
      else if (c.type === 'Z' && akt) {
        const a = akt[0], b = akt[akt.length - 1];
        if (akt.length > 1 && Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6) akt.pop();
        akt = null;
      }
    }
    return kontury.filter(k => k.length >= 3);
  };

  /** Je bod uvnitř oblasti obrysů (pravidlo nenulového vinutí)? */
  function uvnitr(kontury, x, y) {
    let w = 0;
    for (const k of kontury) for (let i = 0; i < k.length; i++) {
      const a = k[i], b = k[(i + 1) % k.length];
      if (a[1] <= y) { if (b[1] > y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) > 0) w++; }
      else if (b[1] <= y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) < 0) w--;
    }
    return w !== 0;
  }
  /** Vzdálenost bodu od obrysu (mm). */
  function kObrysu(kontury, x, y) {
    let d = Infinity;
    for (const k of kontury) for (let i = 0; i < k.length; i++) {
      const a = k[i], b = k[(i + 1) % k.length], dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
      const t = l ? M.omez(((x - a[0]) * dx + (y - a[1]) * dy) / l, 0, 1) : 0;
      d = Math.min(d, Math.hypot(a[0] + dx * t - x, a[1] + dy * t - y));
    }
    return d;
  }

  M.vytvorSkicar = function (S) {
    const okno = $('skicar'), svg = $('skicarPlatno'), panel = $('skicarPanel'), stav = $('skicarStav');
    const st = {
      uzelId: null, param: null, podklad: null, vyber: -1, bod: -1, nastroj: 'vyber', otvor: false,
      nStran: 6, zaobleni: 0, font: 'libsans', velikostPisma: 10, prichytit: true,
      pohled: { s: 4, ox: 0, oy: 0 }, tah: null, cesta: null, kurzor: null, prichyceno: null,
      historie: [], index: -1,
    };
    M.skicar = st;

    // ------------------------------------------------------------ souřadnice
    const naObr = (x, y) => [st.pohled.ox + x * st.pohled.s, st.pohled.oy - y * st.pohled.s];
    const zObr = (X, Y) => [(X - st.pohled.ox) / st.pohled.s, (st.pohled.oy - Y) / st.pohled.s];
    const pixel = e => { const r = svg.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const krok = () => Math.max(S.deska.krok, 0.1);

    /** Body, na které se dá přichytit (rohy, středy, vrcholy). */
    function bodyPrichyceni() {
      const out = [];
      st.param.tvary.forEach((t, i) => {
        // ne na sebe při posunu: u taženého bodu cesty jen ten bod, ostatní body cesty přichytávají
        if (st.tah && st.tah.index === i && st.tah.druh !== 'bod') return;
        if (t.typ === 'cesta') t.body.forEach((b, j) => { if (!(st.tah && st.tah.druh === 'bod' && st.tah.index === i && j === st.bod)) out.push([b.x, b.y]); });
        else if (t.typ === 'obdelnik') { out.push([t.x, t.y]); for (const sx of [-1, 1]) for (const sy of [-1, 1]) out.push([t.x + sx * t.w / 2, t.y + sy * t.h / 2]); }
        else if (t.typ === 'kruh' || t.typ === 'nuhelnik') out.push([t.x, t.y]);
      });
      if (st.cesta) st.cesta.forEach(b => out.push([b.x, b.y]));
      out.push([0, 0]);
      return out;
    }
    /** Bod pod kurzorem přichycený na bod (do 8 px) nebo mřížku. */
    function prichyt(X, Y, volne) {
      const [x, y] = zObr(X, Y);
      st.prichyceno = null;
      if (volne || !st.prichytit) return [zaokr(x), zaokr(y)];
      let nej = 8 / st.pohled.s, bod = null;
      for (const b of bodyPrichyceni()) { const d = Math.hypot(b[0] - x, b[1] - y); if (d < nej) { nej = d; bod = b; } }
      if (bod) { st.prichyceno = bod; return bod.slice(); }
      const k = krok();
      return [zaokr(Math.round(x / k) * k), zaokr(Math.round(y / k) * k)];
    }

    // ------------------------------------------------------------ historie editoru
    /** Záznam historie: stav po změně, výběr po ní a výběr před ní (Zpět ho obnoví). */
    function zapis(vyberPred = st.vyber) {
      st.historie.length = st.index + 1;
      st.historie.push(JSON.stringify({ param: st.param, podklad: st.podklad, vyber: st.vyber, vyberPred }));
      if (st.historie.length > 200) st.historie.shift();
      st.index = st.historie.length - 1;
    }
    function obnovZHistorie(i) {
      if (i < 0 || i >= st.historie.length || i === st.index) return;
      const zpet = i < st.index;
      const vyber = zpet ? JSON.parse(st.historie[st.index]).vyberPred : JSON.parse(st.historie[i]).vyber;
      st.index = i;
      const z = JSON.parse(st.historie[i]);
      st.param = z.param; st.podklad = z.podklad;
      st.vyber = vyber >= 0 && vyber < st.param.tvary.length ? vyber : -1;
      st.bod = -1;
      vykresliPanel(); vykresli();
    }
    const zmena = (vyberPred) => { zapis(vyberPred); vykresliPanel(); vykresli(); };

    // ------------------------------------------------------------ kreslení
    function el(n, a, rodic) {
      const e = document.createElementNS(NS, n);
      for (const [k, v] of Object.entries(a)) e.setAttribute(k, v);
      rodic.appendChild(e);
      return e;
    }
    const dKontur = kontury => kontury.map(k => 'M' + k.map(p => naObr(p[0], p[1]).map(v => v.toFixed(1)).join(',')).join('L') + 'Z').join('');

    function vykresli() {
      if (!okno.open) return;
      const W = svg.clientWidth, H = svg.clientHeight;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.textContent = '';
      const p = st.pohled;
      // podklad
      if (st.podklad) {
        const w = st.podklad.sirka * p.s, h = st.podklad.sirka * st.podklad.pomer * p.s;
        const [X, Y] = naObr(st.podklad.x, st.podklad.y);
        el('image', { href: st.podklad.data, x: X - w / 2, y: Y - h / 2, width: w, height: h, opacity: st.podklad.pruhlednost, preserveAspectRatio: 'none' }, svg);
      }
      // mřížka: krok tak, aby čáry byly aspoň 8 px od sebe
      let k = krok();
      for (const f of [2, 2.5, 2, 2, 2.5, 2, 2, 2.5, 2]) { if (k * p.s >= 8) break; k *= f; }
      const [x0, y1] = zObr(0, 0), [x1, y0] = zObr(W, H);
      let jemne = '', hlavni = '';
      for (let x = Math.ceil(x0 / k) * k; x <= x1; x += k) { const X = naObr(x, 0)[0].toFixed(1); const r = `M${X},0V${H}`; if (Math.abs(Math.round(x / (k * 10)) * k * 10 - x) < k / 2) hlavni += r; else jemne += r; }
      for (let y = Math.ceil(y0 / k) * k; y <= y1; y += k) { const Y = naObr(0, y)[1].toFixed(1); const r = `M0,${Y}H${W}`; if (Math.abs(Math.round(y / (k * 10)) * k * 10 - y) < k / 2) hlavni += r; else jemne += r; }
      el('path', { d: jemne, class: 'mriz-jemna' }, svg);
      el('path', { d: hlavni, class: 'mriz-hlavni' }, svg);
      const [OX, OY] = naObr(0, 0);
      if (st.param.rezim === 'rotace') el('rect', { x: 0, y: 0, width: Math.max(0, OX), height: H, class: 'mimo-osu' }, svg);
      el('path', { d: `M0,${OY}H${W}`, class: 'osa-x' }, svg);
      el('path', { d: `M${OX},0V${H}`, class: 'osa-y' + (st.param.rezim === 'rotace' ? ' rotacni' : '') }, svg);
      if (st.param.rezim === 'rotace') el('text', { x: OX + 6, y: 16, class: 'popis-osy' }, svg).textContent = 'osa rotace';
      // tvary: nejdřív plné, pak otvory
      const poradi = st.param.tvary.map((t, i) => i).sort((a, b) => (st.param.tvary[a].otvor ? 1 : 0) - (st.param.tvary[b].otvor ? 1 : 0));
      for (const i of poradi) {
        const t = st.param.tvary[i];
        el('path', { d: dKontur(M.konturyTvaru(t, st.param.segmentu)), class: 'tvar' + (t.otvor ? ' otvor' : '') + (i === st.vyber ? ' vybrany' : ''), 'data-i': i, 'fill-rule': 'nonzero' }, svg);
      }
      // body vybrané cesty
      const v = st.param.tvary[st.vyber];
      if (v && v.typ === 'cesta') v.body.forEach((b, j) => {
        const [X, Y] = naObr(b.x, b.y);
        el('circle', { cx: X, cy: Y, r: j === st.bod ? 6 : 4.5, class: 'bod' + (j === st.bod ? ' vybrany' : ''), 'data-bod': j }, svg);
      });
      // rozkreslený tvar
      if (st.tah && st.tah.nahled) el('path', { d: dKontur(M.konturyTvaru(st.tah.nahled, st.param.segmentu)), class: 'tvar nahled' + (st.otvor ? ' otvor' : '') }, svg);
      if (st.cesta && st.cesta.length) {
        const body = st.cesta.map(b => naObr(b.x, b.y));
        if (st.kurzor) body.push(st.kurzor);
        el('polyline', { points: body.map(b => b.join(',')).join(' '), class: 'rozkreslena' }, svg);
        const [X, Y] = naObr(st.cesta[0].x, st.cesta[0].y);
        el('circle', { cx: X, cy: Y, r: 6, class: 'prvni-bod' }, svg);
      }
      if (st.prichyceno) { const [X, Y] = naObr(...st.prichyceno); el('circle', { cx: X, cy: Y, r: 7, class: 'prichyceni' }, svg); }
    }

    // ------------------------------------------------------------ panel
    const pole = (popis, hodnota, data, jednotka = 'mm', krokPole = 1) =>
      `<label class="ip"><span class="osa">${popis}</span><input type="text" inputmode="decimal" value="${M.mm(hodnota, 3)}" data-pole="${data}" data-krok="${krokPole}"><span class="jed">${jednotka}</span></label>`;

    function vykresliPanel() {
      const p = st.param, t = p.tvary[st.vyber];
      let h = `<section><h3>Těleso</h3>
        <label class="ip"><span class="osa">Druh</span><select data-pole="param.rezim"><option value="vytazeni">Vytažení</option><option value="rotace">Rotace kolem osy Y</option></select></label>`;
      if (p.rezim === 'rotace') h += pole('Úhel', p.uhel, 'param.uhel', '°', 15);
      else h += pole('Výška', p.vyska, 'param.vyska') + pole('Horní plocha', p.horni, 'param.horni', '%', 5) + pole('Zkroucení', p.zkrouceni, 'param.zkrouceni', '°', 15)
        + pole('Posun vršku X', p.posunX, 'param.posunX') + pole('Posun vršku Y', p.posunY, 'param.posunY');
      h += pole('Segmenty oblouků', p.segmentu, 'param.segmentu', '', 4) + '</section>';
      h += `<section><h3>Nový tvar</h3>
        <label class="zaskrt"><input type="checkbox" data-pole="st.otvor" ${st.otvor ? 'checked' : ''}> Kreslit jako otvor</label>
        <label class="zaskrt"><input type="checkbox" data-pole="st.prichytit" ${st.prichytit ? 'checked' : ''}> Přichytávat (mřížka ${M.mm(krok(), 2)} mm, body)</label>
        ${pole('Stran n-úhelníku', st.nStran, 'st.nStran', '', 1)}${pole('Zaoblení obdélníku', st.zaobleni, 'st.zaobleni')}
        <label class="ip"><span class="osa">Písmo</span><select data-pole="st.font" id="skicarFont"></select></label>${pole('Velikost písma', st.velikostPisma, 'st.velikostPisma')}</section>`;
      if (t) {
        const NAZ = { obdelnik: 'Obdélník', kruh: 'Kruh / elipsa', nuhelnik: 'N-úhelník', cesta: 'Čára', text: 'Text', polygony: 'Obrysy (SVG)' };
        h += `<section><h3>Vybraný tvar: ${NAZ[t.typ]}</h3>`;
        if (t.typ === 'obdelnik') h += pole('Střed X', t.x, 't.x') + pole('Střed Y', t.y, 't.y') + pole('Šířka', t.w, 't.w') + pole('Výška', t.h, 't.h') + pole('Zaoblení', t.r, 't.r', 'mm', 0.5);
        if (t.typ === 'kruh') h += pole('Střed X', t.x, 't.x') + pole('Střed Y', t.y, 't.y') + pole('Poloměr X', t.rx, 't.rx') + pole('Poloměr Y', t.ry, 't.ry');
        if (t.typ === 'nuhelnik') h += pole('Střed X', t.x, 't.x') + pole('Střed Y', t.y, 't.y') + pole('Poloměr', t.r, 't.r') + pole('Stran', t.n, 't.n', '', 1) + pole('Natočení', t.natoceni, 't.natoceni', '°', 15);
        if (t.typ === 'cesta') {
          h += pole('Zaoblení rohů', t.zaobleni, 't.zaobleni', 'mm', 0.5);
          const b = t.body[st.bod];
          h += b ? `<div class="pozn">Bod ${st.bod + 1} z ${t.body.length}</div>` + pole('X', b.x, 'b.x') + pole('Y', b.y, 'b.y')
            + pole('Oblouk k dalšímu', b.b, 'b.b', '', 0.1) + '<div class="pozn">0 = rovně, 1 = půlkruh, záporné = na druhou stranu</div>'
            : '<div class="pozn">Klikni na bod (kolečko) pro jeho úpravu.</div>';
        }
        if (t.typ === 'text') h += `<label class="ip"><span class="osa">Text</span><input type="text" value="${esc(t.text)}" data-pole="t.text" class="text-pole"></label>` + pole('X', t.x, 't.x') + pole('Y', t.y, 't.y') + pole('Velikost', t.velikost, 't.velikost');
        if (t.typ === 'polygony') h += pole('X', t.x, 't.x') + pole('Y', t.y, 't.y') + pole('Měřítko', t.meritko, 't.meritko', '×', 0.1);
        h += `<label class="zaskrt"><input type="checkbox" data-pole="t.otvor" ${t.otvor ? 'checked' : ''}> Otvor</label>
          <div class="akce"><button type="button" class="tl" data-akce="duplikovat">⧉ Duplikovat</button><button type="button" class="tl nebezpeci" data-akce="smazat">🗑 Smazat</button></div></section>`;
      }
      h += `<section><h3>Podklad</h3>${st.podklad
        ? pole('Šířka obrázku', st.podklad.sirka, 'pod.sirka') + pole('Střed X', st.podklad.x, 'pod.x') + pole('Střed Y', st.podklad.y, 'pod.y') + pole('Průhlednost', st.podklad.pruhlednost, 'pod.pruhlednost', '', 0.1)
          + '<button type="button" class="tl" data-akce="podkladPryc">✕ Odebrat obrázek</button>'
        : '<button type="button" class="tl" data-akce="podklad">🖼 Vložit obrázek…</button><div class="pozn">Obkreslování výkresu nebo fotky (měřítko nastavíš šířkou).</div>'}</section>`;
      panel.innerHTML = h;
      panel.querySelector('[data-pole="param.rezim"]').value = p.rezim;
      naplnFonty();
    }

    let fonty = null;
    function naplnFonty() {
      const sel = $('skicarFont');
      if (!sel) return;
      if (typeof FONTY === 'undefined') { sel.innerHTML = '<option>písma nejsou k dispozici</option>'; sel.disabled = true; return; }
      const vypln = () => { sel.innerHTML = fonty.map(f => `<option value="${esc(f.id)}">${esc(f.nazev)}</option>`).join(''); sel.value = st.font; };
      if (fonty) vypln(); else FONTY.seznam().then(s => { fonty = s.filter(f => f.pismo === undefined || f.pismo === 'latinka'); vypln(); }).catch(() => {});
    }

    /** Zápis hodnoty z panelu podle data-pole. */
    async function zapisPole(klic, hodnota) {
      const [kde, k] = klic.split('.');
      const t = st.param.tvary[st.vyber];
      if (kde === 'st') { st[k] = hodnota; if (k === 'nStran') st.nStran = M.omez(Math.round(hodnota) || 6, 3, 64); vykresliPanel(); vykresli(); return; }
      if (kde === 'param') st.param = M.normalizujParamSkici(Object.assign({}, st.param, { [k]: hodnota }));
      else if (kde === 'pod' && st.podklad) st.podklad[k] = k === 'pruhlednost' ? M.omez(hodnota, 0, 1) : hodnota;
      else if (kde === 't' && t) {
        const novy = Object.assign({}, t, { [k]: hodnota });
        if (t.typ === 'text' && (k === 'text' || k === 'velikost')) {
          try { novy.kontury = M.konturyTextu(await FONTY.opentype(t.font), novy.text, novy.velikost); }
          catch (e) { Dialog.chyba('Písmo nejde načíst: ' + e.message); return; }
        }
        const n = M.normalizujTvarSkici(novy);
        if (n) st.param.tvary[st.vyber] = n;
      } else if (kde === 'b' && t && t.body[st.bod]) {
        t.body[st.bod][k] = hodnota;
        st.param.tvary[st.vyber] = M.normalizujTvarSkici(t);
      }
      zmena();
    }
    panel.addEventListener('change', e => {
      const i = e.target.closest('[data-pole]');
      if (!i) return;
      if (i.type === 'checkbox') zapisPole(i.dataset.pole, i.checked);
      else if (i.tagName === 'SELECT' || i.classList.contains('text-pole')) zapisPole(i.dataset.pole, i.value);
      else { const v = M.prectiCislo(i.value); if (isFinite(v)) zapisPole(i.dataset.pole, v); else vykresliPanel(); }
    });
    panel.addEventListener('keydown', e => {
      const i = e.target.closest('input[data-krok]');
      if (!i || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      e.preventDefault();
      const v = (M.prectiCislo(i.value) || 0) + (e.key === 'ArrowUp' ? 1 : -1) * (+i.dataset.krok || 1) * (e.shiftKey ? 10 : 1);
      zapisPole(i.dataset.pole, Math.round(v * 1e6) / 1e6).then(() => { const n = panel.querySelector(`[data-pole="${i.dataset.pole}"]`); if (n) { n.focus(); n.select(); } });
    });
    panel.addEventListener('click', e => {
      const b = e.target.closest('[data-akce]');
      if (!b) return;
      const a = b.dataset.akce;
      if (a === 'smazat') smazVybrany();
      else if (a === 'duplikovat') {
        const t = JSON.parse(JSON.stringify(st.param.tvary[st.vyber]));
        const k = krok() * 5;
        if (t.typ === 'cesta') t.body.forEach(p => { p.x += k; p.y -= k; }); else { t.x += k; t.y -= k; }
        st.param.tvary.push(t); st.vyber = st.param.tvary.length - 1; st.bod = -1; zmena();
      } else if (a === 'podklad') $('skicarObrazek').click();
      else if (a === 'podkladPryc') { st.podklad = null; zmena(); }
    });
    $('skicarObrazek').addEventListener('change', e => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const [cx, cy] = zObr(svg.clientWidth / 2, svg.clientHeight / 2);
          st.podklad = { data: r.result, x: zaokr(cx), y: zaokr(cy), sirka: 100, pruhlednost: 0.5, pomer: img.naturalHeight / img.naturalWidth };
          zmena();
        };
        img.src = r.result;
      };
      r.readAsDataURL(f);
    });

    function smazVybrany() {
      const t = st.param.tvary[st.vyber];
      if (!t) return;
      if (t.typ === 'cesta' && st.bod >= 0) {
        // vybraný bod: smazat jen ten (čára potřebuje aspoň 3 body)
        if (t.body.length <= 3) { stav.textContent = 'Čára musí mít aspoň 3 body. Celý tvar smažeš, když vybereš tvar (klik dovnitř).'; return; }
        t.body.splice(st.bod, 1); st.bod = -1;
      } else { const pred = st.vyber; st.param.tvary.splice(st.vyber, 1); st.vyber = -1; st.bod = -1; zmena(pred); return; }
      zmena();
    }

    // ------------------------------------------------------------ nástroje a myš
    const lista = $('skicarNastroje');
    lista.innerHTML = NASTROJE.map(([id, ik, tit]) => `<button type="button" class="tl ik" data-nastroj="${id}" title="${tit}" aria-label="${tit}">${ik}</button>`).join('');
    function nastavNastroj(n) {
      if (st.cesta) dokonciCestu();
      st.nastroj = n;
      lista.querySelectorAll('[data-nastroj]').forEach(b => b.setAttribute('aria-pressed', b.dataset.nastroj === n ? 'true' : 'false'));
      svg.dataset.nastroj = n;
      stav.textContent = { vyber: 'Klikni na tvar (nebo jeho bod) a táhni. Delete smaže.', obdelnik: 'Táhni z rohu do rohu.', kruh: 'Táhni od středu.',
        nuhelnik: 'Táhni od středu (počet stran v panelu).', cesta: 'Naklikej body. Zavři klikem na první bod, Enterem nebo dvojklikem. Backspace = zpět o bod.', text: 'Klikni, kam patří začátek textu.' }[n];
    }
    lista.addEventListener('click', e => { const b = e.target.closest('[data-nastroj]'); if (b) nastavNastroj(b.dataset.nastroj); });

    function zasahTvaru(x, y) {
      const tol = 6 / st.pohled.s;
      for (let i = st.param.tvary.length - 1; i >= 0; i--) {
        const k = M.konturyTvaru(st.param.tvary[i], st.param.segmentu);
        if (uvnitr(k, x, y) || kObrysu(k, x, y) < tol) return i;
      }
      return -1;
    }

    function dokonciCestu() {
      const c = st.cesta;
      st.cesta = null;
      if (c && c.length >= 3) {
        const t = M.normalizujTvarSkici({ typ: 'cesta', body: c, zaobleni: 0, otvor: st.otvor });
        if (t) { st.param.tvary.push(t); st.vyber = st.param.tvary.length - 1; st.bod = -1; zmena(); return; }
      }
      vykresli();
    }

    svg.addEventListener('contextmenu', e => e.preventDefault());
    svg.addEventListener('wheel', e => {
      e.preventDefault();
      const [X, Y] = pixel(e), [x, y] = zObr(X, Y);
      const f = Math.exp(-M.omez(e.deltaY * (e.deltaMode ? 16 : 1), -200, 200) * 0.0015);
      st.pohled.s = M.omez(st.pohled.s * f, 0.05, 400);
      st.pohled.ox = X - x * st.pohled.s; st.pohled.oy = Y + y * st.pohled.s;
      vykresli();
    }, { passive: false });

    svg.addEventListener('pointerdown', e => {
      const [X, Y] = pixel(e);
      svg.setPointerCapture(e.pointerId);
      if (e.button === 1 || e.button === 2) { st.tah = { druh: 'pohled', X, Y }; return; }
      if (e.button !== 0) return;
      const [x, y] = zObr(X, Y);
      const n = st.nastroj;
      if (n === 'vyber') {
        const bodEl = e.target.closest && e.target.closest('[data-bod]');
        if (bodEl) {
          st.bod = +bodEl.dataset.bod;
          st.tah = { druh: 'bod', index: st.vyber, X, Y, posunuto: false };
          vykresliPanel(); vykresli(); return;
        }
        const i = zasahTvaru(x, y);
        st.vyber = i; st.bod = -1;
        if (i >= 0) st.tah = { druh: 'tvar', index: i, puvodni: JSON.stringify(st.param.tvary[i]), start: prichyt(X, Y), posunuto: false };
        vykresliPanel(); vykresli();
      } else if (n === 'cesta') {
        // dvojklik ukončí cestu – vlastní detekce: zachycení ukazatele a překreslení SVG pod kurzorem
        // prohlížeči vezmou click i dblclick. Bod z prvního kliknutí zůstává, druhý se nepřidá.
        const ted = performance.now(), pk = st.posledniKlik;
        st.posledniKlik = { t: ted, X, Y };
        if (st.cesta && pk && ted - pk.t < 450 && Math.hypot(pk.X - X, pk.Y - Y) < 8) {
          st.posledniKlik = null;
          if (st.cesta.length >= 3) dokonciCestu(); else vykresli();
          return;
        }
        const p = prichyt(X, Y);
        if (st.cesta && st.cesta.length >= 3) {
          const [PX, PY] = naObr(st.cesta[0].x, st.cesta[0].y);
          if (Math.hypot(PX - X, PY - Y) < 9) { dokonciCestu(); return; }
        }
        if (!st.cesta) st.cesta = [];
        const posl = st.cesta[st.cesta.length - 1];
        if (!posl || posl.x !== p[0] || posl.y !== p[1]) st.cesta.push({ x: p[0], y: p[1], b: 0 });
        vykresli();
      } else if (n === 'text') {
        const p = prichyt(X, Y);
        e.preventDefault();                       // výchozí fokus po stisku by vzal fokus poli dotazu
        setTimeout(() => vlozText(p), 0);
      } else {
        st.tah = { druh: 'novy', start: prichyt(X, Y) };
      }
    });
    svg.addEventListener('pointermove', e => {
      const [X, Y] = pixel(e);
      const t = st.tah;
      if (t && t.druh === 'pohled') { st.pohled.ox += X - t.X; st.pohled.oy += Y - t.Y; t.X = X; t.Y = Y; vykresli(); return; }
      const p = prichyt(X, Y, e.ctrlKey);
      stav.dataset.kurzor = `x ${M.mm(p[0], 2)}  y ${M.mm(p[1], 2)} mm`;
      $('skicarKurzor').textContent = stav.dataset.kurzor;
      st.kurzor = st.cesta ? naObr(...p) : null;
      if (!t) { vykresli(); return; }
      if (t.druh === 'novy') {
        const [x0, y0] = t.start, dx = p[0] - x0, dy = p[1] - y0, r = Math.hypot(dx, dy);
        const n = st.nastroj;
        t.nahled = n === 'obdelnik' ? { typ: 'obdelnik', x: (x0 + p[0]) / 2, y: (y0 + p[1]) / 2, w: Math.abs(dx), h: Math.abs(dy), r: st.zaobleni }
          : n === 'kruh' ? { typ: 'kruh', x: x0, y: y0, rx: r, ry: r }
          : { typ: 'nuhelnik', x: x0, y: y0, r, n: st.nStran, natoceni: 0 };
        stav.textContent = n === 'obdelnik' ? `${M.mm(Math.abs(dx), 2)} × ${M.mm(Math.abs(dy), 2)} mm` : `poloměr ${M.mm(r, 2)} mm`;
      } else if (t.druh === 'tvar') {
        const dx = p[0] - t.start[0], dy = p[1] - t.start[1];
        const o = JSON.parse(t.puvodni);
        if (o.typ === 'cesta') o.body.forEach(b => { b.x = zaokr(b.x + dx); b.y = zaokr(b.y + dy); }); else { o.x = zaokr(o.x + dx); o.y = zaokr(o.y + dy); }
        st.param.tvary[t.index] = o;
        t.posunuto = dx !== 0 || dy !== 0;
      } else if (t.druh === 'bod') {
        // bod se hne až po pár pixelech (klik s chvěním ruky ho nesmí přeskočit na mřížku)
        if (!t.posunuto && Math.hypot(X - t.X, Y - t.Y) < 4) return;
        const c = st.param.tvary[t.index];
        if (!c || !c.body || !c.body[st.bod]) return;
        c.body[st.bod].x = p[0]; c.body[st.bod].y = p[1];
        t.posunuto = true;
      }
      vykresli();
    });
    function konecTahu() {
      const t = st.tah;
      st.tah = null;
      if (!t) return;
      if (t.druh === 'novy' && t.nahled) {
        const n = M.normalizujTvarSkici(Object.assign({}, t.nahled, { otvor: st.otvor }));
        const velky = t.nahled.typ === 'obdelnik' ? t.nahled.w > 0.05 && t.nahled.h > 0.05 : (t.nahled.typ === 'kruh' ? t.nahled.rx : t.nahled.r) > 0.05;
        if (n && velky) { st.param.tvary.push(n); st.vyber = st.param.tvary.length - 1; st.bod = -1; zmena(); return; }
      }
      if ((t.druh === 'tvar' || t.druh === 'bod') && t.posunuto) { zmena(); return; }
      vykresli();
    }
    svg.addEventListener('pointerup', konecTahu);
    svg.addEventListener('pointercancel', konecTahu);
    svg.addEventListener('dblclick', e => e.preventDefault());     // dvojklik obsluhuje pointerdown (viz cesta)

    async function vlozText(p) {
      if (typeof FONTY === 'undefined' || typeof opentype === 'undefined') { Dialog.chyba('Písma nejsou k dispozici.'); return; }
      const text = await Dialog.zeptej('Text do skici', 'Text');
      if (!text) return;
      try {
        const font = await FONTY.opentype(st.font);
        const kontury = M.konturyTextu(font, text, st.velikostPisma);
        if (!kontury.length) { Dialog.chyba('Text nemá žádné obrysy (mezery?).'); return; }
        // první tvar v nové skice je text: výchozí 10 mm vytažení je na nápis moc, 2 mm jako štítek
        if (!st.param.tvary.length && st.param.rezim === 'vytazeni' && st.param.vyska === M.SKICA_VYCHOZI.vyska) st.param = M.normalizujParamSkici(Object.assign({}, st.param, { vyska: 2 }));
        st.param.tvary.push(M.normalizujTvarSkici({ typ: 'text', text, font: st.font, velikost: st.velikostPisma, x: p[0], y: p[1], kontury, otvor: st.otvor }));
        st.vyber = st.param.tvary.length - 1; st.bod = -1;
        zmena();
      } catch (e) { Dialog.chyba('Písmo nejde načíst: ' + e.message); }
    }

    // klávesy na dokumentu: po kliknutí do plátna (SVG nebere fokus) je fokus na body, mimo okno
    document.addEventListener('keydown', e => {
      // jen jiné modální okno nad skicářem blokuje klávesy (ne boční panely)
      let jine;
      try { jine = document.querySelector('dialog:modal:not(#skicar)'); } catch (x) { jine = document.querySelector('dialog[open]:not(#skicar):not([data-panel])'); }
      if (!okno.open || jine) return;
      if (e.target.closest && e.target.closest('input, select, textarea')) return;
      const k = e.key.toLowerCase();
      // během tažení Zpět ne – tah by pak zapsal tvar zpět do jiného stavu skici
      if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'y') && st.tah) { e.preventDefault(); return; }
      if ((e.ctrlKey || e.metaKey) && k === 'z' && !e.shiftKey) { e.preventDefault(); obnovZHistorie(st.index - 1); return; }
      if ((e.ctrlKey || e.metaKey) && (k === 'y' || (e.shiftKey && k === 'z'))) { e.preventDefault(); obnovZHistorie(st.index + 1); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Delete' || (e.key === 'Backspace' && !st.cesta)) { e.preventDefault(); smazVybrany(); return; }
      if (e.key === 'Backspace' && st.cesta) { e.preventDefault(); st.cesta.pop(); if (!st.cesta.length) st.cesta = null; vykresli(); return; }
      if (e.key === 'Enter' && st.cesta) { e.preventDefault(); dokonciCestu(); return; }
      const n = NASTROJE.find(x => x[3] === k);
      if (n) { e.preventDefault(); nastavNastroj(n[0]); }
    });
    // Esc: nejdřív zrušit rozkreslené, pak výběr, pak zavřít (s potvrzením, když se něco změnilo).
    // Přes keydown s preventDefault – opakovaná událost cancel bez aktivace uživatele by se v Chrome
    // zrušit nedala a okno by se zavřelo bez dotazu (skica pryč)
    function escSkicare() {
      if (st.tah) return;
      if (st.cesta) { st.cesta = null; vykresli(); return; }
      if (st.vyber >= 0) { st.vyber = -1; st.bod = -1; vykresliPanel(); vykresli(); return; }
      zavri();
    }
    okno.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (e.target.closest && e.target.closest('input, select, textarea') && e.target.value) return;
      e.preventDefault(); e.stopPropagation();
      escSkicare();
    });
    okno.addEventListener('cancel', e => { e.preventDefault(); escSkicare(); });

    // ------------------------------------------------------------ otevření a dokončení
    function prizpusobPohled() {
      const W = svg.clientWidth || 800, H = svg.clientHeight || 600;
      let x0 = -20, x1 = 20, y0 = -20, y1 = 20;
      for (const t of st.param.tvary) for (const k of M.konturyTvaru(t, 32)) for (const [x, y] of k) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const s = Math.min(W / (x1 - x0), H / (y1 - y0)) * 0.8;
      st.pohled = { s, ox: W / 2 - (x0 + x1) / 2 * s, oy: H / 2 + (y0 + y1) / 2 * s };
    }

    M.otevriSkicar = function (id = null) {
      const u = id ? M.najdiUzel(M.app.dok, id) : null;
      st.uzelId = u && u.druh === 'skica' ? u.id : null;
      st.param = JSON.parse(JSON.stringify(st.uzelId ? u.param : M.normalizujParamSkici({})));
      st.podklad = st.uzelId && u.podklad ? Object.assign({}, u.podklad) : null;
      st.vyber = -1; st.bod = -1; st.cesta = null; st.tah = null;
      st.historie = []; st.index = -1; zapis();
      st.puvodni = st.historie[0];
      $('skicarNazev').textContent = st.uzelId ? u.nazev : 'Nová skica';
      okno.showModal();
      prizpusobPohled();
      nastavNastroj(st.param.tvary.length ? 'vyber' : 'obdelnik');
      vykresliPanel(); vykresli();
    };

    async function zavri() {
      if (st.historie[st.index] !== st.puvodni && !(await Dialog.potvrd('Zahodit změny ve skice?'))) return;
      okno.close();
    }

    $('skicarZrusit').onclick = zavri;
    $('skicarPrizpusob').onclick = () => { prizpusobPohled(); vykresli(); };
    $('skicarHotovo').onclick = () => {
      if (st.cesta) dokonciCestu();
      if (!st.param.tvary.some(t => !t.otvor)) { Dialog.chyba('Skica potřebuje aspoň jeden plný tvar.'); return; }
      if (st.param.rezim === 'rotace' && !st.param.tvary.some(t => !t.otvor && M.konturyTvaru(t, 16).some(k => k.some(p => p[0] > 0)))) {
        Dialog.chyba('Pro rotaci musí část skici ležet vpravo od osy Y.'); return;
      }
      if (st.uzelId) {
        M.upravVybrane(u => Object.assign(M.upravSkicu(u, st.param), { podklad: st.podklad }), 'Upravit skicu', [st.uzelId]);
      } else {
        M.pridejSkicu(st.param, st.podklad);
      }
      okno.close();
    };

    /** Přidá novou skicu: počátek skici doprostřed pohledu na desku (nebo do počátku pracovní roviny). */
    M.pridejSkicu = function (param, podklad = null, nazev = null) {
      const r = M.app.rovina;
      const k = Math.max(S.deska.krok, 1);
      const pocatek = r ? new THREE.Vector3(...r.puvod) : new THREE.Vector3(Math.round(S.kamera.cil.x / k) * k, Math.round(S.kamera.cil.y / k) * k, 0);
      const q = r ? M.quatRoviny(r) : new THREE.Quaternion();
      const u = M.novaSkica(param, nazev ? { podklad, nazev } : { podklad }, M.app.dok);
      const poloha = new THREE.Vector3(...u.stred).applyQuaternion(q).add(pocatek);
      const n = M.normalizujUzel(Object.assign({}, u, { poloha: poloha.toArray().map(x => zaokr(x)), rotace: M.rotaceZQuat(q) }));
      M.zmenDokument(M.pridejUzly(M.app.dok, [n]), 'Přidat ' + n.nazev);
      M.nastavVyber([n.id]);
      return n;
    };

    // dvojklik na skicu ve scéně ji otevře
    S.renderer.domElement.addEventListener('dblclick', e => {
      if (M.app.rezim) return;                       // v režimu měření/poznámek je dvojklik dva body, ne úprava skici
      const r = S.renderer.domElement.getBoundingClientRect();
      const z = S.telesa.zasah(e.clientX - r.left, e.clientY - r.top);
      const u = z && M.najdiUzel(M.app.dok, z.id);
      if (u && u.druh === 'skica' && !u.zamceno) M.otevriSkicar(u.id);
    });
    new ResizeObserver(() => { if (okno.open) vykresli(); }).observe(svg);
    return st;
  };
})(MDL);
