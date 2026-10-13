/* ============================================================
   cpu8/disasm.js – disassembler MOS 6502
   disasm(read, adresa, volby) → { addr, len, bytes, mnem, operand, text, mode, op, ill, target }
   volby: { illegal (zobrazit nedokumentované jako instrukce), symbols (Map adresa→jméno), lower }
   Výstup jde znovu přeložit assemblerem cpu8/asm.js na stejné bajty – i u nedokumentovaných opkódů:
   nejednoznačné varianty (jiné NOP, JAM, SBC $EB…) se vypíšou jako „.byte … ; NOP $34,X“.
   ============================================================ */
(function (root) {
  'use strict';
  const CPU8 = (typeof module !== 'undefined' && module.exports) ? require('./cpu.js') : root.CPU8;
  const { OPS } = CPU8;
  const h2 = v => '$' + (v & 0xFF).toString(16).toUpperCase().padStart(2, '0');
  const h4 = v => '$' + (v & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');

  // mnemoniky, které mají i variantu v nulové stránce – u absolutní adresy < $100 je třeba „a:“
  const MA_ZP = {};
  OPS.forEach(o => { if (!o.ill) { const r = MA_ZP[o.m] || (MA_ZP[o.m] = {}); r[o.mode] = true; } });

  // opkód, který assembler zvolí pro (mnemonika, režim): dokumentovaný, jinak nejnižší nedokumentovaný
  const PREFER = {};
  OPS.forEach(o => {
    const k = o.m + ' ' + o.mode, p = PREFER[k];
    if (p === undefined || (OPS[p].ill && !o.ill)) PREFER[k] = o.op;
  });
  const h2s = b => '$' + b.toString(16).toUpperCase().padStart(2, '0');

  function disasm(read, addr, volby) {
    volby = volby || {};
    const op = read(addr & 0xFFFF);
    const d = OPS[op];
    const sym = volby.symbols;
    const jmeno = (v, siroky) => (sym && sym.has(v)) ? sym.get(v) : (siroky ? h4(v) : h2(v));
    if (d.ill && !volby.illegal) {
      return { addr, len: 1, bytes: [op], mnem: '.byte', operand: h2(op), text: '.byte ' + h2(op), mode: 'imp', op, ill: true, neplatna: true };
    }
    const len = d.bytes;
    const bytes = [op];
    for (let i = 1; i < len; i++) bytes.push(read((addr + i) & 0xFFFF));
    const b1 = bytes[1], w = bytes[1] | (bytes[2] << 8);
    let operand = '', target = null;
    const zp = MA_ZP[d.m] || {};
    switch (d.mode) {
      case 'imp': break;
      case 'acc': operand = 'A'; break;
      case 'imm': operand = '#' + h2(b1); break;
      case 'zp': operand = jmeno(b1, false); target = b1; break;
      case 'zpx': operand = jmeno(b1, false) + ',X'; target = b1; break;
      case 'zpy': operand = jmeno(b1, false) + ',Y'; target = b1; break;
      case 'abs': operand = (w < 0x100 && zp.zp ? 'a:' : '') + jmeno(w, true); target = w; break;
      case 'absx': operand = (w < 0x100 && zp.zpx ? 'a:' : '') + jmeno(w, true) + ',X'; target = w; break;
      case 'absy': operand = (w < 0x100 && zp.zpy ? 'a:' : '') + jmeno(w, true) + ',Y'; target = w; break;
      case 'ind': operand = '(' + jmeno(w, true) + ')'; target = w; break;
      case 'indx': operand = '(' + jmeno(b1, false) + ',X)'; target = b1; break;
      case 'indy': operand = '(' + jmeno(b1, false) + '),Y'; target = b1; break;
      case 'rel': {
        const t = (addr + 2 + (b1 < 128 ? b1 : b1 - 256)) & 0xFFFF;
        operand = jmeno(t, true); target = t; break;
      }
    }
    let mnem = d.m;
    if (d.ill && PREFER[d.m + ' ' + d.mode] !== op) {
      // nejednoznačný nedokumentovaný opkód (např. jiná varianta NOP) – jako data, aby překlad zpět dal stejné bajty
      const txt = d.m + (operand ? ' ' + operand : '');
      return { addr, len, bytes, mnem: '.byte', operand: bytes.map(h2s).join(', '), text: '.byte ' + bytes.map(h2s).join(', ') + ' ; ' + txt,
        mode: d.mode, op, ill: true, target, nejednoznacna: true };
    }
    if (volby.lower) { mnem = mnem.toLowerCase(); operand = operand.replace(/,X/g, ',x').replace(/,Y/g, ',y'); }
    return { addr, len, bytes, mnem, operand, text: mnem + (operand ? ' ' + operand : ''), mode: d.mode, op, ill: d.ill, target };
  }

  /** Disassembluje úsek od..do (včetně) do pole řádků. */
  function disasmRange(read, od, doo, volby) {
    const out = []; let a = od;
    while (a <= doo && out.length < 100000) { const r = disasm(read, a, volby); out.push(r); a += r.len; }
    return out;
  }

  /**
   * Disassembler s ohledem na výsledek překladu: datové bajty (.byte/.text…) a prázdná paměť (nuly mimo
   * přeložené úseky) se vypíšou jako .byte (po nejvýš 8), ne jako instrukce. info = { used, kodStart, pc }.
   */
  function disasmChytre(read, addr, volby, info) {
    if (!info || addr === info.pc) return disasm(read, addr, volby);
    const sym = volby && volby.symbols;
    const data = info.kodStart[addr] === 2;
    const prazdne = !info.used[addr] && read(addr) === 0;
    if (!data && !prazdne) return disasm(read, addr, volby);
    const bytes = [];
    let a = addr;
    while (bytes.length < 8 && a <= 0xFFFF && a !== info.pc && (a === addr || !(sym && sym.has(a)))) {
      if (data ? info.kodStart[a] !== 2 : (info.used[a] || read(a) !== 0)) break;
      bytes.push(read(a)); a++;
    }
    const op = bytes.map(h2s).join(', ');
    return { addr, len: bytes.length, bytes, mnem: '.byte', operand: op, text: '.byte ' + op, mode: 'imp', op: bytes[0], ill: false, data: true, prazdne };
  }

  /** Najde začátek dekódování tak, aby sekvenční dekódování trefilo adresu cil (pro zobrazení řádků před PC). */
  function zacatekPred(read, cil, pocet, volby, znameStarty, dekoder) {
    const dek = dekoder || (a => disasm(read, a, volby));
    for (let zpet = Math.min(cil, pocet * 8); zpet > 0; zpet--) {
      const z = cil - zpet;
      if (znameStarty && !znameStarty(z)) continue;
      let a = z, n = 0;
      while (a < cil) { a += dek(a).len; n++; }
      if (a === cil && n <= pocet) return z;
    }
    return cil;
  }

  const DIS = { disasm, disasmRange, disasmChytre, zacatekPred, PREFER };
  if (typeof module !== 'undefined' && module.exports) module.exports = DIS;
  else root.CPU8DIS = DIS;
})(typeof self !== 'undefined' ? self : this);
