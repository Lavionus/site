/* Terén na telefonu (etapa S6) – jádro bez DOM (test: _test/teren_test.js).
   - rozeberQR: obsah QR štítku stopy z Evidenčního deníku (EvidenceJadro.qrText: „EVID / Spis: / Stopa: / ID: / SHA-256:“),
     i starší štítky bez diakritiky, s BOM, s jinými popisky; ruční zadání = číslo stopy nebo otisk.
   - najdi: párování se stopou aktivního spisu (id → otisk → číslo stopy), kontrola, zda štítek patří k tomuto spisu.
   - predat: zápis předání do stopa.data.predani[] ve formátu Evidenčního deníku {kdy, od, komu, ucel, obal, pozn}
     (obal = neporusen | porusen | nezjisteno) – evidence_log/jadro.js ho čte beze změny (zeSpisu). Deník se na stránku
     nenačítá (byl by sdíleným modulem s vlastním slovníkem i18n) – kontrola řetězce a text štítku jsou tu ve stejném tvaru,
     shodu hlídá _test/teren_test.js.
   - zaznam: rychlý záznam z terénu → foto (blob + SHA-256 přes SPIS.ulozSoubor) a/nebo událost časové osy,
     volitelně vazba „týká se“ na stopu. Poloha jen když ji UI dostalo se souhlasem (data.poloha {lat, lon, presnost}). */
