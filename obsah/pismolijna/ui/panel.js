/* ============================================================
   Písmolijna – ui/panel.js
   Pravý panel editoru glyfu: název, Unicode, šířka a postranní
   mezery, výběr (souřadnice, typ bodu), transformace, úpravy
   obrysů, komponenty, kotvy, pozadí a obtahování obrázku.
   ============================================================ */
(function () {
  'use strict';
  const P = window.PSL, A = window.PSLAPP, E = A.editor;
  const el = A.el;
  const panel = document.getElementById('panelGlyf');
  const otevrene = A.nastaveni.panelOtevrene || { glyf: true, symetrie: true, vyber: true, transformace: false, upravy: true, komponenty: false, kotvy: false, pozadi: false, nastroje: false };

  const g = () => A.font && A.aktualni ? A.font.glyfy[A.aktualni] : null;
  const hexU = u => u.toString(16).toUpperCase().padStart(4, '0');
  const ma = fn => typeof P[fn] === 'function';

  /* Co se v jednoduchém režimu skrývá (třída „pokrocile“). */
  const POKR_SEKCE = new Set(['transformace', 'komponenty', 'kotvy', 'nastroje']);
  const POKR_POLE = new Set(['uni', 'lsb', 'rsb']);
  const POKR_TL = new Set(['Odečíst', 'Průnik', 'Obrátit směr', 'Extrémy', 'Zjednodušit', 'Zaokrouhlit', 'Rozložit komponenty', 'Mezery jako…',
    'Obrysy → pozadí', 'Jiný glyf → pozadí', 'Vymazat obrysy pozadí', 'Na křivku', 'Na úsečku', 'Počáteční bod', 'Otevřít obrys', 'Uzavřít obrys']);

  function sekce(id, nazev, obsah) {
    const d = el('details', { 'data-sekce': id, class: POKR_SEKCE.has(id) ? 'pokrocile' : null }, [el('summary', { text: nazev })].concat(obsah));
    if (otevrene[id]) d.open = true;
    d.addEventListener('toggle', () => { otevrene[id] = d.open; A.nastaveni.panelOtevrene = otevrene; A.ulozNastaveni(); });
    return d;
  }
  function pole(id, popis, hodnota, onchange, typ, tip) {
    const inp = el('input', { id: 'pg-' + id, type: typ || 'number', value: hodnota, title: tip || '' });
    if ((typ || 'number') === 'number') inp.step = 'any';
    inp.addEventListener('change', () => onchange(inp.value, inp));
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
    return el('div', { class: 'radek' + (POKR_POLE.has(id) ? ' pokrocile' : '') }, [el('label', { for: 'pg-' + id, text: popis, title: tip || '' }), inp]);
  }
  function tl(text, fn, tip, vypnuto) {
    return el('button', { type: 'button', class: 'tl' + (POKR_TL.has(text) ? ' pokrocile' : ''), text, title: tip || '', disabled: !!vypnuto, onclick: fn });
  }
  const cislo = v => { const x = parseFloat(String(v).replace(',', '.')); return isFinite(x) ? x : null; };

  /* ---------- vykreslení panelu ---------- */
  let naplanovano = false;
  function obnov() {
    if (naplanovano) return;
    naplanovano = true;
    requestAnimationFrame(() => { naplanovano = false; vykresli(); });
  }
  A.panel = { obnov };

  function vykresli() {
    if (A.pohled !== 'glyf') return;
    const gl = g();
    const fokus = document.activeElement && panel.contains(document.activeElement) ? document.activeElement.id : null;
    const scroll = panel.scrollTop;
    panel.innerHTML = '';
    if (!gl) { panel.append(el('p', { class: 'poznamka', text: 'Žádný glyf není otevřený.' })); return; }
    const f = A.font;
    const ob = P.obalkaGlyfu(f, gl);

    // --- glyf
    panel.append(sekce('glyf', 'Glyf', [
      pole('nazev', 'Název', gl.nazev, v => prejmenuj(v.trim()), 'text', 'Název glyfu (a–z, A–Z, 0–9, tečka, podtržítko)'),
      pole('uni', 'Unicode', (gl.uni || []).map(hexU).join(' '), v => nastavUnicode(v), 'text', 'Kódové body šestnáctkově, víc oddělte mezerou (např. 010D)'),
      pole('sirka', 'Šířka', gl.sirka, v => { const x = cislo(v); if (x != null) E.zmen('Šířka', () => { g().sirka = Math.max(0, Math.round(x)); }); }),
      pole('lsb', 'Levá mezera (LSB)', ob ? Math.round(ob.x0) : 0, v => { const x = cislo(v); if (x != null) E.zmen('LSB', () => P.nastavLsb(f, g(), x)); }),
      pole('rsb', 'Pravá mezera (RSB)', ob ? Math.round(gl.sirka - ob.x1) : gl.sirka, v => { const x = cislo(v); if (x != null) E.zmen('RSB', () => P.nastavRsb(f, g(), x)); }),
      el('div', { class: 'tlacitka' }, [
        tl('Vystředit', () => E.zmen('Vystředit', () => { const o = P.obalkaGlyfu(f, g()); if (o) { const m = Math.round((g().sirka - (o.x1 - o.x0)) / 2); P.nastavLsb(f, g(), m); P.nastavRsb(f, g(), m); } }), 'Stejná levá i pravá mezera'),
        tl('Mezery jako…', () => A.akce('mezeryJako'), 'Převzít postranní mezery z jiného glyfu'),
        barvaStitku(gl)
      ]),
      ob ? el('p', { class: 'poznamka', text: 'Obálka: ' + [ob.x0, ob.y0, ob.x1, ob.y1].map(Math.round).join(', ') + ' · obrysů ' + gl.obrysy.length + ' · bodů ' + gl.obrysy.reduce((s, o) => s + o.body.length, 0) }) : null
    ]));

    // --- symetrie
    panel.append(sekce('symetrie', 'Symetrie (zrcadlení)' + (gl.zrcadlo ? ' – zapnuto' : ''), obsahSymetrie(gl)));

    // --- výběr
    panel.append(sekce('vyber', 'Výběr', obsahVyberu(gl)));

    // --- transformace
    panel.append(sekce('transformace', 'Transformace', obsahTransformace()));

    // --- úpravy obrysů
    const vyb = E.obrysyVyberu();
    const kde = vyb.length ? 'vybrané obrysy' : 'celý glyf';
    panel.append(sekce('upravy', 'Úpravy obrysů (' + kde + ')', [
      el('div', { class: 'tlacitka' }, [
        tl('Sjednotit', () => operace('Sjednotit (odstranit překryvy)', gg => P.sjednot(gg, vyb.length ? vyb : null)), 'Odstranit překryvy – sloučí překrývající se obrysy', !ma('sjednot')),
        tl('Odečíst', () => booleovska('rozdil'), 'Od prvního vybraného obrysu odečte ostatní vybrané (vyberte aspoň dva)', !ma('rozdil') || vyb.length < 2),
        tl('Průnik', () => booleovska('prunik'), 'Průnik prvního vybraného obrysu s ostatními vybranými', !ma('prunik') || vyb.length < 2),
        tl('Opravit směr', () => operace('Opravit směr', gg => ma('opravSmerGlyfu') ? P.opravSmerGlyfu(gg) : P.opravSmer(gg.obrysy)), 'Vnější obrysy po směru hodinových ručiček, díry proti'),
        tl('Obrátit směr', () => operace('Obrátit směr', gg => { gg.obrysy.forEach((o, i) => { if (!vyb.length || vyb.includes(i)) P.obratObrys(o); }); }), 'Obrátí směr vybraných obrysů'),
        tl('Extrémy', () => operace('Přidat extrémy', gg => gg.obrysy.forEach((o, i) => { if (!vyb.length || vyb.includes(i)) P.pridejExtremy(o); })), 'Body do vodorovných a svislých tečen'),
        tl('Zjednodušit', () => operace('Zjednodušit', gg => ma('zjednodusGlyf') ? P.zjednodusGlyf(gg, 1.5) : gg.obrysy.forEach(o => P.vycisti(o))), 'Odstraní nadbytečné body'),
        tl('Zaokrouhlit', () => operace('Zaokrouhlit', gg => gg.obrysy.forEach(o => P.zaokrouhli(o))), 'Souřadnice na celá čísla'),
        tl('Obtáhnout…', () => A.akce('obtahni'), 'Plocha tahu dané tloušťky (i z otevřených obrysů)', !ma('obtahni')),
        tl('Zesílit…', () => A.akce('zesil'), 'Ztučnit nebo zúžit tahy', !ma('zesil')),
        tl('Rozložit komponenty', () => operace('Rozložit komponenty', gg => P.rozlozKomponenty(f, gg)), 'Komponenty nahradí jejich obrysy', !(gl.komponenty || []).length)
      ])
    ]));

    // --- komponenty
    panel.append(sekce('komponenty', 'Komponenty (' + (gl.komponenty || []).length + ')', obsahKomponent(gl)));
    // --- kotvy
    panel.append(sekce('kotvy', 'Kotvy (' + (gl.kotvy || []).length + ')', obsahKotev(gl)));
    // --- pozadí
    panel.append(sekce('pozadi', 'Pozadí a obtahování', obsahPozadi(gl)));
    // --- nastavení nástrojů
    panel.append(sekce('nastroje', 'Nastavení editoru', [
      checkbox('Magnet (přichytávání k bodům a metrikám)', E.magnet, v => { E.magnet = v; A.nastaveni.magnet = v; A.ulozNastaveni(); }),
      checkbox('Mřížka (G)', E.mrizka, v => { E.mrizka = v; A.nastaveni.mrizka = v; A.ulozNastaveni(); E.prekresli(); }),
      checkbox('Plná výplň – náhled (F)', E.plnaVypln, v => { E.plnaVypln = v; E.prekresli(); }),
      pole('stetec', 'Šířka štětce', E.stetec, v => { const x = cislo(v); if (x > 0) { E.stetec = x; A.nastaveni.stetec = x; A.ulozNastaveni(); } })
    ]));

    panel.scrollTop = scroll;
    if (fokus) { const x = document.getElementById(fokus); if (x) x.focus(); }
  }

  function checkbox(popis, hodnota, fn) {
    const c = el('input', { type: 'checkbox' }); c.checked = !!hodnota;
    c.addEventListener('change', () => fn(c.checked));
    return el('label', { class: 'radek', style: 'cursor:pointer' }, [c, el('span', { class: 'l', text: popis })]);
  }

  function barvaStitku(gl) {
    const BARVY = [['', 'bez štítku'], ['#e05d5d', 'červená'], ['#e0a63f', 'oranžová'], ['#e3d34a', 'žlutá'], ['#4caf7d', 'zelená'], ['#4a8fe0', 'modrá'], ['#a070e0', 'fialová']];
    const s = el('select', { title: 'Barevný štítek buňky v mřížce (např. hotovo / rozpracováno)', 'aria-label': 'Barevný štítek' },
      BARVY.map(([v, n]) => { const o = el('option', { value: v, text: n }); if ((gl.barva || '') === v) o.selected = true; return o; }));
    s.style.width = 'auto';
    s.addEventListener('change', () => E.zmen('Štítek', () => { if (s.value) g().barva = s.value; else delete g().barva; }));
    return s;
  }

  async function prejmenuj(novy) {
    const gl = g();
    if (!novy || novy === gl.nazev) return;
    if (!P.platnyNazev(novy)) { A.zprava('Neplatný název glyfu: povolená jsou písmena bez diakritiky, číslice, tečka a podtržítko.', true); obnov(); return; }
    if (A.font.glyfy[novy]) { A.zprava('Glyf „' + novy + '“ už existuje.', true); obnov(); return; }
    const stary = gl.nazev;
    A.zmen('Přejmenovat ' + stary, { cely: true }, () => { P.prejmenujGlyf(A.font, stary, novy); A.aktualni = novy; });
  }
  function nastavUnicode(text) {
    const kody = [];
    for (const t of text.split(/[\s,;]+/).filter(Boolean)) {
      const x = parseInt(t.replace(/^(U\+|0x)/i, ''), 16);
      if (!isFinite(x) || x < 0 || x > 0x10FFFF) { A.zprava('Neplatný kód: ' + t, true); obnov(); return; }
      kody.push(x);
    }
    const mapa = P.cmap(A.font), kolize = kody.filter(c => mapa.has(c) && mapa.get(c) !== A.aktualni);
    E.zmen('Unicode', () => { g().uni = kody; });
    if (kolize.length) A.zprava('Pozor: U+' + kolize.map(hexU).join(', U+') + ' už má jiný glyf (' + kolize.map(c => mapa.get(c)).join(', ') + ').', true);
  }

  /* ---------- symetrie ----------
     Kreslí se jen jedna polovina, zrcadlená kopie se dopočítává živě
     (v editoru, mřížce, náhledu i exportu), dokud se nezapeče. */
  function obsahSymetrie(gl) {
    const z = gl.zrcadlo || {};
    const nastav = zmena => E.zmen('Symetrie', () => {
      const g2 = g(), n = Object.assign({}, g2.zrcadlo || {}, zmena);
      if (n.svisle || n.vodorovne) g2.zrcadlo = n; else delete g2.zrcadlo;
    });
    const osa = (id, popis, hodnota, klic, tip) => {
      const i = el('input', { id: 'pg-' + id, type: 'number', step: 'any', value: hodnota == null ? '' : hodnota, placeholder: 'auto', title: tip });
      i.addEventListener('change', () => { const x = cislo(i.value); nastav({ [klic]: i.value.trim() === '' ? null : x }); });
      return el('div', { class: 'radek' }, [el('label', { for: 'pg-' + id, text: popis, title: tip }), i]);
    };
    const out = [
      checkbox('↔ Levá a pravá polovina (svislá osa)', z.svisle, v => nastav({ svisle: v })),
      checkbox('↕ Horní a dolní polovina (vodorovná osa)', z.vodorovne, v => nastav({ vodorovne: v }))
    ];
    if (z.svisle) out.push(osa('osax', 'Svislá osa x', z.x, 'x', 'Prázdné = vždy střed šířky glyfu'));
    if (z.vodorovne) out.push(osa('osay', 'Vodorovná osa y', z.y, 'y', 'Prázdné = polovina výšky verzálek (' + A.font.info.vyskaVerzalek / 2 + '); pro malá písmena třeba ' + A.font.info.xVyska / 2));
    out.push(el('div', { class: 'tlacitka' }, [
      tl('Zapéct do obrysů', () => operace('Zapéct symetrii', gg => { P.zapecZrcadlo(A.font, gg); if (ma('sjednot')) P.sjednot(gg, null); }),
        'Zrcadlené kopie se stanou skutečnými obrysy a spojí se s originálem', !gl.zrcadlo)
    ]));
    out.push(el('p', { class: 'poznamka', text: 'Nakreslete jen jednu polovinu (čtvrtinu) – zbytek se doplní zrcadlením. Oranžová čára je osa, čárkovaně je dopočítaná část.' }));
    return out;
  }

  /* ---------- výběr ---------- */
  function obsahVyberu(gl) {
    const body = E.bodyVyberu();
    if (!body.length && !E.vyber.size) return [el('p', { class: 'poznamka', text: 'Nic není vybráno. Klikněte na bod, tažením vyberte víc bodů, dvojklikem celý obrys (Ctrl+A vše).' })];
    const out = [];
    if (body.length === 1) {
      const [oi, i] = body[0], p = gl.obrysy[oi].body[i];
      out.push(el('div', { class: 'radek2' }, [
        el('label', {}, ['X', inputBod('bx', p.x, v => E.zmen('Poloha bodu', () => { const q = g().obrysy[oi].body[i]; const d = v - q.x; posunBod(oi, i, d, 0); }))]),
        el('label', {}, ['Y', inputBod('by', p.y, v => E.zmen('Poloha bodu', () => { const q = g().obrysy[oi].body[i]; const d = v - q.y; posunBod(oi, i, 0, d); }))])
      ]));
      out.push(el('p', { class: 'poznamka', text: p.t === 'o' ? 'Řídicí bod (úchyt)' : (p.s ? 'Hladký bod' : 'Rohový bod') + ' · obrys ' + (oi + 1) + ', bod ' + (i + 1) }));
    } else if (body.length > 1) {
      const pts = body.map(([oi, i]) => gl.obrysy[oi].body[i]);
      const ob = P.obalkaBodu(pts);
      out.push(el('div', { class: 'radek2' }, [
        el('label', {}, ['X', inputBod('vx', ob.x0, v => transformujVyber([1, 0, 0, 1, v - ob.x0, 0], 'Posun'))]),
        el('label', {}, ['Y', inputBod('vy', ob.y0, v => transformujVyber([1, 0, 0, 1, 0, v - ob.y0], 'Posun'))]),
        el('label', {}, ['Š', inputBod('vw', ob.x1 - ob.x0, v => { if (ob.x1 > ob.x0 && v > 0) transformujVyber([v / (ob.x1 - ob.x0), 0, 0, 1, ob.x0 * (1 - v / (ob.x1 - ob.x0)), 0], 'Šířka výběru'); })]),
        el('label', {}, ['V', inputBod('vh', ob.y1 - ob.y0, v => { if (ob.y1 > ob.y0 && v > 0) transformujVyber([1, 0, 0, v / (ob.y1 - ob.y0), 0, ob.y0 * (1 - v / (ob.y1 - ob.y0))], 'Výška výběru'); })])
      ]));
      out.push(el('p', { class: 'poznamka', text: 'Vybráno bodů: ' + body.length + ' (obrysů ' + E.obrysyVyberu().length + ')' }));
    }
    const jedenObrys = E.obrysyVyberu().length === 1 ? E.obrysyVyberu()[0] : -1;
    out.push(el('div', { class: 'tlacitka' }, [
      tl('Hladký', () => E.prepniHladkost(true), 'Hladký bod – úchyty v jedné přímce'),
      tl('Rohový', () => E.prepniHladkost(false), 'Rohový bod – úchyty nezávislé'),
      tl('Na křivku', () => E.prevedSegmenty(true), 'Vybrané úsečky na křivky (vyberte oba koncové body)'),
      tl('Na úsečku', () => E.prevedSegmenty(false), 'Vybrané křivky na úsečky'),
      tl('Počáteční bod', () => pocatek(), 'Vybraný bod na křivce bude první bod obrysu', body.length !== 1),
      tl(jedenObrys >= 0 && gl.obrysy[jedenObrys].otevreny ? 'Uzavřít obrys' : 'Otevřít obrys', () => prepniOtevreni(jedenObrys), 'Uzavře/otevře vybraný obrys', jedenObrys < 0),
      tl('Smazat', () => E.smazVyber(), 'Smaže vybrané body (tvar křivky se zachová), komponenty a kotvy (Delete)')
    ]));
    return out;
  }
  function inputBod(id, v, fn) {
    const i = el('input', { id: 'pg-' + id, type: 'number', step: 'any', value: Math.round(v * 100) / 100 });
    i.addEventListener('change', () => { const x = cislo(i.value); if (x != null) fn(x); });
    i.addEventListener('keydown', e => { if (e.key === 'Enter') i.blur(); });
    return i;
  }
  function posunBod(oi, i, dx, dy) {
    const o = g().obrysy[oi], p = o.body[i];
    p.x += dx; p.y += dy;
    if (p.t !== 'o') {
      const n = o.body.length;
      for (const j of [i - 1, i + 1]) {
        const jj = o.otevreny ? j : (j + n) % n;
        if (jj >= 0 && jj < n && o.body[jj].t === 'o') { o.body[jj].x += dx; o.body[jj].y += dy; }
      }
    }
  }
  function pocatek() {
    const [[oi, i]] = E.bodyVyberu();
    const gl = g(), o = gl.obrysy[oi];
    if (o.body[i].t === 'o') { A.zprava('Počáteční bod musí ležet na křivce.', true); return; }
    if (o.otevreny) { A.zprava('U otevřeného obrysu je počátek vždy na konci.', true); return; }
    E.zmen('Počáteční bod', () => {
      const o2 = g().obrysy[oi];
      if (ma('nastavPocatek')) P.nastavPocatek(o2, i);
      else o2.body = o2.body.slice(i).concat(o2.body.slice(0, i));
      E.vyber.clear(); E.vyber.add(oi + ',0');
    });
    E.oznamVyber();
  }
  function prepniOtevreni(oi) {
    E.zmen('Otevřít/uzavřít obrys', () => {
      const o = g().obrysy[oi];
      if (o.otevreny) { delete o.otevreny; o.body[0].t = 'l'; }
      else {
        // otevřít v prvním bodě: řídicí body na konci (uzavírací křivka) se zahodí
        while (o.body.length && o.body[o.body.length - 1].t === 'o') o.body.pop();
        o.body[0].t = 'l'; o.otevreny = true;
      }
      E.vyber.clear();
    });
    E.oznamVyber();
  }

  /* ---------- transformace ---------- */
  let stredTrans = A.nastaveni.stredTrans || 'vyber';
  function obsahTransformace() {
    const hodnoty = A.nastaveni.trans || { dx: 0, dy: 0, sx: 100, sy: 100, rot: 15, skew: 12 };
    const ul = () => { A.nastaveni.trans = hodnoty; A.ulozNastaveni(); };
    const vstup = (klic, popis) => {
      const i = el('input', { type: 'number', step: 'any', value: hodnoty[klic], 'aria-label': popis });
      i.addEventListener('change', () => { const x = cislo(i.value); if (x != null) { hodnoty[klic] = x; ul(); } });
      return el('label', {}, [popis, i]);
    };
    const s = el('select', { 'aria-label': 'Střed transformace' }, [['vyber', 'střed výběru'], ['pocatek', 'počátek (0, 0)'], ['ucari', 'na účaří, střed šířky']].map(([v, t]) => { const o = el('option', { value: v, text: t }); if (v === stredTrans) o.selected = true; return o; }));
    s.style.width = 'auto';
    s.addEventListener('change', () => { stredTrans = s.value; A.nastaveni.stredTrans = s.value; A.ulozNastaveni(); });
    const stred = () => {
      const gl = g();
      if (stredTrans === 'pocatek') return { x: 0, y: 0 };
      if (stredTrans === 'ucari') return { x: gl.sirka / 2, y: 0 };
      const body = E.bodyVyberu().map(([oi, i]) => gl.obrysy[oi].body[i]);
      const ob = body.length ? P.obalkaBodu(body) : P.obalkaGlyfu(A.font, gl);
      return ob ? { x: (ob.x0 + ob.x1) / 2, y: (ob.y0 + ob.y1) / 2 } : { x: 0, y: 0 };
    };
    const okolo = (m) => { const c = stred(); return P.nasobMatice([1, 0, 0, 1, c.x, c.y], P.nasobMatice(m, [1, 0, 0, 1, -c.x, -c.y])); };
    return [
      el('div', { class: 'radek' }, [el('span', { class: 'l', text: 'Kolem' }), s]),
      el('div', { class: 'radek2' }, [vstup('dx', 'Δx'), vstup('dy', 'Δy')]),
      el('div', { class: 'tlacitka' }, [tl('Posunout', () => transformujVyber([1, 0, 0, 1, hodnoty.dx, hodnoty.dy], 'Posun'))]),
      el('div', { class: 'radek2' }, [vstup('sx', 'Š %'), vstup('sy', 'V %')]),
      el('div', { class: 'tlacitka' }, [tl('Změnit velikost', () => transformujVyber(okolo([hodnoty.sx / 100, 0, 0, hodnoty.sy / 100, 0, 0]), 'Změna velikosti'))]),
      el('div', { class: 'radek2' }, [vstup('rot', 'Úhel °'), vstup('skew', 'Zkosení °')]),
      el('div', { class: 'tlacitka' }, [
        tl('↺ Otočit', () => { const a = hodnoty.rot * Math.PI / 180; transformujVyber(okolo([Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]), 'Otočení'); }),
        tl('↻', () => { const a = -hodnoty.rot * Math.PI / 180; transformujVyber(okolo([Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]), 'Otočení'); }, 'Otočit po směru hodinových ručiček'),
        tl('Zkosit', () => transformujVyber(okolo([1, 0, Math.tan(hodnoty.skew * Math.PI / 180), 1, 0, 0]), 'Zkosení'), 'Zkosení vodorovně (kladné = doprava jako kurzíva)')
      ]),
      el('div', { class: 'tlacitka' }, [
        tl('⇋ Zrcadlit vodorovně', () => transformujVyber(okolo([-1, 0, 0, 1, 0, 0]), 'Zrcadlení')),
        tl('⇵ svisle', () => transformujVyber(okolo([1, 0, 0, -1, 0, 0]), 'Zrcadlení'))
      ])
    ];
  }
  /* Matice na výběr (nic nevybráno = celý glyf). Body na křivce berou úchyty s sebou. */
  function transformujVyber(m, popis) {
    const gl = g(); if (!gl) return;
    const body = E.bodyVyberu();
    const komp = Array.from(E.vyber).filter(k => k.startsWith('k,')).map(k => +k.split(',')[1]);
    const kotvy = Array.from(E.vyber).filter(k => k.startsWith('a,')).map(k => +k.split(',')[1]);
    const vse = !E.vyber.size;
    E.zmen(popis, () => {
      const g2 = g();
      if (vse && ma('transformujGlyf')) { P.transformujGlyf(g2, m, null); zaokrouhliGlyf(g2); return; }
      const mn = new Set();
      if (vse) g2.obrysy.forEach((o, oi) => o.body.forEach((p, i) => mn.add(oi + ',' + i)));
      for (const [oi, i] of body) {
        mn.add(oi + ',' + i);
        const o = g2.obrysy[oi];
        if (o.body[i].t !== 'o') {
          const n = o.body.length;
          for (const j of [i - 1, i + 1]) { const jj = o.otevreny ? j : (j + n) % n; if (jj >= 0 && jj < n && o.body[jj].t === 'o') mn.add(oi + ',' + jj); }
        }
      }
      for (const key of mn) {
        const [oi, i] = key.split(',').map(Number), p = g2.obrysy[oi].body[i];
        const q = P.transformujBod(m, p.x, p.y);
        p.x = Math.round(q.x * 100) / 100; p.y = Math.round(q.y * 100) / 100;
      }
      const det = m[0] * m[3] - m[1] * m[2];
      if (det < 0) {   // zrcadlení: obrátit směr celých obrysů, jinak by se plocha převrátila
        const cele = new Set();
        for (const key of mn) cele.add(+key.split(',')[0]);
        for (const oi of cele) if (g2.obrysy[oi].body.every((p, i) => mn.has(oi + ',' + i))) P.obratObrys(g2.obrysy[oi]);
        E.vyber.clear();
      }
      for (const i of (vse ? (g2.komponenty || []).map((x, j) => j) : komp)) g2.komponenty[i].m = P.nasobMatice(m, g2.komponenty[i].m);
      for (const i of (vse ? (g2.kotvy || []).map((x, j) => j) : kotvy)) { const q = P.transformujBod(m, g2.kotvy[i].x, g2.kotvy[i].y); g2.kotvy[i].x = Math.round(q.x); g2.kotvy[i].y = Math.round(q.y); }
      zaokrouhliGlyf(g2);
    });
    E.oznamVyber();
  }
  A.transformujVyber = transformujVyber;
  function zaokrouhliGlyf(gg) { for (const o of gg.obrysy) for (const b of o.body) { b.x = Math.round(b.x); b.y = Math.round(b.y); } }

  function operace(popis, fn) {
    if (!g()) return;
    E.zmen(popis, () => { fn(g()); E.vyber.clear(); });
    E.oznamVyber();
  }
  function booleovska(druh) {
    const vyb = E.obrysyVyberu();
    if (vyb.length < 2) { A.zprava('Vyberte aspoň dva obrysy (dvojklik na obrys, Shift přidá další).', true); return; }
    // první vybraný = obrys, kterého se týká; „první“ = s nejmenším indexem
    operace(druh === 'rozdil' ? 'Odečíst' : 'Průnik', gg => P[druh](gg, [vyb[0]], vyb.slice(1)));
  }

  /* ---------- komponenty ---------- */
  function obsahKomponent(gl) {
    const out = [];
    const sez = el('div', { class: 'seznam-mini' });
    (gl.komponenty || []).forEach((kp, i) => {
      const dx = el('input', { type: 'number', value: Math.round(kp.m[4]), title: 'posun x', 'aria-label': 'posun x' });
      const dy = el('input', { type: 'number', value: Math.round(kp.m[5]), title: 'posun y', 'aria-label': 'posun y' });
      const zm = () => E.zmen('Komponenta', () => { const k2 = g().komponenty[i]; k2.m[4] = cislo(dx.value) || 0; k2.m[5] = cislo(dy.value) || 0; });
      dx.addEventListener('change', zm); dy.addEventListener('change', zm);
      sez.append(el('div', { class: 'polozka' }, [
        el('a', { class: 'jmeno', href: '#', text: '⧉ ' + kp.glyf, title: 'Otevřít glyf ' + kp.glyf, onclick: e => { e.preventDefault(); A.otevriGlyf(kp.glyf); } }), dx, dy,
        el('button', { type: 'button', class: 'tl ik', text: '✕', title: 'Odebrat komponentu', onclick: () => E.zmen('Odebrat komponentu', () => { g().komponenty.splice(i, 1); E.vyber.clear(); }) })
      ]));
    });
    out.push(sez);
    const vstup = el('input', { type: 'text', placeholder: 'název nebo znak (např. a, acute, ˇ)', list: 'pg-glyfy', 'aria-label': 'Glyf pro komponentu' });
    vstup.classList.add('siroky');
    const dl = el('datalist', { id: 'pg-glyfy' }, A.font.poradi.slice(0, 3000).map(n => el('option', { value: n })));
    out.push(el('div', { class: 'radek' }, [vstup, tl('＋ Přidat', () => {
      let n = vstup.value.trim();
      if (n && !A.font.glyfy[n] && Array.from(n).length === 1) n = P.cmap(A.font).get(n.codePointAt(0)) || n;
      if (!A.font.glyfy[n]) { A.zprava('Glyf „' + vstup.value + '“ ve fontu není.', true); return; }
      if (n === A.aktualni) { A.zprava('Glyf nemůže obsahovat sám sebe.', true); return; }
      E.zmen('Přidat komponentu', () => { const g2 = g(); g2.komponenty = g2.komponenty || []; g2.komponenty.push({ glyf: n, m: [1, 0, 0, 1, 0, 0] }); });
    }, 'Vloží odkaz na jiný glyf – změny v něm se projeví i tady')]), dl);
    out.push(el('p', { class: 'poznamka', text: 'Komponenta je odkaz na jiný glyf (např. á = a + ´). Tažením ji posunete, dvojklikem otevřete.' }));
    return out;
  }

  /* ---------- kotvy ---------- */
  function obsahKotev(gl) {
    const sez = el('div', { class: 'seznam-mini' });
    (gl.kotvy || []).forEach((a, i) => {
      const n = el('input', { type: 'text', value: a.nazev, 'aria-label': 'název kotvy' }); n.style.width = '80px'; n.style.textAlign = 'left';
      const x = el('input', { type: 'number', value: Math.round(a.x), 'aria-label': 'x' }), y = el('input', { type: 'number', value: Math.round(a.y), 'aria-label': 'y' });
      const zm = () => E.zmen('Kotva', () => { const k2 = g().kotvy[i]; k2.nazev = n.value.trim() || k2.nazev; k2.x = cislo(x.value) || 0; k2.y = cislo(y.value) || 0; });
      for (const v of [n, x, y]) v.addEventListener('change', zm);
      sez.append(el('div', { class: 'polozka' }, [n, x, y, el('button', { type: 'button', class: 'tl ik', text: '✕', title: 'Smazat kotvu', onclick: () => E.zmen('Smazat kotvu', () => { g().kotvy.splice(i, 1); E.vyber.clear(); }) })]));
    });
    return [sez,
      el('div', { class: 'tlacitka' }, [
        tl('＋ top', () => pridejKotvu('top'), 'Kotva nad písmenem pro akcent'),
        tl('＋ bottom', () => pridejKotvu('bottom'), 'Kotva pod písmenem (cedila, ogonek)'),
        tl('＋ _top', () => pridejKotvu('_top'), 'Kotva akcentu – přiloží se na „top“ základního písmene')
      ]),
      el('p', { class: 'poznamka', text: 'Kotvy určují, kam se při skládání (Nástroje → Sestavit akcenty) posadí diakritika: „top“ písmene se spojí s „_top“ akcentu.' })];
  }
  function pridejKotvu(nazev) {
    const f = A.font, gl = g(), ob = P.obalkaGlyfu(f, gl);
    let x = Math.round(gl.sirka / 2), y;
    if (nazev === 'top') y = ob ? Math.round(ob.y1 + f.info.upm * 0.05) : f.info.xVyska;
    else if (nazev === 'bottom') y = 0;
    else { y = ob ? Math.round(ob.y0) : 0; if (ob) x = Math.round((ob.x0 + ob.x1) / 2); }
    E.zmen('Kotva', () => { const g2 = g(); g2.kotvy = g2.kotvy || []; g2.kotvy.push({ nazev, x, y }); });
  }

  /* ---------- pozadí ---------- */
  function obsahPozadi(gl) {
    const pz = gl.pozadi || {};
    const out = [el('div', { class: 'tlacitka' }, [
      tl('Obrysy → pozadí', () => E.zmen('Kopie do pozadí', () => { const g2 = g(); g2.pozadi = g2.pozadi || {}; g2.pozadi.obrysy = P.klonuj(P.plneObrysy(A.font, g2)); }), 'Zkopíruje aktuální tvar do pozadí jako předlohu'),
      tl('Jiný glyf → pozadí', () => A.akce('referencePozadi'), 'Předloha z jiného glyfu nebo i z jiného fontu v počítači'),
      tl('Vymazat obrysy pozadí', () => E.zmen('Vymazat pozadí', () => { if (g().pozadi) delete g().pozadi.obrysy; }), '', !(pz.obrysy && pz.obrysy.length))
    ])];
    out.push(el('div', { class: 'tlacitka' }, [
      tl('🖼️ Obrázek do pozadí…', () => A.akce('obrazekPozadi'), 'Fotografie nebo sken písmene jako předloha k obkreslení'),
      tl('Obtáhnout obrázek', () => obtahniObrazek(), 'Automaticky převede obrázek v pozadí na obrysy', !(pz.obrazek && ma('obtahniBitmapu'))),
      tl('Odebrat obrázek', () => E.zmen('Odebrat obrázek', () => { delete g().pozadi.obrazek; }), '', !pz.obrazek)
    ]));
    if (pz.obrazek) {
      const o = pz.obrazek;
      const rozsah = el('input', { type: 'range', min: 0.05, max: 1, step: 0.05, value: o.pruhlednost == null ? 0.4 : o.pruhlednost, 'aria-label': 'Krytí obrázku' });
      rozsah.addEventListener('input', () => { o.pruhlednost = +rozsah.value; E.prekresli(); });
      rozsah.addEventListener('change', () => E.zmen('Krytí obrázku', () => { g().pozadi.obrazek.pruhlednost = +rozsah.value; }));
      out.push(el('div', { class: 'radek' }, [el('span', { class: 'l', text: 'Krytí' }), rozsah]));
      out.push(el('div', { class: 'radek2' }, [
        el('label', {}, ['X', inputBod('ix', o.x, v => E.zmen('Obrázek', () => { g().pozadi.obrazek.x = v; }))]),
        el('label', {}, ['Y', inputBod('iy', o.y, v => E.zmen('Obrázek', () => { g().pozadi.obrazek.y = v; }))]),
        el('label', { title: 'jednotek em na pixel obrázku' }, ['Měř.', inputBod('im', o.meritko, v => { if (v > 0) E.zmen('Obrázek', () => { g().pozadi.obrazek.meritko = v; }); })]),
        el('label', { title: 'Práh černé 0–255 (prázdné = automaticky)' }, ['Práh', inputBod('ip', o.prah == null ? '' : o.prah, v => E.zmen('Práh', () => { g().pozadi.obrazek.prah = Math.max(0, Math.min(255, v)); }))])
      ]));
    }
    return out;
  }

  async function obtahniObrazek() {
    const gl = g(), o = gl.pozadi && gl.pozadi.obrazek;
    if (!o) return;
    const img = new Image();
    await new Promise((ok, chyba) => { img.onload = ok; img.onerror = chyba; img.src = o.data; }).catch(() => null);
    if (!img.naturalWidth) { A.zprava('Obrázek nejde načíst.', true); return; }
    // velké obrázky zmenšit, ať obtahování netrvá věčně
    const max = 1400, z = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * z), h = Math.round(img.naturalHeight * z);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const cx = c.getContext('2d');
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h);
    const data = cx.getImageData(0, 0, w, h).data;
    const m = o.meritko / z;   // jednotek na pixel zmenšeniny
    // px (y dolů) → em: x = o.x + px*m, y = o.y + (h - py)*m
    const matice = [m, 0, 0, -m, o.x, o.y + h * m];
    let obrysy;
    try { obrysy = P.obtahniBitmapu(data, w, h, { prah: o.prah, matice, chyba: 1, minPlocha: 12 }); }
    catch (e) { A.zprava('Obtahování selhalo: ' + e.message, true); return; }
    if (!obrysy || !obrysy.length) { A.zprava('V obrázku se nenašel žádný tvar – zkuste nastavit práh.', true); return; }
    E.zmen('Obtáhnout obrázek', () => {
      const g2 = g();
      for (const ob of obrysy) { P.zaokrouhli(ob); g2.obrysy.push(ob); }
    });
    A.zprava('Obtaženo: ' + obrysy.length + ' obrysů. Obrázek můžete v pozadí skrýt nebo odebrat.');
  }

  A.na('zmena', () => { if (A.pohled === 'glyf') obnov(); });
  A.na('vyberBodu', obnov);
  A.na('glyfOtevren', obnov);
  A.na('pohled', p => { if (p === 'glyf') obnov(); });
})();
