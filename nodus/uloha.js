/* ============================================================
   uloha.js – společné chování procvičovacích úloh.

   Pravidlo pro všechny stránky, kde se odpovídá klepnutím na možnost:
     • špatná odpověď → prvek se zaklepe, zčervená a hned zase zbledne,
       otázka běží dál a dítě může zkusit znovu,
     • správná odpověď → prvek zezelená a po krátké pauze se sama nabídne
       další otázka. Tlačítko „Další“ tak není potřeba mačkat.

   Do skóre se počítá jen odpověď napoprvé (stav.chyboval).
   ============================================================ */
const Uloha = (function () {
  const PRODLEVA = 900;      // ms mezi správnou odpovědí a další otázkou
  const BLIK = 420;          // ms, po které svítí červená u chybné odpovědi

  function pauza(prodleva, napoprve) {
    if (typeof prodleva === 'function') return prodleva(napoprve);
    return prodleva || PRODLEVA;
  }

  function trhni(prvek) {
    if (!prvek) return;
    prvek.classList.remove('trhni');
    void prvek.offsetWidth;   // vynutí restart animace i při rychlém klikání
    prvek.classList.add('trhni');
    setTimeout(() => prvek.classList.remove('trhni'), BLIK);
  }

  /* Vyhodnotí jeden klik na možnost.
     volby = {
       prvek        – element, na který se kleplo
       spravne      – true/false
       stav         – objekt otázky, drží { chyboval, hotovo }
       odezva       – element pro text zpětné vazby (nepovinné)
       zpravaOk     – text při správné odpovědi
       zpravaChyba  – text při chybě
       poSpravne(napoprve) – zavolá se při správné odpovědi
       dalsi        – funkce, která připraví další otázku
       prodleva     – ms do další otázky, nebo funkce (napoprve) => ms
     }
     Vrací true, když byla odpověď správná. */
  function odpoved(volby) {
    const { prvek, spravne, stav, odezva } = volby;
    if (!stav || stav.hotovo) return false;

    if (!spravne) {
      stav.chyboval = true;
      trhni(prvek);
      prvek.classList.add('spatne');
      setTimeout(() => prvek.classList.remove('spatne'), BLIK);
      if (odezva) {
        odezva.className = 'odezva chyba';
        odezva.textContent = volby.zpravaChyba || 'Ještě ne – zkus jinou možnost.';
      }
      return false;
    }

    stav.hotovo = true;
    prvek.classList.add('spravne');
    if (odezva) {
      odezva.className = 'odezva ok';
      odezva.textContent = volby.zpravaOk || '✅ Správně!';
    }
    if (volby.poSpravne) volby.poSpravne(!stav.chyboval);
    // Stránky s kartičkou „proč“ potřebují delší pauzu než holé ✅ – prodleva
    // proto smí být i funkce, která ji spočítá podle toho, zda žák chyboval.
    if (volby.dalsi) setTimeout(volby.dalsi, pauza(volby.prodleva, !stav.chyboval));
    return true;
  }

  /* ---- pomůcky, které opakovaně potřebuje každá aplikace ---------------- */
  function zamichej(pole) {
    const p = [...pole];
    for (let i = p.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    return p;
  }
  const nahodne = pole => pole[Math.floor(Math.random() * pole.length)];
  const nahodneCislo = (od, do_) => od + Math.floor(Math.random() * (do_ - od + 1));

  /* Postaví řádek s možnostmi a rovnou napojí vyhodnocení.
     moznosti: [{ klic, popis, ikona? }] */
  function vyber(volby) {
    const m = document.createElement('div');
    m.className = 'moznosti' + (volby.trida ? ' ' + volby.trida : '');
    const stav = { chyboval: false, hotovo: false };
    volby.moznosti.forEach(v => {
      const b = document.createElement('button');
      b.dataset.klic = v.klic;
      b.innerHTML = (v.ikona ? `<span class="ikona">${v.ikona}</span>` : '') + `<span>${v.popis}</span>`;
      b.addEventListener('click', () => odpoved({
        prvek: b,
        spravne: v.klic === volby.spravnyKlic,
        stav,
        odezva: volby.odezva,
        zpravaOk: volby.zpravaOk,
        zpravaChyba: volby.zpravaChyba,
        poSpravne: volby.poSpravne,
        dalsi: volby.dalsi,
        prodleva: volby.prodleva,
      }));
      m.appendChild(b);
    });
    if (volby.kam) volby.kam.appendChild(m);
    return { prvek: m, stav };
  }

  /* Deník činnosti: kdy a nad čím žák pracoval.

     Studijní deník dřív nevěděl nic – všechno si musel uživatel naklikat ručně.
     Klíč skóre se ale nedá spolehlivě přeložit na stránku (část jich má zkrácený
     tvar), proto si zapisujeme rovnou název souboru z adresy. Ten je vždy přesný
     a deník si k němu předmět dohledá v katalogu. */
  const DENIK = 'nodus_aktivita';

  function nazevStranky() {
    const cast = location.pathname.split('/').pop();
    return cast || 'neznamo';
  }

  function zapisAktivitu(napoprve) {
    try {
      const den = new Date();
      // lokální datum, ne UTC – jinak by se večerní procvičování počítalo na zítřek
      const klicDne = den.getFullYear() + '-' +
        String(den.getMonth() + 1).padStart(2, '0') + '-' +
        String(den.getDate()).padStart(2, '0');
      const data = JSON.parse(localStorage.getItem(DENIK) || '{}');
      const dnes = data[klicDne] || (data[klicDne] = {});
      const zaznam = dnes[nazevStranky()] || (dnes[nazevStranky()] = { ok: 0, pokusy: 0 });
      zaznam.pokusy++;
      if (napoprve) zaznam.ok++;
      // deník držíme na posledních 120 dnech, ať localStorage neroste donekonečna
      const dny = Object.keys(data).sort();
      while (dny.length > 120) delete data[dny.shift()];
      localStorage.setItem(DENIK, JSON.stringify(data));
    } catch { /* soukromé okno nebo plné úložiště – deník prostě nevznikne */ }
  }

  /* Skóre uložené v localStorage; počítá se odpověď napoprvé. */
  function skore(klic, prvek) {
    let spravne = 0, pokusy = 0;
    try {
      const ulozene = JSON.parse(localStorage.getItem(klic));
      if (ulozene) { spravne = ulozene.spravne; pokusy = ulozene.pokusy; }
    } catch { /* bez trvalé paměti */ }

    function zobraz() {
      if (prvek) prvek.innerHTML = `Správně: <b>${spravne}</b> z ${pokusy}`;
    }
    function vyhodnot(napoprve) {
      pokusy++;
      if (napoprve) spravne++;
      try { localStorage.setItem(klic, JSON.stringify({ spravne, pokusy })); } catch { /* nevadí */ }
      zapisAktivitu(napoprve);
      zobraz();
    }
    zobraz();
    return { vyhodnot, zobraz };
  }

  return { odpoved, trhni, vyber, skore, zamichej, nahodne, nahodneCislo, zapisAktivitu, DENIK, PRODLEVA };
})();
