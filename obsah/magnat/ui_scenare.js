/* Dopravní magnát – scénáře, výzva dne, výuka a zvuk v prohlížeči.
   Načítá se po ui_prehledy.js a před ui.js; obaluje U.poKroku a U.klikVozidlo. */
(function () {
  'use strict';
  const MAG = window.MAG, D = MAG.data, H = MAG.hra, S = MAG.scenare, Z = MAG.zvuk;
  const U = MAG.UI;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KLIC_SC = 'webapp_hra_magnat_scenare', KLIC_ZV = 'webapp_hra_magnat_zvuk';
  const cti = k => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch (e) { return {}; } };
  const pis = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bez úložiště */ } };
  const kratke = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + ' mil.' : n >= 1e4 ? Math.round(n / 1e3) + ' tis.' : Math.round(n).toLocaleString('cs-CZ');

  // --- zvuk: nastavení a události ---------------------------------------------------------------------
  Object.assign(Z.nast, { zvuk: true, hudba: false, hlasitost: 0.6 }, cti(KLIC_ZV));
  Z.nastav({});
  U.hraj = jm => Z.hraj(jm);
  function oznacZvuk() {
    $('miZvuk').setAttribute('aria-pressed', String(!!Z.nast.zvuk));
    $('miHudba').setAttribute('aria-pressed', String(!!Z.nast.hudba));
    $('hlasitost').value = Math.round(Z.nast.hlasitost * 100);
  }
  $('miZvuk').addEventListener('click', () => { Z.nastav({ zvuk: !Z.nast.zvuk }); pis(KLIC_ZV, Z.nast); oznacZvuk(); Z.hraj('klik'); });
  $('miHudba').addEventListener('click', () => {
    Z.nastav({ hudba: !Z.nast.hudba }); pis(KLIC_ZV, Z.nast); oznacZvuk();
    if (Z.nast.hudba && U.hra) Z.hudba(true, H.rok(U.hra));
  });
  $('hlasitost').addEventListener('input', e => { Z.nastav({ hlasitost: e.target.value / 100 }); pis(KLIC_ZV, Z.nast); });
  // první gesto odemkne zvuk (pravidla prohlížečů)
  document.addEventListener('pointerdown', function prvni() {
    document.removeEventListener('pointerdown', prvni);
    Z.odemkni();
    if (Z.nast.hudba && U.hra) Z.hudba(true, H.rok(U.hra));
  });
  const ZVUK_VOZIDLA = v => v.druh === 'vlak' ? (D.VOZIDLA_PODLE_ID[v.typ].trakce === 'para' ? 'vlak' : 'diesel') : v.druh;
  const klikV = U.klikVozidlo;
  U.klikVozidlo = (v, p) => { Z.hraj(ZVUK_VOZIDLA(v)); klikV(v, p); };

  // --- scénáře -------------------------------------------------------------------------------------------
  function oknoScenaru() {
    const nej = cti(KLIC_SC), tel = document.createElement('div'); tel.className = 'scenare';
    const vyzva = S.vyzvaDne(new Date());
    for (const d of [vyzva, ...S.SCENARE]) {
      const b = document.createElement('div'); b.className = 'scenar' + (d.dne ? ' dne' : '');
      const vysl = nej[d.id];
      b.innerHTML = `<div><b>${d.dne ? '📅 ' : '🎯 '}${esc(d.nazev)}</b> <small>${d.rok}–${d.do} · mapa ${d.mapa.velikost}²</small></div>
        <small>${esc(d.popis)}</small>
        <ul>${d.cile.map(c => `<li>${esc(S.NAZEV_CILE(c))}</li>`).join('')}</ul>
        ${vysl ? `<small class="vysl">🏆 Nejlepší skóre ${vysl.skore.toLocaleString('cs-CZ')}</small>` : ''}`;
      b.append(U.tlacitko('▶ Hrát', async () => {
        if (U.hra && U.hra.den > 0 && !(await Dialog.potvrd(`Začít scénář „${d.nazev}“? Rozehraná hra se ztratí, pokud ji neuložíš do pozice.`))) return;
        U.zavriVsechnaOkna();
        $('nacitani').hidden = false;
        setTimeout(() => { U.zacniHru(S.zacni(d)); U.zprava(`🎯 ${d.nazev}: ${d.cile.map(S.NAZEV_CILE).join(', ')} do konce roku ${d.do}.`); }, 20);
      }));
      tel.append(b);
    }
    U.okno('scenare', '🎯 Scénáře', tel, [10, 10]);
  }
  function oknoCile() {
    const h = U.hra, s = h.scenar;
    if (!s) return;
    const tel = document.createElement('div');
    tel.innerHTML = `<p>${esc(s.popis || '')}</p><p>Termín: <b>konec roku ${s.do}</b>${s.splneno !== null ? ' · <b>✓ splněno</b>' : s.neuspech ? ' · <b class="minus">čas vypršel</b>' : ''}</p>`
      + s.cile.map(c => { const p = S.postup(h, c); return `<div class="cil"><span>${esc(S.NAZEV_CILE(c))}</span><span class="hodn" style="--h:${Math.round(p.podil * 100)}%">${kratke(p.x)} / ${kratke(p.n)}</span></div>`; }).join('');
    U.okno('cil', `🎯 ${s.nazev}`, tel, [10, 10]);
  }
  function aktualizujCil() {
    const h = U.hra, el = $('stScenar');
    if (!h || !h.scenar) { el.hidden = true; return; }
    const s = h.scenar, p = s.cile.map(c => S.postup(h, c));
    const pod = p.reduce((a, x) => a + x.podil, 0) / p.length;
    el.hidden = false;
    el.textContent = s.splneno !== null ? `🏁 ${s.nazev}: splněno` : s.neuspech ? `⌛ ${s.nazev}: čas vypršel` : `🎯 ${Math.round(pod * 100)} % · do ${s.do}`;
  }
  $('stScenar').addEventListener('click', oknoCile);
  $('miScenare').addEventListener('click', oknoScenaru);

  // --- výuka ---------------------------------------------------------------------------------------------
  const panel = document.createElement('div'); panel.className = 'vyuka'; panel.hidden = true;
  panel.innerHTML = '<div class="vy-krok"></div><div class="vy-text"></div><div class="vy-tl"></div>';
  $('plocha').append(panel);
  const konecVyuky = document.createElement('button'); konecVyuky.textContent = 'Ukončit výuku';   // U.tlacitko ještě není (ui.js se načte až potom)
  konecVyuky.addEventListener('click', () => { if (U.hra) U.hra.vyuka = null; obnovVyuku(); });
  panel.querySelector('.vy-tl').append(konecVyuky);
  let zvyraznene = [];
  function obnovVyuku(hotovyKrok) {
    zvyraznene.forEach(e => e.classList.remove('zvyraznit')); zvyraznene = [];
    const h = U.hra, k = hotovyKrok || (h && S.krokVyuky(h));
    if (!k) { panel.hidden = true; return; }
    if (k.konec) {
      panel.hidden = false;
      panel.querySelector('.vy-krok').textContent = '🎓 Výuka hotová';
      panel.querySelector('.vy-text').textContent = 'Výborně! První linka vydělává. Dál zkus nákladní auta (T) u dolu a elektrárny, železnici (K, ⇧S, J) nebo scénáře v nabídce Hra.';
      Z.hraj('oslava');
      setTimeout(() => { if (!U.hra || U.hra.vyuka === null) panel.hidden = true; }, 12000);
      return;
    }
    panel.hidden = false;
    panel.querySelector('.vy-krok').textContent = `🎓 Výuka – krok ${k.k + 1} z ${k.celkem}`;
    panel.querySelector('.vy-text').textContent = k.text;
    if (k.nastroj) {
      for (const el of [document.querySelector('[data-nabidka="nabStavba"]'), document.querySelector(`[data-nastroj="${k.nastroj}"]`)]) if (el) { el.classList.add('zvyraznit'); zvyraznene.push(el); }
    }
  }
  let posledniKrok = -1;
  setInterval(() => {
    const h = U.hra;
    if (!h || (h.vyuka === undefined)) { if (!panel.hidden && (!h || h.vyuka === undefined)) panel.hidden = true; return; }
    if (h.vyuka === null) return;
    const k = S.krokVyuky(h);   // posune h.vyuka přes splněné kroky; {konec} vrátí jen jednou → předat dál
    if (k && k.konec) { posledniKrok = -1; obnovVyuku(k); return; }
    if (h.vyuka !== posledniKrok) { if (posledniKrok >= 0) Z.hraj('oslava'); posledniKrok = h.vyuka; obnovVyuku(k); }
  }, 600);
  $('miVyuka').addEventListener('click', async () => {
    if (U.hra && U.hra.den > 0 && !(await Dialog.potvrd('Začít výuku na nové malé mapě? Rozehraná hra se ztratí, pokud ji neuložíš do pozice.'))) return;
    U.zavriVsechnaOkna();
    $('nacitani').hidden = false;
    setTimeout(() => {
      const h = H.novaHra(MAG.mapa.generuj(S.VYUKA_MAPA.seed, S.VYUKA_MAPA), { rok: 1950 });
      h.vyuka = 0; posledniKrok = -1;
      U.zacniHru(h);
      U.nastavRychlost(1);
      obnovVyuku();
    }, 20);
  });

  // --- háčky: zvuky událostí, cíl scénáře, rekordy, hudba podle doby --------------------------------------
  const puvodni = U.poKroku;
  let rokHudby = 0;
  U.poKroku = (h, novyDen) => {
    for (const z of h.zpravy) {
      if (z.penize) Z.hraj('penize');
      else if (z.noviny) {
        Z.hraj(z.noviny.uspech || z.noviny.scenar ? 'oslava' : 'noviny');
        if (z.noviny.scenar && z.noviny.skore && h.scenar) {
          const nej = cti(KLIC_SC);
          if (!nej[h.scenar.id] || nej[h.scenar.id].skore < z.noviny.skore) { nej[h.scenar.id] = { skore: z.noviny.skore, kdy: Date.now() }; pis(KLIC_SC, nej); }
        }
      } else if (z.text && z.text.startsWith('💥')) Z.hraj('porucha');
    }
    if (puvodni) puvodni(h, novyDen);
    if (novyDen) {
      aktualizujCil();
      const r = H.rok(h);
      if (r !== rokHudby && Z.nast.hudba) { rokHudby = r; Z.hudba(false); Z.hudba(true, r); }
    }
  };
  const poNacteni = U.poNacteni;
  U.poNacteni = h => { if (poNacteni) poNacteni(h); aktualizujCil(); posledniKrok = h.vyuka ?? -1; obnovVyuku(); };
  oznacZvuk();
  Object.assign(U, { oknoScenaru, oknoCile });
})();
