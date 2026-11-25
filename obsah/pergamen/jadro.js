/* ============================================================
   Pergamen – jadro.js
   Papír jako SVG (pergamen, natržený či ohořelý okraj, skvrny,
   stárnutí), šifrování textu (šifry z Dílny výprav + přepis do
   jiného písma z fonty/prepis.js) a šifrovací klíč.
   Bez DOM – běží i v node (test _test/pergamen_test.js).
   ============================================================ */
(function (G) {
  'use strict';
  const P = {};
  const f = x => Math.round(x * 100) / 100;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- formáty a volby ---------- */
  P.FORMATY = {
    a4: { nazev: 'A4 na výšku', w: 210, h: 297 },
    a4l: { nazev: 'A4 na šířku', w: 297, h: 210 },
    a5: { nazev: 'A5', w: 148, h: 210 },
    a6: { nazev: 'Pohlednice A6', w: 148, h: 105 },
    svitek: { nazev: 'Svitek (úzký)', w: 130, h: 297 }
  };
  P.PAPIRY = {
    pergamen: { nazev: 'Pergamen', a: '#f3e6c6', b: '#e3cc98', c: '#c9a865' },
    stary: { nazev: 'Starý tmavý papír', a: '#e4cd9a', b: '#cdac6a', c: '#9c7636' },
    svetly: { nazev: 'Světlý ruční papír', a: '#fbf6ea', b: '#f1e8d2', c: '#dccdab', sila: 0.45 },
    velin: { nazev: 'Velín (telecí kůže)', a: '#f4e5c8', b: '#e6cda3', c: '#c9a578', sum: '.025 .03', sila: 0.8, textura: 'velin' },
    ryzovy: { nazev: 'Rýžový papír (washi)', a: '#fdfbf4', b: '#f6f1e2', c: '#e6ddc4', sum: '.06 .06', sila: 0.3, textura: 'washi' },
    bambus: { nazev: 'Bambusový papír', a: '#f1ecd2', b: '#e3dab4', c: '#c9bd8e', sum: '.4 .012', sila: 0.75, textura: 'bambus' },
    papyrus: { nazev: 'Papyrus', a: '#ead9a6', b: '#dcc48a', c: '#b99d5e', sum: '.35 .015', sila: 0.6, textura: 'papyrus' },
    verge: { nazev: 'Žebrovaný papír (vergé)', a: '#f7f0dd', b: '#ede2c6', c: '#d6c5a0', sila: 0.4, textura: 'verge' },
    lneny: { nazev: 'Lněný papír', a: '#f5f1e6', b: '#ebe4d2', c: '#d4c9ae', sila: 0.35, textura: 'len' },
    kvetiny: { nazev: 'Ruční papír s lístky', a: '#f8f2e4', b: '#efe5cf', c: '#dbcba8', sila: 0.4, textura: 'kvetiny' },
    kraft: { nazev: 'Balicí papír (kraft)', a: '#cdab7e', b: '#ba9662', c: '#9a7545', sum: '.14 .14', sila: 0.55, textura: 'kraft' },
    cisty: { nazev: 'Čistý bílý', a: '#ffffff', b: '#ffffff', c: '#ffffff' }
  };
  P.OKRAJE = { rovny: 'Rovný', natrzeny: 'Natržený', ohoreny: 'Ohořelý' };
  P.INKOUSTY = { '#3d2714': 'Sépiová hnědá', '#141414': 'Černá', '#1f2b4a': 'Duběnková modročerná', '#6e1a12': 'Rudá', '#2f4a2a': 'Lesní zelená' };
  P.VOSKY = { cervena: ['Červený vosk', '#c3412b', '#7d1a10'], zelena: ['Zelený vosk', '#3f7a3a', '#1d3f1b'], cerna: ['Černý vosk', '#4a4a4a', '#111'], zlata: ['Zlatý vosk', '#d9b24a', '#7a5a14'], modra: ['Modrý vosk', '#3a5fa0', '#16294d'] };
  P.RAMECKY = {
    zadny: 'Bez rámečku', jednoduchy: 'Jednoduchá linka', dvojity: 'Dvojitá linka', trojity: 'Silná a tenká linka',
    rohy: 'Ozdobné rohy', rohyLinka: 'Linka a ozdobné rohy', rohyHranate: 'Hranaté rohy s tečkou',
    tecky: 'Tečkovaný', carky: 'Čárkovaný', perlicky: 'Perličky', vlnovka: 'Vlnovka',
    pletenec: 'Pletenec (copánek)', meandr: 'Meandr (řecký vzor)', listy: 'Úponky s lístky', zuby: 'Zoubky (pilka)', kosticky: 'Šachovnice'
  };
  P.INICIALY = { zadna: 'Bez iniciály', inkoust: 'Iniciála inkoustem', cervena: 'Červená iniciála (rubrika)' };
  P.SIFRY = {
    zadna: 'Bez šifry', caesar: 'Caesarova šifra', atbash: 'Atbaš (obrácená abeceda)', vigenere: 'Vigenèrova šifra (heslo)',
    zrcadlo: 'Zrcadlové písmo', pozpatku: 'Pozpátku (každý řádek)'
  };

  P.vychozi = () => ({
    nadpis: 'Listina', text: '', podpis: '', datum: '',
    pismo: 'imfell', pismoNadpisu: 'uncial', pismoIniciala: 'nadpis', velikost: 15, radkovani: 1.5, zarovnani: 'left', inicialy: 'cervena',
    sifra: 'zadna', posun: 3, heslo: '', prepis: 'zadny',
    klic: 'zadny', rozsahKlice: 'abeceda',
    format: 'a4', papir: 'pergamen', okraj: 'natrzeny', starnuti: 50, seed: 7, inkoust: '#3d2714',
    ramecek: 'rohy', pecet: true, znakPecete: '✦', vosk: 'cervena',
    pecetStyl: 'kapka', pecetVel: 24, stuha: 'zadna', pecetX: null, pecetY: null,
    okrajNahore: 22, okrajDole: 20, okrajBoky: 22, inkoustStari: 0,
    // poničení listu
    preklad: 'zadne', zmackani: 0, kanky: 0, diry: 0, roh: 'zadny', foxing: 0, otisk: false, vybledle: 0, seedPosk: 3,
    voda: 0, pripaleni: 0, trhliny: 0, mastnota: 0, ozehnuti: 0,
    // pero a ruka
    pero: 0, rozpiti: 0, rukopis: 0, vodoznak: 'zadny', vodoznakSila: 50,
    // pečeť: vlastní semínko tvaru vosku, obrázek jako hloubkotisk (id v IndexedDB)
    pecetSeed: 0, pecetObr: null, pecetInv: false, pecetHloubka: 55,
    // další listy, rub, obálka (střih)
    dalsi: [], rub: null, obalka: null,
    // sazba: sloupce textu, odsazení 1. řádku a mezera odstavců (em), prostrkání (setiny em), číslování dalších listů
    sloupce: 1, odsazeni: 0, mezeraOdst: 0.8, prostrkani: 0, cislovani: 'zadne',
    // výstup: rozlišení PNG/PDF, jen inkoust bez papíru; hromadné listiny: tabulka jako text (první řádek = sloupce)
    vystupDpi: 300, bezPapiru: false, dataText: '',
    obrazky: []   // [{id, x, y, w (mm), rot (°), op (0–1), blend 'normal'|'multiply', vrstva 'pred'|'za'}]
  });
  /* Vzhled bez textu – co se ukládá do vlastní šablony vzhledu. */
  P.KLICE_VZHLEDU = ['pismo', 'pismoNadpisu', 'pismoIniciala', 'velikost', 'radkovani', 'zarovnani', 'inicialy', 'format', 'papir', 'okraj', 'starnuti',
    'inkoust', 'inkoustStari', 'preklad', 'zmackani', 'kanky', 'diry', 'roh', 'foxing', 'otisk', 'vybledle', 'ramecek', 'pecet', 'znakPecete', 'vosk', 'pecetStyl', 'pecetVel', 'stuha', 'okrajNahore', 'okrajDole', 'okrajBoky',
    'voda', 'pripaleni', 'trhliny', 'mastnota', 'ozehnuti', 'pero', 'rozpiti', 'rukopis', 'vodoznak', 'vodoznakSila', 'pecetInv', 'pecetHloubka',
    'sloupce', 'odsazeni', 'mezeraOdst', 'prostrkani', 'cislovani'];
  P.vzhled = d => Object.fromEntries(P.KLICE_VZHLEDU.map(k => [k, d[k]]));
  /* ---------- poničení listu ----------
     Vrací { prekryv: SVG přes celý list (lomy, zmačkání, kaňky, otisk, skvrnky, vybledlé místo,
     ohořelé okraje děr), maska: SVG pro CSS mask (díry a utržený roh – je jimi vidět skrz) }. */
  P.PREKLADY = { zadne: 'Nepřeložený', pul: 'Napůl', tretiny: 'Na třetiny (dopis)', ctvrtky: 'Na čtvrtky' };
  P.ROHY = { zadny: 'Žádný', lh: 'Levý horní', ph: 'Pravý horní', ld: 'Levý dolní', pd: 'Pravý dolní' };
  /* Inkoustová kaňka: kruh s náhodnými výběžky (cákanci), hladce spojený. */
  function cakanec(cx, cy, r, rng) {
    const n = 26, rr = Array.from({ length: n }, () => r * (0.75 + rng() * 0.25));
    for (let k = 0, m = 3 + Math.floor(rng() * 5); k < m; k++) { const i = Math.floor(rng() * n); rr[i] *= 1.35 + rng() * 0.9; rr[(i + 1) % n] *= 1.1; }
    const b = rr.map((q, i) => { const u = i / n * Math.PI * 2; return [cx + Math.cos(u) * q, cy + Math.sin(u) * q]; });
    let dd = `M${f(b[0][0])} ${f(b[0][1])}`;
    for (let i = 0; i < n; i++) {
      const p0 = b[(i + n - 1) % n], p1 = b[i], p2 = b[(i + 1) % n], p3 = b[(i + 2) % n];
      dd += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
    }
    return dd + 'Z';
  }
  /* Vodní skvrny (stejné pro překryv i pro rozpitý inkoust ve filtru textu): [{d, cx, cy}]. */
  P.vodniSkvrny = function (d, w, h) {
    const k = (+d.voda || 0) / 100; if (!k) return [];
    const rng = P.rng(((d.seedPosk || 3) * 977 + 5) >>> 0), out = [];
    for (let i = 0, n = 1 + Math.round(k * 2.4); i < n; i++) {
      const cx = 10 + rng() * (w - 20), cy = 10 + rng() * (h - 20), r = 10 + rng() * (14 + 26 * k);
      out.push({ d: kanka(cx, cy, r, rng), cx, cy });
      if (rng() < 0.6) { const u = rng() * 6.3, x = cx + Math.cos(u) * r * 0.7, y = cy + Math.sin(u) * r * 0.7; out.push({ d: kanka(x, y, r * (0.35 + rng() * 0.35), rng), cx: x, cy: y }); }
    }
    return out;
  };
  /* Maska vodních skvrn pro filtr textu (bílé = rozpité). */
  P.vodaMaskaSvg = (d, w, h, rub) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="none"><filter id="m"><feGaussianBlur stdDeviation="1.2"/></filter><g filter="url(#m)" fill="#fff"${rub ? ` transform="translate(${w} 0) scale(-1 1)"` : ''}>${P.vodniSkvrny(d, w, h).map(v => `<path d="${v.d}"/>`).join('')}</g></svg>`;
  /* volby.rub = zadní strana listu: všechno zrcadlově a inkoust z líce jen prosvítá. */
  P.poskozeni = function (d, w, h, volby) {
    const rub = !!(volby && volby.rub);
    const rng = P.rng((d.seedPosk || 3) * 131 + 7), ink = /^#[0-9a-f]{6}$/i.test(d.inkoust || '') ? d.inkoust : '#3d2714', ik = rub ? 0.25 : 1;
    let s = '', defs = '', maska = '';
    // vybledlé sluncem – jedna strana vyšisovaná
    if (d.vybledle) {
      const k = d.vybledle / 100, strana = Math.floor(rng() * 4), sm = [['0', '0', '1', '0'], ['1', '0', '0', '0'], ['0', '0', '0', '1'], ['0', '1', '0', '0']][strana];
      defs += `<linearGradient id="pkSlunce" x1="${sm[0]}" y1="${sm[2]}" x2="${sm[1]}" y2="${sm[3]}"><stop offset="0" stop-color="#fffaf0" stop-opacity="${f(0.5 * k)}"/><stop offset=".5" stop-color="#fffaf0" stop-opacity="${f(0.08 * k)}"/><stop offset="1" stop-color="#fffaf0" stop-opacity="0"/></linearGradient>`;
      s += `<rect width="${w}" height="${h}" fill="url(#pkSlunce)"/>`;
    }
    // skvrnky stáří (foxing) – rezavé tečky ve shlucích
    if (d.foxing) {
      const shluku = Math.round(2 + d.foxing / 100 * 14);
      for (let i = 0; i < shluku; i++) {
        const cx = rng() * w, cy = rng() * h, n = 3 + Math.floor(rng() * 9);
        for (let j = 0; j < n; j++) s += `<circle cx="${f(cx + (rng() - 0.5) * 14)}" cy="${f(cy + (rng() - 0.5) * 14)}" r="${f(0.25 + rng() * rng() * 1.6)}" fill="#8a4b1c" opacity="${f(0.12 + rng() * 0.3 * (0.5 + d.foxing / 200))}"/>`;
      }
    }
    // zmačkání – reliéf z šumu osvětlený zboku, násobí se s listem
    if (d.zmackani) {
      const k = d.zmackani / 100;
      defs += `<filter id="pkMackani" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${f(0.03 + k * 0.03)}" numOctaves="3" seed="${(d.seedPosk || 3) % 97}" result="t"/>`
        + `<feDiffuseLighting in="t" surfaceScale="${f(1.5 + k * 4)}" lighting-color="#fff" result="l"><feDistantLight azimuth="235" elevation="${f(62 - k * 18)}"/></feDiffuseLighting>`
        + `<feComponentTransfer in="l"><feFuncA type="linear" slope="0" intercept="${f(0.25 + k * 0.45)}"/></feComponentTransfer></filter>`;
      s += `<rect width="${w}" height="${h}" filter="url(#pkMackani)" style="mix-blend-mode:multiply" opacity="${f(0.35 + k * 0.3)}"/>`;
      // ostré lomy po zmačkání: lomené čáry přes list, tmavá rýha a světlá hrana vedle
      const lomu = Math.round(6 + k * 30);
      let tm = '', sv = '';
      for (let i = 0; i < lomu; i++) {
        let x = rng() * w, y = rng() * h, u = rng() * Math.PI * 2, dd = `M${f(x)} ${f(y)}`, ds = `M${f(x + 0.4)} ${f(y + 0.4)}`;
        for (let j = 0, m = 2 + Math.floor(rng() * 4); j < m; j++) { u += (rng() - 0.5) * 1.1; const l = 8 + rng() * 40 * (0.5 + k); x += Math.cos(u) * l; y += Math.sin(u) * l; dd += `L${f(x)} ${f(y)}`; ds += `L${f(x + 0.4)} ${f(y + 0.4)}`; }
        tm += dd; sv += ds;
      }
      s += `<path d="${tm}" fill="none" stroke="#4a2c10" stroke-opacity="${f(0.1 + k * 0.14)}" stroke-width=".3" stroke-linejoin="bevel"/><path d="${sv}" fill="none" stroke="#fff" stroke-opacity="${f(0.15 + k * 0.2)}" stroke-width=".35" stroke-linejoin="bevel"/>`;
    }
    // přeložení – lom: měkký stín, tmavá rýha a světlá hrana
    const lom = (x1, y1, x2, y2) => {
      const svisly = x1 === x2;
      const pas = svisly ? `<rect x="${f(x1 - 3)}" y="0" width="6" height="${h}" fill="url(#pkLom${svisly ? 'S' : 'V'})"/>` : `<rect x="0" y="${f(y1 - 3)}" width="${w}" height="6" fill="url(#pkLomV)"/>`;
      return pas + `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="#4a2c10" stroke-opacity=".28" stroke-width=".35"/>`
        + `<line x1="${f(x1 + (svisly ? 0.45 : 0))}" y1="${f(y1 + (svisly ? 0 : 0.45))}" x2="${f(x2 + (svisly ? 0.45 : 0))}" y2="${f(y2 + (svisly ? 0 : 0.45))}" stroke="#fff" stroke-opacity=".45" stroke-width=".3"/>`;
    };
    if (d.preklad !== 'zadne') {
      defs += '<linearGradient id="pkLomS" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a3412" stop-opacity="0"/><stop offset=".5" stop-color="#5a3412" stop-opacity=".16"/><stop offset=".56" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
        + '<linearGradient id="pkLomV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a3412" stop-opacity="0"/><stop offset=".5" stop-color="#5a3412" stop-opacity=".16"/><stop offset=".56" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>';
      const nasirku = w > h;
      if (d.preklad === 'pul') s += nasirku ? lom(w / 2, 0, w / 2, h) : lom(0, h / 2, w, h / 2);
      if (d.preklad === 'tretiny') s += nasirku ? lom(w / 3, 0, w / 3, h) + lom(w * 2 / 3, 0, w * 2 / 3, h) : lom(0, h / 3, w, h / 3) + lom(0, h * 2 / 3, w, h * 2 / 3);
      if (d.preklad === 'ctvrtky') s += lom(w / 2, 0, w / 2, h) + lom(0, h / 2, w, h / 2);
    }
    // kaňky a cákance inkoustu
    if (d.kanky) {
      const pocet = Math.max(1, Math.round(d.kanky / 100 * 5));
      for (let i = 0; i < pocet; i++) {
        const x = 15 + rng() * (w - 30), y = 15 + rng() * (h - 30), r = 2 + rng() * (3 + d.kanky / 100 * 6);
        s += `<path d="${cakanec(x, y, r, rng)}" fill="${ink}" opacity="${f((0.78 + rng() * 0.17) * ik)}"/>`;
        const u0 = rng() * Math.PI * 2;
        for (let j = 0, m = 4 + Math.floor(rng() * 10); j < m; j++) {   // cákance hlavně jedním směrem
          const u = u0 + (rng() - 0.5) * 1.6, vz = r * (1.2 + rng() * 2.2);
          s += `<circle cx="${f(x + Math.cos(u) * vz)}" cy="${f(y + Math.sin(u) * vz)}" r="${f(0.15 + rng() * rng() * r * 0.25)}" fill="${ink}" opacity="${f(0.85 * ik)}"/>`;
        }
      }
    }
    // otisk prstu od inkoustu – soustředné přerušované elipsy
    if (d.otisk) {
      const x = 20 + rng() * (w - 40), y = 20 + rng() * (h - 40), rot = Math.round(rng() * 360);
      defs += `<clipPath id="pkPrst"><ellipse cx="0" cy="0" rx="7.5" ry="10"/></clipPath>`;
      let kr = '';
      for (let i = 1; i <= 14; i++) {
        const dash = `${f(1.5 + rng() * 6)} ${f(0.3 + rng() * 0.8)}`;
        kr += `<ellipse cx="${f((rng() - 0.5) * 0.6)}" cy="${f(1 + (rng() - 0.5) * 0.6)}" rx="${f(i * 0.62)}" ry="${f(i * 0.78)}" fill="none" stroke="${ink}" stroke-width=".28" stroke-dasharray="${dash}"/>`;
      }
      s += `<g transform="translate(${f(x)} ${f(y)}) rotate(${rot})" opacity="${f(0.45 * ik)}" clip-path="url(#pkPrst)">${kr}</g>`;
    }
    const uplnyFiltr = (id, sd) => `<filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}"><feGaussianBlur stdDeviation="${sd}"/></filter>`;
    // voda: zaschlé skvrny s tmavším okrajem (zátokou), uvnitř druhý slabší okraj
    const vody = P.vodniSkvrny(d, w, h);
    if (vody.length) {
      defs += uplnyFiltr('pkVoda', 0.35);
      for (const v of vody) s += `<path d="${v.d}" fill="#9a7a40" opacity=".06"/><g filter="url(#pkVoda)" fill="none" stroke="#7a5424"><path d="${v.d}" stroke-width=".55" opacity=".4"/>`
        + `<path d="${v.d}" stroke-width=".3" opacity=".18" transform="translate(${f(v.cx)} ${f(v.cy)}) scale(.9) translate(${f(-v.cx)} ${f(-v.cy)})"/></g>`;
    }
    // ožehnutí jedné strany od plamene: soustředné vrstvy od kraje dovnitř, nepravidelná hranice
    if (d.ozehnuti) {
      const k = d.ozehnuti / 100, r2 = P.rng(((d.seedPosk || 3) * 613 + 29) >>> 0), strana = Math.floor(r2() * 4);
      const L = strana % 2 ? h : w, hloubka = 6 + k * 34, vlny = [1, 2.3, 4.7, 9.1, 17.3].map((q, i) => [q, r2() * 6.3, (0.2 + r2() * 0.3) / Math.sqrt(i + 1)]);
      const bodStr = (t, o) => [[t, o], [w - o, t], [w - t, h - o], [o, h - t]][strana];
      defs += uplnyFiltr('pkOzeh', 2.2);
      const vrstvy = [['#a5712f', 1, 0.16], ['#8a5220', 0.78, 0.22], ['#5e3010', 0.55, 0.32], ['#331805', 0.33, 0.48], ['#160902', 0.15, 0.7]];
      s += '<g filter="url(#pkOzeh)">' + vrstvy.map(([c, mer, op]) => {
        let dd = '';
        for (let t = -6; t <= L + 6; t += 3) {
          const u = t / L * Math.PI * 2, sum = vlny.reduce((a, [q, fz, am]) => a + Math.sin(u * q + fz) * am, 0);
          const [x, y] = bodStr(t, Math.max(0.5, hloubka * mer * Math.max(0.15, 0.75 + sum)));
          dd += (dd ? 'L' : 'M') + f(x) + ' ' + f(y);
        }
        const [x1, y1] = bodStr(L + 6, -6), [x0, y0] = bodStr(-6, -6);
        return `<path d="${dd}L${f(x1)} ${f(y1)}L${f(x0)} ${f(y0)}Z" fill="${c}" opacity="${op}"/>`;
      }).join('') + '</g>';
    }
    // připálení od svíčky: zhnědlé místo bez díry, ke středu tmavší
    if (d.pripaleni) {
      const r2 = P.rng(((d.seedPosk || 3) * 389 + 13) >>> 0);
      defs += uplnyFiltr('pkPal1', 2.2) + uplnyFiltr('pkPal2', 1) + uplnyFiltr('pkPal3', 0.45);
      for (let i = 0; i < d.pripaleni; i++) {
        const x = 15 + r2() * (w - 30), y = 15 + r2() * (h - 30), r = 3 + r2() * 6;
        s += `<path d="${kanka(x, y, r * 2.3, r2)}" fill="#a8742e" opacity=".16" filter="url(#pkPal1)"/>`
          + `<path d="${kanka(x, y, r * 1.5, r2)}" fill="#7a4416" opacity=".26" filter="url(#pkPal2)"/>`
          + `<path d="${kanka(x, y, r, r2)}" fill="#3e1c06" opacity=".42" filter="url(#pkPal2)"/>`
          + `<path d="${kanka(x, y, r * 0.5, r2)}" fill="#1a0a02" opacity=".5" filter="url(#pkPal3)"/>`;
      }
    }
    // mastná skvrna: zažloutlá, průsvitnější (v masce šedě) se zřetelnějším okrajem
    const mastne = [];
    if (d.mastnota) {
      const k = d.mastnota / 100, r2 = P.rng(((d.seedPosk || 3) * 241 + 17) >>> 0);
      for (let i = 0, n = 1 + Math.round(k); i < n; i++) mastne.push(kanka(15 + r2() * (w - 30), 15 + r2() * (h - 30), 7 + r2() * (6 + 14 * k), r2));
      defs += uplnyFiltr('pkMast', 0.8);
      for (const m of mastne) s += `<path d="${m}" fill="#c9a14a" opacity="${f(0.1 + k * 0.1)}" filter="url(#pkMast)"/><path d="${m}" fill="none" stroke="#a07a2a" stroke-width=".6" opacity=".22" filter="url(#pkMast)"/>`;
    }
    // natržení od okraje: úzká zubatá škvíra (v masce) zužující se dovnitř, vlákna na hranách
    const trhliny = [];
    if (d.trhliny) {
      const r2 = P.rng(((d.seedPosk || 3) * 769 + 3) >>> 0);
      let vlakna = '', obrysy = '';
      for (let i = 0; i < d.trhliny; i++) {
        const strana = Math.floor(r2() * 4), t = 0.15 + r2() * 0.7, delka = 12 + r2() * 30, sir = 1 + r2() * 1.8;
        const [x0, y0, ux, uy] = [[t * w, -2, 0, 1], [w + 2, t * h, -1, 0], [t * w, h + 2, 0, -1], [-2, t * h, 1, 0]][strana];
        const uhel = Math.atan2(uy, ux) + (r2() - 0.5) * 0.8;
        let x = x0, y = y0, u = uhel; const lev = [], prav = [];
        const kroku = Math.round(delka / 1.4);
        for (let j = 0; j <= kroku; j++) {
          const g = sir * (1 - j / kroku), nx = -Math.sin(u), ny = Math.cos(u);
          lev.push([x + nx * (g / 2 + (r2() - 0.5) * 0.35), y + ny * (g / 2 + (r2() - 0.5) * 0.35)]);
          prav.push([x - nx * (g / 2 + (r2() - 0.5) * 0.35), y - ny * (g / 2 + (r2() - 0.5) * 0.35)]);
          if (j && r2() < 0.5) vlakna += `M${f(lev[j][0])} ${f(lev[j][1])}l${f((r2() - 0.5) * 1.4)} ${f((r2() - 0.5) * 1.4)}`;
          u += (r2() - 0.5) * 0.5; x += Math.cos(u) * 1.4; y += Math.sin(u) * 1.4;
        }
        const tv = 'M' + lev.concat(prav.reverse()).map(([a, b]) => f(a) + ' ' + f(b)).join('L') + 'Z';
        trhliny.push(tv); obrysy += tv;
      }
      s += `<path d="${obrysy}" fill="none" stroke="#5a3a1a" stroke-width=".5" opacity=".3" stroke-linejoin="round"/><path d="${vlakna}" fill="none" stroke="#fffaf0" stroke-width=".18" opacity=".8" stroke-linecap="round"/>`;
    }
    // propálené díry a utržený roh – v masce černě (průhledné), přes ně ohořelý okraj
    const otvory = [];
    for (let i = 0; i < d.diry; i++) {
      const x = 18 + rng() * (w - 36), y = 18 + rng() * (h - 36), r = 2.5 + rng() * 6;
      otvory.push(kanka(x, y, r, rng));
    }
    if (d.roh !== 'zadny') {
      const vel = Math.min(w, h) * (0.12 + rng() * 0.08), [cx, cy, sx, sy] = { lh: [0, 0, 1, 1], ph: [w, 0, -1, 1], ld: [0, h, 1, -1], pd: [w, h, -1, -1] }[d.roh];
      let p = `M${cx - sx * 2} ${cy - sy * 2}L${f(cx + sx * vel)} ${cy - sy * 2}`;
      for (let i = 1; i < 14; i++) { const t = i / 14, z = (rng() - 0.5) * 2.4; p += `L${f(cx + sx * vel * (1 - t) + sx * z)} ${f(cy + sy * vel * t * 1.15 + sy * z)}`; }
      p += `L${cx - sx * 2} ${f(cy + sy * vel * 1.15)}Z`;
      otvory.push(p);
    }
    if (otvory.length || trhliny.length || mastne.length) {
      // spálenina jako ofset okraje „do ztracena“: soustředné tahy od světle hnědé po černou u okraje
      // (vnitřní polovina tahů leží v díře a maska ji odřízne); oblast rozmazání = celý list, ať nevznikne čtverec
      if (otvory.length) defs += uplnyFiltr('pkOhor', 0.7);
      const vrstvy = [['#9a6428', 18, 0.07], ['#8a5220', 13, 0.1], ['#6e3c12', 9, 0.15], ['#4e260a', 6, 0.24], ['#2e1405', 3.6, 0.4], ['#180a02', 1.9, 0.62]];
      for (const o of otvory) {
        s += `<g filter="url(#pkOhor)" stroke-linejoin="round" fill="none">${vrstvy.map(([c, sw, op]) => `<path d="${o}" stroke="${c}" stroke-width="${sw}" opacity="${op}"/>`).join('')}</g>`
          + `<path d="${o}" fill="none" stroke="#100702" stroke-width=".6" opacity=".9" stroke-linejoin="round"/>`;
      }
      // maska pracuje s alfou: list = plocha, díry = otvory v jedné cestě (evenodd)
      // mastná místa jsou v masce šedá (průsvitná) – maska v masce, díry zůstanou úplně průhledné
      const zrc = rub ? ` transform="translate(${w} 0) scale(-1 1)"` : '';
      const mm = mastne.length ? `<defs><filter id="mf"><feGaussianBlur stdDeviation="1"/></filter><mask id="mm" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#fff"/><g filter="url(#mf)" fill="#c8c8c8">${mastne.map(m => `<path d="${m}"/>`).join('')}</g></mask></defs>` : '';
      maska = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}mm" height="${h}mm" preserveAspectRatio="none">${mm}<g${zrc}><path fill="#fff" fill-rule="evenodd"${mm ? ' mask="url(#mm)"' : ''} d="M0 0H${w}V${h}H0Z${otvory.join('')}${trhliny.join('')}"/></g></svg>`;
    }
    if (!s) return { prekryv: '', maska };
    if (rub) s = `<g transform="translate(${w} 0) scale(-1 1)">${s}</g>`;
    const prekryv = `<svg xmlns="http://www.w3.org/2000/svg" class="poskozeni-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><defs>${defs}</defs>${s}</svg>`;
    // volby.id = předpona id – víc listů v jedné stránce nesmí sdílet id přechodů a filtrů
    const px = volby && volby.id ? String(volby.id).replace(/[^\w-]/g, '') : '';
    return { prekryv: px ? prekryv.replace(/(id="|url\(#)pk/g, `$1pk${px}-`) : prekryv, maska };
  };

  /* Filtr inkoustu (SVG pro CSS filter na textu listu). st = stáří 0–100 (roztřepený tah, vybledlá
     místa); v = { pero (dochází inkoust – slábne a po namočení zesílí), rozpiti (vpíjí se do vláken),
     rukopis (neklidná ruka – vlnité řádky, rozkolísaná písma), voda + vodaSvg (data URL masky vodních
     skvrn, text v nich rozmazaný a vybledlý), ox, oy, w, h = poloha textu v listu a list v px }. */
  const k01 = x => Math.max(0, Math.min(100, +x || 0)) / 100;
  P.inkoustEfekty = d => !!(d.inkoustStari || d.pero || d.rozpiti || d.rukopis || d.voda);
  P.filtrInkoustu = function (st, seed, v) {
    v = v || {};
    const k = k01(st), sem = (seed || 1) >>> 0, kp = k01(v.pero), kr = k01(v.rozpiti), kh = k01(v.rukopis), kv = k01(v.voda);
    let s = '', vstup = 'SourceGraphic', c = 0;
    const vystup = () => 'f' + (++c);
    if (kh) {
      s += `<feTurbulence type="fractalNoise" baseFrequency=".005 .035" numOctaves="2" seed="${(sem * 3) % 89}" result="rh"/>`
        + `<feDisplacementMap in="${vstup}" in2="rh" scale="${f(kh * 10)}" xChannelSelector="R" yChannelSelector="G" result="${vstup = vystup()}"/>`
        + `<feTurbulence type="fractalNoise" baseFrequency=".08" numOctaves="1" seed="${(sem * 5) % 83}" result="rh2"/>`
        + `<feDisplacementMap in="${vstup}" in2="rh2" scale="${f(kh * 2.6)}" xChannelSelector="R" yChannelSelector="G" result="${vstup = vystup()}"/>`;
    }
    if (k) {
      s += `<feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="2" seed="${sem % 97}" result="t"/>`
        + `<feDisplacementMap in="${vstup}" in2="t" scale="${f(k * 2.2)}" xChannelSelector="R" yChannelSelector="G" result="d"/>`
        + `<feTurbulence type="fractalNoise" baseFrequency=".035 .06" numOctaves="3" seed="${(sem * 7) % 89}" result="m"/>`
        + `<feColorMatrix in="m" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${f(-k * 1.3)} 0 0 0 ${f(1 + k * 0.25)}" result="maska"/>`
        + `<feComposite in="d" in2="maska" operator="in" result="${vstup = vystup()}"/>`;
    }
    if (kp) {   // protažený šum: po řádku dlouhé úseky silného a slabého tahu
      s += `<feTurbulence type="fractalNoise" baseFrequency=".004 .07" numOctaves="2" seed="${(sem * 11) % 79}" result="pn"/>`
        + `<feColorMatrix in="pn" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${f(kp * 4)} 0 0 0 ${f(1 - kp * 2.3)}" result="pm"/>`
        + `<feComposite in="${vstup}" in2="pm" operator="in" result="${vstup = vystup()}"/>`;
    }
    if (kr) {   // roztřepený lem kolem tahů pod ostrým písmem
      s += `<feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="1" seed="${(sem * 13) % 73}" result="rn"/>`
        + `<feGaussianBlur in="${vstup}" stdDeviation="${f(0.4 + kr * 1.1)}" result="rb"/>`
        + `<feDisplacementMap in="rb" in2="rn" scale="${f(1 + kr * 3)}" xChannelSelector="R" yChannelSelector="G" result="rd"/>`
        + `<feComponentTransfer in="rd" result="ra"><feFuncA type="linear" slope="${f(0.35 + kr * 0.6)}"/></feComponentTransfer>`
        + `<feMerge result="${vystup()}"><feMergeNode in="ra"/><feMergeNode in="${vstup}"/></feMerge>`;
      vstup = 'f' + c;
    }
    if (kv && v.vodaSvg) {
      s += `<feImage href="${v.vodaSvg}" x="${f(-(v.ox || 0))}" y="${f(-(v.oy || 0))}" width="${f(v.w || 794)}" height="${f(v.h || 1123)}" preserveAspectRatio="none" result="vm"/>`
        + `<feGaussianBlur in="${vstup}" stdDeviation="${f(0.6 + kv * 1.8)}" result="vb"/>`
        + `<feComponentTransfer in="vb" result="vb2"><feFuncA type="linear" slope="${f(1 - kv * 0.4)}"/></feComponentTransfer>`
        + `<feComposite in="vb2" in2="vm" operator="in" result="vin"/><feComposite in="${vstup}" in2="vm" operator="out" result="vout"/>`
        + `<feMerge result="${vystup()}"><feMergeNode in="vout"/><feMergeNode in="vin"/></feMerge>`;
    }
    if (!s) s = '<feOffset dx="0" dy="0"/>';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="${esc(v.id || 'inkoustStary')}" x="-2%" y="-2%" width="104%" height="104%" color-interpolation-filters="sRGB">${s}</filter></svg>`;
  };
  P.PECETI = { kapka: 'Rozteklý vosk', kulata: 'Kulatá', vroubkovana: 'Vroubkovaná' };
  P.STUHY = { zadna: 'Bez stuhy', cervena: ['Červená stuha', '#9c1f1f', '#5e0f0f'], modra: ['Modrá stuha', '#24427a', '#122445'], zlata: ['Zlatá stuha', '#c9a03c', '#7a5a14'], zelena: ['Zelená stuha', '#2f6a3a', '#173a1e'], cerna: ['Černá stuha', '#2a2a2a', '#0c0c0c'] };
  /* Číslování dalších listů (první list se nečísluje). */
  P.CISLOVANI = { zadne: 'bez čísel', arabske: '– 2 –', rimske: 'II' };
  P.rimske = function (n) {
    let s = '';
    for (const [h, z] of [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]) while (n >= h) { s += z; n -= h; }
    return s;
  };
  P.cisloListu = (druh, n) => (druh === 'rimske' ? P.rimske(n) : druh === 'arabske' ? `– ${n} –` : '');

  /* ---------- hromadné listiny ----------
     Tabulka jako text: z Excelu tabulátory, CSV středníkem nebo čárkou (podle prvního řádku), uvozovky
     kolem buněk s oddělovačem. První řádek = názvy sloupců, prázdné řádky se vynechají, nejvýš 500 záznamů. */
  P.rozeberData = function (text) {
    const t = String(text || '').replace(/\r\n?/g, '\n'), prvni = t.split('\n')[0];
    const odd = prvni.includes('\t') ? '\t' : prvni.includes(';') ? ';' : ',';
    const radky = []; let bunka = '', radek = [], uvoz = false;
    const konecRadku = () => { radek.push(bunka.trim()); radky.push(radek); radek = []; bunka = ''; };
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (uvoz) { if (c !== '"') bunka += c; else if (t[i + 1] === '"') { bunka += '"'; i++; } else uvoz = false; }
      else if (c === '"' && !bunka) uvoz = true;
      else if (c === odd) { radek.push(bunka.trim()); bunka = ''; }
      else if (c === '\n') konecRadku();
      else bunka += c;
    }
    konecRadku();
    const plne = radky.filter(r => r.some(Boolean)), sloupce = (plne.shift() || []).map(x => x.slice(0, 40));
    return { sloupce, radky: plne.slice(0, 500).map(r => sloupce.map((_, i) => r[i] || '')) };
  };
  /* Dosadí pole {sloupec} hodnotou i-tého záznamu (na velikosti písmen nezáleží). {číslo} = pořadí
     záznamu, {počet} = počet záznamů. Neznámé pole zůstane, jak je. */
  const POLE = /\{([^{}\n]{1,40})\}/g, klicPole = x => String(x).trim().toLowerCase();
  const CISLO = ['číslo', 'cislo', 'number'], POCET = ['počet', 'pocet', 'count'];   // vestavěná pole (i anglicky – rozhraní je přeložené)
  P.dosad = function (text, tab, i) {
    const t = String(text == null ? '' : text), r = tab && tab.radky[i];
    if (!r || t.indexOf('{') < 0) return t;
    return t.replace(POLE, (cele, n) => {
      const k = klicPole(n), sl = tab.sloupce.findIndex(x => x && klicPole(x) === k);
      return sl >= 0 ? r[sl] : CISLO.includes(k) ? String(i + 1) : POCET.includes(k) ? String(tab.radky.length) : cele;
    });
  };
  /* Pole z textu, která v tabulce chybí (překlep v názvu sloupce). */
  P.neznamaPole = function (text, tab) {
    const zname = new Set([...tab.sloupce.map(klicPole), ...CISLO, ...POCET]);
    return [...new Set([...String(text || '').matchAll(POLE)].map(m => m[1].trim()))].filter(n => !zname.has(klicPole(n)));
  };

  P.normalizuj = function (x) {
    const d = Object.assign(P.vychozi(), x || {});
    if (!P.FORMATY[d.format]) d.format = 'a4';
    if (!P.PAPIRY[d.papir]) d.papir = 'pergamen';
    if (!P.OKRAJE[d.okraj]) d.okraj = 'natrzeny';
    if (!P.SIFRY[d.sifra]) d.sifra = 'zadna';
    if (!P.RAMECKY[d.ramecek]) d.ramecek = 'zadny';
    if (!P.VOSKY[d.vosk]) d.vosk = 'cervena';
    if (!P.INICIALY[d.inicialy]) d.inicialy = d.inicialy === false ? 'zadna' : 'cervena';
    if (!['left', 'justify', 'center'].includes(d.zarovnani)) d.zarovnani = 'left';
    if (typeof d.html !== 'string' || !d.html.trim()) d.html = P.htmlZTextu(d.text);
    if (!['nadpis', 'text'].includes(d.pismoIniciala)) d.pismoIniciala = 'nadpis';
    for (const k of ['nadpisHtml', 'podpisHtml', 'datumHtml']) if (typeof d[k] !== 'string') delete d[k];
    if (!['left', 'center', 'right'].includes(d.nadpisZar)) d.nadpisZar = 'center';
    if (!P.PECETI[d.pecetStyl]) d.pecetStyl = 'kapka';
    if (!P.STUHY[d.stuha]) d.stuha = 'zadna';
    d.pecetVel = Math.max(10, Math.min(60, +d.pecetVel || 24));
    for (const [k, v] of [['okrajNahore', 22], ['okrajDole', 20], ['okrajBoky', 22]]) d[k] = Math.max(4, Math.min(90, d[k] == null || isNaN(+d[k]) ? v : +d[k]));
    d.inkoustStari = Math.max(0, Math.min(100, +d.inkoustStari || 0));
    if (!P.PREKLADY[d.preklad]) d.preklad = 'zadne';
    if (!P.ROHY[d.roh]) d.roh = 'zadny';
    for (const k of ['zmackani', 'kanky', 'foxing', 'vybledle', 'voda', 'mastnota', 'ozehnuti', 'pero', 'rozpiti', 'rukopis']) d[k] = Math.max(0, Math.min(100, +d[k] || 0));
    d.diry = Math.max(0, Math.min(5, Math.round(+d.diry || 0)));
    for (const k of ['pripaleni', 'trhliny']) d[k] = Math.max(0, Math.min(4, Math.round(+d[k] || 0)));
    if (!P.VODOZNAKY[d.vodoznak]) d.vodoznak = 'zadny';
    d.vodoznakSila = Math.max(10, Math.min(100, d.vodoznakSila == null || isNaN(+d.vodoznakSila) ? 50 : +d.vodoznakSila));
    d.pecetSeed = (+d.pecetSeed >>> 0) || (((d.seed >>> 0) || 7) * 7 + 1) >>> 0;
    d.pecetObr = typeof d.pecetObr === 'string' && /^o[a-z0-9]+$/i.test(d.pecetObr) ? d.pecetObr : null;
    d.pecetInv = !!d.pecetInv;
    d.pecetHloubka = Math.max(0, Math.min(100, d.pecetHloubka == null || isNaN(+d.pecetHloubka) ? 55 : +d.pecetHloubka));
    const htmlListu = x => (x && typeof x.html === 'string' ? x.html : '<p><br></p>');
    d.dalsi = (Array.isArray(d.dalsi) ? d.dalsi : []).filter(x => x && typeof x === 'object').slice(0, 20).map(x => ({ html: htmlListu(x) }));
    d.rub = d.rub && typeof d.rub === 'object' ? { html: htmlListu(d.rub) } : null;
    d.obalka = d.obalka && typeof d.obalka === 'object' ? { html: htmlListu(d.obalka), pecet: d.obalka.pecet !== false } : null;
    d.otisk = !!d.otisk; d.seedPosk = (+d.seedPosk >>> 0) || 3;
    d.sloupce = Math.max(1, Math.min(3, Math.round(+d.sloupce || 1)));
    d.odsazeni = Math.max(0, Math.min(4, +d.odsazeni || 0));
    d.mezeraOdst = Math.max(0, Math.min(3, d.mezeraOdst == null || isNaN(+d.mezeraOdst) ? 0.8 : +d.mezeraOdst));
    d.prostrkani = Math.max(-5, Math.min(30, +d.prostrkani || 0));
    if (!P.CISLOVANI[d.cislovani]) d.cislovani = 'zadne';
    d.vystupDpi = [150, 300, 600].includes(+d.vystupDpi) ? +d.vystupDpi : 300;
    d.bezPapiru = !!d.bezPapiru;
    d.dataText = typeof d.dataText === 'string' ? d.dataText.slice(0, 200000) : '';
    // obrázky z IndexedDB (id) a kresby perem (kresba – šipky, kroužky…, poznámka s textem)
    d.obrazky = (Array.isArray(d.obrazky) ? d.obrazky : []).filter(o => o && (typeof o.id === 'string' || P.KRESBY[o.kresba])).map(o => {
      const x = { x: +o.x || 0, y: +o.y || 0, w: Math.max(3, +o.w || 40), rot: +o.rot || 0,
        op: Math.max(0.05, Math.min(1, o.op == null ? 1 : +o.op)), blend: o.blend === 'normal' ? 'normal' : 'multiply', vrstva: o.vrstva === 'za' ? 'za' : 'pred' };
      if (o.zamek) x.zamek = true;   // zamčená poloha – nejde táhnout
      if (P.KRESBY[o.kresba]) Object.assign(x, { kresba: o.kresba, seed: (+o.seed >>> 0) || 1, text: String(o.text || '').slice(0, 500), vel: Math.max(5, Math.min(40, +o.vel || 11)) });
      else x.id = o.id;
      return x;
    });
    if (!/^#[0-9a-f]{6}$/i.test(d.inkoust)) d.inkoust = '#3d2714';
    d.velikost = Math.max(6, Math.min(72, +d.velikost || 15));
    d.radkovani = Math.max(0.9, Math.min(3, +d.radkovani || 1.5));
    d.starnuti = Math.max(0, Math.min(100, +d.starnuti || 0));
    return d;
  };

  /* ---------- šifrování ----------
     Pořadí: šifra (Caesar, Atbaš, Vigenère z Dílny výprav; pozpátku po
     řádcích) → přepis do jiného písma (fonty/prepis.js). Zrcadlo dělá CSS. */
  const V = () => G.VYPRAVA;
  const PR = () => (typeof PREPIS !== 'undefined' ? PREPIS : G.PREPIS);
  /* start = kolik písmen zprávy už bylo zašifrováno před tímto kouskem textu – Vigenère pak
     pokračuje ve správném místě hesla i přes hranice formátování (text je rozdělený do uzlů). */
  P.sifruj = function (text, d, start) {
    let t = String(text || '').normalize('NFC');
    if (d.sifra === 'caesar') t = V().sifruj('caesar', t, { posun: d.posun }).zapis;
    else if (d.sifra === 'atbash') t = V().sifruj('atbash', t, {}).zapis;
    else if (d.sifra === 'vigenere') {
      const h = V().jenPismena(d.heslo), k = h.length ? (start || 0) % h.length : 0;
      t = V().sifruj('vigenere', t, { heslo: h.slice(k) + h.slice(0, k) }).zapis;
    }
    else if (d.sifra === 'pozpatku') t = t.split('\n').map(r => [...r].reverse().join('')).join('\n');
    const pr = PR();
    if (d.prepis && d.prepis !== 'zadny' && pr && pr.SEZNAM.some(x => x.id === d.prepis)) t = pr.preved(d.prepis, t);
    return t;
  };
  P.pocetPismen = t => V().jenPismena(String(t || '').normalize('NFC')).length;

  /* Text → HTML odstavců (pro staré záznamy a ukázky; dál se píše rovnou do listu). */
  P.htmlZTextu = t => String(t || '').split(/\n\s*\n/).map(o => o.trim()).filter(Boolean)
    .map(o => '<p>' + esc(o).replace(/\n/g, '<br>') + '</p>').join('') || '<p><br></p>';

  /* Chyby a upozornění nastavení šifry. */
  P.kontrola = function (d) {
    const out = [];
    if (d.sifra === 'vigenere' && !V().jenPismena(d.heslo)) out.push('Vigenèrova šifra potřebuje heslo (jen písmena).');
    if (d.sifra === 'caesar' && !(((+d.posun % 26) + 26) % 26)) out.push('Posun 0 nebo 26 nic nezašifruje.');
    if (['caesar', 'atbash', 'vigenere'].includes(d.sifra) && /[ěščřžýáíéůúťďň]/i.test(d.text)) out.push('Šifra nezná háčky a čárky – text se zašifruje bez nich a velkými písmeny.');
    if (d.klic !== 'zadny' && d.sifra === 'zadna' && (!d.prepis || d.prepis === 'zadny') && d.pismo === 'imfell') out.push('Klíč dává smysl, když je text psaný jiným písmem nebo šifrou – teď by klíč ukazoval jen stejná písmena.');
    return out;
  };

  /* Klíč: dvojice [otevřený znak, jak ho hráč uvidí]. rozsah 'abeceda' | 'pouzite'.
     Vigenère se po znacích převést nedá – vrátí null (klíčem je heslo). */
  const ABECEDA_CS = [...'aábcčdďeéěfghijklmnňoópqrřsštťuúůvwxyýzž'];
  const ABECEDA_AZ = [...'abcdefghijklmnopqrstuvwxyz'];
  P.klic = function (d) {
    if (d.sifra === 'vigenere') return null;
    const bezDia = ['caesar', 'atbash'].includes(d.sifra);
    let znaky = (bezDia ? ABECEDA_AZ : ABECEDA_CS).concat([...'0123456789']);
    if (d.rozsahKlice === 'pouzite') {
      const v = new Set([...(bezDia ? V().bezDiakritiky(d.text) : d.text).toLowerCase()]);
      znaky = znaky.filter(c => v.has(c));
    }
    const out = [];
    for (const c of znaky) {
      const z = P.sifruj(c, Object.assign({}, d, { sifra: d.sifra === 'pozpatku' ? 'zadna' : d.sifra }));
      // šifra bez přepisu nechává číslice beze změny – takové dvojice klíč jen zahlcují
      const jenSifra = d.sifra !== 'zadna' && (!d.prepis || d.prepis === 'zadny');
      if (z.trim() && !(jenSifra && z.toLowerCase() === c)) out.push([bezDia ? c.toUpperCase() : c, z]);
    }
    return out;
  };

  /* ---------- papír jako SVG ----------
     Rozměry v mm (viewBox), okraj natržený/ohořelý podle semínka, skvrny
     a ztmavení okrajů podle stárnutí 0–100. */
  P.rng = function (seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  };
  function obrys(w, h, rng, roztrepeni) {
    const b = [], krok = 3.2, a = roztrepeni ? 3 : 0;
    const kraj = (x0, y0, x1, y1) => {
      const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / krok));
      for (let i = 0; i < n; i++) {
        const t = i / n, nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny);
        const o = roztrepeni ? (rng() - 0.5) * 2.4 + (rng() < 0.06 ? -2.5 * rng() : 0) : 0;
        b.push(`${f(x0 + (x1 - x0) * t + nx / l * o)},${f(y0 + (y1 - y0) * t + ny / l * o)}`);
      }
    };
    kraj(a, a, w - a, a); kraj(w - a, a, w - a, h - a); kraj(w - a, h - a, a, h - a); kraj(a, h - a, a, a);
    return b.join(' ');
  }
  /* Nepravidelná kaňka: uzavřená hladká křivka přes body s náhodným poloměrem
     (sousedé se průměrují, ať nevznikají ostny), protažená a natočená. */
  function kanka(cx, cy, r, rng) {
    const n = 11 + Math.floor(rng() * 8), syrove = [];
    for (let i = 0; i < n; i++) syrove.push(0.4 + rng() * 0.9);
    const rr = syrove.map((x, i) => (syrove[(i + n - 1) % n] + 2 * x + syrove[(i + 1) % n]) / 4);
    const prot = 0.65 + rng() * 0.7, rot = rng() * Math.PI;
    const b = rr.map((k, i) => {
      const u = i / n * Math.PI * 2, px = Math.cos(u) * r * k * prot, py = Math.sin(u) * r * k / prot;
      return [cx + px * Math.cos(rot) - py * Math.sin(rot), cy + px * Math.sin(rot) + py * Math.cos(rot)];
    });
    let dd = `M${f(b[0][0])} ${f(b[0][1])}`;
    for (let i = 0; i < n; i++) {
      const p0 = b[(i + n - 1) % n], p1 = b[i], p2 = b[(i + 1) % n], p3 = b[(i + 2) % n];
      dd += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
    }
    return dd + 'Z';
  }
  P.kanka = kanka;

  /* Struktura papíru: vlákna, žebrování, pásy papyru, lístky… (vlastní semínko, ať se skvrny nemění). */
  function vlakno(x, y, delka, uhel, zvlneni, rng) {
    const dx = Math.cos(uhel) * delka, dy = Math.sin(uhel) * delka, nx = -dy / delka, ny = dx / delka;
    const o1 = (rng() - 0.5) * zvlneni * delka, o2 = (rng() - 0.5) * zvlneni * delka;
    return `M${f(x)} ${f(y)}C${f(x + dx / 3 + nx * o1)} ${f(y + dy / 3 + ny * o1)} ${f(x + dx * 2 / 3 + nx * o2)} ${f(y + dy * 2 / 3 + ny * o2)} ${f(x + dx)} ${f(y + dy)}`;
  }
  function textura(typ, w, h, rng) {
    let s = '';
    const tahy = (n, fn, barva, sirka, op) => {   // n vláken jedním <path> (menší SVG)
      let dd = ''; for (let i = 0; i < n; i++) dd += fn();
      return `<path d="${dd}" fill="none" stroke="${barva}" stroke-width="${sirka}" stroke-linecap="round" opacity="${op}"/>`;
    };
    const plocha = w * h / 10000;   // na A4 ≈ 6,2
    switch (typ) {
      case 'washi':   // dlouhá zakroucená vlákna, světlá i tmavší, místy chomáčky
        s += tahy(Math.round(40 * plocha), () => vlakno(rng() * w, rng() * h, 8 + rng() * 26, rng() * Math.PI * 2, 0.9, rng), '#ffffff', 0.35, 0.75);
        s += tahy(Math.round(28 * plocha), () => vlakno(rng() * w, rng() * h, 6 + rng() * 22, rng() * Math.PI * 2, 1.1, rng), '#b9a679', 0.18, 0.35);
        break;
      case 'bambus':   // jemné svislé linky a vlákna podél nich
        for (let x = rng(); x < w; x += 0.6 + rng() * 0.9) s += `<line x1="${f(x)}" y1="0" x2="${f(x + (rng() - 0.5) * 2)}" y2="${h}" stroke="#8a7a40" stroke-width="${f(0.08 + rng() * 0.15)}" opacity="${f(0.04 + rng() * 0.07)}"/>`;
        s += tahy(Math.round(30 * plocha), () => vlakno(rng() * w, rng() * h, 5 + rng() * 18, Math.PI / 2 + (rng() - 0.5) * 0.25, 0.3, rng), '#9a8a4c', 0.22, 0.25);
        s += tahy(Math.round(10 * plocha), () => vlakno(rng() * w, rng() * h, 3 + rng() * 8, Math.PI / 2 + (rng() - 0.5) * 0.4, 0.4, rng), '#5e5228', 0.3, 0.2);
        break;
      case 'papyrus': {   // vodorovná vrstva pásů, přes ni svislá; vláknité linky
        for (let y = 0; y < h;) { const v = 5 + rng() * 9; s += `<rect x="0" y="${f(y)}" width="${w}" height="${f(v)}" fill="${rng() < 0.5 ? '#fff4d2' : '#9c7f42'}" opacity="${f(0.05 + rng() * 0.08)}"/><line x1="0" y1="${f(y)}" x2="${w}" y2="${f(y + (rng() - 0.5) * 2)}" stroke="#7d6232" stroke-width=".25" opacity=".25"/>`; y += v; }
        for (let x = 0; x < w;) { const v = 6 + rng() * 10; s += `<rect x="${f(x)}" y="0" width="${f(v)}" height="${h}" fill="${rng() < 0.5 ? '#fff4d2' : '#8f723a'}" opacity="${f(0.03 + rng() * 0.05)}"/>`; x += v; }
        s += tahy(Math.round(70 * plocha), () => vlakno(rng() * w, rng() * h, 10 + rng() * 40, (rng() < 0.6 ? 0 : Math.PI / 2) + (rng() - 0.5) * 0.06, 0.05, rng), '#7a5e2c', 0.2, 0.22);
        break;
      }
      case 'verge':   // husté žebrování (laid lines) a řídké řetízkové linky – síto ručního papíru
        s += `<rect width="${w}" height="${h}" fill="url(#zebra)"/><rect width="${w}" height="${h}" fill="url(#retizek)"/>`;
        break;
      case 'len':   // jemná tkaninová mřížka
        s += `<rect width="${w}" height="${h}" fill="url(#tkanina)"/>`;
        s += tahy(Math.round(10 * plocha), () => vlakno(rng() * w, rng() * h, 3 + rng() * 6, rng() * 6.3, 0.6, rng), '#8c7b55', 0.15, 0.3);
        break;
      case 'kvetiny': {   // ruční papír s lístky a vlákny
        s += tahy(Math.round(25 * plocha), () => vlakno(rng() * w, rng() * h, 4 + rng() * 14, rng() * 6.3, 1, rng), '#a08b5c', 0.18, 0.3);
        const barvy = ['#c46a78', '#d99a5b', '#7f9a55', '#a8b56a', '#b05a3a', '#e3c26a'];
        for (let i = 0; i < 12 * plocha; i++) {
          const x = rng() * w, y = rng() * h, rx = 0.6 + rng() * 2.2, ry = rx * (0.35 + rng() * 0.4);
          s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" transform="rotate(${Math.round(rng() * 180)} ${f(x)} ${f(y)})" fill="${barvy[Math.floor(rng() * barvy.length)]}" opacity="${f(0.35 + rng() * 0.35)}"/>`;
        }
        break;
      }
      case 'kraft':   // tmavé tečky a světlejší třísky
        for (let i = 0; i < 70 * plocha; i++) s += `<circle cx="${f(rng() * w)}" cy="${f(rng() * h)}" r="${f(0.08 + rng() * 0.3)}" fill="#3e2a12" opacity="${f(0.25 + rng() * 0.4)}"/>`;
        s += tahy(Math.round(30 * plocha), () => vlakno(rng() * w, rng() * h, 1.5 + rng() * 5, rng() * 6.3, 0.5, rng), '#e8cfa0', 0.25, 0.4);
        break;
      case 'velin':   // jemné „žilky“ a místa po chlupech kůže
        s += tahy(Math.round(1.5 * plocha), () => vlakno(rng() * w, rng() * h, 30 + rng() * 80, rng() * 6.3, 0.5, rng), '#8a5a2a', 0.6, 0.07);
        for (let i = 0; i < 6 * plocha; i++) { const x = rng() * w, y = rng() * h; for (let k = 0; k < 6; k++) s += `<circle cx="${f(x + (rng() - 0.5) * 5)}" cy="${f(y + (rng() - 0.5) * 5)}" r=".18" fill="#6b4a28" opacity=".25"/>`; }
        break;
    }
    return s;
  }

  /* Vodoznak: tenčí místo v papíru (světlejší, proti světlu zřetelné) – obrysy v poli 100×100. */
  P.VODOZNAKY = {
    zadny: 'Bez vodoznaku', koruna: 'Koruna', lilie: 'Lilie', roh: 'Poštovní roh', kotva: 'Kotva', srdce: 'Srdce', hrozen: 'Hrozen', kriz: 'Kříž v kruhu'
  };
  const VODOZNAK_TVARY = {
    koruna: 'M18 72L12 34L32 52L50 22L68 52L88 34L82 72ZM18 80H82M50 22v-6M46 18h8M12 34a3 3 0 1 0 0 .1M88 34a3 3 0 1 0 0 .1M30 64h40',
    lilie: 'M50 10C40 26 40 44 50 60C60 44 60 26 50 10ZM50 60C38 42 20 40 16 52C14 60 22 64 26 58M50 60C62 42 80 40 84 52C86 60 78 64 74 58M30 64H70M50 64C46 76 42 84 36 90M50 64C54 76 58 84 64 90M50 64V92',
    roh: 'M14 58C14 36 34 26 50 26C70 26 82 38 84 54L94 46V74L84 66C80 78 66 82 54 80C40 78 36 66 44 58C52 50 64 58 60 66M14 58C14 70 24 78 32 74M30 26V16M24 16H36',
    kotva: 'M50 12a6 6 0 1 0 0 .1M50 24V88M34 34H66M16 62C18 80 34 90 50 88C66 90 82 80 84 62M10 66L16 58L24 64M90 66L84 58L76 64',
    srdce: 'M50 86C20 64 10 46 18 30C26 16 44 18 50 34C56 18 74 16 82 30C90 46 80 64 50 86ZM50 34V10M42 16H58',
    hrozen: 'M50 10V22M44 16H56M40 28a7 7 0 1 0 0 .1M60 28a7 7 0 1 0 0 .1M32 42a7 7 0 1 0 0 .1M50 42a7 7 0 1 0 0 .1M68 42a7 7 0 1 0 0 .1M40 56a7 7 0 1 0 0 .1M60 56a7 7 0 1 0 0 .1M50 70a7 7 0 1 0 0 .1M64 18C74 10 84 14 86 22',
    kriz: 'M50 8a42 42 0 1 0 0 84a42 42 0 1 0 0-84ZM50 18V82M22 44H78'
  };
  P.papirSvg = function (d) {
    const F = P.FORMATY[d.format] || P.FORMATY.a4, w = F.w, h = F.h, rng = P.rng(d.seed || 1);
    const pap = P.PAPIRY[d.papir] || P.PAPIRY.pergamen, cisty = d.papir === 'cisty';
    const st = (d.starnuti || 0) / 100, roz = d.okraj !== 'rovny';
    const tvar = obrys(w, h, rng, roz);
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}mm" height="${h}mm" preserveAspectRatio="none">`
      + `<defs><radialGradient id="g" cx="45%" cy="40%" r="75%"><stop offset="0" stop-color="${pap.a}"/><stop offset=".6" stop-color="${pap.b}"/><stop offset="1" stop-color="${pap.c}"/></radialGradient>`
      + `<filter id="n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${pap.sum || '.09 .14'}" numOctaves="4" seed="${(d.seed || 1) % 997}"/>`
      + `<feColorMatrix values="0 0 0 0 .5  0 0 0 0 .34  0 0 0 0 .15  0 0 0 ${f((0.35 + st * 0.35) * (pap.sila || 1))} -.1"/><feComposite in2="SourceGraphic" operator="in"/></filter>`
      + `<filter id="sk" x="-40%" y="-40%" width="180%" height="180%"><feTurbulence type="fractalNoise" baseFrequency=".22" numOctaves="2" seed="${((d.seed || 1) * 7) % 991}"/>`
      + `<feDisplacementMap in="SourceGraphic" scale="3.2" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation=".45"/></filter>`
      + `<filter id="rozpite" x="-60%" y="-60%" width="220%" height="220%"><feTurbulence type="fractalNoise" baseFrequency=".08" numOctaves="3" seed="${((d.seed || 1) * 13) % 983}"/>`
      + `<feDisplacementMap in="SourceGraphic" scale="9" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="2.2"/></filter>`
      + `<filter id="r" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="${d.okraj === 'ohoreny' ? 2.2 : 1.2}"/></filter>`
      + `<radialGradient id="v" cx="50%" cy="50%" r="72%"><stop offset="${f(0.62 - st * 0.12)}" stop-color="#5a3210" stop-opacity="0"/><stop offset="1" stop-color="#4a2808" stop-opacity="${f(0.15 + st * 0.5)}"/></radialGradient>`
      + `<pattern id="zebra" width="${w}" height=".9" patternUnits="userSpaceOnUse"><rect width="${w}" height=".22" fill="#8a7650" opacity=".09"/></pattern>`
      + `<pattern id="retizek" width="24" height="${h}" patternUnits="userSpaceOnUse"><rect x="11.8" width=".45" height="${h}" fill="#8a7650" opacity=".13"/></pattern>`
      + `<pattern id="tkanina" width=".7" height=".7" patternUnits="userSpaceOnUse"><rect width=".7" height=".16" fill="#8c7b55" opacity=".1"/><rect width=".16" height=".7" fill="#8c7b55" opacity=".08"/></pattern>`
      + `<filter id="vz" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation=".6"/></filter>`
      + `<clipPath id="c"><polygon points="${tvar}"/></clipPath></defs>`;
    if (d.zrcadlit) s += `<g transform="translate(${w} 0) scale(-1 1)">`;   // rub listu
    s += `<polygon points="${tvar}" fill="${cisty ? '#fff' : 'url(#g)'}"/>`;
    if (!cisty) {
      s += `<g clip-path="url(#c)"><rect width="${w}" height="${h}" fill="#000" filter="url(#n)"/>`;
      if (pap.textura) s += textura(pap.textura, w, h, P.rng(((d.seed || 1) * 31 + 5) >>> 0));
      // rozlité skvrny: několik překrývajících se nepravidelných kaněk (nestejný tón), slabý zaschlý
      // okraj jen u některých, rozpité „mapy“ bez okraje a kapky kolem; mohou přetékat přes okraj listu
      const skvrn = Math.round(st * 9);
      for (let i = 0; i < skvrn; i++) {
        const x = -8 + rng() * (w + 16), y = -8 + rng() * (h + 16), r = 6 + rng() * 20, o = 0.06 + rng() * 0.07;
        const druh = rng();
        if (druh < 0.3) {   // rozpitá mapa – měkká, bez okraje
          s += `<path d="${kanka(x, y, r * 1.2, rng)}" fill="#8a5a24" opacity="${f(o * 1.3)}" filter="url(#rozpite)"/>`;
          continue;
        }
        s += '<g filter="url(#sk)">';
        const casti = 2 + Math.floor(rng() * 3);
        for (let c = 0; c < casti; c++) {
          const u = rng() * Math.PI * 2, vz = c ? r * (0.2 + rng() * 0.45) : 0, k = c ? 0.45 + rng() * 0.45 : 1;
          const tv = kanka(x + Math.cos(u) * vz, y + Math.sin(u) * vz, r * k, rng);
          s += `<path d="${tv}" fill="#8a5a24" opacity="${f(o)}"/>`;
          if (!c && druh > 0.55) s += `<path d="${tv}" fill="none" stroke="#6a3c10" stroke-width="${f(0.25 + rng() * 0.45)}" opacity="${f(o * 1.6)}"/>`;
        }
        const kapek = Math.floor(rng() * 7);
        for (let k = 0; k < kapek; k++) {
          const u = rng() * Math.PI * 2, vz = r * (1 + rng() * 0.9);
          s += `<path d="${kanka(x + Math.cos(u) * vz, y + Math.sin(u) * vz, 0.3 + rng() * 1.4, rng)}" fill="#7a4a18" opacity="${f(o * 1.8)}"/>`;
        }
        s += '</g>';
      }
      s += `<rect width="${w}" height="${h}" fill="url(#v)"/>`;
      if (VODOZNAK_TVARY[d.vodoznak]) {   // světlejší tenčí místo, slabě rozmazané, s tmavším lemem
        const m = Math.min(w, h) * 0.5 / 100, k = (d.vodoznakSila || 50) / 100;
        s += `<g transform="translate(${f(w / 2 - 50 * m)} ${f(h * 0.45 - 50 * m)}) scale(${f(m)})" fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#vz)">`
          + `<path d="${VODOZNAK_TVARY[d.vodoznak]}" stroke="#7a5a2a" stroke-width="5.5" opacity="${f(0.05 * k)}"/><path d="${VODOZNAK_TVARY[d.vodoznak]}" stroke="#fffdf4" stroke-width="3.2" opacity="${f(0.55 * k)}"/></g>`;
      }
      if (d.okraj === 'ohoreny') s += `<polygon points="${tvar}" fill="none" stroke="#2a1404" stroke-width="5" opacity=".75" filter="url(#r)"/><polygon points="${tvar}" fill="none" stroke="#1a0c02" stroke-width="1.2" opacity=".9"/>`;
      else if (roz) s += `<polygon points="${tvar}" fill="none" stroke="#6b4318" stroke-width="2" opacity=".35" filter="url(#r)"/>`;
      s += '</g>';
    } else s += `<polygon points="${tvar}" fill="none" stroke="#bbb" stroke-width=".3"/>`;
    if (d.zrcadlit) s += '</g>';
    return s + '</svg>';
  };
  P.papirDataUrl = d => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(P.papirSvg(d));

  /* Pečeť jako SVG (vkládá se přímo do listu, ať znak použije písmo stránky):
     vosk rozlitý pokaždé jinak (o.seedTvaru – laloky, stékající cíp, kapky kolem),
     vtlačený otisk mírně mimo střed a pootočený, v něm znak nebo obrázek jako hloubkotisk
     (o.obrazek = data URL z P.reliefPixely), lesk a volitelná stuha. velikost = průměr vosku v mm. */
  const hladka = b => {   // uzavřená hladká křivka (Catmull-Rom → Bézier) přes body
    const n = b.length; let dd = `M${f(b[0][0])} ${f(b[0][1])}`;
    for (let i = 0; i < n; i++) {
      const p0 = b[(i + n - 1) % n], p1 = b[i], p2 = b[(i + 1) % n], p3 = b[(i + 2) % n];
      dd += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
    }
    return dd + 'Z';
  };
  /* Poloměry okraje vosku po obvodu (n bodů kolem středu 50,50). Rozteklý: pomalé zvlnění ze
     tří vln s náhodnou fází, 1–4 laloky, občas dlouhý stékající cíp; ražené tvary jen mírně. */
  P.okrajVosku = function (styl, sem, n) {
    const rng = P.rng((sem >>> 0) * 7919 + 11), rr = new Array(n).fill(0);
    const volne = styl === 'kapka';
    const vlny = [[2, volne ? 1.5 + rng() * 2.5 : 0.6], [3, volne ? 1 + rng() * 2 : 0.4], [5, volne ? 0.5 + rng() * 1.2 : 0.3]].map(([k, a]) => [k, a, rng() * Math.PI * 2]);
    for (let i = 0; i < n; i++) { const u = i / n * Math.PI * 2; rr[i] = (volne ? 41.5 : 44) + vlny.reduce((s, [k, a, fz]) => s + Math.sin(u * k + fz) * a, 0) + (rng() - 0.5) * (volne ? 0.9 : 0.3); }
    const laloku = volne ? 1 + Math.floor(rng() * 4) : Math.floor(rng() * 2);
    for (let k = 0; k < laloku; k++) {
      const i0 = Math.floor(rng() * n), sirka = 2 + rng() * (volne ? 5 : 2), vys = (volne ? 3 + rng() * 6 : 1 + rng() * 1.5);
      for (let j = -12; j <= 12; j++) rr[(i0 + j + n) % n] += vys * Math.exp(-(j * j) / (2 * sirka * sirka));
    }
    if (volne && rng() < 0.6) {   // stékající cíp – úzký a dlouhý
      const i0 = Math.floor(rng() * n), vys = 6 + rng() * 6;
      for (let j = -4; j <= 4; j++) rr[(i0 + j + n) % n] += vys * Math.exp(-(j * j) / 2.2);
    }
    return rr.map(r => Math.max(36, Math.min(55, r)));
  };
  P.pecetSvg = function (o) {
    const V = P.VOSKY[o.vosk] || P.VOSKY.cervena, a = V[1], b = V[2], sem = (o.seedTvaru || o.seed || 1) >>> 0, rng = P.rng(sem * 17 + 3);
    const id = 'pc' + (sem % 99991) + (o.vosk || '') + (o.styl || '') + (o.stuha || '') + (o.obrazek ? 'r' : ''), st = P.STUHY[o.stuha];
    const volne = o.styl !== 'kulata' && o.styl !== 'vroubkovana';
    const n = 48, rr = P.okrajVosku(o.styl, sem, n);
    const bod = (r, i) => { const u = i / n * Math.PI * 2; return [50 + Math.cos(u) * r, 50 + Math.sin(u) * r]; };
    const tvar = hladka(rr.map(bod));
    // otisk razidla – kousek mimo střed a pootočený (rozteklý víc)
    const ox = 50 + (rng() - 0.5) * (volne ? 6 : 2), oy = 50 + (rng() - 0.5) * (volne ? 6 : 2), rot = (rng() - 0.5) * (volne ? 34 : 10);
    // kapky kolem: 0–5, u okraje, různě velké
    let kapky = '';
    const kapek = volne ? Math.floor(rng() * 6) : Math.floor(rng() * 2);
    for (let i = 0; i < kapek; i++) {
      const j = Math.floor(rng() * n), r = Math.min(54, rr[j] + 1.5 + rng() * 4), [x, y] = bod(r, j), q = 0.9 + rng() * rng() * 3.2;
      kapky += `<path d="${P.kanka(x, y, q, rng)}" fill="url(#${id}g)"/>`;
    }
    let stuha = '';
    if (st && Array.isArray(st)) {
      const pas = (x1, rot) => `<g transform="rotate(${rot} 50 50)"><path d="M${x1} 52L${x1 + 12} 52L${x1 + 15} 104L${x1 + 6} 97L${x1 - 3} 104Z" fill="url(#${id}s)" stroke="${st[2]}" stroke-width=".6"/></g>`;
      stuha = pas(30, 12) + pas(48, -14);
    }
    // okraj otisku podle stylu razidla
    let okrajOtisku = '';
    if (o.styl === 'kulata') okrajOtisku = `<g fill="#000" fill-opacity=".25">${Array.from({ length: 36 }, (_, i) => { const u = i / 36 * Math.PI * 2; return `<circle cx="${f(50 + Math.cos(u) * 35.5)}" cy="${f(50 + Math.sin(u) * 35.5)}" r=".9"/>`; }).join('')}</g>`;
    else if (o.styl === 'vroubkovana') { let dd = ''; for (let i = 0; i <= 64; i++) { const u = i / 64 * Math.PI * 2, r = i % 2 ? 33.6 : 35.4; dd += (i ? 'L' : 'M') + f(50 + Math.cos(u) * r) + ' ' + f(50 + Math.sin(u) * r); } okrajOtisku = `<path d="${dd}Z" fill="none" stroke="#000" stroke-opacity=".28" stroke-width=".8"/>`; }
    const znak = esc(o.znak || '✦'), velZnaku = [...(o.znak || '✦')].length > 1 ? 30 : 40;
    const pis = o.pismo ? ` style="font-family:${esc(o.pismo)}"` : '';
    const otisk = o.obrazek
      ? `<image href="${esc(o.obrazek)}" x="18" y="18" width="64" height="64" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id}k)"/>`
      : `<g text-anchor="middle" dominant-baseline="central" font-size="${velZnaku}"${pis}>`
        + `<text x="50.8" y="51.2" fill="#000" fill-opacity=".45">${znak}</text>`
        + `<text x="49.3" y="49.4" fill="#fff" fill-opacity=".3">${znak}</text>`
        + `<text x="50" y="50.3" fill="${b}">${znak}</text></g>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 112 ${st && Array.isArray(st) ? 124 : 112}" class="pecet-svg" aria-hidden="true">`
      + `<defs><radialGradient id="${id}g" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${b}"/></radialGradient>`
      + `<radialGradient id="${id}v" cx="58%" cy="60%" r="60%"><stop offset="0" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></radialGradient>`
      + (st && Array.isArray(st) ? `<linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${st[2]}"/><stop offset=".5" stop-color="${st[1]}"/><stop offset="1" stop-color="${st[2]}"/></linearGradient>` : '')
      + `<clipPath id="${id}k"><circle cx="50" cy="50" r="31.6"/></clipPath>`
      + `<filter id="${id}st" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx=".6" dy="1.4" stdDeviation="1.3" flood-color="#000" flood-opacity=".45"/></filter>`
      + `<filter id="${id}b"><feGaussianBlur stdDeviation="2.2"/></filter><filter id="${id}m" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation=".9"/></filter></defs>`
      + stuha
      + `<g filter="url(#${id}st)"><path d="${tvar}" fill="url(#${id}g)"/>${kapky}</g>`
      // zaoblená hrana rozlitého vosku: tmavší obrys a světlý lem uvnitř
      + `<path d="${tvar}" fill="none" stroke="${b}" stroke-width="1.4" opacity=".55"/>`
      + `<path d="${tvar}" fill="none" stroke="#fff" stroke-width="1.6" opacity=".16" transform="translate(50 50) scale(.955) translate(-50 -50)" filter="url(#${id}m)"/>`
      + `<g transform="translate(${f(ox - 50)} ${f(oy - 50)}) rotate(${f(rot)} 50 50)">`
      // vosk vytlačený razidlem do valu kolem otisku
      + `<circle cx="50" cy="50" r="35" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="3" filter="url(#${id}m)"/>`
      // vtlačený kruh: tmavá hrana nahoře vlevo, světlá dole vpravo
      + `<circle cx="50" cy="50" r="32" fill="url(#${id}v)"/>`
      + otisk
      + `<circle cx="50" cy="50" r="32" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1.6" transform="translate(-.5 -.6)"/>`
      + `<circle cx="50" cy="50" r="32" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="1.2" transform="translate(.6 .7)"/>`
      + okrajOtisku + '</g>'
      // lesk vosku
      + `<ellipse cx="36" cy="28" rx="15" ry="8" fill="#fff" opacity=".22" transform="rotate(-30 36 28)" filter="url(#${id}b)"/>`
      + '</svg>';
  };

  /* Obrázek do vosku jako hloubkotisk. vyskaZPixelu: RGBA n×n → výšky 0–1 (tmavé = vystupuje,
     inv obrátí; průhledné = pozadí), mírně rozmazané (vosk nemá ostré hrany).
     reliefPixely: výšky → RGBA stínování (bílá = osvětlená strana, černá = stín; světlo zleva shora),
     které se položí přes barvu vosku. hloubka 0–100. */
  P.vyskaZPixelu = function (rgba, n, inv) {
    let h = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) {
      const al = rgba[i * 4 + 3] / 255, lum = (0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]) / 255;
      const v = al * lum + (1 - al);   // průhledné jako bílé pozadí
      h[i] = inv ? v : 1 - v;
    }
    for (let pruchod = 0; pruchod < 2; pruchod++) {   // dvakrát rámečkové rozmazání 3×3
      const g = new Float32Array(n * n);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        let s = 0, c = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < n && Y < n) { s += h[Y * n + X]; c++; } }
        g[y * n + x] = s / c;
      }
      h = g;
    }
    return h;
  };
  P.reliefPixely = function (h, n, hloubka) {
    const k = 1.5 + Math.max(0, Math.min(100, +hloubka || 0)) / 100 * 9, out = new Uint8ClampedArray(n * n * 4);
    let prumer = 0; for (let i = 0; i < n * n; i++) prumer += h[i]; prumer /= n * n;
    const H = (x, y) => h[Math.max(0, Math.min(n - 1, y)) * n + Math.max(0, Math.min(n - 1, x))];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const gx = H(x + 1, y) - H(x - 1, y), gy = H(x, y + 1) - H(x, y - 1);
      const v = (gx + gy) * k + (H(x, y) - prumer) * 0.18;   // svah ke světlu + vyšší místa světlejší
      const i = (y * n + x) * 4;
      if (v > 0) { out[i] = out[i + 1] = out[i + 2] = 255; out[i + 3] = Math.min(1, v) * 165; }
      else out[i + 3] = Math.min(1, -v) * 225;
    }
    return out;
  };

  /* ---------- úpravy obrázku (pixely) ----------
     n: { pruhledna: {zap, barva '#rrggbb', tolerance 0–100, mekkost 0–100}, jas −100…100,
     kontrast −100…100, rezim 'puvodni'|'cb'|'sepie'|'inkoust', inkoust '#rrggbb' }.
     data = RGBA (Uint8ClampedArray), mění se na místě. „Inkoust“ udělá z kresby
     jednobarevný tah: tmavé = krycí, světlé = průhledné (papír prosvítá). */
  const hexRgb = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); const v = m ? parseInt(m[1], 16) : 0; return [v >> 16 & 255, v >> 8 & 255, v & 255]; };
  P.hexRgb = hexRgb;
  P.VYCHOZI_OBRAZEK = () => ({ orez: null, rot: 0, zrcadlo: false, meritko: 1, pruhledna: { zap: false, barva: '#ffffff', tolerance: 12, mekkost: 10 }, jas: 0, kontrast: 0, rezim: 'puvodni', inkoust: '#3d2714' });
  P.zpracujPixely = function (data, n) {
    const pr = n.pruhledna || {}, [kr, kg, kb] = hexRgb(pr.barva), [ir, ig, ib] = hexRgb(n.inkoust);
    const tol = (pr.tolerance || 0) / 100 * 441.7, mek = Math.max(0.001, (pr.mekkost || 0) / 100 * 441.7);
    const c = Math.max(-99, Math.min(99, +n.kontrast || 0)) * 2.55, fk = (259 * (c + 255)) / (255 * (259 - c)), jas = (+n.jas || 0) * 1.28;
    const uprav = v => Math.max(0, Math.min(255, fk * (v - 128) + 128 + jas));
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (pr.zap) {
        const dist = Math.hypot(r - kr, g - kg, b - kb);
        if (dist <= tol) a = 0; else if (dist < tol + mek) a *= (dist - tol) / mek;
      }
      if (c || jas) { r = uprav(r); g = uprav(g); b = uprav(b); }
      if (n.rezim === 'cb') { r = g = b = 0.299 * r + 0.587 * g + 0.114 * b; }
      else if (n.rezim === 'sepie') { const R = r, G = g, B = b; r = Math.min(255, 0.393 * R + 0.769 * G + 0.189 * B); g = Math.min(255, 0.349 * R + 0.686 * G + 0.168 * B); b = Math.min(255, 0.272 * R + 0.534 * G + 0.131 * B); }
      else if (n.rezim === 'inkoust') { const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255; a *= Math.max(0, Math.min(1, (1 - lum) * 1.15)); r = ir; g = ig; b = ib; }
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
    }
    return data;
  };

  /* Rámeček stránky jako SVG přes celý list (mm). Vzory se kladou podél každé strany
     v celém počtu period (ať v rozích sedí) a rohy kryje růžice. */
  P.ramecekSvg = function (styl, w, h, barva) {
    const c = /^#[0-9a-f]{6}$/i.test(barva || '') ? barva : '#3d2714', m = 9;   // odsazení od kraje listu
    const x0 = m, y0 = m, x1 = w - m, y1 = h - m;
    const strany = [[x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]];
    const linka = (o, s) => `<rect x="${f(x0 + o)}" y="${f(y0 + o)}" width="${f(x1 - x0 - 2 * o)}" height="${f(y1 - y0 - 2 * o)}" fill="none" stroke="${c}" stroke-width="${s}"/>`;
    // vzor podél strany: fn(L, n) → body [délka, odsazení dovnitř] nebo hotová cesta
    const podel = (perioda, fn) => strany.map(([ax, ay, bx, by]) => {
      const L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L, nx = -uy, ny = ux;
      const n = Math.max(2, Math.round(L / perioda)), p = L / n;
      const bod = (t, o) => `${f(ax + ux * t + nx * o)} ${f(ay + uy * t + ny * o)}`;
      return fn(n, p, bod, L);
    }).join('');
    const ruzice = r => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${c}"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 1.7)}" fill="none" stroke="${c}" stroke-width=".3"/>`).join('');
    let g = '';
    switch (styl) {
      case 'trojity': g = linka(0, 1.1) + linka(1.6, 0.3); break;
      case 'rohyHranate': g = linka(1.5, 0.3) + [[x0, y0, 1, 1], [x1, y0, -1, 1], [x1, y1, -1, -1], [x0, y1, 1, -1]].map(([x, y, sx, sy]) =>
        `<path d="M${f(x + sx * 14)} ${f(y)}H${f(x)}V${f(y + sy * 14)}M${f(x + sx * 9)} ${f(y + sy * 3)}H${f(x + sx * 3)}V${f(y + sy * 9)}" fill="none" stroke="${c}" stroke-width=".7"/><circle cx="${f(x + sx * 5.5)}" cy="${f(y + sy * 5.5)}" r=".9" fill="${c}"/>`).join(''); break;
      case 'tecky': g = podel(2.2, (n, p, bod) => Array.from({ length: n }, (_, i) => { const [x, y] = bod(i * p, 0).split(' '); return `<circle cx="${x}" cy="${y}" r=".45" fill="${c}"/>`; }).join('')); break;
      case 'carky': g = `<rect x="${x0}" y="${y0}" width="${f(x1 - x0)}" height="${f(y1 - y0)}" fill="none" stroke="${c}" stroke-width=".55" stroke-dasharray="3 1.6"/>` + linka(2, 0.25); break;
      case 'perlicky': g = podel(3.2, (n, p, bod) => Array.from({ length: n }, (_, i) => { const [x, y] = bod(i * p, 0).split(' '); return `<circle cx="${x}" cy="${y}" r="1" fill="none" stroke="${c}" stroke-width=".35"/>`; }).join('')) + ruzice(1.2); break;
      case 'vlnovka': g = podel(7, (n, p, bod) => { let d = `M${bod(0, 0)}`; for (let i = 0; i < n * 8; i++) { const t = (i + 1) / 8 * p; d += `L${bod(t, Math.sin((i + 1) / 8 * 2 * Math.PI) * 1.3)}`; } return `<path d="${d}" fill="none" stroke="${c}" stroke-width=".45"/>`; }) + ruzice(1.3); break;
      case 'pletenec': g = podel(6, (n, p, bod) => [0, Math.PI].map(faze => { let d = `M${bod(0, Math.sin(faze) * 1.6)}`; for (let i = 0; i < n * 10; i++) { const t = (i + 1) / 10 * p; d += `L${bod(t, Math.sin((i + 1) / 10 * 2 * Math.PI + faze) * 1.6)}`; } return `<path d="${d}" fill="none" stroke="${c}" stroke-width="1.1" stroke-opacity=".25"/><path d="${d}" fill="none" stroke="${c}" stroke-width=".4"/>`; }).join('')) + linka(-2.6, 0.3) + linka(2.6, 0.3) + ruzice(1.4); break;
      case 'meandr': g = linka(-2.4, 0.4) + linka(2.4, 0.4) + podel(5, (n, p, bod) => {
        let d = '';
        for (let i = 0; i < n; i++) { const t = i * p, k = p / 5; d += `M${bod(t + k * .5, 2.4)}L${bod(t + k * .5, -1.2)}L${bod(t + k * 3.5, -1.2)}L${bod(t + k * 3.5, 1.2)}L${bod(t + k * 2, 1.2)}L${bod(t + k * 2, 0)}`; }
        return `<path d="${d}" fill="none" stroke="${c}" stroke-width=".45" stroke-linejoin="miter"/>`; }); break;
      case 'listy': g = podel(8, (n, p, bod) => {
        let d = `M${bod(0, 0)}`, lis = '';
        for (let i = 0; i < n * 8; i++) { const t = (i + 1) / 8 * p; d += `L${bod(t, Math.sin((i + 1) / 8 * 2 * Math.PI) * 1.4)}`; }
        for (let i = 0; i < n * 2; i++) {   // lístek na každém vrcholu vlny, střídavě ven a dovnitř
          const t = (i + 0.5) * p / 2, o = (i % 2 ? -1 : 1) * 1.4, [x, y] = bod(t, o).split(' '), [xa, ya] = bod(t + 0.8, o + (i % 2 ? -2.2 : 2.2)).split(' ');
          lis += `<path d="M${x} ${y}Q${f((+x + +xa) / 2 + 0.9)} ${f((+y + +ya) / 2 - 0.9)} ${xa} ${ya}Q${f((+x + +xa) / 2 - 0.9)} ${f((+y + +ya) / 2 + 0.9)} ${x} ${y}Z" fill="${c}" opacity=".75"/>`;
        }
        return `<path d="${d}" fill="none" stroke="${c}" stroke-width=".4"/>` + lis; }) + ruzice(1.3); break;
      case 'zuby': g = podel(3, (n, p, bod) => { let d = `M${bod(0, 0)}`; for (let i = 0; i < n; i++) d += `L${bod(i * p + p / 2, 1.6)}L${bod((i + 1) * p, 0)}`; return `<path d="${d}" fill="none" stroke="${c}" stroke-width=".4"/>`; }) + linka(-1, 0.5); break;
      case 'kosticky': g = podel(2.4, (n, p, bod) => Array.from({ length: n }, (_, i) => { const a = bod(i * p, i % 2 ? 0 : 1.2), b = bod((i + 1) * p, i % 2 ? 0 : 1.2), c2 = bod((i + 1) * p, i % 2 ? 1.2 : 2.4), d2 = bod(i * p, i % 2 ? 1.2 : 2.4); return `<path d="M${a}L${b}L${c2}L${d2}Z" fill="${c}" opacity=".8"/>`; }).join('')) + linka(0, 0.25) + linka(2.4, 0.25); break;
      default: return '';
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" class="ramecek-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${g}</svg>`;
  };

  /* Kresby perem na okraj listu (volné prvky jako obrázky): šipky, kroužky, svorka, křížek…
     a poznámka (text). Tahy se kreslí „rukou“ – podle semínka lehce rozkolísané a se dvěma
     tahy přes sebe; [název, poměr výška/šířka]. */
  P.KRESBY = {
    poznamka: ['Poznámka na okraj', 0], sipka: ['Šipka', 0.32], sipkaOblouk: ['Zahnutá šipka', 0.6], krouzek: ['Zakroužkování', 0.55],
    vlnovka: ['Vlnovka (podtržení)', 0.14], zavorka: ['Svorka {', 3.2], krizek: ['Křížek „tady“', 1], hvezda: ['Hvězdička', 1], ruka: ['Ukazující ruka', 0.5]
  };
  P.kresbaSvg = function (typ, seed, barva) {
    const K = P.KRESBY[typ]; if (!K || !K[1]) return '';
    const c = /^#[0-9a-f]{6}$/i.test(barva || '') ? barva : '#3d2714', H = 100 * K[1], rng = P.rng(((seed >>> 0) || 1) * 4099 + 7);
    const tah = (body, sirka, ostre) => {   // lomená čára (hladce, nebo ostré rohy), body s drobným chvěním; dva tahy přes sebe
      const jeden = () => { const b = body.map(([x, y]) => [x + (rng() - 0.5) * 1.6, y + (rng() - 0.5) * 1.6]); let dd = `M${f(b[0][0])} ${f(b[0][1])}`; for (let i = 1; i < b.length; i++) { const p0 = b[i - 1], p1 = b[i]; dd += ostre ? `L${f(p1[0])} ${f(p1[1])}` : `Q${f(p0[0])} ${f(p0[1])} ${f((p0[0] + p1[0]) / 2)} ${f((p0[1] + p1[1]) / 2)}`; } return dd + (ostre ? '' : `L${f(b[b.length - 1][0])} ${f(b[b.length - 1][1])}`); };
      return `<path d="${jeden()}" stroke-width="${sirka}"/><path d="${jeden()}" stroke-width="${f(sirka * 0.55)}" opacity=".7"/>`;
    };
    const oblouk = (n, fn) => Array.from({ length: n + 1 }, (_, i) => fn(i / n));
    let g = '';
    switch (typ) {
      case 'sipka': g = tah(oblouk(10, t => [4 + t * 88, H / 2 + Math.sin(t * 3.1) * 3]), 3) + tah([[74, H / 2 - 12], [94, H / 2 + 1], [72, H / 2 + 12]], 3, true); break;
      case 'sipkaOblouk': g = tah(oblouk(14, t => [6 + t * 80, H - 8 - Math.sin(t * Math.PI) * (H - 22)]), 3) + tah([[70, H - 22], [87, H - 7], [92, H - 30]], 3, true); break;
      case 'krouzek': g = tah(oblouk(26, t => { const u = -0.4 + t * Math.PI * 2.25; return [50 + Math.cos(u) * (44 + t * 3), H / 2 + Math.sin(u) * (H / 2 - 5 - t * 2)]; }), 2.6); break;
      case 'vlnovka': g = tah(oblouk(24, t => [3 + t * 94, H / 2 + Math.sin(t * Math.PI * 8) * (H / 2 - 3)]), 2.4); break;
      case 'zavorka': g = tah([[60, 4], [34, 10], [36, H / 2 - 20], [30, H / 2 - 4], [8, H / 2], [30, H / 2 + 4], [36, H / 2 + 20], [34, H - 10], [60, H - 4]], 4.5); break;
      case 'krizek': g = tah([[14, 14], [50, 52], [88, 88]], 6) + tah([[86, 12], [50, 50], [12, 88]], 6); break;
      case 'hvezda': g = tah(oblouk(5, t => { const u = -Math.PI / 2 + t * Math.PI * 2 * 2; return [50 + Math.cos(u) * 44, 54 + Math.sin(u) * 44]; }), 3.6, true); break;
      case 'ruka':   // manžeta, dlaň se zahnutými prsty a dlouhý ukazovák
        g = tah([[4, 14], [20, 12], [22, 38], [4, 40], [4, 14]], 2.6) + tah([[10, 13], [11, 39]], 1.4)
          + tah([[22, 14], [40, 10], [58, 13], [96, 15], [97, 21], [62, 23]], 2.6)
          + tah([[62, 23], [66, 28], [60, 31], [44, 30]], 2.4) + tah([[58, 31], [62, 36], [56, 39], [42, 38]], 2.4) + tah([[54, 39], [56, 44], [46, 46], [22, 38]], 2.4);
        break;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 ${f(H)}" class="kresba-svg" aria-hidden="true"><g fill="none" stroke="${c}" stroke-linecap="round" stroke-linejoin="round">${g}</g></svg>`;
  };

  /* Obálka C6 (162 × 114 mm, vejde se list A4 přeložený na čtvrtky) jako střih na A4 na výšku:
     tělo, bočnice, spodní a horní chlopeň; plná čára = stříhat, čárkovaná = ohnout.
     adresa = pole pro text na líci (mm), pecet = střed pečeti na horní chlopni (po složení na zadní straně). */
  P.OBALKA = (() => {
    const W = 162, H = 114, x0 = 24, y0 = 82, bok = 21, hor = 60, dol = 80;
    const obrys = `M${x0} ${y0}L${x0 + 6} ${y0 - 4}L${x0 + W / 2 - 16} ${y0 - hor + 7}Q${x0 + W / 2} ${y0 - hor} ${x0 + W / 2 + 16} ${y0 - hor + 7}L${x0 + W - 6} ${y0 - 4}L${x0 + W} ${y0}`
      + `L${x0 + W + bok} ${y0 + 14}Q${x0 + W + bok + 1} ${y0 + H / 2} ${x0 + W + bok} ${y0 + H - 14}L${x0 + W} ${y0 + H}`
      + `L${x0 + W - 4} ${y0 + H + 6}L${x0 + W / 2 + 22} ${y0 + H + dol - 8}Q${x0 + W / 2} ${y0 + H + dol} ${x0 + W / 2 - 22} ${y0 + H + dol - 8}L${x0 + 4} ${y0 + H + 6}L${x0} ${y0 + H}`
      + `L${x0 - bok} ${y0 + H - 14}Q${x0 - bok - 1} ${y0 + H / 2} ${x0 - bok} ${y0 + 14}Z`;
    return { w: 210, h: 297, W, H, x0, y0, obrys, adresa: { x: x0 + W * 0.42, y: y0 + H * 0.4, w: W * 0.52, h: H * 0.52 }, pecet: { x: x0 + W / 2, y: y0 - hor + 22 } };
  })();
  P.obalkaSvg = function (barva) {
    const O = P.OBALKA, c = /^#[0-9a-f]{6}$/i.test(barva || '') ? barva : '#3d2714';
    return `<svg xmlns="http://www.w3.org/2000/svg" class="obalka-svg" viewBox="0 0 ${O.w} ${O.h}" preserveAspectRatio="none" aria-hidden="true">`
      + `<path d="${O.obrys}" fill="none" stroke="#444" stroke-width=".3"/>`
      + `<rect x="${O.x0}" y="${O.y0}" width="${O.W}" height="${O.H}" fill="none" stroke="#777" stroke-width=".25" stroke-dasharray="1.6 1.2"/>`
      + `<rect x="${O.x0 + O.W - 30}" y="${O.y0 + 8}" width="22" height="26" fill="none" stroke="${c}" stroke-width=".3" stroke-dasharray=".8 .8" opacity=".6"/>`
      + `<g font-family="sans-serif" font-size="3" fill="#666"><text x="6" y="12">✂ stříhat po plné čáře</text>`
      + `<text x="${O.w / 2}" y="${O.h - 8}" text-anchor="middle">Ohnout po čárkované: bočnice dovnitř, spodní chlopeň nahoru (přilepit), list vložit, horní chlopeň dolů a zapečetit.</text></g></svg>`;
  };

  /* Ozdobný roh (SVG 40×40 mm, roh vlevo nahoře; ostatní rohy se zrcadlí v CSS). */
  P.rohSvg = function (barva) {
    const c = /^#[0-9a-f]{6}$/i.test(barva || '') ? barva : '#3d2714';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><g fill="none" stroke="${c}" stroke-width=".8" stroke-linecap="round">`
      + '<path d="M3 37V8Q3 3 8 3H37"/><path d="M6 30V11Q6 6 11 6H30"/>'
      + '<path d="M6 11C14 11 16 16 16 22C16 28 11 30 9 27C7 24 11 21 13 24"/><path d="M11 6C11 14 16 16 22 16C28 16 30 11 27 9C24 7 21 11 24 13"/>'
      + '<path d="M16 22Q22 22 22 16"/><circle cx="19.5" cy="19.5" r="1.4" fill="' + c + '"/></g></svg>';
  };

  /* Ukázkové texty. */
  P.UKAZKY = {
    vyprava: { nadpis: 'Deník výpravy', text: 'Třetí den jsme dorazili k vodopádu. Domorodí průvodci odmítli jít dál – prý tam „spí kamenný had“.\n\nZa skalní branou jsem našel schody vytesané do skály. Počítal jsem: třicet tři. Na posledním je znamení, které jsem si překreslil na zadní stranu.\n\nKdo najde tento list, ať jde po mých stopách. Já se už nevrátím.', podpis: 'prof. A. Hartmann', datum: 'Léta Páně 1923', pismo: 'imfell', pismoNadpisu: 'uncial' },
    pirati: { nadpis: 'Kapitánův vzkaz', text: 'Kdo tohle čte, má štěstí i smůlu zároveň.\nŠtěstí, protože ví, že poklad existuje.\nSmůlu, protože ho hlídá celá posádka.\n\nOd staré palmy deset kroků k moři, pak ke skále tvaru lebky. Kopej, dokud nenarazíš na železo.', podpis: 'kpt. Černovous', datum: 'Na palubě Mořské vdovy', pismo: 'pirata', pismoNadpisu: 'pirata', znakPecete: '☠', vosk: 'cerna', sifra: 'zadna' },
    rod: { nadpis: 'Z knihy rodu', text: 'Merin otevřela knihu před denní ženou, která měří. Ukázala jí list s čárkami a řádek Doroty.\n\nKniha nelže. Jen mlčí.', podpis: 'Merin', datum: '', pismo: 'ptaci', pismoNadpisu: 'imfell', velikost: 22, klic: 'dole', rozsahKlice: 'pouzite', ramecek: 'jednoduchy', znakPecete: 'M', vosk: 'zelena' },
    listina: { nadpis: 'Listina', text: 'My, Konrád z Wehrbergu, purkrabí chebský, oznamujeme všem, kdož tento list uzří neb čísti uslyší, že jsme dali a dáváme mnichu Matějovi právo vstoupiti do hory nad Mlýncem a zapsati, co tam uzří.\n\nA na svědomí toho jsme kázali přivěsiti naši pečeť.', podpis: 'Konrád z Wehrbergu', datum: 'Dáno v Chebu léta Páně 1172', pismo: 'grenze', pismoNadpisu: 'jacquard', ramecek: 'rohyLinka' },
    agent: { nadpis: 'Přísně tajné', text: 'Agente,\nschránka se přesunula. Nové místo najdete tam, kde se v poledne setkávají dva stíny.\nHeslo pro spojku: „Vrány létají nízko.“\n\nTuto zprávu po přečtení zničte.', podpis: 'Centrála', datum: '', pismo: 'specialelite', pismoNadpisu: 'blackops', papir: 'svetly', okraj: 'rovny', ramecek: 'zadny', pecet: false, sifra: 'caesar', posun: 5, klic: 'listek' },
    pozvanka: { nadpis: 'Pozvánka', text: 'Vznešený rytíři, urozená paní,\n\nkrál zve na velkou slavnost k narozeninám své dcery. Hodování začne, až slunce stane nad věží.\n\nPřijďte v plné zbroji a s dobrou náladou.', podpis: 'Jeho Veličenstvo', datum: 'Na hradě, v sobotu', pismo: 'fondamento', pismoNadpisu: 'cinzel', ramecek: 'dvojity', vosk: 'zlata', znakPecete: '♛' },
    gerung: { nadpis: 'Bratru Matthiovi', text: 'Bratru Matthiovi, převor Gerung.\n\nTvůj dopis jsem četl a děkuji Bohu, že tě zachoval. Pan Konrád tě požádá o službu; vyhov mu, pokud se to nepříčí řeholi a tvému svědomí.\n\nNa listinu nezapomeň. Do Popeleční středy se vrať.\n\nVale.', podpis: 'Gerung, převor', datum: 'Waldsassen, léta Páně 1172', pismo: 'imfell', pismoNadpisu: 'uncial', format: 'a5', papir: 'velin', okraj: 'natrzeny', starnuti: 70, ramecek: 'zadny', inicialy: 'cervena', vosk: 'cervena', znakPecete: '✠', pecetStyl: 'kulata', preklad: 'tretiny', foxing: 30, inkoustStari: 45, rukopis: 25 },
    wehrl: { nadpis: 'List perkmistrův', text: 'Já, perkmistr horního soudu v Jáchymově, tímto listem stvrzuji, že Ilona, vdova po ranhojiči Řehořovi, má právo ohledávati těla zemřelých a vyslýchati svědkyně ve věci, kterou jí horní soud svěřil.\n\nKdo by jí v tom bránil, bude se zodpovídati přede mnou.\n\nPtejte se dobře. Zapište si to.', podpis: 'Wehrl, perkmistr', datum: 'V Jáchymově, léta 1595', pismo: 'fondamento', pismoNadpisu: 'cinzel', papir: 'stary', starnuti: 55, ramecek: 'dvojity', vosk: 'cervena', znakPecete: 'W', pecetStyl: 'vroubkovana', stuha: 'cervena', preklad: 'ctvrtky', zmackani: 25, mastnota: 35, pero: 35 },
    vypoved: { nadpis: 'Desátá výpověď', text: 'Spis horního soudu, Jáchymov.\n\nVyslechnuta žena, jejíž jméno zde stálo. Vypověděla, že ve středu v noci šla nad Horní štolu a že mezek chodí ve středu.\n\nCo viděla pod převisem, nechtěla říci před písařem.\n\nVíc jsem nezapsala.', podpis: 'Jeremiáš, písař', datum: 'L. P. 1595', pismo: 'imfell', pismoNadpisu: 'imfell', papir: 'stary', starnuti: 85, ramecek: 'zadny', pecet: false, inicialy: 'inkoust', voda: 70, seedPosk: 12, foxing: 45, ozehnuti: 30, trhliny: 1, inkoustStari: 60, rozpiti: 40 },
  };

  G.PERGAMEN = P;
  if (typeof module !== 'undefined') module.exports = P;
})(typeof window !== 'undefined' ? window : globalThis);
