/* ============================================================
   Síně pod horou – hra.js: stav hry, trpaslíci a jeden tah.

   Simulace běží v pevných tazích (10 tahů = 1 s při 1×), je
   deterministická ze seedu a nesahá na DOM. Den = 600 tahů,
   rok = 48 dní.
   Trpaslík si práci najde sám: Dijkstra od něj přes stojiště
   jednotek práce (prace.js) – vyhrává nejnižší „efektivní cena“
   = vzdálenost + postih za stupeň práce − přednost ⭐ − záchrana.
   Kdo se ocitne v oblasti chůze bez spojení se základnou (předsíň),
   uvízl: hra mu naplánuje schodiště nahoru a chodbu k ostatním.
   ============================================================ */
var SIN = globalThis.SIN = globalThis.SIN || {};

(function (S) {
  'use strict';
  const SV = S.svet, { M, O } = SV, C = S.cesty, PR = S.prace;
  const TAHU_ZA_DEN = 600, DNU_V_ROCE = 48;
  const OBDOBI = ['jaro', 'léto', 'podzim', 'zima'];

  const JMENA = ['Durin', 'Dvalin', 'Nár', 'Náin', 'Dáin', 'Bívor', 'Bávor', 'Bombur', 'Nóri', 'Ánar', 'Óin', 'Glóin',
    'Dóri', 'Ori', 'Fíli', 'Kíli', 'Torin', 'Víli', 'Skirfir', 'Virfir', 'Alfr', 'Hanar', 'Frár', 'Hornbori',
    'Lóni', 'Jari', 'Eikin', 'Grerr', 'Brokk', 'Sindri', 'Alvís', 'Andvari', 'Fjalar', 'Galar', 'Regin', 'Hreidmar'];
  const PROFESE = {
    hornik: { nazev: 'horník', barva: '#d6a82a', kopani: 6 },
    tesar: { nazev: 'tesař', barva: '#3f7f3a', kopani: 1 },
    kamenik: { nazev: 'kameník', barva: '#8a8f9a', kopani: 3 },
    kovar: { nazev: 'kovář', barva: '#b23a2a', kopani: 2 },
    sladek: { nazev: 'sládek', barva: '#b8732e', kopani: 1 },
    farmar: { nazev: 'farmář', barva: '#7c9a2a', kopani: 1 },
    strazce: { nazev: 'strážce', barva: '#3456a0', kopani: 2 },
  };
  // dovednosti: zlepšují se prací; každý stupeň = o 5 % rychlejší práce (mistr 10 = o polovinu); kopání 0–20 má vlastní vzorec
  const DOVEDNOSTI = {
    kopani: { nazev: 'kopání', ikona: '⛏️', max: 20 }, stavba: { nazev: 'stavění', ikona: '🔨', max: 10 },
    kaceni: { nazev: 'kácení', ikona: '🪓', max: 10 }, pole: { nazev: 'polní práce', ikona: '🌾', max: 10 },
    remeslo: { nazev: 'řemeslo', ikona: '⚒️', max: 10 }, tesani: { nazev: 'otesávání', ikona: '🧱', max: 10 },
    boj: { nazev: 'boj', ikona: '⚔️', max: 10 },
  };
  const ZACATEK_DOV = { strazce: { boj: 3 }, tesar: { remeslo: 3, stavba: 2 }, kamenik: { remeslo: 3, tesani: 3 }, kovar: { remeslo: 3 }, sladek: { remeslo: 3 }, farmar: { pole: 3 } };
  const DOV_PRACE = { otesat: 'tesani', kacet: 'kaceni', stavet: 'stavba', vyrobit: 'remeslo', zasit: 'pole', sklidit: 'pole' };
  const dov = (t, k) => (t.dov && t.dov[k]) || 0;
  const fDov = (t, k) => k ? 1 + 0.05 * dov(t, k) : 1;
  const prahDov = lvl => 4 + 2 * lvl;
  function zlepsi(hra, t, k) {
    const D = DOVEDNOSTI[k];
    if (!D || dov(t, k) >= D.max) return;
    if (!t.xp) t.xp = {};
    t.xp[k] = (t.xp[k] || 0) + 1;
    if (t.xp[k] < (k === 'kopani' ? 6 + 2 * dov(t, k) : prahDov(dov(t, k)))) return;
    t.xp[k] = 0; t.dov[k] = dov(t, k) + 1;
    if (t.dov[k] % 5 === 0) PR.zprava(hra, 'stavba', `${t.jmeno} se zlepšil: ${D.ikona} ${D.nazev} ${t.dov[k]}/${D.max}${t.dov[k] === D.max ? ' – mistr!' : ''}.`, t.g);
  }
  // nástroje: zrychlení práce a opotřebení (zlomený nástroj zmizí)
  function faktorNastroje(t, prace) {
    const n = t.nastroj, d = n && S.stavby.NASTROJE[n.druh];
    return d && d.prace.includes(prace) ? d[n.mat] || 1 : 1;
  }
  function opotrebuj(hra, t, prace) {
    const n = t.nastroj;
    if (!n || !S.stavby.NASTROJE[n.druh].prace.includes(prace)) return;
    n.stav -= S.stavby.OPOTREBENI[n.mat] || 2;
    if (n.stav <= 0) {
      PR.zprava(hra, 'nalez', `${t.jmeno} zlomil ${PR.VECI[n.druh].nazev}. Bude potřeba nový.`, t.g);
      t.nastroj = null; hra.ulozeno--; hra.spotrebovano++; hra.zmenaPraci++;
    }
  }
  const HLAVNI = { hornik: ['kopat'], kamenik: ['tesat', 'remeslo'], tesar: ['kacet', 'stavet', 'remeslo'],
                   kovar: ['remeslo'], sladek: ['remeslo'], farmar: ['remeslo', 'pole'] };
  function vychoziStupne(prof) {
    const p = { kopat: 2, tesat: 2, kacet: 2, stavet: 2, nosit: 1, remeslo: 2, pole: 2, hlidat: prof === 'strazce' ? 1 : 0 };
    for (const k of HLAVNI[prof] || []) p[k] = 1;
    return p;
  }
  const VOUSY = ['#7a4a22', '#b5542a', '#2a2420', '#8f8a82', '#d98a3a', '#e8e2d6', '#c9a560'];
  const POSTIH_STUPNE = 150, PREDNOST = 300, ZACHRANA = 600, POSUN = ZACHRANA + PREDNOST;
  const PAD_ZDRAVI = 30;

  // --- nová hra ---------------------------------------------------------------------
  // prázdná kostra hry (bez klanu a věcí) – pro novou hru i pro načtení uložené
  function zalozHru(seed, velikost) {
    const sv = SV.generuj(seed, velikost);
    const NP = sv.teren.length;
    sv.blok = new Uint8Array(NP);
    const hra = {
      sv, seed: sv.seed, velikost: sv.velikost, tik: 0, rng: (sv.seed ^ 0x2545F491) | 0, dalsiId: 1,
      trpaslici: [], veci: [], plany: [], parezy: [], denik: [], nalezeno: {}, objeveno: {},
      oznac: new Uint8Array(NP), prio: new Uint8Array(NP), zachrana: new Uint8Array(NP),
      rez: new Map(),                 // klíč jednotky → id trpaslíka
      zmenaPraci: 1, verzeTerenu: 1, zmeny: [], vykopano: 0, padlo: 0, nouze: {},
      slava: 0, slavaBonus: 0, odemceno: {}, karavana: null, udalost: null, nejhloubeji: 0, posledniDar: 0,
      vykopane: new Uint8Array(NP), praskani: [], prameny: [], kapAktivni: [], odcerpano: 0,
      budovy: [], budovaNa: new Int32Array(NP), planNa: new Map(), zony: [], zona: new Int32Array(NP), uroda: new Uint8Array(NP),
      prichoziNa: new Map(),          // pole skladu → kolik věcí na něj právě někdo nese
      vytvoreno: 0, spotrebovano: 0, ulozeno: 0, vyrobeno: 0,
      tvorove: [], dalsiNajezd: 36 * TAHU_ZA_DEN, dalsiNajezdTyp: 'utok', najezdu: 0, zabito: 0, oblehani: null, poplach: false,
      zakladna: sv.vstup.y * sv.W + sv.vstup.x,   // pole předsíně (patro 0)
    };
    // předsíň a schodiště předků jsou známé „odedávna“ (oblasti povrchu i podesta)
    for (const o of sv.oblasti) if (o && (o.p === 0 || o.typ === 'schody')) hra.objeveno[o.id] = 1;
    S.pribeh.vychozi(hra);
    return hra;
  }
  function novaHra(seed, velikost) {
    const hra = zalozHru(seed, velikost), sv = hra.sv;
    // klan stojí na cestě v rokli před Branou
    const pred = sv.brana.y * sv.W + sv.brana.x - 3;
    const mista = volnaMistaKolem(hra, pred, 7);
    const prof = ['hornik', 'hornik', 'kamenik', 'tesar', 'kovar', 'sladek', 'farmar'];
    const jmena = JMENA.slice();
    for (let k = 0; k < prof.length; k++) {
      const j = jmena.splice(Math.floor(PR.nahoda(hra) * jmena.length), 1)[0];
      pridejTrpaslika(hra, j, prof[k], mista[k % mista.length]);
    }
    // výchozí sklad: předsíň za Branou; zásoby, se kterými klan přišel, v něm leží
    const ps = sv.oblasti.find(o => o && o.typ === 'predsin');
    S.stavby.novaZona(hra, 0, sv.brana.x + 2, ps.y0, ps.x1, ps.y1, 'sklad');
    const sklad = volnaMistaKolem(hra, hra.zakladna, 40).filter(g => hra.zona[g]);
    let k = 0;                               // po 4 věcech na pole skladu
    const dej = (druh, n) => { for (let j = 0; j < n; j++, k++) PR.novaVec(hra, druh, sklad[Math.floor(k / S.stavby.KAPACITA_POLE) % sklad.length]); };
    dej('drevo', 6); dej('jidlo', 30); dej('pivo', 30); dej('krumpac', 2);
    for (const v of hra.veci) if (v.druh === 'krumpac') v.mat = 'med';           // staré měděné krumpáče
    for (const t of hra.trpaslici) PR.rozhledni(hra, t.g);
    // zakladatelé jsou přátelé po dvojicích (sedmý s prvním)
    const z = hra.trpaslici;
    for (let k = 0; k < z.length; k++) spratel(z[k], z[k % 2 ? k - 1 : (k + 1) % z.length]);
    S.obdobi.novyDen(hra);
    PR.zprava(hra, 'pribeh', `Klan dorazil roklí k Bráně předků hory ${sv.jmeno}. Hora mlčí.`, sv.brana.y * sv.W + sv.brana.x);
    hra.zmeny.length = 0;
    return hra;
  }
  // n průchozích polí nejblíž k poli g (BFS v patře)
  function volnaMistaKolem(hra, g, n) {
    const r = [];
    C.hledej(hra, [g], h => { if (C.pruchozi(hra.sv, h)) r.push(h); return r.length >= n; }, 400);
    return r;
  }
  const MAX_PRATEL = 3;
  function spratel(a, b) {
    if (!a || !b || a === b) return;
    for (const [x, y] of [[a, b], [b, a]]) { const p = x.pratele || (x.pratele = []); if (!p.includes(y.id) && p.length < MAX_PRATEL) p.push(y.id); }
  }
  function noveJmeno(hra, vyloucit) {
    const pouzita = new Set(hra.trpaslici.map(t => t.jmeno).concat(vyloucit || []));
    const volna = JMENA.filter(j => !pouzita.has(j));
    if (volna.length) return volna[Math.floor(PR.nahoda(hra) * volna.length)];
    return JMENA[Math.floor(PR.nahoda(hra) * JMENA.length)] + ' ' + ['mladší', 'z Rokle', 'Kamenný', 'Rudovous'][Math.floor(PR.nahoda(hra) * 4)];
  }
  function nahodnaProfese(hra) { const k = Object.keys(PROFESE).filter(p => p !== 'strazce'); return k[Math.floor(PR.nahoda(hra) * k.length)]; }
  function pridejTrpaslika(hra, jmeno, prof, g) {
    const t = {
      id: hra.dalsiId++, jmeno, prof, vous: VOUSY[Math.floor(PR.nahoda(hra) * VOUSY.length)],
      g, dalsi: -1, krok: 0, krokDoba: 0, smer: Math.floor(PR.nahoda(hra) * 8),
      cesta: [], prace: null, faze: '', akce: 0, akceDoba: 0, nese: 0,
      zdravi: 100, dov: Object.assign({ kopani: PROFESE[prof].kopani }, ZACATEK_DOV[prof] || {}), xp: {}, povoleno: vychoziStupne(prof), nastroj: null, zbran: null, zbroj: null, utok: 0,
      hledej: 0, uvizl: false, zachranaTik: -1e9, mrtvy: false, cil: null,
    };
    S.potreby.vychozi(t);
    hra.trpaslici.push(t);
    return t;
  }

  // --- výběr práce ------------------------------------------------------------------
  function najdiPraci(hra, t) {
    const mapa = PR.prestavJednotky(hra);
    const komp = C.komponenty(hra);
    // rychlé odmítnutí: v mé oblasti chůze není žádná volná jednotka, kterou smím dělat
    const vOblasti = hra._vKomp.get(komp[t.g]);
    if (!vOblasti || !vOblasti.some(j => t.povoleno[PR.SKUPINA[j.druh]] && (!hra.rez.has(j.klic) || hra.rez.get(j.klic) === t.id))) return false;
    t.hledano = (t.hledano || 0) + 1;
    const vyber = new Map(), vyhrazene = new Set(hra.trpaslici.filter(u => u.dilna).map(u => u.dilna));
    const res = C.hledej(hra, [t.g], (g, d) => {
      const js = mapa.get(g);
      if (!js) return undefined;
      let nej;
      for (const j of js) {
        let stupen = t.povoleno[PR.SKUPINA[j.druh]];
        if (!stupen) continue;
        if (j.druh === 'vyrobit') {
          // vyhrazené pracoviště: přiřazený jen ke své dílně, k dílně s přiřazeným nikdo jiný
          if (t.dilna && t.dilna !== j.dilnaTyp) continue;
          if (!t.dilna && vyhrazene.has(j.dilnaTyp)) continue;
          if (t.dilna === j.dilnaTyp) stupen = 1;
          else if (j.prof && j.prof !== t.prof) stupen = Math.max(stupen, 3);       // dílna jiné profese: až když není nic jiného
        }
        const r = hra.rez.get(j.klic);
        if (r !== undefined && r !== t.id) continue;
        const ef = d + POSUN + (stupen - 1) * POSTIH_STUPNE - (j.prio ? PREDNOST : 0) - (j.zachrana ? ZACHRANA : 0);
        if (nej === undefined || ef < nej.ef) nej = { ef, j };
      }
      if (!nej) return undefined;
      vyber.set(g, nej.j);
      return nej.ef;
    }, 6000, POSUN - (hra._jedBonus || 0));
    if (!res) return false;
    const j = vyber.get(res.cil);
    hra.rez.set(j.klic, t.id);
    t.prace = j; t.faze = j.druh === 'donest' || j.druh === 'odnest' ? 'vzit' : 'jit'; t.cesta = res.cesta;
    return true;
  }
  function pustPraci(hra, t) {
    if (t.prace && hra.rez.get(t.prace.klic) === t.id) hra.rez.delete(t.prace.klic);
    if (t.nese) {                          // nesenou věc položí, kde stojí
      const v = PR.vecPodle(hra, t.nese);
      if (v) { v.g = t.g; hra.zmenaPraci++; }
      t.nese = 0;
    }
    uvolniCil(hra, t);
    t.prace = null; t.faze = ''; t.akce = 0; t.akceDoba = 0; t.cesta = []; t.spi = false;
  }
  // rezervace cíle nesené věci (plán, dílna, místo ve skladu)
  function uvolniCil(hra, t) {
    const c = t.cil;
    if (!c) return;
    if (c.typ === 'plan') { const pl = S.stavby.planPodle(hra, c.id); if (pl && pl.prichazi[c.druh]) pl.prichazi[c.druh]--; }
    else if (c.typ === 'dilna') { const d = S.stavby.budovaPodle(hra, c.id), m = d && d.mista[c.k]; if (m && m.prichazi[c.druh]) m.prichazi[c.druh]--; }
    else if (c.typ === 'sklad') { const n = (hra.prichoziNa.get(c.g) || 1) - 1; if (n > 0) hra.prichoziNa.set(c.g, n); else hra.prichoziNa.delete(c.g); }
    t.cil = null;
    hra.zmenaPraci++;
  }
  // je jednotka pořád platná a stojí trpaslík na jejím stojišti?
  function platna(hra, t) {
    const j = t.prace;
    if (!j) return false;
    if (t.faze === 'odnest') return !!t.nese && !!PR.vecPodle(hra, t.nese);
    const mapa = PR.prestavJednotky(hra), js = mapa.get(t.g);
    if (!js) return false;
    const nova = js.find(x => x.klic === j.klic);
    if (!nova) return false;
    t.prace = nova;
    return true;
  }

  // --- tah trpaslíka ----------------------------------------------------------------
  function krokTrpaslika(hra, t) {
    if (t.mrtvy) return;
    const sv = hra.sv, POT = S.potreby;
    const smrt = POT.tik(hra, t);
    if (smrt) { umri(hra, t, smrt); return; }
    if (t.spi) { if (POT.spanekTik(hra, t)) t.hledej = hra.tik; return; }
    const pz = (t.g / sv.N) | 0;
    if (pz * 20 > hra.nejhloubeji) hra.nejhloubeji = pz * 20;
    // nemocný leží (horečka z události)
    if (t.nemoc > hra.tik && !t.krokDoba) { if (t.prace) pustPraci(hra, t); t.lezi = true; t.spanek = Math.min(100, t.spanek + 0.3); return; }
    t.lezi = false;
    // záchvat vzteku po dlouhé zlé náladě; druhý v témž období = odchod z hory
    if (t.zlost >= 1200 && !(t.zuri > hra.tik) && !t.krokDoba) {
      pustPraci(hra, t); t.zlost = 0;
      t.zachvaty = (t.zachvaty || 0) + 1;
      if (t.zachvaty >= 2) { odejdi(hra, t); return; }
      t.zuri = hra.tik + 400;
      PR.zprava(hra, 'varovani', `${t.jmeno} má záchvat vzteku! Kope do zdí a nechce pracovat.`, t.g);
    }
    if ((t.zuri > hra.tik || t.cekej > 0) && !t.krokDoba && !t.cesta.length) {
      if (t.cekej > 0) t.cekej--;
      if (t.prace) pustPraci(hra, t);
      if (t.zuri > hra.tik && (hra.tik + t.id) % 25 === 0) {            // zuřící se toulá
        const s = PR.stojiskaKolem(sv, t.g); if (s.length) t.cesta = [s[Math.floor(PR.nahoda(hra) * s.length)]];
      }
      if (!t.cesta.length) return;
    }
    if (t.krokDoba) {                                   // rozpracovaný krok
      if (++t.krok >= t.krokDoba) {
        // cíl kroku mezitím zastavěli (stavba, zeď…): zůstane, kde byl, a cestu přehodnotí
        if (!C.pruchozi(sv, t.dalsi) && sv.obj[t.dalsi] !== O.DIRA) { t.dalsi = -1; t.krok = 0; t.krokDoba = 0; t.cesta = []; t.hledej = hra.tik; return; }
        t.g = t.dalsi; t.dalsi = -1; t.krok = 0; t.krokDoba = 0;
        if (sv.obj[t.g] === O.DIRA) { spadni(hra, t); return; }
        PR.rozhledni(hra, t.g);
      }
      return;
    }
    const HR = S.hrozby;
    if (hra.tvorove.length) {
      if (HR.branSe(hra, t)) return;
      // strážce při známém nepříteli práci přeruší (a jde na lov)
      if (t.povoleno.hlidat && (hra.tik + t.id) % 30 === 0 && !(t.lovBlok > hra.tik) && t.prace && !t.prace.potreba && t.prace.osobni !== 'lov' && HR.znamyNepritel(hra)) { pustPraci(hra, t); t.hledej = hra.tik; }
    }
    if (t.akce > 0) {
      if (t.prace && !t.prace.potreba && POT.kriticke(t)) { pustPraci(hra, t); t.hledej = hra.tik; return; }   // hlad práci přeruší
      if (t.prace && !t.prace.potreba && t.akce % 8 === 4) zvukPrace(hra, t);
      if (--t.akce === 0) {
        if (t.prace && t.prace.osobni === 'cvicit') { zlepsi(hra, t, 'boj'); zlepsi(hra, t, 'boj'); t.prace = null; t.faze = ''; t.hledej = hra.tik; }
        else if (t.prace && t.prace.potreba) { POT.hotovo(hra, t); konecPotreby(hra, t); }
        else hotovaAkce(hra, t);
      }
      return;
    }
    if (t.cesta.length) {
      const h = t.cesta[0];
      if (!C.pruchozi(sv, h)) { pustPraci(hra, t); t.hledej = hra.tik + 5; return; }
      t.cesta.shift();
      t.dalsi = h; t.krok = 0; t.krokDoba = C.dobaKroku(sv, t.g, h) + (t.nese ? 1 : 0);
      t.smer = smerKroku(sv, t.g, h, t.smer);
      return;
    }
    if (t.prace && t.prace.osobni) { osobniPrisel(hra, t); return; }
    if (t.prace && t.prace.potreba) {
      const d = POT.prisel(hra, t);
      if (d < 0) { pustPraci(hra, t); t.hledej = hra.tik + 5; }
      else if (d > 0 && !t.spi) { t.akce = t.akceDoba = d; }
      return;
    }
    if (t.prace) { zacniAkci(hra, t); return; }
    if (hra.tik >= t.hledej) {
      t.hledej = hra.tik + 15 + (t.id % 7);
      const zvol = u => { if (!u) return false; t.prace = u.prace; t.faze = u.prace.faze; t.cesta = u.cesta; return true; };
      // poplach: civilisté do úkrytu (uzavřená místnost s dveřmi) a tam čekají; jen kritická potřeba je pustí ven
      if (hra.poplach && !t.povoleno.hlidat && !POT.kriticke(t)) {
        const m = S.mistnosti.mistnostNa(hra, t.g);
        if (!zvol(HR.ukryt(hra, t)) && !(m && m.uzavrena && m.dvere)) najdiPraci(hra, t);          // úkryt není: pracuje dál
        return;
      }
      if (t.povoleno.hlidat && !POT.kriticke(t)) {
        if (hra.tvorove.length && zvol(HR.lov(hra, t))) { t.cesta = t.cesta.slice(0, 12); return; }     // cíl se hýbe: kus cesty, pak znovu
        if (hra.tik >= (t.vybavTik || 0) && zvol(HR.vybavStrazce(hra, t))) return;
      }
      if (POT.potrebuje(hra, t) && zvol(POT.najdi(hra, t))) return;
      if (hra.tik >= (t.vybavTik || 0) && vybav(hra, t)) return;
      if (hra.veci.some(v => v.druh === 'klic') && zvol(S.pribeh.ukolZazehnout(hra, t))) return;
      if (!najdiPraci(hra, t) && t.povoleno.hlidat && hra.tik >= (t.cvicTik || 0)) { t.cvicTik = hra.tik + 120; zvol(HR.vycvik(hra, t)); }
    }
  }
  function smerKroku(sv, a, b, puv) {
    const d = b - a, W = sv.W;
    if (Math.abs(d) === sv.N) return puv;
    const dx = ((d % W) + W + 1) % W - 1, dy = Math.round((d - dx) / W);
    return Math.round((Math.atan2(dy, dx) / (Math.PI / 4) + 8)) % 8;
  }
  function konecPotreby(hra, t) {
    if (t.nese) { const v = PR.vecPodle(hra, t.nese); if (v) v.g = t.g; t.nese = 0; hra.zmenaPraci++; }
    t.prace = null; t.faze = ''; t.cesta = []; t.hledej = hra.tik;
  }
  function zacniAkci(hra, t) {
    if (!platna(hra, t)) { pustPraci(hra, t); return; }
    const j = t.prace;
    if (t.faze === 'odnest') { t.akce = t.akceDoba = 4; return; }
    t.akce = t.akceDoba = Math.max(3, Math.round(PR.dobaJednotky(hra, j, t) / S.potreby.rychlost(t) / faktorNastroje(t, j.druh) / fDov(t, DOV_PRACE[j.druh]) / S.pribeh.faktor(hra, j.druh)));
    // natočit se k práci
    if (j.cil !== t.g) t.smer = smerKroku(hra.sv, t.g, j.cil, t.smer);
  }
  function hotovaAkce(hra, t) {
    const j = t.prace;
    if (!j) return;
    if (j.druh === 'donest' || j.druh === 'odnest') { nosicAkce(hra, t, j); return; }
    if (hra.rez.get(j.klic) === t.id) hra.rez.delete(j.klic);
    t.prace = null; t.faze = '';
    const jedle = j.druh === 'kacet' && hra.sv.obj[j.cil] === O.JEDLE;
    PR.dokonci(hra, j, t);
    if (j.druh === 'kopat' || j.druh === 'schody' || j.druh === 'dira') PR.zvuk(hra, 'vykop', j.cil);
    else if (jedle) PR.zvuk(hra, 'strom', j.cil);
    else if (j.druh === 'stavet') PR.zvuk(hra, 'postaveno', j.cil);
    opotrebuj(hra, t, j.druh);
    zlepsi(hra, t, j.druh === 'kopat' || j.druh === 'schody' || j.druh === 'dira' ? 'kopani' : DOV_PRACE[j.druh]);
    t.hledej = hra.tik;                                // hned další práce
  }

  // zvuk rozdělané práce (každých 8 tahů akce): údery krumpáče podle horniny, sekera, kladivo, dílny
  const KOVY = new Set(['tavirna', 'kovarna', 'magmovyhen', 'runova_kovarna']);
  function zvukPrace(hra, t) {
    const j = t.prace, sv = hra.sv;
    if (j.osobni) { if (j.osobni === 'cvicit') PR.zvuk(hra, 'boj', t.g, true); return; }
    switch (j.druh) {
      case 'kopat': case 'schody': case 'dira': {
        const g = j.druh === 'dira' && sv.teren[j.cil] === M.VOLNO ? j.cil + sv.N : j.cil, m = SV.MATERIAL[sv.teren[g]];
        PR.zvuk(hra, 'uder', j.cil, { tvrdost: m && m.tvrdost !== Infinity ? m.tvrdost || 2 : 6, ruda: !!sv.ruda[g] });
        break;
      }
      case 'kacet': PR.zvuk(hra, 'sekera', j.cil); break;
      case 'otesat': PR.zvuk(hra, 'uder', j.cil, { tvrdost: 3 }); break;
      case 'stavet': case 'cist': case 'poklad': if (j.druh === 'stavet') PR.zvuk(hra, 'kladivo', j.cil); break;
      case 'vyrobit': PR.zvuk(hra, KOVY.has(j.dilnaTyp) ? 'kovadlina' : 'dilna', j.cil); break;
      case 'pumpovat': PR.zvuk(hra, 'voda', j.cil); break;
    }
  }
  // vyzvednutí nástroje, který se hodí k profesi (železný má přednost před měděným)
  function vybav(hra, t) {
    t.vybavTik = hra.tik + 300 + (t.id % 30);
    const chce = S.stavby.PREFERUJE[t.prof];
    if (!chce || (t.nastroj && t.nastroj.druh === chce && t.nastroj.mat === 'zelezo')) return false;
    const vzate = new Set(hra.trpaslici.filter(u => u !== t && u.prace && u.prace.vec).map(u => u.prace.vec));
    const lepsi = v => v.druh === chce && v.g >= 0 && !vzate.has(v.id) && (!t.nastroj || t.nastroj.druh !== chce || (v.mat || 'zelezo') === 'zelezo');
    const naPoli = new Map();
    for (const v of hra.veci) if (lepsi(v)) naPoli.set(v.g, v);
    if (!naPoli.size) return false;
    const res = C.hledej(hra, [t.g], g => naPoli.has(g), 6000);
    if (!res) return false;
    t.prace = { osobni: 'vybavit', vec: naPoli.get(res.cil).id, faze: 'k_veci', klic: 'osobni' }; t.cesta = res.cesta;
    return true;
  }
  // osobní cesty: vybavení, lov (boj sám řeší branSe), cvičení ve zbrojnici, úkryt
  function osobniPrisel(hra, t) {
    const o = t.prace.osobni;
    if (o === 'vybavit') { vybavPrisel(hra, t); return; }
    if (o === 'cvicit' && t.g === t.prace.misto) { t.akce = t.akceDoba = 100; return; }
    if (o === 'ukryt') { t.prace = null; t.faze = ''; t.hledej = hra.tik + 40; return; }
    if (o === 'cekat') { t.prace = null; t.faze = ''; t.hledej = hra.tik + 20; return; }
    if (o === 'zazehnout') { if (!S.pribeh.zazehnutiPrisel(hra, t)) { if (t.prace) pustPraci(hra, t); t.hledej = hra.tik + 5; } return; }
    t.prace = null; t.faze = ''; t.hledej = hra.tik;
  }
  const ZBRANE = new Set(['valecna_sekera', 'kuse']);
  function vybavPrisel(hra, t) {
    const v = PR.vecPodle(hra, t.prace.vec);
    if (v && v.g === t.g && (ZBRANE.has(v.druh) || v.druh === 'zbroj')) {
      const slot = v.druh === 'zbroj' ? 'zbroj' : 'zbran';
      if (t[slot]) S.stavby.vratVec(hra, t[slot].druh, t.g).mat = t[slot].mat;
      t[slot] = { druh: v.druh, mat: v.mat || 'zelezo' };
      PR.odeberVec(hra, v); hra.ulozeno++;
    } else if (v && v.g === t.g) {
      if (t.nastroj) { S.stavby.vratVec(hra, t.nastroj.druh, t.g).mat = t.nastroj.mat; }       // starý nástroj nechá ležet
      t.nastroj = { druh: v.druh, mat: v.mat || 'zelezo', stav: 100 };
      PR.odeberVec(hra, v); hra.ulozeno++;
    }
    t.prace = null; t.faze = ''; t.hledej = hra.tik;
  }
  // vyhrazené pracoviště: trpaslík dělá jen v dílně daného typu (ostatní práce se vypnou a po zrušení vrátí)
  function nastavDilnu(hra, t, typ) {
    if (typ) {
      if (!t.dilna) t.povolenoPred = Object.assign({}, t.povoleno);
      t.dilna = typ;
      for (const k of Object.keys(t.povoleno)) t.povoleno[k] = k === 'remeslo' ? 1 : 0;
    } else if (t.dilna) {
      delete t.dilna;
      if (t.povolenoPred) { Object.assign(t.povoleno, t.povolenoPred); delete t.povolenoPred; }
    }
    pustPraci(hra, t); hra.zmenaPraci++;
  }
  // nouzové priority: hlad (málo jídla) – kuchyně má přednost a obslouží ji kdokoli, chybí-li suroviny i sklizeň
  const JIDLA_NA_DEN = 0.2;
  function hlidejNouzi(hra) {
    const n = hra.trpaslici.length; if (!n) return;
    const nz = hra.nouze || (hra.nouze = {});
    let jidlo = 0, suroviny = 0;
    for (const v of hra.veci) if (v.druh === 'jidlo') jidlo++; else if (v.druh === 'houby' || v.druh === 'jecmen' || v.druh === 'ryba') suroviny++;
    const den = n * JIDLA_NA_DEN, kuchyne = hra.budovy.some(b => b.typ === 'kuchyne');
    const hlad = nz.hlad ? jidlo < 6 * den : jidlo < 3 * den;
    const pole = hlad && (suroviny < 4 * den || !kuchyne);
    const strop = hra.praskani.length > 0 && hra.plany.some(p => S.stavby.STAVBY[p.typ].obj === O.SLOUP);
    const voda = hra.budovy.some(b => b.typ === 'pumpa' && S.priroda.vodaUPumpy(hra, b) >= 0);
    for (const [k, v, text] of [['strop', strop, 'praská strop – stavba sloupů má přednost'], ['voda', voda, 'voda u pumpy – čerpání má přednost']]) {
      if (!!nz[k] === v) continue;
      nz[k] = v; hra.zmenaPraci++;
      if (k === 'strop') PR.zprava(hra, v ? 'varovani' : 'stavba', v ? `⚠️ Nouze: ${text}.` : '✅ Nouze skončila: praskající strop.');
    }
    if (!!nz.hlad !== hlad) PR.zprava(hra, hlad ? 'varovani' : 'stavba', hlad ? (kuchyne ? '⚠️ Nouze: hlad – kuchyně a donáška do ní mají přednost.' : '⚠️ Nouze: hlad – sklizeň má přednost (postav kuchyni).') : '✅ Nouze skončila: hlad.');
    if (!!nz.hlad !== hlad || !!nz.pole !== pole) hra.zmenaPraci++;
    nz.hlad = hlad; nz.pole = pole;
  }

  // donášení (do plánu / dílny) a odnášení do skladu: fáze vzít → nést → položit
  function nosicAkce(hra, t, j) {
    const sv = hra.sv, ST = S.stavby;
    if (t.faze === 'vzit') {
      const druh = j.druh === 'donest' ? j.vecDruh : null;
      const v = j.druh === 'odnest' ? PR.vecPodle(hra, j.vec) : hra.veci.find(x => x.g === t.g && x.druh === druh);
      if (!v || v.g !== t.g) { pustPraci(hra, t); return; }
      let stojiste;
      if (j.druh === 'donest') {
        const b = j.cilTyp === 'plan' ? ST.planPodle(hra, j.cilId) : ST.budovaPodle(hra, j.cilId);
        const cil = j.cilTyp === 'plan' ? b : b && b.mista[j.misto];
        const chybi = !b ? 0 : j.cilTyp === 'plan' ? ST.chybi(b, druh) : ST.chybiDilne(b, j.misto, druh);
        if (chybi <= 0) { pustPraci(hra, t); return; }
        cil.prichazi[druh] = (cil.prichazi[druh] || 0) + 1;
        t.cil = { typ: j.cilTyp, id: j.cilId, druh, k: j.misto };
        stojiste = j.cilTyp === 'plan' ? stojiskaPlanu(hra, b) : ST.predniPole(sv, b).filter(h => C.pruchozi(sv, h));
      } else {
        // nejbližší sklad, který věc přijme a má místo (sklad s předností má náskok)
        const naPoli = new Map();
        for (const x of hra.veci) if (x.g >= 0) naPoli.set(x.g, (naPoli.get(x.g) || 0) + 1);
        const r = C.hledej(hra, [t.g], (g, d) => {
          if (!ST.prijme(hra, g, v.druh)) return undefined;
          if ((naPoli.get(g) || 0) + (hra.prichoziNa.get(g) || 0) >= ST.kapacita(hra, g)) return undefined;
          const z = ST.zonaNa(hra, g);
          return d + (z && z.prio ? 0 : 300);
        }, 8000, hra.zony.some(z => z.typ === 'sklad' && z.prio) ? 0 : 300);
        if (!r) { v.neodnaset = hra.tik + 600; pustPraci(hra, t); return; }     // dosažitelný sklad s místem není: den věc nenabízet (jinak se nosič zacyklí)
        hra.prichoziNa.set(r.cil, (hra.prichoziNa.get(r.cil) || 0) + 1);
        t.cil = { typ: 'sklad', g: r.cil };
        stojiste = [r.cil];
      }
      v.g = -1; t.nese = v.id; hra.zmenaPraci++;
      const st = new Set(stojiste);
      const res = st.has(t.g) ? { cesta: [] } : C.hledej(hra, [t.g], g => st.has(g), 8000);
      if (!res) { pustPraci(hra, t); return; }
      t.faze = 'odnest'; t.cesta = res.cesta;
      return;
    }
    // položit
    const v = PR.vecPodle(hra, t.nese), c = t.cil;
    if (v && c && c.typ === 'sklad') {
      const naPoli = hra.veci.filter(x => x.g === c.g).length;
      if (t.g === c.g && ST.prijme(hra, c.g, v.druh) && naPoli < ST.kapacita(hra, c.g)) { v.g = c.g; t.nese = 0; }
    } else if (v && c) {
      const b = c.typ === 'plan' ? ST.planPodle(hra, c.id) : ST.budovaPodle(hra, c.id);
      const cil = c.typ === 'plan' ? b : b && b.mista[c.k];
      if (cil) {
        const sklad = c.typ === 'plan' ? cil.doneseno : cil.zasoba;
        cil.prichazi[c.druh] = Math.max(0, (cil.prichazi[c.druh] || 0) - 1);
        t.cil = null;
        sklad[v.druh] = (sklad[v.druh] || 0) + 1;
        if (v.mat && c.typ === 'plan') cil.vmat = v.mat;
        PR.odeberVec(hra, v); hra.ulozeno++; t.nese = 0;
      }
    }
    pustPraci(hra, t);                      // nevyšlo-li položení, věc zůstane na zemi u nosiče
    t.hledej = hra.tik;
  }
  function stojiskaPlanu(hra, pl) {
    const sv = hra.sv, st = [], ST = S.stavby, d = ST.STAVBY[pl.typ];
    const vcetne = !ST.blokuje(pl.typ) && d.misto !== 'dira' && d.misto !== 'lavka' && d.misto !== 'rozbity';
    for (const h of pl.bunky) for (const s of PR.stojiskaKolem(sv, h, vcetne)) if ((vcetne || !pl.bunky.includes(s)) && !st.includes(s)) st.push(s);
    return st;
  }

  // --- pád a uvíznutí ---------------------------------------------------------------
  function spadni(hra, t) {
    const sv = hra.sv;
    pustPraci(hra, t);
    t.krokDoba = 0; t.dalsi = -1;
    t.g += sv.N;
    t.zdravi -= PAD_ZDRAVI;
    PR.zprava(hra, 'varovani', `${t.jmeno} propadl dírou o patro níž (−${PAD_ZDRAVI} zdraví).`, t.g);
    PR.odhalOkoli(hra, t.g); PR.rozhledni(hra, t.g);
    if (t.zdravi <= 0) umri(hra, t, 'pád dírou');
    t.hledej = hra.tik + 10;
  }
  function odlozVystroj(hra, t) {
    for (const k of ['nastroj', 'zbran', 'zbroj']) if (t[k]) { S.stavby.vratVec(hra, t[k].druh, t.g).mat = t[k].mat; t[k] = null; }
  }
  function umri(hra, t, pricina) {
    pustPraci(hra, t);
    odlozVystroj(hra, t);
    t.mrtvy = true; hra.padlo++;
    PR.zprava(hra, 'smrt', `${t.jmeno} zemřel (${pricina}).`, t.g);
    hra.trpaslici = hra.trpaslici.filter(x => x !== t);
    const POT = S.potreby;
    for (const u of hra.trpaslici) POT.souhrnnaVzpominka(hra, u, 'truchli', n => n === 1 ? `truchlí: zemřel ${t.jmeno}` : `truchlí za padlé (${n}, naposledy ${t.jmeno})`, -12, -4, -24, 3);
    for (const u of hra.trpaslici) if (u.pratele && u.pratele.includes(t.id)) {
      POT.souhrnnaVzpominka(hra, u, 'pritel', n => n === 1 ? `ztratil přítele ${t.jmeno}` : `ztratil přátele (${n}, naposledy ${t.jmeno})`, -16, -6, -28, 6);
      u.pratele = u.pratele.filter(id => id !== t.id);
    }
  }
  function odejdi(hra, t) {
    pustPraci(hra, t);
    odlozVystroj(hra, t);
    t.mrtvy = true;
    hra.trpaslici = hra.trpaslici.filter(x => x !== t);
    PR.zprava(hra, 'varovani', `${t.jmeno} sebral své věci a odešel z hory. Tady už to nevydržel.`, t.g);
    for (const u of hra.trpaslici) S.potreby.souhrnnaVzpominka(hra, u, 'odesli', n => n === 1 ? `odešel ${t.jmeno}` : `odešli z klanu (${n}, naposledy ${t.jmeno})`, -4, -4, -8, 2);
  }

  function hlidejUvizle(hra) {
    const komp = C.komponenty(hra), zak = komp[hra.zakladna];
    for (const t of hra.trpaslici) {
      if (t.krokDoba) continue;
      const u = komp[t.g] !== zak;
      if (u && !t.uvizl) PR.zprava(hra, 'varovani', `${t.jmeno} uvízl – nemá cestu k ostatním.`, t.g);
      if (!u && t.uvizl) PR.zprava(hra, 'info', `${t.jmeno} má zase cestu domů.`, t.g);
      t.uvizl = u;
      if (u && hra.tik - t.zachranaTik > 3 * TAHU_ZA_DEN && !zachranaBezi(hra, komp[t.g])) {
        t.zachranaTik = hra.tik;
        naplanujZachranu(hra, t);
      }
    }
  }
  // běží už záchrana pro oblast? (značka záchrany, jejíž stojiště leží v této oblasti)
  function zachranaBezi(hra, k) {
    const mapa = PR.prestavJednotky(hra), komp = C.komponenty(hra);
    for (const [s, js] of mapa) if (komp[s] === k && js.some(j => j.zachrana)) return true;
    return false;
  }
  // schodiště z oblasti uvízlého o patro výš a chodba ke zbytku klanu (0-1 BFS přes skálu)
  function naplanujZachranu(hra, t) {
    const sv = hra.sv, { W, H, N } = sv, komp = C.komponenty(hra), zak = komp[hra.zakladna];
    const p = (t.g / N) | 0, k = komp[t.g];
    if (p === 0) { PR.zprava(hra, 'varovani', `${t.jmeno} uvízl na povrchu – je třeba prokopat cestu.`, t.g); return false; }
    const q = p - 1, z = q * N;
    const dist = new Int32Array(N).fill(-1), pred = new Int32Array(N).fill(-1);
    const dq = new Int32Array(2 * N + 2); let hl = N, ko = N;     // deque: 0-hrany dopředu, 1-hrany dozadu
    for (let l = 0; l < N; l++) if (komp[z + l] === zak) { dist[l] = 0; dq[ko++] = l; }
    if (ko === N) { PR.zprava(hra, 'varovani', `${t.jmeno} uvízl v ${p}. patře a o patro výš klan nemá kudy přijít.`, t.g); return false; }
    const hotovo = new Uint8Array(N);
    while (hl < ko) {
      const l = dq[hl++];
      if (hotovo[l]) continue;
      hotovo[l] = 1;
      const x = l % W, y = (l / W) | 0;
      for (let s = 0; s < 4; s++) {
        const X = x + C.SMERY[s][0], Y = y + C.SMERY[s][1];
        if (X < 1 || Y < 1 || X >= W - 1 || Y >= H - 1) continue;
        const m = Y * W + X, g = z + m;
        if (sv.teren[g] === M.PODLOZI) continue;
        let w;
        if (C.pruchozi(sv, g)) w = 0;
        else if (sv.teren[g] !== M.VOLNO) w = 1;
        else continue;                                 // voda, díra, strom…
        if (dist[m] < 0 || dist[l] + w < dist[m]) {
          dist[m] = dist[l] + w; pred[m] = l;
          if (w) dq[ko++] = m; else dq[--hl] = m;
        }
      }
    }
    // nejlepší pole pro schodiště: v oblasti uvízlého, nad ním co nejkratší chodba
    let nej = -1, nejD = Infinity;
    const zp = p * N;
    for (let l = 0; l < N; l++) {
      const g = zp + l;
      if (dist[l] < 0) continue;
      // dolní pole: v oblasti uvízlého, nebo skála hned vedle ní (vytesá se jako část schodiště)
      let navic = 0;
      if (komp[g] === k) { if (sv.obj[g] !== O.NIC) continue; }
      else if (PR.kopatelne(sv, g) && [1, -1, W, -W].some(d => komp[g + d] === k)) navic = 1;
      else continue;
      const u = z + l;
      if (sv.obj[u] !== O.NIC || sv.kap[u] || sv.teren[u] === M.PODLOZI) continue;
      if (dist[l] + navic < nejD) { nejD = dist[l] + navic; nej = l; }
    }
    if (nej < 0) { PR.zprava(hra, 'varovani', `${t.jmeno} uvízl a záchranné schodiště se nedá naplánovat.`, t.g); return false; }
    const horni = z + nej;
    PR.zrusOznaceni(hra, horni);
    hra.oznac[horni] = PR.OZN.SCHODY; hra.prio[horni] = 1; hra.zachrana[horni] = 1; PR.oznZmena(hra);
    PR.zmena(hra, horni);
    for (let l = pred[nej]; l >= 0 && dist[l] > 0; l = pred[l]) {
      const g = z + l;
      if (sv.teren[g] !== M.VOLNO) { hra.oznac[g] = PR.OZN.KOPAT; hra.prio[g] = 1; hra.zachrana[g] = 1; PR.oznZmena(hra); PR.zmena(hra, g); }
    }
    // kopat se bude i v neznámé skále: pole chodby se odhalí, ať je vidět, kudy vede
    hra.zmenaPraci++;
    PR.zprava(hra, 'info', `Záchrana: schodiště z ${p}. patra nahoru a chodba ke klanu (${nejD} polí skály).`, horni);
    return true;
  }

  // --- tah hry ----------------------------------------------------------------------
  function krok(hra) {
    hra.tik++;
    S.obdobi.tik(hra);
    S.udalosti.tik(hra);
    for (const t of hra.trpaslici.slice()) krokTrpaslika(hra, t);
    if (hra.tik % 50 === 0) hlidejUvizle(hra);
    if (hra.tik % 60 === 0) S.stavby.rust(hra);
    S.hrozby.tik(hra);
    S.pribeh.tik(hra);
    S.priroda.tik(hra);
    if (hra.tik % 100 === 0) hlidejNouzi(hra);
    if (hra.parezy.length && hra.tik % 60 === 0) {
      const sv = hra.sv;
      hra.parezy = hra.parezy.filter(pz => {
        if (hra.tik < pz.kdy) return true;
        if (S.obdobi.zima(hra)) { pz.kdy = hra.tik + 600; return true; }       // v zimě stromy nedorůstají
        if (sv.obj[pz.g] === O.PAREZ && !hra.trpaslici.some(t => t.g === pz.g)) {
          sv.obj[pz.g] = O.JEDLE; PR.zmenaTerenu(hra, pz.g);
          return false;
        }
        if (sv.obj[pz.g] !== O.PAREZ) return false;
        pz.kdy = hra.tik + 60;          // někdo stojí na pařezu – počká
        return true;
      });
    }
  }
  function cas(hra) {
    const den = Math.floor(hra.tik / TAHU_ZA_DEN), rok = Math.floor(den / DNU_V_ROCE) + 1, dvr = den % DNU_V_ROCE;
    return { den: dvr % 12 + 1, obdobi: OBDOBI[Math.floor(dvr / 12)], rok, cast: (hra.tik % TAHU_ZA_DEN) / TAHU_ZA_DEN };
  }
  // co trpaslík dělá (pro rozhraní)
  function popisCinnosti(hra, t) {
    if (t.mrtvy) return 'mrtev';
    const j = t.prace;
    const kde = j ? '' : '';
    if (t.spi) return j && j.lecit ? 'léčí se' : j && j.postel ? 'spí v posteli' : j && j.stan !== undefined ? 'spí pod stanem' : 'spí na zemi';
    if (t.lezi) return 'leží s horečkou';
    if (t.zuri > hra.tik) return 'zuří! (nepracuje)';
    if (t.cekej > 0) return 'slaví / má volno';
    if (j && j.osobni) return { lov: 'jde po nepříteli', cekat: 'čeká na strážce u Spáče', zazehnout: j.faze === 'k_veci' ? 'jde pro Klíč k Srdci' : j.faze === 'zazehni' ? 'zažíhá Výheň předků!' : 'nese Klíč do Srdce hory', cvicit: t.akce > 0 ? 'cvičí boj' : 'jde cvičit do zbrojnice', ukryt: 'utíká do úkrytu' }[j.osobni] || 'jde si pro výstroj';
    if (hra.poplach && !t.povoleno.hlidat && !j) return 'v úkrytu';
    if (j && j.potreba) return { jist: j.faze === 'ji' ? 'jí' : 'jde se najíst', pit: j.faze === 'pije' && (t.akce > 0) ? (j.voda ? 'pije vodu' : 'pije pivo') : 'jde se napít', spat: 'jde spát' }[j.potreba];
    if (!j) return t.uvizl ? 'uvízl, čeká na záchranu' : 'nemá co dělat';
    const jde = t.cesta.length > 0 || t.krokDoba > 0;
    const ST = S.stavby;
    const kam = t.cil && t.cil.typ === 'plan' ? (ST.planPodle(hra, t.cil.id) || {}).typ : t.cil && t.cil.typ === 'dilna' ? (ST.budovaPodle(hra, t.cil.id) || {}).typ : null;
    const vec = t.nese ? (PR.VECI[(PR.vecPodle(hra, t.nese) || {}).druh] || {}).nazev : '';
    const co = { kopat: 'tesat skálu', schody: 'tesat schodiště', dira: 'prorážet díru', otesat: 'otesávat', kacet: 'kácet',
                 donest: t.faze === 'odnest' ? `nést ${vec}${kam ? ' – ' + ST.STAVBY[kam].nazev : ''}` : 'pro materiál',
                 odnest: t.faze === 'odnest' ? `nést ${vec} do skladu` : 'uklízet',
                 stavet: 'stavět ' + (((ST.planPodle(hra, j.plan) || {}).typ && ST.STAVBY[ST.planPodle(hra, j.plan).typ].nazev) || ''),
                 zasit: 'sít', sklidit: 'sklízet', pumpovat: 'pumpovat vodu', cist: 'číst runovou desku', poklad: 'vynášet poklad předků',
                 vyrobit: 'pracovat – ' + (((ST.budovaPodle(hra, j.dilna) || {}).typ && ST.STAVBY[ST.budovaPodle(hra, j.dilna).typ].nazev) || 'dílna') }[j.druh] || j.druh;
    return (jde && t.faze !== 'odnest' ? 'jde ' : '') + co + kde;
  }

  S.hra = { TAHU_ZA_DEN, DNU_V_ROCE, PROFESE, zalozHru, novaHra, pridejTrpaslika, krok, spadni, umri, najdiPraci, pustPraci,
            hlidejUvizle, naplanujZachranu, cas, popisCinnosti, volnaMistaKolem, vychoziStupne, DOVEDNOSTI, fDov, zlepsi,
            faktorNastroje, nastavDilnu, hlidejNouzi, spratel, noveJmeno, nahodnaProfese, odejdi };
})(SIN);

if (typeof module !== 'undefined') module.exports = SIN;
