/* Modelář 3D – dílna v uživatelském rozhraní (nabídka 📐 Dílna):
   měření (vzdálenost, úhel, kružnice třemi body; přichycení k vrcholům,
   středům hran a referenčním bodům), řez pohledem (ořezová rovina na
   materiálech těles, vnitřek oranžově), posuvník historie, poznámky a
   referenční body (SVG vrstva nad plátnem, v dokumentu → Zpět funguje),
   technický výkres do SVG a PDF (jsPDF, písmo Liberation Sans kvůli češtině),
   vlastní tvary do knihovny (IndexedDB) a paleta příkazů Ctrl+K. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const bezDiakritiky = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
  function el(nazev, atributy = {}, rodic) {
    const e = document.createElementNS(NS, nazev);
    for (const [k, v] of Object.entries(atributy)) e.setAttribute(k, v);
    if (rodic) rodic.appendChild(e);
    return e;
  }
  const fmt = (x, d = 2) => x.toLocaleString('cs', { minimumFractionDigits: d, maximumFractionDigits: d });

  M.vytvorDilnu = function (S, T, U) {
    const vrstva = el('svg', { class: 'dilna-vrstva', 'aria-hidden': 'true' });
    $('plocha').appendChild(vrstva);
    const gPoznamky = el('g', { class: 'poznamky' }, vrstva);
    const gMereni = el('g', { class: 'mereni' }, vrstva);
    const V = THREE.Vector3;
    const naObr = b => S.naObrazovku(new V(b[0], b[1], b[2]));

    // ================================================================ měření
    const oknoMer = $('oknoMereni');
    const POTREBA = { vzdalenost: 2, uhel: 3, kruznice: 3 };
    let mer = { body: [], vysledky: [] };
    const typMereni = () => oknoMer.querySelector('input[name="merTyp"]:checked').value;

    M.otevriMereni = function () {
      M.otevriPanel(oknoMer);
      M.nastavRezim('mereni');
      obnovMereni();
    };
    function zavriMereni() {
      if (oknoMer.open) oknoMer.close();
      mer.body = [];
      if (M.app.rezim === 'mereni') M.nastavRezim(null);
      kresli();
    }
    $('merZavrit').onclick = zavriMereni;
    $('merVymazat').onclick = () => { mer = { body: [], vysledky: [] }; obnovMereni(); };
    oknoMer.addEventListener('cancel', e => { e.preventDefault(); zavriMereni(); });
    oknoMer.querySelectorAll('input[name="merTyp"]').forEach(r => r.addEventListener('change', () => { mer.body = []; M.nastavRezim('mereni'); obnovMereni(); }));

    /** Bod pod kurzorem: na tělese nebo na desce, přichycený k nejbližšímu vrcholu, středu
        hrany nebo referenčnímu bodu do 12 px na obrazovce. Trojúhelníky se berou i z okolí
        kurzoru – klik přesně na roh tělesa paprsek často těsně mine. */
    const PRICHYT_PX = 12;
    function bodKliku(zasah, px, py) {
      const troj = [];
      const pridejTroj = z => {
        const sit = z && T.svetovaSit(z.id);
        if (sit && z.trojuhelnik != null) troj.push([0, 1, 2].map(k => { const i = sit.idx[z.trojuhelnik * 3 + k] * 3; return [sit.poz[i], sit.poz[i + 1], sit.poz[i + 2]]; }));
      };
      pridejTroj(zasah);
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4;
        pridejTroj(T.zasah(px + Math.cos(a) * PRICHYT_PX * 0.7, py + Math.sin(a) * PRICHYT_PX * 0.7));
      }
      const kand = [];
      for (const t of troj) for (let i = 0; i < 3; i++) {
        kand.push([t[i], 'vrchol']);
        const q = t[(i + 1) % 3];
        kand.push([[(t[i][0] + q[0]) / 2, (t[i][1] + q[1]) / 2, (t[i][2] + q[2]) / 2], 'stred']);
      }
      for (const p of M.poznamky(M.app.dok)) kand.push([M.bodPoznamky(M.app.dok, p), 'znacka']);
      // kandidáti blízko kurzoru, nejbližší první; bod zakrytý jiným povrchem (třeba vnitřní stěna díry
      // za okrajem) se přeskočí – jinak by se poloměr měřil přes tři různé výšky
      const blizko = [];
      for (const [b, druh] of kand) {
        const q = naObr(b);
        if (!q) continue;
        const d = Math.hypot(q[0] - px, q[1] - py) * (druh === 'stred' ? 1.5 : 1);   // vrchol má přednost před středem hrany
        if (d <= PRICHYT_PX) blizko.push({ b, druh, d, q });
      }
      const kam = S.kamera.aktivni().position;
      // pořadí: vzdálenost na obrazovce + přirážka za hloubku – bližší okraj díry vyhraje nad hranou vzdálené
      // stěny, která se může promítnout pár pixelů od kliknutí (i když paprsek trefil právě tu stěnu)
      for (const c of blizko) c.hloubka = new V(...c.b).distanceTo(kam);
      const nejbliz = Math.min(...blizko.map(c => c.hloubka));
      const mmNaPx = blizko.length ? S.mmNaPixel(new V(...blizko[0].b)) : 1;
      for (const c of blizko) c.skore = c.d + (c.hloubka - nejbliz) / Math.max(mmNaPx, 1e-6) * 0.5;
      blizko.sort((x, y) => x.skore - y.skore);
      for (const c of blizko.slice(0, 12)) {
        if (c.druh !== 'znacka') {
          const z = T.zasah(c.q[0], c.q[1]);
          const vzd = new V(...c.b).distanceTo(kam);
          if (z && z.bod.distanceTo(kam) < vzd - Math.max(0.05, vzd * 1e-3)) continue;
        }
        return { bod: c.b.slice(), druh: c.druh };
      }
      if (zasah) return { bod: zasah.bod.toArray(), druh: 'plocha' };
      const b = S.kamera.bodNaRovine(px, py, 0);
      return b ? { bod: [b.x, b.y, 0], druh: 'deska' } : null;
    }

    /** Vůle (nejmenší vzdálenost) mezi dvěma vybranými tělesy – výsledek jako měření v panelu Měření. */
    M.zmerVuli = function () {
      const v = M.vybraneUzly().filter(u => !u.skryto);
      if (v.length !== 2) { Dialog.chyba('Vyber právě dvě tělesa (Shift + klik), mezi kterými chceš změřit vůli.'); return; }
      const sa = T.svetovaSit(v[0].id), sb = T.svetovaSit(v[1].id);
      if (!sa || !sb) { Dialog.info('Tělesa se ještě počítají – zkus to za chvíli.'); return; }
      const oa = M.obalkaUzlu(v[0]), ob = M.obalkaUzlu(v[1]);
      if (M.sitePrekryvaji(sa, sb, oa, ob)) { Dialog.info(`„${v[0].nazev}“ a „${v[1].nazev}“ se překrývají – vůle je záporná (při tisku splynou).`); return; }
      const r = M.vuleSiti(sa, sb);
      if (!isFinite(r.d)) return;
      if (!oknoMer.open) M.otevriMereni();
      mer.vysledky.push({ typ: 'vzdalenost', body: [r.a, r.b], text: `vůle ${fmt(r.d)} mm`, detail: `„${v[0].nazev}“ ↔ „${v[1].nazev}“ (nejmenší vzdálenost)` });
      obnovMereni(); kresli(); M.prekresli();
      Dialog.info(`Vůle mezi „${v[0].nazev}“ a „${v[1].nazev}“: ${fmt(r.d)} mm`);
    };

    function vyhodnot(typ, body) {
      const b = body.map(x => x.bod);
      if (typ === 'vzdalenost') {
        const v = M.mereniVzdalenost(b[0], b[1]);
        return { typ, body: b, text: `${fmt(v.d)} mm`, detail: `ΔX ${fmt(v.dx)} · ΔY ${fmt(v.dy)} · ΔZ ${fmt(v.dz)}` };
      }
      if (typ === 'uhel') {
        const u = M.mereniUhel(b[0], b[1], b[2]);
        return u === null ? null : { typ, body: b, text: `${fmt(u, 1)}°`, detail: 'vrchol je prostřední bod' };
      }
      const k = M.kruznice3(b[0], b[1], b[2]);
      return k ? { typ, body: b, kruznice: k, text: `r ${fmt(k.r)} mm`, detail: `⌀ ${fmt(2 * k.r)} mm · střed ${k.stred.map(x => fmt(x, 1)).join('; ')}` } : null;
    }

    M.klikDilna = function (zasah, px, py) {
      if (M.app.rezim === 'poznamka') { pridejPoznamku(zasah, px, py); return; }
      const p = bodKliku(zasah, px, py);
      if (!p) return;
      mer.body.push(p);
      const typ = typMereni();
      if (mer.body.length >= POTREBA[typ]) {
        const v = vyhodnot(typ, mer.body);
        mer.body = [];
        if (v) mer.vysledky.push(v); else Dialog.chyba(typ === 'kruznice' ? 'Body leží v přímce – kružnice jimi nejde proložit.' : 'Body splývají.');
      }
      obnovMereni();
    };
    M.mereniStav = () => mer;

    function obnovMereni() {
      const typ = typMereni(), n = POTREBA[typ];
      $('merInfo').textContent = `Klikni na bod ${mer.body.length + 1} z ${n}`
        + (typ === 'uhel' ? ' (druhý bod je vrchol úhlu)' : typ === 'kruznice' ? ' (tři body na oblouku nebo díře)' : '')
        + '. Bod se přichytí k vrcholu, středu hrany nebo referenčnímu bodu.';
      $('merVysledky').innerHTML = mer.vysledky.map((v, i) =>
        `<li><b>${{ vzdalenost: '↔', uhel: '∠', kruznice: '◯' }[v.typ]} ${esc(v.text)}</b><span class="pozn">${esc(v.detail)}</span><button type="button" class="tl ik" data-smaz="${i}" title="Smazat měření">✕</button></li>`).join('')
        || '<li class="pozn">Zatím nic změřeno.</li>';
      $('merVysledky').querySelectorAll('[data-smaz]').forEach(b => b.onclick = () => { mer.vysledky.splice(+b.dataset.smaz, 1); obnovMereni(); });
      kresli();
    }

    /** Šířka vykresleného textu SVG (bez rozložení stránky odhad podle počtu znaků). */
    const sirkaTextu = t => { let w = 0; try { w = t.getComputedTextLength(); } catch (e) { /* mimo dokument */ } return w > 0 ? w : 7 * t.textContent.length; };
    function kresliMereni() {
      gMereni.innerHTML = '';
      if (!oknoMer.open) return;                     // výsledky ve scéně jen s otevřeným panelem (v něm zůstávají do Vymazat)
      const cara = (a, b, trida) => { if (a && b) el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: trida }, gMereni); };
      const stitek = (p, text) => {
        if (!p) return;
        const g = el('g', { class: 'stitek', transform: `translate(${p[0].toFixed(1)},${p[1].toFixed(1)})` }, gMereni);
        const r = el('rect', { x: -4, y: -17, height: 18, rx: 4 }, g);
        const t = el('text', { x: 0, y: -4 }, g);
        t.textContent = text;
        r.setAttribute('width', 8 + sirkaTextu(t));
      };
      for (const v of mer.vysledky) {
        const p = v.body.map(naObr);
        if (v.typ === 'vzdalenost') { cara(p[0], p[1], 'mer-cara'); stitek(p[0] && p[1] && [(p[0][0] + p[1][0]) / 2 + 6, (p[0][1] + p[1][1]) / 2], v.text); }
        else if (v.typ === 'uhel') { cara(p[1], p[0], 'mer-cara'); cara(p[1], p[2], 'mer-cara'); stitek(p[1] && [p[1][0] + 8, p[1][1] - 6], v.text); }
        else {
          const k = v.kruznice, n = new V(...k.normala);
          const a = new V(...v.body[0]).sub(new V(...k.stred)).normalize(), b = new V().crossVectors(n, a);
          const body = [];
          for (let i = 0; i <= 64; i++) {
            const t = i / 64 * 2 * Math.PI;
            const q = naObr(new V(...k.stred).addScaledVector(a, Math.cos(t) * k.r).addScaledVector(b, Math.sin(t) * k.r).toArray());
            if (q) body.push(q.map(x => x.toFixed(1)).join(','));
          }
          el('polyline', { points: body.join(' '), class: 'mer-cara' }, gMereni);
          stitek(naObr(k.stred), v.text);
        }
        for (const q of p) if (q) el('circle', { cx: q[0], cy: q[1], r: 3.5, class: 'mer-bod' }, gMereni);
      }
      for (const b of mer.body) { const q = naObr(b.bod); if (q) el('circle', { cx: q[0], cy: q[1], r: 4.5, class: 'mer-bod rozpracovany' + (b.druh !== 'plocha' && b.druh !== 'deska' ? ' prichyceny' : '') }, gMereni); }
    }

    // ================================================================ poznámky a referenční body
    let ukazPoznamky = true;
    M.prepniPoznamky = function (stav = !ukazPoznamky) { ukazPoznamky = stav; kresli(); return ukazPoznamky; };
    async function pridejPoznamku(zasah, px, py) {
      const p = bodKliku(zasah, px, py);
      M.nastavRezim(null);
      if (!p) return;
      const text = await Dialog.zeptej('Text poznámky (nech prázdné pro referenční bod, ke kterému se přichytává měření):', '');
      if (text === null) return;
      // klik na těleso: poznámka se k němu přichytí (pojede s ním)
      M.zmenDokument(M.pridejPoznamku(M.app.dok, p.bod, text.trim(), zasah && zasah.id).dok, text.trim() ? 'Poznámka' : 'Referenční bod');
      ukazPoznamky = true;
    }
    function kresliPoznamky() {
      gPoznamky.innerHTML = '';
      // v režimu měření / poznámky nesmí značky chytat myš – klik patří plátnu pod nimi
      gPoznamky.style.pointerEvents = M.app.rezim ? 'none' : '';
      gPoznamky.classList.toggle('bez-mysi', !!M.app.rezim);
      if (!ukazPoznamky) return;
      for (const p of M.poznamky(M.app.dok)) {
        const q = naObr(M.bodPoznamky(M.app.dok, p));
        if (!q) continue;
        const g = el('g', { class: 'poznamka' + (p.text ? '' : ' ref'), transform: `translate(${q[0].toFixed(1)},${q[1].toFixed(1)})` }, gPoznamky);
        g.dataset.id = p.id;
        if (p.text) {
          el('line', { x1: 0, y1: 0, x2: 14, y2: -14 }, g);
          const r = el('rect', { x: 14, y: -26, height: 20, rx: 4 }, g);
          const t = el('text', { x: 20, y: -12 }, g);
          // dlouhý text zkrátit (celý je v bublině title); šířka podle skutečně vykresleného textu
          t.textContent = p.text.length > 40 ? p.text.slice(0, 39) + '…' : p.text;
          el('title', {}, g).textContent = p.text;
          const w = sirkaTextu(t);
          r.setAttribute('width', w + 30);
          const x = el('text', { x: 26 + w, y: -12, class: 'smaz' }, g);
          x.textContent = '✕';
        }
        el('circle', { r: p.text ? 3.5 : 5, cx: 0, cy: 0 }, g);
      }
    }
    // klik na poznámku = upravit text, na ✕ = smazat (referenční bod: klik = smazat s potvrzením)
    // v režimu měření nebo poznámky klik projde dál (měří se i k referenčnímu bodu)
    vrstva.addEventListener('pointerdown', e => { if (!M.app.rezim && e.target.closest('.poznamka')) { e.stopPropagation(); e.preventDefault(); } });
    vrstva.addEventListener('click', async e => {
      const g = e.target.closest('.poznamka');
      if (!g || M.app.rezim) return;
      const p = M.poznamky(M.app.dok).find(x => x.id === g.dataset.id);
      if (!p) return;
      if (e.target.classList.contains('smaz') || (!p.text && await Dialog.potvrd('Smazat referenční bod?'))) {
        M.zmenDokument(M.smazPoznamku(M.app.dok, p.id), 'Smazat poznámku');
        return;
      }
      if (!p.text) return;
      const t = await Dialog.zeptej('Text poznámky:', p.text);
      if (t === null) return;
      M.zmenDokument(M.upravPoznamku(M.app.dok, p.id, { text: t.trim() }), 'Upravit poznámku');
    });

    function kresli() { kresliPoznamky(); kresliMereni(); }
    const zmenaSnimku = M.hlidacSnimku(S);
    M.na('kamera', () => { if (zmenaSnimku([mer, mer.body.length, mer.vysledky.length, ukazPoznamky, M.poznamky(M.app.dok)])) kresli(); });
    // jiný projekt: měření z předchozího nepatří k ničemu
    M.na('dokument', e => { if (e && e.popis === 'Otevřít') { mer = { body: [], vysledky: [] }; if (oknoMer.open) obnovMereni(); } kresli(); });
    // Esc nebo jiný režim ukončí měření (výsledky zůstanou do příštího otevření)
    // výjimka: Poznámka (N) – tak se dělají referenční body pro měření; panel zůstane a po umístění bodu se měří dál
    let rezimPred = null;
    M.na('rezim', r => {
      const pred = rezimPred; rezimPred = r;
      if (oknoMer.open && r !== 'mereni' && r !== 'poznamka') {
        if (pred === 'poznamka' && r === null) { M.nastavRezim('mereni'); return; }
        zavriMereni();
      }
      kresli();
    });

    // ================================================================ řez pohledem
    const oknoRp = $('oknoRezPohledu');
    const rovina = new THREE.Plane(new V(0, 0, -1), 0);
    let rezAktivni = false;
    S.renderer.localClippingEnabled = true;
    const barvaRezu = 'vec3(0.94, 0.45, 0.2)';
    function nastavMaterial(m, aktivni) {
      if (!m || m.userData.rez === aktivni) return false;
      m.userData.rez = aktivni;
      m.clippingPlanes = aktivni ? [rovina] : null;
      if (m.isMeshStandardMaterial) {
        m.side = aktivni ? THREE.DoubleSide : THREE.FrontSide;
        m.onBeforeCompile = aktivni ? sh => {
          sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>',
            `#include <dithering_fragment>\n  if (!gl_FrontFacing) gl_FragColor = vec4(${barvaRezu}, 1.0);`);
        } : () => {};
        m.customProgramCacheKey = () => aktivni ? 'rez' : '';
      }
      m.needsUpdate = true;
      return true;
    }
    function aplikujRez() {
      let zmena = false;
      S.model.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (nastavMaterial(m, rezAktivni)) zmena = true; }); });
      return zmena;
    }
    // i nově vzniklá tělesa (snímek se kreslí před událostí kamera – nový materiál chce další snímek)
    M.na('kamera', () => { if (rezAktivni && aplikujRez()) M.prekresli(); });
    M.na('dokument', e => {
      // jiný projekt: řez pohledem i skryté poznámky patřily k tomu starému
      if (e && e.popis === 'Otevřít') { if (rezAktivni) zavriRez(); ukazPoznamky = true; $('rpPoloha').dataset.osa = ''; return; }
      if (rezAktivni) M.prekresli();
    });
    function obnovRez() {
      const osa = oknoRp.querySelector('input[name="rpOsa"]:checked').value, i = 'xyz'.indexOf(osa);
      const ob = M.app.dok.uzly.length ? M.obalkaVice(M.app.dok.uzly.filter(u => !u.skryto)) : { min: [-50, -50, 0], max: [50, 50, 50] };
      const pos = $('rpPoloha');
      pos.min = Math.floor(ob.min[i] - 1); pos.max = Math.ceil(ob.max[i] + 1);
      if (!pos.dataset.osa || pos.dataset.osa !== osa) { pos.value = (ob.min[i] + ob.max[i]) / 2; pos.dataset.osa = osa; }
      const h = +pos.value, otoc = $('rpOtocit').checked ? -1 : 1;
      const n = [0, 0, 0]; n[i] = -otoc;
      rovina.normal.set(...n); rovina.constant = otoc * h;
      $('rpHodnota').textContent = `${osa.toUpperCase()} = ${fmt(h, 1)} mm`;
      rezAktivni = true;
      aplikujRez();
      M.prekresli();
    }
    M.otevriRezPohledu = function () { M.otevriPanel(oknoRp); obnovRez(); };
    function zavriRez() { rezAktivni = false; aplikujRez(); if (oknoRp.open) oknoRp.close(); M.prekresli(); }
    oknoRp.addEventListener('input', obnovRez);
    oknoRp.addEventListener('change', obnovRez);
    oknoRp.addEventListener('cancel', e => { e.preventDefault(); zavriRez(); });
    $('rpZavrit').onclick = zavriRez;
    M.rezPohledu = () => rezAktivni ? { normala: rovina.normal.toArray(), konstanta: rovina.constant } : null;

    // ================================================================ historie
    const oknoH = $('oknoHistorie');
    function obnovHistorii() {
      if (!oknoH.open) return;
      const H = M.historie, sl = $('histPosuvnik');
      sl.max = H.zaznamy.length - 1; sl.value = H.index;
      $('histInfo').textContent = `krok ${H.index} z ${H.zaznamy.length - 1}`;
      $('histSeznam').innerHTML = H.zaznamy.map((z, i) =>
        `<li><button type="button" class="tl${i === H.index ? ' aktivni' : ''}${i > H.index ? ' budouci' : ''}"${i === H.index ? ' aria-current="step"' : ''} data-krok="${i}">${i}. ${esc(z.popis || 'Začátek')}</button></li>`).join('');
      const akt = $('histSeznam').querySelector('.aktivni');
      if (akt) akt.scrollIntoView({ block: 'nearest' });
    }
    $('histSeznam').addEventListener('click', e => { const b = e.target.closest('[data-krok]'); if (b) M.skocVHistorii(+b.dataset.krok); });
    $('histPosuvnik').addEventListener('input', e => M.skocVHistorii(+e.target.value));
    $('histZavrit').onclick = () => oknoH.close();
    M.otevriHistorii = () => { M.otevriPanel(oknoH); obnovHistorii(); };
    oknoH.addEventListener('cancel', e => { e.preventDefault(); oknoH.close(); });
    // Esc zavře otevřený boční panel (nemodální dialog sám cancel při Esc nedostane) – kromě psaní do pole
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || e.defaultPrevented || M.modalniOkno()) return;
      // pole mimo panely (inspektor, název projektu) si Esc obslouží samy; v panelu Esc panel zavře
      if (e.target && e.target.closest && e.target.closest('input, textarea, select') && !e.target.closest('dialog[data-panel]')) return;
      const panely = [...document.querySelectorAll('dialog.okno.vedle[data-panel][open]')];
      if (!panely.length) return;
      for (const d of panely) { d.dispatchEvent(new Event('cancel', { cancelable: true })); if (d.open) d.close(); }
      e.preventDefault(); e.stopPropagation();             // nejdřív panel, výběr zruší až další Esc
    }, true);
    M.na('historie', obnovHistorii);
    M.na('dokument', e => { if (!e || !e.docasne) obnovHistorii(); });     // tažení historii nemění

    // ================================================================ výkres (SVG, PDF)
    const oknoV = $('oknoVykresu');
    let vykres = null, pocitano = 0;
    const volbyVykresu = () => {
      const m = $('vykMeritko').value;
      const mat = M.MATERIALY && M.MATERIALY[$('vykMaterial').value];
      return {
        papir: $('vykPapir').value, meritko: m === 'auto' ? null : m.split(':').map(Number),
        skryte: $('vykSkryte').checked, izometrie: $('vykPravy').value === 'izometrie', pravyDolni: $('vykPravy').value,
        osy: $('vykOsy').checked, kotyDer: $('vykOsy').checked,
        material: mat ? mat.nazev.split(' ')[0] : '', hustota: mat ? mat.hustota : 0,
        nazev: $('vykNazev').value.trim() || M.app.projekt.nazev, autor: $('vykAutor').value.trim(),
        datum: new Date().toLocaleDateString('cs'),
      };
    };
    async function spocitej() {
      const c = ++pocitano;
      const jenVyber = oknoV.querySelector('input[name="vykRozsah"]:checked').value === 'vyber';
      const uzly = M.telesaKExportu(M.potvrzenyDok(), jenVyber ? M.app.vyber : null);
      $('vykChyba').textContent = '';
      $('vykNahled').classList.add('ceka');
      $('vykStahnoutSvg').disabled = $('vykStahnoutPdf').disabled = $('vykStahnoutDxf').disabled = true;
      try {
        if (!uzly.length) throw new Error('není co kreslit – žádné viditelné těleso');
        const site = (await Promise.all(uzly.map(u => M.svetovaSit(u, M.sitSkupiny)))).map(o => o.sit);
        const v = await M.spocitejVykres(site, volbyVykresu());
        if (c !== pocitano) return;
        vykres = v;
        $('vykNahled').innerHTML = M.vykresSvg(v);
        const pozn = [];
        if (v.zmenseno) pozn.push('⚠ V tomto měřítku se pohledy na list nevejdou – zvol menší měřítko nebo větší papír');
        if (v.bezSkrytych.length) pozn.push('Skryté hrany vynechány (příliš složité): ' + v.bezSkrytych.join(', '));
        $('vykInfo').textContent = `Měřítko ${v.meritko[0]} : ${v.meritko[1]} · rozměry ${v.rozmery.map(x => M.textKoty(x)).join(' × ')} mm` + (pozn.length ? ' · ' + pozn.join(' · ') : '');
        if (v.rezNevesel) pozn.push('Řez se do pravého dolního rohu v tomto měřítku nevejde – zvol větší papír nebo menší měřítko');
        $('vykInfo').textContent = $('vykInfo').textContent + (v.rezNevesel ? ' · ' + pozn[pozn.length - 1] : '');
        $('vykStahnoutSvg').disabled = $('vykStahnoutPdf').disabled = $('vykStahnoutDxf').disabled = false;
      } catch (e) {
        if (c !== pocitano) return;
        vykres = null;
        $('vykNahled').innerHTML = '';
        $('vykChyba').textContent = '⚠ ' + e.message;
      } finally { if (c === pocitano) $('vykNahled').classList.remove('ceka'); }
    }
    M.otevriVykres = function () {
      // „Vybraná tělesa“ jen když je co kreslit (jen díry nebo skrytá tělesa by daly prázdný výkres)
      const lzeVyber = M.app.vyber.length > 0 && M.telesaKExportu(M.app.dok, M.app.vyber).length > 0;
      oknoV.querySelector(`input[name="vykRozsah"][value="${lzeVyber ? 'vyber' : 'vse'}"]`).checked = true;
      oknoV.querySelector('input[name="vykRozsah"][value="vyber"]').disabled = !lzeVyber;
      $('vykNazev').value = M.app.projekt.nazev;
      // materiál podle Kontroly tisku (stejné nastavení)
      if (!$('vykMaterial').options.length && M.MATERIALY) {
        $('vykMaterial').innerHTML = '<option value="">— (jen objem)</option>' + Object.entries(M.MATERIALY).map(([k, m2]) => `<option value="${k}">${esc(m2.nazev)}</option>`).join('');
        try { const t = JSON.parse(localStorage.getItem('modelar_tisk') || '{}'); if (t.material && M.MATERIALY[t.material]) $('vykMaterial').value = t.material; } catch (e) { /* bez úložiště */ }
      }
      if (!oknoV.open) oknoV.showModal();
      spocitej();
    };
    oknoV.addEventListener('change', e => { if (e.target.closest('.vyk-volby')) spocitej(); });
    $('vykZavrit').onclick = () => oknoV.close();
    $('vykStahnoutSvg').onclick = () => {
      if (!vykres) return;
      M.stahniSoubor(M.vykresSvg(vykres), M.jmenoSouboru(volbyVykresu().nazev, '.svg'), 'image/svg+xml');
    };
    $('vykStahnoutDxf').onclick = () => {
      if (!vykres) return;
      M.stahniSoubor(M.vykresDxf(vykres), M.jmenoSouboru(volbyVykresu().nazev, '.dxf'), 'image/vnd.dxf');
    };
    $('vykStahnoutPdf').onclick = async () => {
      if (!vykres) return;
      const tl = $('vykStahnoutPdf');
      tl.disabled = true;
      try {
        const data = await M.vykresPdf(vykres);
        M.stahniSoubor(data, M.jmenoSouboru(volbyVykresu().nazev, '.pdf'), 'application/pdf');
      } catch (e) { $('vykChyba').textContent = '⚠ PDF: ' + e.message; }
      finally { tl.disabled = false; }
    };

    function nactiSkript(src, test) {
      if (test()) return Promise.resolve();
      return new Promise((ok, chyba) => {
        const s = document.createElement('script');
        s.src = src; s.onload = ok; s.onerror = () => chyba(new Error('nejde načíst ' + src));
        document.head.appendChild(s);
      });
    }
    let pismoPdf = null;
    async function pismo() {
      if (pismoPdf !== null) return pismoPdf;
      try {
        const buf = new Uint8Array(await FONTY.data('libsans'));
        let bin = '';
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
        pismoPdf = btoa(bin);
      } catch (e) { pismoPdf = null; return ''; }     // nepodařilo se (offline): příště zkusit znovu, ne bez diakritiky napořád
      return pismoPdf;
    }
    /** Výkres → PDF (Uint8Array). Písmo s háčky a čárkami z FONTY (i z file://). */
    M.vykresPdf = async function (v) {
      await nactiSkript('lib/jspdf.umd.min.js', () => !!window.jspdf);
      const b64 = await pismo();
      const doc = new window.jspdf.jsPDF({ unit: 'mm', format: [v.sirka, v.vyska], orientation: v.sirka > v.vyska ? 'landscape' : 'portrait', compress: true });
      if (b64) { doc.addFileToVFS('LiberationSans-Bold.ttf', b64); doc.addFont('LiberationSans-Bold.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); }
      const txt = s => b64 ? String(s) : bezDiakritiky(s);
      doc.setLineCap('round');
      // druh čáry: plná, čárkovaná (skryté hrany), čerchovaná (osy)
      let vzor = '', tl = null;
      const nastavVzor = v2 => { if (vzor !== v2) { vzor = v2; doc.setLineDashPattern(v2 === 'c' ? [2, 1] : v2 === 'o' ? [6, 1, 1, 1] : [], 0); doc.setLineCap(v2 === 'o' ? 'butt' : 'round'); } };
      for (const p of v.primitiva) {
        if (p.typ === 'cara') {
          if (tl !== p.tl) { tl = p.tl; doc.setLineWidth(p.tl === 'silna' ? 0.5 : 0.25); }
          nastavVzor(p.carkovana ? 'c' : p.osa ? 'o' : '');
          doc.line(p.x1, p.y1, p.x2, p.y2);
        } else if (p.typ === 'kruh') {
          nastavVzor('');
          if (tl !== 'tenka') { tl = 'tenka'; doc.setLineWidth(0.25); }
          doc.circle(p.x, p.y, p.r, 'S');
        } else if (p.typ === 'sipka') {
          nastavVzor('');
          doc.setFillColor(0);
          doc.triangle(p.body[0][0], p.body[0][1], p.body[1][0], p.body[1][1], p.body[2][0], p.body[2][1], 'F');
        }
      }
      for (const p of v.primitiva) if (p.typ === 'text') {
        doc.setFontSize(p.vel / 0.3528);
        doc.setTextColor(p.sedy ? 85 : 0);
        const align = p.zarovnani === 'middle' ? 'center' : p.zarovnani === 'end' ? 'right' : 'left';
        if (p.otoceni) {
          // jsPDF otáčí jen kolem začátku textu a proti směru hodin: posunout začátek o půl šířky po směru textu
          const w = doc.getTextWidth(txt(p.text)), a = p.otoceni * Math.PI / 180, posun = align === 'center' ? w / 2 : align === 'right' ? w : 0;
          doc.text(txt(p.text), p.x - Math.cos(a) * posun, p.y - Math.sin(a) * posun, { angle: -p.otoceni });
        } else doc.text(txt(p.text), p.x, p.y, { align });
      }
      return new Uint8Array(doc.output('arraybuffer'));
    };

    // ================================================================ vlastní tvary
    const mrizMoje = $('knihovnaMoje');
    async function obnovTvary() {
      let tvary = [];
      try { tvary = await U.tvary(); } catch (e) { /* bez úložiště */ }
      mrizMoje.innerHTML = tvary.map(t => `<div class="dlazdice-obal"><button type="button" class="dlazdice moje" data-tvar="${esc(t.id)}" title="${esc(t.nazev)}: klikni pro vložení (${t.tvar.rozmer.map(x => M.textKoty(x)).join(' × ')} mm)">`
        + `<span class="ik">⭐</span><span>${esc(t.nazev)}</span></button><button type="button" class="smaz-tvar" data-smaz-tvar="${esc(t.id)}" title="Smazat z knihovny" aria-label="Smazat tvar ${esc(t.nazev)}">✕</button></div>`).join('');
      $('mojeTvaryPrazdne').hidden = tvary.length > 0;
      M.mojeTvary = tvary;
    }
    mrizMoje.addEventListener('click', async e => {
      const s = e.target.closest('[data-smaz-tvar]');
      if (s) {
        const t = (M.mojeTvary || []).find(x => x.id === s.dataset.smazTvar);
        if (t && await Dialog.potvrd(`Smazat „${t.nazev}“ z knihovny?`)) await U.smazTvar(t.id);
        return;
      }
      const b = e.target.closest('[data-tvar]');
      if (!b) return;
      const t = (M.mojeTvary || []).find(x => x.id === b.dataset.tvar);
      if (!t) return;
      try { await U.nactiZdroje(t.tvar.zdroje); } catch (x) { Dialog.chyba('Tvar nejde vložit: ' + x.message); return; }
      const krok = Math.max(S.deska.krok, 1);
      const r = M.vlozTvar(M.app.dok, t.tvar, [Math.round(S.kamera.cil.x / krok) * krok, Math.round(S.kamera.cil.y / krok) * krok, 0]);
      M.zmenDokument(r.dok, 'Vložit ' + t.nazev);
      M.nastavVyber(r.ids);
    });
    M.ulozitVlastniTvar = async function () {
      const uzly = M.vybraneUzly();
      if (!uzly.length) { Dialog.chyba('Vyber tělesa, která chceš uložit jako vlastní tvar.'); return; }
      if (!U.dostupne) { Dialog.chyba('Úložiště prohlížeče není k dispozici, vlastní tvary nejde uložit.'); return; }
      const nazev = await Dialog.zeptej('Název tvaru v knihovně:', uzly.length === 1 ? uzly[0].nazev : 'Můj tvar');
      if (nazev === null) return;
      try {
        await U.ulozTvar(M.tvarZUzlu(uzly, nazev.trim()));
        Dialog.info(`„${nazev.trim() || 'Můj tvar'}“ je v knihovně v sekci Moje tvary.`);
      } catch (e) { Dialog.chyba('Tvar nejde uložit: ' + e.message); }
    };
    M.na('tvary', obnovTvary);
    obnovTvary();

    // ================================================================ paleta příkazů (Ctrl+K)
    const oknoP = $('oknoPalety'), vstupP = $('paletaHledat'), seznamP = $('paletaSeznam');
    let polozky = [], aktivni = 0;
    const norm = s => bezDiakritiky(s).toLowerCase();
    function vsechnyPolozky() {
      const out = M.PRIKAZY.filter(p => p.id !== 'paleta' && p.povoleno()).map(p => ({ nazev: p.nazev, klavesy: (p.klavesy[0] || '').replace('Escape', 'Esc'), akce: p.akce }));
      for (const [druh, t] of Object.entries(M.TVARY)) out.push({ nazev: 'Přidat tvar: ' + t.nazev, klavesy: '', akce: () => M.pridejTvar(druh, M.mistoProTvar ? M.mistoProTvar(druh) : {}) });
      for (const [druh, d] of Object.entries(M.DILY || {})) if (!d.skryty) out.push({ nazev: 'Přidat díl: ' + d.nazev, klavesy: '', akce: () => M.pridejTvar(druh, M.mistoProTvar ? M.mistoProTvar(druh) : {}) });
      for (const t of M.mojeTvary || []) out.push({ nazev: 'Vložit můj tvar: ' + t.nazev, klavesy: '', akce: () => mrizMoje.querySelector(`[data-tvar="${CSS.escape(t.id)}"]`).click() });
      return out;
    }
    function filtruj() {
      const slova = norm(vstupP.value).split(/\s+/).filter(Boolean);
      polozky = vsechnyPolozky().filter(p => slova.every(s => norm(p.nazev).includes(s)));
      aktivni = Math.min(aktivni, Math.max(0, polozky.length - 1));
      aktivni = Math.min(aktivni, 59);                 // zobrazí se nejvýš 60 položek – výběr nesmí zmizet za koncem
      seznamP.innerHTML = polozky.slice(0, 60).map((p, i) => `<li role="option" id="paleta-${i}" aria-selected="${i === aktivni}" data-i="${i}"><span>${esc(p.nazev)}</span>${p.klavesy ? `<kbd>${esc(p.klavesy)}</kbd>` : ''}</li>`).join('')
        || '<li class="pozn" role="option" aria-disabled="true">Nic nenalezeno.</li>';
      if (polozky.length) vstupP.setAttribute('aria-activedescendant', 'paleta-' + aktivni); else vstupP.removeAttribute('aria-activedescendant');
      const a = seznamP.querySelector('[aria-selected="true"]');
      if (a) a.scrollIntoView({ block: 'nearest' });
    }
    function spust(i) {
      const p = polozky[i];
      oknoP.close();
      if (p) p.akce();
    }
    M.otevriPaletu = function () {
      vstupP.value = ''; aktivni = 0;
      oknoP.showModal();
      filtruj();
      vstupP.focus();
    };
    vstupP.addEventListener('input', () => { aktivni = 0; filtruj(); });
    vstupP.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { aktivni = Math.min(polozky.length - 1, 59, aktivni + 1); filtruj(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { aktivni = Math.max(0, aktivni - 1); filtruj(); e.preventDefault(); }
      else if (e.key === 'Enter') { e.preventDefault(); spust(aktivni); }
    });
    seznamP.addEventListener('click', e => { const li = e.target.closest('[data-i]'); if (li) spust(+li.dataset.i); });
    // klik mimo okno (na pozadí) ho zavře – klik na okraj samotného okna ne
    oknoP.addEventListener('click', e => {
      if (e.target !== oknoP) return;
      const r = oknoP.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) oknoP.close();
    });
  };
})(MDL);
