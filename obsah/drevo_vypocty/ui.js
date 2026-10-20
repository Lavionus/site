/* ============================================================
   Dřevo – pohyb, průhyb, povrchy · ovládání stránky
   Stav S se váže na prvky s atributem data-k="zalozka.klic"; data-zobraz="cesta=hodnota|hodnota" skrývá bloky.
   ============================================================ */
(function () {
  'use strict';
  const D = window.DVD, J = window.DVJ, GR = window.DVG, PR = window.DVP, V = window.DVV;
  const $ = (id) => document.getElementById(id);
  const f = J.fmt;
  const KLIC = 'webapp_drevo_vypocty', KLIC_PROJ = 'webapp_drevo_vypocty_projekty';
  const toast = (t, chyba) => { try { chyba ? Dialog.chyba(t) : Dialog.info(t); } catch (e) { console.log(t); } };
  const esc = GR.esc;
  const dreviny = () => D.DREVINY;
  const drevina = (id) => D.DREVINY.find((d) => d.id === id) || D.DREVINY[0];
  const material = (id) => D.MATERIALY_POLIC.find((m) => m.id === id) || D.MATERIALY_POLIC[0];
  const kopie = (o) => JSON.parse(JSON.stringify(o));
  // šířka grafu podle obalu (na mobilu menší viewBox = čitelnější písmo)
  const sir = (id) => { const w = $(id).clientWidth; return w > 0 ? Math.max(330, Math.min(900, Math.round(w))) : 680; };

  /* ---------------- výchozí stav ---------------- */
  function nater(id, vrstvy) { const n = kopie(D.NATERY.find((x) => x.id === id)); if (vrstvy) n.vrstvy = vrstvy; return n; }
  const KUS_PREDVOLBY = [
    { nazev: 'Jídelní stůl 1800 × 900 (dub)', dily: [
      { nazev: 'Deska', delka: 1800, sirka: 900, tloustka: 30, ks: 1, plochy: 'vse', drevina: 'dub' },
      { nazev: 'Noha', delka: 720, sirka: 70, tloustka: 70, ks: 4, plochy: 'vse', drevina: 'dub' },
      { nazev: 'Lub dlouhý', delka: 1500, sirka: 100, tloustka: 22, ks: 2, plochy: 'vse', drevina: 'dub' },
      { nazev: 'Lub krátký', delka: 700, sirka: 100, tloustka: 22, ks: 2, plochy: 'vse', drevina: 'dub' }] },
    { nazev: 'Knihovna 900 × 2000 × 300 (smrk)', dily: [
      { nazev: 'Bok', delka: 2000, sirka: 300, tloustka: 18, ks: 2, plochy: 'vse', drevina: 'smrk' },
      { nazev: 'Půda / dno', delka: 864, sirka: 300, tloustka: 18, ks: 2, plochy: 'vse', drevina: 'smrk' },
      { nazev: 'Police', delka: 862, sirka: 280, tloustka: 18, ks: 5, plochy: 'vse', drevina: 'smrk' }] },
    { nazev: 'Noční stolek (buk)', dily: [
      { nazev: 'Deska', delka: 500, sirka: 400, tloustka: 20, ks: 1, plochy: 'vse', drevina: 'buk' },
      { nazev: 'Bok', delka: 520, sirka: 360, tloustka: 18, ks: 2, plochy: 'vse', drevina: 'buk' },
      { nazev: 'Čelo zásuvky', delka: 420, sirka: 150, tloustka: 18, ks: 1, plochy: 'lic_hrany', drevina: 'buk' }] },
    { nazev: 'Prkénko na krájení 400 × 250', dily: [{ nazev: 'Prkénko', delka: 400, sirka: 250, tloustka: 30, ks: 1, plochy: 'vse', drevina: 'javor' }] },
  ];
  function vychozi() {
    const dub = drevina('dub'), byt = D.KLIMATA[0], dtd = material('dtd'), buk = material('m_buk');
    return {
      tab: 'pohyb',
      pohyb: {
        drevina: 'dub', ctP: +(dub.ct * 100).toFixed(4), crP: +(dub.cr * 100).toFixed(4), rho: dub.rho,
        sirka: 300, tloustka: 25, rez: 'tang', uhel: 0, x0: 0, y0: 120,
        klima: 'byt', t: byt.t.slice(), rh: byt.rh.slice(), omMisto: '', omVenku: null, omPopis: '', tTopeni: 21, dp: 300, dtLeto: 3,
        tau: 20, mcVyroba: 9, emcT: 20, emcRH: 50, emcCil: 8,
        mezery: 'ram', ramSvetlost: 400, ramDrazka: 10, ramRezerva: 0.5, ramZasunuti: 4,
        stulSirka: 900, stulPevny: 'stred', stulRozestup: 200, stulSroub: 4.5, palKryci: 96, palPocet: 30, palMontaz: 10,
      },
      police: {
        material: 'dtd', E: dtd.E, rho: dtd.rho, kdef: dtd.kdef, fm: dtd.fm, delka: 800, hloubka: 250, tloustka: 18,
        zatizeni: 'vazane', kgm: 30, bodKg: 0, bodX: 400, vlastniTiha: true, dotvarovani: true, limit: '300',
        podporyTyp: 'konce', podporyN: 3, odsazeni: 0, podporyVlastni: '0, 400, 800', vetknuti: false,
        lista: false, listaMat: 'm_buk', listaB: 20, listaH: 40, listaE: buk.E, listaRho: buk.rho, listaPoloha: 'horni',
        zadni: false, zadniMat: 'm_buk', zadniB: 20, zadniH: 40, zadniE: buk.E, zadniRho: buk.rho, zadniPoloha: 'horni',
        zvetseni: 0, barvit: true, knihy: true,
      },
      povrch: {
        rezim: 'kusovnik', plochaRucne: 2, dily: kopie(KUS_PREDVOLBY[0].dily), system: [nater('olejvosk')],
        nanaseni: 'hadr', rezerva: 10, baleni: '0.125, 0.375, 0.75, 2.5', start: 8, zacatek: 8, konec: 18, zvednout: true,
      },
      objem: {
        polozky: [
          { nazev: 'Fošna deska', drevina: 'dub', L: 2000, W: 200, T: 40, ks: 5, cena: D.CENY.dub },
          { nazev: 'Hranol noha', drevina: 'dub', L: 800, W: 80, T: 80, ks: 4, cena: D.CENY.dub },
          { nazev: 'Prkno lub', drevina: 'dub', L: 1600, W: 120, T: 26, ks: 4, cena: D.CENY.dub }],
        odpad: 20, mc: 12, kulMetoda: 'huber', kulD: 30, kulD2: 26, kulL: 4, kulKs: 1, prm: 5, prmFaktor: 0.65,
        m1: 20, mc1: 60, mc2: 10, mVaz: 115, m0Vaz: 100,
      },
    };
  }
  let S = vychozi();
  function nacti() {
    try {
      const u = JSON.parse(localStorage.getItem(KLIC) || 'null');
      if (u && u.pohyb) S = sloucit(vychozi(), u);
    } catch (e) { /* bez úložiště */ }
  }
  function sloucit(z, u) {
    const out = kopie(z);
    for (const k of ['pohyb', 'police', 'povrch', 'objem']) if (u[k]) Object.assign(out[k], u[k]);
    if (u.tab) out.tab = u.tab;
    return out;
  }
  let ulozTimer = 0;
  function uloz() { clearTimeout(ulozTimer); ulozTimer = setTimeout(() => { try { localStorage.setItem(KLIC, JSON.stringify(S)); } catch (e) { /* plné */ } }, 300); }

  /* ---------------- vazba prvků ---------------- */
  const ziskej = (cesta) => { const [a, b] = cesta.split('.'); return S[a][b]; };
  const nastav = (cesta, v) => { const [a, b] = cesta.split('.'); S[a][b] = v; };
  function naplnPrvky(koren) {
    for (const el of (koren || document).querySelectorAll('[data-k]')) {
      const v = ziskej(el.dataset.k);
      if (el.type === 'checkbox') el.checked = !!v;
      else if (document.activeElement !== el) el.value = v == null ? '' : v;
    }
    zobrazeni();
  }
  function zobrazeni() {
    for (const el of document.querySelectorAll('[data-zobraz]')) {
      const [c, h] = el.dataset.zobraz.split('=');
      const v = String(ziskej(c));
      el.classList.toggle('skryte', !h.split('|').includes(v));
    }
  }
  document.addEventListener('input', (e) => zmena(e, false));
  document.addEventListener('change', (e) => zmena(e, true));
  function zmena(e, change) {
    const el = e.target; if (!el.dataset || !el.dataset.k) return;
    if (el.tagName === 'SELECT' && !change) return;
    const k = el.dataset.k;
    let v;
    if (el.type === 'checkbox') v = el.checked;
    else if (el.type === 'number') { v = parseFloat(String(el.value).replace(',', '.')); if (!Number.isFinite(v)) return; }
    else v = el.value;
    nastav(k, v);
    specialni(k, v);
    zobrazeni(); uloz(); prekresli();
  }
  // vedlejší účinky změn (výběr z tabulek)
  function specialni(k, v) {
    const p = S.pohyb, q = S.police;
    if (k === 'pohyb.drevina') { const d = drevina(v); p.ctP = +(d.ct * 100).toFixed(4); p.crP = +(d.cr * 100).toFixed(4); p.rho = d.rho; naplnPrvky($('selDrevina').closest('.card')); }
    if (k === 'pohyb.klima') { const kl = D.KLIMATA.find((x) => x.id === v); if (kl) { p.t = kl.t.slice(); p.rh = kl.rh.slice(); } else if (v.startsWith('om_')) odvodOm(); kresliMesice(); }
    if (['pohyb.tTopeni', 'pohyb.dp', 'pohyb.dtLeto'].includes(k)) { odvodOm(); kresliMesice(); }
    if (k === 'police.material') { const m = material(v); Object.assign(q, { E: m.E, rho: m.rho, kdef: m.kdef, fm: m.fm }); naplnPrvky($('selMaterial').closest('.card')); }
    if (k === 'police.zatizeni') { const z = D.ZATIZENI.find((x) => x.id === v); if (z) { q.kgm = z.kgm; naplnPrvky($('selZatizeni').closest('.card')); } }
    if (k === 'police.listaMat') { const m = material(v); q.listaE = m.E; q.listaRho = m.rho; naplnPrvky($('selListaMat').closest('.card')); }
    if (k === 'police.zadniMat') { const m = material(v); q.zadniE = m.E; q.zadniRho = m.rho; naplnPrvky($('selZadniMat').closest('.card')); }
    if (k === 'police.delka' && q.bodX > v) q.bodX = v / 2;
  }

  /* ---------------- výběrové seznamy ---------------- */
  function moznosti(sel, polozky, hodnota, popis) {
    sel.innerHTML = polozky.map((x) => `<option value="${esc(x.id)}">${esc(popis ? popis(x) : x.nazev)}</option>`).join('');
    if (hodnota != null) sel.value = hodnota;
  }
  function postavSeznamy() {
    const eu = D.DREVINY.filter((d) => d.zdroj === 'eu'), us = D.DREVINY.filter((d) => d.zdroj === 'usda');
    $('selDrevina').innerHTML = `<optgroup label="Evropské (typické, literatura)">${eu.map((d) => `<option value="${d.id}">${esc(d.nazev)}</option>`).join('')}</optgroup><optgroup label="USDA Wood Handbook 2010">${us.map((d) => `<option value="${d.id}">${esc(d.nazev)}</option>`).join('')}</optgroup>`;
    moznosti($('selKlima'), D.KLIMATA.concat([{ id: 'om_in', nazev: 'Interiér odvozený z venkovního klimatu (Open-Meteo)' }, { id: 'om_out', nazev: 'Venku pod střechou – místo (Open-Meteo)' }, { id: 'vlastni', nazev: 'Vlastní (upravené měsíce)' }]));
    const desky = D.MATERIALY_POLIC.filter((m) => !m.id.startsWith('m_')), masiv = D.MATERIALY_POLIC.filter((m) => m.id.startsWith('m_'));
    const skup = `<optgroup label="Desky">${desky.map((m) => `<option value="${m.id}">${esc(m.nazev)} – E ${m.E}</option>`).join('')}</optgroup><optgroup label="Masiv (podél vláken)">${masiv.map((m) => `<option value="${m.id}">${esc(m.nazev.replace('Masiv – ', ''))} – E ${m.E}</option>`).join('')}</optgroup>`;
    for (const id of ['selMaterial', 'selListaMat', 'selZadniMat']) $(id).innerHTML = skup;
    moznosti($('selZatizeni'), D.ZATIZENI.concat([{ id: 'vlastni', nazev: 'vlastní' }]), null, (z) => z.kgm ? `${z.nazev} – ${z.kgm} kg/m` : z.nazev);
    moznosti($('selLimit'), D.LIMITY.map((l) => ({ id: String(l.id), nazev: l.nazev })));
    moznosti($('selNanaseni'), D.NANASENI, null, (n) => `${n.nazev} (×${n.k})`);
    moznosti($('selPridatNater'), D.NATERY);
    $('selPredvolbaKus').innerHTML = KUS_PREDVOLBY.map((p, i) => `<option value="${i}">${esc(p.nazev)}</option>`).join('');
  }

  /* ---------------- záložky ---------------- */
  const NAZVY = { pohyb: 'Pohyb dřeva', police: 'Průhyb polic', povrch: 'Povrchové úpravy', objem: 'Objem a hmotnost' };
  function prepniTab(t) {
    S.tab = t;
    for (const b of $('zalozky').querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.tab === t));
    for (const p of document.querySelectorAll('section.panel')) p.hidden = p.dataset.panel !== t;
    $('princip').innerHTML = PR[{ police: 'pruhyb' }[t] || t]; $('principNazev').textContent = NAZVY[t];
    uloz(); prekresli();
    if (t === 'police') zkus3d();
  }
  $('zalozky').addEventListener('click', (e) => { const b = e.target.closest('button[data-tab]'); if (b) prepniTab(b.dataset.tab); });
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tg = e.target.tagName; if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA') return;
    const m = /^(?:Digit|Numpad)([1-4])$/.exec(e.code);
    if (m) { prepniTab(['pohyb', 'police', 'povrch', 'objem'][+m[1] - 1]); e.preventDefault(); }
  });

  /* ============================================================
     1. POHYB
     ============================================================ */
  function kresliMesice() {
    const p = S.pohyb, el = $('mesice');
    let h = '<span></span>' + D.MESICE.map((m) => `<span>${m}</span>`).join('');
    h += '<span title="teplota °C">°C</span>' + p.t.map((v, i) => `<input type="number" step="0.5" data-mes="t" data-i="${i}" value="${(+v).toFixed(1)}" aria-label="teplota ${D.MESICE_DLOUHE[i]}">`).join('');
    h += '<span title="relativní vlhkost %">RH</span>' + p.rh.map((v, i) => `<input type="number" step="1" min="1" max="100" data-mes="rh" data-i="${i}" value="${Math.round(v)}" aria-label="vlhkost ${D.MESICE_DLOUHE[i]}">`).join('');
    el.innerHTML = h;
  }
  $('mesice').addEventListener('input', (e) => {
    const el = e.target; if (!el.dataset.mes) return;
    const v = parseFloat(el.value); if (!Number.isFinite(v)) return;
    S.pohyb[el.dataset.mes][+el.dataset.i] = v;
    if (S.pohyb.klima !== 'vlastni') { S.pohyb.klima = 'vlastni'; $('selKlima').value = 'vlastni'; zobrazeni(); }
    uloz(); prekresli();
  });
  function odvodOm() {
    const p = S.pohyb;
    if (!p.omVenku) return;
    if (p.klima === 'om_out') { p.t = p.omVenku.t.slice(); p.rh = p.omVenku.rh.slice(); }
    else if (p.klima === 'om_in') { const k = J.klimaInterieru(p.omVenku, p.tTopeni, p.dp, p.dtLeto); p.t = k.t; p.rh = k.rh; }
  }
  async function nactiOm(lat, lon, popis) {
    const p = S.pohyb;
    $('omStav').textContent = 'Stahuji hodinová data (3 roky)…';
    const rok = new Date().getFullYear() - 1;
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&start_date=${rok - 2}-01-01&end_date=${rok}-12-31&hourly=temperature_2m,relative_humidity_2m&timezone=auto`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('Open-Meteo odpověděl ' + r.status);
    const d = await r.json();
    const m = J.mesicniZHodin(d.hourly.time, d.hourly.temperature_2m, d.hourly.relative_humidity_2m);
    if (m.t.some((x) => !Number.isFinite(x))) throw new Error('Neúplná data');
    p.omVenku = { t: m.t.map((x) => +x.toFixed(2)), rh: m.rh.map((x) => +x.toFixed(1)) };
    p.omPopis = `${popis} (${rok - 2}–${rok}, Open-Meteo / ERA5)`;
    if (!p.klima.startsWith('om_')) p.klima = 'om_in';
    odvodOm(); kresliMesice(); naplnPrvky(); uloz(); prekresli();
    $('omStav').textContent = 'Načteno: ' + p.omPopis;
  }
  $('btnOm').addEventListener('click', async () => {
    const q = (S.pohyb.omMisto || '').trim();
    if (!q) { toast('Zadejte místo.', true); return; }
    try {
      $('omStav').textContent = 'Hledám místo…';
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=cs&format=json`);
      const d = await r.json();
      if (!d.results || !d.results.length) { $('omStav').textContent = 'Místo nenalezeno.'; return; }
      const g = d.results[0];
      await nactiOm(g.latitude, g.longitude, [g.name, g.admin1, g.country_code].filter(Boolean).join(', '));
    } catch (e) { $('omStav').textContent = 'Chyba: ' + e.message + ' (je k dispozici internet?)'; }
  });
  $('btnOmPoloha').addEventListener('click', () => {
    if (!navigator.geolocation) { toast('Prohlížeč neumí zjistit polohu.', true); return; }
    $('omStav').textContent = 'Zjišťuji polohu…';
    navigator.geolocation.getCurrentPosition((pos) => nactiOm(pos.coords.latitude, pos.coords.longitude, `${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`).catch((e) => { $('omStav').textContent = 'Chyba: ' + e.message; }),
      (e) => { $('omStav').textContent = 'Poloha nedostupná: ' + e.message; }, { timeout: 15000 });
  });
  $('btnMcPrumer').addEventListener('click', () => { const r = vypocetPohyb(); S.pohyb.mcVyroba = +r.rok.prumer.toFixed(1); naplnPrvky(); uloz(); prekresli(); });
  $('mezeryVolba').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-m]'); if (!b) return;
    S.pohyb.mezery = b.dataset.m; uloz(); mezeryVolba();
  });
  function mezeryVolba() {
    for (const b of $('mezeryVolba').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.m === S.pohyb.mezery));
    for (const el of document.querySelectorAll('[data-mp]')) el.hidden = el.dataset.mp !== S.pohyb.mezery;
  }

  function vypocetPohyb() {
    const p = S.pohyb, ct = p.ctP / 100, cr = p.crP / 100;
    let c, cTl, popisRezu, kmen = null;
    if (p.rez === 'rad') { c = cr; cTl = ct; popisRezu = 'radiální'; }
    else if (p.rez === 'uhel') { c = J.koefUhel(ct, cr, p.uhel); cTl = J.koefUhel(ct, cr, 90 - p.uhel); popisRezu = `letokruhy ${f(p.uhel, 0)}°`; }
    else if (p.rez === 'kmen') { kmen = J.koefZKmene(ct, cr, p.sirka, p.x0, p.y0 + p.tloustka / 2); c = kmen.c; cTl = J.koefUhel(ct, cr, 90 - kmen.uhelStred); popisRezu = `z kmene (úhly ${f(kmen.uhelMin, 0)}–${f(kmen.uhelMax, 0)}°)`; }
    else { c = ct; cTl = cr; popisRezu = 'tangenciální'; }
    const rok = J.rocniPrubeh({ t: p.t, rh: p.rh }, p.tau);
    const mcMin = rok.min, mcMax = rok.max;
    const sirky = rok.drevo.map((mc) => J.zmenaRozmeru(p.sirka, c, p.mcVyroba, mc));
    const rozsah = J.zmenaRozmeru(p.sirka, c, mcMin, mcMax), rozsahTl = J.zmenaRozmeru(p.tloustka, cTl, mcMin, mcMax);
    const ram = J.vyplnRamu({ svetlost: p.ramSvetlost, hloubkaDrazky: p.ramDrazka, c, mcVyroba: p.mcVyroba, mcMin, mcMax, rezerva: p.ramRezerva, minZasunuti: p.ramZasunuti });
    const w = p.stulSirka, pev = p.stulPevny === 'zadni' ? 0 : w / 2, polohy = [];
    const r = Math.max(30, p.stulRozestup);
    if (p.stulPevny === 'zadni') for (let x = 30; x <= w - 30 + 1e-6; x += r) polohy.push(x);
    else { for (let x = pev; x >= 30 - 1e-6; x -= r) polohy.unshift(x); for (let x = pev + r; x <= w - 30 + 1e-6; x += r) polohy.push(x); }
    const stul = J.deskaStolu({ sirka: w, c, mcVyroba: p.mcVyroba, mcMin, mcMax, pevnyBod: p.stulPevny, polohy, prumerSroubu: p.stulSroub, rezerva: 1 });
    const pal = J.palubky({ kryci: p.palKryci, pocet: p.palPocet, c, mcMontaz: p.palMontaz, mcMax, mcMin });
    return { c, cTl, ct, cr, popisRezu, kmen, rok, mcMin, mcMax, sirky, rozsah, rozsahTl, ram, stul, pal };
  }
  const MES_TICK = (() => { const dl = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; let a = 0; return dl.map((d, i) => { const t = { v: a, t: D.MESICE[i], posun: d / 2 }; a += d; return t; }); })();
  const denText = (x) => { const d = Math.max(0, Math.min(364, Math.floor(x))); const dt = new Date(2025, 0, 1 + d); return dt.getDate() + '. ' + D.MESICE_DLOUHE[dt.getMonth()]; };
  function grafRok(r, pal, w) {
    const P = pal || GR.PAL_OBR;
    const dny = r.rok.denni.map((v, i) => [i, v]);
    return GR.cara({ id: 'gRok', w: w || 680, h: 250, pal: P, nadpis: 'Vlhkost dřeva během roku', x: { min: 0, max: 365, tick: MES_TICK }, y: { popis: 'vlhkost %' },
      serie: [{ nazev: 'EMC vzduchu', body: dny, barva: P.s2, sirka: 1.5, carky: '5 3', jednotka: '%' }, { nazev: 'Vlhkost dřeva', body: r.rok.drevo.map((v, i) => [i, v]), barva: P.s1, jednotka: '%' }],
      vodorovne: [{ y: S.pohyb.mcVyroba, barva: P.s3, popis: `výroba ${f(S.pohyb.mcVyroba, 1)} %`, carky: '2 3' }] });
  }
  function grafSirka(r, pal, w) {
    const P = pal || GR.PAL_OBR;
    return GR.cara({ id: 'gSir', w: w || 680, h: 200, pal: P, nadpis: `Změna šířky ${f(S.pohyb.sirka, 0)} mm proti stavu při výrobě`, x: { min: 0, max: 365, tick: MES_TICK }, y: { popis: 'mm' },
      serie: [{ nazev: 'Δ šířky', body: r.sirky.map((v, i) => [i, v]), barva: P.s1, plocha: true, jednotka: 'mm' }] });
  }
  function grafIzotermy(pal, w) {
    const P = pal || GR.PAL_OBR, p = S.pohyb;
    const tt = [[0, P.s1], [20, P.s2], [40, P.s3]];
    const serie = tt.map(([t, b]) => ({ nazev: `${t} °C`, barva: b, jednotka: '%', body: Array.from({ length: 96 }, (_, i) => [i, J.emc(t, i)]) }));
    return GR.cara({ id: 'gIzo', w: w || 680, h: 240, pal: P, x: { min: 0, max: 95, popis: 'relativní vlhkost vzduchu %' }, y: { min: 0, max: 25, popis: 'EMC %' }, serie,
      body: [{ x: p.emcRH, y: J.emc(p.emcT, p.emcRH), popis: `${f(p.emcT, 1)} °C / ${f(p.emcRH, 0)} % → ${f(J.emc(p.emcT, p.emcRH), 1)} %`, barva: P.s4 }] });
  }
  function schemaRam(v, P) {
    P = P || GR.PAL_OBR;
    const W = 320, H = 190, g = S.pohyb.ramDrazka, mez = v.mezeraStrana;
    const sc = Math.min(8, 150 / (g + 16));
    const xs = 130, ramW = (g + 16) * sc, y0 = 34, hS = 70, tlV = 16, yV = y0 + (hS - tlV) / 2;
    const xDno = xs + g * sc, xV = xDno - mez * sc;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Liberation Sans, Arial, sans-serif" font-size="10.5" role="img" aria-label="Řez drážkou rámu">`;
    s += `<rect width="${W}" height="${H}" fill="${P.pozadi}"/>`;
    s += `<rect x="${xs}" y="${y0}" width="${ramW}" height="${hS}" fill="${P.drevoT}" stroke="${P.text}"/>`;
    s += `<rect x="${xs}" y="${yV - 2}" width="${g * sc}" height="${tlV + 4}" fill="${P.pozadi}" stroke="${P.text}"/>`;
    s += `<rect x="12" y="${yV}" width="${xV - 12}" height="${tlV}" fill="${P.drevo}" stroke="${P.text}"/>`;
    s += `<text x="14" y="${yV - 6}" fill="${P.text}">výplň</text><text x="${xs + ramW}" y="${y0 - 6}" text-anchor="end" fill="${P.text}">vlys rámu</text>`;
    if (mez > 0.05) s += `<rect x="${xV}" y="${yV}" width="${xDno - xV}" height="${tlV}" fill="${P.zla}" opacity="0.5"/>`;
    const k1 = y0 + hS + 16, k2 = k1 + 22;
    const kota = (a, b, y, t, barva) => `<line x1="${a}" x2="${b}" y1="${y}" y2="${y}" stroke="${barva}"/><line x1="${a}" x2="${a}" y1="${y - 4}" y2="${y + 4}" stroke="${barva}"/><line x1="${b}" x2="${b}" y1="${y - 4}" y2="${y + 4}" stroke="${barva}"/><text x="${b + 6}" y="${y + 4}" fill="${barva}">${t}</text>`;
    s += `<line x1="${xs}" x2="${xs}" y1="${y0 + hS}" y2="${k1 + 4}" stroke="${P.slaby}" stroke-dasharray="2 2"/><line x1="${xDno}" x2="${xDno}" y1="${y0 + hS}" y2="${k2 + 4}" stroke="${P.slaby}" stroke-dasharray="2 2"/><line x1="${xV}" x2="${xV}" y1="${yV + tlV}" y2="${k2 + 4}" stroke="${P.slaby}" stroke-dasharray="2 2"/>`;
    s += kota(xs, xDno, k1, `drážka ${f(g, 1)} mm`, P.text);
    s += kota(xV, xDno, k2, `mezera ${f(mez, 1)} mm`, P.zla);
    s += `<text x="12" y="${H - 8}" fill="${P.slaby}">jedna strana výplně, řez kolmo k vláknům</text>`;
    return s + '</svg>';
  }
  function kresliPohyb() {
    const p = S.pohyb, r = vypocetPohyb(), d = drevina(p.drevina);
    $('zdrojDreviny').textContent = d.zdroj === 'usda' ? 'USDA Wood Handbook' : 'typické, EU literatura';
    $('klimaPopis').textContent = p.klima.startsWith('om_') ? (p.omVenku ? p.omPopis : 'načtěte místo') : (D.KLIMATA.find((k) => k.id === p.klima) || { nazev: 'vlastní' }).nazev;
    $('emcVysl').textContent = f(J.emc(p.emcT, p.emcRH), 1) + ' %';
    const inv = J.rhProEmc(p.emcT, p.emcCil);
    $('emcInv').textContent = Number.isFinite(inv) ? f(inv, 0) + ' % RH' : '–';
    $('emcInvPopis').textContent = `RH pro ${f(p.emcCil, 1)} % při ${f(p.emcT, 1)} °C`;
    $('pohybCisla').innerHTML = `<div><b>${f(r.mcMin, 1)}–${f(r.mcMax, 1)} %</b><span>vlhkost dřeva v roce</span></div><div><b>${f(r.rozsah, 1)} mm</b><span>pohyb šířky ${f(p.sirka, 0)} mm</span></div><div><b>${f(r.rozsahTl, 2)} mm</b><span>pohyb tloušťky</span></div><div><b>${f(r.c * 100, 3)} %/%</b><span>koef. šířky (${esc(r.popisRezu)})</span></div>`;
    const g1 = grafRok(r, null, sir('grafRok')); $('grafRok').innerHTML = g1.svg; GR.pripojHover($('grafRok'), g1.meta, denText);
    const g2 = grafSirka(r, null, sir('grafSirka')); $('grafSirka').innerHTML = g2.svg; GR.pripojHover($('grafSirka'), g2.meta, denText);
    const g3 = grafIzotermy(null, sir('grafIzotermy')); $('grafIzotermy').innerHTML = g3.svg; GR.pripojHover($('grafIzotermy'), g3.meta, (x) => `RH ${f(x, 0)} %`);
    $('grafKmen').innerHTML = p.rez === 'kmen' ? GR.rezKmene({ sirka: p.sirka, tloustka: p.tloustka, x0: p.x0, y0: p.y0 }) :
      GR.rezKmene({ sirka: p.sirka, tloustka: p.tloustka, x0: p.rez === 'rad' ? p.sirka * 0.5 + 40 : p.rez === 'uhel' ? (p.uhel >= 89.5 ? p.sirka / 2 + 40 : Math.tan(p.uhel * Math.PI / 180) * 200) : 0, y0: p.rez === 'rad' ? 2 : p.rez === 'uhel' ? (p.uhel >= 89.5 ? 2 : 200) : 120 });
    const mesE = r.rok.emcM;
    $('pohybUdaje').innerHTML = [
      ['EMC vzduchu min / max', `${f(r.rok.emcMin, 1)} / ${f(r.rok.emcMax, 1)} %`],
      ['Vlhkost dřeva (τ = ' + f(p.tau, 0) + ' d) min / max', `${f(r.mcMin, 1)} / ${f(r.mcMax, 1)} %`],
      ['Roční průměr dřeva', f(r.rok.prumer, 1) + ' %'],
      ['Šířka v nejsušším / nejvlhčím', `${f(p.sirka + J.zmenaRozmeru(p.sirka, r.c, p.mcVyroba, r.mcMin), 1)} / ${f(p.sirka + J.zmenaRozmeru(p.sirka, r.c, p.mcVyroba, r.mcMax), 1)} mm`],
      ['Nejsušší měsíc (EMC)', D.MESICE_DLOUHE[mesE.indexOf(Math.min(...mesE))]],
      ['Nejvlhčí měsíc (EMC)', D.MESICE_DLOUHE[mesE.indexOf(Math.max(...mesE))]],
      ['C_T / C_R dřeviny', `${f(r.ct * 100, 3)} / ${f(r.cr * 100, 3)} %/%  (T/R ${f(r.ct / r.cr, 2)})`],
    ].map(([a, b]) => `<div><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('');
    const var_ = [];
    if (r.mcMax > 14 || r.mcMin < 6) var_.push('Koeficienty Wood Handbook platí pro 6–14 % – mimo tento rozsah je výsledek orientační.');
    if (Math.abs(p.mcVyroba - r.rok.prumer) > 2.5) var_.push(`Vlhkost při výrobě (${f(p.mcVyroba, 1)} %) je daleko od ročního průměru (${f(r.rok.prumer, 1)} %) – dřevo bude pracovat převážně jedním směrem. Před výrobou nechte dřevo aklimatizovat v místě použití.`);
    if (p.klima.startsWith('om_') && !p.omVenku) var_.push('Klima z Open-Meteo zatím není načtené – počítá se s posledními hodnotami v tabulce měsíců.');
    $('pohybVarovani').innerHTML = var_.map((t) => `<div class="vystraha">${esc(t)}</div>`).join('');
    // mezery
    const R = r.ram;
    $('schemaRam').innerHTML = schemaRam(R);
    $('ramUdaje').innerHTML = [
      ['Šířka výplně (řezat na)', f(R.sirkaVyplne, 1) + ' mm'],
      ['Od dna ke dnu drážek', f(R.plna, 1) + ' mm'],
      ['Mezera ke dnu drážky (každá strana)', f(R.mezeraStrana, 1) + ' mm'],
      ['Letní roztažení výplně', f(R.roztazeni, 2) + ' mm'],
      ['Zimní smrštění výplně', f(R.smrsteni, 2) + ' mm'],
      ['Zasunutí v nejsušším stavu', f(R.zasunutiMin, 1) + ' mm'],
      ['Odkrytý pruh v zimě (na straně)', f(R.pas, 1) + ' mm'],
      ['Stav', R.ok ? '✓ vyhovuje' : `✗ drážku prohloubit na ≥ ${R.doporucenaDrazka} mm`],
    ].map(([a, b]) => `<div><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('');
    const T = r.stul;
    $('stulUdaje').innerHTML = [
      ['Celkový pohyb desky (zima ↔ léto)', f(T.celkem, 1) + ' mm'],
      ['Posun nejvzdálenější hrany ven / dovnitř', `${f(T.hranaVen, 1)} / ${f(T.hranaDovnitr, 1)} mm`],
      ['Knoflík (button): vůle ke dnu drážky lubu', '≥ ' + f(T.knofVuleDno, 1) + ' mm'],
      ['Knoflík: zasunutí jazýčku', '≥ ' + f(T.knofZasunuti, 1) + ' mm'],
    ].map(([a, b]) => `<div><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('');
    $('tabStul').innerHTML = '<tr><th class="c">od zadní hrany (mm)</th><th class="c">od pevného bodu</th><th class="c">posun ven</th><th class="c">posun dovnitř</th><th class="c">podélný otvor (mm)</th></tr>' +
      T.prvky.map((q) => `<tr><td class="c">${f(q.x, 0)}</td><td class="c">${f(q.odPevneho, 0)}</td><td class="c">${f(q.ven, 1)}</td><td class="c">${f(q.dovnitr, 1)}</td><td class="c"><b>${Math.abs(q.odPevneho) < 1 ? f(p.stulSroub + 0.5, 1) + ' (kulatý – pevný bod)' : f(Math.ceil(q.delkaOtvoru * 2) / 2, 1) + ' × ' + f(p.stulSroub + 0.5, 1)}</b></td></tr>`).join('') +
      '<tr><td colspan="5" class="info">Otvory podlouhlé napříč vlákny desky (ve směru šířky). Podložka pod hlavu šroubu, šroub nedotahovat „na krev“. Alternativa: kovové příchytky „osmičky“ (figure-8) zapuštěné do lubu – otáčejí se s pohybem desky.</td></tr>';
    const PL = r.pal;
    $('palUdaje').innerHTML = [
      ['Mezera mezi palubkami při montáži', f(PL.mezeraPalubka, 2) + ' mm'],
      ['Smrštění palubky v nejsušším stavu', f(PL.smrsteniPalubka, 2) + ' mm'],
      ['Šířka plochy', f(PL.sirkaPlochy / 1000, 2) + ' m'],
      ['Dilatace u stěn celkem (roztažení)', f(PL.celkemRoztazeni, 1) + ' mm → ' + f(PL.celkemRoztazeni / 2, 1) + ' mm na každé straně'],
      ['Pero musí zůstat zasunuto (min.)', f(PL.peroMin, 1) + ' mm'],
    ].map(([a, b]) => `<div><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('');
    // tabulka dřevin
    $('tabDreviny').innerHTML = '<tr><th>Dřevina</th><th class="c">C<sub>T</sub> %/%</th><th class="c">C<sub>R</sub> %/%</th><th class="c">T/R</th><th class="c">ρ₁₂ kg/m³</th><th class="c">E MPa</th><th class="c">Δ 300 mm / 4 %</th><th>Zdroj</th></tr>' +
      D.DREVINY.map((x) => `<tr data-d="${x.id}" style="cursor:pointer${x.id === p.drevina ? ';background:var(--bg-control)' : ''}"><td>${esc(x.nazev)}</td><td class="c">${f(x.ct * 100, 3)}</td><td class="c">${f(x.cr * 100, 3)}</td><td class="c">${f(x.ct / x.cr, 2)}</td><td class="c">${x.rho}</td><td class="c">${x.E}</td><td class="c">${f(300 * x.ct * 4, 1)} mm</td><td><span class="stitek">${x.zdroj === 'usda' ? 'USDA' : 'EU typ.'}</span></td></tr>`).join('');
  }
  $('tabDreviny').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-d]'); if (!tr) return; S.pohyb.drevina = tr.dataset.d; specialni('pohyb.drevina', tr.dataset.d); naplnPrvky(); uloz(); prekresli(); });

  /* ============================================================
     2. POLICE
     ============================================================ */
  function vstupPolice(q, o) {
    q = q || S.police;
    const vl = String(q.podporyVlastni || '').split(/[;,\s]+/).map((x) => parseFloat(x.replace(',', '.'))).filter(Number.isFinite);
    const podpory = J.rozmistiPodpory(q.delka, q.podporyTyp, q.podporyN, q.odsazeni, vl, q.vetknuti);
    return Object.assign({
      delka: q.delka, hloubka: q.hloubka, tloustka: q.tloustka, E: q.E, rho: q.rho, kdef: q.kdef, fm: q.fm,
      lista: q.lista ? { b: q.listaB, h: q.listaH, E: q.listaE, rho: q.listaRho, poloha: q.listaPoloha, fm: material(q.listaMat).fm } : null,
      zadni: q.zadni ? { b: q.zadniB, h: q.zadniH, E: q.zadniE, rho: q.zadniRho, poloha: q.zadniPoloha, fm: material(q.zadniMat).fm } : null,
      kgm: q.kgm, bodKg: q.bodKg, bodX: Math.min(q.bodX, q.delka), vlastniTiha: q.vlastniTiha, dotvarovani: q.dotvarovani, podpory, limit: +q.limit,
    }, o || {});
  }
  function maxRozpeti(q) {
    if (q.podporyTyp === 'vlastni') return NaN;
    const zk = (L) => { try { return J.police(vstupPolice(Object.assign({}, q, { delka: L, bodX: Math.min(q.bodX, L) }), { prvku: 40 })).nejhorsi.pomer >= +q.limit; } catch (e) { return false; } };
    let a = Math.max(60, 2 * (q.odsazeni || 0) + 30), b = 6000;
    if (!zk(a)) return 0; if (zk(b)) return b;
    for (let i = 0; i < 30; i++) { const m = (a + b) / 2; if (zk(m)) a = m; else b = m; }
    return a;
  }
  function vypocetPolice() {
    const p = vstupPolice();
    const v = J.police(p);
    return { p, v, Lmax: maxRozpeti(S.police) };
  }
  function grafPruhyb(r, pal, w) {
    const P = pal || GR.PAL_OBR, v = r.v;
    const s = [{ nazev: 'okamžitý', body: v.okamzite.x.map((x, i) => [x, -v.okamzite.w[i]]), barva: P.s1, carky: v.kd > 1 ? '5 3' : null, jednotka: 'mm' }];
    if (v.kd > 1) s.push({ nazev: 'konečný (dotvarování)', body: v.okamzite.x.map((x, i) => [x, -v.dlouhodobe.w[i]]), barva: P.s2, jednotka: 'mm' });
    const lim = v.useky.reduce((m, u) => Math.max(m, (u.konzola ? 2 * u.delka : u.delka) / v.limit), 0);
    return GR.cara({ id: 'gPr', w: w || 680, h: 230, pal: P, nadpis: 'Průhybová čára', x: { min: 0, max: r.p.delka, popis: 'poloha mm' }, y: { popis: 'průhyb mm', max: Math.max(0.2, lim * 0.3) },
      serie: s, vodorovne: [{ y: -lim, barva: P.zla, popis: `limit L/${v.limit} = ${f(lim, 2)} mm` }], svisle: r.p.podpory.map((q) => ({ x: q.x })) });
  }
  function grafMoment(r, pal, w) {
    const P = pal || GR.PAL_OBR, v = r.v;
    return GR.cara({ id: 'gM', w: w || 680, h: 190, pal: P, nadpis: 'Ohybový moment (okamžité zatížení)', x: { min: 0, max: r.p.delka, popis: 'poloha mm' }, y: { popis: 'N·m' },
      serie: [{ nazev: 'M', body: v.okamzite.x.map((x, i) => [x, v.okamzite.M[i] / 1000]), barva: P.s4, plocha: true, jednotka: 'N·m' }], svisle: r.p.podpory.map((q) => ({ x: q.x })) });
  }
  function kresliPolice() {
    let r;
    try { r = vypocetPolice(); }
    catch (e) { $('policeVerdikt').innerHTML = `<div class="verdikt chyba">✗ ${esc(e.message)}</div>`; return; }
    const { p, v } = r, q = S.police;
    const nej = v.nejhorsi;
    const ok = v.vyhovuje;
    $('policeVerdikt').innerHTML = `<div class="verdikt ${ok ? 'ok' : 'chyba'}">${ok ? '✓ Vyhovuje' : '✗ Nevyhovuje'} limitu L/${v.limit}: ${nej.konzola ? 'převis' : 'pole'} ${f(nej.delka, 0)} mm má průhyb ${f(Math.abs(nej.wMax), 2)} mm = L/${Number.isFinite(nej.pomer) ? f(nej.pomer, 0) : '∞'}${v.kd > 1 ? ' (včetně dotvarování)' : ''}.</div>`;
    const sig = v.napeti.reduce((m, x) => (x.vyuziti > m.vyuziti ? x : m), v.napeti[0]);
    $('policeCisla').innerHTML = `<div><b>${f(Math.abs(v.okamzite.wMax), 2)} mm</b><span>okamžitý průhyb</span></div>` + (v.kd > 1 ? `<div><b>${f(Math.abs(v.dlouhodobe.wMax), 2)} mm</b><span>konečný (× ${f(v.kd, 2)})</span></div>` : '') +
      `<div><b>${Number.isFinite(v.kgmMax) ? f(v.kgmMax, 0) + ' kg/m' : '–'}</b><span>max. užitné pro L/${v.limit}</span></div><div><b>${Number.isFinite(r.Lmax) ? (r.Lmax >= 6000 ? '> 6 m' : f(r.Lmax, 0) + ' mm') : '–'}</b><span>max. délka pro limit</span></div>`;
    $('bokorys').innerHTML = GR.bokorysPolice(v, p, { w: sir('bokorys'), h: 210 });
    $('prurez').innerHTML = GR.prurezPolice(v, p, { w: 320, h: 170 });
    $('policeUdaje').innerHTML = [
      ['Zatížení celkem (užitné + bod)', f(v.zatizeniCelkemKg, 1) + ' kg'],
      ['Hmotnost police s lištami', f(v.hmotnostPolice, 2) + ' kg'],
      ['Ohybová tuhost EI', f(v.prurez.EI / 1e9, 2) + ' kN·m²'],
      ['Zesílení lištami', '× ' + f(v.zesileni, 2)],
      ['Max. moment', f(v.okamzite.Mmax / 1000, 1) + ' N·m'],
      ['Reakce podpor', v.okamzite.reakce.map((x) => f(x.R / J.G, 1)).join(' / ') + ' kg'],
      [`Napětí ${sig.nazev} / f_m`, `${f(sig.sigma, 1)} / ${f(sig.fm, 0)} MPa (${f(sig.vyuziti * 100, 0)} %)`],
    ].map(([a, b]) => `<div><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('') + (sig.vyuziti > 0.5 ? '<div class="vystraha">Napětí přesahuje polovinu orientační pevnosti – u desek hrozí i lom, zesilte průřez.</div>' : '');
    const g1 = grafPruhyb(r, null, sir('grafPruhyb')); $('grafPruhyb').innerHTML = g1.svg; GR.pripojHover($('grafPruhyb'), g1.meta, (x) => f(x, 0) + ' mm');
    const g2 = grafMoment(r, null, sir('grafMoment')); $('grafMoment').innerHTML = g2.svg; GR.pripojHover($('grafMoment'), g2.meta, (x) => f(x, 0) + ' mm');
    // porovnání materiálů
    const rad = D.MATERIALY_POLIC.map((m) => {
      try {
        const vv = J.police(Object.assign(vstupPolice(), { E: m.E, rho: m.rho, kdef: m.kdef, fm: m.fm, prvku: 60 }));
        return { m, vv };
      } catch (e) { return null; }
    }).filter(Boolean);
    $('tabPorovnani').innerHTML = '<tr><th>Materiál</th><th class="c">E</th><th class="c">k_def</th><th class="c">δ konečný</th><th class="c">L/δ</th><th class="c">max kg/m</th><th></th></tr>' +
      rad.map(({ m, vv }) => `<tr${m.id === q.material ? ' style="background:var(--bg-control)"' : ''}><td>${esc(m.nazev)}</td><td class="c">${m.E}</td><td class="c">${f(m.kdef, 2)}</td><td class="c">${f(Math.abs(vv.dlouhodobe.wMax), 2)} mm</td><td class="c">${Number.isFinite(vv.nejhorsi.pomer) ? f(vv.nejhorsi.pomer, 0) : '∞'}</td><td class="c">${Number.isFinite(vv.kgmMax) ? f(vv.kgmMax, 0) : '–'}</td><td>${vv.vyhovuje ? '<span class="stav-ok" style="color:var(--ok)">✓</span>' : '<span style="color:var(--danger)">✗</span>'}</td></tr>`).join('');
    if (sc3) sc3.nastav(v, p, { zvetseni: zv3d(v, p), barvit: q.barvit, knihy: q.knihy });
    posledniPolice = { v, p };
  }
  let sc3 = null, posledniPolice = null, nacitam3d = false;
  // automatické zvětšení: největší průhyb zobrazit jako ~4 % délky police
  function zv3d(v, p) {
    if (S.police.zvetseni > 0) return S.police.zvetseni;
    const w = Math.abs(v.dlouhodobe.wMax) || 1e-9;
    return Math.max(1, Math.min(500, Math.round(0.04 * p.delka / w)));
  }
  function zkus3d() {
    if (sc3 || nacitam3d || S.tab !== 'police') return;
    const start = () => {
      if (sc3) return;
      try {
        $('stav3d') && $('stav3d').remove();
        sc3 = window.DV3.vytvor($('obal3d'));
        if (posledniPolice) sc3.nastav(posledniPolice.v, posledniPolice.p, { zvetseni: zv3d(posledniPolice.v, posledniPolice.p), barvit: S.police.barvit, knihy: S.police.knihy });
      } catch (e) { $('obal3d').innerHTML = '<div class="info" style="padding:12px">3D náhled není k dispozici (WebGL).</div>'; }
    };
    if (window.THREE) { start(); return; }
    nacitam3d = true;
    const s = document.createElement('script'); s.src = 'lib/three.0.160.0.min.js';
    s.onload = () => { nacitam3d = false; start(); };
    s.onerror = () => { nacitam3d = false; $('obal3d').innerHTML = '<div class="info" style="padding:12px">Knihovnu three.js se nepodařilo načíst.</div>'; };
    document.head.appendChild(s);
  }
  if ('IntersectionObserver' in window) new IntersectionObserver((z) => { if (z.some((q) => q.isIntersecting)) zkus3d(); }, { rootMargin: '200px' }).observe($('karta3d'));
  document.querySelectorAll('[data-pohled]').forEach((b) => b.addEventListener('click', () => {
    if (!sc3) return;
    const P = { iso: [-28, 22], predni: [0, 2], shora: [0, 85] }[b.dataset.pohled]; sc3.pohled(P[0], P[1]);
  }));

  /* ============================================================
     3. POVRCHY
     ============================================================ */
  const PLOCHY = [['vse', 'vše (plochy, hrany, čela)'], ['obe_hrany', 'obě plochy + podél. hrany'], ['obe', 'obě plochy'], ['lic_hrany', 'líc + hrany'], ['lic', 'jen líc']];
  function kresliKusovnik() {
    const dily = S.povrch.dily;
    $('tabKus').innerHTML = '<tr><th>Díl</th><th>Délka</th><th>Šířka</th><th>Tl.</th><th>ks</th><th>Upravit</th><th class="c">m²</th><th></th></tr>' + dily.map((d, i) => `<tr data-i="${i}">
      <td><input type="text" data-f="nazev" value="${esc(d.nazev)}" style="min-width:90px"></td>
      <td><input type="number" min="1" data-f="delka" value="${d.delka}"></td><td><input type="number" min="1" data-f="sirka" value="${d.sirka}"></td>
      <td><input type="number" min="1" data-f="tloustka" value="${d.tloustka}"></td><td><input type="number" min="1" step="1" data-f="ks" value="${d.ks}" style="min-width:44px"></td>
      <td><select data-f="plochy">${PLOCHY.map(([k, t]) => `<option value="${k}"${k === d.plochy ? ' selected' : ''}>${t}</option>`).join('')}</select></td>
      <td class="c" data-plocha>${f(J.plochaDilu(d), 3)}</td><td><button class="smaz" type="button" data-smaz title="Smazat">✕</button></td></tr>`).join('');
  }
  $('tabKus').addEventListener('input', (e) => {
    const tr = e.target.closest('tr[data-i]'); if (!tr || !e.target.dataset.f) return;
    const d = S.povrch.dily[+tr.dataset.i], k = e.target.dataset.f;
    d[k] = e.target.type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value;
    tr.querySelector('[data-plocha]').textContent = f(J.plochaDilu(d), 3);
    uloz(); prekresli(true);
  });
  $('tabKus').addEventListener('click', (e) => {
    if (!e.target.closest('[data-smaz]')) return;
    S.povrch.dily.splice(+e.target.closest('tr').dataset.i, 1); kresliKusovnik(); uloz(); prekresli();
  });
  $('btnPridatDil').addEventListener('click', () => { S.povrch.dily.push({ nazev: 'Díl ' + (S.povrch.dily.length + 1), delka: 600, sirka: 300, tloustka: 18, ks: 1, plochy: 'vse', drevina: 'smrk' }); kresliKusovnik(); uloz(); prekresli(); });
  $('btnPredvolbaKus').addEventListener('click', async () => {
    if (S.povrch.dily.length && !(await Dialog.potvrd('Nahradit současný kusovník předvolbou?'))) return;
    S.povrch.dily = kopie(KUS_PREDVOLBY[+$('selPredvolbaKus').value].dily); kresliKusovnik(); uloz(); prekresli();
  });
  $('plochaVolba').addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (!b) return; S.povrch.rezim = b.dataset.v; plochaVolba(); zobrazeni(); uloz(); prekresli(); });
  function plochaVolba() { for (const b of $('plochaVolba').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === S.povrch.rezim)); }
  function kresliSystem() {
    const sys = S.povrch.system;
    $('systemSeznam').innerHTML = sys.length ? sys.map((n, i) => `<div class="card" data-i="${i}" style="padding:8px;margin-bottom:6px;background:var(--bg)">
      <div style="display:flex;justify-content:space-between;gap:6px;align-items:center"><b style="font-size:.85rem">${i + 1}. ${esc(n.nazev)}</b><span style="white-space:nowrap">
      <button class="btn btn-sec btn-mini" type="button" data-akce="nahoru" title="Dřív" ${i ? '' : 'disabled'}>↑</button>
      <button class="btn btn-sec btn-mini" type="button" data-akce="smaz" title="Odebrat">✕</button></span></div>
      <div class="r4">
        <div><label>Vrstvy</label><input type="number" min="1" max="20" step="1" data-f="vrstvy" value="${n.vrstvy}"></div>
        <div><label title="m² na litr a vrstvu">m²/l</label><input type="number" min="1" max="200" step="0.5" data-f="vyd" value="${n.vyd}"></div>
        <div><label title="násobek spotřeby 1. vrstvy">1. vrstva ×</label><input type="number" min="1" max="3" step="0.05" data-f="prvni" value="${n.prvni}"></div>
        <div><label title="hodiny mezi vrstvami">Schnutí h</label><input type="number" min="0" max="200" step="0.5" data-f="schnuti" value="${n.schnuti}"></div>
      </div>
      <div class="r2"><div><label>Mezibroušení</label><input type="text" data-f="zrno" value="${esc(n.zrno)}"></div><div><label>Vytvrzení (dny)</label><input type="number" min="0" max="60" step="1" data-f="vytvrzeni" value="${n.vytvrzeni}"></div></div>
    </div>`).join('') : '<p class="info">Přidejte aspoň jeden nátěr.</p>';
  }
  $('systemSeznam').addEventListener('input', (e) => {
    const c = e.target.closest('[data-i]'); if (!c || !e.target.dataset.f) return;
    const n = S.povrch.system[+c.dataset.i], k = e.target.dataset.f;
    if (e.target.type === 'number') { const v = parseFloat(e.target.value); if (!Number.isFinite(v)) return; n[k] = v; } else n[k] = e.target.value;
    uloz(); prekresli(true);
  });
  $('systemSeznam').addEventListener('click', (e) => {
    const b = e.target.closest('[data-akce]'); if (!b) return;
    const i = +b.closest('[data-i]').dataset.i, s = S.povrch.system;
    if (b.dataset.akce === 'smaz') s.splice(i, 1);
    if (b.dataset.akce === 'nahoru' && i > 0) [s[i - 1], s[i]] = [s[i], s[i - 1]];
    kresliSystem(); uloz(); prekresli();
  });
  $('btnPridatNater').addEventListener('click', () => { S.povrch.system.push(nater($('selPridatNater').value)); kresliSystem(); uloz(); prekresli(); });

  function vypocetPovrch() {
    const p = S.povrch;
    const plocha = p.rezim === 'rucne' ? p.plochaRucne : p.dily.reduce((s, d) => s + J.plochaDilu(d), 0);
    const nan = D.NANASENI.find((n) => n.id === p.nanaseni) || D.NANASENI[0];
    const vel = String(p.baleni).split(/[;,\s]+/).map((x) => parseFloat(x.replace(',', '.'))).filter((x) => x > 0);
    const polozky = p.system.map((n) => {
      const sp = J.spotreba({ plocha, vrstvy: n.vrstvy, vydatnost: n.vyd, prvni: n.prvni, metoda: nan.k, rezerva: p.rezerva });
      return { n, sp, bal: J.baleni(sp.celkem, vel) };
    });
    const plan = J.planPraci(p.system.map((n) => Object.assign({}, n, { rychlost: nan.rychlost })), { plocha, start: p.start, zacatek: p.zacatek, konec: p.konec, zvednoutVlakno: p.zvednout });
    return { plocha, nan, polozky, plan };
  }
  function kresliPovrch(bezKusovniku) {
    const p = S.povrch;
    if (!bezKusovniku) { kresliKusovnik(); kresliSystem(); }
    const r = vypocetPovrch();
    $('kusSouhrn').textContent = `${p.dily.length} dílů · ${f(r.plocha, 3)} m²`;
    $('povrchCisla').innerHTML = `<div><b>${f(r.plocha, 2)} m²</b><span>plocha</span></div>` + r.polozky.map((x) => `<div><b>${f(x.sp.celkem, 2)} l</b><span>${esc(x.n.nazev)}</span></div>`).join('');
    $('tabSpotreba').innerHTML = '<tr><th>Nátěr</th><th class="c">vrstev</th><th class="c">na vrstvu</th><th class="c">čistá</th><th class="c">s rezervou</th><th>balení</th></tr>' +
      r.polozky.map((x) => `<tr><td>${esc(x.n.nazev)}</td><td class="c">${x.n.vrstvy}</td><td class="c">${f(x.sp.naVrstvu, 3)} l</td><td class="c">${f(x.sp.cista, 3)} l</td><td class="c"><b>${f(x.sp.celkem, 2)} l</b></td><td>${x.bal.kusy.map((k) => `${k.ks}× ${f(k.objem, 3)} l`).join(' + ') || '–'}${x.bal.kusy.length ? ` <span class="stitek">zbude ${f(x.bal.prebytek, 2)} l</span>` : ''}</td></tr>`).join('') +
      `<tr><td colspan="6" class="info">Nanášení: ${esc(r.nan.nazev)} (×${r.nan.k}), rezerva ${f(p.rezerva, 0)} %. Příprava: broušení do ${esc((p.system[0] || {}).priprava || 'P180')}.</td></tr>`;
    const pl = r.plan;
    $('planSouhrn').textContent = `práce ${pl.dnuPraci} d · do plného vytvrzení ${pl.dnuCelkem} d`;
    $('grafPlan').innerHTML = pl.kroky.length ? GR.gantt(pl.kroky, { w: sir('grafPlan') }) : '';
    let den = 0, h = '<tr><th>Čas</th><th>Úkon</th></tr>';
    for (const k of pl.kroky) {
      const a = J.casText(k.od), b = J.casText(k.do);
      if (a.den !== den) { den = a.den; h += `<tr class="den"><td colspan="2">Den ${den}</td></tr>`; }
      const cas = k.typ === 'vytvrzeni' ? `od ${a.cas}` : `${a.cas}–${b.den !== a.den ? 'den ' + b.den + ' ' : ''}${b.cas}`;
      h += `<tr><td>${cas}</td><td>${k.typ === 'schnuti' ? '⏳ ' : k.typ === 'naneseni' ? '🖌️ ' : k.typ === 'vytvrzeni' ? '✅ ' : '🔧 '}${esc(k.akce)}</td></tr>`;
    }
    $('tabPlan').innerHTML = h;
  }

  /* ============================================================
     4. OBJEM
     ============================================================ */
  function kresliRez() {
    const o = S.objem;
    const opt = D.DREVINY.map((d) => `<option value="${d.id}">${esc(d.nazev)}</option>`).join('');
    $('tabRez').innerHTML = '<tr><th>Položka</th><th>Dřevina</th><th>L mm</th><th>Š mm</th><th>T mm</th><th>ks</th><th>Kč/m³</th><th class="c">m³</th><th class="c">kg</th><th class="c">Kč</th><th></th></tr>' +
      o.polozky.map((p, i) => `<tr data-i="${i}"><td><input type="text" data-f="nazev" value="${esc(p.nazev)}" style="min-width:90px"></td>
      <td><select data-f="drevina" style="min-width:110px">${opt.replace(`value="${p.drevina}"`, `value="${p.drevina}" selected`)}</select></td>
      <td><input type="number" min="1" data-f="L" value="${p.L}"></td><td><input type="number" min="1" data-f="W" value="${p.W}"></td><td><input type="number" min="1" data-f="T" value="${p.T}"></td>
      <td><input type="number" min="1" step="1" data-f="ks" value="${p.ks}" style="min-width:44px"></td><td><input type="number" min="0" step="100" data-f="cena" value="${p.cena}" style="min-width:76px"></td>
      <td class="c" data-v></td><td class="c" data-m></td><td class="c" data-c></td><td><button class="smaz" type="button" data-smaz title="Smazat">✕</button></td></tr>`).join('');
  }
  $('tabRez').addEventListener('input', (e) => zmenaRez(e));
  $('tabRez').addEventListener('change', (e) => { if (e.target.tagName === 'SELECT') zmenaRez(e); });
  function zmenaRez(e) {
    const tr = e.target.closest('tr[data-i]'); if (!tr || !e.target.dataset.f) return;
    const p = S.objem.polozky[+tr.dataset.i], k = e.target.dataset.f;
    p[k] = e.target.type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value;
    if (k === 'drevina' && D.CENY[p.drevina]) { p.cena = D.CENY[p.drevina]; tr.querySelector('[data-f=cena]').value = p.cena; }
    uloz(); prekresli(true);
  }
  $('tabRez').addEventListener('click', (e) => { if (!e.target.closest('[data-smaz]')) return; S.objem.polozky.splice(+e.target.closest('tr').dataset.i, 1); kresliRez(); uloz(); prekresli(); });
  $('btnPridatRez').addEventListener('click', () => { S.objem.polozky.push({ nazev: 'Položka ' + (S.objem.polozky.length + 1), drevina: 'smrk', L: 2000, W: 100, T: 25, ks: 1, cena: D.CENY.smrk }); kresliRez(); uloz(); prekresli(); });
  $('btnRezZKus').addEventListener('click', async () => {
    if (!S.povrch.dily.length) { toast('Kusovník v záložce Povrchy je prázdný.', true); return; }
    if (S.objem.polozky.length && !(await Dialog.potvrd('Nahradit řezný seznam díly z kusovníku (Povrchy)?'))) return;
    S.objem.polozky = S.povrch.dily.map((d) => ({ nazev: d.nazev, drevina: d.drevina || 'smrk', L: d.delka, W: d.sirka, T: d.tloustka, ks: d.ks, cena: D.CENY[d.drevina || 'smrk'] || 0 }));
    kresliRez(); uloz(); prekresli();
  });
  function vypocetObjem() {
    const o = S.objem;
    const pol = o.polozky.map((p) => { const d = drevina(p.drevina); return { L: p.L, W: p.W, T: p.T, ks: p.ks, rho12: d.rho, cena: p.cena, cv: d.ct + d.cr }; });
    const sum = J.souhrnReziva(pol, { odpad: o.odpad, mc: o.mc });
    const kul = (o.kulMetoda === 'smalian' ? J.objemSmalian(o.kulD, o.kulD2, o.kulL) : J.objemHuber(o.kulD, o.kulL)) * o.kulKs;
    const krivka = [];
    for (let mc = 0; mc <= 80; mc += 2) krivka.push([mc, J.souhrnReziva(pol, { odpad: 0, mc }).hmotnost]);
    return { sum, kul, krivka, pol };
  }
  function grafHmotnost(r, pal, w) {
    const P = pal || GR.PAL_OBR, o = S.objem;
    return GR.cara({ id: 'gHm', w: w || 680, h: 230, pal: P, nadpis: 'Hmotnost řezného seznamu (bez odpadu)', x: { min: 0, max: 80, popis: 'vlhkost dřeva MC %' }, y: { min: 0, popis: 'kg' },
      serie: [{ nazev: 'hmotnost', body: r.krivka, barva: P.s1, jednotka: 'kg' }],
      svisle: [{ x: J.FSP, popis: 'FSP' }],
      body: [{ x: o.mc, y: r.sum.hmotnost, popis: `${f(o.mc, 1)} % → ${f(r.sum.hmotnost, 1)} kg`, barva: P.s2 }] });
  }
  function kresliObjem(bezTabulky) {
    const o = S.objem;
    if (!bezTabulky) kresliRez();
    const r = vypocetObjem(), s = r.sum;
    $('tabRez').querySelectorAll('tr[data-i]').forEach((tr) => {
      const q = s.radky[+tr.dataset.i]; if (!q) return;
      tr.querySelector('[data-v]').textContent = f(q.v, 4); tr.querySelector('[data-m]').textContent = f(q.hmotnost, 1); tr.querySelector('[data-c]').textContent = f(q.cena, 0);
    });
    $('rezSouhrn').textContent = `${o.polozky.length} položek`;
    $('objemCisla').innerHTML = `<div><b>${f(s.objem, 4)} m³</b><span>čistý objem</span></div><div><b>${f(s.objemBrutto, 4)} m³</b><span>k nákupu (+${f(o.odpad, 0)} %)</span></div><div><b>${f(s.hmotnost, 1)} kg</b><span>hmotnost při ${f(o.mc, 1)} %</span></div><div><b>${f(s.cena, 0)} Kč</b><span>cena</span></div>`;
    $('lKulD').textContent = o.kulMetoda === 'smalian' ? 'd₁ čelo (cm)' : 'd střed (cm)';
    $('kulUdaje').innerHTML = `<div><span>Objem kulatiny</span><span>${f(r.kul, 3)} plm</span></div><div><span>1 kus</span><span>${f(r.kul / Math.max(1, o.kulKs), 3)} plm</span></div>`;
    $('prmUdaje').innerHTML = `<div><span>${f(o.prm, 1)} prm ≈</span><span>${f(o.prm * o.prmFaktor, 2)} plm</span></div><div><span>1 plm ≈</span><span>${f(1 / o.prmFaktor, 2)} prm</span></div>`;
    const m2 = J.hmotnostPoSuseni(o.m1, o.mc1, o.mc2), m0 = o.m1 / (1 + o.mc1 / 100);
    $('susUdaje').innerHTML = [['Hmotnost po sušení', f(m2, 2) + ' kg'], ['Odpaří se vody', f(o.m1 - m2, 2) + ' kg (' + f((o.m1 - m2) / o.m1 * 100, 1) + ' %)'], ['Sušina', f(m0, 2) + ' kg'], ['Relativní vlhkost nyní / cíl', `${f(J.absNaRel(o.mc1), 1)} / ${f(J.absNaRel(o.mc2), 1)} %`]].map(([a, b]) => `<div><span>${a}</span><span>${b}</span></div>`).join('');
    $('vazUdaje').innerHTML = o.m0Vaz > 0 ? `<div><span>Vlhkost MC (na sušinu)</span><span>${f(J.vlhkostVazenim(o.mVaz, o.m0Vaz), 1)} %</span></div><div><span>Relativní w (na mokrou)</span><span>${f((o.mVaz - o.m0Vaz) / o.mVaz * 100, 1)} %</span></div>` : '';
    const g = grafHmotnost(r, null, sir('grafHmotnost')); $('grafHmotnost').innerHTML = g.svg; GR.pripojHover($('grafHmotnost'), g.meta, (x) => `MC ${f(x, 0)} %`);
  }
  $('inAbs').addEventListener('input', () => { const v = parseFloat($('inAbs').value); if (Number.isFinite(v)) $('inRel').value = (+J.absNaRel(v).toFixed(2)); });
  $('inRel').addEventListener('input', () => { const v = parseFloat($('inRel').value); if (Number.isFinite(v) && v < 100) $('inAbs').value = (+J.relNaAbs(v).toFixed(2)); });
  $('btnCsv').addEventListener('click', () => {
    const r = vypocetObjem();
    const rad = [['polozka', 'drevina', 'L_mm', 'S_mm', 'T_mm', 'ks', 'm3', 'kg', 'Kc_m3', 'Kc']].concat(S.objem.polozky.map((p, i) => [p.nazev, drevina(p.drevina).nazev, p.L, p.W, p.T, p.ks, r.sum.radky[i].v.toFixed(5), r.sum.radky[i].hmotnost.toFixed(2), p.cena, r.sum.radky[i].cena.toFixed(0)]));
    stahni('﻿' + rad.map((x) => x.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n'), 'rezny_seznam.csv', 'text/csv');
  });

  /* ---------------- překreslení ---------------- */
  let rafId = 0, castecne = false;
  function prekresli(bezTabulek) {
    castecne = castecne || !!bezTabulek;
    if (rafId) return;
    const cast = bezTabulek;
    rafId = requestAnimationFrame(() => {
      rafId = 0; const c = castecne && cast; castecne = false;
      try {
        if (S.tab === 'pohyb') kresliPohyb();
        else if (S.tab === 'police') kresliPolice();
        else if (S.tab === 'povrch') kresliPovrch(c);
        else kresliObjem(c);
      } catch (e) { console.error(e); toast('Chyba výpočtu: ' + e.message, true); }
    });
  }

  /* ---------------- projekty, export ---------------- */
  function stahni(obsah, nazev, typ) {
    const blob = obsah instanceof Blob ? obsah : new Blob([obsah], { type: typ });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const projekty = () => { try { return JSON.parse(localStorage.getItem(KLIC_PROJ) || '[]'); } catch (e) { return []; } };
  function ulozProjekty(p) { try { localStorage.setItem(KLIC_PROJ, JSON.stringify(p)); } catch (e) { toast('Úložiště je plné nebo zakázané.', true); } }
  function kresliProjekty() {
    const p = projekty();
    $('projekty').innerHTML = p.length ? p.map((x, i) => `<li><span title="${esc(x.datum || '')}">${esc(x.nazev)}</span><button type="button" data-nacti="${i}">Načíst</button><button type="button" data-smaz="${i}">✕</button></li>`).join('') : '<li><span class="info">Žádné uložené projekty.</span></li>';
  }
  $('btnUlozit').addEventListener('click', () => {
    const n = $('nazevProjektu').value.trim() || ('Projekt ' + new Date().toLocaleString('cs-CZ'));
    const p = projekty().filter((x) => x.nazev !== n);
    p.unshift({ nazev: n, datum: new Date().toISOString(), stav: S }); ulozProjekty(p); kresliProjekty(); toast('Uloženo: ' + n);
  });
  $('projekty').addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const p = projekty();
    if (b.dataset.nacti != null) { pouzijStav(p[+b.dataset.nacti].stav); $('nazevProjektu').value = p[+b.dataset.nacti].nazev; toast('Načteno'); }
    if (b.dataset.smaz != null && await Dialog.potvrd(`Smazat projekt „${p[+b.dataset.smaz].nazev}“?`)) { p.splice(+b.dataset.smaz, 1); ulozProjekty(p); kresliProjekty(); }
  });
  function pouzijStav(st) { S = sloucit(vychozi(), st); vse(); uloz(); }
  $('btnExportJson').addEventListener('click', () => stahni(JSON.stringify({ format: 'drevo_vypocty', verze: 1, nazev: $('nazevProjektu').value, stav: S }, null, 1), 'drevo_vypocty.json', 'application/json'));
  $('btnImportJson').addEventListener('click', () => $('souborJson').click());
  $('souborJson').addEventListener('change', async (e) => {
    const s = e.target.files[0]; if (!s) return;
    try {
      const d = JSON.parse(await s.text());
      if (!d || !d.stav || !d.stav.pohyb) throw new Error('není to projekt této stránky');
      pouzijStav(d.stav); if (d.nazev) $('nazevProjektu').value = d.nazev; toast('Importováno');
    } catch (er) { toast('Soubor nelze načíst: ' + er.message, true); }
    e.target.value = '';
  });
  $('btnReset').addEventListener('click', async () => { if (await Dialog.potvrd('Vrátit všechny záložky na výchozí hodnoty?')) { const t = S.tab; S = vychozi(); S.tab = t; vse(); uloz(); } });

  let pismoSlib = null;
  function nactiPismo() {
    if (window.FONTY_JS && window.FONTY_JS['LiberationSans-Regular.ttf']) return Promise.resolve(window.FONTY_JS['LiberationSans-Regular.ttf']);
    if (pismoSlib) return pismoSlib;
    pismoSlib = new Promise((ok) => {
      const s = document.createElement('script'); s.src = 'stitky_panely/fonty/LiberationSans-Regular.ttf.js';
      s.onload = () => ok((window.FONTY_JS || {})['LiberationSans-Regular.ttf'] || null);
      s.onerror = () => { pismoSlib = null; ok(null); };
      document.head.appendChild(s);
    });
    return pismoSlib;
  }
  const udajeZ = (id) => [...$(id).querySelectorAll(':scope > div')].map((d) => [...d.querySelectorAll('span')].map((x) => x.textContent)).filter((x) => x.length === 2);
  async function oddilyPdf(tab) {
    const P = GR.PAL_PDF, png = (svg) => GR.svgNaPng(svg, 1600);
    const o = [];
    if (tab === 'pohyb') {
      const p = S.pohyb, r = vypocetPohyb(), d = drevina(p.drevina);
      o.push({ nadpis: '1. Pohyb dřeva', text: `Dřevina: ${d.nazev} (C_T ${f(p.ctP, 3)} %/%, C_R ${f(p.crP, 3)} %/%, ${d.zdroj === 'usda' ? 'USDA Wood Handbook 2010' : 'typické EU hodnoty'}). Deska ${f(p.sirka, 0)} × ${f(p.tloustka, 0)} mm, řez ${r.popisRezu}. Klima: ${$('klimaPopis').textContent}. Vlhkost při výrobě ${f(p.mcVyroba, 1)} %, zpoždění τ = ${f(p.tau, 0)} d.`,
        udaje: [['Vlhkost dřeva v roce', `${f(r.mcMin, 1)}–${f(r.mcMax, 1)} %`], ['Pohyb šířky', f(r.rozsah, 2) + ' mm'], ['Pohyb tloušťky', f(r.rozsahTl, 2) + ' mm'], ['Koeficient šířky', f(r.c * 100, 3) + ' %/%'], ['EMC ' + f(p.emcT, 1) + ' °C / ' + f(p.emcRH, 0) + ' %', f(J.emc(p.emcT, p.emcRH), 1) + ' %']].concat(udajeZ('pohybUdaje')),
        obrazky: [Object.assign(await png(grafRok(r, P).svg), { sirkaMm: 180 }), Object.assign(await png(grafSirka(r, P).svg), { sirkaMm: 180 })] });
      o.push({ nadpis: 'Výplň rámu', udaje: udajeZ('ramUdaje'), obrazky: [Object.assign(await png(schemaRam(r.ram, P)), { sirkaMm: 90 })] });
      o.push({ nadpis: 'Deska stolu – podélné otvory', udaje: udajeZ('stulUdaje'), tabulka: { hlavicka: ['od zadní hrany mm', 'od pevného bodu', 'posun ven', 'posun dovnitř', 'otvor mm'], radky: r.stul.prvky.map((q) => [f(q.x, 0), f(q.odPevneho, 0), f(q.ven, 1), f(q.dovnitr, 1), Math.abs(q.odPevneho) < 1 ? 'kulatý (pevný bod)' : f(Math.ceil(q.delkaOtvoru * 2) / 2, 1) + ' × ' + f(p.stulSroub + 0.5, 1)]) } });
      o.push({ nadpis: 'Palubky / obklad', udaje: udajeZ('palUdaje') });
    }
    if (tab === 'police') {
      const r = vypocetPolice(), v = r.v, q = S.police;
      o.push({ nadpis: '2. Průhyb police', text: `${material(q.material).nazev}: E ${q.E} MPa, k_def ${q.kdef}. Police ${q.delka} × ${q.hloubka} × ${q.tloustka} mm, užitné ${q.kgm} kg/m${q.bodKg > 0 ? `, bod ${q.bodKg} kg v ${q.bodX} mm` : ''}. Podpory: ${r.p.podpory.map((x) => f(x.x, 0) + (x.vetknuti ? ' (vetknutí)' : '')).join(', ')} mm.${q.lista ? ` Přední lišta ${q.listaB}×${q.listaH} mm (E ${q.listaE}).` : ''}${q.zadni ? ` Zadní lišta ${q.zadniB}×${q.zadniH} mm.` : ''} Výsledek: ${v.vyhovuje ? 'VYHOVUJE' : 'NEVYHOVUJE'} limitu L/${v.limit}.`,
        udaje: [['Okamžitý průhyb', f(Math.abs(v.okamzite.wMax), 2) + ' mm'], ['Konečný průhyb', f(Math.abs(v.dlouhodobe.wMax), 2) + ' mm'], ['Nejhorší L/δ', Number.isFinite(v.nejhorsi.pomer) ? f(v.nejhorsi.pomer, 0) : '∞'], ['Max. užitné', Number.isFinite(v.kgmMax) ? f(v.kgmMax, 0) + ' kg/m' : '–']].concat(udajeZ('policeUdaje')),
        obrazky: [Object.assign(await png(GR.bokorysPolice(v, r.p, { w: 680, h: 210, pal: P })), { sirkaMm: 180 }), Object.assign(await png(GR.prurezPolice(v, r.p, { w: 320, h: 170, pal: P })), { sirkaMm: 85 }), Object.assign(await png(grafPruhyb(r, P).svg), { sirkaMm: 180 })] });
    }
    if (tab === 'povrch') {
      const r = vypocetPovrch(), p = S.povrch;
      o.push({ nadpis: '3. Povrchová úprava', text: `Plocha ${f(r.plocha, 3)} m² (${p.rezim === 'rucne' ? 'zadaná' : 'z kusovníku'}), nanášení ${r.nan.nazev}, rezerva ${p.rezerva} %.`,
        tabulka: p.rezim === 'rucne' ? null : { hlavicka: ['Díl', 'L × Š × T mm', 'ks', 'úprava', 'm²'], sirky: [40, 40, 12, 50, 20], radky: p.dily.map((d) => [d.nazev, `${d.delka} × ${d.sirka} × ${d.tloustka}`, d.ks, (PLOCHY.find((x) => x[0] === d.plochy) || [0, ''])[1], f(J.plochaDilu(d), 3)]) } });
      o.push({ nadpis: 'Spotřeba', tabulka: { hlavicka: ['Nátěr', 'vrstev', 'm²/l', 's rezervou', 'balení'], sirky: [60, 15, 15, 25, 45], radky: r.polozky.map((x) => [x.n.nazev, x.n.vrstvy, f(x.n.vyd, 1), f(x.sp.celkem, 2) + ' l', x.bal.kusy.map((k) => `${k.ks}× ${f(k.objem, 3)} l`).join(' + ')]) } });
      o.push({ nadpis: `Plán po dnech (práce ${r.plan.dnuPraci} d, vytvrzení ${r.plan.dnuCelkem} d)`, obrazky: r.plan.kroky.length ? [Object.assign(await png(GR.gantt(r.plan.kroky, { w: 680, pal: P })), { sirkaMm: 180 })] : [],
        tabulka: { hlavicka: ['Den', 'Čas', 'Úkon'], sirky: [12, 30, 140], radky: r.plan.kroky.map((k) => { const a = J.casText(k.od), b = J.casText(k.do); return [a.den, k.typ === 'vytvrzeni' ? 'od ' + a.cas : `${a.cas}–${b.den !== a.den ? 'd' + b.den + ' ' : ''}${b.cas}`, k.akce]; }) },
        text: 'Hadry nasáklé olejem se mohou samovolně vznítit – rozložit naplocho venku nebo do kovové nádoby s vodou.' });
    }
    if (tab === 'objem') {
      const r = vypocetObjem(), ob = S.objem;
      o.push({ nadpis: '4. Řezný seznam, objem a hmotnost', udaje: [['Čistý objem', f(r.sum.objem, 4) + ' m³'], ['K nákupu (+' + ob.odpad + ' %)', f(r.sum.objemBrutto, 4) + ' m³'], ['Hmotnost při ' + f(ob.mc, 1) + ' %', f(r.sum.hmotnost, 1) + ' kg'], ['Cena (ilustrativní)', f(r.sum.cena, 0) + ' Kč']],
        tabulka: { hlavicka: ['Položka', 'Dřevina', 'L × Š × T', 'ks', 'm³', 'kg', 'Kč'], sirky: [35, 35, 35, 10, 18, 15, 18], radky: ob.polozky.map((p, i) => [p.nazev, drevina(p.drevina).nazev, `${p.L} × ${p.W} × ${p.T}`, p.ks, f(r.sum.radky[i].v, 4), f(r.sum.radky[i].hmotnost, 1), f(r.sum.radky[i].cena, 0)]) },
        obrazky: [Object.assign(await png(grafHmotnost(r, P).svg), { sirkaMm: 170 })] });
      o.push({ nadpis: 'Kulatina, prostorové metry, sušení', udaje: udajeZ('kulUdaje').concat(udajeZ('prmUdaje'), udajeZ('susUdaje'), udajeZ('vazUdaje')) });
    }
    return o;
  }
  $('btnPdf').addEventListener('click', async () => {
    const b = $('btnPdf'), puv = b.textContent; b.disabled = true; b.textContent = 'Připravuji PDF…';
    const puvTab = S.tab;
    try {
      if (!window.jspdf) throw new Error('Knihovna jsPDF se nenačetla.');
      const pismo = await nactiPismo();
      if (!pismo) toast('Písmo se nepodařilo načíst – PDF bude bez diakritiky.');
      const taby = $('pdfVse').checked ? ['pohyb', 'police', 'povrch', 'objem'] : [puvTab];
      let odd = [];
      for (const t of taby) {
        // údaje se čtou z vykreslené záložky → každou vykreslit
        S.tab = t;
        if (t === 'pohyb') kresliPohyb(); else if (t === 'police') kresliPolice(); else if (t === 'povrch') kresliPovrch(); else kresliObjem();
        odd = odd.concat(await oddilyPdf(t));
      }
      S.tab = puvTab; prekresli();
      const doc = V.report(window.jspdf.jsPDF, odd, { pismo, nazev: ($('nazevProjektu').value.trim() || 'Dřevo – pohyb, průhyb, povrchy'), datum: new Date().toLocaleDateString('cs-CZ'),
        podtitul: 'Výpočty: EMC Hailwood–Horrobin (USDA Wood Handbook 2010), MKP nosníku se složeným průřezem, k_def podle EN 1995-1-1. Hodnoty materiálů jsou typické – ověřte u dodavatele.',
        poznamka: 'Výsledky jsou orientační technický odhad, nenahrazují statický výpočet konstrukce. Dřevo je přírodní materiál s rozptylem vlastností ±15–25 %.' });
      stahni(doc.output('blob'), 'drevo_vypocty.pdf');
    } catch (e) { S.tab = puvTab; toast('Chyba PDF: ' + e.message, true); }
    finally { b.disabled = false; b.textContent = puv; }
  });
  $('btnSvg').addEventListener('click', () => {
    const P = GR.PAL_PDF; let svg, n;
    try {
      if (S.tab === 'pohyb') { svg = grafRok(vypocetPohyb(), P).svg; n = 'vlhkost_rok.svg'; }
      else if (S.tab === 'police') { const r = vypocetPolice(); svg = GR.bokorysPolice(r.v, r.p, { w: 680, h: 200, pal: P }); n = 'police_bokorys.svg'; }
      else if (S.tab === 'povrch') { svg = GR.gantt(vypocetPovrch().plan.kroky, { w: 680, pal: P }); n = 'plan_uprav.svg'; }
      else { svg = grafHmotnost(vypocetObjem(), P).svg; n = 'hmotnost.svg'; }
      stahni(svg, n, 'image/svg+xml');
    } catch (e) { toast('Chyba: ' + e.message, true); }
  });

  /* ---------------- start ---------------- */
  function vse() {
    naplnPrvky(); kresliMesice(); mezeryVolba(); plochaVolba(); kresliProjekty();
    kresliKusovnik(); kresliSystem(); kresliRez();
    prepniTab(S.tab);
  }
  let sirkaOkna = innerWidth;
  addEventListener('resize', () => { if (Math.abs(innerWidth - sirkaOkna) > 30) { sirkaOkna = innerWidth; prekresli(); } });
  nacti();
  postavSeznamy();
  vse();
  $('inAbs').value = 15; $('inRel').value = +J.absNaRel(15).toFixed(2);
})();
