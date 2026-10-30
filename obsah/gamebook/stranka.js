/* Gamebook – stránka (vykreslení, ovládání, ukládání) společná všem příběhům.
   Obálka obsah/gamebook*.html načte jadro.js, data příběhu (window.GAMEBOOK_PRIBEH) a tenhle soubor.
   Z příběhu se čte: nazev, ikona, podtitul, klic (localStorage, povinný), obrazky (složka), uvodObr, nazvy (popisky vlastností), pravidlo. */
(function () {
'use strict';
'use strict';
const J = window.GamebookJadro, P = window.GAMEBOOK_PRIBEH;
const KLIC = P.klic;
const OBR = P.obrazky || 'gamebook/obr/';
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const NAZVY = Object.assign({ obratnost: '🤸 Obratnost', zdravi: '❤️ Zdraví', stesti: '🍀 Štěstí', olej: '🪔 Olej v kahanu', zlato: '🪙 Groše' }, P.nazvy);

/* Kostra stránky je společná pro všechny příběhy – obálka HTML má jen <head>. */
document.body.insertAdjacentHTML('afterbegin', `<header class="lista">
  <h1>${esc(P.ikona || '📖')} ${esc(P.nazev)}</h1>
  <div class="skup" role="group" aria-label="Hra"><span class="skup-nazev" aria-hidden="true">Hra</span><div class="skup-tl">
    <button class="tl" data-nabidka="nabHra" aria-expanded="false">🎲<span class="txt"> Hra</span> ▾</button>
  </div></div>
  <div class="skup" role="group" aria-label="Kniha"><span class="skup-nazev" aria-hidden="true">Kniha</span><div class="skup-tl">
    <button class="tl" data-prikaz="denik" title="Navštívené oddíly">📜<span class="txt"> Deník</span></button>
    <button class="tl" data-prikaz="konce" title="Nalezené konce">🏆<span class="txt"> Konce</span></button>
    <button class="tl" data-nabidka="nabZobrazit" aria-expanded="false">Aa<span class="txt"> Písmo</span> ▾</button>
  </div></div>
  <span class="vpravo"><button class="tl" data-prikaz="napoveda" aria-label="Pravidla">❓</button></span>
</header>

<div id="nabHra" class="nabidka" hidden>
  <button class="tl" data-prikaz="nova">✚ Nová hra (nové vlastnosti)</button>
  <button class="tl" data-prikaz="uvod">🏠 Titulní strana</button>
  <hr>
  <div class="titulek">Uložené pozice</div>
  <div id="pozice"></div>
</div>
<div id="nabZobrazit" class="nabidka" hidden>
  <button class="tl" data-pismo="0.95rem">Menší písmo</button>
  <button class="tl" data-pismo="1.06rem">Střední písmo</button>
  <button class="tl" data-pismo="1.22rem">Větší písmo</button>
  <hr>
  <button class="tl" data-prikaz="obrazky" id="prepObr">🖼️ Skrýt ilustrace</button>
</div>

<main id="main"></main>

<dialog class="okno" id="dlg"><form method="dialog">
  <header id="dlgTitul"></header>
  <div class="telo" id="dlgTelo"></div>
  <footer><button class="btn primary" value="ok">Zavřít</button></footer>
</form></dialog>`);
if (window.self === window.top) document.body.classList.add('samostatne');

let ulozene = { hra: null, pozice: [null, null, null], konce: {}, pismo: '1.06rem', obrazky: true };
try { Object.assign(ulozene, JSON.parse(localStorage.getItem(KLIC)) || {}); } catch (e) {}
let st = J.nactiStav(P, ulozene.hra);
let posledni = null;   // výsledek poslední akce (hody, změny) k zobrazení

function uloz() {
  ulozene.hra = st;
  try { localStorage.setItem(KLIC, JSON.stringify(ulozene)); } catch (e) {}
}

/* ---------- vykreslení ---------- */
function popisZmen(zm) {
  return zm.filter(z => z.o).map(z => {
    const t = z.co === 'predmet' ? (z.o > 0 ? '+ ' : '− ') + (P.predmety[z.x] ? P.predmety[z.x].nazev : z.x) : NAZVY[z.co] + ' ' + (z.o > 0 ? '+' : '−') + Math.abs(z.o);
    return `<span class="zmena ${z.o > 0 ? 'plus' : 'minus'}">${esc(t)}</span>`;
  }).join('');
}
function textHtml(t) { return t.split(/\n\n+/).map(o => `<p>${esc(o)}</p>`).join(''); }
function obrazek(klic) {
  return ulozene.obrazky ? `<img class="obraz" src="${OBR}${klic}.webp" alt="" onerror="this.hidden=true">` : '';
}

function panelPostavy() {
  const vl = ['zdravi', 'obratnost', 'stesti', 'olej'].map(v => `<div class="vl"><div class="r"><span>${NAZVY[v]}</span><b>${st[v]} / ${st[v + 'Max']}</b></div>
    <div class="mer ${v}"><i style="width:${Math.round(100 * st[v] / st[v + 'Max'])}%"></i></div></div>`).join('') +
    `<div class="vl"><div class="r"><span>${NAZVY.zlato}</span><b>${st.zlato}</b></div></div>`;
  const pocty = {};
  st.predmety.forEach(x => { pocty[x] = (pocty[x] || 0) + 1; });
  const pr = Object.keys(pocty).map(x => {
    const d = P.predmety[x] || { nazev: x };
    const lze = d.pouziti && !st.konec;
    return `<li title="${esc(d.popis || '')}"><span>${esc(d.nazev)}${pocty[x] > 1 ? ' ×' + pocty[x] : ''}</span>${lze ? `<button class="btn" data-pouzij="${esc(x)}">Použít</button>` : ''}</li>`;
  }).join('');
  return `<aside class="postava" aria-label="Postava"><h2>Postava</h2>${vl}
    <div class="sekce"><h2>Torba</h2>${pr ? `<ul class="predmety">${pr}</ul>` : '<div class="malo">prázdná</div>'}</div></aside>`;
}

function hodHtml(z) {
  if (!z) return '';
  const nazev = { obratnost: 'obratnosti', stesti: 'štěstí' }[z.co] || z.co;
  return `<div class="hod ${z.ok ? 'ok' : 'ne'}">🎲 Zkouška ${nazev}: <span class="kostka">${z.hod[0]}</span>+<span class="kostka">${z.hod[1]}</span> = <b>${z.soucet}</b> ${z.ok ? '≤' : '>'} ${z.hodnota} → <b>${z.ok ? 'úspěch' : 'neúspěch'}</b></div>`;
}

function bojHtml() {
  const b = st.boj;
  const log = b.log.slice().reverse().map(k => `Kolo ${k.kolo}: ty ${k.ja} proti ${k.on} – ${k.vysledek === 'zasah' ? 'zasáhneš (−2 soupeři)' : k.vysledek === 'zraneni' ? 'zasáhne tě (−2 zdraví)' : 'nikdo nezasáhl'}`).join('<br>');
  return `<div class="boj" role="region" aria-label="Souboj"><h3>⚔️ Souboj: ${esc(b.jmeno)}</h3>
    <div class="souperi">
      <div><div class="jm">Ty – zdraví ${st.zdravi}</div><div class="mer zdravi"><i style="width:${Math.round(100 * st.zdravi / st.zdraviMax)}%"></i></div></div>
      <div><div class="jm">${esc(b.jmeno)} – zdraví ${b.zdravi} · obratnost ${b.obratnost}</div><div class="mer zdravi"><i style="width:${Math.round(100 * b.zdravi / b.zdraviMax)}%"></i></div></div>
    </div>
    <div class="malo">Každé kolo: 2 kostky + obratnost. Kdo má víc, zasáhne za 2 zdraví.</div>
    ${log ? `<div class="lista-boje">${log}</div>` : ''}
    <div class="akce"><button class="btn primary" data-boj="kolo">⚔️ Bojovat (kolo ${b.kolo + 1})</button>
    ${b.utek ? '<button class="btn" data-boj="utek">🏃 Utéct (−2 zdraví)</button>' : ''}</div></div>`;
}

function vykresliHru() {
  const s = P.sceny[st.scena];
  let h = '';
  if (posledni) h += hodHtml(posledni.zkouska) + (posledni.boj ? `<div class="hod ${posledni.boj === 'vyhra' ? 'ok' : 'ne'}">⚔️ ${posledni.boj === 'vyhra' ? 'Souboj vyhrán.' : 'Souboj prohrán.'}</div>` : '');
  const zm = (posledni && posledni.zmeny || []).concat(st.posledniZmeny || []);
  const zmH = popisZmen(zm);
  let telo = '';
  if (s.konec) {
    const k = P.konce[s.konec];
    telo = `<div class="konec-stitek ${k.typ}">${k.typ === 'vyhra' ? '🏆' : k.typ === 'prohra' ? '💀' : '🚪'} Konec: ${esc(k.nazev)}</div>` + textHtml(s.text) +
      `<div class="volby"><button class="btn primary" data-prikaz="nova">✚ Hrát znovu (nové vlastnosti)</button><button class="btn" data-prikaz="konce">🏆 Nalezené konce (${Object.keys(ulozene.konce).length}/${Object.keys(P.konce).length})</button></div>`;
  } else {
    telo = textHtml(s.text) + (zmH ? `<div class="zmeny">${zmH}</div>` : '') +
      (st.boj ? bojHtml() : `<div class="volby">${J.volby(st, P).map((o, n) => `<button class="volba" data-volba="${o.i}"><span class="c">${n + 1}.</span><span>${esc(o.v.text)}</span></button>`).join('')}</div>`);
  }
  $('main').innerHTML = `<div class="rozvrh"><article class="kniha">${obrazek(s.obr)}<div class="strana">
    <div class="paragraf">§ ${esc(st.scena)}</div>${h}<div class="text">${telo}</div></div></article>${panelPostavy()}</div>`;
  $('main').scrollTop = 0;
  const prvni = $('main').querySelector('.volba, [data-boj="kolo"]');
  if (prvni && document.activeElement && document.activeElement !== document.body) prvni.focus({ preventScroll: true });
}

function vykresliUvod() {
  st = J.nactiStav(P, ulozene.hra);
  const nalez = Object.keys(ulozene.konce).length;
  $('main').innerHTML = `<div class="uvod"><article class="kniha">${obrazek(P.uvodObr || 'vstup')}<div class="strana">
    <h2>${esc(P.nazev)}</h2><div class="pod">${esc(P.podtitul)}</div>
    <div class="tlacitka">
      ${st && !st.konec ? `<button class="btn primary" data-prikaz="pokracovat">▶ Pokračovat (§ ${esc(st.scena)})</button>` : ''}
      <button class="btn ${st && !st.konec ? '' : 'primary'}" data-prikaz="nova">✚ Nová hra</button>
      <button class="btn" data-prikaz="konce">🏆 Konce ${nalez}/${Object.keys(P.konce).length}</button>
    </div>
    <div class="pravidla">${pravidla()}</div></div></article></div>`;
}

function pravidla() {
  return `<p>Čteš příběh a na konci každého oddílu (§) volíš, co uděláš. Některé volby jsou dostupné jen s určitým předmětem nebo když se ti něco podařilo dřív.</p>
  <p><b>Vlastnosti</b> se hodí na začátku kostkami: obratnost 7–12, zdraví 14–24, štěstí 7–12.</p>
  <p><b>Zkouška</b>: hodíš 2 kostkami; když padne součet menší nebo rovný vlastnosti, uspěješ. Každá zkouška štěstí ho sníží o 1.</p>
  <p><b>Souboj</b> běží po kolech: ty i soupeř hodíte 2 kostkami a přičtete obratnost. Kdo má víc, ubere druhému 2 zdraví.</p>
  <p>${P.pravidlo || '<b>Kahan</b>: v hloubi hory ubývá oleje. Když dojde, zůstaneš ve tmě. <b>Zdraví</b> doplní krajíc chleba z torby.'}</p>
  <p>Hra se ukládá sama; v nabídce Hra jsou navíc tři pozice pro uložení. Najdi všech ${Object.keys(P.konce).length} konců!</p>`;
}

function vykresli() { if (st) vykresliHru(); else vykresliUvod(); }

/* ---------- akce ---------- */
function zapisKonec() { if (st.konec) { const t = P.sceny[st.konec].konec; if (!ulozene.konce[t]) ulozene.konce[t] = new Date().toISOString().slice(0, 10); } }
function poAkci(vysl) { posledni = vysl; zapisKonec(); uloz(); vykresliHru(); }

function zvol(i) { poAkci(J.zvol(st, P, i)); }
function boj(co) {
  if (co === 'utek') { J.utec(st, P); return poAkci({ zmeny: [{ co: 'zdravi', o: -2 }] }); }
  const k = J.koloBoje(st, P);
  if (k.konec) return poAkci({ boj: k.konec });
  posledni = null; st.posledniZmeny = []; uloz(); vykresliHru();
}
function pouzij(x) { const zm = J.pouzij(st, P, x); posledni = { zmeny: zm }; st.posledniZmeny = []; uloz(); vykresliHru(); }

async function novaHra() {
  if (st && !st.konec && !await Dialog.potvrd('Začít novou hru? Rozehraná hra se přepíše (uložené pozice zůstanou).')) return;
  st = J.novaHra(P); posledni = null; uloz(); vykresliHru();
  Dialog.info(`Tvoje vlastnosti: obratnost ${st.obratnost}, zdraví ${st.zdravi}, štěstí ${st.stesti}.`);
}

function okno(titul, html) { $('dlgTitul').textContent = titul; $('dlgTelo').innerHTML = html; $('dlg').showModal(); }

function vykresliPozice() {
  $('pozice').innerHTML = [0, 1, 2].map(i => {
    const p = ulozene.pozice[i];
    const popis = p ? `§ ${esc(p.hra.scena)} · ${esc(p.kdy)}` : 'prázdná';
    return `<button class="tl" data-ulozit="${i}" ${st && !st.konec ? '' : 'disabled'}>💾 Uložit do pozice ${i + 1}</button>
      <button class="tl" data-nacist="${i}" ${p ? '' : 'disabled'}>📂 Načíst ${i + 1} <small style="color:var(--text-faint)">(${popis})</small></button>`;
  }).join('<hr>');
}

const PRIKAZY = {
  nova: novaHra,
  pokracovat: () => { posledni = null; vykresliHru(); },
  uvod: () => { posledni = null; st = null; vykresliUvod(); },
  napoveda: () => okno('❓ Pravidla', pravidla()),
  denik: () => {
    if (!st) return okno('📜 Deník', '<p>Cesta ještě nezačala.</p>');
    const prvni = s => (P.sceny[s].text.split(/[.!?…]/)[0] || '').slice(0, 90);
    okno('📜 Deník cesty', `<ol class="denik">${st.denik.map(s => `<li>§ ${esc(s)} – ${esc(prvni(s))}…</li>`).join('')}</ol>`);
  },
  konce: () => okno('🏆 Konce', `<ul class="konce-seznam">${Object.entries(P.konce).map(([id, k]) =>
    ulozene.konce[id] != null ? `<li>${k.typ === 'vyhra' ? '🏆' : k.typ === 'prohra' ? '💀' : '🚪'} <b>${esc(k.nazev)}</b> – ${esc(k.popis)}</li>` : `<li class="ne">❔ ${esc(k.popis)} – zatím nenalezeno</li>`).join('')}</ul>`),
  obrazky: () => { ulozene.obrazky = !ulozene.obrazky; uloz(); nastavZobrazeni(); vykresli(); }
};

function nastavZobrazeni() {
  document.body.style.setProperty('--pismo', ulozene.pismo);
  $('prepObr').textContent = ulozene.obrazky ? '🖼️ Skrýt ilustrace' : '🖼️ Zobrazit ilustrace';
  document.querySelectorAll('[data-pismo]').forEach(b => b.setAttribute('aria-pressed', b.dataset.pismo === ulozene.pismo));
}

/* ---------- události ---------- */
function zavriNabidky() {
  document.querySelectorAll('.nabidka:not([hidden])').forEach(n => { n.hidden = true; });
  document.querySelectorAll('[data-nabidka][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
}
document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => {
  e.stopPropagation();
  const n = $(b.dataset.nabidka), bylo = !n.hidden;
  zavriNabidky();
  if (bylo) return;
  if (n.id === 'nabHra') vykresliPozice();
  n.hidden = false; b.setAttribute('aria-expanded', 'true');
  const r = b.getBoundingClientRect();
  n.style.top = (r.bottom + 4) + 'px';
  n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
}));
document.addEventListener('click', async e => {
  const t = e.target.closest('button');
  if (!t) { if (!e.target.closest('.nabidka')) zavriNabidky(); return; }
  const d = t.dataset;
  if (t.closest('.nabidka') || d.prikaz) zavriNabidky();
  if (d.prikaz) return PRIKAZY[d.prikaz]();
  if (d.volba != null) return zvol(+d.volba);
  if (d.boj) return boj(d.boj);
  if (d.pouzij) return pouzij(d.pouzij);
  if (d.pismo) { ulozene.pismo = d.pismo; uloz(); return nastavZobrazeni(); }
  if (d.ulozit != null) {
    ulozene.pozice[+d.ulozit] = { hra: JSON.parse(JSON.stringify(st)), kdy: new Date().toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) };
    uloz(); return Dialog.info('Uloženo do pozice ' + (+d.ulozit + 1) + '.');
  }
  if (d.nacist != null) {
    const p = ulozene.pozice[+d.nacist], s = p && J.nactiStav(P, JSON.parse(JSON.stringify(p.hra)));
    if (!s) return Dialog.chyba('Pozice je prázdná nebo poškozená.');
    if (st && !st.konec && !await Dialog.potvrd('Načíst pozici? Rozehraná hra se přepíše.')) return;
    st = s; posledni = null; uloz(); return vykresliHru();
  }
});
addEventListener('resize', zavriNabidky);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') return zavriNabidky();
  if (!st || $('dlg').open || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  if (/^[1-9]$/.test(e.key)) {
    const b = $('main').querySelectorAll('.volba')[+e.key - 1];
    if (b) { e.preventDefault(); b.click(); }
  } else if ((e.key === ' ' || e.key === 'b') && st.boj) { e.preventDefault(); boj('kolo'); }
});

nastavZobrazeni();
vykresliUvod();
window.GAMEBOOK_APP = { stav: () => st, prekresli: () => { posledni = null; uloz(); vykresli(); } };
})();
