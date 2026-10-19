/* ============================================================
   plc/jadro.js – výpočetní jádro simulátoru PLC (bez DOM), formát v2.

   Program (Ladder Diagram, inspirace IEC 61131-3, bez vazby na výrobce):
     projekt = { format, verze: 2, nazev, popis, perioda, watchdog, proces, symboly, komentare,
                 vstupy, mapovani, remanence, watch, pricky: [...] (POU MAIN), fb: [FB…] }
     FB      = { id, nazev, komentar, rozhrani: [{ nazev, smer: 'IN'|'OUT'|'STAT', typ: 'BOOL'|'INT'|'REAL', komentar }], pricky }
     pricka  = { id, komentar, podminka: SERIE, vystupy: [instrukce] }
     SERIE   = { id, typ: 'SERIE', prvky: [kontakt | PAR] }   … AND
     PAR     = { id, typ: 'PAR', vetve: [SERIE…] }            … OR
     kontakt = NO/NC/P/N { adr } | CMP { in1, op, in2 }
     výstupy = cívky, časovače, čítače, přesuny, aritmetika, PID, CALL – viz INSTR.

   Paměť: I0.0–I1.7, Q0.0–Q1.7, M0.0–M7.7, S0.0–S0.7 (systémové bity), IW0–IW7 / QW0–QW7 (analog,
   INT, 0–32000 = 4–20 mA), MW0–MW63 (INT), MD0–MD31 (REAL), SW0–SW3 (systémová slova), T0–T31, C0–C31,
   v FB lokální proměnné #jméno (rozhraní a lokální časovače/čítače instance).

   Cyklus (scan) je deterministický:
     1. čtení vstupů do obrazu (I, IW) + vynucené hodnoty vstupů,
     2. příčky MAIN shora dolů, podmínka zleva doprava, výstupy shora dolů; CALL provede FB
        s pamětí své instance (vstupy se zkopírují před, výstupy po provedení těla),
     3. zápis výstupů (Q, QW) + vynucené hodnoty výstupů, model doby cyklu, čas += perioda.
   ============================================================ */
