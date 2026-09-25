/* ============================================================
   Trosečníci – ui.js: stránka, kamera a ovládání.

   Pravidla drží hra.js; tady se jen kreslí, klikaním volají akce
   a stav se po každém tahu ukládá do localStorage.
   ============================================================ */
var TROS = globalThis.TROS = globalThis.TROS || {};

(function (T) {
  'use strict';
  const { W, H, TEREN_INFO, OBJ_INFO, LOKACE_INFO, CHODIT } = T.svet;
  const G = T.grafika, S = G.S, HRA = T.hra, P = T.postavy;
  const KLIC_ULOZENI = 'webapp_hra_trosecnici_save';
  const KLIC_REKORD = 'webapp_hra_trosecnici_dny';
  const KLIC_RADY = 'webapp_hra_trosecnici_rady';
  const radyZapnute = () => uloziste.cti(KLIC_RADY) !== '0';
  const KLIC_ZALOZKA = 'webapp_hra_trosecnici_zalozka', KLIC_RADA_SBALENA = 'webapp_hra_trosecnici_rada_sbalena';
  let zalozka = 'tady', videnoDeniku = 0;

  // --- záložky panelu ------------------------------------------------------------------------
  function prepniZalozku(t) {
    if (!document.querySelector(`.zalozka[data-tab="${t}"]`)) t = 'tady';
    zalozka = t;
    document.querySelectorAll('.zalozky button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
    document.querySelectorAll('.zalozka').forEach(z => { z.hidden = z.dataset.tab !== t; });
    $('panelObsah').scrollTop = 0;
    if (t === 'denik' && st.hra) videnoDeniku = st.hra.denik.length;
    uloziste.pis(KLIC_ZALOZKA, t);
    ukazOdznaky();
  }
  function ukazOdznaky() {
    const h = st.hra; if (!h) return;
    $('odznakLide').textContent = h.lide.length > 1 ? h.lide.length : '';
    const poskozene = h.stavby.filter(b => b.poskozeno).length;
    $('odznakTabor').textContent = poskozene ? '!' : (h.lod && !T.tajemstvi.hotova(h) ? Math.round(T.tajemstvi.postup(h) * 100) + '%' : '');
    $('odznakDenik').classList.toggle('nove', zalozka !== 'denik' && h.denik.length > videnoDeniku);
    if (zalozka === 'denik') videnoDeniku = h.denik.length;
  }

  const $ = id => document.getElementById(id);
  const uloziste = {
    cti(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    pis(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    smaz(k) { try { localStorage.removeItem(k); } catch (e) { /* nic */ } },
  };

  // st.hra = stav z hra.js; zbytek je jen stav zobrazení
  const st = { hra: null, vseOdkryte: false, vyber: null, cesta: null, hracZrcadlo: false };
  const kam = { x: 0, y: 0, z: 3 };
  let cv, ctx, mini, mctx, dpr = 1, snimek = 0, spinave = true, chuze = null, rekord = null, rekordPlavba = null, rekordLide = null;
  const PLNA = new Uint8Array(W * H).fill(1);

  // jedna značka nápovědy uprostřed kráteru (kráter může mít víc polí lávy)
  function stredKrateru(h) {
    const k = T.tajemstvi.krater(h); if (!k.length) return [];
    const cx = k.reduce((a, i) => a + i % W, 0) / k.length, cy = k.reduce((a, i) => a + ((i / W) | 0), 0) / k.length;
    return [k.reduce((b, i) => Math.hypot(i % W - cx, ((i / W) | 0) - cy) < Math.hypot(b % W - cx, ((b / W) | 0) - cy) ? i : b)];
  }
  // pohled pro grafiku
  function pohled() {
    const h = st.hra;
    return { svet: h.svet, mlha: st.vseOdkryte ? PLNA : h.mlha, vseOdkryte: st.vseOdkryte, hrac: h.hrac,
      vyber: st.vyber, cesta: st.cesta && st.cesta.kroky, hracZrcadlo: st.hracZrcadlo, stavby: h.stavby, den: h.den,
      nalezy: h.nalezy, vyprava: P.vyprava(h), tabor: P.vTabore(h), domov: P.domov(h),
      bedny: h.bedny, pocasi: T.pocasi.dnes(h), lod: h.lod, slapano: h.slapano,
      znacky: (h.tajemstvi && h.tajemstvi.ruiny && !T.tajemstvi.ma(h, 'ohen')) ? stredKrateru(h) : [] };
  }

  // --- hra: založení, uložení ---------------------------------------------------------
  function novaHra(seed) {
    zastavChuzi();
    nastavHru(HRA.nova(seed));
    uloz();
    if (radyZapnute()) ukazUvitani();
  }
  function ukazUvitani() {
    const h = st.hra;
    $('udalostNadpis').textContent = '🏝️ Ztroskotání';
    $('udalostText').innerHTML = `<p>Bouře roztříštila vaši loď o útes. Probral ses na pláži ostrova <i>${esc(h.svet.nazev)}</i> – sám, s nožem, láhví a pár prkny.</p>
      <ul class="uvod">
        <li>⚡ Každý den máš <b>${HRA.AB_DEN} akčních bodů</b>. Krok stojí 1–2 AB, akce 1–3 AB. Pak jdeš spát (🌙).</li>
        <li>🍖💧 V noci každý sní <b>1 🍖</b> a vypije <b>2 💧</b>. Co chybí, bere zdraví. Voda je nejdůležitější!</li>
        <li>🖱️ Klikni na pole – ukáže se cesta a co tam je. Druhým klikem tam dojdeš. Akce na místě jsou v panelu vpravo.</li>
      </ul>
      <p class="tip">Průvodce „🧭 Co dál?" v panelu ti poradí další krok. Vypnout ho můžeš v menu ☰.</p>`;
    const t = $('udalostTlacitka');
    t.innerHTML = '<button class="btn">🏝️ Začít</button>';
    t.querySelector('button').onclick = () => { $('udalost').hidden = true; };
    $('udalost').hidden = false;
    t.querySelector('button').focus();
  }
  function nastavHru(h) {
    st.hra = h; st.vyber = null; st.cesta = null;
    $('nazevOstrova').textContent = h.svet.nazev;
    $('noc').hidden = true; $('nalez').hidden = true; $('udalost').hidden = true; $('konec').hidden = true;
    kam.z = vychoziZoom();
    vystred(h.hrac.x, h.hrac.y);
    prekresliVse();
    if (h.konec) ukazKonec();
    else { const u = T.udalosti.cekajici(h); if (u) ukazUdalost(u); }
  }
  function uloz() { uloziste.pis(KLIC_ULOZENI, HRA.serializuj(st.hra)); }

  // --- kamera ---------------------------------------------------------------------------
  function vychoziZoom() {
    const min = Math.min(cv.width, cv.height);
    return Math.max(1, Math.min(10, Math.round(min / (11 * S))));
  }
  function vystred(tx, ty) {
    kam.x = (tx + 0.5) * S - cv.width / kam.z / 2;
    kam.y = (ty + 0.5) * S - cv.height / kam.z / 2;
    omezKameru();
  }
  function omezKameru() {
    const okraj = 4 * S;
    const osa = (v, vel, rozmer) => {       // mapa menší než výřez → na střed
      const lo = -okraj, hi = rozmer + okraj - vel;
      return lo > hi ? (rozmer - vel) / 2 : Math.max(lo, Math.min(hi, v));
    };
    kam.x = osa(kam.x, cv.width / kam.z, W * S);
    kam.y = osa(kam.y, cv.height / kam.z, H * S);
    spinave = true;
  }
  function zoomuj(nz, cx, cy) {            // cx, cy v px zařízení na plátně
    nz = Math.max(1, Math.min(10, nz));
    if (nz === kam.z) return;
    if (cx == null) { cx = cv.width / 2; cy = cv.height / 2; }
    const wx = kam.x + cx / kam.z, wy = kam.y + cy / kam.z;
    kam.z = nz;
    kam.x = wx - cx / nz; kam.y = wy - cy / nz;
    omezKameru();
  }
  function hlidejHrace() {
    const h = st.hra.hrac;
    const vw = cv.width / kam.z / S, vh = cv.height / kam.z / S;
    const rx = h.x + 0.5 - kam.x / S, ry = h.y + 0.5 - kam.y / S;
    const m = Math.min(3, vw / 4, vh / 4);
    if (rx < m || ry < m || rx > vw - m || ry > vh - m) vystred(h.x, h.y);
  }
  function velikost() {
    const obal = $('mapaObal');
    dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(obal.clientWidth * dpr)), h = Math.max(1, Math.round(obal.clientHeight * dpr));
    if (cv.width === w && cv.height === h) return;
    const stred = cv.width > 1 ? { x: kam.x + cv.width / kam.z / 2, y: kam.y + cv.height / kam.z / 2 } : null;
    cv.width = w; cv.height = h;
    if (stred) { kam.x = stred.x - w / kam.z / 2; kam.y = stred.y - h / kam.z / 2; }
    mini.width = W * 3; mini.height = H * 3;
    omezKameru();
  }

  let chybaKresleni = false;
  function smycka() {
    requestAnimationFrame(smycka);          // i kdyby kreslení selhalo, mapa nezamrzne natrvalo
    if (spinave && st.hra) {
      spinave = false;
      try {
        const p = pohled();
        G.kresli(ctx, p, kam, snimek);
        G.kresliMinimapu(mctx, p, kam, cv.width, cv.height);
      } catch (e) {
        if (!chybaKresleni) { chybaKresleni = true; console.error('Trosečníci: chyba kreslení', e); }
      }
    }
  }

  // --- výběr, cesta, chůze --------------------------------------------------------------
  function poleZBodu(px, py) {
    return { x: Math.floor((kam.x + px * dpr / kam.z) / S), y: Math.floor((kam.y + py * dpr / kam.z) / S) };
  }
  function znamo(x, y) { return st.vseOdkryte || st.hra.mlha[y * W + x]; }

  function spocitejCestu() {
    const h = st.hra;
    st.cesta = st.vyber ? HRA.cesta(st.vseOdkryte ? Object.assign(Object.create(h), { mlha: PLNA }) : h, st.vyber.x, st.vyber.y) : null;
    if (st.cesta) {                         // kam až dnes síly stačí
      let ab = h.ab;
      for (const k of st.cesta.kroky) { ab -= k.platba ?? k.cena; k.dosah = ab >= 0; }
    }
  }
  function klikNaPole(x, y) {
    if (x < 0 || y < 0 || x >= W || y >= H || !st.hra) return;
    if (st.vyber && st.vyber.x === x && st.vyber.y === y && st.cesta) { jdi(); return; }
    st.vyber = { x, y };
    spocitejCestu();
    if (zalozka !== 'tady') prepniZalozku('tady');
    ukazInfo();
    spinave = true;
  }

  function udelejKrok(x, y, presUnavu) {
    const h = st.hra, pred = h.hrac.x;
    const r = HRA.krok(h, x, y, { presUnavu });
    if (!r.ok) return r;
    if (x !== pred) st.hracZrcadlo = x < pred;
    for (const l of r.objevy) Dialog.info('⭐ Objeveno: ' + LOKACE_INFO[l.typ].nazev);
    hlidejHrace();
    if (r.napady && r.napady.length) { zastavChuzi(); r.zastav = true; ukazObjevy(r.napady); }
    if (r.nalez >= 0) { zastavChuzi(); r.zastav = true; ukazNalez(r.nalez); }
    return r;
  }
  function jdi(presUnavu) {
    if (!st.cesta || st.hra.konec) return;
    zastavChuzi();
    const kroky = st.cesta.kroky.slice();
    const cil = st.vyber;
    let presCelkem = 0;
    const souhrnUnavy = () => { if (presCelkem) Dialog.info(`🥾 Přes únavu ${presCelkem} AB: každý ve výpravě −${presCelkem * HRA.NAVIC_ZDRAVI} ❤️ (dnes ještě ${HRA.NAVIC_MAX - (st.hra.navic || 0)} AB navíc).`); presCelkem = 0; };
    const tik = () => {
      const k = kroky.shift();
      if (!k) { zastavChuzi(); souhrnUnavy(); return; }
      const r = udelejKrok(k.x, k.y, presUnavu);
      if (!r.ok) {
        zastavChuzi(); souhrnUnavy();
        st.vyber = cil; spocitejCestu(); prekresliVse();
        if (r.unava) nabidniPresUnavu(r.lzePresUnavu); else Dialog.info(r.duvod);
        return;
      }
      presCelkem += r.pres || 0;
      if (r.zastav) kroky.length = 0;
      if (!kroky.length) { zastavChuzi(); souhrnUnavy(); st.vyber = null; }
      else { st.vyber = cil; spocitejCestu(); }
      uloz();
      prekresliVse();
    };
    chuze = setInterval(tik, 120);
    tik();
  }
  function zastavChuzi() { if (chuze) { clearInterval(chuze); chuze = null; } }

  // síly došly uprostřed cesty: výchozí je odpočinout (jít spát, cíl zůstane na zítra),
  // dál jde přes únavu (dokud to denní limit dovolí), nebo jen zastavit a ještě něco udělat na místě
  function nabidniPresUnavu(lzePres) {
    const h = st.hra, c = st.cesta, zbyva = HRA.NAVIC_MAX - (h.navic || 0);
    const chybi = c ? Math.max(0, c.ab - h.ab) : 0;
    const lze = Math.min(chybi, zbyva);
    $('udalostNadpis').textContent = '😓 Síly došly';
    $('udalostText').innerHTML = `<p>Do cíle zbývá ještě <b>${c ? c.ab : '?'} AB</b>, dnes máte ${h.ab} AB.</p>
      <p>Nejlepší je <b>odpočinout</b> – cíl zůstane vybraný a ráno se pokračuje (klik na „Jít sem“ nebo na cíl).</p>
      ${lzePres ? `<p class="tip">Nebo jít dál přes únavu: každý AB navíc stojí všechny ve výpravě ${HRA.NAVIC_ZDRAVI} ❤️ (dnes ještě nejvýš ${zbyva} AB).
        ${chybi > zbyva ? `Až do cíle to dnes nevyjde – dojdete o ${lze} AB dál.` : `Do cíle to vyjde na ${chybi} AB navíc = −${chybi * HRA.NAVIC_ZDRAVI} ❤️ každému.`}</p>`
        : '<p class="tip">Přes únavu už dnes dál nejde – limit je vyčerpaný.</p>'}`;
    const t = $('udalostTlacitka');
    t.innerHTML = '<button class="btn" id="btnOdpocinout">🌙 Odpočinout (zítra dál)</button>'
      + (lzePres ? '<button class="btn sede" id="btnPresUnavu">🥾 Jít dál přes únavu</button>' : '')
      + '<button class="btn sede" id="btnZastavit">⛺ Jen zastavit (ještě tu něco udělám)</button>';
    $('btnOdpocinout').onclick = () => { $('udalost').hidden = true; ukonciDen(); };
    if (lzePres) $('btnPresUnavu').onclick = () => { $('udalost').hidden = true; jdi(true); };
    $('btnZastavit').onclick = () => { $('udalost').hidden = true; };
    $('udalost').hidden = false;
    $('btnOdpocinout').focus();
  }

  function krokKlavesou(dx, dy, presUnavu) {
    if (!st.hra || st.hra.konec || !$('noc').hidden) return;
    zastavChuzi();
    const x = st.hra.hrac.x + dx, y = st.hra.hrac.y + dy;
    const r = udelejKrok(x, y, presUnavu);
    if (!r.ok) {
      if (r.unava && r.lzePresUnavu) Dialog.info(r.duvod + ' (Shift+šipka = krok přes únavu)');
      else if (r.unava || CHODIT[st.hra.svet.teren[y * W + x]]) Dialog.info(r.duvod);
      return;
    }
    if (r.pres) Dialog.info(`🥾 Přes únavu: výprava −${r.pres * HRA.NAVIC_ZDRAVI} ❤️.`);
    st.vyber = null; st.cesta = null;
    uloz();
    prekresliVse();
  }

  async function provedAkci(id) {
    if (!st.hra || st.hra.konec) return;
    zastavChuzi();
    if (id === 'odplout') { nabidniOdplout(); return; }
    const r = HRA.proved(st.hra, id);
    if (!r.ok) { Dialog.info(r.duvod); return; }
    if (id.startsWith('podzemi')) ukazPodzemi(r.text, id);
    else Dialog.info(r.text);
    if (r.napady && r.napady.length) {
      // dialog podzemí nepřepisovat – objev jen oznámit (podrobnosti jsou v panelu Objevy)
      if (id.startsWith('podzemi')) r.napady.forEach(o => Dialog.info(`💡 Objev: ${o.ikona} ${o.nazev}`));
      else ukazObjevy(r.napady);
    }
    uloz();
    if (st.vyber) spocitejCestu();
    prekresliVse();
  }

  function stavej(typ) {
    if (!st.hra || st.hra.konec) return;
    zastavChuzi();
    const r = HRA.stav(st.hra, typ);
    if (!r.ok) { Dialog.info(r.duvod); return; }
    Dialog.info(T.stavby.STAVBY[typ].ikona + ' ' + r.text);
    for (const l of r.objevy || []) Dialog.info('⭐ Objeveno: ' + LOKACE_INFO[l.typ].nazev);
    if (r.napady && r.napady.length) ukazObjevy(r.napady);
    uloz();
    if (st.vyber) spocitejCestu();
    prekresliVse();
  }

  // --- noc a konec ----------------------------------------------------------------------
  async function ukonciDen() {
    const h = st.hra;
    if (!h || h.konec || !$('noc').hidden) return;
    zastavChuzi();
    if (h.ab >= 4 && !(await Dialog.potvrd(`Zbývá ti ještě ${h.ab} AB. Opravdu jít spát? (Nevyužité síly se promění v odpočinek.)`))) return;
    const r = HRA.konecDne(h);
    uloz();
    if (!r) return;
    if (!r.konec && rekord) rekord.zapis(h.den - 1);
    const radky = [];
    const vyr = Object.entries(r.vyrobeno || {}).filter(([, v]) => v > 0);
    if (vyr.length) radky.push('🔨 Práce v táboře: ' + vyr.map(([k, v]) => `+${v} ${IKONY[k]}`).join(' '));
    radky.push(`🍖 Snědeno ${r.snedeno} · 💧 vypito ${r.vypito}`);
    radky.push('<ul class="noc-lide">' + r.lidi.map(l => {
      const o = h.lide.find(x => x.id === l.id) || { vzhled: null };
      const img = o.vzhled ? `<img class="portret mini" src="${G.portretURL(o.vzhled)}" alt="">` : '💀';
      const zn = [l.chybiJ ? '🍖✗' : '', l.chybiV ? '💧✗' : '', l.ukryt === 'chatrc' ? '🛖' : l.ukryt === 'pristresek' ? '⛺' : ''].filter(Boolean).join(' ');
      const trida = l.mrtvy ? 'spatne' : l.po < l.pred ? 'spatne' : 'dobre';
      return `<li>${img}<span class="nl-jm">${esc(l.jmeno)}</span><span class="tip">${zn}</span>
        <b class="${trida}">${l.mrtvy ? '💀' : `${l.pred} → ${l.po} ❤️`}</b></li>`;
    }).join('') + '</ul>');
    for (const m of r.mrtvi || []) {
      const z = h.mrtvi.slice().reverse().find(x => x.jmeno === m) || {};
      radky.push(`<b class="spatne">💀 ${z.hrac ? 'Už ses ráno neprobudil' : `${esc(m)} už se ráno neprobudil${z.rod === 'z' ? 'a' : ''}`} (${esc(z.pricina || '')}).</b>`);
    }
    if (r.zpravy.length) radky.push(...r.zpravy.map(t => `<span class="tip">${esc(t)}</span>`));
    if (!r.konec && r.abZitra < P.AB_VEDOUCI + P.AB_CLEN * (P.vyprava(h).length - 1))
      radky.push(`<b class="spatne">Výprava je zesláblá – zítra jen ${r.abZitra} AB.</b>`);
    const z = h.zasoby;
    if (!r.konec) radky.push(`<span class="tip">Zbývá: ${z.jidlo} 🍖 · ${z.voda}/${HRA.kapacitaVody(h)} 💧 · na noc potřeba ${h.lide.length} 🍖 a ${2 * h.lide.length} 💧</span>`);
    $('nocNadpis').textContent = `🌙 Noc ${r.den}`;
    if (r.pocasi) radky.push(`<span class="tip">Ráno: ${r.pocasi.ikona} ${esc(r.pocasi.nazev)}, ${r.pocasi.teplota} °C${r.pocasi.postih ? ` – výprava −${r.pocasi.postih} AB` : ''}.</span>`);
    $('nocText').innerHTML = radky.map(t => `<p>${t}</p>`).join('');
    posledniUdalost = r.udalost || null;
    $('nocDal').textContent = r.konec ? 'Pokračovat…' : `${r.pocasi ? r.pocasi.ikona : '☀️'} Den ${h.den}`;
    $('noc').hidden = false;
    $('nocDal').focus();
    spocitejCestu();                        // rozjetá cesta k cíli zůstává – ráno stačí pokračovat
    prekresliVse();
  }
  const IKONY = { jidlo: '🍖', voda: '💧', drevo: '🪵', kamen: '🪨', vlakna: '🌿', hlina: '🧱', kov: '⚙️', lecivky: '🌱', pochodne: '🔥' };

  // --- nález trosečníků --------------------------------------------------------------------
  let nalezK = -1;
  function ukazNalez(k) {
    const h = st.hra, n = h.nalezy[k];
    if (!n) return;
    nalezK = k;
    const pocet = n.lide.length, bude = h.lide.length + pocet;
    $('nalezPortrety').innerHTML = n.lide.map(o => `<figure><img class="portret" src="${G.portretURL(o.vzhled)}" alt="">
      <figcaption><b>${esc(o.jmeno)}</b><br>${P.PROFESE[o.profese].ikona} ${esc(P.nazevProfese(o))}<br><span class="tip">❤️ ${o.zdravi}</span></figcaption></figure>`).join('');
    $('nalezText').innerHTML = `<p>${esc(P.textNalezu(n))}</p>
      ${n.lide.map(o => `<p class="tip">${P.PROFESE[o.profese].ikona} <b>${esc(P.nazevProfese(o))}</b>: ${esc(P.PROFESE[o.profese].popis)}</p>`).join('')}
      <p class="nalez-bilance">👤 +${pocet} ${pocet === 1 ? 'pracovník' : 'pracovníci'} · 🍖 +${pocet}/den · 💧 +${2 * pocet}/den</p>
      <p class="tip">Teď vás je ${h.lide.length}, pak ${bude}: na noc ${bude} 🍖 a ${2 * bude} 💧. Máš ${h.zasoby.jidlo} 🍖 a ${h.zasoby.voda} 💧.</p>
      ${n.stav === 'odmitnuto' ? `<p class="tip">Čekají na tebe ještě ${Math.max(0, n.dokdy - h.den)} d.</p>` : ''}`;
    $('nalezNadpis').textContent = pocet === 1 ? '👤 Trosečník!' : `👥 ${pocet} trosečníci!`;
    $('nalez').hidden = false;
    $('nalezPrijmout').focus();
  }
  function rozhodniNalez(prijmout) {
    const h = st.hra, k = nalezK;
    $('nalez').hidden = true; nalezK = -1;
    if (k < 0) return;
    const r = prijmout ? HRA.prijmi(h, k) : HRA.odmitni(h, k);
    if (r.ok) Dialog.info(r.text);
    uloz(); prekresliVse();
  }

  let posledniUdalost = null;
  function zavriNoc() {
    $('noc').hidden = true;
    if (st.hra.konec) { ukazKonec(); return; }
    if (posledniUdalost) { ukazUdalost(posledniUdalost); posledniUdalost = null; }
  }
  // --- odplout, nebo zůstat? ------------------------------------------------------------------
  function nabidniOdplout() {
    const h = st.hra, TJ = T.tajemstvi, t = TJ.stav(h), d = TJ.prekazkaOdplout(h), p = TJ.potrebaNaCestu(h);
    $('udalostNadpis').textContent = '⛵ Loď je připravena';
    const zahada = t.dvere ? 'Kamenné dveře v jeskyni jsou otevřené. Schody vedou dolů do tmy – a vy nevíte, co tam je.'
      : t.jeskyne ? 'V jeskyni zůstaly zavřené kamenné dveře. Co je za nimi?'
      : t.symboly.length ? `Obkreslené symboly (${TJ.seznamSymbolu(h)}) pořád nedávají smysl.`
      : 'Kamenná hlava pořád hledí do vnitrozemí.';
    $('udalostText').innerHTML = `<p>Můžete ostrov opustit – teď hned, nebo kdykoli později.</p>
      <p class="tip">Na palubu: ${h.lide.length} ${h.lide.length === 1 ? 'člověk' : 'lidí'}. Na cestu vezmete ${p.jidlo} 🍖 a ${p.voda} 💧.</p>
      <p><i>${esc(zahada)}</i></p>${d ? `<p class="spatne"><b>${esc(d)}</b></p>` : ''}`;
    const tl = $('udalostTlacitka');
    tl.innerHTML = `<button class="btn" id="btnOdplout" ${d ? 'disabled' : ''}>⛵ Odplout domů</button><button class="btn sede" id="btnZustat">🏝️ Zůstat na ostrově</button>`;
    $('btnOdplout').onclick = () => {
      const r = HRA.proved(h, 'odplout');
      $('udalost').hidden = true;
      if (!r.ok) { Dialog.info(r.duvod); return; }
      uloz(); prekresliVse(); ukazKonec();
    };
    $('btnZustat').onclick = () => { $('udalost').hidden = true; Dialog.info('Zůstáváte. Loď počká.'); };
    $('udalost').hidden = false;
    tl.querySelector('button:not([disabled])').focus();
  }

  // --- výsledek prohledání podzemí (dialog) ------------------------------------------------------
  function ukazPodzemi(text, id) {
    const h = st.hra, P_ = T.podzemi.popisHloubky(h);
    $('udalostNadpis').textContent = id === 'podzemi' ? `🕯️ Podzemí – ${P_.nazev} (${P_.uroven}/${P_.celkem})` : '🗿 Srdce ostrova';
    $('udalostText').innerHTML = text.split(/(?= 📜| ✨| ⬇️)/).map(t => `<p>${esc(t.trim())}</p>`).join('');
    const t = $('udalostTlacitka');
    const dalsi = id === 'podzemi' && HRA.akce(h).find(a => a.id === 'podzemi' && !a.duvod);
    t.innerHTML = (dalsi ? '<button class="btn" id="btnHloub">🕯️ Prohledat dál (3 AB + 1 🔥)</button>' : '') + '<button class="btn sede" id="btnVen">⬆️ Zpět na světlo</button>';
    if (dalsi) $('btnHloub').onclick = () => provedAkci('podzemi');
    $('btnVen').onclick = () => { $('udalost').hidden = true; };
    $('udalost').hidden = false;
    t.querySelector('button').focus();
  }

  // --- objev (dialog) ---------------------------------------------------------------------
  function ukazObjevy(nove) {
    $('udalostNadpis').textContent = nove.length === 1 ? `💡 Objev: ${nove[0].nazev}` : `💡 Objevy (${nove.length})`;
    $('udalostText').innerHTML = nove.map(o => `<p><span class="objev-ikona">${o.ikona}</span> ${esc(o.text)}</p>
      <p class="tip">Odemyká: ${o.odemyka.map(esc).join(' · ')}</p>`).join('');
    const t = $('udalostTlacitka');
    t.innerHTML = '<button class="btn">💡 Skvělé!</button>';
    t.querySelector('button').onclick = () => { $('udalost').hidden = true; };
    $('udalost').hidden = false;
    t.querySelector('button').focus();
  }
  // --- ranní událost -------------------------------------------------------------------------
  function ukazUdalost(u) {
    $('udalostNadpis').textContent = `${u.ikona} ${u.nazev}`;
    $('udalostText').innerHTML = `<p>${esc(u.text)}</p>` + (u.vysledek ? `<p><b>${esc(u.vysledek)}</b></p>` : '');
    const t = $('udalostTlacitka');
    t.innerHTML = u.volby
      ? u.volby.map((v, k) => `<button class="btn${k ? ' sede' : ''}" data-volba="${v.id}">${esc(v.text)}</button>`).join('')
      : '<button class="btn" data-volba="">👍 Dobře</button>';
    t.querySelectorAll('button').forEach(b => b.onclick = () => {
      if (!b.dataset.volba) { $('udalost').hidden = true; return; }
      const r = HRA.rozhodni(st.hra, b.dataset.volba);
      uloz(); prekresliVse();
      if (st.hra.konec) { $('udalost').hidden = true; ukazKonec(); return; }
      if (r.ok) { $('udalostText').innerHTML += `<p class="vysledek"><b>${esc(r.text)}</b></p>`; t.innerHTML = '<button class="btn" data-volba="">👍 Dobře</button>';
        t.querySelector('button').onclick = () => { $('udalost').hidden = true; }; t.querySelector('button').focus(); }
    });
    $('udalost').hidden = false;
    t.querySelector('button').focus();
  }
  function ukazKonec() {
    const h = st.hra, k = h.konec;
    if (k.typ === 'odplul' || k.typ === 'zachranen') { ukazEpilog(); return; }
    const sam = h.mrtvi.length <= 1;
    $('konecText').innerHTML = `
      <p>${sam ? `${k.duvod === 'žízeň' ? 'Žízeň' : 'Hlad'} tě přemohl${k.duvod === 'žízeň' ? 'a' : ''}` : 'Na ostrově nezůstal nikdo živý'} ${k.den}. den na ostrově <i>${esc(h.svet.nazev)}</i>.</p>
      ${sam ? '' : `<p class="tip">Pohřbení: ${h.mrtvi.map(m => `${esc(m.jmeno)} (${esc(m.profese)}, ${m.den}. den – ${esc(m.pricina)})`).join(', ')}.</p>`}
      <ul>
        <li>👥 Nejvíc lidí v táboře: ${h.stat.maxLidi || 1}</li>
        <li>📅 Přežito dní: <b>${k.den - 1}</b></li>
        <li>🔨 Staveb: ${h.stat.postaveno || h.stavby.length} · 💡 objevů: ${(h.objevy || []).length}/${T.objevy.PORADI.length}</li>
        <li>🚶 Kroků: ${h.stat.kroky}</li>
        <li>🎣 Úlovků: ${h.stat.ulovky}</li>
        <li>⭐ Objevená místa: ${h.objevene.length}/${h.svet.lokace.length}</li>
      </ul>`;
    $('konec').hidden = false;
  }

  function ukazEpilog() {
    const h = st.hra, k = h.konec, t = T.tajemstvi.stav(h);
    if (rekordPlavba) rekordPlavba.zapis(k.den);
    if (rekordLide) rekordLide.zapis(k.lidi);
    $('konecNadpis').textContent = '⛵ Záchrana!';
    const mrtvi = h.mrtvi.filter(m => !m.hrac);
    const pz = h.podzemi || {};
    const zahada = pz.konec === 'soska' ? 'V podpalubí se veze zlatá soška ze srdce ostrova. Když ostrov mizel za obzorem, nad sopkou stoupal tenký sloupec kouře…'
      : pz.konec === 'nechano' ? 'Zlatá soška zůstala na oltáři v srdci ostrova. Tajemství dávných lidí jste poznali – a nechali ho tam, kam patří.'
      : t.dvere ? 'Za zády vám zůstaly otevřené kamenné dveře a schody do tmy. Co je pod ostrovem, už se nedozvíte. Nebo se jednou vrátíte?'
      : t.symboly.length >= 3 ? 'Obkreslené symboly si vezete s sebou. Dveře v jeskyni zůstaly zavřené.'
      : 'Kamenná hlava hledí za vámi. Její tajemství zůstalo nevyřešené.';
    $('konecText').innerHTML = `
      <p>${k.typ === 'zachranen'
        ? `${k.den}. den na ostrově <i>${esc(h.svet.nazev)}</i> si kouře ze signální hranice všimla obchodní loď. Kapitán vás vzal na palubu.`
        : `${k.den}. den na ostrově <i>${esc(h.svet.nazev)}</i> jste zvedli kotvu. Po třech dnech plavby vás zahlédla obchodní loď.`}</p>
      <p>Na palubě: <b>${k.jmena.map(esc).join(', ')}</b>.</p>
      ${mrtvi.length ? `<p class="tip">Na ostrově zůstaly hroby: ${mrtvi.map(m => esc(m.jmeno)).join(', ')}.</p>` : ''}
      <p><i>${esc(zahada)}</i></p>
      <ul>
        <li>📅 Dní na ostrově: <b>${k.den}</b></li>
        <li>👥 Zachráněno: <b>${k.lidi}</b> (nejvíc v táboře ${h.stat.maxLidi || 1})</li>
        <li>💡 Objevy: ${(h.objevy || []).length}/${T.objevy.PORADI.length} · 🗿 symboly: ${T.tajemstvi.seznamSymbolu(h) || '–'}</li>
        ${pz.pribeh && pz.pribeh.length ? `<li>🕯️ Podzemí: ${pz.pribeh.length}/${T.podzemi.UROVNE.length} úrovní · artefakty ${(pz.nalezeno || []).map(a => T.podzemi.ARTEFAKTY[a].ikona).join(' ') || '–'}</li>` : ''}
        <li>⭐ Objevená místa: ${h.objevene.length}/${h.svet.lokace.length} · 🔨 staveb: ${h.stat.postaveno || h.stavby.length} · 🚶 kroků: ${h.stat.kroky}</li>
      </ul>`;
    $('konec').hidden = false;
  }

  // --- panel ------------------------------------------------------------------------------
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
  const abText = v => v === 0.5 ? '½' : String(v);
  function popisCesty(h, i) {
    const d = HRA.druhCesty(h, i), n = HRA.slapano(h, i);
    if (d === 'stezka') return ` · 🟨 stezka <span class="tip">(prošlapáno ${n}×)</span>`;
    if (d === 'pesina') return ` · 🟫 pěšina <span class="tip">(prošlapáno ${n}×, stezkou bude po ${HRA.STEZKA}×)</span>`;
    return n ? ` <span class="tip">· prošlapáno ${n}× (pěšina po ${HRA.PESINA}×)</span>` : '';
  }
  function sklon(n, a, b, c) { return n === 1 ? a : n >= 2 && n <= 4 ? b : c; }

  function prekresliVse() {
    ukazStav(); ukazRadu(); ukazInfo(); ukazAkce(); ukazLidi(); ukazStavby(); ukazPredmety(); ukazLod(); ukazTajemstvi(); ukazObjevyPanel(); ukazDenik(); vypisObjevene();
    ukazOdznaky();
    const h = st.hra;
    $('spatAB').textContent = h.konec ? '' : h.ab ? `(zbývá ${h.ab} AB)` : '';
    spinave = true;
  }
  function ukazStav() {
    const h = st.hra, z = h.zasoby;
    $('den').textContent = h.den;
    $('ab').textContent = `${h.ab}/${h.abMax}`;
    $('abPruh').style.width = (100 * h.ab / HRA.AB_DEN) + '%';
    const v = P.vedouci(h);
    $('zdravi').textContent = v ? v.zdravi : 0;
    $('zdraviChip').title = v ? `Zdraví: ${v.jmeno === 'Ty' ? 'ty' : v.jmeno} (vede výpravu)` : 'Zdraví';
    $('zdraviChip').classList.toggle('varovani', !!v && v.zdravi < 40);
    $('lidi').textContent = h.lide.length;
    const PO = T.pocasi, dnes = PO.TYPY[PO.dnes(h)], pp = PO.predpoved(h);
    $('pocasi').innerHTML = `${dnes.ikona} ${h.pocasi.teploty[h.den]}°<small>${pp.map(p => p.ikona).join('')}</small>`;
    $('pocasiChip').title = `Dnes: ${dnes.nazev}, ${h.pocasi.teploty[h.den]} °C\n` + pp.map((p, k) => `${k ? 'Pozítří' : 'Zítra'}: ${p.nazev}, ${p.teplota} °C`).join('\n');
    const varovani = h.konec ? [] : T.rady.varovani(h);
    const zaB = PO.bourePredpoved(h);
    const vv = (text, tip) => varovani.push({ text, tip });
    if (zaB === 0) vv('⛈️ Bouře! Výprava −4 AB', 'Kdo v noci nebude pod střechou, ztratí 10 ❤️. Nádoby se naplní, stavby se můžou poškodit.');
    else if (zaB > 0) vv(`⛈️ Bouře ${zaB === 1 ? 'zítra' : 'za 2 dny'}!`, 'Doplňte zásoby a postavte střechy (chatrč vydrží nejvíc).');
    if (PO.dnes(h) === 'vedro') vv('🔥 Vedro: každý vypije 3 💧', 'Dnes v noci potřebuje každý o dávku vody víc.');
    if (T.udalosti.efekt(h, 'zraloci')) vv('🦈 Žraloci – rybaření za polovinu', 'Rybaření a molo vynesou polovinu, dokud žraloci neodplují.');
    if (T.udalosti.efekt(h, 'hejno')) vv('🐟 Hejno ryb – úlovky +50 %', 'Využij to – rybař!');
    const poskozene = h.stavby.filter(b => b.poskozeno).length;
    if (poskozene) vv(`🔧 Poškozené stavby: ${poskozene}`, 'Nefungují, dokud je neopravíš (postav se na ně – akce Opravit).');
    $('varovani').innerHTML = varovani.map(v => `<p title="${esc(v.tip || '')}">${esc(v.text)}${v.tip ? ' <span class="tip-ikona">ⓘ</span>' : ''}</p>`).join('');
    $('varovani').hidden = !varovani.length;
    $('lidiChip').title = `Lidé: ${h.lide.length} (výprava ${P.vyprava(h).length}) · za noc snědí ${h.lide.length} 🍖 a vypijí ${2 * h.lide.length} 💧`;
    const odhad = T.postavy.odhadNoci(h);                 // počítá s noční prací tábora
    // trend na nejbližší noc u každé zásoby (▲ přibude, ▼ ubude) + rozpis v bublině
    const bil = h.konec ? null : T.postavy.bilanceNoci(h);
    for (const r of HRA.SUROVINY) {
      const el = $('trend_' + r.id); if (!el) continue;
      const b = bil && bil[r.id];
      el.textContent = !b || !b.zmena ? '' : (b.zmena > 0 ? `▲${b.zmena}` : `▼${-b.zmena}`);
      el.className = 'trend' + (b && b.zmena > 0 ? ' nahoru' : b && b.zmena < 0 ? ' dolu' : '');
      if (b) {
        const casti = [];
        if (b.prace) casti.push(`+${b.prace} práce v táboře`);
        if (b.pritok) casti.push(`+${b.pritok} sběrače, déšť, nosiči`);
        if (b.spotreba) casti.push(`−${b.spotreba} ${r.id === 'voda' ? 'vypijete' : 'sníte'}`);
        if (b.nazmar) casti.push(`−${b.nazmar} se nevejde do zásob`);
        el.parentNode.title = `${r.nazev}: ${b.ted} z ${HRA.kapacita(h, r.id)}` + (casti.length ? `\nZa noc: ${casti.join(', ')} → ráno ${b.potom}` : '\nZa noc beze změny');
      }
    }
    $('jidloChip').classList.toggle('varovani', odhad.jidlo < odhad.potrebaJ);
    $('vodaChip').classList.toggle('varovani', odhad.voda < odhad.potrebaV);
    $('jidlo').textContent = `${z.jidlo}/${HRA.kapacita(h, 'jidlo')}`;
    $('voda').textContent = `${z.voda}/${HRA.kapacitaVody(h)}`;

    for (const r of HRA.SUROVINY.filter(r => r.objev)) {       // nové suroviny až po objevu
      $(r.id).parentNode.hidden = !(z[r.id] > 0 || T.objevy.ma(h, r.objev));
    }
    for (const k of ['drevo', 'kamen', 'vlakna', 'hlina', 'kov', 'lecivky', 'pochodne']) {
      $(k).textContent = z[k] || 0;
      $(k).parentNode.classList.toggle('plno', z[k] >= HRA.kapacita(h, k));
    }
  }
  function ukazInfo() {
    const h = st.hra, p = st.vyber || h.hrac, el = $('info');
    const i = p.y * W + p.x;
    if (!znamo(p.x, p.y)) {
      el.innerHTML = `<h2>❔ Neprozkoumáno</h2><p class="popis">Sem ještě nikdo nedohlédl. Musíš blíž.</p>`;
      return;
    }
    const t = h.svet.teren[i], o = h.svet.obj[i], li = h.svet.lokNa[i];
    const tady = p.x === h.hrac.x && p.y === h.hrac.y;
    // stojíš-li na poli, akce jdou nahoru a popis pole se zhustí na řádek (celý popis v rozbalovátku)
    document.querySelector('.zalozka[data-tab="tady"]').classList.toggle('tady-stojim', tady);
    let s = '';
    if ((h.bedny || []).some(bd => bd.i === i)) s += '<h2>📦 Vyplavená bedna</h2><p class="popis">Kdo ví, co v ní je. Otevřít ji stojí 1 AB.</p>';
    const nk = h.nalezy.findIndex(n => n.x === p.x && n.y === p.y && (n.stav === 'skryto' || n.stav === 'odmitnuto'));
    if (nk >= 0) {
      const n = h.nalezy[nk], u = P.nalezUVypravy(h) === nk;
      s += `<h2>${n.lide.length > 1 ? '👥' : '👤'} ${n.lide.map(o => esc(o.jmeno)).join(', ')}</h2><p class="popis">${esc(P.textNalezu(n))}</p>
        ${u ? '<button class="btn" id="btnMluvit">🗣️ Promluvit</button>' : '<p class="tip">Dojdi k nim a promluv si.</p>'}`;
    }
    const b = T.stavby.stavbaNa(h, i);
    if (b) {
      const B = T.stavby.STAVBY[b.typ];
      let stav = '';
      if (b.typ === 'policko') stav = b.zraje > h.den ? ` Sklizeň za ${b.zraje - h.den} d.` : ' <b class="dobre">Zralé – sklízej!</b>';
      if (b.typ === 'signal') stav = (b.hori || 0) >= h.den ? ` <b class="dobre">Hoří do ${b.hori}. dne.</b>` : ' <b>Nehoří.</b>';
      if (b.poskozeno) stav += ` <b class="spatne">Poškozeno bouří – nefunguje. Oprava: ${T.stavby.popisCeny(T.stavby.cenaOpravy(b.typ))}, 2 AB.</b>`;
      if (tady) s += `<p class="kratce"><b>${B.ikona} ${esc(B.nazev)}</b>${stav}</p>`;
      else s += `<h2>${B.ikona} ${esc(B.nazev)}</h2><p class="popis">${esc(B.popis)}${stav}</p>`;
    }
    const L = li >= 0 ? LOKACE_INFO[h.svet.lokace[li].typ] : null;
    const obnova = o ? (h.vycerpano[i] || 0) - h.den : 0;
    if (tady) {
      const casti = [L ? `⭐ ${esc(L.nazev)}` : '', `${esc(TEREN_INFO[t].nazev)}${popisCesty(h, i)} <span class="tip">(krok ${abText(HRA.cenaPole(h, i))} AB)</span>`,
        o ? esc(OBJ_INFO[o].nazev) + (obnova > 0 ? ` <span class="tip">(obnoví se za ${obnova} d.)</span>` : '') : ''].filter(Boolean);
      s += `<p class="kratce">📍 ${casti.join(' · ')}</p>
        <details class="popis-pole"><summary class="tip">Popis místa</summary>
          ${b ? `<p class="popis">${esc(T.stavby.STAVBY[b.typ].popis)}</p>` : ''}${L ? `<p class="popis">${esc(L.popis)}</p>` : ''}
          <p class="popis">${esc(TEREN_INFO[t].popis)}</p>${o ? `<p class="popis">${esc(OBJ_INFO[o].nazev)} – ${esc(OBJ_INFO[o].popis)}</p>` : ''}
        </details>`;
    } else {
      if (L) s += `<h2>⭐ ${esc(L.nazev)}</h2><p class="popis">${esc(L.popis)}</p>`;
      s += `<h3>${esc(TEREN_INFO[t].nazev)}${CHODIT[t] ? `${popisCesty(h, i)} <span class="tip">· krok ${abText(HRA.cenaPole(h, i))} AB</span>` : ''}</h3><p class="popis">${esc(TEREN_INFO[t].popis)}</p>`;
      if (t === T.svet.TEREN.LAVA && !T.tajemstvi.ma(h, 'ohen')) s += '<p><b>🔥 Na černém okraji kráteru je něco vyryté.</b> Dojdi na sopku co nejblíž (do 2 polí od lávy) a zvol „Prohlédnout okraj kráteru".</p>';
      if (o) s += `<p><b>${esc(OBJ_INFO[o].nazev)}</b> – ${esc(OBJ_INFO[o].popis)}${obnova > 0 ? ` <span class="tip">(vyčerpáno, obnoví se za ${obnova} d.)</span>` : ''}</p>`;
    }
    if (!tady) {
      const c = st.cesta;
      if (c) {
        const staci = c.ab <= h.ab;
        const navic = HRA.NAVIC_MAX - (h.navic || 0), chybi = c.ab - h.ab;
        s += `<p>🚶 Cesta: <b>${c.ab} AB</b> (${c.kroky.length} ${sklon(c.kroky.length, 'pole', 'pole', 'polí')})${staci ? '' : ` – <span class="spatne">dnes dojdeš jen kus</span>`}</p>
          <button class="btn" id="btnJdi">🚶 Jít sem</button> <span class="tip">nebo klikni na pole znovu</span>
          ${!staci && chybi <= navic ? `<br><button class="odkaz" id="btnJdiPres">🥾 dojít dnes přes únavu (−${chybi * HRA.NAVIC_ZDRAVI} ❤️ každému ve výpravě)</button>` : ''}`;
      } else if (!CHODIT[t]) s += `<p class="tip">Sem se pěšky nedostaneš.</p>`;
      else s += `<p class="tip">Po známých polích sem cesta nevede.</p>`;
      s += `<p><button class="odkaz" id="btnZpet">↩ zpět na místo, kde stojíš</button></p>`;
    }
    el.innerHTML = s;
    const bj = $('btnJdi'); if (bj) bj.onclick = () => jdi();
    const bp = $('btnJdiPres'); if (bp) bp.onclick = () => jdi(true);
    const bm = $('btnMluvit'); if (bm) bm.onclick = () => ukazNalez(nk);
    const bz = $('btnZpet'); if (bz) bz.onclick = () => { st.vyber = null; st.cesta = null; ukazInfo(); spinave = true; };
  }
  function ukazAkce() {
    const h = st.hra, el = $('akce');
    const a = HRA.akce(h);
    el.innerHTML = a.length ? a.map((k, n) => `
      <button class="akce${k.duvod ? ' nelze' : ''}" data-id="${k.id}" ${k.duvod ? 'aria-disabled="true"' : ''} title="${esc(k.duvod || '')}">
        <span class="ak-ikona">${k.ikona}</span><span class="ak-nazev">${esc(k.nazev)}${k.duvod ? `<small>${esc(k.duvod)}</small>` : ''}</span>
        <span class="ak-cena">${k.ab} AB${n < 9 ? `<kbd>${n + 1}</kbd>` : ''}</span>
      </button>`).join('') : `<p class="tip">${h.konec ? 'Hra skončila.' : 'Tady se nedá nic dělat. Přesuň se k palmě, keři, řece nebo moři.'}</p>`;
    el.querySelectorAll('button.akce').forEach(b => b.onclick = () => provedAkci(b.dataset.id));
    $('btnSpat').disabled = !!h.konec;
  }
  function ukazRadu() {
    const h = st.hra, el = $('rada'), r = radyZapnute() && !h.konec ? T.rady.aktualni(h) : null;
    el.hidden = !r;
    if (!r) return;
    el.innerHTML = `<div class="rada-hlava" title="Kliknutím sbalíš / rozbalíš"><b>🧭 Co dál?</b> <span class="tip rada-cislo">${r.poradi}/${r.celkem}</span>
      <button class="rada-zavrit" title="Vypnout rady pro začátečníky" aria-label="Vypnout rady">✕</button></div>
      <p class="rada-cil">${r.ikona} ${esc(r.cil)} <span class="rada-jak">jak?</span></p><p class="tip">${esc(r.rada)}</p>`;
    el.querySelector('.rada-zavrit').onclick = e => { e.stopPropagation(); uloziste.pis(KLIC_RADY, '0'); $('radyZap').checked = false; prekresliVse(); Dialog.info('Rady vypnuty – zapnout je můžeš v menu ☰.'); };
    const rozbalena = uloziste.cti(KLIC_RADA_SBALENA + '_otevrena') === r.id || (r.poradi <= 3 && uloziste.cti(KLIC_RADA_SBALENA) !== r.id);
    el.classList.toggle('sbalena', !rozbalena);
    el.querySelector('.rada-cil').onclick = () => el.querySelector('.rada-hlava').click();
    el.querySelector('.rada-hlava').onclick = () => {           // sbalit/rozbalit radu
      const sb = !el.classList.contains('sbalena');
      uloziste.pis(KLIC_RADA_SBALENA, sb ? r.id : '');
      uloziste.pis(KLIC_RADA_SBALENA + '_otevrena', sb ? '' : r.id);
      el.classList.toggle('sbalena', sb);
    };
  }
  function ukazLidi() {
    const h = st.hra, el = $('lide');
    $('pocetLidi').textContent = `${h.lide.length} · za noc ${h.lide.length} 🍖 ${2 * h.lide.length} 💧`;
    const doma = P.vypravaDoma(h);
    $('lideTip').textContent = doma ? '' : 'Výprava je mimo tábor – lidi do výpravy a z ní můžeš přeřadit, až budete doma.';
    el.innerHTML = h.lide.map((o, k) => {
      const moz = P.moznostiRole(h, o);
      const P_ = P.PROFESE[o.profese];
      return `<li class="clovek${o.role === 'vyprava' ? ' ve-vyprave' : ''}">
        <img class="portret" src="${G.portretURL(o.vzhled)}" alt="" title="${esc(P_.popis)}">
        <div class="cl-telo">
          <div class="cl-jm"><b>${esc(o.hrac ? 'Ty' : o.jmeno)}</b>${T.udalosti.nemocny(h, o.id) ? ' <span title="Horečka: −6 ❤️ za noc, lékař vyléčí">🤒</span>' : ''} <span class="tip" title="${esc(P_.popis)}">${P_.ikona} ${esc(P.nazevProfese(o))}</span></div>
          <div class="pruh" title="Zdraví ${o.zdravi}"><i style="width:${o.zdravi}%;background:${o.zdravi < 30 ? 'var(--danger)' : o.zdravi < 60 ? 'var(--warn)' : 'var(--ok)'}"></i></div>
          ${o.puvodniRole && P.PRACE[o.puvodniRole] ? `<small class="navrat" title="Až se uzdraví, vrátí se k této práci">↩ po uzdravení: ${P.PRACE[o.puvodniRole].ikona} ${esc(P.PRACE[o.puvodniRole].nazev)}</small>` : ''}
          <select data-id="${o.id}" aria-label="Práce: ${esc(o.jmeno)}">
            ${moz.map(m => `<option value="${m.role}" ${m.role === o.role ? 'selected' : ''} ${m.duvod && m.role !== o.role ? 'disabled' : ''} title="${esc(m.duvod || m.popis)}">${m.ikona} ${esc(m.nazev)}${m.duvod && m.role !== o.role ? ' ✗' : ''}</option>`).join('')}
          </select>
        </div>
        <span class="cl-zdravi">❤️ ${o.zdravi}</span>
      </li>`;
    }).join('');
    el.querySelectorAll('select').forEach(sel => sel.onchange = () => {
      const r = HRA.nastavRoli(h, +sel.dataset.id, sel.value);
      if (!r.ok) Dialog.info(r.duvod);
      uloz(); prekresliVse();
    });
  }
  function ukazStavby() {
    const h = st.hra, el = $('stavby');
    const naLokaci = h.svet.lokNa[h.hrac.y * W + h.hrac.x] >= 0;
    let m = naLokaci ? [] : T.stavby.moznosti(h);
    const tabor = T.stavby.ohniste(h);
    $('taborInfo').textContent = !tabor ? '' : T.stavby.vTabore(h, h.hrac.x, h.hrac.y) ? '· jsi v táboře' : '· mimo tábor';
    // v hlavním seznamu jen to, co tady jde postavit (případně po dosbírání surovin); zbytek sbalený
    const jdeTady = k => !k.duvod || /^(Ještě chybí|Potřeba \d+ AB)/.test(k.duvod);
    const jine = m.filter(k => !jdeTady(k));
    const tlacitko = k => `
      <button class="akce stavba${k.duvod ? ' nelze' : ''}" data-typ="${k.typ}" ${k.duvod ? 'aria-disabled="true"' : ''} title="${esc(k.popis)}">
        <span class="ak-ikona">${k.ikona}</span><span class="ak-nazev">${esc(k.nazev)}<small class="cena">${esc(k.cena)}</small>${k.duvod ? `<small class="duvod">${esc(k.duvod)}</small>` : ''}</span>
        <span class="ak-cena">${k.ab} AB</span>
      </button>`;
    $('stavbyJine').innerHTML = jine.map(tlacitko).join('');
    $('stavbyNedostupne').hidden = !jine.length;
    $('stavbyNedostupneSouhrn').textContent = `Jinde nebo později (${jine.length})`;
    $('stavbyJine').querySelectorAll('button.stavba').forEach(b => b.onclick = () => stavej(b.dataset.typ));
    m = m.filter(jdeTady);
    el.innerHTML = m.map(k => `
      <button class="akce stavba${k.duvod ? ' nelze' : ''}" data-typ="${k.typ}" ${k.duvod ? 'aria-disabled="true"' : ''} title="${esc(k.popis)}">
        <span class="ak-ikona">${k.ikona}</span><span class="ak-nazev">${esc(k.nazev)}<small class="cena">${esc(k.cena)}</small>${k.duvod ? `<small class="duvod">${esc(k.duvod)}</small>` : ''}</span>
        <span class="ak-cena">${k.ab} AB</span>
      </button>`).join('') || `<p class="tip">${h.konec ? 'Hra skončila.' : naLokaci ? 'Na tomhle místě se nestaví – nech ho, jak je.' : 'Tady se nedá nic stavět.'}</p>`;
    el.querySelectorAll('button.stavba').forEach(b => b.onclick = () => stavej(b.dataset.typ));
  }
  function ukazLod() {
    const h = st.hra, TJ = T.tajemstvi, l = h.lod, el = $('lodPanel');
    el.hidden = !l;
    if (!l) return;
    const pct = Math.round(TJ.postup(h) * 100);
    $('lodPostup').textContent = TJ.hotova(h) ? '· hotová!' : `· ${pct} %`;
    $('lodDily').innerHTML = TJ.DILY.map((d, k) => {
      const hotovo = k < l.dil, ted = k === l.dil;
      const info = hotovo ? '✅' : ted ? (l.zaplaceno ? `🔨 ${l.prace}/${d.prace} práce` : `📦 ${T.stavby.popisCeny(TJ.cenaDilu(h, d))}`) : `<span class="tip">${T.stavby.popisCeny(TJ.cenaDilu(h, d))}</span>`;
      return `<li class="${hotovo ? 'hotovo' : ted ? 'ted' : ''}"><span>${esc(d.nazev)}</span><span>${info}</span></li>`;
    }).join('');
    $('lodTip').textContent = TJ.hotova(h)
      ? `Loď čeká. Na cestu potřebujete ${TJ.potrebaNaCestu(h).jidlo} 🍖 a ${TJ.potrebaNaCestu(h).voda} 💧 – odplout můžeš z loděnice.`
      : l.zaplaceno ? 'Pracuj na loděnici nebo přiděl lidem práci „⛵ Stavba lodi".' : 'Postav se na loděnici a připrav materiál na další díl.';
  }
  function ukazTajemstvi() {
    const h = st.hra, TJ = T.tajemstvi, t = TJ.stav(h);
    const bylo = t.hlava || t.ruiny || t.jeskyne || t.symboly.length || h.objevene.some(i => ['hlava', 'ruiny', 'jeskyne'].includes(h.svet.lokace[i].typ));
    $('tajPanel').hidden = !bylo;
    if (!bylo) return;
    $('tajSymboly').innerHTML = ['slunce', 'spirala', 'voda', 'ohen'].map(k => TJ.ma(h, k)
      ? `<span class="symbol mam" title="${TJ.SYMBOLY[k].nazev}">${TJ.SYMBOLY[k].ikona}</span>` : '<span class="symbol" title="Neznámý symbol">❔</span>').join('');
    const kroky = [];
    if (!t.hlava) kroky.push('🗿 Kamenná hlava něco skrývá.');
    if (!t.ruiny) kroky.push('🏛️ Ruiny čekají na prozkoumání.');
    if (!TJ.ma(h, 'voda')) kroky.push(t.ruiny ? '💧 Symbol vody je za clonou vodopádu – dojdi k vodopádu s pochodní a podívej se za vodu.' : '💧 „Voda, která padá"… (víc napoví ruiny)');
    if (!TJ.ma(h, 'ohen')) kroky.push(t.ruiny ? '🔥 Symbol ohně je na okraji kráteru na vrcholu sopky (rozžhavená láva). Dojdi co nejblíž k lávě (stačí 2 pole) a zvol „Prohlédnout okraj kráteru".' : '🔥 „Oheň, který vychází ze země"… (víc napoví ruiny)');
    if (!t.jeskyne) kroky.push('🕳️ Jeskyně je hluboká – na průzkum 2 pochodně.');
    else if (!t.dvere) kroky.push('🚪 Kamenné dveře se třemi prohlubněmi.');
    else {
      const p = T.podzemi.stav(h), d = T.podzemi.popisHloubky(h);
      if (p.konec) kroky.push(p.konec === 'soska' ? '🗿 Zlatá soška je vaše.' : '🙏 Soška zůstala na oltáři.');
      else if (T.podzemi.naDne(h)) kroky.push('🗿 V srdci ostrova čeká zlatá soška. Vzít, nebo nechat?');
      else kroky.push(`🕯️ Podzemí: ${d.nazev} (${d.uroven}/${d.celkem}) – na poli jeskyně „Prohledat podzemí" (3 AB + 1 🔥).`);
      for (const u of p.pribeh) kroky.push(`📜 ${T.podzemi.UROVNE[u].nazev}: ${T.podzemi.UROVNE[u].pribeh}`);
    }
    $('tajKroky').innerHTML = kroky.map(k => `<li>${esc(k)}</li>`).join('');
  }
  function ukazObjevyPanel() {
    const h = st.hra, O = T.objevy;
    $('pocetObjevu').textContent = `${(h.objevy || []).length}/${O.PORADI.length}`;
    $('objevyList').innerHTML = O.PORADI.map(k => {
      const o = O.OBJEVY[k];
      return O.ma(h, k)
        ? `<li class="znamy"><b>${o.ikona} ${esc(o.nazev)}</b><br><span class="tip">${o.odemyka.map(esc).join(' · ')}</span></li>`
        : `<li class="neznamy">❔ <i>${esc(o.napoveda)}</i></li>`;
    }).join('');
  }
  function ukazPredmety() {
    $('predmety').innerHTML = st.hra.predmety.map(p => {
      const P = HRA.PREDMETY[p];
      return `<span class="predmet" title="${esc(P.nazev + ' – ' + P.popis)}">${P.ikona}<small>${esc(P.nazev)}</small></span>`;
    }).join('');
  }
  function ukazDenik() {
    const d = st.hra.denik;
    $('denik').innerHTML = d.slice(-60).reverse().map(z =>
      `<li class="dz-${z.typ}"><span class="dz-den">${z.den}.</span> ${esc(z.text)}</li>`).join('');
  }
  function vypisObjevene() {
    const h = st.hra, el = $('objevene');
    $('pocetObjevenych').textContent = `${h.objevene.length}/${h.svet.lokace.length}`;
    el.innerHTML = h.objevene.map(i => `<li><button data-l="${i}">${esc(LOKACE_INFO[h.svet.lokace[i].typ].nazev)}</button></li>`).join('')
      || '<li class="tip">Zatím nic. Vydej se na průzkum.</li>';
    el.querySelectorAll('button').forEach(b => b.onclick = () => {
      const l = h.svet.lokace[+b.dataset.l];
      vystred(l.x, l.y); klikNaPole(l.x, l.y);
    });
  }

  // --- menu: nová hra, export, import ---------------------------------------------------------
  async function novaHraDotaz(seed) {
    const h = st.hra;
    if (h && !h.konec && h.den > 1 && !(await Dialog.potvrd(`Rozehraná hra (den ${h.den}) se zahodí. Začít znovu?`))) return false;
    $('konec').hidden = true; $('menu').close();
    novaHra(seed);
    return true;
  }
  function exportuj() {
    const h = st.hra;
    const blob = new Blob([HRA.serializuj(h)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `trosecnici-${h.seed}-den${h.den}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importuj(soubor) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const h = HRA.nacti(r.result);
        $('menu').close(); $('konec').hidden = true;
        nastavHru(h); uloz();
        Dialog.info(`Načteno: ${h.svet.nazev}, den ${h.den}.`);
      } catch (e) { Dialog.chyba('Soubor se nedá načíst: ' + e.message); }
    };
    r.readAsText(soubor);
  }

  // --- ovládání -------------------------------------------------------------------------------
  function napojOvladani() {
    const ukazatele = new Map();
    let tah = null, stipnuti = null;
    cv.addEventListener('pointerdown', e => {
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* syntetická událost */ }
      ukazatele.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (ukazatele.size === 1) tah = { x: e.offsetX, y: e.offsetY, kx: kam.x, ky: kam.y, posunuto: false };
      else if (ukazatele.size === 2) {
        const [a, b] = [...ukazatele.values()];
        stipnuti = { d: Math.hypot(a.x - b.x, a.y - b.y), z: kam.z };
        if (tah) tah.posunuto = true;
      }
    });
    cv.addEventListener('pointermove', e => {
      if (!ukazatele.has(e.pointerId)) return;
      ukazatele.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (ukazatele.size === 2 && stipnuti) {
        const [a, b] = [...ukazatele.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        zoomuj(Math.round(stipnuti.z * d / Math.max(1, stipnuti.d)), (a.x + b.x) / 2 * dpr, (a.y + b.y) / 2 * dpr);
        return;
      }
      if (!tah) return;
      const dx = e.offsetX - tah.x, dy = e.offsetY - tah.y;
      if (!tah.posunuto && Math.hypot(dx, dy) > 6) tah.posunuto = true;
      if (tah.posunuto) { kam.x = tah.kx - dx * dpr / kam.z; kam.y = tah.ky - dy * dpr / kam.z; omezKameru(); }
    });
    const konec = e => {
      if (!ukazatele.has(e.pointerId)) return;
      ukazatele.delete(e.pointerId);
      if (ukazatele.size < 2) stipnuti = null;
      if (ukazatele.size === 0) {
        if (tah && !tah.posunuto && e.type === 'pointerup') { const p = poleZBodu(e.offsetX, e.offsetY); klikNaPole(p.x, p.y); }
        tah = null;
      }
    };
    cv.addEventListener('pointerup', konec);
    cv.addEventListener('pointercancel', konec);
    cv.addEventListener('wheel', e => { e.preventDefault(); zoomuj(kam.z + (e.deltaY < 0 ? 1 : -1), e.offsetX * dpr, e.offsetY * dpr); }, { passive: false });
    mini.addEventListener('click', e => {
      const r = mini.getBoundingClientRect();
      vystred(Math.floor((e.clientX - r.left) / r.width * W), Math.floor((e.clientY - r.top) / r.height * H));
    });

    window.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || $('menu').open || document.querySelector('dialog[open]')) return;
      if (!$('noc').hidden) {
        // souhrn noci odklepne mezerník, Enter i Esc (podržený mezerník ale nepřeskočí další den)
        if ((e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') && !e.repeat) { e.preventDefault(); zavriNoc(); }
        else if (e.key === ' ') e.preventDefault();
        return;
      }
      if (!$('nalez').hidden) { if (e.key === 'Escape') { e.preventDefault(); rozhodniNalez(false); } return; }
      if (!$('udalost').hidden || !$('konec').hidden) return;       // v dialozích mezerník stiskne tlačítko s fokusem
      if (e.key === ' ') {
        // mezerník = Jít spát (i když má fokus naposledy použité tlačítko akce – to se nesmí zopakovat)
        if (e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        if (!e.repeat) ukonciDen();
        return;
      }
      const k = e.key.toLowerCase();
      const smer = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] }[k];
      if (smer) { e.preventDefault(); krokKlavesou(smer[0], smer[1], e.shiftKey); }
      else if (/^[1-9]$/.test(k)) { const a = HRA.akce(st.hra)[+k - 1]; if (a) provedAkci(a.id); }
      else if (k === 'n') ukonciDen();      // N i mezerník
      else if ({ t: 'tady', l: 'lide', b: 'tabor', j: 'denik', v: 'vice' }[k]) prepniZalozku({ t: 'tady', l: 'lide', b: 'tabor', j: 'denik', v: 'vice' }[k]);
      else if (k === '+' || k === '=') zoomuj(kam.z + 1);
      else if (k === '-') zoomuj(kam.z - 1);
      else if (k === 'c') vystred(st.hra.hrac.x, st.hra.hrac.y);
      else if (k === 'escape') { st.vyber = null; st.cesta = null; ukazInfo(); spinave = true; }
    });

    $('btnSpat').onclick = ukonciDen;
    document.querySelectorAll('.zalozky button').forEach(b => b.onclick = () => prepniZalozku(b.dataset.tab));
    $('nocDal').onclick = zavriNoc;
    $('nalezPrijmout').onclick = () => rozhodniNalez(true);
    $('nalezOdmitnout').onclick = () => rozhodniNalez(false);
    $('btnPlus').onclick = () => zoomuj(kam.z + 1);
    $('btnMinus').onclick = () => zoomuj(kam.z - 1);
    $('btnStred').onclick = () => vystred(st.hra.hrac.x, st.hra.hrac.y);
    $('btnMenu').onclick = () => { $('seed').value = st.hra.seed; $('radyZap').checked = radyZapnute(); $('menu').showModal(); };
    $('radyZap').onchange = e => { uloziste.pis(KLIC_RADY, e.target.checked ? '1' : '0'); prekresliVse(); };
    $('menuZavrit').onclick = () => $('menu').close();
    $('btnNovy').onclick = () => novaHraDotaz((Math.random() * 1e9) >>> 0);
    $('btnDne').onclick = () => novaHraDotaz(T.nahoda.seedDne());
    $('btnSeed').onclick = () => novaHraDotaz(T.nahoda.seedZTextu($('seed').value || '1'));
    $('btnExport').onclick = exportuj;
    $('souborImport').onchange = e => { if (e.target.files[0]) importuj(e.target.files[0]); e.target.value = ''; };
    $('konecZnovu').onclick = () => { $('konec').hidden = true; novaHra(st.hra.seed); };
    $('konecNovy').onclick = () => { $('konec').hidden = true; novaHra((Math.random() * 1e9) >>> 0); };
  }

  function start() {
    cv = $('mapa'); ctx = cv.getContext('2d');
    mini = $('minimapa'); mctx = mini.getContext('2d');
    velikost();
    new ResizeObserver(velikost).observe($('mapaObal'));
    window.addEventListener('resize', velikost);
    napojOvladani();
    if (typeof Rekord !== 'undefined') {
      rekord = Rekord.sleduj(KLIC_REKORD, { popisek: 'Nejdelší přežití', format: v => `${v} ${sklon(v, 'den', 'dny', 'dní')}` });
      rekord.prvek($('rekord'));
      rekordPlavba = Rekord.sleduj('webapp_hra_trosecnici_plavba', { vyssiLepsi: false, popisek: 'Nejrychlejší záchrana', format: v => `${v}. den` });
      rekordPlavba.prvek($('rekordPlavba'));
      rekordLide = Rekord.sleduj('webapp_hra_trosecnici_zachraneni', { popisek: 'Nejvíc zachráněných', format: v => `${v} ${sklon(v, 'člověk', 'lidé', 'lidí')}` });
      rekordLide.prvek($('rekordLide'));
    }
    G.pripravAtlas();
    zalozka = uloziste.cti(KLIC_ZALOZKA) || 'tady';
    let h = null;
    const ulozeno = uloziste.cti(KLIC_ULOZENI);
    if (ulozeno) { try { h = HRA.nacti(ulozeno); } catch (e) { h = null; } }
    if (h) nastavHru(h); else novaHra(T.nahoda.seedDne());
    videnoDeniku = st.hra.denik.length;
    prepniZalozku(zalozka);
    setInterval(() => { if (!document.hidden) { snimek++; spinave = true; } }, 260);
    requestAnimationFrame(smycka);
  }

  T.ui = {
    st, kam, start, novaHra, prepniZalozku, klikNaPole, jdi, krokKlavesou, provedAkci, stavej, ukonciDen, ukazNalez, rozhodniNalez, ukazUdalost, ukazObjevy, nabidniOdplout, ukazPodzemi, zavriNoc, zoomuj, vystred,
    prekresli: prekresliVse, get platno() { return cv; },
  };
  document.addEventListener('DOMContentLoaded', start);
})(TROS);
