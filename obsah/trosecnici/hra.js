/* ============================================================
   Trosečníci – hra.js: pravidla přežití (etapa 2 – jednotlivec).

   Čistá logika bez DOM a localStorage. Stav hry je obyčejný objekt;
   svět se neukládá – vždy znovu vznikne ze seedu a přes něj se
   přehrají změny (pokácené stromy). Náhoda akcí je odvozená ze seedu
   a pořadí tahu, takže stejný sled akcí dá stejný výsledek.

   Den = 12 akčních bodů (AB). Pohyb stojí podle terénu 1–2 AB,
   akce na poli 1–3 AB. V noci se sní 1 🍖 a vypijí 2 💧 na osobu;
   co chybí, bere zdraví. Nevyužité AB jsou odpočinek.
   ============================================================ */
var TROS = globalThis.TROS = globalThis.TROS || {};

(function (T) {
  'use strict';
  const { W, H, TEREN, OBJ, CHODIT, SOUSEDE4, idx, uvnitr } = T.svet;
  const { Nahoda, smichej } = T.nahoda;

  const VERZE = 7;
  const AB_DEN = 12;
  const NAVIC_MAX = 6, NAVIC_ZDRAVI = 3;              // pochod přes únavu
  // prošlapané cesty: kolikrát výprava pole prošla → pěšina (náročný terén za 1 AB) → stezka (½ AB)
  const PESINA = 4, STEZKA = 12;
  const SPOTREBA = { jidlo: 1, voda: 2 };           // na osobu a den
  const ZDRAVI_MAX = 100;

  const SUROVINY = [
    { id: 'jidlo',  ikona: '🍖', nazev: 'Jídlo' },
    { id: 'voda',   ikona: '💧', nazev: 'Voda' },
    { id: 'drevo',  ikona: '🪵', nazev: 'Dřevo' },
    { id: 'kamen',  ikona: '🪨', nazev: 'Kámen' },
    { id: 'vlakna', ikona: '🌿', nazev: 'Vlákna' },
    { id: 'hlina',  ikona: '🧱', nazev: 'Hlína',   objev: 'hlina' },
    { id: 'kov',    ikona: '⚙️', nazev: 'Kov',     objev: 'kovarstvi' },
    { id: 'lecivky', ikona: '🌱', nazev: 'Léčivky', objev: 'lecivky' },
    { id: 'pochodne', ikona: '🔥', nazev: 'Pochodně', objev: 'remeslo' },
  ];
  const PREDMETY = {
    nuz:    { ikona: '🔪', nazev: 'Nůž',          popis: 'Zachráněný z lodi. Na větve, rybu i provaz.' },
    lahev:  { ikona: '🍶', nazev: 'Láhev',        popis: 'Pojme 4 dávky vody.' },
    sud:    { ikona: '🛢️', nazev: 'Sud na vodu',  popis: 'Z podpalubí vraku. +6 místa na vodu.' },
    ostep:  { ikona: '🔱', nazev: 'Oštěp',        popis: 'Rybaření je o dost úspěšnější.' },
    sekera: { ikona: '🪓', nazev: 'Sekera', akuzativ: 'sekeru',       popis: 'Z opuštěného tábora. Kácí stromy a palmy.' },
    plachta: { ikona: '⛺', nazev: 'Plachta',     popis: 'Nepromokavá plachta z bedny. +5 místa na vodu, v dešti nachytá +2 💧.' },
    kompas: { ikona: '🧭', nazev: 'Kompas',       popis: 'Lodní kompas. Výprava vidí o pole dál.' },
    udice:  { ikona: '🪝', nazev: 'Udice',         popis: 'Rybaření +15 % a +1 🍖, molo +1 🍖.' },
    krumpac: { ikona: '⛏️', nazev: 'Krumpáč',      popis: 'Kámen, hlína i ruda +1.' },
    naradi: { ikona: '🔧', nazev: 'Nářadí',        popis: 'Stavby o 1 AB levnější.' },
    site:   { ikona: '🕸️', nazev: 'Sítě',          popis: 'Rybaření +1 🍖, molo +2 🍖.' },
    dzban:     { ikona: '🏺', nazev: 'Džbán deště',        popis: 'Artefakt z podzemí: každou noc +2 💧.' },
    trojzubec: { ikona: '🔱', nazev: 'Trojzubec',          popis: 'Artefakt z podzemí: rybaření +20 % a +1 🍖.' },
    amulet:    { ikona: '🪬', nazev: 'Amulet s okem',      popis: 'Artefakt z podzemí: horečka bere jen −3 ❤️ za noc.' },
    mapa:      { ikona: '🗺️', nazev: 'Kamenná mapa',       popis: 'Artefakt z podzemí: celý ostrov bez mlhy.' },
    svitek:    { ikona: '📜', nazev: 'Svitek stavitelů',   popis: 'Artefakt z podzemí: práce na lodi +50 %.' },
    zrcadlo:   { ikona: '🪞', nazev: 'Obsidiánové zrcadlo', popis: 'Artefakt z podzemí: výprava vidí o 2 pole dál.' },
    srot:   { ikona: '⚙️', nazev: 'Železný šrot', akuzativ: 'železný šrot z vraku', popis: 'Kusy kování z vraku. Jednou se budou hodit.' },
  };

  // co vydá vrak při jednotlivých prohledáních
  const VRAK = [
    { text: 'V podpalubí jsi našel dubový sud – a v něm ještě trochu sladké vody!', predmet: 'sud', zisk: { voda: 3 } },
    { text: 'Rozbitá kajuta kuchaře: plechovka sucharů a smotek lana.', zisk: { jidlo: 4, vlakna: 3 } },
    { text: 'Vylámal jsi prkna z paluby.', zisk: { drevo: 5 } },
    { text: 'Z trupu se dalo vypáčit pár kusů železného kování.', predmet: 'srot', zisk: { drevo: 2, kov: 3 } },
  ];

  // --- založení a obnova ---------------------------------------------------------
  function nova(seed) {
    const svet = T.svet.generuj(seed);
    const s = {
      verze: VERZE, seed: svet.seed, den: 1, ab: AB_DEN, abMax: AB_DEN, tah: 0,
      hrac: { x: svet.start.x, y: svet.start.y },
      zasoby: { jidlo: 2, voda: 2, drevo: 2, kamen: 0, vlakna: 0, hlina: 0, kov: 0, lecivky: 0, pochodne: 0 },
      objevy: [], nadoby: 0, slapano: {}, pulKrok: false,
      tajemstvi: { symboly: [], hlava: false, ruiny: false, jeskyne: false, dvere: false }, lod: null,
      podzemi: { uroven: 0, krok: 0, pribeh: [], nalezeno: [], konec: null },
      predmety: ['nuz', 'lahev'],
      vycerpano: {},            // index pole → den, kdy se zdroj obnoví
      odstraneno: [],           // indexy polí s pokáceným stromem/palmou
      vrakKolo: 0, taborProhledan: false,
      stavby: [],               // [{typ, i, den, pracovnik, …}] – viz stavby.js
      lide: [T.postavy.hrdina()], mrtvi: [], nalezy: [],   // viz postavy.js
      efekty: [], bedny: [], udalost: null,              // viz udalosti.js
      objevene: [],             // indexy lokací
      denik: [], konec: null,
      stat: { kroky: 0, ulovky: 0, hladoveNoci: 0, zizniveNoci: 0, akce: {}, postaveno: 0 },
    };
    s.mlha = T.svet.novaMlha();
    pripojSvet(s, svet);
    s.nalezy = T.postavy.rozmistiNalezy(s);
    T.pocasi.nove(s);
    zapis(s, 'Probral ses na pláži. Loď je pryč, posádka taky. Z vraku jsi stihl zachránit nůž, láhev a pár prken.', 'pribeh');
    s.smerVody = smerKReceSvet(svet);
    if (s.smerVody) zapis(s, `Vody v láhvi je sotva na den. Někde ${s.smerVody.text} ale slyšíš šumět tekoucí vodu.`, 'pribeh');
    odkryjKolem(s, true);
    return s;
  }
  // směr od startu k nejbližší řece (po souši) – nápověda do úvodu
  const SMERY = ['na východě', 'na jihovýchodě', 'na jihu', 'na jihozápadě', 'na západě', 'na severozápadě', 'na severu', 'na severovýchodě'];
  function smerKReceSvet(svet) {
    const st = idx(svet.start.x, svet.start.y);
    const d = T.svet.bfs([st], i => CHODIT[svet.teren[i]]);
    let nej = -1;
    for (let i = 0; i < W * H; i++) if (svet.teren[i] === TEREN.REKA && d[i] >= 0 && (nej < 0 || d[i] < d[nej])) nej = i;
    if (nej < 0) return null;
    const dx = nej % W - svet.start.x, dy = ((nej / W) | 0) - svet.start.y;
    const u = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
    return { dx, dy, text: SMERY[(u + 8) % 8] };
  }

  function pripojSvet(s, svet) {
    Object.defineProperty(s, 'svet', { value: svet, enumerable: false, writable: true, configurable: true });
    for (const i of s.odstraneno) svet.obj[i] = OBJ.NIC;
  }

  function serializuj(s) {
    const o = Object.assign({}, s);
    o.mlha = Array.from(s.mlha).join('');
    return JSON.stringify(o);
  }
  function nacti(text) {
    const o = typeof text === 'string' ? JSON.parse(text) : text;
    if (o && o.verze === 1) { o.stavby = []; o.verze = 2; }         // hra z etapy 2
    let doplnitNalezy = false;
    if (o && o.verze === 2) {                                          // hra z etapy 3: jeden trosečník
      const ty = T.postavy.hrdina(); ty.zdravi = o.zdravi ?? 80;
      o.lide = [ty]; o.mrtvi = []; delete o.zdravi; o.verze = 3; doplnitNalezy = true;
    }
    if (!o || typeof o.seed !== 'number' || ![2, 3, 4, 5, 6, 7].includes(o.verze)) throw new Error('Neznámý formát uložené hry');
    const m = T.svet.novaMlha();
    for (let i = 0; i < m.length && i < o.mlha.length; i++) m[i] = o.mlha.charCodeAt(i) === 49 ? 1 : 0;
    o.mlha = m;
    let doplnitPocasi = false;
    if (o && o.verze === 3) { o.efekty = []; o.bedny = []; o.udalost = null; o.verze = 4; doplnitPocasi = true; }   // hra z etapy 4
    if (o && o.verze === 4) {                                         // hra z etapy 5
      o.objevy = []; o.nadoby = 0; o.verze = 5;
      for (const k of ['hlina', 'kov', 'lecivky', 'pochodne']) o.zasoby[k] = o.zasoby[k] || 0;
      if ((o.predmety || []).includes('srot')) o.zasoby.kov = 3;
    }
    if (o && o.verze === 5) { o.tajemstvi = { symboly: [], hlava: false, ruiny: false, jeskyne: false, dvere: false }; o.lod = null; o.verze = 6; }
    if (o && o.verze === 6) { o.podzemi = { uroven: 0, krok: 0, pribeh: [], nalezeno: [], konec: null }; o.verze = 7; }
    if (!o || o.verze !== VERZE) throw new Error('Neznámý formát uložené hry');
    o.slapano = o.slapano || {};
    o.stat = o.stat || {}; o.stat.akce = o.stat.akce || {}; o.stat.postaveno = o.stat.postaveno || (o.stavby || []).length;
    pripojSvet(o, T.svet.generuj(o.seed));
    if (doplnitNalezy) o.nalezy = T.postavy.rozmistiNalezy(o);
    if (doplnitPocasi) T.pocasi.nove(o);
    return o;
  }

  // --- pomocné -------------------------------------------------------------------
  function zapis(s, text, typ) { s.denik.push({ den: s.den, text, typ: typ || 'info' }); if (s.denik.length > 300) s.denik.shift(); }
  function nahoda(s) { s.tah++; return Nahoda(smichej(s.seed, s.den * 1000 + s.tah, 77)); }
  function kapacitaVody(s) { return T.stavby.kapacita(s, 'voda'); }
  function kapacita(s, k) { return T.stavby.kapacita(s, k); }
  function vareni(s) { return T.stavby.ma(s, 'ohniste') ? 1 : 0; }   // úlovky z vody se v táboře upečou
  function zastaveno(s, i) { return !!T.stavby.stavbaNa(s, i); }
  function maPredmet(s, p) { return s.predmety.includes(p); }
  function pridej(s, zisk) {
    const skutecne = {};
    for (const k in zisk) {
      let v = zisk[k];
      const volno = Math.max(0, kapacita(s, k) - s.zasoby[k]);
      if (v > volno) { if (k !== 'voda') s.preteklo = (s.preteklo || 0) + v - volno; v = volno; }
      s.zasoby[k] += v;
      if (v) skutecne[k] = v;
    }
    return skutecne;
  }
  function popisZisku(z) {
    const c = SUROVINY.filter(r => z[r.id]).map(r => `+${z[r.id]} ${r.ikona}`);
    return c.length ? c.join(' ') : 'nic';
  }
  // doplní do textu akce, že se něco nevešlo do zásob
  function sPretekem(s, text) {
    if (!s.preteklo) return text;
    const t = text + ' Víc se ti do zásob nevešlo' + (T.stavby.ma(s, 'sklad') ? '.' : ' – chtělo by to sklad.');
    s.preteklo = 0;
    return t;
  }
  function vycerpane(s, i) { return (s.vycerpano[i] || 0) > s.den; }
  function vycerpej(s, i, dni) { s.vycerpano[i] = s.den + dni; }
  function lokaceNa(s, i) { const li = s.svet.lokNa[i]; return li >= 0 ? s.svet.lokace[li] : null; }
  function sousedniPole(x, y) {
    const v = [];
    for (const [dx, dy] of SOUSEDE4) if (uvnitr(x + dx, y + dy)) v.push(idx(x + dx, y + dy));
    return v;
  }

  function dosahVidu(s, x, y) {
    const t = s.svet.teren[idx(x, y)];
    const namornik = t === TEREN.PLAZ && s.lide && T.postavy.maProfesi(s, 'namornik', 'vyprava') ? 2 : 0;
    const kompas = (s.predmety && s.predmety.includes('kompas') ? 1 : 0) + (s.predmety && s.predmety.includes('zrcadlo') ? 2 : 0);
    return (t === TEREN.SKALY || t === TEREN.SOPKA ? 4 : t === TEREN.PLAZ ? 3 + namornik : 2) + kompas;
  }
  // odkryje okolí trosečníka, vrátí nově objevené lokace
  function odkryjKolem(s, tise) {
    T.svet.odkryj(s.mlha, s.hrac.x, s.hrac.y, dosahVidu(s, s.hrac.x, s.hrac.y));
    const nove = [];
    s.svet.lokace.forEach((l, i) => {
      if (s.objevene.includes(i) || !s.mlha[idx(l.x, l.y)]) return;
      s.objevene.push(i); nove.push(l);
      if (!tise) zapis(s, 'Objevil jsi: ' + T.svet.LOKACE_INFO[l.typ].nazev + '.', 'objev');
    });
    return nove;
  }

  // --- pohyb ------------------------------------------------------------------------
  function slapano(s, i) { return (s.slapano && s.slapano[i]) || 0; }
  function druhCesty(s, i) { const n = slapano(s, i); return n >= STEZKA ? 'stezka' : n >= PESINA ? 'pesina' : null; }
  // cena vstupu na pole v AB (může být ½ na stezce)
  function cenaPole(s, i) {
    const zaklad = T.svet.cenaKroku(s.svet.teren[i]);
    const d = druhCesty(s, i);
    return d === 'stezka' ? 0.5 : d === 'pesina' ? Math.min(zaklad, 1) : zaklad;
  }
  // kolik celých AB stojí řada kroků (půlkroky se sčítají, první může zaplatit „kredit")
  function platbaKroku(cena, kredit) {
    if (cena !== 0.5) return { ab: cena, kredit };
    return kredit ? { ab: 0, kredit: false } : { ab: 1, kredit: true };
  }
  function cesta(s, x, y) {
    if (x === s.hrac.x && y === s.hrac.y) return null;
    const c = T.svet.cesta(s.svet, s.mlha, s.hrac.x, s.hrac.y, x, y, (t, i) => cenaPole(s, i));
    if (!c) return null;
    let kredit = !!s.pulKrok, ab = 0;
    for (const k of c) { const p = platbaKroku(k.cena, kredit); k.platba = p.ab; kredit = p.kredit; ab += p.ab; }
    return { kroky: c, ab };
  }
  // jeden krok na sousední pole; vrací {ok, duvod, objevy}
  function krok(s, x, y, volby) {
    if (s.konec) return { ok: false, duvod: 'Hra skončila.' };
    if (Math.abs(x - s.hrac.x) + Math.abs(y - s.hrac.y) !== 1 || !uvnitr(x, y)) return { ok: false, duvod: 'Tam se jedním krokem nedostaneš.' };
    const t = s.svet.teren[idx(x, y)];
    if (!CHODIT[t]) return { ok: false, duvod: T.svet.TEREN_INFO[t].nazev + ' – tudy cesta nevede.' };
    const cil = idx(x, y);
    const plat = platbaKroku(cenaPole(s, cil), !!s.pulKrok);
    const c = plat.ab;
    let pres = 0;
    if (s.ab < c) {
      pres = c - s.ab;                                       // kolik AB chybí – jde přes únavu
      const zbyva = NAVIC_MAX - (s.navic || 0);
      if (!(volby && volby.presUnavu) || pres > zbyva)
        return { ok: false, duvod: `Na další krok už nemáš sílu (potřeba ${c} AB).` + (pres <= zbyva ? ' Můžeš jít dál přes únavu, nebo ukončit den.' : ' Ukonči den.'), unava: true, lzePresUnavu: pres <= zbyva };
      s.navic = (s.navic || 0) + pres;
      for (const o of T.postavy.vyprava(s)) o.zdravi = Math.max(1, o.zdravi - NAVIC_ZDRAVI * pres);
      s.stat.presUnavu = (s.stat.presUnavu || 0) + pres;
    }
    s.ab -= c - pres; s.hrac = { x, y }; s.stat.kroky++;
    s.pulKrok = plat.kredit;
    // prošlapávání: kudy se chodí, tam vzniká pěšina a pak stezka
    s.slapano = s.slapano || {};
    const predtim = druhCesty(s, cil);
    s.slapano[cil] = Math.min(255, (s.slapano[cil] || 0) + 1);
    const ted = druhCesty(s, cil);
    let novaCesta = null;
    if (ted !== predtim && ted) {
      novaCesta = ted;
      if (!s.stat[ted === 'stezka' ? 'prvniStezka' : 'prvniPesina']) {
        s.stat[ted === 'stezka' ? 'prvniStezka' : 'prvniPesina'] = s.den;
        zapis(s, ted === 'stezka' ? 'Z pěšiny se stala pořádná stezka – po ní se chodí dvakrát rychleji (½ AB za krok).' : 'Kudy se často chodí, vyšlapali jste pěšinu. Přes džungli, skály nebo brod stojí krok po ní jen 1 AB.', 'info');
      }
    }
    const objevy = odkryjKolem(s, false);
    const k = T.postavy.nalezUVypravy(s);
    const napady = zapisObjevy(s);
    return { ok: true, objevy, napady, pres, novaCesta, nalez: k >= 0 && s.nalezy[k].stav === 'skryto' ? k : -1 };
  }

  // objevy (objevy.js) – zapíše do deníku a vrátí nové
  function zapisObjevy(s) {
    if (!T.objevy) return [];
    const nove = T.objevy.kontrola(s);
    for (const o of nove) zapis(s, `💡 Objev – ${o.nazev}: ${o.text}`, 'objev');
    return nove;
  }

  // --- akce na místě ---------------------------------------------------------------
  /* Každá akce: kde je dostupná (dostupna → null nebo důvod, proč ne), cena v AB
     a provedení (vrací text do deníku). */
  const AKCE = [
    {
      id: 'kokosy', ikona: '🥥', nazev: 'Natrhat kokosy', ab: 1,
      kde: (s, i) => s.svet.obj[i] === OBJ.PALMA,
      proc: (s, i) => vycerpane(s, i) ? 'Kokosy jsou otrhané, dorostou za ' + (s.vycerpano[i] - s.den) + ' d.' : null,
      proved(s, i) { vycerpej(s, i, 4); return 'Natrhal jsi kokosy: ' + popisZisku(pridej(s, { jidlo: 2, voda: 1 })) + '.'; },
    },
    {
      id: 'bobule', ikona: '🫐', nazev: 'Sbírat bobule', ab: 1,
      kde: (s, i) => s.svet.obj[i] === OBJ.KER,
      proc: (s, i) => vycerpane(s, i) ? 'Keř je obraný.' : null,
      proved(s, i) {
        const r = nahoda(s); vycerpej(s, i, 3);
        const botanik = T.postavy.maProfesi(s, 'botanik', 'vyprava');
        if (!botanik && r.sance(0.08)) {
          const v = T.postavy.vedouci(s); v.zdravi = Math.max(1, v.zdravi - 8);
          return `Bobule byly nahořklé – ${v.hrac ? 'udělalo se ti zle' : v.jmeno + ' zvrací za keřem'} (−8 ❤️). ` + popisZisku(pridej(s, { jidlo: 1 })) + '.';
        }
        return 'Nasbíral jsi bobule: ' + popisZisku(pridej(s, { jidlo: 2 + (botanik ? 1 : 0), vlakna: r.sance(0.35) ? 1 : 0 })) + (botanik ? ' Botanik ví, které jsou nejlepší.' : '') + '.';
      },
    },
    {
      id: 'vlakna', ikona: '🌿', nazev: 'Trhat trávu na vlákna', ab: 1,
      kde: (s, i) => s.svet.teren[i] === TEREN.SAVANA && !zastaveno(s, i),
      proc: (s, i) => vycerpane(s, i) ? 'Tady už je tráva vytrhaná.' : null,
      proved(s, i) { vycerpej(s, i, 3); return 'Natrhal jsi dlouhou trávu: ' + popisZisku(pridej(s, { vlakna: 2 })) + '.'; },
    },
    {
      id: 'klacky', ikona: '🪵', nazev: 'Sbírat naplavené dříví', ab: 1,
      kde: (s, i) => (s.svet.teren[i] === TEREN.PLAZ || s.svet.teren[i] === TEREN.DZUNGLE) && !zastaveno(s, i),
      proc: (s, i) => vycerpane(s, i) ? 'Tady už nic nezbylo.' : null,
      proved(s, i) {
        const r = nahoda(s); vycerpej(s, i, 3);
        const n = s.svet.teren[i] === TEREN.PLAZ && r.sance(0.5) ? 2 : 1;
        return 'Posbíral jsi klacky: ' + popisZisku(pridej(s, { drevo: n })) + '.';
      },
    },
    {
      id: 'vetve', ikona: '🔪', nazev: 'Nasekat větve', ab: 2,
      kde: (s, i) => s.svet.obj[i] === OBJ.STROM && !maPredmet(s, 'sekera'),
      proc: (s, i) => vycerpane(s, i) ? 'Spodní větve jsou osekané.' : null,
      proved(s, i) { vycerpej(s, i, 3); return 'Nožem jsi osekal větve: ' + popisZisku(pridej(s, { drevo: 2 })) + '. S pořádnou sekerou by to šlo líp.'; },
    },
    {
      id: 'kacet', ikona: '🪓', nazev: 'Pokácet strom', ab: 2,
      kde: (s, i) => maPredmet(s, 'sekera') && (s.svet.obj[i] === OBJ.STROM || s.svet.obj[i] === OBJ.PALMA),
      proc: () => null,
      proved(s, i) {
        const palma = s.svet.obj[i] === OBJ.PALMA;
        s.svet.obj[i] = OBJ.NIC; s.odstraneno.push(i); delete s.vycerpano[i];
        const pila = T.stavby.ma(s, 'pila') ? 2 : 0;
        return (palma ? 'Porazil jsi palmu' : 'Pokácel jsi strom') + ': ' + popisZisku(pridej(s, { drevo: (palma ? 3 : 5) + pila })) + (pila ? ' (dřevo rozřezané na pile)' : '') + '.';
      },
    },
    {
      // bez sekery jde strom porazit nožem – dlouhá dřina, ale tábor se nezasekne v džungli
      id: 'kacet_nozem', ikona: '🔪', nazev: 'Porazit strom nožem (dlouhá dřina)', ab: 4,
      kde: (s, i) => !maPredmet(s, 'sekera') && maPredmet(s, 'nuz') && (s.svet.obj[i] === OBJ.STROM || s.svet.obj[i] === OBJ.PALMA),
      proc: () => null,
      proved(s, i) {
        const palma = s.svet.obj[i] === OBJ.PALMA;
        s.svet.obj[i] = OBJ.NIC; s.odstraneno.push(i); delete s.vycerpano[i];
        return (palma ? 'Nožem jsi celé odpoledne podřezával palmu, až padla' : 'Nožem jsi celé odpoledne podřezával kmen, až strom padl') + ': ' + popisZisku(pridej(s, { drevo: palma ? 2 : 3 })) + '. Sekera by to zvládla za chvilku.';
      },
    },
    {
      id: 'vykopat_ker', ikona: '🌿', nazev: 'Vykopat keř', ab: 2,
      kde: (s, i) => s.svet.obj[i] === OBJ.KER,
      proc: () => null,
      proved(s, i) {
        s.svet.obj[i] = OBJ.NIC; s.odstraneno.push(i); delete s.vycerpano[i];
        return 'Vykopal jsi keř i s kořeny – pole je volné: ' + popisZisku(pridej(s, { vlakna: 2 })) + '.';
      },
    },
    {
      id: 'rozbit_balvan', ikona: '⛏️', nazev: 'Rozbít balvan', ab: 3,
      kde: s => s.svet.obj[idx(s.hrac.x, s.hrac.y)] === OBJ.BALVAN,
      proc: s => s.ab < (maPredmet(s, 'krumpac') ? 2 : 3) ? `Potřeba ${maPredmet(s, 'krumpac') ? 2 : 3} AB.` : null,
      proved(s, i) {
        if (maPredmet(s, 'krumpac')) s.ab++;                 // krumpáčem to jde o AB rychleji
        s.svet.obj[i] = OBJ.NIC; s.odstraneno.push(i); delete s.vycerpano[i];
        return 'Balvan jsi rozbil na kusy a odvalil – pole je volné: ' + popisZisku(pridej(s, { kamen: 3 })) + '.';
      },
    },
    {
      id: 'balvan', ikona: '🪨', nazev: 'Otloukat balvan', ab: 2,
      kde: (s, i) => s.svet.obj[i] === OBJ.BALVAN,
      proc: (s, i) => vycerpane(s, i) ? 'Z balvanu už nic neodloupneš.' : null,
      proved(s, i) { vycerpej(s, i, 4); return 'Odloupal jsi použitelné kameny: ' + popisZisku(pridej(s, { kamen: 2 + (maPredmet(s, 'krumpac') ? 1 : 0) })) + '.'; },
    },
    {
      id: 'kameni', ikona: '🪨', nazev: 'Sbírat kamení', ab: 1,
      kde: (s, i) => (s.svet.teren[i] === TEREN.SKALY || s.svet.teren[i] === TEREN.SOPKA) && s.svet.obj[i] !== OBJ.BALVAN && !zastaveno(s, i),
      proc: (s, i) => vycerpane(s, i) ? 'Volné kamení jsi už posbíral.' : null,
      proved(s, i) { vycerpej(s, i, 3); return 'Posbíral jsi kamení: ' + popisZisku(pridej(s, { kamen: 1 + (maPredmet(s, 'krumpac') ? 1 : 0) })) + '.'; },
    },
    {
      id: 'voda', ikona: '💧', nazev: 'Nabrat vodu z řeky', ab: 1,
      kde: (s, i, x, y) => s.svet.teren[i] === TEREN.REKA || sousedniPole(x, y).some(j => s.svet.teren[j] === TEREN.REKA),
      proc: s => kapacitaVody(s) === 0 ? 'Nemáš do čeho nabrat.' : s.zasoby.voda >= kapacitaVody(s) ? 'Všechny nádoby jsou plné.' : null,
      proved(s) { return 'Naplnil jsi nádoby sladkou vodou: ' + popisZisku(pridej(s, { voda: 99 })) + '.'; },
    },
    {
      id: 'rybarit', ikona: '🎣', nazev: 'Rybařit', ab: 3,
      kde: (s, i, x, y) => [i].concat(sousedniPole(x, y)).some(j => [TEREN.MORE, TEREN.LAGUNA, TEREN.REKA].includes(s.svet.teren[j])),
      proc: () => null,
      proved(s, i, x, y) {
        const typy = [i].concat(sousedniPole(x, y)).map(j => s.svet.teren[j]);
        const kde = typy.includes(TEREN.LAGUNA) ? TEREN.LAGUNA : typy.includes(TEREN.MORE) ? TEREN.MORE : TEREN.REKA;
        const zraloci = kde !== TEREN.REKA && T.udalosti.efekt(s, 'zraloci'), hejno = kde !== TEREN.REKA && T.udalosti.efekt(s, 'hejno');
        const sance = ({ [TEREN.LAGUNA]: 0.6, [TEREN.MORE]: 0.5, [TEREN.REKA]: 0.45 }[kde] + (maPredmet(s, 'ostep') ? 0.2 : 0) + (maPredmet(s, 'udice') ? 0.15 : 0) + (maPredmet(s, 'trojzubec') ? 0.2 : 0)) * (zraloci ? 0.5 : 1);
        const r = nahoda(s);
        if (!r.sance(sance)) return zraloci ? 'Žraloci krouží u břehu, ryby se schovaly. Nic.' : maPredmet(s, 'ostep') ? 'Ryby se dnes schovaly. Nic.' : 'Holýma rukama a nožem to nejde – ryba ti proklouzla. Oštěp by pomohl.';
        s.stat.ulovky++;
        const n = Math.round(r.cele(2, kde === TEREN.LAGUNA ? 4 : 3) * (T.postavy.maProfesi(s, 'rybar', 'vyprava') ? 1.5 : 1) * (hejno ? 1.5 : 1)) + vareni(s) + (maPredmet(s, 'udice') ? 1 : 0) + (maPredmet(s, 'site') ? 1 : 0) + (maPredmet(s, 'trojzubec') ? 1 : 0);
        const ryba = r.vyber(kde === TEREN.REKA ? ['pstruha', 'sumečka', 'úhoře'] : ['makrelu', 'kanice', 'papouščí rybu', 'chobotnici', 'barakudu']);
        return `Ulovil jsi ${ryba}: ` + popisZisku(pridej(s, { jidlo: n })) + (vareni(s) ? ' (upečeno v táboře)' : '') + '.';
      },
    },
    {
      id: 'kraby', ikona: '🦀', nazev: 'Sbírat kraby a mušle', ab: 2,
      kde: (s, i, x, y) => s.svet.teren[i] === TEREN.PLAZ && sousedniPole(x, y).some(j => s.svet.teren[j] === TEREN.MORE || s.svet.teren[j] === TEREN.LAGUNA),
      proc: (s, i) => vycerpane(s, i) ? 'Tady jsi už všechno posbíral.' : null,
      proved(s, i) {
        const r = nahoda(s); vycerpej(s, i, 2);
        if (!r.sance(0.7)) return 'Krabi byli rychlejší. Nic.';
        return 'Posbíral jsi kraby a mušle: ' + popisZisku(pridej(s, { jidlo: r.cele(1, 2) + vareni(s) })) + '.';
      },
    },
    {
      id: 'vrak', ikona: '🚢', nazev: 'Prohledat vrak', ab: 2,
      kde: (s, i, x, y) => sousedniPole(x, y).concat([i]).some(j => { const l = lokaceNa(s, j); return l && l.typ === 'vrak'; }),
      proc: s => s.vrakKolo >= VRAK.length ? 'Vrak je vybrakovaný do posledního hřebíku.' : null,
      proved(s) {
        const k = VRAK[s.vrakKolo++];
        if (k.predmet) s.predmety.push(k.predmet);
        const z = popisZisku(pridej(s, k.zisk));
        return k.text + (k.predmet ? ` (${PREDMETY[k.predmet].ikona} ${PREDMETY[k.predmet].nazev})` : '') + (z !== 'nic' ? ' ' + z : '');
      },
    },
    {
      id: 'tabor', ikona: '⛺', nazev: 'Prohledat opuštěný tábor', ab: 1,
      kde: (s, i) => { const l = lokaceNa(s, i); return l && l.typ === 'tabor'; },
      proc: s => s.taborProhledan ? 'Tábor už jsi prohledal.' : null,
      proved(s) {
        s.taborProhledan = true; s.predmety.push('sekera');
        pridej(s, { vlakna: 2 });
        return 'Pod rozpadlou střechou ležela rezavá, ale ostrá sekera 🪓 a klubko provazu (+2 🌿). Do trámu někdo vyryl čárky – 214 dní. A pod nimi kresbu: kamennou tvář.';
      },
    },
    {
      id: 'bedna', ikona: '📦', nazev: 'Otevřít bednu', ab: 1,
      kde: (s, i) => (s.bedny || []).some(b => b.i === i),
      proc: () => null,
      proved: (s, i) => T.udalosti.otevriBednu(s, i),
    },
    {
      id: 'ostep', ikona: '🔱', nazev: 'Vyrobit oštěp', ab: 1, vyroba: true, cena: { drevo: 2, vlakna: 1 },
      kde: s => maPredmet(s, 'nuz') && !maPredmet(s, 'ostep'),
      proc: s => s.zasoby.drevo < 2 || s.zasoby.vlakna < 1 ? 'Potřebuješ 2 🪵 a 1 🌿.' : null,
      proved(s) { s.zasoby.drevo -= 2; s.zasoby.vlakna -= 1; s.predmety.push('ostep'); return 'Z rovné větve a nože přivázaného vlákny jsi vyrobil oštěp 🔱.'; },
    },
  ];
  const vsechnyAkce = () => AKCE.concat(T.stavby ? T.stavby.AKCE : [], T.objevy ? T.objevy.AKCE : [], T.tajemstvi ? T.tajemstvi.AKCE : [], T.podzemi ? T.podzemi.AKCE : []);
  const POMOC = { nahoda: s => nahoda(s), pridej: (s, z) => pridej(s, z), popisZisku: z => popisZisku(z) };

  // seznam akcí dostupných tam, kde trosečník stojí: [{id, ikona, nazev, ab, duvod|null}]
  function akce(s) {
    if (s.konec) return [];
    const { x, y } = s.hrac, i = idx(x, y);
    const v = [];
    for (const a of vsechnyAkce()) {
      if (!a.kde(s, i, x, y)) continue;
      let duvod = a.proc(s, i, x, y);
      if (!duvod && s.ab < a.ab) duvod = `Potřeba ${a.ab} AB, zbývá ${s.ab}.`;
      v.push({ id: a.id, ikona: a.ikona, nazev: a.nazev, ab: a.ab, vyroba: !!a.vyroba, duvod });
    }
    return v;
  }
  function proved(s, id) {
    const a = vsechnyAkce().find(k => k.id === id);
    const nab = akce(s).find(k => k.id === id);
    if (!a || !nab) return { ok: false, duvod: 'Tahle akce tady nejde.' };
    if (nab.duvod) return { ok: false, duvod: nab.duvod };
    const { x, y } = s.hrac, i = idx(x, y);
    s.ab -= a.ab;
    const text = sPretekem(s, a.proved(s, i, x, y, POMOC));
    s.stat.akce = s.stat.akce || {}; s.stat.akce[id] = (s.stat.akce[id] || 0) + 1;
    zapis(s, text, s.konec ? 'konec' : id.startsWith('podzemi') ? 'podzemi' : /^(Obešel|Mezi liánami|Prolezl|Žár|Chodba|Podle obkreslených)/.test(text) ? 'tajemstvi' : 'akce');
    return { ok: true, text, napady: zapisObjevy(s) };
  }

  // --- noc ---------------------------------------------------------------------------
  function konecDne(s) {
    if (s.konec) return null;
    const vyroba = T.stavby.noc(s);                  // sběrače a déšť, zralá políčka – ještě před pitím
    const bylaBoure = T.pocasi.dnes(s) === 'boure';
    const zdravPred = new Map(s.lide.map(o => [o.id, o.zdravi]));
    const n = T.postavy.noc(s);
    const zpravy = vyroba.zpravy.concat(n.zpravy);
    const hlad = n.lide.filter(o => n.stav.get(o).chybiJ).length, zizen = n.lide.filter(o => n.stav.get(o).chybiV).length;
    if (hlad) zpravy.push(hlad === 1 && n.lide.length === 1 ? 'Šel jsi spát o hladu.' : `${hlad} ${hlad === 1 ? 'člověk šel' : 'lidí šlo'} spát o hladu.`);
    if (zizen) zpravy.push(n.lide.length === 1 ? (n.stav.get(n.lide[0]).chybiV >= 2 ? 'Celý den jsi neměl co pít. Žízeň je horší než hlad.' : 'Vody bylo málo, ráno tě bolí hlava.') : `Na ${zizen} ${zizen === 1 ? 'člověka' : 'lidi'} nezbyla voda.`);
    if (n.kuchar) zpravy.push('Kuchař vyvařil z mála víc (−1 🍖 spotřeby).');
    if (n.potrebaV > 2) zpravy.unshift(`Vedro: každý vypil ${n.potrebaV} 💧.`);
    if (bylaBoure) zpravy.push(...T.udalosti.bourkovaNoc(s));
    const lodNoc = T.tajemstvi.noc(s);
    zpravy.push(...lodNoc.zpravy);
    const lidi = n.lide.map(o => ({ id: o.id, jmeno: o.jmeno, hrac: !!o.hrac, pred: zdravPred.get(o.id), po: o.zdravi,
      ukryt: n.stav.get(o).ukryt || null, chybiJ: n.stav.get(o).chybiJ, chybiV: n.stav.get(o).chybiV, mrtvy: n.mrtvi.includes(o) }));
    const souhrn = { den: s.den, snedeno: n.snedeno, vypito: n.vypito, vyrobeno: n.vyrobeno, lidi, zpravy, mrtvi: n.mrtvi.map(o => o.jmeno) };
    const ja = lidi.find(l => l.hrac);
    zapis(s, `Noc ${s.den}: snědeno ${n.snedeno} 🍖, vypito ${n.vypito} 💧.` + (ja && !ja.mrtvy ? ` Zdraví ${ja.pred} → ${ja.po} ❤️.` : '') + (zpravy.length ? ' ' + zpravy.join(' ') : ''), 'noc');
    for (const o of n.mrtvi) {
      const m = s.mrtvi[s.mrtvi.length - n.mrtvi.length + n.mrtvi.indexOf(o)];
      zapis(s, o.hrac ? `Den ${s.den}: tvoje síly došly (${m.pricina}).` : `💀 ${o.jmeno}, ${m.profese}, ${T.postavy.zemrel(o)} – ${m.pricina}. Do háje, ${o.jmeno}.`, 'smrt');
    }
    if (!s.lide.length) {
      const posl = s.mrtvi[s.mrtvi.length - 1];
      s.konec = { den: s.den, duvod: posl.pricina };
      zapis(s, `Den ${s.den}: na ostrově nezůstal nikdo živý. Ostrov si vás nechal.`, 'konec');
      souhrn.konec = s.konec;
      return souhrn;
    }
    s.den++;
    s.navic = 0; s.pulKrok = false;
    T.pocasi.doplnPlan(s);
    for (const t of T.postavy.rano(s)) { zapis(s, t, 'info'); souhrn.zpravy.push(t); }
    s.abMax = T.postavy.abVypravy(s);
    const postih = T.pocasi.abPostih(s);
    s.ab = Math.max(1, s.abMax - postih);
    souhrn.abZitra = s.ab;
    const P = T.pocasi.TYPY[T.pocasi.dnes(s)];
    souhrn.pocasi = { typ: T.pocasi.dnes(s), ikona: P.ikona, nazev: P.nazev, teplota: s.pocasi.teploty[s.den], postih };
    const zaBouri = T.pocasi.bourePredpoved(s);
    if (zaBouri === 2) { const t = '⛈️ Tropická bouře se blíží. Přijde za 2 dny – připravte zásoby a střechy.'; zapis(s, t, 'pocasi'); souhrn.zpravy.push(t); }
    if (zaBouri === 0) zapis(s, '⛈️ Dnes udeří bouře. Výprava sotva postupuje (−4 AB).', 'pocasi');
    const u = T.udalosti.rano(s, bylaBoure);
    if (u) {
      zapis(s, `${u.ikona} ${u.nazev}: ${u.text}` + (u.vysledek ? ' ' + u.vysledek : ''), 'udalost');
      souhrn.udalost = u;
    }
    return souhrn;
  }

  // nález trosečníků: přijmout / nechat být
  function prijmi(s, k) {
    const r = T.postavy.prijmi(s, k);
    if (r.ok) { zapis(s, r.text, 'lide'); s.stat.maxLidi = Math.max(s.stat.maxLidi || 1, s.lide.length); }
    return r;
  }
  function odmitni(s, k) { const r = T.postavy.odmitni(s, k); if (r.ok) zapis(s, r.text, 'info'); return r; }
  function nastavRoli(s, id, role) { return T.postavy.nastavRoli(s, id, role); }
  function rozhodni(s, volba) {
    const r = T.udalosti.vyres(s, volba);
    if (r.ok) zapis(s, `${r.ikona} ${r.nazev}: ${r.text}`, 'udalost');
    return r;
  }

  // postaví stavbu tam, kde trosečník stojí (pravidla v stavby.js)
  function stav(s, typ) {
    const r = T.stavby.postav(s, typ);
    if (r.ok) { zapis(s, r.text, 'stavba'); s.stat.postaveno = (s.stat.postaveno || 0) + 1; r.napady = zapisObjevy(s); r.objevy = odkryjKolem(s, false); }
    return r;
  }

  T.hra = {
    VERZE, AB_DEN, NAVIC_MAX, NAVIC_ZDRAVI, PESINA, STEZKA, SPOTREBA, slapano, druhCesty, cenaPole, SUROVINY, PREDMETY, AKCE,
    nova, serializuj, nacti, cesta, krok, akce, proved, konecDne, kapacitaVody, kapacita, maPredmet, dosahVidu, stav,
    prijmi, odmitni, nastavRoli, rozhodni, pridejZasoby: (s, z) => pridej(s, z), popisZisku,
  };
})(TROS);

if (typeof module !== 'undefined') module.exports = TROS;
