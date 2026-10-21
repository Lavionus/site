/* Modelář 3D – přesné úpravy (OpenCascade): zaoblení a sražení hran, skořepina.
   Postup: vybrat úpravu, nastavit velikost a klikat na hrany (u skořepiny na rovné
   plochy, které mají zůstat otevřené) – každý klik úpravu rovnou provede (jeden
   krok Zpět), další klik ji rozšíří, klik na vybranou hranu ji vrátí. Změna
   velikosti přepočítá všechny vybrané hrany. Panel vpravo (nemodální) ukazuje
   stav, SVG vrstva nad plátnem hrany tělesa (každý snímek promítnuté) a u
   skořepiny značky všech rovných ploch. Když se úprava nepovede (třeba moc velký
   poloměr), dokument se nezmění a panel ukáže českou chybu.
   Hrany a plochy jsou v přirozených souřadnicích skupiny (rámce), takže posun,
   otočení i změna velikosti skupiny je nerozbijí. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const $ = id => document.getElementById(id);
  const POPIS = { zaobleni: 'Zaoblení hran', srazeni: 'Sražení hran', skorepina: 'Skořepina' };
  const HODNOTA = { zaobleni: 'Poloměr', srazeni: 'Sražení', skorepina: 'Tloušťka stěny' };
  const VYCHOZI = { zaobleni: 2, srazeni: 1, skorepina: 1.6 };

  /** Naposledy použitá velikost úpravy (pamatuje si prohlížeč), jinak výchozí. */
  const KLIC_HODNOT = 'modelar_occt_hodnoty';
  function posledni(op) {
    try { const v = JSON.parse(localStorage.getItem(KLIC_HODNOT) || '{}')[op]; if (v > 0 && v < 1000) return v; } catch (e) { /* bez úložiště */ }
    return VYCHOZI[op];
  }
  function zapamatuj(op, v) {
    try { const o = JSON.parse(localStorage.getItem(KLIC_HODNOT) || '{}'); o[op] = v; localStorage.setItem(KLIC_HODNOT, JSON.stringify(o)); } catch (e) { /* bez úložiště */ }
  }

  M.vytvorOcctUI = function (S) {
    const okno = $('oknoOcct'), info = $('occtInfo');
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'occt-vrstva');
    svg.setAttribute('aria-hidden', 'true');
    svg.hidden = true;
    $('plocha').appendChild(svg);
    let ed = null;            // rozpracovaná úprava
    let token = 0;

    const hodnota = () => M.prectiCislo($('occtHodnota').value);
    /** Má uzel nahoře vrstvu téže úpravy (tu, kterou panel mění)? */
    const maVrstvu = (u, op) => !!(u && u.druh === 'skupina' && u.occt && u.occt.operace === op);
    /** Rámec pro výběr hran: skupina s úpravou bez úpravy, jinak těleso obalené skupinou. */
    const ramPro = (u, op) => maVrstvu(u, op) ? M.bezUpravy(u) : M.obalUpravou(u, null);
    const matice = () => M.maticeUzlu(ed.ram);

    /** Zavře panel; dokoncit = rozpracovaný výpočet (klik těsně před „Hotovo“) se po doběhnutí ještě zapíše. */
    function zavri(dokoncit = false) {
      if (!ed) { if (okno.open) okno.close(); return; }      // panel bez úpravy musí jít zavřít vždy
      if (dokoncit && ed.pocita) { ed.dokoncit = true; Dialog.info('⏳ Poslední úprava se ještě dopočítá a zapíše.'); }
      ed = null; token++;
      svg.hidden = true; svg.innerHTML = '';
      if (okno.open) okno.close();
      if (M.app.rezim === 'hrany' || M.app.rezim === 'plochy') M.nastavRezim(null);
    }

    // ------------------------------------------------------------ viditelnost hran
    // Hrana za stěnou (vnitřní hrana skořepiny za přední stěnou) se kreslí tečkovaně a nejde na ni
    // kliknout – jinak by klik na viditelnou hranu mohl vybrat tu skrytou těsně za ní. Viditelnost se
    // zjišťuje paprsky z kamery (vzorky podél hran); počítá se až po zastavení kamery.
    let vid = null, vidKlic = '', vidCasovac = 0, vidPlan = '';
    let obrHran = [], najeta = null;          // viditelné úseky na obrazovce {i, body: [[x, y, hloubka]]} pro výběr kliknutím
    /** Hrana pod kurzorem: nejbližší viditelný úsek (do 8 px); hrany těsně u sebe (vnější a vnitřní roh
        skořepiny, čáry přes sebe) rozhodne vzdálenost od kamery – blíž je ta, kterou uživatel vidí navrchu. */
    const prahZasahu = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 16 : 8;     // prst je širší než myš
    function hranaVBode(x, y) {
      const kand = [];
      for (const u of obrHran) {
        let nej = Infinity, hl = Infinity;
        for (let j = 1; j < u.body.length; j++) {
          const [ax, ay, ah] = u.body[j - 1], [bx, by, bh] = u.body[j];
          const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
          const t = l2 ? M.omez(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1) : 0;
          const d = Math.hypot(ax + dx * t - x, ay + dy * t - y);
          if (d < nej) { nej = d; hl = ah + (bh - ah) * t; }
        }
        if (nej <= prahZasahu) kand.push({ i: u.i, d: nej, hl });
      }
      if (!kand.length) return null;
      // rozhoduje vzdálenost od kurzoru; skoro stejně daleko (čáry přes sebe) = ta blíž ke kameře
      kand.sort((a, b) => Math.abs(a.d - b.d) <= 0.75 ? a.hl - b.hl : a.d - b.d);
      return kand[0].i;
    }
    /** Body hrany zhuštěné na ~16 úseků (rovná hrana má jen dva body – viditelnost by šla jen po celých hranách). */
    const husteBody = new WeakMap();
    function bodyHrany(h) {
      let b = husteBody.get(h);
      if (b) return b;
      const p = h.body, n = p.length / 3;
      let L = 0;
      for (let j = 1; j < n; j++) L += Math.hypot(p[j * 3] - p[j * 3 - 3], p[j * 3 + 1] - p[j * 3 - 2], p[j * 3 + 2] - p[j * 3 - 1]);
      const krok = L / 16 || 1, o = [p[0], p[1], p[2]];
      for (let j = 1; j < n; j++) {
        const a = (j - 1) * 3, c = j * 3;
        const k = Math.max(1, Math.ceil(Math.hypot(p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]) / krok - 1e-9));
        for (let t = 1; t <= k; t++) for (let x = 0; x < 3; x++) o.push(p[a + x] + (p[c + x] - p[a + x]) * t / k);
      }
      b = o; husteBody.set(h, b);
      return b;
    }
    // totožnost: těleso, jeho hrany a geometrie – viditelnost jiného tělesa (stejné indexy hran!) neplatí ani chvíli
    let vidTotoznost = '';
    const totoznost = () => ed ? ed.id + ':' + (ed.hrany ? ed.hrany.length : 0) + ':' + (ed.plochy ? ed.plochy.length : 0) + ':' + M.klicGeometrie(M.najdiUzel(M.app.dok, ed.id) || ed.puvodni) : '';
    const klicPohledu = () => {
      const k = S.kamera.aktivni();
      return k.matrixWorld.elements.map(x => x.toFixed(4)).join(',') + '|' + k.projectionMatrix.elements[0].toFixed(5) + '|' + totoznost();
    };
    function spocitejViditelnost() {
      vidCasovac = 0; vidPlan = '';
      if (!ed || !S.telesa || !S.telesa.zakryte) return;
      const A = matice();
      const ob = M.obalkaUzlu(M.najdiUzel(M.app.dok, ed.id) || ed.puvodni);
      const diag = Math.hypot(ob.max[0] - ob.min[0], ob.max[1] - ob.min[1], ob.max[2] - ob.min[2]);
      const tol = M.omez(diag * 0.004, 0.05, 0.4);
      const body = [], kam = [];
      if (ed.op !== 'skorepina') {
        const hrany = ed.hrany || [];
        const naHranu = Math.max(3, Math.floor(2000 / Math.max(1, hrany.length)));
        hrany.forEach((h, i) => {
          const hb = bodyHrany(h), n = hb.length / 3, k = Math.min(n, naHranu);
          for (let j = 0; j < k; j++) {
            const q = k === 1 ? 0 : Math.round(j * (n - 1) / (k - 1));
            body.push(new THREE.Vector3(hb[q * 3], hb[q * 3 + 1], hb[q * 3 + 2]).applyMatrix4(A));
            kam.push([i, q]);
          }
        });
      } else (ed.plochy || []).forEach((f, i) => { body.push(new THREE.Vector3(...f.stred).applyMatrix4(A)); kam.push([i, 0]); });
      const z = S.telesa.zakryte(body, tol);
      // hrana → seřazené vzorky [index bodu, zakryto]
      const v = new Map();
      kam.forEach(([i, q], j) => { if (!v.has(i)) v.set(i, []); v.get(i).push([q, z[j]]); });
      vid = v; vidKlic = klicPohledu(); vidTotoznost = totoznost();
      kresli();
    }
    /** Je bod q hrany i zakrytý (podle nejbližšího vzorku)? */
    function zakryty(i, q) {
      const vz = vid && vid.get(i);
      if (!vz) return false;
      let nej = vz[0], d0 = Infinity;
      for (const s of vz) { const d = Math.abs(s[0] - q); if (d < d0) { d0 = d; nej = s; } }
      return nej[1];
    }

    function kresli() {
      if (!ed) return;
      svg.innerHTML = '';
      if (vid && vidTotoznost !== totoznost()) vid = null;      // jiné těleso nebo nové hrany: do přepočtu vše viditelné
      // až po zastavení kamery (každá změna pohledu odloží výpočet znovu)
      const kp = klicPohledu();
      if (kp !== vidKlic && kp !== vidPlan) { clearTimeout(vidCasovac); vidPlan = kp; vidCasovac = setTimeout(spocitejViditelnost, 140); }
      const A = matice(), v = new THREE.Vector3();
      const naObr = (x, y, z) => S.naObrazovku(v.set(x, y, z).applyMatrix4(A));
      const oko = S.kamera.aktivni().position;
      obrHran = [];
      const cara = (body, trida, i) => {
        const pl = document.createElementNS(NS, 'polyline');
        pl.setAttribute('points', body.join(' '));
        pl.setAttribute('class', trida);
        pl.dataset.i = i;
        return pl;
      };
      if (ed.op !== 'skorepina') {
        // skryté úseky dospod (bez zásahu), viditelné nad ně
        const skryte = document.createDocumentFragment(), viditelne = document.createDocumentFragment();
        (ed.hrany || []).forEach((h, i) => {
          const vybrana = ed.vybraneH.has(i);
          let usek = [], skr = null, xy = [];
          const zavri = () => {
            if (usek.length >= 2) {
              if (skr) skryte.appendChild(cara(usek, 'hrana skryta' + (vybrana ? ' vybrana' : ''), i));
              else {
                viditelne.appendChild(cara(usek, 'hrana' + (vybrana ? ' vybrana' : ''), i)); viditelne.appendChild(cara(usek, 'zasah', i));
                obrHran.push({ i, body: xy });
              }
            }
          };
          const hb = bodyHrany(h);
          for (let j = 0, q = 0; j < hb.length; j += 3, q++) {
            const p = naObr(hb[j], hb[j + 1], hb[j + 2]);
            if (!p) { zavri(); usek = []; xy = []; skr = null; continue; }
            const bod = p[0].toFixed(1) + ',' + p[1].toFixed(1);
            const hl = v.distanceTo(oko);            // v = světový bod z naObr
            const z = zakryty(i, q);
            if (skr !== null && z !== skr) {
              const posl = usek[usek.length - 1], poslXY = xy[xy.length - 1];
              zavri(); usek = posl ? [posl] : []; xy = poslXY ? [poslXY] : [];
            }
            skr = z;
            usek.push(bod); xy.push([p[0], p[1], hl]);
          }
          zavri();
        });
        svg.appendChild(skryte);
        svg.appendChild(viditelne);
        if (najeta != null) svg.querySelectorAll(`.zasah[data-i="${najeta}"]`).forEach(p => p.classList.add('najeto'));
      } else {
        // značka u každé rovné plochy: prázdná = zavřená, plná = otevřená; za tělesem tlumená
        (ed.plochy || []).forEach((f, i) => {
          const p = naObr(...f.stred);
          if (!p) return;
          const c = document.createElementNS(NS, 'circle');
          c.setAttribute('cx', p[0]); c.setAttribute('cy', p[1]); c.setAttribute('r', 8);
          c.setAttribute('class', 'plocha zasah' + (ed.vybraneP.has(i) ? ' otevrena' : '') + (zakryty(i, 0) ? ' skryta' : ''));
          c.dataset.p = i;
          const t = document.createElementNS(NS, 'title');
          t.textContent = (ed.vybraneP.has(i) ? 'Otevřená plocha (klik = zavřít)' : 'Klik = tuto plochu otevřít') + (zakryty(i, 0) ? ' – plocha je za tělesem' : '');
          c.appendChild(t);
          svg.appendChild(c);
        });
      }
    }
    M.na('kamera', () => { if (ed) kresli(); });
    // nová síť tělesa (dopočítaná úprava): viditelnost hran znovu
    M.na('geometrie', () => { vidKlic = ''; if (ed) kresli(); });
    svg.addEventListener('wheel', e => { S.renderer.domElement.dispatchEvent(new WheelEvent('wheel', e)); e.preventDefault(); }, { passive: false });

    // zvýraznění pod kurzorem = hrana, kterou vybere klik (ne ta, která leží v DOM navrchu)
    svg.addEventListener('pointermove', e => {
      if (!ed || ed.op === 'skorepina') return;
      const r = svg.getBoundingClientRect(), i = e.target.dataset && e.target.dataset.i != null ? hranaVBode(e.clientX - r.left, e.clientY - r.top) : null;
      if (i === najeta) return;
      najeta = i;
      svg.querySelectorAll('.zasah.najeto').forEach(p => p.classList.remove('najeto'));
      if (i != null) svg.querySelectorAll(`.zasah[data-i="${i}"]`).forEach(p => p.classList.add('najeto'));
    });
    svg.addEventListener('pointerleave', () => { najeta = null; svg.querySelectorAll('.zasah.najeto').forEach(p => p.classList.remove('najeto')); });

    // klik na hranu (nebo značku plochy) ji přidá či odebere a úpravu hned provede
    svg.addEventListener('pointerdown', e => {
      const t = e.target;
      if (!ed || !t.classList.contains('zasah') || e.button !== 0) return;
      e.stopPropagation(); e.preventDefault();
      if (document.activeElement && document.activeElement.matches('#inspektor input')) document.activeElement.blur();
      if (t.dataset.i != null) {
        const r = svg.getBoundingClientRect(), i = hranaVBode(e.clientX - r.left, e.clientY - r.top);
        prepni(ed.vybraneH, i == null ? +t.dataset.i : i);
      }
      else if (t.dataset.p != null) prepni(ed.vybraneP, +t.dataset.p);
    });
    function prepni(mnozina, i) {
      const bylo = mnozina.has(i);
      if (bylo) mnozina.delete(i); else mnozina.add(i);
      if (mnozina === ed.vybraneP && !bylo) ed.uzavrena = false;
      // poslední otevřená plocha zavřená: skořepina zůstane jako uzavřená dutina (ne celá pryč)
      const naDutinu = mnozina === ed.vybraneP && bylo && !mnozina.size;
      if (naDutinu) { ed.uzavrena = true; Dialog.info('Žádná plocha není otevřená – skořepina je teď uzavřená dutina. Celou ji zruší „Zrušit vše“ nebo Odebrat úpravu v inspektoru.'); }
      kresli();
      aplikuj(() => { if (bylo) mnozina.add(i); else mnozina.delete(i); if (naDutinu) ed.uzavrena = false; });
    }
    M.occtPrepniHranu = i => { if (ed && ed.hrany) prepni(ed.vybraneH, i); };
    M.occtPrepniPlochu = i => { if (ed && ed.plochy) prepni(ed.vybraneP, i); };

    /** Klik na plochu v režimu hran: přidá všechny hrany, které leží v její rovině (obrys plochy);
        když už jsou vybrané všechny, odebere je. Jen rovné plochy. */
    M.klikObrysPlochy = async function (zasah) {
      if (!ed || !ed.hrany || ed.pocita || !zasah || zasah.id !== ed.id || ed.op === 'skorepina') return;
      const sit = S.telesa.svetovaSit(ed.id);
      if (!sit || zasah.trojuhelnik == null) return;
      // rovná plocha? sousední trojúhelníky ve stejné rovině kolem bodu kliknutí
      const n = zasah.normala.clone().normalize(), b = zasah.bod;
      const oblast = M.oblastPlochy ? M.oblastPlochy(sit, zasah.trojuhelnik) : null;
      if (!oblast || !oblast.oblast.length) { info.textContent = '⚠ Obrys jde vybrat jen u rovné plochy – na zakřivené klikej na jednotlivé hrany.'; return; }
      const A = matice(), v = new THREE.Vector3();
      const ob = M.obalkaUzlu(M.najdiUzel(M.app.dok, ed.id) || ed.puvodni);
      const tol = Math.max(0.01, 1e-4 * Math.hypot(ob.max[0] - ob.min[0], ob.max[1] - ob.min[1], ob.max[2] - ob.min[2]));
      const vRovine = [];
      ed.hrany.forEach((h, i) => {
        for (let j = 0; j < h.body.length; j += 3) {
          v.set(h.body[j], h.body[j + 1], h.body[j + 2]).applyMatrix4(A);
          if (Math.abs(v.clone().sub(b).dot(n)) > tol) return;
        }
        vRovine.push(i);
      });
      if (!vRovine.length) { info.textContent = '⚠ Na téhle ploše nejsou hrany původního tělesa – klikni přímo na hranu.'; return; }
      const pred = new Set(ed.vybraneH);
      if (vRovine.every(i => ed.vybraneH.has(i))) vRovine.forEach(i => ed.vybraneH.delete(i));
      else {
        const n = new Set([...ed.vybraneH, ...vRovine]).size;
        if (n > 60 && !await mnohoHran(n)) return;
        vRovine.forEach(i => ed.vybraneH.add(i));
      }
      kresli(); aplikuj(() => { ed.vybraneH = pred; });
    };
    /** Hodně hran (plošky skici, oblouk): přesný výpočet může trvat minuty – zeptat se dopředu. */
    async function mnohoHran(n) {
      const e0 = ed;
      const ano = await Dialog.potvrd(`Vybráno ${n} hran – přesný výpočet může trvat i několik minut (plošky zakřivené plochy). Pokračovat?`);
      return ano && ed === e0 && !!ed;
    }

    /** Klik na stěnu tělesa v režimu 'plochy' (z vyber.js). */
    M.klikOcct = function (zasah) {
      if (!ed || !zasah || zasah.id !== ed.id || !ed.plochy) return;
      const A = matice(), inv = A.clone().invert();
      const p = zasah.bod.clone().applyMatrix4(inv);
      const n = zasah.normala.clone().applyMatrix3(new THREE.Matrix3().setFromMatrix4(A).transpose()).normalize();
      let nej = -1, d0 = Infinity;
      ed.plochy.forEach((f, i) => {
        if (f.normala[0] * n.x + f.normala[1] * n.y + f.normala[2] * n.z < 0.99) return;
        const vRovine = Math.abs((p.x - f.stred[0]) * f.normala[0] + (p.y - f.stred[1]) * f.normala[1] + (p.z - f.stred[2]) * f.normala[2]);
        const d = vRovine * 100 + Math.hypot(p.x - f.stred[0], p.y - f.stred[1], p.z - f.stred[2]);
        if (vRovine < 0.05 + 0.01 * Math.hypot(...ed.ram.zaklad) && d < d0) { d0 = d; nej = i; }
      });
      if (nej < 0) {
        // klik na vnitřek už vyhloubeného tělesa nebo na zakřivenou plochu
        info.textContent = '⚠ Tady není rovná plocha původního tělesa – klikni na barevnou značku plochy.';
        return;
      }
      prepni(ed.vybraneP, nej);
    };

    function obnovInfo() {
      if (!ed) return;
      const op = ed.op;
      $('occtHodnotaPopis').textContent = HODNOTA[op];
      $('occtNadpis').textContent = { zaobleni: '◠ ', srazeni: '◿ ', skorepina: '▢ ' }[op] + POPIS[op];
      $('occtNavod').dataset.navod = op === 'skorepina' ? 'skorepina' : 'hrany';
      $('occtVyberHran').hidden = op === 'skorepina';
      $('occtVyberPloch').hidden = op !== 'skorepina';
      $('occtUzavrena').setAttribute('aria-pressed', ed.uzavrena ? 'true' : 'false');
      // dokud jádro nenačte hrany/plochy, tlačítka nic neumějí – vypnout (klik by se ztratil)
      $('occtUzavrena').disabled = !ed.plochy; $('occtVse').disabled = $('occtNic').disabled = !ed.hrany;
      document.querySelectorAll('[data-hrany]').forEach(b => { b.disabled = !ed.hrany; });
      if (ed.pocita) {
        if (!ed.pocitaOd) ed.pocitaOd = Date.now();
        const sek = Math.round((Date.now() - ed.pocitaOd) / 1000);
        info.textContent = '⏳ počítám přesně…' + (sek >= 2 ? ` ${sek} s` : '');
        // u dlouhého výpočtu běží čas, ať je vidět, že se něco děje
        clearTimeout(ed.casovacInfo); ed.casovacInfo = setTimeout(() => { if (ed && ed.pocita) obnovInfo(); }, 1000);
        return;
      }
      if (ed.pocitaOd) { ed.pocitaOd = 0; clearTimeout(ed.casovacInfo); }
      if (ed.chyba) { info.textContent = '⚠ ' + ed.chyba; return; }
      if (op === 'skorepina') {
        if (!ed.plochy) { info.textContent = '⏳ hledám rovné plochy…'; return; }
        const n = ed.vybraneP.size;
        info.textContent = !ed.plochy.length ? 'Těleso nemá rovné plochy – jde jen uzavřená dutina (tlačítko níž).'
          : n ? `Otevřeno ploch: ${n}. Další klik na značku plochu přidá, klik na plnou značku ji zavře.`
          : ed.uzavrena ? 'Uzavřená dutina (těleso je uvnitř duté).'
          : 'Klikni na značku rovné plochy (nebo na stěnu tělesa), která má zůstat otevřená – skořepina se hned vyhloubí.';
      } else {
        if (!ed.hrany) { info.textContent = '⏳ hledám hrany…'; return; }
        const n = ed.vybraneH.size;
        info.textContent = n ? `Upraveno hran: ${n} z ${ed.hrany.length}. Klik na další hranu ji přidá, na upravenou ji vrátí.`
          : 'Nastav velikost a klikni na hranu ve scéně – úprava se hned provede. Klik na rovnou plochu vybere celý její obrys.';
      }
    }

    /** Index nejbližšího prvku podle uloženého popisu (pro úpravu existující úpravy). */
    function najdi(seznam, popis, shoda) {
      let nej = -1, d0 = Infinity;
      seznam.forEach((x, i) => {
        if (!shoda(x)) return;
        const d = Math.hypot(x.stred[0] - popis.stred[0], x.stred[1] - popis.stred[1], x.stred[2] - popis.stred[2]);
        if (d < d0) { d0 = d; nej = i; }
      });
      return d0 < 0.05 + 0.02 * (popis.delka || 1) ? nej : -1;
    }
    /** Výběr hran/ploch podle úpravy uložené v uzlu (otevření, Zpět, Znovu). */
    function vyberZUzlu(u) {
      ed.vybraneH = new Set(); ed.vybraneP = new Set(); ed.uzavrena = false;
      const o = maVrstvu(u, ed.op) ? u.occt : null;
      if (!o) return;
      if (ed.op === 'skorepina') {
        if (ed.plochy) for (const f of o.plochy) {
          const i = najdi(ed.plochy, f, x => x.normala[0] * f.normala[0] + x.normala[1] * f.normala[1] + x.normala[2] * f.normala[2] > 0.999);
          if (i >= 0) ed.vybraneP.add(i);
        }
        ed.uzavrena = !o.plochy.length;
      } else if (ed.hrany) for (const h of o.hrany) {
        const i = najdi(ed.hrany, h, x => Math.abs(x.delka - h.delka) <= 0.05 * h.delka + 0.01);
        if (i >= 0) ed.vybraneH.add(i);
      }
      if (document.activeElement !== $('occtHodnota')) $('occtHodnota').value = M.mm(o.hodnota, 3);
    }

    async function nactiData() {
      // každé načtení má své číslo: dvě rychle po sobě (dvě změny velikosti) nesmí doběhnout obráceně
      const t = token, op = ed.op, n = ed.nacteni = (ed.nacteni || 0) + 1, ram = ed.ram;
      try {
        const data = op === 'skorepina' ? await M.occtPlochy(ram) : await M.occtHrany(ram);
        if (t !== token || n !== ed.nacteni) return;
        if (op === 'skorepina') ed.plochy = data; else ed.hrany = data;
        vyberZUzlu(ed.puvodni);
      } catch (e) {
        if (t !== token) return;
        if (n !== ed.nacteni) return;
        ed.chyba = 'Přesné jádro těleso nepostavilo: ' + (e.message || e);
      }
      obnovInfo(); kresli();
    }

    /** Zapíše úpravu podle aktuálního výběru a velikosti (nebo vrstvu odebere, když není co upravit).
        vratit = co udělat s výběrem, když se úprava nepovede. */
    async function aplikuj(vratit) {
      if (!ed) return;
      const t = token, verze = ++ed.verze, op = ed.op, h = hodnota();
      // novější požadavek ruší rozpracovaný (jeho výsledek se zahodí) – „počítám“ musí zmizet i u okamžitých konců
      ed.chyba = null; ed.pocita = false;
      if (!(h > 0)) { if (vratit) vratit(); ed.chyba = 'Zadej kladnou velikost.'; obnovInfo(); kresli(); return; }
      const akt = M.najdiUzel(M.app.dok, ed.id);
      if (!akt) { zavri(); return; }
      const prazdne = op === 'skorepina' ? !ed.vybraneP.size && !ed.uzavrena : !ed.vybraneH.size;
      if (prazdne) {
        if (maVrstvu(akt, op)) odeberVrstvu(akt);
        obnovInfo();
        return;
      }
      const krokHistorie = M.historie.index;
      const occt = op === 'skorepina'
        ? { operace: op, hodnota: h, plochy: [...ed.vybraneP].map(i => ({ stred: ed.plochy[i].stred, normala: ed.plochy[i].normala })) }
        : { operace: op, hodnota: h, hrany: [...ed.vybraneH].map(i => { const h = ed.hrany[i]; return { stred: h.stred, delka: h.delka, ...(h.bod ? { bod: h.bod } : {}), ...(h.konce ? { konce: h.konce } : {}) }; }) };
      const upravit = x => maVrstvu(x, op) ? M.normalizujUzel(Object.assign({}, x, { occt })) : M.obalUpravou(x, occt);
      const novy = upravit(akt);
      ed.pocita = true; obnovInfo();
      const e = ed;            // panel se mohl během výpočtu zavřít („Hotovo“): rozpracovaná úprava se pak ještě zapíše
      const platny = () => t === token ? verze === e.verze : !!e.dokoncit && verze === e.verze;
      try { await M.occtOver(novy); }
      catch (err) {
        if (!platny()) return;
        e.pocita = false;
        if (t !== token) { Dialog.chyba(POPIS[op] + ': ' + String(err.message || err)); return; }
        if (vratit) vratit();
        e.chyba = String(err.message || err);
        const ted2 = M.najdiUzel(M.app.dok, e.id);
        if (ted2 && ted2 !== e.puvodni) { const ch = e.chyba; srovnejSUzlem(ted2); e.chyba = ch; }
        obnovInfo(); kresli();
        return;
      }
      if (!platny()) return;      // mezitím přišel další klik – platí ten
      e.pocita = false;
      const otevreny = t === token;
      // těleso se během výpočtu mohlo posunout nebo přebarvit (tvar stejný): úprava na jeho aktuální stav
      const ted = M.najdiUzel(M.app.dok, e.id);
      if (!ted) { if (otevreny) zavri(); return; }
      // mezitím Zpět/Znovu nebo jiný tvar: výsledek nepatří k aktuálnímu stavu – zahodit (nepřepsat Zpět)
      if (M.historie.index < krokHistorie || M.klicGeometrie(ramPro(ted, op)) !== M.klicGeometrie(ramPro(akt, op))) {
        if (otevreny) { if (vratit) vratit(); srovnejSUzlem(ted); }
        return;
      }
      const vysledek = ted === akt ? novy : upravit(ted);
      e.puvodni = vysledek;
      zapamatuj(op, h);
      const dok = M.app.dok;
      M.zmenDokument(Object.assign({}, dok, { uzly: dok.uzly.map(x => x.id === vysledek.id ? vysledek : x) }), POPIS[op]);
      if (otevreny) M.nastavVyber([vysledek.id]);          // po zavřeném panelu výběr nechat, jak ho uživatel mezitím nastavil
      if (otevreny) { obnovInfo(); kresli(); }
    }
    M.occtPouzij = () => aplikuj();

    /** Editor podle uzlu v dokumentu (po Zpět, posunu, změně velikosti): jiný tvar = hrany načíst znovu. */
    function srovnejSUzlem(u) {
      ed.puvodni = u;
      const ram = ramPro(u, ed.op);
      if (M.klicGeometrie(ram) !== M.klicGeometrie(ed.ram)) {
        ed.ram = ram; ed.hrany = null; ed.plochy = null; ed.chyba = null;
        obnovInfo(); kresli(); nactiData();
        return;
      }
      ed.ram = ram;
      vyberZUzlu(u); obnovInfo(); kresli();
    }

    /** Odebere vrstvu úpravy (všechny hrany vrácené); obal s jedním dítětem se rozpustí. */
    function odeberVrstvu(u) {
      let dok = M.upravUzly(M.app.dok, [u.id], { occt: null });
      let novy = M.najdiUzel(dok, u.id);
      if (u.deti.length === 1) {
        // obal rozpustit; těleso si nechá původní id (Zpět i další kliky pak míří na totéž těleso)
        const r = M.rozdelSkupiny(dok, [u.id]);
        dok = Object.assign({}, r.dok, { uzly: r.dok.uzly.map(x => x.id === r.ids[0] ? Object.assign({}, x, { id: u.id }) : x) });
        novy = M.najdiUzel(dok, u.id);
      }
      ed.puvodni = novy;
      M.zmenDokument(dok, { zaobleni: 'Odebrat zaoblení hran', srazeni: 'Odebrat sražení hran', skorepina: 'Odebrat skořepinu' }[ed.op]);
      if (novy) M.nastavVyber([novy.id]);
      kresli();
    }

    /** Otevře panel pro vybrané těleso (operace: zaobleni / srazeni / skorepina). */
    M.otevriUpravuHran = function (op = 'zaobleni') {
      const v = M.vybraneVolne();
      if (v.length !== 1) { Dialog.chyba('Vyber jedno (nezamčené) těleso.'); return; }
      const u = v[0];
      if (u.role === 'dira') { Dialog.chyba('Díra se zaoblit nedá – uprav těleso, ze kterého se odečítá.'); return; }
      if (op === 'skorepina' && !M.lzeSkorepinu(u)) {
        Dialog.info(`Skořepina jde jen u plných těles – „${u.nazev}“ je už duté nebo tenké (trubka, torus, rámeček, profil, tvar se stěnou…), nebo má plochy složené z trojúhelníků (srdce, vlnovka, přechod) – tam skořepina v přesném jádru nejde. Těleso vyhloubíš i tak: zkopíruj ho, zmenši a nastav jako Díru.`);
        return;
      }
      zavri();
      // ostatní boční panely zavřít dřív, než vznikne rozpracovaná úprava (jejich zavření mění režim a to by ji zrušilo)
      M.otevriPanel(okno);
      // panel by těleso zakryl (úzké okno, těleso vpravo): pohled na něj do volné části plátna
      setTimeout(() => { if (ed && ed.id === u.id && S.vyberZakryty && S.vyberZakryty([u.id])) S.zamerit([u.id]); }, 0);
      ed = { id: u.id, op, puvodni: u, zacatek: u, ram: ramPro(u, op), hrany: null, plochy: null, vybraneH: new Set(), vybraneP: new Set(),
        uzavrena: false, chyba: null, pocita: false, verze: 0 };
      okno.querySelector(`input[name="occtOperace"][value="${op}"]`).checked = true;
      okno.querySelector('input[name="occtOperace"][value="skorepina"]').disabled = !M.lzeSkorepinu(u);
      $('occtHodnota').value = M.mm(maVrstvu(u, op) ? u.occt.hodnota : posledni(op), 3);   // 0,25 se nesmí zaokrouhlit na 0,3
      svg.hidden = false;
      ed.rezim = op === 'skorepina' ? 'plochy' : 'hrany';
      M.nastavRezim(ed.rezim);
      obnovInfo(); kresli();
      if (M.occtStav() !== 'pripraveno') info.textContent = '⏳ načítám přesné jádro (OpenCascade, 22 MB)…';
      nactiData();
    };

    // jiná úprava v panelu = začít ji na tělese (dosavadní kliky už jsou v dokumentu)
    okno.querySelectorAll('input[name="occtOperace"]').forEach(r => r.addEventListener('change', () => {
      if (ed && r.checked && r.value !== ed.op) M.otevriUpravuHran(r.value);
    }));
    // nová velikost: přepočítat vybrané hrany (po potvrzení – Enter nebo opuštění pole)
    const hodnotaZmenena = () => {
      if (!ed) return;
      const o = ed.puvodni && maVrstvu(ed.puvodni, ed.op) ? ed.puvodni.occt : null;
      if (o && Math.abs(o.hodnota - hodnota()) < 1e-9) return;
      if (ed.vybraneH.size || ed.vybraneP.size || ed.uzavrena) aplikuj(); else { ed.chyba = null; obnovInfo(); }
    };
    $('occtHodnota').addEventListener('change', hodnotaZmenena);
    $('occtHodnota').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); hodnotaZmenena(); } });
    $('occtVse').onclick = async () => {
      if (!ed || !ed.hrany) return;
      if (ed.hrany.length > 60 && !await mnohoHran(ed.hrany.length)) return;
      const pred = new Set(ed.vybraneH);
      ed.hrany.forEach((h, i) => ed.vybraneH.add(i));
      kresli(); aplikuj(() => { ed.vybraneH = pred; });
    };
    $('occtNic').onclick = () => { if (ed) { ed.vybraneH.clear(); kresli(); aplikuj(); } };
    /** Vnitřní (vyduté) hrany: kolem středu hrany je materiálu víc než polovina (body na malé kouli kolem
        středu leží většinou uvnitř tělesa). Typicky spoje sloučených těles – zaoblení je zpevní. */
    function vnitrniHrany(A) {
      const sit = S.telesa.svetovaSit(ed.id);
      if (!sit) return [];
      const uvnitrSite = M.indexBodVSiti(sit);
      const ob = M.obalkaSite(sit), diag = Math.hypot(ob.max[0] - ob.min[0], ob.max[1] - ob.min[1], ob.max[2] - ob.min[2]);
      // 26 směrů mírně pootočených (žádný neleží přesně v rovině stěny – bod na povrchu je nejistý)
      const eps = Math.min(0.3, diag * 0.008), smery = [];
      const qq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1731, 0.2417, 0.0893));
      for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if (x || y || z) {
        const d = new THREE.Vector3(x, y, z).normalize().applyQuaternion(qq); smery.push([d.x, d.y, d.z]);
      }
      const v = new THREE.Vector3();
      return ed.hrany.map((h, i) => {
        // střed hrany: prostřední vzorek (u rovné hrany se dvěma body jejich průměr)
        const n = h.body.length / 3, a = Math.floor((n - 1) / 2) * 3, b = Math.ceil((n - 1) / 2) * 3;
        v.set((h.body[a] + h.body[b]) / 2, (h.body[a + 1] + h.body[b + 1]) / 2, (h.body[a + 2] + h.body[b + 2]) / 2).applyMatrix4(A);
        let uvnitr = 0;
        for (const d of smery) if (uvnitrSite([v.x + d[0] * eps, v.y + d[1] * eps, v.z + d[2] * eps])) uvnitr++;
        return uvnitr / smery.length > 0.58 ? i : -1;
      }).filter(i => i >= 0);
    }
    M.occtVnitrniHrany = () => ed && ed.hrany ? vnitrniHrany(matice()) : [];

    /** Indexy hran skupiny ve světě: svislé (rovné ve směru Z), horní / dolní (celé ve výšce vršku / spodku tělesa). */
    function skupinaHran(druh) {
      const A = matice(), v = new THREE.Vector3();
      if (druh === 'vnitrni') return vnitrniHrany(A);
      const zz = ed.hrany.map(h => {
        const z = [];
        for (let j = 0; j < h.body.length; j += 3) z.push(v.set(h.body[j], h.body[j + 1], h.body[j + 2]).applyMatrix4(A).z);
        return z;
      });
      const zMin = Math.min(...zz.flat()), zMax = Math.max(...zz.flat()), tol = Math.max(1e-3, (zMax - zMin) * 1e-4);
      return ed.hrany.map((h, i) => {
        const z = zz[i];
        if (druh === 'horni') return z.every(x => Math.abs(x - zMax) < tol);
        if (druh === 'dolni') return z.every(x => Math.abs(x - zMin) < tol);
        if (!h.konce) return false;
        const a = new THREE.Vector3(...h.konce[0]).applyMatrix4(A), b = new THREE.Vector3(...h.konce[1]).applyMatrix4(A);
        const d = b.sub(a);
        return d.length() > 1e-6 && Math.abs(d.z) / d.length() > 0.9999;
      }).map((ano, i) => ano ? i : -1).filter(i => i >= 0);
    }
    document.querySelectorAll('[data-hrany]').forEach(b => b.onclick = async () => {
      if (!ed || !ed.hrany) return;
      let vsechny;
      if (b.dataset.hrany === 'vnitrni') {
        M.cekej('spoje', 'Hledám vnitřní hrany…', null, 0);
        await M.dejVykreslit();
        try { vsechny = skupinaHran('vnitrni'); } finally { M.hotovoCekani('spoje'); }
        if (!ed || !ed.hrany) return;
      } else vsechny = skupinaHran(b.dataset.hrany);
      const nove = vsechny.filter(i => !ed.vybraneH.has(i));
      if (!nove.length) {
        Dialog.info(b.dataset.hrany === 'vnitrni' && !vsechny.length
          ? 'Těleso nemá žádné vnitřní (vyduté) hrany – vznikají tam, kde se sloučená tělesa potkají.'
          : 'Žádné další takové hrany – všechny už jsou vybrané, nebo je těleso nemá.');
        return;
      }
      if (ed.vybraneH.size + nove.length > 60 && !await mnohoHran(ed.vybraneH.size + nove.length)) return;
      const pred = new Set(ed.vybraneH);
      nove.forEach(i => ed.vybraneH.add(i));
      kresli(); aplikuj(() => { ed.vybraneH = pred; });
    });
    $('occtUzavrena').onclick = () => {
      if (!ed || !ed.plochy) return;
      const pred = { p: new Set(ed.vybraneP), u: ed.uzavrena };
      ed.uzavrena = !ed.uzavrena;
      if (ed.uzavrena) ed.vybraneP.clear();
      kresli(); aplikuj(() => { ed.vybraneP = pred.p; ed.uzavrena = pred.u; });
    };
    // Hotovo: kliky jsou už zapsané; Zrušit vrátí těleso do stavu před otevřením panelu
    $('occtOk').onclick = () => zavri(true);
    $('occtZrusit').onclick = () => {
      if (!ed) return;
      const u = M.najdiUzel(M.app.dok, ed.id) || M.najdiUzel(M.app.dok, ed.zacatek.id);
      const z = ed.zacatek;
      zavri();
      if (u && u !== z) {
        const dok = M.app.dok;
        // poloha a barva mohly mezitím změnit (posun tělesa s otevřeným panelem) – vrací se jen tvar úpravy:
        // zaoblení, sražení ani skořepina obálku nemění, posun = rozdíl středů obálek
        const a = M.obalkaUzlu(u), b = M.obalkaUzlu(z);
        const d = [0, 1, 2].map(i => (a.min[i] + a.max[i] - b.min[i] - b.max[i]) / 2);
        const zpet = M.normalizujUzel(Object.assign({}, z, { barva: u.barva,
          poloha: Math.hypot(...d) > 0.01 ? z.poloha.map((x, i) => Math.round((x + d[i]) * 1e6) / 1e6) : z.poloha }));
        M.zmenDokument(Object.assign({}, dok, { uzly: dok.uzly.map(x => x.id === u.id ? zpet : x) }), 'Zrušit úpravu hran');
        M.nastavVyber([z.id]);
      }
    };
    okno.addEventListener('cancel', e => { e.preventDefault(); zavri(true); });      // Esc = hotovo (rozpracovaná úprava se dopočítá)
    // Esc nebo jiný režim ukončí i panel
    M.na('rezim', r => { if (ed && r !== ed.rezim) zavri(true); });
    // dokument se změnil (Zpět, Znovu, posun, změna velikosti…):
    // výběr hran podle uzlu, jiný tvar = hrany načíst znovu, smazané těleso = konec
    M.na('dokument', () => {
      if (!ed) return;
      const u = M.najdiUzel(M.app.dok, ed.id);
      if (u === ed.puvodni) return;
      if (!u) { zavri(); return; }
      if (ed.pocita) return;                    // srovná se po dopočítání (puvodni zatím nepřepisovat)
      ed.puvodni = u;
      const ram = ramPro(u, ed.op);
      if (M.klicGeometrie(ram) !== M.klicGeometrie(ed.ram)) {
        ed.ram = ram; ed.hrany = null; ed.plochy = null; ed.chyba = null;
        obnovInfo(); kresli();
        nactiData();
        return;
      }
      ed.ram = ram;
      vyberZUzlu(u);
      obnovInfo(); kresli();
    });

    // jiný výběr (dlaždice knihovny, Ctrl+A, seznam): úprava patřila k jinému tělesu – panel zavřít
    M.na('vyber', () => { if (ed && !(M.app.vyber.length === 1 && M.app.vyber[0] === ed.id)) zavri(); });

    /** Pro testy: rozpracovaná úprava (hrany, plochy, výběr). */
    M.occtEditor = () => ed;

    // ------------------------------------------------------------ odsazení stěn (offset) s živým náhledem
    /** Panel Odsadit stěny: hodnota, náhled výsledku ve scéně (duch – průhledně, čárkované hrany),
        Použít = jeden krok historie. Výpočet přesným jádrem běží na pozadí, starší výsledky se zahodí. */
    const oknoO = $('oknoOdsazeni'), poleO = $('odsHodnota'), infoO = $('odsInfo'), okO = $('odsOk');
    let ods = null;                 // {id, verze, vysledek: {h, zaklad, novy}}
    let odkladO = 0;
    /** Těleso po odsazení: spodek zůstane, kde byl (zvětšené by lezlo pod desku), díra zůstane soustředná. */
    function poOdsazeni(u, h) {
      let novy = M.odsadUzel(u, h);
      if (novy !== u && u.role !== 'dira') novy = M.normalizujUzel(Object.assign({}, novy, { poloha: M.polohaSeSpodkem(novy, M.spodekUzlu(u)) }));
      return novy;
    }
    const ukazDucha = novy => S.telesa.ukazDuchy('odsazeni', novy && $('odsNahled').checked ? [novy] : [], 'nahled');
    function nastavInfo(text, lzePouzit) { infoO.textContent = text; okO.disabled = !lzePouzit; }
    async function prepocitejOdsazeni() {
      clearTimeout(odkladO);
      if (!ods) return;
      const verze = ++ods.verze;
      ods.vysledek = null;
      const v = M.vybraneVolne();
      if (v.length !== 1) { ukazDucha(null); nastavInfo('Vyber jedno (nezamčené) těleso, jehož stěny chceš odsadit.', false); return; }
      const u = v[0];
      ods.id = u.id; ods.uzel = u;
      const h = M.prectiCislo(poleO.value);
      if (!isFinite(h)) { ukazDucha(null); nastavInfo(`⚠ „${poleO.value}“ není číslo.`, false); return; }
      if (Math.abs(h) > 100) { ukazDucha(null); nastavInfo('⚠ Odsazení může být nejvýš ±100 mm.', false); return; }
      const novy = poOdsazeni(u, h);
      if (novy === u) { ukazDucha(null); nastavInfo('0 mm – těleso zůstane beze změny.', false); return; }
      const rozmer = novy.rozmer.map(x => M.mm(x, 2)).join(' × ') + ' mm';
      if (novy.occt) {
        nastavInfo('⏳ Počítám náhled přesně…', false);
        try { await M.occtOver(novy); }
        catch (e) { if (ods && verze === ods.verze) { ukazDucha(null); nastavInfo('⚠ ' + String(e.message || e), false); } return; }
        if (!ods || verze !== ods.verze) return;          // mezitím jiná hodnota nebo zavřený panel
      }
      ods.vysledek = { h, zaklad: u, novy };
      ukazDucha(novy);
      nastavInfo(novy.occt ? `Náhled: ${h > 0 ? '+' : ''}${M.mm(h, 3)} mm na každou stranu → ${rozmer}. Použít ho zapíše.` : `Odsazení se odebere → ${rozmer}.`, true);
    }
    const odlozPrepocet = () => { clearTimeout(odkladO); odkladO = setTimeout(prepocitejOdsazeni, 350); };
    function zavriOdsazeni() {
      clearTimeout(odkladO);
      ods = null;
      S.telesa.ukazDuchy('odsazeni', []);
      if (oknoO.open) oknoO.close();
    }
    async function pouzijOdsazeni() {
      if (!ods) return;
      const h = M.prectiCislo(poleO.value);
      if (!ods.vysledek || ods.vysledek.h !== h) await prepocitejOdsazeni();
      const r = ods && ods.vysledek;
      if (!r || r.h !== h) return;
      // mezitím se dokument mohl změnit: jen když těleso pořád stejné
      if (M.najdiUzel(M.app.dok, r.zaklad.id) !== r.zaklad) { prepocitejOdsazeni(); return; }
      zavriOdsazeni();
      M.zmenDokument(Object.assign({}, M.app.dok, { uzly: M.app.dok.uzly.map(x => x.id === r.zaklad.id ? r.novy : x) }),
        r.novy.occt ? `Odsadit stěny ${h > 0 ? '+' : ''}${M.mm(h, 2)} mm` : 'Odebrat odsazení');
      M.nastavVyber([r.zaklad.id]);
    }
    M.otevriOdsazeni = function () {
      const v = M.vybraneVolne();
      if (v.length !== 1) { Dialog.chyba('Vyber jedno těleso, jehož stěny chceš odsadit.'); return; }
      const u = v[0];
      M.otevriPanel(oknoO);
      ods = { id: u.id, verze: 0, vysledek: null };
      poleO.value = M.mm(u.occt && u.occt.operace === 'odsazeni' ? u.occt.hodnota : 0.2, 3);
      poleO.focus(); poleO.select();
      prepocitejOdsazeni();
    };
    M.odsazeniStav = () => ods && { id: ods.id, hotovo: !!ods.vysledek, h: ods.vysledek && ods.vysledek.h };
    poleO.addEventListener('input', odlozPrepocet);
    poleO.addEventListener('change', prepocitejOdsazeni);
    poleO.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); pouzijOdsazeni(); } });
    oknoO.querySelectorAll('[data-ods]').forEach(b => b.addEventListener('click', () => { poleO.value = M.mm(+b.dataset.ods, 3); prepocitejOdsazeni(); }));
    $('odsNahled').addEventListener('change', () => ukazDucha(ods && ods.vysledek ? ods.vysledek.novy : null));
    okO.onclick = pouzijOdsazeni;
    $('odsZrusit').onclick = zavriOdsazeni;
    oknoO.addEventListener('cancel', e => { e.preventDefault(); zavriOdsazeni(); });
    oknoO.addEventListener('close', () => { if (ods) zavriOdsazeni(); });
    // jiný výběr nebo změna tělesa (posun, Zpět): náhled přepočítat pro aktuální stav
    M.na('vyber', () => { if (ods) odlozPrepocet(); });
    M.na('dokument', e => {
      if (!ods || M.najdiUzel(M.app.dok, ods.id) === ods.uzel) return;
      ukazDucha(null); odlozPrepocet();
    });

    /** Odebere přesnou úpravu; obal s jedním dítětem se rozpustí. */
    M.odeberUpravu = function (id) {
      const u = M.najdiUzel(M.app.dok, id);
      if (!u || !u.occt) return;
      if (u.occt.operace === 'odsazeni') {
        M.zmenDokument(Object.assign({}, M.app.dok, { uzly: M.app.dok.uzly.map(x => x.id === id ? M.odsadUzel(u, 0) : x) }), 'Odebrat odsazení');
        M.nastavVyber([id]);
        return;
      }
      const dok = M.upravUzly(M.app.dok, [id], { occt: null });
      if (u.deti.length === 1) {
        const r = M.rozdelSkupiny(dok, [id]);
        M.zmenDokument(r.dok, 'Odebrat úpravu');
        M.nastavVyber(r.ids);
      } else M.zmenDokument(dok, 'Odebrat úpravu');
    };
  };
})(MDL);
