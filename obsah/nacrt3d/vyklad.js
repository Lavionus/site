/* Z náčrtu do 3D – výklad kresby a řešení kót (bez DOM, jde v node).
   Potřebuje listy.js, tahy.js a řešič vazeb z Modeláře (modelar/jadro/vazby.js, globál MDL).
   N.vyloz(vykres) → {pohledy, tvary, vazby, koty, hlaseni, meritko}
     pohledy[id] = {ramec, oblasti: [{tvar (id), otvor, druh: 'cesta'|'kruh'}], prvky: [id prvků]}
     tvary = obrysy a kružnice pro řešič (souřadnice listu, mm, y dolů): cesta {id, typ, body [{x, y, b}], pohled}
             (uzavřená, proti směru „matematicky“ = kladná plocha), kruh {id, typ, x, y, rx, ry, pohled}
     koty[i] = {id prvku, stav: 'ok'|'nepřiřazená'|'rozpor', typ vazby, popis}
   N.zpracuj(vykres) → výklad + {vysledek: {tvary (vyřešené), ok, volnost, urcene}}.
   Obrysy: všechny tahy pera „obrys“ v pohledu tvoří rovinný graf (spojení konců, T-spoje, u rotačního listu
   doplnění úseku po ose), visící konce se odříznou, každá souvislá část dá svůj vnější obrys (vnější stěna
   grafu). Vnoření obrysů a kružnic: lichá hloubka = otvor. Kóty se přiřadí podle průmětu ke bodům, takže kóta
   může ležet vedle hrany (s vynášecími čarami i bez nich). */
