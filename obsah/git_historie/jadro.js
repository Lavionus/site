/* ============================================================
   git_historie/jadro.js – výpočetní jádro vizualizátoru historie Gitu.
   Bez DOM, testuje se v node (_test/git_historie_test.js).

   Obsah:
   - načtení dat: vlastní JSON z export_git_json.py, rychlý textový formát
     (jednořádkový git log), surová odpověď GitHub API /commits
   - topologické řazení (děti před rodiči, shoda řešená datem commitu)
   - rozvržení DAG do pruhů (lanes) – hrany nikdy nevedou „nahoru“,
     rodiče mimo načtená data se značí, nikdy se nedomýšlejí
   - dosažitelnost z větve, filtry, vyhledávání
   - statistiky: aktivita v čase, den × hodina, autoři, vývoj souborů
   - pomocné funkce GitHub API (Link, X-RateLimit-*, chybové hlášky)
   ============================================================ */
(function () {
  'use strict';

  const RE_SHA = /^[0-9a-f]{4,64}$/i;
  const DEN_MS = 86400000;

  /* ---------- čas ---------- */

  /** ISO 8601 → { ms, tz } ; tz = posun v minutách (null, pokud v řetězci není). */
  function parsujIso(s) {
    if (typeof s !== 'string' || !s) return { ms: NaN, tz: null };
    const ms = Date.parse(s);
    const m = /([+-])(\d\d):?(\d\d)$/.exec(s);
    let tz = null;
    if (m) tz = (m[1] === '-' ? -1 : 1) * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
    else if (/Z$/i.test(s)) tz = 0;
    return { ms, tz };
  }

  /** Posun (min), o který se čas posune do zvoleného pásma: 'autor' | 'prohlizec' | 'utc'. */
  function posunPasma(c, rezim) {
    if (rezim === 'utc') return 0;
    if (rezim === 'autor' && c.tz !== null && c.tz !== undefined) return c.tz;
    return -new Date(c.ms).getTimezoneOffset();
  }

  /** { den: 0 = pondělí … 6 = neděle, hodina: 0–23, datum: 'RRRR-MM-DD' } v pásmu. */
  function mistniCas(c, rezim) {
    const d = new Date(c.ms + posunPasma(c, rezim) * 60000);
    return {
      den: (d.getUTCDay() + 6) % 7,
      hodina: d.getUTCHours(),
      datum: d.toISOString().slice(0, 10),
      posunutyMs: d.getTime()
    };
  }

  /* ---------- normalizace ---------- */

  function txt(v) { return typeof v === 'string' ? v : (v === null || v === undefined ? '' : String(v)); }

  function normSoubory(s) {
    if (!Array.isArray(s)) return null;
    const out = [];
    for (const f of s) {
      if (Array.isArray(f)) {
        if (typeof f[0] !== 'string') continue;
        out.push({ cesta: f[0], plus: Number.isFinite(f[1]) ? f[1] : null, minus: Number.isFinite(f[2]) ? f[2] : null, puvodni: typeof f[3] === 'string' ? f[3] : null });
      } else if (f && typeof f === 'object') {
        const cesta = f.cesta || f.filename;
        if (typeof cesta !== 'string') continue;
        const plus = Number.isFinite(f.plus) ? f.plus : (Number.isFinite(f.additions) ? f.additions : null);
        const minus = Number.isFinite(f.minus) ? f.minus : (Number.isFinite(f.deletions) ? f.deletions : null);
        out.push({ cesta, plus, minus, puvodni: f.puvodni || f.previous_filename || null, stav: f.status || null });
      }
    }
    return out;
  }

  /**
   * Postaví model ze seznamu „surových“ commitů a refs. Neznámé rodiče nedoplňuje –
   * jen je vede v množině chybejiciRodice.
   */
  function postavModel(surove, refs, meta) {
    const varovani = [];
    const podleSha = new Map();
    let duplicit = 0, vadnych = 0, bezData = 0;
    for (const r of surove) {
      const sha = txt(r.sha).toLowerCase();
      if (!RE_SHA.test(sha)) { vadnych++; continue; }
      if (podleSha.has(sha)) { duplicit++; const st = podleSha.get(sha); if (!st.soubory && r.soubory) st.soubory = r.soubory; continue; }
      const a = parsujIso(r.datum), k = parsujIso(r.datum_commit || r.datum);
      if (!Number.isFinite(a.ms)) bezData++;
      const rodice = Array.isArray(r.rodice) ? r.rodice.map(p => txt(p).toLowerCase()).filter(p => RE_SHA.test(p)) : [];
      podleSha.set(sha, {
        sha, rodice: [...new Set(rodice)],
        autor: txt(r.autor) || '(neznámý autor)', email: r.email ? txt(r.email) : null,
        login: r.login ? txt(r.login) : null,
        ms: a.ms, tz: meta.tzZnamy === false ? null : a.tz, datumText: txt(r.datum),
        commitMs: Number.isFinite(k.ms) ? k.ms : a.ms,
        commiter: txt(r.commiter), commiterEmail: r.commiter_email ? txt(r.commiter_email) : null,
        datumCommitText: txt(r.datum_commit),
        predmet: txt(r.predmet), telo: txt(r.telo),
        soubory: normSoubory(r.soubory)
      });
    }
    if (vadnych) varovani.push(vadnych + ' záznamů nemá platný hash SHA a bylo vynecháno.');
    if (duplicit) varovani.push(duplicit + ' duplicitních commitů sloučeno.');
    if (bezData) varovani.push(bezData + ' commitů nemá čitelné datum – v časových statistikách chybí.');

    const deti = new Map();
    const chybejiciRodice = new Set();
    let hranMimo = 0;
    for (const c of podleSha.values()) {
      for (const p of c.rodice) {
        if (podleSha.has(p)) { if (!deti.has(p)) deti.set(p, []); deti.get(p).push(c.sha); }
        else { chybejiciRodice.add(p); hranMimo++; }
      }
    }

    // refs – jen ty, které míří na načtené commity, ostatní se spočítají
    const refsOk = [], refsPodleSha = new Map();
    let refsMimo = 0;
    for (const r of refs || []) {
      const cil = txt(r.cil).toLowerCase();
      const nazev = txt(r.nazev);
      if (!nazev || !RE_SHA.test(cil)) continue;
      const ref = { nazev, kratky: kratkyNazev(nazev), typ: r.typ || typRefu(nazev), cil, anotovana: !!r.anotovana, zprava: r.zprava ? txt(r.zprava) : null };
      if (!podleSha.has(cil)) { refsMimo++; ref.mimo = true; }
      refsOk.push(ref);
      if (!ref.mimo) { if (!refsPodleSha.has(cil)) refsPodleSha.set(cil, []); refsPodleSha.get(cil).push(ref); }
    }
    if (refsMimo) varovani.push(refsMimo + ' větví/značek ukazuje na commity mimo načtená data.');

    const commity = topoRadit(podleSha, deti);
    const model = {
      zdroj: meta.zdroj, nazev: meta.nazev || 'repozitář',
      head: meta.head ? txt(meta.head).toLowerCase() : null, headRef: meta.headRef || null,
      melky: !!meta.melky, parametry: meta.parametry || {}, rodiceZnamy: meta.rodiceZnamy !== false,
      tzZnamy: meta.tzZnamy !== false, numstatMerge: meta.numstatMerge || null,
      vytvoreno: meta.vytvoreno || null, api: meta.api || null,
      commity, podleSha, deti, refs: refsOk, refsPodleSha,
      chybejiciRodice, hranMimo, varovani: varovani.concat(meta.varovani || []),
      maSoubory: commity.some(c => c.soubory && c.soubory.length)
    };
    model.uplnost = urciUplnost(model);
    return model;
  }

  function urciUplnost(m) {
    if (!m.rodiceZnamy) return { uroven: 'seznam', text: 'Jen seznam commitů bez rodičů – vztahy mezi commity nejsou známé a nekreslí se.' };
    if (m.zdroj === 'github-api') return { uroven: 'neuplny', text: 'Neúplná data z GitHub API: jen commity dosažitelné z načtených větví a jen načtené stránky. ' + (m.chybejiciRodice.size ? m.chybejiciRodice.size + ' rodičů leží mimo načtená data.' : 'Všichni rodiče načteni.') };
    if (m.melky) return { uroven: 'neuplny', text: 'Mělký klon (shallow): nejstarší commity mají rodiče, které v repozitáři nejsou.' };
    if (m.chybejiciRodice.size) return { uroven: 'neuplny', text: 'Export je oříznutý: ' + m.chybejiciRodice.size + ' rodičů leží mimo načtená data (omezení --max/--od/--rozsah).' };
    return { uroven: 'uplny', text: 'Úplný Git DAG: každý rodič každého commitu je v datech.' };
  }

  function typRefu(nazev) {
    if (nazev.startsWith('refs/heads/')) return 'vetev';
    if (nazev.startsWith('refs/remotes/')) return 'vzdalena';
    if (nazev.startsWith('refs/tags/')) return 'znacka';
    return 'jina';
  }
  function kratkyNazev(n) {
    return n.replace(/^refs\/(heads|tags|remotes)\//, '');
  }

  /* ---------- vstupní formáty ---------- */

  function zLokalnihoJson(d) {
    if (!d || !Array.isArray(d.commity)) throw new Error('JSON neobsahuje pole „commity“.');
    if (d.verze && d.verze > 1) throw new Error('Novější verze formátu (' + d.verze + ') – aktualizujte stránku.');
    const repo = d.repo || {}, par = d.parametry || {};
    const varovani = [];
    if (par.soubory && par.numstat_merge !== 'first-parent') varovani.push('Merge commity nemají statistiku změn (starší git) – vývoj velikosti souborů je jen přibližný.');
    return postavModel(d.commity, d.refs || [], {
      zdroj: d.zdroj === 'github-api' ? 'github-api' : 'lokalni-git',
      nazev: repo.nazev, head: repo.head, headRef: repo.head_ref, melky: repo.melky,
      parametry: par, numstatMerge: par.numstat_merge || null, vytvoreno: d.vytvoreno, varovani
    });
  }

  /** Rozdělí zprávu commitu na předmět (první řádek) a tělo. */
  function rozdelZpravu(z) {
    z = txt(z).replace(/\r\n/g, '\n');
    const i = z.indexOf('\n');
    if (i < 0) return { predmet: z, telo: '' };
    return { predmet: z.slice(0, i), telo: z.slice(i + 1).replace(/^\n+/, '').replace(/\n+$/, '') };
  }

  /** Položky z GitHub API /repos/{o}/{r}/commits → surové commity. Rodiče se berou jen z pole parents. */
  function prevedGithubCommity(pole) {
    const out = [];
    let bezRodicu = 0;
    for (const g of pole || []) {
      if (!g || typeof g.sha !== 'string' || !g.commit) continue;
      const ca = g.commit.author || {}, cc = g.commit.committer || {};
      const z = rozdelZpravu(g.commit.message);
      if (!Array.isArray(g.parents)) bezRodicu++;
      out.push({
        sha: g.sha, rodice: Array.isArray(g.parents) ? g.parents.map(p => p && p.sha).filter(Boolean) : [],
        autor: ca.name, email: ca.email, login: g.author && g.author.login, datum: ca.date,
        commiter: cc.name, commiter_email: cc.email, datum_commit: cc.date,
        predmet: z.predmet, telo: z.telo,
        soubory: Array.isArray(g.files) ? g.files : undefined
      });
    }
    return { surove: out, bezRodicu };
  }

  function zGithubPole(pole, info) {
    info = info || {};
    const { surove, bezRodicu } = prevedGithubCommity(pole);
    const refs = [];
    for (const b of info.vetve || []) if (b && b.commit) refs.push({ nazev: 'refs/heads/' + b.name, typ: 'vetev', cil: b.commit.sha });
    for (const t of info.znacky || []) if (t && t.commit) refs.push({ nazev: 'refs/tags/' + t.name, typ: 'znacka', cil: t.commit.sha });
    return postavModel(surove, refs, {
      zdroj: 'github-api', nazev: info.nazev || 'GitHub', head: info.head || null, headRef: info.headRef || null,
      rodiceZnamy: bezRodicu === 0, tzZnamy: false, api: info.api || null, varovani: info.varovani || []
    });
  }

  /**
   * Rychlý formát z jednořádkového příkazu:
   * git log --all --date-order --decorate=full --format='%H%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%D%x1f%s%x1e'
   */
  function zRychlehoTextu(t) {
    const surove = [], refs = [];
    let head = null, headRef = null, vadne = 0;
    for (let zaznam of t.split('\x1e')) {
      zaznam = zaznam.replace(/^[\r\n]+/, '');
      if (!zaznam.trim()) continue;
      const p = zaznam.split('\x1f');
      if (p.length < 7) { vadne++; continue; }
      const sha = p[0].trim();
      const predmet = p.slice(6).join('\x1f').replace(/[\r\n]+$/, '');
      surove.push({ sha, rodice: p[1].trim() ? p[1].trim().split(/\s+/) : [], autor: p[2], email: p[3] || null, datum: p[4], predmet, telo: '' });
      for (let d of p[5].split(', ')) {
        d = d.trim();
        if (!d) continue;
        if (d === 'HEAD') { head = sha; continue; }
        if (d.startsWith('HEAD -> ')) { head = sha; d = d.slice(8); headRef = d.startsWith('refs/') ? d : 'refs/heads/' + d; }
        if (d.startsWith('tag: ')) { const n = d.slice(5); refs.push({ nazev: n.startsWith('refs/') ? n : 'refs/tags/' + n, typ: 'znacka', cil: sha }); continue; }
        if (d.endsWith('/HEAD')) continue;
        const nazev = d.startsWith('refs/') ? d : 'refs/heads/' + d;
        refs.push({ nazev, typ: d.startsWith('refs/') ? typRefu(d) : 'vetev', cil: sha });
      }
    }
    if (!surove.length) throw new Error('Text neobsahuje žádný záznam rychlého formátu (oddělovače \\x1e a \\x1f).');
    return postavModel(surove, refs, {
      zdroj: 'rychly-text', nazev: 'git log', head, headRef,
      varovani: vadne ? [vadne + ' poškozených záznamů vynecháno.'] : []
    });
  }

  /** Rozpozná formát a vrátí model. Vyhazuje Error s českou zprávou. */
  function nactiText(text) {
    text = txt(text).replace(/^﻿/, '');
    const s = text.trimStart();
    if (s.startsWith('{') || s.startsWith('[')) {
      let d;
      try { d = JSON.parse(s); } catch (e) { throw new Error('Soubor není platný JSON: ' + e.message); }
      if (Array.isArray(d)) {
        if (d.length && d[0] && d[0].commit && typeof d[0].sha === 'string') return zGithubPole(d, { nazev: 'GitHub (soubor)' });
        if (d.length && d[0] && typeof d[0].sha === 'string') return postavModel(d, [], { zdroj: 'lokalni-git', nazev: 'seznam', rodiceZnamy: d.every(x => Array.isArray(x.rodice)) });
        throw new Error('Pole v JSON neobsahuje commity (chybí „sha“).');
      }
      if (d && d.format === 'git-historie-json') return zLokalnihoJson(d);
      if (d && Array.isArray(d.commity)) return zLokalnihoJson(d);
      throw new Error('Neznámý JSON – očekáván výstup export_git_json.py (format „git-historie-json“) nebo odpověď GitHub API.');
    }
    if (text.indexOf('\x1f') >= 0) return zRychlehoTextu(text);
    throw new Error('Neznámý formát souboru. Použijte export_git_json.py nebo jednořádkový příkaz ze stránky.');
  }

  /* ---------- topologické řazení ---------- */

  function vetsi(a, b) { // pořadí v haldě: novější commit dřív, při shodě podle sha
    if (a.commitMs !== b.commitMs) {
      const am = Number.isFinite(a.commitMs) ? a.commitMs : -Infinity, bm = Number.isFinite(b.commitMs) ? b.commitMs : -Infinity;
      if (am !== bm) return am > bm;
    }
    return a.sha < b.sha;
  }

  /** Kahnův algoritmus: commit se vypíše až po všech svých dětech v datech. */
  function topoRadit(podleSha, deti) {
    const zbyva = new Map();
    for (const c of podleSha.values()) zbyva.set(c.sha, (deti.get(c.sha) || []).length);
    const halda = [];
    const push = (c) => {
      halda.push(c);
      let i = halda.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (vetsi(halda[i], halda[p])) { [halda[i], halda[p]] = [halda[p], halda[i]]; i = p; } else break; }
    };
    const pop = () => {
      const top = halda[0], last = halda.pop();
      if (halda.length) {
        halda[0] = last; let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1; let m = i;
          if (l < halda.length && vetsi(halda[l], halda[m])) m = l;
          if (r < halda.length && vetsi(halda[r], halda[m])) m = r;
          if (m === i) break;
          [halda[i], halda[m]] = [halda[m], halda[i]]; i = m;
        }
      }
      return top;
    };
    for (const c of podleSha.values()) if (zbyva.get(c.sha) === 0) push(c);
    const out = [];
    while (halda.length) {
      const c = pop();
      out.push(c);
      for (const p of c.rodice) {
        if (!zbyva.has(p)) continue;
        const z = zbyva.get(p) - 1;
        zbyva.set(p, z);
        if (z === 0) push(podleSha.get(p));
      }
    }
    if (out.length < podleSha.size) {
      // cyklus – v platném Gitu nemožné; zbytek přidat, hrany pak layout označí jako neplatné
      const v = new Set(out.map(c => c.sha));
      for (const c of podleSha.values()) if (!v.has(c.sha)) out.push(c);
    }
    return out;
  }

  /* ---------- rozvržení do pruhů ---------- */

  /**
   * commity: pole v topologickém pořadí (řádek = index).
   * Vrací { pruh: Int32Array, hrany: [{od, do, draha, k, chybi, neplatna}], sirka }.
   *  - od/do = řádky potomka/rodiče, do = -1 pro rodiče mimo načtená data
   *  - draha = pruh, kterým hrana vede mezi řádky od+1 … do-1
   */
  function rozvrhni(commity) {
    const n = commity.length;
    const radek = new Map();
    commity.forEach((c, i) => radek.set(c.sha, i));
    const pruh = new Int32Array(n);
    const drahy = []; // drahy[L] = sha, na který pruh L čeká (mezi aktuálním a dalším řádkem), nebo null
    const hrany = [];
    let sirka = 0;
    const volny = () => { let L = drahy.indexOf(null); if (L < 0) { L = drahy.length; drahy.push(null); } return L; };
    for (let i = 0; i < n; i++) {
      const c = commity[i];
      let moje = -1;
      for (let L = 0; L < drahy.length; L++) {
        if (drahy[L] === c.sha) { if (moje < 0) moje = L; drahy[L] = null; }
      }
      if (moje < 0) moje = volny();
      drahy[moje] = null;
      pruh[i] = moje;
      c.rodice.forEach((p, k) => {
        const j = radek.has(p) ? radek.get(p) : -1;
        if (j < 0) { hrany.push({ od: i, do: -1, draha: moje, k, chybi: true }); return; }
        if (j <= i) { hrany.push({ od: i, do: j, draha: moje, k, neplatna: true }); return; }
        // první rodič pokračuje vlastním pruhem (i když na něj už čeká jiný – sejdou se u rodiče),
        // další rodiče využijí existující pruh, jinak dostanou nový
        let L;
        if (k === 0 && drahy[moje] === null) { L = moje; drahy[L] = p; }
        else {
          L = drahy.indexOf(p);
          if (L < 0) { L = volny(); drahy[L] = p; }
        }
        hrany.push({ od: i, do: j, draha: L, k });
      });
      // odříznout volné pruhy na konci
      while (drahy.length && drahy[drahy.length - 1] === null) drahy.pop();
      sirka = Math.max(sirka, moje + 1, drahy.length);
    }
    return { pruh, hrany, sirka, radek };
  }

  /* ---------- dosažitelnost, filtry, hledání ---------- */

  /** Množina sha dosažitelných (předků včetně) z tipů – uzavřená na rodiče v datech. */
  function dosazitelne(model, tipy) {
    const vid = new Set(), zas = [];
    for (const t of tipy) if (model.podleSha.has(t)) zas.push(t);
    while (zas.length) {
      const s = zas.pop();
      if (vid.has(s)) continue;
      vid.add(s);
      for (const p of model.podleSha.get(s).rodice) if (model.podleSha.has(p) && !vid.has(p)) zas.push(p);
    }
    return vid;
  }

  function bezDiakritiky(s) { return txt(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  function klicAutora(c) { return c.email ? 'e:' + c.email.toLowerCase() : 'n:' + c.autor.toLowerCase(); }

  /** Vrátí funkci c → bool pro textový dotaz. Podporuje „soubor:cesta“ a prefix sha. */
  function predikatDotazu(dotaz) {
    const q = txt(dotaz).trim();
    if (!q) return null;
    const m = /^soubor:\s*(.+)$/i.exec(q);
    if (m) {
      const f = bezDiakritiky(m[1]);
      return c => !!c.soubory && c.soubory.some(s => bezDiakritiky(s.cesta).includes(f) || (s.puvodni && bezDiakritiky(s.puvodni).includes(f)));
    }
    const nq = bezDiakritiky(q);
    const jeSha = /^[0-9a-f]{4,64}$/i.test(q);
    return c => (jeSha && c.sha.startsWith(q.toLowerCase())) ||
      bezDiakritiky(c.predmet).includes(nq) || bezDiakritiky(c.telo).includes(nq) ||
      bezDiakritiky(c.autor).includes(nq) || (c.email && c.email.toLowerCase().includes(nq)) ||
      (c.login && c.login.toLowerCase().includes(nq));
  }

  /** filtr = { autor: klic|null, od: ms|null, do: ms|null, dotaz, soubor } → predikát nebo null (vše). */
  function predikatFiltru(f) {
    const casti = [];
    if (f.autor) casti.push(c => klicAutora(c) === f.autor);
    if (Number.isFinite(f.od)) casti.push(c => c.ms >= f.od);
    if (Number.isFinite(f.do)) casti.push(c => c.ms < f.do);
    if (f.soubor) casti.push(c => !!c.soubory && c.soubory.some(s => s.cesta === f.soubor || s.puvodni === f.soubor));
    const q = predikatDotazu(f.dotaz);
    if (q) casti.push(q);
    if (!casti.length) return null;
    return c => casti.every(p => p(c));
  }

  /* ---------- statistiky ---------- */

  /** Zvolí krok histogramu podle rozpětí. */
  function vyberKrok(odMs, doMs) {
    const dny = (doMs - odMs) / DEN_MS;
    if (dny <= 120) return 'den';
    if (dny <= 3 * 366) return 'tyden';
    return 'mesic';
  }

  /** Začátek intervalu (v posunutém čase, ms UTC) pro krok. */
  function zacatekIntervalu(posunMs, krok) {
    const d = new Date(posunMs);
    if (krok === 'mesic') return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    const den = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    if (krok === 'den') return den;
    return den - ((d.getUTCDay() + 6) % 7) * DEN_MS; // pondělí
  }
  function dalsiInterval(z, krok) {
    if (krok === 'den') return z + DEN_MS;
    if (krok === 'tyden') return z + 7 * DEN_MS;
    const d = new Date(z); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  }

  /**
   * Aktivita v čase. Intervaly jsou v kalendáři zvoleného pásma (rezim), vrácené časy
   * jsou v tomto „posunutém“ čase (ms, čtené přes getUTC*). Prázdné intervaly se doplní nulou.
   * predikat (volitelný) určí, které commity se počítají do „shoda“.
   */
  function aktivita(commity, krok, rezim, predikat) {
    const platne = commity.filter(c => Number.isFinite(c.ms));
    if (!platne.length) return { krok: krok || 'den', intervaly: [] };
    let min = Infinity, max = -Infinity;
    const posunute = platne.map(c => { const t = c.ms + posunPasma(c, rezim) * 60000; if (t < min) min = t; if (t > max) max = t; return t; });
    if (!krok) krok = vyberKrok(min, max);
    const intervaly = [], index = new Map();
    for (let z = zacatekIntervalu(min, krok); z <= max; z = dalsiInterval(z, krok)) {
      index.set(z, intervaly.length);
      intervaly.push({ od: z, do: dalsiInterval(z, krok), pocet: 0, shoda: 0 });
    }
    platne.forEach((c, i) => {
      const it = intervaly[index.get(zacatekIntervalu(posunute[i], krok))];
      it.pocet++;
      if (!predikat || predikat(c)) it.shoda++;
    });
    return { krok, intervaly };
  }

  /** Matice 7 × 24 (pondělí = 0) + součty. */
  function denHodina(commity, rezim) {
    const m = Array.from({ length: 7 }, () => new Array(24).fill(0));
    const dny = new Array(7).fill(0), hodiny = new Array(24).fill(0);
    let max = 0, celkem = 0;
    for (const c of commity) {
      if (!Number.isFinite(c.ms)) continue;
      const t = mistniCas(c, rezim);
      m[t.den][t.hodina]++; dny[t.den]++; hodiny[t.hodina]++; celkem++;
      if (m[t.den][t.hodina] > max) max = m[t.den][t.hodina];
    }
    return { matice: m, dny, hodiny, max, celkem };
  }

  /** Statistiky autorů. Řádky merge commitů se nezapočítávají (byly by dvakrát). */
  function statistikyAutoru(commity, rezim) {
    const mapa = new Map();
    for (const c of commity) {
      const k = klicAutora(c);
      let a = mapa.get(k);
      if (!a) { a = { klic: k, jmena: new Map(), email: c.email, commity: 0, merge: 0, plus: 0, minus: 0, soubory: new Set(), dny: new Set(), prvni: Infinity, posledni: -Infinity, seStatistikou: 0 }; mapa.set(k, a); }
      a.jmena.set(c.autor, (a.jmena.get(c.autor) || 0) + 1);
      a.commity++;
      if (c.rodice.length > 1) a.merge++;
      else if (c.soubory) {
        a.seStatistikou++;
        for (const s of c.soubory) { a.plus += s.plus || 0; a.minus += s.minus || 0; a.soubory.add(s.cesta); }
      }
      if (Number.isFinite(c.ms)) {
        a.dny.add(mistniCas(c, rezim).datum);
        if (c.ms < a.prvni) a.prvni = c.ms;
        if (c.ms > a.posledni) a.posledni = c.ms;
      }
    }
    const out = [];
    for (const a of mapa.values()) {
      let jmeno = '', nej = -1;
      for (const [j, p] of a.jmena) if (p > nej) { nej = p; jmeno = j; }
      out.push({ klic: a.klic, jmeno, jmenaVse: [...a.jmena.keys()], email: a.email, commity: a.commity, merge: a.merge, plus: a.plus, minus: a.minus,
        souboru: a.soubory.size, aktivnichDnu: a.dny.size, prvni: a.prvni, posledni: a.posledni, seStatistikou: a.seStatistikou });
    }
    out.sort((x, y) => y.commity - x.commity || x.jmeno.localeCompare(y.jmeno, 'cs'));
    return out;
  }

  /** První-rodičovská linie od tipu k nejstaršímu načtenému commitu (nejnovější první). */
  function prvniRodicovska(model, tip) {
    const out = [];
    let s = tip, ochrana = 0;
    while (s && model.podleSha.has(s) && ochrana++ < 5e6) {
      const c = model.podleSha.get(s);
      out.push(c);
      s = c.rodice[0];
    }
    const posledni = out[out.length - 1];
    const doKorene = !!posledni && posledni.rodice.length === 0;
    return { linie: out, doKorene };
  }

  /**
   * Vývoj souborů po první-rodičovské linii větve. Počty řádků jsou absolutní jen tehdy,
   * když linie dojde ke kořeni a každý commit má statistiku (u merge vůči prvnímu rodiči).
   */
  function vyvojSouboru(model, tip) {
    const { linie, doKorene } = prvniRodicovska(model, tip);
    const chrono = linie.slice().reverse();
    const radky = new Map(), info = new Map();
    const body = [];
    let velikost = 0, bezStatistiky = 0;
    const zaznam = (cesta) => { let f = info.get(cesta); if (!f) { f = { cesta, zmen: 0, plus: 0, minus: 0, binarni: false, historie: [], prejmenovano: [] }; info.set(cesta, f); } return f; };
    for (const c of chrono) {
      if (!c.soubory) { bezStatistiky++; body.push({ sha: c.sha, ms: c.ms, velikost }); continue; }
      for (const s of c.soubory) {
        if (s.puvodni && s.puvodni !== s.cesta && radky.has(s.puvodni)) {
          const stare = info.get(s.puvodni);
          radky.set(s.cesta, (radky.get(s.cesta) || 0) + radky.get(s.puvodni));
          radky.delete(s.puvodni);
          const f = zaznam(s.cesta);
          if (stare) { f.zmen += stare.zmen; f.plus += stare.plus; f.minus += stare.minus; f.historie = stare.historie.concat(f.historie); f.prejmenovano = stare.prejmenovano.concat([s.puvodni]); f.binarni = f.binarni || stare.binarni; info.delete(s.puvodni); }
        }
        const f = zaznam(s.cesta);
        f.zmen++;
        if (s.plus === null || s.minus === null) { f.binarni = true; if (!radky.has(s.cesta)) radky.set(s.cesta, 0); f.historie.push({ ms: c.ms, sha: c.sha, radky: radky.get(s.cesta) }); continue; }
        f.plus += s.plus; f.minus += s.minus;
        const nove = (radky.get(s.cesta) || 0) + s.plus - s.minus;
        velikost += s.plus - s.minus;
        radky.set(s.cesta, nove);
        f.historie.push({ ms: c.ms, sha: c.sha, radky: nove });
      }
      body.push({ sha: c.sha, ms: c.ms, velikost });
    }
    const soubory = [];
    for (const f of info.values()) {
      const r = radky.has(f.cesta) ? radky.get(f.cesta) : 0;
      soubory.push(Object.assign(f, { radky: r, existuje: radky.has(f.cesta) && (r > 0 || f.binarni) }));
    }
    soubory.sort((a, b) => b.zmen - a.zmen || (b.plus + b.minus) - (a.plus + a.minus) || a.cesta.localeCompare(b.cesta));
    const mergeBezStat = model.numstatMerge !== 'first-parent' && chrono.some(c => c.rodice.length > 1);
    return { body, soubory, velikost, doKorene, bezStatistiky, pocet: chrono.length,
      absolutni: doKorene && bezStatistiky === 0 && !mergeBezStat, mergeBezStat };
  }

  /* ---------- GitHub API ---------- */

  /** 'owner/repo' nebo URL GitHubu → { vlastnik, repo } nebo null. */
  function parsujGithub(s) {
    s = txt(s).trim();
    let m = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/\s]+)\/([^\/\s#?]+)/i.exec(s);
    if (!m) m = /^([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/.exec(s);
    if (!m) return null;
    const repo = m[2].replace(/\.git$/i, '');
    if (!/^[A-Za-z0-9-]{1,39}$/.test(m[1]) || !/^[A-Za-z0-9._-]{1,100}$/.test(repo)) return null;
    return { vlastnik: m[1], repo };
  }

  /** Hlavička Link → { next, last, prev, first } (URL). */
  function parsujLink(h) {
    const out = {};
    if (!h) return out;
    for (const cast of h.split(',')) {
      const m = /<([^>]+)>\s*;\s*rel="?([^";]+)"?/.exec(cast);
      if (m) for (const rel of m[2].split(/\s+/)) out[rel] = m[1];
    }
    return out;
  }

  /** Číslo stránky z URL (parametr page), nebo null. */
  function cisloStranky(url) {
    const m = /[?&]page=(\d+)/.exec(url || '');
    return m ? parseInt(m[1], 10) : null;
  }

  /** get(nazevHlavicky) → { limit, zbyva, pouzito, reset (ms), zdroj } */
  function parsujRate(get) {
    const n = (k) => { const v = get(k); const x = v === null || v === undefined ? NaN : parseInt(v, 10); return Number.isFinite(x) ? x : null; };
    const reset = n('x-ratelimit-reset');
    return { limit: n('x-ratelimit-limit'), zbyva: n('x-ratelimit-remaining'), pouzito: n('x-ratelimit-used'),
      reset: reset === null ? null : reset * 1000, zdroj: get('x-ratelimit-resource') || null };
  }

  /** Srozumitelná chybová hláška pro odpověď API. */
  function chybaGithub(status, zprava, rate, maToken) {
    zprava = txt(zprava);
    if ((status === 403 || status === 429) && rate && rate.zbyva === 0) {
      const kdy = rate.reset ? new Date(rate.reset) : null;
      return 'Vyčerpán limit požadavků GitHub API (' + (rate.limit || '?') + ' za hodinu' + (maToken ? '' : ' bez tokenu') + '). ' +
        (kdy ? 'Obnoví se v ' + kdy.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }) + '. ' : '') +
        (maToken ? '' : 'S osobním tokenem je limit 5 000 požadavků za hodinu.');
    }
    if (status === 403 || status === 429) return 'GitHub požadavek odmítl (' + status + ')' + (/secondary rate/i.test(zprava) ? ' – sekundární limit, zkuste to za minutu.' : ': ' + zprava);
    if (status === 401) return 'Neplatný nebo prošlý token (401). Token se nikam neukládá – zadejte ho znovu.';
    if (status === 404) return 'Repozitář nebo větev nenalezena (404). Soukromý repozitář vyžaduje token s právem čtení.';
    if (status === 409) return 'Repozitář je prázdný (409) – nemá žádné commity.';
    if (status === 422) return 'Neplatná větev nebo SHA (422).';
    if (status === 0) return 'Nelze se spojit s api.github.com (offline nebo blokováno).';
    return 'GitHub API vrátilo chybu ' + status + (zprava ? ': ' + zprava : '');
  }

  /** Sestaví URL seznamu commitů. */
  function urlCommitu(vlastnik, repo, vetev, stranka) {
    let u = 'https://api.github.com/repos/' + encodeURIComponent(vlastnik) + '/' + encodeURIComponent(repo) + '/commits?per_page=100';
    if (vetev) u += '&sha=' + encodeURIComponent(vetev);
    if (stranka && stranka > 1) u += '&page=' + stranka;
    return u;
  }

  /* ---------- formátování ---------- */

  function cislo(n, des) {
    if (!Number.isFinite(n)) return '–';
    return n.toLocaleString('cs-CZ', { minimumFractionDigits: des || 0, maximumFractionDigits: des || 0 }).replace(/ /g, ' ');
  }

  const API = {
    parsujIso, posunPasma, mistniCas, postavModel, zLokalnihoJson, zGithubPole, prevedGithubCommity, zRychlehoTextu, nactiText,
    rozdelZpravu, topoRadit, rozvrhni, dosazitelne, klicAutora, predikatDotazu, predikatFiltru, bezDiakritiky,
    vyberKrok, aktivita, denHodina, statistikyAutoru, prvniRodicovska, vyvojSouboru,
    parsujGithub, parsujLink, cisloStranky, parsujRate, chybaGithub, urlCommitu, kratkyNazev, typRefu, cislo, DEN_MS
  };
  if (typeof module !== 'undefined') module.exports = API; else window.GitJadro = API;
})();
