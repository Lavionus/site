/* Modelář 3D – inspektor vybraných těles (plovoucí karta nad plochou).
   Jedno těleso: název, rozměry, poloha (X, Y střed, Z spodek nad deskou),
   natočení, parametry tvaru, barva, těleso/díra, skrýt, zamknout, smazat.
   Víc těles: společná barva, role, skrytí, zámek a smazání.
   Číselná pole berou desetinnou čárku i tečku, Enter nebo opuštění pole
   hodnotu potvrdí, šipky ↑/↓ mění o krok (se Shiftem o 10 kroků).
   Při změně dokumentu se obnoví jen pole, ve kterých uživatel zrovna nepíše. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';

  const PALETA = ['#e5533c', '#f08c2a', '#e8c22a', '#3cae5c', '#1fa5a0', '#2f8fd8',
                  '#4a6fd9', '#9b59b6', '#d94a8c', '#7a5230', '#7a8b99', '#f2f2f2', '#2b2b2b'];
  const OSY = ['X', 'Y', 'Z'];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // M.prectiCislo (čárka i tečka, jednotky, výpočty 60/2) je ve spolecne.js

  /** Krátké upozornění u pole (neplatná nebo oříznutá hodnota): červený záblesk a zpráva dole. */
  M.oznamPole = function (input, text) {
    if (input && input.classList) {
      input.classList.remove('pole-chyba'); void input.offsetWidth; input.classList.add('pole-chyba');
      setTimeout(() => input.classList.remove('pole-chyba'), 1200);
    }
    if (typeof Dialog !== 'undefined') Dialog.info(text);
  };

  M.vytvorInspektor = function (karta) {
    let pole = [];                 // {input, cti: u → číslo, zapis: (číslo) → void, des, krok}
    let klicStavby = '';

    let skupinaPoli = '';                    // „Rozměr“, „Poloha“… – předpona přístupného názvu pole X/Y/Z
    function cislo(popis, cti, zapis, { krok = 1, des = 2, jednotka = '', min = -Infinity, max = Infinity } = {}) {
      const id = 'insp' + (pole.length + 1);
      pole.push({ id, cti, zapis, krok, des, min, max });
      const nazev = (/^[XYZ]$/.test(popis) && skupinaPoli ? skupinaPoli + ' ' : '') + popis + (jednotka ? ' (' + jednotka + ')' : '');
      return `<label class="ip" for="${id}"><span class="osa">${popis}</span>`
        + `<input id="${id}" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="${esc(nazev)}">`
        + (jednotka ? `<span class="jed">${jednotka}</span>` : '') + `</label>`;
    }

    function postav() {
      const uzly = M.vybraneUzly();
      pole = [];
      if (!uzly.length) { karta.hidden = true; karta.innerHTML = ''; klicStavby = ''; return; }
      karta.hidden = false;
      const u = uzly[0], jeden = uzly.length === 1;
      const t = jeden ? M.popisDruhu(u.druh) : null;
      let h = '';
      if (jeden) {
        const ik = M.ikonyTvaru && M.ikonyTvaru[u.druh];
        h += `<div class="hlava">${ik ? `<img src="${ik}" alt="">` : `<span class="ikona-druhu">${t.ikona}</span>`}
          <input id="inspNazev" class="nazev" type="text" maxlength="80" aria-label="Název tělesa">
          <span class="druh">${esc(t.nazev)}</span></div>`;
        skupinaPoli = 'Rozměr';
        // natočené těleso: rozměry jsou podél jeho vlastních os (poloha je ve světě) – říct to
        const natocene = u.rotace && u.rotace.some(x => Math.abs(x % 360) > 1e-6);
        h += `<div class="skupina"><div class="nadpis">Rozměry${natocene ? ' <span class="pozn" title="Těleso je natočené: šířka, hloubka a výška se měří podél jeho vlastních os, ne podél os desky">(osy tělesa)</span>' : ''}</div><div class="trojice">`
          + OSY.map((o, i) => cislo(o, u => u.rozmer[i], v => zmenRozmer(i, v), { krok: 1, jednotka: '', min: 0.01, max: 10000 })).join('')
          + `</div></div>`;
        skupinaPoli = 'Poloha';
        h += `<div class="skupina"><div class="nadpis">Poloha <span class="pozn">(Z = spodek nad deskou)</span></div><div class="trojice">`
          + cislo('X', u => u.poloha[0], v => zmenPolohu(0, v))
          + cislo('Y', u => u.poloha[1], v => zmenPolohu(1, v))
          + cislo('Z', u => M.spodekUzlu(u), v => zmenPolohu(2, v))
          + `</div></div>`;
        skupinaPoli = 'Natočení';
        h += `<div class="skupina"><div class="nadpis">Natočení (°)</div><div class="trojice">`
          + OSY.map((o, i) => cislo(o, u => u.rotace[i], v => zmenRotaci(i, v), { krok: 15, des: 1 })).join('')
          + `</div></div>`;
        skupinaPoli = '';
        if (u.druh === 'sit') {
          const z = M.zdroje.get(u.zdroj);
          h += `<div class="skupina"><div class="nadpis">Importovaný model</div><div class="pozn">${z ? `${esc(z.nazev || '')} · ${M.pocet(z.idx.length / 3, 'trojúhelník', 'trojúhelníky', 'trojúhelníků').replace(/^\d+/, (z.idx.length / 3).toLocaleString('cs'))} · původně ${u.zaklad.map(x => M.mm(x)).join(' × ')} mm` : 'geometrie chybí'}</div>`
            + (z && z.paleta && z.paleta.length > 1 ? `<label class="zaskrt"><input type="checkbox" id="inspBarvySouboru"> Barvy ze souboru (${z.paleta.length})</label>` : '') + `</div>`;
        }
        if (u.druh === 'skupina') {
          h += `<div class="skupina"><div class="nadpis">Skupina <span class="pozn">(${M.pocet(u.deti.length, 'část', 'části', 'částí')})</span></div>
            <div class="role" role="group" aria-label="Operace skupiny">
              <button type="button" class="tl" data-operace="sjednoceni" title="Sjednocení plných částí, díry se odečtou">∪ Sjednocení</button>
              <button type="button" class="tl" data-operace="prunik" title="Jen společná část plných částí">∩ Průnik</button></div>
            <label class="zaskrt"><input type="checkbox" id="inspBarevne"> Barevná (zachovat barvy částí)</label></div>`;
          if (u.occt) {
            const o = u.occt, n = o.operace === 'skorepina' ? (o.plochy.length ? `otevřené plochy: ${o.plochy.length}` : 'uzavřená')
              : o.operace === 'odsazeni' ? (o.hodnota > 0 ? 'zvětšené' : 'zmenšené') : `hrany: ${o.hrany.length}`;
            const co = { zaobleni: 'Zaoblení r', srazeni: 'Sražení', skorepina: 'Skořepina, stěna', odsazeni: 'Odsazení stěn' }[o.operace];
            h += `<div class="skupina"><div class="nadpis">Přesná úprava <span class="pozn">(OpenCascade)</span></div>
              <div class="pozn" id="inspOcct">${co} ${o.operace === 'odsazeni' && o.hodnota > 0 ? '+' : ''}${M.mm(o.hodnota, 2)} mm · ${n}</div>
              <div class="role"><button type="button" class="tl" id="inspOcctUpravit">✎ Upravit…</button>
              <button type="button" class="tl" id="inspOcctOdebrat" title="Vrátit těleso bez úpravy">✕ Odebrat úpravu</button></div></div>`;
          }
        }
        // parametry tvaru: čísla, volby (seznam), přepínače; u skici jen ty pro zvolený režim
        // průměr vlastního závitu jen u volby „Vlastní průměr“; vlastní okraje puzzle jen u volby „Vlastní“
        const param = t.parametry.filter(d => (!d.rezim || d.rezim === u.param.rezim)
          && !(d.klic === 'prumer' && 'velikost' in u.param && u.param.velikost !== 'vlastni')
          && !(d.klic === 'hrany' && u.druh === 'puzzle' && u.param.vystupky !== 'vlastni'));
        if (param.length || u.druh === 'skica') {
          h += `<div class="skupina"><div class="nadpis">${u.druh === 'skica' ? 'Těleso ze skici' : M.DILY && M.DILY[u.druh] ? 'Díl' : 'Tvar'}</div>`
            + param.map(d => d.volby
              ? `<label class="ip"><span class="osa">${esc(d.popis)}</span><select data-param="${d.klic}">${d.volby.map(([v, p]) => `<option value="${v}">${esc(p)}</option>`).join('')}</select></label>`
              : d.prepinac
                ? `<label class="zaskrt"><input type="checkbox" data-param="${d.klic}"> ${esc(d.popis)}</label>`
              : d.text
                ? `<label class="ip"><span class="osa">${esc(d.popis)}</span><input type="text" data-param="${d.klic}" class="text-param" maxlength="200" aria-label="${esc(d.popis)}"></label>`
                : d.odvozeny
                ? cislo(d.popis, u => d.cti(u.rozmer, Object.assign({}, (M.TVARY[u.druh] || M.DILY[u.druh]).param, u.param)), v => zmenOdvozeny(d, v),
                  { krok: d.krok, des: 2, jednotka: d.jednotka || '', min: d.min, max: d.max })
                : cislo(d.popis, u => u.param[d.klic], v => zmenParam(d.klic, v),
                  { krok: d.krok, des: d.cele ? 0 : 2, jednotka: d.jednotka || '', min: d.min, max: d.max })).join('')
            + (u.druh === 'skica' ? `<button type="button" class="tl siroke-tl" id="inspSkica">✏️ Upravit skicu</button>` : '')
            + (M.DILY && M.DILY[u.druh] && M.DILY[u.druh].tip ? `<p class="dil-tip">💡 ${esc(M.DILY[u.druh].tip)}</p>` : '')
            + (u.vazba && M.protikusy(M.app.dok, u).length ? `<p class="vazba-info">🔗 Propojeno s: ${M.protikusy(M.app.dok, u).map(x => esc(x.nazev) + (x.zamceno ? ' (🔒 zamčený – nemění se)' : '')).join(', ')} – závit / rozměry se mění spolu.
                <button type="button" class="odkaz-tl" id="inspRozpojit">Zrušit propojení</button></p>` : '')
            + (u.druh === 'kolo' && u.param.druh !== 'vnitrni' ? `<button type="button" class="tl siroke-tl" id="inspProtikolo" title="Druhé kolo ve správné osové vzdálenosti, natočené tak, aby zuby zapadly">⚙ Přidat protikolo…</button>` : '')
            + `</div>`;
        }
      } else {
        h += `<div class="hlava"><strong>${uzly.length <= 4 ? 'Vybrána' : 'Vybráno'} ${M.pocet(uzly.length, 'těleso', 'tělesa', 'těles')}</strong></div>`;
        // víc těles stejného druhu (dílky skládačky, šrouby…): společné parametry – změna platí pro všechna
        const druh = uzly[0].druh, td = uzly.every(x => x.druh === druh) && druh !== 'skica' && (M.TVARY[druh] || (M.DILY && M.DILY[druh]));
        if (td) {
          const spol = td.parametry.filter(d => !d.odvozeny && !d.text && d.klic !== 'segmentu'
            && !(d.klic === 'prumer' && 'velikost' in uzly[0].param && uzly.some(x => x.param.velikost !== 'vlastni')));
          if (spol.length) h += `<div class="skupina"><div class="nadpis">Společné parametry (${esc(td.nazev)})</div>`
            + spol.map(d => d.volby
              ? `<label class="ip"><span class="osa">${esc(d.popis)}</span><select data-param="${d.klic}">${d.volby.map(([v, p]) => `<option value="${v}">${esc(p)}</option>`).join('')}</select></label>`
              : d.prepinac ? `<label class="zaskrt"><input type="checkbox" data-param="${d.klic}"> ${esc(d.popis)}</label>`
              : cislo(d.popis, u => u.param[d.klic], v => zmenParam(d.klic, v), { krok: d.krok, des: d.cele ? 0 : 2, jednotka: d.jednotka || '', min: d.min, max: d.max })).join('')
            + `<p class="dil-tip">Hodnoty ukazuje první vybrané těleso; změna platí pro všechna.</p></div>`;
        }
      }
      // kvalita oblých ploch (počet segmentů) – i pro víc těles a skupiny najednou
      if (uzly.some(x => M.kvalitaUzlu(x) || x.druh === 'kvadr'))
        h += `<div class="skupina kvalita"><div class="nadpis">Kvalita oblých ploch</div><div class="kvalita-volby" role="group" aria-label="Kvalita oblých ploch">`
          + M.KVALITY.map(k => `<button type="button" class="tl" data-kvalita="${k.id}" aria-pressed="false" aria-label="${k.kratce === k.nazev ? 'Kvalita ' + k.nazev.toLowerCase() : k.kratce + ' (' + k.nazev.toLowerCase() + ' kvalita)'}">${k.kratce}</button>`).join('') + `</div><p class="kvalita-odhad" id="inspKvalitaOdhad"></p></div>`;
      h += `<div class="skupina"><div class="nadpis">Barva</div><div class="paleta">`
        + PALETA.map(b => `<button type="button" class="vzorek" data-barva="${b}" style="background:${b}" title="${M.nazevBarvy ? M.nazevBarvy(b) + ' ' + b : b}" aria-label="Barva ${M.nazevBarvy ? M.nazevBarvy(b) : b}" aria-pressed="false"></button>`).join('')
        + `<label class="vlastni" title="Vlastní barva"><input type="color" id="inspBarva" aria-label="Vlastní barva">🎨</label></div></div>`;
      h += `<div class="skupina role" role="group" aria-label="Role">
          <button type="button" class="tl" data-role="teleso">⬛ Těleso</button>
          <button type="button" class="tl" data-role="dira">▨ Díra</button></div>`;
      h += `<div class="skupina akce">
          <button type="button" class="tl" id="inspSkryt">👁 Skrýt</button>
          <button type="button" class="tl" id="inspZamek">🔓 Zamknout</button>
          <button type="button" class="tl nebezpeci" id="inspSmazat">🗑 Smazat</button></div>`;
      karta.innerHTML = h;

      // obsluha
      for (const p of pole) {
        const i = karta.querySelector('#' + p.id);
        p.input = i;
        const potvrd = () => {
          // přestavba inspektoru odstraní pole s fokusem a prohlížeč pošle jeho change – už nepatří k ničemu
          if (!i.isConnected) return;
          const v = M.prectiCislo(i.value);
          if (!isFinite(v)) {
            if (i.value.trim()) M.oznamPole(i, `„${i.value.trim()}“ není číslo – piš třeba 25, 12,5, 60/2 nebo 3 cm.`);
            obnov(true); return;
          }
          // text beze změny (zaokrouhlené zobrazení): nic nezapisovat, jinak by se přesná hodnota zaokrouhlila
          const u = M.vybraneUzly()[0];
          if (u && i.value === M.mm(p.cti(u), p.des)) { obnov(true); return; }
          const o = M.omez(v, p.min, p.max);
          if (o !== v) M.oznamPole(i, `${M.mm(v, 3)} je mimo rozsah – použito ${M.mm(o, 3)} (${isFinite(p.min) ? 'nejméně ' + M.mm(p.min, 3) : ''}${isFinite(p.min) && isFinite(p.max) ? ', ' : ''}${isFinite(p.max) ? 'nejvýš ' + M.mm(p.max, 3) : ''}).`);
          p.zapis(o);
          obnov(true);
        };
        i.addEventListener('change', potvrd);
        i.addEventListener('keydown', e => {
          if (e.key === 'Enter') { potvrd(); i.select(); }
          else if (e.key === 'Escape') { obnov(true); i.blur(); }
          else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const u = M.vybraneUzly()[0];
            const nezmeneno = u && i.value === M.mm(p.cti(u), p.des);
            const v = (!nezmeneno && isFinite(M.prectiCislo(i.value)) ? M.prectiCislo(i.value) : p.cti(u))
              + (e.key === 'ArrowUp' ? 1 : -1) * p.krok * (e.shiftKey ? 10 : 1);
            M.sloucitDalsi = 'insp-' + p.id;        // držení šipky = jeden krok historie
            p.zapis(M.omez(Math.round(v * 1e6) / 1e6, p.min, p.max));
            M.sloucitDalsi = null;
            obnov(true);
            i.select();
          }
        });
        i.addEventListener('focus', () => i.select());
      }
      const nazev = karta.querySelector('#inspNazev');
      if (nazev) {
        const ulozNazev = () => { if (nazev.value.trim()) M.upravVybrane({ nazev: nazev.value }, 'Přejmenovat'); obnov(true); };
        nazev.addEventListener('change', ulozNazev);
        nazev.addEventListener('keydown', e => { if (e.key === 'Enter') { ulozNazev(); nazev.blur(); } });
      }
      // barva u barevné skupiny ji převede na jednobarevnou (jako v Tinkercadu)
      const nastavBarvu = b => M.upravVybrane(x => x.druh === 'skupina' && x.barevne ? { barva: b, barevne: false } : { barva: b }, 'Barva');
      karta.querySelectorAll('.vzorek').forEach(b => b.onclick = () => nastavBarvu(b.dataset.barva));
      const vlastni = karta.querySelector('#inspBarva');
      // tažení ve výběru barvy posílá desítky událostí – jeden krok historie
      vlastni.addEventListener('input', () => { M.sloucitDalsi = 'barva'; nastavBarvu(vlastni.value); M.sloucitDalsi = null; });
      karta.querySelectorAll('[data-param]').forEach(el => el.addEventListener('change', () => {
        // textový parametr s pevným tvarem (okraje puzzle): neplatný zápis ohlásit, ne tiše zahodit
        const u0 = M.vybraneUzly()[0], t0 = u0 && (M.TVARY[u0.druh] || (M.DILY && M.DILY[u0.druh]));
        const d = t0 && t0.parametry.find(x => x.klic === el.dataset.param);
        if (d && d.vzor && !d.vzor.test(el.value.trim())) { M.oznamPole(el, d.chyba || 'Neplatná hodnota.'); el.value = u0.param[d.klic]; return; }
        zmenParam(el.dataset.param, el.type === 'checkbox' ? el.checked : el.value);
      }));
      const tlSkica = karta.querySelector('#inspSkica');
      if (tlSkica) tlSkica.onclick = () => M.otevriSkicar(M.app.vyber[0]);
      const tlRozpojit = karta.querySelector('#inspRozpojit');
      if (tlRozpojit) tlRozpojit.onclick = () => {
        const u = M.vybraneUzly()[0];
        M.zmenDokument(M.nastavVazbu(M.app.dok, [u.id, ...M.protikusy(M.app.dok, u).map(x => x.id)], false), 'Zrušit propojení');
      };
      const tlKolo = karta.querySelector('#inspProtikolo');
      if (tlKolo) tlKolo.onclick = async () => {
        const kolo = M.vybraneUzly()[0];
        const t = await Dialog.zeptej('Počet zubů protikola (převod = zuby protikola / zuby tohoto kola):', String(kolo.param.zubu));
        if (t === null) return;
        const z = M.prectiCislo(t);
        if (!(z >= 6 && z <= 300)) { Dialog.chyba('Počet zubů musí být 6 až 300.'); return; }
        const ted = M.najdiUzel(M.app.dok, kolo.id);
        const k2 = ted && M.protikolo(ted, z, M.app.dok);
        if (!k2) { Dialog.chyba('Protikolo jde jen ke kolu s vnějším ozubením, které není nerovnoměrně roztažené.'); return; }
        const o2 = M.obalkaUzlu(k2);
        const narazi = M.app.dok.uzly.filter(x => x.id !== ted.id && !x.skryto).some(x => { const b = M.obalkaUzlu(x); return [0, 1, 2].every(i => o2.min[i] < b.max[i] - 1e-3 && o2.max[i] > b.min[i] + 1e-3); });
        M.zmenDokument(M.pridejUzly(M.app.dok, [k2]), 'Přidat protikolo');
        M.nastavVyber([k2.id]);
        const m = ted.param.modul * M.meritkoUzlu(ted)[0];
        Dialog.info(`Protikolo ${Math.round(z)} zubů v osové vzdálenosti ${M.mm(m * (ted.param.zubu + Math.round(z)) / 2, 2)} mm, zuby zapadají (převod ${M.mm(Math.round(z) / ted.param.zubu, 3)}).`
          + (narazi ? ' Pozor: kolem kola není volné místo – protikolo se překrývá s jiným tělesem, posuň ho.' : ''));
      };
      karta.querySelectorAll('[data-operace]').forEach(b => b.onclick = () => M.upravVybrane({ operace: b.dataset.operace }, b.dataset.operace === 'prunik' ? 'Průnik' : 'Sjednocení'));
      const tlOcct = karta.querySelector('#inspOcctUpravit');
      if (tlOcct) {
        tlOcct.onclick = () => u.occt.operace === 'odsazeni' ? M.otevriOdsazeni() : M.otevriUpravuHran(u.occt.operace);
        karta.querySelector('#inspOcctOdebrat').onclick = () => M.odeberUpravu(u.id);
      }
      const barvySouboru = karta.querySelector('#inspBarvySouboru');
      if (barvySouboru) barvySouboru.addEventListener('change', () => M.upravVybrane({ jednobarevne: !barvySouboru.checked }, barvySouboru.checked ? 'Barvy ze souboru' : 'Jednou barvou'));
      const barevne = karta.querySelector('#inspBarevne');
      if (barevne) barevne.addEventListener('change', () => M.upravVybrane({ barevne: barevne.checked }, barevne.checked ? 'Barevná skupina' : 'Jednobarevná skupina'));
      karta.querySelectorAll('[data-role]').forEach(b => b.onclick = () => M.upravVybrane({ role: b.dataset.role }, b.dataset.role === 'dira' ? 'Na díru' : 'Na těleso'));
      karta.querySelectorAll('[data-kvalita]').forEach(b => b.onclick = async () => {
        // jemná kvalita na velkém výběru: předem říct, kolik trojúhelníků to dá (výpočet i zobrazení se zpomalí)
        const odh = odhadKvality(b.dataset.kvalita);
        if (odh > 1.5e6 && !(await Dialog.potvrd(`Kvalita „${M.KVALITY.find(k => k.id === b.dataset.kvalita).nazev}“ dá u vybraných těles asi ${M.mm(odh / 1e6, 1)} milionu trojúhelníků – výpočet a práce se zpomalí. Pokračovat?`))) return;
        M.nastavKvalituVybranych(b.dataset.kvalita);
      });
      karta.querySelector('#inspSkryt').onclick = () => M.upravVybrane({ skryto: true }, 'Skrýt');
      karta.querySelector('#inspZamek').onclick = () => {
        const zamknout = !M.vybraneUzly().every(u => u.zamceno);
        M.upravVybrane({ zamceno: zamknout }, zamknout ? 'Zamknout' : 'Odemknout');
      };
      karta.querySelector('#inspSmazat').onclick = () => M.smazVybrane();
      klicStavby = klicInspektoru();
      obnov(true);
    }

    // odhady podle geometrie (klíč geometrie + rozměr): posun, otočení ani tažení je nepřepočítávají
    const pametOdhadu = new Map();
    const zapamatuj = (k, f) => {
      if (pametOdhadu.has(k)) return pametOdhadu.get(k);
      const v = f();
      if (pametOdhadu.size > 2000) pametOdhadu.clear();
      pametOdhadu.set(k, v);
      return v;
    };
    /** Trojúhelníky uzlu ve scéně (spočítaná geometrie; tvary rovnou ze sítě). */
    function trojUzlu(u) {
      const T = M.scena && M.scena.telesa, g = T && T.geometrieObjektu ? T.geometrieObjektu(u.id) : null;
      if (g && g.trojuhelniku) return g.trojuhelniku;
      if (!M.TVARY[u.druh]) return 0;
      return zapamatuj(M.klicGeometrie(u) + '|' + u.rozmer.join(','), () => { try { return M.sitTvaru(u.druh, u.rozmer, u.param).idx.length / 3; } catch (e) { return 0; } });
    }
    /** Odhad trojúhelníků vybraných těles při kvalitě. */
    function odhadKvality(kv) {
      return M.vybraneUzly().reduce((s, u) => {
        const ted = trojUzlu(u);
        if (!M.kvalitaUzlu(u)) return s + ted;
        return s + zapamatuj(M.klicGeometrie(u) + '|' + u.rozmer.join(',') + '|' + kv + '|' + ted, () => M.odhadTrojKvality(u, kv, ted));
      }, 0);
    }
    const tisice = n => n >= 1e6 ? M.mm(n / 1e6, 1) + ' mil.' : n >= 1000 ? M.mm(n / 1000, n < 10000 ? 1 : 0) + ' tis.' : String(Math.round(n));

    /** Přepíše hodnoty polí a stav tlačítek podle dokumentu. */
    function obnov(i_aktivni = false) {
      const uzly = M.vybraneUzly();
      if (!uzly.length) return;
      const u = uzly[0];
      const zamceno = uzly.every(x => x.zamceno), nektereZamceno = uzly.some(x => x.zamceno);
      for (const p of pole) {
        if (!p.input) continue;                         // pole se právě staví
        if (!i_aktivni && document.activeElement === p.input) continue;
        p.input.value = M.mm(p.cti(u), p.des);
        p.input.disabled = zamceno;
      }
      const nazev = karta.querySelector('#inspNazev');
      if (nazev && (i_aktivni || document.activeElement !== nazev)) { nazev.value = u.nazev; nazev.disabled = zamceno; }
      const stejnaBarva = uzly.every(x => x.barva === u.barva);
      const vsechnyDiry = uzly.every(x => x.role === 'dira');
      karta.querySelectorAll('.vzorek').forEach(b => {
        b.classList.toggle('aktivni', stejnaBarva && b.dataset.barva === u.barva && !(u.druh === 'skupina' && u.barevne));
        b.setAttribute('aria-pressed', String(b.classList.contains('aktivni')));
        b.disabled = zamceno || vsechnyDiry;
      });
      const vl = karta.querySelector('#inspBarva');
      vl.value = u.barva; vl.disabled = zamceno || vsechnyDiry;
      karta.querySelectorAll('[data-role]').forEach(b => {
        b.setAttribute('aria-pressed', uzly.every(x => x.role === b.dataset.role) ? 'true' : 'false');
        b.disabled = zamceno;
      });
      const zam = karta.querySelector('#inspZamek');
      zam.textContent = zamceno ? '🔒 Odemknout' : '🔓 Zamknout';
      zam.setAttribute('aria-pressed', zamceno ? 'true' : 'false');
      karta.querySelector('#inspSmazat').disabled = zamceno;
      karta.querySelector('#inspSmazat').title = nektereZamceno ? 'Zamčená tělesa se nesmažou' : '';
      karta.querySelectorAll('[data-operace]').forEach(b => {
        b.setAttribute('aria-pressed', u.operace === b.dataset.operace ? 'true' : 'false');
        b.disabled = zamceno;
      });
      const barvySouboru = karta.querySelector('#inspBarvySouboru');
      if (barvySouboru) { barvySouboru.checked = !u.jednobarevne; barvySouboru.disabled = zamceno; }
      const barevne = karta.querySelector('#inspBarevne');
      if (barevne) { barevne.checked = !!u.barevne; barevne.disabled = zamceno || u.role === 'dira'; }
      karta.querySelectorAll('[data-param]').forEach(el => {
        if (el.type === 'checkbox') el.checked = !!u.param[el.dataset.param];
        else if (document.activeElement !== el) el.value = u.param[el.dataset.param];
        el.disabled = zamceno;
      });
      const tlSkica = karta.querySelector('#inspSkica');
      if (tlSkica) tlSkica.disabled = zamceno;
      // kvalita: zvýrazněná, když ji mají všechna vybraná tělesa (s oblými plochami); popisek = počet segmentů
      const sKv = uzly.filter(x => M.kvalitaUzlu(x));
      const odhEl = karta.querySelector('#inspKvalitaOdhad');
      if (odhEl) {
        const ted = uzly.reduce((s, x) => s + trojUzlu(x), 0);
        odhEl.textContent = sKv.length && uzly.length <= 30 ? `Teď ≈ ${tisice(ted)} trojúhelníků` : '';
      }
      karta.querySelectorAll('[data-kvalita]').forEach(b => {
        b.setAttribute('aria-pressed', String(!!sKv.length && sKv.every(x => M.kvalitaUzlu(x) === b.dataset.kvalita)));
        b.disabled = zamceno || !sKv.length;
        const seg = sKv.length === 1 && sKv[0].druh !== 'skupina' ? M.segmentyKvality(sKv[0], b.dataset.kvalita) : null;
        b.title = !sKv.length ? 'Kvádr s ostrými hranami nemá oblé plochy (nastav zaoblení hran)'
          : `${M.KVALITY.find(k => k.id === b.dataset.kvalita).nazev}${seg ? ` – ${seg} segmentů` : ''}${uzly.length <= 30 ? `, ≈ ${tisice(odhadKvality(b.dataset.kvalita))} trojúhelníků` : ''} (jemnější = hladší, ale pomalejší výpočet)`;
      });
      karta.classList.toggle('zamceno', zamceno);
    }

    // --- zápisy (jen první vybraný uzel; inspektor polí se ukazuje u jednoho)
    function zmenRozmer(i, v) {
      // díl, jehož rozměr dávají parametry (krabička, víko): pole Rozměr mění parametr – stěny, sloupky
      // a díry se nedeformují a změna platí i pro propojený protikus
      const uz = M.vybraneUzly(), u0 = uz[0], d = uz.length === 1 && M.DILY && M.DILY[u0.druh];
      if (d && d.rozmerKlice && d.rozmerKlice[i] && Math.abs(u0.rozmer[i] - u0.zaklad[i]) < 1e-6 * u0.zaklad[i]) {
        const q = d.parametry.find(x => x.klic === d.rozmerKlice[i]);
        zmenParam(d.rozmerKlice[i], q ? M.omez(v, q.min, q.max) : v);
        return;
      }
      M.upravVybrane(u => {
        const rozmer = u.rozmer.slice(); rozmer[i] = v;
        // spodek zůstane na místě, X a Y kolem středu
        return { rozmer, poloha: M.polohaSeSpodkem(Object.assign({}, u, { rozmer }), M.spodekUzlu(u)) };
      }, 'Rozměr');
    }
    function zmenPolohu(i, v) {
      M.upravVybrane(u => {
        if (i === 2) return { poloha: M.polohaSeSpodkem(u, v) };
        const poloha = u.poloha.slice(); poloha[i] = v; return { poloha };
      }, 'Posun');
    }
    function zmenRotaci(i, v) {
      M.upravVybrane(u => { const rotace = u.rotace.slice(); rotace[i] = v; return { rotace }; }, 'Natočení');
    }
    function zmenParam(klic, v) {
      // skica: nová obálka a střed, počátek skici ve světě zůstane; propojené díly (šroub ↔ matice,
      // krabička ↔ víko, i uvnitř skupin) dostanou stejnou změnu sdíleného parametru v jednom kroku historie
      if (M.app.uprava && M.zrusNahledy) M.zrusNahledy();
      const r = M.dokSeZmenouParametru(M.app.dok, M.app.vyber, klic, v);
      if (r.dok !== M.app.dok) M.zmenDokument(r.dok, r.propojenych ? 'Tvar (i propojený díl)' : 'Tvar');
    }
    /** Odvozené pole tvaru (vnitřní průměr, průměr průřezu…): zapíše rozměr i parametry, spodek stojí. */
    function zmenOdvozeny(d, v) {
      M.upravVybrane(u => {
        const z = d.zapis(u.rozmer, Object.assign({}, (M.TVARY[u.druh] || M.DILY[u.druh]).param, u.param), v) || {};
        // díl: nové parametry přes upravPrirozeny (nový základ a střed, počátek dílu zůstane)
        if (M.maPrirozene(u)) return z.param ? M.upravPrirozeny(u, z.param) : {};
        const zmena = {};
        if (z.param) zmena.param = M.normalizujParam(u.druh, Object.assign({}, u.param, z.param));
        if (z.rozmer) {
          zmena.rozmer = z.rozmer.map(x => M.omez(x, 0.01, 10000));
          zmena.poloha = M.polohaSeSpodkem(Object.assign({}, u, zmena), M.spodekUzlu(u));
        }
        return zmena;
      }, d.popis);
    }
    /** Inspektor se staví znovu, když se změní výběr, druh nebo režim skici. */
    function klicInspektoru() {
      const u = M.vybraneUzly()[0];
      return M.app.vyber.join(',') + '|' + (M.app.vyber.length > 1 ? M.vybraneUzly().map(x => x.druh + (x.param && x.param.velikost === 'vlastni' ? 'v' : '')).join(',') : '') + '|' + (M.app.vyber.length === 1 && u ? u.druh + (u.druh === 'skica' ? u.param.rezim : '')
        + (u.param && u.param.velikost === 'vlastni' ? '|vlastni' : '') + (u.param && u.param.vystupky === 'vlastni' ? '|vlastniOkraje' : '') + (u.druh === 'skupina' ? JSON.stringify(u.occt) : '')
        + (u.vazba ? '|' + u.vazba + M.protikusy(M.app.dok, u).map(x => x.nazev + (x.zamceno ? '🔒' : '')).join(',') : '') : '');
    }

    M.na('vyber', postav);
    // dopočítaná geometrie (díly, skupiny): obnovit odhad trojúhelníků (dřív by zůstalo „Teď ≈ 0“)
    let planObnovy = null;
    M.na('geometrie', () => { if (karta.hidden || planObnovy) return; planObnovy = setTimeout(() => { planObnovy = null; if (!karta.hidden) obnov(false); }, 100); });
    M.na('dokument', () => {
      if (klicInspektoru() !== klicStavby) postav(); else obnov(false);
    });
    postav();
    return { postav, obnov };
  };
})(MDL);
