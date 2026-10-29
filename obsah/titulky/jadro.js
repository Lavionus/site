/* ============================================================
   titulky/jadro.js – jádro editoru titulků bez DOM.
   Formáty SRT, WebVTT, ASS/SSA, SBV, MicroDVD (SUB), TXT:
   čtení, zápis, detekce formátu a kódování, přečasování,
   kontrola kvality, automatické opravy, dělení/spojování.

   Vnitřní podoba titulku: { id, od, do, text, styl, akter }
     od/do v milisekundách (celá čísla), text s řádky '\n'
     a značkami <i> <b> <u> (jako SRT); ostatní ASS přepisy
     ve složených závorkách {\pos(..)} zůstávají v textu.
   Projekt: { format, titulky[], styly[], info{}, fps }
   Vystaveno jako window.TITULKY a module.exports (node).
   ============================================================ */
(function (koren) {
'use strict';

let dalsiId = 1;
const noveId = () => dalsiId++;
function titulek(od, doo, text, extra) {
  return Object.assign({ id: noveId(), od: Math.round(od), do: Math.round(doo), text: text || '', styl: 'Default', akter: '' }, extra || {});
}

// ---------- čas ----------
/** Text času → ms. Přijímá hh:mm:ss,mmm · hh:mm:ss.mmm · mm:ss.mmm · h:mm:ss.cc */
function casZTextu(s) {
  const m = String(s).trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,:](\d+))?$/);
  if (!m) return NaN;
  const zlomek = m[4] ? Math.round(parseFloat('0.' + m[4]) * 1000) : 0;
  return ((+(m[1] || 0) * 60 + +m[2]) * 60 + +m[3]) * 1000 + zlomek;
}
const dv = (n, d = 2) => String(n).padStart(d, '0');
/** ms → text času; typ: srt | vtt | ass | sbv | lidsky */
function formatCas(ms, typ = 'srt') {
  if (!isFinite(ms)) ms = 0;
  const zap = ms < 0; ms = Math.abs(Math.round(ms));
  if (typ === 'ass') ms = Math.round(ms / 10) * 10;
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, z = ms % 1000;
  let t;
  if (typ === 'ass') t = `${h}:${dv(m)}:${dv(s)}.${dv(Math.floor(z / 10))}`;
  else if (typ === 'sbv') t = `${h}:${dv(m)}:${dv(s)}.${dv(z, 3)}`;
  else if (typ === 'lidsky') t = `${h ? h + ':' + dv(m) : m}:${dv(s)}.${dv(z, 3)}`;
  else t = `${dv(h)}:${dv(m)}:${dv(s)}${typ === 'vtt' ? '.' : ','}${dv(z, 3)}`;
  return (zap ? '-' : '') + t;
}

// ---------- kódování ----------
const CESKA = 'ěščřžýáíéůúňťďóľĺŕäôĚŠČŘŽÝÁÍÉŮÚŇŤĎÓĽĹŔÄÔ';
function skoreCestiny(t) {
  let s = 0;
  for (const ch of t) {
    if (CESKA.includes(ch)) s += 2;
    else if (/[\u0080-\u009f\ufffd]/.test(ch)) s -= 6;          // řídicí znaky = špatné kódování
    else if (/[©®±¶µ¹º¾¼½¤¥ąĄ¸ˇ˘]/.test(ch)) s -= 2;            // v českém textu nepravděpodobné
  }
  return s;
}
/** Bajty → { text, kodovani }. Pozná BOM, UTF-16 bez BOM, platné UTF-8, jinak windows-1250 / ISO-8859-2. */
function dekoduj(bajty, vynutit) {
  const b = bajty instanceof Uint8Array ? bajty : new Uint8Array(bajty);
  const dek = (k, z = 0) => new TextDecoder(k).decode(b.subarray(z));
  if (vynutit && vynutit !== 'auto') {
    const z = vynutit === 'utf-8' && b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF ? 3 : 0;
    return { text: dek(vynutit, z).replace(/^\ufeff/, ''), kodovani: vynutit, bom: z > 0 };
  }
  if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) return { text: dek('utf-8', 3), kodovani: 'utf-8', bom: true };
  if (b[0] === 0xFF && b[1] === 0xFE) return { text: dek('utf-16le', 2), kodovani: 'utf-16le', bom: true };
  if (b[0] === 0xFE && b[1] === 0xFF) return { text: dek('utf-16be', 2), kodovani: 'utf-16be', bom: true };
  // UTF-16 bez BOM: hodně nul na sudých / lichých pozicích
  const n = Math.min(b.length, 4000);
  let nulSude = 0, nulLiche = 0;
  for (let i = 0; i < n; i++) if (b[i] === 0) (i % 2 ? nulLiche++ : nulSude++);
  if (n >= 4 && nulLiche > n * 0.3) return { text: dek('utf-16le'), kodovani: 'utf-16le', bom: false };
  if (n >= 4 && nulSude > n * 0.3) return { text: dek('utf-16be'), kodovani: 'utf-16be', bom: false };
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(b), kodovani: 'utf-8', bom: false };
  } catch (e) { /* není UTF-8 */ }
  const kand = ['windows-1250', 'iso-8859-2', 'windows-1252'].map(k => {
    const t = dek(k);
    return { text: t, kodovani: k, s: skoreCestiny(t) - (k === 'windows-1252' ? 3 : 0) };
  });
  kand.sort((a, c) => c.s - a.s);
  return { text: kand[0].text, kodovani: kand[0].kodovani, bom: false };
}
/** Text → bajty UTF-8 (volitelně s BOM). */
function zakoduj(text, bom) {
  const t = new TextEncoder().encode(text);
  if (!bom) return t;
  const v = new Uint8Array(t.length + 3);
  v.set([0xEF, 0xBB, 0xBF]); v.set(t, 3);
  return v;
}

