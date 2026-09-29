/* ============================================================
   prepis.js – přepis českého textu do jiných písem.

   Samotná změna fontu stačí, jen když font kreslí latinku jinými
   tvary. Tengwar, runy, hlaholice nebo ogam ale mají vlastní znaky
   v Unicode a latinkou napsaný text by v takovém fontu zůstal
   latinkou. Proto se text nejdřív přepíše a teprve výsledek se
   vysází příslušným fontem (klíč `font` = doporučený font z fonty.js).

     PREPIS.SEZNAM            – [{id, nazev, font, popis}]
     PREPIS.preved(id, text, volby) → přepsaný text
   ============================================================ */
const PREPIS = (function () {

  const bezDiakritiky = s => s.normalize('NFD').replace(/[\u0300-\u036F]/g, '');

  // Obecný převod podle tabulky – nejdelší shoda vyhrává (ch před c).
  function podleTabulky(text, tab, volby) {
    const klice = Object.keys(tab).sort((a, b) => b.length - a.length);
    let out = '';
    for (let i = 0; i < text.length;) {
      const zbytek = text.slice(i);
      const mala = zbytek.toLowerCase();
      let hit = null;
      for (const k of klice) if (mala.startsWith(k)) { hit = k; break; }
      if (!hit) { out += text[i]; i++; continue; }
      let v = tab[hit];
      if (volby && volby.velka && zbytek[0] !== mala[0] && typeof volby.velka === 'function') v = volby.velka(v);
      out += v;
      i += hit.length;
    }
    return out;
  }

  /* ---------- Tengwar (obecný mód pro češtinu) ----------
     Kódování Free Tengwar / CSUR (U+E000–E07F), které používá font
     Alcarin Tengwar. Samohlásky jsou tehtar (znaménka nad souhláskou):
     ve výchozím „quenijském“ způsobu nad předchozí souhláskou, ve
     „sindarském“ nad následující. Bez vhodné souhlásky se píší na
     krátký nosič, dlouhé samohlásky na dlouhý nosič.                 */
  const T = {
    tinco: '\uE000', parma: '\uE001', calma: '\uE002', quesse: '\uE003',
    ando: '\uE004', umbar: '\uE005', anga: '\uE006', ungwe: '\uE007',
    formen: '\uE009', harma: '\uE00A', hwesta: '\uE00B',
    ampa: '\uE00D', anca: '\uE00E',
    numen: '\uE010', malta: '\uE011', noldo: '\uE012',
    ore: '\uE014', vala: '\uE015', anna: '\uE016',
    romen: '\uE020', arda: '\uE021', lambe: '\uE022',
    silme: '\uE024', silmeNuq: '\uE025', esse: '\uE026', esseNuq: '\uE027',
    hyarmen: '\uE028', dlouhyNosic: '\uE02C', kratkyNosic: '\uE02E',
    // znaménka
    tecky3: '\uE040', dveTeckyDole: '\uE043', tecka: '\uE044', carka: '\uE046',
    pravyOblouk: '\uE04A', levyOblouk: '\uE04C', zdvojeni: '\uE051',
    pusta: '\uE060', pusta2: '\uE061', vykricnik: '\uE065', otaznik: '\uE066',
  };
  const T_SAMOHLASKY = {
    a: [T.tecky3, false], 'á': [T.tecky3, true],
    e: [T.carka, false], 'é': [T.carka, true],
    i: [T.tecka, false], 'í': [T.tecka, true], y: [T.tecka, false], 'ý': [T.tecka, true],
    o: [T.pravyOblouk, false], 'ó': [T.pravyOblouk, true],
    u: [T.levyOblouk, false], 'ú': [T.levyOblouk, true], 'ů': [T.levyOblouk, true],
  };
  // souhláska → posloupnost tengwar; poslední znak nese případnou tehtu
  const T_SOUHLASKY = {
    'dž': [T.anga], ch: [T.hwesta], dz: [T.ando, T.esse],
    t: [T.tinco], p: [T.parma], 'č': [T.calma], k: [T.quesse],
    d: [T.ando], b: [T.umbar], g: [T.ungwe],
    f: [T.formen], 'š': [T.harma], v: [T.ampa], w: [T.vala], 'ž': [T.anca],
    n: [T.numen], m: [T.malta], r: [T.romen], 'ř': [T.arda], l: [T.lambe],
    s: [T.silme], z: [T.esse], h: [T.hyarmen], j: [T.anna],
    c: [T.tinco, T.silme], x: [T.quesse, T.silme], q: [T.quesse, T.vala],
    'ť': [T.tinco, T.dveTeckyDole], 'ď': [T.ando, T.dveTeckyDole], 'ň': [T.numen, T.dveTeckyDole],
  };
  const T_INTERPUNKCE = { '.': T.pusta2, ',': T.pusta, ';': T.pusta, ':': T.pusta2, '!': T.vykricnik, '?': T.otaznik };

  function tengwar(text, volby) {
    const nasledujici = volby && volby.tehta === 'nasledujici';
    const cislice = !(volby && volby.cislice === 'arabske');
    const s = text.normalize('NFC').toLowerCase();

    // 1) rozklad na jednotky
    const J = [];
    for (let i = 0; i < s.length;) {
      const dva = s.slice(i, i + 2);
      const ch = s[i];
      if (T_SOUHLASKY[dva]) { J.push({ t: 'c', k: dva, z: T_SOUHLASKY[dva].slice() }); i += 2; continue; }
      if (ch === 'ě') {
        // dě tě ně → ďe ťe ňe, mě → mňe, jinak (bě, pě, vě) → bje…
        const pred = J[J.length - 1];
        if (pred && pred.t === 'c' && ['d', 't', 'n'].includes(pred.k)) pred.z.push(T.dveTeckyDole);
        else if (pred && pred.t === 'c' && pred.k === 'm') J.push({ t: 'c', k: 'ň', z: T_SOUHLASKY['ň'].slice() });
        else J.push({ t: 'c', k: 'j', z: [T.anna] });
        J.push({ t: 'v', tehta: T.carka, dlouha: false });
        i++; continue;
      }
      if (T_SOUHLASKY[ch]) { J.push({ t: 'c', k: ch, z: T_SOUHLASKY[ch].slice() }); i++; continue; }
      if (T_SAMOHLASKY[ch]) { const [tehta, dlouha] = T_SAMOHLASKY[ch]; J.push({ t: 'v', tehta, dlouha }); i++; continue; }
      if (cislice && ch >= '0' && ch <= '9') { J.push({ t: 'o', z: String.fromCharCode(0xE070 + (ch.charCodeAt(0) - 48)) }); i++; continue; }
      if (T_INTERPUNKCE[ch]) { J.push({ t: 'o', z: T_INTERPUNKCE[ch] }); i++; continue; }
      J.push({ t: 'o', z: ch }); i++;
    }

    // 2) r před samohláskou = rómen, jinak óre; zdvojená souhláska = čárka pod
    for (let i = 0; i < J.length; i++) {
      const u = J[i];
      if (u.t !== 'c') continue;
      if (u.k === 'r') {
        const dalsi = J[i + 1];
        if (!dalsi || dalsi.t !== 'v') u.z = [T.ore];
      }
      const dalsi = J[i + 1];
      if (dalsi && dalsi.t === 'c' && dalsi.k === u.k && u.z.length === 1) {
        u.z.push(T.zdvojeni);
        J.splice(i + 1, 1);
      }
    }

    // 3) umístění samohlásek
    let out = '';
    const vypis = [];
    for (let i = 0; i < J.length; i++) {
      const u = J[i];
      if (u.t === 'v') {
        if (!u.dlouha) {
          const cil = nasledujici ? J[i + 1] : J[i - 1];
          if (cil && cil.t === 'c' && !cil.tehta) { cil.tehta = u.tehta; continue; }
        }
        vypis.push({ t: 'n', z: (u.dlouha ? T.dlouhyNosic : T.kratkyNosic) + u.tehta });
        continue;
      }
      vypis.push(u);
    }
    for (const u of vypis) {
      if (u.t === 'c') {
        const z = u.z.slice();
        if (u.tehta) {
          // silme a esse s tehtou nad sebou se píšou obrácené (nuquerna)
          const i = z.length - 1;
          if (z[i] === T.silme) z[i] = T.silmeNuq;
          if (z[i] === T.esse) z[i] = T.esseNuq;
          z.push(u.tehta);
        }
        out += z.join('');
      } else out += u.z;
    }
    return out;
  }

  /* ---------- Runy (starší futhark) ---------- */
  const RUNY = {
    th: 'ᚦ', ng: 'ᛜ', ch: 'ᚺ',
    a: 'ᚨ', b: 'ᛒ', c: 'ᚲ', d: 'ᛞ', e: 'ᛖ', f: 'ᚠ', g: 'ᚷ', h: 'ᚺ', i: 'ᛁ', j: 'ᛃ',
    k: 'ᚲ', l: 'ᛚ', m: 'ᛗ', n: 'ᚾ', o: 'ᛟ', p: 'ᛈ', q: 'ᚲ', r: 'ᚱ', s: 'ᛊ', t: 'ᛏ',
    u: 'ᚢ', v: 'ᚹ', w: 'ᚹ', x: 'ᚲᛊ', y: 'ᛁ', z: 'ᛉ',
  };
  function runy(text, volby) {
    let s = bezDiakritiky(text.normalize('NFC').replace(/ch/gi, 'h'));
    s = podleTabulky(s, RUNY);
    if (volby && volby.oddelovac) s = s.replace(/ +/g, '᛫');
    return s;
  }

  /* ---------- Hlaholice (staroslověnské písmo Velké Moravy) ---------- */
  const HLAHOLICE = {
    ch: 'ⱈ', 'dž': 'ⰴⰶ', dz: 'ⰷ',
    a: 'ⰰ', 'á': 'ⰰ', b: 'ⰱ', v: 'ⰲ', w: 'ⰲ', g: 'ⰳ', h: 'ⰳ', d: 'ⰴ', 'ď': 'ⰴ', e: 'ⰵ', 'é': 'ⰵ', 'ě': 'ⱑ',
    'ž': 'ⰶ', z: 'ⰸ', i: 'ⰹ', 'í': 'ⰹ', j: 'ⰻ', k: 'ⰽ', q: 'ⰽ', l: 'ⰾ', m: 'ⰿ', n: 'ⱀ', 'ň': 'ⱀ',
    o: 'ⱁ', 'ó': 'ⱁ', p: 'ⱂ', r: 'ⱃ', 'ř': 'ⱃ', s: 'ⱄ', t: 'ⱅ', 'ť': 'ⱅ',
    u: 'ⱆ', 'ú': 'ⱆ', 'ů': 'ⱆ', f: 'ⱇ', c: 'ⱌ', 'č': 'ⱍ', 'š': 'ⱎ',
    y: 'ⱏⰺ', 'ý': 'ⱏⰺ', x: 'ⰽⱄ',
  };
  function hlaholice(text) {
    // malá písmena hlaholice jsou U+2C30–2C5F, velká o 0x30 níž
    return podleTabulky(text.normalize('NFC'), HLAHOLICE, {
      velka: v => v.replace(/[\u2C30-\u2C5F]/, c => String.fromCharCode(c.charCodeAt(0) - 0x30)),
    });
  }

  /* ---------- Azbuka ---------- */
  const AZBUKA = {
    ch: 'х', ja: 'я', je: 'е', ju: 'ю', jo: 'ё',
    a: 'а', 'á': 'а', b: 'б', c: 'ц', 'č': 'ч', d: 'д', 'ď': 'дь', e: 'э', 'é': 'э', 'ě': 'е',
    f: 'ф', g: 'г', h: 'г', i: 'и', 'í': 'и', j: 'й', k: 'к', l: 'л', m: 'м', n: 'н', 'ň': 'нь',
    o: 'о', 'ó': 'о', p: 'п', q: 'к', r: 'р', 'ř': 'рж', s: 'с', 'š': 'ш', t: 'т', 'ť': 'ть',
    u: 'у', 'ú': 'у', 'ů': 'у', v: 'в', w: 'в', x: 'кс', y: 'ы', 'ý': 'ы', z: 'з', 'ž': 'ж',
  };
  function azbuka(text) {
    return podleTabulky(text.normalize('NFC'), AZBUKA, { velka: v => v.charAt(0).toUpperCase() + v.slice(1) });
  }

  /* ---------- Alfabeta ---------- */
  const ALFABETA = {
    ch: 'χ', th: 'θ', ps: 'ψ', ks: 'ξ', ou: 'ου',
    a: 'α', 'á': 'α', b: 'β', c: 'τσ', 'č': 'τσ', d: 'δ', 'ď': 'δ', e: 'ε', 'é': 'η', 'ě': 'ιε',
    f: 'φ', g: 'γ', h: 'χ', i: 'ι', 'í': 'ι', j: 'ι', k: 'κ', l: 'λ', m: 'μ', n: 'ν', 'ň': 'ν',
    o: 'ο', 'ó': 'ω', p: 'π', q: 'κ', r: 'ρ', 'ř': 'ρζ', s: 'σ', 'š': 'σ', t: 'τ', 'ť': 'τ',
    u: 'ου', 'ú': 'ου', 'ů': 'ου', v: 'β', w: 'β', x: 'ξ', y: 'υ', 'ý': 'υ', z: 'ζ', 'ž': 'ζ',
  };
  function alfabeta(text) {
    const s = podleTabulky(text.normalize('NFC'), ALFABETA, { velka: v => v.charAt(0).toUpperCase() + v.slice(1) });
    return s.replace(/σ(?![\p{L}])/gu, 'ς');
  }

  /* ---------- Ogam ---------- */
  const OGAM = {
    ng: 'ᚍ', ch: 'ᚆ',
    a: 'ᚐ', b: 'ᚁ', c: 'ᚉ', d: 'ᚇ', e: 'ᚓ', f: 'ᚃ', g: 'ᚌ', h: 'ᚆ', i: 'ᚔ', j: 'ᚔ', k: 'ᚉ',
    l: 'ᚂ', m: 'ᚋ', n: 'ᚅ', o: 'ᚑ', p: 'ᚚ', q: 'ᚊ', r: 'ᚏ', s: 'ᚄ', t: 'ᚈ', u: 'ᚒ',
    v: 'ᚃ', w: 'ᚃ', x: 'ᚉᚄ', y: 'ᚔ', z: 'ᚎ',
  };
  function ogam(text) {
    // ogam se píše v souvislé lince; slova dělí mezera ogamu (U+1680)
    // a řádek začíná ᚛ a končí ᚜
    return text.split('\n').map(r => {
      if (!r.trim()) return r;
      return '᚛' + podleTabulky(bezDiakritiky(r), OGAM).replace(/ /g, ' ') + '᚜';
    }).join('\n');
  }

  /* ---------- Morseovka ---------- */
  const MORSE = {
    ch: '----', a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....',
    i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-',
    r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..',
    0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...',
    8: '---..', 9: '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..', '!': '-.-.--', '-': '-....-',
  };
  function morse(text) {
    return text.split('\n').map(r => {
      const s = bezDiakritiky(r.toLowerCase());
      const slova = s.split(/\s+/).filter(Boolean).map(sl => {
        const znaky = [];
        for (let i = 0; i < sl.length;) {
          if (sl.startsWith('ch', i)) { znaky.push(MORSE.ch); i += 2; continue; }
          znaky.push(MORSE[sl[i]] || sl[i]); i++;
        }
        return znaky.join(' ');
      });
      return slova.join(' / ');
    }).join('\n');
  }

  /* ---------- Braillovo písmo (česká tabulka) ----------
     Velké písmeno ohlašuje znak ⠨ (body 4-6), číslo znak ⠼ a pak
     písmena a–j. Spřežka ch se píše jako c + h.                       */
  const BRAILLE = {
    a: '⠁', b: '⠃', c: '⠉', d: '⠙', e: '⠑', f: '⠋', g: '⠛', h: '⠓', i: '⠊', j: '⠚',
    k: '⠅', l: '⠇', m: '⠍', n: '⠝', o: '⠕', p: '⠏', q: '⠟', r: '⠗', s: '⠎', t: '⠞',
    u: '⠥', v: '⠧', w: '⠺', x: '⠭', y: '⠽', z: '⠵',
    'á': '⠡', 'č': '⠩', 'ď': '⠹', 'é': '⠜', 'ě': '⠣', 'í': '⠌', 'ň': '⠫', 'ó': '⠪',
    'ř': '⠻', 'š': '⠱', 'ť': '⠳', 'ú': '⠬', 'ů': '⠾', 'ý': '⠯', 'ž': '⠮',
    '.': '⠲', ',': '⠂', '?': '⠢', '!': '⠖', '-': '⠤', ':': '⠒', ';': '⠆',
  };
  const BRAILLE_CISLA = '⠚⠁⠃⠉⠙⠑⠋⠛⠓⠊';   // 0–9 = j, a–i
  function braille(text) {
    let out = '', vCisle = false;
    for (const ch of text.normalize('NFC')) {
      if (ch >= '0' && ch <= '9') {
        if (!vCisle) { out += '⠼'; vCisle = true; }
        out += BRAILLE_CISLA[ch.charCodeAt(0) - 48];
        continue;
      }
      if (ch === ',' && vCisle) { out += '⠂'; continue; }
      vCisle = false;
      const m = ch.toLowerCase();
      if (BRAILLE[m]) out += (m !== ch ? '⠨' : '') + BRAILLE[m];
      else out += ch === ' ' ? ' ' : ch;
    }
    return out;
  }

  /* ---------- Egyptské hieroglyfy (jednosouhláskové znaky) ----------
     Tak se v muzeích „píšou jména hieroglyfy“: každé hlásce odpovídá
     znak jednosouhláskové abecedy (Gardinerova čísla v komentáři).   */
  const HIEROGLYFY = {
    ch: '𓐍',                                          // Aa1 placenta
    a: '𓄿', 'á': '𓄿',                                // G1 sup
    b: '𓃀',                                          // D58 noha
    c: '𓍿', 'č': '𓍿',                                // V13 provaz (tj)
    d: '𓂧', 'ď': '𓂧',                                // D46 ruka
    e: '𓇋', 'é': '𓇋', 'ě': '𓇋', i: '𓇋', 'í': '𓇋', // M17 rákos
    y: '𓇌', 'ý': '𓇌', j: '𓇌',                        // M17A dva rákosy
    f: '𓆑', v: '𓆑',                                  // I9 zmije
    g: '𓎼',                                          // W11 stojan na džbán
    h: '𓉔',                                          // O4 přístřešek
    k: '𓎡', q: '𓈎',                                  // V31 košík, N29 kopec
    l: '𓃭',                                          // E23 lev
    m: '𓅓',                                          // G17 sova
    n: '𓈖', 'ň': '𓈖',                                // N35 voda
    o: '𓍯', 'ó': '𓍯',                                // V4 laso
    p: '𓊪',                                          // Q3 stolička
    r: '𓂋', 'ř': '𓂋',                                // D21 ústa
    s: '𓋴', 'š': '𓈙',                                // S29 látka, N37 jezero
    t: '𓏏', 'ť': '𓏏',                                // X1 bochník
    u: '𓅱', 'ú': '𓅱', 'ů': '𓅱', w: '𓅱',              // G43 kuře
    x: '𓎡𓋴', z: '𓊃', 'ž': '𓆓',                      // O34 závora, I10 kobra
  };
  const hieroglyfy = text => podleTabulky(text.normalize('NFC'), HIEROGLYFY);

  /* ---------- Fénické písmo (píše se zprava doleva) ---------- */
  const FENICKE = {
    ch: '𐤇', a: '𐤀', b: '𐤁', c: '𐤑', 'č': '𐤑', d: '𐤃', e: '𐤄', f: '𐤐', g: '𐤂', h: '𐤄',
    i: '𐤉', j: '𐤉', k: '𐤊', l: '𐤋', m: '𐤌', n: '𐤍', o: '𐤏', p: '𐤐', q: '𐤒', r: '𐤓',
    s: '𐤎', 'š': '𐤔', t: '𐤕', u: '𐤅', v: '𐤅', w: '𐤅', x: '𐤊𐤎', y: '𐤉', z: '𐤆', 'ž': '𐤆',
  };
  const fenicke = text => podleTabulky(bezDiakritikyKrome(text, 'čšž'), FENICKE);

  /* ---------- Etruské písmo (staroitalské) ---------- */
  const ETRUSKE = {
    ch: '𐌙', th: '𐌈', a: '𐌀', b: '𐌁', c: '𐌂', d: '𐌃', e: '𐌄', f: '𐌚', g: '𐌂', h: '𐌇',
    i: '𐌉', j: '𐌉', k: '𐌊', l: '𐌋', m: '𐌌', n: '𐌍', o: '𐌏', p: '𐌐', q: '𐌒', r: '𐌓',
    s: '𐌔', 'š': '𐌑', t: '𐌕', u: '𐌖', v: '𐌅', w: '𐌅', x: '𐌗', y: '𐌉', z: '𐌆',
  };
  const etruske = text => podleTabulky(bezDiakritikyKrome(text, 'š'), ETRUSKE);

  /* ---------- Gótské písmo (Wulfilova bible) ---------- */
  const GOTICKE = {
    ch: '𐍇', th: '𐌸', hw: '𐍈', a: '𐌰', b: '𐌱', c: '𐌺', d: '𐌳', e: '𐌴', f: '𐍆', g: '𐌲',
    h: '𐌷', i: '𐌹', j: '𐌾', k: '𐌺', l: '𐌻', m: '𐌼', n: '𐌽', o: '𐍉', p: '𐍀', q: '𐌵',
    r: '𐍂', s: '𐍃', t: '𐍄', u: '𐌿', v: '𐍅', w: '𐍅', x: '𐌺𐍃', y: '𐌹', z: '𐌶',
  };
  const goticke = text => podleTabulky(bezDiakritiky(text.normalize('NFC')), GOTICKE);

  // odstraní diakritiku kromě vyjmenovaných písmen (č, š, ž mají ve
  // starých písmech vlastní znaky)
  function bezDiakritikyKrome(text, krome) {
    return [...text.normalize('NFC')].map(ch => krome.includes(ch.toLowerCase()) ? ch : bezDiakritiky(ch)).join('');
  }

  const SEZNAM = [
    { id: 'zadny',     nazev: 'Beze změny (jen jiný font)', font: null },
    { id: 'tengwar',   nazev: 'Tengwar – elfí písmo',       font: 'tengwar',
      popis: 'Foneticky: samohlásky jako znaménka (tehtar) nad souhláskami, jako v Pánu prstenů.' },
    { id: 'runy',      nazev: 'Runy (starší futhark)',      font: 'runy',
      popis: 'Diakritika se odstraní, ch = h, th = ᚦ.' },
    { id: 'hlaholice', nazev: 'Hlaholice',                  font: 'hlaholice',
      popis: 'Písmo Cyrila a Metoděje z Velké Moravy.' },
    { id: 'azbuka',    nazev: 'Azbuka (cyrilice)',          font: 'libserif' },
    { id: 'alfabeta',  nazev: 'Alfabeta (řecké písmo)',     font: 'libserif' },
    { id: 'ogam',      nazev: 'Ogam (keltské písmo)',       font: 'ogam' },
    { id: 'braille',   nazev: 'Braillovo písmo',            font: 'braille',
      popis: 'Česká tabulka: ⠨ ohlašuje velké písmeno, ⠼ číslo. Pro hmatové cedulky platí normové rozměry bodů (průměr 1,5 mm, rozteč 2,5 mm) – v 3D textu nastavte výšku tak, aby jim odpovídaly.' },
    { id: 'hieroglyfy',nazev: 'Egyptské hieroglyfy',        font: 'hieroglyfy',
      popis: 'Jednosouhlásková „abeceda“, jak se v muzeích píšou jména. Samohlásky Egypťané nepsali – tady mají zástupné znaky.' },
    { id: 'fenicke',   nazev: 'Fénické písmo',              font: 'fenicke', rtl: true,
      popis: 'Předek řecké i latinské abecedy. Píše se zprava doleva a samohlásky původně neznalo.' },
    { id: 'etruske',   nazev: 'Etruské písmo',              font: 'etruske' },
    { id: 'goticke',   nazev: 'Gótské písmo',               font: 'goticke',
      popis: 'Písmo Wulfilovy bible (4. století).' },
    { id: 'morse',     nazev: 'Morseovka',                  font: 'libsans' },
  ];
  // přepisy, které mají vlastní znaky (a tedy i vlastní font)
  for (const p of SEZNAM) p.vlastniPismo = ['tengwar', 'runy', 'hlaholice', 'ogam', 'braille', 'hieroglyfy', 'fenicke', 'etruske', 'goticke'].includes(p.id);
  const FUNKCE = { tengwar, runy, hlaholice, azbuka, alfabeta, ogam, morse, braille, hieroglyfy, fenicke, etruske, goticke };

  function preved(id, text, volby) {
    const f = FUNKCE[id];
    return f ? f(text, volby || {}) : text;
  }

  return { SEZNAM, preved };
})();
