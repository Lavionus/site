/* ============================================================
   Srdce hory – udalosti.js: události s volbou.

   Zhruba každý třetí den (ne dřív než třetí den hry) se může stát
   něco, o čem rozhoduje hráč. Čekající událost je v hra.udalost
   (id, parametry, hotový text a popisy voleb), takže jde uložit;
   účinek voleb se dohledá podle id. Hra mezitím běží dál – UI ji
   při události samo pozastaví.
   Čistá logika bez DOM.
   ============================================================ */
var TRP = globalThis.TRP = globalThis.TRP || {};

(function (T) {
  'use strict';
  const P = T.prace, S = T.stavby;
  const nah = hra => P.nahoda(hra);
  const trp = (hra, id) => hra.trpaslici.find(t => t.id === id);
  const zprava = (hra, text, typ) => T.hra.zprava(hra, typ || 'pribeh', text);
  const vsem = (hra, text, h, dni) => { for (const t of hra.trpaslici) T.potreby.vzpominka(hra, t, text, h, dni); };
  function odeber(hra, druh, n) {                  // ze skladů; vrací, kolik se podařilo
    let k = 0;
    for (const v of hra.veci.slice()) {
      if (k >= n) break;
      if (v.druh !== druh || v.nese || v.rez || !S.jeSklad(hra, v.i)) continue;
      hra.veci.splice(hra.veci.indexOf(v), 1); k++;
    }
    return k;
  }
  const mam = (hra, druh) => P.zasoby(hra)[druh] || 0;

  const UDALOSTI = {
    poutnik: {
      vaha: 3, podminka: hra => mam(hra, 'jidlo') >= 3 && !T.obdobi.zima(hra),
      text: () => 'U Brány předků stojí vyhladovělý poutník a prosí o kus jídla.',
      volby: () => ['Dát mu 3 jídla', 'Poslat ho pryč'],
      efekt(hra, p, i) {
        if (i === 0) {
          odeber(hra, 'jidlo', 3);
          vsem(hra, 'pomohli poutníkovi', 3, 2);
          hra.slavaBonus = (hra.slavaBonus || 0) + 3;
          if (nah(hra) < 0.4) { P.novaVec(hra, 'drahokam', T.obdobi.uBrany(hra)); P.usadVeci(hra); return 'Poutník poděkoval. Ráno na prahu leží drahokam.'; }
          return 'Poutník poděkoval a odešel do hor.';
        }
        if (nah(hra) < 0.4) vsem(hra, 'poslali pryč hladového', -2, 1);
        return 'Poutník odešel s prázdnou.';
      },
    },
    nemoc: {
      vaha: 2, podminka: hra => hra.trpaslici.length >= 2,
      param: hra => ({ a: hra.trpaslici[Math.floor(nah(hra) * hra.trpaslici.length)].id }),
      text: (hra, p) => `${trp(hra, p.a).jmeno} má horečku a třese se zimou.`,
      volby: () => ['Uložit ho na den do postele', 'Ať pracuje dál'],
      efekt(hra, p, i) {
        const t = trp(hra, p.a); if (!t) return '';
        if (i === 0) { T.hra.pustPraci(hra, t); t.nemoc = hra.tik + T.hra.TAHU_ZA_DEN; return `${t.jmeno} odpočívá a horečka ustupuje.`; }
        t.zdravi = Math.max(5, t.zdravi - 30);
        const jiny = hra.trpaslici.find(u => u !== t && nah(hra) < 0.3);
        if (jiny) { jiny.zdravi = Math.max(5, jiny.zdravi - 15); return `${t.jmeno} pracuje s horečkou. Nakazil se od něj i ${jiny.jmeno}.`; }
        return `${t.jmeno} pracuje, ale horečka ho vyčerpala.`;
      },
    },
    spor: {
      vaha: 2, podminka: hra => hra.trpaslici.length >= 3,
      param: hra => {
        const a = Math.floor(nah(hra) * hra.trpaslici.length);
        let b = Math.floor(nah(hra) * (hra.trpaslici.length - 1)); if (b >= a) b++;
        return { a: hra.trpaslici[a].id, b: hra.trpaslici[b].id, co: ['čí je lepší krumpáč', 'kdo vypil poslední pivo', 'jak se správně splétá vous', 'kdo má víc zásluh o předsíň'][Math.floor(nah(hra) * 4)] };
      },
      text: (hra, p) => `${trp(hra, p.a).jmeno} a ${trp(hra, p.b).jmeno} se hádají, ${p.co}. Klan čeká, co řekneš.`,
      volby: (hra, p) => [`Dát za pravdu: ${trp(hra, p.a).jmeno}`, `Dát za pravdu: ${trp(hra, p.b).jmeno}`, 'Ať si to vyřídí sami'],
      efekt(hra, p, i) {
        const a = trp(hra, p.a), b = trp(hra, p.b); if (!a || !b) return '';
        if (i < 2) {
          const [v, pr] = i === 0 ? [a, b] : [b, a];
          T.potreby.vzpominka(hra, v, 'vyhrál spor', 6, 2); T.potreby.vzpominka(hra, pr, 'prohrál spor', -6, 2);
          return `${v.jmeno} je spokojený, ${pr.jmeno} bručí do vousů.`;
        }
        if (nah(hra) < 0.5) { for (const t of [a, b]) T.potreby.vzpominka(hra, t, 'nevyřešená hádka', -3, 1); return 'Hádka vyšuměla do ztracena.'; }
        const zraneny = nah(hra) < 0.5 ? a : b;
        zraneny.zdravi = Math.max(5, zraneny.zdravi - 15);
        return `Skončilo to rvačkou. ${zraneny.jmeno} má monokl a naražená žebra.`;
      },
    },
    dutina: {
      vaha: 1, podminka: hra => hra.vykopano >= 60,
      text: () => 'Horníci narazili na malou dutinu plnou třpytivých krystalů. Vypadá prastaře.',
      volby: () => ['Vylomit krystaly (+2 drahokamy)', 'Nechat ji předkům (sláva +8)'],
      efekt(hra, p, i) {
        if (i === 0) { const k = T.obdobi.uBrany(hra); P.novaVec(hra, 'drahokam', k); P.novaVec(hra, 'drahokam', k); P.usadVeci(hra); return 'Dva drahokamy leží před bránou.'; }
        hra.slavaBonus = (hra.slavaBonus || 0) + 8;
        vsem(hra, 'uctili předky', 2, 2);
        return 'Dutinu zazdili a vyryli do ní runu na počest předků.';
      },
    },
    slavnost: {
      vaha: 2, podminka: hra => mam(hra, 'pivo') >= 15,
      text: () => 'Klan chce uspořádat pivní slavnost na počest předků.',
      volby: () => ['Slavit! (−10 piv)', 'Teď ne, je práce'],
      efekt(hra, p, i) {
        if (i === 0) { odeber(hra, 'pivo', 10); vsem(hra, 'pivní slavnost!', 10, 2); hra.slavaBonus = (hra.slavaBonus || 0) + 2; return 'Zpívalo se do rána. Nálada je výborná.'; }
        vsem(hra, 'zakázaná slavnost', -3, 1);
        return 'Trpaslíci se rozešli k práci, ale bručí.';
      },
    },
    dar: {
      vaha: 1, podminka: hra => (hra.slava || 0) >= 50 && !(hra.posledniDar > hra.tik - 20 * T.hra.TAHU_ZA_DEN),
      text: () => 'Posel z Železných hor přináší dar za slávu vašeho klanu: čtyři železné pruty.',
      volby: () => ['Děkujeme'],
      efekt(hra) {
        const k = T.obdobi.uBrany(hra);
        for (let j = 0; j < 4; j++) P.novaVec(hra, 'prut_zelezo', k);
        P.usadVeci(hra); hra.posledniDar = hra.tik;
        return 'Pruty leží před bránou.';
      },
    },
    zbloudily: {
      vaha: 1, podminka: hra => hra.trpaslici.length < 40 && hra.trpaslici.length > 0,
      param: hra => ({ lide: [{ jmeno: T.hra.noveJmeno(hra, []), prof: T.hra.nahodnaProfese(hra) }] }),
      text: (hra, p) => `Na prahu stojí zbloudilý trpaslík ${p.lide[0].jmeno} (${T.hra.PROFESE[p.lide[0].prof].nazev}). Prosí o přijetí do klanu.`,
      volby: () => ['Přijmout', 'Odmítnout'],
      efekt(hra, p, i) {
        if (i === 0) { T.obdobi.prijmi(hra, p.lide); return `${p.lide[0].jmeno} se přidal ke klanu.`; }
        return `${p.lide[0].jmeno} smutně odešel.`;
      },
    },
    migranti: {
      vaha: 0,                                        // přicházejí na začátku období (obdobi.js)
      text: (hra, p) => `Sláva hory se nese krajem. Přišla skupina trpaslíků: ` +
        p.lide.map(l => `${l.jmeno} (${T.hra.PROFESE[l.prof].nazev})`).join(', ') + '. Přijmete je?',
      volby: (hra, p) => p.lide.length > 1 ? ['Přijmout všechny', `Přijmout jen prvního (${p.lide[0].jmeno})`, 'Odmítnout'] : ['Přijmout', 'Odmítnout'],
      efekt(hra, p, i) {
        const vse = p.lide.length === 1 ? i === 0 : i === 0, jeden = p.lide.length > 1 && i === 1;
        if (vse) { T.obdobi.prijmi(hra, p.lide); return `Klan se rozrostl o ${p.lide.length}.`; }
        if (jeden) { T.obdobi.prijmi(hra, [p.lide[0]]); return `${p.lide[0].jmeno} zůstal, ostatní šli dál.`; }
        return 'Skupina odešla hledat jinou horu.';
      },
    },
  };

  function zacni(hra, id, param) {
    const d = UDALOSTI[id];
    param = param || (d.param ? d.param(hra) : {});
    hra.udalost = { id, param, text: d.text(hra, param), volby: d.volby(hra, param), tik: hra.tik };
    T.hra.zvuk(hra, 'zvonek');
  }
  // denně dopoledne se může něco stát
  function tik(hra) {
    if (hra.tik % T.hra.TAHU_ZA_DEN !== 150 || hra.udalost || T.hra.den(hra) < 3 || !hra.trpaslici.length) return;
    if (nah(hra) > 0.33) return;
    const mozne = Object.entries(UDALOSTI).filter(([, d]) => d.vaha && d.podminka(hra));
    const soucet = mozne.reduce((s, [, d]) => s + d.vaha, 0);
    let r = nah(hra) * soucet;
    for (const [id, d] of mozne) { r -= d.vaha; if (r < 0) { zacni(hra, id); return; } }
  }
  function vyres(hra, i) {
    const u = hra.udalost;
    if (!u) return '';
    hra.udalost = null;
    const text = UDALOSTI[u.id].efekt(hra, u.param, i) || '';
    if (text) zprava(hra, text, 'udalost');
    return text;
  }

  T.udalosti = { UDALOSTI, zacni, tik, vyres };
})(TRP);

if (typeof module !== 'undefined') module.exports = TRP;
