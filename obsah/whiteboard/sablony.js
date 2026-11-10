/* ============================================================
   whiteboard/sablony.js – předpřipravené rozvržení tabule
   WB_SABLONY.seznam = [{id, nazev, popis}], WB_SABLONY.vytvor(id, {tmave}) → objekty
   (souřadnice kolem 0,0 – aplikace je posune na střed obrazovky)
   ============================================================ */
(function () {
  'use strict';
  const J = window.WB_JADRO;
  // obsah šablony se vkládá v jazyce rozhraní (plátno samo nepřekládá – data-i18n-platno="ne")
  const P = t => (window.I18N && typeof I18N.t === 'function') ? I18N.t(t) : t;
  const ZLUTA = '#ffd93d', ZELENA = '#a5e3a9', MODRA = '#9cc7ff', RUZOVA = '#ffb3c7', ORANZOVA = '#ffc48a', FIALOVA = '#d1b3ff';

  function sablona(tmave) {
    const inkoust = tmave ? '#e0e0e0' : '#1e1e1e', ram = tmave ? '#9e9e9e' : '#5f666e';
    const id = J.noveId;
    const R = (x, y, w, h, nazev) => ({ id: id(), typ: 'ram', x, y, w, h, nazev, barva: ram, alfa: 1 });
    const L = (x, y, text, barva = ZLUTA, w = 180, h = 120) => ({ id: id(), typ: 'listek', x, y, w, h, text, velikost: 18, pismo: 'sans', barva, alfa: 1 });
    const T = (x, y, text, velikost = 28) => ({ id: id(), typ: 'text', x, y, text, velikost, pismo: 'sans', barva: inkoust, alfa: 1 });
    const V = (druh, x, y, w, h, text, vypln = null) => ({ id: id(), typ: 'tvar', druh, x, y, w, h, text, velikost: 18, pismo: 'sans', barva: inkoust, vypln, styl: 'plna', sirka: 2, alfa: 1 });
    const S = (a, b, text = '', trasa = 'prima') => ({ id: id(), typ: 'cara', x1: 0, y1: 0, x2: 0, y2: 0, zac: a.id, kon: b.id, trasa, text, velikost: 16, pismo: 'sans', sipkaK: true, sipkaZ: false, styl: 'plna', barva: inkoust, sirka: 2, alfa: 1 });
    return { R, L, T, V, S };
  }

  const SABLONY = {
    kanban: {
      nazev: 'Kanban', popis: 'Tři sloupce úkolů',
      vytvor({ R, L }) {
        const o = [];
        [['📋 ' + P('K udělání'), ZLUTA], ['⚙️ ' + P('Rozpracováno'), MODRA], ['✅ ' + P('Hotovo'), ZELENA]].forEach(([n, b], i) => {
          o.push(R(i * 320, 0, 300, 640, n));
          o.push(L(i * 320 + 20, 20, i ? '' : P('Nový úkol'), b, 260, 110));
        });
        return o;
      }
    },
    swot: {
      nazev: 'SWOT analýza', popis: 'Silné a slabé stránky, příležitosti, hrozby',
      vytvor({ V, T }) {
        const o = [T(0, -60, P('SWOT analýza'), 34)];
        [[P('Silné stránky'), ZELENA], [P('Slabé stránky'), RUZOVA], [P('Příležitosti'), MODRA], [P('Hrozby'), ORANZOVA]].forEach(([n, b], i) => {
          const s = V('zaobleny', (i % 2) * 420, Math.floor(i / 2) * 320, 400, 300, n, b);
          s.velikost = 24; s.sirka = 0;
          o.push(s);
        });
        return o;
      }
    },
    retro: {
      nazev: 'Retrospektiva', popis: 'Co šlo dobře, co zlepšit, akce',
      vytvor({ R, L }) {
        const o = [];
        [['😊 ' + P('Co šlo dobře'), ZELENA], ['🤔 ' + P('Co zlepšit'), ORANZOVA], ['🚀 ' + P('Akce'), FIALOVA]].forEach(([n, b], i) => {
          o.push(R(i * 340, 0, 320, 560, n));
          o.push(L(i * 340 + 20, 20, '', b, 280, 110));
        });
        return o;
      }
    },
    mapa: {
      nazev: 'Myšlenková mapa', popis: 'Téma uprostřed a čtyři větve',
      vytvor({ V, S }) {
        const stred = V('elipsa', -110, -60, 220, 120, P('Hlavní téma'), ZLUTA);
        stred.velikost = 22;
        const o = [stred];
        [[-420, -220, MODRA], [240, -220, ZELENA], [-420, 160, RUZOVA], [240, 160, FIALOVA]].forEach(([x, y, b], i) => {
          const v = V('zaobleny', x, y, 180, 80, P('Větev') + ' ' + (i + 1), b);
          v.sirka = 0;
          const s = S(stred, v); s.sipkaK = false;
          o.push(v, s);
        });
        return o;
      }
    },
    diagram: {
      nazev: 'Vývojový diagram', popis: 'Start, krok, rozhodnutí a konec se spojnicemi',
      vytvor({ V, S }) {
        const start = V('zaobleny', 0, 0, 180, 70, P('Start'), ZELENA);
        const krok = V('obdelnik', 0, 140, 180, 80, P('Zpracuj vstup'));
        const otazka = V('kosoctverec', -10, 290, 200, 140, P('Je hotovo?'));
        const oprava = V('obdelnik', 300, 315, 180, 90, P('Oprav'));
        const konec = V('zaobleny', 0, 500, 180, 70, P('Konec'), RUZOVA);
        const zpet = S(oprava, krok, '', 'lomena');
        return [start, krok, otazka, oprava, konec, S(start, krok), S(krok, otazka), S(otazka, konec, P('ano')), S(otazka, oprava, P('ne')), zpet];
      }
    },
    tyden: {
      nazev: 'Týdenní plán', popis: 'Sedm dní vedle sebe',
      vytvor({ R, L }) {
        const dny = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'].map(P);
        const o = [];
        dny.forEach((d, i) => {
          o.push(R(i * 230, 0, 210, 480, d));
          if (i < 5) o.push(L(i * 230 + 15, 15, '', i % 2 ? MODRA : ZLUTA, 180, 90));
        });
        return o;
      }
    },
    prezentace: {
      nazev: 'Prezentace (3 snímky)', popis: 'Tři rámy 16 : 9 pro prezentační režim a PDF',
      vytvor({ R, T }) {
        const o = [];
        ['Úvod', 'Obsah', 'Shrnutí'].map(P).forEach((n, i) => {
          o.push(R(i * 1040, 0, 960, 540, `${i + 1}. ${n}`));
          o.push(T(i * 1040 + 60, 50, n, 56));
        });
        return o;
      }
    }
  };

  window.WB_SABLONY = {
    seznam: Object.entries(SABLONY).map(([id, s]) => ({ id, nazev: s.nazev, popis: s.popis })),
    vytvor(id, { tmave = true } = {}) {
      const s = SABLONY[id];
      if (!s) return [];
      const objekty = s.vytvor(sablona(tmave));
      J.prepoj(objekty);
      return objekty;
    }
  };
})();