// ---------- pomocné úpravy textu ----------
const normRadky = t => String(t).replace(/^\ufeff/, '').replace(/\r\n?/g, '\n');
/** Viditelný text (bez značek a ASS přepisů). */
function viditelny(text) {
  return String(text).replace(/\{\\[^}]*\}/g, '').replace(/<\/?[a-z][^>]*>/gi, '');
}
function bezZnacek(text) { return viditelny(text).replace(/[ \t]+\n/g, '\n').trim(); }
/** Počet znaků za sekundu (bez zalomení a značek). */
function cps(t) {
  const sek = (t.do - t.od) / 1000;
  const zn = viditelny(t.text).replace(/\n/g, '').length;
  return sek > 0 ? zn / sek : (zn ? Infinity : 0);
}
/** Zarovnání podle {\anN} na začátku textu (1–9 jako numerická klávesnice), jinak null. */
function zarovnaniZTextu(text) {
  const m = String(text).match(/\{[^}]*\\an([1-9])[^}]*\}/);
  return m ? +m[1] : null;
}
/** Rozklad textu na řádky úseků se stylem – pro vykreslení na plátno. */
function useky(text) {
  const st = { i: false, b: false, u: false };
  const radky = [[]];
  const t = String(text).replace(/\{\\[^}]*\}/g, '');
  const re = /<(\/?)([ibu])\b[^>]*>|<\/?[a-z][^>]*>|\n|[^<\n]+|</gi;
  let m;
  while ((m = re.exec(t))) {
    const s = m[0];
    if (m[2]) st[m[2].toLowerCase()] = !m[1];
    else if (s === '\n') radky.push([]);
    else if (s[0] === '<' && s.length > 1) continue;  // jiná značka (font…) se ignoruje
    else radky[radky.length - 1].push({ text: s, i: st.i, b: st.b, u: st.u });
  }
  return radky;
}
const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Bezpečné HTML pro náhled: vše escapováno, povolené jen <i> <b> <u>. */
function htmlNahled(text) {
  return useky(text).map(r => r.map(u => {
    let h = escHtml(u.text);
    if (u.u) h = '<u>' + h + '</u>';
    if (u.b) h = '<b>' + h + '</b>';
    if (u.i) h = '<i>' + h + '</i>';
    return h;
  }).join('')).join('<br>');
}

// ---------- detekce formátu ----------
function detekujFormat(text, nazev) {
  const t = normRadky(text).trimStart();
  if (/^WEBVTT/.test(t)) return 'vtt';
  if (/^\[Script Info\]/im.test(t) || /^Dialogue\s*:/m.test(t)) return /^\[V4 Styles\]/im.test(t) ? 'ssa' : 'ass';
  if (/^\{\d+\}\{\d*\}/m.test(t)) return 'sub';
  if (/\d+:\d\d:\d\d[,.]\d+\s*-->\s*\d+:\d\d:\d\d[,.]\d+/.test(t)) return 'srt';
  if (/^\d+:\d\d:\d\d\.\d+,\d+:\d\d:\d\d\.\d+\s*$/m.test(t)) return 'sbv';
  if (/\d\d:\d\d\.\d{3}\s*-->/.test(t)) return 'vtt';
  const p = (nazev || '').toLowerCase().match(/\.(\w+)$/);
  if (p && FORMATY[p[1]]) return p[1];
  return 'txt';
}

