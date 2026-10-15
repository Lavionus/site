/* Modelář 3D – Wavefront OBJ s materiály MTL (bez DOM, jde v node).
   Zápis: objekty `o` s vrcholy a trojúhelníky (indexy od 1, jednotky mm);
   s názvem knihovny materiálů navíc `mtllib` a `usemtl barva_rrggbb` (barva
   tělesa, u barevné skupiny po trojúhelnících) a M.obj.mtl() vyrobí .mtl (Kd).
   Čtení: v a f (i v/vt/vn a záporné indexy), mnohoúhelníky se rozloží na
   vějíř; každý objekt `o` (nebo skupina `g`) je samostatná síť. Barvy: `usemtl`
   + Kd z přiložených .mtl, nebo barvy vrcholů `v x y z r g b` (rozšíření
   MeshLabu a dalších) → barva po trojúhelnících a převládající barva objektu. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const cislo = x => { const s = (Math.round(x * 1e6) / 1e6).toString(); return s === '-0' ? '0' : s; };
  const nazevMat = b => 'barva_' + String(b || '#8e9aa8').replace('#', '').toLowerCase();
  const hex2 = x => Math.max(0, Math.min(255, Math.round(x * 255))).toString(16).padStart(2, '0');
  const zRgb = (r, g, b) => '#' + hex2(r) + hex2(g) + hex2(b);

  /** Převládající barva (nejvíc trojúhelníků). */
  function prevladajici(barvyTroj, paleta) {
    const n = new Array(paleta.length).fill(0);
    for (const b of barvyTroj) n[b]++;
    return paleta[n.indexOf(Math.max(...n))];
  }

  M.obj = {
    /** objekty: [{nazev, sit, barva?, barvyTroj?, paleta?}] → text OBJ. mtl = jméno souboru .mtl (nebo bez barev). */
    zapis(objekty, hlavicka = 'Modelář 3D', mtl = null) {
      const r = ['# ' + hlavicka, '# jednotky: mm'];
      if (mtl) r.push('mtllib ' + mtl);
      let zaklad = 1;
      for (const o of objekty) {
        r.push('o ' + (String(o.nazev || '').replace(/\s+/g, ' ').trim() || 'objekt'));   // název může mít mezery (čte se zbytek řádku)
        const p = o.sit.poz, t = o.sit.idx;
        for (let i = 0; i < p.length; i += 3) r.push(`v ${cislo(p[i])} ${cislo(p[i + 1])} ${cislo(p[i + 2])}`);
        let akt = null;
        for (let i = 0; i < t.length; i += 3) {
          if (mtl) {
            const b = o.barvyTroj && o.paleta ? o.paleta[o.barvyTroj[i / 3]] : o.barva;
            if (b !== akt) { r.push('usemtl ' + nazevMat(b)); akt = b; }
          }
          r.push(`f ${t[i] + zaklad} ${t[i + 1] + zaklad} ${t[i + 2] + zaklad}`);
        }
        zaklad += p.length / 3;
      }
      return r.join('\n') + '\n';
    },

    /** Knihovna materiálů ke všem barvám objektů (difúzní barva Kd). */
    mtl(objekty, hlavicka = 'Modelář 3D') {
      const barvy = new Set();
      for (const o of objekty) { barvy.add(o.barva || '#8e9aa8'); (o.paleta || []).forEach(b => barvy.add(b)); }
      const r = ['# ' + hlavicka];
      for (const b of barvy) {
        const c = parseInt(b.replace('#', ''), 16);
        const k = [c >> 16 & 255, c >> 8 & 255, c & 255].map(x => cislo(x / 255)).join(' ');
        r.push('', 'newmtl ' + nazevMat(b), 'Ka 0 0 0', 'Kd ' + k, 'Ks 0 0 0', 'd 1', 'illum 1');
      }
      return r.join('\n') + '\n';
    },

    /** Text MTL → Map(název materiálu → '#rrggbb'). */
    ctiMtl(text) {
      const m = new Map();
      let akt = null;
      for (const radek of String(text).split(/\r?\n/)) {
        const c = radek.trim().split(/\s+/);
        if (c[0] === 'newmtl') akt = c.slice(1).join(' ');
        else if (c[0] === 'Kd' && akt !== null) {
          const [r, g, b] = c.slice(1, 4).map(Number);
          if ([r, g, b].every(isFinite)) m.set(akt, zRgb(r, g, b));
        }
      }
      return m;
    },

    /** text OBJ → [{nazev, sit, barva, barvyTroj?, paleta?, mtllib}] (prázdné objekty se vynechají).
        materialy = Map(název → barva) z přiložených .mtl (M.obj.ctiMtl). */
    cti(text, materialy = null) {
      const v = [], vb = [], objekty = [];
      let maBarvyVrcholu = false, mtl = null, knihovny = [];
      let akt = { nazev: 'objekt', troj: [], barvy: [] };
      const novy = n => { if (akt.troj.length) objekty.push(akt); akt = { nazev: n || 'objekt', troj: [], barvy: [] }; };
      // objekty dělí „o“; „g“ jen v souboru bez „o“ (mnoho programů píše g pro každý materiál – rozsekalo by těleso)
      const deliG = !/^\s*o\s/m.test(text);
      for (const radek of text.split(/\r?\n/)) {
        const s = radek.trim();
        if (!s || s[0] === '#') continue;
        const c = s.split(/\s+/);
        if (c[0] === 'v') {
          const x = +c[1], y = +c[2], z = +c[3];
          if (![x, y, z].every(isFinite)) throw new Error('OBJ obsahuje neplatný vrchol');
          v.push(x, y, z);
          if (c.length >= 7 && [c[4], c[5], c[6]].every(t => isFinite(+t))) {
            let [r, g, b] = [+c[4], +c[5], +c[6]];
            if (r > 1 || g > 1 || b > 1) { r /= 255; g /= 255; b /= 255; }     // některé programy píšou 0–255
            vb.push(r, g, b); maBarvyVrcholu = true;
          } else vb.push(-1, -1, -1);
        } else if (c[0] === 'o' || (c[0] === 'g' && deliG)) novy(c.slice(1).join(' '));
        else if (c[0] === 'usemtl') mtl = c.slice(1).join(' ');
        else if (c[0] === 'mtllib') knihovny.push(...c.slice(1));
        else if (c[0] === 'f') {
          const ids = c.slice(1).map(x => {
            const i = parseInt(x.split('/')[0], 10);
            const j = i < 0 ? v.length / 3 + i : i - 1;
            if (!(j >= 0 && j < v.length / 3)) throw new Error('OBJ odkazuje na neexistující vrchol');
            return j;
          });
          for (let k = 1; k + 1 < ids.length; k++) {
            akt.troj.push(ids[0], ids[k], ids[k + 1]);
            // barva stěny: materiál, jinak průměr barev vrcholů
            let b = materialy && mtl !== null ? materialy.get(mtl) || null : null;
            if (!b && maBarvyVrcholu) {
              const t3 = [ids[0], ids[k], ids[k + 1]];
              // zaokrouhlit na 16 úrovní, ať plynulé přechody nedají tisíce barev
              if (t3.every(j => vb[j * 3] >= 0)) b = zRgb(...[0, 1, 2].map(q => Math.round(t3.reduce((a, j) => a + vb[j * 3 + q], 0) / 3 * 15) / 15));
            }
            akt.barvy.push(b);
          }
        }
      }
      novy();
      if (!objekty.length) throw new Error('OBJ neobsahuje žádné stěny');
      const poz = new Float32Array(v);
      return objekty.map(o => {
        // nejdřív jen vrcholy, které objekt používá (svařovat celé pole pro každý objekt by bylo kvadratické)
        const mapa = new Map(), lp = [], lt = new Uint32Array(o.troj.length);
        o.troj.forEach((j, i) => {
          let k = mapa.get(j);
          if (k === undefined) { k = lp.length / 3; mapa.set(j, k); lp.push(poz[j * 3], poz[j * 3 + 1], poz[j * 3 + 2]); }
          lt[i] = k;
        });
        const zachovane = [];
        const sv = M.svarSit(new Float32Array(lp), lt, 1e-5, zachovane);
        // vyhodit vrcholy, které po svaření nic nepoužívá
        const pouzite = new Map(), p = [], idx = new Uint32Array(sv.idx.length);
        sv.idx.forEach((j, i) => {
          if (!pouzite.has(j)) { pouzite.set(j, p.length / 3); p.push(sv.poz[j * 3], sv.poz[j * 3 + 1], sv.poz[j * 3 + 2]); }
          idx[i] = pouzite.get(j);
        });
        const out = { nazev: o.nazev, sit: { poz: new Float32Array(p), idx }, barva: null, mtllib: knihovny };
        const barvy = zachovane.map(t => o.barvy[t]);
        if (barvy.some(Boolean)) {
          const paleta = [...new Set(barvy.map(b => b || '#8e9aa8'))];
          const kde = new Map(paleta.map((b, i) => [b, i]));
          const barvyTroj = paleta.length < 65536 ? Uint16Array.from(barvy, b => kde.get(b || '#8e9aa8')) : new Uint16Array(barvy.length);
          out.barva = prevladajici(barvyTroj, paleta);
          if (paleta.length > 1 && paleta.length < 65536) Object.assign(out, { barvyTroj, paleta });
        }
        return out;
      });
    },
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);
