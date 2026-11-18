/* Nástěnka vyšetřovatele – model bez DOM (window.NASTENKA, v node module.exports).
   Plocha je běžná tabule Whiteboardu (objekty WB_JADRO), jen s vazbou na jednotný spis:
     kartička  = listek { entita: id entity spisu }   – text, barva a výška se počítají z aktuální entity
     provázek  = cara   { vazba: id vazby spisu, zac, kon = id kartiček } – barva a styl podle typu vazby
     poznámka  = listek bez entity (text píše vyšetřovatel)
   zvýraznění = { zvyr: true } na kartičce/poznámce.
   Rozložení se ukládá ke spisu jako entita dokument { druh: 'nástěnka', nastenka: { verze, objekty, kamera } }
   – je tak v balíčku spisu a přenáší se s ním (pole `nastenka` smlouva spisu zachovává beze změny). */
(function (koren) {
  'use strict';
  const J = koren.WB_JADRO || (typeof require === 'function' ? require('../whiteboard/jadro.js') : null);

  const VERZE = 1, DRUH = 'nástěnka', NASTROJ = 'nastenka';
  const SIRKA = 200, VELIKOST = 14, FOTO = 120;        // rozměry kartičky ve světě
  const BARVY_TYPU = { osoba: '#fff1a8', stopa: '#cfe6ff', misto: '#d6f2cc', udalost: '#ffdcb8', foto: '#ececec',
    dokument: '#e6dcff', vozidlo: '#cdeeee', telefon: '#ffd6e6', ucet: '#ecebc4' };
  const BARVA_POZNAMKY = '#fff59d', BARVA_SMAZANE = '#c9c9c9';
  // typy vazeb, které nabízí nástěnka při nakreslení provázku (pořadí v nabídce)
  const TYPY_VAZEB = ['souvisi', 'potvrzuje', 'vyvraci', 'hovor', 'drzitel', 'zna', 'byl_na', 'nalezeno_na', 'tyka_se', 'platba'];
  // kategorie provázku → vzhled; barva je token, skutečnou barvu dosadí stránka podle tématu
  const KATEGORIE = {
    rozpor: { barva: 'rozpor', sirka: 3, styl: 'plna', nazev: 'rozpor – vyvrací' },
    overeno: { barva: 'overeno', sirka: 3, styl: 'plna', nazev: 'ověřeno – potvrzuje' },
    tvrzeni: { barva: 'neutralni', sirka: 2, styl: 'carky', nazev: 'tvrzení (neověřeno)' },
    neutralni: { barva: 'neutralni', sirka: 2, styl: 'plna', nazev: 'ostatní vazby' }
  };
  const VYCHOZI_BARVY = { rozpor: '#d32f2f', overeno: '#2e7d32', neutralni: '#6b6b6b', smazane: '#9e9e9e' };

  const id = () => 'n' + J.noveId();
  const T0 = s => s;
  const kopie = o => JSON.parse(JSON.stringify(o));
  const cas = s => {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s || '');
    return m ? `${+m[3]}. ${+m[2]}. ${m[4]}:${m[5]}` : '';
  };
  const hodiny = s => { const m = /T(\d{2}):(\d{2})/.exec(s || ''); return m ? m[1] + ':' + m[2] : ''; };
  const zkrat = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; };

  /* ---------- kartička ↔ entita ---------- */
  // řádky kartičky: typ, název, nejdůležitější údaje (data uživatele zůstávají tak, jak jsou ve spisu)
  function textKarty(e, T = T0, typy) {
    const Ty = (typy || {})[e.typ] || { ikona: '', nazev: e.typ };
    const d = e.data || {}, r = [];
    const jistota = { overeno: 'ověřeno', pravdepodobne: 'pravděpodobné', tvrzeni: 'jen tvrzení' };
    switch (e.typ) {
      case 'osoba': if (d.role) r.push(d.role); if (d.vyska) r.push(T('výška') + ' ' + d.vyska + ' cm'); break;
      case 'stopa': r.push([d.cislo ? T('č.') + ' ' + d.cislo : '', d.druh].filter(Boolean).join(' · ')); if (d.stav) r.push(d.stav); break;
      case 'misto': if (d.adresa) r.push(d.adresa); break;
      case 'udalost': r.push(cas(d.kdy) + (d.do ? ' – ' + (d.do.slice(0, 10) === (d.kdy || '').slice(0, 10) ? hodiny(d.do) : cas(d.do)) : ''));
        if (d.jistota) r.push(T(jistota[d.jistota] || d.jistota)); break;
      case 'foto': if (d.popis) r.push(zkrat(d.popis, 80)); break;
      case 'dokument': if (d.druh) r.push(d.druh); if (d.popis) r.push(zkrat(d.popis, 90)); break;
      case 'vozidlo': if (d.rz && !e.nazev.includes(d.rz)) r.push(d.rz); break;
      case 'telefon': if (d.cislo && !e.nazev.includes(d.cislo)) r.push(d.cislo); if (d.imei) r.push('IMEI ' + d.imei); break;
      case 'ucet': r.push([d.cislo, d.banka].filter(Boolean).join(' · ')); break;
    }
    const hlava = (Ty.ikona ? Ty.ikona + ' ' : '') + T(Ty.nazev).toUpperCase();
    return [hlava, zkrat(e.nazev, 140), ...r.filter(Boolean)].join('\n');
  }
  function vyskaKarty(o) {
    const radku = J.zalom(o.text, o.w - 2 * J.OKRAJ_LISTKU, o).length;
    return Math.ceil(radku * o.velikost * J.RADEK + 2 * J.OKRAJ_LISTKU + (o.foto ? FOTO : 0));
  }
  // aktualizuje kartičku podle entity (e = null → entita ve spisu chybí); vrací true, když se vzhled změnil
  function obnovKartu(o, e, T = T0, typy) {
    const pred = o.text + '|' + o.barva + '|' + o.h + '|' + !!o.smazana + '|' + (o.foto || '');
    if (!e || e.smazano) {
      o.smazana = true;
      // smazaná entita: její poslední údaje; chybějící: poslední uložený text kartičky
      const zaklad = e ? textKarty(e, T, typy) : String(o.text || '').split('\n').filter(r => !/^⚠ /.test(r)).join('\n');
      o.text = '⚠ ' + T(e ? 'smazáno ve spisu' : 've spisu chybí') + '\n' + zaklad;
      o.barva = BARVA_SMAZANE;
      delete o.foto;
    } else {
      delete o.smazana;
      o.text = textKarty(e, T, typy);
      o.barva = BARVY_TYPU[e.typ] || BARVA_POZNAMKY;
      if (e.typ === 'foto' && e.data && e.data.soubor) o.foto = e.data.soubor; else delete o.foto;
    }
    o.h = vyskaKarty(o);
    J.zneplatni(o);
    return pred !== o.text + '|' + o.barva + '|' + o.h + '|' + !!o.smazana + '|' + (o.foto || '');
  }
  function kartaZEntity(e, x, y, T = T0, typy) {
    const o = { id: id(), typ: 'listek', entita: e.id, x: Math.round(x), y: Math.round(y), w: SIRKA, h: 60, barva: BARVA_POZNAMKY, text: '', velikost: VELIKOST, pismo: 'sans' };
    obnovKartu(o, e, T, typy);
    return o;
  }
  function poznamka(text, x, y) {
    const o = { id: id(), typ: 'listek', x: Math.round(x), y: Math.round(y), w: SIRKA, h: 60, barva: BARVA_POZNAMKY, text: '📝 ' + String(text || '').replace(/^📝 /, ''), velikost: VELIKOST, pismo: 'sans' };
    o.h = vyskaKarty(o);
    return o;
  }
  const jeKarta = o => o && o.typ === 'listek' && typeof o.entita === 'string';
  const jeProvazek = o => o && o.typ === 'cara' && typeof o.vazba === 'string';
  const kartaEntity = (stav, eid) => stav.objekty.find(o => jeKarta(o) && o.entita === eid) || null;
  const provazekVazby = (stav, vid) => stav.objekty.find(o => jeProvazek(o) && o.vazba === vid) || null;

  /* ---------- provázek ↔ vazba ---------- */
  // kategorie podle typu vazby; „tvrzení“ = vazba vede z/do události, která je jen tvrzením
  function kategorieVazby(v, mapa) {
    if (v.typ === 'vyvraci') return 'rozpor';
    if (v.typ === 'potvrzuje') return 'overeno';
    const tvrzeni = x => x && x.typ === 'udalost' && x.data && x.data.jistota === 'tvrzeni';
    if (mapa && (tvrzeni(mapa.get(v.od)) || tvrzeni(mapa.get(v.do)))) return 'tvrzeni';
    return 'neutralni';
  }
  function popisekVazby(v, nazevVazby, T = T0) {
    return T(nazevVazby ? nazevVazby(v.typ) : v.typ) + (v.kdy ? ' ' + hodiny(v.kdy) : '');
  }
  // aktualizuje provázek podle vazby (v = null → vazba ve spisu chybí); barvy = {rozpor, overeno, neutralni, smazane}
  function obnovProvazek(c, v, mapa, { barvy = VYCHOZI_BARVY, nazevVazby = null, T = T0 } = {}) {
    if (!v || v.smazano) {
      c.smazana = true; delete c.kategorie;
      c.barva = barvy.smazane; c.sirka = 2; c.styl = 'tecky';
      c.text = (v ? popisekVazby(v, nazevVazby, T) + ' – ' : '') + T(v ? 'smazáno' : 'chybí ve spisu');
    } else {
      delete c.smazana;
      const k = KATEGORIE[kategorieVazby(v, mapa)];
      c.barva = barvy[k.barva]; c.sirka = k.sirka; c.styl = k.styl;
      c.text = popisekVazby(v, nazevVazby, T);
      c.kategorie = kategorieVazby(v, mapa);
    }
    J.zneplatni(c);
  }
  function provazekZVazby(v, od, kam, mapa, volby) {
    const c = { id: id(), typ: 'cara', vazba: v.id, zac: od.id, kon: kam.id, x1: 0, y1: 0, x2: 0, y2: 0, sipkaK: true, sipkaZ: false,
      trasa: 'prima', velikost: 13, pismo: 'sans', barva: '#6b6b6b', sirka: 2, styl: 'plna' };
    obnovProvazek(c, v, mapa, volby);
    return c;
  }

  /* ---------- plocha ---------- */
  const prazdny = () => ({ verze: VERZE, objekty: [], kamera: { x: -100, y: -100, z: 1 } });
  // odvozená pole (text kartičky, barvy provázku…) se ukládají taky – jsou záložním obsahem, když entita chybí
  function serializuj(stav) {
    return { verze: VERZE, objekty: stav.objekty.map(o => { const k = kopie(o); delete k.smazana; delete k.kategorie; return k; }),
      kamera: { x: Math.round(stav.kamera.x), y: Math.round(stav.kamera.y), z: Math.round(stav.kamera.z * 1000) / 1000 } };
  }
  // kontrola uloženého rozložení (může přijít z importovaného balíčku) – neplatné objekty se vynechají
  function nactiStav(data) {
    const s = prazdny();
    if (!data || typeof data !== 'object' || !Array.isArray(data.objekty)) return s;
    const ok = o => J.platnyObjekt(o) && (o.typ === 'listek' || o.typ === 'cara') && (o.entita === undefined || typeof o.entita === 'string') && (o.vazba === undefined || typeof o.vazba === 'string');
    s.objekty = data.objekty.filter(ok).map(kopie);
    const ids = new Set(s.objekty.map(o => o.id));
    // provázek bez obou kartiček na ploše nemá smysl
    s.objekty = s.objekty.filter(o => !jeProvazek(o) || (ids.has(o.zac) && ids.has(o.kon)));
    const k = data.kamera;
    if (k && [k.x, k.y, k.z].every(Number.isFinite) && k.z > 0.02 && k.z < 20) s.kamera = { x: k.x, y: k.y, z: k.z };
    return s;
  }
  // obnoví všechny kartičky a provázky podle spisu: entity / vazby = Map(id → záznam vč. smazaných)
  function obnovVse(stav, entity, vazby, volby = {}) {
    let zmena = false;
    for (const o of stav.objekty) {
      if (jeKarta(o)) zmena = obnovKartu(o, entity.get(o.entita) || null, volby.T, volby.typy) || zmena;
    }
    for (const o of stav.objekty) if (jeProvazek(o)) obnovProvazek(o, vazby.get(o.vazba) || null, entity, volby);
    // víc provázků mezi stejnými kartičkami leží přes sebe – popisky se spojí do prvního
    const dvojice = new Map();
    for (const o of stav.objekty) if (jeProvazek(o)) { const k = [o.zac, o.kon].sort().join('|'); if (!dvojice.has(k)) dvojice.set(k, []); dvojice.get(k).push(o); }
    for (const g of dvojice.values()) if (g.length > 1) { g[0].text = g.map(c => c.text).join(', '); for (const c of g.slice(1)) c.text = ''; }
    J.prepoj(stav.objekty);
    return zmena;
  }

  // přidá kartičky entit, které na ploše chybí, do kruhu kolem bodu (cx, cy); vrací nové kartičky
  function rozmistiKolem(stav, entity, cx, cy, volby = {}) {
    const nove = [];
    const n = entity.length, r = 300 + Math.max(0, n - 6) * 30;
    entity.forEach((e, i) => {
      const u = -Math.PI / 2 + i * 2 * Math.PI / Math.max(n, 1);
      const k = kartaZEntity(e, cx + r * Math.cos(u) - SIRKA / 2, cy + r * Math.sin(u) * 0.75 - 40, volby.T, volby.typy);
      stav.objekty.unshift(k);           // kartičky pod provázky
      nove.push(k);
    });
    return nove;
  }

  // „zobrazit vazby vybraných“: provázky všech vazeb vybraných entit; chybějící protějšky se přidají kolem
  // vybrané kartičky. entity/vazby = Map; vrací { provazky, karty } (počty přidaných)
  function zobrazVazby(stav, vybraneEntity, entity, vazby, volby = {}) {
    let provazky = 0, karty = 0;
    for (const eid of vybraneEntity) {
      const zdroj = kartaEntity(stav, eid);
      if (!zdroj) continue;
      const chybi = [];
      const jeho = [...vazby.values()].filter(v => !v.smazano && (v.od === eid || v.do === eid));
      for (const v of jeho) {
        const jine = v.od === eid ? v.do : v.od, e = entity.get(jine);
        if (!kartaEntity(stav, jine) && e && !e.smazano && !chybi.includes(e)) chybi.push(e);
      }
      karty += rozmistiKolem(stav, chybi, zdroj.x + zdroj.w / 2, zdroj.y + zdroj.h / 2, volby).length;
      for (const v of jeho) {
        if (provazekVazby(stav, v.id)) continue;
        const a = kartaEntity(stav, v.od), b = kartaEntity(stav, v.do);
        if (!a || !b) continue;
        stav.objekty.push(provazekZVazby(v, a, b, entity, volby));
        provazky++;
      }
    }
    J.prepoj(stav.objekty);
    return { provazky, karty };
  }
  // odebrání z plochy (spis se nemění); s kartičkou odejdou i její provázky
  function odeber(stav, ids) {
    const pryc = new Set(ids);
    for (const o of stav.objekty) if (jeProvazek(o) && (pryc.has(o.zac) || pryc.has(o.kon))) pryc.add(o.id);
    const pred = stav.objekty.length;
    stav.objekty = stav.objekty.filter(o => !pryc.has(o.id));
    return pred - stav.objekty.length;
  }

  /* ---------- uložení ke spisu ---------- */
  const jeDokumentNastenky = e => e && e.typ === 'dokument' && e.data && e.data.druh === DRUH && e.data.nastenka && typeof e.data.nastenka === 'object';
  // dokument nástěnky aktivního (nebo zadaného) případu – nejnovější nesmazaný
  async function najdiDokument(S, pripad) {
    const v = await S.seznam('dokument', { pripad, fn: jeDokumentNastenky });
    return v.sort((a, b) => String(b.upraveno).localeCompare(String(a.upraveno)))[0] || null;
  }
  // Existující dokument si ponechá název, popis i pole jiných nástrojů – mění se jen rozložení. Do historie spisu
  // jde jen souhrn („nástěnka změněna“), ne celé rozložení před/po – jinak by historie i balíček rostly s každým tahem.
  async function uloz(S, stav, { id: did, pripad, nazev } = {}) {
    const byl = did ? await S.entita(did) : null;
    const data = Object.assign({ druh: DRUH, popis: 'Rozložení nástěnky vyšetřovatele (kartičky, provázky, poznámky). Upravuje se na stránce 🧷 Nástěnka.' },
      byl ? byl.data : {}, { nastenka: serializuj(stav) });
    return S.uloz({ id: did || undefined, pripad, typ: 'dokument', nazev: nazev || (byl && byl.nazev) || 'Nástěnka vyšetřovatele', data },
      { nastroj: NASTROJ, historie: 'souhrn' });
  }

  /* ---------- modelový případ 17/2026 ----------
     Tvrzení L. Fialy „celou noc doma“ uprostřed, kolem důkazy, které ho přímo vyvracejí (červené provázky: poloha
     telefonu, hovor 01:31), nepřímé souvislosti (kamera, svědkyně, peníze – „souvisí“, čárkovaně k tvrzení),
     vpravo Brabec, dole Kříž a peníze. Doplňuje do spisu jen to, co chybí (pevná id model-17-nastenka-…), nic nezdvojí. */
  const P = 'model-17', PN = P + '-nastenka';
  const MODEL_ENTITY = [
    { id: PN + '-finance', typ: 'dokument', nazev: 'Výpisy účtů: Kříž poslal Fialovi a Brabcovi po 12 000 Kč',
      data: { druh: 'výpis', popis: '16. 11. 2026 – den po prodeji 4 notebooků v bazaru R. Kříže (75 400 Kč) odešlo L. Fialovi a T. Brabcovi po 12 000 Kč; Fiala druhý den vybral hotovost. Podrobně: nástroj Finanční stopy.' } }
  ];
  // [id, od, do, typ, popis]
  const MODEL_VAZBY = [
    ['v-tvrzeni-fiala', 'udalost-1', 'osoba-fiala', 'tyka_se', 'tvrzení ve výslechu'],
    ['v-poloha', 'udalost-8', 'udalost-1', 'vyvraci', 'telefon L. Fialy byl 01:58–02:14 u prodejny v Horní Lhotě, ne doma'],
    ['v-poloha-stopa', 'stopa-6', 'udalost-8', 'potvrzuje', 'export polohové historie (stopa č. 6)'],
    ['v-hovor', 'udalost-3', 'udalost-1', 'vyvraci', 've 01:31 volal Brabcovi a telefon už byl mimo domov'],
    ['v-kamera', 'udalost-4', 'udalost-1', 'souvisi', 'nepřímo: kombi Brabce jede 01:52 k místu činu, 20 minut po hovoru s Fialou – tvrzení samo nevyvrací'],
    ['v-kamera-stopa', 'stopa-5', 'udalost-4', 'potvrzuje', 'záznam kamery čerpací stanice (stopa č. 5)'],
    ['v-vyska', 'udalost-9', 'osoba-brabec', 'potvrzuje', 'výška řidiče asi 189 cm – slučitelná s Brabcem (187 cm), Fialu jako řidiče vylučuje'],
    ['v-svedkyne', 'udalost-6', 'udalost-1', 'souvisi', 'nepřímo: u vozidla dvě osoby – spolu s polohou telefonu ukazuje na druhého pachatele'],
    ['v-finance', 'nastenka-finance', 'udalost-1', 'souvisi', 'nepřímo: podíl z prodeje lupu den po činu'],
    ['v-platba-fiala', 'osoba-kriz', 'osoba-fiala', 'platba', '12 000 Kč, 16. 11. 2026'],
    ['v-platba-brabec', 'osoba-kriz', 'osoba-brabec', 'platba', '12 000 Kč, 16. 11. 2026']
  ];
  // rozložení: [id entity bez předpony, x, y]
  const MODEL_ROZLOZENI = [
    ['udalost-1', -100, -40], ['osoba-fiala', -100, 260], ['telefon-fiala', -100, 470],
    ['udalost-8', -560, -330], ['stopa-6', -980, -330],
    ['udalost-3', -100, -400],
    ['udalost-4', 360, -330], ['stopa-5', 780, -330],
    ['udalost-6', -560, 120],
    ['nastenka-finance', 360, 160],
    ['udalost-9', 1120, -60], ['osoba-brabec', 1120, 220], ['vozidlo-octavia', 1460, 220], ['telefon-brabec', 1120, 470],
    ['osoba-kriz', 520, 560], ['telefon-kriz', 520, 760]
  ];
  async function modelova(S, { M, T, typy, barvy, nazevVazby } = {}) {
    await S.zalozModelovy(M, { nastroj: NASTROJ });
    for (const e of MODEL_ENTITY) {
      if (!(await S.entita(e.id))) await S.uloz(Object.assign({ pripad: P }, kopie(e)), { nastroj: NASTROJ });
    }
    const vsechnyVazby = await S.vazby(null, { pripad: P, smazane: true });
    const mamVazby = new Set(vsechnyVazby.map(v => v.id));
    for (const [vid, od, kam, typ, popis] of MODEL_VAZBY) {
      const byla = vsechnyVazby.find(v => v.id === PN + '-' + vid);
      // starší předloha měla u nepřímých souvislostí „vyvrací“ – při novém rozložení se opraví (jen nesmazané)
      if (byla && !byla.smazano && byla.typ === 'vyvraci' && typ !== 'vyvraci') {
        try { await S.upravVazbu(byla.id, { typ, popis }, { nastroj: NASTROJ }); } catch (x) { /* ponechat */ }
      }
      if (mamVazby.has(PN + '-' + vid)) continue;
      // vazba, kterou uživatel smazal, se znovu nezakládá; smazaná entita ji zablokuje (jádro vazbu odmítne)
      try { await S.vazba(P + '-' + od, P + '-' + kam, typ, { id: PN + '-' + vid, popis, nastroj: NASTROJ }); } catch (x) { /* chybí/smazaná entita */ }
    }
    // plocha z předlohy + všechny vazby mezi kartičkami
    const entity = new Map((await S.seznam(null, { pripad: P, smazane: true })).map(e => [e.id, e]));
    const vazby = new Map((await S.vazby(null, { pripad: P, smazane: true })).map(v => [v.id, v]));
    const stav = prazdny();
    const d0 = await S.entita(PN);
    if (d0 && d0.smazano) await S.obnov(PN, { nastroj: NASTROJ });     // smazaná nástěnka by se uložila zase jako smazaná
    for (const [eid, x, y] of MODEL_ROZLOZENI) {
      const e = entity.get(P + '-' + eid);
      if (e && !e.smazano) stav.objekty.push(Object.assign(kartaZEntity(e, x, y, T, typy), { zvyr: eid === 'udalost-1' || undefined }));
    }
    const volby = { T, typy, barvy, nazevVazby };
    for (const v of vazby.values()) {
      if (v.smazano) continue;
      const a = kartaEntity(stav, v.od), b = kartaEntity(stav, v.do);
      if (a && b) stav.objekty.push(provazekZVazby(v, a, b, entity, volby));
    }
    stav.objekty.push(poznamka('Tvrzení „celou noc doma“ vyvrací poloha telefonu i hovor ve 01:31. Kamera, svědkyně a peníze ukazují na Brabce a Kříže – nepřímo.', -560, 420));
    stav.objekty.forEach(o => { if (o.zvyr === undefined) delete o.zvyr; });
    J.prepoj(stav.objekty);
    stav.kamera = { x: -1020, y: -460, z: 0.5 };
    const dok = await uloz(S, stav, { id: PN, pripad: P, nazev: 'Nástěnka – tvrzení L. Fialy a důkazy' });
    return { pripad: P, dokument: dok.id, stav };
  }

  const api = {
    VERZE, DRUH, NASTROJ, SIRKA, VELIKOST, FOTO, BARVY_TYPU, BARVA_POZNAMKY, BARVA_SMAZANE, TYPY_VAZEB, KATEGORIE, VYCHOZI_BARVY, MODEL_DOKUMENT: PN,
    textKarty, vyskaKarty, obnovKartu, kartaZEntity, poznamka, jeKarta, jeProvazek, kartaEntity, provazekVazby,
    kategorieVazby, popisekVazby, obnovProvazek, provazekZVazby,
    prazdny, serializuj, nactiStav, obnovVse, rozmistiKolem, zobrazVazby, odeber,
    jeDokumentNastenky, najdiDokument, uloz, modelova
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else koren.NASTENKA = api;
})(typeof window !== 'undefined' ? window : globalThis);
