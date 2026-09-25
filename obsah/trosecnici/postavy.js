/* ============================================================
   Trosečníci – postavy.js: lidé, výprava, práce a noc.

   Čistá logika bez DOM.
   - Každý trosečník má jméno, profesi, zdraví a vzhled (portrét).
   - Výprava (1–3 lidé) chodí po mapě a sdílí akční body: první člen
     dá 12 AB, každý další +3. Profese členů výpravy dávají bonusy.
   - Ostatní mají přidělenou práci v táboře (u ohniště, bez něj u vraku).
     Práce proběhne v noci.
   - Na ostrově čekají nálezy – jednotlivci i skupiny. Přijetí přinese
     pracovní sílu, ale každý sní 1 🍖 a vypije 2 💧 za noc.
   ============================================================ */
var TROS = globalThis.TROS = globalThis.TROS || {};

(function (T) {
  'use strict';
  const { W, TEREN, SOUSEDE4, CHODIT, idx, uvnitr } = T.svet;
  const { Nahoda, smichej } = T.nahoda;

  const MAX_VYPRAVA = 3, AB_VEDOUCI = 12, AB_CLEN = 3;
  const DNI_CEKANI = 3;                      // jak dlouho počká odmítnutý trosečník

  const PROFESE = {
    trosecnik: { m: 'trosečník', z: 'trosečnice', ikona: '🧍', popis: 'Bez zvláštní dovednosti, ale pořád naživu.' },
    tesar:     { m: 'tesař', z: 'tesařka', ikona: '🪚', popis: 'Ve výpravě staví o třetinu rychleji. Jako dřevorubec +1 🪵.' },
    lekar:     { m: 'lékař', z: 'lékařka', ikona: '🩺', popis: 'Práce „Léčit": každému v táboře +10 ❤️ za noc. Ve výpravě +5 ❤️ všem členům.' },
    rybar:     { m: 'rybář', z: 'rybářka', ikona: '🎣', popis: 'Úlovky +50 % – ve výpravě i na molu.' },
    botanik:   { m: 'botanik', z: 'botanička', ikona: '🌿', popis: 'Pozná jedlé rostliny: bobule nikdy neotráví a dají +1 🍖. Při sběru +1 🍖.' },
    namornik:  { m: 'námořník', z: 'námořnice', ikona: '⚓', popis: 'Ve výpravě vidí z pláže o 2 pole dál.' },
    kuchar:    { m: 'kuchař', z: 'kuchařka', ikona: '🍲', popis: 'Když žije v táboře, uvaří z méně víc: tábor sní o 1 🍖 za noc méně.' },
  };
  const JMENA = {
    m: ['Jack', 'Miguel', 'Thomas', 'Pedro', 'Hans', 'Ivan', 'Kofi', 'Luca', 'Omar', 'Jan', 'Sven', 'Tomás', 'Kenji', 'Rafael', 'Viktor', 'Samuel'],
    z: ['Elena', 'Amelia', 'Rosa', 'Ingrid', 'Mei', 'Zara', 'Lucie', 'Marta', 'Aisha', 'Nora', 'Isabel', 'Hana', 'Freya', 'Leila', 'Sofie', 'Ana'],
  };
  const KUZE = ['#f1c7a1', '#e2b48a', '#c98e62', '#a86f45', '#7d4f2e', '#5a3820'];
  const VLASY = ['#2a1d14', '#5a3a1c', '#8a5a2e', '#c9a24a', '#b0482a', '#d8d2c4', '#141414'];
  const USES = { m: ['kratke', 'kratke', 'kudrny', 'plesaty', 'vousy', 'dlouhe'], z: ['dlouhe', 'dlouhe', 'culik', 'kudrny', 'kratke'] };
  const KOSILE = { trosecnik: '#f0ece0', tesar: '#b5793a', lekar: '#e8eef5', rybar: '#3b6fa8', botanik: '#5c9a3a', namornik: '#2c3e6b', kuchar: '#d8d0b8' };

  const PRACE = {
    vyprava:   { ikona: '🧭', nazev: 'Výprava' },
    sber:      { ikona: '🫐', nazev: 'Sběr jídla', popis: '+3 🍖 (botanik +4)' },
    voda:      { ikona: '💧', nazev: 'Nosit vodu', popis: 'Tábor do 8 polí od řeky: naplní všechny nádoby. Jinak +2 💧' },
    drevo:     { ikona: '🪓', nazev: 'Dřevorubec', popis: '+3 🪵 (tesař +1, se sekerou +1)' },
    kamen:     { ikona: '🪨', nazev: 'Kameník', popis: '+2 🪨 (+1, jsou-li skály do 6 polí)' },
    vlakna:    { ikona: '🌿', nazev: 'Pletení vláken', popis: '+3 🌿' },
    molo:      { ikona: '🎣', nazev: 'Rybář na molu', popis: '+6 🍖 (rybář +50 %), 1 člověk na molo' },
    policko:   { ikona: '🌾', nazev: 'Políčka', popis: 'Zralá políčka sklidí sám (+5 🍖 za každé)' },
    lod:       { ikona: '⛵', nazev: 'Stavba lodi', popis: '+4 práce na lodi za noc (tesař +6)' },
    lecit:     { ikona: '🩺', nazev: 'Léčit', popis: 'Každému v táboře +10 ❤️, s ošetřovnou +20 (jen lékař)' },
    odpocinek: { ikona: '💤', nazev: 'Odpočinek', popis: '+15 ❤️ sobě, nic nevyrobí' },
  };

  // --- tvorba postav ---------------------------------------------------------------
  function novaPostava(r, id, volby) {
    volby = volby || {};
    const rod = volby.rod || (r.sance(0.5) ? 'm' : 'z');
    const profese = volby.profese || r.vyber(['tesar', 'lekar', 'rybar', 'botanik', 'namornik', 'kuchar', 'trosecnik']);
    return {
      id, rod, profese, jmeno: volby.jmeno || r.vyber(JMENA[rod]),
      zdravi: volby.zdravi ?? r.cele(35, 75),
      role: volby.role || 'odpocinek',
      vzhled: volby.vzhled || { kuze: r.vyber(KUZE), vlasy: r.vyber(VLASY), uces: r.vyber(USES[rod]), kosile: KOSILE[profese] },
      den: volby.den || 1,
    };
  }
  function hrdina() {
    return { id: 0, rod: 'm', profese: 'trosecnik', jmeno: 'Ty', hrac: true, zdravi: 80, role: 'vyprava', den: 1,
      vzhled: { kuze: '#e2b48a', vlasy: '#5a3a1c', uces: 'kratke', kosile: '#f0ece0' } };
  }
  const nazevProfese = o => PROFESE[o.profese][o.rod];
  // „Marta (tesařka, 🪓 Dřevorubec)" – kdo to je a co zrovna dělá
  const kdoACo = o => o.hrac ? 'ty' : `${o.jmeno} (${nazevProfese(o)}, ${PRACE[o.role] ? PRACE[o.role].ikona + ' ' + PRACE[o.role].nazev : o.role})`;
  const zemrel = o => o.rod === 'z' ? 'zemřela' : 'zemřel';

  /* Nálezy: 5–7 míst na pláži/savaně daleko od startu; jednotlivci i skupiny.
     Jména se v jedné hře neopakují. */
  const POPISY_NALEZU = {
    1: ['Na pláži leží {jm}, sotva při vědomí – {prof} z vaší lodi.', 'Z křoví na tebe mává {jm}, {prof}. Přežil{a} na kusu stěžně.',
      'U zbytků ohně sedí {jm}, {prof}. Má zraněnou nohu.', 'Na skále {jm} ({prof}) zkouší chytat kraby holýma rukama.'],
    2: ['Dva přeživší ve stínu palmy: {jmena}. Sdílí poslední kokos.', 'Na pobřeží jsou dva lidé: {jmena}. Postavili si SOS z kamenů.'],
    3: ['Převrácený člun a pod ním tři lidé: {jmena}!', 'Na pláži stojí tři hubené postavy: {jmena}. Někdo zapálil signální oheň.'],
  };
  function rozmistiNalezy(s) {
    const r = Nahoda(smichej(s.seed, 4242, 1));
    const svet = s.svet, st = idx(svet.start.x, svet.start.y);
    const d = T.svet.bfs([st], i => CHODIT[svet.teren[i]]);
    const kand = [];
    for (let i = 0; i < W * W; i++) {
      const t = svet.teren[i];
      if ((t === TEREN.PLAZ || t === TEREN.SAVANA) && d[i] >= 10 && !svet.obj[i] && svet.lokNa[i] < 0) kand.push(i);
    }
    r.zamichej(kand);
    const pocet = r.cele(5, 7), mista = [];
    const pouzita = new Set(['Ty']);
    let id = 1;
    for (const i of kand) {
      if (mista.length >= pocet) break;
      const x = i % W, y = (i / W) | 0;
      if (mista.some(m => Math.hypot(m.x - x, m.y - y) < 9)) continue;
      if (svet.lokace.some(l => Math.hypot(l.x - x, l.y - y) < 4)) continue;
      const vel = r.sance(0.12) ? 3 : r.sance(0.2) ? 2 : 1;
      const lide = [];
      for (let k = 0; k < vel; k++) {
        let o;
        for (let pokus = 0; pokus < 20; pokus++) { o = novaPostava(r, id); if (!pouzita.has(o.jmeno)) break; }
        pouzita.add(o.jmeno); id++;
        lide.push(o);
      }
      mista.push({ x, y, lide, stav: 'skryto', popis: r.vyber(POPISY_NALEZU[vel]) });
    }
    s.dalsiId = id;
    return mista;
  }
  function textNalezu(n) {
    const o = n.lide[0];
    const jmena = n.lide.map(o => `${o.jmeno} (${nazevProfese(o)})`);
    return n.popis.replace('{jm}', o.jmeno).replace('{prof}', nazevProfese(o)).replace('{a}', o.rod === 'z' ? 'a' : '')
      .replace('{jmena}', jmena.slice(0, -1).join(', ') + (jmena.length > 1 ? ' a ' : '') + jmena[jmena.length - 1]);
  }

  // --- dotazy ------------------------------------------------------------------------
  const vyprava = s => s.lide.filter(o => o.role === 'vyprava');
  const vTabore = s => s.lide.filter(o => o.role !== 'vyprava');
  function maProfesi(s, prof, kde) {
    const kdo = kde === 'vyprava' ? vyprava(s) : kde === 'tabor' ? vTabore(s) : s.lide;
    return kdo.some(o => o.profese === prof);
  }
  // domov = ohniště, bez tábora pláž u vraku (start)
  function domov(s) {
    const o = T.stavby.ohniste(s);
    return o ? { x: o.i % W, y: (o.i / W) | 0, tabor: true } : { x: s.svet.start.x, y: s.svet.start.y, tabor: false };
  }
  function vypravaDoma(s) {
    const d = domov(s);
    return Math.max(Math.abs(d.x - s.hrac.x), Math.abs(d.y - s.hrac.y)) <= T.stavby.DOSAH_TABORA;
  }
  function abVypravy(s) {
    let ab = 0;
    vyprava(s).forEach((o, k) => {
      const slabost = (o.zdravi < 50 ? 2 : 0) + (o.zdravi < 25 ? 2 : 0);
      ab += k === 0 ? AB_VEDOUCI - slabost : Math.max(0, AB_CLEN - Math.ceil(slabost / 2));
    });
    return Math.max(1, ab);
  }
  function vedouci(s) { return vyprava(s)[0] || s.lide[0]; }

  // role, které může člověk dostat, s důvodem, proč ne
  function moznostiRole(s, o) {
    const v = [];
    const doma = vypravaDoma(s);
    for (const [role, P] of Object.entries(PRACE)) {
      let duvod = null;
      if (role === 'vyprava') {
        if (o.role !== 'vyprava' && vyprava(s).length >= MAX_VYPRAVA) duvod = `Výprava má nejvýš ${MAX_VYPRAVA} lidi.`;
        else if (o.role !== 'vyprava' && !doma) duvod = 'Výprava si lidi vezme, až bude doma v táboře.';
      } else {
        if (o.role === 'vyprava' && vyprava(s).length <= 1) duvod = 'Někdo musí vést výpravu.';
        else if (o.role === 'vyprava' && !doma) duvod = 'Z výpravy můžeš poslat lidi do tábora, jen když jste doma.';
        else if (role === 'molo') {
          const mol = T.stavby.pocet(s, 'molo'), obsazeno = s.lide.filter(x => x !== o && x.role === 'molo').length;
          if (!mol) duvod = 'Chybí molo.'; else if (obsazeno >= mol) duvod = 'Na každém molu může rybařit jen jeden.';
        } else if (role === 'policko' && !T.stavby.ma(s, 'policko')) duvod = 'Chybí políčko.';
        else if (role === 'lecit' && o.profese !== 'lekar') duvod = 'Léčit umí jen lékař.';
        else if (role === 'lod' && !s.lod) duvod = 'Chybí loděnice.';
        else if (role === 'lod' && T.tajemstvi && T.tajemstvi.hotova(s)) duvod = 'Loď je hotová.';
      }
      v.push({ role, ikona: P.ikona, nazev: P.nazev, popis: P.popis || '', duvod });
    }
    return v;
  }
  function nastavRoli(s, id, role) {
    const o = s.lide.find(x => x.id === id);
    if (!o || !PRACE[role]) return { ok: false, duvod: 'Neznámý člověk nebo práce.' };
    if (o.role === role) return { ok: true };
    const m = moznostiRole(s, o).find(k => k.role === role);
    if (m.duvod) return { ok: false, duvod: m.duvod };
    const bylVyprava = o.role === 'vyprava';
    o.role = role;
    delete o.puvodniRole;                 // hráč rozhodl sám – po uzdravení už nic nevracet
    // změna velikosti výpravy mění dnešní AB (přidaný člen přinese své síly, odchozí je odnese)
    if (bylVyprava !== (role === 'vyprava')) {
      const pred = s.abMax;
      s.abMax = abVypravy(s);
      s.ab = Math.max(0, Math.min(s.abMax, s.ab + (s.abMax - pred)));
    }
    return { ok: true };
  }

  // --- nálezy ------------------------------------------------------------------------
  // nález na poli trosečníka nebo vedle něj, kterému se ještě dá nabídnout místo
  function nalezUVypravy(s) {
    const { x, y } = s.hrac;
    return (s.nalezy || []).findIndex(n => (n.stav === 'skryto' || n.stav === 'odmitnuto') &&
      Math.abs(n.x - x) + Math.abs(n.y - y) <= 1);
  }
  function prijmi(s, k) {
    const n = s.nalezy[k];
    if (!n || n.stav === 'prijato' || n.stav === 'zmizel') return { ok: false, duvod: 'Tady už nikdo není.' };
    n.stav = 'prijato';
    const kam = [];
    for (const o of n.lide) {
      o.den = s.den;
      o.role = vyprava(s).length < MAX_VYPRAVA ? 'vyprava' : 'odpocinek';
      s.lide.push(o);
      kam.push(o.role === 'vyprava' ? `${o.jmeno} se přidává k výpravě` : `${o.jmeno} jde odpočívat do tábora`);
    }
    const pred = s.abMax; s.abMax = abVypravy(s); s.ab = Math.max(0, Math.min(s.abMax, s.ab + (s.abMax - pred)));
    return { ok: true, text: `Přijal jsi do tábora: ${n.lide.map(o => o.jmeno).join(', ')}. ${kam.join(', ')}.` };
  }
  function odmitni(s, k) {
    const n = s.nalezy[k];
    if (!n) return { ok: false };
    if (n.stav !== 'odmitnuto') { n.stav = 'odmitnuto'; n.dokdy = s.den + DNI_CEKANI; }
    return { ok: true, text: `Nechal jsi je být. ${n.lide.length > 1 ? 'Počkají' : 'Počká'} tu ještě nejvýš ${DNI_CEKANI} dny.` };
  }

  // --- noc ------------------------------------------------------------------------------
  /* Práce, jídlo a pití, spánek, léčení, úmrtí. Vrací souhrn pro obrazovku noci. */
  /* Co v noci vyrobí lidé v táboře (bez změny stavu, kromě sklizně při proved = true).
     Vrací { vyroba: {surovina: n}, plnitVodu } – plnitVodu = nosič u řeky naplní všechny nádoby. */
  function vyrobaNoci(s, proved) {
    const d = domov(s), vyroba = {};
    const pridej = (k, n) => { if (n > 0) vyroba[k] = (vyroba[k] || 0) + n; };
    const tabor = vTabore(s);
    const nasobek = d.tabor ? 1 : 0.5;                 // bez tábora se pracuje hůř
    const blizko = (podm, dosah) => {
      for (let y = d.y - dosah; y <= d.y + dosah; y++) for (let x = d.x - dosah; x <= d.x + dosah; x++)
        if (uvnitr(x, y) && podm(s.svet.teren[idx(x, y)])) return true;
      return false;
    };
    let plnitVodu = false;
    let mola = s.stavby.filter(b => b.typ === 'molo' && !b.poskozeno).length;
    let sklizeno = false;
    for (const o of tabor) {
      switch (o.role) {
        case 'sber': pridej('jidlo', Math.floor((3 + (o.profese === 'botanik' ? 1 : 0)) * nasobek)); break;
        case 'voda':
          // tábor u řeky: nosič naplní všechny nádoby (výprava nemusí denně pro vodu)
          if (d.tabor && blizko(t => t === TEREN.REKA, 8)) plnitVodu = true;
          else pridej('voda', Math.floor(2 * nasobek));
          break;
        case 'drevo': pridej('drevo', Math.floor((3 + (o.profese === 'tesar' ? 1 : 0) + (s.predmety.includes('sekera') ? 1 : 0)) * nasobek)); break;
        case 'kamen': pridej('kamen', Math.floor((2 + (blizko(t => t === TEREN.SKALY || t === TEREN.SOPKA, 6) ? 1 : 0) + (s.predmety.includes('krumpac') ? 1 : 0)) * nasobek)); break;
        case 'vlakna': pridej('vlakna', Math.floor(3 * nasobek)); break;
        case 'molo':
          if (mola-- > 0) {
            const efekt = T.udalosti ? (T.udalosti.efekt(s, 'zraloci') ? 0.5 : 1) * (T.udalosti.efekt(s, 'hejno') ? 1.5 : 1) : 1;
            pridej('jidlo', Math.round(6 * (o.profese === 'rybar' ? 1.5 : 1) * efekt) + (T.stavby.ma(s, 'ohniste') ? 1 : 0)
              + (s.predmety.includes('udice') ? 1 : 0) + (s.predmety.includes('site') ? 2 : 0));
          }
          break;
        case 'policko':
          if (sklizeno) break;                             // všechna zralá políčka stačí sklidit jednou
          sklizeno = true;
          for (const b of s.stavby) if (b.typ === 'policko' && b.zraje <= s.den) {
            pridej('jidlo', T.stavby.POLICKO_UROD || 5); if (proved) b.zraje = s.den + T.stavby.POLICKO_DALSI;
          }
          break;
      }
    }
    return { vyroba, plnitVodu };
  }

  /* Odhad dnešní noci pro varování: kolik vody a jídla bude k večeři
     (zásoby + sběrače/déšť + práce lidí) proti tomu, kolik se sní a vypije. */
  function odhadNoci(s) {
    const n = s.lide.length;
    const potrebaV = n * (T.pocasi && s.pocasi ? T.pocasi.vodaNaOsobu(s) : 2);
    const kuchar = maProfesi(s, 'kuchar', 'tabor') && n >= 3 ? 1 : 0;
    const potrebaJ = Math.max(0, n - kuchar);
    const kap = T.stavby.kapacita(s, 'voda');
    const vn = T.stavby.vodaNaNoc(s), v = vyrobaNoci(s, false);
    let voda = vn.plne ? kap : Math.min(kap, s.zasoby.voda + vn.voda + vn.dzban);
    if (v.plnitVodu) voda = Math.max(voda, kap);
    voda += v.vyroba.voda || 0;
    const jidlo = s.zasoby.jidlo + (v.vyroba.jidlo || 0);
    return { voda, jidlo, potrebaV, potrebaJ, nosic: v.plnitVodu, vyrobaJidla: v.vyroba.jidlo || 0, pritokVody: voda - s.zasoby.voda };
  }

  /* Bilance nejbližší noci pro každou surovinu: { k: { ted, potom, zmena, prace, pritok, spotreba, nazmar } }.
     Stejné výpočty jako skutečná noc (bez ranních událostí a bez polámaných větví po bouři). */
  function bilanceNoci(s) {
    const o = odhadNoci(s), v = vyrobaNoci(s, false), z = s.zasoby, vysl = {};
    const kap = k => T.stavby.kapacita(s, k);
    for (const k of Object.keys(z)) {
      let potom, pritok = 0, prace = v.vyroba[k] || 0, spotreba = 0;
      if (k === 'voda') {
        spotreba = Math.min(o.voda, o.potrebaV);
        pritok = o.voda - z.voda - prace;                 // sběrače, déšť, džbán, nosiči u řeky
        potom = o.voda - spotreba;
      } else if (k === 'jidlo') {
        // stejně jako v noci: kuchař přidá 1 porci do hrnce, ušetřené jídlo se ale neuskladní
        const kuchar = s.lide.length - o.potrebaJ, hrnec = o.jidlo + kuchar;
        const zbyde = hrnec - Math.min(hrnec, s.lide.length);
        potom = Math.min(o.jidlo, zbyde);
        spotreba = o.jidlo - potom;
      } else potom = z[k] + prace;
      const limit = Math.min(potom, kap(k));
      vysl[k] = { ted: z[k], potom: limit, zmena: limit - z[k], prace, pritok, spotreba, nazmar: potom - limit };
    }
    return vysl;
  }

  function noc(s, r) {
    const d = domov(s), zpravy = [];
    const tabor = vTabore(s);
    const pocasi = T.pocasi && s.pocasi ? T.pocasi.dnes(s) : null;
    const potrebaV = T.pocasi && s.pocasi ? T.pocasi.vodaNaOsobu(s) : 2;
    const { vyroba, plnitVodu } = vyrobaNoci(s, true);
    // výroba jde nejdřív na večeři, limit skladu se uplatní až na to, co zbude
    if (plnitVodu) {
      const dolit = Math.max(0, T.stavby.kapacita(s, 'voda') - s.zasoby.voda);
      if (dolit) vyroba.voda = (vyroba.voda || 0) + dolit;
      zpravy.push('Nosiči vody naplnili všechny nádoby.');
    }
    const vyrobeno = { ...vyroba };
    for (const k in vyroba) s.zasoby[k] += vyroba[k];

    // jídlo a pití: nejdřív ti nejslabší
    const lide = s.lide.slice().sort((a, b) => a.zdravi - b.zdravi);
    const kuchar = maProfesi(s, 'kuchar', 'tabor') && s.lide.length >= 3 ? 1 : 0;
    let jidlo = s.zasoby.jidlo + kuchar, voda = s.zasoby.voda;
    const stav = new Map();
    for (const o of lide) {
      const j = jidlo >= 1 ? 1 : 0; jidlo -= j;
      const v = Math.min(potrebaV, voda); voda -= v;
      // ve vedru je třetí dávka navíc – když chybí jen ta, je to mírnější (−8 ❤️)
      stav.set(o, { chybiJ: 1 - j, chybiV: Math.max(0, 2 - v), horko: v >= 2 && v < potrebaV, zmena: 0 });
    }
    const zbyloJ = Math.min(s.zasoby.jidlo, jidlo);   // kuchařova úspora se nedá uskladnit
    const snedeno = s.zasoby.jidlo - zbyloJ, vypito = s.zasoby.voda - voda;
    s.zasoby.jidlo = zbyloJ; s.zasoby.voda = voda;
    const propadlo = {};
    for (const k in s.zasoby) {
      const kap = T.stavby.kapacita(s, k);
      if (s.zasoby[k] > kap) { propadlo[k] = s.zasoby[k] - kap; s.zasoby[k] = kap; }
    }
    if (Object.keys(propadlo).length) zpravy.push('Nevešlo se do zásob a přišlo nazmar: ' +
      Object.entries(propadlo).map(([k, v]) => `${v} ${{ jidlo: '🍖', voda: '💧', drevo: '🪵', kamen: '🪨', vlakna: '🌿' }[k]}`).join(', ') + '.');

    // úkryty: chatrč 3 místa (+10), přístřešek 2 (+5); výprava jen v úkrytech do 1 pole
    const mista = [];
    for (const b of s.stavby) {
      if (b.poskozeno) continue;
      if (b.typ === 'chatrc') for (let k = 0; k < 3; k++) mista.push({ b, bonus: 10 });
      if (b.typ === 'pristresek') for (let k = 0; k < 2; k++) mista.push({ b, bonus: 5 });
    }
    mista.sort((a, b) => b.bonus - a.bonus);
    const uVypravy = b => Math.max(Math.abs(b.i % W - s.hrac.x), Math.abs(((b.i / W) | 0) - s.hrac.y)) <= 1;
    const ohnisteU = T.stavby.ohniste(s);
    const vyp = vyprava(s), clenu = vyp.length;
    for (const o of lide) {
      const x = stav.get(o), veVyprave = o.role === 'vyprava';
      const volne = mista.findIndex(m => !veVyprave || uVypravy(m.b));
      if (volne >= 0) { x.zmena += mista[volne].bonus; x.ukryt = mista[volne].b.typ; mista.splice(volne, 1); }
      if (ohnisteU && (!veVyprave || uVypravy(ohnisteU))) x.zmena += 2;
    }
    const lekarVTabore = tabor.some(o => o.role === 'lecit' && o.profese === 'lekar');
    const lekarVeVyprave = maProfesi(s, 'lekar', 'vyprava');
    const doma = vypravaDoma(s);
    for (const o of lide) {
      const x = stav.get(o), veVyprave = o.role === 'vyprava';
      if (x.chybiJ) { x.zmena -= 15; s.stat.hladoveNoci++; }
      if (x.chybiV) { x.zmena -= 20 * x.chybiV; s.stat.zizniveNoci++; }
      if (x.horko) x.zmena -= 8;
      if (!x.chybiJ && !x.chybiV) x.zmena += veVyprave ? 6 + Math.floor(s.ab / clenu) : 4;
      const osetrovna = T.stavby.ma(s, 'osetrovna') && (!veVyprave || doma);
      if (o.role === 'odpocinek') x.zmena += 15 + (osetrovna ? 10 : 0);
      if (lekarVTabore && (!veVyprave || doma)) x.zmena += osetrovna ? 20 : 10;
      if (lekarVeVyprave && veVyprave) x.zmena += 5;
      if ((pocasi === 'dest' || pocasi === 'boure') && !x.ukryt) { x.zmena -= pocasi === 'boure' ? 10 : 3; x.promokl = true; }
      if (T.udalosti) {
        const nm = T.udalosti.nemocVNoci(s, o);
        x.zmena += nm.zmena; if (nm.zmena < 0) x.nemoc = true;
        if (nm.zprava) zpravy.push(nm.zprava);
      }
      x.pred = o.zdravi;
      o.zdravi = Math.max(0, Math.min(100, o.zdravi + x.zmena));
    }
    // úmrtí
    const mrtvi = [];
    for (const o of lide) {
      if (o.zdravi > 0) continue;
      const x = stav.get(o);
      const pricina = x.chybiV ? 'žízeň' : x.chybiJ ? 'hlad' : x.nemoc ? 'horečka' : x.promokl ? 'bouře' : 'vyčerpání';
      s.lide.splice(s.lide.indexOf(o), 1);
      s.mrtvi.push({ jmeno: o.jmeno, rod: o.rod, profese: nazevProfese(o), den: s.den, pricina, hrac: !!o.hrac });
      mrtvi.push(o);
    }
    // kdo se uzdravil, vrací se ke své práci (nesmí zůstat odpočívat)
    for (const o of s.lide) {
      if (!o.puvodniRole || o.role !== 'odpocinek') { if (o.puvodniRole && o.role !== 'odpocinek') delete o.puvodniRole; continue; }
      const nemocZitra = (s.efekty || []).some(e => e.typ === 'nemoc' && e.id === o.id && e.do > s.den);
      if (nemocZitra) continue;
      let cil = o.puvodniRole; delete o.puvodniRole;
      const m = moznostiRole(s, o).find(k => k.role === cil);
      if (!m || m.duvod || cil === 'vyprava') cil = 'sber';
      o.role = cil;
      zpravy.push(`${o.jmeno} se uzdravil${o.rod === 'z' ? 'a' : ''} a vrací se k práci: ${PRACE[cil].ikona} ${PRACE[cil].nazev}.`);
    }
    // výprava nesmí zůstat bez vedoucího
    if (s.lide.length && !vyprava(s).length) {
      const novy = s.lide.slice().sort((a, b) => b.zdravi - a.zdravi)[0];
      novy.role = 'vyprava';
      zpravy.push(`Výpravu teď vede ${novy.jmeno}.`);
    }
    const horko = lide.filter(o => stav.get(o).horko).length;
    if (horko) zpravy.push(`Ve vedru nezbyla třetí dávka vody pro ${horko} (−8 ❤️).`);
    const promokli = lide.filter(o => stav.get(o).promokl).length;
    if (promokli) zpravy.push(pocasi === 'boure' ? `Bouře: ${promokli} bez střechy nad hlavou (−10 ❤️).` : `V dešti bez střechy promokl${promokli > 1 ? 'o' : ''} ${promokli} (−3 ❤️).`);
    return { vyrobeno, snedeno, vypito, kuchar, stav, mrtvi, zpravy, potrebaV, lide: lide.filter(o => o.zdravi > 0 || mrtvi.includes(o)) };
  }

  // nálezy, které se nedočkaly
  function rano(s) {
    const zpravy = [];
    for (const n of s.nalezy || []) {
      if (n.stav === 'odmitnuto' && s.den > n.dokdy) {
        n.stav = 'zmizel';
        zpravy.push(n.lide.length > 1 ? 'Lidé, které jsi nechal na pobřeží, odešli. Kam, to nikdo neví.' : `${n.lide[0].jmeno} už na pobřeží není. Zbyly jen stopy v písku.`);
      }
    }
    return zpravy;
  }

  T.postavy = {
    PROFESE, PRACE, MAX_VYPRAVA, AB_VEDOUCI, AB_CLEN, DNI_CEKANI,
    novaPostava, hrdina, rozmistiNalezy, textNalezu, nazevProfese, kdoACo, zemrel,
    vyprava, vTabore, maProfesi, domov, vypravaDoma, abVypravy, vedouci,
    moznostiRole, nastavRoli, nalezUVypravy, prijmi, odmitni, noc, rano, vyrobaNoci, odhadNoci, bilanceNoci,
  };
})(TROS);

if (typeof module !== 'undefined') module.exports = TROS;
