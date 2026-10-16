/* Modelář 3D – šablony projektů: hotové výchozí modely z běžných těles a dílů (dají se dál upravovat).
   Každá šablona vrací dokument (bez DOM, testuje se v node: _test/modelar_sablony.js). */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';

  /** Uzel posunutý tak, aby jeho obálka měla spodek (nebo vršek) v dané výšce. */
  const naVysku = (u, z, vrch = false) => {
    const o = M.obalkaUzlu(u), d = z - (vrch ? o.max[2] : o.min[2]);
    return M.normalizujUzel(Object.assign({}, u, { poloha: [u.poloha[0], u.poloha[1], u.poloha[2] + d] }));
  };
  /** Dokument z uzlů; skupiny = pole indexů uzlů, které se seskupí (díry se odečtou). */
  function dokZ(uzly, skupiny = [], nazvy = []) {
    let d = M.pridejUzly(M.novyDokument(), uzly);
    skupiny.forEach((ix, k) => { d = M.seskupUzly(d, ix.map(i => uzly[i].id), { nazev: nazvy[k] }).dok; });
    return d;
  }

  M.SABLONY = [
    {
      id: 'elektronika', nazev: 'Krabička na elektroniku', ikona: '📟',
      popis: 'Krabička s víkem na šroubky (sloupky v rozích), otvor pro konektor v boku.',
      vytvor() {
        const [k, v] = M.uzlyKrabice({ param: { sx: 80, sy: 55, sz: 30, typ: 'sroubky', stena: 2, zaobleni: 4 }, poloha: [0, 0, 15] });
        const otvor = M.novyUzel('kvadr', { rozmer: [12, 6, 7], role: 'dira', nazev: 'Otvor pro USB',
          poloha: [k.poloha[0] - 40, k.poloha[1], 2 + 3.5 + 4], barva: '#8f99a6' });
        const uz = [k, v, otvor];
        return dokZ(uz, [[0, 2]], ['Krabička']);
      },
    },
    {
      id: 'telefon', nazev: 'Stojánek na telefon', ikona: '📱',
      popis: 'Podstava, opěrka skloněná o 20° a přední zarážka s průchodem pro kabel.',
      vytvor() {
        const zaklad = M.novyUzel('kvadr', { rozmer: [70, 80, 5], poloha: [0, 0, 2.5], param: { zaobleni: 2, segmentu: 4 } });
        const operka = M.novyUzel('kvadr', { rozmer: [70, 5, 85], poloha: [0, 12, 40], rotace: [-20, 0, 0], param: { zaobleni: 1.5, segmentu: 4 } });
        const zarazka = M.novyUzel('kvadr', { rozmer: [70, 6, 14], poloha: [0, -30, 7], param: { zaobleni: 1.5, segmentu: 4 } });
        const kabel = M.novyUzel('kvadr', { rozmer: [16, 10, 10], poloha: [0, -30, 9], role: 'dira', barva: '#8f99a6' });
        const uz = [zaklad, naVysku(operka, 0), zarazka, kabel];
        return dokZ(uz, [[0, 1, 2, 3]], ['Stojánek na telefon']);
      },
    },
    {
      id: 'jmenovka', nazev: 'Jmenovka / klíčenka', ikona: '🏷️',
      popis: 'Štítek s vystouplým jménem a očkem na kroužek – text změníš v inspektoru.',
      vytvor() {
        return dokZ([M.novyUzel('stitek', { param: { text: 'Jméno', velikost: 12, ocko: 4 }, poloha: [0, 0, 2] })]);
      },
    },
    {
      id: 'tuzky', nazev: 'Organizér na tužky', ikona: '✏️',
      popis: 'Válec s otvory pro tužky dokola a větším uprostřed, dno zůstane.',
      vytvor() {
        const telo = M.novyUzel('valec', { rozmer: [70, 70, 90], poloha: [0, 0, 45], param: { segmentu: 64, zaobleni: 2 } });
        const uz = [telo, M.novyUzel('valec', { rozmer: [22, 22, 90], poloha: [0, 0, 48], role: 'dira', barva: '#8f99a6' })];
        for (let i = 0; i < 8; i++) {
          const a = 2 * Math.PI * i / 8;
          uz.push(M.novyUzel('valec', { rozmer: [11, 11, 90], poloha: [24 * Math.cos(a), 24 * Math.sin(a), 48], role: 'dira', barva: '#8f99a6' }));
        }
        return dokZ(uz, [uz.map((_, i) => i)], ['Organizér na tužky']);
      },
    },
    {
      id: 'vesak', nazev: 'Věšák na klíče', ikona: '🔑',
      popis: 'Deska se dvěma zápustnými dírami na šrouby a čtyřmi háčky.',
      vytvor() {
        const deska = M.novyUzel('deska', { rozmer: [130, 35, 5], poloha: [0, 0, 2.5], param: { zaobleni: 5, otvor: 0 } });
        const uz = [deska];
        for (const x of [-55, 55]) {
          const d = M.novyUzel('diraSroub', { param: { velikost: 'M4', druh: 'kuzelova', delka: 5 }, poloha: [x, 0, 3] });
          uz.push(naVysku(d, 5.5, true));
        }
        for (const x of [-33, -11, 11, 33]) uz.push(naVysku(M.novyUzel('hak', { rozmer: [14, 5, 22], poloha: [x, -2, 0], rotace: [90, 0, 0] }), 4.9));
        return dokZ(uz, [uz.map((_, i) => i)], ['Věšák na klíče']);
      },
    },
    {
      id: 'podtacek', nazev: 'Podtácek', ikona: '☕',
      popis: 'Kulatý podtácek s okrajem a vzorem z kruhů – vzor jde změnit nebo smazat.',
      vytvor() {
        const dno = M.novyUzel('valec', { rozmer: [95, 95, 4], poloha: [0, 0, 2], param: { segmentu: 96 } });
        const okraj = M.novyUzel('trubka', { rozmer: [95, 95, 6], poloha: [0, 0, 3], param: { stena: 3, segmentu: 96 } });
        const uz = [dno, okraj];
        for (const r of [12, 24, 36]) uz.push(M.novyUzel('trubka', { rozmer: [2 * r, 2 * r, 1], poloha: [0, 0, 3.99 + 0.5], param: { stena: 1.2, segmentu: 96 } }));
        return dokZ(uz, [uz.map((_, i) => i)], ['Podtácek']);
      },
    },
  ];

  /** Dokument šablony podle id. */
  M.dokumentSablony = function (id) {
    const s = M.SABLONY.find(x => x.id === id);
    if (!s) throw new Error('neznámá šablona');
    return s.vytvor();
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);
