/* Evidenční deník důkazů – jádro bez DOM (test: _test/evidence_log_test.js).
   Inkrementální SHA-256 po blocích (velké soubory bez načtení celého do paměti), normalizace
   záznamů (zpětně kompatibilní s {id,time,num,desc,place,by,handover,hash,note}), kontrola
   řetězce předávání (chain of custody), import/export JSON a CSV, data modelového případu 17/2026. */
(function () {
  'use strict';

  const VERZE = 2;
  const DRUHY = [
    ['biologicka', 'biologická'], ['daktyloskopicka', 'daktyloskopická'], ['trasologicka', 'trasologická'],
    ['mechanoskopicka', 'mechanoskopická'], ['digitalni', 'digitální'], ['listinna', 'listinná'],
    ['vecna', 'věcná'], ['dopravni', 'dopravní'], ['jina', 'jiná']
  ];
  const STAVY = [
    ['zajisteno', 'zajištěno'], ['ulozeno', 'uloženo v úschově'], ['expertiza', 'odesláno na expertizu'],
    ['zpracovani', 've zpracování'], ['vraceno', 'vráceno z expertizy'], ['vydano', 'vydáno oprávněné osobě'],
    ['zniceno', 'zničeno / skartováno']
  ];
  const OBALY = [['neporusen', 'neporušen'], ['porusen', 'porušen'], ['nezjisteno', 'nezjištěno']];
  const nazev = (seznam, k) => (seznam.find(x => x[0] === k) || [k, k || ''])[1];

  /* ---------- SHA-256 po blocích ---------- */
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);

  function Sha256() {
    this.h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    this.w = new Uint32Array(64);
    this.buf = new Uint8Array(64); this.nbuf = 0; this.delka = 0;
  }
  Sha256.prototype.blok = function (b, o) {
    const w = this.w, h = this.h;
    for (let i = 0; i < 16; i++) w[i] = (b[o + 4 * i] << 24) | (b[o + 4 * i + 1] << 16) | (b[o + 4 * i + 2] << 8) | b[o + 4 * i + 3];
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15], y = w[i - 2];
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let a = h[0], bb = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const t1 = (hh + S1 + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const t2 = (S0 + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
    }
    h[0] += a; h[1] += bb; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  };
  Sha256.prototype.update = function (data) {
    let i = 0;
    const n = data.length;
    this.delka += n;
    if (this.nbuf) {
      while (i < n && this.nbuf < 64) this.buf[this.nbuf++] = data[i++];
      if (this.nbuf < 64) return this;
      this.blok(this.buf, 0); this.nbuf = 0;
    }
    for (; i + 64 <= n; i += 64) this.blok(data, i);
    while (i < n) this.buf[this.nbuf++] = data[i++];
    return this;
  };
  Sha256.prototype.hex = function () {
    const bity = this.delka * 8;
    const konec = new Uint8Array(this.nbuf < 56 ? 64 - this.nbuf : 128 - this.nbuf);
    konec[0] = 0x80;
    const hi = Math.floor(bity / 0x100000000), lo = bity >>> 0;
    const L = konec.length;
    konec[L - 8] = hi >>> 24; konec[L - 7] = hi >>> 16; konec[L - 6] = hi >>> 8; konec[L - 5] = hi;
    konec[L - 4] = lo >>> 24; konec[L - 3] = lo >>> 16; konec[L - 2] = lo >>> 8; konec[L - 1] = lo;
    const d = this.delka; this.update(konec); this.delka = d;
    return Array.from(this.h, x => x.toString(16).padStart(8, '0')).join('');
  };
  const sha256 = data => new Sha256().update(data).hex();

  // otisk souboru (Blob/File): malé přes crypto.subtle, velké (nebo bez subtle) po blocích
  const LIMIT_SUBTLE = 64 * 1024 * 1024, BLOK = 4 * 1024 * 1024;
  async function otiskSouboru(soubor, prubeh) {
    const subtle = typeof crypto !== 'undefined' && crypto.subtle;
    if (subtle && soubor.size <= LIMIT_SUBTLE) {
      const h = await subtle.digest('SHA-256', await soubor.arrayBuffer());
      if (prubeh) prubeh(1);
      return Array.from(new Uint8Array(h), b => b.toString(16).padStart(2, '0')).join('');
    }
    const s = new Sha256();
    for (let o = 0; o < soubor.size; o += BLOK) {
      s.update(new Uint8Array(await soubor.slice(o, o + BLOK).arrayBuffer()));
      if (prubeh) prubeh(Math.min(1, (o + BLOK) / soubor.size));
    }
    return s.hex();
  }
  const jeSha256 = h => /^[0-9a-f]{64}$/i.test(String(h || '').trim());
  const stejnyOtisk = (a, b) => jeSha256(a) && String(a).trim().toLowerCase() === String(b || '').trim().toLowerCase();

  /* ---------- záznamy ---------- */
  let citac = 0;
  const novyId = () => Date.now().toString(36) + (citac++).toString(36) + Math.random().toString(36).slice(2, 6);
  const t16 = s => String(s || '').trim().slice(0, 16);   // 'YYYY-MM-DDTHH:MM' – porovnatelné jako text
  const tx = v => (v == null ? '' : String(v));

  // doplní nová pole, stará (time, num, desc, place, by, handover, hash, note) ponechá beze změny
  function normalizuj(it) {
    const o = Object.assign({}, it || {});
    o.id = o.id == null || o.id === '' || typeof o.id === 'object' ? novyId() : String(o.id);   // číselné id z importu → text (data-id)
    ['time', 'num', 'desc', 'place', 'by', 'handover', 'hash', 'note'].forEach(k => { o[k] = tx(o[k]); });
    if (!o.druh) o.druh = jeSha256(o.hash) ? 'digitalni' : '';
    if (!o.stav) o.stav = 'zajisteno';
    o.predani = Array.isArray(o.predani) ? o.predani.filter(p => p && typeof p === 'object').map(p => ({
      kdy: tx(p.kdy), od: tx(p.od), komu: tx(p.komu), ucel: tx(p.ucel), obal: tx(p.obal), pozn: tx(p.pozn)
    })) : [];
    return o;
  }

  // nad spisem (S2) je v poli handover jen obal/pečeť (stopa.data.obal), ne uložení – držitel z něj neplyne
  let rezimSpisu = false;
  const nastavSpis = b => { rezimSpisu = !!b; };
  // aktuální držitel / umístění: poslední předání, jinak staré pole „Předáno / uloženo“ (jen bez spisu), jinak kdo zajistil
  // (nad spisem stejně jako Terén: poslední převzetí, jinak kdo zajistil)
  function drzitel(it) {
    const p = it.predani && it.predani[it.predani.length - 1];
    return (p && p.komu) || (!rezimSpisu && it.handover) || it.by || '';
  }

  const stejnaOsoba = (a, b) => String(a || '').trim().toLowerCase().replace(/\s+/g, ' ') === String(b || '').trim().toLowerCase().replace(/\s+/g, ' ');

  // kontrola úplnosti a návaznosti řetězce; vrací [{uroven:'chyba'|'pozor', text}]
  function kontrola(it, ted) {
    const v = [], add = (uroven, text) => v.push({ uroven, text });
    ted = ted || '';
    const t0 = t16(it.time);
    if (!t0) add('pozor', 'chybí datum a čas zajištění');
    else if (ted && t0 > ted) add('chyba', 'čas zajištění je v budoucnosti');
    if (!String(it.by || '').trim()) add('pozor', 'chybí, kdo stopu zajistil');
    if (!String(it.num || '').trim()) add('pozor', 'chybí číslo stopy');
    if (it.stav && it.stav !== 'zajisteno' && !(it.predani || []).length && (rezimSpisu || !String(it.handover || '').trim())) add('pozor', 'stav „' + nazev(STAVY, it.stav) + '“, ale není zapsané žádné předání ani uložení');
    if (it.druh === 'digitalni' && !jeSha256(it.hash)) add('pozor', 'digitální stopa bez otisku SHA-256');
    if (it.hash && !jeSha256(it.hash)) add('pozor', 'otisk není platný SHA-256 (64 hex znaků)');
    let drz = it.by, pred = t0;
    (it.predani || []).forEach((p, i) => {
      const c = 'předání ' + (i + 1) + ': ', k = t16(p.kdy);
      const chybi = [['kdy', 'čas'], ['od', 'kdo předal'], ['komu', 'komu']].filter(x => !String(p[x[0]] || '').trim()).map(x => x[1]);
      if (chybi.length) add('chyba', c + 'chybí ' + chybi.join(', '));
      if (!String(p.ucel || '').trim()) add('pozor', c + 'chybí účel');
      if (!p.obal || p.obal === 'nezjisteno') add('pozor', c + 'stav obalu/pečeti nezaznamenán');
      if (p.obal === 'porusen') add('chyba', c + 'porušený obal nebo pečeť');
      if (k && t0 && k < t0) add('chyba', c + 'čas je dřív než zajištění stopy');
      else if (k && pred && k < pred) add('chyba', c + 'čas je dřív než předchozí předání');
      if (k && ted && k > ted) add('chyba', c + 'čas je v budoucnosti');
      if (p.od && drz && !stejnaOsoba(p.od, drz)) add('chyba', c + 'předal „' + p.od + '“, ale stopu měl „' + drz + '“ (mezera v řetězci)');
      if (p.od && p.komu && stejnaOsoba(p.od, p.komu)) add('pozor', c + 'předávající a přebírající je tatáž osoba');
      if (p.komu) drz = p.komu;
      if (k) pred = k;
    });
    return v;
  }

  /* ---------- import / export ---------- */
  // přijme starý formát {case, items}, nový {format, verze, case, items} i holé pole
  function importuj(data) {
    if (typeof data === 'string') data = JSON.parse(data);
    let pripad = '', items;
    if (Array.isArray(data)) items = data;
    else if (data && Array.isArray(data.items)) { items = data.items; pripad = tx(data.case); }
    else throw new Error('Soubor neobsahuje evidenční deník (chybí pole items).');
    return { case: pripad, items: items.filter(x => x && typeof x === 'object').map(normalizuj) };
  }
  // sloučení s existujícími: stejné id = nahradit, jinak přidat
  function slouc(stare, nove) {
    const out = stare.slice();
    nove.forEach(n => { const i = out.findIndex(x => x.id === n.id); if (i >= 0) out[i] = n; else out.push(n); });
    return out;
  }
  const exportJson = (pripad, items) => JSON.stringify({ format: 'evidence_log', verze: VERZE, case: pripad, exportovano: new Date().toISOString(), items }, null, 2);

  const formatCas = s => { const m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/.exec(s || ''); return m ? `${+m[3]}. ${+m[2]}. ${m[1]} ${m[4]}:${m[5]}` : tx(s); };
  const retezecText = it => (it.predani || []).map(p => `${formatCas(p.kdy)} ${p.od} → ${p.komu}${p.ucel ? ' (' + p.ucel + ')' : ''}${p.obal ? ' [obal ' + nazev(OBALY, p.obal) + ']' : ''}`).join('; ');

  // CSV injection (OWASP): buňku začínající = + - @ tab CR (i za apostrofy) prefixovat apostrofem, čísla ne
  const bezVzorce = s => (/^'*[=+\-@\t\r]/.test(s) && !/^[+-]?\d+([.,]\d+)?$/.test(s) ? "'" + s : s);
  function csv(items) {
    const e = v => '"' + bezVzorce(tx(v)).replace(/"/g, '""') + '"';
    const hlava = ['Č.', 'Datum/čas zajištění', 'Druh', 'Popis', 'Místo nálezu', 'Zajistil', 'Stav', 'Aktuální umístění', 'SHA-256', 'Soubor', 'Řetězec předání', 'Upozornění', 'Poznámka'];
    const r = [hlava.map(e).join(';')];
    seradit(items, 'time', 1).forEach(it => r.push([it.num, formatCas(it.time), nazev(DRUHY, it.druh), it.desc, it.place, it.by,
      nazev(STAVY, it.stav), drzitel(it), it.hash, it.soubor ? it.soubor.nazev : '', retezecText(it),
      kontrola(it).map(x => x.text).join('; '), it.note].map(e).join(';')));
    return '﻿' + r.join('\r\n');
  }

  /* ---------- řazení a filtr ---------- */
  // přirozené řazení čísel stop (D-2 před D-10)
  const porovnej = (a, b) => tx(a).localeCompare(tx(b), 'cs', { numeric: true, sensitivity: 'base' });
  function seradit(items, sloupec, smer) {
    const klic = {
      num: x => x.num, time: x => x.time, druh: x => nazev(DRUHY, x.druh), desc: x => x.desc, by: x => x.by,
      stav: x => nazev(STAVY, x.stav), drzitel: drzitel, kontrola: x => String(kontrola(x).length).padStart(3, '0')
    }[sloupec] || (x => x.time);
    return items.slice().sort((a, b) => (porovnej(klic(a), klic(b)) || porovnej(a.num, b.num)) * (smer < 0 ? -1 : 1));
  }
  function filtr(items, { hledat, druh, stav, jenProblemy } = {}) {
    const q = String(hledat || '').trim().toLowerCase();
    return items.filter(it => (!druh || it.druh === druh) && (!stav || it.stav === stav) &&
      (!jenProblemy || kontrola(it).length) &&
      (!q || [it.num, it.desc, it.place, it.by, it.handover, it.hash, it.note, drzitel(it), retezecText(it)].join(' ').toLowerCase().includes(q)));
  }

  // text QR štítku: identifikace stopy a otisk (bez popisu – ten je na štítku čitelně)
  // s diakritikou (lib/qrcode.min.js kóduje UTF-8 správně – test _test/qr_diakritika_test.py)
  const qrText = (it, pripad) => tx(['EVID', 'Spis: ' + tx(pripad), 'Stopa: ' + it.num, 'ID: ' + it.id,
    jeSha256(it.hash) ? 'SHA-256: ' + it.hash.trim().toLowerCase() : ''].filter(Boolean).join('\n'));

  /* ---------- modelový případ 17/2026 ---------- */
  // posun 'YYYY-MM-DDTHH:MM' o h hodin (čas bez pásma, počítáno jako UTC)
  function plusHodin(s, h) {
    const m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/.exec(s || '');
    if (!m) return '';
    const d = new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]) + h * 3600e3);
    return d.toISOString().slice(0, 16);
  }
  function druhZTextu(t) {
    t = String(t || '').toLowerCase();
    const d = DRUHY.find(x => t.startsWith(x[1].slice(0, 5)));
    return d ? d[0] : 'jina';
  }
  // řetězec odvozený z dat spisu: zajistil → úschovna (obal neporušen) → zpracovatel podle stavu
  function zPripadu(P) {
    const USCHOVNA = 'úschovna věcných důkazů OOP Horní Lhota (fiktivní)';
    return P.dukazy.map(d => {
      const exp = /odesl/i.test(d.stav);
      return normalizuj({
        id: 'mp' + d.c, time: d.kdy, num: 'D-0' + d.c, desc: d.nazev + ' (' + d.druh + ')', place: d.misto, by: d.zajistil,
        handover: d.obal, hash: d.sha256 || '', note: d.stav, druh: druhZTextu(d.druh), stav: exp ? 'expertiza' : 'zpracovani',
        predani: [
          { kdy: plusHodin(d.kdy, 2), od: d.zajistil, komu: USCHOVNA, ucel: 'uložení do úschovny', obal: 'neporusen', pozn: d.obal },
          { kdy: plusHodin(d.kdy, 6), od: USCHOVNA, komu: exp ? 'KÚP – odbor kriminalistické techniky a expertiz (fiktivní)' : 'nprap. Jana Modelová (fiktivní)',
            ucel: d.stav, obal: 'neporusen', pozn: '' }
        ]
      });
    });
  }

  /* ---------- jednotný spis (S2): záznam deníku ↔ entita `stopa` ----------
     cislo↔num, nazev↔desc, druh/stav (text spisu)↔klíč deníku, misto↔place, zajistil↔by, kdy↔time, obal↔handover,
     sha256↔hash, popis↔note, predani[]↔predani[]; navíc souborDeniku a overeno. Neznámá pole spisu se zachovají;
     text druhu/stavu ze spisu se nepřepíše, dokud se v deníku nezmění. Neplatný čas/otisk jde do kdyText/otiskText. */
  const RE_CAS_SPIS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
  const bezD = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  function druhZeSpisu(t) {
    if (!String(t || '').trim()) return '';
    if (DRUHY.some(x => x[0] === t)) return t;
    const d = DRUHY.find(x => bezD(t).startsWith(bezD(x[1]).slice(0, 5)));
    return d ? d[0] : 'jina';
  }
  function stavZeSpisu(t) {
    const b = bezD(t);
    if (!b) return 'zajisteno';
    const s = STAVY.find(x => x[0] === t || bezD(x[1]) === b);
    if (s) return s[0];
    if (/odesl|expert|kup|dna/.test(b)) return 'expertiza';
    if (/vracen/.test(b)) return 'vraceno';
    if (/vydan/.test(b)) return 'vydano';
    if (/znicen|skart/.test(b)) return 'zniceno';
    if (/uschov|ulozen/.test(b)) return 'ulozeno';
    if (/zajisten/.test(b)) return 'zajisteno';
    return 'zpracovani';
  }
  function zeSpisu(e) {
    const d = (e && e.data) || {};
    return normalizuj({
      id: e.id, time: d.kdy || d.kdyText || '', num: d.cislo || '', desc: e.nazev, place: d.misto, by: d.zajistil, handover: d.obal,
      hash: d.sha256 || d.otiskText || '', note: d.popis, druh: druhZeSpisu(d.druh), stav: stavZeSpisu(d.stav),
      predani: d.predani, soubor: d.souborDeniku, overeno: d.overeno
    });
  }
  function doSpisu(it, puvodni) {
    const pd = (puvodni && puvodni.data) || {};
    const ponech = (k, klic, f) => pd[k] && f(pd[k]) === klic ? pd[k] : undefined;
    const cas = tx(it.time).trim(), casOk = RE_CAS_SPIS.test(cas), otisk = tx(it.hash).trim();
    const prazdne = v => (v === '' || v == null ? undefined : v);
    const data = Object.assign({}, pd, {
      cislo: prazdne(tx(it.num).trim()),
      druh: it.druh ? ponech('druh', it.druh, druhZeSpisu) || nazev(DRUHY, it.druh) + ' stopa' : undefined,
      misto: prazdne(it.place), zajistil: prazdne(it.by), obal: prazdne(it.handover), popis: prazdne(it.note),
      kdy: casOk ? cas : undefined, kdyText: !casOk && cas ? cas : undefined,
      stav: ponech('stav', it.stav, stavZeSpisu) || nazev(STAVY, it.stav || 'zajisteno'),
      sha256: jeSha256(otisk) ? otisk.toLowerCase() : undefined, otiskText: otisk && !jeSha256(otisk) ? otisk : undefined,
      predani: (it.predani || []).length ? it.predani.map(p => Object.assign({}, p)) : undefined,
      souborDeniku: it.soubor || undefined, overeno: it.overeno || undefined
    });
    const nz = tx(it.desc).trim() || (tx(it.num).trim() ? 'Stopa ' + tx(it.num).trim() : 'Stopa');
    return { id: it.id, typ: 'stopa', nazev: nz.slice(0, 300), data };
  }
  // klíč pro porovnání „změnilo se v deníku něco?“ (pořadí polí z normalizuj je stálé)
  const klicZaznamu = it => JSON.stringify(it);

  const api = {
    VERZE, DRUHY, STAVY, OBALY, nazev, Sha256, sha256, otiskSouboru, LIMIT_SUBTLE, jeSha256, stejnyOtisk,
    novyId, normalizuj, drzitel, nastavSpis, kontrola, importuj, slouc, exportJson, csv, formatCas, retezecText,
    seradit, filtr, qrText, plusHodin, druhZTextu, zPripadu,
    druhZeSpisu, stavZeSpisu, zeSpisu, doSpisu, klicZaznamu
  };
  if (typeof module !== 'undefined') module.exports = api;
  else window.EvidenceJadro = api;
})();
