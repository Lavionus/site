/* Tepelné ztráty a skladby konstrukcí – rozhraní (jádro: jadro.js = window.TZJ) */
(function () {
'use strict';
const J = window.TZJ;
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const f = J.fmt;
const vstupCislo = v => String(v).replace('.', ',');
if (window.self === window.top) document.body.classList.add('samostatne');

const KP = J.KLIC + '_projekty', KA = J.KLIC + '_aktivni', KV = J.KLIC + '_pohled';
const BARVY = { 'Omítky a desky': '#c9b38f', 'Zdivo': '#c4694f', 'Beton a potěry': '#9aa0a6', 'Tepelné izolace': '#f2cf3d', 'Dřevo a desky': '#b5834a', 'Fólie a hydroizolace': '#4f7bd9', 'Vlastní': '#9b78d4' };
const TB = [[0, 'bez přirážky (mosty spočteny zvlášť)'], [0.02, '0,02 – optimalizované detaily (pasivní dům)'], [0.05, '0,05 – pečlivě navržené detaily'], [0.1, '0,10 – běžné detaily'], [0.2, '0,20 – výrazné mosty (starší stavby)']];

/* ---------- data ---------- */
let projekty = {};
try { const o = JSON.parse(localStorage.getItem(KP)); if (o && typeof o === 'object') for (const k in o) projekty[k] = J.projektN(o[k]); } catch (e) { projekty = {}; }
let P = null;
try { P = projekty[localStorage.getItem(KA)] || null; } catch (e) {}
if (!P) P = Object.values(projekty)[0] || null;
if (!P) { P = J.vzorovyProjekt(); projekty[P.id] = P; }
const ui = { pohled: 'skladby', skladba: '', mesic: 'navrh', hledat: '' };
try { ui.pohled = localStorage.getItem(KV) || 'skladby'; } catch (e) {}

function ulozVse() {
  P.upraveno = new Date().toISOString();
  projekty[P.id] = P;
  try { localStorage.setItem(KP, JSON.stringify(projekty)); localStorage.setItem(KA, P.id); }
  catch (e) { Dialog.chyba('Projekt se nepodařilo uložit (plné úložiště?). Zálohujte ho exportem JSON.'); }
}
const mapa = () => J.mapaMaterialu(P);
function aktSkladba() {
  let s = P.skladby.find(x => x.id === ui.skladba);
  if (!s) { s = P.skladby[0] || null; ui.skladba = s ? s.id : ''; }
  return s;
}
function nastav(cesta, hodnota) {
  const k = cesta.split('.'), posl = k.pop();
  const o = k.reduce((a, x) => a == null ? a : a[x], P);
  if (o == null) return;
  o[posl] = typeof o[posl] === 'number' ? J.cislo(hodnota, o[posl]) : hodnota;
}
const ti = () => J.cislo(P.kondenzace.ti, 21);
const te = () => J.cislo(P.lokalita.te, -12);

/* ---------- pomocné HTML ---------- */
const pole = (popis, cesta, hodnota, attr = '') => `<label class="pole"><span>${popis}</span><input class="vstup cis" data-cesta="${cesta}" value="${esc(vstupCislo(hodnota))}" inputmode="decimal" ${attr}></label>`;
function volby(seznam, akt) { return seznam.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(akt) ? ' selected' : ''}>${esc(t)}</option>`).join(''); }
function volbyMaterialu(akt, prazdna) {
  const m = mapa(), skup = {};
  Object.values(m).forEach(x => { (skup[x.kat] = skup[x.kat] || []).push(x); });
  return (prazdna ? `<option value="">${prazdna}</option>` : '') + Object.entries(skup).map(([kat, xs]) =>
    `<optgroup label="${esc(kat)}">${xs.map(x => `<option value="${esc(x.id)}"${x.id === akt ? ' selected' : ''}>${esc(x.nazev)} (λ ${f(x.lam, 3)})</option>`).join('')}</optgroup>`).join('') +
    (akt && !m[akt] ? `<option value="${esc(akt)}" selected>⚠️ chybějící materiál</option>` : '');
}
const znacka = (ok, text) => `<span class="znacka ${ok ? 'ok' : 'bad'}">${ok ? '✓' : '✗'} ${text}</span>`;
const zdrojText = z => J.ZDROJE[z] || z || '';

/* ---------- grafy (SVG) ---------- */
function grafProfil(st, vr, ti_, te_) {
  const W = 660, L = 50, R = 46, t1 = 22, h1 = 120, t2 = 186, h2 = 120, H = t2 + h2 + 46;
  const n = vr.length, D = st.x[n] || 1, min = D * 0.035;
  const w = vr.map(v => Math.max(v.d, min)), Ws = w.reduce((a, b) => a + b, 0) || 1;
  const pw = W - L - R, air = pw * 0.09, kw = pw - 2 * air;
  const X = [L + air]; w.forEach(x => X.push(X[X.length - 1] + x / Ws * kw));
  const tmax = Math.max(ti_, ...st.theta), tmin = Math.min(te_, ...st.theta);
  const yT = t => t1 + h1 * (tmax - t) / ((tmax - tmin) || 1);
  const psI = J.psat(ti_);
  const pmax = Math.max(psI, st.pi, ...st.ps) * 1.05;
  const yP = p => t2 + h2 * (1 - p / pmax);
  let s = `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Průběh teploty a tlaku vodní páry v konstrukci">`;
  vr.forEach((v, i) => {
    const barva = BARVY[v.m.kat] || BARVY['Vlastní'];
    s += `<rect x="${X[i]}" y="${t1}" width="${X[i + 1] - X[i]}" height="${t2 + h2 - t1}" fill="${barva}" fill-opacity=".35" stroke="var(--border-strong)" stroke-width=".6"/>`;
    s += `<text x="${(X[i] + X[i + 1]) / 2}" y="${t1 - 6}" text-anchor="middle">${i + 1}</text>`;
  });
  // osy a popisy
  s += `<line class="osa" x1="${L}" y1="${t1}" x2="${L}" y2="${t1 + h1}"/><line class="osa" x1="${L}" y1="${t2}" x2="${L}" y2="${t2 + h2}"/><line class="osa" x1="${L}" y1="${t2 + h2}" x2="${W - R}" y2="${t2 + h2}"/>`;
  if (tmin < 0 && tmax > 0) s += `<line class="mriz" x1="${L}" y1="${yT(0)}" x2="${W - R}" y2="${yT(0)}"/><text x="${L - 4}" y="${yT(0) + 4}" text-anchor="end">0</text>`;
  s += `<text x="${L - 4}" y="${yT(tmax) + 4}" text-anchor="end">${f(tmax, 0)}</text><text x="${L - 4}" y="${yT(tmin) + 4}" text-anchor="end">${f(tmin, 0)}</text>`;
  s += `<text x="${L - 4}" y="${t2 + 4}" text-anchor="end">${f(pmax / 1000, 1)}</text><text x="${L - 4}" y="${t2 + h2 + 4}" text-anchor="end">0</text>`;
  s += `<text x="4" y="${t1 + h1 / 2}" transform="rotate(-90 12 ${t1 + h1 / 2})" text-anchor="middle">θ [°C]</text>`;
  s += `<text x="4" y="${t2 + h2 / 2}" transform="rotate(-90 12 ${t2 + h2 / 2})" text-anchor="middle">p [kPa]</text>`;
  s += `<text x="${L + air / 2}" y="${t2 + h2 + 16}" text-anchor="middle">interiér</text><text x="${W - R - air / 2}" y="${t2 + h2 + 16}" text-anchor="middle">exteriér</text>`;
  // teplota
  const bodyT = [[L, ti_]].concat(st.theta.map((t, j) => [X[j], t]), [[W - R, te_]]);
  s += `<polyline fill="none" stroke="var(--danger)" stroke-width="2" points="${bodyT.map(([x, t]) => x.toFixed(1) + ',' + yT(t).toFixed(1)).join(' ')}"/>`;
  s += `<text x="${X[0] + 4}" y="${yT(st.theta[0]) + 14}" style="fill:var(--danger)">${f(st.theta[0], 1)} °C</text>`;
  s += `<text x="${X[n] - 4}" y="${yT(st.theta[n]) - 6}" text-anchor="end" style="fill:var(--danger)">${f(st.theta[n], 1)} °C</text>`;
  // nasycený tlak (vzorkovaný uvnitř vrstev), tlak bez kondenzace a s kondenzací
  const ps = [];
  for (let i = 0; i < n; i++) for (let k = 0; k <= 8; k++) { const t = st.theta[i] + (st.theta[i + 1] - st.theta[i]) * k / 8; ps.push([X[i] + (X[i + 1] - X[i]) * k / 8, J.psat(t)]); }
  s += `<polyline fill="none" stroke="var(--accent)" stroke-width="2" points="${ps.map(([x, p]) => x.toFixed(1) + ',' + yP(p).toFixed(1)).join(' ')}"/>`;
  const cara = (arr, attr) => `<polyline fill="none" ${attr} points="${[[L, st.pi]].concat(arr.map((p, j) => [X[j], p]), [[W - R, st.pe]]).map(([x, p]) => x.toFixed(1) + ',' + yP(p).toFixed(1)).join(' ')}"/>`;
  if (st.kondenzace) s += cara(st.p0, 'stroke="var(--text-faint)" stroke-width="1.3" stroke-dasharray="5 4"');
  s += cara(st.p, 'stroke="var(--ok)" stroke-width="2"');
  st.g.forEach((g, j) => { if (g > 1e-14) s += `<circle cx="${X[j]}" cy="${yP(st.p[j])}" r="5" fill="var(--danger)"/>`; else if (g < -1e-14) s += `<circle cx="${X[j]}" cy="${yP(st.p[j])}" r="5" fill="none" stroke="var(--warn)" stroke-width="2"/>`; });
  // legenda
  const lg = [['var(--danger)', 'teplota θ'], ['var(--accent)', 'nasycený tlak p_sat'], ['var(--ok)', 'tlak vodní páry p']];
  if (st.kondenzace) lg.push(['var(--text-faint)', 'p bez kondenzace']);
  let lx = L;
  lg.forEach(([b, t]) => { s += `<rect x="${lx}" y="${H - 12}" width="14" height="3" fill="${b}"/><text x="${lx + 18}" y="${H - 8}">${t}</text>`; lx += 30 + t.length * 6; });
  if (st.g.some(g => g > 1e-14)) s += `<circle cx="${lx + 4}" cy="${H - 11}" r="4" fill="var(--danger)"/><text x="${lx + 12}" y="${H - 8}">kondenzace</text>`;
  return s + '</svg>';
}

function grafMesice(b) {
  const W = 660, H = 190, L = 50, R = 14, T = 16, B = 34, pw = W - L - R, ph = H - T - B;
  const vals = b.mesice.map(m => m ? m.M : 0), max = Math.max(...vals, 0.001);
  const bw = pw / 12;
  let s = `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Nahromaděná zkondenzovaná voda po měsících">`;
  s += `<line class="osa" x1="${L}" y1="${T + ph}" x2="${W - R}" y2="${T + ph}"/><line class="osa" x1="${L}" y1="${T}" x2="${L}" y2="${T + ph}"/>`;
  s += `<text x="${L - 4}" y="${T + 4}" text-anchor="end">${f(max * 1000, 0)}</text><text x="${L - 4}" y="${T + ph + 4}" text-anchor="end">0</text>`;
  s += `<text x="4" y="${T + ph / 2}" transform="rotate(-90 12 ${T + ph / 2})" text-anchor="middle">g/m²</text>`;
  vals.forEach((v, i) => {
    const h = v / max * ph;
    s += `<rect x="${L + i * bw + 3}" y="${T + ph - h}" width="${bw - 6}" height="${h}" fill="var(--accent)" fill-opacity=".75"/>`;
    s += `<text x="${L + i * bw + bw / 2}" y="${H - 14}" text-anchor="middle">${J.MESICE[i].slice(0, 3)}</text>`;
  });
  return s + '</svg>';
}

function grafZdroj(z, te_) {
  const W = 660, H = 260, L = 50, R = 14, T = 14, B = 36, pw = W - L - R, ph = H - T - B;
  const xmin = Math.floor(te_ - 3), xmax = 20;
  const ymaxRaw = Math.max(z.zatez(xmin) * z.kBlok, z.tc ? z.tc(xmax) : 0, z.tc ? z.tc(xmin) : 0, 1) * 1.1;
  const krok = ymaxRaw > 20 ? 5 : ymaxRaw > 8 ? 2 : 1, ymax = Math.ceil(ymaxRaw / krok) * krok;
  const X = t => L + pw * (t - xmin) / (xmax - xmin), Y = p => T + ph * (1 - p / ymax);
  let s = `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Zatěžovací přímka a výkon tepelného čerpadla">`;
  for (let p = 0; p <= ymax + 1e-9; p += krok) s += `<line class="mriz" x1="${L}" y1="${Y(p)}" x2="${W - R}" y2="${Y(p)}"/><text x="${L - 4}" y="${Y(p) + 4}" text-anchor="end">${p}</text>`;
  for (let t = Math.ceil(xmin / 5) * 5; t <= xmax; t += 5) s += `<line class="mriz" x1="${X(t)}" y1="${T}" x2="${X(t)}" y2="${T + ph}"/><text x="${X(t)}" y="${T + ph + 14}" text-anchor="middle">${f(t, 0)}</text>`;
  s += `<text x="${L + pw / 2}" y="${H - 4}" text-anchor="middle">venkovní teplota [°C]</text><text x="4" y="${T + ph / 2}" transform="rotate(-90 12 ${T + ph / 2})" text-anchor="middle">výkon [kW]</text>`;
  s += `<line stroke="var(--danger)" stroke-width="2.2" x1="${X(xmin)}" y1="${Y(z.zatez(xmin) * z.kBlok)}" x2="${X(xmax)}" y2="${Y(z.zatez(xmax) * z.kBlok)}"/>`;
  s += `<line stroke="var(--danger)" stroke-width="1" stroke-dasharray="3 3" x1="${X(te_)}" y1="${T}" x2="${X(te_)}" y2="${T + ph}"/><text x="${X(te_) + 4}" y="${T + 12}" style="fill:var(--danger)">θe ${f(te_, 0)} °C</text>`;
  if (z.tc) {
    s += `<line stroke="var(--ok)" stroke-width="2.2" x1="${X(xmin)}" y1="${Y(z.tc(xmin))}" x2="${X(xmax)}" y2="${Y(z.tc(xmax))}"/>`;
    if (z.bivalence != null) s += `<circle cx="${X(z.bivalence)}" cy="${Y(z.tc(z.bivalence))}" r="5" fill="var(--warn)"/><text x="${X(z.bivalence) + 8}" y="${Y(z.tc(z.bivalence)) - 8}" style="fill:var(--warn)">bod bivalence ${f(z.bivalence, 1)} °C</text>`;
  }
  return s + '</svg>';
}

/* ---------- pohled: skladby ---------- */
function stavNavrh(s, r) {
  const k = P.kondenzace, te_ = te(), pe = J.cislo(k.phie, 84) / 100 * J.psat(te_);
  return J.stav(r.vrstvy, r.Rsi, r.Rse, ti(), te_, J.vnitrniTlak(k, ti(), te_, pe), pe, []);
}
function seznamSkladeb() {
  return `<div class="seznam-sk">${P.skladby.map(s => `<button class="btn" data-akce="sk-vyber" data-id="${esc(s.id)}" aria-pressed="${s.id === ui.skladba}">${esc(s.nazev)} <small>U ${f(J.vypocitejSkladbu(s, mapa(), ti()).U, 3)}</small></button>`).join('')}
    <button class="btn primary" data-akce="sk-nova">✚ Nová skladba</button></div>`;
}
function htmlSkladby() {
  const s = aktSkladba();
  let h = `<section class="panel"><h2>🧱 Skladby konstrukcí</h2>${seznamSkladeb()}</section>`;
  if (!s) return h + '<section class="panel"><p class="tip">Zatím žádná skladba. Založte první tlačítkem ✚ Nová skladba.</p></section>';
  const si = P.skladby.indexOf(s), c = 'skladby.' + si;
  h += `<section class="panel"><h2>✎ Editor skladby <span class="radek-tl" style="margin-left:auto"><button class="btn mini" data-akce="sk-dup">⧉ Duplikovat</button><button class="btn mini danger" data-akce="sk-smaz">🗑️ Smazat</button></span></h2>
    <div class="mrizka">
      <label class="pole" style="grid-column:span 2">Název<input class="vstup" data-cesta="${c}.nazev" data-plne value="${esc(s.nazev)}" maxlength="100"></label>
      <label class="pole" style="grid-column:span 2">Druh konstrukce (požadavky ČSN 73 0540-2)<select class="vstup" data-cesta="${c}.typ" data-zmena="typ">${volby(J.TYPY.map(t => [t.id, t.nazev]), s.typ)}</select></label>
      <label class="pole">Směr tepelného toku<select class="vstup" data-cesta="${c}.tok">${volby(Object.entries(J.TOKY), s.tok)}</select></label>
      <label class="pole">Vnější strana<select class="vstup" data-cesta="${c}.okraj">${volby(Object.entries(J.OKRAJE), s.okraj)}</select></label>
    </div>
    <p class="tip">Vrstvy zadávejte <b>zevnitř ven</b> (1 = u interiéru). Tloušťka v milimetrech. Nehomogenní vrstva (např. izolace mezi trámy): ⋯ → druhý materiál a jeho podíl v ploše.</p>
    <div class="tab-obal"><table class="vrstvy"><thead><tr><th>#</th><th>Materiál</th><th class="c">d [mm]</th><th class="c">λ</th><th class="c">μ</th><th class="c">R [m²K/W]</th><th class="c">sd [m]</th><th></th></tr></thead><tbody>
    ${s.vrstvy.map((v, i) => `<tr><td>${i + 1}</td><td class="mat"><select class="vstup" data-cesta="${c}.vrstvy.${i}.mat">${volbyMaterialu(v.mat)}</select>
        ${v.mat2 ? `<div class="mix"><select class="vstup" data-cesta="${c}.vrstvy.${i}.mat2" aria-label="Druhý materiál vrstvy">${volbyMaterialu(v.mat2)}</select><input class="vstup cis" style="width:70px" data-cesta="${c}.vrstvy.${i}.podil" value="${esc(vstupCislo(v.podil))}" inputmode="decimal" aria-label="Podíl druhého materiálu v %" title="Podíl plochy druhého materiálu v %"><span style="align-self:center">%</span></div>` : ''}</td>
      <td class="c"><input class="vstup cis d" data-cesta="${c}.vrstvy.${i}.d" value="${esc(vstupCislo(v.d))}" inputmode="decimal" aria-label="Tloušťka vrstvy ${i + 1} v mm"></td>
      <td class="c" data-v="lam${i}"></td><td class="c" data-v="mu${i}"></td><td class="c" data-v="R${i}"></td><td class="c" data-v="sd${i}"></td>
      <td><div class="akce"><button class="btn mini" data-akce="vr-mix" data-i="${i}" title="${v.mat2 ? 'Zrušit nehomogenní vrstvu' : 'Nehomogenní vrstva (2. materiál)'}" aria-label="Nehomogenní vrstva">⋯</button><button class="btn mini" data-akce="vr-nahoru" data-i="${i}" aria-label="Posunout dovnitř" title="Posunout dovnitř">↑</button><button class="btn mini" data-akce="vr-dolu" data-i="${i}" aria-label="Posunout ven" title="Posunout ven">↓</button><button class="btn mini danger" data-akce="vr-smaz" data-i="${i}" aria-label="Odebrat vrstvu" title="Odebrat vrstvu">✕</button></div></td></tr>`).join('')}
    <tr class="souhrn"><td></td><td>Celkem</td><td class="c" data-v="dSum"></td><td></td><td></td><td class="c" data-v="RSum"></td><td class="c" data-v="sdSum"></td><td></td></tr>
    </tbody></table></div>
    <div class="radek-tl" style="margin-top:8px"><button class="btn" data-akce="vr-pridat">✚ Přidat vrstvu</button>
      <label class="tip">Vnitřní θi [°C] <input class="vstup cis" style="width:64px" data-cesta="kondenzace.ti" value="${esc(vstupCislo(P.kondenzace.ti))}" inputmode="decimal"></label>
      <span class="tip">venkovní θe = ${f(te(), 0)} °C (${esc(P.lokalita.mesto || 'vlastní')}, mění se v 🏠 Ztráty)</span></div>
  </section>
  <section class="panel" data-v="vysl"></section>`;
  return h;
}
function vypoctySkladby() {
  const s = aktSkladba(); if (!s) return {};
  const r = J.vypocitejSkladbu(s, mapa(), ti()), v = {};
  s.vrstvy.forEach((x, i) => {
    const vr = J.vrstva(x, mapa());
    if (!vr) { v['lam' + i] = '<span class="varovani">?</span>'; return; }
    v['lam' + i] = f(vr.lam, 3); v['mu' + i] = f(vr.mu, vr.mu < 10 ? 1 : 0); v['R' + i] = f(vr.R, 3); v['sd' + i] = f(vr.sd, vr.sd < 1 ? 3 : 1);
  });
  v.dSum = f(r.vrstvy.reduce((a, x) => a + x.d, 0) * 1000, 1); v.RSum = f(r.Rkon, 2); v.sdSum = f(r.sd, 2);
  if (!r.vrstvy.length) { v.vysl = '<p class="tip">Přidejte alespoň jednu vrstvu.</p>'; return v; }
  const p = r.poz, te_ = te(), ti_ = ti();
  const tridaU = r.U <= p.Urec ? 'ok' : r.U <= p.UN ? 'warn' : 'bad';
  const fr = J.fRsi(r.U), fn = J.fRsiPozadovany(ti_, P.kondenzace.phi, te_, P.kondenzace.prirazka);
  const tsi = ti_ - (1 - fr) * (ti_ - te_);
  const st = stavNavrh(s, r);
  const zem = s.okraj === 'zemina';
  const dIz = d => d == null ? '–' : d === 0 ? 'splněno' : f(d * 1000, 0) + ' mm';
  let h = `<h2>📊 Výsledky – ${esc(s.nazev)}</h2>
  <div class="dlazdice">
    <div class="dl ${tridaU}"><b>${f(r.U, 3)}</b><span>U [W/(m²·K)]</span></div>
    <div class="dl"><b>${f(r.RT, 2)}</b><span>R<sub>T</sub> [m²·K/W] (R = ${f(r.R, 2)})</span></div>
    <div class="dl"><b>${f(r.hmotnost, 0)}</b><span>plošná hmotnost [kg/m²] – ${r.lehka ? 'lehká' : 'těžká'}</span></div>
    <div class="dl"><b>${f(r.sd, r.sd < 10 ? 2 : 0)}</b><span>sd celkem [m]</span></div>
    <div class="dl ${zem ? '' : fr >= fn.f ? 'ok' : 'bad'}"><b>${f(fr, 3)}</b><span>f<sub>Rsi</sub> (požad. ${f(fn.f, 3)})</span></div>
  </div>
  <div class="dva" style="margin-top:10px"><div>
  <h3>Porovnání s ${esc(J.NORMA)}</h3>
  <div class="tab-obal"><table><thead><tr><th>Hodnota</th><th class="c">U [W/(m²·K)]</th><th>Splněno</th><th class="c">Potřebná tl. izolace</th></tr></thead><tbody>
    <tr><td>Požadovaná U<sub>N</sub></td><td class="c">${f(p.UN, 2)}</td><td>${znacka(r.U <= p.UN, r.U <= p.UN ? 'ano' : 'ne')}</td><td class="c">${dIz(r.izol && r.izol.cile.UN)}</td></tr>
    <tr><td>Doporučená U<sub>rec</sub>${p.typ.UrecL ? (r.lehka ? ' (lehká)' : ' (těžká)') : ''}</td><td class="c">${f(p.Urec, 2)}</td><td>${znacka(r.U <= p.Urec, r.U <= p.Urec ? 'ano' : 'ne')}</td><td class="c">${dIz(r.izol && r.izol.cile.Urec)}</td></tr>
    ${p.pas ? `<tr><td>Pasivní budovy</td><td class="c">${p.pas.map(u => f(u, 2)).join(' – ')}</td><td>${znacka(r.U <= p.pas[0], r.U <= p.pas[0] ? 'ano' : 'ne')}</td><td class="c">${dIz(r.izol && r.izol.cile.pas)}</td></tr>` : ''}
  </tbody></table></div>
  <p class="tip">${esc(J.NORMA_POZN)}</p>
  ${r.izol ? `<p class="tip">Potřebná tloušťka = vrstva „${esc(r.izol.nazev)}“ (č. ${r.izol.index + 1}, nyní ${f(r.izol.d * 1000, 0)} mm) zvětšená tak, aby U dosáhlo cíle.${p.e1 !== 1 ? ` Hodnoty přepočteny součinitelem e₁ = ${f(p.e1, 3)} pro θim ${f(ti_, 0)} °C.` : ''}</p>` : ''}
  <h3>Povrchová teplota a plísně (návrhový stav)</h3>
  <p class="tip">Požadavek ČSN 73 0540-2:2011: θai = ${f(ti_, 1)} °C, φi = ${f(J.cislo(P.kondenzace.phi, 50), 0)} % + přirážka ${f(J.cislo(P.kondenzace.prirazka, 0), 0)} %${fn.phiR !== J.cislo(P.kondenzace.phi, 50) + J.cislo(P.kondenzace.prirazka, 0) ? `, sníženo podle θe → φi,r = ${f(fn.phiR, 0)} %` : ''}, θe = ${f(te_, 0)} °C, R<sub>si</sub> = 0,25, φsi,cr = 80 %.</p>
  ${zem ? '<div class="verdikt">U konstrukce přilehlé k zemině se povrchová teplota z venkovní teploty vzduchu nehodnotí – posuďte podle teploty zeminy (2D výpočet).</div>' :
  `<div class="verdikt ${fr >= fn.f ? 'ok' : 'bad'}">Vnitřní povrchová teplota θ<sub>si</sub> = <b>${f(tsi, 1)} °C</b>, kritická pro plísně ${f(fn.tcr, 1)} °C, rosný bod ${f(fn.tRosa, 1)} °C.<br>
    f<sub>Rsi</sub> = ${f(fr, 3)} ${fr >= fn.f ? '≥' : '<'} f<sub>Rsi,N</sub> = ${f(fn.f, 3)} → ${fr >= fn.f ? 'riziko plísní v ploše konstrukce nehrozí' : '<b>riziko plísní a kondenzace na povrchu</b>'}. Kouty a tepelné mosty mají povrch chladnější.</div>`}
  </div><div>
  <h3>Teplota a tlak vodní páry v návrhovém stavu</h3>
  ${grafProfil(st, r.vrstvy, ti_, te_)}
  <p class="tip">${zem ? 'Konstrukce na zemině – kondenzace se podle venkovního vzduchu nehodnotí.' : st.kondenzace ? `⚠️ V návrhovém stavu (θe ${f(te_, 0)} °C, φe ${f(J.cislo(P.kondenzace.phie, 84), 0)} %) pára kondenzuje: ${f(st.g.reduce((a, g) => a + Math.max(g, 0), 0) * 86400 * 1000, 1)} g/(m²·den). Roční bilance → 💧 Kondenzace.` : '✓ V návrhovém stavu pára v konstrukci nekondenzuje.'}</p>
  </div></div>
  ${r.varovani.map(x => `<p class="varovani">⚠️ ${esc(x)}</p>`).join('')}
  <p class="tip">R<sub>si</sub> = ${f(r.Rsi, 2)}, R<sub>se</sub> = ${f(r.Rse, 2)} m²·K/W. ${r.Rhorni !== r.Rdolni ? `Kombinovaná metoda: horní mez ${f(r.Rhorni, 2)}, dolní mez ${f(r.Rdolni, 2)} m²·K/W. ` : ''}U neobsahuje vliv tepelných mostů, kotev a vlhkosti při zabudování.</p>`;
  v.vysl = h;
  return v;
}

/* ---------- pohled: kondenzace ---------- */
function klima() { return J.klimaLokality(P.lokalita.vyska, P.klima); }
function htmlKondenzace() {
  const s = aktSkladba();
  if (!s) return '<section class="panel"><p class="tip">Nejprve založte skladbu v 🧱 Skladby.</p></section>';
  const k = P.kondenzace;
  let h = `<section class="panel"><h2>💧 Kondenzace vodní páry – Glaserova metoda</h2>
    <div class="mrizka">
      <label class="pole" style="grid-column:span 2">Skladba<select class="vstup" data-zmena="skladba">${volby(P.skladby.map(x => [x.id, x.nazev]), s.id)}</select></label>
      ${pole('Vnitřní teplota θi [°C]', 'kondenzace.ti', k.ti)}
      <label class="pole">Vnitřní vlhkost<select class="vstup" data-cesta="kondenzace.rezim">${volby([['konst', 'stálá relativní vlhkost φi'], ['trida', 'vlhkostní třída (ČSN EN ISO 13788)']], k.rezim)}</select></label>
      ${k.rezim === 'trida' ? `<label class="pole">Vlhkostní třída<select class="vstup" data-cesta="kondenzace.trida">${volby(J.TRIDY.map(t => [t.n, t.n + ' – ' + t.popis]), k.trida)}</select></label>` : pole('φi [%]', 'kondenzace.phi', k.phi)}
      ${pole('Nadmořská výška [m]', 'lokalita.vyska', P.lokalita.vyska)}
      ${pole('Návrh: φe při θe [%]', 'kondenzace.phie', k.phie)}
      <label class="pole">Limit kondenzátu (ČSN 73 0540-2)<select class="vstup" data-cesta="kondenzace.prisna">${volby([['ano', 'přísný: dřevo, jednoplášť. střecha, ETICS – 0,1 kg/m²'], ['ne', 'ostatní konstrukce – 0,5 kg/m²']], k.prisna)}</select></label>
      ${pole('Přirážka φi pro plísně [%]', 'kondenzace.prirazka', k.prirazka)}
    </div>
    <p class="tip">Byty: obvykle θi = 21 °C a φi = 50 % (ČSN 73 0540-3), u koupelen a kuchyní vyšší vlhkost. Návrhová venkovní teplota θe = ${f(te(), 0)} °C (lokalita v 🏠 Ztráty), návrhová φe podle ČSN 73 0540-3 pro ni ≈ ${f(J.phiENavrh(te()), 0)} %.</p>
    <div class="radek-tl"><button class="btn" data-akce="klima-vlastni" aria-pressed="${!!P.klima}">${P.klima ? '✓ Vlastní měsíční klima (zpět na referenční)' : '✎ Zadat vlastní měsíční klima'}</button>
      <label class="pole" style="display:inline-grid">Průběh zobrazit pro<select class="vstup" data-zmena="mesic">${volby([['navrh', 'návrhový stav (θe)']].concat(J.MESICE.map((m, i) => [i, m])), ui.mesic)}</select></label></div>`;
  if (P.klima) h += `<div class="tab-obal" style="margin-top:8px"><table><thead><tr><th>Měsíc</th>${J.MESICE.map(m => `<th class="c">${m.slice(0, 3)}</th>`).join('')}</tr></thead><tbody>
      <tr><td>θe [°C]</td>${P.klima.map((m, i) => `<td><input class="vstup cis" style="width:56px" data-cesta="klima.${i}.t" value="${esc(vstupCislo(m.t))}" inputmode="decimal" aria-label="θe ${J.MESICE[i]}"></td>`).join('')}</tr>
      <tr><td>φe [%]</td>${P.klima.map((m, i) => `<td><input class="vstup cis" style="width:56px" data-cesta="klima.${i}.phi" value="${esc(vstupCislo(m.phi))}" inputmode="decimal" aria-label="φe ${J.MESICE[i]}"></td>`).join('')}</tr></tbody></table></div>`;
  else h += `<p class="tip">Měsíční klima: ${esc(J.KLIMA_REF.stanice)} (${J.KLIMA_REF.vyska} m n. m.), ${esc(J.KLIMA_REF.zdroj)}; posun −0,55 °C na 100 m výšky.</p>`;
  return h + '</section><section class="panel" data-v="vysl"></section>';
}
function vypoctyKondenzace() {
  const s = aktSkladba(); if (!s) return {};
  const m = mapa(), r = J.vypocitejSkladbu(s, m, ti());
  if (!r.vrstvy.length) return { vysl: '<p class="tip">Skladba nemá vrstvy.</p>' };
  if (s.okraj === 'zemina') return { vysl: '<div class="verdikt">Konstrukce přilehlá k zemině – kondenzace podle venkovního klimatu se nehodnotí (rozhoduje teplota a vlhkost zeminy a hydroizolace).</div>' };
  const kl = klima(), b = J.bilance(s, m, kl, P.kondenzace);
  const lim = J.limitKondenzace(s, m, b.rozhrani, P.kondenzace.prisna !== 'ne');
  let verdikt;
  if (b.start < 0) verdikt = '<div class="verdikt ok">✓ <b>Ke kondenzaci vodní páry uvnitř konstrukce nedochází</b> v žádném měsíci.</div>';
  else if (b.hromadi) verdikt = `<div class="verdikt bad">✗ <b>Zkondenzovaná voda se během roku nevypaří</b> (na konci roku zbývá ${f(b.Mkonec * 1000, 0)} g/m²) – vlhkost se v konstrukci hromadí. Upravte skladbu (parozábrana na teplé straně, difuzně otevřenější vnější vrstvy).</div>`;
  else {
    const ok = b.Mc <= lim;
    let suche = -1; for (let k = 0; k < 12; k++) { const i = (b.start + k) % 12; if (b.mesice[i].M <= 1e-9) { suche = i; break; } }
    verdikt = `<div class="verdikt ${ok ? 'warn' : 'bad'}">${ok ? '⚠️' : '✗'} Kondenzace od měsíce <b>${J.MESICE[b.start]}</b>, zkondenzuje M<sub>c,a</sub> = <b>${f(b.Mc, 3)} kg/(m²·rok)</b>, vypaří se M<sub>ev,a</sub> ≥ ${f(b.Mev, 3)} kg/(m²·rok)${suche >= 0 ? `, vše vyschne v měsíci ${J.MESICE[suche]}` : ''}.<br>
      Roční bilance: ${znacka(true, 'vše se vypaří')} · limit ČSN 73 0540-2 M<sub>c,N</sub> = ${f(lim, 3)} kg/(m²·rok): ${znacka(ok, ok ? 'splněno' : 'překročeno')}<br>
      <span class="tip">Kondenzace je přípustná jen tam, kde neohrozí funkci konstrukce (dřevo, minerální vata a dřevovláknité desky jsou citlivé). Rozhraní: ${[...b.rozhrani].map(j => `${j}|${j + 1}`).join(', ')}.</span></div>`;
  }
  // tabulka měsíců
  const tab = `<div class="tab-obal"><table><thead><tr><th>Měsíc</th><th class="c">θe [°C]</th><th class="c">φe [%]</th><th class="c">pe [Pa]</th><th class="c">pi [Pa]</th><th class="c">φi [%]</th><th class="c">kond./vypař. [g/m²]</th><th class="c">nahromaděno [g/m²]</th><th class="c">f<sub>Rsi,min</sub></th></tr></thead><tbody>
    ${b.mesice.map((x, i) => `<tr><td>${J.MESICE[i]}</td><td class="c">${f(x.te, 1)}</td><td class="c">${f(x.phi, 0)}</td><td class="c">${f(x.pe, 0)}</td><td class="c">${f(x.pi, 0)}</td><td class="c">${f(x.pi / J.psat(ti()) * 100, 0)}</td>
      <td class="c">${x.g ? f(x.g * 1000, 1) : '–'}</td><td class="c">${f(x.M * 1000, 1)}</td><td class="c">${x.fmin == null || x.fmin <= 0 ? '–' : f(x.fmin, 3)}</td></tr>`).join('')}</tbody></table></div>`;
  const fmax = Math.max(...b.mesice.map(x => x.fmin == null ? -1 : x.fmin)), fr = J.fRsi(r.U);
  // profil
  let st, popis, teG = te();
  if (ui.mesic === 'navrh') { st = stavNavrh(s, r); popis = `návrhový stav θe = ${f(te(), 0)} °C`; }
  else {
    const x = b.mesice[+ui.mesic];
    st = x.stav || J.stav(r.vrstvy, r.Rsi, r.Rse, ti(), x.te, x.pi, x.pe, []);
    teG = x.te; popis = `${J.MESICE[+ui.mesic]}: θe = ${f(x.te, 1)} °C, φe = ${f(x.phi, 0)} %`;
  }
  const v = { vysl: `<h2>📊 Výsledek – ${esc(s.nazev)}</h2>${verdikt}
    <div class="verdikt ${fr >= fmax ? 'ok' : 'bad'}" style="margin-top:8px">Plísně po měsících (ČSN EN ISO 13788): nejpřísnější měsíc vyžaduje f<sub>Rsi,min</sub> = ${f(fmax, 3)}, konstrukce má f<sub>Rsi</sub> = ${f(fr, 3)} → ${fr >= fmax ? 'vyhovuje' : '<b>nevyhovuje</b>'}.</div>
    <div class="dva" style="margin-top:10px"><div><h3>Průběh v konstrukci – ${esc(popis)}</h3>${grafProfil(st, r.vrstvy, ti(), teG)}
      <p class="tip">Plné červené body = kondenzace, prázdné žluté = vypařování dříve nahromaděné vody. V tabulce: kladné = kondenzuje, záporné = vysychá.</p></div>
    <div><h3>Nahromaděná voda po měsících</h3>${b.start < 0 ? '<p class="tip">Žádná kondenzace – není co zobrazit.</p>' : grafMesice(b)}</div></div>
    <h3>Měsíční bilance</h3>${tab}` };
  return v;
}

/* ---------- pohled: ztráty ---------- */
function htmlZtraty() {
  const L = P.lokalita;
  const mesto = J.MESTA.some(m => m.n === L.mesto) ? L.mesto : '';
  let h = `<section class="panel"><h2>📍 Lokalita a parametry</h2><div class="mrizka">
    <label class="pole">Lokalita (okres)<select class="vstup" data-zmena="mesto"><option value="">vlastní θe</option>${volby(J.MESTA.map(m => [m.n, `${m.n} (${f(m.te, 0)} °C${m.v ? ', větrná' : ''}${m.pozn ? ', odhad' : ''})`]), mesto)}</select></label>
    ${pole('Výpočtová venkovní θe [°C]', 'lokalita.te', L.te, 'data-plne')}
    ${pole('Roční průměr θm,e [°C]', 'lokalita.tme', L.tme)}
    ${pole('Nadmořská výška [m]', 'lokalita.vyska', L.vyska)}
    <label class="pole"><span>Tepelné mosty ΔU<sub>tb</sub> [W/(m²·K)]</span><select class="vstup" data-cesta="lokalita.dU">${volby(TB, L.dU)}</select></label>
    <label class="pole"><span>Spodní voda G<sub>w</sub></span><select class="vstup" data-cesta="lokalita.Gw">${volby([[1, '1,00 – hladina > 1 m pod podlahou'], [1.15, '1,15 – hladina do 1 m']], L.Gw)}</select></label>
    ${pole('Účinnost rekuperace η [%]', 'lokalita.eta', L.eta)}
    ${pole('Infiltrace n<sub>inf</sub> [1/h]', 'lokalita.ninf', L.ninf)}
    ${pole('Přirážka (zátop) [%]', 'lokalita.prirazka', L.prirazka)}
  </div>
  <p class="tip">θe okresních měst podle ${esc(J.MESTA_ZDROJ)}; hodnota platí pro klimatickou stanici – výše položená a návětrná místa mají θe nižší. Výběr města nastaví i výšku a otopné období pro mez 13 °C. Při rekuperaci zadejte u místností výměnu vzduchu větracím systémem a sem netěsnosti (typicky 0,05–0,1 1/h).</p></section>
  <section class="panel" data-v="souhrn"></section>`;
  const sk = volby([['', '— U zadat ručně —']].concat(P.skladby.map(s => [s.id, s.nazev])), '');
  P.mistnosti.forEach((m, i) => {
    const c = 'mistnosti.' + i;
    h += `<section class="mistnost" aria-label="${esc(m.nazev)}"><div class="hlava">
      <label class="pole">Místnost<input class="vstup" data-cesta="${c}.nazev" value="${esc(m.nazev)}" maxlength="80"></label>
      ${pole('θi [°C]', c + '.t', m.t)}
      <label class="pole">Typ<select class="vstup" data-zmena="preset" data-i="${i}"><option value="">—</option>${J.TEPLOTY_MISTNOSTI.map((t, k) => `<option value="${k}">${esc(t.n)} ${t.t} °C</option>`).join('')}</select></label>
      ${pole('Plocha [m²]', c + '.plocha', m.plocha)}
      ${pole('Výška [m]', c + '.vyska', m.vyska)}
      ${pole('Výměna n [1/h]', c + '.n', m.n)}
      <div class="akce"><button class="btn mini" data-akce="m-dup" data-i="${i}" title="Duplikovat místnost" aria-label="Duplikovat místnost">⧉</button><button class="btn mini danger" data-akce="m-smaz" data-i="${i}" title="Smazat místnost" aria-label="Smazat místnost">🗑️</button></div>
    </div>
    <div class="tab-obal"><table class="prvky"><thead><tr><th>Konstrukce</th><th>Skladba</th><th class="c">U</th><th>Plocha A [m²]</th><th>Hraničí s</th><th class="c">θ [°C]</th><th class="c">Φ [W]</th><th></th></tr></thead><tbody>
    ${m.prvky.map((p, j) => { const cp = `${c}.prvky.${j}`, sTeplotou = p.hranice === 'nevytap' || p.hranice === 'mistnost';
      return `<tr><td><input class="vstup nazev" data-cesta="${cp}.nazev" value="${esc(p.nazev)}" maxlength="80" aria-label="Název konstrukce"></td>
      <td><select class="vstup kon" data-cesta="${cp}.skladba" data-zmena="prvek" data-i="${i}" data-j="${j}" aria-label="Skladba">${sk.replace(`value="${esc(p.skladba)}"`, `value="${esc(p.skladba)}" selected`)}</select></td>
      <td class="c">${p.skladba ? `<span data-v="u${i}_${j}"></span>` : `<input class="vstup cis u" data-cesta="${cp}.U" value="${esc(vstupCislo(p.U))}" inputmode="decimal" aria-label="U ručně">`}</td>
      <td><input class="vstup a" data-cesta="${cp}.A" value="${esc(p.A)}" aria-label="Plocha nebo výraz"><div class="plocha" data-v="a${i}_${j}"></div></td>
      <td><select class="vstup" data-cesta="${cp}.hranice" aria-label="Hraničí s">${volby(Object.entries(J.HRANICE), p.hranice)}</select></td>
      <td class="c">${sTeplotou ? `<input class="vstup cis t" data-cesta="${cp}.t" value="${esc(vstupCislo(p.t))}" inputmode="decimal" placeholder="${p.hranice === 'nevytap' ? '5' : '20'}" aria-label="Teplota sousedního prostoru">` : '—'}</td>
      <td class="c" data-v="p${i}_${j}"></td>
      <td><button class="btn mini danger" data-akce="p-smaz" data-i="${i}" data-j="${j}" title="Odebrat" aria-label="Odebrat konstrukci">✕</button></td></tr>`; }).join('')}
    </tbody></table></div>
    <div class="pata"><button class="btn mini" data-akce="p-novy" data-i="${i}">✚ Konstrukce</button><span data-v="m${i}"></span></div></section>`;
  });
  h += `<div class="radek-tl"><button class="btn primary" data-akce="m-nova">✚ Přidat místnost</button><span class="tip">Plochu lze zadat výrazem, např. <code>4,5*2,7 - 1,2*1,5</code> (stěna minus okno). Okna a dveře zadávejte s U<sub>w</sub> celého okna.</span></div>`;
  return h;
}
function vypoctyZtraty() {
  const z = J.ztraty(P, mapa()), sk = J.vysledkySkladeb(P, mapa()), b = z.budova, v = {};
  z.mistnosti.forEach((m, i) => {
    m.prvky.forEach((p, j) => {
      const src = P.mistnosti[i].prvky[j];
      if (src.skladba) v[`u${i}_${j}`] = sk[src.skladba] ? f(sk[src.skladba].U, 3) : '<span class="varovani">?</span>';
      v[`a${i}_${j}`] = isFinite(p.A) ? (/[^\d.,\s]/.test(src.A) ? '= ' + f(p.A, 2) + ' m²' : '') : '<span class="varovani">neplatná plocha</span>';
      v[`p${i}_${j}`] = p.chyba ? '<span class="varovani">?</span>' : `<span class="${p.Phi < 0 ? 'zaporne' : ''}">${f(p.Phi, 0)}</span>`;
    });
    v['m' + i] = `Prostup Φ<sub>T</sub> <b>${f(m.PhiT, 0)} W</b> · větrání Φ<sub>V</sub> <b>${f(m.PhiV, 0)} W</b> (V = ${f(m.V, 1)} m³, n<sub>ef</sub> = ${f(m.n, 2)} 1/h) · celkem <b>${f(m.Phi, 0)} W</b> · ${f(m.Wm2, 1)} W/m²`;
  });
  v.souhrn = `<h2>📊 Tepelná ztráta při θe = ${f(z.te, 0)} °C</h2><div class="dlazdice">
    <div class="dl"><b>${f(b.Phi / 1000, 2)} kW</b><span>tepelná ztráta budovy Φ<sub>HL</sub></span></div>
    <div class="dl"><b>${f(b.PhiT / 1000, 2)} / ${f(b.PhiV / 1000, 2)}</b><span>prostup / větrání [kW]</span></div>
    <div class="dl"><b>${f(b.Wm2, 1)}</b><span>W/m² vytápěné plochy (${f(b.plocha, 1)} m²)</span></div>
    <div class="dl"><b>${f(b.HT, 1)} / ${f(b.HV, 1)}</b><span>H<sub>T</sub> / H<sub>V</sub> [W/K]</span></div>
    <div class="dl"><b>${f(z.soucet / 1000, 2)} kW</b><span>součet místností (pro dimenzování otopných těles)</span></div>
  </div>
  <p class="tip">Ztráta budovy nezahrnuje přenosy mezi vytápěnými místnostmi; součet místností ano. Orientačně: novostavba 20–40 W/m², nízkoenergetický dům 15–25 W/m², starší nezateplený dům 80–150 W/m².</p>`;
  return v;
}

/* ---------- pohled: zdroj tepla ---------- */
function htmlZdroj() {
  const Z = P.zdroj, c = 'zdroj.';
  return `<section class="panel"><h2>🔥 Návrh zdroje tepla</h2>
    <h3>Teplá voda</h3><div class="mrizka">${pole('Počet osob', c + 'osoby', Z.osoby)}${pole('Spotřeba TV [l/os·den]', c + 'litry', Z.litry)}${pole('Teplota TV [°C]', c + 'tTV', Z.tTV)}${pole('Doba ohřevu zásobníku [h]', c + 'tOhrev', Z.tOhrev)}</div>
    <h3>Tepelné čerpadlo / kotel</h3><div class="mrizka">${pole('Rezerva kotle [%]', c + 'rezerva', Z.rezerva)}${pole('Blokace HDO [h/den]', c + 'blokace', Z.blokace)}${pole('Mez vytápění [°C]', c + 'mez', Z.mez)}
      <label class="pole">Výkon TČ při A−7 [kW]<input class="vstup cis" data-cesta="${c}tc7" value="${esc(vstupCislo(Z.tc7))}" inputmode="decimal" placeholder="z katalogu"></label>
      <label class="pole">Výkon TČ při A2 [kW]<input class="vstup cis" data-cesta="${c}tc2" value="${esc(vstupCislo(Z.tc2))}" inputmode="decimal" placeholder="z katalogu"></label></div>
    <h3>Roční potřeba (hrubý odhad)</h3><div class="mrizka">${pole('Počet otopných dnů', c + 'dni', Z.dni)}${pole('Průměrná venkovní v otopném období [°C]', c + 'tes', Z.tes)}</div>
    <p class="tip">Výkony TČ berte z katalogu výrobce pro teplotu otopné vody vašeho systému (podlahové topení W35, radiátory W45–55). Typické otopné období v ČR: 210–260 dní, průměrná teplota 3–5 °C (ČSN 38 3350, orientačně).</p></section>
    <section class="panel" data-v="vysl"></section>`;
}
function vypoctyZdroj() {
  const zt = J.ztraty(P, mapa()), z = J.zdroj(P.zdroj, zt.budova, zt.te), te_ = zt.te;
  if (!(zt.budova.Phi > 0)) return { vysl: '<p class="tip">Nejprve zadejte místnosti v 🏠 Ztráty.</p>' };
  const kw = x => f(x, 2) + ' kW';
  let tc = '';
  if (z.tc) tc = `<div class="verdikt ${z.dohrev > 0 ? 'warn' : 'ok'}">Zadané TČ: bod bivalence <b>${z.bivalence == null ? 'pod rozsahem' : f(z.bivalence, 1) + ' °C'}</b>, při θe ${f(te_, 0)} °C dodá ${kw(z.tc(te_))} → dohřev (bivalentní zdroj) <b>${kw(z.dohrev)}</b>.
    ${z.bivalence != null && z.bivalence > -3 ? '<br>⚠️ Bod bivalence nad −3 °C – TČ je spíše poddimenzované, velkou část zimy pojede dohřev.' : z.bivalence != null && z.bivalence < -12 ? '<br>ℹ️ Bod bivalence pod −12 °C – TČ je spíše předimenzované (časté cyklování v přechodném období, vyšší cena).' : ''}</div>`;
  else tc = '<p class="tip">Zadejte výkony TČ z katalogu (A−7 a A2) – spočte se bod bivalence a potřebný dohřev.</p>';
  return { vysl: `<h2>📊 Doporučení</h2><div class="dlazdice">
    <div class="dl"><b>${kw(z.Phi)}</b><span>tepelná ztráta Φ<sub>HL</sub> při ${f(te_, 0)} °C</span></div>
    <div class="dl"><b>${kw(z.PTV)}</b><span>ohřev TV (${f(z.QTVden, 1)} kWh/den)</span></div>
    <div class="dl"><b>${kw(z.kotel)}</b><span>kotel s přednostním ohřevem TV</span></div>
    <div class="dl"><b>${kw(z.kotelTV)}</b><span>kotel bez přednosti TV</span></div>
  </div>
  <div class="dva" style="margin-top:10px"><div>
    <h3>Tepelné čerpadlo vzduch–voda</h3>
    <div class="tab-obal"><table><thead><tr><th>Venkovní teplota</th><th class="c">Potřebný výkon${z.kBlok > 1 ? ' (vč. blokace)' : ''}</th></tr></thead><tbody>
      ${z.body.map(x => `<tr><td>${f(x.t, 0)} °C${x.t === te_ ? ' (výpočtová)' : ''}</td><td class="c">${kw(x.P)}</td></tr>`).join('')}</tbody></table></div>
    <p class="tip">Obvyklá volba pro monovalentně-paralelní provoz: TČ pokryje ztrátu do bodu bivalence cca −5 až −8 °C (výkon TČ při A−7 ≈ ${kw(z.zatez(-7) * z.kBlok)}), zbytek do výpočtové teploty dohřev (elektrokotel/patrona, min. ${kw(Math.max(0, z.zatez(te_) - z.zatez(-7)) * z.kBlok)}, obvykle se volí s rezervou pro případ poruchy TČ). Ohřev TV v zásobníku se řeší časovým přednostním režimem.</p>
    ${tc}
  </div><div><h3>Zatěžovací přímka</h3>${grafZdroj(z, te_)}
    <p class="tip"><span style="color:var(--danger)">━</span> potřeba budovy, <span style="color:var(--ok)">━</span> výkon zadaného TČ (lineárně z A−7 a A2).</p></div></div>
  <h3>Roční potřeba tepla (bez zisků, horní odhad)</h3>
  <p style="font-size:.88rem;line-height:1.5;margin:0">Vytápění ≈ <b>${f(z.Qrok / 1000, 1)} MWh/rok</b> (H = ${f(zt.budova.H, 1)} W/K, ${f(z.D, 0)} denostupňů), teplá voda ≈ <b>${f(z.QTVrok / 1000, 1)} MWh/rok</b> (bez ztrát zásobníku a cirkulace). Skutečná spotřeba bývá díky vnitřním a solárním ziskům o 15–35 % nižší.</p>` };
}

/* ---------- pohled: materiály ---------- */
function htmlMaterialy() {
  return `<section class="panel"><h2>📚 Knihovna materiálů <span class="radek-tl" style="margin-left:auto"><button class="btn primary mini" data-akce="mat-novy">✚ Vlastní materiál</button></span></h2>
    <input type="search" class="vstup" id="hledatMat" placeholder="🔍 Hledat materiál…" value="${esc(ui.hledat)}" aria-label="Hledat materiál" style="max-width:320px">
    <p class="tip">Hodnoty jsou orientační – pro projekt použijte návrhové hodnoty konkrétního výrobku (λu, μ). Vlastní materiály se ukládají do projektu. Stav dat ${J.STAV_DAT}.</p>
    <div data-v="tab"></div></section>`;
}
function vypoctyMaterialy() {
  const q = ui.hledat.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const xs = Object.values(mapa()).filter(x => !q || (x.nazev + ' ' + x.kat).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q));
  return { tab: `<div class="tab-obal"><table><thead><tr><th>Materiál</th><th>Skupina</th><th class="c">λ [W/(m·K)]</th><th class="c">μ [–]</th><th class="c">ρ [kg/m³]</th><th class="c">c [J/(kg·K)]</th><th>Zdroj</th><th></th></tr></thead><tbody>
    ${xs.map(x => `<tr><td>${esc(x.nazev)}</td><td>${esc(x.kat)}</td><td class="c">${f(x.lam, 3)}</td><td class="c">${x.mu >= 1000 ? x.mu.toLocaleString('cs-CZ') : f(x.mu, x.mu < 10 ? 1 : 0)}</td><td class="c">${f(x.rho, 0)}</td><td class="c">${f(x.c, 0)}</td>
      <td style="font-size:.74rem;color:var(--text-muted)">${esc(zdrojText(x.zdroj))}</td>
      <td>${x.kat === 'Vlastní' ? `<div class="akce"><button class="btn mini" data-akce="mat-uprav" data-id="${esc(x.id)}" aria-label="Upravit">✎</button><button class="btn mini danger" data-akce="mat-smaz" data-id="${esc(x.id)}" aria-label="Smazat">✕</button></div>` : ''}</td></tr>`).join('')}
    </tbody></table></div>` };
}

