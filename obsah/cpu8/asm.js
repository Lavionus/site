/* ============================================================
   cpu8/asm.js – dvouprůchodový assembler MOS 6502
   Syntaxe (kompatibilní s běžnými assemblery i s easy6502):
     návěští:  lda #$01      ; komentář
     .lokalni / @lokalni     – místní návěští (platí do dalšího globálního)
     CONST = $10 | CONST .equ 16 | define CONST 16
     *= $0600 | .org $0600
     .byte/.db/dcb 1,2,"text"  .word/.dw  .text/.asciiz "…"  .res/.ds n[,výplň]  .align n
     čísla $FF %1010 255 'A', výrazy + - * / % & | ^ << >> ~ ( ), <x nižší, >x vyšší bajt, * = adresa
     priorita jako v ca65: unární (- ~ < > !) > (* / % & ^ << >>) > (+ - |); <$12FF+1 = $100
     a:výraz / z:výraz – vynutí absolutní / zero-page adresování
   Výstup: obraz paměti, mapa adresa → řádek, řádek → adresa, symboly, výpis (listing), chyby česky.
   ============================================================ */
(function (root) {
  'use strict';
  const CPU8 = (typeof module !== 'undefined' && module.exports) ? require('./cpu.js') : root.CPU8;
  const { OPS } = CPU8;

  // mnemonika → { režim: opkód } zvlášť pro dokumentované a všechny
  function sestavMapu(illegal) {
    const mapa = {};
    for (let i = 0; i < 256; i++) {
      const o = OPS[i];
      if (o.ill && !illegal) continue;
      const r = mapa[o.m] || (mapa[o.m] = {});
      if (r[o.mode] === undefined || (OPS[r[o.mode]].ill && !o.ill)) r[o.mode] = i;
    }
    return mapa;
  }
  const MAPA_DOK = sestavMapu(false), MAPA_VSE = sestavMapu(true);
  const VETVENI = new Set(['BCC', 'BCS', 'BEQ', 'BNE', 'BMI', 'BPL', 'BVC', 'BVS']);

  const DIREKTIVY = {
    '.org': 'org', 'org': 'org', '*=': 'org',
    '.byte': 'byte', '.byt': 'byte', '.db': 'byte', 'db': 'byte', 'dcb': 'byte', '.dcb': 'byte', 'byte': 'byte',
    '.word': 'word', '.dw': 'word', 'dw': 'word', '.addr': 'word', 'word': 'word',
    '.text': 'text', '.ascii': 'text', '.asciiz': 'asciiz',
    '.res': 'res', '.ds': 'res', 'ds': 'res', '.dsb': 'res',
    '.equ': 'equ', 'equ': 'equ', '=': 'equ',
    'define': 'define', '.define': 'define',
    '.align': 'align', '.end': 'end',
  };

  class AsmChyba extends Error {}
  const hex2 = v => '$' + (v & 0xFF).toString(16).toUpperCase().padStart(2, '0');
  const hex4 = v => '$' + (v & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');

  // ---------- lexikální rozbor ----------
  /** Odstraní komentář ; mimo řetězce a znakové konstanty. */
  function bezKomentare(s) {
    let v = null;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (v) {
        if (ch === '\\') { i++; continue; }
        if (ch === v) v = null;
      } else if (ch === '"') v = '"';
      else if (ch === "'" && i + 2 < s.length + 1) {
        // 'A' nebo '\n'
        if (s[i + 1] === '\\' && s[i + 3] === "'") i += 3;
        else if (s[i + 2] === "'") i += 2;
      } else if (ch === ';') return s.slice(0, i);
    }
    return s;
  }

  /** Rozdělí operandy podle čárek mimo závorky a řetězce. */
  function rozdelCarky(s) {
    const out = []; let hl = 0, v = null, z = 0;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (v) { if (ch === '\\') { i++; continue; } if (ch === v) v = null; continue; }
      if (ch === '"') v = '"';
      else if (ch === "'" && (s[i + 2] === "'" || (s[i + 1] === '\\' && s[i + 3] === "'"))) { i += s[i + 1] === '\\' ? 3 : 2; }
      else if (ch === '(' || ch === '[') hl++;
      else if (ch === ')' || ch === ']') hl--;
      else if (ch === ',' && hl === 0) { out.push(s.slice(z, i).trim()); z = i + 1; }
    }
    if (v) throw new AsmChyba('Neukončený řetězec');
    out.push(s.slice(z).trim());
    return out;
  }

  const ESC = { n: 10, r: 13, t: 9, '0': 0, '\\': 92, '"': 34, "'": 39, e: 27, a: 7, b: 8 };
  function ctiRetezec(s) {
    // s začíná i končí "
    if (s.length < 2 || s[s.length - 1] !== '"') throw new AsmChyba('Neukončený řetězec');
    const out = [];
    for (let i = 1; i < s.length - 1; i++) {
      let c = s.charCodeAt(i);
      if (s[i] === '\\') {
        i++;
        const e = s[i];
        if (e === 'x' || e === '$') {
          const h = s.slice(i + 1, i + 3);
          if (!/^[0-9a-fA-F]{2}$/.test(h)) throw new AsmChyba('Chybná sekvence \\x v řetězci');
          c = parseInt(h, 16); i += 2;
        } else if (e in ESC) c = ESC[e];
        else throw new AsmChyba('Neznámá sekvence \\' + e + ' v řetězci');
      } else if (c > 127) {
        // znaky mimo ASCII se ukládají v UTF-8 (konzole je umí zobrazit)
        const cp = s.codePointAt(i); if (cp > 0xFFFF) i++;
        out.push(...utf8(cp)); continue;
      }
      out.push(c);
    }
    return out;
  }

  function utf8(cp) {
    if (cp < 0x800) return [0xC0 | (cp >> 6), 0x80 | (cp & 63)];
    if (cp < 0x10000) return [0xE0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63)];
    return [0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63)];
  }

  // ---------- výrazy ----------
  /**
   * Vyhodnotí výraz. ctx = { pc, symbol(name) → číslo | undefined, scope }
   * Vrací { v, znamy } – znamy=false, když chybí dosud nedefinovaný symbol (1. průchod).
   */
  function vyhodnot(text, ctx) {
    let i = 0; const s = text; let znamy = true; const chybi = [];
    const ws = () => { while (i < s.length && (s[i] === ' ' || s[i] === '\t')) i++; };
    const konec = () => { ws(); return i >= s.length; };
    function primar() {
      ws();
      if (i >= s.length) throw new AsmChyba('Neúplný výraz „' + text + '“');
      const ch = s[i];
      if (ch === '(' || ch === '[') {
        const zav = ch === '(' ? ')' : ']';
        i++; const v = add(); ws();
        if (s[i] !== zav) throw new AsmChyba('Chybí uzavírací závorka „' + zav + '“ ve výrazu „' + text + '“');
        i++; return v;
      }
      // unární operátory mají nejvyšší prioritu (jako v ca65): <$12FF+1 = ($FF)+1
      if (ch === '-') { i++; return -primar(); }
      if (ch === '+') { i++; return primar(); }
      if (ch === '~') { i++; return ~primar(); }
      if (ch === '!') { i++; return primar() ? 0 : 1; }
      if (ch === '<') { i++; return primar() & 0xFF; }
      if (ch === '>') { i++; return (primar() >> 8) & 0xFF; }
      if (ch === '$') {
        const m = /^\$([0-9a-fA-F]+)/.exec(s.slice(i));
        if (!m) throw new AsmChyba('Chybné šestnáctkové číslo ve výrazu „' + text + '“');
        i += m[0].length; return parseInt(m[1], 16);
      }
      if (ch === '%') {
        const m = /^%([01]+)/.exec(s.slice(i));
        if (!m) throw new AsmChyba('Chybné dvojkové číslo ve výrazu „' + text + '“');
        i += m[0].length; return parseInt(m[1], 2);
      }
      if (ch >= '0' && ch <= '9') {
        let m = /^0[xX]([0-9a-fA-F]+)/.exec(s.slice(i));
        if (m) { i += m[0].length; return parseInt(m[1], 16); }
        m = /^0[bB]([01]+)/.exec(s.slice(i));
        if (m) { i += m[0].length; return parseInt(m[1], 2); }
        m = /^[0-9]+/.exec(s.slice(i));
        if (/^[0-9]+[A-Za-z_]/.test(s.slice(i))) throw new AsmChyba('Chybné číslo „' + /^[0-9A-Za-z_]+/.exec(s.slice(i))[0] + '“ (šestnáctkově pište $FF)');
        i += m[0].length; return parseInt(m[0], 10);
      }
      if (ch === "'") {
        let c;
        if (s[i + 1] === '\\' && s[i + 3] === "'") {
          const e = s[i + 2]; if (!(e in ESC)) throw new AsmChyba('Neznámá sekvence \\' + e);
          c = ESC[e]; i += 4;
        } else if (s[i + 2] === "'") { c = s.charCodeAt(i + 1); i += 3; }
        else throw new AsmChyba('Chybná znaková konstanta (správně např. \'A\')');
        if (c > 255) throw new AsmChyba('Znak „' + String.fromCharCode(c) + '“ nejde zapsat jedním bajtem – ve znakové konstantě použijte ASCII');
        return c;
      }
      if (ch === '*') { i++; return ctx.pc; }
      const m = /^(?:[@.][A-Za-z0-9_]+|[A-Za-z_][A-Za-z0-9_]*(?:[.@][A-Za-z0-9_]+)?)/.exec(s.slice(i));
      if (m) {
        i += m[0].length;
        const v = ctx.symbol(m[0]);
        if (v === undefined) { znamy = false; chybi.push(m[0]); return 0; }
        return v;
      }
      throw new AsmChyba('Neočekávaný znak „' + ch + '“ ve výrazu „' + text + '“');
    }
    // priorita podle ca65: unární > (* / % & ^ << >>) > (+ - |), stejná úroveň zleva doprava
    function mul() {
      let v = primar();
      for (;;) {
        ws(); const ch = s[i];
        if (ch === '*') { i++; v = v * primar(); }
        else if (ch === '/' || ch === '%') {
          i++; const d = primar();
          if (d === 0) { if (znamy) throw new AsmChyba('Dělení nulou ve výrazu „' + text + '“'); v = 0; }
          else v = ch === '/' ? Math.trunc(v / d) : v % d;
        }
        else if (ch === '&' && s[i + 1] !== '&') { i++; v &= primar(); }
        else if (ch === '^') { i++; v ^= primar(); }
        else if (s.startsWith('<<', i)) { i += 2; v = v << primar(); }
        else if (s.startsWith('>>', i)) { i += 2; v = v >> primar(); }
        else return v;
      }
    }
    function add() {
      let v = mul();
      for (;;) {
        ws(); const ch = s[i];
        if (ch === '+') { i++; v += mul(); }
        else if (ch === '-') { i++; v -= mul(); }
        else if (ch === '|' && s[i + 1] !== '|') { i++; v |= mul(); }
        else return v;
      }
    }
    if (!text.trim()) throw new AsmChyba('Chybí výraz');
    const v = add();
    if (!konec()) throw new AsmChyba('Nečekané „' + s.slice(i).trim() + '“ ve výrazu „' + text + '“');
    return { v, znamy, chybi };
  }

  const JE_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const JE_LOKAL = /^[@.][A-Za-z0-9_]+$/;

  // ---------- rozbor řádku ----------
  function rozeberRadek(puvodni, mapa) {
    const st = { navesti: [], op: null, arg: '' };
    let s = bezKomentare(puvodni).replace(/\s+$/, '');
    const odsazeno = /^\s/.test(s);
    s = s.trim();
    if (!s) return st;
    // *= výraz
    let m = /^\*\s*=\s*(.*)$/.exec(s);
    if (m) { st.op = 'org'; st.arg = m[1]; st.dir = true; return st; }
    // NAME = výraz | NAME .equ výraz | NAME equ výraz
    m = /^([A-Za-z_][A-Za-z0-9_]*|[@.][A-Za-z0-9_]+)\s*(?:=|\.equ\b|\bequ\b|:=)\s*(.*)$/i.exec(s);
    if (m && !(m[1].toLowerCase() in DIREKTIVY) && !(m[1].toUpperCase() in mapa && /^[A-Za-z]{3}$/.test(m[1]))) {
      st.op = 'equ'; st.jmeno = m[1]; st.arg = m[2]; st.dir = true; return st;
    }
    let prvni = true;
    for (;;) {
      m = /^([A-Za-z_][A-Za-z0-9_]*|[@.][A-Za-z0-9_]+)(:?)(\s+|$)/.exec(s);
      if (!m) {
        m = /^([A-Za-z_][A-Za-z0-9_]*|[@.][A-Za-z0-9_]+):/.exec(s);
        if (m) { st.navesti.push(m[1]); s = s.slice(m[0].length).trim(); prvni = false; if (!s) return st; continue; }
        throw new AsmChyba('Nečekaný text „' + s + '“');
      }
      const slovo = m[1], dvojt = m[2] === ':', zbytek = s.slice(m[0].length).trim();
      const mal = slovo.toLowerCase();
      if (dvojt) { st.navesti.push(slovo); s = zbytek; prvni = false; if (!s) return st; continue; }
      if (mal in DIREKTIVY) {
        st.op = DIREKTIVY[mal]; st.dir = true;
        if (st.op === 'define') {
          const d = /^([A-Za-z_][A-Za-z0-9_]*)\s+(.+)$/.exec(zbytek);
          if (!d) throw new AsmChyba('Direktiva define potřebuje jméno a hodnotu (define JMENO hodnota)');
          st.op = 'equ'; st.jmeno = d[1]; st.arg = d[2];
        } else if (st.op === 'equ') {
          if (!st.navesti.length) throw new AsmChyba('Konstanta potřebuje jméno (JMENO = hodnota)');
          st.jmeno = st.navesti.pop(); st.arg = zbytek;
        } else st.arg = zbytek;
        return st;
      }
      const velke = slovo.toUpperCase();
      if (/^[A-Za-z]{3}$/.test(slovo) && velke in mapa) { st.op = velke; st.arg = zbytek; return st; }
      // případně návěští bez dvojtečky (v prvním sloupci, nebo následuje instrukce)
      const dalsi = /^(\S+)/.exec(zbytek);
      const dalsiJeOp = dalsi && ((dalsi[1].toUpperCase() in mapa && /^[A-Za-z]{3}$/.test(dalsi[1])) || dalsi[1].toLowerCase() in DIREKTIVY || /^=/.test(dalsi[1]));
      if (prvni && (!odsazeno || dalsiJeOp || !zbytek) && (JE_IDENT.test(slovo) || JE_LOKAL.test(slovo)) && (zbytek === '' || dalsiJeOp)) {
        if (/^\./.test(slovo) && !JE_LOKAL.test(slovo)) throw new AsmChyba('Neznámá direktiva „' + slovo + '“');
        if (odsazeno && !zbytek) throw new AsmChyba('Neznámá instrukce „' + slovo + '“');
        st.navesti.push(slovo);
        if (!zbytek && /^[A-Za-z]{2,4}$/.test(slovo)) st.varovani = 'Řádek obsahuje jen „' + slovo + '“ – bere se jako návěští (chybí dvojtečka, nebo překlep v instrukci?)';
        s = zbytek; prvni = false; if (!s) return st; continue;
      }
      if (/^\./.test(slovo)) throw new AsmChyba('Neznámá direktiva „' + slovo + '“');
      if (/^[A-Za-z]{3}$/.test(slovo) && slovo.toUpperCase() in MAPA_VSE) throw new AsmChyba('Instrukce „' + velke + '“ je nedokumentovaná – zapněte „Nedokumentované opkódy“');
      throw new AsmChyba('Neznámá instrukce „' + slovo + '“');
    }
  }

  /** Rozbor operandu instrukce na { druh, vyraz, vynut } (druh: imp, imm, ind, indx, indy, x, y, prosty). */
  function rozeberOperand(arg) {
    let a = arg.trim();
    if (a === '') return { druh: 'imp' };
    if (/^a$/i.test(a)) return { druh: 'acc' };
    if (a[0] === '#') return { druh: 'imm', vyraz: a.slice(1).trim() };
    let vynut = null;
    const pr = /^([az]):/i.exec(a);
    if (pr) { vynut = pr[1].toLowerCase() === 'a' ? 'abs' : 'zp'; a = a.slice(2).trim(); }
    let m = /^\((.*),\s*[xX]\s*\)$/.exec(a);
    if (m && obalenaZavorkou(a)) return { druh: 'indx', vyraz: m[1] };
    m = /^\((.*)\)\s*,\s*[yY]$/.exec(a);
    if (m && obalenaZavorkou(a.replace(/\s*,\s*[yY]$/, ''))) return { druh: 'indy', vyraz: m[1] };
    m = /^(.*?)\s*,\s*([xXyY])$/.exec(a);
    if (m) {
      if (m[2].toLowerCase() === 'x' && obalenaZavorkou(m[1].trim())) throw new AsmChyba('Režim „' + m[1].trim() + ',X“ na 6502 neexistuje – myslel jste ' + m[1].trim().slice(0, -1) + ',X)? (Výraz v závorkách pište v [ ].)');
      return { druh: m[2].toLowerCase(), vyraz: m[1], vynut };
    }
    if (a[0] === '(' && obalenaZavorkou(a)) return { druh: 'zavorka', vyraz: a.slice(1, -1), cely: a, vynut };
    return { druh: 'prosty', vyraz: a, vynut };
  }
  /** Platí, že první „(“ se páruje až s posledním znakem? */
  function obalenaZavorkou(a) {
    if (a[0] !== '(' || a[a.length - 1] !== ')') return false;
    let h = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] === "'" && a[i + 2] === "'") { i += 2; continue; }
      if (a[i] === '(') h++; else if (a[i] === ')') { h--; if (h === 0 && i < a.length - 1) return false; }
    }
    return h === 0;
  }

  const POPIS_REZIMU = {
    imp: 'bez operandu', acc: 'akumulátor (A)', imm: 'okamžitý (#)', zp: 'nulová stránka', zpx: 'nulová stránka,X',
    zpy: 'nulová stránka,Y', abs: 'absolutní', absx: 'absolutní,X', absy: 'absolutní,Y', ind: 'nepřímý ( )',
    indx: 'nepřímý (zp,X)', indy: 'nepřímý (zp),Y', rel: 'relativní',
  };

  /** Vybere adresní režim instrukce podle tvaru operandu a hodnoty z 1. průchodu. */
  function vyberRezim(mn, rezimy, op, hodnota, znamy) {
    const ma = r => r in rezimy;
    const nelze = popis => new AsmChyba('Instrukce ' + mn + ' nepodporuje adresní režim ' + popis + '. Možné: ' +
      Object.keys(rezimy).map(r => POPIS_REZIMU[r]).join(', '));
    if (VETVENI.has(mn)) {
      if (op.druh !== 'prosty' && op.druh !== 'zavorka') throw new AsmChyba('Větvení ' + mn + ' potřebuje cílovou adresu nebo návěští');
      return 'rel';
    }
    const malé = znamy && hodnota >= 0 && hodnota <= 0xFF;
    switch (op.druh) {
      case 'imp':
        if (ma('imp')) return 'imp';
        if (ma('acc')) return 'acc';
        throw new AsmChyba('Instrukce ' + mn + ' potřebuje operand');
      case 'acc':
        if (ma('acc')) return 'acc';
        throw nelze('akumulátor (A) – pokud jde o návěští „A“, přejmenujte ho');
      case 'imm': if (ma('imm')) return 'imm'; throw nelze('okamžitý (#)');
      case 'indx': if (ma('indx')) return 'indx'; throw nelze('(zp,X)');
      case 'indy': if (ma('indy')) return 'indy'; throw nelze('(zp),Y');
      case 'zavorka':
        if (ma('ind')) return 'ind';
        if (ma('indy')) throw new AsmChyba('Režim „' + op.cely + '“ (zp) bez ,Y na NMOS 6502 neexistuje – myslel jste ' + op.cely + ',Y? (Výraz v závorkách pište bez vnějších závorek nebo v [ ].)');
        throw new AsmChyba('Instrukce ' + mn + ' nemá nepřímý režim „' + op.cely + '“. Výraz v závorkách pište bez vnějších závorek nebo v [ ].');
      case 'prosty':
        if (op.vynut === 'zp') { if (ma('zp')) return 'zp'; throw nelze('nulová stránka'); }
        if (op.vynut !== 'abs' && malé && ma('zp')) return 'zp';
        if (ma('abs')) return 'abs';
        if (ma('zp')) return 'zp';
        if (ma('ind')) throw new AsmChyba('Nepřímý skok se píše se závorkami: ' + mn + ' ($1234)');
        throw nelze('absolutní');
      case 'x':
        if (op.vynut === 'zp') { if (ma('zpx')) return 'zpx'; throw nelze('nulová stránka,X'); }
        if (op.vynut !== 'abs' && malé && ma('zpx')) return 'zpx';
        if (ma('absx')) return 'absx';
        if (ma('zpx')) return 'zpx';
        throw nelze('indexovaný X');
      case 'y':
        if (op.vynut === 'zp') { if (ma('zpy')) return 'zpy'; throw nelze('nulová stránka,Y'); }
        if (op.vynut !== 'abs' && malé && ma('zpy')) return 'zpy';
        if (ma('absy')) return 'absy';
        if (ma('zpy')) return 'zpy';
        throw nelze('indexovaný Y');
    }
    throw new AsmChyba('Neznámý tvar operandu');
  }

  // ---------- hlavní funkce ----------
  /**
   * assemble(zdroj, { illegal, origin }) →
   * { ok, errors:[{line, msg}], warnings, mem, used, start, segments, addrToLine, lineToAddr, symbols, listing, bytes }
   * Čísla řádků jsou od 1.
   */
  function assemble(zdroj, volby) {
    volby = volby || {};
    const mapa = volby.illegal ? MAPA_VSE : MAPA_DOK;
    const radky = String(zdroj).replace(/\r\n?/g, '\n').split('\n');
    const errors = [], warnings = [];
    const chyba = (ln, msg) => { if (!errors.some(e => e.line === ln && e.msg === msg)) errors.push({ line: ln, msg }); };

    // rozbor
    const prikazy = [];
    for (let i = 0; i < radky.length; i++) {
      let st;
      try {
        st = Object.assign(rozeberRadek(radky[i], mapa), { line: i + 1 });
        if (st.varovani) warnings.push({ line: i + 1, msg: st.varovani });
      } catch (e) { if (!(e instanceof AsmChyba)) throw e; chyba(i + 1, e.message); st = { navesti: [], op: null, line: i + 1, vadny: true }; }
      prikazy.push(st);
      if (st.op === 'end') break;            // .end – zbytek souboru se ignoruje
    }

    const symboly = new Map();     // plné jméno → { value, line, typ }
    let scope = '';
    const plneJmeno = (n, sc) => (n[0] === '@' || n[0] === '.') ? sc + n : n;
    function ctx(pc, sc) {
      return {
        pc,
        symbol(n) {
          const s = symboly.get(plneJmeno(n, sc));
          return s && s.value !== undefined ? s.value : undefined;
        },
      };
    }
    function definuj(n, value, line, typ, pruchod) {
      if ((n[0] === '@' || n[0] === '.') && !scope) {
        // místní návěští před prvním globálním – rozsah „“ je v pořádku
      }
      const pj = plneJmeno(n, scope);
      if (/^[aAxXyY]$/.test(n)) warnings.push({ line, msg: 'Jméno „' + n + '“ se plete s registrem' });
      const s = symboly.get(pj);
      if (pruchod === 1) {
        if (s && s.line !== line) throw new AsmChyba('Duplicitní definice „' + n + '“ (poprvé na řádku ' + s.line + ')');
        symboly.set(pj, { value, line, typ, jmeno: n, scope: (n[0] === '@' || n[0] === '.') ? scope : '' });
      } else if (s) {
        s.value = value;
      }
    }

    const ORIGIN = volby.origin !== undefined ? volby.origin : 0x0600;

    function delkaDat(p, pc, sc, pruchod) {
      // vrací pole bajtů (v 1. průchodu mohou být nuly) – délka nezávisí na hodnotách
      const out = [];
      const polozky = rozdelCarky(p.arg);
      if (polozky.length === 1 && polozky[0] === '') throw new AsmChyba('Direktiva potřebuje aspoň jednu hodnotu');
      for (const it of polozky) {
        if (!it) throw new AsmChyba('Prázdná položka v seznamu');
        if (it[0] === '"') {
          if (p.op === 'word') throw new AsmChyba('Řetězec nelze použít v .word');
          out.push(...ctiRetezec(it));
          continue;
        }
        if (p.op === 'text' || p.op === 'asciiz') {
          // povolíme i čísla
        }
        const r = vyhodnot(it, ctx(pc + out.length, sc));
        if (pruchod === 2 && !r.znamy) throw new AsmChyba('Nedefinovaný symbol „' + r.chybi[0] + '“');
        if (p.op === 'word') {
          if (pruchod === 2 && (r.v < -32768 || r.v > 0xFFFF)) throw new AsmChyba('Hodnota ' + r.v + ' se nevejde do 16 bitů');
          out.push(r.v & 0xFF, (r.v >> 8) & 0xFF);
        } else {
          if (pruchod === 2 && (r.v < -128 || r.v > 0xFF)) throw new AsmChyba('Hodnota ' + fmtHod(r.v) + ' se nevejde do bajtu (−128…255)');
          out.push(r.v & 0xFF);
        }
      }
      if (p.op === 'asciiz') out.push(0);
      return out;
    }

    // ---------- 1. průchod: adresy a velikosti ----------
    let pc = ORIGIN;
    scope = '';
    for (const p of prikazy) {
      p.pc = pc; p.scope = scope;
      if (p.vadny) continue;
      try {
        for (const n of p.navesti) {
          if (n[0] !== '@' && n[0] !== '.') scope = n;
          definuj(n, pc, p.line, 'navesti', 1);
        }
        p.scope = scope;
        if (!p.op) continue;
        if (p.dir) {
          switch (p.op) {
            case 'equ': {
              const r = vyhodnot(p.arg, ctx(pc, scope));
              definuj(p.jmeno, r.znamy ? r.v : undefined, p.line, 'konstanta', 1);
              break;
            }
            case 'org': {
              const r = vyhodnot(p.arg, ctx(pc, scope));
              if (!r.znamy) throw new AsmChyba('Adresa v .org musí být známá předem (symbol „' + r.chybi[0] + '“ je definován až později)');
              if (r.v < 0 || r.v > 0xFFFF) throw new AsmChyba('Adresa ' + fmtHod(r.v) + ' je mimo paměť ($0000–$FFFF)');
              pc = r.v; p.pc = pc;
              for (const n of p.navesti) definuj(n, pc, p.line, 'navesti', 1); // návěští na řádku s .org dostane novou adresu
              break;
            }
            case 'byte': case 'word': case 'text': case 'asciiz':
              p.data = delkaDat(p, pc, scope, 1); p.size = p.data.length; pc += p.size; break;
            case 'res': {
              const pol = rozdelCarky(p.arg);
              const r = vyhodnot(pol[0], ctx(pc, scope));
              if (!r.znamy) throw new AsmChyba('Velikost v .res musí být známá předem');
              if (r.v < 0 || r.v > 0x10000) throw new AsmChyba('Chybná velikost rezervace ' + r.v);
              p.size = r.v; p.vypln = pol[1]; pc += r.v; break;
            }
            case 'align': {
              const r = vyhodnot(p.arg || '2', ctx(pc, scope));
              if (!r.znamy || r.v < 1 || r.v > 0x10000) throw new AsmChyba('Chybné zarovnání');
              p.size = (r.v - (pc % r.v)) % r.v; pc += p.size; break;
            }
            case 'end': break;
          }
        } else {
          const rez = mapa[p.op];
          const operand = rozeberOperand(p.arg);
          let hodnota = 0, znamy = false;
          if (operand.vyraz !== undefined && operand.druh !== 'imm') {
            const r = vyhodnot(operand.vyraz, ctx(pc, scope));
            hodnota = r.v; znamy = r.znamy;
          }
          p.operand = operand;
          p.mode = vyberRezim(p.op, rez, operand, hodnota, znamy);
          p.opcode = rez[p.mode];
          p.size = CPU8.DELKA[p.mode];
          pc += p.size;
        }
        if (pc > 0x10000) throw new AsmChyba('Program přetekl za konec paměti ($FFFF)');
      } catch (e) {
        if (!(e instanceof AsmChyba)) throw e;
        chyba(p.line, e.message); p.vadny = true;
      }
    }

    // konstanty definované dopředu: několik kol dopočtu
    for (let kolo = 0; kolo <= prikazy.length; kolo++) {     // opakovat, dokud se něco mění
      let zmena = false;
      for (const p of prikazy) {
        if (p.op !== 'equ' || p.vadny) continue;
        const pj = plneJmeno(p.jmeno, p.scope); const s = symboly.get(pj);
        if (!s || s.value !== undefined) continue;
        try {
          const r = vyhodnot(p.arg, ctx(p.pc, p.scope));
          if (r.znamy) { s.value = r.v; zmena = true; }
        } catch (e) { /* chyba se ohlásí ve 2. průchodu */ }
      }
      if (!zmena) break;
    }

    // ---------- 2. průchod: generování ----------
    const mem = new Uint8Array(65536), used = new Uint8Array(65536);
    const addrToLine = new Int32Array(65536).fill(-1);
    const kodStart = new Uint8Array(65536);   // 1 = první bajt instrukce, 2 = datový bajt
    const lineToAddr = new Array(radky.length + 2).fill(-1);
    const listing = [];
    let start = -1, prvniData = -1, prepisy = 0;
    const zapis = (a, b, ln, prvni) => {
      if (used[a] && prepisy < 5) { warnings.push({ line: ln, msg: 'Přepis již obsazené paměti na ' + hex4(a) }); prepisy++; }
      mem[a] = b; used[a] = 1;
      addrToLine[a] = ln;
    };
    for (const p of prikazy) {
      if (p.vadny) continue;
      const pc0 = p.pc;
      try {
        if (!p.op) {
          if (p.navesti.length) listing.push({ line: p.line, addr: pc0, bytes: [] });
          continue;
        }
        let bytes = [];
        if (p.dir) {
          switch (p.op) {
            case 'equ': {
              const r = vyhodnot(p.arg, ctx(pc0, p.scope));
              if (!r.znamy) {
                const ch = symboly.get(plneJmeno(r.chybi[0], p.scope));
                if (ch && ch.typ === 'konstanta') throw new AsmChyba('Kruhová definice konstanty „' + p.jmeno + '“ (přes „' + r.chybi[0] + '“) – hodnotu nejde spočítat');
                throw new AsmChyba('Nedefinovaný symbol „' + r.chybi[0] + '“');
              }
              const s = symboly.get(plneJmeno(p.jmeno, p.scope));
              if (s && s.value !== undefined && s.value !== r.v) throw new AsmChyba('Hodnota konstanty „' + p.jmeno + '“ se mezi průchody změnila');
              if (s) s.value = r.v;
              listing.push({ line: p.line, addr: null, bytes: [], hodnota: r.v });
              continue;
            }
            case 'org': listing.push({ line: p.line, addr: pc0, bytes: [] }); continue;
            case 'end': continue;
            case 'byte': case 'word': case 'text': case 'asciiz':
              bytes = delkaDat(p, pc0, p.scope, 2);
              if (prvniData < 0) prvniData = pc0;
              break;
            case 'res': case 'align': {
              let fill = null;
              if (p.vypln !== undefined) {
                const r = vyhodnot(p.vypln, ctx(pc0, p.scope));
                if (!r.znamy) throw new AsmChyba('Nedefinovaný symbol „' + r.chybi[0] + '“');
                if (r.v < -128 || r.v > 255) throw new AsmChyba('Výplň se nevejde do bajtu');
                fill = r.v & 0xFF;
              }
              if (fill !== null) { for (let k = 0; k < p.size; k++) zapis((pc0 + k) & 0xFFFF, fill, p.line); }
              listing.push({ line: p.line, addr: pc0, bytes: [], rezervace: p.size });
              lineToAddr[p.line] = pc0;
              continue;
            }
          }
        } else {
          const o = p.operand;
          bytes.push(p.opcode);
          if (p.mode === 'imp' || p.mode === 'acc') { /* nic */ }
          else {
            const r = vyhodnot(o.vyraz, ctx(pc0, p.scope));
            if (!r.znamy) throw new AsmChyba('Nedefinovaný symbol „' + r.chybi[0] + '“');
            const v = r.v;
            switch (p.mode) {
              case 'imm':
                if (v < -128 || v > 255) throw new AsmChyba('Hodnota ' + fmtHod(v) + ' se nevejde do bajtu (−128…255); pro nižší/vyšší bajt adresy použijte #<adr / #>adr, pro bitovou masku #<~$80');
                bytes.push(v & 0xFF); break;
              case 'zp': case 'zpx': case 'zpy': case 'indx': case 'indy':
                if (v < 0 || v > 255) throw new AsmChyba('Adresa ' + fmtHod(v) + ' není v nulové stránce ($00–$FF)');
                bytes.push(v); break;
              case 'abs': case 'absx': case 'absy': case 'ind':
                if (v < 0 || v > 0xFFFF) throw new AsmChyba('Adresa ' + fmtHod(v) + ' je mimo paměť ($0000–$FFFF)');
                bytes.push(v & 0xFF, v >> 8); break;
              case 'rel': {
                if (v < 0 || v > 0xFFFF) throw new AsmChyba('Cíl skoku ' + fmtHod(v) + ' je mimo paměť');
                let off = (v - ((pc0 + 2) & 0xFFFF)) & 0xFFFF;   // modulo 64 KiB (větvení přes $FFFF/$0000)
                if (off >= 0x8000) off -= 0x10000;
                if (off < -128 || off > 127) throw new AsmChyba('Cíl větvení je mimo dosah (' + (off > 0 ? '+' : '') + off + ' bajtů, povoleno −128…+127). Použijte opačnou podmínku a JMP.');
                bytes.push(off & 0xFF); break;
              }
            }
            if (p.mode === 'ind' && (v & 0xFF) === 0xFF) warnings.push({ line: p.line, msg: 'JMP (' + hex4(v) + ') – na NMOS 6502 se vyšší bajt cíle čte z ' + hex4(v & 0xFF00) + ', ne z ' + hex4(v + 1) });
          }
          if (start < 0) start = pc0;
        }
        bytes.forEach((b, k) => zapis((pc0 + k) & 0xFFFF, b, p.line, k === 0));
        if (!p.dir) kodStart[pc0] = 1;
        else for (let k = 0; k < bytes.length; k++) kodStart[(pc0 + k) & 0xFFFF] = 2;   // 2 = data (.byte, .word, .text…)
        if (bytes.length) lineToAddr[p.line] = pc0;
        listing.push({ line: p.line, addr: pc0, bytes });
      } catch (e) {
        if (!(e instanceof AsmChyba)) throw e;
        chyba(p.line, e.message);
      }
    }
    errors.sort((a, b) => a.line - b.line);

    // úseky obsazené paměti
    const segments = [];
    for (let a = 0; a < 65536; a++) {
      if (!used[a]) continue;
      let b = a; while (b + 1 < 65536 && used[b + 1]) b++;
      segments.push({ start: a, end: b }); a = b;
    }
    if (used[0xFFFC] && used[0xFFFD]) start = mem[0xFFFC] | (mem[0xFFFD] << 8);
    if (start < 0) start = prvniData >= 0 ? prvniData : ORIGIN;

    // symboly pro výstup
    const symbols = [];
    symboly.forEach((s, pj) => { if (s.value !== undefined) symbols.push({ name: pj, jmeno: s.jmeno, value: s.value, line: s.line, typ: s.typ }); });
    symbols.sort((a, b) => a.value - b.value || a.name.localeCompare(b.name));

    // výpis
    const txt = [];
    for (const l of listing) {
      const zdroj = radky[l.line - 1];
      if (l.hodnota !== undefined) { txt.push(pad('', 4) + '  ' + pad('= ' + hex4(l.hodnota).slice(1), 12) + ' ' + pad(String(l.line), 5) + ' ' + zdroj); continue; }
      const b = l.bytes;
      for (let k = 0; k < Math.max(1, b.length); k += 3) {
        const cast = b.slice(k, k + 3).map(x => x.toString(16).toUpperCase().padStart(2, '0')).join(' ');
        const adr = l.addr === null ? '    ' : ((l.addr + k) & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
        txt.push(adr + '  ' + pad(cast, 12) + ' ' + (k === 0 ? pad(String(l.line), 5) + ' ' + zdroj : ''));
      }
    }
    const total = used.reduce((s, x) => s + x, 0);
    return {
      ok: errors.length === 0, errors, warnings, mem, used, start, segments, addrToLine, lineToAddr, kodStart,
      symbols, listing: txt.join('\n'), bytes: total, lines: radky.length,
    };
  }
  function fmtHod(v) { return v < 0 ? String(v) : (v > 255 ? hex4(v) : hex2(v)) + ' (' + v + ')'; }
  function pad(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); }

  /** Vyhodnocení výrazu se symboly z výsledku překladu (pro sledované výrazy). */
  function vyraz(text, symbols, pc) {
    const mapa = new Map(); (symbols || []).forEach(s => mapa.set(s.name, s.value));
    const r = vyhodnot(text, { pc: pc || 0, symbol: n => mapa.get(n) });
    if (!r.znamy) throw new AsmChyba('Neznámý symbol „' + r.chybi[0] + '“');
    return r.v;
  }

  const ASM = { assemble, vyraz, vyhodnot, rozeberOperand, MAPA_DOK, MAPA_VSE, VETVENI, DIREKTIVY, AsmChyba, POPIS_REZIMU };
  if (typeof module !== 'undefined' && module.exports) module.exports = ASM;
  else root.CPU8ASM = ASM;
})(typeof self !== 'undefined' ? self : this);
