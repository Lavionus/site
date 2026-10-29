/* Evidence majetku – výpočetní jádro bez DOM (testuje se v node: _test/majetek_test.js).
   Obsah: data a lhůty (§ 605 a § 607 OZ), stav záruky, hledání a filtry, souhrny hodnot,
   CSV pro Excel, ZIP („uloženo“ + CRC32, čtení i deflate), migrace schématu, slučování záloh, iCalendar. */
(function () {
  'use strict';

  const SCHEMA = 2;                 // aktuální verze datového schématu (záloha i IndexedDB)
  const VYCHOZI_ZARUKA = 24;        // ČR: spotřebitelský nákup, § 2165 OZ – 24 měsíců
  const TYPY_PRILOH = ['foto', 'uctenka', 'navod', 'servis', 'jine'];
  const NAZVY_PRILOH = { foto: 'Fotografie', uctenka: 'Účtenka / faktura', navod: 'Návod', servis: 'Servisní doklad', jine: 'Jiné' };

  /* ---------- data (ISO řetězce YYYY-MM-DD, počítá se v UTC, aby nevadilo letní čas) ---------- */
  const RE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
  function jeDatum(s) {
    const m = RE_ISO.exec(String(s || ''));
    if (!m) return false;
    const r = +m[1], mes = +m[2], d = +m[3];
    return mes >= 1 && mes <= 12 && d >= 1 && d <= dniVMesici(r, mes);
  }
  function jePrestupny(r) { return (r % 4 === 0 && r % 100 !== 0) || r % 400 === 0; }
  function dniVMesici(r, m) { return [31, jePrestupny(r) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]; }
  function rozloz(s) { const m = RE_ISO.exec(s); return [+m[1], +m[2], +m[3]]; }
  function slozIso(r, m, d) { return String(r).padStart(4, '0') + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }
  function naDen(s) { const [r, m, d] = rozloz(s); return Math.round(Date.UTC(r, m - 1, d) / 86400000); }
  function zDne(n) { const t = new Date(n * 86400000); return slozIso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); }
  function pridejDny(s, n) { return zDne(naDen(s) + n); }
  function rozdilDni(a, b) { return naDen(b) - naDen(a); }
  function dnesIso(d) { d = d || new Date(); return slozIso(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
  function denVTydnu(s) { return ((naDen(s) % 7) + 7 + 4) % 7; } // 0 = neděle (1. 1. 1970 byl čtvrtek)

  /* § 605 odst. 2 OZ: lhůta určená v měsících končí uplynutím dne, který se číslem shoduje se dnem,
     kdy nastala rozhodná událost; takový den v posledním měsíci není → končí posledním dnem měsíce. */
  function pridejMesice(s, n) {
    const [r, m, d] = rozloz(s);
    const idx = r * 12 + (m - 1) + n;
    const r2 = Math.floor(idx / 12), m2 = idx - r2 * 12 + 1;
    return slozIso(r2, m2, Math.min(d, dniVMesici(r2, m2)));
  }

  /* Velikonoční neděle – anonymní gregoriánský algoritmus (Meeus/Jones/Butcher). */
  function velikonoce(r) {
    const a = r % 19, b = Math.floor(r / 100), c = r % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31), den = ((h + l - 7 * m + 114) % 31) + 1;
    return slozIso(r, mes, den);
  }
  /* Státní svátky a ostatní svátky ČR (zákon č. 245/2000 Sb.), Velký pátek od roku 2016. */
  function svatky(r) {
    const s = ['01-01', '05-01', '05-08', '07-05', '07-06', '09-28', '10-28', '11-17', '12-24', '12-25', '12-26'].map(x => r + '-' + x);
    const v = velikonoce(r);
    s.push(pridejDny(v, 1));
    if (r >= 2016) s.push(pridejDny(v, -2));
    return new Set(s);
  }
  const cacheSvatku = {};
  function jePracovniDen(s) {
    const dt = denVTydnu(s);
    if (dt === 0 || dt === 6) return false;
    const r = rozloz(s)[0];
    if (!cacheSvatku[r]) cacheSvatku[r] = svatky(r);
    return !cacheSvatku[r].has(s);
  }
  /* § 607 OZ: připadne-li konec lhůty na sobotu, neděli nebo svátek, je posledním dnem nejbližší pracovní den. */
  function posunNaPracovni(s) { let x = s; while (!jePracovniDen(x)) x = pridejDny(x, 1); return x; }

  /* Záruka položky: počátek = převzetí (není-li, nákup); konec dle § 605, poslední den uplatnění dle § 607. */
  function zaruka(p) {
    const pocatek = jeDatum(p.datumPrevzeti) ? p.datumPrevzeti : (jeDatum(p.datumNakupu) ? p.datumNakupu : null);
    const mes = Number(p.zarukaMesice);
    if (!pocatek || !Number.isFinite(mes) || mes <= 0) return null;
    const konec = pridejMesice(pocatek, Math.round(mes));
    return { pocatek, konec, posledniDen: posunNaPracovni(konec) };
  }
  /* stav: 'bez' | 'platna' | 'konci' | 'prosla'; dni = kolik dní zbývá do posledního dne (0 = dnes). */
  function stavZaruky(p, dnes, upozornitDni) {
    const z = zaruka(p);
    if (!z) return { stav: 'bez', dni: null, z: null };
    const dni = rozdilDni(dnes, z.posledniDen);
    const lim = Number.isFinite(+upozornitDni) ? +upozornitDni : 30;
    return { stav: dni < 0 ? 'prosla' : (dni <= lim ? 'konci' : 'platna'), dni, z };
  }

  /* ---------- čísla a texty ---------- */
  function cislo(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (v == null) return null;
    let s = String(v).replace(/[\s\u00a0\u202f]/g, '').replace(/(Kč|CZK|,-|\.-)+$/i, '');
    if (s === '') return null;
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');   // 1.299,50
    else if (/^-?\d{1,3}(,\d{3})+\.\d+$/.test(s)) s = s.replace(/,/g, ''); // 1,299.50
    s = s.replace(',', '.');
    if (!/^-?\d*\.?\d+$/.test(s)) return null;
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  }
  function formatCislo(n, des) {
    if (n == null || !Number.isFinite(n)) return '';
    const d = des == null ? (Math.round(n * 100) % 100 === 0 ? 0 : 2) : des;
    const [cela, zl] = Math.abs(n).toFixed(d).split('.');
    const sk = cela.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
    return (n < 0 ? '−' : '') + sk + (zl ? ',' + zl : '');
  }
  function formatKc(n, des) { return n == null || !Number.isFinite(n) ? '—' : formatCislo(n, des) + '\u00a0Kč'; }
  function formatDatum(s) { if (!jeDatum(s)) return ''; const [r, m, d] = rozloz(s); return d + '.\u00a0' + m + '.\u00a0' + r; }
  function velikost(b) {
    if (!Number.isFinite(b)) return '—';
    if (b < 1024) return b + ' B';
    const j = ['kB', 'MB', 'GB', 'TB']; let i = -1;
    do { b /= 1024; i++; } while (b >= 1024 && i < j.length - 1);
    return formatCislo(b, b < 10 ? 1 : 0) + '\u00a0' + j[i];
  }
  function bezDiakritiky(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function normStitky(v) {
    const pole = Array.isArray(v) ? v : String(v == null ? '' : v).split(/[,;#\n]/);
    const videne = new Set(), out = [];
    for (let s of pole) {
      s = String(s).trim().replace(/\s+/g, ' ');
      if (!s) continue;
      const k = bezDiakritiky(s);
      if (videne.has(k)) continue;
      videne.add(k); out.push(s.slice(0, 40));
    }
    return out;
  }

  /* Lokální identifikátor: „M-“ + 8 znaků Crockfordovy base32 (bez I, L, O, U – nezaměnitelné při přepisu). */
  const ABC = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  function novyId(prefix, nahoda) {
    const rnd = nahoda || (n => {
      const a = new Uint8Array(n);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(a);
      else for (let i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256);
      return a;
    });
    const b = rnd(8); let s = '';
    for (let i = 0; i < 8; i++) s += ABC[b[i] & 31];
    return (prefix || 'M') + '-' + s;
  }
  /* Text z QR štítku → identifikátor (přijme „MAJ:M-…“, odkaz s #p=M-… i holé ID; malá písmena a O/I/L opraví). */
  function idZeSkenu(t) {
    const s = String(t || '').trim();
    const m = /(?:#p=|MAJ:|^)\s*([A-Za-z])-([0-9A-Za-z]{8})\b/.exec(s);
    if (!m) return null;
    const telo = m[2].toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1');
    if (/[^0-9A-HJKMNP-TV-Z]/.test(telo)) return null;
    return m[1].toUpperCase() + '-' + telo;
  }
  function textQr(id, odkaz) { return odkaz ? odkaz.replace(/#.*$/, '') + '#p=' + id : 'MAJ:' + id; }

  /* ---------- normalizace záznamů ---------- */
  function txt(v, max) { return v == null ? '' : String(v).trim().slice(0, max || 500); }
  function normPolozka(p, ted) {
    p = p || {};
    const c = cislo(p.cena);
    const zm = p.zarukaMesice === '' || p.zarukaMesice == null ? null : Math.round(Number(p.zarukaMesice));
    return {
      id: txt(p.id, 40),
      nazev: txt(p.nazev, 200) || 'Bez názvu',
      vyrobce: txt(p.vyrobce, 120), model: txt(p.model, 120), seriove: txt(p.seriove, 120),
      cena: c == null ? null : Math.round(c * 100) / 100,
      datumNakupu: jeDatum(p.datumNakupu) ? p.datumNakupu : '',
      datumPrevzeti: jeDatum(p.datumPrevzeti) ? p.datumPrevzeti : '',
      prodejce: txt(p.prodejce, 200),
      zarukaMesice: Number.isFinite(zm) && zm >= 0 && zm <= 1200 ? zm : null,
      kategorieId: txt(p.kategorieId, 40), lokalitaId: txt(p.lokalitaId, 40), mistnostId: txt(p.mistnostId, 40),
      stitky: normStitky(p.stitky),
      poznamka: txt(p.poznamka, 5000),
      servis: (Array.isArray(p.servis) ? p.servis : []).map(z => ({
        id: txt(z && z.id, 40) || novyId('S'), datum: jeDatum(z && z.datum) ? z.datum : '',
        popis: txt(z && z.popis, 2000), cena: cislo(z && z.cena), dodavatel: txt(z && z.dodavatel, 200)
      })),
      vytvoreno: Number(p.vytvoreno) || ted || 0,
      upraveno: Number(p.upraveno) || Number(p.vytvoreno) || ted || 0,
      smazano: Number(p.smazano) || null
    };
  }

  /* ---------- migrace schématu ----------
     v1 = formát prototypu (export JSON, verze: 1): cena jako text „1 299,50 Kč“, zarukaRoky, štítky jako text
          „a, b“, umístění jako volný text „misto“, kategorie jako text „kategorie“, bez koše a servisu.
     v2 = současný formát: číselníky s ID, záruka v měsících, převzetí, koš (smazano), servisní záznamy. */
  function migruj(vstup, ted) {
    ted = ted || 0;
    let d = vstup;
    if (Array.isArray(d)) d = { verze: 1, polozky: d };
    if (!d || typeof d !== 'object') throw new Error('Soubor neobsahuje data evidence majetku.');
    let v = Number(d.schema || d.verze || 1);
    if (v > SCHEMA) throw new Error('Záloha je z novější verze aplikace (schéma ' + v + '). Aktualizujte stránku.');
    const kroky = [];
    if (v < 2) { d = z1na2(d, ted); v = 2; kroky.push('1→2'); }
    const out = {
      schema: SCHEMA,
      lokality: (d.lokality || []).map(l => ({ id: txt(l.id, 40), nazev: txt(l.nazev, 120) || 'Lokalita', adresa: txt(l.adresa, 300) })).filter(x => x.id),
      mistnosti: (d.mistnosti || []).map(m => ({ id: txt(m.id, 40), nazev: txt(m.nazev, 120) || 'Místnost', lokalitaId: txt(m.lokalitaId, 40) })).filter(x => x.id),
      kategorie: (d.kategorie || []).map(k => ({ id: txt(k.id, 40), nazev: txt(k.nazev, 120) || 'Kategorie' })).filter(x => x.id),
      polozky: (d.polozky || []).map(p => normPolozka(p, ted)).filter(p => p.id),
      prilohy: (d.prilohy || []).map(a => ({
        id: txt(a.id, 40), polozkaId: txt(a.polozkaId, 40), typ: TYPY_PRILOH.includes(a.typ) ? a.typ : 'jine',
        nazev: txt(a.nazev, 200) || 'příloha', mime: txt(a.mime, 100) || 'application/octet-stream',
        velikost: Number(a.velikost) || 0, vytvoreno: Number(a.vytvoreno) || ted, soubor: txt(a.soubor, 300), nahledSoubor: txt(a.nahledSoubor, 300)
      })).filter(a => a.id && a.polozkaId),
      nastaveni: Object.assign({}, d.nastaveni || {})
    };
    return { data: out, kroky };
  }
  function z1na2(d, ted) {
    const ids = new Map();
    const kat = [], mist = [];
    const lok = { id: 'L-PUVODNI', nazev: 'Domov', adresa: '' };
    function zCiselniku(pole, nazev, pref, extra) {
      const n = txt(nazev, 120); if (!n) return '';
      const k = pref + bezDiakritiky(n);
      if (!ids.has(k)) {
        const id = pref + '-' + String(ids.size + 1).padStart(4, '0') + 'MIG';
        ids.set(k, id); pole.push(Object.assign({ id, nazev: n }, extra));
      }
      return ids.get(k);
    }
    const polozky = (d.polozky || []).map(p => {
      const q = Object.assign({}, p);
      if (q.zarukaMesice == null && q.zarukaRoky != null) { const r = cislo(q.zarukaRoky); q.zarukaMesice = r == null ? null : Math.round(r * 12); }
      q.cena = cislo(q.cena);
      q.stitky = normStitky(q.stitky);
      if (q.misto && !q.mistnostId) { q.mistnostId = zCiselniku(mist, q.misto, 'R', { lokalitaId: lok.id }); q.lokalitaId = lok.id; }
      if (q.kategorie && !q.kategorieId) q.kategorieId = zCiselniku(kat, q.kategorie, 'K', {});
      if (!q.id) q.id = novyId('M');
      q.servis = []; q.smazano = null;
      delete q.misto; delete q.kategorie; delete q.zarukaRoky; delete q.verze;
      return q;
    });
    return {
      schema: 2, polozky,
      kategorie: (d.kategorieSeznam || []).concat(kat),
      mistnosti: mist, lokality: mist.length ? [lok] : [],
      prilohy: d.prilohy || [], nastaveni: d.nastaveni || {}
    };
  }

  /* ---------- hledání, filtry, řazení ---------- */
  function kontext(stav) {
    const m = a => new Map((a || []).map(x => [x.id, x]));
    return { kat: m(stav.kategorie), lok: m(stav.lokality), mist: m(stav.mistnosti) };
  }
  function nazevMista(p, ctx) {
    const mi = ctx.mist.get(p.mistnostId);
    const lo = ctx.lok.get(p.lokalitaId || (mi && mi.lokalitaId));
    return [lo && lo.nazev, mi && mi.nazev].filter(Boolean).join(' › ');
  }
  function hledanyText(p, ctx) {
    const k = ctx.kat.get(p.kategorieId);
    return bezDiakritiky([p.id, p.nazev, p.vyrobce, p.model, p.seriove, p.prodejce, p.poznamka, (p.stitky || []).join(' '),
      k && k.nazev, nazevMista(p, ctx), (p.servis || []).map(s => s.popis + ' ' + s.dodavatel).join(' ')].join(' \u0001 '));
  }
  /* Filtr: {dotaz, kategorieId, lokalitaId, mistnostId, stitek, zaruka('platna'|'konci'|'prosla'|'bez'|'aktivni'),
     bezCeny, sPrilohou(Set id), kos(bool)}. Dotaz: slova se musí vyskytnout všechna (AND), „-slovo“ vylučuje. */
  function filtruj(polozky, f, ctx, dnes, upozornitDni, sPrilohou) {
    f = f || {};
    const slova = bezDiakritiky(f.dotaz || '').split(/\s+/).filter(Boolean);
    const plus = slova.filter(s => !(s.startsWith('-') && s.length > 1)), minus = slova.filter(s => s.startsWith('-') && s.length > 1).map(s => s.slice(1));
    const stit = f.stitek ? bezDiakritiky(f.stitek) : '';
    return polozky.filter(p => {
      if (!!f.kos !== !!p.smazano) return false;
      if (f.kategorieId && (f.kategorieId === '-' ? p.kategorieId && ctx.kat.has(p.kategorieId) : p.kategorieId !== f.kategorieId)) return false;
      if (f.lokalitaId) {
        const mi = ctx.mist.get(p.mistnostId);
        const lid = p.lokalitaId || (mi && mi.lokalitaId) || '';
        if (lid !== f.lokalitaId) return false;
      }
      if (f.mistnostId && p.mistnostId !== f.mistnostId) return false;
      if (stit && !(p.stitky || []).some(s => bezDiakritiky(s) === stit)) return false;
      if (f.zaruka) {
        const st = stavZaruky(p, dnes, upozornitDni).stav;
        if (f.zaruka === 'aktivni' ? !(st === 'platna' || st === 'konci') : st !== f.zaruka) return false;
      }
      if (f.bezCeny && p.cena != null) return false;
      if (f.sPrilohou && sPrilohou && !sPrilohou.has(p.id)) return false;
      if (plus.length || minus.length) {
        const t = hledanyText(p, ctx);
        if (!plus.every(s => t.includes(s))) return false;
        if (minus.some(s => t.includes(s))) return false;
      }
      return true;
    });
  }
  const kolator = typeof Intl !== 'undefined' ? new Intl.Collator('cs', { sensitivity: 'base', numeric: true }) : { compare: (a, b) => (a < b ? -1 : a > b ? 1 : 0) };
  function serad(polozky, podle, ctx) {
    const a = polozky.slice();
    const nul = (x, y, cmp) => (x == null || x === '') ? ((y == null || y === '') ? 0 : 1) : ((y == null || y === '') ? -1 : cmp(x, y));
    const zk = p => { const z = zaruka(p); return z ? z.posledniDen : null; };
    const fns = {
      nazev: (x, y) => kolator.compare(x.nazev, y.nazev),
      cena: (x, y) => nul(x.cena, y.cena, (u, v) => v - u),
      nakup: (x, y) => nul(x.datumNakupu, y.datumNakupu, (u, v) => (u < v ? 1 : u > v ? -1 : 0)),
      zaruka: (x, y) => nul(zk(x), zk(y), (u, v) => (u < v ? -1 : u > v ? 1 : 0)),
      zmena: (x, y) => (y.upraveno || 0) - (x.upraveno || 0),
      misto: (x, y) => kolator.compare(nazevMista(x, ctx) || '\uffff', nazevMista(y, ctx) || '\uffff')
    };
    const fn = fns[podle] || fns.nazev;
    return a.sort((x, y) => fn(x, y) || kolator.compare(x.nazev, y.nazev) || (x.id < y.id ? -1 : 1));
  }

  /* ---------- souhrny ---------- */
  function souhrn(polozky, ctx, podle) {
    const sk = new Map();
    let celkem = 0, pocet = 0, bezCeny = 0;
    for (const p of polozky) {
      if (p.smazano) continue;
      let klic, nazev;
      if (podle === 'lokalita') {
        const mi = ctx.mist.get(p.mistnostId);
        klic = p.lokalitaId || (mi && mi.lokalitaId) || '';
        const l = ctx.lok.get(klic); nazev = l ? l.nazev : 'Bez lokality'; if (!l) klic = '';
      } else {
        const k = ctx.kat.get(p.kategorieId);
        klic = k ? k.id : ''; nazev = k ? k.nazev : 'Bez kategorie';
      }
      if (!sk.has(klic)) sk.set(klic, { id: klic, nazev, pocet: 0, hodnota: 0, bezCeny: 0 });
      const r = sk.get(klic);
      r.pocet++; pocet++;
      if (p.cena == null) { r.bezCeny++; bezCeny++; } else { r.hodnota = Math.round((r.hodnota + p.cena) * 100) / 100; celkem = Math.round((celkem + p.cena) * 100) / 100; }
    }
    const radky = [...sk.values()].sort((a, b) => b.hodnota - a.hodnota || kolator.compare(a.nazev, b.nazev));
    for (const r of radky) r.podil = celkem > 0 ? r.hodnota / celkem : 0;
    return { radky, celkem, pocet, bezCeny };
  }

  /* ---------- CSV pro Excel: UTF-8 s BOM, středník, CRLF, uvozovky zdvojené ---------- */
  function csvBunka(v, jeCislo) {
    if (v == null) return '';
    let s = String(v);
    // ochrana proti vložení vzorce (CSV injection) – textové buňky začínající = + - @ tab CR
    if (!jeCislo && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    if (/[";\r\n]/.test(s) || /^\s|\s$/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function csvCislo(n) { return n == null || !Number.isFinite(n) ? '' : String(Math.round(n * 100) / 100).replace('.', ','); }
  const SLOUPCE_CSV = ['ID', 'Název', 'Výrobce', 'Model', 'Sériové číslo', 'Kategorie', 'Lokalita', 'Místnost', 'Pořizovací cena (Kč)',
    'Datum nákupu', 'Datum převzetí', 'Prodejce', 'Záruka (měsíce)', 'Konec záruky', 'Poslední den uplatnění', 'Stav záruky', 'Štítky', 'Počet příloh', 'Servisních záznamů', 'Poznámka'];
  const NAZVY_STAVU = { bez: 'bez údaje', platna: 'platná', konci: 'brzy končí', prosla: 'prošlá' };
  function csv(polozky, ctx, dnes, upozornitDni, pocetPriloh) {
    const r = [SLOUPCE_CSV.map(s => csvBunka(s)).join(';')];
    for (const p of polozky) {
      const mi = ctx.mist.get(p.mistnostId), lo = ctx.lok.get(p.lokalitaId || (mi && mi.lokalitaId)), k = ctx.kat.get(p.kategorieId);
      const st = stavZaruky(p, dnes, upozornitDni);
      r.push([
        csvBunka(p.id), csvBunka(p.nazev), csvBunka(p.vyrobce), csvBunka(p.model), csvBunka(p.seriove),
        csvBunka(k ? k.nazev : ''), csvBunka(lo ? lo.nazev : ''), csvBunka(mi ? mi.nazev : ''), csvCislo(p.cena),
        csvBunka(p.datumNakupu), csvBunka(p.datumPrevzeti), csvBunka(p.prodejce), p.zarukaMesice == null ? '' : String(p.zarukaMesice),
        csvBunka(st.z ? st.z.konec : ''), csvBunka(st.z ? st.z.posledniDen : ''), csvBunka(NAZVY_STAVU[st.stav]),
        csvBunka((p.stitky || []).join(', ')), String(pocetPriloh ? (pocetPriloh.get(p.id) || 0) : 0), String((p.servis || []).length), csvBunka(p.poznamka)
      ].join(';'));
    }
    return '\uFEFF' + r.join('\r\n') + '\r\n';
  }
  /* Čtení CSV (RFC 4180, oddělovač zadaný) – pro test i kontrolu exportu. */
  function ctiCsv(text, odd) {
    odd = odd || ';';
    text = String(text).replace(/^\uFEFF/, '');
    const radky = []; let r = [], b = '', uv = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (uv) {
        if (c === '"') { if (text[i + 1] === '"') { b += '"'; i++; } else uv = false; } else b += c;
      } else if (c === '"' && b === '') uv = true;
      else if (c === odd) { r.push(b); b = ''; }
      else if (c === '\r' || c === '\n') { if (c === '\r' && text[i + 1] === '\n') i++; r.push(b); radky.push(r); r = []; b = ''; }
      else b += c;
    }
    if (b !== '' || r.length) { r.push(b); radky.push(r); }
    return radky;
  }

  /* ---------- ZIP ---------- */
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[i] = c >>> 0; }
    return t;
  })();
  function crc32(u8, c0) {
    let c = (c0 == null ? 0 : c0) ^ 0xFFFFFFFF;
    for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function dosCas(d) {
    d = d || new Date(1980, 0, 1);
    const r = Math.max(1980, Math.min(2107, d.getFullYear()));
    return { cas: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), datum: ((r - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() };
  }
  /* polozky: [{name, data: Uint8Array|string, date?: Date}] → pole částí (Uint8Array) pro new Blob(casti). Metoda 0 = uloženo. */
  function zapisZip(polozky, datum) {
    const enc = new TextEncoder();
    const casti = [], centralni = [];
    let offset = 0;
    const dc = dosCas(datum);
    for (const p of polozky) {
      const data = typeof p.data === 'string' ? enc.encode(p.data) : p.data;
      const jmeno = enc.encode(p.name);
      if (data.length >= 0xFFFFFFFF || offset >= 0xFFFFFFFF) throw new Error('Záloha je větší než 4 GB – formát ZIP bez ZIP64 to neumožní.');
      const crc = crc32(data);
      const lok = new Uint8Array(30 + jmeno.length), dv = new DataView(lok.buffer);
      dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true); // bit 11 = názvy v UTF-8
      dv.setUint16(8, 0, true); dv.setUint16(10, dc.cas, true); dv.setUint16(12, dc.datum, true);
      dv.setUint32(14, crc, true); dv.setUint32(18, data.length, true); dv.setUint32(22, data.length, true);
      dv.setUint16(26, jmeno.length, true); lok.set(jmeno, 30);
      casti.push(lok, data);
      const cen = new Uint8Array(46 + jmeno.length), cv = new DataView(cen.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true); cv.setUint16(12, dc.cas, true); cv.setUint16(14, dc.datum, true);
      cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
      cv.setUint16(28, jmeno.length, true); cv.setUint32(42, offset, true); cen.set(jmeno, 46);
      centralni.push(cen);
      offset += lok.length + data.length;
    }
    if (polozky.length > 0xFFFF) throw new Error('Příliš mnoho souborů pro ZIP bez ZIP64.');
    const cdVel = centralni.reduce((s, c) => s + c.length, 0);
    const konec = new Uint8Array(22), kv = new DataView(konec.buffer);
    kv.setUint32(0, 0x06054b50, true); kv.setUint16(8, polozky.length, true); kv.setUint16(10, polozky.length, true);
    kv.setUint32(12, cdVel, true); kv.setUint32(16, offset, true);
    return casti.concat(centralni, [konec]);
  }
  function spoj(casti) {
    const n = casti.reduce((s, c) => s + c.length, 0), u = new Uint8Array(n); let o = 0;
    for (const c of casti) { u.set(c, o); o += c.length; }
    return u;
  }
  async function inflateRaw(data) {
    if (typeof DecompressionStream === 'undefined') throw new Error('Tento prohlížeč neumí rozbalit komprimovaný ZIP. Použijte zálohu vytvořenou touto aplikací.');
    const s = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  /* Čte ZIP z centrálního adresáře; ověřuje CRC. Podporuje metodu 0 (uloženo) a 8 (deflate). Vrací [{name, data}]. */
  async function ctiZip(u8) {
    if (!(u8 instanceof Uint8Array)) u8 = new Uint8Array(u8);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let e = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 22 - 65535); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('Soubor není platný ZIP (chybí konec centrálního adresáře).');
    const pocet = dv.getUint16(e + 10, true), cdOff = dv.getUint32(e + 16, true);
    if (pocet === 0xFFFF || cdOff === 0xFFFFFFFF) throw new Error('ZIP64 není podporován.');
    const dec = new TextDecoder('utf-8');
    const out = [];
    let o = cdOff;
    for (let i = 0; i < pocet; i++) {
      if (o + 46 > u8.length || dv.getUint32(o, true) !== 0x02014b50) throw new Error('Poškozený centrální adresář ZIP.');
      const metoda = dv.getUint16(o + 10, true), crc = dv.getUint32(o + 16, true);
      const komp = dv.getUint32(o + 20, true), vel = dv.getUint32(o + 24, true);
      const nl = dv.getUint16(o + 28, true), xl = dv.getUint16(o + 30, true), kl = dv.getUint16(o + 32, true);
      const lokOff = dv.getUint32(o + 42, true);
      const name = dec.decode(u8.subarray(o + 46, o + 46 + nl));
      o += 46 + nl + xl + kl;
      if (dv.getUint32(lokOff, true) !== 0x04034b50) throw new Error('Poškozená hlavička souboru ' + name + '.');
      const start = lokOff + 30 + dv.getUint16(lokOff + 26, true) + dv.getUint16(lokOff + 28, true);
      if (start + komp > u8.length) throw new Error('Soubor ' + name + ' je v ZIPu useknutý.');
      const surova = u8.subarray(start, start + komp);
      if (name.endsWith('/')) continue;
      let data;
      if (metoda === 0) data = surova;
      else if (metoda === 8) data = await inflateRaw(surova);
      else throw new Error('Nepodporovaná komprese (' + metoda + ') u ' + name + '.');
      if (data.length !== vel) throw new Error('Nesouhlasí velikost souboru ' + name + '.');
      if (crc32(data) !== crc) throw new Error('Kontrolní součet CRC32 nesouhlasí u ' + name + ' – záloha je poškozená.');
      out.push({ name, data });
    }
    return out;
  }

  /* ---------- záloha: manifest a slučování ---------- */
  function bezpecneJmeno(s) {
    const t = bezDiakritiky(s).replace(/[^a-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
    return t || 'soubor';
  }
  /* Plán sloučení: u stejného ID vyhraje novější „upraveno“; nové záznamy se přidají; číselníky podle ID. */
  function planSlouceni(stav, zaloha) {
    const plan = { polozky: { pridat: [], prepsat: [], ponechat: 0 }, ciselniky: { pridat: 0 }, prilohy: { pridat: [], ponechat: 0 } };
    const mam = new Map(stav.polozky.map(p => [p.id, p]));
    for (const p of zaloha.polozky) {
      const m = mam.get(p.id);
      if (!m) plan.polozky.pridat.push(p);
      else if ((p.upraveno || 0) > (m.upraveno || 0)) plan.polozky.prepsat.push(p);
      else plan.polozky.ponechat++;
    }
    plan.ciselnikyPridat = {};
    for (const k of ['lokality', 'mistnosti', 'kategorie']) {
      const ids = new Set((stav[k] || []).map(x => x.id));
      plan.ciselnikyPridat[k] = (zaloha[k] || []).filter(x => !ids.has(x.id));
      plan.ciselniky.pridat += plan.ciselnikyPridat[k].length;
    }
    const pids = new Set((stav.prilohy || []).map(a => a.id));
    for (const a of zaloha.prilohy || []) { if (pids.has(a.id)) plan.prilohy.ponechat++; else plan.prilohy.pridat.push(a); }
    return plan;
  }

  /* ---------- iCalendar: připomínka konce záruky do vlastního kalendáře ---------- */
  function icsText(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function icsZalom(radek) {
    const enc = new TextEncoder(); const out = []; let akt = '', del = 0;
    for (const ch of radek) {
      const b = enc.encode(ch).length;
      if (del + b > (out.length ? 74 : 75)) { out.push(akt); akt = ''; del = 0; }
      akt += ch; del += b;
    }
    out.push(akt);
    return out.join('\r\n ');
  }
  function ics(polozky, dnyPredem, razitko) {
    const r = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//webapp//Evidence majetku//CS', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    const ts = razitko || '20000101T000000Z';
    for (const p of polozky) {
      const z = zaruka(p); if (!z) continue;
      const d = z.posledniDen.replace(/-/g, '');
      r.push('BEGIN:VEVENT', 'UID:zaruka-' + p.id + '@majetek.local', 'DTSTAMP:' + ts,
        'DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + pridejDny(z.posledniDen, 1).replace(/-/g, ''),
        'SUMMARY:' + icsText('Konec záruky: ' + p.nazev),
        'DESCRIPTION:' + icsText('Položka ' + p.id + (p.vyrobce || p.model ? ' (' + [p.vyrobce, p.model].filter(Boolean).join(' ') + ')' : '') +
          (p.prodejce ? '\nProdejce: ' + p.prodejce : '') + '\nPoslední den pro uplatnění práv z vadného plnění: ' + formatDatum(z.posledniDen)));
      if (dnyPredem > 0) r.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsText('Blíží se konec záruky: ' + p.nazev), 'TRIGGER:-P' + Math.round(dnyPredem) + 'D', 'END:VALARM');
      r.push('END:VEVENT');
    }
    r.push('END:VCALENDAR');
    return r.map(icsZalom).join('\r\n') + '\r\n';
  }

  const API = {
    SCHEMA, VYCHOZI_ZARUKA, TYPY_PRILOH, NAZVY_PRILOH, NAZVY_STAVU, SLOUPCE_CSV,
    jeDatum, jePrestupny, dniVMesici, pridejDny, rozdilDni, dnesIso, denVTydnu, pridejMesice,
    velikonoce, svatky, jePracovniDen, posunNaPracovni, zaruka, stavZaruky,
    cislo, formatCislo, formatKc, formatDatum, velikost, bezDiakritiky, normStitky, novyId, idZeSkenu, textQr,
    normPolozka, migruj, kontext, nazevMista, filtruj, serad, souhrn,
    csvBunka, csv, ctiCsv, crc32, zapisZip, spoj, ctiZip, bezpecneJmeno, planSlouceni, ics, icsText, icsZalom
  };
  if (typeof module !== 'undefined') module.exports = API; else window.MajetekJadro = API;
})();