// ---------- SRT ----------
const RE_SRT_CAS = /^\s*(\d+:\d{1,2}:\d{1,2}(?:[.,:]\d+)?)\s*-+>\s*(\d+:\d{1,2}:\d{1,2}(?:[.,:]\d+)?)/;
function ctiSrt(text) {
  const r = normRadky(text).split('\n');
  const out = [];
  let akt = null;
  for (let i = 0; i < r.length; i++) {
    const m = r[i].match(RE_SRT_CAS);
    if (m) {
      if (akt) out.push(akt);
      akt = titulek(casZTextu(m[1]), casZTextu(m[2]), '');
      akt._r = [];
      continue;
    }
    if (!akt) continue;
    // číslo, za kterým hned následuje časový řádek, je index dalšího titulku
    if (/^\s*\d+\s*$/.test(r[i]) && i + 1 < r.length && RE_SRT_CAS.test(r[i + 1])) continue;
    akt._r.push(r[i]);
  }
  if (akt) out.push(akt);
  for (const t of out) {
    while (t._r.length && !t._r[t._r.length - 1].trim()) t._r.pop();
    while (t._r.length && !t._r[0].trim()) t._r.shift();
    t.text = t._r.map(x => x.replace(/\s+$/, '')).join('\n');
    delete t._r;
  }
  return { titulky: out };
}
function zapisSrt(p, mo) {
  return p.titulky.map((t, i) =>
    `${i + 1}\n${formatCas(t.od)} --> ${formatCas(t.do)}\n${prepisyJenAn(t.text)}\n`).join('\n');
}
/** Pro SRT: ponechat jen {\anN}, ostatní ASS přepisy pryč. */
function prepisyJenAn(text) {
  return String(text).replace(/\{\\[^}]*\}/g, b => { const m = b.match(/\\an([1-9])/); return m ? `{\\an${m[1]}}` : ''; });
}
const bezPrepisu = text => String(text).replace(/\{\\[^}]*\}/g, '');
const jenIbu = text => String(text).replace(/<(?!\/?[ibu]>)\/?[a-z][^>]*>/gi, '');

// ---------- WebVTT ----------
const ENT = { amp: '&', lt: '<', gt: '>', nbsp: '\u00a0', lrm: '\u200e', rlm: '\u200f', quot: '"', apos: "'" };
function ctiVtt(text) {
  const bloky = normRadky(text).split(/\n[ \t]*\n/);
  const out = [];
  for (let k = 0; k < bloky.length; k++) {
    const r = bloky[k].split('\n');
    if (k === 0 && /^WEBVTT/.test(r[0])) continue;
    if (/^(NOTE|STYLE|REGION)\b/.test(r[0])) continue;
    let j = r.findIndex(x => x.includes('-->'));
    if (j < 0 || j > 1) continue;
    const m = r[j].match(/^\s*([\d:.,]+)\s*-->\s*([\d:.,]+)(.*)$/);
    if (!m) continue;
    let txt = r.slice(j + 1).join('\n');
    let akter = '';
    const v = txt.match(/<v(?:\.[\w.-]+)?\s+([^>]+)>/);
    if (v) akter = v[1].trim();
    txt = txt.replace(/<\/?(?:c|v|lang|ruby|rt)(?:[.\s][^>]*)?>/g, '').replace(/<\d[\d:.]*>/g, '')
      .replace(/&(amp|lt|gt|nbsp|lrm|rlm|quot|apos);/g, (_, e) => ENT[e]);
    if (/\bline:\s*(0|[0-9]%|1\d%)/.test(m[3]) && !/\\an\d/.test(txt)) txt = '{\\an8}' + txt;
    const t = titulek(casZTextu(m[1]), casZTextu(m[2]), txt.replace(/\s+$/, ''), { akter });
    if (j === 1 && r[0].trim()) t.vttId = r[0].trim();
    out.push(t);
  }
  return { titulky: out };
}
function zapisVtt(p) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/<(?!\/?[ibu]>)/g, '&lt;');
  return 'WEBVTT\n\n' + p.titulky.map(t => {
    const an = zarovnaniZTextu(t.text);
    const nast = an && an >= 7 ? ' line:0' : an && an >= 4 && an <= 6 ? ' line:50%' : '';
    let txt = esc(jenIbu(bezPrepisu(t.text)));
    if (t.akter) txt = `<v ${t.akter.replace(/[<>]/g, '')}>` + txt;
    return `${formatCas(t.od, 'vtt')} --> ${formatCas(t.do, 'vtt')}${nast}\n${txt}\n`;
  }).join('\n');
}

// ---------- SBV (YouTube) ----------
function ctiSbv(text) {
  const out = [];
  for (const blok of normRadky(text).split(/\n[ \t]*\n/)) {
    const r = blok.split('\n');
    const m = r[0].match(/^\s*([\d:.]+)\s*,\s*([\d:.]+)\s*$/);
    if (!m) continue;
    out.push(titulek(casZTextu(m[1]), casZTextu(m[2]), r.slice(1).join('\n').replace(/\s+$/, '')));
  }
  return { titulky: out };
}
function zapisSbv(p) {
  return p.titulky.map(t => `${formatCas(t.od, 'sbv')},${formatCas(t.do, 'sbv')}\n${bezZnacek(t.text)}\n`).join('\n');
}

