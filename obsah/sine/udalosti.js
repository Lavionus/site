/* ============================================================
   Síně pod horou – udalosti.js: události s volbou (převzato ze
   Srdce hory; Hlas hlubin přijde s příběhem v etapě 9).

   Zhruba každý třetí den (od 3. dne) dopoledne se může něco stát.
   Čekající událost je v hra.udalost (id, parametry, text, volby),
   takže jde uložit; účinek voleb se dohledá podle id. Rozhraní hru
   při události pozastaví. Řetěz: poutník, kterému klan pomohl, se
   za 8–14 dní vrátí s darem (nebo se přidá); vyhnaný může být
   goblinní zvěd a vrátí se krást (hra.odemceno.navrat).
   Čistá logika bez DOM.
   ============================================================ */
var SIN = globalThis.SIN = globalThis.SIN || {};

(function (S) {
  'use strict';
  const PR = S.prace;
  const nah = hra => PR.nahoda(hra);
  const trp = (hra, id) => hra.trpaslici.find(t => t.id === id);
  const zprava = (hra, text, typ) => PR.zprava(hra, typ || 'udalost', text);
  const vsem = (hra, text, h, dni) => { for (const t of hra.trpaslici) S.potreby.vzpominka(hra, t, text, h, dni); };
  const DEN = () => S.hra.TAHU_ZA_DEN;
  const slava = (hra, n) => { hra.slavaBonus = (hra.slavaBonus || 0) + n; };
  const mam = (hra, druh) => S.stavby.pocty(hra)[druh] || 0;
  // odebere ze skladů (nebo odkudkoli ze země); vrací kolik
  function odeber(hra, druh, n) {
    let k = 0;
    const vv = hra.veci.filter(v => v.druh === druh && v.g >= 0).sort((a, b) => (S.stavby.prijme(hra, b.g, druh) ? 1 : 0) - (S.stavby.prijme(hra, a.g, druh) ? 1 : 0));
    for (const v of vv) { if (k >= n) break; PR.odeberVec(hra, v); hra.spotrebovano++; k++; }
    return k;
  }
  const uBrany = (hra, druh, n, mat) => { const g = S.obdobi.misto(hra); for (let j = 0; j < n; j++) PR.novaVec(hra, druh, g, mat); };
  // trpaslíci, kteří na chvíli nepracují (slaví, vylamují…); přednost mají horníci
  function zabav(hra, n, tahu, prof) {
    const kdo = hra.trpaslici.filter(t => !prof || t.prof === prof).concat(hra.trpaslici.filter(t => prof && t.prof !== prof)).slice(0, n);
    for (const t of kdo) { S.hra.pustPraci(hra, t); t.cekej = tahu; }
    return kdo;
  }
  const ZVED_MAX = 45;
  function ukradni(hra, n) {
    const O = S.obdobi;
    const vv = Object.values(O.naProdej(hra)).flat().filter(v => O.hodnotaVeci(v) <= ZVED_MAX)
      .sort((a, b) => O.hodnotaVeci(b) - O.hodnotaVeci(a)).slice(0, n);
    for (const v of vv) { PR.odeberVec(hra, v); hra.spotrebovano++; }
    return vv.map(v => PR.VECI[v.druh].nazev);
  }

  const UDALOSTI = {
    poutnik: {
      vaha: 3, podminka: hra => mam(hra, 'jidlo') >= 3 && !S.obdobi.zima(hra) && !hra.odemceno.navrat,
      param: hra => ({ jmeno: S.hra.noveJmeno(hra, []), prof: S.hra.nahodnaProfese(hra) }),
      text: () => 'Po cestě roklí přišel k Bráně předků vyhladovělý poutník a prosí o kus jídla. Zahalený plášť, oči nespouští z vašich skladů.',
      volby: () => ['Dát mu 3 jídla', 'Poslat ho pryč'],
      efekt(hra, p, i) {
        if (i === 0) {
          odeber(hra, 'jidlo', 3); vsem(hra, 'pomohli poutníkovi', 3, 2); slava(hra, 5);
          hra.odemceno.navrat = { tik: hra.tik + Math.round((8 + nah(hra) * 6) * DEN()), pomohl: true, jmeno: p.jmeno, prof: p.prof };
          return 'Poutník poděkoval a slíbil, že na vaši laskavost nezapomene.';
        }
        if (nah(hra) < 0.4) vsem(hra, 'poslali pryč hladového', -2, 1);
        if (nah(hra) < 0.5) hra.odemceno.navrat = { tik: hra.tik + Math.round((3 + nah(hra) * 3) * DEN()), pomohl: false };
        return 'Poutník odešel s prázdnou. Na konci rokle se ještě otočil.';
      },
    },
    poutnik_navrat: {
      vaha: 0,
      text: (hra, p) => `Poutník se vrátil! Je to ${p.jmeno}, potulný mistr (${S.hra.PROFESE[p.prof].nazev}). Přinesl dva drahokamy a nabízí, že u vás zůstane – dar si pak ale nechá na nástroje.`,
      volby: (hra, p) => p.plno ? ['Vzít dar (2 drahokamy)'] : [`Přijmout ${p.jmeno} do klanu (zkušený)`, 'Vzít jen dar (2 drahokamy)'],
      efekt(hra, p, i) {
        if (!p.plno && i === 0) { S.obdobi.prijmi(hra, [{ jmeno: p.jmeno, prof: p.prof, zkuseny: true }]); return `${p.jmeno} se přidal ke klanu.`; }
        uBrany(hra, 'drahokam', 2); slava(hra, 4);
        return 'Drahokamy leží na tržišti. Poutník odešel do hor.';
      },
    },
    nemoc: {
      vaha: 2, podminka: hra => hra.trpaslici.length >= 2,
      param: hra => ({ a: hra.trpaslici[Math.floor(nah(hra) * hra.trpaslici.length)].id, odvar: mam(hra, 'houby') >= 2 && mam(hra, 'pivo') >= 1 }),
      text: (hra, p) => `${(trp(hra, p.a) || { jmeno: 'Jeden z klanu' }).jmeno} má horečku a třese se zimou.`,
      volby: (hra, p) => p.odvar ? ['Uložit ho na den do postele', 'Uvařit odvar (−2 houby, −1 pivo; leží jen čtvrt dne)', 'Ať pracuje dál (riziko)'] : ['Uložit ho na den do postele', 'Ať pracuje dál (riziko)'],
      efekt(hra, p, i) {
        const t = trp(hra, p.a); if (!t) return '';
        const volba = p.odvar ? ['luzko', 'odvar', 'prace'][i] : ['luzko', 'prace'][i];
        if (volba === 'luzko') { S.hra.pustPraci(hra, t); t.nemoc = hra.tik + DEN(); return `${t.jmeno} odpočívá a horečka ustupuje.`; }
        if (volba === 'odvar') {
          if (odeber(hra, 'houby', 2) < 2 || odeber(hra, 'pivo', 1) < 1) { S.hra.pustPraci(hra, t); t.nemoc = hra.tik + DEN(); return 'Na odvar nezbylo – musí do postele na celý den.'; }
          S.hra.pustPraci(hra, t); t.nemoc = hra.tik + Math.round(DEN() / 4); return `${t.jmeno} vypil hořký odvar a k večeru bude na nohou.`;
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
      text: (hra, p) => `${(trp(hra, p.a) || {}).jmeno} a ${(trp(hra, p.b) || {}).jmeno} se hádají, ${p.co}. Klan čeká, co řekneš.`,
      volby: (hra, p) => [`Dát za pravdu: ${(trp(hra, p.a) || {}).jmeno}`, `Dát za pravdu: ${(trp(hra, p.b) || {}).jmeno}`, 'Usmířit je u soudku (−3 piva)', 'Ať si to vyřídí sami'],
      efekt(hra, p, i) {
        const a = trp(hra, p.a), b = trp(hra, p.b); if (!a || !b) return '';
        if (i < 2) {
          const [v, pr] = i === 0 ? [a, b] : [b, a];
          S.potreby.vzpominka(hra, v, 'vyhrál spor', 6, 2); S.potreby.vzpominka(hra, pr, 'prohrál spor', -6, 2);
          return `${v.jmeno} je spokojený, ${pr.jmeno} bručí do vousů.`;
        }
        if (i === 2 && odeber(hra, 'pivo', 3) === 3) {
          for (const t of [a, b]) { S.potreby.vzpominka(hra, t, 'usmířili se u piva', 3, 2); S.hra.pustPraci(hra, t); t.cekej = 120; }
          return `${a.jmeno} a ${b.jmeno} si plácli nad korbelem. Chvíli to trvalo.`;
        }
        if (nah(hra) < 0.5) { for (const t of [a, b]) S.potreby.vzpominka(hra, t, 'nevyřešená hádka', -3, 1); return 'Hádka vyšuměla do ztracena.'; }
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
          if (nah(hra) < 0.35) {
            const obeti = zabav(hra, nah(hra) < 0.3 ? 2 : 1, 0, 'hornik'), mrtvi = [], ranen = [];
            for (const t of obeti) {
              t.zdravi -= 30 + Math.floor(nah(hra) * 46);
              if (t.zdravi <= 0) { mrtvi.push(t.jmeno); S.hra.umri(hra, t, 'zával v krystalové dutině'); } else ranen.push(t.jmeno);
            }
            return 'Tři drahokamy jsou na tržišti – ale strop dutiny se sesypal' + (mrtvi.length ? `. ${mrtvi.join(' a ')} to nepřežil${mrtvi.length > 1 ? 'i' : ''}` : '') +
              (ranen.length ? `${mrtvi.length ? ', ' : ' na '}${ranen.join(' a ')}${mrtvi.length ? ' je těžce zraněný' : ''}` : '') + '.';
          }
          return 'Tři drahokamy jsou na tržišti. Strop vydržel.';
        }
        if (i === 1) {
          const kdo = zabav(hra, 2, Math.round(DEN() / 2), 'hornik');
          uBrany(hra, 'drahokam', 2);
          return `${kdo.map(t => t.jmeno).join(' a ')} půl dne pečlivě vylamují krystaly. Dva drahokamy budou na tržišti.`;
        }
        slava(hra, 12); vsem(hra, 'uctili předky', 2, 2);
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
          for (const t of hra.trpaslici) { S.hra.pustPraci(hra, t); t.cekej = Math.round(DEN() / 4); }
          return 'Zpívalo se do rána. Nálada je výborná, práce počká.';
        }
        if (i === 1) { odeber(hra, 'pivo', 4); vsem(hra, 'přípitek předkům', 4, 1); return 'Krátký přípitek a zpátky ke krumpáčům.'; }
        vsem(hra, 'zakázaná slavnost', -3, 1);
        return 'Trpaslíci se rozešli k práci, ale bručí.';
      },
    },
    dar: {
      vaha: 1, podminka: hra => (hra.slava || 0) >= 50 && !(hra.posledniDar > hra.tik - 20 * DEN()),
      text: () => 'Posel z Železných hor přináší dar za slávu vašeho klanu. Co si klan vybere?',
      volby: () => ['Čtyři železné pruty', 'Válečnou sekeru', 'Odmítnout s díky (sláva +10)'],
      efekt(hra, p, i) {
        hra.posledniDar = hra.tik;
        if (i === 0) { uBrany(hra, 'prut_zelezo', 4); return 'Pruty leží na tržišti.'; }
        if (i === 1) { uBrany(hra, 'valecna_sekera', 1, 'zelezo'); return 'Válečná sekera leží na tržišti.'; }
        slava(hra, 10);
        return 'Posel odnesl zprávu o vaší hrdosti. Železné hory si vás váží.';
      },
    },
    zbloudily: {
      vaha: 1, podminka: hra => hra.trpaslici.length > 0,
      param: hra => ({ lide: [{ jmeno: S.hra.noveJmeno(hra, []), prof: S.hra.nahodnaProfese(hra) }], plno: S.obdobi.mistoVKlanu(hra).volno <= 0 }),
      text: (hra, p) => `Roklí přišel zbloudilý trpaslík ${p.lide[0].jmeno} (${S.hra.PROFESE[p.lide[0].prof].nazev}). ` +
        (p.plno ? 'Rád by zůstal, ale v hoře pro něj není místo – prosí aspoň o nocleh.' : 'Prosí o přijetí do klanu.'),
      volby: (hra, p) => p.plno ? ['Dát mu nocleh a jídlo na cestu (−2 jídla, sláva +4)', 'Poslat ho dál'] : ['Přijmout', 'Odmítnout'],
      efekt(hra, p, i) {
        if (p.plno) {
          if (i === 0) { odeber(hra, 'jidlo', 2); slava(hra, 4); return `${p.lide[0].jmeno} přespal u krbu a ráno odešel vyprávět o vaší pohostinnosti.`; }
          return `${p.lide[0].jmeno} pokračoval dál po horách.`;
        }
        if (i === 0) { S.obdobi.prijmi(hra, p.lide); return `${p.lide[0].jmeno} se přidal ke klanu.`; }
        return `${p.lide[0].jmeno} smutně odešel.`;
      },
    },
    hoste: {
      vaha: 0,
      text: (hra, p) => `Sláva hory přivedla skupinu trpaslíků, ale ${p.proc}. Hosté zůstanou na noc na tábořišti a nabízejí dar za pohostinnost.`,
      volby: () => ['Přijmout dar (2 železné pruty a drahokam)', 'Vystrojit hostinu (−6 piv, sláva +10, nálada)', 'Rozloučit se'],
      efekt(hra, p, i) {
        if (i === 0) { uBrany(hra, 'prut_zelezo', 2); uBrany(hra, 'drahokam', 1); return 'Dar leží na tržišti. Hosté odešli hledat jinou horu.'; }
        if (i === 1) { odeber(hra, 'pivo', 6); slava(hra, 10); vsem(hra, 'hostina pro poutníky', 4, 2); return 'Hostina se vydařila – hosté roznesou slávu klanu po horách.'; }
        return 'Hosté odešli hledat jinou horu.';
      },
    },
    migranti: {
      vaha: 0,
      text: (hra, p) => 'Sláva hory se nese krajem. Roklí přišla skupina trpaslíků: ' + p.lide.map(S.obdobi.popisPrichoziho).join(', ') + '. Přijmete je?',
      volby: (hra, p) => p.lide.length > 1 ? ['Přijmout všechny', `Přijmout jen prvního (${p.lide[0].jmeno})`, 'Odmítnout'] : ['Přijmout', 'Odmítnout'],
      efekt(hra, p, i, vyber) {
        if (i === 0 && Array.isArray(vyber) && p.lide.length > 1) {
          const lide = p.lide.filter((l, k) => vyber.includes(k));
          if (!lide.length) return 'Skupina odešla hledat jinou horu.';
          S.obdobi.prijmi(hra, lide);
          return lide.length === p.lide.length ? `Klan se rozrostl o ${lide.length}.` : `${lide.length === 1 ? 'Zůstal' : 'Zůstali'} ${lide.map(l => l.jmeno).join(', ')}, ostatní šli dál.`;
        }
        if (i === 0) { S.obdobi.prijmi(hra, p.lide); return `Klan se rozrostl o ${p.lide.length}.`; }
        if (p.lide.length > 1 && i === 1) { S.obdobi.prijmi(hra, [p.lide[0]]); return `${p.lide[0].jmeno} zůstal, ostatní šli dál.`; }
        return 'Skupina odešla hledat jinou horu.';
      },
    },
  };

  function zacni(hra, id, param) {
    const d = UDALOSTI[id];
    param = param || (d.param ? d.param(hra) : {});
    hra.udalost = { id, param, text: d.text(hra, param), volby: d.volby(hra, param), tik: hra.tik };
  }
  function navrat(hra) {
    const n = hra.odemceno.navrat;
    delete hra.odemceno.navrat;
    if (n.pomohl) { zacni(hra, 'poutnik_navrat', { jmeno: n.jmeno, prof: n.prof, plno: S.obdobi.mistoVKlanu(hra).volno <= 0 }); return; }
    const co = ukradni(hra, 2);
    zprava(hra, co.length ? `🌙 Vyhnaný poutník byl goblinní zvěd! V noci se vrátil s kumpány a ze skladu zmizelo: ${co.join(', ')}.`
      : '🌙 Vyhnaný poutník byl goblinní zvěd – v noci slídil kolem Brány, ale nic neukradl.', 'varovani');
  }
  function tik(hra) {
    if (hra.tik % DEN() !== 150 || hra.udalost || S.obdobi.den(hra) < 3 || !hra.trpaslici.length) return;
    if (hra.odemceno.navrat && hra.tik >= hra.odemceno.navrat.tik) { navrat(hra); return; }
    if (nah(hra) > 0.33) return;
    const mozne = Object.entries(UDALOSTI).filter(([, d]) => d.vaha && d.podminka(hra));
    const soucet = mozne.reduce((s, [, d]) => s + d.vaha, 0);
    let r = nah(hra) * soucet;
    for (const [id, d] of mozne) { r -= d.vaha; if (r < 0) { zacni(hra, id); return; } }
  }
  function vyres(hra, i, vyber) {
    const u = hra.udalost;
    if (!u) return '';
    hra.udalost = null;
    const text = UDALOSTI[u.id].efekt(hra, u.param, i, vyber) || '';
    if (text) zprava(hra, text);
    return text;
  }

  S.udalosti = { UDALOSTI, zacni, tik, vyres, navrat, odeber };
})(SIN);

if (typeof module !== 'undefined') module.exports = SIN;
