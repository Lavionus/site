/* ============================================================
   cpu8/vyuka.js – česká příručka instrukcí 6502 a generátor vysvětlení kroku
   INSTR[mnemonika] = { n: anglický název, p: popis, o: operace, f: ovlivněné příznaky, s: skupina }
   vysvetli(info) → pole řádků HTML (jen čísla a pevné texty, žádný uživatelský vstup)
   ============================================================ */
(function (root) {
  'use strict';
  const CPU8 = (typeof module !== 'undefined' && module.exports) ? require('./cpu.js') : root.CPU8;
  const { OPS, FLAGS } = CPU8;

  const SKUPINY = {
    presun: 'Přesuny dat', aritm: 'Aritmetika', logika: 'Logické operace', posun: 'Posuny a rotace',
    porov: 'Porovnání', skok: 'Skoky a podprogramy', vetev: 'Podmíněné větvení', zas: 'Zásobník',
    priz: 'Příznaky', ostatni: 'Ostatní', nedok: 'Nedokumentované',
  };

  const INSTR = {
    LDA: { n: 'Load Accumulator', p: 'Načte hodnotu do akumulátoru A.', o: 'A ← M', f: 'NZ', s: 'presun' },
    LDX: { n: 'Load X', p: 'Načte hodnotu do indexového registru X.', o: 'X ← M', f: 'NZ', s: 'presun' },
    LDY: { n: 'Load Y', p: 'Načte hodnotu do indexového registru Y.', o: 'Y ← M', f: 'NZ', s: 'presun' },
    STA: { n: 'Store Accumulator', p: 'Uloží A do paměti. Příznaky nemění.', o: 'M ← A', f: '', s: 'presun' },
    STX: { n: 'Store X', p: 'Uloží X do paměti.', o: 'M ← X', f: '', s: 'presun' },
    STY: { n: 'Store Y', p: 'Uloží Y do paměti.', o: 'M ← Y', f: '', s: 'presun' },
    TAX: { n: 'Transfer A to X', p: 'Zkopíruje A do X.', o: 'X ← A', f: 'NZ', s: 'presun' },
    TAY: { n: 'Transfer A to Y', p: 'Zkopíruje A do Y.', o: 'Y ← A', f: 'NZ', s: 'presun' },
    TXA: { n: 'Transfer X to A', p: 'Zkopíruje X do A.', o: 'A ← X', f: 'NZ', s: 'presun' },
    TYA: { n: 'Transfer Y to A', p: 'Zkopíruje Y do A.', o: 'A ← Y', f: 'NZ', s: 'presun' },
    TSX: { n: 'Transfer SP to X', p: 'Zkopíruje ukazatel zásobníku do X.', o: 'X ← SP', f: 'NZ', s: 'presun' },
    TXS: { n: 'Transfer X to SP', p: 'Nastaví ukazatel zásobníku podle X. Příznaky nemění.', o: 'SP ← X', f: '', s: 'presun' },
    ADC: { n: 'Add with Carry', p: 'Přičte k A operand a příznak přenosu C. Při D=1 počítá v BCD (dvě desítkové číslice v bajtu). Před prvním sčítáním je třeba CLC.', o: 'A ← A + M + C', f: 'NVZC', s: 'aritm' },
    SBC: { n: 'Subtract with Carry', p: 'Odečte od A operand a „výpůjčku“ (1 − C). Před prvním odčítáním je třeba SEC. Při D=1 počítá v BCD.', o: 'A ← A − M − (1 − C)', f: 'NVZC', s: 'aritm' },
    INC: { n: 'Increment Memory', p: 'Zvýší bajt v paměti o 1 (z $FF přeteče na $00, C se nemění).', o: 'M ← M + 1', f: 'NZ', s: 'aritm' },
    DEC: { n: 'Decrement Memory', p: 'Sníží bajt v paměti o 1.', o: 'M ← M − 1', f: 'NZ', s: 'aritm' },
    INX: { n: 'Increment X', p: 'Zvýší X o 1.', o: 'X ← X + 1', f: 'NZ', s: 'aritm' },
    INY: { n: 'Increment Y', p: 'Zvýší Y o 1.', o: 'Y ← Y + 1', f: 'NZ', s: 'aritm' },
    DEX: { n: 'Decrement X', p: 'Sníží X o 1.', o: 'X ← X − 1', f: 'NZ', s: 'aritm' },
    DEY: { n: 'Decrement Y', p: 'Sníží Y o 1.', o: 'Y ← Y − 1', f: 'NZ', s: 'aritm' },
    AND: { n: 'Logical AND', p: 'Bitový součin A a operandu – nechá jen bity nastavené v obou (maskování).', o: 'A ← A ∧ M', f: 'NZ', s: 'logika' },
    ORA: { n: 'Logical OR', p: 'Bitový součet A a operandu – nastaví bity.', o: 'A ← A ∨ M', f: 'NZ', s: 'logika' },
    EOR: { n: 'Exclusive OR', p: 'Výlučný součet – překlopí bity, které jsou v operandu 1.', o: 'A ← A ⊕ M', f: 'NZ', s: 'logika' },
    BIT: { n: 'Bit Test', p: 'Otestuje bity: Z podle A ∧ M, do N a V zkopíruje bity 7 a 6 operandu. A nemění.', o: 'Z ← (A ∧ M = 0), N ← M₇, V ← M₆', f: 'NVZ', s: 'logika' },
    ASL: { n: 'Arithmetic Shift Left', p: 'Posune bity doleva, bit 7 jde do C, zprava vstupuje 0 (= násobení 2).', o: 'C ← [7…0] ← 0', f: 'NZC', s: 'posun' },
    LSR: { n: 'Logical Shift Right', p: 'Posune bity doprava, bit 0 jde do C, zleva vstupuje 0 (= dělení 2).', o: '0 → [7…0] → C', f: 'NZC', s: 'posun' },
    ROL: { n: 'Rotate Left', p: 'Rotace doleva přes C: bit 7 jde do C, staré C vstupuje do bitu 0.', o: 'C ← [7…0] ← C', f: 'NZC', s: 'posun' },
    ROR: { n: 'Rotate Right', p: 'Rotace doprava přes C: bit 0 jde do C, staré C vstupuje do bitu 7.', o: 'C → [7…0] → C', f: 'NZC', s: 'posun' },
    CMP: { n: 'Compare A', p: 'Porovná A s operandem (spočítá A − M, výsledek zahodí). C=1 když A ≥ M, Z=1 když A = M.', o: 'A − M', f: 'NZC', s: 'porov' },
    CPX: { n: 'Compare X', p: 'Porovná X s operandem.', o: 'X − M', f: 'NZC', s: 'porov' },
    CPY: { n: 'Compare Y', p: 'Porovná Y s operandem.', o: 'Y − M', f: 'NZC', s: 'porov' },
    JMP: { n: 'Jump', p: 'Skočí na adresu. Nepřímý tvar JMP ($xxxx) vezme cíl z paměti (pozor na chybu u $xxFF).', o: 'PC ← adresa', f: '', s: 'skok' },
    JSR: { n: 'Jump to Subroutine', p: 'Uloží do zásobníku adresu posledního bajtu instrukce (návrat − 1) a skočí do podprogramu.', o: 'push PC−1, PC ← adresa', f: '', s: 'skok' },
    RTS: { n: 'Return from Subroutine', p: 'Vyzvedne ze zásobníku adresu, přičte 1 a pokračuje za voláním JSR.', o: 'PC ← pull + 1', f: '', s: 'skok' },
    BRK: { n: 'Break', p: 'Softwarové přerušení: uloží PC+2 a příznaky (s B=1), nastaví I a skočí přes vektor $FFFE. V tomto emulátoru ve výchozím stavu ukončí program.', o: 'push PC+2, push P|B, PC ← ($FFFE)', f: 'I', s: 'skok' },
    RTI: { n: 'Return from Interrupt', p: 'Návrat z přerušení: vyzvedne příznaky a pak PC (bez přičtení 1).', o: 'P ← pull, PC ← pull', f: 'NVDIZC', s: 'skok' },
    BCC: { n: 'Branch if Carry Clear', p: 'Skočí, když C = 0 (po porovnání: menší).', o: 'C = 0', f: '', s: 'vetev' },
    BCS: { n: 'Branch if Carry Set', p: 'Skočí, když C = 1 (po porovnání: větší nebo rovno).', o: 'C = 1', f: '', s: 'vetev' },
    BEQ: { n: 'Branch if Equal', p: 'Skočí, když Z = 1 (výsledek nula / hodnoty se rovnají).', o: 'Z = 1', f: '', s: 'vetev' },
    BNE: { n: 'Branch if Not Equal', p: 'Skočí, když Z = 0.', o: 'Z = 0', f: '', s: 'vetev' },
    BMI: { n: 'Branch if Minus', p: 'Skočí, když N = 1 (bit 7 výsledku je 1).', o: 'N = 1', f: '', s: 'vetev' },
    BPL: { n: 'Branch if Plus', p: 'Skočí, když N = 0.', o: 'N = 0', f: '', s: 'vetev' },
    BVS: { n: 'Branch if Overflow Set', p: 'Skočí, když V = 1 (přetečení se znaménkem).', o: 'V = 1', f: '', s: 'vetev' },
    BVC: { n: 'Branch if Overflow Clear', p: 'Skočí, když V = 0.', o: 'V = 0', f: '', s: 'vetev' },
    PHA: { n: 'Push A', p: 'Uloží A na vrchol zásobníku ($0100 + SP), SP se sníží.', o: 'push A', f: '', s: 'zas' },
    PHP: { n: 'Push Processor Status', p: 'Uloží příznaky do zásobníku (bity B a 5 jsou v uložené kopii 1).', o: 'push P|B', f: '', s: 'zas' },
    PLA: { n: 'Pull A', p: 'Vyzvedne bajt ze zásobníku do A.', o: 'A ← pull', f: 'NZ', s: 'zas' },
    PLP: { n: 'Pull Processor Status', p: 'Vyzvedne příznaky ze zásobníku.', o: 'P ← pull', f: 'NVDIZC', s: 'zas' },
    CLC: { n: 'Clear Carry', p: 'Vynuluje přenos C (před ADC).', o: 'C ← 0', f: 'C', s: 'priz' },
    SEC: { n: 'Set Carry', p: 'Nastaví přenos C (před SBC).', o: 'C ← 1', f: 'C', s: 'priz' },
    CLD: { n: 'Clear Decimal', p: 'Vypne dekadický (BCD) režim.', o: 'D ← 0', f: 'D', s: 'priz' },
    SED: { n: 'Set Decimal', p: 'Zapne dekadický (BCD) režim pro ADC a SBC.', o: 'D ← 1', f: 'D', s: 'priz' },
    CLI: { n: 'Clear Interrupt Disable', p: 'Povolí přerušení IRQ.', o: 'I ← 0', f: 'I', s: 'priz' },
    SEI: { n: 'Set Interrupt Disable', p: 'Zakáže přerušení IRQ (NMI zakázat nejde).', o: 'I ← 1', f: 'I', s: 'priz' },
    CLV: { n: 'Clear Overflow', p: 'Vynuluje příznak přetečení V.', o: 'V ← 0', f: 'V', s: 'priz' },
    NOP: { n: 'No Operation', p: 'Nedělá nic (2 cykly). Nedokumentované varianty čtou operand.', o: '–', f: '', s: 'ostatni' },
    // nedokumentované
    SLO: { n: 'ASL + ORA', p: 'Posune bajt v paměti doleva a výsledek ORuje do A.', o: 'M ← M≪1, A ← A ∨ M', f: 'NZC', s: 'nedok' },
    RLA: { n: 'ROL + AND', p: 'Rotuje bajt v paměti doleva a výsledek ANDuje s A.', o: 'M ← ROL M, A ← A ∧ M', f: 'NZC', s: 'nedok' },
    SRE: { n: 'LSR + EOR', p: 'Posune bajt v paměti doprava a výsledek EORuje do A.', o: 'M ← M≫1, A ← A ⊕ M', f: 'NZC', s: 'nedok' },
    RRA: { n: 'ROR + ADC', p: 'Rotuje bajt v paměti doprava a výsledek přičte k A.', o: 'M ← ROR M, A ← A + M + C', f: 'NVZC', s: 'nedok' },
    SAX: { n: 'Store A AND X', p: 'Uloží A ∧ X.', o: 'M ← A ∧ X', f: '', s: 'nedok' },
    LAX: { n: 'LDA + LDX', p: 'Načte hodnotu zároveň do A i X.', o: 'A, X ← M', f: 'NZ', s: 'nedok' },
    DCP: { n: 'DEC + CMP', p: 'Sníží bajt v paměti a porovná ho s A.', o: 'M ← M − 1, A − M', f: 'NZC', s: 'nedok' },
    ISC: { n: 'INC + SBC', p: 'Zvýší bajt v paměti a odečte ho od A.', o: 'M ← M + 1, A ← A − M − (1 − C)', f: 'NVZC', s: 'nedok' },
    ANC: { n: 'AND + C ← N', p: 'AND s okamžitou hodnotou, bit 7 výsledku zkopíruje do C.', o: 'A ← A ∧ #, C ← N', f: 'NZC', s: 'nedok' },
    ALR: { n: 'AND + LSR', p: 'AND s okamžitou hodnotou a posun doprava.', o: 'A ← (A ∧ #)≫1', f: 'NZC', s: 'nedok' },
    ARR: { n: 'AND + ROR', p: 'AND a rotace doprava se zvláštním nastavením C a V.', o: 'A ← ROR(A ∧ #)', f: 'NVZC', s: 'nedok' },
    SBX: { n: '(A ∧ X) − #', p: 'Do X uloží (A ∧ X) − operand, C jako u CMP.', o: 'X ← (A ∧ X) − #', f: 'NZC', s: 'nedok' },
    ANE: { n: 'XAA (nestabilní)', p: 'A ← (A ∨ magie) ∧ X ∧ #; na skutečném čipu nestabilní, zde magie = $EE.', o: 'A ← (A ∨ $EE) ∧ X ∧ #', f: 'NZ', s: 'nedok' },
    LXA: { n: 'LAX # (nestabilní)', p: 'A, X ← (A ∨ magie) ∧ #; zde magie = $EE.', o: 'A, X ← (A ∨ $EE) ∧ #', f: 'NZ', s: 'nedok' },
    SHA: { n: 'AHX (nestabilní)', p: 'Uloží A ∧ X ∧ (vyšší bajt adresy + 1).', o: 'M ← A ∧ X ∧ (H+1)', f: '', s: 'nedok' },
    SHX: { n: 'SXA (nestabilní)', p: 'Uloží X ∧ (vyšší bajt adresy + 1).', o: 'M ← X ∧ (H+1)', f: '', s: 'nedok' },
    SHY: { n: 'SYA (nestabilní)', p: 'Uloží Y ∧ (vyšší bajt adresy + 1).', o: 'M ← Y ∧ (H+1)', f: '', s: 'nedok' },
    TAS: { n: 'XAS (nestabilní)', p: 'SP ← A ∧ X a uloží SP ∧ (H+1).', o: 'SP ← A ∧ X, M ← SP ∧ (H+1)', f: '', s: 'nedok' },
    LAS: { n: 'LAR', p: 'A, X, SP ← M ∧ SP.', o: 'A, X, SP ← M ∧ SP', f: 'NZ', s: 'nedok' },
    JAM: { n: 'KIL / HLT', p: 'Zablokuje procesor – pomůže jen reset.', o: '–', f: '', s: 'nedok' },
  };

  const REZIM_TEXT = {
    imp: { n: 'implicitní', z: '', p: 'Operand je dán instrukcí samotnou.' },
    acc: { n: 'akumulátor', z: 'A', p: 'Instrukce pracuje přímo s registrem A.' },
    imm: { n: 'okamžitý', z: '#$nn', p: 'Hodnota je přímo v instrukci za opkódem.' },
    zp: { n: 'nulová stránka', z: '$nn', p: 'Jednobajtová adresa v rozsahu $0000–$00FF – kratší a rychlejší.' },
    zpx: { n: 'nulová stránka,X', z: '$nn,X', p: 'Adresa = $nn + X, přetéká v rámci nulové stránky.' },
    zpy: { n: 'nulová stránka,Y', z: '$nn,Y', p: 'Adresa = $nn + Y (jen LDX, STX), přetéká v nulové stránce.' },
    abs: { n: 'absolutní', z: '$nnnn', p: 'Plná 16bitová adresa (nižší bajt první).' },
    absx: { n: 'absolutní,X', z: '$nnnn,X', p: 'Adresa = $nnnn + X; při přechodu stránky čtení trvá o cyklus déle.' },
    absy: { n: 'absolutní,Y', z: '$nnnn,Y', p: 'Adresa = $nnnn + Y; při přechodu stránky čtení trvá o cyklus déle.' },
    ind: { n: 'nepřímý', z: '($nnnn)', p: 'Cílová adresa se přečte z paměti na $nnnn (jen JMP).' },
    indx: { n: 'nepřímý indexovaný X', z: '($nn,X)', p: 'Ukazatel na adrese $nn + X v nulové stránce, z něj se vezme adresa.' },
    indy: { n: 'nepřímý indexovaný Y', z: '($nn),Y', p: 'Z nulové stránky $nn/$nn+1 se vezme adresa a přičte se Y – typicky procházení pole přes ukazatel.' },
    rel: { n: 'relativní', z: '$nnnn', p: 'Posun −128…+127 bajtů od adresy následující instrukce (jen větvení).' },
  };

  const h2 = v => '$' + (v & 0xFF).toString(16).toUpperCase().padStart(2, '0');
  const h4 = v => '$' + (v & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  const b8 = v => '%' + (v & 0xFF).toString(2).padStart(8, '0').replace(/^(\d{4})/, '$1 ');
  const sgn = v => { v &= 0xFF; return v >= 128 ? v - 256 : v; };
  const sgnT = v => { const s = sgn(v); return (s >= 0 ? '+' : '−') + Math.abs(s); };
  const cis = v => (v < 0 ? '−' + Math.abs(v) : String(v));   // typografické minus
  const c = t => '<code>' + t + '</code>';
  const FL = { N: FLAGS.N, V: FLAGS.V, B: FLAGS.B, D: FLAGS.D, I: FLAGS.I, Z: FLAGS.Z, C: FLAGS.C };
  const f = (p, n) => (p & FL[n]) ? 1 : 0;
  const VETEV_PRIZ = { BCC: ['C', 0], BCS: ['C', 1], BEQ: ['Z', 1], BNE: ['Z', 0], BMI: ['N', 1], BPL: ['N', 0], BVS: ['V', 1], BVC: ['V', 0] };

  /** Vysvětlení N a Z pro výsledek r. */
  function nzText(r) {
    return [
      'Z=' + (r === 0 ? '1 – výsledek je nula' : '0 – výsledek ' + h2(r) + ' není nula'),
      'N=' + ((r & 0x80) ? 1 : 0) + ' – bit 7 výsledku ' + b8(r) + (r & 0x80 ? ' je 1 (se znaménkem záporné ' + cis(sgn(r)) + ')' : ' je 0'),
    ];
  }

  /**
   * Vysvětlení jedné provedené instrukce.
   * info = { op, pc, bytes[], pred{A,X,Y,SP,P,PC}, po{…}, ea, m, base, ptr, cross, taken, cykly, zapisy:[{a,old,nw}], prerus (0/1 IRQ/2 NMI), dis (text) }
   */
  function vysvetli(info) {
    const pr = info.pred, po = info.po, out = [];
    const radky = [];
    if (info.prerus) {
      // vstup do přerušení je samostatný krok
      const nmi = info.prerus === 2;
      return [
        '<b>Přerušení ' + (nmi ? 'NMI' : 'IRQ') + '</b> – ' + (nmi ? 'nemaskovatelné přerušení (nejde zakázat).' : 'požadavek periferie (nebo tlačítka); přijme se jen při I=0.'),
        'Procesor dokončil předchozí instrukci, do zásobníku uložil návratovou adresu ' + c(h4(pr.PC)) + ' (nejdřív vyšší bajt) a příznaky ' + b8((pr.P & ~0x10) | 0x20) +
          ' s B=0 (podle B obsluha pozná, že nejde o BRK). SP ' + h2(pr.SP) + ' → ' + h2(po.SP) + '.',
        'Nastavil I=1 (další IRQ počká) a skočil přes vektor ' + (nmi ? '$FFFA' : '$FFFE') + ' na obsluhu ' + c(h4(po.PC)) + '. Obsluha musí skončit instrukcí RTI.',
        'Cykly: 7.',
      ];
    }
    const d = OPS[info.op], I = INSTR[d.m] || { n: d.m, p: '', f: '' };
    radky.push('<b>' + c(info.dis || d.m) + '</b> – ' + I.n + (d.ill ? ' <i>(nedokumentovaná)</i>' : '') + '. ' + I.p);
    // adresní režim
    const R = REZIM_TEXT[d.mode];
    const X = pr.X, Y = pr.Y, ea = info.ea;
    let adr = 'Adresní režim <b>' + R.n + '</b>';
    switch (d.mode) {
      case 'imp': adr += ' – bez operandu.'; break;
      case 'acc': adr += ' – pracuje s registrem A.'; break;
      case 'imm': adr += ' – hodnota ' + c('#' + h2(info.m)) + ' je přímo v instrukci (bajt na ' + h4(ea) + ').'; break;
      case 'zp': adr += ' – adresa ' + c(h4(ea)) + ' (jen jeden bajt adresy, rychlejší).'; break;
      case 'zpx': case 'zpy': {
        const r = d.mode === 'zpx' ? 'X' : 'Y', rv = d.mode === 'zpx' ? X : Y;
        adr += ': ' + c(h2(info.base)) + ' + ' + r + ' (' + h2(rv) + ') = ' + c(h4(ea)) + (info.base + rv > 0xFF ? ' – součet přetekl a zůstal v nulové stránce' : '') + '.';
        break;
      }
      case 'abs': adr += ' – adresa ' + c(h4(ea)) + '.'; break;
      case 'absx': case 'absy': {
        const r = d.mode === 'absx' ? 'X' : 'Y', rv = d.mode === 'absx' ? X : Y;
        adr += ': ' + c(h4(info.base)) + ' + ' + r + ' (' + h2(rv) + ') = ' + c(h4(ea)) + (info.cross ? ' – <b>přechod přes hranici stránky</b>' : '') + '.';
        break;
      }
      case 'ind':
        adr += ': ukazatel na ' + c(h4(info.ptr)) + ' obsahuje cíl ' + c(h4(ea)) + '.';
        if ((info.ptr & 0xFF) === 0xFF) adr += ' Pozor, chyba NMOS 6502: vyšší bajt se vzal z ' + h4(info.ptr & 0xFF00) + ', ne z ' + h4(info.ptr + 1) + '.';
        break;
      case 'indx':
        adr += ': ' + c(h2(info.base)) + ' + X (' + h2(X) + ') = ' + c(h2(info.ptr)) + (info.base + X > 0xFF ? ' (součet přetekl a zůstal v nulové stránce)' : '') +
          '; ukazatel na ' + h2(info.ptr) + '/' + h2(info.ptr + 1) + (info.ptr === 0xFF ? ' (vyšší bajt se bere z $00 – ukazatel nepřeleze nulovou stránku)' : '') + ' → efektivní adresa ' + c(h4(ea)) + '.';
        break;
      case 'indy':
        adr += ': ukazatel na ' + h2(info.ptr) + '/' + h2(info.ptr + 1) + (info.ptr === 0xFF ? ' (vyšší bajt z $00 – zalomení v nulové stránce)' : '') + ' obsahuje ' + c(h4(info.base)) + ', + Y (' + h2(Y) + ') = ' + c(h4(ea)) + (info.cross ? ' – <b>přechod přes hranici stránky</b>' : '') + '.';
        break;
      case 'rel': {
        const o = info.bytes[1];
        adr += ': posun ' + h2(o) + ' (' + sgnT(o) + ') od adresy další instrukce ' + h4(info.pc + 2) + ' → cíl ' + c(h4(ea)) + '.';
        break;
      }
    }
    radky.push(adr);

    // data
    const m = info.m;
    const zap = info.zapisy || [];
    const zapisyInstr = info.prerus ? zap.slice(3) : zap;
    if (m >= 0 && d.mode !== 'imm' && d.mode !== 'acc') radky.push('Načteno M = ' + c(h2(m)) + ' (' + m + ', ' + b8(m) + ') z ' + h4(ea) + '.');
    zapisyInstr.forEach(z => {
      const zas = z.a >= 0x100 && z.a <= 0x1FF && ['JSR', 'PHA', 'PHP', 'BRK'].includes(d.m);
      radky.push((zas ? 'Do zásobníku na ' : 'Zapsáno na ') + c(h4(z.a)) + ': ' + c(h2(z.nw)) + (z.old !== z.nw ? ' (předtím ' + h2(z.old) + ')' : ' (hodnota se nezměnila)') + '.');
    });

    // specifika instrukcí
    const pP = info.prerus ? (pr.P | FLAGS.I) : pr.P;   // příznaky před samotnou instrukcí
    const C0 = f(pP, 'C');
    const pA = pr.A;
    switch (d.m) {
      case 'ADC': case 'SBC': {
        const sub = d.m === 'SBC';
        if (f(pP, 'D')) {
          radky.push('Dekadický režim (D=1): ' + h2(pA).slice(1) + (sub ? ' − ' : ' + ') + h2(m).slice(1) + (sub ? ' − ' + (1 - C0) : ' + ' + C0) + ' počítáno jako dvě desítkové číslice (BCD) → A = ' + c(h2(po.A)) +
            ', C=' + f(po.P, 'C') + (sub ? (f(po.P, 'C') ? ' (bez výpůjčky)' : ' (výpůjčka)') : (f(po.P, 'C') ? ' (přenos do stovek)' : '')) + '. Příznaky N, V, Z jsou na NMOS 6502 v BCD nespolehlivé.');
        } else if (!sub) {
          const s = pA + m + C0;
          radky.push('Bez znaménka: ' + pA + ' + ' + m + ' + C(' + C0 + ') = ' + s + (s > 255 ? ' > 255 → do A jde ' + (s & 255) + ' a <b>C=1</b> (přenos)' : ' ≤ 255 → <b>C=0</b>') + '.');
          const ss = sgn(pA) + sgn(m) + C0;
          radky.push('Se znaménkem: ' + sgnT(pA) + ' + ' + sgnT(m) + ' + ' + C0 + ' = ' + (ss >= 0 ? '+' : '−') + Math.abs(ss) + (ss > 127 || ss < -128 ? ' – mimo rozsah −128…+127 → <b>V=1</b> (přetečení)' : ' – v rozsahu −128…+127 → <b>V=0</b>') + '.');
        } else {
          const s = pA - m - (1 - C0);
          radky.push('Bez znaménka: ' + pA + ' − ' + m + ' − (1 − C=' + C0 + ') = ' + cis(s) + (s < 0 ? ' < 0 → výpůjčka, <b>C=0</b>, do A jde ' + (s & 255) : ' ≥ 0 → bez výpůjčky, <b>C=1</b>') + '.');
          const ss = sgn(pA) - sgn(m) - (1 - C0);
          radky.push('Se znaménkem: ' + sgnT(pA) + ' − ' + sgnT(m) + ' − ' + (1 - C0) + ' = ' + (ss >= 0 ? '+' : '−') + Math.abs(ss) + (ss > 127 || ss < -128 ? ' – mimo rozsah → <b>V=1</b>' : ' – v rozsahu → <b>V=0</b>') + '.');
        }
        if (!f(pP, 'D')) radky.push(...nzText(po.A));
        break;
      }
      case 'CMP': case 'CPX': case 'CPY': case 'DCP': {
        const r = d.m === 'CPX' ? pr.X : d.m === 'CPY' ? pr.Y : pA, jm = d.m === 'CPX' ? 'X' : d.m === 'CPY' ? 'Y' : 'A';
        const mm = d.m === 'DCP' ? (m - 1) & 0xFF : m;
        radky.push(jm + ' (' + h2(r) + ' = ' + r + ') ' + (r > mm ? '>' : r === mm ? '=' : '<') + ' M (' + h2(mm) + ' = ' + mm + ') → ' +
          '<b>C=' + (r >= mm ? 1 : 0) + '</b>' + (r >= mm ? ' (větší nebo rovno)' : ' (menší)') + ', <b>Z=' + (r === mm ? 1 : 0) + '</b>' + (r === mm ? ' (rovnají se)' : '') +
          ', N=' + (((r - mm) & 0x80) ? 1 : 0) + ' (bit 7 rozdílu ' + h2(r - mm) + ').');
        break;
      }
      case 'BIT':
        radky.push('A ∧ M = ' + h2(pA) + ' ∧ ' + h2(m) + ' = ' + h2(pA & m) + ' → <b>Z=' + ((pA & m) === 0 ? 1 : 0) + '</b>; N = bit 7 operandu = ' + ((m >> 7) & 1) + ', V = bit 6 operandu = ' + ((m >> 6) & 1) + '. A se nemění.');
        break;
      case 'AND': case 'ORA': case 'EOR': {
        const zn = { AND: '∧', ORA: '∨', EOR: '⊕' }[d.m];
        radky.push(b8(pA) + ' ' + zn + ' ' + b8(m) + ' = ' + b8(po.A) + ' → A = ' + c(h2(po.A)) + '.');
        radky.push(...nzText(po.A));
        break;
      }
      case 'ASL': case 'LSR': case 'ROL': case 'ROR': {
        const v0 = d.mode === 'acc' ? pA : m;
        const v1 = d.mode === 'acc' ? po.A : (zapisyInstr.length ? zapisyInstr[zapisyInstr.length - 1].nw : 0);
        const vlevo = d.m === 'ASL' || d.m === 'ROL';
        const vysunuty = vlevo ? (v0 >> 7) & 1 : v0 & 1;
        const vstup = (d.m === 'ROL' || d.m === 'ROR') ? 'staré C=' + C0 : '0';
        radky.push(b8(v0) + (vlevo ? ' ≪ 1' : ' ≫ 1') + ' = ' + b8(v1) + ' – vysunutý bit ' + (vlevo ? 7 : 0) + ' (' + vysunuty + ') jde do <b>C=' + vysunuty + '</b>, ' +
          (vlevo ? 'do bitu 0' : 'do bitu 7') + ' vstoupil ' + vstup + '.');
        radky.push(...nzText(v1));
        break;
      }
      case 'INC': case 'DEC': {
        const v1 = zapisyInstr.length ? zapisyInstr[zapisyInstr.length - 1].nw : 0;
        radky.push(h2(m) + (d.m === 'INC' ? ' + 1' : ' − 1') + ' = ' + h2(v1) + (d.m === 'INC' && m === 0xFF ? ' (přetečení na nulu, C se nemění)' : d.m === 'DEC' && m === 0 ? ' (podtečení na $FF, C se nemění)' : '') + '.');
        radky.push(...nzText(v1));
        break;
      }
      case 'INX': case 'INY': case 'DEX': case 'DEY': {
        const r = d.m[2], v0 = pr[r], v1 = po[r];
        radky.push(r + ': ' + h2(v0) + ' → ' + h2(v1) + '.');
        radky.push(...nzText(v1));
        break;
      }
      case 'LDA': case 'LDX': case 'LDY': case 'LAX': case 'PLA': case 'TAX': case 'TAY': case 'TXA': case 'TYA': case 'TSX': {
        const r = { LDA: 'A', LDX: 'X', LDY: 'Y', LAX: 'A', PLA: 'A', TAX: 'X', TAY: 'Y', TXA: 'A', TYA: 'A', TSX: 'X' }[d.m];
        if (d.m === 'PLA') radky.push('SP se zvýšil na ' + h2(po.SP) + ' a z ' + h4(0x100 + po.SP) + ' se přečetlo ' + h2(po.A) + '.');
        radky.push(...nzText(po[r]));
        break;
      }
      case 'BCC': case 'BCS': case 'BEQ': case 'BNE': case 'BMI': case 'BPL': case 'BVC': case 'BVS': {
        const [p, chci] = VETEV_PRIZ[d.m], ma = f(pP, p);
        if (ma === chci) {
          const pres = ((info.pc + 2) ^ ea) & 0xFF00;
          radky.push('Podmínka ' + p + '=' + chci + ' <b>platí</b> (' + p + '=' + ma + ') → skok na ' + c(h4(ea)) + ' (+1 cyklus' + (pres ? ', +1 za přechod na jinou stránku' : '') + ').');
        } else radky.push('Podmínka ' + p + '=' + chci + ' <b>neplatí</b> (' + p + '=' + ma + ') → pokračuje se další instrukcí na ' + h4(info.pc + 2) + '.');
        break;
      }
      case 'JSR':
        radky.push('Návratová adresa − 1 = ' + h4(info.pc + 2) + ' uložena do zásobníku (nejdřív vyšší bajt), SP ' + h2(pr.SP) + ' → ' + h2(po.SP) + '. Skok na ' + c(h4(po.PC)) + '.');
        break;
      case 'RTS':
        radky.push('Ze zásobníku vyzvednuto ' + h4((po.PC - 1) & 0xFFFF) + ', + 1 → pokračuje na ' + c(h4(po.PC)) + '. SP ' + h2(pr.SP) + ' → ' + h2(po.SP) + '.');
        break;
      case 'RTI':
        radky.push('Ze zásobníku obnoveny příznaky (' + b8(po.P) + ') a PC = ' + c(h4(po.PC)) + ' (bez přičtení 1).');
        break;
      case 'BRK':
        radky.push('Do zásobníku uloženo PC+2 = ' + h4(info.pc + 2) + ' a příznaky s B=1; I=1; skok přes vektor $FFFE na ' + c(h4(po.PC)) + '.');
        break;
      case 'JMP':
        radky.push('PC ← ' + c(h4(po.PC)) + '.' + (po.PC === info.pc ? ' Instrukce skáče sama na sebe – nekonečná smyčka (program čeká, nebo skončil).' : ''));
        break;
      case 'PHA': case 'PHP':
        radky.push('Uloženo na ' + h4(0x100 + pr.SP) + ', SP ' + h2(pr.SP) + ' → ' + h2(po.SP) + '.');
        break;
      case 'PLP':
        radky.push('Příznaky obnoveny ze zásobníku: ' + b8(po.P) + ' (bit B se do registru nepřenáší).');
        break;
      case 'TXS':
        radky.push('SP ← X = ' + h2(po.SP) + '. Zásobník teď začíná na ' + h4(0x100 + po.SP) + '.');
        break;
      case 'STA': case 'STX': case 'STY': case 'SAX':
        if (ea >= 0x0200 && ea <= 0x05FF) radky.push('Adresa leží v obrazovce: pixel x=' + ((ea - 0x200) & 31) + ', y=' + ((ea - 0x200) >> 5) + ', barva ' + (zapisyInstr.length ? zapisyInstr[0].nw & 15 : 0) + '.');
        if (ea === 0xF001) {
          const z = zapisyInstr.length ? zapisyInstr[0].nw : 32;
          if (z >= 0x80) radky.push('Adresa $F001 je konzole – bajt ' + h2(z) + ' je část vícebajtového znaku v UTF-8 (' + (z >= 0xC0 ? 'první bajt sekvence' : 'pokračovací bajt') + '); znak se vypíše po posledním bajtu.');
          else if (z < 32) radky.push('Adresa $F001 je konzole – řídicí znak ' + z + (z === 10 ? ' (nový řádek)' : z === 12 ? ' (smazání)' : z === 8 ? ' (backspace)' : '') + '.');
          else radky.push('Adresa $F001 je konzole – vypíše se znak ' + c(String.fromCharCode(z).replace(/[<>&]/g, '?')) + '.');
        }
        break;
    }
    // změny registrů
    const zmeny = [];
    ['A', 'X', 'Y', 'SP'].forEach(r => { if (pr[r] !== po[r]) zmeny.push(r + ': ' + h2(pr[r]) + ' → ' + h2(po[r])); });
    if (zmeny.length) radky.push('Registry: ' + zmeny.join(', ') + '.');
    const zmP = [];
    'NVDIZC'.split('').forEach(n => { if (f(pr.P, n) !== f(po.P, n)) zmP.push(n + ' ' + f(pr.P, n) + '→' + f(po.P, n)); });
    radky.push('Příznaky: ' + (zmP.length ? zmP.join(', ') : 'beze změny') + (I.f ? ' (instrukce ovlivňuje ' + I.f.split('').join(', ') + ')' : ' (instrukce příznaky nemění)') + '.');
    // cykly
    const zakl = d.cyc;
    const navic = [];
    if (info.cross && d.px) navic.push('+1 přechod stránky');
    if (info.taken) navic.push('+1 skok' + ((((info.pc + 2) ^ ea) & 0xFF00) ? ', +1 jiná stránka' : ''));
    if (info.prerus) navic.push('+7 přerušení');
    radky.push('Cykly: ' + info.cykly + (navic.length ? ' (základ ' + zakl + ', ' + navic.join(', ') + ')' : '') + '.');
    out.push(...radky);
    return out;
  }

  /** Tabulka pro příručku: mnemonika → [{režim, opkód, bajty, cykly, px}] */
  function prehled(illegal) {
    const mapa = {};
    OPS.forEach(o => {
      if (o.ill && !illegal) return;
      if (!o.ill && illegal === 'jen') return;
      (mapa[o.m] || (mapa[o.m] = [])).push(o);
    });
    return mapa;
  }

  const VYUKA = { INSTR, SKUPINY, REZIM_TEXT, vysvetli, prehled };
  if (typeof module !== 'undefined' && module.exports) module.exports = VYUKA;
  else root.CPU8VYUKA = VYUKA;
})(typeof self !== 'undefined' ? self : this);