/* ---------- vykreslení ---------- */
const POHLEDY = {
  skladby: [htmlSkladby, vypoctySkladby], kondenzace: [htmlKondenzace, vypoctyKondenzace], ztraty: [htmlZtraty, vypoctyZtraty],
  zdroj: [htmlZdroj, vypoctyZdroj], materialy: [htmlMaterialy, vypoctyMaterialy]
};
function vykresli() {
  if (!POHLEDY[ui.pohled]) ui.pohled = 'skladby';
  document.querySelectorAll('[data-pohled]').forEach(b => b.setAttribute('aria-pressed', b.dataset.pohled === ui.pohled));
  $('projNazev').textContent = P.nazev; $('projNazev').title = 'Projekt: ' + P.nazev;
  const y = document.querySelector('main').scrollTop;
  $('obsah').innerHTML = POHLEDY[ui.pohled][0]();
  obnov();
  document.querySelector('main').scrollTop = y;
}
function obnov() {
  let v = {};
  try { v = POHLEDY[ui.pohled][1](); } catch (e) { console.error(e); v = { vysl: '<p class="varovani">Výpočet se nezdařil: ' + esc(e.message) + '</p>' }; }
  document.querySelectorAll('#obsah [data-v]').forEach(el => { const h = v[el.dataset.v]; if (h != null && el.innerHTML !== h) el.innerHTML = h; });
}

