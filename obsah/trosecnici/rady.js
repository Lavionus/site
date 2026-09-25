/* ============================================================
   Trosečníci – rady.js: průvodce pro začátečníky („🧭 Co dál?").

   Čistá logika bez DOM. Posloupnost úkolů; aktuální je první nesplněný.
   Splnění se odvozuje jen ze stavu hry, takže průvodce funguje i po
   načtení uložené hry a nikdy „neuteče" dopředu.
   ============================================================ */
var TROS = globalThis.TROS = globalThis.TROS || {};

(function (T) {
  'use strict';
  const { TEREN } = T.svet;

  const zna = (s, t) => { for (let i = 0; i < s.mlha.length; i++) if (s.mlha[i] && s.svet.teren[i] === t) return true; return false; };
  const akci = (s, id) => (s.stat.akce || {})[id] || 0;
  const ma = (s, typ) => T.stavby.ma(s, typ);

  const RADY = [
    { id: 'vrak', ikona: '🚢', cil: 'Prohledej vrak lodi',
      hotovo: s => s.vrakKolo >= 1,
      rada: 'Vrak leží na mělčině vedle tebe. Postav se na pláž hned u něj a v panelu klikni na „🚢 Prohledat vrak". Dá se prohledat čtyřikrát.' },
    { id: 'reka', ikona: '🧭', cil: 'Najdi sladkou vodu',
      hotovo: s => zna(s, TEREN.REKA),
      rada: s => `Vody je málo. ${s.smerVody ? `Voda šumí ${s.smerVody.text} – vydej se tím směrem.` : 'Hledej řeku ve vnitrozemí.'} Klikni na pole na mapě (ukáže cestu) a pak ještě jednou (jdeš). Ze skal je vidět dál.` },
    { id: 'voda', ikona: '💧', cil: 'Nabrat vodu z řeky',
      hotovo: s => akci(s, 'voda') >= 1 || ma(s, 'ohniste'),
      rada: 'Postav se na břeh řeky (nebo přímo do brodu) a klikni na „💧 Nabrat vodu z řeky". Každý v noci vypije 2 💧 – hlídej lištu nahoře.' },
    { id: 'ohniste', ikona: '🔥', cil: 'Založ tábor – postav ohniště',
      hotovo: s => ma(s, 'ohniste'),
      rada: 'Sbírej 🪵 dříví (pláž, džungle, stromy) a 🪨 kamení (balvany, skály). Za 3 🪵 a 2 🪨 postav ohniště – nejlépe kousek od řeky, bude tam tábor. Staví se na poli, kde stojíš (sekce „🔨 Stavět tady").' },
    { id: 'strecha', ikona: '⛺', cil: 'Střecha nad hlavou nebo voda do zásoby',
      hotovo: s => ma(s, 'pristresek') || ma(s, 'chatrc') || ma(s, 'sberac'),
      rada: 'Postav ⛺ přístřešek (spánek +5 ❤️, chrání před deštěm) nebo 🪣 sběrač vody (+4 místa na vodu a trochu vody každou noc). Obojí musí stát do 5 polí od ohniště.' },
    { id: 'lide', ikona: '👥', cil: 'Najdi další trosečníky',
      hotovo: s => s.lide.length + s.mrtvi.length >= 2,
      rada: 'Nejsi tu sám! Přeživší čekají v mlze na plážích a v savaně – na mapě mávají, na minimapě jsou růžově. Když k nim dojdeš, rozhodneš, jestli je přijmeš. Každý ale jí a pije.' },
    { id: 'prace', ikona: '🧑‍🌾', cil: 'Přiděl lidem práci v táboře',
      hotovo: s => s.lide.some(o => o.role !== 'vyprava' && o.role !== 'odpocinek'),
      rada: 'Kdo nejde s výpravou, pracuje v táboře přes noc. V panelu 👥 Lidé mu vyber práci – u řeky „💧 Nosit vodu" naplní všechny nádoby, „🫐 Sběr jídla" nakrmí tábor. Do výpravy a z ní se přeřazuje doma.' },
    { id: 'sklad', ikona: '📦', cil: 'Postav sklad',
      hotovo: s => ma(s, 'sklad'),
      rada: 'Zásoby mají limit (vidíš ho v liště). 📦 Sklad (6 🪵 4 🪨) ho výrazně zvedne – bez něj se nevejde materiál na větší stavby ani na loď.' },
    { id: 'objevy', ikona: '💡', cil: 'Uč se od ostrova – udělej 2 objevy',
      hotovo: s => (s.objevy || []).length >= 2,
      rada: 'Nové technologie nepřijdou samy – musíš je objevit: u řeky, na skalách, v sopce, v ruinách… Nápovědy jsou v panelu 💡 Objevy.' },
    { id: 'domu', ikona: '⛵', cil: 'Připrav cestu domů',
      hotovo: s => ma(s, 'lodenice') || ma(s, 'signal'),
      rada: 'Domů vedou dvě cesty: 🔥 signální hranice na pláži (od 50. dne si vás může všimnout loď, ale musí hořet) a ⛵ loděnice s vlastní lodí (odemkne ji objev řemesla – pila). Loď je jistější.' },
  ];

  // aktuální rada (první nesplněná), nebo null = průvodce dokončen
  function aktualni(s) {
    for (let k = 0; k < RADY.length; k++) if (!RADY[k].hotovo(s)) {
      const R = RADY[k];
      return { ...R, rada: typeof R.rada === 'function' ? R.rada(s) : R.rada, poradi: k + 1, celkem: RADY.length };
    }
    return null;
  }
  function splneno(s) { return RADY.filter(r => r.hotovo(s)).length; }

  /* Krátkodobá varování (voda, jídlo) – nezávislá na průvodci.
     Počítají s tím, co tábor v noci vyrobí: nosiči vody, sběrače, nádrže, déšť,
     sběr jídla, molo, políčka i kuchař (postavy.odhadNoci). */
  function varovani(s) {
    const v = [];
    if (!s.lide.length) return v;
    const o = T.postavy.odhadNoci(s);
    const zVyroby = (k, n) => n > 0 ? ` (z toho ${n} přinese noc)` : '';
    if (o.voda < o.potrebaV) v.push({ text: `💧 Na noc chybí voda: ${o.voda} z ${o.potrebaV}`,
      tip: `Po nočním přítoku bude ${o.voda} 💧${zVyroby('voda', o.pritokVody)}, vypije se ${o.potrebaV}. Nabírej u řeky, nebo přiděl někomu „Nosit vodu" (tábor u řeky naplní všechny nádoby).` });
    if (o.jidlo < o.potrebaJ) v.push({ text: `🍖 Na noc chybí jídlo: ${o.jidlo} z ${o.potrebaJ}`,
      tip: `S nočním sběrem bude ${o.jidlo} 🍖${zVyroby('jidlo', o.vyrobaJidla)}, sní se ${o.potrebaJ}. Sbírej, rybař, nebo přiděl někomu „Sběr jídla" či molo.` });
    return v;
  }

  T.rady = { RADY, aktualni, splneno, varovani };
})(TROS);

if (typeof module !== 'undefined') module.exports = TROS;