// ---------- MicroDVD ----------
function ctiSub(text, mo) {
  let fps = (mo && mo.fps) || 0, fpsZeSouboru = false;
  const out = [];
  for (const radek of normRadky(text).split('\n')) {
    const m = radek.match(/^\{(\d+)\}\{(\d*)\}(.*)$/);
    if (!m) continue;
    if (!out.length && +m[1] <= 1 && /^\s*\d+(?:[.,]\d+)?\s*$/.test(m[3])) {   // {1}{1}23.976 = snímková frekvence
      fps = parseFloat(m[3].replace(',', '.')); fpsZeSouboru = true; continue;
    }
    out.push({ f1: +m[1], f2: m[2] === '' ? null : +m[2], txt: m[3] });
  }
  if (!fps) fps = 25;
  const titulky = out.map(o => {
    let vse = { i: false, b: false, u: false };
    const radky = o.txt.split('|').map((r, k) => {
      const st = { i: vse.i, b: vse.b, u: vse.u };
      r = r.replace(/\{([yY]):([^}]*)\}/g, (_, y, h) => {
        const v = h.toLowerCase();
        for (const z of 'ibu') if (v.includes(z)) { st[z] = true; if (y === 'Y') vse[z] = true; }
        return '';
      }).replace(/\{[a-zA-Z]:[^}]*\}/g, '');
      if (/^\//.test(r)) { r = r.slice(1); st.i = true; }    // „/“ na začátku = kurzíva (rozšíření)
      for (const z of 'ubi') if (st[z]) r = `<${z}>${r}</${z}>`;
      return r;
    });
    const od = o.f1 * 1000 / fps;
    const doo = o.f2 == null ? od + 2000 : o.f2 * 1000 / fps;
    return titulek(od, doo, radky.join('\n'));
  });
  return { titulky, fps, fpsZeSouboru };
}
function zapisSub(p, mo) {
  const fps = (mo && mo.fps) || p.fps || 25;
  const snimek = ms => Math.round(ms * fps / 1000);
  const radky = p.titulky.map(t => {
    const txt = bezPrepisu(t.text).split('\n').map(r => {
      const cela = /^<i>(.*)<\/i>$/.exec(r.trim());
      return cela && !/<\/?i>/.test(cela[1]) ? '{y:i}' + jenText(cela[1]) : jenText(r);
    }).join('|');
    return `{${snimek(t.od)}}{${snimek(t.do)}}${txt}`;
  });
  if (mo && mo.fpsRadek) radky.unshift(`{1}{1}${+fps.toFixed(3)}`);
  return radky.join('\n') + '\n';
}
const jenText = s => String(s).replace(/<\/?[a-z][^>]*>/gi, '');

