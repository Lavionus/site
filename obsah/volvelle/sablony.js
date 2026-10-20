/* ============================================================
   Volvelle – šablony kotoučů (bez DOM)
   Každá šablona: {id, nazev, ikona, popis, pole (formulář), vstupy (nastavení náhledu), vychozi, sestav(p, st)}
   sestav vrací model {vrstvy, popis(uhly, vstup) → {hlavni, radky}, nastav(vstup) → uhly, navod, data, stranky}
   Vrstvy jdou odspodu nahoru, uhly[i] = otočení vrstvy i (° po směru ručiček).
   ============================================================ */
(function (koren) {
  'use strict';
  const req = (n) => (typeof require !== 'undefined' ? require(n) : null);
  const V = koren.VOLV || req('./jadro.js');
  const ST = koren.VOLV_STYLY || req('./styly.js');
  const K = koren.VOLV_KRESBA || req('./kresba.js');
  const HV = () => koren.VOLV_HVEZDY || req('./hvezdy.js');
  const { P, mod, RAD, cislo } = V;
  const { cara, kruh, bod, txt, vysecF, paprsek, textTecne, textRadial, blokVeVyseci, odstavec, stupnice, ozdoba, sireOzdoby, sipka } = K;
  const datumCz = (y, m, d) => `${d}. ${m}. ${y}`;
  const dvoj = (n) => String(n).padStart(2, '0');
  /** rozparsuje 'YYYY-MM-DD' */
  const parsujDatum = (s) => { const m = /^(-?\d{1,4})-(\d{1,2})-(\d{1,2})$/.exec(String(s || '')); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; };
  const parsujCas = (s) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(s || '')); return m ? +m[1] + m[2] / 60 : null; };
  const dnes = () => { const d = new Date(); return `${d.getFullYear()}-${dvoj(d.getMonth() + 1)}-${dvoj(d.getDate())}`; };
  const vrstva = (o) => Object.assign({ okna: [], otoc: false, krok: 0, prvky: [], dira: 3 }, o);

  /* =====================================================================
     1. VĚČNÝ KALENDÁŘ
     ===================================================================== */
  const kalendar = {
    id: 'kalendar', nazev: 'Věčný kalendář', ikona: '📅', popis: 'den v týdnu pro libovolné datum',
    vychozi: { kal: 'g', od: 1950, do: 2059, R: 95, citelne: true },
    pole: [
      { id: 'kal', typ: 'vyber', label: 'Kalendář', moznosti: [['g', 'gregoriánský (od 1582)'], ['j', 'juliánský (starý styl)']] },
      { id: 'od', typ: 'cislo', label: 'Roky od', min: -500, max: 3000, krok: 1 },
      { id: 'do', typ: 'cislo', label: 'Roky do', min: -500, max: 3000, krok: 1 },
      { id: 'R', typ: 'cislo', label: 'Průměr spodního kotouče (mm)', min: 120, max: 400, krok: 1, nasob: 2 },
    ],
    vstupy: [{ id: 'datum', typ: 'date', label: 'Nastavit na datum' }],
    sestav(p, st) {
      const s = 360 / 7, R = p.R, kal = p.kal === 'j' ? 'j' : 'g';
      const od = Math.min(p.od, p.do), dd = Math.max(p.od, p.do), doo = Math.min(dd, od + 400);
      const ro = R - sireOzdoby(st) - 0.8, R1 = R * 0.726, rRoky1 = R1 + 1.6;
      const rDen2 = R1 * 0.72, rDen1 = R1 * 0.585, rCis2 = rDen1 - 1.5, rCis1 = R1 * 0.27;
      // ---- spodní kotouč: roky podle kódu + dny v týdnu (pod okénky)
      const sektoryRoku = [[], [], [], [], [], [], []];
      for (let y = od; y <= doo; y++) sektoryRoku[V.kodRoku(y, kal)].push(y);
      const z = [];
      for (let k = 0; k < 7; k++) {
        const a = k * s;
        z.push(vysecF(rRoky1, ro, a - s / 2, a + s / 2, 'v' + (k % 2 ? 1 : 0)));
        z.push(paprsek(rRoky1, ro, a - s / 2, 'cara', 0.3));
        const pol = sektoryRoku[k].map((y) => ({ t: V.prestupny(y, kal) ? y + '*' : String(y), c: V.prestupny(y, kal) ? 'akcent' : 'text' }));
        z.push(...blokVeVyseci(st, pol, rRoky1 + 1, ro - 1, a, s - 3, { hMax: 4.2, citelne: p.citelne, mezera: 0.8 }).prvky);
      }
      z.push(kruh(rRoky1, 'cara', 0.35), ...ozdoba(st, R));
      for (let i = 0; i < 7; i++) {
        const a = i * s, w = mod(i - 1, 7);
        z.push(vysecF(rDen1, rDen2, a - s / 2, a + s / 2, 'v' + (2 + (i % 2))));
        z.push(textTecne((rDen1 + rDen2) / 2, a, Math.min(4, (rDen2 - rDen1) * 0.45), V.JMENA_DNU[w], w === 0 ? 'akcent' : 'text', { n: true, citelne: p.citelne }));
      }
      const spodni = vrstva({ id: 'zaklad', nazev: 'Spodní kotouč – roky a dny v týdnu', tvar: { typ: 'kruh', r: R }, prvky: z });
      // ---- horní kotouč: měsíce podle kódu, 7 okének, čísla dnů
      const h = [], sektoryMes = [[], [], [], [], [], [], []];
      for (let m = 1; m <= 12; m++) sektoryMes[V.kodMesice(m, false)].push({ m, prest: false });
      for (const m of [1, 2]) sektoryMes[V.kodMesice(m, true)].push({ m, prest: true });
      const rm1 = rDen2 + 2.2, rm2 = R1 - sireOzdoby(st) - 0.5;
      for (let M = 0; M < 7; M++) {
        const a = -M * s;
        h.push(vysecF(rm1, rm2, a - s / 2, a + s / 2, 'v' + (M % 2 ? 5 : 4)));
        h.push(paprsek(rm1, rm2, a - s / 2, 'cara', 0.3));
        const pol = sektoryMes[M].map((q) => ({ t: V.ZKR_MES[q.m - 1] + (q.prest ? '*' : ''), c: q.prest ? 'akcent' : 'text' }));
        h.push(...blokVeVyseci(st, pol, rm1 + 0.6, rm2 - 3.2, a, s - 6, { hMax: 4.4, citelne: p.citelne, n: true }).prvky);
        h.push(sipka(rm2 - 3, rm2 + 0.2, a, 4.5, 'akcent'));
      }
      h.push(kruh(rm1, 'cara', 0.3), ...ozdoba(st, R1));
      const okna = [];
      for (let j = 0; j < 7; j++) {
        const a = j * s, w = (s - 9) / 2;
        okna.push({ b: V.vysec(rDen1 + 0.6, rDen2 - 0.6, a - w, a + w, 1) });
        h.push({ t: 'l', b: V.vysec(rDen1 + 0.6, rDen2 - 0.6, a - w, a + w, 1), z: true, c: 'cara', s: 0.3 });
        const dny = []; for (let d = j === 0 ? 7 : j; d <= 31; d += 7) dny.push(String(d));
        h.push(...blokVeVyseci(st, dny, rCis1, rCis2, a, s - 5, { hMax: 4.2, citelne: p.citelne, n: true }).prvky);
        h.push(paprsek(rCis1 + 1, rDen2, a - s / 2, 'jemna', 0.15));
      }
      h.push(...odstavec(st, ['Věčný', 'kalendář'], -rCis1 * 0.32, Math.min(4.2, rCis1 * 0.26), rCis1 * 1.6, 'text', { n: true }));
      h.push(txt(0, rCis1 * 0.42, Math.min(2.4, rCis1 * 0.13), (kal === 'j' ? 'juliánský ' : 'gregoriánský ') + od + '–' + doo));
      h.push(txt(0, rCis1 * 0.62, Math.min(2.1, rCis1 * 0.12), '* přestupný rok', 0, 'akcent'));
      const horni = vrstva({ id: 'horni', nazev: 'Horní kotouč – měsíce a okénka', tvar: { typ: 'kruh', r: R1 }, okna, otoc: true, krok: s, prvky: h });
      const kodPro = (dt) => mod(V.kodRoku(dt.y, kal) + V.kodMesice(dt.m, V.prestupny(dt.y, kal)), 7);
      return {
        vrstvy: [spodni, horni],
        data: { sektoryRoku, sektoryMes, kal, krok: s },
        nastav(vstup) { const dt = parsujDatum(vstup.datum); return dt ? [0, kodPro(dt) * s] : null; },
        popis(uhly, vstup) {
          const r = mod(Math.round(uhly[1] / s), 7), radky = [];
          const jm = (j) => V.JMENA_DNU[mod(j + r - 1, 7)];
          for (let j = 1; j <= 7; j++) { const dny = []; for (let d = j; d <= 31; d += 7) dny.push(d); radky.push(dny.join(', ') + '. → ' + jm(j % 7)); }
          const dt = parsujDatum(vstup && vstup.datum);
          let hlavni = 'Šipka měsíce ukazuje na sektor roků č. ' + (mod(r, 7) + 1);
          if (dt && dt.m >= 1 && dt.m <= 12 && dt.d >= 1 && dt.d <= V.pocetDni(dt.y, dt.m, kal)) {
            const pr = V.prestupny(dt.y, kal), mzk = V.ZKR_MES[dt.m - 1] + (pr && dt.m <= 2 ? '*' : '');
            const mimo = dt.y < od || dt.y > doo ? ` (rok ${dt.y} na kotouči není – rozsah ${od}–${doo})` : '';
            if (kodPro(dt) === r) hlavni = `${datumCz(dt.y, dt.m, dt.d)} je ${V.JMENA_DNU[V.denTydne(dt.y, dt.m, dt.d, kal)]}` + (kal === 'j' ? ' (juliánsky)' : '') + mimo;
            else hlavni = `Pro ${datumCz(dt.y, dt.m, dt.d)} natočte šipku „${mzk}“ na rok ${dt.y}${mimo}`;
          }
          return { hlavni, radky };
        },
        navod: [
          'Natočte horní kotouč tak, aby šipka sektoru s vaším měsícem ukazovala na sektor s rokem.',
          'V přestupném roce (hvězdička) použijte pro leden a únor „led*“ a „úno*“.',
          'V okénku u řádku s číslem dne přečtete den v týdnu.',
          'Princip: den v týdnu = (kód roku + kód měsíce + den − 1) mod 7. Kód roku je den v týdnu 1. ledna (+1 v přestupném roce), kód měsíce počet dní před měsícem mod 7.',
        ],
      };
    },
  };

  /* =====================================================================
     2. FÁZE MĚSÍCE
     ===================================================================== */
  const mesic = {
    id: 'mesic', nazev: 'Fáze Měsíce', ikona: '🌔', popis: 'kotouč lunace 29,53 dne a měsíční kalendář',
    vychozi: { rok: new Date().getFullYear(), zona: 1, jih: false, R: 90, obrazku: 30 },
    pole: [
      { id: 'rok', typ: 'cislo', label: 'Rok tabulky novoluní', min: 1600, max: 2400, krok: 1 },
      { id: 'zona', typ: 'cislo', label: 'Časové pásmo (h od UTC)', min: -12, max: 14, krok: 0.5 },
      { id: 'obrazku', typ: 'cislo', label: 'Počet obrázků fází', min: 8, max: 40, krok: 1 },
      { id: 'jih', typ: 'zaskrt', label: 'Jižní polokoule (osvětlená strana zrcadlově)' },
      { id: 'R', typ: 'cislo', label: 'Průměr kotouče (mm)', min: 110, max: 400, krok: 1, nasob: 2 },
    ],
    vstupy: [{ id: 'datum', typ: 'date', label: 'Datum' }, { id: 'cas', typ: 'time', label: 'Čas' }],
    sestav(p, st) {
      const S = V.SYNODICKY, R = p.R, Rc = R - Math.max(10, R * 0.12), N = Math.max(8, Math.min(40, Math.round(p.obrazku)));
      const uA = (A) => A / S * 360;
      // ---- kotouč fází (spodní, otočný)
      const z = [];
      z.push(kruh(Rc + 0.4, 'cara', 0.3));
      for (let i = 0; i < S * 4; i++) {
        const A = i / 4, a = uA(A), cel = i % 4 === 0, pul = i % 2 === 0;
        z.push(paprsek(Rc + 0.4, Rc + 0.4 + (cel ? 3.2 : pul ? 2 : 1.2), a, 'cara', cel ? 0.3 : 0.18));
        if (cel) z.push(textTecne(Rc + 6.2, a, Math.min(3.2, (R - Rc) * 0.3), String(A), A === 0 ? 'akcent' : 'text', { n: true }));
      }
      z.push(...ozdoba(st, R));
      const rp = Rc * 0.78, rObr = Math.min(Rc * 0.13, Math.PI * rp / N * 0.82);
      for (let i = 0; i < N; i++) {
        const A = i * S / N, a = uA(A), q = P(rp, a);
        z.push(...K.obrazekMesice(q[0], q[1], rObr, A, S, p.jih, a));
      }
      // jména fází paprsčitě po dnech, čtou se vodorovně v okénku vpravo (úhel +90° proti šipce)
      const rf1 = Rc * 0.3, rf2 = rp - rObr - 1.8, nDni = Math.ceil(S);
      z.push(vysecF(rf1, rf2, 0, 360, 'v1'), kruh(rf1, 'cara', 0.25), kruh(rf2, 'cara', 0.25));
      let hF = Math.min(3.2, uA(1) * RAD * rf1 * 0.55);
      for (const jm of V.FAZE_JMENA) hF = Math.min(hF, (rf2 - rf1 - 2) / Math.max(1, ST.sirkaTextu(st, jm, 1, true)));
      for (let i = 0; i < nDni; i++) {
        const jm = V.jmenoFaze(i, S), hl = /novoluní|úplněk|čtvrť/.test(jm);
        const q = P((rf1 + rf2) / 2, uA(i) + 90); z.push(txt(q[0], q[1], hF, jm, uA(i), hl ? 'akcent' : 'text', { n: true }));
      }
      const disk = vrstva({ id: 'faze', nazev: 'Kotouč fází (otočný)', tvar: { typ: 'kruh', r: R }, otoc: true, krok: uA(0.25), prvky: z });
      // ---- kryt (horní, pevný)
      const c = [], okna = [{ kruh: [0, -rp, rObr + 1.3] }];
      const wF = Math.max(3, (hF / 2 + 0.9) / rf1 / RAD), oknoFaze = V.vysec(rf1 + 0.6, rf2 - 0.6, 90 - wF, 90 + wF, 1);
      okna.push({ b: oknoFaze });
      c.push({ t: 'k', x: 0, y: -rp, r: rObr + 1.3, c: 'cara', s: 0.35 }, { t: 'l', b: oknoFaze, z: true, c: 'cara', s: 0.35 });
      c.push(...ozdoba(st, Rc), sipka(Rc - 4.5, Rc + 0.1, 0, 5, 'akcent'));
      // tabulka novoluní a úplňků zvoleného roku (místní čas pásma)
      const faze = V.fazeRoku(p.rok), dnyF = (jd) => { const d = V.dataZJd(jd + p.zona / 24); return `${d.getUTCDate()}. ${d.getUTCMonth() + 1}.`; };
      const nov = faze.filter((f) => f.typ === 0).map((f) => dnyF(f.jd)), upl = faze.filter((f) => f.typ === 2).map((f) => dnyF(f.jd));
      const hT = Math.min(3, Rc * 0.04), yT = -Rc * 0.42, y0 = yT + hT * 4.6, xN = -Rc * 0.42, xU = -Rc * 0.15;
      c.push(txt(0, yT, hT * 1.7, 'Fáze Měsíce', 0, 'text', { n: true }));
      c.push(txt(0, yT + hT * 2, hT * 0.95, `lunace ${cislo(S, 2)} dne · rok ${p.rok}`, 0, 'jemna'));
      c.push(txt(xN, y0, hT, 'novoluní', 0, 'akcent', { n: true }), txt(xU, y0, hT, 'úplněk', 0, 'akcent', { n: true }));
      const radku = Math.max(nov.length, upl.length);
      for (let i = 0; i < radku; i++) {
        const y = y0 + (i + 1) * hT * 1.3;
        if (nov[i]) c.push(txt(xN, y, hT, nov[i], 0, 'text'));
        if (upl[i]) c.push(txt(xU, y, hT, upl[i], 0, 'text'));
      }
      const yN = y0 + (radku + 1.6) * hT * 1.3;
      c.push(...odstavec(st, ['Stáří = dny od posledního novoluní.', 'Každý den otočte o jeden dílek.'], Math.max(yN, Rc * 0.5), hT * 0.85, Rc * 1.1, 'jemna'));
      const kryt = vrstva({ id: 'kryt', nazev: 'Kryt s okénky (pevný)', tvar: { typ: 'kruh', r: Rc }, okna, prvky: c });
      // ---- měsíční kalendář na zvláštní list
      const stranky = [mesicniKalendar(st, p)];
      const vstupJd = (vstup) => {
        const dt = parsujDatum(vstup && vstup.datum); if (!dt) return null;
        const t = parsujCas(vstup.cas); const h = t == null ? 12 : t;
        return V.jdn(dt.y, dt.m, dt.d, 'g') - 0.5 + (h - p.zona) / 24;
      };
      return {
        vrstvy: [disk, kryt], stranky, data: { faze, Rc, rp },
        nastav(vstup) { const jd = vstupJd(vstup); if (jd == null) return null; return [-uA(V.stariMesice(jd).stari), 0]; },
        popis(uhly, vstup) {
          const A = mod(-uhly[0] / 360 * S, S), radky = [];
          let hlavni = `Stáří ${cislo(A, 1)} d – ${V.jmenoFaze(A)}, osvětleno ${Math.round(V.osvetleni(A) * 100)} %`;
          const jd = vstupJd(vstup);
          if (jd != null) {
            const sm = V.stariMesice(jd), dt = parsujDatum(vstup.datum);
            radky.push(`Skutečně (výpočet podle Meeuse): ${datumCz(dt.y, dt.m, dt.d)} stáří ${cislo(sm.stari, 1)} d, ${V.jmenoFaze(sm.stari, sm.delka)}, osvětleno ${Math.round(V.osvetleni(sm.stari, sm.delka) * 100)} %`);
            const dalsi = V.fazeRoku(dt.y).concat(V.fazeRoku(dt.y + 1)).filter((f) => f.jd > jd).slice(0, 4);
            const jmF = ['novoluní', 'první čtvrť', 'úplněk', 'poslední čtvrť'];
            radky.push('Další fáze: ' + dalsi.map((f) => { const d = V.dataZJd(f.jd + p.zona / 24); return `${jmF[f.typ]} ${d.getUTCDate()}. ${d.getUTCMonth() + 1}. ${dvoj(d.getUTCHours())}:${dvoj(d.getUTCMinutes())}`; }).join(' · '));
            if (Math.abs(mod(sm.stari - A + S / 2, S) - S / 2) > 0.3) hlavni += ` (pro zvolené datum otočte na ${cislo(sm.stari, 1)} d)`;
          }
          return { hlavni, radky };
        },
        navod: [
          'Kotouč fází je vespod, kryt s okénky nahoře; sešijte je uprostřed.',
          'V tabulce na krytu najděte poslední novoluní, spočítejte dny do dneška a kotoučem otočte, až šipka ukáže tento počet dní.',
          'Pak stačí každý den pootočit o jeden dílek; po roce se střední lunace od skutečných fází liší nejvýš o necelý den.',
          'Okénka ukazují obrázek fáze a její název.',
        ],
      };
    },
  };
  /** list „Měsíční kalendář“ – mřížka 12 měsíců × 31 dní s fázemi (1:1, A4 na šířku 277 × 190 mm) */
  function mesicniKalendar(st, p) {
    const W = 277, H = 186, prvky = [], x0 = 18, y0 = 22, sw = (W - x0 - 2) / 31, sh = (H - y0 - 14) / 12;
    prvky.push(txt(W / 2, 7, 6, `Měsíční kalendář ${p.rok}`, 0, 'text', { n: true }));
    prvky.push(txt(W / 2, 13.5, 2.8, `Fáze Měsíce v čase UTC${p.zona >= 0 ? '+' : ''}${cislo(p.zona)}; tmavý kotouč = novoluní, světlý = úplněk, číslo = stáří ve dnech (v poledne)`, 0, 'jemna'));
    for (let d = 1; d <= 31; d++) prvky.push(txt(x0 + (d - 0.5) * sw, y0 - 2.5, 2.6, String(d), 0, 'text', { n: true }));
    const faze = V.fazeRoku(p.rok), hlavni = {};
    for (const f of faze) { const d = V.dataZJd(f.jd + p.zona / 24); hlavni[`${d.getUTCMonth() + 1}-${d.getUTCDate()}`] = f.typ; }
    for (let m = 1; m <= 12; m++) {
      const y = y0 + (m - 1) * sh;
      prvky.push(txt(x0 - 1.5, y + sh / 2, 2.8, V.ZKR_MES[m - 1], 0, 'text', { n: true, a: 'r' }));
      prvky.push(cara([[x0, y], [x0 + 31 * sw, y]], 'jemna', 0.12));
      for (let d = 1; d <= V.pocetDni(p.rok, m, 'g'); d++) {
        const jd = V.jdn(p.rok, m, d, 'g') + (0 - p.zona / 24), A = V.stariMesice(jd).stari, cx = x0 + (d - 0.5) * sw, cy = y + sh * 0.42;
        const t = hlavni[`${m}-${d}`];
        prvky.push(...K.obrazekMesice(cx, cy, Math.min(sw, sh) * 0.3, A, V.SYNODICKY, p.jih));
        if (t != null) prvky.push({ t: 'k', x: cx, y: cy, r: Math.min(sw, sh) * 0.38, c: 'akcent', s: 0.3 });
        prvky.push(txt(cx, y + sh * 0.86, 1.8, cislo(A, 0), 0, 'jemna'));
      }
    }
    prvky.push(cara([[x0, y0 + 12 * sh], [x0 + 31 * sw, y0 + 12 * sh]], 'jemna', 0.12));
    return { nadpis: `Měsíční kalendář ${p.rok}`, w: W, h: H, prvky, naSirku: true };
  }

  /* =====================================================================
     3. ŠIFROVACÍ KOTOUČ
     ===================================================================== */
  const sifra = {
    id: 'sifra', nazev: 'Šifrovací kotouč', ikona: '🔐', popis: 'Caesar a Alberti, česká i anglická abeceda',
    vychozi: { abeceda: 'cz27', rezim: 'caesar', heslo: 'VOLVELLE', perioda: 0, R: 90, cisla: true },
    pole: [
      { id: 'abeceda', typ: 'vyber', label: 'Abeceda', moznosti: Object.keys(V.ABECEDY).map((k) => [k, V.ABECEDY[k].nazev]) },
      { id: 'rezim', typ: 'vyber', label: 'Vnitřní kotouč', moznosti: [['caesar', 'Caesar – stejné pořadí'], ['heslo', 'míchaná abeceda podle hesla (Alberti)']] },
      { id: 'heslo', typ: 'text', label: 'Heslo pro míchání', kdyz: (p) => p.rezim === 'heslo' },
      { id: 'perioda', typ: 'cislo', label: 'Alberti: pootočit o 1 po každých N písmenech (0 = nikdy)', min: 0, max: 50, krok: 1 },
      { id: 'cisla', typ: 'zaskrt', label: 'Čísla posunu na vnitřním kotouči' },
      { id: 'R', typ: 'cislo', label: 'Průměr vnějšího kotouče (mm)', min: 100, max: 400, krok: 1, nasob: 2 },
    ],
    vstupy: [{ id: 'posun', typ: 'number', label: 'Posun', min: 0, max: 41 }, { id: 'text', typ: 'textarea', label: 'Text', vychozi: 'Sejdeme se u staré lípy v pět hodin.' }, { id: 'smer', typ: 'select', label: 'Směr', moznosti: [['s', 'šifrovat'], ['d', 'dešifrovat']] }],
    sestav(p, st) {
      const ab = V.ABECEDY[p.abeceda] || V.ABECEDY.en26, N = ab.znaky.length, s = 360 / N, R = p.R;
      const vn = V.vnitrniAbeceda(p.abeceda, p.rezim === 'heslo' ? p.heslo : '');
      const ro = R - sireOzdoby(st) - 0.6, R1 = R * 0.78, rv = R1 + 1.4;
      const z = [];
      for (let i = 0; i < N; i++) {
        const a = i * s;
        z.push(vysecF(rv, ro, a - s / 2, a + s / 2, 'v' + (i % 2)));
        z.push(paprsek(rv, ro, a - s / 2, 'cara', 0.25));
        z.push(textTecne((rv + ro) / 2, a, Math.min((ro - rv) * 0.55, rv * s * RAD * 0.85), ab.znaky[i], 'text', { n: true }));
      }
      z.push(kruh(rv, 'cara', 0.35), ...ozdoba(st, R));
      const vnej = vrstva({ id: 'vnejsi', nazev: 'Vnější kotouč – otevřený text', tvar: { typ: 'kruh', r: R }, prvky: z });
      const h = [], r2 = R1 - sireOzdoby(st) - 0.4, r1 = R1 * 0.74;
      for (let j = 0; j < N; j++) {
        const a = j * s;
        h.push(vysecF(r1, r2, a - s / 2, a + s / 2, 'v' + (2 + (j % 2))));
        h.push(paprsek(r1, r2, a - s / 2, 'cara', 0.2));
        h.push(textTecne((r1 + r2) / 2, a, Math.min((r2 - r1) * 0.55, r1 * s * RAD * 0.9), vn[j], j === 0 ? 'akcent' : 'akcent2', { n: true }));
        if (p.cisla) h.push(textTecne(r1 - 2.6, a, Math.min(2.3, r1 * s * RAD * 0.42), String(j), 'jemna'));
      }
      h.push(kruh(r1, 'cara', 0.3), ...ozdoba(st, R1));
      h.push(sipka(r1 - (p.cisla ? 5.5 : 1), r1 - (p.cisla ? 9 : 5), 0, 3.5, 'akcent'));
      const rt = r1 * 0.62;
      h.push(...odstavec(st, ['Šifrovací', 'kotouč'], -rt * 0.42, Math.min(5, rt * 0.24), rt * 1.6, 'text', { n: true }));
      h.push(txt(0, rt * 0.3, Math.min(2.6, rt * 0.12), p.rezim === 'heslo' ? 'abeceda míchaná heslem' : 'Caesarova šifra', 0, 'jemna'));
      h.push(txt(0, rt * 0.52, Math.min(2.4, rt * 0.11), 'L. B. Alberti · De cifris · 1467', 0, 'jemna'));
      const vnit = vrstva({ id: 'vnitrni', nazev: 'Vnitřní kotouč – šifra (otočný)', tvar: { typ: 'kruh', r: R1 }, otoc: true, krok: s, prvky: h });
      const posunZ = (uhly) => mod(Math.round(-uhly[1] / s), N);
      return {
        vrstvy: [vnej, vnit], data: { vnitrni: vn, N },
        sifra: (text, posun, desifr) => (desifr ? V.desifruj : V.sifruj)(text, { abeceda: p.abeceda, vnitrni: vn, posun, perioda: p.perioda }),
        nastav(vstup) { const k = parseInt(vstup && vstup.posun, 10); return isFinite(k) ? [0, -mod(k, N) * s] : null; },
        posunZ,
        popis(uhly, vstup) {
          const k = posunZ(uhly), radky = [];
          const ukazka = ab.znaky.slice(0, 6).map((z, i) => `${z}→${vn[(i + k) % N].toUpperCase()}`).join(' ');
          const hlavni = `Posun ${k}: ${ukazka} …`;
          if (vstup && vstup.text) {
            const out = (vstup.smer === 'd' ? V.desifruj : V.sifruj)(vstup.text, { abeceda: p.abeceda, vnitrni: vn, posun: k, perioda: p.perioda });
            radky.push((vstup.smer === 'd' ? 'Otevřený text: ' : 'Šifra: ') + out);
          }
          if (p.perioda > 0) radky.push(`Albertiho postup: po každých ${p.perioda} písmenech pootočte vnitřní kotouč o jeden dílek po směru ručiček.`);
          return { hlavni, radky };
        },
        navod: [
          'Vnější kotouč nese otevřený text (velká písmena), vnitřní otočný kotouč šifru (malá písmena).',
          'Klíčem je poloha: vnitřní „' + vn[0] + '“ (šipka) natočte pod domluvené vnější písmeno.',
          'Šifrování: najděte písmeno venku a opište písmeno pod ním. Dešifrování obráceně.',
          p.perioda > 0 ? `Polyalfabeticky (Alberti): po každých ${p.perioda} písmenech pootočte vnitřní kotouč o dílek.` : 'Pro silnější šifru měňte polohu kotouče během zprávy (Albertiho myšlenka, 1467).',
        ],
      };
    },
  };

  /* =====================================================================
     4. PLANISFÉRA
     ===================================================================== */
  const planisfera = {
    id: 'planisfera', nazev: 'Otočná mapa hvězd', ikona: '✨', popis: 'planisféra pro vaši zeměpisnou šířku',
    vychozi: { fi: 50, lambda: 15, zona: 1, rok: new Date().getFullYear(), mag: 4.5, cary: true, jmenaS: 'cz', jmenaH: true, ekl: true, rovnik: true, Rc: 97 },
    pole: [
      { id: 'fi', typ: 'cislo', label: 'Zeměpisná šířka (°, + sever; 25–70)', min: -70, max: 70, krok: 0.5 },
      { id: 'lambda', typ: 'cislo', label: 'Zeměpisná délka (°, + východ)', min: -180, max: 180, krok: 0.5 },
      { id: 'zona', typ: 'cislo', label: 'Časové pásmo stupnice (h od UTC)', min: -12, max: 14, krok: 0.5 },
      { id: 'rok', typ: 'cislo', label: 'Rok datové stupnice', min: 1900, max: 2200, krok: 1 },
      { id: 'mag', typ: 'cislo', label: 'Hvězdy do magnitudy', min: 1, max: 4.5, krok: 0.1 },
      { id: 'jmenaS', typ: 'vyber', label: 'Jména souhvězdí', moznosti: [['cz', 'česky'], ['la', 'latinsky'], ['zkr', 'zkratky'], ['zadna', 'žádná']] },
      { id: 'cary', typ: 'zaskrt', label: 'Čáry souhvězdí' },
      { id: 'jmenaH', typ: 'zaskrt', label: 'Jména jasných hvězd' },
      { id: 'ekl', typ: 'zaskrt', label: 'Ekliptika' },
      { id: 'rovnik', typ: 'zaskrt', label: 'Světový rovník a hodinové kružnice' },
      { id: 'Rc', typ: 'cislo', label: 'Průměr krytu (mm)', min: 150, max: 500, krok: 1, nasob: 2 },
    ],
    vstupy: [{ id: 'datum', typ: 'date', label: 'Datum' }, { id: 'cas', typ: 'time', label: 'Čas (pásmo stupnice)' }],
    sestav(p, st) {
      const fi = Math.sign(p.fi || 1) * Math.min(70, Math.max(25, Math.abs(p.fi || 50)));
      const Rc = p.Rc / 1 || 97, Rd = Rc - Math.max(11, Rc * 0.13), Rm = Rd - Math.max(10, Rc * 0.125);
      const pl = V.planisfera({ fi, lambda: p.lambda, zona: p.zona, R: Rm, okraj: 5 });
      const H = HV(), sev = fi >= 0;
      // ---- hvězdný kotouč (spodní, otočný)
      const z = [{ t: 'k', x: 0, y: 0, r: Rm, f: 'nebe', s: 0 }];
      const vMape = (q) => Math.hypot(q[0], q[1]) <= Rm - 0.3;
      const jednotkovy = (ra, de) => [Math.cos(de * RAD) * Math.cos(ra * RAD), Math.cos(de * RAD) * Math.sin(ra * RAD), Math.sin(de * RAD)];
      const zJedn = (v) => [mod(Math.atan2(v[1], v[0]) / RAD, 360), Math.asin(Math.max(-1, Math.min(1, v[2]))) / RAD];
      /** úsečka po hlavní kružnici, rozdělená a oříznutá na mapu */
      const oblouk = (a, b) => {
        const A = jednotkovy(a[0], a[1]), B = jednotkovy(b[0], b[1]);
        const uh = Math.acos(Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]))), n = Math.max(1, Math.ceil(uh / RAD / 2));
        const body = [];
        for (let i = 0; i <= n; i++) {
          const t = i / n, sa = Math.sin((1 - t) * uh), sb = Math.sin(t * uh), sn = Math.sin(uh) || 1;
          const v = uh < 1e-9 ? A : [(A[0] * sa + B[0] * sb) / sn, (A[1] * sa + B[1] * sb) / sn, (A[2] * sa + B[2] * sb) / sn];
          const [ra, de] = zJedn(v); body.push(pl.hvezda(ra, de));
        }
        return body;
      };
      const pridejCaru = (body, c, s, o) => {
        let kus = [];
        for (const q of body) { if (vMape(q)) kus.push(q); else { if (kus.length > 1) z.push(cara(kus, c, s, o)); kus = []; } }
        if (kus.length > 1) z.push(cara(kus, c, s, o));
      };
      if (p.rovnik) {
        for (let h = 0; h < 24; h++) pridejCaru([pl.hvezda(h * 15, sev ? 88 : -88), pl.hvezda(h * 15, pl.dZr(Rm))], 'souhv', 0.1, { d: h % 6 !== 0 });
        for (const d of [-60, -30, 0, 30, 60]) { const b = []; for (let a = 0; a <= 360; a += 3) b.push(pl.hvezda(a, d)); pridejCaru(b, 'souhv', d === 0 ? 0.3 : 0.1, { d: d !== 0 }); }
        for (let h = 0; h < 24; h += 2) { const q = pl.hvezda(h * 15, 0), uq = V.uhelBodu(q[0], q[1]); const k = P(Math.hypot(q[0], q[1]) + 2.4, uq); z.push(txt(k[0], k[1], 2, h + 'h', 0, 'popisNebe')); }
      }
      if (p.ekl) { const b = []; for (let l = 0; l <= 360; l += 2) { const [ra, de] = V.eklZRov(l); b.push(pl.hvezda(ra, de)); } pridejCaru(b, 'akcent2', 0.3, { d: true }); }
      const S = H.SOUHVEZDI;
      if (p.cary) for (const c of S) for (const seg of c.c) { let b = []; for (let i = 1; i < seg.length; i++) { const o = oblouk(seg[i - 1], seg[i]); b = b.concat(i > 1 ? o.slice(1) : o); } pridejCaru(b, 'souhv', 0.22); }
      const hvezdy = [];
      for (let i = 0; i < H.H.length; i += 3) {
        const ra = H.H[i], de = H.H[i + 1], m = H.H[i + 2];
        if (m > p.mag) continue;
        const q = pl.hvezda(ra, de);
        if (!vMape(q)) continue;
        const r = Math.max(0.28, Math.min(2.3, 0.3 + 0.42 * (4.6 - m)) * Rc / 97);
        z.push(bod(q[0], q[1], r, 'hvezda'));
        hvezdy.push({ i: i / 3, ra, de, m, q, r });
      }
      if (p.jmenaH) for (const hv of hvezdy) { const jm = H.JMENA[hv.i]; if (jm && hv.m <= Math.min(p.mag, 2.6)) z.push(txt(hv.q[0] + hv.r + 0.6, hv.q[1] + 0.2, 1.9 * Rc / 97, jm, 0, 'popisNebe', { a: 'l' })); }
      if (p.jmenaS !== 'zadna') for (const c of S) {
        const q = pl.hvezda(c.p[0], c.p[1]);
        if (!vMape(q) || Math.hypot(q[0], q[1]) > Rm - 4) continue;
        const t = p.jmenaS === 'cz' ? c.cz : p.jmenaS === 'la' ? c.la : c.id;
        z.push(txt(q[0], q[1], (p.jmenaS === 'zkr' ? 2 : 1.8) * Rc / 97, t.toUpperCase(), 0, 'popisNebe', { n: true }));
      }
      z.push(kruh(Rm, 'cara', 0.35));
      // datová stupnice na okraji (čte se proti hodinám krytu na poloměru Rd)
      const rok = p.rok, dnyRoku = V.prestupny(rok, 'g') ? 366 : 365;
      for (let m = 1; m <= 12; m++) {
        const nd = V.pocetDni(rok, m, 'g');
        for (let d = 1; d <= nd; d++) {
          const a = pl.uhelData(rok, m, d), dlouha = d === 1, d10 = d % 10 === 0, d5 = d % 5 === 0;
          z.push(paprsek(dlouha ? Rm : Rd - (d10 ? 3.6 : d5 ? 2.5 : 1.4), Rd, a, 'cara', dlouha ? 0.35 : d5 ? 0.22 : 0.15));
          if (d5 && d < 30) z.push(textTecne(Rd - 5.4, a, Math.min(2.3, (Rd - Rm) * 0.2), String(d), 'text', { citelne: true }));
        }
        const aStred = pl.uhelData(rok, m, Math.ceil(nd / 2)) + (sev ? 0.5 : -0.5);
        z.push(textTecne(Rm + 2.4, aStred, Math.min(2.8, (Rd - Rm) * 0.24), V.JMENA_MES[m - 1], 'akcent', { n: true, citelne: true }));
      }
      z.push(kruh(Rd, 'cara', 0.35));
      void dnyRoku;
      const disk = vrstva({ id: 'hvezdy', nazev: 'Hvězdný kotouč (otočný)', tvar: { typ: 'kruh', r: Rd }, otoc: true, krok: 0.25, prvky: z });
      // ---- kryt s obzorem (horní, pevný)
      const c = [], obz = pl.obzor(240), okna = [{ b: obz }];
      c.push({ t: 'l', b: obz, z: true, c: 'cara', s: 0.4 });
      // okénka datové stupnice s můstky v denních hodinách (8, 12, 16 h)
      const mustky = [8, 12, 16].map((t) => mod(pl.uhelCasu(t), 360)).sort((a, b) => a - b), sirM = 3.2;
      for (let i = 0; i < mustky.length; i++) {
        const a1 = mustky[i] + sirM / 2, a2 = (i + 1 < mustky.length ? mustky[i + 1] : mustky[0] + 360) - sirM / 2;
        const b = V.vysec(Rm + 0.5, Rd - 0.5, a1, a2, 1);
        okna.push({ b }); c.push({ t: 'l', b, z: true, c: 'cara', s: 0.3 });
      }
      // hodiny pásma
      for (let i = 0; i < 24 * 6; i++) {
        const t = i / 6, a = pl.uhelCasu(t), hod = i % 6 === 0, pul = i % 3 === 0;
        c.push(paprsek(Rd + 0.3, Rd + 0.3 + (hod ? 3.4 : pul ? 2.2 : 1.2), a, 'cara', hod ? 0.35 : 0.18));
        if (hod) c.push(textTecne(Rd + 6.6, a, Math.min(3.6, (Rc - Rd) * 0.3), String(t), t === 0 ? 'akcent' : 'text', { n: true, citelne: true }));
      }
      c.push(kruh(Rd + 0.3, 'cara', 0.3), ...ozdoba(st, Rc));
      // světové strany a azimut na obzoru
      const zen = pl.zenit();
      const vne = (q, d) => { const dx = q[0] - zen[0], dy = q[1] - zen[1], l = Math.hypot(dx, dy) || 1; return [q[0] + dx / l * d, q[1] + dy / l * d]; };
      for (let A = 0; A < 360; A += 10) {
        const q = pl.bodObzoru(A), k = vne(q, A % 90 === 0 ? 2.6 : A % 45 === 0 ? 1.8 : 1.1);
        c.push(cara([q, k], 'cara', 0.25));
      }
      const STR = [[0, 'S'], [45, 'SV'], [90, 'V'], [135, 'JV'], [180, 'J'], [225, 'JZ'], [270, 'Z'], [315, 'SZ']];
      for (const [A, t] of STR) {
        const q = vne(pl.bodObzoru(A), A % 90 === 0 ? 5.2 : 4.2);
        if (Math.hypot(q[0], q[1]) < Rm - 1) c.push(txt(q[0], q[1], A % 90 === 0 ? 3.6 : 2.6, t, 0, A % 90 === 0 ? 'akcent' : 'text', { n: true }));
      }
      // texty v horní části krytu (nad severním bodem obzoru)
      const ySev = pl.bodObzoru(0)[1], hT = Math.min(4.6, Rc * 0.05);
      const yTit = Math.max(-Rm + hT * 1.6, (ySev - Rm) / 2 - hT * 1.4);
      c.push(txt(0, yTit, hT, 'Otočná mapa hvězd', 0, 'text', { n: true }));
      const zonaTxt = `UTC${p.zona >= 0 ? '+' : '−'}${cislo(Math.abs(p.zona))}`;
      const radkyT = [`pro ${cislo(Math.abs(fi), 1)}° ${sev ? 's.' : 'j.'} š. · čas ${zonaTxt}${p.zona === 1 ? ' (SEČ)' : ''}`, 'Natočte datum proti času.', `Držte nad hlavou, ${sev ? 'jih' : 'sever'} dole.`, 'V letním čase odečtěte 1 h.'];
      c.push(...odstavec(st, radkyT, yTit + hT * 1.35, hT * 0.55, Math.sqrt(Math.max(1, Rm * Rm - (yTit + hT * 2) ** 2)) * 1.6, 'jemna'));
      const kryt = vrstva({ id: 'kryt', nazev: 'Kryt s okénkem obzoru (pevný)', tvar: { typ: 'kruh', r: Rc }, okna, prvky: c });
      const casZ = (vstup) => { const t = parsujCas(vstup && vstup.cas); return t == null ? 21 : t; };
      const jmenaH = Object.keys(H.JMENA).map((i) => ({ jm: H.JMENA[i], ra: H.H[i * 3], de: H.H[i * 3 + 1], m: H.H[i * 3 + 2] })).sort((a, b) => a.m - b.m);
      return {
        vrstvy: [disk, kryt], data: { pl, Rm, Rd, Rc, hvezdy, fi },
        nastav(vstup) { const dt = parsujDatum(vstup && vstup.datum); if (!dt) return null; return [pl.uhelCasu(casZ(vstup)) - pl.uhelData(dt.y, dt.m, dt.d), 0]; },
        popis(uhly, vstup) {
          const lst = pl.lstZOtoceni(uhly[0]), radky = [], dt = parsujDatum(vstup && vstup.datum);
          const hm = (h) => { h = mod(h, 24); const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return mm === 60 ? `${dvoj((hh + 1) % 24)}:00` : `${dvoj(hh)}:${dvoj(mm)}`; };
          let hlavni = `Místní hvězdný čas ${hm(lst / 15)}`;
          if (dt) {
            // čas, který kryt ukazuje proti zvolenému datu
            const t = mod((180 - p.lambda - pl.s * (pl.uhelData(dt.y, dt.m, dt.d) + uhly[0])) / 15, 24);
            hlavni = `${datumCz(dt.y, dt.m, dt.d)} v ${hm(t)} (${zonaTxt}) · hvězdný čas ${hm(lst / 15)}`;
          }
          const vid = jmenaH.map((h) => ({ ...h, v: pl.vyska(h.ra, h.de, lst), az: pl.azimut(h.ra, h.de, lst) })).filter((h) => h.v > 5).slice(0, 8);
          const sm = (az) => ['S', 'SV', 'V', 'JV', 'J', 'JZ', 'Z', 'SZ'][Math.round(az / 45) % 8];
          radky.push('Nad obzorem: ' + vid.map((h) => `${h.jm} ${Math.round(h.v)}° ${sm(h.az)}`).join(' · '));
          let nej = null, nd = 1e9;
          for (const c of H.SOUHVEZDI) { const d = Math.acos(Math.max(-1, Math.min(1, Math.sin(fi * RAD) * Math.sin(c.p[1] * RAD) + Math.cos(fi * RAD) * Math.cos(c.p[1] * RAD) * Math.cos((lst - c.p[0]) * RAD)))); if (d < nd) { nd = d; nej = c; } }
          if (nej) radky.push(`Blízko zenitu: ${nej.cz} (${nej.la})`);
          return { hlavni, radky };
        },
        navod: [
          'Hvězdný kotouč je vespod, kryt s okénkem obzoru nahoře; sešijte je přesně ve středu (světový pól).',
          'Otáčejte kotoučem, až bude datum (okénka na okraji) proti hodině krytu.',
          `Mapu držte nad hlavou, ${sev ? 'jižní okraj (J) směrem k jihu' : 'severní okraj (S) směrem k severu'}; v okénku je právě viditelná obloha.`,
          `Stupnice hodin platí pro délku ${cislo(p.lambda, 1)}° a pásmo ${zonaTxt}; v letním čase odečtěte hodinu.`,
          'Hvězdy: Yale Bright Star Catalogue (public domain); čáry souhvězdí d3-celestial © O. Frohn, BSD-3.',
        ],
      };
    },
  };

  /* =====================================================================
     5. PŘEVODNÍK JEDNOTEK
     ===================================================================== */
  const prevodnik = {
    id: 'prevodnik', nazev: 'Převodník jednotek', ikona: '🍳', popis: 'kuchyňský a technický převodník s ukazatelem',
    vychozi: { p1: 'teplota', p2: 'g_oz', p3: 'ml_cup', log1: false, R: 92 },
    pole: [
      { id: 'p1', typ: 'vyber', label: 'Vnější prstenec', moznosti: Object.keys(V.PREVODY).map((k) => [k, V.PREVODY[k].nazev]) },
      { id: 'p2', typ: 'vyber', label: 'Prostřední prstenec', moznosti: [['', '— nic —']].concat(Object.keys(V.PREVODY).map((k) => [k, V.PREVODY[k].nazev])) },
      { id: 'p3', typ: 'vyber', label: 'Vnitřní prstenec', moznosti: [['', '— nic —']].concat(Object.keys(V.PREVODY).map((k) => [k, V.PREVODY[k].nazev])) },
      { id: 'R', typ: 'cislo', label: 'Průměr kotouče (mm)', min: 110, max: 400, krok: 1, nasob: 2 },
    ],
    vstupy: [{ id: 'hodnota', typ: 'number', label: 'Hodnota vnějšího prstence' }],
    sestav(p, st) {
      const R = p.R, ids = [p.p1, p.p2, p.p3].filter((x) => x && V.PREVODY[x]), n = ids.length || 1;
      const ro = R - sireOzdoby(st) - 1, rIn = Math.max(24, R * 0.28), w = (ro - rIn) / n, ZAC = 15, ROZ = 330;
      const z = [...ozdoba(st, R)], prst = [];
      ids.forEach((id, i) => {
        const pr = V.PREVODY[id], r2 = ro - i * w, r1 = r2 - w, rm = (r1 + r2) / 2, hT = Math.min(3.2, w * 0.16);
        z.push(vysecF(r1 + 0.4, r2 - 0.4, ZAC - 2, ZAC + ROZ + 2, 'v' + (i * 2 % 8)));
        const ua = (x) => V.uhelPrevodu(pr, x, ZAC, ROZ);
        const delka = rm * ROZ * RAD, pocet = Math.round(delka / 1.5);
        z.push(...stupnice(V.dilkyRozsah(pr.od, pr.do, pr.log, pocet), ua, rm, 1, { h: hT, delky: [w * 0.18, w * 0.12, w * 0.07], citelne: true }));
        // druhá jednotka dovnitř
        const bOd = pr.f(pr.od), bDo = pr.f(pr.do);
        const dB = pr.diskretni ? pr.diskretni.filter((q) => q[0] >= Math.min(bOd, bDo) && q[0] <= Math.max(bOd, bDo)).map((q) => ({ x: q[0], uroven: 0, popis: q[1] })) : V.dilkyRozsah(Math.min(bOd, bDo), Math.max(bOd, bDo), pr.log, pocet);
        z.push(...stupnice(dB, (x) => ua(pr.g(x)), rm, -1, { h: hT, delky: [w * 0.18, w * 0.12, w * 0.07], citelne: true, ct: 'akcent2', zakladna: false }));
        // jednotky v mezeře nahoře
        z.push(textTecne(rm + w * 0.27, 0, hT * 1.15, pr.a, 'text', { n: true }), textTecne(rm - w * 0.27, 0, hT * 1.15, pr.b, 'akcent2', { n: true }));
        z.push(paprsek(r1, r2, ZAC - 4, 'jemna', 0.15), paprsek(r1, r2, ZAC + ROZ + 4, 'jemna', 0.15));
        prst.push({ id, pr, rm, r1, r2 });
      });
      z.push(...odstavec(st, ['Převodník'], -rIn * 0.25, Math.min(4.5, rIn * 0.2), rIn * 1.7, 'text', { n: true }));
      const zaklad = vrstva({ id: 'zaklad', nazev: 'Kotouč se stupnicemi (pevný)', tvar: { typ: 'kruh', r: R }, prvky: z });
      // ukazatel se štěrbinou
      const hub = Math.min(13, rIn * 0.5), hw = 6, tip = R + 7, b = [];
      const aw = Math.asin(hw / hub) / RAD;
      b.push([hw, -Math.sqrt(hub * hub - hw * hw)], [hw, -(R + 3)], [0, -tip], [-hw, -(R + 3)], [-hw, -Math.sqrt(hub * hub - hw * hw)]);
      for (let a = 360 - aw; a >= aw; a -= 4) b.push(P(hub, a));
      const ster = [[-1.7, -(R - 0.5)], [1.7, -(R - 0.5)], [1.7, -(rIn - 2)], [-1.7, -(rIn - 2)]];
      const u = [{ t: 'l', b: ster, z: true, c: 'akcent', s: 0.25 }];
      for (const q of prst) u.push(cara([[-hw + 0.6, -q.rm], [-2.4, -q.rm]], 'akcent', 0.3), cara([[2.4, -q.rm], [hw - 0.6, -q.rm]], 'akcent', 0.3));
      const ukaz = vrstva({ id: 'ukazatel', nazev: 'Ukazatel se štěrbinou (otočný)', tvar: { typ: 'poly', b }, okna: [{ b: ster }], otoc: true, krok: 0, prvky: u });
      return {
        vrstvy: [zaklad, ukaz], data: { prst, ZAC, ROZ },
        nastav(vstup) { const x = parseFloat(String(vstup && vstup.hodnota).replace(',', '.')); if (!isFinite(x) || !prst.length) return null; const pr = prst[0].pr; return [0, V.uhelPrevodu(pr, Math.max(pr.od, Math.min(pr.do, x)), ZAC, ROZ)]; },
        popis(uhly) {
          const a = mod(uhly[1], 360), radky = [];
          for (const q of prst) {
            if (a < ZAC - 0.01 || a > ZAC + ROZ + 0.01) { radky.push(`${q.pr.nazev}: mimo stupnici`); continue; }
            const x = V.hodnotaPrevodu(q.pr, a, ZAC, ROZ), y = q.pr.f(x);
            radky.push(`${cislo(x, x >= 100 ? 0 : x >= 10 ? 1 : 2)} ${q.pr.a} = ${cislo(y, Math.abs(y) >= 100 ? 0 : Math.abs(y) >= 10 ? 1 : 2)} ${q.pr.b}`);
          }
          return { hlavni: radky[0] || '', radky: radky.slice(1) };
        },
        navod: ['Ukazatel položte na kotouč a sešijte ve středu.', 'Štěrbinu natočte na hodnotu jedné jednotky – proti ní na druhé straně čáry čtete převedenou hodnotu.', 'Lineární stupnice mají stejné dílky, logaritmické zachovávají poměr (2→4 je stejně daleko jako 1→2).'],
      };
    },
  };

  /* =====================================================================
     6. LOGARITMICKÝ KOTOUČOVÝ KALKULÁTOR
     ===================================================================== */
  const logaritmicky = {
    id: 'logaritmicky', nazev: 'Kotoučové logaritmické pravítko', ikona: '🧮', popis: 'stupnice C/D, CI, A/B, K, S, T, L',
    vychozi: { R: 95, kurzor: 'sterbina', sady: 'vse' },
    pole: [
      { id: 'sady', typ: 'vyber', label: 'Stupnice', moznosti: [['vse', 'D, A, K, S, T, L + C, CI, B'], ['zakladni', 'jen D a C, CI (větší dílky)']] },
      { id: 'kurzor', typ: 'vyber', label: 'Kurzor', moznosti: [['sterbina', 'papírový se štěrbinou'], ['folie', 'na průhlednou fólii s vlasovou čarou']] },
      { id: 'R', typ: 'cislo', label: 'Průměr (mm)', min: 120, max: 400, krok: 1, nasob: 2 },
    ],
    vstupy: [{ id: 'a', typ: 'number', label: 'a' }, { id: 'op', typ: 'select', label: 'Operace', moznosti: [['krat', '×'], ['deleno', '÷']] }, { id: 'b', typ: 'number', label: 'b' }],
    sestav(p, st) {
      const R = p.R, ro = R - sireOzdoby(st) - 0.6, vse = p.sady !== 'zakladni';
      const vnejsi = vse ? ['D', 'A', 'K', 'S', 'T', 'L'] : ['D'], vnitrni = vse ? ['C', 'CI', 'B'] : ['C', 'CI'];
      const w = vse ? (ro - R * 0.36) / 9 : (ro - R * 0.42) / 3.2, Rdisk = ro - vnejsi.length * w - (vse ? 0 : w * 0.2);
      const dilkyPro = (sk) => (sk === 'S' || sk === 'T' ? V.dilkyGon(sk) : sk === 'L' ? V.dilkyL() : V.dilkyLog(V.STUPNICE_LOG[sk].dek || 1));
      const z = [...ozdoba(st, R)], rS = {};
      vnejsi.forEach((sk, i) => {
        const r = Rdisk + i * w;
        rS[sk] = r + w / 2;
        if (i % 2) z.push(vysecF(r, r + w, 0, 360, 'v1'));
        z.push(...stupnice(dilkyPro(sk), (x) => V.uhelStupnice(sk, x), r, 1, { h: Math.min(2.5, w * 0.3), delky: [w * 0.36, w * 0.24, w * 0.14], s: [0.22, 0.16, 0.1], ct: sk === 'D' ? 'text' : 'text' }));
      });
      const zaklad = vrstva({ id: 'zaklad', nazev: 'Pevný kotouč – D' + (vse ? ', A, K, S, T, L' : ''), tvar: { typ: 'kruh', r: R }, prvky: z });
      const h = [];
      vnitrni.forEach((sk, i) => {
        const r = Rdisk - i * w;
        rS[sk] = r - w / 2;
        if (i % 2) h.push(vysecF(r - w, r, 0, 360, 'v3'));
        h.push(...stupnice(dilkyPro(sk), (x) => V.uhelStupnice(sk, x), r, -1, { h: Math.min(2.5, w * 0.3), delky: [w * 0.36, w * 0.24, w * 0.14], s: [0.22, 0.16, 0.1], ct: sk === 'CI' ? 'akcent' : 'text', c: sk === 'CI' ? 'akcent' : 'cara' }));
      });
      h.push(kruh(Rdisk, 'cara', 0.35));
      const rIn = Rdisk - vnitrni.length * w;
      h.push(...odstavec(st, ['Logaritmické', 'pravítko'], -rIn * 0.32, Math.min(4.2, rIn * 0.17), rIn * 1.6, 'text', { n: true }));
      h.push(txt(0, rIn * 0.25, Math.min(2.2, rIn * 0.09), 'J. Napier 1614 · W. Oughtred 1632', 0, 'jemna'));
      h.push(sipka(Rdisk - vnitrni.length * w - 0.3, Rdisk - vnitrni.length * w - 4, 0, 3, 'akcent'));
      const disk = vrstva({ id: 'disk', nazev: 'Otočný kotouč – C, CI' + (vse ? ', B' : ''), tvar: { typ: 'kruh', r: Rdisk - 0.3 }, otoc: true, krok: 0, prvky: h });
      // kurzor
      const hub = Math.min(12, rIn * 0.45), hw = 7.5, aw = Math.asin(hw / hub) / RAD, b = [];
      b.push([hw, -Math.sqrt(hub * hub - hw * hw)], [hw, -(R + 3)], [0, -(R + 7)], [-hw, -(R + 3)], [-hw, -Math.sqrt(hub * hub - hw * hw)]);
      for (let a = 360 - aw; a >= aw; a -= 4) b.push(P(hub, a));
      const u = [], okna = [];
      const r0 = rIn - 1.5, folie = p.kurzor === 'folie';
      if (!folie) { const ster = [[-1.5, -(ro + 0.2)], [1.5, -(ro + 0.2)], [1.5, -r0], [-1.5, -r0]]; okna.push({ b: ster }); u.push({ t: 'l', b: ster, z: true, c: 'akcent', s: 0.25 }); }
      else u.push(cara([[0, -(R + 6)], [0, -hub]], 'akcent', 0.15));
      for (const sk of vnejsi.concat(vnitrni)) u.push(txt(-hw + 2.6, -rS[sk], Math.min(2.6, w * 0.42), sk, -90, sk === 'CI' ? 'akcent' : 'text', { n: true }));
      const kurzor = vrstva({ id: 'kurzor', nazev: folie ? 'Kurzor (vytiskněte na fólii)' : 'Kurzor se štěrbinou', tvar: { typ: 'poly', b }, okna, otoc: true, krok: 0, prvky: u, pruhledna: folie ? 0.35 : 0 });
      const hodn = (sk, a) => V.hodnotaStupnice(sk, a);
      return {
        vrstvy: [zaklad, disk, kurzor], data: { Rdisk, rS, w },
        nastav(vstup) {
          const a = parseFloat(String(vstup && vstup.a).replace(',', '.')), b2 = parseFloat(String(vstup && vstup.b).replace(',', '.'));
          if (!(a > 0) || !(b2 > 0)) return null;
          if (vstup.op === 'deleno') { const rc = 360 * (Math.log10(a) - Math.log10(b2)); return [0, rc, 360 * Math.log10(a)]; }
          const rc = 360 * Math.log10(a); return [0, rc, rc + 360 * Math.log10(b2)];
        },
        popis(uhly, vstup) {
          const rc = uhly[1], g = uhly[2], radky = [];
          const D = hodn('D', g), C = hodn('C', g - rc), idx = Math.pow(10, mod(rc, 360) / 360);
          let hlavni = `Pod kurzorem: D = ${cislo(D, 3)} · C = ${cislo(C, 3)}`;
          if (vse) radky.push(`A = ${cislo(hodn('A', g), 3)} · K = ${cislo(hodn('K', g), 3)} · B = ${cislo(hodn('B', g - rc), 3)} · CI = ${cislo(1 / C * 10, 3)}`);
          if (vse) { const sa = V.hodnotaStupnice('S', g), ta = V.hodnotaStupnice('T', g); radky.push(`S: sin ${cislo(sa, 2)}° = ${cislo(D / 10, 4)} · T: tg ${cislo(ta, 2)}° = ${cislo(D / 10, 4)} · L = ${cislo(mod(g, 360) / 360, 3)} (log D)`); }
          radky.push(`Index C (1) stojí proti D = ${cislo(idx, 3)} → D = C × ${cislo(idx, 3)}`);
          const a = parseFloat(String(vstup && vstup.a).replace(',', '.')), b2 = parseFloat(String(vstup && vstup.b).replace(',', '.'));
          if (a > 0 && b2 > 0) {
            const vys = vstup.op === 'deleno' ? a / b2 : a * b2, m = Math.floor(Math.log10(vys));
            hlavni = `${cislo(a, 4)} ${vstup.op === 'deleno' ? '÷' : '×'} ${cislo(b2, 4)} = ${cislo(vys, 4)} · na pravítku ${cislo(vys / Math.pow(10, m), 3)} × 10^${m} (řád hlídáte sami)`;
          }
          return { hlavni, radky };
        },
        navod: [
          'Násobení a × b: natočte 1 stupnice C proti a na D, kurzor posuňte na b na C, výsledek čtěte na D pod kurzorem.',
          'Dělení a ÷ b: kurzor na a (D), pod něj natočte b (C); výsledek je na D proti 1 stupnice C.',
          'A/B = druhé mocniny (√ opačně), K = třetí mocniny, S a T = sin a tg úhlů 5,7°–90° (45°) jako D/10, L = dekadický logaritmus D.',
          'Desetinnou čárku (řád) určujete odhadem – pravítko ukazuje jen platné číslice.',
        ],
      };
    },
  };

  /* =====================================================================
     7. MŮJ ROK – kotouč pro děti
     ===================================================================== */
  const SVATKY = [
    [1, 1, 'Nový rok'], [2, 14, 'Valentýn'], [3, 21, 'první jarní den'], [4, 1, 'apríl'], [4, 30, 'čarodějnice'], [5, 1, 'Svátek práce'], [5, 8, 'Den vítězství'],
    [6, 1, 'Den dětí'], [6, 21, 'první letní den'], [6, 30, 'začátek prázdnin'], [7, 5, 'Cyril a Metoděj'], [7, 6, 'mistr Jan Hus'], [9, 1, 'škola začíná'],
    [9, 23, 'první podzimní den'], [9, 28, 'sv. Václav'], [10, 28, 'vznik republiky'], [11, 2, 'Dušičky'], [11, 11, 'sv. Martin'], [11, 17, 'Den svobody'],
    [12, 4, 'Barbora'], [12, 6, 'Mikuláš'], [12, 21, 'první zimní den'], [12, 24, 'Štědrý den'], [12, 25, 'Boží hod'], [12, 26, 'Štěpán'], [12, 31, 'Silvestr'],
  ];
  const ZVEROKRUH = [[1, 20, 'Vodnář'], [2, 19, 'Ryby'], [3, 21, 'Beran'], [4, 20, 'Býk'], [5, 21, 'Blíženci'], [6, 21, 'Rak'], [7, 23, 'Lev'], [8, 23, 'Panna'], [9, 23, 'Váhy'], [10, 23, 'Štír'], [11, 22, 'Střelec'], [12, 22, 'Kozoroh']];
  const rocni = {
    id: 'rok', nazev: 'Můj rok (pro děti)', ikona: '🌈', popis: 'měsíce, roční období, zvěrokruh a svátky',
    vychozi: { rok: new Date().getFullYear(), vlastni: '15. 4. narozeniny\n24. 12. Ježíšek', zverokruh: true, R: 95 },
    pole: [
      { id: 'rok', typ: 'cislo', label: 'Rok (Velikonoce, dny v týdnu)', min: 1900, max: 2200, krok: 1 },
      { id: 'zverokruh', typ: 'zaskrt', label: 'Prstenec znamení zvěrokruhu' },
      { id: 'vlastni', typ: 'textarea', label: 'Vlastní dny (řádek „den. měsíc. text“)' },
      { id: 'R', typ: 'cislo', label: 'Průměr (mm)', min: 120, max: 400, krok: 1, nasob: 2 },
    ],
    vstupy: [{ id: 'datum', typ: 'date', label: 'Den' }],
    sestav(p, st) {
      const R = p.R, rok = p.rok, N = V.prestupny(rok, 'g') ? 366 : 365, ro = R - sireOzdoby(st) - 0.5;
      const uD = (m, d) => (V.denRoku(rok, m, d, 'g') - 1) / N * 360, uDs = (m, d) => uD(m, d) + 180 / N;
      const rM1 = R * 0.875, R1 = rM1 - 1, rO1 = R * 0.75, rZ1 = p.zverokruh ? R * 0.64 : rO1, rS2 = rZ1 - 1.5, rS1 = R * 0.22;
      const obdobi = (m) => (m === 12 || m <= 2 ? 4 : m <= 5 ? 2 : m <= 8 ? 1 : 0);
      const z = [...ozdoba(st, R)];
      for (let m = 1; m <= 12; m++) {
        const a1 = uD(m, 1), a2 = m === 12 ? 360 : uD(m + 1, 1);
        z.push(vysecF(rM1, ro, a1, a2, 'v' + obdobi(m)), paprsek(rM1, ro, a1, 'cara', 0.35));
        z.push(textTecne((rM1 + ro) / 2 + 1, (a1 + a2) / 2, Math.min(4.2, (ro - rM1) * 0.42), V.JMENA_MES[m - 1], 'text', { n: true, citelne: true }));
        for (let d = 1; d <= V.pocetDni(rok, m, 'g'); d++) {
          const a = uDs(m, d);
          z.push(paprsek(rM1, rM1 + (d % 5 === 0 ? 2.2 : 1.1), a, 'cara', 0.15));
          if (d % 10 === 0) z.push(textTecne(rM1 + 3.6, a, 1.8, String(d), 'jemna', { citelne: true }));
        }
      }
      z.push(kruh(rM1, 'cara', 0.35));
      // roční období
      const OB = [[3, 21, 'jaro', 'kvet', 'v2'], [6, 21, 'léto', 'slunce', 'v1'], [9, 23, 'podzim', 'list', 'v0'], [12, 21, 'zima', 'vlocka', 'v4']];
      for (let i = 0; i < 4; i++) {
        const [m, d, jm, ik, f] = OB[i], [m2, d2] = OB[(i + 1) % 4], a1 = uD(m, d);
        let a2 = uD(m2, d2); if (a2 <= a1) a2 += 360;
        z.push(vysecF(rO1, rM1 - 0.6, a1, a2, f), paprsek(rO1, rM1, a1, 'cara', 0.3));
        const hO = Math.min(3.6, (rM1 - rO1) * 0.34);
        for (let k = 0; k < 3; k++) {
          const a = a1 + (a2 - a1) * (k + 0.5) / 3;
          if (k === 1) z.push(textTecne((rO1 + rM1) / 2, a, hO, jm, 'text', { n: true, citelne: true }));
          else { const q = P((rO1 + rM1) / 2, a); z.push(...K.ikona(ik, q[0], q[1], (rM1 - rO1) * 0.3, a)); }
        }
      }
      z.push(kruh(rO1, 'cara', 0.3));
      if (p.zverokruh) for (let i = 0; i < 12; i++) {
        const [m, d, jm] = ZVEROKRUH[i], [m2, d2] = ZVEROKRUH[(i + 1) % 12], a1 = uD(m, d);
        let a2 = uD(m2, d2); if (a2 <= a1) a2 += 360;
        z.push(vysecF(rZ1, rO1 - 0.4, a1, a2, 'v' + (5 + i % 3)), paprsek(rZ1, rO1, a1, 'cara', 0.2));
        z.push(textTecne((rZ1 + rO1) / 2, (a1 + a2) / 2, Math.min(3, (rO1 - rZ1) * 0.4), jm, 'text', { citelne: true }));
      }
      if (p.zverokruh) z.push(kruh(rZ1, 'cara', 0.3));
      // svátky a vlastní dny – radiálně u svého dne, rozestrčené proti překrytí
      const vel = V.velikonoce(rok), vp = V.zJdn(V.jdn(rok, vel.m, vel.d, 'g') - 2), vpo = V.zJdn(V.jdn(rok, vel.m, vel.d, 'g') + 1);
      const dm = (() => { let d = 1; while (V.denTydne(rok, 5, d, 'g') !== 0) d++; return d + 7; })();
      const dny = SVATKY.map((q) => ({ m: q[0], d: q[1], t: q[2], c: 'text' }));
      dny.push({ m: vp.m, d: vp.d, t: 'Velký pátek', c: 'text' }, { m: vel.m, d: vel.d, t: 'Velikonoce', c: 'akcent', ik: 'vejce' }, { m: vpo.m, d: vpo.d, t: 'Velikonoční pondělí', c: 'text' }, { m: 5, d: dm, t: 'Den matek', c: 'text', ik: 'srdce' });
      for (const r of String(p.vlastni || '').split('\n')) { const q = /^\s*(\d{1,2})\.\s*(\d{1,2})\.?\s*(.+)$/.exec(r); if (q && +q[2] >= 1 && +q[2] <= 12 && +q[1] >= 1 && +q[1] <= V.pocetDni(rok, +q[2], 'g')) dny.push({ m: +q[2], d: +q[1], t: q[3].trim().slice(0, 28), c: 'akcent2', ik: 'hvezda' }); }
      dny.sort((a, b) => uDs(a.m, a.d) - uDs(b.m, b.d));
      const hS = Math.min(2.5, R * 0.027), rozestup = hS * 1.25 / ((rS1 + rS2) / 2 * 0.62) / RAD;
      const pol = dny.map((q) => ({ ...q, a: uDs(q.m, q.d) }));
      for (let it = 0; it < 40; it++) for (let i = 0; i < pol.length; i++) {
        const j = (i + 1) % pol.length; let d = pol[j].a - pol[i].a; if (j === 0) d += 360;
        if (d < rozestup) { const o = (rozestup - d) / 2; pol[i].a -= o; pol[j].a += o; }
      }
      for (const q of pol) {
        const t = `${q.d}. ${q.m}. ${q.t}`, maxW = rS2 - rS1 - 2, w = ST.sirkaTextu(st, t, hS);
        const hh = w > maxW ? hS * maxW / w : hS;
        z.push(textRadial((rS1 + rS2) / 2, q.a, hh, t, q.c));
        z.push(paprsek(rS2 - 0.2, rS2 + 1.2, uDs(q.m, q.d), q.c === 'akcent2' ? 'akcent2' : 'jemna', 0.2));
      }
      const zaklad = vrstva({ id: 'zaklad', nazev: 'Spodní kotouč – měsíce, období, svátky', tvar: { typ: 'kruh', r: R }, prvky: z });
      // horní kotouč s okénkem
      const h = [], oW = 12.5, okno = V.vysec(rS1 - 1, R1 - 2.2 - (p.zverokruh ? 0 : 0), -oW, oW, 1);
      h.push({ t: 'l', b: okno, z: true, c: 'akcent', s: 0.5 }, sipka(R1 - 2.6, R1 + 0.1, 0, 4.2, 'akcent'));
      h.push(...ozdoba(st, R1));
      const hT = Math.min(5.5, R * 0.06);
      h.push(...odstavec(st, ['Můj rok'], R1 * 0.18, hT, R1, 'text', { n: true }), txt(0, R1 * 0.18 + hT * 1.1, hT * 0.7, String(rok), 0, 'akcent', { n: true }));
      h.push(...odstavec(st, ['Otoč okénko', 'na dnešní den!'], R1 * 0.42, hT * 0.5, R1, 'jemna'));
      const ikony = ['slunce', 'kvet', 'list', 'vlocka', 'hvezda', 'srdce', 'stromek', 'mrak', 'kapka', 'darek'];
      for (let i = 0; i < 10; i++) { const a = 35 + i * 29, q = P(R1 * 0.62, a); h.push(...K.ikona(ikony[i], q[0], q[1], R1 * 0.075, 0)); }
      const horni = vrstva({ id: 'horni', nazev: 'Horní kotouč s okénkem (otočný)', tvar: { typ: 'kruh', r: R1 }, okna: [{ b: okno }], otoc: true, krok: 360 / N, prvky: h });
      const zDoy = (doy) => V.zJdn(V.jdn(rok, 1, 1, 'g') + doy - 1);
      return {
        vrstvy: [zaklad, horni], data: { N, dny },
        nastav(vstup) { const dt = parsujDatum(vstup && vstup.datum); if (!dt) return null; return [0, uDs(dt.m, dt.d)]; },
        popis(uhly) {
          const doy = Math.floor(mod(uhly[1], 360) / 360 * N) + 1, dt = zDoy(doy), radky = [];
          const ob = OB.slice().reverse().find((o) => V.denRoku(rok, o[0], o[1], 'g') <= doy) || OB[3];
          const zv = ZVEROKRUH.slice().reverse().find((o) => V.denRoku(rok, o[0], o[1], 'g') <= doy) || ZVEROKRUH[11];
          const hlavni = `${dt.d}. ${V.MES_GEN[dt.m - 1]} ${rok} (${V.JMENA_DNU[V.denTydne(rok, dt.m, dt.d, 'g')]}) · ${ob[2]}` + (p.zverokruh ? ` · ${zv[2]}` : '');
          const blizko = dny.filter((q) => { const d = V.denRoku(rok, q.m, q.d, 'g') - doy; return d >= 0 && d <= 14; }).map((q) => `${q.d}. ${q.m}. ${q.t}`);
          if (blizko.length) radky.push('Brzy: ' + blizko.join(' · '));
          return { hlavni, radky };
        },
        navod: ['Horní kotouč s okénkem sešijte se spodním uprostřed.', 'Šipku natoč na dnešní den – v okénku uvidíš roční období, znamení a svátky, které se blíží.', 'Do vlastních dnů si napiš narozeniny celé rodiny.'],
      };
    },
  };

  /* =====================================================================
     8. VLASTNÍ VOLVELLE – editor vrstev
     ===================================================================== */
  const VZOR_VLASTNI = {
    vrstvy: [
      { nazev: 'Spodní kotouč', typ: 'kotouc', r: 95, otoc: false, dilky: 12, prstence: [
        { r1: 72, r2: 92, n: 12, texty: 'leden;únor;březen;duben;květen;červen;červenec;srpen;září;říjen;listopad;prosinec', orient: 'tecna', vypln: true, nadpis: true },
        { r1: 40, r2: 68, n: 12, texty: ':vlocka:;:vlocka:;:kvet:;:kapka:;:kvet:;:slunce:;:slunce:;:slunce:;:list:;:list:;:mrak:;:stromek:', orient: 'tecna', vypln: true },
      ], okna: [] },
      { nazev: 'Horní kotouč', typ: 'kotouc', r: 70, otoc: true, dilky: 12, prstence: [
        { r1: 20, r2: 36, n: 1, texty: 'Můj kotouč', orient: 'tecna', vypln: false, nadpis: true },
      ], okna: [{ typ: 'vysec', r1: 41, r2: 67, sirka: 26, uhel: 0, opak: 1 }], sipka: true },
    ],
  };
  const vlastni = {
    id: 'vlastni', nazev: 'Vlastní volvelle', ikona: '🛠️', popis: 'editor vrstev, prstenců a okének',
    vychozi: { vlastni: JSON.parse(JSON.stringify(VZOR_VLASTNI)) },
    pole: [],
    vstupy: [],
    sestav(p, st) {
      const model = p.vlastni && p.vlastni.vrstvy && p.vlastni.vrstvy.length ? p.vlastni : VZOR_VLASTNI;
      const vrstvy = model.vrstvy.map((v, iv) => {
        const R = Math.max(10, +v.r || 50), prvky = [], okna = [];
        let tvar = { typ: 'kruh', r: R };
        if (v.typ === 'ukazatel') {
          const hub = Math.min(12, R * 0.2), hw = Math.max(3, +v.sirka || 7), aw = Math.asin(Math.min(0.99, hw / hub)) / RAD, b = [];
          b.push([hw, -Math.sqrt(Math.max(0, hub * hub - hw * hw))], [hw, -(R - hw)], [0, -R], [-hw, -(R - hw)], [-hw, -Math.sqrt(Math.max(0, hub * hub - hw * hw))]);
          for (let a = 360 - aw; a >= aw; a -= 4) b.push(P(hub, a));
          tvar = { typ: 'poly', b };
          prvky.push(cara([[0, -hub], [0, -(R - hw)]], 'akcent', 0.3));
        } else prvky.push(...ozdoba(st, R));
        for (const pr of v.prstence || []) {
          const r1 = Math.max(0, Math.min(+pr.r1, +pr.r2)), r2 = Math.min(R - 0.5, Math.max(+pr.r1, +pr.r2)), n = Math.max(1, Math.min(120, Math.round(+pr.n || 1)));
          const texty = String(pr.texty || '').split(';'), s = 360 / n, posun = +pr.posun || 0;
          for (let i = 0; i < n; i++) {
            const a = posun + i * s, t = (texty[i % Math.max(1, texty.length)] || '').trim();
            if (pr.vypln) prvky.push(vysecF(r1, r2, a - s / 2, a + s / 2, 'v' + (i % 8)));
            if (n > 1 && pr.cary !== false) prvky.push(paprsek(r1, r2, a - s / 2, 'cara', 0.25));
            const ik = /^:([a-z]+):$/.exec(t);
            if (ik && K.IKONY[ik[1]]) { const q = P((r1 + r2) / 2, a); prvky.push(...K.ikona(ik[1], q[0], q[1], Math.min((r2 - r1) * 0.38, (r1 + r2) / 2 * s * RAD * 0.38), a)); }
            else if (t) {
              if (n === 1 && pr.orient !== 'radial') prvky.push(...odstavec(st, t.split('|'), r1 > 0 ? -(r1 + r2) / 2 : -((r2 - r1) * 0.15), Math.min(6, (r2 - r1) * 0.3), r2 * 1.6, 'text', { n: !!pr.nadpis }));
              else if (pr.orient === 'radial') { const w = ST.sirkaTextu(st, t, 3), h = Math.min((r1 + r2) / 2 * s * RAD * 0.6, 3 * (r2 - r1 - 1) / Math.max(w, 1), 5); prvky.push(textRadial((r1 + r2) / 2, a, h, t, 'text', { n: !!pr.nadpis })); }
              else prvky.push(...blokVeVyseci(st, t.split('|'), r1 + 0.5, r2 - 0.5, a, s * 0.92, { hMax: 6, citelne: true, n: !!pr.nadpis, poJedne: t.includes('|') }).prvky);
            }
          }
          if (r1 > 0) prvky.push(kruh(r1, 'cara', 0.3));
          prvky.push(kruh(r2, 'cara', 0.3));
        }
        for (const o of v.okna || []) {
          const opak = Math.max(1, Math.min(36, Math.round(+o.opak || 1)));
          for (let k = 0; k < opak; k++) {
            const a = (+o.uhel || 0) + k * 360 / opak;
            if (o.typ === 'kruh') { const q = P(+o.r1 || 30, a), rr = Math.max(1, (+o.sirka || 8) / 2); okna.push({ kruh: [q[0], q[1], rr] }); prvky.push({ t: 'k', x: q[0], y: q[1], r: rr, c: 'cara', s: 0.35 }); }
            else { const b = V.vysec(Math.max(0.5, Math.min(+o.r1, +o.r2)), Math.max(+o.r1, +o.r2), a - (+o.sirka || 20) / 2, a + (+o.sirka || 20) / 2, 1); okna.push({ b }); prvky.push({ t: 'l', b, z: true, c: 'cara', s: 0.35 }); }
          }
        }
        if (v.sipka && v.typ !== 'ukazatel') prvky.push(sipka(R - 4, R + 0.1, 0, 4, 'akcent'));
        return vrstva({ id: 'v' + iv, nazev: v.nazev || 'Vrstva ' + (iv + 1), tvar, okna, otoc: !!v.otoc, krok: (+v.dilky > 0 ? 360 / +v.dilky : 0), prvky });
      });
      return {
        vrstvy, data: { model },
        nastav() { return null; },
        popis(uhly) {
          const radky = [];
          // co je vidět v okénkách: pro každé okno najdi nejbližší nižší vrstvu s prstencem v jeho středu
          model.vrstvy.forEach((v, iv) => (v.okna || []).forEach((o, io) => {
            const opak = Math.max(1, Math.round(+o.opak || 1));
            for (let k = 0; k < opak; k++) {
              const a = (+o.uhel || 0) + k * 360 / opak + (uhly[iv] || 0), r = o.typ === 'kruh' ? (+o.r1 || 30) : (Math.min(+o.r1, +o.r2) + Math.max(+o.r1, +o.r2)) / 2;
              for (let j = iv - 1; j >= 0; j--) {
                const pr = (model.vrstvy[j].prstence || []).find((q) => r >= Math.min(q.r1, q.r2) && r <= Math.max(q.r1, q.r2));
                if (!pr) continue;
                const n = Math.max(1, Math.round(+pr.n || 1)), s = 360 / n, i = mod(Math.round((a - (uhly[j] || 0) - (+pr.posun || 0)) / s), n);
                const texty = String(pr.texty || '').split(';');
                const tx = (texty[i % texty.length] || '').trim(), ik = /^:([a-z]+):$/.exec(tx);
                radky.push(`${v.nazev || 'Vrstva ' + (iv + 1)}, okénko ${io + 1}${opak > 1 ? '/' + (k + 1) : ''}: ${ik ? 'ikona „' + ik[1] + '“' : tx || 'dílek ' + (i + 1)}`);
                break;
              }
            }
          }));
          const otoc = model.vrstvy.map((v, i) => (v.otoc ? `${v.nazev}: ${cislo(mod(uhly[i] || 0, 360), 1)}°` : '')).filter(Boolean).join(' · ');
          return { hlavni: radky[0] || otoc || 'Otáčejte vrstvami tažením', radky: radky.slice(1).concat(radky.length ? [otoc] : []) };
        },
        navod: ['Každou vrstvu vystřihněte, okénka vyřízněte nožem, vrstvy seřaďte odspodu a sešijte ve středu.'],
      };
    },
  };

  const SABLONY = { kalendar, mesic, sifra, planisfera, prevodnik, logaritmicky, rok: rocni, vlastni };
  const PORADI = ['kalendar', 'mesic', 'sifra', 'planisfera', 'prevodnik', 'logaritmicky', 'rok', 'vlastni'];
  /** sestaví model šablony s doplněnými výchozími parametry */
  function sestav(id, p, stId, o) {
    const sb = SABLONY[id] || SABLONY.kalendar, st = ST.styl(stId, o);
    const pp = Object.assign({}, sb.vychozi, p || {});
    const m = sb.sestav(pp, st);
    m.vrstvy.forEach((v) => { v.R = K.obalR(v); });
    return Object.assign(m, { id: sb.id, nazev: sb.nazev, p: pp, styl: st });
  }
  const API = { SABLONY, PORADI, sestav, VZOR_VLASTNI, SVATKY, ZVEROKRUH, parsujDatum, parsujCas, dnes };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.VOLV_SABLONY = API;
})(typeof window !== 'undefined' ? window : globalThis);
