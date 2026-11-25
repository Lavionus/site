/* Samozavlažovací květináče – ovládání stránky nad společným zapojením gen3d/aplikace.js
   (tady jen to, co je pro květináče zvláštní: druh dílu, viditelnost polí, souhrny, výsledky, výpočty zásoby, kusovník, výkres, export).
   Náhled = KNOF_NAHLED. Režimy: sestava (díly v sobě, u vložky do obalu i obal) a tisk (díly na podložce). */
/* global KVET, KVET_VYK, KNOF_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = KVET.fmt, N = KVET.NAZVY;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let p, o = null, wasm = null, model = null, vyp = null, chybaStavby = '', chybaJadra = '';
  const stavZobr = { rezim: 'sestava', kontext: true };
  const nahled = KNOF_NAHLED.vytvorNahled($('platno'));

  const app = G3D.aplikace({
    typ: 'kvetinace', nazev: 'Samozavlažovací květináče', klic: 'webapp_kvetinace', soubor: 'kvetinac',
    normalizuj: KVET.normalizuj, vychozi: () => KVET.predvolba('pokojova15'),
    ulozProjekt: KVET.ulozProjekt, nactiProjekt: KVET.nactiProjekt, popis: KVET.popis,
    vezmi: KVET.vezmi, poloz: KVET.poloz,
    predNaplnenim: q => { $('selRostlina').value = KVET.ROSTLINY[q.vypocty.rostlina].spotreba === q.vypocty.spotreba ? q.vypocty.rostlina : 'vlastni'; },
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(),
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportVse('stl'),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(kusy(), app.p.nazev || 'Květináč'), pripona: '.3mf' } : null),
    zkratky: { r: 'tRez', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka', c: 'tKontext' },
    diry: true,
    zmenaTematu: () => prepocitej(),
  });

  /* ---------- nabídky formuláře ---------- */
  const moznosti = (sel, obj) => { sel.innerHTML = Object.entries(obj).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join(''); };
  document.querySelectorAll('#paletaDruhu button').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.dlazdice === app.p.druh) return;
    app.zmen(q => { q.druh = b.dataset.dlazdice; });
    app.naplnFormular();
  }));
  moznosti($('f_tvar'), N.tvar);
  moznosti($('f_zadani'), N.zadani);
  moznosti($('f_povrch'), N.povrch);
  moznosti($('f_vzl'), N.vzlinani);
  moznosti($('f_ulo'), N.ulozeni);
  moznosti($('f_pt'), N.plneni);
  moznosti($('f_wt'), N.vodoznak);
  moznosti($('f_material'), Object.fromEntries(Object.entries(KVET.MATERIALY).map(([k, m]) => [k, m.nazev])));
  $('selRostlina').innerHTML = Object.entries(KVET.ROSTLINY).map(([k, r]) => `<option value="${k}">${esc(r.nazev)}${r.spotreba ? ` – ${r.spotreba} ml/den` : ''}</option>`).join('');
  $('selRostlina').addEventListener('change', e => {
    const r = KVET.ROSTLINY[e.target.value];
    app.zmen(q => { q.vypocty.rostlina = e.target.value; if (r.spotreba) q.vypocty.spotreba = r.spotreba; });
    app.naplnFormular();
  });

  function viditelnost() {
    p = app.p;
    const od = KVET.odvozene(p), P = p.plast, maVlozku = p.druh === 'sada' || p.druh === 'vlozka', maNadobu = p.druh === 'sada' || p.druh === 'kvetinac';
    const noha = p.vlozka.vzlinani === 'noha', lem = !noha || p.vlozka.ulozeni === 'lem';
    const F = {
      sada: p.druh === 'sada', kvetinac: p.druh === 'kvetinac', vlozka: p.druh === 'vlozka', podmiska: p.druh === 'podmiska',
      maVlozku, maNadobu, bezVlozky: !maVlozku, neVlozka: p.druh !== 'vlozka',
      objem: maNadobu && P.zadani === 'objem', mnoho: P.tvar === 'mnohouhelnik', hran: P.tvar === 'ctverec' || P.tvar === 'mnohouhelnik',
      zebra: P.povrch === 'zebra' || P.povrch === 'zkrut', zkrut: P.povrch === 'zkrut', fazety: P.povrch === 'fazety',
      maPodmisku: p.druh === 'kvetinac' || p.druh === 'podmiska', podmiskaZap: p.druh === 'podmiska' || (p.druh === 'kvetinac' && p.podmiska.zap),
      noha, knot: !noha, lemCizi: p.druh === 'vlozka' && lem, prepad: p.druh === 'sada' && p.prepad.zap,
      plneni: p.plneni.typ !== 'zadne', plovak: p.vodoznak.typ === 'plovak', pruzor: p.vodoznak.typ === 'pruzor',
    };
    document.querySelectorAll('[data-vid]').forEach(el => { el.hidden = !el.dataset.vid.split(' ').every(k => F[k]); });
    const hran = F.hran;
    $('lDh').textContent = hran ? 'Šířka nahoře' : 'Průměr nahoře';
    $('lDd').textContent = hran ? 'Šířka dna' : 'Průměr dna';
    $('nTvar').textContent = p.druh === 'vlozka' ? 'Váš obal' : p.druh === 'podmiska' ? 'Podmiska – tvar' : 'Plášť';
    document.querySelector('#boxVybava h2').textContent = maVlozku ? 'Vložka a zásobník' : 'Výbava';
    // nápovědy pod oddíly
    $('napTvar').innerHTML = od.chyba ? '' : p.druh === 'podmiska' ? `<span>Podmiska uvnitř ${fmt(2 * od.pod.a0, 1)} mm, vně ${fmt(od.pod.sirka, 1)} mm.</span>`
      : p.druh === 'vlozka' ? `<span>Vložka vně ${fmt(2 * od.S(od.H, od.eOut).a, 1)} mm nahoře, výška ${fmt(od.zTop - od.zN, 1)} mm.</span> <span>Rozměry obalu ověřte měřením.</span>`
        : (F.objem ? `<span>Z objemu vychází plášť ${fmt(2 * od.Rh, 1)} / ${fmt(2 * od.Rd, 1)} × ${fmt(od.H, 1)} mm – zadané rozměry určují jen poměr stran.</span> ` : '')
          + `<span>Rozevření pláště ${fmt(od.uhelPlaste, 0)}° od svislice.</span>`;
    $('napPovrch').textContent = od.chyba || !maNadobu ? '' : od.povrch === 'hladky' ? '' : `Největší vyklonění povrchu ${fmt(od.uhelPovrchu, 0)}° od svislice (povoleno ${fmt(p.tisk.uhel, 0)}°). Povrch jen přidává materiál – stěna nikde není tenčí.`;
    if (maVlozku && !od.chyba) {
      $('napVlozka').textContent = od.lem ? `Vložka visí za límec ${fmt(od.zTop - od.H, 1)} mm nad okrajem; kuželový spodek límce ji vystředí.`
        : `Vložka stojí na knotové noze a 4 nožkách (žebrech ${fmt(od.tNozky, 1)} mm) na dně, okraj je v rovině s nádobou.`;
      $('napZasobnik').innerHTML = `<span>Nejvyšší hladina ${fmt(od.zHl - od.zDno, 1)} mm nade dnem, dno substrátové části ${fmt(od.zK - od.zDno, 1)} mm.</span> <span>Zásoba ≈ ${fmt(od.objemVody / 1000, 0)} ml.</span>`;
      $('napPlneni').textContent = od.plneni === 'sachta' ? `Svislá trubka Ø ${fmt(p.plneni.prumer)} u stěny vložky (u čtvercové v rohu) ústí pod dno vložky do zásobníku.`
        : od.plneni === 'hrdlo' ? `Šikmé hrdlo Ø ${fmt(p.plneni.prumer)} z boku nádoby, ústí ${fmt(od.hrdlo.zM, 0)} mm nad stolem; vyčnívá ${fmt(od.hrdlo.vylozeni - od.Rh, 0)} mm.`
          : 'Vodu doléváte po vyjmutí vložky, nebo zálivkou shora, dokud nevyteče přepadem.';
      $('napVodoznak').textContent = od.plovak ? `Plovák se nasadí zespodu do vodicí trubičky dřív, než vložku vsadíte. Tyčka ${fmt(od.plovak.delka, 0)} mm, při plné zásobě vyčnívá ${fmt(3 + od.plovak.zdvih, 0)} mm.`
        : od.pruzor ? `Svislé okénko ${fmt(od.pruzor.w)} mm se stěnou ${fmt(od.pruzor.tl, 2)} mm – hladina prosvítá u průhledného filamentu.` : '';
    }
  }

  /* ---------- přepočet ---------- */
  function prepocitej() {
    p = app.p;
    document.querySelectorAll('#paletaDruhu button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.dlazdice === p.druh)));
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    let H = KVET.kontroly(p);
    o = KVET.odvozene(p);
    model = null; chybaStavby = chybaJadra;
    if (wasm && !H.some(h => h.uroven === 'chyba')) {
      try {
        model = KVET.postav(wasm, p);
        o = model.o;
        H = H.concat(KVET.kontrolyModelu(p, model));
      } catch (e) { chybaStavby = 'Model nelze sestavit: ' + (e && e.message || e); }
    } else if (wasm) chybaStavby = 'Model nelze sestavit – opravte chybu v záložce Kontrola.';
    vyp = o.chyba ? null : KVET.vypocty(p, o, model);
    const st = $('stav3d');
    st.textContent = wasm || chybaJadra ? chybaStavby : 'Načítám geometrické jádro…';
    st.classList.toggle('chyba', !!chybaStavby);
    zobraz(false);
    app.hlaseni(H, { chybaStavby, boxy: ['boxPlast', 'boxVybava'] });
    souhrny();
    vypisVysledky();
    vypisVypocty();
    vypisTisk();
    vypisKusovnik();
    exportDilu();
    if (!$('vykresNahled').closest('[hidden]')) kresliVykres();
  }
  function souhrny() {
    const P = p.plast, V = p.vlozka, S = TrubkyGui.souhrn;
    S('sTvar', p.druh === 'podmiska' ? `dno ${fmt(p.podmiska.prumer)}` : p.druh === 'vlozka' ? `${fmt(p.obal.prumerH)}/${fmt(p.obal.prumerD)} × ${fmt(p.obal.vyska)}`
      : P.zadani === 'objem' ? `${fmt(P.objem, 2)} l` : `${fmt(P.prumerH)}/${fmt(P.prumerD)} × ${fmt(P.vyska)}`, true);
    S('sPovrch', N.povrch[P.povrch], P.povrch !== 'hladky');
    S('sPodmiska', p.druh === 'kvetinac' && !p.podmiska.zap ? 'bez' : `vůle ${fmt(p.podmiska.vule, 1)} · ${fmt(p.podmiska.vyska)}`, p.druh === 'podmiska' || p.podmiska.zap);
    S('sDrenaz', `${p.drenaz.pocet} + 1 × Ø ${fmt(p.drenaz.prumer)}`, true);
    S('sVlozka', V.vzlinani === 'noha' ? `vůle ${fmt(V.vule, 1)} · noha` : `vůle ${fmt(V.vule, 1)} · knot`, true);
    S('sZasobnik', `${fmt(p.zasobnik.vyska)} mm`, true);
    S('sPlneni', { sachta: 'šachta', hrdlo: 'hrdlo', zadne: 'bez' }[p.plneni.typ], p.plneni.typ !== 'zadne');
    S('sVodoznak', { plovak: 'plovák', pruzor: 'průzor', zadny: 'bez' }[p.vodoznak.typ], p.vodoznak.typ !== 'zadny');
  }
  const box = (a, b, c, d) => G3D.dlazdice(a, b, c, d);
  const cas = min => (min < 60 ? min + ' min' : fmt(min / 60, 1) + ' h');
  function vypisVysledky() {
    const el = $('vVysledky'), karta = $('karta3d');
    if (!model) { el.innerHTML = box('Model', wasm || chybaJadra ? 'nelze sestavit' : 'načítám…', esc(chybaStavby)); karta.innerHTML = ''; $('vSit').innerHTML = ''; $('tabRozmery').innerHTML = ''; return; }
    const mat = KVET.MATERIALY[p.tisk.material], K = model.dily;
    const V = K.reduce((s, d) => s + d.objem, 0), g = V * mat.hustota / 1000;
    const od = G3D.odhadTisku(V, mat.hustota, { dilu: K.length });
    const B = model.sestava.filter(d => !d.kontext).reduce((A, d) => { const q = G3D.obal(d.poz); for (let i = 0; i < 3; i++) { A[i] = Math.min(A[i], q[i]); A[i + 3] = Math.max(A[i + 3], q[i + 3]); } return A; }, [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
    let h = box('Rozměry sestavy', `${fmt(B[3] - B[0], 0)} × ${fmt(B[4] - B[1], 0)} × ${fmt(B[5] - B[2], 0)} mm`, N.druh[p.druh]);
    if (vyp.substrat) h += box('Substrát', `${fmt(vyp.substrat / 1e6, 2)} l`, `po ${fmt(p.vypocty.okraj)} mm pod okraj · změřeno ze sítě`);
    if (o.maVlozku) {
      h += box('Zásoba vody', `${fmt(vyp.voda / 1000, 0)} ml`, `hladina ${fmt(vyp.hladina, 1)} mm · změřeno ze sítě`);
      h += box('Výdrž zásoby', `≈ ${fmt(vyp.vydrz, vyp.vydrz < 10 ? 1 : 0)} dní`, `při ${fmt(vyp.spotreba, 0)} ml/den (orientační)`, vyp.vydrz < 3 ? 'mez-t' : 'ok-t');
    }
    h += box('Dílů k tisku', `${K.length}`, K.map(d => `<span>${esc(d.nazev)}</span>`).join(', '));
    h += box('Objem', `${fmt(V / 1000, 1)} cm³`, 'všechny díly, plné');
    h += box('Hmotnost', `${fmt(g, 0)} g`, mat.nazev);
    h += box('Filament', `${fmt(od.metru, 1)} m`, 'průměr 1,75 mm, plné díly');
    h += box('Doba tisku', `≈ ${cas(od.minut)}`, 'hrubý odhad');
    el.innerHTML = h;
    // klíčové rozměry
    const r = [];
    if (o.maNadobu) {
      r.push(['Plášť vně', `${fmt(2 * o.Rh, 1)} / ${fmt(2 * o.Rd, 1)} × ${fmt(o.H, 1)}`, `stěna ${fmt(o.t, 2)}, dno ${fmt(o.zDno, 2)} mm`]);
      r.push(['Dutina nahoře / u dna', `${fmt(2 * o.aIn(o.H), 1)} / ${fmt(2 * o.aIn(o.zDno), 1)}`, o.kulaty ? 'průměr' : 'šířka přes plochy']);
    }
    if (o.maVlozku) {
      r.push(['Vložka vně nahoře', fmt(2 * o.S(o.H, o.eOut).a, 2), `dutina − 2 × vůle ${fmt(o.eOut, 2)}`]);
      r.push(['Výška vložky', fmt(o.zTop - o.zN, 1), o.lem ? `límec ${fmt(o.zTop - o.H, 1)} mm nad okrajem` : 'v rovině s okrajem nádoby']);
      if (o.noha) r.push(['Knotová noha', `Ø ${fmt(2 * o.rk, 1)} × ${fmt(o.zK - o.zN, 1)}`, o.sterbin ? `${o.sterbin} štěrbin ${fmt(p.noha.sterbina, 1)} mm` : 'bez štěrbin']);
      else r.push(['Otvory na knot', `${p.knot.pocet} × Ø ${fmt(p.knot.prumer, 1)}`, 'v rovném dně vložky']);
      r.push(['Nejvyšší hladina', fmt(o.zHl - o.zDno, 1), !o.prepad ? 'bez přepadu – hlídat' : p.diry === 'kruh' ? `přepad Ø ${fmt(2 * o.prepad.r, 1)} – kruh` : `přepad Ø ${fmt(2 * o.prepad.r, 1)} – kapka`]);
      r.push(['Dno substrátu nad hladinou', fmt(o.zK - o.zHl, 1), 'kořeny nestojí ve vodě']);
      for (const t of o.trubky) r.push([t.jmeno === 'sachta' ? 'Plnicí šachta' : 'Vodicí trubička', `Ø ${fmt(2 * t.rIn, 1)}`, `osa ${fmt(t.c, 1)} mm od středu`]);
      if (o.hrdlo) r.push(['Plnicí hrdlo', `Ø ${fmt(2 * o.hrdlo.rb, 1)}`, `ústí ${fmt(o.hrdlo.zM, 0)} mm nad stolem`]);
      if (o.plovak) r.push(['Plovák / tyčka', `Ø ${fmt(2 * o.plovak.rf)} × ${fmt(o.plovak.hF, 1)} / ${fmt(o.plovak.ty, 1)} × ${fmt(o.plovak.delka, 0)}`, `ponor ≈ ${fmt(o.plovak.ponor, 1)} mm`]);
    }
    if (o.pod) r.push(['Podmiska uvnitř / vně', `${fmt(2 * o.pod.a0, 1)} / ${fmt(o.pod.sirka, 1)}`, `okraj ${fmt(o.pod.h)} mm`]);
    $('tabRozmery').innerHTML = '<tr><th>Prvek</th><th class="c">Rozměr (mm)</th><th>Pozn.</th></tr>' + r.map(x => `<tr><td>${esc(x[0])}</td><td class="c">${x[1]}</td><td>${esc(x[2])}</td></tr>`).join('');
    karta.innerHTML = `<div class="titul">${stavZobr.rezim === 'tisk' ? 'Díly k tisku' : 'Sestava'}</div>`
      + (o.maVlozku ? `<b>${fmt(vyp.voda / 1000, 0)}</b> ml vody · <b>${fmt(vyp.substrat / 1e6, 2)}</b> l substrátu<br>výdrž ≈ <b>${fmt(vyp.vydrz, 0)}</b> dní`
        : vyp.substrat ? `<b>${fmt(vyp.substrat / 1e6, 2)}</b> l substrátu` : `uvnitř <b>${fmt(2 * o.pod.a0, 1)}</b> mm`) + `<br>${fmt(g, 0)} g · ${K.length} dílů`;
    $('vSit').innerHTML = K.map(d => { const k = KRAB.kontrolaSite(d.poz, d.idx), ok = k.uzavrena && d.teles === 1; return box('Síť', ok ? '✔ těsná' : '✖ netěsná', `<span>${esc(d.nazev)}</span> · <span>${k.trojuhelniku} trojúhelníků</span>`, ok ? 'ok-t' : 'chyba-t'); }).join('')
      + box('Stavba', `${model.cas} ms`, 'manifold-3d');
  }
  function vypisVypocty() {
    if (!vyp) { $('vVypocty').innerHTML = ''; $('napVypocty').textContent = ''; return; }
    const jak = vyp.presne ? 'změřeno ze sítě modelu' : 'odhad – model se ještě počítá';
    let h = '';
    if (vyp.substrat) h += box('Objem substrátu', `${fmt(vyp.substrat / 1e6, 2)} l`, jak);
    if (o.maVlozku) {
      h += box('Zásoba vody', `${fmt(vyp.voda / 1000, 0)} ml`, `<span>po přepad ${fmt(vyp.hladina, 1)} mm nade dnem</span> · <span>${jak}</span>`);
      h += box('Výdrž zásoby', `≈ ${fmt(vyp.vydrz, vyp.vydrz < 10 ? 1 : 0)} dní`, `spotřeba ${fmt(vyp.spotreba, 0)} ml/den`, vyp.vydrz < 3 ? 'mez-t' : 'ok-t');
      h += box('Voda / substrát', `${fmt(vyp.podil * 100, 0)} %`, 'zásoba vůči objemu substrátu');
      h += box('Dno substrátu nad hladinou', `${fmt(vyp.mezera, 1)} mm`, 'vzduchová mezera – ve vodě je jen knotová noha / knot', 'ok-t');
      if (o.plovak) h += box('Ponor plováku', `≈ ${fmt(o.plovak.ponor, 1)} mm`, `z ${fmt(o.plovak.hc, 1)} mm · plovák ${fmt(o.plovak.hmotnost, 1)} g + tyčka ${fmt(o.plovak.hmTycky, 1)} g`, o.plovak.ponor > o.plovak.hc ? 'chyba-t' : 'ok-t');
    }
    if (vyp.mCelkem) {
      h += box('Hmotnost naplněného', `≈ ${fmt(vyp.mCelkem / 1000, 2)} kg`, `tisk ${fmt(vyp.mTisk, 0)} g + substrát ${fmt(vyp.mSubstrat, 0)} g + voda ${fmt(vyp.mVoda, 0)} g`);
    }
    $('vVypocty').innerHTML = h || box('Výpočty', '–', 'samotná podmiska nemá objem substrátu ani zásobu vody');
    $('napVypocty').innerHTML = o.maVlozku ? `<span>Spotřeby rostlin jsou orientační (stav ${KVET.DATUM}) – záleží na světle, teplotě a velikosti rostliny.</span> <span>Výdrž = zásoba vody ÷ denní spotřeba; voda nasáklá v substrátu ji ještě o něco prodlouží.</span>`
      : '<span>Hmotnost počítá s vlhkým substrátem zadané hustoty.</span>';
  }
  function vypisTisk() {
    const mat = KVET.MATERIALY[p.tisk.material], sada = p.druh === 'sada';
    let h = box('Materiál', mat.nazev, p.tisk.material === 'PLA' ? 've stálé vodě a na slunci časem křehne' : 'vhodný pro stálý styk s vodou');
    h += box('Stěna nádoby', `${fmt(p.plast.stena / p.tisk.extruze, 1)} perimetru`, `${fmt(p.plast.stena, 2)} mm ÷ ${fmt(p.tisk.extruze, 2)} mm` + (sada ? ' · <span>vodotěsně od 3 perimetrů</span>' : ''), sada && p.plast.stena < 3 * p.tisk.extruze - 1e-9 ? 'mez-t' : 'ok-t');
    h += box('Doporučení', sada ? `${Math.max(3, p.tisk.perimetru)} perimetry, plné dno` : '2–3 perimetry', sada ? 'nádoba bez výplně = plná stěna; plovák 2 perimetry' : 'výplň netřeba – stěny jsou plné');
    $('vTisk').innerHTML = h;
  }
  function vypisKusovnik() {
    if (!model) { $('kusovnik').innerHTML = '<p class="napoveda">Kusovník se ukáže po sestavení modelu.</p>'; return; }
    $('kusovnik').innerHTML = '<table class="tabulka"><thead><tr><th>Položka</th><th class="c">Kusů</th><th class="c">Rozměr</th><th>Pozn.</th></tr></thead><tbody>'
      + KVET.kusovnik(p, model).map(x => {
        let roz = '';
        if (x.d) { const b = G3D.obal(x.d.poz); roz = `${fmt(b[3] - b[0], 1)} × ${fmt(b[4] - b[1], 1)} × ${fmt(b[5] - b[2], 1)}`; }
        return `<tr class="${x.druh}"><td>${esc(x.nazev)}</td><td class="c">${x.ks}</td><td class="c">${roz}</td><td>${esc(x.pozn)}</td></tr>`;
      }).join('') + '</tbody></table><p class="napoveda">🖨 = tištěný díl (rozměr v tiskové poloze), 🛒 = k dokoupení.</p>';
  }

  /* ---------- náhled ---------- */
  const kusy = () => G3D.tiskoveRozlozeni(model.dily, 1, 8, Math.max(app.p.tisk.podlozka, 200));
  function zobraz(novyPohled) {
    document.querySelectorAll('[data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === stavZobr.rezim)));
    if (!model) { nahled.nastav(null); return; }
    const tisk = stavZobr.rezim === 'tisk';
    if (tisk) nahled.nastav(kusy(), { tisk: true, novyPohled, uhel: p.tisk.uhel });
    else nahled.nastav(model.sestava.filter(d => !d.kontext || stavZobr.kontext), { novyPohled });
    $('legPrevisy').hidden = !(tisk && nahled.stav.previsy);
  }
  function nastavRezim(r) {
    const tisk = $('tTisk').getAttribute('aria-pressed') === 'true';
    if ((r === 'tisk') !== tisk) $('tTisk').click();
  }
  document.querySelectorAll('[data-rezim]').forEach(b => b.addEventListener('click', () => nastavRezim(b.dataset.rezim)));

  /* ---------- předvolby ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_kvetinace_gui', pohled: j => nahled.pohled(j) });
  {
    let skup = '';
    for (const v of KVET.PREDVOLBY) {
      if (v.skupina !== skup) { skup = v.skupina; const d = document.createElement('div'); d.className = 'nab-skupina'; d.textContent = skup; $('seznamPredvoleb').appendChild(d); }
      const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
      b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
      b.addEventListener('click', () => {
        const q = KVET.predvolba(v.id);
        q.tisk = KVET.kopie(app.p.tisk);   // tisk zůstává uživatelův; výpočty jen to, co předvolba výslovně mění
        q.vypocty = Object.assign(KVET.kopie(app.p.vypocty), v.p.vypocty || {});
        app.nahrad(q);
      });
      $('seznamPredvoleb').appendChild(b);
    }
  }

  /* ---------- export ---------- */
  function lzeExport() {
    if (!model) { Dialog.chyba(chybaStavby || 'Geometrické jádro se ještě načítá.'); return false; }
    return true;
  }
  function exportVse(co) {
    if (!lzeExport()) return;
    if (co === 'stl') app.stahni(KRAB.stlBinarni(kusy(), 'kvetinace - github_site'), app.jmeno('.stl'), 'model/stl');
    else app.stahni(KRAB.soubor3mf(kusy(), app.p.nazev || 'Květináč'), app.jmeno('.3mf'), 'model/3mf');
  }
  $('btnStl').addEventListener('click', () => exportVse('stl'));
  $('btn3mf').addEventListener('click', () => exportVse('3mf'));
  function exportDilu() {
    const el = $('exportDilu'); el.innerHTML = '';
    if (!model || model.dily.length < 2) return;
    for (const d of model.dily) {
      const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
      b.innerHTML = `⬇ STL – <span>${esc(d.nazev)}</span>`;
      b.addEventListener('click', () => app.stahni(KRAB.stlBinarni(G3D.tiskoveRozlozeni([d]), 'kvetinace - ' + d.jmeno), app.jmeno('_' + d.jmeno + '.stl'), 'model/stl'));
      el.appendChild(b);
    }
  }

  /* ---------- výkres ---------- */
  function vykresTed() {
    const d = new Date();
    return KVET_VYK.vykres(app.p, model, {
      datum: `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`, vypocty: vyp, material: KVET.MATERIALY[app.p.tisk.material].nazev,
      kusovnik: KVET.kusovnik(app.p, model).map(x => [x.nazev, x.ks, x.pozn]),
    });
  }
  function kresliVykres() { $('vykresNahled').innerHTML = model ? KVET_VYK.svg(vykresTed()) : '<p class="napoveda">Výkres se ukáže po sestavení modelu.</p>'; }
  let pismoSlib = null;
  function nactiPismo() {
    if (window.FONTY_JS && window.FONTY_JS['LiberationSans-Regular.ttf']) return Promise.resolve(window.FONTY_JS['LiberationSans-Regular.ttf']);
    if (pismoSlib) return pismoSlib;
    pismoSlib = new Promise(ok => {
      const s = document.createElement('script'); s.src = 'stitky_panely/fonty/LiberationSans-Regular.ttf.js';
      s.onload = () => ok((window.FONTY_JS || {})['LiberationSans-Regular.ttf'] || null);
      s.onerror = () => { pismoSlib = null; ok(null); };
      document.head.appendChild(s);
    });
    return pismoSlib;
  }
  async function vykresPdf() {
    if (!lzeExport()) return;
    try {
      if (!window.jspdf) throw new Error('Knihovna jsPDF se nenačetla.');
      const pismo = await nactiPismo();
      const doc = KVET_VYK.pdf(window.jspdf.jsPDF, vykresTed(), { pismo, nazev: app.p.nazev || 'Květináč' });
      app.stahni(doc.output('blob'), app.jmeno('_vykres.pdf'), 'application/pdf');
      if (!pismo) Dialog.info('Písmo se nepodařilo načíst – PDF je bez diakritiky.');
    } catch (e) { Dialog.chyba('PDF se nepodařilo vytvořit: ' + (e && e.message || e)); }
  }
  const vykresSvg = () => { if (lzeExport()) app.stahni(KVET_VYK.svg(vykresTed()), app.jmeno('_vykres.svg'), 'image/svg+xml'); };
  $('btnVykresPdf').addEventListener('click', vykresPdf); $('btnVykresPdf2').addEventListener('click', vykresPdf);
  $('btnVykresSvg').addEventListener('click', vykresSvg); $('btnVykresSvg2').addEventListener('click', vykresSvg);
  $('btnVykresZobraz').addEventListener('click', () => { TrubkyGui.otevriZalozku('vykres'); kresliVykres(); });
  document.querySelector('[data-zalozka="vykres"]').addEventListener('click', () => setTimeout(kresliVykres, 0));

  app.prepinac('tRez', h => { nahled.prepni('rez', h); $('legRez').hidden = !h; });
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !(h && stavZobr.rezim === 'tisk'); }, true);
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);
  app.prepinac('tKontext', h => { stavZobr.kontext = h; zobraz(false); }, true);
  app.prepinac('tTisk', h => { stavZobr.rezim = h ? 'tisk' : 'sestava'; zobraz(true); if (model) vypisVysledky(); });

  /* ---------- start ---------- */
  app.start({
    manifold: {
      ok: w => { wasm = w; prepocitej(); },
      chyba: e => { chybaJadra = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – model ani export nejsou k dispozici.'; prepocitej(); },
    },
  });
  window.KVET_UI = { get p() { return app.p; }, get model() { return model; }, zmen: app.zmen, nahrad: app.nahrad, prepocitej, nahled, app, nastavRezim };
})();
