/* Klipy na sáčky a uzávěry – výpočty (bez DOM, běží i v node).
   Nosníková teorie z pružných mechanismů (PRUZ): západka = konzola stálého průřezu (sponaRameno, silaSpony),
   živý pant = pásek ohnutý do oblouku (zivyPant). Tady navíc:
   • čelisti klipu jako dva nosníky podepřené v pantu a v západce se spojitým zatížením od svazku fólie
     (průhyb uprostřed 5qL⁴/384EI na každé rameno) – síla a napětí, když se do klipu sevře o jeden přehyb víc;
   • C-klip: průhyb poloviny profilu v místě sevření Castiglianovou větou po střednici, δ = F/(EI) · ∫ (x_p − x)² ds,
     největší moment ve hřbetu M = F · (x_p + R).
   Přetvoření se porovnává s typickými mezemi materiálu (krátkodobá / opakovaný ohyb, stav K.DATUM_MATERIALU);
   napětí = E · ε. Výtisk se liší podle vrstev, výplně a teploty – čísla jsou orientační.
   spocitej(p, o) → {mat, zapadka?, celisti?, pant?, lista?, vylevka?, cklip?, hlaseni[]} */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const K = uzel ? require('./jadro.js') : window.KLIPY;
  const PRUZ = uzel ? require('../pruzne/jadro.js') : window.PRUZ;
  const fmt = K.fmt;
  const pct = x => fmt(x * 100, 1) + ' %';
  const dolu = (x, des = 1) => Math.floor(x * 10 ** des) / 10 ** des;

  /** ∫ (x_p − x)² ds po lomené čáře (lichoběžníkem) – poddajnost konzoly libovolného tvaru zatížené silou kolmo k ose x. */
  function poddajnost(body) {
    const xp = body[0][0]; let S = 0;
    for (let i = 1; i < body.length; i++) {
      const a = body[i - 1], b = body[i], ds = Math.hypot(b[0] - a[0], b[1] - a[1]), fa = (xp - a[0]) ** 2, fb = (xp - b[0]) ** 2, fm = (xp - (a[0] + b[0]) / 2) ** 2;
      S += ds * (fa + 4 * fm + fb) / 6;
    }
    return S;
  }
  /** C-klip rozevřený o y (obě ramena dohromady) v místě sevření: síla, přetvoření ve hřbetu, tuhost. */
  function cklip(E, C, y) {
    const I = C.delka * C.t ** 3 / 12, S = poddajnost(K.stredniceCklipu(C)), rameno = C.Pp[0] + C.Rm;
    const F = y / 2 * E * I / S;
    return { F, S, I, k: E * I / S / 2, eps: F * rameno * C.t / (2 * E * I), epsNaMm: rameno * C.t / (4 * S) };
  }
  /** Dvě čelisti (nosníky délky L na dvou podporách) roztlačené uprostřed o delta spojitým zatížením. */
  function celisti(E, b, t, L, delta) {
    const I = b * t ** 3 / 12, q = delta * 384 * E * I / (10 * L ** 4);
    return { q, F: q * L, k: 384 * E * I / (10 * L ** 3), eps: q * L * L / 8 * t / (2 * E * I) };
  }

  function spocitej(p, o) {
    const H = [], mat = K.MATERIALY[p.tisk.material], E = mat.E, r = { mat, hlaseni: H };
    const mez = (eps, pole, co, oprava) => {
      if (eps > mat.epsKr) H.push({ uroven: 'chyba', pole, text: `${co}: přetvoření ${pct(eps)} je nad krátkodobou mezí ${mat.nazev} (${pct(mat.epsKr)}) – díl praskne nebo zůstane ohnutý.`, oprava });
      else if (eps > mat.epsOpak) H.push({ uroven: 'varovani', pole, text: `${co}: přetvoření ${pct(eps)} je nad mezí pro opakovaný ohyb ${mat.nazev} (${pct(mat.epsOpak)}) – vydrží jen omezený počet cyklů.` });
    };
    if (p.druh === 'klip' || p.druh === 'vzorek') {
      const q = o.K;
      // západka: konzola délky Lh, tloušťky th a šířky H ohnutá o (zub − vůle); zaklapnutí přes náběh 45°
      const z = PRUZ.sponaRameno(E, q.H, q.th, q.th, q.Lh, Math.max(0, q.pruhyb));
      r.zapadka = { pruhyb: q.pruhyb, delka: q.Lh, P: z.P, eps: z.eps, sigma: E * z.eps, zaklapnuti: PRUZ.silaSpony(z.P, mat.mu, Math.PI / 4) };
      if (q.pruhyb >= 0.3) mez(z.eps, ['klip.rameno', 'klip.hacek', 'tisk.material'], 'Západka',
        { zmeny: q.th > 0.8 + 1e-9 ? { 'klip.rameno': Math.max(0.8, dolu(q.th * 0.9 * mat.epsKr / z.eps)) } : { 'klip.hacek': Math.max(q.vz + 0.3, dolu(q.vz + q.pruhyb * 0.9 * mat.epsKr / z.eps, 2)) } });
      // čelisti: o jeden přehyb sáčku víc = svazek o tloušťku mezery silnější
      const c = celisti(E, q.H, q.T, q.xe, o.s);
      r.celisti = Object.assign({ presah: o.s, delka: q.xe, sigma: E * c.eps }, c);
      if (q.zivy) {
        const z2 = PRUZ.zivyPant(E, q.H, q.tw, q.Lw, q.alfa);
        r.pant = { eps: z2.eps, sigma: E * z2.eps, M: z2.M, sila: z2.M / q.xe, delka: q.Lw };
        mez(z2.eps, ['klip.pasek', 'klip.uhel', 'tisk.material'], 'Živý pant (zavřený klip)',
          { zmeny: q.tw > 0.3 + 1e-9 ? { 'klip.pasek': Math.max(0.3, dolu(q.tw * 0.9 * mat.epsKr / z2.eps, 2)) } : { 'klip.uhel': 10 } });
      } else r.pant = { rozevreni: q.max * 180 / Math.PI };
      if (p.tisk.material === 'TPU' && !q.zivy) H.push({ uroven: 'info', pole: ['tisk.material'], text: 'TPU je na čepový pant a západku měkké – západka drží malou silou; hodí se spíš na živý pant.' });
    }
    if (p.druh === 'lista') {
      const L = o.L;
      r.lista = { svetlost: 2 * L.ri, sterbina: L.st, pomer: L.st / (2 * L.rr), obvod: Math.PI * (2 * L.rr + o.s) };
    }
    if (p.druh === 'vylevka') {
      const V = o.V, d = p.vylevka.prumer;
      r.vylevka = { prumer: d, plocha: Math.PI * d * d / 400, zavit: V.d, sacekMin: Math.PI * (V.d + 1) / 2, otacek: V.otacek, zaber: V.zaber, vule: V.vule };
    }
    if (p.druh === 'cklip') {
      const C = o.C, y = Math.max(0, o.s - C.gp), c = cklip(E, C, y);
      r.cklip = Object.assign({ rozevreni: y, sigma: E * c.eps, naMm: c.F / C.delka, svazekMax: C.gp + mat.epsOpak / c.epsNaMm }, c);
      if (y <= 0) H.push({ uroven: 'varovani', pole: ['folie.vrstev', 'cklip.mezera'], text: `Svazek fólie ${fmt(o.s, 2)} mm není silnější než mezera čelistí ${fmt(C.gp, 2)} mm – klip nesvírá. Sáček víckrát přehněte (počet vrstev) nebo zmenšete mezeru.`,
        oprava: { zmeny: { 'folie.vrstev': Math.min(K.MEZE['folie.vrstev'][1], Math.ceil((C.gp + 0.3) / o.tf / 2) * 2) } } });
      else mez(c.eps, ['cklip.tloustka', 'cklip.rameno', 'tisk.material'], 'Hřbet C-klipu',
        { zmeny: C.t > 0.8 + 1e-9 ? { 'cklip.tloustka': Math.max(0.8, dolu(C.t * 0.9 * mat.epsKr / c.eps)) } : { 'cklip.rameno': Math.min(K.MEZE['cklip.rameno'][1], Math.ceil(C.La * 1.3)) } });
    }
    return r;
  }

  const API = { spocitej, poddajnost, cklip, celisti };
  if (uzel) module.exports = API; else window.KLIPY_MECH = API;
})();
