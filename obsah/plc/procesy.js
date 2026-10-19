/* ============================================================
   plc/procesy.js – modely technologických procesů, mapování I/O, poruchy
   a simulační smyčka (bez DOM).

   Proces = { id, nazev, popis, signaly: { klic: { nazev, smer: 'vstup'|'vystup',
                druh: 'tlacitko'|'prepinac'|'cidlo'|'analog'|'aktor'|'aktorA', adr, vychozi?, jednotka?, rozsah? } },
              nastaveni, akceSeznam, vytvor(seed) → ps, krok(ps, dt_s, s), cidla(ps) → { klic: hodnota },
              proved(ps, klic), nastav?(ps, klic, h), souhrn(ps) → [text] }
   Analogové signály: surová hodnota 0–32000 odpovídá 4–20 mA (0–100 % rozsahu),
   přerušená smyčka dá −8000 (0 mA).

   Simulace drží jediný simulovaný čas: cyklus PLC proběhne v čase t = k·perioda,
   proces mezi cykly běží s výstupy posledního cyklu (krok fyziky ≤ 10 ms).
   ============================================================ */
(function () {
  'use strict';
  const PLC = typeof module !== 'undefined' ? require('./jadro.js') : window.PLC;
  const AMAX = 32000;

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const omez = (x, a, b) => Math.max(a, Math.min(b, x));
  const raw = (x, min, max) => Math.round(omez((x - min) / (max - min), 0, 1) * AMAX);
  const fmt = (x, d) => x.toFixed(d === undefined ? 1 : d).replace('.', ',');
  function zapisGraf(ps, h, krok, max) {   // krátká historie pro mini graf v animaci
    const g = ps._graf || (ps._graf = []);
    if (ps._gt === undefined || ps.cas - ps._gt >= krok - 1e-9) { g.push([ps.cas, h]); ps._gt = ps.cas; if (g.length > max) g.shift(); }
  }
  const SIG = (nazev, smer, druh, adr, dalsi) => Object.assign({ nazev, smer, druh, adr }, dalsi || {});

  /* ---------------- Dopravník s počítáním kusů ---------------- */
  const DOPRAVNIK = {
    id: 'dopravnik', nazev: 'Dopravník s počítáním kusů',
    popis: 'Pás pohání motor. Podavač při každém sepnutí posune na začátek pásu krabici, světelná závora na skluzu za koncem pásu hlásí každou krabici, která sjede do bedny.',
    signaly: {
      start: SIG('START', 'vstup', 'tlacitko', 'I0.0'), stop: SIG('STOP', 'vstup', 'tlacitko', 'I0.1'),
      zavora: SIG('Závora na skluzu', 'vstup', 'cidlo', 'I0.2'), nulovani: SIG('Nulování počtu', 'vstup', 'tlacitko', 'I0.3'),
      motor: SIG('Motor pásu', 'vystup', 'aktor', 'Q0.0'), davka: SIG('Dávka hotová', 'vystup', 'aktor', 'Q0.1'), podavac: SIG('Podavač', 'vystup', 'aktor', 'Q0.2')
    },
    nastaveni: [], akceSeznam: [{ klic: 'vysypat', nazev: 'Sundat krabice z pásu' }],
    DELKA: 8, ZAVORA: 8.35, KONEC: 8.9, SKLUZ: 1.2, RYCHLOST: 0.8, KRABICE: 0.4,
    vytvor() { return { krabice: [], cas: 0, dodano: 0, podano: 0, blokovano: 0, predPodavac: false, poziceP: 0, podavacZdvih: 0 }; },
    krok(ps, dt, s) {
      ps.cas += dt;
      const v = s.motor ? this.RYCHLOST : 0;
      ps.poziceP = (ps.poziceP + v * dt) % 1;
      for (const k of ps.krabice) k.x += (k.x > this.DELKA ? this.SKLUZ : v) * dt;
      const pred = ps.krabice.length;
      ps.krabice = ps.krabice.filter(k => k.x < this.KONEC);
      ps.dodano += pred - ps.krabice.length;
      const pod = !!s.podavac;
      if (pod && !ps.predPodavac) {
        if (ps.krabice.some(k => k.x < 0.3 + this.KRABICE + 0.15)) ps.blokovano++;
        else ps.krabice.push({ x: 0.3, id: ++ps.podano });
      }
      ps.podavacZdvih = omez(ps.podavacZdvih + (pod ? 4 : -4) * dt, 0, 1);
      ps.predPodavac = pod;
    },
    cidla(ps) { const s = this.ZAVORA, h = this.KRABICE / 2; return { zavora: ps.krabice.some(k => k.x - h <= s && k.x + h >= s) }; },
    proved(ps, klic) { if (klic === 'vysypat') ps.krabice = []; },
    souhrn(ps) { return [`Podáno krabic: ${ps.podano}`, `Spadlo do bedny: ${ps.dodano}`, `Na pásu: ${ps.krabice.length}`].concat(ps.blokovano ? [`⚠ Podavač narazil na krabici: ${ps.blokovano}×`] : []); }
  };

  /* ---------------- Semafor s přechodem pro chodce ---------------- */
  const SEMAFOR = {
    id: 'semafor', nazev: 'Semafor s přechodem pro chodce',
    popis: 'Silnice s jedním jízdním pruhem a přechodem. Tlačítko chodce přivolá zelenou pro chodce, přepínač zapíná noční režim (blikající oranžová). Auta i chodci se řídí světly; proces počítá kolize.',
    signaly: {
      tlacitko: SIG('Tlačítko chodce', 'vstup', 'tlacitko', 'I0.0'), noc: SIG('Noční režim', 'vstup', 'prepinac', 'I0.1'),
      a_cerv: SIG('Auta – červená', 'vystup', 'aktor', 'Q0.0'), a_oran: SIG('Auta – oranžová', 'vystup', 'aktor', 'Q0.1'), a_zel: SIG('Auta – zelená', 'vystup', 'aktor', 'Q0.2'),
      ch_cerv: SIG('Chodci – červená', 'vystup', 'aktor', 'Q0.3'), ch_zel: SIG('Chodci – zelená', 'vystup', 'aktor', 'Q0.4'), cekejte: SIG('Signál ČEKEJTE', 'vystup', 'aktor', 'Q0.5')
    },
    nastaveni: [{ klic: 'hustota', nazev: 'Hustota provozu', min: 0, max: 3, krok: 1, vychozi: 2, popisky: ['žádná', 'řídká', 'střední', 'hustá'] }],
    akceSeznam: [{ klic: 'chodec', nazev: 'Přivést chodce (bez stisku tlačítka)' }],
    DELKA: 70, STOP: 30, PRECHOD_OD: 31, PRECHOD_DO: 35, VMAX: 11, AUTO: 4.2, MEZERA: 2.2, SIRKA: 7,
    vytvor(seed) {
      return { r: rng(seed || 7), auta: [], chodci: [], cas: 0, dalsiAuto: 1, projelo: 0, konflikty: 0, naCervenou: 0, zlutaZap: [], predZluta: false,
        predTlacitko: false, hustota: 2, prevedeno: 0, idA: 0, konfliktNyni: false, kolizniSignaly: 0, kolizeNyni: false };
    },
    signalAut(ps, s) {
      const cervena = !!s.a_cerv, zluta = !!s.a_oran, zelena = !!s.a_zel;
      const blika = zluta && !cervena && !zelena && ps.zlutaZap.filter(t => ps.cas - t < 2.6).length >= 2;
      if (blika) return 'blika';
      if (!cervena && !zluta && !zelena) return 'vypnuto';
      if (zelena && !cervena && !zluta) return 'volno';
      if (zluta && !cervena && !zelena) return 'zluta';
      return 'stuj';
    },
    krok(ps, dt, s) {
      ps.cas += dt;
      const zl = !!s.a_oran;
      if (zl && !ps.predZluta) { ps.zlutaZap.push(ps.cas); if (ps.zlutaZap.length > 6) ps.zlutaZap.shift(); }
      ps.predZluta = zl;
      const sig = this.signalAut(ps, s);
      const intervaly = [Infinity, 7, 3.6, 2.2];
      if (ps.hustota > 0) {
        ps.dalsiAuto -= dt;
        if (ps.dalsiAuto <= 0) {
          const posl = ps.auta[ps.auta.length - 1];
          if (!posl || posl.x - this.AUTO > -6 + this.MEZERA + 1) ps.auta.push({ x: -6, v: this.VMAX * 0.8, id: ++ps.idA, barva: Math.floor(ps.r() * 5) });
          ps.dalsiAuto = intervaly[ps.hustota] * (0.6 + ps.r() * 0.8);
        }
      }
      const BRZDA = 6, ZRYCH = 3;
      const naPrechodu = ps.chodci.some(c => c.stav === 'jde');
      for (let i = 0; i < ps.auta.length; i++) {
        const a = ps.auta[i];
        let limit = Infinity;
        if (a.x <= this.STOP + 0.05) {
          if (sig === 'stuj') limit = this.STOP;
          else if (sig === 'zluta') { const dBrzd = a.v * a.v / (2 * BRZDA); if (this.STOP - a.x > dBrzd * 0.9) limit = this.STOP; }
        }
        if (naPrechodu && a.x <= this.PRECHOD_OD - 0.3) limit = Math.min(limit, this.PRECHOD_OD - 0.5);
        if (i > 0) limit = Math.min(limit, ps.auta[i - 1].x - this.AUTO - this.MEZERA);
        const cilV = Math.min(this.VMAX, Math.sqrt(2 * BRZDA * Math.max(0, limit - a.x)));
        if (a.v < cilV) a.v = Math.min(cilV, a.v + ZRYCH * dt); else a.v = cilV;
        const predX = a.x;
        a.x = Math.min(a.x + a.v * dt, limit === Infinity ? Infinity : Math.max(a.x, limit));
        if (predX <= this.STOP && a.x > this.STOP && sig === 'stuj') ps.naCervenou++;
      }
      const pred = ps.auta.length;
      ps.auta = ps.auta.filter(a => a.x - this.AUTO < this.DELKA + 2);
      ps.projelo += pred - ps.auta.length;
      const tl = !!s.tlacitko;
      if (tl && !ps.predTlacitko) this.proved(ps, 'chodec');
      ps.predTlacitko = tl;
      const zelenaCh = !!s.ch_zel && !s.ch_cerv;
      for (const c of ps.chodci) {
        if (c.stav === 'ceka' && zelenaCh) c.stav = 'jde';
        if (c.stav === 'jde') { c.y += 1.4 * dt; if (c.y >= this.SIRKA + 1.2) { c.stav = 'pres'; ps.prevedeno++; } }
      }
      ps.chodci = ps.chodci.filter(c => c.stav !== 'pres');
      const autoNaPrechodu = ps.auta.some(a => a.x > this.PRECHOD_OD && a.x - this.AUTO < this.PRECHOD_DO);
      const chodecNaVozovce = ps.chodci.some(c => c.stav === 'jde' && c.y > 0 && c.y < this.SIRKA);
      const konflikt = autoNaPrechodu && chodecNaVozovce;
      if (konflikt && !ps.konfliktNyni) ps.konflikty++;
      ps.konfliktNyni = konflikt;
      const kol = !!s.a_zel && !!s.ch_zel;
      if (kol && !ps.kolizeNyni) ps.kolizniSignaly++;
      ps.kolizeNyni = kol;
    },
    cidla() { return {}; },
    proved(ps, klic) {
      if (klic === 'chodec' && ps.chodci.filter(c => c.stav === 'ceka').length < 5)
        ps.chodci.push({ stav: 'ceka', y: -0.6, x: this.PRECHOD_OD + 0.8 + (ps.chodci.length % 3) * 1.1 });
    },
    nastav(ps, klic, h) { if (klic === 'hustota') ps.hustota = omez(Math.round(h), 0, 3); },
    souhrn(ps) {
      return [`Projelo aut: ${ps.projelo}`, `Převedeno chodců: ${ps.prevedeno}`, `Čeká chodců: ${ps.chodci.filter(c => c.stav === 'ceka').length}`]
        .concat(ps.kolizniSignaly ? [`⚠ Zelená autům i chodcům současně: ${ps.kolizniSignaly}×`] : [])
        .concat(ps.konflikty ? [`⚠ Konflikt auto × chodec: ${ps.konflikty}×`] : []);
    }
  };

  /* ---------------- Čerpací jímka ---------------- */
  const NADRZ = {
    id: 'nadrz', nazev: 'Čerpací jímka se dvěma čerpadly',
    popis: 'Do jímky (400 l) teče nastavitelný přítok. Plováky: MIN nad 20 %, MAX nad 75 %, havarijní nad 90 %; spojitý hladinoměr na IW0. Každé čerpadlo odčerpá 40 l/s; tepelná ochrana čerpadla ho odpojí.',
    signaly: {
      plov_min: SIG('Plovák MIN (20 %)', 'vstup', 'cidlo', 'I0.0'), plov_max: SIG('Plovák MAX (75 %)', 'vstup', 'cidlo', 'I0.1'),
      plov_hav: SIG('Havarijní plovák (90 %)', 'vstup', 'cidlo', 'I0.2'), auto: SIG('Režim AUTO', 'vstup', 'prepinac', 'I0.3', { vychozi: true }),
      rucne: SIG('Ruční čerpání', 'vstup', 'tlacitko', 'I0.4'), kvitace: SIG('Kvitace alarmu', 'vstup', 'tlacitko', 'I0.5'),
      tepl1: SIG('Tepelná ochrana čerp. 1', 'vstup', 'prepinac', 'I0.6'), tepl2: SIG('Tepelná ochrana čerp. 2', 'vstup', 'prepinac', 'I0.7'),
      hladina: SIG('Hladinoměr 0–100 %', 'vstup', 'analog', 'IW0', { jednotka: '%', rozsah: [0, 100] }),
      cerpadlo1: SIG('Čerpadlo 1', 'vystup', 'aktor', 'Q0.0'), cerpadlo2: SIG('Čerpadlo 2 (záložní)', 'vystup', 'aktor', 'Q0.1'), majak: SIG('Alarm – maják', 'vystup', 'aktor', 'Q0.2')
    },
    nastaveni: [{ klic: 'pritok', nazev: 'Přítok', min: 0, max: 70, krok: 1, vychozi: 25, jednotka: 'l/s' }],
    akceSeznam: [{ klic: 'privalova', nazev: 'Přívalový déšť (+45 l/s na 12 s)' }],
    OBJEM: 400, CERPADLO: 40, MIN: 0.20, MAX: 0.75, HAV: 0.90,
    vytvor() { return { V: 180, pritok: 25, cas: 0, preteklo: 0, nasucho: 0, privalDo: -1, otacky: [0, 0], odcerpano: 0, starty: [0, 0], pred: [false, false] }; },
    krok(ps, dt, s) {
      ps.cas += dt;
      let V = ps.V + (ps.pritok + (ps.cas < ps.privalDo ? 45 : 0)) * dt;
      const c = [!!s.cerpadlo1 && !s.tepl1, !!s.cerpadlo2 && !s.tepl2];
      for (let i = 0; i < 2; i++) {
        if (c[i] && !ps.pred[i]) ps.starty[i]++;
        ps.pred[i] = c[i];
        ps.otacky[i] = omez(ps.otacky[i] + (c[i] ? 3 : -2) * dt, 0, 1);
        const odcerp = Math.min(this.CERPADLO * ps.otacky[i] * dt, Math.max(0, V));
        if (c[i] && V <= 0.5) ps.nasucho += dt;
        V -= odcerp; ps.odcerpano += odcerp;
      }
      if (V > this.OBJEM) { ps.preteklo += V - this.OBJEM; V = this.OBJEM; }
      ps.V = Math.max(0, V);
    },
    hladina(ps) { return ps.V / this.OBJEM; },
    cidla(ps) {
      const h = this.hladina(ps);
      return { plov_min: h >= this.MIN, plov_max: h >= this.MAX, plov_hav: h >= this.HAV, hladina: raw(h, 0, 1) };
    },
    proved(ps, klic) { if (klic === 'privalova') ps.privalDo = ps.cas + 12; },
    nastav(ps, klic, h) { if (klic === 'pritok') ps.pritok = omez(+h, 0, 200); },
    souhrn(ps) {
      const r = [`Hladina: ${(this.hladina(ps) * 100).toFixed(0)} % (${Math.round(ps.V)} l)`, `Přítok: ${ps.pritok + (ps.cas < ps.privalDo ? 45 : 0)} l/s`, `Starty čerpadel: ${ps.starty[0]} / ${ps.starty[1]}`];
      if (ps.preteklo > 0.5) r.push(`⚠ Přeteklo: ${Math.round(ps.preteklo)} l`);
      if (ps.nasucho > 0.05) r.push(`⚠ Čerpadlo běželo nasucho: ${fmt(ps.nasucho)} s`);
      return r;
    }
  };

  /* ---------------- Reverzace motoru ---------------- */
  const MOTOR = {
    id: 'motor', nazev: 'Reverzace motoru se vzájemným blokováním',
    popis: 'Asynchronní motor spínají dva stykače: K1 vpřed a K2 vzad (prohazuje L1 a L3). Sepnutí obou najednou je mezifázový zkrat – vypne jistič. Přepnutí směru za chodu způsobí protiproudý ráz. Otáčky měří snímač na IW0.',
    signaly: {
      vpred: SIG('VPŘED', 'vstup', 'tlacitko', 'I0.0'), vzad: SIG('VZAD', 'vstup', 'tlacitko', 'I0.1'), stop: SIG('STOP', 'vstup', 'tlacitko', 'I0.2'),
      tepl: SIG('Tepelná ochrana – porucha', 'vstup', 'prepinac', 'I0.3'),
      otacky: SIG('Snímač otáček 0–1500 min⁻¹', 'vstup', 'analog', 'IW0', { jednotka: 'min⁻¹', rozsah: [0, 1500] }),
      k1: SIG('Stykač K1 – vpřed', 'vystup', 'aktor', 'Q0.0'), k2: SIG('Stykač K2 – vzad', 'vystup', 'aktor', 'Q0.1'), porucha: SIG('Kontrolka PORUCHA', 'vystup', 'aktor', 'Q0.2')
    },
    nastaveni: [], akceSeznam: [{ klic: 'jistic', nazev: 'Zapnout jistič' }],
    NMAX: 1450,
    vytvor() { return { n: 0, uhel: 0, cas: 0, jistic: true, zkraty: 0, razy: 0, pred: [false, false], posledniRaz: -10 }; },
    krok(ps, dt, s) {
      ps.cas += dt;
      const k1 = !!s.k1, k2 = !!s.k2;
      if (k1 && k2 && ps.jistic) { ps.jistic = false; ps.zkraty++; }
      const nap1 = k1 && ps.jistic && !s.tepl, nap2 = k2 && ps.jistic && !s.tepl;
      if ((nap1 && !ps.pred[0] && ps.n < -150) || (nap2 && !ps.pred[1] && ps.n > 150)) { ps.razy++; ps.posledniRaz = ps.cas; }
      ps.pred = [nap1, nap2];
      if (nap1 && !nap2) ps.n += (this.NMAX - ps.n) / 0.5 * dt;
      else if (nap2 && !nap1) ps.n += (-this.NMAX - ps.n) / 0.5 * dt;
      else { const d = 700 * dt; ps.n = Math.abs(ps.n) <= d ? 0 : ps.n - Math.sign(ps.n) * d; }
      ps.uhel = (ps.uhel + ps.n / 60 * 2 * Math.PI * dt * 0.05) % (2 * Math.PI);
    },
    cidla(ps) { return { otacky: raw(Math.abs(ps.n), 0, 1500) }; },
    proved(ps, klic) { if (klic === 'jistic') ps.jistic = true; },
    souhrn(ps) {
      const r = [`Otáčky: ${Math.round(ps.n)} min⁻¹`, `Jistič: ${ps.jistic ? 'zapnutý' : 'VYPNUTÝ'}`];
      if (ps.zkraty) r.push(`⚠ Zkrat (K1 i K2 sepnuty): ${ps.zkraty}×`);
      if (ps.razy) r.push(`⚠ Protiproudý ráz (reverzace za chodu): ${ps.razy}×`);
      return r;
    }
  };

  /* ---------------- Míchací nádrž s ohřevem (analog + PID) ---------------- */
  const MICHANI = {
    id: 'michani', nazev: 'Míchací nádrž s ohřevem (PID)',
    popis: 'Zmenšený model ohřívací nádrže 10 l: přítokový ventil 0,5 l/s (voda 15 °C), vypouštěcí ventil, míchadlo a topné těleso 20 kW řízené analogově (QW0, 0–100 %). Těleso má tepelnou setrvačnost 5 s, čidlo teploty bez míchání reaguje se zpožděním 12 s, s mícháním 2 s. Ohřev pod 10 % hladiny = topení nasucho.',
    signaly: {
      start: SIG('START dávky', 'vstup', 'tlacitko', 'I0.0'), stop: SIG('STOP', 'vstup', 'tlacitko', 'I0.1'),
      hlad_min: SIG('Hladinový spínač 10 %', 'vstup', 'cidlo', 'I0.2'),
      hladina: SIG('Hladinoměr 0–100 %', 'vstup', 'analog', 'IW0', { jednotka: '%', rozsah: [0, 100] }),
      teplota: SIG('Teploměr 0–100 °C', 'vstup', 'analog', 'IW1', { jednotka: '°C', rozsah: [0, 100] }),
      pritok: SIG('Ventil přítoku', 'vystup', 'aktor', 'Q0.0'), vypust: SIG('Ventil vypouštění', 'vystup', 'aktor', 'Q0.1'),
      michadlo: SIG('Míchadlo', 'vystup', 'aktor', 'Q0.2'), hotovo: SIG('Kontrolka HOTOVO', 'vystup', 'aktor', 'Q0.3'), alarm: SIG('Alarm', 'vystup', 'aktor', 'Q0.4'),
      topeni: SIG('Topení 0–100 %', 'vystup', 'aktorA', 'QW0', { jednotka: '%', rozsah: [0, 100] })
    },
    nastaveni: [], akceSeznam: [{ klic: 'ochladit', nazev: 'Přilít studenou vodu (−10 °C)' }],
    OBJEM: 10, QIN: 0.5, QOUT: 0.6, PMAX: 20000, UA: 60, TAMB: 20, TIN: 15,
    vytvor() { return { V: 0, T: 20, Tm: 20, Ph: 0, cas: 0, preteklo: 0, nasucho: 0, varu: 0, energie: 0, uhel: 0 }; },
    krok(ps, dt, s) {
      ps.cas += dt;
      const qin = s.pritok ? this.QIN : 0;
      const h = ps.V / this.OBJEM;
      const qout = s.vypust ? Math.min(ps.V / dt, this.QOUT * Math.sqrt(Math.max(0, h))) : 0;
      const Pcmd = omez((+s.topeni || 0) / AMAX, 0, 1);
      ps.Ph += (Pcmd - ps.Ph) * Math.min(1, dt / 5);
      const ucinnost = omez(h / 0.1, 0, 1);
      if (ps.Ph > 0.05 && h < 0.1) ps.nasucho += dt;
      const m = Math.max(ps.V, 0.2);
      const Pvoda = ps.Ph * this.PMAX * ucinnost;
      ps.energie += ps.Ph * this.PMAX * dt / 3.6e6;
      let dT = (Pvoda - this.UA * (ps.T - this.TAMB)) / (m * 4186) + qin * (this.TIN - ps.T) / m;
      ps.T = Math.min(100, ps.T + dT * dt);
      if (ps.T >= 99.9) ps.varu += dt;
      ps.V += (qin - qout) * dt;
      if (ps.V > this.OBJEM) { ps.preteklo += ps.V - this.OBJEM; ps.V = this.OBJEM; }
      ps.V = Math.max(0, ps.V);
      const tau = s.michadlo ? 2 : 12;
      ps.Tm += (ps.T - ps.Tm) * Math.min(1, dt / tau);
      if (s.michadlo) ps.uhel = (ps.uhel + dt * 6) % (Math.PI * 2);
      zapisGraf(ps, ps.T, 0.25, 260);
    },
    hladina(ps) { return ps.V / this.OBJEM; },
    cidla(ps) { const h = this.hladina(ps); return { hlad_min: h >= 0.1, hladina: raw(h, 0, 1), teplota: raw(ps.Tm, 0, 100) }; },
    proved(ps, klic) { if (klic === 'ochladit') ps.T = Math.max(this.TIN, ps.T - 10); },
    souhrn(ps) {
      const r = [`Hladina: ${fmt(this.hladina(ps) * 100, 0)} % (${fmt(ps.V)} l)`, `Teplota vody: ${fmt(ps.T)} °C (čidlo ${fmt(ps.Tm)} °C)`, `Topení: ${fmt(ps.Ph * this.PMAX / 1000)} kW`, `Spotřeba: ${fmt(ps.energie, 3)} kWh`];
      if (ps.nasucho > 0.05) r.push(`⚠ Topení nasucho: ${fmt(ps.nasucho)} s`);
      if (ps.preteklo > 0.01) r.push(`⚠ Přeteklo: ${fmt(ps.preteklo, 2)} l`);
      if (ps.varu > 0) r.push('⚠ Voda vře!');
      return r;
    }
  };

  /* ---------------- Rozběh hvězda–trojúhelník ---------------- */
  const HVEZDA = {
    id: 'hvezda', nazev: 'Rozběh motoru hvězda–trojúhelník',
    popis: 'Motor 11 kW (jmenovitý proud 20 A). K1 připojí začátky vinutí na síť, K2 spojí konce do hvězdy, K3 je připojí do trojúhelníku. Ve hvězdě je proud i moment třetinový. K2 a K3 zároveň = zkrat. Proud měří převodník na IW0 (0–200 A).',
    signaly: {
      start: SIG('START', 'vstup', 'tlacitko', 'I0.0'), stop: SIG('STOP', 'vstup', 'tlacitko', 'I0.1'), tepl: SIG('Tepelné relé – porucha', 'vstup', 'prepinac', 'I0.2'),
      proud: SIG('Převodník proudu 0–200 A', 'vstup', 'analog', 'IW0', { jednotka: 'A', rozsah: [0, 200] }),
      k1: SIG('K1 – síťový stykač', 'vystup', 'aktor', 'Q0.0'), k2: SIG('K2 – hvězda', 'vystup', 'aktor', 'Q0.1'), k3: SIG('K3 – trojúhelník', 'vystup', 'aktor', 'Q0.2'),
      porucha: SIG('Kontrolka PORUCHA', 'vystup', 'aktor', 'Q0.3')
    },
    nastaveni: [], akceSeznam: [{ klic: 'jistic', nazev: 'Zapnout jistič' }],
    IN: 20,
    vytvor() { return { w: 0, I: 0, Imax: 0, cas: 0, jistic: true, zkraty: 0, rezim: 'stojí', predRezim: 'stojí', tTroj: -10, spicka: 0, spickaPrimy: 0, uhel: 0 }; },
    proudD(w) { return this.IN * (0.35 + 6 * Math.pow(Math.max(0, 1 - w), 0.6)); },
    krok(ps, dt, s) {
      ps.cas += dt;
      if (s.k2 && s.k3 && ps.jistic) { ps.jistic = false; ps.zkraty++; }
      const nap = ps.jistic && s.k1 && !s.tepl;
      const hv = nap && s.k2 && !s.k3, tr = nap && s.k3 && !s.k2;
      if (hv) { ps.w += (0.93 - ps.w) / 2.2 * dt; ps.I = this.proudD(ps.w) / 3; ps.rezim = 'hvězda'; }
      else if (tr) { ps.w += (0.985 - ps.w) / 0.7 * dt; ps.I = this.proudD(ps.w); ps.rezim = 'trojúhelník'; }
      else { ps.w = Math.max(0, ps.w - 0.25 * dt); ps.I = 0; ps.rezim = ps.w > 0 ? 'doběh' : 'stojí'; }
      if (ps.rezim === 'trojúhelník' && ps.predRezim !== 'trojúhelník') { ps.tTroj = ps.cas; ps.spicka = 0; ps.wPrepnuti = ps.w; }
      if (ps.rezim === 'trojúhelník' && ps.cas - ps.tTroj < 0.6) ps.spicka = Math.max(ps.spicka, ps.I);
      ps.predRezim = ps.rezim;
      ps.Imax = Math.max(ps.Imax, ps.I);
      ps.uhel = (ps.uhel + ps.w * dt * 8) % (Math.PI * 2);
      zapisGraf(ps, ps.I, 0.05, 220);
    },
    cidla(ps) { return { proud: raw(ps.I, 0, 200) }; },
    proved(ps, klic) { if (klic === 'jistic') ps.jistic = true; },
    souhrn(ps) {
      const r = [`Otáčky: ${fmt(ps.w * 100, 0)} %`, `Proud: ${fmt(ps.I, 0)} A`, `Zapojení: ${ps.rezim}`, `Max. proud: ${fmt(ps.Imax, 0)} A`];
      if (ps.spicka) r.push(`Špička po přepnutí na Δ: ${fmt(ps.spicka, 0)} A (při ${fmt((ps.wPrepnuti || 0) * 100, 0)} % otáček)`);
      if (ps.zkraty) r.push(`⚠ Zkrat (K2 i K3 sepnuty): ${ps.zkraty}×`);
      if (!ps.jistic) r.push('⚠ Jistič vypnut');
      return r;
    }
  };

  /* ---------------- Garážová vrata ---------------- */
  const VRATA = {
    id: 'vrata', nazev: 'Garážová vrata se světelnou závorou',
    popis: 'Výsuvná vrata (pojezd 10 s) s motorem pro oba směry, koncovými spínači a bezpečnostní světelnou závorou zapojenou rozpínacím kontaktem (1 = volno, přerušený vodič = překážka). Proces počítá nárazy do překážky a chod motoru proti dorazu.',
    signaly: {
      tlacitko: SIG('Tlačítko (impulzní)', 'vstup', 'tlacitko', 'I0.0'), nahore: SIG('Koncový spínač NAHOŘE', 'vstup', 'cidlo', 'I0.1'),
      dole: SIG('Koncový spínač DOLE', 'vstup', 'cidlo', 'I0.2'), zavora: SIG('Světelná závora (1 = volno)', 'vstup', 'cidlo', 'I0.3'),
      nahoru: SIG('Motor NAHORU', 'vystup', 'aktor', 'Q0.0'), dolu: SIG('Motor DOLŮ', 'vystup', 'aktor', 'Q0.1'), majak: SIG('Výstražný maják', 'vystup', 'aktor', 'Q0.2')
    },
    nastaveni: [], akceSeznam: [{ klic: 'prekazka', nazev: 'Auto ve vratech (zapnout/vypnout)' }],
    RYCHLOST: 0.1, VYSKA_PREKAZKY: 0.3,
    vytvor() { return { x: 0, prekazka: false, narazy: 0, dorazy: 0, zkraty: 0, cas: 0, tlak: 0, naraz: false, dorazNyni: false, oba: false }; },
    krok(ps, dt, s) {
      ps.cas += dt;
      const up = !!s.nahoru, dn = !!s.dolu;
      if (up && dn) { if (!ps.oba) ps.zkraty++; ps.oba = true; return; }
      ps.oba = false;
      let tlaci = false;
      if (up) { ps.x += this.RYCHLOST * dt; if (ps.x >= 1) { ps.x = 1; tlaci = true; } }
      if (dn) {
        const spodek = ps.prekazka ? this.VYSKA_PREKAZKY : 0;
        ps.x -= this.RYCHLOST * dt;
        if (ps.x <= spodek) {
          if (ps.prekazka && !ps.naraz) ps.narazy++;
          ps.naraz = ps.prekazka; ps.x = spodek; tlaci = true;
        }
      } else ps.naraz = false;
      ps.tlak = tlaci ? ps.tlak + dt : 0;
      const doraz = ps.tlak > 1;
      if (doraz && !ps.dorazNyni) ps.dorazy++;
      ps.dorazNyni = doraz;
    },
    cidla(ps) { return { nahore: ps.x >= 0.995, dole: ps.x <= 0.005, zavora: !ps.prekazka }; },
    proved(ps, klic) { if (klic === 'prekazka') ps.prekazka = !ps.prekazka; },
    souhrn(ps) {
      const r = [`Otevřeno: ${fmt(ps.x * 100, 0)} %`, `Překážka: ${ps.prekazka ? 'ano' : 'ne'}`];
      if (ps.narazy) r.push(`⚠ Náraz vrat do překážky: ${ps.narazy}×`);
      if (ps.dorazy) r.push(`⚠ Motor tlačil proti dorazu > 1 s: ${ps.dorazy}×`);
      if (ps.zkraty) r.push(`⚠ Oba směry současně: ${ps.zkraty}×`);
      return r;
    }
  };

  const ZADNY = {
    id: 'zadny', nazev: 'Bez technologie (jen vstupy a výstupy)', popis: 'Vstupy ovládáte ručně (tlačítka, spínače, posuvníky analogových vstupů), výstupy sledujete na kontrolkách.',
    signaly: {}, nastaveni: [], akceSeznam: [],
    vytvor() { return {}; }, krok() {}, cidla() { return {}; }, proved() {}, souhrn() { return []; }
  };

  const PROCESY = { zadny: ZADNY, dopravnik: DOPRAVNIK, semafor: SEMAFOR, nadrz: NADRZ, motor: MOTOR, michani: MICHANI, hvezda: HVEZDA, vrata: VRATA };
  const PORUCHY = { stuck0: 'zaseknuto na 0', stuck1: 'zaseknuto na 1', vodic: 'přerušený vodič' };

  /* ---------------- mapování a poruchy ---------------- */
  function mapa(sim) {
    const m = {};
    for (const [k, s] of Object.entries(sim.model.signaly)) {
      const u = sim.projekt.mapovani && sim.projekt.mapovani[k];
      m[k] = u || s.adr;
    }
    return m;
  }
  function analogovy(def) { return def.druh === 'analog' || def.druh === 'aktorA'; }
  function sPoruchou(sim, k, def, h) {
    const p = sim.poruchy[k];
    if (!p) return h;
    if (analogovy(def)) return p === 'stuck0' ? 0 : p === 'stuck1' ? AMAX : (def.smer === 'vstup' ? PLC.ANALOG_PRERUSENO : 0);
    return p === 'stuck1';
  }
  /* kontrola mapování: typ adresy podle druhu signálu, kolize */
  function kontrolaMapovani(model, mapovani) {
    const chyby = [], obsazeno = {};
    for (const [k, s] of Object.entries(model.signaly)) {
      const adr = (mapovani && mapovani[k]) || s.adr;
      const a = PLC.rozeberAdresu(adr);
      const ocek = s.smer === 'vstup' ? (analogovy(s) ? 'IW' : 'I') : (analogovy(s) ? 'QW' : 'Q');
      if (!a || a.oblast !== ocek) { chyby.push(`${s.nazev}: adresa „${adr}“ musí být v oblasti ${ocek}.`); continue; }
      if (obsazeno[a.klic]) chyby.push(`${s.nazev} a ${obsazeno[a.klic]} sdílejí adresu ${a.klic}.`);
      obsazeno[a.klic] = s.nazev;
    }
    return chyby;
  }

  /* ---------------- simulace ---------------- */
  function vytvorSimulaci(projekt, seed) {
    const model = PROCESY[projekt.proces] || ZADNY;
    const ps = model.vytvor(seed || 7);
    const sim = { projekt, model, ps, plc: PLC.vytvorStav(projekt), rezim: 'STOP', cas: 0, doScanu: 0, uziv: {}, force: {}, poruchy: {},
      breakpointy: new Set(), preskocBp: false, zastavenoNa: null, historie: [], sledovat: [], scanu: 0, chybaCPU: null,
      dobaJs: { posl: 0, min: Infinity, max: 0, soucet: 0, n: 0 } };
    const m = mapa(sim);
    for (const [k, s] of Object.entries(model.signaly)) if (s.vychozi !== undefined) sim.uziv[m[k]] = s.vychozi;
    for (const n of model.nastaveni || []) if (model.nastav) model.nastav(ps, n.klic, n.vychozi);
    return sim;
  }
  function cidla(sim) { return sim.model.cidla(sim.ps) || {}; }
  /* hodnoty vstupů PLC (I bity a IW) – čidla procesu přes mapování a poruchy, jinak ruční ovládání */
  function vstupy(sim) {
    const r = {};
    for (const a of PLC.vsechnyAdresy('I')) r[a] = !!sim.uziv[a];
    for (const a of PLC.vsechnyAdresy('IW')) { const v = +sim.uziv[a]; r[a] = Number.isFinite(v) ? v : 0; }
    const c = cidla(sim), m = mapa(sim);
    for (const [k, def] of Object.entries(sim.model.signaly)) {
      if (def.smer !== 'vstup') continue;
      const adr = m[k]; const a = PLC.rozeberAdresu(adr); if (!a) continue;
      let h = (def.druh === 'cidlo' || def.druh === 'analog') ? c[k] : (analogovy(def) ? +sim.uziv[a.klic] || 0 : !!sim.uziv[a.klic]);
      h = sPoruchou(sim, k, def, h);
      r[a.klic] = analogovy(def) ? Math.round(+h || 0) : !!h;
    }
    return r;
  }
  function vystupy(sim) { return sim.rezim === 'STOP' ? {} : sim.plc.vystupy; }
  /* signály, jak je vidí proces: akční členy z výstupů PLC (přes poruchy), ovládací prvky z panelu */
  function signaly(sim) {
    const s = {}, Q = vystupy(sim), m = mapa(sim);
    for (const [k, def] of Object.entries(sim.model.signaly)) {
      const a = PLC.rozeberAdresu(m[k]); if (!a) continue;
      if (def.smer === 'vystup') s[k] = sPoruchou(sim, k, def, analogovy(def) ? (+Q[a.klic] || 0) : !!Q[a.klic]);
      else if (def.druh === 'tlacitko' || def.druh === 'prepinac') s[k] = !!sim.uziv[a.klic];
    }
    return s;
  }
  function zaznamenej(sim) {
    if (!sim.sledovat.length) return;
    const z = { t: sim.plc.cas - sim.plc.perioda, b: sim.sledovat.map(a => {
      const r = PLC.rozeberAdresu(a);
      if (r && (r.oblast === 'T' || r.oblast === 'C')) return PLC.ctiBit(sim.plc, a) ? 1 : 0;   // časovač/čítač v analyzátoru jako bit Q
      const h = PLC.hodnota(sim.plc, a, null); return h === null ? 0 : h;
    }) };
    sim.historie.push(z);
    const min = z.t - 120000;
    while (sim.historie.length > 6000 || (sim.historie.length && sim.historie[0].t < min)) sim.historie.shift();
  }
  const ted = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  /* provede (zbytek) cyklu; při zarážce vrátí false a přejde do PAUZY uprostřed cyklu */
  function scan(sim, bezZarazek) {
    const t0 = ted();
    try {
      if (!sim.plc.beh) PLC.zacniCyklus(sim.projekt, sim.plc, vstupy(sim), { perioda: sim.projekt.perioda, force: sim.force });
      const b = sim.plc.beh;
      while (b.dalsi < sim.projekt.pricky.length) {
        const p = sim.projekt.pricky[b.dalsi];
        if (!bezZarazek && sim.breakpointy.has(p.id) && !sim.preskocBp) { sim.rezim = 'PAUZA'; sim.zastavenoNa = b.dalsi; sim.preskocBp = true; return false; }
        sim.preskocBp = false;
        PLC.provedPricku(sim.projekt, sim.plc);
      }
      sim.zastavenoNa = null;
      PLC.dokonciCyklus(sim.projekt, sim.plc);
    } catch (e) {
      if (e && e.watchdog) { sim.chybaCPU = e.message; stop(sim); sim.chybaCPUcas = sim.cas; return false; }
      throw e;
    }
    const d = sim.dobaJs, t = ted() - t0;
    d.posl = t; d.min = Math.min(d.min, t); d.max = Math.max(d.max, t); d.soucet += t; d.n++;
    sim.scanu++;
    zaznamenej(sim);
    return true;
  }
  function posunProces(sim, ms) {
    const s = signaly(sim);
    let zb = ms;
    while (zb > 1e-9) { const h = Math.min(zb, 10); sim.model.krok(sim.ps, h / 1000, s); zb -= h; }
  }
  function posun(sim, ms) {
    if (sim.rezim === 'PAUZA') return;
    if (sim.rezim === 'STOP') { posunProces(sim, ms); sim.cas += ms; return; }
    let zb = ms;
    while (zb > 1e-9) {
      if (sim.doScanu <= 1e-9) {
        if (!scan(sim, false)) return;
        sim.doScanu += sim.projekt.perioda;
      }
      const h = Math.min(zb, sim.doScanu);
      posunProces(sim, h); sim.cas += h; sim.doScanu -= h; zb -= h;
    }
  }
  function start(sim, restart) {
    if (sim.rezim === 'STOP') {
      sim.plc = PLC.vytvorStav(sim.projekt, sim.plc, restart || 'teply');
      sim.doScanu = 0; sim.historie = []; sim.chybaCPU = null; sim.zastavenoNa = null; sim.preskocBp = false;
    }
    sim.rezim = 'RUN';
  }
  function stop(sim) { sim.rezim = 'STOP'; sim.plc.vystupy = {}; sim.plc.beh = null; sim.zastavenoNa = null; }
  function pauza(sim) { if (sim.rezim === 'RUN') sim.rezim = 'PAUZA'; }
  function studenyStart(sim) { stop(sim); sim.plc = PLC.vytvorStav(sim.projekt, null); start(sim, 'studeny'); }
  function vypadekNapajeni(sim) { stop(sim); start(sim, 'teply'); }
  function predScanem(sim) {
    if (sim.rezim === 'STOP') { start(sim, 'teply'); }
    sim.rezim = 'RUN';
    if (!sim.plc.beh && sim.doScanu > 1e-9) { posunProces(sim, sim.doScanu); sim.cas += sim.doScanu; sim.doScanu = 0; }
  }
  /* jeden celý cyklus (bez zarážek), proces pak běží jednu periodu */
  function krok(sim) {
    predScanem(sim);
    if (!scan(sim, true)) return;
    posunProces(sim, sim.projekt.perioda); sim.cas += sim.projekt.perioda; sim.doScanu = 0;
    if (sim.rezim !== 'STOP') sim.rezim = 'PAUZA';
  }
  /* jedna příčka MAIN; po poslední příčce se cyklus dokončí a proces poběží jednu periodu */
  function krokPricky(sim) {
    predScanem(sim);
    try {
      if (!sim.plc.beh) PLC.zacniCyklus(sim.projekt, sim.plc, vstupy(sim), { perioda: sim.projekt.perioda, force: sim.force });
      const i = PLC.provedPricku(sim.projekt, sim.plc);
      sim.preskocBp = true;
      if (sim.plc.beh.dalsi >= sim.projekt.pricky.length) {
        scan(sim, true);
        posunProces(sim, sim.projekt.perioda); sim.cas += sim.projekt.perioda; sim.doScanu = 0;
        sim.zastavenoNa = null; sim.preskocBp = false;
      } else sim.zastavenoNa = sim.plc.beh.dalsi;
      if (sim.rezim !== 'STOP') sim.rezim = 'PAUZA';
      return i;
    } catch (e) {
      if (e && e.watchdog) { sim.chybaCPU = e.message; stop(sim); return -1; }
      throw e;
    }
  }
  function zmenProjekt(sim, projekt) {
    sim.projekt = projekt;
    const novy = PLC.vytvorStav(projekt);
    for (const k of Object.keys(novy.T)) if (sim.plc.T[k] && sim.plc.T[k].typ === novy.T[k].typ) novy.T[k] = sim.plc.T[k];
    for (const k of Object.keys(novy.C)) if (sim.plc.C[k] && sim.plc.C[k].typ === novy.C[k].typ) novy.C[k] = sim.plc.C[k];
    for (const k of ['I', 'Q', 'M', 'W', 'hrany', 'pid', 'inst', 'vystupy', 'cas', 'cyklus', 'stopa', 'pricky', 'chybyBehu', 'pocetChyb', 'doba', 'perioda']) novy[k] = sim.plc[k];
    novy.beh = null;
    sim.plc = novy;
    sim.zastavenoNa = null; sim.preskocBp = false;
    for (const id of [...sim.breakpointy]) if (!projekt.pricky.some(p => p.id === id)) sim.breakpointy.delete(id);
  }

  const Procesy = { PROCESY, PORUCHY, AMAX, rng, mapa, kontrolaMapovani, analogovy, vytvorSimulaci, vstupy, vystupy, signaly, cidla, scan, posun, posunProces,
    start, stop, pauza, krok, krokPricky, studenyStart, vypadekNapajeni, zmenProjekt };
  if (typeof module !== 'undefined') module.exports = Procesy; else window.Procesy = Procesy;
})();
