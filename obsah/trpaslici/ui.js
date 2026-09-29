/* ============================================================
   Srdce hory – ui.js: plátno, kamera, ovládání, herní smyčka a panel.
   Jediný soubor (vedle grafika.js), který sahá na DOM.
   ============================================================ */
var TRP = globalThis.TRP = globalThis.TRP || {};

(function (T) {
  'use strict';
  const HORA = T.hora, G = T.grafika, HRA = T.hra, P = T.prace, ST = T.stavby, U = T.ulozeni, POT = T.potreby, OB = T.obdobi, UD = T.udalosti, PB = T.pribeh, Z = T.zvuk;
  const { W, H, UDOLI, M, MATERIAL, RUDA, OBJEKT } = HORA;
  const S = G.S;
  const KLIC_SEED = 'webapp_hra_trpaslici_seed';
  const KLIC_ULOZENI = 'webapp_hra_trpaslici_save';
  const TAH_MS = 100;                            // jeden tah simulace při rychlosti 1×
  const $ = id => document.getElementById(id);

  const st = { hra: null, vseZnamo: false, vyber: null, najeti: null, nastroj: 'pohled', tah: null,
               vybrany: 0, sledovat: false, rychlost: 1, predPauzou: 1, alfa: 0 };
  const kam = { x: 0, y: 0, z: 3 };
  let cv, ctx, mini, mctx, dpr = 1, spinave = true, snimek = 0;
  let rekordy = null;                               // osobní rekordy (rekord.js), když je k dispozici
  const cas0 = performance.now();

  const uloziste = {
    cti(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    pis(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* soukromé okno */ } },
  };

  // --- hra --------------------------------------------------------------------------
  function novaHra(seed, rezim) { zacniHru(HRA.novaHra(seed, rezim || ($('rezimVolny') && $('rezimVolny').checked ? 'volny' : 'kampan'))); uloz(); }
  function zacniHru(hra) {
    st.hra = hra;
    st.vyber = null; st.najeti = null; st.vybrany = 0; st.sledovat = false; st.tah = null;
    uloziste.pis(KLIC_SEED, String(st.hra.seed));
    $('nazevHory').textContent = st.hra.hora.nazev;
    $('nadpisHory').textContent = st.hra.hora.nazev;
    $('seedChip').textContent = st.hra.seed;
    $('seed').value = st.hra.seed;
    kam.z = vychoziZoom();
    naBranu();
    $('jak').open = hra.tik < HRA.TAHU_ZA_DEN;      // nápověda rozbalená jen na začátku hry
    posledniDenik = -1;
    obnovPanel(true);
    spinave = true;
  }
  let posledniUlozenyDen = 0;
  function uloz() {
    if (!st.hra) return;
    uloziste.pis(KLIC_ULOZENI, U.serializuj(st.hra));
    posledniUlozenyDen = HRA.den(st.hra);
  }
  function exportuj() {
    const blob = new Blob([U.serializuj(st.hra)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `srdce-hory-${st.hra.seed}-den${HRA.den(st.hra)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importuj(soubor) {
    const r = new FileReader();
    r.onload = () => {
      try { zacniHru(U.obnov(r.result)); uloz(); oznam(`Načteno: ${st.hra.hora.nazev}, den ${HRA.den(st.hra)}.`); }
      catch (e) { oznam('Soubor se nedá načíst: ' + e.message, true); }
    };
    r.readAsText(soubor);
  }
  function oznam(text, chyba) { if (typeof Dialog !== 'undefined') (chyba ? Dialog.chyba : Dialog.info)(text); }

  // kolik polí hory je prozkoumaných (obloha se nepočítá)
  function statistika() {
    const { hora, znamo } = st.hra;
    let zname = 0, hory = 0;
    for (let i = 0; i < W * H; i++) {
      if (hora.pozadi[i] === M.VZDUCH) continue;
      hory++;
      if (st.vseZnamo || znamo[i]) zname++;
    }
    return 100 * zname / hory;
  }

  // --- kamera -----------------------------------------------------------------------
  const ZMIN = 1, ZMAX = 8;
  function vychoziZoom() {
    const cssVyska = cv.height / dpr;
    return Math.max(2, Math.min(4, Math.round(cssVyska / (14 * S)))) * dpr;
  }
  function naBranu() { st.sledovat = false; vystred(st.hra.hora.brana.x + 1, st.hra.hora.brana.y - 2); }
  function vystred(tx, ty) {
    kam.x = (tx + 0.5) * S - cv.width / kam.z / 2;
    kam.y = (ty + 0.5) * S - cv.height / kam.z / 2;
    omezKameru();
  }
  function omezKameru() {                        // za okraj mapy se nedívá (tam nic není)
    const osa = (v, vel, rozmer) => {
      const lo = 0, hi = rozmer - vel;
      return lo > hi ? (rozmer - vel) / 2 : Math.max(lo, Math.min(hi, v));
    };
    kam.x = osa(kam.x, cv.width / kam.z, W * S);
    kam.y = osa(kam.y, cv.height / kam.z, H * S);
    spinave = true;
  }
  // z je v px zařízení na pixel světa; povolené jsou celé násobky dpr (ostré pixely)
  function zoomuj(krok, cx, cy) {
    const uroven = Math.round(kam.z / dpr) + krok;
    const nz = Math.max(ZMIN, Math.min(ZMAX, uroven)) * dpr;
    if (nz === kam.z) return;
    if (cx == null) { cx = cv.width / 2; cy = cv.height / 2; }
    const wx = kam.x + cx / kam.z, wy = kam.y + cy / kam.z;
    kam.z = nz;
    kam.x = wx - cx / nz; kam.y = wy - cy / nz;
    omezKameru();
  }
  function velikost() {
    const obal = $('mapaObal');
    const staryDpr = dpr;
    dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(obal.clientWidth * dpr)), h = Math.max(1, Math.round(obal.clientHeight * dpr));
    if (cv.width === w && cv.height === h && staryDpr === dpr) return;
    const stred = cv.width > 1 ? { x: kam.x + cv.width / kam.z / 2, y: kam.y + cv.height / kam.z / 2 } : null;
    if (staryDpr !== dpr) kam.z = Math.max(1, Math.round(kam.z / staryDpr)) * dpr;
    cv.width = w; cv.height = h;
    if (stred) { kam.x = stred.x - w / kam.z / 2; kam.y = stred.y - h / kam.z / 2; }
    omezKameru();
  }
  function poleZBodu(ox, oy) {                   // CSS px na plátně → pole
    return { x: Math.floor((kam.x + ox * dpr / kam.z) / S), y: Math.floor((kam.y + oy * dpr / kam.z) / S) };
  }
  function trpaslikNa(p) {                        // trpaslík, který je vidět na poli (i v pohybu)
    let nej = null, nd = 1e9;
    for (const t of st.hra.trpaslici) {
      const q = G.polohaTrpaslika(t, st.alfa);
      const d = Math.hypot(q.x - (p.x + 0.5) * S, q.y - (p.y + 0.5) * S);
      if (d < 12 && d < nd) { nd = d; nej = t; }
    }
    return nej;
  }

  // --- panel ------------------------------------------------------------------------
  const MISTA = {
    krapnikova: 'krápníková jeskyně', jeskyne: 'jeskyně', houbova: 'houbová jeskyně', jezero: 'podzemní jezero',
    hlubinna: 'hlubinná jeskyně', tunel: 'cizí tunel', magma: 'magmatická kapsa', sin: 'Síň předků',
    straznice: 'strážnice předků', srdce: 'Srdce hory',
  };
  const radek = (a, b) => `<div class="radek"><span>${a}</span><span>${b}</span></div>`;
  function popisPole(p) {
    if (!p || p.x < 0 || p.y < 0 || p.x >= W || p.y >= H) return '<p class="tip">Klepni na pole nebo na trpaslíka.</p>';
    const hra = st.hra, hora = hra.hora, i = p.y * W + p.x;
    const radky = [];
    const r = (a, b) => radky.push(radek(a, b));
    const hl = p.y - UDOLI;
    r('Hloubka', hl === 0 ? 'v úrovni údolí' : hl < 0 ? `${-hl} m nad údolím` : `${hl} m pod údolím`);
    if (!st.vseZnamo && !hra.znamo[i]) {
      r('Co tu je', '<i>neprozkoumaná hora</i>');
    } else {
      const t = hora.teren[i], mat = MATERIAL[t];
      if (mat.pevne) {
        r('Hornina', mat.nazev);
        if (hora.ruda[i]) r('Žíla', '<b>' + RUDA[hora.ruda[i]].nazev + '</b>');
        r('Tvrdost', t === M.PODLOZI ? 'nedá se prokopat' : '⛏️'.repeat(mat.tvrdost));
        r('Unese strop', t === M.PODLOZI ? '–' : `${mat.rozpeti} polí bez podpěry`);
        const pr = (hra.praskani || []).find(q => q.y - 1 === p.y && p.x >= q.x0 && p.x <= q.x1);
        if (pr) r('⚠️ Strop', `<b class="spatne">praská – zřítí se za ${Math.max(0, Math.ceil((pr.tik - hra.tik) / 10))} s</b>`);
      } else if (t === M.VODA || t === M.MAGMA) {
        r('Kapalina', mat.nazev);
      } else {
        r('Volno', hora.pozadi[i] === M.VZDUCH ? 'obloha' : 'dutina (' + MATERIAL[hora.pozadi[i]].nazev + ')');
        if (hra.lez[i]) r('Stavba', 'vytesané schodiště');
        const pr = (hra.praskani || []).find(q => q.y <= p.y && p.x >= q.x0 && p.x <= q.x1 && p.y - q.y < 3);
        if (pr) r('⚠️ Strop nad', `<b class="spatne">praská – podepři ho (zřítí se za ${Math.max(0, Math.ceil((pr.tik - hra.tik) / 10))} s)</b>`);
        if ((hra.prameny || []).some(q => q.i === i)) r('Pramen', 'z pukliny tu vytéká voda');
        if (hra.lez[i] === 2) r('Stavba', 'žebřík');
        const kod = hra.stavba[i];
        if (kod && kod !== ST.K.DILNA) r('Stavba', ST.STAVBY[ST.KOD_TYP[kod]].nazev + (hra.materialNa.get(i) === 'kamen' ? ' (kamenný)' : ''));
      }
      if (hora.obj[i]) r('Objekt', OBJEKT[hora.obj[i]]);
      const ob = hora.oblast[i] && hora.oblasti.find(o => o.cislo === hora.oblast[i]);
      if (ob && (st.vseZnamo || hra.objeveno[ob.cislo])) r('Místo', MISTA[ob.typ] || ob.typ);
      const veci = P.veciNa(hra, i);
      if (veci.length) r('Leží tu', veci.map(v => P.VECI[v.druh].nazev).join(', '));
    }
    if (hra.oznac[i]) r('Práce', hra.oznac[i] === P.OZN.SCHODY ? '🪜 vytesat schodiště' : '⛏️ vykopat');
    return radky.join('');
  }
  function popisTrpaslika(t) {
    const hra = st.hra, pr = HRA.PROFESE[t.prof];
    const y = (t.i / W | 0) - UDOLI;
    const zdravi = t.zdravi >= 100 ? 'zdravý' : t.zdravi > 60 ? 'pohmožděný' : t.zdravi > 30 ? 'zraněný' : 'těžce zraněný';
    return `<div class="trp-hlava"><img src="${portret(t)}" alt="" width="32" height="32"><div><b>${t.jmeno}</b><br><span class="popis">${pr.nazev}</span></div></div>` +
      [['Dělá', HRA.popisCinnosti(hra, t)], ['Zdraví', `${zdravi} (${Math.max(0, Math.round(t.zdravi))} %)`],
       ['Kopání', '★'.repeat(Math.max(1, Math.min(5, Math.ceil(t.dov.kopani / 4)))) + ` ${t.dov.kopani}/20`],
       ['Boj', `${'⚔️'.repeat(Math.max(1, Math.ceil((t.dov.boj || 0) / 3)))} ${t.dov.boj || 0}/10` + (t.zbran ? ' · 🪓 válečná sekera' : '') + (t.zbroj ? ` · 🛡️ ${t.zbroj.mat === 'med' ? 'měděná' : 'železná'} zbroj` : '')],
       ['Nástroj', t.nastroj ? `${P.VECI[t.nastroj.druh].ikona} ${t.nastroj.mat === 'med' ? 'měděný' : 'železný'} ${P.VECI[t.nastroj.druh].nazev} (${Math.ceil(t.nastroj.stav)} %)`
         : (ST.PREFERUJE[t.prof] ? `<i>žádný – chce ${P.VECI[ST.PREFERUJE[t.prof]].nazev}</i>` : '–')],
       ['Kde', y === 0 ? 'v úrovni údolí' : y < 0 ? `${-y} m nad údolím` : `${y} m pod údolím`]]
        .map(([a, b]) => radek(a, b)).join('') +
      ['jidlo', 'piti', 'spanek'].map(k => {
        const v = Math.round(t[k]), tr = v < 20 ? 'spatne' : v < 40 ? 'varuj' : '';
        return `<div class="pruh ${tr}"><span>${{ jidlo: '🍖 jídlo', piti: '🍺 pití', spanek: '💤 spánek' }[k]}</span><i><b style="width:${v}%"></b></i></div>`;
      }).join('') +
      `<div class="nalada"><b>${smajlik(t.nalada)} nálada ${t.nalada}/100</b> <small>práce ${Math.round(POT.rychlost(t) * 100)} %</small>` +
      POT.rozpis(hra, t).sort((a, b) => a[1] - b[1]).map(([txt, h]) => `<div class="duvod ${h < 0 ? 'minus' : 'plus'}"><span>${txt}</span><span>${h > 0 ? '+' : ''}${h}</span></div>`).join('') +
      '</div>' +
      (st.sledovat ? '<p class="tip" style="margin-top:4px">🎥 Pohled ho sleduje – posunem pohledu sledování skončí.</p>' : '');
  }
  const smajlik = n => n >= 70 ? '😀' : n >= 50 ? '🙂' : n >= 35 ? '😐' : n >= 20 ? '🙁' : '😠';
  const portrety = new Map();
  function portret(t) {
    const k = t.prof + t.vous;
    if (!portrety.has(k)) {
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
      x.drawImage(G.spriteTrpaslika(HRA.PROFESE[t.prof].barva, t.vous, 'stoji', t.prof === 'hornik', false), 0, 0, 32, 32);
      portrety.set(k, c.toDataURL());
    }
    return portrety.get(k);
  }
  // dílna, plán nebo zóna na vybraném poli
  function popisStavby(p) {
    if (!p || p.x < 0 || p.y < 0 || p.x >= W || p.y >= H) return '';
    const hra = st.hra, i = p.y * W + p.x, z = P.zasoby(hra);
    let h = '';
    const d = ST.dilnaNa(hra, i);
    if (d) {
      const D = ST.STAVBY[d.typ];
      const kdo = hra.trpaslici.filter(t => t.prof === ST.PROFESE_DILNY[d.typ]).map(t => t.jmeno).join(', ') || 'kdokoli (řemeslník chybí)';
      h += `<div class="blok"><h4>${D.ikona} ${D.nazev}</h4><p class="tip">Pracuje: ${kdo}</p>` +
        (d.vRobe ? (() => {
          const zk = d.fronta.find(q => q.id === d.vRobe.zak), rc = zk && ST.RECEPTY[d.typ][zk.r];
          if (!rc) return '';
          const m = ST.materialReceptu(rc);
          return `<p class="tip">Rozpracováno: <b>${rc.nazev || P.VECI[rc.vyrobek].nazev}</b> – materiál ` +
            Object.entries(m).map(([druh, n]) => `${P.VECI[druh].ikona} ${d.vRobe.doneseno[druh] || 0}/${n}`).join(', ') +
            (HRA.dilnaPripravena(d) ? ' ✔ čeká na řemeslníka' : '') + '</p>';
        })() : '') +
        ST.RECEPTY[d.typ].map((rc, r) => `<div class="recept"><span>${P.VECI[rc.vyrobek].ikona} ${rc.nazev || P.VECI[rc.vyrobek].nazev}` +
          ` <small>(${Object.entries(ST.materialReceptu(rc)).map(([druh, n]) => `${n} ${P.VECI[druh].ikona}` +
            `<span class="${(z[druh] || 0) >= n ? '' : 'spatne'}">(${z[druh] || 0})</span>`).join(' + ')} → ${rc.pocet || 1})</small></span>` +
          `<button class="mini" data-akce="zakazka" data-dilna="${d.id}" data-r="${r}" data-n="1" title="Vyrobit jednou">+1</button>` +
          `<button class="mini" data-akce="zakazka" data-dilna="${d.id}" data-r="${r}" data-n="5" title="Vyrobit pětkrát">+5</button>` +
          `<button class="mini" data-akce="udrzuj" data-dilna="${d.id}" data-r="${r}" data-n="5" title="Udržovat zásobu (o 5 víc)">♾️</button></div>`).join('') +
        (d.fronta.length ? '<p class="tip" style="margin-top:4px">Zakázky:</p>' + d.fronta.map(zk => {
          const rc = ST.RECEPTY[d.typ][zk.r];
          const popis = zk.trvala ? `udržuj ${zk.cil} × ${P.VECI[rc.vyrobek].nazev} <small>(je ${hra.veci.filter(v => v.druh === rc.vyrobek).length})</small>` : `${rc.nazev || P.VECI[rc.vyrobek].nazev} × ${zk.zbyva}`;
          return `<div class="recept"><span>${zk.trvala ? '♾️' : '▶'} ${popis}</span>` +
            (zk.trvala ? `<button class="mini" data-akce="udrzuj" data-dilna="${d.id}" data-r="${zk.r}" data-n="-5" title="O 5 méně">−5</button>` : '') +
            `<button class="mini" data-akce="zrus-zakazku" data-dilna="${d.id}" data-id="${zk.id}" title="Zrušit zakázku">✖</button></div>`;
        }).join('')
          : '<p class="tip">Žádné zakázky – +1 vyrobí jednou, ♾️ udržuje zásobu.</p>') + '</div>';
    }
    const pid = hra.planNa.get(i);
    if (pid) {
      const pl = ST.planPodle(hra, pid), D = ST.STAVBY[pl.typ];
      h += `<div class="blok"><h4>${D.ikona} plán: ${D.nazev}</h4>` +
        Object.entries(D.mat).map(([druh, n]) => radek(P.VECI[druh].ikona + ' ' + P.VECI[druh].nazev, `${pl.doneseno[druh]} / ${n}` +
          (pl.doneseno[druh] < n && !(z[druh] || hra.veci.some(v => v.druh === druh)) ? ' <span class="spatne">– chybí!</span>' : ''))).join('') +
        `<p class="tip">${ST.pripraven(pl) ? 'Materiál je na místě, čeká se na stavitele.' : 'Trpaslíci nosí materiál.'}</p>` +
        `<button class="btn sede mini-sirka" data-akce="zrus-plan" data-i="${i}">✖ Zrušit plán</button></div>`;
    }
    if (hra.stavba[i] === ST.K.MRIZ) {
      const z = hra.zavreno[i];
      h += `<div class="blok"><h4>🚧 padací mříž – ${z ? '<b class="spatne">zavřená</b>' : 'otevřená'}</h4><p class="tip">Zavřená nepustí nikoho, ani trpaslíky.</p>` +
        `<button class="btn${z ? '' : ' sede'} mini-sirka" data-akce="mriz" data-i="${i}">${z ? '⬆️ Otevřít mříž' : '⬇️ Spustit mříž'}</button></div>`;
    }
    const tv = (hra.tvorove || []).filter(u => u.i === i);
    for (const u of tv) h += `<div class="blok"><h4>👹 ${T.hrozby.DRUHY[u.druh].nazev}</h4>${radek('Zdraví', `${Math.max(0, Math.round(u.zdravi))} / ${T.hrozby.DRUHY[u.druh].zdravi}`)}</div>`;
    const zo = ST.zonaNa(hra, i);
    if (zo) {
      const Z = ST.ZONY[zo.typ], vyb = ST.vybaveni(hra, zo.id);
      h += `<div class="blok"><h4>${Z.ikona} ${Z.nazev} <small>(${vyb.polí} polí)</small></h4><p class="tip">${Z.popis}</p>`;
      if (zo.typ === 'sklad') h += `<label class="filtr">Přijímá: <select data-akce="filtr" data-zona="${zo.id}">` +
        Object.entries(ST.SKUPINY).map(([k, g]) => `<option value="${k}"${zo.druh === k ? ' selected' : ''}>${g.ikona} ${g.nazev}</option>`).join('') + '</select></label>';
      if (zo.typ === 'loznice') h += radek('Postele', vyb.postel + (vyb.postel ? '' : ' <span class="spatne">– postav postel</span>'));
      if (zo.typ === 'jidelna') h += radek('Stoly / židle', `${vyb.stul} / ${vyb.zidle}` + (vyb.stul ? '' : ' <span class="spatne">– chybí stůl</span>'));
      if (vyb.socha) h += radek('Sochy', vyb.socha);
      if (ST.FARMY[zo.typ]) {
        let zas = 0, roste = 0, zrale = 0, prazdne = 0;
        for (let k = 0; k < hra.zona.length; k++) if (hra.zona[k] === zo.id) { const u = hra.uroda[k]; if (!u) prazdne++; else if (u === 101) zrale++; else if (u > 40) roste++; else zas++; }
        h += radek('Prázdné / zaseté / roste / zralé', `${prazdne} / ${zas} / ${roste} / ${zrale}`);
      }
      h += `<button class="btn sede mini-sirka" data-akce="zrus-zonu" data-zona="${zo.id}">✖ Zrušit zónu</button></div>`;
    }
    return h;
  }
  function ukazVyber() {
    const t = st.vybrany && st.hra.trpaslici.find(t => t.id === st.vybrany);
    if (st.vybrany && !t) { st.vybrany = 0; st.sledovat = false; }
    $('vyberNadpis').textContent = t ? '🧔 Trpaslík' : '🔍 Pole';
    const html = t ? popisTrpaslika(t) : popisStavby(st.vyber) + popisPole(st.vyber);
    const el = $('info');
    if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; }
  }
  let posledniDenik = -1, posledniKlan = '';
  const PRACE = [['kopat', '⛏️'], ['kacet', '🪓'], ['stavet', '🔨'], ['nosit', '📦'], ['pole', '🌾'], ['remeslo', '⚒️'], ['hlidat', '⚔️']];
  const PRACE_NAZEV = { kopat: 'kopání', kacet: 'kácení', stavet: 'stavění', nosit: 'nošení', pole: 'polní práce', remeslo: 'řemeslo v dílně', hlidat: 'stráž (lov nepřátel, výcvik)' };
  function obnovPanel(vse) {
    const hra = st.hra;
    if (HRA.den(hra) !== posledniUlozenyDen) uloz();
    $('den').textContent = HRA.den(hra);
    const h = HRA.hodina(hra);
    $('hodina').textContent = String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.floor(h % 1 * 6) * 10).padStart(2, '0');
    $('lidi').textContent = hra.trpaslici.length;
    const o = OB.OBDOBI[OB.obdobi(hra)];
    $('obdobi').textContent = `${o.ikona} ${o.nazev} ${(OB.denRoku(hra) - 1) % OB.DNI_OBDOBI + 1}/${OB.DNI_OBDOBI}`;
    $('obdobiChip').title = `Rok ${OB.rok(hra)}. Karavana přijíždí 8. den jara a 6. den podzimu.`;
    $('slava').textContent = hra.slava || 0;
    $('btnKaravana').hidden = !hra.karavana;
    const nepratel = (hra.tvorove || []).filter(u => st.vseZnamo || hra.znamo[u.i]).length;
    $('btnPoplach').hidden = !nepratel;
    $('btnPoplach').textContent = `⚔️ ${nepratel}`;
    // zásoby ve skladu
    const z = P.zasoby(hra), n = Math.max(1, hra.trpaslici.length);
    const jidla = (z.jidlo || 0), piv = (z.pivo || 0);
    $('jidloChip').querySelector('b').textContent = jidla;
    $('pivoChip').querySelector('b').textContent = piv;
    $('jidloChip').classList.toggle('varovani', jidla < 2 * n);
    $('pivoChip').classList.toggle('varovani', piv < 2 * n);
    const chipy = Object.keys(P.VECI).filter(k => z[k]).map(k =>
      `<span class="chip" title="${P.VECI[k].nazev} ve skladu">${P.VECI[k].ikona} <b>${z[k]}</b></span>`).join('');
    const zEl = $('zasoby');
    if (zEl.dataset.h !== chipy) { zEl.innerHTML = chipy || '<span class="tip">sklad je prázdný</span>'; zEl.dataset.h = chipy; }
    $('prozkoumano').textContent = statistika().toFixed(1).replace('.', ',') + ' %';
    $('nejhloubeji').textContent = hra.nejhloubeji + ' m';
    // klan
    const klan = hra.trpaslici.map(t => `<button class="clen${st.vybrany === t.id ? ' vybrany' : ''}" data-id="${t.id}">` +
      `<img src="${portret(t)}" alt="" width="24" height="24"><span><b>${t.jmeno}</b> <small>${HRA.PROFESE[t.prof].nazev}</small>` +
      `<small class="cinnost">${HRA.popisCinnosti(hra, t)}</small></span><i title="nálada ${t.nalada}">${smajlik(t.nalada)}</i>${t.jidlo < 25 ? '<i title="hlad">🍖</i>' : ''}${t.piti < 25 ? '<i title="žízeň">🍺</i>' : ''}` +
      `${t.uvizl ? '<i title="uvízl">🆘</i>' : ''}${t.zdravi < 100 ? '<i title="zraněný">🩹</i>' : ''}</button>`).join('');
    if (klan !== posledniKlan || vse) { $('klan').innerHTML = klan; posledniKlan = klan; }
    // povolené práce
    const prace = hra.trpaslici.map(t => `<tr><td>${t.jmeno}</td>` + PRACE.map(([k, ik]) =>
      `<td><button class="prepinac${t.povoleno[k] ? ' zap' : ''}" data-id="${t.id}" data-k="${k}" title="${ik} ${PRACE_NAZEV[k]}">${t.povoleno[k] ? ik : '·'}</button></td>`).join('') + '</tr>').join('');
    const pEl = $('prace');
    if (pEl.dataset.h !== prace) { pEl.dataset.h = prace; pEl.querySelector('tbody').innerHTML = prace; }
    if ($('prehledZasob').open) {
      const vse_ = {}, nese = {};
      for (const v of hra.veci) { const k = v.nese ? nese : ST.jeSklad(hra, v.i) ? z : vse_; if (k !== z) k[v.druh] = (k[v.druh] || 0) + 1; }
      const vRukou = {}; for (const t of hra.trpaslici) if (t.nastroj) vRukou[t.nastroj.druh] = (vRukou[t.nastroj.druh] || 0) + 1;
      const html = Object.entries(ST.SKUPINY).filter(([k]) => k !== 'vse').map(([k, g]) => {
        const radky = g.druhy.filter(d => z[d] || vse_[d] || nese[d] || vRukou[d]).map(d =>
          `<tr><td>${P.VECI[d].ikona} ${P.VECI[d].nazev}</td><td>${z[d] || 0}</td><td>${(vse_[d] || 0) + (nese[d] || 0)}</td><td>${vRukou[d] || ''}</td></tr>`).join('');
        return radky ? `<tr class="skupina"><th colspan="4">${g.ikona} ${g.nazev}</th></tr>` + radky : '';
      }).join('');
      const t = $('zasobyTab');
      if (t.dataset.h !== html) { t.dataset.h = html; t.querySelector('tbody').innerHTML = html || '<tr><td colspan="4" class="tip">nic</td></tr>'; }
    }
    // příběh předků a artefakty
    const pr = (hra.prectene.length ? hra.prectene.map(k => `<p class="ulomek"><b>📜 ${PB.ULOMKY[k].nadpis}</b><br>${PB.ULOMKY[k].text}</p>`).join('')
      : '<p class="tip">Runové desky předků leží v ruinách hluboko v hoře. Kdo je přečte, pozná cestu k Srdci.</p>') +
      (Object.keys(hra.artefakty).length ? '<div class="chipy">' + Object.keys(hra.artefakty).map(k => `<span class="chip" title="${PB.ARTEFAKTY[k].popis}">${PB.ARTEFAKTY[k].ikona} ${PB.ARTEFAKTY[k].nazev}</span>`).join('') + '</div>' : '') +
      `<p class="tip">${hra.rezim === 'volny' ? 'Volný režim – Spáč spí a hra nekončí.' : hra.vyhenHori ? '🔥 Výheň předků hoří.' : hra.spac.probuzen && !hra.spac.porazen ? '🌋 Pradávný spáč je vzhůru!' : 'Cíl: zažehnout Výheň předků Klíčem k Srdci.'}</p>`;
    if ($('pribeh').dataset.h !== pr) { $('pribeh').innerHTML = pr; $('pribeh').dataset.h = pr; }
    // výukové úkoly
    const cd = PB.coDal(hra);
    const cdh = cd ? `${cd.text} <small>(krok ${cd.krok}/${cd.z})</small>` : '✅ Všechny úkoly splněné – hora je vaše.';
    if ($('coDal').dataset.h !== cdh) { $('coDal').innerHTML = cdh; $('coDal').dataset.h = cdh; }
    if (rekordy) rekordy.hloubka.zapis(hra.nejhloubeji);
    // deník
    if (hra.denik.length !== posledniDenik || vse) {
      posledniDenik = hra.denik.length;
      $('denik').innerHTML = hra.denik.slice(-40).reverse().map(z =>
        `<li class="dz-${z.typ}"><span class="dz-den">den ${Math.floor(z.tik / HRA.TAHU_ZA_DEN) + 1}</span> ${z.text}</li>`).join('');
    }
    ukazVyber();
  }

  // --- události s volbou -------------------------------------------------------------------
  let udalostOtevrena = null;
  function hlidejUdalost() {
    const u = st.hra.udalost;
    if (!u || udalostOtevrena === u) return;
    udalostOtevrena = u;
    if (st.rychlost) { st.predUdalosti = st.rychlost; nastavRychlost(0); }
    $('udalostText').textContent = u.text;
    $('udalostVolby').innerHTML = u.volby.map((v, i) => `<button class="btn${i ? ' sede' : ''}" data-i="${i}">${v}</button>`).join('');
    const d = $('udalostOkno');
    if (!d.open) d.showModal();
  }
  function vyresUdalost(i) {
    const text = UD.vyres(st.hra, i);
    $('udalostOkno').close();
    udalostOtevrena = null;
    if (text) oznam(text);
    if (st.predUdalosti) { nastavRychlost(st.predUdalosti); st.predUdalosti = 0; }
    obnovPanel(true);
  }

  // --- konec hry ---------------------------------------------------------------------------------
  let konecUkazan = null;
  function hlidejKonec() {
    const k = st.hra.konec;
    if (!k || k.pokracovat || konecUkazan === k) return;
    konecUkazan = k;
    nastavRychlost(0);
    const s = k.stat;
    $('konecNadpis').textContent = k.vitezstvi ? '🔥 Srdce hory bije!' : '🪦 Hora utichla';
    $('konecText').textContent = PB.epilog(st.hra);
    $('konecStat').innerHTML = [['Dní', s.dni], ['Rok', s.roky], ['Trpaslíků (nejvíc)', `${s.zije} (${s.nejvic})`], ['Padlých', s.padlo],
      ['Sláva', s.slava], ['Nejhlouběji', s.hloubka + ' m'], ['Vykopaných polí', s.vykopano], ['Poražených nepřátel', s.zabito],
      ['Nájezdů', s.najezdu], ['Artefaktů', s.artefakty], ['Pradávný spáč', s.spac]].map(([a, b]) => radek(a, b)).join('');
    $('konecDal').hidden = !k.vitezstvi;
    let nove = [];
    if (rekordy) {
      if (k.vitezstvi && rekordy.vitezstvi.zapis(s.dni)) nove.push('nejrychlejší vítězství');
      if (rekordy.slava.zapis(s.slava)) nove.push('nejvyšší sláva');
      rekordy.hloubka.zapis(s.hloubka);
    }
    $('konecRekord').textContent = nove.length ? `🏆 Nový rekord: ${nove.join(', ')}!` : '';
    $('konecOkno').showModal();
  }

  // --- obchod s karavanou -------------------------------------------------------------------
  const obchodVyber = { nakup: {}, prodej: {} };
  function otevriObchod() {
    if (!st.hra.karavana) return;
    obchodVyber.nakup = {}; obchodVyber.prodej = {};
    if (st.rychlost) { st.predObchodem = st.rychlost; nastavRychlost(0); }
    vykresliObchod();
    $('obchodOkno').showModal();
  }
  function hodnotaProdeje(druh, n) {       // stejně jako obchod(): nejdražší kusy první
    const vv = (OB.naProdej(st.hra)[druh] || []).map(v => OB.cenaProdej(st.hra, v)).sort((a, b) => b - a);
    return vv.slice(0, n).reduce((a, b) => a + b, 0);
  }
  function vykresliObchod() {
    const hra = st.hra, k = hra.karavana;
    if (!k) { $('obchodOkno').close(); return; }
    const sklad = OB.naProdej(hra);
    let chci = 0, dam = 0;
    const radek_ = (strana, druh, max, cena, n) =>
      `<tr><td>${P.VECI[druh].ikona} ${P.VECI[druh].nazev}</td><td class="cis">${max}</td><td class="cis">${cena}</td>` +
      `<td class="pocet"><button class="mini" data-s="${strana}" data-d="${druh}" data-n="-1">−</button><b>${n || 0}</b>` +
      `<button class="mini" data-s="${strana}" data-d="${druh}" data-n="1">+</button></td></tr>`;
    const nab = Object.entries(k.nabidka).map(([druh, max]) => {
      const n = obchodVyber.nakup[druh] || 0; chci += n * OB.cenaNakup(druh);
      return radek_('nakup', druh, max, OB.cenaNakup(druh), n);
    }).join('');
    const pro = Object.keys(sklad).sort((a, b) => OB.cenaProdej(hra, sklad[b][0]) - OB.cenaProdej(hra, sklad[a][0])).map(druh => {
      const n = obchodVyber.prodej[druh] || 0; dam += hodnotaProdeje(druh, n);
      return radek_('prodej', druh, sklad[druh].length, Math.max(...sklad[druh].map(v => OB.cenaProdej(hra, v))), n);
    }).join('');
    $('obchodNakup').innerHTML = nab || '<tr><td colspan="4" class="tip">Karavana už nic nemá.</td></tr>';
    $('obchodProdej').innerHTML = pro || '<tr><td colspan="4" class="tip">Ve skladech nic není.</td></tr>';
    const zbyva = Math.max(0, Math.ceil((k.do - hra.tik) / HRA.TAHU_ZA_DEN * 24));
    $('obchodBilance').innerHTML = `Chceš zboží za <b>${chci}</b>, nabízíš <b class="${dam >= chci ? 'dobre' : 'spatne'}">${dam}</b>.` +
      (dam > chci ? ` <small>(Přebytek ${dam - chci} karavana nevrací.)</small>` : '') + ` <small>Karavana odjede za ${zbyva} h.</small>`;
    $('btnObchod').disabled = !(chci || dam) || dam < chci;
  }

  // --- zvuk a částice: události z logiky ------------------------------------------------------------
  const GLOBALNI = new Set(['roh', 'objev', 'zvonek', 'smrt', 'fanfara']);
  function vyberZvuky() {
    const ev = st.hra._zvuky;
    if (!ev || !ev.length) return;
    st.hra._zvuky = [];
    const sirka = cv.width / kam.z, vyska = cv.height / kam.z;
    for (const e of ev) {
      if (e.i < 0 || GLOBALNI.has(e.typ)) { Z.hraj(e.typ, 0.8, 0, e.x); continue; }
      const wx = (e.i % W) * S + 8, wy = (e.i / W | 0) * S + 8;
      const vObraze = wx > kam.x - S * 4 && wx < kam.x + sirka + S * 4 && wy > kam.y - S * 4 && wy < kam.y + vyska + S * 4;
      if (!vObraze || (!st.vseZnamo && !st.hra.znamo[e.i])) continue;
      G.casticeZUdalosti(e, st.hra);
      Z.hraj(e.typ, Math.min(1, 0.35 + kam.z / dpr / 6), ((wx - kam.x) / sirka) * 2 - 1, e.x);
    }
  }

  // --- nástroje a rychlost --------------------------------------------------------------
  function nastav(n) {
    st.nastroj = n;
    const skupina = n.split(':')[0];
    for (const b of document.querySelectorAll('#nastroje button')) b.setAttribute('aria-pressed', b.dataset.n === skupina);
    cv.classList.toggle('kresli', n !== 'pohled');
    $('paleta').hidden = true;
    const [druh, typ] = n.split(':');
    $('nastrojInfo').hidden = !typ;
    if (druh === 'stavba') {
      const d = ST.STAVBY[typ];
      $('nastrojInfo').innerHTML = `${d.ikona} <b>${d.nazev}</b> – ${d.sirka ? 'klepni na levé pole' : 'klepni nebo táhni'} <small>(Esc = konec)</small>`;
    } else if (druh === 'zona') {
      $('nastrojInfo').innerHTML = typ === 'zmensit' ? '✂️ <b>zmenšit zónu</b> – táhni přes pole, která z ní vyjmout'
        : `${ST.ZONY[typ].ikona} <b>${ST.ZONY[typ].nazev}</b> – táhni obdélník <small>(Esc = konec)</small>`;
    }
  }
  function ukazPaletu(co) {
    const pal = $('paleta');
    if (!pal.hidden && pal.dataset.co === co) { pal.hidden = true; return; }
    const z = P.zasoby(st.hra);
    const cena = d => Object.entries(d.mat).map(([druh, n]) => `${n} ${P.VECI[druh].ikona}` +
      `<small class="${(z[druh] || 0) >= n ? '' : 'spatne'}">(${z[druh] || 0})</small>`).join(' ');
    pal.innerHTML = co === 'stavba'
      ? Object.entries(ST.STAVBY).map(([typ, d]) => `<button data-n="stavba:${typ}" title="${d.popis}"><span>${d.ikona}</span><b>${d.nazev}</b><i>${cena(d)}</i></button>`).join('')
      : Object.entries(ST.ZONY).map(([typ, d]) => `<button data-n="zona:${typ}" title="${d.popis}"><span>${d.ikona}</span><b>${d.nazev}</b><i></i></button>`).join('') +
        `<button data-n="zona:zmensit" title="Vyjmout pole ze zóny"><span>✂️</span><b>zmenšit zónu</b><i></i></button>`;
    pal.dataset.co = co; pal.hidden = false;
  }
  function nastavRychlost(r) {
    if (r) st.predPauzou = r;
    st.rychlost = r;
    for (const b of document.querySelectorAll('#rychlost button')) b.setAttribute('aria-pressed', +b.dataset.r === r);
    $('pauzaZnacka').hidden = r !== 0;
  }

  // --- smyčka -----------------------------------------------------------------------
  let chybaKresleni = false, posledniSnimek = 0, posledniCas = 0, akum = 0, posledniPanel = 0;
  function prekresli() {
    if (st.sledovat && st.vybrany) {
      const t = st.hra.trpaslici.find(t => t.id === st.vybrany);
      if (t) {
        const q = G.polohaTrpaslika(t, st.alfa);
        kam.x = q.x - cv.width / kam.z / 2; kam.y = q.y - cv.height / kam.z / 2; omezKameru();
      }
    }
    const ted = performance.now(), dt = Math.min(0.1, (ted - (st.posledniKresba || ted)) / 1000);
    st.posledniKresba = ted;
    const p = { hora: st.hra.hora, znamo: st.hra.znamo, vseZnamo: st.vseZnamo, vyber: st.vybrany ? null : st.vyber,
                najeti: st.najeti, dpr, hra: st.hra, alfa: st.alfa, vybrany: st.vybrany, tah: st.tah, dt };
    G.kresli(ctx, p, kam, snimek, (performance.now() - cas0) / 1000);
    G.kresliMinimapu(mctx, p, kam, cv.width, cv.height);
    spinave = false;
  }
  function tahni(n) {                              // n tahů simulace naráz (pro testy a ladění)
    for (let k = 0; k < n; k++) HRA.krok(st.hra);
    spinave = true;
  }
  function smycka(t) {
    requestAnimationFrame(smycka);
    const dt = Math.min(250, t - (posledniCas || t)); posledniCas = t;
    if (st.hra && st.rychlost > 0 && !$('menu').open && !$('udalostOkno').open) {
      akum += dt * st.rychlost;
      let n = 0;
      while (akum >= TAH_MS && n < 40) { HRA.krok(st.hra); akum -= TAH_MS; n++; }
      if (n === 40) akum = 0;
      st.alfa = akum / TAH_MS;
      spinave = true;
    }
    if (t - posledniSnimek > 125) { posledniSnimek = t; snimek++; spinave = true; }
    if (st.hra) vyberZvuky();
    if (st.hra && t - (st.posledniHudba || 0) > 1000) { st.posledniHudba = t; Z.hudba((kam.y + cv.height / kam.z / 2) / S - UDOLI); }
    if (G.castice.length) spinave = true;
    if (st.hra && t - posledniPanel > 250) { posledniPanel = t; obnovPanel(false); hlidejUdalost(); hlidejKonec(); if ($('obchodOkno').open && !st.hra.karavana) $('obchodOkno').close(); }
    if (!spinave || !st.hra) return;
    try { prekresli(); chybaKresleni = false; }
    catch (e) { if (!chybaKresleni) { chybaKresleni = true; console.error(e); } }
  }

  function pouzijNastroj(r) {
    const hra = st.hra, [druh, typ] = r.druh.split(':');
    if (druh === 'stavba') {
      const n = ST.naplanujObdelnik(hra, typ, r.x0, r.y0, r.x1, r.y1);
      if (!n) oznam(`${ST.STAVBY[typ].nazev}: ${ST.prekazka(hra, typ, r.y0 * W + r.x0) || 'sem to nejde'}`, true);
    } else if (druh === 'zona') {
      if (typ === 'zmensit') ST.zrusZonu(hra, r.x0, r.y0, r.x1, r.y1);
      else if (!ST.novaZona(hra, r.x0, r.y0, r.x1, r.y1, typ, 'vse'))
        oznam(typ === 'sklad' ? 'Sklad jde jen na prozkoumanou volnou podlahu, která ještě není v jiné zóně.'
                              : 'Místnost jde jen do prozkoumaného volného prostoru pod zemí.', true);
      else { st.vybrany = 0; st.vyber = { x: r.x0, y: r.y0 }; }
    } else if (druh === 'zrusit') {
      P.oznac(hra, r.x0, r.y0, r.x1, r.y1, 'zrusit');
      HRA.zrusPlany(hra, r.x0, r.y0, r.x1, r.y1);
    } else P.oznac(hra, r.x0, r.y0, r.x1, r.y1, druh);
    obnovPanel(true);
  }

  // --- ovládání ---------------------------------------------------------------------
  function napojOvladani() {
    // poloha v CSS px na plátně; offsetX nepoužívat – syntetické události ho při DPI ≠ 1 v Chromiu počítají špatně
    const bod = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const ukazatele = new Map();
    let tah = null, stipnuti = null;
    cv.addEventListener('contextmenu', e => e.preventDefault());
    for (const ud of ['pointerdown', 'keydown']) window.addEventListener(ud, () => Z.probud(), { passive: true });
    $('zvukZap').checked = Z.nast.zvuk; $('hudbaZap').checked = Z.nast.hudba; $('hlasitost').value = Math.round(Z.nast.hlasitost * 100);
    $('zvukZap').onchange = e => Z.nastav('zvuk', e.target.checked);
    $('hudbaZap').onchange = e => Z.nastav('hudba', e.target.checked);
    $('hlasitost').oninput = e => Z.nastav('hlasitost', e.target.value / 100);
    cv.addEventListener('pointerdown', e => {
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* syntetická událost */ }
      const q = bod(e);
      ukazatele.set(e.pointerId, q);
      if (ukazatele.size === 1) {
        // s nástrojem se kreslí levým tlačítkem / jedním prstem; pravým tlačítkem se vždy posouvá pohled
        const kresli = st.nastroj !== 'pohled' && (e.button === 0 || e.pointerType !== 'mouse');
        const p = poleZBodu(q.x, q.y);
        tah = { x: q.x, y: q.y, kx: kam.x, ky: kam.y, posunuto: false, kresli };
        if (kresli) st.tah = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, druh: st.nastroj };
      } else if (ukazatele.size === 2) {
        const [a, b] = [...ukazatele.values()];
        stipnuti = { d: Math.hypot(a.x - b.x, a.y - b.y), uroven: Math.round(kam.z / dpr), sx: (a.x + b.x) / 2, sy: (a.y + b.y) / 2 };
        st.tah = null;
        if (tah) { tah.posunuto = true; tah.kresli = false; }
      }
      spinave = true;
    });
    cv.addEventListener('pointermove', e => {
      const q = bod(e);
      if (!ukazatele.has(e.pointerId)) {
        if (e.pointerType === 'mouse') {
          const p = poleZBodu(q.x, q.y);
          if (!st.najeti || st.najeti.x !== p.x || st.najeti.y !== p.y) { st.najeti = p; spinave = true; }
        }
        return;
      }
      ukazatele.set(e.pointerId, q);
      if (ukazatele.size === 2 && stipnuti) {
        const [a, b] = [...ukazatele.values()];
        const cil = Math.round(stipnuti.uroven * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, stipnuti.d));
        const sx = (a.x + b.x) / 2, sy = (a.y + b.y) / 2;
        zoomuj(cil - Math.round(kam.z / dpr), sx * dpr, sy * dpr);
        kam.x -= (sx - stipnuti.sx) * dpr / kam.z; kam.y -= (sy - stipnuti.sy) * dpr / kam.z;
        stipnuti.sx = sx; stipnuti.sy = sy; st.sledovat = false; omezKameru();
        return;
      }
      if (!tah) return;
      const dx = q.x - tah.x, dy = q.y - tah.y;
      if (!tah.posunuto && Math.hypot(dx, dy) > 6) { tah.posunuto = true; if (!tah.kresli) cv.classList.add('tazeni'); }
      if (tah.kresli) {
        const p = poleZBodu(q.x, q.y);
        if (st.tah && (st.tah.x1 !== p.x || st.tah.y1 !== p.y)) { st.tah.x1 = p.x; st.tah.y1 = p.y; spinave = true; }
      } else if (tah.posunuto) {
        kam.x = tah.kx - dx * dpr / kam.z; kam.y = tah.ky - dy * dpr / kam.z; st.sledovat = false; omezKameru();
      }
    });
    const konec = e => {
      if (!ukazatele.has(e.pointerId)) return;
      ukazatele.delete(e.pointerId);
      if (ukazatele.size < 2) stipnuti = null;
      if (ukazatele.size === 0) {
        if (tah && tah.kresli && st.tah && e.type === 'pointerup') pouzijNastroj(st.tah); else if (tah && !tah.posunuto && e.type === 'pointerup') {
          const q = bod(e), p = poleZBodu(q.x, q.y);
          const t = trpaslikNa(p);
          st.sledovat = false;
          const b_ = st.hra.hora.brana;
          if (st.hra.karavana && !t && p.y >= b_.y - 1 && p.y <= b_.y && p.x >= b_.x - 7 && p.x <= b_.x - 4) { otevriObchod(); st.tah = null; tah = null; return; }
          // druhé klepnutí na už vybraného trpaslíka vybere pole pod ním (dílnu, zónu…)
          if (t && st.vybrany !== t.id) st.vybrany = t.id;
          else { st.vybrany = 0; st.vyber = p; }
          obnovPanel(true);
        }
        st.tah = null; tah = null; cv.classList.remove('tazeni'); spinave = true;
      }
    };
    cv.addEventListener('pointerup', konec);
    cv.addEventListener('pointercancel', konec);
    cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && st.najeti) { st.najeti = null; spinave = true; } });
    cv.addEventListener('wheel', e => { e.preventDefault(); const q = bod(e); zoomuj(e.deltaY < 0 ? 1 : -1, q.x * dpr, q.y * dpr); }, { passive: false });
    mini.addEventListener('click', e => {
      const r = mini.getBoundingClientRect();
      st.sledovat = false;
      vystred(Math.floor((e.clientX - r.left) / r.width * W), Math.floor((e.clientY - r.top) / r.height * H));
    });
    $('btnPlus').onclick = () => zoomuj(1);
    $('btnMinus').onclick = () => zoomuj(-1);
    $('btnBrana').onclick = naBranu;
    for (const b of document.querySelectorAll('#nastroje button'))
      b.onclick = () => (b.dataset.n === 'stavba' || b.dataset.n === 'zona') ? ukazPaletu(b.dataset.n) : nastav(b.dataset.n);
    $('paleta').addEventListener('click', e => { const b = e.target.closest('button'); if (b) nastav(b.dataset.n); });
    // tlačítka v panelu vybraného pole
    $('info').addEventListener('click', e => {
      const b = e.target.closest('[data-akce]'); if (!b || b.tagName === 'SELECT') return;
      const hra = st.hra, a = b.dataset.akce;
      if (a === 'zakazka' || a === 'udrzuj') HRA.pridejZakazku(hra, hra.dilny.find(d => d.id === +b.dataset.dilna), +b.dataset.r, +b.dataset.n, a === 'udrzuj');
      else if (a === 'zrus-zakazku') HRA.zrusZakazku(hra, hra.dilny.find(d => d.id === +b.dataset.dilna), +b.dataset.id);
      else if (a === 'mriz') HRA.prepniMriz(hra, +b.dataset.i);
      else if (a === 'zrus-plan') { const i = +b.dataset.i; HRA.zrusPlany(hra, i % W, i / W | 0, i % W, i / W | 0); }
      else if (a === 'zrus-zonu') { const id = +b.dataset.zona; for (let i = 0; i < hra.zona.length; i++) if (hra.zona[i] === id) hra.zona[i] = 0; ST.uklidZony(hra); }
      obnovPanel(true); spinave = true;
    });
    $('prace').addEventListener('click', e => {
      const b = e.target.closest('button.prepinac'); if (!b) return;
      const t = st.hra.trpaslici.find(t => t.id === +b.dataset.id); if (!t) return;
      t.povoleno[b.dataset.k] ^= 1;
      if (!t.povoleno[b.dataset.k] && t.prace) HRA.pustPraci(st.hra, t);
      obnovPanel(true);
    });
    $('prehledZasob').addEventListener('toggle', () => obnovPanel(true));
    $('info').addEventListener('change', e => {
      const sel = e.target.closest('select[data-akce="filtr"]'); if (!sel) return;
      const z = st.hra.zony.find(z => z.id === +sel.dataset.zona); if (z) z.druh = sel.value;
      obnovPanel(true);
    });
    for (const b of document.querySelectorAll('#rychlost button')) b.onclick = () => nastavRychlost(+b.dataset.r);
    $('klan').addEventListener('click', e => {
      const b = e.target.closest('.clen'); if (!b) return;
      st.vybrany = +b.dataset.id; st.sledovat = true;
      obnovPanel(true); spinave = true;
    });

    window.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || $('menu').open || document.querySelector('dialog[open]')) return;
      const krok = 4 * S;
      const posun = { ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0], ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1] }[e.key];
      if (posun) { e.preventDefault(); st.sledovat = false; kam.x += posun[0] * krok; kam.y += posun[1] * krok; omezKameru(); return; }
      const k = e.key.toLowerCase();
      if (e.key === '+' || e.key === '=') zoomuj(1);
      else if (e.key === '-') zoomuj(-1);
      else if (e.key === 'Home') naBranu();
      else if (e.key === ' ') { e.preventDefault(); nastavRychlost(st.rychlost ? 0 : st.predPauzou); }
      else if (e.key === '1' || e.key === '2' || e.key === '3') nastavRychlost([1, 2, 4][+e.key - 1]);
      else if (k === 'k') nastav('kopat');
      else if (k === 'l') nastav('schody');
      else if (k === 'p') nastav('prio');
      else if (k === 'x') nastav('zrusit');
      else if (k === 'c') nastav('kacet');
      else if (k === 'b') ukazPaletu('stavba');
      else if (k === 'z') ukazPaletu('zona');
      else if (k === 'v' || e.key === 'Escape') { nastav('pohled'); st.tah = null; }
    });

    // události a obchod
    $('udalostVolby').addEventListener('click', e => { const b = e.target.closest('button'); if (b) vyresUdalost(+b.dataset.i); });
    $('udalostOkno').addEventListener('cancel', e => e.preventDefault());       // bez volby se okno nezavře
    $('btnKaravana').onclick = otevriObchod;
    $('btnPoplach').onclick = () => {
      const u = (st.hra.tvorove || []).find(u => st.vseZnamo || st.hra.znamo[u.i]);
      if (u) { st.sledovat = false; vystred(u.i % W, u.i / W | 0); st.vyber = { x: u.i % W, y: u.i / W | 0 }; st.vybrany = 0; obnovPanel(true); }
    };
    $('obchodOkno').addEventListener('click', e => {
      const b = e.target.closest('button[data-s]'); if (!b) return;
      const hra = st.hra, k = hra.karavana; if (!k) return;
      const strana = obchodVyber[b.dataset.s], druh = b.dataset.d;
      const max = b.dataset.s === 'nakup' ? (k.nabidka[druh] || 0) : (OB.naProdej(hra)[druh] || []).length;
      strana[druh] = Math.max(0, Math.min(max, (strana[druh] || 0) + +b.dataset.n));
      vykresliObchod();
    });
    $('btnObchod').onclick = () => {
      const r = OB.obchod(st.hra, obchodVyber.nakup, obchodVyber.prodej);
      oznam(r.zprava, !r.ok);
      if (r.ok) { obchodVyber.nakup = {}; obchodVyber.prodej = {}; }
      vykresliObchod(); obnovPanel(true);
    };
    $('obchodZavrit').onclick = () => $('obchodOkno').close();
    $('obchodOkno').addEventListener('close', () => { if (st.predObchodem) { nastavRychlost(st.predObchodem); st.predObchodem = 0; } });
    // menu
    const menu = $('menu');
    $('btnMenu').onclick = () => { $('celaHora').checked = st.vseZnamo; menu.showModal(); };
    $('menuZavrit').onclick = () => menu.close();
    const zacni = async seed => {
      menu.close();
      if (st.hra && st.hra.tik > HRA.TAHU_ZA_DEN && typeof Dialog !== 'undefined' &&
          !await Dialog.potvrd('Začít novou horu? Rozehraná hra se přepíše (ulož si ji případně do souboru).')) return;
      novaHra(seed);
    };
    $('btnExport').onclick = () => { exportuj(); menu.close(); };
    $('souborImport').onchange = e => { if (e.target.files[0]) importuj(e.target.files[0]); e.target.value = ''; menu.close(); };
    $('konecDal').onclick = () => { st.hra.konec.pokracovat = true; st.hra.rezim = 'volny'; $('konecOkno').close(); nastavRychlost(1); obnovPanel(true); };
    $('konecNova').onclick = () => { $('konecOkno').close(); menu.showModal(); };
    $('konecOkno').addEventListener('cancel', e => e.preventDefault());
    // uložit při odchodu ze stránky
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') uloz(); });
    window.addEventListener('pagehide', uloz);
    $('btnNova').onclick = () => zacni((Math.random() * 4294967296) >>> 0);
    $('btnDne').onclick = () => zacni(T.nahoda.seedDne());
    $('btnSeed').onclick = () => { const s = $('seed').value.trim(); if (s) zacni(T.nahoda.seedZTextu(s)); };
    $('seed').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnSeed').click(); });
    $('celaHora').onchange = e => { st.vseZnamo = e.target.checked; obnovPanel(true); spinave = true; };
    window.addEventListener('resize', velikost);
  }

  function vyplnLegendu() {
    const V = [['povrch', 'údolí, les, louka, potok'], ['0–20 m', MATERIAL[M.HLINA].nazev + ', ' + MATERIAL[M.JIL].nazev, M.HLINA],
      ['20–50 m', MATERIAL[M.VAPENEC].nazev + ', uhlí, krápníkové jeskyně', M.VAPENEC],
      ['50–90 m', MATERIAL[M.ZULA].nazev + ', železo, měď', M.ZULA],
      ['90–130 m', MATERIAL[M.CEDIC].nazev + ', stříbro, drahokamy, houby, jezero, ruiny předků', M.CEDIC],
      ['130–160 m', MATERIAL[M.HLUBINNY].nazev + ', magma, hvězdná ruda, Srdce hory', M.HLUBINNY]];
    $('vrstvy').innerHTML = V.map(([a, b, m]) =>
      `<tr><td>${a}</td><td>${m != null ? `<span class="vzorek" style="background:${MATERIAL[m].mini}"></span>` : '🌲 '}${b}</td></tr>`).join('');
    $('rudy').innerHTML = Object.keys(RUDA).map(k => RUDA[k]).map(d =>
      `<span><span class="vzorek" style="background:${d.mini}"></span>${d.nazev}</span>`).join('');
  }

  function start() {
    cv = $('mapa'); ctx = cv.getContext('2d');
    mini = $('minimapa'); mctx = mini.getContext('2d');
    velikost();
    napojOvladani();
    vyplnLegendu();
    if (typeof Rekord !== 'undefined') {
      rekordy = {
        vitezstvi: Rekord.sleduj('webapp_hra_trpaslici_vitezstvi', { vyssiLepsi: false, popisek: '🔥 Nejrychlejší vítězství', format: v => `${v}. den` }),
        hloubka: Rekord.sleduj('webapp_hra_trpaslici_hloubka', { popisek: '⛏️ Nejhlubší šachta', format: v => `${v} m` }),
        slava: Rekord.sleduj('webapp_hra_trpaslici_slava', { popisek: '⭐ Nejvyšší sláva', format: v => String(v) }),
      };
      rekordy.vitezstvi.prvek($('rekordVitezstvi')); rekordy.hloubka.prvek($('rekordHloubka')); rekordy.slava.prvek($('rekordSlava'));
    }
    const q = new URLSearchParams(location.search);
    st.vseZnamo = q.has('ladeni');
    const seed = q.get('seed') != null ? T.nahoda.seedZTextu(q.get('seed'))
      : uloziste.cti(KLIC_SEED) != null ? Number(uloziste.cti(KLIC_SEED)) >>> 0
      : (Math.random() * 4294967296) >>> 0;
    let ulozena = null;
    const text = uloziste.cti(KLIC_ULOZENI);
    if (text) {
      try { ulozena = U.obnov(text); }
      catch (e) { oznam('Uloženou hru se nepodařilo načíst: ' + e.message, true); }
    }
    if (ulozena && (q.get('seed') == null || ulozena.seed === seed)) zacniHru(ulozena);
    else novaHra(seed);
    nastav('pohled'); nastavRychlost(1);
    requestAnimationFrame(smycka);
  }

  T.ui = { st, kam, novaHra, zacniHru, uloz, otevriObchod, vyresUdalost, hlidejUdalost, hlidejKonec, prekresli, tahni, pouzijNastroj, ukazPaletu, zoomuj, vystred, naBranu, poleZBodu, nastav, nastavRychlost, obnovPanel,
           get platno() { return cv; }, get dpr() { return dpr; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(TRP);
