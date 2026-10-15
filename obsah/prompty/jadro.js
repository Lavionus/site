/* ============================================================
   prompty/jadro.js – čistá logika databanky promptů (bez DOM).
   Proměnné, hledání, řazení, import/export JSON · Markdown · CSV,
   slučování při importu, historie verzí.
   V prohlížeči se vystaví jako window.PROMPTY_JADRO, v node přes
   module.exports (testy _test/prompty_test.js).
   ============================================================ */
(function (koren) {
  'use strict';

  const FORMAT = 'databanka-promptu';
  const VERZE_FORMATU = 1;
  const MAX_VERZI = 20;

  function noveId() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  /* ---------- proměnné {{jméno}} / {{jméno|výchozí}} ---------- */
  const RE_PROM = /\{\{\s*([^{}|]+?)\s*(?:\|([^{}]*))?\}\}/g;

  function promenne(text) {
    const vys = [], videno = new Set();
    String(text || '').replace(RE_PROM, (m, jm, vych) => {
      const k = jm.trim();
      if (!videno.has(k)) { videno.add(k); vys.push({ jmeno: k, vychozi: (vych || '').trim() }); }
      return m;
    });
    return vys;
  }

  function dosad(text, hodnoty) {
    hodnoty = hodnoty || {};
    return String(text || '').replace(RE_PROM, (m, jm, vych) => {
      const k = jm.trim();
      const h = hodnoty[k];
      if (h != null && h !== '') return h;
      if (vych != null && vych.trim() !== '') return vych.trim();
      return m;
    });
  }

  /* Hrubý odhad tokenů: ~4 znaky na token u angličtiny, čeština je
     „dražší" (diakritika, delší slova) → bereme 3,2 znaku. */
  function odhadTokenu(text) {
    const s = String(text || '');
    if (!s) return 0;
    const dia = (s.match(/[^\x00-\x7f]/g) || []).length / s.length;
    return Math.ceil(s.length / (dia > 0.03 ? 3.2 : 4));
  }

  function slov(text) {
    const m = String(text || '').trim().match(/\S+/g);
    return m ? m.length : 0;
  }

  /* ---------- normalizace záznamu ---------- */
  function cistyStitky(v) {
    const pole = Array.isArray(v) ? v : String(v || '').split(/[,;]/);
    const vys = [];
    for (const t of pole) {
      const s = String(t).trim().replace(/^#/, '');
      if (s && !vys.some(x => norm(x) === norm(s))) vys.push(s);
    }
    return vys;
  }

  function normalizuj(p) {
    p = p || {};
    const ted = Date.now();
    const cislo = (v, d) => (Number.isFinite(+v) && v !== '' && v != null ? +v : d);
    const cas = v => {
      if (v == null || v === '') return null;
      if (Number.isFinite(+v)) return +v;
      const t = Date.parse(v);
      return Number.isFinite(t) ? t : null;
    };
    const zal = cas(p.vytvoreno);
    return {
      id: String(p.id || noveId()),
      nazev: String(p.nazev || p.title || p.name || '').trim() || 'Bez názvu',
      text: String(p.text != null ? p.text : (p.prompt != null ? p.prompt : (p.content || ''))),
      kategorie: String(p.kategorie || p.category || '').trim(),
      stitky: cistyStitky(p.stitky || p.tags),
      model: String(p.model || '').trim(),
      poznamka: String(p.poznamka || p.notes || p.description || ''),
      oblibeny: !!(p.oblibeny || p.favorite),
      hodnoceni: Math.max(0, Math.min(5, Math.round(cislo(p.hodnoceni != null ? p.hodnoceni : p.rating, 0)))),
      pouziti: Math.max(0, Math.round(cislo(p.pouziti, 0))),
      vytvoreno: zal || ted,
      upraveno: cas(p.upraveno) || zal || ted,
      naposledy: cas(p.naposledy),
      verze: Array.isArray(p.verze) ? p.verze.filter(v => v && typeof v.text === 'string').slice(-MAX_VERZI) : [],
    };
  }

  /* Uloží úpravu; předchozí obsah (název + text) jde do historie verzí. */
  function uprav(puv, zmeny) {
    const novy = normalizuj(Object.assign({}, puv, zmeny, { id: puv.id, vytvoreno: puv.vytvoreno }));
    if (puv.text !== novy.text || puv.nazev !== novy.nazev) {
      novy.verze = (puv.verze || []).concat([{ cas: puv.upraveno, nazev: puv.nazev, text: puv.text }]).slice(-MAX_VERZI);
    } else {
      novy.verze = (puv.verze || []).slice();
    }
    novy.upraveno = Date.now();
    return novy;
  }

  /* ---------- hledání a řazení ---------- */
  /* Dotaz: slova se ANDují; #štítek, kat:xxx, model:xxx filtrují pole;
     „-slovo" vylučuje. */
  function rozeberDotaz(q) {
    const tok = String(q || '').match(/"[^"]*"|\S+/g) || [];
    const d = { slova: [], ne: [], stitky: [], kat: [], model: [] };
    for (let t of tok) {
      let neg = false;
      if (t[0] === '-' && t.length > 1) { neg = true; t = t.slice(1); }
      t = t.replace(/^"|"$/g, '');
      if (!t) continue;
      if (t[0] === '#' && t.length > 1) d.stitky.push(norm(t.slice(1)));
      else if (/^kat:/i.test(t)) d.kat.push(norm(t.slice(4)));
      else if (/^model:/i.test(t)) d.model.push(norm(t.slice(6)));
      else (neg ? d.ne : d.slova).push(norm(t));
    }
    return d;
  }

  function odpovida(p, dotaz) {
    const d = typeof dotaz === 'string' ? rozeberDotaz(dotaz) : dotaz;
    const st = p.stitky.map(norm);
    if (d.stitky.some(s => !st.some(x => x.includes(s)))) return false;
    if (d.kat.some(k => !norm(p.kategorie).includes(k))) return false;
    if (d.model.some(k => !norm(p.model).includes(k))) return false;
    const vse = norm([p.nazev, p.text, p.kategorie, p.model, p.poznamka, p.stitky.join(' ')].join('\n'));
    if (d.slova.some(s => !vse.includes(s))) return false;
    if (d.ne.some(s => vse.includes(s))) return false;
    return true;
  }

  function filtruj(seznam, f) {
    f = f || {};
    const d = rozeberDotaz(f.dotaz);
    return seznam.filter(p =>
      (!f.kategorie || p.kategorie === f.kategorie) &&
      (!f.stitek || p.stitky.includes(f.stitek)) &&
      (!f.oblibene || p.oblibeny) &&
      odpovida(p, d));
  }

  const KOLACE = typeof Intl !== 'undefined' ? new Intl.Collator('cs', { sensitivity: 'base', numeric: true }) : null;
  const porovnejText = (a, b) => (KOLACE ? KOLACE.compare(a, b) : a.localeCompare(b));

  function serad(seznam, podle) {
    const s = seznam.slice();
    const k = {
      upraveno: (a, b) => b.upraveno - a.upraveno,
      vytvoreno: (a, b) => b.vytvoreno - a.vytvoreno,
      nazev: (a, b) => porovnejText(a.nazev, b.nazev),
      pouziti: (a, b) => b.pouziti - a.pouziti || (b.naposledy || 0) - (a.naposledy || 0),
      naposledy: (a, b) => (b.naposledy || 0) - (a.naposledy || 0),
      hodnoceni: (a, b) => b.hodnoceni - a.hodnoceni || b.pouziti - a.pouziti,
    }[podle] || ((a, b) => b.upraveno - a.upraveno);
    // oblíbené vždy nahoře
    s.sort((a, b) => (b.oblibeny - a.oblibeny) || k(a, b));
    return s;
  }

  function prehled(seznam) {
    const kat = new Map(), st = new Map();
    for (const p of seznam) {
      if (p.kategorie) kat.set(p.kategorie, (kat.get(p.kategorie) || 0) + 1);
      for (const t of p.stitky) st.set(t, (st.get(t) || 0) + 1);
    }
    const pole = m => [...m].sort((a, b) => b[1] - a[1] || porovnejText(a[0], b[0]));
    return { kategorie: pole(kat), stitky: pole(st) };
  }

  /* ---------- export ---------- */
  function exportJSON(seznam, sVerzemi) {
    return JSON.stringify({
      format: FORMAT,
      verze: VERZE_FORMATU,
      exportovano: new Date().toISOString(),
      pocet: seznam.length,
      prompty: seznam.map(p => {
        const o = Object.assign({}, p);
        if (!sVerzemi) delete o.verze;
        return o;
      }),
    }, null, 2);
  }

  function datum(t) {
    return t ? new Date(t).toISOString().slice(0, 10) : '';
  }

  /* Markdown: každý prompt = sekce „## název", metadata jako odrážky,
     text v ohrazeném bloku. Plot je delší než nejdelší řada ` v textu,
     takže se dá spolehlivě načíst zpět. */
  function exportMD(seznam) {
    const r = ['# Databanka promptů', '', `Exportováno ${datum(Date.now())} · ${seznam.length} promptů`, ''];
    for (const p of seznam) {
      r.push('## ' + p.nazev.replace(/\n/g, ' '), '');
      if (p.kategorie) r.push('- Kategorie: ' + p.kategorie);
      if (p.stitky.length) r.push('- Štítky: ' + p.stitky.join(', '));
      if (p.model) r.push('- Model: ' + p.model);
      if (p.hodnoceni) r.push('- Hodnocení: ' + p.hodnoceni + '/5');
      if (p.oblibeny) r.push('- Oblíbený: ano');
      if (p.poznamka) r.push('- Poznámka: ' + p.poznamka.replace(/\n/g, ' '));
      const nej = Math.max(0, ...(p.text.match(/`+/g) || []).map(x => x.length));
      const plot = '`'.repeat(Math.max(3, nej + 1));
      r.push('', plot + 'text', p.text, plot, '');
    }
    return r.join('\n');
  }

  const SLOUPCE = ['nazev', 'text', 'kategorie', 'stitky', 'model', 'poznamka', 'oblibeny', 'hodnoceni', 'pouziti', 'vytvoreno', 'upraveno'];

  function csvBunka(v) {
    const s = String(v == null ? '' : v);
    return /[",;\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function exportCSV(seznam) {
    const r = [SLOUPCE.join(',')];
    for (const p of seznam) {
      r.push(SLOUPCE.map(k => {
        let v = p[k];
        if (k === 'stitky') v = v.join(', ');
        else if (k === 'oblibeny') v = v ? 1 : 0;
        else if (k === 'vytvoreno' || k === 'upraveno') v = new Date(v).toISOString();
        return csvBunka(v);
      }).join(','));
    }
    return '﻿' + r.join('\r\n');   // BOM kvůli Excelu a diakritice
  }

  /* ---------- import ---------- */
  function parseCSV(text) {
    text = String(text).replace(/^﻿/, '');
    const prvni = text.split(/\r?\n/, 1)[0] || '';
    const odd = (prvni.match(/;/g) || []).length > (prvni.match(/,/g) || []).length ? ';'
      : (prvni.includes('\t') && !prvni.includes(',') ? '\t' : ',');
    const radky = [];
    let radek = [], bunka = '', uv = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (uv) {
        if (c === '"') { if (text[i + 1] === '"') { bunka += '"'; i++; } else uv = false; }
        else bunka += c;
      } else if (c === '"' && bunka === '') uv = true;
      else if (c === odd) { radek.push(bunka); bunka = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        radek.push(bunka); radky.push(radek); radek = []; bunka = '';
      } else bunka += c;
    }
    if (bunka !== '' || radek.length) { radek.push(bunka); radky.push(radek); }
    return radky.filter(r => r.some(b => b.trim() !== ''));
  }

  const ALIASY = {
    nazev: ['nazev', 'název', 'title', 'name', 'act', 'jmeno'],
    text: ['text', 'prompt', 'content', 'obsah', 'body'],
    kategorie: ['kategorie', 'category', 'kat'],
    stitky: ['stitky', 'štítky', 'tags', 'tagy'],
    model: ['model'],
    poznamka: ['poznamka', 'poznámka', 'notes', 'note', 'description', 'popis'],
    oblibeny: ['oblibeny', 'oblíbený', 'favorite', 'favourite'],
    hodnoceni: ['hodnoceni', 'hodnocení', 'rating'],
    pouziti: ['pouziti', 'použití', 'uses'],
    vytvoreno: ['vytvoreno', 'vytvořeno', 'created'],
    upraveno: ['upraveno', 'updated', 'modified'],
  };

  function importCSV(text) {
    const r = parseCSV(text);
    if (r.length < 2) return [];
    const hl = r[0].map(h => norm(h.trim()));
    const mapa = {};
    for (const [pole, al] of Object.entries(ALIASY)) {
      const i = hl.findIndex(h => al.map(norm).includes(h));
      if (i >= 0) mapa[pole] = i;
    }
    if (mapa.text == null) {
      // bez hlavičky s textem: jeden sloupec = text, dva = název + text
      const bezHlavicky = r.map(x => x.length >= 2 ? { nazev: x[0], text: x[1] } : { text: x[0] });
      return bezHlavicky.filter(p => String(p.text).trim()).map(normalizuj);
    }
    return r.slice(1).map(rad => {
      const o = {};
      for (const [pole, i] of Object.entries(mapa)) o[pole] = rad[i];
      if (o.oblibeny != null) o.oblibeny = /^(1|ano|true|yes|x)$/i.test(String(o.oblibeny).trim());
      return o;
    }).filter(o => String(o.text || '').trim()).map(normalizuj);
  }

  function importMD(text) {
    const radky = String(text).replace(/\r\n?/g, '\n').split('\n');
    const vys = [];
    let akt = null;
    for (let i = 0; i < radky.length; i++) {
      const l = radky[i];
      const nad = l.match(/^##\s+(.+)$/);
      if (nad) {
        if (akt) vys.push(akt);
        akt = { nazev: nad[1].trim(), text: '', _volny: [] };
        continue;
      }
      if (!akt) continue;
      const plot = l.match(/^(`{3,}|~{3,})/);
      if (plot && !akt._mamText) {
        const zav = plot[1];
        const telo = [];
        i++;
        const jeKonec = r => { const m = r.match(/^(`{3,}|~{3,})\s*$/); return m && m[1][0] === zav[0] && m[1].length >= zav.length; };
        while (i < radky.length && !jeKonec(radky[i])) {
          telo.push(radky[i]); i++;
        }
        akt.text = telo.join('\n');
        akt._mamText = true;
        continue;
      }
      const meta = l.match(/^[-*]\s+([^:]+):\s*(.*)$/);
      if (meta && !akt._mamText) {
        const k = norm(meta[1].trim()), v = meta[2].trim();
        if (k === 'kategorie' || k === 'category') akt.kategorie = v;
        else if (k === 'stitky' || k === 'tags') akt.stitky = v;
        else if (k === 'model') akt.model = v;
        else if (k === 'hodnoceni' || k === 'rating') akt.hodnoceni = parseInt(v, 10) || 0;
        else if (k === 'oblibeny' || k === 'favorite') akt.oblibeny = /^(ano|yes|true|1)$/i.test(v);
        else if (k === 'poznamka' || k === 'notes') akt.poznamka = v;
        else akt._volny.push(l);
        continue;
      }
      if (!akt._mamText) akt._volny.push(l);
    }
    if (akt) vys.push(akt);
    return vys.map(p => {
      if (!p._mamText) p.text = p._volny.join('\n').trim();
      delete p._volny; delete p._mamText;
      return p;
    }).filter(p => p.text.trim()).map(normalizuj);
  }

  /* Rozpozná formát podle obsahu (a přípony, je-li známa). */
  function importuj(text, nazevSouboru) {
    const s = String(text || '').replace(/^﻿/, '');
    const pr = (nazevSouboru || '').toLowerCase().split('.').pop();
    const t = s.trim();
    if (pr === 'json' || t[0] === '{' || t[0] === '[') {
      let data;
      try { data = JSON.parse(t); } catch (e) { throw new Error('Neplatný JSON: ' + e.message); }
      let pole = Array.isArray(data) ? data
        : Array.isArray(data.prompty) ? data.prompty
        : Array.isArray(data.prompts) ? data.prompts
        : Array.isArray(data.snippets) ? data.snippets
        : null;
      if (!pole) throw new Error('V JSONu chybí seznam promptů (pole nebo klíč „prompty").');
      pole = pole.map(x => typeof x === 'string' ? { text: x } : x)
        .map(x => (x && x.obsah != null && x.text == null) ? Object.assign({}, x, { text: x.obsah }) : x);
      return { format: 'JSON', prompty: pole.filter(x => x && String(x.text || x.prompt || x.content || '').trim()).map(normalizuj) };
    }
    if (pr === 'csv' || pr === 'tsv') return { format: 'CSV', prompty: importCSV(s) };
    if (pr === 'md' || pr === 'markdown' || /^##\s/m.test(s)) return { format: 'Markdown', prompty: importMD(s) };
    if (pr === 'txt' || !pr) {
      // prostý text: prompty oddělené řádkem „---" (nebo jediný prompt)
      const kusy = s.split(/\n-{3,}\s*\n/).map(x => x.trim()).filter(Boolean);
      return {
        format: 'text',
        prompty: kusy.map(k => normalizuj({ nazev: k.split('\n')[0].replace(/^#+\s*/, '').slice(0, 70), text: k })),
      };
    }
    return { format: 'CSV', prompty: importCSV(s) };
  }

  /* Sloučení importu do databanky.
     rezim: 'pridat' (vše jako nové), 'preskocit' (shodný text/id přeskočí),
            'prepsat' (shodné id nebo text přepíše importovaným). */
  function klicTextu(p) { return norm(p.text).replace(/\s+/g, ' ').trim(); }

  function sluc(stavajici, nove, rezim) {
    const vys = stavajici.slice();
    const podleId = new Map(vys.map((p, i) => [p.id, i]));
    const podleTextu = new Map(vys.map((p, i) => [klicTextu(p), i]));
    const stat = { pridano: 0, preskoceno: 0, prepsano: 0 };
    for (const p0 of nove) {
      const p = normalizuj(p0);
      let i = podleId.has(p.id) ? podleId.get(p.id) : podleTextu.get(klicTextu(p));
      if (i != null && rezim === 'preskocit') { stat.preskoceno++; continue; }
      if (i != null && rezim === 'prepsat') {
        const st = vys[i];
        vys[i] = Object.assign({}, p, { id: st.id, verze: st.text !== p.text ? (st.verze || []).concat([{ cas: st.upraveno, nazev: st.nazev, text: st.text }]).slice(-MAX_VERZI) : st.verze });
        stat.prepsano++;
        continue;
      }
      if (podleId.has(p.id)) p.id = noveId();
      vys.push(p);
      podleId.set(p.id, vys.length - 1);
      podleTextu.set(klicTextu(p), vys.length - 1);
      stat.pridano++;
    }
    return { prompty: vys, stat };
  }

  /* Odkazy pro otevření promptu v chatu (text jde v URL; u dlouhých
     promptů se raději jen zkopíruje). */
  const CHATY = [
    { id: 'claude', nazev: 'Claude', url: q => 'https://claude.ai/new?q=' + encodeURIComponent(q) },
    { id: 'chatgpt', nazev: 'ChatGPT', url: q => 'https://chatgpt.com/?q=' + encodeURIComponent(q) },
    { id: 'perplexity', nazev: 'Perplexity', url: q => 'https://www.perplexity.ai/search?q=' + encodeURIComponent(q) },
  ];
  const MAX_URL_TEXT = 6000;

  const api = {
    FORMAT, MAX_VERZI, CHATY, MAX_URL_TEXT,
    noveId, norm, promenne, dosad, odhadTokenu, slov, normalizuj, uprav,
    rozeberDotaz, odpovida, filtruj, serad, prehled,
    exportJSON, exportMD, exportCSV, parseCSV, importCSV, importMD, importuj, sluc, datum,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else koren.PROMPTY_JADRO = api;
})(typeof window !== 'undefined' ? window : globalThis);
