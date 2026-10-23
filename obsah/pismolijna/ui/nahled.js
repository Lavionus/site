/* ============================================================
   Písmolijna – ui/nahled.js
   Náhled skutečným fontem: font se vyexportuje do TTF, načte
   přes FontFace a vykreslí prohlížečem (kerning, ligatury,
   vodopád velikostí, odstavec, pokrytí znakové sady).
   ============================================================ */
(function () {
  'use strict';
  const P = window.PSL, A = window.PSLAPP;
  const el = A.el;
  const koren = document.getElementById('nahled');
  let rodina = null, citac = 0, platne = false, posledniFace = null;

  const VZORY = {
    pangram: 'Příliš žluťoučký kůň úpěl ďábelské ódy.',
    abeceda: 'AÁBCČDĎEÉĚFGHIÍJKLMNŇOÓPQRŘSŠTŤUÚŮVWXYÝZŽ\naábcčdďeéěfghiíjklmnňoópqrřsštťuúůvwxyýzž\n0123456789 .,:;!?„“‚‘()[]{}–—/@&%€$',
    kerning: 'AVATAR Tomáš Váňa ŤAVA LT Yo P. Wa Fe ty „ano“ (j) 7.',
    odstavec: 'Písmolijna je dílna, kde se písmena odlévají do formy. Dobré písmo je neviditelné: čtenář vnímá slova, ne tvary. Proto se mezery mezi písmeny ladí tak dlouho, až text působí rovnoměrně šedě, bez děr a shluků. Kerning dorovnává dvojice, které by jinak stály příliš daleko od sebe – například AV, To nebo Ty.'
  };
  const st = Object.assign({ text: VZORY.pangram, vel: 48, kern: true, liga: true, barva: '' }, A.nastaveni.nahled || {});

  function uloz() { A.nastaveni.nahled = st; A.ulozNastaveni(); }

  async function pripravFont() {
    if (typeof P.exportTTF !== 'function') throw new Error('Chybí modul exportu.');
    const data = P.exportTTF(A.font, {});
    const jmeno = 'PSLNahled' + (++citac);
    const face = new FontFace(jmeno, data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
    await face.load();
    document.fonts.add(face);
    if (posledniFace) { try { document.fonts.delete(posledniFace); } catch (e) { /* nevadí */ } }
    posledniFace = face; rodina = jmeno; platne = true;
    return data.byteLength;
  }

  async function vykresli() {
    koren.innerHTML = '';
    let velikost = 0;
    try { velikost = await pripravFont(); }
    catch (e) {
      koren.append(el('p', { class: 'poznamka', text: 'Font se nepodařilo sestavit pro náhled: ' + e.message }));
      return;
    }
    const styl = () => `font-family:'${rodina}',sans-serif;font-feature-settings:'kern' ${st.kern ? 1 : 0},'liga' ${st.liga ? 1 : 0};font-kerning:${st.kern ? 'normal' : 'none'}`;
    const text = el('textarea', { 'aria-label': 'Text náhledu', rows: 3 }); text.value = st.text;
    text.setAttribute('style', styl() + ';font-size:22px');
    const vel = el('input', { type: 'range', min: 8, max: 200, value: st.vel, 'aria-label': 'Velikost' });
    const kern = el('input', { type: 'checkbox' }); kern.checked = st.kern;
    const liga = el('input', { type: 'checkbox' }); liga.checked = st.liga;
    const velky = el('div', { style: styl() + ';font-size:' + st.vel + 'px;line-height:1.25;white-space:pre-wrap;overflow-wrap:anywhere;margin:6px 0 10px' }, st.text);
    const vodopad = el('div', { class: 'vodopad' });
    const odst = el('p', { class: 'odstavec', style: styl() + ';font-size:17px' }, VZORY.odstavec);
    const odst2 = el('p', { class: 'odstavec', style: styl() + ';font-size:12px;columns:2;column-gap:28px;max-width:none' }, VZORY.odstavec + ' ' + VZORY.odstavec);
    function vodopadVypln() {
      vodopad.innerHTML = '';
      for (const v of [10, 12, 14, 16, 20, 24, 32, 40, 56, 72, 96]) vodopad.append(el('div', { style: styl() + ';font-size:' + v + 'px' }, [el('span', { class: 'vel', text: v + ' px' }), st.text.split('\n')[0]]));
    }
    function obnovStyly() {
      text.setAttribute('style', styl() + ';font-size:22px');
      velky.setAttribute('style', styl() + ';font-size:' + st.vel + 'px;line-height:1.25;white-space:pre-wrap;overflow-wrap:anywhere;margin:6px 0 10px');
      odst.setAttribute('style', styl() + ';font-size:17px');
      odst2.setAttribute('style', styl() + ';font-size:12px;columns:2;column-gap:28px;max-width:none');
      vodopadVypln();
    }
    text.addEventListener('input', () => { st.text = text.value; velky.textContent = st.text; vodopadVypln(); uloz(); });
    vel.addEventListener('input', () => { st.vel = +vel.value; obnovStyly(); uloz(); });
    kern.addEventListener('change', () => { st.kern = kern.checked; obnovStyly(); uloz(); });
    liga.addEventListener('change', () => { st.liga = liga.checked; obnovStyly(); uloz(); });
    const vzory = Object.keys(VZORY).map(k => el('button', { type: 'button', class: 'tl', text: { pangram: 'Pangram', abeceda: 'Abeceda', kerning: 'Kerningové páry', odstavec: 'Odstavec' }[k], onclick: () => { st.text = VZORY[k]; text.value = st.text; velky.textContent = st.text; vodopadVypln(); uloz(); } }));
    koren.append(
      el('div', { class: 'ovl' }, vzory.concat([
        el('label', { class: 'mala' }, ['Velikost', vel]),
        el('label', { class: 'mala' }, [kern, 'kerning']),
        el('label', { class: 'mala' }, [liga, 'ligatury']),
        el('button', { type: 'button', class: 'tl', text: '🔄 Obnovit', title: 'Znovu sestavit font z aktuálního stavu', onclick: vykresli }),
        el('span', { class: 'poznamka', text: 'TTF ' + Math.round(velikost / 1024 * 10) / 10 + ' kB · vykresluje prohlížeč stejně jako na webu' })
      ])),
      text, velky,
      el('h3', { text: 'Vodopád velikostí' }), vodopad,
      el('h3', { text: 'Odstavec' }), odst, odst2,
      el('h3', { text: 'Pokrytí znaků' }), pokryti(styl())
    );
    vodopadVypln();
  }

  function pokryti(styl) {
    const f = A.font, mapa = P.cmap(f);
    const obal = el('div');
    for (const id of ['cesky', 'zaklad', 'latin1', 'latinA']) {
      const b = P.BLOKY.find(x => x.id === id);
      const ma = b.znaky.filter(c => mapa.has(c) && !P.glyfJePrazdny(f.glyfy[mapa.get(c)]) || (c === 0x20 && mapa.has(c)));
      obal.append(el('p', { class: 'poznamka', text: b.nazev + ': ' + ma.length + ' / ' + b.znaky.length + (ma.length === b.znaky.length ? ' ✓' : '') }));
      if (id === 'cesky' || id === 'zaklad') {
        const sada = el('div', { class: 'sada', style: styl });
        for (const c of b.znaky) {
          if (c === 0x20) continue;
          const je = ma.includes(c);
          sada.append(el('span', { class: je ? '' : 'chybi', title: (je ? '' : 'chybí: ') + P.nazevProUnicode(c), style: je ? '' : 'font-family:serif' }, String.fromCodePoint(c)));
        }
        obal.append(sada);
      }
    }
    return obal;
  }

  A.na('zmena', () => { platne = false; });
  A.na('font', () => { platne = false; });
  A.na('pohled', p => { if (p === 'nahled' && (!platne || !koren.childElementCount)) vykresli(); });
  A.nahled = { vykresli };
})();
