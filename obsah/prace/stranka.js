/* Volná místa – rozhraní stránky obsah/prace.html nad PRACE_JADRO. */
(function () {
  'use strict';
  const J = window.PRACE_JADRO;
  const $ = id => document.getElementById(id);
  const DATA = 'prace/data/';
  const KLIC_FILTR = 'webapp_prace_filtr';
  const KLIC_DOMOV = 'webapp_prace_domov';
  const NA_STRANKU = 50;

  let meta, M = [], obce = [], obecPodleKodu = new Map(), F, vysledek = [], zobrazeno = NA_STRANKU;
  let vybrane = null, dnes = J.dnesDny();
  const detaily = new Map();   // číslo dávky → Promise<objekt>

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const datum = d => d ? J.datumZDnu(d).toLocaleDateString('cs-CZ') : '';
  const cti = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const zapis = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* plné úložiště – nevadí */ } };

  function predDny(d) {
    const n = dnes - d;
    if (n <= 0) return 'dnes';
    if (n === 1) return 'včera';
    return 'před ' + n + ' dny';
  }

  function nazevMista(m) {
    if (m.presnost === 'c') return 'kdekoli v ČR';
    if (m.obec && obecPodleKodu.has(m.obec)) return obecPodleKodu.get(m.obec)[1];
    const ok = m.okresy.map(o => meta.okresy[o] && meta.okresy[o][0]).filter(Boolean);
    return ok.length ? 'okres ' + ok[0] + (ok.length > 1 ? ' + ' + (ok.length - 1) : '') : '';
  }

  const bity = (maska, nazvy) => nazvy.filter((_, i) => maska & (1 << i));

  /* ---------- načtení ---------- */
  async function nacti() {
    const [m, r, o] = await Promise.all(['meta', 'mista', 'obce'].map(n =>
      fetch(DATA + n + '.json').then(x => { if (!x.ok) throw new Error(n + '.json: ' + x.status); return x.json(); })));
    meta = m; obce = o;
    obce.forEach(x => obecPodleKodu.set(x[0], x));
    M = J.priprav(meta, r);
  }

  function detail(id) {
    const d = J.davkaDetailu(id, meta);
    if (!detaily.has(d)) detaily.set(d, fetch(DATA + 'detail/' + d + '.json').then(x => x.json()).catch(e => { detaily.delete(d); throw e; }));
    return detaily.get(d).then(x => x[id] || {});
  }

  /* ---------- filtry: vytvoření prvků ---------- */
  function zaskrtavatka(kam, nazvy, klic, popisky) {
    $(kam).innerHTML = nazvy.map((n, i) => n === 'Neurčeno' ? '' :
      `<label class="ch"><input type="checkbox" data-${klic}="${i}"> ${esc((popisky && popisky[i]) || n)}</label>`).join('');
  }

  const PRIZNAKY_POPIS = {
    cizinecMimoEu: 'vhodné i pro cizince mimo EU', zamestnaneckaKarta: 'pro zaměstnaneckou kartu',
    modraKarta: 'pro modrou kartu', statniSpravaSamosprava: 'státní správa / samospráva', url: 's odkazem na web firmy',
  };

  function postavFiltry() {
    $('fKraj').innerHTML += Object.entries(meta.kraje).map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('');
    $('fObor').innerHTML += Object.entries(meta.obory).sort((a, b) => a[1].localeCompare(b[1], 'cs'))
      .map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('');
    // profese: 1. úroveň CZ-ISCO jako skupina, 2. úroveň jako volby
    const isco = meta.isco;
    const vIsco = {};
    M.forEach(m => { for (let i = 1; i <= 2; i++) { const k = m.isco.slice(0, i); vIsco[k] = (vIsco[k] || 0) + m.pocet; } });
    $('fIsco').innerHTML += Object.keys(isco).filter(k => k.length === 1).sort().map(h =>
      `<optgroup label="${esc(isco[h])}"><option value="${h}">Vše: ${esc(isco[h])} (${vIsco[h] || 0})</option>` +
      Object.keys(isco).filter(k => k.length === 2 && k[0] === h).sort()
        .map(k => `<option value="${k}">${esc(isco[k])} (${vIsco[k] || 0})</option>`).join('') + '</optgroup>').join('');
    $('fVzdelani').innerHTML += meta.vzdelani.slice(0, -1).map((n, i) => `<option value="${i}">${esc(n)}</option>`).join('');
    zaskrtavatka('fVztahy', meta.vztahy, 'vztahy');
    zaskrtavatka('fSmennost', meta.smennost, 'smennost');
    zaskrtavatka('fVhodnost', meta.vhodnost, 'vhodnost');
    zaskrtavatka('fVyhody', meta.vyhody, 'vyhody');
    const poradiJaz = meta.jazyky.map((n, i) => [n, i]).sort((a, b) => a[0].localeCompare(b[0], 'cs'));
    $('fJazyky').innerHTML = poradiJaz.map(([n, i]) => `<label class="ch"><input type="checkbox" data-jazyk="${i}"> ${esc(n)}</label>`).join('');
    $('fPriznaky').innerHTML = Object.entries(PRIZNAKY_POPIS).map(([k, n]) =>
      `<label class="ch"><input type="checkbox" data-priznak="${meta.priznaky.indexOf(k)}"> ${esc(n)}</label>`).join('');
    $('minMzda').textContent = J.kc(meta.minimalni);
  }

  /* filtr → prvky */
  function doPrvku() {
    $('fHledat').value = F.q;
    $('fKraj').value = F.kraj;
    $('fRazeni').value = F.razeni;
    $('fObor').value = F.obor;
    $('fIsco').value = F.isco;
    $('fMzda').value = F.mzda || '';
    $('fNadMin').checked = F.nadMinimum;
    $('fVzdelani').value = F.vzdelani;
    $('fNove').value = F.nove;
    $('fOkruh').value = F.okruh;
    $('fCelaCR').checked = F.celaCR;
    $('fBezAgentur').checked = F.bezAgentur;
    $('fBezAnonymnich').checked = F.bezAnonymnich;
    document.querySelectorAll('[data-vztahy]').forEach(c => { c.checked = !!(F.vztahy & (1 << c.dataset.vztahy)); });
    document.querySelectorAll('[data-vhodnost]').forEach(c => { c.checked = !!(F.vhodnost & (1 << c.dataset.vhodnost)); });
    document.querySelectorAll('[data-vyhody]').forEach(c => { c.checked = !!(F.vyhody & (1 << c.dataset.vyhody)); });
    document.querySelectorAll('[data-priznak]').forEach(c => { c.checked = !!(F.priznaky & (1 << c.dataset.priznak)); });
    document.querySelectorAll('[data-smennost]').forEach(c => { c.checked = F.smennost.includes(+c.dataset.smennost); });
    $('fJazykyRezim').value = F.jazyky == null ? '' : F.jazyky.length ? 'umim' : 'zadny';
    $('fJazyky').hidden = $('fJazykyRezim').value !== 'umim';
    document.querySelectorAll('[data-jazyk]').forEach(c => { c.checked = !!(F.jazyky && F.jazyky.includes(+c.dataset.jazyk)); });
    $('domovTxt').textContent = ' ' + (F.domov ? (F.domov.nazev || 'Moje poloha') + (F.okruh ? ' ≤ ' + F.okruh + ' km' : '') : 'Domov');
    $('btnDomov').setAttribute('aria-pressed', F.domov ? 'true' : 'false');
  }

  /* prvky → filtr */
  function zPrvku() {
    const maska = sel => [...document.querySelectorAll(sel)].reduce((a, c) => c.checked ? a | (1 << c.getAttribute(sel.slice(1, -1))) : a, 0);
    F.q = $('fHledat').value.trim();
    F.kraj = $('fKraj').value;
    F.razeni = $('fRazeni').value;
    F.obor = +$('fObor').value;
    F.isco = $('fIsco').value;
    F.mzda = +$('fMzda').value || 0;
    F.nadMinimum = $('fNadMin').checked;
    F.vzdelani = +$('fVzdelani').value;
    F.nove = +$('fNove').value;
    F.okruh = +$('fOkruh').value;
    F.celaCR = $('fCelaCR').checked;
    F.bezAgentur = $('fBezAgentur').checked;
    F.bezAnonymnich = $('fBezAnonymnich').checked;
    F.vztahy = maska('[data-vztahy]');
    F.vhodnost = maska('[data-vhodnost]');
    F.vyhody = maska('[data-vyhody]');
    F.priznaky = maska('[data-priznak]');
    F.smennost = [...document.querySelectorAll('[data-smennost]')].filter(c => c.checked).map(c => +c.dataset.smennost);
    const rezim = $('fJazykyRezim').value;
    F.jazyky = rezim === '' ? null : rezim === 'zadny' ? [] :
      [...document.querySelectorAll('[data-jazyk]')].filter(c => c.checked).map(c => +c.dataset.jazyk);
    $('fJazyky').hidden = rezim !== 'umim';
  }

  /* ---------- výsledky ---------- */
  let casovac = 0;
  function zmena(hned) {
    clearTimeout(casovac);
    casovac = setTimeout(() => { zPrvku(); prepocti(); }, hned ? 0 : 200);
  }

  function prepocti() {
    if (F.razeni === 'blizko' && !F.domov) F.razeni = 'nove';
    vysledek = J.filtruj(M, F, meta, dnes);
    zobrazeno = NA_STRANKU;
    zapis(KLIC_FILTR, F);
    if (F.domov) zapis(KLIC_DOMOV, F.domov);
    ulozUrl();
    doPrvku();
    vykresliSouhrn();
    vykresliSeznam();
    if (mapa) vykresliMapu();
  }

  function ulozUrl() {
    const q = J.doUrl(F) + (vybrane ? (J.doUrl(F) ? '&' : '') + 'id=' + vybrane : '');
    try { history.replaceState(null, '', location.pathname + (q ? '?' + q : '')); } catch (e) { /* sandbox */ }
  }

  function odkazNaHledani() {
    const q = location.search.slice(1);
    const vIframu = window.parent !== window;
    return vIframu ? new URL('../index.html', location.href).href + '#obsah/prace.html' + (q ? '?' + q : '')
      : location.href;
  }

  function popisAktivnich() {
    const P = J.PRAZDNY, s = [];
    const pridej = (text, zrus) => s.push([text, zrus]);
    if (F.q) pridej('„' + F.q + '“', () => { F.q = ''; });
    if (F.kraj) pridej(meta.kraje[F.kraj], () => { F.kraj = ''; });
    if (F.domov && F.okruh) pridej('≤ ' + F.okruh + ' km', () => { F.okruh = 0; });
    if (F.obor) pridej(meta.obory[F.obor], () => { F.obor = 0; });
    if (F.isco) pridej(meta.isco[F.isco], () => { F.isco = ''; });
    if (F.mzda) pridej('≥ ' + J.kc(F.mzda) + ' Kč', () => { F.mzda = 0; });
    if (F.nadMinimum) pridej('nad minimální mzdou', () => { F.nadMinimum = false; });
    if (F.vzdelani >= 0) pridej('vzdělání do: ' + meta.vzdelani[F.vzdelani], () => { F.vzdelani = -1; });
    if (F.nove) pridej('za ' + F.nove + ' d', () => { F.nove = 0; });
    bity(F.vztahy, meta.vztahy).forEach(n => pridej(n, () => { F.vztahy &= ~(1 << meta.vztahy.indexOf(n)); }));
    F.smennost.forEach(i => pridej(meta.smennost[i], () => { F.smennost = F.smennost.filter(x => x !== i); }));
    bity(F.vhodnost, meta.vhodnost).forEach(n => pridej('pro: ' + n, () => { F.vhodnost &= ~(1 << meta.vhodnost.indexOf(n)); }));
    bity(F.vyhody, meta.vyhody).forEach(n => pridej(n, () => { F.vyhody &= ~(1 << meta.vyhody.indexOf(n)); }));
    bity(F.priznaky, meta.priznaky).forEach(n => pridej(PRIZNAKY_POPIS[n] || n, () => { F.priznaky &= ~(1 << meta.priznaky.indexOf(n)); }));
    if (F.bezAgentur) pridej('bez agentur', () => { F.bezAgentur = false; });
    if (F.bezAnonymnich) pridej('bez anonymních', () => { F.bezAnonymnich = false; });
    if (F.celaCR !== P.celaCR) pridej('bez „kdekoli v ČR“', () => { F.celaCR = true; });
    if (F.jazyky) pridej(F.jazyky.length ? 'jazyky, které umím' : 'bez cizího jazyka', () => { F.jazyky = null; });
    return s;
  }

  function vykresliSouhrn() {
    const mist = vysledek.reduce((a, m) => a + m.pocet, 0);
    $('btnFiltryHotovo').textContent = 'Zobrazit ' + J.kc(vysledek.length) + ' nabídek';
    $('souhrn').innerHTML = `<strong>${J.kc(vysledek.length)}</strong> inzerátů · ${J.kc(mist)} míst`;
    $('pocet').textContent = J.kc(meta.pocet) + ' inzerátů · data k ' + datum(J.dnesDny(meta.datum));
    const akt = popisAktivnich();
    $('aktivni').innerHTML = akt.map((a, i) => `<button class="stitek" data-zrus="${i}" title="Zrušit filtr">${esc(a[0])}</button>`).join('');
    $('aktivni').querySelectorAll('[data-zrus]').forEach(b => { b.onclick = () => { akt[b.dataset.zrus][1](); prepocti(); }; });
    // počet zapnutých voleb ve sbalených skupinách
    const n = {
      vztahy: bity(F.vztahy, meta.vztahy).length, smennost: F.smennost.length, vhodnost: bity(F.vhodnost, meta.vhodnost).length,
      vyhody: bity(F.vyhody, meta.vyhody).length, jazyky: F.jazyky ? 1 : 0,
      ostatni: bity(F.priznaky, meta.priznaky).length + F.bezAgentur + F.bezAnonymnich + !F.celaCR,
    };
    document.querySelectorAll('[data-pocet]').forEach(s => { s.textContent = n[s.dataset.pocet] || ''; });
  }

  function karta(m) {
    const meta2 = [];
    const misto = nazevMista(m);
    if (misto) meta2.push('📍 ' + esc(misto) + (m.km != null ? ' · ' + Math.round(m.km) + ' km' : ''));
    const vz = bity(m.vztahy, meta.vztahy).map(n => n.replace('Pracovní poměr - ', '').replace('Dohoda o provedení práce', 'DPP').replace('Dohoda o pracovní činnosti', 'DPČ'));
    if (vz.length) meta2.push('<span class="zn">' + esc(vz.join(', ')) + '</span>');
    if (meta.smennost[m.smennost] && meta.smennost[m.smennost] !== 'Neurčeno') meta2.push('<span class="zn">' + esc(meta.smennost[m.smennost]) + '</span>');
    if (m.pocet > 1) meta2.push('<span class="zn">' + m.pocet + ' míst</span>');
    if (m.priznaky & (1 << meta.priznaky.indexOf('agentura'))) meta2.push('<span class="zn pozor">agentura práce</span>');
    meta2.push(predDny(m.vlozeno));
    const mzda = J.textMzdy(m);
    const prepocet = m.hodinova && m.mzdaOd < 1000 ? `<small>≈ ${J.kc(m.mzdaMes)} Kč/měs.</small>` : '';
    return `<button class="karta${m.id === vybrane ? ' aktivni' : ''}${dnes - m.vlozeno <= 1 ? ' nova' : ''}" role="listitem" data-id="${m.id}">
      <h4>${esc(m.nazev || meta.isco[m.isco] || 'Bez názvu')}</h4>
      <span class="mzda">${esc(mzda)}${prepocet}</span>
      <span class="firma">${esc(m.firma || 'Zaměstnavatel neuveden – přes úřad práce')}</span>
      <span class="meta">${meta2.join('')}</span></button>`;
  }

  function vykresliSeznam() {
    const kus = vysledek.slice(0, zobrazeno);
    $('seznam').innerHTML = kus.length ? kus.map(karta).join('') :
      '<div class="prazdne">Nic neodpovídá filtrům. Zkuste některé zrušit (štítky nahoře).</div>';
    $('btnDalsi').hidden = vysledek.length <= zobrazeno;
    $('btnDalsi').textContent = 'Zobrazit dalších ' + Math.min(NA_STRANKU, vysledek.length - zobrazeno) + ' (zbývá ' + J.kc(vysledek.length - zobrazeno) + ')';
  }

  /* ---------- detail ---------- */
  async function otevriDetail(id) {
    const m = vysledek.find(x => x.id === id) || M.find(x => x.id === id);
    if (!m) return;
    vybrane = id;
    ulozUrl();
    document.querySelectorAll('.karta.aktivni').forEach(k => k.classList.remove('aktivni'));
    const k = document.querySelector(`.karta[data-id="${id}"]`);
    if (k) k.classList.add('aktivni');
    $('rozlozeni').classList.add('s-detailem');
    const el = $('detail');
    el.innerHTML = hlavaDetailu(m) + '<p class="nacitani">Načítám podrobnosti…</p>';
    el.scrollTop = 0;
    let d;
    try { d = await detail(id); } catch (e) { d = { chyba: true }; }
    if (vybrane !== id) return;
    el.innerHTML = hlavaDetailu(m) + teloDetailu(m, d);
    el.querySelector('.zavrit').onclick = zavriDetail;
    el.querySelector('[data-akce="kopirovat"]').onclick = () => kopiruj(odkazNaHledani(), 'Odkaz na inzerát zkopírován.');
    if (matchMedia('(max-width:1000px)').matches) el.focus();
  }

  function hlavaDetailu(m) {
    return `<div class="det-hlava"><div style="flex:1"><h2>${esc(m.nazev || meta.isco[m.isco])}</h2>
      <div class="firma">${esc(m.firma || 'Zaměstnavatel neuveden')}${m.ico ? ' · IČO ' + esc(m.ico) : ''}</div></div>
      <button class="btn mini zavrit" title="Zavřít (Esc)" aria-label="Zavřít">✕</button></div>`;
  }

  function teloDetailu(m, d) {
    const r = [];
    const radek = (k, v) => v ? `<dt>${k}</dt><dd>${v}</dd>` : '';
    const mzda = J.textMzdy(m);
    r.push(`<div class="det-mzda">${esc(mzda || 'Mzda neuvedena')} ${m.hodinova && m.mzdaOd < 1000 ? `<small>≈ ${J.kc(m.mzdaMes)}${m.mzdaMesDo ? '–' + J.kc(m.mzdaMesDo) : ''} Kč/měsíc při ${m.hodin || 40} h týdně</small>` : ''}</div>`);
    if (m.mzdaMes) r.push(`<div><a href="../index.html#obsah/net_salary.html?hruba=${m.mzdaMes}" target="_blank" rel="noopener">💵 Spočítat čistou mzdu z ${J.kc(m.mzdaMes)} Kč</a>${m.horni <= meta.minimalni ? ' · <span style="color:var(--text-faint)">na úrovni minimální mzdy</span>' : ''}</div>`);

    // místo
    const adresa = [d.adresa, d.psc && d.psc.replace(/(\d{3})(\d{2})/, '$1 $2'), nazevMista(m)].filter(Boolean).join(', ');
    const souradnice = m.lat != null ? `${m.lat},${m.lon}` : '';
    let mapy = '';
    if (souradnice) {
      mapy = ` · <a href="https://mapy.cz/fnc/v1/showmap?mapset=basic&center=${m.lon},${m.lat}&zoom=${m.presnost === 'a' ? 17 : 13}&marker=true" target="_blank" rel="noopener">mapa</a>`;
      if (F.domov) mapy += ` · <a href="https://mapy.cz/fnc/v1/route?mapset=basic&start=${F.domov.lon},${F.domov.lat}&end=${m.lon},${m.lat}&routeType=car_fast" target="_blank" rel="noopener">trasa z domova</a>`;
    }
    const km = J.vzdalenost(m, F.domov, meta);
    r.push('<h3>Kde</h3><dl>' +
      radek('Místo', esc(adresa || 'neuvedeno') + mapy) +
      radek('Pracoviště', esc(d.pracoviste)) +
      radek('Od domova', km != null && m.presnost !== 'c' ? '≈ ' + Math.round(km) + ' km vzdušnou čarou' + (m.presnost === 'o' ? ' (ke středu obce)' : m.presnost === 'k' ? ' (ke středu okresu)' : '') : '') +
      (m.okresy.length > 1 ? radek('Okresy', esc(m.okresy.map(o => meta.okresy[o] && meta.okresy[o][0]).join(', '))) : '') +
      '</dl>');

    // podmínky
    const vz = bity(m.vztahy, meta.vztahy).join(', ');
    r.push('<h3>Podmínky</h3><dl>' +
      radek('Vztah', esc(vz)) +
      radek('Směny', esc(meta.smennost[m.smennost] !== 'Neurčeno' ? meta.smennost[m.smennost] : '')) +
      radek('Hodin týdně', m.hodin ? 'alespoň ' + m.hodin : '') +
      radek('Počet míst', m.pocet > 1 ? m.pocet : '') +
      radek('Nástup', m.nastup ? (m.nastup <= dnes ? 'ihned' : 'od ' + datum(m.nastup)) : '') +
      radek('Na dobu', m.konec ? 'určitou do ' + datum(m.konec) : '') +
      radek('Vhodné pro', esc(bity(m.vhodnost, meta.vhodnost).join(', '))) +
      radek('Cizinci', [m.priznaky & bit('cizinecMimoEu') && 'i mimo EU', m.priznaky & bit('zamestnaneckaKarta') && 'zaměstnanecká karta', m.priznaky & bit('modraKarta') && 'modrá karta'].filter(Boolean).join(', ')) +
      radek('Agentura', m.priznaky & bit('agentura') ? 'ano – agentura práce, budete přiděleni k jinému zaměstnavateli' : '') +
      '</dl>');
    const vyhody = bity(m.vyhody, meta.vyhody);
    if (vyhody.length) {
      const popisy = Object.fromEntries((d.vyhody || []).map(([k, p]) => [k, p]));
      r.push('<h3>Výhody</h3><ul>' + vyhody.map(n => {
        const p = popisy[meta.vyhodyKod[meta.vyhody.indexOf(n)]];
        return `<li>${esc(n)}${p ? ' – ' + esc(p) : ''}</li>`;
      }).join('') + '</ul>');
    }

    // požadavky
    const popisDov = Object.fromEntries((d.dovednosti || []).map(([k, p]) => [k, p]));
    const popisJaz = Object.fromEntries((d.jazyky || []).map(([k, p]) => [k, p]));
    r.push('<h3>Požadavky</h3><dl>' +
      radek('Vzdělání', esc(m.vzdelani ? meta.vzdelani[m.vzdelani] : 'bez požadavku')) +
      radek('Obor vzdělání', esc((d.kkov || []).map(k => meta.kkov[k] || k).join(', '))) +
      radek('Praxe v', esc((d.praxe || []).map(k => meta.isco[k] || k).join(', '))) +
      radek('Profese', esc(meta.isco[m.isco] ? meta.isco[m.isco] + ' (CZ-ISCO ' + m.isco + ')' : '')) +
      radek('Dovednosti', m.dovednosti.map(i => {
        const p = popisDov[meta.dovednostiKod[i]];
        return esc(meta.dovednosti[i]) + (p ? ' <span style="color:var(--text-faint)">(' + esc(p) + ')</span>' : '');
      }).join('<br>')) +
      radek('Jazyky', m.jazyky.map(([j, u]) => {
        const p = popisJaz[meta.jazykyKod[j]];
        return esc(meta.jazyky[j]) + ' – ' + esc(meta.uroven[u] || '').toLowerCase() + (p ? ' (' + esc(p) + ')' : '');
      }).join('<br>')) +
      '</dl>');

    if (d.text) r.push('<h3>Popis</h3><div class="det-text">' + linky(esc(d.text)) + '</div>');
    if (d.chyba) r.push('<p class="varovani">Podrobnosti se nepodařilo načíst (jste offline?).</p>');

    // kontakt
    const k = d.kontakt || {};
    const tel = t => t ? `<a href="tel:${esc(t.replace(/\s/g, ''))}">${esc(t)}</a>` : '';
    const mail = e => e ? `<a href="mailto:${esc(e)}">${esc(e)}</a>` : '';
    const kont = radek('Komu', esc([k.jmeno, k.pozice].filter(Boolean).join(', '))) +
      radek('Telefon', [k.tel, k.tel2, d.prac_tel].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).map(tel).join(', ')) +
      radek('E-mail', [k.email, k.email2, d.prac_email].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).map(mail).join(', ')) +
      radek('Kde se hlásit', esc([k.misto, k.adresa, k.obec && obecPodleKodu.get(+k.obec) && obecPodleKodu.get(+k.obec)[1]].filter(Boolean).join(', '))) +
      radek('Web', d.url ? `<a href="${esc(bezpecnaUrl(d.url))}" target="_blank" rel="noopener nofollow">${esc(d.url.replace(/^https?:\/\//, '').slice(0, 60))}</a>` : '');
    const anonym = m.priznaky & bit('anonymni');
    r.push('<h3>Kontakt</h3>' + (kont ? '<dl>' + kont + '</dl>' : '') +
      (anonym || !kont ? `<p class="napoveda-mala">Zaměstnavatel si nepřeje být zveřejněn – hlaste se přes úřad práce${d.up && meta.up[d.up] ? ' (' + esc(meta.up[d.up]) + ')' : ''} s referenčním číslem ${esc(d.ref || '')}.</p>` : ''));

    r.push(`<div class="det-akce">
      ${d.url ? `<a class="btn primary" href="${esc(bezpecnaUrl(d.url))}" target="_blank" rel="noopener nofollow">🌐 Web zaměstnavatele</a>` : ''}
      ${m.ico ? `<a class="btn" href="https://ares.gov.cz/ekonomicke-subjekty?ico=${encodeURIComponent(m.ico)}" target="_blank" rel="noopener">🏢 Firma v ARES</a>` : ''}
      <a class="btn" href="https://up.gov.cz/volna-mista-v-cr" target="_blank" rel="noopener">🏛 Úřad práce</a>
      <button class="btn" data-akce="kopirovat">🔗 Odkaz</button></div>`);
    r.push(`<p class="det-pozn">Referenční číslo ÚP: ${esc(d.ref || '–')}${d.up && meta.up[d.up] ? ' · ' + esc(meta.up[d.up]) : ''}<br>
      Vloženo ${datum(m.vlozeno)}, změněno ${datum(m.zmena)}${m.expirace ? ', zveřejněno do ' + datum(m.expirace) : ''}.<br>
      Zdroj: otevřená data MPSV / ÚP ČR. Údaje zadává zaměstnavatel; před pohovorem si je ověřte.</p>`);
    return r.join('');
  }

  const bit = jm => 1 << meta.priznaky.indexOf(jm);

  function bezpecnaUrl(u) {
    const s = String(u).trim();
    return /^https?:\/\//i.test(s) ? s : 'https://' + s.replace(/^\/+/, '');
  }

  function linky(html) {
    return html.replace(/\b(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" target="_blank" rel="noopener nofollow">$1</a>');
  }

  function zavriDetail() {
    vybrane = null;
    ulozUrl();
    $('rozlozeni').classList.remove('s-detailem');
    document.querySelectorAll('.karta.aktivni').forEach(k => k.classList.remove('aktivni'));
  }

  async function kopiruj(text, hlaska) {
    try { await navigator.clipboard.writeText(text); Dialog.info(hlaska); }
    catch (e) { await Dialog.zeptej('Zkopírujte odkaz:', text); }
  }

  /* ---------- domov ---------- */
  function navrhniObce() {
    const q = J.bezDiakritiky($('domovHledat').value.trim());
    const el = $('domovNavrhy');
    if (q.length < 2) { el.innerHTML = ''; return; }
    const nalez = obce.filter(o => o[3] != null && J.bezDiakritiky(o[1]).startsWith(q))
      .sort((a, b) => a[1].length - b[1].length || a[1].localeCompare(b[1], 'cs')).slice(0, 8);
    el.innerHTML = nalez.map(o => `<button class="tl" style="display:block;width:100%" data-obec="${o[0]}">${esc(o[1])} <span style="color:var(--text-faint)">(${esc(meta.okresy[o[2]] ? meta.okresy[o[2]][0] : '')})</span></button>`).join('') ||
      '<p>Obec nenalezena.</p>';
    el.querySelectorAll('[data-obec]').forEach(b => {
      b.onclick = () => {
        const o = obecPodleKodu.get(+b.dataset.obec);
        nastavDomov({ lat: o[3], lon: o[4], nazev: o[1] });
      };
    });
  }

  function nastavDomov(d) {
    F.domov = d;
    if (d && !F.okruh) F.okruh = 30;
    if (d) F.razeni = F.razeni === 'nove' ? 'blizko' : F.razeni;
    if (!d) { F.okruh = 0; try { localStorage.removeItem(KLIC_DOMOV); } catch (e) { /* nic */ } }
    $('domovHledat').value = '';
    $('domovNavrhy').innerHTML = '';
    zavriNabidky();
    prepocti();
  }

  /* ---------- odkazy jinam ---------- */
  function vykresliJinde() {
    const q = encodeURIComponent(F.q || (F.isco && meta.isco[F.isco]) || '');
    const odkazy = [
      ['Jobs.cz', 'https://www.jobs.cz/prace/?q%5B%5D=' + q],
      ['Profesia', 'https://www.profesia.cz/prace/?search_anywhere=' + q],
      ['LinkedIn', 'https://www.linkedin.com/jobs/search/?keywords=' + q + '&location=Czechia'],
      ['Indeed', 'https://cz.indeed.com/jobs?q=' + q],
    ];
    $('jinde').innerHTML = odkazy.map(([n, u]) => `<a class="btn mini" href="${u}" target="_blank" rel="noopener">${n} ↗</a>`).join('');
    const stari = dnes - J.dnesDny(meta.datum);
    $('dataInfo').innerHTML = `Data k <strong>${datum(J.dnesDny(meta.datum))}</strong>${stari > 0 ? ' (' + predDny(J.dnesDny(meta.datum)) + ')' : ''}: ${J.kc(meta.pocet)} inzerátů, ${J.kc(meta.mist)} volných míst.`;
  }

  /* ---------- nabídky lišty ---------- */
  function zavriNabidky() {
    document.querySelectorAll('.nabidka:not([hidden])').forEach(n => { n.hidden = true; });
    document.querySelectorAll('[data-nabidka][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }

  function otevriNabidku(b) {
    const n = $(b.dataset.nabidka), bylo = !n.hidden;
    zavriNabidky();
    if (bylo) return;
    if (b.dataset.nabidka === 'nabData') vykresliJinde();
    n.hidden = false; b.setAttribute('aria-expanded', 'true');
    const r = b.getBoundingClientRect();
    n.style.top = (r.bottom + 4) + 'px';
    n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
    const vstup = n.querySelector('input');
    if (vstup) vstup.focus();
  }

  /* ---------- mapa ---------- */
  let mapa = null, vrstva = null;
  function zobrazMapu(ano) {
    $('btnMapa').setAttribute('aria-pressed', ano);
    $('btnSeznam').setAttribute('aria-pressed', !ano);
    $('seznamObal').hidden = ano;
    $('mapaObal').hidden = !ano;
    $('hlavni').classList.toggle('s-mapou', ano);
    if (!ano) return;
    if (!mapa) {
      mapa = L.map('mapa', { zoomControl: true }).setView([49.8, 15.5], 7);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      }).addTo(mapa);
      vrstva = L.layerGroup().addTo(mapa);
      mapa.on('moveend', vykresliMapu);
    }
    mapa.invalidateSize();
    vykresliMapu();
  }

  /* Vlastní shlukování: body v aktuálním výřezu do mřížky 56 px; shluk = počet inzerátů. */
  function vykresliMapu() {
    if (!mapa || $('mapaObal').hidden) return;
    vrstva.clearLayers();
    const hranice = mapa.getBounds().pad(0.1);
    const BUNKA = 56, bunky = new Map();
    let bezPolohy = 0;
    for (const m of vysledek) {
      if (m.lat == null) { bezPolohy++; continue; }
      if (!hranice.contains([m.lat, m.lon])) continue;
      const p = mapa.latLngToLayerPoint([m.lat, m.lon]);
      const k = Math.floor(p.x / BUNKA) + ':' + Math.floor(p.y / BUNKA);
      let b = bunky.get(k);
      if (!b) bunky.set(k, b = { lat: 0, lon: 0, mista: [] });
      b.lat += m.lat; b.lon += m.lon; b.mista.push(m);
    }
    if (F.domov) L.circleMarker([F.domov.lat, F.domov.lon], { radius: 7, color: '#c0392b', weight: 3, fillOpacity: 0.3 }).bindTooltip('🏠 ' + (F.domov.nazev || 'Domov')).addTo(vrstva);
    if (F.domov && F.okruh) L.circle([F.domov.lat, F.domov.lon], { radius: F.okruh * 1000, color: '#c0392b', weight: 1, fill: false, dashArray: '4 4', interactive: false }).addTo(vrstva);
    for (const b of bunky.values()) {
      const n = b.mista.length;
      const stred = [b.lat / n, b.lon / n];
      const vel = n === 1 ? 14 : Math.min(46, 20 + Math.log2(n) * 4);
      const ikona = L.divIcon({ className: '', html: `<div class="mapa-shluk" style="width:${vel}px;height:${vel}px">${n > 1 ? n : ''}</div>`, iconSize: [vel, vel] });
      const zn = L.marker(stred, { icon: ikona, keyboard: false }).addTo(vrstva);
      zn.on('click', () => {
        const stejne = b.mista.every(m => m.lat === b.mista[0].lat && m.lon === b.mista[0].lon);
        if (n > 1 && !stejne && mapa.getZoom() < 15) {
          mapa.fitBounds(L.latLngBounds(b.mista.map(m => [m.lat, m.lon])).pad(0.2), { maxZoom: 16 });
          return;
        }
        const obsah = document.createElement('div');
        obsah.innerHTML = b.mista.slice(0, 60).map(m => `<button data-id="${m.id}"><strong>${esc(m.nazev)}</strong><br>${esc(m.firma)} · ${esc(J.textMzdy(m))}</button>`).join('') +
          (n > 60 ? `<p>… a dalších ${n - 60}</p>` : '');
        obsah.addEventListener('click', e => { const t = e.target.closest('[data-id]'); if (t) otevriDetail(+t.dataset.id); });
        L.popup({ maxWidth: 320 }).setLatLng(stred).setContent(obsah).openOn(mapa);
      });
    }
    $('mapaInfo').textContent = J.kc(vysledek.length - bezPolohy) + ' inzerátů na mapě' + (bezPolohy ? ' · ' + J.kc(bezPolohy) + ' bez přesného místa (kdekoli v ČR / jen okres)' : '');
  }

  /* ---------- start ---------- */
  function navazUdalosti() {
    document.querySelectorAll('#filtry input, #filtry select').forEach(el => el.addEventListener('change', () => zmena(true)));
    $('fMzda').addEventListener('input', () => zmena());
    $('fHledat').addEventListener('input', () => zmena());
    ['fKraj', 'fRazeni', 'fOkruh'].forEach(id => $(id).addEventListener('change', () => zmena(true)));
    $('btnZrusit').onclick = () => { const d = F.domov; F = J.novyFiltr({ domov: d }); prepocti(); };
    $('btnFiltry').onclick = () => {
      const r = $('rozlozeni');
      const mobil = matchMedia('(max-width:1000px)').matches;
      if (mobil) r.classList.toggle('filtry-otevrene');
      else r.classList.toggle('bez-filtru');
      $('btnFiltry').setAttribute('aria-pressed', mobil ? r.classList.contains('filtry-otevrene') : !r.classList.contains('bez-filtru'));
    };
    $('btnFiltryHotovo').onclick = () => { $('rozlozeni').classList.remove('filtry-otevrene'); $('btnFiltry').setAttribute('aria-pressed', 'false'); };
    $('btnSeznam').onclick = () => zobrazMapu(false);
    $('btnMapa').onclick = () => zobrazMapu(true);
    $('btnDalsi').onclick = () => { zobrazeno += NA_STRANKU; vykresliSeznam(); };
    $('btnSdilet').onclick = () => kopiruj(odkazNaHledani(), 'Odkaz na hledání zkopírován.');
    $('seznam').addEventListener('click', e => { const k = e.target.closest('.karta'); if (k) otevriDetail(+k.dataset.id); });
    $('domovHledat').addEventListener('input', navrhniObce);
    $('btnDomovPryc').onclick = () => nastavDomov(null);
    $('btnPoloha').onclick = () => {
      if (!navigator.geolocation) return Dialog.chyba('Prohlížeč neumí zjistit polohu.');
      navigator.geolocation.getCurrentPosition(
        p => nastavDomov({ lat: +p.coords.latitude.toFixed(4), lon: +p.coords.longitude.toFixed(4), nazev: '' }),
        () => Dialog.chyba('Polohu se nepodařilo zjistit. Zadejte obec.'), { timeout: 10000 });
    };
    document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); otevriNabidku(b); }));
    document.addEventListener('click', e => { if (!e.target.closest('.nabidka')) zavriNabidky(); });
    addEventListener('resize', () => {
      zavriNabidky();
      document.documentElement.style.setProperty('--vyska-listy', $('lista').offsetHeight + 'px');
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (document.querySelector('.nabidka:not([hidden])')) return zavriNabidky();
        if (document.querySelector('dialog[open]')) return;
        if (vybrane) return zavriDetail();
        $('rozlozeni').classList.remove('filtry-otevrene');
      }
      if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $('fHledat').focus(); }
    });
  }

  async function start() {
    document.documentElement.style.setProperty('--vyska-listy', $('lista').offsetHeight + 'px');
    if (matchMedia('(max-width:1000px)').matches) $('btnFiltry').setAttribute('aria-pressed', 'false');
    try {
      await nacti();
    } catch (e) {
      $('nacitani').innerHTML = 'Data se nepodařilo načíst. ' + esc(e.message) + '<br><button class="btn" onclick="location.reload()">Zkusit znovu</button>';
      return;
    }
    postavFiltry();
    const par = new URLSearchParams(location.search);
    const zUrl = [...par.keys()].some(k => k !== 'id');
    F = zUrl ? J.zUrl(location.search) : J.novyFiltr(cti(KLIC_FILTR) || {});
    if (!F.domov && !zUrl) F.domov = cti(KLIC_DOMOV);
    navazUdalosti();
    $('nacitani').hidden = true;
    $('seznamObal').hidden = false;
    const stari = dnes - J.dnesDny(meta.datum);
    if (stari > 3) $('stari').innerHTML = `<div class="varovani">⚠ Data jsou z ${datum(J.dnesDny(meta.datum))} (${predDny(J.dnesDny(meta.datum))}). Některá místa už mohou být obsazená.</div>`;
    prepocti();
    if (par.get('id')) otevriDetail(+par.get('id'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
