/* ============================================================
   procvic.js – procvičovací série s psanou odpovědí.

   uloha.js řeší úlohy, kde se klepe na možnost. Řada matematických
   a jazykových cvičení ale odpověď píše, a ta dřív fungovala jinak:
   po chybě se rovnou ukázal výsledek a jelo se dál. Tenhle modul
   sjednocuje obojí — pravidla jsou stejná jako u uloha.js:

     • špatná odpověď → pole se zaklepe, zčervená a žák může zkusit znovu,
     • druhá chyba    → ukáže se správný výsledek a příklad se zapíše mezi chyby,
     • správně napoprvé → počítá se do skóre (Uloha.skore).

   Na konci série se vypíše přehled chybných příkladů a nabídne se
   „Zopakovat chyby“ — právě to dřív chybělo úplně.

   Použití:
     Procvic.spust({
       klic: 'nodus_mocniny',
       pocet: 12,
       skoreEl, plocha, odezvaEl, pokrokEl,
       generuj: rezim => ({ zadani: '5<sup>2</sup> = ?', odpoved: 25, napoveda: '5·5' }),
       rezim: () => 'mix',
       typ: 'number',                 // 'number' | 'text'
     });
   ============================================================ */
const Procvic = (function () {

  function normalizuj(v) {
    return String(v).trim().toLowerCase()
      .replace(',', '.')            // 3,5 i 3.5
      .replace(/\s+/g, ' ');
  }
  function shoda(zadano, spravne, tolerance) {
    const a = normalizuj(zadano), b = normalizuj(spravne);
    if (a === b) return true;
    const ca = Number(a), cb = Number(b);
    // číselné odpovědi porovnáváme jako čísla (0.50 === 0.5);
    // u pravděpodobností apod. se hodí povolená odchylka
    if (Number.isFinite(ca) && Number.isFinite(cb)) {
      return Math.abs(ca - cb) <= (tolerance > 0 ? tolerance : 1e-9);
    }
    return false;
  }

  function spust(volby) {
    const o = Object.assign({ pocet: 12, typ: 'number', klic: null }, volby);
    const skore = o.klic ? Uloha.skore(o.klic, o.skoreEl) : null;

    let poradi, chyby, aktualni, stav, frontaChyb = null;

    function start(opakovaneChyby) {
      poradi = 0;
      chyby = [];
      frontaChyb = opakovaneChyby || null;
      dalsi();
    }

    function celkem() { return frontaChyb ? frontaChyb.length : o.pocet; }

    function dalsi() {
      if (poradi >= celkem()) { konec(); return; }
      aktualni = frontaChyb ? frontaChyb[poradi] : o.generuj(o.rezim ? o.rezim() : null);
      stav = { chyboval: false, hotovo: false };
      vykresli();
      poradi++;
    }

    function vykresli() {
      o.plocha.innerHTML = '';
      const karta = document.createElement('div');
      karta.className = 'karta';

      const zadani = document.createElement('div');
      zadani.className = 'velky-text';
      zadani.innerHTML = aktualni.zadani;
      karta.appendChild(zadani);
      if (aktualni.obrazekHtml) {
        const obr = document.createElement('div');
        obr.className = 'zadani-obrazek';
        obr.innerHTML = aktualni.obrazekHtml;
        karta.insertBefore(obr, zadani);
      }

      o.plocha.appendChild(karta);

      const odezva = document.createElement('div');
      odezva.className = 'odezva';

      if (o.pokrokEl) o.pokrokEl.textContent = `${poradi + 1} / ${celkem()}`;

      // Některá cvičení se odpovídají klepnutím (porovnávání, výběr tvaru).
      // Pro ně použijeme rovnou Uloha.vyber, ať platí stejná pravidla.
      if (aktualni.moznosti) {
        const box = document.createElement('div');
        box.className = 'moznosti' + (aktualni.tridaMoznosti ? ' ' + aktualni.tridaMoznosti : '');
        o.plocha.appendChild(box);
        o.plocha.appendChild(odezva);
        if (aktualni.poVykresleni) aktualni.poVykresleni(karta);
        aktualni.moznosti.forEach(v => {
          const b = document.createElement('button');
          b.textContent = v;
          b.addEventListener('click', () => {
            if (stav.hotovo) return;
            const spravne = shoda(v, aktualni.odpoved, aktualni.tolerance);
            // Uloha.odpoved nastaví stav.chyboval sama, takže pokusy počítáme
            // vlastní proměnnou – jinak by se druhá šance přeskočila.
            if (!spravne) stav.pokusy = (stav.pokusy || 0) + 1;
            const posledni = stav.pokusy >= 2;
            Uloha.odpoved({
              prvek: b, spravne, stav, odezva,
              zpravaOk: '✅ Správně!',
              zpravaChyba: posledni ? vysledekText() : 'Ještě ne – zkus jinou možnost.',
              poSpravne: napoprve => { if (skore) skore.vyhodnot(napoprve); },
              dalsi,
            });
            if (!spravne && posledni) {
              stav.hotovo = true;
              chyby.push(aktualni);
              if (skore) skore.vyhodnot(false);
              box.querySelectorAll('button').forEach(x => x.disabled = true);
              setTimeout(dalsi, 1600);
            }
          });
          box.appendChild(b);
        });
        return;
      }

      const pole = document.createElement('input');
      pole.className = 'odpoved-pole';
      pole.type = o.typ === 'number' ? 'number' : 'text';
      if (o.typ === 'number') { pole.inputMode = 'decimal'; pole.step = 'any'; }
      pole.autocomplete = 'off';
      pole.setAttribute('aria-label', 'Tvoje odpověď');
      karta.appendChild(pole);
      o.plocha.appendChild(odezva);

      pole.addEventListener('keydown', e => {
        if (e.key !== 'Enter' || pole.value === '') return;
        e.preventDefault();
        vyhodnot(pole, odezva);
      });
      pole.focus();
      if (aktualni.poVykresleni) aktualni.poVykresleni(karta);
    }

    function vysledekText() {
      return `❌ Správně je ${aktualni.odpoved}.` + (aktualni.napoveda ? ` (${aktualni.napoveda})` : '');
    }

    function vyhodnot(pole, odezva) {
      if (stav.hotovo) return;
      const spravne = shoda(pole.value, aktualni.odpoved, aktualni.tolerance);
      // Uloha.odpoved nastaví stav.chyboval hned při první chybě, takže se na
      // něj nedá spolehnout při rozlišení „první pokus / druhý pokus“.
      if (!spravne) stav.pokusy = (stav.pokusy || 0) + 1;
      const posledni = stav.pokusy >= 2;
      Uloha.odpoved({
        prvek: pole,
        spravne,
        stav,
        odezva,
        zpravaOk: '✅ Správně!',
        // po první chybě dostane žák druhou šanci, teprve pak výsledek
        zpravaChyba: posledni ? vysledekText() : 'Ještě ne – zkus to znovu.',
        poSpravne: napoprve => { if (skore) skore.vyhodnot(napoprve); },
        dalsi,
      });
      if (spravne) return;
      if (!posledni) { pole.select(); return; }
      // druhá chyba: zapsat mezi chyby a po chvilce jít dál
      stav.hotovo = true;
      chyby.push(aktualni);
      if (skore) skore.vyhodnot(false);
      pole.disabled = true;
      setTimeout(dalsi, 1600);
    }

    function konec() {
      const spravne = celkem() - chyby.length;
      const pct = Math.round(spravne / celkem() * 100);
      o.plocha.innerHTML = '';
      if (o.pokrokEl) o.pokrokEl.textContent = '';

      const karta = document.createElement('div');
      karta.className = 'karta vysledky';
      karta.innerHTML =
        `<div class="emoji">${pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '💪'}</div>` +
        `<div class="velky-text">${spravne} / ${celkem()}</div>` +
        `<div class="popis">Úspěšnost ${pct} %</div>`;

      if (chyby.length) {
        const seznam = document.createElement('div');
        seznam.className = 'prehled-chyb';
        seznam.innerHTML = '<h2>Co nesedělo</h2>' + chyby.map(ch =>
          `<div class="chyba-radek"><span class="zadani-chyby">${ch.zadani}</span>` +
          `<b>${ch.odpoved}</b>${ch.napoveda ? `<span class="napoveda-chyby">${ch.napoveda}</span>` : ''}</div>`
        ).join('');
        karta.appendChild(seznam);
      } else {
        const vse = document.createElement('div');
        vse.className = 'popis';
        vse.textContent = 'Bez jediné chyby! 🎉';
        karta.appendChild(vse);
      }

      const tlacitka = document.createElement('div');
      tlacitka.className = 'konec-tlacitka';
      const znovu = document.createElement('button');
      znovu.className = 'hlavni';
      znovu.textContent = '🔄 Nová série';
      znovu.onclick = () => start(null);
      tlacitka.appendChild(znovu);
      if (chyby.length) {
        const opak = document.createElement('button');
        opak.textContent = '🔁 Zopakovat chyby';
        opak.onclick = () => start(chyby.slice());
        tlacitka.appendChild(opak);
      }
      karta.appendChild(tlacitka);
      o.plocha.appendChild(karta);
      if (o.poKonci) o.poKonci({ spravne, celkem: celkem(), chyby });
    }

    return { start, restart: () => start(null) };
  }

  return { spust, shoda };
})();