/* ---------- akce ---------- */
const presun = (pole, i, k) => { const j = i + k; if (j < 0 || j >= pole.length) return; [pole[i], pole[j]] = [pole[j], pole[i]]; };
const AKCE = {
  'sk-vyber': el => { ui.skladba = el.dataset.id; },
  'sk-nova': () => { const s = J.skladbaN({ nazev: 'Nová skladba', typ: 'stena', vrstvy: [{ mat: 'om_vc', d: 15 }, { mat: 'ktv30', d: 300 }, { mat: 'eps_g', d: 160 }, { mat: 'om_ten', d: 3 }] }); P.skladby.push(s); ui.skladba = s.id; },
  'sk-dup': () => { const s = aktSkladba(); const k = J.skladbaN(JSON.parse(JSON.stringify(s))); k.id = J.novyId(); k.nazev = s.nazev + ' (kopie)'; P.skladby.push(k); ui.skladba = k.id; },
  'sk-smaz': async () => {
    const s = aktSkladba(), pouziti = P.mistnosti.reduce((a, m) => a + m.prvky.filter(p => p.skladba === s.id).length, 0);
    if (!await Dialog.potvrd(`Smazat skladbu „${s.nazev}“?${pouziti ? ` Používá ji ${pouziti} konstrukcí v místnostech – přepnou se na ruční U.` : ''}`)) return false;
    P.mistnosti.forEach(m => m.prvky.forEach(p => { if (p.skladba === s.id) { p.U = String(Math.round(J.vypocitejSkladbu(s, mapa(), ti()).U * 1000) / 1000); p.skladba = ''; } }));
    P.skladby = P.skladby.filter(x => x !== s); ui.skladba = '';
  },
  'vr-pridat': () => { aktSkladba().vrstvy.push(J.vrstvaN({ mat: 'om_vc', d: 10 })); },
  'vr-nahoru': el => presun(aktSkladba().vrstvy, +el.dataset.i, -1),
  'vr-dolu': el => presun(aktSkladba().vrstvy, +el.dataset.i, 1),
  'vr-smaz': el => { aktSkladba().vrstvy.splice(+el.dataset.i, 1); },
  'vr-mix': el => { const v = aktSkladba().vrstvy[+el.dataset.i]; if (v.mat2) { v.mat2 = ''; v.podil = 0; } else { v.mat2 = 'drevo'; v.podil = 10; } },
  'klima-vlastni': () => { P.klima = P.klima ? null : J.klimaLokality(P.lokalita.vyska, null); },
  'm-nova': () => { P.mistnosti.push(J.mistnostN({ nazev: 'Místnost ' + (P.mistnosti.length + 1), plocha: 12, prvky: [{ nazev: 'Obvodová stěna', skladba: (P.skladby[0] || {}).id || '', A: '4*2.6', hranice: 'venku' }] })); },
  'm-dup': el => { const m = J.mistnostN(JSON.parse(JSON.stringify(P.mistnosti[+el.dataset.i]))); m.id = J.novyId(); m.nazev += ' (kopie)'; P.mistnosti.splice(+el.dataset.i + 1, 0, m); },
  'm-smaz': async el => { const m = P.mistnosti[+el.dataset.i]; if (!await Dialog.potvrd(`Smazat místnost „${m.nazev}“?`)) return false; P.mistnosti.splice(+el.dataset.i, 1); },
  'p-novy': el => { P.mistnosti[+el.dataset.i].prvky.push(J.prvekN({ nazev: 'Konstrukce', U: '1', A: '' })); },
  'p-smaz': el => { P.mistnosti[+el.dataset.i].prvky.splice(+el.dataset.j, 1); },
  'mat-novy': () => upravMaterial(null),
  'mat-uprav': el => upravMaterial(P.materialy.find(x => x.id === el.dataset.id)),
  'mat-smaz': async el => {
    const id = el.dataset.id, x = P.materialy.find(m => m.id === id);
    if (P.skladby.some(s => s.vrstvy.some(v => v.mat === id || v.mat2 === id))) { Dialog.chyba('Materiál je použit ve skladbě – nejprve ho tam vyměňte.'); return false; }
    if (!await Dialog.potvrd(`Smazat materiál „${x.nazev}“?`)) return false;
    P.materialy = P.materialy.filter(m => m.id !== id);
  }
};
function otevriDialog(dlg) {
  return new Promise(res => { dlg.addEventListener('close', () => res(dlg.returnValue), { once: true }); dlg.returnValue = ''; dlg.showModal(); });
}
async function upravMaterial(m) {
  const dlg = $('dlgMaterial'), fm = dlg.querySelector('form');
  $('dlgMaterialTitul').textContent = m ? '✎ ' + m.nazev : '✚ Vlastní materiál';
  const x = m || { nazev: '', lam: 0.04, mu: 1, rho: 100, c: 1000, zdroj: '' };
  fm.nazev.value = x.nazev; fm.zdroj.value = x.zdroj === 'vlastni' ? '' : x.zdroj;
  ['lam', 'mu', 'rho', 'c'].forEach(k => { fm[k].value = vstupCislo(x[k]); });
  if (await otevriDialog(dlg) !== 'ok') return false;
  const n = J.materialN({ id: m ? m.id : '', nazev: fm.nazev.value.trim(), lam: fm.lam.value, mu: fm.mu.value, rho: fm.rho.value, c: fm.c.value, zdroj: fm.zdroj.value.trim() || 'vlastni' });
  if (m) Object.assign(m, n); else P.materialy.push(n);
}

