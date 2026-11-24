/* Dopravní magnát – herní část rozhraní: nástroje stavby, okna (finance, vozidla, stanice, garáže),
   zprávy, ukládání (IndexedDB + soubor). Načítá se PŘED ui.js a napojuje se přes háčky v U = MAG.UI. */
(function () {
  'use strict';
  const MAG = window.MAG, D = MAG.data, M = MAG.mapa, H = MAG.hra, C = MAG.cesty, Z = MAG.zeleznice, VV = MAG.vodaVzduch;
  // poloha libovolného vozidla (silnice, lodě, letadla; vlak má vozy zvlášť)
  const polohaV = (h, v) => (v.druh === 'lod' || v.druh === 'let') ? VV.poloha(h, v) : H.polohaVozidla(h, v);
  const U = MAG.UI = MAG.UI || {};
  const $ = id => document.getElementById(id);
  const penize = n => (n < 0 ? '−' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('cs-CZ');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const datumText = (h, den) => { const d = H.datum(h, den); return `${d.den}. ${d.mesic}. ${d.rok}`; };
  const NAZVY_MES = ['led', 'úno', 'bře', 'dub', 'kvě', 'čer', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];

  // --- ikony z atlasů (obrázek, když je načtený; jinak emoji) ----------------------------
  function ikona(atlas, k, px = 18, popis = '') {
    const A = MAG.ATLAS && MAG.ATLAS[atlas], f = A && A.snimky[k], im = MAG.grafika.OBR[atlas];
    if (!f || !im) return null;
    const s = px / Math.max(f[2], f[3]);
    return `<span class="ik" role="img" aria-label="${popis}" style="width:${px}px;height:${px}px;background-image:url(${A.obr});`
      + `background-size:${(im.naturalWidth * s).toFixed(1)}px ${(im.naturalHeight * s).toFixed(1)}px;`
      + `background-position:${(-f[0] * s + (px - f[2] * s) / 2).toFixed(1)}px ${(-f[1] * s + (px - f[3] * s) / 2).toFixed(1)}px"></span>`;
  }
  const INDEX_NAKLADU = Object.fromEntries(D.NAKLADY.map((n, k) => [n.id, k]));
  // arch ikon má jen prvních 13 nákladů (14.–16. buňka jsou peníze, hodnocení, krize) → další náklady emoji
  const ikN = (id, px) => (INDEX_NAKLADU[id] < 13 && ikona('ikony1', INDEX_NAKLADU[id], px, D.NAKLADY_PODLE_ID[id].nazev)) || D.NAKLADY_PODLE_ID[id].ikona;
  U.ikona = ikona; U.ikN = ikN;

  // --- zprávy ------------------------------------------------------------------------
  const plocha = $('plocha');
  const zpravyEl = document.createElement('div');
  zpravyEl.className = 'zpravy'; zpravyEl.setAttribute('aria-live', 'polite');
  plocha.appendChild(zpravyEl);
  /* Zprávy vlevo dole: vydrží 12 s (chyba 7 s), pod myší se odpočet zastaví, jde je zavřít křížkem.
     Všechny se ukládají do historie (📜 v liště a Přehledy → Zprávy), odkud jde na místo nebo vozidlo kliknout. */
  const historie = [];   // {datum, text, kam, chyba}
  let neprectenych = 0;
  function zprava(text, kam, chyba, akce) {
    if (!text) return;
    const h = U.hra;
    historie.push({ datum: h ? datumText(h) : '', text, kam, chyba: !!chyba });
    if (historie.length > 200) historie.shift();
    neprectenych++; oznacHistorii();
    const el = document.createElement('div');
    el.className = 'zprava' + (chyba ? ' chyba' : '') + (kam ? ' klik' : '');
    const t = document.createElement('span'); t.textContent = text; el.append(t);
    const x = document.createElement('button'); x.className = 'zprava-x'; x.textContent = '✕'; x.title = 'Zavřít'; x.setAttribute('aria-label', 'Zavřít zprávu');
    x.addEventListener('click', ev => { ev.stopPropagation(); pryc(el); });
    if (akce) {
      const a = document.createElement('button'); a.className = 'zprava-akce'; a.textContent = akce.text;
      a.addEventListener('click', ev => { ev.stopPropagation(); akce.fn(); pryc(el); });
      el.insertBefore(a, x);
    }
    el.append(x);
    if (kam) el.addEventListener('click', () => skokNa(kam));
    el.dataset.zbyva = chyba ? 7000 : 12000;
    zpravyEl.appendChild(el);
    while (zpravyEl.children.length > 5) zpravyEl.firstChild.remove();
    if (ziva.has('historie')) obnovOkna();
  }
  async function nahraditVozidlo(id) {
    const h = U.hra, v = h.vozidla[id];
    if (!H.aktivni(v)) return;
    const c = H.nahrad(h, id, true);
    if (!c.ok) { zprava(c.chyba, null, true); return; }
    if (!(await Dialog.potvrd(`Koupit ${c.nove.nazev} za ${penize(c.cena)} jako náhradu za ${v.jmeno}? Nové převezme jeho trasu a staré se po dojezdu do garáže samo prodá.`))) return;
    const x = H.nahrad(h, id);
    if (!x.ok) { zprava(x.chyba, null, true); return; }
    aktualizujListu(); obnovOkna();
    U.zavriOkno('voz' + id); oknoVozidla(x.novy);
  }
  const skokNa = kam => { if (kam.vozidlo !== undefined) oknoVozidla(kam.vozidlo); else U.naPole(kam.x, kam.y); };
  const pryc = el => { if (el.classList.contains('pryc')) return; el.classList.add('pryc'); setTimeout(() => el.remove(), 400); };
  // odpočet; dokud je myš nad zprávami, stojí
  setInterval(() => {
    if (zpravyEl.matches(':hover')) return;
    for (const el of zpravyEl.children) { el.dataset.zbyva -= 250; if (el.dataset.zbyva <= 0) pryc(el); }
  }, 250);
  function oznacHistorii() {
    const b = document.getElementById('stZpravy'); if (!b) return;
    b.textContent = neprectenych ? `📜 ${neprectenych}` : '📜';
    b.classList.toggle('nove', neprectenych > 0);
  }
  function oknoHistorie() {
    zive('historie', () => {
      neprectenych = 0; oznacHistorii();
      const tel = document.createElement('div');
      tel.append(lista(tl('🧹 Vymazat', () => { historie.length = 0; oknoHistorie(); })));
      const sez = document.createElement('div'); sez.className = 'seznam historie';
      for (const z of [...historie].reverse()) {
        const b = tl('', () => z.kam && skokNa(z.kam));
        b.innerHTML = `<span class="${z.chyba ? 'minus' : ''}">${esc(z.text)}</span><small>${esc(z.datum)}</small>`;
        if (!z.kam) b.classList.add('bez-cile');
        sez.append(b);
      }
      if (!historie.length) sez.append(el('<small>Zatím žádné zprávy.</small>'));
      tel.append(sez);
      U.okno('historie', `📜 Zprávy (${historie.length})`, tel, [10, 10]);
    });
  }
  $('stZpravy').addEventListener('click', oknoHistorie);
  $('miZpravy').addEventListener('click', oknoHistorie);
  U.zprava = zprava; U.oknoHistorie = oknoHistorie;
  const plovouci = [];   // „+$123“ nad stanicí

  // --- lišta (datum, peníze) --------------------------------------------------------------
  function aktualizujListu() {
    const h = U.hra; if (!h) return;
    $('stDatum').textContent = datumText(h);
    const kr = $('stKrize'); if (kr) kr.hidden = !(h.ekonomika && h.ekonomika.krize > 0);
    const p = $('stPenize');
    p.textContent = penize(h.firma.penize);
    p.classList.toggle('minus', h.firma.penize < 0);
  }

  // --- nástroje stavby -------------------------------------------------------------------------
  const NASTROJE = {
    silnice: { nazev: '🛣️ Silnice', napoveda: 'Táhni z místa na místo – trasa se najde sama (kolem domů a vody). Se Shiftem přesně rovně (i most)' },
    bus: { nazev: '🚏 Zastávka autobusu', napoveda: 'Klikni na rovný úsek silnice' },
    nakl: { nazev: '🚚 Nákladní stanoviště', napoveda: 'Klikni na rovný úsek silnice u podniku' },
    garaz: { nazev: '🅿️ Garáž', napoveda: 'Klikni na volné pole vedle silnice' },
    zbor: { nazev: '🚜 Buldozer', napoveda: 'Táhni obdélník: bourá tvé stavby a kácí stromy' },
    kolej: { nazev: '🛤️ Kolej', napoveda: 'Táhni z místa na místo – trasa s co nejméně oblouky se najde sama; po úhlopříčce šikmo. Se Shiftem přesně rovně (i most)' },
    nadrazi: { nazev: '🚉 Nádraží', napoveda: 'Táhni podél koleje nebo po volném poli (1–8 polí)' },
    depo: { nazev: '🏭 Železniční depo', napoveda: 'Klikni na volné pole vedle koleje' },
    pristav: { nazev: '⚓ Přístav', napoveda: 'Klikni na volné pobřeží (souš vedle vody)' },
    lodenice: { nazev: '🏗️ Loděnice', napoveda: 'Klikni na volné pobřeží (souš vedle vody)' },
    boje: { nazev: '🛟 Bóje', napoveda: 'Klikni na vodu: průjezdní bod pro rozkazy lodí' },
    zdymadlo: { nazev: '🚧 Zdymadlo', napoveda: 'Klikni na svažitý rovný úsek řeky – lodě pak projedou výš' },
    letiste: { nazev: '✈️ Letiště', napoveda: 'Klikni na levý horní roh volné plochy 3 × 3 pole' },
    letisteV: { nazev: '🛫 Velké letiště', napoveda: 'Klikni na levý horní roh volné plochy 4 × 4 pole (od 1955, pro proudová letadla)' },
    zvednout: { nazev: '⛰️ Zvednout terén', napoveda: 'Táhni přes plochu: zvedne o 1 stupeň (okolí se dorovná)' },
    snizit: { nazev: '🕳️ Snížit terén', napoveda: 'Táhni přes plochu: sníží o 1 stupeň (okolí se dorovná)' },
    srovnat: { nazev: '📏 Srovnat terén', napoveda: 'Táhni od rohu, jehož výšku má mít celá plocha (náspy, zářezy, místo pro nádraží)' },
    podnik: { nazev: '🏗️ Nový podnik', napoveda: 'Klikni na levý horní roh pozemku podniku (náhled ukáže, jestli tam smí stát)' },
    heliport: { nazev: '🚁 Heliport', napoveda: 'Klikni na volné pole (od 1950, jen pro vrtulníky)' },
    tram: { nazev: '🚋 Tramvajová kolej', napoveda: 'Táhni po silnici: koleje pro tramvaje (zastávky jsou autobusové, tramvaj se kupuje v garáži)' },
    tunelK: { nazev: '⛰️ Železniční tunel', napoveda: 'Táhni rovně od úpatí přes kopec k úpatí: kolej pod terénem' },
    tunelS: { nazev: '⛰️ Silniční tunel', napoveda: 'Táhni rovně od úpatí přes kopec k úpatí: silnice pod terénem' },
    trolej: { nazev: '⚡ Trolej', napoveda: 'Táhni přes kolej: elektrizace pro elektrické lokomotivy' },
    vrt: { nazev: '🚄 Rychlostní kolej', napoveda: 'Táhni rovně: kolej až pro 320 km/h (od roku 1985), i přestavba běžné koleje' },
    navest: { nazev: '🚦 Cestové návěstidlo', napoveda: 'Klikni na rovnou kolej: směr A → B → oba → žádné' },
    navestJ: { nazev: '⛔ Jednosměrné návěstidlo', napoveda: 'Klikni na rovnou kolej: proti směru se nesmí jet (A → B → žádné)' },
  };
  let nahled = null;         // {pole:[[x,y]], cena, chyba, oblast:[x0,y0,x1,y1], kde:[sx,sy]}
  let cekaRozkaz = null;     // id vozidla, kterému klikem přidáváme zastávku
  function vyberNastroj(id) {
    cekaRozkaz = null;
    if (U.nastroj === id || !id) { U.zrusNastroj(); return; }
    U.nastroj = id; nahled = null;
    $('stNastroj').textContent = `${NASTROJE[id].nazev} – ${NASTROJE[id].napoveda} (Esc konec)`;
    $('stNastroj').hidden = false;
    document.querySelectorAll('[data-nastroj]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.nastroj === id)));
    $('platno').style.cursor = 'crosshair';
    U.prekresli();
  }
  U.zrusNastroj = () => {
    U.nastroj = null; nahled = null; cekaRozkaz = null;
    $('stNastroj').hidden = true;
    document.querySelectorAll('[data-nastroj]').forEach(b => b.setAttribute('aria-pressed', 'false'));
    $('platno').style.cursor = '';
    U.prekresli();
  };
  function zpracujZmeny() {
    const h = U.hra;
    if (!h.zmeny.length) return;
    for (const [x0, y0, x1, y1] of h.zmeny) U.kreslic.zneplatni(x0, y0, x1, y1);
    h.zmeny.length = 0;
    U.pripravMinimapu();
  }
  function obdelnik(a, b) { return [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)]; }
  /* Silnice / kolej tažením: bez Shiftu hledá trasu (A* s trestem za zatáčky, existující cesty levné), u koleje tah
     po úhlopříčce = šikmá kolej; se Shiftem (nebo když trasa nejde) přesná rovná čára jako dřív – jen ta umí most. */
  let shiftDrzeny = false;
  for (const t of ['keydown', 'keyup']) document.addEventListener(t, ev => { if (ev.key === 'Shift' && shiftDrzeny !== (t === 'keydown')) { shiftDrzeny = t === 'keydown'; if (U.posledniTah) U.tahNastroje('tah', ...U.posledniTah); } });
  window.addEventListener('blur', () => { shiftDrzeny = false; });
  function trasaNastroje(h, n, a, b, ostre) {
    const m = h.m, kolej = n === 'kolej';
    const rovne = () => kolej
      ? { r: Z.postavKolej(h, a.x, a.y, b.x, b.y, !ostre), pole: Z.caraKoleje(a.x, a.y, b.x, b.y) }
      : { r: H.postavSilnici(h, a.x, a.y, b.x, b.y, !ostre), pole: H.cara(a.x, a.y, b.x, b.y) };
    if (shiftDrzeny || (a.x === b.x && a.y === b.y)) return rovne();
    if (a.x === b.x || a.y === b.y) {   // tah v jedné řadě: rovně, když to jde (trasa by mohla uhnout na sousední cestu)
      const r = rovne();
      if (r.r.ok || /už vede|peněz/.test(r.r.chyba || '')) return r;
    }
    if (kolej) {   // tah zhruba po úhlopříčce → šikmá kolej, když jde postavit
      const c = Z.caraKoleje(a.x, a.y, b.x, b.y);
      if (c.length > 2 && c[0][0] !== c[2][0] && c[0][1] !== c[2][1] && Z.postavKolej(h, a.x, a.y, b.x, b.y, true).ok) return rovne();
    }
    const t = MAG.cesty.trasaStavby(m, a.y * m.W + a.x, b.y * m.W + b.x, kolej ? 'kolej' : 'silnice');
    if (!t) return rovne();
    return { r: H.postavPoTrase(h, t, kolej ? 'kolej' : 'silnice', !ostre), pole: t.map(i => [i % m.W, (i / m.W) | 0]) };
  }
  function provedNastroj(a, b, ostre) {
    const h = U.hra, n = U.nastroj, R = D.DOSAH_ZASTAVKY;
    if (!a || !b) return null;
    let r, pole = [], oblast = null;
    if (n === 'silnice' || n === 'kolej') {
      ({ r, pole } = trasaNastroje(h, n, a, b, ostre));
    }
    else if (n === 'bus' || n === 'nakl') { r = H.postavZastavku(h, b.x, b.y, n, !ostre); pole = [[b.x, b.y]]; oblast = [b.x - R, b.y - R, b.x + R, b.y + R]; }
    else if (n === 'garaz') { r = H.postavGaraz(h, b.x, b.y, !ostre); pole = [[b.x, b.y]]; }
    else if (n === 'tram') { r = H.postavTramKolej(h, a.x, a.y, b.x, b.y, !ostre); pole = H.cara(a.x, a.y, b.x, b.y); }
    else if (n === 'tunelK' || n === 'tunelS') { r = Z.postavTunel(h, a.x, a.y, b.x, b.y, n === 'tunelK' ? 'kolej' : 'silnice', !ostre); pole = H.cara(a.x, a.y, b.x, b.y); }
    else if (n === 'nadrazi') {
      r = Z.postavNadrazi(h, a.x, a.y, b.x, b.y, !ostre); pole = H.cara(a.x, a.y, b.x, b.y);
      const R4 = D.DOSAH_NADRAZI, [x0, y0, x1, y1] = obdelnik(a, b);
      oblast = [x0 - R4, y0 - R4, x1 + R4, y1 + R4];
    }
    else if (n === 'depo') { r = Z.postavDepo(h, b.x, b.y, !ostre); pole = [[b.x, b.y]]; }
    else if (n === 'pristav') { r = VV.postavPristav(h, b.x, b.y, !ostre); pole = [[b.x, b.y]]; oblast = [b.x - D.DOSAH_NADRAZI, b.y - D.DOSAH_NADRAZI, b.x + D.DOSAH_NADRAZI, b.y + D.DOSAH_NADRAZI]; }
    else if (n === 'boje') { r = VV.postavBoji(h, b.x, b.y, !ostre); pole = [[b.x, b.y]]; }
    else if (n === 'zdymadlo') { r = VV.postavZdymadlo(h, b.x, b.y, !ostre); pole = [[b.x, b.y]]; }
    else if (n === 'lodenice') { r = VV.postavLodenici(h, b.x, b.y, !ostre); pole = [[b.x, b.y]]; }
    else if (n === 'letiste' || n === 'letisteV' || n === 'heliport') {
      const typ = n === 'letisteV' ? 'velke' : n === 'heliport' ? 'heli' : 'male', N = VV.TYPY_LETIST[typ].n;
      r = VV.postavLetiste(h, b.x, b.y, !ostre, typ); pole = [];
      for (let dy = 0; dy < N; dy++) for (let dx = 0; dx < N; dx++) pole.push([b.x + dx, b.y + dy]);
      oblast = [b.x - D.DOSAH_NADRAZI, b.y - D.DOSAH_NADRAZI, b.x + N - 1 + D.DOSAH_NADRAZI, b.y + N - 1 + D.DOSAH_NADRAZI];
    }
    else if (n === 'trolej') { r = Z.postavTrolej(h, a.x, a.y, b.x, b.y, !ostre); pole = Z.caraKoleje(a.x, a.y, b.x, b.y); }
    else if (n === 'vrt') { r = Z.postavVrt(h, a.x, a.y, b.x, b.y, !ostre); pole = Z.caraKoleje(a.x, a.y, b.x, b.y); }
    else if (n === 'navest' || n === 'navestJ') { r = Z.prepniNavest(h, b.x, b.y, n === 'navestJ', !ostre); pole = [[b.x, b.y]]; }
    else if (n === 'zvednout' || n === 'snizit' || n === 'srovnat') {
      r = H.upravTeren(h, a.x, a.y, b.x, b.y, n, !ostre);
      const [x0, y0, x1, y1] = obdelnik(a, b);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) pole.push([x, y]);
    }
    else if (n === 'podnik' && U.podnikTyp) {
      const p = D.PRUMYSL_PODLE_ID[U.podnikTyp], [w, hh] = p.rozmer;
      r = MAG.ekonomika.financujPodnik(h, U.podnikTyp, b.x, b.y, !ostre);
      for (let dy = 0; dy < hh; dy++) for (let dx = 0; dx < w; dx++) pole.push([b.x + dx, b.y + dy]);
      oblast = [b.x - 1, b.y - 1, b.x + w, b.y + hh];
    }
    else if (n === 'zbor') {
      const [x0, y0, x1, y1] = obdelnik(a, b);
      r = H.zbor(h, x0, y0, x1, y1, !ostre);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) pole.push([x, y]);
    }
    return { r, pole, oblast };
  }
  U.tahNastroje = (faze, a, b, kde) => {
    if (faze === 'zrus') { nahled = null; U.posledniTah = null; U.prekresli(); return; }
    if (cekaRozkaz !== null) return;
    if (faze === 'konec') {
      U.posledniTah = null;
      const v = provedNastroj(a, b, true);
      nahled = null;
      if (!v) return;
      if (v.r.ok) {
        if (U.hraj) U.hraj(U.nastroj === 'zbor' ? 'bourani' : 'stavba');
        zpracujZmeny(); aktualizujListu(); obnovOkna();
        if (v.r.cena) plovouci.push({ x: b.x + 0.5, y: b.y + 0.5, text: penize(-v.r.cena), barva: '#ff9b8a', t: performance.now() });
        if (v.r.varovani) zprava(v.r.varovani, null, true);
        // garáž: rovnou otevřít okno
        if (U.nastroj === 'letiste' || U.nastroj === 'letisteV' || U.nastroj === 'heliport') { const s2 = U.hra.stanice[U.mapa.stan[b.y * U.mapa.W + b.x] - 1]; if (s2) oknoStanice(s2.id); }
        if (U.nastroj === 'garaz' || U.nastroj === 'depo' || U.nastroj === 'lodenice') { const g = U.hra.depa[U.mapa.depo[b.y * U.mapa.W + b.x] - 1]; if (g) oknoGaraze(g.id); }
      } else { zprava(v.r.chyba, null, true); if (U.hraj) U.hraj('chyba'); }
      return;
    }
    U.posledniTah = faze === 'tah' || faze === 'start' ? [a, b] : null;
    const v = provedNastroj(a, b, false);
    nahled = v && { pole: v.pole, cena: v.r.cena, chyba: v.r.ok ? null : v.r.chyba, oblast: v.oblast, b };
    U.prekresli();
  };

  // --- kreslení navrch ----------------------------------------------------------------------------
  function obrys(g, x, y, z, ox, oy, vypln, cara) {
    const o = U.kreslic.obrysPole(x, y);
    g.beginPath(); o.forEach(([a, b], i) => g[i ? 'lineTo' : 'moveTo'](a * z + ox, b * z + oy)); g.closePath();
    if (vypln) { g.fillStyle = vypln; g.fill(); }
    if (cara) { g.strokeStyle = cara; g.lineWidth = 1.5; g.stroke(); }
  }
  function oblastObrys(g, pole, z, ox, oy, barva) {
    const m = U.mapa;
    for (const i of pole) obrys(g, i % m.W, (i / m.W) | 0, z, ox, oy, barva, null);
  }
  let vybranaStanice = null, sledovane = null, vybraneVozidlo = null;
  function seznamVozidel(h) {
    const out = [];
    for (const v of h.vozidla) {
      if (!H.aktivni(v) || v.stav === 'depo') continue;
      if (v.druh === 'vlak') {
        const ukaz = U.nalozeni || v.id === vybraneVozidlo;
        for (const voz of Z.vozyVlaku(h, v)) out.push({ ...voz, barva: voz.druh === 'lok' ? h.firma.barva : voz.barva, firma: h.firma.barva, vybrane: voz.druh === 'lok' && v.id === vybraneVozidlo, id: v.id, ukaz: ukaz && voz.druh === 'vagon' });
        continue;
      }
      const p = polohaV(h, v);
      if (!p) continue;
      const nk = v.oddily[0] && D.NAKLADY_PODLE_ID[v.oddily[0].typ];
      const tv = D.VOZIDLA_PODLE_ID[v.typ];
      out.push({ x: p.x, y: p.y, d: p.d, k: p.k, vyska: p.vyska, druh: v.druh, jede: v.stav === 'jede' && v.bezi && !(v.porucha > 0), typ: v.typ, firma: h.firma.barva, barva: tv.barvaTypu || h.firma.barva, barvaTypu: tv.barvaTypu, naklad: nk && nk.barva, plny: v.oddily.some(o => o.n > 0), vybrane: v.id === vybraneVozidlo, id: v.id,
        ukaz: (U.nalozeni || v.id === vybraneVozidlo) && !p.vyska, podil: v.oddily.reduce((a, o) => a + o.n, 0) / Math.max(1, v.oddily.reduce((a, o) => a + o.kap, 0)) });
    }
    return out;
  }
  U.poKresleni = (g, z, ox, oy) => {
    const h = U.hra; if (!h) return;
    const m = h.m;
    // trasa vozidla s otevřeným oknem: čára mezi stanicemi rozkazů, čísla zastávek, aktuální cíl zvýrazněný
    if (vybraneVozidlo !== null && U.okna.has('voz' + vybraneVozidlo)) {
      const v = h.vozidla[vybraneVozidlo];
      const body = H.aktivni(v) ? v.rozkazy.map(r => h.stanice[r.st]).filter(Boolean).map(st => { const [wx, wy] = U.kreslic.stredPole(st.x, st.y); return [wx * z + ox, wy * z + oy]; }) : [];
      if (body.length > 1) {
        g.save();
        g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.35)'; g.setLineDash([]);
        g.beginPath(); body.forEach((p, k) => g[k ? 'lineTo' : 'moveTo'](p[0], p[1])); if (body.length > 2) g.closePath(); g.stroke();
        g.lineWidth = 2; g.strokeStyle = h.firma.barva; g.setLineDash([8, 6]);
        g.beginPath(); body.forEach((p, k) => g[k ? 'lineTo' : 'moveTo'](p[0], p[1])); if (body.length > 2) g.closePath(); g.stroke();
        g.setLineDash([]);
        g.font = '700 12px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        body.forEach((p, k) => {
          const akt = k === v.ri && v.stav !== 'depo';
          g.fillStyle = akt ? '#ffec8c' : h.firma.barva; g.beginPath(); g.arc(p[0], p[1], akt ? 11 : 9, 0, Math.PI * 2); g.fill();
          g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke();
          g.fillStyle = akt ? '#222' : '#fff'; g.fillText(String(k + 1), p[0], p[1] + 0.5);
        });
        g.restore();
      }
    }
    if (vybranaStanice !== null && h.stanice[vybranaStanice]) oblastObrys(g, H.oblast(h, h.stanice[vybranaStanice]), z, ox, oy, 'rgba(120,200,255,.18)');
    if (nahled) {
      if (nahled.oblast) {
        const [x0, y0, x1, y1] = nahled.oblast;
        for (let y = Math.max(0, y0); y <= Math.min(m.H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(m.W - 1, x1); x++) obrys(g, x, y, z, ox, oy, 'rgba(120,200,255,.16)', null);
      }
      const barva = nahled.chyba ? 'rgba(255,90,70,.35)' : 'rgba(120,255,140,.3)', cara = nahled.chyba ? '#ff6a5a' : '#8dffa0';
      for (const [x, y] of nahled.pole) if (M.uvnitr(m, x, y)) obrys(g, x, y, z, ox, oy, barva, cara);
    }
    kresliNavestidla(g, z, ox, oy);
    G_vozidla(g, z, ox, oy);
    // plovoucí částky
    const ted = performance.now();
    for (let k = plovouci.length - 1; k >= 0; k--) {
      const p = plovouci[k], st = (ted - p.t) / 1600;
      if (st >= 1) { plovouci.splice(k, 1); continue; }
      const [wx, wy] = U.kreslic.svetNaObr(p.x, p.y);
      g.font = '700 13px system-ui, sans-serif'; g.textAlign = 'center';
      g.fillStyle = `rgba(0,0,0,${0.6 * (1 - st)})`; g.fillText(p.text, wx * z + ox + 1, wy * z + oy - 28 - st * 30 + 1);
      g.fillStyle = p.barva; g.globalAlpha = 1 - st; g.fillText(p.text, wx * z + ox, wy * z + oy - 28 - st * 30); g.globalAlpha = 1;
      U.prekresli();
    }
    // cena / chyba u kurzoru
    if (nahled && (nahled.cena || nahled.chyba)) {
      const [wx, wy] = U.kreslic.stredPole(nahled.b.x, nahled.b.y);
      const text = nahled.chyba || `Cena ${penize(nahled.cena)}`;
      g.font = '600 12px system-ui, sans-serif';
      const w = g.measureText(text).width + 14, sx = wx * z + ox, sy = wy * z + oy - 34;
      g.fillStyle = nahled.chyba ? 'rgba(120,20,16,.92)' : 'rgba(16,40,22,.92)';
      g.beginPath(); (g.roundRect ? g.roundRect(sx - w / 2, sy - 11, w, 22, 11) : g.rect(sx - w / 2, sy - 11, w, 22)); g.fill();
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, sx, sy);
    }
  };
  // seznam návěstidel se přepočítá při změně sítě; barva podle rezervace / obsazení pole za ním
  let navestidla = [], navestVerze = -1;
  function kresliNavestidla(g, z, ox, oy) {
    const h = U.hra, m = h.m;
    if (z < 0.5) return;
    if (navestVerze !== (h.sitVerze || 0) || navestVerze === -1) {
      navestVerze = h.sitVerze || 0; navestidla = [];
      for (let i = 0; i < m.navest.length; i++) if (m.navest[i]) for (let d = 0; d < 4; d++) if (m.navest[i] & (1 << d)) navestidla.push([i, d, (m.navestJ[i] & (1 << d)) !== 0]);
    }
    if (!navestidla.length) return;
    const obsazeno = new Set();
    for (const v of h.vozidla) if (H.aktivni(v) && v.druh === 'vlak' && v.telo) for (const i of v.telo) obsazeno.add(i);
    for (const [i, d, jedno] of navestidla) {
      const x = i % m.W, y = (i / m.W) | 0, [dx, dy] = M.SOUSEDE4[d];
      // sloupek vpravo od koleje, u výjezdu z pole
      const px = x + 0.5 + dx * 0.32 - dy * 0.34, py = y + 0.5 + dy * 0.32 + dx * 0.34;
      const [wx, wy] = U.kreslic.svetNaObr(px, py);
      const sx = wx * z + ox, sy = wy * z + oy;
      if (sx < -20 || sy < -40 || sx > U.platnoW + 20 || sy > U.platnoH + 20) continue;
      const j = C.soused(m, i, d);
      const cervena = j < 0 || h.rez[j] !== undefined || obsazeno.has(j);
      g.fillStyle = '#3a3a3a'; g.fillRect(sx - 0.8 * z, sy - 16 * z, 1.6 * z, 16 * z);
      g.beginPath(); g.arc(sx, sy - 17 * z, 3.4 * z, 0, Math.PI * 2);
      g.fillStyle = cervena ? '#ff3b2f' : '#38e36b'; g.fill();
      g.lineWidth = Math.max(1, z); g.strokeStyle = jedno ? '#ffffff' : '#1a1a1a'; g.stroke();
    }
  }

  /* Kouř a pára: měkké obláčky (předkreslený přechod), výdechy v taktu podle rychlosti, hustě při rozjezdu, slabě za stání.
     Obláček je ukotvený ve světě (vlak za sebou nechá stopu), stoupá zpomalující rychlostí, vítr ho odnáší, vlní se a roste;
     u komína bílá pára, s věkem šedý kouř. Lodě kouří slaběji ze svých komínů. VYSKA_PX = px na jednotku výšky modelu při Z = 1. */
  const kour = { obl: [], posledni: new Map(), rych: new Map() };
  U.pocetKoure = () => kour.obl.length;   // pro testy
  U.animuje = () => kour.obl.length > 0 || U.rychlost !== 0;
  const VYSKA_PX = 39, ZIVOT = 3400, VITR = [0.9, -0.25];
  const OBLACEK = (() => {   // 64 × 64: bílý a šedý obláček s měkkým okrajem
    const vyrob = (r, g, b) => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 31);
      gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(0.45, `rgba(${r},${g},${b},.75)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
      x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
      return c;
    };
    return { para: vyrob(246, 246, 244), kour: vyrob(150, 148, 146) };
  })();
  const KOMINY = {   // [vpřed v polích, výška v jednotkách modelu] podle typu
    para: [[0.27, 0.33]],
    lod_trajekt: [[-0.18, 0.33], [-0.05, 0.33]],
    lod: [[-0.43, 0.29]],
  };
  function vydech(x, y, vys, sila, para, offx = 0, offy = 0) {
    const n = sila > 0.7 ? 3 : 2;
    for (let k = 0; k < n; k++) {
      kour.obl.push({ x, y, vys, offx, offy, t: performance.now() - k * 40, sila, para,
        dx: (Math.random() - 0.5) * 6, dy: (Math.random() - 0.5) * 4, r0: 2.5 + Math.random() * 2.2, faze: Math.random() * 6.28, vzestup: 0.8 + Math.random() * 0.45 });
    }
    if (kour.obl.length > 700) kour.obl.splice(0, kour.obl.length - 700);
  }
  const KOMINY_PODNIKU = {   // [x, y v px sprajtu, para?, síla]
    elektrarna: [[265, 5, false, 1], [310, 13, false, 1]],
    ocelarna: [[297, 4, false, 1], [333, 34, false, 0.9], [132, 9, true, 0.8]],
    tovarna: [[302, 4, false, 0.9]],
    potravinarna: [[322, 41, true, 0.6], [267, 35, true, 0.5]],
    rafinerie: [[140, 6, false, 0.6], [224, 22, true, 0.5]],
  };
  const KOLA_PODNIKU = { dul: [207, 9, 24], rudnydul: [177, 2, 24] };   // střed a poloměr kola těžní věže
  // geometrie sprajtu podniku na obrazovce (jako grafika.kresliPodnik): přední roh, měřítko px sprajtu → px obrazovky při Z = 1
  function sprajtPodniku(m, q) {
    const G = MAG.grafika, A = MAG.ATLAS && MAG.ATLAS.prumysl, idx = { dul: 0, elektrarna: 1, tezba: 2, pila: 3, rudnydul: 4, ocelarna: 5, tovarna: 6, farma: 7, potravinarna: 8, vrt: 9, rafinerie: 10, vodarna: 15 }[q.typ];
    const f = A && A.snimky[idx ?? 6];
    if (!f || f.length < 7) return null;
    return { f, k1: (q.w + q.h) * G.PW * 0.97 / f[6] };
  }
  const pracuje = (h, q) => {   // dostal suroviny nebo vyrobil a odvezlo se něco minulý měsíc
    const mm = (h.prum[q.id] && h.prum[q.id].minuly) || {};
    return Object.keys(mm).some(k => (k.startsWith('dodano_') || k.startsWith('odvezeno_')) && mm[k] > 0);
  };
  function kresliPodnikyAnim(g, h, z, ox, oy) {
    if (!MAG.grafika.OBR.prumysl || z < 0.25) return;
    const m = h.m, G = MAG.grafika, ted = performance.now(), bezi = U.rychlost !== 0, W = U.platnoW, Hh = U.platnoH;
    const uhel = (h.den * D.DEN_TICKU + h.tick) * 0.08;
    for (const q of m.prumysl) {
      if (q.zrusen || (!KOMINY_PODNIKU[q.typ] && !KOLA_PODNIKU[q.typ])) continue;
      const [wx, wy] = U.kreslic.svetNaObr(q.x + q.w, q.y + q.h), bx = wx * z + ox, by = wy * z + oy;
      if (bx < -250 * z || bx > W + 250 * z || by < -20 || by > Hh + 400 * z) continue;
      const sp = sprajtPodniku(m, q);
      if (!sp) continue;
      const { f, k1 } = sp, prac = pracuje(h, q);
      if (bezi && KOMINY_PODNIKU[q.typ]) for (const [sx, sy, para, sila] of KOMINY_PODNIKU[q.typ]) {
        const klic = 'q' + q.id + ':' + sx, posledni = kour.posledni.get(klic) || 0;
        if (ted - posledni < (prac ? 150 : 900)) continue;
        kour.posledni.set(klic, ted);
        vydech(q.x + q.w, q.y + q.h, 0, prac ? sila : 0.3, para, (sx - f[4]) * k1, (sy - f[5]) * k1);
      }
      const kolo = KOLA_PODNIKU[q.typ];
      if (kolo && prac) {   // točící se kolo: tmavé loukotě přes namalované kolo
        const cx = bx + (kolo[0] - f[4]) * k1 * z, cy = by + (kolo[1] - f[5]) * k1 * z, r = kolo[2] * k1 * z;
        g.save(); g.strokeStyle = 'rgba(60,30,24,.75)'; g.lineWidth = Math.max(1, 1.2 * z); g.beginPath();
        for (let k = 0; k < 4; k++) { const a = uhel + k * Math.PI / 4, c = Math.cos(a) * r * 0.32, s2 = Math.sin(a) * r; g.moveTo(cx - c, cy - s2); g.lineTo(cx + c, cy + s2); }
        g.stroke(); g.restore();
      }
    }
  }
  function kresliKour(g, h, vid, z, ox, oy) {
    const ted = performance.now(), bezi = U.rychlost !== 0;
    for (const voz of vid) {
      const jeLok = voz.druh === 'lok' && voz.trakce === 'para', jeLod = voz.druh === 'lod' && voz.jede;
      if (!jeLok && !jeLod) continue;
      const vl = h.vozidla[voz.id];
      if (!vl || !bezi) continue;
      const rych = vl.rych || 0, minule = kour.rych.get(voz.id) ?? rych;
      kour.rych.set(voz.id, rych);
      let interval, sila;
      if (jeLod) { interval = 520; sila = 0.45; }
      else if (rych < 1) { if (!vl.bezi) continue; interval = 1300; sila = 0.3; }      // stojí pod párou: slabý dým
      else {
        const rozjezd = rych > minule + 0.05;
        interval = Math.max(45, 260 - rych * 2.2) * (rozjezd ? 0.6 : 1);            // takt výdechů podle rychlosti (husté → splývají do vlečky)
        sila = rozjezd ? 1 : 0.75;
      }
      const posledni = kour.posledni.get(voz.id) || 0;
      if (ted - posledni < interval) continue;
      kour.posledni.set(voz.id, ted);
      const uhel = (voz.k !== undefined ? voz.k : [6, 0, 2, 4][voz.d]) * Math.PI / 4;
      const kominy = jeLok ? KOMINY.para : (voz.typ || '').startsWith('lod_trajekt') ? KOMINY.lod_trajekt : KOMINY.lod;
      for (const [vpred, vys] of kominy) vydech(voz.x + Math.cos(uhel) * vpred, voz.y + Math.sin(uhel) * vpred, vys, sila, jeLok);
    }
    kour.obl = kour.obl.filter(o => ted - o.t < ZIVOT * (0.6 + o.sila * 0.5));
    g.save();
    for (const o of kour.obl) {
      const zivot = ZIVOT * (0.6 + o.sila * 0.5), a = Math.max(0, (ted - o.t) / 1000), st = (ted - o.t) / zivot;
      const [wx, wy] = U.kreslic.svetNaObr(o.x, o.y);
      const stoupa = (1 - Math.exp(-a * 1.6)) * 30 * o.vzestup + a * 4;                // rychlý výstup, pak zpomalí
      const x = wx * z + ox + (o.offx + o.dx + VITR[0] * a * a * 7 + Math.sin(a * 2.4 + o.faze) * 1.6 * a) * z;
      const y = wy * z + oy - o.vys * VYSKA_PX * z + (o.offy + o.dy - stoupa + VITR[1] * a * 6) * z;
      const r = (o.r0 + 9.5 * Math.sqrt(a) * (0.7 + o.sila * 0.5)) * z;
      const alfa = Math.min(1, a / 0.12) * Math.pow(1 - st, 1.6) * (0.3 + o.sila * 0.22);
      const sed = Math.min(1, a / 1.6) * (o.para ? 0.75 : 1);                         // pára → kouř
      if (alfa <= 0.01) continue;
      g.globalAlpha = alfa * (1 - sed); if (g.globalAlpha > 0.01) g.drawImage(OBLACEK.para, x - r, y - r, r * 2, r * 2);
      g.globalAlpha = alfa * sed; if (g.globalAlpha > 0.01) g.drawImage(OBLACEK.kour, x - r, y - r, r * 2, r * 2);
    }
    g.restore();
  }
  function G_vozidla(g, z, ox, oy) {
    const h = U.hra, sez = seznamVozidel(h);
    // jen viditelná
    const W = U.platnoW, Hh = U.platnoH;
    const vid = sez.filter(v => { const [a, b] = U.kreslic.svetNaObr(v.x, v.y); const sx = a * z + ox, sy = b * z + oy; return sx > -40 && sx < W + 40 && sy > -40 && sy < Hh + 40; });
    kresliPodnikyAnim(g, h, z, ox, oy);
    U.kreslic.kresliVozidla(g, vid, z, ox, oy);
    kresliKour(g, h, vid, z, ox, oy);
    if (U.noc) U.kreslic.kresliNoc(g, z, ox, oy, W, Hh, U.kreslic.noc(h), vid);
    if (vid.length || kour.obl.length || U.rychlost) U.prekresli();
  }
  U.vozidloNa = (sx, sy) => {
    const h = U.hra; if (!h) return null;
    const z = U.zoom, ox = U.platnoW / 2 - U.kamera.x * z, oy = U.platnoH / 2 - U.kamera.y * z;
    let nej = null, nd = 16;
    for (const v of seznamVozidel(h)) {
      const [a, b] = U.kreslic.svetNaObr(v.x, v.y);
      const d = Math.hypot(a * z + ox - sx, b * z + oy - 5 * z - sy);
      if (d < nd) { nd = d; nej = h.vozidla[v.id]; }
    }
    return nej;
  };
  U.klikVozidlo = v => oknoVozidla(v.id);
  U.klikPole = (pole) => {
    const h = U.hra, m = h.m, i = pole.y * m.W + pole.x;
    if (cekaRozkaz !== null) {
      if (!m.stan[i]) { zprava('Klikni na zastávku nebo stanoviště', null, true); return true; }
      const r = H.pridejRozkaz(h, cekaRozkaz, m.stan[i] - 1);
      if (!r.ok) zprava(r.chyba, null, true);
      else { zprava(`Přidáno: ${h.stanice[m.stan[i] - 1].jmeno}`); oknoVozidla(cekaRozkaz); }
      return true;
    }
    if (U.nastroj) return true;
    if (m.stan[i]) { oknoStanice(m.stan[i] - 1); return true; }
    if (m.depo[i]) { oknoGaraze(m.depo[i] - 1); return true; }
    return false;
  };

  // --- klávesy -----------------------------------------------------------------------------------------
  U.klavesa = ev => {
    const k = ev.key.toLowerCase();
    // W A S D posouvají mapu (ui.js); jejich nástroje jsou na Shift + písmeno
    const sShiftem = { KeyD: 'garaz', KeyS: 'nadrazi', KeyW: 'navestJ', KeyA: 'letiste' };
    if (ev.shiftKey && sShiftem[ev.code]) { vyberNastroj(sShiftem[ev.code]); return true; }
    if (sShiftem[ev.code]) return false;
    const mapa = { r: 'silnice', b: 'bus', t: 'nakl', x: 'zbor', k: 'kolej', j: 'depo', q: 'navest', p: 'pristav', o: 'lodenice', e: 'trolej', h: 'vrt', u: 'tunelK', i: 'tunelS', l: 'tram', y: 'boje', z: 'zdymadlo', c: 'heliport' };
    if (mapa[k]) { vyberNastroj(mapa[k]); return true; }
    if (k === 'f') { oknoFinance(); return true; }
    if (k === 'v') { oknoSeznamVozidel(); return true; }
    if (ev.key === 'Escape' && cekaRozkaz !== null) { cekaRozkaz = null; U.zrusNastroj(); return true; }
    return false;
  };

  // --- běh: lišta, zprávy, okna, automatické ukládání ----------------------------------------------------
  let mesicUlozeni = -1;
  U.poKroku = (h, novyDen) => {
    const udalost = h.zpravy.length > 0;   // příjezd, prodej, tržba… → okna hned obnovit
    for (const z of h.zpravy) {
      if (z.penize) plovouci.push({ x: z.x + 0.5, y: z.y + 0.5, text: '+' + penize(z.penize), barva: '#9dffb0', t: performance.now() });
      if (!z.tiche) zprava(z.text, z.vozidlo !== undefined ? { vozidlo: z.vozidlo } : z.x !== undefined ? { x: z.x, y: z.y } : null, false,
        z.nahradit !== undefined ? { text: '🔄 Nahradit', fn: () => nahraditVozidlo(z.nahradit) } : null);
    }
    h.zpravy.length = 0;
    if (!novyDen && (udalost || performance.now() - posledniObnova > 300)) obnovOkna();
    if (sledovane !== null) {
      const v = h.vozidla[sledovane];
      const p = v && H.aktivni(v) && v.stav !== 'depo' && v.druh !== 'vlak' && polohaV(h, v);
      const q = v && v.druh === 'vlak' && v.stav !== 'depo' ? Z.vozyVlaku(h, v)[0] : p;
      if (q) { const [wx, wy] = U.kreslic.svetNaObr(q.x, q.y); U.kamera.x = wx; U.kamera.y = wy; }
      else if (!v || !H.aktivni(v) || v.stav === 'depo') sledovane = null;   // vlak v tunelu / na poli depa: kamera počká
    }
    if (novyDen) {
      aktualizujListu(); obnovOkna();
      const d = H.datum(h);
      if (d.den === 1 && d.mesic !== mesicUlozeni) { mesicUlozeni = d.mesic; ulozAuto(); }
    }
  };
  U.poNacteni = h => {
    U.zrusNastroj(); vybranaStanice = null; sledovane = null; vybraneVozidlo = null;
    mesicUlozeni = H.datum(h).mesic;
    aktualizujListu();
    document.getElementById('miHavarie').setAttribute('aria-pressed', String(!!(h.volby && h.volby.havarie)));
  };
  document.getElementById('miHavarie').addEventListener('click', () => {
    const h = U.hra; if (!h) return;
    h.volby = { ...(h.volby || {}), havarie: !(h.volby && h.volby.havarie) };
    document.getElementById('miHavarie').setAttribute('aria-pressed', String(h.volby.havarie));
    zprava(h.volby.havarie ? '💥 Havárie zapnuté: pozor na proudová letadla na malých letištích a na přejezdy' : 'Havárie vypnuté');
  });

  /* Živá okna se obnovují několikrát za sekundu běžícího času (a hned po akci v okně). Vynechá se jen, když je
     stisknuté tlačítko myši (překreslení mezi stiskem a puštěním by klik ztratilo) nebo když se v okně píše / vybírá. */
  const ziva = new Map();   // id okna → funkce, která ho znovu vykreslí
  let mysDole = false, posledniObnova = 0;
  document.addEventListener('pointerdown', () => { mysDole = true; }, true);
  for (const ud of ['pointerup', 'pointercancel']) document.addEventListener(ud, () => { mysDole = false; }, true);
  function obnovOkna() {
    if (mysDole) return;
    posledniObnova = performance.now();
    const ae = document.activeElement;
    for (const [id, fn] of ziva) {
      const o = U.okna.get(id);
      if (!o) { ziva.delete(id); continue; }
      if (ae && o.contains(ae) && ae.matches('select, textarea, input:not([type=checkbox])')) continue;
      const tel = o.querySelector('.ok-telo'), sc = tel.scrollTop;
      U.obnova = true;
      try { fn(); } finally { U.obnova = false; }
      tel.scrollTop = sc;
    }
  }
  function zive(id, fn) { ziva.set(id, fn); fn(); }
  // lišta akcí okna (vždy nahoře, aby tlačítka při obnově neuskakovala)
  function lista(...tlacitka) { const d = document.createElement('div'); d.className = 'lista'; d.append(...tlacitka.filter(Boolean)); return d; }
  // sbalitelná sekce; otevřenost se pamatuje podle klíče (živé obnovení okno překresluje)
  const otevrene = new Set();
  function sekce(klic, nadpis, obsah) {
    const d = document.createElement('details'); d.className = 'podrobnosti'; d.open = otevrene.has(klic);
    const s = document.createElement('summary'); s.textContent = nadpis; d.append(s);
    if (typeof obsah === 'string') d.insertAdjacentHTML('beforeend', obsah); else d.append(obsah);
    d.addEventListener('toggle', () => { if (d.open) otevrene.add(klic); else otevrene.delete(klic); });
    return d;
  }
  function el(html) { const d = document.createElement('div'); d.innerHTML = html; return d; }
  const tl = (text, fn, tit) => { const b = U.tlacitko(text, fn); if (tit) b.title = tit; return b; };

  // --- finance --------------------------------------------------------------------------------------------
  const KATEGORIE = [['prijemLod', 'Tržby – lodě'], ['prijemLet', 'Tržby – letadla'], ['prijemVlak', 'Tržby – vlaky'], ['prijemBus', 'Tržby – autobusy'], ['prijemNakl', 'Tržby – nákladní a pošta'], ['provoz', 'Provoz vozidel'],
    ['vozidla', 'Nákup a prodej vozidel'], ['stavba', 'Stavby'], ['uroky', 'Úroky z úvěru']];
  function oknoFinance() {
    zive('finance', () => {
      const h = U.hra, f = h.firma, r = H.rok(h);
      const radky = KATEGORIE.filter(([k]) => h.fin.letos[k] || h.fin.loni[k])
        .map(([k, n]) => `<tr><td>${n}</td><td class="cis${(h.fin.letos[k] || 0) < 0 ? ' minus' : ''}">${penize(h.fin.letos[k] || 0)}</td><td class="cis${(h.fin.loni[k] || 0) < 0 ? ' minus' : ''}">${penize(h.fin.loni[k] || 0)}</td></tr>`).join('');
      const soucet = o => Object.values(o).reduce((a, b) => a + b, 0);
      const tel = document.createElement('div');
      tel.append(lista(
        tl('➕ Půjčit $10 000', () => { const x = H.uver(h, 10000); if (!x.ok) zprava(x.chyba, null, true); aktualizujListu(); oknoFinance(); }),
        tl('➖ Splatit $10 000', () => { const x = H.uver(h, -10000); if (!x.ok) zprava(x.chyba, null, true); aktualizujListu(); oknoFinance(); }),
      ));
      tel.append(el(`<table>
        <tr><td>Peníze</td><td><b class="${f.penize < 0 ? 'minus' : ''}">${penize(f.penize)}</b></td></tr>
        <tr><td>Úvěr</td><td>${penize(f.uver)} z ${penize(f.maxUver)} <small>(úrok ${Math.round(f.urok * 100)} % ročně)</small></td></tr>
        <tr><td>Hodnota firmy</td><td>${penize(H.hodnotaFirmy(h))}</td></tr>
        ${h.fin.odpisyLoni !== undefined ? `<tr><td>Odpisy loni</td><td>${penize(-h.fin.odpisyLoni)} <small>(pokles hodnoty vozidel)</small></td></tr>` : ''}
      </table>
      <div class="nadpis-roz">Příjmy a výdaje</div>
      <table class="fin">
        <tr><th></th><th class="cis">${r}</th><th class="cis">${r - 1}</th></tr>${radky || '<tr><td colspan="3"><small>Zatím žádné.</small></td></tr>'}
        <tr class="soucet"><td>Celkem</td><td class="cis${soucet(h.fin.letos) < 0 ? ' minus' : ''}">${penize(soucet(h.fin.letos))}</td><td class="cis${soucet(h.fin.loni) < 0 ? ' minus' : ''}">${penize(soucet(h.fin.loni))}</td></tr>
      </table>`));
      // graf peněz za posledních 24 měsíců
      const mes = h.fin.mesice.slice(-24);
      if (mes.length > 1) {
        const c = document.createElement('canvas'); c.width = 300; c.height = 70; c.className = 'graf';
        const g = c.getContext('2d'), mn = Math.min(0, ...mes.map(x => x.penize)), mx = Math.max(1, ...mes.map(x => x.penize));
        const yy = v => 64 - (v - mn) / (mx - mn || 1) * 58;
        g.strokeStyle = 'rgba(128,128,128,.5)'; g.beginPath(); g.moveTo(0, yy(0)); g.lineTo(300, yy(0)); g.stroke();
        g.strokeStyle = '#4fb06a'; g.lineWidth = 2; g.beginPath();
        mes.forEach((x, k) => g[k ? 'lineTo' : 'moveTo'](k / (mes.length - 1) * 296 + 2, yy(x.penize))); g.stroke();
        const pop = document.createElement('small');
        pop.textContent = `Peníze: ${NAZVY_MES[mes[0].mesic - 1]} ${mes[0].rok} – ${NAZVY_MES[mes[mes.length - 1].mesic - 1]} ${mes[mes.length - 1].rok}`;
        tel.append(c, pop);
      }
      U.okno('finance', '💰 Finance', tel, [10, 10]);
    });
  }

  // --- vozidla --------------------------------------------------------------------------------------------------
  function stavVozidla(h, v) {
    if (v.vyjetPo !== undefined) return '⏳ Čeká v depu, až dojede a prodá se starý vlak';
    if (v.stav === 'depo') return { lod: '⚓ V loděnici', let: '🛬 V hangáru', vlak: '🏭 V depu' }[v.druh] || '🅿️ V garáži';
    if (v.hlasenoZtraceni) return '⚠️ Nemůže najít cestu';
    if (!v.bezi) return '⏸ Stojí';
    if (v.porucha > 0) return '💥 Porucha – opravuje se';
    if (v.doServisu) return v.druh === 'vlak' ? '🔧 Jede na servis do depa' : '🔧 Jede na servis do garáže';
    if (v.stav === 'naklada') { const st = h.stanice[v.cil && v.cil.st]; return `⏳ Nakládá – ${st ? st.jmeno : ''}`; }
    if (v.doGaraze) return v.prodat ? '💲 Jede do garáže k prodeji' : '➡️ Do garáže';
    const r = v.rozkazy[v.ri], st = r && h.stanice[r.st];
    return st ? `➡️ Jede do ${st.jmeno}` : '➡️ Jede';
  }
  function oknoVozidla(id) {
    vybraneVozidlo = id;
    const kresli = () => {
      const h = U.hra, v = h.vozidla[id];
      if (!H.aktivni(v)) { U.zavriOkno('voz' + id); return; }
      const t = D.VOZIDLA_PODLE_ID[v.typ];
      // náklad sečtený podle druhu (vlak má víc vagonů) – pruh naplnění
      const souhrn = {};
      for (const o of v.oddily) { const x = souhrn[o.typ] || (souhrn[o.typ] = [0, 0]); x[0] += o.n; x[1] += o.kap; }
      const nakladHtml = Object.entries(souhrn).map(([k, [n, kap]]) => `<div class="plneni" style="--p:${kap ? Math.round(n / kap * 100) : 0}%" title="${esc(D.NAKLADY_PODLE_ID[k].nazev)}">${ikN(k)} <span>${n} / ${kap}</span><i></i></div>`).join('') || '<small>žádné vagony</small>';
      const pos = v.posledni && h.stanice[v.posledni.st];
      const posHtml = v.posledni ? `<div class="posledni">Poslední tržba <b class="plus">+${penize(v.posledni.castka)}</b>${pos ? ` · ${esc(pos.jmeno)}` : ''} · ${h.den - v.posledni.den ? `před ${h.den - v.posledni.den} d` : 'dnes'}</div>` : '';
      const spol = Math.round((v.spol ?? 1) * 100);
      const souhrnHtml = `<div class="souhrn"><span>Zisk letos <b class="${v.zisk.letos < 0 ? 'minus' : ''}">${penize(v.zisk.letos)}</b></span><span>loni <b class="${v.zisk.loni < 0 ? 'minus' : ''}">${penize(v.zisk.loni)}</b></span><span title="Spolehlivost (servis ji vrací na 100 %)">🔧 <b class="${spol < 60 ? 'minus' : ''}">${spol} %</b></span>${v.stari > t.zivot * 365 ? '<span><b class="minus">dosloužilo</b></span>' : ''}</div>`;
      const tel = el(`<div class="voz-hlava"><div class="model-obr voz-obr"></div><div class="voz-info">
          <div class="stavvoz">${esc(stavVozidla(h, v))}</div>${nakladHtml}${posHtml}${souhrnHtml}</div></div>`);
      // lišta hlavních akcí hned nahoře
      const lis = document.createElement('div'); lis.className = 'lista lista-voz';
      lis.append(
        tl(v.bezi ? '⏸ Zastavit' : '▶ Spustit', () => { const x = H.spust(h, id); if (!x.ok && x.chyba) zprava(x.chyba, null, true); kresli(); }),
        tl('🎯', () => { const p = polohaV(h, v); if (p) U.naPole(Math.floor(p.x), Math.floor(p.y)); else if (v.druh === 'let') { const st = h.stanice[v.letiste]; if (st) U.naPole(st.x, st.y); } else { const g = h.depa[v.depo]; if (g) U.naPole(g.x, g.y); } }, 'Ukázat na mapě'),
        tl('👁', () => { sledovane = sledovane === id ? null : id; kresli(); }, 'Sledovat kamerou'),
      );
      lis.lastChild.classList.toggle('zap', sledovane === id);
      if (v.stav !== 'depo' && !v.prodat) lis.append(tl({ vlak: '🏭', lod: '⚓', let: '🛬' }[v.druh] || '🅿️', () => { H.doGaraze(h, id); kresli(); }, { vlak: 'Do depa', lod: 'Do loděnice', let: 'Do hangáru' }[v.druh] || 'Do garáže'));
      // prodej: v garáži hned, jinak poslat do garáže a prodat po příjezdu (jde zrušit)
      const cenaProdeje = penize(H.hodnotaVozidla(h, v));
      if (v.stav === 'depo') lis.append(tl(`💲 Prodat ${cenaProdeje}`, async () => {
        if (!(await Dialog.potvrd(`Prodat ${v.jmeno} za ${cenaProdeje}?`))) return;
        H.prodej(h, id); aktualizujListu(); U.zavriOkno('voz' + id); obnovOkna();
      }, 'Prodat hned'));
      else if (v.prodat) { const b = tl('💲 Zrušit prodej', () => { H.prodatPoPrijezdu(h, id, false); kresli(); }, 'Vrátit vozidlo na trasu'); b.classList.add('zap'); lis.append(b); }
      else lis.append(tl('💲 Prodat', async () => {
        if (!(await Dialog.potvrd(`${v.jmeno} pojede do garáže a po příjezdu se prodá (teď za ${cenaProdeje}). Pokračovat?`))) return;
        H.prodatPoPrijezdu(h, id); kresli();
      }, 'Poslat do garáže a tam prodat'));
      if (v.nahrazeno === undefined && !v.prodat && v.stari > t.zivot * 365 - 365) {
        const b = tl('🔄 Nahradit', () => nahraditVozidlo(id), 'Koupit nový model, převzít trasu a staré prodat');
        b.classList.add('zap'); lis.append(b);
      }
      lis.append(tl('✏️', async () => { const j = await Dialog.zeptej('Nové jméno vozidla', v.jmeno); if (j && j.trim()) { v.jmeno = j.trim().slice(0, 40); kresli(); } }, 'Přejmenovat'));
      tel.prepend(lis);   // lišta úplně nahoře – obsah pod ní se mění, tlačítka nesmí uskakovat
      if (v.druh === 'vlak') tel.append(vagonyVlaku(h, v, kresli));
      // rozkazy
      const hl = el('<div class="nadpis-roz">Rozkazy</div>').firstChild;
      tel.append(hl);
      const roz = document.createElement('ol'); roz.className = 'rozkazy';
      v.rozkazy.forEach((r, k) => {
        const st = h.stanice[r.st], li = document.createElement('li');
        if (k === v.ri && v.stav !== 'depo') li.className = 'aktualni';
        const n = document.createElement('button'); n.className = 'jm'; n.textContent = st ? st.jmeno : '?'; n.title = 'Ukázat stanici';
        n.addEventListener('click', () => st && U.naPole(st.x, st.y));
        const prepni = (pole, text, tit, fn) => { const b = tl(text, fn || (() => { H.nastavRozkaz(h, id, k, { [pole]: !r[pole] }); kresli(); }), tit); b.classList.toggle('zap', !!r[pole]); return b; };
        const p = prepni('plne', 'plně', 'Čekat na plné naložení', () => { H.prepniPlne(h, id, k); kresli(); });
        const vy = prepni('vyloz', 'vylož', 'Vyložit všechno – co stanice nepřijímá, zůstane tu pro další vozidlo (přeložení)');
        const nn = prepni('nenakladej', 'nenakl.', 'Tady nic nenakládat');
        const sv = prepni('presDepo', '🔧', 'Po zastávce zajet na servis');
        const STATI = [0, 1, 3, 7];
        const stb = tl(r.stat ? `⏱️ ${r.stat} d` : '⏱️', () => { H.nastavRozkaz(h, id, k, { stat: STATI[(STATI.indexOf(r.stat || 0) + 1) % STATI.length] }); kresli(); }, 'Jízdní řád: stát na zastávce aspoň N dní');
        stb.classList.toggle('zap', !!r.stat);
        const x = tl('✕', () => { H.odeberRozkaz(h, id, k); kresli(); }, 'Odebrat');
        const volby = document.createElement('span'); volby.className = 'volby-rozkazu';
        volby.append(p, vy, nn, sv, stb, x);
        li.append(n, volby); roz.append(li);
      });
      if (!v.rozkazy.length) { const li = document.createElement('li'); li.className = 'prazdne'; li.textContent = 'Žádné – přidej aspoň dvě zastávky'; roz.append(li); }
      tel.append(roz);
      const r1 = document.createElement('div'); r1.className = 'radek-tl';
      const pridat = tl(cekaRozkaz === id ? '➕ Klikni na zastávku v mapě… (Esc)' : '➕ Přidat zastávku', () => {
        U.zrusNastroj(); cekaRozkaz = id;
        $('stNastroj').textContent = `➕ ${v.jmeno}: klikni na zastávku, kterou má obsluhovat (Esc konec)`; $('stNastroj').hidden = false; kresli();
      });
      pridat.classList.toggle('zap', cekaRozkaz === id);
      r1.append(pridat);
      tel.append(r1);
      // rozestupy na lince
      const roz2 = document.createElement('label'); roz2.className = 'volba-radek';
      roz2.innerHTML = `<input type="checkbox"${v.rozestupy ? ' checked' : ''}> Rozestupy na lince <small>(čeká na zastávce, aby vozidla se stejnými rozkazy jezdila rovnoměrně)</small>`;
      roz2.querySelector('input').addEventListener('change', e => { v.rozestupy = e.target.checked; });
      tel.append(roz2);
      // přestavba v depu (prázdný oddíl na jiný náklad)
      if (v.stav === 'depo' && v.druh !== 'let') {
        const prest = document.createElement('div'); prest.className = 'prestavba';
        v.oddily.forEach((o, k) => {
          const povolene = o.vagon ? D.VAGONY_PODLE_ID[o.vagon].naklady : t.naklady;
          if (povolene.length < 2) return;
          const sel = document.createElement('select'); sel.setAttribute('aria-label', 'Náklad oddílu');
          for (const n of povolene) { const op = document.createElement('option'); op.value = n; op.textContent = `${D.NAKLADY_PODLE_ID[n].ikona} ${D.NAKLADY_PODLE_ID[n].nazev}`; op.selected = n === o.typ; sel.append(op); }
          const cena = H.prestav(h, id, k, povolene.find(n => n !== o.typ), true);
          const b = tl(`Přestavět${cena.ok ? ` (${penize(cena.cena)})` : ''}`, () => { const x = H.prestav(h, id, k, sel.value); if (!x.ok) zprava(x.chyba, null, true); aktualizujListu(); kresli(); });
          const r = document.createElement('div'); r.className = 'radek-tl';
          r.append(document.createTextNode(v.oddily.length > 1 ? `${k + 1}. vagon: ` : 'Náklad: '), sel, b);
          prest.append(r);
        });
        if (prest.children.length) { tel.append(el('<div class="nadpis-roz">Přestavba</div>'), prest); }
      }
      // podrobnosti dole
      tel.append(sekce('voz:podrobnosti', 'Podrobnosti', `<table>
          <tr><td>Typ</td><td>${t.ikona} ${esc(t.nazev)} · ${v.druh === 'vlak' ? `${Z.maxRychlost(v)} km/h · ${Math.round(Z.hmotnost(v))} t${v.stav === 'jede' ? ` · jede ${Math.round(v.rych)} km/h` : ''}` : `${t.rychlost} km/h`}</td></tr>
          <tr><td>Zisk letos</td><td class="${v.zisk.letos < 0 ? 'minus' : ''}">${penize(v.zisk.letos)}</td></tr>
          <tr><td>Zisk loni</td><td class="${v.zisk.loni < 0 ? 'minus' : ''}">${penize(v.zisk.loni)}</td></tr>
          <tr><td>Stáří</td><td>${v.stari > t.zivot * 365 ? `<b class="minus">${(v.stari / 365).toFixed(1)} let – dosloužilo</b>` : `${(v.stari / 365).toFixed(1)} z ${t.zivot} let`}</td></tr>
          <tr><td>Hodnota</td><td>${penize(H.hodnotaVozidla(h, v))}</td></tr>
          <tr><td>Spolehlivost</td><td><span class="hodn" style="--h:${spol}%">${spol} %</span> · servis před ${v.servis || 0} dny${v.poruch ? ` · poruch ${v.poruch}` : ''}</td></tr>
        </table>`));
      if (!obrazekVozidla(tel.querySelector('.voz-obr'), v.typ, h.firma.barva, 0, 1.15)) tel.querySelector('.voz-obr').remove();
      U.okno('voz' + id, `${t.ikona} ${v.jmeno}`, tel);
    };
    zive('voz' + id, kresli);
  }
  // vagony: seznam, přidání a odebrání (jen v depu)
  function vagonyVlaku(h, v, kresli) {
    const box = document.createElement('div');
    box.append(el(`<div class="nadpis-roz">Vagony (${v.oddily.length}) · délka ${Z.delkaVlaku(v).toFixed(1)} pole</div>`));
    const sez = document.createElement('div'); sez.className = 'vagony';
    v.oddily.forEach((o, k) => {
      const w = D.VAGONY_PODLE_ID[o.vagon], n = D.NAKLADY_PODLE_ID[o.typ];
      const radek = document.createElement('span'); radek.className = 'vagon'; radek.style.setProperty('--b', w.barva);
      radek.style.setProperty('--p', `${o.kap ? Math.round(o.n / o.kap * 100) : 0}%`); radek.style.setProperty('--c', n.barva);
      radek.title = `${w.nazev}: ${n.nazev} ${o.n}/${o.kap}`;
      radek.innerHTML = ikN(o.typ, 18);
      if (v.stav === 'depo') radek.append(tl('✕', () => { const x = Z.odeberVagon(h, v.id, k); if (!x.ok) zprava(x.chyba, null, true); aktualizujListu(); kresli(); }, 'Odebrat (vrátí 60 % ceny)'));
      sez.append(radek);
    });
    box.append(sez);
    if (v.stav === 'depo') {
      const r = document.createElement('div'); r.className = 'radek-tl';
      const vyber = document.createElement('select'); vyber.setAttribute('aria-label', 'Vagon');
      for (const w of D.VAGONY.filter(w => H.rok(h) >= w.od)) for (const k of w.naklady) {
        const o = document.createElement('option'); o.value = w.id + ':' + k;
        o.textContent = `${D.NAKLADY_PODLE_ID[k].ikona} ${w.nazev} – ${D.NAKLADY_PODLE_ID[k].nazev} (${penize(w.cena)})`; vyber.append(o);
      }
      if (box.dataset.posledni) vyber.value = box.dataset.posledni;
      r.append(vyber, tl('➕ Přidat vagon', () => {
        const [w, k] = vyber.value.split(':');
        const x = Z.pridejVagon(h, v.id, w, k);
        if (!x.ok) zprava(x.chyba, null, true);
        posledniVagon = vyber.value; aktualizujListu(); kresli();
      }));
      if (posledniVagon) vyber.value = posledniVagon;
      box.append(r);
    } else box.append(el('<small>Vagony jde měnit jen v depu.</small>'));
    return box;
  }
  let posledniVagon = null;

  let filtrVozidel = '';
  function oknoSeznamVozidel() {
    zive('seznamVoz', () => {
      const h = U.hra, obal = document.createElement('div'), tel = document.createElement('div'); tel.className = 'seznam';
      const vsechna = h.vozidla.filter(H.aktivni);
      // filtr podle druhu (jen druhy, které firma má)
      const DRUHY = [['bus', '🚌'], ['nakl', '🚚'], ['vlak', '🚂'], ['lod', '🚢'], ['let', '✈️']].filter(([d]) => vsechna.some(v => v.druh === d));
      if (DRUHY.length > 1) {
        const f = document.createElement('div'); f.className = 'radek-tl filtr';
        for (const [d, ik] of [['', 'Vše'], ...DRUHY]) { const b = tl(d ? `${ik} ${vsechna.filter(v => v.druh === d).length}` : ik, () => { filtrVozidel = d; oknoSeznamVozidel(); }); b.classList.toggle('zap', filtrVozidel === d); f.append(b); }
        obal.append(f);
      }
      const vs = vsechna.filter(v => !filtrVozidel || v.druh === filtrVozidel);
      if (!vsechna.length) tel.append(el('<p>Zatím žádná vozidla. Postav garáž (⇧D) a kup v ní vozidlo.</p>'));
      for (const v of vs) {
        const b = tl('', () => oknoVozidla(v.id));
        const kap = v.oddily.reduce((a, o) => a + o.kap, 0), n = v.oddily.reduce((a, o) => a + o.n, 0);
        b.innerHTML = `<span>${D.VOZIDLA_PODLE_ID[v.typ].ikona} ${esc(v.jmeno)}<br><small>${esc(stavVozidla(h, v))}</small></span><span class="pravo"><span class="mini-plneni" style="--p:${kap ? Math.round(n / kap * 100) : 0}%" title="Naloženo ${n} / ${kap}"></span><small class="${v.zisk.loni < 0 ? 'minus' : ''}">${penize(v.zisk.letos)}<br>${penize(v.zisk.loni)}</small></span>`;
        tel.append(b);
      }
      obal.append(tel);
      U.okno('seznamVoz', `🚌 Vozidla (${vsechna.length}) – zisk letos / loni`, obal, [10, 10]);
    });
  }

  // --- stanice ------------------------------------------------------------------------------------------------
  function oknoStanice(id) {
    vybranaStanice = id; U.prekresli();
    zive('st' + id, () => {
      const h = U.hra, st = h.stanice[id];
      if (!st) { U.zavriOkno('st' + id); return; }
      const tel = document.createElement('div');
      const letiste = VV.letisteStanice(st);
      tel.append(lista(
        tl('🎯 Ukázat', () => U.naPole(st.x, st.y)),
        letiste && tl('🛒 Koupit letadlo', () => oknoKatalogu(st.id, true)),
        tl('✏️', async () => { const j = await Dialog.zeptej('Nové jméno stanice', st.jmeno); if (j && j.trim()) { st.jmeno = j.trim().slice(0, 40); obnovOkna(); } }, 'Přejmenovat'),
      ));
      const pocet = d => st.casti.filter(c => c.druh === d).length;
      const casti = [['vlak', '🚉', 'nástupiště'], ['bus', '🚏', 'zastávka'], ['nakl', '🚚', 'stanoviště'], ['lod', '⚓', 'přístav'], ['let', '✈️', 'letiště'], ['boje', '🛟', 'bóje']]
        .filter(([d]) => pocet(d)).map(([d, ik, n]) => `<span class="stitek">${ik} ${pocet(d)}× ${n}</span>`).join(' ');
      const prijima = Object.keys(st.prijima).map(k => `<span class="stitek">${ikN(k, 16)} ${esc(D.NAKLADY_PODLE_ID[k].nazev)}</span>`).join(' ') || '<small>nic</small>';
      const nak = Object.entries(st.naklady).filter(([, z]) => z.navst);
      tel.append(el(`<table>
        <tr><td>Části</td><td>${casti}</td></tr>
        <tr><td>Přijímá</td><td>${prijima}</td></tr>
      </table>
      <div class="nadpis-roz">Čeká na odvoz</div>
      ${nak.length ? `<table class="fin ceka"><tr><th></th><th class="cis">kusů</th><th class="cis">hodnocení</th></tr>
        ${nak.map(([k, z]) => `<tr><td>${ikN(k)} ${esc(D.NAKLADY_PODLE_ID[k].nazev)}</td><td class="cis">${z.ceka}</td><td class="cis"><span class="hodn" style="--h:${Math.round(z.hodn / 2.55)}%">${Math.round(z.hodn / 2.55)} %</span></td></tr>`).join('')}</table>`
        : '<small>Zatím sem nepřijelo žádné vozidlo – náklad se začne hromadit po první návštěvě.</small>'}`));
      // vozidla, která stanici mají v rozkazech
      const obsl = h.vozidla.filter(v => H.aktivni(v) && v.rozkazy.some(r => r.st === st.id));
      const sez = document.createElement('div'); sez.className = 'seznam';
      for (const v of obsl) {
        const b = tl('', () => oknoVozidla(v.id));
        const kap = v.oddily.reduce((a, o) => a + o.kap, 0), n = v.oddily.reduce((a, o) => a + o.n, 0);
        b.innerHTML = `<span>${D.VOZIDLA_PODLE_ID[v.typ].ikona} ${esc(v.jmeno)}<br><small>${esc(stavVozidla(h, v))}</small></span><span class="pravo"><span class="mini-plneni" style="--p:${kap ? Math.round(n / kap * 100) : 0}%" title="Naloženo ${n} / ${kap}"></span></span>`;
        sez.append(b);
      }
      if (!obsl.length) sez.append(el('<small>Žádné vozidlo tu zatím nestaví – přidej stanici do rozkazů vozidla.</small>'));
      tel.append(el(`<div class="nadpis-roz">Obsluhují (${obsl.length})</div>`), sez);
      if (letiste) {
        const hangar = h.vozidla.filter(v => H.aktivni(v) && v.druh === 'let' && v.stav === 'depo' && v.letiste === st.id);
        const hs = document.createElement('div'); hs.className = 'seznam';
        for (const v of hangar) { const b = tl('', () => oknoVozidla(v.id)); b.innerHTML = `<span>${D.VOZIDLA_PODLE_ID[v.typ].ikona} ${esc(v.jmeno)}</span><small>${v.rozkazy.length} rozkazů</small>`; hs.append(b); }
        if (!hangar.length) hs.append(el('<small>Prázdný.</small>'));
        tel.append(el(`<div class="nadpis-roz">🛬 Hangár (${hangar.length})</div>`), hs);
      }
      const o = U.okno('st' + id, `🚏 ${st.jmeno}`, tel);
      if (!o.dataset.hlidam) { o.dataset.hlidam = 1; o.querySelector('.ok-hlava button').addEventListener('click', () => { if (vybranaStanice === id) { vybranaStanice = null; U.prekresli(); } }); }
    });
  }
  function oknoSeznamStanic() {
    zive('seznamSt', () => {
      const h = U.hra, tel = document.createElement('div'); tel.className = 'seznam';
      const sts = h.stanice.filter(Boolean);
      if (!sts.length) tel.append(el('<p>Zatím žádné stanice. Zastávka autobusu (B) se staví na silnici ve městě.</p>'));
      for (const st of sts) {
        const b = tl('', () => { U.naPole(st.x, st.y); oknoStanice(st.id); });
        const cek = Object.entries(st.naklady).filter(([, z]) => z.ceka).map(([k, z]) => `${ikN(k, 16)}${z.ceka}`).join(' ');
        b.innerHTML = `<span>${esc(st.jmeno)}</span><small>${cek}</small>`;
        tel.append(b);
      }
      U.okno('seznamSt', `🚏 Stanice (${sts.length})`, tel, [10, 10]);
    });
  }

  // --- financování podniku ---------------------------------------------------------------------------------------------
  const MISTO = { kopce: 'v kopcích', les: 'v lese', rovina: 'na rovině v nížině', pobrezi: 'u moře', mesto: '5–16 polí od města', kdekoli: 'kdekoli (7+ polí od města)', voda: 'u vody (moře, jezero, řeka)' };
  function oknoFinancovani() {
    const h = U.hra, tel = document.createElement('div');
    tel.append(el('<small>Vyber druh, pak klikni na mapu na levý horní roh pozemku. Podnik musí mít kolem sebe volno a odstup od jiných podniků.</small>'));
    const sez = document.createElement('div'); sez.className = 'katalog';
    for (const p of D.PRUMYSL) {
      const cena = D.CENY.podnik[p.id];
      if (!cena) continue;
      const vyr = Object.keys(p.vyroba).map(k => ikN(k, 14)).join(''), pri = p.prijima.map(k => ikN(k, 14)).join('');
      const box = document.createElement('div'); box.className = 'model';
      box.innerHTML = `<div class="model-obr" style="font-size:1.6rem;width:42px;text-align:center">${p.ikona}</div>
        <div class="model-info"><b>${esc(p.nazev)}</b> <small>${p.rozmer[0]} × ${p.rozmer[1]}</small>
          <div class="cipy">${pri ? `<span title="Přijímá">⬇ ${pri}</span>` : ''}${vyr ? `<span title="Vyrábí">⬆ ${vyr}</span>` : ''}<span>📍 ${MISTO[p.misto] || p.misto}</span></div></div>
        <div class="model-koupit"></div>`;
      const b = tl(`🏗️ ${penize(cena)}`, () => { U.podnikTyp = p.id; if (U.nastroj !== 'podnik') vyberNastroj('podnik'); $('stNastroj').textContent = `🏗️ ${p.nazev}: klikni na levý horní roh pozemku (Esc konec)`; }, `Postavit za ${penize(cena)}`);
      b.classList.toggle('drahe', h.firma.penize < cena);
      box.querySelector('.model-koupit').append(b);
      sez.append(box);
    }
    tel.append(sez);
    U.okno('financovani', '🏗️ Financovat podnik', tel, [10, 10]);
  }

  // --- garáž a nákup ------------------------------------------------------------------------------------------
  function oknoGaraze(id) {
    zive('gar' + id, () => {
      const h = U.hra, g = h.depa[id];
      if (!g) { U.zavriOkno('gar' + id); return; }
      const tel = document.createElement('div');
      tel.append(lista(
        tl(g.druh === 'kolej' ? '🛒 Koupit lokomotivu' : g.druh === 'lod' ? '🛒 Koupit loď' : '🛒 Koupit vozidlo', () => oknoKatalogu(id)),
        tl('🎯 Ukázat', () => U.naPole(g.x, g.y)),
      ));
      const radek = v => {
        const b = tl('', () => oknoVozidla(v.id));
        const zisk = v.zisk.letos;
        b.innerHTML = `<span>${D.VOZIDLA_PODLE_ID[v.typ].ikona} ${esc(v.jmeno)}<br><small>${esc(stavVozidla(h, v))}</small></span><small class="${zisk < 0 ? 'minus' : ''}">${penize(zisk)}</small>`;
        return b;
      };
      const vs = h.vozidla.filter(v => H.aktivni(v) && v.stav === 'depo' && v.depo === id);
      const sez = document.createElement('div'); sez.className = 'seznam';
      for (const v of vs) sez.append(radek(v));
      if (!vs.length) sez.append(el(`<small>Prázdná – vozidlo kup tlačítkem nahoře.</small>`));
      tel.append(el(`<div class="nadpis-roz">Stojí tu (${vs.length})</div>`), sez);
      const venku = h.vozidla.filter(v => H.aktivni(v) && v.stav !== 'depo' && v.depo === id);
      if (venku.length) {
        const s2 = document.createElement('div'); s2.className = 'seznam';
        for (const v of venku) s2.append(radek(v));
        tel.append(el(`<div class="nadpis-roz">Na trase (${venku.length})</div>`), s2);
      }
      U.okno('gar' + id, g.druh === 'kolej' ? `🏭 Depo ${id + 1}` : g.druh === 'lod' ? `⚓ Loděnice ${id + 1}` : `🅿️ Garáž ${id + 1}`, tel);
    });
  }
  let zalozkaKatalogu = {};   // druh garáže → vybraná skupina
  function oknoKatalogu(gId, letiste) {
    const h = U.hra, r = H.rok(h), druhDepa = letiste ? 'let' : h.depa[gId] && h.depa[gId].druh, zelezn = druhDepa === 'kolej';
    const skupiny = zelezn ? [['vlak', '🚂 Lokomotivy']] : druhDepa === 'lod' ? [['lod', '🚢 Lodě']] : druhDepa === 'let' ? [['let', '✈️ Letadla'], ['heli', '🚁 Vrtulníky']]
      : [['bus', '🚌 Autobusy'], ['tram', '🚋 Tramvaje'], ['posta', '📮 Pošta'], ['nakl', '🚚 Nákladní']];
    const patri = (t, sk) => r >= t.od && r <= t.do && (
      sk === 'let' || sk === 'heli' ? t.druh === 'let' && !!t.vrtulnik === (sk === 'heli') && (!letiste || !!VV.letisteStanice(h.stanice[gId], { typ: t.id }))
        : sk === 'vlak' || sk === 'lod' ? t.druh === sk
          : sk === 'bus' ? t.druh === 'bus' && !t.tram : sk === 'tram' ? !!t.tram
            : sk === 'posta' ? t.naklady[0] === 'posta' : t.druh === 'nakl' && t.naklady[0] !== 'posta');
    const neprazdne = skupiny.filter(([sk]) => D.VOZIDLA.some(t => patri(t, sk)));
    const klic = druhDepa || 'silnice';
    let sk = zalozkaKatalogu[klic];
    if (!neprazdne.some(([k]) => k === sk)) sk = neprazdne.length ? neprazdne[0][0] : null;
    const tel = document.createElement('div'); tel.className = 'katalog';
    if (neprazdne.length > 1) {
      const z = document.createElement('div'); z.className = 'lista';
      for (const [k, nazev] of neprazdne) { const b = tl(nazev, () => { zalozkaKatalogu[klic] = k; oknoKatalogu(gId, letiste); }); b.classList.toggle('zap', k === sk); z.append(b); }
      tel.append(z);
    }
    if (zelezn) tel.append(el('<small>Vagony se přidávají v okně vlaku, dokud stojí v depu.</small>'));
    // nejnovější modely nahoře
    const typy = sk ? D.VOZIDLA.filter(t => patri(t, sk)).sort((a, b) => b.od - a.od) : [];
    if (!typy.length) tel.append(el('<small>V tomto roce se nic nevyrábí.</small>'));
    for (const t of typy) {
      const box = document.createElement('div'); box.className = 'model';
      const nk = t.naklady.map(k => D.NAKLADY_PODLE_ID[k]);
      const kap = t.druh === 'let' ? `${t.kapacita} míst + ${t.kapacitaPosta} pošty` : t.druh === 'lod' ? `${t.kapacita} ${t.naklady[0] === 'lide' ? 'míst' : 't'}` : t.druh === 'vlak' ? `${t.vykon} kW · ${t.hmotnost} t` : `${t.kapacita} ${t.druh === 'bus' ? 'míst' : t.naklady[0] === 'posta' ? 'pytlů' : 't'}`;
      const pozn = [t.trakce === 'elektro' && '⚡ jen pod trolejí', t.tram && '🚋 jen po tramvajové koleji', t.velke && '🛫 patří na velké letiště', t.vrtulnik && '🚁 i na heliport',
        t.trakce === 'para' && 'pára', t.trakce === 'diesel' && 'diesel'].filter(Boolean);
      box.innerHTML = `<div class="model-obr"></div>
        <div class="model-info"><b>${esc(t.nazev)}</b> <small>od ${t.od}</small>
          <div class="cipy"><span title="Rychlost">🏁 ${t.rychlost} km/h</span><span title="${t.druh === 'vlak' ? 'Výkon a hmotnost' : 'Kapacita'}">${t.druh === 'vlak' ? '💪' : '📦'} ${kap}</span><span title="Provoz za rok">🔧 ${penize(t.provoz)}/rok</span><span title="Životnost">⏳ ${t.zivot} let</span></div>
          ${pozn.length ? `<small class="pozn">${pozn.join(' · ')}</small>` : ''}</div>
        <div class="model-koupit"></div>`;
      const kou = box.querySelector('.model-koupit');
      let vyber = null;
      if (nk.length > 1) {
        vyber = document.createElement('select');
        vyber.setAttribute('aria-label', 'Náklad');
        for (const n of nk) { const o = document.createElement('option'); o.value = n.id; o.textContent = `${n.ikona} ${n.nazev}`; vyber.append(o); }
      }
      const koupit = tl(`🛒 ${penize(t.cena)}`, () => {
        const x = H.kup(h, gId, t.id, vyber ? vyber.value : t.naklady[0]);
        if (!x.ok) { zprava(x.chyba, null, true); return; }
        aktualizujListu(); obnovOkna();
        const v = h.vozidla[h.vozidla.length - 1];
        U.zavriOkno('katalog');
        oknoVozidla(v.id);
        zprava(v.druh === 'vlak' ? `Koupeno: ${v.jmeno}. Přidej vagony a rozkazy, pak ho spusť.` : `Koupeno: ${v.jmeno}. Přidej mu rozkazy a spusť ho.`);
      }, `Koupit za ${penize(t.cena)}`);
      koupit.classList.toggle('drahe', h.firma.penize < t.cena);
      kou.append(koupit); if (vyber) kou.append(vyber);
      tel.append(box);
      if (!obrazekVozidla(box.querySelector('.model-obr'), t.id, h.firma.barva, 0, 0.95)) box.querySelector('.model-obr').remove();
    }
    U.okno('katalog', `🛒 Koupit (${r})`, tel);
  }

  // --- ukládání --------------------------------------------------------------------------------------------------------
  const DB = 'webapp_hra_magnat', STORE = 'hry';
  function otevriDb() {
    return new Promise((ok, chyba) => {
      if (!window.indexedDB) return chyba(new Error('Prohlížeč neumí IndexedDB'));
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => ok(r.result); r.onerror = () => chyba(r.error);
    });
  }
  async function dbOp(mod, fn) {
    const db = await otevriDb();
    return new Promise((ok, chyba) => {
      const tx = db.transaction(STORE, mod), st = tx.objectStore(STORE), r = fn(st);
      tx.oncomplete = () => { db.close(); ok(r && r.result); }; tx.onerror = () => { db.close(); chyba(tx.error); };
    });
  }
  async function zabal(obj) {
    const json = JSON.stringify(obj);
    if (typeof CompressionStream === 'undefined') return new Blob([json], { type: 'application/json' });
    return new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
  }
  async function rozbal(blob) {
    const zac = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
    if (zac[0] === 0x1f && zac[1] === 0x8b) return JSON.parse(await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text());
    return JSON.parse(await blob.text());
  }
  async function uloz(slot, nazev) {
    const h = U.hra;
    const data = await zabal({ ...H.serializuj(h), kamera: { x: U.kamera.x, y: U.kamera.y } });
    await dbOp('readwrite', st => st.put({ nazev: nazev || h.firma.jmeno, datum: datumText(h), penize: Math.round(h.firma.penize), ulozeno: Date.now(), data }, slot));
  }
  let ukladam = false;
  async function ulozAuto() {
    if (ukladam || !U.hra) return;
    ukladam = true;
    try { await uloz('auto', 'Automaticky'); } catch (e) { /* bez úložiště hra běží dál */ }
    ukladam = false;
  }
  U.nactiAuto = async () => {
    try {
      const z = await dbOp('readonly', st => st.get('auto'));
      if (!z) return null;
      const o = await rozbal(z.data);
      return { hra: H.deserializuj(o), kamera: o.kamera };
    } catch (e) { return null; }
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) ulozAuto(); });
  window.addEventListener('pagehide', ulozAuto);

  async function oknoUlozeni() {
    let sloty = {};
    try { const klice = await dbOp('readonly', st => st.getAllKeys()); for (const k of klice) sloty[k] = await dbOp('readonly', st => st.get(k)); }
    catch (e) { zprava('Úložiště prohlížeče není dostupné – použij export do souboru', null, true); }
    const tel = document.createElement('div');
    const sez = document.createElement('div'); sez.className = 'sloty';
    for (const k of ['auto', 'slot1', 'slot2', 'slot3', 'slot4', 'slot5']) {
      const z = sloty[k], radek = document.createElement('div'); radek.className = 'slot';
      radek.innerHTML = `<div><b>${k === 'auto' ? '⏱ Automaticky' : `Pozice ${k.slice(4)}`}</b><br><small>${z ? `${esc(z.datum)} · ${penize(z.penize)} · ${new Date(z.ulozeno).toLocaleString('cs-CZ')}` : 'prázdná'}</small></div>`;
      const b = document.createElement('div'); b.className = 'radek-tl';
      if (k !== 'auto') b.append(tl('💾 Uložit', async () => {
        if (z && !(await Dialog.potvrd('Přepsat uloženou hru?'))) return;
        try { await uloz(k); zprava('Hra uložena'); oknoUlozeni(); } catch (e) { zprava('Uložení se nepovedlo: ' + e.message, null, true); }
      }));
      if (z) b.append(tl('📂 Načíst', async () => {
        if (!(await Dialog.potvrd('Načíst uloženou hru? Neuložený postup se ztratí.'))) return;
        try { const o = await rozbal(z.data); U.zacniHru(H.deserializuj(o), o.kamera); zprava(`Načteno: ${z.datum}`); } catch (e) { zprava('Načtení se nepovedlo: ' + e.message, null, true); }
      }));
      if (z && k !== 'auto') b.append(tl('🗑', async () => { if (await Dialog.potvrd('Smazat uloženou hru?')) { await dbOp('readwrite', st => st.delete(k)); oknoUlozeni(); } }, 'Smazat'));
      radek.append(b); sez.append(radek);
    }
    tel.append(sez);
    const r = document.createElement('div'); r.className = 'radek-tl';
    r.append(tl('⬇️ Export do souboru', async () => {
      const blob = await zabal({ ...H.serializuj(U.hra), kamera: { x: U.kamera.x, y: U.kamera.y } });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const d = H.datum(U.hra);
      a.download = `magnat_${d.rok}-${String(d.mesic).padStart(2, '0')}.magnat`;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }), tl('⬆️ Import ze souboru', () => $('souborHry').click()));
    tel.append(r);
    U.okno('ulozeni', '💾 Uložit a načíst', tel, [10, 10]);
  }
  $('souborHry').addEventListener('change', async ev => {
    const f = ev.target.files[0]; ev.target.value = '';
    if (!f) return;
    try { const o = await rozbal(f); U.zacniHru(H.deserializuj(o), o.kamera); zprava('Hra načtena ze souboru'); }
    catch (e) { zprava('Soubor se nepodařilo načíst: ' + e.message, null, true); }
  });

  // --- nabídky ------------------------------------------------------------------------------------------------------------
  document.querySelectorAll('[data-nastroj]').forEach(b => b.addEventListener('click', () => vyberNastroj(b.dataset.nastroj)));
  $('miFinance').addEventListener('click', oknoFinance);
  $('miVozidla').addEventListener('click', oknoSeznamVozidel);
  $('miStanice').addEventListener('click', oknoSeznamStanic);
  $('miPodnik').addEventListener('click', oknoFinancovani);
  $('miUlozit').addEventListener('click', oknoUlozeni);
  $('stPenize').addEventListener('click', oknoFinance);
  // dotyk nemá Esc: klepnutí na popisek nástroje v liště nástroj ukončí
  $('stNastroj').addEventListener('click', () => U.zrusNastroj());
  $('stNastroj').title = 'Klepni pro ukončení nástroje (Esc)';

  // po načtení atlasů: ikony nástrojů do nabídek, úvodní obraz do dialogu a nápovědy
  U.poAtlasech = () => {
    const IK = { silnice: 0, bus: 1, nakl: 2, garaz: 3, kolej: 4, nadrazi: 5, depo: 6, navest: 7, navestJ: 8, zbor: 9,
      miFinance: 10, miVozidla: 11, miStanice: 12, miUlozit: 13, miNapoveda: 14, miNova: 15 };
    for (const [k, idx] of Object.entries(IK)) {
      const b = document.querySelector(`[data-nastroj="${k}"]`) || document.getElementById(k);
      const html = b && ikona('ikony2', idx, 18);
      if (!html || b.dataset.ikona) continue;
      b.dataset.ikona = 1;
      const t = b.firstChild;
      if (t && t.nodeType === 3) t.textContent = t.textContent.replace(/^\S+\s/, ' ');
      b.insertAdjacentHTML('afterbegin', html);
    }
    if (MAG.ATLAS && MAG.ATLAS.uvod) for (const [cil, trida] of [[document.querySelector('#dlgNova .dlg'), 'uvod'], [document.querySelector('#napoveda .ok-telo'), 'napoveda-uvod']]) {
      if (!cil || cil.querySelector('img.' + trida)) continue;
      const im = document.createElement('img'); im.className = trida; im.alt = ''; im.src = MAG.ATLAS.uvod.obr;
      cil.prepend(im);
    }
  };

  // obrázek vozidla z atlasu Blenderu (v barvě firmy) do prvku
  function obrazekVozidla(cil, typ, barva, smer = 0, meritko = 1.3) {
    const A = MAG.ATLAS_VOZ, f = A && A.snimky[typ] && A.snimky[typ][smer], bt = D.VOZIDLA_PODLE_ID[typ] && D.VOZIDLA_PODLE_ID[typ].barvaTypu;
    const typT = f && bt && MAG.grafika.snimkyTypu(typ, bt), atl = typT ? typT.c : f && MAG.grafika.atlasVozidel(barva);
    if (!atl) return false;
    const c = document.createElement('canvas'), d = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(f[2] * meritko * d); c.height = Math.round(f[3] * meritko * d);
    c.style.width = (f[2] * meritko) + 'px'; c.style.height = (f[3] * meritko) + 'px';
    c.getContext('2d').drawImage(atl, f[0] - (typT ? typT.x0 : 0), f[1] - (typT ? typT.y0 : 0), f[2], f[3], 0, 0, c.width, c.height);
    cil.replaceChildren(c);
    return true;
  }

  // nastavení firmy: jméno, barva, servis, obnova
  function oknoFirmy() {
    const h = U.hra, f = h.firma;
    const tel = document.createElement('div');
    tel.innerHTML = `<table>
      <tr><td>Jméno</td><td><input type="text" id="firmaJmeno" maxlength="40" value="${esc(f.jmeno)}" style="width:100%"></td></tr>
      <tr><td>Barva</td><td><div class="barvy">${D.BARVY_FIRMY.map(b => `<button class="barva${b === f.barva ? ' on' : ''}" data-b="${b}" style="background:${b}" aria-label="Barva ${b}"></button>`).join('')}</div></td></tr>
      <tr><td>Servis vozidel</td><td><select id="firmaServis">${[[0, 'vypnutý'], [90, 'každých 90 dní'], [150, 'každých 150 dní'], [250, 'každých 250 dní']].map(([n, t]) => `<option value="${n}"${(f.servis || 0) === n ? ' selected' : ''}>${t}</option>`).join('')}</select></td></tr>
      <tr><td>Obměna vozidel</td><td><label><input type="checkbox" id="firmaNahrazovat"${f.nahrazovat ? ' checked' : ''}> dosloužilé vozidlo automaticky nahradit novým – převezme trasu, staré se prodá</label>
        <label><input type="checkbox" id="firmaObnova"${f.obnova ? ' checked' : ''}${f.nahrazovat ? ' disabled' : ''}> nebo jen vyměnit model při servisu</label></td></tr>
    </table><small>Servis vrací spolehlivost na 100 %. Bez servisu se vozidla častěji porouchají; dosloužilá stárnou dvakrát rychleji.</small>`;
    tel.querySelector('#firmaJmeno').addEventListener('change', e => { f.jmeno = e.target.value.trim().slice(0, 40) || f.jmeno; });
    tel.querySelector('#firmaServis').addEventListener('change', e => { f.servis = +e.target.value; });
    tel.querySelector('#firmaObnova').addEventListener('change', e => { f.obnova = e.target.checked; });
    tel.querySelector('#firmaNahrazovat').addEventListener('change', e => { f.nahrazovat = e.target.checked; tel.querySelector('#firmaObnova').disabled = f.nahrazovat; });
    tel.querySelectorAll('.barva').forEach(b => b.addEventListener('click', () => {
      f.barva = b.dataset.b; U.kreslic.nastav({ barvaFirmy: f.barva });
      tel.querySelectorAll('.barva').forEach(x => x.classList.toggle('on', x === b)); U.prekresli();
    }));
    U.okno('firma', '⚙️ Nastavení firmy', tel, [10, 10]);
  }
  $('miFirmaNast').addEventListener('click', oknoFirmy);

  Object.assign(U, { oknoFirmy, obrazekVozidla, oknoVozidla, oknoStanice, oknoGaraze, oknoFinance, oknoUlozeni, vyberNastroj, ulozAuto, nactiAutoTest: U.nactiAuto });
})();