// ---------- ASS / SSA ----------
const ASS_STYL_FORMAT = 'Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding';
const SSA_STYL_FORMAT = 'Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, TertiaryColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, AlphaLevel, Encoding';
function vychoziStyl(playResY = 1080) {
  return { nazev: 'Default', font: 'Arial', velikost: Math.round(playResY * 0.055), barva: '#ffffff', obrys: '#000000',
    obrysSirka: Math.max(1, Math.round(playResY / 360)), tucne: false, kurziva: false, zarovnani: 2, okrajV: Math.round(playResY * 0.04),
    okrajL: Math.round(playResY * 0.02), okrajP: Math.round(playResY * 0.02) };
}
/** &HAABBGGRR / &HBBGGRR / desítkové BGR → { barva '#rrggbb', alfa 0–1 (neprůhlednost) } */
function assBarva(s) {
  s = String(s || '').trim();
  let n;
  if (/^&H/i.test(s)) n = parseInt(s.replace(/^&H/i, '').replace(/&$/, ''), 16);
  else n = parseInt(s, 10);
  if (!isFinite(n)) return { barva: '#ffffff', alfa: 1 };
  n >>>= 0;
  const r = n & 255, g = (n >>> 8) & 255, b = (n >>> 16) & 255, a = (n >>> 24) & 255;
  return { barva: '#' + [r, g, b].map(x => dv(x.toString(16))).join(''), alfa: 1 - a / 255 };
}
function barvaAss(hex) {
  const h = String(hex || '#ffffff').replace('#', '').padEnd(6, '0');
  return '&H00' + (h.slice(4, 6) + h.slice(2, 4) + h.slice(0, 2)).toUpperCase();
}
const SSA_NA_AN = { 1: 1, 2: 2, 3: 3, 5: 7, 6: 8, 7: 9, 9: 4, 10: 5, 11: 6 };
const AN_NA_SSA = { 1: 1, 2: 2, 3: 3, 7: 5, 8: 6, 9: 7, 4: 9, 5: 10, 6: 11 };
function rozdelCsv(radek, n) {   // posledních sloupců může obsahovat čárky (Text)
  const c = radek.split(',');
  if (c.length > n) c.splice(n - 1, c.length, c.slice(n - 1).join(','));
  return c.map(x => x.trim());
}
/** ASS text události → vnitřní text (\N, {\i1} → <i> …). */
function assNaText(s) {
  return s.replace(/\\N/g, '\n').replace(/\\n/g, '\n').replace(/\\h/g, '\u00a0').replace(/\{([^}]*)\}/g, (blok, obsah) => {
    if (!obsah.includes('\\')) return '';            // komentář {…}
    let html = '';
    const zbytek = obsah.replace(/\\([ibu])([01])(?![0-9])/g, (_, z, v) => { html += v === '1' ? `<${z}>` : `</${z}>`; return ''; });
    return html + (zbytek.replace(/\s/g, '') ? `{${zbytek}}` : '');
  });
}
function textNaAss(s) {
  return jenIbu(String(s)).replace(/<([ibu])>/g, '{\\$11}').replace(/<\/([ibu])>/g, '{\\$10}')
    .replace(/\}\{/g, '').replace(/\n/g, '\\N');
}
function ctiAss(text) {
  const r = normRadky(text).split('\n');
  let sekce = '', fmtStyl = null, fmtUd = null, ssa = false;
  const info = {}, styly = [], titulky = [];
  for (const radek of r) {
    const s = radek.trim();
    if (!s || s.startsWith(';')) continue;
    const h = s.match(/^\[(.+)\]$/);
    if (h) { sekce = h[1].toLowerCase(); if (sekce === 'v4 styles') ssa = true; continue; }
    const kv = s.match(/^([^:]+):\s*(.*)$/);
    if (!kv) continue;
    const klic = kv[1].trim(), hod = kv[2];
    if (sekce === 'script info') { info[klic] = hod.trim(); continue; }
    if (sekce.startsWith('v4')) {
      if (klic === 'Format') fmtStyl = hod.split(',').map(x => x.trim().toLowerCase());
      else if (klic === 'Style') {
        const f = fmtStyl || (ssa ? SSA_STYL_FORMAT : ASS_STYL_FORMAT).toLowerCase().split(', ');
        const c = rozdelCsv(hod, f.length), g = k => c[f.indexOf(k)];
        const pr = assBarva(g('primarycolour')), ob = assBarva(g('outlinecolour') || g('tertiarycolour') || g('backcolour'));
        let al = +g('alignment') || 2;
        if (ssa) al = SSA_NA_AN[al] || 2;
        styly.push({ nazev: g('name') || 'Default', font: g('fontname') || 'Arial', velikost: +g('fontsize') || 20,
          barva: pr.barva, obrys: ob.barva, obrysSirka: +g('outline') || 0, tucne: g('bold') !== undefined && +g('bold') !== 0,
          kurziva: g('italic') !== undefined && +g('italic') !== 0, podklad: +g('borderstyle') === 3, zarovnani: al, okrajV: +g('marginv') || 0,
          okrajL: +g('marginl') || 0, okrajP: +g('marginr') || 0 });
      }
      continue;
    }
    if (sekce === 'events') {
      if (klic === 'Format') { fmtUd = hod.split(',').map(x => x.trim().toLowerCase()); continue; }
      if (klic !== 'Dialogue') continue;
      const f = fmtUd || (ssa ? 'marked,start,end,style,name,marginl,marginr,marginv,effect,text' : 'layer,start,end,style,name,marginl,marginr,marginv,effect,text').split(',');
      const c = rozdelCsv(hod, f.length), g = k => c[f.indexOf(k)];
      const t = titulek(casZTextu(g('start')), casZTextu(g('end')), assNaText(g('text') || ''), { styl: g('style') || 'Default', akter: g('name') || '' });
      if (g('layer') && +g('layer')) t.vrstva = +g('layer');
      if (g('effect')) t.efekt = g('effect');
      titulky.push(t);
    }
  }
  const prY = +info.PlayResY || (+info.PlayResX ? Math.round(+info.PlayResX * 3 / 4) : 288);
  if (!styly.length) styly.push(vychoziStyl(prY));
  return { titulky, styly, info };
}
function zapisAss(p, mo, ssa) {
  const info = Object.assign({}, p.info || {});
  const prY = +info.PlayResY || 1080;
  const styly = p.styly && p.styly.length ? p.styly : [vychoziStyl(prY)];
  const hlav = ['[Script Info]', '; Vytvořeno v Editoru titulků (Lavionus/site)',
    `Title: ${info.Title || ''}`, `ScriptType: ${ssa ? 'v4.00' : 'v4.00+'}`];
  if (!ssa) hlav.push('WrapStyle: 0', 'ScaledBorderAndShadow: yes');
  hlav.push(`PlayResX: ${+info.PlayResX || Math.round(prY * 16 / 9)}`, `PlayResY: ${prY}`);
  for (const k in info) if (!['Title', 'ScriptType', 'WrapStyle', 'ScaledBorderAndShadow', 'PlayResX', 'PlayResY'].includes(k)) hlav.push(`${k}: ${info[k]}`);
  const b = x => x ? -1 : 0;
  const st = styly.map(s => ssa
    ? `Style: ${s.nazev},${s.font},${s.velikost},${barvaAss(s.barva)},&H0000FFFF,${barvaAss(s.obrys)},&H00000000,${b(s.tucne)},${b(s.kurziva)},${s.podklad ? 3 : 1},${s.obrysSirka},0,${AN_NA_SSA[s.zarovnani] || 2},${s.okrajL || 10},${s.okrajP || 10},${s.okrajV},0,1`
    : `Style: ${s.nazev},${s.font},${s.velikost},${barvaAss(s.barva)},&H000000FF,${barvaAss(s.obrys)},&H80000000,${b(s.tucne)},${b(s.kurziva)},0,0,100,100,0,0,${s.podklad ? 3 : 1},${s.obrysSirka},0,${s.zarovnani},${s.okrajL || 10},${s.okrajP || 10},${s.okrajV},1`);
  const ud = p.titulky.map(t => {
    const c = [formatCas(t.od, 'ass'), formatCas(t.do, 'ass'), t.styl || 'Default', (t.akter || '').replace(/,/g, ' '), '0', '0', '0', t.efekt || '', textNaAss(t.text)];
    return `Dialogue: ${ssa ? 'Marked=0' : (t.vrstva || 0)},${c.join(',')}`;
  });
  return [hlav.join('\n'), '',
    ssa ? '[V4 Styles]' : '[V4+ Styles]', `Format: ${ssa ? SSA_STYL_FORMAT : ASS_STYL_FORMAT}`, ...st, '',
    '[Events]', `Format: ${ssa ? 'Marked' : 'Layer'}, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`, ...ud, ''].join('\n');
}

