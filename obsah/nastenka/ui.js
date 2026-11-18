/* 🧷 Nástěnka vyšetřovatele – ovládání plochy (plátno), panel entit spisu, provázky = vazby spisu,
   uložení rozložení ke spisu, tisk/PDF. Model v nastenka/jadro.js (NASTENKA), kreslení objektů WB_JADRO. */
(function () {
  'use strict';
  const S = window.SPIS, J = window.WB_JADRO, N = window.NASTENKA, el = S.el;
  const $ = id => document.getElementById(id);
  const T = (s, p) => (window.I18N && I18N.t ? I18N.t(s, p) : s);
  const NASTROJ = N.NASTROJ;
  const platno = $('platno'), ctx = platno.getContext('2d'), plocha = $('plocha');
  const merCtx = document.createElement('canvas').getContext('2d');
  J.nastavMereni((t, vel, pis) => { merCtx.font = `${vel}px ${J.PISMA[pis] || J.PISMA.sans}`; return merCtx.measureText(t).width; });
  const TISK_BARVY = { rozpor: '#b5352a', overeno: '#177540', neutralni: '#4b535b', smazane: '#9e9e9e' };
  const MAX_HISTORIE = 100;

  /* ---------- stav ---------- */
  let pripad = null, dokId = null;
  let stav = N.prazdny();
  let entity = new Map(), vazby = new Map();
  let vyber = new Set(), rezim = 'vyber', akce = null;
  let zpet = [], vpred = [], stavJSON = '[]';
  let casovacUlozeni = 0, neulozeno = false, ukladani = Promise.resolve();
  let barvy = Object.assign({}, N.VYCHOZI_BARVY), pozadi = '#ffffff', akcent = '#2862bb', mrizka = '#888';
  const obrazky = new Map();            // id souboru → { img, url } | null (načítá se)
  let posledniKlik = { id: null, t: 0 };

  const kam = () => stav.kamera;
  const naSvet = (sx, sy) => ({ x: sx / kam().z + kam().x, y: sy / kam().z + kam().y });
  const volby = () => ({ T, typy: S.TYPY, barvy, nazevVazby: S.nazevVazby });
  const objekt = id => stav.objekty.find(o => o.id === id);
  const vybrane = () => stav.objekty.filter(o => vyber.has(o.id));
  const chyba = e => { console.warn(e); Dialog.chyba(e && e.message ? e.message : String(e)); };

  function nactiBarvy() {
    const cs = getComputedStyle(document.documentElement), v = k => cs.getPropertyValue(k).trim();
    barvy = { rozpor: v('--danger') || N.VYCHOZI_BARVY.rozpor, overeno: v('--ok') || N.VYCHOZI_BARVY.overeno,
      neutralni: v('--text-muted') || N.VYCHOZI_BARVY.neutralni, smazane: v('--text-faint') || N.VYCHOZI_BARVY.smazane };
    pozadi = v('--bg-deep') || '#eeeeee'; akcent = v('--accent') || akcent; mrizka = v('--border') || mrizka;
  }

  /* ---------- načtení případu a dat spisu ---------- */
  // úlohy načítání jdou za sebou (rychlé události ze spisu se nesmí předbíhat)
  let fronta = Promise.resolve(), naplanovano = new Set();
  function naplanuj(fn) {
    if (naplanovano.has(fn)) return;
    naplanovano.add(fn);
    fronta = fronta.then(() => new Promise(r => setTimeout(r, 40))).then(() => { naplanovano.delete(fn); return fn(); }).catch(chyba);
  }

  async function nactiPripad() {
    await ulozitHned();
    let p = null;
    try { p = S.aktivni() ? await S.pripad(S.aktivni()) : null; } catch (e) { chyba(e); }
    pripad = p; dokId = null; vyber.clear(); akce = null;
    stav = N.prazdny(); entity = new Map(); vazby = new Map();
    if (pripad) {
      const d = await N.najdiDokument(S, pripad.id);
      dokId = d ? d.id : null;
      stav = N.nactiStav(d && d.data.nastenka);
      await nactiData(true);
    } else { vykresliPanel(); }
    zpet = []; vpred = []; stavJSON = JSON.stringify(stav.objekty);
    // úzký displej: uložený pohled bývá z počítače – ukázat celou nástěnku (bez přepsání uloženého pohledu)
    if (innerWidth <= 700) celaNastenka(false);
    obnovUI();
    prekresli();
  }
  async function nactiData(bezZapisu) {
    if (!pripad) return;
    entity = new Map((await S.seznam(null, { pripad: pripad.id, smazane: true })).map(e => [e.id, e]));
    vazby = new Map((await S.vazby(null, { pripad: pripad.id, smazane: true })).map(v => [v.id, v]));
    N.obnovVse(stav, entity, vazby, volby());
    nactiObrazky();
    // výška kartiček se mohla změnit – uložit bez kroku Zpět
    if (!bezZapisu) { const s = JSON.stringify(stav.objekty); if (s !== stavJSON) { stavJSON = s; naplanujUlozeni(); } }
    vykresliPanel();
    obnovUI();
    prekresli();
  }

  function nactiObraz(soubor) {
    if (obrazky.has(soubor)) return;
    obrazky.set(soubor, null);
    S.soubor(soubor).then(s => {
      if (!s) return;
      const url = URL.createObjectURL(s.blob), img = new Image();
      img.onload = () => { obrazky.set(soubor, { img, url }); prekresli(); vykresliPanel(); };
      img.src = url;
    }).catch(() => { /* soubor chybí – kartička bez náhledu */ });
  }
  function nactiObrazky() {
    for (const o of stav.objekty) if (o.foto) nactiObraz(o.foto);
    for (const e of entity.values()) if (e.typ === 'foto' && e.data && e.data.soubor) nactiObraz(e.data.soubor);
  }

  /* ---------- historie a ukládání ---------- */
  function zapis() {
    const s = JSON.stringify(stav.objekty);
    if (s === stavJSON) return;
    zpet.push(stavJSON);
    if (zpet.length > MAX_HISTORIE) zpet.shift();
    vpred = []; stavJSON = s;
    naplanujUlozeni(); obnovUI(); vykresliPanel();
  }
  function obnovStav(s) {
    stav.objekty = JSON.parse(s); stavJSON = s;
    vyber = new Set([...vyber].filter(id => objekt(id)));
    N.obnovVse(stav, entity, vazby, volby());
    naplanujUlozeni(); obnovUI(); vykresliPanel(); prekresli();
  }
  function zpetKrok() { if (zpet.length) { vpred.push(stavJSON); obnovStav(zpet.pop()); } }
  function znovuKrok() { if (vpred.length) { zpet.push(stavJSON); obnovStav(vpred.pop()); } }

  function ukazStav(text) { const s = $('stavUlozeni'); s.textContent = text; s.hidden = !text; }
  function naplanujUlozeni() {
    if (!pripad) return;
    neulozeno = true; ukazStav(T('neuloženo…'));
    clearTimeout(casovacUlozeni);
    casovacUlozeni = setTimeout(ulozitHned, 1200);
  }
  function ulozitHned() {
    clearTimeout(casovacUlozeni);
    if (!neulozeno || !pripad) return ukladani;
    neulozeno = false;
    const p = pripad.id, kopie = { objekty: JSON.parse(JSON.stringify(stav.objekty)), kamera: Object.assign({}, stav.kamera) };
    ukladani = ukladani.then(async () => {
      try {
        const d = await N.uloz(S, kopie, { id: p === (pripad && pripad.id) ? dokId : null, pripad: p });
        if (pripad && pripad.id === p) dokId = d.id;
        if (!neulozeno) ukazStav(T('uloženo do spisu'));
      } catch (e) { neulozeno = true; ukazStav(T('neuloženo!')); chyba(e); }
    });
    return ukladani;
  }
  addEventListener('pagehide', () => { ulozitHned(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) ulozitHned(); });

  /* ---------- kreslení ---------- */
  let planovano = false, dpr = 1;
  function prekresli() { if (!planovano) { planovano = true; requestAnimationFrame(vykresli); } }
  function prizpusob() {
    dpr = window.devicePixelRatio || 1;
    const w = plocha.clientWidth, h = plocha.clientHeight;
    platno.width = Math.max(1, Math.round(w * dpr)); platno.height = Math.max(1, Math.round(h * dpr));
    prekresli();
  }
  function obdelnikZaobleny(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }

  // nakreslí objekty plochy do kontextu (transformace světa už nastavená)
  function kresliVse(c, { pozadi: bg, vyber: sVyberem }) {
    const env = { obrazek: () => null, pozadi: bg };
    for (const o of stav.objekty) {
      if (o.typ !== 'listek') continue;
      if (o.zvyr) { c.save(); c.globalAlpha = 0.6; c.fillStyle = '#ffd400'; obdelnikZaobleny(c, o.x - 9, o.y - 9, o.w + 18, o.h + 18, 12); c.fill(); c.restore(); }
      J.kresli(c, o, env);
      if (o.smazana) {
        c.save(); c.strokeStyle = barvy.rozpor; c.lineWidth = 2; c.setLineDash([6, 4]); c.strokeRect(o.x, o.y, o.w, o.h); c.restore();
      }
      if (o.foto) {
        const ob = obrazky.get(o.foto), bx = o.x + 12, by = o.y + o.h - N.FOTO, bw = o.w - 24, bh = N.FOTO - 12;
        if (ob) {
          const m = Math.min(bw / ob.img.naturalWidth, bh / ob.img.naturalHeight), w = ob.img.naturalWidth * m, h = ob.img.naturalHeight * m;
          c.drawImage(ob.img, bx + (bw - w) / 2, by + (bh - h) / 2, w, h);
        } else { c.save(); c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(bx, by, bw, bh); c.restore(); }
      }
      if (N.jeKarta(o)) {   // špendlík
        c.save(); c.fillStyle = o.smazana ? '#888' : '#d32f2f'; c.beginPath(); c.arc(o.x + o.w / 2, o.y + 3, 5, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(o.x + o.w / 2 - 1.5, o.y + 1.5, 1.6, 0, Math.PI * 2); c.fill(); c.restore();
      }
    }
    for (const o of stav.objekty) if (o.typ === 'cara') J.kresli(c, o, env);
    if (sVyberem) {
      c.save(); c.strokeStyle = akcent; c.lineWidth = 2 / kam().z; c.setLineDash([6 / kam().z, 4 / kam().z]);
      for (const o of vybrane()) { const h = J.hranice(o); c.strokeRect(h.x - 4, h.y - 4, h.w + 8, h.h + 8); }
      c.restore();
    }
  }
  function vykresli() {
    planovano = false;
    const w = platno.width / dpr, h = platno.height / dpr, k = kam();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = pozadi; ctx.fillRect(0, 0, w, h);
    // jemná tečkovaná mřížka (korková nástěnka bez korku)
    const krok = 40 * k.z;
    if (krok > 12) {
      ctx.fillStyle = mrizka;
      const x0 = -((k.x * k.z) % krok), y0 = -((k.y * k.z) % krok);
      for (let x = x0; x < w; x += krok) for (let y = y0; y < h; y += krok) ctx.fillRect(x, y, 1.5, 1.5);
    }
    ctx.setTransform(dpr * k.z, 0, 0, dpr * k.z, -k.x * k.z * dpr, -k.y * k.z * dpr);
    kresliVse(ctx, { pozadi, vyber: true });
    if (akce && akce.druh === 'provazek') {
      const a = J.hraniceHole(akce.od);
      ctx.save(); ctx.strokeStyle = akcent; ctx.lineWidth = 2.5 / k.z; ctx.setLineDash([8 / k.z, 5 / k.z]);
      ctx.beginPath(); ctx.moveTo(a.x + a.w / 2, a.y + a.h / 2); ctx.lineTo(akce.x, akce.y); ctx.stroke(); ctx.restore();
    }
    $('tlZoom').textContent = Math.round(k.z * 100) + ' %';
  }

  /* ---------- kamera ---------- */
  function zoomNa(z, sx = plocha.clientWidth / 2, sy = plocha.clientHeight / 2) {
    const k = kam(), p = naSvet(sx, sy);
    k.z = Math.min(4, Math.max(0.1, z));
    k.x = p.x - sx / k.z; k.y = p.y - sy / k.z;
    prekresli(); naplanujUlozeni();
  }
  function celaNastenka(ulozit = true) {
    const h = J.hraniceVsech(stav.objekty);
    if (!h) return;
    const W = plocha.clientWidth, H = plocha.clientHeight, okraj = 30;
    const z = Math.min(1.5, Math.max(0.1, Math.min((W - 2 * okraj) / h.w, (H - 2 * okraj) / h.h)));
    Object.assign(kam(), { z, x: h.x + h.w / 2 - W / 2 / z, y: h.y + h.h / 2 - H / 2 / z });
    prekresli(); if (ulozit) naplanujUlozeni();
  }
  function stredPohledu() { return naSvet(plocha.clientWidth / 2, plocha.clientHeight / 2); }
  function ukazObjekt(o) {
    const h = J.hranice(o), v = { x: kam().x, y: kam().y, w: plocha.clientWidth / kam().z, h: plocha.clientHeight / kam().z };
    if (!J.obsahuje(v, h)) { kam().x = h.x + h.w / 2 - v.w / 2; kam().y = h.y + h.h / 2 - v.h / 2; naplanujUlozeni(); }
    prekresli();
  }

  /* ---------- akce s kartičkami ---------- */
  function vlozKartu(k) {
    const i = stav.objekty.findIndex(N.jeProvazek);
    if (i < 0) stav.objekty.push(k); else stav.objekty.splice(i, 0, k);
  }
  function pridejKartu(eid, x, y) {
    if (!pripad) return;
    const byla = N.kartaEntity(stav, eid);
    if (byla) { vyber = new Set([byla.id]); ukazObjekt(byla); obnovUI(); return byla; }
    const e = entity.get(eid);
    if (!e || e.smazano) return null;
    const s = stredPohledu();
    const k = N.kartaZEntity(e, x == null ? s.x - N.SIRKA / 2 : x, y == null ? s.y - 40 : y, T, S.TYPY);
    vlozKartu(k);
    vyber = new Set([k.id]);
    nactiObrazky(); zapis(); prekresli();
    if (innerWidth <= 700 && !$('panel').hidden) prepniPanel(false);
    return k;
  }

  // dialog typu vazby; vrací { typ, popis } nebo null
  function dialogVazby(od, kam, v) {
    const d = $('dlgVazba');
    $('vNadpis').textContent = v ? T('🧵 Upravit vazbu ve spisu') : T('🧵 Nová vazba ve spisu');
    const jm = o => { const e = entity.get(o); return e ? (S.TYPY[e.typ].ikona + ' ' + e.nazev) : o; };
    $('vSpojeni').textContent = jm(od) + '  →  ' + jm(kam);
    const sel = $('vTyp');
    const typy = [...N.TYPY_VAZEB];
    if (v && !typy.includes(v.typ)) typy.push(v.typ);
    sel.replaceChildren(...typy.map(t => el('option', { value: t, text: T(S.nazevVazby(t)) })));
    sel.value = v ? v.typ : 'souvisi';
    $('vPopis').value = v ? v.popis || '' : '';
    d.returnValue = '';
    d.showModal();
    sel.focus();
    return new Promise(ok => d.addEventListener('close', () => ok(d.returnValue === 'ok' ? { typ: sel.value, popis: $('vPopis').value } : null), { once: true }));
  }
  async function novyProvazek(od, cil) {
    const r = await dialogVazby(od.entita, cil.entita);
    if (!r) return;
    try {
      const v = await S.vazba(od.entita, cil.entita, r.typ, { popis: r.popis, nastroj: NASTROJ });
      vazby.set(v.id, v);
      // karta mezitím mohla zmizet (Zpět v jiné záložce) – provázek jen mezi kartičkami na ploše
      const a = objekt(od.id), b = objekt(cil.id);
      if (a && b) { stav.objekty.push(N.provazekZVazby(v, a, b, entity, volby())); J.prepoj(stav.objekty); }
      vyber = new Set(); zapis(); prekresli();
    } catch (e) { chyba(e); }
  }
  async function upravProvazek(c) {
    const v = vazby.get(c.vazba);
    if (!v || v.smazano) return Dialog.info(T('Vazba je ve spisu smazaná – obnovit ji jde v kartě záznamu.'));
    const r = await dialogVazby(v.od, v.do, v);
    if (!r) return;
    try { await S.upravVazbu(v.id, { typ: r.typ, popis: r.popis }, { nastroj: NASTROJ }); await nactiData(); } catch (e) { chyba(e); }
  }
  function dialogPoznamky(text) {
    const d = $('dlgPoznamka');
    $('pText').value = text || ''; d.returnValue = '';
    d.showModal(); $('pText').focus();
    return new Promise(ok => d.addEventListener('close', () => ok(d.returnValue === 'ok' ? $('pText').value.trim() : null), { once: true }));
  }
  async function novaPoznamka() {
    if (!pripad) return;
    const t = await dialogPoznamky('');
    if (!t) return;
    const s = stredPohledu(), o = N.poznamka(t, s.x - N.SIRKA / 2, s.y - 30);
    vlozKartu(o); vyber = new Set([o.id]); zapis(); prekresli();
  }
  async function upravPoznamku(o) {
    const t = await dialogPoznamky(o.text.replace(/^📝 /, ''));
    if (t === null || !objekt(o.id)) return;
    if (!t) { N.odeber(stav, [o.id]); vyber.delete(o.id); }
    else { o.text = '📝 ' + t; o.h = N.vyskaKarty(o); J.zneplatni(o); J.prepoj(stav.objekty); }
    zapis(); prekresli();
  }
  function otevriKartu(o) {
    if (N.jeKarta(o)) return SpisKarta.otevri(o.entita, { nastroj: NASTROJ });
    if (N.jeProvazek(o)) return upravProvazek(o);
    if (o.typ === 'listek') return upravPoznamku(o);
  }

  /* ---------- ukazatel (myš, pero, prsty) ---------- */
  const ukazatele = new Map();
  let pinch = null;
  function bod(e) { const r = platno.getBoundingClientRect(); return { sx: e.clientX - r.left, sy: e.clientY - r.top }; }
  platno.addEventListener('pointerdown', e => {
    if (e.button > 0 || !pripad) return;
    e.preventDefault();
    platno.focus({ preventScroll: true });
    platno.setPointerCapture(e.pointerId);
    const { sx, sy } = bod(e);
    ukazatele.set(e.pointerId, { sx, sy });
    if (ukazatele.size === 2) {           // dva prsty = přiblížení
      const [a, b] = [...ukazatele.values()];
      pinch = { d: Math.hypot(a.sx - b.sx, a.sy - b.sy), z: kam().z, s: naSvet((a.sx + b.sx) / 2, (a.sy + b.sy) / 2) };
      akce = null; return;
    }
    if (ukazatele.size > 2) return;
    const p = naSvet(sx, sy), o = J.najdi(stav.objekty, p.x, p.y, 6 / kam().z);
    if (rezim === 'provazek' && N.jeKarta(o) && !o.smazana) { akce = { druh: 'provazek', od: o, x: p.x, y: p.y }; prekresli(); return; }
    if (o) {
      if (e.shiftKey || e.ctrlKey || e.metaKey) { if (vyber.has(o.id)) vyber.delete(o.id); else vyber.add(o.id); }
      else if (!vyber.has(o.id)) vyber = new Set([o.id]);
      const posun = vybrane().filter(x => x.typ === 'listek');
      akce = { druh: 'presun', o, sx, sy, pohyb: false, puvodni: posun.map(x => [x, x.x, x.y]) };
    } else {
      if (!e.shiftKey) vyber.clear();
      akce = { druh: 'posun', sx, sy, kx: kam().x, ky: kam().y, pohyb: false };
    }
    obnovUI(); prekresli();
  });
  platno.addEventListener('pointermove', e => {
    if (!ukazatele.has(e.pointerId)) return;
    const { sx, sy } = bod(e);
    ukazatele.set(e.pointerId, { sx, sy });
    if (pinch && ukazatele.size === 2) {
      const [a, b] = [...ukazatele.values()], d = Math.hypot(a.sx - b.sx, a.sy - b.sy);
      const k = kam(); k.z = Math.min(4, Math.max(0.1, pinch.z * d / Math.max(pinch.d, 1)));
      const mx = (a.sx + b.sx) / 2, my = (a.sy + b.sy) / 2;
      k.x = pinch.s.x - mx / k.z; k.y = pinch.s.y - my / k.z;
      return prekresli();
    }
    if (!akce) return;
    const dx = (sx - akce.sx) / kam().z, dy = (sy - akce.sy) / kam().z;
    if (akce.druh === 'presun') {
      if (!akce.pohyb && Math.hypot(sx - akce.sx, sy - akce.sy) < 4) return;
      akce.pohyb = true;
      for (const [o, x, y] of akce.puvodni) { o.x = Math.round(x + dx); o.y = Math.round(y + dy); J.zneplatni(o); }
      J.prepoj(stav.objekty);
    } else if (akce.druh === 'posun') {
      if (!akce.pohyb && Math.hypot(sx - akce.sx, sy - akce.sy) < 4) return;
      akce.pohyb = true; plocha.classList.add('posun');
      kam().x = akce.kx - dx; kam().y = akce.ky - dy;
    } else if (akce.druh === 'provazek') {
      const p = naSvet(sx, sy); akce.x = p.x; akce.y = p.y;
    }
    prekresli();
  });
  function konec(e) {
    if (!ukazatele.has(e.pointerId)) return;
    ukazatele.delete(e.pointerId);
    plocha.classList.remove('posun');
    if (pinch) { if (!ukazatele.size) { pinch = null; naplanujUlozeni(); } return; }
    const a = akce; akce = null;
    if (!a) return;
    if (e.type === 'pointercancel') { if (a.druh === 'presun') zapis(); return prekresli(); }
    if (a.druh === 'presun') {
      if (a.pohyb) zapis();
      else {
        const t = performance.now();
        if (posledniKlik.id === a.o.id && t - posledniKlik.t < 450) { posledniKlik = { id: null, t: 0 }; otevriKartu(a.o); }
        else posledniKlik = { id: a.o.id, t };
      }
    } else if (a.druh === 'posun') { if (a.pohyb) naplanujUlozeni(); }
    else if (a.druh === 'provazek') {
      const cil = J.najdi(stav.objekty, a.x, a.y, 6 / kam().z, o => !N.jeKarta(o));
      if (cil && cil !== a.od && !cil.smazana) novyProvazek(a.od, cil);
    }
    obnovUI(); prekresli();
  }
  platno.addEventListener('pointerup', konec);
  platno.addEventListener('pointercancel', konec);
  platno.addEventListener('wheel', e => {
    e.preventDefault();
    const { sx, sy } = bod(e);
    zoomNa(kam().z * Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * 0.004), sx, sy);
  }, { passive: false });

  /* ---------- panel entit ---------- */
  let poradiPanelu = 0;
  async function vykresliPanel() {
    const cil = $('seznamEntit'), moje = ++poradiPanelu;
    if (!pripad) { cil.replaceChildren(el('div', { class: 'prazdny-seznam', text: T('Není otevřený žádný případ.') })); return; }
    let v;
    try { v = await S.seznam(null, { pripad: pripad.id, hledat: $('hledat').value }); } catch (e) { return chyba(e); }
    if (moje !== poradiPanelu) return;
    v = v.filter(e => !N.jeDokumentNastenky(e));
    const naPlose = new Set(stav.objekty.filter(N.jeKarta).map(o => o.entita));
    const deti = [];
    let typ = null;
    for (const e of v) {
      const Ty = S.TYPY[e.typ];
      if (e.typ !== typ) { typ = e.typ; deti.push(el('div', { class: 'skupina', text: T(Ty.mnoz) })); }
      const ob = e.typ === 'foto' && e.data.soubor ? obrazky.get(e.data.soubor) : null;
      const radek = N.textKarty(e, T, S.TYPY).split('\n').slice(2).join(' · ');
      deti.push(el('div', { class: 'pol' + (naPlose.has(e.id) ? ' naPlose' : ''), tabindex: '0', role: 'button', dataset: { id: e.id },
        title: naPlose.has(e.id) ? T('Už je na nástěnce – klik ji ukáže') : T('Přetáhněte na plochu nebo klepněte') },
        ob ? el('img', { src: ob.url, alt: '' }) : el('span', { class: 'ik', text: Ty.ikona }),
        el('span', { class: 'tx' }, el('div', { class: 'nz', 'data-i18n': 'ne', text: e.nazev }), radek ? el('div', { class: 'po', 'data-i18n': 'ne', text: radek }) : null),
        naPlose.has(e.id) ? el('span', { class: 'na', text: '✓', 'aria-label': T('na nástěnce') }) : null));
    }
    if (!deti.length) deti.push(el('div', { class: 'prazdny-seznam', text: $('hledat').value ? T('Nic nenalezeno.') : T('Spis zatím nemá žádné záznamy. Přidejte je ve spisu nebo v nástrojích sekce Vyšetřování.') }));
    cil.replaceChildren(...deti);
  }
  $('hledat').addEventListener('input', () => vykresliPanel());

  // tažení položky z panelu na plochu (pointer události – funguje myší i perem; prst panel posouvá, klepnutí přidá)
  let tah = null;
  const seznamEl = $('seznamEntit');
  seznamEl.addEventListener('pointerdown', e => {
    const pol = e.target.closest('.pol');
    if (!pol || e.button > 0) return;
    tah = { id: pol.dataset.id, sx: e.clientX, sy: e.clientY, duch: null, pol };
    if (e.pointerType === 'mouse') { e.preventDefault(); pol.setPointerCapture(e.pointerId); }
  });
  seznamEl.addEventListener('pointermove', e => {
    if (!tah) return;
    if (!tah.duch && Math.hypot(e.clientX - tah.sx, e.clientY - tah.sy) > 6) {
      if (e.pointerType !== 'mouse') return;            // prstem se seznam posouvá
      tah.duch = el('div', { class: 'duch', 'data-i18n': 'ne', text: (entity.get(tah.id) || { nazev: '' }).nazev });
      document.body.append(tah.duch);
    }
    if (tah.duch) { tah.duch.style.left = (e.clientX + 10) + 'px'; tah.duch.style.top = (e.clientY + 6) + 'px'; }
  });
  seznamEl.addEventListener('pointerup', e => {
    if (!tah) return;
    const t = tah; tah = null;
    if (t.duch) {
      t.duch.remove();
      const r = platno.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        const p = naSvet(e.clientX - r.left, e.clientY - r.top);
        pridejKartu(t.id, p.x - N.SIRKA / 2, p.y - 20);
      }
    } else if (Math.hypot(e.clientX - t.sx, e.clientY - t.sy) < 8) pridejKartu(t.id);
  });
  seznamEl.addEventListener('pointercancel', () => { if (tah && tah.duch) tah.duch.remove(); tah = null; });
  seznamEl.addEventListener('keydown', e => { const pol = e.target.closest('.pol'); if (pol && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pridejKartu(pol.dataset.id); } });

  function prepniPanel(ukaz) {
    const p = $('panel');
    p.hidden = ukaz === undefined ? !p.hidden : !ukaz;
    $('tlPanel').setAttribute('aria-pressed', String(!p.hidden));
  }

  /* ---------- tisk a PDF ---------- */
  // obrázek celé nástěnky se záhlavím případu a legendou (světlé barvy na papír)
  function obrazekNastenky(meritko = 2) {
    const h = J.hraniceVsech(stav.objekty);
    if (!h) return null;
    const okraj = 30, hlava = 74;
    const ob = { x: h.x - okraj, y: h.y - okraj, w: h.w + 2 * okraj, h: h.h + 2 * okraj };
    const m = Math.max(0.3, Math.min(meritko, 9000 / ob.w, 9000 / (ob.h + hlava), Math.sqrt(60e6 / (ob.w * (ob.h + hlava)))));
    const c = document.createElement('canvas');
    c.width = Math.ceil(Math.max(ob.w, 640) * m); c.height = Math.ceil((ob.h + hlava) * m);
    const x = c.getContext('2d');
    const puvodni = barvy;
    barvy = TISK_BARVY; N.obnovVse(stav, entity, vazby, volby());
    try {
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
      x.setTransform(m, 0, 0, m, 0, 0);
      x.fillStyle = '#1e1e1e'; x.textBaseline = 'top';
      x.font = `600 20px ${J.PISMA.sans}`;
      x.fillText('🧷 ' + T('Nástěnka') + ' – ' + (pripad.cislo ? pripad.cislo + ' · ' : '') + pripad.nazev, 14, 10);
      x.font = `13px ${J.PISMA.sans}`; x.fillStyle = '#4b535b';
      const d = new Date();
      x.fillText(T('Vytištěno') + ' ' + d.getDate() + '. ' + (d.getMonth() + 1) + '. ' + d.getFullYear() + ' · ' + T('jen pro vlastní práci a výcvik, není to úřední listina'), 14, 36);
      let lx = 14;
      for (const [k, popis] of [['rozpor', 'vyvrací – rozpor'], ['overeno', 'potvrzuje – ověřeno'], ['tvrzeni', 'tvrzení (neověřeno)'], ['neutralni', 'ostatní vazby']]) {
        const K = N.KATEGORIE[k];
        x.strokeStyle = TISK_BARVY[K.barva]; x.lineWidth = K.sirka; x.setLineDash(K.styl === 'carky' ? [8, 6] : []);
        x.beginPath(); x.moveTo(lx, 62); x.lineTo(lx + 26, 62); x.stroke(); x.setLineDash([]);
        x.fillStyle = '#1e1e1e'; x.textBaseline = 'middle'; x.fillText(T(popis), lx + 32, 62);
        lx += 32 + x.measureText(T(popis)).width + 22;
      }
      x.setTransform(m, 0, 0, m, -ob.x * m, (hlava - ob.y) * m);
      kresliVse(x, { pozadi: '#ffffff', vyber: false });
    } finally { barvy = puvodni; N.obnovVse(stav, entity, vazby, volby()); }
    return c;
  }
  function stahni(blob, jmeno) {
    const url = URL.createObjectURL(blob), a = el('a', { href: url, download: jmeno });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  const jmenoSouboru = pr => 'nastenka-' + String((pripad && (pripad.cislo || pripad.nazev)) || 'pripad').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').slice(0, 60) + '.' + pr;
  async function tisk() {
    const c = obrazekNastenky(2);
    if (!c) return Dialog.info(T('Nástěnka je prázdná.'));
    const img = el('img', { src: c.toDataURL('image/png'), alt: T('Nástěnka') });
    $('tisk').replaceChildren(img);
    try { await img.decode(); } catch (e) { /* tisk i tak */ }
    window.print();
  }
  function nactiJsPDF() {
    if (window.jspdf) return Promise.resolve();
    return new Promise((ok, ko) => {
      const s = el('script', { src: 'lib/jspdf.umd.min.js' });
      s.onload = ok; s.onerror = () => ko(new Error(T('Knihovnu PDF se nepodařilo načíst.')));
      document.head.append(s);
    });
  }
  async function pdf(stahnout = true) {
    const c = obrazekNastenky(2);
    if (!c) { Dialog.info(T('Nástěnka je prázdná.')); return null; }
    await nactiJsPDF();
    const { jsPDF } = window.jspdf;
    const na = c.width >= c.height, W = na ? 297 : 210, H = na ? 210 : 297, okraj = 8;
    const doc = new jsPDF({ orientation: na ? 'landscape' : 'portrait', unit: 'mm', format: 'a4', compress: true });
    const m = Math.min((W - 2 * okraj) / c.width, (H - 2 * okraj) / c.height);
    doc.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', (W - c.width * m) / 2, okraj, c.width * m, c.height * m);
    const blob = doc.output('blob');
    if (stahnout) stahni(blob, jmenoSouboru('pdf'));
    return blob;
  }
  function png() {
    const c = obrazekNastenky(2);
    if (!c) return Dialog.info(T('Nástěnka je prázdná.'));
    c.toBlob(b => stahni(b, jmenoSouboru('png')), 'image/png');
  }

  /* ---------- modelový případ ---------- */
  async function ukazka(tise) {
    try {
      await ulozitHned(); await ukladani;
      const byla = await S.entita(N.MODEL_DOKUMENT);
      if (byla && !byla.smazano && byla.data && byla.data.nastenka) {
        if (tise === true) { await S.otevri('model-17'); return; }   // průvodce: existující nástěnku jen otevřít
        const znovu = await Dialog.potvrd(T('Nástěnka modelového případu už existuje. Rozložit ji znovu podle předlohy? Vaše úpravy rozložení modelové nástěnky se přepíší (spis zůstane, nic se nezdvojí).'),
          { ok: T('Rozložit znovu'), zrus: T('Jen otevřít') });
        if (!znovu) { await S.otevri('model-17'); return; }
      }
      await N.modelova(S, Object.assign({ M: window.MODELOVY_PRIPAD }, volby()));
      await S.otevri('model-17');
      naplanuj(async () => { celaNastenka(); });
    } catch (e) { chyba(e); }
  }

  /* ---------- příkazy, lišta a nabídky ---------- */
  const PRIKAZY = {
    panel: () => prepniPanel(),
    provazek: () => { rezim = rezim === 'provazek' ? 'vyber' : 'provazek'; obnovUI(); if (rezim === 'provazek') Dialog.info(T('Táhněte z kartičky na kartičku – vznikne vazba ve spisu.')); },
    vazbyVybranych: () => {
      const ids = vybrane().filter(N.jeKarta).map(o => o.entita);
      if (!ids.length) return Dialog.info(T('Vyberte jednu nebo více kartiček záznamů.'));
      const r = N.zobrazVazby(stav, ids, entity, vazby, volby());
      nactiObrazky(); zapis(); prekresli();
      Dialog.info(r.provazky || r.karty ? T('Přidáno provázků: {p}, kartiček: {k}.', { p: r.provazky, k: r.karty }) : T('Všechny vazby vybraných už na nástěnce jsou.'));
    },
    zpet: zpetKrok, znovu: znovuKrok,
    poznamka: novaPoznamka,
    karta: () => { const o = vybrane()[0]; if (o) otevriKartu(o); },
    zvyraznit: () => {
      const v = vybrane().filter(o => o.typ === 'listek');
      const zap = v.some(o => !o.zvyr);
      for (const o of v) { if (zap) o.zvyr = true; else delete o.zvyr; }
      zapis(); prekresli();
    },
    vybratVse: () => { vyber = new Set(stav.objekty.map(o => o.id)); obnovUI(); prekresli(); },
    odebrat: () => { if (!vyber.size) return; N.odeber(stav, [...vyber]); vyber.clear(); zapis(); prekresli(); },
    priblizit: () => zoomNa(kam().z * 1.25), oddalit: () => zoomNa(kam().z / 1.25), vse: celaNastenka,
    legenda: () => { $('legenda').hidden = !$('legenda').hidden; },
    tisk, pdf: () => pdf().catch(chyba), png,
    ukazka,
    spis: () => S.otevriStranku('spis.html'),
    napoveda: () => $('dlgNapoveda').showModal()
  };
  function obnovUI() {
    const maVyber = vybrane().length > 0;
    document.querySelectorAll('[data-pripad]').forEach(b => { b.disabled = !pripad; });
    document.querySelectorAll('[data-vyber]').forEach(b => { b.disabled = !pripad || !maVyber; });
    document.querySelectorAll('[data-prikaz=zpet]').forEach(b => { b.disabled = !zpet.length; });
    document.querySelectorAll('[data-prikaz=znovu]').forEach(b => { b.disabled = !vpred.length; });
    $('tlProvazek').setAttribute('aria-pressed', String(rezim === 'provazek'));
    plocha.classList.toggle('provazek', rezim === 'provazek');
    const prazdne = !pripad || !stav.objekty.length;
    $('prazdno').hidden = !prazdne;
    if (prazdne) {
      $('prazdnoNadpis').textContent = pripad ? T('Nástěnka je prázdná') : T('Žádný otevřený případ');
      $('prazdnoText').textContent = pripad ? T('Přetáhněte kartičky z panelu 📋 Entity (nebo na ně klepněte). Provázky mezi nimi založí vazby ve spisu.')
        : T('Vyberte případ v liště (📁 Spis), nebo si otevřete ukázku s modelovým případem 17/2026.');
      $('prazdnoTlacitka').hidden = !!pripad;
    }
    if (!pripad) ukazStav('');
  }
  function zavriNabidky() {
    document.querySelectorAll('.nabidka:not([hidden])').forEach(n => { n.hidden = true; });
    document.querySelectorAll('[data-nabidka][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const n = $(b.dataset.nabidka), bylo = !n.hidden;
    zavriNabidky();
    if (bylo) return;
    n.hidden = false; b.setAttribute('aria-expanded', 'true');
    const r = b.getBoundingClientRect();
    n.style.top = (r.bottom + 4) + 'px';
    n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
  }));
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-prikaz]');
    if (b && !b.disabled) { zavriNabidky(); return PRIKAZY[b.dataset.prikaz](); }
    if (!e.target.closest('.nabidka')) zavriNabidky();
  });
  document.querySelectorAll('[data-zavrit]').forEach(b => { b.onclick = () => b.closest('dialog').close(); });
  addEventListener('resize', zavriNabidky);
  document.addEventListener('keydown', e => {
    if (document.querySelector('dialog[open]') || e.target.closest('input, textarea, select')) return;
    const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (e.key === 'Escape') { zavriNabidky(); if (rezim === 'provazek') rezim = 'vyber'; else vyber.clear(); obnovUI(); prekresli(); }
    else if (ctrl && k === 'z' && !e.shiftKey) { e.preventDefault(); zpetKrok(); }
    else if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); znovuKrok(); }
    else if (ctrl && k === 'a' && pripad) { e.preventDefault(); PRIKAZY.vybratVse(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && vyber.size) { e.preventDefault(); PRIKAZY.odebrat(); }
    else if (e.key === 'Enter' && vyber.size === 1) { e.preventDefault(); PRIKAZY.karta(); }
    else if ((e.key === '+' || e.key === '=') && !ctrl) zoomNa(kam().z * 1.25);
    else if (e.key === '-' && !ctrl) zoomNa(kam().z / 1.25);
  });

  /* ---------- synchronizace se spisem ---------- */
  S.odebirej(u => {
    if (u.druh === 'aktivni' || (u.druh === 'pripad' && (!pripad || u.id === pripad.id))) return naplanuj(nactiPripad);
    if (!pripad || u.pripad !== pripad.id) return;
    if (u.druh === 'entita' && u.id === dokId) {        // rozložení změněné v jiné záložce
      if (!u.mistni && !neulozeno) naplanuj(nactiPripad);
      return;
    }
    // nástěnku případu založila jiná záložka – načíst ji, ať tahle nezaloží druhou
    if (u.druh === 'entita' && !dokId && u.typ === 'dokument' && !u.mistni && !neulozeno) return naplanuj(nactiPripad);
    if (u.druh === 'import' && !neulozeno) return naplanuj(nactiPripad);
    naplanuj(nactiData);
  });
  addEventListener('storage', e => { if (e.key === S.KLIC_AKTIVNI) naplanuj(nactiPripad); });
  new MutationObserver(() => { nactiBarvy(); N.obnovVse(stav, entity, vazby, volby()); prekresli(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  new ResizeObserver(() => requestAnimationFrame(prizpusob)).observe(plocha);

  if (innerWidth <= 700) { prepniPanel(false); $('legenda').hidden = true; }
  nactiBarvy(); prizpusob();
  SpisVyber.vloz($('vyberMisto'), { nastroj: NASTROJ });
  naplanuj(nactiPripad);
  // průvodce modelovým případem (?pripad=17): otevřít (při prvním průchodu rozložit) nástěnku modelového případu
  if (window.ModelovyPripad && window.ModelovyPripad.aktivni) naplanuj(() => ukazka(true));
  // pro testy a ladění
  window.NASTENKA_APP = { PRIKAZY, stav: () => stav, pripad: () => pripad, dokument: () => dokId, vyber: () => [...vyber],
    obrazekNastenky, pdf, ulozitHned: () => ulozitHned().then(() => ukladani), naSvet, kamera: kam,
    hotovo: () => fronta.then(() => ukladani) };
})();
