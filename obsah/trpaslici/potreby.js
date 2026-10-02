/* ============================================================
   Srdce hory – potreby.js: jídlo, pití, spánek a nálada.

   Každý trpaslík má jidlo, piti, spanek (100 = syt/odpočatý, 0 = na
   dně) a náladu 0..100. Nálada = 45 + vzpomínky (jedl u stolu, spal
   na zemi, pil jen vodu…) + trvalé stavy (hlad, tma, bolest, ale i
   vlastní postel a otesané síně). Nálada zrychluje nebo zpomaluje
   práci (pod 30 je trpaslík nevrlý a pracuje ještě pomaleji); dlouho
   zlá nálada vede k záchvatu. Zraněný jde ležet na ošetřovnu.
   Úplný hlad nebo žízeň ubírá zdraví – trpaslík může zemřít.
   Čistá logika bez DOM.
   ============================================================ */
var TRP = globalThis.TRP = globalThis.TRP || {};

(function (T) {
  'use strict';
  const { W, H, M } = T.hora;
  const C = T.cesty, S = T.stavby;
  const N = W * H;

  // úbytek za tah (den = 600 tahů); potřeby běží každý tah – dřív jen ve ~44 % tahů (ne uprostřed kroku),
  // proto přepočteno tak, aby účinná spotřeba zůstala stejná (bot 4 hry × 40 dní: ~0,17 jídla, ~0,22 piva
  // na trpaslíka za den, spánek ~13 % času)
  const UBYTEK = { jidlo: 0.0235, piti: 0.031, spanek: 0.057 };
  const ZDRAVI = { hlad: 0.04, zizen: 0.06, hojeni: 0.004, hojeniVeSpanku: 0.04 };   // za tah
  const ZLOST = 13;                               // přírůstek/úbytek zlosti při přepočtu nálady (jednou za 30 tahů)
  const PRAH = { hlad: 30, zizen: 30, unava: 20, vyspany: 95, kriticky: 12, zraneny: 60, lecitHned: 35, vylecen: 95 };
  const ZAKLAD = 45, NEVRLY = 30;                 // základ nálady; pod NEVRLY pracuje ještě pomaleji
  const ZIMA_HLAD = 1.2;                          // v zimě se jí víc (zima z hory)
  const OSETROVNA = 3;                            // hojení v posteli na ošetřovně (× hojení ve spánku)
  const NASYCENI = { jidlo: 70, houby: 35, jecmen: 30, pivo: 70, voda: 50 };

  function vychozi(t) {
    t.jidlo = 100; t.piti = 100; t.spanek = 100; t.nalada = 60;
    t.vzpominky = []; t.zlost = 0; t.zuri = 0; t.hledejPotrebu = 0;
  }
  // klic: vzpomínka, která nahradí předchozí se stejným klíčem (jídlo, pití, spánek – vždy jen ta poslední)
  function vzpominka(hra, t, text, hodnota, dni, klic) {
    if (klic) t.vzpominky = t.vzpominky.filter(v => v.klic !== klic || v.text === text);
    const v = t.vzpominky.find(v => v.text === text);
    const doTik = hra.tik + Math.round(dni * T.hra.TAHU_ZA_DEN);
    if (v) { v.do = doTik; v.h = hodnota; } else t.vzpominky.push(klic ? { text, h: hodnota, do: doTik, klic } : { text, h: hodnota, do: doTik });
  }
  // souhrnná vzpomínka (smutek za padlé, odchody): první událost `prvni`, každá další v době trvání přidá `dalsi`
  // až do `mez`; trvání se obnoví. text(n) = popis pro n událostí.
  function souhrnnaVzpominka(hra, t, klic, text, prvni, dalsi, mez, dni) {
    const doTik = hra.tik + Math.round(dni * T.hra.TAHU_ZA_DEN);
    const v = t.vzpominky.find(v => v.klic === klic && v.do > hra.tik);
    if (v) { v.n = (v.n || 1) + 1; v.h = Math.max(mez, v.h + dalsi); v.do = doTik; v.text = text(v.n); }
    else { t.vzpominky = t.vzpominky.filter(v => v.klic !== klic); t.vzpominky.push({ text: text(1), h: prvni, do: doTik, klic, n: 1 }); }
  }

  // Prostředí klanu: postele v ložnicích a na ošetřovně, otesané stěny obytných místností. Počítá se v pevném
  // rozvrhu (nová hra, pak hra.krok každých 60 tahů – obnovProstredi) a ukládá se (hra.prostrediStav), takže
  // nezáleží na tom, kdo a kdy se ptá (UI, načtená hra) – simulace zůstane deterministická
  function prostredi(hra) {
    return hra.prostrediStav || obnovProstredi(hra);
  }
  function obnovProstredi(hra) {
    const r = { tik: hra.tik, posteleLoznice: 0, posteleOsetrovna: 0, postele: 0, obytnych: 0, otesanych: 0 };
    const typy = {}; for (const z of hra.zony) typy[z.id] = z.typ;
    for (let i = 0; i < N; i++) {
      const typ = hra.zona[i] ? typy[hra.zona[i]] : null, postel = hra.stavba[i] === S.K.POSTEL;
      if (postel) r.postele++;
      if (typ === 'loznice' || typ === 'jidelna') { r.obytnych++; if (S.OTESANE_POZADI.includes(hra.hora.pozadi[i])) r.otesanych++; }
      if (postel && typ === 'loznice') r.posteleLoznice++;
      if (postel && typ === 'osetrovna') r.posteleOsetrovna++;
    }
    r.podilOtesano = r.obytnych ? r.otesanych / r.obytnych : 0;
    hra.prostrediStav = r;
    return r;
  }
  // trvalé dobré stavy z prostředí: [text, hodnota]
  function stavyProstredi(hra, t) {
    const r = [], pr = prostredi(hra), n = hra.trpaslici.length;
    if (n && pr.posteleLoznice >= n) r.push(['každý má svou postel v ložnici', 3]);
    if (pr.obytnych >= 6 && pr.podilOtesano >= 0.6) r.push(['bydlí v otesaných kamenných síních', pr.podilOtesano >= 0.95 ? 5 : 3]);
    return r;
  }

  // rozpis nálady: [text, hodnota]
  function rozpis(hra, t) {
    const r = [];
    for (const v of t.vzpominky) if (v.do > hra.tik) r.push([v.text, v.h]);
    for (const s of stavyProstredi(hra, t)) r.push(s);
    if (t.jidlo < 20) r.push(['má hlad', -15]);
    if (t.piti < 20) r.push(['má žízeň', -15]);
    if (t.spanek < 15) r.push(['je k smrti unavený', -10]);
    if (t.zdravi < 60) r.push(['bolí ho zranění', -10]);
    if (t.stav !== 'spi' && T.svetlo.svetloNa(hra, t.i) < 0.2) r.push(['pracuje ve tmě', -6]);
    if (t.stav !== 'spi' && T.obdobi && T.obdobi.zima(hra) && hra.hora.pozadi[t.i] === M.VZDUCH) r.push(['mrzne venku', -3]);
    return r;
  }
  function spocitejNaladu(hra, t) {
    return Math.max(0, Math.min(100, Math.round(ZAKLAD + rozpis(hra, t).reduce((s, [, h]) => s + h, 0))));
  }
  // rychlost práce podle nálady: 0,6× (zoufalý) až 1,4× (nadšený); nevrlý (pod 30) navíc o 15 % pomaleji
  const nevrly = t => t.nalada < NEVRLY;
  const rychlost = t => (0.6 + 0.8 * t.nalada / 100) * (t.nalada < NEVRLY ? 0.85 : 1);

  // jeden tah potřeb; vrací důvod smrti nebo null
  function tik(hra, t) {
    const spi = t.stav === 'spi';
    const zima = T.obdobi && T.obdobi.zima(hra) ? ZIMA_HLAD : 1;
    t.jidlo = Math.max(0, t.jidlo - UBYTEK.jidlo * zima * (spi ? 0.5 : 1));
    t.piti = Math.max(0, t.piti - UBYTEK.piti * (spi ? 0.5 : 1));
    if (!spi) t.spanek = Math.max(0, t.spanek - UBYTEK.spanek);
    if (t.jidlo <= 0) t.zdravi -= ZDRAVI.hlad;
    if (t.piti <= 0) t.zdravi -= ZDRAVI.zizen;
    else if (t.jidlo > 30 && t.zdravi < 100) t.zdravi = Math.min(100, t.zdravi + (spi ? ZDRAVI.hojeniVeSpanku * (t.prace && t.prace.osetrovna ? OSETROVNA : 1) : ZDRAVI.hojeni));
    if (t.zdravi <= 0) return t.piti <= 0 ? 'žízní' : 'hlady';
    if ((hra.tik + t.id) % 30 === 0) {
      t.vzpominky = t.vzpominky.filter(v => v.do > hra.tik);
      t.nalada = spocitejNaladu(hra, t);
      t.zlost = t.nalada < 12 ? t.zlost + ZLOST : Math.max(0, t.zlost - ZLOST);
    }
    return null;
  }
  const hlad = t => t.jidlo < PRAH.hlad, zizen = t => t.piti < PRAH.zizen;
  const unava = (hra, t) => t.spanek < PRAH.unava;          // spí se podle potřeby, ne podle denní doby
  function kriticke(hra, t) {
    return t.jidlo < PRAH.kriticky || t.piti < PRAH.kriticky || t.spanek < 5;
  }
  // zraněný (zdraví pod 60) se jde léčit na ošetřovnu; těžce zraněný (pod 35) i do obyčejné postele
  const zraneny = t => t.zdravi < PRAH.zraneny;
  function potrebuje(hra, t) { return hlad(t) || zizen(t) || unava(hra, t) || zraneny(t); }
  // je kde se léčit? (postel na ošetřovně, těžce zraněnému stačí jakákoli)
  function maKdeLecit(hra, t) { const pr = prostredi(hra); return pr.posteleOsetrovna > 0 || (t.zdravi < PRAH.lecitHned && pr.postele > 0); }
  // léčení nikdy nepředběhne hlad a žízeň pod prahem: nejdřív se najíst a napít, pak lehnout (léčení hlad/žízeň stejně ukončí)
  function muzeLecit(hra, t) { return zraneny(t) && !hlad(t) && !zizen(t) && maKdeLecit(hra, t); }

  // najde práci pro potřebu (nejnaléhavější první); vrací { hodnota, cesta, i } nebo null
  function najdi(hra, t) {
    const volna = T.prace.volneVeci(hra), volnaVec = T.prace.volnaVec;
    // zranění se řadí podle zdraví (35 ≈ jako hlad 35) – ale jen když trpaslík nemá hlad ani žízeň (muzeLecit)
    const poradi = [[t.piti, 'pit', zizen(t)], [t.jidlo, 'jist', hlad(t)], [t.spanek, 'spat', unava(hra, t)], [t.zdravi - 25, 'lecit', muzeLecit(hra, t)]]
      .filter(p => p[2]).sort((a, b) => a[0] - b[0]);
    for (const [, co] of poradi) {
      let r = null;
      if (co === 'jist') {
        const druhy = t.jidlo < 15 ? ['jidlo', 'houby', 'jecmen'] : ['jidlo'];
        r = C.hledej(hra, t.i, i => {
          const v = (volna.get(i) || []).find(v => druhy.includes(v.druh) && volnaVec(hra, v, i));
          return v ? { typ: 'jist', vec: v.id, pos: i, faze: 'k_veci' } : 0;
        });
      } else if (co === 'pit') {
        // pivo nebo studna – co je blíž; jinak jakákoli voda
        r = C.hledej(hra, t.i, i => {
          const v = (volna.get(i) || []).find(v => v.druh === 'pivo' && volnaVec(hra, v, i));
          if (v) return { typ: 'pit', vec: v.id, pos: i, faze: 'k_veci' };
          return uStudny(hra, i) ? { typ: 'pit', voda: true, studna: true, pos: i, faze: 'pije' } : 0;
        }) || C.hledej(hra, t.i, i => uVody(hra, i) ? { typ: 'pit', voda: true, pos: i, faze: 'pije' } : 0);
      } else if (co === 'lecit') {
        const obsazene = new Set(hra.trpaslici.filter(u => u !== t && u.prace && u.prace.postel >= 0).map(u => u.prace.postel));
        const naOsetrovne = i => { const z = S.zonaNa(hra, i); return !!z && z.typ === 'osetrovna'; };
        r = C.hledej(hra, t.i, i => hra.stavba[i] === S.K.POSTEL && !obsazene.has(i) && naOsetrovne(i) ? { typ: 'spat', postel: i, pos: i, faze: 'k_cili', lecit: true, osetrovna: true } : 0);
        if (!r && t.zdravi < PRAH.lecitHned) r = C.hledej(hra, t.i, i => hra.stavba[i] === S.K.POSTEL && !obsazene.has(i) ? { typ: 'spat', postel: i, pos: i, faze: 'k_cili', lecit: true } : 0);
      } else {
        const obsazene = new Set(hra.trpaslici.filter(u => u !== t && u.prace && u.prace.postel >= 0).map(u => u.prace.postel));
        // postele na ošetřovně jsou pro zraněné (zdravý v nich spí, jen když jiná postel není)
        const naOsetrovne = i => { const z = hra.zona[i] && S.zonaNa(hra, i); return !!z && z.typ === 'osetrovna'; };
        r = C.hledej(hra, t.i, i => hra.stavba[i] === S.K.POSTEL && !obsazene.has(i) && !naOsetrovne(i) ? { typ: 'spat', postel: i, pos: i, faze: 'k_cili' } : 0);
        if (!r && prostredi(hra).posteleOsetrovna) r = C.hledej(hra, t.i, i => hra.stavba[i] === S.K.POSTEL && !obsazene.has(i) ? { typ: 'spat', postel: i, pos: i, faze: 'k_cili', osetrovna: naOsetrovne(i) } : 0);
        if (!r) r = { i: t.i, hodnota: { typ: 'spat', postel: -1, pos: t.i, faze: 'k_cili' }, cesta: [] };
      }
      if (r) return r;
    }
    return null;
  }
  // u studny: stojí vedle pole studny (čistá voda, nezamrzá)
  function uStudny(hra, i) {
    if (!C.stojne(hra, i)) return false;
    const x = i % W;
    for (const j of [i + W, i - 1, i + 1, i + W - 1, i + W + 1]) {
      if (j < 0 || j >= N || Math.abs(j % W - x) > 1) continue;
      if (hra.hora.teren[j] === M.VODA && hra.stavba[j] === S.K.STUDNA) return true;
    }
    return false;
  }
  function uVody(hra, i) {
    if (!C.stojne(hra, i)) return false;
    const x = i % W;
    for (const j of [i + W, i - 1, i + 1, i + W - 1, i + W + 1]) {
      if (j < 0 || j >= N || Math.abs(j % W - x) > 1) continue;
      if (hra.hora.teren[j] === M.VODA) return true;
    }
    return false;
  }
  // voda pod širým nebem (potok) v zimě zamrzne – dá se prosekat, ale pije se hůř; podzemní jezero ne
  function jeVenku(hra, j) { return j >= W && hra.hora.pozadi[j - W] === M.VZDUCH; }
  // místo u stolu v jídelně (židle, nebo pole vedle stolu)
  function uStolu(hra, i) {
    const z = S.zonaNa(hra, i);
    if (!z || z.typ !== 'jidelna' || !C.stojne(hra, i)) return false;
    return hra.stavba[i] === S.K.ZIDLE || hra.stavba[i - 1] === S.K.STUL || hra.stavba[i + 1] === S.K.STUL;
  }

  function ledova(hra, i) {
    if (!(T.obdobi && T.obdobi.zima(hra))) return false;
    const x = i % W;
    for (const j of [i + W, i - 1, i + 1, i + W - 1, i + W + 1]) {
      if (j < 0 || j >= N || Math.abs(j % W - x) > 1) continue;
      if (hra.hora.teren[j] === M.VODA && (!jeVenku(hra, j) || hra.stavba[j] === S.K.STUDNA)) return false;     // vedle je i nezamrzlá voda (podzemní nebo studna)
    }
    return true;
  }
  T.potreby = { ledova, UBYTEK, PRAH, NASYCENI, ZAKLAD, NEVRLY, ZIMA_HLAD, OSETROVNA, nevrly, zraneny, maKdeLecit, muzeLecit, hlad, zizen, prostredi, obnovProstredi, stavyProstredi, vychozi, vzpominka, souhrnnaVzpominka, rozpis, spocitejNaladu, rychlost, tik, potrebuje, kriticke,
                najdi, uVody, uStudny, uStolu };
})(TRP);

if (typeof module !== 'undefined') module.exports = TRP;
