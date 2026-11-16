/* Rodinný rozvrh – rozhraní (logika je v jadro.js) */
(function () {
'use strict';
const J = window.RozvrhJadro;
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
if (window.self === window.top) document.body.classList.add('samostatne');

let data = J.prazdna();
try { data = J.migruj(JSON.parse(localStorage.getItem(J.KLIC))); } catch (e) { data = J.prazdna(); }
let pohled = 'tyden', skryti = new Set(), jizdyVMrizce = true, odvozJenTyden = false;
try {
  pohled = localStorage.getItem(J.KLIC + '_pohled') || 'tyden';
  skryti = new Set(JSON.parse(localStorage.getItem(J.KLIC + '_skryti') || '[]'));
  jizdyVMrizce = localStorage.getItem(J.KLIC + '_jizdy') !== '0';
} catch (e) {}
let tydenOd = J.pondeli(J.dnesIso());
let T = []; // výpočet aktuálního týdne

function uloz() {
  try { localStorage.setItem(J.KLIC, JSON.stringify(data)); }
  catch (e) { Dialog.chyba('Data se nepodařilo uložit (plné úložiště?)'); }
}
function zapamatuj(k, v) { try { localStorage.setItem(J.KLIC + '_' + k, v); } catch (e) {} }

/* ---------- pomocné ---------- */
const clen = id => data.clenove.find(c => c.id === id);
const barva = id => (clen(id) || {}).barva || '#888888';
const jmeno = id => id === J.SAM ? '🚶 sám' : (clen(id) || {}).jmeno || '';
const misto = id => J.mistoPodleId(data, id).nazev;
const cas = m => J.formatCas(m);
const trasa = j => j.trasa.map(misto).join(' → ');
const ridici = () => data.clenove.filter(c => c.ridic);
const viditelnyVyskyt = v => !v.puvodniClenove.length || v.puvodniClenove.some(c => !skryti.has(c));
const viditelnaJizda = j => !skryti.has(j.ridic) || j.pasazeri.some(c => !skryti.has(c));
function tecky(ids) { return ids.map(c => `<span class="tecka" style="--c:${barva(c)}" title="${esc(jmeno(c))}"></span>`).join(''); }
function jmenaHtml(ids) { return ids.map(c => `<span class="jm"><span class="tecka" style="--c:${barva(c)}"></span><span data-i18n="ne">${esc(jmeno(c))}</span></span>`).join(' '); }
function kolizeVyskytu(den, v) { return den.kolize.filter(k => k.vyskyt === v || (k.polozky && k.polozky.some(p => p.vyskyt === v))); }
function kolizeJizdy(den, j) { return den.kolize.filter(k => k.polozky && k.polozky.some(p => p.jizda === j)); }
function odvozPopis(v, den, typ) { // text „tam: Máma“ / chybí / navazuje
  const nav = den.navaznosti[v.id] && den.navaznosti[v.id][typ];
  const chybi = den.chybi.some(c => c.vyskyt === v && c.typ === typ);
  const j = den.jizdy.filter(x => x.typ === typ && x.vyskyty.includes(v));
  if (chybi) return { t: (typ === 'tam' ? '→ ' : '← ') + 'nikdo!', chybi: true };
  if (j.length) return { t: (typ === 'tam' ? '→ ' : '← ') + j.map(x => jmeno(x.ridic)).join(', ') };
  if (v[typ] === J.SAM && v.clenove.some(c => (clen(c) || {}).odvoz)) return { t: (typ === 'tam' ? '→ ' : '← ') + 'sám' };
  if (nav && Object.keys(nav).length && typ === 'zpet') return { t: '← navazuje' };
  return null;
}

/* ---------- vykreslení ---------- */
function obnovListu() {
  const ne = J.pridejDny(tydenOd, 6), t = J.isoTyden(tydenOd);
  $('tydenPopis').textContent = `${t}. týden · ${J.formatDatum(tydenOd)}–${J.formatDatum(ne, true)}`;
  $('tydenPopis').title = (t % 2 ? 'lichý' : 'sudý') + ' týden – kliknutím zpět na tento týden';
  document.querySelectorAll('[data-pohled]').forEach(b => b.setAttribute('aria-pressed', b.dataset.pohled === pohled));
  const n = T.reduce((s, d) => s + d.kolize.length, 0);
  $('odznak').textContent = n; $('odznak').classList.toggle('nula', !n);
}
function filtrHtml(sJizdami) {
  if (!data.clenove.length) return '';
  return `<div class="filtr">${data.clenove.map(c => `<button class="cip" data-skryj="${esc(c.id)}" aria-pressed="${!skryti.has(c.id)}" style="--c:${c.barva}"><i></i><span data-i18n="ne">${esc(c.jmeno)}</span></button>`).join('')}
    ${sJizdami ? `<span class="vpravo"><label><input type="checkbox" id="chJizdy" ${jizdyVMrizce ? 'checked' : ''}> 🚗 jízdy řidičů (pruh vpravo)</label></span>` : ''}</div>`;
}
function prazdnoHtml() {
  return `<div class="prazdno">Rozvrh je zatím prázdný.<br>
    Začněte <button class="btn" data-prikaz="novyClen">👤 členy rodiny</button>, pak přidejte <button class="btn" data-prikaz="noveMisto">📍 místa</button> a <button class="btn primary" data-prikaz="novaAktivita">✚ aktivity</button>.<br>
    Nebo si nejdřív prohlédněte <button class="btn" data-prikaz="ukazka">🧪 ukázkovou rodinu</button>.</div>`;
}

/* rozložení překrývajících se bloků do pruhů */
function pruhy(polozky) {
  const s = polozky.slice().sort((a, b) => a.zac - b.zac || b.kon - a.kon);
  let shluk = [], konShluku = -1;
  const uzavri = () => { const n = Math.max(...shluk.map(p => p.pruh)) + 1; shluk.forEach(p => { p.pruhu = n; }); shluk = []; };
  for (const p of s) {
    if (shluk.length && p.zac >= konShluku) uzavri();
    const obsazene = new Set(shluk.filter(q => q.kon > p.zac).map(q => q.pruh));
    let i = 0; while (obsazene.has(i)) i++;
    p.pruh = i; shluk.push(p); konShluku = Math.max(konShluku, p.kon);
  }
  if (shluk.length) uzavri();
  return s;
}

function vykresliTyden() {
  if (!data.aktivity.length && !data.clenove.length) { $('obsah').innerHTML = prazdnoHtml(); return; }
  const dnes = J.dnesIso();
  let min = 7 * 60, max = 18 * 60;
  const dny = T.map(den => {
    const pol = [];
    for (const v of den.vyskyty) if (viditelnyVyskyt(v)) pol.push({ zac: v.od, kon: v.do, v });
    if (jizdyVMrizce) for (const j of den.jizdy) if (viditelnaJizda(j)) pol.push({ zac: j.zac, kon: j.kon, j });
    for (const p of pol) { min = Math.min(min, Math.floor(p.zac / 60) * 60); max = Math.max(max, Math.ceil(p.kon / 60) * 60); }
    return { den, pol };
  });
  min = Math.max(0, min); max = Math.min(24 * 60, max);
  const H = 56, k = H / 60, OFF = 8, vyska = (max - min) * k + 2 * OFF, R = jizdyVMrizce ? 20 : 0; // R = pás jízd vpravo (px)
  let h = filtrHtml(true) + `<div class="tab-obal obal-mrizky"><div class="mrizka" style="--h:${H}px">`;
  h += '<div class="hlava"></div>' + T.map((den, i) => {
    const sv = J.svatek(den.datum), nk = den.kolize.length;
    return `<div class="hlava${den.datum === dnes ? ' dnes' : ''}">${J.DNY[i]} ${J.formatDatum(den.datum)}<small>${sv ? `<span class="svatek">${esc(sv)}</span>` : nk ? `<span class="chyba-txt">⚠️ ${nk}</span>` : '&nbsp;'}</small></div>`;
  }).join('');
  h += `<div class="osa" style="height:${vyska}px">`;
  for (let m = min; m <= max; m += 60) h += `<span style="top:${(m - min) * k + OFF}px">${m / 60}:00</span>`;
  h += '</div>';
  dny.forEach(({ den, pol }, i) => {
    h += `<div class="den${i >= 5 ? ' vikend' : ''}" style="height:${vyska}px">`;
    for (const p of pruhy(pol.filter(x => x.v)).concat(pruhy(pol.filter(x => x.j)))) {
      const top = (p.zac - min) * k + OFF, vys = Math.max((p.kon - p.zac) * k, p.j ? 10 : 16);
      const styl = `top:${top}px;height:${vys}px;` + (p.v
        ? `left:calc((100% - ${R}px) * ${p.pruh / p.pruhu} + 2px);width:calc((100% - ${R}px) / ${p.pruhu} - 3px)`
        : `left:calc(100% - ${R}px + ${R * p.pruh / p.pruhu}px);width:${R / p.pruhu - 1}px`);
      if (p.v) {
        const v = p.v, kol = kolizeVyskytu(den, v), ids = v.zruseno ? v.puvodniClenove : v.clenove;
        const tam = odvozPopis(v, den, 'tam'), zpet = odvozPopis(v, den, 'zpet');
        const vice = ids.length > 1;
        const pruhyBarev = vice ? ids.map((c, x) => `${barva(c)} ${x * 100 / ids.length}% ${(x + 1) * 100 / ids.length}%`).join(',') : '';
        if (p.pruhu >= 3 && vys >= 90) { // úzký sloupec: jen svislý popisek, detail v bublině
          h += `<div class="blok svisle${v.zruseno ? ' zruseno' : ''}${kol.length ? ' kolize' : ''}" style="${styl};--c:${barva(ids[0])}" data-aktivita="${esc(v.aktivita.id)}"
            title="${esc(`${v.nazev} ${cas(v.od)}–${cas(v.do)} · ${misto(v.misto)} · ${ids.map(jmeno).join(', ')}${tam ? '\n🚗 ' + tam.t : ''}${zpet ? '\n🚗 ' + zpet.t : ''}${v.zruseno ? '\nZRUŠENO: ' + v.duvod : ''}${kol.length ? '\n⚠️ ' + kol.map(x => x.text).join('\n⚠️ ') : ''}`)}">
            <b>${kol.length || (tam && tam.chybi) || (zpet && zpet.chybi) ? '⚠️ ' : ''}<span data-i18n="ne">${esc(v.nazev)}</span></b> <span class="r">${cas(v.od)}–${cas(v.do)} · <span data-i18n="ne">${esc(ids.map(jmeno).join(', '))}</span></span></div>`;
          continue;
        }
        h += `<div class="blok${v.zruseno ? ' zruseno' : ''}${kol.length ? ' kolize' : ''}${vice ? ' pruh' : ''}" style="${styl};--c:${barva(ids[0])}${vice ? `;--pruhy:${pruhyBarev}` : ''}" data-aktivita="${esc(v.aktivita.id)}"
          title="${esc(`${v.nazev} ${cas(v.od)}–${cas(v.do)} · ${misto(v.misto)} · ${ids.map(jmeno).join(', ')}${v.zruseno ? ' · ZRUŠENO: ' + v.duvod : ''}${kol.length ? '\n⚠️ ' + kol.map(x => x.text).join('\n⚠️ ') : ''}`)}">
          <b>${kol.length ? '⚠️ ' : ''}<span data-i18n="ne">${esc(v.nazev)}</span></b>
          <div class="r">${cas(v.od)}–${cas(v.do)} · <span data-i18n="ne">${esc(misto(v.misto))}</span></div>
          <div class="r">${tecky(ids)}<span data-i18n="ne">${esc(ids.map(jmeno).join(', '))}</span></div>
          ${v.zruseno ? `<div class="r" data-i18n="ne">✖ ${esc(v.duvod)}</div>` : ''}
          ${tam ? `<div class="odvoz-r${tam.chybi ? ' chybi' : ''}">🚗 ${esc(tam.t)}</div>` : ''}${zpet ? `<div class="odvoz-r${zpet.chybi ? ' chybi' : ''}">🚗 ${esc(zpet.t)}</div>` : ''}
        </div>`;
      } else {
        const j = p.j, kol = kolizeJizdy(den, j);
        h += `<div class="blok jizda${kol.length ? ' kolize' : ''}" style="${styl};--c:${barva(j.ridic)}" data-aktivita="${esc(j.vyskyty[0].aktivita.id)}"
          title="${esc(`🚗 ${jmeno(j.ridic)} veze ${j.pasazeri.map(jmeno).join(', ')}: ${trasa(j)}, ${cas(j.zac)}–${cas(j.kon)} (cesta ${j.cesta} min${j.odhad ? ', odhad' : ''})${kol.length ? '\n⚠️ ' + kol.map(x => x.text).join('\n⚠️ ') : ''}`)}">
          </div>`;
      }
    }
    h += '</div>';
  });
  h += '</div></div>';
  // úzký displej: seznam po dnech
  h += '<div class="dny-seznam">' + dny.map(({ den, pol }, i) => {
    const sv = J.svatek(den.datum);
    const radky = pol.slice().sort((a, b) => a.zac - b.zac).map(p => {
      if (p.v) {
        const v = p.v, kol = kolizeVyskytu(den, v), ids = v.zruseno ? v.puvodniClenove : v.clenove;
        const od = [odvozPopis(v, den, 'tam'), odvozPopis(v, den, 'zpet')].filter(Boolean);
        return `<div class="polozka${v.zruseno ? ' zruseno' : ''}${kol.length ? ' kolize' : ''}" style="--c:${barva(ids[0])}" data-aktivita="${esc(v.aktivita.id)}">
          <span class="cas">${cas(v.od)}–${cas(v.do)}</span><span><b data-i18n="ne">${kol.length ? '⚠️ ' : ''}${esc(v.nazev)}</b> · <span data-i18n="ne">${esc(misto(v.misto))}</span><br>${jmenaHtml(ids)}
          ${od.length ? '<br>🚗 ' + od.map(o => `<span class="${o.chybi ? 'chyba-txt' : 'mute'}">${esc(o.t)}</span>`).join(' ') : ''}${v.zruseno ? `<br><span data-i18n="ne">✖ ${esc(v.duvod)}</span>` : ''}</span></div>`;
      }
      const j = p.j, kol = kolizeJizdy(den, j);
      return `<div class="polozka jizda${kol.length ? ' kolize' : ''}" style="--c:${barva(j.ridic)}" data-aktivita="${esc(j.vyskyty[0].aktivita.id)}"><span class="cas">${cas(j.zac)}–${cas(j.kon)}</span><span data-i18n="ne">🚗 ${esc(jmeno(j.ridic))} → ${esc(j.pasazeri.map(jmeno).join(', '))}: ${esc(trasa(j))}</span></div>`;
    }).join('');
    return `<div class="den-karta${den.datum === dnes ? ' dnes' : ''}"><h3><span>${J.DNY_DLOUHE[i]} ${J.formatDatum(den.datum)}</span><span class="${sv ? 'chyba-txt' : den.kolize.length ? 'chyba-txt' : 'mute'}">${sv ? esc(sv) : den.kolize.length ? '⚠️ ' + den.kolize.length : ''}</span></h3>${radky || '<div class="polozka mute" style="--c:transparent;cursor:default">volno</div>'}</div>`;
  }).join('') + '</div>';
  $('obsah').innerHTML = h;
}

function bunkaOsoby(den, c) {
  const pol = [];
  for (const v of den.vyskyty) {
    if (!v.puvodniClenove.includes(c.id)) continue;
    const omluven = !v.zruseno && !v.clenove.includes(c.id), kol = kolizeVyskytu(den, v).filter(k => k.clen === c.id || k.typ === 'bezOdvozu');
    const vezou = c.odvoz ? ['tam', 'zpet'].map(t => odvozPopis(v, den, t)).filter(Boolean).map(o => o.t).join(' ') : '';
    pol.push({ zac: v.od, h: `<div class="p${v.zruseno || omluven ? ' zruseno' : ''}${kol.length ? ' kolize' : ''}" data-aktivita="${esc(v.aktivita.id)}" style="cursor:pointer"><b>${cas(v.od)}–${cas(v.do)}</b> <span data-i18n="ne">${esc(v.nazev)}</span><br><span class="mute" data-i18n="ne">${esc(misto(v.misto))}</span>${vezou ? `<br><span class="${/nikdo/.test(vezou) ? 'chyba-txt' : 'mute'}">🚗 ${esc(vezou)}</span>` : ''}</div>` });
  }
  for (const j of den.jizdy) {
    if (j.ridic !== c.id) continue;
    const kol = kolizeJizdy(den, j);
    pol.push({ zac: j.zac, h: `<div class="p${kol.length ? ' kolize' : ''}" data-aktivita="${esc(j.vyskyty[0].aktivita.id)}" style="cursor:pointer">🚗 <b>${cas(j.zac)}–${cas(j.kon)}</b> <span data-i18n="ne">${esc(j.pasazeri.map(jmeno).join(', '))}: ${esc(trasa(j))}</span></div>` });
  }
  return pol.sort((a, b) => a.zac - b.zac).map(p => p.h).join('');
}
function vykresliOsoby() {
  if (!data.clenove.length) { $('obsah').innerHTML = prazdnoHtml(); return; }
  const dnes = J.dnesIso();
  let h = filtrHtml(false) + '<p class="tip">Každý člen na řádku: jeho aktivity a 🚗 jízdy, které řídí. Červeně kolize, přeškrtnuté zrušené nebo omluvené.</p>';
  h += `<div class="tab-obal"><table class="osoby-tab"><thead><tr><th></th>${T.map((d, i) => `<th class="${d.datum === dnes ? 'dnes' : ''}">${J.DNY[i]} ${J.formatDatum(d.datum)}</th>`).join('')}</tr></thead><tbody>`;
  for (const c of data.clenove) {
    if (skryti.has(c.id)) continue;
    h += `<tr><td class="jm-b" style="--c:${c.barva}" data-i18n="ne">${esc(c.jmeno)}</td>${T.map(d => `<td>${bunkaOsoby(d, c)}</td>`).join('')}</tr>`;
  }
  $('obsah').innerHTML = h + '</tbody></table></div>';
}

function selectOdvozu(hodnota, attr, sBezeZmeny) {
  const o = [];
  if (sBezeZmeny) o.push(`<option value="__nic"${hodnota == null ? ' selected' : ''}>beze změny</option>`);
  o.push(`<option value=""${hodnota === '' ? ' selected' : ''}>— nikdo</option>`, `<option value="${J.SAM}"${hodnota === J.SAM ? ' selected' : ''}>🚶 sám / bus</option>`);
  for (const c of ridici()) o.push(`<option value="${esc(c.id)}"${hodnota === c.id ? ' selected' : ''}>🚗 ${esc(c.jmeno)}</option>`);
  if (hodnota && hodnota !== J.SAM && !ridici().some(c => c.id === hodnota) && clen(hodnota)) o.push(`<option value="${esc(hodnota)}" selected>${esc(jmeno(hodnota))}</option>`);
  return `<select class="vstup mini" ${attr}>${o.join('')}</select>`;
}
function vykresliOdvozy() {
  if (!data.clenove.length) { $('obsah').innerHTML = prazdnoHtml(); return; }
  // souhrn řidičů
  const souhrn = {};
  for (const d of T) for (const j of d.jizdy) { const s = souhrn[j.ridic] = souhrn[j.ridic] || { n: 0, min: 0 }; s.n++; s.min += j.kon - j.zac; }
  let h = '';
  if (ridici().length) h += '<div class="ridici">' + ridici().map(c => { const s = souhrn[c.id] || { n: 0, min: 0 };
    return `<div class="ridic-karta" style="--c:${c.barva}"><span data-i18n="ne">${esc(c.jmeno)}</span><br><b>${s.n}</b> jízd · ${Math.floor(s.min / 60)} h ${s.min % 60} min za volantem</div>`; }).join('') + '</div>';
  else h += '<div class="prazdno">Nikdo z rodiny nemá zaškrtnuto „Řídí“. Upravte člena v <i>Rodina a plán</i>.</div>';
  h += `<div class="filtr"><span class="mute" style="font-size:.82rem">Změna v tabulce platí</span>
    <label class="zaskrt"><input type="radio" name="odvozRezim" value="vzor" ${!odvozJenTyden ? 'checked' : ''}> každý týden</label>
    <label class="zaskrt"><input type="radio" name="odvozRezim" value="den" ${odvozJenTyden ? 'checked' : ''}> jen pro tento den (výjimka)</label></div>`;
  let radky = '';
  T.forEach((den, i) => {
    for (const v of den.vyskyty) {
      if (v.zruseno || !v.clenove.some(c => (clen(c) || {}).odvoz) || !viditelnyVyskyt(v)) continue;
      const deti = v.clenove.filter(c => (clen(c) || {}).odvoz);
      const nav = den.navaznosti[v.id] || { tam: {}, zpet: {} };
      const bunka = typ => {
        const j = den.jizdy.filter(x => x.typ === typ && x.vyskyty.includes(v));
        const chybi = den.chybi.some(c => c.vyskyt === v && c.typ === typ);
        const navTxt = Object.keys(nav[typ]).length ? (typ === 'tam' ? `z ${misto(Object.values(nav[typ])[0].misto)}` : `navazuje ${Object.values(nav[typ])[0].nazev}`) : '';
        const potreba = j.length || chybi;
        const info = j.length ? j.map(x => `${cas(x.zac)}–${cas(x.kon)} ${trasa(x)}`).join('; ') : (!potreba && navTxt ? navTxt : (!potreba ? 'není potřeba' : ''));
        return `${potreba || v[typ] ? selectOdvozu(v[typ], `data-odvoz="${typ}" data-aktivita-id="${esc(v.aktivita.id)}" data-datum="${den.datum}" aria-label="${typ === 'tam' ? 'Tam veze' : 'Zpět vyzvedává'}"`) : ''}
          <div class="mute" style="font-size:.74rem" data-i18n="ne">${chybi ? '<span class="chyba-txt">⚠️ chybí řidič</span> ' : ''}${esc(info)}${v.zmenaOdvozu ? ' · výjimka' : ''}</div>`;
      };
      radky += `<tr><td class="jm">${J.DNY[i]} ${J.formatDatum(den.datum)}</td><td class="jm">${cas(v.od)}–${cas(v.do)}</td><td><b data-i18n="ne">${esc(v.nazev)}</b><br><span class="mute" data-i18n="ne">${esc(misto(v.misto))}</span></td><td>${jmenaHtml(deti)}</td><td>${bunka('tam')}</td><td>${bunka('zpet')}</td></tr>`;
    }
  });
  h += radky ? `<div class="tab-obal"><table class="odvozy-tab"><thead><tr><th>Den</th><th>Čas</th><th>Aktivita</th><th>Kdo jede</th><th>🚗 Tam veze</th><th>🚗 Zpět vyzvedává</th></tr></thead><tbody>${radky}</tbody></table></div>`
    : '<div class="prazdno">Tento týden nikdo nepotřebuje odvoz. Člen, kterého je třeba vozit, má zaškrtnuto „Potřebuje odvoz“.</div>';
  $('obsah').innerHTML = h;
}

const IKONY_KOLIZE = { prekryv: '⛔', presun: '⏱️', ridic: '🚗', bezOdvozu: '🧒' };
function vykresliKolize() {
  const vse = [];
  T.forEach((d, i) => d.kolize.forEach(k => vse.push({ k, i })));
  let h = '<p class="tip">⛔ člověk na dvou místech · 🚗 řidič nestíhá · 🧒 dítě bez odvozu · ⏱️ nestihnutelný přesun (varování). Doby přejezdů bez ručního zadání jsou odhad přes domov – upřesněte je v <i>Rodina a plán → Přejezdy</i>.</p>';
  if (!vse.length) h += `<div class="prazdno">✅ Tento týden žádné kolize.${data.aktivity.length ? '' : ' (Zatím nejsou žádné aktivity.)'}</div>`;
  else {
    h += '<div class="kolize-seznam">' + vse.map(({ k, i }) => {
      const akt = k.vyskyt ? k.vyskyt.aktivita : (k.polozky.find(p => p.vyskyt) || {}).vyskyt;
      const aid = akt ? (akt.aktivita || akt).id : (k.polozky[0].jizda.vyskyty[0].aktivita.id);
      return `<div class="kol${k.zavaznost === 'varovani' ? ' varovani' : ''}"><span class="ik">${IKONY_KOLIZE[k.typ]}</span><div class="txt-k"><div class="mute">${J.DNY_DLOUHE[i]} ${J.formatDatum(k.datum)}</div><span data-i18n="ne">${esc(k.text)}</span></div><button class="btn mini" data-aktivita="${esc(aid)}">✎ Upravit</button></div>`;
    }).join('') + '</div>';
  }
  $('obsah').innerHTML = h;
}

function popisDnu(a) {
  if (a.opakovani === 'jednou') return J.formatDatum(a.datum, true);
  return a.dny.map(d => J.DNY[d]).join(', ') + (a.opakovani !== 'kazdy' ? ' · ' + J.OPAKOVANI[a.opakovani] : '');
}
function popisVyjimky(v) {
  const c = [];
  if (v.kategorie.length) c.push(v.kategorie.map(k => J.KAT[k].nazev).join(', '));
  if (v.clenove.length) c.push(v.clenove.map(jmeno).join(', '));
  if (v.aktivity.length) c.push(v.aktivity.map(id => (data.aktivity.find(a => a.id === id) || {}).nazev).filter(Boolean).join(', '));
  return c.join(' · ') || 'vše';
}
function vykresliPlan() {
  let h = `<h2 class="skupina">👥 Členové rodiny <button class="btn mini" data-prikaz="novyClen">✚ Člen</button></h2>`;
  h += data.clenove.length ? '<div class="clenove">' + data.clenove.map(c => `<div class="clen-karta" style="--c:${c.barva}"><span class="jm" data-i18n="ne">${esc(c.jmeno)}</span>
    ${c.ridic ? '<span class="znacka">🚗 řídí</span>' : ''}${c.odvoz ? '<span class="znacka">🧒 potřebuje odvoz</span>' : ''}<button class="btn mini" data-clen="${esc(c.id)}" aria-label="Upravit">✎</button></div>`).join('') + '</div>'
    : '<p class="tip">Zatím nikdo. Přidejte rodiče (řídí) a děti (potřebují odvoz).</p>';

  h += `<h2 class="skupina">📍 Místa <button class="btn mini" data-prikaz="noveMisto">✚ Místo</button></h2>`;
  h += `<div class="tab-obal"><table><thead><tr><th>Místo</th><th class="cislo">Cesta z domova</th><th>Adresa</th><th></th></tr></thead><tbody>
    <tr><td>${esc(J.DOMOV.nazev)}</td><td class="cislo">0 min</td><td></td><td></td></tr>` +
    data.mista.map(m => `<tr><td data-i18n="ne">${esc(m.nazev)}</td><td class="cislo">${m.cesta} min</td><td data-i18n="ne">${esc(m.adresa)}</td><td><div class="akce"><button class="btn mini" data-misto="${esc(m.id)}" aria-label="Upravit">✎</button></div></td></tr>`).join('') + '</tbody></table></div>';
  if (data.mista.length >= 2) {
    h += `<h2 class="skupina">🔀 Přejezdy mezi místy (minuty)</h2><p class="tip">Prázdné pole = odhad přes domov (šedě). Zadejte skutečnou dobu, pokud jsou místa blízko sebe – jinak se hlásí falešné kolize.</p>
      <div class="tab-obal"><table class="matice"><thead><tr><th></th>${data.mista.map(m => `<th data-i18n="ne">${esc(m.nazev)}</th>`).join('')}</tr></thead><tbody>` +
      data.mista.map((a, i) => `<tr><th data-i18n="ne">${esc(a.nazev)}</th>${data.mista.map((b, j) => j <= i ? '<td></td>' :
        `<td><input class="vstup" type="number" min="0" max="600" data-prejezd="${esc(a.id)}|${esc(b.id)}" value="${J.jeOdhad(data, a.id, b.id) ? '' : J.cesta(data, a.id, b.id)}" placeholder="${a.cesta + b.cesta}" aria-label="${esc(a.nazev)} – ${esc(b.nazev)}"></td>`).join('')}</tr>`).join('') + '</tbody></table></div>';
  }

  h += `<h2 class="skupina">📋 Aktivity <button class="btn mini" data-prikaz="novaAktivita">✚ Aktivita</button></h2>`;
  const akt = data.aktivity.slice().sort((a, b) => (a.clenove[0] || '').localeCompare(b.clenove[0] || '') || a.od.localeCompare(b.od));
  h += akt.length ? `<div class="tab-obal"><table><thead><tr><th>Aktivita</th><th>Kdo</th><th>Kdy</th><th>Čas</th><th>Místo</th><th>Platnost</th><th></th></tr></thead><tbody>` +
    akt.map(a => `<tr><td><b data-i18n="ne">${esc(a.nazev)}</b><br><span class="mute">${J.KAT[a.kategorie].nazev}</span></td><td>${jmenaHtml(a.clenove)}</td><td>${esc(popisDnu(a))}</td><td class="jm">${a.od}–${a.do}</td>
      <td data-i18n="ne">${esc(misto(a.misto))}</td><td class="jm">${a.platOd || a.platDo ? `${J.formatDatum(a.platOd, true) || '…'} – ${J.formatDatum(a.platDo, true) || '…'}` : '<span class="mute">stále</span>'}</td>
      <td><div class="akce"><button class="btn mini" data-aktivita="${esc(a.id)}" aria-label="Upravit">✎</button></div></td></tr>`).join('') + '</tbody></table></div>'
    : '<p class="tip">Žádné aktivity.</p>';

  h += `<h2 class="skupina">🏖️ Výjimky <button class="btn mini" data-prikaz="prazdniny">✚ Prázdniny</button><button class="btn mini" data-prikaz="novaVyjimka">✚ Zrušení / odvoz</button></h2>`;
  const vy = data.vyjimky.slice().sort((a, b) => a.od.localeCompare(b.od));
  h += vy.length ? `<div class="tab-obal"><table><thead><tr><th>Období</th><th>Co</th><th>Týká se</th><th></th></tr></thead><tbody>` +
    vy.map(v => `<tr><td class="jm">${J.formatDatum(v.od, true)}${v.do !== v.od ? ' – ' + J.formatDatum(v.do, true) : ''}</td><td>${v.druh === 'odvoz' ? '🚗 jiný odvoz' : '✖️ zrušeno'}${v.nazev ? ` · <span data-i18n="ne">${esc(v.nazev)}</span>` : ''}${v.druh === 'odvoz' ? `<br><span class="mute">tam: ${v.tam == null ? 'beze změny' : esc(jmeno(v.tam) || 'nikdo')}, zpět: ${v.zpet == null ? 'beze změny' : esc(jmeno(v.zpet) || 'nikdo')}</span>` : ''}</td>
      <td data-i18n="ne">${esc(popisVyjimky(v))}</td><td><div class="akce"><button class="btn mini" data-vyjimka="${esc(v.id)}" aria-label="Upravit">✎</button></div></td></tr>`).join('') + '</tbody></table></div>'
    : '<p class="tip">Žádné výjimky. Prázdniny zruší školu a kroužky, zrušení může omluvit jen jednoho člena (nemoc).</p>';

  const n = data.nastaveni;
  h += `<h2 class="skupina">🔧 Nastavení</h2><div class="nastaveni-form">
    <label>Rezerva na předání u každé jízdy <input class="vstup" type="number" min="0" max="60" data-nast="rezerva" value="${n.rezerva}"> min</label>
    <label>Aktivity navazují, když mezi nimi je nejvýš <input class="vstup" type="number" min="0" max="240" data-nast="navazuje" value="${n.navazuje}"> min (dítě se veze rovnou z jedné na druhou)</label>
    <label><input type="checkbox" data-nast="svatky" ${n.svatky ? 'checked' : ''}> České státní svátky ruší:</label>
    <div class="volby">${J.KATEGORIE.map(k => `<label><input type="checkbox" data-nast-kat="${k.id}" ${n.svatkyKategorie.includes(k.id) ? 'checked' : ''}> ${k.nazev}</label>`).join('')}</div>
  </div>`;
  $('obsah').innerHTML = h;
}

function vykresli() {
  T = J.tyden(data, tydenOd);
  obnovListu();
  if (pohled === 'osoby') vykresliOsoby();
  else if (pohled === 'odvozy') vykresliOdvozy();
  else if (pohled === 'kolize') vykresliKolize();
  else if (pohled === 'plan') vykresliPlan();
  else vykresliTyden();
}
function zmena() { uloz(); vykresli(); }

/* ---------- dialogy ---------- */
function otevri(dlg) {
  return new Promise(res => {
    dlg.addEventListener('close', () => res(dlg.returnValue), { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}
function zaskrtavatka(el, polozky, vybrane, jmenoPole) {
  el.innerHTML = polozky.map(p => `<label${p.barva ? ` style="--c:${p.barva}"` : ''}><input type="checkbox" name="${jmenoPole}" value="${esc(p.id)}" ${vybrane.includes(p.id) ? 'checked' : ''}>${p.barva ? `<span class="tecka" style="--c:${p.barva}"></span>` : ''}<span data-i18n="ne">${esc(p.nazev)}</span></label>`).join('') || '<span class="mute">—</span>';
}
const zaskrtnute = (f, jm) => [...f.querySelectorAll(`input[name="${jm}"]:checked`)].map(i => i.value);

async function upravClena(c) {
  const dlg = $('dlgClen'), f = dlg.querySelector('form'), novy = !c;
  c = c || J.normClen({ jmeno: '' }, data.clenove.length);
  $('dlgClenTitul').textContent = novy ? '👤 Nový člen' : '✎ ' + c.jmeno;
  f.jmeno.value = novy ? '' : c.jmeno; f.ridic.checked = c.ridic; f.odvoz.checked = c.odvoz;
  let b = c.barva;
  const kresli = () => { $('paleta').innerHTML = J.BARVY.map(x => `<button type="button" data-barva="${x}" style="--c:${x};${x === b ? 'border-color:var(--text)' : ''}" aria-label="Barva ${x}"></button>`).join('') + `<input type="color" value="${b}" aria-label="Vlastní barva">`; };
  kresli();
  $('paleta').onclick = e => { const x = e.target.closest('[data-barva]'); if (x) { b = x.dataset.barva; kresli(); } };
  $('paleta').oninput = e => { if (e.target.type === 'color') b = e.target.value; };
  $('dlgClenSmaz').hidden = novy;
  $('dlgClenSmaz').onclick = async () => {
    if (!await Dialog.potvrd(`Smazat člena „${c.jmeno}“? Zmizí z aktivit a odvozů.`)) return;
    J.smazClena(data, c.id); dlg.close('smazano'); zmena();
  };
  if (await otevri(dlg) !== 'ok') return;
  const n = J.normClen(Object.assign({}, c, { jmeno: f.jmeno.value, barva: b, ridic: f.ridic.checked, odvoz: f.odvoz.checked }));
  if (novy) data.clenove.push(n); else Object.assign(c, n);
  zmena();
}

async function upravMisto(m) {
  const dlg = $('dlgMisto'), f = dlg.querySelector('form'), novy = !m;
  m = m || J.normMisto({ nazev: '', cesta: 10 });
  $('dlgMistoTitul').textContent = novy ? '📍 Nové místo' : '✎ ' + m.nazev;
  f.nazev.value = novy ? '' : m.nazev; f.cesta.value = m.cesta; f.adresa.value = m.adresa;
  $('dlgMistoSmaz').hidden = novy;
  $('dlgMistoSmaz').onclick = async () => {
    const n = data.aktivity.filter(a => a.misto === m.id).length;
    if (!await Dialog.potvrd(`Smazat místo „${m.nazev}“?${n ? ` ${n} aktivit se přesune na Domov.` : ''}`)) return;
    J.smazMisto(data, m.id); dlg.close('smazano'); zmena();
  };
  if (await otevri(dlg) !== 'ok') return null;
  const n = J.normMisto(Object.assign({}, m, { nazev: f.nazev.value, cesta: f.cesta.value, adresa: f.adresa.value }));
  if (novy) data.mista.push(n); else Object.assign(m, n);
  zmena();
  return n;
}

function odvozRadky(f, odvoz) {
  const jednou = f.opakovani.value === 'jednou';
  const dny = jednou ? (J.jeDatum(f.datum.value) ? [J.denTydne(f.datum.value)] : []) : zaskrtnute(f, 'den').map(Number);
  const vybrani = zaskrtnute(f, 'clen'), deti = vybrani.some(c => (clen(c) || {}).odvoz);
  $('akOdvozPole').hidden = !dny.length || !vybrani.length;
  // zapamatovat rozepsané hodnoty
  f.querySelectorAll('[data-od-den]').forEach(s => { const d = s.dataset.odDen; odvoz[d] = odvoz[d] || { tam: '', zpet: '' }; odvoz[d][s.dataset.typ] = s.value; });
  let h = `<span class="h">Den</span><span class="h">Tam veze</span><span class="h">Zpět vyzvedává</span>`;
  for (const d of dny) {
    const o = odvoz[d] || { tam: '', zpet: '' };
    h += `<span>${J.DNY[d]}</span>${selectOdvozu(o.tam, `data-od-den="${d}" data-typ="tam" aria-label="${J.DNY[d]} tam"`)}${selectOdvozu(o.zpet, `data-od-den="${d}" data-typ="zpet" aria-label="${J.DNY[d]} zpět"`)}`;
  }
  if (dny.length > 1) h += `<span></span><button type="button" class="btn mini" id="odvozStejne" style="grid-column:span 2">⇩ Jako ${J.DNY[dny[0]]} pro všechny dny</button>`;
  if (!deti) h += '<span class="h" style="grid-column:1/-1">Nikdo z vybraných nepotřebuje odvoz – vyplňte, jen pokud chcete jízdu mít v rozvrhu řidiče.</span>';
  $('akOdvoz').innerHTML = h;
  const st = $('odvozStejne');
  if (st) st.onclick = () => { const p = odvoz[dny[0]] || {}; f.querySelectorAll('[data-od-den]').forEach(s => { s.value = p[s.dataset.typ] || ''; }); f.querySelectorAll('[data-od-den]').forEach(s => { odvoz[s.dataset.odDen] = odvoz[s.dataset.odDen] || {}; odvoz[s.dataset.odDen][s.dataset.typ] = s.value; }); };
}
async function upravAktivitu(a, predvyplneni) {
  const dlg = $('dlgAktivita'), f = dlg.querySelector('form'), novy = !a;
  if (!data.clenove.length) { await Dialog.info('Nejdřív přidejte členy rodiny.'); return upravClena(null); }
  a = a || J.normAktivita(Object.assign({ nazev: '', dny: [0, 1, 2, 3, 4], od: '08:00', do: '12:00', clenove: skryti.size ? data.clenove.filter(c => !skryti.has(c.id)).slice(0, 1).map(c => c.id) : [] }, predvyplneni || {}));
  $('dlgAktivitaTitul').textContent = novy ? '✚ Nová aktivita' : '✎ ' + a.nazev;
  f.nazev.value = novy ? '' : a.nazev;
  f.kategorie.innerHTML = J.KATEGORIE.map(k => `<option value="${k.id}">${k.nazev}</option>`).join(''); f.kategorie.value = a.kategorie;
  zaskrtavatka($('akClenove'), data.clenove.map(c => ({ id: c.id, nazev: c.jmeno, barva: c.barva })), a.clenove, 'clen');
  const plnMista = vyber => { f.misto.innerHTML = [J.DOMOV].concat(data.mista).map(m => `<option value="${esc(m.id)}">${esc(m.nazev)}</option>`).join('') + '<option value="__nove">✚ Nové místo…</option>'; f.misto.value = vyber; };
  plnMista(a.misto);
  f.opakovani.innerHTML = Object.entries(J.OPAKOVANI).map(([k, v]) => `<option value="${k}">${v}</option>`).join(''); f.opakovani.value = a.opakovani;
  zaskrtavatka($('akDny'), J.DNY.map((d, i) => ({ id: String(i), nazev: d })), a.dny.map(String), 'den');
  f.datum.value = a.datum || J.dnesIso(); f.od.value = a.od; f.do.value = a.do; f.platOd.value = a.platOd; f.platDo.value = a.platDo; f.poznamka.value = a.poznamka;
  const odvoz = JSON.parse(JSON.stringify(a.odvoz));
  const nastav = () => {
    const jednou = f.opakovani.value === 'jednou';
    $('akDnyPole').hidden = jednou; $('akDatumPole').hidden = !jednou; $('akPlatnost').hidden = jednou;
    odvozRadky(f, odvoz);
  };
  f.opakovani.onchange = f.datum.onchange = nastav;
  $('akDny').onchange = $('akClenove').onchange = nastav;
  f.misto.onchange = async () => {
    if (f.misto.value !== '__nove') return;
    const m = await upravMisto(null); // dialog nad dialogem
    plnMista(m ? m.id : a.misto);
  };
  nastav();
  const sber = () => {
    odvozRadky(f, odvoz);
    return J.normAktivita({ id: a.id, nazev: f.nazev.value, kategorie: f.kategorie.value, clenove: zaskrtnute(f, 'clen'), misto: f.misto.value === '__nove' ? 'domov' : f.misto.value,
      dny: zaskrtnute(f, 'den').map(Number), od: f.od.value, do: f.do.value, opakovani: f.opakovani.value, datum: f.datum.value,
      platOd: f.platOd.value, platDo: f.platDo.value, odvoz, poznamka: f.poznamka.value });
  };
  $('dlgAktivitaSmaz').hidden = novy; $('dlgAktivitaKopie').hidden = novy;
  $('dlgAktivitaSmaz').onclick = async () => {
    if (!await Dialog.potvrd(`Smazat aktivitu „${a.nazev}“?`)) return;
    J.smazAktivitu(data, a.id); dlg.close('smazano'); zmena();
  };
  $('dlgAktivitaKopie').onclick = () => {
    if (!f.reportValidity()) return;
    const n = sber(); n.id = J.novyId('a'); n.nazev = f.nazev.value.trim() + ' (kopie)';
    data.aktivity.push(n); dlg.close('kopie'); zmena(); upravAktivitu(n);
  };
  const r = await otevri(dlg);
  if (r !== 'ok') return;
  const n = sber();
  if (!n.clenove.length) { await Dialog.chyba('Vyberte, koho se aktivita týká.'); return upravAktivitu(novy ? null : a, novy ? n : null); }
  if (n.opakovani !== 'jednou' && !n.dny.length) { await Dialog.chyba('Vyberte aspoň jeden den v týdnu.'); return upravAktivitu(novy ? null : a, novy ? n : null); }
  if (novy) data.aktivity.push(n); else Object.assign(a, n);
  zmena();
}

async function upravVyjimku(v, predvyplneni) {
  const dlg = $('dlgVyjimka'), f = dlg.querySelector('form'), novy = !v;
  v = v || J.normVyjimka(Object.assign({ od: J.dnesIso() }, predvyplneni || {}));
  $('dlgVyjimkaTitul').textContent = novy ? '✚ Nová výjimka' : '✎ Výjimka';
  f.druh.value = v.druh; f.nazev.value = v.nazev; f.od.value = v.od; f.do.value = v.do;
  zaskrtavatka($('vyKategorie'), J.KATEGORIE, v.kategorie, 'kat');
  zaskrtavatka($('vyClenove'), data.clenove.map(c => ({ id: c.id, nazev: c.jmeno, barva: c.barva })), v.clenove, 'clen');
  zaskrtavatka($('vyAktivity'), data.aktivity.map(a => ({ id: a.id, nazev: a.nazev + ' (' + a.clenove.map(jmeno).join(', ') + ')' })), v.aktivity, 'akt');
  f.tam.outerHTML = selectOdvozu(v.tam, 'class="vstup" name="tam"', true).replace('class="vstup mini" ', '');
  f.zpet.outerHTML = selectOdvozu(v.zpet, 'class="vstup" name="zpet"', true).replace('class="vstup mini" ', '');
  const nastav = () => { $('vyOdvoz').hidden = f.druh.value !== 'odvoz'; };
  f.druh.onchange = nastav; nastav();
  f.od.onchange = () => { if (!f.do.value || f.do.value < f.od.value) f.do.value = f.od.value; };
  $('dlgVyjimkaSmaz').hidden = novy;
  $('dlgVyjimkaSmaz').onclick = async () => {
    if (!await Dialog.potvrd('Smazat výjimku?')) return;
    data.vyjimky = data.vyjimky.filter(x => x.id !== v.id); dlg.close('smazano'); zmena();
  };
  if (await otevri(dlg) !== 'ok') return;
  const hod = s => s.value === '__nic' ? null : s.value;
  const n = J.normVyjimka({ id: v.id, druh: f.druh.value, nazev: f.nazev.value, od: f.od.value, do: f.do.value,
    kategorie: zaskrtnute(f, 'kat'), clenove: zaskrtnute(f, 'clen'), aktivity: zaskrtnute(f, 'akt'), tam: hod(f.tam), zpet: hod(f.zpet) });
  if (novy) data.vyjimky.push(n); else Object.assign(v, n);
  zmena();
}

/* ---------- tisk ---------- */
function tiskHtml(rezim) {
  const ne = J.pridejDny(tydenOd, 6);
  let h = `<h1>👨‍👩‍👧 Rodinný rozvrh · ${J.isoTyden(tydenOd)}. týden (${J.formatDatum(tydenOd)}–${J.formatDatum(ne, true)})</h1>
    <div class="leg">${data.clenove.filter(c => !skryti.has(c.id)).map(c => `<span><i style="background:${c.barva}"></i>${esc(c.jmeno)}${c.ridic ? ' 🚗' : ''}</span>`).join('')}<span>→ veze tam · ← vyzvedává</span></div>`;
  if (rezim === 'osoby') {
    h += `<table><thead><tr><th style="width:9%"></th>${T.map((d, i) => `<th>${J.DNY[i]} ${J.formatDatum(d.datum)}</th>`).join('')}</tr></thead><tbody>`;
    for (const c of data.clenove) {
      if (skryti.has(c.id)) continue;
      h += `<tr><td class="jm-b" style="border-left-color:${c.barva}">${esc(c.jmeno)}</td>${T.map(d => `<td>${bunkaOsoby(d, c).replace(/ style="cursor:pointer"/g, '')}</td>`).join('')}</tr>`;
    }
    h += '</tbody></table>';
  } else {
    h += `<table><thead><tr>${T.map((d, i) => `<th>${J.DNY_DLOUHE[i]} ${J.formatDatum(d.datum)}${J.svatek(d.datum) ? ' – ' + esc(J.svatek(d.datum)) : ''}</th>`).join('')}</tr></thead><tbody><tr>`;
    for (const den of T) {
      h += '<td>' + den.vyskyty.filter(viditelnyVyskyt).map(v => {
        const ids = v.zruseno ? v.puvodniClenove : v.clenove;
        const od = ['tam', 'zpet'].map(t => odvozPopis(v, den, t)).filter(Boolean).map(o => o.t).join(' ');
        return `<div class="tp${v.zruseno ? ' x' : ''}" style="border-left-color:${barva(ids[0])}"><b>${cas(v.od)}–${cas(v.do)} ${esc(v.nazev)}</b><br>${esc(ids.map(jmeno).join(', '))} · ${esc(misto(v.misto).replace(/^🏠 /, ''))}${od ? `<div class="o">🚗 ${esc(od)}</div>` : ''}</div>`;
      }).join('') + '</td>';
    }
    h += '</tr></tbody></table>';
  }
  const nk = T.reduce((s, d) => s + d.kolize.length, 0);
  h += `<div class="pata">Vytištěno ${J.formatDatum(J.dnesIso(), true)}${nk ? ` · ⚠️ ${nk} nevyřešených kolizí` : ''}</div>`;
  return h;
}
function tisk(rezim) {
  if (!data.aktivity.length) return Dialog.info('Rozvrh je prázdný – není co tisknout.');
  $('tisk').innerHTML = tiskHtml(rezim);
  print();
}

/* ---------- soubor ---------- */
function stahni(jmeno, obsah, typ) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([obsah], { type: typ }));
  a.download = jmeno; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function exportIcs() {
  if (!data.aktivity.length) return Dialog.info('Rozvrh je prázdný.');
  const dlg = $('dlgIcs'), f = dlg.querySelector('form');
  f.od.value = tydenOd;
  f.clen.innerHTML = '<option value="">celá rodina</option>' + data.clenove.map(c => `<option value="${esc(c.id)}">${esc(c.jmeno)}</option>`).join('');
  if (await otevri(dlg) !== 'ok') return;
  const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const t = J.ics(data, { od: f.od.value, tydnu: +f.tydnu.value, clen: f.clen.value, jizdy: f.jizdy.checked }, ts);
  const kdo = f.clen.value ? '-' + (clen(f.clen.value) || {}).jmeno : '';
  stahni(`rozvrh${kdo}-${f.od.value}.ics`, t, 'text/calendar');
}

const PRIKAZY = {
  novaAktivita: () => upravAktivitu(null),
  novyClen: () => upravClena(null),
  noveMisto: () => upravMisto(null),
  prazdniny: () => upravVyjimku(null, { druh: 'zrusit', nazev: 'Prázdniny', od: tydenOd, do: J.pridejDny(tydenOd, 4), kategorie: ['skola', 'krouzek'] }),
  novaVyjimka: () => upravVyjimku(null, { od: J.dnesIso() }),
  tydenZpet: () => { tydenOd = J.pridejDny(tydenOd, -7); vykresli(); },
  tydenDal: () => { tydenOd = J.pridejDny(tydenOd, 7); vykresli(); },
  tydenDnes: () => { tydenOd = J.pondeli(J.dnesIso()); vykresli(); },
  napoveda: () => otevri($('dlgNapoveda')),
  tiskTyden: () => tisk('tyden'),
  tiskOsoby: () => tisk('osoby'),
  ics: exportIcs,
  export: () => stahni('rodinny-rozvrh-' + J.dnesIso() + '.json', JSON.stringify(data, null, 1), 'application/json'),
  import: () => $('souborImport').click(),
  ukazka: async () => {
    if (data.clenove.length && !await Dialog.potvrd('Nahradit současný rozvrh ukázkovou rodinou? Doporučujeme nejdřív zálohu.')) return;
    data = J.ukazka(J.dnesIso()); tydenOd = J.pondeli(J.dnesIso()); zmena();
  },
  smazVse: async () => {
    if (!await Dialog.potvrd('Opravdu smazat celý rozvrh (členy, místa, aktivity i výjimky)? Doporučujeme nejdřív zálohu.')) return;
    data = J.prazdna(); zmena();
  }
};

$('souborImport').onchange = async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  let d;
  try { d = JSON.parse(await f.text()); } catch (er) { return Dialog.chyba('Soubor není platný JSON.'); }
  if (!d || !Array.isArray(d.aktivity) || !Array.isArray(d.clenove)) return Dialog.chyba('Tohle není záloha Rodinného rozvrhu.');
  const m = J.migruj(d);
  if (!await Dialog.potvrd(`Záloha obsahuje ${m.clenove.length} členů, ${m.aktivity.length} aktivit a ${m.vyjimky.length} výjimek. Nahradit jimi současná data?`)) return;
  data = m; zmena(); Dialog.info('Obnoveno.');
};

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
document.addEventListener('click', e => {
  const p = e.target.closest('[data-prikaz]');
  if (p) { e.stopPropagation(); zavriNabidky(); return PRIKAZY[p.dataset.prikaz](p); }
  if (!e.target.closest('.nabidka')) zavriNabidky();
  if (e.target.closest('dialog')) return;
  const pv = e.target.closest('[data-pohled]');
  if (pv) { pohled = pv.dataset.pohled; zapamatuj('pohled', pohled); return vykresli(); }
  const sk = e.target.closest('[data-skryj]');
  if (sk) { const id = sk.dataset.skryj; skryti.has(id) ? skryti.delete(id) : skryti.add(id); zapamatuj('skryti', JSON.stringify([...skryti])); return vykresli(); }
  const c = e.target.closest('[data-clen]');
  if (c) return upravClena(clen(c.dataset.clen));
  const m = e.target.closest('[data-misto]');
  if (m) return upravMisto(data.mista.find(x => x.id === m.dataset.misto));
  const v = e.target.closest('[data-vyjimka]');
  if (v) return upravVyjimku(data.vyjimky.find(x => x.id === v.dataset.vyjimka));
  const a = e.target.closest('[data-aktivita]');
  if (a && !e.target.closest('select')) { const ak = data.aktivity.find(x => x.id === a.dataset.aktivita); if (ak) upravAktivitu(ak); }
});
$('obsah').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'chJizdy') { jizdyVMrizce = t.checked; zapamatuj('jizdy', t.checked ? '1' : '0'); return vykresli(); }
  if (t.name === 'odvozRezim') { odvozJenTyden = t.value === 'den'; return; }
  if (t.dataset.odvoz) {
    const a = data.aktivity.find(x => x.id === t.dataset.aktivitaId); if (!a) return;
    const datum = t.dataset.datum, typ = t.dataset.odvoz;
    if (odvozJenTyden) {
      let x = data.vyjimky.find(y => y.druh === 'odvoz' && y.od === datum && y.do === datum && y.aktivity.length === 1 && y.aktivity[0] === a.id && !y.clenove.length && !y.kategorie.length);
      if (!x) { x = J.normVyjimka({ druh: 'odvoz', nazev: 'změna odvozu', od: datum, do: datum, aktivity: [a.id] }); data.vyjimky.push(x); }
      x[typ] = t.value;
    } else {
      const d = J.denTydne(datum);
      a.odvoz[d] = a.odvoz[d] || { tam: '', zpet: '' };
      a.odvoz[d][typ] = t.value;
    }
    return zmena();
  }
  if (t.dataset.prejezd) { const [x, y] = t.dataset.prejezd.split('|'); J.nastavPrejezd(data, x, y, t.value.trim()); return zmena(); }
  if (t.dataset.nast) {
    const n = data.nastaveni, k = t.dataset.nast;
    if (k === 'svatky') n.svatky = t.checked; else n[k] = Math.max(0, Math.min(+t.max || 240, Math.round(+t.value || 0)));
    return zmena();
  }
  if (t.dataset.nastKat) {
    const s = new Set(data.nastaveni.svatkyKategorie); t.checked ? s.add(t.dataset.nastKat) : s.delete(t.dataset.nastKat);
    data.nastaveni.svatkyKategorie = [...s]; return zmena();
  }
});
addEventListener('resize', zavriNabidky);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') zavriNabidky();
  if (document.querySelector('dialog[open]') || /INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) return;
  if (e.key === 'ArrowLeft') PRIKAZY.tydenZpet();
  else if (e.key === 'ArrowRight') PRIKAZY.tydenDal();
});
addEventListener('storage', e => { if (e.key === J.KLIC) { data = J.migruj(JSON.parse(e.newValue || 'null')); vykresli(); } });
addEventListener('afterprint', () => { $('tisk').innerHTML = ''; });

vykresli();
window.ROZVRH_APP = { data: () => data, vykresli, tiskHtml, nastavData: d => { data = J.migruj(d); zmena(); } };
})();
