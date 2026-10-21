/* Laboratoř nemožných tvarů – ovládání stránky. */
(function (N) {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const fmt = (x, d = 4) => {
    if (x == null || !isFinite(x)) return '–';
    const a = Math.abs(x);
    if (a !== 0 && (a >= 1e6 || a < 1e-3)) return x.toExponential(2).replace('e', ' · 10^').replace('.', ',');
    return x.toLocaleString('cs-CZ', { maximumSignificantDigits: d });
  };
  N.fmt = fmt;

  const LIC = [0.29, 0.56, 0.85], RUB = [0.93, 0.55, 0.2], SEDA = [0.62, 0.64, 0.68], MALBA = [0.2, 0.75, 0.45];
  const SKUPINY = ['Topologické objekty', 'Uzly', 'Minimální plochy', 'Matematicky zvláštní tělesa', 'Tělesa se zvláštními fyzikálními vlastnostmi', 'Fraktály', 'Optické iluze'];

  const S = {
    obj: null, p: {}, kvalita: 'stredni', sit: null, top: null, teorie: null,
    barveni: 'strany', pruhlednost: 0, drat: false, okraje: true, pruniky: false, rez: null,
    usecky: null, malovani: null, cekaNaKlik: false, mereniId: 0,
  };
  N.stav = S;

  let pohled;

  function init() {
    pohled = N.pohled = new N.Pohled($('platno'));
    pohled.naKlik = trefa => klik(trefa);
    vytvorSeznam();
    ovladaniZobrazeni();
    const h = cteniHashe();
    vyber(h.obj && N.objekt(h.obj) ? h.obj : 'mobius', h.p);
    addEventListener('hashchange', () => {
      const h = cteniHashe();
      if (h.obj && N.objekt(h.obj) && (h.obj !== S.obj.id || JSON.stringify(h.p) !== JSON.stringify(zapisParam()))) vyber(h.obj, h.p, true);
    });
  }

  /* ---------- seznam objektů ---------- */
  function vytvorSeznam() {
    const sez = $('seznam'), sel = $('vyberObjektu');
    let html = '', opt = '';
    for (const sk of SKUPINY) {
      const ob = N.objekty.filter(o => o.skupina === sk);
      if (!ob.length) continue;
      html += `<div class="skupina"><h3>${esc(sk)}</h3>`;
      opt += `<optgroup label="${esc(sk)}">`;
      for (const o of ob) {
        const st = N.STITKY[o.stitek];
        html += `<button data-id="${o.id}" title="${esc(st.nazev)}"><span class="zn">${st.znak}</span>${esc(o.nazev)}</button>`;
        opt += `<option value="${o.id}">${st.znak} ${esc(o.nazev)}</option>`;
      }
      html += '</div>'; opt += '</optgroup>';
    }
    sez.innerHTML = html; sel.innerHTML = opt;
    sez.addEventListener('click', e => { const b = e.target.closest('button[data-id]'); if (b) vyber(b.dataset.id); });
    sel.addEventListener('change', () => vyber(sel.value));
  }

  function vyber(id, p, zHashe) {
    const o = N.objekt(id);
    S.obj = o;
    S.p = Object.assign(N.vychoziParametry(o), p || {});
    for (const b of document.querySelectorAll('#seznam button')) b.classList.toggle('on', b.dataset.id === id);
    $('vyberObjektu').value = id;
    zastavNastroje();
    S.kameraIdx = 0;
    S.barveni = o.barveni || 'strany';
    S.pruniky = false;
    $('chkPruniky').checked = false;
    S.rez = null; $('rez').value = 100; $('rezVal').textContent = 'vypnuto';
    vytvorParametry();
    pohled.ortograficka = o.kamera && !o.kameraJenTlacitkem ? !!o.kamera(S.p).orto : false;
    $('btnProjekce').textContent = pohled.ortograficka ? 'Ortografická' : 'Perspektiva';
    obnov(true);
    if (!zHashe) zapisHash();
  }

  /* ---------- parametry ---------- */
  function vytvorParametry() {
    const o = S.obj, el = $('parametry');
    if (!o.parametry.length) { el.innerHTML = '<p class="pozn">Tento objekt nemá nastavitelné parametry.</p>'; }
    else el.innerHTML = o.parametry.map(x => {
      if (x.volby) return `<div class="param" data-p="${x.id}"><div class="pn">${esc(x.nazev)}</div><div class="prepinace">` +
        x.volby.map(([v, t]) => `<button data-v="${esc(v)}">${esc(t)}</button>`).join('') + '</div></div>';
      return `<div class="param posuvnik" data-p="${x.id}"><span>${esc(x.nazev)}</span>
        <input type="range" min="${x.min}" max="${x.max}" step="${x.krok}" aria-label="${esc(x.nazev)}"><output></output></div>`;
    }).join('');
    for (const d of el.querySelectorAll('.param')) {
      const x = o.parametry.find(q => q.id === d.dataset.p);
      const inp = d.querySelector('input');
      if (inp) {
        inp.addEventListener('input', () => { S.p[x.id] = x.cele ? Math.round(+inp.value) : +inp.value; ukazParam(); if (!o.pomaly) obnovZpozdene(); });
        inp.addEventListener('change', () => { if (o.pomaly) obnov(false); zapisHash(); });
      } else d.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        S.p[x.id] = b.dataset.v; ukazParam(); obnov(true); zapisHash();
      });
    }
    ukazParam();
    $('kvalita').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === S.kvalita));
  }

  function ukazParam() {
    for (const d of document.querySelectorAll('#parametry .param')) {
      const x = S.obj.parametry.find(q => q.id === d.dataset.p);
      d.style.display = x.kdy && !x.kdy(S.p) ? 'none' : '';
      const inp = d.querySelector('input');
      if (inp) { inp.value = S.p[x.id]; d.querySelector('output').textContent = x.format ? x.format(S.p[x.id]) : fmt(S.p[x.id], 4); }
      else d.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === String(S.p[x.id])));
    }
  }

  let zpozdeni = 0;
  function obnovZpozdene() {
    cancelAnimationFrame(zpozdeni);
    zpozdeni = requestAnimationFrame(() => obnov(false));
  }

  /* ---------- generování a měření ---------- */
  function obnov(prizpusobit, zAnimace) {
    const o = S.obj;
    if (!zAnimace && S.prehravani) S.prehravani.stop = true;
    zastavNastroje();
    let sit;
    const chyba = e => { console.error(e); $('pocitam').hidden = true; $('vlastnosti').innerHTML = `<tr><td colspan="4" class="chyba">Chyba výpočtu: ${esc(e.message)}</td></tr>`; };
    try { sit = o.generuj(S.p, S.kvalita); }
    catch (e) { chyba(e); return; }
    const token = S.generace = (S.generace || 0) + 1;
    if (sit && typeof sit.then === 'function') {
      // pomalý výpočet ve Workeru: dokončí se, jen pokud mezitím nepřišel novější požadavek
      $('pocitam').hidden = false;
      sit.then(s => { if (token === S.generace) { $('pocitam').hidden = true; zpracuj(s, prizpusobit); } }, chyba);
      return;
    }
    $('pocitam').hidden = true;
    zpracuj(sit, prizpusobit);
  }

  function zpracuj(sit, prizpusobit) {
    const o = S.obj;
    S.sit = sit;
    S.teorie = o.teorie ? o.teorie(S.p, sit) : {};
    S.top = sit.bezTopologie ? null : N.topologie(sit);
    S.usecky = null;
    const id = ++S.mereniId;
    pohled.zobraz(sit, { pruhlednost: S.pruhlednost, ploche: sit.ploche });
    if (o.poZobrazeni) o.poZobrazeni(pohled, S.p, sit);
    pohled.dratovy(S.drat);
    obarvi();
    cary();
    if (prizpusobit) {
      if (o.pohledVychozi) { const v = o.pohledVychozi(S.p); pohled.az = v.az; pohled.el = v.el; }
      else if (!o.kamera) { pohled.az = -0.6; pohled.el = 0.45; }
      pohled.prizpusob(false);
      if (o.kamera && !o.kameraJenTlacitkem) { const k = o.kamera(S.p, S.kameraIdx || 0); pohled.az = k.az; pohled.el = k.el; if (k.vzd) pohled.vzd = k.vzd; if (k.cil) pohled.cil.set(...k.cil); pohled.aktualizujKameru(); }
    }
    ukazStitek();
    ukazTeorii();
    ukazNastroje();
    ukazVlastnosti();
    nastavExport();
    // drahé výpočty až po chvíli klidu
    clearTimeout(S.casovac);
    S.casovac = setTimeout(() => { if (id === S.mereniId) dopocitej(id); }, 350);
  }
  N.obnov = obnov;

  function dopocitej(id) {
    const o = S.obj, sit = S.sit, th = S.teorie;
    if (!S.top) return;
    const F = sit.tri.length / 3;
    if (th.pruniky !== undefined && F <= 160000) {
      const t0 = performance.now();
      S.usecky = N.samopruniky(sit);
      S.casPruniku = performance.now() - t0;
      if (id !== S.mereniId) return;
      cary();
    }
    if (o.krivost && sit.f) S.krivost = N.statKrivosti(sit.f, sit.dom.u, sit.dom.v, 40, o.krivostOkraj != null ? o.krivostOkraj : 0.02, o.krivostFiltr ? (u, v) => o.krivostFiltr(S.p, u, v, sit) : null);
    else S.krivost = null;
    ukazVlastnosti();
  }

  /* ---------- barvy ---------- */
  function obarvi() {
    const sit = S.sit, o = S.obj;
    if (S.malovani) return obarviMalbu();
    if ((S.barveni === 'K' || S.barveni === 'H') && sit.f) {
      const hod = N.krivostVrcholu(sit, S.barveni);
      const abs = [...hod].filter(isFinite).map(Math.abs).sort((a, b) => a - b);
      let m = abs[Math.floor(abs.length * 0.95)] || 1;
      if (S.barveni === 'H' && m < 1e-6) m = 1;    // minimální plocha: H ≈ 0 všude, barva zůstane bílá
      if (S.barveni === 'K' && o.krivostKonst) m = Math.abs(o.krivostKonst(S.p)) * 1.15;
      const barva = x => {
        if (!isFinite(x)) return SEDA;
        const s = Math.max(-1, Math.min(1, x / m));
        return s < 0 ? [1 + s * 0.85, 1 + s * 0.55, 1 + s * 0.1] : [1 - s * 0.05, 1 - s * 0.7, 1 - s * 0.75];
      };
      const tri = sit.tri;
      pohled.obarvi((t, k) => barva(hod[tri[3 * t + k]]), (t, k) => barva(hod[tri[3 * t + k]]), true);
      $('legenda').innerHTML = `<span class="grad"></span><span>${S.barveni === 'K' ? 'Gaussova K' : 'střední H'}: modrá = ${fmt(-m, 3)}, bílá = 0, červená = ${fmt(m, 3)}</span>`;
      return;
    }
    if (S.barveni === 'strany' && sit.hodnoty) {
      const h = sit.hodnoty, m = Math.max(...h.map(Math.abs)) || 1, tri = sit.tri;
      const barva = x => { const t = Math.max(-1, Math.min(1, x / m)); return t < 0 ? [1 + t * 0.85, 1 + t * 0.55, 1 + t * 0.1] : [1 - t * 0.05, 1 - t * 0.7, 1 - t * 0.75]; };
      pohled.obarvi((t, k) => barva(h[tri[3 * t + k]]), (t, k) => barva(h[tri[3 * t + k]]), true);
      $('legenda').innerHTML = `<span class="grad"></span><span>${esc(o.hodnotyText || '')}: modrá ${fmt(-m, 3)}, červená ${fmt(m, 3)}</span>`;
      return;
    }
    $('legenda').innerHTML = sit.barvy ? (o.legenda || '') : '<span class="vz" style="background:#4a8fd9"></span>líc <span class="vz" style="background:#ed8c33"></span>rub';
    if (sit.barvy) {
      const b = sit.barvy;
      pohled.obarvi(t => [b[3 * t], b[3 * t + 1], b[3 * t + 2]], t => [b[3 * t] * 0.8, b[3 * t + 1] * 0.8, b[3 * t + 2] * 0.8]);
      return;
    }
    // jemná šachovnice parametrů – ukazuje směr u a v
    let tmav = () => 1;
    if (sit.mriz) {
      const { nu, nv } = sit.mriz, ku = Math.max(1, Math.round(nu / 24)), kv = Math.max(1, Math.round(nv / 8));
      tmav = t => { const c = t >> 1, i = Math.floor(c / nv), j = c % nv; return (Math.floor(i / ku) + Math.floor(j / kv)) % 2 ? 0.86 : 1; };
    }
    pohled.obarvi(t => { const s = tmav(t); return [LIC[0] * s, LIC[1] * s, LIC[2] * s]; },
      t => { const s = tmav(t); return [RUB[0] * s, RUB[1] * s, RUB[2] * s]; });
  }

  function cary() {
    if (S.okraje && S.top && S.top.okraje) pohled.cary('okraje', N.okrajoveUsecky(S.sit, S.top), 0xffd23f, false);
    else pohled.cary('okraje', null);
    pohled.cary('pruniky', S.pruniky && S.usecky ? S.usecky : null, 0xe0245e, true);
    if (S.sit.krivky) pohled.cary('krivky', S.sit.krivky, 0x222222, false);
  }

  /* ---------- štítek, teorie ---------- */
  function ukazStitek() {
    const o = S.obj;
    const kod = o.stitekDyn ? o.stitekDyn(S.p, S.sit) : o.stitek;
    const st = N.STITKY[kod];
    const pozn = o.stitekPozn ? o.stitekPozn(S.p, S.sit) : '';
    const el = $('stitek');
    el.className = 'card stitek st-' + kod;
    el.innerHTML = `<div class="st-hlava"><span class="st-zn">${st.znak}</span><b>${esc(st.nazev)}</b></div>
      <div class="st-text">${esc(st.text)}</div>${pozn ? `<div class="st-pozn">${pozn}</div>` : ''}`;
    $('stitekP').innerHTML = `${st.znak} ${esc(st.nazev)}`;
    $('stitekP').className = 'stitek-plovouci st-' + kod;
  }

  function ukazTeorii() {
    const o = S.obj;
    $('teorieNadpis').textContent = o.nazev;
    $('teorieText').innerHTML = o.popis + (o.zdroje && o.zdroje.length
      ? `<div class="zdroje"><b>Zdroje:</b><ul>${o.zdroje.map(z => `<li>${esc(z)}</li>`).join('')}</ul></div>` : '');
  }

  /* ---------- vlastnosti: měřeno vs. teorie ---------- */
  function ukazVlastnosti() {
    const t = S.top, th = S.teorie || {}, sit = S.sit, o = S.obj;
    const rad = [];
    const ok = (a, b) => b === undefined || b === null ? '' : (a === b ? '<span class="ok">✔</span>' : '<span class="ne">✘</span>');
    const ano = x => x ? 'ano' : 'ne';
    if (t) {
      rad.push(['Eulerova charakteristika χ', t.chi, th.chi, ok(t.chi, th.chi), `V − E + F = ${t.V} − ${t.E} + ${t.F}`]);
      rad.push(['Orientovatelná', ano(t.orient), th.orient == null ? null : ano(th.orient), ok(t.orient, th.orient)]);
      rad.push(['Počet okrajových křivek', t.okraje, th.okraje, ok(t.okraje, th.okraje)]);
      if (th.rod != null || (t.rod != null && th.krizky == null)) rad.push(['Rod (počet „děr“)', t.rod == null ? '–' : t.rod, th.rod, ok(t.rod, th.rod)]);
      if (th.krizky != null) rad.push(['Počet křížků (neorientovatelný rod)', t.krizky == null ? '–' : t.krizky, th.krizky, ok(t.krizky, th.krizky)]);
      if (t.komponenty > 1 || th.komponenty != null) rad.push(['Komponenty', t.komponenty, th.komponenty, ok(t.komponenty, th.komponenty)]);
      if (t.nemanifold) rad.push(['Nevarietní hrany', t.nemanifold, 0, '<span class="ne">!</span>']);
    }
    if (!sit.bezMer) {
      const A = N.plochaSite(sit);
      rad.push(['Plocha', fmt(A, 6), th.plocha != null ? fmt(th.plocha, 6) : null, srovnej(A, th.plocha, th.tolPlocha)]);
      if (t) {
        const V = N.objemSite(sit, t);
        rad.push(['Objem', V == null ? (th.objemText || 'nemá smysl') : fmt(V, 6), th.objem != null ? fmt(th.objem, 6) : null, srovnej(V, th.objem, th.tolObjem),
          V == null ? 'Objem má smysl jen u uzavřené orientovatelné plochy bez okraje.' : 'Věta o divergenci: součet orientovaných čtyřstěnů.']);
      }
    }
    if (th.pruniky !== undefined) {
      const u = S.usecky;
      const mer = u == null ? '<span class="cekam">počítám…</span>' : (u.length ? `ano (${u.length / 6} úseček)` : 'žádné');
      const teo = th.pruniky == null ? null : ano(th.pruniky);
      rad.push(['Samoprůniky', mer, teo, u == null || th.pruniky == null ? '' : ok(!!u.length, th.pruniky),
        'Hledá se průnik každé dvojice trojúhelníků, které spolu nesousedí.']);
    }
    if (S.krivost && o.krivost) {
      const k = o.krivost(S.p), st = S.krivost;
      if (k.K != null) {
        const odch = Math.max(Math.abs(st.K.max - k.K), Math.abs(st.K.min - k.K));
        rad.push(['Gaussova křivost K', `${fmt(st.K.min, 4)} … ${fmt(st.K.max, 4)}`, fmt(k.K, 4), odch <= Math.abs(k.K) * 1e-3 + 1e-6 ? '<span class="ok">✔</span>' : '<span class="ne">✘</span>',
          `Z parametrizace (1. a 2. fundamentální forma) v ${st.n} bodech. Největší odchylka ${fmt(odch, 2)}.`]);
      }
      if (k.H != null) {
        rad.push(['Střední křivost |H|', `max ${fmt(st.absH.max, 3)}, průměr ${fmt(st.absH.prumer, 3)}`, fmt(k.H, 3), st.absH.max < 1e-4 * (o.krivostMeritko ? o.krivostMeritko(S.p) : 1) + 1e-5 ? '<span class="ok">✔</span>' : '<span class="ne">✘</span>',
          `Minimální plocha má H = 0 v každém bodě. Změřeno v ${st.n} bodech, derivace numericky.`]);
      }
    }
    if (o.cisla) for (const r of o.cisla(S.p, sit, t)) rad.push(r);
    rad.push(['Síť', `${(sit.poz.length / 3).toLocaleString('cs-CZ')} vrcholů, ${(sit.tri.length / 3).toLocaleString('cs-CZ')} trojúhelníků`, null, '']);
    $('vlastnosti').innerHTML = '<tr><th>Veličina</th><th>Změřeno</th><th>Teorie</th><th></th></tr>' +
      rad.map(([n, m, te, s, tip]) => `<tr${tip ? ` title="${esc(tip)}"` : ''}><td>${n}</td><td>${m}</td><td>${te == null ? '–' : te}</td><td>${s || ''}</td></tr>`).join('');
    $('vlastPozn').innerHTML = th.pozn ? esc(th.pozn) : '';
  }

  function srovnej(m, t, tol = 0.01) {
    if (m == null || t == null || !isFinite(t)) return '';
    const r = Math.abs(m - t) / Math.max(1e-12, Math.abs(t));
    return r <= tol ? `<span class="ok" title="odchylka ${fmt(r * 100, 2)} %">✔</span>` : `<span class="ne" title="odchylka ${fmt(r * 100, 2)} %">≈</span>`;
  }

  /* ---------- zobrazení ---------- */
  function ovladaniZobrazeni() {
    $('barveni').addEventListener('change', e => { S.barveni = e.target.value; zastavNastroje(); obarvi(); });
    $('pruhlednost').addEventListener('input', e => { S.pruhlednost = +e.target.value / 100; pohled.nastavPruhlednost(S.pruhlednost); });
    $('chkDrat').addEventListener('change', e => { S.drat = e.target.checked; pohled.dratovy(S.drat); });
    $('chkOkraje').addEventListener('change', e => { S.okraje = e.target.checked; cary(); });
    $('chkPruniky').addEventListener('change', e => { S.pruniky = e.target.checked; if (S.pruniky && !S.usecky && S.top) { S.usecky = N.samopruniky(S.sit); ukazVlastnosti(); } cary(); });
    $('rez').addEventListener('input', e => {
      const v = +e.target.value;
      if (v >= 100 || !pohled.obal) { S.rez = null; $('rezVal').textContent = 'vypnuto'; pohled.nastavRez(null); return; }
      const ob = pohled.obal, z = ob.mn[2] + (ob.mx[2] - ob.mn[2]) * v / 100;
      S.rez = z; $('rezVal').textContent = 'z ≤ ' + fmt(z, 3);
      pohled.nastavRez(z);
    });
    $('kvalita').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      S.kvalita = b.dataset.v;
      $('kvalita').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      obnov(false);
    });
    $('btnPrizpusob').addEventListener('click', () => pohled.prizpusob(true));
    $('btnProjekce').addEventListener('click', () => {
      pohled.ortograficka = !pohled.ortograficka;
      $('btnProjekce').textContent = pohled.ortograficka ? 'Ortografická' : 'Perspektiva';
      pohled.aktualizujKameru();
    });
    $('btnMalovat').addEventListener('click', () => {
      if (S.cekaNaKlik || S.malovani) { zastavNastroje(); obarvi(); return; }
      S.cekaNaKlik = true;
      $('btnMalovat').classList.add('on');
      zprava('Klepněte na plochu. Odtud se začne šířit barva po jedné straně.');
    });
    $('btnMravenec').addEventListener('click', mravenec);
    $('btnKouzlo').addEventListener('click', () => {
      const n = S.obj.kameraPocet || 1;
      // u více pohledů se přepíná dokola, jinak se vrací do jediného kouzelného pohledu
      S.kameraIdx = n > 1 ? ((S.kameraIdx || 0) + 1) % n : 0;
      const k = S.obj.kamera(S.p, S.kameraIdx);
      pohled.ortograficka = !!k.orto;
      $('btnProjekce').textContent = pohled.ortograficka ? 'Ortografická' : 'Perspektiva';
      pohled.animujNa({ az: k.az, el: k.el, vzd: k.vzd, cil: k.cil ? new THREE.Vector3(...k.cil) : null }, 1400);
    });
    $('btnExport').addEventListener('click', exportuj);
    $('btnPng').addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = pohled.png(); a.download = S.obj.id + '.png'; a.click();
    });
  }

  function ukazNastroje() {
    const o = S.obj, t = S.top;
    $('btnMalovat').style.display = t && !o.bezMalovani ? '' : 'none';
    $('btnMravenec').style.display = o.cesta && S.sit.f ? '' : 'none';
    $('btnKouzlo').style.display = o.kamera ? '' : 'none';
    $('btnKouzlo').textContent = o.kameraText || '✨ Kouzelný pohled';
    const maK = !!S.sit.f;
    for (const opt of $('barveni').options) if (opt.value === 'K' || opt.value === 'H') opt.disabled = !maK;
    if (!maK && (S.barveni === 'K' || S.barveni === 'H')) S.barveni = 'strany';
    $('barveni').value = S.barveni;
    $('radekPruniky').style.display = S.teorie && S.teorie.pruniky !== undefined ? '' : 'none';
    // tlačítka specifická pro objekt a přehrání animace parametru
    const box = $('objTlacitka');
    box.innerHTML = '';
    for (const t of o.tlacitka || []) {
      const b = document.createElement('button');
      b.className = 'btn'; b.textContent = t.text;
      b.addEventListener('click', () => t.akce(pohled, S.p, S.sit, { zprava, obnov }));
      box.appendChild(b);
    }
    if (o.animace) {
      const b = document.createElement('button');
      b.className = 'btn'; b.textContent = '▶ Přehrát'; b.id = 'btnAnimace';
      b.addEventListener('click', prehraj);
      box.appendChild(b);
    }
  }

  function prehraj() {
    const a = S.obj.animace, x = S.obj.parametry.find(q => q.id === a.param), t0 = performance.now();
    const stav = S.prehravani = { stop: false };
    let posl = -1;
    pohled.prubezne(ted => {
      if (stav.stop || S.prehravani !== stav) return false;
      const s = Math.min(1, (ted - t0) / a.ms);
      // tam a zpět
      const w = s < 0.5 ? s * 2 : 2 - s * 2;
      let v = a.od + (a.do - a.od) * w;
      v = Math.round(v / x.krok) * x.krok;
      if (v !== posl) { posl = v; S.p[a.param] = v; ukazParam(); obnov(false, true); }
      if (s >= 1) { S.prehravani = null; zapisHash(); return false; }
      return true;
    });
  }

  /* ---------- export ---------- */
  function nastavExport() {
    const t = S.top;
    // plocha s okrajem nebo neorientovatelná plocha není těleso – pro tisk se musí zesílit
    const plocha = !!t && (t.okraje > 0 || !t.orient);
    $('expZesil').checked = plocha;
    $('expInfo').innerHTML = plocha
      ? 'Tento tvar je plocha bez tloušťky. Pro tisk se zesílí: vzniknou dvě vrstvy ± t/2 podél normály a stěny podél okrajů.'
      : (t ? 'Tvar je uzavřený a orientovatelný, tiskne se jako plné těleso.' : 'Síť se exportuje tak, jak je.');
  }

  function exportuj() {
    let sit = S.sit;
    const m = Math.max(1e-6, +$('expMeritko').value || 1);
    const info = [];
    if ($('expZesil').checked && S.top) {
      sit = N.zesil(sit, (+$('expTloustka').value || 1) / m);
      const t = N.topologie(sit);
      info.push(t.okraje === 0 && t.orient && !t.nemanifold ? 'zesílené těleso je uzavřené a orientovatelné ✔' : `pozor: okraje ${t.okraje}, nevarietní hrany ${t.nemanifold}`);
      if (S.usecky && S.usecky.length) info.push('plocha protíná sama sebe – slicer průniky obvykle sloučí, ale vnitřek může být neúplný');
    }
    const jmeno = S.obj.id + ($('expZesil').checked ? '_zesil' : '');
    const blob = $('expFormat').value === 'obj' ? N.obj(sit, m, jmeno) : N.stl(sit, m, jmeno);
    N.stahni(blob, jmeno + '.' + $('expFormat').value);
    $('expInfo').innerHTML = `Staženo ${(sit.tri.length / 3).toLocaleString('cs-CZ')} trojúhelníků (${N.fmt(blob.size / 1024, 3)} kB). ` + info.join('; ') + '.';
  }

  function zprava(text) {
    const z = $('zprava');
    z.innerHTML = text;
    z.hidden = !text;
  }

  function zastavNastroje() {
    S.cekaNaKlik = false;
    S.malovani = null;
    if (S.mravenec) { S.mravenec.stop = true; S.mravenec = null; }
    if (pohled) { pohled.vrstva('mravenec', null); pohled.vrstva('mravenecK', null); pohled.zastavStul(); pohled.orientace(null); pohled.stul(null); pohled.deska(null); }
    const b = $('btnMalovat'); if (b) b.classList.remove('on');
    zprava('');
  }

  /* ---------- malování jedné strany ---------- */
  function klik(trefa) {
    if (!S.cekaNaKlik || !trefa) return;
    S.cekaNaKlik = false;
    const r = N.sireniStrany(S.sit, S.top, trefa.tri);
    S.malovani = { r, rub: trefa.rub, prah: 0, t0: performance.now() };
    const delka = Math.min(6000, 1500 + r.kroku * 25);
    zprava('Barva se šíří po jedné straně…');
    pohled.prubezne(ted => {
      const m = S.malovani;
      if (!m) return false;
      m.prah = Math.min(r.kroku, (ted - m.t0) / delka * r.kroku);
      obarviMalbu();
      if (m.prah >= r.kroku) {
        zprava(r.obeStrany
          ? '<b>Barva se dostala na rub místa, kde začala.</b> Plocha má jen <b>jednu stranu</b> (je neorientovatelná). Obarvila se celá z obou „stran“.'
          : '<b>Barva pokryla jen jednu stranu.</b> Druhá zůstala neobarvená: plocha je <b>oboustranná</b> (orientovatelná).');
        $('btnMalovat').classList.remove('on');
        return false;
      }
      return true;
    });
  }

  function obarviMalbu() {
    const m = S.malovani, k = m.r.krok, prah = m.prah;
    // klik na rub = začátek na rubu: strany se jen prohodí
    const iL = m.rub ? 1 : 0, iR = 1 - iL;
    const barva = (krok, puv) => (krok >= 0 && krok <= prah) ? MALBA : puv;
    pohled.obarvi(t => barva(k[2 * t + iL], SEDA), t => barva(k[2 * t + iR], [0.42, 0.43, 0.46]));
  }

  /* ---------- mravenec ---------- */
  function mravenec() {
    zastavNastroje();
    const o = S.obj, sit = S.sit, f = sit.f, [u0, u1] = sit.dom.u;
    const v = o.cesta.v;
    const n = 240, body = [], nor = [];
    const h = (u1 - u0) * 1e-5;
    for (let i = 0; i <= n; i++) {
      const u = u0 + (u1 - u0) * i / n;
      const fu = N.v.sub(f(u + h, v), f(u - h, v)), fv = N.v.sub(f(u, v + h), f(u, v - h));
      body.push(f(u, v)); nor.push(N.v.norm(N.v.cross(fu, fv)));
    }
    const d = pohled.obal.r * 0.18;
    const stav = S.mravenec = { stop: false, t0: performance.now() };
    zprava(`Mravenec jde ${o.cesta.popis} a nese šipku kolmou k ploše. Sleduje, jak se šipka natáčí.`);
    pohled.prubezne(ted => {
      if (stav.stop) return false;
      const s = Math.min(1, (ted - stav.t0) / 7000), i = Math.round(s * n);
      const vyb = [], vn = [];
      for (let k = 0; k <= i; k += 12) { vyb.push(body[k]); vn.push(nor[k]); }
      vyb.push(body[i]); vn.push(nor[i]);
      pohled.sipky('mravenec', vyb, vn, d, 0xd62828);
      pohled.koule('mravenecK', body[i], d * 0.18, 0x111111);
      if (s >= 1) {
        const dd = N.v.dot(nor[0], nor[n]);
        zprava(dd < 0
          ? '<b>Mravenec se vrátil na místo, odkud vyšel, ale šipka míří opačně.</b> Bez přelezení okraje se dostal „na druhou stranu“. Plocha je neorientovatelná.'
          : '<b>Mravenec se vrátil a šipka míří stejně jako na začátku.</b> Po této cestě se orientace nezměnila.');
        S.mravenec = null;
        return false;
      }
      return true;
    });
  }

  /* ---------- URL hash ---------- */
  function zapisParam() {
    const p = {};
    for (const x of S.obj.parametry) p[x.id] = S.p[x.id];
    return p;
  }
  function zapisHash() {
    const q = new URLSearchParams({ obj: S.obj.id });
    for (const [k, v] of Object.entries(zapisParam())) q.set(k, v);
    history.replaceState(null, '', '#' + q.toString());
  }
  function cteniHashe() {
    const q = new URLSearchParams(location.hash.slice(1));
    const obj = q.get('obj'), o = obj && N.objekt(obj), p = {};
    if (o) for (const x of o.parametry) if (q.has(x.id)) {
      const s = q.get(x.id);
      if (x.volby) { if (x.volby.some(v => v[0] === s)) p[x.id] = s; }
      else if (isFinite(+s)) p[x.id] = Math.max(x.min, Math.min(x.max, +s));
    }
    return { obj, p };
  }

  N.init = init;
})(NEM);
