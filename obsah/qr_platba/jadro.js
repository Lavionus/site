/* ============================================================
   qr_platba/jadro.js – platební QR kódy bez DOM (běží i v node).

   • QR Platba (SPAYD 1.0, Česká bankovní asociace) – CZ banky
   • PAY by square 1.1 (Slovenská banková asociácia) – SK banky
   • EPC QR / GiroCode (European Payments Council, verze 002) – SEPA v EUR

   Navíc převod českého čísla účtu na IBAN (vč. kontroly modulo 11),
   rozpoznání platebních údajů z volného textu a čtení SPAYD/EPC
   zpět do formuláře.
   ============================================================ */
(function (koren) {
  'use strict';

  /* ---------- pomocné ---------- */
  const TABULKA_CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bajty) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bajty.length; i++) c = TABULKA_CRC[(c ^ bajty[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function utf8(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
    return Uint8Array.from(Buffer.from(s, 'utf8'));
  }
  function bezDiakritiky(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function cista(s) { return String(s == null ? '' : s).trim(); }

  /* ---------- banky ČR (číselník kódů ČNB, výběr) ---------- */
  const BANKY = {
    '0100': 'Komerční banka', '0300': 'ČSOB', '0600': 'MONETA Money Bank', '0710': 'Česká národní banka',
    '0800': 'Česká spořitelna', '2010': 'Fio banka', '2060': 'Citfin', '2070': 'TRINITY BANK',
    '2100': 'Hypoteční banka', '2200': 'Peněžní dům', '2220': 'Artesa', '2250': 'Banka CREDITAS',
    '2260': 'NEY spořitelní družstvo', '2600': 'Citibank Europe', '2700': 'UniCredit Bank',
    '3030': 'Air Bank', '3050': 'BNP Paribas Personal Finance', '3060': 'PKO BP', '3500': 'ING Bank',
    '4000': 'Max banka', '4300': 'Národní rozvojová banka', '5500': 'Raiffeisenbank', '5800': 'J&T BANKA',
    '6000': 'PPF banka', '6100': 'Raiffeisenbank (dříve Equa bank)', '6200': 'COMMERZBANK', '6210': 'mBank',
    '6300': 'BNP Paribas', '6363': 'Partners Banka', '6700': 'Všeobecná úverová banka', '7910': 'Deutsche Bank',
    '7950': 'Raiffeisen stavební spořitelna', '7960': 'ČSOB Stavební spořitelna', '7970': 'MONETA Stavební Spořitelna',
    '7990': 'Modrá pyramida stavební spořitelna', '8030': 'Volksbank Raiffeisenbank Nordoberpfalz',
    '8040': 'Oberbank', '8060': 'Stavební spořitelna České spořitelny', '8090': 'Česká exportní banka',
    '8150': 'HSBC Continental Europe', '8250': 'Bank of China', '8265': 'ICBC'
  };

  /* ---------- čísla účtů a IBAN ---------- */
  const VAHY = [6, 3, 7, 9, 10, 5, 8, 4, 2, 1];
  /** Kontrola modulo 11 (vyhláška ČNB 169/2011) – číslo doplněné nulami zleva na 10 míst. */
  function mod11(cislo) {
    const s = String(cislo).padStart(10, '0');
    let suma = 0;
    for (let i = 0; i < 10; i++) suma += Number(s[i]) * VAHY[i];
    return suma % 11 === 0;
  }
  function mod97(retezec) {
    let zb = 0;
    for (const ch of retezec) {
      const v = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
      for (const d of v) zb = (zb * 10 + Number(d)) % 97;
    }
    return zb;
  }
  /** IBAN bez mezer, velkými písmeny. */
  function ibanNormalizuj(s) { return String(s || '').replace(/[\s-]/g, '').toUpperCase(); }
  const DELKY_IBAN = { CZ: 24, SK: 24, AT: 20, DE: 22, PL: 28, HU: 28, GB: 22, FR: 27, IT: 27, ES: 24, NL: 18, BE: 16, LT: 20, LV: 21, EE: 20, IE: 22, SI: 19, HR: 21, FI: 18, PT: 25, LU: 20, CH: 21, BG: 22, RO: 24, DK: 18, SE: 24, NO: 15 };
  function ibanPlatny(iban) {
    const s = ibanNormalizuj(iban);
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(s)) return false;
    const d = DELKY_IBAN[s.slice(0, 2)];
    if (d && s.length !== d) return false;
    return mod97(s.slice(4) + s.slice(0, 4)) === 1;
  }
  function ibanFormat(iban) { return ibanNormalizuj(iban).replace(/(.{4})(?=.)/g, '$1 '); }

  /** Rozbor „předčíslí-číslo/kód" → {predcisli, cislo, kod} nebo null. */
  function rozeberCzUcet(text) {
    const m = String(text || '').replace(/\s+/g, '').match(/^(?:(\d{1,6})-)?(\d{1,10})\/(\d{4})$/);
    if (!m) return null;
    return { predcisli: m[1] || '', cislo: m[2], kod: m[3] };
  }
  function czUcetNaIban(predcisli, cislo, kod) {
    const bban = String(kod).padStart(4, '0') + String(predcisli || '').padStart(6, '0') + String(cislo).padStart(10, '0');
    const kontrola = 98 - mod97(bban + 'CZ00');
    return 'CZ' + String(kontrola).padStart(2, '0') + bban;
  }
  function ibanNaCzUcet(iban) {
    const s = ibanNormalizuj(iban);
    if (!/^CZ\d{22}$/.test(s)) return null;
    const kod = s.slice(4, 8), pred = s.slice(8, 14).replace(/^0+/, ''), cis = s.slice(14).replace(/^0+/, '');
    return (pred ? pred + '-' : '') + (cis || '0') + '/' + kod;
  }

  /**
   * Libovolný zápis účtu → {iban, ucetCz, banka, chyby[], varovani[]}.
   * Přijímá „123-4567890/0100", „4567890/0100" i IBAN (s mezerami).
   */
  function zpracujUcet(text) {
    const vys = { iban: '', ucetCz: '', banka: '', chyby: [], varovani: [] };
    const t = cista(text);
    if (!t) { vys.chyby.push('Chybí číslo účtu.'); return vys; }
    const cz = rozeberCzUcet(t);
    if (cz) {
      if (cz.predcisli && !mod11(cz.predcisli)) vys.chyby.push('Předčíslí neprošlo kontrolou modulo 11 – překlep?');
      if (!mod11(cz.cislo)) vys.chyby.push('Číslo účtu neprošlo kontrolou modulo 11 – překlep?');
      if (Number(cz.cislo) === 0) vys.chyby.push('Číslo účtu nesmí být nulové.');
      vys.iban = czUcetNaIban(cz.predcisli, cz.cislo, cz.kod);
      vys.ucetCz = (cz.predcisli ? cz.predcisli.replace(/^0+/, '') + '-' : '') + cz.cislo.replace(/^0+/, '') + '/' + cz.kod;
      vys.banka = BANKY[cz.kod] || '';
      if (!vys.banka) vys.varovani.push('Kód banky ' + cz.kod + ' nemám v seznamu – zkontroluj ho (nové banky v seznamu chybět můžou).');
      return vys;
    }
    const iban = ibanNormalizuj(t);
    if (/^[A-Z]{2}\d{2}/.test(iban)) {
      if (!ibanPlatny(iban)) { vys.chyby.push('IBAN nemá platný kontrolní součet nebo délku.'); vys.iban = iban; return vys; }
      vys.iban = iban;
      const zpet = ibanNaCzUcet(iban);
      if (zpet) {
        vys.ucetCz = zpet;
        const p = rozeberCzUcet(zpet);
        vys.banka = BANKY[p.kod] || '';
        if (!mod11(p.cislo) || (p.predcisli && !mod11(p.predcisli))) vys.chyby.push('Číslo účtu v IBANu neprošlo kontrolou modulo 11.');
      }
      return vys;
    }
    vys.chyby.push('Nerozumím zápisu účtu. Použij tvar 123-4567890/0100 nebo IBAN.');
    return vys;
  }

  /* ---------- částka ---------- */
  /** „1 250,50" / „1.250,50" / „1250.5" / „1,250.50" → 1250.5 (nebo NaN). */
  function parsujCastku(s) {
    let t = String(s == null ? '' : s).replace(/[\s  ']/g, '').replace(/(Kč|CZK|EUR|€|,-|\.-)$/i, '');
    if (!t) return NaN;
    if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(t)) t = t.replace(/,/g, '');
    else t = t.replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return NaN;
    return Number(t);
  }
  function castkaRetezec(n) { return (Math.round(n * 100) / 100).toFixed(2); }

  /* ---------- kontrola údajů platby ---------- */
  /**
   * platba = {ucet, castka, mena, vs, ks, ss, zprava, prijemce, splatnost (YYYY-MM-DD), bic}
   * → {ucet: výsledek zpracujUcet, castka: číslo|null, chyby[], varovani[]}
   */
  function zkontroluj(platba, format) {
    const p = platba || {};
    const ucet = zpracujUcet(p.ucet);
    const chyby = ucet.chyby.slice(), varovani = ucet.varovani.slice();
    let castka = null;
    if (cista(p.castka)) {
      castka = parsujCastku(p.castka);
      if (!isFinite(castka)) { chyby.push('Částka není číslo (nejvýš 2 desetinná místa).'); castka = null; }
      else if (castka <= 0) { chyby.push('Částka musí být kladná.'); castka = null; }
      else if (castka > 9999999.99) { chyby.push('Částka je příliš velká (max. 9 999 999,99).'); castka = null; }
    }
    for (const [k, nazev] of [['vs', 'Variabilní'], ['ss', 'Specifický'], ['ks', 'Konstantní']]) {
      const v = cista(p[k]);
      if (v && !/^\d{1,10}$/.test(v)) chyby.push(nazev + ' symbol smí mít jen číslice (max. 10).');
    }
    if (cista(p.splatnost) && !/^\d{4}-\d{2}-\d{2}$/.test(cista(p.splatnost))) chyby.push('Datum splatnosti není ve tvaru RRRR-MM-DD.');
    const f = format || 'cz';
    if (f === 'epc') {
      if ((p.mena || 'CZK') !== 'EUR') chyby.push('EPC QR (SEPA) umí jen platby v eurech.');
      if (!cista(p.prijemce)) chyby.push('EPC QR vyžaduje jméno příjemce.');
      if (cista(p.ks) || cista(p.ss) || cista(p.splatnost)) varovani.push('EPC QR nemá pole pro KS, SS ani splatnost – nebudou v kódu.');
    }
    if (f === 'sk') {
      if (!cista(p.prijemce)) varovani.push('Slovenské banky od 2025 vyžadují jméno příjemce – doplň ho.');
    }
    if (f === 'cz' && cista(p.zprava).length > 60) varovani.push('Zpráva bude zkrácena na 60 znaků.');
    if (f === 'cz' && cista(p.prijemce).length > 35) varovani.push('Jméno příjemce bude zkráceno na 35 znaků.');
    if (ucet.iban && !ucet.iban.startsWith('CZ') && f === 'cz') varovani.push('Zahraniční IBAN – česká banka platbu může zpracovat jako zahraniční (SEPA).');
    return { ucet, castka, chyby, varovani };
  }

  /* ---------- QR Platba (SPAYD) ---------- */
  function spaydEsc(s) { return String(s).replace(/\*/g, '%2A'); }
  /**
   * Sestaví řetězec QR Platby. moznosti.diakritika=false → bez háčků a čárek
   * (spolehlivější u starších aplikací, menší kód).
   */
  function spayd(platba, moznosti) {
    const o = Object.assign({ diakritika: false }, moznosti);
    const k = zkontroluj(platba, 'cz');
    if (k.chyby.length) throw new Error(k.chyby[0]);
    const t = s => spaydEsc(o.diakritika ? cista(s) : bezDiakritiky(cista(s)));
    const casti = ['SPD', '1.0', 'ACC:' + k.ucet.iban + (cista(platba.bic) ? '+' + cista(platba.bic).toUpperCase() : '')];
    if (k.castka != null) casti.push('AM:' + castkaRetezec(k.castka));
    casti.push('CC:' + (platba.mena || 'CZK'));
    if (cista(platba.splatnost)) casti.push('DT:' + cista(platba.splatnost).replace(/-/g, ''));
    if (cista(platba.prijemce)) casti.push('RN:' + t(platba.prijemce).slice(0, 35));
    if (cista(platba.zprava)) casti.push('MSG:' + t(platba.zprava).slice(0, 60));
    if (cista(platba.vs)) casti.push('X-VS:' + cista(platba.vs));
    if (cista(platba.ss)) casti.push('X-SS:' + cista(platba.ss));
    if (cista(platba.ks)) casti.push('X-KS:' + cista(platba.ks));
    return casti.join('*');
  }

  /* ---------- EPC QR (SEPA Credit Transfer) ---------- */
  function epc(platba) {
    const k = zkontroluj(platba, 'epc');
    if (k.chyby.length) throw new Error(k.chyby[0]);
    let text = cista(platba.zprava);
    if (cista(platba.vs)) text = ('/VS' + cista(platba.vs) + '/ ' + text).trim();
    const radky = [
      'BCD', '002', '1', 'SCT',
      cista(platba.bic).toUpperCase(),
      cista(platba.prijemce).slice(0, 70),
      k.ucet.iban,
      k.castka != null ? 'EUR' + castkaRetezec(k.castka) : '',
      '', '',
      text.slice(0, 140)
    ];
    while (radky.length > 7 && radky[radky.length - 1] === '') radky.pop();
    return radky.join('\n');
  }

  /* ---------- PAY by square ---------- */
  /**
   * Proud LZMA1 (lc=3, lp=0, pb=2) bez hlavičky a bez koncové značky,
   * kódovaný jen literály. Je to plně platný proud – kompresní poměr ~1:1,
   * což u pár desítek bajtů platby nevadí, a kód zůstává krátký.
   */
  function lzmaLiteraly(data) {
    const vystup = [];
    const isMatch = new Uint16Array(192).fill(1024);
    const literal = new Uint16Array(0x300 << 3).fill(1024);
    let low = 0, range = 0xFFFFFFFF, cache = 0, cacheSize = 1;
    const DVE32 = 4294967296;
    function shiftLow() {
      const lo = low % DVE32, hi = Math.floor(low / DVE32);
      if (lo < 0xFF000000 || hi !== 0) {
        let temp = cache;
        do { vystup.push((temp + hi) & 0xFF); temp = 0xFF; } while (--cacheSize !== 0);
        cache = lo >>> 24;
      }
      cacheSize++;
      low = (lo & 0x00FFFFFF) * 256;
    }
    function bit(pole, i, b) {
      const bound = (range >>> 11) * pole[i];
      if (b === 0) { range = bound; pole[i] += (2048 - pole[i]) >> 5; }
      else { low += bound; range = (range - bound) >>> 0; pole[i] -= pole[i] >> 5; }
      while (range < 0x1000000) { range = (range * 256) >>> 0; shiftLow(); }
    }
    let predchozi = 0;
    for (let pos = 0; pos < data.length; pos++) {
      bit(isMatch, pos & 3, 0);                    // stav 0, posState = pos & 3
      const zaklad = 0x300 * (predchozi >> 5);     // lc = 3
      let symbol = 1;
      for (let j = 7; j >= 0; j--) {
        const b = (data[pos] >> j) & 1;
        bit(literal, zaklad + symbol, b);
        symbol = (symbol << 1) | b;
      }
      predchozi = data[pos];
    }
    for (let i = 0; i < 5; i++) shiftLow();
    return Uint8Array.from(vystup);
  }
  const BASE32HEX = '0123456789ABCDEFGHIJKLMNOPQRSTUV';
  function base32hex(bajty) {
    let buf = 0, bity = 0, s = '';
    for (const b of bajty) {
      buf = ((buf << 8) | b) & 0xFFFF; bity += 8;
      while (bity >= 5) { bity -= 5; s += BASE32HEX[(buf >> bity) & 31]; }
    }
    if (bity > 0) s += BASE32HEX[(buf << (5 - bity)) & 31];
    return s;
  }
  function bySquareData(platba) {
    const k = zkontroluj(platba, 'sk');
    if (k.chyby.length) throw new Error(k.chyby[0]);
    const t = s => bezDiakritiky(cista(s)).replace(/\t/g, ' ');
    const pole = [
      '',                                   // InvoiceID
      '1',                                  // počet plateb
      '1',                                  // PaymentOrder
      k.castka != null ? String(Math.round(k.castka * 100) / 100) : '',
      platba.mena || 'EUR',
      cista(platba.splatnost).replace(/-/g, ''),
      cista(platba.vs), cista(platba.ks), cista(platba.ss),
      '',                                   // OriginatorsReferenceInformation
      t(platba.zprava).slice(0, 140),
      '1', k.ucet.iban, cista(platba.bic).toUpperCase(),
      '0', '0',                             // trvalý příkaz, inkaso
      t(platba.prijemce).slice(0, 70), '', ''
    ];
    return pole.join('\t');
  }
  function bySquare(platba) {
    const text = bySquareData(platba);
    const telo = utf8(text);
    const crc = crc32(telo);
    const sCrc = new Uint8Array(4 + telo.length);
    sCrc[0] = crc & 0xFF; sCrc[1] = (crc >>> 8) & 0xFF; sCrc[2] = (crc >>> 16) & 0xFF; sCrc[3] = crc >>> 24;
    sCrc.set(telo, 4);
    const lz = lzmaLiteraly(sCrc);
    const vse = new Uint8Array(4 + lz.length);
    vse[0] = 0x01;                          // typ 0 (by square), verze 1.1.0
    vse[1] = 0x00;                          // dokument 0 = Pay, rezerva 0
    vse[2] = sCrc.length & 0xFF; vse[3] = sCrc.length >> 8;
    vse.set(lz, 4);
    return base32hex(vse);
  }

  /** Obsah QR podle formátu: 'cz' | 'sk' | 'epc'. */
  function obsahQR(platba, format, moznosti) {
    if (format === 'sk') return bySquare(platba);
    if (format === 'epc') return epc(platba);
    return spayd(platba, moznosti);
  }

  /* ---------- čtení obsahu QR ---------- */
  function datumZ8(s) { return /^\d{8}$/.test(s) ? s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6) : ''; }
  function rozeberSpayd(text) {
    const t = cista(text);
    if (!/^SPD\*\d\.\d\*/i.test(t)) return null;
    const p = { format: 'cz' };
    for (const cast of t.split('*').slice(2)) {
      const i = cast.indexOf(':'); if (i < 0) continue;
      const kl = cast.slice(0, i).toUpperCase();
      let v = cast.slice(i + 1);
      try { v = decodeURIComponent(v.replace(/%(?![0-9A-Fa-f]{2})/g, '%25')); } catch (e) { /* ponech */ }
      if (kl === 'ACC') { const [iban, bic] = v.split('+'); p.iban = iban; p.ucet = ibanNaCzUcet(iban) || ibanFormat(iban); if (bic) p.bic = bic; }
      else if (kl === 'AM') p.castka = v;
      else if (kl === 'CC') p.mena = v.toUpperCase();
      else if (kl === 'DT') p.splatnost = datumZ8(v);
      else if (kl === 'RN') p.prijemce = v;
      else if (kl === 'MSG') p.zprava = v;
      else if (kl === 'X-VS') p.vs = v;
      else if (kl === 'X-SS') p.ss = v;
      else if (kl === 'X-KS') p.ks = v;
    }
    return p;
  }
  function rozeberEpc(text) {
    const r = String(text || '').replace(/\r/g, '').split('\n');
    if (r[0] !== 'BCD' || r[3] !== 'SCT') return null;
    const p = { format: 'epc', mena: 'EUR', bic: r[4] || '', prijemce: r[5] || '', iban: ibanNormalizuj(r[6]) };
    p.ucet = ibanFormat(p.iban);
    const m = (r[7] || '').match(/^([A-Z]{3})(\d+(?:\.\d{1,2})?)$/);
    if (m) { p.mena = m[1]; p.castka = m[2]; }
    let zprava = r[10] || r[9] || '';
    const vs = zprava.match(/^\/VS(\d{1,10})\/\s*/);
    if (vs) { p.vs = vs[1]; zprava = zprava.slice(vs[0].length); }
    p.zprava = zprava;
    return p;
  }
  /** Obsah naskenovaného QR → platba (nebo null, když to není platební kód). */
  function rozeberQR(text) {
    const t = String(text || '');
    if (/^SPD\*/i.test(t.trim())) return rozeberSpayd(t);
    if (/^BCD\r?\n/.test(t)) return rozeberEpc(t);
    if (/^[0-9A-V]{20,}$/.test(t.trim())) return { format: 'sk', jenRozpoznano: true };
    return null;
  }

  /* ---------- rozpoznání údajů z volného textu ---------- */
  const PISMENO = 'A-Za-zÀ-žÁ-Žá-ž';
  function najdiPoStitku(text, stitky, vzor) {
    const re = new RegExp('(?<![' + PISMENO + '])(?:' + stitky + ')(?![' + PISMENO + '])\\s*[:.=#]?\\s*' + vzor, 'i');
    const m = text.match(re);
    return m ? m[1] : '';
  }
  /**
   * Volný text (e-mail, faktura, SMS) → {ucet, castka, mena, vs, ks, ss, zprava, prijemce, splatnost}.
   * Vrací jen to, co našel; nenalezené klíče chybí.
   */
  function rozpoznejText(vstup) {
    const text = String(vstup || '').replace(/\r/g, '');
    const qr = rozeberQR(text.trim());
    if (qr && !qr.jenRozpoznano) return qr;
    const v = {};

    // účet: nejdřív IBAN, pak český zápis
    const ibanM = text.toUpperCase().match(/\b([A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,4})?)\b/g) || [];
    for (const kand of ibanM) { if (ibanPlatny(kand)) { const n = ibanNormalizuj(kand); v.ucet = ibanNaCzUcet(n) || ibanFormat(n); break; } }
    if (!v.ucet) {
      const re = /(?<![\d\/-])(?:(\d{1,6})\s?-\s?)?(\d{2,10})\s?\/\s?(\d{4})(?![\d\/])/g;
      let m, nahradni = '';
      while ((m = re.exec(text))) {
        const zapis = (m[1] ? m[1] + '-' : '') + m[2] + '/' + m[3];
        const z = zpracujUcet(zapis);
        if (!z.chyby.length && z.banka) { v.ucet = zapis; break; }
        if (!z.chyby.length && !nahradni) nahradni = zapis;
      }
      if (!v.ucet && nahradni) v.ucet = nahradni;
    }

    // symboly
    const vs = najdiPoStitku(text, 'variabilní\\s+symbol|variabilni\\s+symbol|var\\.\\s*symbol|v\\.\\s?s\\.|VS', '(\\d{1,10})(?!\\d)');
    if (vs) v.vs = vs;
    const ks = najdiPoStitku(text, 'konstantní\\s+symbol|konstantni\\s+symbol|konst\\.\\s*symbol|k\\.\\s?s\\.|KS', '(\\d{1,10})(?!\\d)');
    if (ks) v.ks = ks;
    const ss = najdiPoStitku(text, 'specifický\\s+symbol|specificky\\s+symbol|spec\\.\\s*symbol|s\\.\\s?s\\.|SS', '(\\d{1,10})(?!\\d)');
    if (ss) v.ss = ss;

    // částka
    const CISLO = '(\\d{1,3}(?:[ \\u00a0.]\\d{3})+(?:,\\d{1,2})?|\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)';
    let castka = najdiPoStitku(text, 'částka(?:\\s+k\\s+úhradě)?|castka|k\\s+úhradě|k\\s+uhrade|celkem(?:\\s+k\\s+úhradě)?|suma|cena|amount|zaplatit', '(?:(?:Kč|CZK|EUR|€)\\s*)?' + CISLO);
    let menaText = '';
    if (castka) {
      const okoli = text.slice(text.indexOf(castka), text.indexOf(castka) + castka.length + 6);
      if (/EUR|€/i.test(okoli)) menaText = 'EUR';
    } else {
      const m = text.match(new RegExp(CISLO + '\\s*(Kč|CZK|EUR|€|,-)', 'i')) || text.match(new RegExp('(?:€|EUR)\\s*' + CISLO, 'i'));
      if (m) { castka = m[1]; if (/EUR|€/i.test(m[0])) menaText = 'EUR'; }
    }
    if (castka) {
      const n = parsujCastku(castka);
      if (isFinite(n) && n > 0) v.castka = castkaRetezec(n).replace('.', ',');
    }
    if (menaText) v.mena = menaText;
    else if (/\b(EUR)\b|€/.test(text) && !/Kč|CZK/.test(text)) v.mena = 'EUR';

    // zpráva, příjemce
    const zprava = text.match(/(?<![A-Za-zÀ-ž])(?:zpráva\s+pro\s+příjemce|zprava\s+pro\s+prijemce|zpráva|zprava|poznámka|poznamka|účel(?:\s+platby)?|ucel(?:\s+platby)?|message|popis\s+platby)\s*[:=]\s*([^\n]+)/i);
    if (zprava) v.zprava = zprava[1].trim().replace(/[,;]\s*$/, '');
    const prij = text.match(/(?:^|[\n,;])\s*(?:příjemce|prijemce|majitel\s+účtu|majitel\s+uctu|název\s+účtu|nazev\s+uctu|beneficiary|jméno\s+příjemce)\s*[:=]\s*([^\n,;]+)/i);
    if (prij) v.prijemce = prij[1].trim();

    // splatnost
    const spl = text.match(/(?:splatnost|datum\s+splatnosti|splatné\s+do|splatne\s+do|uhraďte\s+do|zaplaťte\s+do)\s*[:=]?\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/i);
    if (spl) v.splatnost = spl[3] + '-' + spl[2].padStart(2, '0') + '-' + spl[1].padStart(2, '0');
    return v;
  }

  const API = {
    BANKY, crc32, mod11, mod97, ibanPlatny, ibanNormalizuj, ibanFormat, czUcetNaIban, ibanNaCzUcet,
    zpracujUcet, parsujCastku, zkontroluj, spayd, epc, bySquare, bySquareData, lzmaLiteraly, base32hex,
    obsahQR, rozeberQR, rozpoznejText, bezDiakritiky
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else koren.QRPlatba = API;
})(typeof window !== 'undefined' ? window : globalThis);
