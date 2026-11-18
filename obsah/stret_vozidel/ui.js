/* Rekonstrukce střetu vozidel – rozhraní (náčrt, diagram hybnosti, nejistota, citlivost, protokol).
   Výpočty jsou v stret_vozidel/jadro.js (window.STRET). Stav pro testy: window.STRET_APP. */
(function () {
  'use strict';
  const J = window.STRET;
  const $ = id => document.getElementById(id);
  const KLIC_AKT = 'webapp_stret_vozidel_aktualni';
  const KLIC_PROJ = 'webapp_stret_vozidel_projekty';
  const KLIC_NAST = 'webapp_stret_vozidel_nast';
  const jazyk = () => document.documentElement.lang || 'cs';
  const c = (x, d) => Number.isFinite(x) ? x.toLocaleString(jazyk(), { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }) : '–';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, z => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[z]));
  const kmh = J.kmh;
  const nz = i => (P.vozidla[i].nazev || (i ? 'B' : 'A'));

  function cti(k, vychozi) { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : vychozi; } catch (e) { return vychozi; } }
  function pis(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  let P = null;                       // aktuální projekt
  const V = { x: null, mc: null, cit: null, kontroly: [] };
  const nast = Object.assign({ pohled: 'nacrt', zalozka: 'vstupy' }, cti(KLIC_NAST, {}));
  let pevnyBox = null, taz = null, casUlozeni = 0;

  /* ================= vstupy ================= */
  const RADKY = [
    { sekce: 'Vozidlo' },
    { k: 'nazev', l: 'Označení', typ: 'text' },
    { k: 'hmotnost', l: 'Pohotovostní hmotnost (kg)', step: 10, min: 50 },
    { k: 'naklad', l: 'Posádka a náklad (kg)', step: 10, min: 0 },
    { k: 'hmotTol', l: '± hmotnost (kg)', tol: true, step: 10, min: 0 },
    { k: 'delka', l: 'Délka (m)', step: 0.1, min: 1 },
    { k: 'sirka', l: 'Šířka (m)', step: 0.05, min: 0.5 },
    { k: 'misto', l: 'Místo poškození', typ: 'select', moznosti: () => Object.entries(J.MISTA).map(([k, m]) => [k, m.nazev]) },
    { sekce: 'Před střetem' },
    { k: 'theta', l: 'Úhel příjezdu θ (°)', step: 1 },
    { k: 'thetaTol', l: '± θ (°)', tol: true, step: 0.5, min: 0 },
    { k: 'stopa', l: 'Brzdná stopa před střetem (m, 0 = žádná)', step: 0.1, min: 0 },
    { k: 'stopaTol', l: '± stopa (m)', tol: true, step: 0.1, min: 0, kdyz: v => v.stopa > 0 },
    { k: 'tn', l: 'Náběh brzd tₙ (s)', tol: true, step: 0.05, min: 0, kdyz: v => v.stopa > 0 },
    { k: 'limit', l: 'Nejvyšší dovolená rychlost (km/h, 0 = nezadáno)', step: 10, min: 0 },
    { k: 'znamaV', l: 'Známá rychlost před střetem', typ: 'chk' },
    { k: 'znamaOd', l: 'od (km/h)', tol: true, step: 1, min: 0, kdyz: v => v.znamaV },
    { k: 'znamaDo', l: 'do (km/h)', tol: true, step: 1, min: 0, kdyz: v => v.znamaV },
    { sekce: 'Dojezd po střetu' },
    { k: 'phi', l: 'Úhel dojezdu φ (°)', step: 1 },
    { k: 'phiTol', l: '± φ (°)', tol: true, step: 0.5, min: 0 },
    { k: 'd', l: 'Délka dojezdu d (m)', step: 0.1, min: 0 },
    { k: 'dTol', l: '± d (m)', tol: true, step: 0.1, min: 0 },
    { k: 'Kx', l: 'nebo konečná poloha x (m)', tol: true, typ: 'K' },
    { k: 'Ky', l: 'konečná poloha y (m)', tol: true, typ: 'K' },
    { k: 'kola', l: 'Stav kol při dojezdu', typ: 'select', moznosti: () => Object.entries(J.KOLA).map(([k, m]) => [k, m.nazev]) },
    { k: 'podilMin', l: 'podíl μ od', tol: true, step: 0.05, min: 0, kdyz: v => v.kola === 'castecne' },
    { k: 'podilMax', l: 'podíl μ do', tol: true, step: 0.05, min: 0, kdyz: v => v.kola === 'castecne' },
    { k: 'fMin', l: 'f od', tol: true, step: 0.01, min: 0, kdyz: v => v.kola === 'vlastni' },
    { k: 'fMax', l: 'f do', tol: true, step: 0.01, min: 0, kdyz: v => v.kola === 'vlastni' },
    { k: '_f', l: 'Rozsah f při dojezdu', typ: 'info' },
    { k: 'natoceni', l: 'Natočení v konečné poloze (°, jen náčrt)', step: 1, prazdne: true }
  ];

  function bunka(r, i) {
    const v = P.vozidla[i], a = `data-v="${i}" data-k="${r.k}" aria-label="${esc(r.l)}"`;
    if (r.typ === 'text') return `<input class="vstup" ${a} maxlength="30" value="${esc(v[r.k])}" data-i18n="ne">`;
    if (r.typ === 'select') return `<select class="vstup" ${a}>${r.moznosti().map(([k, t]) => `<option value="${k}"${v[r.k] === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
    if (r.typ === 'chk') return `<label class="chk"><input type="checkbox" ${a}${v[r.k] ? ' checked' : ''}> ano</label>`;
    if (r.typ === 'K') return `<input class="vstup" type="number" step="0.1" ${a} value="${hodnotaK(i, r.k)}">`;
    if (r.typ === 'info') { const f = J.rozsahF(P, v); return `<span data-info="f${i}">${c(f[0], 2)} – ${c(f[1], 2)}</span>`; }
    const hodnota = v[r.k] == null ? '' : v[r.k];
    return `<input class="vstup" type="number" step="${r.step || 'any'}"${r.min != null ? ` min="${r.min}"` : ''} ${a} value="${hodnota}"${r.prazdne ? ` placeholder="${Math.round(v.phi)}"` : ''}>`;
  }

  // konečná poloha v souřadnicích plánu (měření od pevného bodu) ↔ úhel a délka dojezdu
  const hodnotaK = (i, k) => { const K = J.konecnaPoloha(P, i); return Math.round((k === 'Kx' ? K.x : K.y) * 100) / 100; };

  function vykresliVstupy() {
    const povrchy = J.POVRCHY.map(q => `<option value="${q.id}"${P.povrch === q.id ? ' selected' : ''}>${esc(q.nazev)} (μ ${c(q.min, 2)}–${c(q.max, 2)})</option>`).join('')
      + `<option value="vlastni"${P.povrch === 'vlastni' ? ' selected' : ''}>vlastní (naměřené μ)</option>`;
    const radky = RADKY.map(r => {
      if (r.sekce) return `<tr class="sekce"><td colspan="3">${r.sekce}</td></tr>`;
      const vidim = [0, 1].map(i => !r.kdyz || r.kdyz(P.vozidla[i]));
      if (!vidim[0] && !vidim[1]) return '';
      return `<tr class="${r.tol ? 'tol' : ''}"><td class="lbl">${r.l}</td>${[0, 1].map(i => `<td>${vidim[i] ? bunka(r, i) : ''}</td>`).join('')}</tr>`;
    }).join('');
    $('panelVstupy').innerHTML = `
      ${uvodniKarta()}
      <div class="oddil"><h2>Případ</h2>
        <label class="pole">Název<input class="vstup" data-g="nazev" maxlength="80" value="${esc(P.nazev)}" data-i18n="ne"></label>
      </div>
      <div class="oddil"><h2>Vozovka</h2>
        <label class="pole">Povrch (μ pro dojezd i brzdnou stopu)<select class="vstup" data-g="povrch">${povrchy}</select></label>
        ${P.povrch === 'vlastni' ? `<div class="radek2"><label class="pole">μ min<input class="vstup" type="number" step="0.01" min="0" data-g="muMin" value="${P.muMin}"></label><label class="pole">μ max<input class="vstup" type="number" step="0.01" min="0" data-g="muMax" value="${P.muMax}"></label></div>` : ''}
        <div class="radek3">
          <label class="pole">Sklon (%)<input class="vstup" type="number" step="0.5" data-g="sklon" value="${P.sklon}"></label>
          <label class="pole">± sklon (%)<input class="vstup" type="number" step="0.5" min="0" data-g="sklonTol" value="${P.sklonTol}"></label>
          <label class="pole">Stoupá směrem (°)<input class="vstup" type="number" step="5" data-g="sklonSmer" value="${P.sklonSmer}"></label>
        </div>
        <div class="radek2">
          <label class="pole">Bod střetu x (m)<input class="vstup" type="number" step="0.1" data-g="Sx" value="${P.S.x}"></label>
          <label class="pole">Bod střetu y (m)<input class="vstup" type="number" step="0.1" data-g="Sy" value="${P.S.y}"></label>
        </div>
        <p class="tip">Úhly: 0° = doprava v náčrtu, 90° = nahoru, rostou proti směru hodinových ručiček. Rozsahy μ jsou stejné jako ve stránce Rychlost z brzdné stopy.</p>
      </div>
      <div class="oddil"><h2>Vozidla</h2>
        <table class="vst"><thead><tr><th></th><th class="hlavA">● A</th><th class="hlavB">● B</th></tr></thead><tbody>${radky}</tbody></table>
        <p class="tip">Řádky „±“ jsou meze nejistoty: skutečná hodnota může ležet kdekoli mezi nimi. Dojezd se měří od bodu střetu ke konečné poloze těžiště – buď úhlem a délkou, nebo souřadnicemi x, y v metrech od téhož počátku jako bod střetu.</p>
      </div>
      <div class="oddil"><h2>Nejistota (Monte Carlo)</h2>
        <div class="radek2">
          <label class="pole">Počet náhodných kombinací<input class="vstup" type="number" min="100" max="50000" step="500" data-g="mcN" value="${P.mc.n}"></label>
          <label class="pole">Semínko (opakovatelnost)<input class="vstup" type="number" step="1" data-g="mcSeed" value="${P.mc.seed}"></label>
        </div>
      </div>`;
  }

  function uvodniKarta(kratce) {
    if (P.ukazka) {
      const U = J.UKAZKY.find(u => u.klic === P.ukazka.klic);
      const zk = `<ul>${(P.ukazka.zkusit || []).map(t => `<li>${esc(t)}</li>`).join('')}</ul>`;
      if (kratce) return `<details class="ukazka-info${P.ukazka.mimo ? ' mimo' : ''}"><summary><b>🧪 Ukázka: ${esc(U ? U.nazev : P.nazev)}</b></summary>${esc(U ? U.popis : '')}${zk}</details>`;
      return `<div class="ukazka-info${P.ukazka.mimo ? ' mimo' : ''}"><b>🧪 Ukázka: ${esc(U ? U.nazev : P.nazev)}</b><br>${esc(U ? U.popis : '')}${zk}</div>`;
    }
    if (P.id && P.id.startsWith('p') && P.nazev === 'Nový střet') {
      return `<div class="ukazka-info"><b>Začněte ukázkou</b> se známou pravdou, nebo zadejte vlastní střet níže a upravte náčrt tažením.
        <div style="margin-top:6px"><button class="btn mini" data-prikaz="galerie">🧪 Galerie ukázek</button></div></div>`;
    }
    return '';
  }

  function cislo(el) { const x = parseFloat(el.value); return Number.isFinite(x) ? x : null; }

  function zmenaVstupu(e) {
    const el = e.target;
    if (el.dataset.g) {
      const g = el.dataset.g, x = cislo(el);
      if (g === 'nazev') P.nazev = el.value;
      else if (g === 'povrch') { P.povrch = el.value; if (e.type === 'change') { vykresliVstupy(); } }
      else if (x == null) return;
      else if (g === 'Sx') P.S.x = x; else if (g === 'Sy') P.S.y = x;
      else if (g === 'mcN') { if (x < 100 || x > 50000) return; P.mc.n = Math.round(x); }
      else if (g === 'mcSeed') P.mc.seed = Math.round(x);
      else P[g] = x;
      return prepocti();
    }
    if (el.dataset.v == null) return;
    const i = +el.dataset.v, k = el.dataset.k, v = P.vozidla[i];
    if (el.type === 'checkbox') { v[k] = el.checked; if (k === 'znamaV' && el.checked && !v.znamaDo) { const x = V.x && V.x.ok ? Math.round(kmh(V.x.v[i])) : 30; v.znamaOd = Math.max(0, x - 5); v.znamaDo = x + 5; } vykresliVstupy(); return prepocti(); }
    if (el.tagName === 'SELECT') { v[k] = el.value; vykresliVstupy(); return prepocti(); }
    if (k === 'nazev') { v.nazev = el.value; return prepocti(); }
    if (k === 'natoceni' && el.value === '') { v.natoceni = null; return prepocti(); }
    const x = cislo(el);
    if (x == null) return;
    if (k === 'Kx' || k === 'Ky') {
      const K = J.konecnaPoloha(P, i), dx = (k === 'Kx' ? x : K.x) - P.S.x, dy = (k === 'Ky' ? x : K.y) - P.S.y;
      v.d = Math.round(Math.hypot(dx, dy) * 100) / 100; v.phi = Math.round(J.uhelVektoru(dx, dy) * 100) / 100;
      return prepocti();
    }
    if (el.min !== '' && x < +el.min) return;
    v[k] = x;
    if (k === 'stopa' && e.type === 'change') vykresliVstupy();
    prepocti();
  }

  // po tažení v náčrtu přepsat hodnoty v polích (bez překreslení – zůstane fokus)
  function obnovPole() {
    const p = $('panelVstupy');
    const nastav = (sel, x) => { const el = p.querySelector(sel); if (el && document.activeElement !== el) el.value = x; };
    nastav('[data-g=Sx]', P.S.x); nastav('[data-g=Sy]', P.S.y);
    [0, 1].forEach(i => ['theta', 'phi', 'd'].forEach(k => nastav(`[data-v="${i}"][data-k="${k}"]`, P.vozidla[i][k])));
    [0, 1].forEach(i => ['Kx', 'Ky'].forEach(k => nastav(`[data-v="${i}"][data-k="${k}"]`, hodnotaK(i, k))));
    [0, 1].forEach(i => { const el = p.querySelector(`[data-info=f${i}]`); if (el) { const f = J.rozsahF(P, P.vozidla[i]); el.textContent = `${c(f[0], 2)} – ${c(f[1], 2)}`; } });
  }

  /* ================= přepočet ================= */
  function prepocti(rychle) {
    J.nastavJazyk(jazyk());
    V.x = J.vyhodnot(P);
    V.mc = J.monteCarlo(P, rychle ? { n: Math.min(600, P.mc.n) } : {});
    V.cit = null;
    V.kontroly = J.kontroly(P, V.x, V.mc);
    if (!rychle) obnovPole();
    vykresliPohled();
    vykresliSouhrn();
    if (nast.zalozka === 'vysledky') vykresliVysledky();
    naplanujUlozeni();
  }
  function naplanujUlozeni() {
    clearTimeout(casUlozeni);
    casUlozeni = setTimeout(() => { if (taz) return naplanujUlozeni(); pis(KLIC_AKT, P); zaznamenej(); }, 400);
  }

  /* ================= Zpět / Znovu ================= */
  // snímky projektu (JSON); změna se zapíše až po 400 ms klidu, takže tažení nebo psaní čísla = jeden krok
  const H = { zpet: [], znovu: [], posledni: null };
  function zaznamenej() {
    const s = JSON.stringify(P);
    if (H.posledni != null && s !== H.posledni) {
      H.zpet.push(H.posledni); if (H.zpet.length > 100) H.zpet.shift();
      H.znovu.length = 0;
    }
    H.posledni = s;
    obnovTlacitkaHistorie();
  }
  function obnovTlacitkaHistorie() {
    $('tlZpet').disabled = !H.zpet.length; $('tlZnovu').disabled = !H.znovu.length;
  }
  function krokHistorie(odkud, kam) {
    clearTimeout(casUlozeni); zaznamenej();
    if (!odkud.length) return;
    kam.push(H.posledni);
    P = J.migruj(JSON.parse(odkud.pop()));
    H.posledni = JSON.stringify(P);
    V.cit = null; pis(KLIC_AKT, P);
    vykresliVstupy(); prepocti();
    obnovTlacitkaHistorie();
  }
  const zpet = () => krokHistorie(H.zpet, H.znovu), znovu = () => krokHistorie(H.znovu, H.zpet);
  const citlivost = () => V.cit || (V.cit = J.citlivost(P));

  /* ================= souhrn pod náčrtem ================= */
  function interval(q, d) { return q ? `${c(q.od, d)}–${c(q.do, d)}` : '–'; }
  function vykresliSouhrn() {
    const x = V.x, q = V.mc && V.mc.q;
    const pocet = V.kontroly.filter(k => k.uroven !== 'ok').length, chyb = V.kontroly.filter(k => k.uroven === 'chyba').length;
    let h = '';
    if (x && x.ok) {
      h = [0, 1].map(i => `<span><span class="${i ? 'hlavB' : 'hlavA'}">●</span> ${esc(nz(i))}: <b>${c(kmh(x.v[i]))} km/h</b> <small>(${interval(q[i ? 'vB' : 'vA'])})</small></span>`).join('')
        + `<span>ΔE ${c(x.ztrata / 1000)} kJ</span>`;
    } else h = `<span class="ne-txt">✗ ${esc(x ? x.text : '')}</span>`;
    h += `<span class="${chyb ? 'ne-txt' : ''}">${pocet ? `⚠ ${pocet} upozornění` : '✓ kontroly v pořádku'}</span>`;
    if (P.ukazka) h += `<span class="ukazka-stitek">pravda: A ${c(P.ukazka.pravda.v[0])}, B ${c(P.ukazka.pravda.v[1])} km/h</span>`;
    $('souhrn').innerHTML = h;
  }

  /* ================= výsledky ================= */
  function vykresliVysledky() {
    const x = V.x, mc = V.mc, q = mc.q;
    let h = uvodniKarta(true);
    if (x.ok) {
      const radek = (nazev, hodn, klice, d, jedn) => `<tr><td>${nazev}</td>${[0, 1].map(i => {
        const val = hodn[i];
        if (val == null || !Number.isFinite(val)) return '<td class="c">–</td>';
        return `<td class="c"><span class="velke">${c(val, d)}</span> ${jedn || ''}<small>${interval(q[klice[i]], d)}</small></td>`;
      }).join('')}</tr>`;
      const pr = P.ukazka && P.ukazka.pravda;
      h += `<div class="oddil"><h2>Rychlosti (km/h) – odhad a 95% interval</h2>
        <table class="vys"><thead><tr><th></th><th class="hlavA">● ${esc(nz(0))}</th><th class="hlavB">● ${esc(nz(1))}</th></tr></thead><tbody>
        ${radek('Před střetem', x.v.map(kmh), ['vA', 'vB'])}
        ${x.v0.some(v => v != null) ? radek('Na začátku brzdné stopy', x.v0.map(v => v == null ? null : kmh(v)), ['v0A', 'v0B']) : ''}
        ${radek('Bezprostředně po střetu', x.u.map(kmh), ['uA', 'uB'])}
        ${radek('Změna rychlosti Δv', x.dv.map(kmh), ['dvA', 'dvB'])}
        <tr><td>Směr síly (PDOF)</td>${[0, 1].map(i => `<td class="c"><span class="velke">${x.hodiny[i]} h</span><small>${c(x.hodinyUhel[i])}° od přídě, v plánu ${c(x.pdof[i])}°</small></td>`).join('')}</tr>
        <tr><td>Zpomalení při dojezdu</td>${[0, 1].map(i => `<td class="c">${c(x.aDojezd[i], 2)} m/s²</td>`).join('')}</tr>
        </tbody></table>
        <p class="tip">Odhad = výpočet ze středů všech rozsahů. Interval = 2,5–97,5 % z ${c(mc.platnych)} platných náhodných kombinací vstupů (z ${c(mc.n)}, semínko ${P.mc.seed}).</p>
      </div>`;
      if (pr) {
        const sr = (i, k, pravda) => { const qq = q[k]; const ok = qq && pravda >= qq.od && pravda <= qq.do;
          return `<tr><td>${esc(nz(i))}</td><td class="c"><b>${c(pravda, 1)}</b></td><td class="c">${c(kmh(x.v[i]), 1)}</td><td class="c">${interval(qq, 1)}</td><td class="c ${ok ? 'ok-txt' : 'ne-txt'}" title="${ok ? 'pravda v intervalu' : 'pravda mimo interval'}">${ok ? '✓' : '✗'}</td></tr>`; };
        const v0 = pr.v0.map((v, i) => v == null ? '' : `${i ? 'B' : 'A'} ${c(v, 1)} km/h`).filter(Boolean).join(', ');
        h += `<div class="ukazka-info${P.ukazka.mimo ? ' mimo' : ''}" id="pravdaInfo"><b>Porovnání se známou pravdou (rychlost před střetem, km/h)</b>
          <table class="vys" style="table-layout:auto"><thead><tr><th></th><th>pravda</th><th>odhad</th><th>interval</th><th></th></tr></thead><tbody>${sr(0, 'vA', pr.v[0])}${sr(1, 'vB', pr.v[1])}</tbody></table>
          <small>Skutečné f: A ${c(pr.f[0], 2)}, B ${c(pr.f[1], 2)}.</small> <small>Skutečný dojezd: A ${c(pr.d[0], 1)} m, B ${c(pr.d[1], 1)} m.</small>
          ${v0 ? `<small>Skutečná rychlost na začátku brzdné stopy: ${v0}.</small>` : ''}</div>`;
      }
      h += htmlLimit();
      h += `<div class="oddil"><h2>Energie a ráz</h2><table class="vys"><tbody>
        <tr><td>Kinetická energie před střetem</td><td class="c">${c(x.Epred / 1000)} kJ</td></tr>
        <tr><td>Kinetická energie po střetu</td><td class="c">${c(x.Epo / 1000)} kJ</td></tr>
        <tr><td>Ztráta při střetu (deformace, teplo, rotace)</td><td class="c"><span class="velke">${c(x.ztrata / 1000)} kJ</span><small>${interval(q.ztrata)}</small></td></tr>
        <tr><td>Restituce podél síly e</td><td class="c">${c(x.restituce, 2)}<small>${interval(q.restituce, 2)}</small></td></tr>
        <tr><td>Odklon síly od relativní rychlosti</td><td class="c">${c(x.uhelSily)}°</td></tr>
        </tbody></table>
        <p class="tip">Ztráta kinetické energie není deformační energie: tu by bylo nutné odhadnout z deformací (EES, tuhosti z crash testů) – to nástroj nedělá. Kladná ztráta je jen nutná podmínka fyzikální možnosti.</p></div>`;
    } else {
      h += `<div class="varovani"><b>Výpočet nemá řešení.</b> ${esc(x.text)}</div>`;
    }
    h += `<div class="oddil"><h2>Kontroly plausibility</h2><ul class="kontroly">${V.kontroly.map(k => `<li class="${k.uroven}">${esc(k.text)}</li>`).join('')}</ul></div>
      <div class="varovani"><b>Orientační výpočet.</b> Model nepočítá deformační energii, rotaci vozidel ani sekundární nárazy. Znalecký posudek z dopravní nehody je jiná úroveň práce. <a href="#" data-metoda>📐 Metoda a meze</a></div>`;
    $('panelVysledky').innerHTML = h;
  }

  // věty o překročení dovolené rychlosti (výsledky i protokol)
  function vetyLimit() {
    const x = V.x, L = V.mc.limit || [];
    return [0, 1].filter(i => L[i]).map(i => {
      const pozn = x.v0[i] != null ? 'rychlost na začátku brzdné stopy' : 'rychlost před střetem';
      const odhad = kmh(x.v0[i] != null && Number.isFinite(x.v0[i]) ? x.v0[i] : x.v[i]);
      const pct = Math.round(L[i].podil * 100);
      const uroven = L[i].podil >= 0.975 ? 'chyba' : L[i].podil > 0.025 ? 'pozor' : 'ok';
      const zaver = uroven === 'chyba' ? 'překročena ve všech věrohodných kombinacích vstupů' : uroven === 'ok' ? 'nepřekročena v žádné věrohodné kombinaci vstupů' : 'z měření nelze rozhodnout';
      return { uroven, text: `${nz(i)}: limit ${c(L[i].limit)} km/h – ${zaver} (${pozn} odhadem ${c(odhad)} km/h, nad limitem ${pct} % z ${c(L[i].n)} kombinací).` };
    });
  }
  function htmlLimit() {
    const vety = vetyLimit();
    if (!vety.length) return '';
    return `<div class="oddil"><h2>Nejvyšší dovolená rychlost</h2><ul class="kontroly">${vety.map(k => `<li class="${k.uroven}">${esc(k.text)}</li>`).join('')}</ul>
      <p class="tip">Podíl kombinací vstupů nad limitem, rovnoměrně v zadaných mezích – není to pravděpodobnost v právním smyslu. Rozhodující je, zda limit leží mimo 95% interval: celý interval nad limitem = překročení prokázané výpočtem, interval přes limit = nerozhodnuto.</p></div>`;
  }

  /* ================= SVG pomocníci ================= */
  const Y = y => -y;
  const f3 = x => Math.round(x * 1000) / 1000;
  function sipka(x1, y1, x2, y2, tr, k, styl) {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
    if (L < 1e-9) return '';
    const ux = dx / L, uy = dy / L, h = Math.min(L * 0.45, 11 * k), w = h * 0.45;
    const bx = x2 - ux * h, by = y2 - uy * h;
    const pts = [[x2, y2], [bx - uy * w, by + ux * w], [bx + uy * w, by - ux * w]].map(([a, b]) => `${f3(a)},${f3(Y(b))}`).join(' ');
    return `<line class="${tr}" x1="${f3(x1)}" y1="${f3(Y(y1))}" x2="${f3(bx)}" y2="${f3(Y(by))}"${styl ? ` style="${styl}"` : ''}/><polygon class="${tr.replace(/c([AB])/, 'f$1')}" points="${pts}" style="stroke:none"/>`;
  }
  const text = (x, y, t, k, cls, kotva, vel) => `<text class="txt-svg ${cls || ''}" x="${f3(x)}" y="${f3(Y(y))}" font-size="${f3((vel || 12) * k)}" style="stroke-width:${f3(3 * k)}" text-anchor="${kotva || 'middle'}" dominant-baseline="middle">${esc(t)}</text>`;
  function obdelnik(cx, cy, uhel, L, W) {
    const [ex, ey] = J.jed(uhel), nx = -ey, ny = ex;
    return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => [cx + ex * L / 2 * a + nx * W / 2 * b, cy + ey * L / 2 * a + ny * W / 2 * b]);
  }
  const body = pts => pts.map(([a, b]) => `${f3(a)},${f3(Y(b))}`).join(' ');
  function mrizka(x0, y0, w, h, k) {
    const span = Math.max(w, h);
    const krok = [0.5, 1, 2, 5, 10, 20, 50, 100].find(s => span / s <= 40) || 200, hl = krok * 5;
    let s = '';
    for (let x = Math.ceil(x0 / krok) * krok; x <= x0 + w; x += krok) s += `<line class="g-mrizka${Math.abs(x / hl - Math.round(x / hl)) < 1e-6 ? ' hl' : ''}" x1="${f3(x)}" y1="${f3(y0)}" x2="${f3(x)}" y2="${f3(y0 + h)}"/>`;
    for (let y = Math.ceil(y0 / krok) * krok; y <= y0 + h; y += krok) s += `<line class="g-mrizka${Math.abs(y / hl - Math.round(y / hl)) < 1e-6 ? ' hl' : ''}" x1="${f3(x0)}" y1="${f3(y)}" x2="${f3(x0 + w)}" y2="${f3(y)}"/>`;
    return s;
  }
  function meritko(x0, y0, w, h, k, jedn) {
    const cil = 90 * k, kroky = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
    const L = kroky.reduce((b, s) => Math.abs(s - cil) < Math.abs(b - cil) ? s : b, 1);
    const x = x0 + 14 * k, y = y0 + h - 16 * k;   // SVG souřadnice
    return `<line class="ram-osa" x1="${f3(x)}" y1="${f3(y)}" x2="${f3(x + L)}" y2="${f3(y)}" style="stroke-width:3"/>`
      + `<text class="txt-svg mdl" x="${f3(x + L / 2)}" y="${f3(y - 9 * k)}" font-size="${f3(11 * k)}" style="stroke-width:${f3(3 * k)}" text-anchor="middle">${c(L, L < 1 ? 1 : 0)} ${jedn}</text>`;
  }
  // box [minX, minY, maxX, maxY] ve světových souřadnicích → viewBox se stejným měřítkem v x a y
  // rezerva = px nahoře pro legendu (neleží přes kresbu)
  function ramec(box, sirka, vyska, okraj, rezerva) {
    const rz = Math.min(rezerva || 0, vyska * 0.3);
    if (rz) { const R = ramec(box, sirka, vyska - rz, okraj); return { x0: R.x0, y0: R.y0 - rz * R.k, w: R.w, h: R.h + rz * R.k, k: R.k }; }
    let [ax, ay, bx, by] = box;
    const span = Math.max(bx - ax, by - ay, 4), m = span * (okraj || 0.08) + 1;
    ax -= m; ay -= m; bx += m; by += m;
    let w = bx - ax, h = by - ay;
    const pomer = sirka / Math.max(1, vyska);
    if (w / h < pomer) { const nw = h * pomer; ax -= (nw - w) / 2; w = nw; } else { const nh = w / pomer; ay -= (nh - h) / 2; h = nh; }
    return { x0: ax, y0: -(ay + h), w, h, k: w / Math.max(1, sirka) };   // y0 v SVG souřadnicích (y dolů)
  }

  const rezervaLegendy = sirka => sirka < 520 ? 30 : 100;

  /* ================= náčrt v plánu ================= */
  function geometrie() {
    const S = P.S, x = V.x;
    const g = { S, voz: [] };
    P.vozidla.forEach((v, i) => {
      const [ex, ey] = J.jed(v.theta), nx = -ey, ny = ex;
      let cx = S.x, cy = S.y;
      if (v.misto === 'predek') { cx -= ex * v.delka / 2; cy -= ey * v.delka / 2; }
      else if (v.misto === 'zadek') { cx += ex * v.delka / 2; cy += ey * v.delka / 2; }
      else if (v.misto === 'levy') { cx -= nx * v.sirka / 2; cy -= ny * v.sirka / 2; }
      else { cx += nx * v.sirka / 2; cy += ny * v.sirka / 2; }
      const Rh = Math.max(7, v.delka * 1.4 + (v.stopa || 0) + 2);
      const K = J.konecnaPoloha(P, i);
      g.voz.push({
        v, e: [ex, ey], c: [cx, cy], duch: obdelnik(cx, cy, v.theta, v.delka, v.sirka),
        H: [S.x - ex * Rh, S.y - ey * Rh], K: [K.x, K.y],
        konec: obdelnik(K.x, K.y, v.natoceni == null ? v.phi : v.natoceni, v.delka, v.sirka),
        p: x && x.ok ? [x.v[i] * J.hmotnost(v) * ex, x.v[i] * J.hmotnost(v) * ey] : null,
        p2: x && x.ok ? (() => { const [a, b] = J.jed(v.phi); return [x.u[i] * J.hmotnost(v) * a, x.u[i] * J.hmotnost(v) * b]; })() : null
      });
    });
    return g;
  }

  function svgNacrt(sirka, vyska, proTisk) {
    const g = geometrie();
    const pts = [[g.S.x, g.S.y]];
    g.voz.forEach(o => { pts.push(o.H, o.K, ...o.duch, ...o.konec); });
    (P.prekazky || []).forEach(o => pts.push([o.x, o.y]));
    const box = pts.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
    const span = Math.max(box[2] - box[0], box[3] - box[1], 4);
    // vektory hybnosti: nejdelší = 30 % rozsahu náčrtu
    const pmax = Math.max(1, ...g.voz.flatMap(o => o.p ? [Math.hypot(...o.p), Math.hypot(...o.p2)] : [0]));
    const sk = 0.3 * span / pmax;
    g.voz.forEach(o => { if (o.p) { pts.push([g.S.x + o.p[0] * sk, g.S.y + o.p[1] * sk], [g.S.x + o.p2[0] * sk, g.S.y + o.p2[1] * sk]); } });
    const box2 = pts.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
    const R = (!proTisk && pevnyBox) || ramec(box2, sirka, vyska, 0.08, proTisk ? 0 : rezervaLegendy(sirka));
    if (!proTisk) pevnyBox = taz ? R : null;
    const k = R.k;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f3(R.x0)} ${f3(R.y0)} ${f3(R.w)} ${f3(R.h)}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Náčrt střetu v plánu">`;
    s += `<rect x="${f3(R.x0)}" y="${f3(R.y0)}" width="${f3(R.w)}" height="${f3(R.h)}" style="fill:var(--bg-deep,var(--bg))"/>`;
    s += mrizka(R.x0, R.y0, R.w, R.h, k);
    // osy úhlů v rohu
    const ox = R.x0 + R.w - 46 * k, oy = -(R.y0 + 46 * k);
    s += sipka(ox, oy, ox + 30 * k, oy, 'ram-osa', k) + sipka(ox, oy, ox, oy + 30 * k, 'ram-osa', k)
      + text(ox + 30 * k, oy - 9 * k, '0°', k, 'mdl', 'middle', 10) + text(ox - 12 * k, oy + 30 * k, '90°', k, 'mdl', 'end', 10);
    g.voz.forEach((o, i) => {
      const cl = i ? 'cB' : 'cA', v = o.v;
      // brzdná stopa před střetem: dvě stopy kol za vozidlem v okamžiku střetu
      if (v.stopa > 0) {
        const [ex, ey] = o.e, nx = -ey, ny = ex, zad = [o.c[0] - ex * v.delka * 0.3, o.c[1] - ey * v.delka * 0.3];
        [-1, 1].forEach(b => {
          const a = [zad[0] + nx * v.sirka * 0.38 * b, zad[1] + ny * v.sirka * 0.38 * b];
          s += `<line class="stopa" x1="${f3(a[0] - ex * v.stopa)}" y1="${f3(Y(a[1] - ey * v.stopa))}" x2="${f3(a[0])}" y2="${f3(Y(a[1]))}"/>`;
        });
        s += text(zad[0] - ex * v.stopa / 2 + nx * (v.sirka * 0.4 + 12 * k), zad[1] - ey * v.stopa / 2 + ny * (v.sirka * 0.4 + 12 * k), `s ${c(v.stopa, 1)} m`, k, 'mdl', 'middle', 10);
      }
      // příjezd
      s += sipka(o.H[0], o.H[1], o.c[0] - o.e[0] * v.delka * 0.5, o.c[1] - o.e[1] * v.delka * 0.5, `${cl} cara tenka`, k);
      s += `<polygon class="${cl} voz duch ${i ? 'fB' : 'fA'}" points="${body(o.duch)}"/>`;
      // dojezd a konečná poloha
      s += sipka(g.S.x, g.S.y, o.K[0], o.K[1], `${cl} cara cark`, k);
      s += `<polygon class="${cl} voz konec ${i ? 'fB' : 'fA'}" points="${body(o.konec)}" ${proTisk ? '' : `data-uchop="K${i}"`} style="cursor:grab"/>`;
      // šipka přídě v konečné poloze
      const nat = v.natoceni == null ? v.phi : v.natoceni, [fx, fy] = J.jed(nat);
      s += sipka(o.K[0] - fx * v.delka * 0.2, o.K[1] - fy * v.delka * 0.2, o.K[0] + fx * v.delka * 0.42, o.K[1] + fy * v.delka * 0.42, `${cl} cara`, k);
      const stred = [(g.S.x + o.K[0]) / 2, (g.S.y + o.K[1]) / 2], [dx, dy] = J.jed(v.phi);
      s += text(stred[0] - dy * 12 * k, stred[1] + dx * 12 * k, `d ${c(v.d, 1)} m · ${c(v.phi)}°`, k, i ? 'tB' : 'tA', 'middle', 10.5);
      s += text(o.K[0], o.K[1] - Math.max(v.sirka, v.delka) / 2 - 10 * k, nz(i), k, i ? 'tB' : 'tA', 'middle', 11);
      s += text(o.H[0], o.H[1] + 14 * k, `${nz(i)} θ ${c(v.theta)}°`, k, i ? 'tB' : 'tA', 'middle', 11);
    });
    // překážky (jen kresba – např. sloup v ukázce MIMO MODEL; model je nevidí)
    (P.prekazky || []).forEach(o => {
      s += `<circle cx="${f3(o.x)}" cy="${f3(Y(o.y))}" r="${f3(o.r || 0.2)}" style="fill:var(--text);stroke:var(--danger);stroke-width:2;vector-effect:non-scaling-stroke"/>`;
      if (o.popis) s += text(o.x + (o.r || 0.2) + 6 * k, o.y, o.popis, k, '', 'start', 11);
    });
    // vektory hybnosti v bodě střetu (plné = před, čárkované = po)
    g.voz.forEach((o, i) => {
      if (!o.p) return;
      const cl = i ? 'cB' : 'cA';
      s += sipka(g.S.x, g.S.y, g.S.x + o.p[0] * sk, g.S.y + o.p[1] * sk, `${cl} cara`, k, 'stroke-width:4;opacity:.55');
      s += sipka(g.S.x, g.S.y, g.S.x + o.p2[0] * sk, g.S.y + o.p2[1] * sk, `${cl} cara cark`, k, 'stroke-width:4;opacity:.55');
      s += text(g.S.x + o.p[0] * sk * 1.07, g.S.y + o.p[1] * sk * 1.07, `p${i ? 'B' : 'A'}`, k, i ? 'tB' : 'tA', 'middle', 11);
    });
    // úchopy
    if (!proTisk) {
      g.voz.forEach((o, i) => {
        s += `<circle class="uchop ${i ? 'fB' : 'fA'}" data-uchop="H${i}" cx="${f3(o.H[0])}" cy="${f3(Y(o.H[1]))}" r="${f3(8 * k)}" style="fill-opacity:.35"></circle>`;
        s += `<circle class="uchop ${i ? 'fB' : 'fA'}" data-uchop="K${i}" cx="${f3(o.K[0])}" cy="${f3(Y(o.K[1]))}" r="${f3(7 * k)}"></circle>`;
      });
    }
    s += `<circle class="bod-stretu${proTisk ? '' : ' uchop'}" ${proTisk ? '' : 'data-uchop="S"'} cx="${f3(g.S.x)}" cy="${f3(Y(g.S.y))}" r="${f3(8 * k)}"></circle>`;
    s += text(g.S.x + 14 * k, g.S.y - 12 * k, 'S', k, '', 'start', 12);
    s += meritko(R.x0, R.y0, R.w, R.h, k, 'm');
    s += '</svg>';
    return { svg: s, R };
  }

  /* ================= diagram hybnosti ================= */
  function svgHybnost(sirka, vyska) {
    const x = V.x;
    if (!x.ok) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sirka} ${vyska}"><text class="txt-svg" x="${sirka / 2}" y="${vyska / 2}" text-anchor="middle">${esc(x.text)}</text></svg>`;
    const m = P.vozidla.map(J.hmotnost);
    const t = 1 / 1000;  // kg·m/s → t·m/s
    const pa = J.jed(P.vozidla[0].theta).map(z => z * m[0] * x.v[0] * t), pb = J.jed(P.vozidla[1].theta).map(z => z * m[1] * x.v[1] * t);
    const qa = J.jed(P.vozidla[0].phi).map(z => z * m[0] * x.u[0] * t), qb = J.jed(P.vozidla[1].phi).map(z => z * m[1] * x.u[1] * t);
    const Pt = [pa[0] + pb[0], pa[1] + pb[1]];
    const pts = [[0, 0], pa, Pt, qa, [qa[0] + qb[0], qa[1] + qb[1]]];
    const box = pts.reduce((b, [a, c2]) => [Math.min(b[0], a), Math.min(b[1], c2), Math.max(b[2], a), Math.max(b[3], c2)], [Infinity, Infinity, -Infinity, -Infinity]);
    const R = ramec(box, sirka, vyska, 0.1, rezervaLegendy(sirka)), k = R.k;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f3(R.x0)} ${f3(R.y0)} ${f3(R.w)} ${f3(R.h)}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Vektorový diagram hybnosti">`;
    s += `<rect x="${f3(R.x0)}" y="${f3(R.y0)}" width="${f3(R.w)}" height="${f3(R.h)}" style="fill:var(--bg-deep,var(--bg))"/>` + mrizka(R.x0, R.y0, R.w, R.h, k);
    // konstrukční přímky: směr příjezdu A z počátku, směr příjezdu B do koncového bodu P
    const L = Math.max(R.w, R.h) * 2, [ax, ay] = J.jed(P.vozidla[0].theta), [bx, by] = J.jed(P.vozidla[1].theta);
    s += `<line class="cA cara tenka" x1="${f3(-ax * L)}" y1="${f3(Y(-ay * L))}" x2="${f3(ax * L)}" y2="${f3(Y(ay * L))}"/>`;
    s += `<line class="cB cara tenka" x1="${f3(Pt[0] - bx * L)}" y1="${f3(Y(Pt[1] - by * L))}" x2="${f3(Pt[0] + bx * L)}" y2="${f3(Y(Pt[1] + by * L))}"/>`;
    s += sipka(0, 0, Pt[0], Pt[1], 'ram-osa', k, 'stroke-width:2.5');
    s += sipka(0, 0, pa[0], pa[1], 'cA cara', k, 'stroke-width:3') + sipka(pa[0], pa[1], Pt[0], Pt[1], 'cB cara', k, 'stroke-width:3');
    s += sipka(0, 0, qa[0], qa[1], 'cA cara cark', k, 'stroke-width:3') + sipka(qa[0], qa[1], qa[0] + qb[0], qa[1] + qb[1], 'cB cara cark', k, 'stroke-width:3');
    const pop = (a, b, t2, cls) => text((a[0] + b[0]) / 2 + 10 * k, (a[1] + b[1]) / 2 + 10 * k, t2, k, cls, 'start', 11.5);
    s += pop([0, 0], pa, `m·v ${nz(0)}`, 'tA') + pop(pa, Pt, `m·v ${nz(1)}`, 'tB') + pop([0, 0], qa, `m·u ${nz(0)}`, 'tA') + pop(qa, Pt, `m·u ${nz(1)}`, 'tB');
    s += `<circle cx="0" cy="0" r="${f3(4 * k)}" style="fill:var(--text)"/>` + text(-10 * k, 10 * k, 'O', k, '', 'end', 12);
    s += text(Pt[0] + 12 * k, Pt[1] + 12 * k, `Σp = ${c(Math.hypot(...Pt), 1)} t·m/s`, k, '', 'start', 12);
    s += meritko(R.x0, R.y0, R.w, R.h, k, 't·m/s');
    return s + '</svg>';
  }

  /* ================= mrak Monte Carlo ================= */
  function svgMrak(sirka, vyska) {
    const mc = V.mc, z = mc.vzorky;
    if (!z.length) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sirka} ${vyska}"><text class="txt-svg" x="${sirka / 2}" y="${vyska / 2}" text-anchor="middle">Žádná platná kombinace vstupů.</text></svg>`;
    const pr = P.ukazka && P.ukazka.pravda;
    let xs = z.map(a => a[0]), ys = z.map(a => a[1]);
    if (pr) { xs = xs.concat(pr.v[0]); ys = ys.concat(pr.v[1]); }
    const rozsah = arr => { let a = Math.min(...arr), b = Math.max(...arr); const m = (b - a) * 0.08 + 1; return [Math.max(0, a - m), b + m]; };
    const [x0, x1] = rozsah(xs), [y0, y1] = rozsah(ys);
    const L = 54, T = 16, Rr = 14, B = 44, w = sirka - L - Rr, h = vyska - T - B;
    const sx = v => L + (v - x0) / (x1 - x0) * w, sy = v => T + h - (v - y0) / (y1 - y0) * h;
    const kroky = (a, b) => { const st = [1, 2, 5, 10, 20, 50].find(q => (b - a) / q <= 8) || 100; const out = []; for (let v = Math.ceil(a / st) * st; v <= b; v += st) out.push(v); return out; };
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sirka} ${vyska}" role="img" aria-label="Mrak Monte Carlo rychlostí">`;
    s += `<rect x="0" y="0" width="${sirka}" height="${vyska}" style="fill:var(--bg-deep,var(--bg))"/>`;
    kroky(x0, x1).forEach(v => { s += `<line class="g-mrizka" x1="${sx(v)}" y1="${T}" x2="${sx(v)}" y2="${T + h}"/><text class="txt-svg mdl" style="stroke-width:3" x="${sx(v)}" y="${T + h + 14}" font-size="11" text-anchor="middle">${c(v)}</text>`; });
    kroky(y0, y1).forEach(v => { s += `<line class="g-mrizka" x1="${L}" y1="${sy(v)}" x2="${L + w}" y2="${sy(v)}"/><text class="txt-svg mdl" style="stroke-width:3" x="${L - 6}" y="${sy(v)}" font-size="11" text-anchor="end" dominant-baseline="middle">${c(v)}</text>`; });
    s += `<text class="txt-svg tA" style="stroke-width:3" x="${L + w / 2}" y="${vyska - 8}" font-size="12" text-anchor="middle">rychlost ${esc(nz(0))} před střetem (km/h)</text>`;
    s += `<text class="txt-svg tB" style="stroke-width:3" transform="translate(13 ${T + h / 2}) rotate(-90)" font-size="12" text-anchor="middle">rychlost ${esc(nz(1))} (km/h)</text>`;
    s += z.map(([a, b]) => `<circle class="mrak" cx="${f3(sx(a))}" cy="${f3(sy(b))}" r="1.8"/>`).join('');
    const qa = mc.q.vA, qb = mc.q.vB;
    s += `<rect class="ram" x="${sx(qa.od)}" y="${sy(qb.do)}" width="${sx(qa.do) - sx(qa.od)}" height="${sy(qb.od) - sy(qb.do)}"><title>95% intervaly</title></rect>`;
    if (V.x.ok) { const a = sx(kmh(V.x.v[0])), b = sy(kmh(V.x.v[1])); s += `<path d="M${a - 7} ${b}H${a + 7}M${a} ${b - 7}V${b + 7}" style="stroke:var(--text);stroke-width:2"/>`; }
    if (pr) { const a = sx(pr.v[0]), b = sy(pr.v[1]); s += `<polygon class="pravda" points="${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(j => { const r = j % 2 ? 3.5 : 8, u = -Math.PI / 2 + j * Math.PI / 5; return `${f3(a + r * Math.cos(u))},${f3(b + r * Math.sin(u))}`; }).join(' ')}"><title>pravda</title></polygon>`; }
    return s + '</svg>';
  }

  /* ================= citlivost ================= */
  function htmlCitlivost() {
    const C = citlivost();
    if (!C.stred) return `<p class="varovani">${esc(V.x.text || 'Výpočet nemá řešení.')}</p>`;
    let max = 0;
    C.radky.forEach(r => [r.vA, r.vB].forEach((a, i) => a.forEach(v => { if (Number.isFinite(v)) max = Math.max(max, Math.abs(v - C.stred[i])); })));
    max = max || 1;
    const pas = (a, st, cl) => {
      if (!a.every(Number.isFinite)) return '<div class="pas"></div>';
      const lo = Math.min(...a) - st, hi = Math.max(...a) - st;
      return `<div class="pas"><b></b><i class="${cl}" style="left:${50 + lo / max * 50}%;width:${Math.max(0.5, (hi - lo) / max * 50)}%"></i></div>`;
    };
    const fm = (r, x) => r.naKmh ? c(kmh(x)) : c(x, r.j === '' ? 2 : r.j === '°' || r.j === 'kg' ? 0 : 1);
    return `<h2>📊 Citlivost na jednotlivé vstupy</h2>
      <p class="tip">Každý vstup se posune zvlášť na dolní a horní mez (ostatní ve středu). Pruh ukazuje, o kolik se pohne rychlost před střetem; svislá čára = odhad (${esc(nz(0))} ${c(C.stred[0])} km/h, ${esc(nz(1))} ${c(C.stred[1])} km/h). Seřazeno podle vlivu – nahoře je to, co je třeba změřit nejpečlivěji.</p>
      <div class="tab-obal"><table class="tornado"><thead><tr><th>Vstup</th><th>rozsah</th><th class="hlavA"><span>${esc(nz(0))}</span> (km/h)</th><th></th><th class="hlavB"><span>${esc(nz(1))}</span> (km/h)</th><th></th></tr></thead><tbody>
      ${C.radky.map(r => `<tr><td>${esc(r.nazev)}</td><td class="c">${fm(r, r.lo)} – ${fm(r, r.hi)} ${esc(r.j)}</td>
        <td class="c">${c(r.vA[0])} → ${c(r.vA[1])}</td><td>${pas(r.vA, C.stred[0], 'a')}</td>
        <td class="c">${c(r.vB[0])} → ${c(r.vB[1])}</td><td>${pas(r.vB, C.stred[1], 'b')}</td></tr>`).join('')}
      </tbody></table></div>`;
  }

  /* ================= vykreslení pohledu ================= */
  function vykresliPohled() {
    const el = $('pohled'), r = el.getBoundingClientRect();
    const w = Math.max(200, r.width), h = Math.max(200, r.height);
    document.querySelectorAll('[data-pohled]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pohled === nast.pohled)));
    if (nast.pohled === 'nacrt') {
      el.innerHTML = svgNacrt(w, h).svg + `<div class="legenda"><i style="background:var(--accent)"></i>${esc(nz(0))} &nbsp; <i style="background:var(--warn)"></i>${esc(nz(1))}<span class="vic"><br>
        plné obrysy = v okamžiku střetu, vyplněné = konečné polohy<br>silné šipky = hybnost před (plná) a po (čárkovaná)</span></div><div class="tip-tah">táhněte ● S, konečné polohy a kroužky příjezdu</div>`;
    } else if (nast.pohled === 'hybnost') {
      el.innerHTML = svgHybnost(w, h) + `<div class="legenda"><b>Diagram hybnosti</b> (t·m/s)<span class="vic"><br>plné = před střetem: m·v ${esc(nz(0))} + m·v ${esc(nz(1))}<br>čárkované = po střetu: m·u ${esc(nz(0))} + m·u ${esc(nz(1))}<br>oba řetězce končí ve stejném bodě Σp<br>tečkované přímky = směry příjezdu (konstrukce)</span></div>`;
    } else if (nast.pohled === 'mc') {
      el.innerHTML = svgMrak(w, h) + `<div class="legenda"><b>Nejistota Monte Carlo</b><span class="vic"><br>body = ${c(V.mc.platnych)} platných kombinací (zobrazen výběr)<br>čárkovaný obdélník = 95% intervaly, kříž = odhad${P.ukazka ? '<br><span class="ok-txt">★</span> = pravda ukázky' : ''}</span></div>`;
    } else {
      el.innerHTML = `<div class="html-pohled">${htmlCitlivost()}</div>`;
    }
  }

  /* ================= tažení v náčrtu ================= */
  function svetBod(e) {
    const svg = $('pohled').querySelector('svg');
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const q = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: q.x, y: -q.y };
  }
  const zaokr = (x, n) => Math.round(x / n) * n;
  $('pohled').addEventListener('pointerdown', e => {
    const u = e.target.closest('[data-uchop]');
    if (!u || nast.pohled !== 'nacrt') return;
    e.preventDefault();
    taz = { co: u.dataset.uchop, id: e.pointerId, K: [0, 1].map(i => J.konecnaPoloha(P, i)) };
    pevnyBox = null;
    $('pohled').setPointerCapture(e.pointerId);
    vykresliPohled();   // zafixuje rámec
  });
  $('pohled').addEventListener('pointermove', e => {
    if (!taz || e.pointerId !== taz.id) return;
    const w = svetBod(e);
    if (taz.co === 'S') {
      const K = taz.K;   // konečné polohy zůstávají na místě, mění se dojezdy
      P.S = { x: zaokr(w.x, 0.1), y: zaokr(w.y, 0.1) };
      K.forEach((k, i) => { const v = P.vozidla[i]; v.d = zaokr(Math.hypot(k.x - P.S.x, k.y - P.S.y), 0.1); v.phi = zaokr(J.uhelVektoru(k.x - P.S.x, k.y - P.S.y), 1); });
    } else {
      const i = +taz.co[1], v = P.vozidla[i];
      if (taz.co[0] === 'K') { v.d = zaokr(Math.hypot(w.x - P.S.x, w.y - P.S.y), 0.1); v.phi = zaokr(J.uhelVektoru(w.x - P.S.x, w.y - P.S.y), 1); }
      else v.theta = zaokr(J.uhelVektoru(P.S.x - w.x, P.S.y - w.y), 1);
    }
    obnovPole();
    prepocti(true);
  });
  const konecTazeni = e => {
    if (!taz || e.pointerId !== taz.id) return;
    taz = null; pevnyBox = null;
    prepocti();
  };
  $('pohled').addEventListener('pointerup', konecTazeni);
  $('pohled').addEventListener('pointercancel', konecTazeni);

  /* ================= projekty, soubory ================= */
  function nastavProjekt(p) {
    clearTimeout(casUlozeni); zaznamenej();   // rozdělaná změna = vlastní krok, nový projekt = další krok
    P = p; V.cit = null;
    pis(KLIC_AKT, P);
    vykresliVstupy();
    prepocti();
    zaznamenej();
  }
  function otevriUkazku(klic) {
    nastavProjekt(J.vytvorUkazku(klic));
    prepniZalozku('vysledky');
  }
  function stahni(nazev, text, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: typ }));
    a.download = nazev; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  const bezpecne = s => String(s || 'stret').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').slice(0, 40);
  function ulozDoProhlizece() {
    const vse = cti(KLIC_PROJ, {});
    if (!P.id || P.id.startsWith('ukazka-')) P.id = 'p' + Date.now().toString(36);
    vse[P.id] = { nazev: P.nazev, ulozeno: new Date().toISOString(), data: P };
    if (pis(KLIC_PROJ, vse)) { pis(KLIC_AKT, P); Dialog.info(`Uloženo jako „${P.nazev}“`); }
    else Dialog.chyba('Uložení se nepovedlo (plné nebo zakázané úložiště prohlížeče).');
  }
  function seznamProjektu() {
    const vse = cti(KLIC_PROJ, {});
    const pol = Object.entries(vse).sort((a, b) => String(b[1].ulozeno).localeCompare(String(a[1].ulozeno)));
    $('seznamProj').innerHTML = pol.length ? pol.map(([id, z]) => `<div class="pr"><span><b data-i18n="ne">${esc(z.nazev)}</b><br><small>${esc(new Date(z.ulozeno).toLocaleString(jazyk()))}</small></span>
      <button type="button" class="btn mini" data-otevri-proj="${esc(id)}">📂 Otevřít</button><button type="button" class="btn mini danger" data-smaz-proj="${esc(id)}" aria-label="Smazat">🗑️</button></div>`).join('')
      : '<p class="tip">Zatím žádný uložený projekt.</p>';
  }
  $('seznamProj').addEventListener('click', async e => {
    const o = e.target.closest('[data-otevri-proj]'), d = e.target.closest('[data-smaz-proj]');
    const vse = cti(KLIC_PROJ, {});
    if (o && vse[o.dataset.otevriProj]) {
      try { nastavProjekt(J.migruj(vse[o.dataset.otevriProj].data)); $('dlgProjekty').close(); } catch (err) { Dialog.chyba(err.message); }
    } else if (d && vse[d.dataset.smazProj]) {
      if (await Dialog.potvrd(`Smazat projekt „${vse[d.dataset.smazProj].nazev}“?`)) { delete vse[d.dataset.smazProj]; pis(KLIC_PROJ, vse); seznamProjektu(); }
    }
  });
  $('souborJson').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { const p = J.migruj(JSON.parse(await f.text())); nastavProjekt(p); Dialog.info(`Načteno: ${p.nazev}`); }
    catch (err) { Dialog.chyba('Soubor nejde načíst: ' + err.message); }
  });

  /* ================= protokol ================= */
  function htmlProtokol(info) {
    const x = V.x, q = V.mc.q, kol = v => (J.KOLA[v.kola] || {}).nazev || v.kola;
    const pov = P.povrch === 'vlastni' ? 'vlastní' : (J.POVRCHY.find(p => p.id === P.povrch) || {}).nazev;
    const mu = J.rozsahMu(P);
    const vr = (l, f) => `<tr><td>${l}</td>${[0, 1].map(i => `<td>${f(P.vozidla[i], i)}</td>`).join('')}</tr>`;
    const iv = (k, d) => q[k] ? `${c(q[k].od, d)} – ${c(q[k].do, d)}` : '–';
    const nac = svgNacrt(700, 480, true).svg;
    const hyb = svgHybnost(520, 420);
    const C = citlivost();
    return `<h1>Rekonstrukce střetu vozidel – protokol výpočtu</h1>
      <p>${info.cislo ? `<span>Případ / spis:</span> <b data-i18n="ne">${esc(info.cislo)}</b><br>` : ''}${info.misto ? `<span>Místo:</span> <span data-i18n="ne">${esc(info.misto)}</span><br>` : ''}<span>Zpracoval:</span> <span data-i18n="ne">${esc(info.zpracoval || '……………………')}</span><br><span>Datum výpočtu:</span> ${new Date().toLocaleString(jazyk())}</p>
      <p><span>Projekt:</span> <b data-i18n="ne">${esc(P.nazev)}</b>${P.ukazka ? ' <span>(syntetická ukázka se známou pravdou)</span>' : ''}${info.pozn ? `<br><span>Poznámka:</span> <span data-i18n="ne">${esc(info.pozn)}</span>` : ''}</p>
      <h2>1. Metoda</h2>
      <p>Zachování hybnosti ve vodorovné rovině: m_A·v_A + m_B·v_B = m_A·u_A + m_B·u_B (vektorově, složky x a y). Rychlosti po střetu z dojezdů u = √(2·a·d), a = g·(f·cos α + sin α·cos(φ − ψ)). Rychlost na začátku brzdné stopy v₀ = √(v² + 2·a·s) + a·tₙ/2. Odhad ze středů vstupů, interval 2,5–97,5 % Monte Carlo (${c(V.mc.n)} kombinací, rovnoměrně v zadaných mezích, semínko ${P.mc.seed}).</p>
      <h2>2. Vstupy</h2>
      <p>Povrch: ${esc(pov)}, μ ${c(mu[0], 2)} – ${c(mu[1], 2)}; sklon ${c(P.sklon, 1)} % ± ${c(P.sklonTol, 1)} %, stoupá směrem ${c(P.sklonSmer)}°; bod střetu S = (${c(P.S.x, 1)}; ${c(P.S.y, 1)}) m.</p>
      <table><thead><tr><th></th><th>${esc(nz(0))}</th><th>${esc(nz(1))}</th></tr></thead><tbody>
      ${vr('Hmotnost (pohotovostní + posádka/náklad)', v => `${c(v.hmotnost)} + ${c(v.naklad)} = ${c(J.hmotnost(v))} kg ± ${c(v.hmotTol)}`)}
      ${vr('Úhel příjezdu θ', v => `${c(v.theta)}° ± ${c(v.thetaTol, 1)}°`)}
      ${vr('Místo poškození', v => esc((J.MISTA[v.misto] || {}).nazev))}
      ${vr('Brzdná stopa před střetem', v => v.stopa > 0 ? `${c(v.stopa, 1)} m ± ${c(v.stopaTol, 1)}, tₙ ${c(v.tn, 2)} s` : '–')}
      ${vr('Nejvyšší dovolená rychlost', v => v.limit > 0 ? `${c(v.limit)} km/h` : '–')}
      ${vr('Známá rychlost', v => v.znamaV ? `${c(v.znamaOd)} – ${c(v.znamaDo)} km/h` : '–')}
      ${vr('Úhel dojezdu φ', v => `${c(v.phi)}° ± ${c(v.phiTol, 1)}°`)}
      ${vr('Délka dojezdu d', v => `${c(v.d, 1)} m ± ${c(v.dTol, 1)}`)}
      ${vr('Dojezd – stav kol, f', v => { const f = J.rozsahF(P, v); return `${esc(kol(v))}; f ${c(f[0], 2)} – ${c(f[1], 2)}`; })}
      </tbody></table>
      <h2>3. Výsledky</h2>
      ${x.ok ? `<table><thead><tr><th></th><th>${esc(nz(0))}<br><span>odhad</span></th><th>95% interval</th><th>${esc(nz(1))}<br><span>odhad</span></th><th>95% interval</th></tr></thead><tbody>
        <tr><td>Rychlost před střetem (km/h)</td><td class="c"><b>${c(kmh(x.v[0]), 1)}</b></td><td class="c">${iv('vA', 1)}</td><td class="c"><b>${c(kmh(x.v[1]), 1)}</b></td><td class="c">${iv('vB', 1)}</td></tr>
        ${x.v0.some(v => v != null) ? `<tr><td>Rychlost na začátku brzdné stopy (km/h)</td><td class="c">${x.v0[0] == null ? '–' : c(kmh(x.v0[0]), 1)}</td><td class="c">${x.v0[0] == null ? '' : iv('v0A', 1)}</td><td class="c">${x.v0[1] == null ? '–' : c(kmh(x.v0[1]), 1)}</td><td class="c">${x.v0[1] == null ? '' : iv('v0B', 1)}</td></tr>` : ''}
        <tr><td>Rychlost po střetu (km/h)</td><td class="c">${c(kmh(x.u[0]), 1)}</td><td class="c">${iv('uA', 1)}</td><td class="c">${c(kmh(x.u[1]), 1)}</td><td class="c">${iv('uB', 1)}</td></tr>
        <tr><td>Δv (km/h)</td><td class="c">${c(kmh(x.dv[0]), 1)}</td><td class="c">${iv('dvA', 1)}</td><td class="c">${c(kmh(x.dv[1]), 1)}</td><td class="c">${iv('dvB', 1)}</td></tr>
        <tr><td>Směr síly (hodiny / od přídě)</td><td class="c">${x.hodiny[0]} h / ${c(x.hodinyUhel[0])}°</td><td></td><td class="c">${x.hodiny[1]} h / ${c(x.hodinyUhel[1])}°</td><td></td></tr>
        </tbody></table>
        <p><span>Kinetická energie před střetem ${c(x.Epred / 1000)} kJ, po střetu ${c(x.Epo / 1000)} kJ, ztráta ${c(x.ztrata / 1000)} kJ (${iv('ztrata')} kJ).</span> <span>Restituce podél síly ${c(x.restituce, 2)}.</span> <span>Platných kombinací Monte Carlo: ${c(V.mc.platnych)} z ${c(V.mc.n)}.</span></p>
        ${vetyLimit().map(k => `<p>${esc(k.text)}</p>`).join('')}
        ${P.ukazka ? `<p>Známá pravda ukázky (rychlost před střetem): A ${c(P.ukazka.pravda.v[0], 1)} km/h, B ${c(P.ukazka.pravda.v[1], 1)} km/h.</p>` : ''}`
        : `<p><b>Výpočet nemá řešení:</b> ${esc(x.text)}</p>`}
      <h2>4. Kontroly plausibility</h2>
      <ul class="kontroly">${V.kontroly.map(k => `<li class="${k.uroven}">${esc(k.text)}</li>`).join('')}</ul>
      <h2>5. Náčrt a diagram hybnosti</h2>
      <div class="dvojobr"><figure>${nac}<figcaption>Náčrt v plánu (m): obrysy v okamžiku střetu, konečné polohy, dojezdy, vektory hybnosti.</figcaption></figure>
      <figure>${hyb}<figcaption>Diagram hybnosti (t·m/s): plné = před střetem, čárkované = po střetu.</figcaption></figure></div>
      <h2>6. Nejvlivnější vstupy</h2>
      ${C.stred ? `<table><thead><tr><th>Vstup (dolní → horní mez)</th><th><span>${esc(nz(0))}</span> (km/h)</th><th><span>${esc(nz(1))}</span> (km/h)</th></tr></thead><tbody>${C.radky.slice(0, 6).map(r => `<tr><td>${esc(r.nazev)}</td><td class="c">${c(r.vA[0])} → ${c(r.vA[1])}</td><td class="c">${c(r.vB[0])} → ${c(r.vB[1])}</td></tr>`).join('')}</tbody></table>` : '<p>–</p>'}
      <h2>7. Meze</h2>
      <ul>
        <li>Model bodových hmot: nepočítá deformační energii (EES), rotaci vozidel ani sekundární nárazy během dojezdu; dojezd je přímočarý se stálým zpomalením.</li>
        <li>Výsledek nejvíc ovlivňuje součinitel f při dojezdu, přesnost bodu střetu a konečných poloh a úhly. U téměř rovnoběžných směrů příjezdu je úloha špatně podmíněná.</li>
        <li>Interval vyjadřuje jen zadané meze vstupů (rovnoměrné rozdělení), ne chybu modelu.</li>
        <li>Orientační výpočet pro výuku a kontrolu úvah – nenahrazuje znalecký posudek z oboru dopravy.</li>
      </ul>
      <div class="podpis"><span>Zpracoval: ……………………………</span><span>Podpis: ……………………………</span></div>`;
  }

  /* ================= příkazy ================= */
  const PRIKAZY = {
    novy: async () => { if (await Dialog.potvrd('Začít nový střet? Aktuální projekt jde vrátit tlačítkem ↶ Zpět (uložené projekty zůstanou).')) { nastavProjekt(J.novyProjekt()); prepniZalozku('vstupy'); } },
    ulozit: ulozDoProhlizece,
    projekty: () => { seznamProjektu(); $('dlgProjekty').showModal(); },
    exportJson: () => stahni(`stret_${bezpecne(P.nazev)}.json`, JSON.stringify(P, null, 1), 'application/json'),
    importJson: () => $('souborJson').click(),
    protokol: () => { $('dlgProtokol').showModal(); },
    galerie: () => $('dlgGalerie').showModal(),
    ukazka: el => otevriUkazku(el.dataset.klic),
    napoveda: () => $('dlgNapoveda').showModal(),
    zkratky: () => $('dlgZkratky').showModal(),
    zpet, znovu
  };
  $('dlgProtokol').addEventListener('close', () => {
    const d = $('dlgProtokol');
    if (d.returnValue !== 'ok') return;
    const f = d.querySelector('form'), info = Object.fromEntries(['cislo', 'zpracoval', 'misto', 'pozn'].map(k => [k, f.elements[k].value.trim()]));
    $('protokol').innerHTML = htmlProtokol(info);
    setTimeout(() => window.print(), 50);
  });

  function vyplnGalerii() {
    const karty = J.UKAZKY.map(u => `<button type="button" class="karta${u.mimo ? ' mimo' : ''}" data-prikaz="ukazka" data-klic="${u.klic}"><span class="ik" aria-hidden="true">${u.ik}</span><b>${esc(u.nazev)}</b><span>${esc(u.popis)}</span></button>`).join('');
    $('galerie').innerHTML = karty;
    $('nabUkazky').innerHTML = J.UKAZKY.map(u => `<button class="tl" data-prikaz="ukazka" data-klic="${u.klic}">${u.ik} ${esc(u.nazev)}</button>`).join('')
      + '<hr><button class="tl" data-prikaz="galerie">🧪 Galerie s popisy… <small>G</small></button>';
  }

  function prepniZalozku(z) {
    nast.zalozka = z; pis(KLIC_NAST, nast);
    document.querySelectorAll('[data-zal]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.zal === z)));
    $('panelVstupy').hidden = z !== 'vstupy'; $('panelVysledky').hidden = z !== 'vysledky';
    if (z === 'vysledky') vykresliVysledky();
  }
  function prepniPohled(p) { nast.pohled = p; pis(KLIC_NAST, nast); vykresliPohled(); }

  /* ================= události ================= */
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
    if (p && PRIKAZY[p.dataset.prikaz]) {
      e.stopPropagation(); zavriNabidky();
      const dlg = p.closest('dialog'); if (dlg && p.dataset.prikaz === 'ukazka') dlg.close();
      return PRIKAZY[p.dataset.prikaz](p);
    }
    if (!e.target.closest('.nabidka')) zavriNabidky();
    if (e.target.closest('[data-metoda]')) zavriNabidky();
    const pv = e.target.closest('[data-pohled]');
    if (pv) return prepniPohled(pv.dataset.pohled);
    const z = e.target.closest('[data-zal]');
    if (z) return prepniZalozku(z.dataset.zal);
  });
  $('panelVstupy').addEventListener('input', zmenaVstupu);
  $('panelVstupy').addEventListener('change', e => { if (e.target.dataset.g === 'povrch' || (e.target.dataset.k === 'stopa')) zmenaVstupu(e); });
  addEventListener('resize', zavriNabidky);
  new ResizeObserver(() => { if (!taz) vykresliPohled(); }).observe($('pohled'));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { zavriNabidky(); return; }
    if (e.target.closest && e.target.closest('input,textarea,select,dialog')) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (k === 'z' || k === 'y')) {
      e.preventDefault();
      return k === 'y' || e.shiftKey ? znovu() : zpet();
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const pohledy = { 1: 'nacrt', 2: 'hybnost', 3: 'mc', 4: 'citlivost' };
    if (pohledy[k]) prepniPohled(pohledy[k]);
    else if (k === 'g') PRIKAZY.galerie();
    else if (k === 'p') PRIKAZY.protokol();
    else if (k === 's') ulozDoProhlizece();
    else if (k === 'v') prepniZalozku(nast.zalozka === 'vstupy' ? 'vysledky' : 'vstupy');
    else if (e.key === '?') PRIKAZY.zkratky();
    else return;
    e.preventDefault();
  });

  /* ================= start ================= */
  vyplnGalerii();
  let start = null;
  try { const s = cti(KLIC_AKT, null); if (s) start = J.migruj(s); } catch (e) { start = null; }
  P = start || J.novyProjekt();
  vykresliVstupy();
  prepocti();
  zaznamenej();
  prepniZalozku(nast.zalozka === 'vysledky' ? 'vysledky' : 'vstupy');

  window.STRET_APP = { projekt: () => P, vysledek: () => V, historie: () => ({ zpet: H.zpet.length, znovu: H.znovu.length }), PRIKAZY, otevriUkazku, prepniPohled, prepniZalozku, htmlProtokol, nastavProjekt };
})();
