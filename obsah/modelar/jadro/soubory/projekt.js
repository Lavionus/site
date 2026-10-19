/* Modelář 3D – soubor projektu .modelar (bez DOM, jde v node).
   Obsah: JSON { format: 'modelar', verze: 1, nazev, ulozeno, dok, deska,
   kamera, zdroje: { id: {nazev, format, poz: base64, idx: base64} } },
   zkomprimovaný gzipem (CompressionStream); bez komprese se uloží čistý JSON.
   Při otevření se všechno ověří dřív, než se cokoli změní: formát a verze,
   uzly (normalizace, neznámý druh = chyba), duplicitní id, chybějící
   zdroje a jejich kontrolní klíč, meze velikosti. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  // 2: přesné úpravy s body hran, rozšířené tvary a nové parametry (starší Modelář by je potichu zahodil)
  // 3: vlastní průměr závitu, propojené díly (vazba), puzzle s vlastními okraji – starší Modelář by je potichu změnil
  const VERZE = 3;
  const MAX_ROZBALENO = 512 * 1024 * 1024, MAX_UZLU = 100000, MAX_HLOUBKA = 200;

  /** Typované pole → base64 (po kusech, ať nepřeteče zásobník). */
  function naBase64(pole) {
    const b = new Uint8Array(pole.buffer, pole.byteOffset, pole.byteLength);
    let s = '';
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function zBase64(text, Typ) {
    const s = atob(text);
    if (s.length % Typ.BYTES_PER_ELEMENT) throw new Error('poškozená data geometrie');
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return new Typ(b.buffer);
  }
  async function proudem(data, proud) {
    return new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(proud)).arrayBuffer());
  }

  M.projekt = {
    PRIPONA: '.modelar',

    /** {nazev, dok, deska, kamera} → Promise<Uint8Array> (gzip JSON). */
    async zapis(p, volby = {}) {
      const zdroje = {};
      for (const id of M.zdrojeUzlu(p.dok.uzly)) {
        const z = M.sitZdroje(id);
        zdroje[id] = { nazev: z.nazev || '', format: z.format || '', poz: naBase64(z.poz), idx: naBase64(z.idx) };
        if (z.step) Object.assign(zdroje[id], { step: z.step, stredStep: z.stredStep });   // přesná geometrie importovaného STEP
        if (z.barvyTroj && z.paleta) Object.assign(zdroje[id], { barvyTroj: naBase64(z.barvyTroj), paleta: z.paleta });   // barvy ze souboru
      }
      const json = JSON.stringify({
        format: 'modelar', verze: VERZE, nazev: p.nazev || 'Bez názvu', ulozeno: new Date().toISOString(),
        aplikace: 'Modelář 3D ' + (M.verze || ''), dok: p.dok, deska: p.deska || null, kamera: p.kamera || null, zdroje,
      });
      const data = new TextEncoder().encode(json);
      if (volby.komprimovat === false || typeof CompressionStream === 'undefined') return data;
      return proudem(data, new CompressionStream('gzip'));
    },

    /** Uint8Array → Promise<{nazev, dok, deska, kamera, zdroje: Map}>; vyhodí chybu česky. */
    async cti(buf) {
      try { return await this.ctiVnitrne(buf); }
      catch (e) {
        // přetečení zásobníku a podobné z extrémních souborů: česky, ne surově
        if (e instanceof RangeError) throw new Error('soubor projektu je příliš složitý nebo poškozený (' + e.message + ')');
        throw e;
      }
    },
    async ctiVnitrne(buf) {
      let data = buf;
      if (buf[0] === 0x1f && buf[1] === 0x8b) {
        if (typeof DecompressionStream === 'undefined') throw new Error('prohlížeč neumí rozbalit soubor projektu');
        // velikost se hlídá už při rozbalování (malý soubor může nafouknout gigabajty)
        try { data = M.zip && M.zip.rozbalOmezene ? await M.zip.rozbalOmezene(buf, new DecompressionStream('gzip'), MAX_ROZBALENO) : await proudem(buf, new DecompressionStream('gzip')); }
        catch (e) { throw new Error(/velký/.test(e.message) ? 'soubor projektu je příliš velký' : 'soubor projektu je poškozený (nejde rozbalit)'); }
      }
      if (data.length > MAX_ROZBALENO) throw new Error('soubor projektu je příliš velký');
      let j;
      try { j = JSON.parse(new TextDecoder().decode(data)); } catch (e) { throw new Error('soubor není projekt Modeláře (neplatný JSON)'); }
      if (!j || j.format !== 'modelar') throw new Error('soubor není projekt Modeláře');
      if (!(j.verze >= 1)) throw new Error('neznámá verze souboru projektu');
      if (j.verze > VERZE) throw new Error(`soubor je z novější verze Modeláře (${j.verze}), tahle umí ${VERZE}`);
      if (!j.dok || !Array.isArray(j.dok.uzly)) throw new Error('soubor projektu neobsahuje scénu');
      // zdroje: rozbalit a ověřit kontrolní klíč
      const zdroje = new Map();
      if (j.zdroje !== undefined && (typeof j.zdroje !== 'object' || Array.isArray(j.zdroje))) throw new Error('poškozené geometrie modelů v souboru');
      for (const [id, z] of Object.entries(j.zdroje || {})) {
        const jmeno = z && typeof z.nazev === 'string' ? z.nazev : id;
        if (!z || typeof z !== 'object' || typeof z.poz !== 'string' || typeof z.idx !== 'string') throw new Error('poškozená geometrie modelu ' + jmeno);
        let sit;
        try { sit = { poz: zBase64(z.poz, Float32Array), idx: zBase64(z.idx, Uint32Array) }; }
        catch (e) { throw new Error('poškozená geometrie modelu ' + jmeno); }
        if (sit.poz.length % 3 || sit.idx.length % 3) throw new Error('poškozená geometrie modelu ' + jmeno);
        for (const i of sit.idx) if (i >= sit.poz.length / 3) throw new Error('poškozená geometrie modelu ' + jmeno);
        for (const v of sit.poz) if (!isFinite(v)) throw new Error('poškozená geometrie modelu ' + jmeno);
        // klíč začíná otiskem sítě (za ním případně barvy a STEP) – starší soubory mají jen otisk
        if (!id.startsWith(M.klicZdroje(sit))) throw new Error('geometrie modelu ' + jmeno + ' nesouhlasí s kontrolním klíčem');
        zdroje.set(id, Object.assign(sit, { nazev: String(z.nazev || '').slice(0, 200), format: String(z.format || '').slice(0, 20) }));
        if (typeof z.step === 'string' && Array.isArray(z.stredStep) && z.stredStep.length === 3 && z.stredStep.every(Number.isFinite))
          Object.assign(zdroje.get(id), { step: z.step, stredStep: z.stredStep });
        if (typeof z.barvyTroj === 'string' && Array.isArray(z.paleta) && z.paleta.length > 1 && z.paleta.length < 65536
          && z.paleta.every(b => typeof b === 'string' && /^#[0-9a-f]{6}$/i.test(b))) {
          let bt = null;
          try { bt = zBase64(z.barvyTroj, Uint16Array); } catch (e) { /* poškozené barvy: model zůstane jednobarevný */ }
          if (bt && bt.length === sit.idx.length / 3 && bt.every(i => i < z.paleta.length)) Object.assign(zdroje.get(id), { barvyTroj: bt, paleta: z.paleta.map(b => b.toLowerCase()) });
        }
      }
      const dok = this.overDok(j.dok, zdroje);
      const kon = x => typeof x === 'number' && isFinite(x);
      const k = j.kamera;
      // kamera: jen platná čísla (chybějící doplní Kamera.obnov výchozími)
      let kamera = null;
      if (k && typeof k === 'object' && !Array.isArray(k)) {
        kamera = { orto: !!k.orto };
        for (const x of ['az', 'el', 'vzd']) if (kon(k[x])) kamera[x] = k[x];
        if (Array.isArray(k.cil) && k.cil.length === 3 && k.cil.every(kon)) kamera.cil = k.cil.slice();
      }
      const d = j.deska;
      const deska = d && typeof d === 'object' && kon(d.sirka) && kon(d.hloubka) && kon(d.krok) && d.sirka > 0 && d.hloubka > 0 && d.krok > 0
        ? { sirka: M.omez(d.sirka, 10, 2000), hloubka: M.omez(d.hloubka, 10, 2000), krok: d.krok } : null;
      return { nazev: String(j.nazev || 'Bez názvu').slice(0, 120), dok, deska, kamera, zdroje };
    },

    /** Kontrola a oprava scény (ze souboru i z úložiště prohlížeče): hloubka vnoření, počet těles,
        normalizace uzlů (neznámý druh = chyba), jedinečná id, geometrie importů, poznámky.
        zdroje = Map geometrií, které přišly se scénou (jinak se hledají v M.zdroje); bezZdroju = geometrie se
        teprve načtou (úložiště prohlížeče) – jejich přítomnost se neověřuje. */
    overDok(dokJ, zdroje = new Map(), bezZdroju = false) {
      if (!dokJ || !Array.isArray(dokJ.uzly)) throw new Error('projekt neobsahuje scénu');
      let pocet = 0;
      const ids = new Set();
      const over = (u, hloubka = 0) => {
        if (++pocet > MAX_UZLU) throw new Error('projekt má příliš mnoho těles');
        if (hloubka > MAX_HLOUBKA) throw new Error('projekt má příliš hluboko vnořené skupiny');
        if (ids.has(u.id)) throw new Error('projekt obsahuje dvě tělesa se stejným id');
        ids.add(u.id);
        if (!bezZdroju && u.druh === 'sit' && !zdroje.has(u.zdroj) && !M.zdroje.has(u.zdroj)) throw new Error('chybí geometrie modelu „' + u.nazev + '“');
        if (u.druh === 'skupina') u.deti.forEach(d => over(d, hloubka + 1));
      };
      // hloubku vnoření ohlídat dřív, než normalizace (rekurzivní) přeteče zásobník
      const hloubkaJson = (u, h) => { if (h > MAX_HLOUBKA) throw new Error('projekt má příliš hluboko vnořené skupiny'); if (u && Array.isArray(u.deti)) for (const d of u.deti) hloubkaJson(d, h + 1); };
      dokJ.uzly.forEach(u => hloubkaJson(u, 0));
      let uzly;
      try { uzly = dokJ.uzly.map(u => M.normalizujUzel(u)); }
      catch (e) { throw new Error('neplatné těleso v projektu: ' + e.message); }
      uzly.forEach(u => over(u));
      const dok = Object.assign({ verze: 1, uzly }, Array.isArray(dokJ.poznamky) && M.normalizujPoznamky ? { poznamky: M.normalizujPoznamky(dokJ.poznamky) } : {});
      // proměnné projektu (jadro/promenne.js) a klouby sestavy (jadro/sestava.js) – jen když jsou
      const prom = M.normalizujPromenne ? M.normalizujPromenne(dokJ.promenne) : [];
      if (prom.length) dok.promenne = prom;
      const kl = M.normalizujKlouby ? M.normalizujKlouby(dokJ.klouby, ids) : [];
      if (kl.length) dok.klouby = kl;
      return dok;
    },
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);
