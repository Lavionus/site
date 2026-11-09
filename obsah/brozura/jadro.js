/* ============================================================
   Tisk knížky doma – jádro bez DOM (vyřazení stran do archů).
   V prohlížeči window.BROZURA, v node module.exports.

   Pojmy:
   - strana knihy = logická pozice 1…N (N je počet stran doplněný
     prázdnými na potřebný násobek); poradi[pozice-1] = index stránky
     zdrojového PDF (od 0), nebo null = vložená prázdná strana;
   - arch = list papíru, má líc a rub; každá strana archu je mřížka
     buněk (řádky × 2 sloupce), pořadí buněk tak, jak stranu archu
     vidíte při pohledu na ni;
   - rub předpokládá převrácení archu kolem SVISLÉ osy (jako list
     v knize). Když tiskárna převrací jinak, rub se otočí o 180°
     (/Rotate), viz otoceniRubu();
   - slot = plocha jednoho listu knihy po ořezu (strana + okraj pro
     vazbu); hřbetní strana slotu je 'L' nebo 'R'.
   Rozměry v mm, do PDF se převádí až při kreslení (MM bodů na mm).
   ============================================================ */
(function (koren) {
  'use strict';
  const MM = 72 / 25.4;

  const ARCHY = {
    a4: { nazev: 'A4 (210 × 297 mm)', s: 210, v: 297 },
    a3: { nazev: 'A3 (297 × 420 mm)', s: 297, v: 420 },
    letter: { nazev: 'Letter (8,5 × 11″)', s: 215.9, v: 279.4 }
  };

  const REZIMY = {
    sesitek: 'Sešitek – sedlová vazba',
    slozky: 'Kniha po složkách (šitá / lepená)',
    lepena: 'Lepená vazba – jednotlivé listy',
    ctyri: '4 strany na list (sešitek A6 z A4)'
  };

  const VYCHOZI = {
    rezim: 'sesitek',
    arch: 'a4',
    meritko: 'zachovat',      // 'zachovat' = 100 %, 'prizpusobit' = vejít se do archu
    vazba: 0,                 // okraj pro vazbu přidaný na hřbetní stranu každého listu (mm)
    creep: false,
    papir: 0.1,               // tloušťka papíru (mm) = posun na každý další vnitřní list
    slozka: 16,               // stran ve složce (4–32, násobek 4)
    slozkyVazba: 'sita',      // 'sita' | 'lepena'
    vyrovnatSlozky: false,    // doplnit prázdné tak, aby i poslední složka byla plná
    poradiListu: 'stoh',      // lepená vazba: 'stoh' (rozříznout stoh najednou) | 'postupne'
    prazdne: 'konec',         // kam prázdné strany: 'konec' | 'predZadni' (zadní strana zůstane poslední)
    preklapeni: 'dlouha',     // jak tiskárna obrací arch: 'dlouha' | 'kratka' hrana
    vystup: 'duplex',         // 'duplex' = jedno PDF, 'oddelene' = líce a rubu zvlášť
    rubObracene: false,       // u odděleného rubu tisknout archy od posledního
    okrajTiskarny: 5,         // mm, kam tiskárna nedosáhne
    spadavka: 0,              // mm spadávky ve zdrojovém PDF (Sazba knihy ji přidává kolem stran) – odřízne se
    orez: true, falc: true, poradiZnacky: true, popisky: true
  };

  const cislo = (x, d, min, max) => {
    if (typeof x === 'string') x = x.trim().replace(',', '.');
    x = x === '' || x === null || x === undefined ? NaN : Number(x);   // prázdné pole = výchozí, ne 0
    if (!isFinite(x)) x = d;
    return Math.min(max, Math.max(min, x));
  };

  function normalizuj(v) {
    const o = Object.assign({}, VYCHOZI, v || {});
    if (!REZIMY[o.rezim]) o.rezim = VYCHOZI.rezim;
    if (!ARCHY[o.arch]) o.arch = VYCHOZI.arch;
    if (o.meritko !== 'prizpusobit') o.meritko = 'zachovat';
    o.vazba = cislo(o.vazba, 0, 0, 30);
    o.papir = cislo(o.papir, 0.1, 0, 1);
    o.slozka = Math.round(cislo(o.slozka, 16, 4, 32) / 4) * 4;
    o.okrajTiskarny = cislo(o.okrajTiskarny, 5, 0, 20);
    o.spadavka = cislo(o.spadavka, 0, 0, 10);
    if (o.poradiListu !== 'postupne') o.poradiListu = 'stoh';
    if (o.prazdne !== 'predZadni') o.prazdne = 'konec';
    if (o.preklapeni !== 'kratka') o.preklapeni = 'dlouha';
    if (o.vystup !== 'oddelene') o.vystup = 'duplex';
    if (o.slozkyVazba !== 'lepena') o.slozkyVazba = 'sita';
    for (const k of ['creep', 'vyrovnatSlozky', 'rubObracene', 'orez', 'falc', 'poradiZnacky', 'popisky']) o[k] = !!o[k];
    return o;
  }

  /* ---------- pořadí stran ---------- */

  // na kolik stran se kniha doplňuje
  function nasobek(o) {
    return o.rezim === 'slozky' && o.vyrovnatSlozky ? o.slozka : 4;
  }

  // n stran zdroje → pole délky N (indexy zdroje od 0, null = prázdná)
  function poradiStran(n, nas, kam) {
    if (!(n >= 1)) return [];
    const N = Math.ceil(n / nas) * nas, prazdnych = N - n;
    const p = [];
    if (kam === 'predZadni' && n >= 2 && prazdnych) {
      for (let i = 0; i < n - 1; i++) p.push(i);
      for (let i = 0; i < prazdnych; i++) p.push(null);
      p.push(n - 1);
    } else {
      for (let i = 0; i < n; i++) p.push(i);
      for (let i = 0; i < prazdnych; i++) p.push(null);
    }
    return p;
  }

  // jeden sešitek (sedlová vazba) ze stran o+1 … o+S; list 0 je vnější
  function sesitek(S, o = 0) {
    const listy = [];
    for (let k = 0; k < S / 4; k++) {
      listy.push({ k, lic: [o + S - 2 * k, o + 2 * k + 1], rub: [o + 2 * k + 2, o + S - 2 * k - 1] });
    }
    return listy;
  }

  // jednotlivé listy pro lepenou vazbu (2 strany vedle sebe, M archů)
  function listyLepene(N, poradi) {
    const M = N / 4, archy = [];
    for (let i = 0; i < M; i++) {
      if (poradi === 'postupne') archy.push({ k: i, lic: [4 * i + 1, 4 * i + 3], rub: [4 * i + 4, 4 * i + 2] });
      else archy.push({ k: i, lic: [2 * i + 1, 2 * (M + i) + 1], rub: [2 * (M + i) + 2, 2 * i + 2] });
    }
    return archy;
  }

  const SEDLO = ['R', 'L'];
  // logické archy: [{slozka, list, listu, lic:[{strany:[a,b], k, hrbety}], rub:[…]}], pozice 1…N, 0 = nic
  function archyLogicke(N, o) {
    const archy = [];
    const radek = (strany, k, hrbety) => ({ strany, k, hrbety });
    if (o.rezim === 'lepena') {
      for (const l of listyLepene(N, o.poradiListu)) {
        archy.push({ slozka: 0, list: l.k, listu: N / 4, lic: [radek(l.lic, l.k, ['L', 'L'])], rub: [radek(l.rub, l.k, ['R', 'R'])] });
      }
    } else if (o.rezim === 'ctyri') {
      const b = sesitek(N), K = Math.ceil(b.length / 2), nic = { k: 0, lic: [0, 0], rub: [0, 0] };
      for (let i = 0; i < K; i++) {
        const h = b[i], d = b[K + i] || nic;
        archy.push({ slozka: 0, list: i, listu: K,
          lic: [radek(h.lic, h.k, SEDLO), radek(d.lic, d.k, SEDLO)],
          rub: [radek(h.rub, h.k, SEDLO), radek(d.rub, d.k, SEDLO)] });
      }
    } else {
      const S = o.rezim === 'slozky' ? o.slozka : N;
      for (let od = 0, s = 0; od < N; od += S, s++) {
        const vel = Math.min(S, N - od);
        for (const l of sesitek(vel, od)) {
          archy.push({ slozka: s, list: l.k, listu: vel / 4, od: od + 1, do: od + vel,
            lic: [radek(l.lic, l.k, SEDLO)], rub: [radek(l.rub, l.k, SEDLO)] });
        }
      }
    }
    return archy;
  }

  /* ---------- geometrie ---------- */

  // rub se otáčí o 180°, když tiskárna obrací arch kolem vodorovné osy stránky
  function otoceniRubu(W, H, preklapeni) {
    if (Math.abs(W - H) < 1e-6) return 0;
    const naSirku = W > H;
    if (preklapeni === 'kratka') return naSirku ? 0 : 180;
    return naSirku ? 180 : 0;
  }

  const rezervaZnacek = o => (o.orez || o.falc) ? Math.max(o.okrajTiskarny, 8) : o.okrajTiskarny;

  // strana = rozměr stránky zdroje {s, v} v mm
  function geometrie(o, strana) {
    const a = ARCHY[o.arch], radku = o.rezim === 'ctyri' ? 2 : 1, sloupcu = 2;
    const rez = rezervaZnacek(o);
    const varianty = [[a.s, a.v], [a.v, a.s]].map(([W, H]) => {
      let m = 1;
      if (o.meritko === 'prizpusobit') {
        m = Math.min((W - 2 * rez - sloupcu * o.vazba) / (sloupcu * strana.s), (H - 2 * rez) / (radku * strana.v));
        m = Math.max(0.05, m);
      }
      const pw = strana.s * m, ph = strana.v * m, sw = pw + o.vazba, sh = ph;
      const bw = sloupcu * sw, bh = radku * sh;
      return { W, H, m, pw, ph, sw, sh, bw, bh, radku, sloupcu, x0: (W - bw) / 2, y0: (H - bh) / 2,
        volno: Math.min(W - bw, H - bh) / 2 };
    });
    const [p, l] = varianty;
    const g = o.meritko === 'prizpusobit' ? (l.m > p.m + 1e-9 ? l : p) : (l.volno > p.volno + 1e-9 ? l : p);
    g.vejdeSe = g.volno >= -1e-6;
    g.vTiskoveOblasti = g.volno >= o.okrajTiskarny - 1e-6;
    g.rotaceRubu = otoceniRubu(g.W, g.H, o.preklapeni);
    return g;
  }

  // umístění strany do slotu (mm, počátek vlevo dole, jako v PDF)
  function umisti(g, o, radek, sloupec, hrbet, k) {
    const sx = g.x0 + sloupec * g.sw, sy = g.y0 + (g.radku - 1 - radek) * g.sh;
    const posun = o.creep && o.rezim !== 'lepena' ? k * o.papir : 0;
    const x = hrbet === 'L' ? sx + o.vazba - posun : sx + posun;
    return { x, y: sy, w: g.pw, h: g.ph, slot: { x: sx, y: sy, w: g.sw, h: g.sh }, posun };
  }

  // čáry ořezu (x i y) a falcu (x) na straně archu
  function hrany(g, o) {
    const xs = [], ys = [], falc = [];
    for (let c = 0; c <= g.sloupcu; c++) {
      const x = g.x0 + c * g.sw;
      if (c === 1 && o.rezim !== 'lepena') falc.push(x); else xs.push(x);
    }
    for (let r = 0; r <= g.radku; r++) ys.push(g.y0 + r * g.sh);
    return { xs, ys, falc };
  }

  /* ---------- plán ---------- */

  // n = počet stran zdroje, strana = {s, v} mm (první strana)
  function plan(n, strana, volby) {
    const o = normalizuj(volby);
    const zdrojova = strana;
    strana = { s: Math.max(1, strana.s - 2 * o.spadavka), v: Math.max(1, strana.v - 2 * o.spadavka) };
    const poradi = poradiStran(n, nasobek(o), o.prazdne);
    const N = poradi.length, g = geometrie(o, strana);
    const zdroj = poz => (poz >= 1 && poz <= N) ? poradi[poz - 1] : undefined;   // undefined = buňka bez listu
    const archy = archyLogicke(N, o).map((a, i) => {
      const strana = rady => rady.map((r, ri) => r.strany.map((poz, c) => ({
        pozice: poz, zdroj: zdroj(poz), radek: ri, sloupec: c, hrbet: r.hrbety[c], k: r.k,
        ...umisti(g, o, ri, c, r.hrbety[c], r.k)
      }))).flat();
      return { cislo: i + 1, slozka: a.slozka, list: a.list, listu: a.listu, od: a.od, do: a.do,
        lic: strana(a.lic), rub: strana(a.rub) };
    });
    const slozek = o.rezim === 'slozky' ? Math.ceil(N / o.slozka) : 1;
    let posunMax = 0;
    for (const a of archy) for (const b of a.lic) posunMax = Math.max(posunMax, b.posun);
    const varovani = [];
    if (!g.vejdeSe) varovani.push(`Strany se na arch nevejdou (blok ${f1(g.bw)} × ${f1(g.bh)} mm, arch ${f1(g.W)} × ${f1(g.H)} mm) – zvolte „Přizpůsobit“ nebo větší arch.`);
    else if (!g.vTiskoveOblasti) varovani.push(`Blok ${f1(g.bw)} × ${f1(g.bh)} mm zasahuje do okraje, kam tiskárna nedosáhne (${f1(o.okrajTiskarny)} mm). Okraje stran se mohou oříznout; tiskněte ve „Skutečné velikosti“, nebo zvolte „Přizpůsobit“.`);
    if (o.rezim === 'sesitek' && N > 48) varovani.push(`Sešitek o ${N} stranách bude tlustý a špatně se přehne – zvažte vazbu po složkách.`);
    if (posunMax > o.vazba + 3) varovani.push('Posun stran (creep) je větší než okraj pro vazbu – vnitřní strany se přiblíží ke hřbetu.');
    return {
      volby: o, poradi, n, N, prazdnych: N - n, g, archy, slozek,
      posunMax,
      kniha: { s: g.sw, v: g.sh },
      zdrojova, strana,
      tloustka: N / 2 * o.papir,          // tloušťka knižního bloku = listů × papír (mm)
      varovani
    };
  }

  const f1 = x => (Math.round(x * 10) / 10).toString().replace('.', ',');
  const zobrazStranu = b => b.zdroj === undefined ? '' : b.zdroj === null ? '–' : String(b.zdroj + 1);

  // text řádků strany archu: „24 | 5“, u dvou řádků „24 | 5 / 20 | 9“
  function popisStrany(bunky) {
    const rady = [];
    for (const b of bunky) (rady[b.radek] = rady[b.radek] || [])[b.sloupec] = zobrazStranu(b);
    return rady.filter(r => r.some(Boolean)).map(r => r.map(x => x || '·').join(' | ')).join(' / ');
  }

  function prehled(p) {
    return p.archy.map(a => ({
      cislo: a.cislo, slozka: p.volby.rezim === 'slozky' ? a.slozka + 1 : null,
      lic: popisStrany(a.lic), rub: popisStrany(a.rub)
    }));
  }

  function prehledText(p, nazev) {
    const o = p.volby, r = [];
    r.push(`Tisk knížky – ${nazev || 'kniha'}`);
    r.push(`Režim: ${REZIMY[o.rezim]}${o.rezim === 'slozky' ? `, složky po ${o.slozka} stranách (${p.slozek})` : ''}`);
    r.push(`Arch: ${ARCHY[o.arch].nazev}, ${p.g.W > p.g.H ? 'na šířku' : 'na výšku'}, měřítko ${Math.round(p.g.m * 1000) / 10} %`);
    r.push(`Stran: ${p.n}, doplněno prázdných: ${p.prazdnych}, archů: ${p.archy.length}`);
    r.push(`Kniha po ořezu: ${f1(p.kniha.s)} × ${f1(p.kniha.v)} mm`);
    r.push(`Tloušťka bloku: ${f1(p.tloustka)} mm (papír ${String(o.papir).replace('.', ',')} mm)`);
    r.push('');
    for (const x of prehled(p)) {
      r.push(`Arch ${x.cislo}${x.slozka ? ` (složka ${x.slozka})` : ''} líc: ${x.lic}`);
      r.push(`Arch ${x.cislo}${x.slozka ? ` (složka ${x.slozka})` : ''} rub: ${x.rub}`);
    }
    return r.join('\n');
  }

  /* ---------- PDF (pdf-lib) ---------- */

  const bezDiakritiky = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '-');

  // rozměr první strany zdroje v mm (TrimBox, jinak CropBox/MediaBox)
  function rozmerStrany(doc, i = 0) {
    const b = doc.getPage(i).getTrimBox();
    return { s: b.width / MM, v: b.height / MM };
  }

  /* zdroj = bajty PDF nebo načtený PDFDocument; plan z plan();
     volby: {strany: 'duplex'|'lic'|'rub', archy: [indexy archů], pismo: {fontkit, bajty}, nazev} */
  async function sestavPdf(PDFLib, zdroj, p, volby = {}) {
    const { PDFDocument, rgb, degrees, StandardFonts, pushGraphicsState, popGraphicsState, rectangle, clip, endPath } = PDFLib;
    const src = zdroj instanceof PDFDocument ? zdroj : await PDFDocument.load(zdroj, { ignoreEncryption: true });
    const out = await PDFDocument.create();
    const o = p.volby, g = p.g, druh = volby.strany || 'duplex';
    let font, text = t => t;
    if (volby.pismo) { out.registerFontkit(volby.pismo.fontkit); font = await out.embedFont(volby.pismo.bajty, { subset: true }); }
    else { font = await out.embedFont(StandardFonts.Helvetica); text = bezDiakritiky; }
    out.setTitle(`${volby.nazev || 'Kniha'} – archy k tisku`);
    out.setCreator('Tisk knížky doma');

    const cache = new Map();
    async function vlozena(idx) {
      if (!cache.has(idx)) {
        const pg = src.getPage(idx), b = pg.getTrimBox();
        const sp = Math.min(o.spadavka * MM, b.width / 2 - 1, b.height / 2 - 1);
        const box = { left: b.x + sp, bottom: b.y + sp, right: b.x + b.width - sp, top: b.y + b.height - sp };
        cache.set(idx, { e: await out.embedPage(pg, box), s: (box.right - box.left) / MM, v: (box.top - box.bottom) / MM });
      }
      return cache.get(idx);
    }
    const cerna = rgb(0, 0, 0), sira = 0.3;
    const cara = (pg, x1, y1, x2, y2, dash) => pg.drawLine({ start: { x: x1 * MM, y: y1 * MM }, end: { x: x2 * MM, y: y2 * MM }, thickness: sira, color: cerna, dashArray: dash });
    const H = hrany(g, o), OD = 2, DEL = 5;

    async function kresliStranu(a, bunky, jeLic) {
      const pg = out.addPage([g.W * MM, g.H * MM]);
      for (const b of bunky) {
        if (b.zdroj === null || b.zdroj === undefined) continue;
        const v = await vlozena(b.zdroj);
        const w = v.s * g.m, h = v.v * g.m, sl = b.slot;
        // strana nesmí přesahovat do sousedního listu (creep bez okraje pro vazbu, jiná velikost strany)
        pg.pushOperators(pushGraphicsState(), rectangle(sl.x * MM, sl.y * MM, sl.w * MM, sl.h * MM), clip(), endPath());
        pg.drawPage(v.e, { x: (b.x + (b.w - w) / 2) * MM, y: (b.y + (b.h - h) / 2) * MM, width: w * MM, height: h * MM });
        pg.pushOperators(popGraphicsState());
      }
      const xL = g.x0, xP = g.x0 + g.bw, yD = g.y0, yH = g.y0 + g.bh;
      if (o.orez) {
        for (const x of H.xs) { cara(pg, x, yH + OD, x, yH + OD + DEL); cara(pg, x, yD - OD, x, yD - OD - DEL); }
        for (const y of H.ys) { cara(pg, xL - OD, y, xL - OD - DEL, y); cara(pg, xP + OD, y, xP + OD + DEL, y); }
      }
      if (o.falc) for (const x of H.falc) {
        cara(pg, x, yH + OD, x, yH + OD + DEL + 3, [2, 2]); cara(pg, x, yD - OD, x, yD - OD - DEL - 3, [2, 2]);
      }
      // značka pořadí složky: na vnější straně (líci) vnějšího archu složky, přes hřbet, schodovitě
      if (o.poradiZnacky && o.rezim === 'slozky' && p.slozek > 1 && jeLic && a.list === 0) {
        const v = 5, krok = Math.min(6, (g.bh - 10 - v) / Math.max(1, p.slozek - 1));
        const y = yH - 5 - v - a.slozka * krok, x = H.falc[0];
        pg.drawRectangle({ x: (x - 1.5) * MM, y: y * MM, width: 3 * MM, height: v * MM, color: cerna });
      }
      if (o.popisky && yD >= 4) {
        const st = jeLic ? 'líc' : 'rub';
        let t = `Arch ${a.cislo}/${p.archy.length} · ${st}`;
        if (o.rezim === 'slozky') t += ` · složka ${a.slozka + 1}/${p.slozek} (str. ${a.od}–${a.do}), list ${a.list + 1}/${a.listu}`;
        t += ` · ${popisStrany(bunky)}`;
        const vel = 6, sirka = font.widthOfTextAtSize(text(t), vel);
        pg.drawText(text(t), { x: (g.W * MM - sirka) / 2, y: Math.max(1.5, yD - OD - DEL - 3) * MM, size: vel, font, color: rgb(0.35, 0.35, 0.35) });
      }
      if (!jeLic && g.rotaceRubu) pg.setRotation(degrees(g.rotaceRubu));
      return pg;
    }

    let indexy = volby.archy || p.archy.map((_, i) => i);
    if (druh === 'rub' && o.rubObracene && !volby.archy) indexy = indexy.slice().reverse();
    for (const i of indexy) {
      const a = p.archy[i];
      if (druh !== 'rub') await kresliStranu(a, a.lic, true);
      if (druh !== 'lic') await kresliStranu(a, a.rub, false);
    }
    return out.save();
  }

  // ukázková kniha: n stran daného formátu s velkými čísly (na zkoušku)
  async function ukazkovePdf(PDFLib, n = 12, strana = { s: 148, v: 210 }) {
    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    const d = await PDFDocument.create();
    const f = await d.embedFont(StandardFonts.HelveticaBold), fr = await d.embedFont(StandardFonts.TimesRoman);
    const W = strana.s * MM, H = strana.v * MM;
    for (let i = 1; i <= n; i++) {
      const pg = d.addPage([W, H]);
      const licha = i % 2 === 1, vn = 20 * MM, ve = 15 * MM;      // vnitřní okraj u hřbetu větší
      const x0 = licha ? vn : ve, x1 = W - (licha ? ve : vn);
      pg.drawRectangle({ x: x0, y: 20 * MM, width: x1 - x0, height: H - 37 * MM, borderColor: rgb(0.75, 0.8, 0.9), borderWidth: 0.8 });
      const t = String(i), vel = Math.min(W, H) * 0.35;
      pg.drawText(t, { x: (x0 + x1) / 2 - f.widthOfTextAtSize(t, vel) / 2, y: H / 2 - vel * 0.35, size: vel, font: f, color: rgb(0.2, 0.35, 0.65) });
      const kap = `Ukazkova kniha - strana ${i}`;
      pg.drawText(kap, { x: (x0 + x1) / 2 - fr.widthOfTextAtSize(kap, 11) / 2, y: H - 14 * MM, size: 11, font: fr, color: rgb(0.2, 0.2, 0.2) });
      // šipka ke hřbetu – při kontrole tisku je hned vidět, kde má být vazba
      const hx = licha ? 6 * MM : W - 6 * MM, smer = licha ? -1 : 1;
      pg.drawLine({ start: { x: hx - smer * 10 * MM, y: H / 2 }, end: { x: hx, y: H / 2 }, thickness: 1.5, color: rgb(0.8, 0.3, 0.2) });
      pg.drawLine({ start: { x: hx, y: H / 2 }, end: { x: hx - smer * 3 * MM, y: H / 2 + 2 * MM }, thickness: 1.5, color: rgb(0.8, 0.3, 0.2) });
      pg.drawLine({ start: { x: hx, y: H / 2 }, end: { x: hx - smer * 3 * MM, y: H / 2 - 2 * MM }, thickness: 1.5, color: rgb(0.8, 0.3, 0.2) });
      const p = String(i);
      pg.drawText(p, { x: licha ? x1 - fr.widthOfTextAtSize(p, 10) : x0, y: 12 * MM, size: 10, font: fr });
    }
    return d.save();
  }

  // Odhad spadávky: zdrojová strana = známý formát + 2 × spadávka (Sazba knihy ji přidává kolem stran)
  const FORMATY_KNIH = [[148, 210], [105, 148], [110, 178], [156, 234], [152.4, 228.6], [176, 250], [210, 297], [125, 187], [135, 205]];
  function odhadSpadavky(strana) {
    for (let sp = 1; sp <= 10; sp += 0.5) for (const [s, v] of FORMATY_KNIH) {
      if (Math.abs(strana.s - 2 * sp - s) < 0.4 && Math.abs(strana.v - 2 * sp - v) < 0.4) return { spadavka: sp, s, v };
    }
    return null;
  }

  // indexy stran, jejichž rozměr se od první liší o víc než tol mm
  function ruzneRozmery(rozmery, tol = 1) {
    const [a] = rozmery, r = [];
    rozmery.forEach((b, i) => { if (Math.abs(b.s - a.s) > tol || Math.abs(b.v - a.v) > tol) r.push(i); });
    return r;
  }

  // „1, 3-5, 8-“ → indexy archů od 0 (vzestupně, bez opakování); chyba → výjimka s českou zprávou
  function rozsahArchu(text, pocet) {
    const vysl = new Set(), casti = String(text || '').split(/[,;\s]+/).filter(Boolean);
    if (!casti.length) throw new Error('Zadejte čísla archů, např. 1, 3-5');
    for (const c of casti) {
      const m = c.match(/^(\d*)[-–](\d*)$/) || c.match(/^(\d+)()$/);
      if (!m) throw new Error(`Nerozumím „${c}“`);
      const od = m[1] === '' ? 1 : +m[1], po = /[-–]/.test(c) ? (m[2] === '' ? pocet : +m[2]) : od;
      if (od < 1 || po > pocet || od > po) throw new Error(`Archy „${c}“ nejsou v rozsahu 1–${pocet}`);
      for (let i = od; i <= po; i++) vysl.add(i - 1);
    }
    return [...vysl].sort((a, b) => a - b);
  }

  const API = { MM, ARCHY, REZIMY, VYCHOZI, normalizuj, nasobek, poradiStran, sesitek, listyLepene, archyLogicke,
    otoceniRubu, geometrie, umisti, hrany, plan, popisStrany, prehled, prehledText, rozmerStrany, sestavPdf,
    ukazkovePdf, bezDiakritiky, odhadSpadavky, ruzneRozmery, rozsahArchu };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else koren.BROZURA = API;
})(typeof window !== 'undefined' ? window : globalThis);
