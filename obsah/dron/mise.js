// Nad krajinou — herní režimy: volný let, letová škola, fotomise, závody s duchem; záznam a přehrání letu.
(function (D) {
  'use strict';

  let ctx = null;
  const KLIC_HV = 'webapp_dron_hvezdy';
  function cti(k, vych) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? vych : v; } catch (e) { return vych; } }
  function zapis(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* nevadí */ } }
  const hvezdyVse = () => cti(KLIC_HV, {});
  function ulozHvezdy(id, n) { const h = hvezdyVse(); if (!(h[id] >= n)) { h[id] = n; zapis(KLIC_HV, h); } }
  const hv = n => '<span style="color:#ffd34d">' + '★'.repeat(n) + '☆'.repeat(3 - n) + '</span>';
  const f1 = x => (Math.round(x * 10) / 10).toFixed(1);
  const vzd = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  // ---------- značky ve scéně (obruče, terče, sloupy světla) ----------
  let skupina = null;
  const matZ = () => new THREE.MeshBasicMaterial({ color: 0x7fd1ff, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false });
  function obruc(c, smer, r, barva) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, Math.max(0.08, r * 0.045), 8, 48), matZ());
    if (barva) m.material.color.set(barva);
    m.position.set(c[0], c[1], c[2]); m.rotation.y = smer; skupina.add(m);
    return m;
  }
  function terc(x, z, r) {
    const y = ctx.teren.vyska(x, z) + 0.06;
    const g = new THREE.RingGeometry(r * 0.15, r, 40); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, matZ()); m.position.set(x, y, z); m.material.opacity = 0.6; skupina.add(m);
    const g2 = new THREE.RingGeometry(r * 0.45, r * 0.55, 40); g2.rotateX(-Math.PI / 2);
    const m2 = new THREE.Mesh(g2, matZ()); m2.position.set(x, y + 0.01, z); m2.material.color.set(0xffd34d); skupina.add(m2);
    return m;
  }
  function sloup(x, y, z, barva) {                 // svislý paprsek viditelný zdaleka
    const g = new THREE.CylinderGeometry(1.2, 1.2, 400, 12, 1, true); g.translate(0, 200, 0);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: barva || 0xffd34d, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, blending: THREE.AdditiveBlending }));
    m.position.set(x, y, z); skupina.add(m); return m;
  }
  function vycistiZnacky() {
    if (!skupina) return;
    skupina.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    skupina.clear();
  }

  // průlet úsečkou p0→p1 rovinou obruče / branky (střed c, kurz smer, obdélník nebo kruh)
  function prulet(p0, p1, c, smer, tvar) {
    const nx = -Math.sin(smer), nz = -Math.cos(smer);        // normála = směr průletu
    const d0 = (p0[0] - c[0]) * nx + (p0[2] - c[2]) * nz, d1 = (p1[0] - c[0]) * nx + (p1[2] - c[2]) * nz;
    if (d0 === d1 || Math.sign(d0) === Math.sign(d1)) return false;
    const t = d0 / (d0 - d1);
    const x = p0[0] + (p1[0] - p0[0]) * t - c[0], y = p0[1] + (p1[1] - p0[1]) * t - c[1], z = p0[2] + (p1[2] - p0[2]) * t - c[2];
    const bok = x * Math.cos(smer) - z * Math.sin(smer);        // vodorovná odchylka v rovině
    if (tvar.r) return Math.hypot(bok, y) <= tvar.r;
    return Math.abs(bok) <= tvar.sirka / 2 && y >= tvar.dole && y <= tvar.nahore;
  }

  // ---------- pomůcky pro start ----------
  function bodPred(s, vzdal, bok, smer) {             // bod před startem ve směru kurzu
    const sm = smer != null ? smer : s.smer;
    const x = s.x - Math.sin(sm) * vzdal + Math.cos(sm) * (bok || 0), z = s.z - Math.cos(sm) * vzdal - Math.sin(sm) * (bok || 0);
    return [x, ctx.teren.vyska(x, z), z];
  }
  function startVeVzduchu(vyska) {
    const d = ctx.dron; d.p[1] += vyska; d.armed = true; d.stav = 'leti'; d.naZemi = false;
    if (D.vstup && D.vstup.nastavArm) D.vstup.nastavArm(true);
  }

  // ---------- LEKCE ----------
  // kazda: { id, jmeno, popis, dron, rezim, vitr, priprav() → stav, krok(stav, dt) → {text, hotovo?, hvezdy?, neuspech?} }
  const LEKCE = [
    { id: 'vznaseni', jmeno: 'Vzlet a vznášení', popis: 'Vzlétni do výšky 3–6 m a vydrž 8 s na místě.', dron: 'kamera', rezim: 'gps', vitr: 1,
      priprav() { const s = ctx.teren.start; obruc([s.x, s.y + 4.5, s.z], s.smer, 1.6).rotation.x = Math.PI / 2; return { drz: 0, max: 0 }; },
      krok(st, dt) {
        const d = ctx.dron, s = ctx.teren.start, h = d.p[1] - s.y, odch = Math.hypot(d.p[0] - s.x, d.p[2] - s.z);
        const ok = h > 3 && h < 6 && odch < 2.5;
        st.drz = ok ? st.drz + dt : 0; if (ok) st.max = Math.max(st.max, odch);
        if (st.drz >= 8) return { hotovo: true, hvezdy: st.max < 0.8 ? 3 : st.max < 1.6 ? 2 : 1 };
        return { text: 'Plyn nahoru (W) — vzlétni ke kruhu.<br>Výška <b>' + f1(h) + ' m</b> · drž se uvnitř: <b>' + f1(st.drz) + ' / 8 s</b>' };
      } },
    { id: 'pristani', jmeno: 'Přistání na terči', popis: 'Doleť k terči 40 m před tebou a přistaň co nejblíž středu.', dron: 'kamera', rezim: 'gps', vitr: 2,
      priprav() { const c = bodPred(ctx.teren.start, 40); terc(c[0], c[2], 2.5); sloup(c[0], c[1], c[2]); return { c, cas: 0 }; },
      krok(st, dt) {
        st.cas += dt; const d = ctx.dron, od = Math.hypot(d.p[0] - st.c[0], d.p[2] - st.c[2]);
        if ((d.stav === 'pristal' || (d.naZemi && d.cas > 3)) && od < 4 && Math.hypot(d.v[0], d.v[1], d.v[2]) < 0.3)
          return { hotovo: true, hvezdy: od < 0.6 ? 3 : od < 1.3 ? 2 : 1, text: 'Odchylka ' + f1(od) + ' m' };
        return { text: 'Vzdálenost od středu terče: <b>' + f1(od) + ' m</b><br>Nad terčem klesej pomalu (S) až na zem.' };
      } },
    { id: 'ctverec', jmeno: 'Čtverec', popis: 'Proleť čtyřmi kruhy ve výšce 12 m.', dron: 'kamera', rezim: 'gps', vitr: 2,
      priprav() {
        const s = ctx.teren.start, b = [];
        [[30, 0], [30, 30], [0, 30], [0, 0]].forEach(([f, l], i) => {
          const p = bodPred(s, 15 + f, l - 15); p[1] = Math.max(p[1], ctx.teren.vyska(p[0], p[2])) + 12;
          b.push({ c: p, smer: s.smer + [0, Math.PI / 2, Math.PI, -Math.PI / 2][i] * -1 });
        });
        b.forEach(o => o.m = obruc(o.c, o.smer, 2.5));
        return { b, i: 0, cas: 0, pred: ctx.dron.p.slice() };
      },
      krok(st, dt) { return krokObruce(st, dt, [45, 70]); } },
    { id: 'otocka', jmeno: 'Otočka na místě', popis: 'Ve výšce otoč dron dokola, aniž by uletěl.', dron: 'kamera', rezim: 'gps', vitr: 2,
      priprav() { return { uhel: 0, pred: null, stred: null }; },
      krok(st, dt) {
        const d = ctx.dron, s = ctx.teren.start, h = d.p[1] - s.y, yaw = D.yawZQ(d.q);
        if (h < 4) { st.pred = null; return { text: 'Vzlétni aspoň do 4 m (W).' }; }
        if (!st.stred) st.stred = d.p.slice();
        if (st.pred != null) { let dy = yaw - st.pred; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); st.uhel += dy; }
        st.pred = yaw;
        const odch = vzd(d.p, st.stred);
        if (odch > 4) { st.uhel = 0; st.stred = d.p.slice(); }
        const st0 = Math.abs(D.stupne(st.uhel));
        if (st0 >= 360) return { hotovo: true, hvezdy: odch < 1.5 ? 3 : odch < 2.8 ? 2 : 1 };
        return { text: 'Otáčej se klávesami A / D.<br>Otočeno <b>' + Math.round(st0) + '°</b> z 360° · odchylka ' + f1(odch) + ' m' };
      } },
    { id: 'ksobe', jmeno: 'Let k sobě', popis: 'Z pohledu pilota doleť ke kruhu a vrať se — levá a pravá se otočí.', dron: 'kamera', rezim: 'gps', vitr: 2, kamera: 'los',
      priprav() { const c = bodPred(ctx.teren.start, 60, 15); c[1] += 8; obruc(c, ctx.teren.start.smer, 3); sloup(c[0], c[1] - 8, c[2]); return { c, faze: 0 }; },
      krok(st) {
        const d = ctx.dron, s = ctx.teren.start;
        if (st.faze === 0 && vzd(d.p, st.c) < 4) { st.faze = 1; vycistiZnacky(); terc(s.x, s.z, 2.5); D.osd.zprava('Teď zpátky a přistaň na startu', 2.5); }
        if (st.faze === 1) {
          const od = Math.hypot(d.p[0] - s.x, d.p[2] - s.z);
          if (d.naZemi && d.cas > 3 && od < 5) return { hotovo: true, hvezdy: od < 1.2 ? 3 : od < 2.5 ? 2 : 1 };
          return { text: 'Dron letí k tobě: <b>doleva je teď doprava</b>.<br>Přistaň na startu (' + f1(od) + ' m).' };
        }
        return { text: 'Doleť ke kruhu (' + Math.round(vzd(d.p, st.c)) + ' m). Sleduj dron z místa pilota.' };
      } },
    { id: 'osmicka', jmeno: 'Osmička', popis: 'Obleť dva sloupy po osmičce kruhy v pořadí.', dron: 'kamera', rezim: 'gps', vitr: 2,
      priprav() {
        const s = ctx.teren.start, b = [], sm = s.smer;
        const body = [[35, 0, 0], [55, 20, -Math.PI / 2], [75, 0, Math.PI], [55, -20, Math.PI / 2], [35, 0, 0], [15, -20, Math.PI / 2], [-5, 0, Math.PI], [15, 20, -Math.PI / 2]];
        for (const [f, l, o] of body.slice(0, 7)) { const p = bodPred(s, f, l); p[1] += 10; b.push({ c: p, smer: sm + o }); }
        for (const st of [[55, 0], [15, 0]]) { const p = bodPred(s, st[0], st[1]); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 16, 10), matZ()); m.material.color.set(0xff8a4d); m.position.set(p[0], p[1] + 8, p[2]); skupina.add(m); }
        b.forEach(o => o.m = obruc(o.c, o.smer, 3));
        return { b, i: 0, cas: 0, pred: ctx.dron.p.slice() };
      },
      krok(st, dt) { return krokObruce(st, dt, [60, 90]); } },
    { id: 'vitr', jmeno: 'Protivítr', popis: 'V režimu Úhel doleť proti silnému větru ke kruhu a zpět.', dron: 'kamera', rezim: 'uhel', vitr: 8,
      priprav() {
        const s = ctx.teren.start, smer = ctx.pocasi.smerVetru;
        // vítr vane DO směru (cos s, sin s) v xz (konvence fyzika.js) → proti větru je opačná strana
        const p = [s.x - Math.cos(smer) * 120, 0, s.z - Math.sin(smer) * 120]; p[1] = ctx.teren.vyska(p[0], p[2]) + 15;
        obruc(p, Math.atan2(Math.cos(smer), Math.sin(smer)), 3.5); sloup(p[0], p[1] - 15, p[2]);
        return { c: p, faze: 0, cas: 0 };
      },
      krok(st, dt) {
        st.cas += dt; const d = ctx.dron, s = ctx.teren.start;
        if (st.faze === 0 && vzd(d.p, st.c) < 5) { st.faze = 1; vycistiZnacky(); terc(s.x, s.z, 3); D.osd.zprava('Výborně! Teď s větrem zpátky', 2); }
        if (st.faze === 1) {
          const od = Math.hypot(d.p[0] - s.x, d.p[2] - s.z);
          if (d.naZemi && d.cas > 3 && od < 8) return { hotovo: true, hvezdy: st.cas < 60 ? 3 : st.cas < 100 ? 2 : 1 };
          return { text: 'Přistaň na startu (' + Math.round(od) + ' m) · ' + Math.round(st.cas) + ' s' };
        }
        return { text: 'Vítr ' + f1(ctx.pocasi.vitr) + ' m/s. V režimu Úhel tě unáší — nakloň se proti němu.<br>Ke kruhu: <b>' + Math.round(vzd(d.p, st.c)) + ' m</b> · ' + Math.round(st.cas) + ' s' };
      } },
    { id: 'bezgps', jmeno: 'Bez GPS', popis: 'V režimu Úhel se 15 s vznášej uvnitř kruhu.', dron: 'kamera', rezim: 'uhel', vitr: 3,
      priprav() { const s = ctx.teren.start; const c = [s.x, s.y + 5, s.z]; obruc(c, 0, 3).rotation.x = Math.PI / 2; return { c, drz: 0, max: 0 }; },
      krok(st, dt) {
        const d = ctx.dron, od = vzd(d.p, st.c), ok = od < 3;
        st.drz = ok ? st.drz + dt : 0; if (ok) st.max = Math.max(st.max, od);
        if (st.drz >= 15) return { hotovo: true, hvezdy: st.max < 1.5 ? 3 : st.max < 2.3 ? 2 : 1 };
        return { text: 'Dron se sám nedrží na místě — vyrovnávej vítr šipkami.<br>Uvnitř kruhu: <b>' + f1(st.drz) + ' / 15 s</b> · ' + f1(od) + ' m' };
      } },
    { id: 'nouze', jmeno: 'Nouzové přistání', popis: 'Baterie dochází. Doleť domů a přistaň dřív, než se vybije.', dron: 'kamera', rezim: 'gps', vitr: 4,
      start() { const s = ctx.teren.start; const p = bodPred(s, 320, 80); return { x: p[0], y: p[1], z: p[2], smer: s.smer + Math.PI }; },
      priprav() {
        startVeVzduchu(45);
        const d = ctx.dron; d.baterie.procent = 12; if (d.nastavBaterii) d.nastavBaterii(0.12);
        const s = ctx.teren.start; terc(s.x, s.z, 3); sloup(s.x, s.y, s.z);
        return {};
      },
      krok() {
        const d = ctx.dron, s = ctx.teren.start, od = Math.hypot(d.p[0] - s.x, d.p[2] - s.z);
        if (d.naZemi && d.cas > 2 && od < 8 && d.stav !== 'havarie') return { hotovo: true, hvezdy: d.baterie.procent > 5 ? 3 : d.baterie.procent > 2 ? 2 : 1 };
        if (d.baterie.procent <= 0.5 && !d.naZemi) return { neuspech: 'Baterie se vybila ve vzduchu.' };
        return { text: 'Domů: <b>' + Math.round(od) + ' m</b> · baterie <b>' + f1(d.baterie.procent) + ' %</b><br>Žlutý sloup ukazuje start. Shift = rychleji (víc spotřebuje).' };
      } },
    { id: 'acro', jmeno: 'První let v Acru', popis: 'FPV dron v režimu Acro: proleť pěti kruhy.', dron: 'fpv', rezim: 'acro', vitr: 1,
      priprav() {
        const s = ctx.teren.start, b = [];
        for (let i = 0; i < 5; i++) { const p = bodPred(s, 30 + i * 35, Math.sin(i * 1.3) * 18); p[1] = Math.max(p[1], ctx.teren.vyska(p[0], p[2])) + 8 + i; b.push({ c: p, smer: s.smer }); }
        b.forEach(o => o.m = obruc(o.c, o.smer, 3.5));
        return { b, i: 0, cas: 0, pred: ctx.dron.p.slice() };
      },
      krok(st, dt) {
        const r = krokObruce(st, dt, [25, 45]);
        if (!r.hotovo) r.text += '<br><small>Acro: náklon se po puštění páky nevrátí. Plyn drží výšku jen částečně.</small>';
        return r;
      } },
  ];

  // společný průlet řadou obručí
  function krokObruce(st, dt, limity) {
    st.cas += dt;
    const d = ctx.dron, o = st.b[st.i];
    o.m.material.color.set(0xffd34d);
    if (prulet(st.pred, d.p, o.c, o.smer, { r: o.m.geometry.parameters.radius * 1.05 })) {
      o.m.visible = false; st.i++;
      if (D.zvuk && D.zvuk.pip) D.zvuk.pip();
      if (st.i >= st.b.length) return { hotovo: true, hvezdy: st.cas < limity[0] ? 3 : st.cas < limity[1] ? 2 : 1, text: 'Čas ' + f1(st.cas) + ' s' };
    }
    st.pred = d.p.slice();
    return { text: 'Kruh <b>' + (st.i + 1) + ' / ' + st.b.length + '</b> · ' + Math.round(vzd(d.p, st.b[st.i].c)) + ' m · ' + f1(st.cas) + ' s' };
  }

  // ---------- FOTOMISE ----------
  const IDEAL = { kostel: [50, 220], vez: [50, 220], rozhledna: [40, 200], most: [30, 160], jezero: [150, 700], rybnik: [80, 400], vrchol: [100, 600],
    vesnice: [120, 500], alej: [40, 250], kaple: [25, 120], zvirata: [15, 60] };
  function fotomiseSeznam() {
    const t = ctx.teren, hv0 = hvezdyVse(), l = [];
    for (const c of (t.cile || [])) {
      l.push({ id: 'f_' + c.id, jmeno: c.jmeno, popis: 'Vyfoť ' + (c.jmeno || c.typ).toLowerCase() + ' z dronu.', cil: c });
    }
    const kostel = (t.cile || []).find(c => c.typ === 'kostel');
    if (kostel) l.push({ id: 'f_kostel_zlata', jmeno: kostel.jmeno + ' za zlaté hodiny', popis: 'Vyfoť kostel v teplém večerním světle.', cil: kostel, cas: 18.4 });
    if (D.zvirata && D.zvirata.seznam) l.push({ id: 'f_srnky', jmeno: 'Srnky', popis: 'Najdi srnky na okraji lesa a vyfoť je, než utečou.', zvirata: 'srnka' });
    l.forEach(m => { m.hvezdy = hv0[m.id] || 0; });
    return l;
  }
  function cilFotky(m) {
    if (m.zvirata) {
      const z = (D.zvirata.seznam() || []).filter(a => a.typ === m.zvirata);
      if (!z.length) return null;
      const k = ctx.kamera.position; z.sort((a, b) => Math.hypot(a.x - k.x, a.z - k.z) - Math.hypot(b.x - k.x, b.z - k.z));
      return { x: z[0].x, y: z[0].y + 0.8, z: z[0].z, typ: 'zvirata' };
    }
    const c = m.cil; const vys = { kostel: 14, vez: 20, rozhledna: 15, most: 3, vesnice: 6, kaple: 4 }[c.typ] || 2;
    return { x: c.x, y: (c.y != null ? c.y : ctx.teren.vyska(c.x, c.z)) + vys, z: c.z, typ: c.typ };
  }
  function hodnotFoto(m) {
    const cil = cilFotky(m); if (!cil) return { body: 0, duvod: 'Žádné srnky nejsou vidět.' };
    const k = ctx.kamera, p = new THREE.Vector3(cil.x, cil.y, cil.z), dist = k.position.distanceTo(p);
    const scr = p.clone().project(k);
    if (scr.z > 1 || Math.abs(scr.x) > 1 || Math.abs(scr.y) > 1) return { body: 0, duvod: 'Cíl není v záběru.' };
    if (D.Kolize && D.Kolize.paprsek) {
      const dir = p.clone().sub(k.position).normalize();
      const z = D.Kolize.paprsek([k.position.x, k.position.y, k.position.z], [dir.x, dir.y, dir.z], dist - 6);
      if (z && (z.vzdalenost != null ? z.vzdalenost : z.t) < dist - 8) return { body: 10, duvod: 'Cíl je zakrytý.' };
    }
    const [dmin, dmax] = IDEAL[cil.typ] || [40, 300];
    const sVzd = dist < dmin ? Math.max(0, 1 - (dmin - dist) / dmin) : dist > dmax ? Math.max(0, 1 - (dist - dmax) / dmax) : 1;
    // kompozice: nejblíž středu nebo průsečíku třetin
    const body3 = [[0, 0], [-1 / 3, 1 / 3], [1 / 3, 1 / 3], [-1 / 3, -1 / 3], [1 / 3, -1 / 3]];
    const odch = Math.min(...body3.map(([x, y]) => Math.hypot(scr.x - x, scr.y - y)));
    const sKomp = Math.max(0, 1 - odch / 0.45);
    const d = ctx.dron, w = Math.hypot(d.w[0], d.w[1], d.w[2]), v = Math.hypot(d.v[0], d.v[1], d.v[2]);
    const sKlid = Math.max(0, 1 - w / 1.2) * Math.max(0.4, 1 - v / 12);
    const sHorizont = ctx.kam.rezim === 'fpv' ? 0.75 : 1;
    let sSvetlo = 1;
    if (m.cas != null) sSvetlo = Math.max(0.2, 1 - Math.abs(ctx.hodina - m.cas) / 1.5);
    const body = Math.round(100 * (0.3 * sVzd + 0.35 * sKomp + 0.2 * sKlid + 0.15 * sSvetlo) * sHorizont);
    const rady = [];
    if (sVzd < 0.8) rady.push(dist < dmin ? 'moc blízko' : 'moc daleko');
    if (sKomp < 0.6) rady.push('dej cíl do středu nebo do třetiny');
    if (sKlid < 0.6) rady.push('fotka je rozmazaná, zpomal');
    if (sSvetlo < 0.7) rady.push('jiné světlo než zlatá hodina');
    return { body, duvod: rady.join(', ') };
  }

  // ---------- ZÁVODY ----------
  const RAM = 0.3;                                         // tloušťka rámu branky (shodně s kolize.js, pokud ji určí jinak, přebere se)
  function klicTrate(t) { return 'webapp_hra_dron_' + ctx.mapa + '_' + ctx.seed + '_' + t; }
  function trateSeznam() {
    return (ctx.teren.trate || []).map((t, i) => {
      const r = cti(klicTrate(i), null);
      return { id: i, jmeno: t.jmeno, branek: t.branky.length, rekord: r ? r.cas : null };
    });
  }
  function tvarBranky(b) {
    if (D.Kolize && D.Kolize.BRANKA) { const B = D.Kolize.BRANKA; return { c: [b.x, b.y, b.z], smer: b.uhel, tvar: { sirka: b.sirka, dole: B.dole, nahore: B.dole + b.vyska } }; }
    const ram = (D.Kolize && D.Kolize.BRANKA && D.Kolize.BRANKA.ram) || RAM;
    const dole = (D.Kolize && D.Kolize.BRANKA && D.Kolize.BRANKA.dole != null) ? D.Kolize.BRANKA.dole : 0;
    return { c: [b.x, b.y, b.z], smer: b.uhel, tvar: { sirka: b.sirka + ram, dole: dole - ram, nahore: dole + b.vyska + ram } };
  }

  // duch: model dronu poloprůhledně
  let duch = null;
  function vytvorDucha(typ) {
    const m = D.vytvorModelDronu(typ);
    m.skupina.traverse(o => {
      if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.35; o.material.depthWrite = false; }
      o.castShadow = false;
    });
    m.skupina.scale.setScalar(1.6);
    skupina.add(m.skupina);
    return m;
  }

  // ---------- STAV MISE ----------
  let aktivni = null;       // { typ, id, ... }
  const panel = h => D.osd && D.osd.panel(h);

  function novyLetPro(typ, rezim, start) {
    D.novyLet(typ, start);
    if (rezim && ctx.dron.T && ctx.dron.T.rezimy.includes(rezim)) ctx.dron.rezim = rezim; else if (rezim) ctx.dron.rezim = rezim;
  }

  function spust(typ, id, volby) {
    volby = volby || {};
    konec(true);
    ctx.pauza = false;
    aktivni = { typ, id, vysledek: null };
    if (typ === 'skola') {
      const L = LEKCE.find(l => l.id === id) || LEKCE[0];
      aktivni.lekce = L;
      if (L.vitr != null) ctx.pocasi.vitr = L.vitr;
      novyLetPro(L.dron, L.rezim, L.start ? L.start() : null);
      aktivni.st = L.priprav();
      if (L.kamera) ctx.kam.rezim = L.kamera;
      D.osd.zprava(L.jmeno, 2.5);
    } else if (typ === 'foto') {
      const M = fotomiseSeznam().find(m => m.id === id);
      if (!M) { aktivni = { typ: 'volny' }; novyLetPro(volby.dron, volby.rezim); return; }
      aktivni.m = M;
      if (M.cas != null) ctx.hodina = M.cas;
      novyLetPro('kamera', 'gps');
      const c = cilFotky(M); if (c && !M.zvirata) sloup(c.x, ctx.teren.vyska(c.x, c.z), c.z, 0x7fd1ff);
      aktivni.nejlepsi = 0;
      D.osd.zprava('Fotomise: ' + M.jmeno, 2.5);
      setTimeout(() => { if (ctx.kam.rezim !== 'gimbal') D.osd.zprava('Tip: C přepne na gimbal kameru, Q / E ji naklání', 3.5); }, 2600);
    } else if (typ === 'zavod') {
      const T = (ctx.teren.trate || [])[id | 0];
      if (!T) { aktivni = { typ: 'volny' }; novyLetPro(volby.dron, volby.rezim); return; }
      const b0 = T.branky[0];
      const sx = b0.x + Math.sin(b0.uhel) * 22, sz = b0.z + Math.cos(b0.uhel) * 22;
      novyLetPro(volby.dron || 'fpv', volby.rezim || 'acro', { x: sx, y: ctx.teren.vyska(sx, sz), z: sz, smer: b0.uhel });
      aktivni.T = T; aktivni.id = id | 0; aktivni.i = 0; aktivni.cas = -3; aktivni.pred = ctx.dron.p.slice(); aktivni.stopa = [];
      aktivni.branky = T.branky.map(tvarBranky);
      aktivni.znacka = obruc([0, 0, 0], 0, 0.6, 0xffd34d); aktivni.znacka.rotation.x = Math.PI / 2;
      const r = cti(klicTrate(aktivni.id), null);
      aktivni.rekord = r;
      if (r && r.duch && r.duch.length) { duch = vytvorDucha(ctx.dron.typ); aktivni.duch = r.duch; }
      if (D.stavby && D.stavby.zvyrazniBranku) D.stavby.zvyrazniBranku(aktivni.id, 0);
    } else {
      aktivni = { typ: 'volny' };
      novyLetPro(volby.dron || ctx.dron.typ, volby.rezim);
      panel('');
    }
    if (D.zaznam) D.zaznam.vymaz();
  }

  function konec(tise) {
    vycistiZnacky(); duch = null;
    if (D.stavby && D.stavby.zvyrazniBranku) D.stavby.zvyrazniBranku(-1, -1);
    panel(''); if (D.osd) D.osd.nadpis('');
    aktivni = null;
  }

  function dokonceno(text, hvezdy, id) {
    if (hvezdy) ulozHvezdy(id, hvezdy);
    aktivni.vysledek = true;
    panel('<h3>Splněno</h3>' + (hvezdy ? hv(hvezdy) + '<br>' : '') + (text || '') + '<br><small>R = znovu · Esc = menu</small>');
    if (D.zvuk && D.zvuk.fanfara) D.zvuk.fanfara();
  }

  function updateZavod(dt) {
    const a = aktivni, d = ctx.dron;
    if (a.cas < 0) {                                // odpočet: dron stojí
      a.cas += dt;
      d.v[0] = d.v[1] = d.v[2] = 0; d.armed = false; if (D.vstup && D.vstup.nastavArm) D.vstup.nastavArm(false);
      D.osd.nadpis(a.cas < 0 ? String(Math.ceil(-a.cas)) : 'START!');
      if (a.cas >= 0) { d.armed = true; if (D.vstup && D.vstup.nastavArm) D.vstup.nastavArm(true); setTimeout(() => D.osd && D.osd.nadpis(''), 700); }
      a.pred = d.p.slice();
      panel('<h3>' + a.T.jmeno + '</h3>Připrav se…');
      return;
    }
    if (a.hotovo) return;
    a.cas += dt;
    // stopa pro ducha (20 Hz)
    if (!a.posl || a.cas - a.posl >= 0.05) { a.posl = a.cas; a.stopa.push([+d.p[0].toFixed(2), +d.p[1].toFixed(2), +d.p[2].toFixed(2), +d.q[0].toFixed(3), +d.q[1].toFixed(3), +d.q[2].toFixed(3), +d.q[3].toFixed(3)]); }
    const B = a.branky[a.i];
    if (prulet(a.pred, d.p, B.c, B.smer, B.tvar)) {
      a.i++;
      D.vyvolej('branka', { trat: a.id, index: a.i - 1 });
      if (D.zvuk && D.zvuk.pip) D.zvuk.pip();
      if (D.stavby && D.stavby.zvyrazniBranku) D.stavby.zvyrazniBranku(a.id, a.i);
      if (a.i >= a.branky.length) {
        a.hotovo = true;
        const lepsi = !a.rekord || a.cas < a.rekord.cas;
        if (lepsi) zapis(klicTrate(a.id), { cas: a.cas, duch: a.stopa.length < 6000 ? a.stopa : [] });
        dokonceno('Čas <b>' + a.cas.toFixed(2) + ' s</b>' + (lepsi ? ' — nový rekord!' : ' (rekord ' + a.rekord.cas.toFixed(2) + ' s)'), 0);
        a.znacka.visible = false;
        return;
      }
    }
    a.pred = d.p.slice();
    const N = a.branky[a.i];
    const T = a.T.branky[a.i];
    const dole = (D.Kolize && D.Kolize.BRANKA && D.Kolize.BRANKA.dole) || 0;
    a.znacka.position.set(N.c[0], N.c[1] + dole + T.vyska + 1.6, N.c[2]);
    a.znacka.rotation.z += dt * 2;
    const vz = Math.hypot(d.p[0] - N.c[0], d.p[2] - N.c[2]);
    panel('<h3>' + a.T.jmeno + '</h3>Branka <b>' + (a.i + 1) + ' / ' + a.branky.length + '</b> · ' + Math.round(vz) + ' m<br>Čas <b>' + a.cas.toFixed(1) + ' s</b>'
      + (a.rekord ? ' · rekord ' + a.rekord.cas.toFixed(2) + ' s' : ''));
    // duch
    if (duch && a.duch) {
      const k = Math.min(a.duch.length - 1, Math.floor(a.cas / 0.05)), s = a.duch[k];
      duch.skupina.visible = k < a.duch.length - 1;
      duch.skupina.position.set(s[0], s[1], s[2]); duch.skupina.quaternion.set(s[3], s[4], s[5], s[6]);
    }
  }

  // ---------- ZÁZNAM A PŘEHRÁNÍ LETU ----------
  const ZAZ_HZ = 30, ZAZ_MAX = ZAZ_HZ * 120;
  const zaz = { b: [], t: 0, prehrava: null };
  D.zaznam = {
    delka: () => zaz.b.length / ZAZ_HZ,
    vymaz() { zaz.b.length = 0; },
    prehraj() {
      if (zaz.b.length < 10) return;
      const s0 = zaz.b[0];
      zaz.prehrava = { i: 0, t: 0, puvodni: ctx.dron, kam: ctx.kam.rezim, zaber: 0, zaberCas: 0,
        proxy: Object.assign({}, ctx.dron, { p: s0.p.slice(), q: s0.q.slice(), motory: s0.m.slice(), v: [0, 0, 0], w: [0, 0, 0] }) };
      ctx.dron = zaz.prehrava.proxy; ctx.prehravani = true; ctx.kam.rezim = 'volna';
      if (D.osd) { D.osd.zprava('Přehrávání — libovolná klávesa ukončí', 3); }
      zaz.konec = () => { removeEventListener('keydown', zaz.konec, true); D.zaznam.zastav(); };
      setTimeout(() => addEventListener('keydown', zaz.konec, true), 300);
    },
    zastav() {
      const p = zaz.prehrava; if (!p) return;
      ctx.dron = p.puvodni; ctx.prehravani = false; ctx.kam.rezim = p.kam === 'volna' ? 'chase' : p.kam;
      zaz.prehrava = null;
    },
  };
  function updateZaznam(dt) {
    const d = ctx.dron;
    if (zaz.prehrava) {
      const P = zaz.prehrava; P.t += dt;
      const f = P.t * ZAZ_HZ, i = Math.floor(f);
      if (i >= zaz.b.length - 1) { D.zaznam.zastav(); return; }
      const a = zaz.b[i], b = zaz.b[i + 1], u = f - i;
      for (let k = 0; k < 3; k++) { P.proxy.p[k] = a.p[k] + (b.p[k] - a.p[k]) * u; P.proxy.v[k] = (b.p[k] - a.p[k]) * ZAZ_HZ; }
      const qa = new THREE.Quaternion(...a.q), qb = new THREE.Quaternion(...b.q); qa.slerp(qb, u);
      P.proxy.q[0] = qa.x; P.proxy.q[1] = qa.y; P.proxy.q[2] = qa.z; P.proxy.q[3] = qa.w;
      P.proxy.motory = a.m; P.proxy.tah = a.m.reduce((s, x) => s + x, 0) / 4;
      // filmová kamera: střídá záběry po 5 s
      P.zaberCas -= dt;
      const k = ctx.kamera, dp = new THREE.Vector3(...P.proxy.p);
      if (P.zaberCas <= 0) {
        P.zaber = (P.zaber + 1) % 3; P.zaberCas = 5;
        const v = new THREE.Vector3(...P.proxy.v); const sm = v.lengthSq() > 1 ? v.normalize() : new THREE.Vector3(0, 0, -1);
        P.bod = dp.clone().addScaledVector(sm, 35).add(new THREE.Vector3(sm.z * 12, 6, -sm.x * 12));
        const zem = ctx.teren.vyska(P.bod.x, P.bod.z) + 2; if (P.bod.y < zem) P.bod.y = zem;
        P.uhel = Math.random() * 6.28;
      }
      if (P.zaber === 0) { k.position.copy(P.bod); k.lookAt(dp); k.fov = 40; }                  // průlet kolem pevného bodu
      else if (P.zaber === 1) {                                                                 // oblet
        P.uhel += dt * 0.35; k.position.set(dp.x + Math.sin(P.uhel) * 12, dp.y + 4, dp.z + Math.cos(P.uhel) * 12);
        const zem = ctx.teren.vyska(k.position.x, k.position.z) + 1.5; if (k.position.y < zem) k.position.y = zem;
        k.lookAt(dp); k.fov = 50;
      } else { k.position.copy(dp).add(new THREE.Vector3(0, 30, 0)).addScaledVector(new THREE.Vector3(Math.sin(P.uhel), 0, Math.cos(P.uhel)), 40); k.lookAt(dp); k.fov = 45; }
      k.updateProjectionMatrix();
      return;
    }
    if (ctx.pauza || !d.armed) return;
    zaz.t += dt;
    if (zaz.t >= 1 / ZAZ_HZ) {
      zaz.t = 0;
      zaz.b.push({ p: d.p.slice(), q: d.q.slice(), m: d.motory.slice() });
      if (zaz.b.length > ZAZ_MAX) zaz.b.shift();
    }
  }

  // ---------- veřejné API ----------
  D.mise = {
    spust, konec,
    aktivni: () => aktivni,
    lekce: () => { const h = hvezdyVse(); return LEKCE.map(l => ({ id: l.id, jmeno: l.jmeno, popis: l.popis, dron: l.dron, rezim: l.rezim, vitr: l.vitr, hvezdy: h[l.id] || 0 })); },
    fotomise: () => ctx ? fotomiseSeznam() : [],
    trate: () => ctx ? trateSeznam() : [],
    cileNaMape() {
      if (!aktivni) return [];
      if (aktivni.typ === 'foto' && aktivni.m && aktivni.m.cil) return [{ x: aktivni.m.cil.x, z: aktivni.m.cil.z }];
      if (aktivni.typ === 'zavod' && aktivni.branky) return aktivni.branky.slice(aktivni.i, aktivni.i + 3).map((b, i) => ({ x: b.c[0], z: b.c[2], barva: i ? '#7fd1ff' : '#ffd34d' }));
      if (aktivni.typ === 'skola' && aktivni.st && aktivni.st.b) return aktivni.st.b.slice(aktivni.st.i, aktivni.st.i + 1).map(o => ({ x: o.c[0], z: o.c[2], barva: '#ffd34d' }));
      if (aktivni.typ === 'skola' && aktivni.st && aktivni.st.c) return [{ x: aktivni.st.c[0], z: aktivni.st.c[2] }];
      return [];
    },
  };

  D.modul('mise', {
    poradi: 85,
    popis: 'mise',
    init(c) {
      ctx = c;
      skupina = new THREE.Group(); skupina.name = 'mise'; ctx.scene.add(skupina);
      D.na('reset', () => {
        if (zaz.prehrava) return;
        const a = aktivni;
        if (a && a.typ !== 'volny') spust(a.typ, a.id, { dron: ctx.dron.typ, rezim: ctx.dron.rezim });
        else { const typ = ctx.dron.typ, rez = ctx.dron.rezim; D.novyLet(typ); ctx.dron.rezim = rez; if (D.zaznam) D.zaznam.vymaz(); }
      });
      D.na('foto', () => {
        if (zaz.prehrava) return;
        const a = aktivni;
        let popisek = '';
        if (a && a.typ === 'foto' && !a.vysledek) {
          const h = hodnotFoto(a.m);
          a.nejlepsi = Math.max(a.nejlepsi, h.body);
          popisek = h.body + ' bodů' + (h.duvod ? ' — ' + h.duvod : '');
          const hvezdy = h.body >= 85 ? 3 : h.body >= 65 ? 2 : h.body >= 40 ? 1 : 0;
          D.osd.vyfot(ctx, popisek);
          if (hvezdy) dokonceno('Fotka: <b>' + h.body + ' bodů</b>' + (h.duvod ? '<br><small>' + h.duvod + '</small>' : ''), hvezdy, a.m.id);
          else D.osd.zprava('Fotka: ' + h.body + ' bodů — ' + (h.duvod || 'zkus to znovu'), 3.5);
          return;
        }
        D.osd.vyfot(ctx, new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }));
      });
      D.na('havarie', () => {
        if (aktivni && aktivni.typ === 'zavod' && !aktivni.hotovo) panel('<h3>' + aktivni.T.jmeno + '</h3>Havárie po ' + aktivni.cas.toFixed(1) + ' s<br><small>R = znovu</small>');
      });
    },
    update(c, dt) {
      updateZaznam(dt);
      if (!aktivni || zaz.prehrava || !dt || ctx.pauza) return;
      if (aktivni.typ === 'skola' && !aktivni.vysledek) {
        const r = aktivni.lekce.krok(aktivni.st, dt) || {};
        if (r.hotovo) dokonceno(r.text, r.hvezdy, aktivni.lekce.id);
        else if (r.neuspech) { aktivni.vysledek = true; panel('<h3>Nevyšlo</h3>' + r.neuspech + '<br><small>R = zkusit znovu</small>'); }
        else if (ctx.dron.stav === 'havarie') panel('<h3>' + aktivni.lekce.jmeno + '</h3>Havárie. <small>R = zkusit znovu</small>');
        else panel('<h3>' + aktivni.lekce.jmeno + '</h3>' + (r.text || ''));
      } else if (aktivni.typ === 'foto' && !aktivni.vysledek) {
        const cil = cilFotky(aktivni.m);
        const d = ctx.dron;
        const vz = cil ? Math.round(Math.hypot(d.p[0] - cil.x, d.p[2] - cil.z)) : '—';
        panel('<h3>Fotomise</h3>' + aktivni.m.popis + '<br>Vzdálenost k cíli <b>' + vz + ' m</b>' + (aktivni.nejlepsi ? ' · nejlepší fotka ' + aktivni.nejlepsi + ' b.' : '') + '<br><small>F = vyfotit</small>');
      } else if (aktivni.typ === 'zavod') updateZavod(dt);
    },
  });
})(globalThis.DRON = globalThis.DRON || {});
