/* ============================================================
   odizolovac/ui.js – ovládání stránky Stahovák izolace.
   Stav: režim + parametry všech režimů (localStorage webapp_odizolovac_stav),
   pojmenované návrhy (webapp_odizolovac_sady). Manifold se načítá
   za běhu (z file:// WASM z base64), přestavba s odkladem 150 ms.
   Pro testy: window.ODIZ_APP.
   ============================================================ */
(function () {
  'use strict';
  const J = window.ODIZ, G = window.ODIZ_GEO, V = window.ODIZ_VYKRES, S = window.ODIZ_SCENA;
  const KLIC = 'webapp_odizolovac_stav', KLIC_SADY = 'webapp_odizolovac_sady';
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SKUPINY = { merka: 'Měrka', cepel: 'Čepel z ulamovacího nože', rez: 'Řez a nastavení', tvar: 'Kabel', kloub: 'Pružný kloub a ramena', tisk: 'Tisk a tvar tělesa' };
  const SVODICI = r => J.SVODICI.includes(r);
  const KLOUB = r => J.KLOUB.includes(r);
  const HUSTOTA_PLA = 1.24;

  let stav = nactiStav(), norm = null, roz = null, w = null, telo = null, sit = null, dily = null, animace = 0;
  let rovina = 0, vybranaDrazka = 0, odklad = 0, casUlozeni = 0, chybaJadra = null;

  function nactiStav() {
    const s = { rezim: 'hrebinek', hodnoty: {} };
    try {
      const ul = JSON.parse(localStorage.getItem(KLIC) || 'null');
      if (ul && J.REZIMY[ul.rezim]) s.rezim = ul.rezim;
      if (ul && ul.hodnoty) for (const r of Object.keys(J.REZIMY)) if (ul.hodnoty[r]) s.hodnoty[r] = ul.hodnoty[r];
    } catch (e) { /* poškozený záznam – výchozí */ }
    for (const r of Object.keys(J.REZIMY)) s.hodnoty[r] = Object.assign(J.vychozi(r), s.hodnoty[r] || {});
    return s;
  }
  function ulozStav() {
    clearTimeout(casUlozeni);
    casUlozeni = setTimeout(() => { try { localStorage.setItem(KLIC, JSON.stringify(stav)); } catch (e) { /* plné úložiště */ } }, 300);
  }
  const H = () => stav.hodnoty[stav.rezim];

  /* ---------- formulář ---------- */
  function vykresliFormular() {
    const r = stav.rezim, h = H();
    $('popisRezimu').textContent = J.REZIMY[r].popis;
    for (const b of document.querySelectorAll('#rezimy button')) b.setAttribute('aria-pressed', b.dataset.rezim === r ? 'true' : 'false');
    $('blokVodice').classList.toggle('skryte', !SVODICI(r));
    $('legendaVodice').textContent = r === 'sesivacka' ? 'Vodiče (pořadí drážek se určí samo podle mezery mezi ostřími)'
      : J.VK.includes(r) ? 'Vodiče (pro každý se spočítá nastavení šroubu; ⌀ jádra je důležitý)' : 'Vodiče (drážky zleva doprava)';
    $('blokStisk').hidden = !KLOUB(r);
    const f = $('formular'); f.innerHTML = '';
    for (const [sk, nazev] of Object.entries(SKUPINY)) {
      const defs = J.PARAMETRY.filter(d => d.skupina === sk && d.rezimy.includes(r));
      if (!defs.length) continue;
      const fs = document.createElement('fieldset');
      fs.innerHTML = `<legend>${nazev}</legend><div class="mrizka2"></div>`;
      const m = fs.querySelector('.mrizka2');
      for (const d of defs) {
        const pole = document.createElement('div');
        pole.className = 'pole' + (d.typ === 'vyber' || d.typ === 'text' ? ' cela' : '');
        const id = 'p_' + d.klic;
        if (d.typ === 'text') {
          pole.innerHTML = `<label for="${id}">${esc(d.nazev)}</label><div class="vstup"><input type="text" id="${id}" value="${esc(h[d.klic] ?? '')}"></div>`;
        } else if (d.typ === 'vyber') {
          pole.innerHTML = `<label for="${id}">${esc(d.nazev)}</label><div class="vstup"><select id="${id}">${d.moznosti.map(([k, t]) => `<option value="${k}"${h[d.klic] === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`;
        } else {
          const hod = typeof h[d.klic] === 'number' ? J.fmt(h[d.klic], 3) : esc(h[d.klic] ?? '');
          pole.innerHTML = `<label for="${id}">${esc(d.nazev)}</label><div class="vstup"><input type="text" inputmode="decimal" id="${id}" value="${hod}"><span class="jedn">${esc(d.jedn || '')}</span></div>` +
            (d.napoveda ? `<div class="napoveda">${esc(d.napoveda)}</div>` : '');
        }
        m.appendChild(pole);
      }
      f.appendChild(fs);
    }
    if (SVODICI(r)) vykresliVodice();
  }

  function vykresliVodice() {
    const tb = $('tabVodice').tBodies[0], h = H();
    tb.innerHTML = h.vodice.map((v, i) => `<tr data-i="${i}">
      <td><input type="text" data-k="nazev" value="${esc(v.nazev)}" aria-label="Název vodiče ${i + 1}"></td>
      <td class="c"><input type="text" inputmode="decimal" data-k="D" value="${J.fmt(+v.D, 3)}" aria-label="Průměr přes izolaci ${i + 1}"></td>
      <td class="c"><input type="text" inputmode="decimal" data-k="t" value="${J.fmt(+v.t, 3)}" aria-label="Tloušťka izolace ${i + 1}"></td>
      <td class="c"><input type="text" inputmode="decimal" data-k="d" value="${J.fmt(+v.d, 3)}" aria-label="Průměr jádra ${i + 1}"></td>
      <td class="x"><button type="button" class="male" data-smaz="${i}" title="Odebrat" aria-label="Odebrat vodič ${i + 1}">×</button></td></tr>`).join('');
  }

  function zmenaPole(e) {
    const el = e.target;
    if (!el.id || !el.id.startsWith('p_')) return;
    const k = el.id.slice(2), h = H();
    h[k] = el.tagName === 'SELECT' ? el.value : el.value;
    // předvolby plní rozměry
    if (k === 'cepel' && J.CEPELE[el.value] && J.CEPELE[el.value].W) {
      const c = J.CEPELE[el.value];
      Object.assign(h, { cepelW: c.W, cepelT: c.t, roztec: c.roztec, uhel: c.uhel });
      vykresliFormular();
    } else if (k === 'kabel' && el.value !== 'vlastni') {
      const c = J.KABELY.find(x => x.id === el.value);
      Object.assign(h, { kabelD: c.D, kabelT: c.t });
      vykresliFormular();
    } else if (k === 'plochy' && el.value !== 'vlastni') {
      const c = J.PLOCHE.find(x => x.id === el.value);
      Object.assign(h, { plochyS: c.S, plochyH: c.H, plochyT: c.t });
      vykresliFormular();
    } else if (['cepelW', 'cepelT', 'roztec', 'uhel'].includes(k) && h.cepel !== 'vlastni') { h.cepel = 'vlastni'; $('p_cepel').value = 'vlastni'; }
    else if (['kabelD', 'kabelT'].includes(k) && h.kabel !== 'vlastni') { h.kabel = 'vlastni'; $('p_kabel').value = 'vlastni'; }
    else if (['plochyS', 'plochyH', 'plochyT'].includes(k) && h.plochy !== 'vlastni') { h.plochy = 'vlastni'; $('p_plochy').value = 'vlastni'; }
    naplanuj();
  }

  /* ---------- přestavba ---------- */
  function naplanuj() { ulozStav(); clearTimeout(odklad); odklad = setTimeout(prestav, 150); }

  function prestav(resetKamery) {
    norm = J.normalizuj(stav.rezim, H());
    ukazStavPoli();
    const hl = [];
    for (const c of norm.chyby) hl.push(['chyba', c.text]);
    if (norm.chyby.length) { roz = null; ukazHlaseni(hl); ukazVysledky(); return; }
    roz = J.rozvrhni(stav.rezim, norm.p);
    for (const u of norm.upozorneni.concat(roz.upozorneni)) hl.push(['varovani', u.text]);
    for (const t of G.kontrolaCepeli(roz)) hl.push(['chyba', t]);
    ukazHlaseni(hl);
    if (rovina >= V.roviny(roz).length) rovina = 0;
    if (vybranaDrazka >= (roz.nastaveni || roz.drazky).length) vybranaDrazka = 0;
    if (w) {
      uvolni();
      if (roz.kloub) {
        const v = G.postavSesivacku(w, roz);
        telo = v.telo; dily = [v.dolni, v.horni, v.horniSevreno];
        sit = J.sitZMeshe(telo.getMesh());
        S.nastavModel({ sit, roz, obrysy: roz.cepele.map(G.obrysCepele), dily: { dolni: J.sitZMeshe(v.dolni.getMesh()), horni: J.sitZMeshe(v.horniSevreno.getMesh()) } }, !resetKamery);
      } else {
        telo = G.postav(w, roz);
        sit = J.sitZMeshe(telo.getMesh());
        S.nastavModel({ sit, roz, obrysy: roz.cepele.map(G.obrysCepele) }, !resetKamery);
      }
    }
    ukazVysledky();
    ukazRezy();
    ukazPostup();
  }

  function uvolni() {
    for (const m of [telo].concat(dily || [])) if (m) { try { m.delete(); } catch (e) { /* už uvolněno */ } }
    telo = null; dily = null;
  }
  function ukazStavPoli() {
    for (const el of document.querySelectorAll('#formular input, #tabVodice input')) el.classList.remove('chyba', 'mez');
    for (const c of norm.upozorneni) { const el = $('p_' + c.klic); if (el) el.classList.add('mez'); }
    for (const c of norm.chyby) {
      const el = $('p_' + c.klic); if (el) el.classList.add('chyba');
      const m = /^vodic(\d+)$/.exec(c.klic);
      if (m) for (const i of document.querySelectorAll(`#tabVodice tr[data-i="${m[1]}"] input`)) i.classList.add('chyba');
    }
  }
  function ukazHlaseni(hl) {
    $('hlaseni').innerHTML = hl.map(([t, x]) => `<li class="${t}">${esc(x)}</li>`).join('');
  }

  function ukazVysledky() {
    const box = (popis, cislo, dalsi) => `<div class="box"><div class="popis">${popis}</div><div class="cislo">${cislo}</div>${dalsi ? `<div class="dalsi">${dalsi}</div>` : ''}</div>`;
    $('btnStl').disabled = $('btnSvg').disabled = !roz || !telo;
    if (!roz) { $('vysledky').innerHTML = '<p class="chybovy">Opravte parametry označené červeně.</p>'; $('tabRezy').innerHTML = ''; return; }
    const r = roz.rozmery, o = [];
    o.push(box('Rozměr výtisku', `${J.fmt(r.x, 1)} × ${J.fmt(r.y, 1)} × ${J.fmt(r.z, 1)} mm`, 'šířka × hloubka × výška'));
    if (telo) {
      const objem = telo.volume() / 1000;
      o.push(box('Materiál', `${J.fmt(objem, 1)} cm³`, `≈ ${J.fmt(objem * HUSTOTA_PLA, 0)} g PLA při plné výplni`));
    }
    roz.souhrn.kusy.forEach(k => o.push(box(esc(k.nazev), `${k.clanku} ${k.clanku === 1 ? 'článek' : k.clanku < 5 ? 'články' : 'článků'}`,
      `ostří ${J.fmt(k.P)} mm, kapsa ${J.fmt(k.kapsa)} mm`)));
    if (roz.kloub) {
      const k = roz.kloub, tr = k.eps > k.epsDov ? 'spatne' : k.eps > 0.7 * k.epsDov ? 'mez' : 'ok';
      o.push(box('Pružný oblouk', `<span class="${tr}">${J.fmt(k.eps * 100)} %</span>`, `přetvoření při sevření (pro ${esc(k.material)} bezpečně do ${J.fmt(k.epsDov * 100)} %), délka ${J.fmt(k.L)} mm, poloměr ${J.fmt(k.R0, 1)} → ${J.fmt(k.R1, 1)} mm`));
      o.push(box('Síla pružiny', `≈ ${J.fmt(k.F, 1)} N`, 'u drážek při sevření, k tomu síla na zaříznutí'));
      o.push(box('Rozevření u čela', `${J.fmt(k.otevreniCelo, 1)} mm`, `tisková poloha, úhel ${J.fmt(k.th / J.RAD, 1)}°`));
    } else if (roz.rezim !== 'merka') o.push(box('Výška ostří', `${J.fmt(roz.zE)} mm`, `nad spodní plochou (dno ${J.fmt(roz.z0)} + čepel ${J.fmt(norm.p.cepelW)})`));
    if (roz.nastaveni) {
      const S = roz.souhrn;
      o.push(box('Rozsah jader', `${J.fmt(S.rozsah[0])} – ${J.fmt(S.rozsah[1])} mm`, `nejmenší = sevřeno (šroub na 0), největší = dosah ostří`));
      o.push(box('Dorazový šroub', `M${J.fmt(S.sroub.d)} × ${S.sroub.delka}`, `matice zespodu do šestihranu; 1 otáčka ≈ ${J.fmt(norm.p.stoupani)} mm vysunutí`));
    }
    if (roz.rezim === 'merka') {
      o.push(box('Otvory', `${roz.otvory.length}`, `${esc(J.JADRA[norm.p.druhJadra].nazev)}, ⌀ jádro + ${J.fmt(norm.p.vuleJadra)} + korekce ${J.fmt(norm.p.korekceOtvoru)} mm`));
      o.push(box('Drážky na délku', `${roz.kanaly.length}`, roz.kanaly.map(c => J.fmt(c.L)).join(', ') + ' mm'));
    }
    if (SVODICI(stav.rezim) && roz.souhrn.yDoraz !== null) o.push(box('Délka odizolování', `${J.fmt(roz.souhrn.delkaOdiz)} mm`, 'od roviny čepele k dorazu'));
    $('vysledky').innerHTML = o.join('');
    // tabulka řezů
    if (roz.nastaveni) {
      $('tabRezy').innerHTML = `<thead><tr><th>#</th><th>Vodič</th><th>⌀ jádra</th><th>⌀ izolace</th><th>Kosočtverec ⌀</th><th>Šroub od dosednutí</th><th>Řez</th></tr></thead><tbody>` +
        roz.nastaveni.map((n, j) => `<tr class="klik${j === vybranaDrazka ? ' vybrany' : ''}" data-j="${j}"><td>${j + 1}</td><td>${esc(n.nazev)}</td><td class="cis">${J.fmt(n.d)}</td><td class="cis">${J.fmt(n.D)}</td>
          <td class="cis">${J.fmt(2 * n.r)}</td><td class="cis ${n.otacky === null ? 'spatne' : 'ok'}">${n.otacky === null ? 'nejde' : J.fmt(n.otacky, 2) + ' ot. (' + J.fmt(n.vysun, 2) + ' mm)'}</td><td class="cis">${J.fmt(n.c)}</td></tr>`).join('') + '</tbody>';
      return;
    }
    if (roz.rezim === 'merka') {
      $('tabRezy').innerHTML = `<thead><tr><th>Průřez</th><th>⌀ jádra</th><th>⌀ otvoru (model)</th></tr></thead><tbody>` +
        roz.otvory.map(h => `<tr><td>${J.fmt(h.prurez)} mm²</td><td class="cis">${J.fmt(h.dJ)}</td><td class="cis">${J.fmt(h.d)}</td></tr>`).join('') + '</tbody>';
      return;
    }
    const radky = roz.drazky.map((g, j) => {
      const rr = roz.rezy[Math.min(j, roz.rezy.length - 1)], a = J.rozborDrazky(roz, j);
      const tr = a.podil > 0.95 ? 'spatne' : a.podil > 0.9 || a.podil < 0.5 ? 'mez' : 'ok';
      return `<tr class="klik${j === vybranaDrazka ? ' vybrany' : ''}" data-j="${j}"><td>${j + 1}</td><td>${esc(rr.nazev)}</td><td>${rr.druh}</td>
        <td class="cis">${J.fmt(g.sirka)}</td><td class="cis">${J.fmt(rr.t)}</td><td class="cis ${tr}">${a.cH !== undefined ? J.fmt(a.c) + ' / ' + J.fmt(a.cH) : J.fmt(a.c)}</td><td class="cis">${J.fmt(a.zbytek)}</td><td class="cis">${J.fmt(g.zDno)}</td></tr>`;
    });
    $('tabRezy').innerHTML = `<thead><tr><th>#</th><th>Drážka</th><th>Řez</th><th>Šířka</th><th>Izolace</th><th>${roz.rezim === 'sesivacka' ? 'Řez dole / nahoře' : 'Hloubka řezu'}</th><th>Zbývá</th><th>Dno z</th></tr></thead><tbody>${radky.join('')}</tbody>`;
  }

  function ukazRezy() {
    if (!roz) { $('rezSvg').innerHTML = $('detailSvg').innerHTML = ''; return; }
    const R = V.roviny(roz);
    $('zalozkyRez').innerHTML = R.length > 1 ? R.map((x, i) => `<button type="button" class="male" role="tab" data-rovina="${i}" aria-selected="${i === rovina}">${esc(x.nazev)}</button>`).join('') : '';
    const y = R[rovina].y;
    $('rezSvg').innerHTML = V.rezSvg(roz, y, { oznacit: vybranaDrazka, rovina: R[rovina] });
    $('detailSvg').innerHTML = V.detailSvg(roz, vybranaDrazka);
    if (roz.rezim === 'merka') { $('popisRezu').textContent = 'Pohled shora. Dole přední hrana: konec vodiče na doraz drážky, hrana destičky ukazuje místo řezu. Otvory: holé jádro projde otvorem svého průřezu, menším ne.'; return; }
    if (roz.nastaveni) { const n = roz.nastaveni[vybranaDrazka]; $('popisRezu').textContent = `${R[rovina].nazev}: spodní čepele tvoří „V“, horní „Λ“ (zepředu přes sebe, ve dvou rovinách za sebou). Vpravo kosočtverec pro ${n.nazev}: vepsaná kružnice ⌀ ${J.fmt(2 * n.r)} mm, šroub ${n.otacky === null ? '–' : J.fmt(n.otacky, 2) + ' otáčky'} od dosednutí čelistí.`; return; }
    const a = J.rozborDrazky(roz, vybranaDrazka);
    $('popisRezu').textContent = a.cH !== undefined
      ? `${R[rovina].nazev} (y = ${J.fmt(y)} mm), pohled zepředu. Vpravo detail drážky ${vybranaDrazka + 1}: spodní ostří zajede o ${J.fmt(a.c)} mm, horní o ${J.fmt(a.cH)} mm, do jádra zbývá nejméně ${J.fmt(a.zbytek)} mm. Červené čárkované = ostří, modrá = dosednutí čelistí.`
      : `${R[rovina].nazev} (y = ${J.fmt(y)} mm), pohled zepředu. Vpravo detail drážky ${vybranaDrazka + 1}: ostří zajede o c = ${J.fmt(a.c)} mm (${J.fmt(a.podil * 100, 0)} % izolace), do jádra zbývá ${J.fmt(a.zbytek)} mm. Červená čárkovaná = výška ostří.`;
  }

  function ukazPostup() {
    if (!roz) return;
    const p = norm.p, kusy = roz.souhrn.kusy, kroky = [];
    const ol = () => { $('postup').innerHTML = '<ol>' + kroky.map(k => `<li>${k}</li>`).join('') + '</ol>'; };
    const tiskNaBoku = () => kroky.push(`Vytiskněte STL tak, jak je uložené – <b>na boku</b> (profil na podložce), bez podpěr, z ${esc(p.materialListu)}. Pružný oblouk leží v rovině podložky a vrstvy jdou podél něj. Aspoň 3 perimetry, oblouk plný.`);
    if (J.VK.includes(stav.rezim)) {
      const S = roz.souhrn;
      tiskNaBoku();
      kroky.push(`Ulomte <b>4 kusy</b> čepele po ${kusy[0].clanku} ${kusy[0].clanku === 1 ? 'článku' : 'článcích'} (ostří ${J.fmt(kusy[0].P)} mm). Lámejte kleštěmi, nikdy prsty.`);
      kroky.push('Do každé čelisti patří dva kusy ve dvou štěrbinách za sebou. Kus se zasouvá zvenku (z boku nebo zespodu/shora, kudy štěrbina vychází) <b>špičkou napřed</b>, až se opře o šikmý konec u zářezu. Jde jen jednou stranou – když nejde, otočte ho. Zajistěte kouskem filamentu 1,75 mm zastrčeným <b>zepředu do vodorovného otvoru</b> za koncem kusu.');
      kroky.push(`Do šestihranné kapsy zespodu vložte matici M${J.fmt(S.sroub.d)}, zašroubujte šroub M${J.fmt(S.sroub.d)} × ${S.sroub.delka} tak, aby špička byla zarovnaná s plochou čelisti (čelisti dosednou) – to je nula.`);
      kroky.push('Pro vybraný vodič vyšroubujte šroub o počet otáček z tabulky (zespodu, po směru hodin = ven). Kosočtverec ostří se tím zvětší.');
      kroky.push(`Vodič zasuňte zepředu do zářezu${S.yDoraz ? ' až na doraz (' + J.fmt(S.delkaOdiz) + ' mm)' : ''}, stiskněte až na šroub a vodič vytáhněte – čtyři řezy izolaci utrhnou.`);
      kroky.push('Když je jádro poškrábané, šroub o 1/8 otáčky vyšroubujte; když izolace drží, zašroubujte. Skutečnou nulu ověřte na odřezku – tabulka vychází z modelu oblouku.');
      return ol();
    }
    if (stav.rezim === 'podelny') {
      tiskNaBoku();
      kroky.push(`Ulomte kus čepele o <b>${kusy[0].clanku} ${kusy[0].clanku === 1 ? 'článku' : 'článcích'}</b>. Štěrbina je šikmá (${J.fmt(norm.p.sklonCepele)}°): kus zasuňte zespodu/z boku <b>ostrým rohem napřed a ostřím nahoru</b>, až se špička opře o konec kapsy a vykoukne nad dno drážky o ${J.fmt(roz.rezy[0].c)} mm. Jde jen jednou stranou – když nejde, otočte ho. Zajistěte kouskem filamentu 1,75 mm zastrčeným <b>zepředu do vodorovného otvoru</b> za koncem kusu.`);
      kroky.push('Čelisti rozevřete a kabel vložte z boku napříč do drážky – kabel se nemusí přerušit.');
      kroky.push('Stiskněte, až čelisti dosednou – špička se zapíchne do pláště. Objímku posouvejte po kabelu <b>ve směru šipky</b> na horní čelisti (nebo kabel táhněte proti šipce). Ostří tak najíždí na plášť a špička ho podélně rozpárá.');
      kroky.push(`Plášť od řezu rozevřete a odstřihněte. Když řez nestačí, zvětšete hloubku řezu nebo korekci (nyní ${J.fmt(p.korekce)} mm).`);
      return ol();
    }
    if (stav.rezim === 'merka') {
      kroky.push('Vytiskněte naplocho (číslice nahoře), bez podpěr. Otvory se tisknou o desetiny menší – korekce otvorů to vyrovnává; ověřte ji vrtákem nebo kalibrem známého průměru.');
      kroky.push('Určení průřezu: holé jádro zkoušejte od nejmenšího otvoru – průřez je číslo u prvního otvoru, kterým projde. Lanko nejdřív zakruťte. Je to orientační kontrola, ne měření.');
      kroky.push('Odměření délky: neodizolovaný vodič vložte do drážky koncem na doraz. Přední hrana destičky ukazuje, kde izolaci naříznout (např. hřebínkem nebo nožem).');
      if (norm.p.pravitko > 0) kroky.push('Pravítko u zadní hrany: rysky po 1 mm, delší po 5 a 10 mm.');
      return ol();
    }
    if (stav.rezim === 'sesivacka') {
      kroky.push(`Vytiskněte STL tak, jak je uložené – <b>na boku</b> (profil na podložce), bez podpěr, z ${esc(p.materialListu)}. Pružný oblouk pak leží celý v rovině podložky – tiskne se bez podpěr a vrstvy jdou podél něj, takže vydrží. Aspoň 3 perimetry, oblouk tiskněte plný.`);
      kroky.push(`Zkontrolujte obě štěrbiny (šířka ${J.fmt(p.cepelT + p.vuleStrbiny)} mm). Je-li některá zalitá, protáhněte ji kouskem staré čepele.`);
      kusy.forEach(k => kroky.push(`Ulomte ${esc(k.nazev)} o <b>${k.clanku} ${k.clanku === 1 ? 'článku' : 'článcích'}</b> (ostří ${J.fmt(k.P)} mm). Lámejte kleštěmi, nikdy prsty.`));
      kroky.push('Spodní čepel zasuňte z boku ostřím nahoru, horní ostřím dolů, obě až na doraz. Zadní konec kapsy je šikmý podle lomové rýhy – kus jde zasunout jen jednou stranou (když nejde, otočte ho). Do svislých otvorů u boku zastrčte kousky filamentu 1,75 mm: kus se pak opírá o šikmý konec a kolík a nevypadne ani z horní čelisti.');
      kroky.push(`Vodiče zasuňte zepředu do svých drážek až na doraz (${roz.souhrn.yDoraz !== null ? J.fmt(roz.souhrn.delkaOdiz) + ' mm' : 'bez dorazu'}). Najednou jich může být i víc.`);
      kroky.push('Stiskněte čelisti až dosednou na sebe – to je doraz, víc tlačit není potřeba. Ostří se zakousnou do izolace shora i zespodu.');
      kroky.push('Se sevřenými čelistmi vodiče vytáhněte dopředu. Izolace se utrhne po obvodu a zůstane v čelistech; po povolení ji vyklepněte.');
      kroky.push(`Když izolace nejde stáhnout, zvětšete hloubku řezu nebo korekci (nyní ${J.fmt(p.korekce)} mm); když je jádro poškrábané, zmenšete ji.`);
      $('postup').innerHTML = '<ol>' + kroky.map(k => `<li>${k}</li>`).join('') + '</ol>';
      return;
    }
    kroky.push(`Vytiskněte STL spodní plochou na podložce, bez podpěr, s výškou vrstvy 0,2 mm nebo menší. Vhodný je PETG nebo PLA a aspoň 3 perimetry.`);
    kroky.push(`Zkontrolujte štěrbinu: šířka ${J.fmt(p.cepelT + p.vuleStrbiny)} mm, výška ${J.fmt(roz.strbiny[0].z1 - roz.z0)} mm. Je-li zalitá, protáhněte ji kouskem staré čepele.`);
    kusy.forEach(k => kroky.push(`Ulomte kus čepele (${esc(k.nazev)}) o <b>${k.clanku} ${k.clanku === 1 ? 'článku' : 'článcích'}</b> (ostří ${J.fmt(k.P)} mm). Lámejte kleštěmi nebo v drážce nože, nikdy prsty.`));
    if (stav.rezim === 'hrebinek') kroky.push('Zasuňte čepel ostřím nahoru z levého boku až na doraz. Do svislého otvoru u boku zastrčte kousek filamentu 1,75 mm a zarovnejte ho.');
    else if (stav.rezim === 'kulaty') kroky.push('Příčnou čepel zasuňte ostřím nahoru z levého boku, podélnou ze zadní stěny, obě až na doraz. Obě zajistěte kouskem filamentu 1,75 mm ve svislém otvoru.');
    else kroky.push('Čepel zasuňte ostřím nahoru ze zadní stěny až na doraz a zajistěte kouskem filamentu 1,75 mm ve svislém otvoru.');
    if (stav.rezim === 'hrebinek') {
      kroky.push(`Vodič vložte zepředu do drážky svého průřezu${roz.souhrn.yDoraz !== null ? ' až na doraz' : ' na potřebnou délku'}. Palcem ho přitlačte ke dnu a protočte o 360° (raději 2×).`);
      kroky.push(`Vodič vytáhněte dopředu. Odříznutá izolace (${roz.souhrn.yDoraz !== null ? J.fmt(roz.souhrn.delkaOdiz) + ' mm' : 'za čepelí'}) zůstane v drážce, odkud ji vyklepněte.`);
    } else if (stav.rezim === 'kulaty') {
      kroky.push('Kruhový řez: kabel vložte do levé drážky tak, aby rovina příčné čepele byla v místě řezu. Přitlačte ho dlaní ke dnu a jednou až dvakrát ho protočte.');
      kroky.push('Podélný řez: kabel vložte do pravé drážky kruhovým řezem k přední hraně čepele, přitlačte a protáhněte směrem ke konci kabelu.');
      kroky.push('Plášť rozevřete a stáhněte. Pod pláštěm CYKY je výplňový obal, který chrání žíly před ostřím.');
    } else {
      kroky.push('Plochý kabel vložte naplocho do drážky, přitlačte ke dnu a protáhněte. Plášť se podélně nařízne nad žílou.');
      kroky.push('Plášť od řezu rozevřete a stáhněte. Kraje pláště se pak dají odstřihnout.');
    }
    kroky.push(`Když řez nestačí nebo zasahuje do jádra, změňte <b>korekci výšky ostří</b> (nyní ${J.fmt(p.korekce)} mm) po 0,05–0,1 mm a vytiskněte znovu.`);
    $('postup').innerHTML = '<ol>' + kroky.map(k => `<li>${k}</li>`).join('') + '</ol>';
  }

  /* ---------- manifold ---------- */
  function nactiSkript(src) {
    return new Promise((ok, chyba) => {
      const el = document.createElement('script'); el.src = src;
      el.onload = ok; el.onerror = () => chyba(new Error('nejde načíst ' + src));
      document.head.appendChild(el);
    });
  }
  async function nactiManifold() {
    globalThis.MANIFOLD_URL = new URL('lib/manifold/manifold.klasicky.js', location.href).href;
    if (!globalThis.ManifoldModule) await nactiSkript('lib/manifold/manifold.klasicky.js');
    let volby;
    if (location.protocol === 'file:') {
      await nactiSkript('lib/manifold/manifold.wasm.js');
      const b64 = globalThis.MANIFOLD_WASM_B64, s = atob(b64), bin = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) bin[i] = s.charCodeAt(i);
      delete globalThis.MANIFOLD_WASM_B64;
      volby = { wasmBinary: bin };
    } else volby = { locateFile: x => new URL('lib/manifold/' + x, location.href).href };
    const m = await globalThis.ManifoldModule(volby);
    m.setup();
    return m;
  }

  /* ---------- export ---------- */
  function stahni(data, nazev, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: typ }));
    a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function nazevSouboru() {
    const p = norm.p;
    if (stav.rezim === 'hrebinek') return `stahovak_hrebinek_${p.vodice.length}drazek_cepel${J.fmt(p.cepelW)}`;
    if (stav.rezim === 'sesivacka') return `stahovak_sesivacka_${p.vodice.length}drazek_cepel${J.fmt(p.cepelW)}`;
    if (stav.rezim === 'vkleste') return `kleste_v_zarez_alfa${J.fmt(p.uhelV)}`;
    if (stav.rezim === 'jemne') return `jemny_odizolovac_alfa${J.fmt(p.uhelV)}`;
    if (stav.rezim === 'podelny') return `objimka_podelny_rez_kabel${J.fmt(p.kabelD)}_${p.provedeni}`;
    if (stav.rezim === 'merka') return `merka_${p.druhJadra}`;
    if (stav.rezim === 'kulaty') return `odplastovac_kabel${J.fmt(p.kabelD)}_plast${J.fmt(p.kabelT)}`;
    return `odplastovac_plochy_${J.fmt(p.plochyS)}x${J.fmt(p.plochyH)}`;
  }
  /* Sešívačka se tiskne na boku: (x, y, z) → (y, z, x) – bok x = 0 s otvory štěrbin leží na podložce. */
  function sitKTisku() {
    if (!roz || !roz.kloub) return sit;
    const poz = new Float64Array(sit.poz.length);
    for (let i = 0; i < poz.length; i += 3) { poz[i] = sit.poz[i + 1]; poz[i + 1] = sit.poz[i + 2]; poz[i + 2] = sit.poz[i]; }
    return { poz, idx: sit.idx };
  }
  function exportStl() {
    if (!sit) return;
    const k = J.zkontrolujSit(sit);
    if (!k.vodotesna || !(k.objem > 0)) { Dialog.chyba('Síť není uzavřená – export se nepovedl. Zkuste změnit parametry.'); return; }
    stahni(J.stlBinarni(sitKTisku(), nazevSouboru()), nazevSouboru().replace(/,/g, '_') + '.stl', 'model/stl');
  }
  function exportSvg() {
    if (!roz) return;
    const R = V.roviny(roz), svg = V.rezSvg(roz, R[rovina].y, { rovina: R[rovina] });
    const styl = `<style>.teleso{fill:#e7b25c;fill-opacity:.55;stroke:#222;stroke-width:.12}.srafa{stroke:#222;stroke-width:.12;opacity:.35}.vyrez{fill:#fff}.teleso.bez{stroke:none}.obrys{fill:none;stroke:#222;stroke-width:.14}.cepel{fill:#9aa0a8;stroke:#222;stroke-width:.08}.cepel.za{fill-opacity:.6;stroke-dasharray:.5 .3}.strbina{fill:none;stroke:#222;stroke-width:.06;stroke-dasharray:.4 .3}.kolik{fill:#7fbf6a}.izolace{fill:#3b7fd9;fill-opacity:.55;stroke:#3b7fd9;stroke-width:.06}.jadro,.jadro-pl{fill:#d08a3c}.ostri{stroke:#d0201a;stroke-width:.1;stroke-dasharray:.6 .4}.popis{fill:#555;font-family:sans-serif}</style>`;
    stahni(svg.replace('>', '>' + styl), nazevSouboru().replace(/,/g, '_') + '_rez.svg', 'image/svg+xml');
  }

  /* ---------- návrhy ---------- */
  function ctiSady() { try { const s = JSON.parse(localStorage.getItem(KLIC_SADY) || '{}'); return s && typeof s === 'object' ? s : {}; } catch (e) { return {}; } }
  function zapisSady(s) { try { localStorage.setItem(KLIC_SADY, JSON.stringify(s)); return true; } catch (e) { Dialog.chyba('Návrh se nepodařilo uložit (úložiště je plné nebo zakázané).'); return false; } }
  function ukazSady(vybrat) {
    const s = ctiSady(), jm = Object.keys(s).sort((a, b) => a.localeCompare(b, 'cs'));
    $('sady').innerHTML = jm.length ? jm.map(n => `<option${n === vybrat ? ' selected' : ''}>${esc(n)}</option>`).join('') : '<option value="">(žádné uložené návrhy)</option>';
  }
  function nastavNavrh(d) {
    if (!d || !J.REZIMY[d.rezim]) throw new Error('soubor neobsahuje návrh stahováku');
    stav.rezim = d.rezim;
    stav.hodnoty[d.rezim] = Object.assign(J.vychozi(d.rezim), d.hodnoty || {});
    vykresliFormular(); prestav(true); ulozStav();
  }

  /* ---------- události ---------- */
  function navaz() {
    $('rezimy').addEventListener('click', e => {
      const b = e.target.closest('button[data-rezim]'); if (!b || b.dataset.rezim === stav.rezim) return;
      stav.rezim = b.dataset.rezim; rovina = 0; vybranaDrazka = 0;
      vykresliFormular(); prestav(true); ulozStav();
    });
    $('formular').addEventListener('input', zmenaPole);
    $('formular').addEventListener('change', e => { if (e.target.tagName === 'SELECT') zmenaPole(e); });
    // vodiče
    const tb = $('tabVodice').tBodies[0];
    tb.addEventListener('input', e => {
      const tr = e.target.closest('tr'), k = e.target.dataset.k; if (!tr || !k) return;
      H().vodice[+tr.dataset.i][k] = k === 'nazev' ? e.target.value : e.target.value;
      naplanuj();
    });
    tb.addEventListener('click', e => {
      const b = e.target.closest('button[data-smaz]'); if (!b) return;
      H().vodice.splice(+b.dataset.smaz, 1); vykresliVodice(); naplanuj();
    });
    $('pridejVodic').innerHTML = '<option value="">+ přidat vodič z předvoleb…</option>' + J.VODICE.concat(J.VODICE_JEMNE).map(v => `<option value="${v.id}">${esc(v.nazev)} – ⌀ ${J.fmt(v.D)}, izolace ${J.fmt(v.t)}</option>`).join('');
    $('pridejVodic').addEventListener('change', e => {
      const v = J.VODICE.concat(J.VODICE_JEMNE).find(x => x.id === e.target.value); e.target.value = '';
      if (!v) return;
      if (H().vodice.length >= 16) { Dialog.info('Nejvýš 16 drážek.'); return; }
      H().vodice.push({ nazev: v.nazev, D: v.D, t: v.t, d: v.d }); vykresliVodice(); naplanuj();
    });
    $('btnVlastniVodic').addEventListener('click', () => {
      if (H().vodice.length >= 16) { Dialog.info('Nejvýš 16 drážek.'); return; }
      H().vodice.push({ nazev: 'vlastní', D: 3, t: 0.7, d: 1.6 }); vykresliVodice(); naplanuj();
    });
    $('btnRadit').addEventListener('click', () => { H().vodice.sort((a, b) => J.cislo(String(a.D)) - J.cislo(String(b.D))); vykresliVodice(); naplanuj(); });
    $('btnVychozi').addEventListener('click', async () => {
      if (!(await Dialog.potvrd('Vrátit parametry režimu „' + J.REZIMY[stav.rezim].nazev + '“ na výchozí hodnoty?'))) return;
      stav.hodnoty[stav.rezim] = J.vychozi(stav.rezim); vykresliFormular(); prestav(); ulozStav();
    });
    // 3D
    const volby = () => S.nastavVolby({ cepele: $('chkCepele').checked, vodice: $('chkVodice').checked, pruhledne: $('chkPruhledne').checked, rez: $('chkRez').checked });
    for (const id of ['chkCepele', 'chkVodice', 'chkPruhledne', 'chkRez']) $(id).addEventListener('change', volby);
    for (const b of document.querySelectorAll('[data-pohled]')) b.addEventListener('click', () => S.pohled(b.dataset.pohled));
    // stisk sešívačky
    $('stisk').addEventListener('input', e => { zastavAnimaci(); $('stiskHodnota').textContent = e.target.value + ' %'; S.nastavStisk(e.target.value / 100); });
    $('btnStisk').addEventListener('click', () => {
      if (animace) { zastavAnimaci(); return; }
      $('btnStisk').setAttribute('aria-pressed', 'true'); $('btnStisk').textContent = '⏸ Zastavit';
      const t0 = performance.now();
      const krok = t => {
        const s = (1 - Math.cos((t - t0) / 1600 * Math.PI)) / 2;          // tam a zpět
        $('stisk').value = Math.round(s * 100); $('stiskHodnota').textContent = Math.round(s * 100) + ' %';
        S.nastavStisk(s);
        animace = requestAnimationFrame(krok);
      };
      animace = requestAnimationFrame(krok);
    });
    // řezy
    $('zalozkyRez').addEventListener('click', e => { const b = e.target.closest('[data-rovina]'); if (!b) return; rovina = +b.dataset.rovina; ukazRezy(); });
    $('tabRezy').addEventListener('click', e => { const tr = e.target.closest('tr[data-j]'); if (!tr) return; vybranaDrazka = +tr.dataset.j; ukazVysledky(); ukazRezy(); });
    // export
    $('btnStl').addEventListener('click', exportStl);
    $('btnSvg').addEventListener('click', exportSvg);
    // návrhy
    $('btnUloz').addEventListener('click', async () => {
      const jm = await Dialog.zeptej('Název návrhu', J.REZIMY[stav.rezim].nazev + ' ' + new Date().toLocaleDateString('cs-CZ'));
      if (!jm || !jm.trim()) return;
      const s = ctiSady();
      if (s[jm.trim()] && !(await Dialog.potvrd('Návrh „' + jm.trim() + '“ už existuje. Přepsat?'))) return;
      s[jm.trim()] = { rezim: stav.rezim, hodnoty: H() };
      if (zapisSady(s)) ukazSady(jm.trim());
    });
    $('btnNacti').addEventListener('click', () => { const s = ctiSady()[$('sady').value]; if (s) nastavNavrh(s); });
    $('btnSmaz').addEventListener('click', async () => {
      const n = $('sady').value, s = ctiSady(); if (!s[n]) return;
      if (!(await Dialog.potvrd('Smazat návrh „' + n + '“?'))) return;
      delete s[n]; if (zapisSady(s)) ukazSady();
    });
    $('btnExportJson').addEventListener('click', () => stahni(JSON.stringify({ format: 'odizolovac-v1', rezim: stav.rezim, hodnoty: H() }, null, 2), nazevSouboru().replace(/,/g, '_') + '.json', 'application/json'));
    $('btnImportJson').addEventListener('click', () => $('souborJson').click());
    $('souborJson').addEventListener('change', async e => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      try { nastavNavrh(JSON.parse(await f.text())); } catch (x) { Dialog.chyba('Soubor nejde načíst: ' + x.message); }
    });
  }

  function zastavAnimaci() {
    if (animace) cancelAnimationFrame(animace);
    animace = 0; $('btnStisk').setAttribute('aria-pressed', 'false'); $('btnStisk').textContent = '▶ Stisknout';
  }

  /* ---------- start ---------- */
  function start() {
    navaz(); ukazSady();
    vykresliFormular();
    prestav(true);
    try { S.init($('platno3d')); } catch (e) { $('zprava3d').textContent = 'WebGL není k dispozici – 3D náhled nejde zobrazit (výkres řezu a export fungují).'; }
    nactiManifold().then(m => {
      w = m; $('zprava3d').hidden = true; prestav(true);
    }).catch(e => {
      chybaJadra = e; $('zprava3d').textContent = 'Výpočetní jádro (manifold-3d) se nepodařilo načíst: ' + (e && e.message || e);
    });
  }
  window.ODIZ_APP = { sitKTisku: () => sitKTisku(), stav: () => stav, norm: () => norm, roz: () => roz, sit: () => sit, pripraveno: () => !!w && !!telo, chyba: () => chybaJadra, prestav, nastavNavrh };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
