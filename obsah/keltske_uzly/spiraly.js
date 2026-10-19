/* Keltské uzly – spirály (bez DOM, testuje se v node).
   Dvojitá spirála: dvě ramena r = Rs·t/T (t ∈ ⟨t0, T⟩, T = 2π·závity) pootočená o π;
   jedno vede dovnitř, ve středu je spojí oblouk tvaru S a druhé vede ven.
   Typy:
     retez   – n spirál dokola spojených v jednu uzavřenou čáru (trojitá spirála z Newgrange),
     triskel – n ramen ze středu, každé se stočí do spirály,
     vlna    – řada spirál vedle sebe („běžící pes", ornament na okraj). */
window.KELT_SPIRALY = (function () {
  const e = a => [Math.cos(a), Math.sin(a)];
  const plus = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k];
  const delka = v => Math.hypot(v[0], v[1]);
  const jedn = v => { const d = delka(v) || 1; return [v[0] / d, v[1] / d]; };

  function bezier(P0, P1, P2, P3, n) {
    const out = [];
    for (let q = 0; q <= n; q++) {
      const t = q / n, u = 1 - t;
      out.push([u * u * u * P0[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * P3[0],
                u * u * u * P0[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * P3[1]]);
    }
    return out;
  }
  /** spojka dvou bodů s danými směry pohybu (jednotkové tečny) */
  function spojka(A, tA, B, tB, k) {
    const L = delka([B[0] - A[0], B[1] - A[1]]) * (k || 0.45);
    return bezier(A, plus(A, tA, L), plus(B, tB, -L), B, 24);
  }

  /** Jedna spirála se středem C a poloměrem Rs. Rameno `a` = β + s·t, rameno `b` = β + π + s·t.
      Vrací body a tečny, ze kterých se skládají čáry. */
  function spirala(C, Rs, zavity, beta, s) {
    const T = 2 * Math.PI * zavity, t0 = Math.PI * 0.75;
    const bod = (t, posun) => { const r = Rs * t / T; return plus(C, e(beta + posun + s * t), r); };
    // směr pohybu při rostoucím t (ven)
    const ven = (t, posun) => { const a = beta + posun + s * t, r = Rs * t / T; return jedn(plus(e(a), [-Math.sin(a) * s, Math.cos(a) * s], r / (Rs / T))); };
    const krok = Math.PI / 24;
    const rameno = (posun, dovnitr) => {
      const b = [];
      for (let t = T; t > t0; t -= krok) b.push(bod(t, posun));
      b.push(bod(t0, posun));
      return dovnitr ? b : b.reverse();
    };
    return {
      T, t0, Rs, mezera: Rs / (2 * zavity),
      dovnitr: rameno(0, true),                       // rameno a od kraje ke středu
      ven: rameno(Math.PI, false),                    // rameno b od středu ke kraji
      stredS: () => {                                  // oblouk S ve středu z konce ramene a na začátek ramene b
        const A = bod(t0, 0), B = bod(t0, Math.PI), d = ven(t0, 0).map(v => -v);
        return spojka(A, d, B, ven(t0, Math.PI), 1.1);
      },
      zacatekDovnitr: { p: bod(T, 0), smer: ven(T, 0).map(v => -v) },
      konecVen: { p: bod(T, Math.PI), smer: ven(T, Math.PI) },
      uhel: { dovnitr: beta + s * T, ven: beta + Math.PI + s * T },
    };
  }
  /** β tak, aby vnější konec ramene „ven" ležel pod úhlem alfa */
  const betaPro = (alfa, zavity, s) => alfa - Math.PI - s * 2 * Math.PI * zavity;

  function spoj(...casti) {
    const out = [];
    for (const c of casti) for (const p of c) {
      const l = out[out.length - 1];
      if (!l || Math.hypot(l[0] - p[0], l[1] - p[1]) > 1e-9) out.push(p);
    }
    return out;
  }

  /** p = { typ, n, zavity, natoceni (°), smer (±1) } → { krivky: [{ body, uzavreny }], ozdoby: [{ stred, r }], mezera } */
  function sestav(p) {
    const typ = p.typ || 'retez', s = p.smer === -1 ? -1 : 1, Z = Math.max(0.75, +p.zavity || 2);
    const g = (+p.natoceni || 0) * Math.PI / 180;
    let n = Math.round(+p.n || 3);
    if (typ === 'vlna') n = Math.min(10, Math.max(2, n)); else n = Math.min(8, Math.max(typ === 'triskel' ? 2 : 1, n));
    const krivky = [], ozdoby = [];

    if (typ === 'vlna') {
      const Rs = 1, D = 2.12 * Rs, sp = [];
      for (let k = 0; k < n; k++) {
        const C = [(k - (n - 1) / 2) * D, 0];
        // vnější konec ramene ven míří k další spirále (střídavě nahoru a dolů vznikne vlna)
        sp.push(spirala(C, Rs, Z, betaPro(-s * Math.PI / 2 + g, Z, s), s));
      }
      const casti = [];
      const prvni = sp[0].zacatekDovnitr;
      casti.push([plus(prvni.p, prvni.smer, -0.9 * Rs), prvni.p]);   // volný začátek
      sp.forEach((q, k) => {
        casti.push(q.dovnitr, q.stredS(), q.ven);
        if (k < n - 1) casti.push(spojka(q.konecVen.p, q.konecVen.smer, sp[k + 1].zacatekDovnitr.p, sp[k + 1].zacatekDovnitr.smer));
      });
      const posl = sp[n - 1].konecVen;
      casti.push([posl.p, plus(posl.p, posl.smer, 0.9 * Rs)]);         // volný konec
      krivky.push({ body: spoj(...casti), uzavreny: false });
      return { krivky, ozdoby, mezera: sp[0].mezera };
    }

    if (n === 1) {   // samostatná dvojitá spirála s volnými konci
      const q = spirala([0, 0], 1, Z, betaPro(g, Z, s), s);
      const a = q.zacatekDovnitr, b = q.konecVen;
      krivky.push({ body: spoj([plus(a.p, a.smer, -0.6), a.p], q.dovnitr, q.stredS(), q.ven, [b.p, plus(b.p, b.smer, 0.6)]), uzavreny: false });
      return { krivky, ozdoby, mezera: q.mezera };
    }

    const Rc = 1, Rs = Math.min(0.95, 0.9 * Math.sin(Math.PI / n)) * Rc;
    const C = k => { const f = -Math.PI / 2 + 2 * Math.PI * (k % n) / n; return [Rc * Math.cos(f), Rc * Math.sin(f)]; };

    if (typ === 'triskel') {
      // Klasický triskel: vnější konec každé spirály leží přímo ve středu, ramena z něj
      // vycházejí jako lopatky. r = (t/T)^1,5 – spirála se ke středu stahuje rychleji, takže
      // se sousední ramena nepřekrývají. Střed spirály k je ve vzdálenosti 1 pod úhlem f.
      const T = 2 * Math.PI * Z, P = 1.5, t0 = 0.18 * T;
      for (let k = 0; k < n; k++) {
        const f = -Math.PI / 2 + 2 * Math.PI * k / n + g, Ck = e(f), body = [];
        for (let t = T; t > t0; t -= Math.PI / 30) {
          const r = Math.pow(t / T, P), a = f + Math.PI + s * (t - T);
          body.push(plus(Ck, e(a), r));
        }
        krivky.push({ body, uzavreny: false });
      }
      ozdoby.push({ stred: [0, 0], r: 0.09 });
      return { krivky, ozdoby, mezera: 1.0 / Z / 2 * P * Math.pow(0.6, P - 1) };
    }

    // řetěz dokola – jedna uzavřená čára
    const sp = [];
    for (let k = 0; k < n; k++) {
      const a = C(k), b = C(k + 1), d = Math.atan2(b[1] - a[1], b[0] - a[0]);
      sp.push(spirala(a, Rs, Z, betaPro(d - s * Math.PI / 2 + g, Z, s), s));
    }
    const casti = [];
    sp.forEach((q, k) => {
      const dal = sp[(k + 1) % n];
      casti.push(q.dovnitr, q.stredS(), q.ven, spojka(q.konecVen.p, q.konecVen.smer, dal.zacatekDovnitr.p, dal.zacatekDovnitr.smer));
    });
    const body = spoj(...casti);
    body.pop();   // poslední bod = první
    krivky.push({ body, uzavreny: true });
    return { krivky, ozdoby, mezera: sp[0].mezera };
  }

  /* odkaz: s-<typ>-<n>-<závity×4>-<natočení+180>-<směr> */
  const TYPY = ['retez', 'triskel', 'vlna'];
  function zakoduj(p) { return ['s', TYPY.indexOf(p.typ) < 0 ? 0 : TYPY.indexOf(p.typ), p.n, Math.round(p.zavity * 4), Math.round(p.natoceni) + 180, p.smer === -1 ? 1 : 0].join('-'); }
  function dekoduj(t) {
    const m = /^s-(\d)-(\d+)-(\d+)-(\d+)-([01])$/.exec(t || '');
    if (!m) return null;
    return { typ: TYPY[+m[1]] || 'retez', n: Math.min(10, Math.max(1, +m[2])), zavity: Math.min(6, Math.max(0.75, +m[3] / 4)), natoceni: Math.min(180, Math.max(-180, +m[4] - 180)), smer: m[5] === '1' ? -1 : 1 };
  }

  return { sestav, spirala, zakoduj, dekoduj };
})();
