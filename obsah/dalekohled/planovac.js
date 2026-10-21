/* dalekohled/planovac.js – plánovač noci a pozorovací seznam.
   Pro zvolenou noc spočítá pro každý objekt průběh výšky, jas oblohy (soumrak, Měsíc), viditelnost
   zvoleným vybavením, nejlepší čas a dobu nad minimální výškou. Výškový graf, oblačnost (Open-Meteo). */
(function () {
  'use strict';
  const APP = window.DALEK_APP, D = window.DALEK, K = window.DALEK_KAT, A = window.ASTRO, DATA = window.DALEK_DATA, OB = window.DALEK_OBLOHA, V = window.DALEK_VYBAVA;
  const $ = id => document.getElementById(id);
  const c1 = APP.c1, fmtCas = APP.fmtCas;
  const RAD = Math.PI / 180;
  const KLIC = 'webapp_dalekohled_planovac';

  const SKUPINY = [
    ['planety', 'planety a Měsíc'], ['dvoj', 'dvojhvězdy'], ['gal', 'galaxie'], ['mlh', 'mlhoviny'], ['pn', 'planetární mlhoviny'],
    ['gc', 'kulové hvězdokupy'], ['oc', 'otevřené hvězdokupy'], ['hv', 'jasné hvězdy'],
  ];
  const skupinaDSO = t => ({ s: 'gal', e: 'gal', i: 'gal', sd: 'gal', sfr: 'mlh', rn: 'mlh', snr: 'mlh', en: 'mlh', dn: 'mlh', pn: 'pn', gc: 'gc', oc: 'oc', pos: 'oc' }[t] || 'mlh');
  const P = { katalog: 'messier', maxMag: 11, minAlt: 20, skupiny: SKUPINY.map(s => s[0]), jenViditelne: true, souh: '', text: '', razeni: 'skore', sestupne: true, noc: 'astro' };
  try { Object.assign(P, JSON.parse(localStorage.getItem(KLIC) || '{}')); } catch (e) { /* nic */ }
  const uloz = () => { try { localStorage.setItem(KLIC, JSON.stringify(P)); } catch (e) { /* nic */ } };

  let datum = null;          // jd místního poledne dne, kdy noc začíná
  let vysledek = null;       // {okno, vzorky, radky}
  let oblacnost = null;      // {casy: [jd], hodnoty: [%]}

  /* ---------- výpočet ---------- */
  function cileKVypoctu() {
    const out = [];
    const sk = new Set(P.skupiny);
    if (sk.has('planety')) for (const k of D.KLICE_TELES) out.push({ id: 'p:' + k, skupina: 'planety' });
    if (sk.has('dvoj')) for (const [i] of DATA.DVOJHVEZDY) out.push({ id: 'h:' + i, skupina: 'dvoj' });
    if (sk.has('hv')) for (const i of Object.keys(DATA.JMENA)) out.push({ id: 'h:' + i, skupina: 'hv' });
    for (const o of K.DSO) {
      const g = skupinaDSO(o[3]);
      if (!sk.has(g)) continue;
      if (P.katalog === 'messier' && o[10] !== 'M') continue;
      if (o[10] !== 'M' && (o[4] > P.maxMag || o[3] === 'dn')) continue;
      out.push({ id: 'd:' + o[0], skupina: g });
    }
    return out;
  }
  function spocti() {
    const m = APP.misto();
    if (datum === null) {
      // noc, která právě probíhá nebo začne dnes večer
      const jd = APP.jdTed();
      const n0 = D.noc(D.poledne(jd - 1, m), m);
      datum = (n0.vychod && jd < n0.vychod) ? D.poledne(jd - 1, m) : D.poledne(jd, m);
    }
    const noc = D.noc(datum, m);
    const zac = (P.noc === 'astro' ? noc.astroKonec : null) || noc.nautickyKonec || noc.obcanskyKonec || noc.zapad || datum + 0.25;
    const kon = (P.noc === 'astro' ? noc.astroZacatek : null) || noc.nautickyZacatek || noc.obcanskyZacatek || noc.vychod || datum + 0.75;
    const graf0 = (noc.zapad || zac - 0.06) - 1 / 24, graf1 = (noc.vychod || kon + 0.06) + 1 / 24;
    const N = 64;
    const vzorky = [];
    const dal = APP.dalekohled();
    // „nejlepší okulár“ pro plošné objekty: výstupní pupila ~2,5 mm (nebo co je k dispozici)
    const okulary = V.okulary();
    const o2 = okulary.length ? okulary.map(ok => D.optika(dal, ok, 1)).sort((a, b) => Math.abs(a.pupila - 2.5) - Math.abs(b.pupila - 2.5))[0] : D.optika(dal, { f: 20, afov: 52 }, 1);
    const zornice = APP.S.zornice;
    const posun = x => x + 5 * Math.log10(Math.max(1, zornice / o2.pupila));
    for (let i = 0; i <= N; i++) {
      const jd = zac + (kon - zac) * i / N;
      const prec = D.precese(A.utNaJde(jd));
      const M = OB.maticeObzoru(jd, m, prec);
      const sl = D.teleso('slunce', jd, m, prec), me = D.teleso('mesic', jd, m, prec);
      vzorky.push({ jd, M, hS: sl.obzor.alt, mesic: { alt: me.obzor.alt, k: me.k, v: me.v } });
    }
    const vysky = (v, s) => Math.asin(Math.max(-1, Math.min(1, s.M[6] * v[0] + s.M[7] * v[1] + s.M[8] * v[2]))) / RAD;
    const radky = [];
    const planetyVzorek = {};
    for (const c of cileKVypoctu()) {
      const ob = K.objekt(c.id); if (!ob) continue;
      let v = ob.druh === 'p' ? null : ob.v;
      let nejSkore = 0, nejJd = null, maxAlt = -90, od = null, doo = null, mesUhel = 180, vid = 0;
      for (let i = 0; i < vzorky.length; i++) {
        const s = vzorky[i];
        let vv = v;
        if (!vv) { const kl = ob.klic + i; vv = planetyVzorek[kl] || (planetyVzorek[kl] = D.teleso(ob.klic, s.jd, m).v); }
        const alt = vysky(vv, s);
        if (alt > maxAlt) maxAlt = alt;
        if (alt >= P.minAlt) { if (od === null) od = s.jd; doo = s.jd; }
        if (alt < Math.max(5, P.minAlt * 0.6)) continue;
        const um = D.uhel(vv, s.mesic.v);
        let skore;
        // body: planety až 1, dvojhvězdy 0,8, jasné hvězdy 0,5 – aby plošné objekty nezapadly pod samé stovky
        if (c.skupina === 'planety') skore = Math.min(1, alt / 40) * (ob.klic === 'uran' || ob.klic === 'neptun' ? 0.7 : 1) * (D.uhel(vv, D.teleso('slunce', s.jd, m).v) < 15 ? 0 : 1);
        else if (c.skupina === 'hv' || c.skupina === 'dvoj') {
          skore = Math.min(1, alt / 45) * (c.skupina === 'dvoj' ? 0.8 : 0.5);
          if (c.skupina === 'dvoj') {
            const dv = DATA.DVOJHVEZDY.find(x => 'h:' + x[0] === c.id);
            const sep = Math.min(...dv[2].map(x => x[2]));
            const seeing = APP.S.seeing * Math.pow(D.vzdusnaHmota(alt), 0.6);
            if (sep < 116 / dal.D * 0.9) skore *= 0.1; else if (sep < seeing * 0.8) skore *= 0.4;
          }
        } else {
          const sb = D.jasOblohy({ bortle: APP.S.bortle, hSlunce: s.hS, mesic: { alt: s.mesic.alt, k: s.mesic.k, uhel: um } }, alt);
          const vd = D.viditelnostDSO(ob.o, o2.M, posun(sb), posun, D.vzdusnaHmota(alt) - 1);
          skore = vd.vis * Math.min(1, 0.4 + alt / 60);
        }
        if (skore > nejSkore) { nejSkore = skore; nejJd = s.jd; mesUhel = um; }
        vid = Math.max(vid, skore);
      }
      if (P.jenViditelne && nejSkore < 0.05) continue;
      if (maxAlt < P.minAlt) continue;
      radky.push({ id: c.id, ob, skupina: c.skupina, skore: nejSkore, nejJd, maxAlt, od, do: doo, mesUhel, souh: D.souhvezdi(ob.v || D.teleso(ob.klic, (zac + kon) / 2, m).v) });
    }
    vysledek = { zac, kon, graf0, graf1, noc, vzorky, radky, o2 };
  }

  /* ---------- vykreslení panelu ---------- */
  const panel = $('panel-planovac');
  panel.innerHTML = `
    <div class="panel-mrizka">
      <div>
        <div class="card">
          <h2>Noc a filtry</h2>
          <div class="r2">
            <div><label for="plDatum" style="margin-top:0">Noc ze dne</label><input id="plDatum" type="date"></div>
            <div><label for="plNoc" style="margin-top:0">Okno</label><select id="plNoc"><option value="astro">astronomická noc</option><option value="naut">nautická noc</option></select></div>
          </div>
          <label for="plMinAlt">Minimální výška <span class="hodnota" id="vPlMinAlt"></span></label>
          <input id="plMinAlt" type="range" min="0" max="60" step="5">
          <label for="plKatalog">Katalog</label>
          <select id="plKatalog"><option value="messier">Messier + jasné objekty</option><option value="vse">i NGC/IC a další</option></select>
          <label for="plMaxMag">NGC/IC do jasnosti <span class="hodnota" id="vPlMaxMag"></span></label>
          <input id="plMaxMag" type="range" min="6" max="13" step="0.5">
          <label>Typy objektů</label>
          <div id="plSkupiny"></div>
          <label for="plSouh">Souhvězdí</label>
          <select id="plSouh"><option value="">všechna</option></select>
          <label for="plText">Hledat v seznamu</label>
          <input id="plText" type="search" placeholder="např. galaxie, Lyr, M 5…">
          <label class="chk"><input type="checkbox" id="plJenVid"> jen objekty viditelné mým vybavením</label>
          <div class="tlacitka"><button class="btn btn-sec" id="plOblacnost">☁ Načíst předpověď oblačnosti</button></div>
          <div class="info" id="plInfoVybava"></div>
        </div>
      </div>
      <div>
        <div class="card">
          <h2>Přehled noci <small id="plSouhrnDatum"></small></h2>
          <div class="udaje" id="plSouhrn" style="grid-template-columns:repeat(auto-fill,minmax(230px,1fr));column-gap:16px"></div>
          <canvas id="grafVysek" style="margin-top:10px" aria-label="Výškový graf objektů během noci"></canvas>
          <div class="legenda"><span><i style="background:#1d2a4a"></i>noc</span><span><i style="background:#2c3d63"></i>soumrak</span><span><i style="background:#aaa;height:2px"></i>Měsíc</span><span><i style="background:#7dffb0"></i>vybraný cíl</span><span><i style="background:#8a8f99;opacity:.5"></i>oblačnost</span><span>klik v grafu = nastavit čas</span></div>
        </div>
        <div class="card">
          <h2>Co pozorovat <small id="plPocet"></small></h2>
          <div class="tab-obal"><table class="tab" id="plTab"></table></div>
          <div class="tlacitka"><button class="btn btn-sec btn-mini" id="plCsv">⬇ CSV</button><button class="btn btn-sec btn-mini" id="plVseDoSeznamu">☆ Prvních 20 do seznamu</button></div>
        </div>
      </div>
    </div>`;
  const skup = $('plSkupiny');
  for (const [k, n] of SKUPINY) {
    const l = document.createElement('label'); l.className = 'chk'; l.style.margin = '3px 0';
    l.innerHTML = `<input type="checkbox" value="${k}"> ${n}`;
    l.firstChild.checked = P.skupiny.includes(k);
    l.firstChild.addEventListener('change', () => { P.skupiny = [...skup.querySelectorAll('input:checked')].map(x => x.value); uloz(); obnov(); });
    skup.appendChild(l);
  }
  const sSouh = $('plSouh');
  for (const s of [...DATA.SOUHVEZDI].sort((a, b) => a.cz.localeCompare(b.cz, 'cs'))) sSouh.add(new Option(s.cz, s.id));
  function doFormulare() {
    $('plMinAlt').value = P.minAlt; $('vPlMinAlt').textContent = P.minAlt + '°';
    $('plKatalog').value = P.katalog; $('plMaxMag').value = P.maxMag; $('vPlMaxMag').textContent = c1(P.maxMag) + ' mag';
    $('plMaxMag').disabled = P.katalog === 'messier';
    $('plJenVid').checked = P.jenViditelne; sSouh.value = P.souh; $('plText').value = P.text; $('plNoc').value = P.noc;
    if (datum !== null) { const d = A.dataZJd(datum); $('plDatum').value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  }
  $('plMinAlt').addEventListener('input', e => { P.minAlt = +e.target.value; $('vPlMinAlt').textContent = P.minAlt + '°'; uloz(); odlozeneObnov(); });
  $('plKatalog').addEventListener('change', e => { P.katalog = e.target.value; uloz(); doFormulare(); obnov(); });
  $('plMaxMag').addEventListener('input', e => { P.maxMag = +e.target.value; $('vPlMaxMag').textContent = c1(P.maxMag) + ' mag'; uloz(); odlozeneObnov(); });
  $('plJenVid').addEventListener('change', e => { P.jenViditelne = e.target.checked; uloz(); obnov(); });
  $('plNoc').addEventListener('change', e => { P.noc = e.target.value; uloz(); obnov(); });
  sSouh.addEventListener('change', e => { P.souh = e.target.value; uloz(); tabulka(); });
  $('plText').addEventListener('input', e => { P.text = e.target.value; uloz(); tabulka(); });
  $('plDatum').addEventListener('change', e => {
    const d = new Date(e.target.value + 'T12:00'); if (isNaN(d)) return;
    datum = D.poledne(A.jdZData(d), APP.misto()); oblacnost = oblacnost; obnov();
  });
  let odl = null;
  const odlozeneObnov = () => { clearTimeout(odl); odl = setTimeout(obnov, 250); };

  function obnov() {
    if (panel.hidden && $('panel-seznam').hidden) { zastarale = true; return; }
    zastarale = false;
    const t0 = performance.now();
    spocti();
    doFormulare();
    souhrn();
    graf();
    tabulka();
    seznam();
    $('plInfoVybava').innerHTML = `Viditelnost se hodnotí pro <b>${APP.dalekohled().nazev}</b> s okulárem kolem ${Math.round(vysledek.o2.M)}× (výstupní pupila ${c1(vysledek.o2.pupila)} mm), Bortle ${APP.S.bortle}, seeing ${c1(APP.S.seeing)}″. Výpočet ${Math.round(performance.now() - t0)} ms.`;
  }
  let zastarale = true;

  function souhrn() {
    const { noc, zac, kon } = vysledek;
    const m = APP.misto();
    const im = D.infoMesice((zac + kon) / 2, m);
    const vz = D.prechody(j => D.teleso('mesic', j, m).obzor.alt, (zac + kon) / 2, 0.125);
    const r = APP.radek;
    const d = A.dataZJd(datum);
    $('plSouhrnDatum').textContent = d.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ' → další den';
    const delka = (kon - zac) * 24;
    $('plSouhrn').innerHTML = [
      r('Západ / východ Slunce', `${fmtCas(noc.zapad)} / ${fmtCas(noc.vychod)}`),
      r('Konec / začátek nautického soumraku', `${fmtCas(noc.nautickyKonec)} / ${fmtCas(noc.nautickyZacatek)}`),
      r('Astronomická noc', noc.astroKonec ? `${fmtCas(noc.astroKonec)} – ${fmtCas(noc.astroZacatek)}` : '<span class="varovani">nenastane (světlé noci)</span>'),
      r('Okno plánu', `${fmtCas(zac)} – ${fmtCas(kon)} (${c1(delka)} h)`),
      r('Měsíc', `${Math.round(im.k * 100)} % · ${im.roste ? 'dorůstá' : 'couvá'} · stáří ${c1(im.stari)} d`),
      r('Východ / západ Měsíce', `${fmtCas(vz.vychod)} / ${fmtCas(vz.zapad)}`),
      r('Rušení Měsícem', im.k < 0.15 ? '<span class="ok">minimální</span>' : im.k < 0.5 ? '<span class="varovani">mírné</span>' : '<span class="chyba">silné – vhodné spíš planety, Měsíc a dvojhvězdy</span>'),
    ].join('');
  }

  /* ---------- graf výšek ---------- */
  const cvg = $('grafVysek');
  const BARVY = ['#7dffb0', '#ffb36b', '#6bb8ff', '#ff7ab8', '#e5e56b', '#b98bff', '#6bffe8', '#ff6b6b', '#c0c0c0'];
  function graf() {
    const r = cvg.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    cvg.width = Math.max(300, Math.round(r.width * dpr)); cvg.height = Math.round(280 * dpr);
    const ctx = cvg.getContext('2d'), W = cvg.width, H = cvg.height;
    const L = 38 * dpr, R = 10 * dpr, T = 10 * dpr, B = 26 * dpr;
    const { graf0, graf1, noc } = vysledek;
    const X = jd => L + (jd - graf0) / (graf1 - graf0) * (W - L - R), Y = alt => T + (1 - Math.max(0, alt) / 90) * (H - T - B);
    ctx.fillStyle = '#0d1424'; ctx.fillRect(0, 0, W, H);
    // pásy soumraku
    const pas = (a, b, c) => { if (a && b) { ctx.fillStyle = c; ctx.fillRect(X(a), T, X(b) - X(a), H - T - B); } };
    pas(noc.zapad, noc.obcanskyKonec, '#3a4f7a'); pas(noc.obcanskyKonec, noc.nautickyKonec, '#2c3d63'); pas(noc.nautickyKonec, noc.astroKonec || noc.nautickyZacatek, '#22314f');
    if (noc.astroKonec) pas(noc.astroKonec, noc.astroZacatek, '#141d33');
    pas(noc.astroZacatek || noc.nautickyKonec, noc.nautickyZacatek, '#22314f'); pas(noc.nautickyZacatek, noc.obcanskyZacatek, '#2c3d63'); pas(noc.obcanskyZacatek, noc.vychod, '#3a4f7a');
    // oblačnost
    if (oblacnost) {
      ctx.fillStyle = 'rgba(160,165,175,0.45)';
      for (let i = 0; i < oblacnost.casy.length; i++) {
        const j = oblacnost.casy[i]; if (j < graf0 - 1 / 24 || j > graf1) continue;
        const h = oblacnost.hodnoty[i] / 100 * (H - T - B) * 0.25;
        ctx.fillRect(X(j), T, Math.max(1, X(j + 1 / 24) - X(j)), h);
      }
    }
    // mřížka
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.fillStyle = 'rgba(220,225,235,0.8)'; ctx.font = `${10 * dpr}px system-ui, sans-serif`; ctx.lineWidth = dpr;
    for (let a = 0; a <= 90; a += 15) { ctx.beginPath(); ctx.moveTo(L, Y(a)); ctx.lineTo(W - R, Y(a)); ctx.stroke(); ctx.fillText(a + '°', 4 * dpr, Y(a) + 3 * dpr); }
    ctx.strokeStyle = 'rgba(255,200,120,0.35)'; ctx.setLineDash([3 * dpr, 3 * dpr]);
    ctx.beginPath(); ctx.moveTo(L, Y(P.minAlt)); ctx.lineTo(W - R, Y(P.minAlt)); ctx.stroke(); ctx.setLineDash([]);
    const h0 = Math.ceil((graf0 - 2440587.5) * 24) / 24 + 2440587.5;
    for (let j = h0; j < graf1; j += 1 / 24) {
      const x = X(j);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, H - B); ctx.stroke();
      ctx.fillStyle = 'rgba(220,225,235,0.8)'; ctx.fillText(A.dataZJd(j).getHours() + 'h', x - 6 * dpr, H - 9 * dpr);
    }
    const m = APP.misto();
    const krivka = (fce, barva, sir, popis) => {
      ctx.strokeStyle = barva; ctx.lineWidth = sir * dpr; ctx.beginPath();
      let prvni = true, best = null;
      for (let i = 0; i <= 120; i++) {
        const j = graf0 + (graf1 - graf0) * i / 120, a = fce(j);
        if (a < 0) { prvni = true; continue; }
        if (!best || a > best[1]) best = [j, a];
        if (prvni) ctx.moveTo(X(j), Y(a)); else ctx.lineTo(X(j), Y(a));
        prvni = false;
      }
      ctx.stroke();
      if (popis && best) { ctx.fillStyle = barva; ctx.fillText(popis, X(best[0]) + 4 * dpr, Y(best[1]) - 4 * dpr); }
    };
    ctx.setLineDash([2 * dpr, 3 * dpr]);
    krivka(j => D.teleso('mesic', j, m).obzor.alt, 'rgba(220,220,220,0.8)', 1.5, 'Měsíc');
    ctx.setLineDash([]);
    const ids = [...new Set([APP.S.cil, ...APP.S.seznam].filter(Boolean))].slice(0, 9);
    ids.forEach((id, i) => {
      const ob = K.objekt(id); if (!ob) return;
      krivka(j => D.naObzor(K.smer(id, j, m), j, m).alt, i === 0 && id === APP.S.cil ? BARVY[0] : BARVY[(i % 8) + 1], id === APP.S.cil ? 2.5 : 1.5, ob.nazev.split(' – ')[0]);
    });
    // aktuální čas
    const jt = APP.jdTed();
    if (jt > graf0 && jt < graf1) { ctx.strokeStyle = '#ff5050'; ctx.lineWidth = 1.5 * dpr; ctx.beginPath(); ctx.moveTo(X(jt), T); ctx.lineTo(X(jt), H - B); ctx.stroke(); }
    cvg.onclick = e => {
      const rr = cvg.getBoundingClientRect(), x = (e.clientX - rr.left) * cvg.width / rr.width;
      const j = graf0 + (x - L) / (W - L - R) * (graf1 - graf0);
      if (j > graf0 && j < graf1) { APP.nastavJd(j); APP.zprava('Čas nastaven na ' + APP.fmtDatumCas(j)); }
    };
  }

  /* ---------- tabulka ---------- */
  const SLOUPCE = [
    ['hv', '', null], ['nazev', 'Objekt', r => r.ob.nazev], ['typ', 'Typ', r => typText(r)], ['souh', 'Souhv.', r => r.souh],
    ['mag', 'mag', r => r.ob.druh === 'd' ? r.ob.o[4] : r.ob.druh === 'h' ? r.ob.mag : -5], ['roz', 'Rozměr', r => r.ob.druh === 'd' ? r.ob.o[5] : 0],
    ['nej', 'Nejlépe', r => r.nejJd || 1e9], ['max', 'Max. výška', r => r.maxAlt], ['okno', `Nad min. výškou`, r => r.od || 1e9],
    ['mes', 'Od Měsíce', r => r.mesUhel], ['skore', 'Viditelnost', r => r.skore], ['prubeh', 'Průběh noci', null],
  ];
  function typText(r) {
    if (r.ob.druh === 'p') return r.ob.klic === 'mesic' ? 'Měsíc' : 'planeta';
    if (r.skupina === 'dvoj') return 'dvojhvězda';
    if (r.ob.druh === 'h') return 'hvězda';
    return K.TYPY[r.ob.o[3]] || r.ob.o[3];
  }
  function filtrovane() {
    const q = K.normal(P.text || '');
    return vysledek.radky.filter(r => (!P.souh || r.souh === P.souh) && (!q || K.normal(r.ob.nazev + ' ' + typText(r) + ' ' + r.souh).includes(q)));
  }
  function pruhNoci(r) {
    // 24 dílků: barva podle výšky objektu v okně noci
    const c = document.createElement('canvas'); c.className = 'pruh'; c.width = 144; c.height = 12;
    const x = c.getContext('2d');
    const s = vysledek.vzorky, n = s.length;
    for (let i = 0; i < n; i++) {
      const vv = r.ob.druh === 'p' ? D.teleso(r.ob.klic, s[i].jd, APP.misto()).v : r.ob.v;
      const alt = Math.asin(s[i].M[6] * vv[0] + s[i].M[7] * vv[1] + s[i].M[8] * vv[2]) / RAD;
      x.fillStyle = alt < 0 ? '#20242c' : alt < P.minAlt ? '#5a4a2a' : `hsl(140,${40 + alt / 2}%,${25 + alt / 3}%)`;
      x.fillRect(i / n * 144, 0, 144 / n + 0.6, 12);
    }
    return c;
  }
  function tabulka() {
    if (!vysledek) return;
    const tab = $('plTab');
    let radky = filtrovane();
    const sl = SLOUPCE.find(s => s[0] === P.razeni) || SLOUPCE[10];
    if (sl[2]) radky.sort((a, b) => { const x = sl[2](a), y = sl[2](b); return (typeof x === 'string' ? x.localeCompare(y, 'cs') : x - y) * (P.sestupne ? -1 : 1); });
    $('plPocet').textContent = `${radky.length} objektů${radky.length > 400 ? ' (zobrazeno 400)' : ''}`;
    radky = radky.slice(0, 400);
    tab.innerHTML = '';
    const th = tab.createTHead().insertRow();
    for (const [k, n] of SLOUPCE) {
      const c = document.createElement('th'); c.textContent = n + (P.razeni === k ? (P.sestupne ? ' ▼' : ' ▲') : '');
      if (['mag', 'roz', 'max', 'mes', 'skore'].includes(k)) c.className = 'r';
      if (SLOUPCE.find(s => s[0] === k)[2]) c.addEventListener('click', () => { if (P.razeni === k) P.sestupne = !P.sestupne; else { P.razeni = k; P.sestupne = ['skore', 'max', 'mes', 'roz'].includes(k); } uloz(); tabulka(); });
      th.appendChild(c);
    }
    const tb = tab.createTBody();
    for (const r of radky) {
      const tr = tb.insertRow();
      if (r.id === APP.S.cil) tr.className = 'vybrany';
      const hv = document.createElement('button'); hv.className = 'hvezdicka' + (APP.S.seznam.includes(r.id) ? ' zap' : ''); hv.textContent = APP.S.seznam.includes(r.id) ? '★' : '☆';
      hv.title = 'Přidat do pozorovacího seznamu';
      hv.addEventListener('click', e => { e.stopPropagation(); prepniSeznam(r.id); });
      tr.insertCell().appendChild(hv);
      const n = tr.insertCell(); n.className = 'zal'; n.textContent = r.ob.nazev;
      tr.insertCell().textContent = typText(r);
      tr.insertCell().textContent = r.souh;
      const mg = tr.insertCell(); mg.className = 'r'; mg.textContent = r.ob.druh === 'p' ? '' : K.fmtMag(r.ob.druh === 'd' ? r.ob.o[4] : r.ob.mag);
      const rz = tr.insertCell(); rz.className = 'r'; rz.textContent = r.ob.druh === 'd' ? K.fmtRozmer(r.ob.o) : '';
      tr.insertCell().textContent = r.nejJd ? fmtCas(r.nejJd) : '–';
      const mx = tr.insertCell(); mx.className = 'r'; mx.textContent = Math.round(r.maxAlt) + '°';
      tr.insertCell().textContent = r.od ? `${fmtCas(r.od)}–${fmtCas(r.do)}` : '–';
      const ms = tr.insertCell(); ms.className = 'r'; ms.textContent = r.ob.druh === 'p' && r.ob.klic === 'mesic' ? '' : Math.round(r.mesUhel) + '°';
      const sk = tr.insertCell(); sk.className = 'r'; sk.innerHTML = `<span class="${r.skore > 0.6 ? 'ok' : r.skore > 0.2 ? 'varovani' : 'chyba'}">${Math.round(r.skore * 100)} %</span>`;
      tr.insertCell().appendChild(pruhNoci(r));
      tr.addEventListener('click', () => { APP.vyber(r.id, true); if (r.nejJd && (APP.jdTed() < vysledek.zac - 0.05 || APP.jdTed() > vysledek.kon + 0.05)) APP.nastavJd(r.nejJd); });
    }
  }
  function prepniSeznam(id) {
    const S = APP.S;
    if (S.seznam.includes(id)) S.seznam = S.seznam.filter(x => x !== id); else S.seznam.push(id);
    APP.uloz(); tabulka(); seznam(); graf();
  }
  $('plVseDoSeznamu').addEventListener('click', () => {
    const S = APP.S;
    const radky = filtrovane().sort((a, b) => b.skore - a.skore).slice(0, 20);
    for (const r of radky) if (!S.seznam.includes(r.id)) S.seznam.push(r.id);
    APP.uloz(); tabulka(); seznam(); graf();
    APP.zprava('Do seznamu přidáno ' + radky.length + ' objektů.');
  });
  function csv(radky, nazev) {
    const esc = x => '"' + String(x).replace(/"/g, '""') + '"';
    const r = [['objekt', 'typ', 'souhvezdi', 'mag', 'rozmer', 'nejlepe', 'max_vyska', 'od', 'do', 'od_mesice', 'viditelnost_%', 'ra_j2000', 'dec_j2000'].join(';')];
    for (const x of radky) {
      const v = x.ob.v || D.teleso(x.ob.klic, x.nejJd || vysledek.zac, APP.misto()).v, rd = D.raDec(v);
      r.push([esc(x.ob.nazev), esc(typText(x)), x.souh, x.ob.druh === 'd' ? x.ob.o[4] : x.ob.mag ?? '', x.ob.druh === 'd' ? esc(K.fmtRozmer(x.ob.o)) : '',
        x.nejJd ? fmtCas(x.nejJd) : '', Math.round(x.maxAlt), x.od ? fmtCas(x.od) : '', x.do ? fmtCas(x.do) : '', Math.round(x.mesUhel), Math.round(x.skore * 100), rd.ra.toFixed(4), rd.dec.toFixed(4)].join(';'));
    }
    const b = new Blob(['﻿' + r.join('\r\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = nazev; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  $('plCsv').addEventListener('click', () => csv(filtrovane(), 'plan-noci.csv'));

  /* ---------- oblačnost (Open-Meteo) ---------- */
  $('plOblacnost').addEventListener('click', async () => {
    const m = APP.misto();
    $('plOblacnost').disabled = true; $('plOblacnost').textContent = '☁ Načítám…';
    try {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${m.lat}&longitude=${m.lon}&hourly=cloud_cover,relative_humidity_2m,wind_speed_10m&timezone=UTC&forecast_days=7`;
      const r = await fetch(u); if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      oblacnost = { casy: d.hourly.time.map(t => A.jdZData(new Date(t + 'Z'))), hodnoty: d.hourly.cloud_cover, vlhkost: d.hourly.relative_humidity_2m, vitr: d.hourly.wind_speed_10m };
      graf();
      const vnoci = oblacnost.casy.map((j, i) => [j, i]).filter(([j]) => j >= vysledek.zac && j <= vysledek.kon);
      if (vnoci.length) {
        const pr = vnoci.reduce((s, [, i]) => s + oblacnost.hodnoty[i], 0) / vnoci.length;
        APP.zprava(`Předpověď oblačnosti v noci: průměrně ${Math.round(pr)} % (Open-Meteo).`);
      } else APP.zprava('Pro zvolenou noc předpověď není k dispozici (jen 7 dní dopředu).');
      $('plOblacnost').textContent = '☁ Oblačnost načtena';
    } catch (e) {
      APP.zprava('Předpověď se nepodařilo načíst: ' + e.message);
      $('plOblacnost').textContent = '☁ Načíst předpověď oblačnosti';
    }
    $('plOblacnost').disabled = false;
  });

  /* ---------- pozorovací seznam ---------- */
  const pSeznam = $('panel-seznam');
  pSeznam.innerHTML = `
    <div class="card">
      <h2>Pozorovací seznam <small id="szInfo"></small></h2>
      <p class="info" style="margin-top:0">Objekty označené hvězdičkou. Pořadí „podle nejlepšího času“ dává rozumný postup pozorování během noci (výšky a časy pro noc zvolenou v plánovači).</p>
      <div class="tlacitka" style="margin-bottom:8px">
        <button class="btn btn-sec btn-mini" id="szRadit">↕ Seřadit podle nejlepšího času</button>
        <button class="btn btn-sec btn-mini" id="szCsv">⬇ CSV</button>
        <button class="btn btn-sec btn-mini" id="szExport">⬇ Export JSON</button>
        <label class="btn btn-sec btn-mini" style="display:inline-flex;align-items:center;margin:0;color:var(--text)">⬆ Import JSON<input type="file" id="szImport" accept=".json,application/json" hidden></label>
        <button class="btn btn-sec btn-mini" id="szTisk">🖨 Tisk</button>
        <button class="btn btn-sec btn-mini" id="szSmazat">🗑 Vyprázdnit</button>
      </div>
      <div class="tab-obal"><table class="tab" id="szTab"></table></div>
    </div>`;
  function radekSeznamu(id) {
    if (vysledek) { const r = vysledek.radky.find(x => x.id === id); if (r) return r; }
    const ob = K.objekt(id); if (!ob) return null;
    // objekt mimo výsledky plánovače (pod obzorem / filtry) – spočítat základ
    const m = APP.misto();
    let maxAlt = -90, nejJd = null, od = null, doo = null;
    for (const s of (vysledek ? vysledek.vzorky : [])) {
      const v = K.smer(id, s.jd, m), alt = Math.asin(s.M[6] * v[0] + s.M[7] * v[1] + s.M[8] * v[2]) / RAD;
      if (alt > maxAlt) { maxAlt = alt; nejJd = s.jd; }
      if (alt >= P.minAlt) { if (od === null) od = s.jd; doo = s.jd; }
    }
    return { id, ob, skupina: ob.druh === 'p' ? 'planety' : ob.druh === 'h' ? 'hv' : skupinaDSO(ob.o[3]), skore: 0, nejJd, maxAlt, od, do: doo, mesUhel: 0, souh: D.souhvezdi(K.smer(id, APP.jdTed(), m)) };
  }
  function seznam() {
    const tab = $('szTab'); tab.innerHTML = '';
    const S = APP.S;
    const th = tab.createTHead().insertRow();
    for (const n of ['', 'Objekt', 'Typ', 'Souhv.', 'mag', 'Nejlépe', 'Max. výška', 'Nad min. výškou', 'Viditelnost', 'Pozorováno']) { const c = document.createElement('th'); c.textContent = n; th.appendChild(c); }
    const tb = tab.createTBody();
    const denik = window.DALEK_DENIK ? window.DALEK_DENIK.pozorovane() : new Set();
    let n = 0;
    for (const id of S.seznam) {
      const r = radekSeznamu(id); if (!r) continue; n++;
      const tr = tb.insertRow();
      const b = document.createElement('button'); b.className = 'hvezdicka zap'; b.textContent = '✕'; b.title = 'Odebrat ze seznamu';
      b.addEventListener('click', e => { e.stopPropagation(); prepniSeznam(id); });
      tr.insertCell().appendChild(b);
      const nn = tr.insertCell(); nn.className = 'zal'; nn.textContent = r.ob.nazev;
      tr.insertCell().textContent = typText(r);
      tr.insertCell().textContent = r.souh || '';
      tr.insertCell().textContent = r.ob.druh === 'p' ? '' : K.fmtMag(r.ob.druh === 'd' ? r.ob.o[4] : r.ob.mag);
      tr.insertCell().textContent = r.nejJd ? fmtCas(r.nejJd) : '–';
      tr.insertCell().textContent = r.maxAlt > -90 ? Math.round(r.maxAlt) + '°' : '–';
      tr.insertCell().textContent = r.od ? `${fmtCas(r.od)}–${fmtCas(r.do)}` : (r.maxAlt < P.minAlt ? 'nevychází dost vysoko' : '–');
      tr.insertCell().innerHTML = r.skore ? `<span class="${r.skore > 0.6 ? 'ok' : r.skore > 0.2 ? 'varovani' : 'chyba'}">${Math.round(r.skore * 100)} %</span>` : '–';
      tr.insertCell().textContent = denik.has(id) ? '✔' : '';
      tr.addEventListener('click', () => APP.vyber(id, true));
    }
    $('szInfo').textContent = n + ' objektů';
    if (!n) tb.insertRow().insertCell().textContent = 'Seznam je prázdný – přidejte objekty hvězdičkou v plánovači nebo tlačítkem „Do seznamu“.';
  }
  $('szRadit').addEventListener('click', () => {
    const S = APP.S;
    S.seznam.sort((a, b) => ((radekSeznamu(a) || {}).nejJd || 1e9) - ((radekSeznamu(b) || {}).nejJd || 1e9));
    APP.uloz(); seznam();
  });
  $('szCsv').addEventListener('click', () => csv(APP.S.seznam.map(radekSeznamu).filter(Boolean), 'pozorovaci-seznam.csv'));
  $('szExport').addEventListener('click', () => {
    const b = new Blob([JSON.stringify({ format: 'dalekohled-seznam-1', objekty: APP.S.seznam }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'pozorovaci-seznam.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $('szImport').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (d.format !== 'dalekohled-seznam-1' || !Array.isArray(d.objekty)) throw new Error('neznámý formát');
      const ok = d.objekty.filter(id => typeof id === 'string' && K.objekt(id));
      for (const id of ok) if (!APP.S.seznam.includes(id)) APP.S.seznam.push(id);
      APP.uloz(); seznam(); APP.zprava(`Importováno ${ok.length} objektů.`);
    } catch (er) { APP.zprava('Import se nezdařil: ' + er.message); }
    e.target.value = '';
  });
  $('szTisk').addEventListener('click', () => {
    const w = window.open('', '_blank'); if (!w) return;
    const radky = APP.S.seznam.map(radekSeznamu).filter(Boolean);
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Pozorovací seznam</title><style>body{font:12px system-ui;margin:16px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:3px 6px;text-align:left}</style>
      <h2>Pozorovací seznam – noc ${A.dataZJd(datum).toLocaleDateString('cs-CZ')}</h2><p>${APP.dalekohled().nazev} · ${APP.S.lat}° N, ${APP.S.lon}° E</p>
      <table><tr><th>✓</th><th>Objekt</th><th>Typ</th><th>Souhv.</th><th>mag</th><th>α J2000</th><th>δ J2000</th><th>Nejlépe</th><th>Max. výška</th><th>Poznámky</th></tr>
      ${radky.map(r => { const v = r.ob.v || D.teleso(r.ob.klic, r.nejJd || datum, APP.misto()).v, rd = D.raDec(v); return `<tr><td>☐</td><td>${r.ob.nazev}</td><td>${typText(r)}</td><td>${r.souh || ''}</td><td>${r.ob.druh === 'p' ? '' : K.fmtMag(r.ob.druh === 'd' ? r.ob.o[4] : r.ob.mag)}</td><td>${K.fmtRa(rd.ra)}</td><td>${K.fmtDec(rd.dec)}</td><td>${r.nejJd ? fmtCas(r.nejJd) : ''}</td><td>${Math.round(r.maxAlt)}°</td><td style="width:30%"></td></tr>`; }).join('')}</table>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  });
  $('szSmazat').addEventListener('click', async () => {
    const ok = window.Dialog && window.Dialog.potvrd ? await window.Dialog.potvrd('Opravdu vyprázdnit pozorovací seznam?') : confirm('Opravdu vyprázdnit pozorovací seznam?');
    if (!ok) return;
    APP.S.seznam = []; APP.uloz(); seznam(); tabulka(); graf();
  });

  APP.naZmenu(() => { datum = datum === null ? null : datum; obnov(); });
  APP.naZalozku(p => { if ((p === 'planovac' || p === 'seznam') && (zastarale || !vysledek)) obnov(); else if (p === 'seznam') seznam(); });
  APP.naCil(() => { if (vysledek && !panel.hidden) { tabulka(); graf(); } });
  window.addEventListener('resize', () => { if (vysledek && !panel.hidden) graf(); });
  setTimeout(obnov, 300);
  window.DALEK_PLANOVAC = { obnov, vysledek: () => vysledek, P, nastavDatum: jd => { datum = jd; obnov(); } };
})();
