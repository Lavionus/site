/* Modelář 3D – ovládací prvky stránky: lišta, panel, stavový řádek.
   Nastavení desky si prohlížeč pamatuje v localStorage (jen pohodlí,
   do projektu se uloží od etapy 5). */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const $ = id => document.getElementById(id);
  const KLIC = 'modelar_nastaveni';
  const VYCHOZI = { sirka: 200, hloubka: 200, krok: 1, tema: 'auto' };

  function nactiNastaveni() {
    try {
      const s = JSON.parse(localStorage.getItem(KLIC) || '{}');
      return {
        sirka: M.omez(+s.sirka || VYCHOZI.sirka, 10, 2000),
        hloubka: M.omez(+s.hloubka || VYCHOZI.hloubka, 10, 2000),
        krok: [0.1, 0.25, 0.5, 1, 2, 5, 10].includes(+s.krok) ? +s.krok : VYCHOZI.krok,
        tema: M.TEMATA_DESKY[s.tema] ? s.tema : VYCHOZI.tema,
      };
    } catch (e) { return { ...VYCHOZI }; }
  }
  function ulozNastaveni(s) {
    try { localStorage.setItem(KLIC, JSON.stringify(s)); } catch (e) { /* úložiště zakázané */ }
  }

  M.spust = function () {
    const nast = nactiNastaveni();
    M.nastavTemaDesky(nast.tema);
    const S = M.vytvorScenu($('plocha'), nast);
    const k = S.kamera;

    // --- lišta: pohledy a projekce
    $('btnDomu').onclick = () => S.domu();
    document.querySelectorAll('[data-pohled]').forEach(b => {
      b.onclick = () => { S.pohled(b.dataset.pohled); const n = b.closest('.nabidka'); if (n) M.zavriNabidku(n); };
    });
    const btnProj = $('btnProjekce');
    btnProj.onclick = () => { S.projekce(!k.ortograficka); const n = btnProj.closest('.nabidka'); if (n) M.zavriNabidku(n); };
    M.na('projekce', orto => {
      btnProj.textContent = orto ? '▭ Ortografická' : '◬ Perspektiva';
      btnProj.setAttribute('aria-pressed', orto ? 'true' : 'false');
      $('stavProjekce').textContent = orto ? 'ortografická' : 'perspektiva';
    });

    // --- panel: deska
    const inS = $('deskaSirka'), inH = $('deskaHloubka'), selK = $('deskaKrok');
    inS.value = nast.sirka; inH.value = nast.hloubka; selK.value = String(nast.krok);
    function zmenaDesky(odUzivatele = true) {
      const s = {
        sirka: M.omez(parseFloat(inS.value.replace(',', '.')) || nast.sirka, 10, 2000),
        hloubka: M.omez(parseFloat(inH.value.replace(',', '.')) || nast.hloubka, 10, 2000),
        krok: parseFloat(selK.value) || 1,
      };
      Object.assign(nast, s);
      S.deska.nastav(s.sirka, s.hloubka, s.krok);
      S.ukazRovinu();
      ulozNastaveni(nast);
      $('stavDeska').textContent = `${M.mm(s.sirka)} × ${M.mm(s.hloubka)} mm, mřížka ${M.mm(s.krok, 2)} mm`;
      M.prekresli();
      if (odUzivatele) M.vysli('deska', s);
    }
    // deska z otevřeného projektu
    M.na('nastavDesku', d => {
      inS.value = d.sirka; inH.value = d.hloubka; selK.value = String(d.krok);
      zmenaDesky(false);
    });
    [inS, inH].forEach(i => i.addEventListener('change', () => { zmenaDesky(); inS.value = nast.sirka; inH.value = nast.hloubka; }));
    selK.addEventListener('change', () => zmenaDesky());
    document.querySelectorAll('[data-deska]').forEach(b => {
      b.onclick = () => {
        const [s, h] = b.dataset.deska.split('x').map(Number);
        inS.value = s; inH.value = h;
        zmenaDesky();
        S.domu();
      };
    });
    zmenaDesky(false);

    // --- téma plochy: dlaždice s náhledem barev (deska na pozadí s přechodem)
    const temata = $('deskaTemata'), temataPohled = $('pohledTemata');
    temata.innerHTML = Object.entries(M.TEMATA_DESKY).map(([id, t]) => {
      const vz = t.deska ? `background:linear-gradient(${t.pozadi[0]},${t.pozadi[1]})` : 'background:linear-gradient(135deg,#f7f9fc 0 50%,#2b3038 50% 100%)';
      const d = t.deska ? `<span class="tema-deska" style="background:${t.deska};border-color:${t.hlavni}"></span>` : '';
      return `<button type="button" class="tema" data-tema="${id}" aria-pressed="false" title="Téma plochy: ${t.nazev}"><span class="tema-vzor" style="${vz}">${d}</span><span class="tema-nazev">${t.nazev}</span></button>`;
    }).join('');
    // stejné dlaždice i v nabídce Pohled (tam je uživatel najde, boční panel bývá sbalený)
    if (temataPohled) temataPohled.innerHTML = temata.innerHTML;
    const ukazTema = () => document.querySelectorAll('[data-tema]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tema === M.idTematuDesky() ? 'true' : 'false'));
    M.zmenTemaDesky = id => {
      M.nastavTemaDesky(id);
      nast.tema = M.idTematuDesky();
      ulozNastaveni(nast);
      S.motiv();
      if (S.telesa) S.telesa.motiv();
      ukazTema();
      M.vysli('temaDesky', nast.tema);
    };
    for (const mriz of [temata, temataPohled]) if (mriz) mriz.addEventListener('click', e => { const b = e.target.closest('[data-tema]'); if (b) M.zmenTemaDesky(b.dataset.tema); });
    ukazTema();

    // --- stavový řádek: poloha kurzoru na desce
    const stavX = $('stavX'), stavY = $('stavY');
    M.na('kurzor', b => {
      stavX.textContent = b ? M.mm(b.x) : '—';
      stavY.textContent = b ? M.mm(b.y) : '—';
    });

    // Enter v okně (mimo tlačítka a víceřádková pole) potvrdí hlavní tlačítko – ovládání jen klávesnicí
    document.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || e.defaultPrevented || e.shiftKey || e.ctrlKey || e.altKey || e.isComposing) return;
      const t = e.target, d = t && t.closest && t.closest('dialog.okno[open]');
      if (!d || t.matches('button, textarea, a, summary, select')) return;
      // pole, kde Enter jen potvrdí hodnotu (souřadnice bodu otáčení – jinak by se hned i otočilo)
      if (t.closest('[data-bez-potvrzeni]')) { e.preventDefault(); t.dispatchEvent(new Event('change', { bubbles: true })); return; }
      const ok = d.querySelector('.tlacitka .hlavni-tl:not(:disabled)');
      if (!ok) return;
      e.preventDefault();
      if (t.matches('input')) t.dispatchEvent(new Event('change', { bubbles: true }));     // rozepsaná hodnota platí
      ok.click();
    });
    // číselná pole v oknech: na telefonu číselná klávesnice (s čárkou)
    document.querySelectorAll('dialog.okno input:not([type]), dialog.okno input[type=text]').forEach(i => {
      if (!i.hasAttribute('inputmode') && /^-?[\d.,]*$/.test(i.value)) i.setAttribute('inputmode', 'decimal');
    });
    // na úzké obrazovce panel překrývá plochu, proto je schovaný a ukazuje se tlačítkem
    $('btnPanel').setAttribute('aria-expanded', 'false');
    $('btnPanel').setAttribute('aria-controls', 'panelBocni');
    // telefon: panel se vysouvá přes plátno (panel-ukazany); střední šířka: panel je vedle plátna a jde schovat (panel-skryty)
    const telefon = () => matchMedia('(max-width: 760px)').matches;
    $('btnPanel').onclick = () => {
      if (telefon()) document.body.classList.toggle('panel-ukazany');
      else { document.body.classList.toggle('panel-skryty'); window.dispatchEvent(new Event('resize')); }
    };
    // stav tlačítka podle třídy těla (panel schovává i přidání tvaru a tah z knihovny)
    const stavPanelu = () => $('btnPanel').setAttribute('aria-expanded', String(telefon() ? document.body.classList.contains('panel-ukazany') : !document.body.classList.contains('panel-skryty')));
    stavPanelu();
    matchMedia('(max-width: 760px)').addEventListener('change', stavPanelu);
    new MutationObserver(stavPanelu)
      .observe(document.body, { attributes: true, attributeFilter: ['class'] });

    // --- tělesa, výběr, knihovna, inspektor, seznam (etapa 2)
    S.vypocty = M.vytvorVypocty();
    const T = M.vytvorTelesa(S);
    let chybaVypoctu = '';
    let pocitano = 0;
    // ukazatel čekání nad plochou: dávka výpočtů skupin (průběh = hotový podíl dávky) a načítání OCCT
    let davka = 0;
    M.na('occt', st => st === 'nacita' ? M.cekej('occt', 'Načítám přesné jádro (OpenCascade, 22 MB)…', null, 0) : M.hotovoCekani('occt'));
    M.na('vypocty', n => {
      if (!n) { davka = 0; M.hotovoCekani('vypocty'); return; }
      davka = Math.max(davka, n);
      M.cekej('vypocty', davka > 1 ? `Počítám skupiny (${davka - n + 1} z ${davka})…` : 'Počítám skupinu…', davka > 1 ? (davka - n) / davka : null);
    });
    M.na('occt', st => { if (st === 'nacita' || !pocitano) $('stavVypocet').textContent = st === 'nacita' ? '⏳ načítám přesné jádro (OpenCascade, 22 MB)…' : chybaVypoctu; });
    // chyba platí, jen dokud ve scéně je těleso, které spočítat nejde (po Zpět, smazání… zmizí)
    const obnovChybu = () => { if (chybaVypoctu && !T.info().chyby.length) chybaVypoctu = ''; };
    M.na('dokument', () => { if (chybaVypoctu) setTimeout(() => { obnovChybu(); if (!pocitano) { $('stavVypocet').textContent = chybaVypoctu; $('stavVypocet').classList.toggle('chyba', !!chybaVypoctu); } }, 0); });
    M.na('vypocty', n => {
      pocitano = n;
      if (!n) obnovChybu();
      $('stavVypocet').textContent = n ? (M.occtStav() === 'nacita' ? '⏳ načítám přesné jádro (OpenCascade, 22 MB)…' : '⏳ počítám skupiny…') : chybaVypoctu;
      $('stavVypocet').classList.toggle('chyba', !n && !!chybaVypoctu);
    });
    M.na('chybaVypoctu', zprava => {
      chybaVypoctu = '⚠ Skupinu nejde spočítat: ' + zprava;
      $('stavVypocet').textContent = chybaVypoctu;
      $('stavVypocet').classList.add('chyba');
    });
    S.telesa = T;
    S.uchyty = M.vytvorUchyty(S, $('plocha'));
    M.vytvorVyber(S, T, $('plocha'));
    S.prikazy = M.vytvorPrikazy(S);
    const stavRezim = $('stavRezim');
    const ukazRezim = () => {
      stavRezim.textContent = M.app.rezim === 'rovina' ? 'Klikni na stěnu tělesa pro pracovní rovinu (vedle = deska, Esc = zpět)'
        : M.app.rezim === 'plochou' ? 'Klikni na stěnu, která má ležet dole (Esc = zpět)'
        : M.app.rezim === 'vzorDer' ? 'Klikni na rovnou plochu tělesa, do které se vyvrtají díry (Esc = zpět)'
        : M.app.rezim === 'struktura' ? 'Klikni na plochu tělesa (rovnou nebo plášť válce), na kterou se nanese struktura (Esc = zpět)'
        : M.app.rezim === 'pivot' ? 'Bod otáčení: klikni na puntík (roh, střed hrany či stěny), na stěnu tělesa nebo na desku (Esc = zpět)'
        : M.app.rezim === 'zrcadleni' ? 'Zrcadlení: najeď na šipku (ukáže výsledek), klikni; Esc nebo klik vedle = konec'
        : M.app.rezim === 'zarovnani' ? 'Zarovnání: najeď na puntík (ukáže výsledek), klikni; klik na vybrané těleso = vztažné; Esc = konec'
        : M.app.rezim === 'mereni' ? 'Měření: klikej na body těles nebo desky (Esc = konec)'
        : M.app.rezim === 'poznamka' ? 'Klikni, kam patří poznámka nebo referenční bod (Esc = zpět)'
        : M.app.rezim === 'hrany' ? 'Klikni na hranu – hned se upraví; klik na upravenou ji vrátí (Esc = hotovo)'
        : M.app.rezim === 'plochy' ? 'Klikni na značku rovné plochy, kterou má skořepina otevřít – hned se vyhloubí (Esc = hotovo)'
        : M.app.rovina ? 'pracovní rovina na tělese' : '';
    };
    M.na('rezim', ukazRezim);
    M.na('rovina', ukazRezim);
    S.knihovna = M.vytvorKnihovnu(S, T, $('knihovna'), $('knihovnaDily'), $('knihovnaRozsirene'));
    M.vytvorDily();
    M.vytvorUpravy(S);
    M.vytvorStrukturu(S);
    M.vytvorOcctUI(S);
    M.vytvorInspektor($('inspektor'));
    M.vytvorSeznam($('seznam'), $('pocetObjektu'));
    M.vytvorSkicar(S);
    const stavVyber = $('stavVyber');
    const ukazVyber = () => {
      const n = M.app.vyber.length;
      stavVyber.textContent = n ? `vybráno: ${n}` : '';
    };
    M.na('vyber', ukazVyber);
    M.na('dokument', ukazVyber);
    // --- ukládání, soubory, projekty (etapa 5)
    const U = M.vytvorUlozeni(S);
    S.ulozeni = U;
    M.vytvorSoubory(S, U);
    M.vytvorProjekty(U);
    // --- dílna (etapa 10)
    M.vytvorDilnu(S, T, U);
    M.pripraveno = false;               // do otevření projektu z úložiště (testy na to čekají)
    M.vytvorNapovedu();
    M.vytvorZarovnani(S);
    M.vytvorZrcadleni(S);
    M.vytvorPivot(S);
    M.vytvorTisk(S, S.telesa);
    M.vytvorKoty(S);
    M.cekej('start', 'Otevírám projekt…', null, 0);
    U.start().finally(() => { M.hotovoCekani('start'); M.pripraveno = true; M.vysli('pripraveno'); M.pruvodceNaZacatku(); });

    // na úzké obrazovce panel po přidání tvaru zmizí, aby bylo vidět na plochu
    M.na('dokument', e => { if (/^Přidat/.test(e.popis)) document.body.classList.remove('panel-ukazany'); });

    M.vysli('projekce', k.ortograficka);
    M.prekresli();
  };
})(MDL);
