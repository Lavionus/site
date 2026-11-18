/* Rozbor výpovědi – jádro (window.ROZBOR v prohlížeči, module.exports v node).
   najdi(text, kontext) → nálezy v českém textu: čas, datum, osoba, místo, SPZ, telefon, částka, účet.
   Každý nález { klic, typ, od, do, text, hodnota, presnost, nejiste?, dvojznacne?, nejistota?, entita?, kandidati? }.
   Kontext: { datum: 'YYYY-MM-DD' (datum záznamu – vůči němu „včera“, „v pátek“), osoby/mista/telefony/vozidla/ucty
   ze spisu ({id, nazev, data}) }. Heuristika – nález je návrh, ne fakt; rozbor nenahrazuje čtení.
   Přenos do spisu (prenes, ulozZnacku, zalozModel) jde jen přes API window.SPIS (smlouva v docs/plany/Spis_PLAN.md). */
(function (koren) {
  'use strict';

  /* ---------- pomůcky ---------- */
  // ploché písmo: bez diakritiky, malá písmena a STEJNÁ délka jako originál (pozice platí pro oba texty)
  const plochy = t => String(t).replace(/[\s\S]/g, c => {
    if (c.charCodeAt(0) < 128) return c.toLowerCase();
    const d = c.normalize('NFD');
    const z = d.length > 1 && /^[̀-ͯ]+$/.test(d.slice(1)) ? d[0] : c;
    const m = z.toLowerCase();
    return m.length === 1 ? m : z;
  });
  const KONC = ['ovych', 'ovymi', 'ovou', 'ovym', 'ovi', 'ove', 'ova', 'ovo', 'eho', 'emu', 'ych', 'ymi', 'ech', 'ami', 'ach', 'ym', 'em', 'ou', 'e', 'y', 'u', 'a', 'i', 'o'];
  // kmen slova pro porovnání ve skloňování (Fiala/Fialy/Fialovi, Brabec/Brabce, Dvořáková/Dvořákovou)
  function kmen(slovo) {
    let k = plochy(slovo).replace(/[^a-z]/g, '');
    for (const c of KONC) if (k.endsWith(c) && k.length - c.length >= 3) { k = k.slice(0, -c.length); break; }
    return k.replace(/e([ckl])$/, '$1');
  }
  const dvoj = n => String(n).padStart(2, '0');
  const isoDen = d => d.getUTCFullYear() + '-' + dvoj(d.getUTCMonth() + 1) + '-' + dvoj(d.getUTCDate());
  const denZ = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; };
  const posunDen = (s, n) => { const d = denZ(s); d.setUTCDate(d.getUTCDate() + n); return isoDen(d); };
  const platnyDen = (y, m, d) => { const x = new Date(Date.UTC(y, m - 1, d)); return x.getUTCFullYear() === y && x.getUTCMonth() === m - 1 && x.getUTCDate() === d; };
  const cislice = s => String(s || '').replace(/\D/g, '');
  const normRz = s => String(s || '').toUpperCase().replace(/[\s-]/g, '');
  const minuty = s => { const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60000 : NaN; };
  const zMinut = n => { const d = new Date(n * 60000); return isoDen(d) + 'T' + dvoj(d.getUTCHours()) + ':' + dvoj(d.getUTCMinutes()); };
  const formatDen = s => { const d = denZ(s); return d ? `${d.getUTCDate()}. ${d.getUTCMonth() + 1}. ${d.getUTCFullYear()}` : String(s || ''); };
  const formatCas = s => { const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(s || ''); return m ? formatDen(m[1]) + ' ' + m[2] : String(s || ''); };

  const MESICE = ['ledna', 'unora', 'brezna', 'dubna', 'kvetna', 'cervna', 'cervence', 'srpna', 'zari', 'rijna', 'listopadu', 'prosince'];
  const DNY_AK = ['pondeli', 'utery', 'stredu', 'ctvrtek', 'patek', 'sobotu', 'nedeli'];
  const DNY_GEN = ['pondeli', 'utery', 'stredy', 'ctvrtka', 'patku', 'soboty', 'nedele'];
  const ORD = { prvni: 1, jedne: 1, jednou: 1, druhe: 2, druhou: 2, treti: 3, ctvrte: 4, ctvrtou: 4, pate: 5, patou: 5, seste: 6, sestou: 6, sedme: 7, sedmou: 7,
    osme: 8, osmou: 8, devate: 9, devatou: 9, desate: 10, desatou: 10, jedenacte: 11, jedenactou: 11, dvanacte: 12, dvanactou: 12 };
  const KARD = { jednu: 1, jedna: 1, dve: 2, dva: 2, tri: 3, ctyri: 4, pet: 5, sest: 6, sedm: 7, osm: 8, devet: 9, deset: 10, jedenact: 11, dvanact: 12 };
  const KARD_GEN = { dvou: 2, ctyr: 4, peti: 5, sesti: 6, sedmi: 7, osmi: 8, deviti: 9, deseti: 10, jedenacti: 11, dvanacti: 12 };
  const alt = o => Object.keys(o).sort((a, b) => b.length - a.length).join('|');
  // podstatná jména, po kterých číslovka není čas („v jednu chvíli“, „ve dvě minuty“)
  const NE_CAS = /^\s+(chvil|minut|vterin|sekund|den|dny|dnu|dni|dnech|let|roky?\b|roku|lid|osob|kus|krat|metr|km|procent|tyd|mesic|tridy|tride|kapitol|vagon|patr|auta|aut)/;
  const ZKRATKY = new Set(['nar', 'c', 'cp', 'ul', 'tzv', 'apod', 'tj', 'napr', 'hod', 'min', 'cca', 'resp', 'mj', 'p', 'pi', 'sv', 'nprap', 'prap', 'pprap', 'sstrm', 'strm', 'npor', 'por', 'kpt', 'mjr', 'plk', 'ing', 'mgr', 'bc', 'judr', 'mudr', 'phdr', 'rndr', 'doc', 'prof', 'tel', 'mob', 'odd', 'oop', 'sp', 'zn', 'cj', 'vc', 'st']);
  // bez diakritiky – kmen() ji stejně odstraní
  const JMENA = new Set(['Jan', 'Petr', 'Pavel', 'Tomas', 'Lukas', 'Martin', 'Jiri', 'Josef', 'Karel', 'Roman', 'Michal', 'Jakub', 'David', 'Ondrej', 'Marek', 'Miroslav',
    'Jaroslav', 'Zdenek', 'Vaclav', 'Milan', 'Frantisek', 'Vladimir', 'Radek', 'Daniel', 'Filip', 'Adam', 'Vojtech', 'Matej', 'Libor', 'Ales', 'Stanislav', 'Antonin',
    'Marie', 'Jana', 'Eva', 'Hana', 'Anna', 'Lenka', 'Katerina', 'Lucie', 'Vera', 'Alena', 'Petra', 'Veronika', 'Tereza', 'Martina', 'Michaela', 'Jitka', 'Ivana',
    'Zdenka', 'Monika', 'Barbora', 'Marketa', 'Klara', 'Pavla', 'Helena', 'Ludmila', 'Dana', 'Zuzana', 'Eliska', 'Simona', 'Jarmila', 'Bozena'].map(kmen));
  // slova před dvojicí s velkým písmenem, po kterých jde spíš o místo („v Dolní Lhotě“)
  const PRED_MISTEM = new Set(['v', 've', 'na', 'do', 'z', 'ze', 'k', 'ke', 'ulice', 'ulici', 'obec', 'obci', 'mesto', 'smer', 'smerem']);
  const PRED_OSOBOU = new Set(['pan', 'pana', 'panu', 'panem', 'pani', 'kamarad', 'kamarada', 'kamaradovi', 'soused', 'souseda', 'sousedovi', 'sousedka', 'sousedky', 'sousedce', 'kamaradem', 'kamaradkou', 'sousedem', 'sousedkou', 'kolega', 'kolegy', 'kolegovi', 'kolegou']);
  const TYTULY = new Set(['ing', 'mgr', 'bc', 'judr', 'mudr', 'phdr', 'rndr', 'doc', 'prof', 'nprap', 'prap', 'pprap', 'npor', 'por', 'kpt', 'mjr', 'plk', 'pan', 'pani']);

  /* ---------- věty ---------- */
  // hranice vět: . ! ? … + mezera (ne za číslem „15.“, iniciálou „L.“ a zkratkou „nar.“) a každý konec řádku
  function vety(text) {
    const v = [], L = plochy(text);
    let zac = 0;
    const re = /([.!?…]+)["“”»)]*(\s+)|\n/g;
    let m;
    while ((m = re.exec(text))) {
      if (m[0] !== '\n') {
        if (m[1] === '.' && !m[2].includes('\n')) {
          const pred = /([\p{L}\d]+)$/u.exec(text.slice(Math.max(0, m.index - 20), m.index));
          const slovo = pred ? pred[1] : '';
          // „15. listopadu“ (řadová číslovka) není konec věty, „ve 2:10. Pak“ ano
          if (/^\d+$/.test(slovo) && !/^\p{Lu}/u.test(text.slice(m.index + m[0].length))) continue;
          if (/^\p{Lu}$/u.test(slovo) || ZKRATKY.has(plochy(slovo))) continue;
        }
      }
      const konec = m.index + m[0].length;
      if (L.slice(zac, konec).trim()) v.push({ od: zac, do: m[0] === '\n' ? m.index : m.index + (m[1] || '').length });
      zac = konec;
    }
    if (text.slice(zac).trim()) v.push({ od: zac, do: text.length });
    return v;
  }
  const vetaNa = (V, i) => V.find(v => i >= v.od && i < v.do + 1) || { od: 0, do: 0 };

  /* ---------- hlavní rozbor ---------- */
  function najdi(text, k = {}) {
    text = String(text || '');
    const L = plochy(text), V = vety(text);
    const maska = new Uint8Array(text.length + 1), N = [];
    const volno = (od, d) => { for (let i = od; i < d; i++) if (maska[i]) return false; return true; };
    const pridej = n => { if (!volno(n.od, n.do)) return null; maska.fill(1, n.od, n.do); n.text = text.slice(n.od, n.do); N.push(n); return n; };
    const kazdy = (re, zdroj, fn) => { re.lastIndex = 0; let m; while ((m = re.exec(zdroj))) { fn(m); if (!m[0].length) re.lastIndex++; } };
    const datRec = k.datum && denZ(k.datum) ? k.datum : null;
    const zacVety = i => V.some(v => text.slice(v.od, i).trim() === '');

    // 1) účty: IBAN CZ a tuzemský formát předčíslí-číslo/kód banky (kód banky ze seznamu ČNB – jinak „17/2026“ není účet)
    const BANKY = '0100|0300|0600|0710|0800|2010|2020|2060|2070|2100|2200|2220|2250|2260|2600|2700|3030|3050|3060|3500|4000|4300|5500|5800|6000|6100|6200|6210|6300|6363|6700|6800|7910|7950|7960|7970|7990|8030|8040|8060|8090|8150|8190|8198|8199|8200|8220|8250|8255|8265|8500';
    kazdy(/(?<![\w])CZ\d{2}(?:\s?\d{4}){5}(?![\w])/g, text, m => pridej({ typ: 'ucet', od: m.index, do: m.index + m[0].length, hodnota: m[0].replace(/\s/g, '').replace(/(.{4})(?=.)/g, '$1 '), presnost: 'IBAN' }));
    kazdy(new RegExp('(?<![\\w/-])(?:(\\d{1,6})-)?(\\d{2,10})/(' + BANKY + ')(?![\\w/])', 'g'), text, m => {
      if (!m[1] && m[2].length < 6) return;
      pridej({ typ: 'ucet', od: m.index, do: m.index + m[0].length, hodnota: (m[1] ? m[1] + '-' : '') + m[2] + '/' + m[3], presnost: 'číslo účtu / kód banky' });
    });
    // 2) telefony: +420 / 00420 a 9 číslic (po trojicích nebo vcelku); ne částky
    kazdy(/(?<![\w+/.,-])(?:(\+|00)\s?420[\s-]?)?([2-79]\d{2})([\s-]?)(\d{3})\3(\d{3})(?![\w/]|[.,]\d|\s*(?:kč|korun|czk|€|eur|,-))/gi, text, m => {
      if (!m[1] && !m[3] && !/^[67]/.test(m[2])) return;     // 9 číslic vcelku bez předvolby jen u mobilů
      // číslo faktury, smlouvy, variabilní symbol… bez předvolby není telefon
      if (!m[1] && /(faktur\w*|symbol\w*|\bvs|jednaci|objednavk\w*|smlouv\w*|dokladu?|\bc\.\s*j\.)\s*(c\.|cislo)?\s*[:.]?\s*$/.test(L.slice(Math.max(0, m.index - 30), m.index))) return;
      pridej({ typ: 'telefon', od: m.index, do: m.index + m[0].length, hodnota: '+420 ' + m[2] + ' ' + m[4] + ' ' + m[5], presnost: m[1] ? 's předvolbou' : 'bez předvolby' });
    });
    // 3) SPZ: od 2001 „1AB 2345“, starší „ABC 12-34“
    kazdy(/(?<![\p{L}\d])(\d[A-Z][A-Z\d])\s?(\d{4})(?![\p{L}\d])/gu, text, m => pridej({ typ: 'spz', od: m.index, do: m.index + m[0].length, hodnota: m[1] + ' ' + m[2], presnost: 'formát od 2001' }));
    kazdy(/(?<![\p{L}\d])([A-Z]{2,3})\s?(\d{2})[-–](\d{2})(?![\p{L}\d])/gu, text, m => pridej({ typ: 'spz', od: m.index, do: m.index + m[0].length, hodnota: m[1] + ' ' + m[2] + '-' + m[3], presnost: 'starší formát (do 2001)' }));
    // 4) částky
    const MENA = '(kc|korun[ay]?|czk|€|eur[a]?|euro)';
    const PEN = '(\\d{1,3}(?:[ \\u00a0.]\\d{3})+|\\d+)(?:,(\\d{1,2}|-{1,2}))?';
    const castka = (cislo, des, nas) => {
      let v = parseFloat(cislo.replace(/[\s.]/g, '') + (des && /\d/.test(des) ? '.' + des : ''));
      if (nas) v *= /^mil/.test(nas) ? 1e6 : 1e3;
      return v;
    };
    const fmtCastka = (v, mena) => { const [c, d] = v.toFixed(2).replace(/\.00$/, '').split('.'); return c.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (d ? ',' + d : '') + (/kc|kor|czk/.test(mena) ? ' Kč' : ' €'); };
    kazdy(new RegExp('(?<![\\d\\p{L}])' + PEN + '\\s*(tis\\.|tisic[ei]?|mil\\.|milion[uy]?)?\\s*(?:,-\\s*)?' + MENA + '(?![\\p{L}])', 'gu'), L, m => {
      pridej({ typ: 'castka', od: m.index, do: m.index + m[0].length, hodnota: fmtCastka(castka(m[1], m[2], m[3]), m[4]), presnost: 'částka' });
    });
    kazdy(new RegExp('(?:€|eur)\\s?' + PEN + '(?![\\d])', 'g'), L, m => pridej({ typ: 'castka', od: m.index, do: m.index + m[0].length, hodnota: fmtCastka(castka(m[1], m[2]), 'eur'), presnost: 'částka' }));

    // 5) data
    const rokBez = (m, d) => {   // rok u data bez roku: rok záznamu, a když by datum bylo po záznamu, o rok dřív
      if (!datRec) return null;
      let y = +datRec.slice(0, 4);
      if (platnyDen(y, m, d) && isoDen(new Date(Date.UTC(y, m - 1, d))) > datRec) y--;
      return y;
    };
    const datum = (od, d0, y, m, d, presnost, nejiste) => {
      if (y !== null && !platnyDen(y, m, d)) return null;
      return pridej({ typ: 'datum', od, do: d0, hodnota: y === null ? null : y + '-' + dvoj(m) + '-' + dvoj(d), presnost: y === null ? 'chybí rok (zadejte datum záznamu)' : presnost, nejiste });
    };
    kazdy(/(?<![\d])(\d{4})-(\d{2})-(\d{2})(?![\d])/g, L, m => datum(m.index, m.index + m[0].length, +m[1], +m[2], +m[3], 'den'));
    kazdy(/(?<![\d.])(\d{1,2})\.\s?(\d{1,2})\.(?:\s?(\d{4}))?(?![\d])/g, L, m => {
      if (+m[2] < 1 || +m[2] > 12) return;
      datum(m.index, m.index + m[0].length, m[3] ? +m[3] : rokBez(+m[2], +m[1]), +m[2], +m[1], m[3] ? 'den' : 'den (rok podle data záznamu)');
    });
    kazdy(new RegExp('(?<![\\d.])(\\d{1,2})\\.\\s?(' + MESICE.join('|') + ')(?:\\s+(\\d{4}))?(?![a-z])', 'g'), L, m => {
      const mes = MESICE.indexOf(m[2]) + 1;
      datum(m.index, m.index + m[0].length, m[3] ? +m[3] : rokBez(mes, +m[1]), mes, +m[1], m[3] ? 'den' : 'den (rok podle data záznamu)');
    });
    const relativni = (od, d0, posun, presnost) => pridej({ typ: 'datum', od, do: d0, hodnota: datRec ? posunDen(datRec, -posun) : null, presnost: datRec ? presnost : 'relativní – chybí datum záznamu', nejiste: true });
    const REL = { dnes: 0, dneska: 0, vcera: 1, predevcirem: 2 };
    kazdy(/(?<![a-z])(dnes|dneska|vcera|predevcirem)(?![a-z])/g, L, m => relativni(m.index, m.index + m[0].length, REL[m[1]], 'relativně k datu záznamu'));
    // den v týdnu → nejbližší takový den v týdnu nejpozději v den záznamu
    const zpetNaDen = idx => { if (!datRec) return null; const r = (denZ(datRec).getUTCDay() + 6) % 7; return (r - idx + 7) % 7; };
    kazdy(new RegExp('(?<![a-z])(?:(?:v|ve|minuly|minulou|minule|tento|tuto|ten|tu|v\\s+minuly|v\\s+minulou|minuly\\s+tyden\\s+v|minuly\\s+tyden\\s+ve)\\s+)(' + DNY_AK.join('|') + ')(?![a-z])', 'g'), L, m => {
      const minuly = /minul/.test(m[0]);
      let z = zpetNaDen(DNY_AK.indexOf(m[1]));
      if (z !== null && minuly && z === 0) z = 7;
      // „minulý týden v pátek“ = pátek předchozího kalendářního týdne (před pondělím týdne záznamu)
      if (z !== null && /tyden/.test(m[0])) z = (denZ(datRec).getUTCDay() + 6) % 7 - DNY_AK.indexOf(m[1]) + 7;
      relativni(m.index, m.index + m[0].length, z === null ? 0 : z, 'den v týdnu – nejbližší předchozí vůči datu záznamu');
    });

    // 6) časy
    const castDne = (s) => s ? (/noc/.test(s) ? 'noc' : /vecer/.test(s) ? 'vecer' : /odpol/.test(s) ? 'odpoledne' : /dopol/.test(s) ? 'dopoledne' : /ran/.test(s) ? 'rano' : null) : null;
    const k24 = (h12, cast) => {
      if (cast === 'odpoledne' || cast === 'vecer') return h12 % 12 + 12;
      if (cast === 'noc') return h12 >= 7 && h12 < 12 ? h12 + 12 : h12 % 12;
      if (cast === 'rano' || cast === 'dopoledne') return h12 % 12;
      return h12;
    };
    const PRE = '((?:(?:kolem|okolo|asi|zhruba|priblizne|cca|tak|v|ve|o|od|do|po|pred|az|mezi|nez)\\s+){0,3})';
    const JADRO = '(?:(\\d{1,2})([:.])(\\d{2})|(\\d{1,2})(?=\\s*(?:hodin[ayu]?|hod|h)(?![a-z]))|pul\\s+(' + alt(ORD) + ')|(tri\\s+)?ctvrt[e]?\\s+na\\s+(' + alt(KARD) + ')|(' + alt(Object.assign({}, ORD, KARD, KARD_GEN)) + '))';
    const SUF = '(\\s*(?:hodin[ayu]?|hod\\.?|h)(?![a-z]))?(\\s+(?:rano|dopoledne|odpoledne|vecer|v\\s+noci))?';
    kazdy(new RegExp('(?<![a-z0-9.:])' + PRE + JADRO + SUF + '(?![a-z0-9]|[.:]\\d)', 'g'), L, m => {
      const pre = m[1].trim().split(/\s+/).filter(Boolean), posl = pre[pre.length - 1] || '';
      const priblizne = pre.some(p => /^(kolem|okolo|asi|zhruba|priblizne|cca|tak)$/.test(p));
      const hod = !!m[10], konec = m.index + m[0].length;
      if (NE_CAS.test(L.slice(konec))) return;
      let h12 = null, h = null, min = 0, druh;
      if (m[2] !== undefined) {                        // 21:30 / 21.30
        h = +m[2]; min = +m[4];
        if (h > 23 || min > 59) return;
        if (m[3] === '.' && !pre.length && !hod) return;
        druh = 'cislo';
      } else if (m[5] !== undefined) {                 // ve 21 hodin
        if (!/^(v|ve|o|kolem|okolo|od|do|pred|po|az|mezi|nez)$/.test(posl) || +m[5] > 24) return;
        h = +m[5] % 24; druh = 'hodina';
      } else if (m[6] !== undefined) {                 // půl deváté
        h12 = (ORD[m[6]] + 11) % 12 || 12; min = 30; druh = 'slovo';
      } else if (m[8] !== undefined) {                 // čtvrt na tři / tři čtvrtě na pět
        h12 = (KARD[m[8]] + 11) % 12 || 12; min = m[7] ? 45 : 15; druh = 'slovo';
      } else {                                         // kolem desáté, v deset, kolem deseti večer
        const w = m[9];
        if (w in ORD && !(w in KARD)) {
          if (!/^(kolem|okolo|o|po|pred|az|nez|od|do)$/.test(posl)) return;
          if (posl === 'po' && !hod && !m[11]) return;      // „po druhé“ = podruhé
          h12 = ORD[w];
        } else if (w in KARD) {
          if (!/^(v|ve)$/.test(posl)) return;
          h12 = KARD[w];
        } else {
          if (!/^(kolem|okolo|od|do)$/.test(posl) || (!hod && !m[11])) return;   // „kolem deseti“ lidí ≠ čas
          h12 = KARD_GEN[w];
        }
        druh = 'slovo';
      }
      // dopoledne/večer: přípona, jinak slovo ve stejné větě
      let dvojznacne = false;
      if (h === null || (druh === 'hodina' && h <= 12)) {
        const v = vetaNa(V, m.index), c = castDne(m[11]) || castDne((/(vecer|v noci|odpol|dopol|rano|nad ranem)/.exec(L.slice(v.od, v.do)) || [])[1]);
        const zaklad = h === null ? h12 : h;
        h = c ? k24(zaklad, c) : zaklad % 24;
        dvojznacne = !c && zaklad >= 1 && zaklad <= 12;
      }
      const nejistota = priblizne ? 30 : druh === 'cislo' ? 0 : 15;
      pridej({ typ: 'cas', od: m.index, do: konec, cas: dvoj(h) + ':' + dvoj(min), nejistota, dvojznacne,
        presnost: priblizne ? 'přibližně (± 30 min)' : druh === 'cislo' ? 'přesný čas' : 'zaokrouhleno (± 15 min)' });
    });
    // části dne; noc „ze 14. na 15. listopadu“ / „na neděli“ pohltí následující datum
    const CASTI = { noc: [22, 6 + 24], vecer: [18, 22], rano: [6, 9], dopoledne: [9, 12], odpoledne: [12, 18], nadranem: [3, 6], podvecer: [17, 19], poledne: [12, 12], pulnoc: [24, 24] };
    kazdy(/(?<![a-z])(celou\s+noc|pres\s+noc|v\s+noci|v\s+noc|k\s+ranu|nad\s+ranem|v\s+podvecer|(?:o|kolem|okolo|v)\s+pulnoci|(?:v|kolem|okolo)\s+poledne|vecer|rano|dopoledne|odpoledne)(?![a-z])/g, L, m => {
      const s = m[1], c = /pulnoc/.test(s) ? 'pulnoc' : /noc/.test(s) ? 'noc' : /ranu|ranem/.test(s) ? 'nadranem' : /podvecer/.test(s) ? 'podvecer' : /poledne/.test(s) && !/dopol|odpol/.test(s) ? 'poledne' : s;
      let konec = m.index + m[0].length, datumNoci = null, sloucene = null, maDatum = false;
      if (c === 'noc') {
        const z = /^\s+(?:(?:z|ze)\s+[^\s]+(?:\s+[^\s]+)?\s+)?na\s+/.exec(L.slice(konec));
        if (z && z[0].length < 40) {
          const zac = konec + z[0].length;
          const dn = N.find(n => n.typ === 'datum' && n.od === zac);
          const bare = new RegExp('^(' + DNY_AK.join('|') + ')(?![a-z])').exec(L.slice(zac));
          if (dn) { sloucene = dn; datumNoci = dn.hodnota; konec = dn.do; maDatum = true; }
          else if (bare) { const zp = zpetNaDen(DNY_AK.indexOf(bare[1])); datumNoci = zp === null ? null : posunDen(datRec, -zp); konec = zac + bare[0].length; maDatum = true; }
        }
      }
      // pohltí i datum začátku noci („z 31. října na 1. listopadu“) – jiné nálezy v rozsahu nález noci zruší
      const pohlcene = maDatum ? N.filter(n => n.typ === 'datum' && n.od >= m.index && n.do <= konec) : [];
      for (const x of pohlcene) { N.splice(N.indexOf(x), 1); maska.fill(0, x.od, x.do); }
      if (!volno(m.index, konec)) { for (const x of pohlcene) { N.push(x); maska.fill(1, x.od, x.do); } return; }
      const [a, b] = CASTI[c];
      const n = pridej({ typ: 'cas', od: m.index, do: konec, cast: c, castOd: a, castDo: b, nejistota: /kolem|okolo/.test(s) ? 30 : 0, presnost: 'část dne (interval)' });
      if (n && maDatum) { n.datumKonce = datumNoci; if (!datumNoci) n.presnost = 'část dne – chybí datum záznamu'; }
    });

    // 7) místa ze spisu (porovnání kmenů; adresa s číslem = přesná shoda)
    const T = []; kazdy(/[\p{L}]+/gu, text, m => T.push({ s: m[0], od: m.index, do: m.index + m[0].length, k: kmen(m[0]), velke: /^\p{Lu}/u.test(m[0]) }));
    const T2 = T.filter(t => t.s.length >= 2);
    const klice = [];
    for (const e of k.mista || []) {
      const zdroj = [e.nazev, (e.data || {}).adresa].filter(Boolean).join(',').replace(/\([^)]*\)/g, '');
      for (const cast of zdroj.split(/[,;]/)) {
        const slova = (cast.match(/[\p{L}]{2,}/gu) || []), cislo = (/\b(\d{1,4}(?:\/\d{1,4})?[a-z]?)\b/.exec(cast) || [])[1];
        if (!slova.length || !slova.some(s => /^\p{Lu}/u.test(s))) continue;
        klice.push({ id: e.id, nazev: e.nazev, kmeny: slova.map(kmen), cislo });
      }
    }
    const shody = [];
    for (let i = 0; i < T2.length; i++) for (const kl of klice) {
      const n = kl.kmeny.length;
      if (i + n > T2.length || !kl.kmeny.every((x, j) => x === T2[i + j].k)) continue;
      if (n === 1 && !T2[i].velke) continue;
      if (!T2.slice(i, i + n).some(t => t.velke)) continue;
      let od = T2[i].od, d = T2[i + n - 1].do, plna = !kl.cislo;
      const za = /^\s+(\d{1,4}(?:\/\d{1,4})?[a-z]?)(?![\d\p{L}])/u.exec(text.slice(d));
      if (kl.cislo && za) { if (za[1] !== kl.cislo) continue; d += za[0].length; plna = true; }
      shody.push({ od, do: d, kl, plna });
    }
    shody.sort((a, b) => a.od - b.od || (b.do - b.od) - (a.do - a.od) || b.plna - a.plna);
    for (const s of shody) {
      if (!volno(s.od, s.do)) continue;
      const stejne = shody.filter(x => x.od === s.od && x.do === s.do && x.plna === s.plna).map(x => x.kl.id);
      const kand = [...new Set(stejne)];
      pridej({ typ: 'misto', od: s.od, do: s.do, entita: s.kl.id, hodnota: s.kl.nazev, kandidati: kand.length > 1 ? kand : undefined,
        presnost: s.plna ? 'podle spisu' : 'podle spisu – jen obec / ulice bez čísla', nejiste: !s.plna || kand.length > 1 });
    }
    // 8) adresy „Ulice č.“ mimo spis
    kazdy(/(?<![\p{L}\d])((?:\p{Lu}\p{Ll}+\s+){0,2}\p{Lu}\p{Ll}+)\s+(\d{1,4}(?:\/\d{1,4})?[a-z]?)(?![\p{L}\d]|[.:]\d)/gu, text, m => {
      const slova = m[1].split(/\s+/), pred = (/([\p{L}.]+)\s+$/u.exec(text.slice(Math.max(0, m.index - 20), m.index)) || [])[1] || '';
      const spoust = /^(ulice|ulici|ul\.|adrese|adresa|bytem|bydlištěm|bydliště|trvale|č\.\s?p\.)$/i.test(pred);
      const ulicni = slova.some(s => /(ní|ská|cká|ské|cké|skou|ckou|ova|ová|ovo|ovou|ého)$/.test(s));
      if (!spoust && !ulicni) return;
      if (/^\s*(kč|km|m\b|min|let|lid|kus|%|h\b|hod|€|krát|x\b)/i.test(text.slice(m.index + m[0].length))) return;
      if (MESICE.includes(plochy(slova[slova.length - 1]))) return;
      pridej({ typ: 'misto', od: m.index, do: m.index + m[0].length, hodnota: m[0], presnost: 'adresa (není ve spisu)', nejiste: !spoust });
    });

    // 9) osoby ze spisu (příjmení podle kmene, s křestním jménem nebo iniciálou před ním)
    const osoby = (k.osoby || []).map(e => {
      const sl = (e.nazev.replace(/\([^)]*\)/g, '').match(/[\p{L}]{2,}/gu) || []).filter(s => !TYTULY.has(plochy(s)));
      return sl.length ? { id: e.id, nazev: e.nazev, prijmeni: kmen(sl[sl.length - 1]), jmeno: sl.length > 1 ? sl[0] : null } : null;
    }).filter(o => o && o.prijmeni.length >= 3);
    for (let i = 0; i < T.length; i++) {
      const t = T[i];
      if (!t.velke) continue;
      const kand = osoby.filter(o => o.prijmeni === t.k);
      if (!kand.length) continue;
      let od = t.od, plne = false;
      const p = T[i - 1], mezi = p ? text.slice(p.do, t.od) : '';
      if (p && p.velke && /^\s+$/.test(mezi) && kand.some(o => o.jmeno && kmen(o.jmeno) === p.k)) { od = p.od; plne = true; }
      else if (p && p.s.length === 1 && p.velke && /^\.\s*$/.test(mezi) && kand.some(o => o.jmeno && plochy(o.jmeno[0]) === plochy(p.s))) { od = p.od; plne = true; }
      const kk = plne ? kand.filter(o => o.jmeno && (kmen(o.jmeno) === p.k || plochy(o.jmeno[0]) === plochy(p.s))) : kand;
      pridej({ typ: 'osoba', od, do: t.do, entita: kk[0].id, hodnota: kk[0].nazev, kandidati: kk.length > 1 ? kk.map(o => o.id) : undefined,
        presnost: plne ? 'jméno a příjmení podle spisu' : 'příjmení podle spisu', nejiste: kk.length > 1 });
    }
    // 10) osoby – heuristika: dvojice slov s velkým písmenem (ne na začátku věty, ne po „v/na/do…“),
    //     iniciála + příjmení, „pan/paní + Jméno“. Vždy nejisté.
    for (let i = 0; i < T.length; i++) {
      const a = T[i], b = T[i + 1];
      if (!a.velke || a.s === a.s.toUpperCase() && a.s.length > 1) continue;
      const pred = plochy((T[i - 1] || {}).s || '');
      const mezi = b ? text.slice(a.do, b.od) : '';
      const jeJmeno = JMENA.has(a.k);
      if (b && b.velke && b.s !== b.s.toUpperCase() && b.s.length > 1 && /^ $/.test(mezi) && a.s.length > 1) {
        if (zacVety(a.od) && !jeJmeno) continue;
        if ((PRED_MISTEM.has(pred) || PRED_MISTEM.has(plochy(a.s))) && !jeJmeno) continue;
        if (MESICE.includes(plochy(b.s)) || DNY_AK.includes(plochy(a.s))) continue;
        if (pridej({ typ: 'osoba', od: a.od, do: b.do, hodnota: a.s + ' ' + b.s, presnost: 'odhad podle velkých písmen (není ve spisu)', nejiste: true })) i++;
      } else if (b && b.velke && a.s.length === 1 && /^\.\s?$/.test(mezi) && b.s.length > 2 && b.s !== b.s.toUpperCase() && !/[\p{L}\d]/u.test(text[a.od - 1] || '') && !zacVety(b.od)) {
        if (pridej({ typ: 'osoba', od: a.od, do: b.do, hodnota: a.s + '. ' + b.s, presnost: 'iniciála a příjmení (není ve spisu)', nejiste: true })) i++;
      } else if (PRED_OSOBOU.has(pred) && a.s.length > 2 && !zacVety(a.od)) {
        pridej({ typ: 'osoba', od: a.od, do: a.do, hodnota: a.s, presnost: 'po slově „pan/paní…“ (není ve spisu)', nejiste: true });
      }
    }

    // propojení s entitami spisu (telefon, vozidlo, účet)
    for (const n of N) {
      const hledej = (seznam, fn) => { const e = (seznam || []).find(fn); if (e) { n.entita = e.id; n.presnost += ' · ve spisu'; } };
      if (n.typ === 'telefon') hledej(k.telefony, e => { const c = cislice((e.data || {}).cislo || e.nazev).slice(-9); return c.length === 9 && c === cislice(n.hodnota).slice(-9); });
      if (n.typ === 'spz') hledej(k.vozidla, e => normRz((e.data || {}).rz) === normRz(n.hodnota));
      if (n.typ === 'ucet') hledej(k.ucty, e => normRz((e.data || {}).cislo) === normRz(n.hodnota));
    }
    N.sort((a, b) => a.od - b.od);
    doplnCasy(N, V, datRec);
    // stabilní klíč (typ|text|pořadí výskytu) – přežije úpravu textu jinde v dokumentu
    const vyskyt = {};
    for (const n of N) { const z = n.typ + '|' + n.text; vyskyt[z] = (vyskyt[z] || 0) + 1; n.klic = z + '|' + vyskyt[z]; }
    return N;
  }

  // časům doplní datum: datum ve stejné větě > poslední datovaný nález před ním > datum záznamu
  function doplnCasy(N, V, datRec) {
    const datovany = n => n.typ === 'datum' ? !!n.hodnota : (n.typ === 'cas' && n.hodnota && /T/.test(n.hodnota));
    const blizko = d => !datRec || Math.abs(denZ(d) - denZ(datRec)) <= 366 * 864e5;
    const denKontextu = (c, n) => {
      if (c.typ === 'datum') return c.hodnota;
      const [a, b] = c.hodnota.split('/');
      const h = n.cas ? +n.cas.slice(0, 2) : n.castOd;
      return b && h < 12 ? b.slice(0, 10) : a.slice(0, 10);
    };
    for (const n of N) {
      if (n.typ !== 'cas') continue;
      // noc „na 15. 11.“ začíná den předem
      let den = n.datumKonce ? posunDen(n.datumKonce, -1) : null, zdroj = n.datumKonce ? 'vlastni' : null;
      if (!den && !n.datumKonce) {
        const v = vetaNa(V, n.od);
        const veVete = N.filter(c => c !== n && datovany(c) && c.od >= v.od && c.do <= v.do + 1 && blizko(denKontextu(c, n)));
        const pred = veVete.filter(c => c.od < n.od).pop(), po = veVete.find(c => c.od > n.od);
        const c = pred || po || N.filter(c => c !== n && c.od < n.od && datovany(c) && blizko(denKontextu(c, n))).pop();
        if (c) { den = denKontextu(c, n); zdroj = 'kontext'; }
        else if (datRec) { den = datRec; zdroj = 'zaznam'; }
      }
      n.datumZ = zdroj;
      if (n.cas) n.hodnota = den ? den + 'T' + n.cas : n.cas;
      else if (den) {
        const z = minuty(den + 'T00:00');
        n.hodnota = n.castOd === n.castDo ? zMinut(z + n.castOd * 60) : zMinut(z + n.castOd * 60) + '/' + zMinut(z + n.castDo * 60);
      } else n.hodnota = null;
      if (zdroj === 'zaznam') { n.presnost += ' · datum = datum záznamu'; n.nejiste = true; }
      if (n.dvojznacne) { n.presnost += ' · dopoledne, nebo večer?'; n.nejiste = true; }
    }
  }

  /* ---------- hodnoty nálezů (úprava uživatelem) ---------- */
  const TYPY = {
    cas: { nazev: 'Čas', ikona: '🕓', prenos: 'udalost' }, datum: { nazev: 'Datum', ikona: '📅' },
    osoba: { nazev: 'Osoba', ikona: '👤', prenos: 'osoba' }, misto: { nazev: 'Místo', ikona: '📍', prenos: 'misto' },
    spz: { nazev: 'SPZ', ikona: '🚗', prenos: 'vozidlo' }, telefon: { nazev: 'Telefon', ikona: '📱', prenos: 'telefon' },
    castka: { nazev: 'Částka', ikona: '💰' }, ucet: { nazev: 'Účet', ikona: '🏦', prenos: 'ucet' }
  };
  const ZNACKY = { overeno: 'ověřené', tvrzeni: 'tvrzení', rozpor: 'rozpor' };
  // „2026-11-14T22:45“, „14. 11. 2026 22:45“, interval „… / …“ nebo „… – …“ → kanonický tvar, jinak null
  function casUzivatele(s) {
    const jeden = x => {
      x = x.trim();
      let m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})$/.exec(x);
      if (m) return platnyDen(+m[1], +m[2], +m[3]) && +m[4] < 24 && +m[5] < 60 ? `${m[1]}-${m[2]}-${m[3]}T${dvoj(m[4])}:${m[5]}` : null;
      m = /^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})\s+(\d{1,2}):(\d{2})$/.exec(x);
      if (m) return platnyDen(+m[3], +m[2], +m[1]) && +m[4] < 24 && +m[5] < 60 ? `${m[3]}-${dvoj(m[2])}-${dvoj(m[1])}T${dvoj(m[4])}:${m[5]}` : null;
      return null;
    };
    const casti = String(s || '').split(/\s*(?:\/|–|—|\s-\s)\s*/);
    if (casti.length > 2) return null;
    const v = casti.map(jeden);
    if (v.some(x => !x)) return null;
    if (v[1] && v[1] < v[0]) return null;
    return v.join('/');
  }
  function platnaHodnota(typ, s) {
    s = String(s || '').trim();
    if (!s) return null;
    if (typ === 'cas') return casUzivatele(s);
    if (typ === 'datum') { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s) || /^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})$/.exec(s); if (!m) return null; const [y, mm, d] = m[1].length === 4 ? [+m[1], +m[2], +m[3]] : [+m[3], +m[2], +m[1]]; return platnyDen(y, mm, d) ? y + '-' + dvoj(mm) + '-' + dvoj(d) : null; }
    if (typ === 'telefon') { const c = cislice(s); const n = c.length === 9 ? c : /^(420|00420)\d{9}$/.test(c) ? c.slice(-9) : null; return n ? '+420 ' + n.slice(0, 3) + ' ' + n.slice(3, 6) + ' ' + n.slice(6) : null; }
    if (typ === 'spz') return /^[\dA-Z]{2,3}\s?[\d-]{4,5}$/i.test(s) ? s.toUpperCase() : null;
    return s.slice(0, 300);
  }
  function popisHodnoty(n) {
    if (n.hodnota === null || n.hodnota === undefined) return '?';
    if (n.typ === 'cas') {
      const [a, b] = String(n.hodnota).split('/');
      const t = /T/.test(a) ? formatCas(a) : a;
      return (b ? t + ' – ' + formatCas(b) : t) + (n.nejistota ? ' ± ' + n.nejistota + ' min' : '');
    }
    if (n.typ === 'datum') return formatDen(n.hodnota);
    return String(n.hodnota);
  }

  /* ---------- nálezy dokumentu = automatika + uložený rozbor ---------- */
  const prazdnyRozbor = () => ({ odmitnute: [], upravy: {}, rucni: [], znacky: [], prenos: {} });
  function rozborDokumentu(dok) {
    const r = Object.assign(prazdnyRozbor(), ((dok || {}).data || {}).rozbor || {});
    for (const k of ['odmitnute', 'rucni', 'znacky']) if (!Array.isArray(r[k])) r[k] = [];
    for (const k of ['upravy', 'prenos']) if (!r[k] || typeof r[k] !== 'object') r[k] = {};
    return JSON.parse(JSON.stringify(r));
  }
  function nalezyDokumentu(dok, k = {}) {
    const d = (dok && dok.data) || {}, R = rozborDokumentu(dok), text = d.text || '';
    const v = najdi(text, Object.assign({}, k, { datum: d.datum || k.datum }));
    for (const r of R.rucni) if (r && TYPY[r.typ] && r.od >= 0 && r.do <= text.length && r.od < r.do) v.push(Object.assign({}, r, { text: text.slice(r.od, r.do), rucni: true }));
    for (const n of v) {
      if (R.odmitnute.includes(n.klic)) n.odmitnuto = true;
      const u = R.upravy[n.klic];
      if (u && u.hodnota !== undefined) { n.hodnota = u.hodnota; n.upraveno = true; n.nejiste = false; if (u.entita !== undefined) n.entita = u.entita || undefined; }
      if (R.prenos[n.klic]) n.preneseno = R.prenos[n.klic];
    }
    return v.sort((a, b) => a.od - b.od || a.do - b.do);
  }
  // ruční nález z označeného úryvku; hodnota z automatiky nad úryvkem, jinak úryvek sám
  function rucniNalez(text, od, d, typ, k = {}) {
    const usek = text.slice(od, d);
    const auto = najdi(usek, k).find(n => n.typ === typ);
    const n = { klic: 'r|' + typ + '|' + od + '-' + d, typ, od, do: d, text: usek, hodnota: auto ? auto.hodnota : platnaHodnota(typ, usek) || usek.trim().slice(0, 300), presnost: 'označeno ručně', rucni: true };
    if (auto) { for (const x of ['nejistota', 'entita']) if (auto[x] !== undefined) n[x] = auto[x]; }
    return n;
  }
  // po úpravě textu: úryvky (ruční nálezy, zvýraznění) najde znovu podle textu – nejbližší výskyt; nenalezené vypadnou
  function premapuj(polozky, novyText) {
    const ok = [], ztracene = [];
    for (const p of polozky || []) {
      if (novyText.slice(p.od, p.do) === p.text) { ok.push(p); continue; }
      let best = -1, i = novyText.indexOf(p.text);
      while (i >= 0 && p.text) { if (best < 0 || Math.abs(i - p.od) < Math.abs(best - p.od)) best = i; i = novyText.indexOf(p.text, i + 1); }
      if (best < 0) ztracene.push(p); else ok.push(Object.assign({}, p, { od: best, do: best + p.text.length }));
    }
    return { ok, ztracene };
  }

  /* ---------- střet tvrzení s jinými událostmi ---------- */
  // jiná událost téže osoby, která se časově překrývá a má jiné místo
  function interval(u) {
    const a = minuty(u.data.kdy), b = minuty(u.data.do || u.data.kdy), n = +u.data.nejistota || 0;
    return [a - n, b + n];
  }
  function strety(u, vsechny) {
    if (!u || !u.data || !u.data.misto || !(u.data.osoby || []).length) return [];
    const [a, b] = interval(u);
    return (vsechny || []).filter(x => x.id !== u.id && !x.smazano && x.data && x.data.misto && x.data.misto !== u.data.misto
      && (x.data.osoby || []).some(o => u.data.osoby.includes(o)) && (() => { const [c, d] = interval(x); return c <= b && d >= a; })());
  }

  /* ---------- přenos do spisu (S = window.SPIS) ---------- */
  const NASTROJ = 'rozbor_vypovedi';
  const jeTvrzeni = dok => /výpov|vypov|záznam|zaznam|vysvětl|vysvetl|tvrzen/i.test(((dok.data || {}).druh || '') + ' ' + dok.nazev);
  async function ulozRozbor(S, dok, fn, o = {}) {
    const akt = await S.entita(dok.id) || dok;
    const R = rozborDokumentu(akt);
    fn(R);
    return S.uloz({ id: akt.id, typ: akt.typ, nazev: akt.nazev, data: Object.assign({}, akt.data, { rozbor: R }) }, { nastroj: o.nastroj || NASTROJ });
  }
  async function vazbaJednou(S, od, doId, typ, o) {
    const ex = (await S.vazby(od)).find(v => v.typ === typ && ((v.od === od && v.do === doId) || (v.od === doId && v.do === od)));
    return ex || S.vazba(od, doId, typ, o);
  }
  const zkrat = (s, n) => { s = String(s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; };
  // přenese nález do spisu; existující entitu jen propojí. → { entita, nova, dok, strety }
  async function prenes(S, dok, n, o = {}) {
    const nastroj = o.nastroj || NASTROJ, typ = TYPY[n.typ] && TYPY[n.typ].prenos;
    if (!typ) throw new Error('Tento druh nálezu se do spisu nepřenáší.');
    if (n.hodnota === null || n.hodnota === undefined || n.hodnota === '') throw new Error('Nález nemá hodnotu – upravte ho.');
    const text = (dok.data || {}).text || '';
    let e = null, nova = false;
    if (typ === 'udalost') {
      const [kdy, doK] = String(n.hodnota).split('/');
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(kdy)) throw new Error('U času chybí datum – upravte nález (např. 2026-11-14T22:45).');
      const V = vety(text), v = vetaNa(V, n.od), veta = text.slice(v.od, v.do).trim();
      const vedle = (o.nalezy || []).filter(x => !x.odmitnuto && x.od >= v.od && x.do <= v.do + 1);
      const osoby = [...new Set([(dok.data || {}).osoba, ...vedle.filter(x => x.typ === 'osoba').map(x => x.preneseno || x.entita)].filter(Boolean))];
      const misto = (vedle.find(x => x.typ === 'misto' && (x.preneseno || x.entita)) || {});
      const tvrz = jeTvrzeni(dok);
      const data = { kdy, do: doK, nejistota: n.nejistota || undefined, druh: tvrz ? 'svedek' : 'udalost', jistota: tvrz ? 'tvrzeni' : undefined, osoby,
        misto: misto.preneseno || misto.entita, zdroj: dok.nazev, popis: veta, dokument: dok.id, nalez: n.klic };
      const stejne = (a, b) => JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort());
      const vse = await S.seznam('udalost');
      e = vse.find(x => x.data.dokument === dok.id && x.data.nalez === n.klic)
        || vse.find(x => x.data.kdy === kdy && (x.data.do || '') === (doK || '') && (x.data.misto || '') === (data.misto || '') && stejne(x.data.osoby, osoby) && (x.data.jistota || '') === (data.jistota || ''));
      if (!e) { e = await S.uloz({ typ: 'udalost', nazev: zkrat((tvrz ? 'Tvrzení: ' : '') + veta, 120), data }, { nastroj }); nova = true; }
      await vazbaJednou(S, e.id, dok.id, 'souvisi', { popis: 'zdroj: ' + zkrat(n.text, 80), nastroj });
      const ud = await S.seznam('udalost');
      dok = await ulozRozbor(S, dok, R => { R.prenos[n.klic] = e.id; }, o);
      return { entita: e, nova, dok, strety: strety(ud.find(x => x.id === e.id) || e, ud) };
    }
    const hodnota = String(n.hodnota);
    const vse = await S.seznam(typ);
    if (n.entita) e = vse.find(x => x.id === n.entita) || null;
    if (!e) {
      const kl = typ === 'osoba' ? (x => { const a = (x.nazev.match(/[\p{L}]{2,}/gu) || []).map(kmen), b = (hodnota.match(/[\p{L}]{2,}/gu) || []).map(kmen); return a.length && a.length === b.length && a.every((s, i) => s === b[i]); })
        : typ === 'telefon' ? (x => cislice(x.data.cislo || x.nazev).slice(-9) === cislice(hodnota).slice(-9))
        : typ === 'vozidlo' ? (x => normRz(x.data.rz) === normRz(hodnota))
        : typ === 'ucet' ? (x => normRz(x.data.cislo) === normRz(hodnota))
        : (x => plochy(x.nazev).trim() === plochy(hodnota).trim() || plochy(x.data.adresa || '').trim() === plochy(hodnota).trim());
      e = vse.find(kl) || null;
    }
    if (!e) {
      const pozn = 'Zmíněno v dokumentu „' + dok.nazev + '“.';
      const data = typ === 'osoba' ? { popis: pozn } : typ === 'telefon' ? { cislo: hodnota, popis: pozn } : typ === 'vozidlo' ? { rz: hodnota, popis: pozn }
        : typ === 'ucet' ? { cislo: hodnota, popis: pozn } : { adresa: hodnota, popis: pozn };
      e = await S.uloz({ typ, nazev: hodnota, data }, { nastroj });
      nova = true;
    }
    await vazbaJednou(S, dok.id, e.id, 'tyka_se', { popis: '„' + zkrat(n.text, 80) + '“', nastroj });
    dok = await ulozRozbor(S, dok, R => { R.prenos[n.klic] = e.id; }, o);
    return { entita: e, nova, dok, strety: [] };
  }

  // zvýraznění úryvku (ověřené / tvrzení / rozpor) + důkaz ze spisu → vazba důkaz → dokument (potvrzuje / vyvrací / souvisí)
  async function ulozZnacku(S, dok, z, o = {}) {
    const nastroj = o.nastroj || NASTROJ;
    if (!ZNACKY[z.stav]) throw new Error('Neznámý stav zvýraznění.');
    const R = rozborDokumentu(await S.entita(dok.id) || dok);
    const stara = z.id ? R.znacky.find(x => x.id === z.id) : null;
    const nova = Object.assign({}, stara || {}, z, { id: z.id || 'z' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) });
    if (!nova.dukaz) delete nova.dukaz;
    const typV = nova.stav === 'overeno' ? 'potvrzuje' : nova.stav === 'rozpor' ? 'vyvraci' : 'souvisi';
    if (stara && stara.vazba && (stara.dukaz !== nova.dukaz || stara.stav !== nova.stav)) { try { await S.smaz(stara.vazba, { nastroj }); } catch (e) { /* už není */ } delete nova.vazba; }
    if (nova.dukaz && !nova.vazba) {
      const v = await S.vazba(nova.dukaz, dok.id, typV, { popis: '„' + zkrat(nova.text, 160) + '“ – ' + ZNACKY[nova.stav], nastroj });
      nova.vazba = v.id;
    }
    const d = await ulozRozbor(S, dok, R2 => { R2.znacky = R2.znacky.filter(x => x.id !== nova.id).concat(nova).sort((a, b) => a.od - b.od); }, o);
    return { znacka: nova, dok: d };
  }
  async function smazZnacku(S, dok, id, o = {}) {
    const R = rozborDokumentu(await S.entita(dok.id) || dok), z = R.znacky.find(x => x.id === id);
    if (z && z.vazba) { try { await S.smaz(z.vazba, { nastroj: o.nastroj || NASTROJ }); } catch (e) { /* už není */ } }
    return ulozRozbor(S, dok, R2 => { R2.znacky = R2.znacky.filter(x => x.id !== id); }, o);
  }

  /* ---------- modelový případ 17/2026: výpověď L. Fialy a úřední záznam svědkyně M. Dvořákové (smyšlené) ---------- */
  const MODEL_17 = [
    { id: 'vypoved-fiala', nazev: 'Podání vysvětlení – Lukáš Fiala (16. 11. 2026)', druh: 'výpověď', datum: '2026-11-16', osoba: 'osoba-fiala',
      text: 'Podání vysvětlení – Lukáš Fiala, nar. 3. 5. 1999, bytem Dolní Lhota 54 (všechny osoby a údaje jsou smyšlené).\n' +
        'Sepsáno dne 16. 11. 2026 v 11:20 na služebně, zapsala nprap. Jana Modelová.\n\n' +
        'K věci uvádím, že v noci ze 14. na 15. listopadu jsem celou noc spal doma v Dolní Lhotě a nikam jsem nejel. Večer jsem byl doma sám a díval se na televizi.\n' +
        'Asi ve tři čtvrtě na jedenáct večer mi volal Tomáš Brabec, jestli nepůjdu na pivo, ale odmítl jsem. Spát jsem šel kolem půl dvanácté v noci.\n' +
        'V noci jsem nikomu nevolal, telefon jsem měl celou dobu na nabíječce v kuchyni. Moje číslo je +420 700 222 017.\n' +
        'Brabce znám ze školy. Auto nemám, Brabec jezdí tmavou Octavií 1HL 0017, ale tu noc jsem s ním nebyl.\n' +
        'Romana Kříže znám jen od vidění. V neděli kolem desáté dopoledne mi volal kvůli brigádě v bazaru v Městci. Žádné notebooky jsem neviděl ani neprodával.\n' +
        'Minulý týden jsem mu půjčil 2 000 Kč, vrátil mi je v pátek. Do Horní Lhoty jsem tu noc nejel. Víc k tomu nemám.' },
    { id: 'zaznam-dvorakova', nazev: 'Úřední záznam – svědkyně Marie Dvořáková (15. 11. 2026)', druh: 'úřední záznam', datum: '2026-11-15', osoba: 'osoba-dvorakova',
      text: 'Úřední záznam o podaném vysvětlení – svědkyně Marie Dvořáková, bytem Hlavní 19, Horní Lhota (všechny osoby a údaje jsou smyšlené).\n' +
        'Sepsáno 15. 11. 2026 ve 03:40 na místě, zapsala nprap. Jana Modelová.\n\n' +
        'Svědkyně uvedla: V noci na neděli mě ve 2:10 probudilo tříštění skla. Z okna jsem viděla před prodejnou Elektro Novotný tmavé kombi a dvě postavy, jedna byla vyšší.\n' +
        'Registrační značku jsem nepřečetla, začínala asi na 1H. Asi po pěti minutách auto prudce odjelo směrem ke křižovatce s ulicí K Lesu, slyšela jsem pískání brzd.\n' +
        'Hned potom jsem volala na linku 158. Ráno jsem volala panu Novotnému na číslo +420 700 444 017, aby se přišel podívat.\n' +
        'Tomáše Brabce znám od vidění, jezdí podobným tmavým kombi.' }
  ];
  // založí/otevře modelový spis (SPIS.zalozModelovy) a doplní chybějící dokumenty; nic nezdvojí
  async function zalozModel(S, M, o = {}) {
    const r = await S.zalozModelovy(M, { nastroj: 'modelovy-pripad' });
    await S.otevri(r.pripad);
    let pridano = 0;
    for (const d of MODEL_17) {
      const id = r.pripad + '-dokument-' + d.id;
      if (await S.entita(id)) continue;
      await S.uloz({ id, pripad: r.pripad, typ: 'dokument', nazev: d.nazev, data: { druh: d.druh, datum: d.datum, osoba: r.pripad + '-' + d.osoba, text: d.text,
        sha256: await S.sha256(d.text), popis: 'Smyšlený text k rozboru výpovědi (modelový případ).' } }, { nastroj: o.nastroj || NASTROJ });
      pridano++;
    }
    return { pripad: r.pripad, pridano, dokumenty: MODEL_17.map(d => r.pripad + '-dokument-' + d.id) };
  }

  const ROZBOR = { najdi, vety, kmen, plochy, doplnCasy, TYPY, ZNACKY, platnaHodnota, casUzivatele, popisHodnoty, prazdnyRozbor, rozborDokumentu,
    nalezyDokumentu, rucniNalez, premapuj, strety, prenes, ulozRozbor, ulozZnacku, smazZnacku, zalozModel, MODEL_17, NASTROJ, jeTvrzeni, formatCas, formatDen };
  if (typeof module !== 'undefined' && module.exports) module.exports = ROZBOR;
  else koren.ROZBOR = ROZBOR;
})(typeof window !== 'undefined' ? window : globalThis);
