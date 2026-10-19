/* rozhodovani/ui.js – plná analýza a sdílené ovládání stránky obsah/rozhodovani.html.
   Výpočty v jadro.js, grafy v grafy.js, průvodce v pruvodce.js (přes window.RozhodovaniUI). */
(function () {
  'use strict';
  const J = window.Rozhodovani, G = window.RozhodovaniGrafy, SABLONY = window.RozhodovaniSablony;
  const esc = G.esc, F = J.formatCislo;
  const $ = id => document.getElementById(id);
  const KLIC_AKT = 'webapp_rozhodovani_aktualni', KLIC_PROJ = 'webapp_rozhodovani_projekty', KLIC_REZIM = 'webapp_rozhodovani_rezim';
  const MAX_KRIT = 30, MAX_ALT = 60;
  const TYPY = {
    max: { znak: '↑', nazev: 'maximalizovat', popis: 'čím víc, tím lépe' },
    min: { znak: '↓', nazev: 'minimalizovat', popis: 'čím méně, tím lépe' },
    subj: { znak: '★', nazev: 'subjektivní 1–10', popis: 'vaše hodnocení 1–10' }
  };
  const REZIMY = [
    { id: 'poradi', nazev: 'Pořadí', popis: 'Nejjednodušší: jen seřaďte kritéria podle důležitosti (1 = nejdůležitější, shodná čísla = stejně důležitá). Váhy dopočítá metoda ROC (rank-order centroid).' },
    { id: 'body', nazev: '100 bodů', popis: 'Rozdělte 100 bodů mezi kritéria podle důležitosti. Váha = podíl bodů (součet nemusí být přesně 100, dopočítá se).' },
    { id: 'primo', nazev: 'Posuvníky', popis: 'Posuvník nastavuje relativní důležitost; procenta vpravo jsou váhy po přepočtu na součet 100 %.' },
    { id: 'swing', nazev: 'Swing', popis: 'Představte si variantu, která je ve všech kritériích nejhorší. Které zlepšení z nejhorší na nejlepší hodnotu (uvedené u kritéria) byste chtěli nejvíc? To dostane 100. Ostatní zlepšení ohodnoťte vůči němu 0–100.' },
    { id: 'ahp', nazev: 'Párově (AHP)', popis: 'Porovnejte kritéria po dvojicích na Saatyho škále. Váhy se odvodí z vlastního vektoru matice a zkontroluje se konzistence odpovědí.' },
    { id: 'skupina', nazev: 'Skupina', popis: 'Každý hodnotitel rozdělí body mezi kritéria. Váhy se zprůměrují; Kendallův koeficient W ukáže, nakolik se hodnotitelé shodnou.' }
  ];

  let P = null;                 // aktuální projekt
  let S = null;                 // výsledek posledního výpočtu
  let rezim = 'pruvodce';
  let verze = 0;                // počítadlo změn (zastarání simulace)
  let skryteRadar = null;       // Set trvalých indexů alternativ skrytých v radaru
  const skryteCit = new Set();
  let vybraneKrit = null, fceKrit = null;
  let smaaVysl = null, smaaBezi = null;
  let posledniVysvetleni = null;
  let casTezke = 0, casUlozeni = 0;
  const posluchaci = [];

  /* ---------- úložiště ---------- */
  function lsCti(k) { try { const t = localStorage.getItem(k); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
  function lsPis(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function ulozAktualni() { clearTimeout(casUlozeni); casUlozeni = setTimeout(() => lsPis(KLIC_AKT, P), 400); }

  function prazdnyProjekt() {
    return J.overProjekt({
      nazev: 'Nové rozhodnutí',
      kriteria: [{ nazev: 'Cena', typ: 'min', jednotka: 'Kč', vaha: 50, poradi: 1 }, { nazev: 'Kvalita', typ: 'subj', vaha: 50, poradi: 2 }],
      alternativy: [{ nazev: 'Varianta A', hodnoty: [] }, { nazev: 'Varianta B', hodnoty: [] }],
      vahyRezim: 'poradi'
    });
  }
  function zeSablony(id) {
    const s = SABLONY.find(x => x.id === id);
    return J.overProjekt(JSON.parse(JSON.stringify(s.projekt)));
  }

  /* ---------- pomocné ---------- */
  const funkceProjektu = () => P.kriteria.map(k => k.funkce);
  const maFunkce = () => P.kriteria.some(k => k.funkce);
  function volbyMetody() { return { prometheeFunkce: P.prefFunkce, vikorV: P.vikorV, funkce: funkceProjektu() }; }
  function nazevMetody(id) {
    id = id || P.metoda;
    if (id === 'promethee') return 'PROMETHEE II (' + (P.prefFunkce === 'obvykla' ? 'obvyklá funkce' : 'lineární funkce') + ')';
    if (id === 'vikor') return 'VIKOR (v = ' + F(P.vikorV, 2) + ')';
    return J.METODY.find(m => m.id === id).nazev;
  }
  const pocet = (n, a, b, c) => n + ' ' + (n === 1 ? a : n >= 2 && n <= 4 ? b : c);
  function vstupText(i, j) {
    const a = P.alternativy[i], iv = a.intervaly[j], v = a.hodnoty[j];
    if (iv) return String(iv[0]).replace('.', ',') + '–' + String(iv[1]).replace('.', ',');
    return v === null || v === undefined || (typeof v === 'number' && isNaN(v)) ? '' : String(v).replace('.', ',');
  }
  function nastavHodnotu(i, j, text) {
    const r = J.parsujHodnotu(text);
    P.alternativy[i].hodnoty[j] = r.hodnota;
    P.alternativy[i].intervaly[j] = r.interval;
    return r;
  }
  function rozsahKriteria(j) {
    const s = P.alternativy.map(a => a.hodnoty[j]).filter(x => typeof x === 'number' && isFinite(x));
    if (!s.length) return null;
    return { min: Math.min(...s), max: Math.max(...s) };
  }
  const fmtHodn = (x, k) => (k && k.typ === 'subj' ? F(x, 0) + ' b.' : F(x, Math.abs(x) >= 100 || Number.isInteger(x) ? 0 : 2) + (k && k.jednotka ? ' ' + k.jednotka : ''));

  /* ---------- výpočet ---------- */
  function spocitej() {
    const vh = J.vahyProjektu(P);
    const w = vh.w;
    const X = P.alternativy.map(a => a.hodnoty), typy = P.kriteria.map(k => k.typ);
    const kon = J.zkontrolujMatici(X, typy);
    const st = { w, vh, X, typy, kon, ok: false, aktivni: [], elim: P.alternativy.map(() => []) };
    if (!kon.ok || P.alternativy.length < 2) {
      const prazdne = kon.chyby.filter(c => c.text === 'Prázdná buňka.').length;
      st.zprava = P.alternativy.length < 2 ? 'Pro porovnání jsou potřeba alespoň 2 varianty.'
        : `Matice není kompletní: ${[prazdne ? pocet(prazdne, 'prázdná buňka', 'prázdné buňky', 'prázdných buněk') : '', kon.chyby.length > prazdne ? pocet(kon.chyby.length - prazdne, 'chybná hodnota', 'chybné hodnoty', 'chybných hodnot') : ''].filter(Boolean).join(', ')}.`;
      return st;
    }
    st.elim = J.eliminace(X, P.kriteria);
    st.aktivni = st.elim.map((d, i) => (d.length ? -1 : i)).filter(i => i >= 0);
    if (!st.aktivni.length) { st.zprava = 'Žádná varianta nesplňuje povinné meze. Zmírněte meze u kritérií.'; return st; }
    st.Xa = st.aktivni.map(i => X[i]);
    st.nazvyA = st.aktivni.map(i => P.alternativy[i].nazev);
    st.dom = J.dominance(st.Xa, typy, funkceProjektu());
    try { st.vysl = J.spust(P.metoda, st.Xa, typy, w, volbyMetody()); }
    catch (e) { st.chybaMetody = e.message; return st; }
    st.ok = true;
    st.por = J.poradi(st.vysl.skore);
    st.serazeno = st.vysl.skore.map((s, q) => q).sort((a, b) => st.por[a] - st.por[b] || a - b);
    st.vitezQ = st.serazeno[0];
    st.vitez = st.aktivni[st.vitezQ];
    try { st.vysvetleni = st.aktivni.length > 1 ? J.vysvetli(st.Xa, typy, w, st.nazvyA, P.kriteria.map(k => k.nazev), P.metoda, volbyMetody()) : null; } catch (e) { st.vysvetleni = null; }
    return st;
  }

  /** Hlavní vstupní bod po každé změně. druh: 'hodnoty' | 'vahy' | 'nazvy' | 'struktura' | 'metoda' */
  function zmena(druh) {
    verze++;
    S = spocitej();
    posledniVysvetleni = S.vysvetleni ? S.vysvetleni.text : null;
    aktualizujVahyText();
    if (rezim === 'plne') vykresliPlne(druh);
    posluchaci.forEach(fn => { try { fn(druh, S); } catch (e) { console.error(e); } });
    ulozAktualni();
    naplanujTezke();
  }

  /* ================= VÁHY (sdílená komponenta) ================= */
  function swingText(j) {
    const k = P.kriteria[j], r = rozsahKriteria(j);
    if (!r) return 'doplňte hodnoty variant';
    if (r.max - r.min < 1e-12) return 'všechny varianty mají stejnou hodnotu – zlepšení nic nepřinese';
    const nej = k.typ === 'min' ? r.min : r.max, hor = k.typ === 'min' ? r.max : r.min;
    return `z ${fmtHodn(hor, k)} na ${fmtHodn(nej, k)}`;
  }
  function widgetVahy(k, j) {
    const r = P.vahyRezim, n = P.kriteria.length;
    if (r === 'primo') return `<input type="range" class="k-vaha" min="0" max="100" step="0.1" value="${k.vaha}" aria-label="Důležitost kritéria ${esc(k.nazev)}">`;
    if (r === 'body') return `<input type="number" class="k-body" min="0" max="1000" step="1" value="${k.body}" aria-label="Body pro ${esc(k.nazev)}"><span class="napoveda" style="margin:0">bodů</span><span style="flex:1"></span>`;
    if (r === 'poradi') return `<select class="k-poradi" aria-label="Pořadí důležitosti ${esc(k.nazev)}">${Array.from({ length: n }, (_, q) => `<option value="${q + 1}"${k.poradi === q + 1 ? ' selected' : ''}>${q + 1}.${q === 0 ? ' (nejdůležitější)' : ''}</option>`).join('')}</select><span style="flex:1"></span>`;
    if (r === 'swing') return `<input type="range" class="k-swing" min="0" max="100" step="1" value="${k.swing}" aria-label="Hodnota zlepšení ${esc(k.nazev)}"><span class="napoveda k-swing-txt" style="margin:0;min-width:2.5em;text-align:right">${Math.round(k.swing)}</span>`;
    return `<span class="napoveda" style="margin:0;flex:1">${r === 'ahp' ? 'z párového porovnání' : 'průměr hodnotitelů'}</span>`;
  }
  function vykresliVahy(el, opt) {
    opt = opt || el._opt || {};
    el._opt = opt;
    const k = P.kriteria, r = P.vahyRezim;
    const rz = REZIMY.find(x => x.id === r);
    let h = `<div class="vahy-rezimy" role="group" aria-label="Způsob vážení">${REZIMY.map(x =>
      `<button type="button" class="male v-rezim" data-rezim="${x.id}" aria-pressed="${x.id === r}">${x.nazev}</button>`).join('')}</div>
      <p class="vahy-popis">${esc(rz.popis)}</p>`;
    if (r === 'body') h += '<div class="body-soucet"></div>';
    h += `<div class="krit-seznam${opt.jenVahy ? ' jen-vahy' : ''}">` + k.map((x, j) => `
      <div class="krit" data-j="${j}">
        <span class="k-titul">${TYPY[x.typ].znak} ${esc(x.nazev)}</span>
        <input type="text" class="k-nazev" value="${esc(x.nazev)}" maxlength="80" aria-label="Název kritéria ${j + 1}">
        <select class="k-typ typ-vyber" aria-label="Typ kritéria ${esc(x.nazev)}">
          ${Object.entries(TYPY).map(([t, d]) => `<option value="${t}"${t === x.typ ? ' selected' : ''}>${d.znak} ${d.nazev}</option>`).join('')}
        </select>
        <input type="text" class="k-jedn jedn" value="${esc(x.jednotka)}" maxlength="20" placeholder="jednotka" aria-label="Jednotka" ${x.typ === 'subj' ? 'disabled' : ''}>
        <button type="button" class="k-smaz smaz ikona neTisk" title="Odebrat kritérium" aria-label="Odebrat kritérium ${esc(x.nazev)}" ${k.length <= 1 ? 'disabled' : ''}>×</button>
        <div class="vaha-radek">${widgetVahy(x, j)}<span class="vaha-txt">váha <b class="k-proc">–</b></span></div>
        ${r === 'swing' ? `<div class="swing-txt">${esc(swingText(j))}</div>` : ''}
        <div class="vaha-pruh"><i class="k-pruh" style="width:0"></i></div>
      </div>`).join('') + '</div>';
    if (!opt.jenVahy) h += `<div class="tlacitka neTisk krit-pridat" style="margin-top:10px">
        <button type="button" class="k-pridat" ${k.length >= MAX_KRIT ? 'disabled' : ''}>+ Kritérium</button>
        <button type="button" class="k-rovnomerne">Rovnoměrné váhy</button></div>
      <p class="napoveda">↑ maximalizovat (čím víc, tím lépe) · ↓ minimalizovat (náklady, čas…) · ★ subjektivní hodnocení 1–10 (počítá se jako maximalizace).</p>`;
    else h += `<div class="tlacitka neTisk" style="margin-top:10px"><button type="button" class="k-rovnomerne">Rovnoměrné váhy</button></div>`;
    if (r === 'ahp') h += `<div class="ahp-blok"><h3>Párové porovnání (Saatyho škála 1–9)</h3>
        <p class="napoveda">Posuňte jezdec k důležitějšímu kritériu: 1 = stejně, 3 = mírně, 5 = výrazně, 7 = velmi silně, 9 = extrémně důležitější.</p>
        <div class="ahp-pary">${htmlAhpPary()}</div><div class="ahp-vysledek"></div></div>`;
    if (r === 'skupina') h += `<div class="skupina-blok"><h3>Hodnotitelé (body pro každé kritérium)</h3>${htmlSkupina()}<div class="skupina-vysledek"></div></div>`;
    el.innerHTML = h;
    el.classList.add('vahy-komponenta');
    if (!el.dataset.navazano) { navazVahy(el); el.dataset.navazano = '1'; }
    aktualizujVahyText();
  }

  function aktualizujVahyText() {
    if (!S) return;
    const w = S.w;
    document.querySelectorAll('.vahy-komponenta').forEach(el => {
      el.querySelectorAll('.krit').forEach((kr, j) => {
        if (w[j] === undefined) return;
        kr.querySelector('.k-proc').textContent = F(w[j] * 100, 1) + ' %';
        kr.querySelector('.k-pruh').style.width = (w[j] * 100) + '%';
      });
      const bs = el.querySelector('.body-soucet');
      if (bs) {
        const s = P.kriteria.reduce((a, k) => a + (k.body || 0), 0);
        bs.innerHTML = `Rozděleno <b>${F(s, 0)}</b> bodů${s === 100 ? ' <span class="stav-ok">✓</span>' : s < 100 ? ` – zbývá ${F(100 - s, 0)}` : ` – o ${F(s - 100, 0)} víc než 100 (váhy se přepočtou)`}`;
      }
      const av = el.querySelector('.ahp-vysledek');
      if (av) av.innerHTML = htmlAhpVysledek();
      el.querySelectorAll('.ahp-par.nejhorsi').forEach(e => e.classList.remove('nejhorsi'));
      const a = S.vh.ahp;
      if (a && a.nejhorsi && a.CR !== null && a.CR > 0.1) {
        const q = el.querySelector(`.ahp-par[data-a="${P.kriteria[a.nejhorsi.i].id}"][data-b="${P.kriteria[a.nejhorsi.j].id}"]`);
        if (q) q.classList.add('nejhorsi');
      }
      const sv = el.querySelector('.skupina-vysledek');
      if (sv) sv.innerHTML = htmlSkupinaVysledek();
    });
  }

  /* --- AHP --- */
  function popisPar(p, a, b) {
    if (p === 0) return 'stejně důležité';
    const s = J.posuvnikNaSaaty(Math.abs(p));
    const slovo = { 2: 'slabě až mírně', 3: 'mírně', 4: 'mírně až výrazně', 5: 'výrazně', 6: 'výrazně až velmi silně', 7: 'velmi silně', 8: 'velmi silně až extrémně', 9: 'extrémně' }[s];
    return `${p > 0 ? a : b} je ${slovo} důležitější (${s})`;
  }
  function htmlAhpPary() {
    const k = P.kriteria, rad = [];
    if (k.length < 2) return '<p class="napoveda">Párové porovnání potřebuje alespoň 2 kritéria.</p>';
    for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) {
      const p = J.ctiPar(P.ahp.pary, k[i].id, k[j].id);
      rad.push(`<div class="ahp-par" data-a="${k[i].id}" data-b="${k[j].id}">
        <span class="l${p > 0 ? ' dom' : ''}">${esc(k[i].nazev)}</span>
        <input type="range" min="-8" max="8" step="1" value="${-p}" aria-label="${esc(k[i].nazev)} vůči ${esc(k[j].nazev)}">
        <span class="p${p < 0 ? ' dom' : ''}">${esc(k[j].nazev)}</span>
        <span class="stav">${esc(popisPar(p, k[i].nazev, k[j].nazev))}</span></div>`);
    }
    return rad.join('');
  }
  function nastavPar(idA, idB, p) {
    delete P.ahp.pary[J.klicPar(idB, idA)];
    P.ahp.pary[J.klicPar(idA, idB)] = p;
  }
  function htmlAhpVysledek() {
    const r = S && S.vh.ahp, k = P.kriteria;
    if (!r) return '';
    let stav;
    if (k.length <= 2) stav = '<span class="stav-ok">✓ konzistentní (n ≤ 2)</span>';
    else if (r.CR === null) stav = '<span class="stav-mez">CR nelze určit (RI je tabelován jen do n = 15)</span>';
    else if (r.CR <= 0.1) stav = '<span class="stav-ok">✓ přijatelná konzistence (CR ≤ 0,1)</span>';
    else stav = '<span class="stav-zle">✗ nekonzistentní (CR &gt; 0,1) – přehodnoťte porovnání</span>';
    let h = `<div class="ukazatele">
      <div class="ukazatel"><div class="u-n">λmax</div><div class="u-h">${F(r.lambda, 4)}</div></div>
      <div class="ukazatel"><div class="u-n">CI</div><div class="u-h">${F(r.CI, 4)}</div></div>
      <div class="ukazatel"><div class="u-n">RI (Saaty)</div><div class="u-h">${r.RI === null ? '–' : F(r.RI, 2)}</div></div>
      <div class="ukazatel"><div class="u-n">CR</div><div class="u-h ${r.CR !== null && r.CR > 0.1 ? 'stav-zle' : 'stav-ok'}">${r.CR === null ? '–' : F(r.CR, 3)}</div></div>
    </div><p style="margin:4px 0 8px;font-size:.88rem">${stav}</p>`;
    if (r.nejhorsi && r.CR !== null && r.CR > 0.1) {
      const n = r.nejhorsi, a = k[n.i], b = k[n.j];
      const navrhP = J.saatyNaPosuvnik(n.navrh);
      h += `<div class="upozorneni" style="margin-bottom:8px">Nejvíc se od odvozených vah odchyluje porovnání <b>${esc(a.nazev)} × ${esc(b.nazev)}</b>
        (zadáno ${esc(popisPar(J.saatyNaPosuvnik(n.aktualni), a.nazev, b.nazev))}; váhám by odpovídal poměr ${F(n.idealni, 2)}).
        <div class="tlacitka" style="margin-top:6px"><button type="button" class="male ahp-navrh" data-a="${a.id}" data-b="${b.id}" data-p="${navrhP}">Použít návrh: ${esc(popisPar(navrhP, a.nazev, b.nazev))}</button></div></div>`;
    }
    h += `<div class="lista" style="margin:6px 0"><div class="pole"><label>Použít váhy z</label>
      <select class="ahp-odvozeni"><option value="vlastni"${P.ahp.odvozeni === 'vlastni' ? ' selected' : ''}>vlastního vektoru (Saaty)</option>
      <option value="geometricky"${P.ahp.odvozeni === 'geometricky' ? ' selected' : ''}>geometrického průměru řádků</option></select></div></div>
      <div class="obal-tab"><table><thead><tr><th>Kritérium</th><th class="cis">Vlastní vektor</th><th class="cis">Geom. průměr</th></tr></thead><tbody>
      ${k.map((x, j) => `<tr><td>${esc(x.nazev)}</td><td class="cis">${F(r.vlastni[j] * 100, 2)} %</td><td class="cis">${F(r.geometricky[j] * 100, 2)} %</td></tr>`).join('')}</tbody></table></div>`;
    return h;
  }
  function predvyplnAhp(w) {
    const k = P.kriteria;
    let zadan = false;
    for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++)
      if (J.klicPar(k[i].id, k[j].id) in P.ahp.pary || J.klicPar(k[j].id, k[i].id) in P.ahp.pary) zadan = true;
    if (zadan) return;
    for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) {
      const r = w[j] > 0 ? w[i] / w[j] : 9;
      nastavPar(k[i].id, k[j].id, Math.max(-8, Math.min(8, J.saatyNaPosuvnik(Math.min(9, Math.max(1 / 9, r))))));
    }
  }

  /* --- skupina --- */
  function htmlSkupina() {
    const k = P.kriteria, H = P.skupina.hodnotitele;
    return `<div class="obal-tab"><table class="skupina-tab"><thead><tr><th>Kritérium</th>${H.map((h, q) =>
      `<th><input type="text" class="sk-jmeno" data-h="${q}" value="${esc(h.nazev)}" maxlength="60" aria-label="Jméno hodnotitele ${q + 1}">
        <button type="button" class="ikona sk-smaz" data-h="${q}" aria-label="Odebrat hodnotitele ${esc(h.nazev)}" ${H.length <= 1 ? 'disabled' : ''}>×</button></th>`).join('')}</tr></thead>
      <tbody>${k.map(x => `<tr><td>${esc(x.nazev)}</td>${H.map((h, q) =>
        `<td><input type="number" class="sk-body" data-h="${q}" data-k="${x.id}" min="0" max="100" step="1" value="${h.body[x.id]}" aria-label="${esc(h.nazev)} – ${esc(x.nazev)}"></td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <div class="lista" style="margin-top:8px"><div class="tlacitka"><button type="button" class="male sk-pridat" ${H.length >= 20 ? 'disabled' : ''}>+ Hodnotitel</button></div>
        <div class="pole"><label>Agregace</label><select class="sk-agregace"><option value="aritm"${P.skupina.agregace === 'aritm' ? ' selected' : ''}>aritmetický průměr vah</option>
        <option value="geom"${P.skupina.agregace === 'geom' ? ' selected' : ''}>geometrický průměr vah</option></select></div></div>`;
  }
  function htmlSkupinaVysledek() {
    const s = S && S.vh.skupina;
    if (!s) return '';
    const W = s.W;
    const slovo = W === null ? '' : W >= 0.7 ? 'silná shoda' : W >= 0.5 ? 'střední shoda' : W >= 0.3 ? 'slabá shoda' : 'téměř žádná shoda';
    const nejv = P.kriteria.map((k, j) => ({ k, d: s.rozpeti[j][1] - s.rozpeti[j][0], j })).sort((a, b) => b.d - a.d)[0];
    return `<p class="napoveda">Shoda hodnotitelů v pořadí důležitosti: ${W === null ? 'pro výpočet jsou potřeba aspoň 2 hodnotitelé' : `Kendallovo <b>W = ${F(W, 2)}</b> (${slovo})`}.
      ${nejv && nejv.d > 0.1 ? `Nejvíc se rozcházíte u kritéria <b>${esc(nejv.k.nazev)}</b> (váhy ${F(s.rozpeti[nejv.j][0] * 100, 0)}–${F(s.rozpeti[nejv.j][1] * 100, 0)} %) – stojí za diskusi.` : ''}</p>`;
  }

  /* --- přepínání režimu vah (s převodem současných vah) --- */
  function zmenRezimVah(novy) {
    if (novy === P.vahyRezim) return;
    const w = S ? S.w : J.normalizujVahy(P.kriteria.map(k => k.vaha));
    const k = P.kriteria, n = k.length;
    if (novy === 'primo') k.forEach((x, j) => { x.vaha = Math.max(0.1, Math.round(w[j] * 1000) / 10); });
    if (novy === 'body') {
      const b = w.map(x => Math.round(x * 100));
      const d = 100 - b.reduce((a, c) => a + c, 0);
      b[w.indexOf(Math.max(...w))] += d;
      k.forEach((x, j) => { x.body = Math.max(0, b[j]); });
    }
    if (novy === 'poradi') {
      const pr = J.poradi(w, 1e-6);
      k.forEach((x, j) => { x.poradi = pr[j]; });
    }
    if (novy === 'swing') { const m = Math.max(...w) || 1; k.forEach((x, j) => { x.swing = Math.round(w[j] / m * 100); }); }
    if (novy === 'ahp') {
      if (n > 15) Dialog.info('Pro více než 15 kritérií není Saatyho index RI tabelován – konzistenci nelze posoudit.');
      predvyplnAhp(w);
    }
    if (novy === 'skupina' && !P.skupina.hodnotitele.length) {
      const body = {}; k.forEach((x, j) => { body[x.id] = Math.round(w[j] * 100); });
      P.skupina.hodnotitele = [{ nazev: 'Hodnotitel 1', body: Object.assign({}, body) }, { nazev: 'Hodnotitel 2', body: Object.assign({}, body) }];
    }
    P.vahyRezim = novy;
    zmena('struktura');
    document.querySelectorAll('.vahy-komponenta').forEach(el => vykresliVahy(el));
  }

  function navazVahy(el) {
    el.addEventListener('click', async e => {
      const t = e.target;
      const rz = t.closest('.v-rezim'); if (rz) { zmenRezimVah(rz.dataset.rezim); return; }
      if (t.closest('.k-smaz')) { await smazKriterium(+t.closest('.krit').dataset.j); return; }
      if (t.closest('.k-pridat')) { pridejKriterium(); const pole = el.querySelectorAll('.k-nazev'); if (pole.length) pole[pole.length - 1].select(); return; }
      if (t.closest('.k-rovnomerne')) {
        const k = P.kriteria, r = P.vahyRezim;
        if (r === 'primo') k.forEach(x => { x.vaha = 50; });
        else if (r === 'body') k.forEach(x => { x.body = Math.round(100 / k.length); });
        else if (r === 'poradi') k.forEach(x => { x.poradi = 1; });
        else if (r === 'swing') k.forEach(x => { x.swing = 100; });
        else if (r === 'ahp') P.ahp.pary = {};
        else if (r === 'skupina') P.skupina.hodnotitele.forEach(h => k.forEach(x => { h.body[x.id] = 50; }));
        zmena('vahy'); vykresliVahy(el); return;
      }
      const nv = t.closest('.ahp-navrh');
      if (nv) { nastavPar(nv.dataset.a, nv.dataset.b, +nv.dataset.p); vykresliVahy(el); zmena('vahy'); return; }
      if (t.closest('.sk-pridat')) {
        const body = {}; P.kriteria.forEach(x => { body[x.id] = 50; });
        P.skupina.hodnotitele.push({ nazev: 'Hodnotitel ' + (P.skupina.hodnotitele.length + 1), body });
        vykresliVahy(el); zmena('vahy'); return;
      }
      const sm = t.closest('.sk-smaz');
      if (sm) {
        const q = +sm.dataset.h;
        if (!(await Dialog.potvrd(`Odebrat hodnotitele „${P.skupina.hodnotitele[q].nazev}“?`))) return;
        P.skupina.hodnotitele.splice(q, 1); vykresliVahy(el); zmena('vahy');
      }
    });
    el.addEventListener('input', e => {
      const t = e.target, kr = t.closest('.krit');
      if (kr) {
        const j = +kr.dataset.j, k = P.kriteria[j];
        if (t.classList.contains('k-nazev')) { k.nazev = t.value; kr.querySelector('.k-titul').textContent = TYPY[k.typ].znak + ' ' + k.nazev; zmena('nazvy'); return; }
        if (t.classList.contains('k-jedn')) { k.jednotka = t.value; zmena('nazvy'); return; }
        if (t.classList.contains('k-vaha')) { k.vaha = +t.value; zmena('vahy'); return; }
        if (t.classList.contains('k-body')) { const v = J.parsujCislo(t.value); k.body = v > 0 ? Math.min(1000, v) : 0; zmena('vahy'); return; }
        if (t.classList.contains('k-swing')) { k.swing = +t.value; kr.querySelector('.k-swing-txt').textContent = t.value; zmena('vahy'); return; }
      }
      const par = t.closest('.ahp-par');
      if (par) {
        const p = -(+t.value);
        nastavPar(par.dataset.a, par.dataset.b, p);
        const a = P.kriteria.find(x => x.id === par.dataset.a), b = P.kriteria.find(x => x.id === par.dataset.b);
        par.querySelector('.stav').textContent = popisPar(p, a.nazev, b.nazev);
        par.querySelector('.l').classList.toggle('dom', p > 0); par.querySelector('.p').classList.toggle('dom', p < 0);
        zmena('vahy'); return;
      }
      if (t.classList.contains('sk-body')) { const v = J.parsujCislo(t.value); P.skupina.hodnotitele[+t.dataset.h].body[t.dataset.k] = v > 0 ? Math.min(100, v) : 0; zmena('vahy'); return; }
      if (t.classList.contains('sk-jmeno')) { P.skupina.hodnotitele[+t.dataset.h].nazev = t.value; ulozAktualni(); }
    });
    el.addEventListener('change', e => {
      const t = e.target;
      if (t.classList.contains('k-typ')) { zmenTyp(+t.closest('.krit').dataset.j, t.value); return; }
      if (t.classList.contains('k-poradi')) { P.kriteria[+t.closest('.krit').dataset.j].poradi = +t.value; zmena('vahy'); return; }
      if (t.classList.contains('ahp-odvozeni')) { P.ahp.odvozeni = t.value; zmena('vahy'); return; }
      if (t.classList.contains('sk-agregace')) { P.skupina.agregace = t.value; zmena('vahy'); }
    });
  }

  /* ---------- strukturální změny ---------- */
  function zmenTyp(j, novy) {
    const k = P.kriteria[j];
    if (novy === 'subj') {
      let smazano = 0;
      P.alternativy.forEach(a => {
        const v = a.hodnoty[j];
        a.intervaly[j] = null;
        if (v !== null && !(Number.isInteger(v) && v >= 1 && v <= 10)) { a.hodnoty[j] = null; smazano++; }
      });
      if (smazano) Dialog.info(`Hodnoty mimo škálu 1–10 (${smazano}) byly vymazány – doplňte subjektivní hodnocení.`);
    }
    k.typ = novy;
    if (k.funkce) { k.funkce = null; Dialog.info('Hodnotová funkce kritéria byla zrušena (změnil se směr kritéria).'); }
    zmena('struktura');
    document.querySelectorAll('.vahy-komponenta').forEach(el => vykresliVahy(el));
  }
  function pridejKriterium(nazev) {
    if (P.kriteria.length >= MAX_KRIT) return null;
    const k = { id: J.noveId(), nazev: nazev || 'Kritérium ' + (P.kriteria.length + 1), typ: 'max', jednotka: '', vaha: 50, body: 10,
      poradi: P.kriteria.length + 1, swing: 50, funkce: null, prahMin: null, prahMax: null, nejistota: 0 };
    P.kriteria.push(k);
    P.alternativy.forEach(a => { a.hodnoty.push(null); a.intervaly.push(null); });
    P.kriteria.slice(0, -1).forEach(x => nastavPar(x.id, k.id, 0));
    P.skupina.hodnotitele.forEach(h => { h.body[k.id] = 50; });
    zmena('struktura');
    document.querySelectorAll('.vahy-komponenta').forEach(el => vykresliVahy(el));
    return k;
  }
  async function smazKriterium(j, bezPotvrzeni) {
    if (P.kriteria.length <= 1) return false;
    if (!bezPotvrzeni && !(await Dialog.potvrd(`Odebrat kritérium „${P.kriteria[j].nazev}“ včetně jeho hodnot?`))) return false;
    const id = P.kriteria[j].id;
    P.kriteria.splice(j, 1);
    P.alternativy.forEach(a => { a.hodnoty.splice(j, 1); a.intervaly.splice(j, 1); });
    for (const kl of Object.keys(P.ahp.pary)) if (kl.split('|').includes(id)) delete P.ahp.pary[kl];
    P.skupina.hodnotitele.forEach(h => { delete h.body[id]; });
    if (fceKrit === id) fceKrit = null;
    zmena('struktura');
    document.querySelectorAll('.vahy-komponenta').forEach(el => vykresliVahy(el));
    return true;
  }
  function pridejAlternativu(nazev) {
    if (P.alternativy.length >= MAX_ALT) return false;
    P.alternativy.push({ nazev: nazev || 'Varianta ' + String.fromCharCode(65 + (P.alternativy.length % 26)), hodnoty: P.kriteria.map(() => null), intervaly: P.kriteria.map(() => null) });
    skryteRadar = null;
    zmena('struktura');
    return true;
  }
  async function smazAlternativu(i, bezPotvrzeni) {
    if (P.alternativy.length <= 1) return false;
    if (!bezPotvrzeni && !(await Dialog.potvrd(`Odebrat variantu „${P.alternativy[i].nazev}“?`))) return false;
    P.alternativy.splice(i, 1);
    skryteRadar = null; skryteCit.clear();
    zmena('struktura');
    return true;
  }

  /* ================= PLNÁ ANALÝZA ================= */
  function vykresliPlne(druh) {
    if (druh === 'struktura' || druh === 'vse') {
      vykresliVahy($('vahyEditor'), {});
      vykresliMatici();
      nastavOvladaceMetody();
      vykresliFce();
    } else if (druh === 'nazvy') {
      vykresliMatici(); vykresliFceVyber();
      document.querySelectorAll('.ahp-pary').forEach(el => { el.innerHTML = htmlAhpPary(); });
    }
    else if (druh === 'hodnoty' || druh === 'metoda') vykresliFceGraf();
    stavMatice();
    vykresliVysledek();
  }

  /* --- matice --- */
  function vykresliMatici() {
    const k = P.kriteria;
    let h = '<thead><tr><th class="alt-h">Varianta</th>' + k.map(x => {
      const mez = [x.prahMin !== null ? '≥ ' + F(x.prahMin, 6).replace(/,?0+$/, '') : '', x.prahMax !== null ? '≤ ' + F(x.prahMax, 6).replace(/,?0+$/, '') : ''].filter(Boolean).join(' a ');
      return `<th title="${esc(TYPY[x.typ].nazev)}"><span class="typ-znak" aria-label="${esc(TYPY[x.typ].nazev)}">${TYPY[x.typ].znak}</span> <span class="m-kn">${esc(x.nazev)}</span>
        ${x.jednotka && x.typ !== 'subj' ? `<br><span class="jedn-h">[${esc(x.jednotka)}]</span>` : x.typ === 'subj' ? '<br><span class="jedn-h">1–10</span>' : ''}
        ${mez || x.funkce || x.nejistota ? `<div class="alt-stitky">${mez ? `<span class="stitek vyr" title="povinná mez">${esc(mez)}</span>` : ''}${x.funkce ? '<span class="stitek fce" title="hodnotová funkce">u(x)</span>' : ''}${x.nejistota ? `<span class="stitek">±${F(x.nejistota * 100, 0)} %</span>` : ''}</div>` : ''}</th>`;
    }).join('') + '</tr></thead><tbody>';
    h += P.alternativy.map((a, i) => `<tr data-i="${i}"><td class="alt-n"><input type="text" class="a-nazev" value="${esc(a.nazev)}" maxlength="80" aria-label="Název varianty ${i + 1}">
      <button type="button" class="a-smaz ikona neTisk" title="Odebrat variantu" aria-label="Odebrat ${esc(a.nazev)}" ${P.alternativy.length <= 1 ? 'disabled' : ''}>×</button><span class="alt-stitky"></span></td>` +
      k.map((x, j) => {
        const v = a.hodnoty[j];
        if (x.typ === 'subj') return `<td><select class="hodn" data-j="${j}" aria-label="${esc(a.nazev)} – ${esc(x.nazev)}"><option value="">–</option>${
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => `<option value="${s}"${v === s ? ' selected' : ''}>${s}</option>`).join('')}</select></td>`;
        return `<td><input type="text" inputmode="decimal" class="hodn${a.intervaly[j] ? ' interval' : ''}" data-j="${j}" value="${esc(vstupText(i, j))}" aria-label="${esc(a.nazev)} – ${esc(x.nazev)}"></td>`;
      }).join('') + '</tr>').join('');
    $('matice').innerHTML = h + '</tbody>';
    $('btnPridatAlt').disabled = P.alternativy.length >= MAX_ALT;
  }
  function stavMatice() {
    const st = S;
    document.querySelectorAll('#matice .hodn').forEach(el => { el.classList.remove('chyba', 'nejlepsi'); el.removeAttribute('title'); });
    st.kon.chyby.forEach(c => {
      const el = document.querySelector(`#matice tr[data-i="${c.i}"] .hodn[data-j="${c.j}"]`);
      if (el) { el.classList.add('chyba'); el.title = c.text; }
    });
    document.querySelectorAll('#matice tr[data-i]').forEach(tr => {
      const i = +tr.dataset.i, el = tr.querySelector('.alt-stitky');
      const vyr = st.elim[i] && st.elim[i].length;
      tr.classList.toggle('vyrazena', !!vyr);
      let h = '';
      if (vyr) h += `<span class="stitek vyr" title="${esc(st.elim[i].map(d => d.text).join('; '))}">vyřazena: ${esc(st.elim[i][0].text)}</span>`;
      const q = st.aktivni.indexOf(i);
      if (q >= 0 && st.dom && st.dom[q].length) h += `<span class="stitek dom" title="Jiná varianta je všude stejně dobrá nebo lepší">dominuje ji ${esc(st.dom[q].map(z => st.nazvyA[z]).join(', '))}</span>`;
      if (st.ok && i === st.vitez) h += '<span class="stitek" style="border-color:var(--ok);color:var(--ok)">★ vítěz</span>';
      el.innerHTML = h;
    });
    if (!st.kon.ok) return;
    st.typy.forEach((t, j) => {
      const idx = st.aktivni.length ? st.aktivni : st.X.map((_, i) => i);
      const s = idx.map(i => st.X[i][j]);
      const fce = P.kriteria[j].funkce;
      const u = fce ? s.map(x => J.hodnotaFunkce(fce, x)) : t === 'min' ? s.map(x => -x) : s;
      const b = Math.max(...u);
      if (Math.max(...u) - Math.min(...u) < 1e-12) return;
      u.forEach((v, q) => { if (Math.abs(v - b) < 1e-12) { const el = document.querySelector(`#matice tr[data-i="${idx[q]}"] .hodn[data-j="${j}"]`); if (el) el.classList.add('nejlepsi'); } });
    });
  }

  /* --- výsledek --- */
  function nastavOvladaceMetody() {
    const id = P.metoda;
    $('metoda').value = id.startsWith('wsm-') ? 'wsm' : id;
    if (id.startsWith('wsm-')) $('normalizace').value = id.slice(4);
    $('poleNorm').hidden = !id.startsWith('wsm-');
    $('polePref').hidden = id !== 'promethee';
    $('poleVikor').hidden = id !== 'vikor';
    $('prefFunkce').value = P.prefFunkce;
    $('vikorV').value = P.vikorV; $('vikorVTxt').textContent = F(P.vikorV, 2);
    $('smaaVahy').value = P.smaa.vahy;
    $('smaaRozptyl').value = Math.round(P.smaa.rozptylVah * 100); $('smaaRozptylTxt').textContent = Math.round(P.smaa.rozptylVah * 100);
    $('poleRozptyl').hidden = P.smaa.vahy !== 'kolem';
    $('smaaIterace').value = String(P.smaa.iterace);
    if ($('smaaIterace').value !== String(P.smaa.iterace)) $('smaaIterace').value = '4000';
  }

  const VYCISTIT = ['poradiGraf', 'mezivysledkyObsah', 'prispevky', 'radar', 'radarLegenda', 'citTab', 'citGraf', 'citLegenda', 'porovnani', 'porovnaniZaver', 'spearman', 'proc'];
  function htmlVyrazene() {
    const v = S.elim.map((d, i) => (d.length ? `<li><b>${esc(P.alternativy[i].nazev)}</b> – ${esc(d.map(x => x.text).join('; '))}</li>` : '')).join('');
    return v ? `<p class="napoveda" style="margin-top:10px">Vyřazeno povinnou mezí:</p><ul class="napoveda" style="margin:2px 0 0;padding-left:18px">${v}</ul>` : '';
  }
  function vykresliVysledek() {
    const st = S;
    if (!st.ok) {
      const z = st.zprava || (st.chybaMetody ? nazevMetody() + ': ' + st.chybaMetody + ' Zvolte jinou metodu nebo normalizaci.' : '');
      $('vitezBox').innerHTML = `<p class="${st.chybaMetody ? 'stav-zle' : 'zadna'}">${esc(z)}</p>`;
      VYCISTIT.forEach(id => { $(id).innerHTML = ''; });
      $('citNadpis').textContent = '';
      if (!st.chybaMetody) $('upozorneni').innerHTML = `<div class="upozorneni chyby"><b class="t">Výpočet zastaven.</b> ${esc(z)} Opravte červeně označená pole.</div>`;
      $('smaaVysledek').classList.add('zastarale');
      if (st.chybaMetody) vykresliPrispevkyARadar();
      return;
    }
    const v = st.vysl, A = st.nazvyA;
    const shoda = st.por.filter(r => r === 1).length > 1;
    const druhy = st.serazeno[1];
    let det = nazevMetody() + (P.metoda === 'vikor' ? ' · Q = ' + F(v.Q[st.vitezQ], 3) + ' (menší je lepší, v grafu 1 − Q)' : ' · skóre ' + F(v.skore[st.vitezQ], 3));
    if (druhy !== undefined && !shoda) {
      const roz = Math.max(...v.skore) - Math.min(...v.skore) || 1;
      det += ` · náskok před 2. místem ${F(v.skore[st.vitezQ] - v.skore[druhy], 3)} (${F((v.skore[st.vitezQ] - v.skore[druhy]) / roz * 100, 1)} % rozpětí)`;
    }
    let kompr = '';
    if (P.metoda === 'vikor') {
      kompr = `<p class="napoveda">VIKOR: přijatelná výhoda ${v.C1 ? '<span class="stav-ok">splněna</span>' : '<span class="stav-mez">nesplněna</span>'}, stabilita ${v.C2 ? '<span class="stav-ok">splněna</span>' : '<span class="stav-mez">nesplněna</span>'}
        → kompromisní řešení: <b>${esc(v.kompromis.map(q => A[q]).join(', '))}</b>.</p>`;
    }
    $('vitezBox').innerHTML = `<div class="vitez-box"><span class="jm">${shoda ? 'Shoda: ' : '🏆 '}${esc(st.serazeno.filter(q => st.por[q] === 1).map(q => A[q]).join(' = '))}</span>
      <span class="det">${esc(det)}</span></div>${kompr}`;
    $('proc').innerHTML = posledniVysvetleni ? '<b>Proč?</b> ' + esc(posledniVysvetleni) : '';
    const jePhi = P.metoda === 'promethee';
    $('poradiGraf').innerHTML = G.sloupce(st.serazeno.map(q => ({ nazev: A[q], hodnota: v.skore[q], znacka: st.por[q] + '.',
      tip: `${A[q]}\n${st.por[q]}. místo · ${P.metoda === 'vikor' ? 'Q = ' + F(v.Q[q], 4) : 'skóre ' + F(v.skore[q], 4)}` })),
    { des: 3, min: jePhi ? -1 : 0, max: 1 }) + htmlVyrazene();
    vykresliMezivysledky();
    vykresliPrispevkyARadar();
  }

  function vykresliMezivysledky() {
    const id = P.metoda, k = P.kriteria, A = S.nazvyA, v = S.vysl, w = S.w;
    const hl = k.map(x => `<th class="cis">${esc(x.nazev)}</th>`).join('');
    const radky = (M, d) => M.map((r, i) => `<tr><td>${esc(A[i])}</td>${r.map(x => `<td class="cis">${F(x, d)}</td>`).join('')}`);
    let h;
    if (id.startsWith('wsm') || id === 'wpm' || id === 'mavt') {
      const nadpis = id === 'wpm' ? 'Poměr r (x/max, min/x)' : id === 'mavt' ? 'Užitek u(x)' : 'Normalizovaná hodnota r';
      h = `<table><thead><tr><th>${nadpis}</th>${hl}<th class="cis">Skóre</th></tr></thead><tbody>
        <tr><td><i>váha</i></td>${w.map(x => `<td class="cis"><i>${F(x, 3)}</i></td>`).join('')}<td></td></tr>
        ${radky(v.R, 3).map((r, i) => r + `<td class="cis"><b>${F(v.skore[i], 4)}</b></td></tr>`).join('')}</tbody></table>`;
    } else if (id === 'topsis') {
      h = `<table><thead><tr><th>Vážená normalizovaná v</th>${hl}<th class="cis">S⁺</th><th class="cis">S⁻</th><th class="cis">C</th></tr></thead><tbody>
        ${radky(v.V, 4).map((r, i) => r + `<td class="cis">${F(v.dPlus[i], 4)}</td><td class="cis">${F(v.dMinus[i], 4)}</td><td class="cis"><b>${F(v.skore[i], 4)}</b></td></tr>`).join('')}
        <tr><td><i>ideál A⁺</i></td>${v.ideal.map(x => `<td class="cis"><i>${F(x, 4)}</i></td>`).join('')}<td colspan="3"></td></tr>
        <tr><td><i>anti-ideál A⁻</i></td>${v.anti.map(x => `<td class="cis"><i>${F(x, 4)}</i></td>`).join('')}<td colspan="3"></td></tr></tbody></table>`;
    } else if (id === 'vikor') {
      h = `<table><thead><tr><th>Odchylka F od ideálu</th>${hl}<th class="cis">S</th><th class="cis">R</th><th class="cis">Q</th></tr></thead><tbody>
        ${radky(v.F, 3).map((r, i) => r + `<td class="cis">${F(v.S[i], 4)}</td><td class="cis">${F(v.R[i], 4)}</td><td class="cis"><b>${F(v.Q[i], 4)}</b></td></tr>`).join('')}</tbody></table>
        <p class="napoveda">S = vážený součet odchylek (užitek většiny), R = největší vážená odchylka (lítost), Q – menší je lepší; DQ = 1/(m − 1) = ${F(v.DQ, 3)}.</p>`;
    } else {
      h = `<table><thead><tr><th>Varianta</th><th class="cis">φ⁺ (síla)</th><th class="cis">φ⁻ (slabost)</th><th class="cis">φ (čistý tok)</th></tr></thead><tbody>
        ${A.map((a, i) => `<tr><td>${esc(a)}</td><td class="cis">${F(v.phiPlus[i], 4)}</td><td class="cis">${F(v.phiMinus[i], 4)}</td><td class="cis"><b>${F(v.skore[i], 4)}</b></td></tr>`).join('')}</tbody></table>`;
    }
    $('mezivysledkyObsah').innerHTML = h;
  }

  function rozkladPrispevku() {
    const id = P.metoda, Xa = S.Xa, typy = S.typy, w = S.w;
    if (id === 'mavt') return { r: J.mavt(Xa, typy, w, funkceProjektu()), popis: 'Skóre rozložené na příspěvky kritérií (váha × užitek hodnotové funkce).', norm: 'minmax' };
    let norm = id.startsWith('wsm-') ? id.slice(4) : 'minmax', r;
    try { r = J.wsm(Xa, typy, w, norm); } catch (e) { norm = 'minmax'; r = J.wsm(Xa, typy, w, 'minmax'); }
    return { r, norm, popis: id.startsWith('wsm-')
      ? `Skóre váženého součtu rozložené na příspěvky kritérií (váha × normalizovaná hodnota, normalizace ${J.NORMALIZACE[norm].kratce}).`
      : `Aditivní rozklad existuje jen u váženého součtu – zobrazen je vážený součet s normalizací ${J.NORMALIZACE[norm].kratce} při stejných vahách. Pořadí se může od zvolené metody lišit.` };
  }
  function vykresliPrispevkyARadar() {
    if (!S.Xa) return;
    const { r: ws, popis, norm } = rozkladPrispevku();
    $('prispPopis').textContent = popis;
    const por = J.poradi(ws.skore);
    const ser = ws.skore.map((s, q) => q).sort((a, b) => por[a] - por[b] || a - b);
    $('prispevky').innerHTML = G.skladane(ser.map(q => ({ nazev: S.nazvyA[q], dily: ws.prispevky[q], soucet: ws.skore[q] })), P.kriteria.map(k => k.nazev), { max: 1 });
    const ent = S.aktivni;
    if (!skryteRadar) {
      const hl = S.ok ? S.por : por;
      const s2 = hl.map((r, q) => q).sort((a, b) => hl[a] - hl[b] || a - b);
      skryteRadar = new Set(ent.length <= 4 ? [] : s2.slice(3).map(q => ent[q]));
    }
    const R = norm === 'vektor' ? J.normalizuj(S.Xa, S.typy, 'minmax') : ws.R;
    $('radarPopis').textContent = `${P.metoda === 'mavt' ? 'Užitek hodnotových funkcí' : 'Normalizované hodnoty kritérií (min-max'}${P.metoda === 'mavt' ? '' : ')'} – 1 = nejlepší. Bez vah, ukazuje profil silných a slabých stránek. Klepnutím na název variantu skryjete/zobrazíte.`;
    $('radarLegenda').innerHTML = G.legendaAlt(S.nazvyA, skryteRadar, S.ok ? S.vitez : -1, ent);
    $('radar').innerHTML = G.radar(P.kriteria.map(k => k.nazev),
      S.nazvyA.map((a, q) => ({ nazev: a, hodnoty: R[q], index: ent[q] })).filter(s => !skryteRadar.has(s.index)), $('radar').clientWidth || 500);
  }

  /* --- hodnotové funkce, meze, nejistota --- */
  function vykresliFce() { vykresliFceVyber(); vykresliFceObsah(); }
  function vykresliFceVyber() {
    if (!fceKrit || !P.kriteria.some(k => k.id === fceKrit)) fceKrit = P.kriteria[0] && P.kriteria[0].id;
    $('fceVyber').innerHTML = P.kriteria.map(k => `<button type="button" role="tab" data-k="${k.id}" aria-selected="${k.id === fceKrit}">${TYPY[k.typ].znak} ${esc(k.nazev)}${k.funkce ? ' · u(x)' : ''}${k.prahMin !== null || k.prahMax !== null ? ' · mez' : ''}${k.nejistota ? ' · ±' : ''}</button>`).join('');
  }
  function domenaFce(k, j) {
    const r = rozsahKriteria(j) || { min: 0, max: 1 };
    let lo = r.min, hi = r.max;
    if (k.funkce) { lo = Math.min(lo, k.funkce[0][0]); hi = Math.max(hi, k.funkce[k.funkce.length - 1][0]); }
    if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
    return { lo, hi, dataLo: r.min, dataHi: r.max };
  }
  function vykresliFceObsah() {
    const j = P.kriteria.findIndex(k => k.id === fceKrit);
    if (j < 0) { $('fceObsah').innerHTML = ''; return; }
    const k = P.kriteria[j];
    const vyr = S && S.elim ? S.elim.map((d, i) => (d.some(x => x.j === j) ? P.alternativy[i].nazev : null)).filter(Boolean) : [];
    const pocIv = P.alternativy.filter(a => a.intervaly[j]).length;
    const vst = x => (x === null ? '' : String(x).replace('.', ','));
    const sub = k.typ === 'subj';
    $('fceObsah').innerHTML = `<div class="fce-mrizka"><div>
      <h3>Povinná mez (vyřazení)</h3>
      <div class="lista">
        <div class="pole"><label for="fceMin">nejméně</label><input type="text" inputmode="decimal" id="fceMin" value="${esc(vst(k.prahMin))}" placeholder="bez meze"></div>
        <div class="pole"><label for="fceMax">nejvýše</label><input type="text" inputmode="decimal" id="fceMax" value="${esc(vst(k.prahMax))}" placeholder="bez meze"></div>
      </div>
      <p class="napoveda">${vyr.length ? `Vyřazeno: <b>${esc(vyr.join(', '))}</b>.` : 'Varianta mimo mez se vyřadí bez ohledu na ostatní kritéria (např. rozpočet, minimální výkon).'}</p>
      <h3>Nejistota hodnot</h3>
      <label for="fceNej">± <b id="fceNejTxt">${F(k.nejistota * 100, 0)}</b> % kolem zadané hodnoty</label>
      <input type="range" id="fceNej" min="0" max="50" step="1" value="${Math.round(k.nejistota * 100)}" style="width:100%;accent-color:var(--accent)">
      <p class="napoveda">Použije se v simulaci Monte Carlo.${pocIv ? ` ${pocIv} ${pocIv === 1 ? 'buňka má' : 'buňky mají'} vlastní rozpětí, které má přednost.` : ' Přesnější je zadat rozpětí přímo do buňky (např. 20–25).'}</p>
      <h3>Hodnotová funkce u(x)</h3>
      ${sub ? '<p class="napoveda">U subjektivního hodnocení 1–10 se počítá lineárně (body už vyjadřují užitek).</p>' : `
      <div class="tlacitka">
        <button type="button" class="male fce-pred" data-druh="zadna" aria-pressed="${!k.funkce}">Lineární (výchozí)</button>
        <button type="button" class="male fce-pred" data-druh="saturace">Nasycení</button>
        <button type="button" class="male fce-pred" data-druh="cil">Cílová hodnota</button>
        <button type="button" class="male fce-pred" data-druh="konkavni">Klesající přínos</button>
        <button type="button" class="male fce-pred" data-druh="konvexni">Rostoucí přínos</button>
      </div>
      <p class="napoveda"><b>Nasycení</b>: nad (u minimalizace pod) zvolenou hodnotou už další zlepšení nepřidává. <b>Cílová hodnota</b>: nejlepší je konkrétní hodnota, odchylka oběma směry vadí.
        Body v grafu lze táhnout myší či prstem (nebo šipkami po označení tabulátorem).</p>
      ${k.funkce ? `<div class="obal-tab"><table class="fce-body"><thead><tr><th>x${k.jednotka ? ' [' + esc(k.jednotka) + ']' : ''}</th><th>u(x)</th><th></th></tr></thead><tbody>
        ${k.funkce.map((b, q) => `<tr><td><input type="text" inputmode="decimal" class="fb-x" data-q="${q}" value="${esc(String(+b[0].toPrecision(10)).replace('.', ','))}" aria-label="x bodu ${q + 1}"></td>
          <td><input type="text" inputmode="decimal" class="fb-u" data-q="${q}" value="${esc(String(+b[1].toFixed(3)).replace('.', ','))}" aria-label="u bodu ${q + 1}"></td>
          <td><button type="button" class="ikona fb-smaz" data-q="${q}" aria-label="Odebrat bod ${q + 1}" ${k.funkce.length <= 2 ? 'disabled' : ''}>×</button></td></tr>`).join('')}</tbody></table></div>
        <div class="tlacitka" style="margin-top:6px"><button type="button" class="male fb-pridat" ${k.funkce.length >= 12 ? 'disabled' : ''}>+ Bod</button></div>` : ''}`}
    </div><div><div class="graf-obal" id="fceGraf"></div>
      ${!sub && P.metoda !== 'mavt' && maFunkce() ? '<p class="napoveda stav-mez">Hodnotové funkce se uplatní jen v metodě MAVT. <button type="button" class="male fce-mavt">Přepnout na MAVT</button></p>' : ''}
    </div></div>`;
    vykresliFceGraf();
  }
  function vykresliFceGraf() {
    const el = $('fceGraf'); if (!el) return;
    const j = P.kriteria.findIndex(k => k.id === fceKrit); if (j < 0) return;
    const k = P.kriteria[j];
    const d = domenaFce(k, j);
    const body = k.funkce || J.predlohaFunkce('linearni', d.dataLo, d.dataHi > d.dataLo ? d.dataHi : d.dataLo + 1, k.typ);
    const znacky = P.alternativy.map((a, i) => ({ x: a.hodnoty[j], i })).filter(z => typeof z.x === 'number' && isFinite(z.x))
      .map(z => ({ x: z.x, u: J.hodnotaFunkce(body, z.x), index: z.i, nazev: P.alternativy[z.i].nazev }));
    el.innerHTML = G.editorFunkce(body, znacky, d.lo, d.hi, el.clientWidth || 480, k.jednotka) +
      (k.funkce ? '' : '<p class="napoveda" style="text-align:center">Bez vlastní funkce: lineárně mezi nejhorší a nejlepší hodnotou variant.</p>');
    if (!k.funkce) el.querySelectorAll('.fce-bod').forEach(c => c.remove());
  }
  function nastavFunkci(j, body, prepnout) {
    P.kriteria[j].funkce = body ? J.vycistiFunkci(body) : null;
    if (P.kriteria[j].funkce && prepnout && P.metoda !== 'mavt') {
      P.metoda = 'mavt';
      Dialog.info('Přepnuto na metodu MAVT, která hodnotové funkce používá.');
    }
  }
  let tah = null;
  function navazFce() {
    $('fceVyber').addEventListener('click', e => {
      const b = e.target.closest('[data-k]'); if (!b) return;
      fceKrit = b.dataset.k; vykresliFce();
    });
    const o = $('fceObsah');
    o.addEventListener('click', async e => {
      const j = P.kriteria.findIndex(k => k.id === fceKrit); if (j < 0) return;
      const k = P.kriteria[j];
      const pr = e.target.closest('.fce-pred');
      if (pr) {
        const druh = pr.dataset.druh;
        if (druh === 'zadna') nastavFunkci(j, null);
        else {
          const d = rozsahKriteria(j);
          if (!d) { Dialog.chyba('Nejdřív doplňte hodnoty variant v tomto kritériu.'); return; }
          let lo = d.min, hi = d.max > d.min ? d.max : d.min + 1, param;
          if (druh === 'saturace' || druh === 'cil') {
            const vych = druh === 'cil' ? (lo + hi) / 2 : (k.typ === 'min' ? lo + (hi - lo) * 0.3 : lo + (hi - lo) * 0.7);
            const t = await Dialog.zeptej(druh === 'cil' ? `Cílová (ideální) hodnota${k.jednotka ? ' [' + k.jednotka + ']' : ''}:` : `Bod nasycení – ${k.typ === 'min' ? 'pod' : 'nad'} touto hodnotou už další zlepšení nepřidává${k.jednotka ? ' [' + k.jednotka + ']' : ''}:`, F(vych, 2).replace(/ /g, ''));
            if (t === null) return;
            param = J.parsujCislo(t);
            if (!(typeof param === 'number' && isFinite(param))) { Dialog.chyba('Zadejte číslo.'); return; }
            lo = Math.min(lo, param); hi = Math.max(hi, param);
          }
          nastavFunkci(j, J.predlohaFunkce(druh, lo, hi, k.typ, param), true);
        }
        zmena('struktura'); return;
      }
      if (e.target.closest('.fce-mavt')) { P.metoda = 'mavt'; zmena('struktura'); return; }
      const sm = e.target.closest('.fb-smaz');
      if (sm && k.funkce && k.funkce.length > 2) { const b = k.funkce.slice(); b.splice(+sm.dataset.q, 1); nastavFunkci(j, b); zmena('struktura'); return; }
      if (e.target.closest('.fb-pridat') && k.funkce) {
        const b = k.funkce.slice();
        let q = 0, roz = -1;
        for (let z = 1; z < b.length; z++) if (b[z][0] - b[z - 1][0] > roz) { roz = b[z][0] - b[z - 1][0]; q = z; }
        b.splice(q, 0, [(b[q - 1][0] + b[q][0]) / 2, (b[q - 1][1] + b[q][1]) / 2]);
        nastavFunkci(j, b); zmena('struktura');
      }
    });
    o.addEventListener('change', e => {
      const j = P.kriteria.findIndex(k => k.id === fceKrit); if (j < 0) return;
      const k = P.kriteria[j], t = e.target;
      if (t.id === 'fceMin' || t.id === 'fceMax') {
        const v = J.parsujCislo(t.value);
        if (Number.isNaN(v)) { t.classList.add('chyba'); return; }
        t.classList.remove('chyba');
        k[t.id === 'fceMin' ? 'prahMin' : 'prahMax'] = v;
        if (k.prahMin !== null && k.prahMax !== null && k.prahMin > k.prahMax) Dialog.info('Dolní mez je vyšší než horní – nevyhoví žádná varianta.');
        zmena('struktura'); return;
      }
      if (t.classList.contains('fb-x') || t.classList.contains('fb-u')) {
        const v = J.parsujCislo(t.value);
        if (!(typeof v === 'number' && isFinite(v))) { t.classList.add('chyba'); return; }
        const b = k.funkce.map(x => x.slice());
        b[+t.dataset.q][t.classList.contains('fb-x') ? 0 : 1] = v;
        nastavFunkci(j, b); zmena('struktura');
      }
    });
    o.addEventListener('input', e => {
      if (e.target.id !== 'fceNej') return;
      const k = P.kriteria.find(x => x.id === fceKrit);
      k.nejistota = +e.target.value / 100;
      $('fceNejTxt').textContent = e.target.value;
      zmena('hodnoty');
      vykresliFceVyber();
    });
    // táhnutí bodů
    const souradnice = (svg, e) => {
      const r = svg.getBoundingClientRect(), d = svg.dataset;
      const sx = svg.viewBox.baseVal.width / r.width;
      const px = (e.clientX - r.left) * sx, py = (e.clientY - r.top) * sx;
      return { x: +d.x0 + (px - d.ml) / d.pw * (d.x1 - d.x0), u: 1 - (py - d.mt) / d.ph };
    };
    const zaokrouhli = (x, roz) => { const k = Math.pow(10, Math.floor(Math.log10(Math.max(roz, 1e-9))) - 2); return Math.round(x / k) * k; };
    function posunBod(j, q, x, u) {
      const k = P.kriteria[j], b = k.funkce.map(p => p.slice());
      const roz = (b[b.length - 1][0] - b[0][0]) || 1;
      const mez = roz * 0.002;
      const lo = q > 0 ? b[q - 1][0] + mez : -Infinity, hi = q < b.length - 1 ? b[q + 1][0] - mez : Infinity;
      b[q] = [Math.max(lo, Math.min(hi, zaokrouhli(x, roz))), Math.max(0, Math.min(1, Math.round(u * 100) / 100))];
      k.funkce = b;
    }
    o.addEventListener('pointerdown', e => {
      const c = e.target.closest('.fce-bod'); if (!c) return;
      const j = P.kriteria.findIndex(k => k.id === fceKrit);
      tah = { j, q: +c.dataset.bod, svg: c.ownerSVGElement, id: e.pointerId };
      try { tah.svg.setPointerCapture(e.pointerId); } catch (err) { /* nic */ }
      e.preventDefault();
    });
    o.addEventListener('pointermove', e => {
      if (!tah || e.pointerId !== tah.id) return;
      const s = souradnice(tah.svg, e);
      posunBod(tah.j, tah.q, s.x, s.u);
      // průběžně překreslit jen geometrii (zachová zachycení ukazatele)
      const svg = tah.svg, d = svg.dataset, b = P.kriteria[tah.j].funkce;
      const X = x => +d.ml + (x - d.x0) / (d.x1 - d.x0) * d.pw, Y = u => +d.mt + (1 - u) * d.ph;
      const pts = [[+d.x0, b[0][1]]].concat(b).concat([[+d.x1, b[b.length - 1][1]]]);
      svg.querySelector('.fce-cara').setAttribute('d', pts.map((p, k) => (k ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join(''));
      const c = svg.querySelector(`.fce-bod[data-bod="${tah.q}"]`);
      c.setAttribute('cx', X(b[tah.q][0])); c.setAttribute('cy', Y(b[tah.q][1]));
      ukazTip(`x = ${F(b[tah.q][0], 3)} → u = ${F(b[tah.q][1], 2)}`, e.clientX, e.clientY);
    });
    const konec = e => {
      if (!tah || (e && e.pointerId !== tah.id)) return;
      tah = null; $('tip').hidden = true;
      zmena('struktura');
    };
    o.addEventListener('pointerup', konec);
    o.addEventListener('pointercancel', konec);
    o.addEventListener('keydown', e => {
      const c = e.target.closest('.fce-bod'); if (!c) return;
      const j = P.kriteria.findIndex(k => k.id === fceKrit), q = +c.dataset.bod, b = P.kriteria[j].funkce;
      const roz = (b[b.length - 1][0] - b[0][0]) || 1;
      const dx = { ArrowLeft: -roz / 100, ArrowRight: roz / 100 }[e.key] || 0, du = { ArrowUp: 0.05, ArrowDown: -0.05 }[e.key] || 0;
      if (!dx && !du) return;
      e.preventDefault();
      posunBod(j, q, b[q][0] + dx, b[q][1] + du);
      zmena('struktura');
      const n = document.querySelector(`#fceGraf .fce-bod[data-bod="${q}"]`); if (n) n.focus();
    });
  }

  /* ================= TĚŽŠÍ VÝPOČTY ================= */
  function naplanujTezke() { clearTimeout(casTezke); casTezke = setTimeout(tezke, 90); }
  function tezke() {
    if (!S) return;
    const st = S;
    const upoz = [];
    if (st.ok && st.aktivni.length > 1) {
      const kroky = st.Xa.length ** 2 * st.typy.length ** 2 > 40000 ? 40 : 100;
      st.citl = st.typy.length >= 2 ? st.typy.map((_, j) => J.citlivost(P.metoda, st.Xa, st.typy, st.w, j, Object.assign({ kroky }, volbyMetody()))) : [];
      const smaaPlatne = smaaVysl && smaaVysl.verze === verze ? smaaVysl.r : null;
      try {
        const v = J.vysvetli(st.Xa, st.typy, st.w, st.nazvyA, P.kriteria.map(k => k.nazev), P.metoda, volbyMetody(), { citlivost: st.citl, smaa: smaaPlatne });
        st.vysvetleni = v; posledniVysvetleni = v ? v.text : null;
      } catch (e) { /* ponechat jednodušší */ }
      st.porovnani = J.porovnejMetody(st.Xa, st.typy, st.w, volbyMetody(), J.METODY.map(m => m.id).filter(id => id !== 'mavt' || maFunkce() || P.metoda === 'mavt'));
    }
    posluchaci.forEach(fn => { try { fn('tezke', st); } catch (e) { console.error(e); } });
    if (rezim !== 'plne') return;
    if (st.ok) $('proc').innerHTML = posledniVysvetleni ? '<b>Proč?</b> ' + esc(posledniVysvetleni) : '';
    if (!st.ok || st.aktivni.length < 2) {
      ['citTab', 'citGraf', 'citLegenda', 'porovnani', 'porovnaniZaver', 'spearman'].forEach(id => { $(id).innerHTML = ''; });
      $('citNadpis').textContent = '';
      if (st.ok) vykresliUpozorneni(upoz);
      vykresliSmaaStav();
      return;
    }
    vykresliPorovnani(upoz);
    vykresliCitlivost(upoz);
    vykresliSmaaStav();
    vykresliUpozorneni(upoz);
  }

  function vykresliPorovnani(upoz) {
    const st = S, A = st.nazvyA, por = st.porovnani;
    const ref = por.metody.find(m => m.id === P.metoda);
    const refPor = ref && ref.poradi ? ref.poradi : (por.metody.find(m => m.poradi) || {}).poradi;
    const platne = por.metody.filter(m => m.poradi);
    const prumer = A.map((_, i) => platne.reduce((s, m) => s + m.prum[i], 0) / (platne.length || 1));
    const radky = refPor ? A.map((_, i) => i).sort((a, b) => refPor[a] - refPor[b] || prumer[a] - prumer[b]) : A.map((_, i) => i);
    let h = `<table class="poradi-tab"><thead><tr><th>Varianta</th>${por.metody.map(m => `<th class="cis${m.id === P.metoda ? ' ref' : ''}">${esc(m.kratce)}${m.id === P.metoda ? ' ●' : ''}</th>`).join('')}<th class="cis">Průměr</th></tr></thead><tbody>`;
    h += radky.map(i => `<tr><td>${esc(A[i])}</td>${por.metody.map(m => m.poradi
      ? `<td class="cis${refPor && m.poradi[i] !== refPor[i] ? ' lisi' : ''}" data-tip="${esc(m.nazev + '\n' + A[i] + ': ' + m.poradi[i] + '. místo, ' + (m.id === 'vikor' ? 'Q = ' + F(1 - m.skore[i], 4) : 'skóre ' + F(m.skore[i], 4)))}">${m.poradi[i]}.</td>`
      : `<td class="cis nelze" title="${esc(m.chyba)}">nelze</td>`).join('')}<td class="cis">${F(prumer[i], 2)}</td></tr>`).join('');
    $('porovnani').innerHTML = h + '</tbody></table>';
    const vitezove = platne.map(m => ({ m, v: m.poradi.map((r, i) => (r === 1 ? i : -1)).filter(i => i >= 0) }));
    const mn = new Set(vitezove.map(x => x.v.join(',')));
    let z;
    if (mn.size === 1) z = `<p class="napoveda"><span class="stav-ok">✓</span> Všechny použitelné metody (${platne.length}) určují stejného vítěze: <b>${esc(vitezove[0].v.map(i => A[i]).join(' = '))}</b>.</p>`;
    else {
      z = `<p class="napoveda"><span class="stav-mez">⚠</span> Metody se v určení vítěze liší: ${vitezove.map(x => `${esc(x.m.kratce)} → <b>${esc(x.v.map(i => A[i]).join(' = '))}</b>`).join(' · ')}.</p>`;
      upoz.push('Vítěz závisí na zvolené metodě nebo normalizaci (' + vitezove.map(x => x.m.kratce + ': ' + x.v.map(i => A[i]).join(' = ')).join('; ') + '). Rozdíl mezi variantami je na hranici rozlišitelnosti modelu.');
    }
    const nelze = por.metody.filter(m => m.chyba);
    if (nelze.length) z += `<p class="napoveda">Nepoužitelné: ${nelze.map(m => `${esc(m.kratce)} (${esc(m.chyba)})`).join('; ')}</p>`;
    $('porovnaniZaver').innerHTML = z;
    $('spearman').innerHTML = `<table><thead><tr><th></th>${por.metody.map(m => `<th class="cis">${esc(m.kratce)}</th>`).join('')}</tr></thead><tbody>${
      por.metody.map((m, a) => `<tr><th>${esc(m.kratce)}</th>${por.spearman[a].map((r, b) => `<td class="cis">${r === null ? '–' : a === b ? '1' : F(r, 2)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  function vykresliCitlivost(upoz) {
    const st = S, k = P.kriteria, A = st.nazvyA, cit = st.citl;
    if (!cit.length) {
      $('citTab').innerHTML = '<tbody><tr><td class="zadna">Citlivost vah má smysl až pro 2 a více kritérií.</td></tr></tbody>';
      $('citGraf').innerHTML = ''; $('citLegenda').innerHTML = ''; $('citNadpis').textContent = '';
      return;
    }
    const rez = cit.map(c => J.rezervaCitlivosti(c));
    if (!vybraneKrit || !k.some(x => x.id === vybraneKrit)) vybraneKrit = k[rez.indexOf(Math.min(...rez))].id;
    $('citTab').innerHTML = `<thead><tr><th>Kritérium</th><th class="cis">Váha</th><th class="cis">Vítěz se nemění pro váhu</th><th class="sloup-int">Interval</th><th class="cis">Rezerva</th><th>Mimo interval vyhraje</th></tr></thead><tbody>${
      cit.map((c, j) => {
        const citl = rez[j] < 0.05;
        const mimo = [c.vitezPod !== null ? `pod ${F(c.od * 100, 1)} %: ${esc(A[c.vitezPod])}` : '', c.vitezNad !== null ? `nad ${F(c.do * 100, 1)} %: ${esc(A[c.vitezNad])}` : ''].filter(Boolean).join('<br>') || '<span class="stav-ok">nikdo jiný (0–100 %)</span>';
        return `<tr data-k="${k[j].id}" class="${k[j].id === vybraneKrit ? 'vybrany' : ''}" tabindex="0">
          <td>${esc(k[j].nazev)}</td><td class="cis">${F(c.w0 * 100, 1)} %</td><td class="cis">${F(c.od * 100, 1)} – ${F(c.do * 100, 1)} %</td>
          <td class="sloup-int"><div class="mini-pruh" aria-hidden="true"><i style="left:${c.od * 100}%;width:${(c.do - c.od) * 100}%"></i><b style="left:calc(${c.w0 * 100}% - 1px)"></b></div></td>
          <td class="cis${citl ? ' citlive' : ''}">${citl ? '⚠ ' : ''}${isFinite(rez[j]) ? F(rez[j] * 100, 1) + ' p. b.' : '∞'}</td><td style="font-size:.8rem">${mimo}</td></tr>`;
      }).join('')}</tbody>`;
    const citliva = cit.map((c, j) => ({ j, r: rez[j] })).filter(x => x.r < 0.05);
    if (citliva.length) upoz.push('Výsledek je citlivý na váhy: vítěz se změní, když se váha kritéria ' + citliva.map(x => '„' + k[x.j].nazev + '“ změní o ' + F(x.r * 100, 1) + ' p. b.').join(', ') + ' Zvažte, jak jistě jste váhy stanovili.');
    vykresliCitGraf();
  }
  function vykresliCitGraf() {
    const st = S;
    if (!st || !st.citl || !st.citl.length) return;
    const j = P.kriteria.findIndex(x => x.id === vybraneKrit);
    if (j < 0) return;
    const c = st.citl[j];
    $('citNadpis').textContent = 'Průběh skóre – ' + P.kriteria[j].nazev + ' (' + nazevMetody() + ')';
    $('citLegenda').innerHTML = G.legendaAlt(st.nazvyA, skryteCit, st.aktivni[c.vitez], st.aktivni);
    $('citGraf').innerHTML = G.citlivost(c, st.nazvyA, $('citGraf').clientWidth || 700, P.kriteria[j].nazev, { skryte: skryteCit, entity: st.aktivni });
  }

  function vykresliUpozorneni(extra) {
    const st = S, pol = extra.slice();
    if (st.ok && st.vysl && st.aktivni.length > 1) {
      const ser = st.vysl.skore.slice().sort((a, b) => b - a), roz = ser[0] - ser[ser.length - 1];
      if (roz > 0 && (ser[0] - ser[1]) / roz < 0.03) pol.push('První dvě varianty mají téměř stejné skóre (rozdíl pod 3 % rozpětí). Takový rozdíl leží v mezích nejistoty vstupních hodnot.');
    }
    const vyr = st.elim.filter(d => d.length).length;
    if (vyr) pol.push(`${pocet(vyr, 'varianta byla vyřazena', 'varianty byly vyřazeny', 'variant bylo vyřazeno')} povinnou mezí (viz výsledné pořadí).`);
    if (st.vh.ahp && st.vh.ahp.CR !== null && st.vh.ahp.CR > 0.1) pol.push('Párová porovnání vah nejsou konzistentní (CR = ' + F(st.vh.ahp.CR, 3) + ' > 0,1). Váhy z nich odvozené jsou méně spolehlivé.');
    if (st.vh.skupina && st.vh.skupina.W !== null && st.vh.skupina.W < 0.5) pol.push('Hodnotitelé se v důležitosti kritérií shodují jen slabě (Kendallovo W = ' + F(st.vh.skupina.W, 2) + '). Průměrné váhy pak nikoho dobře nereprezentují – zkuste rozdíly prodiskutovat.');
    if (smaaVysl && smaaVysl.verze === verze && st.ok) {
      const q = st.aktivni.indexOf(smaaVysl.entity[J.vitez(smaaVysl.r.b.map(r => r[0]))]);
      const p1 = smaaVysl.r.b[st.vitezQ] ? smaaVysl.r.b[st.vitezQ][0] : null;
      if (p1 !== null && p1 < 0.5) pol.push(`Při zadané nejistotě je vítěz první jen v ${F(p1 * 100, 0)} % simulací${q >= 0 && q !== st.vitezQ ? ' – častěji vyhrává ' + st.nazvyA[q] : ''}.`);
    }
    if (P.kriteria.some(k => k.funkce) && P.metoda !== 'mavt') pol.push('Některá kritéria mají hodnotovou funkci, ale zvolená metoda ji nepoužívá (uplatní se jen v MAVT a v dominanci).');
    const subj = P.kriteria.filter(x => x.typ === 'subj');
    const zakl = `Pořadí vždy závisí na <b>subjektivně zvolených vahách</b> a na <b>metodě normalizace</b> (min-max zesiluje malé rozdíly, vektorová je stlačuje; přidání nebo odebrání varianty může změnit pořadí ostatních).${subj.length ? ' Subjektivní hodnocení (' + subj.map(x => esc(x.nazev)).join(', ') + ') je navíc odhad – zkuste, jak se výsledek změní o ±1 bod.' : ''}`;
    $('upozorneni').innerHTML = `<div class="upozorneni"><b class="t">${pol.length ? '⚠ Upozornění' : 'Mějte na paměti'}</b>${pol.length ? '<ul>' + pol.map(p => `<li>${esc(p)}</li>`).join('') + '</ul>' : ''}<p style="margin:6px 0 0">${zakl}</p></div>`;
  }

  /* --- SMAA --- */
  function spustSmaa() {
    if (smaaBezi) { smaaBezi.zrus = true; return; }
    const st = S;
    if (!st.ok || st.aktivni.length < 2) { Dialog.chyba('Simulace potřebuje kompletní matici a aspoň 2 vyhovující varianty.'); return; }
    const nast = { metoda: P.metoda, volby: volbyMetody(), typy: st.typy, w: st.w, vahy: P.smaa.vahy, rozptylVah: P.smaa.rozptylVah,
      nejistoty: P.kriteria.map(k => k.nejistota), intervaly: st.aktivni.map(i => P.alternativy[i].intervaly), seed: 20261019 };
    const sim = J.vytvorSmaa(st.Xa, nast);
    const N = P.smaa.iterace, v = verze;
    const beh = { zrus: false };
    smaaBezi = beh;
    let hotovo = 0;
    $('btnSmaa').textContent = '■ Zastavit';
    $('smaaPrubeh').hidden = false;
    const krok = () => {
      if (beh.zrus || v !== verze) {
        smaaBezi = null; $('btnSmaa').textContent = '▶ Spustit simulaci'; $('smaaPrubeh').hidden = true;
        if (v !== verze) Dialog.info('Simulace přerušena – data se změnila.');
        return;
      }
      const t0 = performance.now();
      while (hotovo < N && performance.now() - t0 < 35) { const d = Math.min(100, N - hotovo); sim.krok(d); hotovo += d; }
      $('smaaPrubeh').firstElementChild.style.width = (hotovo / N * 100) + '%';
      if (hotovo < N) { setTimeout(krok, 0); return; }
      smaaVysl = { verze: v, r: sim.vysledek(), entity: st.aktivni.slice(), metoda: nazevMetody(), nastaveni: Object.assign({}, P.smaa) };
      smaaBezi = null; $('btnSmaa').textContent = '▶ Spustit simulaci'; $('smaaPrubeh').hidden = true;
      vykresliSmaa();
      naplanujTezke();
    };
    setTimeout(krok, 0);
  }
  function vykresliSmaaStav() {
    const el = $('smaaVysledek');
    if (!smaaVysl) { el.innerHTML = '<p class="napoveda">Simulace zatím neproběhla.</p>'; return; }
    el.classList.toggle('zastarale', smaaVysl.verze !== verze);
    const pozn = el.querySelector('.smaa-pozn');
    if (pozn) pozn.innerHTML = smaaVysl.verze !== verze ? '<span class="stav-mez">⚠ Výsledek je zastaralý – data se od simulace změnila. Spusťte ji znovu.</span>' : '';
  }
  function vykresliSmaa() {
    const s = smaaVysl, r = s.r, nazvy = s.entity.map(i => P.alternativy[i] ? P.alternativy[i].nazev : '?');
    const ser = r.ocekavanePoradi.map((x, q) => q).sort((a, b) => r.ocekavanePoradi[a] - r.ocekavanePoradi[b]);
    const m = r.b.length;
    const popVah = { kolem: `kolem zadaných vah ±${F(s.nastaveni.rozptylVah * 100, 0)} %`, poradi: 'se zachovaným pořadím důležitosti', uniformni: 'zcela neznámé (rovnoměrně ze všech možných)' }[s.nastaveni.vahy];
    let h = `<p class="napoveda smaa-pozn"></p><p class="napoveda">${F(r.platne, 0)} simulací metodou ${esc(s.metoda)}, váhy ${popVah}.${r.neplatne ? ` <span class="stav-mez">${F(r.neplatne, 0)} vzorků nešlo spočítat (${esc(r.posledniChyba)}).</span>` : ''}</p>`;
    h += G.akceptabilita(ser.map(q => r.b[q]), ser.map(q => nazvy[q]));
    h += `<div class="obal-tab" style="margin-top:10px"><table class="smaa-tab"><thead><tr><th>Varianta</th><th class="cis">1. místo</th>${m > 2 ? '<th class="cis">do 3. místa</th>' : ''}<th class="cis">Průměrné pořadí</th><th>Centrální váhy (kdy vyhrává)</th></tr></thead><tbody>
      ${ser.map(q => {
        const cw = r.centralniVahy[q];
        const top = cw ? cw.map((x, j) => ({ x, j })).sort((a, b) => b.x - a.x).slice(0, 3).map(z => `${esc(P.kriteria[z.j] ? P.kriteria[z.j].nazev : '?')} ${F(z.x * 100, 0)} %`).join(', ') : '<span class="zadna">nikdy nevyhrává</span>';
        return `<tr><td>${esc(nazvy[q])}</td><td class="cis p1">${F(r.b[q][0] * 100, 1)} %</td>${m > 2 ? `<td class="cis">${F((r.b[q][0] + r.b[q][1] + (r.b[q][2] || 0)) * 100, 1)} %</td>` : ''}<td class="cis">${F(r.ocekavanePoradi[q], 2)}</td><td style="font-size:.8rem">${top}</td></tr>`;
      }).join('')}</tbody></table></div>
      <p class="napoveda">Centrální váhy = průměrné váhy ve simulacích, kdy varianta vyhrála – ukazují, „jaký rozhodovatel“ by ji zvolil.</p>`;
    $('smaaVysledek').innerHTML = h;
    vykresliSmaaStav();
  }

  /* ================= TOOLTIP ================= */
  function ukazTip(text, x, y) {
    const tip = $('tip');
    tip.textContent = text; tip.hidden = false;
    const r = tip.getBoundingClientRect();
    let l = x + 14, t = y + 14;
    if (l + r.width > window.innerWidth - 6) l = Math.max(6, x - r.width - 14);
    if (t + r.height > window.innerHeight - 6) t = Math.max(6, y - r.height - 14);
    tip.style.left = l + 'px'; tip.style.top = t + 'px';
  }
  function initTooltip() {
    const tip = $('tip');
    document.addEventListener('pointermove', e => {
      if (tah) return;
      const z = e.target.closest && e.target.closest('.cit-zachyt');
      if (z) { kurzorCit(z, e); return; }
      const el = e.target.closest && e.target.closest('[data-tip]');
      if (el) ukazTip(el.getAttribute('data-tip'), e.clientX, e.clientY);
      else tip.hidden = true;
    });
    document.addEventListener('scroll', () => { if (!tah) tip.hidden = true; }, true);
    function kurzorCit(z, e) {
      const svg = z.ownerSVGElement, r = svg.getBoundingClientRect();
      const sx = svg.viewBox.baseVal.width / r.width;
      const ml = +z.dataset.ml, pw = +z.dataset.pw;
      const t = Math.max(0, Math.min(1, ((e.clientX - r.left) * sx - ml) / pw));
      const j = P.kriteria.findIndex(x => x.id === vybraneKrit);
      const c = S && S.citl && S.citl[j];
      if (!c) return;
      const p = c.prubeh.reduce((b, q) => (Math.abs(q.t - t) < Math.abs(b.t - t) ? q : b), c.prubeh[0]);
      const kur = svg.querySelector('.kurzor');
      kur.setAttribute('x1', ml + p.t * pw); kur.setAttribute('x2', ml + p.t * pw); kur.style.display = '';
      const rad = p.skore.map((s, q) => [s, q]).filter(x => !skryteCit.has(S.aktivni[x[1]])).sort((a, b) => b[0] - a[0]);
      ukazTip(`Váha ${P.kriteria[j].nazev}: ${F(p.t * 100, 0)} %\n` + rad.map(([s, q], n) => `${n + 1}. ${S.nazvyA[q]}: ${F(s, 3)}`).join('\n'), e.clientX, e.clientY);
    }
    document.addEventListener('pointerout', e => {
      if (e.target.classList && e.target.classList.contains('cit-zachyt')) { const k = e.target.ownerSVGElement.querySelector('.kurzor'); if (k) k.style.display = 'none'; }
    });
  }

  /* ================= PROJEKTY, EXPORT, SDÍLENÍ ================= */
  function ulozene() { const u = lsCti(KLIC_PROJ); return u && typeof u === 'object' ? u : {}; }
  function vykresliUlozene() {
    const u = ulozene(), kl = Object.keys(u).sort((a, b) => String(u[b].ulozeno).localeCompare(String(u[a].ulozeno)));
    $('pocetUlozenych').textContent = kl.length;
    $('seznamUlozenych').innerHTML = kl.length ? kl.map(x => {
      const d = new Date(u[x].ulozeno);
      return `<div class="ulozeny"><span class="jm">${esc(u[x].projekt.nazev)}</span><span class="kdy">${isNaN(d) ? '' : d.toLocaleString('cs-CZ')}</span>
        <button type="button" class="male" data-otevri="${esc(x)}">Otevřít</button><button type="button" class="male" data-smaz="${esc(x)}">Smazat</button></div>`;
    }).join('') : '<p class="napoveda">Zatím nic uloženo. Projekty se ukládají do tohoto prohlížeče (localStorage); pro zálohu použijte Export JSON nebo sdílený odkaz.</p>';
  }
  async function ulozProjekt() {
    const jm = await Dialog.zeptej('Uložit projekt pod názvem:', P.nazev);
    if (jm === null) return;
    const nazev = jm.trim() || 'Bez názvu';
    const u = ulozene();
    if (u[nazev] && !(await Dialog.potvrd(`Projekt „${nazev}“ už existuje. Přepsat?`))) return;
    P.nazev = nazev; $('nazevProjektu').value = nazev;
    u[nazev] = { ulozeno: new Date().toISOString(), projekt: P };
    if (lsPis(KLIC_PROJ, u)) Dialog.info('Projekt uložen.'); else Dialog.chyba('Uložení selhalo (úložiště prohlížeče je plné nebo zakázané). Použijte Export JSON.');
    vykresliUlozene();
  }
  function stahni(obsah, nazev, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([obsah], { type: typ }));
    a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const souborNazev = () => (P.nazev || 'rozhodovani').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase() || 'rozhodovani';

  async function kodujOdkaz() {
    const json = JSON.stringify(P);
    const bajty = new TextEncoder().encode(json);
    if (typeof CompressionStream !== 'undefined') {
      try {
        const z = await new Response(new Blob([bajty]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
        return 'z' + J.base64url(new Uint8Array(z));
      } catch (e) { /* bez komprese */ }
    }
    return 'j' + J.base64url(bajty);
  }
  async function dekodujOdkaz(t) {
    const bajty = J.zBase64url(t.slice(1));
    let text;
    if (t[0] === 'z') {
      if (typeof DecompressionStream === 'undefined') throw new Error('Tento prohlížeč neumí rozbalit komprimovaný odkaz.');
      text = await new Response(new Blob([bajty]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    } else if (t[0] === 'j') text = new TextDecoder().decode(bajty);
    else throw new Error('Neznámý formát odkazu.');
    return J.overProjekt(JSON.parse(text));
  }
  async function sdilej() {
    const kod = await kodujOdkaz();
    const url = location.href.split('#')[0] + '#p=' + kod;
    if (url.length > 30000) Dialog.info('Odkaz je velmi dlouhý – některé aplikace ho mohou zkrátit. Pro velké projekty použijte Export JSON.');
    let ok = false;
    try { await navigator.clipboard.writeText(url); ok = true; } catch (e) { ok = false; }
    if (ok) Dialog.info('Odkaz s celým projektem je ve schránce. Kdo ho otevře, uvidí vaše data (nic se neposílá na server – vše je v odkazu).');
    else await Dialog.zeptej('Zkopírujte odkaz (obsahuje celý projekt):', url);
  }

  function exportCsv() {
    const st = S;
    const ok = st.ok;
    const proj = ok ? Object.assign({}, P, { alternativy: st.aktivni.map(i => P.alternativy[i]) }) : P;
    let csv = J.vytvorCsv(proj, st.w, ok && st.porovnani ? st.porovnani : null, nazevMetody());
    const vyr = st.elim.map((d, i) => (d.length ? P.alternativy[i].nazev.replace(/;/g, ',') + ';' + d.map(x => x.text).join(', ').replace(/;/g, ',') : '')).filter(Boolean);
    if (vyr.length) csv += '\r\nVyřazené varianty;Důvod\r\n' + vyr.join('\r\n') + '\r\n';
    if (ok && st.citl && st.citl.length) {
      csv += '\r\nCitlivost (' + nazevMetody().replace(/;/g, ',') + ');Váha;Vítěz se nemění od;do\r\n' +
        st.citl.map((c, j) => [P.kriteria[j].nazev.replace(/;/g, ','), F(c.w0, 4), F(c.od, 4), F(c.do, 4)].join(';')).join('\r\n') + '\r\n';
    }
    if (smaaVysl && smaaVysl.verze === verze) {
      csv += '\r\nSimulace SMAA;' + smaaVysl.r.b[0].map((_, r) => (r + 1) + '. místo').join(';') + '\r\n' +
        smaaVysl.entity.map((i, q) => [P.alternativy[i].nazev.replace(/;/g, ',')].concat(smaaVysl.r.b[q].map(x => F(x, 4))).join(';')).join('\r\n') + '\r\n';
    }
    stahni('﻿' + csv, souborNazev() + '.csv', 'text/csv;charset=utf-8');
  }

  /* --- tisková zpráva --- */
  function tiskovaZprava() {
    const st = S;
    if (!st.ok) { Dialog.chyba('Zprávu lze vytvořit až z kompletní matice.'); return; }
    if (!st.citl || !st.porovnani) tezke();
    const k = P.kriteria, A = P.alternativy;
    const rz = REZIMY.find(x => x.id === P.vahyRezim);
    const t = (h, b) => `<table><thead><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${b.join('')}</tbody></table>`;
    let h = `<h1>${esc(P.nazev)}</h1><p>Vícekriteriální rozhodnutí · ${new Date().toLocaleDateString('cs-CZ')} · metoda ${esc(nazevMetody())} · váhy: ${esc(rz.nazev)}</p>`;
    if (P.poznamka) h += `<p><i>${esc(P.poznamka)}</i></p>`;
    h += '<h2>Výsledek</h2>';
    h += `<p><b>Doporučení: ${esc(st.serazeno.filter(q => st.por[q] === 1).map(q => st.nazvyA[q]).join(' = '))}</b></p>`;
    if (posledniVysvetleni) h += `<div class="proc">${esc(posledniVysvetleni)}</div>`;
    h += G.sloupce(st.serazeno.map(q => ({ nazev: st.nazvyA[q], hodnota: st.vysl.skore[q], znacka: st.por[q] + '.' })), { des: 3, min: P.metoda === 'promethee' ? -1 : 0, max: 1 });
    h += htmlVyrazene();
    h += '<h2>Kritéria a váhy</h2>' + t(['Kritérium', 'Směr', 'Jednotka', 'Váha', 'Povinná mez', 'Hodnotová funkce'], k.map((x, j) => `<tr><td>${esc(x.nazev)}</td><td>${TYPY[x.typ].nazev}</td><td>${esc(x.jednotka)}</td><td>${F(st.w[j] * 100, 1)} %</td>
      <td>${[x.prahMin !== null ? '≥ ' + F(x.prahMin, 2) : '', x.prahMax !== null ? '≤ ' + F(x.prahMax, 2) : ''].filter(Boolean).join(', ') || '–'}</td><td>${x.funkce ? x.funkce.map(b => `(${F(b[0], 2)}; ${F(b[1], 2)})`).join(' ') : 'lineární'}</td></tr>`));
    if (st.vh.ahp) h += `<p>AHP: λmax = ${F(st.vh.ahp.lambda, 3)}, CR = ${st.vh.ahp.CR === null ? '–' : F(st.vh.ahp.CR, 3)}.</p>`;
    if (st.vh.skupina) h += `<p>Skupina ${P.skupina.hodnotitele.length} hodnotitelů, Kendallovo W = ${st.vh.skupina.W === null ? '–' : F(st.vh.skupina.W, 2)}.</p>`;
    h += '<h2>Rozhodovací matice</h2>' + t(['Varianta'].concat(k.map(x => esc(x.nazev) + (x.jednotka ? ' [' + esc(x.jednotka) + ']' : ''))),
      A.map((a, i) => `<tr><td>${esc(a.nazev)}${st.elim[i].length ? ' (vyřazena)' : ''}</td>${k.map((x, j) => `<td>${esc(vstupText(i, j))}</td>`).join('')}</tr>`));
    if (st.porovnani) h += '<h2>Porovnání metod (pořadí)</h2>' + t(['Varianta'].concat(st.porovnani.metody.map(m => esc(m.kratce))),
      st.serazeno.map(q => `<tr><td>${esc(st.nazvyA[q])}</td>${st.porovnani.metody.map(m => `<td>${m.poradi ? m.poradi[q] + '.' : 'nelze'}</td>`).join('')}</tr>`));
    if (st.citl && st.citl.length) h += '<h2>Citlivost vah</h2>' + t(['Kritérium', 'Váha', 'Vítěz se nemění pro váhu'],
      st.citl.map((c, j) => `<tr><td>${esc(k[j].nazev)}</td><td>${F(c.w0 * 100, 1)} %</td><td>${F(c.od * 100, 1)} – ${F(c.do * 100, 1)} %</td></tr>`));
    if (smaaVysl && smaaVysl.verze === verze) h += '<h2>Simulace nejistoty (SMAA)</h2>' + t(['Varianta', '1. místo', 'Průměrné pořadí'],
      smaaVysl.entity.map((i, q) => `<tr><td>${esc(A[i].nazev)}</td><td>${F(smaaVysl.r.b[q][0] * 100, 1)} %</td><td>${F(smaaVysl.r.ocekavanePoradi[q], 2)}</td></tr>`));
    h += '<h2>Omezení</h2><p>Výsledek závisí na zvolených kritériích, subjektivních vahách, normalizaci a metodě. Hodnoty v šablonách jsou ilustrativní.</p>';
    $('zprava').innerHTML = h;
    document.body.classList.add('tisk-zpravy');
    const konec = () => { document.body.classList.remove('tisk-zpravy'); window.removeEventListener('afterprint', konec); };
    window.addEventListener('afterprint', konec);
    window.print();
    setTimeout(konec, 1500);
  }

  /* ================= REŽIM ZOBRAZENÍ ================= */
  function prepniRezim(r) {
    rezim = r === 'plne' ? 'plne' : 'pruvodce';
    try { localStorage.setItem(KLIC_REZIM, rezim); } catch (e) { /* nic */ }
    $('tabPruvodce').setAttribute('aria-selected', String(rezim === 'pruvodce'));
    $('tabPlne').setAttribute('aria-selected', String(rezim === 'plne'));
    $('pruvodce').hidden = rezim !== 'pruvodce';
    $('plne').hidden = rezim !== 'plne';
    if (rezim === 'plne') { vykresliPlne('vse'); naplanujTezke(); if (smaaVysl) vykresliSmaa(); else vykresliSmaaStav(); }
    else $('vahyEditor').innerHTML = '';
    posluchaci.forEach(fn => { try { fn('rezim', S); } catch (e) { console.error(e); } });
  }

  function nactiProjekt(p) {
    P = p;
    skryteRadar = null; skryteCit.clear(); vybraneKrit = null; fceKrit = null; smaaVysl = null;
    if (smaaBezi) smaaBezi.zrus = true;
    $('nazevProjektu').value = P.nazev;
    zmena('struktura');
    if (rezim === 'plne') vykresliPlne('vse');
    posluchaci.forEach(fn => { try { fn('nacteno', S); } catch (e) { console.error(e); } });
  }

  /* ================= UDÁLOSTI ================= */
  function initUdalosti() {
    $('tabPruvodce').addEventListener('click', () => prepniRezim('pruvodce'));
    $('tabPlne').addEventListener('click', () => prepniRezim('plne'));
    $('nazevProjektu').addEventListener('input', e => { P.nazev = e.target.value; ulozAktualni(); posluchaci.forEach(fn => fn('nazev', S)); });

    // matice
    const mat = $('matice');
    mat.addEventListener('input', e => {
      const tr = e.target.closest('tr[data-i]'); if (!tr) return;
      const i = +tr.dataset.i;
      if (e.target.classList.contains('a-nazev')) { P.alternativy[i].nazev = e.target.value; zmena('hodnoty'); return; }
      if (!e.target.classList.contains('hodn')) return;
      const r = nastavHodnotu(i, +e.target.dataset.j, e.target.value);
      e.target.classList.toggle('interval', !!r.interval);
      zmena('hodnoty');
    });
    mat.addEventListener('click', async e => {
      const b = e.target.closest('.a-smaz'); if (!b) return;
      await smazAlternativu(+b.closest('tr').dataset.i);
    });
    $('btnPridatAlt').addEventListener('click', () => {
      if (!pridejAlternativu()) return;
      const pole = document.querySelectorAll('#matice .a-nazev'); pole[pole.length - 1].select();
    });

    // metoda
    $('metoda').addEventListener('change', e => {
      const v = e.target.value;
      P.metoda = v === 'wsm' ? 'wsm-' + $('normalizace').value : v;
      nastavOvladaceMetody(); zmena('metoda'); vykresliFceObsah();
    });
    $('normalizace').addEventListener('change', e => { P.metoda = 'wsm-' + e.target.value; zmena('metoda'); });
    $('prefFunkce').addEventListener('change', e => { P.prefFunkce = e.target.value; zmena('metoda'); });
    $('vikorV').addEventListener('input', e => { P.vikorV = +e.target.value; $('vikorVTxt').textContent = F(P.vikorV, 2); zmena('metoda'); });

    // SMAA
    $('smaaVahy').addEventListener('change', e => { P.smaa.vahy = e.target.value; $('poleRozptyl').hidden = P.smaa.vahy !== 'kolem'; ulozAktualni(); });
    $('smaaRozptyl').addEventListener('input', e => { P.smaa.rozptylVah = +e.target.value / 100; $('smaaRozptylTxt').textContent = e.target.value; ulozAktualni(); });
    $('smaaIterace').addEventListener('change', e => { P.smaa.iterace = +e.target.value; ulozAktualni(); });
    $('btnSmaa').addEventListener('click', spustSmaa);

    // legendy, citlivost
    $('radarLegenda').addEventListener('click', e => {
      const b = e.target.closest('[data-alt]'); if (!b) return;
      const i = +b.dataset.alt;
      if (skryteRadar.has(i)) skryteRadar.delete(i); else skryteRadar.add(i);
      vykresliPrispevkyARadar();
    });
    $('citLegenda').addEventListener('click', e => {
      const b = e.target.closest('[data-alt]'); if (!b) return;
      const i = +b.dataset.alt;
      if (skryteCit.has(i)) skryteCit.delete(i); else skryteCit.add(i);
      vykresliCitGraf();
    });
    const vyberCit = e => {
      const tr = e.target.closest('tr[data-k]'); if (!tr) return;
      vybraneKrit = tr.dataset.k;
      document.querySelectorAll('#citTab tr[data-k]').forEach(r => r.classList.toggle('vybrany', r.dataset.k === vybraneKrit));
      vykresliCitGraf();
    };
    $('citTab').addEventListener('click', vyberCit);
    $('citTab').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); vyberCit(e); } });
    navazFce();

    // projekt
    const sab = $('sablona');
    SABLONY.forEach(s => { const o = document.createElement('option'); o.value = s.id; o.textContent = s.nazev; sab.appendChild(o); });
    sab.addEventListener('change', async () => {
      const id = sab.value; sab.value = '';
      if (!id) return;
      if (await Dialog.potvrd('Nahradit současný projekt šablonou? Neuložené změny se ztratí.')) nactiProjekt(zeSablony(id));
    });
    $('btnNovy').addEventListener('click', async () => {
      if (await Dialog.potvrd('Začít nový prázdný projekt? Neuložené změny se ztratí.')) { nactiProjekt(prazdnyProjekt()); posluchaci.forEach(fn => fn('novy', S)); }
    });
    $('btnUlozit').addEventListener('click', ulozProjekt);
    $('btnSdilet').addEventListener('click', () => { sdilej().catch(e => Dialog.chyba('Odkaz se nepodařilo vytvořit: ' + e.message)); });
    $('seznamUlozenych').addEventListener('click', async e => {
      const o = e.target.closest('[data-otevri]'), s = e.target.closest('[data-smaz]');
      const u = ulozene();
      if (o) {
        const z = u[o.dataset.otevri]; if (!z) return;
        if (!(await Dialog.potvrd(`Otevřít „${z.projekt.nazev}“? Neuložené změny současného projektu se ztratí.`))) return;
        try { nactiProjekt(J.overProjekt(z.projekt)); } catch (err) { Dialog.chyba('Projekt je poškozený: ' + err.message); }
      } else if (s) {
        if (!(await Dialog.potvrd(`Smazat uložený projekt „${s.dataset.smaz}“?`))) return;
        delete u[s.dataset.smaz]; lsPis(KLIC_PROJ, u); vykresliUlozene();
      }
    });
    const zavriMenu = () => { document.querySelectorAll('.menu-dalsi[open]').forEach(d => { d.open = false; }); };
    $('btnImport').addEventListener('click', () => { zavriMenu(); $('soubor').click(); });
    $('soubor').addEventListener('change', e => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      if (f.size > 2e6) { Dialog.chyba('Soubor je příliš velký.'); return; }
      const r = new FileReader();
      r.onload = async () => {
        try {
          const d = JSON.parse(r.result);
          const p = J.overProjekt(d.projekt || d);
          if (await Dialog.potvrd(`Načíst projekt „${p.nazev}“ (${p.kriteria.length} kritérií, ${p.alternativy.length} variant)?`)) nactiProjekt(p);
        } catch (err) { Dialog.chyba('Soubor nelze načíst: ' + err.message); }
      };
      r.onerror = () => Dialog.chyba('Soubor nelze přečíst.');
      r.readAsText(f);
    });
    $('btnExportJson').addEventListener('click', () => {
      zavriMenu();
      const vyst = { aplikace: 'rozhodovani', verze: 2, exportovano: new Date().toISOString(), projekt: P };
      if (S && S.ok) vyst.vysledek = { metoda: nazevMetody(), vahy: S.w, varianty: S.nazvyA, skore: S.vysl.skore, poradi: S.por, vysvetleni: posledniVysvetleni };
      stahni(JSON.stringify(vyst, null, 2), souborNazev() + '.json', 'application/json');
    });
    $('btnExportCsv').addEventListener('click', () => { zavriMenu(); exportCsv(); });
    $('btnZprava').addEventListener('click', () => { zavriMenu(); tiskovaZprava(); });
    document.addEventListener('click', e => { if (!e.target.closest('.menu-dalsi')) zavriMenu(); });

    let casResize = 0, posledniSirka = window.innerWidth;
    window.addEventListener('resize', () => {
      if (window.innerWidth === posledniSirka) return;
      posledniSirka = window.innerWidth;
      clearTimeout(casResize);
      casResize = setTimeout(() => { if (rezim === 'plne' && S && S.Xa) { vykresliPrispevkyARadar(); vykresliCitGraf(); vykresliFceGraf(); } }, 150);
    });
  }

  /* ================= START ================= */
  async function start() {
    initTooltip();
    initUdalosti();
    vykresliUlozene();
    let p = null;
    const ulozeny = lsCti(KLIC_AKT);
    if (ulozeny) { try { p = J.overProjekt(ulozeny); } catch (e) { p = null; } }
    let r = null;
    try { r = localStorage.getItem(KLIC_REZIM); } catch (e) { r = null; }
    rezim = r === 'plne' ? 'plne' : 'pruvodce';
    $('tabPruvodce').setAttribute('aria-selected', String(rezim === 'pruvodce'));
    $('tabPlne').setAttribute('aria-selected', String(rezim === 'plne'));
    $('pruvodce').hidden = rezim !== 'pruvodce';
    $('plne').hidden = rezim !== 'plne';
    nactiProjekt(p || zeSablony('produkt'));
    const m = location.hash.match(/^#p=([A-Za-z0-9_-]+)$/);
    if (m) {
      try {
        const sd = await dekodujOdkaz(m[1]);
        if (await Dialog.potvrd(`Otevřít sdílený projekt „${sd.nazev}“ (${sd.kriteria.length} kritérií, ${sd.alternativy.length} variant)? Rozpracovaný projekt bude nahrazen; uložené projekty zůstanou.`)) {
          nactiProjekt(sd);
          prepniRezim('plne');
        }
      } catch (e) { Dialog.chyba('Sdílený odkaz nelze otevřít: ' + e.message); }
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* nic */ }
    }
  }

  window.RozhodovaniUI = {
    projekt: () => P, stav: () => S, rezim: () => rezim, verze: () => verze,
    nacti: p => nactiProjekt(J.overProjekt(p)), sablona: id => nactiProjekt(zeSablony(id)), novy: () => nactiProjekt(prazdnyProjekt()),
    prepocti: () => zmena('struktura'), zmena, prepniRezim, vykresliVahy, naZmenu: fn => posluchaci.push(fn),
    vysvetleni: () => posledniVysvetleni, nazevMetody, TYPY, REZIMY, SABLONY,
    pridejKriterium, smazKriterium, zmenTyp, pridejAlternativu, smazAlternativu, nastavHodnotu, vstupText,
    spustSmaa, smaa: () => smaaVysl, kodujOdkaz, dekodujOdkaz, tezke
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
