/* Záložky a ex libris – převod kusu na jednobarevné SVG pro 3D razítko (obsah/razitko.html).
   Prvky kusu se zpracují v pořadí kreslení: inkoust (b 1, 2) se přičte, barva papíru (b 0) se odečte,
   pozadí a vložené obrázky se vynechají. Plochy i tahy převádí MDL.ctiSvg (import SVG Modeláře, stejný
   jako v Razítku) a Clipper. Výsledek = jedna cesta s výplní – Razítko ji načte v režimu „plochy“.
   Razítko si motiv na desce zrcadlí samo; zrcadlený export je pro nástroje, které nezrcadlí (laser, CNC). */
(function (koren) {
  'use strict';
  const uzel = typeof module !== 'undefined' && module.exports;
  const CL = uzel ? require('../lib/clipper.min.js') : koren.ClipperLib;
  if (uzel) { globalThis.ClipperLib = globalThis.ClipperLib || CL; require('../modelar/jadro/soubory/svg.js'); }
  const MDL = () => globalThis.MDL;
  const S = 1000;   // µm
  const R3 = {};
  const n = x => (Math.round(x * 1000) / 1000).toString();

  function sjednot(cesty, pravidlo) {
    const c = new CL.Clipper();
    c.AddPaths(cesty, CL.PolyType.ptSubject, true);
    const out = new CL.Paths(), ft = pravidlo === 'evenodd' ? CL.PolyFillType.pftEvenOdd : CL.PolyFillType.pftNonZero;
    c.Execute(CL.ClipType.ctUnion, out, ft, ft);
    return out;
  }
  function operace(a, b, typ) {
    const c = new CL.Clipper();
    c.AddPaths(a, CL.PolyType.ptSubject, true);
    c.AddPaths(b, CL.PolyType.ptClip, true);
    const out = new CL.Paths();
    c.Execute(typ, out, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero);
    return out;
  }
  /* jeden prvek SVG (v souřadnicích kusu) → plochy v µm, osa y dolů */
  function plochyPrvku(s, w, h) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${n(w)}mm" height="${n(h)}mm" viewBox="0 0 ${n(w)} ${n(h)}">${s}</svg>`;
    let r;
    try { r = MDL().ctiSvg(svg); } catch (e) { return []; }
    const casti = [], tahy = [];
    for (const p of r.prvky) {
      const body = q => q.body.map(([x, y]) => ({ X: Math.round(x * S), Y: Math.round(-y * S) }));
      if (p.vypln) {
        const uz = p.podcesty.filter(q => q.body.length >= 3).map(body);
        if (uz.length) casti.push(...sjednot(uz, p.pravidlo));
      }
      if (p.tah && p.sirka > 0) {
        const c = new CL.ClipperOffset(2, 0.01 * S);
        for (const q of p.podcesty) c.AddPath(body(q), CL.JoinType.jtRound, q.uzavrena ? CL.EndType.etClosedLine : CL.EndType.etOpenButt);
        const out = new CL.Paths();
        c.Execute(out, Math.max(1, p.sirka * S / 2));
        tahy.push(...out);
      }
    }
    return { vypln: casti.length ? sjednot(casti, 'nonzero') : [], tah: tahy.length ? sjednot(tahy, 'nonzero') : [] };
  }

  /* kus (z ZE.kresliExlibris) → {svg, sirka, vyska, motivSirka, motivVyska, varovani}
     o.sirka = cílová šířka kusu v mm (měřítko), o.zrcadlit = zrcadlově (pro nástroje, které nezrcadlí) */
  R3.naRazitko = function (kus, o) {
    o = o || {};
    const w = kus.w, h = kus.h, k = (o.sirka > 0 ? o.sirka : w) / w, varovani = [];
    let acc = [];
    for (const p of kus.prvky) {
      if (p.pozadi) continue;
      if (p.b === 'obr') { varovani.push('Vložený obrázek se do razítka nepřevádí – použijte monogram nebo symbol.'); continue; }
      const t = plochyPrvku(p.s, w, h);
      // výplň barvou papíru s tahem inkoustem (štít, stuha, list): výplň ubere, tah přidá
      const papirovaVypln = p.b === 0 || (kus.papir && p.s.includes(`fill="${kus.papir}"`));
      if (t.vypln.length) acc = operace(acc, t.vypln, papirovaVypln ? CL.ClipType.ctDifference : CL.ClipType.ctUnion);
      if (t.tah.length) acc = operace(acc, t.tah, p.b === 0 ? CL.ClipType.ctDifference : CL.ClipType.ctUnion);
    }
    const ram = [[{ X: 0, Y: 0 }, { X: w * S, Y: 0 }, { X: w * S, Y: h * S }, { X: 0, Y: h * S }]];
    acc = operace(acc, ram, CL.ClipType.ctIntersection).filter(q => Math.abs(CL.Clipper.Area(q)) > 400);   // drobty pod 0,0004 mm²
    if (!acc.length) throw new Error('Návrh neobsahuje nic, co by šlo vytisknout.');
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, d = '';
    for (const q of acc) {
      q.forEach((b, i) => {
        let x = b.X / S, y = b.Y / S;
        if (o.zrcadlit) x = w - x;
        x *= k; y *= k;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        d += (i ? 'L' : 'M') + n(x) + ' ' + n(y);
      });
      d += 'Z';
    }
    const W = w * k, H = h * k;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${n(W)}mm" height="${n(H)}mm" viewBox="0 0 ${n(W)} ${n(H)}"><path d="${d}" fill="#000000" fill-rule="evenodd"/></svg>`;
    if (svg.length > 400000) varovani.push('SVG má přes 400 kB – Razítko ho nepřijme. Zjednodušte návrh (méně detailů, jiné písmo).');
    return { svg, sirka: W, vyska: H, motivSirka: x1 - x0, motivVyska: y1 - y0, obrysu: acc.length, varovani };
  };

  /* Projekt pro Razítko (Soubor → Načíst projekt): deska o 2 mm větší než motiv, motiv SVG v režimu plochy. */
  R3.projektRazitka = function (r, nazev, o) {
    o = o || {};
    const kulate = !!o.kulate;
    const sir = Math.round((r.motivSirka + 3) * 10) / 10, vys = Math.round((r.motivVyska + 3) * 10) / 10;
    const projekt = {
      nazev: String(nazev || 'Ex libris').slice(0, 120), druh: 'razitko', tvar: kulate ? 'kruh' : 'obdelnik',
      sirka: kulate ? Math.max(sir, vys) : sir, vyska: kulate ? Math.max(sir, vys) : vys, zaobleni: 1.5, deska: 3,
      motiv: { zdroj: 'svg', svg: r.svg, svgNazev: (nazev || 'ex_libris') + '.svg', svgSirka: Math.round(r.motivSirka * 100) / 100, svgRezim: 'plocha', zesileni: 0, posunY: 0 },
      obvod: { nahore: '', dole: '' },
      ramecek: { pocet: 0 },
      relief: { rezim: 'vystouply', vyska: 1.5, uhel: 30 },
    };
    return JSON.stringify({ format: 'webapp_razitko', verze: 1, ulozeno: new Date().toISOString(), projekt }, null, 2);
  };

  if (uzel) module.exports = R3; else koren.ZE_RAZITKO = R3;
})(typeof globalThis !== 'undefined' ? globalThis : this);
