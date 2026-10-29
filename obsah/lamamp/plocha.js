/* Lamamp – složky s hudbou na ploše (WA_PLOCHA): ikony ve stylu Windows 98 vedle oken přehrávače.
   Složka je buď zástupce složky na disku (File System Access API – Chrome/Edge na počítači; nic se nekopíruje,
   po obnovení stránky se jen potvrdí přístup), nebo kopie skladeb v prohlížeči (IndexedDB – iPhone, Firefox, Safari).
   Dvojklik / dvojí ťuknutí složku přehraje, přetažením na playlist se přidá, na hlavní okno přehraje. */
(function () {
  'use strict';

  const umiDisk = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  // ---------- kresba ikony 32×32 ----------
  const BARVY = [
    ['Žlutá', '#fff3a0', '#f4d03f', '#b8901c', '#4a3300'],
    ['Modrá', '#c4e0ff', '#4a90e2', '#2a5aa0', '#0d2347'],
    ['Zelená', '#d0f7b8', '#5cc04a', '#2f7a24', '#12340c'],
    ['Červená', '#ffc8b8', '#e05a40', '#a02c1c', '#3d0d06'],
    ['Fialová', '#ecd0ff', '#a060e0', '#6430a0', '#260d40'],
    ['Šedá', '#ffffff', '#c0c0c0', '#808080', '#202020']
  ];
  function kresliIkonu(g, barva, { zastupce = false, hraje = false, plus = false, vybrana = false } = {}) {
    const [, L, Z, D, O] = BARVY[barva] || BARVY[0];
    const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    g.clearRect(0, 0, 32, 32);
    // stín pod složkou
    R(4, 28, 27, 1, 'rgba(0,0,0,.35)'); R(30, 10, 1, 18, 'rgba(0,0,0,.35)');
    // ouško
    R(4, 5, 8, 1, O); R(3, 6, 1, 3, O); R(12, 6, 1, 3, O); R(4, 6, 8, 3, Z); R(4, 6, 8, 1, L);
    // tělo
    R(2, 8, 28, 1, O); R(2, 27, 28, 1, O); R(2, 8, 1, 20, O); R(29, 8, 1, 20, O);
    R(3, 9, 26, 18, Z);
    R(3, 9, 26, 1, L); R(3, 9, 1, 17, L); R(3, 26, 26, 1, D); R(28, 10, 1, 17, D);
    R(3, 12, 26, 1, D); R(3, 13, 26, 1, L);   // přední klopa
    // dvě noty spojené trámcem
    const N = O;
    for (const [hx, sy] of [[10, 15], [17, 13]]) {
      R(hx + 1, sy + 7, 2, 1, N); R(hx, sy + 8, 4, 1, N); R(hx + 1, sy + 9, 2, 1, N);
      R(hx + 3, sy, 1, 8, N);
    }
    for (let x = 13; x <= 20; x++) { const y = 15 - Math.round((x - 13) * 2 / 7); R(x, y, 1, 2, N); }
    if (zastupce) {   // šipka zástupce vlevo dole
      R(0, 22, 10, 10, '#000'); R(1, 23, 8, 8, '#fff');
      R(3, 25, 4, 1, '#000'); R(6, 25, 1, 4, '#000'); R(5, 26, 1, 1, '#000'); R(4, 27, 1, 1, '#000'); R(3, 28, 1, 1, '#000');
    }
    if (plus) { R(20, 17, 11, 11, '#0a3a0a'); R(21, 18, 9, 9, '#3cd83c'); R(24, 19, 3, 7, '#fff'); R(22, 21, 7, 3, '#fff'); }
    if (hraje) {   // zelený trojúhelník přehrávání vpravo nahoře
      R(22, 0, 9, 10, '#0a3a0a');
      for (let j = 0; j < 8; j++) R(24, 1 + j, Math.min(j, 7 - j) + 1, 1, '#3cff3c');
    }
    if (vybrana) {   // vybraná ikona: šachovnice tmavomodré přes kresbu jako ve Windows 98
      const d = g.getImageData(0, 0, 32, 32);
      for (let y = 0; y < 32; y++) for (let x = (y & 1); x < 32; x += 2) {
        const i = (y * 32 + x) * 4;
        if (d.data[i + 3] > 200) { d.data[i] = 0; d.data[i + 1] = 0; d.data[i + 2] = 128; }
      }
      g.putImageData(d, 0, 0);
    }
  }

  // ---------- rozmístění: vedle oken vpravo, jinak vlevo, jinak pod ně ----------
  function rozmistiAuto(n, ob, pl, b) {
    const v = [], okraj = 12, dole = 40;   // dole lišta s podpisem webu
    const vyskaPlochy = pl.h - dole;
    if (!ob) ob = { left: 0, top: 0, right: 0, bottom: 0 };
    // sloupce v pruhu x0..x1; vrací, kolik ikon se vešlo
    const sloupce = (x0, x1) => {
      const radku = Math.max(1, Math.floor((vyskaPlochy - okraj) / b.h)), sl = Math.max(1, Math.floor((x1 - x0) / b.w));
      const m = Math.min(n, radku * sl);
      for (let i = 0; i < m; i++) v.push({ x: x0 + Math.floor(i / radku) * b.w, y: okraj + (i % radku) * b.h });
      return m;
    };
    let hotovo = 0;
    if (pl.w - ob.right - 16 >= b.w) hotovo = sloupce(ob.right + 16, pl.w - okraj);
    else if (ob.left - 16 >= b.w) hotovo = sloupce(okraj, ob.left - 16);
    if (hotovo < n) {   // zbytek (nebo vše na úzkém displeji) v řádcích pod okny
      const podSloupci = v.length ? Math.max(...v.map(p => p.y)) + b.h : 0;   // řada nesmí vjet do sloupce vedle oken
      const y0 = Math.max(podSloupci, Math.min(ob.bottom + 10, Math.max(okraj, vyskaPlochy - b.h)));
      const naRadek = Math.max(1, Math.floor((pl.w - 2 * okraj) / b.w));
      for (let i = 0; i < n - hotovo; i++) v.push({ x: okraj + (i % naRadek) * b.w, y: y0 + Math.floor(i / naRadek) * b.h });
    }
    return v;
  }

  // ---------- ovládání plochy ----------
  function vytvor(api) {
    const { U, J } = api;
    const kontejner = api.kontejner;
    let slozky = [], vybrana = null;
    const prvky = new Map();   // id → { el, platno, popisek }
    const NOVA = { id: '_nova', nazev: 'Přidat složku', typ: 'akce', barva: 2 };

    let nacteno = false;   // dokud se složky nenačetly, nic se neukládá (prázdný seznam by přepsal uložené)
    async function nacti(pokus = 0) {
      try { slozky = (await U.cti('kv', 'slozky')) || []; nacteno = true; }
      catch (e) {
        if (pokus < 4) setTimeout(() => nacti(pokus + 1), 3000 * (pokus + 1));
        else api.oznam('SLOZKY NA PLOSE SE NEDAJI NACIST', 5000);
      }
      obnov();
      return nacteno;
    }
    const uloz = () => nacteno ? U.zapis('kv', 'slozky', slozky).catch(() => api.oznam('SLOZKY SE NEULOZILY', 3000)) : Promise.resolve();
    const najdi = id => slozky.find(s => s.id === id);

    // přístup ke složce na disku (po obnovení stránky ho prohlížeč potvrdí na kliknutí)
    let chybiPovoleni = false;   // poslední pokus o přístup ke složce na disku selhal (bez kliknutí uživatele)
    async function povol(sl) {
      try {
        chybiPovoleni = !(await sl.handle.queryPermission({ mode: 'read' }) === 'granted' || await sl.handle.requestPermission({ mode: 'read' }) === 'granted');
      } catch (e) { chybiPovoleni = true; }
      if (chybiPovoleni) api.oznam('KLIKNI ZNOVU - PRISTUP KE SLOZCE', 3000);
      return !chybiPovoleni;
    }
    async function projdiDisk(sl, jenPocet = false) {
      const vysl = []; let pocet = 0;
      async function projdi(dir, cesta) {
        for await (const [jm, h] of dir.entries()) {
          if (jm.startsWith('.')) continue;
          if (h.kind === 'directory') await projdi(h, cesta + jm + '/');
          else if (J.jeZvuk(jm) || J.jeSeznam(jm)) {
            if (J.jeZvuk(jm)) pocet++;
            if (jenPocet) continue;
            const f = await h.getFile();
            f._slozka = sl.id; f._rel = cesta + jm; f._cesta = sl.nazev + '/' + cesta + jm;
            vysl.push(f);
          }
        }
      }
      await projdi(sl.handle, '');
      return jenPocet ? pocet : vysl;
    }
    // soubory složky pro playlist (každý nese _slozka a _rel, aby se po obnovení stránky dal najít znovu)
    async function soubory(sl) {
      if (sl.typ === 'disk') {
        if (!(await povol(sl))) return null;
        try { const f = await projdiDisk(sl); sl.pocet = f.filter(x => J.jeZvuk(x.name)).length; uloz(); return f; }
        catch (e) { api.oznam('SLOZKA NA DISKU NENI DOSTUPNA', 3500); return null; }
      }
      const vysl = [];
      for (const z of sl.soubory || []) {
        const b = await U.cti('soubory', z.klic).catch(() => null);
        if (!b) continue;
        const f = b instanceof File ? b : new File([b], z.rel.split('/').pop(), { type: b.type });   // uloženo jako Blob (Safari)
        f._slozka = sl.id; f._rel = z.rel; f._blobKlic = z.klic; f._cesta = sl.nazev + '/' + z.rel;
        vysl.push(f);
      }
      return vysl;
    }
    // jedna skladba z playlistu po obnovení stránky
    async function souborPolozky(p) {
      const sl = najdi(p.slozka);
      if (!sl) return null;
      try {
        if (sl.typ !== 'disk') return await U.cti('soubory', p.blobKlic);
        if (!(await povol(sl))) return null;
        const casti = p.rel.split('/'); let dir = sl.handle;
        for (const c of casti.slice(0, -1)) dir = await dir.getDirectoryHandle(c);
        return await (await dir.getFileHandle(casti[casti.length - 1])).getFile();
      } catch (e) { return null; }
    }

    async function prehraj(sl, { pridat = false, nahodne = false } = {}) {
      api.oznam('NACITAM SLOZKU: ' + J.bezDiakritiky(sl.nazev).toUpperCase(), 1500);
      const f = await soubory(sl);
      if (!f) return;
      if (!f.some(x => J.jeZvuk(x.name))) { api.oznam('VE SLOZCE NENI HUDBA', 3000); return; }
      sl.naposledy = Date.now(); uloz();
      await api.pridejSoubory(f, { akce: pridat ? 'pridat' : 'otevrit', nahodne });
      obnov();
    }

    // nová složka: zástupce složky na disku, jinak kopie vybraných skladeb v prohlížeči
    async function novaSlozka() {
      if (U.jenCteni) return api.oznam('OTEVRENO V JINE ZALOZCE - SLOZKY JDOU PRIDAT TAM', 4000);
      if (umiDisk()) {
        let h;
        try { h = await window.showDirectoryPicker({ id: 'lamamp-hudba', mode: 'read' }); } catch (e) { return; }
        return pridejDisk([h]);
      }
      if (!api.nast.tipKopie) {
        api.nast.tipKopie = true; api.ulozNast();
        await api.dialog98('Nová složka', '<p>Tento prohlížeč neumí odkazovat na složky na disku, takže se vybrané skladby <b>zkopírují do prohlížeče</b> a budou zabírat místo.</p>' +
          '<p class="m98-pozn">Na počítači v Chrome nebo Edge je složka jen zástupce – nic se nekopíruje.</p>', ['Pokračovat']);
      }
      const f = await api.vyberSoubory();
      if (!f || !f.length) return;
      const spolecna = (f[0].webkitRelativePath || '').split('/')[0];
      const nazev = await api.zeptej('Název složky', spolecna || 'Moje hudba');
      if (nazev) await pridejKopii(nazev, f);
    }
    async function pridejKopii(nazev, f) {
      const sl = { id: J.noveId(), nazev, typ: 'kopie', barva: slozky.length % BARVY.length, soubory: [], pocet: 0 };
      slozky.push(sl); vybrana = sl.id; obnov();
      await kopiruj(sl, f);
      return sl;
    }
    async function kopiruj(sl, f) {
      const zvuk = f.filter(x => J.jeZvuk(x.name, x.type));
      let i = 0;
      await uloz();   // složka uložená hned – při zavření stránky uprostřed kopírování nezůstanou sirotci
      for (const x of zvuk) {
        if (!slozky.includes(sl)) return;   // mezitím odebrána
        const klic = 'sl:' + sl.id + ':' + J.noveId();
        if (U.jenCteni) { api.oznam('OTEVRENO V JINE ZALOZCE - NEUKLADA SE', 4000); break; }
        try { await U.zapis('soubory', klic, await U.proUlozeni(x)); }
        catch (e) { api.oznam('PLNE ULOZISTE - ZKOPIROVANO ' + i, 5000); break; }
        if (!slozky.includes(sl)) { U.smaz('soubory', klic).catch(() => {}); return; }
        sl.soubory.push({ klic, rel: (x.webkitRelativePath || x.name).replace(/^[^/]*\//, '') || x.name });
        if (++i % 3 === 0) { api.oznam(`KOPIRUJI ${i}/${zvuk.length}`, 1500); sl.pocet = sl.soubory.length; uloz(); }
      }
      sl.pocet = sl.soubory.length;
      api.U.trvale();
      await uloz(); obnov();
      api.oznam(`SLOZKA ${J.bezDiakritiky(sl.nazev).toUpperCase()}: ${sl.pocet} SKLADEB`, 2500);
    }
    async function pridejDisk(handly) {
      for (const h of handly) {
        if (!h || h.kind !== 'directory') continue;
        let uz = null;
        for (const sl of slozky) if (sl.typ === 'disk' && await sl.handle.isSameEntry(h).catch(() => false)) uz = sl;
        if (uz) { vybrana = uz.id; api.oznam('TAHLE SLOZKA UZ NA PLOSE JE', 2500); continue; }
        const sl = { id: J.noveId(), nazev: h.name, typ: 'disk', handle: h, barva: slozky.length % BARVY.length, pocet: null };
        slozky.push(sl); vybrana = sl.id;
        projdiDisk(sl, true).then(n => { sl.pocet = n; uloz(); obnov(); }).catch(() => {});
      }
      await uloz(); obnov();
    }

    async function odeber(sl) {
      const text = sl.typ === 'disk' ? `Odebrat složku „${sl.nazev}“ z plochy? Soubory na disku zůstanou.` : `Smazat složku „${sl.nazev}“ i její skladby uložené v prohlížeči?`;
      if (!(await api.potvrd(text))) return;
      slozky = slozky.filter(x => x !== sl);
      for (const z of sl.soubory || []) U.smaz('soubory', z.klic).catch(() => {});
      api.odebranaSlozka(sl.id);   // její skladby z playlistu pryč (po obnovení stránky by nešly přehrát)
      await uloz(); obnov();
    }
    async function prejmenuj(sl) {
      const n = await api.zeptej('Přejmenovat složku', sl.nazev);
      if (n) { sl.nazev = n; await uloz(); obnov(); }
    }
    async function pridejDoKopie(sl) {
      const f = await api.vyberSoubory();
      if (f && f.length) await kopiruj(sl, f);
    }
    function info(sl) {
      const typ = sl.typ === 'disk' ? 'zástupce složky na disku (nic se nekopíruje)' : 'kopie skladeb v prohlížeči';
      api.dialog98('Vlastnosti složky', `<div class="d98-o"><canvas id="d98-ikona" width="32" height="32"></canvas><table class="d98-info"><tbody>
        <tr><th>Název</th><td>${api.esc(sl.nazev)}</td></tr><tr><th>Druh</th><td>${typ}</td></tr>
        <tr><th>Skladeb</th><td>${sl.pocet ?? '…'}</td></tr>
        ${sl.naposledy ? `<tr><th>Naposledy</th><td>${new Date(sl.naposledy).toLocaleString('cs-CZ')}</td></tr>` : ''}</tbody></table></div>`, ['OK'],
        d => kresliIkonu(d.querySelector('#d98-ikona').getContext('2d'), sl.barva, { zastupce: sl.typ === 'disk' }));
    }
    function menuIkony(sl, x, y) {
      if (sl === NOVA) return api.otevriMenu([{ text: 'Přidat složku s hudbou…', akce: novaSlozka }], x, y);
      api.otevriMenu([
        { text: 'Přehrát', klavesa: 'Enter', akce: () => prehraj(sl) },
        { text: 'Zamíchat a přehrát', akce: () => prehraj(sl, { nahodne: true }) },
        { text: 'Přidat do playlistu', akce: () => prehraj(sl, { pridat: true }) },
        '-',
        ...(sl.typ === 'disk' ? [{ text: 'Spočítat skladby znovu', akce: async () => { if (await povol(sl)) { sl.pocet = await projdiDisk(sl, true).catch(() => sl.pocet); uloz(); obnov(); } } }]
          : [{ text: 'Přidat skladby do složky…', akce: () => pridejDoKopie(sl) }]),
        { text: 'Barva', podmenu: BARVY.map(([n], i) => ({ text: n, zaskrtnuto: sl.barva === i, akce: () => { sl.barva = i; uloz(); obnov(); } })) },
        { text: 'Přejmenovat…', klavesa: 'F2', akce: () => prejmenuj(sl) },
        { text: 'Odebrat z plochy', klavesa: 'Del', akce: () => odeber(sl) },
        '-',
        { text: 'Vlastnosti', akce: () => info(sl) }
      ], x, y);
    }
    function menuPlochy(x, y) {
      api.otevriMenu([
        { text: 'Nová složka s hudbou…', akce: novaSlozka },
        { text: 'Seřadit ikony', akce: () => { slozky.forEach(sl => { delete sl.x; delete sl.y; }); uloz(); obnov(); }, zakazano: !slozky.length },
        '-',
        ...api.menuPozadi()
      ], x, y);
    }

    // ---------- DOM ikon ----------
    function prvek(sl) {
      if (prvky.has(sl.id)) return prvky.get(sl.id);
      const el = document.createElement('div');
      el.className = 'ikona'; el.tabIndex = 0; el.setAttribute('role', 'button');
      el.dataset.id = sl.id;
      const platno = document.createElement('canvas'), popisek = document.createElement('span');
      popisek.className = 'popisek';
      el.append(platno, popisek);
      kontejner.appendChild(el);
      const p = { el, platno, popisek, sl };
      prvky.set(sl.id, p);
      napojUdalosti(p);
      return p;
    }
    let tah = null, posledni = null;
    function napojUdalosti(p) {
      const el = p.el;
      el.addEventListener('pointerdown', e => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        e.stopPropagation();
        vyber(p.sl.id);
        el.setPointerCapture(e.pointerId);
        tah = { p, sx: e.clientX, sy: e.clientY, x0: el.offsetLeft, y0: el.offsetTop, pohnuto: false, dotyk: e.pointerType !== 'mouse' };
        if (tah.dotyk) tah.casovac = setTimeout(() => { if (tah && !tah.pohnuto) { const t = tah; tah = null; menuIkony(t.p.sl, t.sx, t.sy); } }, 550);
      });
      el.addEventListener('pointermove', e => {
        if (!tah || tah.p !== p) return;
        const dx = e.clientX - tah.sx, dy = e.clientY - tah.sy;
        if (!tah.pohnuto && Math.abs(dx) + Math.abs(dy) < 6) return;
        tah.pohnuto = true; clearTimeout(tah.casovac);
        el.classList.add('tazena');
        el.style.left = (tah.x0 + dx) + 'px'; el.style.top = (tah.y0 + dy) + 'px';
      });
      const konec = e => {
        if (!tah || tah.p !== p) return;
        const t = tah; tah = null; clearTimeout(t.casovac);
        el.classList.remove('tazena');
        if (e.type !== 'pointerup') return obnov();
        if (t.pohnuto) {
          const cil = api.naOkne(e.clientX, e.clientY);
          if (cil && p.sl !== NOVA) { obnov(); return cil === 'pl' ? prehraj(p.sl, { pridat: true }) : cil === 'hlavni' ? prehraj(p.sl) : null; }
          if (p.sl !== NOVA) { p.sl.x = el.offsetLeft; p.sl.y = el.offsetTop; uloz(); }
          else { NOVA.x = el.offsetLeft; NOVA.y = el.offsetTop; }
          return obnov();
        }
        // akční ikona reaguje na jedno kliknutí, složky na dvojklik / dvojí ťuknutí
        const ted = performance.now();
        if (p.sl === NOVA) { posledni = null; return novaSlozka(); }
        if (posledni && posledni.id === p.sl.id && ted - posledni.t < 450) { posledni = null; prehraj(p.sl); }
        else posledni = { id: p.sl.id, t: ted };
      };
      el.addEventListener('pointerup', konec);
      el.addEventListener('pointercancel', konec);
      el.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); if (e.pointerType !== 'touch') { vyber(p.sl.id); menuIkony(p.sl, e.clientX, e.clientY); } });
      el.addEventListener('keydown', e => {
        if (p.sl === NOVA) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); novaSlozka(); } return; }
        const kl = { Enter: () => prehraj(p.sl), Delete: () => odeber(p.sl), F2: () => prejmenuj(p.sl), ContextMenu: () => { const r = el.getBoundingClientRect(); menuIkony(p.sl, r.left, r.bottom); } }[e.key];
        if (kl) { e.preventDefault(); e.stopPropagation(); kl(); }
      });
      el.addEventListener('focus', () => vyber(p.sl.id));
    }
    function vyber(id) { if (vybrana !== id) { vybrana = id; obnov(); } }
    function zrusVyber() { if (vybrana) { vybrana = null; obnov(); } }

    const sprity = new Map();
    function sprite(barva, zastupce, plus, hraje, vybrana) {
      const kl = [barva, zastupce, plus, hraje, vybrana].join();
      if (!sprity.has(kl)) {
        const c = document.createElement('canvas'); c.width = c.height = 32;
        kresliIkonu(c.getContext('2d'), barva, { zastupce, plus, hraje, vybrana });
        sprity.set(kl, c);
      }
      return sprity.get(kl);
    }
    // vykreslení všech ikon (pozice, popisky, stav přehrávání)
    function obnov() {
      const m = api.meritko(), dpr = window.devicePixelRatio || 1;
      const s = Math.min(2, Math.max(1, m));
      const bunka = { w: Math.round(78 * s), h: Math.round(80 * s) };
      const vsechny = [...slozky, NOVA];
      const auto = vsechny.filter(sl => sl.x === undefined);
      const pl = { w: kontejner.clientWidth, h: kontejner.clientHeight };
      const poz = rozmistiAuto(auto.length, api.obalkaOken(), pl, bunka);
      const hraje = api.aktualniSlozka();
      for (const id of [...prvky.keys()]) if (!vsechny.some(sl => sl.id === id)) { prvky.get(id).el.remove(); prvky.delete(id); }
      kontejner.style.setProperty('--ikona-pismo', Math.round(11 * Math.min(1.5, s)) + 'px');
      for (const sl of vsechny) {
        const p = prvek(sl), el = p.el;
        p.sl = sl;
        const x = sl.x !== undefined ? Math.max(0, Math.min(sl.x, pl.w - bunka.w)) : poz[auto.indexOf(sl)].x;
        const y = sl.y !== undefined ? Math.max(0, Math.min(sl.y, pl.h - bunka.h)) : poz[auto.indexOf(sl)].y;
        el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = bunka.w + 'px';
        // ikona celočíselně v pixelech zařízení (ostrá)
        const k = Math.max(1, Math.round(32 * s * dpr / 32)), c = p.platno;
        if (c.width !== 32 * k) { c.width = 32 * k; c.height = 32 * k; }
        c.style.width = c.style.height = (32 * k / dpr) + 'px';
        const hladce = api.vyhlazeni ? api.vyhlazeni() : false;
        const vzhled = [sl.barva, sl.typ === 'disk', sl === NOVA, !!hraje && hraje === sl.id, vybrana === sl.id, c.width, hladce].join();
        if (p.vzhled !== vzhled) {   // překreslit jen při změně (obnov běží i při každém posunu okna)
          p.vzhled = vzhled;
          const pom = sprite(sl.barva, sl.typ === 'disk', sl === NOVA, !!hraje && hraje === sl.id, vybrana === sl.id);
          const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
          WA_VYHLAZ.vykresli(g, pom, 32, 32, c.width / 32, hladce);
        }
        p.popisek.textContent = sl.nazev;
        el.classList.toggle('vybrana', vybrana === sl.id);
        el.classList.toggle('hraje', !!hraje && hraje === sl.id);
        el.title = sl === NOVA ? 'Přidat složku s hudbou na plochu' :
          `${sl.nazev}\n${sl.typ === 'disk' ? 'Složka na disku' : 'Kopie v prohlížeči'}${sl.pocet != null ? ' · ' + sl.pocet + ' skladeb' : ''}\nDvojklik = přehrát, pravé tlačítko = nabídka`;
        el.setAttribute('aria-label', sl === NOVA ? 'Přidat složku s hudbou' : `Složka ${sl.nazev}, přehrát dvojklikem`);
      }
    }

    // prázdná plocha: klik zruší výběr, pravé tlačítko / dlouhý stisk = nabídka plochy
    let casovacPlochy = 0;
    api.el.addEventListener('pointerdown', e => {
      if (e.target !== api.el && e.target !== kontejner) return;
      zrusVyber();
      if (e.pointerType !== 'mouse') {
        const x = e.clientX, y = e.clientY;
        casovacPlochy = setTimeout(() => menuPlochy(x, y), 550);
      }
    });
    for (const t of ['pointerup', 'pointercancel', 'pointermove']) api.el.addEventListener(t, e => { if (t !== 'pointermove' || Math.abs(e.movementX) + Math.abs(e.movementY) > 3) clearTimeout(casovacPlochy); });
    api.el.addEventListener('contextmenu', e => {
      if (e.target !== api.el && e.target !== kontejner) return;
      e.preventDefault();
      if (e.pointerType !== 'touch') menuPlochy(e.clientX, e.clientY);
    });

    // klíče souborů, které složky používají (pro úklid sirotků)
    const pouziteKlice = () => nacteno ? new Set(slozky.flatMap(sl => (sl.soubory || []).map(z => z.klic))) : null;
    return { get chybiPovoleni() { return chybiPovoleni; }, pouziteKlice, nacti, obnov, souborPolozky, novaSlozka, pridejDisk, pridejKopii, menuPlochy, get slozky() { return slozky; }, prehraj };
  }

  window.WA_PLOCHA = { vytvor, kresliIkonu, rozmistiAuto, BARVY, umiDisk };
})();
