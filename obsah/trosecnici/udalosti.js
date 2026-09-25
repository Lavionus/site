/* ============================================================
   Trosečníci – udalosti.js: ranní události, bouře, bedny, nemoci.

   Čistá logika bez DOM.
   - Každé ráno (od 3. dne) je 40% šance na událost z balíčku; po bouři
     přijde vždy něco, co bouře přinesla. Některé události mají volbu –
     ta čeká v s.udalost, dokud ji hráč nerozhodne (přežije i uložení).
   - Bouřlivá noc poškodí stavby (poškozená stavba nefunguje, dokud ji
     někdo neopraví), zničí úrodu a polámá stromy.
   - Nemoc bere 6 ❤️ za noc, dokud nemocného nevyléčí lékař nebo dokud
     neuplyne; odpočinek ji zkrátí.
   - Dočasné účinky (žraloci, hejno ryb) drží s.efekty.
   ============================================================ */
var TROS = globalThis.TROS = globalThis.TROS || {};

(function (T) {
  'use strict';
  const { W, TEREN, CHODIT, SOUSEDE4, idx, uvnitr } = T.svet;
  const { Nahoda, smichej } = T.nahoda;

  const SANCE_UDALOSTI = 0.4;
  const IKONY = { jidlo: '🍖', voda: '💧', drevo: '🪵', kamen: '🪨', vlakna: '🌿', hlina: '🧱', kov: '⚙️', lecivky: '🌱', pochodne: '🔥' };

  const nahoda = (s, sul) => Nahoda(smichej(s.seed, s.den * 97 + sul, 909));
  const osoba = (s, id) => s.lide.find(o => o.id === id);
  const jm = o => o.hrac ? 'Ty' : o.jmeno;
  const a = o => o.rod === 'z' ? 'a' : '';               // koncovka minulého času
  function zisk(s, z) { return T.hra.pridejZasoby(s, z); }
  function popis(z) { return Object.entries(z).filter(([, v]) => v).map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${IKONY[k]}`).join(' ') || 'nic'; }
  function uber(s, k, n) { const v = Math.min(s.zasoby[k], n); s.zasoby[k] -= v; return v; }
  function efekt(s, typ) { return (s.efekty || []).find(e => e.typ === typ && e.do >= s.den); }
  function pridejEfekt(s, e) { (s.efekty = s.efekty || []).push(e); }

  // volné pole na pláži (známé nebo ne), nejlépe daleko od výpravy
  function polePlaze(s, r, podminka) {
    const kand = [];
    for (let i = 0; i < W * W; i++) {
      if (s.svet.teren[i] !== TEREN.PLAZ || s.svet.obj[i] || s.svet.lokNa[i] >= 0 || !s.svet.hlavni[i]) continue;
      if (T.stavby.stavbaNa(s, i) || (s.nalezy || []).some(n => n.x === i % W && n.y === ((i / W) | 0))) continue;
      if ((s.bedny || []).some(b => b.i === i)) continue;
      if (podminka && !podminka(i)) continue;
      kand.push(i);
    }
    return kand.length ? r.vyber(kand) : -1;
  }
  const vzdalenost = (s, i) => Math.abs(i % W - s.hrac.x) + Math.abs(((i / W) | 0) - s.hrac.y);
  const blizkoDomova = (s, i, max) => { const d = T.postavy.domov(s); return Math.max(Math.abs(i % W - d.x), Math.abs(((i / W) | 0) - d.y)) <= max; };

  // nový nález trosečníků (oheň na pobřeží, vrak po bouři)
  function novyNalez(s, r, pocet, popisText) {
    const i = polePlaze(s, r, j => vzdalenost(s, j) >= 12 && !s.mlha[j]) >= 0 ? polePlaze(s, r, j => vzdalenost(s, j) >= 12 && !s.mlha[j])
      : polePlaze(s, r, j => vzdalenost(s, j) >= 8);
    if (i < 0) return null;
    const pouzita = new Set(s.lide.map(o => o.jmeno).concat((s.nalezy || []).flatMap(n => n.lide.map(o => o.jmeno))).concat(s.mrtvi.map(m => m.jmeno)));
    const lide = [];
    for (let k = 0; k < pocet; k++) {
      let o;
      for (let p = 0; p < 30; p++) { o = T.postavy.novaPostava(r, s.dalsiId); if (!pouzita.has(o.jmeno)) break; }
      pouzita.add(o.jmeno); s.dalsiId++;
      lide.push(o);
    }
    const n = { x: i % W, y: (i / W) | 0, lide, stav: 'skryto', popis: popisText, pozdejsi: true };
    s.nalezy.push(n);
    // místo je vidět zdálky (oheň, trosky)
    T.svet.odkryj(s.mlha, n.x, n.y, 1);
    return n;
  }

  // --- balíček událostí --------------------------------------------------------------
  const BALICEK = [
    {
      id: 'prase', ikona: '🐗', nazev: 'Divoké prase v zásobách', vaha: 6,
      kdy: s => s.zasoby.jidlo >= 3,
      priprav: () => ({}),
      text: () => 'V noci se do zásob dostalo divoké prase. Rochní v jídle a nemá v úmyslu odejít.',
      volby: [
        { id: 'honit', text: '🏃 Honit ho (šance na úlovek, ale může zranit)', proved(s, c, r) {
          if (r.sance(0.5)) return 'Po divoké honičce je prase na rožni: ' + popis(zisk(s, { jidlo: 5 })) + '.';
          const v = T.postavy.vedouci(s); v.zdravi = Math.max(1, v.zdravi - 15);
          const ztrata = uber(s, 'jidlo', Math.ceil(s.zasoby.jidlo / 3));
          return `Prase ${v.hrac ? 'tě' : v.jmeno} srazilo kly (−15 ❤️) a uteklo s ${ztrata} 🍖.`;
        } },
        { id: 'nechat', text: '🙈 Nechat ho být', proved(s) { const z = uber(s, 'jidlo', Math.max(2, Math.ceil(s.zasoby.jidlo / 3))); return `Prase se najedlo a odkráčelo. Chybí ${z} 🍖.`; } },
      ],
    },
    {
      id: 'ovoce_botanik', ikona: '🌴', nazev: 'Neznámé ovoce', vaha: 4,
      kdy: s => T.postavy.maProfesi(s, 'botanik'),
      priprav: s => ({ id: s.lide.find(o => o.profese === 'botanik').id }),
      text: (s, c) => `${osoba(s, c.id).jmeno} našl${a(osoba(s, c.id))} v džungli strom s neznámým ovocem – a hned pozná, že je jedlé a výživné.`,
      proved: s => 'Sklizeno: ' + popis(zisk(s, { jidlo: 4, vlakna: 1 })) + '.',
    },
    {
      id: 'ovoce', ikona: '🍈', nazev: 'Neznámé ovoce', vaha: 4,
      kdy: s => !T.postavy.maProfesi(s, 'botanik'),
      priprav: () => ({}),
      text: () => 'Na kraji džungle roste strom plný voňavého fialového ovoce. Nikdo z vás neví, co to je.',
      volby: [
        { id: 'snist', text: '😋 Ochutnat', proved(s, c, r) {
          if (r.sance(0.55)) return 'Je sladké a sytí. ' + popis(zisk(s, { jidlo: 5 })) + '.';
          const o = r.vyber(s.lide); o.zdravi = Math.max(1, o.zdravi - 20);
          return `${o.hrac ? 'Bylo ti' : o.jmeno + ' bylo'} celou noc zle (−20 ❤️). Tohle už nikdo jíst nebude.`;
        } },
        { id: 'nechat', text: '🚫 Radši ne', proved: () => 'Opatrnost je matkou moudrosti. Ovoce necháváte ptákům.' },
      ],
    },
    {
      id: 'zraloci', ikona: '🦈', nazev: 'Žraloci u laguny', vaha: 3,
      kdy: s => !efekt(s, 'zraloci') && (T.stavby.ma(s, 'molo') || s.stat.ulovky > 0),
      priprav: () => ({}),
      text: () => 'Rybáři zahlédli ploutve těsně u břehu. Tři dny bude lepší chytat opatrně.',
      proved(s) { pridejEfekt(s, { typ: 'zraloci', do: s.den + 2 }); return 'Rybaření a molo vynesou 3 dny jen polovinu.'; },
    },
    {
      id: 'hejno', ikona: '🐟', nazev: 'Hejno ryb', vaha: 3,
      kdy: s => !efekt(s, 'hejno'),
      priprav: () => ({}),
      text: () => 'Voda u pobřeží se stříbřitě třpytí – připlulo obrovské hejno sardinek!',
      proved(s) { pridejEfekt(s, { typ: 'hejno', do: s.den + 1 }); return 'Dva dny jsou úlovky o polovinu větší.'; },
    },
    {
      id: 'horecka', ikona: '🤒', nazev: 'Horečka', vaha: 5,
      kdy: s => s.lide.some(o => !nemocny(s, o.id)),
      priprav: (s, r) => ({ id: r.vyber(s.lide.filter(o => !nemocny(s, o.id))).id }),
      text: (s, c) => { const o = osoba(s, c.id); return `${o.hrac ? 'Probudil ses' : T.postavy.kdoACo(o) + ' se probudil' + a(o)} ${o.rod === 'z' ? 'celá rozpálená' : 'celý rozpálený'}. Horečka.`; },
      volby: [
        { id: 'ulozit', text: '🛏️ Uložit na odpočinek', proved(s, c) {
          const o = osoba(s, c.id); if (!o) return 'Pozdě.';
          pridejEfekt(s, { typ: 'nemoc', id: o.id, do: s.den + 2 }); o.zdravi = Math.max(1, o.zdravi - 10);
          let navrat = '';
          if (!o.hrac && o.role !== 'vyprava' && o.role !== 'odpocinek') {
            o.puvodniRole = o.role; o.role = 'odpocinek';
            const Pr = T.postavy.PRACE[o.puvodniRole];
            navrat = ` Přidělen${o.rod === 'z' ? 'a' : ''} na odpočinek – po uzdravení se vrátí k práci: ${Pr.ikona} ${Pr.nazev}.`;
          }
          return `${jm(o)} ${o.hrac ? 'musíš' : 'musí'} ležet (−10 ❤️, nemoc −6 ❤️ za noc).${navrat} Lékař by horečku vyléčil hned.`;
        } },
        { id: 'pracovat', text: '💪 Musí to vydržet', proved(s, c) {
          const o = osoba(s, c.id); if (!o) return 'Pozdě.';
          pridejEfekt(s, { typ: 'nemoc', id: o.id, do: s.den + 4 }); o.zdravi = Math.max(1, o.zdravi - 10);
          return `${jm(o)} ${o.hrac ? 'zatínáš' : 'zatíná'} zuby. Nemoc potrvá déle (−6 ❤️ za noc, 5 nocí).`;
        } },
      ],
    },
    {
      id: 'had', ikona: '🐍', nazev: 'Uštknutí', vaha: 3,
      kdy: s => [s.svet.teren[idx(s.hrac.x, s.hrac.y)]].concat(SOUSEDE4.map(([dx, dy]) => uvnitr(s.hrac.x + dx, s.hrac.y + dy) ? s.svet.teren[idx(s.hrac.x + dx, s.hrac.y + dy)] : -1)).includes(TEREN.DZUNGLE),
      priprav: (s, r) => ({ id: r.vyber(T.postavy.vyprava(s)).id }),
      text: (s, c) => { const o = osoba(s, c.id); return `Ráno v džungli: ${o.hrac ? 'tebe' : o.jmeno} uštkl had.`; },
      proved(s, c) {
        const o = osoba(s, c.id), lekar = T.postavy.maProfesi(s, 'lekar');
        const ztrata = lekar ? 15 : 35;
        o.zdravi = Math.max(1, o.zdravi - ztrata);
        return lekar ? `Lékař ránu vysál a ošetřil (−${ztrata} ❤️).` : `Bez lékaře se jed rozlévá tělem (−${ztrata} ❤️).`;
      },
    },
    {
      id: 'bedna', ikona: '📦', nazev: 'Vyplavená bedna', vaha: 5,
      kdy: s => (s.bedny || []).length < 3,
      priprav(s, r) { const i = polePlaze(s, r, j => blizkoDomova(s, j, 12)); return i < 0 ? null : { i }; },
      text: () => 'Z moře vyplavilo dřevěnou bednu s kováním. Leží na pláži nedaleko.',
      proved(s, c, r) { pridejBednu(s, c.i, r); T.svet.odkryj(s.mlha, c.i % W, (c.i / W) | 0, 1); return 'Bedna je vyznačená na mapě 📦 – dojdi k ní a otevři ji.'; },
    },
    {
      id: 'ohen', ikona: '🔥', nazev: 'Oheň na pobřeží', vaha: 4,
      kdy: s => s.den >= 6 && (s.nalezy || []).filter(n => n.pozdejsi).length < 4,
      priprav: () => ({}),
      text: () => 'V noci byl na vzdáleném pobřeží spatřen oheň. Někdo tam je!',
      proved(s, c, r) {
        const n = novyNalez(s, r, r.sance(0.3) ? 2 : 1, 'U doutnajícího signálního ohně {jm} ({prof}). Když tě uvidí, rozpláče se.');
        return n ? 'Místo je vyznačené na mapě. Pošleš tam výpravu?' : 'Ráno už po ohni nebylo ani stopy.';
      },
    },
    {
      id: 'opice', ikona: '🐒', nazev: 'Opice', vaha: 3,
      kdy: s => s.zasoby.jidlo >= 2,
      priprav: () => ({}),
      text: () => 'Tlupa opic vpadla do tábora a s jekotem utekla s ovocem.',
      proved: s => `Chybí ${uber(s, 'jidlo', 2)} 🍖.`,
    },
    {
      id: 'zelva', ikona: '🐢', nazev: 'Želva', vaha: 3,
      kdy: () => true,
      priprav: () => ({}),
      text: () => 'Na pláž se vyškrábala obrovská mořská želva a naklade vejce.',
      volby: [
        { id: 'vejce', text: '🥚 Vzít pár vajec', proved: s => 'Vejce jsou výborná: ' + popis(zisk(s, { jidlo: 3 })) + '.' },
        { id: 'nechat', text: '🙏 Nechat ji v klidu', proved(s) { s.lide.forEach(o => { o.zdravi = Math.min(100, o.zdravi + 3); }); return 'Dívat se, jak se malé želvy jednou vydají k moři… Všem se trochu uleví (+3 ❤️).'; } },
      ],
    },
    {
      id: 'kmeny', ikona: '🪵', nazev: 'Naplavené kmeny', vaha: 3,
      kdy: () => true, priprav: () => ({}),
      text: () => 'Příliv přinesl na pláž několik velkých kmenů.',
      proved: s => popis(zisk(s, { drevo: 5 })) + '.',
    },
    {
      id: 'komari', ikona: '🦟', nazev: 'Komáři', vaha: 3,
      kdy: s => !T.stavby.ma(s, 'chatrc') && s.pocasi && ['dest', 'polojasno'].includes(s.pocasi.plan[s.den - 1]),
      priprav: () => ({}),
      text: () => 'Po vlhké noci se na tábor snesla mračna komárů. Nikdo se pořádně nevyspal.',
      proved(s) { s.lide.forEach(o => { o.zdravi = Math.max(1, o.zdravi - 5); }); return 'Všichni −5 ❤️. Chatrč s pevnými stěnami by pomohla.'; },
    },
    {
      id: 'unava', ikona: '😴', nazev: 'Únava', vaha: 2,
      kdy: s => s.den >= 5, priprav: () => ({}),
      text: () => 'Výprava se ráno nemůže probrat. Nohy jako z olova.',
      proved(s) { s.ab = Math.max(1, s.ab - 3); return 'Dnes o 3 AB méně.'; },
    },
    {
      id: 'hadka', ikona: '🗯️', nazev: 'Hádka v táboře', vaha: 3,
      kdy: s => s.lide.filter(o => !o.hrac).length >= 2 && s.lide.length >= 4,
      priprav(s, r) { const l = r.zamichej(s.lide.filter(o => !o.hrac)); return { a: l[0].id, b: l[1].id }; },
      text: (s, c) => `${osoba(s, c.a).jmeno} a ${osoba(s, c.b).jmeno} se pohádali kvůli přídělu vody. Málem došlo na pěsti.`,
      volby: [
        { id: 'rozsoudit', text: '⚖️ Rozsoudit je (−2 AB)', proved(s) { s.ab = Math.max(0, s.ab - 2); return 'Po dlouhé debatě si podali ruce.'; } },
        { id: 'nechat', text: '🤷 Ať si to vyřeší', proved(s, c) {
          for (const id of [c.a, c.b]) { const o = osoba(s, id); if (o) o.zdravi = Math.max(1, o.zdravi - 8); }
          return 'Vyřešili to po svém. Oba mají monokl (−8 ❤️).';
        } },
      ],
    },
    {
      id: 'lod', ikona: '⛵', nazev: 'Plachta na obzoru!', vaha: 2,
      kdy: s => s.den >= 12 && (s.posledniLod || -99) + 15 <= s.den && !T.stavby.hori(s), priprav: () => ({}),
      text: () => 'Na obzoru se mihla bílá plachta! Všichni křičí a mávají – loď ale zmizela za mysem.',
      proved(s) {
        s.videlLod = true; s.posledniLod = s.den;
        return T.stavby.ma(s, 'signal') ? 'Signální hranice zrovna nehořela. Příště musí!' : 'Nikdo vás neviděl. Kdyby na pláži hořela velká signální hranice… (nová stavba 🔥)';
      },
    },
    {
      id: 'kameni', ikona: '🪨', nazev: 'Sesuv', vaha: 2,
      kdy: () => true, priprav: () => ({}),
      text: () => 'Z nedalekého srázu se v noci utrhlo kamení.',
      proved: s => popis(zisk(s, { kamen: 4 })) + '.',
    },
    {
      id: 'kokosy', ikona: '🥥', nazev: 'Kokosy dozrály', vaha: 2,
      kdy: s => Object.keys(s.vycerpano).some(i => s.svet.obj[i] === T.svet.OBJ.PALMA && s.vycerpano[i] > s.den),
      priprav: () => ({}),
      text: () => 'Po teplé noci na palmách najednou visí nové kokosy.',
      proved(s) { for (const i in s.vycerpano) if (s.svet.obj[i] === T.svet.OBJ.PALMA) delete s.vycerpano[i]; return 'Všechny palmy se dají znovu česat.'; },
    },
    {
      id: 'duha', ikona: '🌈', nazev: 'Duha', vaha: 3,
      kdy: s => s.pocasi && s.pocasi.plan[s.den - 1] === 'dest', priprav: () => ({}),
      text: () => 'Po dešti se nad lagunou klene dvojitá duha. Na chvíli všichni zapomenou, kde jsou.',
      proved(s) { s.lide.forEach(o => { o.zdravi = Math.min(100, o.zdravi + 5); }); return 'Všichni +5 ❤️.'; },
    },
    {
      id: 'netopyri', ikona: '🦇', nazev: 'Netopýři', vaha: 2,
      kdy: s => s.objevene.some(i => s.svet.lokace[i].typ === 'jeskyne') && !s.videlNetopyry, priprav: () => ({}),
      text: () => 'Za soumraku vylétlo z jeskyně nekonečné hejno netopýrů. Jeskyně musí být obrovská – sahá hluboko pod ostrov.',
      proved(s) { s.videlNetopyry = true; return 'Někdy se tam budete muset podívat. Ale ne bez pochodní.'; },
    },
  ];
  // události kolem stavby lodi (jen když je rozestavěná)
  const stavimeLod = s => !!s.lod && !T.tajemstvi.hotova(s) && (s.lod.dil > 0 || s.lod.zaplaceno);
  const tesar = s => s.lide.some(o => o.profese === 'tesar');
  BALICEK.push(
    { id: 'termiti', ikona: '🐜', nazev: 'Termiti v trupu', vaha: 3,
      kdy: s => stavimeLod(s) && s.lod.prace >= 10, priprav: () => ({}),
      text: () => 'Ráno v rozestavěném trupu šustí – termiti! Pár prken je prolezlých jako houba.',
      proved(s) { const z = tesar(s) ? 5 : 15; s.lod.prace = Math.max(0, s.lod.prace - z); return tesar(s) ? `Tesař napadená prkna rychle vyměnil (−${z} práce).` : `Prkna se musí vyměnit (−${z} práce na lodi).`; } },
    { id: 'kyl_vraku', ikona: '🪵', nazev: 'Kus cizího kýlu', vaha: 2,
      kdy: stavimeLod, priprav: () => ({}),
      text: () => 'Příliv vyvrhl na pláž dlouhý dubový trám z nějakého vraku. Přesně to, co loděnice potřebuje!',
      proved(s) {
        if (s.lod.zaplaceno) { const zpr = T.tajemstvi.pracuj(s, 20); return 'Trám jste zabudovali do lodi (+20 práce).' + (zpr.length ? ' ' + zpr.join(' ') : ''); }
        return 'Trám se hodí na další díl: ' + popis(zisk(s, { drevo: 8 })) + '.';
      } },
    { id: 'spoj', ikona: '💡', nazev: 'Lepší spoj', vaha: 2,
      kdy: s => stavimeLod(s) && s.lod.zaplaceno && tesar(s), priprav: s => ({ id: s.lide.find(o => o.profese === 'tesar').id }),
      text: (s, c) => `${osoba(s, c.id).jmeno} celou noc vyřezával a ráno ukazuje nový způsob, jak spojit žebra trupu.`,
      proved(s) { const zpr = T.tajemstvi.pracuj(s, 15); return 'Práce jde rychleji (+15 práce).' + (zpr.length ? ' ' + zpr.join(' ') : ''); } },
    { id: 'slavnost', ikona: '🎉', nazev: 'Loď roste', vaha: 2,
      kdy: s => stavimeLod(s) && s.lod.dil >= 2 && s.lide.length >= 3, priprav: () => ({}),
      text: () => 'Trup už vypadá jako opravdová loď. Lidé se u ní večer scházejí a nahlas plánují, co udělají doma.',
      volby: [
        { id: 'slavit', text: '🎉 Uspořádat slavnost (−1 🍖 na osobu, všichni +8 ❤️)', proved(s) {
          const z = uber(s, 'jidlo', s.lide.length); s.lide.forEach(o => { o.zdravi = Math.min(100, o.zdravi + 8); });
          return `U ohně se zpívalo dlouho do noci (−${z} 🍖, všichni +8 ❤️).`;
        } },
        { id: 'pracovat', text: '🔨 Radši pracovat (+10 práce na lodi)', proved(s) {
          if (!s.lod.zaplaceno) return 'Na lodi teď není co dělat – nejdřív je potřeba připravit materiál.';
          const zpr = T.tajemstvi.pracuj(s, 10); return 'Všichni ještě hodinu tesali za svitu pochodní (+10 práce).' + (zpr.length ? ' ' + zpr.join(' ') : '');
        } },
      ] },
  );

  // záchrana projíždějící lodí – jen když hoří signální hranice
  const ZACHRANA = { id: 'zachrana', ikona: '🚢', nazev: 'Loď vás vidí!', vaha: 0,
    kdy: () => false, priprav: () => ({}),
    text: () => 'Kouř ze signální hranice stoupá k nebi – a obchodní loď na obzoru mění kurz! Za hodinu kotví v zátoce a kapitán posílá člun: „Vezmeme vás všechny."',
    volby: [
      { id: 'nastoupit', text: '🚢 Nastoupit a odplout domů', proved(s) {
        s.konec = { typ: 'zachranen', den: s.den, lidi: s.lide.length, jmena: s.lide.map(o => o.hrac ? 'Ty' : o.jmeno), tajemstvi: !!(s.tajemstvi && s.tajemstvi.dvere) };
        return 'Nastoupili jste. Ostrov se ztrácí za obzorem…';
      } },
      { id: 'zustat', text: '🏝️ Poděkovat a zůstat', proved: s => 'Kapitán nevěřícně kroutí hlavou, ale nechá vám sud vody a odpluje (' + popis(zisk(s, { voda: 10 })) + '). Ostrov vás ještě nepustil.' },
    ] };
  const SANCE_ZACHRANY = 0.015, ZACHRANA_OD = 50;

  // co přinese bouře (ráno po bouřlivé noci)
  const PO_BOURI = [
    { id: 'vrak_boure', ikona: '🚢', nazev: 'Bouře přinesla vrak', vaha: 3,
      kdy: s => (s.nalezy || []).filter(n => n.pozdejsi).length < 4, priprav: () => ({}),
      text: () => 'Když se bouře utišila, leží na útesech trosky cizí lodi. Na pláži se něco hýbe!',
      proved(s, c, r) {
        const n = novyNalez(s, r, r.cele(1, 3), 'Z trosek cizí lodi se vypotáceli: {jmena}. Promočení a vyděšení.');
        return n ? `Místo je vyznačené na mapě (${n.lide.length} ${n.lide.length === 1 ? 'člověk' : 'lidé'}).` : 'Trosky ale moře zase odneslo.';
      } },
    { id: 'bedna_boure', ikona: '📦', nazev: 'Bouře vyplavila bednu', vaha: 2,
      kdy: s => (s.bedny || []).length < 3,
      priprav(s, r) { const i = polePlaze(s, r, j => blizkoDomova(s, j, 12)); return i < 0 ? null : { i }; },
      text: () => 'Bouře vyvrhla na pláž bednu z nějakého vraku.',
      proved(s, c, r) { pridejBednu(s, c.i, r); T.svet.odkryj(s.mlha, c.i % W, (c.i / W) | 0, 1); return 'Je vyznačená na mapě 📦.'; } },
  ];
  const VSE = BALICEK.concat(PO_BOURI, [ZACHRANA]);

  // --- bedny -----------------------------------------------------------------------------
  const OBSAH_BEDNY = [
    { vaha: 3, text: 'Konzervy s masem!', zisk: { jidlo: 6 } },
    { vaha: 2, text: 'Smotky lan a plachtoviny.', zisk: { vlakna: 6 } },
    { vaha: 2, text: 'Prkna a hřebíky.', zisk: { drevo: 6 } },
    { vaha: 2, text: 'Nepromokavá plachta – poslouží k chytání deště.', predmet: 'plachta' },
    { vaha: 1, text: 'Lodní kompas v mosazném pouzdře.', predmet: 'kompas' },
    { vaha: 2, text: 'Lékárnička! Obvazy a lahvička jódu.', lekarnicka: true },
    { vaha: 2, text: 'Kovové kování a kus řetězu.', zisk: { kov: 3 } },
  ];
  function pridejBednu(s, i, r) {
    const volne = OBSAH_BEDNY.filter(o => !o.predmet || !s.predmety.includes(o.predmet) && !(s.bedny || []).some(b => b.obsah === OBSAH_BEDNY.indexOf(o)));
    let x = r.dalsi() * volne.reduce((a, o) => a + o.vaha, 0), vybrana = volne[0];
    for (const o of volne) { x -= o.vaha; if (x < 0) { vybrana = o; break; } }
    (s.bedny = s.bedny || []).push({ i, obsah: OBSAH_BEDNY.indexOf(vybrana) });
  }
  function otevriBednu(s, i) {
    const k = (s.bedny || []).findIndex(b => b.i === i);
    if (k < 0) return null;
    const o = OBSAH_BEDNY[s.bedny[k].obsah];
    s.bedny.splice(k, 1);
    let text = 'V bedně: ' + o.text;
    if (o.zisk) text += ' ' + popis(zisk(s, o.zisk)) + '.';
    if (o.predmet && !s.predmety.includes(o.predmet)) { s.predmety.push(o.predmet); text += ` (${T.hra.PREDMETY[o.predmet].ikona} ${T.hra.PREDMETY[o.predmet].nazev})`; }
    if (o.lekarnicka) { s.lide.forEach(x => { x.zdravi = Math.min(100, x.zdravi + 15); }); s.efekty = (s.efekty || []).filter(e => e.typ !== 'nemoc'); text += ' Všichni +15 ❤️ a nemoci jsou pryč.'; }
    return text;
  }

  // --- nemoc -------------------------------------------------------------------------------
  function nemocny(s, id) { return (s.efekty || []).some(e => e.typ === 'nemoc' && e.id === id && e.do >= s.den); }
  /* noční vliv nemoci na člověka: vrací změnu zdraví a případnou zprávu */
  function nemocVNoci(s, o) {
    const e = (s.efekty || []).find(x => x.typ === 'nemoc' && x.id === o.id && x.do >= s.den);
    if (!e) return { zmena: 0 };
    const vTabore = o.role !== 'vyprava' || T.postavy.vypravaDoma(s);
    const lekar = s.lide.some(l => l.profese === 'lekar' && l !== o && (l.role === 'lecit' || (l.role === 'vyprava' && o.role === 'vyprava')))
      && (vTabore || o.role === 'vyprava');
    if (lekar) { e.do = -1; return { zmena: 0, zprava: `Lékař vyléčil ${o.hrac ? 'tvou' : 'u ' + o.jmeno} horečku.` }; }
    if (vTabore && T.stavby.ma(s, 'osetrovna') && s.zasoby.lecivky >= 1) {
      s.zasoby.lecivky--; e.do = -1;
      return { zmena: 0, zprava: `V ošetřovně ${o.hrac ? 'jsi' : o.jmeno} dostal${o.hrac ? '' : (o.rod === 'z' ? 'a' : '')} odvar z léčivek a horečka je pryč (−1 🌱).` };
    }
    if (o.role === 'odpocinek' && e.do > s.den) e.do--;              // odpočinek zkrátí nemoc
    const z = s.predmety.includes('amulet') ? -3 : -6;
    if (e.do <= s.den) return { zmena: z, zprava: `${o.hrac ? 'Tvoje horečka' : 'Horečka u ' + o.jmeno} polevila.` };
    return { zmena: z };
  }

  // --- bouřlivá noc -------------------------------------------------------------------------
  const POSKOZENI = { pristresek: 0.5, chatrc: 0.1, molo: 0.4, sberac: 0.25 };
  function bourkovaNoc(s) {
    const r = nahoda(s, 7), zpravy = [];
    const znicene = [];
    for (const b of s.stavby) {
      if (POSKOZENI[b.typ] && !b.poskozeno && r.sance(POSKOZENI[b.typ])) { b.poskozeno = true; znicene.push(T.stavby.STAVBY[b.typ].nazev.toLowerCase()); }
      if (b.typ === 'policko' && r.sance(0.5)) { b.zraje = Math.max(b.zraje, s.den + 1 + 4); znicene.push('úroda na políčku'); }
    }
    if (znicene.length) zpravy.push('Bouře poškodila: ' + [...new Set(znicene)].join(', ') + '. Poškozené stavby je třeba opravit.');
    else if (s.stavby.length) zpravy.push('Stavby bouři ustály.');
    // polámané stromy: kolem tábora leží dřevo a klacky jsou zase všude
    for (const i in s.vycerpano) if ([TEREN.PLAZ, TEREN.DZUNGLE].includes(s.svet.teren[i]) && !s.svet.obj[i]) delete s.vycerpano[i];
    const z = zisk(s, { drevo: 4 });
    if (z.drevo) zpravy.push(`Polámané větve kolem tábora: +${z.drevo} 🪵.`);
    if (s.lod && s.lod.zaplaceno && !T.tajemstvi.hotova(s) && s.lod.prace > 0 && r.sance(0.4)) {
      const ztrata = Math.min(s.lod.prace, 20); s.lod.prace -= ztrata;
      zpravy.push(`Vítr strhl část lešení u lodi (−${ztrata} práce).`);
    }
    for (const b of s.stavby) if (b.typ === 'signal' && (b.hori || 0) >= s.den) { b.hori = s.den - 1; zpravy.push('Déšť uhasil signální hranici.'); }
    return zpravy;
  }

  // --- ráno -----------------------------------------------------------------------------------
  function vyber(s, r, seznam) {
    const moz = seznam.filter(u => u.kdy(s));
    let celkem = moz.reduce((a, u) => a + u.vaha, 0);
    while (moz.length) {
      let x = r.dalsi() * celkem, u = moz[0];
      for (const k of moz) { x -= k.vaha; if (x < 0) { u = k; break; } }
      const c = u.priprav(s, r);
      if (c) return { u, c };
      moz.splice(moz.indexOf(u), 1); celkem -= u.vaha;
    }
    return null;
  }
  /* Ranní událost. Vrací {ikona, nazev, text, vysledek?, volby?} nebo null. */
  function rano(s, poBouri) {
    if (s.udalost || s.den < 3 || !s.lide.length) return null;
    const r = nahoda(s, 1);
    // hořící hranice: šance, že si vás všimne projíždějící loď
    if (T.stavby.hori(s) && s.den >= ZACHRANA_OD && !poBouri && r.sance(SANCE_ZACHRANY)) {
      const text = ZACHRANA.text(s);
      s.udalost = { id: 'zachrana', ctx: {}, text };
      return { ikona: ZACHRANA.ikona, nazev: ZACHRANA.nazev, text, volby: ZACHRANA.volby.map(o => ({ id: o.id, text: o.text })) };
    }
    if (!poBouri && !r.sance(SANCE_UDALOSTI)) return null;
    const v = vyber(s, r, poBouri ? PO_BOURI : BALICEK);
    if (!v) return null;
    const { u, c } = v;
    const text = u.text(s, c);
    if (u.volby) {
      s.udalost = { id: u.id, ctx: c, text };
      return { ikona: u.ikona, nazev: u.nazev, text, volby: u.volby.map(o => ({ id: o.id, text: o.text })) };
    }
    const vysledek = u.proved(s, c, nahoda(s, 2));
    return { ikona: u.ikona, nazev: u.nazev, text, vysledek };
  }
  function cekajici(s) {
    if (!s.udalost) return null;
    const u = VSE.find(x => x.id === s.udalost.id);
    return { ikona: u.ikona, nazev: u.nazev, text: s.udalost.text, volby: u.volby.map(o => ({ id: o.id, text: o.text })) };
  }
  function vyres(s, volba) {
    if (!s.udalost) return { ok: false, duvod: 'Není co rozhodovat.' };
    const u = VSE.find(x => x.id === s.udalost.id), o = u && u.volby.find(k => k.id === volba);
    if (!o) return { ok: false, duvod: 'Neznámá volba.' };
    const text = o.proved(s, s.udalost.ctx, nahoda(s, 3));
    const u0 = s.udalost; s.udalost = null;
    return { ok: true, text, ikona: u.ikona, nazev: u.nazev, puvodni: u0.text };
  }

  T.udalosti = { ZACHRANA, SANCE_ZACHRANY, ZACHRANA_OD, BALICEK, PO_BOURI, OBSAH_BEDNY, SANCE_UDALOSTI, rano, cekajici, vyres, bourkovaNoc, nemocVNoci, nemocny, efekt,
    otevriBednu, pridejBednu, novyNalez };
})(TROS);

if (typeof module !== 'undefined') module.exports = TROS;
