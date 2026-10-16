/* Modelář 3D – 3MF (bez DOM, jde v node).
   Zápis: jeden 3D/3dmodel.model, každé těleso je objekt s názvem a barvou
   (basematerials); barevná skupina má barvu po trojúhelnících (pid/p1).
   Čtení: jednotky, položky build s transformací, komponenty (i v dalších
   souborech .model přes p:path, jak ukládají slicery), barva objektu i barvy
   po trojúhelnících (basematerials i colorgroup z rozšíření Materials).
   XML se čte jednoduchým tokenizérem (v node není DOMParser). */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  // řídicí znaky XML 1.0 nedovoluje (slicer by soubor odmítl): pryč
  const esc = s => String(s).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cislo = x => { const s = (Math.round(x * 1e6) / 1e6).toString(); return s === '-0' ? '0' : s; };
  const JEDNOTKY = { micron: 0.001, millimeter: 1, centimeter: 10, inch: 25.4, foot: 304.8, meter: 1000 };

  const TYPY = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;
  const VAZBY = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;

  const odescapuj = s => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1))
      : { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e.toLowerCase()]);

  /** Tokenizér: zavolá fn(nazev, atributy, otevira, zavira) pro každou značku
      (předpony jmenných prostorů se u značek i atributů zahodí: p:path → path). */
  function znacky(xml, fn) {
    const re = /<\s*(\/?)([\w:.-]+)([^>]*?)(\/?)\s*>/g;
    let m;
    while ((m = re.exec(xml))) {
      if (m[2][0] === '?' || m[2][0] === '!') continue;
      const atr = {};
      const ra = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
      let a;
      while ((a = ra.exec(m[3]))) atr[a[1].replace(/^.*:/, '')] = odescapuj(a[2] !== undefined ? a[2] : a[3]);
      const nazev = m[2].replace(/^.*:/, '');          // bez předpony jmenného prostoru
      fn(nazev, atr, !m[1], !!m[1] || !!m[4]);
    }
  }

  /** Matice 3MF „m00 m01 m02 m10 … m32“ (řádky) → THREE.Matrix4. */
  function matice(t) {
    const m = new THREE.Matrix4();
    if (!t) return m;
    const c = t.trim().split(/\s+/).map(Number);
    if (c.length !== 12 || !c.every(isFinite)) return m;
    return m.set(c[0], c[3], c[6], c[9], c[1], c[4], c[7], c[10], c[2], c[5], c[8], c[11], 0, 0, 0, 1);
  }

  function hexBarva(b) {
    const m = /^#?([0-9a-f]{6})/i.exec(b || '');
    return m ? '#' + m[1].toLowerCase() : null;
  }

  M.trojmf = {
    /** objekty: [{nazev, sit, barva, barvyTroj?, paleta?}] → Promise<Uint8Array> (zip). */
    async zapis(objekty) {
      const barvy = [], kde = new Map();
      const index = b => { if (!kde.has(b)) { kde.set(b, barvy.length); barvy.push(b); } return kde.get(b); };
      objekty.forEach(o => { index(o.barva); (o.paleta || []).forEach(index); });
      const r = ['<?xml version="1.0" encoding="UTF-8"?>',
        '<model unit="millimeter" xml:lang="cs-CZ" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">',
        ' <metadata name="Application">Modelář 3D</metadata>', ' <resources>', '  <basematerials id="1">'];
      for (const b of barvy) r.push(`   <base name="${esc(b)}" displaycolor="${b.toUpperCase()}FF"/>`);
      r.push('  </basematerials>');
      // shluky dotýkajících se těles (o.shluk) jako JEDEN objekt (díly spojené do jedné sítě, barva u každého
      // trojúhelníku): slicer by jinak díly ze složeného objektu rozdělil a každý položil na podložku
      // (štítek na desce, kostka na kostce)
      const shluky = new Map();
      objekty.forEach((o, i) => { const k = o.shluk == null ? 'o' + i : 's' + o.shluk; if (!shluky.has(k)) shluky.set(k, []); shluky.get(k).push(o); });
      let id = 2;
      const polozky = [];
      // díly objektu pro PrusaSlicer a odvozené slicery: rozsahy trojúhelníků s názvem a extruderem podle barvy
      const extruder = new Map();
      const konfig = ['<?xml version="1.0" encoding="UTF-8"?>', '<config>'];
      for (const cleny of shluky.values()) {
        const prvni = cleny[0], vice = cleny.length > 1;
        const nazev = vice ? prvni.nazevShluku || prvni.nazev : prvni.nazev;
        r.push(`  <object id="${id}" type="model" name="${esc(nazev || 'objekt')}" pid="1" pindex="${index(prvni.barva)}">`, '   <mesh>', '    <vertices>');
        const v = [];
        for (const o of cleny) { const p = o.sit.poz; for (let j = 0; j < p.length; j += 3) v.push(`     <vertex x="${cislo(p[j])}" y="${cislo(p[j + 1])}" z="${cislo(p[j + 2])}"/>`); }
        r.push(v.join('\n'), '    </vertices>', '    <triangles>');
        const tr = [];
        let posun = 0;
        konfig.push(` <object id="${id}" instances_count="1">`, `  <metadata type="object" key="name" value="${esc(nazev || 'objekt')}"/>`);
        for (const o of cleny) {
          const t = o.sit.idx;
          if (!extruder.has(o.barva)) extruder.set(o.barva, extruder.size + 1);
          konfig.push(`  <volume firstid="${tr.length}" lastid="${tr.length + t.length / 3 - 1}">`,
            `   <metadata type="volume" key="name" value="${esc(o.nazev || 'díl')}"/>`,
            `   <metadata type="volume" key="extruder" value="${Math.min(extruder.get(o.barva), 16)}"/>`, '  </volume>');
          for (let j = 0; j < t.length; j += 3) {
            const b = o.barvyTroj && o.paleta ? o.paleta[o.barvyTroj[j / 3]] : o.barva;
            const barva = (vice || (o.barvyTroj && o.paleta)) ? ` pid="1" p1="${index(b)}"` : '';
            tr.push(`     <triangle v1="${t[j] + posun}" v2="${t[j + 1] + posun}" v3="${t[j + 2] + posun}"${barva}/>`);
          }
          posun += o.sit.poz.length / 3;
        }
        r.push(tr.join('\n'), '    </triangles>', '   </mesh>', '  </object>');
        konfig.push(' </object>');
        polozky.push(id++);
      }
      r.push(' </resources>', ' <build>');
      polozky.forEach(i => r.push(`  <item objectid="${i}"/>`));
      r.push(' </build>', '</model>');
      konfig.push('</config>');
      return M.zip.zapis([
        { nazev: '[Content_Types].xml', data: TYPY },
        { nazev: '_rels/.rels', data: VAZBY },
        { nazev: '3D/3dmodel.model', data: r.join('\n') },
        { nazev: 'Metadata/Slic3r_PE_model.config', data: konfig.join('\n') },
      ]);
    },

    /** Uint8Array (3MF) → Promise<[{nazev, sit (svět, mm), barva}]> pro každou položku build. */
    async cti(buf) {
      // stejný strop jako STL (300 MB ≈ 6 milionů trojúhelníků): víc prohlížeč stejně neunese
      const MAX_TROJ = 8e6, MAX_XML = 300e6;
      const soubory = await M.zip.cti(buf);
      // díly objektů (PrusaSlicer, odvozené slicery, Modelář): rozsahy trojúhelníků s názvem
      const dilyObjektu = new Map();
      for (const [jmeno, data] of soubory) {
        if (!/Slic3r_PE_model\.config$/i.test(jmeno)) continue;
        let obj = null, svazek = null;
        znacky(new TextDecoder().decode(data), (n, a, otevira, zavira) => {
          if (n === 'object' && otevira) { obj = []; dilyObjektu.set(a.id, obj); if (zavira) obj = null; }
          else if (n === 'object' && !otevira) obj = null;
          else if (n === 'volume' && obj && otevira) { svazek = { od: +a.firstid, do: +a.lastid, nazev: '' }; if (Number.isInteger(svazek.od) && Number.isInteger(svazek.do) && svazek.do >= svazek.od) obj.push(svazek); }
          else if (n === 'metadata' && svazek && a.type === 'volume' && a.key === 'name') svazek.nazev = odescapuj(a.value || '');
          else if (n === 'volume' && !otevira) svazek = null;
        });
      }
      const dec = new TextDecoder();
      const modely = new Map();                     // cesta → {objekty, jednotka, build}
      for (const [jmeno, data] of soubory) {
        if (!/\.model$/i.test(jmeno)) continue;
        const cesta = '/' + jmeno.replace(/^\/+/, '');
        // obří XML (malý ZIP, stovky MB vrcholů) zamrzne kartu dřív, než se dojde k limitu trojúhelníků
        if (data.length > MAX_XML) throw new Error('3MF je příliš velký (model má po rozbalení víc než 300 MB)');
        const m = { objekty: new Map(), materialy: new Map(), jednotka: 1, build: [] };
        let obj = null, mat = null, vBuild = false, vrcholu = 0, trojuhelniku = 0;
        // basematerials i colorgroup jsou skupiny barev se stejným id prostorem (pid)
        znacky(dec.decode(data), (n, a, otevira, zavira) => {
          if (n === 'model' && otevira) m.jednotka = JEDNOTKY[a.unit] || 1;
          else if (n === 'basematerials' || n === 'colorgroup') { if (otevira && !zavira) mat = { id: a.id, barvy: [] }; else if (!otevira && mat) { m.materialy.set(mat.id, mat.barvy); mat = null; } }
          else if (n === 'base' && mat) mat.barvy.push(hexBarva(a.displaycolor));
          else if (n === 'color' && mat) mat.barvy.push(hexBarva(a.color));
          else if (n === 'object') {
            if (otevira) { obj = { id: a.id, nazev: a.name || '', pid: a.pid, pindex: +a.pindex || 0, v: [], t: [], tb: [], komponenty: [] }; m.objekty.set(a.id, obj); }
            if (zavira) obj = null;
          } else if (n === 'vertex' && obj) {
            const x = +a.x, y = +a.y, z = +a.z;
            if (![x, y, z].every(isFinite) || a.x === undefined || a.y === undefined || a.z === undefined) throw new Error('3MF obsahuje neplatný vrchol');
            obj.v.push(x, y, z);
            if (++vrcholu > MAX_TROJ) throw new Error(`3MF má příliš mnoho vrcholů (víc než ${MAX_TROJ / 1e6} milionů)`);
          }
          else if (n === 'triangle' && obj) {
            const t3 = [+a.v1, +a.v2, +a.v3];
            if (!t3.every(i => Number.isInteger(i) && i >= 0)) throw new Error('3MF obsahuje neplatný trojúhelník');
            obj.t.push(...t3);
            if (++trojuhelniku > MAX_TROJ) throw new Error(`3MF má příliš mnoho trojúhelníků (víc než ${MAX_TROJ / 1e6} milionů)`);
            obj.tb.push(a.p1 !== undefined || a.pid !== undefined ? [a.pid !== undefined ? a.pid : obj.pid, a.p1 !== undefined ? +a.p1 : obj.pindex] : null);
          }
          else if (n === 'component' && obj && a.objectid) obj.komponenty.push({ id: a.objectid, cesta: a.path || null, matice: matice(a.transform) });
          else if (n === 'build') vBuild = otevira && !zavira;
          else if (n === 'item' && vBuild) m.build.push({ id: a.objectid, cesta: a.path || null, matice: matice(a.transform) });
        });
        modely.set(cesta, m);
      }
      const hlavni = modely.get('/3D/3dmodel.model') || modely.values().next().value;
      const hlavniModel = hlavni;
      if (!hlavni) throw new Error('3MF neobsahuje model');
      const vysledek = [];
      const barvaObjektu = (m, o) => { const b = o.pid && m.materialy.get(o.pid); return b ? b[o.pindex] || null : null; };
      // rozbalí objekt (i komponenty) do sítí ve světě
      const barvaTroj = (m, o, i) => {
        const x = o.tb[i];
        if (!x) return barvaObjektu(m, o);
        const b = m.materialy.get(x[0]);
        return (b && b[x[1]]) || barvaObjektu(m, o);
      };
      // komponenty se mohou opakovat v každé úrovni (2^20 kopií z malého souboru) – hlídá se celkový počet trojúhelníků
      let trojCelkem = 0, instanci = 0;
      const rozbal = (m, id, mat, hloubka, site, barvy) => {
        if (hloubka > 20) throw new Error('3MF: příliš hluboko vnořené komponenty');
        if (++instanci > 1e6) throw new Error('3MF má po rozbalení komponent příliš mnoho dílů');
        const o = m.objekty.get(id);
        if (!o) throw new Error('3MF odkazuje na neexistující objekt ' + id);
        if (o.v.length && o.t.length) {
          trojCelkem += o.t.length / 3;
          if (trojCelkem > MAX_TROJ) throw new Error(`3MF má po rozbalení komponent příliš mnoho trojúhelníků (víc než ${MAX_TROJ / 1e6} milionů)`);
          const p = new Float32Array(o.v), idx = new Uint32Array(o.t);
          for (const j of idx) if (j >= p.length / 3) throw new Error('3MF: trojúhelník odkazuje mimo vrcholy');
          const svazky = m === hlavniModel ? (dilyObjektu.get(o.id) || []).filter(v => v.do < idx.length / 3) : [];
          if (svazky.length > 1) {
            // objekt z dílů: každý díl zvlášť (jen jeho vrcholy)
            for (const v of svazky) {
              const mapa = new Map(), pp = [], ii = [];
              for (let f = v.od; f <= v.do; f++) for (let j = 0; j < 3; j++) {
                const vi = idx[f * 3 + j];
                if (!mapa.has(vi)) { mapa.set(vi, pp.length / 3); pp.push(p[vi * 3], p[vi * 3 + 1], p[vi * 3 + 2]); }
                ii.push(mapa.get(vi));
              }
              site.push(M.prevedSit({ poz: new Float32Array(pp), idx: new Uint32Array(ii) }, mat));
              site[site.length - 1].dil = { nazev: v.nazev || o.nazev, barva: barvaTroj(m, o, v.od) };
              for (let f = v.od; f <= v.do; f++) barvy.push(barvaTroj(m, o, f));
            }
            site.zDilu = true;
          } else {
            site.push(M.prevedSit({ poz: p, idx }, mat));
            site[site.length - 1].dil = { nazev: o.nazev, barva: barvaObjektu(m, o) };
            for (let i = 0; i < idx.length / 3; i++) barvy.push(barvaTroj(m, o, i));
          }
        }
        for (const k of o.komponenty) {
          const mm = k.cesta ? modely.get('/' + k.cesta.replace(/^\/+/, '')) : m;
          if (!mm) throw new Error('3MF: chybí soubor ' + k.cesta);
          rozbal(mm, k.id, mat.clone().multiply(k.matice), hloubka + 1, site, barvy);
        }
        return o;
      };
      const s = hlavni.jednotka;
      const jednotky = new THREE.Matrix4().makeScale(s, s, s);
      for (const it of hlavni.build) {
        const m = it.cesta ? modely.get('/' + it.cesta.replace(/^\/+/, '')) : hlavni;
        if (!m) throw new Error('3MF: chybí soubor ' + it.cesta);
        const site = [], barvy = [];
        const o = rozbal(m, it.id, jednotky.clone().multiply(it.matice), 0, site, barvy);
        if (!site.length) continue;
        // objekt složený z dílů (komponenty, každý vlastní síť): díly jako samostatná tělesa na svých místech
        // (sestava z Modeláře nebo ze sliceru); jedna síť nebo díly bez jména = jedno těleso
        const naDily = (site.zDilu || !(o.v.length && o.t.length)) && site.length > 1 && site.length <= 200;
        const skupiny = naDily ? site.map((x, i) => [i]) : [site.map((x, i) => i)];
        let odTroj = 0;
        const zacatky = site.map(x => { const z = odTroj; odTroj += x.idx.length / 3; return z; });
        for (const sk of skupiny) {
          const cast = sk.map(i => site[i]);
          const barvyCasti = sk.flatMap(i => barvy.slice(zacatky[i], zacatky[i] + site[i].idx.length / 3));
          const spojena = M.spojSite(cast);
          const zachovane = [];
          const dil = naDily ? cast[0].dil : null;
          const v = { nazev: dil && dil.nazev ? dil.nazev : o.nazev, sit: M.svarSit(spojena.poz, spojena.idx, 1e-5, zachovane), barva: dil ? dil.barva || barvaObjektu(m, o) : barvaObjektu(m, o) };
          // barvy po trojúhelnících: paleta, index, převládající barva jako barva objektu
          const bt = zachovane.map(t => barvyCasti[t]);
          const paleta = [...new Set(bt.filter(Boolean))];
          if (paleta.length) {
            const kde = new Map(paleta.map((b, i) => [b, i])), vychozi = v.barva && kde.has(v.barva) ? kde.get(v.barva) : 0;
            const barvyTroj = Uint16Array.from(bt, b => b ? kde.get(b) : vychozi);
            const n = new Array(paleta.length).fill(0);
            for (const b of barvyTroj) n[b]++;
            v.barva = paleta[n.indexOf(Math.max(...n))];
            if (paleta.length > 1 && paleta.length < 65536) Object.assign(v, { barvyTroj, paleta });   // víc barev se do Uint16 nevejde
          }
          vysledek.push(v);
        }
      }
      if (!vysledek.length) throw new Error('3MF neobsahuje žádné těleso');
      return vysledek;
    },
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);
