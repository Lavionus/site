/* ============================================================
   projektor.js – zvětšení stránky pro projektor nebo interaktivní tabuli.

   Zvětšuje se RÁM, ne obsah v něm: rámu se nastaví rozměr zmenšený
   o zvolený násobek a přes `transform: scale()` se vykreslí na celou
   plochu. Stránka uvnitř tak vidí menší okno, rozloží se podle něj
   (`100vh`, `@media`, pružné mřížky fungují jako na menším displeji)
   a teprve výsledek se zvětší.

   Zkoušelo se i `zoom` vložené do dokumentu v rámu – u stránek, které
   staví na `100vh` (a takových je tu většina: plátna, mapy, glóbusy),
   se plocha zvětšila i na výšku a stránka začala přetékat a rolovat.
   Škálování rámu tuhle past nemá.

   Cena: plátno se roztáhne jako obrázek, takže při velkém zvětšení
   trochu měkne. Text a SVG se překreslují ostře.

   Použití:
     Projektor.uprav(ramek, 1.5);        // vyplnit rodiče, obsah 1,5×
     Projektor.vmestnej(ramek, 1280, 720);  // pevné plátno na střed rodiče
     Projektor.zrus(ramek);
     Projektor.celaObrazovka(prvek);     // přepnout celou obrazovku
   ============================================================ */
const Projektor = (function () {
  const UROVNE = [1, 1.25, 1.5, 1.75, 2, 2.5];

  // Rodič musí umět umístit škálovaný rám a odříznout, co přeteče.
  function pripravRodice(el) {
    const r = el.parentElement;
    if (!r) return null;
    const s = getComputedStyle(r);
    if (s.position === 'static') r.style.position = 'relative';
    if (s.overflow === 'visible') r.style.overflow = 'hidden';
    return r;
  }

  /* Rám vyplní rodiče, obsah se vykreslí `nasobek`× větší. */
  function uprav(ramek, nasobek) {
    const rodic = pripravRodice(ramek);
    if (!rodic) return;
    const k = Math.max(1, Number(nasobek) || 1);
    if (k === 1) return zrus(ramek);
    const w = rodic.clientWidth, h = rodic.clientHeight;
    Object.assign(ramek.style, {
      position: 'absolute', top: '0', left: '0',
      width: (w / k) + 'px', height: (h / k) + 'px',
      transform: `scale(${k})`, transformOrigin: 'top left',
      // Rám se překresluje jen při změně úrovně, ne v animaci – vlastní
      // vrstva by jinak držela plátna v paměti grafiky zbytečně dlouho.
      willChange: 'auto',
    });
  }

  /* Rám má pevné rozměry (plátno prezentace) a vejde se doprostřed rodiče. */
  function vmestnej(ramek, sirka, vyska) {
    const rodic = pripravRodice(ramek);
    if (!rodic) return 1;
    const k = Math.min(rodic.clientWidth / sirka, rodic.clientHeight / vyska);
    Object.assign(ramek.style, {
      position: 'absolute',
      width: sirka + 'px', height: vyska + 'px',
      top: '50%', left: '50%',
      transform: `translate(-50%, -50%) scale(${k})`,
      transformOrigin: 'center center',
    });
    return k;
  }

  function zrus(ramek) {
    for (const v of ['position', 'top', 'left', 'width', 'height', 'transform',
                     'transformOrigin', 'willChange']) ramek.style[v] = '';
  }

  /* Celá obrazovka. Vrací Promise s tím, jestli je po přepnutí zapnutá –
     v rámu z jiného webu (a bez gesta uživatele) prohlížeč požadavek odmítne. */
  async function celaObrazovka(prvek) {
    try {
      if (document.fullscreenElement) { await document.exitFullscreen(); return false; }
      await (prvek || document.documentElement).requestFullscreen();
      return true;
    } catch { return !!document.fullscreenElement; }
  }

  /* Další / předchozí úroveň ze seznamu UROVNE. */
  function posun(nasobek, smer) {
    const i = UROVNE.indexOf(nasobek);
    const j = i < 0 ? 0 : i + smer;
    return UROVNE[Math.min(UROVNE.length - 1, Math.max(0, j))];
  }

  return { UROVNE, uprav, vmestnej, zrus, celaObrazovka, posun };
})();

if (typeof window !== 'undefined') window.Projektor = Projektor;
