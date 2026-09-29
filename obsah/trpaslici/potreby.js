/* ============================================================
   Srdce hory – potreby.js: jídlo, pití, spánek a nálada.

   Každý trpaslík má jidlo, piti, spanek (100 = syt/odpočatý, 0 = na
   dně) a náladu 0..100. Nálada = 55 + vzpomínky (jedl u stolu, spal
   na zemi, pil jen vodu…) + trvalé stavy (hlad, tma, bolest). Nálada
   zrychluje nebo zpomaluje práci; dlouho zlá nálada vede k záchvatu.
   Úplný hlad nebo žízeň ubírá zdraví – trpaslík může zemřít.
   Čistá logika bez DOM.
   ============================================================ */
var TRP = globalThis.TRP = globalThis.TRP || {};

(function (T) {
  'use strict';
  const { W, H, M } = T.hora;
  const C = T.cesty, S = T.stavby;
  const N = W * H;

  // úbytek za tah (den = 600 tahů)
  const UBYTEK = { jidlo: 0.08, piti: 0.1, spanek: 0.2 };
  const PRAH = { hlad: 30, zizen: 30, unava: 20, unavaVNoci: 65, kriticky: 12 };
  const NASYCENI = { jidlo: 70, houby: 35, jecmen: 30, pivo: 70, voda: 50 };

  function vychozi(t) {
    t.jidlo = 100; t.piti = 100; t.spanek = 100; t.nalada = 60;
    t.vzpominky = []; t.zlost = 0; t.zuri = 0; t.hledejPotrebu = 0;
  }
  function vzpominka(hra, t, text, hodnota, dni) {
    const v = t.vzpominky.find(v => v.text === text);
    const doTik = hra.tik + Math.round(dni * T.hra.TAHU_ZA_DEN);
    if (v) { v.do = doTik; v.h = hodnota; } else t.vzpominky.push({ text, h: hodnota, do: doTik });
  }
  const noc = hra => { const h = T.hra.hodina(hra); return h >= 22 || h < 6; };

  // rozpis nálady: [text, hodnota]
  function rozpis(hra, t) {
    const r = [];
    for (const v of t.vzpominky) if (v.do > hra.tik) r.push([v.text, v.h]);
    if (t.jidlo < 20) r.push(['má hlad', -15]);
    if (t.piti < 20) r.push(['má žízeň', -15]);
    if (t.spanek < 15) r.push(['je k smrti unavený', -10]);
    if (t.zdravi < 60) r.push(['bolí ho zranění', -10]);
    if (t.stav !== 'spi' && T.svetlo.svetloNa(hra, t.i) < 0.2) r.push(['pracuje ve tmě', -6]);
    if (t.stav !== 'spi' && T.obdobi && T.obdobi.zima(hra) && hra.hora.pozadi[t.i] === M.VZDUCH) r.push(['mrzne venku', -3]);
    return r;
  }
  function spocitejNaladu(hra, t) {
    return Math.max(0, Math.min(100, Math.round(55 + rozpis(hra, t).reduce((s, [, h]) => s + h, 0))));
  }
  // rychlost práce podle nálady: 0,6× (zoufalý) až 1,4× (nadšený)
  const rychlost = t => 0.6 + 0.8 * t.nalada / 100;

  // jeden tah potřeb; vrací důvod smrti nebo null
  function tik(hra, t) {
    const spi = t.stav === 'spi';
    t.jidlo = Math.max(0, t.jidlo - UBYTEK.jidlo * (spi ? 0.5 : 1));
    t.piti = Math.max(0, t.piti - UBYTEK.piti * (spi ? 0.5 : 1));
    if (!spi) t.spanek = Math.max(0, t.spanek - UBYTEK.spanek);
    if (t.jidlo <= 0) t.zdravi -= 0.1;
    if (t.piti <= 0) t.zdravi -= 0.15;
    else if (t.jidlo > 30 && t.zdravi < 100) t.zdravi = Math.min(100, t.zdravi + (spi ? 0.04 : 0.01));
    if (t.zdravi <= 0) return t.piti <= 0 ? 'žízní' : 'hlady';
    if ((hra.tik + t.id) % 30 === 0) {
      t.vzpominky = t.vzpominky.filter(v => v.do > hra.tik);
      t.nalada = spocitejNaladu(hra, t);
      t.zlost = t.nalada < 12 ? t.zlost + 30 : Math.max(0, t.zlost - 30);
    }
    return null;
  }
  const hlad = t => t.jidlo < PRAH.hlad, zizen = t => t.piti < PRAH.zizen;
  const unava = (hra, t) => t.spanek < PRAH.unava || (noc(hra) && t.spanek < PRAH.unavaVNoci);
  function kriticke(hra, t) {
    return t.jidlo < PRAH.kriticky || t.piti < PRAH.kriticky || t.spanek < 5;
  }
  function potrebuje(hra, t) { return hlad(t) || zizen(t) || unava(hra, t); }

  // najde práci pro potřebu (nejnaléhavější první); vrací { hodnota, cesta, i } nebo null
  function najdi(hra, t) {
    const volna = new Map();
    for (const v of hra.veci) if (!v.nese && !v.rez && !(v.blok > hra.tik)) { const a = volna.get(v.i); if (a) a.push(v); else volna.set(v.i, [v]); }
    const poradi = [[t.piti, 'pit', zizen(t)], [t.jidlo, 'jist', hlad(t)], [t.spanek, 'spat', unava(hra, t)]]
      .filter(p => p[2]).sort((a, b) => a[0] - b[0]);
    for (const [, co] of poradi) {
      let r = null;
      if (co === 'jist') {
        const druhy = t.jidlo < 15 ? ['jidlo', 'houby', 'jecmen'] : ['jidlo'];
        r = C.hledej(hra, t.i, i => {
          const v = (volna.get(i) || []).find(v => druhy.includes(v.druh));
          return v ? { typ: 'jist', vec: v.id, pos: i, faze: 'k_veci' } : 0;
        });
      } else if (co === 'pit') {
        r = C.hledej(hra, t.i, i => {
          const v = (volna.get(i) || []).find(v => v.druh === 'pivo');
          return v ? { typ: 'pit', vec: v.id, pos: i, faze: 'k_veci' } : 0;
        }) || C.hledej(hra, t.i, i => uVody(hra, i) ? { typ: 'pit', voda: true, pos: i, faze: 'pije' } : 0);
      } else {
        const obsazene = new Set(hra.trpaslici.filter(u => u !== t && u.prace && u.prace.postel >= 0).map(u => u.prace.postel));
        r = C.hledej(hra, t.i, i => hra.stavba[i] === S.K.POSTEL && !obsazene.has(i) ? { typ: 'spat', postel: i, pos: i, faze: 'k_cili' } : 0);
        if (!r) r = { i: t.i, hodnota: { typ: 'spat', postel: -1, pos: t.i, faze: 'k_cili' }, cesta: [] };
      }
      if (r) return r;
    }
    return null;
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
      if (hra.hora.teren[j] === M.VODA && !jeVenku(hra, j)) return false;     // vedle je i nezamrzlá voda
    }
    return true;
  }
  T.potreby = { ledova, UBYTEK, PRAH, NASYCENI, vychozi, vzpominka, rozpis, spocitejNaladu, rychlost, tik, potrebuje, kriticke,
                najdi, uVody, uStolu, noc };
})(TRP);

if (typeof module !== 'undefined') module.exports = TRP;
