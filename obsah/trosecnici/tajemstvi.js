/* ============================================================
   Trosečníci – tajemstvi.js: tajemství ostrova a stavba lodi.

   Čistá logika bez DOM.
   Tajemství: čtyři symboly na čtyřech místech – ☀️ na kamenné hlavě,
   🌀 v ruinách, 💧 za clonou vodopádu (chce pochodeň), 🔥 nad kráterem
   sopky. V jeskyni (2 pochodně) čekají kamenné dveře se třemi
   prohlubněmi; s ☀️ 💧 🔥 a klíčem 🌀 se otevřou. Pořadí je volné,
   texty se přizpůsobí tomu, co už víš.

   Loď: loděnice na pláži u moře, pak 5 dílů. Každý díl se nejdřív
   zaplatí surovinami a pak se na něm pracuje – výprava na loděnici
   (2 práce za AB, tesař ve výpravě ×1,5), lidé v táboře přes noc
   (4, tesař 6). Hotová loď může kdykoli odplout – s jídlem a vodou
   na cestu a ne v bouři. Odplutí je konec hry (vítězství).
   ============================================================ */
var TROS = globalThis.TROS = globalThis.TROS || {};

(function (T) {
  'use strict';
  const { W, TEREN, SOUSEDE4, idx, uvnitr } = T.svet;

  const SYMBOLY = {
    slunce:  { ikona: '☀️', nazev: 'Slunce' },
    spirala: { ikona: '🌀', nazev: 'Spirála' },
    voda:    { ikona: '💧', nazev: 'Voda' },
    ohen:    { ikona: '🔥', nazev: 'Oheň' },
  };
  const DILY = [
    { id: 'kyl',     nazev: 'Kýl',               cena: { drevo: 20, kov: 3 }, prace: 80 },
    { id: 'trup',    nazev: 'Trup a paluba',     cena: { drevo: 30, kov: 4 }, prace: 140 },
    { id: 'stezen',  nazev: 'Stěžeň',            cena: { drevo: 10 },         prace: 40 },
    { id: 'plachta', nazev: 'Plachta',           cena: { vlakna: 25 },        prace: 60 },
    { id: 'lanovi',  nazev: 'Lanoví a kormidlo', cena: { vlakna: 15, drevo: 6, kov: 1 }, prace: 80 },
  ];
  const ZASOBY_NA_CESTU = { jidlo: 2, voda: 3 };            // na osobu (vyváženo: velký tábor musí mít šanci odplout)

  function stav(s) {
    return s.tajemstvi || (s.tajemstvi = { symboly: [], hlava: false, ruiny: false, jeskyne: false, dvere: false });
  }
  const ma = (s, sym) => stav(s).symboly.includes(sym);
  const lokaceU = (s, typ) => s.svet.lokace.find(l => l.typ === typ && Math.abs(l.x - s.hrac.x) + Math.abs(l.y - s.hrac.y) <= 1);
  // okraj kráteru: do 2 polí od lávy všemi směry (dřív jen těsně vedle ze 4 stran – hráči symbol nenacházeli)
  const DOSAH_KRATERU = 2;
  const uLavy = s => {
    for (let dy = -DOSAH_KRATERU; dy <= DOSAH_KRATERU; dy++) for (let dx = -DOSAH_KRATERU; dx <= DOSAH_KRATERU; dx++)
      if (uvnitr(s.hrac.x + dx, s.hrac.y + dy) && s.svet.teren[idx(s.hrac.x + dx, s.hrac.y + dy)] === TEREN.LAVA) return true;
    return false;
  };
  // pole kráteru (láva) – pro nápovědu a odkrytí na mapě
  function krater(s) { const v = []; for (let i = 0; i < s.svet.teren.length; i++) if (s.svet.teren[i] === TEREN.LAVA) v.push(i); return v; }
  function pridejSymbol(s, sym) { if (!ma(s, sym)) stav(s).symboly.push(sym); }
  const zbyva = s => ['slunce', 'voda', 'ohen'].filter(x => !ma(s, x));
  const seznamSymbolu = s => stav(s).symboly.map(x => SYMBOLY[x].ikona).join(' ');

  // odkryje mlhu kolem lokace (indicie „ukazuje směr")
  function ukaz(s, typ, r) {
    const l = s.svet.lokace.find(l => l.typ === typ);
    if (l) T.svet.odkryj(s.mlha, l.x, l.y, r || 2);
  }

  // --- akce tajemství ---------------------------------------------------------------------
  const AKCE = [
    {
      id: 'taj_hlava', ikona: '🗿', nazev: 'Prozkoumat kamennou hlavu', ab: 1,
      kde: s => !!lokaceU(s, 'hlava') && !stav(s).hlava,
      proc: () => null,
      proved(s) {
        stav(s).hlava = true; pridejSymbol(s, 'slunce'); ukaz(s, 'ruiny', 2);
        return 'Obešel jsi obrovskou hlavu. Na zádech má vytesaný kruh s paprsky – ☀️ slunce. Obkreslil sis ho. ' +
          'A ty oči… nehledí k moři, ale do vnitrozemí. Kam? Tam, kde z džungle vystupují zdi – ruiny jsou teď na mapě.';
      },
    },
    {
      id: 'taj_ruiny', ikona: '🏛️', nazev: 'Prozkoumat ruiny', ab: 2,
      kde: s => !!lokaceU(s, 'ruiny') && !stav(s).ruiny,
      proc: () => null,
      proved(s) {
        stav(s).ruiny = true; pridejSymbol(s, 'spirala'); ukaz(s, 'vodopad', 2);
        for (const i of krater(s)) T.svet.odkryj(s.mlha, i % W, (i / W) | 0, 2);
        return 'Mezi liánami leží kámen se spirálou 🌀 a pod ní řada obrázků: slunce nad hlavou, voda, která padá (vodopád), a oheň, ' +
          'který vychází ze země – kráter na vrcholu sopky. Obojí je teď na mapě. Na konci tři prohlubně v kameni. Spirála je klíč – obkreslil sis ji. ' +
          (zbyva(s).length ? `Chybí ti ještě: ${zbyva(s).map(x => SYMBOLY[x].ikona).join(' ')}.` : 'Všechny symboly už máš!');
      },
    },
    {
      id: 'taj_vodopad', ikona: '💧', nazev: 'Podívat se za clonu vodopádu', ab: 2,
      kde: s => !!lokaceU(s, 'vodopad') && !ma(s, 'voda'),
      proc: s => (s.zasoby.pochodne || 0) < 1 ? 'Za vodou je tma jako v pytli – potřebuješ pochodeň 🔥.' : null,
      proved(s) {
        s.zasoby.pochodne--; pridejSymbol(s, 'voda');
        return 'Prolezl jsi za burácející clonu. Pochodeň prská, ale stačí: ve skále je výklenek a v něm vlnovky – 💧 voda. Obkreslil sis je.';
      },
    },
    {
      id: 'taj_sopka', ikona: '🔥', nazev: 'Prohlédnout okraj kráteru', ab: 2,
      kde: s => uLavy(s) && !ma(s, 'ohen'),
      proc: () => null,
      proved(s) {
        pridejSymbol(s, 'ohen');
        const v = T.postavy.vedouci(s); v.zdravi = Math.max(1, v.zdravi - 5);
        return 'Žár pálí do tváře (−5 ❤️). Na černém obsidiánu nad lávou je vyrytý plamen – 🔥 oheň. Kdo sem kdysi lezl s dlátem?';
      },
    },
    {
      id: 'taj_jeskyne', ikona: '🕳️', nazev: 'Prozkoumat jeskyni', ab: 3,
      kde: s => !!lokaceU(s, 'jeskyne') && !stav(s).jeskyne,
      proc: s => (s.zasoby.pochodne || 0) < 2 ? 'Jeskyně je hluboká a tmavá – potřebuješ 2 pochodně 🔥.' : null,
      proved(s) {
        s.zasoby.pochodne -= 2; stav(s).jeskyne = true;
        return 'Chodba se svažuje dolů, vzduch je studený a voní kamenem. Na konci stojí kamenné dveře vyšší než dva muži. ' +
          'Uprostřed spirála 🌀 a kolem ní tři prohlubně – na slunce, vodu a oheň. ' +
          (zbyva(s).length || !ma(s, 'spirala') ? 'Něco ti ještě chybí.' : 'Máš všechno, co potřebuješ.');
      },
    },
    {
      id: 'taj_dvere', ikona: '🚪', nazev: 'Otevřít kamenné dveře', ab: 2,
      kde: s => !!lokaceU(s, 'jeskyne') && stav(s).jeskyne && !stav(s).dvere,
      proc: s => {
        const chybi = ['spirala', 'slunce', 'voda', 'ohen'].filter(x => !ma(s, x));
        if (chybi.length) return `Chybí symboly: ${chybi.map(x => SYMBOLY[x].ikona).join(' ')}.`;
        if ((s.zasoby.pochodne || 0) < 1) return 'Do jeskyně potřebuješ aspoň 1 pochodeň 🔥.';
        return null;
      },
      proved(s) {
        s.zasoby.pochodne--; stav(s).dvere = true;
        return 'Podle obkreslených symbolů jste do prohlubní vtiskli ☀️, 💧 a 🔥 a otočili spirálou 🌀. Něco hluboko ve skále cvaklo. ' +
          'Dveře se se skřípotem odsunuly – a za nimi vedou schody dolů, do tmy, která voní starobylým prachem. ' +
          'Ze spodu táhne vítr. Tam dole je něco obrovského. Bez pořádně vybavené výpravy tam ale nikdo nepůjde.';
      },
    },
    {
      id: 'pochoden', ikona: '🔥', nazev: 'Udělat pochodeň (1 🪵 1 🌿)', ab: 1, vyroba: true,
      kde: s => { const b = T.stavby.stavbaNa(s, idx(s.hrac.x, s.hrac.y)); return !!b && b.typ === 'ohniste'; },
      proc: s => s.zasoby.drevo < 1 || s.zasoby.vlakna < 1 ? 'Potřebuješ 1 🪵 a 1 🌿.' : null,
      proved(s) { s.zasoby.drevo--; s.zasoby.vlakna--; const z = T.hra.pridejZasoby(s, { pochodne: 1 }); return `Omotal jsi klacek vlákny a namočil do pryskyřice (+${z.pochodne || 0} 🔥).`; },
    },
  ];

  // --- loď -----------------------------------------------------------------------------------
  function lod(s) { return s.lod || null; }
  function dil(s) { const l = lod(s); return l && l.dil < DILY.length ? DILY[l.dil] : null; }
  function cenaDilu(s, d) {
    const c = { ...d.cena };
    if (d.id === 'plachta' && s.predmety.includes('plachta')) c.vlakna = 10;     // plachta z bedny ušetří práci
    return c;
  }
  function hotova(s) { const l = lod(s); return !!l && l.dil >= DILY.length; }
  function postup(s) {                         // 0..1
    const l = lod(s); if (!l) return 0;
    const celkem = DILY.reduce((a, d) => a + d.prace, 0);
    let hotovo = DILY.slice(0, l.dil).reduce((a, d) => a + d.prace, 0) + (l.dil < DILY.length ? l.prace : 0);
    return Math.min(1, hotovo / celkem);
  }
  // přidá práci; vrací text o dokončených dílech
  function pracuj(s, n) {
    const l = lod(s), zpr = [];
    while (n > 0 && l.dil < DILY.length && l.zaplaceno) {
      const d = DILY[l.dil], chybi = d.prace - l.prace, k = Math.min(n, chybi);
      l.prace += k; n -= k;
      if (l.prace >= d.prace) {
        zpr.push(`⛵ ${d.nazev} je hotov${d.id === 'plachta' ? 'á' : d.id === 'lanovi' ? 'o' : ''}!`);
        l.dil++; l.prace = 0; l.zaplaceno = false;
        if (l.dil >= DILY.length) zpr.push('⛵ Loď je hotová! Můžete odplout, kdykoli budete chtít.');
      }
    }
    return zpr;
  }
  const naLodenici = s => { const b = T.stavby.stavbaNa(s, idx(s.hrac.x, s.hrac.y)); return !!b && b.typ === 'lodenice'; };
  function potrebaNaCestu(s) { return { jidlo: ZASOBY_NA_CESTU.jidlo * s.lide.length, voda: ZASOBY_NA_CESTU.voda * s.lide.length }; }
  function prekazkaOdplout(s) {
    if (!hotova(s)) return 'Loď ještě není hotová.';
    if (T.pocasi && ['boure', 'vitr'].includes(T.pocasi.dnes(s))) return 'V takovém větru nikdo rozumný nevyplouvá. Počkej, až se to uklidní.';
    const p = potrebaNaCestu(s);
    const chybi = Object.entries(p).filter(([k, v]) => s.zasoby[k] < v);
    if (chybi.length) {
      const kap = T.stavby.kapacita(s, 'voda');
      return `Na cestu potřebujete ${p.jidlo} 🍖 a ${p.voda} 💧 (${ZASOBY_NA_CESTU.jidlo} 🍖 a ${ZASOBY_NA_CESTU.voda} 💧 na každého).` +
        (kap < p.voda ? ` Do nádob se vám vejde jen ${kap} 💧 – postavte nádrž nebo sběrač, nebo vypalte hliněné nádoby.` : '');
    }
    return null;
  }

  AKCE.push(
    {
      id: 'lod_zacit', ikona: '⛵', nazev: 'Připravit další díl lodi', ab: 1,
      kde: s => naLodenici(s) && !!dil(s) && !lod(s).zaplaceno,
      proc: s => {
        const c = cenaDilu(s, dil(s)), chybi = {};
        for (const k in c) if ((s.zasoby[k] || 0) < c[k]) chybi[k] = c[k] - (s.zasoby[k] || 0);
        return Object.keys(chybi).length ? `${dil(s).nazev}: potřeba ${T.stavby.popisCeny(c)}, chybí ${T.stavby.popisCeny(chybi)}.` : null;
      },
      proved(s) {
        const d = dil(s), c = cenaDilu(s, d);
        for (const k in c) s.zasoby[k] -= c[k];
        lod(s).zaplaceno = true;
        return `Materiál na díl „${d.nazev}" je připravený (−${T.stavby.popisCeny(c)}). Teď se na něm musí pracovat (${d.prace} práce).`;
      },
    },
    {
      id: 'lod_pracovat', ikona: '🔨', nazev: 'Pracovat na lodi (všechny zbylé AB)', ab: 1,
      kde: s => naLodenici(s) && !!dil(s) && lod(s).zaplaceno,
      proc: () => null,
      proved(s) {
        const ab = s.ab + 1;                   // 1 AB už odečetla hra
        s.ab = 0;
        const tesar = T.postavy.maProfesi(s, 'tesar', 'vyprava') ? 1.5 : 1;
        const n = Math.round(ab * 2 * tesar * (s.predmety.includes('svitek') ? 1.5 : 1));
        const d = dil(s);
        const zpr = pracuj(s, n);
        return `Celý den jste tesali a vázali (${ab} AB → ${n} práce na díle „${d.nazev}").` + (zpr.length ? ' ' + zpr.join(' ') : '');
      },
    },
  );

  AKCE.push({
    id: 'odplout', ikona: '⛵', nazev: 'Odplout z ostrova', ab: 0,
    kde: s => naLodenici(s) && hotova(s),
    proc: s => prekazkaOdplout(s),
    proved(s) { odplout(s); return '⛵ Zvedli jste kotvu. Ostrov se pomalu ztrácí za obzorem…'; },
  });

  // noční práce lidí přidělených na loď
  function noc(s) {
    const l = lod(s);
    if (!l || !l.zaplaceno) return { zpravy: [], prace: 0 };
    let n = 0;
    for (const o of s.lide) if (o.role === 'lod') n += o.profese === 'tesar' ? 6 : 4;
    if (!n) return { zpravy: [], prace: 0 };
    if (s.predmety.includes('svitek')) n = Math.round(n * 1.5);
    const d = dil(s);
    const zpr = pracuj(s, n);
    return { zpravy: [`Na lodi se pracovalo (+${n} práce na díle „${d.nazev}").`].concat(zpr), prace: n };
  }

  function odplout(s) {
    const d = prekazkaOdplout(s);
    if (d) return { ok: false, duvod: d };
    const p = potrebaNaCestu(s);
    s.zasoby.jidlo -= p.jidlo; s.zasoby.voda -= p.voda;
    s.konec = { typ: 'odplul', den: s.den, lidi: s.lide.length, jmena: s.lide.map(o => o.hrac ? 'Ty' : o.jmeno), tajemstvi: !!stav(s).dvere };
    return { ok: true };
  }

  T.tajemstvi = { DOSAH_KRATERU, krater, uLavy, SYMBOLY, DILY, ZASOBY_NA_CESTU, AKCE, stav, ma, zbyva, seznamSymbolu, lod, dil, cenaDilu, hotova, postup, pracuj, noc,
    prekazkaOdplout, potrebaNaCestu, odplout };
})(TROS);

if (typeof module !== 'undefined') module.exports = TROS;
