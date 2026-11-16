/* Sníh a laviny – jádro bez DOM (testuje _test/snih_laviny_test.js v node).
   Sklon a orientace z DEM (dlaždice Terrarium), redukční metoda W. Muntera,
   zpracování dat Open-Meteo a lavinových bulletinů CAAML v6 (SLF). */
(function (koren) {
  'use strict';
  const OBVOD = 40075016.686, D2R = Math.PI / 180;
  const KLIC = 'webapp_snih_laviny';

  // ---------- DEM: Terrarium, sklon, orientace ----------
  const terrariumVyska = (r, g, b) => r * 256 + g + b / 256 - 32768;
  /** Výšky z RGBA pole dlaždice Terrarium. */
  function vyskyZRgba(rgba) {
    const n = rgba.length / 4, v = new Float32Array(n);
    for (let i = 0; i < n; i++) v[i] = terrariumVyska(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    return v;
  }
  /** Zeměpisná šířka středu řádku r (0..255) dlaždice y při zoomu z. */
  function latRadku(z, y, r) {
    const n = Math.PI - 2 * Math.PI * (y * 256 + r + 0.5) / (256 * Math.pow(2, z));
    return Math.atan(Math.sinh(n)) / D2R;
  }
  /** Velikost pixelu dlaždice 256 px na zemi (m). */
  const pixelDlazdice = (z, lat) => OBVOD * Math.cos(lat * D2R) / (256 * Math.pow(2, z));
  /** Sklon (°) a orientace (°, 0 = sever, po směru hodin; kam svah „hledí“) z mřížky výšek.
      ds = velikost pixelu (m), číslo nebo funkce řádku. Centrální diference, na okraji jednostranná. */
  function sklonOrientace(v, W, H, ds) {
    const sklon = new Float32Array(W * H), orient = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      const d = typeof ds === 'function' ? ds(y) : ds;
      const y0 = Math.max(0, y - 1), y1 = Math.min(H - 1, y + 1);
      for (let x = 0; x < W; x++) {
        const x0 = Math.max(0, x - 1), x1 = Math.min(W - 1, x + 1);
        const gx = (v[y * W + x1] - v[y * W + x0]) / ((x1 - x0) * d);   // stoupání na východ
        const gy = (v[y1 * W + x] - v[y0 * W + x]) / ((y1 - y0) * d);   // stoupání na jih
        const i = y * W + x;
        sklon[i] = Math.atan(Math.hypot(gx, gy)) / D2R;
        orient[i] = (Math.atan2(-gx, gy) / D2R + 360) % 360;
      }
    }
    return { sklon, orient };
  }

  const SEKTORY = ['S', 'SV', 'V', 'JV', 'J', 'JZ', 'Z', 'SZ'];
  const SEKTORY_EN = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  /** Index sektoru 0–7 (S, SV, V…) pro azimut. */
  const sektor = az => Math.round((((az % 360) + 360) % 360) / 45) % 8;
  /** Třídy sklonu jako na mapách SLF/HS: 30–35 žlutá, 35–40 oranžová, 40–45 červená, ≥ 45 fialová. */
  const TRIDY_SKLONU = [
    { od: 30, barva: [245, 222, 0], popis: '30–35°' },
    { od: 35, barva: [245, 140, 0], popis: '35–40°' },
    { od: 40, barva: [220, 20, 30], popis: '40–45°' },
    { od: 45, barva: [140, 50, 170], popis: '≥ 45°' }
  ];
  function tridaSklonu(s) {
    for (let i = TRIDY_SKLONU.length - 1; i >= 0; i--) if (s >= TRIDY_SKLONU[i].od) return i;
    return -1;
  }
  const BARVY_SEKTORU = [[40, 90, 220], [0, 170, 200], [40, 170, 60], [170, 200, 0], [240, 200, 0], [240, 120, 0], [220, 30, 40], [150, 40, 170]];
  /** Obarví sklon/orientaci do RGBA. rezim: 'sklon' | 'orientace'; sektory: pole 8 bool (null = všechny). */
  function obarvi(sk, rezim, sektory, pruhlednost) {
    const n = sk.sklon.length, out = new Uint8ClampedArray(n * 4), a = Math.round((pruhlednost == null ? 0.65 : pruhlednost) * 255);
    for (let i = 0; i < n; i++) {
      const s = sk.sklon[i], sek = sektor(sk.orient[i]);
      if (sektory && !sektory[sek]) continue;
      let c = null;
      if (rezim === 'orientace') { if (s >= 20) c = BARVY_SEKTORU[sek]; }
      else { const t = tridaSklonu(s); if (t >= 0) c = TRIDY_SKLONU[t].barva; }
      if (!c) continue;
      out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = a;
    }
    return out;
  }
  /** Dlaždice (zoom z) a pixel v ní pro bod. */
  function dlazdiceBodu(lat, lon, z) {
    const n = Math.pow(2, z) * 256;
    const px = (lon + 180) / 360 * n;
    const py = (1 - Math.log(Math.tan(lat * D2R) + 1 / Math.cos(lat * D2R)) / Math.PI) / 2 * n;
    return { x: Math.floor(px / 256), y: Math.floor(py / 256), px: Math.floor(px) % 256, py: Math.floor(py) % 256 };
  }
  /** Závětrné orientace (kam vítr ukládá sníh): opačný směr k větru ± 45°. Vrací pole 8 bool. */
  function zavetrneSektory(smerVetru) {
    const st = sektor(smerVetru + 180), out = new Array(8).fill(false);
    out[st] = out[(st + 1) % 8] = out[(st + 7) % 8] = true;
    return out;
  }

  // ---------- Lavinové nebezpečí a redukční metoda ----------
  const STUPNE = [
    null,
    { n: 1, nazev: 'nízké', en: 'low', barva: '#ccff66' },
    { n: 2, nazev: 'mírné', en: 'moderate', barva: '#ffff00' },
    { n: 3, nazev: 'značné', en: 'considerable', barva: '#ff9900' },
    { n: 4, nazev: 'vysoké', en: 'high', barva: '#ff0000' },
    { n: 5, nazev: 'velmi vysoké', en: 'very_high', barva: '#a00000' }
  ];
  /** Potenciál nebezpečí podle Muntera: 2^stupeň (1 → 2, 2 → 4, 3 → 8, 4 → 16). */
  const potencial = st => Math.pow(2, st);
  const RF1 = { zadny: 1, pod40: 2, pod35: 4, pod30: 6 };          // nejstrmější část svahu
  const RF2 = { zadny: 1, sever: 2, severniPulka: 3, projete: 2 };  // jeden z nich
  const RF3 = { zadny: 1, velkaOdstupy: 2, mala: 2, malaOdstupy: 3 };  // jeden z nich
  /** Redukční metoda (W. Munter, 3×3 Lawinen, 1997). Vrací zbytkové riziko a porušená povinná pravidla.
      v = { stupen 1–5, sklon: klíč RF1, orientace: klíč RF2, skupina: klíč RF3, mokry: bool } */
  function redukce(v) {
    const st = Math.max(1, Math.min(5, Math.round(+v.stupen || 1)));
    const pravidla = [];
    if (st === 5) return { stupen: st, gp: potencial(5), rf: 1, rf1: 1, rf2: 1, rf3: 1, riziko: Infinity, prijatelne: false,
      pravidla: ['Při stupni 5 se túry mimo zajištěné terény nepodnikají.'] };
    const rf1 = RF1[v.sklon] || 1;
    let rf2 = RF2[v.orientace] || 1;
    if (v.mokry && (v.orientace === 'sever' || v.orientace === 'severniPulka')) {
      rf2 = 1; pravidla.push('Při mokrém sněhu (jaro, oteplení) neplatí redukční faktory za vynechání severních orientací.');
    }
    const rf3 = RF3[v.skupina] || 1, rf = rf1 * rf2 * rf3, gp = potencial(st);
    if (st === 3 && rf1 < 2) pravidla.push('Při stupni 3 (značné) je povinné vynechat svahy 40° a strmější.');
    if (st === 4 && rf1 < 6) pravidla.push('Při stupni 4 (vysoké) je povinné zůstat v terénu pod 30°.');
    const riziko = gp / rf;
    return { stupen: st, gp, rf1, rf2, rf3, rf, riziko, prijatelne: riziko <= 1 && pravidla.filter(p => p.includes('povinné')).length === 0, pravidla };
  }
  /** Elementární redukční metoda: nejvyšší přípustný sklon (°) pro stupeň; 0 = mimo terén. */
  const elementarni = st => ({ 1: 90, 2: 40, 3: 35, 4: 30 })[st] || 0;

  // ---------- Bulletin CAAML v6 ----------
  const STUPEN_Z_TEXTU = { low: 1, moderate: 2, considerable: 3, high: 4, very_high: 5 };
  const PROBLEMY = {
    new_snow: 'Nový sníh', wind_slab: 'Navátý sníh (vítr)', persistent_weak_layers: 'Přetrvávající slabé vrstvy',
    wet_snow: 'Mokrý sníh', gliding_snow: 'Klouzavý sníh (sesuvy po podloží)', cornices: 'Převěje',
    favourable_situation: 'Příznivá situace', no_distinct_avalanche_problem: 'Bez výrazného lavinového problému'
  };
  const AZ_EN = { N: 0, NE: 1, E: 2, SE: 3, S: 4, SW: 5, W: 6, NW: 7 };
  /** Prostý text z HTML komentáře bulletinu. */
  function prostyText(h) {
    return String(h || '').replace(/<br\s*\/?>|<\/(p|li|h\d)>/gi, '\n').replace(/<li>/gi, '• ').replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  const vyskaText = e => !e ? '' : e.lowerBound && e.upperBound ? `${e.lowerBound}–${e.upperBound} m` : e.lowerBound ? `nad ${e.lowerBound} m` : e.upperBound ? `pod ${e.upperBound} m` : '';
  /** Zpracuje bulletiny CAAML v6 a seskupí regiony se shodným obsahem. */
  function zpracujBulletiny(json) {
    const skupiny = new Map();
    for (const b of (json && json.bulletins) || []) {
      const hodnoceni = (b.dangerRatings || []).map(r => ({ stupen: STUPEN_Z_TEXTU[r.mainValue] || 0, vyska: vyskaText(r.elevation),
        obdobi: r.validTimePeriod || 'all_day', podstupen: r.customData && r.customData.CH && r.customData.CH.subdivision || '' }));
      const problemy = (b.avalancheProblems || []).map(p => ({ typ: p.problemType, nazev: PROBLEMY[p.problemType] || p.problemType,
        vyska: vyskaText(p.elevation), sektory: (p.aspects || []).map(a => AZ_EN[a]).filter(x => x !== undefined),
        stupen: STUPEN_Z_TEXTU[p.dangerRatingValue] || 0, obdobi: p.validTimePeriod || 'all_day', text: prostyText(p.comment) }));
      const max = hodnoceni.reduce((m, h) => Math.max(m, h.stupen), 0);
      const zaznam = { max, hodnoceni, problemy,
        hlavni: prostyText(b.avalancheActivity && (b.avalancheActivity.highlights || b.avalancheActivity.comment)),
        snih: prostyText(b.snowpackStructure && b.snowpackStructure.comment),
        tendence: prostyText(b.tendency && b.tendency[0] && (b.tendency[0].highlights || b.tendency[0].comment)),
        od: b.validTime && b.validTime.startTime, do: b.validTime && b.validTime.endTime, vydano: b.publicationTime || '' };
      const klic = JSON.stringify([zaznam.hodnoceni, zaznam.problemy, zaznam.hlavni, zaznam.tendence]);
      if (!skupiny.has(klic)) skupiny.set(klic, Object.assign(zaznam, { regiony: [] }));
      for (const r of b.regions || []) skupiny.get(klic).regiony.push(r.name);
    }
    return [...skupiny.values()].sort((a, b) => b.max - a.max || b.regiony.length - a.regiony.length);
  }
  /** Platí bulletin v čase t (ms)? */
  const platny = (s, t) => !!(s.do && Date.parse(s.do) > t);

  // ---------- Open-Meteo ----------
  const HODINOVE = 'temperature_2m,snowfall,rain,snow_depth,wind_speed_10m,wind_direction_10m,wind_gusts_10m,freezing_level_height';
  function urlPredpoved(m) {
    return 'https://api.open-meteo.com/v1/forecast?latitude=' + m.lat.toFixed(4) + '&longitude=' + m.lon.toFixed(4) +
      (m.vyska != null ? '&elevation=' + Math.round(m.vyska) : '') + '&hourly=' + HODINOVE + '&past_days=3&forecast_days=7&timezone=auto';
  }
  /** Sezóna = 1. 10. roku r až 30. 6. dalšího roku, oříznuto na včerejšek. */
  function sezona(r, dnesIso) {
    const od = r + '-10-01', vcera = new Date(Date.parse(dnesIso + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);
    const konec = (r + 1) + '-06-30';
    return { od, do: konec < vcera ? konec : vcera, nazev: r + '/' + String(r + 1).slice(2) };
  }
  /** Rok začátku aktuální sezóny (od září počítáme novou). */
  const aktualniSezona = dnesIso => { const r = +dnesIso.slice(0, 4), mes = +dnesIso.slice(5, 7); return mes >= 9 ? r : r - 1; };
  function urlArchiv(m, s) {
    return 'https://archive-api.open-meteo.com/v1/archive?latitude=' + m.lat.toFixed(4) + '&longitude=' + m.lon.toFixed(4) +
      (m.vyska != null ? '&elevation=' + Math.round(m.vyska) : '') + '&start_date=' + s.od + '&end_date=' + s.do +
      '&hourly=snow_depth,snowfall&daily=temperature_2m_max,temperature_2m_min&timezone=auto';
  }
  /** Hodinová data → denní řady: max výška sněhu (cm), součet nového sněhu (cm). */
  function denniZHodin(h) {
    const dny = [], idx = new Map();
    (h.time || []).forEach((t, i) => {
      const d = t.slice(0, 10);
      if (!idx.has(d)) { idx.set(d, dny.length); dny.push({ datum: d, snih: null, novy: 0, nNovy: 0 }); }
      const z = dny[idx.get(d)], sd = h.snow_depth && h.snow_depth[i], sf = h.snowfall && h.snowfall[i];
      if (sd != null) z.snih = Math.max(z.snih == null ? 0 : z.snih, sd * 100);
      if (sf != null) { z.novy += sf; z.nNovy++; }
    });
    return dny.map(d => ({ datum: d.datum, snih: d.snih == null ? null : Math.round(d.snih), novy: d.nNovy ? Math.round(d.novy * 10) / 10 : null }));
  }
  /** Souhrn sezóny: max. výška sněhu, součet nového sněhu, dny se sněhovou pokrývkou ≥ 10 cm. */
  function souhrnSezony(dny) {
    let max = null, datumMax = '', soucet = 0, dnySnih = 0;
    for (const d of dny) {
      if (d.snih != null && (max == null || d.snih > max)) { max = d.snih; datumMax = d.datum; }
      if (d.novy) soucet += d.novy;
      if (d.snih >= 10) dnySnih++;
    }
    return { max, datumMax, soucet: Math.round(soucet), dnySnih };
  }
  const soucetOkna = (pole, od, doo) => { let s = 0; for (let i = Math.max(0, od); i < Math.min(pole.length, doo); i++) s += pole[i] || 0; return s; };
  const maxOkna = (pole, od, doo) => { let m = null; for (let i = Math.max(0, od); i < Math.min(pole.length, doo); i++) if (pole[i] != null && (m == null || pole[i] > m)) m = pole[i]; return m; };
  /** Průměrný směr (vektorově), váženo rychlostí. */
  function prumernySmer(smer, rychl, od, doo) {
    let sx = 0, sy = 0;
    for (let i = Math.max(0, od); i < Math.min(smer.length, doo); i++) {
      if (smer[i] == null) continue;
      const w = rychl && rychl[i] != null ? rychl[i] : 1;
      sx += Math.sin(smer[i] * D2R) * w; sy += Math.cos(smer[i] * D2R) * w;
    }
    return sx === 0 && sy === 0 ? null : (Math.atan2(sx, sy) / D2R + 360) % 360;
  }
  /** Index první hodiny ≥ teď (čas ve tvaru ISO bez zóny, místní čas lokality). */
  function indexTed(cas, tedIso) { const i = cas.findIndex(t => t >= tedIso); return i < 0 ? cas.length : i; }
  /** Upozornění z počasí (nejde o lavinovou předpověď!). h = hourly z Open-Meteo, ted = index aktuální hodiny. */
  function vyhodnotPocasi(h, ted, vyskaBodu, sek) {
    sek = sek || SEKTORY;
    const out = [], P = (uroven, nadpis, text) => out.push({ uroven, nadpis, text });
    const novy72 = soucetOkna(h.snowfall, ted - 72, ted), novy48 = soucetOkna(h.snowfall, ted, ted + 48);
    const vitr = h.wind_speed_10m || [], naraz = h.wind_gusts_10m || [];
    const vitrMax = maxOkna(vitr, ted - 72, ted + 48) || 0, narazMax = maxOkna(naraz, ted - 72, ted + 48) || 0;
    const snihTed = h.snow_depth ? h.snow_depth[Math.min(ted, h.snow_depth.length - 1)] : null;
    const tMax48 = maxOkna(h.temperature_2m || [], ted, ted + 48);
    const dest = soucetOkna(h.rain || [], ted - 24, ted + 48);
    const izoterma = maxOkna(h.freezing_level_height || [], ted, ted + 48);
    const smer = prumernySmer(h.wind_direction_10m || [], vitr, ted - 72, ted + 48);
    if (novy72 >= 30) P('vysoke', 'Hodně nového sněhu', `Za poslední 3 dny napadlo podle modelu asi ${Math.round(novy72)} cm. Kritická množství podle Muntera: 10–20 cm za nepříznivých podmínek, 20–30 cm za středních, 30–50 cm za příznivých.`);
    else if (novy72 >= 10) P('pozor', 'Nový sníh', `Za poslední 3 dny asi ${Math.round(novy72)} cm nového sněhu. Se silným větrem nebo na slabém starém povrchu už to může stačit ke vzniku desek.`);
    if (novy48 >= 10) P('pozor', 'Další sněžení', `V příštích 48 h model čeká asi ${Math.round(novy48)} cm nového sněhu.`);
    if (vitrMax >= 30 && (novy72 + novy48 >= 5 || (snihTed || 0) > 0.1)) {
      const zav = smer == null ? '' : ' Převládající vítr od ' + sek[sektor(smer)] + ' → sníh se ukládá hlavně na svazích orientovaných k ' + zavetrneSektory(smer).map((b, i) => b ? sek[i] : '').filter(Boolean).join(', ') + '.';
      P(vitrMax >= 50 ? 'vysoke' : 'pozor', 'Přenos sněhu větrem', `Vítr až ${Math.round(vitrMax)} km/h (nárazy ${Math.round(narazMax)} km/h). Sypký sníh se začíná přenášet už od ~20 km/h, silně od ~30–50 km/h; na hřebenech je vítr silnější než v modelu.` + zav);
    }
    if ((snihTed || 0) > 0 && tMax48 != null && tMax48 > 0) P(tMax48 > 5 ? 'vysoke' : 'pozor', 'Oteplení', `Teplota v příštích 48 h až ${tMax48.toFixed(1)} °C` + (izoterma != null ? `, nulová izoterma až ${Math.round(izoterma)} m` + (vyskaBodu != null && izoterma > vyskaBodu ? ' (nad místem)' : '') : '') + '. Rychlé a první výrazné oteplení oslabuje sněhovou pokrývku – v teplé části dne hrozí mokré laviny, vyrážejte brzy.');
    if ((snihTed || 0) > 0 && dest >= 2) P('vysoke', 'Déšť do sněhu', `Asi ${dest.toFixed(1)} mm deště na sněhovou pokrývku (24 h zpět až 48 h dopředu). Déšť na sníh je typický spouštěč mokrých a klouzavých lavin.`);
    if (!out.length) P('info', 'Bez nápadných signálů v počasí', 'Model neukazuje výrazné nové sněžení, silný vítr ani oteplení. To ale neříká nic o stavu starého sněhu (slabé vrstvy) – rozhoduje lavinová předpověď a terén.');
    return { upozorneni: out, novy72, novy48, vitrMax: vitrMax, narazMax, smer, tMax48, izoterma, snihTed: snihTed == null ? null : Math.round(snihTed * 100) };
  }

  // ---------- kontrolní seznam ----------
  const SEZNAM = [
    ['Plánování doma', [
      'Přečetl(a) jsem aktuální lavinovou předpověď pro oblast (stupeň, lavinové problémy, kritické orientace a výšky).',
      'Znám vývoj počasí za poslední dny: nový sníh, vítr, oteplení, déšť.',
      'Trasu mám prověřenou na mapě sklonů – vím, kde jsou úseky nad 30°, a co je nade mnou.',
      'Mám spočítané zbytkové riziko (redukční metoda) a připravenou bezpečnější variantu.',
      'Znám časový plán a čas obratu; počítám s kratším zimním dnem.',
      'Někdo ví, kam jdu a kdy se vrátím.'
    ]],
    ['Vybavení', [
      'Lavinový vyhledávač (LVS) zapnutý na sobě, nabité baterie.',
      'Lopata a sonda u každého člena skupiny.',
      'Nabitý telefon, číslo záchranné služby: 112 (v ČR Horská služba 1210).',
      'První pomoc, izolace, čelovka, rezerva oblečení.'
    ]],
    ['Na začátku túry', [
      'Kontrola LVS ve skupině (vysílání i příjem).',
      'Skupina je domluvená: kdo vede, odstupy, kde se čeká.'
    ]],
    ['Během túry', [
      'Sleduji varovné signály: čerstvé laviny, praskání a „wumm“, trhliny, čerstvé návěje, rychlé oteplení.',
      'Strmé svahy jdu/sjíždím jednotlivě, s odstupy, zastavuji na bezpečných místech.',
      'Průběžně přehodnocuji – když se podmínky liší od očekávání, otočím.'
    ]]
  ];

  const API = {
    KLIC, OBVOD, terrariumVyska, vyskyZRgba, latRadku, pixelDlazdice, sklonOrientace, SEKTORY, SEKTORY_EN, sektor,
    TRIDY_SKLONU, tridaSklonu, BARVY_SEKTORU, obarvi, dlazdiceBodu, zavetrneSektory,
    STUPNE, potencial, RF1, RF2, RF3, redukce, elementarni,
    PROBLEMY, prostyText, zpracujBulletiny, platny,
    urlPredpoved, sezona, aktualniSezona, urlArchiv, denniZHodin, souhrnSezony, prumernySmer, indexTed, vyhodnotPocasi, SEZNAM
  };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else koren.SnihJadro = API;
})(this);
