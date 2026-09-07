/* ============================================================
   uloha.js – společné chování procvičovacích úloh.

   Pravidlo pro všechny stránky, kde se odpovídá klepnutím na možnost:
     • špatná odpověď → prvek se zaklepe, zčervená a hned zase zbledne,
       otázka běží dál a dítě může zkusit znovu,
     • správná odpověď → prvek zezelená a po krátké pauze se sama nabídne
       další otázka. Tlačítko „Další“ tak není potřeba mačkat.

   Do skóre se počítá jen odpověď napoprvé (stav.chyboval).

   Jak dlouho se čeká, si řídí uživatel: stránky ukazují po odpovědi kartičku
   s vysvětlením „proč“ a každý ji čte jinak rychle. Volba je společná pro celý
   Nodus (localStorage `nodus_posun`) a ovládá se tlačítkem, které se samo
   objeví v liště ovládání každé procvičovací stránky.
   ============================================================ */
const Uloha = (function () {
  const PRODLEVA = 900;      // ms mezi správnou odpovědí a další otázkou
  const BLIK = 420;          // ms, po které svítí červená u chybné odpovědi

  /* ---- nastavení posunu na další otázku --------------------------------
     Stránky si samy počítají, jak dlouhá pauza jejich kartičce sluší (holé ✅
     potřebuje míň času než rozbor souvětí). Uživatelská volba proto tu pauzu
     jen **násobí** – tím zůstane zachovaný poměr mezi krátkými a dlouhými
     vysvětleními a nemusí se sahat do jednotlivých stránek. */
  const NASTAVENI_KLIC = 'nodus_posun';
  const TEMPA = {
    normal: { nasobek: 1, popis: 'normálně' },
    dele:   { nasobek: 1.8, popis: 'déle' },
    dlouho: { nasobek: 3, popis: 'hodně dlouho' },
  };
  const VYCHOZI = { rezim: 'auto', tempo: 'normal' };
  let nastaveni = { ...VYCHOZI };
  try {
    const ulozene = JSON.parse(localStorage.getItem(NASTAVENI_KLIC) || 'null');
    if (ulozene && TEMPA[ulozene.tempo] && (ulozene.rezim === 'auto' || ulozene.rezim === 'rucne')) {
      nastaveni = { rezim: ulozene.rezim, tempo: ulozene.tempo };
    }
  } catch { /* soukromé okno – jede se s výchozím nastavením */ }

  const posluchaciNastaveni = [];
  function ulozNastaveni() {
    try { localStorage.setItem(NASTAVENI_KLIC, JSON.stringify(nastaveni)); } catch { /* nevadí */ }
    posluchaciNastaveni.forEach(f => f(nastaveni));
  }

  function pauza(prodleva, napoprve) {
    const zaklad = typeof prodleva === 'function' ? prodleva(napoprve) : (prodleva || PRODLEVA);
    return Math.round(zaklad * TEMPA[nastaveni.tempo].nasobek);
  }

  /* Posun na další otázku – buď sám po pauze, nebo až na klepnutí.
     Volá se odsud i z procvic.js, aby volba platila i tam. */
  function posun(dalsi, prodleva, napoprve, kotva) {
    if (!dalsi) return;
    if (nastaveni.rezim === 'auto') { setTimeout(dalsi, pauza(prodleva, napoprve)); return; }
    nabidniPokracovat(dalsi, kotva);
  }

  /* V ručním režimu se místo časovače nabídne tlačítko. Vkládá se až za
     kartičku s vysvětlením, protože ta vzniká dřív (v poSpravne). */
  function nabidniPokracovat(dalsi, kotva) {
    const kam = (kotva && kotva.parentElement) || document.querySelector('.plocha');
    if (!kam || kam.querySelector(':scope > .pokracovat')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pokracovat';
    b.textContent = 'Pokračovat →';
    b.addEventListener('click', dalsi);
    kam.appendChild(b);
    /* Klávesnicí se dá pokračovat rovnou – stránky mají Enter navázaný na svou
       novou úlohu, takže tlačítko se stejně smaže s obsahem plochy. */
    b.focus({ preventScroll: true });
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
    posun(volby.dalsi, volby.prodleva, !stav.chyboval, volby.odezva || prvek);
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

  /* ---- ovládání posunu na stránce -------------------------------------
     Prvek se vkládá odsud, ne do jednotlivých stránek: je jich přes sto
     osmdesát a volba má být na všech stejná a na stejném místě. Styly si
     modul nese s sebou, protože pár stránek `vyuka.css` nelinkuje. */
  const STYL = `
    .posun-obal { position: relative; display: inline-flex; }
    .posun-obal > button.posun-prepinac {
      background: var(--bg-control); border: 1px solid var(--border-strong); color: var(--text-muted);
      border-radius: 6px; padding: 10px 14px; font-size: 0.9rem; font-family: inherit; cursor: pointer;
    }
    .posun-obal > button.posun-prepinac:hover { border-color: var(--accent); color: var(--text); }
    .posun-nabidka {
      position: absolute; bottom: calc(100% + 6px); left: 0; z-index: 30; min-width: 246px;
      background: var(--bg-panel); border: 1px solid var(--border-strong); border-radius: 10px;
      padding: 6px; box-shadow: 0 8px 26px rgba(0, 0, 0, 0.35);
    }
    .posun-nabidka[hidden] { display: none; }
    .posun-nabidka h3 {
      font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--text-faint); font-weight: 600; padding: 7px 9px 4px;
    }
    .posun-nabidka button {
      display: block; width: 100%; text-align: left; background: none; border: none;
      border-radius: 6px; padding: 8px 9px; font-size: 0.88rem; font-family: inherit;
      color: var(--text); cursor: pointer;
    }
    .posun-nabidka button:hover { background: var(--bg-hover); }
    .posun-nabidka button.vybrano { background: var(--accent-soft); color: var(--text); font-weight: 600; }
    .posun-nabidka .vysvetlivka {
      color: var(--text-faint); font-size: 0.75rem; line-height: 1.4; padding: 6px 9px 8px;
    }
    button.pokracovat {
      background: var(--accent); border: 1px solid var(--accent); color: #fff; font-weight: 600;
      border-radius: 8px; padding: 10px 20px; font-size: 0.95rem; font-family: inherit;
      cursor: pointer; margin-top: 4px;
    }
    button.pokracovat:hover { background: var(--accent-hover); }`;

  const VOLBY = [
    { rezim: 'auto', tempo: 'normal', popis: '▶️ Automaticky – normálně' },
    { rezim: 'auto', tempo: 'dele', popis: '▶️ Automaticky – déle na čtení' },
    { rezim: 'auto', tempo: 'dlouho', popis: '▶️ Automaticky – hodně dlouho' },
    { rezim: 'rucne', tempo: 'normal', popis: '✋ Ručně – čekat na „Pokračovat“' },
  ];

  function popisekTlacitka() {
    return nastaveni.rezim === 'rucne'
      ? '⏱️ Posun: ručně'
      : '⏱️ Posun: ' + TEMPA[nastaveni.tempo].popis;
  }

  function vlozOvladani() {
    const lista = document.querySelector('.ovladani, .lista, #ovladani');
    if (!lista || document.querySelector('.posun-obal')) return;

    const styl = document.createElement('style');
    styl.textContent = STYL;
    document.head.appendChild(styl);

    const obal = document.createElement('span');
    obal.className = 'posun-obal';
    const prepinac = document.createElement('button');
    prepinac.type = 'button';
    prepinac.className = 'posun-prepinac';
    prepinac.title = 'Jak rychle přejít na další otázku';
    const nabidka = document.createElement('div');
    nabidka.className = 'posun-nabidka';
    nabidka.hidden = true;
    nabidka.innerHTML = '<h3>Po odpovědi</h3>';

    VOLBY.forEach(v => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = v.popis;
      b.addEventListener('click', () => {
        nastaveni = { rezim: v.rezim, tempo: v.tempo };
        ulozNastaveni();
        nabidka.hidden = true;
      });
      v.prvek = b;
      nabidka.appendChild(b);
    });
    const vysvetlivka = document.createElement('p');
    vysvetlivka.className = 'vysvetlivka';
    vysvetlivka.textContent = 'Platí pro všechna procvičování v Nodusu. Ručně se hodí, '
      + 'když si chceš v klidu přečíst, proč je odpověď správně.';
    nabidka.appendChild(vysvetlivka);

    prepinac.addEventListener('click', e => {
      e.stopPropagation();
      nabidka.hidden = !nabidka.hidden;
    });
    document.addEventListener('click', e => {
      if (!obal.contains(e.target)) nabidka.hidden = true;
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') nabidka.hidden = true;
    });

    obal.append(prepinac, nabidka);
    /* Vkládá se před ukazatel skóre, aby lišta zůstala vlevo pohromadě
       (skóre má margin-left:auto a drží se u pravého okraje). */
    const skoreEl = lista.querySelector('.skore, .serie, .pocitadlo');
    lista.insertBefore(obal, skoreEl || null);

    priNastaveni(() => {
      prepinac.textContent = popisekTlacitka();
      VOLBY.forEach(v => v.prvek.classList.toggle('vybrano',
        v.rezim === nastaveni.rezim && (v.rezim === 'rucne' || v.tempo === nastaveni.tempo)));
    });
  }

  function priNastaveni(f) { posluchaciNastaveni.push(f); f(nastaveni); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', vlozOvladani);
  } else {
    vlozOvladani();
  }

  return {
    odpoved, trhni, vyber, skore, zamichej, nahodne, nahodneCislo, zapisAktivitu,
    DENIK, PRODLEVA, posun, pauza,
    nastaveni: () => ({ ...nastaveni }),
    nastav: zmena => { nastaveni = { ...nastaveni, ...zmena }; ulozNastaveni(); },
    priNastaveni,
    TEMPA,
  };
})();
