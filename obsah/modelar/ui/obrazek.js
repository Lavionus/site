/* Modelář 3D – okno Obrázek PNG (Soubor → 🖼 Uložit obrázek…): snímek scény pro dokumentaci,
   návody nebo e-shop. Velikost, průhledné nebo barevné pozadí, s deskou nebo bez,
   současný pohled nebo celý model; stáhnout jako PNG nebo kopírovat do schránky. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const $ = id => document.getElementById(id);

  M.vytvorObrazek = function (S) {
    const okno = document.createElement('dialog');
    okno.id = 'oknoObrazku';
    okno.className = 'okno';
    okno.setAttribute('aria-labelledby', 'obrNadpis');
    okno.innerHTML = `<h2 id="obrNadpis">🖼 Uložit obrázek (PNG)</h2>
      <div class="obr-nahled"><img id="obrNahled" alt="Náhled obrázku"></div>
      <div class="radek"><label for="obrVelikost">Velikost</label><select id="obrVelikost">
        <option value="okno">Jako okno ×2</option><option value="1920x1080">1920 × 1080 (Full HD)</option>
        <option value="1080x1080">1080 × 1080 (čtverec)</option><option value="1200x900">1200 × 900</option>
        <option value="3840x2160">3840 × 2160 (4K)</option><option value="vlastni">Vlastní…</option></select></div>
      <div class="radek" id="obrVlastni" hidden><label for="obrSirka">Šířka</label><input id="obrSirka" inputmode="numeric" value="1600">
        <label for="obrVyska">výška</label><input id="obrVyska" inputmode="numeric" value="1200"> px</div>
      <fieldset><legend>Pohled</legend>
        <label><input type="radio" name="obrPohled" value="aktualni" checked> Současný</label>
        <label><input type="radio" name="obrPohled" value="cely"> Celý model</label></fieldset>
      <fieldset><legend>Pozadí</legend>
        <label><input type="radio" name="obrPozadi" value="pruhledne" checked> Průhledné</label>
        <label><input type="radio" name="obrPozadi" value="bile"> Bílé</label>
        <label><input type="radio" name="obrPozadi" value="vlastni"> <input type="color" id="obrBarva" value="#20242b" aria-label="Barva pozadí"></label></fieldset>
      <label class="zaskrt"><input type="checkbox" id="obrDeska"> Ukázat pracovní desku</label>
      <label class="zaskrt"><input type="checkbox" id="obrVyber"> Ukázat rámečky výběru</label>
      <p class="chyba-text" id="obrChyba" aria-live="polite"></p>
      <div class="tlacitka"><button type="button" class="tl" id="obrZrusit">Zavřít</button><button type="button" class="tl" id="obrKopirovat" title="Vložit pak jde do dokumentu nebo zprávy (Ctrl+V)">📋 Kopírovat</button><button type="button" class="tl hlavni-tl" id="obrStahnout">⬇ Stáhnout PNG</button></div>`;
    document.body.appendChild(okno);

    function rozmery() {
      const v = $('obrVelikost').value;
      $('obrVlastni').hidden = v !== 'vlastni';
      if (v === 'okno') return [Math.round(S.kamera.sirka * 2), Math.round(S.kamera.vyska * 2)];
      if (v === 'vlastni') return [M.omez(Math.round(M.prectiCislo($('obrSirka').value) || 1600), 16, 8192), M.omez(Math.round(M.prectiCislo($('obrVyska').value) || 1200), 16, 8192)];
      return v.split('x').map(Number);
    }
    function volby() {
      const p = okno.querySelector('[name=obrPozadi]:checked').value;
      return { pohled: okno.querySelector('[name=obrPohled]:checked').value, deska: $('obrDeska').checked, vyber: $('obrVyber').checked,
        pozadi: p === 'bile' ? '#ffffff' : p === 'vlastni' ? $('obrBarva').value : null };
    }
    function nahled() {
      const [w, h] = rozmery(), k = Math.min(1, 360 / w, 220 / h);
      try {
        $('obrNahled').src = S.snimek(Math.max(16, Math.round(w * k)), Math.max(16, Math.round(h * k)), volby()).toDataURL('image/png');
        $('obrChyba').textContent = '';
      } catch (e) { $('obrChyba').textContent = 'Náhled nejde vytvořit: ' + e.message; }
    }
    okno.addEventListener('change', nahled);
    $('obrZrusit').onclick = () => okno.close();
    const plneRozliseni = () => new Promise((ok, chyba) => {
      try { const [w, h] = rozmery(); S.snimek(w, h, volby()).toBlob(b => b ? ok(b) : chyba(new Error('obrázek je příliš velký')), 'image/png'); }
      catch (e) { chyba(e); }
    });
    $('obrStahnout').onclick = async () => {
      try {
        const b = await plneRozliseni();
        const jmeno = ((M.app.projekt && M.app.projekt.nazev) || 'model').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'model';
        M.stahniSoubor(b, jmeno + '.png', 'image/png');
      } catch (e) { $('obrChyba').textContent = 'Obrázek nejde uložit: ' + e.message; }
    };
    $('obrKopirovat').onclick = async () => {
      try {
        if (!navigator.clipboard || typeof ClipboardItem === 'undefined') throw new Error('prohlížeč neumí kopírovat obrázky – použij Stáhnout');
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': plneRozliseni() })]);
        Dialog.info('Obrázek je ve schránce.');
      } catch (e) { $('obrChyba').textContent = 'Kopírování nejde: ' + e.message; }
    };
    M.otevriObrazek = function () {
      okno.showModal();
      nahled();
    };
  };
})(MDL);
