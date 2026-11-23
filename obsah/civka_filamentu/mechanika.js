/* Držák a adaptér cívky filamentu – výpočty (bez DOM, běží i v node).
   • brzdný moment uložení cívky a síla, kterou musí extruder táhnout filament (plná / prázdná cívka):
     kluzně na trnu, na ložiskách v redukci, na stojanu (cívka se odvaluje po obvodu po ložiskách);
   • zatížení stojanu: síla na ložisko, ohyb osy (šroubu), otlačení díry v bočnici, tah v podstavě bočnice,
     síla, při které cívka z kolébky vyskočí;
   • vodítko: nárůst tahu při ohybu filamentu (Eulerův vzorec lana T₂ = T₁·e^(μθ)).
   Součinitele tření a meze plastů jsou orientační (stav 11/2026) – tištěný díl se liší podle výplně a teploty.
   spocitej(p, o) → {W, uložení: {kluzne, lozisko, stojan}, aktivni, stojan?, vodidlo, hlaseni[]} */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const K = uzel ? require('./jadro.js') : window.CIVKA;
  const fmt = K.fmt, g = 9.81;
  const rad = s => s * Math.PI / 180;

  /** Ložisko: součinitel tření vztažený k průměru díry (kuličkové, lehké zatížení), odpor těsnění 2RS (N·mm na ložisko). */
  const MU_LOZ = 0.0015, M_TESNENI = 0.8;
  /** Dovolené napětí tištěného dílu pro trvalé zatížení (MPa, orientačně, vrstvy podél tahu). */
  const DOV = { PLA: 22, PETG: 18, ASA: 16, ABS: 15, PA: 20, PC: 26 };
  /** Tření filamentu ve vodítku: tištěné očko, PTFE, kladka (ekvivalent valivého odporu ložiska). */
  const MU_VOD = { ocko: 0.3, ptfe: 0.1, kladka: 0.01 };
  /** Síla na filament, při které už extruder může prokluzovat nebo táhnout nerovnoměrně (N, orientačně). */
  const MEZ_TAHU = 3;

  /** Síla tahu filamentu (N) z brzdného momentu (N·mm) pro plnou a prázdnou cívku. */
  const tahy = (Mb, o) => ({ moment: Mb, plna: Mb / o.rPlna, prazdna: Mb / o.rPrazdna });

  function spocitej(p, o) {
    const c = p.civka, u = p.ulozeni, H = [];
    const m = c.hmotnost + c.tara, W = m * g;                    // N – plná cívka
    const L = o.L || K.lozisko(Object.assign({}, p, { ulozeni: Object.assign({}, u, { typ: 'lozisko' }) }));
    const dTrn = u.trn;
    // kluzně: cívka (redukce) se točí na trnu, tření plast–ocel
    const kluzne = tahy(p.mech.muKluz * W * dTrn / 2, o);
    // ložiska v redukcích (2 ks, každé nese půlku)
    const lozisko = tahy(MU_LOZ * W * L.d / 2 + 2 * M_TESNENI, o);
    // stojan: 4 ložiska na obvodu, úhel opory α od svislice
    const a = rad(p.stojan.uhel), N = W / (4 * Math.cos(a)), rl = L.D / 2, Rc = c.prumer / 2;
    const Mb = MU_LOZ * N * L.d / 2 + M_TESNENI;                    // moment na jednom ložisku
    const valivy = 0.05 * N / rl;                                   // valivý odpor plastového boku po kroužku (rameno ~0,05 mm)
    const stojan = tahy(4 * (Mb / rl + valivy) * Rc, o);
    stojan.N = N;
    const aktivni = p.druh === 'stojan' ? 'stojan' : u.typ === 'lozisko' ? 'lozisko' : 'kluzne';
    const vys = { W, m, kluzne, lozisko, stojan, aktivni, L, hlaseni: H };
    const tah = vys[aktivni];
    if (p.druh !== 'vodidlo' && tah.prazdna > MEZ_TAHU) H.push({ uroven: 'varovani', pole: aktivni === 'kluzne' ? ['ulozeni.typ', 'mech.muKluz'] : null,
      text: `Na konci cívky musí extruder táhnout ${fmt(tah.prazdna, 1)} N (≈ ${fmt(tah.prazdna / g * 1000, 0)} g) – může prokluzovat. ${aktivni === 'kluzne' ? 'Ložisko brzdí mnohem méně.' : ''}`.trim(),
      oprava: aktivni === 'kluzne' ? { zmeny: { 'ulozeni.typ': 'lozisko' } } : undefined });

    // ---- zatížení stojanu ----
    if (p.druh === 'stojan') {
      const s = p.stojan, d = L.d, t = o.t, dov = DOV[p.tisk.material] || 18;
      const rameno = o.krouzek + L.B / 2;                            // od bočnice ke středu ložiska
      const dk = 0.8 * d, Mo = N * rameno, sOsa = 32 * Mo / (Math.PI * dk ** 3);
      const otlaceni = N / (d * t);
      const Hs = N * Math.sin(a);                                    // vodorovná složka – roztahuje ložiska od sebe
      const hs = Math.max(1, o.hs), e = o.zl - hs / 2;
      const sPod = Hs / (hs * t) + 6 * Hs * e / (t * hs * hs);       // tah + ohyb v nejužším místě pod cívkou
      const vyskoci = W * Math.tan(a);                               // vodorovná síla v ose, při které cívka přepadne přes ložisko
      vys.stojan = Object.assign(stojan, { rameno, Mo, sOsa, otlaceni, Hs, sPod, vyskoci, dov, vyuzitiPod: sPod / dov, vyuzitiOtl: otlaceni / (1.5 * dov) });
      if (sOsa > 200) H.push({ uroven: 'chyba', pole: ['ulozeni.lozisko'], text: `Osa ložiska je ohnutá napětím ${fmt(sOsa, 0)} MPa – zvolte ložisko s větší dírou.` });
      if (sPod > dov) H.push({ uroven: 'varovani', pole: ['stojan.vule', 'stojan.tloustka'], text: `Podstava bočnice pod cívkou je namáhaná ${fmt(sPod, 1)} MPa (mez ${p.tisk.material} ≈ ${fmt(dov)} MPa) – zvyšte cívku nad stolem nebo zesilte bočnici.`,
        oprava: { zmeny: { 'stojan.tloustka': Math.min(30, Math.ceil(t * sPod / dov) + 1) } } });
      if (otlaceni > 1.5 * dov) H.push({ uroven: 'varovani', pole: ['stojan.tloustka'], text: `Díra osy v bočnici je otlačená ${fmt(otlaceni, 1)} MPa – zesilte bočnici.`, oprava: { zmeny: { 'stojan.tloustka': Math.ceil(t * otlaceni / (1.5 * dov)) + 1 } } });
      if (vyskoci < 3 * MEZ_TAHU && s.uhel < 25) H.push({ uroven: 'info', pole: ['stojan.uhel'], text: `Cívka z kolébky vyskočí už při vodorovné síle ${fmt(vyskoci, 1)} N – při zaseknutí filamentu se může zvednout.` });
    }

    // ---- vodítko: tření ve vodítku podle úhlu ohybu filamentu ----
    const v = p.vodidlo, th = rad(p.mech.ohyb);
    const pomer = typ => Math.exp(MU_VOD[typ] * th);
    vys.vodidlo = { ohyb: p.mech.ohyb, pomery: Object.fromEntries(Object.keys(MU_VOD).map(k => [k, pomer(k)])), typ: v.typ };
    if (p.druh === 'vodidlo' && v.typ === 'ocko' && p.mech.ohyb > 60) H.push({ uroven: 'info', pole: ['mech.ohyb', 'vodidlo.typ'], text: `Při ohybu ${fmt(p.mech.ohyb, 0)}° tištěné očko zvýší tah ${fmt(pomer('ocko'), 2)}× a časem se vydře – zvažte PTFE nebo kladku.` });
    return vys;
  }

  const API = { spocitej, MU_LOZ, M_TESNENI, DOV, MU_VOD, MEZ_TAHU };
  if (uzel) module.exports = API; else window.CIVKA_MECH = API;
})();
