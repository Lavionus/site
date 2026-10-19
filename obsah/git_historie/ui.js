/* git_historie/ui.js – uživatelské rozhraní vizualizátoru historie Gitu (DOM, plátna). */
(function () {
  'use strict';
  const J = window.GitJadro;
  const $ = (id) => document.getElementById(id);
  const KLIC_NAST = 'webapp_git_historie_nastaveni';
  const DB_NAZEV = 'webapp_git_historie';

  /* ---------- stav ---------- */
  const S = {
    model: null,
    zdrojPopis: '',
    filtr: { vetev: '', autor: '', od: null, do: null, dotaz: '', soubor: '' },
    pasmo: 'autor', krok: '',
    radky: [], rozvrh: null, shoda: null, pocetShod: 0, poradiShod: [],
    vybrany: -1, hover: -1,
    z: 1, sy: 0, sx: 0,
    vyvojVetev: '',
    razeniAutoru: { klic: 'commity', smer: -1 }
  };
  let token = ''; // jen v paměti
  const api = { vlastnik: '', repo: '', vychozi: '', vetev: '', pole: [], vetve: null, znacky: null, dalsi: null, stranek: 0, info: null, rate: null, pozadavku: 0, zrus: null, refsNeuplne: false };

  function nactiNastaveni() {
    try { const n = JSON.parse(localStorage.getItem(KLIC_NAST) || '{}'); if (n.pasmo) S.pasmo = n.pasmo; if (typeof n.krok === 'string') S.krok = n.krok; if (n.z) S.z = Math.min(3, Math.max(0.12, n.z)); } catch (e) { /* nic */ }
  }
  function ulozNastaveni() {
    try { localStorage.setItem(KLIC_NAST, JSON.stringify({ pasmo: S.pasmo, krok: S.krok, z: S.z })); } catch (e) { /* nic */ }
  }

  /* ---------- IndexedDB: poslední data ---------- */
  function db() {
    return new Promise((ok, ne) => {
      try {
        const r = indexedDB.open(DB_NAZEV, 1);
        r.onupgradeneeded = () => r.result.createObjectStore('data');
        r.onsuccess = () => ok(r.result); r.onerror = () => ne(r.error);
      } catch (e) { ne(e); }
    });
  }
  async function ulozPosledni(zaznam) {
    try { const d = await db(); const t = d.transaction('data', 'readwrite'); t.objectStore('data').put(zaznam, 'posledni'); } catch (e) { /* nic */ }
  }
  async function nactiPosledni() {
    try {
      const d = await db();
      return await new Promise((ok) => { const r = d.transaction('data').objectStore('data').get('posledni'); r.onsuccess = () => ok(r.result || null); r.onerror = () => ok(null); });
    } catch (e) { return null; }
  }

  /* ---------- barvy z CSS ---------- */
  let B = {};
  function nactiBarvy() {
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => cs.getPropertyValue(n).trim();
    B = { text: v('--text'), muted: v('--text-muted'), faint: v('--text-faint'), border: v('--border'), borderStrong: v('--border-strong'),
      bg: v('--bg-input'), panel: v('--bg-panel'), deep: v('--bg-deep'), accent: v('--accent'), onAccent: v('--on-accent'), warn: v('--warn'), ok: v('--ok'), danger: v('--danger'),
      pruhy: [0, 1, 2, 3, 4, 5, 6, 7].map(i => v('--pruh-' + i)), mez: v('--text-mez') };
  }
  const barvaPruhu = (l) => B.pruhy[((l % 8) + 8) % 8];

  /* ---------- formátování ---------- */
  const cislo = J.cislo;
  const esc = (s) => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  function pasmo() { return (S.pasmo === 'autor' && S.model && !S.model.tzZnamy) ? 'prohlizec' : S.pasmo; }
  function datum(c, sCasem) {
    if (!Number.isFinite(c.ms)) return '–';
    const d = new Date(J.mistniCas(c, pasmo()).posunutyMs);
    let t = d.getUTCDate() + '. ' + (d.getUTCMonth() + 1) + '. ' + d.getUTCFullYear();
    if (sCasem) t += ' ' + String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
    return t;
  }
  function datumMs(ms) { const d = new Date(ms); return d.getUTCDate() + '. ' + (d.getUTCMonth() + 1) + '. ' + d.getUTCFullYear(); }
  function tzText(tz) { if (tz === null || tz === undefined) return ''; const z = tz < 0 ? '−' : '+'; const a = Math.abs(tz); return 'UTC' + z + String(Math.floor(a / 60)).padStart(2, '0') + ':' + String(a % 60).padStart(2, '0'); }
  const kratke = (sha) => sha.slice(0, 8);
  const MESICE = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];

  /* ---------- plátna ---------- */
  function pripravPlatno(cv) {
    const r = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }
  function zkrat(ctx, t, max) {
    if (max <= 8) return '';
    if (ctx.measureText(t).width <= max) return t;
    let lo = 0, hi = t.length;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ctx.measureText(t.slice(0, m) + '…').width <= max) lo = m; else hi = m - 1; }
    return lo ? t.slice(0, lo) + '…' : '';
  }

  /* ============================================================
     Načtení dat
     ============================================================ */
  function nastavModel(model, popis) {
    S.model = model; S.zdrojPopis = popis;
    S.filtr = { vetev: '', autor: '', od: null, do: null, dotaz: '', soubor: '' };
    S.vybrany = -1; S.sy = 0; S.sx = 0;
    S.vyvojVetev = '';
    $('f-hledat').value = ''; $('f-od').value = ''; $('f-do').value = '';
    naplnVybery();
    for (const id of ['uplnost', 'dlazdice', 'karta-filtry', 'karta-graf', 'karta-aktivita', 'grafy-cas', 'karta-autori', 'karta-soubory']) $(id).hidden = false;
    vykresliUplnost();
    prepocti(true);
    // výchozí výběr: HEAD
    const h = S.model.head && S.rozvrh.radek.has(S.model.head) ? S.rozvrh.radek.get(S.model.head) : (S.radky.length ? 0 : -1);
    if (h >= 0) vyber(h, true);
  }

  function nactiTextem(text, popis, ulozit) {
    let m;
    try { m = J.nactiText(text); }
    catch (e) { Dialog.chyba(e.message); return false; }
    if (!m.commity.length) { Dialog.chyba('Soubor neobsahuje žádné commity.'); return false; }
    nastavModel(m, popis);
    if (ulozit) {
      if (text.length < 40e6) ulozPosledni({ typ: 'text', text, popis, cas: Date.now() });
      $('obnovit').hidden = true;
    }
    Dialog.info('Načteno ' + cislo(m.commity.length) + ' commitů.');
    return true;
  }

  function nactiSoubor(f) {
    if (!f) return;
    if (f.size > 300e6) { Dialog.chyba('Soubor je příliš velký (' + cislo(f.size / 1e6) + ' MB).'); return; }
    const r = new FileReader();
    r.onload = () => nactiTextem(String(r.result), 'soubor ' + f.name, true);
    r.onerror = () => Dialog.chyba('Soubor nelze přečíst.');
    r.readAsText(f, 'utf-8');
  }

  async function nactiUkazku() {
    try {
      const r = await fetch('git_historie/ukazka.json');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      nactiTextem(await r.text(), 'ukázková data (smyšlený repozitář)', false);
    } catch (e) { Dialog.chyba('Ukázková data se nepodařilo načíst: ' + e.message); }
  }

  /* ============================================================
     GitHub API
     ============================================================ */
  async function apiGet(url) {
    const hl = { 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (token) hl.Authorization = 'Bearer ' + token;
    let res;
    try { res = await fetch(url, { headers: hl, signal: api.zrus ? api.zrus.signal : undefined, cache: 'no-store' }); }
    catch (e) {
      if (e.name === 'AbortError') throw e;
      throw new Error(J.chybaGithub(0, '', null, !!token));
    }
    api.pozadavku++;
    const rate = J.parsujRate(k => res.headers.get(k));
    if (rate.limit !== null) api.rate = rate;
    if (!res.ok) {
      let zprava = '';
      try { zprava = (await res.json()).message || ''; } catch (e) { /* nic */ }
      throw new Error(J.chybaGithub(res.status, zprava, rate, !!token));
    }
    return { data: await res.json(), link: J.parsujLink(res.headers.get('link')) };
  }

  function apiStav(text) {
    const r = api.rate;
    let h = text ? esc(text) + '<br>' : '';
    if (api.repo) {
      h += 'Repozitář <b>' + esc(api.vlastnik + '/' + api.repo) + '</b>, načteno <b>' + cislo(api.pole.length) + '</b> commitů';
      if (api.vetev) h += ' (naposledy větev <b>' + esc(api.vetev) + '</b>, ' + api.stranek + ' str.)';
      h += api.dalsi ? '; <b>další stránky existují</b> (hlavička Link rel="next")' : (api.pole.length ? '; poslední stránka větve načtena' : '');
      h += '. Požadavků v této relaci: ' + api.pozadavku + '.';
      if (api.refsNeuplne) h += ' Seznam větví/značek má víc než 100 položek – načtena jen první stránka.';
    }
    if (r && r.limit !== null) {
      const kdy = r.reset ? new Date(r.reset).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }) : '?';
      h += '<br>Rate limit (' + esc(r.zdroj || 'core') + '): zbývá <b>' + cislo(r.zbyva) + '</b> z ' + cislo(r.limit) + ', obnova v ' + kdy + (token ? ' (s tokenem)' : ' (bez tokenu)') + '.';
      if (r.zbyva !== null && r.zbyva < 10) h += ' <b style="color:var(--text-mez)">Limit je téměř vyčerpán.</b>';
    }
    $('gh-stav').innerHTML = h;
  }

  function sestavApiModel() {
    const info = {
      nazev: api.vlastnik + '/' + api.repo, vetve: api.vetve || [], znacky: api.znacky || [],
      head: api.vetve ? ((api.vetve.find(b => b.name === api.vychozi) || {}).commit || {}).sha : (api.pole[0] && api.pole[0].sha),
      headRef: api.vychozi ? 'refs/heads/' + api.vychozi : null,
      api: { vlastnik: api.vlastnik, repo: api.repo, dalsi: api.dalsi, stranek: api.stranek, nacteno: Date.now() }
    };
    if (!api.vetve && api.vetev && api.pole.length) {
      // bez seznamu větví aspoň vyznačit načtenou větev (její tip = první commit první stránky)
      info.vetve = [{ name: api.vetev, commit: { sha: api.tipVetve || api.pole[0].sha } }];
      info.head = info.head || api.pole[0].sha;
    }
    return J.zGithubPole(api.pole, info);
  }

  async function apiNactiStranky(prvniUrl, maxStranek) {
    let url = prvniUrl, n = 0;
    const videne = new Set(api.pole.map(c => c.sha));
    while (url && n < maxStranek) {
      apiStav('Načítám stránku ' + (J.cisloStranky(url) || 1) + '…');
      const { data, link } = await apiGet(url);
      if (!Array.isArray(data)) throw new Error('Neočekávaná odpověď API.');
      if (n === 0 && J.cisloStranky(url) === null && data[0]) api.tipVetve = data[0].sha;
      for (const c of data) if (!videne.has(c.sha)) { videne.add(c.sha); api.pole.push(c); }
      n++; api.stranek++;
      url = link.next || null;
    }
    api.dalsi = url;
  }

  async function ghBezpecne(fn) {
    const tl = ['gh-nacti', 'gh-dalsi', 'gh-pridat-vetev'];
    tl.forEach(id => $(id).disabled = true);
    $('gh-zrus').hidden = false;
    api.zrus = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let chyba = false;
    try { await fn(); }
    catch (e) {
      chyba = true;
      if (e.name === 'AbortError') apiStav('Zastaveno.');
      else { apiStav(e.message); Dialog.chyba(e.message); }
    } finally {
      api.zrus = null;
      $('gh-zrus').hidden = true;
      $('gh-nacti').disabled = false;
      $('gh-dalsi').disabled = !api.dalsi;
      $('gh-pridat-vetev').disabled = !(api.vetve && api.vetve.length);
    }
    if (!api.pole.length) { if (!chyba) apiStav('Nenačten žádný commit (prázdná větev nebo stránka).'); return; }
    {
      const m = sestavApiModel();
      nastavModel(m, 'GitHub API – ' + api.vlastnik + '/' + api.repo);
      apiStav('');
      ulozPosledni({ typ: 'api', pole: api.pole, info: { vlastnik: api.vlastnik, repo: api.repo, vychozi: api.vychozi, vetev: api.vetev, vetve: api.vetve, znacky: api.znacky, stranek: api.stranek }, popis: S.zdrojPopis, cas: Date.now() });
    }
  }

  function naplnPridatVetev() {
    const s = $('gh-pridat-vetev');
    s.innerHTML = '<option value="">Přidat větev…</option>' + (api.vetve || []).map(b => '<option value="' + esc(b.name) + '">' + esc(b.name) + '</option>').join('');
  }

  async function ghNacti() {
    const r = J.parsujGithub($('gh-repo').value);
    if (!r) { Dialog.chyba('Zadejte repozitář ve tvaru vlastník/název nebo jako URL github.com.'); return; }
    token = $('gh-token').value.trim();
    Object.assign(api, { vlastnik: r.vlastnik, repo: r.repo, pole: [], vetve: null, znacky: null, dalsi: null, stranek: 0, vetev: '', tipVetve: null, refsNeuplne: false });
    const stranek = parseInt($('gh-stranky').value, 10) || 3;
    await ghBezpecne(async () => {
      apiStav('Zjišťuji repozitář…');
      const { data: repo } = await apiGet('https://api.github.com/repos/' + encodeURIComponent(r.vlastnik) + '/' + encodeURIComponent(r.repo));
      api.vychozi = repo.default_branch || '';
      api.vetev = $('gh-vetev').value.trim() || api.vychozi;
      if ($('gh-refs').checked) {
        const b = await apiGet('https://api.github.com/repos/' + encodeURIComponent(r.vlastnik) + '/' + encodeURIComponent(r.repo) + '/branches?per_page=100');
        const t = await apiGet('https://api.github.com/repos/' + encodeURIComponent(r.vlastnik) + '/' + encodeURIComponent(r.repo) + '/tags?per_page=100');
        api.vetve = b.data; api.znacky = t.data; api.refsNeuplne = !!(b.link.next || t.link.next);
        naplnPridatVetev();
      }
      await apiNactiStranky(J.urlCommitu(r.vlastnik, r.repo, api.vetev, 1), stranek);
    });
  }
  async function ghDalsi() {
    if (!api.dalsi) return;
    const stranek = parseInt($('gh-stranky').value, 10) || 3;
    token = $('gh-token').value.trim();
    await ghBezpecne(() => apiNactiStranky(api.dalsi, stranek));
  }
  async function ghPridatVetev() {
    const v = $('gh-pridat-vetev').value;
    $('gh-pridat-vetev').value = '';
    if (!v) return;
    token = $('gh-token').value.trim();
    api.vetev = v; api.stranek = 0;
    const stranek = parseInt($('gh-stranky').value, 10) || 3;
    await ghBezpecne(() => apiNactiStranky(J.urlCommitu(api.vlastnik, api.repo, v, 1), stranek));
  }
  async function ghSouboryCommitu(sha) {
    token = $('gh-token').value.trim();
    try {
      const { data } = await apiGet('https://api.github.com/repos/' + encodeURIComponent(api.vlastnik) + '/' + encodeURIComponent(api.repo) + '/commits/' + sha);
      const c = S.model.podleSha.get(sha);
      const pol = api.pole.find(x => x.sha === sha);
      if (pol) pol.files = (data.files || []).map(f => ({ filename: f.filename, additions: f.additions, deletions: f.deletions, status: f.status, previous_filename: f.previous_filename }));
      c.soubory = (data.files || []).map(f => ({ cesta: f.filename, plus: f.patch === undefined && f.changes === 0 && f.status !== 'renamed' ? null : f.additions, minus: f.patch === undefined && f.changes === 0 && f.status !== 'renamed' ? null : f.deletions, puvodni: f.previous_filename || null, stav: f.status }));
      c.souboryOrezane = (data.files || []).length >= 300;
      S.model.maSoubory = true;
      apiStav('');
      vykresliDetail();
      vykresliSoubory();
    } catch (e) { Dialog.chyba(e.message); apiStav(e.message); }
  }

  /* ============================================================
     Přepočet pohledu
     ============================================================ */
  function tipVetve(hodnota) {
    if (!hodnota) return null;
    if (hodnota === 'HEAD') return S.model.head;
    const r = S.model.refs.find(x => x.nazev === hodnota);
    return r ? r.cil : null;
  }

  function predikat(bezAutora) {
    const f = Object.assign({}, S.filtr);
    if (bezAutora) f.autor = '';
    return J.predikatFiltru(f);
  }

  function prepocti(novyLayout) {
    const m = S.model;
    if (!m) return;
    const vybranySha = S.vybrany >= 0 && S.radky[S.vybrany] ? S.radky[S.vybrany].sha : null;
    if (novyLayout) {
      const tip = tipVetve(S.filtr.vetev);
      if (tip) { const mn = J.dosazitelne(m, [tip]); S.radky = m.commity.filter(c => mn.has(c.sha)); }
      else S.radky = m.commity;
      S.rozvrh = J.rozvrhni(S.radky);
      S.vybrany = vybranySha && S.rozvrh.radek.has(vybranySha) ? S.rozvrh.radek.get(vybranySha) : -1;
    }
    const p = predikat(false);
    S.shoda = new Uint8Array(S.radky.length);
    S.poradiShod = [];
    S.radky.forEach((c, i) => { if (!p || p(c)) { S.shoda[i] = 1; S.poradiShod.push(i); } });
    S.pocetShod = S.poradiShod.length;
    S.filtrAktivni = !!p;
    vykresliStavFiltru();
    vykresliDlazdice();
    vykresliVysledky();
    kresliGraf();
    kresliAktivitu();
    vykresliCasy();
    vykresliAutory();
    vykresliSoubory();
  }

  /* ---------- výběry ---------- */
  function naplnVybery() {
    const m = S.model;
    const sv = $('f-vetev');
    const typy = [['vetev', 'Větve'], ['vzdalena', 'Vzdálené větve'], ['znacka', 'Značky'], ['jina', 'Ostatní']];
    let h = '<option value="">Všechny načtené commity</option>';
    if (m.head && m.podleSha.has(m.head)) h += '<option value="HEAD">HEAD' + (m.headRef ? ' (' + esc(J.kratkyNazev(m.headRef)) + ')' : '') + '</option>';
    for (const [t, n] of typy) {
      const r = m.refs.filter(x => x.typ === t && !x.mimo);
      if (r.length) h += '<optgroup label="' + n + '">' + r.map(x => '<option value="' + esc(x.nazev) + '">' + esc(x.kratky) + '</option>').join('') + '</optgroup>';
    }
    sv.innerHTML = h;
    const au = J.statistikyAutoru(m.commity, 'utc');
    $('f-autor').innerHTML = '<option value="">Všichni (' + au.length + ')</option>' + au.map(a => '<option value="' + esc(a.klic) + '">' + esc(a.jmeno) + ' (' + cislo(a.commity) + ')</option>').join('');
    $('pasmo').value = S.pasmo;
    $('pasmo').querySelector('option[value="autor"]').disabled = !m.tzZnamy;
    $('krok').value = S.krok;
  }

  /* ---------- úplnost a dlaždice ---------- */
  function vykresliUplnost() {
    const m = S.model, u = m.uplnost;
    const el = $('uplnost');
    el.className = 'uplnost ' + u.uroven;
    const stitek = { uplny: 'Úplný DAG', neuplny: 'Neúplná data', seznam: 'Bez vztahů' }[u.uroven];
    let h = '<b class="stitek">' + stitek + '</b>' + esc(u.text) + ' <span style="color:var(--text-muted)">Zdroj: ' + esc(S.zdrojPopis);
    if (m.vytvoreno) h += ', export ' + esc(new Date(m.vytvoreno).toLocaleString('cs-CZ'));
    if (m.api && m.api.nacteno) h += ', načteno ' + esc(new Date(m.api.nacteno).toLocaleString('cs-CZ'));
    h += '.</span>';
    const pozn = m.varovani.slice();
    if (m.zdroj === 'github-api') {
      pozn.push('Stránkování: ' + (m.api && m.api.dalsi ? 'k dispozici jsou další stránky – historie je oříznutá.' : 'poslední načtená větev je kompletní, ale jiné větve se zobrazí jen po přidání.'));
      pozn.push('Čas: GitHub vrací UTC; „místní čas autora“ není k dispozici. Změny souborů nejsou v seznamu commitů.');
    }
    if (m.zdroj === 'rychly-text') pozn.push('Rychlý formát nemá tělo zpráv, commitera ani statistiky souborů.');
    if (!m.maSoubory && m.zdroj !== 'github-api') pozn.push('Data neobsahují statistiky souborů – vývoj souborů nelze zobrazit.');
    if (pozn.length) h += '<ul>' + pozn.map(p => '<li>' + esc(p) + '</li>').join('') + '</ul>';
    el.innerHTML = h;
  }

  function vykresliDlazdice() {
    const m = S.model, rs = S.radky;
    const merge = rs.filter(c => c.rodice.length > 1).length;
    let min = Infinity, max = -Infinity;
    for (const c of rs) if (Number.isFinite(c.ms)) { if (c.ms < min) min = c.ms; if (c.ms > max) max = c.ms; }
    const autori = new Set(rs.map(J.klicAutora)).size;
    const vetvi = m.refs.filter(r => (r.typ === 'vetev' || r.typ === 'vzdalena') && !r.mimo).length;
    const znacek = m.refs.filter(r => r.typ === 'znacka' && !r.mimo).length;
    const d = [
      [cislo(rs.length), S.filtr.vetev ? 'commitů ve větvi' : 'commitů'],
      [cislo(merge), 'merge commitů'],
      [cislo(autori), 'autorů'],
      [cislo(vetvi), 'větví'],
      [cislo(znacek), 'značek'],
      [cislo(S.rozvrh.sirka), 'pruhů grafu'],
      [Number.isFinite(min) ? Math.max(1, Math.round((max - min) / J.DEN_MS)) + ' d' : '–', Number.isFinite(min) ? datumMs(min) + ' – ' + datumMs(max) : 'období'],
      [cislo(m.chybejiciRodice.size), 'rodičů mimo data']
    ];
    $('dlazdice').innerHTML = d.map(x => '<div><b>' + esc(x[0]) + '</b><span>' + esc(x[1]) + '</span></div>').join('');
  }

  function vykresliStavFiltru() {
    const f = S.filtr, casti = [];
    const cip = (text, co) => '<span class="cip"><span>' + esc(text) + '</span><button data-zrus="' + co + '" aria-label="Zrušit filtr">×</button></span>';
    if (f.vetev) casti.push(cip('větev: ' + (f.vetev === 'HEAD' ? 'HEAD' : J.kratkyNazev(f.vetev)), 'vetev'));
    if (f.autor) { const o = $('f-autor').selectedOptions[0]; casti.push(cip('autor: ' + (o ? o.textContent : f.autor), 'autor')); }
    if (Number.isFinite(f.od) || Number.isFinite(f.do)) casti.push(cip('období: ' + ($('f-od').value || '…') + ' – ' + ($('f-do').value || '…'), 'obdobi'));
    if (f.dotaz) casti.push(cip('hledání: ' + f.dotaz, 'dotaz'));
    if (f.soubor) casti.push(cip('soubor: ' + f.soubor, 'soubor'));
    $('stav-filtru').innerHTML = (S.filtrAktivni ? '<span>Zvýrazněno <b>' + cislo(S.pocetShod) + '</b> z ' + cislo(S.radky.length) + ' commitů.</span>' : '<span>Zobrazeno ' + cislo(S.radky.length) + ' commitů.</span>') + casti.join('');
    $('zrus-obdobi').hidden = !(Number.isFinite(f.od) || Number.isFinite(f.do));
  }

  function zrusFiltr(co) {
    if (co === 'vetev') { S.filtr.vetev = ''; $('f-vetev').value = ''; prepocti(true); return; }
    if (co === 'autor') { S.filtr.autor = ''; $('f-autor').value = ''; }
    if (co === 'obdobi') { S.filtr.od = S.filtr.do = null; $('f-od').value = $('f-do').value = ''; }
    if (co === 'dotaz') { S.filtr.dotaz = ''; $('f-hledat').value = ''; }
    if (co === 'soubor') S.filtr.soubor = '';
    prepocti(false);
  }

  function vykresliVysledky() {
    const el = $('vysledky');
    if (!S.filtr.dotaz && !S.filtr.soubor) { el.hidden = true; return; }
    el.hidden = false;
    if (!S.poradiShod.length) { el.innerHTML = '<p class="napoveda" style="padding:6px 8px;margin:0">Nic nenalezeno.</p>'; return; }
    const max = 300;
    el.innerHTML = S.poradiShod.slice(0, max).map(i => { const c = S.radky[i]; return '<button data-radek="' + i + '"><span class="mono">' + kratke(c.sha) + '</span> ' + esc(c.predmet) + ' <span style="color:var(--text-muted)">– ' + esc(c.autor) + ', ' + datum(c) + '</span></button>'; }).join('') +
      (S.poradiShod.length > max ? '<p class="napoveda" style="padding:6px 8px;margin:0">… a dalších ' + cislo(S.poradiShod.length - max) + '. Upřesněte hledání.</p>' : '');
  }

  /* ============================================================
     Graf commitů (plátno, vlastní posouvání a měřítko)
     ============================================================ */
  const G = { w: 0, h: 0, ctx: null };
  const rozmery = () => {
    const rowH = Math.max(3, 24 * S.z);
    const laneW = Math.max(4, Math.min(22, 16 * Math.sqrt(S.z)));
    const osa = G.w < 480 ? 58 : 78;
    return { rowH, laneW, osa };
  };
  function omezPosun() {
    const { rowH, laneW, osa } = rozmery();
    const maxY = Math.max(0, S.radky.length * rowH - G.h + rowH);
    S.sy = Math.min(Math.max(0, S.sy), maxY);
    const grafW = osa + (S.rozvrh ? S.rozvrh.sirka : 1) * laneW + 20;
    const maxX = Math.max(0, grafW - G.w * 0.6);
    S.sx = Math.min(Math.max(0, S.sx), maxX);
  }

  function kresliGraf() {
    const cv = $('graf');
    if (!S.model || $('karta-graf').hidden) return;
    const { ctx, w, h } = pripravPlatno(cv);
    G.ctx = ctx; G.w = w; G.h = h;
    omezPosun();
    const { rowH, laneW, osa } = rozmery();
    const rs = S.radky, R = S.rozvrh, n = rs.length;
    ctx.fillStyle = B.bg; ctx.fillRect(0, 0, w, h);
    if (!n) { ctx.fillStyle = B.muted; ctx.font = '14px sans-serif'; ctx.fillText('Žádné commity.', 16, 30); return; }
    const x0 = osa - S.sx;
    const X = (l) => x0 + l * laneW + laneW / 2;
    const Y = (r) => r * rowH + rowH / 2 - S.sy;
    const r0 = Math.max(0, Math.floor(S.sy / rowH) - 1), r1 = Math.min(n - 1, Math.ceil((S.sy + h) / rowH) + 1);
    const tlum = S.filtrAktivni;

    // pruh vybraného řádku
    if (S.vybrany >= r0 && S.vybrany <= r1) { ctx.fillStyle = B.accent; ctx.globalAlpha = 0.14; ctx.fillRect(0, Y(S.vybrany) - rowH / 2, w, rowH); ctx.globalAlpha = 1; }
    if (S.hover >= r0 && S.hover <= r1 && S.hover !== S.vybrany) { ctx.fillStyle = B.text; ctx.globalAlpha = 0.05; ctx.fillRect(0, Y(S.hover) - rowH / 2, w, rowH); ctx.globalAlpha = 1; }

    // hrany
    ctx.lineWidth = Math.max(1, Math.min(2.2, rowH / 10));
    ctx.lineCap = 'round';
    for (const e of R.hrany) {
      if (e.neplatna) continue;
      const konec = e.chybi ? e.od + 1 : e.do;
      if (konec < r0 || e.od > r1) continue;
      const xa = X(R.pruh[e.od]), ya = Y(e.od);
      const aktivni = !tlum || S.shoda[e.od] || (!e.chybi && S.shoda[e.do]);
      ctx.globalAlpha = aktivni ? 1 : 0.22;
      ctx.strokeStyle = barvaPruhu(e.draha);
      ctx.beginPath();
      if (e.chybi) {
        ctx.setLineDash([3, 3]);
        const xb = X(e.draha) + (e.k > 0 ? laneW * 0.6 : 0);
        ctx.moveTo(xa, ya); ctx.lineTo(xb, ya + rowH * 0.62); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(xb, ya + rowH * 0.62, Math.max(1.5, rowH * 0.08), 0, 7); ctx.fillStyle = ctx.strokeStyle; ctx.fill();
        continue;
      }
      const xd = X(e.draha), yd = Y(e.do), xp = X(R.pruh[e.do]);
      ctx.moveTo(xa, ya);
      if (e.do === e.od + 1) {
        if (xa === xp) ctx.lineTo(xp, yd); else ctx.bezierCurveTo(xa, ya + rowH * 0.5, xp, yd - rowH * 0.5, xp, yd);
      } else {
        const y1 = Y(e.od + 1), y2 = Y(e.do - 1);
        if (xa === xd) ctx.lineTo(xd, y1); else ctx.bezierCurveTo(xa, ya + rowH * 0.6, xd, y1 - rowH * 0.6, xd, y1);
        ctx.lineTo(xd, y2);
        if (xd === xp) ctx.lineTo(xp, yd); else ctx.bezierCurveTo(xd, y2 + rowH * 0.6, xp, yd - rowH * 0.6, xp, yd);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // uzly
    const rad = Math.max(1.5, Math.min(rowH * 0.3, laneW * 0.38, 6));
    for (let i = r0; i <= r1; i++) {
      const c = rs[i], x = X(R.pruh[i]), y = Y(i);
      ctx.globalAlpha = !tlum || S.shoda[i] ? 1 : 0.25;
      const bar = barvaPruhu(R.pruh[i]);
      ctx.beginPath(); ctx.arc(x, y, rad, 0, 7);
      if (c.rodice.length > 1) { ctx.fillStyle = B.bg; ctx.fill(); ctx.lineWidth = Math.max(1.2, rad * 0.45); ctx.strokeStyle = bar; ctx.stroke(); }
      else { ctx.fillStyle = bar; ctx.fill(); }
      if (c.sha === S.model.head) { ctx.beginPath(); ctx.arc(x, y, rad + 2.5, 0, 7); ctx.lineWidth = 1.5; ctx.strokeStyle = B.text; ctx.stroke(); }
      if (i === S.vybrany) { ctx.beginPath(); ctx.arc(x, y, rad + 4, 0, 7); ctx.lineWidth = 2; ctx.strokeStyle = B.accent; ctx.stroke(); }
    }
    ctx.globalAlpha = 1;

    // časová osa vlevo
    ctx.fillStyle = B.bg; ctx.fillRect(0, 0, osa - 4, h);
    ctx.strokeStyle = B.border; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(osa - 4.5, 0); ctx.lineTo(osa - 4.5, h); ctx.stroke();
    const fs = Math.max(9, Math.min(12, rowH * 0.5));
    ctx.textBaseline = 'middle';
    let posledniMesic = null, posledniY = -100;
    for (let i = r0; i <= r1; i++) {
      const c = rs[i];
      if (!Number.isFinite(c.ms)) continue;
      const d = new Date(J.mistniCas(c, pasmo()).posunutyMs);
      const mes = d.getUTCFullYear() * 12 + d.getUTCMonth();
      const y = Y(i);
      const predchozi = i > 0 && Number.isFinite(rs[i - 1].ms) ? (() => { const p = new Date(J.mistniCas(rs[i - 1], pasmo()).posunutyMs); return p.getUTCFullYear() * 12 + p.getUTCMonth(); })() : null;
      if (predchozi !== mes) {
        ctx.strokeStyle = B.border; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.moveTo(0, y - rowH / 2 + 0.5); ctx.lineTo(w, y - rowH / 2 + 0.5); ctx.stroke(); ctx.globalAlpha = 1;
      }
      if (rowH >= 15) {
        ctx.font = fs + 'px sans-serif'; ctx.fillStyle = B.muted;
        ctx.fillText(G.w < 480 ? d.getUTCDate() + '. ' + (d.getUTCMonth() + 1) + '. ' + String(d.getUTCFullYear()).slice(2) : d.getUTCDate() + '. ' + (d.getUTCMonth() + 1) + '. ' + d.getUTCFullYear(), 6, y);
      } else if (mes !== posledniMesic && y - posledniY > 14 && predchozi !== mes) {
        ctx.font = '600 10px sans-serif'; ctx.fillStyle = B.muted;
        ctx.fillText(MESICE[d.getUTCMonth()] + ' ' + d.getUTCFullYear(), 6, Math.max(6, y));
        posledniY = y;
      }
      posledniMesic = mes;
    }

    // texty
    if (rowH >= 13) {
      const xt0 = x0 + R.sirka * laneW + 10;
      const fsT = Math.max(10, Math.min(13, rowH * 0.54));
      for (let i = r0; i <= r1; i++) {
        const c = rs[i], y = Y(i);
        let x = Math.max(xt0, osa + 4);
        ctx.globalAlpha = !tlum || S.shoda[i] ? 1 : 0.4;
        const refs = S.model.refsPodleSha.get(c.sha) || [];
        ctx.font = '600 ' + (fsT - 1) + 'px sans-serif';
        const hlavicka = c.sha === S.model.head;
        const stitky = refs.map(r => ({ t: (r.typ === 'znacka' ? '◆ ' : '') + r.kratky + (hlavicka && S.model.headRef === r.nazev ? ' ← HEAD' : ''), r }));
        if (hlavicka && !refs.some(r => r.nazev === S.model.headRef)) stitky.unshift({ t: 'HEAD', r: { typ: 'head' } });
        for (const s of stitky.slice(0, 4)) {
          const t = zkrat(ctx, s.t, 160);
          const tw = ctx.measureText(t).width + 10;
          if (x + tw > w - 20) break;
          const bh = Math.min(rowH - 4, fsT + 6);
          ctx.fillStyle = s.r.typ === 'znacka' ? B.panel : B.deep;
          ctx.strokeStyle = s.r.typ === 'znacka' ? B.warn : (s.r.typ === 'head' ? B.text : barvaPruhu(R.pruh[i]));
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y - bh / 2, tw, bh, 4) : ctx.rect(x, y - bh / 2, tw, bh); ctx.fill(); ctx.stroke();
          ctx.fillStyle = B.text; ctx.fillText(t, x + 5, y + 0.5);
          x += tw + 5;
        }
        if (stitky.length > 4) { ctx.fillStyle = B.muted; ctx.fillText('+' + (stitky.length - 4), x, y); x += 22; }
        ctx.font = (c.rodice.length > 1 ? 'italic ' : '') + fsT + 'px sans-serif';
        const pravy = w > 640 ? 230 : 0;
        ctx.fillStyle = B.text;
        ctx.fillText(zkrat(ctx, c.predmet || '(bez zprávy)', w - x - pravy - 12), x, y);
        if (pravy) {
          ctx.font = (fsT - 1) + 'px sans-serif'; ctx.fillStyle = B.muted;
          ctx.fillText(zkrat(ctx, c.autor, 150), w - pravy, y);
          ctx.font = (fsT - 1) + 'px ui-monospace, Menlo, Consolas, monospace'; ctx.fillStyle = B.faint;
          ctx.fillText(kratke(c.sha), w - 82, y);
        }
      }
      ctx.globalAlpha = 1;
    }

    // posuvník
    const celk = n * rowH;
    if (celk > h) {
      const vh = Math.max(24, h * h / celk), vy = (S.sy / (celk - h + rowH)) * (h - vh);
      ctx.fillStyle = B.borderStrong; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(w - 7, vy, 5, vh, 3) : ctx.rect(w - 7, vy, 5, vh); ctx.fill(); ctx.globalAlpha = 1;
      // shody na posuvníku
      if (S.filtrAktivni && S.pocetShod < n) {
        ctx.fillStyle = B.accent;
        const krok = Math.max(1, Math.floor(S.poradiShod.length / 600));
        for (let k = 0; k < S.poradiShod.length; k += krok) ctx.fillRect(w - 12, S.poradiShod[k] / n * h, 4, 2);
      }
    }
  }

  let kresliPlan = false;
  function prekresli() { if (kresliPlan) return; kresliPlan = true; requestAnimationFrame(() => { kresliPlan = false; kresliGraf(); }); }

  function radekNa(y) { const { rowH } = rozmery(); const r = Math.floor((y + S.sy) / rowH); return r >= 0 && r < S.radky.length ? r : -1; }

  function zobrazRadek(i, stred) {
    const { rowH } = rozmery();
    const y = i * rowH;
    if (stred || y < S.sy || y + rowH > S.sy + G.h) S.sy = y - G.h / 2 + rowH / 2;
    omezPosun();
  }

  function vyber(i, stred) {
    if (i < 0 || i >= S.radky.length) return;
    S.vybrany = i;
    zobrazRadek(i, stred);
    prekresli();
    vykresliDetail();
  }

  function zoom(f, cy) {
    const { rowH } = rozmery();
    const kotva = (S.sy + (cy === undefined ? G.h / 2 : cy)) / rowH;
    S.z = Math.min(3, Math.max(0.12, S.z * f));
    const n = rozmery().rowH;
    S.sy = kotva * n - (cy === undefined ? G.h / 2 : cy);
    omezPosun(); prekresli(); ulozNastaveni();
  }

  function bublina(i, mx, my) {
    const b = $('bublina');
    if (i < 0) { b.hidden = true; return; }
    const c = S.radky[i];
    const refs = (S.model.refsPodleSha.get(c.sha) || []).map(r => r.kratky);
    b.innerHTML = '<b>' + esc(c.predmet || '(bez zprávy)') + '</b><br>' + esc(c.autor) + ' · ' + datum(c, true) +
      '<br><span class="mono">' + kratke(c.sha) + '</span>' + (c.rodice.length > 1 ? ' · merge (' + c.rodice.length + ' rodiče)' : '') + (refs.length ? '<br>' + esc(refs.join(', ')) : '');
    b.hidden = false;
    const ob = $('platno-obal').getBoundingClientRect();
    const bw = b.offsetWidth, bh = b.offsetHeight;
    b.style.left = Math.max(4, Math.min(mx + 14, ob.width - bw - 4)) + 'px';
    b.style.top = (my + 16 + bh > ob.height ? my - bh - 10 : my + 16) + 'px';
  }

  function napojGraf() {
    const cv = $('graf');
    const ukazatele = new Map();
    let tah = null, pinch = null;
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) { zoom(Math.exp(-e.deltaY * 0.0025), e.clientY - r.top); return; }
      const k = e.deltaMode === 1 ? 20 : (e.deltaMode === 2 ? G.h : 1);
      if (e.shiftKey && !e.deltaX) S.sx += e.deltaY * k; else { S.sy += e.deltaY * k; S.sx += e.deltaX * k; }
      omezPosun(); prekresli();
    }, { passive: false });
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      ukazatele.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ukazatele.size === 2) {
        const [a, b] = [...ukazatele.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: S.z }; tah = null;
      } else tah = { x: e.clientX, y: e.clientY, sx: S.sx, sy: S.sy, pohyb: false };
    });
    cv.addEventListener('pointermove', (e) => {
      const r = cv.getBoundingClientRect();
      if (ukazatele.has(e.pointerId)) ukazatele.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && ukazatele.size === 2) {
        const [a, b] = [...ukazatele.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const cil = Math.min(3, Math.max(0.12, pinch.z * d / Math.max(10, pinch.d)));
        zoom(cil / S.z, (a.y + b.y) / 2 - r.top);
        return;
      }
      if (tah) {
        const dx = e.clientX - tah.x, dy = e.clientY - tah.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) { tah.pohyb = true; cv.classList.add('tahne'); $('bublina').hidden = true; }
        if (tah.pohyb) { S.sx = tah.sx - dx; S.sy = tah.sy - dy; omezPosun(); prekresli(); }
        return;
      }
      if (e.pointerType === 'mouse') {
        const i = radekNa(e.clientY - r.top);
        if (i !== S.hover) { S.hover = i; prekresli(); }
        bublina(i, e.clientX - r.left, e.clientY - r.top);
      }
    });
    const konec = (e) => {
      ukazatele.delete(e.pointerId);
      if (ukazatele.size < 2) pinch = null;
      if (tah && !tah.pohyb && e.type === 'pointerup') {
        const r = cv.getBoundingClientRect();
        const i = radekNa(e.clientY - r.top);
        if (i >= 0) vyber(i, false);
      }
      tah = null; cv.classList.remove('tahne');
    };
    cv.addEventListener('pointerup', konec);
    cv.addEventListener('pointercancel', konec);
    cv.addEventListener('pointerleave', () => { S.hover = -1; $('bublina').hidden = true; prekresli(); });
    cv.addEventListener('keydown', (e) => {
      const n = S.radky.length; if (!n) return;
      const strana = Math.max(1, Math.floor(G.h / rozmery().rowH) - 1);
      let i = S.vybrany < 0 ? 0 : S.vybrany;
      if (e.key === 'ArrowDown') i++; else if (e.key === 'ArrowUp') i--;
      else if (e.key === 'PageDown') i += strana; else if (e.key === 'PageUp') i -= strana;
      else if (e.key === 'Home') i = 0; else if (e.key === 'End') i = n - 1;
      else if (e.key === '+' || e.code === 'NumpadAdd' || e.key === '=') { zoom(1.25); e.preventDefault(); return; }
      else if (e.key === '-' || e.code === 'NumpadSubtract') { zoom(0.8); e.preventDefault(); return; }
      else if (e.key === 'ArrowLeft') { S.sx -= 40; omezPosun(); prekresli(); e.preventDefault(); return; }
      else if (e.key === 'ArrowRight') { S.sx += 40; omezPosun(); prekresli(); e.preventDefault(); return; }
      else return;
      e.preventDefault();
      vyber(Math.max(0, Math.min(n - 1, i)), false);
    });
    $('z-plus').onclick = () => zoom(1.3);
    $('z-minus').onclick = () => zoom(1 / 1.3);
    $('z-prehled').onclick = () => { const n = Math.max(1, S.radky.length); S.z = Math.min(3, Math.max(0.12, (G.h - 10) / n / 24)); S.sy = 0; omezPosun(); prekresli(); ulozNastaveni(); };
    $('z-head').onclick = () => { if (S.model && S.model.head && S.rozvrh.radek.has(S.model.head)) vyber(S.rozvrh.radek.get(S.model.head), true); else Dialog.info('HEAD není v zobrazených datech.'); };
    const skok = (smer) => {
      if (!S.poradiShod.length) return;
      const v = S.vybrany;
      let i = smer > 0 ? S.poradiShod.find(x => x > v) : [...S.poradiShod].reverse().find(x => x < v);
      if (i === undefined) i = smer > 0 ? S.poradiShod[0] : S.poradiShod[S.poradiShod.length - 1];
      vyber(i, true);
    };
    $('z-dalsi').onclick = () => skok(1);
    $('z-predchozi').onclick = () => skok(-1);
  }

  /* ---------- detail commitu ---------- */
  function odkazSha(sha) {
    if (S.rozvrh && S.rozvrh.radek.has(sha)) return '<button class="odkaz" data-sha="' + sha + '">' + kratke(sha) + '</button>';
    if (S.model.podleSha.has(sha)) return '<button class="odkaz" data-sha="' + sha + '" title="Mimo zvolenou větev – klepnutím zrušíte filtr větve">' + kratke(sha) + '</button> <span class="mimo">(mimo zvolenou větev)</span>';
    return '<span class="mono">' + kratke(sha) + '</span> <span class="mimo">mimo načtená data</span>';
  }

  function vykresliDetail() {
    const el = $('detail');
    const c = S.radky[S.vybrany];
    if (!c) { el.innerHTML = '<p class="napoveda" style="margin:0">Klepněte na commit v grafu.</p>'; return; }
    const m = S.model;
    const refs = m.refsPodleSha.get(c.sha) || [];
    const deti = m.deti.get(c.sha) || [];
    let h = '<h4>' + esc(c.predmet || '(bez zprávy)') + '</h4>';
    if (refs.length || c.sha === m.head) {
      h += '<div>' + (c.sha === m.head ? '<span class="ref">HEAD</span>' : '') + refs.map(r => '<span class="ref ' + r.typ + '" title="' + esc(r.nazev + (r.zprava ? ' – ' + r.zprava : '')) + '">' + (r.typ === 'znacka' ? '◆ ' : '') + esc(r.kratky) + '</span>').join('') + '</div>';
    }
    if (c.telo) h += '<div class="telo">' + esc(c.telo) + '</div>';
    h += '<dl>';
    h += '<dt>SHA</dt><dd><span class="mono" style="font-size:0.78rem">' + c.sha + '</span> <button class="male" data-kopiruj-text="' + c.sha + '">Kopírovat</button></dd>';
    h += '<dt>Autor</dt><dd>' + esc(c.autor) + (c.email ? ' <span style="color:var(--text-muted)">&lt;' + esc(c.email) + '&gt;</span>' : '') + (c.login ? ' (@' + esc(c.login) + ')' : '') + '</dd>';
    h += '<dt>Datum</dt><dd>' + datum(c, true) + (pasmo() === 'autor' && c.tz !== null ? ' <span style="color:var(--text-muted)">(' + tzText(c.tz) + ')</span>' : (pasmo() === 'utc' ? ' UTC' : '')) + '</dd>';
    if (c.commiter && (c.commiter !== c.autor || (c.datumCommitText && c.datumCommitText !== c.datumText))) {
      h += '<dt>Commiter</dt><dd>' + esc(c.commiter) + (c.datumCommitText ? ', ' + esc(new Date(J.parsujIso(c.datumCommitText).ms).toLocaleString('cs-CZ')) : '') + '</dd>';
    }
    h += '<dt>' + (c.rodice.length > 1 ? 'Rodiče (merge)' : 'Rodič') + '</dt><dd>' + (c.rodice.length ? c.rodice.map((p, k) => odkazSha(p) + (c.rodice.length > 1 ? ' <span style="color:var(--text-muted)">' + (k === 0 ? '(1. – hlavní linie)' : '(' + (k + 1) + '.)') + '</span>' : '')).join('<br>') : (m.rodiceZnamy ? '— (kořenový commit)' : '<span class="mimo">neznámé – data jsou jen seznam</span>')) + '</dd>';
    h += '<dt>Potomci</dt><dd>' + (deti.length ? deti.map(odkazSha).join('<br>') : '<span style="color:var(--text-muted)">žádní v načtených datech</span>') + '</dd>';
    h += '<dt>Řádek</dt><dd>' + cislo(S.vybrany + 1) + ' z ' + cislo(S.radky.length) + ', pruh ' + (S.rozvrh.pruh[S.vybrany] + 1) + '</dd>';
    h += '</dl>';
    if (m.zdroj === 'github-api' && m.api) {
      h += '<p><a href="https://github.com/' + encodeURIComponent(m.api.vlastnik) + '/' + encodeURIComponent(m.api.repo) + '/commit/' + c.sha + '" target="_blank" rel="noopener" style="color:var(--accent)">Otevřít na GitHubu ↗</a></p>';
    }
    if (c.soubory && c.soubory.length) {
      const plus = c.soubory.reduce((s, f) => s + (f.plus || 0), 0), minus = c.soubory.reduce((s, f) => s + (f.minus || 0), 0);
      h += '<h3>Změněné soubory (' + cislo(c.soubory.length) + ') <span class="plus">+' + cislo(plus) + '</span> <span class="minus">−' + cislo(minus) + '</span></h3>';
      if (c.rodice.length > 1) h += '<p class="napoveda">U merge commitu jsou změny vůči prvnímu rodiči' + (m.numstatMerge === 'first-parent' || m.zdroj === 'github-api' ? '' : ' (v tomto exportu chybí)') + '.</p>';
      if (c.souboryOrezane) h += '<p class="napoveda">GitHub vrací nejvýše 300 souborů na stránku – seznam může být neúplný.</p>';
      const max = Math.max(1, ...c.soubory.map(f => (f.plus || 0) + (f.minus || 0)));
      h += '<ul class="soubory">' + c.soubory.slice(0, 500).map(f => {
        const bin = f.plus === null;
        const sirka = bin ? 0 : 60 * ((f.plus + f.minus) / max);
        return '<li><span class="cesta">' + (f.puvodni ? '<span style="color:var(--text-muted)">' + esc(f.puvodni) + ' → </span>' : '') + '<button class="odkaz" style="font-family:inherit" data-soubor="' + esc(f.cesta) + '" title="Zvýraznit commity měnící tento soubor">' + esc(f.cesta) + '</button></span>' +
          '<span>' + (bin ? '<span style="color:var(--text-muted)">binární</span>' : '<span class="plus">+' + cislo(f.plus) + '</span> <span class="minus">−' + cislo(f.minus) + '</span>') + '</span>' +
          '<span class="pruzek" style="width:' + Math.max(2, sirka) + 'px">' + (bin ? '' : '<i class="p" style="width:' + (100 * f.plus / Math.max(1, f.plus + f.minus)) + '%"></i><i class="m" style="flex:1"></i>') + '</span></li>';
      }).join('') + '</ul>';
      if (c.soubory.length > 500) h += '<p class="napoveda">Zobrazeno prvních 500 souborů.</p>';
    } else if (c.soubory && !c.soubory.length) {
      h += '<p class="napoveda">Commit nemění žádný soubor' + (c.rodice.length > 1 ? ' vůči prvnímu rodiči' : '') + '.</p>';
    } else if (m.zdroj === 'github-api' && m.api) {
      h += '<p><button id="gh-soubory" data-sha="' + c.sha + '">Načíst změněné soubory z API (1 požadavek)</button></p>';
    } else {
      h += '<p class="napoveda">Data neobsahují statistiku souborů.</p>';
    }
    el.innerHTML = h;
  }

  /* ============================================================
     Aktivita v čase (sloupcový graf s výběrem období)
     ============================================================ */
  const A = { data: null, oblast: null, vyber: null };
  function kresliAktivitu() {
    if (!S.model || $('karta-aktivita').hidden) return;
    const cv = $('aktivita');
    const { ctx, w, h } = pripravPlatno(cv);
    const p = predikat(false);
    const akt = J.aktivita(S.radky, S.krok || null, pasmo(), p);
    A.data = akt;
    const it = akt.intervaly;
    if (!it.length) return;
    const ml = 36, mr = 8, mt = 10, mb = 24;
    const pw = w - ml - mr, ph = h - mt - mb;
    A.oblast = { ml, pw, mt, ph };
    let max = 1; for (const x of it) if (x.pocet > max) max = x.pocet;
    // „pěkné“ maximum osy
    const kr = Math.pow(10, Math.floor(Math.log10(max))); const nice = [1, 2, 5, 10].map(k => k * kr).find(v => v >= max) || max;
    const y = (v) => mt + ph - (v / nice) * ph;
    ctx.font = '11px sans-serif'; ctx.textBaseline = 'middle';
    for (let k = 0; k <= 2; k++) {
      const v = nice * k / 2, yy = Math.round(y(v)) + 0.5;
      ctx.strokeStyle = B.border; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ml, yy); ctx.lineTo(w - mr, yy); ctx.stroke();
      ctx.fillStyle = B.muted; ctx.textAlign = 'right'; ctx.fillText(cislo(v, v % 1 ? 1 : 0), ml - 6, yy);
    }
    const bw = pw / it.length, mezera = bw > 4 ? Math.min(2, bw * 0.2) : 0;
    const vybrane = (x) => (!Number.isFinite(S.filtr.od) || x.do > S.filtr.od) && (!Number.isFinite(S.filtr.do) || x.od < S.filtr.do);
    it.forEach((x, i) => {
      const bx = ml + i * bw + mezera / 2, bwi = Math.max(0.6, bw - mezera);
      if (x.pocet) { ctx.fillStyle = B.accent; ctx.globalAlpha = 0.25; ctx.fillRect(bx, y(x.pocet), bwi, y(0) - y(x.pocet)); }
      if (x.shoda) { ctx.globalAlpha = 1; ctx.fillStyle = B.accent; const yy = y(x.shoda); ctx.beginPath(); ctx.roundRect && bwi > 4 ? ctx.roundRect(bx, yy, bwi, y(0) - yy, [Math.min(4, bwi / 2), Math.min(4, bwi / 2), 0, 0]) : ctx.rect(bx, yy, bwi, y(0) - yy); ctx.fill(); }
      ctx.globalAlpha = 1;
    });
    // vyznačené období
    if (Number.isFinite(S.filtr.od) || Number.isFinite(S.filtr.do) || A.vyber) {
      let a, b;
      if (A.vyber) { a = Math.min(A.vyber.a, A.vyber.b); b = Math.max(A.vyber.a, A.vyber.b); }
      else {
        const i0 = it.findIndex(vybrane); let i1 = -1; for (let i = it.length - 1; i >= 0; i--) if (vybrane(it[i])) { i1 = i; break; }
        a = i0 < 0 ? 0 : ml + i0 * bw; b = i1 < 0 ? 0 : ml + (i1 + 1) * bw;
      }
      ctx.fillStyle = B.text; ctx.globalAlpha = 0.08; ctx.fillRect(a, mt, b - a, ph); ctx.globalAlpha = 1;
      ctx.strokeStyle = B.accent; ctx.lineWidth = 1.5; ctx.strokeRect(a + 0.5, mt + 0.5, Math.max(1, b - a - 1), ph - 1);
    }
    // osa x
    ctx.strokeStyle = B.borderStrong; ctx.beginPath(); ctx.moveTo(ml, y(0) + 0.5); ctx.lineTo(w - mr, y(0) + 0.5); ctx.stroke();
    ctx.fillStyle = B.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const popis = (x) => { const d = new Date(x.od); return akt.krok === 'mesic' ? MESICE[d.getUTCMonth()] + ' ' + d.getUTCFullYear() : d.getUTCDate() + '. ' + (d.getUTCMonth() + 1) + '. ' + d.getUTCFullYear(); };
    const sirkaPopisku = 80, kolik = Math.max(1, Math.floor(pw / sirkaPopisku));
    const krok = Math.max(1, Math.ceil(it.length / kolik));
    for (let i = 0; i < it.length; i += krok) {
      const cx = Math.min(w - mr - 34, Math.max(ml + 30, ml + (i + 0.5) * bw));
      ctx.fillText(popis(it[i]), cx, y(0) + 6);
    }
    ctx.textAlign = 'left';
    $('aktivita-popis').textContent = 'Krok: ' + ({ den: 'den', tyden: 'týden (od pondělí)', mesic: 'měsíc' }[akt.krok]) + ', čas: ' + popisPasma() + '. Tažením vyberete období (filtr Od–Do). Plné sloupce = commity odpovídající filtrům, světlé = ostatní ve zvolené větvi.';
  }
  function popisPasma() { return { autor: 'místní čas autora', prohlizec: 'čas tohoto zařízení', utc: 'UTC' }[pasmo()]; }

  function napojAktivitu() {
    const cv = $('aktivita');
    const index = (x) => { const o = A.oblast; if (!o || !A.data) return -1; const i = Math.floor((x - o.ml) / (o.pw / A.data.intervaly.length)); return i >= 0 && i < A.data.intervaly.length ? i : -1; };
    cv.addEventListener('pointerdown', (e) => {
      if (!A.oblast) return;
      const r = cv.getBoundingClientRect();
      const x = e.clientX - r.left;
      A.vyber = { a: x, b: x, start: index(x) };
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', (e) => {
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left;
      const b = $('bublina-akt');
      if (A.vyber) { A.vyber.b = Math.max(A.oblast.ml, Math.min(A.oblast.ml + A.oblast.pw, x)); kresliAktivitu(); }
      const i = index(x);
      if (i < 0 || !A.data) { b.hidden = true; return; }
      const it = A.data.intervaly[i];
      const d0 = new Date(it.od), d1 = new Date(it.do - 1);
      const t = A.data.krok === 'den' ? datumMs(it.od) : datumMs(it.od) + ' – ' + datumMs(d1.getTime());
      b.innerHTML = '<b>' + esc(t) + '</b><br>' + cislo(it.pocet) + ' commitů' + (S.filtrAktivni ? ', z toho ' + cislo(it.shoda) + ' odpovídá filtrům' : '');
      b.hidden = false;
      const bw = b.offsetWidth;
      b.style.left = Math.max(0, Math.min(x + 12, r.width - bw - 4)) + 'px'; b.style.top = '4px';
      void d0;
    });
    cv.addEventListener('pointerleave', () => { $('bublina-akt').hidden = true; });
    const konec = (e) => {
      if (!A.vyber) return;
      const v = A.vyber; A.vyber = null;
      const i0 = index(Math.min(v.a, v.b)), i1 = index(Math.max(v.a, v.b));
      if (e.type === 'pointerup' && i0 >= 0 && i1 >= 0) {
        const it = A.data.intervaly;
        if (Math.abs(v.b - v.a) < 3) { // klik = jeden interval
          nastavObdobi(it[i0].od, it[i0].do);
        } else nastavObdobi(it[i0].od, it[i1].do);
      } else kresliAktivitu();
    };
    cv.addEventListener('pointerup', konec);
    cv.addEventListener('pointercancel', konec);
  }

  /** od/do jsou v „posunutém“ čase zvoleného pásma → převod na skutečné ms pro filtr. */
  function nastavObdobi(odPos, doPos) {
    const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
    $('f-od').value = iso(odPos);
    $('f-do').value = iso(doPos - J.DEN_MS);
    obdobiZPoli();
  }
  function hranice(datumText, konec) {
    if (!datumText) return null;
    const [r, m, d] = datumText.split('-').map(Number);
    let ms = Date.UTC(r, m - 1, d) + (konec ? J.DEN_MS : 0);
    // datum je v kalendáři zvoleného pásma; pro „autor“ i „zařízení“ bereme pásmo zařízení
    if (pasmo() !== 'utc') ms += new Date(ms).getTimezoneOffset() * 60000;
    return ms;
  }
  function obdobiZPoli() {
    S.filtr.od = hranice($('f-od').value, false);
    S.filtr.do = hranice($('f-do').value, true);
    prepocti(false);
  }

  /* ============================================================
     Den × hodina, histogramy
     ============================================================ */
  const DNY = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
  const DNY_PLNE = ['pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota', 'neděle'];
  function vykresliCasy() {
    if (!S.model) return;
    const p = predikat(false);
    const cs = p ? S.radky.filter(p) : S.radky;
    const dh = J.denHodina(cs, pasmo());
    let h = '<div></div>';
    for (let hod = 0; hod < 24; hod++) h += '<div class="hl">' + (hod % 3 === 0 ? hod : '') + '</div>';
    for (let d = 0; d < 7; d++) {
      h += '<div class="dl">' + DNY[d] + '</div>';
      for (let hod = 0; hod < 24; hod++) {
        const v = dh.matice[d][hod];
        const o = v ? 0.15 + 0.85 * v / dh.max : 0;
        h += '<div class="bunka" title="' + DNY_PLNE[d] + ' ' + hod + ':00–' + hod + ':59: ' + v + ' commitů">' + (v ? '<i style="opacity:' + o.toFixed(3) + '"></i>' : '') + '</div>';
      }
    }
    $('teplo').innerHTML = h;
    $('teplo-max').textContent = 'max ' + cislo(dh.max);
    $('teplo-pasmo').textContent = popisPasma() + (S.model.tzZnamy ? '' : ' (pásmo autora neznámé)');
    const sl = (pole, popisky, elS, elP, jmena) => {
      const mx = Math.max(1, ...pole);
      $(elS).innerHTML = pole.map((v, i) => '<div style="height:' + (100 * v / mx) + '%" title="' + jmena(i) + ': ' + v + ' commitů (' + cislo(dh.celkem ? 100 * v / dh.celkem : 0, 1) + ' %)"></div>').join('');
      $(elP).innerHTML = popisky.map(t => '<span>' + t + '</span>').join('');
    };
    sl(dh.dny, DNY, 'hist-dny', 'pop-dny', i => DNY_PLNE[i]);
    sl(dh.hodiny, dh.hodiny.map((_, i) => i % 3 === 0 ? i : ''), 'hist-hodiny', 'pop-hodiny', i => i + ':00–' + i + ':59');
  }

  /* ============================================================
     Autoři
     ============================================================ */
  const SLOUPCE_AUTORU = [
    ['jmeno', 'Autor'], ['commity', 'Commity'], ['merge', 'Merge'], ['plus', '+ řádky'], ['minus', '− řádky'],
    ['souboru', 'Souborů'], ['aktivnichDnu', 'Aktivních dnů'], ['prvni', 'První'], ['posledni', 'Poslední']
  ];
  function vykresliAutory() {
    if (!S.model) return;
    const p = predikat(true);
    const cs = p ? S.radky.filter(p) : S.radky;
    const au = J.statistikyAutoru(cs, pasmo());
    const { klic, smer } = S.razeniAutoru;
    au.sort((a, b) => { const x = a[klic], y = b[klic]; return (typeof x === 'string' ? x.localeCompare(y, 'cs') : x - y) * smer; });
    const celk = cs.length || 1, maxC = Math.max(1, ...au.map(a => a.commity));
    const tab = $('tab-autori');
    tab.tHead.innerHTML = '<tr>' + SLOUPCE_AUTORU.map(([k, n]) => '<th data-klic="' + k + '"' + (k === klic ? ' aria-sort="' + (smer < 0 ? 'descending' : 'ascending') + '"' : '') + '>' + n + '</th>').join('') + '</tr>';
    const md = S.model.maSoubory;
    tab.tBodies[0].innerHTML = au.slice(0, 500).map(a => '<tr data-autor="' + esc(a.klic) + '"' + (a.klic === S.filtr.autor ? ' class="vybrany"' : '') + '>' +
      '<td class="jmeno" title="' + esc(a.jmenaVse.join(', ') + (a.email ? ' <' + a.email + '>' : '')) + '">' + esc(a.jmeno) + '</td>' +
      '<td><span class="podil" style="width:' + Math.round(50 * a.commity / maxC) + 'px"></span>' + cislo(a.commity) + ' <span style="color:var(--text-muted)">(' + cislo(100 * a.commity / celk, 1) + ' %)</span></td>' +
      '<td>' + cislo(a.merge) + '</td><td class="plus">' + (md ? '+' + cislo(a.plus) : '–') + '</td><td class="minus">' + (md ? '−' + cislo(a.minus) : '–') + '</td><td>' + (md ? cislo(a.souboru) : '–') + '</td>' +
      '<td>' + cislo(a.aktivnichDnu) + '</td><td>' + (Number.isFinite(a.prvni) ? datumMs(a.prvni) : '–') + '</td><td>' + (Number.isFinite(a.posledni) ? datumMs(a.posledni) : '–') + '</td></tr>').join('') +
      (au.length > 500 ? '<tr><td colspan="9">… a dalších ' + cislo(au.length - 500) + ' autorů</td></tr>' : '');
  }

  /* ============================================================
     Vývoj souborů
     ============================================================ */
  function vykresliSoubory() {
    const el = $('soubory-obsah');
    const m = S.model;
    if (!m) return;
    if (!m.maSoubory) {
      el.innerHTML = '<p class="napoveda">' + (m.zdroj === 'github-api'
        ? 'Seznam commitů z GitHub API neobsahuje změněné soubory. Detail jednotlivého commitu lze dočíst tlačítkem v panelu detailu; pro vývoj souborů v čase použijte lokální export (úplná metadata, žádné limity).'
        : 'Načtená data neobsahují statistiky souborů (rychlý formát nebo export s --bez-souboru). Použijte export_git_json.py bez tohoto přepínače.') + '</p>';
      return;
    }
    const tip = tipVetve(S.vyvojVetev || S.filtr.vetev || 'HEAD') || (S.radky[0] && S.radky[0].sha);
    const v = J.vyvojSouboru(m, tip);
    let moznosti = '<option value="">' + (S.filtr.vetev ? 'zvolená větev filtru' : 'HEAD') + '</option>';
    moznosti += m.refs.filter(r => !r.mimo && r.typ !== 'znacka').map(r => '<option value="' + esc(r.nazev) + '"' + (r.nazev === S.vyvojVetev ? ' selected' : '') + '>' + esc(r.kratky) + '</option>').join('');
    let h = '<div class="radek" style="margin-bottom:8px"><label for="vyvoj-vetev" style="margin:0">Linie větve</label><select id="vyvoj-vetev" style="width:auto;max-width:100%">' + moznosti + '</select></div>';
    h += '<p class="napoveda" style="margin-bottom:8px">Počítá se po první-rodičovské linii (' + cislo(v.pocet) + ' commitů): součet přidaných minus odebraných řádků textových souborů. ' +
      (v.absolutni ? '<b>Linie dojde ke kořeni a všechny commity mají statistiku – počty řádků jsou absolutní.</b>'
        : '<b style="color:var(--text-mez)">Počty jsou jen relativní změny</b> (' + [!v.doKorene ? 'linie nedošla ke kořeni – starší historie chybí' : '', v.bezStatistiky ? v.bezStatistiky + ' commitů bez statistiky' : '', v.mergeBezStat ? 'merge commity v exportu nemají statistiku' : ''].filter(Boolean).join(', ') + ').') + '</p>';
    h += '<div class="grafy2"><div><h3 style="margin-top:0">Velikost kódu (řádky)</h3><div class="maly-graf"><canvas id="vyvoj-graf" aria-label="Vývoj počtu řádků"></canvas><div class="bublina" id="bublina-vyvoj" hidden></div></div></div>';
    const vybrany = S.filtr.soubor ? v.soubory.find(f => f.cesta === S.filtr.soubor) : null;
    h += '<div><h3 style="margin-top:0">' + (vybrany ? 'Soubor ' + esc(vybrany.cesta) : 'Vyberte soubor v tabulce') + '</h3><div class="maly-graf"><canvas id="vyvoj-soubor" aria-label="Vývoj vybraného souboru"></canvas></div>' +
      (vybrany && vybrany.prejmenovano.length ? '<p class="napoveda">Dříve: ' + esc(vybrany.prejmenovano.join(' → ')) + '</p>' : '') + '</div></div>';
    h += '<h3>Nejčastěji měněné soubory na linii</h3><div class="tabulka-obal vyska-tab"><table id="tab-soubory"><thead><tr><th>Soubor</th><th>Změn</th><th>+ řádky</th><th>− řádky</th><th>Řádků nyní</th><th>Stav</th></tr></thead><tbody>' +
      v.soubory.slice(0, 200).map(f => '<tr data-soubor="' + esc(f.cesta) + '"' + (f.cesta === S.filtr.soubor ? ' class="vybrany"' : '') + '><td class="jmeno" title="' + esc(f.cesta) + '">' + esc(f.cesta) + '</td><td>' + cislo(f.zmen) + '</td><td class="plus">+' + cislo(f.plus) + '</td><td class="minus">−' + cislo(f.minus) + '</td><td>' + (f.binarni ? 'binární' : cislo(f.radky)) + '</td><td>' + (f.existuje ? (f.prejmenovano.length ? 'přejmenován' : 'existuje') : 'smazán') + '</td></tr>').join('') +
      '</tbody></table></div>' + (v.soubory.length > 200 ? '<p class="napoveda">Zobrazeno 200 z ' + cislo(v.soubory.length) + ' souborů.</p>' : '') +
      '<p class="napoveda">Klepnutím na soubor zvýrazníte v grafu commity, které ho mění (filtr „soubor“). Statistiky z <code>git log --numstat</code>; binární soubory nemají řádky.</p>';
    el.innerHTML = h;
    $('vyvoj-vetev').onchange = (e) => { S.vyvojVetev = e.target.value; vykresliSoubory(); };
    const malo = v.bezStatistiky > v.pocet / 2;
    if (malo) { const cv = $('vyvoj-graf'); cv.parentNode.innerHTML = '<p class="napoveda">Statistiku souborů má jen ' + cislo(v.pocet - v.bezStatistiky) + ' z ' + cislo(v.pocet) + ' commitů linie – křivka velikosti by byla zavádějící, proto se nekreslí.</p>'; }
    else kresliCaru($('vyvoj-graf'), v.body.filter(b => Number.isFinite(b.ms)).map(b => ({ x: b.ms, y: b.velikost, sha: b.sha })), 'řádků', $('bublina-vyvoj'));
    kresliCaru($('vyvoj-soubor'), vybrany ? vybrany.historie.filter(b => Number.isFinite(b.ms)).map(b => ({ x: b.ms, y: b.radky, sha: b.sha })) : [], 'řádků');
  }

  /** Schodovitý čárový graf (hodnota platí od commitu do dalšího). */
  function kresliCaru(cv, body, jednotka, bubl) {
    if (!cv) return;
    const { ctx, w, h } = pripravPlatno(cv);
    if (!body.length) { ctx.fillStyle = B.muted; ctx.font = '12px sans-serif'; ctx.fillText('Žádná data.', 10, 20); return; }
    const ml = 52, mr = 10, mt = 10, mb = 22;
    let x0 = Infinity, x1 = -Infinity, y0 = 0, y1 = 1;
    for (const b of body) { x0 = Math.min(x0, b.x); x1 = Math.max(x1, b.x); y0 = Math.min(y0, b.y); y1 = Math.max(y1, b.y); }
    if (x1 === x0) x1 = x0 + J.DEN_MS;
    const X = (x) => ml + (x - x0) / (x1 - x0) * (w - ml - mr), Y = (y) => mt + (1 - (y - y0) / (y1 - y0)) * (h - mt - mb);
    ctx.font = '11px sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
    for (let k = 0; k <= 3; k++) {
      const v = y0 + (y1 - y0) * k / 3, yy = Math.round(Y(v)) + 0.5;
      ctx.strokeStyle = B.border; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ml, yy); ctx.lineTo(w - mr, yy); ctx.stroke();
      ctx.fillStyle = B.muted; ctx.fillText(cislo(Math.round(v)), ml - 6, yy);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(datumMs(x0), Math.max(ml + 30, X(x0)), h - mb + 6); ctx.fillText(datumMs(x1), Math.min(w - mr - 30, X(x1)), h - mb + 6);
    ctx.strokeStyle = B.accent; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath();
    body.forEach((b, i) => { const x = X(b.x), y = Y(b.y); if (!i) ctx.moveTo(x, y); else { ctx.lineTo(x, Y(body[i - 1].y)); ctx.lineTo(x, y); } });
    ctx.stroke();
    ctx.textAlign = 'left';
    if (bubl) {
      cv.onpointermove = (e) => {
        const r = cv.getBoundingClientRect(), mx = e.clientX - r.left;
        let best = null, bd = Infinity;
        for (const b of body) { const d = Math.abs(X(b.x) - mx); if (d < bd) { bd = d; best = b; } }
        if (!best || bd > 30) { bubl.hidden = true; return; }
        const c = S.model.podleSha.get(best.sha);
        bubl.innerHTML = '<b>' + cislo(best.y) + ' ' + jednotka + '</b><br>' + datumMs(best.x) + ' · <span class="mono">' + kratke(best.sha) + '</span><br>' + esc(c ? c.predmet : '');
        bubl.hidden = false;
        bubl.style.left = Math.max(0, Math.min(mx + 12, r.width - bubl.offsetWidth - 4)) + 'px'; bubl.style.top = '4px';
      };
      cv.onpointerleave = () => { bubl.hidden = true; };
    }
  }

  /* ============================================================
     Napojení ovládání
     ============================================================ */
  function napoj() {
    // záložky
    document.querySelectorAll('[data-zalozka]').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('[data-zalozka]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
      document.querySelectorAll('[data-panel]').forEach(p => p.hidden = p.dataset.panel !== b.dataset.zalozka);
    }));
    $('soubor').addEventListener('change', (e) => { nactiSoubor(e.target.files[0]); e.target.value = ''; });
    $('ukazka').onclick = nactiUkazku;
    $('obnovit').onclick = async () => {
      const z = await nactiPosledni();
      if (!z) { $('obnovit').hidden = true; return; }
      if (z.typ === 'text') nactiTextem(z.text, z.popis, false);
      else if (z.typ === 'api') {
        Object.assign(api, z.info, { pole: z.pole, dalsi: null });
        $('gh-repo').value = api.vlastnik + '/' + api.repo;
        naplnPridatVetev(); $('gh-pridat-vetev').disabled = !(api.vetve && api.vetve.length);
        const m = sestavApiModel();
        m.varovani.push('Obnoveno z uložené kopie (' + new Date(z.cas).toLocaleString('cs-CZ') + ') – data mohou být zastaralá; informace o dalších stránkách se neukládá.');
        nastavModel(m, z.popis);
      }
      $('obnovit').hidden = true;
    };
    // přetažení souboru kamkoli na stránku
    let hloubka = 0;
    document.addEventListener('dragenter', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { hloubka++; document.body.classList.add('tahne'); } });
    document.addEventListener('dragleave', () => { hloubka = Math.max(0, hloubka - 1); if (!hloubka) document.body.classList.remove('tahne'); });
    document.addEventListener('dragover', (e) => { e.preventDefault(); });
    document.addEventListener('drop', (e) => { e.preventDefault(); hloubka = 0; document.body.classList.remove('tahne'); const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) nactiSoubor(f); });

    // GitHub
    $('gh-nacti').onclick = ghNacti;
    $('gh-dalsi').onclick = ghDalsi;
    $('gh-pridat-vetev').onchange = ghPridatVetev;
    $('gh-zrus').onclick = () => { if (api.zrus) api.zrus.abort(); };
    $('gh-repo').addEventListener('keydown', (e) => { if (e.key === 'Enter') ghNacti(); });

    // export – zdroj skriptu, kopírování
    $('ukaz-skript').onclick = async () => {
      const pre = $('zdroj-skriptu');
      if (!pre.hidden) { pre.hidden = true; return; }
      try { const r = await fetch('git_historie/export_git_json.py'); pre.textContent = await r.text(); pre.hidden = false; }
      catch (e) { Dialog.chyba('Skript se nepodařilo načíst (offline?).'); }
    };
    document.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-kopiruj],[data-kopiruj-text]');
      if (t) {
        const text = t.dataset.kopirujText || $(t.dataset.kopiruj).textContent;
        try { await navigator.clipboard.writeText(text); Dialog.info('Zkopírováno.'); } catch (er) { Dialog.chyba('Schránka není dostupná – text označte a zkopírujte ručně.'); }
        return;
      }
      const s = e.target.closest('[data-sha]');
      if (s && s.id !== 'gh-soubory') {
        const sha = s.dataset.sha;
        if (!S.rozvrh.radek.has(sha) && S.model.podleSha.has(sha)) { S.filtr.vetev = ''; $('f-vetev').value = ''; prepocti(true); }
        if (S.rozvrh.radek.has(sha)) vyber(S.rozvrh.radek.get(sha), true);
        return;
      }
      if (e.target.id === 'gh-soubory') { e.target.disabled = true; ghSouboryCommitu(e.target.dataset.sha); return; }
      const r = e.target.closest('[data-radek]');
      if (r) { vyber(+r.dataset.radek, true); return; }
      const z = e.target.closest('[data-zrus]');
      if (z) { zrusFiltr(z.dataset.zrus); return; }
      const fs = e.target.closest('[data-soubor]');
      if (fs) { S.filtr.soubor = S.filtr.soubor === fs.dataset.soubor ? '' : fs.dataset.soubor; prepocti(false); return; }
    });

    // filtry
    $('f-vetev').onchange = (e) => { S.filtr.vetev = e.target.value; S.sy = 0; prepocti(true); if (S.vybrany < 0 && S.radky.length) vyber(0, true); else if (S.vybrany >= 0) vyber(S.vybrany, true); };
    $('f-autor').onchange = (e) => { S.filtr.autor = e.target.value; prepocti(false); };
    $('f-od').onchange = obdobiZPoli;
    $('f-do').onchange = obdobiZPoli;
    let casovac = null;
    $('f-hledat').addEventListener('input', (e) => {
      clearTimeout(casovac);
      casovac = setTimeout(() => { S.filtr.dotaz = e.target.value.trim(); prepocti(false); if (S.filtr.dotaz && S.poradiShod.length) vyber(S.poradiShod[0], true); }, 220);
    });
    $('f-hledat').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('z-dalsi').click(); } });
    $('zrus-obdobi').onclick = () => zrusFiltr('obdobi');
    $('krok').onchange = (e) => { S.krok = e.target.value; ulozNastaveni(); kresliAktivitu(); };
    $('pasmo').onchange = (e) => { S.pasmo = e.target.value; ulozNastaveni(); obdobiZPoli(); vykresliDetail(); };
    $('tab-autori').addEventListener('click', (e) => {
      const th = e.target.closest('th');
      if (th) {
        const k = th.dataset.klic;
        S.razeniAutoru = { klic: k, smer: S.razeniAutoru.klic === k ? -S.razeniAutoru.smer : (k === 'jmeno' ? 1 : -1) };
        vykresliAutory(); return;
      }
      const tr = e.target.closest('tr[data-autor]');
      if (tr) { const k = tr.dataset.autor; S.filtr.autor = S.filtr.autor === k ? '' : k; $('f-autor').value = S.filtr.autor; prepocti(false); }
    });

    // téma a velikost
    new MutationObserver(() => { nactiBarvy(); if (S.model) { kresliGraf(); kresliAktivitu(); vykresliSoubory(); } }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    let rt = null;
    const naZmenu = () => { clearTimeout(rt); rt = setTimeout(() => { if (S.model) { kresliGraf(); kresliAktivitu(); vykresliSoubory(); } }, 120); };
    window.addEventListener('resize', naZmenu);
    if (window.ResizeObserver) new ResizeObserver(naZmenu).observe($('platno-obal'));
    if (window.matchMedia) { try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { nactiBarvy(); naZmenu(); }); } catch (e) { /* nic */ } }
  }

  /* ---------- start ---------- */
  nactiNastaveni();
  nactiBarvy();
  napoj();
  napojGraf();
  napojAktivitu();
  nactiPosledni().then(z => { if (z) { $('obnovit').hidden = false; $('obnovit').textContent = 'Obnovit: ' + (z.popis || 'naposledy načtené'); } });
  // pro testy a ladění
  window.__gitHistorie = { S, nactiTextem, nactiUkazku, vyber, zoom, prepocti, api };
})();
