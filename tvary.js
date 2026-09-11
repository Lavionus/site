/* ============================================================
   tvary.js – historie vytvořených tvarů (generátory trubek).

   Uloží aktuální nastavení stránky do localStorage pod názvem, umí je
   znovu načíst, přejmenovat, smazat a celou sbírku vyvézt/nahrát ze
   souboru JSON (localStorage se čistí spolu s daty webu, záloha je
   proto jediná pojistka proti ztrátě).

   Stránka modul připojí a dodá, co je pro ni specifické:

     const sbirka = Tvary.pripoj({
       klic: 'webapp_rozbocka_tvary',   // klíč v localStorage
       typ: 'rozbocka',                 // kontrola při nahrání zálohy
       nazev: 'Rozbočka',               // do názvu souboru zálohy
       kontejner: document.getElementById('tvary'),
       parametry: () => ({...}),        // co se má uložit
       pouzij: (p) => {...},            // nastavit stránku podle uloženého
       popis: (p) => '100 → 2× 40 mm',  // řádek v seznamu a návrh názvu
     });

     sbirka.aktivni()   → název naposledy uloženého/načteného tvaru (nebo null),
                          hodí se na pojmenování exportovaného STL/OBJ.

   Záznam: { id, nazev, vytvoreno, upraveno, parametry }.
   ============================================================ */
