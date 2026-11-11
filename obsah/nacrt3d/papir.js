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
    const zpet = [], vpred = [];
    let ceka = false;

    const mm = (cx, cy) => [(cx - ox) / s, (cy - oy) / s];
    const souradnice = e => { const r = platno.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const noveId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    // ---------------------------------------------------------- zpět / vpřed
    function zapamatuj() {
      zpet.push(JSON.stringify(model.vykres.prvky));
      if (zpet.length > MAX_ZPET) zpet.shift();
      vpred.length = 0;
    }
    function vrat(z, do_) {
      if (!z.length) return false;
      do_.push(JSON.stringify(model.vykres.prvky));
      model.vykres.prvky = JSON.parse(z.pop());
      zavriKotu(false);
      tazeni = null;
      model.zmena('zpet');
      // vybraný prvek po vrácení nemusí existovat
      vyber(model.vybrane && model.vykres.prvky.some(p => p.id === model.vybrane) ? model.vybrane : null);
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
      const [ax, ay] = p.a, [bx, by] = p.b, u = atan2(by - ay, bx - ax), d = 2.2, r = 0.32;
      cara([p.a, p.b], st);
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
      for (const p of model.vykres.prvky) kresliPrvek(p, p === nahoreNad ? '#ff7a00' : p.id === model.vybrane ? MODRA : null);
      const vyb = model.vybrane && model.vykres.prvky.find(p => p.id === model.vybrane);
      if (vyb) for (const u of uchyty(vyb)) {
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
      if (kurzor && model.nast.nastroj === 'guma') {
        ctx.setLineDash([]); ctx.strokeStyle = '#ff7a00'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(kurzor[0], kurzor[1], polomerGumy() * s, 0, 2 * PI); ctx.stroke();
      }
    }

    // ---------------------------------------------------------- výsledek výkladu (vyřešený tvar)
    const MODRA = '#1f6fd1';
    function kresliVysledek() {
      const v = model.vysledek;
      if (!v || !v.vysledek) return;
      const podle = new Map();
      for (const t of v.vysledek.tvary) if (!t.pomocny) { if (!podle.has(t.pohled)) podle.set(t.pohled, []); podle.get(t.pohled).push(t); }
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
      const poradi = model.vybrane ? [...model.vykres.prvky].sort((p, q) => (q.id === model.vybrane) - (p.id === model.vybrane)) : model.vykres.prvky;
      for (const p of poradi) for (const u of uchyty(p)) if (hypot(u.x - x, u.y - y) <= tol) return { p, kde: u.kde };
      return null;
    }
    /** Přichytí bod při tažení úchytu (k bodům ostatních prvků, jinak k mřížce). */
    function prichytBod(x, y, krome) {
      let nej = null, dn = max(1.5, 10 / s);
      for (const q of N.bodyPrvku(model.vykres.prvky.filter(p => p !== krome))) { const d = hypot(q[0] - x, q[1] - y); if (d < dn) { dn = d; nej = q; } }
      if (nej) return nej.slice();
      if (model.nast.prichyt === false) return [x, y];
      const g = N.MRIZKA, gx = round(x / g) * g, gy = round(y / g) * g;
      return [abs(gx - x) < g * 0.3 ? gx : x, abs(gy - y) < g * 0.3 ? gy : y];
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
        else p[t.kde] = [qx, qy];
      }
      delete p.tah;                                     // surová kresba už neodpovídá
      model.zmena('uprava');
    }
    function vyber(id) { model.vybrane = id; model.zmenaVyberu && model.zmenaVyberu(); prekresli(); }

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
      const r = polomerGumy(), pred = model.vykres.prvky.length;
      const zbyle = model.vykres.prvky.filter(p => N.vzdalOdPrvku(p, x, y) > r);
      if (zbyle.length === pred) return;
      if (!tah.zmeneno) { zapamatuj(); tah.zmeneno = true; }
      model.vykres.prvky = zbyle;
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
        const pr = (q) => { let nej = q, dn = 3; for (const c of body) { const d = hypot(c[0] - q[0], c[1] - q[1]); if (d < dn) { dn = d; nej = c; } } return nej.slice(); };
        zapamatuj();
        const k = { id: noveId(), druh: 'kota', pero: 'kota', a: pr(a), b: pr(b), hodnota: null, tah: surove };
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
      if (model.nast.nastroj === 'vyber') {
        const u = uchytU(x, y);
        if (u) { tazeni = Object.assign(u, { id: e.pointerId }); if (u.p.id !== model.vybrane) vyber(u.p.id); return; }
        const p = prvekU(x, y, max(1.5, 8 / s));
        vyber(p ? p.id : null);
        return;
      }
      tah = { pero: model.nast.nastroj, typ: e.pointerType, id: e.pointerId, body: [[x, y]], tlak: [e.pressure || 0.5] };
      if (tah.pero === 'guma') gumuj(x, y);
      prekresli();
    });

    platno.addEventListener('pointermove', e => {
      const c = souradnice(e);
      kurzor = e.pointerType === 'mouse' || e.pointerType === 'pen' ? c : null;
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
      if (tah && tah.id === e.pointerId) {
        const udalosti = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        for (const u of (udalosti.length ? udalosti : [e])) {
          const q = souradnice(u), [x, y] = mm(q[0], q[1]), z = tah.body[tah.body.length - 1];
          if (hypot(x - z[0], y - z[1]) * s < 0.8) continue;
          if (tah.body.length >= MAX_BODU_TAHU) { tah.body[tah.body.length - 1] = [x, y]; continue; }   // konec tahu se neztratí
          tah.body.push([x, y]); tah.tlak.push(u.pressure || 0.5);
          if (tah.pero === 'guma') gumuj(x, y);
        }
        prekresli();
        return;
      }
      // zvýraznění prvku pod gumou
      if (model.nast.nastroj === 'guma' && kurzor) {
        const [x, y] = mm(c[0], c[1]);
        const p = prvekU(x, y, polomerGumy());
        if (p !== nahoreNad) nahoreNad = p;
        prekresli();
      } else if (nahoreNad) { nahoreNad = null; prekresli(); }
    });

    function konec(e) {
      if (e.pointerType === 'touch') {
        dotyky.delete(e.pointerId);
        if (dotyky.size < 2) stipnuti = null;
      }
      if (posun && posun.id === e.pointerId) { posun = null; platno.style.cursor = ''; nastavKurzor(); }
      if (tazeni && tazeni.id === e.pointerId) tazeni = null;
      if (tah && tah.id === e.pointerId) { if (e.type === 'pointercancel') { tah = null; prekresli(); } else dokonciTah(); }
    }
    platno.addEventListener('pointerup', konec);
    platno.addEventListener('pointercancel', konec);
    platno.addEventListener('pointerleave', () => { kurzor = null; if (nahoreNad) nahoreNad = null; prekresli(); });
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
    }

    new ResizeObserver(() => { velikost(); if (!vlastniPohled) prizpusob(); else prekresli(); }).observe(obal);
    velikost(); prizpusob(); nastavKurzor();

    return {
      prekresli, prizpusob, nastavKurzor, vyber,
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
