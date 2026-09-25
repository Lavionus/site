/* ============================================================
   Trosečníci – stavby.js: tábor, stavby a jejich účinky.

   Čistá logika bez DOM. Stavba stojí na poli, kde trosečník stojí
   (pole musí být volné – bez stromu, balvanu a lokace). První stavbou
   je vždy ohniště: založí tábor a většina dalších staveb musí stát
   nejvýš 5 polí od něj. Molo stojí na pláži u moře nebo laguny a
   jeho lávka vede na sousední vodu.

   Každá stavba má připravené pole `pracovnik` – přidělování lidí
   na práci přijde s dalšími trosečníky (etapa 4).
   ============================================================ */
var TROS = globalThis.TROS = globalThis.TROS || {};

(function (T) {
  'use strict';
  const { W, TEREN, SOUSEDE4, idx, uvnitr } = T.svet;

  const DOSAH_TABORA = 5;

  const STAVBY = {
    ohniste: { ikona: '🔥', nazev: 'Ohniště', cena: { drevo: 3, kamen: 2 }, ab: 2, max: 1,
      popis: 'Založí tábor. V táboře se dá vařit – každý úlovek z moře a řeky dá +1 🍖. Kdo spí u ohně, nabere +2 ❤️.' },
    pristresek: { ikona: '⛺', nazev: 'Přístřešek', cena: { drevo: 4, vlakna: 4 }, ab: 3, vTabore: true,
      popis: 'Střecha z palmového listí. Kdo pod ní spí, nabere +5 ❤️.' },
    chatrc: { ikona: '🛖', nazev: 'Chatrč', cena: { drevo: 8, kamen: 4, vlakna: 6 }, ab: 5, vylepsuje: 'pristresek', predmet: 'sekera',
      popis: 'Pevné stěny a dveře místo přístřešku. Spánek +10 ❤️. Postaví se na místě přístřešku.' },
    sberac: { ikona: '🪣', nazev: 'Sběrač dešťové vody', cena: { drevo: 4, vlakna: 3 }, ab: 3, max: 3, vTabore: true,
      popis: '+4 místa na vodu a každou noc +1 💧 z rosy a přeháněk.' },
    molo: { ikona: '🎣', nazev: 'Rybářské molo', cena: { drevo: 6, vlakna: 2 }, ab: 4, max: 2,
      popis: 'Na pláži u moře nebo laguny. Z mola se rybaří jistěji a úlovky jsou větší (2 AB).' },
    sklad: { ikona: '📦', nazev: 'Sklad', cena: { drevo: 6, kamen: 4 }, ab: 3, max: 2, vTabore: true,
      popis: 'Víc místa na zásoby: +20 🍖, +25 🪵, +20 🪨, +20 🌿.' },
    policko: { ikona: '🌾', nazev: 'Políčko', cena: { drevo: 2, vlakna: 2 }, ab: 3, max: 4, vTabore: true,
      popis: 'Zasadíš divoké hlízy. Po 6 dnech první sklizeň (+5 🍖), pak každé 4 dny.' },
    pec: { ikona: '🧱', nazev: 'Hliněná pec', cena: { hlina: 5, kamen: 3 }, ab: 3, max: 1, vTabore: true, objev: 'hlina',
      popis: 'Vypaluje hlínu na cihly a nádoby. Bez pece není nádrž ani kovárna.' },
    nadrz: { ikona: '🛢️', nazev: 'Cihlová nádrž', cena: { hlina: 6, kamen: 2 }, ab: 4, max: 2, vTabore: true, objev: 'hlina', stavba: 'pec',
      popis: '+12 místa na vodu; každou noc +1 💧, v dešti +4. Bouři vydrží.' },
    kovarna: { ikona: '⚒️', nazev: 'Kovárna', cena: { kamen: 6, hlina: 4, drevo: 4 }, ab: 4, max: 1, vTabore: true, objev: 'kovarstvi', stavba: 'pec',
      popis: 'Kuje udice, krumpáče, nářadí i sekeru. Taví rudu ze sopky na kov.' },
    osetrovna: { ikona: '🏥', nazev: 'Ošetřovna', cena: { drevo: 6, vlakna: 4, lecivky: 3 }, ab: 4, max: 1, vTabore: true, objev: 'lecivky',
      popis: 'Odpočinek v táboře +10 ❤️ navíc, lékař léčí za dva. Horečku v táboře vyléčí za 1 🌱.' },
    dilna: { ikona: '🔨', nazev: 'Dílna', cena: { drevo: 8, kamen: 4 }, ab: 4, max: 1, vTabore: true, objev: 'remeslo',
      popis: 'Ponk a nářadí: sítě, hliněné nádoby a pochodně.' },
    rozhledna: { ikona: '🗼', nazev: 'Rozhledna', cena: { drevo: 10, vlakna: 4 }, ab: 5, max: 1, objev: 'vyhled',
      popis: 'Vysoká věž, odkud je vidět do okruhu 14 polí – mlha zmizí.' },
    lodenice: { ikona: '⛵', nazev: 'Loděnice', cena: { drevo: 10, vlakna: 4 }, ab: 4, max: 1, objev: 'remeslo',
      popis: 'Skluz na pláži u moře. Tady vznikne loď, která vás odveze domů.' },
    signal: { ikona: '🔥', nazev: 'Signální hranice', cena: { drevo: 8, vlakna: 2 }, ab: 2, max: 1, odemceno: s => s.den >= 12 || !!s.videlLod,
      popis: 'Velká hranice na pláži nebo skalách. Když hoří, projíždějící loď vás může zahlédnout (od 50. dne). Přiložit: 4 🪵 na 3 dny.' },
    pila: { ikona: '🪚', nazev: 'Pila', cena: { drevo: 6, kamen: 4 }, ab: 4, max: 1, vTabore: true, predmet: 'sekera', predmet2: 'srot',
      popis: 'Kovový list ze šrotu z vraku. Kácení dá +2 🪵 a každá stavba stojí o 1 AB méně.' },
  };
  const PORADI = ['ohniste', 'pristresek', 'chatrc', 'sberac', 'molo', 'sklad', 'policko', 'pila', 'pec', 'nadrz', 'kovarna', 'osetrovna', 'dilna', 'rozhledna', 'lodenice', 'signal'];

  // limity zásob (bez skladu / za každý sklad)
  const KAPACITA = { jidlo: 10, drevo: 15, kamen: 12, vlakna: 12, hlina: 12, kov: 10, lecivky: 10, pochodne: 20 };
  const KAPACITA_SKLAD = { jidlo: 20, drevo: 25, kamen: 20, vlakna: 20, hlina: 15, kov: 10, lecivky: 10, pochodne: 0 };
  const POLICKO_PRVNI = 6, POLICKO_DALSI = 4, POLICKO_UROD = 5;

  // --- dotazy -------------------------------------------------------------------------
  const seznam = s => s.stavby || (s.stavby = []);
  function stavbaNa(s, i) { return seznam(s).find(b => b.i === i) || null; }
  function pocet(s, typ) { return seznam(s).filter(b => b.typ === typ).length; }
  function ma(s, typ) { return seznam(s).some(b => b.typ === typ); }
  function ohniste(s) { return seznam(s).find(b => b.typ === 'ohniste') || null; }
  function vTabore(s, x, y) {
    const o = ohniste(s);
    return !!o && Math.max(Math.abs(o.i % W - x), Math.abs(((o.i / W) | 0) - y)) <= DOSAH_TABORA;
  }
  function kapacita(s, k) {
    const sklady = pocet(s, 'sklad');
    if (k === 'voda') return (s.predmety.includes('lahev') ? 4 : 0) + (s.predmety.includes('sud') ? 6 : 0) + (s.predmety.includes('plachta') ? 5 : 0)
      + 4 * pocet(s, 'sberac') + 12 * pocet(s, 'nadrz') + 4 * (s.nadoby || 0);
    return KAPACITA[k] + sklady * KAPACITA_SKLAD[k];
  }
  // sousední voda pro molo (index směru 0–3 nebo -1)
  function smerKVode(s, x, y) {
    for (let k = 0; k < 4; k++) {
      const nx = x + SOUSEDE4[k][0], ny = y + SOUSEDE4[k][1];
      if (!uvnitr(nx, ny)) continue;
      const t = s.svet.teren[idx(nx, ny)];
      if ((t === TEREN.MORE || t === TEREN.LAGUNA) && s.svet.lokNa[idx(nx, ny)] < 0) return k;   // ne na vrak
    }
    return -1;
  }
  function ulevaPily(s) { return (ma(s, 'pila') ? 1 : 0) + (s.predmety.includes('naradi') ? 1 : 0); }
  function abStavby(s, typ) {
    let ab = STAVBY[typ].ab;
    if (T.postavy && s.lide && T.postavy.maProfesi(s, 'tesar', 'vyprava')) ab = Math.ceil(ab * 2 / 3);
    return Math.max(1, ab - ulevaPily(s));
  }

  function popisCeny(c) {
    const ik = { drevo: '🪵', kamen: '🪨', vlakna: '🌿', jidlo: '🍖', voda: '💧', hlina: '🧱', kov: '⚙️', lecivky: '🌱', pochodne: '🔥' };
    return Object.entries(c).map(([k, v]) => `${v} ${ik[k]}`).join(' ');
  }

  // proč se stavba typu `typ` nedá postavit tam, kde trosečník stojí (null = dá)
  function prekazka(s, typ) {
    const B = STAVBY[typ], { x, y } = s.hrac, i = idx(x, y);
    const t = s.svet.teren[i], stoji = stavbaNa(s, i);
    if (B.objev && !(s.objevy || []).includes(B.objev)) return 'Zatím nevíš jak.';
    if (B.odemceno && !B.odemceno(s)) return 'Zatím tě to nenapadlo.';
    if (B.stavba && !ma(s, B.stavba)) return `Nejdřív postav: ${STAVBY[B.stavba].nazev.toLowerCase()}.`;
    for (const p of [B.predmet, B.predmet2]) {
      if (p && !s.predmety.includes(p)) {
        const P = T.hra.PREDMETY[p];
        const kde = p === 'sekera' ? (ma(s, 'kovarna') ? ' Vykovej ji v kovárně.' : ' Leží prý v opuštěném táboře – nebo si ji jednou vykováš.') : '';
        return `Potřebuješ ${P.akuzativ || P.nazev.toLowerCase()} ${P.ikona}.${kde}`;
      }
    }
    if (B.vylepsuje) {
      if (!stoji || stoji.typ !== B.vylepsuje) return `Stav na místě přístřešku – postav se k němu.`;
    } else {
      if (B.max && pocet(s, typ) >= B.max) return `Víc než ${B.max} ${B.max === 1 ? 'nepotřebuješ' : 'jich nepostavíš'}.`;
      if (stoji) return 'Tady už stojí ' + STAVBY[stoji.typ].nazev.toLowerCase() + '.';
      if (s.svet.lokNa[i] >= 0) return 'Tohle místo je třeba nechat, jak je.';
      if (s.svet.obj[i]) return 'Pole musí být volné – nejdřív odstraň ' + T.svet.OBJ_INFO[s.svet.obj[i]].nazev.toLowerCase() + '.';
      if (t === TEREN.REKA) return 'Do řeky se stavět nedá.';
      if (typ === 'molo') { if (t !== TEREN.PLAZ || smerKVode(s, x, y) < 0) return 'Molo patří na pláž hned u moře nebo laguny.'; }
      if (typ === 'lodenice') { if (t !== TEREN.PLAZ || smerKVode(s, x, y) < 0) return 'Loděnice patří na pláž hned u moře.'; }
      if (typ === 'signal') { if (t !== TEREN.PLAZ && t !== TEREN.SKALY) return 'Hranici je potřeba vidět z moře – na pláži nebo na skalách.'; }
      if (typ === 'policko' && t !== TEREN.SAVANA && t !== TEREN.DZUNGLE) return 'Hlízy porostou jen v savaně nebo džungli.';
      if (typ !== 'ohniste' && B.vTabore) {
        if (!ohniste(s)) return 'Nejdřív založ tábor – postav ohniště.';
        if (!vTabore(s, x, y)) return `Musí to být v táboře – nejvýš ${DOSAH_TABORA} polí od ohniště.`;
      }
    }
    const chybi = {};
    for (const k in B.cena) if ((s.zasoby[k] || 0) < B.cena[k]) chybi[k] = B.cena[k] - (s.zasoby[k] || 0);
    if (Object.keys(chybi).length) return 'Ještě chybí ' + popisCeny(chybi) + '.';
    if (s.ab < abStavby(s, typ)) return `Potřeba ${abStavby(s, typ)} AB, zbývá ${s.ab}.`;
    return null;
  }

  // co jde stavět tam, kde trosečník stojí: [{typ, ikona, nazev, cena, ab, duvod}]
  function moznosti(s) {
    if (s.konec) return [];
    const stoji = stavbaNa(s, idx(s.hrac.x, s.hrac.y));
    return PORADI
      .filter(typ => !STAVBY[typ].objev || (s.objevy || []).includes(STAVBY[typ].objev))   // co neznáš, to nevidíš
      .filter(typ => !STAVBY[typ].odemceno || STAVBY[typ].odemceno(s))
      .filter(typ => STAVBY[typ].vylepsuje ? stoji && stoji.typ === STAVBY[typ].vylepsuje : !stoji)
      .map(typ => ({ typ, ikona: STAVBY[typ].ikona, nazev: STAVBY[typ].nazev, popis: STAVBY[typ].popis,
        cena: popisCeny(STAVBY[typ].cena), ab: abStavby(s, typ), duvod: prekazka(s, typ) }));
  }

  function postav(s, typ) {
    if (!STAVBY[typ]) return { ok: false, duvod: 'Neznámá stavba.' };
    if (s.konec) return { ok: false, duvod: 'Hra skončila.' };
    const d = prekazka(s, typ);
    if (d) return { ok: false, duvod: d };
    const B = STAVBY[typ], { x, y } = s.hrac, i = idx(x, y);
    for (const k in B.cena) s.zasoby[k] -= B.cena[k];
    s.ab -= abStavby(s, typ);
    if (B.vylepsuje) {
      const b = stavbaNa(s, i);
      b.typ = typ; b.den = s.den;
    } else {
      const b = { typ, i, den: s.den, pracovnik: null };
      if (typ === 'molo' || typ === 'lodenice') b.smer = smerKVode(s, x, y);
      if (typ === 'lodenice') s.lod = { dil: 0, prace: 0, zaplaceno: false };
      if (typ === 'policko') b.zraje = s.den + POLICKO_PRVNI;
      seznam(s).push(b);
    }
    let navic = '';
    if (typ === 'rozhledna') { const n = T.svet.odkryj(s.mlha, x, y, 14); navic = ` Z vrcholu vidíš ${n} nových polí.`; }
    const text = {
      ohniste: 'Postavil jsi ohniště z kamenů a naplaveného dříví. Tady bude tábor.',
      pristresek: 'Ze tří tyčí a palmového listí vznikl přístřešek. Konečně střecha nad hlavou.',
      chatrc: 'Přístřešek jsi přestavěl na chatrč s pevnými stěnami a dveřmi.',
      sberac: 'Vyhloubený kmen a trychtýř z listů – sběrač dešťové vody je hotový.',
      molo: 'Zatloukl jsi kůly do písku a položil přes ně lávku. Molo!',
      sklad: 'Postavil jsi sklad s policemi a stříškou.',
      policko: `Vyčistil jsi kus země a zasadil divoké hlízy. Sklizeň za ${POLICKO_PRVNI} dní.`,
      pila: 'Z kusů kování jsi vyklepal pilový list a upevnil ho do rámu. Pila je hotová.',
      pec: 'Z hlíny a kamenů jsi postavil klenutou pec. První vypálená cihla zvoní jako zvon.',
      nadrz: 'Cihlová nádrž s omítnutým dnem je hotová – teď se dá schovat opravdu hodně vody.',
      kovarna: 'Výheň, měch z kůže a kamenná kovadlina. Kovárna žhne!',
      osetrovna: 'Ošetřovna s lůžky z listí a zásobou bylin. Nemocní budou mít kde ležet.',
      dilna: 'Dílna s ponkem a policí na nářadí je hotová.',
      rozhledna: 'Postavil jsi rozhlednu z kmenů a lan.',
      signal: 'Na otevřeném místě stojí vysoká hranice z kmenů a suchého listí. Stačí přiložit a zapálit.',
      lodenice: 'Na pláži stojí skluz z kmenů a podpěry. Tady se postaví loď! Díly lodi připravíš a stavíš přímo na loděnici.',
    }[typ] + navic;
    return { ok: true, text };
  }

  // --- noc: pasivní výroba a spánek ---------------------------------------------------------
  /* Kolik vody přinesou v noci sběrače, nádrže, déšť a džbán (nic nemění).
     { plne: true } = bouře naplní všechny nádoby; jinak { voda, dzban } k přičtení (limit kapacity). */
  function vodaNaNoc(s) {
    const pocasi = T.pocasi && s.pocasi ? T.pocasi.dnes(s) : null;
    if (pocasi === 'boure') return { plne: true, voda: 0, dzban: 0, pocasi };
    const sberace = seznam(s).filter(b => b.typ === 'sberac' && !b.poskozeno).length;
    const nadrze = pocet(s, 'nadrz');
    const voda = pocasi === 'vedro' ? 0 : pocasi === 'dest' ? 3 * sberace + 4 * nadrze + 2 + (s.predmety.includes('plachta') ? 2 : 0) : sberace + nadrze;
    return { plne: false, voda, dzban: s.predmety.includes('dzban') ? 2 : 0, pocasi, sberace, nadrze };
  }

  function noc(s) {
    const zpravy = [];
    const vn = vodaNaNoc(s), pocasi = vn.pocasi;
    const sberace = vn.sberace || 0, nadrze = vn.nadrze || 0;
    const pred = s.zasoby.voda;
    if (vn.plne) {
      s.zasoby.voda = kapacita(s, 'voda');
      if (s.zasoby.voda > pred) zpravy.push(`Bouře naplnila všechny nádoby vodou (+${s.zasoby.voda - pred} 💧).`);
    } else {
      const voda = vn.voda;
      if (voda) {
        s.zasoby.voda = Math.min(kapacita(s, 'voda'), s.zasoby.voda + voda);
        const n = s.zasoby.voda - pred;
        if (n) zpravy.push(pocasi === 'dest' ? `Déšť: do nádob nateklo ${n} 💧.` : `${sberace + nadrze === 1 ? (nadrze ? 'Nádrž zachytila' : 'Sběrač zachytil') : 'Sběrače a nádrže zachytily'} ${n} 💧.`);
      } else if (pocasi === 'vedro' && sberace + nadrze) zpravy.push('Ve vedru sběrače zůstaly suché.');
    }
    if (pocasi === 'dest') for (const b of seznam(s)) if (b.typ === 'signal' && (b.hori || 0) >= s.den) { b.hori = s.den - 1; zpravy.push('Déšť uhasil signální hranici.'); }
    if (vn.dzban) {
      const p2 = s.zasoby.voda;
      s.zasoby.voda = Math.min(kapacita(s, 'voda'), s.zasoby.voda + vn.dzban);
      if (s.zasoby.voda > p2) zpravy.push(`Džbán deště se naplnil (+${s.zasoby.voda - p2} 💧).`);
    }
    const zrale = seznam(s).filter(b => b.typ === 'policko' && b.zraje === s.den + 1).length;
    if (zrale) zpravy.push(zrale === 1 ? 'Na políčku dozrály hlízy – můžeš sklízet.' : `Na ${zrale} políčkách dozrály hlízy.`);
    return { zpravy, spanek: bonusSpanku(s) };
  }
  // nejlepší úkryt v okolí 1 pole + oheň
  function bonusSpanku(s) {
    let strecha = 0, ohen = 0, kde = null;
    for (const b of seznam(s)) {
      const d = Math.max(Math.abs(b.i % W - s.hrac.x), Math.abs(((b.i / W) | 0) - s.hrac.y));
      if (d > 1) continue;
      if (b.typ === 'chatrc' && strecha < 10) { strecha = 10; kde = 'v chatrči'; }
      if (b.typ === 'pristresek' && strecha < 5) { strecha = 5; kde = 'v přístřešku'; }
      if (b.typ === 'ohniste') ohen = 2;
    }
    return { bonus: strecha + ohen, kde, ohen: !!ohen };
  }

  // --- akce u staveb (připojí se k akcím v hra.js) ------------------------------------------
  const AKCE = [
    {
      id: 'molo_ryby', ikona: '🎣', nazev: 'Rybařit z mola', ab: 2,
      kde: (s, i) => { const b = stavbaNa(s, i); return !!b && b.typ === 'molo'; },
      proc: (s, i) => stavbaNa(s, i).poskozeno ? 'Molo je poškozené – oprav ho.' : null,
      proved(s, i, x, y, h) {
        const r = h.nahoda(s);
        const zraloci = T.udalosti && T.udalosti.efekt(s, 'zraloci'), hejno = T.udalosti && T.udalosti.efekt(s, 'hejno');
        if (!r.sance((s.predmety.includes('ostep') ? 0.9 : 0.8) * (zraloci ? 0.5 : 1))) return zraloci ? 'Žraloci plaší ryby. Nic.' : 'Z mola dnes nic nezabralo.';
        s.stat.ulovky++;
        const n = (s.predmety.includes('udice') ? 1 : 0) + (s.predmety.includes('trojzubec') ? 1 : 0) + (s.predmety.includes('site') ? 1 : 0) + Math.round(r.cele(3, 4) * (hejno ? 1.5 : 1) * (T.postavy && s.lide && T.postavy.maProfesi(s, 'rybar', 'vyprava') ? 1.5 : 1)) + (ma(s, 'ohniste') ? 1 : 0);
        return `Z mola jsi vytáhl ${r.vyber(['tuňáka', 'makrelu', 'dva kanice', 'mahi-mahi', 'hejno sardinek'])}: ` + h.popisZisku(h.pridej(s, { jidlo: n })) + (ma(s, 'ohniste') ? ' (upečeno)' : '') + '.';
      },
    },
    {
      id: 'sklizen', ikona: '🌾', nazev: 'Sklidit políčko', ab: 1,
      kde: (s, i) => { const b = stavbaNa(s, i); return !!b && b.typ === 'policko'; },
      proc: (s, i) => { const b = stavbaNa(s, i); return b.zraje > s.den ? `Hlízy dozrají za ${b.zraje - s.den} d.` : null; },
      proved(s, i, x, y, h) {
        const b = stavbaNa(s, i); b.zraje = s.den + POLICKO_DALSI;
        return 'Vykopal jsi hlízy: ' + h.popisZisku(h.pridej(s, { jidlo: POLICKO_UROD })) + `. Další úroda za ${POLICKO_DALSI} dny.`;
      },
    },
  ];

  // signální hranice: přiložit dřevo, hoří 3 dny
  const hori = s => seznam(s).some(b => b.typ === 'signal' && (b.hori || 0) >= s.den);
  AKCE.push({
    id: 'prilozit', ikona: '🔥', nazev: 'Přiložit na signální hranici (4 🪵)', ab: 1,
    kde: (s, i) => { const b = stavbaNa(s, i); return !!b && b.typ === 'signal'; },
    proc: s => s.zasoby.drevo < 4 ? 'Potřebuješ 4 🪵.' : null,
    proved(s, i) {
      const b = stavbaNa(s, i);
      s.zasoby.drevo -= 4;
      b.hori = Math.max(b.hori || 0, s.den - 1) + 3;
      return `Hranice vzplála a sloup kouře stoupá k nebi. Vydrží hořet do ${b.hori}. dne.` + (s.den < 50 ? ' Lodě tudy ale zatím pluly jen zřídka…' : '');
    },
  });

  // oprava poškozené stavby: polovina ceny, polovina AB (nejméně 1)
  const cenaOpravy = typ => Object.fromEntries(Object.entries(STAVBY[typ].cena).map(([k, v]) => [k, Math.ceil(v / 2)]));
  AKCE.push({
    id: 'opravit', ikona: '🔧', nazev: 'Opravit stavbu', ab: 2,
    kde: (s, i) => { const b = stavbaNa(s, i); return !!b && !!b.poskozeno; },
    proc(s, i) {
      const c = cenaOpravy(stavbaNa(s, i).typ);
      const chybi = Object.entries(c).filter(([k, v]) => (s.zasoby[k] || 0) < v);
      return chybi.length ? 'Na opravu chybí ' + popisCeny(Object.fromEntries(chybi.map(([k, v]) => [k, v - (s.zasoby[k] || 0)]))) + '.' : null;
    },
    proved(s, i) {
      const b = stavbaNa(s, i), c = cenaOpravy(b.typ);
      for (const k in c) s.zasoby[k] -= c[k];
      b.poskozeno = false;
      return `${STAVBY[b.typ].ikona} ${STAVBY[b.typ].nazev} je zase v pořádku (−${popisCeny(c)}).`;
    },
  });

  T.stavby = {
    STAVBY, PORADI, DOSAH_TABORA, KAPACITA, KAPACITA_SKLAD, POLICKO_PRVNI, POLICKO_DALSI, POLICKO_UROD, AKCE,
    hori, vodaNaNoc, stavbaNa, pocet, ma, ohniste, vTabore, kapacita, moznosti, prekazka, postav, noc, bonusSpanku, ulevaPily, popisCeny, cenaOpravy,
  };
})(TROS);

if (typeof module !== 'undefined') module.exports = TROS;