/* ---------- projekty a výstupy ---------- */
function stahni(nazev, obsah, typ) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([obsah], { type: typ }));
  a.download = nazev; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const jmenoSouboru = () => (P.nazev || 'projekt').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').slice(0, 50);
function prepni(p) { P = p; projekty[P.id] = P; ui.skladba = ''; ulozVse(); vykresli(); }
const PRIKAZY = {
  napoveda: () => $('dlgNapoveda').showModal(),
  otevrit: () => { vykresliSeznam(); $('dlgProjekty').showModal(); },
  novy: async () => { const n = await Dialog.zeptej('Název nového projektu:', 'Nový projekt'); if (n == null) return; prepni(J.projektN({ nazev: n.trim() || 'Nový projekt' })); },
  vzor: () => { prepni(J.vzorovyProjekt()); Dialog.info('Založen vzorový projekt.'); },
  kopie: async () => { const n = await Dialog.zeptej('Název kopie:', P.nazev + ' (kopie)'); if (n == null) return; const k = J.projektN(JSON.parse(JSON.stringify(P))); k.id = J.novyId(); k.nazev = n.trim() || k.nazev; prepni(k); },
  prejmenovat: async () => { const n = await Dialog.zeptej('Název projektu:', P.nazev); if (n == null || !n.trim()) return; P.nazev = n.trim(); ulozVse(); vykresli(); },
  smazat: async () => {
    if (!await Dialog.potvrd(`Smazat projekt „${P.nazev}“? Tuto akci nelze vrátit.`)) return;
    delete projekty[P.id];
    prepni(Object.values(projekty)[0] || J.vzorovyProjekt());
  },
  export: () => stahni(jmenoSouboru() + '.json', JSON.stringify(P, null, 1), 'application/json'),
  import: () => $('souborImport').click(),
  csv: () => stahni(jmenoSouboru() + '_ztraty.csv', '﻿' + J.csvZtrat(J.ztraty(P, mapa())), 'text/csv'),
  tisk: () => { $('protokol').innerHTML = protokol(); setTimeout(() => window.print(), 50); }
};
function vykresliSeznam() {
  const xs = Object.values(projekty).sort((a, b) => (b.upraveno || '').localeCompare(a.upraveno || ''));
  $('seznamProjektu').innerHTML = xs.map(p => `<div class="pr${p.id === P.id ? ' akt' : ''}"><span>${esc(p.nazev)}<br><small class="tip">${p.skladby.length} skladeb, ${p.mistnosti.length} místností${p.upraveno ? ', ' + new Date(p.upraveno).toLocaleString('cs-CZ') : ''}</small></span>
    <button type="button" class="btn mini primary" data-otevri="${esc(p.id)}">Otevřít</button></div>`).join('');
}
$('seznamProjektu').addEventListener('click', e => {
  const b = e.target.closest('[data-otevri]'); if (!b) return;
  $('dlgProjekty').close(); prepni(projekty[b.dataset.otevri]);
});
$('souborImport').addEventListener('change', async e => {
  const soubor = e.target.files[0]; e.target.value = '';
  if (!soubor) return;
  try {
    const d = JSON.parse(await soubor.text());
    if (!d || !Array.isArray(d.skladby)) throw new Error('není to projekt');
    const p = J.projektN(d);
    if (projekty[p.id]) { if (!await Dialog.potvrd(`Projekt „${projekty[p.id].nazev}“ už existuje. Přepsat? (Ne = importovat jako nový)`, { ok: 'Přepsat', zrus: 'Jako nový' })) p.id = J.novyId(); }
    prepni(p); Dialog.info('Projekt načten.');
  } catch (err) { Dialog.chyba('Soubor nelze načíst: ' + err.message); }
});

