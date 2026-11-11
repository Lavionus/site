/* Z náčrtu do 3D – virtuální papír: kreslení myší, prstem i perem na listu.
   Pointer Events: pero kreslí a od prvního tahu perem se dotyk prstů bere jen jako posun a zoom (dlaň);
   bez pera kreslí jeden prst a dva prsty posouvají a zoomují. Myš: levé tlačítko kreslí, prostřední/pravé
   nebo mezerník + tah posouvá, kolečko zoomuje.
   Po zvednutí pera se tah rozpozná (tahy.js) a přichytí. Kóta = úsečka perem „kóta“, hned se ptá na číslo.
   model = { vykres: {typ, format, prvky: []}, nast: {nastroj, prichyt, surove}, zmena(popis), info(text) } */
(function (N) {
  'use strict';
  const { hypot, max, min, exp, round, atan2, cos, sin, abs, PI } = Math;
  const STYL = {
    obrys: { barva: '#1a1a1a', sila: 0.5 },
    skryta: { barva: '#1a1a1a', sila: 0.35, carky: [2.5, 1.5] },
    osa: { barva: '#1a1a1a', sila: 0.25, carky: [6, 1.5, 1, 1.5] },
    kota: { barva: '#d0302a', sila: 0.3 },
  };
  N.STYL_PER = STYL;
  const MAX_ZPET = 100, MAX_BODU_TAHU = 3000;

  N.vytvorPapir = function (platno, obal, model) {
    const ctx = platno.getContext('2d');
    let s = 2, ox = 0, oy = 0, w = 0, h = 0, dpr = 1;   // s = px na mm (CSS px), ox/oy = posun listu
    let rv = null, pozadi = null, pozadiKlic = '';
    let tah = null;                                     // rozpracovaný tah {pero, body, tlak, id ukazatele}
    let posun = null;                                   // {x, y, ox, oy, id}
    const dotyky = new Map();                           // aktivní dotyky prstů
    let stipnuti = null, maPero = false, mezernik = false, kurzor = null, nahoreNad = null;
    let vlastniPohled = false;                          // uživatel zoomoval/posouval → při změně okna nepřizpůsobovat
    let tazeni = null;                                  // tažený úchyt ve výběru {p, kde, id, zmeneno}
    let kon = null;                                     // rozkreslený tvar {nastroj, body, kurzor, dolu, koty}
    let presun = null;                                  // posun výběru {id, ref, puvodni: Map(id → kopie), zmeneno}
    let ramVyberu = null;                               // výběrový obdélník {id, x0, y0, x1, y1, pridat}
    let roh = null;                                     // roh pod kurzorem u zaoblení/zkosení [x, y]
    let rohKlik = null;                                 // stisk u zaoblení/zkosení {id, x, y}
    let voditkoKon = null;                              // nová vodicí linka {id, a: [x, y], uhly()}
    let nahoreNadV = null;                              // vodicí linka pod gumou
    let mereni = null;                                  // měření {a, b, pevne}
    let klikNastroje = null;                            // stisk u odsazení / ořezu {id, x, y, shift}
    const CHYTA = new Set(['usecka', 'obdelnik', 'kruh', 'dira', 'oblouk', 'kota', 'voditko', 'mereni']);
    const vybrane = () => model.vybrane || (model.vybrane = []);
    const jeTvar = n => !!(N.NASTROJE_TVARU && N.NASTROJE_TVARU[n]);
    const zpet = [], vpred = [];
    let ceka = false;

    const mm = (cx, cy) => [(cx - ox) / s, (cy - oy) / s];
    const souradnice = e => { const r = platno.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const noveId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    // ---------------------------------------------------------- zpět / vpřed
    const snimek = () => JSON.stringify({ prvky: model.vykres.prvky, voditka: model.vykres.voditka || [] });
    function zapamatuj() {
      zpet.push(snimek());
      if (zpet.length > MAX_ZPET) zpet.shift();
      vpred.length = 0;
    }
    function vrat(z, do_) {
      if (!z.length) return false;
      do_.push(snimek());
      const st = JSON.parse(z.pop());
      model.vykres.prvky = st.prvky; model.vykres.voditka = st.voditka;
      zavriKotu(false);
      tazeni = null;
      model.zmena('zpet');
      // vybrané prvky po vrácení nemusí existovat
      kon = null; presun = null;
      vyber(vybrane().filter(id => model.vykres.prvky.some(p => p.id === id)));
      return true;
    }

    // ---------------------------------------------------------- velikost a pohled
    function prizpusob() {
      rv = N.rozvrh(model.vykres.typ, model.vykres.format);
      const okraj = 16;
      s = max(0.5, min((w - 2 * okraj) / rv.w, (h - 2 * okraj) / rv.h));
      ox = (w - rv.w * s) / 2; oy = (h - rv.h * s) / 2;
      vlastniPohled = false;
      prekresli();
    }
    function velikost() {
      dpr = window.devicePixelRatio || 1;
      w = obal.clientWidth; h = obal.clientHeight;
      platno.style.width = w + 'px'; platno.style.height = h + 'px';
      platno.width = round(w * dpr); platno.height = round(h * dpr);
    }
    function zoom(k, cx, cy) {
      const s2 = max(0.4, min(60, s * k));
      ox = cx - (cx - ox) * s2 / s; oy = cy - (cy - oy) * s2 / s; s = s2;
      vlastniPohled = true;
      prekresli();
    }

    // ---------------------------------------------------------- kreslení
    function prekresli() { if (!ceka) { ceka = true; requestAnimationFrame(kresli); } }

    function kresliPozadi() {
      // list jako obrázek v mezipaměti (překreslí se jen při změně měřítka nebo listu)
      const klic = [rv.typ, rv.format, s.toFixed(4), dpr].join();
      const pw = round(rv.w * s * dpr), ph = round(rv.h * s * dpr);
      if (pw * ph > 8e6) { pozadi = null; pozadiKlic = ''; return false; }    // velký zoom → kreslit přímo (bez obří mezipaměti)
      if (klic !== pozadiKlic) {
        pozadi = pozadi || document.createElement('canvas');
        pozadi.width = pw; pozadi.height = ph;
        const c = pozadi.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.fillStyle = '#ffffff'; c.fillRect(0, 0, rv.w * s, rv.h * s);
        N.kresliList(rv, N.kreslicPlatna(c, s), { pole: { tloustka: model.vykres.tloustka } });
        pozadiKlic = klic;
      }
      ctx.drawImage(pozadi, ox, oy, rv.w * s, rv.h * s);
      return true;
    }

    function cara(body, styl, sirka) {
      if (body.length < 2) return;
      ctx.strokeStyle = styl.barva;
      ctx.lineWidth = sirka || max(1.2, styl.sila * s);
      ctx.setLineDash(styl.carky ? styl.carky.map(v => v * s) : []);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(ox + body[0][0] * s, oy + body[0][1] * s);
      for (let i = 1; i < body.length; i++) ctx.lineTo(ox + body[i][0] * s, oy + body[i][1] * s);
      ctx.stroke();
    }

    const STAV_KOTY = { 'nepřiřazená': { barva: '#e08a00', sila: 0.3, carky: [1.2, 0.8] }, rozpor: { barva: '#d0302a', sila: 0.55 } };
    function kresliKotu(p, zvyrazni) {
      const stav = model.stavKot && model.stavKot.get(p.id);
      const st = zvyrazni ? { barva: zvyrazni, sila: 0.45 } : STAV_KOTY[stav] || STYL.kota;
      // přiřazená kóta: čára přesně mezi měřenými body + vynášecí čáry od nich (s mezerou u obrysu a přesahem)
      const g = stav === 'ok' && model.geomKot && model.geomKot.get(p.id);
      let A = p.a, B = p.b;
      if (g && g.body) {
        const [m1, m2] = g.body;
        if (g.typ === 'vzdalX') { const y = (p.a[1] + p.b[1]) / 2; A = [m1[0], y]; B = [m2[0], y]; }
        else if (g.typ === 'vzdalY') { const x = (p.a[0] + p.b[0]) / 2; A = [x, m1[1]]; B = [x, m2[1]]; }
        const tenka = { barva: st.barva, sila: 0.18 };
        for (const [m, k] of [[m1, A], [m2, B]]) {
          const dx = k[0] - m[0], dy = k[1] - m[1], L = hypot(dx, dy);
          if (L > 1.5) cara([[m[0] + dx / L * 1, m[1] + dy / L * 1], [k[0] + dx / L * 1.5, k[1] + dy / L * 1.5]], tenka, max(0.8, 0.18 * s));
        }
      }
      const [ax, ay] = A, [bx, by] = B, u = atan2(by - ay, bx - ax), d = 2.2, r = 0.32;
      cara([A, B], st);
      for (const [x, y, smer] of [[ax, ay, u], [bx, by, u + PI]]) {
        cara([[x + d * cos(smer + r), y + d * sin(smer + r)], [x, y], [x + d * cos(smer - r), y + d * sin(smer - r)]], st);
      }
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      // ⌀ / R podle výkladu (průměr přes kružnici, kóta od osy, poloměr)
      const pk = model.popisKot && model.popisKot.get(p.id);
      const txt = p.hodnota == null ? '?' : pk && /^[⌀R]/.test(pk) ? pk : String(p.hodnota).replace('.', ',');
      ctx.save();
      ctx.translate(ox + mx * s, oy + my * s);
      let ur = u; if (ur > PI / 2 || ur < -PI / 2) ur += PI;
      ctx.rotate(ur);
      ctx.font = '600 ' + max(10, 3.2 * s) + 'px "Liberation Sans", Arial, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      if (p.hodnota == null || stav === 'rozpor' || stav === 'nepřiřazená') {
        const tw = ctx.measureText(txt).width + 6;
        ctx.fillStyle = stav === 'nepřiřazená' ? 'rgba(224,138,0,.18)' : 'rgba(208,48,42,.15)'; ctx.fillRect(-tw / 2, -max(10, 3.2 * s) - 3, tw, max(10, 3.2 * s) + 2);
      }
      ctx.fillStyle = st.barva;
      ctx.fillText(txt, 0, -max(1.5, 0.6 * s));
      ctx.restore();
    }

    /** zvyrazni = barva zvýraznění (guma, výběr) nebo nic */
    function kresliPrvek(p, zvyrazni) {
      if (p.druh === 'kota') return kresliKotu(p, zvyrazni);
      const st = zvyrazni ? Object.assign({}, STYL[p.pero] || STYL.obrys, { barva: zvyrazni }) : STYL[p.pero] || STYL.obrys;
      if (model.nast.surove && p.tah) return cara(p.tah, st);
      cara(N.lomenaPrvku(p), st);
    }

    function kresli() {
      ceka = false;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!rv) return;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 2;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(ox, oy, rv.w * s, rv.h * s);
      ctx.restore();
      if (!kresliPozadi()) {
        ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, rv.w * s, rv.h * s); ctx.clip();
        N.kresliList(rv, N.kreslicPlatna(ctx, s, ox, oy), { pole: { tloustka: model.vykres.tloustka } });
        ctx.restore();
      }
      if (model.nast.vysledek !== false) kresliVysledek();
      if (model.nast.voditka !== false) kresliVoditka();
      const vyb = new Set(vybrane());
      for (const p of model.vykres.prvky) kresliPrvek(p, p === nahoreNad ? '#ff7a00' : vyb.has(p.id) ? MODRA : null);
      const jediny = vyb.size === 1 && model.vykres.prvky.find(p => vyb.has(p.id));
      if (jediny) for (const u of uchyty(jediny)) {
        ctx.setLineDash([]); ctx.fillStyle = '#ffffff'; ctx.strokeStyle = MODRA; ctx.lineWidth = 1.5;
        ctx.fillRect(ox + u.x * s - 4, oy + u.y * s - 4, 8, 8); ctx.strokeRect(ox + u.x * s - 4, oy + u.y * s - 4, 8, 8);
      }
      if (tah && tah.body.length > 1) {
        const st = STYL[tah.pero] || STYL.obrys;
        if (tah.pero === 'kota') kresliKotu({ a: tah.body[0], b: tah.body[tah.body.length - 1], hodnota: null });
        else for (let i = 1; i < tah.body.length; i++) {   // šířka podle přítlaku pera
          const t = tah.tlak[i] || 0.5;
          cara([tah.body[i - 1], tah.body[i]], st, max(1, st.sila * s * (0.6 + t)));
        }
      }
      kresliNastroj();
      if (kurzor && model.nast.nastroj === 'guma') {
        ctx.setLineDash([]); ctx.strokeStyle = '#ff7a00'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(kurzor[0], kurzor[1], polomerGumy() * s, 0, 2 * PI); ctx.stroke();
      }
    }

    // ---------------------------------------------------------- přesné nástroje (tvary, roh)
    const krok = () => model.nast.krok || N.MRIZKA;
    /** Přichycení pro přesné nástroje: k bodům prvků, jinak na krok mřížky; u úsečky zámek vodorovně/svisle. */
    // ---------------------------------------------------------- chytré přichytávání (prichyt.js)
    let mezipamet = null, altDrzen = false, snap = null;   // snap = poslední výsledek pro značku u kurzoru
    const pruvodce = () => {
      const kl = model.verze + ':' + (model.vykres.voditka || []).length;
      // během tažení se nepřepočítává (tažené prvky jsou vyjmuté) – průsečíky jsou O(n²)
      if (mezipamet && (presun || tazeni)) return mezipamet.C;
      if (!mezipamet || mezipamet.kl !== kl) mezipamet = { kl, C: N.pripravPrichyt(model.vykres.prvky, model.nast.voditka === false ? [] : model.vykres.voditka) };
      return mezipamet.C;
    };
    /** Přichytí bod (mm); predchozi = předchozí bod kreslení (zarovnání, úhly), vyjmout = id tažených prvků. */
    function chytni(x, y, predchozi, vyjmout) {
      const C = pruvodce();
      // body rozkresleného tvaru (třeba první bod lomené) taky chytají
      if (kon && kon.body.length) C.body = C.body.filter(b => !b.docasny).concat(kon.body.map(q => ({ x: q[0], y: q[1], druh: 'konec', docasny: true })));
      const r = N.chytBod(C, x, y, {
        tol: max(1.2, 10 / s), krok: krok(), predchozi, vyjmout,
        volby: Object.assign({}, model.nast.chyt, model.nast.voditka === false ? { voditka: false } : {}),
        vypnuto: model.nast.prichyt === false || altDrzen,
      });
      snap = r;
      return r;
    }
    function bodNastroje(x, y, predchozi) {
      const r = chytni(x, y, predchozi);
      return [r.x, r.y, !!r.druh && r.druh !== 'mrizka'];
    }
    function kresliNastroj() {
      const n = model.nast.nastroj;
      if (kon) {
        const body = kon.kurzor ? [...kon.body, kon.kurzor] : kon.body;
        const t = N.tvarZBodu(kon.nastroj, body, model.nast.pero || 'obrys');
        ctx.save(); ctx.globalAlpha = 0.85;
        for (const p of t.prvky) kresliPrvek(p, null);
        ctx.restore();
        for (const q of kon.body) { ctx.fillStyle = MODRA; ctx.fillRect(ox + q[0] * s - 3, oy + q[1] * s - 3, 6, 6); }
        if (t.popisek) popisek(t.popisek.x, t.popisek.y, t.popisek.text);
      }
      kresliMereni();
      if (kurzor && (CHYTA.has(n) || tazeni || presun)) kresliSnap();
      if (roh && (n === 'zaobleni' || n === 'zkoseni')) {
        ctx.setLineDash([]); ctx.strokeStyle = '#e08a00'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ox + roh[0] * s, oy + roh[1] * s, 8, 0, 2 * PI); ctx.stroke();
      }
      if (ramVyberu) {
        const r = ramVyberu;
        ctx.setLineDash([5, 4]); ctx.strokeStyle = MODRA; ctx.lineWidth = 1; ctx.fillStyle = 'rgba(31,111,209,.08)';
        const x = ox + min(r.x0, r.x1) * s, y = oy + min(r.y0, r.y1) * s, ww = abs(r.x1 - r.x0) * s, hh = abs(r.y1 - r.y0) * s;
        ctx.fillRect(x, y, ww, hh); ctx.strokeRect(x, y, ww, hh); ctx.setLineDash([]);
      }
    }
    function kresliVoditka() {
      const V = model.vykres.voditka || [];
      if (!V.length && !voditkoKon) return;
      ctx.save();
      ctx.beginPath(); ctx.rect(ox, oy, rv.w * s, rv.h * s); ctx.clip();
      ctx.setLineDash([6, 4]); ctx.lineWidth = 1;
      const L = hypot(rv.w, rv.h) * 2;
      const kresli = (a, u, barva) => {
        ctx.strokeStyle = barva; ctx.beginPath();
        ctx.moveTo(ox + (a[0] - L * cos(u)) * s, oy + (a[1] - L * sin(u)) * s); ctx.lineTo(ox + (a[0] + L * cos(u)) * s, oy + (a[1] + L * sin(u)) * s);
        ctx.stroke();
      };
      for (const v of V) kresli(v.a, v.u, v === nahoreNadV ? '#ff7a00' : 'rgba(20,163,184,.85)');
      if (voditkoKon) for (const u of voditkoKon.uhly()) kresli(voditkoKon.a, u, 'rgba(20,163,184,.55)');
      ctx.restore();
    }
    /** Značka přichycení: tvar podle druhu, popisek a stopy zarovnání. */
    function kresliSnap() {
      const r = snap;
      if (!r || !r.druh || r.druh === 'mrizka') return;
      ctx.save(); ctx.setLineDash([2, 3]); ctx.strokeStyle = 'rgba(20,163,184,.9)'; ctx.lineWidth = 1;
      for (const [x1, y1, x2, y2] of r.stopy || []) { ctx.beginPath(); ctx.moveTo(ox + x1 * s, oy + y1 * s); ctx.lineTo(ox + x2 * s, oy + y2 * s); ctx.stroke(); }
      ctx.setLineDash([]); ctx.strokeStyle = '#e08a00'; ctx.fillStyle = 'rgba(224,138,0,.18)'; ctx.lineWidth = 1.8;
      const X = ox + r.x * s, Y = oy + r.y * s, d = 6;
      ctx.beginPath();
      if (r.druh === 'konec') ctx.rect(X - d, Y - d, 2 * d, 2 * d);
      else if (r.druh === 'prusecik') { ctx.moveTo(X - d, Y - d); ctx.lineTo(X + d, Y + d); ctx.moveTo(X + d, Y - d); ctx.lineTo(X - d, Y + d); }
      else if (r.druh === 'stred') { ctx.moveTo(X, Y - d); ctx.lineTo(X + d, Y + d * 0.8); ctx.lineTo(X - d, Y + d * 0.8); ctx.closePath(); }
      else if (r.druh === 'kvadrant') { ctx.moveTo(X, Y - d); ctx.lineTo(X + d, Y); ctx.lineTo(X, Y + d); ctx.lineTo(X - d, Y); ctx.closePath(); }
      else if (r.druh === 'stredKruhu') { ctx.arc(X, Y, d, 0, 2 * PI); ctx.moveTo(X + 2, Y); ctx.arc(X, Y, 2, 0, 2 * PI); }
      else if (r.druh === 'zarovnani') { ctx.moveTo(X - d, Y); ctx.lineTo(X + d, Y); ctx.moveTo(X, Y - d); ctx.lineTo(X, Y + d); }
      else ctx.arc(X, Y, d - 1, 0, 2 * PI);
      ctx.fill(); ctx.stroke();
      if (r.popis) {
        ctx.font = '11px "Liberation Sans", Arial, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        const tw = ctx.measureText(r.popis).width;
        ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(X + 9, Y + 8, tw + 6, 14);
        ctx.fillStyle = '#b06a00'; ctx.fillText(r.popis, X + 12, Y + 9);
      }
      ctx.restore();
    }
    function kresliMereni() {
      if (!mereni || !mereni.b) return;
      const [ax, ay] = mereni.a, [bx, by] = mereni.b, L = hypot(bx - ax, by - ay);
      ctx.save(); ctx.setLineDash([]); ctx.strokeStyle = '#7a3fd0'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(ox + ax * s, oy + ay * s); ctx.lineTo(ox + bx * s, oy + by * s); ctx.stroke();
      for (const [x, y] of [mereni.a, mereni.b]) { ctx.beginPath(); ctx.arc(ox + x * s, oy + y * s, 3, 0, 2 * PI); ctx.fillStyle = '#7a3fd0'; ctx.fill(); }
      let u = -Math.atan2(by - ay, bx - ax) * 180 / PI; if (u < 0) u += 360;
      const f = v => String(+v.toFixed(2)).replace('.', ',');
      ctx.restore();
      const t = f(L) + ' mm · Δx ' + f(abs(bx - ax)) + ' · Δy ' + f(abs(by - ay)) + ' · ' + f(u) + '°';
      ctx.save(); ctx.font = '600 12px "Liberation Sans", Arial, sans-serif';
      const tw = ctx.measureText(t).width, px = ox + (ax + bx) / 2 * s + 10, py = oy + (ay + by) / 2 * s - 10;
      ctx.fillStyle = 'rgba(122,63,208,.93)'; ctx.fillRect(px - 4, py - 13, tw + 8, 18);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, px, py);
      ctx.restore();
    }
    function popisek(x, y, text) {
      ctx.font = '600 12px "Liberation Sans", Arial, sans-serif';
      const tw = ctx.measureText(text).width, px = ox + x * s + 14, py = oy + y * s - 14;
      ctx.fillStyle = 'rgba(31,111,209,.92)'; ctx.fillRect(px - 4, py - 13, tw + 8, 18);
      ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(text, px, py);
    }
    const noveIds = prvky => prvky.map(p => Object.assign({ id: noveId() }, p));
    /** Dokončí rozkreslený tvar: prvky (+ kóty ze zadaných čísel) do výkresu. */
    function dokonciTvar(uzavrit) {
      const k = kon; kon = null;
      if (!k) return;
      let body = k.body.filter((q, i) => !i || hypot(q[0] - k.body[i - 1][0], q[1] - k.body[i - 1][1]) > 1e-6);
      const t = N.tvarZBodu(k.nastroj, body, model.nast.pero || 'obrys');
      let prvky = t.prvky;
      if (k.nastroj === 'usecka') {
        if (body.length < 2) { prekresli(); return; }
        if (uzavrit && body.length >= 3) prvky = [Object.assign({}, prvky[0], { zavrena: true })];
      }
      if (k.nastroj === 'oblouk' && body.length < 3) { prekresli(); return; }
      if (!prvky.length) { prekresli(); return; }
      zapamatuj();
      const koty = (k.koty || []).map(q => ({ druh: 'kota', pero: 'kota', a: q.a, b: q.b, hodnota: q.hodnota, umistit: true }));
      model.vykres.prvky.push(...noveIds(prvky), ...noveIds(koty));
      model.zmena('tvar'); prekresli();
    }
    function zrusTvar() { if (kon) { kon = null; model.info(''); prekresli(); } }
    /** Číslo napsané během kreslení tvaru (Enter v políčku). */
    function cisloTvaru(text) {
      if (!kon) return;
      const r = N.ciselneZadani(kon.nastroj, text, kon.body, kon.kurzor || kon.body[kon.body.length - 1]);
      if (r.chyba) { model.info(r.chyba); return; }
      kon.body.push(r.bod); kon.koty = (kon.koty || []).concat(r.koty || []);
      kon.kurzor = null;
      if (kon.body.length >= N.NASTROJE_TVARU[kon.nastroj].potreba) dokonciTvar(false);
      else prekresli();
    }
    /** Odsazení čáry / kružnice pod bodem na stranu kliknutí (zeptá se na vzdálenost). */
    function odsadNa(x, y) {
      const p = prvekU(x, y, max(1.5, 8 / s));
      if (!p || p.druh === 'kota') { model.info('Klepněte na čáru nebo kružnici – na tu stranu, kam má jít kopie.'); return; }
      otevriCislo([x, y], 'Vzdálenost odsazení (mm):', model.nast.posledniOdsazeni || 2, text => {
        const d = parseFloat(String(text).replace(',', '.'));
        const r = N.odsad(p, d, x, y);
        if (r.chyba) { model.info(r.chyba); return; }
        model.nast.posledniOdsazeni = d;
        zapamatuj();
        model.vykres.prvky.push(Object.assign({ id: noveId() }, r.prvek));
        model.zmena('odsazeni'); prekresli();
      });
    }
    /** Ořez kusu čáry mezi průsečíky (Shift = prodloužení konce k nejbližší čáře). */
    function orizniNa(x, y, prodlouzit) {
      const tol = max(1.5, 8 / s), V = model.nast.voditka === false ? [] : model.vykres.voditka || [];
      const r = prodlouzit ? N.prodluz(model.vykres.prvky, V, x, y, tol) : N.orizni(model.vykres.prvky, V, x, y, tol);
      if (r.chyba) { model.info(r.chyba); return; }
      zapamatuj();
      model.vykres.prvky = r.prvky.map(p => p.id ? p : Object.assign({ id: noveId() }, p));
      nahoreNad = null;
      model.zmena(prodlouzit ? 'prodlouzeni' : 'orez'); prekresli();
    }
    /** Zaoblení / zkosení rohu u bodu (zeptá se na rozměr). */
    function upravRoh(x, y) {
      const tol = max(1.5, 10 / s), r0 = N._najdiRoh(model.vykres.prvky, x, y, tol);
      if (!r0) { model.info('Klepněte na roh mezi dvěma rovnými čarami (oranžové kolečko).'); return; }
      const zk = model.nast.nastroj === 'zkoseni';
      otevriCislo(r0.v, zk ? 'Sražení (mm):' : 'Poloměr R (mm):', model.nast[zk ? 'posledniC' : 'posledniR'] || 5, text => {
        const v = parseFloat(String(text).replace(',', '.'));
        const r = N.upravRoh(model.vykres.prvky, r0.v[0], r0.v[1], v, zk, 0.01);
        if (r.chyba) { model.info(r.chyba); return; }
        model.nast[zk ? 'posledniC' : 'posledniR'] = v;
        zapamatuj();
        model.vykres.prvky = r.prvky.map(p => p.id ? p : Object.assign({ id: noveId() }, p));
        model.zmena('roh'); prekresli();
      });
    }

    // ---------------------------------------------------------- výsledek výkladu (vyřešený tvar)
    const MODRA = '#1f6fd1';
    function kresliVysledek() {
      const v = model.vysledek;
      if (!v || !v.vysledek) return;
      const podle = new Map();
      for (const t of v.vysledek.zobrazit || v.vysledek.tvary) if (!t.pomocny) { if (!podle.has(t.pohled)) podle.set(t.pohled, []); podle.get(t.pohled).push(t); }
      ctx.setLineDash([]);
      for (const tvary of podle.values()) {
        ctx.beginPath();
        for (const t of tvary) {
          if (t.typ === 'kruh') { ctx.moveTo(ox + (t.x + t.rx) * s, oy + t.y * s); ctx.arc(ox + t.x * s, oy + t.y * s, t.rx * s, 0, 2 * PI); continue; }
          const l = N.lomenaObrysu(t.body);
          ctx.moveTo(ox + l[0][0] * s, oy + l[0][1] * s);
          for (let i = 1; i < l.length; i++) ctx.lineTo(ox + l[i][0] * s, oy + l[i][1] * s);
          ctx.closePath();
        }
        ctx.fillStyle = v.vysledek.ok ? 'rgba(31,111,209,.13)' : 'rgba(208,48,42,.10)';
        ctx.fill('evenodd');
        ctx.strokeStyle = v.vysledek.ok ? 'rgba(31,111,209,.75)' : 'rgba(208,48,42,.6)';
        ctx.lineWidth = max(1, 0.22 * s);
        ctx.stroke();
      }
      // volné konce nedotažených čar
      ctx.strokeStyle = '#e08a00'; ctx.lineWidth = 2;
      for (const h of v.hlaseni) for (const [x, y] of h.body || []) { ctx.beginPath(); ctx.arc(ox + x * s, oy + y * s, max(6, 1.6 * s), 0, 2 * PI); ctx.stroke(); }
    }

    // ---------------------------------------------------------- výběr a úchyty
    /** Úchyty prvku: [{x, y, kde}] – vrchol čáry, střed a poloměr kružnice, konce kóty. */
    function uchyty(p) {
      if (p.druh === 'cara') return p.body.map((b, i) => ({ x: b.x, y: b.y, kde: i }));
      if (p.druh === 'kruh') return [{ x: p.x, y: p.y, kde: 'stred' }, { x: p.x + p.r, y: p.y, kde: 'r' }];
      if (p.druh === 'kota') return [{ x: p.a[0], y: p.a[1], kde: 'a' }, { x: p.b[0], y: p.b[1], kde: 'b' }];
      return [];
    }
    function uchytU(x, y) {
      const tol = max(1, 9 / s);
      const vyb = vybrane(), poradi = vyb.length ? [...model.vykres.prvky].sort((p, q) => vyb.includes(q.id) - vyb.includes(p.id)) : model.vykres.prvky;
      for (const p of poradi) for (const u of uchyty(p)) if (hypot(u.x - x, u.y - y) <= tol) return { p, kde: u.kde };
      return null;
    }
    /** Přichytí bod při tažení úchytu (k bodům ostatních prvků, jinak k mřížce). */
    function prichytBod(x, y, krome) {
      const r = chytni(x, y, null, new Set(krome && krome.id ? [krome.id] : []));
      return [r.x, r.y];
    }
    function tahniUchyt(t, x, y) {
      const p = t.p;
      if (!model.vykres.prvky.includes(p)) { tazeni = null; return; }   // smazaný (Delete) během tažení
      if (!t.zmeneno) { zapamatuj(); t.zmeneno = true; }
      if (t.kde === 'r') { p.r = max(0.5, round(hypot(x - p.x, y - p.y) * 2) / 2); }
      else {
        const [qx, qy] = prichytBod(x, y, p);
        if (p.druh === 'cara') { p.body[t.kde].x = qx; p.body[t.kde].y = qy; }
        else if (p.druh === 'kruh') { p.x = qx; p.y = qy; }
        else { p[t.kde] = [qx, qy]; delete p.m; }        // ručně posunutá kóta se přiřadí podle konců
      }
      delete p.tah;                                     // surová kresba už neodpovídá
      model.zmena('uprava');
    }
    /** Výběr: id, pole id nebo null. */
    function vyber(co) {
      model.vybrane = Array.isArray(co) ? co.slice() : co ? [co] : [];
      model.zmenaVyberu && model.zmenaVyberu(); prekresli();
    }
    /** Posune živý prvek dst na kopii src posunutou o (dx, dy). */
    function posunPrvek(dst, src, dx, dy) {
      if (dst.druh === 'cara') dst.body = src.body.map(b => ({ x: b.x + dx, y: b.y + dy, b: b.b }));
      else if (dst.druh === 'kruh') { dst.x = src.x + dx; dst.y = src.y + dy; }
      else { dst.a = [src.a[0] + dx, src.a[1] + dy]; dst.b = [src.b[0] + dx, src.b[1] + dy]; if (src.m) dst.m = src.m.map(q => [q[0] + dx, q[1] + dy]); }
      delete dst.tah;
    }
    /** Nejbližší „chytací“ bod prvku (vrchol, střed, konec kóty) k bodu – pro přichycení při posunu. */
    function refBod(p, x, y) {
      const u = uchyty(p).filter(q => q.kde !== 'r');
      let nej = u[0], dn = Infinity;
      for (const q of u) { const d = hypot(q.x - x, q.y - y); if (d < dn) { dn = d; nej = q; } }
      return nej ? [nej.x, nej.y] : [x, y];
    }

    // ---------------------------------------------------------- hledání a guma
    const polomerGumy = () => max(1.5, 8 / s);           // mm (aspoň ~8 px)
    function prvekU(x, y, tol) {
      let nej = null, dn = tol;
      for (const p of model.vykres.prvky) {
        const d = N.vzdalOdPrvku(p, x, y);
        if (d <= dn) { dn = d; nej = p; }
      }
      return nej;
    }
    function gumuj(x, y) {
      const r = polomerGumy(), pred = model.vykres.prvky.length, V = model.vykres.voditka || [];
      const zbyle = model.vykres.prvky.filter(p => N.vzdalOdPrvku(p, x, y) > r);
      const zbyleV = model.nast.voditka === false ? V : V.filter(v => N.nejblizsiNaPrimitivu(N.primitivumVoditka(v), x, y).d > r);
      if (zbyle.length === pred && zbyleV.length === V.length) return;
      if (!tah.zmeneno) { zapamatuj(); tah.zmeneno = true; }
      model.vykres.prvky = zbyle; model.vykres.voditka = zbyleV;
      model.zmena('guma');
    }

    // ---------------------------------------------------------- dokončení tahu
    function dokonciTah() {
      const t = tah; tah = null;
      if (!t || t.pero === 'guma') { prekresli(); return; }
      const surove = t.body.map(([x, y]) => [round(x * 10) / 10, round(y * 10) / 10]);
      const body = N.bodyPrvku(model.vykres.prvky);
      if (t.pero === 'kota') {
        const a = t.body[0], b = t.body[t.body.length - 1];
        // klepnutí na existující kótu = úprava čísla
        if (hypot(b[0] - a[0], b[1] - a[1]) < 2) {
          const k = model.vykres.prvky.find(p => p.druh === 'kota' && N.vzdalOdPrvku(p, a[0], a[1]) < max(2, 10 / s));
          if (k) otevriKotu(k, false);
          prekresli(); return;
        }
        // konce kóty jen k blízkým bodům (přiřazení stejně jde podle průmětu); oba ke stejnému bodu nikdy
        // (kóta přes malou díru by jinak skončila ve středu)
        const BODOVE = ['konec', 'prusecik', 'stred', 'stredKruhu', 'kvadrant'];
        const pr = q => { const r = chytni(q[0], q[1]); return BODOVE.includes(r.druh) ? [r.x, r.y] : null; };
        let ka = pr(a), kb = pr(b);
        if (ka && kb && hypot(ka[0] - kb[0], ka[1] - kb[1]) < 1e-9) ka = kb = null;
        zapamatuj();
        // umistit: po zadání čísla a přiřazení kóta odskočí mimo kresbu (ui.js → N3D.umistiKotu)
        const k = { id: noveId(), druh: 'kota', pero: 'kota', a: (ka || a).slice(), b: (kb || b).slice(), hodnota: null, tah: surove, umistit: true };
        model.vykres.prvky.push(k);
        model.zmena('kota'); prekresli();
        otevriKotu(k, true);
        return;
      }
      let p = N.rozpoznejTah(t.body);
      if (p && model.nast.prichyt !== false) p = N.prichytPrvek(p, { mrizka: N.MRIZKA, body });
      else if (p) p = N.prichytPrvek(p, { mrizka: 0, body });
      if (!p) { prekresli(); return; }
      zapamatuj();
      model.vykres.prvky.push(Object.assign({ id: noveId(), pero: t.pero }, p, { tah: surove }));
      model.zmena('tah'); prekresli();
    }

    // ---------------------------------------------------------- políčko na číslo kóty
    const vstup = document.createElement('input');
    vstup.type = 'text'; vstup.inputMode = 'decimal'; vstup.className = 'vstup-koty';
    vstup.setAttribute('aria-label', 'Hodnota kóty v mm'); vstup.hidden = true;
    obal.appendChild(vstup);
    let kotaVeVstupu = null, kotaNova = false;
    // ---------------------------------------------------------- obecné políčko na číslo (tvary, roh)
    const vstupCisla = document.createElement('input');
    vstupCisla.type = 'text'; vstupCisla.className = 'vstup-koty vstup-cisla'; vstupCisla.hidden = true;
    vstupCisla.setAttribute('aria-label', 'Číselné zadání');
    obal.appendChild(vstupCisla);
    let poCisle = null;
    /** Políčko u bodu (mm) nebo u středu; hotovo(text) po Enteru. */
    function otevriCislo(bod, popis, vychozi, hotovo) {
      poCisle = hotovo;
      const [px, py] = bod ? [ox + bod[0] * s, oy + bod[1] * s] : [w / 2, h / 2];
      vstupCisla.value = vychozi != null ? String(vychozi).replace('.', ',') : '';
      vstupCisla.placeholder = 'mm'; vstupCisla.title = popis;
      vstupCisla.style.left = max(4, min(w - 130, px + 12)) + 'px';
      vstupCisla.style.top = max(4, min(h - 36, py + 12)) + 'px';
      vstupCisla.hidden = false; vstupCisla.focus();
      if (vychozi != null && String(vychozi).length > 1) vstupCisla.select();
      model.info(popis + ' Enter = použít, Esc = zrušit.');
    }
    function zavriCislo(pouzit) {
      if (vstupCisla.hidden) return;
      vstupCisla.hidden = true;
      const f = poCisle; poCisle = null;
      platno.focus();
      if (pouzit && f) f(vstupCisla.value); else model.info('');
    }
    vstupCisla.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); zavriCislo(true); }
      else if (e.key === 'Escape') { e.preventDefault(); zavriCislo(false); }
    });
    vstupCisla.addEventListener('blur', () => zavriCislo(false));
    // během kreslení tvaru: číslice otevřou zadání, Enter dokončí lomenou, Backspace vrátí bod, Esc zruší
    addEventListener('keydown', e => {
      if (e.key === 'Escape' && mereni) { mereni = null; prekresli(); }
      if (!kon || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target && e.target.closest && e.target.closest('input, textarea, select, dialog')) return;
      if (/^[0-9.,]$/.test(e.key) && kon.nastroj !== 'oblouk') {
        e.preventDefault(); e.stopPropagation();
        const nazev = kon.nastroj === 'obdelnik' ? 'Šířka × výška (40x20):' : kon.nastroj === 'usecka' ? 'Délka (40, nebo 40<30 s úhlem):' : 'Průměr:';
        otevriCislo(kon.kurzor || kon.body[kon.body.length - 1], nazev, null, cisloTvaru);
        vstupCisla.value = e.key;
      } else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); dokonciTvar(false); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); zrusTvar(); }
      else if (e.key === 'Backspace' && kon.body.length > 1) { e.preventDefault(); e.stopPropagation(); kon.body.pop(); prekresli(); }
    }, true);

    function otevriKotu(k, nova) {
      kotaVeVstupu = k; kotaNova = nova;
      const mx = ox + (k.a[0] + k.b[0]) / 2 * s, my = oy + (k.a[1] + k.b[1]) / 2 * s;
      vstup.value = k.hodnota != null ? String(k.hodnota).replace('.', ',') : '';
      vstup.placeholder = 'mm';
      vstup.style.left = max(4, min(w - 90, mx - 40)) + 'px';
      vstup.style.top = max(4, min(h - 36, my - 40)) + 'px';
      vstup.hidden = false;
      vstup.focus(); vstup.select();
      model.info('Napište rozměr v mm a potvrďte Enterem (Esc = zrušit).');
    }
    function zavriKotu(potvrdit) {
      const k = kotaVeVstupu;
      if (!k) return;
      kotaVeVstupu = null; vstup.hidden = true;
      const v = parseFloat(vstup.value.replace(',', '.').replace(/[^\d.\-]/g, ''));
      if (potvrdit && isFinite(v) && v > 0) {
        if (k.hodnota !== v) { if (!kotaNova) zapamatuj(); k.hodnota = round(v * 1000) / 1000; }
      } else if (kotaNova && model.vykres.prvky.includes(k)) {
        model.vykres.prvky = model.vykres.prvky.filter(p => p !== k);
        zpet.pop();                                      // nová kóta bez čísla se nepočítá jako krok
      }
      model.zmena('kota'); prekresli();
      model.info('');
    }
    vstup.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); zavriKotu(true); platno.focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); zavriKotu(false); platno.focus(); }
    });
    vstup.addEventListener('blur', () => { if (kotaVeVstupu) zavriKotu(true); });

    // ---------------------------------------------------------- ukazatel
    function zacniPosun(e, c) { posun = { x: c[0], y: c[1], ox, oy, id: e.pointerId }; vlastniPohled = true; platno.style.cursor = 'grabbing'; }

    platno.addEventListener('pointerdown', e => {
      altDrzen = e.altKey;
      if (kotaVeVstupu) zavriKotu(true);
      const c = souradnice(e);
      if (e.pointerType === 'pen') maPero = true;
      if (e.pointerType === 'touch') {
        dotyky.set(e.pointerId, c);
        if (maPero || dotyky.size >= 2) {
          // druhý prst: zrušit rozpracovaný tah prstem a začít štípnutí
          if (tah && tah.typ === 'touch') tah = null;
          tazeni = null;                                // ani tažení úchytu prvním prstem nepokračuje
          if (dotyky.size >= 2) {
            const [p1, p2] = [...dotyky.values()];
            stipnuti = { d: hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1, cx: (p1[0] + p2[0]) / 2, cy: (p1[1] + p2[1]) / 2, s, ox, oy };
            vlastniPohled = true;
            posun = null;
          } else zacniPosun(e, c);
          prekresli();
          return;
        }
      }
      platno.setPointerCapture(e.pointerId);
      if (e.button === 1 || e.button === 2 || mezernik || model.nast.nastroj === 'posun') { e.preventDefault(); zacniPosun(e, c); return; }
      if (e.button !== 0) return;
      const [x, y] = mm(c[0], c[1]);
      const nastroj = model.nast.nastroj;
      if (nastroj === 'vyber') {
        const p = prvekU(x, y, max(1.5, 8 / s));
        if (e.shiftKey) {                               // Shift: přidat/odebrat, nebo přidat rámem
          if (p) vyber(vybrane().includes(p.id) ? vybrane().filter(i => i !== p.id) : vybrane().concat(p.id));
          else ramVyberu = { id: e.pointerId, x0: x, y0: y, x1: x, y1: y, pridat: true };
          return;
        }
        const u = vybrane().length <= 1 && uchytU(x, y);
        if (u) { tazeni = Object.assign(u, { id: e.pointerId }); if (!vybrane().includes(u.p.id)) vyber(u.p.id); return; }
        if (p) {
          if (!vybrane().includes(p.id)) vyber(p.id);
          const sel = model.vykres.prvky.filter(q => vybrane().includes(q.id));
          presun = { id: e.pointerId, start: [x, y], ref: refBod(p, x, y), puvodni: new Map(sel.map(q => [q.id, JSON.parse(JSON.stringify(q))])), zmeneno: false };
          return;
        }
        vyber(null);
        ramVyberu = { id: e.pointerId, x0: x, y0: y, x1: x, y1: y, pridat: false };
        return;
      }
      // roh až po puštění: při stisku by prohlížeč hned přesunul fokus z políčka na plátno
      if (nastroj === 'zaobleni' || nastroj === 'zkoseni') { rohKlik = { id: e.pointerId, x, y }; return; }
      if (nastroj === 'odsazeni' || nastroj === 'orez') { klikNastroje = { id: e.pointerId, x, y, shift: e.shiftKey }; return; }
      if (nastroj === 'voditko') {
        const r = chytni(x, y), a = [r.x, r.y], st = { id: e.pointerId, a, kurzor: null, dolu: [x, y] };
        // úhel podle tažení (po 15°, Alt = volně); krátký klik = vodorovná i svislá
        st.uhly = () => {
          if (!st.kurzor || hypot(st.kurzor[0] - st.dolu[0], st.kurzor[1] - st.dolu[1]) * s < 8) return [0, PI / 2];
          let u = atan2(st.kurzor[1] - a[1], st.kurzor[0] - a[0]);
          if (!altDrzen) u = round(u / (PI / 12)) * (PI / 12);
          return [((u % PI) + PI) % PI];
        };
        voditkoKon = st; prekresli(); return;
      }
      if (nastroj === 'mereni') {
        const r = chytni(x, y);
        if (!mereni || mereni.pevne) mereni = { a: [r.x, r.y], b: null, pevne: false };
        else { mereni.b = [r.x, r.y]; mereni.pevne = true; }
        prekresli(); return;
      }
      if (jeTvar(nastroj)) {
        const pred = kon && kon.body[kon.body.length - 1];
        const [bx, by] = bodNastroje(x, y, pred);
        if (!kon) { kon = { nastroj, body: [[bx, by]], kurzor: null, dolu: [x, y], koty: [] }; model.info(N.NASTROJE_TVARU[nastroj].napoveda); prekresli(); return; }
        // úsečka: klik na první bod uzavře
        if (nastroj === 'usecka' && kon.body.length >= 3 && hypot(bx - kon.body[0][0], by - kon.body[0][1]) < 1e-6) { dokonciTvar(true); return; }
        kon.body.push([bx, by]); kon.dolu = [x, y];
        if (kon.body.length >= N.NASTROJE_TVARU[nastroj].potreba) dokonciTvar(false); else prekresli();
        return;
      }
      // ruka kreslí zvoleným perem (obrys / skrytá / osa); kóta a guma jsou samy sebou
      tah = { pero: nastroj === 'ruka' ? model.nast.pero || 'obrys' : nastroj, typ: e.pointerType, id: e.pointerId, body: [[x, y]], tlak: [e.pressure || 0.5] };
      if (tah.pero === 'guma') gumuj(x, y);
      prekresli();
    });

    platno.addEventListener('pointermove', e => {
      const c = souradnice(e);
      kurzor = e.pointerType === 'mouse' || e.pointerType === 'pen' ? c : null;
      altDrzen = e.altKey;
      if (voditkoKon && voditkoKon.id === e.pointerId) { voditkoKon.kurzor = mm(c[0], c[1]); prekresli(); return; }
      if (mereni && !mereni.pevne) { const [x, y] = mm(c[0], c[1]), r = chytni(x, y, mereni.a); mereni.b = [r.x, r.y]; prekresli(); }
      else if (!kon && !tah && !tazeni && !presun && CHYTA.has(model.nast.nastroj) && (kurzor || e.pointerType === 'touch')) {
        const [x, y] = mm(c[0], c[1]); chytni(x, y); prekresli();
      }
      if (e.pointerType === 'touch' && dotyky.has(e.pointerId)) {
        dotyky.set(e.pointerId, c);
        if (stipnuti && dotyky.size >= 2) {
          const [p1, p2] = [...dotyky.values()];
          const d = hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1, cx = (p1[0] + p2[0]) / 2, cy = (p1[1] + p2[1]) / 2;
          const S = stipnuti, s2 = max(0.4, min(60, S.s * d / S.d));
          s = s2; ox = cx - (S.cx - S.ox) * s2 / S.s; oy = cy - (S.cy - S.oy) * s2 / S.s;
          prekresli();
          return;
        }
      }
      if (posun && posun.id === e.pointerId) { ox = posun.ox + c[0] - posun.x; oy = posun.oy + c[1] - posun.y; prekresli(); return; }
      if (tazeni && tazeni.id === e.pointerId) { const [x, y] = mm(c[0], c[1]); tahniUchyt(tazeni, x, y); prekresli(); return; }
      if (presun && presun.id === e.pointerId) {
        const [x, y] = mm(c[0], c[1]);
        if (!presun.zmeneno && hypot(x - presun.start[0], y - presun.start[1]) * s < 4) return;   // klik bez posunu
        const cil = [presun.ref[0] + x - presun.start[0], presun.ref[1] + y - presun.start[1]];
        // přichytit tažený bod k bodům nevybraných prvků, jinak na krok mřížky
        let nej = null, dn = max(1.2, 10 / s);
        for (const q of N.bodyPrvku(model.vykres.prvky.filter(p => !presun.puvodni.has(p.id)))) { const d = hypot(q[0] - cil[0], q[1] - cil[1]); if (d < dn) { dn = d; nej = q; } }
        if (!nej && model.nast.prichyt !== false) { const g = krok(); nej = [round(cil[0] / g) * g, round(cil[1] / g) * g]; }
        const [tx, ty] = nej || cil, dx = tx - presun.ref[0], dy = ty - presun.ref[1];
        if (!presun.zmeneno) { zapamatuj(); presun.zmeneno = true; }
        for (const p of model.vykres.prvky) if (presun.puvodni.has(p.id)) posunPrvek(p, presun.puvodni.get(p.id), dx, dy);
        model.zmena('posun'); prekresli();
        return;
      }
      if (ramVyberu && ramVyberu.id === e.pointerId) { [ramVyberu.x1, ramVyberu.y1] = mm(c[0], c[1]); prekresli(); return; }
      if (kon) {
        const [x, y] = mm(c[0], c[1]);
        kon.kurzor = bodNastroje(x, y, kon.body[kon.body.length - 1]).slice(0, 2);
        prekresli();
      }
      if (model.nast.nastroj === 'zaobleni' || model.nast.nastroj === 'zkoseni') {
        const [x, y] = mm(c[0], c[1]), r0 = N._najdiRoh(model.vykres.prvky, x, y, max(1.5, 10 / s));
        roh = r0 ? r0.v : null; prekresli();
      }
      if (jeTvar(model.nast.nastroj) && !kon && kurzor) prekresli();
      if (tah && tah.id === e.pointerId) {
        const udalosti = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        for (const u of (udalosti.length ? udalosti : [e])) {
          const q = souradnice(u), [x, y] = mm(q[0], q[1]), z = tah.body[tah.body.length - 1];
          if (hypot(x - z[0], y - z[1]) * s < 0.8) continue;
          if (tah.body.length >= MAX_BODU_TAHU) { tah.body[tah.body.length - 1] = [x, y]; continue; }   // konec tahu se neztratí
          tah.body.push([x, y]); tah.tlak.push(u.pressure || 0.5);
          if (tah.pero === 'guma') gumuj(x, y);
        }
        if (tah.pero === 'kota') { const z = tah.body[tah.body.length - 1]; chytni(z[0], z[1]); }   // značka u konce kóty
        prekresli();
        return;
      }
      // zvýraznění prvku pod gumou
      const n = model.nast.nastroj;
      if ((n === 'guma' || n === 'odsazeni' || n === 'orez') && kurzor) {
        const [x, y] = mm(c[0], c[1]), tol = n === 'guma' ? polomerGumy() : max(1.5, 8 / s);
        const p = prvekU(x, y, tol);
        nahoreNad = p && (n === 'guma' || p.druh !== 'kota') ? p : null;
        nahoreNadV = n !== 'odsazeni' && !nahoreNad && model.nast.voditka !== false
          ? (model.vykres.voditka || []).find(v => N.nejblizsiNaPrimitivu(N.primitivumVoditka(v), x, y).d <= tol) || null : null;
        if (n === 'orez') nahoreNadV = null;
        prekresli();
      } else if (nahoreNad || nahoreNadV) { nahoreNad = nahoreNadV = null; prekresli(); }
    });

    function konec(e) {
      if (e.pointerType === 'touch') {
        dotyky.delete(e.pointerId);
        if (dotyky.size < 2) stipnuti = null;
      }
      if (posun && posun.id === e.pointerId) { posun = null; platno.style.cursor = ''; nastavKurzor(); }
      if (tazeni && tazeni.id === e.pointerId) tazeni = null;
      if (presun && presun.id === e.pointerId) presun = null;
      if (rohKlik && rohKlik.id === e.pointerId) { const r = rohKlik; rohKlik = null; if (e.type === 'pointerup') upravRoh(r.x, r.y); }
      if (voditkoKon && voditkoKon.id === e.pointerId) {
        const v = voditkoKon; voditkoKon = null;
        if (e.type === 'pointerup') {
          zapamatuj();
          model.vykres.voditka = (model.vykres.voditka || []).concat(v.uhly().map(u => ({ id: noveId(), a: v.a.slice(), u })));
          if (model.nast.voditka === false) model.nast.voditka = true;
          model.zmena('voditko');
        }
        prekresli();
      }
      if (klikNastroje && klikNastroje.id === e.pointerId) {
        const k = klikNastroje; klikNastroje = null;
        if (e.type === 'pointerup') (model.nast.nastroj === 'odsazeni' ? odsadNa : orizniNa)(k.x, k.y, k.shift);
      }
      if (ramVyberu && ramVyberu.id === e.pointerId) {
        const r = ramVyberu; ramVyberu = null;
        const x0 = min(r.x0, r.x1), x1 = max(r.x0, r.x1), y0 = min(r.y0, r.y1), y1 = max(r.y0, r.y1);
        if ((x1 - x0) * s > 3 || (y1 - y0) * s > 3) {
          const uvnitr = model.vykres.prvky.filter(p => { const o = N.obalkaPrvku([p]); return o[0] >= x0 && o[2] <= x1 && o[1] >= y0 && o[3] <= y1; }).map(p => p.id);
          vyber(r.pridat ? [...new Set(vybrane().concat(uvnitr))] : uvnitr);
        } else prekresli();
      }
      // tvar tažením: puštění daleko od stisku = druhý bod (u úsečky jedna úsečka)
      if (kon && e.type === 'pointerup' && kon.body.length === 1 && kon.dolu) {
        const [x, y] = mm(...souradnice(e));
        if (hypot(x - kon.dolu[0], y - kon.dolu[1]) * s > 8) {
          const bod = bodNastroje(x, y, kon.body[0]);
          kon.body.push([bod[0], bod[1]]);
          if (kon.body.length >= N.NASTROJE_TVARU[kon.nastroj].potreba || kon.nastroj === 'usecka') dokonciTvar(false); else prekresli();
        }
      }
      if (tah && tah.id === e.pointerId) { if (e.type === 'pointercancel') { tah = null; prekresli(); } else dokonciTah(); }
    }
    platno.addEventListener('pointerup', konec);
    platno.addEventListener('pointercancel', konec);
    platno.addEventListener('pointerleave', () => { kurzor = null; snap = null; nahoreNad = nahoreNadV = null; prekresli(); });
    platno.addEventListener('contextmenu', e => e.preventDefault());
    platno.addEventListener('wheel', e => {
      e.preventDefault();
      const c = souradnice(e);
      if (e.ctrlKey) zoom(exp(-e.deltaY * 0.01), c[0], c[1]);            // štípnutí na touchpadu
      else if (e.shiftKey) { ox -= e.deltaY || e.deltaX; prekresli(); }
      else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { ox -= e.deltaX; prekresli(); }
      else zoom(exp(-e.deltaY * 0.0015), c[0], c[1]);
    }, { passive: false });
    platno.addEventListener('dblclick', e => {
      if (kon && kon.nastroj === 'usecka') { dokonciTvar(false); return; }
      const c = souradnice(e), [x, y] = mm(c[0], c[1]);
      const k = model.vykres.prvky.find(p => p.druh === 'kota' && N.vzdalOdPrvku(p, x, y) < max(2, 10 / s));
      if (k) otevriKotu(k, false);
    });
    addEventListener('keydown', e => { if (e.key === ' ' && (e.target === document.body || e.target === platno)) { mezernik = true; e.preventDefault(); nastavKurzor(); } });
    addEventListener('keyup', e => { if (e.key === ' ') { mezernik = false; nastavKurzor(); } });
    addEventListener('blur', () => { if (mezernik) { mezernik = false; nastavKurzor(); } });   // keyup mimo okno (Alt+Tab) nepřijde

    function nastavKurzor() {
      const n = model.nast.nastroj;
      platno.style.cursor = mezernik || n === 'posun' ? 'grab' : n === 'guma' ? 'none' : n === 'vyber' ? 'default' : 'crosshair';
      if (n !== 'zaobleni' && n !== 'zkoseni') roh = null;
      if (kon && kon.nastroj !== n) zrusTvar();
      if (n !== 'mereni' && mereni) { mereni = null; }
      if (!CHYTA.has(n)) snap = null;
    }

    new ResizeObserver(() => { velikost(); if (!vlastniPohled) prizpusob(); else prekresli(); }).observe(obal);
    velikost(); prizpusob(); nastavKurzor();

    return {
      prekresli, prizpusob, nastavKurzor, vyber,
      kreslimTvar: () => !!kon,
      zrusTvar, cisloTvaru,
      dokonciTvar: () => dokonciTvar(false),
      otevriCislo: (popis, vychozi, hotovo) => otevriCislo(kurzor ? mm(kurzor[0], kurzor[1]) : null, popis, vychozi, hotovo),
      zmenaListu() { pozadiKlic = ''; prizpusob(); },
      zmenaPozadi() { pozadiKlic = ''; prekresli(); },
      zpet: () => vrat(zpet, vpred),
      znovu: () => vrat(vpred, zpet),
      lzeZpet: () => zpet.length > 0, lzeZnovu: () => vpred.length > 0,
      zapamatuj,
      zoom: k => zoom(k, w / 2, h / 2),
      pohled: () => ({ s, ox, oy }),
    };
  };
})(N3D);
