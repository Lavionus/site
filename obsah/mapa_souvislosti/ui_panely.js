/* ============================================================
   mapa_souvislosti/ui_panely.js – boční panely editoru:
   Detail (mapa / uzel / vztah / skupina / výběr), Přehled, Analýza, Filtry, Příběh, Typy, Text.
   Sdílený stav a akce jsou v objektu window.MapaApp (ui.js).
   ============================================================ */
(function () {
  'use strict';
  const A = window.MapaApp, J = A.J, $ = A.$, esc = A.esc;
  const ZALOZKY = ['detail', 'prehled', 'analyza', 'filtry', 'pribeh', 'typy', 'text'];
  const panel = z => $('panel' + z[0].toUpperCase() + z.slice(1));

  function prepni(z) {
    if (ZALOZKY.indexOf(z) < 0) z = 'detail';
    for (const b of document.querySelectorAll('.zalozky button')) b.setAttribute('aria-selected', String(b.dataset.zal === z));
    for (const p of ZALOZKY) panel(p).hidden = p !== z;
    vykresliZalozku(z);
  }
  const aktivni = () => { const b = document.querySelector('.zalozky button[aria-selected="true"]'); return b ? b.dataset.zal : 'detail'; };
  function vykresliZalozku(z) {
    ({ detail: vykresliDetail, prehled: vykresliPrehled, analyza: vykresliAnalyzu, filtry: vykresliFiltry, pribeh: vykresliPribeh, typy: vykresliTypy, text: vykresliText })[z]();
  }
  function vykresli() {
    const z = aktivni();
    if (z !== 'detail') vykresliDetail();
    vykresliZalozku(z);
  }
  for (const b of document.querySelectorAll('.zalozky button')) b.onclick = () => prepni(b.dataset.zal);

  /* ---------- pomocné ---------- */
  const mapa = () => A.mapa;
  const volbyTypu = sel => mapa().typy.map(t => '<option value="' + esc(t.id) + '"' + (t.id === sel ? ' selected' : '') + '>' + esc((t.ikona ? t.ikona + ' ' : '') + t.nazev) + '</option>').join('');
  const volbyTypuVztahu = sel => '<option value="">— bez typu —</option>' + (mapa().typyVztahu || []).map(t => '<option value="' + esc(t.id) + '"' + (t.id === sel ? ' selected' : '') + '>' + esc(t.nazev) + '</option>').join('');
  const nazevUzlu = id => { const u = J.najdiUzel(mapa(), id); return u ? u.nazev : '?'; };
  const sklon = (n, a, b, c) => n === 1 ? a : (n >= 2 && n <= 4 ? b : c);
  const cislo = (v, d) => (+v).toLocaleString('cs-CZ', { maximumFractionDigits: d == null ? 3 : d });

  /* propojení vstupu s modelem: záloha jen jednou za úpravu pole, kreslení po snímku */
  function vazPole(id, nastav, typUdalosti) {
    const el = $(id);
    if (!el) return;
    let zalohovano = false;
    el.addEventListener('focus', () => { zalohovano = false; });
    el.addEventListener(typUdalosti || 'input', () => {
      if (!zalohovano) { A.zaloha(); zalohovano = true; }
      nastav(el.type === 'checkbox' ? el.checked : el.value);
      A.prekresliPozdeji();
      A.ulozPozdeji();
    });
    /* po opuštění pole: nová revize (analýza, statistiky) */
    el.addEventListener('change', () => { if (zalohovano) A.zmena(false); });
  }
  function vazSkoky(P) {
    for (const b of P.querySelectorAll('[data-skok]')) b.onclick = () => {
      const u = J.najdiUzel(mapa(), b.dataset.skok);
      if (u && !A.viditelny(u)) A.filtr.typy.delete(u.typ);
      A.vyber([b.dataset.skok], []); A.vycentruj(b.dataset.skok, true);
    };
  }
  const zamer = id => setTimeout(() => { const i = $(id); if (i) { i.focus(); if (i.select) i.select(); } }, 30);

  /* ================= DETAIL ================= */
  function vykresliDetail() {
    const P = $('panelDetail');
    const m = mapa();
    if (A.vybSkupina && !A.vybUzly.size && !A.vybHrany.size) {
      const s = (m.skupiny || []).find(x => x.id === A.vybSkupina);
      if (s) return detailSkupiny(P, s);
    }
    if (A.vybHrany.size === 1 && !A.vybUzly.size) return detailHrany(P, J.najdiHranu(m, [...A.vybHrany][0]));
    if (A.vybUzly.size === 1 && !A.vybHrany.size) return detailUzlu(P, J.najdiUzel(m, [...A.vybUzly][0]));
    if (A.vybUzly.size + A.vybHrany.size > 1) return detailVyberu(P);
    /* nic nevybráno – vlastnosti mapy */
    P.innerHTML =
      '<h2>🗺️ Mapa</h2>' +
      '<div class="pole"><label for="mNazev">Název mapy</label><input type="text" id="mNazev" value="' + esc(m.nazev) + '"></div>' +
      '<div class="pole"><label for="mPopis">Popis</label><textarea id="mPopis" rows="3">' + esc(m.popis || '') + '</textarea></div>' +
      '<div class="radek"><button id="mPaleta" title="Všechny příkazy a hledání (Ctrl+K)">⌘ Paleta příkazů <kbd>Ctrl+K</kbd></button></div>' +
      '<h3>Ovládání</h3><div class="napoveda"><ul>' +
      '<li><b>Klik</b> na uzel – vybrat a rozbalit / sbalit podrobnosti</li>' +
      '<li><b>Dvojklik</b> do plochy – nový uzel (v rámečku skupiny rovnou do ní), na uzel – upravit název</li>' +
      '<li><b>Tažení z modrého bodu</b> na jiný uzel – vztah; do prázdna – nový propojený uzel</li>' +
      '<li><b>Tažení uzlů do rámečku</b> skupiny je do ní přidá; tažením za hlavičku přesunete celou skupinu</li>' +
      '<li><kbd>Shift</kbd>+tažení plochy – výběr rámečkem, <kbd>Shift</kbd>+klik – přidat do výběru</li>' +
      '<li><kbd>N</kbd> nový uzel · <kbd>Tab</kbd> nová souvislost · <kbd>L</kbd> spojování · <kbd>E</kbd> rozbalit · <kbd>F</kbd> celá mapa · <kbd>M</kbd> minimapa · <kbd>G</kbd> mřížka</li>' +
      '<li><kbd>Alt</kbd>+šipky – přejít na souseda · šipky – posun · <kbd>Ctrl+G</kbd> seskupit</li>' +
      '<li><kbd>Del</kbd> smazat · <kbd>Ctrl+Z</kbd>/<kbd>Ctrl+Y</kbd> zpět/znovu · <kbd>Ctrl+C</kbd>/<kbd>V</kbd>/<kbd>D</kbd> kopírovat/vložit/duplikovat</li>' +
      '</ul>Mapy se ukládají jen v tomto prohlížeči – pro zálohu nebo sdílení použijte Export (JSON nebo odkaz).</div>';
    vazPole('mNazev', v => { m.nazev = v.trim() || 'Bez názvu'; const o = $('vyberMapy').querySelector('option[value="' + CSS.escape(A.idMapy) + '"]'); if (o) o.textContent = m.nazev; });
    vazPole('mPopis', v => { m.popis = v; });
    $('mPaleta').onclick = () => A.paleta && A.paleta.otevri();
  }

  function detailUzlu(P, u) {
    const m = mapa();
    const typ = J.typUzlu(m, u);
    const vztahy = m.hrany.filter(h => h.od === u.id || h.do === u.id);
    const sk = J.skupinaUzlu(m, u.id);
    const an = A.analyza();
    const r = an && an.podleId.get(u.id);
    let s = '<h2><span class="tecka" style="--c:' + (u.barva || typ.barva) + '"></span>Uzel</h2>' +
      '<div class="pole"><label for="dNazev">Název</label><input type="text" id="dNazev" value="' + esc(u.nazev) + '"></div>' +
      '<div class="radek"><div class="pole"><label for="dTyp">Typ</label><select id="dTyp">' + volbyTypu(u.typ) + '</select></div>' +
      '<div class="pole" style="flex:0 0 auto"><label for="dBarva">Barva</label><div class="radek"><input type="color" id="dBarva" value="' + (u.barva || typ.barva) + '" title="Vlastní barva uzlu">' +
      (u.barva ? '<button class="ikona" id="dBarvaZrus" title="Barva podle typu">↺</button>' : '') + '</div></div></div>' +
      '<div class="radek"><div class="pole"><label for="dDatum">Datum / rok</label><input type="text" id="dDatum" value="' + esc(u.datum) + '" placeholder="1969, 1969-07-20, 20. 7. 1969"></div>' +
      '<div class="pole"><label for="dDatumDo">do (nepovinné)</label><input type="text" id="dDatumDo" value="' + esc(u.datumDo) + '"></div></div>' +
      '<div class="pole"><label for="dPopis">Popis – zobrazí se po rozbalení uzlu</label><textarea id="dPopis" rows="5">' + esc(u.popis) + '</textarea></div>' +
      '<div class="pole"><label for="dTagy">Štítky (oddělené čárkou)</label><input type="text" id="dTagy" value="' + esc(u.tagy.join(', ')) + '" list="dTagyNavrhy">' +
      '<datalist id="dTagyNavrhy">' + [...new Set(m.uzly.flatMap(x => x.tagy))].slice(0, 80).map(t => '<option value="' + esc(u.tagy.concat(t).join(', ')) + '">').join('') + '</datalist></div>' +
      '<div class="pole"><label for="dOdkaz">Odkaz</label><div class="radek"><input type="url" id="dOdkaz" style="flex:1" value="' + esc(u.odkaz) + '" placeholder="https://…">' +
      (/^https?:\/\//i.test(u.odkaz) ? '<a class="tl" href="' + esc(u.odkaz) + '" target="_blank" rel="noopener noreferrer" title="Otevřít odkaz">↗</a>' : '') + '</div></div>' +
      '<h3>Vlastnosti</h3><div id="dAtributy" class="atributy"></div>' +
      '<div class="radek"><button id="dAtrPridat">+ Vlastnost</button><span class="popisek">např. narozen: 1912, cena: 2 400 Kč</span></div>' +
      '<h3>Obrázek</h3>' +
      (u.obrazek ? '<div class="nahled-obr"><img src="' + esc(u.obrazek) + '" alt=""></div>' : '') +
      '<div class="radek"><input type="url" id="dObrazek" style="flex:1" value="' + esc(/^data:/.test(u.obrazek) ? '' : u.obrazek) + '" placeholder="' + (/^data:/.test(u.obrazek) ? 'vložený soubor' : 'https://… adresa obrázku') + '">' +
      '<button id="dObrNahrat" title="Nahrát obrázek ze souboru (zmenší se)">📁</button>' + (u.obrazek ? '<button id="dObrZrus" class="ikona" title="Odebrat obrázek">✕</button>' : '') + '</div>' +
      '<div class="radek"><button id="dWiki" title="Doplnit popis, obrázek a odkaz z Wikipedie">📖 Doplnit z Wikipedie</button></div>' +
      '<div class="radek"><div class="pole"><label for="dSkupina">Skupina</label><select id="dSkupina"><option value="">— žádná —</option>' +
      (m.skupiny || []).map(x => '<option value="' + esc(x.id) + '"' + (sk && sk.id === x.id ? ' selected' : '') + '>' + esc(x.nazev) + '</option>').join('') + '<option value="*">+ nová skupina…</option></select></div></div>' +
      '<div class="radek"><label class="zaskrt"><input type="checkbox" id="dRozbaleny"' + (u.rozbaleny ? ' checked' : '') + '> rozbalený</label>' +
      '<label class="zaskrt"><input type="checkbox" id="dZamceny"' + (u.zamceny ? ' checked' : '') + '> zamknout pozici</label></div>' +
      '<div class="radek"><button id="dSouvislost" class="hlavni" title="Nový uzel propojený s tímto (Tab)">+ Souvislost</button>' +
      '<button id="dSpojit" title="Spojit s jiným uzlem kliknutím">🔗 Spojit s…</button>' +
      '<button id="dKolem" title="Rozmístit mapu kruhově kolem tohoto uzlu">◎</button>' +
      '<button id="dStred" title="Vycentrovat">⌖</button>' +
      '<button id="dSmazat" class="nebezpeci">🗑 Smazat</button></div>';
    if (r) {
      const poradi = klic => 1 + an.radky.filter(x => x[klic] > r[klic]).length;
      s += '<h3>V síti</h3><div class="cisla mala">' +
        '<div><b>' + r.stupen + '</b><span>' + sklon(r.stupen, 'vztah', 'vztahy', 'vztahů') + '</span></div>' +
        '<div><b>' + poradi('betweenness') + '.</b><span>mezilehlost</span></div>' +
        '<div><b>' + poradi('pagerank') + '.</b><span>PageRank</span></div>' +
        '<div><b><span class="tecka" style="--c:' + A.PALETA_KOMUNIT[r.komunita % A.PALETA_KOMUNIT.length] + '"></span> ' + (r.komunita + 1) + '</b><span>komunita</span></div>' +
        (r.kloubovy ? '<div><b>⚠</b><span>kloubový bod</span></div>' : '') + '</div>';
    }
    s += '<h3>Vztahy (' + vztahy.length + ')</h3>';
    if (!vztahy.length) s += '<div class="napoveda">Zatím žádné. Táhněte z modrého bodu na okraji uzlu na jiný uzel.</div>';
    else {
      s += '<div class="seznam">' + vztahy.map(h => {
        const ven = h.od === u.id;
        const druhy = ven ? h.do : h.od;
        const sipka = h.smer === '--' ? '—' : h.smer === '<->' ? '↔' : (ven ? '→' : '←');
        const t2 = J.typUzlu(m, J.najdiUzel(m, druhy));
        const st = J.stitekHrany(m, h);
        return '<button data-skok="' + esc(druhy) + '" data-h="' + esc(h.id) + '"><span>' + sipka + '</span><span class="tecka" style="--c:' + t2.barva + '"></span><span>' + esc(nazevUzlu(druhy)) +
          (st ? ' <span class="vztah">(' + esc(st) + ')</span>' : '') + '</span></button>';
      }).join('') + '</div>';
    }
    P.innerHTML = s;
    vazPole('dNazev', v => { u.nazev = v.trim() || 'Bez názvu'; });
    vazPole('dTyp', v => { u.typ = v; }, 'change');
    vazPole('dBarva', v => { u.barva = v; });
    vazPole('dDatum', v => { u.datum = v.trim(); });
    vazPole('dDatumDo', v => { u.datumDo = v.trim(); });
    vazPole('dPopis', v => { u.popis = v; });
    vazPole('dTagy', v => { u.tagy = [...new Set(v.split(',').map(t => t.trim()).filter(Boolean))]; });
    vazPole('dOdkaz', v => { u.odkaz = v.trim(); });
    vazPole('dRozbaleny', v => { u.rozbaleny = v; }, 'change');
    vazPole('dZamceny', v => { u.zamceny = v; }, 'change');
    $('dRozbaleny').addEventListener('change', () => { if (u.rozbaleny) A.uvolniMisto([u.id]); });
    $('dTyp').addEventListener('change', () => vykresliDetail());
    $('dOdkaz').addEventListener('change', () => vykresliDetail());
    if ($('dBarvaZrus')) $('dBarvaZrus').onclick = () => { A.zaloha(); u.barva = null; A.zmena(); };
    /* vlastnosti (atributy) */
    const kresliAtr = () => {
      $('dAtributy').innerHTML = u.atributy.map((a, i) => '<div class="atr-radek" data-i="' + i + '">' +
        '<input type="text" data-k value="' + esc(a[0]) + '" aria-label="Vlastnost" placeholder="vlastnost">' +
        '<input type="text" data-v value="' + esc(a[1]) + '" aria-label="Hodnota" placeholder="hodnota">' +
        '<button class="ikona" data-smaz title="Odebrat">✕</button></div>').join('') || '<div class="popisek">Žádné vlastnosti.</div>';
      for (const r of $('dAtributy').querySelectorAll('.atr-radek')) {
        const i = +r.dataset.i;
        let zal = false;
        for (const el of r.querySelectorAll('input')) {
          el.addEventListener('focus', () => { zal = false; });
          el.addEventListener('input', () => {
            if (!zal) { A.zaloha(); zal = true; }
            if (el.hasAttribute('data-k')) u.atributy[i][0] = el.value; else u.atributy[i][1] = el.value;
            A.prekresliPozdeji(); A.ulozPozdeji();
          });
          el.addEventListener('change', () => { u.atributy = J.normalizujAtributy(u.atributy.filter(a => a[0].trim() || a[1].trim()).map(a => [a[0].trim() || 'vlastnost', a[1]])); A.zmena(false); });
        }
        r.querySelector('[data-smaz]').onclick = () => { A.zaloha(); u.atributy.splice(i, 1); A.zmena(false); kresliAtr(); };
      }
    };
    kresliAtr();
    $('dAtrPridat').onclick = () => {
      A.zaloha();
      let n = 1; while (u.atributy.some(a => a[0] === 'vlastnost ' + n)) n++;
      u.atributy.push(['vlastnost ' + n, '']);
      A.zmena(false); kresliAtr();
      const i = $('dAtributy').querySelector('.atr-radek:last-child [data-k]'); if (i) { i.focus(); i.select(); }
    };
    /* obrázek */
    $('dObrazek').addEventListener('change', e => {
      const v = e.target.value.trim();
      if (v && !J.jeObrazek(v)) { Dialog.chyba('Zadejte adresu obrázku začínající https://'); return; }
      A.zaloha(); u.obrazek = v; if (v) u.rozbaleny = true; A.zmena();
    });
    $('dObrNahrat').onclick = () => A.nastroje && A.nastroje.nahrajObrazek(u);
    if ($('dObrZrus')) $('dObrZrus').onclick = () => { A.zaloha(); u.obrazek = ''; A.zmena(); };
    $('dWiki').onclick = () => A.nastroje && A.nastroje.wikipedie(u);
    $('dSkupina').onchange = async e => {
      const v = e.target.value;
      if (v === '*') {
        const n = await Dialog.zeptej('Název nové skupiny', 'Skupina ' + ((m.skupiny || []).length + 1));
        if (n == null) { vykresliDetail(); return; }
        A.zaloha(); const ns = J.pridejSkupinu(m, n, [u.id]); A.uvolniMistoSkupinam(); A.zmena(); return ns;
      }
      A.zaloha();
      if (v) J.vlozDoSkupiny(m, v, u.id); else J.odeberZeSkupin(m, [u.id]);
      A.uvolniMistoSkupinam();
      A.zmena();
    };
    $('dSouvislost').onclick = () => A.pridejSouvislost(u.id);
    $('dSpojit').onclick = () => A.nastavRezimSpojit(true);
    $('dKolem').onclick = () => A.rozmisti('kruhove');
    $('dStred').onclick = () => A.vycentruj(u.id, true);
    $('dSmazat').onclick = A.smazVybrane;
    vazSkoky(P);
    for (const b of P.querySelectorAll('[data-h]')) {
      b.onmouseenter = () => { const el = $('vrstvaHran').querySelector('[data-hrana="' + CSS.escape(b.dataset.h) + '"]'); if (el) el.classList.add('vybrana'); };
      b.onmouseleave = () => { const el = $('vrstvaHran').querySelector('[data-hrana="' + CSS.escape(b.dataset.h) + '"]'); if (el) el.classList.remove('vybrana'); };
    }
  }

  function detailHrany(P, h) {
    const m = mapa();
    const Z = J.najdiUzel(m, h.od), K = J.najdiUzel(m, h.do);
    P.innerHTML = '<h2>↗ Vztah</h2>' +
      '<div class="seznam"><button data-skok="' + esc(Z.id) + '"><span class="popisek">od</span> ' + esc(Z.nazev) + '</button>' +
      '<button data-skok="' + esc(K.id) + '"><span class="popisek">do</span> ' + esc(K.nazev) + '</button></div>' +
      '<div class="pole"><label for="hTyp">Typ vztahu</label><select id="hTyp">' + volbyTypuVztahu(h.typ) + '</select></div>' +
      '<div class="pole"><label for="hPopis">Popis vztahu</label><input type="text" id="hPopis" value="' + esc(h.popis) + '" placeholder="' + esc(J.stitekHrany(m, Object.assign({}, h, { popis: '' })) || 'např. vynalezl, ovlivnil, je součástí') + '" list="hNavrhy">' +
      '<datalist id="hNavrhy">' + [...new Set(m.hrany.map(x => x.popis).filter(Boolean))].slice(0, 60).map(p => '<option value="' + esc(p) + '">').join('') + '</datalist></div>' +
      '<div class="radek"><div class="pole"><label for="hSmer">Směr</label><select id="hSmer">' +
      [['->', '→ jedním směrem'], ['<->', '↔ oboustranný'], ['--', '— bez směru']].map(([v, t]) => '<option value="' + v + '"' + (h.smer === v ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></div>' +
      '<div class="pole"><label for="hStyl">Čára</label><select id="hStyl">' +
      [['plna', 'plná'], ['carkovana', 'čárkovaná'], ['teckovana', 'tečkovaná']].map(([v, t]) => '<option value="' + v + '"' + (h.styl === v ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></div></div>' +
      '<div class="radek"><div class="pole"><label for="hSila">Síla vazby: <b id="hSilaH">' + h.sila + '</b></label><input type="range" id="hSila" min="1" max="3" step="1" value="' + h.sila + '"></div>' +
      '<div class="pole" style="flex:0 0 auto"><label for="hBarva">Barva</label><div class="radek"><input type="color" id="hBarva" value="' + (J.barvaHrany(m, h) || '#888888') + '">' +
      (h.barva ? '<button class="ikona" id="hBarvaZrus" title="Barva podle typu / výchozí">↺</button>' : '') + '</div></div></div>' +
      '<div class="radek"><button id="hOtocit">⇄ Otočit směr</button><button id="hSmazat" class="nebezpeci">🗑 Smazat vztah</button></div>';
    $('hTyp').onchange = e => {
      A.zaloha();
      h.typ = e.target.value || null;
      const t = J.typVztahu(m, h);
      if (t) { h.styl = t.styl; h.smer = t.smer; h.barva = null; }
      A.zmena();
    };
    vazPole('hPopis', v => { h.popis = v.trim(); });
    vazPole('hSmer', v => { h.smer = v; }, 'change');
    vazPole('hStyl', v => { h.styl = v; }, 'change');
    vazPole('hSila', v => { h.sila = +v; $('hSilaH').textContent = v; });
    vazPole('hBarva', v => { h.barva = v; });
    if ($('hBarvaZrus')) $('hBarvaZrus').onclick = () => { A.zaloha(); h.barva = null; A.zmena(); };
    $('hOtocit').onclick = () => { A.zaloha(); const t = h.od; h.od = h.do; h.do = t; A.zmena(); };
    $('hSmazat').onclick = A.smazVybrane;
    vazSkoky(P);
  }

  function detailSkupiny(P, s) {
    const m = mapa();
    P.innerHTML = '<h2><span class="tecka" style="--c:' + s.barva + '"></span>Skupina</h2>' +
      '<div class="radek"><div class="pole"><label for="sNazev">Název</label><input type="text" id="sNazev" value="' + esc(s.nazev) + '"></div>' +
      '<div class="pole" style="flex:0 0 auto"><label for="sBarva">Barva</label><input type="color" id="sBarva" value="' + s.barva + '"></div></div>' +
      '<div class="radek"><button id="sVybrat" class="hlavni">Vybrat členy</button><button id="sUkazat">⤢ Ukázat</button>' +
      '<button id="sRozbalit">▾ Rozbalit členy</button></div>' +
      '<div class="radek"><button id="sRozpustit" title="Zrušit rámeček, uzly zůstanou">Zrušit skupinu</button><button id="sSmazat" class="nebezpeci">🗑 Smazat i s uzly</button></div>' +
      '<h3>Členové (' + s.uzly.length + ')</h3><div class="seznam">' +
      s.uzly.map(id => '<button data-skok="' + esc(id) + '">' + esc(nazevUzlu(id)) + '</button>').join('') + '</div>' +
      '<div class="napoveda">Uzly přidáte přetažením do rámečku, výběrem a <kbd>Ctrl+G</kbd>, nebo v detailu uzlu.</div>';
    vazPole('sNazev', v => { s.nazev = v.trim() || 'Skupina'; });
    vazPole('sBarva', v => { s.barva = v; });
    $('sVybrat').onclick = () => A.vyber(s.uzly, []);
    $('sUkazat').onclick = () => A.preletNa(A.cilPohledu(s.uzly));
    $('sRozbalit').onclick = () => { A.zaloha(); for (const id of s.uzly) J.najdiUzel(m, id).rozbaleny = true; A.uvolniMisto(s.uzly); };
    $('sRozpustit').onclick = () => { A.zaloha(); m.skupiny = m.skupiny.filter(x => x !== s); A.vyber([], []); A.zmena(); };
    $('sSmazat').onclick = async () => {
      if (!await Dialog.potvrd('Smazat skupinu „' + s.nazev + '“ i s jejími ' + s.uzly.length + ' uzly?')) return;
      A.zaloha(); const ids = s.uzly.slice(); m.skupiny = m.skupiny.filter(x => x !== s); J.odeberUzly(m, ids); A.vyber([], []); A.zmena();
    };
    vazSkoky(P);
  }

  function detailVyberu(P) {
    const m = mapa();
    const ids = [...A.vybUzly];
    const dva = ids.length === 2;
    const vice = ids.length > 1;
    P.innerHTML = '<h2>Výběr</h2><div class="napoveda">' + ids.length + ' uzlů, ' + A.vybHrany.size + ' vztahů.</div>' +
      (ids.length ? '<div class="pole"><label for="vTyp">Změnit typ všech</label><select id="vTyp"><option value="">—</option>' + volbyTypu('') + '</select></div>' : '') +
      (A.vybHrany.size ? '<div class="pole"><label for="vTypH">Typ všech vybraných vztahů</label><select id="vTypH"><option value="-">—</option>' + volbyTypuVztahu('-') + '</select></div>' : '') +
      '<div class="radek">' +
      (dva ? '<button id="vCesta" class="hlavni" title="Nejkratší řetěz vztahů mezi dvěma uzly">🧭 Nejkratší cesta</button><button id="vSpojit">🔗 Propojit</button>' : '') +
      (ids.length > 2 ? '<button id="vSpojitHvezda" title="Propojit první vybraný se všemi ostatními">✳ Propojit s prvním</button><button id="vRetez" title="Propojit za sebou v pořadí výběru">⛓ Řetěz</button>' : '') +
      (ids.length ? '<button id="vSeskupit" title="Vytvořit skupinu (Ctrl+G)">▣ Seskupit</button>' : '') +
      (vice ? '<button id="vSloucit" title="Sloučit do prvního vybraného (vztahy se přepojí)">⧉ Sloučit</button>' : '') +
      (ids.length ? '<button id="vRozbalit">▾ Rozbalit</button><button id="vSbalit">▸ Sbalit</button><button id="vZamknout">🔒 Zamknout</button><button id="vPriblizit">⤢ Ukázat</button>' : '') +
      '<button id="vSmazat" class="nebezpeci">🗑 Smazat</button></div>' +
      (vice && window.MapaRozlozeni ? '<h3>Zarovnat</h3><div class="radek zarovnani">' +
        [['vlevo', '⇤', 'vlevo'], ['stredH', '↔', 'na střed svisle'], ['vpravo', '⇥', 'vpravo'], ['nahoru', '⤒', 'nahoru'], ['stredV', '↕', 'na střed vodorovně'], ['dolu', '⤓', 'dolů'],
          ['x', '⋯', 'rozprostřít vodorovně'], ['y', '⋮', 'rozprostřít svisle'], ['mrizka', '▦', 'přichytit k mřížce']]
          .map(([j, i, t]) => '<button class="ikona" data-zarovnej="' + j + '" title="' + t + '">' + i + '</button>').join('') + '</div>' : '') +
      '<div id="vVysledek" class="napoveda"></div>' +
      (ids.length ? '<h3>Vybrané uzly</h3><div class="seznam">' + ids.slice(0, 80).map(i => '<button data-skok="' + esc(i) + '">' + esc(nazevUzlu(i)) + '</button>').join('') + '</div>' : '');
    if ($('vTyp')) $('vTyp').onchange = e => { if (!e.target.value) return; A.zaloha(); for (const i of ids) J.najdiUzel(m, i).typ = e.target.value; A.zmena(); };
    if ($('vTypH')) $('vTypH').onchange = e => {
      if (e.target.value === '-') return;
      A.zaloha();
      for (const i of A.vybHrany) {
        const h = J.najdiHranu(m, i); h.typ = e.target.value || null;
        const t = J.typVztahu(m, h); if (t) { h.styl = t.styl; h.smer = t.smer; h.barva = null; }
      }
      A.zmena();
    };
    if ($('vCesta')) $('vCesta').onclick = () => {
      const c = J.nejkratsiCesta(m, ids[0], ids[1], false);
      if (!c) { $('vVysledek').textContent = 'Uzly nejsou propojené žádným řetězem vztahů.'; A.cesta = null; A.prekresli(); return; }
      A.cesta = { uzly: c.uzly, hrany: c.hrany };
      A.prekresli();
      $('vVysledek').innerHTML = '<b>' + c.hrany.length + ' ' + sklon(c.hrany.length, 'krok', 'kroky', 'kroků') + ':</b> ' +
        c.uzly.map((id, i) => {
          if (i >= c.hrany.length) return esc(nazevUzlu(id));
          const h = J.najdiHranu(m, c.hrany[i]);
          const sip = h.smer === '--' ? '—' : h.smer === '<->' ? '↔' : (h.od === id ? '→' : '←');
          const st = J.stitekHrany(m, h);
          return esc(nazevUzlu(id)) + ' <span class="vztah">' + sip + (st ? ' ' + esc(st) + ' ' + sip : '') + '</span> ';
        }).join('') +
        '<br><span class="popisek">Esc nebo klik do plochy zvýraznění zruší.</span> <button id="vCestaPribeh">🎬 Udělat z cesty prezentaci</button>';
      $('vCestaPribeh').onclick = () => A.nastroje && A.nastroje.pribehZCesty(c);
    };
    if ($('vSpojit')) $('vSpojit').onclick = () => A.spoj(ids[0], ids[1]);
    if ($('vSpojitHvezda')) $('vSpojitHvezda').onclick = () => { A.zaloha(); for (const i of ids.slice(1)) J.pridejHranu(m, ids[0], i, {}); A.zmena(); };
    if ($('vRetez')) $('vRetez').onclick = () => { A.zaloha(); for (let i = 1; i < ids.length; i++) J.pridejHranu(m, ids[i - 1], ids[i], {}); A.zmena(); };
    if ($('vSeskupit')) $('vSeskupit').onclick = async () => {
      const n = await Dialog.zeptej('Název skupiny', 'Skupina ' + ((m.skupiny || []).length + 1));
      if (n != null) A.seskupit(ids, n);
    };
    if ($('vSloucit')) $('vSloucit').onclick = async () => {
      if (!await Dialog.potvrd('Sloučit ' + ids.length + ' uzlů do „' + nazevUzlu(ids[0]) + '“? Popisy, štítky a vlastnosti se spojí, vztahy se přepojí.')) return;
      A.zaloha();
      const c = J.sloucUzly(m, ids);
      A.vyber([c.id], []);
      A.zmena();
    };
    const hromadne = f => () => { A.zaloha(); for (const i of ids) f(J.najdiUzel(m, i)); A.zmena(); };
    if ($('vRozbalit')) $('vRozbalit').onclick = () => { A.zaloha(); for (const i of ids) J.najdiUzel(m, i).rozbaleny = true; A.uvolniMisto(ids); };
    if ($('vSbalit')) $('vSbalit').onclick = hromadne(u => { u.rozbaleny = false; });
    if ($('vZamknout')) $('vZamknout').onclick = () => { const z = !ids.every(i => J.najdiUzel(m, i).zamceny); hromadne(u => { u.zamceny = z; })(); };
    if ($('vPriblizit')) $('vPriblizit').onclick = () => A.preletNa(A.cilPohledu(ids));
    $('vSmazat').onclick = A.smazVybrane;
    for (const b of P.querySelectorAll('[data-zarovnej]')) b.onclick = () => A.zarovnej(b.dataset.zarovnej);
    vazSkoky(P);
  }

  /* ================= PŘEHLED ================= */
  function vykresliPrehled() {
    const m = mapa();
    const st = J.statistika(m);
    const P = $('panelPrehled');
    const pct = v => (v * 100).toLocaleString('cs-CZ', { maximumFractionDigits: 1 }) + ' %';
    let s = '<h2>📊 Přehled mapy</h2><div class="cisla">' +
      '<div><b>' + st.uzlu + '</b><span>uzlů</span></div><div><b>' + st.hran + '</b><span>vztahů</span></div>' +
      '<div><b>' + st.komponent + '</b><span>' + (st.komponent === 1 ? 'souvislý celek' : 'oddělených celků') + '</span></div>' +
      '<div><b>' + cislo(st.prumernyStupen, 2) + '</b><span>vztahů na uzel</span></div>' +
      '<div><b>' + pct(Math.min(1, st.hustota)) + '</b><span>hustota</span></div><div><b>' + st.osamocene.length + '</b><span>bez vztahu</span></div></div>';
    s += kontrolaKvality(m, st);
    if (st.nejpropojenejsi.length) {
      s += '<h3>Nejpropojenější</h3><div class="seznam">' + st.nejpropojenejsi.map(n =>
        '<button data-skok="' + esc(n.id) + '">' + esc(n.nazev) + '<span class="pocet">' + n.stupen + '</span></button>').join('') + '</div>';
    }
    s += '<h3>Všechny uzly</h3><input type="search" id="pFiltr" placeholder="Filtrovat…" aria-label="Filtrovat seznam uzlů"><div class="seznam" id="pSeznam"></div>';
    s += '<h3 id="pVerze">Verze mapy</h3><div id="pVerzeObsah"></div>';
    P.innerHTML = s;
    const seznam = () => {
      const q = J.bezDiakritiky($('pFiltr').value.trim().toLowerCase());
      const uz = m.uzly.filter(u => !q || J.bezDiakritiky(u.nazev.toLowerCase()).indexOf(q) >= 0)
        .sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'));
      $('pSeznam').innerHTML = uz.slice(0, 300).map(u => {
        const t = J.typUzlu(m, u);
        return '<button data-skok="' + esc(u.id) + '"><span class="tecka" style="--c:' + (u.barva || t.barva) + '"></span>' + esc(u.nazev) +
          (u.datum ? ' <span class="vztah">' + esc(u.datum) + '</span>' : '') + '<span class="pocet">' + (st.stupne.get(u.id) || 0) + '</span></button>';
      }).join('') + (uz.length > 300 ? '<div class="popisek">… a dalších ' + (uz.length - 300) + '</div>' : '');
      vazSkoky($('pSeznam'));
    };
    $('pFiltr').oninput = seznam;
    seznam();
    vazSkoky(P);
    for (const b of P.querySelectorAll('[data-vyberkontrola]')) b.onclick = () => {
      const ids = b.dataset.vyberkontrola.split(',').filter(Boolean);
      A.vyber(ids, []); A.preletNa(A.cilPohledu(ids));
    };
    if (A.nastroje) A.nastroje.kresliVerze($('pVerzeObsah'));
  }

  /* kontrola kvality: na co se vyplatí podívat */
  function kontrolaKvality(m, st) {
    const nalezy = [];
    const podleNazvu = new Map();
    for (const u of m.uzly) { const k = J.bezDiakritiky(u.nazev.trim().toLowerCase()); if (!podleNazvu.has(k)) podleNazvu.set(k, []); podleNazvu.get(k).push(u.id); }
    const dupl = [...podleNazvu.values()].filter(x => x.length > 1).flat();
    if (dupl.length) nalezy.push(['⚠', dupl.length + ' uzlů se stejným názvem (sloučit?)', dupl]);
    if (st.osamocene.length) nalezy.push(['○', st.osamocene.length + ' ' + sklon(st.osamocene.length, 'uzel', 'uzly', 'uzlů') + ' bez vztahu', st.osamocene]);
    const bezPopisu = m.uzly.filter(u => !u.popis.trim()).map(u => u.id);
    if (bezPopisu.length && m.uzly.length) nalezy.push(['✎', bezPopisu.length + ' bez popisu', bezPopisu]);
    const udalosti = m.uzly.filter(u => u.typ === 'udalost' && !isFinite(J.rokZData(u.datum))).map(u => u.id);
    if (udalosti.length) nalezy.push(['📅', udalosti.length + ' ' + sklon(udalosti.length, 'událost', 'události', 'událostí') + ' bez platného data', udalosti]);
    const spatneDatum = m.uzly.filter(u => u.datum && !isFinite(J.rokZData(u.datum))).map(u => u.id);
    if (spatneDatum.length) nalezy.push(['?', spatneDatum.length + ' s nečitelným datem (časová osa je vynechá)', spatneDatum]);
    const bezStitku = m.hrany.filter(h => !J.stitekHrany(m, h));
    if (bezStitku.length) nalezy.push(['↗', bezStitku.length + ' vztahů bez popisu i typu', [...new Set(bezStitku.flatMap(h => [h.od, h.do]))]]);
    if (st.komponent > 1) nalezy.push(['⧉', 'mapa má ' + st.komponent + ' oddělené části', []]);
    if (!nalezy.length) return '<h3>Kontrola mapy</h3><div class="napoveda">✓ Bez nálezů.</div>';
    return '<h3>Kontrola mapy</h3><div class="seznam kontrola">' + nalezy.map(([i, t, ids]) =>
      '<button data-vyberkontrola="' + esc(ids.slice(0, 400).join(',')) + '"' + (ids.length ? '' : ' disabled') + '><span>' + i + '</span><span>' + esc(t) + '</span></button>').join('') + '</div>';
  }

  /* ================= ANALÝZA ================= */
  let razeni = 'betweenness', dotazAnalyzy = '';
  function vykresliAnalyzu() {
    const P = $('panelAnalyza');
    const MA = window.MapaAnalyza;
    if (!MA) { P.innerHTML = '<h2>🧮 Analýza sítě</h2><div class="napoveda">Modul analýzy se nenačetl.</div>'; return; }
    const m = mapa();
    if (!m.uzly.length) { P.innerHTML = '<h2>🧮 Analýza sítě</h2><div class="napoveda">Mapa je prázdná.</div>'; return; }
    const an = A.analyza();
    if (!an) { P.innerHTML = '<h2>🧮 Analýza sítě</h2><div class="napoveda">Analýzu se nepodařilo spočítat.</div>'; return; }
    const g = an.globalni;
    const metriky = MA.METRIKY.filter(x => ['komunita', 'kloubovy', 'mosty'].indexOf(x.id) < 0);
    const volby = (sel, prazdna) => (prazdna ? '<option value="">' + prazdna + '</option>' : '') + metriky.map(x => '<option value="' + x.id + '"' + (x.id === sel ? ' selected' : '') + '>' + esc(x.nazev) + '</option>').join('');
    const nast = A.nastaveni;
    let s = '<h2>🧮 Analýza sítě</h2><div class="cisla">' +
      '<div><b>' + an.komunity.pocet + '</b><span>komunit</span></div>' +
      '<div><b>' + cislo(g.modularita, 2) + '</b><span>modularita</span></div>' +
      '<div><b>' + (g.prumer || 0) + '</b><span>průměr sítě</span></div>' +
      '<div><b>' + cislo(g.prumernaDelka || 0, 2) + '</b><span>prům. vzdálenost</span></div>' +
      '<div><b>' + cislo(g.prumerneShlukovani || 0, 2) + '</b><span>shlukování</span></div>' +
      '<div><b>' + (g.kloubovych != null ? g.kloubovych : an.radky.filter(r => r.kloubovy).length) + '</b><span>kloubových bodů</span></div></div>' +
      '<div class="napoveda">Modularita nad 0,3 znamená zřetelná témata; kloubový bod je uzel, bez kterého se mapa rozpadne.</div>' +
      '<h3>Zobrazení podle metrik</h3>' +
      '<div class="radek"><div class="pole"><label for="aVelikost">Velikost uzlů</label><select id="aVelikost">' + volby(nast.velikostPodle, 'stejná') + '</select></div>' +
      '<div class="pole"><label for="aBarva">Barvy uzlů</label><select id="aBarva"><option value="typ"' + (nast.barvaPodle === 'typ' ? ' selected' : '') + '>podle typu</option>' +
      '<option value="komunita"' + (nast.barvaPodle === 'komunita' ? ' selected' : '') + '>podle komunity</option>' + metriky.map(x => '<option value="' + x.id + '"' + (x.id === nast.barvaPodle ? ' selected' : '') + '>' + esc(x.nazev) + ' (škála)</option>').join('') + '</select></div></div>' +
      '<label class="zaskrt"><input type="checkbox" id="aMosty"' + (nast.mosty ? ' checked' : '') + '> zvýraznit mosty a kloubové body</label>';
    s += '<h3>Komunity (témata)</h3><div class="seznam">' + an.komunity.velikosti.slice(0, 12).map((n, i) => {
      const cl = an.radky.filter(r => r.komunita === i).sort((a, b) => b.stupen - a.stupen);
      return '<button data-komunita="' + i + '"><span class="tecka" style="--c:' + A.PALETA_KOMUNIT[i % A.PALETA_KOMUNIT.length] + '"></span><span>' +
        esc(cl.slice(0, 3).map(r => nazevUzlu(r.id)).join(', ')) + (cl.length > 3 ? '…' : '') + '</span><span class="pocet">' + n + '</span></button>';
    }).join('') + '</div>' +
      '<div class="radek"><button id="aSkupiny" title="Z každé komunity s víc než jedním uzlem udělat skupinu">▣ Vytvořit skupiny z komunit</button></div>';
    s += '<h3>Pořadí uzlů</h3><div class="radek"><div class="pole"><label for="aRazeni">Seřadit podle</label><select id="aRazeni">' + volby(razeni) + '</select></div>' +
      '<div class="pole"><label for="aDotaz">Hledat</label><input type="search" id="aDotaz" value="' + esc(dotazAnalyzy) + '"></div></div>' +
      '<div class="napoveda" id="aPopisMetriky"></div><div id="aTabulka"></div>' +
      '<div class="radek"><button id="aCSV">⬇ Metriky do CSV</button></div>';
    P.innerHTML = s;
    const tabulka = () => {
      const met = metriky.find(x => x.id === razeni) || metriky[0];
      $('aPopisMetriky').textContent = met.nazev + ': ' + met.popis;
      const q = J.bezDiakritiky(dotazAnalyzy.trim().toLowerCase());
      const radky = an.radky.filter(r => !q || J.bezDiakritiky(nazevUzlu(r.id).toLowerCase()).indexOf(q) >= 0).sort((a, b) => (b[met.id] || 0) - (a[met.id] || 0));
      const max = Math.max(1e-12, ...an.radky.map(r => +r[met.id] || 0));
      $('aTabulka').innerHTML = '<div class="seznam metriky">' + radky.slice(0, 40).map((r, i) => '<button data-skok="' + esc(r.id) + '"><span class="poradi">' + (i + 1) + '.</span><span class="jm">' + esc(nazevUzlu(r.id)) + '</span>' +
        '<span class="sloupec"><span style="width:' + ((+r[met.id] || 0) / max * 100).toFixed(1) + '%"></span></span><span class="pocet">' + cislo(r[met.id] || 0, 3) + '</span></button>').join('') + '</div>' +
        (radky.length > 40 ? '<div class="popisek">… a dalších ' + (radky.length - 40) + '</div>' : '');
      vazSkoky($('aTabulka'));
    };
    tabulka();
    $('aRazeni').onchange = e => { razeni = e.target.value; tabulka(); };
    $('aDotaz').oninput = e => { dotazAnalyzy = e.target.value; tabulka(); };
    $('aVelikost').onchange = e => { nast.velikostPodle = e.target.value; A.ulozNastaveni(); A.prekresli(); };
    $('aBarva').onchange = e => { nast.barvaPodle = e.target.value; A.ulozNastaveni(); A.prekresli(); };
    $('aMosty').onchange = e => { nast.mosty = e.target.checked; A.ulozNastaveni(); A.prekresli(); };
    for (const b of P.querySelectorAll('[data-komunita]')) b.onclick = () => {
      const i = +b.dataset.komunita;
      const ids = an.radky.filter(r => r.komunita === i).map(r => r.id);
      A.vyber(ids, []); A.preletNa(A.cilPohledu(ids));
    };
    $('aSkupiny').onclick = async () => {
      const kom = an.komunity.velikosti.map((n, i) => an.radky.filter(r => r.komunita === i).map(r => r.id)).filter(x => x.length > 1);
      if (!kom.length) { Dialog.info('Žádná komunita nemá víc než jeden uzel.'); return; }
      if ((m.skupiny || []).length && !await Dialog.potvrd('Stávající skupiny se nahradí ' + kom.length + ' skupinami podle komunit. Pokračovat?')) return;
      A.zaloha();
      m.skupiny = [];
      kom.forEach((ids, i) => {
        const nej = ids.slice().sort((a, b) => (A.stupne.get(b) || 0) - (A.stupne.get(a) || 0))[0];
        const sk = J.pridejSkupinu(m, 'Téma: ' + nazevUzlu(nej), ids);
        sk.barva = A.PALETA_KOMUNIT[i % A.PALETA_KOMUNIT.length];
      });
      A.uvolniMistoSkupinam();
      A.zmena();
      Dialog.info('Vytvořeno ' + kom.length + ' skupin. Rozmístit → Silově je od sebe oddělí.');
    };
    $('aCSV').onclick = () => {
      const hl = ['uzel', 'typ', 'komunita'].concat(metriky.map(x => x.nazev));
      const r = an.radky.map(x => {
        const u = J.najdiUzel(m, x.id);
        return [u.nazev, J.typUzlu(m, u).nazev, x.komunita + 1].concat(metriky.map(mt => x[mt.id]));
      });
      const bunka = v => { let t = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return /[",;\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
      const csv = '﻿' + [hl].concat(r).map(x => x.map(bunka).join(';')).join('\r\n');
      A.nastroje.stahni(csv, A.nastroje.jmenoSouboru('metriky.csv'), 'text/csv;charset=utf-8');
    };
  }

  /* ================= FILTRY ================= */
  function vykresliFiltry() {
    const P = $('panelFiltry');
    const m = mapa(), f = A.filtr;
    const pocty = {};
    for (const u of m.uzly) pocty[u.typ] = (pocty[u.typ] || 0) + 1;
    const tagy = new Map();
    for (const u of m.uzly) for (const t of u.tagy) tagy.set(t, (tagy.get(t) || 0) + 1);
    const pVztahu = { '': 0 };
    for (const h of m.hrany) pVztahu[h.typ || ''] = (pVztahu[h.typ || ''] || 0) + 1;
    const maxSt = Math.max(0, ...[...A.stupne.values()]);
    const roky = m.uzly.map(u => J.rokZData(u.datum)).filter(isFinite);
    const prosly = m.uzly.filter(A.prosel).length;
    const an = window.MapaAnalyza ? A.analyza() : null;
    let s = '<h2>🔎 Filtry</h2><div class="napoveda"><b>' + prosly + '</b> z ' + m.uzly.length + ' uzlů odpovídá filtru.</div>' +
      '<div class="radek"><label class="zaskrt"><input type="radio" name="fRezim" value="skryt"' + (f.rezim === 'skryt' ? ' checked' : '') + '> ostatní skrýt</label>' +
      '<label class="zaskrt"><input type="radio" name="fRezim" value="ztlumit"' + (f.rezim === 'ztlumit' ? ' checked' : '') + '> ostatní ztlumit</label>' +
      '<button id="fZrusit"' + (A.filtrAktivni() ? '' : ' disabled') + '>Zrušit filtry</button></div>' +
      '<h3>Typy uzlů</h3><div class="zaskrtavatka">' + m.typy.filter(t => pocty[t.id]).map(t =>
        '<label class="zaskrt"><input type="checkbox" data-ftyp="' + esc(t.id) + '"' + (f.typy.has(t.id) ? '' : ' checked') + '><span class="tecka" style="--c:' + t.barva + '"></span>' + esc(t.nazev) + ' <span class="popisek">' + pocty[t.id] + '</span></label>').join('') + '</div>' +
      '<h3>Typy vztahů</h3><div class="zaskrtavatka">' + [{ id: '', nazev: 'bez typu', barva: null }].concat(m.typyVztahu || []).filter(t => pVztahu[t.id]).map(t =>
        '<label class="zaskrt"><input type="checkbox" data-fvztah="' + esc(t.id) + '"' + (f.typyVztahu.has(t.id) ? '' : ' checked') + '><span class="carka" style="--hc:' + (t.barva || 'var(--text-faint)') + '"></span>' + esc(t.nazev) + ' <span class="popisek">' + pVztahu[t.id] + '</span></label>').join('') + '</div>';
    if (tagy.size) {
      s += '<h3>Štítky <span class="popisek">(zobrazit uzly s kterýmkoli z vybraných)</span></h3><div class="cipy">' + [...tagy].sort((a, b) => b[1] - a[1]).slice(0, 60).map(([t, n]) =>
        '<button data-ftag="' + esc(t) + '" class="' + (f.tagy.has(t) ? 'aktivni' : '') + '">#' + esc(t) + ' <span class="popisek">' + n + '</span></button>').join('') + '</div>';
    }
    s += '<h3>Období</h3>' + (roky.length ? '<div class="popisek">v mapě ' + Math.floor(Math.min(...roky)) + ' – ' + Math.floor(Math.max(...roky)) + '; uzly bez data se při filtru období skryjí</div>' : '<div class="popisek">žádný uzel nemá datum</div>') +
      '<div class="radek"><div class="pole"><label for="fOd">od</label><input type="text" id="fOd" value="' + esc(f.od) + '" placeholder="např. 1900"></div>' +
      '<div class="pole"><label for="fDo">do</label><input type="text" id="fDo" value="' + esc(f.do) + '" placeholder="např. 1960"></div></div>' +
      '<h3>Propojenost</h3><div class="pole"><label for="fStupen">alespoň <b id="fStupenH">' + f.minStupen + '</b> ' + sklon(f.minStupen, 'vztah', 'vztahy', 'vztahů') + '</label><input type="range" id="fStupen" min="0" max="' + Math.max(1, maxSt) + '" value="' + f.minStupen + '"></div>' +
      '<h3>Vlastnost obsahuje</h3><input type="search" id="fAtribut" value="' + esc(f.atribut) + '" placeholder="např. země: UK">';
    if (an) s += '<h3>Komunita</h3><select id="fKomunita"><option value="">— všechny —</option>' + an.komunity.velikosti.map((n, i) => '<option value="' + i + '"' + (f.komunita === i ? ' selected' : '') + '>Komunita ' + (i + 1) + ' (' + n + ')</option>').join('') + '</select>';
    P.innerHTML = s;
    const zmena = () => { A.prekresli(); vykresliFiltry(); };
    for (const r of P.querySelectorAll('[name=fRezim]')) r.onchange = e => { f.rezim = e.target.value; zmena(); };
    $('fZrusit').onclick = () => A.zrusFiltry();
    for (const c of P.querySelectorAll('[data-ftyp]')) c.onchange = e => { if (e.target.checked) f.typy.delete(c.dataset.ftyp); else f.typy.add(c.dataset.ftyp); zmena(); };
    for (const c of P.querySelectorAll('[data-fvztah]')) c.onchange = e => { if (e.target.checked) f.typyVztahu.delete(c.dataset.fvztah); else f.typyVztahu.add(c.dataset.fvztah); zmena(); };
    for (const b of P.querySelectorAll('[data-ftag]')) b.onclick = () => { const t = b.dataset.ftag; if (f.tagy.has(t)) f.tagy.delete(t); else f.tagy.add(t); zmena(); };
    $('fOd').onchange = e => { f.od = e.target.value.trim(); zmena(); };
    $('fDo').onchange = e => { f.do = e.target.value.trim(); zmena(); };
    $('fStupen').oninput = e => { f.minStupen = +e.target.value; $('fStupenH').textContent = e.target.value; A.prekresli(); };
    $('fStupen').onchange = () => vykresliFiltry();
    $('fAtribut').onchange = e => { f.atribut = e.target.value.trim(); zmena(); };
    if ($('fKomunita')) $('fKomunita').onchange = e => { f.komunita = e.target.value === '' ? null : +e.target.value; zmena(); };
  }

  /* ================= PŘÍBĚH (prezentace) ================= */
  let vybranyPribeh = null;
  function vykresliPribeh() {
    const P = $('panelPribeh');
    const m = mapa();
    m.pribehy = m.pribehy || [];
    if (!m.pribehy.some(p => p.id === vybranyPribeh)) vybranyPribeh = m.pribehy[0] ? m.pribehy[0].id : null;
    const p = m.pribehy.find(x => x.id === vybranyPribeh);
    let s = '<h2>🎬 Příběh – prezentace</h2>' +
      '<div class="napoveda">Krok = skupina uzlů, na kterou se kamera zaměří, s titulkem a poznámkou. Ostatní se ztlumí. Ovládání: <kbd>→</kbd>/<kbd>mezerník</kbd> dál, <kbd>←</kbd> zpět, <kbd>F</kbd> celá obrazovka, <kbd>Esc</kbd> konec.</div>' +
      '<div class="radek"><select id="prVyber" style="flex:1">' + (m.pribehy.length ? m.pribehy.map(x => '<option value="' + esc(x.id) + '"' + (x === p ? ' selected' : '') + '>' + esc(x.nazev) + ' (' + x.kroky.length + ')</option>').join('') : '<option>— žádná prezentace —</option>') + '</select>' +
      '<button id="prNova">+ Nová</button></div>' +
      '<div class="radek"><button id="prCas" title="Krok za krokem podle data uzlů">📅 Z časové osy</button><button id="prKomunity" title="Krok pro každou komunitu (téma)">🧮 Z komunit</button>' +
      '<button id="prSkupiny" title="Krok pro každou skupinu">▣ Ze skupin</button></div>';
    if (p) {
      s += '<div class="pole"><label for="prNazev">Název</label><input type="text" id="prNazev" value="' + esc(p.nazev) + '"></div>' +
        '<div class="radek"><button id="prSpustit" class="hlavni"' + (p.kroky.length ? '' : ' disabled') + '>▶ Spustit</button><button id="prKrok" title="Nový krok z vybraných uzlů">+ Krok z výběru</button>' +
        '<button id="prSmazat" class="nebezpeci">🗑</button></div>' +
        '<div class="kroky">' + p.kroky.map((k, i) => '<div class="krok" data-i="' + i + '">' +
          '<div class="radek"><b>' + (i + 1) + '.</b><input type="text" data-t value="' + esc(k.titulek) + '" placeholder="Titulek kroku" style="flex:1">' +
          '<button class="ikona" data-nahoru title="Posunout výš"' + (i ? '' : ' disabled') + '>↑</button><button class="ikona" data-dolu title="Posunout níž"' + (i < p.kroky.length - 1 ? '' : ' disabled') + '>↓</button>' +
          '<button class="ikona nebezpeci" data-smaz title="Smazat krok">✕</button></div>' +
          '<textarea data-p rows="2" placeholder="Poznámka (zobrazí se v prezentaci)">' + esc(k.poznamka) + '</textarea>' +
          '<div class="radek"><span class="popisek">' + k.uzly.length + ' ' + sklon(k.uzly.length, 'uzel', 'uzly', 'uzlů') + (k.uzly.length ? ': ' + esc(k.uzly.slice(0, 3).map(nazevUzlu).join(', ')) + (k.uzly.length > 3 ? '…' : '') : ' (celá mapa)') + '</span>' +
          '<button data-zvyberu title="Nahradit uzly kroku aktuálním výběrem">↺ z výběru</button><button data-ukaz>▶ od tohoto</button></div></div>').join('') + '</div>';
    }
    P.innerHTML = s;
    const pr = A.prezentace;
    $('prVyber').onchange = e => { vybranyPribeh = e.target.value; vykresliPribeh(); };
    const novy = (nazev, kroky) => {
      A.zaloha();
      const ids = new Set(m.pribehy.map(x => x.id));
      let i = 1; while (ids.has('p' + i)) i++;
      const np = { id: 'p' + i, nazev, kroky: kroky.map((k, j) => Object.assign({ id: 'k' + (j + 1), titulek: '', poznamka: '', uzly: [] }, k)) };
      m.pribehy.push(np);
      vybranyPribeh = np.id;
      A.zmena(false); vykresliPribeh();
      return np;
    };
    A.novyPribeh = novy;
    $('prNova').onclick = async () => {
      const n = await Dialog.zeptej('Název prezentace', 'Prezentace ' + (m.pribehy.length + 1));
      if (n == null) return;
      novy(n.trim() || 'Prezentace', A.vybUzly.size ? [{ titulek: 'Úvod', uzly: [...A.vybUzly] }] : [{ titulek: m.nazev, poznamka: m.popis || '', uzly: [] }]);
    };
    $('prCas').onclick = () => {
      const d = m.uzly.filter(u => isFinite(J.rokZData(u.datum))).sort((a, b) => J.rokZData(a.datum) - J.rokZData(b.datum));
      if (!d.length) { Dialog.chyba('Žádný uzel nemá datum.'); return; }
      novy('Časová osa', d.map(u => {
        const sous = J.sousedstvi(m, false).get(u.id).map(n => n.id);
        return { titulek: u.datum + ' – ' + u.nazev, poznamka: u.popis.split('\n')[0].slice(0, 400), uzly: [u.id].concat(sous) };
      }));
    };
    $('prKomunity').onclick = () => {
      const an = A.analyza();
      if (!an) return;
      novy('Témata sítě', an.komunity.velikosti.map((n, i) => {
        const ids = an.radky.filter(r => r.komunita === i).map(r => r.id);
        const nej = ids.slice().sort((a, b) => (A.stupne.get(b) || 0) - (A.stupne.get(a) || 0));
        return { titulek: 'Téma ' + (i + 1) + ': ' + nazevUzlu(nej[0]), poznamka: nej.slice(0, 6).map(nazevUzlu).join(', '), uzly: ids };
      }).filter(k => k.uzly.length > 1));
    };
    $('prSkupiny').onclick = () => {
      if (!(m.skupiny || []).length) { Dialog.chyba('Mapa nemá žádné skupiny.'); return; }
      novy('Po skupinách', m.skupiny.filter(x => x.uzly.length).map(x => ({ titulek: x.nazev, uzly: x.uzly.slice() })));
    };
    if (!p) return;
    vazPole('prNazev', v => { p.nazev = v.trim() || 'Prezentace'; });
    $('prSpustit').onclick = () => pr.start(p.id, 0);
    $('prKrok').onclick = () => {
      A.zaloha();
      const ids = new Set(p.kroky.map(k => k.id));
      let i = 1; while (ids.has('k' + i)) i++;
      const uz = [...A.vybUzly];
      p.kroky.push({ id: 'k' + i, titulek: uz.length === 1 ? nazevUzlu(uz[0]) : 'Krok ' + (p.kroky.length + 1), poznamka: uz.length === 1 ? J.najdiUzel(m, uz[0]).popis.split('\n')[0].slice(0, 400) : '', uzly: uz });
      A.zmena(false); vykresliPribeh();
    };
    $('prSmazat').onclick = async () => {
      if (!await Dialog.potvrd('Smazat prezentaci „' + p.nazev + '“?')) return;
      A.zaloha(); m.pribehy = m.pribehy.filter(x => x !== p); A.zmena(false); vykresliPribeh();
    };
    for (const el of P.querySelectorAll('.krok')) {
      const i = +el.dataset.i, k = p.kroky[i];
      let zal = false;
      for (const inp of el.querySelectorAll('[data-t],[data-p]')) {
        inp.addEventListener('focus', () => { zal = false; });
        inp.addEventListener('input', () => { if (!zal) { A.zaloha(); zal = true; } if (inp.hasAttribute('data-t')) k.titulek = inp.value; else k.poznamka = inp.value; A.ulozPozdeji(); });
      }
      const presun = d => { A.zaloha(); const [x] = p.kroky.splice(i, 1); p.kroky.splice(i + d, 0, x); A.zmena(false); vykresliPribeh(); };
      el.querySelector('[data-nahoru]').onclick = () => presun(-1);
      el.querySelector('[data-dolu]').onclick = () => presun(1);
      el.querySelector('[data-smaz]').onclick = () => { A.zaloha(); p.kroky.splice(i, 1); A.zmena(false); vykresliPribeh(); };
      el.querySelector('[data-zvyberu]').onclick = () => { A.zaloha(); k.uzly = [...A.vybUzly]; A.zmena(false); vykresliPribeh(); };
      el.querySelector('[data-ukaz]').onclick = () => pr.start(p.id, i);
    }
  }

  /* ================= TYPY ================= */
  function vykresliTypy() {
    const P = $('panelTypy');
    const m = mapa();
    const pocty = {}, poctyV = {};
    for (const u of m.uzly) pocty[u.typ] = (pocty[u.typ] || 0) + 1;
    for (const h of m.hrany) if (h.typ) poctyV[h.typ] = (poctyV[h.typ] || 0) + 1;
    P.innerHTML = '<h2>🏷️ Typy uzlů</h2><div class="napoveda">Typ určuje barvu, tvar a ikonu. Kliknutím na typ v legendě nad mapou ho skryjete.</div>' +
      m.typy.map((t, i) => '<div class="typ-radek" data-i="' + i + '">' +
        '<input type="text" class="ik" data-p="ikona" value="' + esc(t.ikona) + '" maxlength="8" aria-label="Ikona" title="Ikona (emoji)">' +
        '<input type="text" data-p="nazev" value="' + esc(t.nazev) + '" aria-label="Název typu">' +
        '<input type="color" data-p="barva" value="' + t.barva + '" aria-label="Barva">' +
        '<div class="druhy"><select data-p="tvar" aria-label="Tvar">' + [['zaobleny', '▢ zaoblený'], ['kapsle', '⬭ kapsle'], ['ostry', '□ hranatý'], ['elipsa', '◯ elipsa']]
          .map(([v, n]) => '<option value="' + v + '"' + (t.tvar === v ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>' +
        '<span class="popisek">' + (pocty[t.id] || 0) + '×</span>' +
        '<button class="ikona nebezpeci" data-smaz="' + i + '" title="Smazat typ"' + (m.typy.length < 2 ? ' disabled' : '') + '>🗑</button></div></div>').join('') +
      '<div class="radek"><button id="tPridat">+ Nový typ</button><button id="tVychozi" title="Doplnit chybějící výchozí typy">↺ Doplnit výchozí</button></div>' +
      '<h2 style="margin-top:14px">↗ Typy vztahů</h2><div class="napoveda">Typ vztahu nastaví barvu, čáru a směr; bez vlastního popisu se na čáře ukáže jeho název.</div>' +
      (m.typyVztahu || []).map((t, i) => '<div class="typ-radek vztahovy" data-iv="' + i + '">' +
        '<input type="text" data-p="nazev" value="' + esc(t.nazev) + '" aria-label="Název typu vztahu" style="grid-column:1/3">' +
        '<input type="color" data-p="barva" value="' + (t.barva || '#888888') + '" aria-label="Barva">' +
        '<div class="druhy"><select data-p="styl" aria-label="Čára">' + [['plna', '── plná'], ['carkovana', '- - čárkovaná'], ['teckovana', '··· tečkovaná']].map(([v, n]) => '<option value="' + v + '"' + (t.styl === v ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>' +
        '<select data-p="smer" aria-label="Směr">' + [['->', '→'], ['<->', '↔'], ['--', '—']].map(([v, n]) => '<option value="' + v + '"' + (t.smer === v ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>' +
        '<span class="popisek">' + (poctyV[t.id] || 0) + '×</span>' +
        '<button class="ikona nebezpeci" data-smazv="' + i + '" title="Smazat typ vztahu">🗑</button></div></div>').join('') +
      '<div class="radek"><button id="tvPridat">+ Nový typ vztahu</button><button id="tvVychozi">↺ Doplnit výchozí</button></div>';
    const vaz = (r, t, jeVztah) => {
      for (const el of r.querySelectorAll('[data-p]')) {
        let zal = false;
        el.addEventListener('focus', () => { zal = false; });
        el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
          if (!zal) { A.zaloha(); zal = true; }
          t[el.dataset.p] = el.dataset.p === 'nazev' ? (el.value.trim() || t.id) : el.value;
          if (jeVztah && (el.dataset.p === 'styl' || el.dataset.p === 'smer')) for (const h of m.hrany) if (h.typ === t.id) h[el.dataset.p] = el.value;
          A.prekresli(); A.ulozPozdeji();
        });
      }
    };
    for (const r of P.querySelectorAll('[data-i]')) vaz(r, m.typy[+r.dataset.i], false);
    for (const r of P.querySelectorAll('[data-iv]')) vaz(r, m.typyVztahu[+r.dataset.iv], true);
    for (const b of P.querySelectorAll('[data-smaz]')) b.onclick = async () => {
      const t = m.typy[+b.dataset.smaz];
      const n = pocty[t.id] || 0;
      const nahrada = m.typy.find(x => x !== t);
      if (n && !await Dialog.potvrd('Typ „' + t.nazev + '“ má ' + n + ' uzlů. Převést je na „' + nahrada.nazev + '“ a typ smazat?')) return;
      A.zaloha();
      for (const u of m.uzly) if (u.typ === t.id) u.typ = nahrada.id;
      m.typy = m.typy.filter(x => x !== t);
      A.filtr.typy.delete(t.id);
      A.zmena();
    };
    for (const b of P.querySelectorAll('[data-smazv]')) b.onclick = async () => {
      const t = m.typyVztahu[+b.dataset.smazv];
      const n = poctyV[t.id] || 0;
      if (n && !await Dialog.potvrd('Typ vztahu „' + t.nazev + '“ používá ' + n + ' vztahů. Ty zůstanou, jen bez typu. Smazat?')) return;
      A.zaloha();
      for (const h of m.hrany) if (h.typ === t.id) h.typ = null;
      m.typyVztahu = m.typyVztahu.filter(x => x !== t);
      A.zmena();
    };
    $('tPridat').onclick = () => {
      A.zaloha();
      let i = 1; while (m.typy.some(t => t.id === 'typ' + i)) i++;
      const barvy = ['#e66767', '#008300', '#2a78d6', '#eda100', '#6250d6', '#1baf7a'];
      m.typy.push({ id: 'typ' + i, nazev: 'Nový typ ' + i, ikona: '🔹', barva: barvy[i % barvy.length], tvar: 'zaobleny' });
      A.zmena();
    };
    $('tVychozi').onclick = () => { A.zaloha(); for (const t of J.VYCHOZI_TYPY) if (!m.typy.some(x => x.id === t.id)) m.typy.push(Object.assign({}, t)); A.zmena(); };
    $('tvPridat').onclick = () => {
      A.zaloha();
      m.typyVztahu = m.typyVztahu || [];
      let i = 1; while (m.typyVztahu.some(t => t.id === 'vztah' + i)) i++;
      m.typyVztahu.push({ id: 'vztah' + i, nazev: 'nový vztah ' + i, barva: '#6250d6', styl: 'plna', smer: '->' });
      A.zmena();
    };
    $('tvVychozi').onclick = () => { A.zaloha(); m.typyVztahu = m.typyVztahu || []; for (const t of J.VYCHOZI_TYPY_VZTAHU) if (!m.typyVztahu.some(x => x.id === t.id)) m.typyVztahu.push(Object.assign({}, t)); A.zmena(); };
  }

  /* ================= TEXT ================= */
  let textNavazan = false;
  function vykresliText() {
    const m = mapa();
    $('seznamTypuText').innerHTML = m.typy.map(t => '<code>' + esc(t.id) + '</code>').join(', ');
    $('seznamTypuVztahuText').innerHTML = (m.typyVztahu || []).map(t => '<code>{' + esc(t.id) + '}</code>').join(', ') || '—';
    if (textNavazan) return;
    textNavazan = true;
    $('tlTextPridat').onclick = () => {
      const t = $('vstupText').value;
      if (A.nastroje && A.nastroje.jeSoubor(t)) { A.nastroje.importujText(t); return; }
      const mm = mapa();
      A.zaloha();
      const pred = new Set(mm.uzly.map(u => u.id));
      const r = J.parsujText(t, mm);
      const nove = mm.uzly.filter(u => !pred.has(u.id));
      A.doplnPozice();
      $('textChyby').textContent = 'Přidáno ' + nove.length + ' uzlů' + (r.chyby.length ? ' · ' + r.chyby.join(' ') : '');
      if (nove.length) A.vyber(nove.map(u => u.id), []);
      A.zmena();
      if (nove.length) A.prizpusobit();
    };
    $('tlTextNahradit').onclick = async () => {
      const t = $('vstupText').value;
      if (!t.trim()) return;
      if (A.nastroje && A.nastroje.jeSoubor(t)) { A.nastroje.importujText(t); return; }
      const mm = mapa();
      if (mm.uzly.length && !await Dialog.potvrd('Nahradit obsah mapy „' + mm.nazev + '“ textem? (Jde vrátit přes Zpět.)')) return;
      const nova = J.novaMapa(mm.nazev);
      nova.popis = mm.popis; nova.typy = mm.typy; nova.typyVztahu = mm.typyVztahu;
      const r = J.parsujText(t, nova);
      const g = new Map(nova.uzly.map(u => [u.id, J.geometrieUzlu(nova, u, A.mer, {})]));
      (window.MapaRozlozeni ? window.MapaRozlozeni.rozmistiSilove : J.rozmistiSilove)(nova, g, { iterace: 400 });
      A.nahradMapu(nova);
      $('textChyby').textContent = nova.uzly.length + ' uzlů, ' + nova.hrany.length + ' vztahů' + (r.chyby.length ? ' · ' + r.chyby.join(' ') : '');
      A.prizpusobit();
    };
    $('tlTextZMapy').onclick = () => { $('vstupText').value = J.naText(mapa()); };
  }

  A.panely = { prepni, vykresli, aktivni, vykresliDetail };
})();