const Tvary = (function () {
  const VERZE = 1;

  function vlozStyl() {
    if (document.getElementById('tvary-styl')) return;
    const st = document.createElement('style');
    st.id = 'tvary-styl';
    st.textContent = `
.tvary{margin-top:15px;padding:15px;background-color:var(--border,#404040);border-radius:4px}
.tvary h3{font-size:.95rem;font-weight:600;margin:0 0 12px;color:var(--text,#e0e0e0)}
.tvary-radek{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
.tvary button{padding:8px 14px;border-radius:4px;cursor:pointer;font-size:.85rem;font-family:inherit;
  border:1px solid var(--border-strong,#4a4a4a);background:var(--bg-control,#383838);color:var(--text,#e0e0e0);
  transition:filter .2s ease}
.tvary button:hover{filter:brightness(1.15)}
.tvary button.hlavni{background:var(--accent,#6aa6fd);border-color:var(--accent,#6aa6fd);color:#fff;font-weight:600}
.tvary-seznam{display:flex;flex-direction:column;gap:6px;max-height:280px;overflow-y:auto}
.tvary-polozka{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:4px;
  background:var(--bg-elevated,#2d2d2d);border:1px solid var(--border-strong,#4a4a4a)}
.tvary-polozka.je-aktivni{border-color:var(--accent,#6aa6fd)}
.tvary-text{flex:1;min-width:0}
.tvary-nazev{font-size:.9rem;font-weight:600;color:var(--text,#e0e0e0);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tvary-podrobnosti{font-size:.78rem;color:var(--text-faint,#888)}
.tvary-akce{display:flex;gap:6px;flex-shrink:0}
.tvary-akce button{padding:5px 10px;font-size:.78rem}
.tvary-prazdno{font-size:.82rem;color:var(--text-faint,#888);line-height:1.5}
@media (max-width:560px){
  .tvary-polozka{flex-wrap:wrap}
  .tvary-akce{width:100%;justify-content:flex-end}
}`;
    (document.head || document.documentElement).appendChild(st);
  }

  function noveId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function datum(t) {
    try {
      return new Date(t).toLocaleString('cs-CZ', { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) {
      return '';
    }
  }

  // Poškozený nebo cizí obsah klíče se zahodí, ať stránka nespadne.
  function nacti(klic) {
    let syrove;
    try { syrove = localStorage.getItem(klic); } catch (e) { return []; }
    if (!syrove) return [];
    try {
      const data = JSON.parse(syrove);
      const pole = Array.isArray(data) ? data : data.polozky;
      if (!Array.isArray(pole)) return [];
      return pole.filter(z => z && typeof z === 'object' && z.parametry);
    } catch (e) {
      return [];
    }
  }

  function uloz(klic, polozky) {
    try {
      localStorage.setItem(klic, JSON.stringify({ verze: VERZE, polozky: polozky }));
      return true;
    } catch (e) {
      Dialog.chyba('Tvar se nepodařilo uložit — úložiště prohlížeče je plné nebo zakázané.');
      return false;
    }
  }

  function stahni(text, jmeno) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = jmeno;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function bezpecnyNazevSouboru(s) {
    return (s || 'tvary').replace(/[^\p{L}\p{N}._-]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'tvary';
  }

  function pripoj(cfg) {
    vlozStyl();
    let polozky = nacti(cfg.klic);
    let aktivniId = null;

    const korem = cfg.kontejner;
    korem.classList.add('tvary');
    korem.innerHTML = '';

    const nadpis = document.createElement('h3');
    nadpis.textContent = '💾 Uložené tvary';
    korem.appendChild(nadpis);

    const radek = document.createElement('div');
    radek.className = 'tvary-radek';
    const bUloz = document.createElement('button');
    bUloz.type = 'button';
    bUloz.className = 'hlavni';
    bUloz.textContent = 'Uložit tvar';
    const bVyvez = document.createElement('button');
    bVyvez.type = 'button';
    bVyvez.textContent = 'Záloha do souboru';
    const bNahraj = document.createElement('button');
    bNahraj.type = 'button';
    bNahraj.textContent = 'Načíst zálohu';
    const vstupSoubor = document.createElement('input');
    vstupSoubor.type = 'file';
    vstupSoubor.accept = 'application/json,.json';
    vstupSoubor.style.display = 'none';
    radek.append(bUloz, bVyvez, bNahraj, vstupSoubor);
    korem.appendChild(radek);

    const seznam = document.createElement('div');
    seznam.className = 'tvary-seznam';
    korem.appendChild(seznam);

    /* --- pomocné ------------------------------------------------------ */

    function navrhNazvu() {
      let zaklad;
      try { zaklad = cfg.popis(cfg.parametry()); } catch (e) { zaklad = ''; }
      zaklad = (zaklad || cfg.nazev || 'Tvar').trim();
      const obsazene = new Set(polozky.map(z => z.nazev));
      if (!obsazene.has(zaklad)) return zaklad;
      for (let i = 2; i < 999; i++) {
        if (!obsazene.has(zaklad + ' (' + i + ')')) return zaklad + ' (' + i + ')';
      }
      return zaklad + ' ' + noveId();
    }

    function vykresli() {
      seznam.innerHTML = '';
      if (!polozky.length) {
        const p = document.createElement('div');
        p.className = 'tvary-prazdno';
        p.textContent = 'Zatím nic uloženého. Nastavte rozměry a klepněte na „Uložit tvar“ — '
          + 'uloží se do tohoto prohlížeče a půjde kdykoli znovu načíst.';
        seznam.appendChild(p);
        return;
      }
      for (const z of polozky) {
        const r = document.createElement('div');
        r.className = 'tvary-polozka' + (z.id === aktivniId ? ' je-aktivni' : '');

        const text = document.createElement('div');
        text.className = 'tvary-text';
        const jm = document.createElement('div');
        jm.className = 'tvary-nazev';
        jm.textContent = z.nazev;
        const pod = document.createElement('div');
        pod.className = 'tvary-podrobnosti';
        let popis = '';
        try { popis = cfg.popis(z.parametry) || ''; } catch (e) { popis = ''; }
        pod.textContent = (popis ? popis + ' · ' : '') + datum(z.upraveno || z.vytvoreno);
        text.append(jm, pod);

        const akce = document.createElement('div');
        akce.className = 'tvary-akce';
        akce.append(
          tlacitko('Načíst', () => nactiTvar(z)),
          tlacitko('Přepsat', () => prepis(z)),
          tlacitko('Název', () => prejmenuj(z)),
          tlacitko('Smazat', () => smaz(z))
        );

        r.append(text, akce);
        seznam.appendChild(r);
      }
    }

    function tlacitko(popisek, akce) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = popisek;
      b.addEventListener('click', akce);
      return b;
    }

    function zapis() {
      polozky.sort((a, b) => (b.upraveno || b.vytvoreno || 0) - (a.upraveno || a.vytvoreno || 0));
      uloz(cfg.klic, polozky);
      vykresli();
    }

    /* --- akce --------------------------------------------------------- */

    async function ulozNovy() {
      let parametry;
      try {
        parametry = cfg.parametry();
      } catch (e) {
        Dialog.chyba('Tvar se nepodařilo přečíst: ' + e.message);
        return;
      }
      if (!parametry) return;                 // stránka řekla, že nastavení není platné

      const navrh = navrhNazvu();
      const zadano = await Dialog.zeptej('Název tvaru', navrh, { ok: 'Uložit' });
      if (zadano === null) return;            // zrušeno
      const nazev = (zadano || '').trim() || navrh;

      const stejny = polozky.find(z => z.nazev === nazev);
      if (stejny && !await Dialog.potvrd('Tvar „' + nazev + '“ už existuje. Přepsat ho?',
                                         { ok: 'Přepsat' })) return;

      if (stejny) {
        stejny.parametry = parametry;
        stejny.upraveno = Date.now();
        aktivniId = stejny.id;
      } else {
        const z = { id: noveId(), nazev: nazev, vytvoreno: Date.now(), upraveno: Date.now(), parametry: parametry };
        polozky.push(z);
        aktivniId = z.id;
      }
      zapis();
      Dialog.info('Uloženo jako „' + nazev + '“');
    }

    function nactiTvar(z) {
      try {
        cfg.pouzij(JSON.parse(JSON.stringify(z.parametry)));
      } catch (e) {
        Dialog.chyba('Tvar se nepodařilo načíst: ' + e.message);
        return;
      }
      aktivniId = z.id;
      vykresli();
      Dialog.info('Načteno: ' + z.nazev);
    }

    async function prepis(z) {
      if (!await Dialog.potvrd('Přepsat „' + z.nazev + '“ současným nastavením?', { ok: 'Přepsat' })) return;
      let parametry;
      try { parametry = cfg.parametry(); } catch (e) { Dialog.chyba(e.message); return; }
      if (!parametry) return;
      z.parametry = parametry;
      z.upraveno = Date.now();
      aktivniId = z.id;
      zapis();
      Dialog.info('Přepsáno: ' + z.nazev);
    }

    async function prejmenuj(z) {
      const novy = await Dialog.zeptej('Nový název', z.nazev, { ok: 'Přejmenovat' });
      if (novy === null) return;
      const nazev = novy.trim();
      if (!nazev || nazev === z.nazev) return;
      if (polozky.some(j => j !== z && j.nazev === nazev)) {
        Dialog.chyba('Tvar s tímto názvem už existuje.');
        return;
      }
      z.nazev = nazev;
      z.upraveno = Date.now();
      zapis();
    }

    async function smaz(z) {
      if (!await Dialog.potvrd('Smazat tvar „' + z.nazev + '“?', { ok: 'Smazat' })) return;
      polozky = polozky.filter(j => j !== z);
      if (aktivniId === z.id) aktivniId = null;
      zapis();
      Dialog.info('Smazáno');
    }

    function vyvez() {
      if (!polozky.length) { Dialog.chyba('Není co zálohovat — zatím nemáte uložený žádný tvar.'); return; }
      const data = { verze: VERZE, typ: cfg.typ, vytvoreno: new Date().toISOString(), polozky: polozky };
      const den = new Date().toISOString().slice(0, 10);
      stahni(JSON.stringify(data, null, 2), bezpecnyNazevSouboru(cfg.nazev) + '_tvary_' + den + '.json');
      Dialog.info('Záloha stažena (' + polozky.length + ' ' + (polozky.length === 1 ? 'tvar' : 'tvarů') + ')');
    }

    async function nahraj(soubor) {
      let data;
      try {
        data = JSON.parse(await soubor.text());
      } catch (e) {
        Dialog.chyba('Soubor není platný JSON.');
        return;
      }
      const nove = Array.isArray(data) ? data : (data && data.polozky);
      if (!Array.isArray(nove) || !nove.length) { Dialog.chyba('V souboru nejsou žádné tvary.'); return; }
      if (data.typ && cfg.typ && data.typ !== cfg.typ) {
        if (!await Dialog.potvrd('Záloha je z jiného generátoru (' + data.typ + '). Nahrát i tak?',
                                 { ok: 'Nahrát' })) return;
      }

      let pridano = 0;
      for (const z of nove) {
        if (!z || typeof z !== 'object' || !z.parametry) continue;
        let nazev = String(z.nazev || 'Tvar').trim() || 'Tvar';
        // stejné jméno nepřepisovat, ale odlišit — záloha se má přidat, ne mazat
        if (polozky.some(j => j.nazev === nazev)) {
          let i = 2;
          while (polozky.some(j => j.nazev === nazev + ' (' + i + ')')) i++;
          nazev = nazev + ' (' + i + ')';
        }
        polozky.push({
          id: noveId(),
          nazev: nazev,
          vytvoreno: z.vytvoreno || Date.now(),
          upraveno: z.upraveno || z.vytvoreno || Date.now(),
          parametry: z.parametry
        });
        pridano++;
      }
      if (!pridano) { Dialog.chyba('V souboru nejsou žádné použitelné tvary.'); return; }
      zapis();
      Dialog.info('Nahráno ' + pridano + ' ' + (pridano === 1 ? 'tvar' : 'tvarů'));
    }

    bUloz.addEventListener('click', ulozNovy);
    bVyvez.addEventListener('click', vyvez);
    bNahraj.addEventListener('click', () => vstupSoubor.click());
    vstupSoubor.addEventListener('change', () => {
      const s = vstupSoubor.files && vstupSoubor.files[0];
      vstupSoubor.value = '';                 // aby šel stejný soubor vybrat znovu
      if (s) nahraj(s);
    });

    vykresli();

    return {
      aktivni: () => {
        const z = polozky.find(j => j.id === aktivniId);
        return z ? z.nazev : null;
      },
      obnov: vykresli
    };
  }

  return { pripoj: pripoj, nazevSouboru: bezpecnyNazevSouboru };
})();
