/* Čtení kurentu – pracovní nástroje (DOM): převod dat a svátky, římské číslice, šablony zápisů,
   záměny a období písma, literatura, psaní stylusem. window.KurentNastroje(U) → { pohledy: {...} } */
(function () {
'use strict';
window.KurentNastroje = function (U) {
const { $, esc, J, D, S } = U;
const PEVNE = J.pevneSvatky(S.SVATKY);
const KAL = { greg: 'gregoriánský', jul: 'juliánský' };
const fmtJ = (j, kal) => J.fmtDatum(J.zJdn(j, kal));

/* ---------- převod dat a svátky ---------- */
function datum() {
  const n = U.nast.datum = Object.assign({ d: 7, m: 9, r: 1784, kal: 'greg', svatek: 'velikonoce', srok: 1784, posun: '0', rok: 1784, filtr: '' }, U.nast.datum);
  const mesice = J.MESICE_CS.map((m, i) => `<option value="${i + 1}">${i + 1} – ${m}</option>`).join('');
  const kalSel = id => `<select class="vstup" id="${id}">${Object.entries(KAL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>`;
  const svatkyVolby = `<optgroup label="Pohyblivé (podle Velikonoc)">${J.POHYBLIVE.map(([id, cs]) => `<option value="${id}">${esc(cs)}</option>`).join('')}</optgroup>
    <optgroup label="Pevné">${PEVNE.map(s => `<option value="${s.id}">${esc(s.cs)} (${s.datum[1]}. ${s.datum[0]}.)</option>`).join('')}</optgroup>`;
  U.obsah.innerHTML = `<h2>📅 Převod dat a svátky</h2>
    <p class="tip">Matriky datují latinskými měsíci (7ber = září), podle svátků („am Tage des hl. Martin“) nebo nedělí („Dominica Laetare“). Výpočet Velikonoc a dnů v týdnu platí pro gregoriánský i juliánský kalendář.</p>
    <div class="panel">
      <h3 style="margin-top:0">Datum ze zápisu</h3>
      <div class="radek"><input class="vstup" id="dText" placeholder="např. 7. Xbris 1784, den 3ten Jänner 1850" style="flex:1 1 240px" aria-label="Datum jako text" data-i18n="ne">
        <span class="pozn" id="dRozbor"></span></div>
      <div class="radek" style="margin-top:8px">
        <label>Den <input class="vstup" type="number" id="dD" min="1" max="31" style="width:5em" value="${n.d}"></label>
        <label>Měsíc <select class="vstup" id="dM">${mesice}</select></label>
        <label>Rok <input class="vstup" type="number" id="dR" min="1" max="4000" style="width:6em" value="${n.r}"></label>
        <label>Kalendář ${kalSel('dKal')}</label>
      </div>
      <div id="dVysledek" class="vysledek-panel"></div>
    </div>
    <div class="panel" style="margin-top:12px">
      <h3 style="margin-top:0">Datování podle svátku</h3>
      <div class="radek">
        <select class="vstup" id="sSvatek" aria-label="Svátek" style="max-width:100%">${svatkyVolby}</select>
        <label>Rok <input class="vstup" type="number" id="sRok" min="1" max="4000" style="width:6em" value="${n.srok}"></label>
        <select class="vstup" id="sPosun" aria-label="Den vůči svátku">
          <option value="0">v den svátku</option>
          ${[1, 2, 3, 4, 5, 6, 0].map(d => `<option value="+${d}">v ${J.DNY_CS[d]} po svátku</option><option value="-${d}">v ${J.DNY_CS[d]} před svátkem</option>`).join('')}
        </select>
        <label>Kalendář ${kalSel('sKal')}</label>
      </div>
      <div id="sVysledek" class="vysledek-panel"></div>
    </div>
    <div class="panel" style="margin-top:12px">
      <h3 style="margin-top:0">Kalendář svátků roku</h3>
      <div class="radek"><label>Rok <input class="vstup" type="number" id="kRok" min="1" max="4000" style="width:6em" value="${n.rok}"></label>
        <label>Kalendář ${kalSel('kKal')}</label>
        <input type="search" class="vstup" id="kFiltr" placeholder="🔍 Filtrovat (Martin, Laetare…)" style="flex:1 1 180px" value="${esc(n.filtr)}" aria-label="Filtrovat"></div>
      <div class="tab-obal" style="margin-top:8px;max-height:420px"><table><thead><tr><th>Datum</th><th>Den</th><th>Svátek</th><th>Latinsky / německy</th></tr></thead><tbody id="kTelo"></tbody></table></div>
    </div>
    <p class="tip" style="margin-top:12px"><b>Kalendáře:</b> v Čechách a na Moravě platí gregoriánský kalendář od roku 1584, v protestantských zemích Německa od roku 1700 (po 18. únoru následoval 1. březen), v Británii od 1752, v Rusku od 1918. Rozdíl mezi kalendáři: 10 dní (1582–1700), 11 (1700–1800), 12 (1800–1900), 13 dní (1900–2100). Neděle se počítají podle tridentského (katolického) kalendáře; evangelíci číslují neděle po Trojici. Pevné svátky podle kalendáře užívaného v českých zemích – místní kalendáře se lišily (Grotefend).</p>`;
  $('dM').value = n.m; ['dKal', 'sKal', 'kKal'].forEach(id => { $(id).value = n.kal; });
  $('sSvatek').value = n.svatek; $('sPosun').value = n.posun;
  const ulozit = () => U.ulozNast();
  function prevod() {
    const d = +$('dD').value, m = +$('dM').value, r = +$('dR').value, kal = $('dKal').value;
    Object.assign(n, { d, m, r, kal }); ulozit();
    const v = $('dVysledek');
    if (!(r >= 1 && r <= 4000) || !J.platneDatum(r, m, d, kal)) { v.innerHTML = '<p class="chyba-text">Takové datum v tomto kalendáři neexistuje.</p>'; return; }
    const p = J.popisDne(r, m, d, kal, PEVNE), jiny = kal === 'greg' ? 'jul' : 'greg', x = J.zJdn(p.jdn, jiny);
    const vel = J.velikonoce(r, kal), sv = p.svatky.map(s => `<li><b>${esc(s.cs)}</b> <span class="pozn" data-i18n="ne">${esc(s.la)}</span>${s.pozn ? ` <span class="pozn">(${esc(s.pozn)})</span>` : ''}</li>`).join('');
    v.innerHTML = `<p class="velky"><b>${p.denCs}</b> ${d}. ${J.MESICE_GEN[m - 1]} ${r} <span class="pozn" data-i18n="ne">· ${p.denLa} · ${p.denDe}</span></p>
      <p>V ${KAL[jiny]}m kalendáři: <b>${J.fmtDatum(x)}</b> <span class="pozn">(rozdíl ${Math.abs(J.jdn(r, m, d, jiny) - p.jdn)} dní)</span></p>
      ${sv ? `<ul class="seznam">${sv}</ul>` : ''}
      ${p.liturg ? `<p>Liturgicky: <span data-i18n="ne">${esc(p.liturg)}</span></p>` : ''}
      <p class="pozn">Velikonoce ${r} (${KAL[kal]}): ${J.fmtDatum(vel)}</p>`;
  }
  function podleSvatku() {
    const id = $('sSvatek').value, r = +$('sRok').value, kal = $('sKal').value, posun = $('sPosun').value;
    Object.assign(n, { svatek: id, srok: r, posun }); ulozit();
    const v = $('sVysledek');
    if (!(r >= 1 && r <= 4000)) { v.innerHTML = ''; return; }
    const s = J.svatkyRoku(r, kal, PEVNE).find(x => x.id === id);
    if (!s) { v.innerHTML = '<p class="chyba-text">Svátek v tomto roce nenalezen.</p>'; return; }
    let j = s.jdn;
    if (posun !== '0') j = J.denOd(j, Math.abs(+posun) % 7, posun[0] === '-' ? -1 : 1);
    const x = J.zJdn(j, kal);
    v.innerHTML = `<p class="velky"><b>${J.DNY_CS[J.denTydne(j)]} ${x.d}. ${J.MESICE_GEN[x.m - 1]} ${x.r}</b> <span class="pozn">(${KAL[kal]})</span></p>
      <p class="pozn">${esc(s.cs)} připadl na ${J.DNY_CS[J.denTydne(s.jdn)]} ${fmtJ(s.jdn, kal)}. <span data-i18n="ne">${esc(s.la)}</span></p>
      <p><button class="btn mini" id="sDoPrevodu">→ Podrobnosti dne</button></p>`;
    $('sDoPrevodu').onclick = () => { $('dD').value = x.d; $('dM').value = x.m; $('dR').value = x.r; $('dKal').value = kal; prevod(); $('dVysledek').scrollIntoView({ block: 'center', behavior: 'smooth' }); };
  }
  function kalendar() {
    const r = +$('kRok').value, kal = $('kKal').value, q = J.normalizuj($('kFiltr').value);
    Object.assign(n, { rok: r, filtr: $('kFiltr').value }); ulozit();
    if (!(r >= 1 && r <= 4000)) { $('kTelo').innerHTML = ''; return; }
    const radky = J.svatkyRoku(r, kal, PEVNE).filter(s => !q || J.normalizuj(s.cs + ' ' + s.la).includes(q));
    $('kTelo').innerHTML = radky.map(s => `<tr class="${s.druh}"><td style="white-space:nowrap">${fmtJ(s.jdn, kal)}</td><td>${J.DNY_CS[J.denTydne(s.jdn)]}</td><td>${esc(s.cs)}</td><td class="pozn" data-i18n="ne">${esc(s.la)}</td></tr>`).join('') || '<tr><td colspan="4" class="pozn">Nic nenalezeno.</td></tr>';
  }
  $('dText').addEventListener('input', () => {
    const x = J.rozeberDatum($('dText').value);
    $('dRozbor').textContent = $('dText').value.trim() ? (x ? `→ ${x.d}. ${J.MESICE_GEN[x.m - 1]} ${x.r}` : 'nerozpoznáno – zadejte den, měsíc a rok') : '';
    if (x) { $('dD').value = x.d; $('dM').value = x.m; $('dR').value = x.r; prevod(); }
  });
  ['dD', 'dM', 'dR', 'dKal'].forEach(id => $(id).addEventListener('input', prevod));
  ['sSvatek', 'sRok', 'sPosun', 'sKal'].forEach(id => $(id).addEventListener('input', podleSvatku));
  ['kRok', 'kKal', 'kFiltr'].forEach(id => $(id).addEventListener('input', kalendar));
  prevod(); podleSvatku(); kalendar();
}

/* ---------- římské číslice a chronogram ---------- */
function rimske() {
  U.obsah.innerHTML = `<h2>Ⅻ Římské číslice a chronogramy</h2>
    <div class="panel">
      <div class="radek"><label>Římské číslo <input class="vstup" id="rVstup" placeholder="MDCCLXXXIIII, viij" data-i18n="ne" style="width:14em"></label>
        <span id="rVysl" class="velky"></span></div>
      <div class="radek" style="margin-top:8px"><label>Arabské číslo <input class="vstup" type="number" id="aVstup" min="1" max="3999" placeholder="1784" style="width:8em"></label>
        <span id="aVysl" class="velky" data-i18n="ne"></span></div>
      <ul class="tip" style="margin-top:10px">
        <li>V matrikách se píše i „nestandardně“: <b>IIII</b> = 4, <b>VIIII</b> = 9, <b>XXXX</b> = 40.</li>
        <li>Poslední i se často píše jako <b>j</b>: <b>viij</b> = 8, <b>xij</b> = 12. Malá písmena znamenají totéž co velká.</li>
        <li>Měsíce zkratkou: <b>7ber</b> = září, <b>8ber</b> = říjen, <b>9ber</b> = listopad, <b>Xber</b> = prosinec.</li>
      </ul>
    </div>
    <div class="panel" style="margin-top:12px">
      <h3 style="margin-top:0">Chronogram</h3>
      <p class="tip">Nápis, v němž zvýrazněná (velká) písmena I, V (U), X, L, C, D, M dávají součtem letopočet. J se počítá jako I, W jako VV.</p>
      <textarea class="vstup" id="chText" rows="3" style="width:100%" data-i18n="ne">ChrIstVs DoMInI Votis aDsIt</textarea>
      <label style="font-size:.86rem"><input type="checkbox" id="chVse"> Počítat všechna písmena (nejen velká)</label>
      <p id="chVysl" class="velky"></p>
    </div>`;
  const r = () => {
    const v = $('rVstup').value.trim(), x = J.zRimskeho(v);
    $('rVysl').innerHTML = !v ? '' : x ? `= <b>${x.hodnota}</b>${x.nestandardni ? ` <span class="pozn">(běžný zápis: ${x.kanonicky})</span>` : ''}` : '<span class="chyba-text">neplatné římské číslo</span>';
  };
  const a = () => { const n = +$('aVstup').value; $('aVysl').textContent = n ? (J.rimske(n) ? '= ' + J.rimske(n) : 'jen 1–3999') : ''; };
  const ch = () => {
    const t = $('chText').value, vse = $('chVse').checked, x = J.chronogram(t, !vse);
    let i = 0;
    const zvyr = Array.from(t).map(c => (x.pismena[i] === c && (vse ? /[ivxlcdmujw]/i : /[IVXLCDMUJW]/).test(c)) ? (i++, `<mark>${esc(c)}</mark>`) : esc(c)).join('');
    $('chVysl').innerHTML = `<span data-i18n="ne">${zvyr}</span><br>Součet: <b>${x.soucet}</b>`;
  };
  $('rVstup').oninput = r; $('aVstup').oninput = a; $('chText').oninput = ch; $('chVse').onchange = ch; ch();
}

/* ---------- šablony zápisů ---------- */
function sablony() {
  const n = U.nast; const s = S.SABLONY.find(x => x.id === n.sablona) || S.SABLONY[0];
  U.obsah.innerHTML = `<h2>📋 Šablony typických zápisů</h2>
    <p class="tip">Kolonky rakouských tištěných matrik (od 1784) s vyplněným vzorem – vzorové osoby jsou smyšlené. Přesné znění záhlaví se lišilo podle tiskopisu a doby, proto vždy nejdřív přečtěte záhlaví skutečné knihy. Pod tabulkou je starší latinský zápis volnou formou (do 1784).</p>
    <div class="radek" role="tablist">${S.SABLONY.map(x => `<button class="btn mini" data-sablona="${x.id}" aria-pressed="${x === s}">${esc(x.nazev)}</button>`).join('')}
      <label style="margin-left:auto"><input type="checkbox" id="sbKurent" ${n.sbKurent !== false ? 'checked' : ''}> Vzor kurentem</label></div>
    <div class="tab-obal" style="margin-top:8px"><table><thead><tr><th>Záhlaví kolonky</th><th>Česky</th><th>Vzorový zápis</th><th>Překlad</th></tr></thead><tbody>
      ${s.kolonky.map(k => `<tr><td data-i18n="ne"><i>${esc(k[0])}</i></td><td>${esc(k[1])}</td><td data-i18n="ne">${k[2] ? (n.sbKurent !== false ? U.kSpan(k[2], 'mensi') + '<br>' : '') + `<span class="pozn">${esc(k[2])}</span>` : ''}</td><td>${esc(k[3])}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="panel" style="margin-top:12px"><h3 style="margin-top:0">Latinský zápis (před 1784)</h3>
      <p data-i18n="ne"><i>${esc(s.latina)}</i></p><p>${esc(s.preklad)}</p></div>
    <p class="radek" style="margin-top:10px">
      <button class="btn primary" id="sbDoPrepisu" title="Přidá řádky „Záhlaví: “ na konec aktuálního přepisu">📝 Vložit kolonky do přepisu</button>
      <button class="btn" id="sbProcvic">✍️ Vzor do převodníku</button></p>`;
  U.obsah.querySelectorAll('[data-sablona]').forEach(b => b.onclick = () => { n.sablona = b.dataset.sablona; U.ulozNast(); sablony(); });
  $('sbKurent').onchange = e => { n.sbKurent = e.target.checked; U.ulozNast(); sablony(); };
  $('sbDoPrepisu').onclick = () => { U.cekajiciRadky = s.kolonky.map(k => k[1].replace(/:.*/, '') + ': '); U.prepni('prepis'); };
  $('sbProcvic').onclick = () => { n.prevod.text = s.kolonky.filter(k => k[2]).map(k => k[2]).join('\n'); U.prepni('prevodnik'); };
}

/* ---------- záměny a období písma ---------- */
function zameny() {
  const pism = t => t.split(', ').every(x => /^[\p{L}ſß]{1,2}$/u.test(x));
  const k = t => pism(t) ? t.split(', ').map(x => U.kSpan(x, 'stred', { dlouheS: false })).join(' ') + `<br><b data-i18n="ne">${esc(t)}</b>` : `<b data-i18n="ne">${esc(t)}</b>`;
  U.obsah.innerHTML = `<h2>🔍 Časté záměny a období písma</h2>
    <p class="tip">Když slovo „nedává smysl“, zkuste nejdřív tyto záměny. Tvary písmen v buňkách kreslí písmo Wiegel Kurrent – skutečné ruce se liší.</p>
    <div class="tab-obal"><table><thead><tr><th>Čtu</th><th>Může být</th><th>Proč</th><th>Jak rozhodnout</th></tr></thead><tbody>
      ${S.ZAMENY.map(z => `<tr><td>${k(z.cte)}</td><td>${k(z.muze)}</td><td>${esc(z.proc)}</td><td>${esc(z.tip)}</td></tr>`).join('')}
    </tbody></table></div>
    <h3>Písmo podle období</h3>
    <div class="tab-obal"><table><thead><tr><th>Období</th><th>Písmo</th><th>Rysy</th><th>Na co dát pozor</th></tr></thead><tbody>
      ${S.OBDOBI.map(o => `<tr><td style="white-space:nowrap"><b>${esc(o.obdobi)}</b></td><td>${esc(o.pismo)}</td><td>${esc(o.rysy)}</td><td>${esc(o.pozor)}</td></tr>`).join('')}
    </tbody></table></div>
    <p class="tip">Tvary písmen jednotlivých období (a Sütterlinu) tu záměrně nekreslíme – nemáme pro ně ověřené volné písmo a vymyšlené tvary by škodily. Srovnávejte se skutečnými rukopisy v 🖼️ Ukázkách a v literatuře (📚 Zdroje).</p>`;
}

/* ---------- literatura ---------- */
function literatura() {
  U.obsah.innerHTML = `<h2>📚 Zdroje a literatura</h2>
    <div class="odkazy">${S.LITERATURA.map(([t, u, p]) => u ? `<a class="odkaz" href="${esc(u)}" target="_blank" rel="noopener"><b data-i18n="ne">${esc(t)}</b><span>${esc(p)}</span></a>` : `<div class="odkaz"><b data-i18n="ne">${esc(t)}</b><span>${esc(p)}</span></div>`).join('')}</div>
    <h3>Údaje ve stránce</h3>
    <ul class="tip">
      <li>Výpočty kalendáře (juliánský den, Velikonoce) podle algoritmů z Meeusovy knihy; ověřeno na známých datech (testy stránky).</li>
      <li>Hodnoty starých měr a měn jsou zaokrouhlené a platí pro dolnorakouské (vídeňské) míry zavedené v českých zemích v 2. polovině 18. století; metrická soustava platí v Rakousku od roku 1876. Místní míry se lišily.</li>
      <li>Slovníky (jména, nemoci, povolání, vztahy) jsou výběrem nejčastějších výrazů, ne úplným slovníkem.</li>
      <li>Písmo Wiegel Kurrent © Peter Wiegel, SIL Open Font License 1.1 (<a href="kurent/OFL.txt" target="_blank" rel="noopener">licence</a>).</li>
    </ul>`;
}

/* ---------- psaní stylusem s obtahováním ---------- */
const PS = { tahy: [], tah: null, i: 0, vyhodnoceno: false, vysledky: [] };
function sadaPsani() {
  const n = U.nast.psani;
  if (n.sada === 'mala') return D.MALA.map(x => x[0]);
  if (n.sada === 'velka') return D.VELKA.map(x => x[0]);
  if (n.sada === 'lig') return D.LIGATURY.map(x => x[0]);
  if (n.sada === 'slova') return D.SLOVA.filter(s => s[4] === 3 && s[2] === 'de').map(s => s[0]);
  return (n.vlastni || '').split(/\n|,/).map(x => x.trim()).filter(Boolean);
}
function psani() {
  const n = U.nast.psani = Object.assign({ sada: 'mala', rezim: 'obtah', vlastni: 'Johann, Wenzel, getauft', tl: 5 }, U.nast.psani);
  U.obsah.innerHTML = `<h2>✍️ Psaní stylusem</h2>
    <p class="tip">Obtahujte předlohu prstem, stylusem nebo myší. Psaní ruka si pamatuje lépe než oko – kdo písmeno jednou napsal, snáz ho přečte. Skóre porovná vaše tahy s předlohou (pokrytí a přesnost); jde o vodítko, ne o hodnocení krasopisu.</p>
    <div class="radek">
      <select class="vstup" id="psSada" aria-label="Co psát">
        <option value="mala">Malá písmena</option><option value="velka">Velká písmena</option><option value="lig">Spřežky a ligatury</option>
        <option value="slova">Krátká německá slova</option><option value="vlastni">Vlastní text</option></select>
      <select class="vstup" id="psRezim" aria-label="Režim"><option value="obtah">Obtahovat předlohu</option><option value="zpameti">Psát podle vzoru nahoře</option></select>
      <label>Tah <input type="range" id="psTl" min="2" max="14" value="${n.tl}"></label>
      <input class="vstup" id="psVlastni" value="${esc(n.vlastni)}" placeholder="slova oddělená čárkou" style="flex:1 1 200px" aria-label="Vlastní text" data-i18n="ne" ${n.sada === 'vlastni' ? '' : 'hidden'}>
    </div>
    <div class="ps-vzor" id="psVzor" ${n.rezim === 'zpameti' ? '' : 'hidden'}></div>
    <div class="ps-obal"><canvas id="psPlatno" aria-label="Plocha na psaní"></canvas></div>
    <div class="radek" style="justify-content:center;margin-top:8px">
      <button class="btn" id="psPred" title="Předchozí (←)">←</button>
      <button class="btn" id="psSmaz" title="Smazat (Delete)">🧽 Smazat</button>
      <button class="btn" id="psZpet" title="Vrátit tah (Ctrl+Z)">↶ Tah</button>
      <button class="btn primary" id="psHodnot" title="Vyhodnotit (Enter)">✓ Vyhodnotit</button>
      <button class="btn" id="psDalsi" title="Další (→)">→</button>
    </div>
    <p class="vysledek" id="psVysl" aria-live="polite" style="text-align:center"></p>`;
  $('psSada').value = n.sada; $('psRezim').value = n.rezim;
  $('psSada').onchange = e => { n.sada = e.target.value; PS.i = 0; U.ulozNast(); psani(); };
  $('psRezim').onchange = e => { n.rezim = e.target.value; U.ulozNast(); psani(); };
  $('psTl').oninput = e => { n.tl = +e.target.value; U.ulozNast(); };
  $('psVlastni').oninput = e => { n.vlastni = e.target.value; U.ulozNast(); PS.i = 0; novaUloha(); };
  $('psSmaz').onclick = () => { PS.tahy = []; PS.vyhodnoceno = false; $('psVysl').textContent = ''; kresliPsani(); };
  $('psZpet').onclick = () => { PS.tahy.pop(); kresliPsani(); };
  $('psHodnot').onclick = hodnotPsani;
  $('psDalsi').onclick = () => { PS.i++; novaUloha(); };
  $('psPred').onclick = () => { PS.i--; novaUloha(); };
  const c = $('psPlatno');
  c.addEventListener('pointerdown', e => { e.preventDefault(); try { c.setPointerCapture(e.pointerId); } catch (_) { /* syntetická událost */ } PS.tah = { body: [bod(c, e)], tl: n.tl }; PS.tahy.push(PS.tah); kresliPsani(); });
  c.addEventListener('pointermove', e => { if (!PS.tah) return; const ce = e.getCoalescedEvents ? e.getCoalescedEvents() : []; for (const x of ce.length ? ce : [e]) PS.tah.body.push(bod(c, x)); kresliPsani(); });
  const konec = () => { PS.tah = null; };
  c.addEventListener('pointerup', konec); c.addEventListener('pointercancel', konec);
  PS.ro && PS.ro.disconnect(); PS.ro = new ResizeObserver(() => requestAnimationFrame(kresliPsani)); PS.ro.observe(c.parentElement);
  novaUloha();
}
function bod(c, e) { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, e.pointerType === 'pen' && e.pressure ? e.pressure : 0.5]; }
function textUlohy() { const s = sadaPsani(); if (!s.length) return ''; PS.i = (PS.i % s.length + s.length) % s.length; return s[PS.i]; }
function znakyKurentu(t) { return J.prevod(t, { dlouheS: U.nast.psani.sada === 'slova' || U.nast.psani.sada === 'vlastni' }).map(u => u.z).join(''); }
function novaUloha() {
  PS.tahy = []; PS.vyhodnoceno = false;
  const v = $('psVysl'); if (v) v.textContent = '';
  const t = textUlohy(), vz = $('psVzor');
  if (vz) vz.innerHTML = t ? `${U.kSpan(t, '', { dlouheS: U.nast.psani.sada !== 'mala' && U.nast.psani.sada !== 'velka' })} <span class="pozn" data-i18n="ne">${esc(t)}</span>` : '';
  document.fonts.load('60px "Wiegel Kurrent"').then(kresliPsani, kresliPsani);
}
/* rozměry plátna a velikost písma předlohy */
function rozmer(c) {
  const w = c.parentElement.clientWidth, h = Math.max(200, Math.min(340, Math.round(w * 0.45)));
  return { w, h };
}
function velikostPisma(x, t, w, h) {
  x.font = '100px "Wiegel Kurrent"';
  const sir = x.measureText(t).width || 100;
  return Math.max(24, Math.min(h * 0.72, 100 * w * 0.86 / sir));
}
function kresliPredlohu(x, t, w, h, barva) {
  const f = velikostPisma(x, t, w, h);
  x.font = `${f}px "Wiegel Kurrent"`; x.fillStyle = barva; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  x.fillText(t, w / 2, h * 0.62);
  return f;
}
function kresliTahy(x, w, h, barva) {
  x.strokeStyle = barva; x.lineCap = x.lineJoin = 'round';
  for (const s of PS.tahy) {
    for (let i = 1; i < s.body.length; i++) {
      const a = s.body[i - 1], b = s.body[i];
      x.lineWidth = s.tl * (0.5 + b[2]); x.beginPath(); x.moveTo(a[0] * w, a[1] * h); x.lineTo(b[0] * w, b[1] * h); x.stroke();
    }
    if (s.body.length === 1) { const a = s.body[0]; x.fillStyle = barva; x.beginPath(); x.arc(a[0] * w, a[1] * h, s.tl / 2, 0, 7); x.fill(); }
  }
}
function kresliPsani() {
  const c = $('psPlatno'); if (!c) return;
  const { w, h } = rozmer(c), dpr = devicePixelRatio || 1;
  c.style.width = w + 'px'; c.style.height = h + 'px'; c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cs = getComputedStyle(document.documentElement), barva = n => cs.getPropertyValue(n).trim();
  x.fillStyle = barva('--bg-input') || '#fff'; x.fillRect(0, 0, w, h);
  const t = znakyKurentu(textUlohy());
  // linky: horní dotahy, střední pásmo, účaří, spodní dotahy (poměr podle písma)
  const f = velikostPisma(x, t || 'n', w, h), base = h * 0.62;
  // výšky podle skutečných tvarů písma: horní dotah (l), střední pásmo (n), účaří, spodní dotah (g)
  x.font = `${f}px "Wiegel Kurrent"`;
  const vys = z => x.measureText(z);
  x.strokeStyle = barva('--border'); x.lineWidth = 1;
  for (const y of [-vys('l').actualBoundingBoxAscent, -vys('n').actualBoundingBoxAscent, 0, vys('g').actualBoundingBoxDescent]) { x.beginPath(); x.moveTo(8, base + y); x.lineTo(w - 8, base + y); x.stroke(); }
  if (t && (U.nast.psani.rezim === 'obtah' || PS.vyhodnoceno)) { x.globalAlpha = PS.vyhodnoceno && U.nast.psani.rezim !== 'obtah' ? 0.35 : 0.22; kresliPredlohu(x, t, w, h, barva('--text')); x.globalAlpha = 1; }
  kresliTahy(x, w, h, barva('--accent'));
}
function hodnotPsani() {
  const c = $('psPlatno'), t = znakyKurentu(textUlohy());
  if (!c || !t) return;
  if (!PS.tahy.length) { $('psVysl').textContent = 'Nejdřív pište na plochu.'; return; }
  const { w, h } = rozmer(c), k = 3, sw = Math.ceil(w / k), sh = Math.ceil(h / k);
  const maska = kresli => {
    const o = document.createElement('canvas'); o.width = sw; o.height = sh;
    const x = o.getContext('2d'); x.scale(1 / k, 1 / k); kresli(x);
    const d = x.getImageData(0, 0, sw, sh).data, m = new Uint8Array(sw * sh);
    for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 90 ? 1 : 0;
    return m;
  };
  let f = 40;
  const pred = maska(x => { f = kresliPredlohu(x, t, w, h, '#000'); });
  const tahy = maska(x => kresliTahy(x, w, h, '#000'));
  const r = J.skoreObtahu(pred, tahy, sw, sh, Math.max(1, Math.round(f * 0.05 / k)));
  PS.vyhodnoceno = true; PS.vysledky.push(r.skore); kresliPsani();
  const prum = Math.round(PS.vysledky.reduce((a, b) => a + b, 0) / PS.vysledky.length);
  const v = $('psVysl');
  v.className = 'vysledek ' + (r.skore >= 70 ? 'ok' : r.skore >= 45 ? 'skoro' : 'chyba');
  v.innerHTML = `Skóre <b>${r.skore}</b> · obtaženo ${Math.round(r.pokryti * 100)} % předlohy · ${Math.round(r.presnost * 100)} % tahů na předloze <span class="pozn">(průměr sezení ${prum} z ${PS.vysledky.length})</span>`;
}
function klavesaPsani(e) {
  if (U.nast.pohled !== 'psani' || (e.target.matches && e.target.matches('input,select,textarea'))) return false;
  const A = { ArrowRight: () => $('psDalsi').click(), ArrowLeft: () => $('psPred').click(), Enter: hodnotPsani, Delete: () => $('psSmaz').click(), Backspace: () => $('psSmaz').click() };
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); $('psZpet').click(); return true; }
  if (A[e.key]) { e.preventDefault(); A[e.key](); return true; }
  return false;
}

return { pohledy: { datum, rimske, sablony, zameny, literatura, psani }, klavesaPsani };
};
})();
