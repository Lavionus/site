/* Tréninkový případ – rozhraní: stůl se spisem, záložky dokumentů, výběr výroků,
   rozpory, třídění, poznámky, nápovědy, závěr, rozbor, tabulka výsledků a režim lektora.
   Logika a bodování jsou v jadro.js (TPJADRO), data v pripady.js (TP_PRIPADY). */
(function () {
  'use strict';
  const J = window.TPJADRO, PRIPADY = window.TP_PRIPADY;
  const KLIC_HRA = 'webapp_treninkovy_pripad_hra';
  const KLIC_NAST = 'webapp_treninkovy_pripad_nast';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const zkrat = (s, n = 90) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  if (window.self === window.top) document.body.classList.add('samostatne');

  /* úložiště s ochranou (soukromé okno, zablokovaná data) */
  const LS = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* plné nebo zakázané */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* nic */ } }
  };
  const uloziste = {
    getItem: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    setItem: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { Dialog.chyba('Výsledek se nepodařilo uložit (úložiště prohlížeče je nedostupné).'); } },
    removeItem: k => { try { localStorage.removeItem(k); } catch (e) { /* nic */ } }
  };

  /* rozehraná hra z úložiště: doplnit chybějící pole a zahodit odkazy na výroky/dokumenty, které v datech nejsou
     (poškozené úložiště nebo hra uložená před úpravou případu) – jinak by vykreslení spadlo */
  function obnovHru(h) {
    const p = h && typeof h === 'object' && PRIPADY.find(x => x.id === h.pripad);
    if (!p) return null;
    const V = J.index(p), objekt = o => (o && typeof o === 'object' && !Array.isArray(o) ? o : {});
    const jenVyroky = o => Object.fromEntries(Object.entries(objekt(o)).filter(([id]) => V.has(id)));
    const pole = a => (Array.isArray(a) ? a : []), dok = id => !!J.dokument(p, id);
    const n = {
      pripad: p.id, hrac: String(h.hrac || 'Anonym').slice(0, 40), start: Number.isFinite(h.start) ? h.start : Date.now(),
      rozpory: pole(h.rozpory).filter(r => Array.isArray(r) && r.length === 2 && V.has(r[0]) && V.has(r[1]) && r[0] !== r[1]),
      trideni: Object.fromEntries(Object.entries(jenVyroky(h.trideni)).filter(([, d]) => d === 'o' || d === 't')),
      zvyrazneni: Object.fromEntries(Object.entries(jenVyroky(h.zvyrazneni)).filter(([, z]) => [1, 2, 3].includes(z))),
      poznamky: Object.fromEntries(Object.entries(jenVyroky(h.poznamky)).map(([id, t]) => [id, String(t).slice(0, 300)])),
      napovedy: Object.fromEntries(Object.entries(objekt(h.napovedy)).filter(([id, s]) => p.rozpory.some(r => r.id === id) && [1, 2, 3].includes(s))),
      napovedyText: pole(h.napovedyText).filter(x => x && typeof x.text === 'string').map(x => ({ rozpor: x.rozpor, stupen: +x.stupen || 1, text: x.text, vyrok: V.has(x.vyrok) ? x.vyrok : null })),
      zaver: Object.fromEntries(Object.entries(objekt(h.zaver)).map(([q, o]) => [q, { odp: typeof objekt(o).odp === 'string' ? o.odp : null, dukazy: pole(objekt(o).dukazy).filter(id => V.has(id)).slice(0, 3) }])), otevrene: pole(h.otevrene).filter(dok), precteno: pole(h.precteno).filter(dok),
      aktivni: dok(h.aktivni) ? h.aktivni : 'stul', rozA: V.has(h.rozA) ? h.rozA : null,
      lektor: !!h.lektor, hotovo: !!h.hotovo, casMs: Number.isFinite(h.casMs) ? h.casMs : 0, zaznam: h.zaznam && typeof h.zaznam === 'object' ? h.zaznam : null
    };
    if (n.aktivni !== 'stul' && !n.otevrene.includes(n.aktivni)) n.otevrene.push(n.aktivni);
    return n;
  }
  let hra = obnovHru(LS.get(KLIC_HRA));
  let vybrany = null;
  let startPripad = (LS.get(KLIC_NAST) || {}).pripad || PRIPADY[0].id;

  /* hlavní plocha: spis, výběr případu, nebo rozbor */
  function ukaz(co) {
    $('plocha').hidden = co !== 'plocha';
    $('start').hidden = co !== 'start';
    $('rozbor').hidden = co !== 'rozbor';
  }
  const pripad = () => PRIPADY.find(p => p.id === hra.pripad);
  const uloz = () => { if (hra) LS.set(KLIC_HRA, hra); };
  const casHry = () => (hra ? (hra.hotovo ? hra.casMs : Date.now() - hra.start) : 0);
  const maPostup = () => hra && !hra.hotovo && (hra.rozpory.length || Object.keys(hra.zvyrazneni).length || Object.keys(hra.trideni).length || Object.keys(hra.poznamky).length);

  function novaHra(idPripadu, hrac) {
    hra = {
      pripad: idPripadu, hrac, start: Date.now(), rozpory: [], trideni: {}, zvyrazneni: {}, poznamky: {},
      napovedy: {}, napovedyText: [], zaver: {}, otevrene: [], aktivni: 'stul', precteno: [], rozA: null,
      lektor: false, hotovo: false, casMs: 0, zaznam: null
    };
    vybrany = null;
    LS.set(KLIC_NAST, { pripad: idPripadu });
    uloz();
  }

  /* ---------- ilustrace k fotodokumentaci (vlastní SVG) ---------- */
  const A = 'style="stroke:var(--accent)"';
  const SVG = {
    zamek: `<path d="M10 70 C40 40 60 80 78 55"/><path d="M90 50 C110 30 130 70 150 40"/><path d="M76 52 l6 6 M88 47 l6 6" ${A}/><rect x="120" y="58" width="26" height="22" rx="4"/><circle cx="133" cy="69" r="3"/><path d="M10 90 h100" ${A}/><path d="M10 86 v8 M35 88 v4 M60 86 v8 M85 88 v4 M110 86 v8" ${A}/>`,
    stojan: `<path d="M15 85 h130"/><path d="M30 85 V45 a10 10 0 0 1 20 0 V85 M70 85 V45 a10 10 0 0 1 20 0 V85 M110 85 V45 a10 10 0 0 1 20 0 V85"/><circle cx="120" cy="62" r="20" ${A}/><circle cx="120" cy="62" r="3" ${A}/><path d="M52 58 h16" stroke-dasharray="3 3"/>`,
    kleste: `<path d="M20 85 L80 45 M40 90 L82 52"/><path d="M80 45 L120 20 L140 22 L118 36 Z M82 52 L126 40 L144 32 L128 50 Z" ${A}/><circle cx="82" cy="49" r="4"/><path d="M20 85 l-6 4 M40 90 l-4 6"/>`,
    okno: `<rect x="35" y="15" width="90" height="70"/><path d="M80 15 v70 M35 50 h90"/><path d="M122 40 l10 -4 l2 10 l-10 3" ${A}/><path d="M128 44 L155 85" ${A} stroke-width="4"/><path d="M118 30 l6 4 l-4 6" stroke-dasharray="2 2"/>`,
    slapota: `<path d="M40 20 C70 10 85 25 82 45 C80 60 72 70 70 85 C68 95 45 95 42 85 C38 70 25 55 28 38 C30 28 34 22 40 20 Z"/><path d="M40 32 l10 6 l10 -6 l10 6 M38 44 l10 6 l10 -6 l10 6 M40 56 l10 6 l10 -6 M44 70 l8 5 l8 -5 M46 82 l8 4 l8 -4" ${A}/><path d="M110 10 v85" ${A}/><path d="M106 10 h8 M106 30 h8 M106 50 h8 M106 70 h8 M106 90 h8" ${A}/>`,
    pneu: `<path d="M10 30 h140 M10 70 h140"/><path d="M15 30 l8 40 M35 30 l8 40 M55 30 l8 40 M75 30 l8 40 M95 30 l8 40 M115 30 l8 40 M135 30 l8 40" ${A}/><path d="M10 50 h140" stroke-dasharray="4 4"/>`,
    trezor: `<rect x="30" y="15" width="70" height="75" rx="4"/><path d="M100 20 L135 30 V85 L100 88" ${A}/><rect x="42" y="28" width="46" height="26" rx="2"/><path d="M48 66 h6 M60 66 h6 M72 66 h6 M48 76 h6 M60 76 h6 M72 76 h6"/><circle cx="125" cy="58" r="4" ${A}/>`,
    rukavice: `<path d="M50 90 V55 L42 30 a5 5 0 0 1 9 -3 L60 48 V18 a5 5 0 0 1 10 0 V45 V14 a5 5 0 0 1 10 0 V45 V18 a5 5 0 0 1 10 0 V50 V28 a5 5 0 0 1 10 0 V68 C110 80 100 90 95 90 Z"/><path d="M52 80 h44" ${A}/><text x="74" y="77" font-size="8" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif">ŠTĚPÁNEK</text><path d="M15 95 h130" stroke-dasharray="3 4"/>`,
    regal: `<rect x="20" y="10" width="120" height="80"/><path d="M20 37 h120 M20 64 h120 M60 10 v80 M100 10 v80"/><path d="M110 58 V46 l-3 -8 a2 2 0 0 1 4 -1 l3 6 V36 a2 2 0 0 1 4 0 V45 V35 a2 2 0 0 1 4 0 V46 V38 a2 2 0 0 1 4 0 V58 Z" ${A}/><path d="M66 58 h28" stroke-dasharray="2 3"/>`
  };
  const svg = n => `<svg viewBox="0 0 160 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SVG[n] || ''}</svg>`;

  /* ---------- výroky ---------- */
  let reseniIds = new Set();
  function znacky(id) {
    const t = hra.trideni[id], pz = hra.poznamky[id];
    const nR = hra.rozpory.filter(r => r.includes(id)).length;
    let s = '';
    if (t) s += `<b title="${t === 'o' ? 'označeno jako ověřené' : 'označeno jako tvrzení'}">${t === 'o' ? '✔ ověř.' : '💬 tvrz.'}</b> `;
    if (nR) s += `<span title="součástí ${nR} tvých rozporů">⚡${nR > 1 ? nR : ''}</span> `;
    if (pz) s += `<span title="${esc(pz)}">📌</span>`;
    return s ? `<span class="znk">${s}</span>` : '';
  }
  function tridy(id) {
    const c = ['v'];
    const z = hra.zvyrazneni[id];
    if (z) c.push('zv' + z);
    if (id === vybrany) c.push('sel');
    if (id === hra.rozA) c.push('stranaA');
    if (reseniIds.has(id)) c.push('reseni');
    return c.join(' ');
  }
  const vSpan = v => `<span class="${tridy(v[0])}" data-v="${v[0]}" tabindex="0" role="button">${esc(v[1])}</span>${znacky(v[0])}`;

  function htmlDokumentu(d) {
    const T = J.TYPY[d.typ];
    let h = `<article class="dokument"><div class="dhlava"><span class="typ">${T.ikona} ${esc(T.nazev)}</span><h2>${esc(d.nazev)}</h2><span class="dt">${esc(d.datum || '')}</span></div>`;
    if (d.hlava) h += '<dl>' + d.hlava.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('') + '</dl>';
    for (const odst of d.text || []) {
      if (odst.some(v => v[3])) h += odst.map(v => `<div class="foto">${svg(v[3])}<div>${vSpan(v)}</div></div>`).join('');
      else h += '<p>' + odst.map(vSpan).join(' ') + '</p>';
    }
    if (d.tabulka) {
      const t = d.tabulka;
      h += '<div class="tabobal"><table><thead><tr>' + t.sloupce.map(s => `<th>${esc(s)}</th>`).join('') + '</tr></thead><tbody>';
      for (const [id, bunky] of t.radky) {
        h += `<tr class="${tridy(id)}" data-v="${id}" tabindex="0">` + bunky.map((b, i) => `<td${i === t.cas ? ' class="cas"' : ''}>${esc(b)}${i === bunky.length - 1 ? znacky(id) : ''}</td>`).join('') + '</tr>';
      }
      h += '</tbody></table></div>';
    }
    if (d.pozn) h += '<p>' + d.pozn.map(vSpan).join(' ') + '</p>';
    return h + '</article>';
  }

  /* ---------- vykreslení ---------- */
  function render() {
    if (!hra) return;
    const p = pripad();
    $('nazevPripadu').textContent = p.nazev;
    $('tlOdevzdat').disabled = hra.hotovo;
    $('tlNapoveda').disabled = hra.hotovo;
    $('tlRozbor').hidden = !hra.hotovo;
    renderZalozky(); renderObsah(); renderPanel(); tik();
  }
  function renderZalozky() {
    const p = pripad();
    let h = `<button class="zal" role="tab" data-zal="stul" aria-selected="${hra.aktivni === 'stul'}">🗂️ <span class="n">Stůl</span></button>`;
    for (const id of hra.otevrene) {
      const d = J.dokument(p, id);
      h += `<button class="zal" role="tab" data-zal="${id}" aria-selected="${hra.aktivni === id}" title="${esc(d.nazev)}">${J.TYPY[d.typ].ikona} <span class="n">${esc(d.nazev)}</span><span class="zavri" data-zavri-zal="${id}" role="button" aria-label="Zavřít">✕</span></button>`;
    }
    $('zalozky').innerHTML = h;
  }
  function renderObsah() {
    const p = pripad(), o = $('obsah');
    if (hra.aktivni === 'stul') {
      let h = `<div class="zadani"><div class="znacka">Č. j. ${esc(p.znacka)} · ${'★'.repeat(p.obtiznost)}${'☆'.repeat(3 - p.obtiznost)} · limit ${p.limitMin} min</div><h2>${esc(p.nazev)}</h2><p>${esc(p.uvod)}</p>
        <ul>${p.osoby.map(([j, r]) => `<li><b>${esc(j)}</b> – ${esc(r)}</li>`).join('')}</ul>
        <p class="ukol">Úkol: najdi rozpory ⚡, roztřiď výroky na ověřené ✔ a tvrzení 💬, zvýrazni si důkazy 🖍️ a pak ✅ odevzdej závěr. Hráč: <b>${esc(hra.hrac)}</b>${hra.lektor ? ' · <span class="stav-pul">viděl řešení</span>' : ''}</p></div>`;
      h += '<div class="stul">' + p.dokumenty.map(d => {
        const T = J.TYPY[d.typ];
        return `<button class="karta" data-dok="${d.id}"><span class="ik">${T.ikona}</span><span class="typ">${esc(T.nazev)}</span><span class="nz">${esc(d.nazev)}</span><span class="dt">${esc(d.datum || '')}</span>${hra.precteno.includes(d.id) ? '<span class="precteno">✓ otevřeno</span>' : ''}</button>`;
      }).join('') + '</div>';
      o.innerHTML = h;
    } else {
      o.innerHTML = '<p class="navod">Klikni na větu nebo řádek – akce najdeš v panelu.</p>' + htmlDokumentu(J.dokument(p, hra.aktivni));
    }
  }
  function prekresliDokument() {
    const top = $('obsah').scrollTop;
    renderObsah();
    $('obsah').scrollTop = top;
  }
  function renderPanel() {
    const p = pripad();
    // výběr
    const vy = $('vyber');
    let h = '';
    if (hra.rozA && !hra.hotovo) {
      const a = J.vyrok(p, hra.rozA);
      h += `<div class="strA">⚡ <b>1. strana rozporu:</b> „${esc(zkrat(a.text, 120))}“<br><span class="mini-text">Teď vyber výrok, který mu odporuje.</span><br><button class="btn mini" data-akce="zrusA">Zrušit</button></div>`;
    }
    if (hra.hotovo) {
      h += '<p class="prazdno">Případ je odevzdaný. Výsledek najdeš v menu 📁 → 📊 Rozbor; spis si můžeš dál prohlížet.</p>';
    } else if (!vybrany) {
      h += '<h3>🖱️ Výběr</h3><p class="prazdno">Otevři dokument a klikni na větu nebo řádek tabulky.</p>';
    } else {
      const v = J.vyrok(p, vybrany), t = hra.trideni[vybrany];
      const muzeSpojit = hra.rozA && hra.rozA !== vybrany;
      h += `<h3>🖱️ Vybraný výrok <button class="btn mini" data-akce="zrusVyber" aria-label="Zrušit výběr">✕</button></h3>
        <div class="text">${esc(v.text)}</div><div class="zdroj">${J.TYPY[v.dokument.typ].ikona} ${esc(v.dokument.nazev)}${hra.poznamky[vybrany] ? ' · 📌 ' + esc(hra.poznamky[vybrany]) : ''}</div>
        <div class="akce">
          ${muzeSpojit ? '<button class="btn primary" data-akce="spoj">⚡ Spojit jako rozpor</button>' : `<button class="btn" data-akce="rozA"${hra.rozA === vybrany ? ' disabled' : ''}>⚡ Rozpor – 1. strana</button>`}
          <button class="btn" data-akce="zvyrazni" title="Opakovaným klikem měníš barvu, nakonec zrušíš">🖍️ ${hra.zvyrazneni[vybrany] ? 'Barva' : 'Zvýraznit'}</button>
          <button class="btn" data-akce="trid" data-druh="o" aria-pressed="${t === 'o'}" title="Ověřené zjištění (záznam, měření, doklad)">✔ Ověřené</button>
          <button class="btn" data-akce="trid" data-druh="t" aria-pressed="${t === 't'}" title="Tvrzení osoby">💬 Tvrzení</button>
          <button class="btn" data-akce="poznamka">📌 ${hra.poznamky[vybrany] ? 'Upravit pozn.' : 'Poznámka'}</button>
        </div>`;
    }
    vy.innerHTML = h;
    vy.classList.toggle('ma', !!(vybrany || hra.rozA) && !hra.hotovo);

    // rozpory
    $('pocetRozporu').textContent = hra.rozpory.length ? `(${hra.rozpory.length})` : '';
    $('seznamRozporu').innerHTML = hra.rozpory.length ? hra.rozpory.map(([a, b], i) => {
      const va = J.vyrok(p, a), vb = J.vyrok(p, b);
      return `<li><span class="t" data-skoc="${a}">„${esc(zkrat(va.text, 70))}“<span class="vs">⚡ × ${esc(vb.dokument.nazev)}</span>„${esc(zkrat(vb.text, 70))}“</span>${hra.hotovo ? '' : `<button class="x" data-smaz-rozpor="${i}" aria-label="Smazat rozpor" title="Smazat">✕</button>`}</li>`;
    }).join('') : '<li class="prazdno" style="border:0;background:none;padding:0">Zatím žádné. Vyber výrok a zvol „⚡ Rozpor – 1. strana“.</li>';

    // zvýraznění, třídění, poznámky
    const ids = [...J.index(p).keys()].filter(id => hra.zvyrazneni[id] || hra.poznamky[id] || hra.trideni[id]);
    const nT = Object.keys(hra.trideni).length;
    $('pocetPozn').textContent = ids.length ? `(${ids.length}${nT ? ', roztříděno ' + nT : ''})` : '';
    $('seznamPozn').innerHTML = ids.length ? ids.map(id => {
      const v = J.vyrok(p, id);
      return `<li><span class="t" data-skoc="${id}">${hra.zvyrazneni[id] ? '🖍️ ' : ''}${esc(zkrat(v.text, 80))}<span class="vs">${esc(v.dokument.nazev)}${hra.trideni[id] ? ' · ' + (hra.trideni[id] === 'o' ? '✔ ověřené' : '💬 tvrzení') : ''}${hra.poznamky[id] ? ' · 📌 ' + esc(hra.poznamky[id]) : ''}</span></span></li>`;
    }).join('') : '<li class="prazdno" style="border:0;background:none;padding:0">Zvýrazněné výroky ti při odevzdání poslouží jako důkazy.</li>';

    // nápovědy
    const cena = Object.values(hra.napovedy).reduce((s, n) => s + J.BODY.napoveda.slice(0, n).reduce((x, y) => x + y, 0), 0);
    $('pocetNapoved').textContent = hra.napovedyText.length ? `(−${cena} b.)` : '';
    $('seznamNapoved').innerHTML = hra.napovedyText.length ? hra.napovedyText.map(n => `<li><span class="t"${n.vyrok ? ` data-skoc="${n.vyrok}"` : ''}><b>${n.stupen}.</b> ${esc(n.text)}</span></li>`).join('') : '<li class="prazdno" style="border:0;background:none;padding:0">Nápověda 💡 stojí 1, 2 a 4 body podle stupně.</li>';
  }

  /* ---------- hodiny ---------- */
  function tik() {
    if (!hra) { $('hodiny').textContent = '⏱ 0:00'; return; }
    const ms = casHry();
    $('hodiny').textContent = '⏱ ' + J.formatCas(ms);
    $('hodiny').classList.toggle('pres', ms > pripad().limitMin * 60000);
  }
  setInterval(tik, 1000);

  /* ---------- práce se spisem ---------- */
  function otevriDok(id, vid) {
    if (!hra.otevrene.includes(id)) hra.otevrene.push(id);
    if (!hra.precteno.includes(id)) hra.precteno.push(id);
    hra.aktivni = id;
    uloz(); renderZalozky(); renderObsah();
    $('obsah').scrollTop = 0;
    if (vid) {
      const el = document.querySelector(`#obsah [data-v="${vid}"]`);
      if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('blik'); setTimeout(() => el.classList.remove('blik'), 3200); }
    }
  }
  function vyber(id) {
    vybrany = id;
    prekresliDokument(); renderPanel();
  }
  function skocNa(id) {
    const v = J.vyrok(pripad(), id);
    vybrany = id;
    otevriDok(v.doc, id);
    renderPanel();
  }
  function zmena() { uloz(); prekresliDokument(); renderPanel(); }

  const AKCE = {
    zrusVyber() { vybrany = null; prekresliDokument(); renderPanel(); },
    zrusA() { hra.rozA = null; zmena(); },
    rozA() { hra.rozA = vybrany; zmena(); },
    spoj() {
      const a = hra.rozA, b = vybrany;
      const k = J.klicParu(a, b);
      if (hra.rozpory.some(([x, y]) => J.klicParu(x, y) === k)) { Dialog.info('Tuhle dvojici už máš zapsanou.'); hra.rozA = null; return zmena(); }
      hra.rozpory.push([a, b]);
      hra.rozA = null;
      zmena();
      Dialog.info(`⚡ Rozpor zapsán (celkem ${hra.rozpory.length}). Vyhodnotí se po odevzdání.`);
    },
    zvyrazni() { const z = ((hra.zvyrazneni[vybrany] || 0) + 1) % 4; if (z) hra.zvyrazneni[vybrany] = z; else delete hra.zvyrazneni[vybrany]; zmena(); },
    trid(b) { const d = b.dataset.druh; if (hra.trideni[vybrany] === d) delete hra.trideni[vybrany]; else hra.trideni[vybrany] = d; zmena(); },
    async poznamka() {
      const id = vybrany;
      const t = await Dialog.zeptej('Poznámka k výroku (prázdná = smazat):', hra.poznamky[id] || '', { ok: 'Uložit' });
      if (t == null) return;
      if (t.trim()) hra.poznamky[id] = t.trim().slice(0, 300); else delete hra.poznamky[id];
      zmena();
    }
  };

  $('obsah').addEventListener('click', e => {
    const k = e.target.closest('[data-dok]');
    if (k) return otevriDok(k.dataset.dok);
    const v = e.target.closest('[data-v]');
    if (v) vyber(v.dataset.v);
  });
  $('obsah').addEventListener('keydown', e => {
    const v = e.target.closest('[data-v]');
    if (v && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); vyber(v.dataset.v); }
  });
  $('zalozky').addEventListener('click', e => {
    const z = e.target.closest('[data-zavri-zal]');
    if (z) {
      e.stopPropagation();
      const id = z.dataset.zavriZal;
      hra.otevrene = hra.otevrene.filter(x => x !== id);
      if (hra.aktivni === id) hra.aktivni = hra.otevrene[hra.otevrene.length - 1] || 'stul';
      uloz(); renderZalozky(); renderObsah();
      return;
    }
    const b = e.target.closest('[data-zal]');
    if (b) { hra.aktivni = b.dataset.zal; uloz(); renderZalozky(); renderObsah(); $('obsah').scrollTop = 0; }
  });
  $('panel').addEventListener('click', e => {
    const a = e.target.closest('[data-akce]');
    if (a && !hra.hotovo) return AKCE[a.dataset.akce](a);
    if (a && a.dataset.akce === 'zrusVyber') return AKCE.zrusVyber();
    const s = e.target.closest('[data-smaz-rozpor]');
    if (s) { hra.rozpory.splice(+s.dataset.smazRozpor, 1); return zmena(); }
    const j = e.target.closest('[data-skoc]');
    if (j) skocNa(j.dataset.skoc);
  });

  /* ---------- nápověda po stupních ---------- */
  async function napoveda() {
    if (!hra || hra.hotovo) return;
    const n = J.dalsiNapoveda(pripad(), hra);
    if (!n) return Dialog.info('Další nápověda už není – všechny rozpory máš označené nebo nápovědy vyčerpané.');
    if (!await Dialog.potvrd(`💡 Nápověda ${n.stupen}. stupně stojí ${n.cena} ${n.cena === 1 ? 'bod' : 'body'}. Zobrazit?`, { ok: 'Zobrazit' })) return;
    hra.napovedy[n.rozpor] = n.stupen;
    hra.napovedyText.push({ rozpor: n.rozpor, stupen: n.stupen, text: n.text, vyrok: n.vyrok });
    uloz();
    if (n.vyrok) skocNa(n.vyrok); else renderPanel();
    Dialog.info('💡 ' + n.text);
  }

  /* ---------- závěr a odevzdání ---------- */
  function kandidati() {
    const p = pripad();
    const vRozporech = new Set(hra.rozpory.flat());
    return [...J.index(p).values()].filter(v => hra.zvyrazneni[v.id] || hra.poznamky[v.id] || hra.trideni[v.id] || vRozporech.has(v.id));
  }
  function odevzdat() {
    if (!hra || hra.hotovo) return;
    const p = pripad(), kand = kandidati();
    let h = `<p>Odpověz na otázky a ke každé vyber až 3 důkazy ze svých označených výroků (zvýrazněné, roztříděné, s poznámkou nebo v rozporech). Rozporů máš zapsáno: <b>${hra.rozpory.length}</b>.</p>`;
    if (!kand.length) h += '<p class="stav-pul">Zatím nemáš označené žádné výroky – důkazy nepůjde vybrat. Můžeš se vrátit do spisu a zvýraznit si je.</p>';
    for (const q of p.zaver) {
      const o = hra.zaver[q.id] || {};
      h += `<div class="otazka" data-q="${q.id}"><b>${esc(q.otazka)}</b>` +
        q.moznosti.map(([id, t]) => `<label><input type="radio" name="q_${q.id}" value="${id}"${o.odp === id ? ' checked' : ''}><span>${esc(t)}</span></label>`).join('');
      if (kand.length) {
        h += `<details${(o.dukazy || []).length ? ' open' : ''}><summary>Důkazy (vybráno ${(o.dukazy || []).length} / 3)</summary><div class="dukazy">` +
          kand.map(v => `<label><input type="checkbox" value="${v.id}"${(o.dukazy || []).includes(v.id) ? ' checked' : ''}><span>${esc(zkrat(v.text, 110))} <small>– ${esc(v.dokument.nazev)}</small></span></label>`).join('') + '</div></details>';
      }
      h += '</div>';
    }
    $('zaverTelo').innerHTML = h;
    $('zaverTelo').querySelectorAll('.otazka').forEach(hlidejDukazy);
    $('dlgZaver').showModal();
  }
  function hlidejDukazy(div) {
    const boxy = [...div.querySelectorAll('.dukazy input')];
    const obnov = () => {
      const n = boxy.filter(b => b.checked).length;
      boxy.forEach(b => { b.disabled = !b.checked && n >= 3; });
      const s = div.querySelector('summary');
      if (s) s.textContent = `Důkazy (vybráno ${n} / 3)`;
    };
    boxy.forEach(b => b.addEventListener('change', obnov));
    obnov();
  }
  function prectiZaver() {
    for (const div of $('zaverTelo').querySelectorAll('.otazka')) {
      const r = div.querySelector('input[type=radio]:checked');
      hra.zaver[div.dataset.q] = { odp: r ? r.value : null, dukazy: [...div.querySelectorAll('.dukazy input:checked')].map(b => b.value) };
    }
    uloz();
  }
  $('dlgZaver').addEventListener('close', () => { if (hra && !hra.hotovo && $('zaverTelo').children.length) prectiZaver(); });
  $('zaverOdevzdej').addEventListener('click', async () => {
    prectiZaver();
    const p = pripad();
    const bez = p.zaver.filter(q => !(hra.zaver[q.id] || {}).odp).length;
    const txt = (bez ? `Na ${bez} ${bez === 1 ? 'otázku' : 'otázky'} jsi neodpověděl. ` : '') + 'Odevzdat? Potom už nepůjde nic měnit.';
    if (!await Dialog.potvrd(txt, { ok: 'Odevzdat' })) return;
    hra.casMs = Date.now() - hra.start;
    hra.hotovo = true;
    hra.rozA = null; vybrany = null;
    const v = J.hodnot(p, hra, hra.casMs);
    hra.zaznam = J.ulozVysledek(uloziste, { jmeno: hra.hrac, pripad: p.id, body: v.body, max: v.max, procenta: v.procenta, casMs: hra.casMs, lektor: hra.lektor });
    uloz();
    $('zaverTelo').innerHTML = '';
    $('dlgZaver').close();
    render();
    ukazRozbor();
  });

  /* ---------- rozbor ---------- */
  function ukazRozbor() {
    if (!hra || !hra.hotovo) return;
    const p = pripad(), v = J.hodnot(p, hra, hra.casMs);
    const vse = J.nactiVysledky(uloziste);
    const por = hra.zaznam ? J.poradi(vse, hra.zaznam) : 0, celkem = vse.filter(x => x.pripad === p.id).length;
    const txt = id => { const x = J.vyrok(p, id); return x ? `„${esc(zkrat(x.text, 160))}“ <small>(${esc(x.dokument.nazev)})</small>` : ''; };
    const nalez = v.rozpory.filter(r => r.nalezen).length;
    const S = v.slozky;
    let h = `<div class="vysl-hlava"><div class="skore">${v.body}<small> / ${v.max}</small></div><div class="info">
      <div class="hodn">${esc(v.hodnoceni)}</div>
      <div><b>${esc(hra.hrac)}</b> · ${esc(p.nazev)} · ${'★'.repeat(p.obtiznost)} · ${v.procenta} % · čas ${J.formatCas(hra.casMs)}${por ? ` · ${por}. místo z ${celkem}` : ''}</div>
      ${hra.lektor ? '<div class="stav-pul">Během řešení bylo zobrazeno řešení – výsledek je v tabulce zařazen na konec.</div>' : ''}
      </div></div>
      <div class="tlac-rozbor"><button class="btn primary" data-prikaz="novyHrac">🧑 Nový hráč</button><button class="btn" data-prikaz="vysledky">🏆 Tabulka výsledků</button><button class="btn" data-prikaz="tisk">🖨️ Tisk výsledku</button><button class="btn" data-prikaz="zpetSpis">🗂️ Prohlédnout spis s vyznačenými rozpory</button></div>
      <div class="blok"><h3>📊 Body</h3><table class="slozky">
        <tr><td>⚡ Nalezené rozpory (${nalez} z ${v.rozpory.length} × ${J.BODY.rozpor})</td><td>${S.rozpory}</td></tr>
        <tr><td>❌ Falešné rozpory (${v.falesne.filter(f => f.typ === 'falesny').length} × ${J.BODY.falesny})</td><td>${S.falesne}</td></tr>
        <tr><td>〰️ Zdánlivé rozpory (${v.falesne.filter(f => f.typ === 'zdanlivy').length} × ${J.BODY.zdanlivy})</td><td>${S.zdanlive}</td></tr>
        <tr><td>💡 Nápovědy</td><td>${S.napovedy}</td></tr>
        <tr><td>✔/💬 Třídění ověřené × tvrzení (${v.trideni.spravne} správně, ${v.trideni.spatne} špatně, nejvýš ${J.BODY.trideniMax})</td><td>${S.trideni}</td></tr>
        <tr><td>✅ Závěr (${v.zaver.filter(q => q.ok).length} z ${v.zaver.length} správně + důkazy)</td><td>${S.zaver}</td></tr>
        <tr><td>⏱ Bonus za čas (limit ${p.limitMin} min)</td><td>${S.cas}</td></tr>
        <tr class="soucet"><td>Celkem</td><td>${v.body} / ${v.max}</td></tr></table></div>`;
    h += '<div class="blok"><h3>⚡ Rozpory ve spisu</h3>' + v.rozpory.map(r => `<div class="rz ${r.nalezen ? 'ok' : 'ne'}"><h4>${r.nalezen ? '<span class="stav-ok">✅ Nalezen</span>' : '<span class="stav-ne">❌ Minul jsi</span>'} – ${esc(r.nazev)}${r.napoveda ? ` <span class="stav-pul">(nápověda ${r.napoveda}. st.)</span>` : ''}</h4>
      <div class="par">${txt(r.par[0])}<br>× ${txt(r.par[1])}</div><div>${esc(r.vysvetleni)}</div></div>`).join('') + '</div>';
    if (v.falesne.length) h += '<div class="blok"><h3>❌ Dvojice, které rozporem nejsou</h3>' + v.falesne.map(f => `<div class="rz ${f.typ === 'zdanlivy' ? 'pul' : 'ne'}"><h4>${f.typ === 'zdanlivy' ? '<span class="stav-pul">〰️ Zdánlivý rozpor</span>' : '<span class="stav-ne">❌ Nejde o rozpor</span>'}</h4><div class="par">${txt(f.par[0])}<br>× ${txt(f.par[1])}</div><div>${esc(f.vysvetleni)}</div></div>`).join('') + '</div>';
    if (v.trideni.chyby.length) h += '<div class="blok"><h3>✔/💬 Chyby v třídění</h3>' + v.trideni.chyby.map(id => { const x = J.vyrok(p, id); return `<div class="rz ne"><div class="par">${txt(id)}</div><div>Správně: <b>${x.druh === 'o' ? '✔ ověřené zjištění' : '💬 tvrzení osoby'}</b>.</div></div>`; }).join('') + '</div>';
    const q = id => p.zaver.find(x => x.id === id);
    h += '<div class="blok"><h3>✅ Závěr</h3>' + v.zaver.map(z => {
      const Q = q(z.id), moz = id => (Q.moznosti.find(m => m[0] === id) || [, '—'])[1];
      return `<div class="rz ${z.ok ? 'ok' : 'ne'}"><h4>${esc(z.otazka)} <span class="${z.ok ? 'stav-ok' : 'stav-ne'}">${z.ok ? '✅' : '❌'} ${z.body} b.</span></h4>
        <div class="par">Tvoje odpověď: <q>${esc(z.odp ? moz(z.odp) : 'bez odpovědi')}</q>${z.ok ? '' : `<br>Správně: <q>${esc(moz(z.spravne))}</q>`}</div>
        ${z.dukazy.length ? `<div class="par">Důkazy: ${z.dukazy.map(id => (z.dukazyOk.includes(id) ? '✅ ' : z.dukazyKlamne.includes(id) ? '⚠️ klamný: ' : '◻️ ') + txt(id)).join('<br>')}</div>` : '<div class="par">Bez důkazů.</div>'}
        <div>${esc(z.vysvetleni)}</div></div>`;
    }).join('') + '</div>';
    h += `<div class="blok pouceni"><h3>🎓 Poučení</h3><ul>${p.pouceni.map(x => `<li>${esc(x)}</li>`).join('')}</ul><h3 style="margin-top:12px">🧠 Čeho se vyvarovat</h3><ul>${J.OBECNE_POUCENI.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <p class="mini-text">Případ je smyšlený a slouží k tréninku úvahy, nikoli jako vzor postupu podle trestního řádu.</p></div>`;
    $('rozborObsah').innerHTML = h;
    ukaz('rozbor');
    $('rozbor').scrollTop = 0;
  }

  /* ---------- tabulka výsledků ---------- */
  let filtrVysl = null;
  function vysledky() {
    filtrVysl = filtrVysl || (hra ? hra.pripad : startPripad);
    $('vyslFiltr').innerHTML = PRIPADY.map(p => `<button class="btn mini" data-filtr="${p.id}" aria-pressed="${filtrVysl === p.id}">${'★'.repeat(p.obtiznost)} ${esc(p.nazev)}</button>`).join('');
    const s = J.serad(J.nactiVysledky(uloziste).filter(x => x.pripad === filtrVysl));
    const ja = hra && hra.zaznam;
    $('vyslTabulka').innerHTML = s.length ? `<table class="tab-vysl"><thead><tr><th>#</th><th>Jméno</th><th>Body</th><th>%</th><th>Čas</th><th>Datum</th></tr></thead><tbody>` +
      s.map((x, i) => `<tr class="${ja && ja.datum === x.datum && ja.jmeno === x.jmeno ? 'ja' : ''}"><td class="c">${x.lektor ? '–' : i + 1}</td><td>${esc(x.jmeno)}${x.lektor ? ' <span class="mini-text">(viděl řešení)</span>' : ''}</td><td class="c">${x.body} / ${x.max}</td><td class="c">${x.procenta} %</td><td class="c">${J.formatCas(x.casMs)}</td><td class="c">${esc(new Date(x.datum).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }))}</td></tr>`).join('') + '</tbody></table>'
      : '<p class="prazdno">Pro tento případ zatím nikdo nic neodevzdal.</p>';
    if (!$('dlgVysledky').open) $('dlgVysledky').showModal();
  }
  $('vyslFiltr').addEventListener('click', e => { const b = e.target.closest('[data-filtr]'); if (b) { filtrVysl = b.dataset.filtr; vysledky(); } });

  /* ---------- start / nový hráč ---------- */
  function ukazStart(jmeno) {
    $('startPripady').innerHTML = PRIPADY.map(p => `<button class="pk" data-start="${p.id}" aria-pressed="${p.id === startPripad}">
      <span class="obt">${'★'.repeat(p.obtiznost)}${'☆'.repeat(3 - p.obtiznost)} ${['', 'lehký', 'střední', 'těžký'][p.obtiznost]} · ${p.dokumenty.length} dokumentů · limit ${p.limitMin} min</span>
      <b>${esc(p.nazev)}</b><span class="u">${esc(zkrat(p.uvod, 170))}</span></button>`).join('');
    $('startJmeno').value = jmeno || '';
    $('startZpet').hidden = !(hra && !hra.hotovo);
    ukaz('start');
    setTimeout(() => $('startJmeno').focus(), 50);
  }
  $('startPripady').addEventListener('click', e => {
    const b = e.target.closest('[data-start]');
    if (!b) return;
    startPripad = b.dataset.start;
    $('startPripady').querySelectorAll('[data-start]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  });
  async function zacni() {
    const j = $('startJmeno').value.trim();
    if (!j) { Dialog.chyba('Zadej jméno nebo přezdívku – podle něj se najdeš v tabulce výsledků.'); $('startJmeno').focus(); return; }
    if (maPostup() && !await Dialog.potvrd('Rozpracovaný případ se zahodí. Pokračovat?', { ok: 'Zahodit a začít' })) return;
    document.body.classList.remove('ukaz-reseni'); reseniIds = new Set();
    novaHra(startPripad, j.slice(0, 40));
    ukaz('plocha');
    render();
  }
  $('startZacni').addEventListener('click', zacni);
  $('startJmeno').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); zacni(); } });
  $('startZpet').addEventListener('click', () => { ukaz('plocha'); render(); });

  /* ---------- řešení pro lektora ---------- */
  async function reseni() {
    if (!hra) return Dialog.info('Nejdřív vyber případ.');
    if (!hra.hotovo && !hra.lektor) {
      if (!await Dialog.potvrd('Řešení uvidí každý, kdo se dívá na obrazovku. Výsledek rozehraného hráče se označí „viděl řešení“ a v tabulce se zařadí na konec. Zobrazit?', { ok: 'Zobrazit řešení' })) return;
      hra.lektor = true; uloz();
    }
    const p = pripad();
    const t = id => esc(J.vyrok(p, id).text);
    let h = `<p><b>${esc(p.nazev)}</b> – ${p.rozpory.length} rozporů, ${p.dokumenty.length} dokumentů.</p><h4>⚡ Rozpory</h4>`;
    h += p.rozpory.map((r, i) => `<div class="rz ok"><h4>${i + 1}. ${esc(r.nazev)}</h4><div class="par">„${t(r.pary[0][0])}“<br>× „${t(r.pary[0][1])}“${r.pary.length > 1 ? `<br><small>uznávají se i další dvojice se stejným významem (celkem ${r.pary.length})</small>` : ''}</div><div>${esc(r.vysvetleni)}</div></div>`).join('');
    h += '<h4>〰️ Zdánlivé rozpory (pasti)</h4>' + (p.zdanlive || []).map(z => `<div class="rz pul"><div class="par">„${t(z.pary[0][0])}“ × „${t(z.pary[0][1])}“</div><div>${esc(z.vysvetleni)}</div></div>`).join('');
    h += '<h4>✅ Závěr</h4>' + p.zaver.map(q => `<div class="rz ok"><b>${esc(q.otazka)}</b><div class="par">${esc(q.moznosti.find(m => m[0] === q.spravne)[1])}</div><div>${esc(q.vysvetleni)}</div></div>`).join('');
    $('reseniTelo').innerHTML = h;
    $('reseniVyznac').textContent = document.body.classList.contains('ukaz-reseni') ? '🖍️ Skrýt vyznačení ve spisu' : '🖍️ Vyznačit rozpory ve spisu';
    $('dlgReseni').showModal();
    render();
  }
  function vyznacReseni(zap) {
    const p = pripad();
    reseniIds = zap ? new Set(p.rozpory.flatMap(r => r.pary.flat())) : new Set();
    document.body.classList.toggle('ukaz-reseni', zap);
    prekresliDokument();
  }
  $('reseniVyznac').addEventListener('click', () => {
    vyznacReseni(!document.body.classList.contains('ukaz-reseni'));
    $('dlgReseni').close();
  });

  /* ---------- příkazy z menu ---------- */
  const PRIKAZY = {
    stul() { if (!hra) return; ukaz('plocha'); hra.aktivni = 'stul'; uloz(); renderZalozky(); renderObsah(); },
    napoveda,
    odevzdat,
    vysledky,
    async novyHrac() {
      if (maPostup() && !await Dialog.potvrd('Rozpracovaný případ se zahodí (nic se neuloží do tabulky). Pokračovat?', { ok: 'Nový hráč' })) return;
      const id = hra ? hra.pripad : startPripad;
      hra = null; LS.del(KLIC_HRA); vybrany = null;
      startPripad = id;
      document.body.classList.remove('ukaz-reseni'); reseniIds = new Set();
      ukazStart('');
    },
    async znovu() {
      if (!hra) return;
      if (!await Dialog.potvrd(`Začít případ „${pripad().nazev}“ znovu? Označení, rozpory i čas se smažou.`, { ok: 'Začít znovu' })) return;
      document.body.classList.remove('ukaz-reseni'); reseniIds = new Set();
      novaHra(hra.pripad, hra.hrac);
      ukaz('plocha');
      render();
    },
    rozbor: ukazRozbor,
    tisk() {
      if (!hra || !hra.hotovo) return Dialog.info('Tisk výsledku je dostupný po odevzdání.');
      ukazRozbor();
      setTimeout(() => window.print(), 100);
    },
    zpetSpis() { ukaz('plocha'); vyznacReseni(true); },
    reseni,
    async prepni() {
      if (hra) startPripad = hra.pripad;
      ukazStart(hra ? hra.hrac : '');
    },
    async smazTabulku() {
      const n = J.nactiVysledky(uloziste).length;
      if (!n) return Dialog.info('Tabulka výsledků je prázdná.');
      if (!await Dialog.potvrd(`Smazat celou tabulku výsledků (${n} záznamů) na tomto zařízení? Nejde to vrátit.`, { ok: 'Smazat' })) return;
      J.smazVysledky(uloziste);
      if (hra) { hra.zaznam = null; uloz(); }
      Dialog.info('Tabulka výsledků je smazaná.');
      if ($('dlgVysledky').open) vysledky();
    },
    jakHrat() { pomoc('📖 Jak hrát', 'tplJakHrat'); },
    jakHodnotit() { pomoc('⚖️ Jak hodnotit stopy', 'tplHodnotit'); }
  };
  function pomoc(nadpis, tpl) {
    $('pomocNadpis').textContent = nadpis;
    $('pomocTelo').innerHTML = '';
    $('pomocTelo').appendChild($(tpl).content.cloneNode(true));
    $('dlgPomoc').showModal();
  }

  /* ---------- nabídky ---------- */
  function zavriNabidky() {
    document.querySelectorAll('.nabidka:not([hidden])').forEach(n => { n.hidden = true; });
    document.querySelectorAll('[data-nabidka][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
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
    if (p) {
      e.stopPropagation(); zavriNabidky();
      return PRIKAZY[p.dataset.prikaz]();
    }
    if (e.target.closest('[data-zavri]')) { const d = e.target.closest('dialog'); if (d) d.close(); return; }
    if (!e.target.closest('.nabidka')) zavriNabidky();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') zavriNabidky(); });

  /* ---------- start stránky ---------- */
  if (!hra) ukazStart('');
  else {
    ukaz('plocha');
    render();
    if (hra.hotovo) ukazRozbor();
  }
  window.TP_APP = { hra: () => hra, PRIKAZY, vyber, otevriDok, skocNa };
})();
