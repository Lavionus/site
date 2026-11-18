/* Náčrt místa činu ↔ jednotný spis: značka stopy ↔ entita `stopa` (S2), fotopozice ↔ fotka a kužel záběru (S5),
   náčrt v čase – polohy osob a vozidel podle událostí spisu (S8). Bez DOM (testy: _test/spis_napojeni_test.js,
   _test/spis_s4s5s8_test.js).
   Značka {t:'znacka', n, kat, popis, spis?: id entity}: číslo a popis se berou ze spisu (n = koncové číslo z `cislo`,
   popis = název stopy, kat podle druhu); úprava v náčrtu se zapíše zpět (číslo zachová předponu, např. D-03).
   Neznámá pole spisu se zachovají. */
(function () {
  'use strict';
  const KAT_DRUH = { bio: 'biologická stopa', bal: 'balistická stopa', dak: 'daktyloskopická stopa', tra: 'trasologická stopa',
    mik: 'mikrostopa', chem: 'chemická stopa', dig: 'digitální stopa', ost: 'věcná stopa' };
  const bezD = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function katZDruhu(druh) {
    const t = bezD(druh);
    if (/biolog|krev|dna|slin/.test(t)) return 'bio';
    if (/balist|naboj|strel|nabojnic/.test(t)) return 'bal';
    if (/daktylo|otisk prst|papil/.test(t)) return 'dak';
    if (/traso|obuv|slap|pneu|behoun/.test(t)) return 'tra';
    if (/mikro|vlak|vlas/.test(t)) return 'mik';
    if (/chem|toxi/.test(t)) return 'chem';
    if (/digit|listin|dokument/.test(t)) return 'dig';
    return 'ost';
  }
  const cisloZ = c => { const m = /(\d+)\s*$/.exec(String(c || '')); return m ? +m[1] : null; };
  // nové číslo n do textu čísla stopy: zachová předponu a počet číslic (D-01 → D-03)
  function cisloDo(n, puvodni) {
    const p = String(puvodni || '');
    if (cisloZ(p) === n) return p;
    const m = /^(.*?)(\d+)(\s*)$/.exec(p);
    return m ? m[1] + String(n).padStart(m[2].length, '0') + m[3] : String(n);
  }
  // co značka přebírá ze spisu
  function zeStopy(e, puvodniN) {
    const d = (e && e.data) || {}, n = cisloZ(d.cislo);
    return { n: n != null && n >= 1 ? n : puvodniN, popis: e.nazev, kat: katZDruhu(d.druh) };
  }
  // entita k zápisu; kdy = čas zajištění (nová stopa: teď, místní čas), misto = text místa z hlavičky náčrtu
  function doStopy(o, puvodni, kdy, misto) {
    const pd = (puvodni && puvodni.data) || {};
    const data = Object.assign({}, pd, {
      cislo: cisloDo(o.n, pd.cislo),
      druh: pd.druh && katZDruhu(pd.druh) === o.kat ? pd.druh : KAT_DRUH[o.kat] || KAT_DRUH.ost
    });
    if (!puvodni) { if (kdy) data.kdy = kdy; if (misto) data.misto = misto; }
    const nazev = String(o.popis || '').trim() || 'Stopa č. ' + o.n;
    return { id: o.spis || undefined, typ: 'stopa', nazev: nazev.slice(0, 300), data };
  }
  const klicZnacky = o => JSON.stringify([o.n, String(o.popis || '').trim(), o.kat]);

  /* ---------- S5: fotopozice ↔ fotka spisu ----------
     Fotopozice {t:'foto', x, y, rot (0 = nahoru/−y, π/2 = doprava), n, spis?: id entity foto, uhel?: ° ručně, dosah?: m}.
     Vodorovný úhel záběru z ohniska ekv. 35 mm (snímek 36 × 24 mm): na šířku 2·atan(18 / f35), na výšku (telefon)
     je vodorovně kratší strana 24 mm → 2·atan(12 / f35). */
  function uhelZaberu(exif, naVysku) {
    const f = exif ? Number(exif.ohnisko35) : NaN;
    return f > 0 ? 2 * Math.atan((naVysku ? 12 : 18) / f) * 180 / Math.PI : null;
  }
  // úhel pro kužel: ruční o.uhel má přednost, jinak EXIF fotky; { uhel (°), zdroj: 'rucne'|'exif' } | null
  function uhelFotopozice(o, foto) {
    if (Number(o.uhel) > 0 && Number(o.uhel) < 180) return { uhel: Number(o.uhel), zdroj: 'rucne' };
    const d = foto && foto.data, u = uhelZaberu(d && d.exif, d && d.w > 0 && d.h > d.w);   // w, h = rozměr po otočení podle EXIF
    return u ? { uhel: u, zdroj: 'exif', f35: Number(foto.data.exif.ohnisko35) } : null;
  }
  // obrys kužele: vrchol ve fotopozici, oblouk o poloměru delka (m) po n úsecích
  function kuzel(o, uhel, delka, n) {
    n = n || 12;
    const r = o.rot || 0, pul = uhel * Math.PI / 360, b = [{ x: o.x, y: o.y }];
    for (let i = 0; i <= n; i++) { const a = r - pul + 2 * pul * i / n; b.push({ x: o.x + Math.sin(a) * delka, y: o.y - Math.cos(a) * delka }); }
    return b;
  }
  // co náčrt zapisuje do fotky (foto.data.fotopozice) a které fotky je potřeba změnit:
  // obj = objekty náčrtu, fotky = Map(id → entita foto), → [{ id, fotopozice | null }]
  function zmenyFotopozic(obj, fotky, nacrtId, nazev) {
    const chci = new Map();
    for (const o of obj) if (o.t === 'foto' && o.spis && fotky.has(o.spis) && !chci.has(o.spis)) chci.set(o.spis, { nacrt: nacrtId, nazev: String(nazev || '').slice(0, 200), n: o.n });
    const out = [];
    for (const [id, f] of fotky) {
      const ted = f.data.fotopozice, nove = chci.get(id);
      if (nove) { if (JSON.stringify(ted) !== JSON.stringify(nove)) out.push({ id, fotopozice: nove }); }
      else if (ted && ted.nacrt === nacrtId) out.push({ id, fotopozice: null });   // odpojeno v tomto náčrtu
    }
    return out;
  }

  /* ---------- S8: náčrt v čase ----------
     S.polohy = [{ id, udalost (id události spisu), kdo? (id osoby / vozidla; bez něj jen značka místa události),
                   x, y (m), cesta?: [{x,y}] (body trasy od předchozí polohy téhož kdo), cas?: 'cele'|'kdy'|'do' }]
     Čas polohy = čas události (kdy, u 'cele' se interval kdy–do drží na místě). Mezi polohami téhož kdo se
     poloha interpoluje lineárně po trase; před první a po poslední poloze se objekt nekreslí. */
  const RE_CAS = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/;
  // místní čas spisu (bez pásma) → ms na ose (UTC jen jako počítadlo, nezávisle na pásmu prohlížeče)
  const casMs = t => { const m = RE_CAS.exec(String(t || '')); return m ? Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) : NaN; };
  const casText = ms => new Date(ms).toISOString().slice(0, 19);
  const vzd = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const ziskej = (u, id) => u instanceof Map ? u.get(id) : u[id];
  function casyPolohy(p, u) {
    const t0 = casMs(u.data.kdy), t1 = u.data.do ? casMs(u.data.do) : t0;
    if (!Number.isFinite(t0)) return [];
    if (p.cas === 'kdy') return [t0];
    if (p.cas === 'do') return [Number.isFinite(t1) ? t1 : t0];
    return Number.isFinite(t1) && t1 > t0 ? [t0, t1] : [t0];
  }
  // klíčové body: Map(kdo → [{ t, x, y, cesta, udalost }]) seřazené podle času
  function klicoveBody(polohy, udalosti) {
    const m = new Map();
    for (const p of polohy || []) {
      const u = p && p.kdo && ziskej(udalosti, p.udalost);
      if (!u || u.smazano || !Number.isFinite(+p.x) || !Number.isFinite(+p.y)) continue;
      casyPolohy(p, u).forEach((t, i) => {
        if (!m.has(p.kdo)) m.set(p.kdo, []);
        m.get(p.kdo).push({ t, x: +p.x, y: +p.y, cesta: i === 0 && Array.isArray(p.cesta) ? p.cesta : [], udalost: p.udalost });
      });
    }
    for (const b of m.values()) b.sort((a, c) => a.t - c.t);
    return m;
  }
  // bod na lomené čáře v podílu f délky; vrací i směr úseku (rad, 0 = nahoru jako rot fotopozice)
  function naTrase(body, f) {
    const usek = [];
    let celk = 0;
    for (let i = 1; i < body.length; i++) { const d = vzd(body[i - 1], body[i]); usek.push(d); celk += d; }
    if (celk < 1e-9) return { x: body[0].x, y: body[0].y, smer: null };
    let zbyva = Math.max(0, Math.min(1, f)) * celk;
    for (let i = 0; i < usek.length; i++) {
      const a = body[i], b = body[i + 1];
      if (zbyva <= usek[i] || i === usek.length - 1) {
        const k = usek[i] ? Math.min(1, zbyva / usek[i]) : 0;
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, smer: usek[i] ? Math.atan2(b.x - a.x, -(b.y - a.y)) : null };
      }
      zbyva -= usek[i];
    }
    return null;
  }
  // poloha v čase t: { x, y, smer (rad | null), stoji, udalost } | null mimo rozsah
  function polohaV(body, t) {
    if (!body || !body.length || t < body[0].t || t > body[body.length - 1].t) return null;
    let i = 0;
    while (i < body.length - 1 && body[i + 1].t <= t) i++;
    const a = body[i], b = body[i + 1];
    const smerOkoli = () => {   // stojící objekt drží směr poslední (jinak příští) jízdy
      for (let j = i; j > 0; j--) { const r = naTrase([body[j - 1]].concat(body[j].cesta, [body[j]]), 1); if (r && r.smer !== null) return r.smer; }
      for (let j = i + 1; j < body.length; j++) { const r = naTrase([body[j - 1]].concat(body[j].cesta, [body[j]]), 0); if (r && r.smer !== null) return r.smer; }
      return null;
    };
    if (!b) return { x: a.x, y: a.y, smer: smerOkoli(), stoji: true, udalost: a.udalost };
    const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1, r = naTrase([a].concat(b.cesta, [b]), f);
    const stoji = r.smer === null;
    return { x: r.x, y: r.y, smer: stoji ? smerOkoli() : r.smer, stoji, udalost: f < 1 ? a.udalost : b.udalost };
  }
  // události s polohou v plánku (pro skok a značky): [{ udalost, t, t1, x, y, kdo }] podle času
  function udalostiVPlanu(polohy, udalosti) {
    const r = [];
    for (const p of polohy || []) {
      const u = p && ziskej(udalosti, p.udalost);
      if (!u || u.smazano) continue;
      const t = casMs(u.data.kdy), t1 = u.data.do ? casMs(u.data.do) : t;
      if (Number.isFinite(t)) r.push({ udalost: p.udalost, t, t1: Number.isFinite(t1) ? t1 : t, x: +p.x, y: +p.y, kdo: p.kdo || null });
    }
    return r.sort((a, b) => a.t - b.t);
  }
  // rozsah posuvníku: od první do poslední polohy s okrajem 2 min; null = žádná událost s polohou
  function rozsahCasu(polohy, udalosti) {
    const u = udalostiVPlanu(polohy, udalosti);
    if (!u.length) return null;
    return { od: u[0].t - 120000, do: Math.max(...u.map(x => x.t1)) + 120000 };
  }

  /* ---------- modelový případ 17/2026 (sedí s vysetrovani/pripad.js – ten se nemění) ----------
     Fotopozice F1–F4 ↔ ukázkové fotky Fotodokumentace (model-17-foto-1…4, ohnisko v jejich EXIF) a polohy v čase:
     tmavé kombi 01:52 přijíždí od čerpací stanice (událost 4), 01:58 stojí u prodejny (začátek polohy telefonu,
     událost 8), 02:08 rozbití výlohy (5), 02:10 svědkyně vidí kombi u prodejny (6), 02:14 únik přes křižovatku
     Hlavní × K Lesu (7). Křižovatka je v plánku blíž, než je (140 m) – úsek ulice je vyznačen jako zkrácený. */
  function modelovyNacrt(pripad) {
    const p = pripad || 'model-17', U = i => p + '-udalost-' + i, AUTO = p + '-vozidlo-octavia', FIALA = p + '-osoba-fiala';
    return {
      fotopozice: [
        { n: 1, x: 4, y: 15.4, rot: 0, dosah: 9.5, spis: p + '-foto-1', popis: 'celkový pohled z protějšího chodníku na průčelí prodejny' },
        { n: 2, x: 5.05, y: 4.4, rot: Math.PI, dosah: 1.6, spis: p + '-foto-2', popis: 'detail střepů s krevní stopou pod výlohou (stopa 1)' },
        { n: 3, x: 6.2, y: 3.3, rot: Math.PI, dosah: 1.3, spis: p + '-foto-3', popis: 'šlápěcí stopa obuvi s L-měřítkem (stopa 2)' },
        { n: 4, x: 2.9, y: -3.2, rot: Math.atan2(2.4, 1.25), dosah: 3.5, spis: p + '-foto-4', popis: 'dvůr – popelnice a odhozené páčidlo (stopa 3)' }
      ],
      polohy: [
        { id: 'mp-auto-1', udalost: U(4), kdo: AUTO, x: -2.5, y: 10.1, cas: 'kdy' },
        { id: 'mp-auto-2', udalost: U(8), kdo: AUTO, x: 9, y: 10.1, cas: 'kdy' },
        { id: 'mp-auto-3', udalost: U(6), kdo: AUTO, x: 9, y: 10.1 },
        { id: 'mp-auto-4', udalost: U(7), kdo: AUTO, x: 15.5, y: 10.1, cesta: [{ x: 11, y: 10.1 }] },
        { id: 'mp-fiala', udalost: U(8), kdo: FIALA, x: 6.6, y: 7.7 },
        { id: 'mp-vyloha', udalost: U(5), x: 4.5, y: 6.15 }
      ]
    };
  }

  const api = { KAT_DRUH, katZDruhu, cisloZ, cisloDo, zeStopy, doStopy, klicZnacky,
    uhelZaberu, uhelFotopozice, kuzel, zmenyFotopozic,
    casMs, casText, klicoveBody, naTrase, polohaV, udalostiVPlanu, rozsahCasu, modelovyNacrt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.NacrtSpis = api;
})();
