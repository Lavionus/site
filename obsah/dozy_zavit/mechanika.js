/* Dózy a víčka se závitem – výpočty (bez DOM, běží i v node).
   • objem dutiny a hmotnost prázdné / plné dózy (hmotnost dílů z objemu sítě, plný díl);
   • závit: úhel stoupání na středním průměru, kolik otáček je potřeba k zavření, samosvornost
     (tg λ < μ / cos β, β = úhel nosného boku od kolmice k ose) a poměr momentu povolení k momentu utažení.
   Součinitel tření plast–plast je orientační (PETG/PLA nasucho asi 0,2–0,4).
   spocitej(p, o, model?) → {lambda, d2, muE, samosvorny, bezpecnost, povoleni, otacek, uhelZavreni, objem, dily, hmotnost, chody[], hlaseni[]} */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const K = uzel ? require('./jadro.js') : window.DOZY;
  const fmt = K.fmt;
  const st = x => x * 180 / Math.PI;

  /** Úhel stoupání (rad) na středním průměru d2 pro dané stoupání na otáčku. */
  const stoupani = (lead, d2) => Math.atan(lead / (Math.PI * d2));

  function spocitej(p, o, model) {
    const Z = o.Z, H = [];
    const d2 = Z.d - Z.h, lambda = stoupani(Z.lead, d2);
    const muE = p.mech.mu / Math.cos(Z.bok * Math.PI / 180), ro = Math.atan(muE);
    const samosvorny = lambda < ro, bezpecnost = muE / Math.tan(lambda);
    const viko = p.druh === 'doza' || p.druh === 'vicko';
    const delka = viko ? o.zavitu : Z.L - 2 * o.nabeh;             // osová délka závitu v záběru
    const otacek = Math.max(0, delka) / Z.lead;
    const hustota = K.MATERIALY[p.tisk.material].hustota;
    const dily = model ? model.dily.map(d => ({ nazev: d.nazev, g: d.objem * hustota / 1000 })) : [];
    const hmotnost = dily.reduce((s, d) => s + d.g, 0);
    // porovnání počtu chodů při stejné rozteči
    const chody = [1, 2, 3, 4, 6].map(n => {
      const lead = Z.p * n, l = stoupani(lead, d2);
      return { n, lead, lambda: l, otacek: Math.max(0, delka) / lead, samosvorny: l < ro, bezpecnost: muE / Math.tan(l) };
    });
    if (!samosvorny) H.push({ uroven: 'varovani', pole: ['zavit.chodu', 'zavit.p'], text: `Závit není samosvorný: úhel stoupání ${fmt(st(lambda), 1)}° je větší než třecí úhel ${fmt(st(ro), 1)}° – víčko se tlakem na dno samo povolí. Uberte chody nebo stoupání.`,
      oprava: Z.db || Z.chodu < 2 ? undefined : { zmeny: { 'zavit.chodu': Math.max(1, Math.floor(Math.tan(ro) * Math.PI * d2 / Z.p / 1.5)) } } });
    else if (bezpecnost < 1.5) H.push({ uroven: 'info', pole: ['zavit.chodu'], text: `Závit je samosvorný jen těsně (rezerva ${fmt(bezpecnost, 2)}×) – při otřesech se může povolovat.` });
    return {
      d2, lambda, muE, ro, samosvorny, bezpecnost, povoleni: Math.tan(ro - lambda) / Math.tan(ro + lambda),
      delka, otacek, uhelZavreni: otacek * 360, objem: p.druh === 'doza' ? o.objem : null, dily, hmotnost, plna: p.druh === 'doza' ? hmotnost + o.objem : null,
      chody, hlaseni: H,
    };
  }

  const API = { spocitej, stoupani };
  if (uzel) module.exports = API; else window.DOZY_MECH = API;
})();
