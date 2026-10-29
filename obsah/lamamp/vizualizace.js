/* Lamamp – vizualizace v hlavním okně (WA_VIZ): spektrum 19 sloupců 3 px s padajícími vrcholky,
   osciloskop, nebo nic. Barvy z viscolor.txt skinu. Ve smyčce se nic nealokuje. */
(function () {
  'use strict';

  const SLOUPCE = 19, VYSKA = 16, SIRKA = 76;
  const REZIMY = ['spektrum', 'osciloskop', 'vyp'];

  function vytvor() {
    const sloupce = new Float32Array(SLOUPCE), vrcholy = new Float32Array(SLOUPCE), drzeni = new Float32Array(SLOUPCE);
    const rychlostVrch = new Float32Array(SLOUPCE);
    let spektrum = new Uint8Array(1024), vlna = new Uint8Array(2048), hranice = null, posledniBinu = 0;
    const body = new Int8Array(SIRKA);
    let maData = false;

    // hranice binů pro sloupce: logaritmicky 40 Hz – 16 kHz
    function spoctiHranice(nBinu, fs) {
      hranice = new Uint16Array(SLOUPCE + 1);
      for (let i = 0; i <= SLOUPCE; i++) {
        const f = 40 * Math.pow(16000 / 40, i / SLOUPCE);
        hranice[i] = Math.min(nBinu - 1, Math.max(1, Math.round(f / (fs / 2) * nBinu)));
      }
      for (let i = 1; i <= SLOUPCE; i++) if (hranice[i] <= hranice[i - 1]) hranice[i] = hranice[i - 1] + 1;
      posledniBinu = nBinu;
    }

    // jeden krok animace; dt v sekundách
    function krok(zvuk, rezim, hraje, dt) {
      maData = false;
      if (rezim === 'spektrum') {
        const n = zvuk.pocetBinu;
        if (spektrum.length !== n) spektrum = new Uint8Array(n);
        if (posledniBinu !== n || !hranice) spoctiHranice(n, zvuk.frekvenceVzorkovani);
        const ok = hraje && zvuk.spektrum(spektrum);
        for (let i = 0; i < SLOUPCE; i++) {
          let m = 0;
          if (ok) for (let b = hranice[i]; b < hranice[i + 1]; b++) if (spektrum[b] > m) m = spektrum[b];
          // byte 0..255 odpovídá rozsahu analyzátoru (−100…−30 dB); nižší úroveň potlačit, ať je klid u ticha
          const v = Math.max(0, (m - 40) / 215) * VYSKA * 1.08;
          sloupce[i] = v > sloupce[i] ? v : Math.max(0, sloupce[i] - 38 * dt);   // padání sloupců
          if (sloupce[i] >= vrcholy[i]) { vrcholy[i] = sloupce[i]; drzeni[i] = 0.35; rychlostVrch[i] = 0; }
          else if ((drzeni[i] -= dt) < 0) { rychlostVrch[i] += 40 * dt; vrcholy[i] = Math.max(0, vrcholy[i] - rychlostVrch[i] * dt); }
          if (sloupce[i] > 0.01 || vrcholy[i] > 0.01) maData = true;
        }
      } else if (rezim === 'osciloskop') {
        if (hraje && zvuk.vlna(vlna)) {
          const krokV = Math.floor(vlna.length / SIRKA);
          for (let x = 0; x < SIRKA; x++) {
            const v = (vlna[x * krokV] - 128) / 128;
            body[x] = Math.max(0, Math.min(VYSKA - 1, Math.round(VYSKA / 2 - v * VYSKA * 0.9)));
          }
          maData = true;
        }
      }
      return maData;
    }

    function kresli(g, barvy, x0, y0, rezim) {
      // podklad s mřížkou teček
      g.fillStyle = barvy[0]; g.fillRect(x0, y0, SIRKA, VYSKA);
      g.fillStyle = barvy[1];
      for (let y = 1; y < VYSKA; y += 2) for (let x = 1; x < SIRKA; x += 2) g.fillRect(x0 + x, y0 + y, 1, 1);
      if (rezim === 'spektrum') {
        for (let i = 0; i < SLOUPCE; i++) {
          const h = Math.min(VYSKA, Math.round(sloupce[i])), x = x0 + i * 4;
          // barvy po řádcích: horní řádek = barva 2, dno = barva 17
          for (let r = 0; r < h; r++) { const y = VYSKA - 1 - r; g.fillStyle = barvy[2 + y]; g.fillRect(x, y0 + y, 3, 1); }
          const p = Math.min(VYSKA - 1, Math.round(vrcholy[i]));
          if (p > 0) { g.fillStyle = barvy[23]; g.fillRect(x, y0 + VYSKA - 1 - p, 3, 1); }
        }
      } else if (rezim === 'osciloskop' && maData) {
        for (let x = 0; x < SIRKA; x++) {
          const y = body[x], pred = x ? body[x - 1] : y;
          const a = Math.min(y, pred), b = Math.max(y, pred);
          for (let yy = a; yy <= b; yy++) {
            g.fillStyle = barvy[18 + Math.min(4, Math.floor(Math.abs(yy - VYSKA / 2) / 2))];
            g.fillRect(x0 + x, y0 + yy, 1, 1);
          }
        }
      }
    }

    return { krok, kresli, get maData() { return maData; }, sloupce, vrcholy };
  }

  window.WA_VIZ = { vytvor, REZIMY, SIRKA, VYSKA };
})();
