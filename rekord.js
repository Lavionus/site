/* ============================================================
   rekord.js – sdílené osobní rekordy her.

   Hry na webu si donedávna nepamatovaly vůbec nic; tenhle modul
   sjednocuje ukládání i vzhled, aby to nemusela každá hra řešit znovu.

   Použití:
     const rek = Rekord.sleduj('webapp_hra_minesweeper', {
       vyssiLepsi: false,              // false = nižší hodnota je lepší (čas, tahy)
       format: v => v + ' s',          // jak se hodnota vypíše
       popisek: 'Nejlepší čas',        // text před hodnotou
     });
     rek.prvek(document.getElementById('rekordBox'));  // vykreslí řádek s ↺
     if (rek.zapis(seconds)) { … }     // true = padl nový rekord

   Klíče držíme v jednom jmenném prostoru `webapp_hra_*`, ať jdou
   případně hromadně vypsat nebo smazat.
   ============================================================ */
const Rekord = (function () {

  function cti(klic) {
    try {
      const v = localStorage.getItem(klic);
      if (v === null) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    } catch { return null; }   // soukromé okno / file:// / zakázané úložiště
  }

  function zapisSyrove(klic, hodnota) {
    try { localStorage.setItem(klic, String(hodnota)); } catch { /* nevadí, jen se nezapamatuje */ }
  }

  function sleduj(klic, volby) {
    const o = Object.assign({
      vyssiLepsi: true,
      format: v => String(v),
      popisek: 'Nejlepší',
      prazdny: '—',
    }, volby || {});

    let nejlepsi = cti(klic);
    let box = null;

    function lepsi(a, b) {
      if (b === null) return true;
      return o.vyssiLepsi ? a > b : a < b;
    }

    function zobraz() {
      if (!box) return;
      const val = box.querySelector('.rekord-v');
      if (val) val.textContent = nejlepsi === null ? o.prazdny : o.format(nejlepsi);
      const btn = box.querySelector('.rekord-reset');
      if (btn) btn.style.visibility = nejlepsi === null ? 'hidden' : 'visible';
    }

    /* Uloží hodnotu, pokud je lepší než dosavadní rekord.
       Vrací true, když opravdu padl nový rekord (hra na to může zareagovat). */
    function zapis(hodnota) {
      const n = Number(hodnota);
      if (!Number.isFinite(n)) return false;
      if (!lepsi(n, nejlepsi)) return false;
      nejlepsi = n;
      zapisSyrove(klic, n);
      zobraz();
      if (box) {
        box.classList.remove('rekord-novy');
        void box.offsetWidth;        // vynutí restart animace při rychlém opakování
        box.classList.add('rekord-novy');
      }
      return true;
    }

    function vynuluj() {
      nejlepsi = null;
      try { localStorage.removeItem(klic); } catch { /* nevadí */ }
      zobraz();
    }

    /* Vykreslí do zadaného elementu řádek „🏆 Nejlepší: … ↺“. */
    function prvek(el) {
      if (!el) return api;
      box = el;
      box.classList.add('rekord');
      box.innerHTML =
        '<span class="rekord-ic" aria-hidden="true">🏆</span>' +
        '<span class="rekord-l"></span>' +
        '<b class="rekord-v"></b>' +
        '<button type="button" class="rekord-reset" title="Vynulovat rekord">↺</button>';
      box.querySelector('.rekord-l').textContent = o.popisek + ':';
      box.querySelector('.rekord-reset').addEventListener('click', vynuluj);
      zobraz();
      return api;
    }

    const api = { zapis, vynuluj, prvek, zobraz, hodnota: () => nejlepsi };
    return api;
  }

  /* Styl vkládáme z JS, ať stačí stránce jediný <script> a nemusí
     se do každé hry kopírovat pravidla. */
  function vlozStyl() {
    if (document.getElementById('rekord-styl')) return;
    const st = document.createElement('style');
    st.id = 'rekord-styl';
    st.textContent = `
.rekord{display:inline-flex;align-items:center;gap:6px;font-size:.85rem;
  color:var(--text-faint,#888);background:var(--bg-elevated,#2d2d2d);
  border:1px solid var(--border,#404040);border-radius:999px;padding:5px 10px 5px 12px}
.rekord .rekord-v{color:var(--text,#e0e0e0);font-variant-numeric:tabular-nums}
.rekord .rekord-reset{background:none;border:none;color:var(--text-faint,#888);
  cursor:pointer;font-size:1rem;line-height:1;padding:0 2px;border-radius:4px}
.rekord .rekord-reset:hover{color:var(--danger,#e05d5d)}
.rekord.rekord-novy{animation:rekord-puls .9s ease-out}
@keyframes rekord-puls{
  0%{box-shadow:0 0 0 0 var(--accent-soft,rgba(106,166,253,.35))}
  60%{box-shadow:0 0 0 10px transparent}
  100%{box-shadow:0 0 0 0 transparent}}
@media (prefers-reduced-motion: reduce){.rekord.rekord-novy{animation:none}}`;
    (document.head || document.documentElement).appendChild(st);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', vlozStyl);
  else vlozStyl();

  return { sleduj };
})();
