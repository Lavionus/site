/* Dopravní magnát – stav hry a simulace (bez DOM, jde do node).
   Pevný krok: krok(h) = 1 tick, D.DEN_TICKU ticků = 1 den. Náhoda jen z h.nah (seed v uložené hře).
   Stavby vrací {ok, cena, chyba}; s parametrem jenCena nic nemění (náhled ceny).
   Změny mapy, které má prohlížeč překreslit, se sbírají do h.zmeny ([x0, y0, x1, y1]),
   zprávy pro hráče do h.zpravy ({den, text, x, y}). */
(function (MAG) {
  'use strict';
  const D = MAG.data, M = MAG.mapa, C = MAG.cesty, T = D.T, S4 = M.SOUSEDE4;
  const DT = D.DEN_TICKU;

  // --- založení -------------------------------------------------------------------
  function novaHra(mapa, opt = {}) {
    // začátek: běžná hra 1920/1950/1980/2010, scénář libovolný rok 1920–2040
    const rok0 = D.ZACATECNI_ROKY.includes(+opt.rok) || (opt.scenar && +opt.rok >= 1920 && +opt.rok <= 2040) ? +opt.rok : 1950;
    const h = {
      verze: 1, m: mapa, rok0, den: 0, tick: 0,
      firma: { jmeno: opt.jmeno || 'Moje doprava', barva: opt.barva || D.BARVY_FIRMY[0], penize: opt.penize ?? 100000, uver: opt.uver ?? 100000, maxUver: opt.maxUver ?? 300000, urok: 0.04,
        servis: 150, obnova: false },   // servis = interval automatického servisu ve dnech (0 = vypnuto), obnova = automatická obnova dosloužilých
      fin: { letos: {}, loni: {}, mesice: [] },
      stanice: [], depa: [], vozidla: [], rez: {},   // rez: pole → id vlaku (rezervace cesty za návěstidlem)
      akum: [],               // akumulace cestujících/pošty po domech: [lide, posta] na dům
      prum: mapa.prumysl.map(() => ({ vstup: 0, zasoba: {}, mesic: {}, minuly: {} })),
      cislo: { bus: 0, nakl: 0 },
      // velká města od začátku se neohlašují zprávou (potřebu ukáže okno města)
      mestaStat: mapa.mesta.map(c => ({ hodn: 0, mesic: {}, minuly: {}, hlasenoJidlo: c.obyv > 1500, hlasenoVoda: c.obyv > 3000 })),   // hodnocení firmy městem (−1000…1000) a měsíční statistiky
      ekonomika: { krize: 0 },
      nahStav: MAG.hash(mapa.seed, 'hra') | 0,
      zmeny: [], zpravy: [], prvni: {},
    };
    h.nah = MAG.Nahoda(1); h.nah.nastav(h.nahStav);
    return h;
  }

  // --- datum ------------------------------------------------------------------------
  const MS_DEN = 86400000;
  function datum(h, den = h.den) {
    const d = new Date(Date.UTC(h.rok0, 0, 1) + den * MS_DEN);
    return { rok: d.getUTCFullYear(), mesic: d.getUTCMonth() + 1, den: d.getUTCDate() };
  }
  const rok = h => datum(h).rok;

  // --- peníze -------------------------------------------------------------------------
  function zauctuj(h, kat, castka) {
    h.firma.penize += castka;
    h.fin.letos[kat] = (h.fin.letos[kat] || 0) + castka;
    const ms = statistika(h).mesic;
    if (castka > 0) ms.prijmy += castka; else ms.vydaje -= castka;
  }
  // měsíční a souhrnné statistiky (grafy, úspěchy, výroční zpráva)
  function statistika(h) {
    if (!h.stat) h.stat = { mesic: { prijmy: 0, vydaje: 0, preprava: {} }, celkem: { preprava: {}, prijmy: 0 } };
    return h.stat;
  }
  function zapisPrepravu(h, st, typ, n, druh) {
    const s = statistika(h);
    s.mesic.preprava[typ] = (s.mesic.preprava[typ] || 0) + n;
    s.celkem.preprava[typ] = (s.celkem.preprava[typ] || 0) + n;
    s.celkem['vozem_' + druh] = (s.celkem['vozem_' + druh] || 0) + n;
    s.celkem[druh + '_' + typ] = (s.celkem[druh + '_' + typ] || 0) + n;   // podle druhu vozidla a nákladu (cíle scénářů)
    if (!st.mesic) st.mesic = { nalozeno: {}, vylozeno: {} };
    st.mesic.vylozeno[typ] = (st.mesic.vylozeno[typ] || 0) + n;
  }
  const nemaNa = (h, cena) => cena > 0 && h.firma.penize < cena;
  function uver(h, zmena) {
    const f = h.firma;
    if (zmena > 0) { const n = Math.min(zmena, f.maxUver - f.uver); if (n <= 0) return { ok: false, chyba: 'Úvěr je na maximu' }; f.uver += n; f.penize += n; return { ok: true }; }
    const n = Math.min(-zmena, f.uver);
    if (n <= 0) return { ok: false, chyba: 'Žádný úvěr' };
    if (f.penize < n) return { ok: false, chyba: 'Nedostatek peněz na splátku' };
    f.uver -= n; f.penize -= n; return { ok: true };
  }

  // --- stavby: pomocné ------------------------------------------------------------------
  const idx = (h, x, y) => y * h.m.W + x;
  function cenaPole(m, x, y) {
    const i = y * m.W + x;
    return (M.jeRovne(m, x, y) ? 0 : D.CENY.svah) + m.les[i] * D.CENY.kaceni;
  }
  function zmena(h, x0, y0, x1, y1) { h.zmeny.push([Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)]); }
  function vysledek(h, cena, jenCena, kat, provest) {
    if (jenCena) return { ok: true, cena };
    if (nemaNa(h, cena)) return { ok: false, cena, chyba: `Nedostatek peněz (potřeba ${penizeText(cena)})` };
    provest();
    zauctuj(h, kat, -cena);
    return { ok: true, cena };
  }
  const penizeText = n => '$' + Math.round(n).toLocaleString('cs-CZ');

  // pole rovné čáry od (x0,y0) k (x1,y1) – převládající osa
  function cara(x0, y0, x1, y1) {
    const p = [];
    if (Math.abs(x1 - x0) >= Math.abs(y1 - y0)) { const s = Math.sign(x1 - x0) || 1; for (let x = x0; x !== x1 + s; x += s) p.push([x, y0]); }
    else { const s = Math.sign(y1 - y0); for (let y = y0; y !== y1 + s; y += s) p.push([x0, y]); }
    return p;
  }

  // tramvajová kolej: tažením po existující silnici (i obecní) nebo přes silniční garáž
  function postavTramKolej(h, x0, y0, x1, y1, jenCena) {
    const m = h.m, pole = cara(x0, y0, x1, y1), nova = [];
    for (const [x, y] of pole) {
      if (!M.uvnitr(m, x, y)) return { ok: false, chyba: 'Mimo mapu' };
      const i = idx(h, x, y);
      if (!m.cesta[i] && !(m.depo[i] && !m.kolej[i] && m.typ[i] !== T.VODA && !m.stan[i])) return { ok: false, chyba: `Tramvajová kolej se klade do silnice – nejdřív silnice (${x}, ${y})` };
      if (m.depo[i] && m.typ[i] === T.VODA) return { ok: false, chyba: 'Do loděnice ne' };
      if (!m.tram[i]) nova.push(i);
    }
    if (!nova.length) return { ok: false, cena: 0, chyba: 'Tramvajová kolej tu už vede' };
    return vysledek(h, nova.length * D.CENY.tram, jenCena, 'stavba', () => {
      for (const i of nova) m.tram[i] = 1;
      zmena(h, Math.min(x0, x1) - 1, Math.min(y0, y1) - 1, Math.max(x0, x1) + 1, Math.max(y0, y1) + 1);
      h.sitVerze = (h.sitVerze || 0) + 1;
    });
  }

  /* Stavba po trase (indexy polí) z nástroje tažením: rozdělí ji na rovné úseky a každý postaví jako rovnou čáru
     (pravidla přejezdů, zastávek a ceny zůstávají). Úsek, kde už vše vede, se přeskočí. */
  function postavPoTrase(h, trasa, druh, jenCena) {
    const fn = druh === 'kolej' ? MAG.zeleznice.postavKolej : postavSilnici;
    const us = C.useky(h.m, trasa);
    if (!us.length) return { ok: false, cena: 0, chyba: 'Táhni aspoň přes dvě pole' };
    let cena = 0, neco = false;
    const m = h.m, kolej = druh === 'kolej';
    us.forEach(([x0, y0, x1, y1], k) => {
      if (cena === null) return;
      const r = fn(h, x0, y0, x1, y1, true);
      if (!r.ok) { if (!/už vede/.test(r.chyba || '')) cena = null, neco = r; return; }
      cena += r.cena; neco = neco || true;
      // rohové pole sdílí s předchozím úsekem: je-li nové, počítá ho už předchozí úsek (kolej tu jen přidá směr)
      const i = y0 * m.W + x0;
      if (k > 0 && !(kolej ? m.kolej[i] : m.cesta[i]) && !m.most[i]) cena -= (kolej ? D.CENY.kolej - 60 : D.CENY.silnice) + cenaPole(m, x0, y0);
    });
    if (cena === null) return neco;
    if (!neco) return { ok: false, cena: 0, chyba: druh === 'kolej' ? 'Kolej tu už vede' : 'Silnice tu už vede' };
    if (jenCena) return { ok: true, cena };
    if (nemaNa(h, cena)) return { ok: false, cena, chyba: `Nedostatek peněz (potřeba ${penizeText(cena)})` };
    for (const [x0, y0, x1, y1] of us) fn(h, x0, y0, x1, y1);
    return { ok: true, cena };
  }

  function postavSilnici(h, x0, y0, x1, y1, jenCena) {
    const m = h.m, pole = cara(x0, y0, x1, y1);
    let cena = 0;
    const nova = [];
    const mosty = MAG.zeleznice ? MAG.zeleznice.mostyNaCare(m, pole, Math.abs(x1 - x0) >= Math.abs(y1 - y0) ? 1 : 2) : { most: new Map() };
    if (mosty.chyba) return { ok: false, chyba: mosty.chyba };
    for (const [x, y] of pole) {
      if (!M.uvnitr(m, x, y)) return { ok: false, chyba: 'Mimo mapu' };
      const i = idx(h, x, y);
      if (m.cesta[i]) continue;
      if (m.dum[i] || m.prum[i] || m.depo[i]) return { ok: false, chyba: `Pole ${x}, ${y} je zastavěné` };
      if (mosty.most.has(i)) { cena += D.CENY.most; nova.push(i); continue; }
      if (m.tunel[i]) return { ok: false, chyba: `Nad tunelem silnici nepostavíš (${x}, ${y})` };
      if (m.kolej[i]) {
        // přejezd: jen přes rovnou kolej napříč, ne přes nádraží a most
        const k = m.kolej[i], silniceX = Math.abs(x1 - x0) >= Math.abs(y1 - y0);
        const kolejX = (k & 0b1010) !== 0, kolejY = (k & 0b0101) !== 0;
        if (m.stan[i] || m.most[i] || (kolejX && kolejY) || (silniceX ? kolejX : kolejY)) return { ok: false, chyba: `Přejezd jen přes rovnou kolej napříč (${x}, ${y})` };
        cena += 400;
      }
      cena += D.CENY.silnice + cenaPole(m, x, y);
      nova.push(i);
    }
    if (!nova.length) return { ok: false, cena: 0, chyba: 'Silnice tu už vede' };
    return vysledek(h, cena, jenCena, 'stavba', () => {
      for (const i of nova) {
        vykacet(h, i);
        m.cesta[i] = 2; m.les[i] = 0; if (m.typ[i] === T.POLE) m.typ[i] = T.TRAVA;
        if (mosty.most.has(i)) { m.most[i] = Math.abs(x1 - x0) >= Math.abs(y1 - y0) ? 1 : 2; m.mostV[i] = mosty.most.get(i); }
      }
      zmena(h, x0, y0, x1, y1);
      h.sitVerze = (h.sitVerze || 0) + 1;
    });
  }

  // osa zastávky podle napojených sousedních silnic; null = křižovatka (nejde)
  function osaZastavky(m, x, y, chtena) {
    const i = y * m.W + x;
    const ma = d => { const j = C.soused(m, i, d); return j >= 0 && (m.cesta[j] || (m.depo[j] && m.smer[j] - 1 === ((d + 2) & 3))); };
    const podelX = ma(1) || ma(3), podelY = ma(0) || ma(2);
    if (podelX && podelY) return null;
    return podelX ? 1 : podelY ? 2 : (chtena || 1);
  }

  function nazevStanice(h, x, y) {
    const m = h.m;
    const c = m.mesta.reduce((a, b) => !a || Math.hypot(b.x - x, b.y - y) < Math.hypot(a.x - x, a.y - y) ? b : a, null);
    const zaklad = c ? c.jmeno : 'Stanice';
    const pripony = ['', ' Náměstí', ' Sever', ' Jih', ' Východ', ' Západ', ' Trh', ' Park', ' Kopec', ' Údolí', ' Most', ' Brána'];
    for (const p of pripony) if (!h.stanice.some(s => s && s.jmeno === zaklad + p)) return { jmeno: zaklad + p, mesto: c ? c.id : -1 };
    let n = 2; while (h.stanice.some(s => s && s.jmeno === `${zaklad} ${n}`)) n++;
    return { jmeno: `${zaklad} ${n}`, mesto: c ? c.id : -1 };
  }

  // --- hodnocení firmy městem ---------------------------------------------------------------
  const DOSAH_OBCE = 12;
  function obecU(h, x, y) {
    let nej = null, nd = DOSAH_OBCE + 1;
    for (const c of h.m.mesta) { const d = Math.abs(c.x - x) + Math.abs(c.y - y); if (d < nd) { nd = d; nej = c; } }
    return nej;
  }
  const HODNOCENI = [[600, 'Výborné'], [300, 'Velmi dobré'], [100, 'Dobré'], [-100, 'Průměrné'], [-300, 'Špatné'], [-600, 'Velmi špatné'], [-1001, 'Hrozné']];
  const hodnoceniText = n => HODNOCENI.find(([p]) => n >= p)[1];
  /* Úprava terénu tažením obdélníku (rohy x0..x1+1 × y0..y1+1): zvednout / snížit o 1, srovnat na výšku rohu (x0, y0).
     Okolí doladí M.terraformuj (sousední rohy se liší nejvýš o 1); rohy polí se stavbami, cestami, kolejemi, řekou
     a podniky jsou chráněné – když by se jich změna dotkla, nic se neprovede. Cena podle počtu změněných rohů. */
  function upravTeren(h, ax, ay, bx, by, rezim, jenCena) {
    const m = h.m, R = m.R;
    const x0 = Math.max(0, Math.min(ax, bx)), x1 = Math.min(m.W - 1, Math.max(ax, bx)), y0 = Math.max(0, Math.min(ay, by)), y1 = Math.min(m.H - 1, Math.max(ay, by));
    const chranene = new Set();
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
      const i = y * m.W + x;
      if (m.dum[i] || m.prum[i] || m.cesta[i] || m.kolej[i] || m.stan[i] || m.depo[i] || m.most[i] || m.reka[i] || (m.tunel && m.tunel[i]) || (m.zdym && m.zdym[i])) {
        chranene.add(y * R + x); chranene.add(y * R + x + 1); chranene.add((y + 1) * R + x); chranene.add((y + 1) * R + x + 1);
      }
    }
    // voda, po které se pluje: kotviště přístavů a loděnic, pole pod loděmi
    const chran = i => { const x = i % m.W, y = (i / m.W) | 0; for (const j of [y * R + x, y * R + x + 1, (y + 1) * R + x, (y + 1) * R + x + 1]) chranene.add(j); };
    for (const st of h.stanice) if (st) for (const c of st.casti) if (c.voda !== undefined) chran(c.voda);
    for (const g of h.depa) if (g && g.voda !== undefined) chran(g.voda);
    for (const v of h.vozidla) if (aktivni(v) && v.druh === 'lod' && v.cesta) for (let k = v.ci; k < Math.min(v.cesta.length, v.ci + 3); k++) chran(v.cesta[k]);
    const cil = rezim === 'srovnat' ? m.v[ay * R + ax] : null;
    const pevne = new Map();
    for (let y = y0; y <= y1 + 1; y++) for (let x = x0; x <= x1 + 1; x++) {
      const j = y * R + x, v = rezim === 'zvednout' ? m.v[j] + 1 : rezim === 'snizit' ? m.v[j] - 1 : cil;
      if (v < 0) return { ok: false, chyba: 'Níž to nejde (hladina moře)' };
      if (v > D.CENY.MAX_VYSKA) return { ok: false, chyba: `Výš než ${D.CENY.MAX_VYSKA} stupňů to nejde` };
      if (v !== m.v[j] && chranene.has(j)) return { ok: false, chyba: `V oblasti je stavba, cesta, řeka nebo podnik (${Math.min(x, m.W - 1)}, ${Math.min(y, m.H - 1)})` };
      pevne.set(j, v);
    }
    const zaloha = { v: m.v.slice(), typ: m.typ.slice(), les: m.les.slice(), reka: m.reka.slice() };
    const r = M.terraformuj(m, pevne, chranene);
    if (!r) return { ok: false, chyba: 'Změna by zasáhla stavbu v okolí – zkus menší plochu nebo jinou výšku' };
    let zmen = 0;
    for (let j = 0; j < m.v.length; j++) if (m.v[j] !== zaloha.v[j]) zmen++;
    const vratit = () => { m.v.set(zaloha.v); m.typ.set(zaloha.typ); m.les.set(zaloha.les); m.reka.set(zaloha.reka); };
    if (!zmen) { vratit(); return { ok: false, cena: 0, chyba: 'Terén už takový je' }; }
    const cena = zmen * D.CENY.teren;
    if (jenCena || nemaNa(h, cena)) { vratit(); return jenCena ? { ok: true, cena, zmen } : { ok: false, cena, chyba: `Nedostatek peněz (potřeba ${penizeText(cena)})` }; }
    zauctuj(h, 'stavba', -cena);
    zmena(h, r.x0 - 1, r.y0 - 1, r.x1 + 1, r.y1 + 1);
    return { ok: true, cena, zmen };
  }

  /* Akce u obce (okno města): reklamní kampaň zvedne cílové hodnocení stanic firmy ve městě na dobu kampaně,
     financování výstavby zrychlí růst města na rok, sponzorský dar zlepší hodnocení firmy obcí. Cena roste s velikostí města. */
  const AKCE_OBCE = {
    kampan1: { nazev: 'Malá reklamní kampaň', ikona: '📢', zaklad: 2500, naObyv: 1.5, dni: 30, bonus: 25 },
    kampan2: { nazev: 'Střední reklamní kampaň', ikona: '📢', zaklad: 6000, naObyv: 3, dni: 60, bonus: 40 },
    kampan3: { nazev: 'Velká reklamní kampaň', ikona: '📢', zaklad: 11000, naObyv: 5, dni: 90, bonus: 60 },
    vystavba: { nazev: 'Financovat výstavbu (rok)', ikona: '🏗️', zaklad: 20000, naObyv: 12 },
    dar: { nazev: 'Sponzorský dar obci', ikona: '🎁', zaklad: 8000, naObyv: 4 },
  };
  function akceObce(h, mestoId, akce, jenCena) {
    const c = h.m.mesta[mestoId], a = AKCE_OBCE[akce], cs = h.mestaStat && h.mestaStat[mestoId];
    if (!c || !a || !cs) return { ok: false, chyba: 'Neznámé město nebo akce' };
    const cena = Math.round((a.zaklad + c.obyv * a.naObyv) / 100) * 100;
    if (a.bonus && cs.kampan && cs.kampan.do > h.den) return { ok: false, cena, chyba: `Kampaň v obci ${c.jmeno} ještě běží (${cs.kampan.do - h.den} dní)` };
    if (akce === 'vystavba' && cs.vystavbaDo > h.den) return { ok: false, cena, chyba: `Výstavba v obci ${c.jmeno} se už financuje (${cs.vystavbaDo - h.den} dní)` };
    if (akce === 'dar' && cs.hodn >= 1000) return { ok: false, cena, chyba: 'Hodnocení firmy je už nejlepší možné' };
    return vysledek(h, cena, jenCena, 'stavba', () => {
      if (a.bonus) cs.kampan = { do: h.den + a.dni, bonus: a.bonus };
      else if (akce === 'vystavba') cs.vystavbaDo = h.den + 365;
      else cs.hodn = Math.min(1000, cs.hodn + 220);
      h.zpravy.push({ den: h.den, text: `${a.ikona} ${c.jmeno}: ${a.nazev.toLowerCase()} (${penizeText(cena)})`, x: c.x, y: c.y });
    });
  }
  function povoleniObce(h, x, y) {
    const c = obecU(h, x, y);
    if (!c || !h.mestaStat) return { ok: true };
    const n = h.mestaStat[c.id].hodn;
    if (n < -200) return { ok: false, chyba: `Obec ${c.jmeno} stavbu nepovolí – hodnocení firmy: ${hodnoceniText(n)}. Obsluhuj město a nekácej mu les.` };
    return { ok: true };
  }
  // kácení lesa u města snižuje hodnocení (volat před m.les[i] = 0)
  function vykacet(h, i) {
    const m = h.m;
    if (!m.les[i] || !h.mestaStat) return;
    const c = obecU(h, i % m.W, (i / m.W) | 0);
    if (c) h.mestaStat[c.id].hodn = Math.max(-1000, h.mestaStat[c.id].hodn - 12 * m.les[i]);
  }

  function postavZastavku(h, x, y, druh, jenCena, chtenaOsa) {
    const m = h.m;
    if (!M.uvnitr(m, x, y)) return { ok: false, chyba: 'Mimo mapu' };
    const i = idx(h, x, y);
    if (!m.cesta[i]) return { ok: false, chyba: 'Zastávka se staví na silnici' };
    if (m.tunel[i]) return { ok: false, chyba: 'V tunelu zastávka být nemůže' };
    if (m.stan[i]) return { ok: false, chyba: 'Tady už zastávka je' };
    const osa = osaZastavky(m, x, y, chtenaOsa);
    if (!osa) return { ok: false, chyba: 'Zastávka jen na rovném úseku, ne na křižovatce' };
    if (h.vozidla.some(v => v.stav !== 'depo' && v.cesta && v.cesta[v.ci] === i)) return { ok: false, chyba: 'Na poli stojí vozidlo' };
    const obec = povoleniObce(h, x, y);
    if (!obec.ok) return obec;
    const cena = druh === 'bus' ? D.CENY.zastavka : D.CENY.stanoviste;
    // připojit k vlastní stanici do vzdálenosti 1 pole (i úhlopříčně)
    let st = null;
    for (let dy = -1; dy <= 1 && !st; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!M.uvnitr(m, x + dx, y + dy)) continue;
      const s = m.stan[idx(h, x + dx, y + dy)];
      if (s) { st = h.stanice[s - 1]; break; }
    }
    return vysledek(h, cena, jenCena, 'stavba', () => {
      if (!st) {
        const n = nazevStanice(h, x, y);
        st = { id: h.stanice.length, jmeno: n.jmeno, mesto: n.mesto, x, y, casti: [], naklady: {}, prijima: {}, zalozeno: h.den };
        h.stanice.push(st);
      }
      st.casti.push({ x, y, druh, osa });
      m.stan[i] = st.id + 1; m.osa[i] = osa;
      prepocitejPrijem(h, st);
      zmena(h, x - D.DOSAH_ZASTAVKY, y - D.DOSAH_ZASTAVKY, x + D.DOSAH_ZASTAVKY, y + D.DOSAH_ZASTAVKY);
      h.sitVerze = (h.sitVerze || 0) + 1;
    });
  }

  function postavGaraz(h, x, y, jenCena, chtenySmer) {
    const m = h.m;
    if (!M.uvnitr(m, x, y)) return { ok: false, chyba: 'Mimo mapu' };
    const i = idx(h, x, y);
    if (m.typ[i] === T.VODA || m.reka[i] || m.cesta[i] || m.dum[i] || m.prum[i] || m.depo[i]) return { ok: false, chyba: 'Garáž potřebuje volné pole vedle silnice' };
    let smer = -1;
    const zkus = d => { const j = C.soused(m, i, d); return j >= 0 && m.cesta[j] && !m.tunel[j] && (!m.stan[j] || (m.osa[j] === 1 ? d % 2 === 1 : d % 2 === 0)); };
    if (chtenySmer !== undefined && chtenySmer >= 0 && zkus(chtenySmer)) smer = chtenySmer;
    else for (let d = 0; d < 4; d++) if (zkus(d)) { smer = d; break; }
    if (smer < 0) return { ok: false, chyba: 'Garáž musí stát u silnice' };
    const cena = D.CENY.garaz + cenaPole(m, x, y);
    return vysledek(h, cena, jenCena, 'stavba', () => {
      const g = { id: h.depa.length, x, y, smer, druh: 'silnice' };
      h.depa.push(g);
      vykacet(h, i);
      m.depo[i] = g.id + 1; m.smer[i] = smer + 1; m.les[i] = 0;
      zmena(h, x, y, x, y);
      h.sitVerze = (h.sitVerze || 0) + 1;
    });
  }

  // buldozer na obdélník: hráčovy silnice, zastávky, garáže, stromy
  function zbor(h, x0, y0, x1, y1, jenCena) {
    const m = h.m;
    [x0, x1] = [Math.max(0, Math.min(x0, x1)), Math.min(m.W - 1, Math.max(x0, x1))];
    [y0, y1] = [Math.max(0, Math.min(y0, y1)), Math.min(m.H - 1, Math.max(y0, y1))];
    const obsazena = new Set();
    for (const v of h.vozidla) {
      if (!aktivni(v)) continue;
      if (v.stav === 'depo') { const g = h.depa[v.depo]; if (g) obsazena.add(idx(h, g.x, g.y)); }
      else if (v.druh === 'vlak' && v.telo) for (const i of v.telo) obsazena.add(i);
      else if (v.cesta) { obsazena.add(v.cesta[v.ci]); if (v.cesta[v.ci + 1] !== undefined && v.t > 0) obsazena.add(v.cesta[v.ci + 1]); }
    }
    let cena = 0, chyba = null;
    const akce = [], tunely = new Set();
    // tunel se bourá celý (pole pod kopcem se jinak nedají vybrat)
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = idx(h, x, y); if (m.tunel[i]) for (const j of MAG.zeleznice.poleTunelu(m, i)) tunely.add(j); }
    const polaZboru = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) polaZboru.push(idx(h, x, y));
    for (const j of tunely) { const x = j % m.W, y = (j / m.W) | 0; if (x < x0 || x > x1 || y < y0 || y > y1) polaZboru.push(j); }
    for (const i of polaZboru) {
      const x = i % m.W, y = (i / m.W) | 0;
      if (m.stan[i] || m.depo[i] || m.cesta[i] === 2 || m.kolej[i] || m.zdym[i]) {
        if (obsazena.has(i)) { chyba = chyba || `Na poli ${x}, ${y} je vozidlo`; continue; }
        if (m.stan[i] && m.osa[i] >= 4 && h.vozidla.some(v => aktivni(v) && v.druh === 'let' && v.stav === 'depo' && v.letiste === m.stan[i] - 1)) { chyba = 'V hangáru stojí letadla – nejdřív je prodej'; continue; }
        // zastávka se bourá zvlášť (silnice pod ní zůstane), silnice až dalším bouráním
        cena += D.CENY.demolice; akce.push([m.stan[i] ? 'zastavka' : 'vse', i]);
      } else if (m.les[i] && !m.cesta[i]) { cena += D.CENY.kaceni * m.les[i]; akce.push(['les', i]); }
      else if (m.cesta[i] === 1 || m.dum[i] || m.prum[i]) chyba = chyba || 'Obec ani podniky bourat nedovolí';
    }
    if (!akce.length) return { ok: false, cena: 0, chyba: chyba || 'Není co bourat' };
    const r = vysledek(h, cena, jenCena, 'stavba', () => {
      for (const [co, i] of akce) {
        if (co === 'les') { vykacet(h, i); m.les[i] = 0; continue; }
        if (m.stan[i]) {
          const st = h.stanice[m.stan[i] - 1], x = i % m.W, y = (i / m.W) | 0;
          const cast = st.casti.find(c => x >= c.x && x < c.x + (c.w || 1) && y >= c.y && y < c.y + (c.h || 1));
          st.casti = st.casti.filter(c => c !== cast);
          if (cast) for (let dy = 0; dy < (cast.h || 1); dy++) for (let dx = 0; dx < (cast.w || 1); dx++) { const j = (cast.y + dy) * m.W + cast.x + dx; m.stan[j] = 0; m.osa[j] = 0; if (cast.druh === 'lod') m.smer[j] = 0; }
          m.stan[i] = 0; m.osa[i] = 0;
          if (!st.casti.length) zrusStanici(h, st); else prepocitejPrijem(h, st);
          if (m.kolej[i] && !m.cesta[i]) MAG.zeleznice.zborKolej(h, i);   // nástupiště i s kolejí
          continue;
        }
        if (m.depo[i]) {
          h.depa[m.depo[i] - 1] = null; m.depo[i] = 0; m.smer[i] = 0;
        }
        if (m.kolej[i]) MAG.zeleznice.zborKolej(h, i);
        if (co === 'vse') m.zdym[i] = 0;
        if (co === 'vse' && m.cesta[i] === 2) { m.cesta[i] = 0; if (m.most[i] && !m.kolej[i]) { m.most[i] = 0; m.mostV[i] = 0; } }
        if (!m.cesta[i] && !m.kolej[i]) { m.tunel[i] = 0; m.tunelV[i] = 0; }
        if (!m.cesta[i] && !m.depo[i]) m.tram[i] = 0;
      }
      zmena(h, x0 - D.DOSAH_ZASTAVKY, y0 - D.DOSAH_ZASTAVKY, x1 + D.DOSAH_ZASTAVKY, y1 + D.DOSAH_ZASTAVKY);
      for (const j of tunely) { const x = j % m.W, y = (j / m.W) | 0; zmena(h, x - 1, y - 1, x + 1, y + 1); }   // portály mimo obdélník
      h.sitVerze = (h.sitVerze || 0) + 1;
    });
    if (r.ok && chyba) r.varovani = chyba;
    return r;
  }

  function zrusStanici(h, st) {
    h.stanice[st.id] = null;
    for (const v of h.vozidla) {
      if (!aktivni(v)) continue;
      const pred = v.rozkazy.length;
      v.rozkazy = v.rozkazy.filter(r => r.st !== st.id);
      if (v.rozkazy.length !== pred) v.ri = v.rozkazy.length ? v.ri % v.rozkazy.length : 0;
      if (v.cil && v.cil.st === st.id) { v.cil = null; if (v.stav === 'naklada') v.stav = 'jede'; }
    }
  }

  // --- spádová oblast, příjem nákladu ----------------------------------------------------------
  function oblast(h, st) {
    const m = h.m, pole = new Set();
    for (const c of st.casti) if (c.druh !== 'boje') for (let R = c.druh === 'bus' || c.druh === 'nakl' ? D.DOSAH_ZASTAVKY : D.DOSAH_NADRAZI, dy = -R; dy < R + (c.h || 1); dy++) for (let dx = -R; dx < R + (c.w || 1); dx++) {
      const x = c.x + dx, y = c.y + dy;
      if (M.uvnitr(m, x, y)) pole.add(y * m.W + x);
    }
    return pole;
  }
  // příjem v osminách jako ve žánru: stanice přijímá náklad, když součet ≥ 8
  function prepocitejPrijem(h, st) {
    const m = h.m, soucet = {};
    const pridej = (k, n) => { soucet[k] = (soucet[k] || 0) + n; };
    for (const i of oblast(h, st)) {
      if (m.dum[i]) { const d = m.domy[m.dum[i] - 1]; pridej('lide', d.obyv ? Math.max(1, Math.min(8, d.obyv / 6)) : 3); pridej('posta', d.obyv / 14); if (d.obyv > 40) pridej('zbozi', d.obyv / 20); if (d.obyv > 25) { pridej('potraviny', d.obyv / 24); pridej('voda', d.obyv / 24); } }
      if (m.prum[i]) for (const k of D.PRUMYSL_PODLE_ID[m.prumysl[m.prum[i] - 1].typ].prijima) pridej(k, 8);
    }
    st.prijima = {};
    for (const [k, n] of Object.entries(soucet)) if (n >= 8) st.prijima[k] = true;
  }
  const maDruh = (st, druh) => st && st.casti.some(c => c.druh === druh);

  // --- vozidla ---------------------------------------------------------------------------------
  const kmhNaPole = kmh => kmh / 1250;        // polí za tick (bus 64 km/h ≈ 3,8 pole za den)
  function kup(h, depoId, typId, naklad, jenCena) {
    const g = h.depa[depoId], t = D.VOZIDLA_PODLE_ID[typId];
    if (!t) return { ok: false, chyba: 'Neznámé vozidlo' };
    if (t.druh === 'lod' || t.druh === 'let') return MAG.vodaVzduch.kup(h, depoId, typId, naklad, jenCena);   // letadlo: depoId = id letiště
    if (!g) return { ok: false, chyba: 'Neznámá garáž' };
    if (t.druh === 'vlak') return MAG.zeleznice.kupVlak(h, depoId, typId, jenCena);
    if ((g.druh || 'silnice') !== 'silnice') return { ok: false, chyba: 'Auta se kupují v garáži' };
    const r = rok(h);
    if (r < t.od || r > t.do) return { ok: false, chyba: 'Toto vozidlo se už (nebo ještě) nevyrábí' };
    if (naklad && !t.naklady.includes(naklad)) return { ok: false, chyba: 'Vozidlo tento náklad nevozí' };
    return vysledek(h, t.cena, jenCena, 'vozidla', () => {
      const cislo = ++h.cislo[t.druh];
      h.vozidla.push({
        id: h.vozidla.length, typ: t.id, druh: t.druh, jmeno: `${t.tram ? 'Tramvaj' : t.druh === 'bus' ? 'Autobus' : t.naklady[0] === 'posta' ? 'Poštovní vůz' : 'Nákladní auto'} ${cislo}`,
        oddily: [{ typ: naklad || t.naklady[0], kap: t.kapacita, n: 0, od: -1, dni: 0 }], depo: g.id,
        stav: 'depo', bezi: false, cesta: null, ci: 0, t: 0, d: g.smer,
        rozkazy: [], ri: 0, cil: null, cekani: 0, otocka: 0,
        zisk: { letos: 0, loni: 0 }, stari: 0, koupeno: h.den, cena: t.cena, ztracen: 0, sitVerze: -1,
      });
    });
  }
  function hodnotaVozidla(h, v) {
    const t = D.VOZIDLA_PODLE_ID[v.typ];
    return Math.round(v.cena * Math.max(0.08, 1 - v.stari / (t.zivot * 365) * 0.85));
  }
  function prodej(h, vId) {
    const v = h.vozidla[vId];
    if (!v || v.stav !== 'depo') return { ok: false, chyba: 'Prodat jde jen vozidlo v garáži' };
    const c = hodnotaVozidla(h, v);
    zauctuj(h, 'vozidla', c);
    h.vozidla[vId] = { id: vId, prodano: true };
    return { ok: true, cena: -c };
  }
  const aktivni = v => v && !v.prodano;

  /* Nová linka: stanice v rozkazech se začnou plnit nákladem, který vozidlo vozí, hned (ne až po první návštěvě) –
     jinak by první vozidlo na nové trase odjelo prázdné. Volá se při přidání rozkazu a při spuštění. */
  function ohlasLinku(h, v) {
    for (const r of v.rozkazy) {
      const st = h.stanice[r.st];
      if (!st || st.boje) continue;
      for (const o of v.oddily) {
        const z = zaznamNakladu(st, o.typ);
        if (!z.navst) {
          z.navst = true; z.dni = 0; z.rychlost = D.VOZIDLA_PODLE_ID[v.typ].rychlost;
          z.ceka = Math.min(4095, z.ceka + startovniZasoba(h, st, o.typ, z.hodn / 255));
        }
      }
    }
  }
  // kolik by se na stanici nahromadilo za pár dní: domy v dosahu (cestující, pošta za 3 dny), podniky (jedna dávka výroby)
  function startovniZasoba(h, st, typ, podil) {
    const m = h.m, domy = new Set(), podniky = new Set();
    for (const i of oblast(h, st)) { if (m.dum[i]) domy.add(m.dum[i] - 1); if (m.prum[i]) podniky.add(m.prum[i] - 1); }
    let n = 0;
    if (typ === 'lide' || typ === 'posta') for (const k of domy) n += (m.domy[k].obyv || 0) / (typ === 'lide' ? 250 : 1300) * 3;
    else for (const k of podniky) { const q = m.prumysl[k]; if (!q.zrusen) n += (q.vyroba[typ] || 0) / 4; }
    return Math.floor(n * podil);
  }
  function pridejRozkaz(h, vId, stId, pozice) {
    const v = h.vozidla[vId], st = h.stanice[stId];
    if (!aktivni(v) || !st) return { ok: false, chyba: 'Neznámé vozidlo nebo stanice' };
    if (v.druh === 'let' && maDruh(st, 'let') && !MAG.vodaVzduch.letisteStanice(st, v)) return { ok: false, chyba: 'Letadlo na heliportu nepřistane – jen vrtulník' };
    if (!maDruh(st, v.druh) && !(v.druh === 'lod' && maDruh(st, 'boje'))) return { ok: false, chyba: v.druh === 'bus' ? 'Stanice nemá zastávku autobusu' : 'Stanice nemá nákladní stanoviště' };
    const r = { st: stId, plne: false };
    if (pozice === undefined || pozice > v.rozkazy.length) v.rozkazy.push(r); else v.rozkazy.splice(pozice, 0, r);
    ohlasLinku(h, v);
    return { ok: true };
  }
  function odeberRozkaz(h, vId, k) {
    const v = h.vozidla[vId];
    if (!aktivni(v) || !v.rozkazy[k]) return { ok: false };
    v.rozkazy.splice(k, 1);
    if (v.ri >= v.rozkazy.length) v.ri = 0;
    if (v.cil && v.cil.r === k) { v.cil = null; v.cesta = null; }
    return { ok: true };
  }
  function prepniPlne(h, vId, k) { const v = h.vozidla[vId]; if (aktivni(v) && v.rozkazy[k]) v.rozkazy[k].plne = !v.rozkazy[k].plne; return { ok: true }; }

  function spust(h, vId) {
    const v = h.vozidla[vId];
    if (!aktivni(v)) return { ok: false };
    if (v.bezi) { v.bezi = false; return { ok: true }; }
    if (!v.rozkazy.length) return { ok: false, chyba: 'Vozidlo nemá žádné rozkazy' };
    v.bezi = true;
    delete v.vyjetPo;   // ruční spuštění přebíjí čekání na dosluhující vozidlo
    ohlasLinku(h, v);
    if (v.stav === 'depo' && (v.druh === 'lod' || v.druh === 'let')) { MAG.vodaVzduch.spust(h, v); return { ok: true }; }
    if (v.stav === 'depo') {
      const g = h.depa[v.depo];
      v.stav = 'jede'; v.cesta = [idx(h, g.x, g.y)]; v.ci = 0; v.t = 0; v.d = g.smer; v.cil = null; v.doGaraze = false; v.rych = 0;
    }
    return { ok: true };
  }
  // vozidlo právě zajelo do garáže / depa / loděnice / hangáru: buď zpráva, nebo (když se má prodat) prodej
  function vGarazi(h, v, text) {
    if (!v.prodat) { h.zpravy.push({ den: h.den, text, vozidlo: v.id }); return false; }
    const castka = '$' + Math.round(hodnotaVozidla(h, v)).toLocaleString('cs-CZ'), jmeno = v.jmeno, id = v.id;
    prodej(h, v.id);
    h.zpravy.push({ den: h.den, text: `💲 ${jmeno} prodáno za ${castka}` });
    // náhrada čekající v depu vyjede
    for (const n of h.vozidla) if (aktivni(n) && n.vyjetPo === id) { delete n.vyjetPo; if (n.rozkazy.length && !n.bezi) spust(h, n.id); }
    return true;
  }
  // poslat do garáže a tam prodat (zapnout = false: zrušit a vrátit na trasu)
  function prodatPoPrijezdu(h, vId, zapnout = true) {
    const v = h.vozidla[vId];
    if (!aktivni(v)) return { ok: false };
    if (v.stav === 'depo') return zapnout ? prodej(h, vId) : { ok: true };
    v.prodat = zapnout;
    if (zapnout) return doGaraze(h, vId);
    v.doGaraze = false; v.cil = null;
    // zrušený prodej: náhrada čekající v depu na tohle vozidlo by jinak čekala navždy
    for (const n of h.vozidla) if (aktivni(n) && n.vyjetPo === vId) { delete n.vyjetPo; if (n.rozkazy.length && !n.bezi) spust(h, n.id); }
    return { ok: true };
  }
  function doGaraze(h, vId) {
    const v = h.vozidla[vId];
    if (!aktivni(v) || v.stav === 'depo') return { ok: false };
    v.doGaraze = true; v.cil = null; v.bezi = true;
    if (v.stav === 'naklada') v.stav = 'jede';
    return { ok: true };
  }

  function naplanuj(h, v) {
    const m = h.m, odkud = v.cesta[v.ci];
    let cile = new Set(), cil = null;
    if (v.doGaraze || v.doServisu) {
      for (const g of h.depa) if (g && (g.druh || 'silnice') === 'silnice') cile.add(idx(h, g.x, g.y));
      cil = { garaz: true, servis: !v.doGaraze };
    } else {
      if (!v.rozkazy.length) return false;
      v.ri %= v.rozkazy.length;
      const r = v.rozkazy[v.ri], st = h.stanice[r.st];
      if (!st) { v.rozkazy.splice(v.ri, 1); return false; }
      for (const c of st.casti) if (c.druh === v.druh) cile.add(idx(h, c.x, c.y));
      cil = { st: r.st, r: v.ri };
    }
    if (!cile.size) return false;
    const p = C.cestaPoSilnici(m, odkud, cile, !!D.VOZIDLA_PODLE_ID[v.typ].tram);
    if (!p && v.doServisu) { v.doServisu = false; v.servis -= 30; return naplanuj(h, v); }   // garáž nedostupná → servis později
    if (!p) return false;
    v.cesta = p; v.ci = 0; v.cil = cil; v.sitVerze = h.sitVerze || 0;
    // nová cesta míří opačně → otočka na místě
    if (p.length > 1) { const d = C.smerMezi(m, p[0], p[1]); if (d === ((v.d + 2) & 3) && v.t === 0) v.otocka = 18; v.d = d; }
    return true;
  }

  // poloha vozidla ve světě (pole x, y jako desetinná čísla, střed pole = +0,5) a směr
  function polohaVozidla(h, v) {
    const m = h.m;
    if (!v.cesta) return null;
    const a = v.cesta[v.ci], b = v.cesta[v.ci + 1];
    let x = a % m.W + 0.5, y = ((a / m.W) | 0) + 0.5;
    if (b !== undefined) { x += (b % m.W - a % m.W) * v.t; y += (((b / m.W) | 0) - ((a / m.W) | 0)) * v.t; }
    const [dx, dy] = S4[v.d];
    return { x: x - dy * 0.17, y: y + dx * 0.17, d: v.d };   // jízda vpravo
  }

  // havárie: vozidlo zanikne (bez náhrady), zpráva do novin
  function havarie(h, v, text) {
    if (v.druh === 'vlak' && MAG.zeleznice) { for (const i of v.rezervace || []) if (h.rez[i] === v.id) delete h.rez[i]; }
    h.vozidla[v.id] = { id: v.id, prodano: true, havarie: true, jmeno: v.jmeno };
    h.havarii = (h.havarii || 0) + 1;
    h.zpravy.push({ den: h.den, text, havarie: true });
  }
  // pole, kde je teď vlak nebo kam vjede (silniční vozidla před přejezdem čekají)
  function polaVlaku(h) {
    const s = new Set();
    for (const v of h.vozidla) if (aktivni(v) && v.druh === 'vlak' && v.stav !== 'depo' && v.cesta) {
      for (const i of v.telo || []) s.add(i);
      const dopredu = 2 + Math.ceil(kmhNaPole(Math.max(v.rych || 0, 40)) * 45);   // auto přejezd přejede asi za 40 ticků
      for (let k = v.ci; k <= v.ci + dopredu && k < v.cesta.length; k++) s.add(v.cesta[k]);
    }
    return s;
  }
  // po pohybu vlaků: auto na přejezdu pod vlakem
  function srazkyNaPrejezdech(h) {
    if (!h.volby || !h.volby.havarie) return;
    const m = h.m, vlaky = new Map();
    for (const v of h.vozidla) if (aktivni(v) && v.druh === 'vlak' && v.stav !== 'depo' && v.telo) for (const i of v.telo) if (m.cesta[i]) vlaky.set(i, v);
    if (!vlaky.size) return;
    for (const v of h.vozidla) {
      if (!aktivni(v) || (v.druh !== 'bus' && v.druh !== 'nakl') || v.stav === 'depo' || !v.cesta) continue;
      const i = v.t > 0.5 && v.cesta[v.ci + 1] !== undefined ? v.cesta[v.ci + 1] : v.cesta[v.ci];
      const w = vlaky.get(i);
      if (w && m.kolej[i]) havarie(h, v, `💥 Srážka na přejezdu: ${w.jmeno} smetl ${v.jmeno}`);
    }
  }

  function krokVozidel(h) {
    const m = h.m, obs = new Map();
    const naPrejezdu = h.vozidla.some(v => aktivni(v) && v.druh === 'vlak' && v.stav !== 'depo') ? polaVlaku(h) : null;
    // obsazenost úseků: klíč = pole·4 + směr, hodnota = nejmenší t vozidla na úseku
    for (const v of h.vozidla) {
      if (!aktivni(v) || v.stav === 'depo' || !v.cesta || (v.druh !== 'bus' && v.druh !== 'nakl')) continue;
      const k = v.cesta[v.ci] * 4 + v.d;
      let l = obs.get(k); if (!l) obs.set(k, l = []);
      l.push(v);
    }
    for (const v of h.vozidla) {
      if (!aktivni(v) || v.stav === 'depo' || !v.bezi || (v.druh !== 'bus' && v.druh !== 'nakl')) continue;
      if (v.stav === 'naklada') { nakladani(h, v); continue; }
      if (v.otocka > 0) { v.otocka--; continue; }
      if (v.porucha > 0) { v.porucha--; continue; }
      if (v.ztracen > 0) { v.ztracen--; if (v.ztracen > 0) continue; }
      // potřeba nové cesty: na konci, bez cíle, nebo se změnila síť
      if (!v.cil || v.ci >= v.cesta.length - 1) {
        if (v.cil && v.ci >= v.cesta.length - 1 && v.t === 0) { dojezd(h, v); continue; }
        if (!naplanuj(h, v)) { v.ztracen = DT * 3; if (!v.hlasenoZtraceni) { v.hlasenoZtraceni = true; h.zpravy.push({ den: h.den, text: `${v.jmeno} nemůže najít cestu`, vozidlo: v.id }); } continue; }
        v.hlasenoZtraceni = false;
        if (v.cesta.length === 1) { dojezd(h, v); continue; }
      }
      const a = v.cesta[v.ci], b = v.cesta[v.ci + 1];
      if (b === undefined) continue;
      // je úsek pořád průjezdný?
      if (C.spojeno(m, a, C.smerMezi(m, a, b)) !== b || (D.VOZIDLA_PODLE_ID[v.typ].tram && !m.tram[b] && !m.depo[b])) { v.cesta = [a]; v.ci = 0; v.cil = null; v.t = 0; continue; }
      if (naPrejezdu && m.kolej[b] && v.t > 0.3 && naPrejezdu.has(b)) continue;   // před přejezdem počkat na vlak
      const rychlost = kmhNaPole(D.VOZIDLA_PODLE_ID[v.typ].rychlost);
      // kdo je před námi: stejný úsek s větším t, nebo další úsek s malým t
      let volno = 1;
      const tenhle = obs.get(a * 4 + v.d);
      if (tenhle) for (const o of tenhle) if (o !== v && (o.t > v.t || (o.t === v.t && o.id < v.id)) && o.t - v.t < volno) volno = o.t - v.t;
      const c = v.cesta[v.ci + 2], d2 = c !== undefined ? C.smerMezi(m, b, c) : v.d;
      for (const k of d2 === v.d ? [d2] : [d2, v.d]) {
        const dalsi = obs.get(b * 4 + k);
        if (dalsi) for (const o of dalsi) if (o !== v && 1 - v.t + o.t < volno) volno = 1 - v.t + o.t;
      }
      const krok = Math.min(rychlost, volno - 0.42);
      if (krok <= 0) continue;
      v.t += krok;
      if (v.t >= 1) {
        v.t -= 1; v.ci++;
        const sl = v.cesta[v.ci + 1];
        if (sl !== undefined) v.d = C.smerMezi(m, v.cesta[v.ci], sl);
        if (v.ci >= v.cesta.length - 1) v.t = 0;  // na konci cesty stát na středu pole
        else if (v.sitVerze !== (h.sitVerze || 0)) {
          // síť se změnila → přeplánovat z pole, na kterém právě jsme
          const t = v.t, dPred = v.d;
          v.cesta = v.cesta.slice(v.ci); v.ci = 0;
          if (naplanuj(h, v)) { if (v.d === ((dPred + 2) & 3)) { v.t = 0; v.otocka = 18; } else v.t = t; }
          else { v.cesta = [v.cesta[0]]; v.t = 0; v.cil = null; }
        }
      }
    }
  }

  function dojezd(h, v) {
    const m = h.m;
    if (v.cil && v.cil.servis && m.depo[v.cesta[v.ci]]) {
      // servis: spolehlivost zpět, případně obnova, a pokračovat v rozkazech
      servis(h, v);
      v.doServisu = false; v.cil = null; v.odjezd = true;
      if (v.druh === 'vlak') {
        // vlak zajede celý do depa a vyjede čelem k výjezdu (jinak by se po obrácení mohl rozjet jen jedním směrem)
        const g = h.depa[m.depo[v.cesta[v.ci]] - 1];
        v.cesta = [v.cesta[v.ci]]; v.ci = 0; v.t = 0; v.rych = 0; v.d = g.smer; v.odjezd = false;
      }
      return;
    }
    if (v.cil && v.cil.garaz) {
      const g = h.depa[m.depo[v.cesta[v.ci]] - 1];
      if (g) { v.stav = 'depo'; v.depo = g.id; v.bezi = false; v.doGaraze = false; v.cesta = null; v.cil = null; vGarazi(h, v, `${v.jmeno} čeká v garáži`); return; }
    }
    if (v.cil && v.cil.st !== undefined) {
      const st = h.stanice[v.cil.st];
      if (st && m.stan[v.cesta[v.ci]] === st.id + 1) { v.stav = 'naklada'; v.cekani = 0; v.vylozeno = false; v.prijezdy = (v.prijezdy || 0) + 1; return; }
    }
    v.cil = null;
  }

  // --- spolehlivost, servis, obnova ------------------------------------------------------------------------------
  // nejnovější vyráběný model stejného druhu (tramvaj za tramvaj, elektrická za elektrickou, stejný náklad, vrtulník za vrtulník)
  function nastupce(h, t) {
    const r = rok(h);
    return D.VOZIDLA.filter(n => n.druh === t.druh && n.od <= r && n.do >= r && !!n.tram === !!t.tram && !!n.vrtulnik === !!t.vrtulnik
      && (n.trakce === 'elektro') === (t.trakce === 'elektro') && (t.druh === 'vlak' || n.naklady.join() === t.naklady.join()))
      .sort((a, b) => b.od - a.od)[0];
  }
  /* Náhrada dosluhujícího vozidla: koupí se nástupce (u vlaku i vagony pro stejné náklady) v jeho garáži / depu / na
     domovském letišti, převezme rozkazy, nastavení i jméno a vyjede; staré dojede do garáže a samo se prodá. */
  function nahrad(h, vId, jenCena) {
    const v = h.vozidla[vId];
    if (!aktivni(v)) return { ok: false, chyba: 'Neznámé vozidlo' };
    if (v.nahrazeno !== undefined || v.prodat) return { ok: false, chyba: 'Vozidlo se už nahrazuje nebo prodává' };
    const t = D.VOZIDLA_PODLE_ID[v.typ], nove = nastupce(h, t);
    if (!nove) return { ok: false, chyba: 'Žádný vhodný model se teď nevyrábí' };
    const r = rok(h);
    const vagony = v.druh === 'vlak' ? v.oddily.map(o => {
      const stary = D.VAGONY_PODLE_ID[o.vagon];
      const w = D.VAGONY.filter(w => w.od <= r && w.naklady.includes(o.typ)).sort((a, b) => b.od - a.od)[0] || stary;
      return [w.id, o.typ, w.cena];
    }) : [];
    const cena = nove.cena + vagony.reduce((a, x) => a + x[2], 0);
    if (jenCena) return { ok: true, cena, nove };
    if (h.firma.penize < cena) return { ok: false, cena, chyba: `Na náhradu chybí peníze (${Math.round(cena).toLocaleString('cs-CZ')} $)` };
    // kde koupit: původní garáž / depo / letiště, jinak jakékoli stejného druhu
    let kde;
    if (v.druh === 'let') {
      const ok = st => MAG.vodaVzduch.letisteStanice(st, { typ: nove.id });
      kde = ok(h.stanice[v.letiste]) ? v.letiste : (h.stanice.find(st => st && ok(st)) || {}).id;
    } else {
      const druhG = v.druh === 'vlak' ? 'kolej' : v.druh === 'lod' ? 'lod' : 'silnice', g = h.depa[v.depo];
      kde = g && (g.druh || 'silnice') === druhG ? g.id : (h.depa.find(x => x && (x.druh || 'silnice') === druhG) || {}).id;
    }
    if (kde === undefined) return { ok: false, chyba: 'Není kde koupit náhradu (chybí garáž, depo nebo letiště)' };
    const k = kup(h, kde, nove.id, v.druh === 'vlak' || v.druh === 'let' ? undefined : v.oddily[0].typ);
    if (!k.ok) return k;
    const n = h.vozidla[h.vozidla.length - 1];
    for (const [w, typ] of vagony) MAG.zeleznice.pridejVagon(h, n.id, w, typ);
    n.rozkazy = v.rozkazy.map(q => ({ ...q })); n.rozestupy = v.rozestupy;
    const jmeno = v.jmeno;
    n.jmeno = jmeno; v.jmeno = jmeno + ' (dosluhuje)';
    v.nahrazeno = n.id;
    // vlak počká v depu, až starý dojede (na jednokolejce by se potkaly čelem); ostatní vyjedou hned
    if (v.druh === 'vlak' && v.stav !== 'depo') n.vyjetPo = v.id;
    else if (n.rozkazy.length) spust(h, n.id);
    prodatPoPrijezdu(h, v.id);
    h.zpravy.push({ den: h.den, text: v.druh === 'vlak' && n.vyjetPo !== undefined ? `🔄 ${jmeno}: nový ${nove.nazev} čeká v depu, vyjede, až starý dojede a prodá se`
      : `🔄 ${jmeno} nahrazeno novým ${nove.nazev} – staré dojede do garáže a prodá se`, vozidlo: n.id });
    return { ok: true, cena, novy: n.id };
  }
  function servis(h, v) {
    v.spol = 1; v.servis = 0; v.servisu = (v.servisu || 0) + 1;
    const t = D.VOZIDLA_PODLE_ID[v.typ];
    if (!h.firma.obnova || h.firma.nahrazovat || v.stari < t.zivot * 365) return;
    const nove = nastupce(h, t);
    if (!nove) return;
    const cena = nove.cena - hodnotaVozidla(h, v);
    if (h.firma.penize < cena) return;
    zauctuj(h, 'vozidla', -cena);
    const vagony = v.druh === 'vlak' ? v.cena - t.cena : 0;
    v.typ = nove.id; v.cena = nove.cena + vagony; v.stari = 0; v.dosloužilo = false; v.dosluhuje = false; v.obnoveno = (v.obnoveno || 0) + 1;
    if (v.druh !== 'vlak') for (const o of v.oddily) o.kap = v.druh === 'let' && o.typ === 'posta' ? nove.kapacitaPosta : nove.kapacita;
    h.zpravy.push({ den: h.den, text: `🔄 ${v.jmeno} obnoveno: ${nove.nazev}`, vozidlo: v.id });
  }
  // denně: stárnutí spolehlivosti, poruchy, rozhodnutí o servisu
  function spolehlivost(h, v) {
    const t = D.VOZIDLA_PODLE_ID[v.typ];
    if (v.spol === undefined) { v.spol = 1; v.servis = 0; }
    v.servis++;
    const stare = v.stari > t.zivot * 365;
    v.spol = Math.max(0, v.spol - (stare ? 0.008 : 0.004));
    // půl roku před koncem životnosti upozornit (s nabídkou náhrady), při dosloužení případně nahradit samo
    if (!stare && !v.dosluhuje && v.stari > t.zivot * 365 - 180 && v.nahrazeno === undefined && !v.prodat) {
      v.dosluhuje = true;
      h.zpravy.push({ den: h.den, text: `⏳ ${v.jmeno} za půl roku doslouží – můžeš ho nahradit novým`, vozidlo: v.id, nahradit: v.id });
    }
    if (stare && !v.dosloužilo) {
      v.dosloužilo = true;
      if (v.nahrazeno !== undefined || v.prodat) { /* už se řeší */ }
      else if (h.firma.nahrazovat) {
        const x = nahrad(h, v.id);
        if (!x.ok) h.zpravy.push({ den: h.den, text: `🧓 ${v.jmeno} dosloužilo – automatická náhrada nevyšla: ${x.chyba}`, vozidlo: v.id, nahradit: v.id });
      } else h.zpravy.push({ den: h.den, text: `🧓 ${v.jmeno} dosloužilo – nahraď ho novým (nebo zapni automatickou obměnu v nastavení firmy)`, vozidlo: v.id, nahradit: v.id });
    }
    if (v.stav === 'jede' && !v.porucha && h.nah.f() < 0.025 * (1 - v.spol) ** 2) {
      v.porucha = Math.round(DT * 1.5); v.poruch = (v.poruch || 0) + 1;
      h.zpravy.push({ den: h.den, text: `💥 ${v.jmeno} má poruchu`, vozidlo: v.id, tiche: v.poruch > 1 });
    }
    const interval = h.firma.servis || 0;
    const maKam = v.druh === 'lod' || v.druh === 'let' ? MAG.vodaVzduch.maServis(h, v) : h.depa.some(g => g && (g.druh || 'silnice') === (v.druh === 'vlak' ? 'kolej' : 'silnice'));
    if (interval && v.servis > interval && v.stav === 'jede' && !v.doGaraze && !v.doServisu && maKam) {
      v.doServisu = true;   // uplatní se při příštím plánování (po nakládce) – uprostřed trati se vlak neobrací
    }
  }

  function platba(typ, n, vzd, dni) {
    const k = D.NAKLADY_PODLE_ID[typ];
    let tf;
    if (dni <= k.dny1) tf = 255;
    else if (dni <= k.dny1 + k.dny2) tf = 255 - (dni - k.dny1);
    else tf = 255 - 2 * (dni - k.dny1) + k.dny2;
    tf = Math.max(31, tf);
    return Math.round(k.cena * n * vzd * tf / 255);
  }

  const KAT_PRIJMU = { bus: 'prijemBus', nakl: 'prijemNakl', vlak: 'prijemVlak', lod: 'prijemLod', let: 'prijemLet' };
  const zaznamNakladu = (st, typ) => st.naklady[typ] || (st.naklady[typ] = { ceka: 0, hodn: 175, dni: 0, navst: false, rychlost: 0 });
  const VITANI = {
    bus: (st, c) => `🎉 První autobus přijel do zastávky ${st.jmeno}! ${c ? `Obyvatelé ${c.jmeno} slaví.` : ''}`,
    nakl: st => `🎉 První nákladní auto přijelo na stanoviště ${st.jmeno}!`,
    vlak: (st, c) => `🎉 První vlak přijel na nádraží ${st.jmeno}! ${c ? `V ${c.jmeno} hraje dechovka.` : ''}`,
    lod: st => `🎉 První loď zakotvila v přístavu ${st.jmeno}!`,
    let: (st, c) => `🎉 První letadlo přistálo na letišti ${st.jmeno}! ${c ? `${c.jmeno} slaví leteckou éru.` : ''}`,
  };

  /* Nakládání a vykládání po oddílech (autobus/auto = 1 oddíl, vlak = vagony).
     Vyloží se jednou při příjezdu (jen náklad, který stanice přijímá a který nepochází odsud),
     pak se nakládá po dávkách každých 8 ticků. */
  function nakladani(h, v) {
    const st = h.stanice[v.cil.st], r = v.rozkazy[v.cil.r];
    if (!st) { v.stav = 'jede'; v.cil = null; return; }
    v.cekani++;
    if (!v.vylozeno) {
      v.vylozeno = true;
      let trzba = 0;
      for (const o of v.oddily) {
        if (o.n > 0 && o.od !== st.id && st.prijima[o.typ]) {
          const od = h.stanice[o.od];
          const vzd = od ? Math.abs(od.x - st.x) + Math.abs(od.y - st.y) : 0;
          trzba += platba(o.typ, o.n, vzd, o.dni);
          zapisPrepravu(h, st, o.typ, o.n, v.druh);
          dodej(h, st, o.typ, o.n);
          o.n = 0; o.od = -1; o.dni = 0;
        } else if (o.n > 0 && r && r.vyloz && o.od !== st.id) {
          // přeložení: náklad zůstane na stanici pro další vozidlo, zaplatí se ujetý úsek
          const od = h.stanice[o.od];
          const vzd = od ? Math.abs(od.x - st.x) + Math.abs(od.y - st.y) : 0;
          trzba += platba(o.typ, o.n, vzd, o.dni);
          const z2 = zaznamNakladu(st, o.typ); z2.ceka = Math.min(4095, z2.ceka + o.n); z2.navst = true;
          o.n = 0; o.od = -1; o.dni = 0;
        }
        const z = zaznamNakladu(st, o.typ);
        z.navst = true; z.dni = 0; z.rychlost = D.VOZIDLA_PODLE_ID[v.typ].rychlost;
      }
      if (trzba) {
        zauctuj(h, KAT_PRIJMU[v.druh], trzba);
        v.zisk.letos += trzba;
        v.posledni = { castka: trzba, den: h.den, st: st.id };   // poslední tržba (okno vozidla)
        h.zpravy.push({ den: h.den, penize: trzba, x: st.x, y: st.y, tiche: true });
      }
      const klic = `${st.id}:${v.druh}`;
      if (!h.prvni[klic]) {
        h.prvni[klic] = true;
        h.zpravy.push({ den: h.den, text: VITANI[v.druh](st, h.m.mesta[st.mesto]), x: st.x, y: st.y });
      }
    }
    if (v.cekani % 8 === 0) {
      let nalozeno = 0, plno = true, nicNeceka = true;
      const davka = v.druh === 'vlak' ? 8 : 5;
      // nakládat jen náklad, který některá další zastávka v rozkazech přijme (jinak by ho vozidlo vozilo dokola)
      // … nebo kde se vykládá na přeložení (napáječová linka)
      const kamSmi = typ => v.rozkazy.some(q => q.st !== st.id && h.stanice[q.st] && (h.stanice[q.st].prijima[typ] || q.vyloz));
      for (const o of v.oddily) {
        const z = zaznamNakladu(st, o.typ);
        const n = kamSmi(o.typ) && !(r && r.nenakladej) ? Math.min(davka, z.ceka, o.kap - o.n) : 0;
        if (n > 0) {
          if (o.n === 0 || o.od < 0) { o.od = st.id; o.dni = 0; }
          o.n += n; z.ceka -= n; z.dni = 0; nalozeno += n;
          if (!st.mesic) st.mesic = { nalozeno: {}, vylozeno: {} };
          st.mesic.nalozeno[o.typ] = (st.mesic.nalozeno[o.typ] || 0) + n;
        }
        if (o.n < o.kap) { plno = false; if (z.ceka > 0) nicNeceka = false; }
      }
      // „plně naložit“ nemá smysl, když náklad nemá kam jet (cíl ho nepřijímá) – jinak by vozidlo čekalo navždy
      const nemaKam = v.oddily.every(o => !kamSmi(o.typ));
      let hotovo = plno || ((!(r && r.plne) || nemaKam || (r && r.nenakladej)) && (nicNeceka || nalozeno === 0) && v.cekani >= 24);
      if (hotovo && r && r.stat && v.cekani < r.stat * DT) hotovo = false;          // jízdní řád: doba stání
      if (hotovo && v.rozestupy && !rozestupOk(h, v, st)) hotovo = false;          // počkat na rovnoměrný rozestup
      if (hotovo) {
        if (v.rozestupy) zapisOdjezd(h, v, st);
        if (r && r.presDepo) v.doServisu = true;
        v.stav = 'jede'; v.ri = (v.cil.r + 1) % Math.max(1, v.rozkazy.length); v.cil = null; v.odjezd = true;
      }
    }
  }

  // --- rozestupy na lince: vozidla se stejnými rozkazy odjíždějí ze zastávky po cyklus / počet vozidel ---------------------
  const klicLinky = v => v.druh + ':' + v.rozkazy.map(r => r.st).join('>');
  const tickNyni = h => h.den * DT + h.tick;
  function rozestupOk(h, v, st) {
    const klic = klicLinky(v), ostatni = h.vozidla.filter(w => aktivni(w) && w.rozestupy && w.bezi && klicLinky(w) === klic);
    if (ostatni.length < 2 || !v.cyklus) return true;
    const posledni = (h.odjezdy || {})[klic + '@' + st.id];
    if (posledni === undefined) return true;
    const mezera = v.cyklus / ostatni.length, ted = tickNyni(h);
    // pojistka: déle než celý cyklus nečekat
    return ted - posledni >= mezera || v.cekani > v.cyklus;
  }
  function zapisOdjezd(h, v, st) {
    const klic = klicLinky(v), ted = tickNyni(h);
    (h.odjezdy || (h.odjezdy = {}))[klic + '@' + st.id] = ted;
    if (v.cil && v.cil.r === 0) { if (v.odjezd0 !== undefined) v.cyklus = ted - v.odjezd0; v.odjezd0 = ted; }
  }

  // přestavba oddílu na jiný náklad (jen v depu a prázdný), 10 % ceny modelu
  function prestav(h, vId, k, typ, jenCena) {
    const v = h.vozidla[vId];
    if (!aktivni(v) || v.stav !== 'depo') return { ok: false, chyba: 'Přestavět jde jen vozidlo v garáži nebo depu' };
    const o = v.oddily[k];
    if (!o) return { ok: false, chyba: 'Neznámý oddíl' };
    if (o.n > 0) return { ok: false, chyba: 'Oddíl musí být prázdný' };
    const povolene = o.vagon ? D.VAGONY_PODLE_ID[o.vagon].naklady : D.VOZIDLA_PODLE_ID[v.typ].naklady;
    if (!povolene.includes(typ) || typ === o.typ) return { ok: false, chyba: 'Tento náklad vozidlo vozit neumí' };
    if (v.druh === 'let') return { ok: false, chyba: 'Letadla vozí cestující a poštu' };
    const cena = Math.max(300, Math.round((o.vagon ? D.VAGONY_PODLE_ID[o.vagon].cena : D.VOZIDLA_PODLE_ID[v.typ].cena) * 0.1));
    return vysledek(h, cena, jenCena, 'vozidla', () => { o.typ = typ; });
  }
  function nastavRozkaz(h, vId, k, zmena) {
    const v = h.vozidla[vId];
    if (!aktivni(v) || !v.rozkazy[k]) return { ok: false };
    Object.assign(v.rozkazy[k], zmena);
    return { ok: true };
  }

  // doručení nákladu podnikům v oblasti stanice (zpracovatel z něj vyrobí další náklad)
  function dodej(h, st, typ, n) {
    const m = h.m;
    // potraviny a zboží pro město (přijímají je domy)
    if ((typ === 'potraviny' || typ === 'zbozi' || typ === 'voda') && st.mesto >= 0 && h.mestaStat && h.mestaStat[st.mesto]) {
      const ms = h.mestaStat[st.mesto].mesic; ms['dodano_' + typ] = (ms['dodano_' + typ] || 0) + n;
    }
    for (const i of oblast(h, st)) {
      if (!m.prum[i]) continue;
      const q = m.prumysl[m.prum[i] - 1], p = D.PRUMYSL_PODLE_ID[q.typ];
      if (q.zrusen || !p.prijima.includes(typ)) continue;
      const s = h.prum[q.id];
      s.vstup += n;
      s.mesic['dodano_' + typ] = (s.mesic['dodano_' + typ] || 0) + n;
      if (!s.celkemDodano) s.celkemDodano = {};
      s.celkemDodano[typ] = (s.celkemDodano[typ] || 0) + n;
      return;
    }
  }

  // --- denní výroba a hodnocení stanic -------------------------------------------------------------
  function rozdel(h, stanice, typ, n, stat) {
    // náklad dostanou nejvýš 2 stanice s nejlepším hodnocením; množství podle hodnocení
    const kandidati = stanice.map(s => [s, s.naklady[typ]]).filter(([, z]) => z && z.navst).sort((a, b) => b[1].hodn - a[1].hodn).slice(0, 2);
    if (!kandidati.length || n <= 0) return 0;
    const best = kandidati[0][1].hodn / 255;
    let celkem = n * best;
    celkem = Math.floor(celkem) + (h.nah.f() < celkem % 1 ? 1 : 0);
    if (celkem <= 0) return 0;
    if (kandidati.length === 1) { kandidati[0][1].ceka += celkem; return celkem; }
    const [a, b] = kandidati, sa = a[1].hodn / (a[1].hodn + b[1].hodn);
    const na = Math.round(celkem * sa);
    a[1].ceka += na; b[1].ceka += celkem - na;
    if (stat) stat(celkem);
    return celkem;
  }

  function denni(h) {
    const m = h.m;
    // provoz vozidel
    let provoz = 0;
    for (const v of h.vozidla) {
      if (!aktivni(v)) continue;
      v.stari++;
      if (v.stav !== 'depo') spolehlivost(h, v);
      for (const o of v.oddily) if (o.n > 0) o.dni++;
      if (v.bezi || v.stav !== 'depo') { const c = D.VOZIDLA_PODLE_ID[v.typ].provoz / 365; provoz += c; v.zisk.letos -= c; }
    }
    if (provoz) zauctuj(h, 'provoz', -provoz);
    const fKrize = h.ekonomika && h.ekonomika.krize > 0 ? 0.6 : 1;
    // pokrytí domů a podniků stanicemi
    const domy = new Map(), podniky = new Map();
    for (const st of h.stanice) {
      if (!st) continue;
      for (const i of oblast(h, st)) {
        if (m.dum[i]) { const k = m.dum[i] - 1; let l = domy.get(k); if (!l) domy.set(k, l = []); if (!l.includes(st)) l.push(st); }
        if (m.prum[i]) { const k = m.prum[i] - 1; let l = podniky.get(k); if (!l) podniky.set(k, l = []); if (!l.includes(st)) l.push(st); }
      }
    }
    for (const [k, sts] of domy) {
      const d = m.domy[k];
      if (!d.obyv) continue;
      const a = h.akum[k] || (h.akum[k] = [0, 0]);
      a[0] += d.obyv / 250 * fKrize; a[1] += d.obyv / 1300;
      const nl = Math.floor(a[0]), np = Math.floor(a[1]);
      a[0] -= nl; a[1] -= np;
      const cs = h.mestaStat[d.mesto], ms = cs && cs.mesic;
      if (nl) { const o = rozdel(h, sts, 'lide', nl); if (ms) { ms.lide = (ms.lide || 0) + nl; ms.lideOdv = (ms.lideOdv || 0) + o; } }
      if (np) { const o = rozdel(h, sts, 'posta', np); if (ms) { ms.posta = (ms.posta || 0) + np; ms.postaOdv = (ms.postaOdv || 0) + o; } }
    }
    // podniky: 4× za měsíc vydají čtvrtinu měsíční výroby (+ zpracované suroviny)
    for (const q of m.prumysl) {
      if (q.zrusen || (h.den + q.id) % 8) continue;
      const p = D.PRUMYSL_PODLE_ID[q.typ], s = h.prum[q.id];
      const vystupy = Object.keys(p.vyroba);
      const zpracovane = vystupy.filter(k => !p.vyroba[k]);
      if (s.vstup && zpracovane.length) { for (const k of zpracovane) s.zasoba[k] = (s.zasoba[k] || 0) + s.vstup / zpracovane.length; }
      s.vstup = 0;
      for (const k of vystupy) {
        let n = (q.vyroba[k] || 0) / 4 * fKrize + (s.zasoba[k] || 0);
        s.zasoba[k] = 0;
        n = Math.floor(n) + (h.nah.f() < n % 1 ? 1 : 0);
        if (!n) continue;
        s.mesic['vyrobeno_' + k] = (s.mesic['vyrobeno_' + k] || 0) + n;
        const sts = podniky.get(q.id);
        if (sts) { const odvez = rozdel(h, sts, k, n); s.mesic['odvezeno_' + k] = (s.mesic['odvezeno_' + k] || 0) + odvez; }
      }
    }
    // hodnocení stanic (jako ve žánru: doba od vyzvednutí, rychlost vozidla, množství čekajícího nákladu)
    for (const st of h.stanice) {
      if (!st) continue;
      for (const z of Object.values(st.naklady)) {
        if (!z.navst) continue;
        z.dni++;
        let cil = 0;
        cil += Math.max(0, Math.min(42, (z.rychlost - 40) / 2));
        cil += z.dni > 21 ? 0 : z.dni > 12 ? 25 : z.dni > 6 ? 45 : z.dni > 3 ? 65 : 95;
        cil += z.ceka <= 100 ? 40 : z.ceka <= 300 ? 30 : z.ceka <= 600 ? 10 : z.ceka <= 1000 ? 0 : z.ceka <= 1500 ? -35 : -90;
        cil += 33;
        const csk = h.mestaStat && h.mestaStat[st.mesto];
        if (csk && csk.kampan && csk.kampan.do > h.den) cil += csk.kampan.bonus;   // reklamní kampaň v obci
        cil = Math.max(0, Math.min(255, cil));
        z.hodn += Math.sign(cil - z.hodn) * Math.min(2, Math.abs(cil - z.hodn));
        if (z.hodn < 128 && z.ceka > 100) z.ceka -= Math.ceil(z.ceka * (128 - z.hodn) / 2000);
        if (z.ceka > 4095) z.ceka = 4095;
      }
    }
  }

  // --- měsíčně: úroky, růst měst, statistiky -----------------------------------------------------------
  function mesicni(h) {
    const f = h.firma;
    if (f.uver > 0) zauctuj(h, 'uroky', -f.uver * f.urok / 12);
    for (const s of h.prum) { s.minuly = s.mesic; s.mesic = {}; }
    for (const cs of h.mestaStat) { cs.minuly = cs.mesic; cs.mesic = {}; }
    if (MAG.ekonomika) MAG.ekonomika.mesicni(h);
    for (const c of h.m.mesta) rustMesta(h, c);
    for (const st of h.stanice) if (st) prepocitejPrijem(h, st);
    // záznam za měsíc, který právě skončil
    const d = datum(h, h.den - 1), ms = statistika(h).mesic;
    h.fin.mesice.push({ rok: d.rok, mesic: d.mesic, penize: Math.round(f.penize), hodnota: Math.round(hodnotaFirmy(h)),
      prijmy: Math.round(ms.prijmy), vydaje: Math.round(ms.vydaje), preprava: ms.preprava });
    if (h.fin.mesice.length > 240) h.fin.mesice.shift();
    h.stat.celkem.prijmy += ms.prijmy;
    h.stat.mesic = { prijmy: 0, vydaje: 0, preprava: {} };
    for (const st of h.stanice) if (st) { st.minuly = st.mesic || { nalozeno: {}, vylozeno: {} }; st.mesic = { nalozeno: {}, vylozeno: {} }; }
    if (MAG.prehledy) MAG.prehledy.mesicni(h);
    if (MAG.scenare && h.scenar) MAG.scenare.kontrola(h);
  }
  function rocni(h) {
    h.fin.loni = h.fin.letos; h.fin.letos = {};
    // odpisy: o kolik za rok klesla hodnota vozidel (nepeněžní náklad, jen do výkazu)
    let odpisy = 0;
    for (const v of h.vozidla) if (aktivni(v)) {
      const nyni = hodnotaVozidla(h, v), drive = v.hodnotaRok ?? v.cena;
      odpisy += Math.max(0, drive - nyni); v.hodnotaRok = nyni;
    }
    h.fin.odpisyLoni = Math.round(odpisy);
    (h.fin.odpisy || (h.fin.odpisy = {}))[rok(h) - 1] = Math.round(odpisy);
    const r = rok(h);
    for (const t of D.VOZIDLA) if (t.od === r) h.zpravy.push({ den: h.den, text: `🆕 Nový model: ${t.ikona} ${t.nazev} (${t.rychlost} km/h) – k dostání ${{ vlak: 'v depu', lod: 'v loděnici', let: 'na letišti' }[t.druh] || 'v garáži'}` });
    for (const v of h.vozidla) if (aktivni(v)) { v.zisk.loni = Math.round(v.zisk.letos); v.zisk.letos = 0; }
  }
  function hodnotaFirmy(h) {
    let s = h.firma.penize - h.firma.uver;
    for (const v of h.vozidla) if (aktivni(v)) s += hodnotaVozidla(h, v);
    return s;
  }

  function obsluhovanychStanic(h, c) {
    let n = 0;
    for (const st of h.stanice) {
      if (!st || Math.abs(st.x - c.x) + Math.abs(st.y - c.y) > 12) continue;
      const l = st.naklady.lide, p = st.naklady.posta;
      if ((l && l.navst && l.dni < 30) || (p && p.navst && p.dni < 30)) n++;
    }
    return n;
  }

  function rustMesta(h, c) {
    const m = h.m, nah = h.nah;
    const obsl = obsluhovanychStanic(h, c);
    let sance = 0.04 + 0.16 * Math.min(3, obsl);
    // velké město roste naplno jen s dovozem potravin
    const cs = h.mestaStat && h.mestaStat[c.id];
    if (cs && c.obyv > 1500 && !(cs.minuly.dodano_potraviny > 0)) {
      sance *= 0.25;
      if (!cs.hlasenoJidlo) { cs.hlasenoJidlo = true; h.zpravy.push({ den: h.den, text: `🥫 ${c.jmeno} přerostlo 1 500 obyvatel – aby rostlo dál, potřebuje dovoz potravin`, x: c.x, y: c.y }); }
    }
    // od 3 000 obyvatel i voda (z vodárny)
    if (cs && c.obyv > 3000 && !(cs.minuly.dodano_voda > 0)) {
      sance *= 0.5;
      if (!cs.hlasenoVoda) { cs.hlasenoVoda = true; h.zpravy.push({ den: h.den, text: `🚰 ${c.jmeno} přerostlo 3 000 obyvatel – potřebuje i dovoz vody z vodárny`, x: c.x, y: c.y }); }
    }
    const vystavba = cs && cs.vystavbaDo > h.den;   // financovaná výstavba: častěji a víc domů
    if (vystavba) sance = Math.min(1, sance * 2.2 + 0.1);
    if (nah.f() >= sance) return;
    const R = Math.round(3 + Math.sqrt(c.obyv) / 5);
    const novych = 1 + Math.min(3, obsl) + (vystavba ? 2 : 0);
    for (let k = 0; k < novych; k++) {
      // volná pole u silnice v okruhu města
      const kand = [];
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const x = c.x + dx, y = c.y + dy;
        if (!M.volnaZeme(m, x, y) || m.typ[y * m.W + x] === T.SKALA || m.typ[y * m.W + x] === T.SNIH) continue;
        if (!S4.some(([sx, sy]) => M.uvnitr(m, x + sx, y + sy) && m.cesta[(y + sy) * m.W + x + sx])) continue;
        kand.push([x, y, Math.hypot(dx, dy) + nah.f() * 3]);
      }
      if (kand.length) {
        kand.sort((a, b) => a[2] - b[2]);
        const [x, y, d] = kand[Math.min(kand.length - 1, Math.floor(nah.f() ** 2 * kand.length))];
        const r = rok(h), centrum = 1 - Math.min(1, d / (2 + Math.sqrt(c.obyv) / 4));
        const typ = c.obyv > 900 && centrum > 0.4 && nah.f() < (r >= 1950 ? 0.7 : 0.3) ? D.DOMY[2] : c.obyv > 250 && nah.f() < 0.65 ? D.DOMY[1] : D.DOMY[0];
        const obyv = nah.cele(typ.obyv[0], typ.obyv[1]), i = y * m.W + x;
        m.domy.push({ mesto: c.id, typ: typ.id, obyv, barva: nah.vyber(typ.barvy), strecha: nah.vyber(typ.strecha), x, y, rok: r });
        m.dum[i] = m.domy.length; m.les[i] = 0;
        c.obyv += obyv; c.domu++;
        zmena(h, x, y, x, y);
      } else {
        // prodloužit obecní silnici z konce ulice
        const konce = [];
        for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
          const x = c.x + dx, y = c.y + dy;
          if (!M.uvnitr(m, x, y) || m.cesta[y * m.W + x] !== 1 || m.stan[y * m.W + x]) continue;
          for (const [sx, sy] of S4) if (M.volnaZeme(m, x + sx, y + sy) && x + sx > 0 && y + sy > 0 && x + sx < m.W - 1 && y + sy < m.H - 1) konce.push([x + sx, y + sy]);
        }
        if (!konce.length) return;
        const [x, y] = nah.vyber(konce);
        m.cesta[y * m.W + x] = 1; m.les[y * m.W + x] = 0;
        zmena(h, x, y, x, y);
        h.sitVerze = (h.sitVerze || 0) + 1;
      }
    }
  }

  // --- krok simulace -------------------------------------------------------------------------------------
  function krok(h) {
    krokVozidel(h);
    if (MAG.zeleznice) { MAG.zeleznice.krokVlaku(h); srazkyNaPrejezdech(h); }
    if (MAG.vodaVzduch) MAG.vodaVzduch.krok(h);
    if (++h.tick >= DT) {
      h.tick = 0;
      const pred = datum(h);
      h.den++;
      const po = datum(h);
      denni(h);
      if (po.mesic !== pred.mesic) mesicni(h);
      if (po.rok !== pred.rok) { rocni(h); if (MAG.prehledy) MAG.prehledy.rocni(h); }
      if (MAG.prehledy) MAG.prehledy.denni(h);
    }
    if (MAG.prehledy && h.zpravy.length) MAG.prehledy.zachyt(h);
  }
  function simulujDny(h, dni) { for (let k = 0; k < dni * DT; k++) krok(h); }

  // --- uložení ------------------------------------------------------------------------------------------------
  const POLE_MAPY = ['v', 'typ', 'les', 'reka', 'cesta', 'stan', 'osa', 'depo', 'smer', 'dum', 'prum', 'kolej', 'most', 'mostV', 'navest', 'navestJ', 'elek', 'vrt', 'tunel', 'tunelV', 'tram', 'zdym'];
  function naB64(ta) {
    const u8 = new Uint8Array(ta.buffer, ta.byteOffset, ta.byteLength);
    if (typeof Buffer !== 'undefined') return Buffer.from(u8).toString('base64');
    let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function zB64(s, Typ) {
    let u8;
    if (typeof Buffer !== 'undefined') u8 = new Uint8Array(Buffer.from(s, 'base64'));
    else { const b = atob(s); u8 = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u8[i] = b.charCodeAt(i); }
    return new Typ(u8.buffer, 0, u8.byteLength / Typ.BYTES_PER_ELEMENT);
  }
  function serializuj(h) {
    const m = h.m;
    const mapa = { W: m.W, H: m.H, seed: m.seed, seedZadany: m.seedZadany, opt: m.opt, vrch: m.vrch, domy: m.domy, mesta: m.mesta, prumysl: m.prumysl, pole: {} };
    for (const k of POLE_MAPY) mapa.pole[k] = naB64(m[k]);
    const { m: _m, nah, zmeny, zpravy, ...zbytek } = h;
    return { format: 'magnat', verze: 1, mapa, hra: { ...zbytek, nahStav: h.nah.stav() } };
  }
  function deserializuj(o) {
    if (!o || o.format !== 'magnat') throw new Error('Tohle není uložená hra Dopravního magnáta');
    const p = o.mapa, m = M.novaMapa(p.W, p.H);
    for (const k of POLE_MAPY) if (p.pole[k]) { const ta = zB64(p.pole[k], m[k].constructor); m[k].set(ta); }
    Object.assign(m, { seed: p.seed, seedZadany: p.seedZadany, opt: p.opt, vrch: p.vrch, domy: p.domy, mesta: p.mesta, prumysl: p.prumysl, vady: [] });
    const h = { ...o.hra, m, zmeny: [], zpravy: [] };
    if (!h.mestaStat) h.mestaStat = m.mesta.map(() => ({ hodn: 0, mesic: {}, minuly: {} }));
    if (!h.ekonomika) h.ekonomika = { krize: 0 };
    if (h.firma.servis === undefined) h.firma.servis = 150;
    // starší uložení (náklad přímo ve vozidle) → oddíly
    for (const v of h.vozidla) if (v && !v.prodano && !v.oddily) {
      v.oddily = [{ typ: v.nakladTyp, kap: v.kapacita, n: v.n || 0, od: v.od ?? -1, dni: v.dni || 0 }];
      delete v.nakladTyp; delete v.kapacita; delete v.n; delete v.od; delete v.dni;
    }
    h.nah = MAG.Nahoda(1); h.nah.nastav(o.hra.nahStav);
    return h;
  }

  MAG.hra = {
    statistika, servis, spolehlivost, prestav, nastavRozkaz, rozestupOk,
    obecU, povoleniObce, hodnoceniText, vykacet, dodej,
    nakladani, dojezd, zmena, vysledek, nemaNa, nazevStanice, cenaPole, idx, KAT_PRIJMU,
    novaHra, datum, rok, zauctuj, uver, cara, cenaPole, osaZastavky,
    upravTeren,
    AKCE_OBCE, akceObce,
    vGarazi, prodatPoPrijezdu, ohlasLinku, nastupce, nahrad, havarie, polaVlaku, postavPoTrase, postavSilnici, postavTramKolej, postavZastavku, postavGaraz, zbor, oblast, prepocitejPrijem, maDruh,
    kup, prodej, hodnotaVozidla, pridejRozkaz, odeberRozkaz, prepniPlne, spust, doGaraze, aktivni,
    polohaVozidla, platba, krok, simulujDny, hodnotaFirmy, obsluhovanychStanic, serializuj, deserializuj, penizeText, kmhNaPole,
  };
})(globalThis.MAG = globalThis.MAG || {});
