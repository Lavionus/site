/* Modelář 3D – příprava tisku (bez DOM, jde v node): údaje o materiálu (objem,
   hmotnost, délka filamentu), převisy sítě, kontrola dokumentu před tiskem
   (mimo desku, vznáší se, pod deskou, větší než deska, samostatná díra)
   a rozmístění těles vedle sebe na desce. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';

  /** Materiály: hustota g/cm³ (běžné hodnoty výrobců filamentů). */
  M.MATERIALY = {
    PLA: { nazev: 'PLA', hustota: 1.24 },
    PETG: { nazev: 'PETG', hustota: 1.27 },
    ABS: { nazev: 'ABS', hustota: 1.04 },
    ASA: { nazev: 'ASA', hustota: 1.07 },
    TPU: { nazev: 'TPU (pružný)', hustota: 1.21 },
    PA: { nazev: 'PA (nylon)', hustota: 1.14 },
    PC: { nazev: 'PC', hustota: 1.20 },
    PRYSKYRICE: { nazev: 'Pryskyřice (SLA)', hustota: 1.12 },
  };

  /** Údaje pro tisk z objemu (mm³): objem v cm³, hmotnost plného tělesa, odhad při výplni
      (stěny a vrchní/spodní vrstvy plné, vnitřek podle výplně – hrubý, ale v praxi použitelný odhad)
      a délka filamentu (m) pro průměr struny. */
  M.udajeTisku = function (objemMm3, material = 'PLA', prumer = 1.75, vypln = 20) {
    const m = M.MATERIALY[material] || M.MATERIALY.PLA;
    const V = Math.max(0, objemMm3 || 0);
    const podil = Math.min(1, 0.3 + 0.7 * M.omez(vypln, 0, 100) / 100);
    const Vtisk = material === 'PRYSKYRICE' ? V : V * podil;
    return {
      objemCm3: V / 1000,
      hmotnostPlna: V / 1000 * m.hustota,
      hmotnost: Vtisk / 1000 * m.hustota,
      delka: material === 'PRYSKYRICE' ? 0 : Vtisk / (Math.PI * (prumer / 2) ** 2) / 1000,
    };
  };

  /** Převisy sítě ve světě: plocha (mm²) trojúhelníků, jejichž normála míří dolů víc než o úhel
      od svislice (výchozí 45°) a které neleží na desce (těžiště výš než zMin). */
  M.prevesySite = function (sit, uhel = 45, zMin = 0.2) {
    const p = sit.poz, t = sit.idx, mez = -Math.sin(uhel * Math.PI / 180);      // převis: od svislice víc než úhel
    let prevesy = 0, celkem = 0;
    for (let i = 0; i < t.length; i += 3) {
      const a = t[i] * 3, b = t[i + 1] * 3, c = t[i + 2] * 3;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
      const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz);
      if (l < 1e-12) continue;
      const plocha = l / 2;
      celkem += plocha;
      const z = (p[a + 2] + p[b + 2] + p[c + 2]) / 3;
      if (nz / l < mez && z > zMin) prevesy += plocha;
    }
    return { prevesy, celkem };
  };

  /** Kontrola před tiskem. deska = {sirka, hloubka} (střed v počátku). Vrací [{druh, ids, text, oprava?}]
      – oprava: 'polozit' (na desku), 'dovnitr' (posunout na desku). */
  M.kontrolaTisku = function (dok, deska) {
    const out = [], tol = 0.05;
    const sx = deska.sirka / 2, sy = deska.hloubka / 2;
    const viditelne = dok.uzly.filter(u => !u.skryto);
    const telesa = viditelne.filter(u => u.role !== 'dira');
    const obalky = new Map(telesa.map(u => [u.id, M.obalkaUzlu(u)]));
    const jmena = ids => ids.slice(0, 3).map(id => '„' + M.najdiUzel(dok, id).nazev + '“').join(', ') + (ids.length > 3 ? ` a ${ids.length - 3} dalších` : '');
    // samostatné díry: netisknou se, nic neodečítají
    const diry = viditelne.filter(u => u.role === 'dira').map(u => u.id);
    if (diry.length) out.push({ druh: 'dira', ids: diry, text: `${jmena(diry)} – díra mimo skupinu nic neodečte (seskup ji s tělesem, Ctrl+G).` });
    const mimo = [], pod = [], vznasi = [], velke = [];
    for (const u of telesa) {
      const o = obalky.get(u.id);
      if (o.max[0] - o.min[0] > deska.sirka + tol || o.max[1] - o.min[1] > deska.hloubka + tol) { velke.push(u.id); continue; }
      if (o.min[0] < -sx - tol || o.max[0] > sx + tol || o.min[1] < -sy - tol || o.max[1] > sy + tol) mimo.push(u.id);
      if (o.min[2] < -tol) pod.push(u.id);
      else if (o.min[2] > tol) {
        // podepřené jiným tělesem (stojí na jeho vršku a překrývá se s ním v půdorysu)?
        const nese = telesa.some(v => {
          if (v === u) return false;
          const q = obalky.get(v.id);
          return Math.abs(q.max[2] - o.min[2]) < 0.5 + tol && q.min[0] < o.max[0] && q.max[0] > o.min[0] && q.min[1] < o.max[1] && q.max[1] > o.min[1]
            || (q.min[2] < o.min[2] && q.max[2] > o.min[2] && q.min[0] < o.max[0] && q.max[0] > o.min[0] && q.min[1] < o.max[1] && q.max[1] > o.min[1]);
        });
        if (!nese) vznasi.push(u.id);
      }
    }
    if (velke.length) out.push({ druh: 'velke', ids: velke, text: `${jmena(velke)} – větší než deska ${M.mm(deska.sirka)} × ${M.mm(deska.hloubka)} mm (zmenši, rozděl rovinou, nebo zvětši desku).` });
    if (mimo.length) out.push({ druh: 'mimo', ids: mimo, text: `${jmena(mimo)} – přesahuje okraj desky.`, oprava: 'dovnitr' });
    if (pod.length) out.push({ druh: 'pod', ids: pod, text: `${jmena(pod)} – zasahuje pod desku (tiskárna to nevytiskne).`, oprava: 'polozit' });
    if (vznasi.length) out.push({ druh: 'vznasi', ids: vznasi, text: `${jmena(vznasi)} – visí ve vzduchu (nestojí na desce ani na jiném tělese).`, oprava: 'polozit' });
    return out;
  };

  /** Posune tělesa tak, aby se jejich obálky vešly na desku (nejmenší posun). */
  M.posunNaDesku = function (dok, ids, deska) {
    const sx = deska.sirka / 2, sy = deska.hloubka / 2;
    let d = dok;
    for (const id of ids) {
      const u = M.najdiUzel(d, id);
      if (!u || u.zamceno) continue;
      const o = M.obalkaUzlu(u), p = [0, 0, 0];
      for (const [i, s] of [[0, sx], [1, sy]]) {
        if (o.max[i] - o.min[i] > 2 * s) p[i] = -(o.min[i] + o.max[i]) / 2;          // větší než deska: aspoň na střed
        else if (o.min[i] < -s) p[i] = -s - o.min[i];
        else if (o.max[i] > s) p[i] = s - o.max[i];
      }
      if (p[0] || p[1]) d = M.posunUzly(d, [id], p);
    }
    return d;
  };

  /** Rozmístí tělesa vedle sebe na desce (řady od největšího půdorysu, mezera mm), všechna položí na desku.
      Vrací {dok, vejde}: vejde = false, když se na desku nevešla (zbytek je v dalších řadách za okrajem). */
  M.rozlozNaDesce = function (dok, ids, deska, mezera = 5) {
    let d = M.polozNaRovinu(dok, ids);
    const polozky = ids.map(id => M.najdiUzel(d, id)).filter(u => u && !u.zamceno && !u.skryto)
      .map(u => ({ u, o: M.obalkaUzlu(u) }))
      .map(x => Object.assign(x, { w: x.o.max[0] - x.o.min[0], h: x.o.max[1] - x.o.min[1] }))
      .sort((a, b) => b.h - a.h || b.w - a.w);
    const W = deska.sirka, H = deska.hloubka;
    let x = 0, y = 0, radek = 0, sirkaMax = 0, vejde = true;
    const mista = [];
    for (const p of polozky) {
      if (x > 0 && x + p.w > W) { y += radek + mezera; x = 0; radek = 0; }
      mista.push({ p, x, y });
      x += p.w + mezera; radek = Math.max(radek, p.h); sirkaMax = Math.max(sirkaMax, x - mezera);
    }
    const vyska = y + radek;
    if (sirkaMax > W + 1e-6 || vyska > H + 1e-6) vejde = false;
    // celé rozložení na střed desky
    const ox = -Math.min(sirkaMax, W) / 2, oy = -Math.min(vyska, H) / 2;
    for (const { p, x: px, y: py } of mista) {
      const cil = [ox + px - p.o.min[0], oy + py - p.o.min[1], 0];
      if (Math.abs(cil[0]) > 1e-9 || Math.abs(cil[1]) > 1e-9) d = M.posunUzly(d, [p.u.id], cil);
    }
    return { dok: d, vejde };
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);