// ---------- TXT ----------
/** Prostý text: odstavce (oddělené prázdným řádkem) → titulky s odhadnutými časy podle délky. */
function ctiTxt(text, mo) {
  const zac = (mo && mo.zacatek) || 0, mezera = 200;
  let cas = zac;
  const titulky = normRadky(text).split(/\n[ \t]*\n/).map(x => x.trim()).filter(Boolean).map(o => {
    const delka = Math.min(6000, Math.max(1500, viditelny(o).length * 65));
    const t = titulek(cas, cas + delka, o);
    cas += delka + mezera;
    return t;
  });
  return { titulky, odhadCasu: true };
}
const zapisTxt = p => p.titulky.map(t => bezZnacek(t.text)).join('\n\n') + '\n';

const FORMATY = {
  srt: { nazev: 'SubRip (SRT)', pripona: 'srt', cti: ctiSrt, zapis: zapisSrt },
  vtt: { nazev: 'WebVTT', pripona: 'vtt', cti: ctiVtt, zapis: zapisVtt },
  ass: { nazev: 'Advanced SubStation (ASS)', pripona: 'ass', cti: ctiAss, zapis: (p, mo) => zapisAss(p, mo, false) },
  ssa: { nazev: 'SubStation Alpha (SSA)', pripona: 'ssa', cti: ctiAss, zapis: (p, mo) => zapisAss(p, mo, true) },
  sbv: { nazev: 'YouTube SBV', pripona: 'sbv', cti: ctiSbv, zapis: zapisSbv },
  sub: { nazev: 'MicroDVD (SUB, snímky)', pripona: 'sub', cti: ctiSub, zapis: zapisSub },
  txt: { nazev: 'Prostý text (TXT)', pripona: 'txt', cti: ctiTxt, zapis: zapisTxt },
};

/** Text souboru → projekt. format = klíč FORMATY nebo prázdné (detekce). */
function nacti(text, format, mo) {
  format = format || detekujFormat(text, mo && mo.nazev);
  const f = FORMATY[format];
  if (!f) throw new Error('Neznámý formát: ' + format);
  const v = f.cti(text, mo || {});
  const p = {
    format, titulky: v.titulky.filter(t => isFinite(t.od) && isFinite(t.do)),
    styly: v.styly || [vychoziStyl(1080)],
    info: v.info || { PlayResX: 1920, PlayResY: 1080 },
    fps: v.fps || (mo && mo.fps) || 25,
    fpsZeSouboru: !!v.fpsZeSouboru, odhadCasu: !!v.odhadCasu,
  };
  serad(p.titulky);
  return p;
}
/** Projekt → text souboru (bez kódování). mo: { fps, fpsRadek, crlf } */
function zapis(p, format, mo) {
  const f = FORMATY[format];
  if (!f) throw new Error('Neznámý formát: ' + format);
  let t = f.zapis(p, mo || {});
  if (mo && mo.crlf) t = t.replace(/\r?\n/g, '\r\n');
  return t;
}

// ---------- přečasování ----------
const vybrane = (titulky, vyber) => vyber ? titulky.filter(t => vyber.has(t.id)) : titulky;
function posun(titulky, ms, vyber) {
  for (const t of vybrane(titulky, vyber)) {
    const d = t.do - t.od;
    t.od = Math.max(0, Math.round(t.od + ms));
    t.do = Math.max(t.od, Math.round(t.od + d));
  }
  return titulky;
}
/** Převod mezi snímkovými frekvencemi: titulky pro video z → video na (např. 23,976 → 25 zkrátí časy). */
function zmenFps(titulky, z, na, vyber) {
  const k = z / na;
  for (const t of vybrane(titulky, vyber)) { t.od = Math.round(t.od * k); t.do = Math.round(t.do * k); }
  return titulky;
}
/** Lineární synchronizace podle dvou bodů: čas a1 má být b1, a2 má být b2. */
function synchronizuj(titulky, a1, b1, a2, b2, vyber) {
  if (a1 === a2) throw new Error('Body synchronizace musí mít různé časy.');
  const k = (b2 - b1) / (a2 - a1);
  const f = x => Math.max(0, Math.round(b1 + (x - a1) * k));
  for (const t of vybrane(titulky, vyber)) { t.od = f(t.od); t.do = f(t.do); }
  return titulky;
}
function serad(titulky) { return titulky.sort((a, b) => a.od - b.od || a.do - b.do); }

