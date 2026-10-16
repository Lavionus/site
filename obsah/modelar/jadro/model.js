/* Modelář 3D – datový model scény (bez DOM, jde v node).
   Dokument: { verze: 1, uzly: [uzel, …] } – pořadí uzlů = pořadí v seznamu.
   Uzel: { id, druh, nazev, rozmer: [sx, sy, sz], param: {…},
           poloha: [x, y, z] (střed obalového kvádru ve světě, mm),
           rotace: [rx, ry, rz] (stupně, Euler XYZ jako v three.js),
           zrcadlo: [bool, bool, bool] (zrcadlení podle lokálních os),
           role: 'teleso' | 'dira', barva: '#rrggbb', skryto, zamceno }.
   Světová matice = posun(poloha) · rotace · zrcadlo.
   Skupina: druh 'skupina', deti: [uzly v lokálních souřadnicích skupiny],
   zaklad: [x, y, z] (přirozená velikost = obálka plných dětí, střed v 0),
   operace: 'sjednoceni' | 'prunik', barevne: bool (zachovat barvy částí).
   Její matice má navíc měřítko rozmer/zaklad, takže zvětšení skupiny
   nevyžaduje nový boolean – ten závisí jen na dětech a operaci.
   Importovaný model: druh 'sit', zdroj: id geometrie v registru M.zdroje
   (síť vycentrovaná v 0), zaklad = její velikost; měřítko jako u skupiny.
   Geometrie zdrojů není v dokumentu, takže historie i ukládání jsou levné
   a stejný model se uloží jen jednou.
   S dokumentem se zachází jako s neměnným: úpravy vrací nový dokument
   a nezměněné uzly sdílí (na tom stojí historie undo v etapě 3). */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';

  const MIN_ROZMER = 0.01, MAX_ROZMER = 10000, MAX_POLOHA = 100000;

  let citac = 0;
  /** Platné id uzlu: jen písmena, číslice, _ a - (id ze souboru jde do HTML a selektorů). */
  M.idOk = x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(x);
  M.noveId = function () {
    citac = (citac + 1) % 1e6;
    return 'u' + Date.now().toString(36) + citac.toString(36) + Math.floor(Math.random() * 1296).toString(36);
  };

  M.novyDokument = () => ({ verze: 1, uzly: [] });

  const cislo = (v, nahr) => (typeof v === 'number' && isFinite(v)) ? v : nahr;
  const barvaOk = b => typeof b === 'string' && /^#[0-9a-f]{6}$/i.test(b);

  M.SKUPINA = { nazev: 'Skupina', ikona: '🧩', barva: '#7a8b99', rozmer: [20, 20, 20], param: {}, parametry: [] };
  M.MODEL = { nazev: 'Model', ikona: '📦', barva: '#8e9aa8', rozmer: [20, 20, 20], param: {}, parametry: [] };
  M.SKICA = { nazev: 'Skica', ikona: '✏️', barva: '#3a8fd8', rozmer: [20, 20, 10], param: {}, get parametry() { return M.SKICA_PARAMETRY; } };
  /** Popis druhu (tvar z katalogu, skupina, importovaný model, skica). */
  M.popisDruhu = druh => druh === 'skupina' ? M.SKUPINA : druh === 'sit' ? M.MODEL : druh === 'skica' ? M.SKICA
    : (M.DILY && M.DILY[druh]) || M.TVARY[druh];
  const jeDil = druh => !!(M.DILY && M.DILY[druh]);
  /** Má uzel přirozenou geometrii z parametrů (skica, díl): stred + zaklad, rozmer škáluje. */
  M.maPrirozene = u => u.druh === 'skica' || jeDil(u.druh);
  /** Počítá se geometrie uzlu ve workeru (manifold)? */
  M.pocitaWorker = u => u.druh === 'skupina' || M.maPrirozene(u);
  /** Střed a velikost přirozené geometrie z parametrů. */
  M.rozmeryPrirozene = (druh, param) => druh === 'skica' ? M.rozmeryTelesaSkici(param) : M.rozmeryDilu(druh, param);
  M.normalizujParamPrirozene = (druh, param) => druh === 'skica' ? M.normalizujParamSkici(param) : M.normalizujParamDilu(druh, param);
  M.jeSkupina = u => !!u && u.druh === 'skupina';
  /** Má uzel přirozenou geometrii se základem (měřítko rozmer/zaklad)? */
  M.maZaklad = u => u.druh === 'skupina' || u.druh === 'sit' || M.maPrirozene(u);

  // ------------------------------------------------------------ zdroje importovaných sítí
  /** id → { poz: Float32Array, idx: Uint32Array, nazev, format } */
  M.zdroje = M.zdroje || new Map();

  /** Hash bajtů (dva nezávislé 53bitové cyrb53 = 106 bitů) – klíč zdroje. */
  M.hashBajtu = function (bajty) {
    const b = bajty instanceof Uint8Array ? bajty : new Uint8Array(bajty.buffer, bajty.byteOffset, bajty.byteLength);
    let a1 = 0xdeadbeef, a2 = 0x41c6ce57, c1 = 0x9e3779b9, c2 = 0x85ebca6b;
    for (let i = 0; i < b.length; i++) {
      const x = b[i];
      a1 = Math.imul(a1 ^ x, 2654435761); a2 = Math.imul(a2 ^ x, 1597334677);
      c1 = Math.imul(c1 ^ x, 2246822519); c2 = Math.imul(c2 ^ x, 3266489917);
    }
    const fin = (h1, h2) => {
      h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
      h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
      return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36).padStart(11, '0');
    };
    return fin(a1, a2) + fin(c1, c2) + b.length.toString(36);
  };

  /** Klíč zdroje z jeho obsahu: síť, a jsou-li, i barvy trojúhelníků a text STEP
      (stejná síť s jinými barvami je jiný zdroj – záznam v registru se nikdy nemění). */
  M.klicZdroje = function (sit, extra = null) {
    const p = new Uint8Array(sit.poz.buffer, sit.poz.byteOffset, sit.poz.byteLength);
    const i = new Uint8Array(sit.idx.buffer, sit.idx.byteOffset, sit.idx.byteLength);
    const spoj = new Uint8Array(p.length + i.length);
    spoj.set(p); spoj.set(i, p.length);
    let k = 'z' + M.hashBajtu(spoj);
    if (extra && extra.barvyTroj && extra.paleta) {
      const bt = new Uint8Array(extra.barvyTroj.buffer, extra.barvyTroj.byteOffset, extra.barvyTroj.byteLength);
      const pal = new TextEncoder().encode(extra.paleta.join(','));
      const b = new Uint8Array(bt.length + pal.length); b.set(bt); b.set(pal, bt.length);
      k += 'b' + M.hashBajtu(b);
    }
    if (extra && typeof extra.step === 'string') k += 's' + M.hashBajtu(new TextEncoder().encode(extra.step + '|' + (extra.stredStep || []).join(',')));
    return k;
  };

  /** Přidá síť do registru zdrojů (deduplikace podle klíče), vrátí id.
      extra = {barvyTroj, paleta} (barvy ze souboru) a/nebo {step, stredStep} (přesná geometrie STEP). */
  M.pridejZdroj = function (sit, nazev = '', format = '', extra = null) {
    const barvy = extra && extra.barvyTroj && extra.paleta && extra.paleta.length > 1 && extra.barvyTroj.length === sit.idx.length / 3
      ? { barvyTroj: extra.barvyTroj, paleta: extra.paleta } : null;
    const step = extra && typeof extra.step === 'string' ? { step: extra.step, stredStep: extra.stredStep } : null;
    const id = M.klicZdroje(sit, Object.assign({}, barvy, step));
    if (!M.zdroje.has(id)) M.zdroje.set(id, Object.assign({ poz: sit.poz, idx: sit.idx, nazev, format }, barvy, step));
    return id;
  };

  /** Barvy trojúhelníků importovaného modelu {barvyTroj, paleta}, nebo null
      (model bez barev ze souboru, nebo je má uživatel vypnuté). */
  M.barvySite = function (u) {
    if (u.druh !== 'sit' || u.jednobarevne) return null;
    const z = M.zdroje.get(u.zdroj);
    return z && z.barvyTroj && z.paleta && z.paleta.length > 1 ? { barvyTroj: z.barvyTroj, paleta: z.paleta } : null;
  };

  const BARVY_NAZVY = [['červená', 0xd93025], ['oranžová', 0xf08c2a], ['žlutá', 0xf2c81e], ['zelená', 0x3cae5c], ['tmavě zelená', 0x1e6b34],
    ['tyrkysová', 0x1fa5a0], ['modrá', 0x2f7fd8], ['tmavě modrá', 0x23357a], ['fialová', 0x8e44ad], ['růžová', 0xe84393],
    ['hnědá', 0x7a5230], ['béžová', 0xd8c3a0], ['šedá', 0x8a939c], ['bílá', 0xf4f4f4], ['černá', 0x222222]];
  /** Český název nejbližší barvy (pro názvy objektů a souborů po barvách). */
  M.nazevBarvy = function (hex) {
    const c = parseInt(String(hex).replace('#', ''), 16);
    const r = c >> 16 & 255, g = c >> 8 & 255, b = c & 255;
    let nej = 'barva', d0 = Infinity;
    for (const [n, x] of BARVY_NAZVY) {
      const dr = r - (x >> 16 & 255), dg = g - (x >> 8 & 255), db = b - (x & 255);
      const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
      if (d < d0) { d0 = d; nej = n; }
    }
    return nej;
  };

  /** Síť zdroje (vyhodí chybu, když chybí – třeba poškozený soubor projektu). */
  M.sitZdroje = function (id) {
    const z = M.zdroje.get(id);
    if (!z) throw new Error('chybí geometrie importovaného modelu (' + id + ')');
    return z;
  };

  /** Všechna id zdrojů použitá v uzlech (rekurzivně). odvozene = i sítě skupin s přesnou
      úpravou (počítá je OCCT; do souboru se neukládají, při otevření se spočítají znovu). */
  M.zdrojeUzlu = function (uzly, set = new Set(), odvozene = false) {
    for (const u of uzly) {
      if (u.druh === 'sit') set.add(u.zdroj);
      if (u.druh === 'skupina') {
        if (odvozene && u.occt) set.add(M.klicOcct(u));
        M.zdrojeUzlu(u.deti, set, odvozene);
      }
    }
    return set;
  };
  /** Skupiny s přesnou úpravou (nejhlubší první), jejichž síť ještě není v registru. */
  M.chybejiciOcct = function (u, out = []) {
    if (u.druh === 'skupina') {
      for (const d of u.deti) M.chybejiciOcct(d, out);
      if (u.occt && !M.zdroje.has(M.klicOcct(u))) out.push(u);
    }
    return out;
  };

  /** Přirozená síť tvaru nebo importovaného modelu (ne skupiny). */
  M.sitUzlu = u => {
    if (M.maPrirozene(u)) throw new Error('skica a díly se počítají ve workeru');
    return u.druh === 'sit' ? M.sitZdroje(u.zdroj) : M.sitTvaru(u.druh, u.rozmer, u.param);
  };

  /** Opraví a doplní parametry tvaru podle popisu v katalogu. */
  M.normalizujParam = function (druh, param) {
    if (druh === 'skupina') return {};
    const t = M.TVARY[druh], p = {};
    for (const [k, v] of Object.entries(t.param)) p[k] = v;
    for (const d of t.parametry) {
      if (d.odvozeny) continue;                  // pole jen v inspektoru (zapisuje rozměr a parametry)
      if (d.volby) { const v = param && param[d.klic]; p[d.klic] = d.volby.some(x => x[0] === v) ? v : t.param[d.klic]; continue; }
      if (d.prepinac) { p[d.klic] = param && d.klic in param ? !!param[d.klic] : !!t.param[d.klic]; continue; }
      let v = cislo(param && param[d.klic], t.param[d.klic]);
      if (d.cele) v = Math.round(v);
      p[d.klic] = M.omez(v, d.min, d.max);
    }
    return p;
  };

  /** Vrátí opravený uzel (nový objekt): meze rozměrů, typy, výchozí hodnoty.
      Používá se pro nové uzly i pro data ze souboru. */
  // už ověřené uzly (dokument je neměnný): dítě skupiny se při úpravě skupiny nepřestavuje znovu – historie
  // pak sdílí nezměněné podstromy a velká skupina se při každém posunu nekopíruje celá
  const normalizovane = new WeakSet();
  /** Název bez řídicích znaků (v 3MF by byl neplatné XML), oříznutý, nejvýš 80 znaků; jinak výchozí. */
  const cistyNazev = (n, vychozi) => {
    const c = typeof n === 'string' ? n.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) : '';
    return c || vychozi;
  };
  M.normalizujUzel = function (u) {
    const v = normalizuj(u);
    normalizovane.add(v);
    return v;
  };
  function normalizuj(u) {
    if (!u || !M.popisDruhu(u.druh)) throw new Error('neznámý tvar: ' + (u && u.druh));
    const t = M.popisDruhu(u.druh);
    const trojice = (v, nahr, min, max) => [0, 1, 2].map(i => M.omez(cislo(Array.isArray(v) ? v[i] : undefined, nahr[i]), min, max));
    if (M.maPrirozene(u)) {
      const param = M.normalizujParamPrirozene(u.druh, u.param);
      // střed a velikost tělesa: z uzlu, nebo spočítat z parametrů (nový uzel)
      const r = Array.isArray(u.stred) && Array.isArray(u.zaklad) ? null : M.rozmeryPrirozene(u.druh, param);
      // i spočítané rozměry v mezích (z extrémních parametrů nesmí vzniknout Infinity/NaN)
      const zaklad = trojice(r ? r.zaklad : u.zaklad, [10, 10, 10], MIN_ROZMER, MAX_ROZMER);
      const stred = trojice(r ? r.stred : u.stred, [0, 0, 0], -MAX_POLOHA, MAX_POLOHA);
      const pod = u.podklad && typeof u.podklad.data === 'string' && u.podklad.data.length < 12e6 ? {
        data: u.podklad.data, x: cislo(u.podklad.x, 0), y: cislo(u.podklad.y, 0),
        sirka: M.omez(cislo(u.podklad.sirka, 100), 0.1, 1e5), pruhlednost: M.omez(cislo(u.podklad.pruhlednost, 0.5), 0, 1),
        pomer: M.omez(cislo(u.podklad.pomer, 1), 0.01, 100),          // výška / šířka obrázku
      } : null;
      return {
        id: M.idOk(u.id) ? u.id : M.noveId(),
        druh: u.druh,
        nazev: cistyNazev(u.nazev, t.nazev),
        rozmer: trojice(u.rozmer, zaklad, MIN_ROZMER, MAX_ROZMER),
        param,
        poloha: trojice(u.poloha, [0, 0, zaklad[2] / 2], -MAX_POLOHA, MAX_POLOHA),
        rotace: trojice(u.rotace, [0, 0, 0], -36000, 36000),
        zrcadlo: [0, 1, 2].map(i => !!(Array.isArray(u.zrcadlo) && u.zrcadlo[i])),
        role: (u.role || t.role) === 'dira' ? 'dira' : 'teleso',
        barva: barvaOk(u.barva) ? u.barva.toLowerCase() : t.barva,
        skryto: !!u.skryto,
        zamceno: !!u.zamceno,
        zaklad, stred, podklad: u.druh === 'skica' ? pod : null,
      };
    }
    if (u.druh === 'sit') {
      if (typeof u.zdroj !== 'string' || !u.zdroj) throw new Error('model bez zdroje geometrie');
      const zaklad = trojice(u.zaklad, t.rozmer, MIN_ROZMER, MAX_ROZMER);
      return {
        id: M.idOk(u.id) ? u.id : M.noveId(),
        druh: 'sit',
        nazev: cistyNazev(u.nazev, t.nazev),
        rozmer: trojice(u.rozmer, zaklad, MIN_ROZMER, MAX_ROZMER),
        param: {},
        poloha: trojice(u.poloha, [0, 0, zaklad[2] / 2], -MAX_POLOHA, MAX_POLOHA),
        rotace: trojice(u.rotace, [0, 0, 0], -36000, 36000),
        zrcadlo: [0, 1, 2].map(i => !!(Array.isArray(u.zrcadlo) && u.zrcadlo[i])),
        role: u.role === 'dira' ? 'dira' : 'teleso',
        barva: barvaOk(u.barva) ? u.barva.toLowerCase() : t.barva,
        skryto: !!u.skryto,
        zamceno: !!u.zamceno,
        zdroj: u.zdroj,
        zaklad,
        ...(u.jednobarevne ? { jednobarevne: true } : {}),     // barvy trojúhelníků ze souboru vypnuté
      };
    }
    if (u.druh === 'skupina') {
      if (!Array.isArray(u.deti) || !u.deti.length) throw new Error('prázdná skupina');
      const zaklad = trojice(u.zaklad, t.rozmer, MIN_ROZMER, MAX_ROZMER);
      return {
        id: M.idOk(u.id) ? u.id : M.noveId(),
        druh: 'skupina',
        nazev: cistyNazev(u.nazev, t.nazev),
        rozmer: trojice(u.rozmer, zaklad, MIN_ROZMER, MAX_ROZMER),
        param: {},
        poloha: trojice(u.poloha, [0, 0, zaklad[2] / 2], -MAX_POLOHA, MAX_POLOHA),
        rotace: trojice(u.rotace, [0, 0, 0], -36000, 36000),
        zrcadlo: [0, 1, 2].map(i => !!(Array.isArray(u.zrcadlo) && u.zrcadlo[i])),
        role: u.role === 'dira' ? 'dira' : 'teleso',
        barva: barvaOk(u.barva) ? u.barva.toLowerCase() : t.barva,
        skryto: !!u.skryto,
        zamceno: !!u.zamceno,
        deti: u.deti.map(d => normalizovane.has(d) && !d.skryto && !d.zamceno ? d : M.normalizujUzel(Object.assign({}, d, { skryto: false, zamceno: false }))),
        zaklad,
        operace: u.operace === 'prunik' ? 'prunik' : 'sjednoceni',
        barevne: !!u.barevne,
        occt: normalizujOcct(u.occt),
      };
    }
    return {
      id: M.idOk(u.id) ? u.id : M.noveId(),
      druh: u.druh,
      nazev: cistyNazev(u.nazev, t.nazev),
      rozmer: trojice(u.rozmer, t.rozmer, MIN_ROZMER, MAX_ROZMER),
      param: M.normalizujParam(u.druh, u.param || {}),
      poloha: trojice(u.poloha, [0, 0, t.rozmer[2] / 2], -MAX_POLOHA, MAX_POLOHA),
      rotace: trojice(u.rotace, [0, 0, 0], -36000, 36000),
      zrcadlo: [0, 1, 2].map(i => !!(Array.isArray(u.zrcadlo) && u.zrcadlo[i])),
      role: u.role === 'dira' ? 'dira' : 'teleso',
      barva: barvaOk(u.barva) ? u.barva.toLowerCase() : t.barva,
      skryto: !!u.skryto,
      zamceno: !!u.zamceno,
    };
  };

  /** Přesná úprava skupiny (OpenCascade): zaoblení / sražení hran, skořepina, odsazení stěn; jinak null. */
  function normalizujOcct(o) {
    if (!o || !['zaobleni', 'srazeni', 'skorepina', 'odsazeni'].includes(o.operace)) return null;
    // odsazení stěn (vůle): kladné zvětší, záporné zmenší – jen hodnota
    if (o.operace === 'odsazeni') {
      const h = Math.round(M.omez(cislo(o.hodnota, 0.2), -100, 100) * 1e6) / 1e6;
      return { operace: 'odsazeni', hodnota: Math.abs(h) < 0.001 ? 0.001 * (h < 0 ? -1 : 1) : h, hrany: [], plochy: [] };
    }
    const bod = b => Array.isArray(b) && b.length === 3 && b.every(x => typeof x === 'number' && isFinite(x)) ? b.map(x => Math.round(x * 1e6) / 1e6) : null;
    return {
      operace: o.operace,
      hodnota: M.omez(cislo(o.hodnota, 1), 0.01, 1000),
      // bod uprostřed hrany a konce rovné hrany: přesné dohledání i po zvětšení skupiny (starší projekty je nemají)
      hrany: (Array.isArray(o.hrany) ? o.hrany : []).map(h => {
        const x = { stred: bod(h && h.stred), delka: Math.round(cislo(h && h.delka, 0) * 1e6) / 1e6 };
        const b2 = bod(h && h.bod); if (b2) x.bod = b2;
        const kk = h && Array.isArray(h.konce) && h.konce.length === 2 ? h.konce.map(bod) : null; if (kk && kk[0] && kk[1]) x.konce = kk;
        return x;
      }).filter(h => h.stred && h.delka > 0),
      plochy: (Array.isArray(o.plochy) ? o.plochy : []).map(h => ({ stred: bod(h && h.stred), normala: bod(h && h.normala) })).filter(h => h.stred && h.normala),
    };
  }

  /** Kopie uzlu s novým id – i u všech dětí skupiny (id musí být v dokumentu jedinečná). */
  M.noveIdHluboko = u => Object.assign({}, u, { id: M.noveId() }, u.deti ? { deti: u.deti.map(M.noveIdHluboko) } : {});

  /** Další volný název typu „Kvádr 3“. */
  M.dalsiNazev = function (dok, druh) {
    const zaklad = M.popisDruhu(druh).nazev;
    let max = 0;
    const re = new RegExp('^' + zaklad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' (\\d+)$');   // závorky v názvu („Pant (tisk v celku)“)
    for (const u of dok.uzly) { const m = re.exec(u.nazev); if (m) max = Math.max(max, +m[1]); }
    return zaklad + ' ' + (max + 1);
  };

  /** Nový uzel daného druhu; prepis doplní/přepíše vlastnosti. */
  M.novyUzel = function (druh, prepis = {}, dok) {
    if (jeDil(druh)) {
      const d = M.DILY[druh];
      const u = M.normalizujUzel(Object.assign({ druh, param: d.param, barva: d.barva, role: d.role }, prepis,
        { nazev: prepis.nazev || (dok ? M.dalsiNazev(dok, druh) : d.nazev) }));
      return prepis.poloha ? u : Object.assign(u, { poloha: [0, 0, u.rozmer[2] / 2] });
    }
    const t = M.TVARY[druh];
    const u = Object.assign({ druh, rozmer: t.rozmer.slice(), param: Object.assign({}, t.param), barva: t.barva }, prepis);
    if (!prepis.nazev && dok) u.nazev = M.dalsiNazev(dok, druh);
    if (!prepis.poloha) u.poloha = [0, 0, u.rozmer[2] / 2];
    return M.normalizujUzel(u);
  };

  // index id → uzel pro každé (neměnné) pole uzlů; s tisíci těles by hledání procházením bylo kvadratické
  const indexy = new WeakMap();
  M.najdiUzel = (dok, id) => {
    let ix = indexy.get(dok.uzly);
    // (pole se rozestavěné ještě může doplňovat – nesedí-li počet, index postavit znovu)
    if (!ix || ix.velikost !== dok.uzly.length) { ix = new Map(dok.uzly.map(u => [u.id, u])); ix.velikost = dok.uzly.length; indexy.set(dok.uzly, ix); }
    return ix.get(id) || null;
  };

  M.pridejUzly = function (dok, uzly) {
    return Object.assign({}, dok, { uzly: dok.uzly.concat(uzly) });
  };

  M.odeberUzly = function (dok, ids) {
    const set = new Set(ids);
    return Object.assign({}, dok, { uzly: dok.uzly.filter(u => !set.has(u.id)) });
  };

  /** Upraví vybrané uzly: zmena je objekt vlastností, nebo funkce uzel → objekt.
      Výsledek projde normalizací; nezměněné uzly zůstanou stejné objekty. */
  M.upravUzly = function (dok, ids, zmena) {
    const set = new Set(ids);
    let zmeneno = false;
    const uzly = dok.uzly.map(u => {
      if (!set.has(u.id)) return u;
      const z = typeof zmena === 'function' ? zmena(u) : zmena;
      if (!z) return u;
      const novy = M.normalizujUzel(Object.assign({}, u, z, { id: u.id }));
      if (JSON.stringify(novy) === JSON.stringify(u)) return u;
      zmeneno = true;
      return novy;
    });
    return zmeneno ? Object.assign({}, dok, { uzly }) : dok;
  };

  // ------------------------------------------------------------ geometrie uzlu
  /** Rotace uzlu jako kvaternion. */
  M.quatUzlu = function (u) {
    const e = new THREE.Euler(u.rotace[0] * M.st, u.rotace[1] * M.st, u.rotace[2] * M.st, 'XYZ');
    return new THREE.Quaternion().setFromEuler(e);
  };

  /** Kvaternion → [rx, ry, rz] ve stupních (zaokrouhleno na 1e-6°, −0 → 0). */
  M.rotaceZQuat = function (q) {
    const e = new THREE.Euler().setFromQuaternion(q.clone().normalize(), 'XYZ');
    return [e.x, e.y, e.z].map(r => { const d = Math.round(r / M.st * 1e6) / 1e6; return d === 0 ? 0 : d; });
  };

  /** Měřítko přirozené geometrie uzlu (skupina: rozmer/zaklad, tvar: 1). */
  M.meritkoUzlu = u => M.maZaklad(u) ? u.rozmer.map((r, i) => r / u.zaklad[i]) : [1, 1, 1];

  /** Matice uzlu (poloha · rotace · zrcadlo · měřítko skupiny) jako THREE.Matrix4. */
  M.maticeUzlu = function (u, cil = new THREE.Matrix4()) {
    const z = u.zrcadlo || [false, false, false], k = M.meritkoUzlu(u);
    return cil.compose(new THREE.Vector3(...u.poloha), M.quatUzlu(u),
      new THREE.Vector3(k[0] * (z[0] ? -1 : 1), k[1] * (z[1] ? -1 : 1), k[2] * (z[2] ? -1 : 1)));
  };

  /** Tuhá matice uzlu (poloha · rotace, bez zrcadla) – lokální rámec úchytů. */
  M.tuhaMaticeUzlu = function (u, cil = new THREE.Matrix4()) {
    return cil.compose(new THREE.Vector3(...u.poloha), M.quatUzlu(u), new THREE.Vector3(1, 1, 1));
  };

  // vrcholy sítí podle klíče geometrie (obálky a položení počítají se skutečnou geometrií)
  const vrcholyCache = new Map();
  let vrcholuVCache = 0;
  /** Plné děti skupiny (skupina samých děr: všechny). */
  M.plneDeti = g => { const p = g.deti.filter(d => d.role !== 'dira'); return p.length ? p : g.deti; };
  /** Lokální vrcholy sítě uzlu (Float32Array x,y,z; sdílené, neměnit).
      U skupiny jsou to vrcholy plných dětí v přirozených souřadnicích skupiny
      (díry obálku nezvětšují; kde díra ořízne okraj, je obálka mírně větší). */
  M.vrcholyUzlu = function (u) {
    const k = M.klicGeometrie(u);
    let v = vrcholyCache.get(k);
    if (v) { vrcholyCache.delete(k); vrcholyCache.set(k, v); }       // naposledy použité na konec (LRU)
    if (!v) {
      if (u.druh === 'skupina') {
        const casti = M.plneDeti(u).map(d => {
          const p = M.vrcholyUzlu(d), e = M.maticeUzlu(d).elements, o = new Float32Array(p.length);
          for (let i = 0; i < p.length; i += 3)
            for (let j = 0; j < 3; j++) o[i + j] = e[j] * p[i] + e[4 + j] * p[i + 1] + e[8 + j] * p[i + 2] + e[12 + j];
          return o;
        });
        if (u.operace === 'prunik' && casti.length > 1) {
          // průnik: obálka je nejvýš průnik obálek částí (sjednocení by ji zvětšilo a položení by nesedělo)
          const mn = [-Infinity, -Infinity, -Infinity], mx = [Infinity, Infinity, Infinity];
          for (const c of casti) {
            const a = [Infinity, Infinity, Infinity], b = [-Infinity, -Infinity, -Infinity];
            for (let i = 0; i < c.length; i += 3) for (let j = 0; j < 3; j++) { a[j] = Math.min(a[j], c[i + j]); b[j] = Math.max(b[j], c[i + j]); }
            for (let j = 0; j < 3; j++) { mn[j] = Math.max(mn[j], a[j]); mx[j] = Math.min(mx[j], b[j]); }
          }
          for (let j = 0; j < 3; j++) if (mx[j] < mn[j]) mx[j] = mn[j] = (mx[j] + mn[j]) / 2;    // prázdný průnik
          v = new Float32Array(24);
          for (let i = 0; i < 8; i++) for (let j = 0; j < 3; j++) v[i * 3 + j] = (i >> j) & 1 ? mx[j] : mn[j];
        } else {
          v = new Float32Array(casti.reduce((s, c) => s + c.length, 0));
          let o = 0;
          for (const c of casti) { v.set(c, o); o += c.length; }
        }
        if (u.occt && u.occt.operace === 'odsazeni') {
          // odsazení zvětší / zmenší těleso o hodnotu na každou stranu: obálka podle toho (rohy obálky)
          // (hodnota je ve skutečných mm, vrcholy v přirozených souřadnicích – vydělit měřítkem skupiny)
          const sk = M.meritkoUzlu(u), h = sk.map(x => u.occt.hodnota / x), mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
          for (let i = 0; i < v.length; i += 3) for (let j = 0; j < 3; j++) { mn[j] = Math.min(mn[j], v[i + j]); mx[j] = Math.max(mx[j], v[i + j]); }
          const a = mn.map((x, j) => Math.min(x - h[j], (x + mx[j]) / 2)), b = mx.map((x, j) => Math.max(x + h[j], (x + mn[j]) / 2));
          v = new Float32Array(24);
          for (let i = 0; i < 8; i++) for (let j = 0; j < 3; j++) v[i * 3 + j] = (i >> j) & 1 ? b[j] : a[j];
        }
      } else if (M.maPrirozene(u)) {
        // body obálky bez manifoldu (skica: vrstvy tělesa, díl: analytická obálka), posunuté o střed
        v = (u.druh === 'skica' ? M.bodyObalkySkici(u.param).body : M.bodyObalkyDilu(u.druh, u.param)).slice();
        for (let i = 0; i < v.length; i += 3) for (let k = 0; k < 3; k++) v[i + k] -= u.stred[k];
      } else v = M.sitUzlu(u).poz;
      // limit počtem i velikostí: skupiny s velkým importem kopírují všechny jeho vrcholy (~6 MB na variantu)
      // nejdéle nepoužité ven (celé vymazání by u dokumentu s víc než 400 tvary počítalo pořád znovu)
      while (vrcholyCache.size && (vrcholyCache.size > 400 || vrcholuVCache + v.length > 3e7)) {
        const [k0, v0] = vrcholyCache.entries().next().value;
        vrcholyCache.delete(k0); vrcholuVCache -= v0.length;
      }
      vrcholyCache.set(k, v);
      vrcholuVCache += v.length;
    }
    return v;
  };

  /** Světová obálka skutečné geometrie uzlu {min, max} (pole). */
  // uzly jsou neměnné: obálka se počítá jednou na objekt (úchyty ji chtějí každý snímek)
  const obalkyCache = new WeakMap();
  M.obalkaUzlu = function (u) {
    let c = obalkyCache.get(u);
    if (!c) { c = obalkaZVrcholu(u); obalkyCache.set(u, c); }
    return { min: c.min.slice(), max: c.max.slice() };
  };
  function obalkaZVrcholu(u) {
    const e = M.maticeUzlu(u).elements, p = M.vrcholyUzlu(u);
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i], y = p[i + 1], z = p[i + 2];
      for (let k = 0; k < 3; k++) {
        const w = e[k] * x + e[4 + k] * y + e[8 + k] * z + e[12 + k];
        if (w < min[k]) min[k] = w;
        if (w > max[k]) max[k] = w;
      }
    }
    return { min, max };
  }

  /** Výška spodku uzlu nad deskou. */
  M.spodekUzlu = u => M.obalkaUzlu(u).min[2];

  /** Změna, která posune uzel tak, aby jeho spodek byl ve výšce z. */
  M.polohaSeSpodkem = function (u, z) {
    const d = z - M.spodekUzlu(u);
    return [u.poloha[0], u.poloha[1], u.poloha[2] + d];
  };

  /** 53bitový hash textu (cyrb53) – krátký klíč pro velké podstromy. */
  M.hash = function (text) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  };

  /** Popis geometrie podstromu (bez id, názvů a zámků): na něm závisí výsledek booleanu. */
  function popisGeometrie(u, sBarvou) {
    const z = [u.druh, u.rozmer, u.param, u.poloha, u.rotace, u.zrcadlo, u.role];
    if (u.druh === 'sit') z.push(u.zdroj, u.zaklad, !!u.jednobarevne);      // barvy ze souboru vypnuté = jiná barevná skupina
    if (M.maPrirozene(u)) z.push(u.zaklad, u.stred);
    if (sBarvou) z.push(u.barva);
    if (u.druh === 'skupina') z.push(u.zaklad, u.operace, u.barevne, u.occt, u.deti.map(d => popisGeometrie(d, sBarvou && u.barevne)));
    return z;
  }
  /** Klíč booleanu skupiny (přirozená geometrie, nezávisí na rozmer). */
  M.klicBooleanu = u => 'B' + M.hash(JSON.stringify([u.operace, u.barevne, u.occt || null, u.deti.map(d => popisGeometrie(d, u.barevne))]));
  /** Klíč odvozeného zdroje: síť spočítaná přesným jádrem pro skupinu s úpravou. */
  M.klicOcct = u => {
    // úprava se počítá ve skutečné velikosti, takže síť závisí i na zvětšení skupiny
    const s = u.zaklad ? u.rozmer.map((x, i) => Math.round(x / u.zaklad[i] * 1e9) / 1e9) : [1, 1, 1];
    return 'O' + M.klicBooleanu(u).slice(1) + (s.every(x => x === 1) ? '' : '|' + s.join(','));
  };

  /** Klíč geometrie: uzly se stejným klíčem mají stejnou (přirozenou) síť. */
  // uzly jsou neměnné: klíč (u skupiny JSON + hash celého podstromu) se počítá jednou na objekt
  const klicCache = new WeakMap();
  M.klicGeometrie = u => { let k = klicCache.get(u); if (k === undefined) { k = klicGeometrieVypocet(u); klicCache.set(u, k); } return k; };
  const klicGeometrieVypocet = u => u.druh === 'skupina' ? 'skupina|' + (u.occt ? M.klicOcct(u) : M.klicBooleanu(u))
    : u.druh === 'sit' ? 'sit|' + u.zdroj + (u.jednobarevne ? '|1' : '')
    : M.maPrirozene(u) ? u.druh + '|' + M.hash(JSON.stringify([u.param, u.stred]))
    : u.druh + '|' + u.rozmer.join(',') + '|' + JSON.stringify(u.param);

  /** Klíč výpočtu ve workeru (skupina: boolean, skica: její geometrie). */
  M.klicVypoctu = u => u.druh === 'skupina' ? (u.occt ? M.klicOcct(u) : M.klicBooleanu(u)) : M.klicGeometrie(u);

  /** Nová skica z parametrů; spodek na desce v bodě [x, y] (nebo zadaná poloha). */
  M.novaSkica = function (param, prepis = {}, dok) {
    const p = M.normalizujParamSkici(param);
    const r = M.rozmeryTelesaSkici(p);
    return M.normalizujUzel(Object.assign({ druh: 'skica', param: p, stred: r.stred, zaklad: r.zaklad, rozmer: r.zaklad,
      nazev: dok ? M.dalsiNazev(dok, 'skica') : undefined, poloha: [0, 0, r.zaklad[2] / 2] }, prepis));
  };

  /** Změna parametrů skici nebo dílu: zachová měřítko a polohu počátku přirozených
      souřadnic ve světě. Vrací změnu {param, stred, zaklad, rozmer, poloha}. */
  M.upravPrirozeny = M.upravSkicu = function (u, novyParam) {
    const p = M.normalizujParamPrirozene(u.druh, Object.assign({}, u.param, novyParam));
    const r = M.rozmeryPrirozene(u.druh, p);
    const k = M.meritkoUzlu(u);
    const rozmer = r.zaklad.map((z, i) => Math.round(z * k[i] * 1e6) / 1e6);
    // počátek skici ve světě = poloha − M·stred; po změně stejný
    const d = new THREE.Vector3(...r.stred.map((x, i) => (x - u.stred[i]) * k[i] * (u.zrcadlo[i] ? -1 : 1))).applyQuaternion(M.quatUzlu(u));
    return { param: p, stred: r.stred, zaklad: r.zaklad, rozmer, poloha: u.poloha.map((x, i) => Math.round((x + d.getComponent(i)) * 1e6) / 1e6) };
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);
