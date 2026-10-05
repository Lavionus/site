/* ============================================================
   Síně pod horou – potreby.js: jídlo, pití, spánek, zdraví a nálada.

   Hodnoty jsou převzaté ze Srdce hory (úbytky, prahy, nasycení,
   vzpomínky, návyk, rychlost práce podle nálady). Pohled shora mění
   jen místa: jí se u stolu v jídelně (vzpomínka podle kvality
   místnosti), spí se v posteli (podle kvality ložnice, hluk −2 a
   pomalejší spánek v otevřené místnosti nebo u dílny), zranění se
   léčí na ošetřovně (3× rychleji). Vlastní pokoj (uzavřená ložnice
   s jedinou postelí) +3 – přidělí se sám. Pije se pivo, jinak voda
   z potoka nebo jezera.
   Úloha potřeby je t.prace = { potreba: 'jist'|'pit'|'spat', faze, … }
   (bez rezervace v hra.rez; obsazenost postelí a židlí se zjišťuje
   z ostatních trpaslíků).
   Čistá logika bez DOM.
   ============================================================ */
var SIN = globalThis.SIN = globalThis.SIN || {};

(function (S) {
  'use strict';
  const SV = S.svet, { M, O, K } = SV, C = S.cesty, PR = S.prace;

  const UBYTEK = { jidlo: 0.0235, piti: 0.031, spanek: 0.057 };
  const ZDRAVI = { hlad: 0.04, zizen: 0.06, hojeni: 0.004, hojeniVeSpanku: 0.04 };
  const ZLOST = 13;
  const PRAH = { hlad: 30, zizen: 30, unava: 20, vyspany: 95, kriticky: 12, zraneny: 60, lecitHned: 35, vylecen: 95 };
  const ZAKLAD = 45, NEVRLY = 40, OSETROVNA = 3, ZIMA_HLAD = 1.2;
  const NASYCENI = { jidlo: 70, houby: 35, jecmen: 30, ryba: 40, pivo: 70, voda: 50 };
  const DNI_JIDLA = 5, DNI_PITI = 4, DNI_SPANKU = 3;
  const DOBA = { jist: 30, pit: 20, voda: 30, zvednout: 4 };
  const SPANEK = { postel: 0.5, zem: 0.3, hluk: 0.8 };
  const NAVYK = new Set(['jidlo', 'piti', 'spanek']), NAVYK_KROK = 0.08, NAVYK_MIN = 0.4;

  function vychozi(t) {
    t.jidlo = 100; t.piti = 100; t.spanek = 100; t.nalada = 60;
    t.vzpominky = []; t.zlost = 0; t.spi = false; t.navyk = {};
  }
  function vzpominka(hra, t, text, hodnota, dni, klic) {
    if (klic && hodnota > 0 && NAVYK.has(klic)) {
      const nv = t.navyk || (t.navyk = {}), z = nv[klic];
      if (z && z.text === text) z.n = Math.min(20, z.n + 1); else nv[klic] = { text, n: 0 };
      hodnota = Math.max(1, Math.round(hodnota * Math.max(NAVYK_MIN, 1 - NAVYK_KROK * nv[klic].n)));
    }
    if (klic) t.vzpominky = t.vzpominky.filter(v => v.klic !== klic || v.text === text);
    const v = t.vzpominky.find(v => v.text === text);
    const doTik = hra.tik + Math.round(dni * S.hra.TAHU_ZA_DEN);
    if (v) { v.do = doTik; v.h = hodnota; } else t.vzpominky.push(klic ? { text, h: hodnota, do: doTik, klic } : { text, h: hodnota, do: doTik });
  }

  // souhrnná vzpomínka (smutek za padlé, odchody): první `prvni`, každá další v době trvání `dalsi` až do `mez`
  function souhrnnaVzpominka(hra, t, klic, text, prvni, dalsi, mez, dni) {
    const doTik = hra.tik + Math.round(dni * S.hra.TAHU_ZA_DEN);
    const v = t.vzpominky.find(v => v.klic === klic && v.do > hra.tik);
    if (v) { v.n = (v.n || 1) + 1; v.h = Math.max(mez, v.h + dalsi); v.do = doTik; v.text = text(v.n); }
    else { t.vzpominky = t.vzpominky.filter(v => v.klic !== klic); t.vzpominky.push({ text: text(1), h: prvni, do: doTik, klic, n: 1 }); }
  }
  // venku v rokli (mrzne v zimě)
  const venku = (hra, g) => { const sv = hra.sv; return g < sv.N && sv.oblast[g] && sv.oblasti[sv.oblast[g]].typ === 'rokle'; };

  // --- prostředí: postele, vlastní pokoje (čistá funkce stavu, s mezipamětí podle verze) ---------
  function prostredi(hra) {
    const klic = hra.verzeTerenu + ':' + hra.zmenaPraci + ':' + hra.trpaslici.length;
    if (hra._prostredi && hra._prostredi.klic === klic) return hra._prostredi;
    const ST = S.stavby, MI = S.mistnosti, r = { klic, postele: 0, posteleLoznice: 0, posteleOsetrovna: 0, pokoje: new Map(), naPokoji: new Map() };
    const soukrome = [];
    for (const b of hra.budovy) {
      if (b.typ !== 'postel') continue;
      r.postele++;
      const z = ST.zonaNa(hra, b.g);
      if (z && z.typ === 'loznice') r.posteleLoznice++;
      if (z && z.typ === 'osetrovna') r.posteleOsetrovna++;
      const m = MI.mistnostNa(hra, b.g);
      if (z && z.typ === 'loznice' && m && m.uzavrena && m.dvere && postelivMistnosti(hra, m) === 1) soukrome.push(b);
    }
    // vlastní pokoje: postupně podle id trpaslíků (deterministicky)
    const trp = hra.trpaslici.slice().sort((a, b) => a.id - b.id);
    soukrome.sort((a, b) => a.id - b.id).forEach((b, k) => { if (trp[k]) { r.pokoje.set(trp[k].id, b.id); r.naPokoji.set(b.id, trp[k].id); } });
    hra._prostredi = r;
    return r;
  }
  function postelivMistnosti(hra, m) {
    let n = 0;
    const mm = S.mistnosti.mistnosti(hra);
    for (const b of hra.budovy) if (b.typ === 'postel' && mm.id[b.g] === m.id) n++;
    return n;
  }
  const rok = hra => Math.floor(hra.tik / (S.hra.TAHU_ZA_DEN * S.hra.DNU_V_ROCE)) + 1;
  function stavyProstredi(hra, t) {
    const r = [], pr = prostredi(hra), n = hra.trpaslici.length;
    if (pr.pokoje.has(t.id)) r.push(['má vlastní pokoj', 3]);
    else if (n && pr.posteleLoznice >= n) r.push(['každý má svou postel v ložnici', 2]);
    if (hra.odemceno && hra.odemceno.slava650) r.push(['patří k legendárnímu klanu', 4]);
    return r;
  }
  function rozpis(hra, t) {
    const r = [];
    for (const v of t.vzpominky) if (v.do > hra.tik) r.push([v.text, v.h]);
    for (const s of stavyProstredi(hra, t)) r.push(s);
    if (t.jidlo < 20) r.push(['má hlad', -15]);
    if (t.piti < 20) r.push(['má žízeň', -15]);
    if (t.spanek < 15) r.push(['je k smrti unavený', -10]);
    if (t.zdravi < 60) r.push(['bolí ho zranění', -10]);
    if (!t.spi && S.svetlo.svetloNa(hra, t.g) < 0.2) r.push(['pracuje ve tmě', -6]);
    if (!t.spi && S.obdobi && S.obdobi.zima(hra) && venku(hra, t.g)) r.push(['mrzne venku', -3]);
    return r;
  }
  const spocitejNaladu = (hra, t) => Math.max(0, Math.min(100, Math.round(ZAKLAD + rozpis(hra, t).reduce((s, [, h]) => s + h, 0))));
  const rychlost = t => (0.6 + 0.8 * (t.nalada === undefined ? 60 : t.nalada) / 100) * (t.nalada < NEVRLY ? 0.85 : 1);

  // jeden tah potřeb; vrací důvod smrti nebo null
  function tik(hra, t) {
    const spi = t.spi;
    const zima = S.obdobi && S.obdobi.zima(hra) ? ZIMA_HLAD : 1;
    t.jidlo = Math.max(0, t.jidlo - UBYTEK.jidlo * zima * (spi ? 0.5 : 1));
    t.piti = Math.max(0, t.piti - UBYTEK.piti * (spi ? 0.5 : 1));
    if (!spi) t.spanek = Math.max(0, t.spanek - UBYTEK.spanek);
    if (t.jidlo <= 0) t.zdravi -= ZDRAVI.hlad;
    if (t.piti <= 0) t.zdravi -= ZDRAVI.zizen;
    else if (t.jidlo > 30 && t.zdravi < 100) {
      const nemoc = spi && t.prace && t.prace.osetrovna ? OSETROVNA : 1;
      t.zdravi = Math.min(100, t.zdravi + (spi ? ZDRAVI.hojeniVeSpanku * nemoc : ZDRAVI.hojeni));
    }
    if (t.zdravi <= 0) return t.piti <= 0 ? 'žízní' : 'hlady';
    if ((hra.tik + t.id) % 30 === 0) {
      t.vzpominky = t.vzpominky.filter(v => v.do > hra.tik);
      t.nalada = spocitejNaladu(hra, t);
      t.zlost = t.nalada < 12 ? t.zlost + ZLOST : Math.max(0, t.zlost - ZLOST);
    }
    return null;
  }
  const hlad = t => t.jidlo < PRAH.hlad, zizen = t => t.piti < PRAH.zizen, unava = t => t.spanek < PRAH.unava;
  const zraneny = t => t.zdravi < PRAH.zraneny;
  const kriticke = t => t.jidlo < PRAH.kriticky || t.piti < PRAH.kriticky || t.spanek < 5;
  function maKdeLecit(hra, t) { const pr = prostredi(hra); return pr.posteleOsetrovna > 0 || (t.zdravi < PRAH.lecitHned && pr.postele > 0); }
  const muzeLecit = (hra, t) => zraneny(t) && !hlad(t) && !zizen(t) && maKdeLecit(hra, t);
  const potrebuje = (hra, t) => hlad(t) || zizen(t) || unava(t) || muzeLecit(hra, t);

  // --- místa ------------------------------------------------------------------------
  const jeVoda = (sv, g) => sv.kap[g] && sv.kapTyp[g] === K.VODA && sv.zn[g];
  // u studny (pole vedle studny, která má vodu): čistá voda
  function uStudny(hra, g) {
    const sv = hra.sv, l = g % sv.N, x = l % sv.W, y = (l / sv.W) | 0;
    for (const [dx, dy] of C.SMERY) {
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= sv.W || Y >= sv.H) continue;
      const b = S.stavby.budovaNa(hra, g + dy * sv.W + dx);
      if (b && b.typ === 'studna' && S.priroda.studnaMa(hra, b)) return true;
    }
    return false;
  }
  function uVody(sv, g) {
    if (!C.pruchozi(sv, g)) return false;
    if (jeVoda(sv, g)) return true;               // mělká voda pod nohama (potok)
    const { W, H, N } = sv, l = g % N, x = l % W, y = (l / W) | 0;
    for (const [dx, dy] of C.SMERY) {
      const X = x + dx, Y = y + dy;
      if (X >= 0 && Y >= 0 && X < W && Y < H && jeVoda(sv, g + dy * W + dx)) return true;
    }
    return false;
  }
  // místo u stolu v jídelně: židle / lavice, nebo průchozí pole vedle stolu
  function uStolu(hra, g) {
    const ST = S.stavby, sv = hra.sv, z = ST.zonaNa(hra, g);
    if (!z || z.typ !== 'jidelna' || !C.pruchozi(sv, g)) return false;
    const b = ST.budovaNa(hra, g);
    if (b && (b.typ === 'zidle' || b.typ === 'lavice')) return true;
    const { W, H, N } = sv, l = g % N, x = l % W, y = (l / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const s = ST.budovaNa(hra, g + dy * W + dx);
      if (s && s.typ === 'stul') return true;
    }
    return false;
  }
  const obsazeno = (hra, t, klic, hodnota) => hra.trpaslici.some(u => u !== t && u.prace && u.prace[klic] === hodnota);

  // hodnota jídla u stolu a spánku podle kvality místnosti
  function hodnotaJidelny(hra, g) {
    const ST = S.stavby, z = ST.zonaNa(hra, g);
    const k = S.mistnosti.kvalita(hra, S.mistnosti.mistnostNa(hra, g), 'jidelna');
    const h = 3 + Math.round(k.hodnota / 2);
    void z;
    return [h >= 9 ? 'hodoval v nádherné síni' : h >= 6 ? 'jedl v pěkné jídelně' : 'jedl u stolu v jídelně', h];
  }
  function hodnotaLoznice(hra, b) {
    const ST = S.stavby, z = ST.zonaNa(hra, b.g);
    if (!z || z.typ !== 'loznice') return ['vyspal se v posteli', 3];
    const k = S.mistnosti.kvalita(hra, S.mistnosti.mistnostNa(hra, b.g), 'loznice');
    const h = 4 + Math.round(k.hodnota / 3);
    return [h >= 8 ? 'vyspal se v nádherné ložnici' : h >= 6 ? 'vyspal se v pěkné ložnici' : 'vyspal se v ložnici', h];
  }
  // hluk: spánek v neuzavřené místnosti, nebo do 3 polí od dílny
  function hlucno(hra, b) {
    const m = S.mistnosti.mistnostNa(hra, b.g);
    if (!m || !m.uzavrena || !m.dvere) return true;
    const sv = hra.sv, l = b.g % sv.N, x = l % sv.W, y = (l / sv.W) | 0, p = (b.g / sv.N) | 0;
    for (const d of hra.budovy) {
      if (!S.stavby.STAVBY[d.typ].dilna || ((d.g / sv.N) | 0) !== p) continue;
      const ld = d.g % sv.N;
      if (Math.abs(ld % sv.W - x) <= 3 && Math.abs(((ld / sv.W) | 0) - y) <= 3 && S.mistnosti.mistnostNa(hra, d.g) === m) return true;
    }
    return false;
  }

  // --- najdi úlohu potřeby: { prace, cesta } nebo null --------------------------------------
  function najdi(hra, t) {
    const sv = hra.sv, ST = S.stavby;
    const poradi = [[t.piti, 'pit', zizen(t)], [t.jidlo, 'jist', hlad(t)], [t.spanek, 'spat', unava(t)], [t.zdravi - 25, 'lecit', muzeLecit(hra, t)]]
      .filter(p => p[2]).sort((a, b) => a[0] - b[0]);
    const vybrane = new Set(hra.trpaslici.filter(u => u !== t && u.prace && u.prace.vec).map(u => u.prace.vec));
    for (const [, co] of poradi) {
      let res = null, prace = null;
      if (co === 'jist') {
        const druhy = t.jidlo < 15 ? ['jidlo', 'ryba', 'houby', 'jecmen'] : ['jidlo'];
        const naPoli = new Map();
        for (const v of hra.veci) if (v.g >= 0 && druhy.includes(v.druh) && !vybrane.has(v.id)) { const a = naPoli.get(v.g); if (a) a.push(v); else naPoli.set(v.g, [v]); }
        if (naPoli.size) res = C.hledej(hra, [t.g], g => naPoli.has(g), 6000);
        if (res) { const v = naPoli.get(res.cil).sort((a, b) => druhy.indexOf(a.druh) - druhy.indexOf(b.druh))[0]; prace = { potreba: 'jist', faze: 'k_veci', vec: v.id }; }
      } else if (co === 'pit') {
        const naPoli = new Map();
        for (const v of hra.veci) if (v.g >= 0 && v.druh === 'pivo' && !vybrane.has(v.id)) naPoli.set(v.g, v);
        res = naPoli.size ? C.hledej(hra, [t.g], g => naPoli.has(g), 6000) : null;
        // pivo, je-li blíž než dvojnásobek cesty k vodě; jinak voda
        // studna (čistá voda) má přednost, není-li o moc dál než jiná voda
        const studna = hra.budovy.some(b => b.typ === 'studna') ? C.hledej(hra, [t.g], g => C.pruchozi(sv, g) && uStudny(hra, g), 6000) : null;
        let voda = C.hledej(hra, [t.g], g => uVody(sv, g), 6000);
        if (studna && (!voda || studna.cena <= voda.cena + 80)) voda = studna;
        if (res && (!voda || res.cena <= voda.cena * 2 + 40)) prace = { potreba: 'pit', faze: 'k_veci', vec: naPoli.get(res.cil).id };
        else if (voda) { res = voda; prace = { potreba: 'pit', faze: 'pije', voda: true }; }
      } else {
        const lecit = co === 'lecit', pr = prostredi(hra), moje = pr.pokoje.get(t.id);
        const volna = b => b.typ === 'postel' && !obsazeno(hra, t, 'postel', b.id) && (!pr.naPokoji.has(b.id) || pr.naPokoji.get(b.id) === t.id);
        const naOsetrovne = b => { const z = ST.zonaNa(hra, b.g); return !!z && z.typ === 'osetrovna'; };
        let kandidati = hra.budovy.filter(b => volna(b) && (lecit ? naOsetrovne(b) || t.zdravi < PRAH.lecitHned : !naOsetrovne(b)));
        if (!lecit && moje && kandidati.some(b => b.id === moje)) kandidati = kandidati.filter(b => b.id === moje);
        if (!lecit && !kandidati.length && pr.posteleOsetrovna) kandidati = hra.budovy.filter(b => volna(b));
        const naPoli = new Map();
        for (const b of kandidati) for (const g of b.bunky) if (C.pruchozi(sv, g)) naPoli.set(g, b);
        if (naPoli.size) res = C.hledej(hra, [t.g], g => naPoli.has(g), 8000);
        if (res) { const b = naPoli.get(res.cil); prace = { potreba: 'spat', faze: 'k_cili', postel: b.id, osetrovna: naOsetrovne(b), lecit }; }
        else if (!lecit) {
          // bez postele: pod stanem na tábořišti, je-li kde; jinak na zemi
          const zabrane = new Set(hra.trpaslici.filter(u => u !== t && u.prace && u.prace.stan !== undefined).map(u => u.prace.stan));
          const tab = new Set(); for (const z of hra.zony) if (z.typ === 'taboriste') tab.add(z.id);
          const r2 = tab.size ? C.hledej(hra, [t.g], g => tab.has(hra.zona[g]) && !zabrane.has(g), 8000) : null;
          if (r2) { res = r2; prace = { potreba: 'spat', faze: 'k_cili', postel: 0, stan: r2.cil }; }
          else { res = { cesta: [], cil: t.g }; prace = { potreba: 'spat', faze: 'k_cili', postel: 0 }; }
        }
      }
      if (prace) return { prace: Object.assign(prace, { klic: 'potreba' }), cesta: res.cesta };
    }
    return null;
  }

  // příchod na místo úlohy: vrací dobu akce (0 = hned znovu krokovat), nebo -1 = úloha selhala
  function prisel(hra, t) {
    const p = t.prace, sv = hra.sv;
    if (p.potreba === 'jist') {
      if (p.faze === 'k_veci') {
        const v = PR.vecPodle(hra, p.vec);
        if (!v || v.g !== t.g) return -1;
        v.g = -1; t.nese = v.id; hra.zmenaPraci++;
        // stůl v jídelně do rozumné vzdálenosti
        const zabrane = new Set(hra.trpaslici.filter(u => u !== t && u.prace && u.prace.misto !== undefined).map(u => u.prace.misto));
        const res = C.hledej(hra, [t.g], g => !zabrane.has(g) && uStolu(hra, g), 400);
        if (res) { p.faze = 'ke_stolu'; p.misto = res.cil; t.cesta = res.cesta; return 0; }
        p.faze = 'ji'; return DOBA.jist;
      }
      if (p.faze === 'ke_stolu') { p.faze = 'ji'; return DOBA.jist; }
      return -1;
    }
    if (p.potreba === 'pit') {
      if (p.voda) { if (!uVody(sv, t.g) && !uStudny(hra, t.g)) return -1; p.studna = uStudny(hra, t.g); p.faze = 'pije'; return DOBA.voda; }
      const v = PR.vecPodle(hra, p.vec);
      if (!v || v.g !== t.g) return -1;
      v.g = -1; t.nese = v.id; hra.zmenaPraci++;
      p.faze = 'pije'; return DOBA.pit;
    }
    if (p.potreba === 'spat') {
      if (p.postel) {
        const b = S.stavby.budovaPodle(hra, p.postel);
        if (!b || !b.bunky.includes(t.g)) return -1;
      }
      t.spi = true; p.faze = 'spi';
      return 1;
    }
    return -1;
  }
  // konec akce (najedl se, napil se); spánek běží po tazích v spanekTik
  function hotovo(hra, t) {
    const p = t.prace;
    if (p.potreba === 'jist') {
      const v = PR.vecPodle(hra, t.nese);
      if (v) {
        t.jidlo = Math.min(100, t.jidlo + (NASYCENI[v.druh] || 40));
        if (v.druh !== 'jidlo') vzpominka(hra, t, 'jedl syrové ' + (v.druh === 'houby' ? 'houby' : v.druh === 'ryba' ? 'ryby' : 'zrní'), -5, DNI_JIDLA, 'jidlo');
        else if (p.misto !== undefined && p.misto === t.g) { const [txt, h] = hodnotaJidelny(hra, t.g); vzpominka(hra, t, txt, h, DNI_JIDLA, 'jidlo'); }
        else vzpominka(hra, t, 'jedl na zemi', -3, DNI_JIDLA, 'jidlo');
        spotrebuj(hra, v); t.nese = 0;
      }
    } else if (p.potreba === 'pit') {
      if (p.voda && p.studna) { t.piti = Math.min(100, t.piti + NASYCENI.voda); vzpominka(hra, t, 'napil se čisté vody ze studny', -2, DNI_PITI, 'piti'); }
      else if (p.voda && S.obdobi.zima(hra) && t.g < hra.sv.N) { t.piti = Math.min(100, t.piti + NASYCENI.voda); vzpominka(hra, t, 'prosekal led a pil ledovou vodu', -9, DNI_PITI, 'piti'); }
      else if (p.voda) { t.piti = Math.min(100, t.piti + NASYCENI.voda); vzpominka(hra, t, 'pil jen vodu – žádné pivo!', -6, DNI_PITI, 'piti'); }
      else {
        const v = PR.vecPodle(hra, t.nese);
        if (v) { t.piti = Math.min(100, t.piti + NASYCENI.pivo); vzpominka(hra, t, 'dal si dobré pivo', 3, DNI_PITI, 'piti'); spotrebuj(hra, v); t.nese = 0; }
      }
    }
  }
  function spotrebuj(hra, v) { PR.odeberVec(hra, v); hra.spotrebovano++; }

  // jeden tah spánku; vrací true, když se probudil
  function spanekTik(hra, t) {
    const p = t.prace, b = p.postel ? S.stavby.budovaPodle(hra, p.postel) : null;
    if (p.postel && !b) { vzbud(hra, t); return true; }
    const hluk = b && p.hluk === undefined ? (p.hluk = hlucno(hra, b)) : p.hluk;
    t.spanek = Math.min(100, t.spanek + (b ? SPANEK.postel : SPANEK.zem) * (hluk ? SPANEK.hluk : 1));
    const vyspany = t.spanek >= PRAH.vyspany && (!p.lecit || t.zdravi >= PRAH.vylecen);
    if (vyspany || t.jidlo < PRAH.kriticky || t.piti < PRAH.kriticky) {
      if (vyspany) {
        if (!b && p.stan !== undefined) vzpominka(hra, t, 'spal pod stanem na tábořišti', -2, DNI_SPANKU, 'spanek');
        else if (!b) vzpominka(hra, t, 'spal na tvrdé zemi', -6, DNI_SPANKU, 'spanek');
        else {
          const [txt, h] = hodnotaLoznice(hra, b); vzpominka(hra, t, txt, h, DNI_SPANKU, 'spanek');
          if (hluk) vzpominka(hra, t, 'rušili ho při spánku', -2, DNI_SPANKU, 'hluk');
          if (p.osetrovna && t.zdravi >= PRAH.vylecen) vzpominka(hra, t, 'zhojili ho na ošetřovně', 3, 2);
        }
      }
      vzbud(hra, t);
      return true;
    }
    return false;
  }
  function vzbud(hra, t) { t.spi = false; t.prace = null; t.faze = ''; t.akce = 0; t.cesta = []; }

  S.potreby = { uStudny, souhrnnaVzpominka, venku, UBYTEK, PRAH, NASYCENI, ZAKLAD, NEVRLY, OSETROVNA, DOBA, vychozi, vzpominka, prostredi, stavyProstredi, rozpis,
                spocitejNaladu, rychlost, tik, hlad, zizen, unava, zraneny, kriticke, potrebuje, muzeLecit, uVody, uStolu,
                hodnotaJidelny, hodnotaLoznice, hlucno, najdi, prisel, hotovo, spanekTik, vzbud, rok };
})(SIN);

if (typeof module !== 'undefined') module.exports = SIN;
