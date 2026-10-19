/* ============================================================
   analyzator_logu/jadro.js – čisté výpočetní jádro analyzátoru logů (bez DOM).
   Sdílí ho stránka, Web Worker i testy v node.

   Obsah:
   - časové značky: ISO 8601 (s/bez zóny), RFC 3164, RFC 5424, Apache CLF, ctime,
     RFC 2822, český zápis, epoch s/ms/µs/ns; převod místního času v pásmu IANA na UTC
     včetně přechodů letního času (neexistující a dvojznačná hodina)
   - parsery formátů: syslog RFC 3164 / RFC 5424 / rsyslog ISO, Apache/Nginx access,
     Nginx error, Apache error, JSON Lines, logfmt, obecný „čas + úroveň“, prostý text,
     vlastní regulární výraz s pojmenovanými skupinami (+ volitelný formát času)
   - automatická detekce formátu podle vzorku řádků
   - šablony zpráv: maskování proměnných částí + zjednodušený algoritmus Drain
   - dělič řádků pro streamování (přenos rozpůleného řádku mezi bloky)
   - detekce prudkých nárůstů: klouzavý medián + MAD (robustní z-skóre)
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- závažnost ---------------- */
  // 0 kritická, 1 chyba, 2 varování, 3 upozornění, 4 info, 5 ladění, 6 trasování, 7 neurčeno
  const ZAVAZNOSTI = ['kritická', 'chyba', 'varování', 'upozornění', 'info', 'ladění', 'trasování', 'neurčeno'];
  const ZAV_KRATCE = ['KRIT', 'CHYBA', 'VAR', 'UPOZ', 'INFO', 'LAD', 'TRAS', '—'];
  const NEURCENO = 7;
  const SLOVA_ZAV = {
    emerg: 0, emergency: 0, panic: 0, fatal: 0, crit: 0, critical: 0, alert: 0, severe: 0, f: 0, c: 0,
    err: 1, error: 1, eror: 1, e: 1, failure: 1,
    warn: 2, warning: 2, w: 2,
    notice: 3, n: 3,
    info: 4, information: 4, informational: 4, inf: 4, i: 4,
    debug: 5, dbg: 5, fine: 5, d: 5, config: 5,
    trace: 6, finer: 6, finest: 6, verbose: 6, v: 6, t: 6, all: 6,
  };
  // syslog: 0 emerg,1 alert,2 crit,3 err,4 warning,5 notice,6 info,7 debug
  const SYSLOG_NA_ZAV = [0, 0, 0, 1, 2, 3, 4, 5];

  /** Převede úroveň (text nebo číslo) na index 0–7. Čísla 0–7 = syslog, 10–60 = bunyan/pino. */
  function normalizujZavaznost(x) {
    if (x === null || x === undefined || x === '') return NEURCENO;
    if (typeof x === 'number' || /^\d+$/.test(String(x).trim())) {
      const n = Number(x);
      if (n >= 0 && n <= 7) return SYSLOG_NA_ZAV[n];
      if (n >= 10 && n <= 100) {
        if (n >= 60) return 0; if (n >= 50) return 1; if (n >= 40) return 2;
        if (n >= 30) return 4; if (n >= 20) return 5; return 6;
      }
      return NEURCENO;
    }
    const s = String(x).trim().toLowerCase().replace(/^[\[<(]+|[\]>):]+$/g, '');
    if (s in SLOVA_ZAV) return SLOVA_ZAV[s];
    // „ERROR_LEVEL“, „warn-1“, „Microsoft.Warning“
    const m = s.match(/(emerg|panic|fatal|crit|alert|severe|err|warn|notice|info|debug|trace|verbose)/);
    if (m) return SLOVA_ZAV[m[1]] !== undefined ? SLOVA_ZAV[m[1]] : NEURCENO;
    return NEURCENO;
  }

  // klíčová slova v textu zprávy (odhad u formátů bez úrovně)
  const RE_ZAV_V_TEXTU = /\b(emerg(?:ency)?|panic|fatal|critical|crit|alert|severe|errors?|err|fail(?:ed|ure)?|exception|warn(?:ing)?|notice|debug|trace)\b/i;
  function odhadniZavaznost(text) {
    const m = RE_ZAV_V_TEXTU.exec(text);
    if (!m) return 4;
    const s = m[1].toLowerCase();
    if (/^(emerg|panic|fatal|crit|alert|severe)/.test(s)) return 0;
    if (/^(err|fail|exception)/.test(s)) return 1;
    if (s.startsWith('warn')) return 2;
    if (s === 'notice') return 3;
    if (s === 'debug') return 5;
    if (s === 'trace') return 6;
    return 4;
  }
  // úroveň zapsaná jako samostatné slovo na začátku zbytku řádku (log4j, python logging, glog…)
  const RE_UROVEN = /^\s*[\[(<]?\s*(EMERG(?:ENCY)?|PANIC|FATAL|CRIT(?:ICAL)?|ALERT|SEVERE|ERROR|ERR|WARN(?:ING)?|NOTICE|INFO|INFORMATION|DEBUG|DBG|TRACE|VERBOSE|FINE|FINER|FINEST|emerg|panic|fatal|crit(?:ical)?|alert|error|err|warn(?:ing)?|notice|info|debug|trace|[EWIDFV](?=[\]\s/:]))\s*[\])>]?\s*[:\-|]?\s*/;

  /* ---------------- časová pásma ---------------- */
  const _dtf = new Map();     // zóna → Intl.DateTimeFormat
  const _posuny = new Map();  // zóna → Map(čtvrthodina UTC → posun v minutách)
  let _platneZony = null;

  function pevnyPosun(zona) {
    if (!zona || zona === 'UTC' || zona === 'Z' || zona === 'GMT' || zona === 'Etc/UTC') return 0;
    const m = /^(?:UTC|GMT)?([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(zona);
    if (!m) return null;
    const v = Number(m[2]) * 60 + Number(m[3] || 0);
    return m[1] === '-' ? -v : v;
  }
  function jePlatnaZona(zona) {
    if (pevnyPosun(zona) !== null) return true;
    try { new Intl.DateTimeFormat('en-US', { timeZone: zona }); return true; } catch (e) { return false; }
  }
  /** Posun pásma (minuty, místní − UTC) v okamžiku utcMs. */
  function posunZony(zona, utcMs) {
    const pevny = pevnyPosun(zona);
    if (pevny !== null) return pevny;
    let cache = _posuny.get(zona);
    if (!cache) { cache = new Map(); _posuny.set(zona, cache); }
    const klic = Math.floor(utcMs / 900000);
    const c = cache.get(klic);
    if (c !== undefined) return c;
    let f = _dtf.get(zona);
    if (!f) {
      f = new Intl.DateTimeFormat('en-US', { timeZone: zona, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', era: 'short' });
      _dtf.set(zona, f);
    }
    const t = klic * 900000;
    const p = {};
    for (const x of f.formatToParts(new Date(t))) p[x.type] = x.value;
    let rok = Number(p.year); if (p.era && /^B/.test(p.era)) rok = 1 - rok;
    const jakoUtc = Date.UTC(rok, Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute), Number(p.second));
    const posun = Math.round((jakoUtc - t) / 60000);
    if (cache.size > 200000) cache.clear();
    cache.set(klic, posun);
    return posun;
  }
  /**
   * Místní „nástěnný“ čas (zadaný jako Date.UTC polí) v pásmu → UTC ms.
   * Neexistující čas (mezera při přechodu na letní čas) se vyloží posunem platným před přechodem
   * (02:30 → 03:30 letního času, stejně jako JavaScript Date). Dvojznačný čas (podzimní hodina)
   * dostane bez nápovědy dřívější výskyt; je-li známa předchozí značka `predchozi` (UTC ms),
   * vybere se výskyt k ní nejbližší (krok zpět se počítá 4×) – posloupnost 02:50 SELČ → 02:05 tak správně pokračuje v SEČ.
   * Vrací {t, priznak: '' | 'mezera' | 'dvojznacny'}.
   */
  function mistniNaUtc(stena, zona, predchozi) {
    const pevny = pevnyPosun(zona);
    if (pevny !== null) return { t: stena - pevny * 60000, priznak: '' };
    const kandidati = [posunZony(zona, stena - 86400000), posunZony(zona, stena), posunZony(zona, stena + 86400000)];
    const platne = [];
    for (const o of kandidati) {
      const t = stena - o * 60000;
      if (posunZony(zona, t) === o && platne.indexOf(t) < 0) platne.push(t);
    }
    if (platne.length === 1) return { t: platne[0], priznak: '' };
    if (platne.length === 0) return { t: stena - kandidati[0] * 60000, priznak: 'mezera' };
    platne.sort((a, b) => a - b);
    let t = platne[0];
    // s nápovědou vyhraje výskyt bližší předchozí značce (logy bývají mírně neseřazené, proto ne „první větší“)
    if (predchozi !== undefined && predchozi !== null && isFinite(predchozi)) {
      // krok zpět v čase je u logu nepravděpodobnější než krok vpřed → váha 4×
      const cena = k => (k >= predchozi ? k - predchozi : 4 * (predchozi - k));
      for (const k of platne) if (cena(k) < cena(t)) t = k;
    }
    return { t, priznak: 'dvojznacny' };
  }
  function seznamZon() {
    if (_platneZony) return _platneZony;
    try { _platneZony = Intl.supportedValuesOf('timeZone'); } catch (e) { _platneZony = ['UTC', 'Europe/Prague', 'Europe/London', 'America/New_York', 'Asia/Tokyo']; }
    if (_platneZony.indexOf('UTC') < 0) _platneZony = ['UTC'].concat(_platneZony);
    return _platneZony;
  }
  function zonaProhlizece() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; }
  }

  /* ---------------- parsování časových značek ---------------- */
  const MESICE = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  function mesicZeJmena(s) { const v = MESICE[String(s).slice(0, 3).toLowerCase()]; return v === undefined ? -1 : v; }
  function zlomek(s) { return s ? Number('0.' + s) * 1000 : 0; }
  function posunZTextu(z) {
    if (!z) return null;
    if (z === 'Z' || z === 'z' || z === 'UTC' || z === 'GMT') return 0;
    const m = /^([+-])(\d{2}):?(\d{2})?$/.exec(z);
    if (!m) return null;
    const v = Number(m[2]) * 60 + Number(m[3] || 0);
    if (Number(m[2]) > 14 || Number(m[3] || 0) > 59) return NaN;
    return m[1] === '-' ? -v : v;
  }
  function platnePole(r, mo, d, h, mi, s) {
    return r >= 1900 && r <= 2200 && mo >= 0 && mo <= 11 && d >= 1 && d <= 31 && h >= 0 && h <= 23 && mi >= 0 && mi <= 59 && s >= 0 && s <= 60;
  }

  /** Kontext parsování: pásmo pro časy bez zóny, referenční datum (rok u RFC 3164), stav a předpoklady. */
  function novyKontext(o) {
    o = o || {};
    return {
      zona: o.zona || 'UTC',
      referencni: o.referencni !== undefined ? o.referencni : Date.now(),
      rok: null, posledniMesic: null, posledniCas: null,
      predpoklady: { bezZony: 0, bezRoku: 0, roky: {}, mezera: 0, dvojznacny: 0 },
    };
  }

  // sestaví výsledek; pokud posun chybí, použije pásmo kontextu
  function sestav(r, mo, d, h, mi, s, ms, posun, ctx, delka, bezRoku) {
    if (!platnePole(r, mo, d, h, mi, s)) return null;
    if (s === 60) s = 59.999;
    const stena = Date.UTC(r, mo, d, h, mi, 0) + s * 1000 + ms;
    if (new Date(Date.UTC(r, mo, d)).getUTCDate() !== d) return null; // 31. 2. apod.
    let t, priznak = '', zonaZnama = true;
    if (posun === null || posun === undefined) {
      zonaZnama = false;
      const z = mistniNaUtc(stena, ctx ? ctx.zona : 'UTC', ctx ? ctx.posledniCas : null);
      t = z.t; priznak = z.priznak;
    } else {
      if (isNaN(posun)) return null;
      t = stena - posun * 60000;
    }
    return { t, delka, zonaZnama, priznak, bezRoku: !!bezRoku };
  }

  // rok pro RFC 3164 (bez roku): podle referenčního data a přechodů prosinec → leden
  function odvodRok(mo, d, ctx) {
    if (!ctx) return new Date().getUTCFullYear();
    const ref = new Date(ctx.referencni);
    if (ctx.rok === null) {
      let rok = ref.getUTCFullYear();
      // značka „v budoucnosti“ víc než 2 dny po referenčním datu → patří do loňska
      if (Date.UTC(rok, mo, d) > ctx.referencni + 2 * 86400000) rok--;
      ctx.rok = rok; ctx.posledniMesic = mo;
      return rok;
    }
    if (mo < ctx.posledniMesic - 6) { ctx.rok++; ctx.posledniMesic = mo; return ctx.rok; }
    if (mo > ctx.posledniMesic + 6) return ctx.rok - 1; // řádek „zpět“ přes přelom roku
    if (mo > ctx.posledniMesic) ctx.posledniMesic = mo;
    return ctx.rok;
  }

  const RE_ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]|\s+)(\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?(?:\s?(Z|z|[+-]\d{2}(?::?\d{2})?|UTC|GMT)(?![\w]))?/;
  const RE_ISO_ZAKL = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:[.,](\d{1,9}))?(Z|[+-]\d{2}:?\d{2})?/;
  const RE_YMD_LOM = /^(\d{4})\/(\d{2})\/(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,9}))?(?:\s?(Z|[+-]\d{2}:?\d{2})(?![\w]))?/;
  const RE_CLF = /^(\d{1,2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,9}))?(?:\s+([+-]\d{4}|Z|GMT|UTC))?/;
  const RE_3164 = /^([A-Z][a-z]{2})\s{1,2}(\d{1,2})(?:\s+(\d{4}))?\s+(\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,9}))?(?![\d])/;
  const RE_CTIME = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s+([A-Z][a-z]{2})[a-z]*\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,9}))?(?:\s+(UTC|GMT|Z|[+-]\d{4}))?\s+(\d{4})/;
  const RE_2822 = /^(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s*)?(\d{1,2})[\s-]([A-Z][a-z]{2})[\s-](\d{4})[\s:](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?(?:\s*(GMT|UTC|Z|[+-]\d{4}))?/;
  const RE_CESKY = /^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})(?:\s+|T)(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?/;
  const RE_US = /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ ,]+(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?(?:\s*([AaPp][Mm]))?/;
  const RE_EPOCH = /^(\d{9,10}|\d{12,13}|\d{15,16}|\d{18,19})(?:\.(\d{1,9}))?(?![\d.:\-\/])/;

  /** Převede číselný epoch (s, ms, µs, ns – podle řádu) na ms. Mimo roky 1990–2100 vrací NaN. */
  function epochNaMs(cislo, zlom) {
    const s = String(cislo);
    let ms;
    if (s.length <= 10) ms = Number(s) * 1000 + (zlom ? Number('0.' + zlom) * 1000 : 0);
    else if (s.length <= 13) ms = Number(s) + (zlom ? Number('0.' + zlom) : 0);
    else if (s.length <= 16) ms = Number(s) / 1000;
    else ms = Number(s.slice(0, s.length - 3)) / 1000;
    if (!(ms >= 631152000000 && ms <= 4102444800000)) return NaN;
    return ms;
  }

  /**
   * Najde časovou značku na začátku textu. Vrací {t (UTC ms), delka, zonaZnama, priznak, bezRoku} nebo null.
   * Volby: {epoch: true} povolí holé číslo jako epoch.
   */
  function parsujCas(text, ctx, volby) {
    if (text === null || text === undefined) return null;
    if (typeof text === 'number') {
      const t = epochNaMs(Math.trunc(text), String(text).split('.')[1]);
      return isNaN(t) ? null : { t, delka: String(text).length, zonaZnama: true, priznak: '', bezRoku: false };
    }
    const s = String(text);
    const c0 = s.charCodeAt(0);
    let m;
    const vysledek = r => { if (r && ctx) { if (!r.zonaZnama) ctx.predpoklady.bezZony++; if (r.priznak) ctx.predpoklady[r.priznak]++; ctx.posledniCas = r.t; } return r; };
    if (c0 >= 48 && c0 <= 57) {
      if ((m = RE_ISO.exec(s))) return vysledek(sestav(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0), zlomek(m[7]), m[8] ? posunZTextu(m[8]) : null, ctx, m[0].length));
      if ((m = RE_YMD_LOM.exec(s))) return vysledek(sestav(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], zlomek(m[7]), m[8] ? posunZTextu(m[8]) : null, ctx, m[0].length));
      if ((m = RE_CLF.exec(s))) {
        const mo = mesicZeJmena(m[2]); if (mo < 0) return null;
        return vysledek(sestav(+m[3], mo, +m[1], +m[4], +m[5], +m[6], zlomek(m[7]), m[8] ? posunZTextu(m[8]) : null, ctx, m[0].length));
      }
      if ((m = RE_ISO_ZAKL.exec(s))) return vysledek(sestav(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], zlomek(m[7]), m[8] ? posunZTextu(m[8]) : null, ctx, m[0].length));
      if ((m = RE_CESKY.exec(s))) return vysledek(sestav(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +(m[6] || 0), zlomek(m[7]), null, ctx, m[0].length));
      if ((m = RE_US.exec(s))) {
        let a = +m[1], b = +m[2];
        let mo = a - 1, d = b;
        if (a > 12 && b <= 12) { mo = b - 1; d = a; } // 25/10/2026 → den/měsíc
        let h = +m[4];
        if (m[8]) { const pm = /p/i.test(m[8]); if (h === 12) h = pm ? 12 : 0; else if (pm) h += 12; }
        return vysledek(sestav(+m[3], mo, d, h, +m[5], +(m[6] || 0), zlomek(m[7]), null, ctx, m[0].length));
      }
      if ((m = RE_2822.exec(s))) {
        const mo = mesicZeJmena(m[2]); if (mo < 0) return null;
        return vysledek(sestav(+m[3], mo, +m[1], +m[4], +m[5], +(m[6] || 0), zlomek(m[7]), m[8] ? posunZTextu(m[8]) : null, ctx, m[0].length));
      }
      if ((m = RE_EPOCH.exec(s)) && (!volby || volby.epoch !== false)) {
        const t = epochNaMs(m[1], m[2]);
        if (!isNaN(t)) { if (ctx) ctx.posledniCas = t; return { t, delka: m[0].length, zonaZnama: true, priznak: '', bezRoku: false }; }
      }
      return null;
    }
    if ((m = RE_3164.exec(s))) {
      const mo = mesicZeJmena(m[1]); if (mo < 0) return null;
      let rok, bezRoku = false;
      if (m[3]) rok = +m[3];
      else {
        rok = odvodRok(mo, +m[2], ctx); bezRoku = true;
        if (ctx) { ctx.predpoklady.bezRoku++; ctx.predpoklady.roky[rok] = (ctx.predpoklady.roky[rok] || 0) + 1; }
      }
      return vysledek(sestav(rok, mo, +m[2], +m[4], +m[5], +m[6], zlomek(m[7]), null, ctx, m[0].length, bezRoku));
    }
    if ((m = RE_CTIME.exec(s))) {
      const mo = mesicZeJmena(m[1]); if (mo < 0) return null;
      return vysledek(sestav(+m[8], mo, +m[2], +m[3], +m[4], +m[5], zlomek(m[6]), m[7] ? posunZTextu(m[7]) : null, ctx, m[0].length));
    }
    if ((m = RE_2822.exec(s))) {
      const mo = mesicZeJmena(m[2]); if (mo < 0) return null;
      return vysledek(sestav(+m[3], mo, +m[1], +m[4], +m[5], +(m[6] || 0), zlomek(m[7]), m[8] ? posunZTextu(m[8]) : null, ctx, m[0].length));
    }
    return null;
  }

  /** Najde časovou značku na začátku řádku, případně za úvodní závorkou „[“. */
  function najdiCasNaZacatku(radek, ctx) {
    let posun = 0;
    while (posun < radek.length && (radek[posun] === ' ' || radek[posun] === '\t')) posun++;
    if (radek[posun] === '[' || radek[posun] === '(') posun++;
    const r = parsujCas(posun ? radek.slice(posun) : radek, ctx);
    if (!r) return null;
    let konec = posun + r.delka;
    if ((radek[posun - 1] === '[' && radek[konec] === ']') || (radek[posun - 1] === '(' && radek[konec] === ')')) konec++;
    return { t: r.t, konec, zonaZnama: r.zonaZnama, priznak: r.priznak, bezRoku: r.bezRoku };
  }

  /* ---------------- vlastní formát času (YYYY-MM-DD HH:mm:ss.SSS Z) ---------------- */
  function vytvorFormatCasu(vzor) {
    const TOK = /YYYY|YY|MMM|MM|M|DD|D|HH|H|hh|h|mm|ss|SSS|S|A|a|ZZ|Z|\\./g;
    const poradi = [];
    let re = '', i = 0, m;
    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    while ((m = TOK.exec(vzor))) {
      re += esc(vzor.slice(i, m.index)); i = m.index + m[0].length;
      const t = m[0];
      if (t[0] === '\\') { re += esc(t[1]); continue; }
      const mapa = { YYYY: '(\\d{4})', YY: '(\\d{2})', MMM: '([A-Za-z]{3,9})', MM: '(\\d{2})', M: '(\\d{1,2})', DD: '(\\d{2})', D: '(\\d{1,2})',
        HH: '(\\d{2})', H: '(\\d{1,2})', hh: '(\\d{2})', h: '(\\d{1,2})', mm: '(\\d{2})', ss: '(\\d{2})', SSS: '(\\d{1,9})', S: '(\\d{1,9})',
        A: '([AaPp][Mm])', a: '([AaPp][Mm])', ZZ: '(Z|[+-]\\d{2}:?\\d{2})', Z: '(Z|[+-]\\d{2}:?\\d{2})' };
      re += mapa[t]; poradi.push(t);
    }
    re += esc(vzor.slice(i));
    const r = new RegExp('^' + re);
    return function (text, ctx) {
      const m = r.exec(text);
      if (!m) return null;
      let rok = null, mo = 0, d = 1, h = 0, mi = 0, s = 0, ms = 0, pm = null, posun = null;
      poradi.forEach((t, k) => {
        const v = m[k + 1];
        switch (t) {
          case 'YYYY': rok = +v; break;
          case 'YY': rok = 2000 + +v; break;
          case 'MMM': mo = mesicZeJmena(v); break;
          case 'MM': case 'M': mo = +v - 1; break;
          case 'DD': case 'D': d = +v; break;
          case 'HH': case 'H': case 'hh': case 'h': h = +v; break;
          case 'mm': mi = +v; break;
          case 'ss': s = +v; break;
          case 'SSS': case 'S': ms = zlomek(v); break;
          case 'A': case 'a': pm = /p/i.test(v); break;
          case 'ZZ': case 'Z': posun = posunZTextu(v); break;
        }
      });
      if (pm !== null) { if (h === 12) h = pm ? 12 : 0; else if (pm) h += 12; }
      let bezRoku = false;
      if (rok === null) { rok = odvodRok(mo, d, ctx); bezRoku = true; if (ctx) { ctx.predpoklady.bezRoku++; ctx.predpoklady.roky[rok] = (ctx.predpoklady.roky[rok] || 0) + 1; } }
      const v = sestav(rok, mo, d, h, mi, s, ms, posun, ctx, m[0].length, bezRoku);
      if (v && ctx) { if (!v.zonaZnama) ctx.predpoklady.bezZony++; if (v.priznak) ctx.predpoklady[v.priznak]++; ctx.posledniCas = v.t; }
      return v;
    };
  }

  /* ---------------- parsery formátů ---------------- */
  // Každý parser: parse(radek, ctx) → {t, sev, host, app, msg, vzorText?, sevOdhad?} nebo null
  function zaznam(t, sev, host, app, msg, extra) {
    const z = { t: t === null || t === undefined ? NaN : t, sev, host: host || '', app: app || '', msg: msg || '' };
    if (extra) Object.assign(z, extra);
    return z;
  }
  function pri(pri) {
    if (pri === undefined || pri === null || pri === '') return null;
    const n = Number(pri);
    if (!(n >= 0 && n <= 191)) return null;
    return { facility: n >> 3, severity: n & 7 };
  }

  const RE_P_3164 = /^(?:<(\d{1,3})>)?([A-Z][a-z]{2}\s{1,2}\d{1,2}(?:\s+\d{4})?\s+\d{2}:\d{2}:\d{2}(?:[.,]\d{1,9})?)\s+(\S+)\s+(.*)$/;
  const RE_TAG = /^([^\s:\[\]]{1,64})(?:\[([^\]]*)\])?:\s?(.*)$/;
  const RE_P_5424 = /^(?:<(\d{1,3})>)1 (\S+) (\S+) (\S+) (\S+) (\S+) (-|(?:\[(?:[^\]\\"]|\\.|"(?:[^"\\]|\\.)*")*\])+)(?: (.*))?$/;
  const RE_P_SYSISO = /^(?:<(\d{1,3})>)?(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:?\d{2}))\s+(\S+)\s+([^\s:\[\]]{1,64})(?:\[([^\]]*)\])?:\s?(.*)$/;
  const RE_P_ACCESS = /^(\S+) (\S+) (\S+) \[([^\]]+)\] "((?:[^"\\]|\\.)*)" (\d{3}|-) (\d+|-)(?: "((?:[^"\\]|\\.)*)" "((?:[^"\\]|\\.)*)")?(.*)$/;
  const RE_P_NGERR = /^(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\] (\d+)#(\d+): (?:\*(\d+) )?(.*)$/;
  const RE_P_APERR = /^\[((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) [^\]]+)\] \[(?:([\w-]+):)?(\w+)\](?: \[pid ([^\]]+)\])?(?: \[client ([^\]]+)\])? ?(.*)$/;
  const RE_LOGFMT = /([\w][\w.\-\/]*)=("(?:[^"\\]|\\.)*"|[^\s"]*)/g;

  function cestaVObjektu(o, cesta) {
    if (o === null || typeof o !== 'object') return undefined;
    if (cesta in o) return o[cesta];
    if (cesta.indexOf('.') < 0) return undefined;
    let v = o;
    for (const k of cesta.split('.')) { if (v === null || typeof v !== 'object') return undefined; v = v[k]; }
    return v;
  }
  const JSON_CAS = ['@timestamp', 'timestamp', 'time', 'ts', '@t', 'datetime', 'date', 'eventTime', 'asctime', 'created', 't', 'Timestamp', 'TimeGenerated', 'time_local', 'logged_at'];
  const JSON_UROVEN = ['level', 'severity', 'lvl', 'loglevel', 'log.level', 'levelname', '@l', 'Level', 'Severity', 'priority', 'syslog.severity', 'status_level'];
  const JSON_ZPRAVA = ['message', 'msg', '@m', '@mt', 'text', 'event', 'log', 'Message', 'error.message', 'description'];
  const JSON_HOST = ['host', 'hostname', 'host.name', 'host.hostname', 'Computer', 'node'];
  const JSON_APP = ['logger', 'logger_name', 'service', 'service.name', 'app', 'application', 'component', 'name', 'source', 'module', 'SourceContext'];
  function prvni(o, klice, iObjekt) {
    for (const k of klice) { const v = cestaVObjektu(o, k); if (v !== undefined && v !== null && v !== '' && (iObjekt || typeof v !== 'object')) return { k, v }; }
    return null;
  }
  function casZHodnoty(v, ctx) {
    if (v === null || v === undefined) return NaN;
    if (typeof v === 'number') return epochNaMs(Math.trunc(v), (String(v).split('.')[1] || '').replace(/e.*/, ''));
    if (typeof v === 'object' && v.$date) return casZHodnoty(v.$date, ctx);
    const r = parsujCas(String(v).trim(), ctx);
    return r ? r.t : NaN;
  }
  function kratkyJson(o, vynech) {
    const kopie = {};
    for (const k in o) if (!vynech || vynech.indexOf(k) < 0) kopie[k] = o[k];
    const s = JSON.stringify(kopie);
    return s === '{}' ? '' : s;
  }

  const FORMATY = {
    jsonl: {
      nazev: 'JSON Lines', popis: 'jeden objekt JSON na řádek (pole času, úrovně a zprávy se hledají podle běžných názvů)',
      parse(r, ctx) {
        const c = r.charCodeAt(0) === 123 ? 0 : r.search(/\S/);
        if (c < 0 || r.charCodeAt(c) !== 123) return null;
        let o;
        try { o = JSON.parse(r); } catch (e) { return null; }
        if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
        const pc = prvni(o, JSON_CAS, true), pu = prvni(o, JSON_UROVEN), pz = prvni(o, JSON_ZPRAVA, true), ph = prvni(o, JSON_HOST), pa = prvni(o, JSON_APP);
        const t = pc ? casZHodnoty(pc.v, ctx) : NaN;
        let msg = pz ? (typeof pz.v === 'string' ? pz.v : JSON.stringify(pz.v)) : kratkyJson(o, [pc && pc.k, pu && pu.k, ph && ph.k, pa && pa.k]);
        const sev = pu ? normalizujZavaznost(typeof pu.v === 'object' ? JSON.stringify(pu.v) : pu.v) : odhadniZavaznost(msg);
        return zaznam(t, sev, ph ? String(typeof ph.v === 'object' ? JSON.stringify(ph.v) : ph.v) : '', pa ? String(typeof pa.v === 'object' ? JSON.stringify(pa.v) : pa.v) : '', msg, { sevOdhad: !pu });
      },
    },
    syslog5424: {
      nazev: 'Syslog RFC 5424', popis: '<PRI>1 ČAS HOST APLIKACE PROCID MSGID [SD] zpráva',
      parse(r, ctx) {
        const m = RE_P_5424.exec(r);
        if (!m) return null;
        const p = pri(m[1]);
        let t = NaN;
        if (m[2] !== '-') { const c = parsujCas(m[2], ctx); if (!c) return null; t = c.t; }
        let msg = (m[8] || '').replace(/^\uFEFF/, '');
        const sd = m[7] === '-' ? '' : m[7];
        return zaznam(t, p ? SYSLOG_NA_ZAV[p.severity] : odhadniZavaznost(msg), m[3] === '-' ? '' : m[3], m[4] === '-' ? '' : m[4], msg, { pid: m[5] === '-' ? '' : m[5], msgid: m[6] === '-' ? '' : m[6], sd, sevOdhad: !p });
      },
    },
    syslogiso: {
      nazev: 'Syslog s časem ISO 8601 (rsyslog)', popis: 'ČAS-ISO HOST aplikace[pid]: zpráva',
      parse(r, ctx) {
        const m = RE_P_SYSISO.exec(r);
        if (!m) return null;
        const c = parsujCas(m[2], ctx); if (!c) return null;
        const p = pri(m[1]);
        return zaznam(c.t, p ? SYSLOG_NA_ZAV[p.severity] : odhadniZavaznost(m[6]), m[3], m[4], m[6], { pid: m[5] || '', sevOdhad: !p });
      },
    },
    access: {
      nazev: 'Apache/Nginx access log', popis: 'formát common/combined: IP - uživatel [čas] "požadavek" stav bajty "referer" "prohlížeč"',
      parse(r, ctx) {
        const m = RE_P_ACCESS.exec(r);
        if (!m) return null;
        const c = parsujCas(m[4], ctx); if (!c) return null;
        const stav = m[6] === '-' ? 0 : +m[6];
        const sev = stav >= 500 ? 1 : stav >= 400 ? 2 : stav ? 4 : NEURCENO;
        const poz = m[5].split(' ');
        const cesta = (poz[1] || '').split('?')[0];
        const vzorText = poz.length >= 2 ? poz[0] + ' ' + cesta : m[5];
        return zaznam(c.t, sev, m[1], '', '"' + m[5] + '" ' + m[6] + ' ' + m[7] + (m[9] ? ' "' + m[9] + '"' : ''),
          { vzorText, vzorPripona: ' → ' + m[6], vzorPresny: true, stav, bajty: m[7] === '-' ? 0 : +m[7], metoda: poz[0] || '', cesta, uzivatel: m[3], referer: m[8] || '', ua: m[9] || '' });
      },
    },
    nginxerr: {
      nazev: 'Nginx error log', popis: 'RRRR/MM/DD hh:mm:ss [úroveň] pid#tid: *spojení zpráva',
      parse(r, ctx) {
        const m = RE_P_NGERR.exec(r);
        if (!m) return null;
        const c = parsujCas(m[1], ctx); if (!c) return null;
        return zaznam(c.t, normalizujZavaznost(m[2]), '', 'nginx', m[6], { pid: m[3] });
      },
    },
    apacheerr: {
      nazev: 'Apache error log', popis: '[Den Mmm DD hh:mm:ss.µs RRRR] [modul:úroveň] [pid …] [client …] zpráva',
      parse(r, ctx) {
        const m = RE_P_APERR.exec(r);
        if (!m) return null;
        const c = parsujCas(m[1], ctx); if (!c) return null;
        const sev = normalizujZavaznost(m[3].replace(/^trace\d$/, 'trace'));
        return zaznam(c.t, sev, m[5] ? m[5].replace(/:\d+$/, '') : '', m[2] || 'apache', m[6], { pid: m[4] || '' });
      },
    },
    syslog3164: {
      nazev: 'Syslog RFC 3164 (BSD)', popis: '<PRI>Mmm dd hh:mm:ss HOST aplikace[pid]: zpráva – bez roku a časového pásma',
      parse(r, ctx) {
        const m = RE_P_3164.exec(r);
        if (!m) return null;
        const c = parsujCas(m[2], ctx); if (!c) return null;
        const p = pri(m[1]);
        let app = '', pid = '', msg = m[4];
        const tg = RE_TAG.exec(m[4]);
        if (tg) { app = tg[1]; pid = tg[2] || ''; msg = tg[3]; }
        return zaznam(c.t, p ? SYSLOG_NA_ZAV[p.severity] : odhadniZavaznost(msg), m[3], app, msg, { pid, sevOdhad: !p });
      },
    },
    logfmt: {
      nazev: 'logfmt (klíč=hodnota)', popis: 'time=… level=… msg="…" další=pole',
      parse(r, ctx) {
        if (r.indexOf('=') < 0) return null;
        const o = {}; let n = 0, m;
        RE_LOGFMT.lastIndex = 0;
        while ((m = RE_LOGFMT.exec(r))) {
          let v = m[2];
          if (v[0] === '"') { try { v = JSON.parse(v); } catch (e) { v = v.slice(1, -1); } }
          o[m[1]] = v; n++;
        }
        if (n < 2) return null;
        const pc = prvni(o, ['time', 'ts', 't', 'timestamp', '@timestamp', 'date']);
        const pu = prvni(o, ['level', 'lvl', 'severity', 'loglevel']);
        const pz = prvni(o, ['msg', 'message', 'event', 'text']);
        if (!pc && !pu && !pz) return null;
        // celý řádek musí být složen z dvojic (s tolerancí)
        const bezDvojic = r.replace(RE_LOGFMT, '').replace(/\s+/g, '');
        if (bezDvojic.length > r.length * 0.2) return null;
        const t = pc ? casZHodnoty(pc.v, ctx) : NaN;
        if (pc && isNaN(t)) return null;
        const msg = pz ? String(pz.v) : r;
        return zaznam(t, pu ? normalizujZavaznost(pu.v) : odhadniZavaznost(msg), o.host || o.hostname || '', o.logger || o.service || o.app || o.component || o.module || '', msg, { sevOdhad: !pu });
      },
    },
    obecny: {
      nazev: 'Obecný (čas na začátku + úroveň)', popis: 'čas v kterémkoli podporovaném zápisu na začátku řádku, úroveň jako slovo (ERROR, WARN, INFO…), např. log4j, Python logging',
      parse(r, ctx) {
        const c = najdiCasNaZacatku(r, ctx);
        if (!c) return null;
        let z = r.slice(c.konec), app = '', sev = null;
        // postupně odloupne: [vlákno], pid, ÚROVEŇ, logger – v libovolném pořadí (log4j, logback, python logging…)
        for (let krok = 0; krok < 5; krok++) {
          z = z.replace(/^[\s\-|:,]+/, '');
          if (sev === null) { const u = RE_UROVEN.exec(z); if (u) { sev = normalizujZavaznost(u[1]); z = z.slice(u[0].length); continue; } }
          const b = /^\[([^\]]{1,60})\]/.exec(z); if (b) { if (!app) app = b[1]; z = z.slice(b[0].length); continue; }
          const p = /^\d{1,10}(?=\s)/.exec(z); if (p && krok < 2) { z = z.slice(p[0].length); continue; }
          const l = /^([\w$.\/\-]{2,80})(?:\[\d+\])?(?:\s+[-|]\s+|:\s+)/.exec(z);
          if (l && (/[.\/]/.test(l[1]) || /\s[-|]\s/.test(l[0])) && (sev !== null || RE_UROVEN.test(z.slice(l[0].length)))) { app = l[1]; z = z.slice(l[0].length); continue; }
          break;
        }
        let sevOdhad = false;
        if (sev === null) { sev = odhadniZavaznost(z); sevOdhad = true; }
        return zaznam(c.t, sev, '', app, z.trim(), { sevOdhad });
      },
    },
    prosty: {
      nazev: 'Prostý text', popis: 'každý řádek je záznam; čas se hledá v prvních znacích, úroveň podle klíčových slov',
      parse(r, ctx) {
        if (!r.trim()) return null;
        let t = NaN, zbytek = r;
        const c = najdiCasNaZacatku(r, ctx);
        if (c) { t = c.t; zbytek = r.slice(c.konec).trim(); }
        else {
          const m = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:[.,]\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?/.exec(r.slice(0, 120));
          if (m) { const x = parsujCas(m[0], ctx); if (x) t = x.t; }
        }
        const u = RE_UROVEN.exec(zbytek);
        const sev = u ? normalizujZavaznost(u[1]) : odhadniZavaznost(zbytek);
        return zaznam(t, sev, '', '', u ? zbytek.slice(u[0].length) : zbytek, { sevOdhad: !u });
      },
    },
  };
  const PORADI_DETEKCE = ['jsonl', 'syslog5424', 'access', 'nginxerr', 'apacheerr', 'syslogiso', 'syslog3164', 'logfmt', 'obecny'];

  /* ---------------- vlastní regulární výraz ---------------- */
  const SKUP_CAS = ['cas', 'ts', 'time', 'timestamp', 'datum', 'date'];
  const SKUP_UROVEN = ['uroven', 'level', 'sev', 'severity', 'lvl', 'priorita'];
  const SKUP_ZPRAVA = ['zprava', 'msg', 'message', 'text'];
  const SKUP_HOST = ['host', 'hostname', 'stroj', 'ip', 'klient'];
  const SKUP_APP = ['app', 'aplikace', 'program', 'logger', 'sluzba', 'service', 'modul', 'tag'];
  /**
   * Vytvoří parser z regulárního výrazu s pojmenovanými skupinami (?<cas>…)(?<uroven>…)(?<zprava>…)…
   * casFormat (volitelný) např. „DD.MM.YYYY HH:mm:ss“. Vrací {parser} nebo {chyba}.
   */
  function vytvorVlastniParser(regexText, casFormat, priznaky) {
    let re;
    try { re = new RegExp(regexText, (priznaky || '').replace(/[^imsu]/g, '')); } catch (e) { return { chyba: 'Neplatný regulární výraz: ' + e.message }; }
    const skupiny = (regexText.match(/\(\?<([A-Za-z_][\w]*)>/g) || []).map(s => s.slice(3, -1));
    if (!skupiny.length) return { chyba: 'Výraz nemá žádnou pojmenovanou skupinu – použijte např. (?<cas>…), (?<uroven>…), (?<zprava>…).' };
    const najdi = seznam => skupiny.find(s => seznam.indexOf(s.toLowerCase()) >= 0) || null;
    const gCas = najdi(SKUP_CAS), gUr = najdi(SKUP_UROVEN), gZpr = najdi(SKUP_ZPRAVA), gHost = najdi(SKUP_HOST), gApp = najdi(SKUP_APP);
    let fmt = null;
    if (casFormat && casFormat.trim()) {
      try { fmt = vytvorFormatCasu(casFormat.trim()); } catch (e) { return { chyba: 'Neplatný formát času: ' + e.message }; }
    }
    const parser = {
      nazev: 'Vlastní regulární výraz', popis: regexText, skupiny, mapovani: { cas: gCas, uroven: gUr, zprava: gZpr, host: gHost, app: gApp },
      parse(r, ctx) {
        const m = re.exec(r);
        if (!m || !m.groups) return null;
        const g = m.groups;
        let t = NaN;
        if (gCas && g[gCas] !== undefined) {
          const v = g[gCas].trim();
          const c = fmt ? fmt(v, ctx) : parsujCas(v, ctx);
          if (!c) return null;
          t = c.t;
        }
        const msg = gZpr && g[gZpr] !== undefined ? g[gZpr] : r;
        const pole = {};
        for (const s of skupiny) if (s !== gCas && s !== gZpr && g[s] !== undefined) pole[s] = g[s];
        return zaznam(t, gUr && g[gUr] !== undefined ? normalizujZavaznost(g[gUr]) : odhadniZavaznost(msg), gHost ? g[gHost] : '', gApp ? g[gApp] : '', msg, { pole, sevOdhad: !gUr });
      },
    };
    return { parser };
  }

  /* ---------------- detekce formátu ---------------- */
  function jePokracovani(radek) {
    return /^(\s|at\s|Caused by:|\.\.\. \d+ more|Traceback|\}|\])/.test(radek);
  }
  /**
   * Odhadne formát podle vzorku řádků. Vrací {format, podil, vysledky:[{format, nazev, podil}], vzorek}.
   * Řádky, které vypadají jako pokračování (odsazené, „at …“), se do vzorku nepočítají.
   */
  function detekujFormat(radky, volby) {
    volby = volby || {};
    const vzorek = [];
    for (const r of radky) {
      if (!r || !r.trim() || jePokracovani(r)) continue;
      vzorek.push(r);
      if (vzorek.length >= (volby.max || 200)) break;
    }
    if (!vzorek.length) return { format: 'prosty', podil: 0, vysledky: [], vzorek: 0 };
    const vysledky = [];
    for (const f of PORADI_DETEKCE) {
      const ctx = novyKontext({ zona: volby.zona || 'UTC', referencni: volby.referencni });
      let ok = 0, sCasem = 0;
      for (const r of vzorek) {
        let z = null;
        try { z = FORMATY[f].parse(r, ctx); } catch (e) { z = null; }
        if (z) { ok++; if (!isNaN(z.t)) sCasem++; }
      }
      vysledky.push({ format: f, nazev: FORMATY[f].nazev, podil: ok / vzorek.length, sCasem: sCasem / vzorek.length });
    }
    // nejvyšší podíl; při téměř shodě vyhrává dřív uvedený (specifičtější) formát
    let nej = null;
    for (const v of vysledky) if (!nej || v.podil > nej.podil + 0.02) nej = v;
    if (!nej || nej.podil < 0.3) return { format: 'prosty', podil: nej ? nej.podil : 0, vysledky, vzorek: vzorek.length };
    return { format: nej.format, podil: nej.podil, vysledky, vzorek: vzorek.length };
  }

  /* ---------------- šablony zpráv ---------------- */
  const MASKY = [
    [/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g, '<UUID>'],
    [/\b[a-zA-Z][a-zA-Z0-9+.\-]*:\/\/[^\s"'<>]+/g, '<URL>'],
    [/\b[\w.+\-]+@[\w\-]+(?:\.[\w\-]+)+\b/g, '<EMAIL>'],
    [/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:[.,]\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?/g, '<ČAS>'],
    [/\b\d{1,2}:\d{2}:\d{2}(?:[.,]\d+)?\b/g, '<ČAS>'],
    [/\b(?:[0-9a-fA-F]{2}[:\-]){5}[0-9a-fA-F]{2}\b/g, '<MAC>'],
    [/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?\b/g, '<IP>'],
    [/(?:\b[0-9a-fA-F]{1,4}|)(?::[0-9a-fA-F]{0,4}){2,7}(?![\w:])/g, m => ((m.match(/:/g) || []).length >= 7 || m.indexOf('::') >= 0) && /[0-9a-fA-F]/.test(m) ? '<IP>' : m],
    [/\b0[xX][0-9a-fA-F]+\b/g, '<HEX>'],
    [/\b(?=[0-9a-fA-F]*\d)(?=[0-9a-fA-F]*[a-fA-F])[0-9a-fA-F]{8,}\b/g, '<HEX>'],
    [/(?<![A-Za-z_<>])[-+]?\d+(?:[.,]\d+)*(?:[eE][-+]?\d+)?/g, '<NUM>'],
  ];
  /** Nahradí proměnné části zprávy zástupnými značkami (<UUID>, <IP>, <HEX>, <NUM>…). */
  function maskuj(text) {
    let s = String(text);
    if (s.length > 2000) s = s.slice(0, 2000);
    for (const [re, nahrada] of MASKY) s = s.replace(re, nahrada);
    return s;
  }
  function tokenizuj(s) {
    const t = s.split(/\s+/).filter(Boolean);
    if (t.length > 80) { const zbytek = t.slice(79).join(' '); t.length = 79; t.push(zbytek); }
    return t;
  }
  /**
   * Zjednodušený Drain (He et al., 2017): strom podle počtu tokenů a prvního tokenu,
   * v listu skupiny; podobnost = podíl shodných pozic; nad prahem se skupina sloučí
   * a rozdílné pozice nahradí „<*>“.
   */
  class Drain {
    constructor(volby) {
      volby = volby || {};
      this.prah = volby.prah !== undefined ? volby.prah : 0.5;
      this.maxVListu = volby.maxVListu || 200;
      this.skupiny = []; // {id, tokeny}
      this.strom = new Map();
      this._mezipamet = new Map(); // maskovaný text → id (rychlá cesta pro opakované zprávy)
    }
    pridej(text) {
      const maska = maskuj(text);
      const hit = this._mezipamet.get(maska);
      if (hit !== undefined) {
        // šablona se mohla mezitím zobecnit; id zůstává platné
        return hit;
      }
      const tokeny = tokenizuj(maska);
      const id = this._pridejTokeny(tokeny);
      if (this._mezipamet.size > 50000) this._mezipamet.clear();
      this._mezipamet.set(maska, id);
      return id;
    }
    _pridejTokeny(tokeny) {
      const n = tokeny.length;
      const prvniTok = n ? tokeny[0] : '';
      const k1 = /\d|^</.test(prvniTok) ? '<*>' : prvniTok;
      let uzel = this.strom.get(n);
      if (!uzel) { uzel = new Map(); this.strom.set(n, uzel); }
      let list = uzel.get(k1);
      if (!list) { list = []; uzel.set(k1, list); }
      let nej = null, nejSim = -1, nejPar = -1;
      for (const id of list) {
        const sk = this.skupiny[id].tokeny;
        let shoda = 0, par = 0;
        for (let i = 0; i < n; i++) {
          if (sk[i] === '<*>') par++;
          else if (sk[i] === tokeny[i]) shoda++;
        }
        const sim = n ? shoda / n : 1;
        if (sim > nejSim || (sim === nejSim && par > nejPar)) { nej = id; nejSim = sim; nejPar = par; }
      }
      if (nej !== null && (n === 0 || nejSim >= this.prah)) {
        const sk = this.skupiny[nej].tokeny;
        for (let i = 0; i < n; i++) if (sk[i] !== tokeny[i]) sk[i] = '<*>';
        return nej;
      }
      const id = this.skupiny.length;
      this.skupiny.push({ id, tokeny: tokeny.slice() });
      if (list.length < this.maxVListu) list.push(id);
      else { list.shift(); list.push(id); }
      return id;
    }
    /**
     * Přesná šablona bez slučování (např. access log: metoda + maskovaná cesta + stav).
     * pripona se nemaskuje (stavový kód HTTP má zůstat čitelný).
     */
    pridejPresne(text, pripona) {
      const maska = '\u0001' + maskuj(text) + (pripona || '');
      let id = this._mezipamet.get(maska);
      if (id !== undefined) return id;
      if (!this._presne) this._presne = new Map();
      id = this._presne.get(maska);
      if (id === undefined) {
        id = this.skupiny.length;
        this.skupiny.push({ id, tokeny: tokenizuj(maska.slice(1)), presna: true });
        this._presne.set(maska, id);
      }
      return id;
    }
    sablona(id) { const s = this.skupiny[id]; return s ? s.tokeny.join(' ') : ''; }
    get pocet() { return this.skupiny.length; }
  }

  /* ---------------- dělič řádků pro streamování ---------------- */
  /** Skládá bloky textu do celých řádků; neúplný poslední řádek přenáší do dalšího bloku. */
  class DelicRadku {
    constructor() { this.zbytek = ''; this.prvni = true; }
    pridej(text) {
      if (this.prvni) { if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); if (text.length) this.prvni = false; }
      const s = this.zbytek + text;
      const casti = s.split('\n');
      this.zbytek = casti.pop();
      for (let i = 0; i < casti.length; i++) { const c = casti[i]; if (c.charCodeAt(c.length - 1) === 13) casti[i] = c.slice(0, -1); }
      return casti;
    }
    konec() {
      const z = this.zbytek; this.zbytek = '';
      if (!z) return [];
      return [z.charCodeAt(z.length - 1) === 13 ? z.slice(0, -1) : z];
    }
  }

  /* ---------------- statistika a detekce nárůstů ---------------- */
  function median(pole) {
    const n = pole.length;
    if (!n) return NaN;
    const a = Array.from(pole).sort((x, y) => x - y);
    return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
  }
  /** Anscombeova transformace: u Poissonových počtů stabilizuje rozptyl na ≈ 1. */
  const anscombe = x => 2 * Math.sqrt(Math.max(x, 0) + 0.375);
  const zAnscombe = y => Math.max(0, (y / 2) * (y / 2) - 0.375);
  /**
   * Detekce prudkých nárůstů v časové řadě četností (počty záznamů v koších).
   * 1. Řada se převede Anscombeovou transformací y = 2·√(x + 3/8); Poissonův šum pak má rozptyl ≈ 1
   *    nezávisle na úrovni, takže stejný práh funguje pro 2 i 2000 záznamů na koš.
   * 2. Pro koš i: základ = medián y předchozích `okno` košů (klouzavé okno jen do minulosti),
   *    σ̂ = max(1,4826·MAD, 1) – MAD je robustní k dřívějším špičkám, spodní mez 1 = Poissonův šum.
   * 3. Robustní z = (yᵢ − základ)/σ̂. Špička: z ≥ k a zároveň xᵢ − medián(x okna) ≥ minRozdil.
   * 4. Koš označený jako špička se do historie dalších oken zapíše hodnotou základu, aby delší
   *    incident „neotrávil“ medián; po `okno` špičkových koších v řadě se nová úroveň přijme
   *    (trvalá změna úrovně tak není hlášena donekonečna).
   * Koše s hodnotou NaN (mimo časové pokrytí logu, např. mezera mezi dvěma dny) se přeskakují.
   * Sousední špičkové koše se slučují do jednoho intervalu (vrchol = koš s nejvyšším z).
   * Vrací {body, intervaly:[{od, do, vrchol, x, zaklad, z}], zaklad[] (medián v původních jednotkách), prah[]}.
   */
  function detekujSpicky(rada, volby) {
    volby = volby || {};
    const okno = volby.okno || 20, k = volby.k || 4, minRozdil = volby.minRozdil !== undefined ? volby.minRozdil : 5, minHist = volby.minHistorie || 5;
    const n = rada.length;
    const y = Array.prototype.map.call(rada, anscombe);
    const hist = y.slice(), histX = Array.from(rada);
    let vRade = 0;
    const zaklad = new Array(n).fill(NaN), prah = new Array(n).fill(NaN), body = [];
    for (let i = 0; i < n; i++) {
      if (!Number.isFinite(rada[i])) { vRade = 0; continue; }
      const od = Math.max(0, i - okno);
      const w = hist.slice(od, i).filter(Number.isFinite);
      if (w.length < minHist) continue;
      const med = median(w);
      const mad = median(w.map(v => Math.abs(v - med)));
      const sigma = Math.max(1.4826 * mad, 1);
      const medX = median(histX.slice(od, i).filter(Number.isFinite));
      zaklad[i] = medX;
      prah[i] = Math.max(zAnscombe(med + k * sigma), medX + minRozdil);
      const z = (y[i] - med) / sigma;
      if (z >= k && rada[i] - medX >= minRozdil) {
        body.push({ i, x: rada[i], zaklad: medX, sigma, z });
        if (++vRade < okno) { hist[i] = med; histX[i] = medX; }
      } else vRade = 0;
    }
    const intervaly = [];
    for (const b of body) {
      const p = intervaly[intervaly.length - 1];
      if (p && b.i === p.do + 1) { p.do = b.i; if (b.z > p.z) { p.z = b.z; p.vrchol = b.i; p.x = b.x; p.zaklad = b.zaklad; } }
      else intervaly.push({ od: b.i, do: b.i, vrchol: b.i, x: b.x, zaklad: b.zaklad, z: b.z });
    }
    return { body, intervaly, zaklad, prah };
  }

  const KROKY = [1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000, 300000, 600000, 900000, 1800000, 3600000, 7200000, 10800000, 21600000, 43200000, 86400000, 172800000, 604800000, 2592000000];
  /** Zvolí „hezkou“ šířku koše, aby rozsah dal nejvýš `cil` košů. */
  function zvolKrok(rozsahMs, cil) {
    cil = cil || 240;
    for (const k of KROKY) if (rozsahMs / k <= cil) return k;
    return Math.ceil(rozsahMs / cil / 86400000) * 86400000;
  }
  /** Pearsonova korelace dvou řad (stejné délky) s posunem: b posunuté o `posun` košů dopředu. */
  function korelace(a, b, posun) {
    posun = posun || 0;
    let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
    for (let i = 0; i < a.length; i++) {
      const j = i + posun;
      if (j < 0 || j >= b.length) continue;
      const x = a[i], y = b[j];
      n++; sa += x; sb += y; saa += x * x; sbb += y * y; sab += x * y;
    }
    if (n < 3) return NaN;
    const cov = sab - sa * sb / n, va = saa - sa * sa / n, vb = sbb - sb * sb / n;
    if (va <= 0 || vb <= 0) return NaN;
    return cov / Math.sqrt(va * vb);
  }

  /* ---------------- pomocné ---------------- */
  function escRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  /**
   * Rozloží fulltextový dotaz: slova (AND), "fráze", -vyloučení. Vrací {kladne:[RegExp], zaporne:[RegExp]}.
   */
  function rozlozDotaz(text) {
    const kladne = [], zaporne = [];
    const re = /(-?)"([^"]*)"|(-?)(\S+)/g;
    let m;
    while ((m = re.exec(text || ''))) {
      const neg = (m[1] || m[3]) === '-';
      const slovo = m[2] !== undefined ? m[2] : m[4];
      if (!slovo) continue;
      (neg ? zaporne : kladne).push(new RegExp(escRegex(slovo), 'i'));
    }
    return { kladne, zaporne };
  }
  function csvPole(v) {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",;\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function isoCas(t) { return isFinite(t) ? new Date(t).toISOString() : ''; }

  const API = {
    ZAVAZNOSTI, ZAV_KRATCE, NEURCENO, FORMATY, PORADI_DETEKCE,
    normalizujZavaznost, odhadniZavaznost,
    posunZony, mistniNaUtc, jePlatnaZona, seznamZon, zonaProhlizece,
    novyKontext, parsujCas, najdiCasNaZacatku, epochNaMs, vytvorFormatCasu,
    vytvorVlastniParser, detekujFormat, jePokracovani,
    maskuj, tokenizuj, Drain, DelicRadku,
    median, anscombe, detekujSpicky, zvolKrok, korelace, rozlozDotaz, escRegex, csvPole, isoCas,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else self.LogJadro = API;
})();
