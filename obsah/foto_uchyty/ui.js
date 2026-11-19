/* Foto a kamerové úchyty – ovládání stránky nad společným zapojením gen3d/aplikace.js
   (tady jen to, co je zvláštní: karty článků řetězu, výsledky, mechanika, kusovník, režimy náhledu, export po dílech, výkres).
   Náhled = KNOF_NAHLED. Režimy: sestava (složený řetěz), článek (vybraný), tisk (díly na podložce), kalibrace. */
/* global FOTU, FOTU_MECH, FOTU_VYK, KNOF_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = FOTU.fmt;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let p, wasm = null, model = null, chybaStavby = '', chybaJadra = '', mech = null, kalib = null;
  const stavZobr = { rezim: 'sestava', vybrany: 0, zarizeni: true };
  const nahled = KNOF_NAHLED.vytvorNahled($('platno'), { drzPohled: true });

  const app = G3D.aplikace({
    typ: 'foto_uchyty', nazev: 'Úchyty kamer', klic: 'webapp_foto_uchyty', soubor: 'uchyt',
    normalizuj: FOTU.normalizuj, vychozi: () => FOTU.predvolba('kolo'),
    ulozProjekt: FOTU.ulozProjekt, nactiProjekt: FOTU.nactiProjekt, popis: FOTU.popis,
    vezmi: FOTU.vezmi, poloz: FOTU.poloz,
    predNaplnenim: q => kresliKarty(q),
    poNaplneni: () => { p = app.p; souhrny(); paletaZakladu(); },
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(),
    png: () => nahled.png(), pohled: j => oramuj(j),
    exportStl: () => exportVse('stl'),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(kusy(dilyKTisku()), app.p.nazev || 'Uchyt'), pripona: '.3mf' } : null),
    diry: true,
    zkratky: { r: 'tRez', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka', z: 'tZarizeni' },
    zmenaTematu: () => prepocitej(),
  });

  /* ---------- dlaždice: začátek řetězu = druh 1. článku (jako výběr Druh v jeho kartě) ---------- */
  function paletaZakladu() {
    document.querySelectorAll('#paletaZakladu button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.druh === app.p.clanky[0].druh)));
  }
  document.querySelectorAll('#paletaZakladu button').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.druh === app.p.clanky[0].druh) return;
    app.zmen(q => { q.clanky[0].druh = b.dataset.druh; });
    app.naplnFormular();
  }));

  /* ---------- karty článků ---------- */
  const POPISKY = {
    objimka: { D: ['Trubka / řídítka Ø', 'mm', 'Řídítka 22,2 / 25,4 / 31,8 mm, sedlovka 27,2–31,6, stativová noha – změřte posuvkou'], sirka: ['Šířka objímky', 'mm'], stena: ['Stěna kroužku', 'mm'], vlozka: ['Gumová vložka', 'mm', 'Tloušťka pryže (duše, páska) mezi trubkou a objímkou; 0 = bez vložky'] },
    prisavka: { deska: ['Deska Ø', 'mm'], hlava: ['Hlavička přísavky Ø', 'mm', 'Hřib na kupované přísavce – změřte posuvkou'], krcek: ['Krček Ø', 'mm'], vyskaHlavy: ['Výška hlavičky', 'mm'], vyskaKrcku: ['Výška krčku', 'mm', 'Od desky přísavky ke spodku hlavičky'] },
    magnet: { deska: ['Deska Ø', 'mm'], magnet: ['Magnet Ø', 'mm'], vyska: ['Výška magnetu', 'mm'], pocet: ['Magnetů', 'ks'], sila: ['Síla 1 magnetu', 'N', 'Z údajů prodejce (typicky Ø 12 × 3 mm N35 ≈ 25 N) – ověřit'] },
    popruh: { sirka: ['Šířka popruhu', 'mm'], tloustka: ['Tloušťka popruhu', 'mm'] },
    deska: { sirka: ['Šířka desky', 'mm'], delka: ['Délka desky', 'mm'], tloustka: ['Tloušťka', 'mm'], otvoru: ['Děr na vruty', 'ks', '0 = přilepit oboustrannou páskou'], vrut: ['Vrut Ø', 'mm', 'Zápustná hlava ≈ 2 × průměr'] },
    rameno: { delka: ['Délka', 'mm', '0 = nejkratší možná (podle rozhraní)'], ohyb: ['Ohyb', '°', 'Lomené rameno – výstup se natočí kolem osy Y'], delka2: ['Délka za ohybem', 'mm'] },
    adapter: { delka: ['Délka', 'mm', '0 = nejkratší možná (podle rozhraní)'] },
    koule: { koule: ['Koule Ø', 'mm'], vule: ['Vůle koule', 'mm', 'Na poloměr; záporná = sevřená i bez šroubu'], presah: ['Přesah hrdla', 'mm', 'O kolik je hrdlo jamky užší než koule – koule se zacvakne'], krk: ['Krček koule', 'mm'], sklon: ['Sklon', '°', 'Vyklonění koule v náhledu'], natoceni: ['Natočení', '°', 'Směr vyklonění kolem osy jamky'] },
    otocny: { prumer: ['Průměr', 'mm'], zubu: ['Zubů aretace', 'ks', 'Krok aretace = 360° / počet zubů'], natoceni: ['Natočení', '°', 'Zapadne do nejbližšího zubu'] },
    telefon: { sirka: ['Šířka telefonu', 'mm', 'I s obalem'], tloustka: ['Tloušťka', 'mm'], vyska: ['Výška držáku', 'mm'], vule: ['Vůle', 'mm'] },
    zarizeni: { hmotnost: ['Hmotnost', 'g', 'Akční kamera ≈ 120–160 g, kompakt ≈ 300 g, zrcadlovka s objektivem 800–1500 g'], sirka: ['Šířka', 'mm'], hloubka: ['Hloubka', 'mm'], vyska: ['Výška', 'mm'] },
  };
  const barvaClanku = i => ['#2F5FA8', '#E88A2E', '#3E9A62', '#8E5BB5', '#C6503F', '#2E8FA3', '#A88A2F', '#5F6FA8'][i % 8];
  let podpisKaret = '';
  function kresliKarty(q) {
    const podpis = q.clanky.map(c => c.druh).join(',');
    if (podpis === podpisKaret && $('seznamClanku').children.length) return;
    const otevrene = new Set([...document.querySelectorAll('.clanek-karta[open]')].map(d => +d.dataset.clanek));
    const prvni = !podpisKaret;
    podpisKaret = podpis;
    if (stavZobr.vybrany >= q.clanky.length) stavZobr.vybrany = q.clanky.length - 1;
    const R = FOTU.ROZHRANI, D = FOTU.DRUHY, N = q.clanky.length;
    let h = '';
    q.clanky.forEach((c, i) => {
      const d = D[c.druh], pop = POPISKY[c.druh] || {};
      if (i > 0) h += `<div class="spoj-znak" id="spoj_${i}"></div>`;
      const otevr = prvni ? i === N - 2 || N === 1 : otevrene.has(i);
      h += `<details class="clanek-karta${i === stavZobr.vybrany ? ' vybrany' : ''}" data-clanek="${i}"${otevr ? ' open' : ''}>
        <summary><span class="cislo-cl" style="background:${barvaClanku(i)}">${i + 1}</span><span class="jm">${esc(d.nazev)}<span class="sh" id="shCl_${i}"></span></span>
          <span class="akce"><button type="button" data-akce="nahoru" title="Posunout výš" aria-label="Posunout výš"${i === 0 ? ' disabled' : ''}>↑</button><button type="button" data-akce="dolu" title="Posunout níž" aria-label="Posunout níž"${i === N - 1 ? ' disabled' : ''}>↓</button><button type="button" data-akce="smaz" title="Odebrat článek" aria-label="Odebrat článek"${N === 1 ? ' disabled' : ''}>✕</button></span></summary>
        <div class="telo-cl"><div class="mrizka">
          <div class="pole"><label for="c${i}_druh">Druh</label><select id="c${i}_druh" data-p="clanky.${i}.druh" data-typ="text">${Object.entries(D).map(([k, x]) => `<option value="${k}">${esc(x.nazev)}</option>`).join('')}</select></div>`;
      if (d.a.length > 1 || c.a !== 'zadne') h += `<div class="pole"><label for="c${i}_a">Vstup A</label><select id="c${i}_a" data-p="clanky.${i}.a" data-typ="text">${d.a.map(k => `<option value="${k}">${esc(R[k].nazev)}</option>`).join('')}</select></div>`;
      if (d.b.length > 1 || c.b !== 'zadne') h += `<div class="pole"><label for="c${i}_b">Výstup B</label><select id="c${i}_b" data-p="clanky.${i}.b" data-typ="text">${d.b.map(k => `<option value="${k}">${esc(R[k].nazev)}</option>`).join('')}</select></div>`;
      if (i > 0) h += `<div class="pole" data-uhel="${i}"><label for="c${i}_uhel">Natočení spoje</label><input type="text" inputmode="text" class="mm" id="c${i}_uhel" data-p="clanky.${i}.uhel" data-krok="5" title="Prsty: kolem šroubu M5 · závit: kolem osy · patka: 0 / 180°"><span class="jedn">°</span></div>`;
      for (const k of Object.keys(d.par)) {
        if (k === 'uhel' || k === 'otocB') continue;
        const [pop0, j, t] = pop[k] || [k, ''];
        const krok = j === '°' ? 5 : 1;
        h += `<div class="pole"${k === 'delka2' ? ` data-ohyb="${i}"` : ''}><label for="c${i}_${k}">${esc(pop0)}</label><input type="text" inputmode="${d.par[k][1] < 0 ? 'text' : 'decimal'}" class="mm" id="c${i}_${k}" data-p="clanky.${i}.${k}" data-krok="${krok}"${t ? ` title="${esc(t)}"` : ''}><span class="jedn">${esc(j)}</span></div>`;
      }
      if (d.par.otocB) h += `<div class="pole"><label for="c${i}_ot">Natočení výstupu</label><select id="c${i}_ot" data-p="clanky.${i}.otocB" title="Otočí rozhraní B kolem jeho osy – u prstů mění osu šroubu"><option value="0">0°</option><option value="90">90°</option></select></div>`;
      h += `</div><p class="napoveda" id="napCl_${i}"></p></div></details>`;
    });
    $('seznamClanku').innerHTML = h;
  }
  $('seznamClanku').addEventListener('click', e => {
    const b = e.target.closest('[data-akce]');
    const karta = e.target.closest('.clanek-karta');
    if (!karta) return;
    const i = +karta.dataset.clanek;
    if (!b) { if (e.target.closest('summary')) vyber(i); return; }
    e.preventDefault();
    const a = b.dataset.akce;
    app.zmen(q => {
      const c = q.clanky;
      if (a === 'smaz' && c.length > 1) c.splice(i, 1);
      if (a === 'nahoru' && i > 0) [c[i - 1], c[i]] = [c[i], c[i - 1]];
      if (a === 'dolu' && i < c.length - 1) [c[i + 1], c[i]] = [c[i], c[i + 1]];
    });
    podpisKaret = 'x';   // vynutit překreslení i při stejném pořadí druhů
    app.naplnFormular();
  });
  function vyber(i) {
    stavZobr.vybrany = i;
    document.querySelectorAll('.clanek-karta').forEach(k => k.classList.toggle('vybrany', +k.dataset.clanek === i));
    if (stavZobr.rezim === 'clanek') zobraz(true);
    if (model) vypisVysledky();
  }
  $('novyDruh').innerHTML = Object.entries(FOTU.DRUHY).map(([k, d]) => `<option value="${k}">${esc(d.nazev)}</option>`).join('');
  $('novyDruh').value = 'rameno';
  $('btnPridat').addEventListener('click', () => {
    const druh = $('novyDruh').value, D = FOTU.DRUHY[druh];
    if (app.p.clanky.length >= FOTU.MAX_CLANKU) { Dialog.chyba(`Řetěz má nejvýš ${FOTU.MAX_CLANKU} článků.`); return; }
    let kam;
    app.zmen(q => {
      const c = q.clanky, posl = c[c.length - 1];
      if (D.zaklad) { kam = 0; const n = FOTU.novyClanek(druh, null); if (c[0] && c[0].a !== 'zadne' && D.b.includes(FOTU.PROTI[c[0].a])) n.b = FOTU.PROTI[c[0].a]; c.unshift(n); return; }
      kam = !D.koncovka && posl && FOTU.DRUHY[posl.druh].koncovka ? c.length - 1 : c.length;
      const n = FOTU.novyClanek(druh, c[kam - 1]);
      // vložení před koncovku: výstup nového článku napojit na vstup koncovky
      if (kam < c.length && D.b.includes(FOTU.PROTI[c[kam].a])) n.b = FOTU.PROTI[c[kam].a];
      c.splice(kam, 0, n);
    });
    stavZobr.vybrany = kam;
    app.naplnFormular();
    const k = document.querySelector(`.clanek-karta[data-clanek="${kam}"]`); if (k) { k.open = true; k.scrollIntoView({ block: 'nearest' }); }
  });

  function viditelnost() {
    p = app.p;
    document.querySelectorAll('[data-ohyb]').forEach(el => { el.hidden = !(p.clanky[+el.dataset.ohyb] && p.clanky[+el.dataset.ohyb].ohyb > 0); });
    document.querySelectorAll('[data-uhel]').forEach(el => { const c = p.clanky[+el.dataset.uhel]; el.hidden = !c || c.a === 'zadne'; });
  }
  $('f_material').innerHTML = Object.entries(FOTU.MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev}</option>`).join('');

  /* ---------- přepočet ---------- */
  function prepocitej() {
    p = app.p;
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    let H = FOTU.kontroly(p);
    model = null; mech = null; chybaStavby = chybaJadra;
    const zavazne = H.some(x => x.uroven === 'chyba');
    if (wasm) {
      try {
        model = FOTU.postav(wasm, p, { kalibrace: stavZobr.rezim === 'kalibrace' || p.tisk.kalibrace });
        kalib = model.kalibrace.length ? model.kalibrace : null;
        H = H.concat(FOTU.kontrolyModelu(p, model));
        mech = FOTU_MECH.rozbor(p, model);
        H = H.concat(FOTU_MECH.hlaseni(p, mech));
      } catch (e) { chybaStavby = 'Model nelze sestavit: ' + (e && e.message || e); }
    }
    void zavazne;
    const st = $('stav3d');
    st.textContent = wasm || chybaJadra ? chybaStavby : 'Načítám geometrické jádro…';
    st.classList.toggle('chyba', !!chybaStavby);
    zobraz(false);
    app.hlaseni(H, { chybaStavby, boxy: ['boxRetez', 'boxRozhrani'] });
    souhrny();
    vypisVysledky();
    vypisMech();
    vypisTisk();
    menuDilu();
  }
  const box = (a, b, c, d) => G3D.dlazdice(a, b, c, d);
  function souhrny() {
    const R = FOTU.ROZHRANI, q = p.prsty;
    TrubkyGui.souhrn('sPrsty', `${fmt(q.tl, 1)} / mezera ${fmt(q.tl + q.vule, 2)} · Ø ${fmt(q.dira, 1)}`, true);
    TrubkyGui.souhrn('sZavit', p.zavit.kov ? `kovová matice · vůle ${fmt(p.zavit.vule, 2)}` : `tištěný · vůle ${fmt(p.zavit.vule, 2)}`, true);
    TrubkyGui.souhrn('sKostky', `${p.kostky.nx} × ${p.kostky.ny} · Ø ${fmt(p.kostky.vystupek + p.kostky.vuleVyst, 2)}${p.kostky.technic !== 'ne' ? ' · Technic' : ''}`, p.clanky.some(c => c.a === 'kv' || c.a === 'kd' || c.b === 'kv' || c.b === 'kd'));
    TrubkyGui.souhrn('sPatka', `${fmt(p.patka.sirka)} × ${fmt(p.patka.delka)} × ${fmt(p.patka.tl, 1)}`, false);
    TrubkyGui.souhrn('sSestava', p.sestava.naklon || p.sestava.otoc ? `náklon ${fmt(p.sestava.naklon, 0)}° · otočení ${fmt(p.sestava.otoc, 0)}°` : 'výstup nahoru', !!(p.sestava.naklon || p.sestava.otoc));
    const mez = FOTU.mezPrstu(p);
    p.clanky.forEach((c, i) => {
      const sh = $('shCl_' + i); if (!sh) return;
      sh.textContent = c.a === 'zadne' ? `→ ${R[c.b].kratce}` : c.b === 'zadne' ? `${R[c.a].kratce} →` : `${R[c.a].kratce} → ${R[c.b].kratce}`;
      const o = FOTU.odvozClanek(c, p), nap = $('napCl_' + i);
      if (nap) nap.textContent = (({
        rameno: () => o.auto ? `Délka automaticky ${fmt(o.L1, 1)} mm (nejkratší pro tato rozhraní).` : `Nejkratší délka pro tato rozhraní ${fmt(o.Lmin, 1)} mm.`,
        adapter: () => o.auto ? `Délka automaticky ${fmt(o.L1, 1)} mm.` : `Nejkratší délka ${fmt(o.Lmin, 1)} mm.`,
        objimka: () => `Kroužek Ø ${fmt(2 * o.Rt, 1)} / ${fmt(2 * o.Ro, 1)} mm, stažený šroubem M5 s maticí v uchu.`,
        prisavka: () => `Klíčová dírka: hlavička projde otvorem Ø ${fmt(2 * o.rh, 1)}, pak se deska posune ke středu.`,
        magnet: () => `${c.pocet} × magnet Ø ${fmt(c.magnet)} × ${fmt(c.vyska)} mm, kapsy zespodu (zalepit).`,
        popruh: () => `Tunel ${fmt(o.tun.w, 1)} × ${fmt(o.tun.h, 1)} mm – popruh se provlékne.`,
        koule: () => o.rl < o.Rs ? `Jamka Ø ${fmt(2 * o.Rs, 2)}, hrdlo Ø ${fmt(2 * o.rl, 2)}, vyklonění až ${fmt(o.alfa, 0)}° (do štěrbiny víc). Sevření šroubem M5.` : '',
        otocny: () => `Zuby ${fmt(o.hz, 2)} mm, krok ${fmt(o.krok, 1)}°, šroub M5 shora, matice do boční kapsy spodku.`,
        telefon: () => `Vnitřek ${fmt(o.W, 1)} × ${fmt(o.Tp, 1)} mm, lemy ${fmt(o.ret, 1)} mm, doraz dole s výřezem na kabel.`,
        zarizeni: () => 'Netiskne se – obrys a hmotnost pro výpočet momentů.',
      })[c.druh] || (() => ''))();
      if (i > 0) {
        const z = $('spoj_' + i), pr = p.clanky[i - 1];
        if (z) {
          const ok = pr.b !== 'zadne' && FOTU.PROTI[pr.b] === c.a;
          z.className = 'spoj-znak ' + (ok ? 'ok-t' : 'spatne-t');
          z.textContent = ok ? `✔ ${R[pr.b].kratce} ↔ ${R[c.a].kratce}${c.a === 'p2' || c.a === 'p3' ? ` · ${fmt(c.uhel, 0)}° (mez ±${fmt(mez, 0)}°)` : ''}` : `✖ ${R[pr.b].kratce} ↔ ${R[c.a].kratce} nepasuje`;
        }
      }
    });
  }
  function dilyKTisku() { return model ? model.dily.concat(p.tisk.kalibrace && kalib ? kalib : []) : []; }
  function vypisVysledky() {
    const el = $('vVysledky'), karta = $('karta3d');
    if (!model) { el.innerHTML = box('Model', wasm || chybaJadra ? 'nelze sestavit' : 'načítám…', chybaStavby); karta.innerHTML = ''; $('vSit').innerHTML = ''; $('kusovnik').innerHTML = ''; return; }
    const mat = FOTU.MATERIALY[p.tisk.material], dily = dilyKTisku();
    const V = dily.reduce((s, d) => s + d.objem, 0) * p.tisk.sad, od = G3D.odhadTisku(V, mat.hustota, { dilu: dily.length * p.tisk.sad });
    const B = model.sestava.filter(d => stavZobr.zarizeni || !d.netisk).reduce((b, d) => { const q = G3D.obal(d.poz); for (let i = 0; i < 3; i++) { b[i] = Math.min(b[i], q[i]); b[i + 3] = Math.max(b[i + 3], q[i + 3]); } return b; }, [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
    let h = box('Sestava', `${fmt(B[3] - B[0], 0)} × ${fmt(B[4] - B[1], 0)} × ${fmt(B[5] - B[2], 0)} mm`, `${p.clanky.length} článků · ${model.spoje.length} spojů`);
    h += box('Díly k tisku', `${model.dily.length * p.tisk.sad} ks`, p.tisk.kalibrace ? '+ kalibrační vzorky' : 'každý ve vlastní tiskové poloze');
    h += box('Hmotnost', `${fmt(od.g, od.g < 10 ? 1 : 0)} g`, p.tisk.sad > 1 ? `${mat.nazev}, plné díly, ${p.tisk.sad} sady` : `${mat.nazev}, plné díly`);
    h += box('Filament', `${fmt(od.metru, 1)} m`, `průměr 1,75 mm · ${fmt(V / 1000, 1)} cm³`);
    h += box('Doba tisku', `≈ ${od.minut < 60 ? od.minut + ' min' : fmt(od.minut / 60, 1) + ' h'}`, 'hrubý odhad');
    if (mech && mech.nejhorsi) {
      const n = mech.nejhorsi, v = n.vyuziti;
      h += box('Nejslabší místo', `${fmt(v * 100, 0)} %`, n.nazev, v > 1 ? 'chyba-t' : v > 0.6 ? 'mez-t' : 'ok-t');
    }
    if (model.zarizeni) h += box('Zařízení', `${fmt(model.zarizeni.hmotnost, 0)} g`, `dynamický součinitel ${fmt(p.mech.dyn, 1)}×`);
    if (p.clanky.some(c => c.a === 'p2' || c.a === 'p3' || c.b === 'p2' || c.b === 'p3')) h += box('Kloub prstů', `±${fmt(FOTU.mezPrstu(p), 0)}°`, `mezera ${fmt(p.prsty.tl + p.prsty.vule, 2)} mm`);
    el.innerHTML = h;
    // kusovník
    const radky = kusovnik();
    $('kusovnik').innerHTML = `<table class="tabulka"><thead><tr><th>Díl</th><th class="c">Kusů</th><th class="c">Rozměr (mm)</th><th class="c">Objem</th><th>Tisk</th></tr></thead><tbody>`
      + radky.dily.map(r => `<tr><td>${esc(r[0])}</td><td class="c">${r[1]}</td><td class="c">${r[2]}</td><td class="c">${r[3]}</td><td>${esc(r[4])}</td></tr>`).join('')
      + radky.navic.map(t => `<tr><td colspan="5">+ <span>${esc(t)}</span></td></tr>`).join('') + '</tbody></table>';
    const vyb = p.clanky[stavZobr.vybrany];
    const titul = { sestava: 'Sestava', clanek: vyb ? `${stavZobr.vybrany + 1}. ${FOTU.DRUHY[vyb.druh].nazev}` : 'Článek', tisk: 'Díly k tisku', kalibrace: 'Kalibrační vzorky' }[stavZobr.rezim];
    karta.innerHTML = `<div class="titul">${esc(titul)}</div><b>${fmt(B[3] - B[0], 0)} × ${fmt(B[4] - B[1], 0)} × ${fmt(B[5] - B[2], 0)}</b> mm · <b>${model.dily.length}</b> dílů · <b>${fmt(od.g, 0)}</b> g`;
    const kont = model.clanky.flatMap(c => c.casti).map(d => ({ d, k: KRAB.kontrolaSite(d.poz, d.idx) }));
    $('vSit').innerHTML = kont.map(({ d, k }) => box('Síť – ' + d.nazev, k.uzavrena && d.teles === 1 ? '✔ těsná' : '✖ netěsná', `${k.trojuhelniku} trojúhelníků, ${d.teles === 1 ? '1 těleso' : d.teles + ' tělesa'}`, k.uzavrena && d.teles === 1 ? 'ok-t' : 'chyba-t')).join('')
      + box('Stavba', `${model.cas} ms`, 'manifold-3d');
  }
  /** Kusovník: tištěné díly + spojovací materiál. */
  function kusovnik() {
    const dily = [], navic = [], sad = p.tisk.sad, q = p.prsty;
    for (const c of model.clanky) for (const d of c.casti) {
      const b = G3D.obal(d.tisk.poz);
      dily.push([d.nazev, sad, `${fmt(b[3] - b[0], 1)} × ${fmt(b[4] - b[1], 1)} × ${fmt(b[5] - b[2], 1)}`, `${fmt(d.objem / 1000, 2)} cm³`, `${d.tisk.poloha} · ${FOTU.popisPolohy(d)}`]);
    }
    if (p.tisk.kalibrace && kalib) for (const d of kalib) { const b = G3D.obal(d.poz); dily.push([d.nazev, 1, `${fmt(b[3] - b[0], 1)} × ${fmt(b[4] - b[1], 1)} × ${fmt(b[5] - b[2], 1)}`, `${fmt(d.objem / 1000, 2)} cm³`, d.popis || '']); }
    const sirkaP3 = 3 * q.tl + 2 * (q.tl + q.vule) + (q.matice ? 3.5 : 0);
    const nPrsty = model.spoje.filter(s => s.typ === 'prsty').length;
    const dP = Math.ceil((sirkaP3 + 2) / 5) * 5;
    if (nPrsty) navic.push(q.matice ? `${nPrsty * sad} × šroub M5 × ${dP} mm s křídlovou hlavou + matice M5 do kapsy` : `${nPrsty * sad} × šroub M5 × ${dP} mm s křídlovou hlavou + matice M5`);
    p.clanky.forEach((c, i) => {
      const o = model.O[i];
      if (c.druh === 'objimka') {
        const dO = Math.ceil((2 * (o.ucho.tl + o.ucho.sterbina / 2) + 4) / 5) * 5;
        navic.push(`${sad} × šroub M5 × ${dO} + matice M5 (objímka)`);
        if (c.vlozka > 0) navic.push(`gumová vložka ${fmt(c.vlozka, 1)} mm (objímka)`);
      }
      if (c.druh === 'koule') navic.push(`${sad} × šroub M5 × ${Math.ceil((2 * o.ucho.tl + o.ucho.sterbina + 3) / 5) * 5} + matice M5 (sevření koule)`);
      if (c.druh === 'otocny') navic.push(`${sad} × šroub M5 × ${Math.ceil((o.HB - 3.2 + o.hz + o.zN + 4) / 5) * 5} s válcovou hlavou + matice M5 (otočný kloub)`);
      if (c.druh === 'magnet') navic.push(`${c.pocet * sad} × magnet Ø ${fmt(c.magnet)} × ${fmt(c.vyska)} mm (neodym), lepidlo`);
      if (c.druh === 'deska' && c.otvoru > 0) navic.push(`${c.otvoru * sad} × vrut Ø ${fmt(c.vrut, 1)} se zápustnou hlavou + hmoždinka`);
      if (c.druh === 'prisavka') navic.push(`${sad} × přísavka s hřibem Ø ${fmt(c.hlava)} mm (kupovaná)`);
      for (const [t, muz] of [[c.a, c.a[0] === 's'], [c.b, c.b[0] === 's']]) {
        const z = FOTU.ZAVITY[t === 's14' || t === 'm14' ? '14' : t === 's38' || t === 'm38' ? '38' : ''];
        if (!z || !p.zavit.kov || c.druh === 'zarizeni') continue;
        const L = t.endsWith('14') ? p.zavit.delka14 : p.zavit.delka38;
        navic.push(muz ? `${sad} × matice ${z.nazev} + stavěcí šroub ${z.nazev} × ${Math.ceil(L + z.maticeV)} mm (${i + 1}. článek)` : `${sad} × matice ${z.nazev} (${i + 1}. článek)`);
      }
    });
    return { dily, navic };
  }
  function vypisMech() {
    const el = $('vMech'), tab = $('tabMech');
    if (!mech) { el.innerHTML = box('Mechanika', '–', 'model se ještě nesestavil'); tab.innerHTML = ''; return; }
    const U = mech.U;
    let h = box('Hmotnost celkem', `${fmt(mech.hmotnost, 0)} g`, model.zarizeni ? `z toho zařízení ${fmt(model.zarizeni.hmotnost, 0)} g` : 'bez zařízení (přidejte článek Zařízení)');
    h += box('Předpětí šroubu M5', `${fmt(U.F5, 0)} N`, `utaženo ${fmt(p.mech.utahM5, 1)} N·m, K = 0,2`);
    h += box('Únosnost prstů', `${fmt(U.prsty / 1000, 2)} N·m`, `μ ${fmt(U.mu, 2)} · 4 plochy · r ${fmt(U.ref, 1)} mm`);
    if (mech.nejhorsi) h += box('Nejslabší místo', `${fmt(mech.nejhorsi.vyuziti * 100, 0)} %`, mech.nejhorsi.nazev, mech.nejhorsi.vyuziti > 1 ? 'chyba-t' : mech.nejhorsi.vyuziti > 0.6 ? 'mez-t' : 'ok-t');
    el.innerHTML = h;
    const jed = r => (r.typ === 'rameno' ? 'MPa' : r.typ === 'kostky' ? '%' : 'N·mm');
    tab.innerHTML = '<thead><tr><th>Místo</th><th class="c">Zatížení</th><th class="c">Únosnost</th><th class="c">Využití</th></tr></thead><tbody>'
      + mech.radky.map(r => `<tr><td>${esc(r.nazev)}<br><span style="color:var(--text-faint);font-size:0.7rem">${esc(r.pozn || '')}</span></td><td class="c">${fmt(r.M, r.M < 10 ? 1 : 0)} ${jed(r)}</td><td class="c">${r.Mcap ? fmt(r.Mcap, r.Mcap < 10 ? 1 : 0) + ' ' + jed(r) : '–'}</td><td class="c ${r.vyuziti > 1 ? 'chyba-t' : r.vyuziti > 0.6 ? 'mez-t' : ''}">${r.vyuziti === null ? '–' : fmt(r.vyuziti * 100, 0) + ' %'}</td></tr>`).join('') + '</tbody>';
  }
  function vypisTisk() {
    const t = $('tabTisk');
    if (!model) { t.innerHTML = ''; return; }
    const D = { prsty: 'prsty nastojato – slabé', zavit: 'závit vodorovně', objimka: 'kroužek na boku', vystupky: 'výstupky nemíří nahoru', dutina: 'spodek kostek na boku' };
    t.innerHTML = '<thead><tr><th>Díl</th><th>Poloha</th><th class="c">Převis</th><th class="c">Most</th></tr></thead><tbody>'
      + model.clanky.flatMap(c => c.casti).map(d => `<tr><td>${esc(d.nazev)}</td><td>${esc(d.tisk.poloha + ' · ' + FOTU.popisPolohy(d))}${d.tisk.slabe.length ? `<br><span class="mez-t">${esc(d.tisk.slabe.map(s => D[s]).join(', '))}</span>` : ''}</td><td class="c ${d.tisk.previs > 4 ? 'mez-t' : ''}">${fmt(d.tisk.previs, 0)} mm²</td><td class="c">${fmt(d.tisk.most, 0)} mm²</td></tr>`).join('') + '</tbody>';
  }
  function menuDilu() {
    const el = $('exportDilu');
    if (!model) { el.innerHTML = ''; return; }
    const dily = model.dily;
    if (el.dataset.podpis === dily.map(d => d.jmeno).join()) return;
    el.dataset.podpis = dily.map(d => d.jmeno).join();
    el.innerHTML = dily.length > 1 ? dily.map((d, i) => `<button class="pol" role="menuitem" data-dil="${i}">⬇ STL – ${esc(d.nazev)}</button>`).join('') : '';
  }
  $('exportDilu').addEventListener('click', e => {
    const b = e.target.closest('[data-dil]'); if (!b || !lzeExport()) return;
    const d = model.dily[+b.dataset.dil]; if (!d) return;
    app.stahni(KRAB.stlBinarni(G3D.tiskoveRozlozeni([d], app.p.tisk.sad, 5, 220), 'foto uchyty - ' + d.jmeno), app.jmeno('_' + d.jmeno + '.stl'), 'model/stl');
  });

  /* ---------- náhled ---------- */
  /** Rámování s rezervou: KNOF_NAHLED rámuje opsanou kouli × 0,95, takže rohy vysoké sestavy (kvádr zařízení) přečnívají plátno. */
  let ramBox = null;
  function oramuj(jak) {
    nahled.pohled(jak || 'ponech');
    nahled.ovl.vzd *= 1.18;
    nahled.prekresli();
  }
  /** Přerámovat, když se obal zobrazených dílů výrazně změní (jiný řetěz, přidané zařízení, jiný režim). */
  function hlidejRam(dily, novy) {
    const B = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const d of dily) { const q = G3D.obal(d.poz); for (let i = 0; i < 3; i++) { B[i] = Math.min(B[i], q[i]); B[i + 3] = Math.max(B[i + 3], q[i + 3]); } }
    if (!Number.isFinite(B[0])) return;
    const vel = Math.max(B[3] - B[0], B[4] - B[1], B[5] - B[2], 10);
    const jiny = !ramBox || [0, 1, 2, 3, 4, 5].some(i => Math.abs(B[i] - ramBox[i]) > 0.15 * vel);
    if (novy || jiny) { ramBox = B; oramuj('ponech'); }
  }
  function zobraz(novyPohled) {
    document.querySelectorAll('[data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === stavZobr.rezim)));
    if (!model) { nahled.nastav(null); return; }
    const r = stavZobr.rezim;
    if (r === 'tisk') nahled.nastav(G3D.tiskoveRozlozeni(dilyKTisku(), p.tisk.sad, 6, 220), { tisk: true, novyPohled, uhel: p.tisk.uhel });
    else if (r === 'kalibrace') nahled.nastav(kalib ? G3D.tiskoveRozlozeni(kalib, 1, 6, 160) : [], { tisk: true, novyPohled, uhel: p.tisk.uhel });
    else if (r === 'clanek') {
      const c = model.clanky[stavZobr.vybrany];
      const dily = c ? c.casti.map(d => Object.assign({}, d, { poz: FOTU.presunPoz(d.poz, d.L) })) : [];
      nahled.nastav(dily.length ? dily : model.sestava.filter(d => d.clanek === stavZobr.vybrany), { novyPohled });
    } else nahled.nastav(model.sestava.filter(d => stavZobr.zarizeni || !d.netisk), { novyPohled });
    const zobr = r === 'tisk' ? G3D.tiskoveRozlozeni(dilyKTisku(), p.tisk.sad, 6, 220) : r === 'kalibrace' ? (kalib ? G3D.tiskoveRozlozeni(kalib, 1, 6, 160) : [])
      : r === 'clanek' ? (model.clanky[stavZobr.vybrany] ? model.clanky[stavZobr.vybrany].casti.map(d => ({ poz: FOTU.presunPoz(d.poz, d.L) })) : []) : model.sestava.filter(d => stavZobr.zarizeni || !d.netisk);
    hlidejRam(zobr, novyPohled);
    $('legPrevisy').hidden = !((r === 'tisk' || r === 'kalibrace') && nahled.stav.previsy);
  }
  function nastavRezim(r) {
    const tisk = $('tTisk').getAttribute('aria-pressed') === 'true';
    const pred = stavZobr.rezim;
    stavZobr.rezim = r;
    if ((r === 'tisk') !== tisk) { $('tTisk').click(); return; }
    if (r === 'kalibrace' && !kalib) { prepocitej(); return; }
    zobraz(pred !== r);
    if (model) vypisVysledky();
  }
  document.querySelectorAll('[data-rezim]').forEach(b => b.addEventListener('click', () => nastavRezim(b.dataset.rezim)));

  /* ---------- nabídky, export ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_foto_uchyty_gui', pohled: j => oramuj(j) });
  for (const v of FOTU.PREDVOLBY) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
    b.addEventListener('click', () => {
      const q = FOTU.predvolba(v.id);
      for (const k of ['prsty', 'zavit', 'patka', 'tisk', 'mech', 'diry']) q[k] = FOTU.kopie(app.p[k]);
      stavZobr.vybrany = 0;
      app.nahrad(q);
      oramuj('iso');
    });
    $('seznamPredvoleb').appendChild(b);
  }
  function lzeExport() {
    if (!model) { Dialog.chyba(chybaStavby || 'Geometrické jádro se ještě načítá.'); return false; }
    return true;
  }
  const kusy = dily => G3D.tiskoveRozlozeni(dily, app.p.tisk.sad, 6, 220);
  function exportVse(druh) {
    if (!lzeExport()) return;
    if (druh === 'stl') app.stahni(KRAB.stlBinarni(kusy(dilyKTisku()), 'foto uchyty - github_site'), app.jmeno('.stl'), 'model/stl');
    else app.stahni(KRAB.soubor3mf(kusy(dilyKTisku()), app.p.nazev || 'Uchyt'), app.jmeno('.3mf'), 'model/3mf');
  }
  $('btnStl').addEventListener('click', () => exportVse('stl'));
  $('btn3mf').addEventListener('click', () => exportVse('3mf'));
  document.querySelectorAll('[data-export]').forEach(b => b.addEventListener('click', () => {
    if (!lzeExport()) return;
    if (b.dataset.export === 'kalibrace') {
      if (!kalib) { try { kalib = FOTU.postav(wasm, app.p, { kalibrace: true }).kalibrace; } catch (e) { Dialog.chyba('Kalibrační vzorky nelze sestavit: ' + (e && e.message || e)); return; } }
      app.stahni(KRAB.stlBinarni(G3D.tiskoveRozlozeni(kalib, 1, 6, 160), 'foto uchyty - kalibrace'), app.jmeno('_kalibrace.stl'), 'model/stl');
    } else {
      const s = model.sestava.filter(d => !d.netisk);
      app.stahni(KRAB.stlBinarni(s, 'foto uchyty - sestava (vizualizace)'), app.jmeno('_sestava.stl'), 'model/stl');
    }
  }));
  /* ---------- výkres ---------- */
  function svgVykresu() {
    if (!lzeExport()) return null;
    const mat = FOTU.MATERIALY[app.p.tisk.material], d = new Date(), k = kusovnik(), R = FOTU.ROZHRANI;
    const hm = model.dily.reduce((s, x) => s + x.objem, 0) * mat.hustota / 1000;
    const spoje = model.spoje.map(s => { const c = app.p.clanky[s.i], pr = app.p.clanky[s.i - 1]; return [`${s.i}–${s.i + 1}`, `${R[pr.b].kratce} ↔ ${R[c.a].kratce}`, s.typ === 'prsty' || s.typ === 'zavit' ? `${fmt(c.uhel, 0)}°` : '–']; });
    for (const v of model.vnitrni) { const c = app.p.clanky[v.i]; spoje.push([`${v.i + 1}.`, v.typ === 'koule' ? 'kulový kloub' : 'otočný kloub', v.typ === 'koule' ? `${fmt(c.sklon, 0)}° / ${fmt(c.natoceni, 0)}°` : `${fmt(model.O[v.i].nat, 1)}°`]); }
    return FOTU_VYK.sestavVykres(app.p, model, {
      datum: `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`, hmotnost: hm, material: mat.nazev,
      kusovnik: k.dily.map(r => [r[0], r[1], r[2], r[4].split(' · ')[0]]).concat(k.navic.map(t => ['+ ' + t, '', '', ''])), spoje,
    });
  }
  const ukazVykres = () => { const svg = svgVykresu(); if (!svg) return; $('vykresObsah').innerHTML = svg; $('vykresDlg').showModal(); };
  const stahniVykres = () => { const svg = svgVykresu(); if (svg) app.stahni(svg, app.jmeno('_vykres.svg'), 'image/svg+xml'); };
  function tiskVykresu() {
    const svg = svgVykresu(); if (!svg) return;
    const ram = document.createElement('iframe');
    ram.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(ram);
    const d = ram.contentDocument;
    d.open(); d.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(app.jmeno(''))}</title><style>@page{size:A4 landscape;margin:0}html,body{margin:0;padding:0}svg{display:block;width:297mm;height:210mm}</style></head><body>${svg}</body></html>`); d.close();
    setTimeout(() => { try { ram.contentWindow.focus(); ram.contentWindow.print(); } finally { setTimeout(() => ram.remove(), 60000); } }, 250);
  }
  $('btnVykres').addEventListener('click', ukazVykres);
  $('btnVykresSvg').addEventListener('click', stahniVykres);
  $('btnVykresSvg2').addEventListener('click', stahniVykres);
  $('btnVykresTisk').addEventListener('click', tiskVykresu);
  $('btnVykresTisk2').addEventListener('click', tiskVykresu);
  $('btnZavritVyk').addEventListener('click', () => $('vykresDlg').close());
  app.prepinac('tRez', h => { nahled.prepni('rez', h); $('legRez').hidden = !h; });
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !(h && (stavZobr.rezim === 'tisk' || stavZobr.rezim === 'kalibrace')); }, true);
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);
  app.prepinac('tZarizeni', h => { stavZobr.zarizeni = h; if (model) { zobraz(false); vypisVysledky(); } }, true);
  app.prepinac('tTisk', h => {
    if (h) stavZobr.rezim = 'tisk';
    else if (stavZobr.rezim === 'tisk') stavZobr.rezim = 'sestava';
    zobraz(true);
    if (model) vypisVysledky();
  });

  /* ---------- start ---------- */
  app.start({
    manifold: {
      ok: w => { wasm = w; prepocitej(); },
      chyba: e => { chybaJadra = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – model ani export nejsou k dispozici.'; prepocitej(); },
    },
  });
  window.FOTU_UI = { get p() { return app.p; }, get model() { return model; }, get mech() { return mech; }, zmen: app.zmen, nahrad: app.nahrad, prepocitej, nahled, app, nastavRezim, vyber, svgVykresu };
})();
