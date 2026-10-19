/* Voynichův rukopis – výzkumné režimy: Hledání, Analýza, Srovnání, Folia, Poznámky. */
(function () {
  'use strict';
  const V = window.Voynich, J = V.J, G = V.G, esc = V.esc;
  const $ = s => document.querySelector(s);
  const pct = (x, d) => G.cislo(Math.round(x * 100 * Math.pow(10, d || 1)) / Math.pow(10, d || 1), d || 1) + ' %';
  const prom = x => G.cislo(Math.round(x * 10000) / 10, 1) + ' ‰';
  const cis = x => Math.round(x).toLocaleString('cs-CZ');
  const des = (x, d) => G.cislo(Math.round(x * Math.pow(10, d)) / Math.pow(10, d), d);

  function stahni(nazev, text, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: typ || 'text/plain;charset=utf-8' }));
    a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // ---------- společný filtr ----------
  const SKUPINY_FILTRU = [
    { k: 'I', nazev: 'Sekce (ilustrace)', hodnoty: J.PORADI_ILUSTRACI.map(x => [x, J.ILUSTRACE[x]]) },
    { k: 'L', nazev: 'Currierův jazyk', hodnoty: [['A', 'A'], ['B', 'B'], ['?', 'neurčen']] },
    { k: 'H', nazev: 'Písař (Davis)', hodnoty: [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['?', 'neurčen']] },
    { k: 'druh', nazev: 'Druh textu', hodnoty: Object.entries(J.DRUH_LOKUSU) },
    { k: 'Q', nazev: 'Složka', hodnoty: 'ABCDEFGHIJKLMNOQST'.split('').map(x => [x, x]) }
  ];
  function popisFiltru(f) {
    const casti = [];
    for (const sk of SKUPINY_FILTRU) if (f[sk.k] && f[sk.k].length) casti.push(sk.nazev.toLowerCase() + ': ' + f[sk.k].map(v => (sk.hodnoty.find(h => h[0] === v) || [v, v])[1]).join(', '));
    if (f.bezNejistych) casti.push('bez slov s „?“');
    if (f.jenZakladni) casti.push('jen základní EVA');
    return casti.length ? casti.join(' · ') : 'celý rukopis';
  }
  function filtrHtml(id, f, nadpis) {
    let h = `<div class="filtry" id="${id}">` + (nadpis ? `<div class="skupina" style="flex-basis:100%"><b>${esc(nadpis)}</b></div>` : '');
    for (const sk of SKUPINY_FILTRU) {
      h += `<div class="skupina"><span>${esc(sk.nazev)}</span><div class="cipy">` +
        sk.hodnoty.map(([v, n]) => `<button class="cip${(f[sk.k] || []).includes(v) ? ' zap' : ''}" data-k="${sk.k}" data-v="${esc(v)}" title="${esc(sk.k === 'I' ? J.ILUSTRACE_POPIS[v] || n : n)}">${esc(n)}</button>`).join('') + '</div></div>';
    }
    h += `<div class="skupina"><span>Slova</span><label class="prep"><input type="checkbox" data-k="bezNejistych" ${f.bezNejistych ? 'checked' : ''}> bez nečitelných „?“</label>
      <label class="prep"><input type="checkbox" data-k="jenZakladni" ${f.jenZakladni ? 'checked' : ''}> jen základní EVA (a–z)</label></div>
      <div class="souhrn-filtru">Vybráno: <span data-souhrn>${esc(popisFiltru(f))}</span> <button class="btn" data-k="vymazat" style="margin-left:8px;padding:1px 8px">vymazat</button></div></div>`;
    return h;
  }
  function napojFiltr(el, f, zmena) {
    el.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.k === 'vymazat') {
        for (const sk of SKUPINY_FILTRU) f[sk.k] = [];
        f.bezNejistych = false; f.jenZakladni = false;
        el.querySelectorAll('.cip').forEach(c => c.classList.remove('zap'));
        el.querySelectorAll('input[type=checkbox]').forEach(c => { c.checked = false; });
      } else if (b.dataset.v != null) {
        const a = f[b.dataset.k] = f[b.dataset.k] || [];
        const i = a.indexOf(b.dataset.v);
        if (i >= 0) a.splice(i, 1); else a.push(b.dataset.v);
        b.classList.toggle('zap', i < 0);
      } else return;
      el.querySelector('[data-souhrn]').textContent = popisFiltru(f);
      zmena();
    });
    el.addEventListener('change', e => {
      if (!e.target.dataset.k) return;
      f[e.target.dataset.k] = e.target.checked;
      el.querySelector('[data-souhrn]').textContent = popisFiltru(f);
      zmena();
    });
  }
  const filtrovano = (f, kod) => J.filtruj(V.korpus(kod), f);

  function tabulka(hlavicka, radky, volby) {
    volby = volby || {};
    const id = 'tab' + Math.random().toString(36).slice(2, 8);
    let h = `<div class="tab-obal"${volby.vyska ? ` style="max-height:${volby.vyska}px"` : ''}><table class="data" id="${id}"><thead><tr>` +
      hlavicka.map((x, i) => `<th class="${x.cis ? 'cis' : ''}" data-i="${i}" title="Seřadit">${esc(x.n)}</th>`).join('') + '</tr></thead><tbody>';
    h += radky.map(r => `<tr class="${r.klik ? 'klik' : ''}" ${r.data || ''}>` + r.b.map((x, i) => `<td class="${hlavicka[i].cis ? 'cis' : ''}${hlavicka[i].eva ? ' eva' : ''}">${x}</td>`).join('') + '</tr>').join('');
    return h + '</tbody></table></div>';
  }
  // řazení klepnutím na záhlaví (podle textu buňky, čísla česky)
  document.addEventListener('click', e => {
    const th = e.target.closest('table.data th');
    if (!th) return;
    const tb = th.closest('table'), i = +th.dataset.i, tbody = tb.tBodies[0];
    const smer = th.dataset.smer === 'a' ? 'd' : 'a';
    tb.querySelectorAll('th').forEach(x => delete x.dataset.smer);
    th.dataset.smer = smer;
    const hod = td => { const t = td.textContent.replace(/\s/g, '').replace(',', '.').replace(/[%‰]/, ''); const n = parseFloat(t); return isNaN(n) || !/^[-\d.]+$/.test(t) ? td.textContent : n; };
    const rows = Array.from(tbody.rows);
    rows.sort((a, b) => {
      const x = hod(a.cells[i]), y = hod(b.cells[i]);
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'cs');
      return smer === 'a' ? c : -c;
    });
    rows.forEach(r => tbody.appendChild(r));
  });

  // pruh přes celý rukopis: buňka na stránku IVTFF, intenzita = hodnota
  function pruhRukopisu(hodnoty, tip) {
    const str = V.prepis('zl').stranky;
    const max = Math.max(1e-9, ...str.map(s => hodnoty[s.id] || 0));
    let h = '<div class="pruh-rukopisu" data-pruh>';
    for (const s of str) {
      const v = hodnoty[s.id] || 0;
      h += `<i data-str="${s.id}" style="background:${v ? 'var(--accent)' : 'transparent'};opacity:${v ? (0.18 + 0.82 * v / max).toFixed(3) : 1}" data-tip="${esc(tip(s, v))}"></i>`;
    }
    h += '</div><div class="pruh-popis"><span>f1r · bylinná</span><span>astronomie, zvěrokruh f67–f73</span><span>biologická f75–f84</span><span>farmac. f87–f102</span><span>recepty f103–f116</span></div>';
    return h;
  }
  document.addEventListener('click', e => {
    const i = e.target.closest('[data-pruh] i[data-str]');
    if (i) V.otevriStranku(i.dataset.str);
    const a = e.target.closest('.kwic a[data-lok]');
    if (a && !e.target.closest('#panelObsah')) { e.preventDefault(); V.otevriStranku(a.dataset.str, a.dataset.lok); }
  });

  // ============ HLEDÁNÍ ============
  const H = { dotaz: '', rezim: 'slovo', filtr: { bezNejistych: false }, limit: 200 };
  const REZIMY_HLEDANI = [
    ['slovo', 'celé slovo'], ['zacina', 'začíná na'], ['konci', 'končí na'], ['obsahuje', 'obsahuje'],
    ['vzor', 'vzor (* a ?)'], ['regex', 'regulární výraz v řádku']
  ];
  function initHledani() {
    $('#obsahHledani').innerHTML = `
      <div class="radek-formu">
        <input type="search" id="hlDotaz" class="eva" placeholder="např. daiin, qok*dy, ^ch.*y$" aria-label="Hledaný výraz" autocomplete="off" spellcheck="false">
        <select id="hlRezim" aria-label="Způsob hledání">${REZIMY_HLEDANI.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select>
        <button class="btn" id="hlZvyraznit" title="Zvýraznit výskyty v prohlížeči a v náhledech">🖍 Zvýraznit v prohlížeči</button>
        <button class="btn" id="hlCsv" title="Všechny výskyty do CSV (oddělovač středník)">⬇ CSV</button>
      </div>
      <p class="male tlumeny" style="margin:-4px 0 10px">Ve vzoru znamená <b>*</b> libovolný počet znaků a <b>?</b> jeden znak. Regulární výraz se hledá v textu řádku, kde jsou slova oddělena tečkou, takže najde i spojení slov (např. <span class="eva">daiin\\.daiin</span> nebo <span class="eva">y\\.q</span>).</p>
      ${filtrHtml('hlFiltr', H.filtr)}
      <div id="hlVysledky"></div>`;
    const spust = () => { H.dotaz = $('#hlDotaz').value; H.rezim = $('#hlRezim').value; H.limit = 200; vyhledej(); V.zapisHash(); };
    let t = null;
    $('#hlDotaz').addEventListener('input', () => { clearTimeout(t); t = setTimeout(spust, 300); });
    $('#hlDotaz').addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(t); spust(); } });
    $('#hlRezim').addEventListener('change', spust);
    napojFiltr($('#hlFiltr'), H.filtr, vyhledej);
    $('#hlZvyraznit').addEventListener('click', () => { V.nastavZvyrazneni(H.dotaz, H.rezim); V.prepniRezim('prohlizec'); });
    $('#hlCsv').addEventListener('click', () => {
      const k = filtrovano(H.filtr), nal = najdi(k);
      if (!nal) return;
      const radky = [['lokus', 'stránka', 'sekce', 'jazyk', 'písař', 'nalezeno', 'kontext vlevo', 'shoda', 'kontext vpravo', 'řádek']];
      for (const n of nal) { const c = J.kontext(k, n, 5); radky.push([n.r.lokus.id, n.r.stranka.id, J.ILUSTRACE[n.r.I] || n.r.I, n.r.L, n.r.H, n.slovo, c.vlevo.join('.'), c.shoda.join('.'), c.vpravo.join('.'), n.r.text]); }
      stahni('voynich_hledani.csv', '﻿' + J.csv(radky), 'text/csv;charset=utf-8');
    });
    $('#hlVysledky').addEventListener('click', e => {
      const b = e.target.closest('[data-hledat]');
      if (b) { e.preventDefault(); hledej(b.dataset.hledat, 'slovo'); }
      if (e.target.closest('#hlVice')) { H.limit += 400; vyhledej(); }
    });
  }
  function najdi(k) {
    if (!H.dotaz.trim()) return null;
    try { return J.hledej(k, H.dotaz, H.rezim); }
    catch (e) { $('#hlVysledky').innerHTML = `<p style="color:var(--danger)">Chybný výraz: ${esc(e.message)}</p>`; return null; }
  }
  function hledej(dotaz, rezim) {
    if (!$('#hlDotaz')) return;
    H.dotaz = dotaz; if (rezim) H.rezim = rezim;
    else if (/[*?]/.test(dotaz) && H.rezim === 'slovo') H.rezim = 'vzor';
    $('#hlDotaz').value = dotaz; $('#hlRezim').value = H.rezim;
    H.limit = 200;
    if (V.stav.rezim !== 'hledani') V.prepniRezim('hledani', true);
    vyhledej();
    V.zapisHash();
  }
  function vyhledej() {
    const out = $('#hlVysledky');
    const k = filtrovano(H.filtr);
    const nal = najdi(k);
    if (!nal) {
      if (!H.dotaz.trim()) out.innerHTML = `<div class="karta"><h2>Jak hledat</h2><p>Zadejte slovo v přepisu EVA (např. <a href="#" data-hledat="daiin" class="eva">daiin</a>, <a href="#" data-hledat="chedy" class="eva">chedy</a>, <a href="#" data-hledat="qokeedy" class="eva">qokeedy</a>, <a href="#" data-hledat="otaiin" class="eva">otaiin</a>). Výsledky ukážou rozložení v rukopisu, četnost v sekcích a jazycích a všechny výskyty v kontextu (KWIC). Klepnutím na lokus otevřete stránku v prohlížeči.</p><p class="tlumeny male">Prohledává se ${cis(k.slova.length)} slov ve výběru „${esc(popisFiltru(H.filtr))}“ v přepisu ${esc(V.prepis().nazev)}.</p></div>`;
      return;
    }
    const nSlov = k.slova.length;
    const tvary = J.serad(J.cetnosti(nal.map(n => n.slovo)));
    const radku = new Set(nal.map(n => n.r)).size;
    const poStr = {}, slovStr = {};
    for (const s of k.slova) slovStr[s.r.stranka.id] = (slovStr[s.r.stranka.id] || 0) + 1;
    for (const n of nal) poStr[n.r.stranka.id] = (poStr[n.r.stranka.id] || 0) + 1;
    const hustota = {};
    for (const id in poStr) hustota[id] = poStr[id] / (slovStr[id] || 1);
    let h = `<div class="dlazdice">
      <div><b>${cis(nal.length)}</b><span>výskytů</span></div>
      <div><b>${cis(tvary.length)}</b><span>různých tvarů</span></div>
      <div><b>${cis(radku)}</b><span>řádků</span></div>
      <div><b>${Object.keys(poStr).length}</b><span>stránek z ${new Set(k.lokusy.map(r => r.stranka.id)).size}</span></div>
      <div><b>${prom(nal.length / (nSlov || 1))}</b><span>výskytů na slovo výběru</span></div></div>`;
    h += `<h3>Rozložení v rukopisu <span class="tlumeny male">(sytost = výskyty na slovo stránky; klepnutím otevřete stránku)</span></h3>` +
      pruhRukopisu(hustota, (s, v) => `${s.id} · ${J.ILUSTRACE[s.vars.I] || ''}\n${poStr[s.id] || 0} výskytů z ${slovStr[s.id] || 0} slov` + (v ? ` (${prom(v)})` : ''));
    // po sekcích a jazycích
    const skup = (vl, nazvy) => {
      const cel = {}, hit = {};
      for (const s of k.slova) { const x = s.r[vl] || '?'; cel[x] = (cel[x] || 0) + 1; }
      for (const n of nal) { const x = n.r[vl] || '?'; hit[x] = (hit[x] || 0) + 1; }
      return Object.keys(cel).sort((a, b) => (nazvy.indexOf(a) + 99 * (nazvy.indexOf(a) < 0)) - (nazvy.indexOf(b) + 99 * (nazvy.indexOf(b) < 0)))
        .map(x => ({ popis: x, hodnota: 1000 * (hit[x] || 0) / cel[x], n: hit[x] || 0, cel: cel[x] }));
    };
    const sek = skup('I', J.PORADI_ILUSTRACI).map(d => Object.assign(d, { popis: J.ILUSTRACE[d.popis] || d.popis, tip: `${J.ILUSTRACE[d.popis] || d.popis}: ${d.n} výskytů z ${cis(d.cel)} slov\n${des(d.hodnota, 2)} na 1000 slov` }));
    const jaz = skup('L', ['A', 'B', '?']).map(d => Object.assign(d, { popis: d.popis === '?' ? 'neurčen' : 'jazyk ' + d.popis, tip: `${d.n} výskytů z ${cis(d.cel)} slov\n${des(d.hodnota, 2)} na 1000 slov` }));
    const pis = skup('H', ['1', '2', '3', '4', '5', '?']).map(d => Object.assign(d, { popis: d.popis === '?' ? 'neurč.' : 'písař ' + d.popis, tip: `${d.n} výskytů z ${cis(d.cel)} slov\n${des(d.hodnota, 2)} na 1000 slov` }));
    h += `<div class="mrizka3" style="margin-top:14px">
      <div><h3>Na 1000 slov podle sekce</h3>${G.sloupce(sek, { vyska: 200, sikmePopisky: true, popis: 'výskyty podle sekce' })}</div>
      <div><h3>Podle Currierova jazyka</h3>${G.sloupce(jaz, { vyska: 200, popis: 'výskyty podle jazyka' })}</div>
      <div><h3>Podle písaře</h3>${G.sloupce(pis, { vyska: 200, popis: 'výskyty podle písaře' })}</div></div>`;
    if (tvary.length > 1 || H.rezim !== 'slovo') {
      h += `<h3>Nalezené tvary (${tvary.length})</h3><div class="eva" style="line-height:1.9">` +
        tvary.slice(0, 120).map(([w, n]) => `<a href="#" data-hledat="${esc(w)}" title="${n}×">${esc(w)}</a><span class="tlumeny male"> ${n}</span>`).join(' · ') + (tvary.length > 120 ? ' …' : '') + '</div>';
    }
    // KWIC po stránkách
    h += `<h3>Výskyty v kontextu (${cis(nal.length)})</h3>`;
    let posl = null, tab = [];
    const flush = () => { if (tab.length) { h += V.kwicHtml(k, tab, 6); tab = []; } };
    nal.slice(0, H.limit).forEach(n => {
      if (n.r.stranka !== posl) {
        flush();
        posl = n.r.stranka;
        h += `<div class="vysledky-skupina"><a data-otevri="${posl.id}" class="eva">${esc(J.popisStranky(posl.id))}</a><span class="stitek-m">${esc(J.ILUSTRACE[posl.vars.I] || '')}</span>${posl.vars.L ? `<span class="stitek-m">jazyk ${posl.vars.L}</span>` : ''}<span class="tlumeny male">${poStr[posl.id]}×</span></div>`;
      }
      tab.push(n);
    });
    flush();
    if (nal.length > H.limit) h += `<button class="btn" id="hlVice">Zobrazit dalších ${Math.min(400, nal.length - H.limit)}</button>`;
    out.innerHTML = h;
    out.querySelectorAll('[data-otevri]').forEach(a => a.addEventListener('click', () => V.otevriStranku(a.dataset.otevri)));
  }
  V.rezimy.hledani = {
    init: initHledani,
    ukaz: () => { if (!$('#hlDotaz').value && !H.dotaz) vyhledej(); },
    zmenaDat: () => { if ($('#hlDotaz')) vyhledej(); }
  };
  V.hledej = hledej;
  V.dotazHledani = () => H.dotaz;

  // ============ ANALÝZA ============
  const A = { filtr: { jenZakladni: true, bezNejistych: true }, tab: 'souhrn', glyf: 'znaky', hledatSlovo: '', limit: 300, afix: 2, konec: false, norm: 'radek' };
  const TABY_ANALYZY = [['souhrn', 'Souhrn'], ['slova', 'Slova a Zipf'], ['znaky', 'Znaky'], ['prechody', 'Přechody znaků'], ['delky', 'Délky slov'], ['poloha', 'Poloha na řádku'], ['afixy', 'Začátky a konce']];
  function initAnalyzy() {
    $('#obsahAnalyzy').innerHTML = `${filtrHtml('anFiltr', A.filtr)}
      <div class="radek-formu">
        <div class="podtaby" id="anTaby" style="margin:0">${TABY_ANALYZY.map(([k, n]) => `<button class="btn${k === A.tab ? ' zap' : ''}" data-tab="${k}">${n}</button>`).join('')}</div>
        <label class="prep" style="margin-left:auto" title="Znaky = písmena EVA. Glyfy = ch, sh, cth, ckh, cph, cfh se počítají jako jeden znak.">Jednotka
          <select id="anGlyf"><option value="znaky">písmena EVA</option><option value="glyfy">glyfy (ch, sh, cth…)</option></select></label>
      </div>
      <div id="anVystup"></div>`;
    $('#anGlyf').value = A.glyf;
    napojFiltr($('#anFiltr'), A.filtr, kresliAnalyzu);
    $('#anTaby').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; A.tab = b.dataset.tab; $('#anTaby').querySelectorAll('button').forEach(x => x.classList.toggle('zap', x === b)); kresliAnalyzu(); });
    $('#anGlyf').addEventListener('change', e => { A.glyf = e.target.value; kresliAnalyzu(); });
    $('#anVystup').addEventListener('click', e => {
      const s = e.target.closest('[data-slovo]');
      if (s) { e.preventDefault(); hledej(s.dataset.slovo, 'slovo'); return; }
      const r = e.target.closest('tr[data-w]');
      if (r) { hledej(r.dataset.w, r.dataset.rezim || 'slovo'); return; }
      if (e.target.closest('#anVice')) { A.limit += 500; kresliAnalyzu(); }
      const ex = e.target.closest('[data-export]');
      if (ex) exportAnalyzy(ex.dataset.export);
    });
    $('#anVystup').addEventListener('input', e => { if (e.target.id === 'anHledat') { A.hledatSlovo = e.target.value; clearTimeout(A._t); A._t = setTimeout(() => { kresliAnalyzu(); const el = $('#anHledat'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }, 250); } });
    $('#anVystup').addEventListener('change', e => {
      if (e.target.id === 'anAfix') { A.afix = +e.target.value; kresliAnalyzu(); }
      if (e.target.id === 'anKonec') { A.konec = e.target.value === 'konec'; kresliAnalyzu(); }
      if (e.target.id === 'anNorm') { A.norm = e.target.value; kresliAnalyzu(); }
    });
  }
  function metriky(k) { return J.souhrn(k, A.glyf); }
  function radekMetrik(nazev, m) {
    return [esc(nazev), cis(m.tokenu), cis(m.typu), des(m.ttr, 3), cis(m.hapax), des(m.prumernaDelka, 2), des(m.h1, 3), des(m.h2, 3)];
  }
  const HLAV_METRIK = [{ n: 'Skupina' }, { n: 'Slov', cis: 1 }, { n: 'Různých', cis: 1 }, { n: 'TTR', cis: 1 }, { n: 'Hapax', cis: 1 }, { n: 'Prům. délka', cis: 1 }, { n: 'h1 [bit]', cis: 1 }, { n: 'h2 [bit]', cis: 1 }];
  function kresliAnalyzu() {
    const out = $('#anVystup');
    if (!out) return;
    const k = filtrovano(A.filtr);
    if (!k.slova.length) { out.innerHTML = '<p class="tlumeny">Výběru neodpovídá žádný text.</p>'; return; }
    const t = A.tab;
    let h = '';
    if (t === 'souhrn') {
      const m = metriky(k);
      h += `<div class="dlazdice">
        <div><b>${cis(m.tokenu)}</b><span>slov (tokenů)</span></div><div><b>${cis(m.typu)}</b><span>různých slov</span></div>
        <div><b>${cis(m.hapax)}</b><span>hapax legomena (${pct(m.hapax / (m.typu || 1))} typů)</span></div>
        <div><b>${des(m.ttr, 3)}</b><span>poměr typy/tokeny</span></div>
        <div><b>${des(m.prumernaDelka, 2)}</b><span>průměrná délka slova</span></div>
        <div><b>${cis(m.radku)}</b><span>řádků/položek · ${m.stranek} stran</span></div>
        <div><b>${m.abeceda}</b><span>různých ${A.glyf === 'glyfy' ? 'glyfů' : 'znaků'} (vč. mezery)</span></div>
        <div><b>${des(m.h0, 2)}</b><span>h0 = log₂ abecedy [bit]</span></div>
        <div><b>${des(m.h1, 3)}</b><span>h1 entropie znaků [bit]</span></div>
        <div><b>${des(m.h2, 3)}</b><span>h2 podmíněná entropie [bit]</span></div></div>
        <p class="male tlumeny">Entropie se počítá nad textem řádků (slova oddělená mezerou). Nízká podmíněná entropie h2 (kolem 2 bitů proti zhruba 3 bitům u evropských jazyků) je jedna z nejznámějších zvláštností voynichštiny – další znak je neobvykle dobře předvídatelný z předchozího. TTR závisí na velikosti vzorku, srovnávejte jen podobně velké skupiny.</p>`;
      const skupiny = (nazev, vl, poradi, popis) => {
        const r = [];
        for (const v of poradi) {
          const f = Object.assign({}, A.filtr, { [vl]: [v] });
          if (A.filtr[vl] && A.filtr[vl].length && !A.filtr[vl].includes(v)) continue;
          const kk = filtrovano(f);
          if (kk.slova.length < 30) continue;
          r.push({ b: radekMetrik(popis(v), metriky(kk)) });
        }
        return `<h3>${nazev}</h3>` + tabulka(HLAV_METRIK, r);
      };
      h += skupiny('Podle sekce', 'I', J.PORADI_ILUSTRACI, v => J.ILUSTRACE[v]);
      h += '<div class="mrizka2">' + skupiny('Podle Currierova jazyka', 'L', ['A', 'B', '?'], v => v === '?' ? 'neurčen' : 'jazyk ' + v) +
        skupiny('Podle písaře (Davis)', 'H', ['1', '2', '3', '4', '5', '?'], v => v === '?' ? 'neurčen' : 'písař ' + v) + '</div>';
      h += skupiny('Podle druhu textu', 'druh', ['P', 'L', 'C', 'R'], v => J.DRUH_LOKUSU[v]);
    } else if (t === 'slova') {
      const f = J.frekvenceSlov(k);
      const body = f.map(z => ({ x: z.poradi, y: z.n, slovo: z.w, tip: `${z.poradi}. ${z.w}: ${z.n}×` }));
      h += `<h3>Zipfův graf <span class="tlumeny male">(čárkovaně ideální Zipfův zákon 1/r; klepnutím na bod slovo vyhledáte)</span></h3>` + G.zipf([{ nazev: 'slova', barva: 'var(--accent)', body }], { idealni: true });
      let kum = 0;
      const q = A.hledatSlovo.trim();
      let re = null;
      try { re = q ? J.sestavDotaz(q, /[*?]/.test(q) ? 'vzor' : 'obsahuje').re : null; } catch (_) { re = null; }
      const radky = [];
      for (const z of f) {
        kum += z.podil;
        if (re && !re.test(z.w)) continue;
        if (radky.length >= A.limit) break;
        radky.push({ klik: 1, data: `data-w="${esc(z.w)}"`, b: [z.poradi, esc(z.w), cis(z.n), prom(z.podil), pct(kum)] });
      }
      h += `<div class="radek-formu" style="margin-top:12px"><h3 style="margin:0">Četnosti slov</h3><input type="search" id="anHledat" class="eva" placeholder="filtr (obsahuje / vzor)" value="${esc(A.hledatSlovo)}" style="max-width:220px"><button class="btn" data-export="slova">⬇ CSV všech slov</button><span class="tlumeny male">Klepnutím na řádek slovo vyhledáte.</span></div>` +
        tabulka([{ n: 'Pořadí', cis: 1 }, { n: 'Slovo', eva: 1 }, { n: 'Počet', cis: 1 }, { n: 'Podíl', cis: 1 }, { n: 'Kumulativně', cis: 1 }], radky);
      if (radky.length >= A.limit) h += '<button class="btn" id="anVice" style="margin-top:6px">Zobrazit další</button>';
    } else if (t === 'znaky') {
      const z = J.znaky(k, A.glyf);
      const barvy = ['var(--rada-1)', 'var(--rada-2)', 'var(--rada-3)', 'var(--rada-4)'];
      const nazvy = ['na začátku', 'uvnitř', 'na konci', 'samostatně'];
      h += `<h3>Četnost ${A.glyf === 'glyfy' ? 'glyfů' : 'znaků'}</h3>` + G.sloupce(z.slice(0, 40).map(x => ({ popis: x.g, hodnota: x.podil * 100, tip: `${x.g}: ${cis(x.n)}× (${pct(x.podil)})` })), { formatY: v => G.cislo(v) + ' %', vyska: 220 });
      h += `<h3>Poloha ve slově</h3><div class="legenda">${nazvy.map((n, i) => `<span><i style="background:${barvy[i]}"></i>${n}</span>`).join('')}</div>` +
        tabulka([{ n: 'Znak', eva: 1 }, { n: 'Počet', cis: 1 }, { n: 'Podíl', cis: 1 }, { n: 'Poloha' }, { n: 'Začátek', cis: 1 }, { n: 'Uvnitř', cis: 1 }, { n: 'Konec', cis: 1 }, { n: 'Samostatně', cis: 1 }],
          z.map(x => ({ b: [esc(x.g), cis(x.n), pct(x.podil, 2), G.pruh([x.zacatek, x.uvnitr, x.konec, x.samo].map((v, i) => ({ nazev: nazvy[i], barva: barvy[i], podil: v / x.n }))), pct(x.zacatek / x.n), pct(x.uvnitr / x.n), pct(x.konec / x.n), pct(x.samo / x.n)] })), { vyska: 640 });
      h += '<p class="male tlumeny">Silná vazba znaků na polohu (q skoro jen na začátku, n a m na konci, šibenice t k p f hlavně uvnitř a na začátku) odlišuje voynichštinu od běžných abeced.</p>';
    } else if (t === 'prechody') {
      const b = J.bigramy(k, A.glyf, true);
      const top = J.znaky(k, A.glyf).slice(0, 22).map(x => x.g);
      const radky = ['^'].concat(top), sloupce = top.concat(['$']);
      const popisZ = g => g === '^' ? 'začátek slova' : g === '$' ? 'konec slova' : g;
      h += `<div class="radek-formu"><h3 style="margin:0">Přechod znak → další znak</h3>
        <select id="anNorm"><option value="radek">P(další | znak) – po řádcích</option><option value="sloupec">P(předchozí | znak) – po sloupcích</option><option value="celek">podíl všech dvojic</option></select></div>
        <p class="male tlumeny" style="margin-top:0">Řádek = znak, sloupec = znak, který po něm následuje; ^ začátek a $ konec slova. Sytost i číslo (v %) ukazují pravděpodobnost.</p>`;
      h += G.heatmapa(radky, sloupce, (a, c) => {
        const n = b.pocet(a, c);
        const jm = A.norm === 'radek' ? b.soucetRadku(a) : A.norm === 'sloupec' ? b.soucetSloupce(c) : b.celkem;
        const p = jm ? n / jm : 0;
        return { v: A.norm === 'celek' ? Math.sqrt(p * 20) : p, text: p >= (A.norm === 'celek' ? 0.01 : 0.1) ? Math.round(p * 100) : '', tip: `${popisZ(a)} → ${popisZ(c)}\n${cis(n)}× · ${pct(p)}` };
      }, { bunka: 24, levyOkraj: 46, popis: 'matice přechodů' });
      setTimeout(() => { const s = $('#anNorm'); if (s) s.value = A.norm; });
    } else if (t === 'delky') {
      const tok = J.delkySlov(k, A.glyf);
      const typy = new Map();
      for (const w of new Set(k.slova.map(s => s.w))) { const d = J.glyfy(w, A.glyf).length; typy.set(d, (typy.get(d) || 0) + 1); }
      const nT = k.slova.length, nTy = Array.from(typy.values()).reduce((a, b) => a + b, 0);
      const kat = tok.filter(x => x.d <= 15);
      h += '<h3>Rozložení délek slov</h3>' + G.skupiny(kat.map(x => String(x.d)), [
        { nazev: 'výskyty slov', barva: 'var(--rada-1)', hodnoty: kat.map(x => 100 * x.n / nT) },
        { nazev: 'různá slova', barva: 'var(--rada-2)', hodnoty: kat.map(x => 100 * (typy.get(x.d) || 0) / nTy) }
      ], { formatY: v => G.cislo(v) + ' %', popis: 'délky slov' });
      h += '<p class="male tlumeny">Voynichština má neobvykle úzké, téměř binomické rozložení délek slov (Stolfi) – krátká i dlouhá slova jsou vzácnější než v přirozených jazycích.</p>';
      h += tabulka([{ n: 'Délka', cis: 1 }, { n: 'Výskytů', cis: 1 }, { n: 'Podíl', cis: 1 }, { n: 'Různých slov', cis: 1 }],
        tok.map(x => ({ b: [x.d, cis(x.n), pct(x.n / nT), cis(typy.get(x.d) || 0)] })), { vyska: 360 });
    } else if (t === 'poloha') {
      const p = J.polohy(k);
      const celk = new Map(J.frekvenceSlov(k).map(z => [z.w, z.podil]));
      const tab = (nadpis, data, sZvednutim) => `<div><h3>${nadpis}</h3>` + tabulka(
        [{ n: 'Slovo', eva: 1 }, { n: 'Počet', cis: 1 }, { n: 'Podíl', cis: 1 }].concat(sZvednutim ? [{ n: '× oproti celku', cis: 1 }] : []),
        data.slice(0, 40).map(x => ({ klik: 1, data: `data-w="${esc(x.w)}"`, b: [esc(x.w), cis(x.n), pct(x.podil)].concat(sZvednutim ? [des(x.podil / (celk.get(x.w) || 1e-9), 1)] : []) })), { vyska: 420 }) + '</div>';
      h += `<p class="male tlumeny">Jen řádky odstavců (${cis(p.radku)} řádků, ${cis(p.odstavcu)} odstavců). Sloupec „× oproti celku“ říká, kolikrát je slovo na dané pozici častější než v textu obecně – řádky voynichštiny mají vlastní „začátky“ a „konce“ (tzv. line as a functional unit).</p>`;
      h += '<div class="mrizka3">' + tab('První slovo řádku', p.prvniNaRadku, true) + tab('Poslední slovo řádku', p.posledniNaRadku, true) + tab('První slovo odstavce', p.prvniVOdstavci, true) + '</div>';
      const zn = (nadpis, d) => `<div><h3>${nadpis}</h3>` + G.sloupce(d.slice(0, 16).map(x => ({ popis: x.w, hodnota: x.podil * 100, tip: `${x.w}: ${x.n}× (${pct(x.podil)})` })), { formatY: v => G.cislo(v) + ' %', vyska: 190 }) + '</div>';
      h += '<div class="mrizka2">' + zn('První znak odstavce', p.prvniZnakOdstavce) + zn('První znak řádku', p.prvniZnakRadku) + '</div>';
      h += '<p class="male tlumeny">Odstavce téměř vždy začínají „šibenicí“ (t, k, p, f), zatímco p a f se uvnitř textu objevují hlavně v prvních řádcích odstavců.</p>';
    } else if (t === 'afixy') {
      const d = J.afixy(k, A.afix, A.konec);
      const n = d.reduce((a, x) => a + x.n, 0);
      h += `<div class="radek-formu"><select id="anKonec"><option value="zacatek">začátky slov</option><option value="konec">konce slov</option></select>
        <label class="prep">délka <select id="anAfix">${[1, 2, 3, 4].map(x => `<option>${x}</option>`).join('')}</select></label>
        <span class="tlumeny male">Jen slova delší než zvolená délka. Klepnutím vyhledáte slova s tímto ${A.konec ? 'koncem' : 'začátkem'}.</span></div>`;
      h += G.sloupce(d.slice(0, 30).map(x => ({ popis: x.w, hodnota: 100 * x.n / n, tip: `${x.w}: ${x.n}× (${pct(x.n / n)})` })), { sikmePopisky: true, formatY: v => G.cislo(v) + ' %' });
      h += tabulka([{ n: A.konec ? 'Konec' : 'Začátek', eva: 1 }, { n: 'Počet', cis: 1 }, { n: 'Podíl', cis: 1 }],
        d.slice(0, 200).map(x => ({ klik: 1, data: `data-w="${esc(A.konec ? '*' + x.w : x.w + '*')}" data-rezim="vzor"`, b: [esc(x.w), cis(x.n), pct(x.n / n)] })), { vyska: 400 });
      setTimeout(() => { const a = $('#anAfix'), b = $('#anKonec'); if (a) a.value = A.afix; if (b) b.value = A.konec ? 'konec' : 'zacatek'; });
    }
    out.innerHTML = h;
  }
  function exportAnalyzy(co) {
    if (co === 'slova') {
      const f = J.frekvenceSlov(filtrovano(A.filtr));
      stahni('voynich_cetnosti_slov.csv', '﻿' + J.csv([['pořadí', 'slovo', 'počet', 'podíl']].concat(f.map(z => [z.poradi, z.w, z.n, z.podil.toFixed(6)]))), 'text/csv;charset=utf-8');
    }
  }
  V.rezimy.analyza = { init: initAnalyzy, ukaz: kresliAnalyzu, zmenaDat: () => { if (V.stav.rezim === 'analyza') kresliAnalyzu(); } };

  // ============ SROVNÁNÍ ============
  const S = { a: { L: ['A'], jenZakladni: true }, b: { L: ['B'], jenZakladni: true }, tab: 'skupiny', druhyPrepis: 'it', min: 8 };
  const PREDVOLBY = {
    'Currierův jazyk A × B': [{ L: ['A'] }, { L: ['B'] }],
    'Bylinná A × bylinná B': [{ I: ['H'], L: ['A'] }, { I: ['H'], L: ['B'] }],
    'Písař 1 × písař 2': [{ H: ['1'] }, { H: ['2'] }],
    'Písař 2 × písař 3': [{ H: ['2'] }, { H: ['3'] }],
    'Biologická × recepty': [{ I: ['B'] }, { I: ['S'] }],
    'Bylinná × farmaceutická': [{ I: ['H'] }, { I: ['P'] }],
    'Odstavce × popisky': [{ druh: ['P'] }, { druh: ['L'] }],
    'Zvěrokruh × kosmologická': [{ I: ['Z'] }, { I: ['C'] }]
  };
  function initSrovnani() { kresliSrovnaniKostru(); }
  function kresliSrovnaniKostru() {
    $('#obsahSrovnani').innerHTML = `
      <div class="podtaby" id="srTaby"><button class="btn${S.tab === 'skupiny' ? ' zap' : ''}" data-tab="skupiny">Dvě skupiny textu</button><button class="btn${S.tab === 'prepisy' ? ' zap' : ''}" data-tab="prepisy">Shoda přepisů</button></div>
      <div id="srObsah"></div>`;
    $('#srTaby').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.tab = b.dataset.tab; kresliSrovnaniKostru(); kresliSrovnani(); });
    const o = $('#srObsah');
    if (S.tab === 'skupiny') {
      o.innerHTML = `<div class="radek-formu"><label class="prep">Předvolba <select id="srPredvolba"><option value="">– vlastní –</option>${Object.keys(PREDVOLBY).map(k => `<option>${esc(k)}</option>`).join('')}</select></label>
        <label class="prep" title="Slova s menším součtem výskytů se v tabulce klíčových slov vynechají">min. výskytů <input type="number" id="srMin" value="${S.min}" min="2" max="100" style="width:64px"></label></div>
        <div class="mrizka2">${filtrHtml('srA', S.a, 'Skupina A')}${filtrHtml('srB', S.b, 'Skupina B')}</div><div id="srVystup"></div>`;
      napojFiltr($('#srA'), S.a, kresliSrovnani);
      napojFiltr($('#srB'), S.b, kresliSrovnani);
      $('#srPredvolba').addEventListener('change', e => {
        const p = PREDVOLBY[e.target.value];
        if (!p) return;
        S.a = Object.assign({ jenZakladni: true }, JSON.parse(JSON.stringify(p[0])));
        S.b = Object.assign({ jenZakladni: true }, JSON.parse(JSON.stringify(p[1])));
        const v = e.target.value;
        kresliSrovnaniKostru();
        $('#srPredvolba').value = v;
        kresliSrovnani();
      });
      $('#srMin').addEventListener('change', e => { S.min = Math.max(2, +e.target.value || 8); kresliSrovnani(); });
      $('#srVystup').addEventListener('click', e => { const r = e.target.closest('tr[data-w], [data-slovo]'); if (r) hledej(r.dataset.w || r.dataset.slovo, 'slovo'); });
    } else {
      o.innerHTML = `<div class="radek-formu"><label class="prep">Porovnat aktuální přepis (${esc(V.prepis().nazev)}) s
        <select id="srDruhy">${V.PREPISY.filter(p => p.kod !== V.stav.prepis).map(p => `<option value="${p.kod}">${esc(p.nazev)}</option>`).join('')}</select></label></div><div id="srVystup"></div>`;
      if (S.druhyPrepis === V.stav.prepis) S.druhyPrepis = V.PREPISY.find(p => p.kod !== V.stav.prepis).kod;
      $('#srDruhy').value = S.druhyPrepis;
      $('#srDruhy').addEventListener('change', e => { S.druhyPrepis = e.target.value; kresliSrovnani(); });
      $('#srVystup').addEventListener('click', e => {
        const r = e.target.closest('tr[data-str]');
        if (r) { V.stav.porovnat = S.druhyPrepis; V.stav.tab = 'prepis'; V.ulozStav(); V.otevriStranku(r.dataset.str); }
      });
    }
  }
  async function kresliSrovnani() {
    const out = $('#srVystup');
    if (!out) return;
    if (S.tab === 'prepisy') {
      out.innerHTML = '<p class="tlumeny">Načítám druhý přepis…</p>';
      try { await V.nactiPrepis(S.druhyPrepis); } catch (e) { out.innerHTML = `<p style="color:var(--danger)">${esc(e.message)}</p>`; return; }
      const s = J.shodaPrepisu(V.korpus(), V.korpus(S.druhyPrepis));
      const shoda = s.reduce((a, x) => a + x.shoda, 0), celk = s.reduce((a, x) => a + x.celkem, 0);
      const hod = {}; s.forEach(x => { hod[x.stranka] = 1 - x.podil; });
      let h = `<div class="dlazdice"><div><b>${pct(shoda / (celk || 1))}</b><span>shodných slov v řádcích se stejným lokusem</span></div><div><b>${s.length}</b><span>stránek</span></div><div><b>${cis(s.reduce((a, x) => a + x.radkuBezProtejsku, 0))}</b><span>řádků bez protějšku</span></div></div>
        <h3>Kde se přepisy nejvíc liší <span class="tlumeny male">(sytost = podíl rozdílných slov)</span></h3>` +
        pruhRukopisu(hod, (st, v) => `${st.id}: ${pct(v)} slov se liší`) +
        `<p class="male tlumeny">Klepnutím na řádek otevřete stránku v prohlížeči s barevně vyznačenými rozdíly (červeně záměna či chybějící slovo, zeleně slovo navíc). Rozdíly mezi přepisovateli ukazují, kde je čtení písma nejisté – na to je dobré myslet u každé statistiky.</p>`;
      h += tabulka([{ n: 'Stránka', eva: 1 }, { n: 'Sekce' }, { n: 'Shoda', cis: 1 }, { n: 'Slov', cis: 1 }, { n: 'Řádků bez protějšku', cis: 1 }],
        s.slice().sort((a, b) => a.podil - b.podil).map(x => ({ klik: 1, data: `data-str="${x.stranka}"`, b: [esc(x.stranka), esc(J.ILUSTRACE[V.prepis().podleId[x.stranka].vars.I] || ''), pct(x.podil), cis(x.celkem), x.radkuBezProtejsku] })), { vyska: 520 });
      out.innerHTML = h;
      return;
    }
    const kA = filtrovano(S.a), kB = filtrovano(S.b);
    if (!kA.slova.length || !kB.slova.length) { out.innerHTML = '<p class="tlumeny">Jedna ze skupin je prázdná – upravte výběr.</p>'; return; }
    const mA = J.souhrn(kA, 'znaky'), mB = J.souhrn(kB, 'znaky');
    const fa = J.frekvenceSlov(kA), fb = J.frekvenceSlov(kB);
    const spol = new Set(fa.map(x => x.w).filter(w => fb.some(y => y.w === w)));
    let h = `<h3>Souhrn</h3>` + tabulka(HLAV_METRIK, [
      { b: radekMetrik('A: ' + popisFiltru(S.a), mA) }, { b: radekMetrik('B: ' + popisFiltru(S.b), mB) }]) +
      `<p class="male tlumeny">Společných různých slov: ${cis(spol.size)} (${pct(spol.size / mA.typu)} slovníku A, ${pct(spol.size / mB.typu)} slovníku B).</p>`;
    const kl = J.klicovaSlova(kA, kB, S.min);
    const radkyKl = arr => arr.map(x => ({ klik: 1, data: `data-w="${esc(x.w)}"`, b: [esc(x.w), cis(x.a), prom(x.pa), cis(x.b), prom(x.pb), des(Math.abs(x.g2), 1), des(x.logPomer, 2)] }));
    const hlKl = [{ n: 'Slovo', eva: 1 }, { n: 'A ×', cis: 1 }, { n: 'A ‰', cis: 1 }, { n: 'B ×', cis: 1 }, { n: 'B ‰', cis: 1 }, { n: 'G²', cis: 1 }, { n: 'log₂ A/B', cis: 1 }];
    h += `<h3>Klíčová slova <span class="tlumeny male">(log-likelihood G²; nad 10,8 je rozdíl významný na hladině 0,001)</span></h3><div class="mrizka2">
      <div><h3 style="color:var(--rada-1)">Typická pro A</h3>${tabulka(hlKl, radkyKl(kl.filter(x => x.g2 > 0).slice(0, 60)), { vyska: 420 })}</div>
      <div><h3 style="color:var(--rada-2)">Typická pro B</h3>${tabulka(hlKl, radkyKl(kl.filter(x => x.g2 < 0).slice(0, 60)), { vyska: 420 })}</div></div>`;
    const zA = J.znaky(kA, 'znaky'), zB = new Map(J.znaky(kB, 'znaky').map(x => [x.g, x.podil]));
    const top = zA.slice(0, 22);
    h += '<h3>Četnost znaků</h3>' + G.skupiny(top.map(x => x.g), [
      { nazev: 'A', barva: 'var(--rada-1)', hodnoty: top.map(x => 100 * x.podil) },
      { nazev: 'B', barva: 'var(--rada-2)', hodnoty: top.map(x => 100 * (zB.get(x.g) || 0)) }], { formatY: v => G.cislo(v) + ' %' });
    const dA = J.delkySlov(kA, 'znaky'), dB = J.delkySlov(kB, 'znaky');
    const dk = []; for (let d = 1; d <= 13; d++) dk.push(d);
    const podil = (arr, n, d) => 100 * ((arr.find(x => x.d === d) || { n: 0 }).n) / n;
    h += '<div class="mrizka2"><div><h3>Délky slov</h3>' + G.skupiny(dk.map(String), [
      { nazev: 'A', barva: 'var(--rada-1)', hodnoty: dk.map(d => podil(dA, kA.slova.length, d)) },
      { nazev: 'B', barva: 'var(--rada-2)', hodnoty: dk.map(d => podil(dB, kB.slova.length, d)) }], { formatY: v => G.cislo(v) + ' %' }) + '</div>';
    const zipfBody = f => f.filter((_, i) => i < 50 || i % 5 === 0).map(z => ({ x: z.poradi, y: z.n, slovo: z.w, tip: `${z.poradi}. ${z.w}: ${z.n}×` }));
    h += '<div><h3>Zipf</h3>' + G.zipf([{ nazev: 'A', barva: 'var(--rada-1)', body: zipfBody(fa) }, { nazev: 'B', barva: 'var(--rada-2)', body: zipfBody(fb) }], { vyska: 240 }) + '</div></div>';
    out.innerHTML = h;
  }
  V.rezimy.srovnani = { init: initSrovnani, ukaz: kresliSrovnani, zmenaDat: () => { if (V.stav.rezim === 'srovnani') { kresliSrovnaniKostru(); } } };

  // ============ FOLIA ============
  const F = { filtr: '' };
  function kresliFolia() {
    const el = $('#obsahFolii');
    const zl = V.prepis('zl'), k = V.korpus('zl');
    const poStr = new Map();
    for (const r of k.lokusy) {
      let z = poStr.get(r.stranka.id);
      if (!z) { z = { radku: 0, slov: 0, typy: new Set(), druhy: new Set() }; poStr.set(r.stranka.id, z); }
      z.radku++; z.slov += r.slova.length; r.slova.forEach(w => z.typy.add(w)); z.druhy.add(r.lokus.druh);
    }
    // složky
    const slozky = new Map();
    for (const s of zl.stranky) {
      const q = s.vars.Q || '?';
      let z = slozky.get(q);
      if (!z) { z = { q, stranky: [], I: new Map(), L: new Set(), H: new Set(), slov: 0 }; slozky.set(q, z); }
      z.stranky.push(s.id); z.I.set(s.vars.I, (z.I.get(s.vars.I) || 0) + 1);
      if (s.vars.L) z.L.add(s.vars.L); if (s.vars.H && s.vars.H !== '@') z.H.add(s.vars.H);
      z.slov += (poStr.get(s.id) || { slov: 0 }).slov;
    }
    let h = `<h2>Složky (kvaterniony)</h2><p class="male tlumeny" style="margin-top:0">Rukopis je svázán z 18 dochovaných složek (A–T, číslováno 1–20; P a R se nepoužívají, některé listy chybějí). Údaje o složkách, jazyku a písařích pocházejí z hlaviček přepisu ZL.</p>` +
      tabulka([{ n: 'Složka' }, { n: 'Stránky', eva: 1 }, { n: 'Počet', cis: 1 }, { n: 'Sekce' }, { n: 'Jazyk' }, { n: 'Písaři' }, { n: 'Slov', cis: 1 }],
        Array.from(slozky.values()).map(z => ({ b: [z.q, esc(z.stranky[0] + ' – ' + z.stranky[z.stranky.length - 1]), z.stranky.length, esc(Array.from(z.I.entries()).map(([i, n]) => (J.ILUSTRACE[i] || i) + ' ' + n).join(', ')), Array.from(z.L).sort().join(', ') || '–', Array.from(z.H).sort().join(', ') || '–', cis(z.slov)] })), { vyska: 460 });
    h += `<div class="radek-formu" style="margin-top:18px"><h2 style="margin:0">Všechny stránky (${zl.stranky.length})</h2><input type="search" id="foFiltr" placeholder="filtr: f68, bylinná, jazyk B, písař 3…" value="${esc(F.filtr)}" style="max-width:300px"><button class="btn" id="foCsv">⬇ CSV</button><span class="tlumeny male">Klepnutím na řádek otevřete stránku.</span></div>`;
    const radky = zl.stranky.map(s => {
      const v = s.vars, z = poStr.get(s.id) || { radku: 0, slov: 0, typy: new Set(), druhy: new Set() };
      const sn = V.snimekStranky[s.id];
      return { s, v, z, sn, hledatelne: [s.id, J.ILUSTRACE[v.I], 'jazyk ' + (v.L || '-'), 'písař ' + (v.H || '-'), 'složka ' + v.Q].join(' ').toLowerCase() };
    });
    const q = F.filtr.trim().toLowerCase();
    const vyb = q ? radky.filter(r => q.split(/\s*,\s*|\s+(?=f\d)/).some(c => r.hledatelne.includes(c))) : radky;
    h += tabulka([{ n: 'Stránka', eva: 1 }, { n: 'Snímek', cis: 1 }, { n: 'Složka' }, { n: 'Str. ve složce' }, { n: 'Dvojlist', cis: 1 }, { n: 'Sekce' }, { n: 'Jazyk' }, { n: 'Písař' }, { n: 'Currier' }, { n: 'Cizí písmo' }, { n: 'Položek', cis: 1 }, { n: 'Slov', cis: 1 }, { n: 'Různých', cis: 1 }, { n: 'Druhy textu' }],
      vyb.map(r => ({ klik: 1, data: `data-str="${r.s.id}"`, b: [esc(J.popisStranky(r.s.id)), r.sn + 1, r.v.Q || '', r.v.P || '', r.v.B || '', esc(J.ILUSTRACE[r.v.I] || r.v.I || ''), r.v.L || '–', r.v.H === '@' ? 'víc' : r.v.H || '–', r.v.C || '–', r.v.X ? esc(J.MALBA.X[r.v.X] || r.v.X) : '', r.z.radku, r.z.slov, r.z.typy.size, Array.from(r.z.druhy).map(d => J.DRUH_LOKUSU[d]).join(', ')] })), { vyska: 640 });
    el.innerHTML = h;
    $('#foFiltr').addEventListener('input', e => { F.filtr = e.target.value; clearTimeout(F._t); F._t = setTimeout(() => { kresliFolia(); const f = $('#foFiltr'); f.focus(); f.setSelectionRange(f.value.length, f.value.length); }, 250); });
    $('#foCsv').addEventListener('click', () => {
      const rows = [['stránka', 'snímek', 'složka', 'strana ve složce', 'list', 'dvojlist', 'ilustrace', 'jazyk', 'písař', 'Currierova ruka', 'cizí písmo', 'položek', 'slov', 'různých slov']];
      radky.forEach(r => rows.push([r.s.id, r.sn + 1, r.v.Q, r.v.P, r.v.F, r.v.B, r.v.I, r.v.L, r.v.H, r.v.C, r.v.X, r.z.radku, r.z.slov, r.z.typy.size]));
      stahni('voynich_folia.csv', '﻿' + J.csv(rows), 'text/csv;charset=utf-8');
    });
  }
  V.rezimy.folia = {
    init: () => $('#obsahFolii').addEventListener('click', e => { const r = e.target.closest('tr[data-str]'); if (r) V.otevriStranku(r.dataset.str); }),
    ukaz: kresliFolia
  };

  // ============ POZNÁMKY ============
  function kresliPoznamky() {
    const el = $('#obsahPoznamek');
    const pz = V.poznamky(), zal = V.zalozky();
    const klice = Object.keys(pz).map(Number).sort((a, b) => a - b);
    let h = `<h2>Poznámky a záložky</h2><p class="male tlumeny" style="margin-top:0">Ukládají se jen v tomto prohlížeči (localStorage). Pro jistotu si je občas stáhněte jako zálohu; import je sloučí s existujícími.</p>
      <div class="radek-formu"><button class="btn" id="pzJson">⬇ Záloha JSON</button><button class="btn" id="pzMd">⬇ Markdown</button>
      <label class="btn" style="cursor:pointer">⬆ Import JSON<input type="file" id="pzImport" accept=".json,application/json" hidden></label>
      <button class="btn" id="pzSmazat">🗑 Smazat vše</button></div>`;
    h += `<h3>Záložky (${zal.length})</h3>` + (zal.length ? '<div class="radek-formu">' + zal.map(i => `<button class="btn eva" data-snimek="${i}">★ ${esc(V.kratkyPopis(V.SNIMKY[i]))}</button>`).join('') + '</div>' : '<p class="tlumeny male">Žádné. Záložku přidáte v prohlížeči tlačítkem ☆ nebo klávesou B.</p>');
    h += `<h3>Poznámky (${klice.length})</h3>`;
    if (!klice.length) h += '<p class="tlumeny male">Žádné. Poznámku napíšete v prohlížeči na kartě „Poznámka“ vpravo.</p>';
    for (const i of klice) {
      const s = V.SNIMKY[i];
      h += `<div class="karta" style="margin-bottom:8px;display:flex;gap:12px"><img src="${V.urlNahledu(s)}" alt="" style="width:64px;height:84px;object-fit:contain;background:#000;border-radius:4px;flex:none">
        <div style="min-width:0;flex:1"><a href="#" data-snimek="${i}"><b class="eva">${esc(V.popisSnimku(s))}</b></a> <span class="tlumeny male">${pz[i].zmeneno ? new Date(pz[i].zmeneno).toLocaleString('cs-CZ') : ''}</span>
        <div style="white-space:pre-wrap;margin-top:4px;font-size:.9rem">${esc(pz[i].text)}</div></div></div>`;
    }
    el.innerHTML = h;
    el.querySelectorAll('[data-snimek]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); V.stav.tab = 'poznamka'; V.jdiNa(+b.dataset.snimek); }));
    $('#pzJson').addEventListener('click', () => stahni('voynich_poznamky.json', JSON.stringify({ format: 'voynich-poznamky', verze: 1, poznamky: Object.fromEntries(klice.map(i => [V.SNIMKY[i].n, Object.assign({ stranky: V.SNIMKY[i].stranky }, pz[i])])), zalozky: zal.map(i => V.SNIMKY[i].n) }, null, 1), 'application/json'));
    $('#pzMd').addEventListener('click', () => stahni('voynich_poznamky.md', '# Poznámky k Voynichovu rukopisu\n\n' + klice.map(i => `## ${V.popisSnimku(V.SNIMKY[i])} (snímek ${V.SNIMKY[i].n})\n\n${pz[i].text}\n`).join('\n'), 'text/markdown;charset=utf-8'));
    $('#pzImport').addEventListener('change', async e => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const d = JSON.parse(await f.text());
        if (d.format !== 'voynich-poznamky') throw new Error('to není záloha poznámek k Voynichovu rukopisu');
        const nove = Object.assign({}, pz);
        let n = 0;
        for (const [cislo, p] of Object.entries(d.poznamky || {})) {
          const i = +cislo - 1;
          if (!V.SNIMKY[i] || typeof p.text !== 'string') continue;
          if (nove[i] && nove[i].text !== p.text) nove[i] = { text: nove[i].text + '\n\n— importováno —\n' + p.text, zmeneno: Date.now() };
          else nove[i] = { text: p.text, zmeneno: p.zmeneno || Date.now() };
          n++;
        }
        V.nastavPoznamky(nove);
        V.nastavZalozky(Array.from(new Set(zal.concat((d.zalozky || []).map(x => x - 1).filter(i => V.SNIMKY[i])))).sort((a, b) => a - b));
        Dialog.info(`Importováno ${n} poznámek`);
        kresliPoznamky();
      } catch (er) { Dialog.chyba('Import se nepodařil: ' + er.message); }
    });
    $('#pzSmazat').addEventListener('click', async () => {
      if (!klice.length && !zal.length) return;
      if (!await Dialog.potvrd(`Smazat ${klice.length} poznámek a ${zal.length} záložek? Nejde to vrátit.`)) return;
      V.nastavPoznamky({}); V.nastavZalozky([]); kresliPoznamky();
    });
  }
  V.rezimy.poznamky = { ukaz: kresliPoznamky };
})();