// ---------- kontrola kvality ----------
const LIMITY = { minDelka: 800, maxDelka: 7000, maxCps: 17, maxRadek: 42, maxRadku: 2, minMezera: 80 };
const POPIS = {
  prazdny: 'prázdný text', zaporna: 'konec není po začátku', prekryv: 'překrývá se s dalším',
  kratky: 'příliš krátký', dlouhy: 'příliš dlouhý', cps: 'rychlé čtení (CPS)', radek: 'dlouhý řádek',
  radku: 'moc řádků', mezera: 'malá mezera k dalšímu',
};
/** Pro každý titulek (v pořadí pole) seznam problémů { kod, chyba: bool, text }. */
function kontrola(titulky, limity) {
  const L = Object.assign({}, LIMITY, limity || {});
  return titulky.map((t, i) => {
    const pr = [], d = t.do - t.od, dalsi = titulky[i + 1];
    const add = (kod, chyba, det) => pr.push({ kod, chyba, text: POPIS[kod] + (det ? ` (${det})` : '') });
    const vid = viditelny(t.text).trim();
    if (!vid) add('prazdny', true);
    if (d <= 0) add('zaporna', true);
    if (dalsi && dalsi.od < t.do) add('prekryv', true, `${t.do - dalsi.od} ms`);
    else if (dalsi && dalsi.od - t.do < L.minMezera) add('mezera', false, `${dalsi.od - t.do} ms`);
    if (d > 0 && d < L.minDelka) add('kratky', false, `${d} ms`);
    if (d > L.maxDelka) add('dlouhy', false, `${(d / 1000).toFixed(1)} s`);
    const c = cps(t);
    if (vid && d > 0 && c > L.maxCps) add('cps', false, c.toFixed(1));
    const radky = viditelny(t.text).split('\n');
    const nejdelsi = Math.max(...radky.map(r => r.length));
    if (nejdelsi > L.maxRadek) add('radek', false, `${nejdelsi} zn.`);
    if (radky.length > L.maxRadku) add('radku', false, String(radky.length));
    return pr;
  });
}
function souhrnKontroly(vysledky) {
  const s = {};
  for (const pr of vysledky) for (const p of pr) s[p.kod] = (s[p.kod] || 0) + 1;
  return s;
}