(function () {
  'use strict';

  const LIMITY = { I: 2, Q: 2, M: 8, S: 1, T: 32, C: 32, IW: 8, QW: 8, MW: 64, MD: 32, SW: 4 };
  const KONTAKTY = ['NO', 'NC', 'P', 'N', 'CMP'];
  const CIVKY = ['CIVKA', 'NCIVKA', 'SET', 'RESET'];
  const CASOVACE = ['TON', 'TOF', 'TP', 'RTO'];
  const CITACE = ['CTU', 'CTD', 'CTUD'];
  const PT_MAX = 3600000, PV_MAX = 32767, CV_MIN = -32768, CV_MAX = 32767, INT_MIN = -32768, INT_MAX = 32767;
  const PERIODA_MIN = 5, PERIODA_MAX = 5000;
  const LIMIT_INSTR = 200000, MAX_HLOUBKA = 8;
  const ANALOG_MAX = 32000, ANALOG_PRERUSENO = -8000;
  const TYPY = ['BOOL', 'INT', 'REAL'];
  const OPERACE = ['==', '<>', '<', '<=', '>', '>='];

  /* druhy parametrů: bit (čtený bit), bitW (zapisovaný bit), cislo, cisloW, timer, counter, tc, ms, int, real, op */
  const INSTR = {
    NO: { kat: 'kontakt', nazev: 'spínací kontakt (NO)', param: [['adr', 'Operand', 'bit']] },
    NC: { kat: 'kontakt', nazev: 'rozpínací kontakt (NC)', param: [['adr', 'Operand', 'bit']] },
    P: { kat: 'kontakt', nazev: 'náběžná hrana (P)', param: [['adr', 'Operand', 'bit']] },
    N: { kat: 'kontakt', nazev: 'sestupná hrana (N)', param: [['adr', 'Operand', 'bit']] },
    CMP: { kat: 'kontakt', nazev: 'porovnání (CMP)', param: [['in1', 'IN1', 'cislo'], ['op', 'Operace', 'op'], ['in2', 'IN2', 'cislo']] },
    CIVKA: { kat: 'civka', nazev: 'cívka', param: [['adr', 'Operand', 'bitW']] },
    NCIVKA: { kat: 'civka', nazev: 'negovaná cívka', param: [['adr', 'Operand', 'bitW']] },
    SET: { kat: 'civka', nazev: 'nastavení (S)', param: [['adr', 'Operand', 'bitW']] },
    RESET: { kat: 'civka', nazev: 'nulování (R)', param: [['adr', 'Operand', 'bitW']] },
    R_TRIG: { kat: 'blok', nazev: 'náběžná hrana do bitu (R_TRIG)', param: [['adr', 'Q', 'bitW']] },
    F_TRIG: { kat: 'blok', nazev: 'sestupná hrana do bitu (F_TRIG)', param: [['adr', 'Q', 'bitW']] },
    SR: { kat: 'blok', nazev: 'klopný obvod SR (přednost S)', param: [['adr', 'Q', 'bitW'], ['r', 'R1', 'bit']] },
    RS: { kat: 'blok', nazev: 'klopný obvod RS (přednost R)', param: [['adr', 'Q', 'bitW'], ['r', 'R1', 'bit']] },
    TON: { kat: 'blok', nazev: 'zpožděné zapnutí (TON)', param: [['adr', 'Časovač', 'timer'], ['pt', 'PT', 'ms']] },
    TOF: { kat: 'blok', nazev: 'zpožděné vypnutí (TOF)', param: [['adr', 'Časovač', 'timer'], ['pt', 'PT', 'ms']] },
    TP: { kat: 'blok', nazev: 'impulz (TP)', param: [['adr', 'Časovač', 'timer'], ['pt', 'PT', 'ms']] },
    RTO: { kat: 'blok', nazev: 'remanentní zpožděné zapnutí (RTO)', param: [['adr', 'Časovač', 'timer'], ['pt', 'PT', 'ms']] },
    CTU: { kat: 'blok', nazev: 'čítač nahoru (CTU)', param: [['adr', 'Čítač', 'counter'], ['pv', 'PV', 'int']] },
    CTD: { kat: 'blok', nazev: 'čítač dolů (CTD)', param: [['adr', 'Čítač', 'counter'], ['pv', 'PV', 'int']] },
    CTUD: { kat: 'blok', nazev: 'čítač nahoru/dolů (CTUD)', param: [['adr', 'Čítač', 'counter'], ['pv', 'PV', 'int'], ['cd', 'CD', 'bit']] },
    RES: { kat: 'blok', nazev: 'nulování časovače/čítače (RES)', param: [['adr', 'Časovač/čítač', 'tc']] },
    MOVE: { kat: 'blok', nazev: 'přesun (MOVE)', param: [['in', 'IN', 'cislo'], ['out', 'OUT', 'cisloW']] },
    ADD: { kat: 'blok', nazev: 'sčítání (ADD)', param: [['in1', 'IN1', 'cislo'], ['in2', 'IN2', 'cislo'], ['out', 'OUT', 'cisloW']] },
    SUB: { kat: 'blok', nazev: 'odčítání (SUB)', param: [['in1', 'IN1', 'cislo'], ['in2', 'IN2', 'cislo'], ['out', 'OUT', 'cisloW']] },
    MUL: { kat: 'blok', nazev: 'násobení (MUL)', param: [['in1', 'IN1', 'cislo'], ['in2', 'IN2', 'cislo'], ['out', 'OUT', 'cisloW']] },
    DIV: { kat: 'blok', nazev: 'dělení (DIV)', param: [['in1', 'IN1', 'cislo'], ['in2', 'IN2', 'cislo'], ['out', 'OUT', 'cisloW']] },
    MOD: { kat: 'blok', nazev: 'zbytek po dělení (MOD)', param: [['in1', 'IN1', 'cislo'], ['in2', 'IN2', 'cislo'], ['out', 'OUT', 'cisloW']] },
    SCALE: { kat: 'blok', nazev: 'lineární přepočet (SCALE)', param: [['in', 'IN', 'cislo'], ['inmin', 'IN min', 'cislo'], ['inmax', 'IN max', 'cislo'], ['outmin', 'OUT min', 'cislo'], ['outmax', 'OUT max', 'cislo'], ['out', 'OUT', 'cisloW']] },
    LIMIT: { kat: 'blok', nazev: 'omezení (LIMIT)', param: [['mn', 'MN', 'cislo'], ['in', 'IN', 'cislo'], ['mx', 'MX', 'cislo'], ['out', 'OUT', 'cisloW']] },
    PID: { kat: 'blok', nazev: 'regulátor PID', param: [['pv', 'PV (měřená)', 'cislo'], ['sp', 'SP (žádaná)', 'cislo'], ['out', 'OUT (akční)', 'cisloW'],
      ['kp', 'Kp', 'real'], ['ti', 'Ti [s]', 'real'], ['td', 'Td [s]', 'real'], ['omin', 'OUT min', 'real'], ['omax', 'OUT max', 'real'],
      ['man', 'MAN (ruční)', 'bitOpt'], ['mval', 'Ruční hodnota', 'cisloOpt'], ['ts', 'Ts [ms] (0 = cyklus)', 'ms']] },
    CALL: { kat: 'blok', nazev: 'volání funkčního bloku (CALL)', param: [['fb', 'Funkční blok', 'fb'], ['inst', 'Instance', 'inst']] }
  };
  const VYSTUPY = Object.keys(INSTR).filter(k => INSTR[k].kat !== 'kontakt');
  const BLOKY = VYSTUPY.filter(k => INSTR[k].kat === 'blok');
  const NAZVY = Object.fromEntries(Object.entries(INSTR).map(([k, v]) => [k, v.nazev]));
  const CENA = { NO: 0.1, NC: 0.1, P: 0.2, N: 0.2, CMP: 0.6, CIVKA: 0.1, NCIVKA: 0.1, SET: 0.1, RESET: 0.1, R_TRIG: 0.3, F_TRIG: 0.3, SR: 0.3, RS: 0.3,
    TON: 1.5, TOF: 1.5, TP: 1.5, RTO: 1.5, CTU: 1.2, CTD: 1.2, CTUD: 1.5, RES: 0.5, MOVE: 0.5, ADD: 0.8, SUB: 0.8, MUL: 1, DIV: 1.5, MOD: 1.5,
    SCALE: 3, LIMIT: 1, PID: 25, CALL: 4, PAR: 0.1 };
  const ZAKLAD_CYKLU = 120;       // µs režie cyklu (čtení/zápis I/O, komunikace) – modelová hodnota

  /* ---------- adresy a operandy ---------- */
  function rozeberAdresu(text) {
    if (typeof text !== 'string') return null;
    let s = text.trim();
    const lok = /^#([A-Za-z_][A-Za-z0-9_]{0,23})$/.exec(s);
    if (lok) return { oblast: '#', nazev: lok[1], klic: '#' + lok[1], typ: null };
    s = s.toUpperCase().replace(/\s+/g, '');
    if (s.startsWith('%')) s = s.slice(1).replace(/^([IQM])X/, '$1');
    let m = /^(IW|QW|MW|MD|SW)(\d{1,3})$/.exec(s);
    if (m) {
      const oblast = m[1], cislo = +m[2];
      if (cislo >= LIMITY[oblast]) return null;
      return { oblast, cislo, klic: oblast + cislo, typ: oblast === 'MD' ? 'REAL' : 'INT', slovo: true };
    }
    m = /^([IQMS])(\d{1,2})\.(\d)$/.exec(s);
    if (m) {
      const oblast = m[1], bajt = +m[2], bit = +m[3];
      if (bit > 7 || bajt >= LIMITY[oblast]) return null;
      return { oblast, bajt, bit, klic: oblast + bajt + '.' + bit, typ: 'BOOL' };
    }
    m = /^([TC])(\d{1,2})$/.exec(s);
    if (m) {
      const oblast = m[1], cislo = +m[2];
      if (cislo >= LIMITY[oblast]) return null;
      return { oblast, cislo, klic: oblast + cislo, typ: oblast === 'T' ? 'TIMER' : 'COUNTER' };
    }
    return null;
  }
  function rozeberCas(s) {          // T#1s500ms, T#2m, T#100ms → ms
    const m = /^T#(.+)$/i.exec(s); if (!m) return null;
    let zb = m[1].toLowerCase().replace(/_/g, ''), ms = 0, n = 0;
    const re = /^(\d+(?:[.,]\d+)?)(ms|h|m|s)/;
    while (zb.length) { const x = re.exec(zb); if (!x) return null; const v = +x[1].replace(',', '.'); ms += v * { ms: 1, s: 1000, m: 60000, h: 3600000 }[x[2]]; zb = zb.slice(x[0].length); n++; }
    return n ? Math.round(ms) : null;
  }
  function rozeberOperand(text) {
    if (typeof text !== 'string') { if (typeof text === 'number' && Number.isFinite(text)) return { druh: 'konst', hodnota: text, typ: Number.isInteger(text) ? 'INT' : 'REAL' }; return null; }
    const s = text.trim();
    if (!s) return null;
    const a = rozeberAdresu(s);
    if (a) return { druh: 'adr', a };
    if (/^(TRUE|FALSE)$/i.test(s)) return { druh: 'konst', hodnota: /^TRUE$/i.test(s) ? 1 : 0, typ: 'BOOL' };
    const t = rozeberCas(s); if (t !== null) return { druh: 'konst', hodnota: t, typ: 'INT' };
    if (/^[+-]?\d+$/.test(s)) { const v = +s; if (Math.abs(v) > 2147483647) return null; return { druh: 'konst', hodnota: v, typ: 'INT' }; }
    if (/^[+-]?(\d+[.,]\d*|[.,]\d+)(e[+-]?\d+)?$/i.test(s) || /^[+-]?\d+e[+-]?\d+$/i.test(s)) { const v = +s.replace(',', '.'); if (!Number.isFinite(v)) return null; return { druh: 'konst', hodnota: v, typ: 'REAL' }; }
    return null;
  }
  function vsechnyAdresy(oblast) {
    const r = [];
    if (['T', 'C', 'IW', 'QW', 'MW', 'MD', 'SW'].includes(oblast)) { for (let i = 0; i < LIMITY[oblast]; i++) r.push(oblast + i); return r; }
    for (let b = 0; b < LIMITY[oblast]; b++) for (let i = 0; i < 8; i++) r.push(oblast + b + '.' + i);
    return r;
  }
  const PORADI_OBLASTI = ['I', 'IW', 'Q', 'QW', 'M', 'MW', 'MD', 'T', 'C', 'S', 'SW', '#'];
  function poradiAdresy(a) {
    const r = rozeberAdresu(a); if (!r) return 1e9;
    const o = PORADI_OBLASTI.indexOf(r.oblast) * 1e5;
    if (r.oblast === '#') return o + 500;
    return o + (r.cislo !== undefined ? r.cislo : r.bajt * 8 + r.bit);
  }
  const VSECHNY_Q = vsechnyAdresy('Q'), VSECHNY_QW = vsechnyAdresy('QW');
  const SYSTEMOVE = { 'S0.0': 'vždy 1', 'S0.1': 'první cyklus po startu', 'S0.2': 'takt 0,1 s (50/50 ms)', 'S0.3': 'takt 1 s (0,5/0,5 s)',
    'S0.4': 'takt 2 s (1/1 s)', 'S0.5': 'chyba výpočtu v minulém cyklu', 'S0.6': 'přetížení – model doby cyklu > perioda', 'S0.7': 'vynucení aktivní',
    'SW0': 'model doby posledního cyklu [µs]', 'SW1': 'počet cyklů (mod 32768)', 'SW2': 'počet chyb výpočtu', 'SW3': 'perioda cyklu [ms]' };

  /* ---------- identifikátory a stavba ---------- */
  let citacId = 0;
  function novyId() { return 'e' + (++citacId); }
  const B = {
    NO: a => ({ id: novyId(), typ: 'NO', adr: a }),
    NC: a => ({ id: novyId(), typ: 'NC', adr: a }),
    P: a => ({ id: novyId(), typ: 'P', adr: a }),
    N: a => ({ id: novyId(), typ: 'N', adr: a }),
    CMP: (in1, op, in2) => ({ id: novyId(), typ: 'CMP', in1: String(in1), op, in2: String(in2) }),
    S: (...prvky) => ({ id: novyId(), typ: 'SERIE', prvky }),
    PAR: (...vetve) => ({ id: novyId(), typ: 'PAR', vetve: vetve.map(v => Array.isArray(v) ? B.S(...v) : (v.typ === 'SERIE' ? v : B.S(v))) }),
    CIVKA: a => ({ id: novyId(), typ: 'CIVKA', adr: a }),
    NCIVKA: a => ({ id: novyId(), typ: 'NCIVKA', adr: a }),
    SET: a => ({ id: novyId(), typ: 'SET', adr: a }),
    RESET: a => ({ id: novyId(), typ: 'RESET', adr: a }),
    R_TRIG: a => ({ id: novyId(), typ: 'R_TRIG', adr: a }),
    F_TRIG: a => ({ id: novyId(), typ: 'F_TRIG', adr: a }),
    SR: (a, r) => ({ id: novyId(), typ: 'SR', adr: a, r }),
    RS: (a, r) => ({ id: novyId(), typ: 'RS', adr: a, r }),
    TON: (a, pt) => ({ id: novyId(), typ: 'TON', adr: a, pt }),
    TOF: (a, pt) => ({ id: novyId(), typ: 'TOF', adr: a, pt }),
    TP: (a, pt) => ({ id: novyId(), typ: 'TP', adr: a, pt }),
    RTO: (a, pt) => ({ id: novyId(), typ: 'RTO', adr: a, pt }),
    CTU: (a, pv) => ({ id: novyId(), typ: 'CTU', adr: a, pv }),
    CTD: (a, pv) => ({ id: novyId(), typ: 'CTD', adr: a, pv }),
    CTUD: (a, pv, cd) => ({ id: novyId(), typ: 'CTUD', adr: a, pv, cd }),
    RES: a => ({ id: novyId(), typ: 'RES', adr: a }),
    MOVE: (vstup, out) => ({ id: novyId(), typ: 'MOVE', in: String(vstup), out }),
    ADD: (in1, in2, out) => ({ id: novyId(), typ: 'ADD', in1: String(in1), in2: String(in2), out }),
    SUB: (in1, in2, out) => ({ id: novyId(), typ: 'SUB', in1: String(in1), in2: String(in2), out }),
    MUL: (in1, in2, out) => ({ id: novyId(), typ: 'MUL', in1: String(in1), in2: String(in2), out }),
    DIV: (in1, in2, out) => ({ id: novyId(), typ: 'DIV', in1: String(in1), in2: String(in2), out }),
    MOD: (in1, in2, out) => ({ id: novyId(), typ: 'MOD', in1: String(in1), in2: String(in2), out }),
    SCALE: (vstup, inmin, inmax, outmin, outmax, out) => ({ id: novyId(), typ: 'SCALE', in: String(vstup), inmin: String(inmin), inmax: String(inmax), outmin: String(outmin), outmax: String(outmax), out }),
    LIMIT: (mn, vstup, mx, out) => ({ id: novyId(), typ: 'LIMIT', mn: String(mn), in: String(vstup), mx: String(mx), out }),
    PID: o => Object.assign({ id: novyId(), typ: 'PID', pv: '', sp: '', out: '', kp: 1, ti: 0, td: 0, omin: 0, omax: 100, man: '', mval: '', ts: 0 }, o),
    CALL: (fb, inst, prm) => ({ id: novyId(), typ: 'CALL', fb, inst, prm: prm || {} }),
    PRICKA: (komentar, podminka, vystupy) => ({ id: novyId(), komentar: komentar || '', podminka: B.S(...podminka), vystupy }),
    FB: (nazev, rozhrani, pricky, komentar) => ({ id: novyId(), nazev, komentar: komentar || '', rozhrani: rozhrani.map(r => Array.isArray(r) ? { nazev: r[0], smer: r[1], typ: r[2], komentar: r[3] || '' } : r), pricky })
  };
  const VYCHOZI = { TON: { pt: 1000 }, TOF: { pt: 1000 }, TP: { pt: 1000 }, RTO: { pt: 1000 }, CTU: { pv: 3 }, CTD: { pv: 3 }, CTUD: { pv: 3, cd: '' },
    CMP: { in1: 'MW0', op: '>=', in2: '0' }, MOVE: { in: '0', out: 'MW0' }, ADD: { in1: 'MW0', in2: '1', out: 'MW0' }, SUB: { in1: 'MW0', in2: '1', out: 'MW0' },
    MUL: { in1: 'MW0', in2: '2', out: 'MW1' }, DIV: { in1: 'MW0', in2: '2', out: 'MW1' }, MOD: { in1: 'MW0', in2: '2', out: 'MW1' },
    SCALE: { in: 'IW0', inmin: '0', inmax: '32000', outmin: '0.0', outmax: '100.0', out: 'MD0' }, LIMIT: { mn: '0', in: 'MW0', mx: '100', out: 'MW1' },
    PID: { pv: 'MD0', sp: 'MD1', out: 'MD2', kp: 1, ti: 10, td: 0, omin: 0, omax: 100, man: '', mval: '', ts: 0 }, SR: { r: '' }, RS: { r: '' }, CALL: { fb: '', inst: '', prm: {} } };
  function novyPrvek(typ, adr, param) {
    const p = Object.assign({ id: novyId(), typ }, JSON.parse(JSON.stringify(VYCHOZI[typ] || {})));
    if (INSTR[typ] && INSTR[typ].param.some(x => x[0] === 'adr')) p.adr = adr || '';
    if (param !== undefined) { if (CASOVACE.includes(typ)) p.pt = param; if (CITACE.includes(typ)) p.pv = param; }
    return p;
  }
  function novyProjekt(nazev) {
    return { format: 'plc-simulator', verze: 2, nazev: nazev || 'Nový projekt', popis: '', perioda: 100, watchdog: 500, proces: 'zadny',
      symboly: {}, komentare: {}, vstupy: {}, mapovani: {}, remanence: { M: 4, MW: 32, MD: 16, C: true, RTO: true, FB: false }, watch: [],
      pricky: [B.PRICKA('', [], [])], fb: [] };
  }

  /* ---------- POU a procházení ---------- */
  function vsechnyPou(projekt) {
    return [{ nazev: 'MAIN', pou: projekt, fb: null }].concat((projekt.fb || []).map(f => ({ nazev: f.nazev, pou: f, fb: f })));
  }
  function najdiFb(projekt, nazev) { return (projekt.fb || []).find(f => f.nazev === nazev) || null; }
  function prochazejSerii(s, fn) {
    s.prvky.forEach((x, i) => {
      fn(x, s, i);
      if (x.typ === 'PAR') x.vetve.forEach(v => { fn(v, x, -1); prochazejSerii(v, fn); });
    });
  }
  /* všechny instrukce s informací o POU a příčce */
  function vsechnyPrvky(projekt) {
    const r = [];
    for (const { nazev, pou, fb } of vsechnyPou(projekt)) {
      pou.pricky.forEach((p, pi) => {
        prochazejSerii(p.podminka, x => { if (KONTAKTY.includes(x.typ)) r.push({ prvek: x, pricka: pi, kde: 'podminka', pou: nazev, fb }); });
        p.vystupy.forEach(v => r.push({ prvek: v, pricka: pi, kde: 'vystupy', pou: nazev, fb }));
      });
    }
    return r;
  }
  function najdi(projekt, id) {
    for (const { nazev, pou } of vsechnyPou(projekt)) {
      for (let pi = 0; pi < pou.pricky.length; pi++) {
        const p = pou.pricky[pi];
        const zaklad = { pricka: p, prickaIdx: pi, pou, pouNazev: nazev };
        if (p.id === id) return Object.assign(zaklad, { uzel: p, kde: 'pricka', pole: pou.pricky, index: pi });
        const vi = p.vystupy.findIndex(v => v.id === id);
        if (vi >= 0) return Object.assign(zaklad, { uzel: p.vystupy[vi], kde: 'vystupy', pole: p.vystupy, index: vi });
        if (p.podminka.id === id) return Object.assign(zaklad, { uzel: p.podminka, kde: 'serie' });
        let nalez = null;
        const hledej = (s, par) => {
          for (let i = 0; i < s.prvky.length && !nalez; i++) {
            const x = s.prvky[i];
            if (x.id === id) { nalez = Object.assign({}, zaklad, { uzel: x, kde: 'podminka', serie: s, pole: s.prvky, index: i, rodicPar: par }); return; }
            if (x.typ === 'PAR') for (const v of x.vetve) {
              if (v.id === id) { nalez = Object.assign({}, zaklad, { uzel: v, kde: 'serie', par: x }); return; }
              hledej(v, x); if (nalez) return;
            }
          }
        };
        hledej(p.podminka, null);
        if (nalez) return nalez;
      }
    }
    return null;
  }
  function najdiPricku(projekt, id) {
    for (const { pou } of vsechnyPou(projekt)) { const i = pou.pricky.findIndex(p => p.id === id); if (i >= 0) return { pou, pricka: pou.pricky[i], index: i }; }
    return null;
  }

  /* ---------- normalizace a editační operace ---------- */
  function normalizujSerii(s) {
    const out = [];
    for (const x of s.prvky) {
      if (x.typ === 'SERIE') { normalizujSerii(x); out.push(...x.prvky); continue; }
      if (x.typ === 'PAR') {
        const vetve = [];
        for (const v of x.vetve) {
          normalizujSerii(v);
          if (!v.prvky.length) continue;
          if (v.prvky.length === 1 && v.prvky[0].typ === 'PAR') vetve.push(...v.prvky[0].vetve);
          else vetve.push(v);
        }
        if (!vetve.length) continue;
        if (vetve.length === 1) { out.push(...vetve[0].prvky); continue; }
        x.vetve = vetve; out.push(x); continue;
      }
      out.push(x);
    }
    s.prvky = out;
    return s;
  }
  function normalizuj(projekt) { for (const { pou } of vsechnyPou(projekt)) pou.pricky.forEach(p => normalizujSerii(p.podminka)); return projekt; }
  function chyba(text) { const e = new Error(text); e.plc = true; return e; }
  const jeKontaktTyp = t => KONTAKTY.includes(t);

  function vloz(projekt, cil, prvek) {
    const n = najdiPricku(projekt, cil.pricka);
    if (!n) throw chyba('Příčka neexistuje.');
    const p = n.pricka;
    const kont = jeKontaktTyp(prvek.typ);
    if (cil.serie == null) {
      if (kont || prvek.typ === 'PAR') throw chyba('Kontakt patří do podmínky příčky (vlevo), ne mezi výstupy.');
      p.vystupy.splice(Math.max(0, Math.min(cil.index, p.vystupy.length)), 0, prvek);
    } else {
      if (!kont && prvek.typ !== 'PAR') throw chyba('Cívky a bloky patří na pravý konec příčky (výstupy).');
      const s = cil.serie === p.podminka.id ? { uzel: p.podminka } : najdi(projekt, cil.serie);
      if (!s || s.uzel.typ !== 'SERIE') throw chyba('Místo vložení neexistuje.');
      s.uzel.prvky.splice(Math.max(0, Math.min(cil.index, s.uzel.prvky.length)), 0, prvek);
    }
    normalizuj(projekt);
    return prvek;
  }
  function smaz(projekt, id) {
    const n = najdi(projekt, id);
    if (!n || !n.pole || n.kde === 'pricka') throw chyba('Prvek nelze smazat.');
    n.pole.splice(n.index, 1);
    normalizuj(projekt);
    return n.uzel;
  }
  function presun(projekt, id, cil) {
    const n = najdi(projekt, id);
    if (!n || !n.pole || n.kde === 'pricka') throw chyba('Prvek nelze přesunout.');
    if (n.uzel.typ === 'PAR' && cil.serie) {
      let uvnitr = false; prochazejSerii({ prvky: [n.uzel] }, x => { if (x.id === cil.serie) uvnitr = true; });
      if (uvnitr) throw chyba('Paralelní blok nelze vložit sám do sebe.');
    }
    const cn = najdiPricku(projekt, cil.pricka);
    if (!cn) throw chyba('Příčka neexistuje.');
    const cilPricka = cn.pricka;
    const kont = jeKontaktTyp(n.uzel.typ) || n.uzel.typ === 'PAR';
    if (kont && cil.serie == null) throw chyba('Kontakt nelze přesunout mezi výstupy.');
    if (!kont && cil.serie != null) throw chyba('Výstupní instrukci nelze přesunout do podmínky.');
    let index = cil.index;
    const stejnePole = cil.serie == null ? (n.pole === cilPricka.vystupy) : (n.serie && n.serie.id === cil.serie);
    if (stejnePole && n.index < index) index--;
    n.pole.splice(n.index, 1);
    if (cil.serie == null) cilPricka.vystupy.splice(Math.max(0, Math.min(index, cilPricka.vystupy.length)), 0, n.uzel);
    else {
      const c = cil.serie === cilPricka.podminka.id ? { uzel: cilPricka.podminka } : najdi(projekt, cil.serie);
      if (!c || c.uzel.typ !== 'SERIE') { n.pole.splice(n.index, 0, n.uzel); throw chyba('Místo vložení neexistuje.'); }
      c.uzel.prvky.splice(Math.max(0, Math.min(index, c.uzel.prvky.length)), 0, n.uzel);
    }
    normalizuj(projekt);
  }
  function posun(projekt, id, smer) {
    const n = najdi(projekt, id);
    if (!n || !n.pole) return false;
    const j = n.index + smer;
    if (j < 0 || j >= n.pole.length) return false;
    [n.pole[n.index], n.pole[j]] = [n.pole[j], n.pole[n.index]];
    return true;
  }
  function paralelne(projekt, ids, novy) {
    if (!ids.length) throw chyba('Nic není vybráno.');
    if (!jeKontaktTyp(novy.typ)) throw chyba('Do paralelní větve lze vložit jen kontakt.');
    const nal = ids.map(id => najdi(projekt, id));
    if (nal.some(n => !n || n.kde !== 'podminka')) throw chyba('Paralelní větev lze vytvořit jen kolem kontaktů v podmínce.');
    const s = nal[0].serie;
    if (nal.some(n => n.serie !== s)) throw chyba('Vybrané prvky musí ležet ve stejné větvi.');
    const idx = nal.map(n => n.index).sort((a, b) => a - b);
    for (let i = 1; i < idx.length; i++) if (idx[i] !== idx[i - 1] + 1) throw chyba('Vybrané prvky musí ležet těsně za sebou.');
    const usek = s.prvky.slice(idx[0], idx[idx.length - 1] + 1);
    const par = { id: novyId(), typ: 'PAR', vetve: [{ id: novyId(), typ: 'SERIE', prvky: usek }, { id: novyId(), typ: 'SERIE', prvky: [novy] }] };
    s.prvky.splice(idx[0], usek.length, par);
    normalizuj(projekt);
    return par;
  }
  function pridejVetev(projekt, parId, novy) {
    const n = najdi(projekt, parId);
    if (!n || n.uzel.typ !== 'PAR') throw chyba('Paralelní blok neexistuje.');
    if (!jeKontaktTyp(novy.typ)) throw chyba('Do paralelní větve lze vložit jen kontakt.');
    n.uzel.vetve.push({ id: novyId(), typ: 'SERIE', prvky: [novy] });
    return novy;
  }
  function novaPricka(projekt, index, pou) {
    const cil = pou || projekt;
    const p = B.PRICKA('', [], []);
    cil.pricky.splice(index === undefined ? cil.pricky.length : index, 0, p);
    return p;
  }
  function smazPricku(projekt, id) {
    const n = najdiPricku(projekt, id);
    if (!n) return false;
    n.pou.pricky.splice(n.index, 1);
    if (!n.pou.pricky.length) n.pou.pricky.push(B.PRICKA('', [], []));
    return true;
  }
  function posunPricku(projekt, id, smer) {
    const n = najdiPricku(projekt, id); if (!n) return false;
    const i = n.index, j = i + smer, a = n.pou.pricky;
    if (j < 0 || j >= a.length) return false;
    [a[i], a[j]] = [a[j], a[i]];
    return true;
  }
  function kopiruj(x) { return JSON.parse(JSON.stringify(x)); }
  function premapujId(uzel) {
    const k = kopiruj(uzel);
    const fn = o => { if (o && typeof o === 'object') { if (o.id) o.id = novyId(); for (const v of Object.values(o)) if (typeof v === 'object') fn(v); } };
    fn(k); return k;
  }
  function novyFb(projekt, nazev) {
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,23}$/.test(nazev || '')) throw chyba('Název FB: písmena bez diakritiky, číslice a _, nejvýše 24 znaků, nezačíná číslicí.');
    if (nazev.toUpperCase() === 'MAIN' || najdiFb(projekt, nazev)) throw chyba(`Název „${nazev}“ už existuje.`);
    const f = B.FB(nazev, [['Vstup', 'IN', 'BOOL'], ['Vystup', 'OUT', 'BOOL']], [B.PRICKA('', [], [])]);
    (projekt.fb = projekt.fb || []).push(f);
    return f;
  }
  function prejmenujFb(projekt, stary, novy) {
    const f = najdiFb(projekt, stary); if (!f) throw chyba('FB neexistuje.');
    if (stary === novy) return;
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,23}$/.test(novy || '')) throw chyba('Neplatný název FB.');
    if (novy.toUpperCase() === 'MAIN' || najdiFb(projekt, novy)) throw chyba(`Název „${novy}“ už existuje.`);
    f.nazev = novy;
    for (const { prvek } of vsechnyPrvky(projekt)) if (prvek.typ === 'CALL' && prvek.fb === stary) prvek.fb = novy;
  }

  /* ---------- časovače, čítače, PID (čisté funkce nad instancí) ---------- */
  function novyCasovac(typ) { return { typ, Q: false, ET: 0, bezi: false, start: 0, IN: false, zaklad: 0 }; }
  function novyCitac(typ, pv) { return { typ, Q: typ === 'CTD' ? (pv <= 0) : (0 >= pv), QD: typ !== 'CTD', CV: typ === 'CTD' ? pv : 0, PV: pv, pred: false, predD: false }; }
  function ton(t, IN, cas, PT) {
    if (IN) { if (!t.bezi) { t.bezi = true; t.start = cas; } t.ET = Math.min(cas - t.start, PT); t.Q = t.ET >= PT; }
    else { t.bezi = false; t.ET = 0; t.Q = false; }
    t.IN = IN; return t.Q;
  }
  function tof(t, IN, cas, PT) {
    if (IN) { t.Q = true; t.ET = 0; t.bezi = false; }
    else if (t.Q) {
      if (!t.bezi) { t.bezi = true; t.start = cas; }
      t.ET = Math.min(cas - t.start, PT);
      if (t.ET >= PT) { t.Q = false; t.bezi = false; }
    }
    t.IN = IN; return t.Q;
  }
  /* TP: náběžná hrana IN (mimo běžící impulz) spustí impulz délky PT; ET zůstane na PT, dokud IN trvá */
  function tp(t, IN, cas, PT) {
    if (!t.bezi && IN && !t.IN) { t.bezi = true; t.start = cas; }
    if (t.bezi) { t.ET = Math.min(cas - t.start, PT); if (t.ET >= PT) t.bezi = false; }
    else if (!IN) t.ET = 0;
    t.Q = t.bezi; t.IN = IN; return t.Q;
  }
  /* RTO: jako TON, ale při poklesu IN si ET pamatuje; nuluje jen RES */
  function rto(t, IN, cas, PT) {
    if (IN) { if (!t.bezi) { t.bezi = true; t.start = cas; t.zaklad = t.ET; } t.ET = Math.min(t.zaklad + cas - t.start, PT); }
    else t.bezi = false;
    t.Q = t.ET >= PT; t.IN = IN; return t.Q;
  }
  const FUNKCE_CASOVACE = { TON: ton, TOF: tof, TP: tp, RTO: rto };
  function ctu(c, CU, PV) { c.PV = PV; if (CU && !c.pred && c.CV < CV_MAX) c.CV++; c.pred = CU; c.Q = c.CV >= PV; return c.Q; }
  function ctd(c, CD, PV) { c.PV = PV; if (CD && !c.pred && c.CV > CV_MIN) c.CV--; c.pred = CD; c.Q = c.CV <= 0; return c.Q; }
  function ctud(c, CU, CD, PV) {
    c.PV = PV;
    if (CU && !c.pred && c.CV < CV_MAX) c.CV++;
    if (CD && !c.predD && c.CV > CV_MIN) c.CV--;
    c.pred = CU; c.predD = CD; c.Q = c.CV >= PV; c.QD = c.CV <= 0; return c.Q;
  }
  /* PID v polohovém tvaru: u = Kp·e + I + D, I += Kp·dt/Ti·e, D na měřené veličině s filtrem (N = 10).
     Anti-windup: podmíněná integrace + integrál omezený na rozsah výstupu. V ručním režimu integrál
     sleduje ruční hodnotu (bezrázové přepnutí ruční → automat). Aktivace bloku začíná s I = 0. dt v sekundách. */
  const PID_N = 10;
  function pidKrok(st, p) {
    const omez = x => Math.min(p.omax, Math.max(p.omin, x));
    const e = p.sp - p.pv;
    const omezI = x => Math.min(p.omax, Math.max(p.omin, x));    // integrál drží v rozsahu výstupu
    if (!st.init) { st.init = true; st.I = 0; st.D = 0; st.pvPred = p.pv; }   // aktivace = čistý start (I = 0)
    const P = p.kp * e;
    if (p.td > 0 && p.dt > 0) { const j = p.td + PID_N * p.dt; st.D = (p.td / j) * st.D - (p.kp * p.td * PID_N / j) * (p.pv - st.pvPred); } else st.D = 0;
    let out;
    if (p.man) { out = omez(p.mval); st.I = omezI(out - P - st.D); }
    else {
      if (p.ti > 0 && p.dt > 0) {
        const In = st.I + p.kp * p.dt / p.ti * e;
        const u = P + In + st.D;
        if (!((u > p.omax && e * Math.sign(p.kp || 1) > 0) || (u < p.omin && e * Math.sign(p.kp || 1) < 0))) st.I = omezI(In);   // anti-windup
      }
      out = omez(P + st.I + st.D);
    }
    st.pvPred = p.pv; st.P = P; st.e = e; st.out = out;
    return out;
  }

  /* ---------- stav PLC ---------- */
  function jeRemanentni(projekt, klic) {
    const r = projekt.remanence || {}, a = rozeberAdresu(klic); if (!a) return false;
    if (a.oblast === 'M') return a.bajt >= (r.M === undefined ? 99 : r.M);
    if (a.oblast === 'MW') return a.cislo >= (r.MW === undefined ? 999 : r.MW);
    if (a.oblast === 'MD') return a.cislo >= (r.MD === undefined ? 999 : r.MD);
    return false;
  }
  /* restart: 'studeny' vše nuluje; 'teply' zachová remanentní oblasti (M, MW, MD od nastavené adresy, čítače, RTO, instance FB) */
  function vytvorStav(projekt, stary, restart) {
    const stav = { I: {}, Q: {}, M: {}, W: {}, T: {}, C: {}, hrany: {}, pid: {}, inst: {}, vystupy: {}, cas: 0, cyklus: 0, stopa: {}, pricky: [],
      chybyBehu: {}, pocetChyb: 0, chybaVCyklu: false, chybaPred: false, preteceni: false, doba: { posl: 0, min: Infinity, max: 0, soucet: 0, n: 0 }, beh: null, perioda: projekt.perioda || 100, vynuceno: false };
    for (const { prvek, fb } of vsechnyPrvky(projekt)) {
      if (fb) continue;
      const a = rozeberAdresu(prvek.adr); if (!a) continue;
      if (CASOVACE.includes(prvek.typ) && a.oblast === 'T' && !stav.T[a.klic]) stav.T[a.klic] = novyCasovac(prvek.typ);
      if (CITACE.includes(prvek.typ) && a.oblast === 'C' && !stav.C[a.klic]) stav.C[a.klic] = novyCitac(prvek.typ, +prvek.pv || 0);
    }
    if (stary && restart === 'teply') {
      const r = projekt.remanence || {};
      for (const [k, v] of Object.entries(stary.M)) if (jeRemanentni(projekt, k)) stav.M[k] = v;
      for (const [k, v] of Object.entries(stary.W)) if (jeRemanentni(projekt, k)) stav.W[k] = v;
      if (r.C) for (const [k, c] of Object.entries(stary.C)) if (stav.C[k] && stav.C[k].typ === c.typ) stav.C[k] = Object.assign(c, { pred: false, predD: false });
      if (r.RTO) for (const [k, t] of Object.entries(stary.T)) if (t.typ === 'RTO' && stav.T[k] && stav.T[k].typ === 'RTO') stav.T[k] = Object.assign(novyCasovac('RTO'), { ET: t.ET, Q: t.Q });
      if (r.FB) for (const [k, i] of Object.entries(stary.inst)) stav.inst[k] = { fb: i.fb, v: i.v, tim: {}, cnt: i.cnt, hrany: {}, pid: {}, stopa: {} };
    }
    return stav;
  }

  /* kontext vyhodnocení: stav, lokální instance (v FB), paměti hran a PID */
  function bitSystemu(stav, a) {
    switch (a.bit) {
      case 0: return true;
      case 1: return stav.cyklus === 0;
      case 2: return Math.floor(stav.cas / 50) % 2 === 1;
      case 3: return Math.floor(stav.cas / 500) % 2 === 1;
      case 4: return Math.floor(stav.cas / 1000) % 2 === 1;
      case 5: return stav.chybaPred;
      case 6: return stav.preteceni;
      case 7: return stav.vynuceno;
    }
    return false;
  }
  function ctiBitA(ctx, a) {
    const stav = ctx.stav;
    switch (a.oblast) {
      case 'I': return !!stav.I[a.klic];
      case 'Q': return !!stav.Q[a.klic];
      case 'M': return !!stav.M[a.klic];
      case 'S': return bitSystemu(stav, a);
      case 'T': return !!(stav.T[a.klic] && stav.T[a.klic].Q);
      case 'C': return !!(stav.C[a.klic] && stav.C[a.klic].Q);
      case '#': {
        const l = ctx.lokal; if (!l) return false;
        if (l.tim[a.nazev]) return !!l.tim[a.nazev].Q;
        if (l.cnt[a.nazev]) return !!l.cnt[a.nazev].Q;
        return !!l.v[a.nazev];
      }
      default: return !!ctiCisloA(ctx, a);
    }
  }
  function ctiCisloA(ctx, a) {
    const stav = ctx.stav;
    switch (a.oblast) {
      case 'IW': case 'QW': case 'MW': case 'MD': return stav.W[a.klic] || 0;
      case 'SW': return [Math.min(INT_MAX, Math.round(stav.doba.posl)), stav.cyklus % 32768, Math.min(INT_MAX, stav.pocetChyb), stav.perioda][a.cislo] || 0;
      case 'T': return stav.T[a.klic] ? stav.T[a.klic].ET : 0;
      case 'C': return stav.C[a.klic] ? stav.C[a.klic].CV : 0;
      case '#': {
        const l = ctx.lokal; if (!l) return 0;
        if (l.tim[a.nazev]) return l.tim[a.nazev].ET;
        if (l.cnt[a.nazev]) return l.cnt[a.nazev].CV;
        const v = l.v[a.nazev]; return typeof v === 'boolean' ? (v ? 1 : 0) : (v || 0);
      }
      default: return ctiBitA(ctx, a) ? 1 : 0;
    }
  }
  function ctiOperand(ctx, text) {
    const o = rozeberOperand(text); if (!o) return 0;
    return o.druh === 'konst' ? o.hodnota : ctiCisloA(ctx, o.a);
  }
  function jeRealOperand(ctx, text) {
    const o = rozeberOperand(text); if (!o) return false;
    if (o.druh === 'konst') return o.typ === 'REAL';
    if (o.a.oblast === 'MD') return true;
    if (o.a.oblast === '#' && ctx.lokalTypy) return ctx.lokalTypy[o.a.nazev] === 'REAL';
    return false;
  }
  function chybaBehu(ctx, prvek, zprava) {
    const s = ctx.stav, k = (ctx.pouNazev || 'MAIN') + '|' + (prvek ? prvek.id : '') + '|' + zprava;
    s.chybaVCyklu = true; s.pocetChyb++;
    const z = s.chybyBehu[k] || (s.chybyBehu[k] = { zprava, pou: ctx.pouNazev || 'MAIN', prvek: prvek ? prvek.id : null, pocet: 0, cyklus: 0 });
    z.pocet++; z.cyklus = s.cyklus;
  }
  const zaokrouhli = x => Math.sign(x) * Math.round(Math.abs(x));
  function ulozCislo(ctx, text, hodnota, prvek) {
    const o = rozeberOperand(text);
    if (!o || o.druh !== 'adr') return;
    const a = o.a, stav = ctx.stav;
    if (!Number.isFinite(hodnota)) { chybaBehu(ctx, prvek, 'Výsledek není konečné číslo – zápis vynechán.'); return; }
    const doInt = v => { let r = zaokrouhli(v); if (r > INT_MAX || r < INT_MIN) { chybaBehu(ctx, prvek, `Přetečení INT (${cisloText(v)}) – hodnota omezena.`); r = Math.max(INT_MIN, Math.min(INT_MAX, r)); } return r; };
    switch (a.oblast) {
      case 'MW': case 'QW': stav.W[a.klic] = doInt(hodnota); break;
      case 'MD': stav.W[a.klic] = hodnota; break;
      case 'Q': stav.Q[a.klic] = hodnota !== 0; break;
      case 'M': stav.M[a.klic] = hodnota !== 0; break;
      case '#': {
        const l = ctx.lokal; if (!l) return;
        const t = ctx.lokalTypy && ctx.lokalTypy[a.nazev];
        l.v[a.nazev] = t === 'BOOL' ? hodnota !== 0 : t === 'INT' ? doInt(hodnota) : hodnota;
        break;
      }
    }
  }
  function ulozBit(ctx, text, h) {
    const a = rozeberAdresu(text); if (!a) return;
    if (a.oblast === 'Q') ctx.stav.Q[a.klic] = !!h;
    else if (a.oblast === 'M') ctx.stav.M[a.klic] = !!h;
    else if (a.oblast === '#' && ctx.lokal) ctx.lokal.v[a.nazev] = !!h;
  }
  const cisloText = v => (Math.round(v * 1000) / 1000).toString().replace('.', ',');

  function porovnej(a, op, b) {
    switch (op) { case '==': return a === b; case '<>': return a !== b; case '<': return a < b; case '<=': return a <= b; case '>': return a > b; case '>=': return a >= b; }
    return false;
  }
  function vyhodnotSerii(s, vstup, ctx) {
    let p = vstup;
    for (const x of s.prvky) p = vyhodnotUzel(x, p, ctx);
    ctx.stopa[s.id] = { vstup, vystup: p };
    return p;
  }
  function pocitej(ctx, typ) {
    ctx.instr++; ctx.cena += CENA[typ] || 0.5;
    if (ctx.instr > LIMIT_INSTR) { const e = chyba('Hlídací čas (watchdog): v jednom cyklu se provedlo přes ' + LIMIT_INSTR + ' instrukcí.'); e.watchdog = true; throw e; }
  }
  function vyhodnotUzel(x, vstup, ctx) {
    pocitej(ctx, x.typ);
    if (x.typ === 'PAR') {
      let out = false;
      for (const v of x.vetve) out = vyhodnotSerii(v, vstup, ctx) || out;
      ctx.stopa[x.id] = { vstup, vystup: out };
      return out;
    }
    let sepnuto, hodnota;
    if (x.typ === 'CMP') {
      const a = ctiOperand(ctx, x.in1), b = ctiOperand(ctx, x.in2);
      sepnuto = porovnej(a, x.op, b); hodnota = sepnuto;
      ctx.stopa[x.id] = { vstup, vystup: vstup && sepnuto, sepnuto, hodnota, a, b, poradi: ++ctx.poradi };
      return vstup && sepnuto;
    }
    const ad = rozeberAdresu(x.adr);
    if (ad) hodnota = ctiBitA(ctx, ad);
    else { const k = rozeberOperand(x.adr); hodnota = !!(k && k.druh === 'konst' && k.hodnota); }
    switch (x.typ) {
      case 'NO': sepnuto = hodnota; break;
      case 'NC': sepnuto = !hodnota; break;
      case 'P': sepnuto = hodnota && !ctx.hrany[x.id]; ctx.hrany[x.id] = hodnota; break;
      case 'N': sepnuto = !hodnota && !!ctx.hrany[x.id]; ctx.hrany[x.id] = hodnota; break;
      default: sepnuto = false;
    }
    const vystup = vstup && sepnuto;
    ctx.stopa[x.id] = { vstup, vystup, sepnuto, hodnota, poradi: ++ctx.poradi };
    return vystup;
  }
  /* instance časovače/čítače podle operandu (globální T/C nebo lokální #jméno) */
  function instanceTC(ctx, adr, druh, typ, pv) {
    const a = rozeberAdresu(adr); if (!a) return null;
    if (a.oblast === '#') {
      const l = ctx.lokal; if (!l) return null;
      const mapa = druh === 'T' ? l.tim : l.cnt;
      if (!mapa[a.nazev] || mapa[a.nazev].typ !== typ) mapa[a.nazev] = druh === 'T' ? novyCasovac(typ) : novyCitac(typ, pv);
      return mapa[a.nazev];
    }
    if (a.oblast !== druh) return null;
    const mapa = druh === 'T' ? ctx.stav.T : ctx.stav.C;
    if (!mapa[a.klic] || mapa[a.klic].typ !== typ) mapa[a.klic] = druh === 'T' ? novyCasovac(typ) : novyCitac(typ, pv);
    return mapa[a.klic];
  }
  function provedVystup(v, napajeni, ctx) {
    pocitej(ctx, v.typ);
    const stav = ctx.stav;
    const z = { vstup: napajeni, poradi: ++ctx.poradi };
    const hrana = () => { const pred = !!ctx.hrany[v.id]; ctx.hrany[v.id] = napajeni; return pred; };
    switch (v.typ) {
      case 'CIVKA': ulozBit(ctx, v.adr, napajeni); break;
      case 'NCIVKA': ulozBit(ctx, v.adr, !napajeni); break;
      case 'SET': if (napajeni) ulozBit(ctx, v.adr, true); break;
      case 'RESET': if (napajeni) ulozBit(ctx, v.adr, false); break;
      case 'R_TRIG': { const p = hrana(); ulozBit(ctx, v.adr, napajeni && !p); break; }
      case 'F_TRIG': { const p = hrana(); ulozBit(ctx, v.adr, !napajeni && p); break; }
      case 'SR': case 'RS': {
        const a = rozeberAdresu(v.adr); const q = a ? ctiBitA(ctx, a) : false;
        const r1 = v.r ? ctiBitA(ctx, rozeberAdresu(v.r) || { oblast: 'x' }) : false;
        const nq = v.typ === 'SR' ? (napajeni || (q && !r1)) : (!r1 && (napajeni || q));
        ulozBit(ctx, v.adr, nq); z.Q = nq; break;
      }
      case 'TON': case 'TOF': case 'TP': case 'RTO': {
        const t = instanceTC(ctx, v.adr, 'T', v.typ); if (!t) break;
        const pt = Math.max(0, +v.pt || 0);
        FUNKCE_CASOVACE[v.typ](t, napajeni, stav.cas, pt);
        z.Q = t.Q; z.ET = t.ET; z.PT = pt; break;
      }
      case 'CTU': case 'CTD': case 'CTUD': {
        const pv = Math.round(+v.pv || 0);
        const c = instanceTC(ctx, v.adr, 'C', v.typ, pv); if (!c) break;
        if (v.typ === 'CTU') ctu(c, napajeni, pv);
        else if (v.typ === 'CTD') ctd(c, napajeni, pv);
        else { const cd = v.cd ? ctiBitA(ctx, rozeberAdresu(v.cd) || { oblast: 'x' }) : false; ctud(c, napajeni, cd, pv); }
        z.Q = c.Q; z.CV = c.CV; z.PV = pv; break;
      }
      case 'RES': if (napajeni) {
        const a = rozeberAdresu(v.adr); if (!a) break;
        let obj = null;
        if (a.oblast === 'T') obj = stav.T[a.klic];
        else if (a.oblast === 'C') obj = stav.C[a.klic];
        else if (a.oblast === '#' && ctx.lokal) obj = ctx.lokal.tim[a.nazev] || ctx.lokal.cnt[a.nazev];
        if (obj && obj.ET !== undefined && obj.CV === undefined) Object.assign(obj, { Q: false, ET: 0, bezi: false, zaklad: 0 });
        else if (obj) { obj.CV = obj.typ === 'CTD' ? obj.PV : 0; obj.Q = obj.typ === 'CTD' ? obj.CV <= 0 : obj.CV >= obj.PV; obj.QD = obj.CV <= 0; }
      } break;
      case 'MOVE': if (napajeni) { const h = ctiOperand(ctx, v.in); ulozCislo(ctx, v.out, h, v); z.hodnota = h; } break;
      case 'ADD': case 'SUB': case 'MUL': case 'DIV': case 'MOD': if (napajeni) {
        const a = ctiOperand(ctx, v.in1), b = ctiOperand(ctx, v.in2);
        const real = jeRealOperand(ctx, v.in1) || jeRealOperand(ctx, v.in2);
        let r;
        if (v.typ === 'ADD') r = a + b; else if (v.typ === 'SUB') r = a - b; else if (v.typ === 'MUL') r = a * b;
        else if (b === 0) { chybaBehu(ctx, v, `Dělení nulou (${v.typ}) – výstup nezměněn.`); break; }
        else if (v.typ === 'DIV') r = real ? a / b : Math.trunc(a / b);
        else r = a - b * Math.trunc(a / b);
        ulozCislo(ctx, v.out, r, v); z.hodnota = r;
      } break;
      case 'SCALE': if (napajeni) {
        const x = ctiOperand(ctx, v.in), i0 = ctiOperand(ctx, v.inmin), i1 = ctiOperand(ctx, v.inmax), o0 = ctiOperand(ctx, v.outmin), o1 = ctiOperand(ctx, v.outmax);
        if (i1 === i0) { chybaBehu(ctx, v, 'SCALE: IN min = IN max.'); break; }
        let r = o0 + (x - i0) * (o1 - o0) / (i1 - i0);
        r = Math.min(Math.max(o0, o1), Math.max(Math.min(o0, o1), r));
        ulozCislo(ctx, v.out, r, v); z.hodnota = r;
      } break;
      case 'LIMIT': if (napajeni) {
        const mn = ctiOperand(ctx, v.mn), x = ctiOperand(ctx, v.in), mx = ctiOperand(ctx, v.mx);
        const r = Math.min(mx, Math.max(mn, x)); ulozCislo(ctx, v.out, r, v); z.hodnota = r;
      } break;
      case 'PID': {
        const st = ctx.pid[v.id] || (ctx.pid[v.id] = { init: false, tPosl: null, aktivni: false });
        if (!napajeni) { st.aktivni = false; z.out = st.out; break; }
        const ts = Math.max(0, +v.ts || 0);
        if (!st.aktivni) { st.aktivni = true; st.init = false; st.tPosl = stav.cas - (ts || ctx.perioda); }
        const dtMs = stav.cas - st.tPosl;
        if (ts && dtMs < ts) { z.out = st.out; z.P = st.P; z.I = st.I; z.D = st.D; break; }
        st.tPosl = stav.cas;
        const p = { pv: ctiOperand(ctx, v.pv), sp: ctiOperand(ctx, v.sp), kp: +v.kp || 0, ti: +v.ti || 0, td: +v.td || 0,
          omin: +v.omin, omax: +v.omax, man: v.man ? ctiBitA(ctx, rozeberAdresu(v.man) || { oblast: 'x' }) : false,
          mval: v.mval ? ctiOperand(ctx, v.mval) : 0, dt: dtMs / 1000 };
        if (!(p.omax > p.omin)) { chybaBehu(ctx, v, 'PID: OUT max musí být větší než OUT min.'); break; }
        const out = pidKrok(st, p);
        ulozCislo(ctx, v.out, out, v);
        Object.assign(z, { out, P: st.P, I: st.I, D: st.D, e: st.e, man: p.man });
        break;
      }
      case 'CALL': if (napajeni) volejFb(v, ctx, z); break;
    }
    if (CIVKY.includes(v.typ) || v.typ === 'R_TRIG' || v.typ === 'F_TRIG') { const a = rozeberAdresu(v.adr); z.hodnota = a ? ctiBitA(ctx, a) : false; }
    ctx.stopa[v.id] = z;
  }
  function volejFb(v, ctx, z) {
    const fb = najdiFb(ctx.projekt, v.fb);
    if (!fb) { chybaBehu(ctx, v, `Funkční blok „${v.fb}“ neexistuje.`); return; }
    if (!v.inst) { chybaBehu(ctx, v, 'CALL bez instance.'); return; }
    if (ctx.hloubka >= MAX_HLOUBKA) { const e = chyba(`Přetečení zásobníku volání (vnoření FB > ${MAX_HLOUBKA}).`); e.watchdog = true; throw e; }
    const stav = ctx.stav;
    let inst = stav.inst[v.inst];
    if (!inst || inst.fb !== fb.nazev) inst = stav.inst[v.inst] = { fb: fb.nazev, v: {}, tim: {}, cnt: {}, hrany: {}, pid: {}, stopa: {} };
    const typy = {};
    for (const r of fb.rozhrani) { typy[r.nazev] = r.typ; if (inst.v[r.nazev] === undefined) inst.v[r.nazev] = r.typ === 'BOOL' ? false : 0; }
    const prm = v.prm || {};
    // vstupy se zkopírují do instance
    for (const r of fb.rozhrani) if (r.smer === 'IN' && prm[r.nazev]) {
      const o = rozeberOperand(prm[r.nazev]); if (!o) continue;
      const h = o.druh === 'konst' ? o.hodnota : (r.typ === 'BOOL' ? (ctiBitA(ctx, o.a) ? 1 : 0) : ctiCisloA(ctx, o.a));
      inst.v[r.nazev] = r.typ === 'BOOL' ? h !== 0 : r.typ === 'INT' ? Math.max(INT_MIN, Math.min(INT_MAX, zaokrouhli(h))) : h;
    }
    const dite = { stav, projekt: ctx.projekt, stopa: inst.stopa, poradi: 0, hrany: inst.hrany, pid: inst.pid, lokal: inst, lokalTypy: typy,
      hloubka: ctx.hloubka + 1, pouNazev: fb.nazev, perioda: ctx.perioda, instr: ctx.instr, cena: ctx.cena };
    for (const p of fb.pricky) {
      const r = vyhodnotSerii(p.podminka, true, dite);
      for (const o of p.vystupy) provedVystup(o, r, dite);
    }
    ctx.instr = dite.instr; ctx.cena = dite.cena;
    // výstupy instance → operandy volajícího
    for (const r of fb.rozhrani) if (r.smer === 'OUT' && prm[r.nazev]) {
      const h = inst.v[r.nazev];
      if (r.typ === 'BOOL') ulozBit(ctx, prm[r.nazev], !!h); else ulozCislo(ctx, prm[r.nazev], +h || 0, v);
    }
    z.Q = true;
  }

  /* ---------- cyklus: po částech (pro ladění po příčkách) i celý ---------- */
  function zacniCyklus(projekt, stav, vstupy, volby) {
    const o = volby || {};
    stav.I = {};
    for (const k of Object.keys(vstupy || {})) {
      const a = rozeberAdresu(k);
      if (a && a.oblast === 'I') stav.I[a.klic] = !!vstupy[k];
      else if (a && a.oblast === 'IW') { const v = +vstupy[k]; stav.W[a.klic] = Number.isFinite(v) ? Math.max(INT_MIN, Math.min(INT_MAX, Math.round(v))) : 0; }
    }
    const force = o.force || {};
    stav.vynuceno = Object.keys(force).length > 0;
    for (const [k, v] of Object.entries(force)) {
      const a = rozeberAdresu(k); if (!a) continue;
      if (a.oblast === 'I') stav.I[a.klic] = !!v;
      if (a.oblast === 'IW') stav.W[a.klic] = Math.max(INT_MIN, Math.min(INT_MAX, Math.round(+v || 0)));
    }
    stav.perioda = o.perioda || projekt.perioda || 100;
    stav.chybaVCyklu = false;
    const ctx = { stav, projekt, stopa: {}, poradi: 0, hrany: stav.hrany, pid: stav.pid, lokal: null, lokalTypy: null, hloubka: 0, pouNazev: 'MAIN',
      perioda: stav.perioda, instr: 0, cena: 0 };
    stav.beh = { ctx, dalsi: 0, force };
    stav.pricky = [];
    return stav;
  }
  function provedPricku(projekt, stav) {
    const b = stav.beh; if (!b || b.dalsi >= projekt.pricky.length) return -1;
    const i = b.dalsi, p = projekt.pricky[i];
    const r = vyhodnotSerii(p.podminka, true, b.ctx);
    for (const v of p.vystupy) provedVystup(v, r, b.ctx);
    stav.pricky[i] = r;
    b.dalsi++;
    stav.stopa = b.ctx.stopa;
    return i;
  }
  function dokonciCyklus(projekt, stav) {
    const b = stav.beh;
    while (b.dalsi < projekt.pricky.length) provedPricku(projekt, stav);
    // zápis výstupů (+ vynucení)
    const v = {};
    for (const a of VSECHNY_Q) v[a] = !!stav.Q[a];
    for (const a of VSECHNY_QW) v[a] = stav.W[a] || 0;
    for (const [k, h] of Object.entries(b.force)) {
      const a = rozeberAdresu(k); if (!a) continue;
      if (a.oblast === 'Q') v[a.klic] = !!h;
      if (a.oblast === 'QW') v[a.klic] = Math.max(INT_MIN, Math.min(INT_MAX, Math.round(+h || 0)));
    }
    stav.vystupy = v;
    stav.stopa = b.ctx.stopa;
    // model doby cyklu
    const t = ZAKLAD_CYKLU + b.ctx.cena;
    const d = stav.doba;
    d.posl = t; d.min = Math.min(d.min, t); d.max = Math.max(d.max, t); d.soucet += t; d.n++;
    stav.preteceni = t > stav.perioda * 1000;
    stav.chybaPred = stav.chybaVCyklu;
    stav.instrukci = b.ctx.instr;
    stav.beh = null;
    stav.cyklus++;
    stav.cas += stav.perioda;
    const wd = (projekt.watchdog || 500) * 1000;
    if (t > wd) { const e = chyba(`Hlídací čas (watchdog): model doby cyklu ${Math.round(t)} µs > ${projekt.watchdog || 500} ms.`); e.watchdog = true; throw e; }
    return stav;
  }
  function cyklus(projekt, stav, vstupy, perioda, volby) {
    zacniCyklus(projekt, stav, vstupy, Object.assign({ perioda }, volby || {}));
    return dokonciCyklus(projekt, stav);
  }
  /* zápis hodnoty (modify) mimo program – z tabulky sledování */
  function zapisHodnotu(stav, text, hodnota) {
    const a = rozeberAdresu(text);
    if (!a) throw chyba('Neplatná adresa.');
    const ctx = { stav, lokal: null, stopa: {}, hrany: {}, pid: {} };
    if (a.oblast === 'Q' || a.oblast === 'M') { stav[a.oblast][a.klic] = !!+hodnota; return; }
    if (a.oblast === 'MW' || a.oblast === 'MD' || a.oblast === 'QW') { ulozCislo(ctx, a.klic, +hodnota, null); return; }
    if (a.oblast === 'C' && stav.C[a.klic]) { const c = stav.C[a.klic]; c.CV = Math.max(CV_MIN, Math.min(CV_MAX, Math.round(+hodnota))); c.Q = c.typ === 'CTD' ? c.CV <= 0 : c.CV >= c.PV; return; }
    throw chyba(`Do ${a.klic} nelze zapisovat (vstupy čte PLC z procesu – použijte vynucení; systémové a časovačové hodnoty jsou jen ke čtení).`);
  }
  /* hodnota operandu pro zobrazení (lokal = instance FB nebo null) */
  function hodnota(stav, text, lokal, lokalTypy) {
    const o = rozeberOperand(text); if (!o) return null;
    if (o.druh === 'konst') return o.hodnota;
    const ctx = { stav, lokal, lokalTypy };
    const a = o.a;
    if (a.typ === 'BOOL') return ctiBitA(ctx, a) ? 1 : 0;
    if (a.oblast === '#' && lokal && !lokal.tim[a.nazev] && !lokal.cnt[a.nazev] && typeof lokal.v[a.nazev] === 'boolean') return lokal.v[a.nazev] ? 1 : 0;
    return ctiCisloA(ctx, a);
  }
  function ctiBit(stav, adr) { const a = rozeberAdresu(adr); return a ? ctiBitA({ stav, lokal: null }, a) : false; }

  function poradiVyhodnoceni(pou) {
    const r = {}; let n = 0;
    const ser = s => { for (const x of s.prvky) { if (x.typ === 'PAR') x.vetve.forEach(ser); else r[x.id] = ++n; } };
    pou.pricky.forEach(p => { ser(p.podminka); p.vystupy.forEach(v => { r[v.id] = ++n; }); });
    return r;
  }

  /* ---------- diagnostika ---------- */
  const POPIS_ROZSAHU = `I0.0–I1.7, Q0.0–Q1.7, M0.0–M7.7, S0.0–S0.7, IW0–IW7, QW0–QW7, MW0–MW63, MD0–MD31, SW0–SW3, T0–T31, C0–C31, v FB #jméno`;
  function operandyPrvku(v) {   // [klíč, text, druh]
    const d = INSTR[v.typ]; if (!d) return [];
    const r = d.param.filter(p => !['ms', 'int', 'real', 'op', 'fb', 'inst'].includes(p[2])).map(p => [p[0], v[p[0]], p[2]]);
    if (v.typ === 'CALL') for (const [k, t] of Object.entries(v.prm || {})) r.push(['prm.' + k, t, 'prm']);
    return r;
  }
  function diagnostika(projekt) {
    const d = [];
    const pridej = (uroven, pou, pricka, prvek, zprava) => d.push({ uroven, pou, pricka, prvek: prvek ? prvek.id : null, zprava });
    if (!(projekt.perioda >= PERIODA_MIN && projekt.perioda <= PERIODA_MAX)) pridej('chyba', 'MAIN', -1, null, `Perioda cyklu musí být ${PERIODA_MIN}–${PERIODA_MAX} ms.`);
    if (!(projekt.watchdog >= 10 && projekt.watchdog <= 10000)) pridej('chyba', 'MAIN', -1, null, 'Hlídací čas (watchdog) musí být 10–10 000 ms.');
    const zapisyDle = {};   // pou → adresa → [příčky]
    const casovace = {}, citace = {}, sety = {}, resety = {}, instance = {};
    const fbNazvy = new Set((projekt.fb || []).map(f => f.nazev));
    const fbNazvyVse = (projekt.fb || []).map(f => f.nazev);
    fbNazvyVse.forEach((n, i) => { if (fbNazvyVse.indexOf(n) !== i) pridej('chyba', n, -1, null, `Funkční blok „${n}“ je definován dvakrát.`); });
    for (const { nazev: pouN, pou, fb } of vsechnyPou(projekt)) {
      const lok = {}; if (fb) for (const r of fb.rozhrani || []) {
        if (!/^[A-Za-z_][A-Za-z0-9_]{0,23}$/.test(r.nazev)) pridej('chyba', pouN, -1, null, `Neplatný název proměnné „${r.nazev}“ v rozhraní FB.`);
        else if (lok[r.nazev]) pridej('chyba', pouN, -1, null, `Proměnná #${r.nazev} je v rozhraní dvakrát.`);
        if (!TYPY.includes(r.typ) || !['IN', 'OUT', 'STAT'].includes(r.smer)) pridej('chyba', pouN, -1, null, `Proměnná #${r.nazev}: neznámý typ nebo směr.`);
        lok[r.nazev] = r;
      }
      const lokTC = {};  // lokální časovače/čítače
      const zapisy = zapisyDle[pouN] = {};
      const tcKlic = a => (a.oblast === '#' ? pouN + ':' : '') + a.klic;
      const kontrolaOperandu = (pi, v, klic, text, druh) => {
        const volitelny = druh === 'bitOpt' || druh === 'cisloOpt' || (druh === 'bit' && (v.typ === 'SR' || v.typ === 'RS' || v.typ === 'CTUD'));
        if ((text === undefined || text === '') && volitelny) return null;
        const o = rozeberOperand(text);
        const jm = INSTR[v.typ] ? (INSTR[v.typ].param.find(p => p[0] === klic) || [klic, klic])[1] : klic;
        if (!o) { pridej('chyba', pouN, pi, v, `${v.typ}: neplatný operand ${jm} „${text || '(prázdný)'}“. Povolené: ${POPIS_ROZSAHU}, konstanty (12, 2.5, T#2s).`); return null; }
        if (o.druh === 'adr' && o.a.oblast === '#') {
          if (!fb) { pridej('chyba', pouN, pi, v, `Lokální proměnná ${o.a.klic} lze použít jen uvnitř funkčního bloku.`); return null; }
          if (!lok[o.a.nazev] && !lokTC[o.a.nazev] && !['timer', 'counter', 'tc'].includes(druh)) {
            pridej('chyba', pouN, pi, v, `${o.a.klic} není deklarována v rozhraní FB ${pouN} (ani to není lokální časovač/čítač).`); return null;
          }
        }
        const zapis = druh === 'bitW' || druh === 'cisloW';
        if (zapis) {
          if (o.druh === 'konst') { pridej('chyba', pouN, pi, v, `${v.typ}: do konstanty nelze zapisovat (${jm}).`); return null; }
          const a = o.a;
          if (['I', 'IW', 'S', 'SW'].includes(a.oblast)) { pridej('chyba', pouN, pi, v, `Do ${a.klic} nelze zapisovat – ${a.oblast[0] === 'I' ? 'vstupy čte PLC z procesu' : 'systémová oblast je jen ke čtení'}.`); return null; }
          if (a.oblast === 'T' || a.oblast === 'C') { pridej('chyba', pouN, pi, v, `${a.klic} řídí jeho časovač/čítač; zapisovat do něj nelze (nulování: RES).`); return null; }
          if (druh === 'bitW' && a.slovo) { pridej('chyba', pouN, pi, v, `${v.typ} zapisuje bit – ${a.klic} je slovo (použijte MOVE).`); return null; }
          if (druh === 'bitW' && a.oblast === '#' && lok[a.nazev] && lok[a.nazev].typ !== 'BOOL') { pridej('chyba', pouN, pi, v, `${a.klic} je typu ${lok[a.nazev].typ}, cívka potřebuje BOOL.`); return null; }
          if (druh === 'cisloW' && a.typ === 'BOOL') pridej('varovani', pouN, pi, v, `${v.typ} zapisuje číslo do bitu ${a.klic} (nenulová hodnota = 1).`);
          if (druh === 'bitW' && a.oblast === '#' && lok[a.nazev] && lok[a.nazev].smer === 'IN') pridej('varovani', pouN, pi, v, `Zápis do vstupní proměnné ${a.klic} – při dalším volání ji přepíše hodnota parametru.`);
          if (a.oblast !== '#' || lok[a.nazev]) (zapisy[a.klic] = zapisy[a.klic] || []).push({ pi, typ: v.typ });
        }
        if ((druh === 'bit' || druh === 'bitOpt') && o.druh === 'adr' && o.a.slovo) { pridej('chyba', pouN, pi, v, `Kontakt/bitový vstup potřebuje bit – ${o.a.klic} je slovo (pro porovnání použijte CMP).`); return null; }
        if ((druh === 'cislo' || druh === 'cisloOpt') && o.druh === 'adr' && o.a.typ === 'BOOL') pridej('info', pouN, pi, v, `${v.typ}: bit ${o.a.klic} se v číselném operandu čte jako 0/1.`);
        if (druh === 'timer' && !(o.druh === 'adr' && (o.a.oblast === 'T' || o.a.oblast === '#'))) { pridej('chyba', pouN, pi, v, `Časovač musí mít adresu T0–T${LIMITY.T - 1}${fb ? ' nebo #jméno' : ''}.`); return null; }
        if (druh === 'counter' && !(o.druh === 'adr' && (o.a.oblast === 'C' || o.a.oblast === '#'))) { pridej('chyba', pouN, pi, v, `Čítač musí mít adresu C0–C${LIMITY.C - 1}${fb ? ' nebo #jméno' : ''}.`); return null; }
        if (druh === 'tc' && !(o.druh === 'adr' && ['T', 'C', '#'].includes(o.a.oblast))) { pridej('chyba', pouN, pi, v, 'RES nuluje jen časovač (T) nebo čítač (C); bity nulujte cívkou R.'); return null; }
        return o;
      };
      // první průchod: lokální časovače a čítače (aby je kontakty znaly)
      if (fb) pou.pricky.forEach(p => p.vystupy.forEach(v => {
        const a = rozeberAdresu(v.adr);
        if (a && a.oblast === '#' && (CASOVACE.includes(v.typ) || CITACE.includes(v.typ))) {
          if (lok[a.nazev]) pridej('chyba', pouN, -1, v, `${a.klic} je deklarována v rozhraní jako ${lok[a.nazev].typ}; lokální časovač/čítač musí mít vlastní jméno.`);
          lokTC[a.nazev] = v.typ;
        }
      }));
      pou.pricky.forEach((p, pi) => {
        const kontakty = [];
        prochazejSerii(p.podminka, (x) => {
          if (x.typ === 'PAR') { if (x.vetve.length < 2) pridej('chyba', pouN, pi, x, 'Paralelní blok musí mít alespoň dvě větve.'); }
          else if (x.typ === 'SERIE') { if (!x.prvky.length) pridej('chyba', pouN, pi, x, 'Prázdná paralelní větev zkratuje blok.'); }
          else if (KONTAKTY.includes(x.typ)) kontakty.push(x);
          else pridej('chyba', pouN, pi, x, `Prvek „${x.typ}“ nepatří do podmínky příčky.`);
        });
        for (const k of kontakty) {
          if (k.typ === 'CMP') {
            if (!OPERACE.includes(k.op)) pridej('chyba', pouN, pi, k, `CMP: neznámá operace „${k.op}“.`);
            kontrolaOperandu(pi, k, 'in1', k.in1, 'cislo'); kontrolaOperandu(pi, k, 'in2', k.in2, 'cislo');
            if ((k.op === '==' || k.op === '<>') && (jeRealText(k.in1, lok) || jeRealText(k.in2, lok))) pridej('info', pouN, pi, k, 'Porovnání REAL na přesnou rovnost je kvůli zaokrouhlení nespolehlivé – raději použijte <= / >=.');
            continue;
          }
          const o = kontrolaOperandu(pi, k, 'adr', k.adr, 'bit');
          if (o && o.druh === 'konst') pridej('varovani', pouN, pi, k, `Kontakt s konstantou ${k.adr} je vždy ${o.hodnota ? 'sepnutý' : 'rozepnutý'}.`);
        }
        if (!p.vystupy.length && !p.podminka.prvky.length) pridej('info', pouN, pi, null, 'Prázdná příčka – přidejte kontakty a výstup (při běhu se přeskočí).');
        else if (!p.vystupy.length) pridej('varovani', pouN, pi, null, 'Příčka nemá žádný výstup – její podmínka nic neovládá.');
        if (!p.podminka.prvky.length && p.vystupy.length) pridej('info', pouN, pi, null, 'Příčka nemá podmínku – výstupy se provádějí v každém cyklu.');
        for (const v of p.vystupy) {
          const def = INSTR[v.typ];
          if (!def || def.kat === 'kontakt') { pridej('chyba', pouN, pi, v, `Prvek „${v.typ}“ nepatří mezi výstupy.`); continue; }
          for (const [k, , druh] of def.param) if (!['ms', 'int', 'real', 'op', 'fb', 'inst'].includes(druh)) kontrolaOperandu(pi, v, k, v[k], druh);
          if (v.typ === 'SET') { const a = rozeberAdresu(v.adr); if (a) (sety[pouN + a.klic] = sety[pouN + a.klic] || { a: a.klic, pi, pou: pouN }); }
          if (v.typ === 'RESET' || v.typ === 'SR' || v.typ === 'RS') { const a = rozeberAdresu(v.adr); if (a) resety[pouN + a.klic] = true; }
          if (CASOVACE.includes(v.typ)) {
            const a = rozeberAdresu(v.adr);
            if (!(Number.isFinite(+v.pt) && +v.pt >= 0 && +v.pt <= PT_MAX)) pridej('chyba', pouN, pi, v, `Předvolba PT časovače ${v.adr} musí být 0–${PT_MAX / 1000} s.`);
            else if (+v.pt > 0 && +v.pt < projekt.perioda) pridej('varovani', pouN, pi, v, `PT časovače ${v.adr} (${v.pt} ms) je kratší než perioda cyklu – skutečné zpoždění bude ${projekt.perioda} ms.`);
            else if (+v.pt % projekt.perioda) pridej('info', pouN, pi, v, `PT časovače ${v.adr} není násobkem periody – zpoždění se zaokrouhlí nahoru na ${Math.ceil(v.pt / projekt.perioda) * projekt.perioda} ms.`);
            if (a) (casovace[tcKlic(a)] = casovace[tcKlic(a)] || []).push({ pi, v, pou: pouN });
          }
          if (CITACE.includes(v.typ)) {
            const a = rozeberAdresu(v.adr);
            if (!(Number.isInteger(+v.pv) && +v.pv >= 0 && +v.pv <= PV_MAX)) pridej('chyba', pouN, pi, v, `Předvolba PV čítače ${v.adr} musí být celé číslo 0–${PV_MAX}.`);
            if (a) (citace[tcKlic(a)] = citace[tcKlic(a)] || []).push({ pi, v, pou: pouN });
          }
          if (v.typ === 'PID') {
            for (const k of ['kp', 'ti', 'td', 'omin', 'omax']) if (!Number.isFinite(+v[k])) pridej('chyba', pouN, pi, v, `PID: parametr ${k} musí být číslo.`);
            if (+v.ti < 0 || +v.td < 0) pridej('chyba', pouN, pi, v, 'PID: Ti a Td nesmějí být záporné.');
            if (!(+v.omax > +v.omin)) pridej('chyba', pouN, pi, v, 'PID: OUT max musí být větší než OUT min.');
            if (!(Number.isFinite(+v.ts) && +v.ts >= 0)) pridej('chyba', pouN, pi, v, 'PID: Ts musí být ≥ 0 ms.');
            else if (+v.ts > 0 && +v.ts < projekt.perioda) pridej('varovani', pouN, pi, v, `PID: Ts ${v.ts} ms je kratší než perioda – regulátor poběží s periodou cyklu.`);
            if (+v.ti === 0) pridej('info', pouN, pi, v, 'PID: Ti = 0 vypíná integrační složku (P/PD regulátor s trvalou odchylkou).');
          }
          if (v.typ === 'CALL') {
            const f = najdiFb(projekt, v.fb);
            if (!f) { pridej('chyba', pouN, pi, v, `CALL: funkční blok „${v.fb || '(nezvolen)'}“ neexistuje.`); continue; }
            if (!/^[A-Za-z_][A-Za-z0-9_]{0,23}$/.test(v.inst || '')) { pridej('chyba', pouN, pi, v, `CALL ${v.fb}: chybí nebo je neplatný název instance.`); continue; }
            const ik = v.inst;
            if (instance[ik]) {
              if (instance[ik].fb !== v.fb) pridej('chyba', pouN, pi, v, `Instance „${ik}“ už patří bloku ${instance[ik].fb}.`);
              else pridej('varovani', pouN, pi, v, `Instance „${ik}“ se volá vícekrát (poprvé ${instance[ik].pou}, příčka ${instance[ik].pi + 1}) – volání sdílejí paměť.`);
            } else instance[ik] = { fb: v.fb, pou: pouN, pi };
            const rozh = Object.fromEntries(f.rozhrani.map(r => [r.nazev, r]));
            for (const [k, t] of Object.entries(v.prm || {})) {
              if (!t) continue;
              const r = rozh[k];
              if (!r || r.smer === 'STAT') { pridej('chyba', pouN, pi, v, `CALL ${v.fb}: blok nemá vstup/výstup „${k}“.`); continue; }
              kontrolaOperandu(pi, v, 'prm.' + k, t, r.smer === 'OUT' ? (r.typ === 'BOOL' ? 'bitW' : 'cisloW') : (r.typ === 'BOOL' ? 'bit' : 'cislo'));
            }
            for (const r of f.rozhrani) if (r.smer === 'IN' && !(v.prm || {})[r.nazev]) pridej('info', pouN, pi, v, `CALL ${v.inst}: vstup ${r.nazev} není připojen – drží poslední hodnotu.`);
          }
        }
      });
    }
    for (const [k, s] of Object.entries(casovace)) if (s.length > 1) s.slice(1).forEach(({ pi, v, pou }) => pridej('chyba', pou, pi, v, `Časovač ${v.adr} je použit vícekrát (poprvé ${s[0].pou}, příčka ${s[0].pi + 1}).`));
    for (const [k, s] of Object.entries(citace)) if (s.length > 1) s.slice(1).forEach(({ pi, v, pou }) => pridej('chyba', pou, pi, v, `Čítač ${v.adr} je použit vícekrát (poprvé ${s[0].pou}, příčka ${s[0].pi + 1}).`));
    for (const [pou, zap] of Object.entries(zapisyDle)) for (const [k, z] of Object.entries(zap)) {
      const civky = z.filter(x => x.typ === 'CIVKA' || x.typ === 'NCIVKA' || x.typ === 'R_TRIG' || x.typ === 'F_TRIG' || x.typ === 'SR' || x.typ === 'RS');
      if (civky.length > 1) pridej('varovani', pou, civky[civky.length - 1].pi, null, `Dvojí cívka: ${k} se přiřazuje v příčkách ${civky.map(x => x.pi + 1).join(', ')} (${pou}). Na výstup se dostane jen poslední zápis v cyklu.`);
      if (civky.length && z.some(x => x.typ === 'SET')) pridej('varovani', pou, z.find(x => x.typ === 'SET').pi, null, `${k} je zároveň ovládán cívkou a instrukcí S – cívka hodnotu v každém cyklu přepíše.`);
    }
    for (const [k, s] of Object.entries(sety)) if (!resety[k] && !(zapisyDle[s.pou][s.a] || []).some(x => x.typ !== 'SET'))
      pridej('info', s.pou, s.pi, null, `${s.a} se nastavuje instrukcí S, ale nikde se nenuluje (R) – po nastavení zůstane trvale 1.`);
    // čtení bez zdroje
    const zapsaneGlob = new Set(); for (const z of Object.values(zapisyDle)) for (const k of Object.keys(z)) zapsaneGlob.add(k);
    for (const { prvek, pricka, kde, pou } of vsechnyPrvky(projekt)) {
      if (!(kde === 'podminka' || prvek.typ === 'RES')) continue;
      const a = rozeberAdresu(prvek.adr || ''); if (!a) continue;
      if (a.oblast === 'T' && !casovace[a.klic]) pridej('varovani', pou, pricka, prvek, `${a.klic} není v programu definován (chybí TON/TOF/TP/RTO) – jeho bit je stále 0.`);
      if (a.oblast === 'C' && !citace[a.klic]) pridej('varovani', pou, pricka, prvek, `${a.klic} není v programu definován (chybí CTU/CTD/CTUD) – jeho bit je stále 0.`);
      if (a.oblast === 'M' && !zapsaneGlob.has(a.klic) && !jeRemanentni(projekt, a.klic)) pridej('info', pou, pricka, prvek, `Paměťový bit ${a.klic} se nikde nezapisuje – je stále 0.`);
    }
    // rekurze volání FB
    const graf = {};
    for (const { prvek, pou } of vsechnyPrvky(projekt)) if (prvek.typ === 'CALL') (graf[pou] = graf[pou] || new Set()).add(prvek.fb);
    const stavDfs = {};
    const dfs = (u, cesta) => {
      if (stavDfs[u] === 1) { const c = cesta.slice(cesta.indexOf(u)).concat(u); pridej('chyba', u, -1, null, `Rekurzivní volání funkčních bloků: ${c.join(' → ')} (zásobník volání by přetekl).`); return; }
      if (stavDfs[u] === 2) return;
      stavDfs[u] = 1; for (const w of graf[u] || []) if (fbNazvy.has(w)) dfs(w, cesta.concat(u)); stavDfs[u] = 2;
    };
    dfs('MAIN', []); for (const f of fbNazvy) dfs(f, []);
    for (const f of projekt.fb || []) if (!vsechnyPrvky(projekt).some(x => x.prvek.typ === 'CALL' && x.prvek.fb === f.nazev)) pridej('info', f.nazev, -1, null, `Funkční blok ${f.nazev} se nikde nevolá.`);
    return d;
  }
  function jeRealText(t, lok) { const o = rozeberOperand(t); if (!o) return false; if (o.druh === 'konst') return o.typ === 'REAL'; if (o.a.oblast === 'MD') return true; return o.a.oblast === '#' && lok[o.a.nazev] && lok[o.a.nazev].typ === 'REAL'; }
  function maChyby(d) { return d.some(x => x.uroven === 'chyba'); }

  /* ---------- křížové odkazy ---------- */
  function krizoveOdkazy(projekt) {
    const r = [];
    const pridej = (adr, pou, pricka, prvek, pristup, popis) => { const a = rozeberAdresu(adr || ''); if (a) r.push({ adr: a.klic, pou, pricka, prvek: prvek.id, typ: prvek.typ, pristup, popis }); };
    for (const { prvek: v, pricka, pou } of vsechnyPrvky(projekt)) {
      const def = INSTR[v.typ]; if (!def) continue;
      for (const [k, jm, druh] of def.param) {
        if (['ms', 'int', 'real', 'op', 'fb', 'inst'].includes(druh)) continue;
        const pr = druh === 'bitW' || druh === 'cisloW' ? 'W' : (druh === 'timer' || druh === 'counter') ? 'D' : druh === 'tc' ? 'W' : 'R';
        pridej(v[k], pou, pricka, v, pr, `${v.typ} ${jm}`);
      }
      if (v.typ === 'CALL') {
        const f = najdiFb(projekt, v.fb);
        for (const [k, t] of Object.entries(v.prm || {})) { const rr = f && f.rozhrani.find(x => x.nazev === k); pridej(t, pou, pricka, v, rr && rr.smer === 'OUT' ? 'W' : 'R', `CALL ${v.inst}.${k}`); }
      }
    }
    return r.sort((a, b) => poradiAdresy(a.adr) - poradiAdresy(b.adr) || (a.pou < b.pou ? -1 : a.pou > b.pou ? 1 : a.pricka - b.pricka));
  }

  /* ---------- import / export ---------- */
  function exportuj(projekt) {
    const k = kopiruj(projekt);
    const bezId = o => { if (Array.isArray(o)) o.forEach(bezId); else if (o && typeof o === 'object') { delete o.id; delete o._a; Object.values(o).forEach(bezId); } };
    bezId(k.pricky); bezId(k.fb);
    return JSON.stringify(k, null, 2);
  }
  function nactiProjekt(vstup) {
    const chyby = [];
    let o = vstup;
    if (typeof vstup === 'string') {
      try { o = JSON.parse(vstup); } catch (e) { return { ok: false, chyby: ['Soubor není platný JSON: ' + e.message] }; }
    }
    if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, chyby: ['Kořen souboru musí být objekt projektu.'] };
    if (o.format !== undefined && o.format !== 'plc-simulator') return { ok: false, chyby: [`Neznámý formát „${o.format}“ (očekává se „plc-simulator“).`] };
    if (o.verze !== undefined && !(o.verze === 1 || o.verze === 2)) return { ok: false, chyby: [`Nepodporovaná verze formátu ${o.verze}.`] };
    if (!Array.isArray(o.pricky)) return { ok: false, chyby: ['Chybí pole „pricky“.'] };
    if (o.pricky.length > 500) return { ok: false, chyby: ['Příliš mnoho příček (max. 500).'] };
    const p = novyProjekt(typeof o.nazev === 'string' ? o.nazev.slice(0, 120) : 'Importovaný projekt');
    p.popis = typeof o.popis === 'string' ? o.popis.slice(0, 4000) : '';
    if (o.perioda !== undefined) {
      const per = Math.round(+o.perioda);
      if (per >= PERIODA_MIN && per <= PERIODA_MAX) p.perioda = per; else chyby.push(`Perioda ${o.perioda} mimo rozsah – použito ${p.perioda} ms.`);
    }
    if (o.watchdog !== undefined) { const w = Math.round(+o.watchdog); if (w >= 10 && w <= 10000) p.watchdog = w; }
    if (typeof o.proces === 'string') p.proces = o.proces.slice(0, 40);
    const mapaAdr = (src, fn) => { if (src && typeof src === 'object' && !Array.isArray(src)) for (const [k, v] of Object.entries(src)) { const a = rozeberAdresu(k); if (a && a.oblast !== '#') fn(a, v); } };
    mapaAdr(o.symboly, (a, v) => { if (typeof v === 'string' && v.trim()) p.symboly[a.klic] = v.trim().slice(0, 40); });
    mapaAdr(o.komentare, (a, v) => { if (typeof v === 'string' && v.trim()) p.komentare[a.klic] = v.trim().slice(0, 200); });
    mapaAdr(o.vstupy, (a, v) => { if (a.oblast === 'I' && (v === 'tlacitko' || v === 'prepinac')) p.vstupy[a.klic] = v; });
    if (o.mapovani && typeof o.mapovani === 'object') for (const [k, v] of Object.entries(o.mapovani)) { const a = rozeberAdresu(String(v)); if (/^[a-z0-9_]{1,30}$/i.test(k) && a && ['I', 'Q', 'IW', 'QW'].includes(a.oblast)) p.mapovani[k] = a.klic; }
    if (o.remanence && typeof o.remanence === 'object') {
      const r = o.remanence;
      for (const [k, max] of [['M', 8], ['MW', 64], ['MD', 32]]) if (Number.isInteger(r[k]) && r[k] >= 0 && r[k] <= max) p.remanence[k] = r[k];
      for (const k of ['C', 'RTO', 'FB']) if (typeof r[k] === 'boolean') p.remanence[k] = r[k];
    }
    if (Array.isArray(o.watch)) p.watch = o.watch.slice(0, 100).filter(w => w && rozeberAdresu(String(w.adr || ''))).map(w => ({ adr: rozeberAdresu(w.adr).klic, format: ['DEC', 'HEX', 'BIN', 'BOOL'].includes(w.format) ? w.format : 'DEC', trend: !!w.trend }));
    const retez = (x, n) => typeof x === 'string' ? x.slice(0, n || 30) : (x === undefined || x === null ? '' : String(x).slice(0, n || 30));
    let pocet = 0;
    const prvek = (x, misto, hloubka) => {
      if (!x || typeof x !== 'object') throw chyba(`${misto}: prvek není objekt.`);
      if (++pocet > 20000) throw chyba('Program je příliš velký.');
      const vystupy = misto.startsWith('výstupy');
      if (x.typ === 'PAR') {
        if (vystupy) throw chyba(`${misto}: paralelní blok nepatří mezi výstupy.`);
        if (hloubka > 12) throw chyba(`${misto}: příliš hluboké vnoření větví.`);
        if (!Array.isArray(x.vetve)) throw chyba(`${misto}: paralelní blok bez pole „vetve“.`);
        return { id: novyId(), typ: 'PAR', vetve: x.vetve.map((v, i) => serie(v, misto + ` větev ${i + 1}`, hloubka + 1)) };
      }
      const def = INSTR[x.typ];
      if (!def || (vystupy ? def.kat === 'kontakt' : def.kat !== 'kontakt')) throw chyba(`${misto}: neznámý nebo nepatřičný typ prvku „${x.typ}“.`);
      const n = { id: novyId(), typ: x.typ };
      for (const [k, , druh] of def.param) {
        if (druh === 'ms' || druh === 'real' || druh === 'int') n[k] = Number.isFinite(+x[k]) ? +x[k] : 0;
        else if (druh === 'op') n[k] = OPERACE.includes(x[k]) ? x[k] : '==';
        else { let t = retez(x[k]); const a = rozeberAdresu(t); if (a) t = a.klic; n[k] = t; }
      }
      if (x.typ === 'CALL') { n.prm = {}; if (x.prm && typeof x.prm === 'object') for (const [k, v] of Object.entries(x.prm)) if (/^[A-Za-z_][A-Za-z0-9_]{0,23}$/.test(k) && typeof v === 'string') { const a = rozeberAdresu(v); n.prm[k] = a ? a.klic : v.slice(0, 30); } }
      return n;
    };
    const serie = (s, misto, hloubka) => {
      const pole = Array.isArray(s) ? s : (s && Array.isArray(s.prvky) ? s.prvky : null);
      if (!pole) throw chyba(`${misto}: očekává se série prvků.`);
      return { id: novyId(), typ: 'SERIE', prvky: pole.map((x, i) => prvek(x, misto + ` prvek ${i + 1}`, hloubka)) };
    };
    const pricky = (pole, kde) => pole.map((r, i) => {
      if (!r || typeof r !== 'object') throw chyba(`${kde} příčka ${i + 1} není objekt.`);
      const v = Array.isArray(r.vystupy) ? r.vystupy : [];
      return { id: novyId(), komentar: typeof r.komentar === 'string' ? r.komentar.slice(0, 300) : '',
        podminka: serie(r.podminka || [], `${kde} příčka ${i + 1}`, 0), vystupy: v.map((x, j) => prvek(x, `výstupy ${kde} příčky ${i + 1}, ${j + 1}.`, 0)) };
    });
    try {
      p.pricky = pricky(o.pricky, 'MAIN');
      if (o.fb !== undefined) {
        if (!Array.isArray(o.fb) || o.fb.length > 50) throw chyba('Pole „fb“ je neplatné (nejvýše 50 bloků).');
        p.fb = o.fb.map((f, i) => {
          if (!f || typeof f.nazev !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]{0,23}$/.test(f.nazev)) throw chyba(`FB ${i + 1}: neplatný název.`);
          if (!Array.isArray(f.pricky)) throw chyba(`FB ${f.nazev}: chybí příčky.`);
          const rozhrani = (Array.isArray(f.rozhrani) ? f.rozhrani : []).slice(0, 64).map(r => ({ nazev: retez(r && r.nazev, 24), smer: ['IN', 'OUT', 'STAT'].includes(r && r.smer) ? r.smer : 'STAT',
            typ: TYPY.includes(r && r.typ) ? r.typ : 'BOOL', komentar: retez(r && r.komentar, 200) }));
          return { id: novyId(), nazev: f.nazev, komentar: retez(f.komentar, 300), rozhrani, pricky: pricky(f.pricky, f.nazev) };
        });
      }
    } catch (e) { return { ok: false, chyby: [e.message] }; }
    if (!p.pricky.length) p.pricky.push(B.PRICKA('', [], []));
    for (const f of p.fb) if (!f.pricky.length) f.pricky.push(B.PRICKA('', [], []));
    normalizuj(p);
    return { ok: true, projekt: p, chyby };
  }
  function klonujProjekt(projekt) { const r = nactiProjekt(exportuj(projekt)); return r.ok ? r.projekt : null; }
  function pouziteAdresy(projekt, vcetneLokalnich) {
    const r = new Set();
    for (const x of krizoveOdkazy(projekt)) if (vcetneLokalnich || x.adr[0] !== '#') r.add(x.adr);
    return [...r].sort((a, b) => poradiAdresy(a) - poradiAdresy(b));
  }
  function textPodminky(s) {
    return s.prvky.map(x => {
      if (x.typ === 'PAR') return '(' + x.vetve.map(textPodminky).join(' + ') + ')';
      if (x.typ === 'CMP') return `[${x.in1} ${x.op} ${x.in2}]`;
      const z = { NO: '', NC: '/', P: '↑', N: '↓' }[x.typ]; return (z === undefined ? '?' : z) + x.adr;
    }).join('·') || '1';
  }

  const PLC = {
    LIMITY, KONTAKTY, CIVKY, BLOKY, VYSTUPY, CASOVACE, CITACE, INSTR, NAZVY, TYPY, OPERACE, SYSTEMOVE, PT_MAX, PV_MAX, PERIODA_MIN, PERIODA_MAX,
    ANALOG_MAX, ANALOG_PRERUSENO, ZAKLAD_CYKLU, CENA,
    rozeberAdresu, rozeberOperand, rozeberCas, vsechnyAdresy, poradiAdresy, novyId, B, novyPrvek, novyProjekt, vsechnyPou, najdiFb,
    najdi, najdiPricku, normalizuj, vloz, smaz, presun, posun, paralelne, pridejVetev, novaPricka, smazPricku, posunPricku, kopiruj, premapujId, novyFb, prejmenujFb,
    novyCasovac, novyCitac, ton, tof, tp, rto, ctu, ctd, ctud, pidKrok, vytvorStav, jeRemanentni, ctiBit, hodnota, zapisHodnotu,
    zacniCyklus, provedPricku, dokonciCyklus, cyklus, poradiVyhodnoceni, operandyPrvku,
    diagnostika, maChyby, krizoveOdkazy, exportuj, nactiProjekt, klonujProjekt, pouziteAdresy, textPodminky, vsechnyPrvky
  };
  if (typeof module !== 'undefined') module.exports = PLC; else window.PLC = PLC;
})();
