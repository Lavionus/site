// Nad krajinou — hlavní smyčka: renderer, načtení krajiny, moduly, fyzika s pevným krokem.
(function (D) {
  'use strict';

  const DT = 1 / 240;                       // krok fyziky
  const P = D.param;
  window.DRON_STAV = { faze: 'nacitani', snimky: 0, fps: 0 };

  const ctx = D.ctx = {
    THREE, renderer: null, scene: null, kamera: null, teren: null, prostredi: null,
    dron: null, dronModel: null,
    cas: 0, hodina: P.cas != null ? +P.cas : 10.5,
    pocasi: { oblacnost: P.oblacnost != null ? +P.oblacnost : 0.35, vitr: P.vitr != null ? +P.vitr : 3, smerVetru: 0.8, dest: 0, mlha: 0 },
    kvalita: P.kvalita != null ? +P.kvalita : 1,      // Střední: na ni je dělaný rozpočet výkonu
    seed: P.seed || 'udoli', mapa: P.mapa || 'udoli',
    pauza: false, vstup: null, fps: 60,
    nastaveni: {},
    vykresli: null,                          // post.js ho smí nahradit
  };
  const bez = new Set((P.bez || '').split(',').filter(Boolean));

  function stav(text, podil) {
    const el = document.getElementById('nacitani');
    if (!el) return;
    el.querySelector('.text').textContent = text;
    if (podil != null) el.querySelector('.pruh i').style.width = Math.round(podil * 100) + '%';
  }

  function nactiTeren() {
    return new Promise((ok, chyba) => {
      let w = null;
      if (location.protocol !== 'file:' && !P.bezWorkeru) { try { w = new Worker('dron/teren_worker.js'); } catch (e) { w = null; } }
      if (!w) { setTimeout(() => { try { ok(D.generujTeren(ctx.seed, ctx.mapa, p => stav('Krajina se tvoří…', p))); } catch (e) { chyba(e); } }, 30); return; }
      w.onmessage = e => {
        if (e.data.prubeh != null) stav('Krajina se tvoří…', e.data.prubeh);
        else if (e.data.chyba) { w.terminate(); chyba(new Error(e.data.chyba)); }
        else { w.terminate(); ok(e.data.data); }
      };
      w.onerror = e => { w.terminate(); console.warn('Worker selhal, generuji v hlavním vlákně', e.message);
        try { ok(D.generujTeren(ctx.seed, ctx.mapa)); } catch (x) { chyba(x); } };
      w.postMessage({ seed: ctx.seed, mapa: ctx.mapa });
    });
  }

  function rozmer() {
    const obal = document.getElementById('obal'), w = obal.clientWidth, h = obal.clientHeight;
    const Q = D.KVALITY[ctx.kvalita];
    ctx.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.pixelRatio));
    ctx.renderer.setSize(w, h);             // nastaví i CSS rozměr plátna (pozor na DPI)
    ctx.kamera.aspect = w / h; ctx.kamera.updateProjectionMatrix();
    D.vyvolej('rozmer', { w, h });
  }

  D.nastavKvalitu = function (q) {
    ctx.kvalita = D.clamp(q | 0, 0, 3);
    const Q = D.KVALITY[ctx.kvalita];
    ctx.renderer.shadowMap.enabled = Q.stiny;
    rozmer();
    for (const m of ctx.moduly) if (m.kvalita) try { m.kvalita(ctx, ctx.kvalita); } catch (e) { console.error(m.jmeno, e); }
    D.vyvolej('kvalita', ctx.kvalita);
  };

  D.novyLet = function (typ, start) {
    const t = ctx.teren;
    const s = start || t.start;
    if (ctx.dronModel) ctx.scene.remove(ctx.dronModel.skupina);
    ctx.dron = D.novyDron(typ || (ctx.dron && ctx.dron.typ) || P.typ || 'kamera', s);
    if (P.rezim) ctx.dron.rezim = P.rezim;
    ctx.dronModel = D.vytvorModelDronu(ctx.dron.typ);
    ctx.scene.add(ctx.dronModel.skupina);
    D.vyvolej('novyLet', ctx.dron);
  };

  async function start() {
    const Q = D.KVALITY[ctx.kvalita];
    const canvas = document.getElementById('scena');
    const r = ctx.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });   // vyhlazuje post.js (MSAA v HDR cíli)
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = Q.stiny;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    ctx.scene = new THREE.Scene();
    ctx.kamera = new THREE.PerspectiveCamera(70, 1, 0.06, 16000)   // daleký prstenec terénu sahá do 16 km;
    ctx.kamera.layers.enable(D.VRSTVY.NEODRAZET);
    ctx.vykresli = () => r.render(ctx.scene, ctx.kamera);
    rozmer();
    addEventListener('resize', rozmer);

    stav('Krajina se tvoří…', 0);
    const data = await nactiTeren();
    ctx.teren = D.terenZDat(data);
    ctx.prostredi = D.vytvorProstredi(ctx.teren, ctx.pocasi, ctx.seed);

    const dpos = D.paramCisla('dron');                 // x,z[,výška nad terénem[,kurz]]; typ dronu je v parametru typ=
    const st = dpos ? { x: dpos[0], z: dpos[1], y: Math.max(ctx.teren.vyska(dpos[0], dpos[1]), ctx.teren.hladina(dpos[0], dpos[1])), smer: (dpos[3] || 0) } : null;
    D.novyLet(P.typ || 'kamera', st);
    if (dpos && dpos[2] > 0.5) { const d = ctx.dron; d.p[1] += dpos[2]; d.armed = true; d.stav = 'leti'; d.naZemi = false; }

    ctx.moduly = D.MODULY.filter(m => !bez.has(m.jmeno)).sort((a, b) => a.poradi - b.poradi);
    for (const m of ctx.moduly) {
      if (!m.init) continue;
      stav('Připravuji: ' + (m.popis || m.jmeno) + '…');
      try { await m.init(ctx); } catch (e) { console.error('modul ' + m.jmeno, e); D.vyvolej('chybaModulu', { modul: m.jmeno, chyba: e }); }
    }
    for (const m of ctx.moduly) if (m.kvalita) try { m.kvalita(ctx, ctx.kvalita); } catch (e) { console.error(m.jmeno, e); }

    document.getElementById('nacitani').hidden = true;
    window.DRON_STAV.faze = 'bezi';
    D.vyvolej('pripraveno', ctx);
    smycka.posledni = performance.now();
    requestAnimationFrame(smycka);
  }

  let akum = 0, fpsCas = 0, fpsSn = 0;
  const NULA = { plyn: 0, yaw: 0, pitch: 0, roll: 0, prepinace: {}, udalosti: [] };
  // zastavení smyčky po N snímcích (snímky obrazovky v pomalém softwarovém WebGL)
  let zastavPo = P.zastav ? +P.zastav : 0, priZastaveni = null, bezi = true;
  D.dalsiSnimky = n => new Promise(ok => {
    zastavPo = window.DRON_STAV.snimky + (n || 1); priZastaveni = ok;
    if (!bezi) { bezi = true; window.DRON_STAV.zastaveno = false; smycka.posledni = performance.now(); requestAnimationFrame(smycka); }
  });
  function smycka(ted) {
    if (zastavPo && window.DRON_STAV.snimky + 1 >= zastavPo) {
      bezi = false; window.DRON_STAV.zastaveno = true;
      const ok = priZastaveni; priZastaveni = null; if (ok) setTimeout(ok, 0);
    } else requestAnimationFrame(smycka);
    let dt = (ted - smycka.posledni) / 1000; smycka.posledni = ted;
    if (!(dt > 0)) dt = 0; if (dt > 0.1) dt = 0.1;
    if (P.krok) dt = +P.krok;                            // pevný krok (testy, snímky)

    let vs = ctx.vstup = D.vstup ? D.vstup.cti(ctx) : NULA;
    for (const u of vs.udalosti || []) D.vyvolej(u, ctx);
    // přepínač režimu na vysílačce (index polohy)
    const pr = vs.prepinace && vs.prepinace.rezim;
    if (pr != null && pr !== smycka.rcRezim && ctx.dron.T) {
      smycka.rcRezim = pr; const R = ctx.dron.T.rezimy; ctx.dron.rezim = R[Math.min(pr, R.length - 1)]; D.vyvolej('rezimZmenen', ctx.dron);
    }
    // návrat domů: autopilot řídí, dokud pilot nepohne pákou
    if (ctx.navrat) {
      const pohyb = Math.abs(vs.pitch) + Math.abs(vs.roll) + Math.abs(vs.yaw) + (vs.plynStred !== false ? Math.abs(vs.plyn - 0.5) : 0);
      if (pohyb > 0.3 || ctx.dron.stav === 'havarie' || (ctx.dron.naZemi && ctx.dron.cas - ctx.navrat > 3)) { ctx.navrat = 0; if (D.osd) D.osd.zprava('Návrat domů ukončen', 1.5); }
      else {
        const a = D.autopilot.navratDomu(ctx.dron, ctx.prostredi);
        if (a) vs = ctx.vstup = Object.assign({}, vs, a, { udalosti: [] });
      }
    }
    if (!ctx.pauza) {
      akum += dt;
      if (ctx.prehravani) akum = 0;                      // přehrávání záznamu: fyzika stojí
      while (akum >= DT) { D.krokFyziky(ctx.dron, vs, ctx.prostredi, DT); akum -= DT; }
    }
    ctx.cas += dt;                                       // svět (mraky, vítr v trávě) žije i v menu
    const d = ctx.dron, sk = ctx.dronModel.skupina;
    sk.position.set(d.p[0], d.p[1], d.p[2]); sk.quaternion.set(d.q[0], d.q[1], d.q[2], d.q[3]);
    ctx.dronModel.update(d, ctx.pauza ? 0 : dt, ctx);
    D.U.uTime.value = ctx.cas; D.U.uDronPos.value.set(d.p[0], d.p[1], d.p[2]); D.U.uDronTah.value = d.tah || 0;

    for (const m of ctx.moduly) if (m.update) {
      try { m.update(ctx, dt); }
      catch (e) { console.error('modul ' + m.jmeno, e); m.update = null; D.vyvolej('chybaModulu', { modul: m.jmeno, chyba: e }); }
    }
    ctx.vykresli();

    fpsSn++; fpsCas += (ted - (smycka.pred || ted)) / 1000; smycka.pred = ted;
    if (fpsCas >= 1) { ctx.fps = fpsSn / fpsCas; fpsSn = 0; fpsCas = 0; window.DRON_STAV.fps = Math.round(ctx.fps); }
    window.DRON_STAV.snimky++;
  }

  // události ovládání, které patří hlavní smyčce
  D.na('rezim', () => {
    const d = ctx.dron; if (!d || !d.T) return;
    const R = d.T.rezimy; d.rezim = R[(R.indexOf(d.rezim) + 1) % R.length];
  });
  D.na('domu', () => {
    if (!ctx.dron || !D.autopilot || !D.autopilot.navratDomu || ctx.dron.naZemi) return;
    ctx.navrat = ctx.dron.cas;
    if (D.osd) D.osd.zprava('Návrat domů — pohni pákou pro převzetí', 3);
  });
  D.na('novyLet', () => { ctx.navrat = 0; });

  addEventListener('DOMContentLoaded', () => {
    start().catch(e => { console.error(e); stav('Chyba: ' + e.message); window.DRON_STAV.faze = 'chyba'; window.DRON_STAV.chyba = String(e.stack || e); });
  });
})(globalThis.DRON = globalThis.DRON || {});