// ---------- úpravy textu a automatické opravy ----------
/** Zalomí text nejvýše na 2 vyvážené řádky, pokud je řádek delší než max (nebo jsou víc než 2 řádky). */
function zalomit(text, max = 42) {
  const an = (String(text).match(/^\{\\[^}]*\}/) || [''])[0];
  const telo = String(text).slice(an.length);
  const radky = viditelny(telo).split('\n');
  if (radky.length <= 2 && radky.every(r => r.length <= max)) return text;
  const s = telo.replace(/\s*\n\s*/g, ' ').trim();
  const celkem = viditelny(s).length;
  if (celkem <= max) return an + s;
  let nej = -1, skore = Infinity;
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== ' ') continue;
    const l1 = viditelny(s.slice(0, i)).length, l2 = celkem - l1 - 1;
    let sk = Math.max(l1, l2) + Math.abs(l1 - l2) * 0.15 + (Math.max(l1, l2) > max ? 100 : 0);
    if (/[.,!?;:…]$/.test(viditelny(s.slice(0, i)))) sk -= 4;               // lépe za interpunkcí
    if (/^[-–]/.test(viditelny(s.slice(i + 1)))) sk -= 3;                    // pomlčka dialogu na nový řádek
    if (/\s(a|i|v|k|s|z|o|u|ve|ke|se|ze)$/i.test(' ' + viditelny(s.slice(0, i)))) sk += 6;   // předložka nezůstane na konci
    if (sk < skore) { skore = sk; nej = i; }
  }
  return nej < 0 ? an + s : an + s.slice(0, nej) + '\n' + s.slice(nej + 1);
}
/** Dorovná neuzavřené <i><b><u> v části textu. */
function vyvazZnacky(a, b) {
  for (const z of 'ibu') {
    const ot = (a.match(new RegExp(`<${z}>`, 'g')) || []).length, za = (a.match(new RegExp(`</${z}>`, 'g')) || []).length;
    if (ot > za) { a += `</${z}>`; b = `<${z}>` + b; }
  }
  return [a, b];
}
/** Rozdělí titulek na dva. cas (ms) v rozsahu titulku určí místo řezu, jinak poměrem délky textu. */
function rozdel(t, cas) {
  const an = (t.text.match(/^\{\\an\d\}/) || [''])[0];
  const telo = t.text.slice(an.length);
  let a, b;
  const radky = telo.split('\n');
  if (radky.length > 1) {
    const pul = Math.ceil(radky.length / 2);
    a = radky.slice(0, pul).join('\n'); b = radky.slice(pul).join('\n');
  } else {
    const st = telo.length / 2;
    let nej = -1;
    for (let i = 0; i < telo.length; i++) if (telo[i] === ' ' && (nej < 0 || Math.abs(i - st) < Math.abs(nej - st))) nej = i;
    if (nej < 0) { a = telo; b = ''; } else { a = telo.slice(0, nej); b = telo.slice(nej + 1); }
  }
  [a, b] = vyvazZnacky(a, b);
  let rez = cas;
  if (!(rez > t.od && rez < t.do)) {
    const la = viditelny(a).length, lb = viditelny(b).length;
    rez = t.od + Math.round((t.do - t.od) * (la + lb ? la / (la + lb) : 0.5));
  }
  const t1 = Object.assign({}, t, { id: noveId(), do: Math.round(rez), text: an + a });
  const t2 = Object.assign({}, t, { id: noveId(), od: Math.round(rez), text: an + b });
  return [t1, t2];
}
function spoj(a, b) {
  const bt = b.text.replace(/^\{\\an\d\}/, '');
  return Object.assign({}, a, { id: noveId(), od: Math.min(a.od, b.od), do: Math.max(a.do, b.do), text: (a.text + '\n' + bt).trim() });
}
/** Automatické opravy. vol: { zalomit, mezery, kratke, prazdne, mezeryText, seradit }. Vrací počty změn. */
function opravy(titulky, vol, limity) {
  const L = Object.assign({}, LIMITY, limity || {});
  const n = { zalomit: 0, mezery: 0, kratke: 0, prazdne: 0, mezeryText: 0, seradit: 0 };
  if (vol.seradit) {
    const pred = titulky.map(t => t.id).join();
    serad(titulky);
    if (titulky.map(t => t.id).join() !== pred) n.seradit = 1;
  }
  if (vol.prazdne) {
    for (let i = titulky.length - 1; i >= 0; i--) if (!viditelny(titulky[i].text).trim()) { titulky.splice(i, 1); n.prazdne++; }
  }
  if (vol.mezeryText) for (const t of titulky) {
    const nove = t.text.split('\n').map(r => r.replace(/[ \t\u00a0]{2,}/g, ' ').trim()).filter((r, i, a) => r || a.length === 1).join('\n');
    if (nove !== t.text) { t.text = nove; n.mezeryText++; }
  }
  if (vol.zalomit) for (const t of titulky) {
    const nove = zalomit(t.text, L.maxRadek);
    if (nove !== t.text) { t.text = nove; n.zalomit++; }
  }
  if (vol.kratke) for (let i = 0; i < titulky.length; i++) {
    const t = titulky[i], d = titulky[i + 1];
    const chci = Math.max(L.minDelka, Math.ceil(viditelny(t.text).replace(/\n/g, '').length / L.maxCps * 1000));
    if (t.do - t.od >= chci) continue;
    const strop = d ? d.od - L.minMezera : Infinity;
    const novy = Math.min(t.od + chci, strop);
    if (novy > t.do) { t.do = novy; n.kratke++; }
  }
  if (vol.mezery) for (let i = 0; i + 1 < titulky.length; i++) {
    const t = titulky[i], d = titulky[i + 1];
    if (d.od - t.do >= L.minMezera) continue;
    const novy = d.od - L.minMezera;
    if (novy > t.od) { t.do = novy; n.mezery++; }
    else if (t.do > d.od) { t.do = Math.max(t.od, d.od); n.mezery++; }
  }
  return n;
}

/** Titulky viditelné v čase ms (pole musí být seřazené podle od). */
function aktivni(titulky, ms) {
  let lo = 0, hi = titulky.length - 1, k = -1;
  while (lo <= hi) { const s = (lo + hi) >> 1; if (titulky[s].od <= ms) { k = s; lo = s + 1; } else hi = s - 1; }
  const out = [];
  for (let i = k; i >= 0 && i > k - 40; i--) if (titulky[i].do > ms) out.unshift(titulky[i]);
  return out;
}

const API = {
  FORMATY, LIMITY, POPIS, casZTextu, formatCas, dekoduj, zakoduj, detekujFormat, nacti, zapis,
  posun, zmenFps, synchronizuj, serad, kontrola, souhrnKontroly, opravy, zalomit, rozdel, spoj,
  viditelny, bezZnacek, cps, useky, htmlNahled, zarovnaniZTextu, aktivni, titulek, vychoziStyl,
  assBarva, barvaAss, assNaText, textNaAss,
  nastavId: n => { dalsiId = Math.max(dalsiId, n); },
};
if (typeof module !== 'undefined' && module.exports) module.exports = API;
koren.TITULKY = API;
})(typeof window !== 'undefined' ? window : globalThis);
