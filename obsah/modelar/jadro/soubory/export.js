/* Modelář 3D – export a import geometrie (bez DOM, jde v node).
   Export: viditelná tělesa (ne díry) → světové sítě → STL / 3MF / OBJ (+ MTL v ZIPu).
   Volba „podle barev“: každá barva jeden objekt (3MF, OBJ) nebo jedno STL v ZIPu;
   barevné skupiny se rozdělí na uzavřená tělesa podle barev (castiPodleBarev).
   Skupiny dodá asynchronní funkce sitSkupiny(uzel) (v prohlížeči worker,
   v testech přímo manifold), která vrací {poz, idx, barvyTroj, paleta}
   v přirozených souřadnicích skupiny. Volba „sloučit“ spojí překrývající
   se tělesa booleovským sjednocením (jedna dočasná skupina).
   Import: soubor → objekty {nazev, sit (svět), barva} → uzly 'sit'. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';

  /** Tělesa k exportu: viditelná a plná (díry samy o sobě nic nevyrábějí). */
  M.telesaKExportu = (dok, ids = null) => dok.uzly.filter(u => !u.skryto && u.role !== 'dira' && (!ids || ids.includes(u.id)));

  /** Světová síť uzlu: Promise<{nazev, sit, barva, barvyTroj?, paleta?}>. */
  M.svetovaSit = async function (u, sitSkupiny) {
    const m = M.maticeUzlu(u);
    if (!M.pocitaWorker(u)) {
      const out = { nazev: u.nazev, sit: M.prevedSit(M.sitUzlu(u), m), barva: u.barva };
      const b = M.barvySite(u);                      // importovaný model s barvami ze souboru
      if (b) Object.assign(out, b);
      return out;
    }
    const r = await sitSkupiny(u);
    const out = { nazev: u.nazev, sit: M.prevedSit({ poz: r.poz, idx: r.idx }, m), barva: u.barva };
    if (u.druh === 'skupina' && u.barevne) { out.barvyTroj = r.barvyTroj; out.paleta = r.paleta; }
    return out;
  };

  const bezDiakritiky = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  /** Jméno souboru v ZIPu (bez znaků, které systémy nemají rády). */
  const jmeno = s => (bezDiakritiky(s).replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim() || 'model');

  /** Rozdělí objekty podle barev: [{nazev, sit, barva}] po jedné barvě (sítě se spojí).
      Barevné skupiny dodá castiPodleBarev(uzel) jako uzavřená tělesa každé barvy. */
  async function podleBarev(uzly, sitSkupiny, castiPodleBarev) {
    const kusy = new Map();                         // barva → [síť ve světě]
    const pridej = (b, sit) => { if (!kusy.has(b)) kusy.set(b, []); kusy.get(b).push(sit); };
    for (const u of uzly) {
      if (u.druh === 'skupina' && u.barevne && castiPodleBarev) {
        const m = M.maticeUzlu(u);
        for (const c of await castiPodleBarev(u)) if (c.idx.length) pridej(c.barva, M.prevedSit({ poz: c.poz, idx: c.idx }, m));
      } else {
        const o = await M.svetovaSit(u, sitSkupiny);
        if (o.sit.idx.length) pridej(u.barva, o.sit);      // model s barvami ze souboru jde celý svou barvou
      }
    }
    const nazvy = new Map();
    for (const b of kusy.keys()) { const n = M.nazevBarvy(b); nazvy.set(n, (nazvy.get(n) || 0) + 1); }
    return [...kusy].map(([b, site]) => {
      const n = M.nazevBarvy(b);
      return { nazev: nazvy.get(n) > 1 ? `${n} ${b}` : n, sit: site.length === 1 ? site[0] : M.spojSite(site), barva: b };
    });
  }

  /** Export: uzly → {data: Uint8Array, pripona, mime, objektu, trojuhelniku}.
      volby: format 'stl' | '3mf' | 'obj', sloucit (spojit překrývající se), podleBarev
      (objekt / STL pro každou barvu), castiPodleBarev (async uzel → části skupiny po barvách), nazev.
      OBJ jde v ZIPu spolu s .mtl (barvy), STL po barvách jako ZIP souborů STL. */
  M.exportuj = async function (uzly, sitSkupiny, volby = {}) {
    if (!uzly.length) throw new Error('není co exportovat (žádné viditelné těleso)');
    let objekty, zdroj = uzly;
    if (volby.sloucit && uzly.length > 1) {
      // sloučit jen tělesa, která se překrývají (obálky; i přes řetěz: A×B a B×C = jedna skupina) – samostatné
      // díly zůstanou samostatnými objekty, ať je slicer může rozmístit a obarvit zvlášť
      const ob = uzly.map(u => M.obalkaUzlu(u)), tol = 1e-6;
      const rodic = uzly.map((u, i) => i), koren = i => rodic[i] === i ? i : (rodic[i] = koren(rodic[i]));
      for (let i = 0; i < uzly.length; i++) for (let j = i + 1; j < uzly.length; j++) {
        const a = ob[i], b = ob[j];
        // překryv i dotyk (štítek položený na desce, kostka na kostce) – slicer by jinak díly rozházel
        if ([0, 1, 2].every(k => a.min[k] <= b.max[k] + 1e-3 && a.max[k] >= b.min[k] - 1e-3)) rodic[koren(i)] = koren(j);
      }
      const shluky = new Map();
      uzly.forEach((u, i) => { const k = koren(i); if (!shluky.has(k)) shluky.set(k, []); shluky.get(k).push(u); });
      zdroj = [...shluky.values()].map((cast, ci) => {
        if (cast.length === 1) return cast[0];
        const r = M.seskupUzly(M.pridejUzly(M.novyDokument(), cast.map(u => Object.assign({}, u, { zamceno: false }))),
          cast.map(u => u.id), { barevne: new Set(cast.map(u => u.barva)).size > 1 || cast.some(u => !!(M.barvySite && M.barvySite(u))),
            nazev: shluky.size === 1 ? (volby.nazev || 'Model') : `${volby.nazev || 'Model'} ${ci + 1}` });
        return M.najdiUzel(r.dok, r.id);
      });
    }
    if (volby.podleBarev) objekty = await podleBarev(zdroj, sitSkupiny, volby.castiPodleBarev);
    else {
      objekty = await Promise.all(zdroj.map(u => M.svetovaSit(u, sitSkupiny)));
      if (volby.sloucit && uzly.length > 1 && !zdroj[0].barevne) objekty[0].barva = uzly[0].barva;
    }
    objekty = objekty.filter(o => o.sit.idx.length);
    // shluky dotýkajících se / překrývajících se objektů (obálky sítí) – 3MF je zapíše jako jeden objekt z dílů
    {
      const ob = objekty.map(o => M.obalkaSite(o.sit));
      const rodic = objekty.map((o, i) => i), koren = i => rodic[i] === i ? i : (rodic[i] = koren(rodic[i]));
      for (let i = 0; i < ob.length; i++) for (let j = i + 1; j < ob.length; j++)
        if ([0, 1, 2].every(k => ob[i].min[k] <= ob[j].max[k] + 1e-3 && ob[i].max[k] >= ob[j].min[k] - 1e-3)) rodic[koren(i)] = koren(j);
      objekty.forEach((o, i) => { o.shluk = koren(i); o.nazevShluku = volby.nazev || 'Sestava'; });
    }
    if (!objekty.length) throw new Error('výsledek je prázdný (díry ubraly všechno?)');
    const trojuhelniku = objekty.reduce((s, o) => s + o.sit.idx.length / 3, 0);
    const f = volby.format || 'stl', nazev = volby.nazev || 'model';
    const hlavicka = 'Modelář 3D: ' + nazev;
    let data, mime, pripona = '.' + f;
    if (f === 'stl' && volby.podleBarev && objekty.length > 1) {
      data = await M.zip.zapis(objekty.map(o => ({ nazev: jmeno(`${nazev} - ${o.nazev}`) + '.stl', data: M.stl.zapis([o.sit], `${nazev} ${o.nazev}`) })));
      mime = 'application/zip'; pripona = '.zip';
    } else if (f === 'stl') { data = M.stl.zapis(objekty.map(o => o.sit), nazev); mime = 'model/stl'; }
    else if (f === 'obj') {
      // bez mezer: mtllib je seznam oddělený mezerami (mnohé čtečky by „Projekt 1.mtl“ rozdělily)
      const j = jmeno(nazev).replace(/\s+/g, '_');
      data = await M.zip.zapis([{ nazev: j + '.obj', data: M.obj.zapis(objekty, hlavicka, j + '.mtl') }, { nazev: j + '.mtl', data: M.obj.mtl(objekty, hlavicka) }]);
      mime = 'application/zip'; pripona = '.zip';
    } else if (f === '3mf') { data = await M.trojmf.zapis(objekty); mime = 'model/3mf'; }
    else throw new Error('neznámý formát ' + f);
    return { data, pripona, mime, objektu: objekty.length, trojuhelniku, barev: new Set(objekty.flatMap(o => o.paleta || [o.barva])).size };
  };

  /** Import: název souboru + bajty → Promise<[{nazev, sit (svět), barva, barvyTroj?, paleta?}]>.
      dalsi = Map(jméno souboru → bajty) ostatních vybraných souborů (k OBJ hledá .mtl).
      ZIP se rozbalí a naimportuje se všechno, co v něm je (OBJ i s MTL, STL, 3MF). */
  M.nactiGeometrii = async function (jmeno, buf, dalsi = new Map()) {
    const pr = (jmeno.split('.').pop() || '').toLowerCase();
    const zaklad = jmeno.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
    if (pr === 'stl') return [{ nazev: zaklad, sit: M.stl.cti(buf), barva: null }];
    if (pr === 'obj') {
      const text = new TextDecoder().decode(buf);
      // materiály: knihovny z mtllib mezi přiloženými soubory, jinak jakékoli přiložené .mtl
      const materialy = new Map();
      const knihovny = [...text.matchAll(/^\s*mtllib\s+(.+)$/gm)].map(m => m[1].trim().replace(/^.*[\\/]/, '').toLowerCase());
      for (const [n, data] of dalsi) {
        const kratke = n.replace(/^.*[\\/]/, '').toLowerCase();
        if (/\.mtl$/i.test(n) && (!knihovny.length || knihovny.includes(kratke)))
          for (const [k, v] of M.obj.ctiMtl(new TextDecoder().decode(data))) materialy.set(k, v);
      }
      const o = M.obj.cti(text, materialy.size ? materialy : null);
      if (o.length === 1) o[0].nazev = zaklad;
      return o.map(x => ({ nazev: x.nazev, sit: x.sit, barva: x.barva, barvyTroj: x.barvyTroj, paleta: x.paleta }));
    }
    if (pr === '3mf') return (await M.trojmf.cti(buf)).map((x, i, a) => ({ nazev: x.nazev || (a.length > 1 ? `${zaklad} ${i + 1}` : zaklad),
      sit: x.sit, barva: x.barva, barvyTroj: x.barvyTroj, paleta: x.paleta }));
    if (pr === 'zip') {
      const soubory = await M.zip.cti(buf);
      const out = [];
      for (const [n, data] of soubory) if (/\.(stl|obj|3mf)$/i.test(n) && !/(^|\/)__MACOSX\//.test(n)) out.push(...await M.nactiGeometrii(n, data, soubory));
      if (!out.length) throw new Error('v ZIPu není žádný model (STL, OBJ, 3MF)');
      return out;
    }
    throw new Error('neznámý formát souboru .' + pr + ' (umím STL, OBJ (+ MTL), 3MF, ZIP, STEP a .modelar)');
  };

  /** Objekty z importu → nové uzly 'sit' (zdroje se zaregistrují). Společný
      spodek leží na desce a střed na [x, y]; vzájemná poloha objektů zůstane. */
  M.uzlyZImportu = function (objekty, dok, kam = [0, 0], format = '') {
    const ob = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    for (const o of objekty) { const b = M.obalkaSite(o.sit); for (let k = 0; k < 3; k++) { ob.min[k] = Math.min(ob.min[k], b.min[k]); ob.max[k] = Math.max(ob.max[k], b.max[k]); } }
    // model mimo rozsah 0,01 mm – 10 m (export v µm nebo v metrech): převést po tisících, jinak by rozměr
    // v inspektoru nesouhlasil se sítí (rozměr se omezí, síť ne) – volající o tom dá vědět (uzly.meritko)
    let f = 1;
    const vel = Math.max(...[0, 1, 2].map(k => ob.max[k] - ob.min[k]));
    if (!objekty.some(o => o.step) && isFinite(vel) && vel > 0) {
      while (vel * f > 10000) f /= 1000;
      while (vel * f < 0.1) f *= 1000;
    }
    if (f !== 1) {
      for (const o of objekty) {
        const p = new Float32Array(o.sit.poz.length);
        for (let i = 0; i < p.length; i++) p[i] = o.sit.poz[i] * f;
        o.sit = { poz: p, idx: o.sit.idx };
      }
      for (let k = 0; k < 3; k++) { ob.min[k] *= f; ob.max[k] *= f; }
    }
    const posun = [kam[0] - (ob.min[0] + ob.max[0]) / 2, kam[1] - (ob.min[1] + ob.max[1]) / 2, -ob.min[2]];
    const uzly = [];
    uzly.meritko = f;
    let d = dok;
    for (const o of objekty) {
      const b = M.obalkaSite(o.sit);
      const c = [0, 1, 2].map(k => (b.min[k] + b.max[k]) / 2);
      // síť naruby (normály dovnitř – časté u STL z jiných programů): obrátit, jinak má záporný objem a booleany se pokazí
      if (M.objemSite(o.sit) < 0) o.sit = M.otocOrientaci({ poz: o.sit.poz, idx: Uint32Array.from(o.sit.idx) });
      const poz = new Float32Array(o.sit.poz.length);
      for (let i = 0; i < poz.length; i += 3) for (let k = 0; k < 3; k++) poz[i + k] = o.sit.poz[i + k] - c[k];
      // barvy trojúhelníků ze souboru (3MF, OBJ s MTL nebo barvami vrcholů) a přesná geometrie STEP
      // (vycentrovaná stejně jako síť) patří ke zdroji a jsou součástí jeho klíče
      const zdroj = M.pridejZdroj({ poz, idx: o.sit.idx }, o.nazev, o.format || format,
        { barvyTroj: o.barvyTroj, paleta: o.paleta, ...(o.step ? { step: o.step, stredStep: c } : {}) });
      const zaklad = [0, 1, 2].map(k => Math.max(0.01, Math.round((b.max[k] - b.min[k]) * 1e6) / 1e6));
      const u = M.normalizujUzel({
        druh: 'sit', zdroj, zaklad, rozmer: zaklad, nazev: o.nazev || M.dalsiNazev(d, 'sit'),
        poloha: c.map((x, k) => Math.round((x + posun[k]) * 1e6) / 1e6), barva: o.barva || M.MODEL.barva,
      });
      uzly.push(u);
      d = M.pridejUzly(d, [u]);
    }
    return uzly;
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);
