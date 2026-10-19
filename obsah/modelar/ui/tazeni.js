/* Modelář 3D – okno Tažení po dráze (Úpravy → ➰ Tažení profilu po dráze…): vybrané dvě skici,
   jedna je profil (průřez), druhá dráha (obrys, po kterém profil jede). Výsledek je nová skica
   v režimu tažení (inspektor: dráha, zkroucení, profil na konci), původní skici se skryjí.
   Šroubovice: u jedné skici stačí v inspektoru přepnout Těleso → Tažení po dráze → Šroubovice. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  M.vytvorTazeni = function () {
    const okno = document.createElement('dialog');
    okno.id = 'oknoTazeni';
    okno.className = 'okno';
    okno.setAttribute('aria-labelledby', 'tazNadpis');
    okno.innerHTML = `<h2 id="tazNadpis">➰ Tažení profilu po dráze</h2>
      <fieldset><legend>Která skica je profil (průřez)?</legend><div id="tazVolba"></div></fieldset>
      <label class="zaskrt"><input type="checkbox" id="tazOtevrena"> Otevřená dráha (konec se nespojí se začátkem)</label>
      <label class="zaskrt"><input type="checkbox" id="tazStred" checked> Profil na střed dráhy (střed obrysu profilu jede po křivce)</label>
      <p class="poznamka">Profil jede po nejdelším obrysu druhé skici, „nahoru“ v profilu zůstává nahoře (jako průřez lišty). Zkroucení, zúžení ke konci a šroubovici nastavíš pak v inspektoru.</p>
      <p class="chyba-text" id="tazChyba" aria-live="polite"></p>
      <div class="tlacitka"><button type="button" class="tl" id="tazZrusit">Zrušit</button><button type="button" class="tl hlavni-tl" id="tazOk">Vytvořit</button></div>`;
    document.body.appendChild(okno);
    let ids = [];
    $('tazZrusit').onclick = () => okno.close();

    /** Profil = skica s menší obálkou (dráha bývá větší); uživatel to přepne. */
    M.otevriTazeni = function () {
      const u = M.vybraneUzly().filter(x => x.druh === 'skica');
      if (u.length !== 2) { Dialog.chyba('Vyber dvě skici: profil (průřez) a dráhu.'); return; }
      const vel = x => Math.max(...x.rozmer.slice(0, 2));
      u.sort((a, b) => vel(a) - vel(b));
      ids = u.map(x => x.id);
      $('tazVolba').innerHTML = u.map((x, i) => `<label><input type="radio" name="tazProfil" value="${esc(x.id)}"${i === 0 ? ' checked' : ''}> ${esc(x.nazev)}</label>`).join('');
      $('tazChyba').textContent = '';
      okno.showModal();
    };
    $('tazOk').onclick = () => {
      const prof = okno.querySelector('[name=tazProfil]:checked').value, draha = ids.find(id => id !== prof);
      try {
        const r = M.tazeniZeSkic(M.app.dok, prof, draha, { otevrena: $('tazOtevrena').checked, centrovat: $('tazStred').checked });
        let d = r.dok;
        // trubka kolem dráhy na desce by zčásti ležela pod deskou: položit
        const u = M.najdiUzel(d, r.id);
        if (M.spodekUzlu(u) < -1e-6) d = M.polozNaRovinu(d, [r.id], M.ROVINA_DESKY);
        M.zmenDokument(d, 'Tažení po dráze');
        M.nastavVyber([r.id]);
        okno.close();
        const v = M.kontrolaTazeni && M.kontrolaTazeni(u.param, kontury(u.param));
        if (v && v.varovani) Dialog.info(v.varovani);
      } catch (e) { $('tazChyba').textContent = e.message.charAt(0).toUpperCase() + e.message.slice(1) + '.'; }
    };
    /** Obrysy plných tvarů profilu (pro kontrolu tažení). */
    function kontury(p) {
      const out = [];
      for (const t of p.tvary) if (!t.otvor) for (const k of M.konturyTvaru(t, 32)) out.push(k);
      return out;
    }
    M.varovaniTazeni = function (u) {
      if (!u || u.druh !== 'skica' || u.param.rezim !== 'tazeni' || !M.kontrolaTazeni) return null;
      try { const v = M.kontrolaTazeni(u.param, kontury(u.param)); return v && v.varovani; } catch (e) { return e.message; }
    };
  };
})(MDL);
