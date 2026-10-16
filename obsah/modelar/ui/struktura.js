/* Modelář 3D – okno Struktura na ploše. Režim klikání na plochu (rovinu nebo
   plášť válce – váleček na těsto), pak okno se vzorem, velikostí a hloubkou.
   Jádro povrch3d (POVRCH, VZORY) se načte až při prvním použití; počítá se
   ve workeru sestaveném z textu modulů (jde i z file://), jinak v hlavním
   vlákně. Výsledná síť nahradí těleso (jeden krok zpět). */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const $ = id => document.getElementById(id);
  const cti = id => M.prectiCislo($(id).value);
  const vybrano = (okno, jmeno) => okno.querySelector(`input[name=${jmeno}]:checked`).value;

  function nactiSkript(src, test) {
    if (test()) return Promise.resolve();
    return new Promise((ok, chyba) => {
      const s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = () => chyba(new Error('nejde načíst ' + src));
      document.head.appendChild(s);
    });
  }
  let nacteno = null;
  /** Jádro povrch3d (vzory + geometrie), jednou. */
  M.nactiPovrch = () => nacteno || (nacteno = (async () => {
    await nactiSkript('povrch3d/vzory.js', () => !!globalThis.VZORY);
    await nactiSkript('povrch3d/jadro.js', () => !!globalThis.POVRCH);
  })().catch(e => { nacteno = null; throw e; }));

  /** Výpočet ve workeru; vrátí {sit, varovani}. Bez workeru null (pak se počítá v hlavním vlákně). */
  let urlWorkeru = null;
  function ve​Workeru(zadani, prubeh) {
    if (typeof globalThis.povrchJadro !== 'function' || typeof globalThis.povrchVzory !== 'function') return null;
    let w;
    try {
      if (!urlWorkeru) urlWorkeru = URL.createObjectURL(new Blob([`${globalThis.povrchVzory}\n${globalThis.povrchJadro}\npovrchVzory(self); povrchJadro(self);
self.onmessage = e => {
  const d = e.data;
  try {
    const model = POVRCH.priprav({ pos: d.pos, tri: d.tri }, d.uhel);
    const v = POVRCH.sestav(model, { struktury: new Map([[d.rid, d.s]]) },
      { jemnost: d.jemnost, limitT: d.limitT, mapa: () => d.mapa, vzorek: VZORY.vzorek,
        prubeh: (f, t) => self.postMessage({ typ: 'prubeh', f, t }) });
    const poz = Float32Array.from(v.pos), idx = Uint32Array.from(v.tri);
    self.postMessage({ typ: 'hotovo', sit: { poz, idx }, varovani: v.varovani || [] }, [poz.buffer, idx.buffer]);
  } catch (er) { self.postMessage({ typ: 'chyba', chyba: String(er && er.message || er) }); }
};`], { type: 'text/javascript' }));
      w = new Worker(urlWorkeru);
    } catch (e) { return null; }
    const p = new Promise((ok, chyba) => {
      w.onmessage = e => {
        const d = e.data;
        if (d.typ === 'prubeh') prubeh(d.f, d.t);
        else { w.terminate(); d.typ === 'hotovo' ? ok(d) : chyba(new Error(d.chyba)); }
      };
      w.onerror = e => { w.terminate(); chyba(new Error(e.message || 'chyba výpočtu')); };
    });
    p.zrus = () => w.terminate();
    w.postMessage(zadani);
    return p;
  }

  /** Náhled výškové mapy: nasvícení zleva shora, odstíny akcentu. */
  function kresliNahled(canvas, m, sirka, vyska) {
    const W = canvas.width, H = canvas.height, g = canvas.getContext('2d');
    const img = g.createImageData(W, H);
    // dlaždic na šířku podle poměru, ať je vidět opakování
    const sx = 3, sy = sx * (H / W) * (sirka / vyska);
    const h = (u, v) => VZORY.vzorek(m, u, v);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const u = i / W * sx, v = (H - 1 - j) / H * sy;
      const z = h(u, v), dx = h(u + 0.004, v) - z, dy = h(u, v + 0.004) - z;
      const svetlo = Math.max(0, Math.min(1, 0.55 + (-dx + dy) * 18));
      const a = 70 + 150 * z * 0.6 + 120 * (svetlo - 0.5);
      const k = (j * W + i) * 4;
      img.data[k] = Math.max(0, Math.min(255, a * 0.95)); img.data[k + 1] = Math.max(0, Math.min(255, a * 0.85)); img.data[k + 2] = Math.max(0, Math.min(255, a * 0.7));
      img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }

  M.vytvorStrukturu = function (S) {
    const okno = $('oknoStruktura');
    let st = null, bezi = null;
    let posledniVzor = 'diamanty';

    const volby = () => ({ vzor: $('strVzor').value, velikost: cti('strVelikost'), hloubka: cti('strHloubka'), smer: vybrano(okno, 'strSmer'),
      rotace: cti('strRotace') || 0, okraj: cti('strOkraj') || 0, invert: $('strInvert').checked });

    function aktualizuj() {
      if (!st || bezi) return;
      const s = M.nastaveniStruktury(volby());
      st.s = s;
      kresliNahled($('strNahled'), VZORY.mapa(s.vzor, s.parametry, 128), s.sirka, s.vyska);
      const j0 = M.jemnostStruktury(s);
      const j = POVRCH.jemnostProLimit(st.model, new Map([[st.oblast.id, s]]), [], j0, M.LIMIT_STRUKTURY);
      st.jemnost = j;
      const n = POVRCH.odhadTrojuhelniku(st.model, new Map([[st.oblast.id, s]]), j, []);
      const tl = 2 * s.hloubka;
      $('strInfo').textContent = `Odhad ${Math.round(n / 1000)} tisíc trojúhelníků, síť po ${M.mm(j, 2)} mm`
        + (j > j0 * 1.01 ? ' (zhrubeno kvůli velikosti)' : '') + '.'
        + (s.smer === 'dovnitr' && st.tloustka && st.tloustka < tl ? ` ⚠ Stěna je tenká (${M.mm(st.tloustka, 1)} mm) – vzor ji může proříznout.` : '');
      $('strChyba').textContent = '';
      $('strOk').disabled = false;
    }

    M.otevriStrukturu = async function (zasah) {
      const u = M.najdiUzel(M.app.dok, zasah.id);
      if (!u || u.zamceno || u.role === 'dira') { Dialog.chyba('Klikni na plochu plného (nezamčeného) tělesa.'); return; }
      if (!M.app.dok.uzly.some(x => x.id === u.id)) { Dialog.chyba('Strukturu jde nanést jen na samostatné těleso nebo celou skupinu.'); return; }
      const sit = S.telesa.svetovaSit(u.id);
      if (!sit || zasah.trojuhelnik == null) return;
      try { await M.nactiPovrch(); }
      catch (e) { Dialog.chyba('Nepodařilo se načíst výpočet struktury: ' + e.message); return; }
      const svar = POVRCH.svar(M.polevkaSite(sit));
      const model = POVRCH.priprav(svar, M.UHEL_PLOCH);
      const oblast = M.oblastStruktury(model, sit, zasah.trojuhelnik);
      if (!oblast) { Dialog.chyba('Plochu pod kliknutím se nepodařilo najít.'); return; }
      st = { id: u.id, nazev: u.nazev, svar, model, oblast };
      // tloušťka tělesa kolmo k ploše (hrubě: nejmenší rozměr obálky) – jen pro varování
      const r = model.box.rozmer;
      st.tloustka = oblast.tvar === 'valec' ? oblast.polomer : Math.min(...r);
      const prum = oblast.tvar === 'valec' ? oblast.polomer * 2 : 0;
      $('strPlocha').textContent = oblast.tvar === 'valec'
        ? `Plášť válce ⌀ ${M.mm(prum, 1)} mm (obvod ${M.mm(Math.PI * prum, 1)} mm) – vzor se ovine dokola.`
        : oblast.tvar === 'rovina' ? `Rovná plocha ${M.mm(Math.sqrt(oblast.plocha), 0)}² mm (${M.mm(oblast.plocha, 0)} mm²).`
        : 'Zakřivená plocha – vzor se promítne z nejbližšího směru, může být místy zkreslený.';
      // výchozí velikost podle plochy: u válce ať se na obvod vejde celý počet dlaždic
      if (!okno.dataset.nastaveno) {
        const d = model.box.uhlopricka;
        $('strVelikost').value = M.mm(Math.max(2, Math.round(d / 8)), 1);
        $('strHloubka').value = M.mm(Math.max(0.3, Math.min(2, Math.round(d / 80 * 10) / 10)), 1);
        okno.dataset.nastaveno = '1';
      }
      $('strVzor').value = posledniVzor;
      $('strOk').textContent = 'Nanést strukturu';
      okno.showModal();
      aktualizuj();
    };

    // seznam vzorů
    if (globalThis.VZORY) naplnVzory();
    function naplnVzory() {
      if ($('strVzor').options.length) return;
      for (const v of VZORY.SEZNAM) {
        const o = document.createElement('option');
        o.value = v.id; o.textContent = `${v.ikona || ''} ${v.nazev}`.trim(); o.title = v.popis || '';
        $('strVzor').appendChild(o);
      }
    }
    const puvodniOtevri = M.otevriStrukturu;
    M.otevriStrukturu = async zasah => { await M.nactiPovrch().then(naplnVzory, () => {}); return puvodniOtevri(zasah); };

    okno.addEventListener('input', aktualizuj);
    okno.addEventListener('change', aktualizuj);

    $('strOk').onclick = async () => {
      if (!st || bezi) return;
      const d = st, s = d.s;
      $('strOk').disabled = true;
      const prubeh = (f, t) => { $('strInfo').textContent = `${t || 'Počítám'}… ${Math.round(f * 100)} %`; };
      prubeh(0, 'Počítám');
      const mapa = VZORY.mapa(s.vzor, s.parametry, 256);
      const zadani = { pos: d.svar.pos, tri: d.svar.tri, uhel: M.UHEL_PLOCH, rid: d.oblast.id,
        s: JSON.parse(JSON.stringify(s)), mapa: { N: mapa.N, M: mapa.M, data: mapa.data, pomer: mapa.pomer },
        jemnost: d.jemnost, limitT: M.LIMIT_STRUKTURY };
      let r;
      try {
        bezi = veWorkeru(zadani, prubeh);
        if (bezi) r = await bezi;
        else {
          await new Promise(ok => setTimeout(ok, 30));          // ať se ukáže „Počítám…“
          bezi = true;
          r = M.spocitejStrukturu(d.model, d.oblast.id, s, { jemnost: d.jemnost });
        }
      } catch (e) {
        bezi = null;
        if (st !== d) return;                                   // zrušeno
        $('strChyba').textContent = '⚠ Výpočet selhal: ' + e.message;
        $('strOk').disabled = false;
        return;
      }
      bezi = null;
      if (st !== d) return;
      st = null;
      okno.close();
      posledniVzor = s.vzor;
      const info = VZORY.podleId(s.vzor);
      const z = M.nahradSiti(M.app.dok, d.id, r.sit, `${d.nazev} – ${info ? info.nazev.toLowerCase() : 'struktura'}`);
      M.zmenDokument(z.dok, 'Struktura na ploše');
      M.nastavVyber([z.id]);
      Dialog.info(`Struktura nanesena (${Math.round(r.sit.idx.length / 3000)} tisíc trojúhelníků). Těleso je teď síť – rozměry a parametry tvaru už nejdou měnit, Ctrl+Z vrátí původní.`
        + (r.varovani.length ? '\n\n' + r.varovani.join('\n') : ''));
    };
    const zrus = () => {
      if (bezi && bezi.zrus) bezi.zrus();
      bezi = null; st = null;
    };
    $('strZrusit').onclick = () => { zrus(); okno.close(); };
    okno.addEventListener('cancel', zrus);
  };
})(MDL);
