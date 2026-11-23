/* Atlas Kronik – odemykání faktů podle přečteného místa (čisté funkce, bez DOM; test _test/kroniky_atlas_test.js).
   Smlouva: docs/plany/KronikyAtlas_PLAN.md.
   Token místa: "0" = známo předem, "K5:13" = kniha V, kapitola se souborem 13_*.md, "P:kavyl" = povídka NN_kavyl.md.
   Pozice čtenáře = { hranice, povidky }: kapitoly s pořadím < hranice jsou známé, povidky = Set slugů. */
(function (koren) {
  'use strict';

  // "13_unik.md" → "13", "06a_mezihra.md" → "06a"
  const predpona = soubor => String(soubor || '').split('_')[0];
  // "04_kavyl.md" → "kavyl"
  const slugPovidky = soubor => String(soubor || '').replace(/\.md$/, '').replace(/^\d+[a-z]?_/, '');

  // kapitoly = [{t: "K1:00", …}] v pořadí ságy → {token: pořadí}
  function poradi(kapitoly) {
    const p = {};
    kapitoly.forEach((k, i) => { p[k.t] = i; });
    return p;
  }

  // token kapitoly ze stavu čtečky (id knihy "kniha5", soubor "13_unik.md")
  const tokenCtecky = (idKnihy, soubor) => {
    const m = /^kniha(\d+)$/.exec(idKnihy || '');
    return m ? `K${m[1]}:${predpona(soubor)}` : null;
  };

  /* Pozice ze stavu čteček (obsah localStorage webapp_kroniky a webapp_kniha_povidky_kronik, už rozebraný JSON).
     Kapitola je známá, když je přečtená (✓), nebo když čtenář stojí v některé pozdější kapitole.
     Povídka je známá, když je přečtená nebo rozečtená. */
  function poziceZCtecky(stavKronik, stavPovidek, por) {
    let hranice = 0;
    const s = stavKronik || {};
    for (const [idKnihy, p] of Object.entries(s.pozice || {})) {
      const i = por[tokenCtecky(idKnihy, p && p.soubor)];
      if (i !== undefined) hranice = Math.max(hranice, i);
    }
    for (const [idKnihy, soubory] of Object.entries(s.precteno || {})) {
      for (const [soubor, ano] of Object.entries(soubory || {})) {
        const i = por[tokenCtecky(idKnihy, soubor)];
        if (ano && i !== undefined) hranice = Math.max(hranice, i + 1);
      }
    }
    const povidky = new Set(), sp = stavPovidek || {};
    for (const p of Object.values(sp.pozice || {})) if (p && p.soubor) povidky.add(slugPovidky(p.soubor));
    for (const soubory of Object.values(sp.precteno || {}))
      for (const [soubor, ano] of Object.entries(soubory || {})) if (ano) povidky.add(slugPovidky(soubor));
    return { hranice, povidky };
  }

  /* Ruční volba (webapp_kroniky_atlas): {rezim: "ctecka"|"rucne"|"vse", do: "K5:13", povidky: ["kavyl"]}.
     "do" = poslední přečtená kapitola včetně. */
  function pozice(volba, stavKronik, stavPovidek, por, slugyPovidek) {
    const v = volba || {};
    if (v.rezim === 'vse') return { hranice: Infinity, povidky: new Set(slugyPovidek || []) };
    if (v.rezim === 'rucne') {
      const i = por[v.do];
      return { hranice: i === undefined ? 0 : i + 1, povidky: new Set(v.povidky || []) };
    }
    return poziceZCtecky(stavKronik, stavPovidek, por);
  }

  function znamo(token, poz, por) {
    if (token === '0' || token == null) return true;
    if (token.startsWith('P:')) return poz.povidky.has(token.slice(2));
    const i = por[token];
    return i !== undefined && i < poz.hranice;
  }

  // fakt se ukazuje od „od“ a (má-li „do“) jen před „do“ – vyvrácené domněnky postav
  const viditelny = (f, poz, por) => !!f && znamo(f.od, poz, por) && !(f.do && znamo(f.do, poz, por));
  // ještě zamčený (ne prošlý) – kvůli neutrální poznámce „Dalším čtením se dozvíš víc“
  const zamceny = (f, poz, por) => !!f && !znamo(f.od, poz, por);

  const SEZNAMY = ['jmena', 'fakta', 'vystupuje'];
  const vsechnaFakta = p => [...SEZNAMY.flatMap(k => Array.isArray(p[k]) ? p[k] : []), p.taxon, p.role].filter(Boolean);
  const SBIRKY = ['populace', 'postavy', 'mista', 'osa', 'pojmy'];

  /* Vrátí kopii dat jen s tím, co čtenář na pozici zná. Zamčené položky vůbec nejsou (ani název).
     Položka dostane `vic: true`, když má ještě zamčená fakta (bez počtu). */
  function filtruj(data, poz) {
    const por = poradi(data.kapitoly);
    const vid = f => viditelny(f, poz, por);
    const ven = { knihy: data.knihy, kapitoly: data.kapitoly, povidky: data.povidky };
    // Položka je vidět, když je známé její „od“, NEBO kterýkoli její fakt z přečtené povídky
    // (povídku lze číst dřív než knihu, kde položka začíná). Vrací místo, odkud ji čtenář zná, jinak null.
    const odkud = p => {
      if (znamo(p.od, poz, por)) return p.od;
      const f = vsechnaFakta(p).find(x => typeof x.od === 'string' && x.od.startsWith('P:') && znamo(x.od, poz, por));
      return f ? f.od : null;
    };
    const viditelneId = new Set();
    for (const sb of SBIRKY) for (const p of data[sb] || []) if (odkud(p)) viditelneId.add(p.id);
    // kniha je celá přečtená, když je známá její poslední kapitola
    const konecKnihy = {};
    data.kapitoly.forEach(k => { konecKnihy[k.k] = k.t; });
    const kniha = t => t.startsWith('P:') ? t : +t.slice(1).split(':')[0];
    /* Knihy místa jen z odemčeného: knihy a povídky odemčených faktů (a místa, odkud ho čtenář zná)
       + ze zdrojového pole „knihy“ jen celé přečtené knihy a přečtené povídky. Celé pole by prozradilo
       pozdější návraty místa (např. „kniha VII“) i povídky. Čísla vzestupně, povídky na konci. */
    const knihyMista = (p, q) => {
      const s = new Set([q.od, ...q.fakta.map(f => f.od)].filter(t => t && t !== '0').map(kniha));
      for (const k of p.knihy || []) if (typeof k === 'string' ? znamo(k, poz, por) : znamo(konecKnihy[k], poz, por)) s.add(k);
      return [...s].sort((a, b) => (typeof a === 'string') - (typeof b === 'string') || (a < b ? -1 : a > b ? 1 : 0));
    };
    for (const sb of SBIRKY) {
      ven[sb] = (data[sb] || []).filter(p => viditelneId.has(p.id)).map(p => {
        const q = { ...p, od: odkud(p) };   // pozdější „od“ položky se neprozradí ani odkazem
        let vic = false;
        for (const k of SEZNAMY) if (Array.isArray(p[k])) {
          q[k] = p[k].filter(vid);
          vic = vic || p[k].some(f => zamceny(f, poz, por));
        }
        // další obrázky: každý se odemyká vlastním „od“ (obrázek je spoiler stejně jako text)
        if (Array.isArray(p.obrazky)) {
          q.obrazky = p.obrazky.filter(vid);
          vic = vic || p.obrazky.some(f => zamceny(f, poz, por));
        }
        for (const k of ['taxon', 'role']) if (p[k]) {
          q[k] = vid(p[k]) ? p[k] : null;
          vic = vic || zamceny(p[k], poz, por);
        }
        if (Array.isArray(p.vazby)) {
          // populace/pojmy: ["id"]; postavy: [{id, vztah, od}]
          q.vazby = p.vazby.filter(v => typeof v === 'string' ? viditelneId.has(v) : (viditelneId.has(v.id) && vid(v)));
          vic = vic || p.vazby.some(v => typeof v !== 'string' && viditelneId.has(v.id) && zamceny(v, poz, por));
        }
        if (sb === 'mista') q.knihy = knihyMista(p, { ...q, fakta: q.fakta || [] });
        // postava známá zatím jen z povídky patří k povídce – skupina „kniha V“ by prozradila, kde se objeví
        if (sb === 'postavy' && q.od !== p.od) q.kniha = q.od;
        q.vic = vic;
        return q;
      });
    }
    return ven;
  }

  // "K5:13" → "kniha V, 13. Únik" (nebo název povídky); "0" → ""
  const RIM = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  function popisMista(token, data) {
    if (!token || token === '0') return '';
    if (token.startsWith('P:')) {
      const p = (data.povidky || []).find(x => x.slug === token.slice(2));
      return p ? `povídka ${p.nazev}` : '';
    }
    const k = data.kapitoly.find(x => x.t === token);
    return k ? `kniha ${RIM[k.k] || k.k}, ${k.n}` : '';
  }

  // adresa čtečky na místo (čtečka umí ?kniha=N&kap=<soubor bez .md>)
  function odkazMista(token, data) {
    if (!token || token === '0') return null;
    if (token.startsWith('P:')) {
      const p = (data.povidky || []).find(x => x.slug === token.slice(2));
      return p ? `kniha_povidky_kronik.html?kniha=${p.kniha || 1}&kap=${encodeURIComponent(p.s)}` : null;
    }
    const k = data.kapitoly.find(x => x.t === token);
    return k ? `kroniky.html?kniha=${k.k}&kap=${encodeURIComponent(k.s)}` : null;
  }

  // Popis pozice pro lištu: „kniha V, 12. Studna hvězd“ = poslední známá kapitola
  function popisPozice(poz, data) {
    if (poz.hranice === Infinity) return 'vše';
    if (poz.hranice <= 0) return 'nic';
    const k = data.kapitoly[Math.min(poz.hranice, data.kapitoly.length) - 1];
    return popisMista(k.t, data);
  }

  const api = { predpona, slugPovidky, poradi, tokenCtecky, poziceZCtecky, pozice, znamo, viditelny, filtruj, popisMista, odkazMista, popisPozice, RIM };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else koren.ATLAS_ODEMYK = api;
})(typeof window !== 'undefined' ? window : this);
