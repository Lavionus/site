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
  function veWorkeru(zadani, prubeh) {
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
    let st = null, bezi = null, otevira = false, rucne = false;
    let posledniVzor = 'diamanty';
    /** Chyba výpočtu česky (z workeru chodí anglické zprávy JS); detail do konzole. */
    const cesky = e => {
      const t = String(e && e.message || e);
      console.error('Modelář – struktura:', e);
      if (/alloc|memory|paměť|Invalid array length/i.test(t)) return 'nestačí paměť – zvětši dlaždici, jemnost nebo nanes vzor na menší plochu';
      if (/[áčďéěíňóřšťúůýž]/i.test(t)) return t;                         // už česká zpráva z jádra
      return 'neočekávaná chyba výpočtu (podrobnosti v konzoli prohlížeče)';
    };

    const volby = () => ({ vzor: $('strVzor').value, velikost: cti('strVelikost'), hloubka: cti('strHloubka'), smer: vybrano(okno, 'strSmer'),
      rotace: cti('strRotace') || 0, okraj: cti('strOkraj') || 0, invert: $('strInvert').checked });

    function aktualizuj() {
      if (!st || bezi) return;
      try { prepocti(); }
      catch (e) { $('strChyba').textContent = '⚠ ' + cesky(e); $('strOk').disabled = true; }
    }
    function prepocti() {
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
      if (otevira) return;                              // předchozí klik se ještě připravuje
      const u = M.najdiUzel(M.app.dok, zasah.id);
      if (!u || u.zamceno || u.role === 'dira') { Dialog.chyba('Klikni na plochu plného (nezamčeného) tělesa.'); return; }
      if (!M.app.dok.uzly.some(x => x.id === u.id)) { Dialog.chyba('Strukturu jde nanést jen na samostatné těleso nebo celou skupinu.'); return; }
      const sit = S.telesa.svetovaSit(u.id);
      if (!sit || zasah.trojuhelnik == null) return;
      otevira = true;
      // načtení jádra (poprvé ~170 kB) a rozdělení sítě na plochy chvíli trvá – ukázat čekání hned
      M.cekej('struktura', globalThis.POVRCH ? 'Připravuji plochu…' : 'Načítám nástroj struktury…', null, 0);
      let svar, model, oblast;
      try {
        await M.dejVykreslit();
        try { await M.nactiPovrch(); naplnVzory(); }
        catch (e) { Dialog.chyba('Nástroj struktury se nepodařilo načíst (' + e.message + '). Zkus to znovu, případně obnov stránku.'); return; }
        M.cekej('struktura', 'Připravuji plochu…');
        await M.dejVykreslit();
        // těleso se mezitím (načítání) mohlo posunout nebo smazat: síť by patřila ke starému stavu
        if (M.najdiUzel(M.app.dok, u.id) !== u) { Dialog.info('Těleso se mezitím změnilo – klikni na plochu znovu.'); return; }
        try {
          svar = POVRCH.svar(M.polevkaSite(sit));
          model = POVRCH.priprav(svar, M.UHEL_PLOCH);
          oblast = M.oblastStruktury(model, sit, zasah.trojuhelnik);
        } catch (e) { Dialog.chyba('Plochu tělesa nejde připravit: ' + cesky(e)); return; }
      } finally { otevira = false; M.hotovoCekani('struktura'); }
      if (!oblast) { Dialog.chyba('Plochu pod kliknutím se nepodařilo najít.'); return; }
      st = { id: u.id, uzel: u, nazev: u.nazev, svar, model, oblast };
      // tloušťka tělesa kolmo k ploše (hrubě: nejmenší rozměr obálky) – jen pro varování
      const r = model.box.rozmer;
      const R = M.polomerOblasti(model, oblast);
      st.tloustka = oblast.tvar === 'valec' ? R : Math.min(...r);
      const prum = 2 * R;
      $('strPlocha').textContent = oblast.tvar === 'valec'
        ? `Plášť válce ⌀\u00a0${M.mm(prum, 1)}\u00a0mm (obvod ${M.mm(Math.PI * prum, 1)}\u00a0mm) – vzor se ovine dokola.`
        : oblast.tvar === 'rovina' ? `Rovná plocha ${M.mm(oblast.plocha, 0)}\u00a0mm².`
        : 'Zakřivená plocha – vzor se promítne z nejbližšího směru, může být místy zkreslený.';
      // výchozí velikost a hloubka podle tělesa – dokud je uživatel sám nezměnil
      if (!rucne) {
        const d = model.box.uhlopricka;
        $('strVelikost').value = M.mm(Math.max(2, Math.round(d / 8)), 1);
        $('strHloubka').value = M.mm(Math.max(0.3, Math.min(2, Math.round(d / 80 * 10) / 10)), 1);
      }
      $('strVzor').value = posledniVzor;
      $('strOk').textContent = 'Nanést strukturu';
      $('strChyba').textContent = '';
      okno.showModal();
      aktualizuj();
    };
    ['strVelikost', 'strHloubka'].forEach(id => $(id).addEventListener('input', e => { if (e.isTrusted) rucne = true; }));

    /** Seznam vzorů do výběru (po načtení VZORY). */
    function naplnVzory() {
      if ($('strVzor').options.length) return;
      for (const v of VZORY.SEZNAM) {
        const o = document.createElement('option');
        o.value = v.id; o.textContent = `${v.ikona || ''} ${v.nazev}`.trim(); o.title = v.popis || '';
        $('strVzor').appendChild(o);
      }
    }

    // psaní v polích: přepočet s malým odkladem (odhad sítě nad velkým tělesem chvíli trvá)
    let odklad = null;
    okno.addEventListener('input', () => { clearTimeout(odklad); odklad = setTimeout(aktualizuj, 150); });
    okno.addEventListener('change', () => { clearTimeout(odklad); aktualizuj(); });

    const konecPrubehu = () => { $('strPrubeh').hidden = true; $('strLista').style.width = ''; $('strProcenta').textContent = ''; };
    $('strOk').onclick = async () => {
      if (!st || bezi) return;
      bezi = true;                                      // hned: vstup do pole během přípravy už nepovolí tlačítko
      const d = st, s = d.s;
      $('strOk').disabled = true;
      $('strPrubeh').hidden = false;
      // fáze do živé oblasti (čtečka ji přečte jednou), procenta mimo ni
      const prubeh = (f, t) => {
        const fz = `${t || 'Počítám'}…`;
        if ($('strInfo').textContent !== fz) $('strInfo').textContent = fz;
        $('strProcenta').textContent = f > 0 ? `${Math.round(f * 100)}\u00a0%` : '';
        $('strPrubeh').classList.toggle('neurcite', !(f > 0));
        $('strLista').style.width = f > 0 ? (f * 100).toFixed(1) + '%' : '';
      };
      prubeh(0, 'Počítám');
      const mapa = VZORY.mapa(s.vzor, s.parametry, 256);
      const zadani = { pos: d.svar.pos, tri: d.svar.tri, uhel: M.UHEL_PLOCH, rid: d.oblast.id,
        s: JSON.parse(JSON.stringify(s)), mapa: { N: mapa.N, M: mapa.M, data: mapa.data, pomer: mapa.pomer },
        jemnost: d.jemnost, limitT: M.LIMIT_STRUKTURY };
      let r;
      try {
        const w = veWorkeru(zadani, prubeh);
        if (w) { bezi = w; r = await w; }
        else {
          await M.dejVykreslit();                               // ať se ukáže „Počítám…“ (hlavní vlákno pak stojí, kolečko se točí dál)
          r = M.spocitejStrukturu(d.model, d.oblast.id, s, { jemnost: d.jemnost });
        }
      } catch (e) {
        bezi = null;
        konecPrubehu();
        if (st !== d) return;                                   // zrušeno
        $('strChyba').textContent = '⚠ Výpočet selhal: ' + cesky(e);
        $('strOk').disabled = false;
        return;
      }
      bezi = null;
      konecPrubehu();
      if (st !== d) return;
      st = null;
      okno.close();
      posledniVzor = s.vzor;
      const info = VZORY.podleId(s.vzor);
      // zobrazení velké sítě (normály, hrany) zabere chvíli hlavního vlákna
      M.cekej('struktura', 'Zobrazuji výsledek…', null, 0);
      await M.dejVykreslit();
      try {
        if (M.najdiUzel(M.app.dok, d.id) !== d.uzel) throw new Error('těleso se během výpočtu změnilo nebo smazalo – zkus to znovu');
        const z = M.nahradSiti(M.app.dok, d.id, r.sit, `${d.nazev} – ${info ? info.nazev.toLowerCase() : 'struktura'}`);
        M.zmenDokument(z.dok, 'Struktura na ploše');
        M.nastavVyber([z.id]);
        await M.dejVykreslit();
      } catch (e) { Dialog.chyba('Strukturu nejde nanést: ' + cesky(e)); return; }
      finally { M.hotovoCekani('struktura'); }
      Dialog.info(`Struktura nanesena (${Math.round(r.sit.idx.length / 3000)} tisíc trojúhelníků). Těleso je teď síť – rozměry a parametry tvaru už nejdou měnit, Ctrl+Z vrátí původní.`
        + (r.varovani.length ? '\n\n' + r.varovani.join('\n') : ''));
    };
    const zrus = () => {
      if (bezi && bezi.zrus) bezi.zrus();
      konecPrubehu();
      bezi = null; st = null;
    };
    $('strZrusit').onclick = () => { zrus(); okno.close(); };
    okno.addEventListener('cancel', zrus);
  };
})(MDL);
