/* Kolečka a pojezdy – mechanika (bez DOM, běží i v node): zatížení kola, Hertzův tlak běhounu na podložce,
   kontrola ložiska (C0, C, trvanlivost, mezní otáčky) nebo kluzného uložení (p, pv), otlačení díry osy v držáku,
   namáhání osy, valivý odpor a tažná síla, doporučené stěny a výplň.
   Materiálové hodnoty jsou orientační (tištěný plast se liší podle výplně, teploty a vlhkosti) – stav 11/2026.
   spocitej(p, o) → {F, kontakt: {pmax, sirka, …}, lozisko|kluzne, drzak, odpor, tisk, hlaseni[]} */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const K = uzel ? require('./jadro.js') : window.KOLA;
  const LJ = uzel ? require('../loziska/jadro.js') : window.LoziskaJadro;
  const fmt = K.fmt, g = 9.81;
  const rad = s => s * Math.PI / 180;

  /** Materiál kola / běhounu: E (MPa), ν, pDov = orientační dovolený Hertzův tlak pro trvalé zatížení (MPa),
      alfa = hysterezní ztráta (valivý odpor), mu = tření po oceli (kluzné uložení), pv = mezní pv (MPa·m/s). */
  const MAT = {
    PETG: { E: 2100, nu: 0.38, pDov: 40, alfa: 0.06, mu: 0.25, pv: 0.06 },
    PLA: { E: 3500, nu: 0.36, pDov: 50, alfa: 0.04, mu: 0.3, pv: 0.04 },
    ASA: { E: 2000, nu: 0.37, pDov: 35, alfa: 0.06, mu: 0.3, pv: 0.05 },
    ABS: { E: 2200, nu: 0.37, pDov: 35, alfa: 0.06, mu: 0.3, pv: 0.05 },
    PA: { E: 1800, nu: 0.39, pDov: 45, alfa: 0.08, mu: 0.2, pv: 0.12 },
    PC: { E: 2300, nu: 0.37, pDov: 55, alfa: 0.05, mu: 0.3, pv: 0.06 },
    TPU: { E: 26, nu: 0.48, pDov: 8, alfa: 0.15, mu: 0.5, pv: 0.02 },
    NBR: { E: 6, nu: 0.49, pDov: 4, alfa: 0.12, mu: 0.5, pv: 0.01, nazev: 'NBR (O-kroužek)' },
  };
  /** Podložka / kolejnice: E (MPa), ν, pDov (MPa) – orientační. */
  const PODLOZKY = {
    ocel: { nazev: 'ocel (kolejnice, úhelník, trubka)', E: 210000, nu: 0.3, pDov: 600 },
    hlinik: { nazev: 'hliník (profil V-slot)', E: 70000, nu: 0.33, pDov: 150 },
    beton: { nazev: 'beton', E: 30000, nu: 0.2, pDov: 40 },
    dlazba: { nazev: 'keramická dlažba', E: 50000, nu: 0.25, pDov: 100 },
    drevo: { nazev: 'dřevo / parkety (napříč vláken)', E: 1000, nu: 0.35, pDov: 10 },
    pvc: { nazev: 'PVC / vinyl / linoleum', E: 2500, nu: 0.4, pDov: 15 },
    sklo: { nazev: 'sklo (sprchový kout)', E: 70000, nu: 0.22, pDov: 200 },
  };
  const AKTUALIZACE = '11/2026';

  const Ehv = (a, b) => 1 / ((1 - a.nu * a.nu) / a.E + (1 - b.nu * b.nu) / b.E);
  /** Čárový styk válce o poloměru R a délce L s rovinou: polovina šířky b, pmax. */
  function cara(F, R, L, Es) {
    const b = Math.sqrt(4 * F * R / (Math.PI * L * Es));
    return { b, pmax: 2 * F / (Math.PI * b * L), sirka: 2 * b, delka: L, typ: 'čárový' };
  }
  /** Bodový styk (přiblížení kruhovým stykem s Re = √(Rx·Ry)). */
  function bod(F, Rx, Ry, Es) {
    const Re = Math.sqrt(Rx * Ry), a = Math.cbrt(3 * F * Re / (4 * Es));
    return { a, pmax: 3 * F / (2 * Math.PI * a * a), sirka: 2 * a, typ: 'bodový' };
  }

  function spocitej(p, o) {
    const k = p.kolo, m = p.mech, P = o.prof, H = [];
    const F = m.hmotnost * g * m.raz / m.kol;                 // N na jedno kolo (s rázy)
    const Fs = m.hmotnost * g / m.kol;                       // N staticky
    const mk = k.profil === 'tpu' ? MAT.TPU : k.profil === 'oring' ? MAT.NBR : MAT[p.tisk.material];
    const mj = MAT[p.tisk.material];
    const pod = PODLOZKY[m.podlozka], Es = Ehv(mk, pod);
    const R = o.R;
    // ---- kontakt běhounu ----
    let c, popisK = '';
    const s2 = Math.sin(rad(k.uhel / 2));
    if (k.profil === 'plochy') { c = cara(F, R, Math.max(0.5, k.sirka - 2 * k.srazeni), Es); popisK = 'válec na rovině'; }
    else if (k.profil === 'tpu') { c = cara(F, R, Math.max(0.5, P.sirkaBehounu * 0.9), Es); popisK = 'běhoun TPU na rovině'; }
    else if (k.profil === 'korunka') { c = bod(F, R, Math.max(P.rKor, 1), Es); popisK = `korunka R ${fmt(P.rKor, 0)} mm na rovině`; }
    else if (k.profil === 'oring') { c = bod(F / k.oringu, R, k.oring / 2, Es); popisK = `${k.oringu}× O-kroužek ${fmt(k.oring, 2)} na rovině`; }
    else if (k.profil === 'vhrot' || (k.profil === 'vdrazka' && m.drazka === 'uhelnik')) {
      const N = F / (2 * s2);
      c = cara(N, P.rKontakt / s2, Math.max(0.5, P.lBok * 0.8), Es);
      c.N = N; popisK = k.profil === 'vhrot' ? 'dva boky V hrotu v drážce' : 'boky V drážky na hraně úhelníku';
    } else if (k.profil === 'vdrazka') {
      const N = F / (2 * s2);
      c = bod(N, P.rKontakt / s2, k.trubka / 2, Es); c.N = N; popisK = `boky V drážky na kulatině Ø ${fmt(k.trubka)}`;
    } else if (k.profil === 'u') {
      const rt = k.trubka / 2, Ry = 1 / Math.max(1e-4, 1 / rt - 1 / P.ru);
      c = bod(F, P.rDno, Ry, Es); popisK = `U drážka R ${fmt(P.ru, 2)} na trubce Ø ${fmt(k.trubka)}`;
    }
    c.popis = popisK;
    const pDov = Math.min(mk.pDov, pod.pDov);
    c.pDov = pDov; c.vyuziti = c.pmax / pDov;
    c.mezPodlozka = pod.pDov < mk.pDov;
    c.mat = mk;
    if (F <= 0) c.vyuziti = 0;
    // ---- valivý odpor (hystereze – Tabor) ----
    const pomer = c.b !== undefined ? 2 * mk.alfa * c.b / (3 * Math.PI * R) : 3 * mk.alfa * c.a / (16 * R);
    // ---- otáčky ----
    const n = m.rychlost > 0 ? m.rychlost * 60000 / (Math.PI * 2 * R) : 0;   // ot/min
    // ---- uložení ----
    let loz = null, kl = null, muUl = 0;
    if (p.ulozeni.typ === 'lozisko') {
      const L = o.L, Fr = F / o.pocet / 1000;   // kN na ložisko
      loz = { L, Fr: Fr * 1000, n };
      if (L.C0) { loz.s0 = L.C0 / Math.max(Fr, 1e-9); loz.C0 = L.C0; }
      if (L.C) { const t = LJ.trvanlivost({ C: L.C, P: Math.max(Fs / o.pocet / 1000, 1e-9), n, p: 3 }); loz.L10h = t && t.Lh; loz.C = L.C; }
      if (L.C) loz.nMez = LJ.mezniOtacky(L, true);
      muUl = 0.003 * (L.d + L.D) / 4 / R;   // ložisko s těsněním 2RS, μ ≈ 0,003 na středním průměru
    } else {
      const d = p.ulozeni.osa, Lk = k.sirka;
      const pk = F / (d * Lk), v = Math.PI * d * n / 60000;
      kl = { p: pk, v, pv: pk * v, pvMez: mj.pv, mu: mj.mu };
      muUl = p.ulozeni.typ === 'kluzne' ? mj.mu * d / 2 / R : 0;
    }
    const mu = pomer + muUl;
    const odpor = { pomer, muUl, mu, Fvoz: m.hmotnost * g * mu, Fkolo: Fs * mu, n };
    // ---- držák ----
    const dz = p.drzak, drz = {};
    if (dz.typ === 'vidlice' || dz.typ === 'otocna') {
      drz.otlaceni = F / (2 * o.osa * dz.tloustka);
      drz.smyk = F / (2 * Math.PI * o.osa * o.osa / 4);
    } else if (dz.typ === 'uchyt') {
      drz.otlaceni = F / (o.osa * (dz.deska + (p.excentr.pouzit ? 0 : dz.naboj)));
      const ram = dz.naboj + k.sirka / 2;
      drz.ohyb = F * ram * 32 / (Math.PI * Math.pow(o.osa, 3));
      drz.rameno = ram;
    }
    drz.pDov = mj.pDov * 0.6;   // otlačení plastu v díře (tištěné stěny)
    // ---- doporučený tisk ----
    const u = Math.max(c.vyuziti || 0, drz.otlaceni ? drz.otlaceni / drz.pDov : 0);
    const tisk = {
      steny: u < 0.3 ? 4 : u < 0.6 ? 5 : 6,
      vypln: u < 0.3 ? 30 : u < 0.6 ? 50 : 100,
      vyuziti: u,
    };
    // ---- hlášení ----
    const pole = k.profil === 'tpu' ? ['kolo.tpu', 'mech.hmotnost'] : ['kolo.sirka', 'kolo.prumer', 'mech.hmotnost'];
    if (c.vyuziti > 1) H.push({ uroven: 'varovani', pole, text: `Hertzův tlak běhounu ${fmt(c.pmax, 0)} MPa překračuje orientační mez ${fmt(pDov, 0)} MPa (${c.mezPodlozka ? pod.nazev : mk.nazev || p.tisk.material}) – kolo nebo podlaha se otlačí. Zvětšete průměr či šířku, přidejte kola nebo snižte zátěž.` });
    else if (c.vyuziti > 0.7) H.push({ uroven: 'info', pole, text: `Hertzův tlak ${fmt(c.pmax, 0)} MPa je ${fmt(c.vyuziti * 100, 0)} % orientační meze – při trvalém zatížení plast pomalu teče, tiskněte s plnou výplní.` });
    if ((k.profil === 'tpu' || k.profil === 'oring') && c.sirka > 0.15 * 2 * R) H.push({ uroven: 'info', pole: ['mech.hmotnost'], text: 'Měkký běhoun se pod zátěží výrazně zplošťuje – Hertzův výpočet je mimo platnost, berte ho jen orientačně.' });
    if (loz) {
      if (loz.s0 !== undefined && loz.s0 < 1) H.push({ uroven: 'varovani', pole: ['ulozeni.lozisko', 'ulozeni.pocet'], text: `Ložisko ${loz.L.o} je staticky přetížené (C0/P = ${fmt(loz.s0, 2)}) – zvolte větší ložisko nebo dvě.` });
      else if (loz.s0 !== undefined && loz.s0 < 2) H.push({ uroven: 'info', pole: ['ulozeni.lozisko'], text: `Ložisko ${loz.L.o}: statická bezpečnost C0/P = ${fmt(loz.s0, 2)} – pro rázy doporučeno aspoň 2.` });
      if (loz.nMez && n > loz.nMez) H.push({ uroven: 'varovani', pole: ['mech.rychlost'], text: `Kolo se točí ${fmt(n, 0)} ot/min – víc než mezní otáčky ložiska s těsněním (~${fmt(loz.nMez, 0)}).` });
      if (loz.L10h && m.zivot > 0 && loz.L10h < m.zivot) H.push({ uroven: 'info', pole: ['ulozeni.lozisko', 'mech.zivot'], text: `Trvanlivost ložiska ${fmt(loz.L10h, 0)} h je kratší než požadovaných ${fmt(m.zivot, 0)} h provozu.` });
    }
    if (kl && p.ulozeni.typ === 'kluzne') {
      if (kl.pv > kl.pvMez) H.push({ uroven: 'varovani', pole: ['mech.rychlost', 'ulozeni.typ'], text: `Kluzné uložení: pv = ${fmt(kl.pv, 3)} MPa·m/s je nad mezí ${p.tisk.material} (~${fmt(kl.pvMez, 2)}) – díra se zahřeje a vydře. Použijte ložisko.`, oprava: { zmeny: { 'ulozeni.typ': 'lozisko' }, text: 'kuličkové ložisko' } });
      if (kl.p > mj.pDov * 0.4) H.push({ uroven: 'varovani', pole: ['ulozeni.osa', 'kolo.sirka'], text: `Tlak na osu ${fmt(kl.p, 1)} MPa je na kluzné uložení v plastu vysoký – zvětšete průměr osy nebo šířku kola.` });
    }
    if (drz.otlaceni && drz.otlaceni > drz.pDov) H.push({ uroven: 'varovani', pole: dz.typ === 'uchyt' ? ['drzak.deska', 'drzak.naboj'] : ['drzak.tloustka'], text: `Díra osy v držáku se otlačí: ${fmt(drz.otlaceni, 1)} MPa při orientační mezi ${fmt(drz.pDov, 0)} MPa – zesilte ${dz.typ === 'uchyt' ? 'desku nebo náboj' : 'nohy vidlice'}.` });
    if (drz.ohyb && drz.ohyb > 200) H.push({ uroven: 'varovani', pole: ['drzak.naboj', 'ulozeni.lozisko'], text: `Osa na jedné straně je ohýbána ${fmt(drz.ohyb, 0)} MPa – víc než ~200 MPa pro šroub 8.8. Zkraťte náboj nebo zvolte silnější osu.` });
    if (k.profil === 'vhrot' || k.profil === 'vdrazka' || k.profil === 'u') H.push({ uroven: 'info', pole: ['kolo.profil'], text: 'U drážkových kol se boky odvalují na různých poloměrech – část odporu je skluz; boční síly výpočet nezahrnuje.' });
    return { F, Fs, kontakt: c, lozisko: loz, kluzne: kl, drzak: drz, odpor, tisk, hlaseni: H, podlozka: pod, n };
  }

  const API = { MAT, PODLOZKY, AKTUALIZACE, spocitej, cara, bod };
  if (uzel) module.exports = API; else window.KOLA_MECH = API;
})();