(function (koren) {
  'use strict';

  const NASTROJ = 'teren';
  const RE_ID = /^[\w.:-]{1,160}$/, RE_SHA = /^[0-9a-f]{64}$/i;
  const OBALY = [['neporusen', 'neporušen'], ['porusen', 'porušen'], ['nezjisteno', 'nezjištěno']];
  const UCELY = ['uložení do úschovny', 'převoz', 'odesláno na expertizu', 'zpracování', 'vrácení z expertizy', 'vydání oprávněné osobě'];

  const bezD = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const dvoj = n => String(n).padStart(2, '0');
  // místní čas 'YYYY-MM-DDTHH:MM' (tak jako ostatní časy zadané uživatelem ve spisu)
  const mistniCas = (d = new Date()) => `${d.getFullYear()}-${dvoj(d.getMonth() + 1)}-${dvoj(d.getDate())}T${dvoj(d.getHours())}:${dvoj(d.getMinutes())}`;

  /* ---------- obsah QR štítku ---------- */
  // popisky řádků (bez diakritiky, malými) → pole výsledku
  const POPISKY = [
    [/^(spis|pripad|c\.? ?j\.?|cislo jednaci|spisova znacka)$/, 'spis'],
    [/^(stopa|c\.? ?stopy|cislo stopy|cislo|stopa c\.?)$/, 'stopa'],
    [/^(id|identifikator)$/, 'id'],
    [/^(sha-?256|otisk|hash)$/, 'sha256']
  ];
  function rozeberQR(text) {
    const t = String(text == null ? '' : text).replace(/^\uFEFF/, '').replace(/\uFEFF/g, '').replace(/\r\n?/g, '\n').trim();
    const v = { text: t, evid: false, spis: '', stopa: '', id: '', sha256: '' };
    if (!t) return v;
    const radky = t.split('\n').map(r => r.trim()).filter(Boolean);
    v.evid = /^evid\b/i.test(radky[0] || '');
    let popsane = 0;
    for (const r of radky) {
      const m = /^([^:]{1,30}):\s*(.*)$/.exec(r);
      if (!m) continue;
      const klic = bezD(m[1]), hod = m[2].trim();
      const p = POPISKY.find(x => x[0].test(klic));
      if (!p || !hod) continue;
      if (!v[p[1]]) v[p[1]] = hod.slice(0, 200);   // podvržený štítek s dlouhým textem neshodí zápis do spisu (název ≤ 300)
      popsane++;
    }
    if (v.sha256) v.sha256 = RE_SHA.test(v.sha256) ? v.sha256.toLowerCase() : '';
    if (!popsane && radky.length === 1) {
      // ruční zadání nebo cizí jednoduchý štítek: otisk, jinak číslo stopy
      if (RE_SHA.test(t)) v.sha256 = t.toLowerCase();
      else if (t.length <= 60) v.stopa = t.replace(/^(stopa|c\.|č\.)\s*/i, '').trim() || t;
    }
    v.platny = !!(v.stopa || v.id || v.sha256);
    return v;
  }

  // klíč čísla stopy: „D-05“, „d 5“, „č. 5“, „5“ → „5“; jiné tvary (A12/b) bez diakritiky, mezer a pomlček
  function klicCisla(s) {
    const b = bezD(s).replace(/^(stopa|c\.|c)\s*/, '');
    const m = /^[a-z]{0,3}[\s./-]*0*(\d+)$/.exec(b);
    return m ? m[1] : b.replace(/[\s._/-]+/g, '');
  }

  // patří štítek k případu? Štítek nese „Spis: číslo – název“ (nebo jen číslo či název) – porovnání bez diakritiky
  function stejnySpis(qrSpis, pripad) {
    const q = bezD(qrSpis);
    if (!q || !pripad) return true;   // štítek bez spisu – nic nenamítat
    const varianty = [pripad.cislo, pripad.nazev].map(bezD).filter(Boolean);
    // část textu jen jako celé slovo/číslo a aspoň 4 znaky – jinak by spis „5“ seděl na štítek „Spis: 15/2025“
    const cast = (kde, co) => co.length >= 4 && new RegExp('(^|[^a-z0-9])' + co.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z0-9])').test(kde);
    return varianty.some(x => q === x || cast(q, x) || cast(x, q));
  }

  /* najde stopu spisu ke štítku; stopy = entity typu stopa (nesmazané).
     → { stopa|null, podle: 'id'|'otisk'|'cislo'|null, kandidati: [stopy se stejným číslem], jinySpis } */
  function najdi(qr, stopy, pripad) {
    const vys = { stopa: null, podle: null, kandidati: [], jinySpis: !stejnySpis(qr.spis, pripad) };
    if (!qr || !qr.platny) return vys;
    const s = stopy || [];
    let x = qr.id && s.find(e => e.id === qr.id);
    if (x) return Object.assign(vys, { stopa: x, podle: 'id' });
    x = qr.sha256 && s.find(e => String(e.data.sha256 || '').toLowerCase() === qr.sha256);
    if (x) return Object.assign(vys, { stopa: x, podle: 'otisk' });
    if (qr.stopa) {
      const k = klicCisla(qr.stopa);
      vys.kandidati = s.filter(e => e.data.cislo && klicCisla(e.data.cislo) === k);
      // číslo samo nestačí, když štítek patří k jinému spisu – jen nabídnout
      if (vys.kandidati.length === 1 && !vys.jinySpis) Object.assign(vys, { stopa: vys.kandidati[0], podle: 'cislo' });
    }
    return vys;
  }

  // vstup pro SPIS.uloz – nová stopa z údajů štítku (id štítku se převezme, když je volné, ať další sken najde přesně)
  function stopaZQR(qr, idVolne) {
    const data = { cislo: qr.stopa || undefined, sha256: qr.sha256 || undefined,
      popis: 'Založeno v terénu ze štítku' + (qr.spis ? ' (spis na štítku: ' + qr.spis + ')' : '') + '.' };
    const e = { typ: 'stopa', nazev: qr.stopa ? 'Stopa ' + qr.stopa : 'Stopa ze štítku', data };
    if (qr.id && RE_ID.test(qr.id) && idVolne) e.id = qr.id;
    return e;
  }

  /* ---------- řetězec předávání ---------- */
  const predaniStopy = e => (Array.isArray(e && e.data && e.data.predani) ? e.data.predani.filter(p => p && typeof p === 'object') : []);
  // aktuální držitel: poslední „komu“, jinak kdo zajistil (stejně jako drzitel() v Evidenčním deníku)
  function drzitel(e) {
    const p = predaniStopy(e), z = p[p.length - 1];
    return (z && z.komu) || (e && e.data && e.data.zajistil) || '';
  }
  // upozornění k řetězci (stejná pravidla jako kontrola() Evidenčního deníku) → [{uroven: 'chyba'|'pozor', text}]
  const stejnaOsoba = (a, b) => bezD(a) === bezD(b);
  function kontrola(e, ted) {
    const v = [], add = (uroven, text) => v.push({ uroven, text }), d = (e && e.data) || {};
    const t0 = String(d.kdy || '').slice(0, 16);
    let drz = d.zajistil || '', pred = t0;
    predaniStopy(e).forEach((p, i) => {
      const c = 'předání ' + (i + 1) + ': ', k = String(p.kdy || '').trim().slice(0, 16);
      const chybi = [['kdy', 'čas'], ['od', 'kdo předal'], ['komu', 'komu']].filter(x => !String(p[x[0]] || '').trim()).map(x => x[1]);
      if (chybi.length) add('chyba', c + 'chybí ' + chybi.join(', '));
      if (!String(p.ucel || '').trim()) add('pozor', c + 'chybí účel');
      if (!p.obal || p.obal === 'nezjisteno') add('pozor', c + 'stav obalu/pečeti nezaznamenán');
      if (p.obal === 'porusen') add('chyba', c + 'porušený obal nebo pečeť');
      if (k && t0 && k < t0) add('chyba', c + 'čas je dřív než zajištění stopy');
      else if (k && pred && k < pred) add('chyba', c + 'čas je dřív než předchozí předání');
      if (k && ted && k > ted) add('chyba', c + 'čas je v budoucnosti');
      if (p.od && drz && !stejnaOsoba(p.od, drz)) add('chyba', c + 'předal „' + p.od + '“, ale stopu měl „' + drz + '“ (mezera v řetězci)');
      if (p.od && p.komu && stejnaOsoba(p.od, p.komu)) add('pozor', c + 'předávající a přebírající je tatáž osoba');
      if (p.komu) drz = p.komu;
      if (k) pred = k;
    });
    return v;
  }
  // text QR štítku ve formátu Evidenčního deníku (EvidenceJadro.qrText) – pro zkušební štítek ukázky
  const qrText = (cislo, id, sha256, spis) => ['EVID', 'Spis: ' + (spis || ''), 'Stopa: ' + (cislo || ''), 'ID: ' + id,
    RE_SHA.test(sha256 || '') ? 'SHA-256: ' + sha256.toLowerCase() : ''].filter(Boolean).join('\n');
  // nové předání → { chyby[], predani } (predani = celé nové pole); varování spočítá kontrola() nad výsledkem
  function novePredani(e, vstup) {
    const p = { kdy: String(vstup.kdy || '').trim().slice(0, 16), od: String(vstup.od || '').trim(), komu: String(vstup.komu || '').trim(),
      ucel: String(vstup.ucel || '').trim(), obal: String(vstup.obal || '').trim(), pozn: String(vstup.pozn || '').trim() };
    const chyby = [];
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(p.kdy)) chyby.push('Zadejte datum a čas předání.');
    if (!p.od) chyby.push('Zadejte, kdo stopu předává.');
    if (!p.komu) chyby.push('Zadejte, komu se stopa předává.');
    if (p.obal && !OBALY.some(o => o[0] === p.obal)) chyby.push('Neplatný stav obalu / pečeti.');
    for (const k of ['od', 'komu', 'ucel']) if (p[k].length > 300) chyby.push('Příliš dlouhý text.');
    if (p.pozn.length > 2000) chyby.push('Příliš dlouhá poznámka.');
    return { chyby, predani: [...predaniStopy(e), p] };
  }
  // zápis předání do spisu (jeden zápis entity = jedna položka historie)
  async function predat(S, stopaId, vstup) {
    const e = await S.entita(stopaId);
    if (!e || e.typ !== 'stopa') throw new S.ChybaSpisu('Stopa ve spisu není.');
    if (e.smazano) throw new S.ChybaSpisu('Stopa je ve spisu smazaná – nejdřív ji obnovte.');
    const r = novePredani(e, vstup);
    if (r.chyby.length) throw new S.ChybaSpisu(r.chyby.join(' '), r.chyby);
    return S.uloz({ id: e.id, nazev: e.nazev, data: Object.assign({}, e.data, { predani: r.predani }) }, { nastroj: NASTROJ });
  }

  /* ---------- rychlý záznam ----------
     v = { foto: Blob|File|null, poznamka, kdy (místní čas), poloha?: {lat, lon, presnost}, naOsu: bool, stopa?: id, autor? }
     Fotka jde vždy do fotodokumentace (entita foto se souborem a otiskem); naOsu přidá událost časové osy
     (bez fotky je jediným cílem). stopa → vazba „týká se“ (evidence).  → { foto: entita|null, udalost: entita|null, vazby: [] } */
  function kontrolaZaznamu(v) {
    const ch = [];
    if (!v.foto && !String(v.poznamka || '').trim()) ch.push('Vyfoťte nebo vyberte fotku, nebo napište poznámku.');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(v.kdy || ''))) ch.push('Chybí čas záznamu.');
    if (v.poloha && !(Number.isFinite(v.poloha.lat) && Number.isFinite(v.poloha.lon) && Math.abs(v.poloha.lat) <= 90 && Math.abs(v.poloha.lon) <= 180)) ch.push('Neplatná poloha.');
    if (String(v.poznamka || '').length > 20000) ch.push('Poznámka je příliš dlouhá.');
    return ch;
  }
  const textPolohy = g => g ? g.lat.toFixed(6) + ', ' + g.lon.toFixed(6) + (Number.isFinite(g.presnost) ? ' (±' + Math.round(g.presnost) + ' m)' : '') : '';
  function nazevZPoznamky(t, nahradni) {
    const s = String(t || '').trim().replace(/\s+/g, ' ');
    if (!s) return nahradni;
    return s.length > 90 ? s.slice(0, 88).replace(/\s+\S*$/, '') + '…' : s;
  }
  async function zaznam(S, v) {
    const ch = kontrolaZaznamu(v);
    if (ch.length) throw new S.ChybaSpisu(ch.join(' '), ch);
    const o = { nastroj: NASTROJ }, kdy = String(v.kdy).slice(0, 16), poznamka = String(v.poznamka || '').trim();
    const poloha = v.poloha ? { lat: +v.poloha.lat.toFixed(6), lon: +v.poloha.lon.toFixed(6) } : null;
    if (poloha && Number.isFinite(v.poloha.presnost)) poloha.presnost = Math.round(v.poloha.presnost);
    const vys = { foto: null, udalost: null, vazby: [] };
    if (v.foto) {
      const s = await S.ulozSoubor(v.foto, { nazev: v.foto.name || 'teren-' + kdy.replace(/[^\d]/g, '') + '.jpg' });
      const data = { soubor: s.id, sha256: s.sha256, popis: poznamka || undefined, kdy };
      if (v.autor) data.autor = String(v.autor).trim();
      if (poloha) data.poloha = poloha;
      vys.foto = await S.uloz({ typ: 'foto', nazev: nazevZPoznamky(poznamka, 'Terén ' + kdy.replace('T', ' ')), data }, o);
    }
    if (v.naOsu || !v.foto) {
      const popis = [poznamka, poloha ? 'Poloha GPS: ' + textPolohy(Object.assign({}, poloha)) : '', vys.foto ? 'Fotografie: ' + vys.foto.nazev : ''].filter(Boolean).join('\n');
      const data = { kdy, druh: 'udalost', zdroj: 'záznam z terénu', popis: popis || undefined };
      if (poloha) data.poloha = poloha;
      vys.udalost = await S.uloz({ typ: 'udalost', nazev: nazevZPoznamky(poznamka, 'Záznam z terénu – fotografie'), data }, o);
      if (vys.foto) vys.vazby.push(await S.vazba(vys.foto.id, vys.udalost.id, 'potvrzuje', o));
    }
    if (v.stopa) for (const x of [vys.foto, vys.udalost]) if (x) vys.vazby.push(await S.vazba(x.id, v.stopa, 'tyka_se', o));
    return vys;
  }

  // jméno souboru balíčku
  const jmenoBalicku = (p, d = new Date()) => 'spis-' + (String(p.cislo || p.nazev || 'pripad').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'pripad') + '-' + mistniCas(d).replace(/[:T]/g, '-').slice(0, 16) + '.json';

  const api = { NASTROJ, OBALY, UCELY, bezD, mistniCas, rozeberQR, klicCisla, stejnySpis, najdi, stopaZQR,
    predaniStopy, drzitel, kontrola, qrText, novePredani, predat, kontrolaZaznamu, textPolohy, zaznam, jmenoBalicku };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else koren.TEREN = api;
})(typeof window !== 'undefined' ? window : globalThis);
