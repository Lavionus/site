/* dalekohled/ukazy.js – úkazy a efemeridy: planety v noci, Galileovy měsíce (úkazy + diagram),
   Velká rudá skvrna, konjunkce Měsíce a planet, generátor efemerid s exportem CSV. */
(function () {
  'use strict';
  const APP = window.DALEK_APP, D = window.DALEK, K = window.DALEK_KAT, A = window.ASTRO;
  const $ = id => document.getElementById(id);
  const c1 = APP.c1, fmtCas = APP.fmtCas;
  const fmtDC = jd => A.dataZJd(jd).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });

  const panel = $('panel-ukazy');
  panel.innerHTML = `
    <div class="kalk">
      <div class="card" style="grid-column:1 / -1">
        <h2>Planety dnes v noci <small id="ukPlDatum"></small></h2>
        <div class="tab-obal"><table class="tab" id="ukPlanety"></table></div>
      </div>
      <div class="card">
        <h2>Galileovy měsíce Jupiteru</h2>
        <div class="r2">
          <div><label for="ukJDny" style="margin-top:0">Období</label><select id="ukJDny"><option value="1">tato noc</option><option value="3">3 dny</option><option value="7">7 dní</option></select></div>
          <div><label for="ukGrs" style="margin-top:0">Délka rudé skvrny (Systém II)</label><input id="ukGrs" type="number" min="0" max="360" step="1"></div>
        </div>
        <label class="chk"><input type="checkbox" id="ukJenVid" checked> jen úkazy, kdy je Jupiter nad obzorem a je tma</label>
        <div class="tab-obal" style="max-height:340px;margin-top:6px"><table class="tab" id="ukJupiter"></table></div>
        <div class="info">Přesnost polohy měsíců (Meeus, kap. 44) je několik minut. Délka Velké rudé skvrny se pomalu mění (driftuje) – aktuální hodnotu najdete např. v pozorováních JUPOS/ALPO.</div>
      </div>
      <div class="card">
        <h2>Diagram měsíců <small>čas dolů, západ vpravo jako pouhým okem</small></h2>
        <canvas id="ukDiagram" style="width:100%;height:420px;display:block;border-radius:6px;background:#0d1424"></canvas>
        <div class="legenda"><span><i style="background:#ffd27a"></i>Io</span><span><i style="background:#7ec8ff"></i>Europa</span><span><i style="background:#9bffb0"></i>Ganymedes</span><span><i style="background:#ff9a9a"></i>Callisto</span></div>
      </div>
      <div class="card">
        <h2>Konjunkce a přiblížení <small>následujících 30 dní</small></h2>
        <div class="tab-obal" style="max-height:340px"><table class="tab" id="ukKonj"></table></div>
        <div class="info">Měsíc a planety blíž než 5°, mezi sebou blíž než 3°; Měsíc u jasných hvězd a Plejád blíž než 2°. Topocentricky pro zvolené místo.</div>
      </div>
      <div class="card">
        <h2>Efemeridy objektu</h2>
        <div class="info" style="margin-top:0">Pro objekt vybraný v kartě vpravo: <b id="ukEfObjekt">–</b></div>
        <div class="r3">
          <div><label for="ukEfZac">Od</label><input id="ukEfZac" type="datetime-local"></div>
          <div><label for="ukEfKrok">Krok</label><select id="ukEfKrok"><option value="0.0104166667">15 min</option><option value="0.0416666667" selected>1 h</option><option value="0.25">6 h</option><option value="1">1 den</option><option value="7">7 dní</option></select></div>
          <div><label for="ukEfPocet">Řádků</label><input id="ukEfPocet" type="number" min="1" max="500" value="24"></div>
        </div>
        <div class="tlacitka"><button class="btn" id="ukEfSpocti">Spočítat</button><button class="btn btn-sec" id="ukEfCsv">⬇ CSV</button></div>
        <div class="tab-obal" style="max-height:340px;margin-top:8px"><table class="tab" id="ukEf"></table></div>
      </div>
    </div>`;

  const BARVY_M = { Io: '#ffd27a', Europa: '#7ec8ff', Ganymedes: '#9bffb0', Callisto: '#ff9a9a' };

  function okno() {
    const pl = window.DALEK_PLANOVAC && window.DALEK_PLANOVAC.vysledek();
    if (pl) return { zac: pl.noc.zapad || pl.zac, kon: pl.noc.vychod || pl.kon };
    const jd = APP.jdTed(), m = APP.misto();
    const n = D.noc(D.poledne(jd, m), m);
    return { zac: n.zapad || jd, kon: n.vychod || jd + 0.5 };
  }

  function planety() {
    const { zac, kon } = okno();
    const m = APP.misto(), stred = (zac + kon) / 2;
    $('ukPlDatum').textContent = A.dataZJd(zac).toLocaleDateString('cs-CZ') + ' → ' + A.dataZJd(kon).toLocaleDateString('cs-CZ');
    const tab = $('ukPlanety'); tab.innerHTML = '';
    const th = tab.createTHead().insertRow();
    for (const n of ['Těleso', 'Souhv.', 'mag', 'Průměr', 'Fáze', 'Elongace', 'Východ', 'Kulminace', 'Max. výška', 'Západ', 'Nejlépe v noci', 'Poznámka']) { const c = document.createElement('th'); c.textContent = n; th.appendChild(c); }
    const tb = tab.createTBody();
    const sl = D.teleso('slunce', stred, m);
    for (const k of D.KLICE_TELES) {
      const t = D.teleso(k, stred, m);
      const vz = D.prechody(j => D.teleso(k, j, m).obzor.alt, stred, k === 'mesic' ? 0.125 : -0.5667);
      // nejlepší výška během tmy (Slunce pod −6°)
      let best = null;
      for (let j = zac; j <= kon; j += 1 / 48) {
        if (D.teleso('slunce', j, m).obzor.alt > -6) continue;
        const a = D.teleso(k, j, m).obzor.alt;
        if (!best || a > best[1]) best = [j, a];
      }
      const el = D.uhel(t.v, sl.v);
      const tr = tb.insertRow();
      tr.insertCell().innerHTML = `<b>${t.jmeno}</b>`;
      tr.insertCell().textContent = D.souhvezdi(t.v);
      tr.insertCell().textContent = K.fmtMag(t.mag);
      tr.insertCell().textContent = K.fmtUhel(2 * t.rUhel);
      tr.insertCell().textContent = Math.round(t.k * 100) + ' %';
      tr.insertCell().textContent = Math.round(el) + '° ' + (((D.raDec(t.v).ra - D.raDec(sl.v).ra + 540) % 360 - 180) > 0 ? 'V' : 'Z');
      tr.insertCell().textContent = fmtCas(vz.vychod);
      tr.insertCell().textContent = fmtCas(vz.kulminace);
      tr.insertCell().textContent = Math.round(vz.maxVyska) + '°';
      tr.insertCell().textContent = fmtCas(vz.zapad);
      tr.insertCell().textContent = best && best[1] > 0 ? `${fmtCas(best[0])} (${Math.round(best[1])}°)` : 'za tmy pod obzorem';
      const p = [];
      if (el < 15 && k !== 'mesic') p.push('blízko Slunce – nepozorovatelná');
      if (k === 'saturn') p.push('prstence B = ' + c1(t.B) + '°');
      if (k === 'mars') p.push('CM ' + Math.round((360 - t.cm) % 360) + '°');
      if (k === 'jupiter') p.push('CM II ' + Math.round((360 - t.cm) % 360) + '°');
      if (k === 'venuse' || k === 'merkur') p.push(t.k < 0.5 ? 'srpek' : 'gibbózní fáze');
      if (k === 'mesic') { const im = D.infoMesice(stred, m); p.push(`stáří ${c1(im.stari)} d, kolong. ${Math.round(im.kolongituda)}°`); }
      tr.insertCell().textContent = p.join(', ');
      tr.addEventListener('click', () => APP.vyber('p:' + k, true));
    }
  }

  function jupiter() {
    const dny = +$('ukJDny').value;
    const { zac, kon } = okno();
    const m = APP.misto();
    const j0 = dny === 1 ? zac : zac, j1 = dny === 1 ? kon : zac + dny;
    const ukazy = D.ukazyJupiteru(j0, j1, m, dny > 3 ? 4 / 1440 : 2 / 1440);
    const grs = D.pruchodyGRS(j0, j1, APP.S.grs, m).map(jd => ({ jd, mesic: 'Rudá skvrna', popis: 'průchod centrálním poledníkem', grs: true }));
    const vse = ukazy.concat(grs).sort((a, b) => a.jd - b.jd);
    const jen = $('ukJenVid').checked;
    const tab = $('ukJupiter'); tab.innerHTML = '';
    const th = tab.createTHead().insertRow();
    for (const n of ['Čas', 'Měsíc', 'Úkaz', 'Jupiter', 'Slunce']) { const c = document.createElement('th'); c.textContent = n; th.appendChild(c); }
    const tb = tab.createTBody();
    let n = 0;
    for (const u of vse) {
      const aj = D.teleso('jupiter', u.jd, m).obzor.alt, as = D.teleso('slunce', u.jd, m).obzor.alt;
      const viditelny = aj > 5 && as < -6;
      if (jen && !viditelny) continue;
      n++;
      const tr = tb.insertRow();
      tr.insertCell().textContent = fmtDC(u.jd);
      const mc = tr.insertCell(); mc.innerHTML = `<b style="color:${BARVY_M[u.mesic] || '#ff8a6a'}">${u.mesic}</b>`;
      tr.insertCell().textContent = u.popis;
      tr.insertCell().textContent = Math.round(aj) + '°';
      tr.insertCell().textContent = Math.round(as) + '°';
      tr.title = 'Nastavit čas a namířit na Jupiter';
      tr.addEventListener('click', () => { APP.nastavJd(u.jd - 2 / 1440); APP.vyber('p:jupiter', true); });
    }
    if (!n) tb.insertRow().insertCell().textContent = 'V tomto období nejsou žádné viditelné úkazy.';
    diagram(j0, j1);
  }

  function diagram(j0, j1) {
    const cvd = $('ukDiagram');
    const r = cvd.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    cvd.width = Math.max(200, Math.round(r.width * dpr)); cvd.height = Math.round(420 * dpr);
    const ctx = cvd.getContext('2d'), W = cvd.width, H = cvd.height;
    ctx.fillStyle = '#0d1424'; ctx.fillRect(0, 0, W, H);
    const m = APP.misto();
    const T = 14 * dpr, B = 8 * dpr, L = 52 * dpr;
    const sir = (W - L - 10 * dpr) / 2, cx = L + sir;
    const sk = sir / 28;            // px na poloměr Jupiteru
    const Y = j => T + (j - j0) / (j1 - j0) * (H - T - B);
    // pás Jupiteru
    ctx.fillStyle = 'rgba(255,230,190,0.25)'; ctx.fillRect(cx - sk, T, 2 * sk, H - T - B);
    ctx.font = `${10 * dpr}px system-ui, sans-serif`; ctx.fillStyle = 'rgba(220,225,235,0.8)';
    const krokH = (j1 - j0) > 2 ? 12 : (j1 - j0) > 1 ? 3 : 1;
    const h0 = Math.ceil((j0 - 2440587.5) * 24 / krokH) * krokH / 24 + 2440587.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = dpr;
    for (let j = h0; j < j1; j += krokH / 24) {
      ctx.beginPath(); ctx.moveTo(L, Y(j)); ctx.lineTo(W, Y(j)); ctx.stroke();
      const d = A.dataZJd(j);
      ctx.fillText((krokH >= 12 ? d.getDate() + '.' + (d.getMonth() + 1) + '. ' : '') + d.getHours() + 'h', 4 * dpr, Y(j) + 3 * dpr);
    }
    // denní úseky ztmavit
    const N = 300;
    const stavy = [];
    for (let i = 0; i <= N; i++) {
      const j = j0 + (j1 - j0) * i / N;
      const t = D.teleso('jupiter', j, m);
      stavy.push({ j, ms: D.mesiceJupiteru(t), den: D.teleso('slunce', j, m).obzor.alt > -6 || t.obzor.alt < 0 });
    }
    for (let i = 0; i < N; i++) if (stavy[i].den) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(L, Y(stavy[i].j), W - L, Y(stavy[i + 1].j) - Y(stavy[i].j) + 1); }
    for (let mi = 0; mi < 4; mi++) {
      const jm = stavy[0].ms[mi].jmeno;
      ctx.strokeStyle = BARVY_M[jm]; ctx.lineWidth = 1.6 * dpr;
      ctx.beginPath(); let prvni = true;
      for (const s of stavy) {
        const x = s.ms[mi];
        if (x.zakryt || x.zatmeni) { prvni = true; continue; }
        const X = cx + x.x * sk, Yy = Y(s.j);
        if (prvni) ctx.moveTo(X, Yy); else ctx.lineTo(X, Yy);
        prvni = false;
      }
      ctx.stroke();
    }
    // aktuální čas
    const jt = APP.jdTed();
    if (jt > j0 && jt < j1) { ctx.strokeStyle = '#ff5050'; ctx.beginPath(); ctx.moveTo(L, Y(jt)); ctx.lineTo(W, Y(jt)); ctx.stroke(); }
    ctx.fillStyle = 'rgba(220,225,235,0.8)'; ctx.fillText('V', L + 2 * dpr, T - 3 * dpr); ctx.fillText('Z', W - 14 * dpr, T - 3 * dpr);
  }

  function konjunkce() {
    const m = APP.misto(), j0 = APP.jdTed(), j1 = j0 + 30;
    const tela = D.KLICE_TELES.filter(k => k !== 'neptun' && k !== 'uran');
    const DATA = window.DALEK_DATA;
    const hvezdy = [['Aldebaran', 'h:'], ['Regulus'], ['Spika'], ['Antares'], ['Pollux'], ['Kastor']].map(([jm]) => {
      const i = Object.keys(DATA.JMENA).find(k => DATA.JMENA[k] === jm);
      return i ? { jmeno: jm, v: D.v3(DATA.H[i * 4], DATA.H[i * 4 + 1]), id: 'h:' + i } : null;
    }).filter(Boolean);
    const m45 = K.objekt('d:M45'); if (m45) hvezdy.push({ jmeno: 'Plejády', v: m45.v, id: 'd:M45' });
    const krok = 1 / 24;
    const polohy = [];
    for (let j = j0; j <= j1; j += krok) polohy.push({ j, v: Object.fromEntries(tela.map(k => [k, D.teleso(k, j, m).v])) });
    const out = [];
    const minima = (fce, mez, popis, ids) => {
      for (let i = 1; i < polohy.length - 1; i++) {
        const a = fce(polohy[i - 1]), b = fce(polohy[i]), c = fce(polohy[i + 1]);
        if (b <= a && b < c && b < mez) out.push({ jd: polohy[i].j, sep: b, popis, ids });
      }
    };
    for (let x = 0; x < tela.length; x++) for (let y = x + 1; y < tela.length; y++) {
      const a = tela[x], b = tela[y];
      const mez = a === 'mesic' || b === 'mesic' ? 5 : 3;
      minima(p => D.uhel(p.v[a], p.v[b]), mez, `${D.TELESA[a].jmeno} – ${D.TELESA[b].jmeno}`, ['p:' + a, 'p:' + b]);
    }
    for (const h of hvezdy) minima(p => D.uhel(p.v.mesic, h.v), 2, `Měsíc – ${h.jmeno}`, ['p:mesic', h.id]);
    for (const k of ['venuse', 'mars', 'jupiter', 'saturn']) for (const h of hvezdy) minima(p => D.uhel(p.v[k], h.v), 2, `${D.TELESA[k].jmeno} – ${h.jmeno}`, ['p:' + k, h.id]);
    out.sort((a, b) => a.jd - b.jd);
    const tab = $('ukKonj'); tab.innerHTML = '';
    const th = tab.createTHead().insertRow();
    for (const n of ['Datum', 'Úkaz', 'Vzdálenost', 'Elong. od Slunce']) { const c = document.createElement('th'); c.textContent = n; th.appendChild(c); }
    const tb = tab.createTBody();
    for (const u of out) {
      const tr = tb.insertRow();
      const sl = D.teleso('slunce', u.jd, m);
      const v0 = K.smer(u.ids[0], u.jd, m);
      tr.insertCell().textContent = fmtDC(u.jd);
      tr.insertCell().textContent = u.popis;
      tr.insertCell().textContent = K.fmtUhel(u.sep * 3600);
      tr.insertCell().textContent = Math.round(D.uhel(v0, sl.v)) + '°';
      tr.addEventListener('click', () => { APP.nastavJd(u.jd); APP.vyber(u.ids[0], true); });
    }
    if (!out.length) tb.insertRow().insertCell().textContent = 'V příštích 30 dnech žádná těsná přiblížení.';
  }

  /* ---------- efemeridy ---------- */
  let efRadky = [];
  function efemeridy() {
    const id = APP.S.cil;
    const ob = id && K.objekt(id);
    $('ukEfObjekt').textContent = ob ? ob.nazev : '– (vyberte objekt)';
    const tab = $('ukEf'); tab.innerHTML = '';
    if (!ob) return;
    const d = new Date($('ukEfZac').value);
    const jdZ = isNaN(d) ? APP.jdTed() : A.jdZData(d);
    const krok = +$('ukEfKrok').value, n = Math.max(1, Math.min(500, +$('ukEfPocet').value || 24));
    const m = APP.misto();
    const th = tab.createTHead().insertRow();
    const hl = ['Datum a čas', 'α (datum)', 'δ (datum)', 'Výška', 'Azimut', 'Vzd. hmota'];
    if (ob.druh === 'p') hl.push('mag', 'Průměr', 'Fáze', 'Vzdálenost');
    for (const h of hl) { const c = document.createElement('th'); c.textContent = h; th.appendChild(c); }
    const tb = tab.createTBody();
    efRadky = [hl];
    for (let i = 0; i < n; i++) {
      const jd = jdZ + i * krok;
      const prec = D.precese(A.utNaJde(jd));
      const v = K.smer(id, jd, m);
      const rd = D.raDec(D.mxv(prec, v));
      const o = D.naObzor(v, jd, m, prec);
      const r = [A.dataZJd(jd).toLocaleString('cs-CZ'), K.fmtRa(rd.ra), K.fmtDec(rd.dec), c1(o.alt), c1(o.az), o.alt > 0 ? c1(D.vzdusnaHmota(o.alt), 2) : '–'];
      if (ob.druh === 'p') { const t = D.teleso(ob.klic, jd, m, prec); r.push(K.fmtMag(t.mag), K.fmtUhel(2 * t.rUhel), Math.round(t.k * 100) + ' %', ob.klic === 'mesic' ? Math.round(t.D * D.AU) + ' km' : c1(t.D, 4) + ' au'); }
      efRadky.push(r);
      const tr = tb.insertRow();
      for (const x of r) tr.insertCell().textContent = x;
    }
  }
  $('ukEfSpocti').addEventListener('click', efemeridy);
  $('ukEfCsv').addEventListener('click', () => {
    if (efRadky.length < 2) efemeridy();
    const b = new Blob(['﻿' + efRadky.map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(';')).join('\r\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'efemeridy.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });

  let zastarale = true;
  function obnov() {
    if (panel.hidden) { zastarale = true; return; }
    zastarale = false;
    $('ukGrs').value = APP.S.grs;
    if (!$('ukEfZac').value) { const d = A.dataZJd(APP.jdTed()); const p = n => String(n).padStart(2, '0'); $('ukEfZac').value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`; }
    planety();
    jupiter();
    setTimeout(konjunkce, 30);
    efemeridy();
  }
  $('ukJDny').addEventListener('change', jupiter);
  $('ukJenVid').addEventListener('change', jupiter);
  $('ukGrs').addEventListener('change', e => { const v = +e.target.value; if (v >= 0 && v <= 360) { APP.S.grs = v; APP.uloz(); jupiter(); } });
  APP.naZmenu(obnov);
  APP.naZalozku(p => { if (p === 'ukazy' && zastarale) obnov(); });
  APP.naCil(() => { if (!panel.hidden) efemeridy(); });
  window.DALEK_UKAZY = { obnov };
})();
