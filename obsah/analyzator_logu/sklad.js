/* ============================================================
   analyzator_logu/sklad.js – úložiště záznamů a dotazy (bez DOM).
   Běží ve Web Workeru (worker.js), v nouzi i v hlavním vlákně, a v testech v node.
   Závisí na LogJadro (jadro.js).

   Analyzator drží dvě sady (A = 0, B = 1) ve sloupcích, sdílený Drain (aby šablony
   šlo porovnávat mezi sadami) a výsledek posledního filtru (index klíčů).
   Klíč záznamu = (sada << 30) | index.
   ============================================================ */
(function () {
  'use strict';
  const J = (typeof module !== 'undefined' && module.exports) ? require('./jadro.js') : self.LogJadro;

  const MAX_RADEK_ZOBR = 4000;
  const odlehcit = () => new Promise(r => setTimeout(r, 0));
  const klic = (s, i) => (s << 30) | i;
  const sadaZ = k => k >>> 30;
  const indexZ = k => k & 0x3fffffff;

  class Sada {
    constructor(nazev) {
      this.nazev = nazev;
      this.radky = [];   // původní text (vč. pokračovacích řádků)
      this.zpravy = [];  // zpráva bez hlavičky
      this.cas = [];     // UTC ms nebo NaN
      this.sev = [];     // 0–7
      this.sab = [];     // id šablony
      this.host = [];    // id řetězce
      this.app = [];     // id řetězce
      this.cislo = [];   // číslo řádku v souboru (od 1)
      this.poradiCasu = null; // Int32Array indexů seřazených podle času (jen s časem)
      this.parser = null;
      this.formatId = '';
    }
    get n() { return this.radky.length; }
  }

  class Analyzator {
    constructor(volby) {
      volby = volby || {};
      this.prahDrain = volby.prahDrain || 0.5;
      this.drain = new J.Drain({ prah: this.prahDrain });
      this.sady = [null, null];
      this.souhrny = [null, null];
      this.retezce = [''];
      this.mapaRet = new Map([['', 0]]);
      this.index = new Int32Array(0);
      this.posledniStat = null;
    }
    _ret(s) {
      if (!s) return 0;
      let id = this.mapaRet.get(s);
      if (id === undefined) {
        id = this.retezce.length;
        if (id < 1000000) { this.retezce.push(s); this.mapaRet.set(s, id); } else id = 0;
      }
      return id;
    }
    resetDrain(prah) {
      this.prahDrain = prah || this.prahDrain;
      this.drain = new J.Drain({ prah: this.prahDrain });
    }
    smaz(s) {
      this.sady[s] = null; this.souhrny[s] = null; this.index = new Int32Array(0);
    }

    /**
     * Načte zdroj do sady s (0/1).
     * zdroj: {soubor: Blob/File} | {text: string} | {proud: ReadableStream<Uint8Array>, velikost}
     * nastaveni: {format:'auto'|id|'vlastni', vlastni:{regex, casFormat, priznaky}, zona, referencni,
     *             kodovani, viceradkove, maxZaznamu, nazev}
     * hlaseni(p) – průběh; jeZruseno() – true = přerušit (načtená část zůstane).
     */
    async nacti(s, zdroj, nastaveni, hlaseni, jeZruseno) {
      nastaveni = nastaveni || {};
      hlaseni = hlaseni || (() => {});
      jeZruseno = jeZruseno || (() => false);
      const t0 = Date.now();
      const sada = new Sada(nastaveni.nazev || (zdroj.soubor && zdroj.soubor.name) || 'vložený text');
      const ctx = J.novyKontext({ zona: nastaveni.zona || 'UTC', referencni: nastaveni.referencni });
      const viceradkove = nastaveni.viceradkove !== false;
      const maxZaznamu = nastaveni.maxZaznamu || 3000000;
      const souhrn = {
        nazev: sada.nazev, bajtu: 0, radku: 0, prazdnych: 0, zaznamu: 0, pokracovani: 0, nerozpoznano: 0, ukazkyNerozpoznanych: [],
        format: '', formatNazev: '', detekce: null, zona: ctx.zona, referencni: ctx.referencni, predpoklady: null,
        zruseno: false, omezeno: false, trvani: 0, tMin: NaN, tMax: NaN, bezCasu: 0, sevOdhad: 0,
      };
      let parser = null;
      let cekajici = [];
      const delic = new J.DelicRadku();
      let cisloRadku = 0;
      let posledniHlaseni = 0;
      let stop = false;

      const zvolParser = () => {
        let f = nastaveni.format || 'auto';
        if (f === 'vlastni') {
          const v = J.vytvorVlastniParser((nastaveni.vlastni || {}).regex || '', (nastaveni.vlastni || {}).casFormat, (nastaveni.vlastni || {}).priznaky);
          if (v.chyba) throw new Error(v.chyba);
          parser = v.parser; souhrn.format = 'vlastni';
        } else {
          if (f === 'auto') {
            const d = J.detekujFormat(cekajici, { zona: ctx.zona, referencni: ctx.referencni });
            souhrn.detekce = d; f = d.format;
          }
          if (!J.FORMATY[f]) throw new Error('Neznámý formát: ' + f);
          parser = J.FORMATY[f]; souhrn.format = f;
        }
        souhrn.formatNazev = parser.nazev;
        sada.parser = parser; sada.formatId = souhrn.format;
      };

      const zpracuj = (radek) => {
        cisloRadku++;
        if (!radek.length || !radek.trim()) { souhrn.prazdnych++; return; }
        const n = sada.radky.length;
        const pokr = viceradkove && n > 0 && J.jePokracovani(radek);
        let z = null;
        if (!pokr) { try { z = parser.parse(radek, ctx); } catch (e) { z = null; } }
        // nerozebraný řádek je pokračováním jen tehdy, když sám nezačíná časovou značkou
        // (jinak jde o záznam v jiném formátu – počítá se jako nerozpoznaný)
        if (!z && viceradkove && n > 0 && (pokr || (parser !== J.FORMATY.prosty && !J.najdiCasNaZacatku(radek, null)))) {
          if (sada.radky[n - 1].length < 200000) sada.radky[n - 1] += '\n' + radek;
          souhrn.pokracovani++;
          return;
        }
        if (n >= maxZaznamu) { souhrn.omezeno = true; stop = true; return; }
        if (!z) {
          souhrn.nerozpoznano++;
          if (souhrn.ukazkyNerozpoznanych.length < 5) souhrn.ukazkyNerozpoznanych.push({ cislo: cisloRadku, text: radek.slice(0, 300) });
          z = { t: NaN, sev: J.odhadniZavaznost(radek), host: '', app: '', msg: radek, sevOdhad: true };
        }
        if (z.sevOdhad) souhrn.sevOdhad++;
        sada.radky.push(radek);
        sada.zpravy.push(z.msg);
        sada.cas.push(z.t);
        sada.sev.push(z.sev);
        sada.sab.push(z.vzorPresny ? this.drain.pridejPresne(z.vzorText, z.vzorPripona) : this.drain.pridej(z.vzorText || z.msg));
        sada.host.push(this._ret(z.host));
        sada.app.push(this._ret(z.app));
        sada.cislo.push(cisloRadku);
      };

      const pridejRadky = (radky) => {
        souhrn.radku += radky.length;
        if (!parser) {
          for (const r of radky) cekajici.push(r);
          if (cekajici.length < 400) return;
          zvolParser();
          const c = cekajici; cekajici = [];
          for (const r of c) { if (stop) break; zpracuj(r); }
          return;
        }
        for (let i = 0; i < radky.length && !stop; i++) zpracuj(radky[i]);
      };

      const hlas = (bajty, celkem, konec) => {
        const ted = Date.now();
        if (!konec && ted - posledniHlaseni < 120) return;
        posledniHlaseni = ted;
        hlaseni({ bajty, celkem, radku: souhrn.radku, zaznamu: sada.radky.length });
      };

      try {
        if (zdroj.text !== undefined) {
          const text = String(zdroj.text);
          souhrn.bajtu = text.length;
          const BLOK = 1 << 20;
          for (let i = 0; i < text.length && !stop; i += BLOK) {
            if (jeZruseno()) { souhrn.zruseno = true; break; }
            pridejRadky(delic.pridej(text.slice(i, i + BLOK)));
            hlas(Math.min(i + BLOK, text.length), text.length);
            await odlehcit();
          }
        } else {
          let proud, celkem;
          if (zdroj.soubor) {
            celkem = zdroj.soubor.size;
            proud = zdroj.soubor.stream();
          } else { proud = zdroj.proud; celkem = zdroj.velikost || 0; }
          let precteno = 0;
          let gzip = !!nastaveni.gzip || (zdroj.soubor && /\.gz$/i.test(zdroj.soubor.name || ''));
          if (zdroj.soubor && !gzip) {
            try { const h = new Uint8Array(await zdroj.soubor.slice(0, 2).arrayBuffer()); gzip = h[0] === 0x1f && h[1] === 0x8b; } catch (e) { /* bez detekce */ }
          }
          proud = proud.pipeThrough(new TransformStream({ transform(ch, ctl) { precteno += ch.byteLength; ctl.enqueue(ch); } }));
          if (gzip) {
            if (typeof DecompressionStream === 'undefined') throw new Error('Prohlížeč neumí rozbalit gzip (chybí DecompressionStream).');
            proud = proud.pipeThrough(new DecompressionStream('gzip'));
            souhrn.gzip = true;
          }
          const dekoder = new TextDecoder(nastaveni.kodovani || 'utf-8');
          const ctecka = proud.getReader();
          let bloku = 0;
          for (;;) {
            if (jeZruseno()) { souhrn.zruseno = true; try { await ctecka.cancel(); } catch (e) { /* nic */ } break; }
            const { done, value } = await ctecka.read();
            if (done) break;
            pridejRadky(delic.pridej(dekoder.decode(value, { stream: true })));
            hlas(precteno, celkem);
            if (stop) { try { await ctecka.cancel(); } catch (e) { /* nic */ } break; }
            if (++bloku % 8 === 0) await odlehcit();
          }
          if (!souhrn.zruseno && !stop) pridejRadky(delic.pridej(dekoder.decode()));
          souhrn.bajtu = precteno;
        }
        if (!stop) pridejRadky(delic.konec());
        if (!parser) { zvolParser(); const c = cekajici; cekajici = []; for (const r of c) { if (stop) break; zpracuj(r); } }
      } catch (e) {
        if (!parser || sada.radky.length === 0) throw e;
        souhrn.chyba = e.message;
      }
      hlas(souhrn.bajtu, souhrn.bajtu, true);

      // index podle času
      const sCasem = [];
      let tMin = Infinity, tMax = -Infinity;
      for (let i = 0; i < sada.cas.length; i++) {
        const t = sada.cas[i];
        if (t === t) { sCasem.push(i); if (t < tMin) tMin = t; if (t > tMax) tMax = t; }
      }
      const pc = Int32Array.from(sCasem);
      pc.sort((a, b) => (sada.cas[a] - sada.cas[b]) || (a - b));
      sada.poradiCasu = pc;
      souhrn.zaznamu = sada.radky.length;
      souhrn.bezCasu = sada.radky.length - pc.length;
      souhrn.tMin = pc.length ? tMin : NaN; souhrn.tMax = pc.length ? tMax : NaN;
      souhrn.predpoklady = ctx.predpoklady;
      souhrn.serazeno = this._jeSerazeno(sada);
      souhrn.trvani = Date.now() - t0;
      souhrn.sablon = this.drain.pocet;
      this.sady[s] = sada;
      this.souhrny[s] = souhrn;
      this.index = new Int32Array(0);
      return souhrn;
    }
    _jeSerazeno(sada) {
      let p = -Infinity, poruch = 0;
      for (const t of sada.cas) { if (t !== t) continue; if (t < p - 1000) poruch++; else p = t; }
      return poruch;
    }

    /* ---------------- filtr ---------------- */
    _sestavFiltr(f) {
      f = f || {};
      const sev = f.sev && f.sev.length === 8 ? f.sev.map(Boolean) : [true, true, true, true, true, true, true, true];
      const dotaz = J.rozlozDotaz(f.text || '');
      let re = null;
      if (f.regex) {
        try { re = new RegExp(f.regex, (f.regexPriznaky || '').replace(/[^imsu]/g, '')); }
        catch (e) { throw new Error('Neplatný regulární výraz filtru: ' + e.message); }
      }
      const od = isFinite(f.od) && f.od !== null ? +f.od : null;
      const do_ = isFinite(f.do) && f.do !== null ? +f.do : null;
      const sablona = f.sablona !== undefined && f.sablona !== null && f.sablona >= 0 ? f.sablona : -1;
      const hostId = f.host ? (this.mapaRet.has(f.host) ? this.mapaRet.get(f.host) : -2) : -1;
      const appId = f.app ? (this.mapaRet.has(f.app) ? this.mapaRet.get(f.app) : -2) : -1;
      const sady = (f.sady || [0, 1]).filter(s => this.sady[s]);
      return { sev, dotaz, re, od, do: do_, sablona, hostId, appId, sady, casovy: od !== null || do_ !== null };
    }
    _vyhovuje(F, sada, i) {
      if (!F.sev[sada.sev[i]]) return false;
      if (F.casovy) {
        const t = sada.cas[i];
        if (t !== t) return false;
        if (F.od !== null && t < F.od) return false;
        if (F.do !== null && t > F.do) return false;
      }
      if (F.sablona >= 0 && sada.sab[i] !== F.sablona) return false;
      if (F.hostId !== -1 && sada.host[i] !== F.hostId) return false;
      if (F.appId !== -1 && sada.app[i] !== F.appId) return false;
      const r = sada.radky[i];
      const k = F.dotaz.kladne, z = F.dotaz.zaporne;
      for (let j = 0; j < k.length; j++) if (!k[j].test(r)) return false;
      for (let j = 0; j < z.length; j++) if (z[j].test(r)) return false;
      if (F.re) { F.re.lastIndex = 0; if (!F.re.test(r)) return false; }
      return true;
    }
    _pravidla(seznam) {
      const out = [];
      for (const p of seznam || []) {
        if (!p || !p.vzor) { out.push(null); continue; }
        try { out.push(p.regex ? new RegExp(p.vzor, 'i') : new RegExp(J.escRegex(p.vzor), 'i')); } catch (e) { out.push(null); }
      }
      return out;
    }

    /**
     * Vyhodnotí filtr, uloží výsledný index (pro radky/export) a spočte statistiky.
     * jeZastarale() → true = přišel novější dotaz, výpočet se vzdá (vrací null).
     */
    async dotaz(f, jeZastarale) {
      jeZastarale = jeZastarale || (() => false);
      f = f || {};
      const F = this._sestavFiltr(f);
      const klice = [];
      const sevPocty = new Array(8).fill(0);
      const naSadu = [0, 0];
      let tMin = Infinity, tMax = -Infinity, bezCasu = 0;
      const sab = new Map();
      const hosty = new Map(), appky = new Map();
      const pravidla = this._pravidla(f.pravidla);
      const pocPravidel = pravidla.map(() => 0);
      let zpracovano = 0;
      for (const s of F.sady) {
        const sada = this.sady[s];
        const n = sada.n;
        for (let i = 0; i < n; i++) {
          if (++zpracovano % 100000 === 0) { await odlehcit(); if (jeZastarale()) return null; }
          if (!this._vyhovuje(F, sada, i)) continue;
          klice.push(klic(s, i));
          const sv = sada.sev[i];
          sevPocty[sv]++; naSadu[s]++;
          const t = sada.cas[i];
          if (t === t) { if (t < tMin) tMin = t; if (t > tMax) tMax = t; } else bezCasu++;
          const id = sada.sab[i];
          let e = sab.get(id);
          if (!e) { e = { id, pocet: 0, chyb: 0, varovani: 0, prvni: Infinity, posledni: -Infinity, vzorek: klic(s, i), a: 0, b: 0 }; sab.set(id, e); }
          e.pocet++; if (sv <= 1) e.chyb++; else if (sv === 2) e.varovani++;
          if (s === 0) e.a++; else e.b++;
          if (t === t) { if (t < e.prvni) e.prvni = t; if (t > e.posledni) e.posledni = t; }
          const h = sada.host[i]; if (h) hosty.set(h, (hosty.get(h) || 0) + 1);
          const a = sada.app[i]; if (a) appky.set(a, (appky.get(a) || 0) + 1);
          if (pravidla.length) { const r = sada.radky[i]; for (let p = 0; p < pravidla.length; p++) if (pravidla[p] && pravidla[p].test(r)) pocPravidel[p]++; }
        }
      }
      // řazení
      let index = Int32Array.from(klice);
      if (f.razeni === 'cas' || f.razeni === 'cas-sestupne') {
        const casK = new Float64Array(index.length);
        for (let j = 0; j < index.length; j++) { const k = index[j]; const t = this.sady[sadaZ(k)].cas[indexZ(k)]; casK[j] = t === t ? t : Infinity; }
        const poradi = new Uint32Array(index.length).map((_, j) => j);
        poradi.sort((x, y) => (casK[x] - casK[y]) || (x - y));
        if (f.razeni === 'cas-sestupne') poradi.reverse();
        index = Int32Array.from(poradi, j => index[j]);
      }
      if (jeZastarale()) return null;
      this.index = index;

      // časová osa
      const zonaZobr = f.zonaZobrazeni || 'UTC';
      let osa = null;
      const sCasem = index.length - bezCasu;
      if (sCasem > 0) {
        const od = F.od !== null ? Math.max(F.od, tMin) : tMin;
        const doo = F.do !== null ? Math.min(F.do, tMax) : tMax;
        const rozsah = Math.max(doo - od, 1000);
        const krok = f.krok > 0 ? Math.max(f.krok, Math.ceil(rozsah / 5000)) : J.zvolKrok(rozsah, f.cilKosu || 240);
        const posun = krok >= 3600000 ? J.posunZony(zonaZobr, od) * 60000 : 0;
        const start = Math.floor((od + posun) / krok) * krok - posun;
        const nk = Math.min(5000, Math.floor((doo - start) / krok) + 1);
        const chyby = new Array(nk).fill(0), varov = new Array(nk).fill(0), ostatni = new Array(nk).fill(0);
        const sadaA = new Array(nk).fill(0), sadaB = new Array(nk).fill(0);
        const prav = pravidla.map(() => new Array(nk).fill(0));
        for (let j = 0; j < index.length; j++) {
          const k = index[j]; const sada = this.sady[sadaZ(k)]; const i = indexZ(k);
          const t = sada.cas[i]; if (t !== t) continue;
          const b = Math.floor((t - start) / krok); if (b < 0 || b >= nk) continue;
          const sv = sada.sev[i];
          if (sv <= 1) chyby[b]++; else if (sv === 2) varov[b]++; else ostatni[b]++;
          if (sadaZ(k) === 0) sadaA[b]++; else sadaB[b]++;
          if (pravidla.length) { const r = sada.radky[i]; for (let p = 0; p < pravidla.length; p++) if (pravidla[p] && pravidla[p].test(r)) prav[p][b]++; }
        }
        const celkem = chyby.map((c, b) => c + varov[b] + ostatni[b]);
        // koše mimo časový rozsah všech vybraných logů (mezera mezi logy z různých dnů) nejsou „nula“, ale chybějící data
        const pokryti = new Array(nk).fill(false);
        for (const s of F.sady) {
          const so = this.souhrny[s]; if (!so || !(so.tMin === so.tMin)) continue;
          const a = Math.max(0, Math.floor((so.tMin - start) / krok)), b = Math.min(nk - 1, Math.floor((so.tMax - start) / krok));
          for (let q = a; q <= b; q++) pokryti[q] = true;
        }
        const sPokrytim = rada => rada.map((v, b) => (pokryti[b] ? v : NaN));
        const sp = f.spicky || {};
        const spicky = J.detekujSpicky(sPokrytim(celkem), sp);
        const spickyChyb = J.detekujSpicky(sPokrytim(chyby), Object.assign({}, sp, { minRozdil: sp.minRozdilChyb !== undefined ? sp.minRozdilChyb : Math.max(2, Math.round((sp.minRozdil || 5) / 2)) }));
        const naCas = iv => ({ od: start + iv.od * krok, do: start + (iv.do + 1) * krok, vrchol: start + iv.vrchol * krok, x: iv.x, zaklad: iv.zaklad, z: iv.z });
        osa = {
          start, krok, nk, chyby, varov, ostatni, celkem, sadaA, sadaB, pravidla: prav,
          zaklad: spicky.zaklad, prah: spicky.prah,
          spicky: spicky.intervaly.map(naCas), spickyChyb: spickyChyb.intervaly.map(naCas),
        };
      }
      const sabSeznam = Array.from(sab.values()).sort((a, b) => b.pocet - a.pocet || a.id - b.id);
      const top = (mapa, n) => Array.from(mapa.entries()).sort((a, b) => b[1] - a[1]).slice(0, n).map(([id, p]) => ({ nazev: this.retezce[id], pocet: p }));
      const stat = {
        pocet: index.length, naSadu, sevPocty, bezCasu, tMin: sCasem ? tMin : NaN, tMax: sCasem ? tMax : NaN,
        osa, pocetSablon: sabSeznam.length,
        sablony: sabSeznam.slice(0, f.maxSablon || 150).map(e => Object.assign({}, e, {
          sablona: this.drain.sablona(e.id), prvni: isFinite(e.prvni) ? e.prvni : NaN, posledni: isFinite(e.posledni) ? e.posledni : NaN,
          vzorek: this._text(e.vzorek, 400),
        })),
        hosty: top(hosty, 15), aplikace: top(appky, 15), pravidla: pocPravidel,
        celkem: this.sady.map(s => (s ? s.n : 0)),
      };
      this.posledniStat = stat;
      return stat;
    }
    _text(k, max) {
      const sada = this.sady[sadaZ(k)]; if (!sada) return '';
      const r = sada.radky[indexZ(k)];
      return max && r.length > max ? r.slice(0, max) + '…' : r;
    }
    _radek(k, plny) {
      const s = sadaZ(k), i = indexZ(k), sada = this.sady[s];
      let text = sada.radky[i];
      const radku = plny ? 0 : (text.indexOf('\n') >= 0 ? text.split('\n').length : 1);
      if (!plny) { const nl = text.indexOf('\n'); if (nl >= 0) text = text.slice(0, nl); if (text.length > MAX_RADEK_ZOBR) text = text.slice(0, MAX_RADEK_ZOBR) + '…'; }
      return { k, s, i, cislo: sada.cislo[i], t: sada.cas[i], sev: sada.sev[i], host: this.retezce[sada.host[i]], app: this.retezce[sada.app[i]], sab: sada.sab[i], text, radku };
    }
    /** Stránka výsledků aktuálního filtru. */
    radky(od, pocet) {
      const out = [];
      const konec = Math.min(this.index.length, od + pocet);
      for (let j = Math.max(0, od); j < konec; j++) out.push(this._radek(this.index[j], false));
      return out;
    }
    /** Pozice klíče v aktuálním výsledku (nebo −1). */
    poziceKlice(k) { return this.index.indexOf(k); }
    /** Pozice prvního záznamu s časem ≥ t (pro skok z časové osy). */
    poziceCasu(t) {
      let nej = -1, nejT = Infinity;
      for (let j = 0; j < this.index.length; j++) {
        const k = this.index[j]; const tt = this.sady[sadaZ(k)].cas[indexZ(k)];
        if (tt >= t && tt < nejT) { nejT = tt; nej = j; }
      }
      return nej;
    }

    /** Podrobnosti záznamu: plný text, rozparsovaná pole, šablona. */
    detail(k) {
      const z = this._radek(k, true);
      const sada = this.sady[z.s];
      z.sablona = this.drain.sablona(z.sab);
      z.zprava = sada.zpravy[z.i];
      z.sada = sada.nazev;
      z.format = sada.formatId;
      let pole = null;
      try {
        if (sada.parser) {
          const ctx = J.novyKontext({ zona: this.souhrny[z.s].zona, referencni: isFinite(z.t) ? z.t : this.souhrny[z.s].referencni });
          const prvni = z.text.split('\n')[0];
          const p = sada.parser.parse(prvni, ctx);
          if (p) {
            pole = {};
            for (const kk in p) if (['t', 'sev', 'msg', 'host', 'app', 'vzorText', 'pole', 'sevOdhad'].indexOf(kk) < 0 && p[kk] !== '' && p[kk] !== undefined) pole[kk] = p[kk];
            if (p.pole) Object.assign(pole, p.pole);
            if (sada.formatId === 'jsonl') { try { pole = JSON.parse(prvni); } catch (e) { /* nic */ } }
            z.sevOdhad = !!p.sevOdhad;
          }
        }
      } catch (e) { pole = null; }
      z.pole = pole;
      return z;
    }

    /** Záznamy ze všech sad v okně ±okno ms kolem záznamu k (korelace podle času). */
    okoli(k, okno, max) {
      max = max || 300;
      const s0 = sadaZ(k), sada0 = this.sady[s0];
      const t0 = sada0.cas[indexZ(k)];
      if (!(t0 === t0)) return { t0: NaN, zaznamy: [], orezano: false };
      const vys = [];
      let orezano = false;
      for (let s = 0; s < 2; s++) {
        const sada = this.sady[s]; if (!sada) continue;
        const pc = sada.poradiCasu;
        let lo = 0, hi = pc.length;
        while (lo < hi) { const m = (lo + hi) >> 1; if (sada.cas[pc[m]] < t0 - okno) lo = m + 1; else hi = m; }
        for (let j = lo; j < pc.length && sada.cas[pc[j]] <= t0 + okno; j++) vys.push(klic(s, pc[j]));
      }
      vys.sort((a, b) => this.sady[sadaZ(a)].cas[indexZ(a)] - this.sady[sadaZ(b)].cas[indexZ(b)] || a - b);
      let out = vys;
      if (vys.length > max) {
        orezano = true;
        // ponechat záznamy nejblíž t0
        const p = vys.indexOf(k) >= 0 ? vys.indexOf(k) : vys.length >> 1;
        const od = Math.max(0, Math.min(vys.length - max, p - (max >> 1)));
        out = vys.slice(od, od + max);
      }
      return { t0, zaznamy: out.map(x => Object.assign(this._radek(x, false), { dt: this.sady[sadaZ(x)].cas[indexZ(x)] - t0 })), orezano, celkem: vys.length };
    }

    /**
     * Korelace vzoru A s ostatními vzory v aktuálním výsledku filtru.
     * Pro (nejvýš 3000) výskytů A se zjistí, které vzory přišly do `okno` ms po něm (a před ním).
     * Očekávaná pravděpodobnost náhodného výskytu B v okně: p0 = 1 − exp(−λB·okno), λB = nB / délka logu.
     * Výsledek: podíl zásahů, p0, zdvih = podíl/p0, typické zpoždění (medián prvního výskytu).
     */
    korelaceVzoru(idA, okno) {
      const zaznamy = [];
      for (let j = 0; j < this.index.length; j++) {
        const k = this.index[j]; const sada = this.sady[sadaZ(k)]; const i = indexZ(k);
        const t = sada.cas[i]; if (t === t) zaznamy.push([t, sada.sab[i]]);
      }
      zaznamy.sort((a, b) => a[0] - b[0]);
      const n = zaznamy.length;
      if (n < 2) return { vzor: idA, nA: 0, vysledky: [] };
      const delka = Math.max(zaznamy[n - 1][0] - zaznamy[0][0], okno);
      const pocty = new Map();
      const vyskytyA = [];
      for (let j = 0; j < n; j++) { const id = zaznamy[j][1]; pocty.set(id, (pocty.get(id) || 0) + 1); if (id === idA) vyskytyA.push(j); }
      const nA = vyskytyA.length;
      if (!nA) return { vzor: idA, nA: 0, vysledky: [] };
      const krok = Math.max(1, Math.ceil(nA / 3000));
      const po = new Map(), pred = new Map(), zpozdeni = new Map();
      let vzorku = 0;
      const MAXSKEN = 3000;
      for (let q = 0; q < nA; q += krok) {
        vzorku++;
        const j0 = vyskytyA[q], t0 = zaznamy[j0][0];
        const videno = new Set();
        for (let j = j0 + 1, c = 0; j < n && zaznamy[j][0] - t0 <= okno && c < MAXSKEN; j++, c++) {
          const id = zaznamy[j][1];
          if (id === idA || videno.has(id)) continue;
          videno.add(id); po.set(id, (po.get(id) || 0) + 1);
          let z = zpozdeni.get(id); if (!z) { z = []; zpozdeni.set(id, z); } if (z.length < 2000) z.push(zaznamy[j][0] - t0);
        }
        const videno2 = new Set();
        for (let j = j0 - 1, c = 0; j >= 0 && t0 - zaznamy[j][0] <= okno && c < MAXSKEN; j--, c++) {
          const id = zaznamy[j][1];
          if (id === idA || videno2.has(id)) continue;
          videno2.add(id); pred.set(id, (pred.get(id) || 0) + 1);
        }
      }
      const vysledky = [];
      const ids = new Set([...po.keys(), ...pred.keys()]);
      for (const id of ids) {
        const nB = pocty.get(id) || 0;
        const lam = nB / delka;
        const p0 = 1 - Math.exp(-lam * okno);
        const hPo = (po.get(id) || 0), hPred = (pred.get(id) || 0);
        const pPo = hPo / vzorku, pPred = hPred / vzorku;
        if (hPo < 3 && hPred < 3) continue;
        vysledky.push({
          id, sablona: this.drain.sablona(id), nB, p0, po: pPo, pred: pPred, zasahuPo: hPo, zasahuPred: hPred,
          zdvihPo: p0 > 0 ? pPo / p0 : Infinity, zdvihPred: p0 > 0 ? pPred / p0 : Infinity,
          zpozdeni: zpozdeni.has(id) ? J.median(zpozdeni.get(id)) : NaN,
          skore: Math.max(pPo, pPred) - p0,
        });
      }
      vysledky.sort((a, b) => b.skore - a.skore);
      return { vzor: idA, sablona: this.drain.sablona(idA), nA, vzorku, okno, vysledky: vysledky.slice(0, 25) };
    }

    /**
     * Porovnání sad A a B (se stejným filtrem, bez omezení na sadu).
     * Šablony: podíly v A a B, log₂ poměru s vyhlazením (+0,5), z-test dvou podílů.
     * Řady četností: korelace s posunem; při malém časovém překryvu se sady zarovnají na začátek.
     */
    async porovnej(f, jeZastarale) {
      jeZastarale = jeZastarale || (() => false);
      if (!this.sady[0] || !this.sady[1]) return null;
      const F = this._sestavFiltr(Object.assign({}, f, { sady: [0, 1] }));
      const pocty = [new Map(), new Map()];
      const N = [0, 0], sev = [new Array(8).fill(0), new Array(8).fill(0)];
      const casy = [[], []];
      let zpracovano = 0;
      for (let s = 0; s < 2; s++) {
        const sada = this.sady[s];
        for (let i = 0; i < sada.n; i++) {
          if (++zpracovano % 100000 === 0) { await odlehcit(); if (jeZastarale()) return null; }
          if (!this._vyhovuje(F, sada, i)) continue;
          N[s]++; sev[s][sada.sev[i]]++;
          const id = sada.sab[i];
          pocty[s].set(id, (pocty[s].get(id) || 0) + 1);
          const t = sada.cas[i]; if (t === t) casy[s].push(t);
        }
      }
      const ids = new Set([...pocty[0].keys(), ...pocty[1].keys()]);
      const sablony = [];
      for (const id of ids) {
        const a = pocty[0].get(id) || 0, b = pocty[1].get(id) || 0;
        const pa = N[0] ? a / N[0] : 0, pb = N[1] ? b / N[1] : 0;
        const log2 = Math.log2(((b + 0.5) / (N[1] + 1)) / ((a + 0.5) / (N[0] + 1)));
        const p = (a + b) / Math.max(1, N[0] + N[1]);
        const se = Math.sqrt(Math.max(p * (1 - p) * (1 / Math.max(N[0], 1) + 1 / Math.max(N[1], 1)), 1e-12));
        const z = (pb - pa) / se;
        const stav = a === 0 ? 'nový' : b === 0 ? 'zmizel' : (Math.abs(z) >= 3 && Math.abs(log2) >= 1 ? (log2 > 0 ? 'nárůst' : 'pokles') : 'beze změny');
        sablony.push({ id, sablona: this.drain.sablona(id), a, b, pa, pb, log2, z, stav });
      }
      sablony.sort((x, y) => Math.abs(y.z) - Math.abs(x.z) || (y.a + y.b) - (x.a + x.b));
      // řady četností
      const rozsah = s => { if (!casy[s].length) return null; let lo = Infinity, hi = -Infinity; for (const t of casy[s]) { if (t < lo) lo = t; if (t > hi) hi = t; } return [lo, hi]; };
      const rA = rozsah(0), rB = rozsah(1);
      let rady = null;
      if (rA && rB) {
        const prekryv = Math.max(0, Math.min(rA[1], rB[1]) - Math.max(rA[0], rB[0]));
        const kratsi = Math.max(1, Math.min(rA[1] - rA[0], rB[1] - rB[0]));
        const zarovnat = prekryv / kratsi < 0.1;
        let startA, startB, delka;
        if (zarovnat) { startA = rA[0]; startB = rB[0]; delka = Math.max(rA[1] - rA[0], rB[1] - rB[0]); }
        else { startA = startB = Math.min(rA[0], rB[0]); delka = Math.max(rA[1], rB[1]) - startA; }
        const krok = J.zvolKrok(Math.max(delka, 1000), 200);
        const nk = Math.floor(delka / krok) + 1;
        const ra = new Array(nk).fill(0), rb = new Array(nk).fill(0);
        for (const t of casy[0]) { const b = Math.floor((t - startA) / krok); if (b >= 0 && b < nk) ra[b]++; }
        for (const t of casy[1]) { const b = Math.floor((t - startB) / krok); if (b >= 0 && b < nk) rb[b]++; }
        let nejR = NaN, nejPosun = 0;
        const maxPosun = Math.min(10, Math.floor(nk / 4));
        for (let p = -maxPosun; p <= maxPosun; p++) {
          const r = J.korelace(ra, rb, p);
          if (r === r && !(Math.abs(r) <= Math.abs(nejR))) { nejR = r; nejPosun = p; }
        }
        rady = { zarovnat, startA, startB, krok, nk, a: ra, b: rb, r0: J.korelace(ra, rb, 0), nejR, nejPosun, posunMs: nejPosun * krok, rozsahA: rA, rozsahB: rB };
      }
      return { N, sev, sablony: sablony.slice(0, 300), pocetSablon: sablony.length, novych: sablony.filter(x => x.stav === 'nový').length, zmizelych: sablony.filter(x => x.stav === 'zmizel').length, rady, nazvy: [this.sady[0].nazev, this.sady[1].nazev] };
    }

    /**
     * Export aktuálního výsledku filtru. format: 'txt' | 'csv' | 'jsonl' | 'vzory'.
     * Vrací pole částí (řetězců) k sestavení Blobu.
     */
    exportuj(format, volby) {
      volby = volby || {};
      const casti = [];
      const ZAV = J.ZAVAZNOSTI;
      const DAVKA = 5000;
      let buf = [];
      const flush = () => { if (buf.length) { casti.push(buf.join('')); buf = []; } };
      if (format === 'vzory') {
        const stat = this.posledniStat;
        const m = new Map();
        for (let j = 0; j < this.index.length; j++) {
          const k = this.index[j], sada = this.sady[sadaZ(k)], i = indexZ(k);
          const id = sada.sab[i]; let e = m.get(id);
          if (!e) { e = [0, 0, 0, Infinity, -Infinity]; m.set(id, e); }
          e[0]++; if (sada.sev[i] <= 1) e[1]++; else if (sada.sev[i] === 2) e[2]++;
          const t = sada.cas[i]; if (t === t) { if (t < e[3]) e[3] = t; if (t > e[4]) e[4] = t; }
        }
        casti.push('﻿id;pocet;chyb;varovani;prvni_utc;posledni_utc;sablona\r\n');
        for (const [id, e] of Array.from(m.entries()).sort((a, b) => b[1][0] - a[1][0])) {
          buf.push([id, e[0], e[1], e[2], J.isoCas(e[3]), J.isoCas(e[4]), J.csvPole(this.drain.sablona(id))].join(';') + '\r\n');
          if (buf.length >= DAVKA) flush();
        }
        flush();
        void stat;
        return casti;
      }
      if (format === 'csv') casti.push('﻿sada;radek;cas_utc;zavaznost;host;aplikace;sablona_id;zprava;puvodni_radek\r\n');
      for (let j = 0; j < this.index.length; j++) {
        const k = this.index[j], s = sadaZ(k), sada = this.sady[s], i = indexZ(k);
        if (format === 'txt') buf.push(sada.radky[i] + '\n');
        else if (format === 'csv') {
          buf.push([s === 0 ? 'A' : 'B', sada.cislo[i], J.isoCas(sada.cas[i]), ZAV[sada.sev[i]], J.csvPole(this.retezce[sada.host[i]]), J.csvPole(this.retezce[sada.app[i]]), sada.sab[i], J.csvPole(sada.zpravy[i]), J.csvPole(sada.radky[i])].join(';') + '\r\n');
        } else if (format === 'jsonl') {
          const o = { sada: s === 0 ? 'A' : 'B', radek: sada.cislo[i], cas: isFinite(sada.cas[i]) ? J.isoCas(sada.cas[i]) : null, zavaznost: ZAV[sada.sev[i]] };
          const h = this.retezce[sada.host[i]], a = this.retezce[sada.app[i]];
          if (h) o.host = h; if (a) o.aplikace = a;
          o.sablona = this.drain.sablona(sada.sab[i]);
          o.zprava = sada.zpravy[i];
          if (volby.puvodni !== false) o.puvodni = sada.radky[i];
          buf.push(JSON.stringify(o) + '\n');
        } else throw new Error('Neznámý formát exportu: ' + format);
        if (buf.length >= DAVKA) flush();
      }
      flush();
      return casti;
    }
  }

  /**
   * Obsluha zpráv (Worker i hlavní vlákno). post(zpráva) odesílá odpovědi.
   * Zprávy: nacti, zrus, prenacti, dotaz, radky, pozice, detail, okoli, korelace, porovnani, export, smaz.
   */
  function vytvorObsluhu(post) {
    const an = new Analyzator();
    let zrusit = false;
    let posledniDotaz = 0, posledniPorovnani = 0;
    const zdroje = [null, null];
    async function nacti(d) {
      zrusit = false;
      zdroje[d.sada] = { zdroj: d.zdroj, nastaveni: d.nastaveni };
      const souhrn = await an.nacti(d.sada, d.zdroj, d.nastaveni, p => post(Object.assign({ typ: 'prubeh', sada: d.sada }, p)), () => zrusit);
      post({ typ: 'nacteno', id: d.id, sada: d.sada, souhrn });
    }
    return async function (d) {
      try {
        switch (d.typ) {
          case 'nacti': await nacti(d); break;
          case 'zrus': zrusit = true; break;
          case 'prenacti': {
            // nové nastavení importu nebo práh Drainu → znovu načíst obě sady z uložených zdrojů
            an.resetDrain(d.prah);
            for (let s = 0; s < 2; s++) {
              if (!zdroje[s] || !an.sady[s]) continue;
              const nast = Object.assign({}, zdroje[s].nastaveni, (d.nastaveni && d.nastaveni[s]) || {});
              await nacti({ sada: s, zdroj: zdroje[s].zdroj, nastaveni: nast, id: d.id });
            }
            post({ typ: 'hotovo', id: d.id });
            break;
          }
          case 'dotaz': {
            posledniDotaz = d.id;
            const st = await an.dotaz(d.filtr, () => posledniDotaz !== d.id);
            if (st) post({ typ: 'vysledek', id: d.id, stat: st });
            break;
          }
          case 'radky': post({ typ: 'radky', id: d.id, od: d.od, radky: an.radky(d.od, d.pocet) }); break;
          case 'pozice': post({ typ: 'pozice', id: d.id, pozice: d.klic !== undefined ? an.poziceKlice(d.klic) : an.poziceCasu(d.t) }); break;
          case 'detail': post({ typ: 'detail', id: d.id, detail: an.detail(d.klic) }); break;
          case 'okoli': post({ typ: 'okoli', id: d.id, okoli: an.okoli(d.klic, d.okno, d.max) }); break;
          case 'korelace': post({ typ: 'korelace', id: d.id, korelace: an.korelaceVzoru(d.sablona, d.okno) }); break;
          case 'porovnani': {
            posledniPorovnani = d.id;
            const p = await an.porovnej(d.filtr, () => posledniPorovnani !== d.id);
            if (p !== null || !an.sady[0] || !an.sady[1]) post({ typ: 'porovnani', id: d.id, porovnani: p });
            break;
          }
          case 'export': post({ typ: 'export', id: d.id, casti: an.exportuj(d.format, d.volby), format: d.format }); break;
          case 'smaz': an.smaz(d.sada); zdroje[d.sada] = null; post({ typ: 'smazano', id: d.id, sada: d.sada }); break;
          default: post({ typ: 'chyba', id: d.id, zprava: 'Neznámý požadavek ' + d.typ });
        }
      } catch (e) {
        post({ typ: 'chyba', id: d.id, puvod: d.typ, sada: d.sada, zprava: e && e.message ? e.message : String(e) });
      }
    };
  }

  const API = { Analyzator, Sada, vytvorObsluhu, klic, sadaZ, indexZ };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else self.LogSklad = API;
})();
