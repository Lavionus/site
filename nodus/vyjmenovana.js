/* ============================================================
   vyjmenovana.js – řady vyjmenovaných slov na jednom místě.

   Řady potřebují tři stránky (doplňovačky, vyjmenovaná slova,
   generátor diktátů) a všechny je chtějí ukazovat stejně: pás
   slov, ve kterém se rozsvítí to, o které v úloze právě šlo.
   Bez sdíleného souboru by se seznam opisoval třikrát a při
   opravě jedné řady by se ostatní rozešly.
   ============================================================ */
const Vyjm = (function () {
  /* Řady podle Pravidel českého pravopisu; v závorce je běžná dnešní podoba. */
  const RADY = {
    B: ['být', 'bydlit (bydlet)', 'obyvatel', 'byt', 'příbytek', 'nábytek', 'dobytek',
        'obyčej', 'bystrý', 'bylina', 'kobyla', 'býk', 'babyka'],
    L: ['slyšet', 'mlýn', 'blýskat se', 'polykat', 'plynout', 'plýtvat', 'vzlykat',
        'lysý', 'lýtko', 'lýko', 'lyže', 'pelyněk', 'plyš'],
    M: ['my', 'mýt', 'myslit (myslet)', 'mýlit se', 'hmyz', 'myš', 'hlemýžď', 'mýtit',
        'zamykat', 'smýkat', 'dmýchat', 'chmýří', 'nachomýtnout se', 'mýto'],
    P: ['pýcha', 'pytel', 'pysk', 'netopýr', 'slepýš', 'pyl', 'kopyto', 'klopýtat',
        'třpytit se', 'zpytovat', 'pykat', 'pýr', 'pýřit se', 'čepýřit se'],
    S: ['syn', 'sytý', 'sýr', 'syrový', 'sychravý', 'usychat', 'sýkora', 'sýček',
        'sysel', 'syčet', 'sypat'],
    V: ['vy', 'vykat', 'vysoký', 'výt', 'výskat', 'zvykat', 'žvýkat', 'vydra', 'výr',
        'vyžle', 'povyk', 'výheň', 'předpona vy-/vý-'],
    Z: ['brzy', 'jazyk', 'nazývat (se)', 'Ruzyně'],
  };

  const OBOJETNE = 'bflmpsvz';

  /* Kořen slova pro porovnání: bez závorek, diakritiky délek a koncového „se“.
     Díky tomu se „mýdlo“ najde v řadě M přes „mýt“ jen tehdy, když si to
     stránka vyžádá – porovnáváme vždy jen to, co dostaneme. */
  function zaklad(slovo) {
    return String(slovo)
      .toLowerCase()
      .replace(/\s*\(.*?\)\s*/g, '')
      .replace(/\s+se$/, '')
      .replace(/[áéěíóúůý]/g, z => ({ 'á': 'a', 'é': 'e', 'ě': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ů': 'u', 'ý': 'y' }[z]))
      .trim();
  }

  /* Pás řady jako HTML pro .rada; `zvyrazni` rozsvítí jedno slovo. */
  function pas(pismeno, zvyrazni) {
    const rada = RADY[String(pismeno || '').toUpperCase()];
    if (!rada) return '';
    const hledane = zvyrazni ? zaklad(zvyrazni) : null;
    return rada.map(s => {
      const sviti = hledane && zaklad(s) === hledane;
      return `<span class="${sviti ? 'sviti' : ''}">${s}</span>`;
    }).join('');
  }

  /* Je slovo přímo v některé řadě? Vrací písmeno řady, jinak null. */
  function radaSlova(slovo) {
    const hledane = zaklad(slovo);
    for (const [p, rada] of Object.entries(RADY)) {
      if (rada.some(s => zaklad(s) === hledane)) return p;
    }
    return null;
  }

  return { RADY, OBOJETNE, pas, radaSlova, zaklad };
})();
