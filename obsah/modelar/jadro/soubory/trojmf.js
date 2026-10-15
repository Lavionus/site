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
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
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
      objekty.forEach((o, i) => {
        r.push(`  <object id="${i + 2}" type="model" name="${esc(o.nazev || 'objekt')}" pid="1" pindex="${index(o.barva)}">`, '   <mesh>', '    <vertices>');
        const p = o.sit.poz, t = o.sit.idx;
        const v = [];
        for (let j = 0; j < p.length; j += 3) v.push(`     <vertex x="${cislo(p[j])}" y="${cislo(p[j + 1])}" z="${cislo(p[j + 2])}"/>`);
        r.push(v.join('\n'), '    </vertices>', '    <triangles>');
        const tr = [];
        for (let j = 0; j < t.length; j += 3) {
          const barva = o.barvyTroj && o.paleta ? ` pid="1" p1="${index(o.paleta[o.barvyTroj[j / 3]])}"` : '';
          tr.push(`     <triangle v1="${t[j]}" v2="${t[j + 1]}" v3="${t[j + 2]}"${barva}/>`);
        }
        r.push(tr.join('\n'), '    </triangles>', '   </mesh>', '  </object>');
      });
      r.push(' </resources>', ' <build>');
      objekty.forEach((o, i) => r.push(`  <item objectid="${i + 2}"/>`));
      r.push(' </build>', '</model>');
      return M.zip.zapis([
        { nazev: '[Content_Types].xml', data: TYPY },
        { nazev: '_rels/.rels', data: VAZBY },
        { nazev: '3D/3dmodel.model', data: r.join('\n') },
      ]);
    },

    /** Uint8Array (3MF) → Promise<[{nazev, sit (svět, mm), barva}]> pro každou položku build. */
    async cti(buf) {
      const soubory = await M.zip.cti(buf);
      const dec = new TextDecoder();
      const modely = new Map();                     // cesta → {objekty, jednotka, build}
      for (const [jmeno, data] of soubory) {
        if (!/\.model$/i.test(jmeno)) continue;
        const cesta = '/' + jmeno.replace(/^\/+/, '');
        const m = { objekty: new Map(), materialy: new Map(), jednotka: 1, build: [] };
        let obj = null, mat = null, vBuild = false;
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
          }
          else if (n === 'triangle' && obj) {
            const t3 = [+a.v1, +a.v2, +a.v3];
            if (!t3.every(i => Number.isInteger(i) && i >= 0)) throw new Error('3MF obsahuje neplatný trojúhelník');
            obj.t.push(...t3);
            obj.tb.push(a.p1 !== undefined || a.pid !== undefined ? [a.pid !== undefined ? a.pid : obj.pid, a.p1 !== undefined ? +a.p1 : obj.pindex] : null);
          }
          else if (n === 'component' && obj && a.objectid) obj.komponenty.push({ id: a.objectid, cesta: a.path || null, matice: matice(a.transform) });
          else if (n === 'build') vBuild = otevira && !zavira;
          else if (n === 'item' && vBuild) m.build.push({ id: a.objectid, cesta: a.path || null, matice: matice(a.transform) });
        });
        modely.set(cesta, m);
      }
      const hlavni = modely.get('/3D/3dmodel.model') || modely.values().next().value;
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
      const MAX_TROJ = 20e6;
      let trojCelkem = 0, instanci = 0;
      const rozbal = (m, id, mat, hloubka, site, barvy) => {
        if (hloubka > 20) throw new Error('3MF: příliš hluboko vnořené komponenty');
        if (++instanci > 1e6) throw new Error('3MF má po rozbalení komponent příliš mnoho dílů');
        const o = m.objekty.get(id);
        if (!o) throw new Error('3MF odkazuje na neexistující objekt ' + id);
        if (o.v.length && o.t.length) {
          trojCelkem += o.t.length / 3;
          if (trojCelkem > MAX_TROJ) throw new Error('3MF má po rozbalení komponent příliš mnoho trojúhelníků (víc než 20 milionů)');
          const p = new Float32Array(o.v), idx = new Uint32Array(o.t);
          for (const j of idx) if (j >= p.length / 3) throw new Error('3MF: trojúhelník odkazuje mimo vrcholy');
          site.push(M.prevedSit({ poz: p, idx }, mat));
          for (let i = 0; i < idx.length / 3; i++) barvy.push(barvaTroj(m, o, i));
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
        const spojena = M.spojSite(site);
        const zachovane = [];
        const v = { nazev: o.nazev, sit: M.svarSit(spojena.poz, spojena.idx, 1e-5, zachovane), barva: barvaObjektu(m, o) };
        // barvy po trojúhelnících: paleta, index, převládající barva jako barva objektu
        const bt = zachovane.map(t => barvy[t]);
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
      if (!vysledek.length) throw new Error('3MF neobsahuje žádné těleso');
      return vysledek;
    },
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);