function protokol() {
  const m = mapa(), zt = J.ztraty(P, m), zd = J.zdroj(P.zdroj, zt.budova, zt.te), k = P.kondenzace, kl = klima();
  let h = `<h1>Protokol – ${esc(P.nazev)}</h1>
    <p>Datum: ${new Date().toLocaleDateString('cs-CZ')} · Lokalita: ${esc(P.lokalita.mesto || 'vlastní')}, θe = ${f(zt.te, 0)} °C, ${f(J.cislo(P.lokalita.vyska, 0), 0)} m n. m. · Interiér θi = ${f(ti(), 1)} °C, ${k.rezim === 'trida' ? 'vlhkostní třída ' + k.trida : 'φi = ' + f(J.cislo(k.phi, 50), 0) + ' %'}</p>
    <p>Požadavky: ${esc(J.NORMA)}. Metody: ČSN EN ISO 6946, ČSN EN ISO 13788, zjednodušeně ČSN EN 12831-1. Výsledky jsou orientační.</p>
    <h2>1. Skladby konstrukcí</h2>`;
  P.skladby.forEach((s, si) => {
    const r = J.vypocitejSkladbu(s, m, ti()); if (!r.vrstvy.length) return;
    const p = r.poz, fr = J.fRsi(r.U), fn = J.fRsiPozadovany(ti(), k.phi, zt.te, k.prirazka);
    const b = s.okraj === 'zemina' ? null : J.bilance(s, m, kl, k), lim = b ? J.limitKondenzace(s, m, b.rozhrani) : 0;
    h += `<div class="blok"><h3>1.${si + 1} ${esc(s.nazev)} – ${esc(p.typ.nazev)}</h3>
      <table><thead><tr><th>#</th><th>Materiál</th><th>d [mm]</th><th>λ</th><th>μ</th><th>ρ</th><th>R</th><th>sd [m]</th></tr></thead><tbody>
      ${r.vrstvy.map((v, i) => `<tr><td>${i + 1}</td><td>${esc(v.m.nazev)}${v.m2 ? ` + ${f(v.f * 100, 0)} % ${esc(v.m2.nazev)}` : ''}</td><td>${f(v.d * 1000, 1)}</td><td>${f(v.lam, 3)}</td><td>${f(v.mu, 0)}</td><td>${f(v.rho, 0)}</td><td>${f(v.R, 3)}</td><td>${f(v.sd, 2)}</td></tr>`).join('')}
      </tbody></table>
      <p>R<sub>si</sub> = ${f(r.Rsi, 2)}, R<sub>se</sub> = ${f(r.Rse, 2)}, R<sub>T</sub> = ${f(r.RT, 2)} m²K/W → <b>U = ${f(r.U, 3)} W/(m²K)</b>; U<sub>N</sub> = ${f(p.UN, 2)} (${r.U <= p.UN ? 'splněno' : 'NESPLNĚNO'}), U<sub>rec</sub> = ${f(p.Urec, 2)} (${r.U <= p.Urec ? 'splněno' : 'nesplněno'})${p.pas ? `, pasivní ${p.pas.map(u => f(u, 2)).join('–')} (${r.U <= p.pas[0] ? 'splněno' : 'nesplněno'})` : ''}. Plošná hmotnost ${f(r.hmotnost, 0)} kg/m².</p>
      ${s.okraj === 'zemina' ? '' : `<p>f<sub>Rsi</sub> = ${f(fr, 3)}, f<sub>Rsi,N</sub> = ${f(fn.f, 3)} (${fr >= fn.f ? 'vyhovuje' : 'NEVYHOVUJE'}).
      Kondenzace (ČSN EN ISO 13788): ${b.start < 0 ? 'nedochází' : b.hromadi ? 'voda se HROMADÍ – nevyhovuje' : `M<sub>c,a</sub> = ${f(b.Mc, 3)} kg/(m²rok), vše se vypaří; limit ${f(lim, 3)} → ${b.Mc <= lim ? 'vyhovuje' : 'NEVYHOVUJE'}`}.</p>
      ${grafProfil(stavNavrh(s, r), r.vrstvy, ti(), zt.te)}`}</div>`;
  });
  h += `<h2>2. Tepelné ztráty místností</h2>`;
  zt.mistnosti.forEach((mi, i) => {
    h += `<div class="blok"><h3>${esc(mi.nazev)} – θi ${f(mi.t, 0)} °C, ${f(mi.plocha, 1)} m², V ${f(mi.V, 1)} m³, n<sub>ef</sub> ${f(mi.n, 2)} 1/h</h3>
      <table><thead><tr><th>Konstrukce</th><th>U</th><th>U+ΔU</th><th>A [m²]</th><th>Hraničí s</th><th>Δθ [K]</th><th>Φ [W]</th></tr></thead><tbody>
      ${mi.prvky.map((p, j) => `<tr><td>${esc(p.nazev)}</td><td>${f(p.U, 3)}</td><td>${f(p.Uk, 3)}</td><td>${f(p.A, 2)}</td><td>${J.HRANICE[P.mistnosti[i].prvky[j].hranice]}</td><td>${f(p.dT, 1)}</td><td>${f(p.Phi, 0)}</td></tr>`).join('')}
      <tr><td colspan="6">Prostup Φ<sub>T</sub> / větrání Φ<sub>V</sub> / celkem</td><td>${f(mi.PhiT, 0)} / ${f(mi.PhiV, 0)} / <b>${f(mi.Phi, 0)}</b></td></tr></tbody></table></div>`;
  });
  const b = zt.budova;
  h += `<div class="blok"><h2>3. Budova</h2><table><tbody>
    <tr><td>Tepelná ztráta budovy Φ<sub>HL</sub> (bez přenosů mezi místnostmi)</td><td><b>${f(b.Phi / 1000, 2)} kW</b></td></tr>
    <tr><td>z toho prostup / větrání</td><td>${f(b.PhiT / 1000, 2)} / ${f(b.PhiV / 1000, 2)} kW</td></tr>
    <tr><td>Součet ztrát místností</td><td>${f(zt.soucet / 1000, 2)} kW</td></tr>
    <tr><td>Vytápěná plocha / objem</td><td>${f(b.plocha, 1)} m² / ${f(b.objem, 1)} m³ (${f(b.Wm2, 1)} W/m²)</td></tr>
    <tr><td>H<sub>T</sub> / H<sub>V</sub></td><td>${f(b.HT, 1)} / ${f(b.HV, 1)} W/K</td></tr>
    <tr><td>Parametry</td><td>ΔU<sub>tb</sub> ${f(J.cislo(P.lokalita.dU, 0), 2)}, rekuperace ${f(J.cislo(P.lokalita.eta, 0), 0)} %, n<sub>inf</sub> ${f(J.cislo(P.lokalita.ninf, 0), 2)} 1/h, přirážka ${f(J.cislo(P.lokalita.prirazka, 0), 0)} %, θ<sub>m,e</sub> ${f(J.cislo(P.lokalita.tme, 8), 1)} °C</td></tr>
  </tbody></table>
  <h2>4. Zdroj tepla</h2><table><tbody>
    <tr><td>Ohřev teplé vody</td><td>${f(zd.QTVden, 1)} kWh/den, ${f(zd.PTV, 2)} kW</td></tr>
    <tr><td>Kotel s přednostním ohřevem TV / bez přednosti</td><td>${f(zd.kotel, 2)} / ${f(zd.kotelTV, 2)} kW</td></tr>
    ${zd.body.map(x => `<tr><td>Potřebný výkon TČ při ${f(x.t, 0)} °C</td><td>${f(x.P, 2)} kW</td></tr>`).join('')}
    ${zd.tc ? `<tr><td>Bod bivalence zadaného TČ / dohřev při θe</td><td>${zd.bivalence == null ? '–' : f(zd.bivalence, 1) + ' °C'} / ${f(zd.dohrev, 2)} kW</td></tr>` : ''}
    <tr><td>Roční potřeba tepla na vytápění / TV (bez zisků)</td><td>${f(zd.Qrok / 1000, 1)} / ${f(zd.QTVrok / 1000, 1)} MWh</td></tr>
  </tbody></table></div>
  <p style="margin-top:10px;font-size:8pt">Orientační výpočet, nenahrazuje projektovou dokumentaci ani PENB. Materiálové hodnoty a klimatická data jsou tabulkové/orientační (stav ${J.STAV_DAT}).</p>`;
  return h;
}

