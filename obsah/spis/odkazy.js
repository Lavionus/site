/* Odkazy mezi nástroji spisu (etapa S4) – „Vyskytuje se v“ na kartě entity a skok do nástroje s vybranou entitou.
   Parametry adresy nástroje (dohoda S4):
     ?entita=<id entity spisu>   – nástroj entitu po načtení zvýrazní / vybere (bez parametru beze změny)
     &stopa=<id stopy>           – Fotodokumentace: vybere značku této stopy ve fotce
     &nacrt=<id náčrtu>          – Náčrt místa činu: otevře tento náčrt (jinak ho najde podle značky / fotopozice / polohy)
     &cas=YYYY-MM-DDTHH:MM[:SS]  – Náčrt místa činu: posuvník času na tento okamžik (S8)
   V rozcestníku se skáče zprávou {otevri: 'obsah/…'} (jako průvodce modelovým případem), samostatně přímo.
   Čisté funkce (adresa, parametr, vyskyty, nacrtyZDat) jdou testovat v node (_test/spis_s4s5s8_test.js). */
(function (koren) {
  'use strict';
  const RE_ID = /^[\w.:-]{1,160}$/, RE_CAS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
  const NASTROJE = {
    evidence_log: { soubor: 'evidence_log.html', nazev: 'Evidenční deník', ikona: '🗂️' },
    fotodokumentace: { soubor: 'fotodokumentace.html', nazev: 'Fotodokumentace', ikona: '📸' },
    scene_sketch: { soubor: 'scene_sketch.html', nazev: 'Náčrt místa činu', ikona: '📐' },
    case_timeline: { soubor: 'case_timeline.html', nazev: 'Časová osa případu', ikona: '🕓' },
    vazby_analyza: { soubor: 'vazby_analyza.html', nazev: 'Analýza vazeb', ikona: '🕸️' }
  };
  // typy entit, které ukazuje graf Analýzy vazeb (V.TYP_ZE_SPISU; události jen s vazbou)
  const V_GRAFU = ['osoba', 'telefon', 'vozidlo', 'misto', 'ucet', 'stopa'];
  const KLIC_NACRTU = 'webapp_scene_sketch';

  function adresa(nastroj, id, extra) {
    const n = NASTROJE[nastroj];
    if (!n) throw new Error('Neznámý nástroj: ' + nastroj);
    const q = new URLSearchParams();
    if (id) q.set('entita', id);
    for (const [k, v] of Object.entries(extra || {})) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
    const t = q.toString();
    return n.soubor + (t ? '?' + t : '');
  }
  // parametry skoku z adresy stránky; neplatné hodnoty se zahodí
  function parametr(search) {
    let q;
    try { q = new URLSearchParams(search === undefined ? koren.location.search : search); } catch (e) { return {}; }
    const r = {};
    for (const k of ['entita', 'stopa', 'nacrt']) { const v = q.get(k); if (v && RE_ID.test(v)) r[k] = v; }
    const c = q.get('cas'); if (c && RE_CAS.test(c)) r.cas = c;
    return r;
  }

  /* náčrty místa činu uložené v tomto prohlížeči: rozpracovaný (KLIC) + archiv (KLIC@id); poskozené přeskočí.
     zaznamy = [[klíč, text], …] (v prohlížeči z localStorage) → [{ id, nazev, obj[], polohy[], aktualni }] */
  function nacrtyZDat(zaznamy) {
    const r = [], videno = new Set();
    const nazev = d => d.nazev || [(d.hlavicka || {}).cj, (d.hlavicka || {}).misto].filter(Boolean).join(' · ') || 'bez názvu';
    const pridej = (id, d, aktualni) => {
      if (!d || !Array.isArray(d.obj) || !id || videno.has(id)) return;
      videno.add(id);
      r.push({ id, nazev: nazev(d), obj: d.obj, polohy: Array.isArray(d.polohy) ? d.polohy : [], aktualni });
    };
    const cti = t => { try { return JSON.parse(t); } catch (e) { return null; } };
    const akt = zaznamy.find(([k]) => k === KLIC_NACRTU);
    if (akt) { const d = cti(akt[1]); if (d) pridej(d.id || 'aktualni', d, true); }
    for (const [k, t] of zaznamy) if (k.startsWith(KLIC_NACRTU + '@')) pridej(k.slice(KLIC_NACRTU.length + 1), cti(t), false);
    return r;
  }
  function nacrty() {
    const z = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k === KLIC_NACRTU || (k && k.startsWith(KLIC_NACRTU + '@'))) z.push([k, localStorage.getItem(k)]);
      }
    } catch (e) { /* bez úložiště */ }
    return nacrtyZDat(z);
  }

  /* Kde všude se entita vyskytuje. kontext = { fotky: [entity foto], udalosti: [entity udalost], vazby: [vazby entity],
     nacrty: [z nacrtyZDat] }. Vrací [{ nastroj, id (entita v cíli), extra, text }] – text jsou data (data-i18n="ne"),
     popis nástroje dodá karta z NASTROJE. Pořadí: deník, fotky, náčrty, osa, vazby. */
  function vyskyty(e, kontext) {
    const k = kontext || {}, out = [], id = e.id, typ = e.typ, d = e.data || {};
    const dej = (nastroj, cil, text, extra) => out.push({ nastroj, id: cil, text: text || '', extra: extra || null });
    if (typ === 'stopa') dej('evidence_log', id, 'záznam stopy č. ' + (d.cislo || '?'));
    if (typ === 'foto') dej('fotodokumentace', id, e.nazev);
    if (typ === 'stopa') for (const f of k.fotky || []) {
      if (f.smazano) continue;
      if (Array.isArray(f.data.anotace) && f.data.anotace.some(a => a && a.druh === 'znacka' && a.stopa === id)) dej('fotodokumentace', f.id, f.nazev, { stopa: id });
    }
    for (const n of k.nacrty || []) {
      if (typ === 'stopa') for (const o of n.obj) if (o && o.t === 'znacka' && o.spis === id) dej('scene_sketch', id, n.nazev + ' – stopa č. ' + o.n, { nacrt: n.id });
      if (typ === 'foto') for (const o of n.obj) if (o && o.t === 'foto' && o.spis === id) dej('scene_sketch', id, n.nazev + ' – fotopozice F' + o.n, { nacrt: n.id });
      if (['udalost', 'osoba', 'vozidlo'].includes(typ)) {
        const p = n.polohy.filter(x => x && (x.udalost === id || x.kdo === id));
        if (p.length) dej('scene_sketch', id, n.nazev + ' – v čase (' + p.length + '× poloha)', { nacrt: n.id });
      }
    }
    // fotka z fotopozice náčrtu, který v tomto prohlížeči není (přišel balíčkem) – aspoň údaj ze spisu
    if (typ === 'foto' && d.fotopozice && d.fotopozice.nacrt && !out.some(x => x.nastroj === 'scene_sketch'))
      dej('scene_sketch', id, (d.fotopozice.nazev || 'náčrt') + ' – fotopozice F' + (d.fotopozice.n || '?'), { nacrt: d.fotopozice.nacrt });
    const udal = (k.udalosti || []).filter(u => !u.smazano);
    if (typ === 'udalost' || (typ === 'stopa' && d.kdy)) dej('case_timeline', id, typ === 'stopa' ? 'důkaz v čase zajištění' : 'událost na ose');
    else if (typ === 'osoba' && udal.some(u => Array.isArray(u.data.osoby) && u.data.osoby.includes(id))) dej('case_timeline', id, 'dráha osoby');
    else if (typ === 'misto' && udal.some(u => u.data.misto === id)) dej('case_timeline', id, 'události na místě');
    if (V_GRAFU.includes(typ) || (typ === 'udalost' && ((k.vazby || []).length || e.zdroj === 'vazby_analyza'))) dej('vazby_analyza', id, 'uzel grafu');
    return out;
  }

  /* ---------- prohlížeč ---------- */
  const obsluhy = {};
  // nástroj umí skok na sebe vyřešit bez znovunačtení: zde('fotodokumentace', p => …) (p = {entita, stopa, …})
  function zde(nastroj, fn) { obsluhy[nastroj] = fn; }
  function otevri(nastroj, id, extra) {
    if (obsluhy[nastroj]) { obsluhy[nastroj](Object.assign({ entita: id }, extra || {})); return; }
    koren.SPIS.otevriStranku(adresa(nastroj, id, extra));
  }
  /* cíl skoku z adresy: načte entitu a přepne aktivní spis na její případ (když je jiný). Vrací { e, p, prepnuto } | null. */
  async function cil() {
    const p = parametr();
    if (!p.entita || !koren.SPIS) return null;
    let e = null;
    try { e = await koren.SPIS.entita(p.entita); } catch (x) { return null; }
    if (!e) return null;
    let prepnuto = false;
    if (koren.SPIS.aktivni() !== e.pripad) { try { await koren.SPIS.otevri(e.pripad); prepnuto = true; } catch (x) { return null; } }
    return { e, p, prepnuto };
  }
  // skripty potřebné jen někdy (kresba anotací v kartě, ukázkové fotky v náčrtu) – postupně, každý jednou
  const nactene = {};
  function nactiSkripty(seznam) {
    return seznam.reduce((pr, src) => pr.then(() => nactene[src] || (nactene[src] = new Promise((ok, ko) => {
      const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => { delete nactene[src]; ko(new Error('Nejde načíst ' + src)); };
      document.head.append(s);
    }))), Promise.resolve());
  }

  const API = { NASTROJE, V_GRAFU, KLIC_NACRTU, adresa, parametr, nacrtyZDat, nacrty, vyskyty, zde, otevri, cil, nactiSkripty };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else koren.SpisOdkazy = API;
})(typeof window !== 'undefined' ? window : globalThis);
