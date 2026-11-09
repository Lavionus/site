/* ============================================================
   prekladac_svetu/ui.js – rozhraní Překladače světů.
   Jádro (PRESVETU) je v jadro.js; tady stav, lišta, panely,
   lexikon, editor jazyka, generátor jmen, texty a exporty.
   ============================================================ */
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const K = {
    stav: 'webapp_prekladac_svetu', slova: 'webapp_prekladac_svetu_slova', jazyky: 'webapp_prekladac_svetu_jazyky',
    lexikon: 'webapp_prekladac_svetu_lexikon', texty: 'webapp_prekladac_svetu_texty',
  };
  const nacti = (k, z) => { try { return JSON.parse(localStorage.getItem(k)) ?? z; } catch (e) { return z; } };
  const zapis = (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) { Dialog.chyba('Úložiště prohlížeče je plné – data se neuložila.'); return false; }
  };

  // ---------- stav ----------
  const stav = Object.assign({ jazyk: 'elfi', smer: 'tam', pismo: 'obe', text: 'Vítej, poutníku, u našeho ohně.', dokId: null,
    zobraz: {} }, nacti(K.stav, {}));
  stav.zobraz = Object.assign({ mezi: false, rozbor: true, vsechny: true, karta: true, abeceda: true }, stav.zobraz);
  let slova = nacti(K.slova, []);           // česká slova, která uživatel překládal (zpětný překlad)
  let vlastni = nacti(K.jazyky, []);        // jazyky uživatele
  let lexikon = nacti(K.lexikon, {});       // {idJazyka: [{cs, cil, tvary}]}
  let texty = nacti(K.texty, []);           // [{id, nazev, text, jazyk, smer, upraveno}]
  let zmeneno = false;
  PRESVETU.registruj(vlastni.filter(j => !PRESVETU.zkontroluj(j)));
  if (!PRESVETU.jazyk(stav.jazyk)) stav.jazyk = 'elfi';

  const J = () => PRESVETU.jazyk(stav.jazyk);
  const lex = () => lexikon[stav.jazyk] || [];
  const vsechnyJazyky = () => PRESVETU.JAZYKY.concat(vlastni);
  const kratky = j => j.nazev.replace(/\s*\(.*\)/, '');
  const ulozStav = () => zapis(K.stav, stav);

  function zapamatujSlova(text) {
    const mnozina = new Set(slova);
    let zmena = false;
    for (const s of (text.match(/[\p{L}\p{M}]+/gu) || []).map(s => s.toLowerCase())) {
      if (!mnozina.has(s)) { mnozina.add(s); slova.push(s); zmena = true; }
    }
    if (slova.length > 3000) slova = slova.slice(-3000);
    if (zmena) zapis(K.slova, slova);
  }

  // ---------- nabídka jazyků ----------
  function nabidkaJazyku() {
    const tl = j => `<button class="tl prep" data-jazyk="${esc(j.id)}" aria-pressed="${j.id === stav.jazyk}">${esc(j.emoji || '🗣')} ${esc(j.nazev)}</button>`;
    $('nabJazyk').innerHTML = '<div class="titulek">Vestavěné jazyky</div>' + PRESVETU.JAZYKY.map(tl).join('')
      + (vlastni.length ? '<hr><div class="titulek">Vlastní jazyky</div>' + vlastni.map(tl).join('') : '')
      + `<hr><button class="tl" data-prikaz="novyJazyk">✚ Nový jazyk (náhodné hlásky)…</button>
         <button class="tl" data-prikaz="editor">🛠 Upravit tento jazyk…</button>
         <button class="tl" data-prikaz="expJazyk">📤 Export jazyka i s lexikonem (.json)</button>
         <button class="tl" data-prikaz="impJazyk">📥 Import jazyka (.json)…</button>`;
  }

  // ---------- vykreslení ----------
  // písmo jazyka: vlastní abeceda (font generovaný v prohlížeči) nebo převzaté písmo přes přepis
  const RODINY = { tengwar: 'PS Tengwar', runy: 'PS Runy', hlaholice: 'PS Hlaholice', ogam: 'PS Ogam', goticke: 'PS Goticke' };
  const prepisPismem = (text, pismo) => PREPIS.preved(pismo, pismo === 'tengwar' ? text.replace(/[ëä]/g, c => (c === 'ë' ? 'e' : 'a')) : text);
  function vPismu(text, j) {
    if (j.pismo === 'abeceda' && j.abeceda) {
      ABECEDY.nacti(j.abeceda, j.vlastni || j.nazev).catch(e => console.error(e));
      return { rodina: ABECEDY.rodina(j.abeceda), text };
    }
    if (RODINY[j.pismo]) return { rodina: RODINY[j.pismo], text: prepisPismem(text, j.pismo) };
    return null;
  }
  const stylPisma = v => `font-family:'${v.rodina}',serif`;

  function vlastniPismo(text, j) {
    const el = $('pismo'), v = vPismu(text, j);
    if (stav.pismo !== 'obe' || !v || !text.trim()) { el.hidden = true; return; }
    el.hidden = false;
    el.className = 'pismo' + (j.pismo === 'abeceda' ? ' abeceda' : '');
    el.style.fontFamily = `'${v.rodina}', serif`;
    el.textContent = v.text;
  }

  const ZNAKY_ABECEDY = 'abcdefghijklmnopqrstuvwxyz0123456789.,!?'.split('');
  const mrizkaZnaku = (j, v) => ZNAKY_ABECEDY.map(ch => `<div><b style="${stylPisma(v)}">${esc(j.pismo === 'abeceda' ? ch : prepisPismem(ch, j.pismo))}</b><small>${esc(ch)}</small></div>`).join('');
  function vykresliAbecedu(j) {
    const panel = $('panelAbeceda');
    panel.hidden = !stav.zobraz.abeceda;
    if (panel.hidden) return;
    const v = vPismu('', j), vlastniAb = j.pismo === 'abeceda';
    $('abecedaMrizka').innerHTML = v ? mrizkaZnaku(j, v) : '';
    $('abecedaInfo').textContent = vlastniAb ? `${ABECEDY.STYL[j.abeceda.styl].nazev}, semínko ${j.abeceda.semeno}` : v ? 'převzaté písmo' : 'jen latinka';
    document.querySelector('[data-prikaz="stahnoutFont"]').hidden = !vlastniAb;
    $('abecedaPozn').hidden = !vlastniAb;
    if (!v) $('abecedaMrizka').innerHTML = '<p class="prazdne" style="grid-column:1/-1">Jazyk se píše jen latinkou. Vlastní abecedu zapnete tlačítkem níže (Písmo → vlastní abeceda jazyka).</p>';
  }

  let posledni = '', pary = [];   // výsledek latinkou; dvojice slov v pořadí výstupu
  function prekresli() {
    const j = J(), tam = stav.smer === 'tam', L = lex();
    nabidkaJazyku();
    $('tlJazyk').textContent = `${j.emoji || '🗣'} ${kratky(j)} ▾`;
    $('smerTxt').textContent = tam ? ' Česky → jazyk' : ' Jazyk → česky';
    $('vstupNadpis').textContent = tam ? 'Česky' : kratky(j);
    $('vystupNadpis').textContent = tam ? kratky(j) : 'Česky';
    $('vstup').placeholder = tam ? 'Napište text česky…' : `Vložte text v jazyce ${j.vlastni || j.nazev}…`;
    document.querySelectorAll('[data-pismo]').forEach(b => b.setAttribute('aria-pressed', b.dataset.pismo === stav.pismo));
    document.querySelectorAll('[data-zobraz]').forEach(b => b.setAttribute('aria-pressed', !!stav.zobraz[b.dataset.zobraz]));
    $('panelRozbor').hidden = !stav.zobraz.rozbor;
    $('panelVsechny').hidden = !stav.zobraz.vsechny;
    $('panelKarta').hidden = !stav.zobraz.karta;
    vykresliAbecedu(j);
    $('dokNazev').textContent = (stav.dokId && (texty.find(t => t.id === stav.dokId) || {}).nazev || '') + (zmeneno && stav.dokId ? ' •' : '');

    const text = $('vstup').value;
    const nSlov = (text.match(/[\p{L}\p{M}]+/gu) || []).length;
    $('pocet').textContent = text ? `${nSlov} slov · ${text.length} znaků` : '';
    const v = $('vystup');
    v.className = 'vystup';
    $('neznamaPozn').hidden = true;
    pary = [];
    if (!text.trim()) {
      v.classList.add('prazdny');
      v.textContent = 'Překlad se ukáže tady.';
      posledni = '';
      vlastniPismo('', j);
    } else if (tam) {
      posledni = PRESVETU.preloz(text, j, L, pary);
      vykresliPary(v, j);
      vlastniPismo(posledni, j);
    } else {
      const z = PRESVETU.zpet(text, j, slova, L);
      posledni = z.text;
      v.innerHTML = esc(z.text).replace(/‹([^›]*)›/g, '<span class="nezname">‹$1›</span>');
      vlastniPismo('', j);
      if (z.neznama.length) {
        $('neznamaPozn').hidden = false;
        $('neznamaPozn').textContent = `Neznámých slov: ${z.neznama.length}. Zpět překládám běžná slova, slova z lexikonu a slova, která jste už v tomto prohlížeči překládali do jazyka.`;
      }
    }
    $('vystupInfo').textContent = posledni ? `${posledni.length} znaků` : '';

    // karta jazyka
    $('kartaEmoji').textContent = j.emoji || '🗣';
    $('kartaNazev').textContent = j.vlastni ? `${j.nazev} – v jazyce sám sebe nazývá „${j.vlastni}“` : j.nazev;
    $('kartaPopis').textContent = j.popis || '';
    $('kartaVyslovnost').textContent = j.vyslovnost || '–';
    const ukaz = a => a.map(x => x || '∅').join(' ');
    $('kartaHlasky').textContent = `začátky: ${ukaz(j.zac)} | jádra: ${ukaz([...new Set(j.jadro)])} | konce: ${ukaz(j.kon)} | přípony: ${ukaz(j.pripony)}`;

    // rozbor slov (vždy z české strany)
    const cesky = tam ? text : posledni.replace(/‹[^›]*›/g, '');
    if (stav.zobraz.rozbor) vykresliRozbor(cesky, j, L);
    if (stav.zobraz.vsechny) {
      const ukazka = cesky.trim().slice(0, 400) || 'Ahoj, příteli!';
      $('vsechny').innerHTML = vsechnyJazyky().map(k => `<button class="jazyk-karta${k.id === j.id ? ' aktivni' : ''}" data-jazyk="${esc(k.id)}">`
        + `<b>${esc(k.emoji || '🗣')} ${esc(kratky(k))}</b>` + (() => {
          const t = PRESVETU.preloz(ukazka, k, lexikon[k.id]), v = vPismu(t.slice(0, 160), k);
          return `<span data-i18n="ne">${esc(t)}</span>` + (v && stav.pismo === 'obe' ? `<span class="skript" data-i18n="ne" style="${stylPisma(v)}">${esc(v.text)}</span>` : '');
        })() + '</button>').join('');
    }
  }

  // výstup: každé slovo je klikací (úprava v lexikonu); mezířádkově s původním slovem pod sebou
  function vykresliPary(v, j) {
    const L = lex(), lexSlova = new Set(L.map(e => e.cs.toLowerCase()));
    const vLex = cs => {
      const m = cs.toLowerCase();
      return lexSlova.has(m) || L.some(e => e.tvary && PRESVETU.rozdel(e.cs.toLowerCase())[0] === PRESVETU.rozdel(m)[0]);
    };
    if (stav.zobraz.mezi) {
      v.classList.add('mezi');
      v.innerHTML = pary.map(p => {
        if (p.o !== undefined) {
          const zlom = /\n/.test(p.o) ? '<span class="zlom"></span>' : '';
          const znaky = p.o.replace(/\s+/g, '');
          return (znaky ? `<span class="ilw">${esc(znaky)}<small>&nbsp;</small></span>` : '') + zlom;
        }
        return `<span class="ilw w${vLex(p.cs) ? ' lex' : ''}" data-slovo="${esc(p.cs)}">${esc(p.cil)}<small>${esc(p.cs)}</small></span>`;
      }).join('');
    } else {
      v.innerHTML = pary.map(p => p.o !== undefined ? esc(p.o)
        : `<span class="w${vLex(p.cs) ? ' lex' : ''}" data-slovo="${esc(p.cs)}" title="${esc(p.cs)}">${esc(p.cil)}</span>`).join('');
    }
  }

  const ZDROJE = { slovnik: 'běžné slovo', generovano: 'vygenerováno', lexikon: '📚 lexikon', 'lexikon-tvary': '📚 lexikon – všechny tvary' };
  function vykresliRozbor(cesky, j, L) {
    const r = PRESVETU.rozbor(cesky, j, L), sk = vPismu('', j);
    $('rozborJazyk').textContent = kratky(j);
    $('rozborInfo').textContent = r.length ? `${r.length} různých slov, z lexikonu ${r.filter(d => d.zdroj.startsWith('lexikon')).length}` : '';
    $('rozbor').innerHTML = r.length ? r.map(d => `<tr>
        <td data-i18n="ne">${esc(d.cs)}</td>
        <td class="roz" data-i18n="ne">${esc(d.kmen)}${d.konc ? `·<i>${esc(d.konc)}</i>` : ''}</td>
        <td class="cil" data-i18n="ne">${esc(d.cil)}</td>
        <td class="skript" data-i18n="ne"${sk ? ` style="${stylPisma(sk)}">${esc(sk === true ? '' : vPismu(d.cil, j).text)}` : '>–'}</td>
        <td class="roz" data-i18n="ne">${esc(d.koren)}${d.pripona ? `·<i>${esc(d.pripona)}</i>` : ''}</td>
        <td><span class="zdroj${d.zdroj.startsWith('lexikon') ? ' lex' : ''}">${ZDROJE[d.zdroj]}</span></td>
        <td>${d.pocet}</td>
        <td><button class="mini" data-slovo="${esc(d.cs)}" title="Vlastní překlad slova" aria-label="Upravit překlad">✏️</button></td></tr>`).join('')
      : '<tr><td colspan="8" class="prazdne">Zatím žádná slova.</td></tr>';
  }

  // ---------- úprava slova / lexikon ----------
  function ulozLexikon(id, pole) {
    lexikon[id] = pole;            // nové pole = nová cache v jádru
    if (!pole.length) delete lexikon[id];
    zapis(K.lexikon, lexikon);
  }

  function upravSlovo(cs) {
    const j = J(), d = PRESVETU.rozbor(cs, j, lex())[0];
    if (!d) return;
    const [kmen] = PRESVETU.rozdel(d.cs);
    const existujici = lex().find(e => e.cs.toLowerCase() === d.cs) || lex().find(e => e.tvary && PRESVETU.rozdel(e.cs.toLowerCase())[0] === kmen);
    $('slovoCs').textContent = `„${d.cs}“`;
    $('slovoKmen').textContent = kmen + '-';
    $('slovoInfo').textContent = `Teď: ${d.cil} (${ZDROJE[d.zdroj]}). Rozklad: ${d.kmen}${d.konc ? ' · ' + d.konc : ''}.`;
    $('slovoCil').value = existujici && existujici.tvary ? existujici.cil : d.cil;
    $('slovoTvary').checked = existujici ? !!existujici.tvary : !!d.konc;
    $('slovoOdebrat').hidden = !existujici;
    const dlg = $('dlgSlovo'), id = stav.jazyk, L = lex();
    dlg.returnValue = '';
    dlg.onclose = () => {
      if (dlg.returnValue === 'odebrat') { ulozLexikon(id, L.filter(e => e !== existujici)); prekresli(); }
      else if (dlg.returnValue === 'ok') {
        const cil = $('slovoCil').value.trim();
        if (!cil) return;
        const tvary = $('slovoTvary').checked;
        // když se opravují všechny tvary, ukládá se kořen bez přípony
        const zaznam = { cs: tvary ? kmen : d.cs, cil: tvary && !existujici && d.pripona && cil.endsWith(d.pripona) ? cil.slice(0, -d.pripona.length) || cil : cil, tvary };
        // nahrazuje se jen záznam stejného druhu (výjimka pro jeden tvar nesmaže pravidlo pro všechny tvary)
        ulozLexikon(id, L.filter(e => !(e.cs.toLowerCase() === zaznam.cs && !!e.tvary === tvary)).concat(zaznam));
        prekresli();
      }
    };
    dlg.showModal();
    $('slovoCil').select();
  }

  $('slovoCil').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('dlgSlovo').close('ok'); } });

  function vykresliLexikon() {
    const j = J(), q = $('lexHledat').value.trim().toLowerCase();
    $('lexJazyk').textContent = j.nazev;
    const pole = lex().map((e, i) => ({ e, i })).filter(({ e }) => !q || e.cs.toLowerCase().includes(q) || e.cil.toLowerCase().includes(q))
      .sort((a, b) => a.e.cs.localeCompare(b.e.cs, 'cs'));
    $('lexTab').innerHTML = pole.length ? pole.map(({ e, i }) => `<tr>
        <td data-i18n="ne">${esc(e.cs)}${e.tvary ? '-' : ''}</td><td class="cil" data-i18n="ne">${esc(e.cil)}</td>
        <td>${e.tvary ? 'všechny tvary' : 'jen tento tvar'}</td>
        <td><button class="mini" data-lex-smaz="${i}" title="Odebrat" aria-label="Odebrat">🗑</button></td></tr>`).join('')
      : `<tr><td colspan="4" class="prazdne">${lex().length ? 'Nic nenalezeno.' : 'Lexikon je prázdný. Přidejte slovo nahoře, nebo klikněte na slovo v překladu.'}</td></tr>`;
  }
  $('lexHledat').addEventListener('input', vykresliLexikon);
  $('lexPridat').addEventListener('click', () => {
    const cs = $('lexCs').value.trim().toLowerCase(), cil = $('lexCil').value.trim(), tvary = $('lexTvary').checked;
    if (!cs || !cil) return Dialog.info('Vyplňte české slovo i překlad.');
    const klic = tvary ? PRESVETU.rozdel(cs)[0] : cs;
    ulozLexikon(stav.jazyk, lex().filter(e => !(e.cs.toLowerCase() === klic && !!e.tvary === tvary)).concat({ cs: klic, cil, tvary }));
    $('lexCs').value = $('lexCil').value = '';
    $('lexCs').focus();
    vykresliLexikon(); prekresli();
  });
  $('lexCil').addEventListener('keydown', e => { if (e.key === 'Enter') $('lexPridat').click(); });
  $('lexTab').addEventListener('click', e => {
    const b = e.target.closest('[data-lex-smaz]');
    if (!b) return;
    ulozLexikon(stav.jazyk, lex().filter((x, i) => i !== +b.dataset.lexSmaz));
    vykresliLexikon(); prekresli();
  });
  $('lexVymazat').addEventListener('click', async () => {
    if (!lex().length) return;
    if (!(await Dialog.potvrd(`Smazat všech ${lex().length} slov z lexikonu jazyka ${J().nazev}?`))) return;
    ulozLexikon(stav.jazyk, []);
    vykresliLexikon(); prekresli();
  });
  const csvPole = s => /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  $('lexExport').addEventListener('click', () => {
    if (!lex().length) return Dialog.info('Lexikon je prázdný.');
    stahni(`lexikon_${nazevSouboru(J().nazev)}.csv`, '﻿cesky;preklad;vsechny_tvary\n'
      + lex().map(e => [e.cs, e.cil, e.tvary ? 1 : 0].map(x => csvPole(String(x))).join(';')).join('\n'), 'text/csv');
  });
  $('lexImport').addEventListener('click', () => vyberSoubor('.csv,.txt', text => {
    const nove = [];
    for (const radek of text.replace(/^﻿/, '').split(/\r?\n/)) {
      const p = radek.split(/[;\t,]/).map(s => s.trim().replace(/^"|"$/g, ''));
      if (p.length < 2 || !p[0] || !p[1] || /^(cesky|česky)$/i.test(p[0])) continue;
      const tvary = /^(1|ano|true|x)$/i.test(p[2] || '');
      nove.push({ cs: tvary ? PRESVETU.rozdel(p[0].toLowerCase())[0] : p[0].toLowerCase(), cil: p[1], tvary });
    }
    if (!nove.length) return Dialog.chyba('V souboru nejsou žádná slova (očekávám řádky „česky;překlad;všechny tvary“).');
    const klice = new Set(nove.map(e => e.cs + '|' + e.tvary));
    ulozLexikon(stav.jazyk, lex().filter(e => !klice.has(e.cs + '|' + !!e.tvary)).concat(nove));
    Dialog.info(`Načteno ${nove.length} slov.`);
    vykresliLexikon(); prekresli();
  }));

  // ---------- generátor jmen ----------
  let jmSemeno = 1;
  function vykresliJmena() {
    const j = J();
    $('jmJazyk').textContent = j.nazev;
    const min = Math.max(1, +$('jmMin').value || 1), max = Math.max(min, +$('jmMax').value || min);
    const seznam = PRESVETU.jmena(j, { pocet: Math.min(100, Math.max(1, +$('jmPocet').value || 24)), min, max, semeno: jmSemeno, pridomek: $('jmPridomek').checked, lex: lex() });
    $('jmSeznam').innerHTML = seznam.map(z => `<button class="jmeno" data-kopie="${esc(z.jmeno + (z.pridomek ? ' ' + z.pridomek : ''))}">`
      + `<b data-i18n="ne">${esc(z.jmeno)}</b>${z.pridomek ? `<small><span data-i18n="ne">${esc(z.pridomek)}</span> – ${esc(z.pridomekCs)}</small>` : ''}</button>`).join('');
  }
  ['jmPocet', 'jmMin', 'jmMax', 'jmPridomek'].forEach(id => $(id).addEventListener('input', vykresliJmena));
  $('jmDalsi').addEventListener('click', () => { jmSemeno++; vykresliJmena(); });
  $('jmSeznam').addEventListener('click', e => { const b = e.target.closest('[data-kopie]'); if (b) kopiruj(b.dataset.kopie, 'Jméno zkopírováno.'); });
  $('jmKopirovat').addEventListener('click', () => kopiruj([...$('jmSeznam').querySelectorAll('[data-kopie]')].map(b => b.dataset.kopie).join('\n'), 'Jména zkopírována.'));

  // ---------- editor jazyka ----------
  let edPuvodni = null;   // upravovaný jazyk (vlastní) nebo null = nový / kopie vestavěného
  let edZdroj = null;     // z jakého jazyka editor vyšel (jeho lexikon dostane kopie)
  const naSeznam = s => s.trim().split(/[\s,]+/).filter(x => x !== '').map(x => (x === '∅' ? '' : x));
  const zeSeznamu = a => (a || []).map(x => x || '∅').join(' ');
  function doFormulare(j) {
    $('edNazev').value = j.nazev || ''; $('edVlastni').value = j.vlastni || ''; $('edEmoji').value = j.emoji || '🗣';
    $('edSemeno').value = j.semeno || 1; $('edPopis').value = j.popis || ''; $('edVyslovnost').value = j.vyslovnost || '';
    $('edZac').value = zeSeznamu(j.zac); $('edJadro').value = zeSeznamu(j.jadro); $('edKon').value = zeSeznamu(j.kon);
    $('edPripony').value = zeSeznamu(j.pripony); $('edPKon').value = j.pKon ?? 0.4;
    $('edMin').value = j.minSlabik || 1; $('edMax').value = j.maxSlabik || 3;
    $('edSpojka').value = j.spojka || ''; $('edPSpojka').value = j.pSpojka ?? 0;
    $('edPismo').value = j.pismo || '';
    const ab = j.abeceda || nahodnaAbeceda();
    $('edAbStyl').value = ab.styl; $('edAbSemeno').value = ab.semeno; $('edVyska').value = (j.hlas || {}).vyska ?? 1; $('edRychlost').value = (j.hlas || {}).rychlost ?? 1;
    $('edVelka').checked = !!j.velka; $('edObracene').checked = !!j.obracene; $('edVykrik').checked = !!j.vykrik; $('edBinarni').checked = !!j.binarni;
  }
  function zFormulare() {
    return {
      nazev: $('edNazev').value.trim(), vlastni: $('edVlastni').value.trim(), emoji: $('edEmoji').value.trim() || '🗣',
      semeno: +$('edSemeno').value || 1, popis: $('edPopis').value.trim(), vyslovnost: $('edVyslovnost').value.trim(),
      zac: naSeznam($('edZac').value), jadro: naSeznam($('edJadro').value), kon: naSeznam($('edKon').value),
      pripony: naSeznam($('edPripony').value), pKon: +$('edPKon').value, minSlabik: +$('edMin').value, maxSlabik: +$('edMax').value,
      spojka: $('edSpojka').value, pSpojka: +$('edPSpojka').value, pismo: $('edPismo').value,
      abeceda: $('edPismo').value === 'abeceda' ? { styl: $('edAbStyl').value, semeno: Math.round(+$('edAbSemeno').value || 1) } : undefined,
      hlas: { vyska: +$('edVyska').value, rychlost: +$('edRychlost').value },
      velka: $('edVelka').checked, obracene: $('edObracene').checked, vykrik: $('edVykrik').checked, binarni: $('edBinarni').checked,
    };
  }
  function nahledEditoru() {
    const j = zFormulare(), chyba = PRESVETU.zkontroluj(j);
    $('edPKonV').textContent = Math.round(j.pKon * 100) + ' %';
    $('edPSpojkaV').textContent = Math.round(j.pSpojka * 100) + ' %';
    $('edVyskaV').textContent = j.hlas.vyska.toFixed(2);
    $('edRychlostV').textContent = j.hlas.rychlost.toFixed(2);
    $('edChyba').hidden = !chyba;
    $('edChyba').textContent = chyba || '';
    if (chyba) return;
    j.id = '_nahled';
    $('edNahled').textContent = PRESVETU.preloz($('edVeta').value, j, edPuvodni ? lexikon[edPuvodni.id] : null);
    $('edJmena').textContent = PRESVETU.jmena(j, { pocet: 10 }).map(z => z.jmeno).join(', ');
    document.querySelectorAll('.ed-abeceda').forEach(el => { el.hidden = j.pismo !== 'abeceda'; });
    const v = vPismu('', j);
    $('edAbNahled').innerHTML = v && j.pismo === 'abeceda' ? mrizkaZnaku(j, v) : '';
  }
  $('edForm').addEventListener('input', nahledEditoru);
  $('edSemenoNahodne').addEventListener('click', () => { $('edSemeno').value = Math.floor(Math.random() * 1e6); nahledEditoru(); });
  const nahodnaAbeceda = () => ({ styl: ABECEDY.STYLY[Math.floor(Math.random() * ABECEDY.STYLY.length)].id, semeno: 1 + Math.floor(Math.random() * 9999) });
  $('edAbStyl').innerHTML = ABECEDY.STYLY.map(st => `<option value="${st.id}">${esc(st.nazev)}</option>`).join('');
  $('edAbNahodne').addEventListener('click', () => { $('edAbSemeno').value = 1 + Math.floor(Math.random() * 9999); nahledEditoru(); });
  $('edPismo').addEventListener('change', nahledEditoru);
  $('edAbStyl').addEventListener('change', nahledEditoru);
  $('edNahodny').addEventListener('click', () => {
    const n = Object.assign(PRESVETU.nahodnyJazyk(Math.floor(Math.random() * 1e9)), { pismo: 'abeceda', abeceda: nahodnaAbeceda() });
    doFormulare(Object.assign(zFormulare(), n, { minSlabik: n.minSlabik, maxSlabik: n.maxSlabik }));
    nahledEditoru();
  });
  function otevriEditor(j, novy) {
    edPuvodni = !novy && j && !j.vestaveny ? j : null;
    edZdroj = j;
    const vzor = j ? JSON.parse(JSON.stringify(j)) : Object.assign({ nazev: 'Můj jazyk', vlastni: '', emoji: '🗣', popis: '', vyslovnost: '', pismo: 'abeceda', abeceda: nahodnaAbeceda() }, PRESVETU.nahodnyJazyk(Date.now()));
    if (j && (j.vestaveny || novy)) vzor.nazev = j.nazev + ' (kopie)';
    doFormulare(vzor);
    $('edTitulek').textContent = edPuvodni ? '🛠 Upravit jazyk' : '🛠 Nový jazyk';
    $('edKopie').hidden = !(j && j.vestaveny);
    $('edSmazat').hidden = !edPuvodni;
    $('edJakoNovy').hidden = !edPuvodni;
    nahledEditoru();
    $('dlgEditor').showModal();
  }
  function ulozJazyk(jakoNovy) {
    const j = zFormulare(), chyba = PRESVETU.zkontroluj(j);
    if (chyba) return Dialog.chyba(chyba);
    if (edPuvodni && !jakoNovy) {
      j.id = edPuvodni.id;
      vlastni = vlastni.map(x => (x.id === j.id ? j : x));
    } else {
      j.id = 'v_' + Date.now().toString(36);
      vlastni = vlastni.concat(j);
      // kopie vestavěného jazyka si vezme i jeho lexikon
      if (edZdroj && lexikon[edZdroj.id]) lexikon[j.id] = lexikon[edZdroj.id].slice();
      zapis(K.lexikon, lexikon);
    }
    if (!zapis(K.jazyky, vlastni)) return;
    PRESVETU.registruj(vlastni);
    stav.jazyk = j.id;
    ulozStav();
    $('dlgEditor').close();
    Dialog.info(`Jazyk „${j.nazev}“ uložen.`);
    prekresli();
  }
  $('edForm').addEventListener('submit', e => { e.preventDefault(); ulozJazyk(false); });
  $('edJakoNovy').addEventListener('click', () => ulozJazyk(true));
  $('edSmazat').addEventListener('click', async () => {
    if (!edPuvodni) return;
    if (!(await Dialog.potvrd(`Smazat jazyk „${edPuvodni.nazev}“ i s jeho lexikonem?`))) return;
    vlastni = vlastni.filter(x => x.id !== edPuvodni.id);
    delete lexikon[edPuvodni.id];
    zapis(K.jazyky, vlastni); zapis(K.lexikon, lexikon);
    PRESVETU.registruj(vlastni);
    if (stav.jazyk === edPuvodni.id) stav.jazyk = 'elfi';
    ulozStav();
    $('dlgEditor').close();
    prekresli();
  });

  // ---------- texty (dokumenty) ----------
  async function ulozText(jakoNovy) {
    let t = !jakoNovy && stav.dokId && texty.find(x => x.id === stav.dokId);
    if (!t) {
      const nazev = await Dialog.zeptej('Název textu', ($('vstup').value.trim().split(/\n/)[0] || 'Text').slice(0, 40));
      if (!nazev) return;
      t = { id: 't_' + Date.now().toString(36), nazev };
      texty.unshift(t);
    }
    Object.assign(t, { text: $('vstup').value, jazyk: stav.jazyk, smer: stav.smer, upraveno: Date.now() });
    if (!zapis(K.texty, texty)) return;
    stav.dokId = t.id; zmeneno = false; ulozStav();
    Dialog.info(`Uloženo: ${t.nazev}`);
    prekresli();
  }
  function vykresliTexty() {
    $('dokTab').innerHTML = texty.length ? texty.map(t => {
      const j = PRESVETU.jazyk(t.jazyk);
      return `<tr><td data-i18n="ne"><b>${esc(t.nazev)}</b></td><td>${esc(j ? kratky(j) : '?')}</td>
        <td>${new Date(t.upraveno).toLocaleString()}</td>
        <td style="white-space:nowrap"><button class="btn" data-dok-otevrit="${t.id}">Otevřít</button>
        <button class="mini" data-dok-smaz="${t.id}" aria-label="Smazat" title="Smazat">🗑</button></td></tr>`;
    }).join('') : '<tr><td colspan="4" class="prazdne">Zatím žádné uložené texty. Uložíte je přes Soubor → Uložit (Ctrl+S).</td></tr>';
  }
  $('dokTab').addEventListener('click', async e => {
    const o = e.target.closest('[data-dok-otevrit]'), s = e.target.closest('[data-dok-smaz]');
    if (o) {
      if (zmeneno && !(await Dialog.potvrd('Rozepsaný text není uložený. Přesto otevřít jiný?'))) return;
      const t = texty.find(x => x.id === o.dataset.dokOtevrit);
      $('vstup').value = stav.text = t.text;
      if (PRESVETU.jazyk(t.jazyk)) stav.jazyk = t.jazyk;
      stav.smer = t.smer || 'tam'; stav.dokId = t.id; zmeneno = false;
      ulozStav(); $('dlgDokumenty').close(); prekresli();
    } else if (s) {
      const t = texty.find(x => x.id === s.dataset.dokSmaz);
      if (!(await Dialog.potvrd(`Smazat text „${t.nazev}“?`))) return;
      texty = texty.filter(x => x !== t);
      if (stav.dokId === t.id) stav.dokId = null;
      zapis(K.texty, texty); ulozStav(); vykresliTexty(); prekresli();
    }
  });

  // ---------- soubory ----------
  const nazevSouboru = s => PRESVETU.bezDiakritiky(s).replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'preklad';
  function stahni(nazev, obsah, typ) {
    const blob = obsah instanceof Blob ? obsah : new Blob([obsah], { type: (typ || 'text/plain') + ';charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function vyberSoubor(accept, hotovo) {
    const inp = $('soubor');
    inp.accept = accept; inp.value = '';
    inp.onchange = async () => { const f = inp.files[0]; if (f) hotovo(await f.text(), f); };
    inp.click();
  }
  async function kopiruj(text, zprava) {
    try { await navigator.clipboard.writeText(text); Dialog.info(zprava || 'Zkopírováno.'); }
    catch (e) { Dialog.chyba('Schránka není dostupná.'); }
  }
  const potrebujePreklad = () => { if (!posledni) { Dialog.info('Nejdřív napište text k překladu.'); return false; } return true; };
  const zakladNazvu = () => nazevSouboru(((texty.find(t => t.id === stav.dokId) || {}).nazev || 'preklad') + '_' + kratky(J()));

  // obrázek: překlad latinkou + vlastním písmem na bílém pozadí
  async function exportPng() {
    if (!potrebujePreklad()) return;
    const j = J(), W = 1600, P = 70, platno = document.createElement('canvas'), c = platno.getContext('2d');
    const zalom = (text, font, sirka) => {
      c.font = font;
      const radky = [];
      for (const odst of text.split('\n')) {
        let r = '';
        for (const w of odst.split(/\s+/)) {
          const zk = r ? r + ' ' + w : w;
          if (c.measureText(zk).width > sirka && r) { radky.push(r); r = w; } else r = zk;
        }
        radky.push(r);
      }
      return radky;
    };
    const fLat = '40px Georgia, serif', vLat = 58;
    const latinka = zalom(posledni, fLat, W - 2 * P);
    let pismoRadky = [], fPis = '', vPis = 0;
    const v = stav.pismo === 'obe' && vPismu(posledni, j);
    if (v) {
      fPis = `60px '${v.rodina}'`; vPis = 96;
      try {
        if (j.pismo === 'abeceda') await ABECEDY.nacti(j.abeceda, j.vlastni || j.nazev);
        await document.fonts.load(fPis);
      } catch (e) { /* bez fontu se nakreslí aspoň náhradní */ }
      pismoRadky = zalom(v.text, fPis, W - 2 * P);
    }
    const H = P + 50 + latinka.length * vLat + (pismoRadky.length ? 40 + pismoRadky.length * vPis : 0) + P;
    platno.width = W; platno.height = H;
    c.fillStyle = '#fbf8f1'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#7a6a50'; c.font = '26px Georgia, serif'; c.textBaseline = 'top';
    c.fillText(`${j.nazev}${j.vlastni ? ' · ' + j.vlastni : ''}`, P, P - 10);
    let y = P + 50;
    c.fillStyle = '#1a1a1a'; c.font = fLat;
    for (const r of latinka) { c.fillText(r, P, y); y += vLat; }
    if (pismoRadky.length) { y += 40; c.font = fPis; for (const r of pismoRadky) { c.fillText(r, P, y); y += vPis; } }
    platno.toBlob(b => stahni(zakladNazvu() + '.png', b), 'image/png');
  }

  // ---------- příkazy ----------
  const PRIKAZY = {
    smer() {
      const novy = posledni.replace(/‹([^›]*)›/g, '$1');
      if (stav.smer === 'tam') zapamatujSlova($('vstup').value);
      stav.smer = stav.smer === 'tam' ? 'zpet' : 'tam';
      if (novy) $('vstup').value = novy;
      stav.text = $('vstup').value;
      ulozStav(); prekresli();
    },
    kopirovat() { if (potrebujePreklad()) kopiruj(posledni, 'Překlad zkopírován.'); },
    vyslovit() {
      if (!potrebujePreklad()) return;
      if (!('speechSynthesis' in window)) return Dialog.chyba('Prohlížeč neumí číst nahlas.');
      const j = J(), tam = stav.smer === 'tam';
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(tam ? posledni.toLowerCase().replace(/[-']/g, ' ') : posledni);
      u.lang = 'cs-CZ';
      const hlas = speechSynthesis.getVoices().find(h => h.lang && h.lang.startsWith('cs'));
      if (hlas) u.voice = hlas;
      if (tam && j.hlas) { u.pitch = j.hlas.vyska; u.rate = j.hlas.rychlost; }
      speechSynthesis.speak(u);
    },
    napoveda() { $('napoveda').hidden = !$('napoveda').hidden; },
    lexikon() { $('lexHledat').value = ''; vykresliLexikon(); $('dlgLexikon').showModal(); $('lexCs').focus(); },
    jmena() { vykresliJmena(); $('dlgJmena').showModal(); },
    editor() { otevriEditor(J(), false); },
    novyJazyk() { otevriEditor(null, true); },
    async novy() {
      if (zmeneno && $('vstup').value.trim() && !(await Dialog.potvrd('Rozepsaný text není uložený. Začít nový?'))) return;
      $('vstup').value = stav.text = ''; stav.dokId = null; zmeneno = false;
      ulozStav(); prekresli(); $('vstup').focus();
    },
    otevrit() { vykresliTexty(); $('dlgDokumenty').showModal(); },
    ulozit() { ulozText(false); },
    ulozitJako() { ulozText(true); },
    importText() {
      vyberSoubor('.txt,.md,text/plain', (text, f) => {
        $('vstup').value = stav.text = text; stav.dokId = null; zmeneno = true;
        if (stav.smer === 'tam') zapamatujSlova(text);
        ulozStav(); prekresli();
        Dialog.info(`Načteno: ${f.name}`);
      });
    },
    expTxt() { if (potrebujePreklad()) stahni(zakladNazvu() + '.txt', posledni); },
    expMd() {
      if (!potrebujePreklad()) return;
      const j = J(), [cs, cil] = stav.smer === 'tam' ? [$('vstup').value, posledni] : [posledni, $('vstup').value];
      const odst = s => s.split(/\n\s*\n/);
      const a = odst(cs), b = odst(cil);
      let md = `# ${j.nazev}\n\n`;
      for (let i = 0; i < Math.max(a.length, b.length); i++) md += `${(b[i] || '').trim()}\n\n> ${(a[i] || '').trim().replace(/\n/g, '\n> ')}\n\n`;
      stahni(zakladNazvu() + '.md', md, 'text/markdown');
    },
    expCsv() {
      if (!potrebujePreklad()) return;
      const cesky = stav.smer === 'tam' ? $('vstup').value : posledni.replace(/‹[^›]*›/g, '');
      const r = PRESVETU.rozbor(cesky, J(), lex());
      stahni(zakladNazvu() + '_slova.csv', '﻿cesky;kmen;koncovka;preklad;koren;pripona;zdroj;vyskyt\n'
        + r.map(d => [d.cs, d.kmen, d.konc, d.cil, d.koren, d.pripona, ZDROJE[d.zdroj], d.pocet].map(x => csvPole(String(x))).join(';')).join('\n'), 'text/csv');
    },
    expPng: exportPng,
    stahnoutFont() {
      const j = J();
      if (j.pismo !== 'abeceda') return Dialog.info('Tento jazyk nemá vlastní abecedu.');
      const nazev = j.vlastni || j.nazev;
      stahni(`${nazevSouboru(nazev)}.ttf`, new Blob([ABECEDY.ttf(j.abeceda, nazev)], { type: 'font/ttf' }));
    },
    upravitAbecedu() { otevriEditor(J(), false); setTimeout(() => $('edPismo').focus(), 50); },
    expJazyk() {
      const j = J(), kopie = JSON.parse(JSON.stringify(j));
      delete kopie.vestaveny;
      stahni(`jazyk_${nazevSouboru(j.nazev)}.json`, JSON.stringify({ format: 'prekladac_svetu-jazyk', verze: 1, jazyk: kopie, lexikon: lex() }, null, 2), 'application/json');
    },
    impJazyk() {
      vyberSoubor('.json,application/json', text => {
        let data;
        try { data = JSON.parse(text); } catch (e) { return Dialog.chyba('Soubor není platný JSON.'); }
        const j = data && data.jazyk;
        if (!j || data.format !== 'prekladac_svetu-jazyk') return Dialog.chyba('Soubor není jazyk z Překladače světů.');
        const chyba = PRESVETU.zkontroluj(j);
        if (chyba) return Dialog.chyba(chyba);
        j.id = 'v_' + Date.now().toString(36);
        delete j.vestaveny;
        if (vsechnyJazyky().some(x => x.nazev === j.nazev)) j.nazev += ' (import)';
        vlastni = vlastni.concat(j);
        if (Array.isArray(data.lexikon) && data.lexikon.length) lexikon[j.id] = data.lexikon.filter(e => e && e.cs && e.cil);
        zapis(K.jazyky, vlastni); zapis(K.lexikon, lexikon);
        PRESVETU.registruj(vlastni);
        stav.jazyk = j.id; ulozStav(); prekresli();
        Dialog.info(`Jazyk „${j.nazev}“ načten.`);
      });
    },
  };

  // ---------- události ----------
  let casovac = 0;
  $('vstup').addEventListener('input', () => {
    zmeneno = true;
    prekresli();
    clearTimeout(casovac);
    casovac = setTimeout(() => { stav.text = $('vstup').value; if (stav.smer === 'tam') zapamatujSlova(stav.text); ulozStav(); }, 400);
  });

  document.addEventListener('click', e => {
    if (e.target.closest('[data-zavrit]')) { e.target.closest('dialog').close(); return; }
    const t = e.target.closest('[data-prikaz],[data-jazyk],[data-veta],[data-pismo],[data-zobraz],[data-slovo]');
    if (!t) { if (!e.target.closest('.nabidka')) zavriNabidky(); return; }
    if (t.closest('dialog')) return;
    zavriNabidky();
    if (t.dataset.prikaz) PRIKAZY[t.dataset.prikaz]();
    else if (t.dataset.jazyk) { stav.jazyk = t.dataset.jazyk; ulozStav(); prekresli(); }
    else if (t.dataset.pismo) { stav.pismo = t.dataset.pismo; ulozStav(); prekresli(); }
    else if (t.dataset.zobraz) { stav.zobraz[t.dataset.zobraz] = !stav.zobraz[t.dataset.zobraz]; ulozStav(); prekresli(); }
    else if (t.dataset.slovo !== undefined) upravSlovo(t.dataset.slovo);
    else {
      stav.smer = 'tam';
      $('vstup').value = stav.text = t.textContent.trim();
      zmeneno = true;
      zapamatujSlova(stav.text); ulozStav(); prekresli();
    }
  });

  // nabídky lišty
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
  addEventListener('resize', zavriNabidky);
  addEventListener('keydown', e => {
    if (document.querySelector('dialog[open]')) return;
    if (e.key === 'Escape') zavriNabidky();
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === 's') { e.preventDefault(); PRIKAZY.ulozit(); }
    else if (ctrl && e.key.toLowerCase() === 'o') { e.preventDefault(); PRIKAZY.otevrit(); }
    else if (ctrl && e.key === 'Enter') { e.preventDefault(); PRIKAZY.smer(); }
  });

  $('vstup').value = stav.text || '';
  if (stav.smer === 'tam') zapamatujSlova(stav.text || '');
  prekresli();
  window.PRESVETU_UI = { PRIKAZY, prekresli, upravSlovo, otevriEditor };   // pro testy
})();
