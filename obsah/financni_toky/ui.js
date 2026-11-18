/* Finanční toky z bankovních výpisů – rozhraní (jádro: financni_toky/jadro.js = window.FINTOKY) */
(function () {
  'use strict';
  const F = window.FINTOKY, $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const zkrat = (s, n) => (s = String(s || '')).length > n ? s.slice(0, n - 1) + '…' : s;

  /* ---------- nastavení a úložiště ---------- */
  const KLIC_NAST = 'webapp_financni_toky_nast', DB = 'webapp_financni_toky', ID_PRIPAD17 = 'pripad17';
  let nast = {};
  try { nast = JSON.parse(localStorage.getItem(KLIC_NAST)) || {}; } catch (e) { nast = {}; }
  const nastUloz = () => { try { localStorage.setItem(KLIC_NAST, JSON.stringify(nast)); } catch (e) { /* bez úložiště jen nepamatuje */ } };
  let dbSlib = null;
  function db() {
    return dbSlib || (dbSlib = new Promise((ok, ko) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('projekty', { keyPath: 'id' });
      r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
    }));
  }
  async function dbOp(rezim, fn) {
    const d = await db();
    return new Promise((ok, ko) => { const tx = d.transaction('projekty', rezim), r = fn(tx.objectStore('projekty')); tx.oncomplete = () => ok(r && r.result); tx.onerror = () => ko(tx.error); });
  }
  const dbCti = id => dbOp('readonly', s => s.get(id));
  const dbVsechny = () => dbOp('readonly', s => s.getAll());
  const dbSmaz = id => dbOp('readwrite', s => s.delete(id));
  let ulozCasovac = null;
  function uloz() {
    clearTimeout(ulozCasovac);
    ulozCasovac = setTimeout(() => {
      const o = F.doJson(projekt).projekt; o.upraveno = Date.now();
      dbOp('readwrite', s => s.put(o)).catch(e => Dialog.chyba('Uložení selhalo: ' + e.message));
    }, 300);
  }

  /* ---------- stav ---------- */
  let projekt = F.prazdny(), nalezy = [], pop = {}, txInd = new Map(), txTok = new Set(), vlastni = new Set();
  let zal = nast.zalozka || 'indicie';
  const filtr = { text: '', ucet: '', smer: '', typ: '', od: '', do: '', jenInd: false, dup: false, uzel: '', ids: null, idsPopis: '' };
  let limitRadku = 300;
  const klicNalezu = n => n.druh + '|' + n.ucet + '|' + F.isoDen(n.od);
  const popis = u => F.popisUzlu(u, pop);
  const popisUctu = u => pop[u] ? `${u} (${pop[u]})` : u;

  function prepocti() {
    F.prepocitej(projekt);
    nalezy = projekt.transakce.length ? F.detekuj(projekt) : [];
    const h = projekt.hodnoceni || {};
    nalezy.forEach(n => { const x = h[klicNalezu(n)]; if (x) { n.stav = x.stav; n.poznamka = x.poznamka; } });
    pop = F.popisky(projekt);
    vlastni = new Set(F.vlastniUcty(projekt));
    txInd = new Map();
    nalezy.forEach(n => n.tx.forEach(id => { (txInd.get(id) || txInd.set(id, []).get(id)).push(n); }));
    // v diagramech se červeně barví jen toky z indicií o konkrétních platbách (změna chování označuje celé období účtu)
    txTok = new Set(nalezy.filter(n => n.druh !== 'zmena').flatMap(n => n.tx));
    $('seznamUctu').innerHTML = [...new Set([...vlastni, ...projekt.transakce.map(t => t.protiucet).filter(Boolean)])].slice(0, 400).map(u => `<option value="${esc(u)}">`).join('');
    $('nazevProjektu').textContent = projekt.nazev;
    $('pocInd').textContent = nalezy.length || '';
    $('pocTx').textContent = projekt.transakce.length || '';
    $('pocZdr').textContent = projekt.zdroje.length || '';
    $('uvod').hidden = projekt.transakce.length > 0 || projekt.zdroje.length > 0;
  }
  function zmeneno() { prepocti(); uloz(); vykresli(); }

  async function otevri(p) {
    projekt = F.zJson(p);
    if (projekt.id !== ID_PRIPAD17) { nast.posledni = projekt.id; nastUloz(); }
    Object.assign(filtr, { text: '', ucet: '', smer: '', typ: '', od: '', do: '', jenInd: false, dup: false, uzel: '', ids: null, idsPopis: '' });
    prepocti(); vykresli();
  }

  /* ---------- záložky ---------- */
  function prepni(z) {
    zal = z; nast.zalozka = z; nastUloz();
    document.querySelectorAll('#zalozky [data-zal]').forEach(b => b.setAttribute('aria-selected', b.dataset.zal === z ? 'true' : 'false'));
    vykresli();
  }
  $('zalozky').addEventListener('click', e => { const b = e.target.closest('[data-zal]'); if (b) prepni(b.dataset.zal); });
  function vykresli() {
    document.querySelectorAll('#zalozky [data-zal]').forEach(b => b.setAttribute('aria-selected', b.dataset.zal === zal ? 'true' : 'false'));
    ({ indicie: kresliIndicie, transakce: kresliTransakce, souhrn: kresliSouhrn, toky: kresliToky, zustatky: kresliZustatky, vazby: kresliVazby, zdroje: kresliZdroje }[zal] || kresliIndicie)();
  }
  const T = () => $('telo');
  function infoUkazky() {
    const u = projekt.ukazkaInfo;
    if (!u) return '';
    return `<div class="ukazka-info"><h4><span>${esc(u.ikona || '🧪')} Ukázka: ${esc(u.nazev)}</span><button class="btn mini" data-prikaz="galerie" title="Další ukázky">🧪</button></h4>
      <div>${esc(u.co)}</div><div style="margin-top:4px"><b>Co je v datech schované (známá pravda):</b></div><ul>${u.najde.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
  }
  const prazdnyStav = () => `<div class="prazdno">Zatím žádná data. <button class="btn primary" data-prikaz="import">📥 Import výpisů</button> nebo <button class="btn" data-prikaz="galerie">🧪 ukázka</button></div>`;

  /* ---------- 🚩 indicie ---------- */
  const STAVY = ['k prověření', 'prověřuje se', 'vysvětleno legitimně', 'potvrzeno – předáno', 'nepodstatné'];
  function kresliIndicie() {
    if (!projekt.transakce.length) { T().innerHTML = infoUkazky() + prazdnyStav(); return; }
    const zapnute = Object.keys(F.DETEKCE).filter(k => F.parametryDetekce(projekt, k).zapnuto);
    const bez = zapnute.filter(k => !nalezy.some(n => n.druh === k));
    const vyp = Object.keys(F.DETEKCE).filter(k => !zapnute.includes(k));
    T().innerHTML = infoUkazky() +
      `<div class="upozorneni">⚖️ Indicie = transakce odpovídají vzorci, který bývá spojený s praním peněz nebo podvodem. <b>Nejde o závěr</b> – každá má i legitimní vysvětlení a výsledek závisí na prazích (🔎 Detekce → Prahy). Výpisy neukazují hotovost po výběru ani účty mimo podklady.</div>
      <div class="filtry"><button class="btn" data-prikaz="detekce">⚙️ Prahy a výběr detekcí</button><button class="btn" data-prikaz="protokol">📄 Protokol</button>
      <span class="pozn">${nalezy.length ? nalezy.length + ' indicií' : 'žádná indicie'} · bez nálezu: ${bez.map(k => F.DETEKCE[k].ikona + ' ' + F.DETEKCE[k].nazev).join(', ') || '–'}${vyp.length ? ' · vypnuto: ' + vyp.map(k => F.DETEKCE[k].nazev).join(', ') : ''}</span></div>` +
      (nalezy.length ? nalezy.map(n => {
        const d = F.DETEKCE[n.druh], k = klicNalezu(n);
        return `<div class="karta" style="--pruh:${n.stav === 'vysvětleno legitimně' || n.stav === 'nepodstatné' ? 'var(--ok)' : 'var(--danger)'}" data-nalez="${esc(k)}">
          <h3><span>${d.ikona} ${esc(d.nazev)}</span><span class="meta" data-i18n="ne">${esc(F.fmtDatum(n.od))} – ${esc(F.fmtDatum(n.do))}</span></h3>
          <div class="meta" data-i18n="ne">účet ${esc(popisUctu(n.ucet))}</div>
          <div data-i18n="ne">${esc(n.text)}</div>
          <div class="akce"><button class="btn mini" data-ukaz-nalez="${esc(k)}">📋 Transakce (${n.tx.length})</button>
            <span class="hodn"><select class="vstup" data-stav="${esc(k)}" aria-label="Stav prověření" style="flex:0 1 auto">${STAVY.map(s => `<option${(n.stav || STAVY[0]) === s ? ' selected' : ''}>${s}</option>`).join('')}</select>
            <input class="vstup" data-pozn="${esc(k)}" placeholder="poznámka k prověření (přejde do protokolu)" value="${esc(n.poznamka || '')}" maxlength="300" aria-label="Poznámka" data-i18n="ne"></span></div>
        </div>`;
      }).join('') : `<div class="prazdno">Žádný vzorec nepřekročil nastavené prahy. To neznamená, že k ničemu nedošlo – zkuste jiné prahy, nebo doplňte výpisy dalších účtů.</div>`);
  }
  function hodnoceni(k) { projekt.hodnoceni = projekt.hodnoceni || {}; return projekt.hodnoceni[k] || (projekt.hodnoceni[k] = { stav: STAVY[0], poznamka: '' }); }
  $('telo').addEventListener('change', e => {
    const s = e.target.closest('[data-stav]'), p = e.target.closest('[data-pozn]');
    if (s) { hodnoceni(s.dataset.stav).stav = s.value; prepocti(); uloz(); kresliIndicie(); }
    else if (p) { hodnoceni(p.dataset.pozn).poznamka = p.value; prepocti(); uloz(); }
  });

  /* ---------- 📋 transakce ---------- */
  function kresliTransakce() {
    if (!projekt.transakce.length) { T().innerHTML = infoUkazky() + prazdnyStav(); return; }
    const typy = Object.entries(F.TYPY).map(([k, v]) => `<option value="${k}"${filtr.typ === k ? ' selected' : ''}>${v}</option>`).join('');
    T().innerHTML = `<div class="filtry">
        <input class="vstup" id="fText" type="search" placeholder="🔍 hledat: účet, název, VS, zpráva, ID" value="${esc(filtr.text)}" aria-label="Hledat v transakcích" style="flex:2 1 200px">
        <select class="vstup" id="fUcet" aria-label="Účet"><option value="">všechny účty</option>${[...vlastni].map(u => `<option value="${esc(u)}"${filtr.ucet === u ? ' selected' : ''} data-i18n="ne">${esc(popisUctu(u))}</option>`).join('')}</select>
        <select class="vstup" id="fSmer" aria-label="Směr"><option value="">příchozí i odchozí</option><option value="+"${filtr.smer === '+' ? ' selected' : ''}>jen příchozí</option><option value="-"${filtr.smer === '-' ? ' selected' : ''}>jen odchozí</option></select>
        <select class="vstup" id="fTyp" aria-label="Typ"><option value="">všechny typy</option>${typy}</select>
        <input class="vstup" id="fOd" type="date" value="${esc(filtr.od)}" aria-label="Od" title="Od data">
        <input class="vstup" id="fDo" type="date" value="${esc(filtr.do)}" aria-label="Do" title="Do data">
        <label><input type="checkbox" id="fInd"${filtr.jenInd ? ' checked' : ''}> jen s indicií</label>
        <label><input type="checkbox" id="fDup"${filtr.dup ? ' checked' : ''}> i duplicity</label>
        <button class="btn mini" id="fReset">✕ zrušit filtry</button>
        <button class="btn mini" data-prikaz="rucni">✍️ přidat</button>
      </div><div id="fCipy" class="filtry"></div><div id="tabTx"></div>`;
    const nast2 = () => {
      Object.assign(filtr, { text: $('fText').value, ucet: $('fUcet').value, smer: $('fSmer').value, typ: $('fTyp').value, od: $('fOd').value, do: $('fDo').value, jenInd: $('fInd').checked, dup: $('fDup').checked });
      limitRadku = 300; kresliTabulku();
    };
    ['fText'].forEach(id => $(id).addEventListener('input', nast2));
    ['fUcet', 'fSmer', 'fTyp', 'fOd', 'fDo', 'fInd', 'fDup'].forEach(id => $(id).addEventListener('change', nast2));
    $('fReset').addEventListener('click', () => { Object.assign(filtr, { text: '', ucet: '', smer: '', typ: '', od: '', do: '', jenInd: false, dup: false, uzel: '', ids: null, idsPopis: '' }); kresliTransakce(); });
    kresliTabulku();
  }
  function vyfiltruj() {
    const q = F.norm(filtr.text), od = filtr.od ? Date.parse(filtr.od) : null, doT = filtr.do ? Date.parse(filtr.do) + F.DEN : null;
    return projekt.transakce.filter(t => {
      if (t.dup && !filtr.dup && !(filtr.ids && filtr.ids.has(t.id))) return false;
      if (filtr.ids && !filtr.ids.has(t.id)) return false;
      if (filtr.ucet && t.ucet !== filtr.ucet) return false;
      if (filtr.uzel && t.uzel !== filtr.uzel && t.ucet !== filtr.uzel) return false;
      if (filtr.smer === '+' && t.castka <= 0) return false;
      if (filtr.smer === '-' && t.castka >= 0) return false;
      if (filtr.typ && t.typ !== filtr.typ) return false;
      if (od != null && t.t < od) return false;
      if (doT != null && t.t >= doT) return false;
      if (filtr.jenInd && !txInd.has(t.id)) return false;
      if (q && !F.norm([t.id, t.ucet, t.protiucet, t.protistrana, t.vs, t.ks, t.ss, t.zprava, popis(t.uzel)].join(' ')).includes(q)) return false;
      return true;
    }).sort((a, b) => a.t - b.t || a.id.localeCompare(b.id));
  }
  function kresliTabulku() {
    const cipy = [];
    if (filtr.ids) cipy.push(`<span class="cip">🚩 ${esc(filtr.idsPopis)} <button data-zrus="ids" aria-label="Zrušit">✕</button></span>`);
    if (filtr.uzel) cipy.push(`<span class="cip" data-i18n="ne">↔ ${esc(popis(filtr.uzel))} <button data-zrus="uzel" aria-label="Zrušit">✕</button></span>`);
    $('fCipy').innerHTML = cipy.join('');
    $('fCipy').hidden = !cipy.length;
    const v = vyfiltruj(), ukaz = v.slice(0, limitRadku);
    const soucet = v.filter(t => !t.dup).reduce((a, t) => a + t.castka, 0);
    $('tabTx').innerHTML = `<p class="pozn" style="margin:0 0 6px">${v.length} transakcí${v.length > ukaz.length ? ', zobrazeno ' + ukaz.length : ''} · součet ${F.fmtCastka(soucet)} (bez duplicit) · klik na řádek = úprava · ↔ spárovaný převod, ⧉ duplicita, 🚩 indicie, ✍️ ruční/upravená</p>
      <div class="tab-obal"><table><thead><tr><th>ID</th><th>Datum</th><th>Účet</th><th class="c">Částka</th><th>Protistrana</th><th>VS</th><th>Zpráva</th><th>Typ</th><th>Značky</th></tr></thead>
      <tbody data-i18n="ne">${ukaz.map(t => {
        const ind = txInd.get(t.id) || [];
        return `<tr class="klik${t.dup ? ' dup' : ''}" data-tx="${t.id}"><td class="nw">${t.id}</td><td class="nw">${esc(F.fmtDatum(t.t, t.maCas))}</td><td class="nw">${esc(t.ucet)}</td>
          <td class="c ${t.castka > 0 ? 'plus' : 'minus'}">${esc(F.fmtCastka(t.castka))} ${esc(t.mena !== 'CZK' ? t.mena : '')}</td>
          <td>${esc(zkrat(popis(t.uzel), 40))}${t.protiucet && pop[t.protiucet] ? `<div class="pozn">${esc(t.protiucet)}</div>` : ''}</td><td class="nw">${esc(t.vs)}</td>
          <td><div class="zprava" title="${esc(t.zprava)}">${esc(t.zprava)}</div></td><td class="nw">${esc(F.TYPY[t.typ] || t.typ)}</td>
          <td class="nw">${t.par ? `<span class="znak" title="spárovaný převod s ${t.par}">↔ ${t.par}</span>` : ''}${t.dup ? `<span class="znak" title="duplicita k ${t.dup}">⧉ ${t.dup}</span>` : ''}${ind.length ? `<span class="znak ind" title="${esc(ind.map(n => F.DETEKCE[n.druh].nazev).join(', '))}">🚩 ${ind.map(n => F.DETEKCE[n.druh].ikona).join('')}</span>` : ''}${t.rucni || t.upraveno ? '<span class="znak">✍️</span>' : ''}</td></tr>`;
      }).join('')}</tbody></table></div>
      ${v.length > ukaz.length ? `<p style="text-align:center"><button class="btn" id="dalsiRadky">Zobrazit dalších ${Math.min(500, v.length - ukaz.length)}</button></p>` : ''}`;
    const d = $('dalsiRadky'); if (d) d.addEventListener('click', () => { limitRadku += 500; kresliTabulku(); });
  }
  $('telo').addEventListener('click', e => {
    const z = e.target.closest('[data-zrus]');
    if (z) { if (z.dataset.zrus === 'ids') { filtr.ids = null; filtr.idsPopis = ''; } else filtr.uzel = ''; return kresliTabulku(); }
    const n = e.target.closest('[data-ukaz-nalez]');
    if (n) { const x = nalezy.find(y => klicNalezu(y) === n.dataset.ukazNalez); if (x) ukazTransakce(new Set(x.tx), F.DETEKCE[x.druh].nazev + ' – ' + x.ucet); return; }
    const r = e.target.closest('tr[data-tx]');
    if (r) return upravTransakci(r.dataset.tx);
    const u = e.target.closest('[data-uzel]');
    if (u) { filtr.uzel = u.dataset.uzel; filtr.ids = null; return prepni('transakce'); }
  });
  function ukazTransakce(ids, popisek) {
    Object.assign(filtr, { text: '', ucet: '', smer: '', typ: '', od: '', do: '', jenInd: false, uzel: '', ids, idsPopis: popisek });
    prepni('transakce');
  }

  /* ---------- 📊 souhrn ---------- */
  function kresliSouhrn() {
    if (!projekt.transakce.length) { T().innerHTML = prazdnyStav(); return; }
    const su = F.souhrnUctu(projekt), sp = F.souhrnProtistran(projekt), pl = F.platne(projekt);
    const dup = projekt.transakce.filter(t => t.dup).length, par = projekt.transakce.filter(t => t.par && t.castka < 0).length;
    const dl = (v, t) => `<div class="dlazdice"><b>${v}</b><span>${t}</span></div>`;
    T().innerHTML = `<div class="mrizka">${dl(pl.length, 'transakcí (bez duplicit)')}${dl(su.length, 'zajištěných účtů')}${dl(projekt.zdroje.length, 'výpisů')}${dl(dup, 'duplicit vyřazeno')}${dl(par, 'spárovaných převodů')}${dl(F.fmtCastka(su.reduce((a, s) => a + s.prijmy, 0)), 'příjmy celkem')}${dl(F.fmtCastka(su.reduce((a, s) => a + s.hotovost, 0)), 'hotovost celkem')}${dl(nalezy.length, 'indicií')}</div>
      <h2 class="sekce">🏦 Zajištěné účty</h2>
      <div class="tab-obal"><table><thead><tr><th>Účet</th><th>Období</th><th class="c">Transakcí</th><th class="c">Příjmy</th><th class="c">Výdaje</th><th class="c">Saldo</th><th class="c">Hotovost</th><th class="c">Protistran</th><th class="c">Indicie</th></tr></thead>
      <tbody data-i18n="ne">${su.map(s => `<tr class="klik" data-uzel="${esc(s.ucet)}"><td>${esc(s.ucet)}${s.nazev ? `<div class="pozn">${esc(s.nazev)}</div>` : ''}</td><td class="nw">${F.fmtDatum(s.od)} – ${F.fmtDatum(s.do)}</td><td class="c">${s.pocet}</td><td class="c plus">${F.fmtCastka(s.prijmy)}</td><td class="c minus">${F.fmtCastka(s.vydaje)}</td><td class="c">${F.fmtCastka(s.saldo)}</td><td class="c">${F.fmtCastka(s.hotovost)}</td><td class="c">${s.protistran}</td><td class="c">${nalezy.filter(n => n.ucet === s.ucet).length || ''}</td></tr>`).join('')}</tbody></table></div>
      <h2 class="sekce">👥 Protistrany podle objemu</h2>
      <p class="pozn" style="margin:0 0 6px">„Přijal“ a „poslal“ z pohledu protistrany vůči zajištěným účtům. Klik na řádek = jejich transakce.</p>
      <div class="tab-obal"><table><thead><tr><th>Protistrana</th><th class="c">Transakcí</th><th class="c">Přijal</th><th class="c">Poslal</th><th>Se zajištěnými účty</th><th>Období</th></tr></thead>
      <tbody data-i18n="ne">${sp.slice(0, 200).map(s => `<tr class="klik" data-uzel="${esc(s.uzel)}"><td>${esc(zkrat(s.nazev, 50))}${s.nazev !== s.uzel ? `<div class="pozn">${esc(s.uzel)}</div>` : ''}${vlastni.has(s.uzel) ? ' <span class="znak">zajištěný</span>' : ''}</td><td class="c">${s.pocet}</td><td class="c">${F.fmtCastka(s.prijato)}</td><td class="c">${F.fmtCastka(s.odeslano)}</td><td>${s.ucty.map(esc).join(', ')}</td><td class="nw">${F.fmtDatum(s.od)} – ${F.fmtDatum(s.do)}</td></tr>`).join('')}</tbody></table></div>
      ${sp.length > 200 ? `<p class="pozn">… a dalších ${sp.length - 200} protistran.</p>` : ''}`;
  }

  /* ---------- toky pro diagramy (platby kartou volitelně do jednoho uzlu) ---------- */
  function agregace(slucKarty) {
    const tk = F.toky(projekt).map(f => slucKarty ? Object.assign({}, f, { z: f.z.startsWith('karta: ') ? 'platby kartou' : f.z, na: f.na.startsWith('karta: ') ? 'platby kartou' : f.na }) : f);
    return F.agregujToky(tk);
  }
  const indTx = h => h.tx.some(id => txTok.has(id));
  const indUzel = u => nalezy.some(n => n.ucet === u);

  /* ---------- 🌊 Sankey ---------- */
  function kresliToky() {
    if (!projekt.transakce.length) { T().innerHTML = prazdnyStav(); return; }
    const maxHran = nast.sankeyHran || 30, slucKarty = nast.slucKarty !== false;
    const s = F.sankey(agregace(slucKarty), { maxHran });
    const sirka = Math.max(640, T().clientWidth - 50), okraj = 170;
    const sloupce = {}; s.uzly.forEach(u => { sloupce[u.vrstva] = (sloupce[u.vrstva] || 0) + 1; });
    const H = Math.max(260, Math.max(1, ...Object.values(sloupce)) * 46);
    const R = F.rozvrhSankey(s, sirka - 2 * okraj, H, { sirkaUzlu: 14, mezera: 14 });
    const pasy = R.pasy.map(p => `<path class="sk-pas${indTx(p.hrana) ? ' ind' : ''}" d="${p.d}" style="stroke-width:${p.tloustka.toFixed(1)}px"><title>${esc(popis(p.hrana.z))} → ${esc(popis(p.hrana.na))}: ${esc(F.fmtCastka(p.hrana.castka))} (${p.hrana.pocet} plateb${p.hrana.cisty ? ', čistý tok po odečtení zpětného' : ''})</title></path>`).join('');
    const uzly = s.uzly.map(u => {
      const q = R.pos[u.id], vpravo = u.vrstva !== 0 || s.vrstev === 1;   // první sloupec popisky vlevo, ostatní vpravo
      return `<g class="sk-g" data-uzel="${esc(u.id)}"><rect class="sk-uzel${vlastni.has(u.id) ? ' vlastni' : ''}${indUzel(u.id) ? ' ind' : ''}" x="${q.x.toFixed(1)}" y="${q.y.toFixed(1)}" width="${q.w}" height="${q.h.toFixed(1)}" rx="2"><title>${esc(popis(u.id))}\n${esc(u.id)}\n${esc(F.fmtCastka(u.hodnota))}</title></rect>
        <text class="svg-txt" x="${(vpravo ? q.x + q.w + 5 : q.x - 5).toFixed(1)}" y="${(q.y + q.h / 2).toFixed(1)}" dy="0.35em" text-anchor="${vpravo ? 'start' : 'end'}">${esc(zkrat(popis(u.id), 26))}</text>
        <text class="svg-txt2" x="${(vpravo ? q.x + q.w + 5 : q.x - 5).toFixed(1)}" y="${(q.y + q.h / 2 + 13).toFixed(1)}" dy="0.35em" text-anchor="${vpravo ? 'start' : 'end'}">${esc(F.fmtCastka(u.hodnota))}</text></g>`;
    }).join('');
    const poznamky = [];
    s.slouceno.forEach(x => poznamky.push(`Obousměrný tok ${esc(popis(x.a))} ⇄ ${esc(popis(x.b))}: tam ${F.fmtCastka(x.tam)}, zpět ${F.fmtCastka(x.zpet)} – kreslí se čistý tok ${F.fmtCastka(x.tam - x.zpet)}${x.tam === x.zpet ? ' (vyrovnáno, nekreslí se)' : ''}.`));
    s.odebrano.forEach(x => poznamky.push(`Cyklus ${x.cyklus.map(u => esc(zkrat(popis(u), 22))).join(' → ')}: vynechána nejslabší hrana ${esc(popis(x.z))} → ${esc(popis(x.na))} (${F.fmtCastka(x.castka)}). Okruhy s časovou návazností hledá detekce 🔄.`));
    if (s.vynechano) poznamky.push(`Vynecháno ${s.vynechano} slabších toků (celkem ${F.fmtCastka(s.vynechanoCastka)}) – zvyšte počet zobrazených toků.`);
    T().innerHTML = `<div class="ovl"><label>Zobrazit toků <select class="vstup" id="skHran">${[15, 30, 60, 120].map(n => `<option${n === maxHran ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        <label><input type="checkbox" id="skKarty"${slucKarty ? ' checked' : ''}> platby kartou jako jeden uzel</label>
        <span class="pozn">Šířka pásu = objem. Modře zajištěné účty, červeně toky a účty s indicií. Klik na uzel = jeho transakce.</span></div>
      <div class="graf-obal" id="sankeyObal"><svg id="sankey" width="${sirka}" height="${H + 30}" viewBox="${-okraj} -15 ${sirka} ${H + 30}" role="img" aria-label="Sankeyův diagram toků mezi účty" data-i18n="ne">${pasy}${uzly}</svg></div>
      ${poznamky.length ? `<div class="pozn"><b>Úpravy kvůli diagramu (Sankey nesmí mít cykly):</b><ul data-i18n="ne">${poznamky.map(p => `<li>${p}</li>`).join('')}</ul></div>` : ''}`;
    $('skHran').addEventListener('change', e => { nast.sankeyHran = +e.target.value; nastUloz(); kresliToky(); });
    $('skKarty').addEventListener('change', e => { nast.slucKarty = e.target.checked; nastUloz(); kresliToky(); });
  }

  /* ---------- 📈 zůstatky ---------- */
  function kresliZustatky() {
    if (!projekt.transakce.length) { T().innerHTML = prazdnyStav(); return; }
    const rady = F.zustatky(projekt);
    const W = Math.max(600, T().clientWidth - 50), H = 320, ml = 90, mr = 16, mt = 12, mb = 34;
    const vse = rady.flatMap(r => r.body), t0 = Math.min(...vse.map(b => b.t)), t1 = Math.max(...vse.map(b => b.t)) || t0 + 1;
    let y0 = Math.min(0, ...vse.map(b => b.z)), y1 = Math.max(0, ...vse.map(b => b.z)); if (y1 === y0) y1 = y0 + 1;
    const X = t => ml + (t - t0) / Math.max(1, t1 - t0) * (W - ml - mr), Y = z => mt + (y1 - z) / (y1 - y0) * (H - mt - mb);
    const krokY = (() => { const r = (y1 - y0) / 5, m = 10 ** Math.floor(Math.log10(r)); return [1, 2, 5, 10].map(k => k * m).find(k => k >= r); })();
    let osy = '';
    for (let i = Math.ceil(y0 / krokY), v; (v = i * krokY + 0) <= y1; i++) osy += `<line class="mrizka-c" x1="${ml}" x2="${W - mr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="svg-txt2" x="${ml - 6}" y="${Y(v).toFixed(1)}" dy="0.35em" text-anchor="end">${F.fmtCastka(v)}</text>`;
    const dnu = (t1 - t0) / F.DEN, krokD = dnu > 300 ? 60 : dnu > 120 ? 30 : dnu > 40 ? 7 : 1;
    for (let t = t0 - (t0 % F.DEN); t <= t1; t += krokD * F.DEN) if (t >= t0) osy += `<line class="osa" x1="${X(t).toFixed(1)}" x2="${X(t).toFixed(1)}" y1="${H - mb}" y2="${H - mb + 4}"/><text class="svg-txt2" x="${X(t).toFixed(1)}" y="${H - mb + 16}" text-anchor="middle">${F.fmtDatum(t).replace(/ \d{4}$/, '')}</text>`;
    osy += `<line class="osa" x1="${ml}" x2="${W - mr}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}"/>`;
    const cary = rady.map((r, i) => {
      let d = '', pz = null;
      r.body.forEach(b => { d += (d ? `H${X(b.t).toFixed(1)}V` : `M${X(b.t).toFixed(1)},`) + Y(b.z).toFixed(1); pz = b; });
      const body = r.body.filter(b => txInd.has(b.tx)).map(b => `<circle class="zus-ind" cx="${X(b.t).toFixed(1)}" cy="${Y(b.z).toFixed(1)}" r="3"><title>${b.tx}: ${F.fmtDatum(b.t)} ${F.fmtCastka(b.z)}</title></circle>`).join('');
      return `<path class="zus-cara c${i % 5}" style="${i >= 5 ? 'stroke-dasharray:6 3' : ''}" d="${d}"><title>${esc(popisUctu(r.ucet))}</title></path>${body}`;
    }).join('');
    T().innerHTML = `<p class="pozn" style="margin-top:0">Vývoj zůstatku zajištěných účtů (bez duplicit). Body = transakce s indicií. ${rady.some(r => !r.skutecny) ? 'U účtů bez sloupce „zůstatek“ jde o <b>relativní</b> zůstatek od nuly na začátku výpisu.' : ''}</p>
      <div class="legenda" data-i18n="ne">${rady.map((r, i) => `<span><i class="c${i % 5}" style="background:currentColor;border-top:3px solid"></i>${esc(popisUctu(r.ucet))}${r.skutecny ? '' : ' – relativní'}</span>`).join('')}</div>
      <div class="graf-obal"><svg id="zustatky" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Zůstatky účtů v čase" data-i18n="ne">${osy}${cary}</svg></div>`;
  }

  /* ---------- 🕸️ vazby ---------- */
  function kresliVazby() {
    if (!projekt.transakce.length) { T().innerHTML = prazdnyStav(); return; }
    const maxH = nast.vazbyHran || 50;
    const hrany = agregace(true).filter(h => h.z !== h.na).sort((a, b) => b.castka - a.castka).slice(0, maxH);
    const uzly = [...new Set(hrany.flatMap(h => [h.z, h.na]))].sort();
    const W = Math.max(600, T().clientWidth - 50), H = Math.max(420, Math.min(900, uzly.length * 26)), ox = 80;
    const pos = F.rozvrhGrafu(uzly, hrany, W - 2 * ox, H);   // okraj pro popisky
    Object.values(pos).forEach(q => { q.x += ox; });
    const obrat = {}; hrany.forEach(h => { obrat[h.z] = (obrat[h.z] || 0) + h.castka; obrat[h.na] = (obrat[h.na] || 0) + h.castka; });
    const maxO = Math.max(1, ...Object.values(obrat)), maxC = Math.max(1, ...hrany.map(h => h.castka));
    const r = u => 5 + 13 * Math.sqrt(obrat[u] / maxO);
    const car = hrany.map(h => {
      const a = pos[h.z], b = pos[h.na], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1, rb = r(h.na) + 4;
      return `<line class="vz-hrana${indTx(h) ? ' ind' : ''}" x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${(b.x - dx / l * rb).toFixed(1)}" y2="${(b.y - dy / l * rb).toFixed(1)}" style="stroke-width:${(1 + 5 * Math.sqrt(h.castka / maxC)).toFixed(1)}px" marker-end="url(#sipka)"><title>${esc(popis(h.z))} → ${esc(popis(h.na))}: ${esc(F.fmtCastka(h.castka))} (${h.pocet}×)</title></line>`;
    }).join('');
    const kruhy = uzly.map(u => `<g data-uzel="${esc(u)}" class="sk-g"><circle class="vz-uzel${vlastni.has(u) ? ' vlastni' : ''}${indUzel(u) ? ' ind' : ''}" cx="${pos[u].x.toFixed(1)}" cy="${pos[u].y.toFixed(1)}" r="${r(u).toFixed(1)}"><title>${esc(popis(u))}\n${esc(u)}</title></circle>
      <text class="svg-txt" x="${pos[u].x.toFixed(1)}" y="${(pos[u].y + r(u) + 11).toFixed(1)}" text-anchor="middle">${esc(zkrat(popis(u), 24))}</text></g>`).join('');
    T().innerHTML = `<div class="ovl"><label>Zobrazit vazeb <select class="vstup" id="vzHran">${[20, 50, 100, 200].map(n => `<option${n === maxH ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <span class="pozn">Silové rozmístění: blízko = hodně vzájemných plateb. Velikost uzlu = obrat, tloušťka = objem. Modře zajištěné účty, červeně s indicií. Klik = transakce. Podrobnou síťovou analýzu (centralita, cesty) umí nástroj Analýza vazeb.</span></div>
      <div class="graf-obal"><svg id="vazby" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Graf vazeb mezi účty" data-i18n="ne">
        <defs><marker id="sipka" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path class="sipka" d="M0,0L10,5L0,10z"/></marker></defs>${car}${kruhy}</svg></div>`;
    $('vzHran').addEventListener('change', e => { nast.vazbyHran = +e.target.value; nastUloz(); kresliVazby(); });
  }

  /* ---------- 📚 zdroje ---------- */
  function kresliZdroje() {
    const rucni = projekt.transakce.filter(t => t.rucni).length, upr = projekt.transakce.filter(t => t.upraveno && !t.rucni).length;
    T().innerHTML = infoUkazky() + `<div class="filtry"><button class="btn primary" data-prikaz="import">📥 Přidat výpisy</button><button class="btn" data-prikaz="rucni">✍️ Ruční transakce</button><button class="btn" data-prikaz="ucty">🏷️ Názvy účtů</button></div>` +
      (projekt.zdroje.length ? projekt.zdroje.map(z => `<div class="karta" style="--pruh:var(--accent)">
        <h3><span data-i18n="ne">${esc(z.id)} · ${esc(z.soubor || z.nazev)}</span><button class="btn mini danger" data-smaz-zdroj="${esc(z.id)}">🗑️ Odebrat</button></h3>
        <div class="meta" data-i18n="ne">SHA-256: <code style="word-break:break-all">${esc(z.sha256 || '–')}</code></div>
        <div class="meta">účet <span data-i18n="ne">${esc(z.ucet ? popisUctu(z.ucet) : 'ze sloupce')}</span> · ${z.pocet} transakcí${z.chyby ? ` · <span class="varov">${z.chyby} nepřečtených řádků</span>` : ''} · ${z.velikost != null ? z.velikost + ' B' : ''} · ${esc(z.kodovani || '')} · oddělovač „${esc(z.oddelovac === '\t' ? 'TAB' : z.oddelovac || '')}“ · desetinná „${esc(z.desetinna || '')}“ · importováno ${new Date(z.importovano).toLocaleString('cs-CZ')}</div>
      </div>`).join('') : '<div class="prazdno">Žádné importované výpisy.</div>') +
      `<p class="pozn">Ruční transakce: ${rucni} · ručně upravené importované: ${upr}. Obojí je v tabulce označené ✍️ a uvedené v protokolu.</p>`;
  }
  $('telo').addEventListener('click', async e => {
    const b = e.target.closest('[data-smaz-zdroj]');
    if (!b) return;
    const z = projekt.zdroje.find(x => x.id === b.dataset.smazZdroj);
    if (!z || !await Dialog.potvrd(`Odebrat výpis ${z.soubor || z.nazev} a jeho ${z.pocet} transakcí?`)) return;
    projekt.zdroje = projekt.zdroje.filter(x => x !== z);
    projekt.transakce = projekt.transakce.filter(t => t.zdroj !== z.id);
    zmeneno();
  });

  /* ---------- import ---------- */
  function cekejNaZavreni(dlg) { return new Promise(ok => dlg.addEventListener('close', () => ok(dlg.returnValue), { once: true })); }
  const klicHlavicky = pr => pr.hlavicka.map(F.norm).join('|');
  let sablonaImportu = null;
  async function importujSoubory(soubory) {
    let pridano = 0;
    for (const f of soubory) {
      const bajty = new Uint8Array(await f.arrayBuffer());
      const sha = await F.sha256Hex(bajty);
      const stejny = projekt.zdroje.find(z => z.sha256 === sha);
      if (stejny && !await Dialog.potvrd(`Soubor ${f.name} už je v šetření jako ${stejny.id} (stejný otisk SHA-256). Importovat znovu? Transakce by se označily jako duplicity.`)) continue;
      let pr = F.pripravImport(bajty, f.name), drzitel = '';
      if (sablonaImportu && klicHlavicky(pr) === sablonaImportu.klic) {
        pr = F.pripravImport(bajty, f.name, Object.assign({}, sablonaImportu.volby, { vlastniUcet: '' }));
      } else {
        const v = await dialogImport(bajty, f.name, sha, pr);
        if (!v) continue;
        pr = v.pr; drzitel = v.drzitel;
        if (v.stejne) sablonaImportu = { klic: klicHlavicky(pr), volby: { kodovani: pr.kodovani, oddelovac: pr.oddelovac, desetinna: pr.desetinna, formatData: pr.formatData, hlavickaIdx: pr.hlavickaIdx, mapovani: pr.mapovani } };
      }
      const { transakce, chyby } = F.prevedImport(pr);
      if (!transakce.length) { Dialog.chyba(`${f.name}: žádná transakce nešla přečíst.`); continue; }
      const ucet = pr.vlastniUcet || transakce[0].ucet;
      F.pridejZdroj(projekt, { nazev: f.name, soubor: f.name, sha256: sha, velikost: bajty.length, kodovani: pr.kodovani, oddelovac: pr.oddelovac, desetinna: pr.desetinna, formatData: pr.formatData, mapovani: pr.mapovani, ucet, drzitel, chyby: chyby.length }, transakce);
      if (drzitel && ucet) { projekt.ucty[ucet] = Object.assign(projekt.ucty[ucet] || {}, { nazev: drzitel }); }
      pridano += transakce.length;
    }
    sablonaImportu = null;
    if (pridano) { delete projekt.ukazkaInfo; zmeneno(); Dialog.info(`Importováno ${pridano} transakcí.`); }
  }
  function dialogImport(bajty, nazev, sha, pr0) {
    const dlg = $('dlgImport'), f = dlg.querySelector('form');
    let pr = pr0;
    const sloupce = () => pr.hlavicka.map((h, i) => `<option value="${i}">${i + 1}: ${esc(zkrat(h || '(bez názvu)', 28))}</option>`).join('');
    function vyplnMapovani() {
      $('impMapovani').innerHTML = F.POLE.map(([k, n]) => `<label class="pole">${esc(n)}<select class="vstup" data-map="${k}"><option value="">— nepoužito —</option>${sloupce()}</select></label>`).join('');
      $('impMapovani').querySelectorAll('[data-map]').forEach(s => { const v = pr.mapovani[s.dataset.map]; s.value = v == null ? '' : String(v); });
    }
    function vyplnVolby() {
      f.kodovani.value = f.kodovani.value === 'auto' ? 'auto' : pr.kodovani;
      f.oddelovac.value = pr.oddelovac; f.desetinna.value = pr.desetinna; f.formatData.value = pr.formatData; f.hlavicka.value = pr.hlavickaIdx + 1;
      f.vlastniUcet.value = pr.vlastniUcet || '';
    }
    function nahled() {
      const { transakce, chyby } = F.prevedImport(pr);
      const ucty = [...new Set(transakce.map(t => t.ucet))];
      $('impVysledek').className = 'info' + (chyby.length || !transakce.length ? ' pozor' : '');
      $('impVysledek').innerHTML = `Přečteno <b>${transakce.length}</b> transakcí${chyby.length ? `, <b>${chyby.length}</b> řádků nešlo přečíst (např. ř. ${chyby.slice(0, 3).map(c => c.radek + ': ' + esc(c.duvod)).join('; ')})` : ''}. Účet: ${esc(ucty.join(', ') || '–')}. ` +
        (transakce.length ? `Součet ${F.fmtCastka(transakce.reduce((a, t) => a + t.castka, 0))}; příchozích ${transakce.filter(t => t.castka > 0).length}, odchozích ${transakce.filter(t => t.castka < 0).length}; s časem ${transakce.filter(t => t.maCas).length}. První: ${esc(F.fmtDatum(transakce[0].t, transakce[0].maCas))} ${esc(F.fmtCastka(transakce[0].castka))} ${esc(F.popisUzlu(F.uzelProti(transakce[0])))}` : '');
      const data = pr.radky.slice(pr.hlavickaIdx, pr.hlavickaIdx + 9);
      $('impNahled').innerHTML = `<table><thead><tr>${pr.hlavicka.map((h, i) => `<th>${i + 1}: ${esc(h)}</th>`).join('')}</tr></thead><tbody>${data.slice(1).map(r => `<tr>${pr.hlavicka.map((_, i) => `<td>${esc(r[i] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }
    function znovu(volby) { pr = F.pripravImport(bajty, nazev, volby); vyplnMapovani(); vyplnVolby(); nahled(); }
    $('dlgImportTitul').textContent = '📥 Import výpisu: ' + nazev;
    $('impInfo').innerHTML = `${esc(nazev)} · ${bajty.length} B · SHA-256 <code style="word-break:break-all">${sha}</code><br>Rozpoznáno: ${esc(pr.kodovani)}, oddělovač „${pr.oddelovac === '\t' ? 'TAB' : esc(pr.oddelovac)}“, hlavička na řádku ${pr.hlavickaIdx + 1}, desetinná „${esc(pr.desetinna)}“.`;
    f.kodovani.value = 'auto'; f.drzitel.value = '';
    vyplnMapovani(); vyplnVolby(); nahled();
    const zmena = e => {
      const n = e.target.name;
      if (n === 'kodovani') znovu({ kodovani: f.kodovani.value });
      else if (n === 'oddelovac') znovu({ kodovani: pr.kodovani, oddelovac: f.oddelovac.value });
      else if (n === 'hlavicka') znovu({ kodovani: pr.kodovani, oddelovac: pr.oddelovac, hlavickaIdx: Math.max(0, (+f.hlavicka.value || 1) - 1) });
      else if (n === 'desetinna') { pr.desetinna = f.desetinna.value; nahled(); }
      else if (n === 'formatData') { pr.formatData = f.formatData.value; nahled(); }
      else if (n === 'vlastniUcet') { pr.vlastniUcet = F.normUcet(f.vlastniUcet.value); nahled(); }
      else if (e.target.dataset.map) { const k = e.target.dataset.map; if (e.target.value === '') delete pr.mapovani[k]; else pr.mapovani[k] = +e.target.value; nahled(); }
    };
    const odeslat = e => {
      if (e.submitter && e.submitter.value === 'ok' && !F.prevedImport(pr).transakce.length) { e.preventDefault(); Dialog.chyba('Z výpisu zatím nejde přečíst žádnou transakci – zkontrolujte mapování (datum, částka) a vlastní účet.'); }
    };
    f.addEventListener('change', zmena); f.addEventListener('submit', odeslat);
    $('impStejne').checked = false;
    dlg.returnValue = ''; dlg.showModal();
    return cekejNaZavreni(dlg).then(v => {
      f.removeEventListener('change', zmena); f.removeEventListener('submit', odeslat);
      return v === 'ok' ? { pr, drzitel: f.drzitel.value.trim(), stejne: $('impStejne').checked } : null;
    });
  }
  $('souborImport').addEventListener('change', e => { const s = [...e.target.files]; e.target.value = ''; if (s.length) importujSoubory(s); });
  document.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); document.body.classList.add('tahne'); } });
  document.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('tahne'); });
  document.addEventListener('drop', e => { document.body.classList.remove('tahne'); if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); importujSoubory([...e.dataTransfer.files]); } });

  /* ---------- ruční transakce a úpravy ---------- */
  const doVstupu = t => { const d = new Date(t); return d.toISOString().slice(0, 16); };
  async function upravTransakci(id) {
    const t = id ? projekt.transakce.find(x => x.id === id) : null;
    const dlg = $('dlgRucni'), f = dlg.querySelector('form');
    f.typ.innerHTML = Object.entries(F.TYPY).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    $('dlgRucniTitul').textContent = t ? `✍️ Transakce ${t.id}` : '✍️ Ruční transakce';
    $('rucniInfo').hidden = !t;
    if (t) $('rucniInfo').innerHTML = `${t.rucni ? 'Ručně zadaná transakce.' : `Importováno ze zdroje ${esc(t.zdroj)}, řádek ${t.radek || '?'}. Úprava se v protokolu vyznačí${t.puvodni ? ' (původní hodnoty jsou uložené)' : ''}.`}${t.dup ? ` Duplicita k ${t.dup}.` : ''}${t.par ? ` Spárováno s ${t.par}.` : ''}`;
    const v = t || { ucet: filtr.ucet || [...vlastni][0] || '', t: Date.now() - (Date.now() % 60000), castka: '', mena: 'CZK', typ: 'prevod', protiucet: '', protistrana: '', vs: '', ks: '', ss: '', zprava: '' };
    f.ucet.value = v.ucet; f.datum.value = doVstupu(v.t); f.castka.value = v.castka === '' ? '' : String(v.castka).replace('.', ','); f.mena.value = v.mena; f.typ.value = v.typ;
    f.protiucet.value = v.protiucet; f.protistrana.value = v.protistrana; f.vs.value = v.vs; f.ks.value = v.ks; f.ss.value = v.ss; f.zprava.value = v.zprava;
    $('rucniSmaz').hidden = !(t && t.rucni);
    $('rucniSmaz').onclick = async () => { if (await Dialog.potvrd(`Smazat ruční transakci ${t.id}?`)) { projekt.transakce = projekt.transakce.filter(x => x !== t); dlg.close('zrusit'); zmeneno(); } };
    dlg.returnValue = ''; dlg.showModal();
    if (await cekejNaZavreni(dlg) !== 'ok') return;
    const castka = F.parsujCislo(f.castka.value), dt = F.parsujDatum(f.datum.value.replace('T', ' '));
    if (castka == null || !dt) { Dialog.chyba('Neplatná částka nebo datum.'); return; }
    const nove = { ucet: F.normUcet(f.ucet.value), t: dt.t, maCas: !/T00:00$/.test(f.datum.value), castka: F.zaokr(castka), mena: (f.mena.value || 'CZK').toUpperCase(), typ: f.typ.value, protiucet: F.normUcet(f.protiucet.value), protistrana: f.protistrana.value.trim(), vs: f.vs.value.trim(), ks: f.ks.value.trim(), ss: f.ss.value.trim(), zprava: f.zprava.value.trim() };
    if (t) {
      const zmena = Object.keys(nove).some(k => String(nove[k]) !== String(t[k]));
      if (!zmena) return;
      if (!t.rucni && !t.puvodni) t.puvodni = Object.fromEntries(Object.keys(nove).map(k => [k, t[k]]));
      Object.assign(t, nove, { upraveno: Date.now() });
    } else F.pridejRucni(projekt, nove);
    zmeneno();
  }

  /* ---------- detekce ---------- */
  function dialogDetekce() {
    const dlg = $('dlgDetekce'), f = dlg.querySelector('form');
    const vypln = par => {
      $('detekceForm').innerHTML = Object.entries(F.DETEKCE).map(([k, d]) => {
        const q = Object.assign({}, F.vychoziParametry()[k], par[k] || {});
        return `<div class="detekce-sekce"><label><input type="checkbox" data-zap="${k}"${q.zapnuto ? ' checked' : ''}> ${d.ikona} ${esc(d.nazev)}</label><p>${esc(d.popis)}</p>
          <div class="parametry">${d.parametry.map(p => p.jednotka === 'ano=1'
            ? `<label class="pole"><span><input type="checkbox" data-par="${k}.${p.klic}"${q[p.klic] ? ' checked' : ''}> ${esc(p.nazev)}</span></label>`
            : `<label class="pole">${esc(p.nazev)}${p.jednotka ? ' [' + esc(p.jednotka) + ']' : ''}<input class="vstup" type="number" data-par="${k}.${p.klic}" value="${q[p.klic]}" ${p.min != null ? `min="${p.min}"` : ''} ${p.max != null ? `max="${p.max}"` : ''} step="any"></label>`).join('')}</div></div>`;
      }).join('');
      f.parDni.value = par.parDni != null ? par.parDni : 3;
    };
    vypln(projekt.parametry || F.vychoziParametry());
    $('detekceVychozi').onclick = () => vypln(F.vychoziParametry());
    dlg.returnValue = ''; dlg.showModal();
    cekejNaZavreni(dlg).then(v => {
      if (v !== 'ok') return;
      const par = { parDni: Math.max(0, +f.parDni.value || 0) };
      for (const k of Object.keys(F.DETEKCE)) par[k] = { zapnuto: dlg.querySelector(`[data-zap="${k}"]`).checked };
      dlg.querySelectorAll('[data-par]').forEach(i => { const [k, p] = i.dataset.par.split('.'); par[k][p] = i.type === 'checkbox' ? (i.checked ? 1 : 0) : +i.value; });
      projekt.parametry = par; zmeneno(); prepni('indicie');
      Dialog.info(`Detekce spuštěny: ${nalezy.length} indicií.`);
    });
  }

  /* ---------- názvy účtů ---------- */
  function dialogUcty() {
    const dlg = $('dlgUcty'), sp = F.souhrnProtistran(projekt);
    const ucty = [...new Set([...vlastni, ...sp.filter(s => !F.jePseudo(s.uzel)).map(s => s.uzel)])].slice(0, 150);
    const radek = (u, v) => `<label class="pole" style="grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);display:grid;align-items:center;gap:8px"><span>${esc(u)}${vlastni.has(u) ? ' <span class="znak">zajištěný</span>' : ''}</span><input class="vstup" data-ucet="${esc(u)}" value="${esc(v)}" maxlength="120" placeholder="${esc(pop[u] || 'název / držitel')}"></label>`;
    $('uctyForm').innerHTML = ucty.map(u => radek(u, (projekt.ucty[u] || {}).nazev || '')).join('') || '<p class="pozn">Žádné účty.</p>';
    $('uctyPseudo').onclick = () => {
      let a = 0, b = 0;
      dlg.querySelectorAll('[data-ucet]').forEach(i => { i.value = vlastni.has(i.dataset.ucet) ? 'Účet ' + String.fromCharCode(65 + (a++ % 26)) + (a > 26 ? Math.ceil(a / 26) : '') : 'Protistrana ' + (++b); });
    };
    dlg.returnValue = ''; dlg.showModal();
    cekejNaZavreni(dlg).then(v => {
      if (v !== 'ok') return;
      dlg.querySelectorAll('[data-ucet]').forEach(i => { const u = i.dataset.ucet; if (i.value.trim()) projekt.ucty[u] = { nazev: i.value.trim() }; else delete projekt.ucty[u]; });
      zmeneno();
    });
  }

  /* ---------- šetření ---------- */
  async function seznamProjektu() {
    let v = [];
    try { v = (await dbVsechny()).sort((a, b) => (b.upraveno || 0) - (a.upraveno || 0)); } catch (e) { Dialog.chyba('IndexedDB není dostupná.'); }
    $('seznamProjektu').innerHTML = v.length ? v.map(p => `<div class="karta" style="--pruh:${p.id === projekt.id ? 'var(--accent)' : 'var(--border-strong)'}">
      <h3><span data-i18n="ne">${esc(p.nazev)}</span>${p.id === projekt.id ? '<span class="meta">otevřené</span>' : ''}</h3>
      <div class="meta">${p.zdroje.length} výpisů · ${p.transakce.length} transakcí${p.upraveno ? ' · upraveno ' + new Date(p.upraveno).toLocaleString('cs-CZ') : ''}</div>
      <div class="akce"><button type="button" class="btn mini" data-otevri="${esc(p.id)}">Otevřít</button><button type="button" class="btn mini danger" data-smaz-projekt="${esc(p.id)}">🗑️ Smazat</button></div></div>`).join('')
      : '<div class="prazdno">Žádná uložená šetření.</div>';
  }
  $('seznamProjektu').addEventListener('click', async e => {
    const o = e.target.closest('[data-otevri]'), s = e.target.closest('[data-smaz-projekt]');
    if (o) { const p = await dbCti(o.dataset.otevri); if (p) { $('dlgProjekty').close(); otevri(p); } }
    if (s && await Dialog.potvrd('Smazat šetření i se všemi transakcemi z tohoto prohlížeče?')) {
      await dbSmaz(s.dataset.smazProjekt);
      if (s.dataset.smazProjekt === projekt.id) otevri(F.prazdny());
      seznamProjektu();
    }
  });

  /* ---------- ukázky ---------- */
  async function otevriUkazku(klic) {
    const p = await F.ukazkaProjekt(klic, window.MODELOVY_PRIPAD);
    delete p._ukazka;
    p.id = 'ukazka-' + klic;
    $('dlgGalerie').open && $('dlgGalerie').close();
    await otevri(p); uloz(); prepni('indicie');
  }
  function galerie() {
    $('galerie').innerHTML = Object.entries(F.UKAZKY).map(([k, u]) => `<div class="uk"><h3>${u.ikona} ${esc(u.nazev)}</h3><div class="co">${esc(u.co)}</div>
      <div class="najde"><b>Najde:</b><ul>${u.najde.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <button type="button" class="btn primary" data-ukazka="${k}">Otevřít ukázku</button></div>`).join('');
    $('dlgGalerie').showModal();
  }
  $('uvodUkazky').innerHTML = Object.entries(F.UKAZKY).map(([k, u]) => `<button class="btn" data-ukazka="${k}">${u.ikona} ${esc(u.nazev)}</button>`).join('');
  document.addEventListener('click', e => { const u = e.target.closest('[data-ukazka]'); if (u) { e.preventDefault(); otevriUkazku(u.dataset.ukazka); } });

  /* ---------- protokol a exporty ---------- */
  function stahni(obsah, nazev, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([obsah], { type: typ }));
    a.download = nazev; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  const jmenoSouboru = () => F.bezDiakritiky(projekt.nazev).replace(/[^\w-]+/g, '_').slice(0, 50) || 'setreni';
  async function hashProtokolu() { $('protokolHash').textContent = await F.sha256Hex(new TextEncoder().encode($('protokolText').value)); }
  function protokol() {
    if (!projekt.transakce.length) { Dialog.chyba('Šetření zatím nemá žádné transakce.'); return; }
    $('protokolText').value = F.protokol(projekt, nalezy);
    hashProtokolu();
    $('dlgProtokol').showModal();
  }
  $('protokolText').addEventListener('input', hashProtokolu);
  $('protokolTisk').addEventListener('click', () => { $('tisk').textContent = $('protokolText').value + '\n\nSHA-256 textu protokolu: ' + $('protokolHash').textContent; print(); });
  $('protokolUloz').addEventListener('click', () => stahni($('protokolText').value + '\n\nSHA-256 textu protokolu (bez tohoto řádku): ' + $('protokolHash').textContent + '\n', `protokol_${jmenoSouboru()}.txt`, 'text/plain;charset=utf-8'));

  const PRIKAZY = {
    import: () => $('souborImport').click(),
    galerie,
    rucni: () => upravTransakci(null),
    ucty: dialogUcty,
    detekce: dialogDetekce,
    spust: () => { prepocti(); prepni('indicie'); Dialog.info(`${nalezy.length} indicií.`); },
    indicie: () => prepni('indicie'),
    protokol,
    csv: () => { if (!projekt.transakce.length) return Dialog.chyba('Žádné transakce.'); stahni(F.doCsv(projekt, nalezy), `transakce_${jmenoSouboru()}.csv`, 'text/csv;charset=utf-8'); },
    zaloha: () => stahni(JSON.stringify(F.doJson(projekt), null, 1), `financni_toky_${jmenoSouboru()}.json`, 'application/json'),
    obnov: () => $('souborZaloha').click(),
    projekty: () => { seznamProjektu(); $('dlgProjekty').showModal(); },
    novy: async () => { const n = await Dialog.zeptej('Název nového šetření', 'Nové šetření'); if (n == null) return; const p = F.prazdny(n.trim() || 'Nové šetření'); await otevri(p); uloz(); },
    prejmenuj: () => {
      const dlg = $('dlgNazev'), f = dlg.querySelector('form');
      f.nazev.value = projekt.nazev; f.znacka.value = projekt.znacka || ''; f.zpracovatel.value = projekt.zpracovatel || '';
      dlg.returnValue = ''; dlg.showModal();
      cekejNaZavreni(dlg).then(v => { if (v !== 'ok') return; projekt.nazev = f.nazev.value.trim() || projekt.nazev; projekt.znacka = f.znacka.value.trim(); projekt.zpracovatel = f.zpracovatel.value.trim(); zmeneno(); });
    },
    smazProjekt: async () => { if (!await Dialog.potvrd(`Smazat šetření „${projekt.nazev}“ z tohoto prohlížeče?`)) return; await dbSmaz(projekt.id).catch(() => {}); await otevri(F.prazdny()); },
    napoveda: () => $('dlgNapoveda').showModal()
  };
  $('souborZaloha').addEventListener('change', async e => {
    const s = e.target.files[0]; e.target.value = '';
    if (!s) return;
    try { const p = F.zJson(JSON.parse(await s.text())); if (await dbCti(p.id) && !await Dialog.potvrd('Šetření se stejným ID už v prohlížeči je. Přepsat ho zálohou?')) p.id = 'p' + Date.now().toString(36); await otevri(p); uloz(); Dialog.info('Záloha načtena.'); }
    catch (err) { Dialog.chyba('Zálohu nelze načíst: ' + err.message); }
  });

  /* ---------- nabídky a klávesy ---------- */
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
    if (p) { e.stopPropagation(); zavriNabidky(); const d = p.closest('dialog'); if (d && d.open && p.dataset.prikaz !== 'galerie') d.close(); return PRIKAZY[p.dataset.prikaz](); }
    if (e.target.closest('[data-metoda]')) zavriNabidky();
    if (!e.target.closest('.nabidka')) zavriNabidky();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') zavriNabidky();
    if (e.target.closest('input,textarea,select,dialog') || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
    const k = e.key.toLowerCase();
    if (k === 'g') PRIKAZY.galerie();
    else if (k === 'p') PRIKAZY.protokol();
    else if (k === '/') { e.preventDefault(); if (zal !== 'transakce') prepni('transakce'); const i = $('fText'); if (i) i.focus(); }
  });
  let sirkaPred = innerWidth;
  addEventListener('resize', () => { if (Math.abs(innerWidth - sirkaPred) > 40 && ['toky', 'zustatky', 'vazby'].includes(zal)) { sirkaPred = innerWidth; vykresli(); } });

  /* ---------- start ---------- */
  async function start() {
    if (window.ModelovyPripad && window.ModelovyPripad.aktivni) {
      let p = null;
      try { p = await dbCti(ID_PRIPAD17); } catch (e) { /* bez IndexedDB se jen neuloží */ }
      const novy = !p;
      if (novy) { p = await F.ukazkaProjekt('pripad17', window.MODELOVY_PRIPAD); delete p._ukazka; p.id = ID_PRIPAD17; p.nazev = 'Modelový případ 17/2026 – finanční toky'; p.znacka = window.MODELOVY_PRIPAD ? window.MODELOVY_PRIPAD.cislo : ''; }
      await otevri(p);
      if (novy) uloz();
      zal = 'indicie'; vykresli();
      return;
    }
    let p = null;
    try { if (nast.posledni) p = await dbCti(nast.posledni); } catch (e) { Dialog.chyba('IndexedDB není dostupná – data se neuloží. (' + e.message + ')'); }
    await otevri(p || F.prazdny());
  }
  window.FINTOKY_APP = { projekt: () => projekt, nalezy: () => nalezy, filtr, PRIKAZY, otevriUkazku, prepni, importujSoubory, zalozka: () => zal };
  start();
})();
