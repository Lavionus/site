/* ============================================================
   cpu8/periferie.js – zařízení mapovaná do paměti (konvence easy6502 + rozšíření)
     $0200–$05FF  displej 32×32 px, 1 bajt = 1 pixel, dolní 4 bity = barva z palety
     $00FE        čtení: náhodné číslo 0–255 (při každém čtení nové)
     $00FF        poslední stisknutá klávesa (ASCII; šipky = w a s d; znaky mimo ASCII jako bajty UTF-8) – zapisuje UI
     $F000        zápis: smaže konzoli
     $F001        zápis: vypíše znak (ASCII nebo UTF-8; 10 = nový řádek, 8 = backspace, 12 = smazat)
     $F002        zápis: vypíše bajt desítkově (0–255)
     $F003        zápis: vypíše bajt šestnáctkově (2 číslice)
     $F004        čtení: další znak z fronty kláves (0 = fronta prázdná)
     $F010/$F011  perioda časovače v jednotkách 100 cyklů (nižší/vyšší bajt), 0 = 65 536
     $F012        řízení časovače: bit 0 = běží, bit 1 = vyvolávat IRQ
     $F013        čtení: stav (bit 7 = časovač vypršel); čtení stav i požadavek IRQ vynuluje
   ============================================================ */
(function (root) {
  'use strict';

  const PALETA = ['#000000', '#ffffff', '#880000', '#aaffee', '#cc44cc', '#00cc55', '#0000aa', '#eeee77',
    '#dd8855', '#664400', '#ff7777', '#333333', '#777777', '#aaff66', '#0088ff', '#bbbbbb'];
  const NAZVY_BAREV = ['černá', 'bílá', 'červená', 'tyrkysová', 'fialová', 'zelená', 'modrá', 'žlutá',
    'oranžová', 'hnědá', 'světle červená', 'tmavě šedá', 'šedá', 'světle zelená', 'světle modrá', 'světle šedá'];

  const ADR = {
    DISPLEJ: 0x0200, DISPLEJ_KONEC: 0x05FF, NAHODA: 0xFE, KLAVESA: 0xFF,
    KON_SMAZ: 0xF000, KON_ZNAK: 0xF001, KON_DEC: 0xF002, KON_HEX: 0xF003, KON_VSTUP: 0xF004,
    CAS_LO: 0xF010, CAS_HI: 0xF011, CAS_RIZ: 0xF012, CAS_STAV: 0xF013,
  };
  const IRQ_CASOVAC = 1;   // bit zdroje IRQ v cpu.irqLines

  /** Pseudonáhodný generátor řízený počítadlem – stav je jedno číslo, takže krok zpět je deterministický. */
  function mix32(x) {
    x = Math.imul(x ^ (x >>> 16), 0x85EBCA6B) >>> 0;
    x = Math.imul(x ^ (x >>> 13), 0xC2B2AE35) >>> 0;
    return (x ^ (x >>> 16)) >>> 0;
  }
  function utf8(text) {
    const out = [];
    for (const ch of String(text)) {
      const cp = ch.codePointAt(0);
      if (cp < 0x80) out.push(cp);
      else if (cp < 0x800) out.push(0xC0 | (cp >> 6), 0x80 | (cp & 63));
      else if (cp < 0x10000) out.push(0xE0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      else out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    }
    return out;
  }
  const MAX_TEXT = 20000;

  /**
   * Připojí periferie k procesoru. volby: { konzole(text|{smaz:true}|{zpet:true}) – oznámení o výstupu, seed }
   * Vrací objekt periferií: text (obsah konzole), fronta kláves, stisk(kod), pis(text), reset().
   * Stav (generátor náhody, fronta, časovač, konzole) se ukládá do historie procesoru – krok zpět ho obnoví.
   */
  function pripoj(cpu, volby) {
    volby = volby || {};
    const seed = (volby.seed >>> 0) || ((Math.random() * 0x100000000) >>> 0);
    let citac = 0, verze = 0;
    const zurnal = [];
    const nahoda = () => mix32((seed + Math.imul(citac++, 0x9E3779B9)) >>> 0) & 0xFF;
    const ozn = volby.konzole || (() => {});
    const P = {
      fronta: [], perioda: 0, rizeni: 0, stav: 0, utf: null, utfN: 0, text: '',
      /** Klávesa (bajt): $FF = kód, zároveň do fronty pro $F004. */
      stisk(kod) {
        zmena();
        cpu.mem[ADR.KLAVESA] = kod & 0xFF;
        if (P.fronta.length < 64) P.fronta.push(kod & 0xFF);
      },
      /** Text z klávesnice: znaky mimo ASCII jdou do fronty jako bajty UTF-8, $FF dostane poslední bajt. */
      pis(text) { utf8(text).forEach(b => P.stisk(b)); },
      reset() {
        P.fronta.length = 0; P.perioda = 0; P.rizeni = 0; P.stav = 0; P.utf = null; P.text = '';
        zurnal.length = 0; verze = 0; citac = 0;
        cpu.irq(IRQ_CASOVAC, false); cpu.eventAt = Infinity;
      },
      naplanuj() {
        if (!(P.rizeni & 1)) { cpu.eventAt = Infinity; return; }
        cpu.eventAt = cpu.cycles + (P.perioda || 65536) * 100;
      },
      delkaZurnalu: () => zurnal.length,
    };
    function snimek() {
      return { fronta: P.fronta.slice(), perioda: P.perioda, rizeni: P.rizeni, stav: P.stav, utf: P.utf && P.utf.slice(), utfN: P.utfN, text: P.text };
    }
    function zmena() {
      zurnal.push({ v: verze, st: snimek() });
      verze++;
      if (zurnal.length > 40000) zurnal.splice(0, 20000);
    }
    function vystup(t) {
      zmena();
      if (typeof t === 'string') P.text += t;
      else if (t.smaz) P.text = '';
      else if (t.zpet) P.text = P.text.slice(0, -1);
      if (P.text.length > MAX_TEXT) P.text = P.text.slice(-Math.floor(MAX_TEXT * 0.75));
      ozn(t);
    }
    cpu.ext = {
      uloz1: () => citac,
      uloz2: () => verze,
      obnov(c, v) {
        citac = c;
        while (zurnal.length && zurnal[zurnal.length - 1].v >= v) {
          const st = zurnal.pop().st;
          P.fronta = st.fronta; P.perioda = st.perioda; P.rizeni = st.rizeni; P.stav = st.stav; P.utf = st.utf; P.utfN = st.utfN; P.text = st.text;
        }
        verze = v;
        if (volby.poObnove) volby.poObnove();
      },
    };
    cpu.mapRead(0x00, 0x00, a => a === ADR.NAHODA ? nahoda() : cpu.mem[a]);
    cpu.mapRead(0xF0, 0xF0, a => {
      if (a === ADR.KON_VSTUP) { if (!P.fronta.length) return 0; zmena(); return P.fronta.shift(); }
      if (a === ADR.CAS_STAV) { const v = P.stav; if (v) { zmena(); P.stav = 0; } cpu.irq(IRQ_CASOVAC, false); return v; }
      if (a === ADR.CAS_LO) return P.perioda & 0xFF;
      if (a === ADR.CAS_HI) return P.perioda >> 8;
      if (a === ADR.CAS_RIZ) return P.rizeni;
      return cpu.mem[a];
    });
    cpu.mapWrite(0xF0, 0xF0, (a, v) => {
      cpu.mem[a] = v;
      switch (a) {
        case ADR.KON_SMAZ: vystup({ smaz: true }); break;
        case ADR.KON_ZNAK:
          if (v === 12) vystup({ smaz: true });
          else if (v === 8) vystup({ zpet: true });
          else if (v === 13) vystup('\n');
          else if (v === 10 || v === 9 || (v >= 32 && v < 127)) vystup(String.fromCharCode(v));
          else if (v >= 0x80) {
            // UTF-8: sbírá bajty vícebajtového znaku
            zmena();
            if (v >= 0xC0) { P.utf = [v]; P.utfN = v >= 0xF0 ? 4 : v >= 0xE0 ? 3 : 2; }
            else if (P.utf) {
              P.utf = P.utf.concat([v]);
              if (P.utf.length === P.utfN) {
                const b = P.utf; P.utf = null;
                let cp = b[0] & (P.utfN === 2 ? 0x1F : P.utfN === 3 ? 0x0F : 0x07);
                for (let k = 1; k < b.length; k++) cp = (cp << 6) | (b[k] & 63);
                let ch; try { ch = String.fromCodePoint(cp); } catch (e) { ch = '?'; }
                vystup(ch);
              }
            }
          }
          break;
        case ADR.KON_DEC: vystup(String(v)); break;
        case ADR.KON_HEX: vystup(v.toString(16).toUpperCase().padStart(2, '0')); break;
        case ADR.CAS_LO: zmena(); P.perioda = (P.perioda & 0xFF00) | v; break;
        case ADR.CAS_HI: zmena(); P.perioda = (P.perioda & 0xFF) | (v << 8); break;
        case ADR.CAS_RIZ: zmena(); P.rizeni = v & 3; if (!(v & 2)) cpu.irq(IRQ_CASOVAC, false); P.naplanuj(); break;
      }
    });
    cpu.onEvent = () => {
      if (!(P.rizeni & 1)) { cpu.eventAt = Infinity; return; }
      if (!(P.stav & 0x80)) { zmena(); P.stav |= 0x80; }
      if (P.rizeni & 2) cpu.irq(IRQ_CASOVAC, true);
      const per = (P.perioda || 65536) * 100;
      cpu.eventAt += per;
      if (cpu.eventAt <= cpu.cycles) cpu.eventAt = cpu.cycles + per;
    };
    return P;
  }

  const PER = { pripoj, PALETA, NAZVY_BAREV, ADR, utf8, IO: [ADR.NAHODA, ADR.KLAVESA, 0xF000, 0xF001, 0xF002, 0xF003, 0xF004, 0xF010, 0xF011, 0xF012, 0xF013] };
  if (typeof module !== 'undefined' && module.exports) module.exports = PER;
  else root.CPU8PER = PER;
})(typeof self !== 'undefined' ? self : this);
