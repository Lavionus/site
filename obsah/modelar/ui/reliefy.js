/* Modelář 3D – text po obvodu (kolem válce ovinutím, nebo po kružnici jako skica) a reliéf z obrázku
   (výšková mapa z jasu fotky → uzavřená síť s podkladem). Geometrie v jadro/upravy.js. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const $ = id => document.getElementById(id);
  const cti = id => M.prectiCislo($(id).value);
  const vybrano = (okno, jmeno) => okno.querySelector(`input[name=${jmeno}]:checked`).value;

  M.vytvorReliefy = function (S) {
    // ------------------------------------------------------------ text po obvodu
    const okno = $('oknoTextObvod');
    $('toPismo').innerHTML = (M.PISMA || [['libsans', 'Liberation Sans Bold']]).map(([k, n]) => `<option value="${k}">${n}</option>`).join('');
    let valec = null, bezi = false, zruseno = false;
    const rezim = () => vybrano(okno, 'toRezim');
    function aktualizuj() {
      if (bezi) return;                                  // během načítání písma tlačítko nepovolovat
      okno.querySelectorAll('[data-to]').forEach(el => { el.hidden = !el.dataset.to.split(' ').includes(rezim()); });
      const r = rezim();
      $('toOk').textContent = r === 'plocha' ? 'Umístit kliknutím' : 'Vytvořit';
      $('toChyba').textContent = r === 'valec' && !valec ? '⚠ Vyber nejdřív jeden válec (pak otevři toto okno znovu), nebo zvol „Po kružnici“.' : '';
      $('toInfo').textContent = r === 'valec' && valec ? `Válec ⌀\u00a0${M.mm(valec.rozmer[0], 1)}\u00a0mm, obvod ${M.mm(Math.PI * valec.rozmer[0], 1)}\u00a0mm, výška ${M.mm(valec.rozmer[2], 1)}\u00a0mm.` : '';
      $('toOk').disabled = !!$('toChyba').textContent || !$('toText').value.trim();
    }
    M.otevriTextObvod = function () {
      const v = M.vybraneVolne();
      valec = v.length === 1 && v[0].druh === 'valec' && v[0].role !== 'dira' && Math.abs(v[0].rozmer[0] - v[0].rozmer[1]) < 1e-3 * v[0].rozmer[0] ? v[0] : null;
      bezi = false; zruseno = false;
      okno.querySelector(`input[name=toRezim][value=${valec ? 'valec' : 'plocha'}]`).checked = true;
      if (valec) $('toVyska').value = M.mm(valec.rozmer[2] / 2, 1);
      okno.showModal(); aktualizuj();
    };
    okno.addEventListener('input', aktualizuj);
    okno.addEventListener('change', aktualizuj);
    $('toZrusit').onclick = () => { zruseno = true; okno.close(); };
    okno.addEventListener('cancel', () => { zruseno = true; });
    /** Znaky textu: obrysy a šířky (posun) z písma; pro testy volatelné přímo. */
    M.znakyTextu = function (font, text, vel) {
      return [...text].map(ch => ({ kontury: ch.trim() ? M.konturyTextu(font, ch, vel) : [], sirka: font.getAdvanceWidth(ch, vel) }));
    };
    /** Vytvoří text po obvodu (v = hodnoty z okna); vrací id nového uzlu. */
    M.vytvorTextObvod = async function (v) {
      const font = await FONTY.opentype(v.pismo);
      if (v.rezim === 'valec') {
        const u = M.najdiUzel(M.app.dok, v.id);
        let k = M.konturyTextu(font, v.text, v.velikost);
        if (!k.length) throw new Error('Text nemá žádné obrysy (jen mezery?).');
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const c of k) for (const [x, y] of c) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        if (x1 - x0 > Math.PI * u.rozmer[0] * 0.97) throw new Error(`Text je delší (${M.mm(x1 - x0, 1)}\u00a0mm) než obvod válce – zmenši písmo nebo zkrať text.`);
        if (zruseno || M.najdiUzel(M.app.dok, u.id) !== u) return null;
        k = k.map(c => c.map(([x, y]) => [x - (x0 + x1) / 2, y - (y0 + y1) / 2]));
        return M.obalitVzorem(u.id, k, { rezim: v.vzor, hloubka: v.hloubka, vyska: v.vyska, natoceni: v.natoceni, nazev: 'Text ' + v.text.slice(0, 30) });
      }
      const znaky = M.znakyTextu(font, v.text, v.velikost);
      const celkem = znaky.reduce((s, z) => s + z.sirka, 0);
      if (celkem > 2 * Math.PI * v.polomer * 0.97) throw new Error('Text je delší než kružnice – zvětši poloměr nebo zmenši písmo.');
      if (zruseno) return null;
      const kontury = M.textPoKruznici(znaky, v.polomer, v.stred, v.zvenku);
      const m = M.mistoProTvar ? M.mistoProTvar('kvadr') : null;
      const u = M.novaSkica({ tvary: [{ typ: 'polygony', kontury, meritko: 1, x: 0, y: 0 }], vyska: v.tloustka },
        { nazev: 'Text ' + v.text.slice(0, 30) }, M.app.dok);
      const c = m && m.poloha ? [m.poloha[0], m.poloha[1], u.poloha[2]] : u.poloha;
      const u2 = M.normalizujUzel(Object.assign({}, u, { poloha: c }));
      M.zmenDokument(M.pridejUzly(M.app.dok, [u2]), 'Text po kružnici');
      M.nastavVyber([u2.id]);
      return u2.id;
    };
    // ------------------------------------------------------------ text na plochu (klik na těleso)
    let cekaTextNaPlochu = null;                   // hodnoty z okna, čeká se na klik do scény
    /** Klik v režimu textNaPlochu (z vyber.js): nalepí text na těleso pod kurzorem. */
    M.klikTextNaPlochu = async function (zasah) {
      const v = cekaTextNaPlochu;
      if (!v) { M.nastavRezim(null); return; }
      const u = zasah && M.najdiUzel(M.app.dok, zasah.id);
      if (!u || u.role === 'dira') { Dialog.info('Klikni na plné těleso, na které má text přijít.'); return; }
      const sit = S.telesa.svetovaSit(u.id);
      if (!sit) { Dialog.info('Těleso se ještě počítá – zkus to za chvíli.'); return; }
      M.nastavRezim(null);
      cekaTextNaPlochu = null;
      M.cekej('textPlocha', 'Načítám písmo…', null, 0);
      try {
        const font = await FONTY.opentype(v.pismo);
        let k = M.konturyTextu(font, v.text, v.velikost);
        if (!k.length) throw new Error('text nemá žádné obrysy (jen mezery?)');
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const c of k) for (const [x, y] of c) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        k = k.map(c => c.map(([x, y]) => [x - (x0 + x1) / 2, y - (y0 + y1) / 2]));
        // směr účaří: vpravo podle kamery (text se čte z pohledu, ze kterého se kliklo), natočený kolem normály plochy
        const kam = S.kamera.aktivni(), vpravo = new THREE.Vector3(1, 0, 0).applyQuaternion(kam.quaternion);
        const n = zasah.normala.clone().normalize();
        const smer = vpravo.addScaledVector(n, -vpravo.dot(n)).normalize().applyAxisAngle(n, (v.uhel || 0) * M.st);
        M.cekej('textPlocha', 'Lepím text na plochu…', null, 0);
        await M.dejVykreslit();
        const krok = M.omez(v.velikost / 25, 0.12, 0.6);
        const dok0 = M.app.dok;
        const r = M.textNaTeleso(dok0, u.id, sit, k, { bod: zasah.bod.toArray(), smer: smer.toArray(), vyska: v.hloubka, hloubka: v.hloubka,
          vzor: v.vzor, krok, nazev: 'Text ' + v.text.slice(0, 30) });
        if (M.app.dok !== dok0) return;
        M.zmenDokument(r.dok, v.vzor === 'vyryty' ? 'Vyrytý text' : 'Text na plochu');
        M.nastavVyber([r.id]);
      } catch (e) { Dialog.chyba('Text nejde nalepit: ' + e.message); }
      finally { M.hotovoCekani('textPlocha'); }
    };
    M.na('rezim', r => { if (r !== 'textNaPlochu') cekaTextNaPlochu = null; });

    $('toOk').onclick = async () => {
      if (bezi) return;
      if (rezim() === 'plocha') {
        const text = $('toText').value.trim();
        if (!text) return;
        cekaTextNaPlochu = { text, pismo: $('toPismo').value, velikost: M.omez(cti('toVelikost') || 6, 0.5, 300), vzor: vybrano(okno, 'toVzor'),
          hloubka: M.omez(cti('toHloubka') || 0.8, 0.05, 20), uhel: cti('toUhel') || 0 };
        okno.close();
        M.nastavRezim('textNaPlochu');
        return;
      }
      const vy = cti('toVyska');
      const v = { rezim: rezim(), id: valec && valec.id, text: $('toText').value.trim(), pismo: $('toPismo').value, velikost: M.omez(cti('toVelikost') || 6, 1, 300),
        vzor: vybrano(okno, 'toVzor'), hloubka: M.omez(cti('toHloubka') || 0.8, 0.1, 20), vyska: valec ? (isFinite(vy) && $('toVyska').value.trim() ? M.omez(vy, 0, valec.rozmer[2]) : valec.rozmer[2] / 2) : 0, natoceni: cti('toNatoceni') || 0,
        polomer: M.omez(cti('toPolomer') || 30, 2, 2000), tloustka: M.omez(cti('toTloustka') || 2, 0.2, 100), stred: cti('toStred') || 0, zvenku: $('toZvenku').checked };
      bezi = true; zruseno = false;
      $('toOk').disabled = true;
      $('toInfo').textContent = 'Načítám písmo…';
      try { await M.vytvorTextObvod(v); if (okno.open) okno.close(); }
      catch (e) { if (okno.open) $('toChyba').textContent = '⚠ ' + e.message; }
      finally { bezi = false; if (okno.open) aktualizuj(); }
    };

    // ------------------------------------------------------------ reliéf z obrázku
    const oknoR = $('oknoRelief');
    const vstup = document.createElement('input');
    vstup.type = 'file'; vstup.accept = 'image/*'; vstup.hidden = true; vstup.id = 'vstupRelief';
    document.body.appendChild(vstup);
    let obr = null;                                  // {jas Float32Array, w, h, nazev} v plném rozlišení náhledu
    const BODU_MAX = 400;
    /** Jas obrázku zmenšeného na `bodu` bodů po delší straně (0…1), volitelně rozmazaný. */
    function jasObrazku(img, bodu, rozmaz) {
      if (!(img.width > 0 && img.height > 0)) throw new Error('Obrázek nemá rozměry (SVG bez šířky a výšky?) – ulož ho jako PNG nebo JPG.');
      const k = bodu / Math.max(img.width, img.height), w = Math.max(2, Math.round(img.width * k)), h = Math.max(2, Math.round(img.height * k));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h).data;
      let jas = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) jas[i] = (0.2126 * d[4 * i] + 0.7152 * d[4 * i + 1] + 0.0722 * d[4 * i + 2]) / 255 * (d[4 * i + 3] / 255) + (1 - d[4 * i + 3] / 255);
      for (let r = 0; r < rozmaz; r++) {
        const o = new Float32Array(w * h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          let s = 0, n = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) { s += jas[yy * w + xx]; n++; } }
          o[y * w + x] = s / n;
        }
        jas = o;
      }
      return { jas, w, h };
    }
    function aktualizujR() {
      $('relOk').disabled = !obr;
      if (!obr) { $('relInfo').textContent = 'Vyber obrázek (fotka, logo, mapa). Světlé místo = vyšší.'; return; }
      const bodu = M.omez(Math.round(cti('relBodu') || 160), 16, BODU_MAX), j = jasObrazku(obr.img, bodu, M.omez(Math.round(cti('relRozmazat') || 0), 0, 4));
      const sirka = M.omez(cti('relSirka') || 80, 5, 1000);
      $('relInfo').textContent = `${j.w} × ${j.h} bodů, ${M.mm(sirka, 0)} × ${M.mm(sirka * (j.h - 1) / (j.w - 1), 0)} mm, ≈ ${Math.round(j.w * j.h * 4 / 1000)} tisíc trojúhelníků.`;
      const cv = $('relNahled'), g = cv.getContext('2d'), im = g.createImageData(cv.width, cv.height), tm = $('relTmave').checked;
      for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
        const sx = Math.min(j.w - 1, Math.floor(x / cv.width * j.w)), sy = Math.min(j.h - 1, Math.floor(y / cv.height * j.h));
        let t = j.jas[sy * j.w + sx]; if (tm) t = 1 - t;
        const k = (y * cv.width + x) * 4; im.data[k] = im.data[k + 1] = im.data[k + 2] = 40 + 200 * t; im.data[k + 3] = 255;
      }
      g.putImageData(im, 0, 0);
    }
    // poslední obrázek zůstává – jde jen upravit výšku či šířku a vytvořit znovu
    M.otevriRelief = function () { oknoR.showModal(); aktualizujR(); };
    $('relSoubor').onclick = () => vstup.click();
    /** Načte obrázek z URL / data URL (pro testy). */
    M.nactiObrazekReliefu = (src, nazev = 'obrázek') => new Promise((ok, chyba) => {
      const img = new Image();
      img.onload = () => {
        if (!(img.width > 0 && img.height > 0)) { chyba(new Error('Obrázek nemá rozměry (SVG bez šířky a výšky?) – ulož ho jako PNG nebo JPG.')); return; }
        obr = { img, nazev }; $('relNazev').textContent = nazev;
        try { aktualizujR(); ok(); } catch (e) { obr = null; aktualizujR(); chyba(e); }
      };
      img.onerror = () => chyba(new Error('Obrázek nejde načíst (podporované jsou PNG, JPG, GIF, WebP a SVG s rozměry).'));
      img.src = src;
    });
    vstup.addEventListener('change', () => {
      const f = vstup.files[0]; vstup.value = '';
      if (!f) return;
      const r = new FileReader();
      r.onload = () => M.nactiObrazekReliefu(r.result, f.name.replace(/\.[^.]+$/, '')).catch(e => Dialog.chyba(e.message));
      r.onerror = () => Dialog.chyba(`Soubor ${f.name} nejde přečíst.`);
      r.readAsDataURL(f);
    });
    // přepočet jasu a náhledu s malým odkladem (jedna změna = jeden přepočet, i když přijde input i change)
    let odkladR = null;
    const naplanujR = () => { if (!obr) return; clearTimeout(odkladR); odkladR = setTimeout(() => { try { aktualizujR(); } catch (e) { $('relInfo').textContent = '⚠ ' + e.message; } }, 120); };
    oknoR.addEventListener('input', naplanujR);
    oknoR.addEventListener('change', naplanujR);
    $('relZrusit').onclick = () => oknoR.close();
    $('relOk').onclick = async () => {
      if (!obr) return;
      oknoR.close();
      M.cekej('relief', 'Počítám reliéf…', null, 0);
      await M.dejVykreslit();
      try {
        const j = jasObrazku(obr.img, M.omez(Math.round(cti('relBodu') || 160), 16, BODU_MAX), M.omez(Math.round(cti('relRozmazat') || 0), 0, 4));
        const sit = M.sitReliefu(j.jas, j.w, j.h, { sirka: M.omez(cti('relSirka') || 80, 5, 1000), vyska: M.omez(cti('relVyska') || 3, 0, 100),
          podklad: M.omez(cti('relPodklad') || 1.5, 0.2, 100), tmaveVys: $('relTmave').checked });
        const m = M.mistoProTvar ? M.mistoProTvar('kvadr') : null;
        const uzly = M.uzlyZImportu([{ sit, nazev: 'Reliéf ' + obr.nazev }], M.app.dok, m && m.poloha ? m.poloha.slice(0, 2) : [0, 0], 'relief');
        M.zmenDokument(M.pridejUzly(M.app.dok, uzly), 'Reliéf z obrázku');
        M.nastavVyber(uzly.map(u => u.id));
        await M.dejVykreslit();
      } catch (e) { Dialog.chyba('Reliéf nejde vytvořit: ' + e.message); }
      finally { M.hotovoCekani('relief'); }
    };
  };
})(MDL);
