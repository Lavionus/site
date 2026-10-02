/* ============================================================
   Srdce hory – udalosti.js: události s volbou.

   Zhruba každý třetí den (ne dřív než třetí den hry) se může stát
   něco, o čem rozhoduje hráč. Čekající událost je v hra.udalost
   (id, parametry, hotový text a popisy voleb), takže jde uložit;
   účinek voleb se dohledá podle id. Hra mezitím běží dál – UI ji
   při události samo pozastaví.
   Volby mají cenu: čas (trpaslíci chvíli nepracují), suroviny, nebo
   riziko. Řetězená událost: poutník, kterému klan pomohl, se za 8–14 dní
   vrátí (dar, nebo se přidá); vyhnaný může být goblinní zvěd a vrátí se
   krást. Hlas hlubin přijde jednou v kampani, když klan kope od 100 m.
   Čekající pokračování je v hra.odemceno.navrat (ukládá se s hrou).
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
      hra.veci.splice(hra.veci.indexOf(v), 1); k++; T.prace.tok(hra, druh, 'm', 'události');
    }
    return k;
  }
  const mam = (hra, druh) => P.zasoby(hra)[druh] || 0;
  const DEN = () => T.hra.TAHU_ZA_DEN;
  const slava = (hra, n) => { hra.slavaBonus = (hra.slavaBonus || 0) + n; };
  const uBrany = (hra, druh, n) => { const k = T.obdobi.uBrany(hra); for (let j = 0; j < n; j++) P.novaVec(hra, druh, k); P.usadVeci(hra); };
  // trpaslíci, kteří na chvíli nepracují (slaví, vylamují…); přednost mají horníci
  function zabav(hra, n, tahu, prof) {
    const kdo = hra.trpaslici.filter(t => !prof || t.prof === prof).concat(hra.trpaslici.filter(t => prof && t.prof !== prof)).slice(0, n);
    for (const t of kdo) { T.hra.pustPraci(hra, t); t.cekej = tahu; }
    return kdo;
  }
  // zloděj ze skladu: nejcennější věci (ne Klíč)
  function ukradni(hra, n) {
    const vv = Object.values(T.obdobi.naProdej(hra)).flat().sort((a, b) => T.obdobi.hodnotaVeci(b) - T.obdobi.hodnotaVeci(a)).slice(0, n);
    for (const v of vv) { hra.veci.splice(hra.veci.indexOf(v), 1); T.prace.tok(hra, v.druh, 'm', 'události'); }
    return vv.map(v => P.VECI[v.druh].nazev);
  }

  const UDALOSTI = {
    poutnik: {
      vaha: 3, podminka: hra => mam(hra, 'jidlo') >= 3 && !T.obdobi.zima(hra) && !(hra.odemceno && hra.odemceno.navrat),
      param: hra => ({ jmeno: T.hra.noveJmeno(hra, []), prof: T.hra.nahodnaProfese(hra) }),
      text: () => 'U Brány předků stojí vyhladovělý poutník a prosí o kus jídla. Zahalený plášť, oči nespouští z vašich skladů.',
      volby: () => ['Dát mu 3 jídla', 'Poslat ho pryč'],
      efekt(hra, p, i) {
        if (i === 0) {
          odeber(hra, 'jidlo', 3);
          vsem(hra, 'pomohli poutníkovi', 3, 2);
          slava(hra, 5);
          hra.odemceno.navrat = { tik: hra.tik + Math.round((8 + nah(hra) * 6) * DEN()), pomohl: true, jmeno: p.jmeno, prof: p.prof };
          return 'Poutník poděkoval a slíbil, že na vaši laskavost nezapomene.';
        }
        if (nah(hra) < 0.4) vsem(hra, 'poslali pryč hladového', -2, 1);
        if (nah(hra) < 0.5) hra.odemceno.navrat = { tik: hra.tik + Math.round((3 + nah(hra) * 3) * DEN()), pomohl: false };
        return 'Poutník odešel s prázdnou. Na kraji údolí se ještě otočil.';
      },
    },
    poutnik_navrat: {                                 // řetěz: pomohli jste poutníkovi
      vaha: 0,
      text: (hra, p) => `Poutník se vrátil! Je to ${p.jmeno}, potulný mistr (${T.hra.PROFESE[p.prof].nazev}). ` +
        'Přinesl dva drahokamy a nabízí, že u vás zůstane – dar si pak ale nechá na nástroje.',
      volby: (hra, p) => p.plno ? ['Vzít dar (2 drahokamy)'] : [`Přijmout ${p.jmeno} do klanu (zkušený)`, 'Vzít jen dar (2 drahokamy)'],
      efekt(hra, p, i) {
        if (!p.plno && i === 0) { T.obdobi.prijmi(hra, [{ jmeno: p.jmeno, prof: p.prof, zkuseny: true }]); return `${p.jmeno} se přidal ke klanu.`; }
        uBrany(hra, 'drahokam', 2); slava(hra, 4);
        return 'Drahokamy leží před bránou. Poutník odešel do hor.';
      },
    },
    nemoc: {
      vaha: 2, podminka: hra => hra.trpaslici.length >= 2,
      param: hra => ({ a: hra.trpaslici[Math.floor(nah(hra) * hra.trpaslici.length)].id, odvar: mam(hra, 'houby') >= 2 && mam(hra, 'pivo') >= 1 }),
      text: (hra, p) => `${trp(hra, p.a).jmeno} má horečku a třese se zimou.`,
      volby: (hra, p) => p.odvar ? ['Uložit ho na den do postele', 'Uvařit odvar (−2 houby, −1 pivo; leží jen čtvrt dne)', 'Ať pracuje dál (riziko)']
        : ['Uložit ho na den do postele', 'Ať pracuje dál (riziko)'],
      efekt(hra, p, i) {
        const t = trp(hra, p.a); if (!t) return '';
        const volba = p.odvar ? ['luzko', 'odvar', 'prace'][i] : ['luzko', 'prace'][i];
        if (volba === 'luzko') { T.hra.pustPraci(hra, t); t.nemoc = hra.tik + DEN(); return `${t.jmeno} odpočívá a horečka ustupuje.`; }
        if (volba === 'odvar') {
          if (odeber(hra, 'houby', 2) < 2 || odeber(hra, 'pivo', 1) < 1) { T.hra.pustPraci(hra, t); t.nemoc = hra.tik + DEN(); return 'Na odvar nezbylo – musí do postele na celý den.'; }
          T.hra.pustPraci(hra, t); t.nemoc = hra.tik + Math.round(DEN() / 4); return `${t.jmeno} vypil hořký odvar a k večeru bude na nohou.`;
        }
        if (nah(hra) < 0.4) return `${t.jmeno} horečku rozchodil.`;
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
      volby: (hra, p) => [`Dát za pravdu: ${trp(hra, p.a).jmeno}`, `Dát za pravdu: ${trp(hra, p.b).jmeno}`, 'Usmířit je u soudku (−3 piva)', 'Ať si to vyřídí sami'],
      efekt(hra, p, i) {
        const a = trp(hra, p.a), b = trp(hra, p.b); if (!a || !b) return '';
        if (i < 2) {
          const [v, pr] = i === 0 ? [a, b] : [b, a];
          T.potreby.vzpominka(hra, v, 'vyhrál spor', 6, 2); T.potreby.vzpominka(hra, pr, 'prohrál spor', -6, 2);
          return `${v.jmeno} je spokojený, ${pr.jmeno} bručí do vousů.`;
        }
        if (i === 2 && odeber(hra, 'pivo', 3) === 3) {
          for (const t of [a, b]) { T.potreby.vzpominka(hra, t, 'usmířili se u piva', 3, 2); T.hra.pustPraci(hra, t); t.cekej = 120; }
          return `${a.jmeno} a ${b.jmeno} si plácli nad korbelem. Chvíli to trvalo.`;
        }
        if (nah(hra) < 0.5) { for (const t of [a, b]) T.potreby.vzpominka(hra, t, 'nevyřešená hádka', -3, 1); return 'Hádka vyšuměla do ztracena.'; }
        const zraneny = nah(hra) < 0.5 ? a : b;
        zraneny.zdravi = Math.max(5, zraneny.zdravi - 15);
        return `Skončilo to rvačkou. ${zraneny.jmeno} má monokl a naražená žebra.`;
      },
    },
    dutina: {
      vaha: 1, podminka: hra => hra.vykopano >= 60,
      text: () => 'Horníci narazili na malou dutinu plnou třpytivých krystalů. Vypadá prastaře – a krystaly drží strop.',
      volby: () => ['Vylomit rychle (+3 drahokamy, vážné riziko závalu)', 'Vylomit opatrně (2 horníci půl dne, +2 drahokamy)', 'Nechat ji předkům (sláva +12)'],
      efekt(hra, p, i) {
        if (i === 0) {
          uBrany(hra, 'drahokam', 3);
          // skutečné riziko: zával zraní 30–75 ♥ (raněného i zabije), občas zasype dva horníky
          if (nah(hra) < 0.35) {
            const obeti = zabav(hra, nah(hra) < 0.3 ? 2 : 1, 0, 'hornik');
            const mrtvi = [], ranen = [];
            for (const t of obeti) {
              t.zdravi -= 30 + Math.floor(nah(hra) * 46); T.hra.zvuk(hra, 'zaval', t.i, 3);
              if (t.zdravi <= 0) { mrtvi.push(t.jmeno); T.hra.umri(hra, t, `${t.jmeno} zahynul pod závalem v krystalové dutině.`, 'zaval'); }
              else ranen.push(t.jmeno);
            }
            return 'Tři drahokamy leží před bránou – ale strop dutiny se sesypal' + (mrtvi.length ? `. ${mrtvi.join(' a ')} to nepřežil${mrtvi.length > 1 ? 'i' : ''}` : '') +
              (ranen.length ? `${mrtvi.length ? ', ' : ' na '}${ranen.join(' a ')} ${mrtvi.length ? 'je těžce zraněný' : ''}` : '') + '.';
          }
          return 'Tři drahokamy leží před bránou. Strop vydržel.';
        }
        if (i === 1) {
          const kdo = zabav(hra, 2, Math.round(DEN() / 2), 'hornik');
          uBrany(hra, 'drahokam', 2);
          return `${kdo.map(t => t.jmeno).join(' a ')} půl dne pečlivě vylamují krystaly. Dva drahokamy budou před bránou.`;
        }
        slava(hra, 12);
        vsem(hra, 'uctili předky', 2, 2);
        return 'Dutinu zazdili a vyryli do ní runu na počest předků.';
      },
    },
    slavnost: {
      vaha: 2, podminka: hra => mam(hra, 'pivo') >= 15,
      text: () => 'Klan chce uspořádat pivní slavnost na počest předků.',
      volby: () => ['Velká slavnost (−10 piv, klan čtvrt dne slaví)', 'Jen přípitek (−4 piva)', 'Teď ne, je práce'],
      efekt(hra, p, i) {
        if (i === 0) {
          odeber(hra, 'pivo', 10); vsem(hra, 'pivní slavnost!', 10, 3); slava(hra, 5);
          for (const t of hra.trpaslici) if (!t.prace || t.prace.typ !== 'lov') { T.hra.pustPraci(hra, t); t.cekej = Math.round(DEN() / 4); }
          return 'Zpívalo se do rána. Nálada je výborná, práce počká.';
        }
        if (i === 1) { odeber(hra, 'pivo', 4); vsem(hra, 'přípitek předkům', 4, 1); return 'Krátký přípitek a zpátky ke krumpáčům.'; }
        vsem(hra, 'zakázaná slavnost', -3, 1);
        return 'Trpaslíci se rozešli k práci, ale bručí.';
      },
    },
    dar: {
      vaha: 1, podminka: hra => (hra.slava || 0) >= 50 && !(hra.posledniDar > hra.tik - 20 * T.hra.TAHU_ZA_DEN),
      text: () => 'Posel z Železných hor přináší dar za slávu vašeho klanu. Co si klan vybere?',
      volby: () => ['Čtyři železné pruty', 'Válečnou sekeru', 'Odmítnout s díky (sláva +10)'],
      efekt(hra, p, i) {
        hra.posledniDar = hra.tik;
        if (i === 0) { uBrany(hra, 'prut_zelezo', 4); return 'Pruty leží před bránou.'; }
        if (i === 1) { P.novaVec(hra, 'valecna_sekera', T.obdobi.uBrany(hra), 'zelezo'); P.usadVeci(hra); return 'Válečná sekera leží před bránou.'; }
        slava(hra, 10);
        return 'Posel odnesl zprávu o vaší hrdosti. Železné hory si vás váží.';
      },
    },
    hlas_hlubin: {                                    // příběh: jednou v kampani, od 100 m po první desce
      vaha: 3, podminka: hra => hra.rezim !== 'volny' && !hra.spac.probuzen && !hra.spac.hlas && hra.nejhloubeji >= 100 && hra.prectene.length >= 1,
      text: () => 'Horníci v hloubce slyší z hlubin pomalé údery – jako by bilo obří srdce. Starší trpaslíci se bojí kopat dál.',
      volby: () => ['Zazpívat píseň předků (−6 piv)', 'Poslat 2 horníky naslouchat (půl dne práce, prozradí jednu žílu)', 'Kopat dál (sláva +6)'],
      efekt(hra, p, i) {
        hra.spac.hlas = true;
        if (i === 0) {
          odeber(hra, 'pivo', 6); vsem(hra, 'píseň předků', 4, 2);
          hra.dalsiNajezd += 3 * DEN();
          return 'Píseň předků zněla šachtami. Hora ztichla – i goblini na obzoru zaváhali.';
        }
        if (i === 1) {
          const kdo = zabav(hra, 2, Math.round(DEN() / 2), 'hornik');
          // ozvěna prozradí jednu žílu hvězdné rudy nad prahem Spáče – tu nejblíž nejhlubšímu trpaslíkovi (dřív všechny)
          const W_ = T.hora.W, nad = j => (j / W_ | 0) - T.hora.UDOLI < T.pribeh.HLOUBKA_SPACE;
          const zily = (hra.hora.zily || []).filter(z => z.r === T.hora.R.HVEZDNA && z.kusy.some(j => nad(j) && !hra.znamo[j] && hra.hora.ruda[j] === T.hora.R.HVEZDNA));
          const hl = hra.trpaslici.reduce((a, t) => (t.i / W_ | 0) > (a.i / W_ | 0) ? t : a, hra.trpaslici[0]);
          const vzd = z => Math.min(...z.kusy.map(j => Math.abs(j % W_ - hl.i % W_) + Math.abs((j / W_ | 0) - (hl.i / W_ | 0))));
          zily.sort((a, b) => vzd(a) - vzd(b));
          let n = 0, kde = -1;
          if (zily.length) for (const j of zily[0].kusy) if (nad(j) && !hra.znamo[j] && hra.hora.ruda[j] === T.hora.R.HVEZDNA) { hra.znamo[j] = 1; n++; kde = j; }
          if (kde >= 0) T.hra.zprava(hra, 'nalez', `Ozvěna prozradila žílu hvězdné rudy (${n} ${n < 5 ? 'pole' : 'polí'}).`, kde);
          return `${kdo.map(t => t.jmeno).join(' a ')} naslouchali u stěn. Tlukot sílí pod ${T.pribeh.HLOUBKA_SPACE} m – tam spí Spáč. ` +
            (n ? `Ozvěna prozradila jednu žílu hvězdné rudy (${n} ${n < 5 ? 'pole' : 'polí'}).` : 'Žádnou další žílu hvězdné rudy ozvěna neprozradila.');
        }
        slava(hra, 6); vsem(hra, 'bojí se hlubin', -3, 2);
        if (nah(hra) < 0.3) { T.hrozby.tvorZHlubin(hra, (typ, text, i) => T.hra.zprava(hra, typ, text, i)); }
        return 'Kopalo se dál. Trpaslíci se ohlížejí přes rameno.';
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
        p.lide.map(T.obdobi.popisPrichoziho).join(', ') + '. Přijmete je?',
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
  // pokračování řetězu: vděčný poutník přijde s darem, vyhnaný zvěd krade
  function navrat(hra) {
    const n = hra.odemceno.navrat;
    delete hra.odemceno.navrat;
    if (n.pomohl) { zacni(hra, 'poutnik_navrat', { jmeno: n.jmeno || T.hra.noveJmeno(hra, []), prof: n.prof || T.hra.nahodnaProfese(hra), plno: hra.trpaslici.length >= 40 }); return; }
    const co = ukradni(hra, 2);
    T.hra.zprava(hra, 'boj', co.length ? `🌙 Vyhnaný poutník byl goblinní zvěd! V noci se vrátil s kumpány a ze skladu zmizelo: ${co.join(', ')}.`
      : '🌙 Vyhnaný poutník byl goblinní zvěd – v noci slídil kolem brány, ale nic neukradl.');
  }
  // denně dopoledne se může něco stát
  function tik(hra) {
    if (hra.tik % T.hra.TAHU_ZA_DEN !== 150 || hra.udalost || T.hra.den(hra) < 3 || !hra.trpaslici.length) return;
    if (hra.odemceno && hra.odemceno.navrat && hra.tik >= hra.odemceno.navrat.tik) { navrat(hra); return; }
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

  T.udalosti = { UDALOSTI, zacni, tik, vyres, navrat };
})(TRP);

if (typeof module !== 'undefined') module.exports = TRP;