/* ---------- nabídky a události ---------- */
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
document.addEventListener('click', async e => {
  const p = e.target.closest('[data-prikaz]');
  if (p) { e.stopPropagation(); zavriNabidky(); return PRIKAZY[p.dataset.prikaz](); }
  if (!e.target.closest('.nabidka')) zavriNabidky();
  const pv = e.target.closest('[data-pohled]');
  if (pv) { ui.pohled = pv.dataset.pohled; try { localStorage.setItem(KV, ui.pohled); } catch (er) {} document.querySelector('main').scrollTop = 0; return vykresli(); }
  const a = e.target.closest('[data-akce]');
  if (!a || !AKCE[a.dataset.akce]) return;
  if (await AKCE[a.dataset.akce](a) === false) return;
  ulozVse(); vykresli();
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'hledatMat') { ui.hledat = el.value; return obnov(); }
  if (!el.dataset.cesta || el.tagName === 'SELECT') return;
  nastav(el.dataset.cesta, el.value); ulozVse(); obnov();
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.cesta && (el.tagName === 'SELECT' || 'plne' in el.dataset)) nastav(el.dataset.cesta, el.value);
  const z = el.dataset.zmena;
  if (z === 'skladba') ui.skladba = el.value;
  else if (z === 'mesic') ui.mesic = el.value;
  else if (z === 'typ') { const s = aktSkladba(), t = J.TYPY_MAPA[s.typ]; s.tok = t.tok; s.okraj = t.okraj; }
  else if (z === 'mesto') { const m = J.MESTA.find(x => x.n === el.value); P.lokalita.mesto = el.value; if (m) { P.lokalita.te = m.te; P.lokalita.vyska = m.h; if (m.dni) { P.zdroj.dni = m.dni; P.zdroj.tes = m.tes; } } }
  else if (z === 'preset') { const t = J.TEPLOTY_MISTNOSTI[+el.value]; if (t) P.mistnosti[+el.dataset.i].t = t.t; }
  else if (z === 'prvek') { const s = P.skladby.find(x => x.id === el.value), p = P.mistnosti[+el.dataset.i].prvky[+el.dataset.j]; if (s) p.hranice = s.okraj === 'odvetrano' ? 'venku' : s.okraj; }
  if (el.tagName === 'SELECT' || z || 'plne' in el.dataset) { if (z !== 'skladba' && z !== 'mesic') ulozVse(); vykresli(); }
});
addEventListener('resize', zavriNabidky);
document.addEventListener('keydown', e => { if (e.key === 'Escape') zavriNabidky(); });
addEventListener('beforeprint', () => { if (!$('protokol').innerHTML) $('protokol').innerHTML = protokol(); });
addEventListener('afterprint', () => { $('protokol').innerHTML = ''; });

ulozVse();
vykresli();
window.TZ_APP = { projekt: () => P, vykresli, ui, protokol };
})();
