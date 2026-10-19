/* Návrhář mechanických převodů – výpočetní jádro (bez DOM).
 *
 * Model = graf: hřídele (uzly, tuhá tělesa se společnou osou) nesou komponenty
 * (vnější ozubené kolo, kolo s vnitřním ozubením, řemenice, řetězové kolo).
 * Vazby spojují dvě komponenty na RŮZNÝCH hřídelích: záběr (ozubení), řemen, řetěz.
 * Kinematika: ω_b = k · ω_a, k závisí jen na geometrii vazby.
 * Ideální model: η = 1, skluz 0. Model s účinností: výkonová účinnost η vazby, u řemenů skluz s.
 * Smyčky v grafu: pokud součin převodů po smyčce ≠ 1, soustava je přeurčená (zablokuje se).
 *
 * Konvence: ω > 0 = proti směru hodinových ručiček při pohledu zepředu (matematicky kladně),
 * délky v mm, otáčky v min⁻¹, moment v N·m, výkon ve W. Převodový poměr i = n_vstup / n_výstup.
 */
(function () {
  'use strict';

  const TYPY = {
    kolo: { nazev: 'Ozubené kolo (vnější)', vazba: 'zaber' },
    vnitrni: { nazev: 'Kolo s vnitřním ozubením', vazba: 'zaber' },
    remenice: { nazev: 'Řemenice', vazba: 'remen' },
    retezove: { nazev: 'Řetězové kolo', vazba: 'retez' },
  };
  const VAZBY = {
    zaber: { nazev: 'Záběr ozubení', eta: 0.98 },
    remen: { nazev: 'Řemen', eta: 0.96 },
    retez: { nazev: 'Řetěz', eta: 0.97 },
  };
  /* Orientační rozsahy účinnosti a skluzu z běžné strojnické literatury (jedna dvojice, bez ložisek). */
  const DRUHY_REMENE = {
    klinovy: { nazev: 'klínový', eta: 0.96, skluz: 0.01, zubovy: false },
    plochy: { nazev: 'plochý', eta: 0.97, skluz: 0.015, zubovy: false },
    ozubeny: { nazev: 'ozubený (synchronní)', eta: 0.98, skluz: 0, zubovy: true },
  };
  const TOL_KIN = 1e-9;          // relativní tolerance shody převodů ve smyčce
  const TOL_VZD_MM = 0.05;       // tolerance osové vzdálenosti záběru (mm)

  const rad = s => s * Math.PI / 180;
  const deg = r => r * 180 / Math.PI;
  const RPM = 2 * Math.PI / 60;   // min⁻¹ → rad/s

  /* ---------- geometrie komponent ---------- */
  function rozdelovaciPrumer(k) {
    switch (k.typ) {
      case 'kolo': case 'vnitrni': return k.m * k.z;
      case 'retezove': return k.p / Math.sin(Math.PI / k.z);
      case 'remenice': return k.d;
    }
    return NaN;
  }
  /* Vnější a vnitřní obrys (mezikruží) pro kontrolu kolizí a kreslení, v mm (poloměry). */
  function obrys(k) {
    const r = rozdelovaciPrumer(k) / 2;
    switch (k.typ) {
      case 'kolo': return { rin: 0, rout: r + k.m };
      case 'vnitrni': {
        const veniec = Math.max(3 * k.m, 0.06 * r);
        return { rin: r - k.m, rout: r + 1.25 * k.m + veniec };
      }
      case 'retezove': return { rin: 0, rout: k.p * (0.6 + 1 / Math.tan(Math.PI / k.z)) / 2 };
      case 'remenice': return { rin: 0, rout: r + Math.max(2, 0.04 * r) };
    }
    return { rin: 0, rout: 0 };
  }
  function minZubu(alfaSt) {
    // teoretický mezní počet zubů bez podřezání (bez korekce): z_min = 2 / sin²α (20° → 17)
    const s = Math.sin(rad(alfaSt || 20));
    return Math.round(2 / (s * s));
  }

  /* ---------- pomocné ---------- */
  const mapa = pole => { const m = new Map(); for (const x of pole || []) m.set(x.id, x); return m; };
  const kladne = x => typeof x === 'number' && isFinite(x) && x > 0;
  const kopie = o => JSON.parse(JSON.stringify(o));

  function noveId(navrh, prefix) {
    const vse = new Set([...(navrh.hridele || []), ...(navrh.komponenty || []), ...(navrh.vazby || [])].map(x => x.id));
    let i = 1; while (vse.has(prefix + i)) i++;
    return prefix + i;
  }

  /* Doplní chybějící pole a opraví typy (pro načtení ze souboru / úložiště). */
  function normalizuj(n) {
    const v = n && typeof n === 'object' ? kopie(n) : {};
    v.nazev = typeof v.nazev === 'string' ? v.nazev : 'Návrh';
    v.hridele = Array.isArray(v.hridele) ? v.hridele : [];
    v.komponenty = Array.isArray(v.komponenty) ? v.komponenty : [];
    v.vazby = Array.isArray(v.vazby) ? v.vazby : [];
    for (const h of v.hridele) {
      h.x = +h.x || 0; h.y = +h.y || 0;
      h.zatez = +h.zatez || 0;
      h.zatezDruh = h.zatezDruh === 'vykon' ? 'vykon' : 'moment';
    }
    for (const k of v.komponenty) {
      if (!TYPY[k.typ]) k.typ = 'kolo';
      k.rovina = Math.round(+k.rovina || 0);
      if (k.typ === 'kolo' || k.typ === 'vnitrni') { k.z = +k.z; k.m = +k.m; k.alfa = +k.alfa || 20; }
      if (k.typ === 'retezove') { k.z = +k.z; k.p = +k.p; }
      if (k.typ === 'remenice') { k.d = +k.d; }
    }
    for (const e of v.vazby) {
      if (!VAZBY[e.typ]) e.typ = 'zaber';
      e.eta = e.eta === undefined || e.eta === null || e.eta === '' ? VAZBY[e.typ].eta : +e.eta;
      e.skluz = e.typ === 'remen' ? (+e.skluz || 0) : 0;
      e.krizeny = e.typ === 'remen' ? !!e.krizeny : false;
      if (e.typ === 'remen' && !DRUHY_REMENE[e.druh]) e.druh = 'klinovy';
    }
    v.vstup = v.vstup && typeof v.vstup === 'object' ? v.vstup : {};
    v.vstup.n = +v.vstup.n || 0;
    v.vstup.smer = v.vstup.smer === 'ccw' ? 'ccw' : 'cw';
    if (!v.hridele.some(h => h.id === v.vstup.hridel)) v.vstup.hridel = v.hridele.length ? v.hridele[0].id : null;
    if (!v.hridele.some(h => h.id === v.vystup)) v.vystup = v.hridele.length ? v.hridele[v.hridele.length - 1].id : null;
    return v;
  }

  /* Typ vazby, který odpovídá dvojici komponent, nebo null (nekompatibilní). */
  function typVazbyPro(ka, kb) {
    if (!ka || !kb) return null;
    const ta = TYPY[ka.typ].vazba, tb = TYPY[kb.typ].vazba;
    if (ta !== tb) return null;
    if (ka.typ === 'vnitrni' && kb.typ === 'vnitrni') return null;
    return ta;
  }

  /* Ideální převod vazby z komponenty a na komponentu b: ω_b = k · ω_a (null = nelze). */
  function prevodVazby(e, ka, kb) {
    if (!ka || !kb) return null;
    switch (e.typ) {
      case 'zaber': {
        if (ka.typ === 'kolo' && kb.typ === 'kolo') return -ka.z / kb.z;
        if ((ka.typ === 'kolo' && kb.typ === 'vnitrni') || (ka.typ === 'vnitrni' && kb.typ === 'kolo')) return ka.z / kb.z;
        return null;
      }
      case 'remen': return (e.krizeny ? -1 : 1) * ka.d / kb.d;
      case 'retez': return ka.z / kb.z;
    }
    return null;
  }

  /* Požadovaná osová vzdálenost záběru (bez korekcí), jinak null. */
  function pozadovanaOsovaVzdalenost(e, ka, kb) {
    if (e.typ !== 'zaber' || !ka || !kb) return null;
    if (ka.typ === 'kolo' && kb.typ === 'kolo') return ka.m * (ka.z + kb.z) / 2;
    if (ka.typ === 'vnitrni' || kb.typ === 'vnitrni') return ka.m * Math.abs(ka.z - kb.z) / 2;
    return null;
  }

  /* Délka řemene (mm) – otevřený / křížený, rozdělovací (výpočtové) průměry. */
  function delkaRemene(d1, d2, a, krizeny) {
    const D = Math.max(d1, d2), d = Math.min(d1, d2);
    if (krizeny) return 2 * a + Math.PI * (D + d) / 2 + (D + d) * (D + d) / (4 * a);
    return 2 * a + Math.PI * (D + d) / 2 + (D - d) * (D - d) / (4 * a);
  }
  /* Přesná délka otevřeného/kříženého řemene po tečnách (mm). */
  function delkaRemenePresna(d1, d2, a, krizeny) {
    const r1 = d1 / 2, r2 = d2 / 2;
    if (krizeny) {
      const s = (r1 + r2) / a; if (s >= 1) return NaN;
      const b = Math.asin(s);
      return 2 * a * Math.cos(b) + (r1 + r2) * (Math.PI + 2 * b);
    }
    const s = (r2 - r1) / a; if (Math.abs(s) >= 1) return NaN;
    const b = Math.asin(s);
    return 2 * a * Math.cos(b) + r1 * (Math.PI - 2 * b) + r2 * (Math.PI + 2 * b);
  }
  /* Úhel opásání menší řemenice ve stupních. */
  function uhelOpasani(d1, d2, a, krizeny) {
    const D = Math.max(d1, d2), d = Math.min(d1, d2);
    if (krizeny) { const s = (D + d) / (2 * a); return s >= 1 ? NaN : 180 + 2 * deg(Math.asin(s)); }
    const s = (D - d) / (2 * a); return s >= 1 ? NaN : 180 - 2 * deg(Math.asin(s));
  }
  /* Počet článků řetězu (necelé číslo) pro rozteč p, zuby z1, z2 a osovou vzdálenost a. */
  function clankyRetezu(p, z1, z2, a) {
    const c = (z2 - z1) / (2 * Math.PI);
    return 2 * a / p + (z1 + z2) / 2 + (p / a) * c * c;
  }
  /* Osová vzdálenost pro celý počet článků X (inverze vzorce výše). */
  function osovaProClanky(p, z1, z2, X) {
    const s = X - (z1 + z2) / 2, c = (z2 - z1) / (2 * Math.PI);
    const disk = s * s - 8 * c * c;
    if (disk < 0) return NaN;
    return p / 4 * (s + Math.sqrt(disk));
  }

  function kolidujiMezikruzi(o1, o2, dist) {
    if (dist >= o1.rout + o2.rout - 1e-9) return false;            // daleko od sebe
    if (dist + o2.rout <= o1.rin + 1e-9) return false;             // 2 celé v díře 1
    if (dist + o1.rout <= o2.rin + 1e-9) return false;             // 1 celé v díře 2
    return true;
  }

  /* ---------- hlavní výpočet ---------- */
  function spocitej(vstupniNavrh) {
    const n = normalizuj(vstupniNavrh);
    const zpravy = [];
    const zprava = (uroven, kod, text, prvky) => zpravy.push({ uroven, kod, text, prvky: prvky || [] });
    const H = mapa(n.hridele), K = mapa(n.komponenty);

    /* --- kontrola vstupů komponent --- */
    const platnaK = new Set();
    for (const k of n.komponenty) {
      let ok = true;
      if (!H.has(k.hridel)) { zprava('chyba', 'bez_hridele', `${k.id}: komponenta není na žádném existujícím hřídeli.`, [k.id]); ok = false; }
      if (k.typ === 'kolo' || k.typ === 'vnitrni') {
        if (!(Number.isInteger(k.z) && k.z >= 3)) { zprava('chyba', 'vstup', `${k.id}: počet zubů musí být celé číslo ≥ 3.`, [k.id]); ok = false; }
        if (!kladne(k.m)) { zprava('chyba', 'vstup', `${k.id}: modul musí být kladný.`, [k.id]); ok = false; }
        if (!(k.alfa > 0 && k.alfa < 45)) { zprava('chyba', 'vstup', `${k.id}: úhel záběru musí být v rozsahu 0–45°.`, [k.id]); ok = false; }
        if (ok && k.typ === 'kolo' && k.z < minZubu(k.alfa))
          zprava('varovani', 'podrezani', `${k.id}: ${k.z} zubů < ${minZubu(k.alfa)} – nekorigované kolo (α = ${k.alfa}°) bude mít podřezané zuby; nutná korekce profilu.`, [k.id]);
      } else if (k.typ === 'retezove') {
        if (!(Number.isInteger(k.z) && k.z >= 5)) { zprava('chyba', 'vstup', `${k.id}: počet zubů řetězového kola musí být celé číslo ≥ 5.`, [k.id]); ok = false; }
        if (!kladne(k.p)) { zprava('chyba', 'vstup', `${k.id}: rozteč řetězu musí být kladná.`, [k.id]); ok = false; }
        if (ok && k.z < 9) zprava('varovani', 'malo_zubu', `${k.id}: řetězové kolo s ${k.z} zuby – výrazný polygonový efekt a opotřebení; obvykle se volí aspoň 9 (lépe 17 a více).`, [k.id]);
      } else if (k.typ === 'remenice') {
        if (!kladne(k.d)) { zprava('chyba', 'vstup', `${k.id}: průměr řemenice musí být kladný.`, [k.id]); ok = false; }
      }
      if (ok) platnaK.add(k.id);
    }

    /* komponenty na stejném hřídeli ve stejné rovině */
    const naHrideli = new Map();
    for (const k of n.komponenty) {
      const klic = k.hridel + '|' + k.rovina;
      if (naHrideli.has(klic)) zprava('chyba', 'rovina', `${naHrideli.get(klic)} a ${k.id} jsou na stejném hřídeli ve stejné rovině – přesuňte jednu do jiné roviny.`, [naHrideli.get(klic), k.id]);
      else naHrideli.set(klic, k.id);
    }

    /* --- vazby: platnost, převod, geometrie --- */
    const vazbyInfo = {};
    const sousede = new Map(); for (const h of n.hridele) sousede.set(h.id, []);
    const pouziteDvojice = new Set();
    for (const e of n.vazby) {
      const ka = K.get(e.a), kb = K.get(e.b);
      const info = { platna: false, k: null, geometrie: {} };
      vazbyInfo[e.id] = info;
      if (!ka || !kb) { zprava('chyba', 'vazba', `${e.id}: vazba odkazuje na neexistující komponentu.`, [e.id]); continue; }
      if (ka === kb) { zprava('chyba', 'vazba', `${e.id}: komponenta nemůže být spojena sama se sebou.`, [e.id]); continue; }
      const dvojice = [e.a, e.b].sort().join('|');
      if (pouziteDvojice.has(dvojice)) { zprava('chyba', 'vazba', `${e.id}: komponenty ${e.a} a ${e.b} jsou spojeny vícekrát.`, [e.id]); continue; }
      pouziteDvojice.add(dvojice);
      const tv = typVazbyPro(ka, kb);
      if (tv !== e.typ) {
        zprava('chyba', 'nekompatibilni', `${e.id}: ${TYPY[ka.typ].nazev.toLowerCase()} a ${TYPY[kb.typ].nazev.toLowerCase()} nelze spojit vazbou „${VAZBY[e.typ].nazev.toLowerCase()}“.`, [e.id, e.a, e.b]);
        continue;
      }
      if (ka.hridel === kb.hridel) { zprava('chyba', 'stejny_hridel', `${e.id}: obě komponenty jsou na stejném hřídeli – vazba nemá smysl.`, [e.id]); continue; }
      if (!(e.eta > 0 && e.eta <= 1)) { zprava('chyba', 'eta', `${e.id}: účinnost musí být v rozsahu (0; 1].`, [e.id]); continue; }
      if (!(e.skluz >= 0 && e.skluz < 0.2)) { zprava('chyba', 'skluz', `${e.id}: skluz musí být v rozsahu 0–20 %.`, [e.id]); continue; }
      if (e.typ === 'remen' && e.skluz > 0 && e.eta > 1 - e.skluz + 1e-12)
        zprava('varovani', 'eta_skluz', `${e.id}: výkonová účinnost ${fmt(e.eta * 100, 1)} % je vyšší než 1 − skluz (${fmt((1 - e.skluz) * 100, 1)} %); účinnost zahrnuje i ztrátu skluzem.`, [e.id]);
      if (e.typ === 'remen' && e.druh === 'ozubeny' && e.skluz > 0)
        zprava('varovani', 'skluz_zubovy', `${e.id}: ozubený řemen pracuje bez skluzu – skluz by měl být 0.`, [e.id]);
      if (!platnaK.has(ka.id) || !platnaK.has(kb.id)) continue;
      if (ka.rovina !== kb.rovina) zprava('chyba', 'rovina_vazby', `${e.id}: ${e.a} (rovina ${ka.rovina}) a ${e.b} (rovina ${kb.rovina}) neleží ve stejné rovině.`, [e.id, e.a, e.b]);

      const ha = H.get(ka.hridel), hb = H.get(kb.hridel);
      const a = Math.hypot(hb.x - ha.x, hb.y - ha.y);
      info.geometrie.osova = a;
      let geomOk = true;

      if (e.typ === 'zaber') {
        if (Math.abs(ka.m - kb.m) > 1e-9) {
          zprava('chyba', 'modul', `${e.id}: nekompatibilní moduly ${fmt(ka.m, 3)} a ${fmt(kb.m, 3)} mm – kola spolu nemohou zabírat.`, [e.id, e.a, e.b]);
          geomOk = false;
        }
        if (Math.abs(ka.alfa - kb.alfa) > 1e-9) {
          zprava('chyba', 'alfa', `${e.id}: různé úhly záběru ${fmt(ka.alfa, 1)}° a ${fmt(kb.alfa, 1)}° – profily nejsou kompatibilní.`, [e.id, e.a, e.b]);
          geomOk = false;
        }
        const vn = ka.typ === 'vnitrni' ? ka : kb.typ === 'vnitrni' ? kb : null;
        if (vn) {
          const pas = vn === ka ? kb : ka;
          info.geometrie.vnitrni = true;
          if (vn.z <= pas.z) { zprava('chyba', 'vnitrni_mensi', `${e.id}: kolo s vnitřním ozubením (${vn.z} z) musí mít víc zubů než pastorek (${pas.z} z).`, [e.id]); geomOk = false; }
          else if (vn.z - pas.z < 10) zprava('varovani', 'interference', `${e.id}: rozdíl zubů ${vn.z - pas.z} < 10 – u nekorigovaného vnitřního ozubení hrozí interference hlav zubů.`, [e.id]);
        }
        if (geomOk) {
          const pozad = pozadovanaOsovaVzdalenost(e, ka, kb);
          info.geometrie.pozadovana = pozad;
          if (Math.abs(a - pozad) > TOL_VZD_MM) {
            zprava('chyba', 'roztec', `${e.id}: nesouhlas roztečí – osová vzdálenost je ${fmt(a, 2)} mm, pro záběr (bez korekcí) je potřeba ${fmt(pozad, 2)} mm (rozdíl ${fmt(a - pozad, 2)} mm).`, [e.id]);
          }
        }
      } else if (e.typ === 'retez') {
        if (Math.abs(ka.p - kb.p) > 1e-9) {
          zprava('chyba', 'roztec_retezu', `${e.id}: různé rozteče řetězových kol ${fmt(ka.p, 3)} a ${fmt(kb.p, 3)} mm – nelze spojit jedním řetězem.`, [e.id, e.a, e.b]);
          geomOk = false;
        } else {
          const oa = obrys(ka), ob = obrys(kb);
          if (a <= oa.rout + ob.rout) { zprava('chyba', 'blizko', `${e.id}: řetězová kola se překrývají (osová vzdálenost ${fmt(a, 1)} mm).`, [e.id]); geomOk = false; }
          else {
            const X = clankyRetezu(ka.p, ka.z, kb.z, a);
            let Xs = Math.ceil(X - 1e-9); if (Xs % 2) Xs++;
            info.geometrie.clanky = X; info.geometrie.clankySude = Xs;
            info.geometrie.osovaProSude = osovaProClanky(ka.p, ka.z, kb.z, Xs);
            const pomer = a / ka.p;
            if (pomer > 80) zprava('varovani', 'retez_dlouhy', `${e.id}: osová vzdálenost ${fmt(pomer, 0)} p je nad obvyklým maximem 80 p – řetěz bude kmitat, je potřeba napínák/vedení.`, [e.id]);
            else if (pomer < 30 || pomer > 50) zprava('info', 'retez_osova', `${e.id}: osová vzdálenost ${fmt(pomer, 1)} p; obvykle se doporučuje 30–50 p.`, [e.id]);
            const zm = Math.min(ka.z, kb.z), zM = Math.max(ka.z, kb.z);
            // úhel opásání malého kola (geometricky na roztečných kružnicích)
            info.geometrie.opasani = uhelOpasani(rozdelovaciPrumer(ka), rozdelovaciPrumer(kb), a, false);
            if (info.geometrie.opasani < 120) zprava('varovani', 'opasani', `${e.id}: malé řetězové kolo je opásáno jen ${fmt(info.geometrie.opasani, 0)}° (doporučeno ≥ 120°).`, [e.id]);
            info.geometrie.polygon = (1 - Math.cos(Math.PI / zm)) * 100;
            if (zM / zm > 7) zprava('varovani', 'retez_prevod', `${e.id}: převod ${fmt(zM / zm, 2)} v jednom řetězovém stupni je nad obvyklými 7.`, [e.id]);
          }
        }
      } else if (e.typ === 'remen') {
        const oa = obrys(ka), ob = obrys(kb);
        const d1 = ka.d, d2 = kb.d;
        if (a <= oa.rout + ob.rout) { zprava('chyba', 'blizko', `${e.id}: řemenice se překrývají (osová vzdálenost ${fmt(a, 1)} mm).`, [e.id]); geomOk = false; }
        else {
          info.geometrie.delka = delkaRemenePresna(d1, d2, a, e.krizeny);
          info.geometrie.delkaPribl = delkaRemene(d1, d2, a, e.krizeny);
          info.geometrie.opasani = uhelOpasani(d1, d2, a, e.krizeny);
          const mezOp = e.druh === 'plochy' ? 150 : 120;
          if (info.geometrie.opasani < mezOp) zprava('varovani', 'opasani', `${e.id}: úhel opásání menší řemenice ${fmt(info.geometrie.opasani, 0)}° < ${mezOp}° – hrozí prokluz; zvětšete osovou vzdálenost nebo použijte napínací kladku.`, [e.id]);
          if (e.krizeny && e.druh !== 'plochy') zprava('varovani', 'krizeny', `${e.id}: křížený převod je běžný jen u plochého řemene; klínový či ozubený řemen se tak obvykle nepoužívá.`, [e.id]);
          const pom = Math.max(d1, d2) / Math.min(d1, d2);
          if (pom > 8) zprava('varovani', 'remen_prevod', `${e.id}: převod ${fmt(pom, 2)} v jednom řemenovém stupni je nad obvyklými 6–8.`, [e.id]);
        }
      }
      const k = prevodVazby(e, ka, kb);
      if (k === null || !isFinite(k)) continue;
      info.k = k;
      info.platna = true;
      sousede.get(ka.hridel).push({ e, z: ka, na: kb, k });
      sousede.get(kb.hridel).push({ e, z: kb, na: ka, k: 1 / k });
    }

    /* --- kolize komponent ve stejné rovině --- */
    const zaberove = new Set(n.vazby.filter(e => e.typ === 'zaber' || e.typ === 'retez' || e.typ === 'remen').map(e => [e.a, e.b].sort().join('|')));
    const kk = n.komponenty.filter(k => platnaK.has(k.id));
    for (let i = 0; i < kk.length; i++) for (let j = i + 1; j < kk.length; j++) {
      const a = kk[i], b = kk[j];
      if (a.hridel === b.hridel || a.rovina !== b.rovina) continue;
      if (zaberove.has([a.id, b.id].sort().join('|'))) continue;
      const ha = H.get(a.hridel), hb = H.get(b.hridel);
      const d = Math.hypot(hb.x - ha.x, hb.y - ha.y);
      if (kolidujiMezikruzi(obrys(a), obrys(b), d))
        zprava('chyba', 'kolize', `${a.id} a ${b.id} se ve stejné rovině překrývají, ale nejsou spolu ve vazbě (kolize).`, [a.id, b.id]);
    }

    /* --- kinematika: průchod do šířky od vstupu --- */
    const hridVys = {};
    for (const h of n.hridele) hridVys[h.id] = { dosazen: false, wId: 0, wReal: 0, rodic: null, pres: null };
    const vstup = n.vstup;
    const omegaVst = (vstup.smer === 'cw' ? -1 : 1) * vstup.n * RPM;
    const stromove = new Set(), poradi = [];
    let preurceno = false;
    if (!vstup.hridel || !H.has(vstup.hridel)) zprava('chyba', 'vstup', 'Není určen vstupní hřídel.', []);
    else if (!kladne(vstup.n)) zprava('chyba', 'vstup', 'Vstupní otáčky musí být kladné.', [vstup.hridel]);
    else {
      const s = hridVys[vstup.hridel];
      s.dosazen = true; s.wId = omegaVst; s.wReal = omegaVst;
      const fronta = [vstup.hridel]; poradi.push(vstup.hridel);
      const hlaseno = new Set();
      while (fronta.length) {
        const hid = fronta.shift(), hs = hridVys[hid];
        for (const s2 of sousede.get(hid)) {
          const cil = s2.na.hridel, cs = hridVys[cil];
          const wIdNovy = hs.wId * s2.k;
          // reálný: skluz zpomalí hnanou řemenici (hnací strana = hid)
          const wReNovy = hs.wReal * s2.k * (1 - (s2.e.skluz || 0));
          if (!cs.dosazen) {
            cs.dosazen = true; cs.wId = wIdNovy; cs.wReal = wReNovy; cs.rodic = hid; cs.pres = s2.e.id;
            stromove.add(s2.e.id); poradi.push(cil); fronta.push(cil);
            vazbyInfo[s2.e.id].hnaci = s2.z.id; vazbyInfo[s2.e.id].hnana = s2.na.id;
          } else if (!stromove.has(s2.e.id) && !hlaseno.has(s2.e.id)) {
            hlaseno.add(s2.e.id);
            const smycka = cestaVeStromu(hridVys, hid, cil).concat(s2.e.id);
            vazbyInfo[s2.e.id].smycka = true;
            const shoda = Math.abs(cs.wId - wIdNovy) <= TOL_KIN * Math.max(Math.abs(cs.wId), Math.abs(wIdNovy), 1e-12);
            if (!shoda) {
              preurceno = true;
              const opacny = Math.sign(cs.wId) !== Math.sign(wIdNovy);
              zprava('chyba', 'preurceno', `Přeurčená soustava: smyčka ${smycka.join(' → ')} vyžaduje pro hřídel ${cil} ${opacny ? 'opačný smysl otáčení' : 'jiné otáčky'} (${fmt(Math.abs(cs.wId) / RPM, 3)} vs. ${fmt(Math.abs(wIdNovy) / RPM, 3)} min⁻¹). Mechanismus se zablokuje.`, smycka.concat([cil]));
            } else {
              zprava('varovani', 'smycka', `Uzavřená smyčka ${smycka.join(' → ')} je kinematicky slučitelná, ale staticky neurčitá: rozdělení momentu mezi větve nelze z kinematiky určit (počítá se jen přes kostru grafu, vazba ${s2.e.id} nepřenáší výkon). Pozor u řemenů se skluzem – slučitelnost platí jen ideálně.`, smycka);
            }
          }
        }
      }
      for (const h of n.hridele) if (!hridVys[h.id].dosazen) {
        zprava('varovani', 'nepohanen', `Hřídel ${h.id} není spojen se vstupem – nepohání se.`, [h.id]);
      }
    }

    /* --- toky výkonu (od listů ke vstupu) --- */
    const tokVazby = {};   // id → {PinId, PoutId, PinRe, PoutRe}
    for (const h of n.hridele) {
      const hs = hridVys[h.id];
      hs.nId = Math.abs(hs.wId) / RPM; hs.nReal = Math.abs(hs.wReal) / RPM;
      hs.smer = hs.wId > 0 ? 'ccw' : hs.wId < 0 ? 'cw' : null;
      hs.PzatId = 0; hs.PzatRe = 0;
      if (hs.dosazen && h.zatez) {
        if (h.zatez < 0) zprava('chyba', 'zatez', `Hřídel ${h.id}: zatížení musí být nezáporné (zadává se velikost odporu).`, [h.id]);
        else if (h.zatezDruh === 'vykon') { hs.PzatId = h.zatez * 1000; hs.PzatRe = h.zatez * 1000; }
        else { hs.PzatId = h.zatez * Math.abs(hs.wId); hs.PzatRe = h.zatez * Math.abs(hs.wReal); }
      }
      hs.PId = hs.PzatId; hs.PRe = hs.PzatRe;
    }
    if (!preurceno) {
      for (let i = poradi.length - 1; i > 0; i--) {
        const hid = poradi[i], hs = hridVys[hid];
        const e = n.vazby.find(x => x.id === hs.pres);
        const PinRe = hs.PRe / e.eta;
        tokVazby[e.id] = { PoutId: hs.PId, PinId: hs.PId, PoutRe: hs.PRe, PinRe };
        hridVys[hs.rodic].PId += hs.PId;
        hridVys[hs.rodic].PRe += PinRe;
      }
    }
    for (const h of n.hridele) {
      const hs = hridVys[h.id];
      hs.TId = hs.dosazen && hs.wId ? hs.PId / Math.abs(hs.wId) : 0;
      hs.TRe = hs.dosazen && hs.wReal ? hs.PRe / Math.abs(hs.wReal) : 0;
      hs.TzatId = hs.dosazen && hs.wId ? hs.PzatId / Math.abs(hs.wId) : 0;
      hs.TzatRe = hs.dosazen && hs.wReal ? hs.PzatRe / Math.abs(hs.wReal) : 0;
    }
    for (const id in tokVazby) {
      const t = tokVazby[id], vi = vazbyInfo[id];
      const ha = hridVys[K.get(vi.hnaci).hridel], hb = hridVys[K.get(vi.hnana).hridel];
      t.ThnaciId = t.PinId / Math.abs(ha.wId); t.ThnanaId = t.PoutId / Math.abs(hb.wId);
      t.ThnaciRe = t.PinRe / Math.abs(ha.wReal); t.ThnanaRe = t.PoutRe / Math.abs(hb.wReal);
      // obvodová rychlost a obvodová síla na roztečné kružnici hnací komponenty (jen informativně)
      const ka = K.get(vi.hnaci);
      const r = rozdelovaciPrumer(ka) / 2000;
      t.v = Math.abs(ha.wReal) * r;
      t.FtRe = r > 0 ? t.ThnaciRe / r : 0;
      vi.tok = t;
    }

    /* --- souhrn vstup → výstup --- */
    const souhrn = { platny: false };
    const vs = vstup.hridel && hridVys[vstup.hridel], vy = n.vystup && hridVys[n.vystup];
    if (vs && vy && vs.dosazen && vy.dosazen && !preurceno) {
      souhrn.platny = true;
      souhrn.iId = Math.abs(vs.wId / vy.wId);
      souhrn.iRe = Math.abs(vs.wReal / vy.wReal);
      souhrn.znamenko = Math.sign(vs.wId) === Math.sign(vy.wId) ? 1 : -1;
      // cesta ve stromu od výstupu ke vstupu
      const cesta = [];
      let h = n.vystup;
      while (h && h !== vstup.hridel) { cesta.unshift(hridVys[h].pres); h = hridVys[h].rodic; }
      souhrn.cesta = cesta;
      souhrn.stupnu = cesta.length;
      souhrn.etaCesta = cesta.reduce((s, id) => s * n.vazby.find(x => x.id === id).eta, 1);
      souhrn.PvstId = vs.PId; souhrn.PvstRe = vs.PRe;
      souhrn.TvstId = vs.TId; souhrn.TvstRe = vs.TRe;
      souhrn.nVst = vs.nId;
      souhrn.nVysId = vy.nId; souhrn.nVysRe = vy.nReal;
      souhrn.smerVys = vy.smer;
      souhrn.TvysId = vy.TzatId; souhrn.TvysRe = vy.TzatRe;
      souhrn.PvysId = vy.PzatId; souhrn.PvysRe = vy.PzatRe;
      const Pz = n.hridele.reduce((s, x) => s + hridVys[x.id].PzatRe, 0);
      souhrn.etaCelk = vs.PRe > 0 ? Pz / vs.PRe : null;
      souhrn.ztraty = vs.PRe - Pz;
    } else if (vy && !vy.dosazen && n.vystup) {
      zprava('varovani', 'vystup', `Výstupní hřídel ${n.vystup} není spojen se vstupem.`, [n.vystup]);
    }

    const poradiUrovni = { chyba: 0, varovani: 1, info: 2 };
    zpravy.sort((a, b) => poradiUrovni[a.uroven] - poradiUrovni[b.uroven]);
    return {
      navrh: n, hridele: hridVys, vazby: vazbyInfo, souhrn, zpravy, preurceno,
      pocet: { chyby: zpravy.filter(z => z.uroven === 'chyba').length, varovani: zpravy.filter(z => z.uroven === 'varovani').length },
    };
  }

  function cestaVeStromu(hv, a, b) {
    // vazby na cestě z a do b po stromu (přes nejbližšího společného předka)
    const predci = h => { const r = []; while (h) { r.push(h); h = hv[h].rodic; } return r; };
    const pa = predci(a), pb = predci(b);
    const sb = new Set(pb);
    const spol = pa.find(x => sb.has(x));
    const hrany = [];
    for (let h = a; h !== spol; h = hv[h].rodic) hrany.push(hv[h].pres);
    const zb = [];
    for (let h = b; h !== spol; h = hv[h].rodic) zb.push(hv[h].pres);
    return hrany.concat(zb.reverse());
  }

  /* ---------- fáze zubů pro animaci (aby zuby v záběru do sebe zapadaly) ---------- */
  /* Úhel komponenty v čase t: faze[k] + ω_hřídele · t. Zub č. 0 kreslíme na úhlu 0. */
  function faze(vysledek) {
    const n = vysledek.navrh, H = mapa(n.hridele), K = mapa(n.komponenty);
    const f = {};
    for (const k of n.komponenty) f[k.id] = 0;
    const hv = vysledek.hridele;
    // posloupnost stromových vazeb ve stejném pořadí jako průchod (podle rodičů)
    const hotovo = new Set([n.vstup.hridel]);
    let zmena = true;
    while (zmena) {
      zmena = false;
      for (const h of n.hridele) {
        const s = hv[h.id];
        if (hotovo.has(h.id) || !s.rodic || !hotovo.has(s.rodic)) continue;
        const e = n.vazby.find(x => x.id === s.pres);
        const vi = vysledek.vazby[e.id];
        const ka = K.get(vi.hnaci), kb = K.get(vi.hnana);
        if (e.typ === 'zaber') {
          const ha = H.get(ka.hridel), hb = H.get(kb.hridel);
          const phi = Math.atan2(hb.y - ha.y, hb.x - ha.x);   // směr a → b
          const frac = x => x - Math.floor(x);
          const tau = 2 * Math.PI;
          if (ka.typ === 'kolo' && kb.typ === 'kolo') {
            // u_a + u_b ≡ 1/2, u = frac((úhel bodu dotyku − úhel kola)·z/2π)
            const ua = frac((phi - f[ka.id]) * ka.z / tau);
            const ub = 0.5 - ua;
            f[kb.id] = (phi + Math.PI) - ub * tau / kb.z;
          } else {
            // vnitřní záběr: bod dotyku leží ve směru od středu věnce ke středu pastorku
            const vn = ka.typ === 'vnitrni' ? ka : kb, pa = vn === ka ? kb : ka;
            const hv_ = H.get(vn.hridel), hp = H.get(pa.hridel);
            const psi = Math.atan2(hp.y - hv_.y, hp.x - hv_.x);
            // u_pastorek − u_věnec ≡ 1/2
            if (kb === vn) {
              const up = frac((psi - f[pa.id]) * pa.z / tau);
              f[vn.id] = psi - (up - 0.5) * tau / vn.z;
            } else {
              const uv = frac((psi - f[vn.id]) * vn.z / tau);
              f[pa.id] = psi - (uv + 0.5) * tau / pa.z;
            }
          }
        }
        hotovo.add(h.id); zmena = true;
      }
    }
    return f;
  }

  /* ---------- úpravy návrhu ---------- */
  /* Posune hřídel hnané (druhé) strany vazby tak, aby osová vzdálenost odpovídala záběru
   * (nebo doporučené vzdálenosti u řemene/řetězu). Vrací nový návrh. */
  function dorovnej(navrh, vazbaId, kterou) {
    const n = normalizuj(navrh), K = mapa(n.komponenty), H = mapa(n.hridele);
    const e = n.vazby.find(x => x.id === vazbaId);
    if (!e) return n;
    const ka = K.get(e.a), kb = K.get(e.b);
    if (!ka || !kb) return n;
    const pevna = kterou === 'a' ? kb : ka, posun = kterou === 'a' ? ka : kb;
    const hp = H.get(pevna.hridel), hm = H.get(posun.hridel);
    if (!hp || !hm || hp === hm) return n;
    let cil = doporucenaVzdalenost(e, ka, kb);
    if (!(cil > 0)) return n;
    let dx = hm.x - hp.x, dy = hm.y - hp.y, l = Math.hypot(dx, dy);
    if (l < 1e-9) { dx = 1; dy = 0; l = 1; }
    hm.x = hp.x + dx / l * cil; hm.y = hp.y + dy / l * cil;
    return n;
  }
  function doporucenaVzdalenost(e, ka, kb) {
    if (e.typ === 'zaber') {
      if (Math.abs(ka.m - kb.m) > 1e-9) return null;
      return pozadovanaOsovaVzdalenost(e, ka, kb);
    }
    if (e.typ === 'retez') return Math.max(40 * ka.p, (obrys(ka).rout + obrys(kb).rout) * 1.3);
    if (e.typ === 'remen') return Math.max(ka.d + kb.d, (obrys(ka).rout + obrys(kb).rout) * 1.2);
    return null;
  }

  /* Přidá vazbu mezi dvěma komponentami (typ se určí automaticky). Vrací {navrh, chyba, id}. */
  function propoj(navrh, idA, idB) {
    const n = normalizuj(navrh), K = mapa(n.komponenty);
    const ka = K.get(idA), kb = K.get(idB);
    if (!ka || !kb) return { navrh: n, chyba: 'Komponenta neexistuje.' };
    if (ka === kb) return { navrh: n, chyba: 'Vyberte dvě různé komponenty.' };
    if (ka.hridel === kb.hridel) return { navrh: n, chyba: 'Komponenty na stejném hřídeli se otáčejí společně – propojte komponenty na různých hřídelích.' };
    const typ = typVazbyPro(ka, kb);
    if (!typ) return { navrh: n, chyba: `${TYPY[ka.typ].nazev} a ${TYPY[kb.typ].nazev.toLowerCase()} spolu nelze spojit (záběr jen ozubení–ozubení, řemen jen řemenice, řetěz jen řetězová kola; dvě vnitřní kola nezabírají).` };
    if (n.vazby.some(e => (e.a === idA && e.b === idB) || (e.a === idB && e.b === idA))) return { navrh: n, chyba: 'Tyto komponenty už jsou spojeny.' };
    const id = noveId(n, 'V');
    const e = { id, typ, a: idA, b: idB, eta: VAZBY[typ].eta };
    if (typ === 'remen') { e.druh = 'klinovy'; e.skluz = DRUHY_REMENE.klinovy.skluz; e.eta = DRUHY_REMENE.klinovy.eta; e.krizeny = false; }
    n.vazby.push(e);
    return { navrh: n, id };
  }

  /* ---------- export / formát ---------- */
  function fmt(x, des) {
    if (x === null || x === undefined || !isFinite(x)) return '–';
    const s = (Math.round(x * Math.pow(10, des)) / Math.pow(10, des)).toFixed(des);
    const [cel, dese] = s.split('.');
    const neg = cel.startsWith('-');
    const c = (neg ? cel.slice(1) : cel).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const r = (neg ? '−' : '') + c + (dese ? ',' + dese : '');
    return r === '−0' || /^−0(,0+)?$/.test(r) ? r.slice(1) : r;
  }

  /* Porovnání dvou návrhů (výsledky spocitej). */
  function porovnej(rA, rB) {
    const radek = (nazev, fa, jednotka, des) => {
      const a = fa(rA), b = fa(rB);
      let rozdil = null;
      if (typeof a === 'number' && typeof b === 'number' && isFinite(a) && isFinite(b)) rozdil = b - a;
      return { nazev, a, b, rozdil, jednotka, des };
    };
    const s = r => r.souhrn.platny ? r.souhrn : null;
    return [
      radek('Komponent', r => r.navrh.komponenty.length, '', 0),
      radek('Vazeb', r => r.navrh.vazby.length, '', 0),
      radek('Stupňů na cestě vstup → výstup', r => s(r) ? s(r).stupnu : null, '', 0),
      radek('Převodový poměr i (ideální)', r => s(r) ? s(r).iId : null, '', 4),
      radek('Převodový poměr i (s účinností/skluzem)', r => s(r) ? s(r).iRe : null, '', 4),
      radek('Vstupní otáčky', r => s(r) ? s(r).nVst : null, 'min⁻¹', 1),
      radek('Výstupní otáčky (ideální)', r => s(r) ? s(r).nVysId : null, 'min⁻¹', 2),
      radek('Výstupní otáčky (reálné)', r => s(r) ? s(r).nVysRe : null, 'min⁻¹', 2),
      radek('Výstupní moment – zatížení', r => s(r) ? s(r).TvysRe : null, 'N·m', 2),
      radek('Vstupní moment (ideální)', r => s(r) ? s(r).TvstId : null, 'N·m', 3),
      radek('Vstupní moment (s účinností)', r => s(r) ? s(r).TvstRe : null, 'N·m', 3),
      radek('Vstupní výkon (s účinností)', r => s(r) ? s(r).PvstRe / 1000 : null, 'kW', 3),
      radek('Účinnost cesty vstup → výstup', r => s(r) ? s(r).etaCesta * 100 : null, '%', 2),
      radek('Ztráty', r => s(r) ? s(r).ztraty : null, 'W', 1),
      radek('Chyb / varování', r => r.pocet.chyby + ' / ' + r.pocet.varovani, '', 0),
    ];
  }

  /* ---------- ukázkové návrhy ---------- */
  function ukazky() {
    const u = {};
    u.jednoduche = {
      nazev: 'Jednoduché soukolí 20/50',
      hridele: [{ id: 'H1', x: 0, y: 0 }, { id: 'H2', x: 70, y: 0, zatez: 50 }],
      komponenty: [
        { id: 'K1', typ: 'kolo', hridel: 'H1', rovina: 0, z: 20, m: 2, alfa: 20 },
        { id: 'K2', typ: 'kolo', hridel: 'H2', rovina: 0, z: 50, m: 2, alfa: 20 },
      ],
      vazby: [{ id: 'V1', typ: 'zaber', a: 'K1', b: 'K2', eta: 0.98 }],
      vstup: { hridel: 'H1', n: 1450, smer: 'cw' }, vystup: 'H2',
    };
    // a1 = 2,5·(18 + 42)/2 = 75 mm; a2 = 3·(17 + 52)/2 = 103,5 mm (pod úhlem −35°)
    const a2 = 3 * (17 + 52) / 2;
    u.dvoustupnova = {
      nazev: 'Dvoustupňová převodovka (předlohový hřídel)',
      hridele: [{ id: 'H1', x: 0, y: 0 }, { id: 'H2', x: 75, y: 0 }, { id: 'H3', x: 75 + a2 * Math.cos(rad(-35)), y: a2 * Math.sin(rad(-35)), zatez: 120 }],
      komponenty: [
        { id: 'K1', typ: 'kolo', hridel: 'H1', rovina: 0, z: 18, m: 2.5, alfa: 20 },
        { id: 'K2', typ: 'kolo', hridel: 'H2', rovina: 0, z: 42, m: 2.5, alfa: 20 },
        { id: 'K3', typ: 'kolo', hridel: 'H2', rovina: 1, z: 17, m: 3, alfa: 20 },
        { id: 'K4', typ: 'kolo', hridel: 'H3', rovina: 1, z: 52, m: 3, alfa: 20 },
      ],
      vazby: [{ id: 'V1', typ: 'zaber', a: 'K1', b: 'K2', eta: 0.98 }, { id: 'V2', typ: 'zaber', a: 'K3', b: 'K4', eta: 0.98 }],
      vstup: { hridel: 'H1', n: 960, smer: 'cw' }, vystup: 'H3',
    };
    u.vnitrni = {
      nazev: 'Vnitřní ozubení – pastorek ve věnci',
      hridele: [{ id: 'H1', x: 0, y: 0 }, { id: 'H2', x: 0 + 2 * (60 - 18) / 2, y: 0, zatez: 80 }],
      komponenty: [
        { id: 'K1', typ: 'kolo', hridel: 'H1', rovina: 0, z: 18, m: 2, alfa: 20 },
        { id: 'K2', typ: 'vnitrni', hridel: 'H2', rovina: 0, z: 60, m: 2, alfa: 20 },
      ],
      vazby: [{ id: 'V1', typ: 'zaber', a: 'K1', b: 'K2', eta: 0.985 }],
      vstup: { hridel: 'H1', n: 1000, smer: 'ccw' }, vystup: 'H2',
    };
    u.kombinace = {
      nazev: 'Motor → řemen → převodovka → řetěz',
      hridele: [
        { id: 'H1', x: -60, y: 70 }, { id: 'H2', x: 120, y: 70 },
        { id: 'H3', x: 120 + 2 * (19 + 57) / 2, y: 70 }, { id: 'H4', x: 120 + 2 * (19 + 57) / 2, y: 70 + 12.7 * 40, zatez: 0.75, zatezDruh: 'vykon' },
      ],
      komponenty: [
        { id: 'K1', typ: 'remenice', hridel: 'H1', rovina: 0, d: 80 },
        { id: 'K2', typ: 'remenice', hridel: 'H2', rovina: 0, d: 200 },
        { id: 'K3', typ: 'kolo', hridel: 'H2', rovina: 1, z: 19, m: 2, alfa: 20 },
        { id: 'K4', typ: 'kolo', hridel: 'H3', rovina: 1, z: 57, m: 2, alfa: 20 },
        { id: 'K5', typ: 'retezove', hridel: 'H3', rovina: 2, z: 15, p: 12.7 },
        { id: 'K6', typ: 'retezove', hridel: 'H4', rovina: 2, z: 38, p: 12.7 },
      ],
      vazby: [
        { id: 'V1', typ: 'remen', a: 'K1', b: 'K2', eta: 0.96, skluz: 0.01, druh: 'klinovy', krizeny: false },
        { id: 'V2', typ: 'zaber', a: 'K3', b: 'K4', eta: 0.98 },
        { id: 'V3', typ: 'retez', a: 'K5', b: 'K6', eta: 0.97 },
      ],
      vstup: { hridel: 'H1', n: 1440, smer: 'cw' }, vystup: 'H4',
    };
    u.krizeny = {
      nazev: 'Křížený plochý řemen (obrácení smyslu)',
      hridele: [{ id: 'H1', x: 0, y: 0 }, { id: 'H2', x: 400, y: 0, zatez: 20 }],
      komponenty: [
        { id: 'K1', typ: 'remenice', hridel: 'H1', rovina: 0, d: 100 },
        { id: 'K2', typ: 'remenice', hridel: 'H2', rovina: 0, d: 160 },
      ],
      vazby: [{ id: 'V1', typ: 'remen', a: 'K1', b: 'K2', eta: 0.955, skluz: 0.015, druh: 'plochy', krizeny: true }],
      vstup: { hridel: 'H1', n: 1000, smer: 'cw' }, vystup: 'H2',
    };
    // tři vnější kola, každé zabírá s každým – smyčka s lichým počtem vnějších záběrů se zablokuje
    const r3 = 2 * (30 + 30) / 2; // a = m·(z₁ + z₂)/2 = 60 mm
    u.blokace = {
      nazev: 'Chyba: trojúhelník tří kol (zablokuje se)',
      hridele: [{ id: 'H1', x: 0, y: 0 }, { id: 'H2', x: r3, y: 0 }, { id: 'H3', x: r3 / 2, y: r3 * Math.sqrt(3) / 2, zatez: 10 }],
      komponenty: [
        { id: 'K1', typ: 'kolo', hridel: 'H1', rovina: 0, z: 30, m: 2, alfa: 20 },
        { id: 'K2', typ: 'kolo', hridel: 'H2', rovina: 0, z: 30, m: 2, alfa: 20 },
        { id: 'K3', typ: 'kolo', hridel: 'H3', rovina: 0, z: 30, m: 2, alfa: 20 },
      ],
      vazby: [
        { id: 'V1', typ: 'zaber', a: 'K1', b: 'K2', eta: 0.98 },
        { id: 'V2', typ: 'zaber', a: 'K2', b: 'K3', eta: 0.98 },
        { id: 'V3', typ: 'zaber', a: 'K3', b: 'K1', eta: 0.98 },
      ],
      vstup: { hridel: 'H1', n: 600, smer: 'cw' }, vystup: 'H3',
    };
    u.vratna = {
      nazev: 'Vratné soukolí (vstup a výstup souosé)',
      hridele: [{ id: 'H1', x: 0, y: 0 }, { id: 'H2', x: 0, y: -60 }, { id: 'H3', x: 0, y: 0, zatez: 30 }],
      komponenty: [
        { id: 'K1', typ: 'kolo', hridel: 'H1', rovina: 0, z: 20, m: 2, alfa: 20 },
        { id: 'K2', typ: 'kolo', hridel: 'H2', rovina: 0, z: 40, m: 2, alfa: 20 },
        { id: 'K3', typ: 'kolo', hridel: 'H2', rovina: 1, z: 25, m: 2, alfa: 20 },
        { id: 'K4', typ: 'kolo', hridel: 'H3', rovina: 1, z: 35, m: 2, alfa: 20 },
      ],
      vazby: [{ id: 'V1', typ: 'zaber', a: 'K1', b: 'K2', eta: 0.98 }, { id: 'V2', typ: 'zaber', a: 'K3', b: 'K4', eta: 0.98 }],
      vstup: { hridel: 'H1', n: 1500, smer: 'ccw' }, vystup: 'H3',
    };
    for (const k in u) u[k] = normalizuj(u[k]);
    return u;
  }

  const API = {
    TYPY, VAZBY, DRUHY_REMENE, RPM, TOL_VZD_MM,
    rozdelovaciPrumer, obrys, minZubu, normalizuj, typVazbyPro, prevodVazby, pozadovanaOsovaVzdalenost,
    delkaRemene, delkaRemenePresna, uhelOpasani, clankyRetezu, osovaProClanky, kolidujiMezikruzi,
    spocitej, faze, dorovnej, doporucenaVzdalenost, propoj, noveId, fmt, porovnej, ukazky,
  };
  if (typeof module !== 'undefined') module.exports = API; else window.PREVODY = API;
})();
