/* Dopravní magnát – měsíční vývoj hospodářství (bez DOM): výroba podniků podle obsluhy, zavírání a vznik podniků,
   hodnocení firmy městy, hospodářská krize. Volá ho MAG.hra.mesicni po přetočení měsíčních statistik
   (h.prum[*].minuly = minulý měsíc). Náhoda jen z h.nah. */
(function (MAG) {
  'use strict';
  const D = MAG.data, M = MAG.mapa, H = MAG.hra;

  const MAX_NASOBEK = 8;          // výroba nejvýš 8× základ
  const zprava = (h, text, kde) => h.zpravy.push({ den: h.den, text, ...(kde || {}) });
  const soucet = (o, pred) => Object.entries(o || {}).reduce((a, [k, v]) => a + (k.startsWith(pred) ? v : 0), 0);
  const jePrvovyroba = p => Object.values(p.vyroba).some(v => v > 0);
  const aktivnich = (m, typ) => m.prumysl.filter(q => !q.zrusen && q.typ === typ).length;

  function zrusPodnik(h, q) {
    const m = h.m;
    for (let dy = 0; dy < q.h; dy++) for (let dx = 0; dx < q.w; dx++) {
      const i = (q.y + dy) * m.W + q.x + dx;
      if (m.prum[i] === q.id + 1) m.prum[i] = 0;
    }
    q.zrusen = true;
    for (const st of h.stanice) if (st) H.prepocitejPrijem(h, st);
    H.zmena(h, q.x - 1, q.y - 1, q.x + q.w, q.y + q.h);
    zprava(h, `🏚️ ${q.jmeno} ukončuje provoz`, { x: q.x, y: q.y });
  }

  function vyrobaPodniku(h) {
    const m = h.m, nah = h.nah;
    for (const q of m.prumysl) {
      if (q.zrusen) continue;
      const p = D.PRUMYSL_PODLE_ID[q.typ], s = h.prum[q.id];
      const zaklad = q.zaklad || p.vyroba;
      const posledni = aktivnich(m, q.typ) <= 1;
      if (jePrvovyroba(p)) {
        const vyr = soucet(s.minuly, 'vyrobeno_'), odv = soucet(s.minuly, 'odvezeno_');
        const podil = vyr ? odv / vyr : 0;
        const nasobek = Math.max(...Object.keys(zaklad).filter(k => zaklad[k] > 0).map(k => q.vyroba[k] / zaklad[k]));
        if (podil >= 0.6) {
          s.zanedbano = 0;
          if (nasobek < MAX_NASOBEK && nah.f() < 0.045) {
            for (const k of Object.keys(q.vyroba)) if (zaklad[k] > 0) q.vyroba[k] = Math.min(zaklad[k] * MAX_NASOBEK, Math.round(q.vyroba[k] * 1.5));
            zprava(h, `📈 ${q.jmeno} zvyšuje výrobu (dobrá doprava)`, { x: q.x, y: q.y });
          }
        } else if (podil < 0.15) {
          s.zanedbano = (s.zanedbano || 0) + 1;
          if (s.zanedbano > 36 && nah.f() < 0.012) {
            if (nasobek <= 0.4 && !posledni) zrusPodnik(h, q);
            else {
              for (const k of Object.keys(q.vyroba)) if (zaklad[k] > 0) q.vyroba[k] = Math.max(1, Math.round(q.vyroba[k] * 0.6));
              if (odv > 0) zprava(h, `📉 ${q.jmeno} omezuje výrobu`, { x: q.x, y: q.y });
            }
          }
        } else s.zanedbano = Math.max(0, (s.zanedbano || 0) - 1);
      } else {
        // zpracovatel bez dodávek pět let zavře (ne poslední svého druhu)
        if (soucet(s.minuly, 'dodano_') > 0) s.bezDodavek = 0;
        else s.bezDodavek = (s.bezDodavek || 0) + 1;
        if (s.bezDodavek > 60 && !posledni && nah.f() < 0.006) zrusPodnik(h, q);
      }
    }
  }

  // nový podnik: výrobce jen tam, kde už je jeho odběratel
  function novyPodnik(h) {
    const m = h.m, nah = h.nah;
    if (nah.f() >= 0.06 * (m.W * m.H) / (128 * 128)) return null;
    const odberatel = Object.fromEntries(D.RETEZCE);
    const vahy = { dul: 3, elektrarna: 1.2, tezba: 2.5, pila: 1, rudnydul: 1.5, ocelarna: 0.8, tovarna: 1, farma: 3, potravinarna: 1.2, vrt: 1.5, rafinerie: 0.6 };
    const typ = nah.vazene(Object.entries(vahy).filter(([k]) => !odberatel[k] || aktivnich(m, odberatel[k]) > 0));
    const p = D.PRUMYSL_PODLE_ID[typ];
    for (let pokus = 0; pokus < 300; pokus++) {
      const x = nah.cele(2, m.W - 3 - p.rozmer[0]), y = nah.cele(2, m.H - 3 - p.rozmer[1]);
      if (!M.vhodneMisto(m, p, x, y, m.vrch)) continue;
      // ani vozidlo, ani stavba hráče v okolí (úprava terénu by je posunula)
      let volno = true;
      for (let dy = -3; dy < p.rozmer[1] + 3 && volno; dy++) for (let dx = -3; dx < p.rozmer[0] + 3; dx++) {
        if (!M.uvnitr(m, x + dx, y + dy)) continue;
        const i = (y + dy) * m.W + x + dx;
        if (m.cesta[i] === 2 || m.kolej[i] || m.stan[i] || m.depo[i]) { volno = false; break; }
      }
      if (!volno) continue;
      const q = M.postavPrumysl(m, nah, p, x, y);
      if (!q) continue;
      h.prum.push({ vstup: 0, zasoba: {}, mesic: {}, minuly: {} });
      for (const st of h.stanice) if (st) H.prepocitejPrijem(h, st);
      H.zmena(h, x - 4, y - 4, x + p.rozmer[0] + 4, y + p.rozmer[1] + 4);
      zprava(h, `🏭 Nový podnik: ${q.jmeno}`, { x: q.x, y: q.y });
      return q;
    }
    return null;
  }

  // hodnocení firmy městem: obsluhované stanice v dosahu přidávají, opuštěné ubírají, jinak pomalu k nule
  function hodnoceniMest(h) {
    const m = h.m;
    for (const c of m.mesta) {
      const cs = h.mestaStat[c.id];
      let plus = 0, minus = 0;
      for (const st of h.stanice) {
        if (!st || H.obecU(h, st.x, st.y) !== c) continue;
        const obsl = Object.values(st.naklady).some(z => z.navst && z.dni < 30);
        if (obsl) plus++; else if (h.den - st.zalozeno > 60) minus++;
      }
      let n = cs.hodn + Math.min(4, plus) * 12 - minus * 10;
      if (!plus && !minus) n -= Math.sign(n) * Math.min(Math.abs(n), 5);
      cs.hodn = Math.max(-1000, Math.min(1000, n));
    }
  }

  function krize(h) {
    const e = h.ekonomika;
    if (e.krize > 0) {
      if (--e.krize === 0) zprava(h, '📈 Hospodářská krize skončila – podniky a cestující se vracejí');
    } else if (h.nah.f() < 1 / 180) {
      e.krize = h.nah.cele(6, 12);
      zprava(h, `📉 Hospodářská krize: podniky omezují výrobu a lidé méně cestují (asi ${e.krize} měsíců)`);
    }
  }

  function mesicni(h) {
    if (!h.ekonomika) h.ekonomika = { krize: 0 };
    vyrobaPodniku(h);
    novyPodnik(h);
    hodnoceniMest(h);
    krize(h);
  }

  MAG.ekonomika = { mesicni, vyrobaPodniku, novyPodnik, hodnoceniMest, krize, zrusPodnik, MAX_NASOBEK };
})(globalThis.MAG = globalThis.MAG || {});
