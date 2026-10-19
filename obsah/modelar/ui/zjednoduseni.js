/* Modelář 3D – okno Zjednodušit síť importovaného modelu (inspektor → 🔻 Zjednodušit…,
   po importu velkého STL se nabídne samo). Počítá worker (jadro/zjednoduseni.js, QEM);
   výsledek je nový zdroj geometrie, uzel zůstane na místě ve stejné velikosti, Zpět vrátí původní. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const $ = id => document.getElementById(id);
  const tis = n => Math.round(n).toLocaleString('cs');

  M.vytvorZjednoduseni = function () {
    const okno = document.createElement('dialog');
    okno.id = 'oknoZjednoduseni';
    okno.className = 'okno';
    okno.setAttribute('aria-labelledby', 'zjNadpis');
    okno.innerHTML = `<h2 id="zjNadpis">🔻 Zjednodušit síť</h2>
      <p class="poznamka" id="zjPuvodne"></p>
      <div class="radek"><label for="zjPomer">Ponechat</label><input id="zjPomer" type="range" min="1" max="100" step="1" value="20"><output id="zjProcenta" for="zjPomer"></output></div>
      <div class="radek"><label for="zjCil">Trojúhelníků</label><input id="zjCil" inputmode="numeric"></div>
      <label class="zaskrt"><input type="checkbox" id="zjOkraje" checked> Zachovat okraje otevřené sítě</label>
      <p class="poznamka">Zjednodušení slučuje hrany tam, kde se tvar skoro nemění (rovné plochy), a drží ostré hrany i uzavřenost sítě. Hodí se na skeny a modely z internetu, které mají zbytečně miliony trojúhelníků. Zpět (Ctrl+Z) vrátí původní síť.</p>
      <p class="chyba-text" id="zjChyba" aria-live="polite"></p>
      <div class="tlacitka"><button type="button" class="tl" id="zjZrusit">Zrušit</button><button type="button" class="tl hlavni-tl" id="zjOk">Zjednodušit</button></div>`;
    document.body.appendChild(okno);
    let uzelId = null, puvodne = 0;
    const cil = () => Math.max(4, Math.round(M.prectiCislo($('zjCil').value) || 0));
    const zPomeru = () => { $('zjCil').value = tis(puvodne * $('zjPomer').value / 100); $('zjProcenta').textContent = $('zjPomer').value + ' %'; };
    $('zjPomer').addEventListener('input', zPomeru);
    $('zjCil').addEventListener('change', () => {
      const c = Math.min(puvodne, cil());
      $('zjPomer').value = Math.max(1, Math.round(c / puvodne * 100));
      $('zjProcenta').textContent = $('zjPomer').value + ' %';
      $('zjCil').value = tis(c);
    });
    $('zjZrusit').onclick = () => okno.close();

    /** Otevře okno pro uzel id (importovaný model); doporuceno = předvolený cíl. */
    M.otevriZjednoduseni = function (id = M.app.vyber[0], doporuceno = null) {
      const u = M.najdiUzel(M.app.dok, id);
      if (!u || u.druh !== 'sit') { Dialog.chyba('Zjednodušit jde jen importovaný model (STL, OBJ, 3MF).'); return; }
      const z = M.zdroje.get(u.zdroj);
      if (!z) return;
      uzelId = id; puvodne = z.idx.length / 3;
      $('zjPuvodne').textContent = `„${u.nazev}“ má teď ${tis(puvodne)} trojúhelníků.`;
      const c = doporuceno || (puvodne > 250000 ? M.odhadZjednoduseni(puvodne) : Math.round(puvodne * 0.5));
      $('zjPomer').value = Math.max(1, Math.round(c / puvodne * 100));
      zPomeru();
      $('zjCil').value = tis(c);
      $('zjChyba').textContent = '';
      okno.showModal();
    };

    $('zjOk').onclick = async () => {
      const u = M.najdiUzel(M.app.dok, uzelId);
      if (!u) { okno.close(); return; }
      const z = M.sitZdroje(u.zdroj), c = Math.min(puvodne, cil());
      if (c >= puvodne) { okno.close(); return; }
      okno.close();
      const dok0 = M.app.dok;
      M.cekej('zjednodus', 'Zjednodušuji síť…', 0, 0);
      let r;
      try {
        r = await M.zjednodusSitVeWorkeru({ poz: z.poz, idx: z.idx }, { cil: c, zachovatOkraje: $('zjOkraje').checked },
          p => M.cekej('zjednodus', 'Zjednodušuji síť…', p, 0));
      } catch (e) { Dialog.chyba('Síť nejde zjednodušit: ' + e.message); return; }
      finally { M.hotovoCekani('zjednodus'); }
      if (M.app.dok !== dok0) { Dialog.info('Model se mezitím změnil – zjednodušení zahozeno, zkus to znovu.'); return; }
      // nová síť vycentrovaná v 0 (jako každý zdroj); uzel se posune o odchylku středu, velikost ve scéně zůstane
      const ob = M.obalkaSite(r);
      const c0 = [0, 1, 2].map(i => (ob.min[i] + ob.max[i]) / 2);
      for (let i = 0; i < r.poz.length; i += 3) for (let k = 0; k < 3; k++) r.poz[i + k] -= c0[k];
      const zaklad = [0, 1, 2].map(i => Math.max(0.01, ob.max[i] - ob.min[i]));
      const novyZdroj = M.pridejZdroj({ poz: r.poz, idx: r.idx }, z.nazev, z.format);
      const poloha = new THREE.Vector3(...c0).applyMatrix4(M.maticeUzlu(u)).toArray().map(x => Math.round(x * 1e6) / 1e6);
      const rozmer = zaklad.map((x, i) => x * u.rozmer[i] / u.zaklad[i]);
      M.zmenDokument(M.upravUzly(M.app.dok, [u.id], { zdroj: novyZdroj, zaklad, rozmer, poloha, jednobarevne: true }), 'Zjednodušit síť');
      Dialog.info(`Zjednodušeno z ${tis(r.puvodne)} na ${tis(r.ted)} trojúhelníků (odchylka asi ${M.mm(r.chyba || 0, 3)} mm).`);
    };

    /** Po importu: velký model nabídnout zjednodušit. */
    M.nabidniZjednoduseni = async function (uzly) {
      const velke = uzly.filter(u => u.druh === 'sit' && M.zdroje.has(u.zdroj) && M.zdroje.get(u.zdroj).idx.length / 3 > 500000);
      if (velke.length !== 1) return;
      const n = M.zdroje.get(velke[0].zdroj).idx.length / 3, c = M.odhadZjednoduseni(n);
      if (await Dialog.potvrd(`„${velke[0].nazev}“ má ${tis(n)} trojúhelníků – práce s ním bude pomalá. Zjednodušit na ${tis(c)}? (Tvar se viditelně nezmění.)`)) M.otevriZjednoduseni(velke[0].id, c);
    };
  };
})(MDL);
