/* ============================================================
   Srdce hory – hra.js: stav hry a jeden tah simulace.

   Simulace běží v pevných tazích (10 tahů = 1 s při rychlosti 1×),
   je deterministická ze seedu a nesahá na DOM – dá se spustit
   v node libovolně rychle. Den = 600 tahů (minuta při 1×).

   Práce, které si trpaslík sám najde (nejbližší vyhrává):
     kopat   – označené pole v dosahu
     kacet   – označený strom vedle sebe
     stavet  – plán stavby, na který už je donesený všechen materiál
     donest  – věc, kterou potřebuje plán stavby nebo rozpracovaný výrobek v dílně
     vyrobit – výroba v dílně, kam už je donesený všechen materiál (jen řemeslník dílny)
     vybavit – vyzvednout si nástroj, který se hodí k řemeslu (krumpáč, sekera, kladivo)
     odnes   – věc, která neleží ve skladu, který ji přijímá
     pole    – zasít nebo sklidit pole v zóně pole/houbárna
   Potřeby (jist, pit, spat) mají přednost; kritický hlad práci přeruší.
   ============================================================ */
var TRP = globalThis.TRP = globalThis.TRP || {};

(function (T) {
  'use strict';
  const { W, H, UDOLI, O, M, pevne } = T.hora;
  const C = T.cesty, P = T.prace, S = T.stavby, POT = T.potreby;
  const N = W * H;
  const TAHU_ZA_DEN = 600;
  const DOBA = { chuze: 4, nese: 5, pad: 3, preskok: 7, schod: 6, lez: 6, dolu: 5, padani: 2, zvednout: 4, kacet: 40, tesat: 50,
                 vytah: 1, nastup: 3 };   // výtah: tah na pole šachty + nástup (žebřík a schody 5–6 tahů na pole)
  // doba kroku z a do b podle druhu pohybu (jízda výtahem podle délky)
  const dobaKroku = (typ, a, b, nese) => typ === 'vytah' ? DOBA.nastup + DOBA.vytah * Math.abs((b / W | 0) - (a / W | 0)) : typ === 'chuze' && nese ? DOBA.nese : DOBA[typ];

  const JMENA = ['Durin', 'Dvalin', 'Nár', 'Náin', 'Dáin', 'Bívor', 'Bávor', 'Bombur', 'Nóri', 'Ánar', 'Óin', 'Glóin',
    'Dóri', 'Ori', 'Fíli', 'Kíli', 'Torin', 'Víli', 'Skirfir', 'Virfir', 'Alfr', 'Hanar', 'Frár', 'Hornbori',
    'Lóni', 'Jari', 'Eikin', 'Grerr', 'Brokk', 'Sindri', 'Alvís', 'Andvari', 'Fjalar', 'Galar', 'Regin', 'Hreidmar'];
  const PROFESE = {
    hornik:  { nazev: 'horník', barva: '#d6a82a', kopani: 6 },
    tesar:   { nazev: 'tesař', barva: '#3f7f3a', kopani: 1 },
    kamenik: { nazev: 'kameník', barva: '#8a8f9a', kopani: 3 },
    kovar:   { nazev: 'kovář', barva: '#b23a2a', kopani: 2 },
    sladek:  { nazev: 'sládek', barva: '#b8732e', kopani: 1 },
    farmar:  { nazev: 'farmář', barva: '#7c9a2a', kopani: 1 },
    strazce: { nazev: 'strážce', barva: '#3456a0', kopani: 2 },
  };
  // stupně práce (povoleno[druh]): 0 vypnuto, 1 hlavní, 2 běžná, 3 když není co jiného; hlavní práce podle profese
  // dovednosti: zlepšují se prací, každý stupeň = o 5 % rychlejší práce (mistr 10 = o polovinu); kopání má 0–20 a vlastní
  // vzorec (prace.dobaKopani, zkusenost), boj 0–10 se cvičí a bojuje (hrozby.js) – tady jen zbytek a společné zobrazení
  const DOVEDNOSTI = {
    kopani:  { nazev: 'kopání', ikona: '⛏️', max: 20 },
    stavba:  { nazev: 'stavění', ikona: '🔨', max: 10 },
    noseni:  { nazev: 'nošení a chůze', ikona: '📦', max: 10 },
    kaceni:  { nazev: 'kácení', ikona: '🪓', max: 10 },
    pole:    { nazev: 'polní práce', ikona: '🌾', max: 10 },
    remeslo: { nazev: 'řemeslo', ikona: '⚒️', max: 10 },
    tesani:  { nazev: 'tesání', ikona: '🧱', max: 10 },
    boj:     { nazev: 'boj', ikona: '⚔️', max: 10 },
  };
  const ZACATEK_DOV = { tesar: { remeslo: 3, stavba: 2 }, kamenik: { remeslo: 3, tesani: 3 }, kovar: { remeslo: 3 }, sladek: { remeslo: 3 }, farmar: { pole: 3 } };
  const dov = (t, k) => (t.dov && t.dov[k]) || 0;
  const fDov = (t, k) => 1 + 0.05 * dov(t, k);
  const prahDov = lvl => 4 + 2 * lvl;                   // hotových úkolů na další stupeň (jako u kopání)
  function zlepsi(hra, t, k, body) {
    const D = DOVEDNOSTI[k];
    if (!D || k === 'kopani' || k === 'boj' || dov(t, k) >= D.max) return;
    if (!t.xp) t.xp = {};
    t.xp[k] = (t.xp[k] || 0) + (body || 1);
    if (t.xp[k] < prahDov(dov(t, k))) return;
    t.xp[k] = 0; t.dov[k] = dov(t, k) + 1;
    if (t.dov[k] % 5 === 0) zprava(hra, 'stavba', `${t.jmeno} se zlepšil: ${D.ikona} ${D.nazev} ${t.dov[k]}/${D.max}${t.dov[k] === D.max ? ' – mistr!' : ''}.`, t.i);
  }
  const HLAVNI_PRACE = { hornik: ['kopat'], tesar: ['remeslo'], kamenik: ['remeslo'], kovar: ['remeslo'], sladek: ['remeslo'], farmar: ['pole', 'remeslo'], strazce: ['hlidat'] };
  // nošení a pole mají všichni na 1 (potrava a logistika drží celý klan), ostatní 2, hlavní práce profese 1
  // hlavní práce trpaslíka (barva čepice): vyhrazená dílna → řemeslo; jinak práce na nejvyšším stupni – nošení nepočítá
  // (má ho skoro každý), pole jen u farmáře; stráž má přednost; 3+ rovnocenné práce nebo 2 mimo profesi = null (všestranný)
  function hlavniPrace(t) {
    if (t.dilna) return 'remeslo';
    const p = t.povoleno, hl = HLAVNI_PRACE[t.prof] || [];
    const k = Object.keys(p).filter(x => p[x] && x !== 'nosit' && (x !== 'pole' || hl.includes('pole')));
    if (!k.length) return null;
    const min = Math.min(...k.map(x => p[x])), nej = k.filter(x => p[x] === min);
    if (nej.length >= 3) return null;                         // tři a víc rovnocenných prací = všestranný (šedá)
    if (nej.includes('hlidat')) return 'hlidat';
    if (nej.length === 1) return nej[0];
    return nej.every(x => hl.includes(x)) ? hl.find(x => nej.includes(x)) : null;
  }
  function vychoziStupne(prof) {
    const p = { kopat: 2, kacet: 2, stavet: 2, nosit: 1, pole: 1, remeslo: 2, hlidat: 0 };
    for (const k of HLAVNI_PRACE[prof] || []) p[k] = 1;
    return p;
  }
  const VOUSY = ['#7a4a22', '#b5542a', '#2a2420', '#8f8a82', '#d98a3a', '#e8e2d6', '#c9a560'];

  function novaHra(seed, rezim) {
    const hora = T.hora.generuj(seed);
    const hra = {
      seed: hora.seed, hora, rezim: 'kampan',
      prectene: [], deskyPrectene: [], odemceno: {}, artefakty: {}, spac: { probuzen: false, porazen: false, id: 0 },
      zazehnuti: 0, vyhenHori: false, konec: null, maxTrp: 7, padlo: 0, padloPodle: {},
      znamo: T.hora.pocatecniZnamo(hora),
      lez: new Uint8Array(N),                    // 1 = vytesané schodiště, 2 = žebřík
      oznac: new Uint8Array(N),                  // označené práce (P.OZN)
      stavba: new Uint8Array(N),                 // postavené stavby (S.K)
      zona: new Uint8Array(N),                   // číslo zóny (sklad, místnost, farma)
      prio: new Uint8Array(N),                   // přednostní kopání (⭐)
      uroda: new Uint8Array(N),                  // farmy: 0 prázdné, 1–100 roste, 101 zralé
      svetloZmena: 0,                            // zvýší se při změně tvaru hory nebo loučí
      vykopane: new Uint8Array(N),               // pole vykopaná trpaslíky (přírodní jeskyně drží)
      tesano: new Uint8Array(N),                 // otesaný líc (terén M.ZED): původní hornina – rozpětí stropu a výnos při kopání
      tvorove: [], dalsiNajezd: 36 * TAHU_ZA_DEN, dalsiNajezdTyp: 'utok', oblehani: null, pastiNapnout: [], zabito: 0, najezdu: 0,
      zavreno: new Uint8Array(N), stavbaStav: new Uint8Array(N),   // zavřené mříže; stav pastí a poškození dveří
      praskani: [], prameny: [], stabilitaZmena: 1, stabilitaKlid: 0, vodaKlid: false, klidKroku: 0, odteklo: 0, odcerpano: 0,
      zony: [], plany: [], dilny: [], parezy: [], nouze: {},
      planNa: new Map(), materialNa: new Map(),  // odvozené: pole → plán, pole → materiál nábytku
      trpaslici: [], veci: [], rez: new Map(),   // rez: pole → id trpaslíka, který ho kope / kácí
      tik: 0, dalsiId: 1, rng: (hora.seed ^ 0x2545F491) | 0,
      denik: [], nalezeno: {}, objeveno: {}, vykopano: 0, nejhloubeji: 0,
      slava: 0, slavaBonus: 0, karavana: null, udalost: null, posledniDar: 0,
      poplach: false,                            // poplach vyhlášený hráčem: civilisté se schovají (viz ukryjSe)
      zachrany: [],                              // evidence záchranných žebříků a schodišť (viz hlidejZachrany)
    };
    const { brana } = hora;
    // výchozí sklad: podlaha předsíně
    S.novaZona(hra, brana.x + 1, brana.y, brana.x + 5, brana.y, 'sklad', 'vse');
    const prof = ['hornik', 'hornik', 'kamenik', 'tesar', 'kovar', 'sladek', 'farmar'];
    const jmena = JMENA.slice();
    for (let k = 0; k < prof.length; k++) {
      const j = jmena.splice(Math.floor(P.nahoda(hra) * jmena.length), 1)[0];
      const x = k < 3 ? brana.x - 3 + k : brana.x + 1 + (k - 3);
      pridejTrpaslika(hra, j, prof[k], brana.y * W + x);
    }
    // zásoby, se kterými klan přišel: dřevo na první žebříky a dílnu, jídlo a pivo zhruba na pět dní
    for (let k = 0; k < 6; k++) P.novaVec(hra, 'drevo', brana.y * W + brana.x + 1 + (k % 3), 'drevo');
    for (let k = 0; k < 30; k++) P.novaVec(hra, 'jidlo', brana.y * W + brana.x + 4 + (k & 1), 0);
    for (let k = 0; k < 30; k++) P.novaVec(hra, 'pivo', brana.y * W + brana.x + 2 + (k & 1), 0);
    for (let k = 0; k < 2; k++) P.novaVec(hra, 'krumpac', brana.y * W + brana.x + 1, 'med');   // staré měděné krumpáče
    // zakladatelé jsou přátelé po dvojicích (sedmý s prvním) – bez náhody, ať se neposune průběh hry
    const z = hra.trpaslici;
    for (let k = 0; k < z.length; k++) spratel(z[k], z[k % 2 ? k - 1 : (k + 1) % z.length]);
    zprava(hra, 'pribeh', `Klan dorazil k Bráně předků hory ${hora.nazev}. Hora mlčí.`, hora.brana.y * W + hora.brana.x);
    if (rezim === 'volny') hra.rezim = 'volny';
    POT.obnovProstredi(hra);
    return hra;
  }
  function pridejTrpaslika(hra, jmeno, prof, i) {
    const t = {
      id: hra.dalsiId++, jmeno, prof,
      vous: VOUSY[Math.floor(P.nahoda(hra) * VOUSY.length)],
      i, o: i, t: 0, dur: 0, smer: P.nahoda(hra) < 0.5 ? 1 : -1,
      stav: 'nic', prace: null, cesta: [], nese: 0, akce: 0, akceDoba: 0,
      zdravi: 100, dov: { kopani: PROFESE[prof].kopani }, zkusenost: 0, pad: 0, cekej: 0, hledej: 0, uvizl: false,
    };
    POT.vychozi(t);
    t.nastroj = null; t.zbran = null; t.zbroj = null; t.dov.boj = prof === 'strazce' ? 3 : 0; t.utok = 0;
    Object.assign(t.dov, ZACATEK_DOV[prof] || {}); t.xp = {};
    t.povoleno = vychoziStupne(prof);
    hra.trpaslici.push(t);
    return t;
  }

  // přátelství (t.pratele = id, nejvýš 3): smrt přítele bolí víc než smutek celého klanu (viz umri)
  const MAX_PRATEL = 3;
  function spratel(a, b) {
    if (!a || !b || a === b) return;
    for (const [x, y] of [[a, b], [b, a]]) {
      const p = x.pratele || (x.pratele = []);
      if (!p.includes(y.id) && p.length < MAX_PRATEL) p.push(y.id);
    }
  }
  function noveJmeno(hra, vyloucit) {
    const pouzita = new Set(hra.trpaslici.map(t => t.jmeno).concat(vyloucit || []));
    const volna = JMENA.filter(j => !pouzita.has(j));
    if (volna.length) return volna[Math.floor(P.nahoda(hra) * volna.length)];
    return JMENA[Math.floor(P.nahoda(hra) * JMENA.length)] + ' ' + ['mladší', 'z Údolí', 'Kamenný', 'Rudovous'][Math.floor(P.nahoda(hra) * 4)];
  }
  function nahodnaProfese(hra) { const k = Object.keys(PROFESE); return k[Math.floor(P.nahoda(hra) * k.length)]; }
  // zvukové a vizuální události pro prohlížeč (neukládají se; UI je každý snímek vybere)
  function zvuk(hra, typ, i, x) {
    const z = hra._zvuky || (hra._zvuky = []);
    if (z.length < 80) z.push({ typ, i: i === undefined ? -1 : i, x });
  }
  // i = pole, kde se věc stala (klik na zprávu v oznámení nebo deníku tam posune pohled)
  function zprava(hra, typ, text, i) {
    if (typ === 'objev' || typ === 'nalez') zvuk(hra, 'objev');
    else if (typ === 'smrt') zvuk(hra, 'smrt');
    const z = { tik: hra.tik, typ, text };
    if (i >= 0) z.i = i;
    hra.denik.push(z);
    if (hra.denik.length > 200) hra.denik.shift();
  }

  // --- pomocné -------------------------------------------------------------------------
  const vecPodle = (hra, id) => hra.veci.find(v => v.id === id);
  const dilnaPodle = (hra, id) => hra.dilny.find(d => d.id === id);
  // Kdo smí pracovat v dílně: trpaslík přiřazený k jinému typu dílny nikde jinde; k typu dílny přiřazení mají
  // výhradu; jinak ji obsluhuje její řemeslník (s povolenou dílnou) a když žádný takový není, kdokoli.
  function smiVDilne(hra, t, d) {
    if (t.dilna && t.dilna !== d.typ) return false;
    if (hra.trpaslici.some(u => u.dilna === d.typ)) return t.dilna === d.typ;
    // přednost má řemeslník dané profese – ale jen ten, kdo dílnu opravdu dělat smí (má ji povolenou a jiné pracoviště nemá)
    const prof = S.PROFESE_DILNY[d.typ];
    if (t.prof === prof || !hra.trpaslici.some(u => u.prof === prof && u.povoleno.remeslo && !u.dilna)) return true;
    // řemeslník nestíhá: připravená dílna čeká déle než ZASKOK tiků (u kuchyně v nouzi hned) → zaskočí kdokoli
    return (d.typ === 'kuchyne' && hra.nouze && hra.nouze.hlad) || (d.cekaOd > 0 && hra.tik - d.cekaOd >= ZASKOK);
  }
  const ZASKOK = 100;
  const LEKCE = 60;                                  // délka jedné lekce výcviku strážce (tahů)
  // přiřazení trpaslíka k jednomu typu dílny (null = zrušit); ostatní práce se mu vypnou a po zrušení vrátí
  function nastavDilnu(hra, t, typ) {
    if (typ) {
      if (!t.dilna) t.povolenoPred = Object.assign({}, t.povoleno);
      t.dilna = typ;
      for (const k of Object.keys(t.povoleno)) t.povoleno[k] = k === 'remeslo' ? 1 : 0;
    } else if (t.dilna) {
      delete t.dilna;
      if (t.povolenoPred) { Object.assign(t.povoleno, t.povolenoPred); delete t.povolenoPred; }
    }
    if (t.prace) pustPraci(hra, t);
  }
  const receptPro = (d, z) => S.RECEPTY[d.typ][z.r];
  // dílna na dvě pole má dvě pracoviště – dva trpaslíci vyrábějí současně: 0 = dílna sama (d.vRobe, d.rez), 1 = d.m2
  const mistoDilny = (d, k) => k ? (d.m2 || (d.m2 = { vRobe: null, rez: 0 })) : d;
  const mista = d => [d, mistoDilny(d, 1)];
  // počty věcí podle druhu (i nesených) – pro trvalé zakázky „udržuj zásobu"
  function pocty(hra) { const m = {}; for (const v of hra.veci) m[v.druh] = (m[v.druh] || 0) + 1; return m; }
  function aktivni(d, z, pocet) {
    const vRobe = mista(d).filter(m => m.vRobe && m.vRobe.zak === z.id).length;
    if (z.trvala) { const rc = receptPro(d, z); return (pocet[rc.vyrobek] || 0) + vRobe * (rc.pocet || 1) < z.cil; }
    return z.zbyva - vRobe > 0;
  }
  const SUROVINY_KUCHYNE = new Set(S.RECEPTY.kuchyne.flatMap(rc => rc.mat));
  // pracoviště přijde o rozpracovaný výrobek: kdo na něm dělá nebo nese materiál, pustí práci; donesený materiál vypadne na zem
  function uvolniMisto(hra, d, k) {
    const m = mistoDilny(d, k);
    if (!m.vRobe) return;
    for (const t of hra.trpaslici) if (t.prace && t.prace.dilna === d.id && (t.prace.misto || 0) === k) { t.prace.vCeste = 0; pustPraci(hra, t); }
    for (const [druh, n] of Object.entries(m.vRobe.doneseno)) for (let j = 0; j < n; j++) P.novaVec(hra, druh, d.i, 0);
    m.vRobe = null; m.rez = 0;
    P.usadVeci(hra);
  }
  // Kam se dá dojít ze skladů (BFS od všech stojných polí skladů) – jednou za tah (WeakMap, neukládá se; čistá funkce
  // stavu, takže načtená hra počítá totéž). null = žádný sklad (pak se dosažitelnost nehlídá).
  const dosahCache = new WeakMap();
  function dosahSkladuTik(hra) {
    const c = dosahCache.get(hra);
    if (c && c.tik === hra.tik) return c.F;
    const F = dosahSkladu(hra);
    dosahCache.set(hra, { tik: hra.tik, F });
    return F;
  }
  // dá se k věci dojít ze skladu? (věc ve skladu ano; jinak pole věci v dosahu skladů)
  const dosazitelna = (hra, v, F) => !F || F[v.i] === 1 || S.jeSklad(hra, v.i);
  // Volné věci podle druhu pro rezervace dílen: jen ty, ke kterým se dá dojít (věc v jámě bez cesty by dílnu zasekla –
  // donesla by se jen část materiálu). Dosah se počítá líně: jen když věci ve skladech nestačí.
  function volneProDilny(hra) {
    const vse = {}, veSkladu = {};
    for (const v of hra.veci) if (!v.nese && !v.rez) { vse[v.druh] = (vse[v.druh] || 0) + 1; if (hra.zona[v.i] && S.jeSklad(hra, v.i)) veSkladu[v.druh] = (veSkladu[v.druh] || 0) + 1; }
    let dosah = null;
    const ubrano = {};
    return {
      // kolik kusů druhu je k dispozici po odečtení už rozebraných; výsledek ≥ n právě tehdy, když jich je opravdu
      // aspoň n (když stačí sklad, vrátí dolní odhad a dosah se nepočítá)
      pocet(druh, n) {
        const u = ubrano[druh] || 0;
        if ((veSkladu[druh] || 0) - u >= n) return (veSkladu[druh] || 0) - u;
        if ((vse[druh] || 0) - u < n) return (vse[druh] || 0) - u;
        if (!dosah) {
          dosah = {};
          const F = dosahSkladuTik(hra);
          for (const v of hra.veci) if (!v.nese && !v.rez && dosazitelna(hra, v, F)) dosah[v.druh] = (dosah[v.druh] || 0) + 1;
        }
        return (dosah[druh] || 0) - u;
      },
      uber(druh, n) { ubrano[druh] = (ubrano[druh] || 0) + n; },
    };
  }
  // Příběhové zakázky (Klíč, artefakty, hvězdná ocel, šperk, brus, pohár a zlaté pruty pro ně) mají v dílnách přednost
  // před trvalými zakázkami a drží si materiál (uhlí, drahokamy…), dokud kusovník Klíče něco z nich potřebuje.
  const pribehovaZakazka = (d, z, kus) => { const v = receptPro(d, z).vyrobek; return v.startsWith('art_') || (kus && (kus.chybi[v] || 0) > 0); };
  const CEKANI_NA_MATERIAL = 2 * TAHU_ZA_DEN;       // pracoviště, kterému materiál chybí (nedostupný) tak dlouho, se uvolní
  // dílna bez rozpracovaného výrobku si vezme první zakázku, na kterou je materiál
  function pripravDilny(hra) {
    let volne = null, pocet = null;
    for (const d of hra.dilny) {
      // artefakt už vyrobený jinde: zakázka zmizí; pracoviště, které na ní dělá (i na zrušené zakázce), se uvolní
      d.fronta = d.fronta.filter(z => !T.pribeh.artefaktZakazany(hra, receptPro(d, z).vyrobek));
      mista(d).forEach((m, k) => { if (m.vRobe && !d.fronta.some(z => z.id === m.vRobe.zak)) uvolniMisto(hra, d, k); });
      // žádné pracoviště nečeká připravené → čekání (ZASKOK) se počítá znovu
      if (d.cekaOd && !mista(d).some(m => !m.rez && dilnaPripravena(d, m))) d.cekaOd = 0;
    }
    const vol = () => volne || (volne = volneProDilny(hra));
    // rozpracovaná pracoviště si drží, co jim ještě chybí (nikdo jiný jim to nevezme); když chybějící materiál dlouho
    // nikde dosažitelný neleží (spadl do jámy, vzal ho jiný odběratel), pracoviště se uvolní a donesené vypadne na zem
    for (const d of hra.dilny) mista(d).forEach((m, k) => {
      if (!m.vRobe || dilnaPripravena(d, m)) { if (m.chybiOd) delete m.chybiOd; return; }
      const kontrola = hra.tik % 120 === 0;          // dostupnost (může stát hledání dosahu) jen jednou za 120 tahů
      let chybi = false;
      for (const druh of Object.keys(m.vRobe.doneseno)) {
        const n = chybiDilne(hra, d, druh, m);
        if (n <= 0) continue;
        if (kontrola && vol().pocet(druh, n) < n) chybi = true;
        vol().uber(druh, n);
      }
      if (!kontrola) return;
      if (!chybi) { if (m.chybiOd) delete m.chybiOd; return; }
      if (!m.chybiOd) m.chybiOd = hra.tik;
      else if (hra.tik - m.chybiOd >= CEKANI_NA_MATERIAL && !Object.values(m.vRobe.vCeste).some(n => n > 0)) {
        delete m.chybiOd;
        uvolniMisto(hra, d, k);
        volne = null;                                 // vrácený materiál leží u dílny – spočítat znovu
      }
    });
    // v nouzi o jídlo si kuchyně berou suroviny první a ostatní dílny (pivovar) z nich nové zakázky nezačnou
    const hlad = hra.nouze && hra.nouze.hlad && hra.dilny.some(d => d.typ === 'kuchyne');
    const poradi = hlad ? hra.dilny.filter(d => d.typ === 'kuchyne').concat(hra.dilny.filter(d => d.typ !== 'kuchyne')) : hra.dilny;
    if (!poradi.some(d => d.fronta.length && mista(d).some(m => !m.vRobe))) return;
    const kus = T.pribeh.kusovnikKlice(hra);           // null = Klíč nic nepotřebuje (není odemčený, už je, volný režim)
    const rezerva = {};
    const zkus = (d, mi, z) => {
      if (!aktivni(d, z, pocet || (pocet = pocty(hra)))) return false;
      const m = S.materialReceptu(receptPro(d, z));
      const pribeh = kus && pribehovaZakazka(d, z, kus);
      if (Object.entries(m).some(([druh, n]) => vol().pocet(druh, n + (pribeh ? 0 : rezerva[druh] || 0)) - (pribeh ? 0 : rezerva[druh] || 0) < n)) return false;
      if (hlad && d.typ !== 'kuchyne' && Object.keys(m).some(druh => SUROVINY_KUCHYNE.has(druh))) return false;
      mi.vRobe = { zak: z.id, doneseno: {}, vCeste: {} };
      for (const druh of Object.keys(m)) { mi.vRobe.doneseno[druh] = 0; mi.vRobe.vCeste[druh] = 0; vol().uber(druh, m[druh]); }
      // trvalá zakázka vzala poslední uhlí, které by potřeboval Klíč – jednou za hru varování
      if (kus && !pribeh && z.trvala && m.uhli && kus.chybi.uhli > 0 && vol().pocet('uhli', 1) <= 0 && !hra.odemceno.varUhli) {
        hra.odemceno.varUhli = true;
        zprava(hra, 'varovani', `⚠️ Trvalá zakázka (${S.STAVBY[d.typ].nazev}: ${receptPro(d, z).nazev || P.VECI[receptPro(d, z).vyrobek].nazev}) spotřebovala poslední uhlí – Klíč k Srdci ho potřebuje (hvězdná ocel, zlaté pruty). Ztlum trvalé zakázky nebo postav milíř.`, d.i);
      }
      return true;
    };
    // 1) příběhové zakázky (v pořadí dílen), 2) rezerva materiálu na příběh, který zatím začít nejde, 3) ostatní
    if (kus) {
      for (const d of poradi) for (const mi of mista(d)) {
        if (mi.vRobe) continue;
        for (const z of d.fronta) if (pribehovaZakazka(d, z, kus) && zkus(d, mi, z)) break;
      }
      for (const [druh, n] of Object.entries(kus.drzet)) if (n > 0) rezerva[druh] = n;
    }
    for (const d of poradi) for (const mi of mista(d)) {
      if (mi.vRobe || !d.fronta.length) continue;
      for (const z of d.fronta) if (!(kus && pribehovaZakazka(d, z, kus)) && zkus(d, mi, z)) break;
    }
  }
  function chybiDilne(hra, d, druh, m = d) {        // m = pracoviště (viz mistoDilny)
    if (!m.vRobe) return 0;
    const z = d.fronta.find(z => z.id === m.vRobe.zak);
    if (!z) return 0;
    return (S.materialReceptu(receptPro(d, z))[druh] || 0) - (m.vRobe.doneseno[druh] || 0) - (m.vRobe.vCeste[druh] || 0);
  }
  function dilnaPripravena(d, m = d) {
    if (!m.vRobe) return false;
    const z = d.fronta.find(z => z.id === m.vRobe.zak);
    if (!z) return false;
    return Object.entries(S.materialReceptu(receptPro(d, z))).every(([druh, n]) => (m.vRobe.doneseno[druh] || 0) >= n);
  }
  // nástroje
  function faktorNastroje(t, prace) {
    const n = t.nastroj, d = n && S.NASTROJE[n.druh];
    return d && d.prace.includes(prace) ? d[n.mat] || 1 : 1;
  }
  function opotrebuj(hra, t, prace) {
    const n = t.nastroj;
    if (!n || !S.NASTROJE[n.druh].prace.includes(prace)) return;
    n.stav -= S.OPOTREBENI[n.mat] || 2;
    if (n.stav <= 0) {
      zprava(hra, 'nalez', `${t.jmeno} zlomil ${P.VECI[n.druh].nazev === 'kladivo' ? 'kladivo' : P.VECI[n.druh].nazev}. Bude potřeba nový.`, t.i);
      t.nastroj = null;
    }
  }

  // --- pohyb ------------------------------------------------------------------------
  function presun(t, cil, doba) {
    const dx = cil % W - t.i % W;
    if (dx) t.smer = dx > 0 ? 1 : -1;
    t.o = t.i; t.i = cil; t.t = 0; t.dur = doba;
  }
  function pustPraci(hra, t) {
    const p = t.prace;
    if (p && T.hra.ladeniPusteni) T.hra.ladeniPusteni(hra, t, p);     // háček pro ladicí nástroje (bot), ve hře prázdný
    if (p) {
      if ((p.typ === 'kopat' || p.typ === 'kacet' || p.typ === 'bourat' || p.typ === 'pole' || p.typ === 'pumpovat' || p.typ === 'cist' || p.typ === 'tesat') && hra.rez.get(p.c) === t.id) hra.rez.delete(p.c);
      if (p.vec) { const v = vecPodle(hra, p.vec); if (v && v.rez === t.id) v.rez = 0; }
      if (p.typ === 'stavet') { const pl = S.planPodle(hra, p.plan); if (pl && pl.rez === t.id) pl.rez = 0; }
      if (p.typ === 'donest' && p.vCeste && p.plan) { const pl = S.planPodle(hra, p.plan); if (pl) pl.vCeste[p.druh]--; }
      if (p.typ === 'donest' && p.vCeste && p.dilna) { const d = dilnaPodle(hra, p.dilna), m = d && mistoDilny(d, p.misto); if (m && m.vRobe) m.vRobe.vCeste[p.druh]--; }
      if (p.typ === 'vyrobit') { const d = dilnaPodle(hra, p.dilna), m = d && mistoDilny(d, p.misto); if (m && m.rez === t.id) m.rez = 0; }
    }
    if (t.nese) {                                // co nese, položí, kde stojí
      const v = vecPodle(hra, t.nese);
      if (v) { v.nese = 0; v.rez = 0; v.i = t.i; }
      t.nese = 0;
      P.usadVeci(hra);
    }
    t.prace = null; t.cesta = []; t.akce = 0; t.stav = 'nic';
  }

  function deskaKPrecteni(hra) {
    for (const o of hra.hora.ruiny) if (hra.objeveno[o.cislo])
      for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) {
        const i = y * W + x;
        if (hra.hora.obj[i] === O.DESKA && hra.znamo[i] && !hra.deskyPrectene.includes(i) && !hra.rez.has(i)) return true;
      }
    return false;
  }

  // otesání stěny: cíl z pole i (stojí tu) – pozadí pod nohama nebo nad hlavou; hlina = jen stěny, na které je třeba kámen
  function cilTesani(hra, i, hlina, t) {
    const vhodne = j => {
      if (j < 0 || j >= N || hra.oznac[j] !== P.OZN.TESAT || !P.lzeTesat(hra, j) || P.tesatZaKamen(hra, j) !== hlina) return false;
      const r = hra.rez.get(j);
      return !r || (t && r === t.id);
    };
    for (const j of [i, i - W, i - 2 * W]) if (vhodne(j) && hra.hora.teren[j] === M.VZDUCH && (j !== i - 2 * W || C.volne(hra, i - W))) return j;   // zadní stěna u sebe a nad sebou (přes volno)
    return P.licZDosahu(hra, i, c => hra.hora.teren[c] !== M.VZDUCH && vhodne(c) ? c : -1);               // líc horniny v dosahu
  }
  // kolik stěn čeká na otesání (a z toho hliněných) – jednou za tah, značky se nemění často
  // (jen stěny, které jde otesat a na které se dá dosáhnout – zatopená nebo vysoko nad podlahou čeká)
  function tesani(hra) {
    if (hra._tesani && hra._tesani.tik === hra.tik) return hra._tesani;
    const r = { tik: hra.tik, vse: 0, hlina: 0 };
    for (let i = 0; i < N; i++) if (hra.oznac[i] === P.OZN.TESAT && !hra.rez.has(i) && P.lzeTesat(hra, i) && P.kTesani(hra, i)) { r.vse++; if (P.tesatZaKamen(hra, i)) r.hlina++; }
    return (hra._tesani = r);
  }
  const kacetelne = o => o === O.STROM || o === O.HOUBA;     // obří houba se kácí jako strom (dá houby)
  // --- farmy do zásoby (S.cilFarmy): kolik plodiny je v hoře (i nesené) – jednou za tah
  const zasobaCache = new WeakMap();
  function zasobaPlodin(hra) {
    const c = zasobaCache.get(hra);
    if (c && c.tik === hra.tik) return c;
    const r = { tik: hra.tik, houby: 0, jecmen: 0, drevo: 0 };
    for (const v of hra.veci) if (v.druh === 'houby' || v.druh === 'jecmen' || v.druh === 'drevo') r[v.druh]++;
    zasobaCache.set(hra, r);
    return r;
  }
  // chce zóna sklízet? (zásoba plodiny pod cílem; pole na podzim sklízí vždy – zbytek by spálil mráz)
  function farmaSklizi(hra, z) {
    const c = S.cilFarmy(hra, z);
    if (!c) return false;
    if (z.typ === 'pole' && T.obdobi.obdobi(hra) === 2) return true;
    return zasobaPlodin(hra)[c.plodina] < c.cil;
  }
  // práce na poli farmy i (u = hra.uroda[i]): zasít / sklidit (pole, houbárna), zasadit / pokácet (lesní školka)
  function farmaPrace(hra, z, i, zima) {
    if (z.typ === 'les') {                          // pod zemí obří houby (rostou i v zimě)
      const o = hra.hora.obj[i];
      if (o === O.STROM || o === O.HOUBA) return farmaSklizi(hra, z);
      return (!zima || hra.hora.pozadi[i] !== M.VZDUCH) && (!o || o === O.TRAVA);
    }
    if (z.typ === 'pole' && zima) return false;
    return hra.uroda[i] === 0 || farmaSklizi(hra, z);
  }
  // houbárna: roste 2 (za 30 tahů), u vody nebo ve vlhké jeskyni 3; mělko pod povrchem (do 12 m) v zimě o 1 pomaleji
  const VLHKE = new Set(['houbova', 'krapnikova', 'jezero']);
  // (bez mezipaměti: čistá funkce stavu – dřív se pamatovala na celý den od prvního dotazu a načtená hra se rozcházela;
  // počítá se jen pro pole houbáren jednou za 30 tahů, 49 polí okolí je levných)
  function vlhkaHoubarna(hra, i) {
    const ob = hra.hora.oblast[i] && hra.hora.oblasti.find(o => o.cislo === hra.hora.oblast[i]);
    if (ob && VLHKE.has(ob.typ)) return true;
    const x = i % W, y = i / W | 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < W && yy < H && hra.hora.teren[yy * W + xx] === M.VODA) return true;
    }
    return false;
  }
  const MELKO = 12;
  function rustHoubarny(hra, i, zima) {
    const r = vlhkaHoubarna(hra, i) ? 3 : 2;
    return zima && (i / W | 0) - UDOLI < MELKO ? r - 1 : r;
  }
  // pole, odkud by šlo něco kopat (okolí označených polí podle P.DOSAH) – jednou za tah. Během tahu značky
  // jen mizí (vykopání), takže množina zůstane nadmnožinou; přesně rozhodne P.cilKopani.
  const kandKopaniCache = new WeakMap();
  function kandidatiKopani(hra) {
    let a = kandKopaniCache.get(hra);
    if (a && a.tik === hra.tik) return a;
    if (!a) { a = new Uint32Array(N); kandKopaniCache.set(hra, a); }
    a.tik = hra.tik;
    const o = hra.oznac;
    for (let c = 0; c < N; c++) {
      if (o[c] !== P.OZN.KOPAT && o[c] !== P.OZN.SCHODY) continue;
      for (const d of P.DOSAH) { const j = c - d[1] * W - d[0]; if (j >= 0 && j < N) a[j] = a.tik; }
    }
    return a;
  }
  // je někde značka k bourání? (jednou za tah – ať se okolí polí při hledání práce zbytečně neprochází)
  const bouraniCache = new WeakMap();
  function nejakeBourani(hra) {
    const c = bouraniCache.get(hra);
    if (c && c.tik === hra.tik) return c.ano;
    const ano = hra.oznac.indexOf(P.OZN.BOURAT) >= 0;
    bouraniCache.set(hra, { tik: hra.tik, ano });
    return ano;
  }
  const UROVNE = [0, 0.5, 0.9, 1, 1.9, 2, 2.9, 3];   // pořadí hledání práce (viz stupen v najdiPraci)
  function najdiPraci(hra, t) {
    // volné věci podle pole (mapa jednou za tah; rezervace a přesuny během tahu ověří volnaVec)
    const naPoli = P.volneVeci(hra), volnaVec = P.volnaVec;
    const nz = hra.nouze || {};
    // kdo co potřebuje (plány staveb, zakázky dílen)
    const potreba = new Map();
    const pridej = (druh, s) => { const a = potreba.get(druh); if (a) a.push(s); else potreba.set(druh, [s]); };
    for (const p of hra.plany) {
      if (p.blok > hra.tik) continue;             // na plán se teď nikdo nedostane
      if (!S.volnoProPlan(hra, p)) continue;        // pole se teprve vykope – materiál až potom
      if (!S.mistoPlanu(hra, p)) continue;          // stavba na podlahu bez podlahy čeká
      for (const druh of Object.keys(S.STAVBY[p.typ].mat)) if (S.chybi(p, druh) > 0) pridej(druh, { plan: p });
    }
    const pov = t.povoleno;
    if (!pov.nosit) potreba.clear();
    // materiál do dílen nosí nosiči; trpaslík vyhrazený k dílně si ho do své dílny nosí sám
    for (const d of hra.dilny) if (pov.nosit || (pov.remeslo && t.dilna === d.typ)) mista(d).forEach((m, k) => {
      if (m.vRobe) for (const druh of Object.keys(m.vRobe.doneseno)) if (chybiDilne(hra, d, druh, m) > 0) pridej(druh, { dilna: d, m: k });
    });
    // nástroj podle řemesla: kdo žádný nemá, vezme jakýkoli; kdo má měděný, vymění ho za železný
    const prefDruh = S.PREFERUJE[t.prof];
    const pref = prefDruh && (!t.nastroj || (t.nastroj.druh === prefDruh && t.nastroj.mat === 'med')) ? prefDruh : null;
    const zimaTed = T.obdobi.zima(hra);
    // které druhy nějaký sklad přijímá
    const prijima = new Set();
    for (const z of hra.zony) if (z.typ === 'sklad') for (const d of S.prijimaneDruhy(z)) prijima.add(d);

    // Klíč k Srdci: jakmile je Srdce objevené, zažehnutí má přednost
    const klic = pov.remeslo && !hra.vyhenHori && !(t.klicBlok > hra.tik) && hra.znamo[hra.hora.srdce.y * W + hra.hora.srdce.x] && hra.veci.find(v => v.druh === 'klic' && !v.nese && !v.rez && !(v.blok > hra.tik));
    if (klic) {
      const rk = C.hledej(hra, t.i, i => i === klic.i ? { typ: 'zazehnout', vec: klic.id, pos: i, faze: 'k_veci' } : 0);
      if (rk) { klic.rez = t.id; t.prace = rk.hodnota; t.cesta = rk.cesta; t.stav = 'jde'; t.akce = 0; return true; }
      t.klicBlok = hra.tik + 100;
    }
    // nalezenou runovou desku jde řemeslník přečíst přednostně
    if (pov.remeslo && !(hra.deskaBlok > hra.tik) && hra.hora.ruiny.some(o => hra.objeveno[o.cislo]) && deskaKPrecteni(hra)) {
      const rd = C.hledej(hra, t.i, i => hra.hora.obj[i] === O.DESKA && hra.znamo[i] && !hra.deskyPrectene.includes(i) && !hra.rez.has(i) && C.stojne(hra, i) ? { typ: 'cist', c: i, pos: i } : 0);
      if (rd) { hra.rez.set(rd.hodnota.c, t.id); t.prace = rd.hodnota; t.cesta = rd.cesta; t.stav = 'jde'; t.akce = 0; return true; }
      hra.deskaBlok = hra.tik + 100;                // zatím se k ní nikdo nedostane
    }
    // materiál, na který čeká dílna nebo plán, se nosí dřív než úklid do skladu
    // v nouzi o jídlo má kuchyně přednost před ostatními odběrateli (pivovar bere tytéž suroviny)
    const chybiKomu = (s, druh) => s.plan ? S.chybi(s.plan, druh) > 0 : chybiDilne(hra, s.dilna, druh, mistoDilny(s.dilna, s.m)) > 0;
    const donest = i => {
      const vv = naPoli.get(i);
      if (vv) for (const v of vv) {
        if (!volnaVec(hra, v, i)) continue;
        const kand = potreba.get(v.druh) || [];
        const kdo = (nz.hlad && kand.find(s => s.dilna && s.dilna.typ === 'kuchyne' && chybiKomu(s, v.druh))) || kand.find(s => chybiKomu(s, v.druh));
        if (kdo) return kdo.plan ? { typ: 'donest', vec: v.id, druh: v.druh, plan: kdo.plan.id, pos: i, faze: 'k_veci' }
                                 : { typ: 'donest', vec: v.id, druh: v.druh, dilna: kdo.dilna.id, misto: kdo.m, pos: i, faze: 'k_veci' };
      }
      return 0;
    };
    // plán s donesenou vším materiálem se staví dřív než ostatní práce (materiál by jinak ležel ladem)
    // (bez připraveného plánu se okolí polí vůbec neprochází)
    const nejakyPripraveny = pov.stavet && hra.plany.some(p => !p.rez && S.pripraven(p));
    const stavet = i => {
      if (!nejakyPripraveny) return 0;
      const x = i % W;
      for (const [dx, dy] of S.STAV_DOSAH) {
        const j = i + dy * W + dx;
        if (j < 0 || j >= N || Math.abs((j % W) - x) > 1) continue;
        const pid = hra.planNa.get(j);
        if (!pid) continue;
        const p = S.planPodle(hra, pid);
        if (p && !p.rez && S.pripraven(p) && S.planVDosahu(hra, i, p) && S.volnoProPlan(hra, p) && S.mistoPlanu(hra, p)) return { typ: 'stavet', plan: p.id, pos: i };
      }
      return 0;
    };
    // --- výběr podle stupňů: 0 = nouze, 1 hlavní, 2 běžná, 3 když není co jiného (pov[druh] = stupeň, 0 = vypnuto) ---
    // ⭐ úkol, rozdělaná práce (donést, postavit připravené) a příběh se posunou o stupeň výš; nouze → stupeň 0
    // tesání stěn: kameník přednostně, jinak kdokoli, kdo staví (když žádný kameník stavět nesmí)
    const tes = pov.stavet && (t.prof === 'kamenik' || !hra.trpaslici.some(u => u.prof === 'kamenik' && u.povoleno.stavet && !u.dilna)) ? tesani(hra) : null;
    // úroveň hledání: 0 nouze · 0,5 ⭐ / připravená dílna / příběh u hlavní práce · pak stupně 1, 2, 3; ⭐ posune
    // o stupeň (až na 0,5); rozdělaná práce (bonus 'r': donést, postavit připravené) jde těsně PŘED ostatní práci
    // téhož stupně (s − 0,1), ale nepředběhne vyšší stupeň – jinak by materiál do dílen nikdo nenosil
    const stupen = (druh, bonus, nouzovy) => { const s = pov[druh]; if (!s) return -1; if (nouzovy) return 0;
      if (bonus === 'r') return s - 0.1; return Math.max(0.5, s - (+bonus || 0)); };
    // stupně, které nezávisí na poli, jednou za hledání
    const sKopatPrio = stupen('kopat', 1), sKacet = stupen('kacet'), sPribeh = stupen('remeslo', true), sPumpa = stupen('nosit', false, nz.voda),
          sPole = stupen('pole', false, nz.hlad && nz.pole), sStavet = stupen('stavet'), sHlidat = stupen('hlidat', true), sNosit = stupen('nosit');
    // trpaslík vyhrazený k dílně (bez nošení) odnese své hotové výrobky od dílny do skladu sám – na stupni řemesla, až
    // když není co vyrábět. Jinak výrobky ležely u dílny, trvalá zakázka „udržuj N" je počítala jako zásobu a dílna
    // stála, i když ve skladu nebylo nic (kuchyně a pivovar s vyhrazenými trpaslíky, nosiči zaměstnaní jinde).
    const sVyrobky = !pov.nosit && t.dilna && pov.remeslo ? stupen('remeslo') : -1;
    const vyrobky = sVyrobky >= 0 ? new Set((S.RECEPTY[t.dilna] || []).map(rc => rc.vyrobek)) : null;
    const uSveDilny = i => { const x = i % W; for (const j of [i, x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1]) { const d = j >= 0 && hra.stavba[j] === S.K.DILNA && S.dilnaNa(hra, j); if (d && d.typ === t.dilna) return true; } return false; };
    const bourat = pov.stavet && nejakeBourani(hra);
    const kandKopat = pov.kopat ? kandidatiKopani(hra) : null;
    const ulohaNa = (i, cil) => {
      if (pov.kopat && kandKopat[i] === kandKopat.tik) {
        if (sKopatPrio === cil) { const c = P.cilKopani(hra, i, hra.rez, true); if (c >= 0) return { typ: 'kopat', c, pos: i }; }
        const c = P.cilKopani(hra, i, hra.rez);
        if (c >= 0 && stupen('kopat', hra.prio[c]) === cil) return { typ: 'kopat', c, pos: i };
      }
      const x = i % W;
      if (sKacet === cil) for (const j of [i, x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1]) {
        if (j >= 0 && hra.oznac[j] === P.OZN.KACET && kacetelne(hra.hora.obj[j]) && !hra.rez.has(j)) return { typ: 'kacet', c: j, pos: i };
      }
      if (sPribeh === cil && hra.hora.obj[i] === O.DESKA && hra.znamo[i] && !hra.deskyPrectene.includes(i) && !hra.rez.has(i) && C.stojne(hra, i))
        return { typ: 'cist', c: i, pos: i };
      if (sPumpa === cil && hra.stavba[i] === S.K.PUMPA && !hra.rez.has(i) && T.priroda.vodaUPumpy(hra, i) >= 0) return { typ: 'pumpovat', c: i, pos: i };
      if (pov.remeslo && hra.stavba[i] === S.K.DILNA) {
        const d = S.dilnaNa(hra, i);
        // pracoviště pod nohama má přednost, jinak to druhé (kdyby jedno pole dílny nebylo stojné)
        const k = d ? [i === d.i ? 0 : 1, i === d.i ? 1 : 0].find(k => { const m = mistoDilny(d, k); return !m.rez && dilnaPripravena(d, m); }) : undefined;
        if (k !== undefined && !d.cekaOd) d.cekaOd = hra.tik;       // od kdy připravená dílna čeká (viz smiVDilne)
        if (k !== undefined && stupen('remeslo', 1, nz.hlad && d.typ === 'kuchyne') === cil && smiVDilne(hra, t, d) && C.stojne(hra, i))   // připravená dílna = rozdělaná práce
          return { typ: 'vyrobit', dilna: d.id, misto: k, pos: i };
      }
      if (sPole === cil && hra.zona[i] && hra.uroda[i] % 101 === 0 && !hra.rez.has(i)) {
        const z = S.zonaNa(hra, i);
        if (z && S.FARMY[z.typ] && C.stojne(hra, i) && farmaPrace(hra, z, i, zimaTed)) return { typ: 'pole', c: i, pos: i };
      }
      if (bourat && sStavet === cil && C.stojne(hra, i)) for (const [dx, dy] of S.STAV_DOSAH) {   // zbourat stavbu v dosahu
        const j = i + dy * W + dx;
        if (j < 0 || j >= N || Math.abs((j % W) - x) > 1 || hra.oznac[j] !== P.OZN.BOURAT || hra.rez.has(j) || !P.lzeBourat(hra, j)) continue;
        return { typ: 'bourat', c: j, pos: i };
      }
      if (tes && tes.vse && sStavet === cil && C.stojne(hra, i)) { const c = cilTesani(hra, i, false); if (c >= 0) return { typ: 'tesat', c, pos: i }; }
      if (pov.stavet) { const st = stavet(i); if (st) { const pl = S.planPodle(hra, st.plan); if (stupen('stavet', pl.prio ? 2 : S.STAVBY[pl.typ].nabytek ? 1 : 'r', nz.strop && pl.typ === 'podpera') === cil) return st; } }
      if (potreba.size) {
        const dn = donest(i);
        const kuch = dn && nz.hlad && dn.dilna && dilnaPodle(hra, dn.dilna).typ === 'kuchyne';
        if (dn && (pov.nosit ? stupen('nosit', dn.plan && S.planPodle(hra, dn.plan).prio ? 1 : 'r', kuch || (nz.strop && dn.plan && S.planPodle(hra, dn.plan).typ === 'podpera'))
                             : stupen('remeslo', 'r', kuch)) === cil) return dn;      // bez nošení: jen do vlastní dílny, na stupni řemesla
      }
      const vv = naPoli.get(i);
      // co přijímá sklad na tomto poli (jednou na pole, ne na každou věc)
      const zi = vv && hra.zona[i] ? S.zonaNa(hra, i) : null, prijimaTu = zi && zi.typ === 'sklad' ? S.prijimaneDruhy(zi) : null;
      if (vv) for (const v of vv) {
        if (!volnaVec(hra, v, i)) continue;
        if (v.druh === 'klic' && sPribeh === cil && !hra.vyhenHori && hra.znamo[hra.hora.srdce.y * W + hra.hora.srdce.x])
          return { typ: 'zazehnout', vec: v.id, pos: i, faze: 'k_veci' };
        if (tes && tes.hlina && !(hra.tesatBlok > hra.tik) && v.druh === 'kamen' && sStavet === cil) return { typ: 'tesat', vec: v.id, pos: i, faze: 'k_veci' };   // kámen na obklad hliněné stěny
        if (cil === 0.5 && pref && v.druh === pref && (!t.nastroj || v.mat === 'zelezo')) return { typ: 'vybavit', vec: v.id, pos: i, faze: 'k_veci' };
        if (sHlidat === cil && ((!t.zbran && v.druh === 'valecna_sekera') || (!t.zbroj && v.druh === 'zbroj'))) return { typ: 'vybavit', vec: v.id, pos: i, faze: 'k_veci' };
        if ((sNosit === cil || (sVyrobky === cil && vyrobky.has(v.druh) && uSveDilny(i))) && !(prijimaTu && prijimaTu.has(v.druh)) && prijima.has(v.druh) && !(zi && zi.typ === 'jidelna' && S.DRUHY_JIDELNY.has(v.druh)))
          return { typ: 'odnes', vec: v.id, pos: i, faze: 'k_veci' };
      }
      return 0;
    };
    // které stupně vůbec připadají v úvahu (ať se nehledá zbytečně) a krátká blokace neúspěšného hledání
    const mozne = new Set([0.5]);
    for (const k of Object.keys(pov)) if (pov[k]) { mozne.add(pov[k]); mozne.add(pov[k] - 0.1); mozne.add(Math.max(0.5, pov[k] - 1)); mozne.add(Math.max(0.5, pov[k] - 2)); }
    if (nz.hlad || nz.strop || nz.voda) mozne.add(0);
    if (!t.urovenBlok || t.urovenBlok.length !== UROVNE.length) t.urovenBlok = UROVNE.map(() => 0);
    let r = null;
    for (let u = 0; u < UROVNE.length && !r; u++) {
      const cil = UROVNE[u];
      if (!mozne.has(cil) || t.urovenBlok[u] > hra.tik) continue;
      r = C.hledej(hra, t.i, i => ulohaNa(i, cil));
      if (!r) t.urovenBlok[u] = hra.tik + 20;
    }
    if (!r) return false;
    const p = r.hodnota;
    if (p.typ === 'kopat' || p.typ === 'kacet' || p.typ === 'bourat' || p.typ === 'pole' || p.typ === 'pumpovat' || p.typ === 'cist' || (p.typ === 'tesat' && !p.vec)) hra.rez.set(p.c, t.id);
    else if (p.typ === 'stavet') S.planPodle(hra, p.plan).rez = t.id;
    else if (p.typ === 'vyrobit') { const d = dilnaPodle(hra, p.dilna); mistoDilny(d, p.misto).rez = t.id; d.cekaOd = 0; }
    else {
      vecPodle(hra, p.vec).rez = t.id;
      if (p.typ === 'donest' && p.plan) { S.planPodle(hra, p.plan).vCeste[p.druh]++; p.vCeste = 1; }
      if (p.typ === 'donest' && p.dilna) { mistoDilny(dilnaPodle(hra, p.dilna), p.misto).vRobe.vCeste[p.druh]++; p.vCeste = 1; }
    }
    t.prace = p; t.cesta = r.cesta; t.stav = 'jde'; t.akce = 0;
    return true;
  }
  // Sklizeň rovnou do dílny: farmář s nošením vezme čerstvě sklizený kus a nese ho do kuchyně či pivovaru, jehož
  // rozpracovaný výrobek ho potřebuje (v nouzi o jídlo kuchyně první). Dřív šla úroda pole → sklad → kuchyně → sklad →
  // stůl (≈ 4 cesty na jídlo; nošení 30–33 % času klanu).
  function primoDoDilny(hra, t, v) {
    if (!t.povoleno.nosit || v.nese || v.rez || v.i !== t.i) return false;
    let kam = null;
    const hlad = hra.nouze && hra.nouze.hlad;
    for (const d of hra.dilny) mista(d).forEach((m, k) => {
      if (!m.vRobe || chybiDilne(hra, d, v.druh, m) <= 0) return;
      if (!kam || (hlad && d.typ === 'kuchyne' && kam.d.typ !== 'kuchyne')) kam = { d, k, m };
    });
    if (!kam) return false;
    v.rez = t.id; kam.m.vRobe.vCeste[v.druh]++;
    t.prace = { typ: 'donest', vec: v.id, druh: v.druh, dilna: kam.d.id, misto: kam.k, pos: t.i, faze: 'k_veci', vCeste: 1 };
    t.cesta = []; t.stav = 'jde'; t.akce = 0; t.cekej = 0;
    return true;
  }
  const JIDELNA_DOSAH = 600;                          // jak daleko (polí hledání) se nese jídlo do jídelny místo do skladu
  // nová cesta ke stejnému cíli (když se svět změnil)
  function preplanuj(hra, t) {
    const cil = t.prace.pos;
    const r = C.hledej(hra, t.i, i => i === cil ? 1 : 0);
    if (!r) return false;
    t.cesta = r.cesta;
    return true;
  }
  // zvednutí věci, kterou má trpaslík v práci (vrací věc, nebo null když tu už není)
  function zvedni(hra, t, p) {
    const v = vecPodle(hra, p.vec);
    if (!v || v.nese || v.i !== t.i) { pustPraci(hra, t); return null; }
    t.stav = 'zveda';
    if (++t.akce < DOBA.zvednout) return false;
    t.akce = 0;
    v.nese = t.id; t.nese = v.id;
    return v;
  }
  function jdi(hra, t, p, cil, zaseknuto) {      // naplánuje cestu k prvnímu poli, kde cil(i)
    const r = C.hledej(hra, t.i, i => cil(i) ? 1 : 0);
    if (!r) { zaseknuto(); return false; }
    p.pos = r.i; p.faze = 'k_cili'; t.cesta = r.cesta;
    return true;
  }
  function poloz(hra, t) {                        // položí nesenou věc na místo, kde stojí
    const v = vecPodle(hra, t.nese);
    if (v) { v.nese = 0; v.rez = 0; v.i = t.i; }
    t.nese = 0;
    P.usadVeci(hra);
  }
  function hotovo(t, pauza) { t.prace = null; t.akce = 0; t.stav = 'nic'; t.cekej = pauza || 1; }

  // --- nálada z prostředí: jak dlouho trvají vzpomínky na jídlo a pití (zhruba interval mezi nimi) ---------------
  // spánek: cyklus bdění a spánku je ~2,6 dne (únava 100 → 20 za ~1 400 tahů, spánek 150–250 tahů) – vzpomínka na noc
  // trvá do dalšího spánku (dřív 1 den: bonus ložnice platil jen ~38 % času); další spánek ji nahradí (klíč 'spanek')
  const DNI_JIDLA = 5, DNI_PITI = 4, DNI_SPANKU = 3;
  // jídlo u stolu: základ +4, kamenný nábytek +2, sochy +2 za kus (nejvýš +4), otesané stěny (≥ 60 %) +2
  function hodnotaJidelny(hra, i) {
    const z = S.zonaNa(hra, i);
    if (!z || z.typ !== 'jidelna') return ['jedl u stolu', 4];
    const k = S.kvalitaZony(hra, z.id);
    const h = 4 + (k.kamen ? 2 : 0) + Math.min(4, 2 * k.sochy) + (k.podilZdi >= 0.6 ? 2 : 0);
    return [h >= 11 ? 'hodoval v nádherné síni' : h >= 8 ? 'jedl v pěkné jídelně' : 'jedl u stolu v jídelně', h];
  }
  // spánek: ložnice +5 (otesané stěny +2, socha +2), postel jinde +3
  function hodnotaLoznice(hra, i) {
    const z = S.zonaNa(hra, i);
    if (!z || z.typ !== 'loznice') return ['vyspal se v posteli', 3];
    const k = S.kvalitaZony(hra, z.id);
    const h = 5 + (k.podilZdi >= 0.6 ? 2 : 0) + (k.sochy ? 2 : 0);
    return [h >= 7 ? 'vyspal se v pěkné ložnici' : 'vyspal se v ložnici', h];
  }
  // --- poplach vyhlášený hráčem: civilisté se schovají (hrozby.krokCivilisty řeší jen Spáče) ------------------------------
  // (civilista bez stráže pustí práci a jde do nejbližší ložnice/ošetřovny/skladu/jídelny dál než 12 polí od známých nepřátel)
  const UKRYT_DALEKO = 12, UKRYT_ZONY = new Set(['loznice', 'osetrovna', 'sklad', 'jidelna']);
  function daleko(hra, i) {
    const x = i % W, y = i / W | 0;
    for (const u of hra.tvorove) if (hra.znamo[u.i] && Math.abs(u.i % W - x) + Math.abs((u.i / W | 0) - y) <= UKRYT_DALEKO) return false;
    return true;
  }
  // Útočník, před kterým se civilista schová i bez poplachu (a kvůli kterému se nejde spát ani léčit do blízké postele):
  // viděný nájezdník, Spáč, nebo tvor, který nedávno útočil (ne netopýr), do `dosah` polí (Manhattan) od pole i.
  // Dřív poplach nechal spáče, jedlíky a léčící se strážce na místě – 43 % obětí nájezdů zemřelo v posteli u brány.
  const HROZBA_BLIZKO = 12, HROZBA_KONEC = 20;
  function hrozbaU(hra, i, dosah) {
    const x = i % W, y = i / W | 0, d = dosah || HROZBA_BLIZKO;
    for (const u of hra.tvorove) {
      if (u.druh === 'netopyr' || !hra.znamo[u.i] || !(u.najezd || u.druh === 'spac' || u.zautocil > hra.tik - 300)) continue;
      if (Math.abs(u.i % W - x) + Math.abs((u.i / W | 0) - y) <= d) return true;
    }
    return false;
  }
  // viděný nájezdník nebo Spáč do 2 polí od pole i (krok tam civilista neudělá)
  function najezdnikU(hra, i) {
    const x = i % W, y = i / W | 0;
    for (const u of hra.tvorove) if ((u.najezd || u.druh === 'spac') && hra.znamo[u.i] && Math.abs(u.i % W - x) + Math.abs((u.i / W | 0) - y) <= 2) return true;
    return false;
  }
  // schová se: civilista a zraněný strážce (pod 35 ♥ ustupuje jako civilista, ne jen o pole); zdravý strážce bojuje
  const schovaSe = t => !t.povoleno.hlidat || t.zdravi < T.hrozby.ZDRAVI_USTUP;
  function ukryjSe(hra, t, hrozi) {
    const p = t.prace;
    if (!schovaSe(t) || POT.kriticke(hra, t)) { if (p && p.typ === 'ukryt') pustPraci(hra, t); return; }
    if (!hra.poplach && !hrozi) return;               // úkryt bez poplachu skončí sám (viz práce 'ukryt')
    if (p && (p.typ === 'ukryt' || p.typ === 'zazehnout')) return;     // kdo nese Klíč nebo zažíhá Výheň, zůstane (viz krokCivilisty)
    // jídlo, pití a spánek (i léčení) daleko od nepřátel počkají; v jejich dosahu je trpaslík nechá (spáč se vzbudí) a schová se
    if (p && (p.typ === 'jist' || p.typ === 'pit' || p.typ === 'spat') && daleko(hra, t.i) && daleko(hra, p.pos)) return;
    if (t.ukrytBlok > hra.tik) return;
    const r = C.hledej(hra, t.i, i => { if (!hra.zona[i]) return 0; const z = S.zonaNa(hra, i); return z && UKRYT_ZONY.has(z.typ) && C.stojne(hra, i) && daleko(hra, i) ? 1 : 0; });
    if (!r) { t.ukrytBlok = hra.tik + 60; return; }
    if (p) pustPraci(hra, t);
    t.prace = { typ: 'ukryt', pos: r.i }; t.cesta = r.cesta; t.stav = 'jde'; t.akce = 0;
  }
  const POPLACH_BLIZKO = 15;
  function utocnik(hra, u) {
    if (u.druh === 'netopyr' || !hra.znamo[u.i]) return false;
    if (u.najezd || u.zautocil > hra.tik - 300) return true;
    const x = u.i % W, y = u.i / W | 0;
    return hra.trpaslici.some(t => Math.abs(t.i % W - x) + Math.abs((t.i / W | 0) - y) <= POPLACH_BLIZKO);
  }
  function prepniPoplach(hra, zap, text) {
    hra.poplach = zap === undefined ? !hra.poplach : !!zap;
    zprava(hra, 'boj', hra.poplach ? '📯 Poplach! Kdo nestráží, nechá práce a schová se.' : text || 'Poplach odvolán, klan se vrací k práci.');
    if (!hra.poplach) for (const t of hra.trpaslici) if (t.prace && t.prace.typ === 'ukryt') pustPraci(hra, t);
    return hra.poplach;
  }

  function krokTrpaslika(hra, t) {
    // potřeby běží každý tah – i uprostřed kroku (dřív jen ve chvíli, kdy trpaslík stál)
    const smrt = POT.tik(hra, t);
    if (smrt) { umri(hra, t, `${t.jmeno} zemřel ${smrt}.`, smrt === 'žízní' ? 'zizen' : 'hlad'); return; }
    if (t.hledejPotrebu > 0) t.hledejPotrebu--;
    if (t.t < t.dur) { t.t++; if (t.t < t.dur) return; }
    t.o = t.i; t.t = t.dur = 0;
    // gravitace
    if (!C.stojne(hra, t.i)) {
      const d = t.i + W;
      if (d < N && C.volne(hra, d)) { presun(t, d, DOBA.padani); t.pad++; t.stav = 'pada'; return; }
    }
    if (t.pad) {
      const vyska = t.pad; t.pad = 0;
      if (vyska > C.MAX_PAD) {
        t.zdravi -= 15 * (vyska - C.MAX_PAD);
        if (t.zdravi <= 0) { umri(hra, t, `${t.jmeno} spadl z výšky ${vyska} polí a zabil se.`, 'pad'); return; }
        zprava(hra, 'zraneni', `${t.jmeno} spadl z výšky ${vyska} polí a zranil se.`, t.i);
      }
      t.stav = t.prace ? 'jde' : 'nic';
    }
    const y = t.i / W | 0;
    if (y - UDOLI > hra.nejhloubeji) hra.nejhloubeji = y - UDOLI;
    hlidejUviznuti(hra, t);
    // nemocný leží (horečka z události)
    if (t.nemoc > hra.tik) { if (t.prace) pustPraci(hra, t); t.stav = 'spi'; t.spanek = Math.min(100, t.spanek + 0.3); return; }
    // záchvat vzteku po dlouhé zlé náladě; druhý v témž období = odchod z hory
    // (když hrozí známý nepřítel, záchvat počká – zlost se dál hromadí)
    if (t.zlost >= 1200 && !(t.zuri > hra.tik) && !(hra.tvorove.length && T.hrozby.znamyNepritel(hra))) {
      pustPraci(hra, t); t.zlost = 0;
      t.zachvaty = (t.zachvaty || 0) + 1;
      if (t.zachvaty >= 2) { odejdi(hra, t); return; }
      t.zuri = hra.tik + 400;
      zprava(hra, 'varovani', `${t.jmeno} má záchvat vzteku! Kope do zdí a nechce pracovat.`, t.i);
    }
    // i zuřící trpaslík se brání
    if (hra.tvorove.length && T.hrozby.branSe(hra, t, (typ, text, i) => zprava(hra, typ, text, i))) { t.stav = 'bojuje'; return; }
    if (t.zuri > hra.tik) { t.stav = 'zuri'; toulej(hra, t, true); return; }
    if (T.hrozby.krokCivilisty && T.hrozby.krokCivilisty(hra, t)) return;
    // poplach, nebo útočník do 12 polí: civilisté (a zranění strážci) se schovají (krokCivilisty řeší jen útěk před Spáčem)
    const hrozi = !hra.poplach && hra.tvorove.length > 0 && schovaSe(t) && hrozbaU(hra, t.i);
    if (hra.poplach || hrozi || (t.prace && t.prace.typ === 'ukryt')) ukryjSe(hra, t, hrozi);
    // výcvik přeruší jen známý nepřítel, na kterého se strážce může zkusit dostat (nedosažitelný = lovBlok)
    if (t.prace && t.prace.typ === 'cvicit' && hra.tvorove.length && T.hrozby.znamyNepritel(hra) && !(t.lovBlok > hra.tik)) pustPraci(hra, t);
    if (t.cekej > 0) { t.cekej--; return; }
    // kritická potřeba přeruší práci
    const potrebova = p0 => p0 && (p0.typ === 'jist' || p0.typ === 'pit' || p0.typ === 'spat');
    // (i těžké zranění, když je kde se léčit – strážce pod 35 zdraví přestane bojovat a jde na ošetřovnu;
    // hladový nebo žíznivý se ale nejdřív nají a napije – muzeLecit)
    const tezce = t.zdravi < POT.PRAH.lecitHned;
    if (t.prace && !potrebova(t.prace) && (POT.kriticke(hra, t) || (tezce && POT.muzeLecit(hra, t))) && !t.hledejPotrebu) pustPraci(hra, t);
    // strážce při nebezpečí: pustí jinou práci (ne jídlo/spánek) a jde na nepřítele; běžný hlad a únava počkají
    const poplach = t.povoleno.hlidat && !tezce && hra.tvorove.length && T.hrozby.znamyNepritel(hra) && !POT.kriticke(hra, t);
    if (poplach && t.prace && t.prace.typ !== 'lov' && !potrebova(t.prace) && !(t.lovBlok > hra.tik)) pustPraci(hra, t);
    // cíl lovu se hýbe: když u místa už nepřítel není, najít ho znovu
    if (t.prace && t.prace.typ === 'lov' && (hra.tik + t.id) % 12 === 0 && !T.hrozby.uNepritele(hra, t.prace.pos)) pustPraci(hra, t);

    if (!t.prace && poplach && !(t.lovBlok > hra.tik)) {
      const r = T.hrozby.praceStrazce(hra, t);
      if (r && r.hodnota.typ === 'lov') { t.prace = r.hodnota; t.cesta = r.cesta; t.stav = 'jde'; t.akce = 0; }
      else t.lovBlok = hra.tik + 60;                 // na nepřítele se teď nedostane (letí, je za vodou…)
    }
    if (!t.prace) {
      if (POT.potrebuje(hra, t) && !t.hledejPotrebu && !(poplach && !(t.lovBlok > hra.tik))) {
        const r = POT.najdi(hra, t);
        if (r) {
          const p = r.hodnota;
          if (p.vec) vecPodle(hra, p.vec).rez = t.id;
          t.prace = p; t.cesta = r.cesta; t.stav = 'jde'; t.akce = 0;
        } else t.hledejPotrebu = 60;
      }
    }
    // nevybavený strážce si nejdřív dojde pro válečnou sekeru a zbroj (čistý strážce by jinak jen cvičil na místě)
    if (!t.prace && t.povoleno.hlidat && (!t.zbran || !t.zbroj) && !(t.vybavBlok > hra.tik)) vybavStrazce(hra, t);
    // (neúspěch při tvorech v hoře – nepřítel je nedosažitelný – zablokuje hledání na 30 tahů: celé prohledání hory
    // každý tah pro každého strážce bylo nejdražší částí pozdní hry s pavoukem v odlehlé jeskyni)
    if (!t.prace && t.povoleno.hlidat && !tezce && !(t.strazBlok > hra.tik) && (hra.tvorove.length || hra.tik % 30 === t.id % 30 || T.hrozby.jenStraz(t))) {
      const r = T.hrozby.praceStrazce(hra, t);
      if (r) { t.prace = r.hodnota; t.cesta = r.cesta; t.stav = 'jde'; t.akce = 0; }
      else if (hra.tvorove.length) t.strazBlok = hra.tik + 30;
    }
    // kdo už stráž nemá, odloží válečnou výzbroj, kterou nevybavený strážce potřebuje (odnese se do skladu, strážce si ji vezme)
    if (!t.prace && !t.povoleno.hlidat && (t.zbran || t.zbroj) && (hra.tik + t.id) % 30 === 0 && !(hra.tvorove.length && T.hrozby.znamyNepritel(hra))) odlozBojovou(hra, t);
    if (!t.prace) {
      if (t.hledej > 0) { t.hledej--; toulej(hra, t); return; }
      if (!najdiPraci(hra, t)) { t.hledej = 15 + (t.id % 5); toulej(hra, t); return; }
    }
    const p = t.prace;
    // cesta
    while (t.cesta.length && t.cesta[0] === t.i) t.cesta.shift();
    if (t.cesta.length) {
      const dalsi = t.cesta[0];
      // civilista nevkročí na 2 pole k útočníkovi (dřív si chodili pro věci padlých přímo k nájezdníkům – i výtahem –
      // a v jedné hře jich u jedné stanice zemřelo 16 po sobě); práce počká, úkryt se hledá jinde
      if (hra.tvorove.length && schovaSe(t) && p.typ !== 'zazehnout' && najezdnikU(hra, dalsi)) {
        // (počká; po 4 marných pokusech práci pustí – nové hledání práce stojí víc než čekání)
        if ((t.couvl = (t.couvl || 0) + 1) > 4) { t.couvl = 0; pustPraci(hra, t); t.hledej = 60; } else t.cekej = 30;
        return;
      }
      const typ = C.krok(hra, t.i, dalsi);
      if (!typ) { if (!preplanuj(hra, t)) { pustPraci(hra, t); t.hledej = 5; } return; }
      t.cesta.shift();
      t.stav = t.nese ? 'nese' : 'jde';
      // nošení a chůze: zkušený trpaslík chodí rychleji (zlomek tahu se přenáší do dalšího kroku)
      const doba = dobaKroku(typ, t.i, dalsi, t.nese) / (typ === 'vytah' ? 1 : fDov(t, 'noseni')) + (t.krokZbytek || 0);
      const cele = Math.max(1, Math.floor(doba));
      t.krokZbytek = Math.round((doba - cele) * 1000) / 1000;
      presun(t, dalsi, cele);
      return;
    }
    if (t.i !== p.pos) { if (!preplanuj(hra, t)) { pustPraci(hra, t); t.hledej = 5; } return; }

    // práce na místě
    const natoc = c => { const dx = c % W - t.i % W; if (dx) t.smer = dx > 0 ? 1 : -1; };
    if (p.typ === 'kopat') {
      if ((hra.oznac[p.c] !== P.OZN.KOPAT && hra.oznac[p.c] !== P.OZN.SCHODY) || !P.lzeKopat(hra, p.c) || !P.vDosahu(hra, t.i, p.c)) { pustPraci(hra, t); return; }
      if (!t.akce) t.akceDoba = Math.max(3, Math.round(P.dobaKopani(hra, p.c, t) / POT.rychlost(t) / faktorNastroje(t, 'kopat')));
      t.stav = 'kope'; natoc(p.c);
      if (t.akce % 8 === 4) zvuk(hra, 'uder', p.c, hra.hora.ruda[p.c] ? 100 + hra.hora.ruda[p.c] : hra.hora.teren[p.c]);
      if (++t.akce < t.akceDoba) return;
      hra.rez.delete(p.c);
      hotovo(t);
      zvuk(hra, 'vykop', p.c, hra.hora.teren[p.c]);
      // podpěra naplánovaná do kopané skály se rovnou vytesá z kamene: bez dřeva, kámen zůstane ve sloupu (ruda se vytěží)
      const pid = hra.planNa.get(p.c), sloup = pid && S.planPodle(hra, pid), id0 = hra.dalsiId;
      P.vykopej(hra, p.c, (typ, text, i) => zprava(hra, typ, text, i));
      if (sloup && sloup.typ === 'podpera' && hra.plany.includes(sloup) && hra.hora.teren[p.c] === M.VZDUCH) vytesejPodperu(hra, sloup, t, id0);
      opotrebuj(hra, t, 'kopat');
      if (++t.zkusenost >= 6 + 2 * t.dov.kopani) { t.zkusenost = 0; if (t.dov.kopani < 20) t.dov.kopani++; }
      return;
    }
    if (p.typ === 'tesat') {
      if (p.faze === 'k_veci') {                   // s kamenem k nejbližší hliněné stěně označené k otesání
        const v = zvedni(hra, t, p); if (!v) return;
        // k žádné hliněné stěně se s kamenem nedostane: kámen položí (zůstane volný pro stavby) a tesání za kámen chvíli nikdo nezkouší
        jdi(hra, t, p, i => C.stojne(hra, i) && cilTesani(hra, i, true) >= 0, () => { hra.tesatBlok = hra.tik + 600; pustPraci(hra, t); t.hledej = 20; });
        return;
      }
      if (p.c === undefined) { const c = cilTesani(hra, t.i, true, t); if (c < 0) { pustPraci(hra, t); return; } p.c = c; hra.rez.set(c, t.id); }
      if (hra.oznac[p.c] !== P.OZN.TESAT || !P.lzeTesat(hra, p.c) || hra.rez.get(p.c) !== t.id) { pustPraci(hra, t); return; }
      if (!t.akce) t.akceDoba = Math.max(5, Math.round(DOBA.tesat / POT.rychlost(t) / faktorNastroje(t, 'kopat') / fDov(t, 'tesani')));
      t.stav = 'kope';
      if (t.akce % 8 === 4) zvuk(hra, 'uder', p.c, M.ZED);
      if (++t.akce < t.akceDoba) return;
      if (hra.hora.teren[p.c] === M.VZDUCH) hra.hora.pozadi[p.c] = M.ZED;
      else P.otesejPodlahu(hra, p.c, (typ, text, i) => zprava(hra, typ, text, i), t.i);
      hra.oznac[p.c] = 0; hra.rez.delete(p.c);
      if (t.nese) { const v = vecPodle(hra, t.nese); if (v) { hra.veci.splice(hra.veci.indexOf(v), 1); P.tok(hra, v.druh, 'm', 'stavby'); } t.nese = 0; }
      hotovo(t, 2);
      zlepsi(hra, t, 'tesani');
      return;
    }
    if (p.typ === 'kacet') {
      if (hra.oznac[p.c] !== P.OZN.KACET || !kacetelne(hra.hora.obj[p.c]) || Math.abs(p.c - t.i) > 1) { pustPraci(hra, t); return; }
      t.akceDoba = Math.round(DOBA.kacet / POT.rychlost(t) / faktorNastroje(t, 'kacet') / fDov(t, 'kaceni')); t.stav = 'kope'; natoc(p.c);
      if (t.akce % 8 === 4) zvuk(hra, 'sekera', p.c);
      if (++t.akce < t.akceDoba) return;
      hra.rez.delete(p.c);
      hotovo(t);
      opotrebuj(hra, t, 'kacet');
      zlepsi(hra, t, 'kaceni');
      P.skacej(hra, p.c);
      return;
    }
    if (p.typ === 'bourat') {
      const dx = Math.abs((p.c % W) - (t.i % W)), dy = (p.c / W | 0) - (t.i / W | 0);
      if (hra.oznac[p.c] !== P.OZN.BOURAT || !P.lzeBourat(hra, p.c) || dx > 1 || dy < -2 || dy > 1 || hra.rez.get(p.c) !== t.id) { pustPraci(hra, t); return; }
      t.akceDoba = Math.round(S.dobaBourani(hra, p.c) / POT.rychlost(t) / faktorNastroje(t, 'stavet') / fDov(t, 'stavba')); t.stav = 'kope'; natoc(p.c);
      if (t.akce % 10 === 5) zvuk(hra, 'kladivo', p.c);
      if (++t.akce < t.akceDoba) return;
      hra.rez.delete(p.c);
      const nazev = S.nazevNa(hra, p.c);
      for (const j of S.rozeber(hra, p.c, (druh, i, mat) => P.novaVec(hra, druh, i, mat !== undefined ? mat : druh === 'drevo' ? 'drevo' : 0)))
        if (hra.oznac[j] === P.OZN.BOURAT) hra.oznac[j] = 0;
      P.usadVeci(hra);
      zprava(hra, 'stavba', `${t.jmeno} rozebral ${nazev}.`, p.c);
      hotovo(t, 2);
      zlepsi(hra, t, 'stavba');
      return;
    }
    if (p.typ === 'stavet') {
      const pl = S.planPodle(hra, p.plan);
      if (!pl || !S.pripraven(pl) || !S.planVDosahu(hra, t.i, pl) || !S.volnoProPlan(hra, pl) || !S.mistoPlanu(hra, pl)) { pustPraci(hra, t); return; }
      t.akceDoba = Math.round(S.STAVBY[pl.typ].doba / POT.rychlost(t) / faktorNastroje(t, 'stavet') / T.pribeh.faktor(hra, 'stavet') / fDov(t, 'stavba')); t.stav = 'kope'; natoc(pl.i);
      if (t.akce % 10 === 5) zvuk(hra, 'kladivo', pl.i);
      if (++t.akce < t.akceDoba) return;
      hotovo(t, 2);
      opotrebuj(hra, t, 'stavet');
      S.dokonci(hra, pl, t, (typ, text, i) => zprava(hra, typ, text, i));
      zlepsi(hra, t, 'stavba');
      return;
    }
    if (p.typ === 'odnes') {
      if (p.faze === 'k_veci') {
        const v = zvedni(hra, t, p); if (!v) return;
        // nejbližší pole skladu, které věc přijme a kde ještě není plná hromada; jinak kterékoli, které ji přijme
        const pocet = new Map();
        for (const w of hra.veci) if (!w.nese) pocet.set(w.i, (pocet.get(w.i) || 0) + 1);
        // ⭐ přednostní sklady mají přednost před bližšími
        const prio = hra.zony.some(z => z.typ === 'sklad' && z.prio && S.prijimaneDruhy(z).has(v.druh));
        const prednostni = i => { const z = S.zonaNa(hra, i); return z && z.prio; };
        // všechna pole plná (sklad je přeplněný): na nejméně zaplněné dosažitelné pole, ne všechno na nejbližší
        let nej = -1, nejN = Infinity;
        // jídlo a pivo z kuchyně a pivovaru nejdřív do blízké jídelny (ke stolům), pokud tam je místo
        const doJidelny = S.DRUHY_JIDELNY.has(v.druh) && hra.zony.some(z => z.typ === 'jidelna') &&
          C.hledej(hra, t.i, i => S.vJidelne(hra, i, v.druh) && C.stojne(hra, i) && (pocet.get(i) || 0) < S.MAX_NA_POLI ? 1 : 0, JIDELNA_DOSAH);
        const r = doJidelny || (prio && C.hledej(hra, t.i, i => S.prijme(hra, i, v.druh) && prednostni(i) && (pocet.get(i) || 0) < S.MAX_NA_POLI ? 1 : 0)) ||
                  C.hledej(hra, t.i, i => {
                    if (!S.prijme(hra, i, v.druh)) return 0;
                    const n = pocet.get(i) || 0;
                    if (n < S.MAX_NA_POLI) return 1;
                    if (n < nejN) { nej = i; nejN = n; }
                    return 0;
                  }) ||
                  (nej >= 0 ? C.hledej(hra, t.i, i => i === nej ? 1 : 0) : null);
        if (!r) {                                  // ke skladu se nedostane – položí věc a chvíli ji nechá být
          v.blok = hra.tik + 600;
          pustPraci(hra, t); t.hledej = 20; return;
        }
        p.faze = 'k_cili'; p.pos = r.i; t.cesta = r.cesta;
        return;
      }
      poloz(hra, t); hotovo(t, 2); zlepsi(hra, t, 'noseni');
      return;
    }
    if (p.typ === 'donest' && p.dilna) {
      const d = dilnaPodle(hra, p.dilna), m = d && mistoDilny(d, p.misto);
      if (!d || !m.vRobe) { pustPraci(hra, t); return; }
      if (p.faze === 'k_veci') {
        const v = zvedni(hra, t, p); if (!v) return;
        jdi(hra, t, p, i => S.dilnaNa(hra, i) === d && C.stojne(hra, i), () => { vecPodle(hra, p.vec).blok = hra.tik + 300; pustPraci(hra, t); t.hledej = 20; });
        return;
      }
      if (S.dilnaNa(hra, t.i) !== d) { pustPraci(hra, t); return; }
      const v = vecPodle(hra, t.nese);
      hra.veci.splice(hra.veci.indexOf(v), 1); P.tok(hra, v.druh, 'm', d.typ);
      t.nese = 0;
      m.vRobe.doneseno[p.druh]++; m.vRobe.vCeste[p.druh]--; zlepsi(hra, t, 'noseni');
      hotovo(t);
      return;
    }
    if (p.typ === 'donest') {
      const pl = S.planPodle(hra, p.plan);
      if (!pl) { pustPraci(hra, t); return; }
      if (p.faze === 'k_veci') {
        const v = zvedni(hra, t, p); if (!v) return;
        jdi(hra, t, p, i => S.planVDosahu(hra, i, pl), () => { pl.blok = hra.tik + 600; pustPraci(hra, t); t.hledej = 20; });
        return;
      }
      if (!S.planVDosahu(hra, t.i, pl)) { pustPraci(hra, t); return; }
      const v = vecPodle(hra, t.nese);
      hra.veci.splice(hra.veci.indexOf(v), 1); P.tok(hra, v.druh, 'm', 'stavby');   // materiál se spotřebuje
      t.nese = 0;
      pl.doneseno[p.druh]++; pl.vCeste[p.druh]--; zlepsi(hra, t, 'noseni');
      if (S.STAVBY[pl.typ].nabytek) pl.mat = v.mat;
      hotovo(t);
      return;
    }
    if (p.typ === 'vyrobit') {
      const d = dilnaPodle(hra, p.dilna), m = d && mistoDilny(d, p.misto);
      const z = d && m.vRobe && d.fronta.find(z => z.id === m.vRobe.zak);
      if (!z || !dilnaPripravena(d, m) || S.dilnaNa(hra, t.i) !== d) { pustPraci(hra, t); return; }
      const rc = receptPro(d, z);
      // artefakt mezitím dokončila jiná kovárna: zakázka zmizí, materiál vypadne (jinak by vznikl podruhé)
      if (rc.vyrobek.startsWith('art_') && T.pribeh.artefaktZakazany(hra, rc.vyrobek)) { d.fronta.splice(d.fronta.indexOf(z), 1); uvolniMisto(hra, d, p.misto || 0); return; }
      t.akceDoba = Math.round(rc.doba / POT.rychlost(t) / faktorNastroje(t, 'vyrobit') / T.pribeh.faktor(hra, 'vyrobit') / fDov(t, 'remeslo')); t.stav = 'kope';
      if (t.akce % 10 === 5) zvuk(hra, ['tavirna', 'kovarna', 'magmovyhen', 'runova_kovarna'].includes(d.typ) ? 'kovadlina' : 'dilna', t.i);
      if (++t.akce < t.akceDoba) return;
      if (rc.vyrobek.startsWith('art_')) T.pribeh.vyroben(hra, rc.vyrobek, t.i);
      else for (let k = 0; k < (rc.pocet || 1); k++) P.novaVec(hra, rc.vyrobek, t.i, rc.vmat, d.typ);
      P.usadVeci(hra);
      m.vRobe = null; m.rez = 0;
      if (!z.trvala && --z.zbyva <= 0) d.fronta.splice(d.fronta.indexOf(z), 1);
      hotovo(t, 2);
      opotrebuj(hra, t, 'vyrobit');
      zlepsi(hra, t, 'remeslo');
      return;
    }
    if (p.typ === 'lov') { if (T.hrozby.uNepritele(hra, t.i)) { t.stav = 'bojuje'; return; } hotovo(t); return; }
    if (p.typ === 'ukryt') {                       // schovaný: čeká, dokud trvá poplach; když se nepřítel přiblíží, hledá jinde
      t.stav = 'nic';
      if ((hra.tik + t.id) % 60 === 0 && !daleko(hra, t.i)) pustPraci(hra, t);
      // úkryt bez poplachu (útočník byl blízko) skončí, když už žádný není do 20 polí
      else if (!hra.poplach && (hra.tik + t.id) % 30 === 0 && !hrozbaU(hra, t.i, HROZBA_KONEC)) hotovo(t);
      return;
    }   // u nepřítele stojí a bije
    if (p.typ === 'cist') {
      if (hra.hora.obj[p.c] !== O.DESKA) { pustPraci(hra, t); return; }
      t.stav = 'ji';
      if (++t.akce < 120) return;
      hra.rez.delete(p.c); hotovo(t);
      T.pribeh.prectiDesku(hra, p.c);
      return;
    }
    if (p.typ === 'zazehnout') {
      const srdce = hra.hora.srdce.y * W + hra.hora.srdce.x;
      if (p.faze === 'k_veci') {
        const v = zvedni(hra, t, p); if (!v) return;
        jdi(hra, t, p, i => i === srdce, () => { vecPodle(hra, p.vec).blok = hra.tik + 600; pustPraci(hra, t); t.hledej = 30; });
        return;
      }
      if (t.i !== srdce || hra.vyhenHori) { pustPraci(hra, t); return; }
      t.stav = 'kope';
      if (T.pribeh.zazehni(hra, t)) { t.nese = 0; hotovo(t, 5); }
      return;
    }          // na místě: útok řeší obrana, jinak hledat dál
    if (p.typ === 'cvicit') {
      // krátké lekce (LEKCE tahů), běžná potřeba (hlad, žízeň, únava, zranění) lekci hned ukončí; pokrok se sčítá
      // v t.cvik – ve zbrojnici 2 za tah, na místě 1, za 600 bodů +1 k boji (300 tahů ve zbrojnici, 600 na místě)
      if (POT.potrebuje(hra, t) && !t.hledejPotrebu) { hotovo(t); return; }
      t.stav = 'kope';
      t.cvik = (t.cvik || 0) + (p.naMiste ? 1 : 2);
      if (t.cvik >= 600) { t.cvik = 0; t.dov.boj = Math.min(10, (t.dov.boj || 0) + 1); }
      if (++t.akce < LEKCE) return;
      hotovo(t);
      return;
    }
    if (p.typ === 'pumpovat') {
      if (hra.stavba[p.c] !== S.K.PUMPA) { pustPraci(hra, t); return; }
      t.stav = 'kope';
      if (++t.akce % 12) return;
      if (!T.priroda.odcerpej(hra, p.c) || t.akce > 1200) { hra.rez.delete(p.c); hotovo(t); }
      return;
    }
    if (p.typ === 'vybavit') {
      const v = zvedni(hra, t, p); if (!v) return;
      hra.veci.splice(hra.veci.indexOf(v), 1);
      t.nese = 0;
      const kus = { druh: v.druh, mat: v.mat || 'zelezo', stav: 100 };
      if (v.druh === 'valecna_sekera') t.zbran = kus; else if (v.druh === 'zbroj') t.zbroj = kus;
      else { if (t.nastroj) { P.novaVec(hra, t.nastroj.druh, t.i, t.nastroj.mat); P.usadVeci(hra); } t.nastroj = kus; }   // starý (měděný) nástroj nechá ležet
      hotovo(t);
      return;
    }
    if (p.typ === 'pole' && hra.zona[p.c] && (S.zonaNa(hra, p.c) || {}).typ === 'les') {    // lesní školka: zasadit / pokácet
      const o = hra.hora.obj[p.c], kacet = o === O.STROM || o === O.HOUBA;
      if (!kacet && o && o !== O.TRAVA) { pustPraci(hra, t); return; }
      if (!t.akce) t.akceDoba = kacet ? Math.round(DOBA.kacet / POT.rychlost(t) / faktorNastroje(t, 'kacet') / fDov(t, 'kaceni')) : Math.round(25 / POT.rychlost(t) / fDov(t, 'pole'));
      t.stav = 'kope';
      if (kacet && t.akce % 8 === 4) zvuk(hra, 'sekera', p.c);
      if (++t.akce < t.akceDoba) return;
      hra.rez.delete(p.c);
      if (kacet) { P.skacej(hra, p.c); opotrebuj(hra, t, 'kacet'); zlepsi(hra, t, 'kaceni'); }
      else {
        zlepsi(hra, t, 'pole');   // stromek doroste za 3 dny, pod zemí obří houba ze spor za 4 (i v zimě)
        const pod = hra.hora.pozadi[p.c] !== M.VZDUCH;
        hra.hora.obj[p.c] = O.PAREZ; hra.parezy.push(pod ? { i: p.c, tik: hra.tik + 4 * TAHU_ZA_DEN, sazenice: true, houba: true } : { i: p.c, tik: hra.tik + 3 * TAHU_ZA_DEN, sazenice: true });
      }
      hotovo(t);
      return;
    }
    if (p.typ === 'pole') {
      const z = S.zonaNa(hra, p.c), plodina = z && S.FARMY[z.typ];
      if (!plodina || hra.uroda[p.c] % 101 !== 0) { pustPraci(hra, t); return; }
      t.akceDoba = Math.round(20 / POT.rychlost(t) / fDov(t, 'pole')); t.stav = 'kope';
      if (++t.akce < t.akceDoba) return;
      hra.rez.delete(p.c);
      zlepsi(hra, t, 'pole');
      if (hra.uroda[p.c] === 101) {                 // pole dá 2 snopy, houbárna 1 houbu
        hra.uroda[p.c] = 0;
        let prvni = null;
        for (let k = 0; k < (z.typ === 'houbarna' ? 1 : 2); k++) { const v = P.novaVec(hra, plodina, p.c, 0, z.typ); prvni = prvni || v; }
        P.usadVeci(hra);
        hotovo(t);
        if (prvni && primoDoDilny(hra, t, prvni)) return;     // sklizeň rovnou do kuchyně / pivovaru, který ji čeká
        return;
      }
      else hra.uroda[p.c] = 1;
      hotovo(t);
      return;
    }
    if (p.typ === 'jist') {
      if (p.faze === 'k_veci') {
        const v = zvedni(hra, t, p); if (!v) return;
        const r = C.hledej(hra, t.i, i => POT.uStolu(hra, i) ? 1 : 0, 900);
        if (r) { p.faze = 'k_cili'; p.pos = r.i; p.stul = true; t.cesta = r.cesta; }
        else { p.faze = 'ji'; p.pos = t.i; }
        return;
      }
      if (p.faze === 'k_cili') p.faze = 'ji';
      t.stav = 'ji';
      if (++t.akce < 30) return;
      const v = vecPodle(hra, t.nese);
      if (v) {
        hra.veci.splice(hra.veci.indexOf(v), 1); P.tok(hra, v.druh, 'm', 'jedli trpaslíci');
        t.jidlo = Math.min(100, t.jidlo + POT.NASYCENI[v.druh]);
        // vzpomínka na jídlo trvá zhruba do dalšího jídla (jí se asi jednou za 5 dní); hezká jídelna potěší víc
        if (v.druh !== 'jidlo') { POT.vzpominka(hra, t, 'jedl syrové ' + (v.druh === 'houby' ? 'houby' : 'zrní'), -5, DNI_JIDLA, 'jidlo'); P.tok(hra, 'jidlo', 'n', 'jedli syrové ' + (v.druh === 'houby' ? 'houby' : 'zrní')); }
        else if (p.stul) { const [txt, h] = hodnotaJidelny(hra, t.i); POT.vzpominka(hra, t, txt, h, DNI_JIDLA, 'jidlo'); }
        else POT.vzpominka(hra, t, 'jedl na zemi', -3, DNI_JIDLA, 'jidlo');
      }
      t.nese = 0; hotovo(t);
      return;
    }
    if (p.typ === 'pit') {
      if (!p.voda && p.faze === 'k_veci') { const v = zvedni(hra, t, p); if (!v) return; p.faze = 'pije'; return; }
      t.stav = 'ji';
      const led = p.voda && POT.ledova(hra, t.i);
      if (++t.akce < (p.voda ? (led ? 45 : 25) : 20)) return;
      if (led) { t.piti = Math.min(100, t.piti + POT.NASYCENI.voda); POT.vzpominka(hra, t, 'prosekal led a pil ledovou vodu', -9, DNI_PITI, 'piti'); P.tok(hra, 'pivo', 'n', 'pili led'); }
      else if (p.studna) { t.piti = Math.min(100, t.piti + POT.NASYCENI.voda); POT.vzpominka(hra, t, 'napil se čisté vody ze studny', -2, DNI_PITI, 'piti'); P.tok(hra, 'pivo', 'n', 'pili ze studny'); }
      else if (p.voda) { t.piti = Math.min(100, t.piti + POT.NASYCENI.voda); POT.vzpominka(hra, t, 'pil jen vodu – žádné pivo!', -6, DNI_PITI, 'piti'); P.tok(hra, 'pivo', 'n', 'pili vodu'); }
      else {
        const v = vecPodle(hra, t.nese);
        if (v) { hra.veci.splice(hra.veci.indexOf(v), 1); P.tok(hra, v.druh, 'm', 'pili trpaslíci'); }
        t.nese = 0;
        t.piti = Math.min(100, t.piti + POT.NASYCENI.pivo);
        // houbové pivo je slabé, ječné (i koupené) dobré; obě druhy během pár dní = pestrá piva
        const houbove = v && v.mat === 'houby';
        if (houbove) { POT.vzpominka(hra, t, 'pil slabé houbové pivo', 1, DNI_PITI, 'piti'); t.pivoH = hra.tik; }
        else { POT.vzpominka(hra, t, 'dal si dobré ječné pivo', 3, DNI_PITI, 'piti'); t.pivoJ = hra.tik; }
        if (t.pivoH && t.pivoJ && Math.abs(t.pivoH - t.pivoJ) < 2 * DNI_PITI * TAHU_ZA_DEN) POT.vzpominka(hra, t, 'ochutnal pestrá piva', 2, DNI_PITI, 'piva');
      }
      hotovo(t);
      return;
    }
    if (p.typ === 'spat') {
      const postel = p.postel >= 0 && hra.stavba[p.postel] === S.K.POSTEL;
      if (p.postel >= 0 && !postel) { pustPraci(hra, t); return; }
      t.stav = 'spi';
      t.spanek = Math.min(100, t.spanek + (postel ? 0.5 : 0.3));
      if (p.lecit) {                               // léčení: leží, dokud se nezhojí (hlad a žízeň ho zvednou dřív)
        if (t.zdravi >= (p.osetrovna ? POT.PRAH.vylecen : POT.PRAH.zraneny) || t.jidlo < POT.PRAH.hlad || t.piti < POT.PRAH.zizen) {
          if (p.osetrovna && t.zdravi >= POT.PRAH.vylecen) POT.vzpominka(hra, t, 'zhojili ho na ošetřovně', 3, 2);
          hotovo(t);
        }
        return;
      }
      // spí se, dokud se nevyspí – denní doba nerozhoduje
      if (t.spanek >= POT.PRAH.vyspany) {
        if (!postel) POT.vzpominka(hra, t, 'spal na tvrdé zemi', -6, DNI_SPANKU, 'spanek');
        else { const [txt, h] = hodnotaLoznice(hra, p.postel); POT.vzpominka(hra, t, txt, h, DNI_SPANKU, 'spanek'); }
        hotovo(t);
      }
    }
  }
  // trpaslík, který se nedostane k žádnému skladu, uvízl (typicky v šachtě nebo jámě bez schodiště): sám se naplánuje
  // záchranný žebřík s ⭐ předností (zachranUviznuteho); zpráva s místem se opakuje, dokud uvízlý je (jednou za 1200 tahů).
  // Zavřená mříž nikoho neuvězní (dá se otevřít) – dřív se za ní hlásilo uvíznutí a záchrana kopala kolem mříže.
  function hlidejUviznuti(hra, t) {
    if (hra.tik < (t.kontrola || 0)) return;
    t.kontrola = hra.tik + 150;
    const kSkladu = i => S.jeSklad(hra, i) ? 1 : 0;
    const venku = !!C.hledej(hra, t.i, kSkladu) || !!C.sRezimem(hra, true, false, () => C.hledej(hra, t.i, kSkladu));
    t.uvizl = !venku;
    if (venku) { t.zachrana = null; return; }          // zbytky záchrany zruší hlidejZachrany
    const z = zachranUviznuteho(hra, t);
    if (!(t.hlaseno > hra.tik)) {
      const n = z ? z.pole.length : 0, poli = n === 1 ? 'pole' : n < 5 ? 'pole' : 'polí';
      const spac = !z && T.pribeh.budiSpace(hra, t.i / W | 0);
      zprava(hra, 'uvizl', `${t.jmeno} uvízl a nedostane se zpátky` + (spac ? '. Záchranné schodiště by tu probudilo Spáče – postav k němu žebřík (dřevo), nebo kopej ručně.'
        : !z ? '. Postav k němu žebřík nebo vytesej schodiště.'
        : z.typ === 'schody' ? ` – dřevo na žebřík není, k němu je vyznačené záchranné schodiště do skály (${n} ${poli}, ⭐ přednost).`
        : ` – k němu je naplánovaný záchranný žebřík (${n} ${poli}, ⭐ přednost, potřebuje dřevo).`), t.i);
      t.hlaseno = hra.tik + 1200;
    }
  }
  // kam se dá dojít ze skladů (BFS od všech stojných polí skladů); null = žádný sklad
  function dosahSkladu(hra) {
    const F = new Uint8Array(N), q = [];
    for (let i = 0; i < N; i++) if (hra.zona[i] && S.jeSklad(hra, i) && C.stojne(hra, i)) { F[i] = 1; q.push(i); }
    for (let h = 0; h < q.length; h++) C.sousede(hra, q[h], j => { if (!F[j]) { F[j] = 1; q.push(j); } });
    return q.length ? F : null;
  }
  // dosah ze skladů pro záchranu: zavřená mříž průchozí, neprozkoumaná pole ne (jednou za tah, neukládá se)
  const dosahZachranyCache = new WeakMap();
  function dosahZachrany(hra) {
    const c = dosahZachranyCache.get(hra);
    if (c && c.tik === hra.tik) return c.F;
    const F = C.sRezimem(hra, true, true, () => dosahSkladu(hra));
    dosahZachranyCache.set(hra, { tik: hra.tik, F });
    return F;
  }
  // --- Záchranná cesta ven (uvízlý trpaslík, cenná věc v jámě, Srdce hory pod nedokončeným žebříkem) ---------------
  // Žebřík: z pole, kam se od startu dojde (nejbližší první), svisle nahoru volnou šachtou/jámou k nejbližšímu poli,
  // odkud se vystoupí na pole dosažitelné ze skladu (nebo pole samo dosažitelné je). Schodiště (bez dřeva): sloupec
  // vytesaný do skály hned vedle, zespodu nahoru, dokud z něj nejde vystoupit ven. Spojení se vždy ověří hledáním cesty
  // ze startu do skladu s dočasně položeným žebříkem / vytesaným schodištěm. Vrací { typ: 'zebrik'|'schody', pole } nebo null.
  // Záchrana nikdy nekope do neprozkoumaného (jeskyně s pavouky, goblinní tunel, Srdce) ani v hloubce Spáče.
  const ZACHRANA_VYSKA = 40, ZACHRANA_POKUSU = 8;
  const zebrikNa = (hra, j) => { const id = hra.planNa.get(j), p = id && S.planPodle(hra, id); return !!p && p.typ === 'zebrik'; };
  // cesta ze startu do skladu, když se svět dočasně upraví (zmen() / vrat()); zavřená mříž průchozí, neprozkoumaná
  // pole ne; svět se vrátí i při chybě; mezipaměti cest se zahodí
  function overVystup(hra, start, zmen, vrat) {
    try {
      zmen();
      return C.sRezimem(hra, true, true, () => !!C.hledej(hra, start, i => S.jeSklad(hra, i) ? 1 : 0));
    } finally { vrat(); hra._vylezTik = -1; hra._vytahTik = -1; }
  }
  // pole, kam se od startu dojde (nejvýš 3000) – se stejnými pravidly jako ověření výstupu
  function oblastZachrany(hra, start) {
    const oblast = [];
    C.sRezimem(hra, true, true, () => C.hledej(hra, start, i => { oblast.push(i); return 0; }, 3000));
    return oblast;
  }
  function najdiZebrik(hra, start, oblast, F) {
    const vyzkouseno = new Set();
    let pokusu = 0;
    for (const r of oblast) {
      if (pokusu >= ZACHRANA_POKUSU) break;
      if (!C.stojne(hra, r) || vyzkouseno.has(r % W)) continue;
      const sloupec = [];
      for (let u = r - W, k = 0; u >= 0 && k < ZACHRANA_VYSKA; u -= W, k++) {
        if (!C.volne(hra, u) || !hra.znamo[u]) break;
        if (!hra.lez[u] && !zebrikNa(hra, u) && S.prekazka(hra, 'zebrik', u)) break;      // louč, stavba, cizí plán: tudy ne
        sloupec.push(u);
        const x = u % W;
        if (!F[u] && ![x > 0 ? u - 1 : -1, x < W - 1 ? u + 1 : -1, x > 0 && u >= W ? u - W - 1 : -1, x < W - 1 && u >= W ? u - W + 1 : -1].some(j => j >= 0 && F[j])) continue;
        vyzkouseno.add(r % W); pokusu++;
        const nove = sloupec.filter(j => !hra.lez[j]);
        if (!nove.length) break;
        if (!overVystup(hra, start, () => { for (const j of nove) hra.lez[j] = 2; }, () => { for (const j of nove) hra.lez[j] = 0; })) break;
        return { typ: 'zebrik', pole: nove };
      }
    }
    return null;
  }
  // pole, které jde vytesat na záchranné schodiště: známá skála, kterou jde kopat, nic nenese, nesousedí s vodou ani
  // magmatem, není v hloubce Spáče (kopání by ho probudilo) a vykopáním se neodkryje nic neznámého – každé z 8 polí
  // kolem (ta se kopáním odhalí) je známé, nebo pevná skála (jinak by schodiště prokopalo skrytou jeskyni či tunel)
  function naSchod(hra, u) {
    const t = hra.hora.teren;
    if (!pevne(t[u]) || !hra.znamo[u] || !P.lzeKopat(hra, u) || S.neseStavbu(hra, u) || hra.planNa.has(u)) return false;
    if (T.pribeh.budiSpace(hra, u / W | 0)) return false;
    const x = u % W;
    for (const j of [u - W, u + W, x > 0 ? u - 1 : -1, x < W - 1 ? u + 1 : -1]) if (j >= 0 && j < N && (t[j] === M.VODA || t[j] === M.MAGMA)) return false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const j = u + dy * W + dx;
      if (x + dx < 0 || x + dx >= W || j < 0 || j >= N) continue;
      if (!hra.znamo[j] && !pevne(t[j])) return false;
    }
    return true;
  }
  function najdiSchody(hra, start, oblast) {
    const vOblasti = new Set(oblast), t = hra.hora.teren;
    let overeni = 0;
    for (const r of oblast) {
      if (overeni >= ZACHRANA_POKUSU) break;
      if (!C.stojne(hra, r)) continue;
      for (const s of [-1, 1]) {
        const x = r % W + s;
        if (x < 1 || x > W - 2) continue;
        const sloupec = [];
        for (let u = r + s, k = 0; u >= W && k < ZACHRANA_VYSKA && overeni < ZACHRANA_POKUSU; u -= W, k++) {
          if (!naSchod(hra, u)) break;
          sloupec.push(u);
          // výstup: vedle nebo nad schodem je volné známé pole mimo jámu, ze které se leze
          const ven = j => C.volne(hra, j) && hra.znamo[j] && !vOblasti.has(j);
          if (!(u - W >= 0 && ven(u - W)) && ![u - 1, u + 1].some(ven)) continue;
          overeni++;
          const puv = sloupec.map(j => [t[j], hra.lez[j]]);
          if (overVystup(hra, start, () => { for (const j of sloupec) { t[j] = M.VZDUCH; hra.lez[j] = 1; } },
                                     () => sloupec.forEach((j, q) => { t[j] = puv[q][0]; hra.lez[j] = puv[q][1]; }))) return { typ: 'schody', pole: sloupec.slice() };
        }
      }
    }
    return null;
  }
  // volné dřevo (ne nesené, ne rezervované) – na záchranný žebřík
  const volneDrevo = hra => { let n = 0; for (const v of hra.veci) if (v.druh === 'drevo' && !v.nese && !v.rez) n++; return n; };
  // Evidence záchran (hra.zachrany, ukládá se): { kdo: 't<id>' | 'v' | 'srdce', veci: [id] (u 'v'), typ, pole, od } –
  // pole = záchranou nově naplánované / označené (nebo převzaté od jiné záchrany). Když záchrana přestane být potřeba
  // (uvízlý se dostal ven jinak nebo umřel, věc je pryč či dosažitelná, Srdce dosažitelné), její zbylé plány žebříku
  // se zruší (donesené dřevo vypadne) a značky schodiště smažou – dřív zůstávaly ⭐ práce viset.
  const zachranyPole = (hra, krome) => { const s = new Set(); for (const e of hra.zachrany) if (e !== krome) for (const j of e.pole) s.add(j); return s; };
  function zrusZbytekZachrany(hra, e, ponechat) {
    const jine = zachranyPole(hra, e);
    for (const j of e.pole) {
      if (jine.has(j) || (ponechat && ponechat.has(j))) continue;
      if (e.typ === 'zebrik') { if (zebrikNa(hra, j)) zrusPlany(hra, j % W, j / W | 0, j % W, j / W | 0); }
      else if (hra.oznac[j] === P.OZN.SCHODY && pevne(hra.hora.teren[j]) && !hra.rez.has(j)) { hra.oznac[j] = 0; hra.prio[j] = 0; }
    }
  }
  function zapisZachranu(hra, kdo, z, vlastni, veci) {
    const jine = zachranyPole(hra, null);
    const pole = z.pole.filter(j => vlastni.has(j) || jine.has(j));
    const stara = kdo !== 'v' && hra.zachrany.find(e => e.kdo === kdo);
    const e = { kdo, typ: z.typ, pole, od: hra.tik };
    if (veci) e.veci = veci;
    hra.zachrany.push(e);
    if (stara) { zrusZbytekZachrany(hra, stara, new Set(z.pole)); hra.zachrany.splice(hra.zachrany.indexOf(stara), 1); }
  }
  // je pole záchrany pořád rozpracované? (plán žebříku / značka schodiště)
  const zbyvaZachrana = (hra, e) => e.pole.some(j => e.typ === 'zebrik' ? zebrikNa(hra, j) : hra.oznac[j] === P.OZN.SCHODY);
  function zachranaPotreba(hra, e, F) {
    if (e.kdo === 'srdce') {
      const srdce = hra.hora.srdce.y * W + hra.hora.srdce.x;
      return hra.veci.some(v => v.druh === 'klic') && !hra.vyhenHori && !!F && !F[srdce];
    }
    if (e.kdo === 'v') return (e.veci || []).some(id => { const v = vecPodle(hra, id); return v && !v.nese && !dosazitelna(hra, v, F); });
    const t = hra.trpaslici.find(t => 't' + t.id === e.kdo);
    return !!t && t.uvizl && !!t.zachrana && t.zachrana.typ === e.typ && e.pole.some(j => t.zachrana.pole.includes(j));
  }
  // jednou za 150 tahů (pevný rozvrh): hotové záchrany vyřadit, nepotřebné zrušit
  function hlidejZachrany(hra) {
    if (!hra.zachrany.length) return;
    hra.zachrany = hra.zachrany.filter(e => zbyvaZachrana(hra, e));
    if (!hra.zachrany.length) return;
    const F = hra.zachrany.some(e => e.kdo[0] !== 't') ? dosahZachrany(hra) : null;
    for (const e of hra.zachrany.slice()) {
      if (zachranaPotreba(hra, e, F)) continue;
      hra.zachrany.splice(hra.zachrany.indexOf(e), 1);
      zrusZbytekZachrany(hra, e);
    }
  }
  // naplánuje cestu ven ze startu: žebřík, když je dřevo (nebo schodiště nejde), jinak schodiště do skály
  // (z.nove = kolik polí se nově naplánovalo či označilo – 0 = záchrana už běží; z.oblast = kam se od startu dojde);
  // kdo / veci = komu záchrana patří (evidence hra.zachrany)
  function planujVystup(hra, start, F, kdo, veci) {
    const oblast = oblastZachrany(hra, start);
    let z = najdiZebrik(hra, start, oblast, F);
    if (!z || volneDrevo(hra) < z.pole.length) z = najdiSchody(hra, start, oblast) || z;
    if (!z) return null;
    const vlastni = new Set();
    if (z.typ === 'zebrik') for (const j of z.pole) { if (zebrikNa(hra, j)) continue; const p = S.naplanuj(hra, 'zebrik', j); if (p) { p.prio = true; vlastni.add(j); } }
    // (i pole už označené ke kopání musí být schod – vykopané bez schodiště by byla svislá šachta, kudy se padá)
    else for (const j of z.pole) { if (hra.oznac[j] !== P.OZN.SCHODY) { hra.oznac[j] = P.OZN.SCHODY; vlastni.add(j); } hra.prio[j] = 1; }
    for (const u2 of hra.trpaslici) if (u2.urovenBlok) u2.urovenBlok = UROVNE.map(() => 0);
    zapisZachranu(hra, kdo, z, vlastni, veci);
    z.nove = vlastni.size; z.oblast = oblast;
    return z;
  }
  // je záchrana pořád rozpracovaná? (žebřík: plány nebo hotový žebřík; schodiště: značky nebo vytesané schody)
  function zachranaTrva(hra, z) {
    if (!z || !z.pole || !z.pole.length) return false;
    if (z.typ === 'schody') return z.pole.some(j => hra.oznac[j] === P.OZN.SCHODY) && z.pole.every(j => hra.oznac[j] === P.OZN.SCHODY || hra.lez[j]);
    return z.pole.some(j => zebrikNa(hra, j)) && z.pole.every(j => zebrikNa(hra, j) || hra.lez[j]);
  }
  // Uvízlý trpaslík: záchrana jednou za 600 tahů; rozpracovaný žebřík bez dřeva se po 1200 tazích nahradí schodištěm
  // (plány žebříku se zruší – zapisZachranu – a donesené dřevo vypadne)
  function zachranUviznuteho(hra, t) {
    if (Array.isArray(t.zachrana)) t.zachrana = { typ: 'zebrik', pole: t.zachrana, od: hra.tik };   // starší uložení: jen pole žebříku
    const z0 = t.zachrana;
    if (zachranaTrva(hra, z0)) {
      if (!(z0.typ === 'zebrik' && hra.tik - (z0.od || 0) >= 1200 && volneDrevo(hra) < z0.pole.filter(j => zebrikNa(hra, j)).length)) return z0;
      if (t.zachranaBlok > hra.tik) return z0;
    } else if (t.zachranaBlok > hra.tik) return null;
    t.zachranaBlok = hra.tik + 600;
    const F = dosahZachrany(hra);
    if (!F) return null;
    if (zachranaTrva(hra, z0) && z0.typ === 'zebrik') {               // žebřík čeká na dřevo příliš dlouho: zkusit schodiště
      const sch = najdiSchody(hra, t.i, oblastZachrany(hra, t.i));
      if (!sch) return z0;
      // starý žebřík patří záchraně (i ze staršího uložení bez evidence): převzít, ať ho zapisZachranu zruší
      if (!hra.zachrany.some(e => e.kdo === 't' + t.id)) hra.zachrany.push({ kdo: 't' + t.id, typ: 'zebrik', pole: z0.pole.filter(j => zebrikNa(hra, j)), od: z0.od || hra.tik });
      const vlastni = new Set();
      for (const j of sch.pole) { if (hra.oznac[j] !== P.OZN.SCHODY) { hra.oznac[j] = P.OZN.SCHODY; vlastni.add(j); } hra.prio[j] = 1; }
      for (const u2 of hra.trpaslici) if (u2.urovenBlok) u2.urovenBlok = UROVNE.map(() => 0);
      zapisZachranu(hra, 't' + t.id, sch, vlastni);
      return (t.zachrana = Object.assign(sch, { od: hra.tik }));
    }
    t.zachrana = null;
    const z = planujVystup(hra, t.i, F, 't' + t.id);
    if (z) { delete z.oblast; delete z.nove; t.zachrana = Object.assign(z, { od: hra.tik }); }   // ukládá se – jen typ, pole a začátek
    return t.zachrana;
  }
  // Cenné věci v jámě, kam se ze skladu nedojde, a Srdce hory s hotovým Klíčem: jednou za 600 tahů (pevný rozvrh)
  // nanejvýš jedna nová záchrana; věc se znovu zkusí po 3000 tazích. Cenné = opravdu vzácné (hvězdná ruda a ocel, zlato,
  // drahokam, Klíč, šperk, brus, pohár) a to, co kusovník Klíče potřebuje a dosažitelně ho není dost (dřív se kvůli
  // železu zachraňovala každá ruda spadlá do šachty)
  const CENNE = new Set(['hvezdna', 'prut_hvezdny', 'zlato', 'prut_zlato', 'drahokam', 'klic', 'sperk', 'brus', 'pohar']);
  function zachranVeci(hra) {
    if (!hra.trpaslici.length || !hra.zony.some(z => z.typ === 'sklad')) return;
    const srdce = hra.hora.srdce.y * W + hra.hora.srdce.x;
    const klic = hra.veci.some(v => v.druh === 'klic') && !hra.vyhenHori && hra.znamo[srdce] && !(hra.odemceno.srdceCesta > hra.tik);
    const kus = T.pribeh.kusovnikKlice(hra);
    if (!klic && !hra.veci.some(v => !v.nese && !v.rez && (CENNE.has(v.druh) || (kus && kus.potreba[v.druh] > 0)))) return;
    const F = dosahZachrany(hra);
    if (!F) return;
    // kusovník: kolik kusů druhu je dosažitelně – zachraňuje se jen, když to nestačí
    const dosah = {};
    if (kus) for (const v of hra.veci) if (kus.potreba[v.druh] > 0 && (v.nese || dosazitelna(hra, v, F))) dosah[v.druh] = (dosah[v.druh] || 0) + 1;
    const cenna = v => CENNE.has(v.druh) || (kus && (dosah[v.druh] || 0) < (kus.potreba[v.druh] || 0));
    const kandidati = hra.veci.filter(v => !v.nese && !v.rez && cenna(v) && !(v.zachrana > hra.tik) && C.stojne(hra, v.i) && hra.znamo[v.i]);
    if (klic && !F[srdce]) {                        // Klíč je, Srdce známé, ale nikdo k němu nedojde: cesta dolů do Srdce
      hra.odemceno.srdceCesta = hra.tik + 3000;
      const z = planujVystup(hra, srdce, F, 'srdce');
      if (z) { zprava(hra, 'varovani', `Do Srdce hory se nedá dojít – ${z.typ === 'schody' ? 'vyznačeno záchranné schodiště' : 'naplánován žebřík'} (${z.pole.length} ${z.pole.length < 5 ? 'pole' : 'polí'}, ⭐ přednost).`, srdce); return; }
    }
    // věci ve stejné jámě sdílí jednu záchranu; rozpracovaná záchrana (nic nového k naplánování) se nehlásí znovu
    for (const v of kandidati) {
      if (v.zachrana > hra.tik || dosazitelna(hra, v, F)) continue;
      v.zachrana = hra.tik + 3000;
      const oblast = new Set(oblastZachrany(hra, v.i));
      const vJame = kandidati.filter(w => oblast.has(w.i));
      const z = planujVystup(hra, v.i, F, 'v', vJame.map(w => w.id));
      if (!z) continue;
      for (const w of vJame) w.zachrana = hra.tik + 3000;
      if (!z.nove) continue;
      zprava(hra, 'stavba', `${P.VECI[v.druh].nazev[0].toUpperCase() + P.VECI[v.druh].nazev.slice(1)} leží v jámě, kam se nedá dojít – ${z.typ === 'schody' ? 'vyznačeno schodiště' : 'naplánován žebřík'} (⭐ přednost).`, v.i);
      return;
    }
  }
  // nečinný trpaslík občas přešlápne na vedlejší pole
  function toulej(hra, t, zuri) {
    if (!zuri) t.stav = 'nic';
    if (P.nahoda(hra) > 0.04) return;
    const n = t.i + (P.nahoda(hra) < 0.5 ? -1 : 1);
    if (n % W === 0 || n % W === W - 1) return;
    if (C.krok(hra, t.i, n) === 'chuze') presun(t, n, DOBA.chuze + 2);
  }
  // strážce bez zbraně nebo zbroje: nejbližší volná válečná sekera / zbroj (neúspěch = 60 tahů nehledá)
  // na co plán čeká (pro detail pole): stavitel, materiál, místo, cesta, přednostnější práce; {text, spatne}
  const cekaCache = new WeakMap();
  function procCekaPlan(hra, p) {
    const c = cekaCache.get(p);
    if (c && c.tik === hra.tik) return c.r;
    let r;
    const stavitele = hra.trpaslici.filter(t => t.povoleno.stavet);
    if (p.rez) { const t = hra.trpaslici.find(u => u.id === p.rez); r = { text: `🔨 ${t ? t.jmeno + ' ho právě staví' : 'Právě se staví'}.` }; }
    else if (!S.pripraven(p)) r = { text: 'Trpaslíci nosí materiál.' };
    else if (!S.volnoProPlan(hra, p)) r = { text: 'Materiál je na místě – pole se ještě musí vykopat.' };
    else if (!S.mistoPlanu(hra, p)) r = { text: 'Pod plánem chybí pevná podlaha – takhle postavit nejde (zruš plán nebo podlahu doplň).', spatne: true };
    else if (!stavitele.length) r = { text: 'Materiál je na místě, ale nikdo nemá zapnuté 🔨 stavění – zapni ho v Klanu.', spatne: true };
    else if (!stavitele.some(t => C.hledej(hra, t.i, i => C.stojne(hra, i) && S.planVDosahu(hra, i, p) ? 1 : 0, 8000)))
      r = { text: 'Materiál je na místě, ale žádný stavitel se k plánu nedostane – chybí cesta (žebřík, schody).', spatne: true };
    else {
      const min = Math.min(...stavitele.map(t => t.povoleno.stavet));
      r = { text: `Materiál je na místě, čeká se na volného stavitele (stavění má ${stavitele.length} ${stavitele.length === 1 ? 'trpaslík' : stavitele.length < 5 ? 'trpaslíci' : 'trpaslíků'}, nejvýš na stupni ${min}; teď dělají přednostnější práci – ⭐ to uspíší).` };
    }
    cekaCache.set(p, { tik: hra.tik, r });
    return r;
  }
  function vytesejPodperu(hra, pl, t, id0) {
    hra.veci = hra.veci.filter(v => !(v.id >= id0 && (v.druh === 'kamen' || v.druh === 'jil')));   // kámen z pole je ve sloupu
    for (const [druh, n] of Object.entries(pl.doneseno)) for (let k = 0; k < n; k++) P.novaVec(hra, druh, t.i, druh === 'drevo' ? 'drevo' : 0);
    for (const k of Object.keys(pl.doneseno)) pl.doneseno[k] = S.STAVBY.podpera.mat[k];      // „hotovo" – nic dalšího se nenese
    S.dokonci(hra, pl, t, (typ, text, i) => zprava(hra, typ, text, i));
    hra.materialNa.set(pl.i, 'kamen');
    zvuk(hra, 'kladivo', pl.i);                       // dotesání sloupu
    P.usadVeci(hra);
  }
  function vybavStrazce(hra, t) {
    const chce = v => !v.nese && !v.rez && !(v.blok > hra.tik) && ((!t.zbran && v.druh === 'valecna_sekera') || (!t.zbroj && v.druh === 'zbroj'));
    let r = null;
    if (hra.veci.some(chce)) {
      const naPoli = P.volneVeci(hra);
      r = C.hledej(hra, t.i, i => { const v = (naPoli.get(i) || []).find(v => chce(v) && P.volnaVec(hra, v, i)); return v ? { typ: 'vybavit', vec: v.id, pos: i, faze: 'k_veci' } : 0; });
    }
    if (!r) { t.vybavBlok = hra.tik + 60; return false; }
    vecPodle(hra, r.hodnota.vec).rez = t.id;
    t.prace = r.hodnota; t.cesta = r.cesta; t.stav = 'jde'; t.akce = 0;
    return true;
  }
  // výstroj (nástroj, zbraň, zbroj) zůstane ležet na místě
  function odlozBojovou(hra, t) {
    const strazci = hra.trpaslici.filter(u => u !== t && u.povoleno.hlidat), co = [];
    for (const [k, druh, chybi] of [['zbran', 'valecna_sekera', u => !u.zbran], ['zbroj', 'zbroj', u => !u.zbroj]]) {
      if (!t[k] || !strazci.some(chybi)) continue;
      P.novaVec(hra, t[k].druh || druh, t.i, t[k].mat || 'zelezo'); t[k] = null; co.push(P.VECI[druh].nazev);
    }
    if (!co.length) return;
    P.usadVeci(hra);
    zprava(hra, 'stavba', `${t.jmeno} už není strážce – odložil ${co.join(' a ')} pro nevybaveného strážce.`, t.i);
  }
  function odlozVystroj(hra, t) {
    for (const k of ['nastroj', 'zbran', 'zbroj']) if (t[k]) { P.novaVec(hra, t[k].druh, t.i, t[k].mat); t[k] = null; }
    P.usadVeci(hra);
  }
  function odejdi(hra, t) {
    pustPraci(hra, t);
    odlozVystroj(hra, t);
    hra.trpaslici.splice(hra.trpaslici.indexOf(t), 1);
    zprava(hra, 'varovani', `${t.jmeno} sebral své věci a odešel z hory. Tady už to nevydržel.`, t.i);
    // smutek z odchodů se nesčítá donekonečna: −4 za každý, nejvýš −8
    for (const u of hra.trpaslici) POT.souhrnnaVzpominka(hra, u, 'odesli', n => n === 1 ? `odešel ${t.jmeno}` : `odešli z klanu (${n}, naposledy ${t.jmeno})`, -4, -4, -8, 2);
  }
  // pricina: boj, hlad, zizen, pad, zaval, magma, utonuti (počítadlo hra.padloPodle – deník má jen 200 zpráv)
  function umri(hra, t, text, pricina) {
    pustPraci(hra, t);
    odlozVystroj(hra, t);
    hra.trpaslici.splice(hra.trpaslici.indexOf(t), 1);
    zprava(hra, 'smrt', text, t.i);
    hra.padlo = (hra.padlo || 0) + 1;
    const pp = hra.padloPodle || (hra.padloPodle = {}), k = pricina || 'jine';
    pp[k] = (pp[k] || 0) + 1;
    // jeden souhrnný smutek: −12 za první smrt, −4 za každou další v jeho trvání, nejvýš −24
    for (const u of hra.trpaslici) POT.souhrnnaVzpominka(hra, u, 'truchli', n => n === 1 ? `truchlí: zemřel ${t.jmeno}` : `truchlí za padlé (${n}, naposledy ${t.jmeno})`, -12, -4, -24, 3);
    // přátelé truchlí víc a déle (−16 na 6 dní, každý další přítel −6, nejvýš −28)
    for (const u of hra.trpaslici) if (u.pratele && u.pratele.includes(t.id)) {
      POT.souhrnnaVzpominka(hra, u, 'pritel', n => n === 1 ? `ztratil přítele ${t.jmeno}` : `ztratil přátele (${n}, naposledy ${t.jmeno})`, -16, -6, -28, 6);
      u.pratele = u.pratele.filter(id => id !== t.id);
    }
    // padlý veterán (mistr boje nebo kopání): klan přijde o jeho umění a celý klan to cítí; sláva utrpí
    if (veteran(t)) {
      for (const u of hra.trpaslici) POT.vzpominka(hra, u, `padl veterán ${t.jmeno}`, -5, 4);
      hra.slavaBonus = (hra.slavaBonus || 0) - 5;
      zprava(hra, 'varovani', `${t.jmeno} byl veterán (${(t.dov.boj || 0) >= 6 ? 'boj ' + t.dov.boj : 'kopání ' + t.dov.kopani}) – jeho mistrovství nový příchozí hned nenahradí. Sláva klanu −5.`, t.i);
    }
  }
  const veteran = t => (t.dov.boj || 0) >= 6 || (t.dov.kopani || 0) >= 12;

  function krok(hra) {
    hra.tik++;
    T.obdobi.tik(hra);
    T.udalosti.tik(hra);
    T.priroda.tik(hra, (typ, text, i) => zprava(hra, typ, text, i));
    T.hrozby.tik(hra, (typ, text, i) => zprava(hra, typ, text, i));
    T.pribeh.tik(hra);
    if (hra.tik % 60 === 0) POT.obnovProstredi(hra);     // pevný rozvrh (ukládá se) – viz potreby.prostredi
    for (const t of hra.trpaslici.slice()) krokTrpaslika(hra, t);
    if (hra.tik % CAS_KROK === 0) zapisCas(hra);
    // pařezy a obří houby dorůstají
    if (hra.tik % 60 === 0 && hra.parezy.length) {
      const zima = T.obdobi.zima(hra);
      hra.parezy = hra.parezy.filter(p => {
        if (p.tik > hra.tik || (zima && !p.houba)) return true;   // v zimě stromy nedorůstají
        const volno = !hra.stavba[p.i] && !hra.planNa.has(p.i) && !hra.lez[p.i] && hra.hora.teren[p.i] === T.hora.M.VZDUCH;
        if (p.houba) { if (volno && (!hra.hora.obj[p.i] || hra.hora.obj[p.i] === O.PAREZ)) hra.hora.obj[p.i] = O.HOUBA; }   // (i houbová sazenice ve školce)
        else if (hra.hora.obj[p.i] === O.PAREZ && volno) hra.hora.obj[p.i] = O.STROM;
        return false;
      });
    }
    if (hra.tik % 20 === 0) pripravDilny(hra);
    if (hra.tik % 600 === 300) zachranVeci(hra);       // cenné věci v jámě, Srdce hory s Klíčem
    if (hra.tik % 150 === 40) hlidejZachrany(hra);    // nepotřebné záchrany (uvízlý venku, věc pryč) zrušit
    if (hra.tik % 60 === 30) S.rozmistiNabytek(hra);
    // plán naplánovaný do neznáma narazil na nekopatelnou skálu (podloží, podstavec Výhně): plán se zruší se zprávou
    if (hra.tik % 60 === 50 && nejakeBourani(hra)) for (let i = 0; i < N; i++) if (hra.oznac[i] === P.OZN.BOURAT && !P.lzeBourat(hra, i)) hra.oznac[i] = 0;   // stavba už zmizela
    if (hra.tik % 60 === 50) for (const p of hra.plany.slice()) {
      if (!S.doNeznama(S.STAVBY[p.typ]) || !hra.znamo[p.i] || !pevne(hra.hora.teren[p.i]) || P.lzeKopat(hra, p.i)) continue;
      if (hra.oznac[p.i] === P.OZN.SCHODY || hra.oznac[p.i] === P.OZN.KOPAT) hra.oznac[p.i] = 0;
      zrusPlany(hra, p.i % W, p.i / W | 0, p.i % W, p.i / W | 0);
      zprava(hra, 'varovani', `Plán (${S.STAVBY[p.typ].nazev}) narazil na skálu, která se nedá kopat – zrušen.`, p.i);
    }
    if (hra.tik % 60 === 45) hlidejNouzi(hra);   // postele, stoly a židle ze skladu do jejich zón
    // poplach: 2 = během něj už byl v hoře viděný nepřítel (ne netopýr, ne tvor v neprozkoumané jeskyni); jakmile
    // padne poslední viděný útočník, odvolá se sám (vyhlášený předem, než nepřítel přijde, zůstává)
    // počítají se jen útočníci: tvor z nájezdu, nebo viděný tvor do POPLACH_BLIZKO polí od trpaslíka (či nedávno útočil);
    // pavouk líně sedící v prozkoumané jeskyni daleko od klanu poplach nedrží
    if (hra.poplach && hra.tvorove.length) {
      let videl = false;
      for (const u of hra.tvorove) if (utocnik(hra, u)) { u.viden = 1; videl = true; }
      if (videl) hra.poplach = 2;
    }
    if (hra.poplach === 2 && !hra.tvorove.some(u => u.viden && utocnik(hra, u))) prepniPoplach(hra, false, 'Poplach odvolán – poslední útočník padl, klan se vrací k práci.');
    // úroda roste (zhruba 1 000 tahů od zasetí ke zralosti)
    if (hra.tik % 30 === 0) {
      const u = hra.uroda, rustPole = T.obdobi.OBDOBI[T.obdobi.obdobi(hra)].rust, zimaRust = T.obdobi.zima(hra);
      for (let i = 0; i < N; i++) {
        if (!u[i] || u[i] === 101) continue;
        const z = hra.zona[i] && S.zonaNa(hra, i);
        if (!z || !S.FARMY[z.typ]) { u[i] = 0; continue; }
        u[i] = Math.min(101, u[i] + (z.typ === 'pole' ? rustPole : rustHoubarny(hra, i, zimaRust)));
      }
    }
    // varování před hladem jednou za den
    if (hra.tik % TAHU_ZA_DEN === 300 && hra.trpaslici.length) {
      const z = pocty(hra), n = hra.trpaslici.length;
      if ((z.jidlo || 0) + (z.houby || 0) / 2 + (z.jecmen || 0) < 2 * n) zprava(hra, 'varovani', 'Docházejí zásoby jídla! Založ pole nebo houbárnu a postav kuchyni.');
      if ((z.pivo || 0) < 2 * n) zprava(hra, 'varovani', 'Dochází pivo! Pivovar vaří z ječmene nebo z hub.');
    }
  }

  // --- zakázky dílen (volá UI) ------------------------------------------------------------
  // r = index receptu; trvalá zakázka udržuje zásobu `pocet` kusů výrobku
  function pridejZakazku(hra, dilna, r, pocet, trvala) {
    const rc = (S.RECEPTY[dilna.typ] || [])[r];
    if (!rc) return false;                               // dílna bez receptů (zbrojnice) nebo neplatný recept
    if (T.pribeh.artefaktZakazany(hra, rc.vyrobek)) return false;
    if (rc.vyrobek.startsWith('art_')) { if (dilna.fronta.some(z => z.r === r)) return false; pocet = 1; trvala = false; }
    const z = dilna.fronta.find(z => z.r === r && !!z.trvala === !!trvala);
    if (z && trvala) z.cil = Math.max(0, z.cil + pocet);
    else if (z) z.zbyva += pocet;
    else dilna.fronta.push({ id: hra.dalsiId++, r, trvala: !!trvala, cil: trvala ? pocet : 0, zbyva: trvala ? 0 : pocet });
  }
  function posunZakazku(dilna, id, o) {             // pořadí zakázek = pořadí, v jakém je dílna dělá
    const k = dilna.fronta.findIndex(z => z.id === id), j = k + o;
    if (k < 0 || j < 0 || j >= dilna.fronta.length) return;
    [dilna.fronta[k], dilna.fronta[j]] = [dilna.fronta[j], dilna.fronta[k]];
  }
  function prioPlanu(hra, x0, y0, x1, y1) {          // ⭐ na plány staveb v obdélníku (přepíná)
    let n = 0;
    const v = j => { const x = j % W, y = j / W | 0; return x >= Math.min(x0, x1) && x <= Math.max(x0, x1) && y >= Math.min(y0, y1) && y <= Math.max(y0, y1); };
    for (const p of hra.plany) if (S.bunkyPlanu(p.typ, p.i).some(v)) { p.prio = !p.prio; n++; }     // kterékoli pole plánu (i pravé u dílny)
    for (const t of hra.trpaslici) if (t.urovenBlok) t.urovenBlok = UROVNE.map(() => 0);
    return n;
  }
  function zrusZakazku(hra, dilna, id) {
    const z = dilna.fronta.find(z => z.id === id);
    if (!z) return;
    dilna.fronta.splice(dilna.fronta.indexOf(z), 1);
    mista(dilna).forEach((m, k) => { if (m.vRobe && m.vRobe.zak === id) uvolniMisto(hra, dilna, k); });   // rozpracovaný výrobek: materiál vypadne na zem
  }
  function prepniMriz(hra, i) {
    if (hra.stavba[i] !== S.K.MRIZ) return false;
    hra.zavreno[i] ^= 1;
    if (hra.zavreno[i]) for (const t of hra.trpaslici) if (t.i === i) hra.zavreno[i] = 0;   // na trpaslíka ji nespustíme
    return !!hra.zavreno[i];
  }
  // zrušení plánů v obdélníku (donesený materiál zůstane ležet)
  function zrusPlany(hra, x0, y0, x1, y1) {
    if (x0 > x1) [x0, x1] = [x1, x0];
    if (y0 > y1) [y0, y1] = [y1, y0];
    const zrusit = new Set();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const id = hra.planNa.get(y * W + x); if (id) zrusit.add(id); }
    for (const id of zrusit) {
      const p = S.planPodle(hra, id);
      for (const t of hra.trpaslici) if (t.prace && t.prace.plan === id) { t.prace.vCeste = 0; pustPraci(hra, t); }
      S.zrusPlan(hra, p, (druh, i, mat) => P.novaVec(hra, druh, i, mat !== undefined ? mat : druh === 'drevo' ? 'drevo' : 0));
    }
    P.usadVeci(hra);
    return zrusit.size;
  }

  function den(hra) { return Math.floor(hra.tik / TAHU_ZA_DEN) + 1; }
  function hodina(hra) { return (6 + (hra.tik % TAHU_ZA_DEN) / TAHU_ZA_DEN * 24) % 24; }   // den začíná v 6:00
  function popisCinnosti(hra, t) {
    const p = t.prace;
    if (t.stav === 'pada') return 'padá!';
    if (t.zuri > hra.tik) return 'zuří! (nepracuje)';
    if (t.stav === 'bojuje') return 'bojuje!';
    if (t.stav === 'utika') return 'utíká před nepřítelem!';
    if (t.nemoc > hra.tik) return 'leží s horečkou';
    if (!p) return t.uvizl ? 'uvízl – potřebuje žebřík' : 'odpočívá';
    if (p.typ === 'spat' && p.lecit) return t.stav === 'spi' ? (p.osetrovna ? 'léčí se na ošetřovně' : 'leží zraněný v posteli') : (p.osetrovna ? 'jde na ošetřovnu' : 'jde si lehnout – je zraněný');
    if (p.typ === 'spat') return t.stav === 'spi' ? (p.postel >= 0 ? 'spí v posteli' : 'spí na zemi') : 'jde spát';
    if (p.typ === 'ukryt') return t.i === p.pos ? 'schovává se (poplach)' : 'běží se schovat (poplach)';
    if (p.typ === 'pit') return t.stav === 'ji' ? (p.voda ? 'pije vodu' : 'pije pivo') : (p.voda ? 'jde se napít k vodě' : 'jde na pivo');
    if (p.typ === 'jist') return t.stav === 'ji' ? 'jí' : p.faze === 'k_cili' ? 'nese jídlo ke stolu' : 'jde se najíst';
    if (p.typ === 'pole' && hra.zona[p.c] && (S.zonaNa(hra, p.c) || {}).typ === 'les') return (t.stav === 'kope' ? '' : 'jde ') +
      (hra.hora.obj[p.c] === O.STROM ? 'kácet les' : hra.hora.obj[p.c] === O.HOUBA ? 'kácet obří houbu' : hra.hora.pozadi[p.c] !== M.VZDUCH ? 'sázet obří houbu' : 'sázet stromek');
    if (p.typ === 'pole') return (t.stav === 'kope' ? '' : 'jde ') + (hra.uroda[p.c] === 101 ? 'sklízet' : 'sít');
    if (p.typ === 'tesat') {
      const c = p.c, tr = hra.hora.teren;
      const co = c === undefined || tr[c] === M.VZDUCH ? 'stěnu' : c >= W && tr[c - W] === M.VZDUCH ? 'podlahu' : c + W < N && tr[c + W] === M.VZDUCH ? 'strop' : 'stěnu';
      return t.stav === 'kope' ? `tesá ${co}` : p.vec && !t.nese ? 'jde pro kámen na obklad' : `jde tesat ${co}`;
    }
    if (p.typ === 'vyrobit') {
      const d = dilnaPodle(hra, p.dilna), m = d && mistoDilny(d, p.misto), z = d && m.vRobe && d.fronta.find(z => z.id === m.vRobe.zak), rc = z && receptPro(d, z);
      return (t.stav === 'kope' ? 'vyrábí ' : 'jde vyrábět ') + (rc ? rc.nazev || P.VECI[rc.vyrobek].nazev : '');
    }
    if (p.typ === 'kopat') {
      const co = hra.hora.ruda[p.c] ? T.hora.RUDA[hra.hora.ruda[p.c]].nazev : T.hora.MATERIAL[hra.hora.teren[p.c]].nazev;
      return (t.stav === 'kope' ? 'kope ' : 'jde kopat ') + co + (hra.oznac[p.c] === P.OZN.SCHODY ? ' (schodiště)' : '');
    }
    if (p.typ === 'kacet') return t.stav === 'kope' ? 'kácí jedli' : 'jde kácet';
    if (p.typ === 'bourat') return (t.stav === 'kope' ? 'rozebírá ' : 'jde rozebrat ') + S.nazevNa(hra, p.c);
    if (p.typ === 'stavet') {
      const pl = S.planPodle(hra, p.plan);
      return (t.stav === 'kope' ? 'staví ' : 'jde stavět ') + (pl ? S.STAVBY[pl.typ].nazev : '');
    }
    const v = vecPodle(hra, p.vec);
    const co = v ? P.VECI[v.druh].nazev : 'věc';
    if (p.faze === 'k_veci') return 'jde pro ' + co;
    if (p.typ === 'donest' && p.plan) { const pl = S.planPodle(hra, p.plan); return 'nese ' + co + ' na stavbu' + (pl ? ' (' + S.STAVBY[pl.typ].nazev + ')' : ''); }
    if (p.typ === 'pumpovat') return t.stav === 'kope' ? 'pumpuje vodu' : 'jde k pumpě';
    if (p.typ === 'lov') return p.sraz ? 'shromažďuje se proti Spáčovi' : 'jde na nepřítele';
    if (p.typ === 'cist') return t.stav === 'ji' ? 'luští runy předků' : 'jde číst runovou desku';
    if (p.typ === 'zazehnout') return p.faze === 'k_veci' ? 'jde pro Klíč k Srdci' : t.i === hra.hora.srdce.y * W + hra.hora.srdce.x ? 'zažíhá Výheň předků!' : 'nese Klíč do Srdce hory';
    if (p.typ === 'cvicit') return t.stav === 'kope' ? (p.naMiste ? 'cvičí se zbraní (bez zbrojnice)' : 'cvičí se zbraní') : 'jde cvičit';
    if (p.typ === 'vybavit') return 'jde si pro ' + co;
    if (p.typ === 'donest' && p.dilna) { const d = dilnaPodle(hra, p.dilna); return 'nese ' + co + ' do dílny' + (d ? ' (' + S.STAVBY[d.typ].nazev + ')' : ''); }
    return 'nese ' + co + ' do skladu';
  }

  // Co teď hoří – celý seznam seřazený podle důležitosti (váha: menší = důležitější); zkrácení a slučování dělá UI.
  // {ikona, text, vaha, i?, id?, mirne?} – i = pole, na které se dá skočit, id = trpaslík k výběru, mirne = jen nepohodlí
  function upozorneni(hra) {
    const out = [], n = hra.trpaslici.length;
    if (!n) return out;
    const pridej = (vaha, u) => out.push(Object.assign({ vaha }, u));
    const nepratele = (hra.tvorove || []).filter(u => hra.znamo[u.i]);
    if (nepratele.length) pridej(10, { ikona: '⚔️', text: `${nepratele.length} ${nepratele.length === 1 ? 'nepřítel' : nepratele.length < 5 ? 'nepřátelé' : 'nepřátel'} v hoře`, i: nepratele[0].i });
    if (hra.poplach) pridej(11, { ikona: '📯', text: 'Poplach – kdo nestráží, schovává se' + (nepratele.length ? '' : ' (nepřítel už není vidět – odvolej poplach)') });
    const uvizli = hra.trpaslici.filter(t => t.uvizl);
    if (uvizli.length) pridej(20, { ikona: '🆘', text: (uvizli.length === 1 ? `${uvizli[0].jmeno} uvízl` : `${uvizli.length} trpaslíků uvízlo (${uvizli.slice(0, 3).map(t => t.jmeno).join(', ')}${uvizli.length > 3 ? '…' : ''})`) +
      (uvizli.some(t => t.zachrana && t.zachrana.typ === 'schody') ? ' – záchranné schodiště je vyznačené' : uvizli.some(t => t.zachrana && (t.zachrana.length || (t.zachrana.pole && t.zachrana.pole.length))) ? ' – záchranný žebřík je naplánovaný, chce dřevo' : ' – potřebuje žebřík nebo schody'), i: uvizli[0].i, id: uvizli[0].id, pocet: uvizli.length });
    for (const p of hra.praskani) {
      const s_ = Math.max(0, Math.ceil((p.tik - hra.tik) / 10));
      pridej(15, { ikona: '🪨', text: `Praská strop síně – zřítí se za ${s_} s, postav podpěry`, i: (p.y - 1) * W + p.x0 });
    }
    const z = P.zasoby(hra);
    const hladovi = hra.trpaslici.filter(t => t.jidlo < 25).length, zizniv = hra.trpaslici.filter(t => t.piti < 25).length;
    if ((z.jidlo || 0) < 2 * n) pridej(25, { ikona: '🍖', text: `Dochází jídlo: ${z.jidlo || 0} pro ${n} trpaslíků` + (hladovi ? ` (${hladovi} hladových)` : '') });
    if ((z.pivo || 0) < n && zizniv) pridej(60, { ikona: '🍺', text: `Dochází pivo – ${zizniv} žíznivých pije vodu`, mirne: true });
    for (const [k, v] of Object.entries(hra.nouze || {})) if (v && NOUZE[k]) pridej(k === 'voda' ? 55 : 22, { ikona: '🚨', text: `Nouzová priorita: ${textNouze(hra, k)}`, mirne: k === 'voda' });
    const zp = predpovedZimy(hra);
    if (zp.verdikt === 'hlad' && zp.dojdeZaDni < 15 && den(hra) > 2) pridej(30, { ikona: '❄️', text: `Jídlo dojde za ~${Math.max(0, Math.round(zp.dojdeZaDni))} dní${zp.dojdeZaDni >= zp.dnyDoZimy ? ' (v zimě)' : ''} – chybí ~${zp.chybi} porcí, viz Přehled` });
    const zraneni = hra.trpaslici.filter(t => t.zdravi < 50);
    if (zraneni.length) {
      const osetrovna = hra.zony.some(z => z.typ === 'osetrovna');
      pridej(35, { ikona: '🩹', text: `${zraneni.length === 1 ? zraneni[0].jmeno + ' je těžce zraněný' : zraneni.length + ' těžce zraněných'}` + (osetrovna ? '' : ' – vyznač ošetřovnu s postelemi, hojí se tam 3× rychleji'), i: zraneni[0].i, id: zraneni[0].id });
    }
    const nevrli = hra.trpaslici.filter(t => POT.nevrly(t));
    if (nevrli.length) pridej(45, { ikona: '😠', text: `${nevrli.length === 1 ? nevrli[0].jmeno + ' je nevrlý' : nevrli.length + ' nevrlých trpaslíků'} (nálada pod ${POT.NEVRLY}) – pracují pomaleji`, i: nevrli[0].i, id: nevrli[0].id, mirne: true });
    let postele = 0; for (const k of hra.stavba) if (k === S.K.POSTEL) postele++;
    const posteleVeSkladu = hra.veci.filter(v => v.druh === 'postel').length;
    const loznice = hra.zony.some(z => z.typ === 'loznice');
    if (posteleVeSkladu && !loznice) pridej(50, { ikona: '🛏️', text: `${posteleVeSkladu} ${posteleVeSkladu === 1 ? 'postel leží' : posteleVeSkladu < 5 ? 'postele leží' : 'postelí leží'} ve skladu – vyznač ložnici (🗺️ zóny), trpaslíci je tam postaví` });
    else if (posteleVeSkladu && hra.plany.filter(p => p.typ === 'postel').length < posteleVeSkladu) pridej(65, { ikona: '🛏️', text: 'Ložnice je plná – zvětši ji, ať se vejdou postele ze skladu', mirne: true });
    else if (postele < n && den(hra) > 3 && !posteleVeSkladu) pridej(65, { ikona: '🛏️', text: `Postelí ${postele} pro ${n} trpaslíků – objednej další v tesařské dílně`, mirne: true });
    // zakázky v kovárně, které stojí (chybí ruda, pruty, uhlí, dřevo…)
    for (const b of coBlokujeVyrobu(hra)) if (b.zakazka && b.chybi.length) { pridej(40, { ikona: '⚒️', text: `${b.nazev}: ${b.chybi[0].text}`, mirne: true }); break; }
    return out.sort((a, b) => a.vaha - b.vaha);
  }

  // --- bilance zásob: výroba a spotřeba za den (průměr posledních až 4 celých dnů, jinak dnešek) ------------
  const SLEDOVANE = ['jidlo', 'pivo', 'houby', 'jecmen', 'drevo', 'kamen', 'uhli', 'prut_zelezo'];
  // kolik trpaslík sní a vypije za den: úbytek × účinná část dne (ve spánku poloviční; 0,85 naměřeno botem na
  // 10 horách × 40 dní: ~0,17 jídla a ~0,22 piva za den) / nasycení jedné porce
  const NA_TRPASLIKA = { jidlo: POT.UBYTEK.jidlo * TAHU_ZA_DEN * 0.85 / POT.NASYCENI.jidlo, pivo: POT.UBYTEK.piti * TAHU_ZA_DEN * 0.85 / POT.NASYCENI.pivo };
  // skutečná propustnost dílny proti teoretické (řemeslník jí, spí, suroviny se donášejí): naměřeno 12 dní na
  // 2 horách se zakázkou 1000 – kuchyně 9–10 z 30, pivovar 7–8 z 20 jídel/piv za den
  const PROPUSTNOST = 0.33;
  function bilance(hra) {
    const dnes = Math.floor(hra.tik / TAHU_ZA_DEN), tok = hra._tok || [];
    const uplne = tok.filter(z => z.den < dnes && z.den >= dnes - 4);
    const zaznamy = uplne.length ? uplne : tok.filter(z => z.den === dnes);
    const dni = uplne.length || Math.max(0.25, (hra.tik % TAHU_ZA_DEN) / TAHU_ZA_DEN);
    const n = hra.trpaslici.length, out = {}, vse = {}, ve = P.zasoby(hra);
    for (const v of hra.veci) vse[v.druh] = (vse[v.druh] || 0) + 1;
    for (const druh of SLEDOVANE) {
      const plus = {}, minus = {}, nepok = {};
      for (const zz of zaznamy) { const x = zz.d[druh]; if (!x) continue;
        for (const [k, v] of Object.entries(x.p)) plus[k] = (plus[k] || 0) + v;
        for (const [k, v] of Object.entries(x.m)) minus[k] = (minus[k] || 0) + v;
        for (const [k, v] of Object.entries(x.n || {})) nepok[k] = (nepok[k] || 0) + v; }
      const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
      const r = { vyroba: sum(plus) / dni, spotreba: sum(minus) / dni, nepokryto: sum(nepok) / dni, plus, minus, nepok,
                  dni: uplne.length, zasoba: vse[druh] || 0, veSkladu: ve[druh] || 0, odhad: false };
      if (NA_TRPASLIKA[druh]) {
        r.naTrpaslika = NA_TRPASLIKA[druh];
        r.potreba = n * NA_TRPASLIKA[druh];
        // bez dat (první den, po načtení hry) se spotřeba odhadne z potřeby trpaslíků
        if (!uplne.length && hra.tik % TAHU_ZA_DEN < TAHU_ZA_DEN / 2) { r.spotreba = r.potreba; r.odhad = true; }
        const dilny = hra.dilny.filter(d => S.RECEPTY[d.typ] && S.RECEPTY[d.typ].some(rc => rc.vyrobek === druh));
        r.dilen = dilny.length;
        r.kapacitaTeor = dilny.reduce((a, d) => a + 2 * Math.max(...S.RECEPTY[d.typ].filter(rc => rc.vyrobek === druh).map(rc => (rc.pocet || 1) * TAHU_ZA_DEN / rc.doba)), 0);
        r.kapacita = r.kapacitaTeor * PROPUSTNOST;
        r.uzivi = r.kapacita / NA_TRPASLIKA[druh];
        // trvalá zakázka „udržuj N": když je zásoba plná, dílna nevyrábí (výroba pak jen dorovnává spotřebu)
        r.udrzuje = dilny.reduce((a, d) => a + d.fronta.filter(z => z.trvala && S.RECEPTY[d.typ][z.r].vyrobek === druh).reduce((m, z) => Math.max(m, z.cil), 0), 0);
      }
      r.bilance = r.vyroba - r.spotreba;
      r.vydrzi = r.bilance < 0 ? r.zasoba / -r.bilance : Infinity;
      out[druh] = r;
    }
    out.blokace = coBlokujeVyrobu(hra);              // co brání výrobě nástrojů, zbraní a zbroje (viz coBlokujeVyrobu)
    return out;
  }

  // --- co blokuje výrobu nástrojů, zbraní a zbroje (železo): pro Přehled / bilanci ---------------------------------
  // Vrací [{ druh, nazev, prutu, zakazka, lze, chybi: [{ co, text }] }] – co: 'kovarna' | 'tavirna' | 'zelezo' | 'uhli' |
  // 'drevo' | 'milir'; zakazka = je na výrobek zakázka v kovárně/výhni; lze = všechno potřebné je (nebo se dá vyrobit hned).
  const ZELEZNE = [['krumpac', 'železný krumpáč', 1], ['valecna_sekera', 'válečná sekera', 2], ['zbroj', 'železná zbroj', 3], ['sekera', 'železná sekera', 1], ['kladivo', 'železné kladivo', 1]];
  function coBlokujeVyrobu(hra) {
    const v = {}; for (const x of hra.veci) if (!x.nese) v[x.druh] = (v[x.druh] || 0) + 1;
    const ma = typ => hra.dilny.some(d => d.typ === typ);
    const vyhen = ma('magmovyhen'), kovarna = ma('kovarna') || vyhen, tavirna = ma('tavirna') || vyhen;
    return ZELEZNE.map(([druh, nazev, prutu]) => {
      const chybi = [];
      const zakazka = hra.dilny.some(d => (d.typ === 'kovarna' || d.typ === 'magmovyhen') && d.fronta.some(z => S.RECEPTY[d.typ][z.r].vyrobek === druh && S.RECEPTY[d.typ][z.r].vmat !== 'med'));
      if (!kovarna) chybi.push({ co: 'kovarna', text: 'chybí kovárna (nebo magmatická výheň)' });
      const pruty = v.prut_zelezo || 0, natavit = Math.max(0, prutu - pruty);
      if (natavit) {
        if (!tavirna) chybi.push({ co: 'tavirna', text: `chybí železné pruty (${pruty}/${prutu}) a tavírna, která by je natavila` });
        if ((v.zelezo || 0) < natavit) chybi.push({ co: 'zelezo', text: hra.nalezeno.zelezo ? `chybí železná ruda (${v.zelezo || 0}/${natavit}) – označ další žílu ke kopání` : 'klan ještě nenašel železnou rudu – kopej hlouběji' });
      }
      // uhlí: na každé tavení a na kování (magmatická výheň ho nepotřebuje)
      const uhli = vyhen ? 0 : natavit + 1;
      if (uhli > (v.uhli || 0)) {
        if (ma('milir')) { if ((v.drevo || 0) < 2) chybi.push({ co: 'drevo', text: `chybí uhlí (${v.uhli || 0}/${uhli}) a milíř nemá dřevo – vysaď lesní školku nebo kácej` }); }
        else chybi.push({ co: 'uhli', text: `chybí uhlí (${v.uhli || 0}/${uhli}) – postav milíř (ze dřeva) nebo těž uhlí` });
      }
      return { druh, nazev, prutu, zakazka, lze: !chybi.length, chybi };
    });
  }

  // --- čím klan tráví čas: počítadla po dnech (vzorek každých CAS_KROK tahů, posledních 5 dní, ukládá se) -----------
  const CAS_KROK = 10;
  const CINNOSTI = {
    nosit: { nazev: 'nošení', ikona: '📦' }, pole: { nazev: 'farmy', ikona: '🌾' }, kopat: { nazev: 'kopání', ikona: '⛏️' },
    dilny: { nazev: 'dílny', ikona: '⚒️' }, stavet: { nazev: 'stavby', ikona: '🔨' }, kacet: { nazev: 'kácení', ikona: '🪓' },
    jidlo: { nazev: 'jídlo a pití', ikona: '🍖' }, spanek: { nazev: 'spánek', ikona: '💤' }, leceni: { nazev: 'léčení', ikona: '🩹' },
    obrana: { nazev: 'obrana', ikona: '⚔️' }, ukryt: { nazev: 'úkryt', ikona: '🛡️' }, pribeh: { nazev: 'runy a Srdce', ikona: '📜' },
    zachvat: { nazev: 'záchvaty vzteku', ikona: '😠' }, nic: { nazev: 'nečinnost', ikona: '💭' },
  };
  const CINNOST_PRACE = { odnes: 'nosit', donest: 'nosit', vybavit: 'nosit', pole: 'pole', kopat: 'kopat', vyrobit: 'dilny', stavet: 'stavet', bourat: 'stavet', tesat: 'stavet',
    pumpovat: 'stavet', kacet: 'kacet', jist: 'jidlo', pit: 'jidlo', lov: 'obrana', cvicit: 'obrana', ukryt: 'ukryt', cist: 'pribeh', zazehnout: 'pribeh' };
  function cinnost(hra, t) {
    if (t.zuri > hra.tik) return 'zachvat';
    if (t.stav === 'bojuje') return 'obrana';
    if (t.stav === 'utika') return 'ukryt';
    const p = t.prace;
    if (p) return p.typ === 'spat' ? (p.lecit ? 'leceni' : 'spanek') : CINNOST_PRACE[p.typ] || 'nic';
    return t.stav === 'spi' ? (t.nemoc > hra.tik ? 'leceni' : 'spanek') : 'nic';
  }
  function zapisCas(hra) {
    const d = Math.floor(hra.tik / TAHU_ZA_DEN);
    if (!hra._cas || !hra._cas.length || hra._cas[0].den !== d) hra._cas = [{ den: d, c: {} }].concat((hra._cas || []).filter(z => z.den >= d - 4));
    const c = hra._cas[0].c;
    for (const t of hra.trpaslici) { const k = cinnost(hra, t); c[k] = (c[k] || 0) + 1; }
  }
  // podíly času za posledních `dni` dní (včetně dneška): { dni, vzorku, podily: [{ klic, nazev, ikona, podil 0..1 }] } od největšího
  function casKlanu(hra, dni) {
    dni = dni || 3;
    const d = Math.floor(hra.tik / TAHU_ZA_DEN), sum = {};
    let vzorku = 0;
    for (const z of hra._cas || []) if (z.den > d - dni) for (const [k, n] of Object.entries(z.c)) { sum[k] = (sum[k] || 0) + n; vzorku += n; }
    const podily = Object.entries(sum).map(([klic, n]) => ({ klic, nazev: (CINNOSTI[klic] || { nazev: klic }).nazev, ikona: (CINNOSTI[klic] || { ikona: '•' }).ikona, podil: n / vzorku }))
      .sort((a, b) => b.podil - a.podil);
    return { dni, vzorku, podily };
  }

  // --- nouzové priority: zapínají a vypínají se samy (s hysterezí), hlášení v deníku a v Pozor ---------------
  const NOUZE = {
    hlad: { ikona: '🍖', text: 'hlad – kuchyně a donáška do kuchyně mají přednost (sklizeň, když chybí suroviny)' },
    hladBezKuchyne: { ikona: '🍖', text: 'hlad – sklizeň má přednost (bez kuchyně jí trpaslíci syrové suroviny – postav kuchyni)' },
    strop: { ikona: '🪨', text: 'praská strop – stavba podpěr má přednost' },
    voda: { ikona: '💧', text: 'voda u pumpy – čerpání má přednost' },
  };
  // text nouze podle stavu hry (hlad bez kuchyně nemá kuchyni čím zvýhodnit)
  function textNouze(hra, k) {
    if (k === 'hlad' && !hra.dilny.some(d => d.typ === 'kuchyne')) return NOUZE.hladBezKuchyne.text;
    return NOUZE[k].text;
  }
  function hlidejNouzi(hra) {
    const n = hra.trpaslici.length; if (!n) return;
    const nz = hra.nouze || (hra.nouze = {});
    let jidlo = 0, suroviny = 0; for (const v of hra.veci) if (v.druh === 'jidlo') jidlo++; else if (v.druh === 'houby' || v.druh === 'jecmen') suroviny++;
    const den_ = n * NA_TRPASLIKA.jidlo, zp = predpovedZimy(hra);
    // meze ve dnech spotřeby (dřív 1,5 / 3 / 2 dne při nadsazeném odhadu spotřeby – stejné počty jídel)
    const hlad = nz.hlad ? (jidlo < 6 * den_ || (zp.verdikt === 'hlad' && zp.dojdeZaDni < 10))
                         : (jidlo < 3 * den_ || (zp.verdikt === 'hlad' && zp.dojdeZaDni < 6));
    // pole má v nouzi přednost jen při nedostatku surovin – jinak je úzkým hrdlem kuchyně a sklizeň by jí brala nosiče
    nz.pole = hlad && (suroviny < 4 * den_ || !hra.dilny.some(d => d.typ === 'kuchyne'));
    const strop = hra.praskani.length > 0 && hra.plany.some(p => p.typ === 'podpera');
    let voda = false; for (let i = 0; i < hra.stavba.length && !voda; i++) if (hra.stavba[i] === S.K.PUMPA && T.priroda.vodaUPumpy(hra, i) >= 0) voda = true;
    for (const [k, v] of [['hlad', hlad], ['strop', strop], ['voda', voda]]) {
      if (!!nz[k] === v) continue;
      nz[k] = v;
      if (k !== 'voda') zprava(hra, v ? 'varovani' : 'stavba', v ? `⚠️ Nouze: ${textNouze(hra, k)}.` : `✅ Nouze skončila: ${NOUZE[k].text.split(' – ')[0]}.`);
      for (const t of hra.trpaslici) if (t.urovenBlok) t.urovenBlok[0] = 0;   // nouze: hned hledat znovu
    }
  }

  // --- předpověď zimy: vydrží jídlo do jara? --------------------------------------------------------
  // Jídlo se počítá v porcích: hotové jídlo + suroviny (kuchyně: houba 1 porce, ječmen 2 – viz PORCE; syrové ~½ porce).
  // Denní změna z bilance; v zimě pole nerostou (odečte se jejich podíl), houbárny ano.
  // porce jídla z kusu suroviny v kuchyni (podle receptů)
  const PORCE = {};
  for (const rc of S.RECEPTY.kuchyne) PORCE[rc.mat[0]] = Math.max(PORCE[rc.mat[0]] || 0, (rc.pocet || 1) / rc.mat.length);
  function predpovedZimy(hra) {
    const OB = T.obdobi, b = bilance(hra), n = hra.trpaslici.length;
    const d = OB.denRoku(hra), cast = (hra.tik % TAHU_ZA_DEN) / TAHU_ZA_DEN;
    const zimaOd = 3 * OB.DNI_OBDOBI + 1;                       // 37. den roku
    const vZime = d >= zimaOd;
    const dnyDoZimy = vZime ? 0 : zimaOd - d - cast;
    const dnyZimy = vZime ? OB.DNI_ROKU - d + 1 - cast : OB.DNI_OBDOBI;
    const kuchyne = b.jidlo.dilen > 0, kH = kuchyne ? PORCE.houby : 0.5, kJ = kuchyne ? PORCE.jecmen : 0.5, k = kJ;
    const surovin = b.houby.zasoba + b.jecmen.zasoba;
    const porce = b.jidlo.zasoba + kH * b.houby.zasoba + kJ * b.jecmen.zasoba;
    const sazba = b.jidlo.bilance + kH * b.houby.bilance + kJ * b.jecmen.bilance;
    const zPoli = b.jecmen.plus.pole ? b.jecmen.vyroba * b.jecmen.plus.pole / Object.values(b.jecmen.plus).reduce((a, v) => a + v, 0) : 0;
    const sazbaZima = sazba - k * zPoli;
    const naZacatku = porce + sazba * dnyDoZimy;
    const naKonci = naZacatku + sazbaZima * dnyZimy;
    const spotrebaDen = Math.max(b.jidlo.spotreba, n * NA_TRPASLIKA.jidlo);
    let verdikt, dojdeZaDni = null;
    if (naZacatku < 0) { verdikt = 'hlad'; dojdeZaDni = porce / -sazba; }
    else if (naKonci < 0) { verdikt = 'hlad'; dojdeZaDni = dnyDoZimy + naZacatku / -sazbaZima; }
    else verdikt = naKonci < 2 * spotrebaDen ? 'tesne' : 'ok';
    const chybi = Math.max(0, Math.ceil(-naKonci + (verdikt === 'hlad' ? 2 * spotrebaDen : 0)));
    const piv = b.pivo, pivaNaKonci = piv.zasoba + piv.bilance * (dnyDoZimy + dnyZimy);
    return { vZime, dnyDoZimy, dnyZimy, kuchyne, surovin, porce, sazba, sazbaZima, zPoli, naZacatku, naKonci, verdikt, dojdeZaDni, chybi,
             spotrebaDen, pivo: { zasoba: piv.zasoba, bilance: piv.bilance, naKonci: pivaNaKonci, vydrzi: pivaNaKonci >= 0 } };
  }

  T.hra = { DOVEDNOSTI, fDov, prahDov, zlepsi, procCekaPlan, TAHU_ZA_DEN, DOBA, dobaKroku, PROFESE, novaHra, krok, den, hodina, popisCinnosti, zprava, zvuk, pridejTrpaslika, noveJmeno, nahodnaProfese,
            pridejZakazku, zrusZakazku, zrusPlany, pustPraci, umri, odejdi, prepniMriz, faktorNastroje, dilnaPripravena, chybiDilne, upozorneni, smiVDilne, nastavDilnu, posunZakazku, prioPlanu, bilance, NA_TRPASLIKA, PROPUSTNOST, predpovedZimy, HLAVNI_PRACE, vychoziStupne, hlavniPrace, NOUZE, hlidejNouzi,
            textNouze, coBlokujeVyrobu, casKlanu, CINNOSTI, cinnost, prepniPoplach, farmaSklizi, zasobaPlodin, rustHoubarny, vlhkaHoubarna, PORCE,
            dosahSkladu, dosahSkladuTik, dosazitelna, hrozbaU, daleko, schovaSe, spratel, veteran, MAX_PRATEL };
})(TRP);

if (typeof module !== 'undefined') module.exports = TRP;
