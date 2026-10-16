/* Modelář 3D – stav aplikace: dokument, výběr, historie, rovina (bez DOM, jde v node).
   Všechny změny dokumentu jdou přes M.zmenDokument, výběr přes M.nastavVyber.
   Tažení (úchyty, posun) běží jako „úprava“: M.zacniUpravu() → dočasné
   změny bez historie → M.dokonciUpravu(popis) zapíše jediný krok,
   M.zrusUpravu() (Esc) vrátí stav před tažením.
   Události: 'dokument' {dok, popis}, 'vyber', 'historie', 'rovina'. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';

  /** Náhledy pod myší (zarovnání, zrcadlení): před klávesovým příkazem se zruší. */
  const nahledy = [];
  M.registrujNahled = f => nahledy.push(f);
  M.zrusNahledy = () => { for (const f of nahledy) f(); return !M.app.uprava; };
  M.app = { dok: M.novyDokument(), vyber: [], uprava: null, rovina: null, schranka: null, duplikace: null, pivot: null };
  M.historie = M.vytvorHistorii(500);
  M.historie.zapis({ dok: M.app.dok, vyber: [], popis: '' });

  /** Nastaví nový dokument (neměnný objekt). volby.docasne = bez zápisu do historie
      (tažení), volby.sloucit = klíč pro slučování opakovaných akcí (šipky). */
  M.zmenDokument = function (dok, popis = '', volby = {}) {
    if (dok === M.app.dok) return false;
    // přichycené poznámky: s tělesem jedou, při obalení / seskupení / smazání zůstanou na místě
    if (M.srovnejPoznamky && M.app.dok) dok = M.srovnejPoznamky(M.app.dok, dok);
    M.app.dok = dok;
    const ids = new Set(dok.uzly.map(u => u.id));
    const vyber = M.app.vyber.filter(id => ids.has(id));
    if (volby.nahraditPosledni && !M.app.uprava) {
      // dopočet k poslední akci: bez nového kroku historie
      M.historie.nahradAktualni(dok);
    } else if (!volby.docasne && !M.app.uprava && !volby.bezHistorie) {
      // M.sloucitDalsi: jednorázový klíč slučování pro další změnu (šipky a barva v inspektoru)
      // slučovat jen opakování na týchž tělesech (šipky na krychli a pak na válci = dva kroky Zpět)
      const sloucit = volby.sloucit || M.sloucitDalsi || null;
      M.historie.zapis({ dok, vyber, popis }, sloucit ? sloucit + '|' + vyber.join(',') : null);
      M.sloucitDalsi = null;
      M.vysli('historie', M.historie);
    }
    M.vysli('dokument', { dok, popis, docasne: !!(volby.docasne || M.app.uprava) });
    if (vyber.length !== M.app.vyber.length) M.nastavVyber(vyber);
    return true;
  };

  // ------------------------------------------------------------ úpravy tažením
  M.zacniUpravu = function () {
    M.app.uprava = { zaklad: M.app.dok, vyber: M.app.vyber.slice() };
    return M.app.uprava.zaklad;
  };
  M.dokonciUpravu = function (popis) {
    const u = M.app.uprava;
    if (!u) return;
    M.app.uprava = null;
    if (M.app.dok !== u.zaklad) {
      M.historie.zapis({ dok: M.app.dok, vyber: M.app.vyber.slice(), popis });
      M.vysli('historie', M.historie);
      M.vysli('dokument', { dok: M.app.dok, popis, docasne: false });
    }
  };
  M.zrusUpravu = function () {
    const u = M.app.uprava;
    if (!u) return;
    M.app.uprava = null;
    M.app.dok = u.zaklad;
    M.vysli('dokument', { dok: u.zaklad, popis: 'Zrušeno', docasne: false });
    M.nastavVyber(u.vyber);
  };

  // ------------------------------------------------------------ zpět / znovu
  function obnovZaznam(z) {
    if (!z) return false;
    M.app.dok = z.dok;
    M.vysli('dokument', { dok: z.dok, popis: 'Historie', docasne: false });
    M.app.vyber = [];
    M.nastavVyber(z.vyber);
    M.app.duplikace = null;
    M.vysli('historie', M.historie);
    return true;
  }
  // náhled pod myší se před Zpět/Znovu zruší (jinak by Ctrl+Z potichu nic neudělal)
  const bezNahledu = () => { if (M.app.uprava && M.zrusNahledy) M.zrusNahledy(); return !M.app.uprava; };
  M.zpet = () => bezNahledu() && obnovZaznam(M.historie.zpet());
  M.znovu = () => bezNahledu() && obnovZaznam(M.historie.znovu());
  M.skocVHistorii = i => !M.app.uprava && obnovZaznam(M.historie.skoc(i));

  // ------------------------------------------------------------ výběr
  M.nastavVyber = function (ids) {
    const existuji = new Set(M.app.dok.uzly.filter(u => !u.skryto).map(u => u.id));
    const novy = [...new Set(ids)].filter(id => existuji.has(id));
    if (novy.length === M.app.vyber.length && novy.every((id, i) => id === M.app.vyber[i])) return;
    M.app.vyber = novy;
    if (!M.app.uprava) M.historie.nastavVyber(novy);
    // opakování Ctrl+D platí jen, dokud jsou vybrané právě poslední kopie
    const d = M.app.duplikace;
    if (d && !(d.kopie.length === novy.length && d.kopie.every(id => novy.includes(id)))) M.app.duplikace = null;
    M.vysli('vyber', novy);
  };
  M.prepniVyber = function (id) {
    const v = M.app.vyber;
    M.nastavVyber(v.includes(id) ? v.filter(x => x !== id) : v.concat(id));
  };
  M.vybraneUzly = () => M.app.vyber.map(id => M.najdiUzel(M.app.dok, id)).filter(Boolean);
  M.vybraneVolne = () => M.vybraneUzly().filter(u => !u.zamceno);

  // ------------------------------------------------------------ pracovní rovina
  M.rovina = () => M.app.rovina || M.ROVINA_DESKY;
  M.nastavRovinu = function (r) {
    M.app.rovina = r;
    M.vysli('rovina', M.rovina());
  };

  // ------------------------------------------------------------ akce
  /** Přidá nový tvar a vybere ho. */
  M.pridejTvar = function (druh, prepis = {}) {
    // sada šroub + matice = dva samostatné objekty se sladěnou vůlí
    const kv = M.kvalitaNovych ? M.kvalitaNovych() : 'stredni';
    const sKv = u => kv === 'stredni' || (prepis.param && 'segmentu' in prepis.param) ? u : M.sKvalitou(u, kv);
    if ((druh === 'sadaSroub' && M.uzlySadySroubu) || (druh === 'krabiceSVikem' && M.uzlyKrabice)) {
      const vlastniVule = prepis.param && 'vule' in prepis.param;
      const uzly = (druh === 'sadaSroub' ? M.uzlySadySroubu : M.uzlyKrabice)(prepis, M.app.dok).map(sKv).map(u => M.sMojiVuli && !vlastniVule ? M.sMojiVuli(u) : u);
      M.zmenDokument(M.pridejUzly(M.app.dok, uzly), druh === 'sadaSroub' ? 'Přidat šroub a matici' : 'Přidat krabičku s víkem');
      M.nastavVyber(uzly.map(u => u.id));
      return uzly[0];
    }
    let u = sKv(M.novyUzel(druh, prepis, M.app.dok));
    if (M.sMojiVuli && !(prepis.param && ('vule' in prepis.param || 'odsazeni' in prepis.param))) u = M.sMojiVuli(u);
    M.zmenDokument(M.pridejUzly(M.app.dok, [u]), 'Přidat ' + u.nazev);
    M.nastavVyber([u.id]);
    return u;
  };

  /** Kvalita oblých ploch vybraných těles (i částí skupin) – jeden krok historie. */
  M.nastavKvalituVybranych = function (kvalita) {
    const k = M.KVALITY.find(x => x.id === kvalita);
    if (!k) return false;
    const dok = M.nastavKvalitu(M.app.dok, M.app.vyber, kvalita);
    if (dok === M.app.dok) return false;
    M.zmenDokument(dok, 'Kvalita: ' + k.nazev.toLowerCase());
    return true;
  };

  /* Předvolby prohlížeče (moje vůle, kvalita nových těles): localStorage, a když není (soukromé okno,
     zakázané úložiště), aspoň v paměti do zavření stránky – volba se nesmí tiše ztratit. Starší klíče
     s tečkou (modelar.vule) se převezmou. */
  const pametPredvoleb = {};
  function predvolba(klic, stary, nova) {
    try {
      if (nova === null) localStorage.removeItem(klic);
      else if (nova !== undefined) localStorage.setItem(klic, String(nova));
      let v = localStorage.getItem(klic);
      if (v == null && stary) { v = localStorage.getItem(stary); if (v != null) { localStorage.setItem(klic, v); localStorage.removeItem(stary); } }
      if (nova !== undefined) delete pametPredvoleb[klic];
      return v;
    } catch (e) {
      if (nova === null) delete pametPredvoleb[klic];
      else if (nova !== undefined) pametPredvoleb[klic] = String(nova);
      return klic in pametPredvoleb ? pametPredvoleb[klic] : null;
    }
  }
  /** Ukládá se předvolba trvale (localStorage funguje)? */
  M.predvolbyTrvale = function () { try { localStorage.setItem('modelar_test', '1'); localStorage.removeItem('modelar_test'); return true; } catch (e) { return false; } };

  /** Moje vůle pro tisk (radiální, mm; z kalibrační destičky); null = výchozí vůle dílů. */
  M.mojeVule = function (nova) {
    const v = parseFloat(predvolba('modelar_vule', 'modelar.vule', nova));
    return v >= 0 && v <= 2 ? v : null;
  };
  M.sMojiVuli = u => { const v = M.mojeVule(); return v == null ? u : M.sVuli(u, v); };

  /** Kvalita nově vkládaných těles ('stredni' = výchozí tvarů). */
  M.kvalitaNovych = function (nova) {
    const v = predvolba('modelar_kvalitaNovych', 'modelar.kvalitaNovych', nova);
    return M.KVALITY.some(k => k.id === v) ? v : 'stredni';
  };

  /** Smaže vybrané (zamčené zůstanou). */
  M.smazVybrane = function () {
    const ids = M.vybraneVolne().map(u => u.id);
    if (!ids.length) return 0;
    M.zmenDokument(M.odeberUzly(M.app.dok, ids), 'Smazat');
    return ids.length;
  };

  /** Úprava uzlů s ohledem na zámek (zamčeným jde měnit jen zámek a viditelnost). */
  M.upravVybrane = function (zmena, popis = 'Upravit', ids = M.app.vyber, volby = {}) {
    // náhled pod myší (zarovnání, zrcadlení) zrušit – jinak by se úprava zapsala jen dočasně a s náhledem zmizela
    if (M.app.uprava && M.zrusNahledy) M.zrusNahledy();
    const dok = M.app.dok;
    const povol = ids.filter(id => {
      const u = M.najdiUzel(dok, id);
      if (!u) return false;
      if (!u.zamceno) return true;
      const z = typeof zmena === 'function' ? null : zmena;
      return z && Object.keys(z).every(k => k === 'zamceno' || k === 'skryto');
    });
    const novy = M.upravUzly(dok, povol, zmena);
    M.zmenDokument(novy, popis, volby);
    // skrytý uzel nemůže zůstat vybraný
    const skryte = new Set(novy.uzly.filter(u => u.skryto).map(u => u.id));
    if (M.app.vyber.some(id => skryte.has(id))) M.nastavVyber(M.app.vyber.filter(id => !skryte.has(id)));
    return novy !== dok;
  };

  /** Funkce dok → dok nad vybranými (transformace z jadro/transformace.js). */
  M.provedNaVybranych = function (fn, popis, volby = {}) {
    const ids = M.app.vyber.slice();
    if (!ids.length) return false;
    return M.zmenDokument(fn(M.app.dok, ids), popis, volby);
  };

  /** Ctrl+D: duplikát na místě; po posunu/otočení kopie další Ctrl+D zopakuje krok. */
  M.duplikuj = function () {
    const ids = M.app.vyber.slice();
    if (!ids.length) return [];
    const d = M.app.duplikace;
    const opakovat = d && d.kopie.length === ids.length && d.kopie.every(id => ids.includes(id))
      && M.app.dok.uzly.some(u => u.id === d.zdroje[0]);
    const r = opakovat ? M.opakujDuplikaci(M.app.dok, d.zdroje, d.kopie) : M.duplikujUzly(M.app.dok, ids);
    M.zmenDokument(r.dok, 'Duplikovat');
    const zdroje = opakovat ? d.kopie : ids;
    M.nastavVyber(r.kopie);
    M.app.duplikace = { zdroje, kopie: r.kopie };
    return r.kopie;
  };

  // ------------------------------------------------------------ skupiny
  /** Ctrl+G: seskupí vybraná (aspoň 2 nezamčená) tělesa a vybere skupinu. */
  M.seskupVybrane = function () {
    const r = M.seskupUzly(M.app.dok, M.app.vyber);
    if (!r.id) return null;
    M.zmenDokument(r.dok, 'Seskupit');
    M.nastavVyber([r.id]);
    return r.id;
  };
  /** Ctrl+Shift+G: rozdělí vybrané skupiny a vybere jejich části. */
  M.rozdelVybrane = function () {
    const r = M.rozdelSkupiny(M.app.dok, M.app.vyber);
    if (!r.ids.length) return [];
    M.zmenDokument(r.dok, 'Zrušit seskupení');
    M.nastavVyber(r.ids);
    return r.ids;
  };

  // ------------------------------------------------------------ schránka (jen uvnitř aplikace)
  M.kopiruj = function () {
    const uzly = M.vybraneUzly();
    if (!uzly.length) return 0;
    M.app.schranka = { uzly: JSON.parse(JSON.stringify(uzly)), vlozeno: 0 };
    return uzly.length;
  };
  /** Vloží kopii schránky posunutou o `posun` mm doprava a dopředu za každé vložení. */
  M.vloz = function (posun = 10) {
    const s = M.app.schranka;
    if (!s) return [];
    s.vlozeno++;
    const nove = [];
    for (const u of s.uzly) nove.push(M.normalizujUzel(Object.assign(M.noveIdHluboko(u), {
      zamceno: false, skryto: false,
      nazev: M.nazevKopie({ uzly: M.app.dok.uzly.concat(nove) }, u),
      poloha: [u.poloha[0] + posun * s.vlozeno, u.poloha[1] - posun * s.vlozeno, u.poloha[2]],
    })));
    M.zmenDokument(M.pridejUzly(M.app.dok, nove), 'Vložit');
    M.nastavVyber(nove.map(u => u.id));
    return nove.map(u => u.id);
  };

  /** Otevře dokument (načtený projekt) s čistou historií a prázdným výběrem. */
  M.otevriDokument = function (dok) {
    // jiný projekt: žádný režim klikání ani bod otáčení z předchozího
    if (M.app.rezim && M.nastavRezim) M.nastavRezim(null);
    M.app.pivot = null;
    M.app.uprava = null;
    M.app.dok = dok;
    M.app.vyber = [];
    M.app.duplikace = null;
    M.historie.vymaz({ dok, vyber: [], popis: '' });
    M.vysli('dokument', { dok, popis: 'Otevřít', docasne: false });
    M.vysli('vyber', []);
    M.vysli('historie', M.historie);
  };

  /** Nový prázdný dokument (a vyčištěná historie). */
  M.novyProjekt = () => M.otevriDokument(M.novyDokument());

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);
