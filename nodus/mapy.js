/* ============================================================
   mapy.js – schematické slepé mapy světadílů.

   Obrysy jsou zjednodušené: uloženy jako body [zeměpisná délka,
   zeměpisná šířka] a promítnuté válcovým (rovnoúhlým) zobrazením
   do SVG. Pro slepou mapu to stačí – žák klepe na značky, ne na
   pobřeží, a poloha značek odpovídá skutečným souřadnicím.

   Použití:
     const mapa = Mapy.svg('afrika', [{ klic:'egypt', lon:30, lat:26 }, …]);
     plocha.innerHTML = mapa;   // značky mají class „znacka" a data-klic
   ============================================================ */
const Mapy = (function () {
  const SIRKA = 460, VYSKA = 400, OKRAJ = 14;

  const KONTINENTY = {
    afrika: {
      nazev: 'Afrika',
      obrys: [[-17, 15], [-16, 12], [-13, 8], [-8, 4], [0, 5], [9, 4], [9, 0], [12, -6], [13, -12],
        [12, -17], [15, -22], [18, -29], [20, -34], [26, -34], [32, -29], [35, -24], [40, -16],
        [40, -10], [42, -2], [51, 2], [48, 12], [43, 12], [38, 18], [35, 24], [32, 31], [25, 32],
        [18, 31], [11, 33], [3, 36], [-2, 35], [-6, 36], [-10, 31], [-13, 27], [-17, 21]],
      vyrez: { lon: [-20, 54], lat: [-36, 38] },
    },
    amerika: {
      nazev: 'Amerika',
      /* Severní Amerika: obrys po směru hodinových ručiček od Aljašky */
      obrys: [[-168, 66], [-155, 71], [-125, 70], [-95, 70], [-80, 68], [-65, 60], [-55, 52],
        [-53, 47], [-64, 44], [-70, 42], [-75, 37], [-81, 25], [-90, 29], [-94, 18], [-87, 21],
        [-88, 16], [-83, 15], [-79, 9], [-85, 11], [-95, 16], [-100, 17], [-106, 23], [-110, 23],
        [-117, 32], [-122, 37], [-124, 48], [-130, 55], [-150, 60]],
      /* Jižní Amerika */
      obrys2: [[-77, 8], [-81, 0], [-81, -6], [-77, -12], [-70, -18], [-71, -30], [-73, -42],
        [-75, -52], [-67, -55], [-62, -40], [-57, -35], [-48, -25], [-40, -20], [-35, -8],
        [-44, -2], [-50, 0], [-55, 5], [-62, 10], [-72, 12]],
      vyrez: { lon: [-172, -30], lat: [-58, 74] },
    },
    asie: {
      nazev: 'Asie',
      obrys: [[60, 66], [51, 45], [45, 42], [36, 42], [26, 40], [30, 36], [35, 33], [35, 28],
        [39, 21], [43, 13], [52, 17], [57, 25], [61, 25], [67, 24], [72, 20], [76, 9], [80, 13],
        [87, 21], [94, 16], [98, 8], [104, 1], [106, 10], [108, 16], [110, 21], [117, 23],
        [121, 31], [122, 39], [126, 40], [129, 35], [128, 38], [131, 43], [135, 48], [140, 53],
        [143, 59], [155, 59], [163, 57], [162, 62], [170, 66], [180, 66], [160, 70], [140, 73],
        [110, 74], [80, 72], [68, 70]],
      vyrez: { lon: [25, 182], lat: [0, 78] },
    },
    evropa: {
      nazev: 'Evropa',
      /* pevnina bez Britských ostrovů a Apeninského poloostrova – ty jsou zvlášť */
      obrys: [[10, 55], [12, 54], [19, 55], [21, 56], [24, 60], [25, 65], [21, 64], [18, 60],
        [16, 56], [13, 55], [12, 57], [11, 59], [5, 60], [12, 65], [15, 68], [20, 70], [30, 70],
        [40, 66], [45, 68], [55, 68], [60, 66], [58, 58], [52, 52], [48, 46], [46, 42], [40, 44],
        [38, 46], [32, 45], [28, 41], [26, 38], [23, 38], [20, 40], [19, 42], [13, 45], [7, 44],
        [3, 42], [0, 39], [-2, 37], [-6, 36], [-9, 39], [-9, 43], [-1, 44], [-4, 48], [2, 51],
        [4, 52], [8, 54]],
      obrys2: [[7, 44], [10, 44], [12, 42], [15, 38], [18, 40], [14, 42], [13, 45], [11, 45]],
      obrys3: [[-5, 50], [-3, 51], [1, 51], [0, 53], [-1, 55], [-3, 58], [-5, 57], [-5, 54], [-4, 53]],
      vyrez: { lon: [-12, 62], lat: [34, 72] },
    },
    cesko: {
      nazev: 'České země',
      /* Hranice Česka – zjednodušený obrys pro školní slepou mapu */
      obrys: [[12.1, 50.3], [12.5, 50.4], [13.0, 50.5], [13.5, 50.7], [14.3, 51.05], [14.6, 51.0],
        [14.8, 50.9], [15.3, 50.8], [16.0, 50.6], [16.3, 50.65], [16.9, 50.4], [17.6, 50.2],
        [18.0, 50.0], [18.6, 49.9], [18.85, 49.5], [18.4, 49.3], [18.0, 49.0], [17.5, 48.85],
        [17.0, 48.8], [16.9, 48.7], [16.5, 48.75], [16.0, 48.75], [15.2, 48.95], [14.7, 48.6],
        [14.3, 48.55], [13.8, 48.8], [13.4, 49.0], [12.9, 49.3], [12.5, 49.6], [12.4, 49.9]],
      vyrez: { lon: [11.6, 19.3], lat: [48.2, 51.3] },
    },
    australie: {
      nazev: 'Austrálie a Oceánie',
      obrys: [[114, -22], [113, -26], [115, -34], [123, -34], [129, -32], [135, -35], [140, -38],
        [146, -39], [150, -37], [153, -28], [145, -15], [142, -11], [137, -12], [130, -11],
        [125, -14], [122, -17]],
      obrys2: [[145, -41], [148, -43], [146, -43], [144, -41]],
      obrys3: [[173, -35], [175, -37], [174, -41], [168, -45], [167, -46], [171, -42], [173, -38]],
      vyrez: { lon: [110, 180], lat: [-48, -8] },
    },
  };

  /* Svět = všechny světadíly v jednom výřezu; obrysy se berou z definic výše. */
  KONTINENTY.svet = {
    nazev: 'Svět',
    obrysy: [
      KONTINENTY.afrika.obrys,
      KONTINENTY.evropa.obrys, KONTINENTY.evropa.obrys2, KONTINENTY.evropa.obrys3,
      KONTINENTY.asie.obrys,
      KONTINENTY.amerika.obrys, KONTINENTY.amerika.obrys2,
      KONTINENTY.australie.obrys, KONTINENTY.australie.obrys2, KONTINENTY.australie.obrys3,
    ],
    vyrez: { lon: [-170, 180], lat: [-58, 76] },
  };

  function projekce(vyrez) {
    const [lon0, lon1] = vyrez.lon, [lat0, lat1] = vyrez.lat;
    /* Poledníky se k pólům sbíhají, proto stupeň zeměpisné délky zkracujeme
       kosinem střední šířky – jinak by mapa byla do šířky roztažená. */
    const zuzeni = Math.cos((lat0 + lat1) / 2 * Math.PI / 180);
    const sirkaStupnu = (lon1 - lon0) * zuzeni;
    const vyskaStupnu = lat1 - lat0;
    const m = Math.min((SIRKA - 2 * OKRAJ) / sirkaStupnu, (VYSKA - 2 * OKRAJ) / vyskaStupnu);
    const posunX = OKRAJ + ((SIRKA - 2 * OKRAJ) - sirkaStupnu * m) / 2;
    const posunY = OKRAJ + ((VYSKA - 2 * OKRAJ) - vyskaStupnu * m) / 2;
    return {
      x: lon => posunX + (lon - lon0) * zuzeni * m,
      y: lat => posunY + (lat1 - lat) * m,
    };
  }

  function cesta(body, pr) {
    return 'M' + body.map(([lon, lat]) => `${pr.x(lon).toFixed(1)} ${pr.y(lat).toFixed(1)}`).join(' L') + ' Z';
  }

  function svg(kontinent, body = [], volby = {}) {
    const k = KONTINENTY[kontinent];
    if (!k) return '';
    const pr = projekce(k.vyrez);
    const obrysy = (k.obrysy || [k.obrys, k.obrys2, k.obrys3]).filter(Boolean)
      .map(o => `<path class="pevnina" d="${cesta(o, pr)}"/>`).join('');
    const znacky = body.map(b => {
      const x = pr.x(b.lon).toFixed(1), y = pr.y(b.lat).toFixed(1);
      const popisek = volby.ukazPopisky && b.popis
        ? `<text class="popisek" x="${x}" y="${(+y - 13).toFixed(1)}">${b.popis}</text>` : '';
      return `<g class="znacka" data-klic="${b.klic}">
        <circle class="terc" cx="${x}" cy="${y}" r="11"/>
        <circle class="stred" cx="${x}" cy="${y}" r="4"/>
        ${popisek}</g>`;
    }).join('');
    return `<svg class="mapa" viewBox="0 0 ${SIRKA} ${VYSKA}">
      <rect class="ocean" x="0" y="0" width="${SIRKA}" height="${VYSKA}"/>
      ${obrysy}${volby.pred || ''}${znacky}</svg>`;
  }

  return { svg, kontinenty: () => Object.keys(KONTINENTY), nazev: k => (KONTINENTY[k] || {}).nazev };
})();
