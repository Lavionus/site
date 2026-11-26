/* Průvodce stránkou (window.XLV_PRUVODCE): při první návštěvě ukáže, kde co je.
   Kroky = {cil: CSS selektor (bez něj uprostřed), nadpis, text}. Zvýraznění = rámeček s tmavým okolím. */
(function () {
'use strict';
const KROKY = [
  { nadpis: '👋 Vítejte v kurzu vzorců', text: 'Za minutu vám ukážu, kde co na stránce najdete. Průvodce kdykoli zavřete klávesou Esc a znovu ho spustíte tlačítkem 🧭 Průvodce vpravo nahoře.' },
  { cil: '#btnLekce', nadpis: '📘 Lekce', text: 'Seznam 14 lekcí od prvního vzorce přes vyhledávání, chyby a tabulky po závěrečnou fakturu. Šipkami vedle přecházíte na předchozí a další lekci. U každé lekce vidíte, kolik úloh máte splněno.' },
  { cil: '.lista [aria-label="Režim"]', nadpis: '🎓 Režimy stránky', text: 'Výuka = lekce s výkladem. Procvičování = nekonečné úlohy a zkouška na čas. Rozbor vzorce = vložíte vlastní vzorec a stránka ho vysvětlí. Pískoviště = volný sešit. Tahák = přehled funkcí. Učitel = vlastní sady úloh.' },
  { cil: '#vyklad h2', nadpis: '📖 Výklad', text: 'Vlevo je výklad lekce. Čtěte postupně – na konci lekce čekají otázky „Co vrátí vzorec?“ a úlohy.' },
  { cil: '#vyklad button.vz', nadpis: '▸ Klikací ukázky', text: 'Každý vzorec v rámečku se šipkou je klikací. Po kliknutí se rozloží v dílně vpravo a uvidíte, jak ho Excel počítá krok za krokem.' },
  { cil: '.radek-vzorce', nadpis: 'ƒx Řádek vzorců', text: 'Sem píšete hodnotu nebo vzorec vybrané buňky. Vzorec začíná znakem =. Odkazy se barevně zvýrazní, pod řádkem se nabízejí funkce a jejich argumenty. Klávesa F4 přidá znak $.' },
  { cil: '#mrizkaObal', nadpis: '▦ List', text: 'Živý list jako v Excelu. Klikněte na buňku a pište, Enter potvrdí. Při psaní vzorce klikněte na jinou buňku a vloží se její adresa. Čtvereček v rohu výběru táhněte pro kopírování.' },
  { cil: '.lista-formatu', nadpis: '🛠 Nástroje listu', text: 'Zpět a Znovu, formát čísel, tučné písmo, zobrazení vzorců, podmíněné formátování, názvy, vkládání řádků a řazení, šipky k předchůdcům a následníkům.' },
  { cil: '#rozklad', nadpis: '🔍 Rozklad vzorce', text: 'Srdce stránky: vybraný vzorec se tu počítá krok za krokem. Strom ukáže, co je argumentem čeho. Další záložky: závislosti, kontrola chyb celého listu a kukátko.' },
  { cil: '#vyklad .uloha', nadpis: '✍️ Úlohy', text: 'Vzorec napište do šrafované buňky v listu a klikněte na Zkontrolovat. Kontrola ho vyzkouší i se změněnými daty, takže opsaný výsledek neprojde. Když si nevíte rady, je tu nápověda.' },
  { cil: '#btnSoubor', nadpis: '📁 Soubor', text: 'Ukládání sešitů, otevření souboru z Excelu (.xlsx, .ods, .csv), stažení do Excelu a sdílení odkazem.' },
  { cil: '#jazyk', nadpis: '🇨🇿 Zápis vzorců', text: 'Český Excel píše funkce česky a argumenty odděluje středníkem, anglický anglicky a čárkou. Přepínač přeloží všechny vzorce na stránce.' },
  { cil: '#btnPruvodce', nadpis: '🧭 To je vše', text: 'Průvodce najdete tady, podrobnou nápovědu s klávesovými zkratkami pod otazníkem vedle. Hodně štěstí se vzorci!' },
];
let i = 0, vrstva = null, bublina = null, ramecek = null, priZavreni = null, puvodniFokus = null;
const viditelny = el => el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
function cilKroku(k) { if (!k.cil) return null; const el = document.querySelector(k.cil); return viditelny(el) ? el : null; }
function vytvor() {
  vrstva = document.createElement('div'); vrstva.className = 'pruvodce-vrstva';
  ramecek = document.createElement('div'); ramecek.className = 'pruvodce-ramecek';
  bublina = document.createElement('div'); bublina.className = 'pruvodce-bublina';
  bublina.setAttribute('role', 'dialog'); bublina.setAttribute('aria-modal', 'true'); bublina.setAttribute('aria-labelledby', 'pruvodceNadpis');
  bublina.innerHTML = `<div class="pruvodce-hlava"><b id="pruvodceNadpis"></b><span class="pruvodce-poradi"></span></div><p class="pruvodce-text"></p>
    <div class="pruvodce-akce"><button class="btn mini" data-pr="zavri">Přeskočit</button><span></span><button class="btn mini" data-pr="zpet">◀ Zpět</button><button class="btn hlavni mini" data-pr="dal">Další ▶</button></div>`;
  vrstva.addEventListener('click', e => { if (e.target === vrstva) dalsi(); });
  bublina.addEventListener('click', e => { const b = e.target.closest('[data-pr]'); if (!b) return; ({ zavri: zavri, zpet: () => ukaz(i - 1), dal: dalsi })[b.dataset.pr](); });
  document.body.append(vrstva, ramecek, bublina);
  document.addEventListener('keydown', klavesy, true);
  addEventListener('resize', polohuj); addEventListener('scroll', polohuj, true);
}
function klavesy(e) {
  if (!bublina) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); zavri(); }
  else if (e.key === 'ArrowRight' || (e.key === 'Enter' && !e.target.closest('.pruvodce-bublina button'))) { e.preventDefault(); e.stopPropagation(); dalsi(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); ukaz(i - 1); }
  else if (e.key === 'Tab') {   /* fokus zůstává v bublině */
    const t = [...bublina.querySelectorAll('button')].filter(b => !b.disabled && !b.hidden), a = t.indexOf(document.activeElement);
    e.preventDefault(); t[(a + (e.shiftKey ? -1 : 1) + t.length) % t.length].focus();
  }
}
function polohuj() {
  if (!bublina) return;
  const el = cilKroku(KROKY[i]), m = 8;
  if (!el) {
    ramecek.hidden = true; vrstva.classList.add('tma');
    bublina.style.left = Math.max(8, (innerWidth - bublina.offsetWidth) / 2) + 'px';
    bublina.style.top = Math.max(8, (innerHeight - bublina.offsetHeight) / 2) + 'px';
    return;
  }
  vrstva.classList.remove('tma'); ramecek.hidden = false;
  const r = el.getBoundingClientRect();
  const top = Math.max(4, r.top - m), left = Math.max(4, r.left - m);
  const w = Math.min(innerWidth - left - 4, r.width + 2 * m), h = Math.min(innerHeight - top - 4, r.height + 2 * m);
  Object.assign(ramecek.style, { top: top + 'px', left: left + 'px', width: w + 'px', height: h + 'px' });
  const bw = bublina.offsetWidth, bh = bublina.offsetHeight;
  let y = top + h + 10;
  if (y + bh > innerHeight - 8) y = top - bh - 10;
  if (y < 8) y = Math.min(innerHeight - bh - 8, Math.max(8, top + 10));
  bublina.style.top = y + 'px';
  bublina.style.left = Math.min(innerWidth - bw - 8, Math.max(8, left)) + 'px';
}
function ukaz(n, smer = n < i ? -1 : 1) {
  if (n < 0 || n >= KROKY.length) return;
  /* krok, jehož prvek teď na stránce není (ukázky a úlohy mimo lekci), se přeskočí */
  while (KROKY[n].cil && !cilKroku(KROKY[n]) && n + smer >= 0 && n + smer < KROKY.length) n += smer;
  if (KROKY[n].cil && !cilKroku(KROKY[n]) && n !== KROKY.length - 1) return;
  i = n;
  const k = KROKY[i], el = cilKroku(k);
  bublina.querySelector('#pruvodceNadpis').textContent = k.nadpis;
  bublina.querySelector('.pruvodce-text').textContent = k.text;
  bublina.querySelector('.pruvodce-poradi').textContent = `${i + 1} / ${KROKY.length}`;
  bublina.querySelector('[data-pr="zpet"]').disabled = !KROKY.slice(0, i).some(k => !k.cil || cilKroku(k));
  bublina.querySelector('[data-pr="dal"]').textContent = i === KROKY.length - 1 ? 'Hotovo ✓' : 'Další ▶';
  bublina.querySelector('[data-pr="zavri"]').hidden = i === KROKY.length - 1;
  if (el) el.scrollIntoView({ block: 'center', inline: 'nearest' });
  requestAnimationFrame(() => { if (!bublina) return; polohuj(); bublina.querySelector('[data-pr="dal"]').focus({ preventScroll: true }); });
}
function dalsi() { if (i >= KROKY.length - 1) zavri(); else ukaz(i + 1); }
function zavri() {
  if (!bublina) return;
  document.removeEventListener('keydown', klavesy, true);
  removeEventListener('resize', polohuj); removeEventListener('scroll', polohuj, true);
  vrstva.remove(); ramecek.remove(); bublina.remove(); vrstva = bublina = ramecek = null;
  if (puvodniFokus && puvodniFokus.focus) puvodniFokus.focus({ preventScroll: true });
  if (priZavreni) priZavreni();
}
function spust(volby = {}) {
  if (bublina) return;
  priZavreni = volby.priZavreni || null; puvodniFokus = document.activeElement;
  vytvor(); i = 0; ukaz(0, 1);
}
window.XLV_PRUVODCE = { spust, zavri, get aktivni() { return !!bublina; }, get krok() { return i; }, KROKY };
})();
