/* ============================================================
   cpu8/cpu.js – emulátor procesoru MOS 6502 (NMOS)
   - všechny dokumentované instrukce a adresní režimy
   - dekadický režim ADC/SBC včetně chování příznaků N, V, Z na NMOS
   - přesné počty cyklů (+1 za přechod stránky, +1/+2 za skok větvení)
   - IRQ (úroveň), NMI (hrana), BRK, RTI, zásobník na $0100–$01FF
   - nedokumentované opkódy volitelně (cpu.illegal = true),
     jinak se procesor zastaví s chybou „neplatná instrukce“
   - historie kroků pro krok zpět (registry + přepsané bajty)
   Modul jde načíst v prohlížeči (globální CPU8) i v node (require).
   ============================================================ */
(function (root) {
  'use strict';

  // ---------- příznaky ----------
  const C = 0x01, Z = 0x02, I = 0x04, D = 0x08, B = 0x10, U = 0x20, V = 0x40, N = 0x80;

  // ---------- adresní režimy ----------
  const REZIMY = ['imp', 'acc', 'imm', 'zp', 'zpx', 'zpy', 'abs', 'absx', 'absy', 'ind', 'indx', 'indy', 'rel'];
  const DELKA = { imp: 1, acc: 1, imm: 2, zp: 2, zpx: 2, zpy: 2, abs: 3, absx: 3, absy: 3, ind: 3, indx: 2, indy: 2, rel: 2 };
  const IMP = 0, ACC = 1, IMM = 2, ZP = 3, ZPX = 4, ZPY = 5, ABS = 6, ABSX = 7, ABSY = 8, IND = 9, INDX = 10, INDY = 11, REL = 12;

  // ---------- tabulka opkódů ----------
  // formát: MNEMONIKA opkód:režim:cykly[+]   („+“ = +1 cyklus při přechodu stránky)
  const DOKUMENTOVANE = `
ADC 69:imm:2 65:zp:3 75:zpx:4 6D:abs:4 7D:absx:4+ 79:absy:4+ 61:indx:6 71:indy:5+
AND 29:imm:2 25:zp:3 35:zpx:4 2D:abs:4 3D:absx:4+ 39:absy:4+ 21:indx:6 31:indy:5+
ASL 0A:acc:2 06:zp:5 16:zpx:6 0E:abs:6 1E:absx:7
BCC 90:rel:2
BCS B0:rel:2
BEQ F0:rel:2
BIT 24:zp:3 2C:abs:4
BMI 30:rel:2
BNE D0:rel:2
BPL 10:rel:2
BRK 00:imp:7
BVC 50:rel:2
BVS 70:rel:2
CLC 18:imp:2
CLD D8:imp:2
CLI 58:imp:2
CLV B8:imp:2
CMP C9:imm:2 C5:zp:3 D5:zpx:4 CD:abs:4 DD:absx:4+ D9:absy:4+ C1:indx:6 D1:indy:5+
CPX E0:imm:2 E4:zp:3 EC:abs:4
CPY C0:imm:2 C4:zp:3 CC:abs:4
DEC C6:zp:5 D6:zpx:6 CE:abs:6 DE:absx:7
DEX CA:imp:2
DEY 88:imp:2
EOR 49:imm:2 45:zp:3 55:zpx:4 4D:abs:4 5D:absx:4+ 59:absy:4+ 41:indx:6 51:indy:5+
INC E6:zp:5 F6:zpx:6 EE:abs:6 FE:absx:7
INX E8:imp:2
INY C8:imp:2
JMP 4C:abs:3 6C:ind:5
JSR 20:abs:6
LDA A9:imm:2 A5:zp:3 B5:zpx:4 AD:abs:4 BD:absx:4+ B9:absy:4+ A1:indx:6 B1:indy:5+
LDX A2:imm:2 A6:zp:3 B6:zpy:4 AE:abs:4 BE:absy:4+
LDY A0:imm:2 A4:zp:3 B4:zpx:4 AC:abs:4 BC:absx:4+
LSR 4A:acc:2 46:zp:5 56:zpx:6 4E:abs:6 5E:absx:7
NOP EA:imp:2
ORA 09:imm:2 05:zp:3 15:zpx:4 0D:abs:4 1D:absx:4+ 19:absy:4+ 01:indx:6 11:indy:5+
PHA 48:imp:3
PHP 08:imp:3
PLA 68:imp:4
PLP 28:imp:4
ROL 2A:acc:2 26:zp:5 36:zpx:6 2E:abs:6 3E:absx:7
ROR 6A:acc:2 66:zp:5 76:zpx:6 6E:abs:6 7E:absx:7
RTI 40:imp:6
RTS 60:imp:6
SBC E9:imm:2 E5:zp:3 F5:zpx:4 ED:abs:4 FD:absx:4+ F9:absy:4+ E1:indx:6 F1:indy:5+
SEC 38:imp:2
SED F8:imp:2
SEI 78:imp:2
STA 85:zp:3 95:zpx:4 8D:abs:4 9D:absx:5 99:absy:5 81:indx:6 91:indy:6
STX 86:zp:3 96:zpy:4 8E:abs:4
STY 84:zp:3 94:zpx:4 8C:abs:4
TAX AA:imp:2
TAY A8:imp:2
TSX BA:imp:2
TXA 8A:imp:2
TXS 9A:imp:2
TYA 98:imp:2`;

  const NEDOKUMENTOVANE = `
SLO 07:zp:5 17:zpx:6 0F:abs:6 1F:absx:7 1B:absy:7 03:indx:8 13:indy:8
RLA 27:zp:5 37:zpx:6 2F:abs:6 3F:absx:7 3B:absy:7 23:indx:8 33:indy:8
SRE 47:zp:5 57:zpx:6 4F:abs:6 5F:absx:7 5B:absy:7 43:indx:8 53:indy:8
RRA 67:zp:5 77:zpx:6 6F:abs:6 7F:absx:7 7B:absy:7 63:indx:8 73:indy:8
SAX 87:zp:3 97:zpy:4 8F:abs:4 83:indx:6
LAX A7:zp:3 B7:zpy:4 AF:abs:4 BF:absy:4+ A3:indx:6 B3:indy:5+
DCP C7:zp:5 D7:zpx:6 CF:abs:6 DF:absx:7 DB:absy:7 C3:indx:8 D3:indy:8
ISC E7:zp:5 F7:zpx:6 EF:abs:6 FF:absx:7 FB:absy:7 E3:indx:8 F3:indy:8
ANC 0B:imm:2 2B:imm:2
ALR 4B:imm:2
ARR 6B:imm:2
SBX CB:imm:2
SBC EB:imm:2
ANE 8B:imm:2
LXA AB:imm:2
SHA 9F:absy:5 93:indy:6
SHY 9C:absx:5
SHX 9E:absy:5
TAS 9B:absy:5
LAS BB:absy:4+
NOP 1A:imp:2 3A:imp:2 5A:imp:2 7A:imp:2 DA:imp:2 FA:imp:2 80:imm:2 82:imm:2 89:imm:2 C2:imm:2 E2:imm:2 04:zp:3 44:zp:3 64:zp:3 14:zpx:4 34:zpx:4 54:zpx:4 74:zpx:4 D4:zpx:4 F4:zpx:4 0C:abs:4 1C:absx:4+ 3C:absx:4+ 5C:absx:4+ 7C:absx:4+ DC:absx:4+ FC:absx:4+
JAM 02:imp:2 12:imp:2 22:imp:2 32:imp:2 42:imp:2 52:imp:2 62:imp:2 72:imp:2 92:imp:2 B2:imp:2 D2:imp:2 F2:imp:2`;

  const OPS = new Array(256).fill(null);
  function nactiTabulku(text, ill) {
    text.trim().split('\n').forEach(radek => {
      const casti = radek.trim().split(/\s+/);
      const m = casti[0];
      for (let i = 1; i < casti.length; i++) {
        const [hex, rez, cyk] = casti[i].split(':');
        const op = parseInt(hex, 16);
        if (OPS[op]) throw new Error('duplicitní opkód ' + hex);
        OPS[op] = {
          op, m, mode: rez, modeId: REZIMY.indexOf(rez), bytes: DELKA[rez],
          cyc: parseInt(cyk, 10), px: cyk.endsWith('+') ? 1 : 0, ill,
        };
      }
    });
  }
  nactiTabulku(DOKUMENTOVANE, false);
  nactiTabulku(NEDOKUMENTOVANE, true);
  for (let i = 0; i < 256; i++) if (!OPS[i]) throw new Error('chybí opkód ' + i.toString(16));

  // ---------- pomocné ----------
  function nz(cpu, v) { cpu.P = (cpu.P & ~(N | Z)) | (v & N) | (v === 0 ? Z : 0); }
  function setF(cpu, f, on) { if (on) cpu.P |= f; else cpu.P &= ~f; }
  function push(cpu, v) { cpu.write(0x100 | cpu.SP, v); cpu.SP = (cpu.SP - 1) & 0xFF; }
  function pull(cpu) { cpu.SP = (cpu.SP + 1) & 0xFF; return cpu.read(0x100 | cpu.SP); }
  function rd(cpu, ea) { const v = cpu.read(ea); cpu.m = v; return v; }

  function adc(cpu, v) {
    const a = cpu.A, c = cpu.P & C;
    if (cpu.P & D) {
      // NMOS 6502: Z podle binárního součtu, N a V z mezivýsledku po korekci nižší číslice
      let lo = (a & 0x0F) + (v & 0x0F) + c;
      if (lo > 9) lo += 6;
      let hi = (a >> 4) + (v >> 4) + (lo > 0x0F ? 1 : 0);
      setF(cpu, Z, ((a + v + c) & 0xFF) === 0);
      setF(cpu, N, (hi & 8) !== 0);
      setF(cpu, V, ((((hi << 4) ^ a) & 0x80) !== 0) && !((a ^ v) & 0x80));
      if (hi > 9) hi += 6;
      setF(cpu, C, hi > 0x0F);
      cpu.A = ((hi << 4) | (lo & 0x0F)) & 0xFF;
    } else {
      const s = a + v + c;
      setF(cpu, C, s > 0xFF);
      setF(cpu, V, ((a ^ s) & (v ^ s) & 0x80) !== 0);
      cpu.A = s & 0xFF;
      nz(cpu, cpu.A);
    }
  }
  function sbc(cpu, v) {
    const a = cpu.A, c = cpu.P & C;
    const s = a - v - (1 - c);
    if (cpu.P & D) {
      // příznaky jako v binárním režimu, výsledek s dekadickou korekcí
      let lo = (a & 0x0F) - (v & 0x0F) - (1 - c);
      let hi = (a >> 4) - (v >> 4);
      if (lo & 0x10) { lo -= 6; hi--; }
      if (hi & 0x10) hi -= 6;
      setF(cpu, C, s >= 0);
      setF(cpu, V, ((a ^ v) & (a ^ s) & 0x80) !== 0);
      nz(cpu, s & 0xFF);
      cpu.A = ((hi << 4) | (lo & 0x0F)) & 0xFF;
    } else {
      setF(cpu, C, s >= 0);
      setF(cpu, V, ((a ^ v) & (a ^ s) & 0x80) !== 0);
      cpu.A = s & 0xFF;
      nz(cpu, cpu.A);
    }
  }
  function cmp(cpu, r, v) { const t = r - v; setF(cpu, C, t >= 0); nz(cpu, t & 0xFF); }
  function vetev(cpu, ea, podm) {
    cpu.taken = podm;
    if (!podm) return 0;
    const navic = ((cpu.PC ^ ea) & 0xFF00) ? 2 : 1;
    cpu.PC = ea;
    return navic;
  }
  // čtení–změna–zápis (ASL, ROL… v paměti nebo v A)
  function rmw(cpu, ea, mode, fn) {
    if (mode === ACC) { cpu.m = cpu.A; cpu.A = fn(cpu.A); nz(cpu, cpu.A); return cpu.A; }
    const v = fn(rd(cpu, ea));
    cpu.write(ea, v); nz(cpu, v); return v;
  }
  const fAsl = cpu => v => { setF(cpu, C, v & 0x80); return (v << 1) & 0xFF; };
  const fLsr = cpu => v => { setF(cpu, C, v & 1); return v >> 1; };
  const fRol = cpu => v => { const c = cpu.P & C; setF(cpu, C, v & 0x80); return ((v << 1) | c) & 0xFF; };
  const fRor = cpu => v => { const c = cpu.P & C; setF(cpu, C, v & 1); return (v >> 1) | (c << 7); };
  // nestabilní zápisy SHA/SHX/SHY/TAS: hodnota & (H+1), při přechodu stránky se změní i vyšší bajt adresy
  function shxx(cpu, ea, hodnota) {
    const h = ((cpu.base >> 8) + 1) & 0xFF;
    let v = hodnota & h;
    if (cpu.cross) ea = (ea & 0xFF) | (v << 8);
    cpu.write(ea, v);
  }

  // ---------- implementace instrukcí: fn(cpu, ea, mode) → extra cykly ----------
  const IMPL = {
    ADC: (c, ea) => { adc(c, rd(c, ea)); },
    SBC: (c, ea) => { sbc(c, rd(c, ea)); },
    AND: (c, ea) => { c.A &= rd(c, ea); nz(c, c.A); },
    ORA: (c, ea) => { c.A |= rd(c, ea); nz(c, c.A); },
    EOR: (c, ea) => { c.A ^= rd(c, ea); nz(c, c.A); },
    ASL: (c, ea, mo) => { rmw(c, ea, mo, fAsl(c)); },
    LSR: (c, ea, mo) => { rmw(c, ea, mo, fLsr(c)); },
    ROL: (c, ea, mo) => { rmw(c, ea, mo, fRol(c)); },
    ROR: (c, ea, mo) => { rmw(c, ea, mo, fRor(c)); },
    BCC: (c, ea) => vetev(c, ea, !(c.P & C)),
    BCS: (c, ea) => vetev(c, ea, !!(c.P & C)),
    BEQ: (c, ea) => vetev(c, ea, !!(c.P & Z)),
    BNE: (c, ea) => vetev(c, ea, !(c.P & Z)),
    BMI: (c, ea) => vetev(c, ea, !!(c.P & N)),
    BPL: (c, ea) => vetev(c, ea, !(c.P & N)),
    BVS: (c, ea) => vetev(c, ea, !!(c.P & V)),
    BVC: (c, ea) => vetev(c, ea, !(c.P & V)),
    BIT: (c, ea) => { const v = rd(c, ea); c.P = (c.P & ~(N | V | Z)) | (v & (N | V)) | ((c.A & v) === 0 ? Z : 0); },
    BRK: (c) => {
      const pc = (c.PC + 1) & 0xFFFF;               // BRK přeskakuje „podpisový“ bajt
      push(c, pc >> 8); push(c, pc & 0xFF); push(c, c.P | B | U);
      c.P |= I;
      c.PC = c.read(0xFFFE) | (c.read(0xFFFF) << 8);
    },
    CLC: c => { c.P &= ~C; }, CLD: c => { c.P &= ~D; }, CLI: c => { c.P &= ~I; }, CLV: c => { c.P &= ~V; },
    SEC: c => { c.P |= C; }, SED: c => { c.P |= D; }, SEI: c => { c.P |= I; },
    CMP: (c, ea) => { cmp(c, c.A, rd(c, ea)); },
    CPX: (c, ea) => { cmp(c, c.X, rd(c, ea)); },
    CPY: (c, ea) => { cmp(c, c.Y, rd(c, ea)); },
    DEC: (c, ea) => { const v = (rd(c, ea) - 1) & 0xFF; c.write(ea, v); nz(c, v); },
    INC: (c, ea) => { const v = (rd(c, ea) + 1) & 0xFF; c.write(ea, v); nz(c, v); },
    DEX: c => { c.X = (c.X - 1) & 0xFF; nz(c, c.X); },
    DEY: c => { c.Y = (c.Y - 1) & 0xFF; nz(c, c.Y); },
    INX: c => { c.X = (c.X + 1) & 0xFF; nz(c, c.X); },
    INY: c => { c.Y = (c.Y + 1) & 0xFF; nz(c, c.Y); },
    JMP: (c, ea) => { c.PC = ea; },
    JSR: (c, ea) => {
      const r = (c.PC - 1) & 0xFFFF; push(c, r >> 8); push(c, r & 0xFF);
      // skutečný 6502 čte vyšší bajt cíle až po zápisu do zásobníku (projeví se, když zásobník překrývá instrukci)
      c.PC = (ea & 0xFF) | (c.read((c.pc0 + 2) & 0xFFFF) << 8); c.ea = c.PC;
    },
    RTS: c => { const lo = pull(c), hi = pull(c); c.PC = (((hi << 8) | lo) + 1) & 0xFFFF; },
    RTI: c => { c.P = (pull(c) & ~B) | U; const lo = pull(c), hi = pull(c); c.PC = (hi << 8) | lo; },
    LDA: (c, ea) => { c.A = rd(c, ea); nz(c, c.A); },
    LDX: (c, ea) => { c.X = rd(c, ea); nz(c, c.X); },
    LDY: (c, ea) => { c.Y = rd(c, ea); nz(c, c.Y); },
    STA: (c, ea) => { c.write(ea, c.A); },
    STX: (c, ea) => { c.write(ea, c.X); },
    STY: (c, ea) => { c.write(ea, c.Y); },
    NOP: (c, ea, mo) => { if (mo !== IMP) rd(c, ea); },
    PHA: c => { push(c, c.A); },
    PHP: c => { push(c, c.P | B | U); },
    PLA: c => { c.A = pull(c); nz(c, c.A); },
    PLP: c => { c.P = (pull(c) & ~B) | U; },
    TAX: c => { c.X = c.A; nz(c, c.X); }, TAY: c => { c.Y = c.A; nz(c, c.Y); },
    TXA: c => { c.A = c.X; nz(c, c.A); }, TYA: c => { c.A = c.Y; nz(c, c.A); },
    TSX: c => { c.X = c.SP; nz(c, c.X); }, TXS: c => { c.SP = c.X; },
    // --- nedokumentované ---
    SLO: (c, ea) => { let v = rd(c, ea); setF(c, C, v & 0x80); v = (v << 1) & 0xFF; c.write(ea, v); c.A |= v; nz(c, c.A); },
    RLA: (c, ea) => { let v = rd(c, ea); const cc = c.P & C; setF(c, C, v & 0x80); v = ((v << 1) | cc) & 0xFF; c.write(ea, v); c.A &= v; nz(c, c.A); },
    SRE: (c, ea) => { let v = rd(c, ea); setF(c, C, v & 1); v >>= 1; c.write(ea, v); c.A ^= v; nz(c, c.A); },
    RRA: (c, ea) => { let v = rd(c, ea); const cc = c.P & C; setF(c, C, v & 1); v = (v >> 1) | (cc << 7); c.write(ea, v); adc(c, v); },
    SAX: (c, ea) => { c.write(ea, c.A & c.X); },
    LAX: (c, ea) => { c.A = c.X = rd(c, ea); nz(c, c.A); },
    DCP: (c, ea) => { const v = (rd(c, ea) - 1) & 0xFF; c.write(ea, v); cmp(c, c.A, v); },
    ISC: (c, ea) => { const v = (rd(c, ea) + 1) & 0xFF; c.write(ea, v); sbc(c, v); },
    ANC: (c, ea) => { c.A &= rd(c, ea); nz(c, c.A); setF(c, C, c.A & 0x80); },
    ALR: (c, ea) => { const t = c.A & rd(c, ea); setF(c, C, t & 1); c.A = t >> 1; nz(c, c.A); },
    ARR: (c, ea) => {
      const t = c.A & rd(c, ea), cc = c.P & C;
      if (c.P & D) {
        let a = (t >> 1) | (cc << 7);
        setF(c, N, cc); setF(c, Z, a === 0); setF(c, V, (t ^ a) & 0x40);
        const ah = t >> 4, al = t & 0x0F;
        if (al + (al & 1) > 5) a = (a & 0xF0) | ((a + 6) & 0x0F);
        if (ah + (ah & 1) > 5) { c.P |= C; a = (a + 0x60) & 0xFF; } else c.P &= ~C;
        c.A = a;
      } else {
        c.A = (t >> 1) | (cc << 7); nz(c, c.A);
        setF(c, C, c.A & 0x40); setF(c, V, ((c.A >> 6) ^ (c.A >> 5)) & 1);
      }
    },
    SBX: (c, ea) => { const t = (c.A & c.X) - rd(c, ea); setF(c, C, t >= 0); c.X = t & 0xFF; nz(c, c.X); },
    ANE: (c, ea) => { c.A = (c.A | 0xEE) & c.X & rd(c, ea); nz(c, c.A); },
    LXA: (c, ea) => { c.A = c.X = (c.A | 0xEE) & rd(c, ea); nz(c, c.A); },
    SHA: (c, ea) => { shxx(c, ea, c.A & c.X); },
    SHX: (c, ea) => { shxx(c, ea, c.X); },
    SHY: (c, ea) => { shxx(c, ea, c.Y); },
    TAS: (c, ea) => { c.SP = c.A & c.X; shxx(c, ea, c.A & c.X); },
    LAS: (c, ea) => { const v = rd(c, ea) & c.SP; c.A = c.X = c.SP = v; nz(c, v); },
    JAM: c => { c.PC = c.pc0; c.halted = true; c.haltReason = 'JAM – procesor zamrzl (instrukce $' + hex2(c.op) + ' na $' + hex4(c.pc0) + ')'; },
  };
  OPS.forEach(o => { o.fn = IMPL[o.m]; if (!o.fn) throw new Error('chybí implementace ' + o.m); });

  function hex2(v) { return (v & 0xFF).toString(16).toUpperCase().padStart(2, '0'); }
  function hex4(v) { return (v & 0xFFFF).toString(16).toUpperCase().padStart(4, '0'); }

  // ---------- procesor ----------
  function CPU(volby) {
    volby = volby || {};
    this.mem = new Uint8Array(65536);
    this.rh = new Array(256).fill(null);   // obsluha čtení po stránkách (I/O)
    this.wh = new Array(256).fill(null);   // obsluha zápisu po stránkách
    this.illegal = !!volby.illegal;         // povolit nedokumentované opkódy
    this.brkStops = !!volby.brkStops;        // BRK zastaví běh (konvence easy6502)
    this.bp = null;                          // Uint8Array(65536) zarážek
    this.irqLines = 0;                       // bitová maska zdrojů IRQ (úroveň)
    this.nmiPending = false;                 // NMI je hranové
    this.eventAt = Infinity;                 // cyklus další události periferií
    this.onEvent = null;
    this.hist = null;
    this.wp = null;                          // Uint8Array(65536) – zastavit při zápisu na adresu (watchpoint)
    this.wpHit = -1;                         // adresa, na kterou poslední krok zapsal a je sledovaná
    this.ext = null;                         // stav periferií pro krok zpět: { uloz1(), uloz2(), obnov(a, b) }
    this.reset(true);
    if (volby.history) this.enableHistory(volby.history);
  }
  CPU.prototype.read = function (a) {
    const h = this.rh[a >> 8];
    return h === null ? this.mem[a] : h(a);
  };
  CPU.prototype.write = function (a, v) {
    const hs = this.hist;
    if (hs !== null) {
      const i = hs.wpos & hs.wmask;
      hs.wa[i] = a; hs.wv[i] = this.mem[a]; hs.wpos++;
    }
    if (this.wp !== null && this.wp[a]) this.wpHit = a;
    const h = this.wh[a >> 8];
    if (h === null) this.mem[a] = v; else h(a, v);
  };
  /** Namapuje obsluhu čtení/zápisu na stránky od..do (vyšší bajty adres). null = obyčejná RAM. */
  CPU.prototype.mapRead = function (od, doo, fn) { for (let p = od; p <= doo; p++) this.rh[p] = fn; };
  CPU.prototype.mapWrite = function (od, doo, fn) { for (let p = od; p <= doo; p++) this.wh[p] = fn; };
  CPU.prototype.word = function (a) { return this.read(a) | (this.read((a + 1) & 0xFFFF) << 8); };

  /** Reset: SP=$FD, I=1, PC z vektoru $FFFC (nebo zadaný start). */
  CPU.prototype.reset = function (tvrdy, start) {
    if (tvrdy) { this.A = 0; this.X = 0; this.Y = 0; }
    this.SP = 0xFD; this.P = U | I;
    this.PC = (start !== undefined && start !== null) ? start & 0xFFFF : (this.mem[0xFFFC] | (this.mem[0xFFFD] << 8));
    this.cycles = 0; this.instr = 0;
    this.halted = false; this.haltReason = '';
    this.nmiPending = false;
    this.pc0 = this.PC; this.op = 0; this.ea = -1; this.m = -1; this.cross = false; this.taken = false;
    this.base = 0; this.ptr = -1; this.irqServed = 0;
    if (this.hist) { this.hist.n = 0; this.hist.wpos = 0; }
  };

  /** Jednorázový požadavek IRQ (např. tlačítko): trvá, dokud ho procesor nepřijme. */
  CPU.prototype.irqPulse = function () { this.irqLines |= IRQ_PULZ; };
  CPU.prototype.irq = function (zdroj, uroven) {
    const bit = 1 << (zdroj || 0);
    if (uroven) this.irqLines |= bit; else this.irqLines &= ~bit;
  };
  CPU.prototype.nmi = function () { this.nmiPending = true; };

  const IRQ_PULZ = 0x80;
  function obsluzPreruseni(cpu, vektor) {
    const pc = cpu.PC;
    push(cpu, pc >> 8); push(cpu, pc & 0xFF); push(cpu, (cpu.P & ~B) | U);
    cpu.P |= I;
    cpu.PC = cpu.read(vektor) | (cpu.read(vektor + 1) << 8);
    return 7;
  }

  /**
   * Provede jeden krok: buď vstup do přerušení (NMI/IRQ, 7 cyklů – samostatný krok, aby se dalo zastavit
   * na první instrukci obsluhy), nebo jednu instrukci. Vrací počet cyklů.
   * Po kroku: irqServed = 0 instrukce, 1 vstup do IRQ, 2 vstup do NMI (pak op = -1).
   */
  CPU.prototype.step = function () {
    if (this.halted) return 0;
    const hs = this.hist;
    if (hs !== null) {
      const s = hs.pos;
      hs.A[s] = this.A; hs.X[s] = this.X; hs.Y[s] = this.Y; hs.SP[s] = this.SP; hs.P[s] = this.P;
      hs.PC[s] = this.PC; hs.cyc[s] = this.cycles; hs.ins[s] = this.instr; hs.w0[s] = hs.wpos;
      hs.nmi[s] = this.nmiPending ? 1 : 0; hs.irq[s] = this.irqLines; hs.ev[s] = this.eventAt;
      if (this.ext !== null) { hs.e1[s] = this.ext.uloz1(); hs.e2[s] = this.ext.uloz2(); }
      hs.typ[s] = 0;
      hs.pos = (s + 1) % hs.size; if (hs.n < hs.size) hs.n++;
    }
    this.wpHit = -1;
    let c = 0;
    this.irqServed = 0;
    if (this.nmiPending || (this.irqLines !== 0 && !(this.P & I))) {
      this.pc0 = this.PC; this.op = -1; this.ea = -1; this.m = -1; this.cross = false; this.taken = false; this.ptr = -1;
      if (this.nmiPending) { this.nmiPending = false; c = obsluzPreruseni(this, 0xFFFA); this.irqServed = 2; }
      else { c = obsluzPreruseni(this, 0xFFFE); this.irqServed = 1; this.irqLines &= ~IRQ_PULZ; }
      if (hs !== null) hs.typ[(hs.pos - 1 + hs.size) % hs.size] = this.irqServed;
      this.ea = this.PC;
      this.cycles += c;
      if (this.cycles >= this.eventAt && this.onEvent) this.onEvent(this);
      return c;
    }

    const pc = this.PC;
    const op = this.read(pc);
    const d = OPS[op];
    this.pc0 = pc; this.op = op; this.m = -1; this.cross = false; this.taken = false; this.ptr = -1;
    if (d.ill && !this.illegal) {
      this.halted = true;
      this.haltReason = 'Neplatná instrukce $' + hex2(op) + ' na adrese $' + hex4(pc);
      this.ea = -1;
      this.cycles += c;
      return c;
    }
    if (op === 0x00 && this.brkStops) {
      this.halted = true; this.haltReason = 'BRK na adrese $' + hex4(pc) + ' – konec programu';
      this.ea = -1; this.cycles += c;
      return c;
    }
    let ea = -1, base, lo, hi;
    switch (d.modeId) {
      case IMP: case ACC: break;
      case IMM: ea = (pc + 1) & 0xFFFF; break;
      case ZP: ea = this.read((pc + 1) & 0xFFFF); break;
      case ZPX: base = this.read((pc + 1) & 0xFFFF); this.base = base; ea = (base + this.X) & 0xFF; break;
      case ZPY: base = this.read((pc + 1) & 0xFFFF); this.base = base; ea = (base + this.Y) & 0xFF; break;
      case ABS: ea = this.read((pc + 1) & 0xFFFF) | (this.read((pc + 2) & 0xFFFF) << 8); break;
      case ABSX:
        base = this.read((pc + 1) & 0xFFFF) | (this.read((pc + 2) & 0xFFFF) << 8);
        ea = (base + this.X) & 0xFFFF; this.base = base; this.cross = ((base ^ ea) & 0xFF00) !== 0; break;
      case ABSY:
        base = this.read((pc + 1) & 0xFFFF) | (this.read((pc + 2) & 0xFFFF) << 8);
        ea = (base + this.Y) & 0xFFFF; this.base = base; this.cross = ((base ^ ea) & 0xFF00) !== 0; break;
      case IND: {
        // chyba NMOS 6502: ukazatel $xxFF bere vyšší bajt z $xx00 téže stránky
        const p = this.read((pc + 1) & 0xFFFF) | (this.read((pc + 2) & 0xFFFF) << 8);
        this.ptr = p;
        lo = this.read(p); hi = this.read((p & 0xFF00) | ((p + 1) & 0xFF));
        ea = lo | (hi << 8); break;
      }
      case INDX: {
        const z = this.read((pc + 1) & 0xFFFF);
        const p = (z + this.X) & 0xFF; this.base = z; this.ptr = p;
        ea = this.read(p) | (this.read((p + 1) & 0xFF) << 8); break;
      }
      case INDY: {
        const z = this.read((pc + 1) & 0xFFFF); this.ptr = z;
        base = this.read(z) | (this.read((z + 1) & 0xFF) << 8);
        ea = (base + this.Y) & 0xFFFF; this.base = base; this.cross = ((base ^ ea) & 0xFF00) !== 0; break;
      }
      case REL: {
        const o = this.read((pc + 1) & 0xFFFF);
        ea = (pc + 2 + (o < 128 ? o : o - 256)) & 0xFFFF; break;
      }
    }
    this.ea = ea;
    this.PC = (pc + d.bytes) & 0xFFFF;
    c += d.cyc + (this.cross ? d.px : 0);
    const extra = d.fn(this, ea, d.modeId);
    if (extra) c += extra;
    this.cycles += c;
    this.instr++;
    if (this.cycles >= this.eventAt && this.onEvent) this.onEvent(this);
    return c;
  };

  /**
   * Běží, dokud nespotřebuje rozpočet cyklů, nenarazí na zarážku, nezastaví se,
   * nebo (volba selfLoop) nenarazí na skok sám na sebe.
   * volby.pokracuj = true: zarážka na aktuálním PC se při první instrukci ignoruje (pokračování ze zarážky).
   * Vrací { reason: 'budget'|'bp'|'halt'|'loop'|'wp', cycles } ('wp' = zápis na sledovanou adresu, viz cpu.wp).
   */
  CPU.prototype.run = function (budget, volby) {
    const bp = this.bp;
    const smycka = !!(volby && volby.selfLoop);
    let used = 0, ignoruj = !!(volby && volby.pokracuj);
    while (used < budget) {
      if (this.halted) return { reason: 'halt', cycles: used };
      if (bp !== null && !ignoruj && bp[this.PC]) return { reason: 'bp', cycles: used };
      ignoruj = false;
      const pc = this.PC;
      used += this.step();
      if (this.wpHit >= 0) return { reason: 'wp', cycles: used, adresa: this.wpHit };
      if (smycka && this.PC === pc && !this.halted) return { reason: 'loop', cycles: used };
    }
    return { reason: this.halted ? 'halt' : 'budget', cycles: used };
  };

  // ---------- historie pro krok zpět ----------
  CPU.prototype.enableHistory = function (n) {
    if (!n) { this.hist = null; return; }
    let wsize = 1; while (wsize < n * 8) wsize <<= 1;
    this.hist = {
      size: n, pos: 0, n: 0,
      A: new Uint8Array(n), X: new Uint8Array(n), Y: new Uint8Array(n), SP: new Uint8Array(n), P: new Uint8Array(n),
      PC: new Uint16Array(n), cyc: new Float64Array(n), ins: new Float64Array(n), w0: new Float64Array(n), nmi: new Uint8Array(n),
      irq: new Uint8Array(n), ev: new Float64Array(n), e1: new Float64Array(n), e2: new Float64Array(n), typ: new Uint8Array(n),
      wa: new Uint16Array(wsize), wv: new Uint8Array(wsize), wmask: wsize - 1, wpos: 0,
    };
  };
  /** Zápisy do paměti provedené posledním krokem: [{ a, old, nw }] (vyžaduje historii). */
  CPU.prototype.lastWrites = function () {
    const hs = this.hist;
    if (!hs || hs.n === 0) return [];
    const s = (hs.pos - 1 + hs.size) % hs.size, out = [];
    for (let k = hs.w0[s]; k < hs.wpos; k++) { const i = k & hs.wmask; out.push({ a: hs.wa[i], old: hs.wv[i], nw: this.mem[hs.wa[i]] }); }
    return out;
  };
  CPU.prototype.historyLength = function () { return this.hist ? this.hist.n : 0; };
  /** Stav před k-tým posledním krokem (k = 1 … historyLength): { A, X, Y, SP, P, PC, cycles, instr, typ } (typ 1/2 = vstup do IRQ/NMI). */
  CPU.prototype.historyEntry = function (k) {
    const hs = this.hist;
    if (!hs || k < 1 || k > hs.n) return null;
    const s = (hs.pos - k + hs.size * 2) % hs.size;
    return { A: hs.A[s], X: hs.X[s], Y: hs.Y[s], SP: hs.SP[s], P: hs.P[s], PC: hs.PC[s], cycles: hs.cyc[s], instr: hs.ins[s], typ: hs.typ[s] };
  };
  /** Vrátí poslední krok. Vrací seznam obnovených adres, nebo null, když historie je prázdná. */
  CPU.prototype.stepBack = function () {
    const hs = this.hist;
    if (!hs || hs.n === 0) return null;
    const s = (hs.pos - 1 + hs.size) % hs.size;
    const w0 = hs.w0[s];
    if (hs.wpos - w0 > hs.wmask + 1) { hs.n = 0; return null; } // zápisy už přepsané (nemělo by nastat)
    const adresy = [];
    for (let k = hs.wpos - 1; k >= w0; k--) {
      const i = k & hs.wmask;
      this.mem[hs.wa[i]] = hs.wv[i]; adresy.push(hs.wa[i]);
    }
    hs.wpos = w0;
    this.A = hs.A[s]; this.X = hs.X[s]; this.Y = hs.Y[s]; this.SP = hs.SP[s]; this.P = hs.P[s];
    this.PC = hs.PC[s]; this.cycles = hs.cyc[s]; this.instr = hs.ins[s];
    this.nmiPending = !!hs.nmi[s]; this.irqLines = hs.irq[s]; this.eventAt = hs.ev[s];
    if (this.ext !== null) this.ext.obnov(hs.e1[s], hs.e2[s]);
    this.halted = false; this.haltReason = ''; this.wpHit = -1;
    hs.pos = s; hs.n--;
    return adresy;
  };

  CPU.prototype.stav = function () {
    return { A: this.A, X: this.X, Y: this.Y, SP: this.SP, PC: this.PC, P: this.P, cycles: this.cycles, instr: this.instr };
  };

  /** Změna hloubky volání po posledním kroku: +1 JSR / vstup do přerušení, −1 RTS / RTI, jinak 0 (pro „krok ven“). */
  function zmenaHloubky(cpu) {
    if (cpu.irqServed) return 1;
    if (cpu.op === 0x20) return 1;
    if (cpu.op === 0x60 || cpu.op === 0x40) return -1;
    return 0;
  }

  const CPU8 = {
    CPU, OPS, REZIMY, DELKA, zmenaHloubky, IRQ_PULZ,
    FLAGS: { C, Z, I, D, B, U, V, N },
    hex2, hex4,
    /** Najde opkód pro mnemoniku a režim (preferuje dokumentovaný). */
    najdiOpkod(m, mode, illegal) {
      let nal = -1;
      for (let i = 0; i < 256; i++) {
        const o = OPS[i];
        if (o.m === m && o.mode === mode) {
          if (!o.ill) return i;
          if (illegal && nal < 0) nal = i;
        }
      }
      return nal;
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CPU8;
  else root.CPU8 = CPU8;
})(typeof self !== 'undefined' ? self : this);
