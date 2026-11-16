/* Meteogram pro hory a létání – jádro bez DOM (testuje _test/meteogram_test.js).
   Data: Open-Meteo (CC BY 4.0). Výšky v m n. m., teploty °C, vítr km/h, tlak hPa. */
(function (koren) {
'use strict';

const HLADINY = [1000, 950, 925, 900, 850, 800, 700, 600, 500];
const MODELY = [
  { id: 'best_match', nazev: 'Nejlepší dostupný (Open-Meteo)', dni: 7 },
  { id: 'icon_d2', nazev: 'ICON-D2 (DWD, 2 km, 2 dny)', dni: 2 },
  { id: 'icon_eu', nazev: 'ICON-EU (DWD, 7 km, 5 dní)', dni: 5 },
  { id: 'ecmwf_ifs025', nazev: 'ECMWF IFS (25 km, 7 dní)', dni: 7 },
  { id: 'gfs_seamless', nazev: 'GFS (NOAA, 7 dní)', dni: 7 }
];
const POVRCH = ['temperature_2m', 'dew_point_2m', 'apparent_temperature', 'wind_speed_10m', 'wind_direction_10m',
  'wind_gusts_10m', 'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high', 'precipitation',
  'snowfall', 'cape', 'visibility', 'freezing_level_height', 'boundary_layer_height', 'shortwave_radiation',
  'surface_pressure', 'is_day'];
const NA_HLADINE = ['temperature', 'dew_point', 'wind_speed', 'wind_direction', 'geopotential_height'];

function url(lat, lon, model) {
  const m = MODELY.find(x => x.id === model) || MODELY[0];
  const hl = [];
  for (const p of HLADINY) for (const v of NA_HLADINE) hl.push(`${v}_${p}hPa`);
  return 'https://api.open-meteo.com/v1/forecast?latitude=' + (+lat).toFixed(4) + '&longitude=' + (+lon).toFixed(4) +
    '&hourly=' + POVRCH.concat(hl).join(',') + '&models=' + m.id + '&forecast_days=' + m.dni + '&timezone=auto';
}

const cislo = v => (typeof v === 'number' && isFinite(v) ? v : null);

/* Odpověď Open-Meteo → { vyska, hodiny:[{cas, t2, td2, …, hladiny:[{p,z,t,td,ws,wd}]}] }.
   Hodiny bez teploty (model už nesahá dál) se zahodí. */
function zpracuj(json) {
  const h = (json && json.hourly) || {};
  const casy = h.time || [];
  const hodiny = [];
  const g = (k, i) => cislo((h[k] || [])[i]);
  for (let i = 0; i < casy.length; i++) {
    if (g('temperature_2m', i) === null) continue;
    const hladiny = [];
    for (const p of HLADINY) {
      const z = g(`geopotential_height_${p}hPa`, i), t = g(`temperature_${p}hPa`, i);
      if (z === null || t === null) continue;
      hladiny.push({ p, z, t, td: g(`dew_point_${p}hPa`, i), ws: g(`wind_speed_${p}hPa`, i), wd: g(`wind_direction_${p}hPa`, i) });
    }
    hodiny.push({
      cas: casy[i], t2: g('temperature_2m', i), td2: g('dew_point_2m', i), pocit: g('apparent_temperature', i),
      vitr: g('wind_speed_10m', i), smer: g('wind_direction_10m', i), naraz: g('wind_gusts_10m', i),
      obl: g('cloud_cover', i), nizka: g('cloud_cover_low', i), stredni: g('cloud_cover_mid', i), vysoka: g('cloud_cover_high', i),
      srazky: g('precipitation', i), snih: g('snowfall', i), cape: g('cape', i), vid: g('visibility', i),
      nulovaApi: g('freezing_level_height', i), blh: g('boundary_layer_height', i), slunce: g('shortwave_radiation', i),
      tlak: g('surface_pressure', i), den: g('is_day', i), hladiny
    });
  }
  return { vyska: cislo(json && json.elevation) || 0, lat: json && json.latitude, lon: json && json.longitude, hodiny };
}

/* Svislý profil od terénu nahoru: přízemní bod + hladiny nad terénem (seřazené podle výšky). */
function profil(hod, vyska) {
  const body = [{ z: vyska, t: hod.t2, td: hod.td2, ws: hod.vitr, wd: hod.smer, p: hod.tlak }];
  for (const l of hod.hladiny) if (l.z > vyska + 20) body.push(l);
  return body.sort((a, b) => a.z - b.z);
}

const GRAD_STD = 0.0065; // °C/m – standardní atmosféra pod terénem modelu

/* Teplota ve výšce z: interpolace profilu, pod terénem standardní gradient, nad nejvyšší hladinou konec profilu. */
function teplotaVeVysce(hod, vyska, z) {
  const pr = profil(hod, vyska);
  if (z <= pr[0].z) return pr[0].t + GRAD_STD * (pr[0].z - z);
  for (let i = 1; i < pr.length; i++) {
    if (z <= pr[i].z) {
      const a = pr[i - 1], b = pr[i], k = (z - a.z) / (b.z - a.z);
      return a.t + k * (b.t - a.t);
    }
  }
  return pr[pr.length - 1].t;
}

/* Vítr ve výšce z – interpolace složek u/v (aby 350° a 10° nedaly 180°). */
function vitrVeVysce(hod, vyska, z) {
  const pr = profil(hod, vyska).filter(b => b.ws !== null && b.wd !== null);
  if (!pr.length) return { ws: null, wd: null };
  const uv = b => { const r = b.wd * Math.PI / 180; return [-b.ws * Math.sin(r), -b.ws * Math.cos(r)]; };
  let u, v;
  if (z <= pr[0].z) [u, v] = uv(pr[0]);
  else if (z >= pr[pr.length - 1].z) [u, v] = uv(pr[pr.length - 1]);
  else {
    let i = 1; while (pr[i].z < z) i++;
    const a = uv(pr[i - 1]), b = uv(pr[i]), k = (z - pr[i - 1].z) / (pr[i].z - pr[i - 1].z);
    u = a[0] + k * (b[0] - a[0]); v = a[1] + k * (b[1] - a[1]);
  }
  const ws = Math.hypot(u, v);
  const wd = ws < 1e-9 ? 0 : (Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360;
  return { ws, wd };
}

/* Nulová izoterma z profilu. Při kladné teplotě u země nejnižší přechod přes 0 °C nad terénem;
   při mrazu u země nejvyšší přechod (teplá vrstva v inverzi), jinak null = mrzne už u země. */
function nulovaIzoterma(hod, vyska) {
  const pr = profil(hod, vyska);
  const prechody = [];
  for (let i = 1; i < pr.length; i++) {
    const a = pr[i - 1], b = pr[i];
    if ((a.t > 0) !== (b.t > 0)) prechody.push(a.z + (a.t / (a.t - b.t)) * (b.z - a.z));
  }
  if (pr[0].t > 0) return prechody.length ? prechody[0] : null;
  return prechody.length ? prechody[prechody.length - 1] : null;
}

/* Rosný bod (Magnus) a relativní vlhkost. */
function rosnyBod(t, rh) {
  const a = 17.62, b = 243.12, g = Math.log(rh / 100) + a * t / (b + t);
  return b * g / (a - g);
}
const tlakPar = t => 6.112 * Math.exp(17.67 * t / (t + 243.5)); // hPa
const vlhkost = (t, td) => 100 * tlakPar(td) / tlakPar(t);

/* Základna kupovité oblačnosti (Espyho vzorec, 125 m na každý °C rozdílu T − Td), m n. m. */
function zakladnaOblaku(t, td, vyska) {
  if (t === null || td === null) return null;
  return vyska + 125 * Math.max(0, t - td);
}

/* Nejnižší nasycená vrstva v profilu (T − Td ≤ 1,5 °C) – vrstevnatá oblačnost / mlha. */
function vrstvaOblaku(hod, vyska) {
  const pr = profil(hod, vyska);
  for (const b of pr) if (b.td !== null && b.t - b.td <= 1.5) return b.z;
  return null;
}

/* Pocitová teplota s větrem (wind chill, Environment Canada), platí pro T ≤ 10 °C a vítr > 4,8 km/h. */
function pocitovaTeplota(t, v) {
  if (t === null || v === null) return null;
  if (t > 10 || v <= 4.8) return t;
  const f = Math.pow(v, 0.16);
  return 13.12 + 0.6215 * t - 11.37 * f + 0.3965 * t * f;
}

/* Termika: částice od země (za slunce přehřátá o 0,5 °C) stoupá po suché adiabatě (0,98 °C/100 m), dokud není chladnější než okolí.
   Strop = min(vyrovnání, kondenzace). Síla w* (Deardorff) z odhadu citelného tepla 25 % slunečního záření. */
function termika(hod, vyska) {
  const nic = { strop: null, hloubka: 0, wstar: 0, kumuly: false, zakladna: null, gradient: null, hodnoceni: 'žádná' };
  if (hod.t2 === null) return nic;
  const zakl = zakladnaOblaku(hod.t2, hod.td2, vyska);
  let z = vyska, vyrovnani = null;
  const vrch = Math.max(...profil(hod, vyska).map(b => b.z));
  const prehrati = (hod.slunce || 0) > 50 ? 0.5 : 0; // přehřátí bubliny nad zemí za slunce
  for (z = vyska + 25; z <= vrch; z += 25) {
    const castice = hod.t2 + prehrati - 0.0098 * (z - vyska);
    if (castice < teplotaVeVysce(hod, vyska, z)) { vyrovnani = z - 25; break; }
  }
  if (vyrovnani === null) vyrovnani = vrch;
  const kumuly = zakl !== null && zakl < vyrovnani;
  const strop = kumuly ? zakl : vyrovnani;
  const hloubka = Math.max(0, strop - vyska);
  const t1 = teplotaVeVysce(hod, vyska, vyska + Math.max(hloubka, 500));
  const gradient = (hod.t2 - t1) / Math.max(hloubka, 500) * 100; // °C/100 m
  const H = 0.25 * Math.max(0, hod.slunce || 0) / (1.2 * 1005); // K·m/s
  const wstar = hloubka > 0 && H > 0 ? Math.cbrt(9.81 / (hod.t2 + 273.15) * H * hloubka) : 0;
  return { strop, hloubka, wstar, kumuly, zakladna: zakl, gradient, hodnoceni: hodnoceniTermiky(wstar, hloubka) };
}
function hodnoceniTermiky(w, d) {
  if (w < 0.6 || d < 300) return 'žádná';
  if (w < 1.2) return 'slabá';
  if (w < 2) return 'použitelná';
  if (w < 3) return 'dobrá';
  return 'silná';
}

/* Riziko bouřek podle CAPE (J/kg) – stupně 0–4. */
function rizikoBourek(cape) {
  const c = cape || 0;
  const s = c < 100 ? 0 : c < 500 ? 1 : c < 1000 ? 2 : c < 2500 ? 3 : 4;
  return { stupen: s, text: ['žádné', 'nízké', 'mírné', 'vysoké', 'velmi vysoké'][s] };
}

/* ---------- termodynamika pro emagram ---------- */
const RD = 287.04, CP = 1005.7, LV = 2.501e6, EPS = 0.622, KAPA = RD / CP;
const smesovyPomer = (t, p) => { const e = tlakPar(t); return EPS * e / (p - e); }; // kg/kg

/* Teplota na suché adiabatě: z (t0, p0) do tlaku p. */
const sucha = (t0, p0, p) => (t0 + 273.15) * Math.pow(p / p0, KAPA) - 273.15;

/* Teplota na nasycené (pseudo)adiabatě – numerická integrace po 2 hPa. */
function vlhka(t0, p0, p) {
  let t = t0 + 273.15, pp = p0;
  const krok = p < p0 ? -2 : 2;
  while ((krok < 0 && pp + krok > p) || (krok > 0 && pp + krok < p)) { t += dTdp(t, pp) * krok; pp += krok; }
  return t + dTdp(t, pp) * (p - pp) - 273.15;
}
function dTdp(tk, p) {
  const rs = smesovyPomer(tk - 273.15, p);
  return (RD * tk + LV * rs) / (CP + LV * LV * rs * EPS / (RD * tk * tk)) / p;
}

/* Kondenzační hladina (Bolton 1980): teplota (°C) a tlak (hPa). */
function lcl(t, td, p) {
  const tk = t + 273.15, tdk = td + 273.15;
  const tl = 1 / (1 / (tdk - 56) + Math.log(tk / tdk) / 800) + 56;
  return { t: tl - 273.15, p: p * Math.pow(tl / tk, 1 / KAPA) };
}

/* Křivka stoupající částice od země: [{p,t}] po 10 hPa až do pKonec. */
function krivkaCastice(t, td, p0, pKonec) {
  const k = lcl(t, td, p0), body = [];
  for (let p = p0; p >= pKonec; p -= 10) {
    body.push({ p, t: p >= k.p ? sucha(t, p0, p) : vlhka(k.t, k.p, p) });
  }
  return { body, lcl: k };
}

/* Sondáž pro emagram: hladiny nad terénem + přízemní bod. */
function sondaz(hod, vyska) {
  const p0 = hod.tlak || 1013;
  const body = [{ p: p0, z: vyska, t: hod.t2, td: hod.td2, ws: hod.vitr, wd: hod.smer, zem: true }];
  for (const l of hod.hladiny) if (l.p < p0 - 2) body.push(l);
  return body.sort((a, b) => b.p - a.p);
}

/* Inverze mezi údolím a vrcholem: teplota s výškou neklesá. Vrací °C/100 m (kladné = normální pokles). */
function gradientMezi(tDole, zDole, tNahore, zNahore) {
  if (tDole === null || tNahore === null || zNahore === zDole) return null;
  return (tDole - tNahore) / (zNahore - zDole) * 100;
}

/* Spojení dvou míst podle času (porovnání). */
function sparuj(a, b) {
  const mapa = new Map(b.hodiny.map(h => [h.cas, h]));
  return a.hodiny.filter(h => mapa.has(h.cas)).map(h => ({ cas: h.cas, a: h, b: mapa.get(h.cas) }));
}

/* Barva větru podle síly (km/h) – stupnice pro létání. */
function tridaVetru(v) {
  if (v === null) return 0;
  return v < 10 ? 0 : v < 20 ? 1 : v < 30 ? 2 : v < 45 ? 3 : 4;
}
const SMERY = ['S', 'SSV', 'SV', 'VSV', 'V', 'VJV', 'JV', 'JJV', 'J', 'JJZ', 'JZ', 'ZJZ', 'Z', 'ZSZ', 'SZ', 'SSZ'];
const smerText = d => (d === null ? '–' : SMERY[Math.round(((d % 360) + 360) % 360 / 22.5) % 16]);

/* Oblíbená místa (localStorage) – bez duplicit podle souřadnic. */
function pridejOblibene(seznam, m) {
  const k = x => (+x.lat).toFixed(3) + ',' + (+x.lon).toFixed(3);
  const out = seznam.filter(x => k(x) !== k(m));
  out.unshift({ nazev: String(m.nazev || 'Místo').slice(0, 80), lat: +m.lat, lon: +m.lon, vyska: m.vyska == null ? null : +m.vyska });
  return out.slice(0, 30);
}

const API = { HLADINY, MODELY, url, zpracuj, profil, teplotaVeVysce, vitrVeVysce, nulovaIzoterma, rosnyBod, vlhkost,
  zakladnaOblaku, vrstvaOblaku, pocitovaTeplota, termika, rizikoBourek, sucha, vlhka, lcl, krivkaCastice, sondaz,
  gradientMezi, sparuj, tridaVetru, smerText, pridejOblibene, smesovyPomer };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else koren.METEOGRAM = API;
})(typeof window !== 'undefined' ? window : globalThis);
