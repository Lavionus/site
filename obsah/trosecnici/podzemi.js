/* ============================================================
   Trosečníci – podzemi.js: zjednodušené podzemí pod kamennými dveřmi.

   Čistá logika bez DOM. Žádná zvláštní mapa: když výprava stojí na poli
   jeskyně a dveře jsou otevřené, nabídne se akce „Prohledat podzemí"
   (3 AB + 1 pochodeň). Každé prohledání posune výpravu hlouběji:
   6 úrovní po 2 prohledáních. Na každé úrovni úlomek příběhu, k tomu
   náhodný výsledek podle hloubky – kořist, nebezpečí, nebo nic. Na konci
   2., 3., 4. a 5. úrovně leží artefakt (4 ze 6, pořadí podle seedu).
   Na dně (6. úroveň) čeká srdce ostrova a volba, která se promítne
   do epilogu.
   ============================================================ */
var TROS = globalThis.TROS = globalThis.TROS || {};

(function (T) {
  'use strict';
  const { idx } = T.svet;
  const { Nahoda, smichej } = T.nahoda;

  const AB = 3;
  const UROVNE = [
    { nazev: 'Vstupní síň', pribeh: 'Stěny pokrývají malby: kánoe plné lidí připlouvají k ostrovu, nad nimi slunce se spirálou uprostřed.' },
    { nazev: 'Chodba sloupů', pribeh: 'Na sloupech jsou vytesané tváře – stejné jako kamenná hlava nahoře. Lidé tu hlavy stavěli pro někoho, kdo spí pod zemí.' },
    { nazev: 'Podzemní jezero', pribeh: 'Průzračné jezero v jeskynní síni. Na dně se lesknou tisíce mušlí – obětiny. Ve vodě plavou slepé bílé ryby.' },
    { nazev: 'Pohřebnice', pribeh: 'Výklenky s kostrami zabalenými v rohožích. U každé leží malá kamenná spirála. Nikdo z nich neodešel z ostrova.' },
    { nazev: 'Lávový most', pribeh: 'Přes rozpálenou puklinu vede kamenný most. Poslední malba: sopka chrlí oheň a kánoe odplouvají pryč. Ostrov zůstal prázdný.' },
    { nazev: 'Srdce ostrova', pribeh: 'Kruhová síň pod samotnou sopkou. Uprostřed na oltáři stojí zlatá soška – postava se spirálou na hrudi. Vzduch tu vibruje teplem.' },
  ];
  const ARTEFAKTY = {
    dzban:     { ikona: '🏺', nazev: 'Džbán deště',          popis: 'Každou noc se sám naplní: +2 💧.' },
    trojzubec: { ikona: '🔱', nazev: 'Bronzový trojzubec',   popis: 'Rybaření +20 % a +1 🍖.' },
    amulet:    { ikona: '🪬', nazev: 'Amulet s okem',        popis: 'Horečka bere jen polovinu (−3 ❤️ za noc).' },
    mapa:      { ikona: '🗺️', nazev: 'Kamenná mapa ostrova', popis: 'Vyrytá mapa celého ostrova – mlha zmizela.' },
    svitek:    { ikona: '📜', nazev: 'Svitek stavitelů',     popis: 'Nákresy lodí dávných lidí: práce na lodi +50 %.' },
    zrcadlo:   { ikona: '🪞', nazev: 'Obsidiánové zrcadlo',  popis: 'Blýskne se na dálku: výprava vidí o 2 pole dál.' },
  };

  function stav(s) { return s.podzemi || (s.podzemi = { uroven: 0, krok: 0, pribeh: [], nalezeno: [], konec: null }); }
  function poradiArtefaktu(s) {
    const r = Nahoda(smichej(s.seed, 777, 3));
    return r.zamichej(Object.keys(ARTEFAKTY)).slice(0, 4);
  }
  const maArtefakt = (s, a) => s.predmety.includes(a);
  const naJeskyni = s => { const li = s.svet.lokNa[idx(s.hrac.x, s.hrac.y)]; return li >= 0 && s.svet.lokace[li].typ === 'jeskyne'; };
  const otevreno = s => !!(s.tajemstvi && s.tajemstvi.dvere);
  const naDne = s => stav(s).uroven >= UROVNE.length - 1;

  // náhodný výsledek prohledání (podle hloubky)
  function vysledek(s, r) {
    const p = stav(s), h = p.uroven;
    const vyp = T.postavy.vyprava(s), vedouci = T.postavy.vedouci(s);
    const lekar = T.postavy.maProfesi(s, 'lekar', 'vyprava'), tesar = T.postavy.maProfesi(s, 'tesar', 'vyprava');
    const botanik = T.postavy.maProfesi(s, 'botanik', 'vyprava');
    const nebezpeci = 0.18 + 0.06 * h;
    const x = r.dalsi();
    if (x < nebezpeci) {
      const druh = r.vyber(['past', 'past', 'zaval', 'pavouk', 'zhasla']);
      if (druh === 'past') {
        const z = lekar ? 7 : 15 + h * 2;
        vedouci.zdravi = Math.max(1, vedouci.zdravi - z);
        return { text: `Z podlahy vyjely kamenné hroty! ${vedouci.hrac ? 'Pořezal ses' : vedouci.jmeno + ' je zraněn' + (vedouci.rod === 'z' ? 'á' : '')} (−${z} ❤️).${lekar ? ' Lékař ránu hned ošetřil.' : ''}`, zle: true };
      }
      if (druh === 'zaval') {
        if (tesar) return { text: 'Chodba je zavalená, ale tesař vzepřel strop trámem a prošli jste bez ztrát.' };
        if ((s.zasoby.pochodne || 0) > 0) { s.zasoby.pochodne--; return { text: 'Zával! Museli jste dlouhou oklikou a dohořela další pochodeň (−1 🔥).', zle: true }; }
        vedouci.zdravi = Math.max(1, vedouci.zdravi - 10);
        return { text: 'Zával! Po tmě jste se prodírali sutí (−10 ❤️).', zle: true };
      }
      if (druh === 'pavouk') {
        const o = r.vyber(vyp);
        s.efekty = s.efekty || [];
        s.efekty.push({ typ: 'nemoc', id: o.id, do: s.den + 2 });
        return { text: `${o.hrac ? 'Tebe' : T.postavy.kdoACo(o)} kousl bledý jeskynní pavouk. Horečka na sebe nenechá dlouho čekat.`, zle: true };
      }
      return { text: 'Z temnoty se vyřítilo hejno netopýrů a pochodeň zhasla. Než jste ji znovu zapálili, bloudili jste potmě zpátky na začátek síně. Tuhle část musíte projít znovu.', zle: true, zpet: true };
    }
    if (x < nebezpeci + 0.45) {
      const k = r.vyber(h === 2 ? ['ryby', 'ryby', 'kov'] : ['kov', 'kov', 'houby', 'mince']);
      if (k === 'kov') { const z = T.hra.pridejZasoby(s, { kov: r.cele(2, 3) }); return { text: `Ve výklenku leží bronzové nástroje a kování (+${z.kov || 0} ⚙️).` }; }
      if (k === 'ryby') { const z = T.hra.pridejZasoby(s, { jidlo: 3 + (vyp.some(o => o.profese === 'rybar') ? 2 : 0) }); return { text: `V jezeře jste nachytali slepé bílé ryby (+${z.jidlo || 0} 🍖).` }; }
      if (k === 'houby') { const z = T.hra.pridejZasoby(s, { lecivky: botanik ? 3 : 1 }); return { text: `Ve vlhku rostou světélkující houby${botanik ? ' – botanik pozná, že léčí' : ''} (+${z.lecivky || 0} 🌱).` }; }
      return { text: 'Hromádka zelených mincí s cizími znaky. K jídlu nejsou, ale krásně se lesknou.' };
    }
    return { text: 'Tichá chodba, jen vaše kroky a kapající voda.' };
  }

  const AKCE = [
    {
      id: 'podzemi', ikona: '🕯️', nazev: 'Prohledat podzemí', ab: AB,
      kde: s => naJeskyni(s) && otevreno(s) && !naDne(s),
      proc: s => (s.zasoby.pochodne || 0) < 1 ? 'Dole je naprostá tma – potřebuješ pochodeň 🔥.' : null,
      proved(s) {
        const p = stav(s), r = Nahoda(smichej(s.seed, s.den * 13 + s.tah + p.uroven * 7 + p.krok, 41));
        s.tah++;
        s.zasoby.pochodne--;
        const U = UROVNE[p.uroven], casti = [];
        if (p.krok === 0 && !p.pribeh.includes(p.uroven)) { p.pribeh.push(p.uroven); casti.push(`📜 ${U.nazev}: ${U.pribeh}`); }
        const v = vysledek(s, r);
        casti.push(v.text);
        if (v.zpet) { p.krok = 0; return casti.join(' '); }
        // postup
        if (p.krok === 0) p.krok = 1;
        else {
          p.krok = 0;
          const i = p.uroven - 1, poradi = poradiArtefaktu(s);
          if (i >= 0 && i < 4) {
            const a = poradi[i], A = ARTEFAKTY[a];
            if (!maArtefakt(s, a)) {
              s.predmety.push(a); p.nalezeno.push(a);
              if (a === 'mapa') s.mlha.fill(1);
              casti.push(`✨ Na kamenném podstavci leží ${A.ikona} ${A.nazev}! ${A.popis}`);
            }
          }
          p.uroven++;
          casti.push(`⬇️ Našli jste cestu dolů: ${UROVNE[p.uroven].nazev}.`);
          if (naDne(s)) { p.pribeh.push(p.uroven); casti.push(`📜 ${UROVNE[p.uroven].pribeh}`); }
        }
        return casti.join(' ');
      },
    },
    {
      id: 'podzemi_vzit', ikona: '🗿', nazev: 'Vzít zlatou sošku', ab: 1,
      kde: s => naJeskyni(s) && otevreno(s) && naDne(s) && !stav(s).konec,
      proc: () => null,
      proved(s) {
        stav(s).konec = 'soska';
        s.lide.forEach(o => { o.zdravi = Math.max(1, o.zdravi - 10); });
        return 'Zvedli jste sošku z oltáře. V tu chvíli se ostrov zachvěl, ze stropu se sypal prach a sopka hluboko pod vámi zahučela. ' +
          'Utíkali jste po schodech nahoru (všichni −10 ❤️). Soška je těžká a teplá, jako by v ní tlouklo srdce.';
      },
    },
    {
      id: 'podzemi_nechat', ikona: '🙏', nazev: 'Nechat sošku na oltáři', ab: 1,
      kde: s => naJeskyni(s) && otevreno(s) && naDne(s) && !stav(s).konec,
      proc: () => null,
      proved(s) {
        stav(s).konec = 'nechano';
        s.lide.forEach(o => { o.zdravi = Math.min(100, o.zdravi + 20); });
        return 'Chvíli jste stáli v tichu. Pak jste se otočili a nechali sošku tam, kde ji před staletími postavili. ' +
          'Cestou nahoru na vás padl zvláštní klid – jako by vám ostrov poděkoval (všichni +20 ❤️).';
      },
    },
  ];

  function popisHloubky(s) {
    const p = stav(s);
    return { uroven: p.uroven + 1, celkem: UROVNE.length, nazev: UROVNE[p.uroven].nazev, krok: p.krok };
  }

  T.podzemi = { AB, UROVNE, ARTEFAKTY, AKCE, stav, poradiArtefaktu, naDne, popisHloubky };
})(TROS);

if (typeof module !== 'undefined') module.exports = TROS;
