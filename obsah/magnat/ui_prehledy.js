/* Dopravní magnát – přehledy v prohlížeči: grafy, noviny (archiv + karta), úspěchy, linky.
   Načítá se po ui_hra.js a před ui.js; háček U.poKroku obalí (novinové karty), okna staví přes U.okno. */
(function () {
  'use strict';
  const MAG = window.MAG, D = MAG.data, H = MAG.hra, P = MAG.prehledy;
  const U = MAG.UI;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const penize = n => (n < 0 ? '−' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('cs-CZ');
  const kratke = n => { const a = Math.abs(n); return (n < 0 ? '−' : '') + (a >= 1e6 ? (a / 1e6).toFixed(a >= 1e7 ? 0 : 1) + ' mil.' : a >= 1e3 ? Math.round(a / 1e3) + ' tis.' : Math.round(a)); };
  const MES = ['led', 'úno', 'bře', 'dub', 'kvě', 'čer', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];
  const datumText = (h, den) => { const d = H.datum(h, den); return `${d.den}. ${d.mesic}. ${d.rok}`; };
  const KLIC_USPECHU = 'webapp_hra_magnat_uspechy';

  // --- grafy (plátno, tenké značky, legenda + přímé popisky, tooltip s ukazatelem, tabulka) --------------------------
  const barvaRole = role => getComputedStyle(document.querySelector('.graf-koren') || document.body).getPropertyValue(role).trim() || '#888';
  /* g = { typ: 'cara' | 'sloupce', popisky: ['led 1950', …], serie: [{ nazev, role ('--serie-1'…), data: [čísla] }], format } */
  function graf(g) {
    const box = document.createElement('div'); box.className = 'graf-koren';
    if (g.serie.length > 1) {
      const leg = document.createElement('div'); leg.className = 'graf-legenda';
      leg.innerHTML = g.serie.map(s => `<span><i style="background:var(${s.role})"></i>${esc(s.nazev)}</span>`).join('');
      box.append(leg);
    }
    const obal = document.createElement('div'); obal.className = 'graf-plocha';
    const c = document.createElement('canvas'), tip = document.createElement('div'); tip.className = 'graf-tip'; tip.hidden = true;
    obal.append(c, tip); box.append(obal);
    const kresli = hover => {
      const W = obal.clientWidth || 320, Hh = 170, dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = W * dpr; c.height = Hh * dpr; c.style.width = W + 'px'; c.style.height = Hh + 'px';
      const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, Hh);
      const vse = g.serie.flatMap(s => s.data), mx = Math.max(1, ...vse), mn = Math.min(0, ...vse);
      const L = 52, R = g.typ === 'cara' && g.serie.length > 1 ? 78 : 10, T = 8, B = 22, pw = W - L - R, ph = Hh - T - B;
      const yy = v => T + ph - (v - mn) / (mx - mn || 1) * ph;
      const n = g.popisky.length;
      // osa a mřížka (nenápadné)
      x.font = '11px system-ui, sans-serif'; x.fillStyle = barvaRole('--text-muted'); x.strokeStyle = barvaRole('--graf-mrizka'); x.lineWidth = 1;
      x.textAlign = 'right'; x.textBaseline = 'middle';
      for (let k = 0; k <= 4; k++) { const v = mn + (mx - mn) * k / 4, py = Math.round(yy(v)) + 0.5; x.beginPath(); x.moveTo(L, py); x.lineTo(L + pw, py); x.stroke(); x.fillText(g.format(v), L - 6, py); }
      x.textAlign = 'center'; x.textBaseline = 'top';
      const krokPop = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 60))));
      const xc = i => g.typ === 'sloupce' ? L + (i + 0.5) * pw / n : L + (n > 1 ? i / (n - 1) : 0.5) * pw;
      for (let i = 0; i < n; i += krokPop) x.fillText(g.popisky[i], xc(i), T + ph + 6);
      if (mn < 0) { x.strokeStyle = barvaRole('--text-muted'); x.beginPath(); x.moveTo(L, Math.round(yy(0)) + 0.5); x.lineTo(L + pw, Math.round(yy(0)) + 0.5); x.stroke(); }
      if (g.typ === 'sloupce') {
        const sk = pw / n, sw = Math.max(2, (sk - 2) / g.serie.length - 2);
        g.serie.forEach((s, si) => {
          x.fillStyle = barvaRole(s.role);
          s.data.forEach((v, i) => {
            const bx = L + i * sk + 1 + si * (sw + 2), y0 = yy(0), y1 = yy(v), r = Math.min(4, sw / 2, Math.abs(y1 - y0));
            x.beginPath();
            if (x.roundRect) x.roundRect(bx, Math.min(y0, y1), sw, Math.abs(y1 - y0), v >= 0 ? [r, r, 0, 0] : [0, 0, r, r]); else x.rect(bx, Math.min(y0, y1), sw, Math.abs(y1 - y0));
            x.fill();
          });
        });
      } else {
        g.serie.forEach(s => {
          x.strokeStyle = barvaRole(s.role); x.lineWidth = 2; x.lineJoin = 'round'; x.beginPath();
          s.data.forEach((v, i) => x[i ? 'lineTo' : 'moveTo'](xc(i), yy(v))); x.stroke();
          // přímý popisek na konci čáry (jen u více řad)
          if (g.serie.length > 1 && s.data.length) { x.fillStyle = barvaRole('--text'); x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(s.nazev, L + pw + 6, yy(s.data[s.data.length - 1])); }
        });
      }
      if (hover !== null && hover >= 0 && hover < n) {
        const hx = xc(hover);
        x.strokeStyle = barvaRole('--text-muted'); x.setLineDash([3, 3]); x.beginPath(); x.moveTo(hx, T); x.lineTo(hx, T + ph); x.stroke(); x.setLineDash([]);
        if (g.typ === 'cara') g.serie.forEach(s => { x.fillStyle = barvaRole('--bg-elevated'); x.beginPath(); x.arc(hx, yy(s.data[hover]), 5, 0, Math.PI * 2); x.fill(); x.fillStyle = barvaRole(s.role); x.beginPath(); x.arc(hx, yy(s.data[hover]), 4, 0, Math.PI * 2); x.fill(); });
        tip.hidden = false;
        tip.innerHTML = `<b>${esc(g.popisky[hover])}</b>` + g.serie.map(s => `<div><i style="background:var(${s.role})"></i>${esc(s.nazev)}: <b>${esc(g.formatTip ? g.formatTip(s.data[hover]) : g.format(s.data[hover]))}</b></div>`).join('');
        tip.style.left = Math.min(W - 170, Math.max(0, hx + 10)) + 'px'; tip.style.top = '6px';
      } else tip.hidden = true;
      return { L, pw, n, xc };
    };
    let geo = null;
    requestAnimationFrame(() => { geo = kresli(null); });
    c.addEventListener('pointermove', ev => {
      if (!geo) return;
      const r = c.getBoundingClientRect(), px = ev.clientX - r.left;
      let nej = 0, nd = Infinity;
      for (let i = 0; i < geo.n; i++) { const d = Math.abs(geo.xc(i) - px); if (d < nd) { nd = d; nej = i; } }
      geo = kresli(nej);
    });
    c.addEventListener('pointerleave', () => { geo = kresli(null); });
    // tabulka (přístupnost; nahrazuje barvy u slabého kontrastu)
    const det = document.createElement('details'); det.className = 'graf-tabulka';
    det.innerHTML = `<summary>Tabulka</summary><div class="tab-obal"><table><tr><th></th>${g.serie.map(s => `<th class="cis">${esc(s.nazev)}</th>`).join('')}</tr>
      ${g.popisky.map((p, i) => `<tr><td>${esc(p)}</td>${g.serie.map(s => `<td class="cis">${esc((g.formatTip || g.format)(s.data[i]))}</td>`).join('')}</tr>`).reverse().join('')}</table></div>`;
    box.append(det);
    return box;
  }

  let rozsah = 24, zalozkaGrafu = 'penize';
  function oknoGrafy() {
    const h = U.hra, mes = h.fin.mesice.slice(rozsah ? -rozsah : 0);
    const tel = document.createElement('div');
    const zal = document.createElement('div'); zal.className = 'zalozky-oken';
    for (const [k, n] of [['penize', '💰 Peníze'], ['prijmy', '📊 Příjmy a výdaje'], ['preprava', '📦 Přeprava'], ['vykaz', '🧾 Výkaz']]) {
      const b = U.tlacitko(n, () => { zalozkaGrafu = k; oknoGrafy(); }); b.setAttribute('aria-pressed', String(k === zalozkaGrafu)); zal.append(b);
    }
    tel.append(zal);
    if (zalozkaGrafu !== 'vykaz') {
      const roz = document.createElement('div'); roz.className = 'zalozky-oken mala';
      for (const [k, n] of [[24, '2 roky'], [60, '5 let'], [0, 'vše']]) { const b = U.tlacitko(n, () => { rozsah = k; oknoGrafy(); }); b.setAttribute('aria-pressed', String(k === rozsah)); roz.append(b); }
      tel.append(roz);
    }
    const popisky = mes.map(x => `${MES[x.mesic - 1]} ${x.rok}`);
    if (zalozkaGrafu !== 'vykaz' && mes.length < 2) tel.append(Object.assign(document.createElement('p'), { textContent: 'Grafy se plní měsíc po měsíci – vrať se za pár měsíců hry.' }));
    else if (zalozkaGrafu === 'penize') {
      tel.append(Object.assign(document.createElement('div'), { className: 'graf-nadpis', textContent: 'Peníze na účtu' }));
      tel.append(graf({ typ: 'cara', popisky, serie: [{ nazev: 'Peníze', role: '--serie-1', data: mes.map(x => x.penize) }], format: kratke, formatTip: penize }));
      tel.append(Object.assign(document.createElement('div'), { className: 'graf-nadpis', textContent: 'Hodnota firmy (peníze − úvěr + vozidla)' }));
      tel.append(graf({ typ: 'cara', popisky, serie: [{ nazev: 'Hodnota firmy', role: '--serie-1', data: mes.map(x => x.hodnota) }], format: kratke, formatTip: penize }));
    } else if (zalozkaGrafu === 'prijmy') {
      tel.append(Object.assign(document.createElement('div'), { className: 'graf-nadpis', textContent: 'Příjmy a výdaje po měsících' }));
      tel.append(graf({ typ: 'sloupce', popisky, serie: [
        { nazev: 'Příjmy', role: '--serie-1', data: mes.map(x => x.prijmy || 0) },
        { nazev: 'Výdaje', role: '--serie-2', data: mes.map(x => x.vydaje || 0) }], format: kratke, formatTip: penize }));
    } else if (zalozkaGrafu === 'preprava') {
      // 4 nejvíc vožené náklady + Ostatní
      const suma = {};
      for (const x of mes) for (const [k, n] of Object.entries(x.preprava || {})) suma[k] = (suma[k] || 0) + n;
      const hlavni = Object.keys(suma).sort((a, b) => suma[b] - suma[a]).slice(0, 4);
      const serie = hlavni.map((k, i) => ({ nazev: D.NAKLADY_PODLE_ID[k].nazev, role: `--serie-${i + 1}`, data: mes.map(x => (x.preprava || {})[k] || 0) }));
      if (Object.keys(suma).length > 4) serie.push({ nazev: 'Ostatní', role: '--serie-ostatni', data: mes.map(x => Object.entries(x.preprava || {}).filter(([k]) => !hlavni.includes(k)).reduce((s, [, n]) => s + n, 0)) });
      tel.append(Object.assign(document.createElement('div'), { className: 'graf-nadpis', textContent: 'Přepraveno po měsících (jednotek nákladu)' }));
      if (!serie.length) tel.append(Object.assign(document.createElement('p'), { textContent: 'Zatím se nic nepřevezlo.' }));
      else tel.append(graf({ typ: 'cara', popisky, serie, format: v => kratke(v), formatTip: v => Math.round(v).toLocaleString('cs-CZ') }));
    } else {
      // roční výkaz za posledních až 5 let (z měsíčních záznamů + letošek)
      const roky = [...new Set(h.fin.mesice.map(x => x.rok))].slice(-5);
      const radky = roky.map(r => {
        const m = h.fin.mesice.filter(x => x.rok === r), pr = m.reduce((s, x) => s + (x.prijmy || 0), 0), vy = m.reduce((s, x) => s + (x.vydaje || 0), 0);
        const prep = {}; for (const x of m) for (const [k, n] of Object.entries(x.preprava || {})) prep[k] = (prep[k] || 0) + n;
        return { r, pr, vy, prep, mesicu: m.length };
      });
      const typy = [...new Set(radky.flatMap(x => Object.keys(x.prep)))];
      const t = document.createElement('div'); t.className = 'tab-obal';
      t.innerHTML = `<table class="fin"><tr><th></th>${radky.map(x => `<th class="cis">${x.r}${x.mesicu < 12 ? '*' : ''}</th>`).join('')}</tr>
        <tr><td>Příjmy</td>${radky.map(x => `<td class="cis">${penize(x.pr)}</td>`).join('')}</tr>
        <tr><td>Výdaje</td>${radky.map(x => `<td class="cis">${penize(-x.vy)}</td>`).join('')}</tr>
        <tr class="soucet"><td>Zisk</td>${radky.map(x => `<td class="cis ${x.pr - x.vy < 0 ? 'minus' : ''}">${penize(x.pr - x.vy)}</td>`).join('')}</tr>
        <tr><td>Odpisy vozidel</td>${radky.map(x => `<td class="cis">${(h.fin.odpisy || {})[x.r] !== undefined ? penize(-h.fin.odpisy[x.r]) : '–'}</td>`).join('')}</tr>
        <tr><td>Výsledek po odpisech</td>${radky.map(x => `<td class="cis">${(h.fin.odpisy || {})[x.r] !== undefined ? penize(x.pr - x.vy - h.fin.odpisy[x.r]) : '–'}</td>`).join('')}</tr>
        ${typy.map(k => `<tr><td>${U.ikN ? U.ikN(k, 16) : ''} ${esc(D.NAKLADY_PODLE_ID[k].nazev)}</td>${radky.map(x => `<td class="cis">${(x.prep[k] || 0).toLocaleString('cs-CZ')}</td>`).join('')}</tr>`).join('')}
      </table>${radky.some(x => x.mesicu < 12) ? '<small>* neúplný rok</small>' : ''}`;
      tel.append(t);
    }
    U.okno('grafy', '📊 Grafy a výkazy', tel, [10, 10]);
  }

  // --- noviny -----------------------------------------------------------------------------------------------
  const karty = [];
  function vyrocniHtml(h, n) {
    const v = n.vyrocni;
    const prep = Object.entries(v.preprava).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, x]) => `${U.ikN ? U.ikN(k, 16) : ''} ${x.toLocaleString('cs-CZ')}`).join(' &nbsp; ');
    return `<table class="fin">
      <tr><td>Příjmy</td><td class="cis">${penize(v.prijmy)}</td></tr><tr><td>Výdaje</td><td class="cis">${penize(-v.vydaje)}</td></tr>
      <tr class="soucet"><td>Zisk</td><td class="cis ${v.zisk < 0 ? 'minus' : ''}">${penize(v.zisk)}</td></tr>
      ${v.odpisy !== undefined ? `<tr><td>Odpisy vozidel</td><td class="cis">${penize(-v.odpisy)}</td></tr>` : ''}
      <tr><td>Hodnota firmy</td><td class="cis">${penize(v.hodnota)}</td></tr><tr><td>Vozidel</td><td class="cis">${v.vozidel}</td></tr></table>
      ${prep ? `<p>Přepraveno: ${prep}</p>` : ''}
      ${v.nejlepsi ? `<p>🏅 Nejlepší: <b>${esc(v.nejlepsi.jmeno)}</b> (${penize(v.nejlepsi.zisk)})</p>` : ''}
      ${v.nejhorsi ? `<p>⚠️ Ve ztrátě: <b>${esc(v.nejhorsi.jmeno)}</b> (${penize(v.nejhorsi.zisk)})</p>` : ''}`;
  }
  function ukazKartu(n) {
    karty.push(n);
    if (karty.length === 1) dalsiKarta();
  }
  function dalsiKarta() {
    const h = U.hra, n = karty[0];
    if (!n) return;
    const el = document.createElement('div'); el.className = 'noviny-karta' + (n.vyrocni ? ' vyrocni' : '');
    el.setAttribute('role', 'status');
    el.innerHTML = `<div class="nk-hlava"><span>${esc(h.firma.jmeno)} · ${esc(n.rubrika)}</span><span>${esc(datumText(h, n.den))}</span></div>
      <h3>${esc(n.titulek)}</h3>${n.vyrocni ? vyrocniHtml(h, n) : n.text && n.text !== n.titulek ? `<p>${esc(n.text)}</p>` : ''}
      <div class="nk-tl"></div>`;
    const tl = el.querySelector('.nk-tl');
    if (n.x !== undefined) tl.append(U.tlacitko('🎯 Ukázat', () => U.naPole(n.x, n.y)));
    if (n.vyrocni) tl.append(U.tlacitko('🧾 Výkaz', () => { zalozkaGrafu = 'vykaz'; oknoGrafy(); }));
    tl.append(U.tlacitko('Zavřít', () => zavri()));
    $('plocha').append(el);
    let pryc = false;
    const zavri = () => { if (pryc) return; pryc = true; el.classList.add('pryc'); setTimeout(() => { el.remove(); karty.shift(); dalsiKarta(); }, 300); };
    el.addEventListener('pointerenter', () => { el.dataset.drzim = 1; });
    setTimeout(function cas() { if (el.dataset.drzim && el.matches(':hover')) return setTimeout(cas, 1500); zavri(); }, n.vyrocni ? 14000 : 8000);
  }
  function oknoNoviny() {
    const h = U.hra, tel = document.createElement('div'); tel.className = 'noviny-archiv';
    const sez = (h.noviny || []).slice().reverse();
    if (!sez.length) tel.append(Object.assign(document.createElement('p'), { textContent: 'Zatím žádné zprávy. Noviny píšou o prvních spojích, nových modelech, podnicích, městech a úspěších.' }));
    for (const n of sez.slice(0, 80)) {
      const b = document.createElement('button'); b.className = 'clanek';
      b.innerHTML = `<small>${esc(datumText(h, n.den))} · ${esc(n.rubrika)}</small><b>${esc(n.titulek)}</b>${n.vyrocni ? `<span>Zisk ${penize(n.vyrocni.zisk)}, hodnota firmy ${penize(n.vyrocni.hodnota)}</span>` : n.text && n.text !== n.titulek ? `<span>${esc(n.text)}</span>` : ''}`;
      b.addEventListener('click', () => { if (n.vyrocni) { karty.length = 0; ukazKartu(n); } else if (n.vozidlo !== undefined && U.oknoVozidla) U.oknoVozidla(n.vozidlo); else if (n.x !== undefined) U.naPole(n.x, n.y); });
      tel.append(b);
    }
    U.okno('noviny', `📰 Noviny (${sez.length})`, tel, [10, 10]);
  }

  // --- úspěchy ------------------------------------------------------------------------------------------------
  function globalni() { try { return JSON.parse(localStorage.getItem(KLIC_USPECHU) || '{}'); } catch (e) { return {}; } }
  function ulozGlobalni(id) { const g = globalni(); if (g[id]) return; g[id] = Date.now(); try { localStorage.setItem(KLIC_USPECHU, JSON.stringify(g)); } catch (e) { /* bez úložiště */ } }
  function oknoUspechy() {
    const h = U.hra, g = globalni(), tel = document.createElement('div');
    const hotovo = P.USPECHY.filter(u => h.uspechy && h.uspechy[u.id] !== undefined).length;
    tel.innerHTML = `<p class="uspechy-souhrn">V této hře <b>${hotovo} / ${P.USPECHY.length}</b> · ve všech hrách ${Object.keys(g).length}</p>`;
    const mriz = document.createElement('div'); mriz.className = 'uspechy';
    for (const u of P.USPECHY) {
      const den = h.uspechy && h.uspechy[u.id], kdy = den !== undefined ? datumText(h, den) : g[u.id] ? 'v jiné hře' : '';
      const d = document.createElement('div'); d.className = 'uspech' + (den !== undefined ? ' splneno' : g[u.id] ? ' jinde' : '');
      d.innerHTML = `<span class="u-ik">${u.ikona}</span><b>${esc(u.nazev)}</b><small>${esc(u.popis)}</small>${kdy ? `<small class="kdy">✓ ${esc(kdy)}</small>` : ''}`;
      mriz.append(d);
    }
    tel.append(mriz);
    U.okno('uspechy', '🏆 Úspěchy', tel, [10, 10]);
  }

  // --- linky ------------------------------------------------------------------------------------------------
  function oknoLinky() {
    const h = U.hra, tel = document.createElement('div'); tel.className = 'seznam';
    const l = P.linky(h);
    if (!l.length) tel.append(Object.assign(document.createElement('p'), { textContent: 'Žádné linky – vozidla se stejnými rozkazy tvoří linku.' }));
    const IK = { bus: '🚌', nakl: '🚚', vlak: '🚂', lod: '⛴️', let: '✈️' };
    for (const x of l) {
      const jm = x.stanice.map(s => h.stanice[s] ? h.stanice[s].jmeno : '?').join(' → ');
      const b = U.tlacitko('', () => U.oknoVozidla(x.vozidla[0]));
      b.innerHTML = `<span>${IK[x.druh] || ''} ${esc(jm)}<br><small>${x.vozidla.length}× vozidlo</small></span><small class="${x.loni < 0 ? 'minus' : ''}">${penize(x.letos)}<br>${penize(x.loni)}</small>`;
      tel.append(b);
    }
    U.okno('linky', `🚏 Linky (${l.length}) – zisk letos / loni`, tel, [10, 10]);
  }

  // --- háček: novinové karty a úspěchy --------------------------------------------------------------------------
  const puvodni = U.poKroku;
  U.poKroku = (h, novyDen) => {
    for (const z of h.zpravy) if (z.noviny) { ukazKartu(z.noviny); if (z.noviny.uspech) ulozGlobalni(z.noviny.uspech); }
    if (puvodni) puvodni(h, novyDen);
  };
  $('miGrafy').addEventListener('click', oknoGrafy);
  $('miNoviny').addEventListener('click', oknoNoviny);
  $('miUspechy').addEventListener('click', oknoUspechy);
  $('miLinky').addEventListener('click', oknoLinky);
  Object.assign(U, { oknoGrafy, oknoNoviny, oknoUspechy, oknoLinky, ukazKartu });
})();