var N3D = globalThis.N3D = globalThis.N3D || {};
(function (N) {
  'use strict';
  const M = globalThis.MDL = globalThis.MDL || {};
  // drobnosti, které řešič čeká ze společného modulu Modeláře
  M.omez = M.omez || ((x, a, b) => x < a ? a : x > b ? b : x);
  M.mm = M.mm || ((x, des = 1) => String(+(+x).toFixed(des)).replace('.', ','));
  const { hypot, abs, atan2, atan, PI, min, max } = Math;

  const TOL_UZEL = 1.2;      // mm – konce blíž než tohle jsou jeden bod
  const TOL_KOTA = 3;        // mm – jak daleko od bodu smí být konec kóty v ose měření

  // ------------------------------------------------------------ geometrie
  function plocha(l) { let a = 0; for (let i = 0, n = l.length; i < n; i++) { const p = l[i], q = l[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
  function uvnitr(l, x, y) {
    let v = false;
    for (let i = 0, j = l.length - 1; i < l.length; j = i++) {
      const [xi, yi] = l[i], [xj, yj] = l[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) v = !v;
    }
    return v;
  }
  /** Lomená uzavřeného obrysu z bodů s vyboulením. */
  function lomenaObrysu(body) {
    const out = [];
    for (let k = 0; k < body.length; k++) out.push(...N.bodyOblouku(body[k], body[(k + 1) % body.length], body[k].b, 12).slice(0, -1));
    return out;
  }
  N.lomenaObrysu = lomenaObrysu;

  // ------------------------------------------------------------ obrysy z tahů
  /** Rovinný graf z úseků a vnější obrysy jeho souvislých částí. osa = x osy u rotačního listu (nebo null).
      Vrací {obrysy: [[{x, y, b}]], visici: [[x, y]]}. */
  function obrysyZUseku(useky, osa) {
    const uzly = [];
    const uzel = (x, y) => {
      for (let i = 0; i < uzly.length; i++) if (hypot(uzly[i].x - x, uzly[i].y - y) < TOL_UZEL) return i;
      uzly.push({ x, y }); return uzly.length - 1;
    };
    let hrany = [];
    for (const u of useky) {
      const a = uzel(u.a.x, u.a.y), c = uzel(u.c.x, u.c.y);
      if (a !== c) hrany.push({ a, c, b: u.b || 0 });
    }
    const stupne = () => { const s = uzly.map(() => 0); for (const h of hrany) { s[h.a]++; s[h.c]++; } return s; };
    // T-spoj: volný konec ležící na rovném úseku jiné čáry ho rozdělí
    let st = stupne();
    for (let i = 0; i < uzly.length; i++) {
      if (st[i] !== 1) continue;
      const p = uzly[i];
      for (let j = 0; j < hrany.length; j++) {
        const h = hrany[j];
        if (h.b || h.a === i || h.c === i) continue;
        const A = uzly[h.a], C = uzly[h.c], dx = C.x - A.x, dy = C.y - A.y, l2 = dx * dx + dy * dy;
        const t = ((p.x - A.x) * dx + (p.y - A.y) * dy) / l2;
        if (t <= 0.02 || t >= 0.98) continue;
        if (hypot(A.x + t * dx - p.x, A.y + t * dy - p.y) > TOL_UZEL) continue;
        p.x = A.x + t * dx; p.y = A.y + t * dy;
        hrany.splice(j, 1, { a: h.a, c: i, b: 0 }, { a: i, c: h.c, b: 0 });
        st = stupne();
        break;
      }
    }
    // rotační list: volné konce na ose se po dvojicích spojí úsekem po ose
    if (osa != null) {
      const naOse = uzly.map((p, i) => i).filter(i => st[i] === 1 && abs(uzly[i].x - osa) < 2.5).sort((i, j) => uzly[i].y - uzly[j].y);
      for (const i of naOse) uzly[i].x = osa;
      for (let k = 0; k + 1 < naOse.length; k += 2) hrany.push({ a: naOse[k], c: naOse[k + 1], b: 0 });
      st = stupne();
    }
    // odříznout visící konce
    const visici = [];
    for (let zmena = true; zmena;) {
      zmena = false;
      st = stupne();
      const pred = hrany.length;
      hrany = hrany.filter(h => {
        if (st[h.a] === 1 || st[h.c] === 1) { for (const k of [h.a, h.c]) if (st[k] === 1) visici.push([uzly[k].x, uzly[k].y]); return false; }
        return true;
      });
      zmena = hrany.length !== pred;
    }
    // půlhrany s úhlem tečny na začátku (oblouk: tětiva pootočená o θ/2 ke straně vyboulení)
    const pul = [];
    hrany.forEach(h => {
      for (const [od, do_, b] of [[h.a, h.c, h.b], [h.c, h.a, -h.b]]) {
        const A = uzly[od], C = uzly[do_];
        pul.push({ od, do: do_, b, uhel: atan2(C.y - A.y, C.x - A.x) + 2 * atan(b), dvojce: -1, hotovo: false });
      }
    });
    for (let i = 0; i < pul.length; i += 2) { pul[i].dvojce = i + 1; pul[i + 1].dvojce = i; }
    const ven = uzly.map(() => []);
    pul.forEach((h, i) => ven[h.od].push(i));
    for (const v of ven) v.sort((i, j) => pul[i].uhel - pul[j].uhel);
    // stěny: další půlhrana = ve vrcholu cíle hned po dvojčeti po směru hodin (předchozí v řazení proti směru)
    const steny = [];
    for (let i = 0; i < pul.length; i++) {
      if (pul[i].hotovo) continue;
      const smycka = [];
      let e = i, bezpeci = pul.length + 1;
      while (!pul[e].hotovo && bezpeci--) {
        pul[e].hotovo = true; smycka.push(e);
        const v = ven[pul[e].do], k = v.indexOf(pul[e].dvojce);
        e = v[(k - 1 + v.length) % v.length];
      }
      const body = smycka.map(j => ({ x: uzly[pul[j].od].x, y: uzly[pul[j].od].y, b: pul[j].b }));
      steny.push({ smycka, body, plocha: plocha(lomenaObrysu(body)) });
    }
    // souvislé části → vnější stěna = nejzápornější plocha (obíhá část „zvenku“)
    const rod = uzly.map((_, i) => i);
    const najdi = i => { while (rod[i] !== i) i = rod[i] = rod[rod[i]]; return i; };
    for (const h of hrany) rod[najdi(h.a)] = najdi(h.c);
    const vnejsi = new Map();
    for (const s of steny) {
      const r = najdi(pul[s.smycka[0]].od);
      if (!vnejsi.has(r) || s.plocha < vnejsi.get(r).plocha) vnejsi.set(r, s);
    }
    const obrysy = [];
    for (const s of vnejsi.values()) {
      if (s.plocha > -1e-6) continue;
      // otočit na kladnou plochu: úseky v opačném pořadí a s opačným vyboulením
      const n = s.smycka.length, body = [];
      for (let k = n - 1; k >= 0; k--) { const h = pul[s.smycka[k]]; body.push({ x: uzly[h.do].x, y: uzly[h.do].y, b: -h.b }); }
      obrysy.push(body);
    }
    return { obrysy, visici };
  }
  N._obrysyZUseku = obrysyZUseku;

  // ------------------------------------------------------------ výklad
  N.vyloz = function (vykres) {
    const rv = N.rozvrh(vykres.typ, vykres.format);
    const hlaseni = [], tvary = [], vazby = [], koty = [];
    const pohledy = {};
    for (const r of rv.ramy) if (r.druh === 'pohled') pohledy[r.id] = { ramec: r, oblasti: [], prvky: [], koty: [] };
    const prvky = (vykres.prvky || []).filter(p => p && p.druh);

    // prvek → pohled (podle středu jeho bodů)
    const stredPrvku = p => {
      if (p.druh === 'kruh') return [p.x, p.y];
      if (p.druh === 'kota') return [(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2];
      let x = 0, y = 0; for (const b of p.body) { x += b.x; y += b.y; } return [x / p.body.length, y / p.body.length];
    };
    const mimo = [];
    for (const p of prvky) {
      const [x, y] = stredPrvku(p), r = N.ramecVBode(rv, x, y);
      if (!r) { mimo.push(p.id); continue; }
      (p.druh === 'kota' ? pohledy[r.id].koty : pohledy[r.id].prvky).push(p);
    }
    if (mimo.length) hlaseni.push({ druh: 'info', text: 'Čáry mimo rámečky pohledů se nepočítají (' + mimo.length + ').', prvky: mimo });

    // obrysy a kružnice po pohledech
    let n = 0;
    for (const [id, P] of Object.entries(pohledy)) {
      const useky = [];
      const kruhy = [];
      for (const p of P.prvky) {
        if (p.pero !== 'obrys') continue;
        if (p.druh === 'kruh') { kruhy.push(p); continue; }
        if (p.druh !== 'cara') continue;
        const k = p.body.length, pocet = p.zavrena ? k : k - 1;
        for (let i = 0; i < pocet; i++) useky.push({ a: p.body[i], c: p.body[(i + 1) % k], b: p.body[i].b || 0 });
      }
      const osa = vykres.typ === 'rotacni' && rv.osa ? rv.osa.x1 : null;
      const { obrysy, visici } = obrysyZUseku(useky, osa);
      if (visici.length) hlaseni.push({ druh: 'varovani', text: `${P.ramec.nazev}: nedotažená čára (${visici.length} volných konců) – obrys se musí uzavřít.`, body: visici });
      const oblasti = [];
      for (const body of obrysy) {
        const t = { id: 'o' + (n++), typ: 'cesta', body: body.map(b => ({ x: b.x, y: b.y, b: b.b })), pohled: id };
        oblasti.push({ tvar: t, lomena: lomenaObrysu(t.body) });
      }
      for (const k of kruhy) {
        const t = { id: 'c' + (n++), typ: 'kruh', x: k.x, y: k.y, rx: k.r, ry: k.r, pohled: id, prvek: k.id };
        oblasti.push({ tvar: t, lomena: N.lomenaPrvku(k).slice(0, -1) });
      }
      // vnoření: lichá hloubka = otvor
      for (const o of oblasti) {
        const t = o.tvar, [x, y] = t.typ === 'kruh' ? [t.x, t.y] : vnitrniBod(o.lomena);
        const hloubka = oblasti.filter(q => q !== o && abs(plocha(q.lomena)) > abs(plocha(o.lomena)) && uvnitr(q.lomena, x, y)).length;
        P.oblasti.push({ tvar: t.id, druh: t.typ, otvor: hloubka % 2 === 1 });
        tvary.push(t);
      }
      if (!P.oblasti.length && P.prvky.some(p => p.pero === 'obrys')) hlaseni.push({ druh: 'varovani', text: `${P.ramec.nazev}: z čar nevznikl uzavřený obrys.`, prvky: P.prvky.map(p => p.id) });
    }

    // automatické vazby: rovné úseky vodorovně/svisle podle kresby
    for (const t of tvary) {
      if (t.typ !== 'cesta') continue;
      const k = t.body.length;
      for (let i = 0; i < k; i++) {
        const a = t.body[i], c = t.body[(i + 1) % k];
        // oblouk: konce na vodorovné/svislé tětivě drží spolu (jinak by je řešič rozhodil a oblouk se zkroutil)
        const ref = a.b ? { a: { t: t.id, b: i }, b: { t: t.id, b: (i + 1) % k } } : { a: { t: t.id, u: i } };
        // id „a…“ = odhad z kresby – při rozporu s kótami ustoupí (zpracuj)
        if (abs(a.y - c.y) < 1e-6) vazby.push(Object.assign({ typ: 'vodorovne', id: 'a' + vazby.length }, ref));
        else if (abs(a.x - c.x) < 1e-6) vazby.push(Object.assign({ typ: 'svisle', id: 'a' + vazby.length }, ref));
      }
    }

    // body pro kóty a mezipohledové vazby
    const bodyPohledu = id => {
      const out = [];
      for (const t of tvary) {
        if (t.pohled !== id) continue;
        if (t.typ === 'kruh') out.push({ x: t.x, y: t.y, ref: { t: t.id, b: 's' }, kruh: t });
        else t.body.forEach((b, i) => out.push({ x: b.x, y: b.y, ref: { t: t.id, b: i } }));
      }
      return out;
    };

    // pomocná osa u rotačního listu (pevná)
    let osaRef = null;
    if (vykres.typ === 'rotacni' && rv.osa) {
      const o = rv.osa;
      tvary.push({ id: 'osa', typ: 'cesta', body: [{ x: o.x1, y: o.y1, b: 0 }, { x: o.x2, y: o.y2, b: 0 }], pohled: 'profil', pomocny: true });
      vazby.push({ typ: 'pevny', a: { t: 'osa', b: 0 }, hodnota: [o.x1, o.y1] }, { typ: 'pevny', a: { t: 'osa', b: 1 }, hodnota: [o.x2, o.y2] });
      osaRef = { t: 'osa', b: 0, x: o.x1 };
      for (const b of bodyPohledu('profil')) if (!b.kruh && abs(b.x - o.x1) < 1e-6) vazby.push({ typ: 'svisle', a: osaRef, b: b.ref });
    }

    // kóty
    for (const [id, P] of Object.entries(pohledy)) {
      const body = bodyPohledu(id);
      for (const k of P.koty) koty.push(Object.assign({ id: k.id, pohled: id }, priradKotu(k, body, tvary, osaRef, vazby)));
    }

    // mezipohledové vazby (tři pohledy): stejné X nárys ↔ půdorys, stejné Z (y listu) nárys ↔ bokorys
    if (vykres.typ === 'pohledy') {
      const spoj = (id1, id2, osa, typ) => {
        // jen vrcholy obrysů – díra v jednom pohledu se v druhém kreslí skrytou čarou, ne obrysem
        const b1 = bodyPohledu(id1).filter(b => !b.kruh), b2 = bodyPohledu(id2).filter(b => !b.kruh), hotove = new Set();
        for (const p of b1) {
          const klic = Math.round(p[osa] * 2);
          if (hotove.has(klic)) continue;
          const q = b2.find(q => abs(q[osa] - p[osa]) < 0.6);
          if (!q) continue;
          hotove.add(klic);
          vazby.push({ typ, a: p.ref, b: q.ref, mezipohled: true, id: 'a' + vazby.length });
        }
      };
      spoj('narys', 'pudorys', 'x', 'svisle');
      spoj('narys', 'bokorys', 'y', 'vodorovne');
    }

    // kotvy: každá skupina obrysů spojená kótami / mezipohledovými vazbami (samostatný díl) dostane jednu kotvu
    // v levém dolním bodě (u tří pohledů přednostně v nárysu) – při změně kóty roste díl doprava nahoru, ne na obě strany
    const rod = new Map(tvary.filter(t => !t.pomocny).map(t => [t.id, t.id]));
    const najdi = i => { while (rod.get(i) !== i) { rod.set(i, rod.get(rod.get(i))); i = rod.get(i); } return i; };
    for (const z of vazby) if (z.a && z.b && rod.has(z.a.t) && rod.has(z.b.t)) rod.set(najdi(z.a.t), najdi(z.b.t));
    const skupiny = new Map();
    for (const t of tvary) if (rod.has(t.id)) { const r = najdi(t.id); if (!skupiny.has(r)) skupiny.set(r, []); skupiny.get(r).push(t); }
    const kotvy = [];
    for (const ts of skupiny.values()) {
      const ids = new Set(ts.filter(t => t.typ === 'cesta').map(t => t.id));
      if (!ids.size) continue;                                  // samotné kružnice (díry) se drží kresby
      let b = Object.keys(pohledy).flatMap(id => bodyPohledu(id)).filter(q => !q.kruh && ids.has(q.ref.t));
      if (vykres.typ === 'pohledy' && b.some(q => tvary.find(t => t.id === q.ref.t).pohled === 'narys')) b = b.filter(q => tvary.find(t => t.id === q.ref.t).pohled === 'narys');
      b.sort((p, q) => (q.y - p.y) || (p.x - q.x));
      kotvy.push({ typ: 'pevny', a: b[0].ref, hodnota: [b[0].x, b[0].y], kotva: true, plocha: ts.length });
    }
    // první kotva (střed přeškálování) = největší skupina
    kotvy.sort((a, b) => b.plocha - a.plocha);
    for (const z of kotvy) { delete z.plocha; vazby.push(z); }
    return { rv, pohledy, tvary, vazby, koty, hlaseni };
  };

  function vnitrniBod(l) {
    // těžiště, když leží uvnitř; jinak střed prvního úseku posunutý dovnitř
    let x = 0, y = 0; for (const p of l) { x += p[0]; y += p[1]; } x /= l.length; y /= l.length;
    if (uvnitr(l, x, y)) return [x, y];
    for (let i = 0; i < l.length; i++) {
      const a = l[i], c = l[(i + 1) % l.length], mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2, d = hypot(c[0] - a[0], c[1] - a[1]) || 1;
      for (const s of [1, -1]) { const px = mx - s * (c[1] - a[1]) / d * 0.3, py = my + s * (c[0] - a[0]) / d * 0.3; if (uvnitr(l, px, py)) return [px, py]; }
    }
    return l[0];
  }

  /** Přiřadí kótu k bodům/kružnici a přidá vazbu. Vrací {stav, typ, popis, vazba}. */
  function priradKotu(k, body, tvary, osaRef, vazby) {
    const h = k.hodnota;
    if (h == null || !(h > 0)) return { stav: 'bez čísla', popis: 'kóta bez čísla' };
    const [ax, ay] = k.a, [bx, by] = k.b, dx = bx - ax, dy = by - ay, L = hypot(dx, dy) || 1;
    // kružnice: oba konce na obvodu a čára přes střed = průměr; konec ve středu a na obvodu = poloměr
    for (const t of tvary) {
      if (t.typ !== 'kruh' || !body.some(b => b.kruh === t)) continue;
      const r = t.rx, tol = max(1.5, 0.25 * r);
      const da = hypot(ax - t.x, ay - t.y), db = hypot(bx - t.x, by - t.y);
      const pres = abs(dx * (t.y - ay) - dy * (t.x - ax)) / L;
      if (abs(da - r) < tol && abs(db - r) < tol && pres < max(1, 0.3 * r)) return pridej({ typ: 'prumer', a: { t: t.id, k: 1 }, hodnota: h }, '⌀' + fmt(h));
      if ((da < max(1, 0.3 * r) && abs(db - r) < tol) || (db < max(1, 0.3 * r) && abs(da - r) < tol)) return pridej({ typ: 'prumer', a: { t: t.id, k: 1 }, hodnota: 2 * h }, 'R' + fmt(h));
    }
    const vodor = abs(dy) <= abs(dx) * 0.18, svis = abs(dx) <= abs(dy) * 0.18;
    // rotační list: vodorovná kóta od osy = průměr (měří se dvojnásobek vzdálenosti od osy)
    if (vodor && osaRef && (abs(ax - osaRef.x) < TOL_KOTA || abs(bx - osaRef.x) < TOL_KOTA)) {
      const druhy = abs(ax - osaRef.x) < TOL_KOTA ? [bx, by] : [ax, ay];
      const p = nejblizsi(body.filter(b => !b.kruh && abs(b.x - osaRef.x) > 0.5), druhy, 'x');
      if (!p) return { stav: 'nepřiřazená', popis: '⌀' + fmt(h) + ' – nenašel se bod obrysu' };
      return pridej({ typ: 'vzdalX', a: { t: osaRef.t, b: osaRef.b }, b: p.ref, hodnota: h / 2, smer: p.x >= osaRef.x ? 1 : -1 }, '⌀' + fmt(h), [[osaRef.x, p.y], [p.x, p.y]]);
    }
    if (vodor || svis) {
      const osa = vodor ? 'x' : 'y';
      const p = nejblizsi(body, k.a, osa), q = nejblizsi(body.filter(b => b !== p), k.b, osa);
      if (!p || !q || abs(p[osa] - q[osa]) < 0.5) return { stav: 'nepřiřazená', popis: fmt(h) + ' – konce kóty nesedí na body obrysu' };
      return pridej({ typ: vodor ? 'vzdalX' : 'vzdalY', a: p.ref, b: q.ref, hodnota: h, smer: q[osa] >= p[osa] ? 1 : -1 }, fmt(h), [[p.x, p.y], [q.x, q.y]]);
    }
    // šikmá kóta: nejbližší body ke koncům (odsazená kóta si měřené body pamatuje v m)
    const m = Array.isArray(k.m) ? k.m : [k.a, k.b];
    const p = nejblizsiBod(body, m[0]), q = nejblizsiBod(body.filter(b => b !== p), m[1]);
    if (!p || !q) return { stav: 'nepřiřazená', popis: fmt(h) + ' – konce kóty nesedí na body obrysu' };
    return pridej({ typ: 'delka', a: p.ref, b: q.ref, hodnota: h }, fmt(h), [[p.x, p.y], [q.x, q.y]]);

    /** body = měřené body v kresbě [[x, y], [x, y]] (pro vynášecí čáry a odsazení kóty) */
    function pridej(v, popis, body) {
      // vlastní krátké id (řešič přijme jen [\w-]{1,24}, jinak by ho přečísloval a rozpor by se nespároval s kótou)
      v.id = 'k' + vazby.length; v.kota = k.id;
      vazby.push(v);
      return { stav: 'ok', typ: v.typ, popis, vazba: v.id, body: body || null, tvary: [v.a.t, v.b && v.b.t] };
    }
  }
  const fmt = v => String(+(+v).toFixed(3)).replace('.', ',');
  /** Bod, jehož souřadnice v ose měření sedí ke konci kóty (do TOL_KOTA); při shodě bližší napříč. */
  function nejblizsi(body, kon, osa) {
    const i = osa === 'x' ? 0 : 1, j = 1 - i;
    let nej = null, sk = Infinity;
    for (const b of body) {
      const d = abs((osa === 'x' ? b.x : b.y) - kon[i]);
      if (d > TOL_KOTA) continue;
      const s = d * 10 + abs((osa === 'x' ? b.y : b.x) - kon[j]);
      if (s < sk) { sk = s; nej = b; }
    }
    return nej;
  }
  function nejblizsiBod(body, kon) {
    let nej = null, dn = 4;
    for (const b of body) { const d = hypot(b.x - kon[0], b.y - kon[1]); if (d < dn) { dn = d; nej = b; } }
    return nej;
  }

  // ------------------------------------------------------------ odsazení kóty od kresby
  const ODSAZENI = 8, ROZESTUP = 7;     // mm – první kóta od obrysu, další kóty na téže straně
  /** Nová poloha kóty mimo kresbu: {a, b} nebo null (kóta nepřiřazená / bez místa v rámečku).
      Vodorovná jde nad/pod obrys (podle strany, kde byla nakreslená), svislá vlevo/vpravo, šikmá kolmo ven;
      kóty na téže straně se řadí za sebe. prvky = všechny prvky výkresu (kvůli ostatním kótám). */
  N.umistiKotu = function (v, kota, prvky) {
    const kk = v && v.koty.find(q => q.id === kota.id);
    if (!kk || kk.stav !== 'ok' || !kk.body || !['vzdalX', 'vzdalY', 'delka'].includes(kk.typ)) return null;
    const P = v.pohledy[kk.pohled], r = P && P.ramec;
    // oba body na jednom obrysu (výřez, díra) → odsadit od něj, jinak od celého pohledu
    const jeden = kk.tvary && kk.tvary[0] === kk.tvary[1] ? kk.tvary[0] : null;
    const l = v.tvary.filter(t => t.pohled === kk.pohled && !t.pomocny && (!jeden || t.id === jeden)).flatMap(t => t.typ === 'kruh'
      ? [[t.x - t.rx, t.y - t.rx], [t.x + t.rx, t.y + t.rx]] : lomenaObrysu(t.body));
    if (!r || !l.length) return null;
    const bb = [min(...l.map(p => p[0])), min(...l.map(p => p[1])), max(...l.map(p => p[0])), max(...l.map(p => p[1]))];
    const [p, q] = kk.body, mx = (kota.a[0] + kota.b[0]) / 2, my = (kota.a[1] + kota.b[1]) / 2;
    const jine = prvky.filter(o => o.druh === 'kota' && o.id !== kota.id);
    if (kk.typ === 'delka') {
      const dx = q[0] - p[0], dy = q[1] - p[1], L = hypot(dx, dy) || 1;
      let nx = -dy / L, ny = dx / L;
      if ((p[0] + q[0]) / 2 * nx + (p[1] + q[1]) / 2 * ny < (bb[0] + bb[2]) / 2 * nx + (bb[1] + bb[3]) / 2 * ny) { nx = -nx; ny = -ny; }
      const a = [p[0] + nx * ODSAZENI, p[1] + ny * ODSAZENI], b = [q[0] + nx * ODSAZENI, q[1] + ny * ODSAZENI];
      return [a, b].every(([x, y]) => x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1) ? { a, b, m: [p.slice(), q.slice()] } : null;
    }
    const vod = kk.typ === 'vzdalX', i = vod ? 1 : 0;               // osa, ve které se kóta posouvá
    const od = min(p[1 - i], q[1 - i]), do_ = max(p[1 - i], q[1 - i]);
    const zkus = strana => {
      let c = (strana < 0 ? bb[i] : bb[i + 2]) + strana * ODSAZENI;
      for (let n = 0; n < 20; n++) {
        const srazka = jine.some(o => {
          const oa = o.a[i], ob = o.b[i];
          if (abs(oa - ob) > 0.5) return false;                  // jiná orientace
          return abs(oa - c) < ROZESTUP - 0.5 && min(o.a[1 - i], o.b[1 - i]) < do_ && max(o.a[1 - i], o.b[1 - i]) > od;
        });
        if (!srazka) break;
        c += strana * ROZESTUP;
      }
      const meze = vod ? [r.y0 + 3, r.y1 - 3] : [r.x0 + 3, r.x1 - 3];
      return c > meze[0] && c < meze[1] ? c : null;
    };
    const strana = (vod ? my : mx) < (bb[i] + bb[i + 2]) / 2 ? -1 : 1;
    const c = zkus(strana) ?? zkus(-strana);
    if (c == null) return null;
    return vod ? { a: [p[0], c], b: [q[0], c] } : { a: [c, p[1]], b: [c, q[1]] };
  };

  // ------------------------------------------------------------ řešení
  /** Měřítko kresby: medián poměru kóta / nakreslená délka (kresba nemusí být v měřítku 1:1).
      Kresba se jím nejdřív celá přeškáluje (tvar zůstane), řešič pak dorovná jednotlivé kóty –
      už první kóta tak určí velikost a nezakótované rozměry rostou s ní. */
  // osa listu v pohledu → osa dílu (u tří pohledů sdílí nárys s půdorysem X a s bokorysem Z, půdorys s bokorysem hloubku)
  const OSY_POHLEDU = { narys: { x: 'X', y: 'Z' }, pudorys: { x: 'X', y: 'D' }, bokorys: { x: 'D', y: 'Z' } };
  const median = a => { a = a.slice().sort((p, q) => p - q); const n = a.length; return n % 2 ? a[n >> 1] : Math.sqrt(a[n / 2 - 1] * a[n / 2]); };
  function meritkoKresby(v, typ) {
    const vse = [], podleOsy = {}, pohledTvaru = new Map(v.tvary.map(t => [t.id, t.pohled]));
    const osaDilu = (pohled, osa) => typ === 'pohledy' ? (OSY_POHLEDU[pohled] || {})[osa] || osa : osa;
    for (const z of v.vazby) {
      if (!z.kota || !(z.hodnota > 0)) continue;
      const m = M.zmerVazbu(v.tvary, z);
      if (!(m > 0.5)) continue;
      const r = z.hodnota / m;
      vse.push(r);
      if (z.typ === 'vzdalX' || z.typ === 'vzdalY') {
        const o = osaDilu(pohledTvaru.get(z.b.t), z.typ === 'vzdalX' ? 'x' : 'y');
        (podleOsy[o] = podleOsy[o] || []).push(r);
      }
    }
    // kóta, která přesně sedí s kresbou (±2 %), je důkaz kresby 1 : 1 – pak se jen dorovnají ostatní kóty
    const odhad = a => a.some(r => abs(r - 1) < 0.02) ? 1 : median(a);
    const k = vse.length ? odhad(vse) : 1;
    const ok = r => r > 0.05 && r < 20 && abs(r - 1) > 1e-6 ? r : 1;
    const f = {};
    for (const [o, a] of Object.entries(podleOsy)) f[o] = odhad(a);
    return { k: ok(k), osa: (pohled, osa) => ok(f[osaDilu(pohled, osa)] != null ? f[osaDilu(pohled, osa)] : k) };
  }

  N.zpracuj = function (vykres) {
    const v = N.vyloz(vykres);
    const pouzite = v.tvary;
    // kresba v jiném měřítku → nejdřív přeškálovat kolem kotev, ať řešič mění tvar co nejméně
    // měřítko zvlášť pro každý směr (kresba bývá jinak natažená na šířku a na výšku)
    const mer = meritkoKresby(v, vykres.typ), k = mer.k;
    v.meritko = k;
    // střed škálování: kotva (u tří pohledů kotva nárysu); půdorys a bokorys sdílejí s nárysem jen jednu osu,
    // ve druhé (hloubka) se škálují od svého zadního okraje → zarovnání zůstane a pohledy neodjedou
    const kotva = v.vazby.find(z => z.kotva), c = kotva ? kotva.hodnota : [0, 0];
    const minPohledu = (id, i) => min(...pouzite.filter(t => t.pohled === id && !t.pomocny).flatMap(t => t.typ === 'kruh' ? [i ? t.y - t.rx : t.x - t.rx] : t.body.map(b => i ? b.y : b.x)));
    const stredy = vykres.typ === 'pohledy' ? { narys: c, pudorys: [c[0], minPohledu('pudorys', 1)], bokorys: [minPohledu('bokorys', 0), c[1]] } : {};
    /** Tvary přeškálované měřítkem po osách (obrácené = zpět do měřítka kresby) kolem středů pohledů. */
    const preskaluj = (tvary, obracene) => tvary.map(t => {
      if (t.pomocny) return t;
      let fx = mer.osa(t.pohled, 'x'), fy = mer.osa(t.pohled, 'y');
      if (fx === 1 && fy === 1) return t;
      if (obracene) { fx = 1 / fx; fy = 1 / fy; }
      const q = stredy[t.pohled] || c, sk = (x, y) => [q[0] + (x - q[0]) * fx, q[1] + (y - q[1]) * fy];
      if (t.typ === 'kruh') { const [x, y] = sk(t.x, t.y), f = Math.sqrt(fx * fy); return Object.assign({}, t, { x, y, rx: t.rx * f, ry: t.ry * f }); }
      return Object.assign({}, t, { body: t.body.map(b => { const [x, y] = sk(b.x, b.y); return { x, y, b: b.b }; }) });
    });
    const start = preskaluj(pouzite, false);
    let res = { tvary: start, ok: true, zbytek: 0, konflikt: [], volnost: 0, urcene: [] };
    if (start.length) {
      // kóty mají přednost před odhadem z kresby: vodorovně/svisle (id „a…“), které se s nimi pohádají, se uvolní
      let vazby = v.vazby;
      const uvolnene = [];
      res = M.resVazbySkici(start, vazby, {});
      let rozpocet = 24;                                       // strop počtu řešení – výklad běží po každé změně
      for (let pokus = 0; !res.ok && pokus < 6 && rozpocet > 0; pokus++) {
        const odhad = (res.konflikt || []).filter(id => /^a\d+$/.test(id));
        if (!odhad.length) break;
        // po jedné: první odhad, jehož uvolnění rozpor vyřeší; jinak ten, který nejvíc zmenší zbytek
        let vyber = null, r2 = null, nej = null;
        for (const id of odhad) {
          if (rozpocet-- <= 0) break;
          const r = M.resVazbySkici(start, vazby.filter(z => z.id !== id), {});
          if (r.ok) { vyber = id; r2 = r; break; }
          if (!nej || r.zbytek < nej.r.zbytek) nej = { id, r };
        }
        if (!vyber) {
          if (!nej || nej.r.zbytek > res.zbytek * 0.9) break;   // odhad nepomáhá → skutečný rozpor kót
          vyber = nej.id; r2 = nej.r;
        }
        uvolnene.push(vyber);
        vazby = vazby.filter(z => z.id !== vyber);
        res = r2;
      }
      if (res.ok && uvolnene.length) v.hlaseni.push({ druh: 'info', text: `Kóty vyžadují šikmou hranu – ${uvolnene.length === 1 ? 'jedna hrana přestala' : uvolnene.length + ' hran přestalo'} být vodorovná/svislá podle kresby.` });
      v.uvolnene = uvolnene;
      // řešič vrací kopie bez vlastních klíčů – vrátit pohled a pomocné příznaky
      res.tvary = res.tvary.map((t, i) => Object.assign({}, t, { pohled: start[i].pohled, pomocny: start[i].pomocny }));
    }
    const konflikt = new Set(res.konflikt || []);
    for (const kk of v.koty) if (kk.vazba && konflikt.has(kk.vazba)) kk.stav = 'rozpor';
    if (!res.ok) {
      const kotyVRozporu = v.koty.filter(kk => kk.stav === 'rozpor');
      v.hlaseni.push({ druh: 'chyba', text: kotyVRozporu.length ? 'Kóty si odporují: ' + kotyVRozporu.map(kk => kk.popis).join(', ') + '.' : 'Rozměry nejdou splnit současně (rozpor ve vazbách).', prvky: kotyVRozporu.map(kk => kk.id) });
    }
    const nepr = v.koty.filter(kk => kk.stav === 'nepřiřazená');
    if (nepr.length) v.hlaseni.push({ druh: 'varovani', text: 'Kóty bez přiřazení: ' + nepr.map(kk => kk.popis).join('; ') + '. Konce kóty dejte nad body obrysu.', prvky: nepr.map(kk => kk.id) });
    const bez = v.koty.filter(kk => kk.stav === 'bez čísla');
    if (bez.length) v.hlaseni.push({ druh: 'varovani', text: 'Kóty bez čísla: ' + bez.length + ' (dvojklikem doplníte).', prvky: bez.map(kk => kk.id) });
    if (abs(k - 1) > 0.05) v.hlaseni.push({ druh: 'info', text: 'Kresba je v měřítku přibližně ' + (k >= 1 ? '1 : ' + fmt(+k.toFixed(2)) : fmt(+(1 / k).toFixed(2)) + ' : 1') + ' – rozměry se dopočítaly z kót.' });
    // rotační díl: profil nesmí na druhou stranu osy (rotace by se protínala sama se sebou)
    const osa = v.tvary.find(t => t.pomocny);
    if (vykres.typ === 'rotacni' && osa) {
      const ox = osa.body[0].x;
      const pres = res.tvary.filter(t => !t.pomocny && (t.typ === 'kruh' ? t.x - t.rx < ox - 0.01 : lomenaObrysu(t.body).some(p => p[0] < ox - 0.01)));
      if (pres.length) v.hlaseni.push({ druh: 'chyba', text: 'Profil přechází přes osu – rotační díl se kreslí jen vpravo od osy.', prvky: [] });
    }
    const obrysu = v.tvary.filter(t => !t.pomocny).length;
    if (obrysu && res.ok) {
      const neurcene = v.tvary.filter(t => !t.pomocny && !(res.urcene || []).includes(t.id)).length;
      v.hlaseni.push({ druh: neurcene ? 'info' : 'ok', text: neurcene
        ? `Zakótované rozměry: ${v.koty.filter(kk => kk.stav === 'ok').length}. Obrysy, které kóty plně neurčují (${neurcene} z ${obrysu}), mají zbylé rozměry z kresby v jejím měřítku.`
        : 'Všechny obrysy jsou plně určené kótami.' });
    }
    // tvary = skutečné rozměry (pro stavbu), zobrazit = totéž v měřítku kresby (modrý náhled se kryje s kresbou)
    v.vysledek = { tvary: res.tvary, zobrazit: preskaluj(res.tvary, true), ok: res.ok, volnost: res.volnost, urcene: res.urcene || [] };
    return v;
  };

  if (typeof module !== 'undefined') module.exports = N;
})(N3D);
