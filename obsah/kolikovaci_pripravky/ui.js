/* ============================================================
   Kolíkovací a kapsové přípravky – uživatelské rozhraní
   ============================================================ */
(function () {
  'use strict';
  const KP = window.KP, KPV = window.KPV, KPSTL = window.KPSTL, KPPrincip = window.KPPrincip;
  const $ = (id) => document.getElementById(id);
  const KLIC = 'webapp_kolikovaci_pripravky', KLIC_PROJEKTY = 'webapp_kolikovaci_pripravky_projekty';
  const cz = KP.cz;
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const toast = (t, ch) => (window.Dialog ? (ch ? Dialog.chyba(t) : Dialog.info(t)) : console.log(t));
  const REZIMY = Object.keys(KP.REZIMY);
  const spojovy = (S) => ['kolik', 'konfirmat', 'excentr'].includes(S.rezim);

  /* ---------- předvolby ---------- */
  const PREDVOLBY = [
    { nazev: '— vyberte předvolbu —' },
    { nazev: 'Korpus 18 mm – roh, kolíky Ø 8', rezim: 'kolik', spoj: { typ: 'roh', tA: 18, tB: 18, sirka: 300, material: 'dtd', stredeni: 'stred' }, rozlozeni: { zpusob: 'auto', odsazeni: 32, odsazeniKonec: 32 } },
    { nazev: 'Police do boku (T-spoj) 18 mm', rezim: 'kolik', spoj: { typ: 'T', tA: 18, tB: 18, sirka: 280, poloha: 96, material: 'dtd', stredeni: 'stred' }, rozlozeni: { zpusob: 'auto', odsazeni: 32, odsazeniKonec: 32 } },
    { nazev: 'Spárovka 20 mm – hrana na hranu', rezim: 'kolik', spoj: { typ: 'hrana', tA: 20, tB: 20, sirka: 600, material: 'masiv', stredeni: 'stred' }, rozlozeni: { zpusob: 'roztec', roztec: 150, odsazeni: 50, odsazeniKonec: 50 } },
    { nazev: 'Rám z hranolů 27 mm – kolíky od líce', rezim: 'kolik', spoj: { typ: 'hrana', tA: 27, tB: 27, sirka: 70, material: 'masiv', stredeni: 'lic', odLice: 10 }, rozlozeni: { zpusob: 'pocet', pocet: 2, odsazeni: 18, odsazeniKonec: 26 } },
    { nazev: 'Rám dvířek 19 mm – kapsy 15°', rezim: 'kapsa', spoj: { tA: 19, tB: 19 }, kapsa: { typ: 'rovina', sirka: 60, pocet: 'auto', dvojity: true } },
    { nazev: 'Korpus 18 mm – kapsy do boku (T)', rezim: 'kapsa', spoj: { tA: 18, tB: 18 }, kapsa: { typ: 'T', sirka: 300, pocet: 'auto', dvojity: false } },
    { nazev: 'Skříň DTD 18 mm – konfirmáty 7×50', rezim: 'konfirmat', spoj: { typ: 'roh', tA: 18, tB: 18, sirka: 400, material: 'dtd' }, rozlozeni: { zpusob: 'auto', odsazeni: 50, odsazeniKonec: 50 } },
    { nazev: 'Police 18 mm – excentry 15 mm', rezim: 'excentr', spoj: { typ: 'T', tA: 18, tB: 18, sirka: 350, poloha: 64, material: 'dtd' }, rozlozeni: { zpusob: 'pocet', pocet: 2, odsazeni: 37, odsazeniKonec: 37 }, excentr: { odHrany: 24, hloubka: 13, cep: 5 } },
    { nazev: 'Centrovací měrky Ø 6 / 8 / 10', rezim: 'centr', centr: { prumery: [6, 8, 10], kusu: 4 } },
  ];

  /* ---------- formuláře (schéma polí) ---------- */
  const N = (k, l, o) => Object.assign({ k, l, typ: 'num' }, o || {});
  const SEL = (k, l, opts, o) => Object.assign({ k, l, typ: 'sel', opts }, o || {});
  const CHK = (k, l, o) => Object.assign({ k, l, typ: 'chk' }, o || {});
  const AUTO = (k, l, o) => Object.assign({ k, l, typ: 'auto' }, o || {});
  const POLE_SPOJ = [
    SEL('spoj.typ', 'Typ spoje', [['roh', 'roh (čelo A na kraj B)'], ['T', 'T (čelo A na plochu B)'], ['hrana', 'hrana na hranu']], { kdy: (S) => spojovy(S), cela: true }),
    SEL('kapsa.typ', 'Typ spoje', [['rovina', 'v rovině (rám, hrana na hranu)'], ['T', 'T (čelo A na plochu B)']], { kdy: (S) => S.rezim === 'kapsa', cela: true }),
    N('spoj.tA', 'Tloušťka A (čelo / kapsa)', { min: 6, max: 80, step: 0.5 }),
    N('spoj.tB', 'Tloušťka B (protikus)', { min: 6, max: 80, step: 0.5 }),
    N('spoj.sirka', 'Šířka spoje W (mm)', { min: 20, max: 3000, step: 1, kdy: spojovy }),
    N('spoj.poloha', 'Poloha T od čela B', { min: 0, max: 2000, step: 1, kdy: (S) => spojovy(S) && S.spoj.typ === 'T' }),
    SEL('spoj.material', 'Materiál', [['masiv', 'masivní dřevo'], ['preklizka', 'překližka'], ['mdf', 'MDF'], ['dtd', 'DTD (dřevotříska)']], { kdy: spojovy }),
    SEL('spoj.stredeni', 'Poloha přes tloušťku', [['stred', 'na střed (samostředicí U)'], ['lic', 'od líce (doraz L)']], { kdy: (S) => S.rezim === 'kolik' || S.rezim === 'konfirmat' }),
    N('spoj.odLice', 'Vzdálenost od líce', { min: 3, max: 60, step: 0.5, kdy: (S) => (S.rezim === 'kolik' || S.rezim === 'konfirmat') && S.spoj.stredeni === 'lic' }),
    SEL('spoj.zarovnani', 'Líce dílů', [['lic', 'lícují (rovina)'], ['osa', 'osa na střed obou']], { kdy: (S) => S.rezim === 'kolik' && S.spoj.typ === 'hrana' }),
    N('spoj.delkaA', 'Délka dílu A (náhled)', { min: 30, max: 3000, step: 1, kdy: spojovy }),
    N('spoj.delkaB', 'Délka dílu B (náhled)', { min: 30, max: 3000, step: 1, kdy: spojovy }),
  ];
  const ROZL = [
    SEL('rozlozeni.zpusob', 'Rozložení', [['auto', 'podle šířky (pravidla)'], ['pocet', 'zadaný počet'], ['roztec', 'zadaná rozteč']], { cela: true }),
    N('rozlozeni.pocet', 'Počet', { min: 1, max: 60, step: 1, kdy: (S) => S.rozlozeni.zpusob === 'pocet' }),
    N('rozlozeni.roztec', 'Rozteč', { min: 10, max: 1000, step: 1, kdy: (S) => S.rozlozeni.zpusob === 'roztec' }),
    N('rozlozeni.odsazeni', 'Odsazení od ref. konce', { min: 0, max: 1000, step: 0.5 }),
    N('rozlozeni.odsazeniKonec', 'Odsazení od druhého konce', { min: 0, max: 1000, step: 0.5, kdy: (S) => S.rozlozeni.zpusob !== 'roztec' }),
  ];
  const POLE_PRVEK = {
    kolik: [SEL('kolik.prumer', 'Ø kolíku', [['auto', 'auto (pravidlo)'], ['6', '6'], ['8', '8'], ['10', '10'], ['12', '12']]), AUTO('kolik.delka', 'Délka kolíku'), AUTO('kolik.hloubkaA', 'Hloubka do A (čelo)'), AUTO('kolik.hloubkaB', 'Hloubka do B'), ...ROZL],
    konfirmat: [N('konfirmat.delka', 'Délka konfirmátu', { min: 30, max: 80, step: 1 }), ...ROZL],
    excentr: [N('excentr.odHrany', 'Excentr od čela', { min: 10, max: 60, step: 0.5 }), N('excentr.hloubka', 'Hloubka Ø 15', { min: 6, max: 30, step: 0.5 }), SEL('excentr.cep', 'Čep do boku Ø', [['5', '5 (šroubovací)'], ['8', '8 (kolíkový)']]), ...ROZL],
    kapsa: [AUTO('kapsa.vrut', 'Délka vrutu'), N('kapsa.sirka', 'Šířka dílu A (napříč)', { min: 15, max: 2000, step: 1 }), AUTO('kapsa.pocet', 'Počet kapes'), N('kapsa.odsazeni', 'Odsazení krajní kapsy', { min: 5, max: 200, step: 0.5 }), CHK('kapsa.dvojity', 'Dvojitý přípravek (dvě vedení)'), N('kapsa.roztecVodítek', 'Rozteč vedení', { min: 14, max: 80, step: 0.5, kdy: (S) => S.kapsa.dvojity })],
    centr: [{ k: 'centr.prumery', l: 'Průměry', typ: 'prumery', cela: true }, N('centr.kusu', 'Kusů od každého', { min: 1, max: 12, step: 1 }), N('centr.delkaCepu', 'Délka čepu', { min: 4, max: 20, step: 0.5 }), N('centr.hrot', 'Výška hrotu', { min: 1, max: 6, step: 0.5 }), N('centr.vule', 'Vůle čepu (na poloměru)', { min: -0.2, max: 0.3, step: 0.01 }), CHK('centr.spendlik', 'Otvor pro špendlík v hrotu')],
  };
  const NE_CENTR = (S) => S.rezim !== 'centr';
  const POLE_PRIPRAVEK = [
    N('pripravek.Hv', 'Výška vedení (deska)', { min: 4, max: 40, step: 0.5, kdy: (S) => spojovy(S) }),
    N('pripravek.vodiciDelka', 'Délka vedení', { min: 10, max: 80, step: 0.5, kdy: (S) => S.rezim === 'kapsa' }),
    N('pripravek.stena', 'Stěna', { min: 2, max: 10, step: 0.5, kdy: NE_CENTR }),
    N('pripravek.vyskaLic', 'Výška bočnic', { min: 6, max: 60, step: 0.5, kdy: spojovy }),
    N('pripravek.doraz', 'Tloušťka dorazu', { min: 2, max: 15, step: 0.5, kdy: NE_CENTR }),
    N('pripravek.dorazHl', 'Doraz přes hranu', { min: 3, max: 30, step: 0.5, kdy: NE_CENTR }),
    N('pripravek.vuleSevreni', 'Vůle sevření U', { min: 0, max: 1.5, step: 0.05, kdy: spojovy }),
    N('pripravek.kridlo', 'Křídlo excentru tl.', { min: 6, max: 20, step: 0.5, kdy: (S) => S.rezim === 'excentr' }),
    SEL('pripravek.otvor', 'Vedení vrtáku', [['vule', 'tisknuté s vůlí'], ['pouzdro', 'kovové pouzdro']], { kdy: NE_CENTR }),
    N('pripravek.vule', 'Vůle na Ø', { min: 0, max: 2, step: 0.05, kdy: NE_CENTR }),
    AUTO('pripravek.pouzdroD', 'Vnější Ø pouzdra', { kdy: (S) => NE_CENTR(S) && S.pripravek.otvor === 'pouzdro' }),
    N('pripravek.presah', 'Přesah nalisování', { min: -0.3, max: 0.4, step: 0.01, kdy: (S) => NE_CENTR(S) && S.pripravek.otvor === 'pouzdro' }),
    N('pripravek.stul', 'Tisková plocha', { min: 60, max: 1000, step: 5, kdy: NE_CENTR }),
    SEL('pripravek.protikus', 'Protikus hrany', [['zrcadlo', 'zrcadlový jen když je potřeba'], ['vzdy', 'vždy samostatný přípravek B']], { kdy: (S) => S.rezim === 'kolik' && S.spoj.typ === 'hrana' }),
    N('pripravek.krouzekV', 'Kroužek: výška', { min: 4, max: 30, step: 0.5, kdy: NE_CENTR }),
    N('pripravek.krouzekStena', 'Kroužek: stěna', { min: 2, max: 15, step: 0.5, kdy: NE_CENTR }),
    N('pripravek.sroubek', 'Stavěcí šroub M', { min: 2, max: 6, step: 0.5, kdy: NE_CENTR }),
    CHK('pripravek.kapka', 'Kapkovitý otvor vedení (tisk na boku)', { kdy: (S) => S.rezim === 'kapsa' }),
    CHK('pripravek.oznaceni', 'Vyrýt označení dílu', { kdy: NE_CENTR }),
  ];
  const POLE_PRAVIDLA = [
    { skupina: 'Kolíky' },
    N('pravidla.prumerKoef', 'Ø ≤ koef. × tloušťka', { min: 0.2, max: 0.6, step: 0.01 }), N('pravidla.plochaKoef', 'Hloubka do plochy × tl.', { min: 0.3, max: 0.9, step: 0.01 }),
    N('pravidla.zbytekMin', 'Zbytek pod dnem (mm)', { min: 1, max: 15, step: 0.5 }), N('pravidla.celoPodil', 'Podíl délky v čele', { min: 0.3, max: 0.85, step: 0.01 }),
    N('pravidla.vuleDno', 'Vůle na lepidlo (mm)', { min: 0, max: 3, step: 0.5 }), N('pravidla.roztecMax', 'Největší rozteč', { min: 32, max: 400, step: 1 }),
    N('pravidla.odsazeniMin', 'Nejmenší odsazení', { min: 5, max: 100, step: 1 }), N('pravidla.stenaMin', 'Nejmenší stěna', { min: 1, max: 10, step: 0.5 }),
    { k: 'pravidla.delkyKoliku', l: 'Typické délky kolíků (Ø: délky; …)', typ: 'delky', cela: true },
    N('pravidla.tauKolik', 'τ střih kolíku (MPa)', { min: 1, max: 30, step: 0.5 }),
    { k: 'pravidla.tauLepidlo', l: 'τ lepené spáry (MPa): masiv, překližka, MDF, DTD', typ: 'tau', cela: true },
    { skupina: 'Kapsy' },
    N('pravidla.kapsaUhel', 'Úhel (°)', { min: 5, max: 30, step: 0.5 }), N('pravidla.kapsaPilot', 'Ø pilotu', { min: 2, max: 6, step: 0.1 }),
    N('pravidla.kapsaD', 'Ø kapsy', { min: 6, max: 14, step: 0.1 }), N('pravidla.kapsaDelkaPilotu', 'Délka pilotu (špička → stupeň)', { min: 8, max: 60, step: 0.5 }),
    N('pravidla.kapsaRezerva', 'Rezerva hrotu', { min: 1, max: 10, step: 0.5 }), N('pravidla.kapsaPodHlavou', 'Min. vrut v dílu A', { min: 2, max: 20, step: 0.5 }),
    N('pravidla.vrutD', 'Ø vrutu (výpočet)', { min: 3, max: 6, step: 0.1 }), N('pravidla.fAx', 'Výtažná pevnost f (N/mm²)', { min: 2, max: 40, step: 0.5 }),
    { k: 'pravidla.vruty', l: 'Vruty podle tloušťky (do tl.: délka; …)', typ: 'vruty', cela: true },
    { skupina: 'Konfirmát / excentr' },
    N('pravidla.konfirmatD', 'Konfirmát Ø', { min: 5, max: 9, step: 0.5 }), N('pravidla.konfirmatPilot', 'Předvrtání Ø', { min: 3, max: 7, step: 0.5 }),
    N('pravidla.konfirmatHlava', 'Zahloubení Ø', { min: 8, max: 14, step: 0.5 }), N('pravidla.konfirmatRezerva', 'Rezerva hloubky', { min: 0, max: 8, step: 0.5 }),
    N('pravidla.excentrD', 'Excentr Ø', { min: 10, max: 30, step: 0.5 }), N('pravidla.excentrSroub', 'Šroub do čela Ø', { min: 5, max: 12, step: 0.5 }),
    N('pravidla.excentrCepH', 'Hloubka čepu v boku', { min: 5, max: 20, step: 0.5 }), N('pravidla.excentrStopka', 'Stopka Forstneru Ø', { min: 6, max: 13, step: 0.5 }),
  ];

  /* ---------- stav ---------- */
  const ziskej = (o, k) => k.split('.').reduce((a, x) => (a == null ? a : a[x]), o);
  const nastav = (o, k, v) => { const c = k.split('.'); let a = o; for (let i = 0; i < c.length - 1; i++) { if (a[c[i]] == null || typeof a[c[i]] !== 'object') a[c[i]] = {}; a = a[c[i]]; } a[c[c.length - 1]] = v; };
  function slouc(P, u) {
    if (!u || typeof u !== 'object') return P;
    if (KP.REZIMY[u.rezim]) P.rezim = u.rezim;
    for (const k of ['spoj', 'rozlozeni', 'kolik', 'konfirmat', 'excentr', 'kapsa', 'centr', 'pripravek', 'tisk']) if (u[k]) Object.assign(P[k], u[k]);
    if (u.pravidla) { Object.assign(P.pravidla, u.pravidla); }
    P.nazev = u.nazev || '';
    P.pohled = u.pohled || 0;
    return P;
  }
  function nacistStav() { try { return slouc(KP.vychoziProjekt(), JSON.parse(localStorage.getItem(KLIC) || 'null')); } catch (e) { return KP.vychoziProjekt(); } }
  let S = nacistStav(), R = null, ulozT = 0, pohledy = [], aktPohled = S.pohled || 0;
  const uloz = () => { clearTimeout(ulozT); ulozT = setTimeout(() => { try { S.pohled = aktPohled; localStorage.setItem(KLIC, JSON.stringify(S)); } catch (e) { /* plné úložiště */ } }, 250); };
  const projekty = () => { try { return JSON.parse(localStorage.getItem(KLIC_PROJEKTY) || '{}') || {}; } catch (e) { return {}; } };
  const ulozProjekty = (o) => { try { localStorage.setItem(KLIC_PROJEKTY, JSON.stringify(o)); return true; } catch (e) { toast('Úložiště prohlížeče je plné.', true); return false; } };

  /* ---------- vykreslení formulářů ---------- */
  let poleId = 0;
  function htmlPole(f) {
    if (f.skupina) return `<div class="skupina cela">${esc(f.skupina)}</div>`;
    if (f.kdy && !f.kdy(S)) return '';
    const id = 'f' + (++poleId), v = ziskej(S, f.k), c = f.cela ? ' class="cela"' : '';
    if (f.typ === 'chk') return `<div${c}><label class="chk"><input type="checkbox" id="${id}" data-k="${f.k}" data-t="chk"${v ? ' checked' : ''}> ${esc(f.l)}</label></div>`;
    if (f.typ === 'sel') return `<div${c}><label for="${id}">${esc(f.l)}</label><select id="${id}" data-k="${f.k}" data-t="sel">${f.opts.map(([a, b]) => `<option value="${a}"${String(v) === a ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select></div>`;
    if (f.typ === 'auto') return `<div${c}><label for="${id}">${esc(f.l)}</label><input id="${id}" type="number" step="0.5" min="0" data-k="${f.k}" data-t="auto" placeholder="auto" value="${v === 'auto' || v == null || v === '' ? '' : esc(v)}"></div>`;
    if (f.typ === 'prumery') return `<div${c}><label>${esc(f.l)}</label><div class="mrizka-chk">${[6, 8, 10, 12].map((d) => `<label class="chk"><input type="checkbox" data-k="${f.k}" data-t="prumery" value="${d}"${(v || []).includes(d) ? ' checked' : ''}> Ø ${d}</label>`).join('')}</div></div>`;
    if (f.typ === 'delky') return `<div${c}><label for="${id}">${esc(f.l)}</label><input id="${id}" type="text" data-k="${f.k}" data-t="delky" value="${esc(Object.entries(v || {}).map(([d, l]) => d + ': ' + l.join(', ')).join('; '))}"></div>`;
    if (f.typ === 'vruty') return `<div${c}><label for="${id}">${esc(f.l)}</label><input id="${id}" type="text" data-k="${f.k}" data-t="vruty" value="${esc((v || []).map((r) => r.doTl + ': ' + r.delka).join('; '))}"></div>`;
    if (f.typ === 'tau') return `<div${c}><label for="${id}">${esc(f.l)}</label><input id="${id}" type="text" data-k="${f.k}" data-t="tau" value="${esc(['masiv', 'preklizka', 'mdf', 'dtd'].map((m) => String((v || {})[m] == null ? '' : v[m]).replace('.', ',')).join('; '))}"></div>`;
    return `<div${c}><label for="${id}">${esc(f.l)}</label><input id="${id}" type="number" data-k="${f.k}" data-t="num" min="${f.min}" max="${f.max}" step="${f.step}" value="${esc(v)}"></div>`;
  }
  function vykresliFormulare() {
    $('poleSpoj').innerHTML = POLE_SPOJ.map(htmlPole).join('');
    $('polePrvek').innerHTML = (POLE_PRVEK[S.rezim] || []).map(htmlPole).join('');
    $('nadpisPrvek').textContent = { kolik: '🪵 Kolíky a rozložení', konfirmat: '🔩 Konfirmát a rozložení', excentr: '⚙️ Excentr a rozložení', kapsa: '📐 Kapsy a vrut', centr: '🎯 Centrovací měrky' }[S.rezim];
    $('polePripravek').innerHTML = POLE_PRIPRAVEK.map(htmlPole).join('');
    $('polePravidla').innerHTML = POLE_PRAVIDLA.map(htmlPole).join('');
    $('kartaSpoj').classList.toggle('skryte', S.rezim === 'centr');
    for (const k of ['papir', 'okraj', 'prekryv', 'papirW', 'papirH', 'chlopen', 'kalibX', 'kalibY']) $('t_' + k).value = S.tisk[k];
    $('blokPapir').classList.toggle('skryte', S.tisk.papir !== 'vlastni');
  }
  const cislo = (s) => parseFloat(String(s).replace(',', '.'));
  function zmenaPole(e) {
    const el = e.target, k = el.dataset.k, t = el.dataset.t;
    if (!k) return;
    let v;
    if (t === 'chk') v = el.checked;
    else if (t === 'sel') v = /^-?\d+(\.\d+)?$/.test(el.value) ? +el.value : el.value;
    else if (t === 'auto') v = el.value === '' || !isFinite(+el.value) || +el.value <= 0 ? 'auto' : +el.value;
    else if (t === 'prumery') v = [...document.querySelectorAll('input[data-t="prumery"]')].filter((x) => x.checked).map((x) => +x.value);
    else if (t === 'delky') { v = {}; for (const c of el.value.split(';')) { const [d, l] = c.split(':'); if (d && l) { const L = l.split(',').map(cislo).filter((x) => x > 0); if (+d > 0 && L.length) v[+d] = L; } } if (!Object.keys(v).length) return; }
    else if (t === 'vruty') { v = []; for (const c of el.value.split(';')) { const [a, b] = c.split(':').map(cislo); if (a > 0 && b > 0) v.push({ doTl: a, delka: b }); } if (!v.length) return; }
    else if (t === 'tau') { const x = el.value.split(';').map(cislo); v = {}; ['masiv', 'preklizka', 'mdf', 'dtd'].forEach((m, i) => { if (x[i] > 0) v[m] = x[i]; }); v = Object.assign({}, ziskej(S, k), v); }
    else { v = cislo(el.value); if (!isFinite(v)) return; }
    nastav(S, k, v);
    if (t === 'sel' || t === 'chk') vykresliFormulare();
    prepocti();
  }
  for (const id of ['poleSpoj', 'polePrvek', 'polePripravek', 'polePravidla']) { $(id).addEventListener('change', zmenaPole); $(id).addEventListener('input', (e) => { if (e.target.dataset.t === 'num' || e.target.dataset.t === 'auto') zmenaPole(e); }); }
  for (const k of ['papir', 'okraj', 'prekryv', 'papirW', 'papirH', 'chlopen', 'kalibX', 'kalibY']) $('t_' + k).addEventListener('change', () => { const el = $('t_' + k); S.tisk[k] = k === 'papir' ? el.value : cislo(el.value); $('blokPapir').classList.toggle('skryte', S.tisk.papir !== 'vlastni'); prepocti(); });

  /* ---------- režimy a předvolby ---------- */
  function vykresliRezimy() {
    $('rezimy').innerHTML = REZIMY.map((k, i) => { const r = KP.REZIMY[k]; return `<button type="button" data-rezim="${k}" aria-pressed="${k === S.rezim}" title="${esc(r.popis)} (klávesa ${i + 1})"><span class="ik" aria-hidden="true">${r.ikona}</span>${esc(r.nazev)}<kbd>${i + 1}</kbd></button>`; }).join('');
    $('popisRezimu').textContent = KP.REZIMY[S.rezim].popis;
  }
  function nastavRezim(k) {
    if (!KP.REZIMY[k]) return;
    S.rezim = k; aktPohled = 0;
    if (k !== 'kolik' && S.spoj.typ === 'hrana' && spojovy(S)) S.spoj.typ = 'roh';
    vykresliRezimy(); vykresliFormulare(); prepocti();
  }
  $('rezimy').addEventListener('click', (e) => { const b = e.target.closest('button[data-rezim]'); if (b) nastavRezim(b.dataset.rezim); });
  $('predvolba').innerHTML = PREDVOLBY.map((p, i) => `<option value="${i}">${esc(p.nazev)}</option>`).join('');
  $('predvolba').addEventListener('change', () => {
    const p = PREDVOLBY[+$('predvolba').value];
    if (!p || !p.rezim) return;
    const P = KP.vychoziProjekt(p.rezim);
    for (const k of ['spoj', 'rozlozeni', 'kapsa', 'excentr', 'centr']) if (p[k]) Object.assign(P[k], p[k]);
    P.pripravek = S.pripravek; P.tisk = S.tisk; P.pravidla = S.pravidla; P.nazev = p.nazev;
    S = P; $('nazevProjektu').value = p.nazev; aktPohled = 0;
    vykresliRezimy(); vykresliFormulare(); prepocti();
    $('predvolba').value = '0';
  });
  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea' || e.ctrlKey || e.metaKey || e.altKey) return;
    const m = /^(Digit|Numpad)([1-5])$/.exec(e.code);
    if (m) { nastavRezim(REZIMY[+m[2] - 1]); e.preventDefault(); return; }
    if (e.code === 'BracketLeft' || e.code === 'BracketRight') { vyberPohled((aktPohled + (e.code === 'BracketRight' ? 1 : -1) + pohledy.length) % pohledy.length); e.preventDefault(); }
  });

  /* ---------- přepočet a výpis ---------- */
  let prepT = 0;
  function prepocti() { clearTimeout(prepT); prepT = setTimeout(prepoctiHned, 60); }
  function prepoctiHned() {
    try { R = KP.navrh(S); } catch (e) { console.error(e); $('shrnuti').innerHTML = `<span class="chyba">Chyba výpočtu: ${esc(e.message)}</span>`; return; }
    uloz();
    $('shrnuti').innerHTML = KPV.shrnuti(R).map((t) => `<p>${esc(t)}</p>`).join('');
    $('varovani').innerHTML = (R.varovani || []).map((v) => `<li>${esc(v)}</li>`).join('');
    $('infoNavrh').innerHTML = (R.info || []).map((v) => `<p>${esc(v)}</p>`).join('');
    // kontrola sestavy
    if (R.diryA) {
      const k = KP.kontrolaSestavy(R), max = Math.max(0, ...k.map((x) => x.chyba)), u = Math.max(0, ...k.map((x) => x.uhel));
      $('stavKontroly').innerHTML = max < 0.01 && u < 0.01 ? `<span class="ok">✔ osy děr A/B po složení lícují (odchylka ${cz(max, 3)} mm)</span>` : `<span class="chyba">✖ osy nelícují – ${cz(max, 2)} mm / ${cz(u, 1)}°</span>`;
    } else if (R.rezim === 'kapsa') $('stavKontroly').innerHTML = `<span class="ok">✔ ${cz(R.uhel, 0)}°, výstup ${cz(R.E[1])} mm, hrot ${cz(R.rezervaHrotu)} mm od plochy</span>`;
    else $('stavKontroly').textContent = '';
    vykresliTabulky();
    vykresliPohledy();
    $('princip').innerHTML = KPPrincip.princip(S.rezim);
    $('postup').innerHTML = KPPrincip.postup(S.rezim);
    $('bezpecnost').innerHTML = KPPrincip.bezpecnost(S.rezim);
    infoStl();
    infoListy();
    aktualizuj3d();
  }
  function vykresliTabulky() {
    let h = '';
    if (R.diryA) {
      const kon = KP.kontrolaSestavy(R);
      h += '<table><tr><th>#</th><th>A: x</th><th>A: od líce</th><th>Ø / hl.</th><th>B: x</th><th>B: ' + (R.spoj.typ === 'hrana' ? 'od líce' : 'od čela') + '</th><th>Ø / hl.</th><th>odchylka os</th></tr>';
      R.diryA.forEach((q, i) => {
        const b = R.diryB.find((x) => x.i === q.i);
        h += `<tr><td>${i + 1}</td><td>${cz(q.p[0], 2)}</td><td>${cz(q.p[2], 2)}</td><td>${cz(q.d)} / ${cz(q.hl)}</td><td>${cz(b.p[0], 2)}</td><td>${cz(R.spoj.typ === 'hrana' ? b.p[2] : b.p[1], 2)}</td><td>${cz(b.d)} / ${b.pruchozi ? 'skrz' : cz(b.hl)}</td><td>${cz(kon[i].chyba, 3)} mm</td></tr>`;
      });
      h += '</table>';
      if (R.diryAplocha && R.diryAplocha.length) h += `<p class="info">Excentr: Ø ${cz(R.prvek.d)} v ploše A (rub) ${cz(R.prvek.odHrany)} mm od čela, hloubka ${cz(R.prvek.hloubka)}.</p>`;
    } else if (R.rezim === 'kapsa') {
      h += '<table><tr><th class="l">veličina</th><th>mm</th></tr>';
      const r = [['výstup osy na čele (od líce)', R.E[1]], ['vstup osy na rub (od čela)', -R.I[0]], ['ústí kapsy – zadní okraj', -R.usti.zadni], ['ústí kapsy – přední okraj', -R.usti.predni], ['vrut', R.Lv], ['vrut v dílu A (hlava → čelo)', R.sS], ['vrut v protikusu', R.p], ['rezerva hrotu', R.rezervaHrotu], ['délka vedení', R.Lg], ['kroužek od stupně', R.kroužekOdStupne], ['kroužek od špičky', R.kroužekOdHrotu]];
      for (const [a, b] of r) h += `<tr><td class="l">${esc(a)}</td><td>${cz(b, 2)}</td></tr>`;
      h += `</table><p class="info">Kapsy napříč dílem (od boku): ${R.ys.map((y) => cz(y)).join('; ')} mm.</p>`;
    } else h += `<p class="info">Měrky: ${R.kusy.map((q) => `Ø ${q.d}: čep ${cz(q.rCep * 2, 2)} × ${cz(q.delkaCepu)}, límec Ø ${cz(q.rLimec * 2)}`).join(' · ')}</p>`;
    if ((R.krouzky || []).length) {
      h += '<table style="margin-top:10px"><tr><th>kroužek</th><th>sedí na Ø</th><th>hloubka</th><th>vedení</th><th>vzdálenost</th><th class="l">měřeno od</th></tr>';
      for (const k of R.krouzky) h += `<tr><td>${k.id}</td><td>${cz(k.sedlo)}</td><td>${cz(k.hloubka)}</td><td>${cz(k.vedeni)}</td><td><b>${cz(k.vzdalenost)}</b></td><td class="l">${esc(k.ref)}</td></tr>`;
      h += '</table><p class="info">Vzdálenost = od řezné hrany ke spodní ploše kroužku. Nastavte ji měrkou (STL) – vrták na dno měrky, kroužek na horní plochu.</p>';
    }
    $('tabDiry').innerHTML = h;
    $('tabKusovnik').innerHTML = '<table><tr><th class="l">položka</th><th>množství</th><th class="l">poznámka</th></tr>' + (R.kusovnik || []).map((k) => `<tr><td class="l">${esc(k.polozka)}</td><td>${esc(k.mnozstvi)}</td><td class="l">${esc(k.pozn)}</td></tr>`).join('') + '</table>';
  }
  function vykresliPohledy() {
    pohledy = KPV.pohledy(R, S).concat(KPV.sablony(R, S).map((x) => Object.assign({}, x, { nazev: x.nazev + ' (1:1)' })));
    if (aktPohled >= pohledy.length) aktPohled = 0;
    $('zalPohledy').innerHTML = pohledy.map((p, i) => `<button role="tab" data-i="${i}" aria-selected="${i === aktPohled}">${esc(p.nazev)}</button>`).join('');
    $('pohled').innerHTML = KPV.svg(pohledy[aktPohled].sc, { sirkaPx: true });
  }
  function vyberPohled(i) { aktPohled = i; for (const b of $('zalPohledy').querySelectorAll('button')) b.setAttribute('aria-selected', String(+b.dataset.i === i)); $('pohled').innerHTML = KPV.svg(pohledy[i].sc, { sirkaPx: true }); uloz(); }
  $('zalPohledy').addEventListener('click', (e) => { const b = e.target.closest('button[data-i]'); if (b) vyberPohled(+b.dataset.i); });
  $('zalozky').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-z]'); if (!b) return;
    for (const x of $('zalozky').querySelectorAll('button')) x.setAttribute('aria-selected', String(x === b));
    for (const p of document.querySelectorAll('.panel[data-p]')) p.hidden = p.dataset.p !== b.dataset.z;
  });
  function infoStl() {
    if (R.rezim === 'centr') { $('infoStl').innerHTML = `Sada ${R.kusy.length} průměrů × ${R.kusu} ks; tisk čepem dolů (límec má zkosení 45°, bez podpor).`; return; }
    if (R.rezim === 'kapsa') { $('infoStl').innerHTML = `Přípravek ${cz(R.pripravek.delka)} × ${cz(R.pripravek.sirka)} × ${cz(R.pripravek.vyska)} mm, tisk na boku (profil na podložce). Otvor vedení ${cz(R.otvor.d, 2)} mm${R.otvor.pouzdro ? ' pro pouzdro' : ''}.`; return; }
    $('infoStl').innerHTML = R.pripravky.map((p) => `<b>${esc(p.id)}</b>: ${p.casti.length} díl${p.casti.length > 1 ? 'y' : ''}, otvory ${cz(p.otvor.d, 2)} mm${p.otvor.pouzdro ? ` pro pouzdro Ø ${cz(p.otvor.pouzdro.vnitrni)}/${cz(p.otvor.pouzdro.vnejsi)}` : ''}${p.tezProB ? ' – i pro protikus B' : ''}`).join('<br>') + '<br>Tisk deskou na podložce, otvory svislé, bez podpor.';
  }
  function infoListy() {
    const sb = KPV.sablony(R, S), [pw, ph] = KP.rozmerPapiru(S.tisk);
    $('infoListy').textContent = sb.length ? 'Šablony 1:1: ' + sb.map((x) => `${x.nazev} – ${KPV.rozvrh(x.sc, pw, ph, S.tisk).listy.length} list(y)`).join(', ') + '.' : '';
  }

  /* ---------- soubory ---------- */
  function stahni(data, jmeno, typ) {
    const b = data instanceof Blob ? data : new Blob([data], { type: typ || 'application/octet-stream' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = jmeno; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  const zaklad = () => ((S.nazev || $('nazevProjektu').value || 'kolikovaci_' + S.rezim).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'pripravek');
  let pismoSlib = null;
  function nactiPismo() {
    if (window.FONTY_JS && window.FONTY_JS['LiberationSans-Regular.ttf']) return Promise.resolve(window.FONTY_JS['LiberationSans-Regular.ttf']);
    if (pismoSlib) return pismoSlib;
    pismoSlib = new Promise((ok) => {
      const s = document.createElement('script'); s.src = 'stitky_panely/fonty/LiberationSans-Regular.ttf.js';
      s.onload = () => ok((window.FONTY_JS || {})['LiberationSans-Regular.ttf'] || null);
      s.onerror = () => { pismoSlib = null; ok(null); };
      document.head.appendChild(s);
    });
    return pismoSlib;
  }
  $('btnPdf').addEventListener('click', async () => {
    const b = $('btnPdf'), puv = b.textContent; b.disabled = true; b.textContent = 'Připravuji PDF…';
    try {
      const pismo = await nactiPismo();
      if (!pismo) toast('Písmo se nepodařilo načíst – PDF bude bez diakritiky.');
      const nazev = S.nazev || $('nazevProjektu').value || KP.REZIMY[S.rezim].nazev;
      const doc = KPV.pdf(window.jspdf.jsPDF, KPV.strany(R, S, { nazev }), { pismo, nazev });
      stahni(doc.output('blob'), zaklad() + '.pdf');
    } catch (e) { console.error(e); toast('Chyba PDF: ' + e.message, true); } finally { b.disabled = false; b.textContent = puv; }
  });
  $('btnSvg').addEventListener('click', () => { const p = pohledy[aktPohled]; stahni(KPV.svg(p.sc, {}), zaklad() + '_' + p.id + '.svg', 'image/svg+xml'); });
  $('btnDxf').addEventListener('click', () => { const p = pohledy[aktPohled]; stahni(KPV.dxf(p.sc), zaklad() + '_' + p.id + '.dxf', 'application/dxf'); });

  /* ---------- manifold a STL ---------- */
  let manifoldSlib = null;
  function nactiSkript(src) { return new Promise((ok, chyba) => { const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = () => chyba(new Error('nejde načíst ' + src)); document.head.appendChild(el); }); }
  function nactiManifold() {
    if (manifoldSlib) return manifoldSlib;
    manifoldSlib = (async () => {
      globalThis.MANIFOLD_URL = new URL('lib/manifold/manifold.klasicky.js', location.href).href;
      if (!globalThis.ManifoldModule) await nactiSkript('lib/manifold/manifold.klasicky.js');
      let volby;
      if (location.protocol === 'file:') {
        await nactiSkript('lib/manifold/manifold.wasm.js');
        const b = atob(globalThis.MANIFOLD_WASM_B64), bin = new Uint8Array(b.length);
        for (let i = 0; i < b.length; i++) bin[i] = b.charCodeAt(i);
        delete globalThis.MANIFOLD_WASM_B64; volby = { wasmBinary: bin };
      } else volby = { locateFile: (f) => new URL('lib/manifold/' + f, location.href).href };
      const w = await globalThis.ManifoldModule(volby); w.setup(); return w;
    })();
    manifoldSlib.catch(() => { manifoldSlib = null; });
    return manifoldSlib;
  }
  window.KPnactiManifold = nactiManifold;
  let posledniTelesa = [];
  async function telesa(ktery) { const w = await nactiManifold(); return KPSTL.telesa(w, R, S, ktery); }
  function seznamStl(T) {
    posledniTelesa = T;
    $('seznamStl').innerHTML = T.map((t, i) => `<div class="radek"><span>${esc(t.nazev)} · ${cz(t.sitTisk.bb.max[0] - t.sitTisk.bb.min[0], 0)} × ${cz(t.sitTisk.bb.max[1] - t.sitTisk.bb.min[1], 0)} × ${cz(t.sitTisk.bb.max[2] - t.sitTisk.bb.min[2], 0)} mm · ${cz(t.sitTisk.objem / 1000, 1)} cm³</span><button class="btn btn-sec btn-mini" type="button" data-stl="${i}">STL</button></div>`).join('');
  }
  $('seznamStl').addEventListener('click', (e) => { const b = e.target.closest('button[data-stl]'); if (!b) return; const t = posledniTelesa[+b.dataset.stl]; stahni(KPSTL.stlBinarni(t.sitTisk.poz, t.sitTisk.idx, t.nazev), zaklad() + '_' + t.id + '.stl', 'model/stl'); });
  async function sPrubehem(id, text, fn) {
    const b = $(id), puv = b.textContent; b.disabled = true; b.textContent = text;
    try { await new Promise((r) => setTimeout(r, 20)); return await fn(); } catch (e) { console.error(e); toast('Chyba STL: ' + e.message, true); return null; } finally { b.disabled = false; b.textContent = puv; }
  }
  $('btnStl').addEventListener('click', () => sPrubehem('btnStl', 'Počítám…', async () => {
    const T = await telesa(R.rezim === 'centr' ? 'centr' : 'pripravky'); seznamStl(T);
    if (T.length === 1) stahni(KPSTL.stlBinarni(T[0].sitTisk.poz, T[0].sitTisk.idx, T[0].nazev), zaklad() + '_' + T[0].id + '.stl', 'model/stl');
    else { const s = KPSTL.slouc(T.map((t) => t.sitTisk), 10); stahni(KPSTL.stlBinarni(s.poz, s.idx, 'pripravky'), zaklad() + '_pripravky.stl', 'model/stl'); }
  }));
  $('btnStlKrouzky').addEventListener('click', () => sPrubehem('btnStlKrouzky', 'Počítám…', async () => {
    const T = (await telesa('vse')).filter((t) => t.druh === 'krouzek' || t.druh === 'merka');
    if (!T.length) { toast('Tento režim kroužky nepotřebuje.'); return; }
    seznamStl(T); const s = KPSTL.slouc(T.map((t) => t.sitTisk), 6); stahni(KPSTL.stlBinarni(s.poz, s.idx, 'krouzky a merky'), zaklad() + '_krouzky_merky.stl', 'model/stl');
  }));
  $('btnStlVse').addEventListener('click', () => sPrubehem('btnStlVse', 'Počítám…', async () => {
    const T = await telesa('vse'); seznamStl(T);
    const s = KPSTL.slouc(T.map((t) => t.sitTisk), 10); stahni(KPSTL.stlBinarni(s.poz, s.idx, 'vse'), zaklad() + '_vse.stl', 'model/stl');
  }));

  /* ---------- 3D ---------- */
  let v3d = null, sit3dT = 0, viditelne3d = false;
  const FAZE = { spoj: [[0.1, 'přiložit přípravek A'], [0.4, 'vrtat díl A'], [0.47, 'sejmout přípravek'], [0.55, 'přiložit přípravek B'], [0.76, 'vrtat díl B'], [0.81, 'sejmout přípravek'], [0.88, 'vložit kolíky'], [0.98, 'spojit'], [1.01, 'spojeno']],
    kapsa: [[0.11, 'přiložit a upnout přípravek'], [0.55, 'vrtat kapsy'], [0.62, 'sejmout přípravek'], [0.77, 'přisadit protikus'], [0.97, 'zašroubovat vruty'], [1.01, 'spojeno']],
    centr: [[0.32, 'vložit měrky do děr'], [0.62, 'přitlačit protikus'], [0.96, 'sejmout – středy označené'], [1.01, 'hotovo']] };
  function popisFaze(t) { const f = FAZE[R && R.rezim === 'kapsa' ? 'kapsa' : R && R.rezim === 'centr' ? 'centr' : 'spoj']; return (f.find((x) => t < x[0]) || f[f.length - 1])[1]; }
  function aktualizuj3d() {
    if (!viditelne3d || !window.THREE || !window.KP3D) return;
    if (!v3d) { try { v3d = KP3D.vytvor($('obal3d')); } catch (e) { $('stav3d').textContent = '3D není dostupné (WebGL).'; return; } }
    v3d.aktualizuj(R, S, null);
    $('b3dCas').value = Math.round(v3d.t * 1000); $('b3dFaze').textContent = popisFaze(v3d.t);
    $('stav3d').textContent = 'načítám přípravky…';
    clearTimeout(sit3dT);
    const Rr = R;
    sit3dT = setTimeout(async () => {
      try { const T = await telesa(Rr.rezim === 'centr' ? 'centr' : 'pripravky'); if (Rr === R) { v3d.aktualizuj(R, S, T); $('stav3d').textContent = ''; } } catch (e) { $('stav3d').textContent = 'přípravky jen zjednodušeně (manifold se nenačetl)'; }
    }, 500);
  }
  const io = new IntersectionObserver((z) => { const v = z.some((x) => x.isIntersecting); if (v && !viditelne3d) { viditelne3d = true; aktualizuj3d(); } });
  io.observe($('obal3d'));
  $('b3dCas').addEventListener('input', () => { if (!v3d) return; v3d.zastav(); const t = +$('b3dCas').value / 1000; v3d.cas(t); $('b3dFaze').textContent = popisFaze(t); $('b3dHraj').textContent = '▶ Přehrát'; });
  $('b3dHraj').addEventListener('click', () => {
    if (!v3d) return;
    if (v3d.hraje) { v3d.zastav(); $('b3dHraj').textContent = '▶ Přehrát'; return; }
    $('b3dHraj').textContent = '⏸ Zastavit';
    v3d.prehraj((t, hraje) => { $('b3dCas').value = Math.round(t * 1000); $('b3dFaze').textContent = popisFaze(t); if (!hraje) $('b3dHraj').textContent = '▶ Přehrát'; });
  });
  $('b3dVychozi').addEventListener('click', () => v3d && v3d.pohled(-35, 30));
  $('b3dShora').addEventListener('click', () => v3d && v3d.pohled(0, 88));
  $('b3dBok').addEventListener('click', () => v3d && v3d.pohled(90, 5));

  /* ---------- projekty ---------- */
  function vykresliProjekty() { const o = projekty(), k = Object.keys(o).sort(); $('seznamProjektu').innerHTML = k.length ? k.map((x) => `<option>${esc(x)}</option>`).join('') : '<option value="">(žádné)</option>'; }
  $('nazevProjektu').value = S.nazev || '';
  $('nazevProjektu').addEventListener('input', () => { S.nazev = $('nazevProjektu').value; uloz(); });
  $('btnUlozit').addEventListener('click', async () => {
    const n = ($('nazevProjektu').value || '').trim(); if (!n) { toast('Zadejte název projektu.', true); return; }
    const o = projekty();
    if (o[n] && window.Dialog && !(await Dialog.potvrd(`Projekt „${n}“ už existuje. Přepsat?`))) return;
    o[n] = JSON.parse(JSON.stringify(S)); if (ulozProjekty(o)) { vykresliProjekty(); $('seznamProjektu').value = n; toast('Uloženo.'); }
  });
  $('btnNacist').addEventListener('click', () => { const n = $('seznamProjektu').value, o = projekty(); if (!o[n]) return; S = slouc(KP.vychoziProjekt(), o[n]); $('nazevProjektu').value = S.nazev || n; vykresliRezimy(); vykresliFormulare(); prepocti(); });
  $('btnSmazat').addEventListener('click', async () => { const n = $('seznamProjektu').value, o = projekty(); if (!o[n]) return; if (window.Dialog && !(await Dialog.potvrd(`Smazat projekt „${n}“?`))) return; delete o[n]; ulozProjekty(o); vykresliProjekty(); });
  $('btnExport').addEventListener('click', () => stahni(JSON.stringify({ format: 'kolikovaci_pripravky', verze: 1, projekt: S }, null, 1), zaklad() + '.json', 'application/json'));
  $('btnImport').addEventListener('click', () => $('souborProjekt').click());
  $('souborProjekt').addEventListener('change', async () => {
    const f = $('souborProjekt').files[0]; if (!f) return;
    try { const d = JSON.parse(await f.text()); S = slouc(KP.vychoziProjekt(), d.projekt || d); $('nazevProjektu').value = S.nazev || ''; vykresliRezimy(); vykresliFormulare(); prepocti(); toast('Projekt načten.'); } catch (e) { toast('Soubor není platný projekt: ' + e.message, true); }
    $('souborProjekt').value = '';
  });
  $('btnReset').addEventListener('click', async () => { if (window.Dialog && !(await Dialog.potvrd('Vrátit všechna nastavení na výchozí?'))) return; S = KP.vychoziProjekt(S.rezim); $('nazevProjektu').value = ''; vykresliRezimy(); vykresliFormulare(); prepocti(); });
  $('btnPravidlaReset').addEventListener('click', () => { S.pravidla = KP.kopie(KP.PRAVIDLA); vykresliFormulare(); prepocti(); });

  /* ---------- start ---------- */
  vykresliRezimy(); vykresliFormulare(); vykresliProjekty(); prepoctiHned();
  window.KPUI = { get S() { return S; }, get R() { return R; }, nastavRezim, prepoctiHned, telesa, vyberPohled, get v3d() { return v3d; } };
})();
