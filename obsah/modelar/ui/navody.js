/* Modelář 3D – názorné návody: krok za krokem s obrázkem, pro složitější funkce (pole po okraji, zaoblení,
   skořepina, skica, kapsa, tažení, magnet, proměnné, sestava, text na plochu…).
   Obrázky se skládají z jednoduchých izometrických prvků (kvádr, válec, díra, křivka, kurzor, klik, štítek),
   takže vypadají jednotně, jsou ostré v každé velikosti a barvy berou z CSS proměnných (světlý i tmavý vzhled).
   Okno: seznam návodů vlevo, vpravo obrázek, text kroku a tlačítka; „Vyzkoušet“ spustí nástroj.
   Tlačítko s data-navod="id" kdekoli v aplikaci otevře návod rovnou (dialog Pole, inspektor…). */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = x => (Math.round(x * 10) / 10).toString();
  const PI = Math.PI;

  // ------------------------------------------------------------ izometrické kreslení
  /** Obrázek 360 × 220: o = obr(měřítko px/mm, střed x, střed y); o.kvadr(…), o.valec(…)…; o.svg(popis). */
  function obr(sc = 4, ox = 180, oy = 120) {
    const casti = [], pevne = [];                 // casti = scéna (vycentruje se), pevne = okna a klávesy v px obrázku
    const K = Math.cos(PI / 6);
    const ob = [Infinity, Infinity, -Infinity, -Infinity];
    const rozsir = (x, y) => { ob[0] = Math.min(ob[0], x); ob[1] = Math.min(ob[1], y); ob[2] = Math.max(ob[2], x); ob[3] = Math.max(ob[3], y); };
    const P = (x, y, z) => { const q = [ox + (x - y) * K * sc, oy + (x + y) * 0.5 * sc - z * sc]; rozsir(q[0], q[1]); return q; };
    let ramec = [12, 12, 336, 196];
    const pts = a => a.map(p => P(...p)).map(q => f(q[0]) + ',' + f(q[1])).join(' ');
    const anim = o => o && o.zpozdeni != null ? ` style="animation-delay:${o.zpozdeni}s"` : '';
    const tr = o => (o && o.trida ? ' ' + o.trida : '');
    const api = {
      P,
      /** Deska (kosočtverec s mřížkou) pod scénou. */
      deska(x0, y0, x1, y1, krok = 10) {
        let s = `<polygon class="n-deska" points="${pts([[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]])}"/>`;
        for (let x = Math.ceil(x0 / krok) * krok; x <= x1; x += krok) s += `<polyline class="n-mriz" points="${pts([[x, y0, 0], [x, y1, 0]])}"/>`;
        for (let y = Math.ceil(y0 / krok) * krok; y <= y1; y += krok) s += `<polyline class="n-mriz" points="${pts([[x0, y, 0], [x1, y, 0]])}"/>`;
        casti.push(s); return api;
      },
      /** Kvádr od rohu (x, y, z) o rozměrech dx × dy × dz; styl 'tel' | 'dira' | 'zvyr' | 'modry' | 'zeleny'. */
      kvadr(x, y, z, dx, dy, dz, o = {}) {
        const st = o.styl || 'tel', X = x + dx, Y = y + dy, Z = z + dz;
        casti.push(`<g class="n-${st}${tr(o)}"${anim(o)}>`
          + `<polygon class="fx" points="${pts([[X, y, z], [X, Y, z], [X, Y, Z], [X, y, Z]])}"/>`
          + `<polygon class="fy" points="${pts([[x, Y, z], [X, Y, z], [X, Y, Z], [x, Y, Z]])}"/>`
          + `<polygon class="fz" points="${pts([[x, y, Z], [X, y, Z], [X, Y, Z], [x, Y, Z]])}"/></g>`);
        return api;
      },
      /** Válec se středem podstavy (cx, cy, z), poloměr r, výška h. */
      valec(cx, cy, z, r, h, o = {}) {
        const st = o.styl || 'tel', kruh = (zz, a0, a1, n = 24) => { const out = []; for (let i = 0; i <= n; i++) { const t = a0 + (a1 - a0) * i / n; out.push([cx + r * Math.cos(t), cy + r * Math.sin(t), zz]); } return out; };
        const bok = kruh(z, -PI / 4, 3 * PI / 4).concat(kruh(z + h, -PI / 4, 3 * PI / 4).reverse());
        casti.push(`<g class="n-${st}${tr(o)}"${anim(o)}><polygon class="fx" points="${pts(bok)}"/><polygon class="fz" points="${pts(kruh(z + h, 0, 2 * PI, 40))}"/></g>`);
        return api;
      },
      /** Rotační těleso kolem svislé osy (cx, cy) z profilu [[r, z], …] zdola nahoru; nahoře otevřené (váza). */
      rotace(cx, cy, profil, o = {}) {
        const K2 = Math.SQRT2 / 2, kruh = (r, zz, a0, a1, n = 24) => { const out = []; for (let i = 0; i <= n; i++) { const t = a0 + (a1 - a0) * i / n; out.push([cx + r * Math.cos(t), cy + r * Math.sin(t), zz]); } return out; };
        const prava = profil.map(([r, z]) => [cx + r * K2, cy - r * K2, z]), leva = profil.map(([r, z]) => [cx - r * K2, cy + r * K2, z]).reverse();
        const [r0, z0] = profil[0], [r1, z1] = profil[profil.length - 1];
        const bok = prava.concat(leva).concat(kruh(r0, z0, 3 * PI / 4, -PI / 4));
        let s = `<g class="n-${o.styl || 'tel'}${tr(o)}"${anim(o)}><polygon class="fx" points="${pts(bok)}"/>`;
        s += `<polygon class="fz" points="${pts(kruh(r1, z1, 0, 2 * PI, 40))}"/>`;
        if (o.otevrena) s += `<polygon class="vnitr-rot" points="${pts(kruh(r1 * 0.82, z1, 0, 2 * PI, 40))}"/>`;
        casti.push(s + '</g>');
        return api;
      },
      /** Otvor shora do tělesa (válcový): tmavá elipsa a vnitřní stěna. */
      otvor(cx, cy, z, r, o = {}) {
        const kruh = (zz, a0, a1, n = 24) => { const out = []; for (let i = 0; i <= n; i++) { const t = a0 + (a1 - a0) * i / n; out.push([cx + r * Math.cos(t), cy + r * Math.sin(t), zz]); } return out; };
        casti.push(`<g class="n-otvor${tr(o)}"${anim(o)}><polygon class="vnitr" points="${pts(kruh(z, 0, 2 * PI, 40))}"/>`
          + `<polygon class="stena" points="${pts(kruh(z, 3 * PI / 4, 7 * PI / 4).concat(kruh(z - Math.min(r * 1.4, 6), 3 * PI / 4, 7 * PI / 4).reverse()))}"/></g>`);
        return api;
      },
      /** Pravoúhlá kapsa (otevřená krabička) shora: otvor x0..x1 × y0..y1 v ploše z, hloubka d. */
      kapsa(x0, y0, x1, y1, z, d, o = {}) {
        const zz = z - d;
        casti.push(`<g class="n-kapsa${tr(o)}"${anim(o)}>`
          + `<polygon class="dno" points="${pts([[x0, y0, zz], [x1, y0, zz], [x1, y1, zz], [x0, y1, zz]])}"/>`
          + `<polygon class="sx" points="${pts([[x0, y0, z], [x0, y1, z], [x0, y1, zz], [x0, y0, zz]])}"/>`
          + `<polygon class="sy" points="${pts([[x0, y0, z], [x1, y0, z], [x1, y0, zz], [x0, y0, zz]])}"/>`
          + `<polygon class="okraj" points="${pts([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]])}"/></g>`);
        return api;
      },
      /** Kvádr se zaoblenou (r > 0) nebo sraženou (srazeni) horní hranou na straně +x. */
      kvadrHrana(x, y, z, dx, dy, dz, r, o = {}) {
        const X = x + dx, Y = y + dy, Z = z + dz, prof = [];
        const n = o.srazeni ? 1 : 8;
        for (let i = 0; i <= n; i++) { const a = (PI / 2) * i / n; prof.push([X - r + r * Math.sin(a), Z - r + r * Math.cos(a)]); }
        if (o.srazeni) { prof[0] = [X - r, Z]; prof[1] = [X, Z - r]; }
        let s = `<g class="n-${o.styl || 'tel'}${tr(o)}"${anim(o)}>`;
        s += `<polygon class="fx" points="${pts([[X, y, z], [X, Y, z], [X, Y, Z - r], [X, y, Z - r]])}"/>`;
        // čelo +y: obrys s profilem hrany
        s += `<polygon class="fy" points="${pts([[x, Y, z], [X, Y, z]].concat(prof.slice().reverse().map(([px, pz]) => [px, Y, pz])).concat([[x, Y, Z]]))}"/>`;
        s += `<polygon class="fz" points="${pts([[x, y, Z], [X - r, y, Z], [X - r, Y, Z], [x, Y, Z]])}"/>`;
        for (let i = 0; i + 1 < prof.length; i++) {
          const [a, b] = [prof[i], prof[i + 1]], t = (i + 0.5) / (prof.length - 1);
          s += `<polygon class="${t < 0.5 ? 'fz' : 'fx'} hrana" style="opacity:${f(1 - Math.abs(t - 0.5) * 0.3)}" points="${pts([[a[0], y, a[1]], [b[0], y, b[1]], [b[0], Y, b[1]], [a[0], Y, a[1]]])}"/>`;
        }
        casti.push(s + '</g>');
        return api;
      },
      /** Čára přes 3D body; styl 'zvyr' (oranžová), 'skica' (modrá čárkovaná), 'kota'… */
      cara(body, o = {}) {
        casti.push(`<polyline class="n-cara ${o.styl || 'zvyr'}${tr(o)}"${anim(o)} points="${pts(body)}"${o.uzavrena ? '' : ''}/>`
          + (o.uzavrena ? `<polyline class="n-cara ${o.styl || 'zvyr'}${tr(o)}"${anim(o)} points="${pts([body[body.length - 1], body[0]])}"/>` : ''));
        return api;
      },
      /** Šipka ze 3D bodu a do b. */
      sipka(a, b, o = {}) {
        const [x1, y1] = P(...a), [x2, y2] = P(...b), u = Math.atan2(y2 - y1, x2 - x1), d = 8;
        casti.push(`<g class="n-sipka ${o.styl || ''}${tr(o)}"${anim(o)}><line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`
          + `<polygon points="${f(x2)},${f(y2)} ${f(x2 - d * Math.cos(u - 0.45))},${f(y2 - d * Math.sin(u - 0.45))} ${f(x2 - d * Math.cos(u + 0.45))},${f(y2 - d * Math.sin(u + 0.45))}"/></g>`);
        return api;
      },
      /** Ukazatel myši na 3D bodě (špička), s kroužky kliknutí. */
      kurzor(p, o = {}) {
        const [x, y] = P(...p);
        rozsir(x + 14, y + 21);
        casti.push(`<g class="n-kurzor${tr(o)}"${anim(o)}>${o.klik !== false ? `<circle class="klik" cx="${f(x)}" cy="${f(y)}" r="5"/><circle class="klik k2" cx="${f(x)}" cy="${f(y)}" r="5"/>` : ''}`
          + `<path transform="translate(${f(x)} ${f(y)})" d="M0 0 L0 17 L4.5 13 L7.5 20 L10.5 18.6 L7.6 12 L13 12 Z"/></g>`);
        return api;
      },
      /** Štítek s textem u 3D bodu (posun dx, dy v px). */
      stitek(p, text, o = {}) {
        const [x, y] = P(...p), X = x + (o.dx || 0), Y = y + (o.dy || 0), w = text.length * 6.1 + 12;
        const lx = o.zarovnat === 'vpravo' ? X - w : o.zarovnat === 'stred' ? X - w / 2 : X;
        rozsir(lx, Y - 10); rozsir(lx + w, Y + 8);
        casti.push(`<g class="n-stitek ${o.styl || ''}${tr(o)}"${anim(o)}><rect x="${f(lx)}" y="${f(Y - 10)}" width="${f(w)}" height="18" rx="5"/><text x="${f(lx + 6)}" y="${f(Y + 3)}">${esc(text)}</text></g>`);
        return api;
      },
      /** Klávesa (v px obrázku). */
      klavesa(x, y, text, o = {}) {
        const w = text.length * 7 + 14;
        pevne.push(`<g class="n-klavesa${tr(o)}"${anim(o)}><rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="22" rx="4"/><text x="${f(x + w / 2)}" y="${f(y + 15)}" text-anchor="middle">${esc(text)}</text></g>`);
        return api;
      },
      /** Malé okénko aplikace (v px obrázku): nadpis a řádky [popis, hodnota]; hodnota se zvýrazní, je-li o.zvyr. */
      okno(x, y, w, nadpis, radky, o = {}) {
        const h = 26 + radky.length * 20 + (o.tlacitko ? 26 : 0);
        let s = `<g class="n-okno${tr(o)}"${anim(o)}><rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="6"/>`
          + `<text class="nad" x="${f(x + 8)}" y="${f(y + 17)}">${esc(nadpis)}</text>`;
        radky.forEach(([a, b, zv], i) => {
          const yy = y + 38 + i * 20;
          s += `<text x="${f(x + 8)}" y="${f(yy)}">${esc(a)}</text>`;
          if (b != null) s += `<rect class="pole${zv ? ' zv' : ''}" x="${f(x + w - 70)}" y="${f(yy - 12)}" width="62" height="16" rx="3"/><text class="hod" x="${f(x + w - 64)}" y="${f(yy)}">${esc(b)}</text>`;
        });
        if (o.tlacitko) s += `<rect class="tl" x="${f(x + w - 98)}" y="${f(y + h - 24)}" width="90" height="18" rx="4"/><text class="tlt" x="${f(x + w - 53)}" y="${f(y + h - 11)}" text-anchor="middle">${esc(o.tlacitko)}</text>`;
        pevne.push(s + '</g>');
        return api;
      },
      /** Volné SVG ve scéně (souřadnice z P). */
      raw(s) { casti.push(s); return api; },
      /** Kam se má scéna vejít (px obrázku) – vedle okna s nastavením. */
      ramec(r) { ramec = r; return api; },
      svg(popis) {
        // scéna vycentrovaná do rámce (zmenší se, když se nevejde; nezvětšuje)
        let g = '';
        if (isFinite(ob[0])) {
          const w = ob[2] - ob[0], h = ob[3] - ob[1], k = Math.min(1, ramec[2] / w, ramec[3] / h);
          const tx = ramec[0] + (ramec[2] - w * k) / 2 - ob[0] * k, ty = ramec[1] + (ramec[3] - h * k) / 2 - ob[1] * k;
          g = `<g transform="translate(${f(tx)} ${f(ty)})${k < 1 ? ` scale(${k.toFixed(3)})` : ''}">${casti.join('')}</g>`;
        }
        return `<svg viewBox="0 0 360 220" role="img" aria-label="${esc(popis)}" class="n-obr">${g}${pevne.join('')}</svg>`;
      },
    };
    return api;
  }
  /** Body obdélníku po obvodu (z = výška), s odstupem od okraje. */
  const obdelnik = (x0, y0, x1, y1, z) => [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]];
  /** n bodů rovnoměrně po obvodu obdélníku. */
  function poObvodu(x0, y0, x1, y1, n) {
    const a = x1 - x0, b = y1 - y0, L = 2 * (a + b), out = [];
    for (let i = 0; i < n; i++) {
      let s = L * i / n;
      if (s < a) out.push([x0 + s, y0]); else if ((s -= a) < b) out.push([x1, y0 + s]); else if ((s -= b) < a) out.push([x1 - s, y1]); else out.push([x0, y1 - (s - a)]);
    }
    return out;
  }
  /** Body křivky ve tvaru S na desce. */
  const esko = (n = 40) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return [-28 + 56 * t, 16 * Math.sin(t * 2 * PI) - 4, 0.2]; });

  // ------------------------------------------------------------ návody
  M.NAVODY = [
    {
      id: 'dira', ikona: '🕳️', nazev: 'Díra a seskupení', prikaz: 'seskupit',
      uvod: 'Otvory, výřezy a kapsy vznikají tak, že těleso přepneš na Díru a seskupíš ho s tím, z čeho se má odečíst.',
      kroky: [
        { nadpis: 'Vlož těleso a válec', text: 'Z nabídky Tvary přetáhni na desku kvádr a válec. Válec posuň tam, kde má být otvor – klidně ať z kvádru vyčnívá.',
          obr: () => obr(3.2, 170, 95).deska(-30, -25, 35, 30).kvadr(-20, -15, 0, 40, 30, 12).valec(28, 18, 0, 6, 16).sipka([28, 18, 18], [3, 2, 18]).kurzor([28, 18, 16], { klik: false }).svg('Kvádr a válec na desce') },
        { nadpis: 'Válec přepni na Díru', text: 'Vyber válec a v inspektoru zvol Díra (nebo stiskni H, na numerické klávesnici 8). Díra je šedá a průhledná – ukazuje, co se odebere.',
          obr: () => obr(3.2, 170, 95).deska(-30, -25, 35, 30).kvadr(-20, -15, 0, 40, 30, 12).valec(3, 2, -2, 6, 18, { styl: 'dira' }).ramec([150, 12, 198, 196]).klavesa(316, 186, 'H').okno(12, 14, 130, 'Inspektor', [['Těleso', null], ['Díra  ✓', null]]).svg('Válec přepnutý na díru') },
        { nadpis: 'Vyber oba a seskup', text: 'Vyber kvádr i díru (Shift + klik nebo tažením po prázdnu) a stiskni Ctrl+G (Seskupit). Díra se z tělesa odečte.',
          obr: () => obr(3.2, 170, 95).deska(-30, -25, 35, 30).kvadr(-20, -15, 0, 40, 30, 12, { trida: 'vybrane' }).valec(3, 2, -2, 6, 18, { styl: 'dira', trida: 'vybrane' }).ramec([12, 12, 336, 168]).klavesa(286, 188, 'Ctrl+G').svg('Výběr obou a seskupení') },
        { nadpis: 'Hotovo – otvor', text: 'Ze dvou těles je skupina s otvorem. Díru můžeš kdykoli posunout: rozlož skupinu (Ctrl+Shift+G), uprav a seskup znovu.',
          obr: () => obr(3.2, 170, 95).deska(-30, -25, 35, 30).kvadr(-20, -15, 0, 40, 30, 12).otvor(3, 2, 12, 6).svg('Kvádr s otvorem') },
      ],
    },
    {
      id: 'pole', ikona: '▦', nazev: 'Díry po okraji (pole po křivce)', prikaz: 'pole',
      uvod: 'Řada děr nebo výstupků kolem okraje víka, příruby či desky – stačí jeden kus, zbytek rozmístí pole.',
      kroky: [
        { nadpis: 'Připrav první kus', text: 'Polož jeden kus (třeba díru pro šroub) k okraji desky a nastav mu výšku a hloubku. Ostatní kopie ho převezmou.',
          obr: () => obr(3, 175, 70).kvadr(-30, -20, 0, 60, 40, 5).valec(-25, -15, -2, 2.5, 10, { styl: 'dira' }).stitek([-25, -15, 9], 'první kus', { dx: -88, dy: -6 }).svg('Deska a první díra') },
        { nadpis: 'Vyber kus a otevři pole', text: 'Vyber ho a dej Úpravy → Pole → Podél křivky. Zvol „Okraj rovné plochy tělesa“ a klikni na „Vybrat okraj na tělese…“.',
          obr: () => obr(3, 175, 70).kvadr(-30, -20, 0, 60, 40, 5).valec(-25, -15, -2, 2.5, 10, { styl: 'dira', trida: 'vybrane' })
            .ramec([12, 12, 180, 196]).okno(198, 70, 150, '▦ Pole', [['○ Řada  ○ Kruh', null], ['● Podél křivky', null], ['Okraj plochy', null]], { tlacitko: '👆 Vybrat okraj' }).svg('Okno Pole, podél křivky') },
        { nadpis: 'Klikni na plochu u okraje', text: 'Klikni na horní plochu kousek od okraje. Vezme se obrys, kterému jsi nejblíž – i obrys otvoru uprostřed. Ve scéně se ukáže oranžově.',
          obr: () => obr(3, 175, 70).kvadr(-30, -20, 0, 60, 40, 5).cara(obdelnik(-30, -20, 30, 20, 5), { uzavrena: true, styl: 'zvyr silna' }).kurzor([24, 16, 5]).svg('Klik na plochu u okraje') },
        { nadpis: 'Odstup od okraje a počet', text: 'Odstup 5 mm posune křivku dovnitř (záporné číslo ven). Zadej počet kusů, nebo rozteč v mm. Kopie se ukazují hned – měň čísla a sleduj.',
          obr: () => {
            const o = obr(3, 175, 70).kvadr(-30, -20, 0, 60, 40, 5).cara(obdelnik(-25, -15, 25, 15, 5), { uzavrena: true, styl: 'zvyr' })
              .cara([[30, 20, 5], [25, 15, 5]], { styl: 'kota' }).stitek([28, 18, 5], 'odstup 5', { dx: 6, dy: 12 });
            poObvodu(-25, -15, 25, 15, 10).forEach(([x, y], i) => o.valec(x, y, -2, 2.5, 10, { styl: 'dira', trida: 'objevit', zpozdeni: i * 0.25 }));
            return o.ramec([160, 12, 188, 196]).okno(12, 120, 140, 'Rozmístění', [['Počet kusů', '10', true], ['Odstup', '5 mm', true]]).svg('Kopie děr kolem okraje s odstupem');
          } },
        { nadpis: 'Seskup s deskou – a kdykoli uprav', text: 'Pole se samo seskupí. Vyber ho spolu s deskou a Ctrl+G – díry se odečtou. Počet či odstup změníš v inspektoru tlačítkem „▦ Upravit pole…“.',
          obr: () => { const o = obr(3, 175, 70).kvadr(-30, -20, 0, 60, 40, 5); poObvodu(-25, -15, 25, 15, 10).forEach(([x, y]) => o.otvor(x, y, 5, 2.5)); return o.ramec([12, 12, 180, 196]).okno(198, 120, 150, 'Inspektor', [['Pole (10 ks)', null]], { tlacitko: '▦ Upravit pole…' }).svg('Deska s dírami po okraji'); } },
      ],
    },
    {
      id: 'pole-skica', ikona: '〰️', nazev: 'Kopie po nakreslené křivce', prikaz: 'pole',
      uvod: 'Plot, zuby, nýty po oblouku – kopie jdou po čáře, kterou si nakreslíš ve skice.',
      kroky: [
        { nadpis: 'Nakresli křivku ve skice', text: 'Tvary → ✏️ Skica, nástroj Čára a oblouky (L). V panelu zaškrtni „Ponechat jako skicu“ – jinak by se z ní stalo těleso.',
          obr: () => obr(3.4, 180, 112).deska(-32, -26, 32, 26).cara(esko(), { styl: 'skica silna' }).kvadr(-31, -9, 0, 4, 4, 6).svg('Nakreslená křivka a kostka') },
        { nadpis: 'Pole → Podél křivky → Obrys skici', text: 'Vyber kostku a otevři Úpravy → Pole. Zvol Podél křivky a „Obrys skici“. Originál se přesune na začátek křivky.',
          obr: () => { const o = obr(3.4, 180, 112).deska(-32, -26, 32, 26).cara(esko(), { styl: 'zvyr' }); const b = esko(6); b.forEach(([x, y], i) => o.kvadr(x - 2, y - 2, 0, 4, 4, 6, { trida: 'objevit', zpozdeni: i * 0.3 })); return o.svg('Kopie po křivce'); } },
        { nadpis: 'Natáčet podle tečny', text: '„Natáčet kopie“ otočí každý kus podle směru křivky (zuby, příčky plotu). Bez něj zůstanou všechny kusy rovně.',
          obr: () => {
            const o = obr(3.4, 180, 112).deska(-32, -26, 32, 26).cara(esko(), { styl: 'zvyr' });
            esko(6).forEach(([x, y], i, a) => { const n = a[Math.min(i + 1, a.length - 1)], p = a[Math.max(i - 1, 0)], u = Math.atan2(n[1] - p[1], n[0] - p[0]), c = Math.cos(u), s = Math.sin(u);
              const roh = [[-4, -1], [4, -1], [4, 1], [-4, 1]].map(([a1, b1]) => [x + a1 * c - b1 * s, y + a1 * s + b1 * c]);
              o.raw(`<g class="n-tel"><polygon class="fz" points="${roh.map(([px, py]) => o.P(px, py, 6)).map(q => f(q[0]) + ',' + f(q[1])).join(' ')}"/></g>`); });
            return o.stitek([0, 0, 0], '☑ Natáčet kopie', { dx: 30, dy: -78 }).svg('Kopie natočené podle křivky');
          } },
        { nadpis: 'Počet, nebo rozteč', text: 'Počet = kusy rovnoměrně po celé délce. Rozteč = kus každých N mm od začátku. „Víc možností“: jen část křivky (od–do %).',
          obr: () => {
            const o = obr(3.2, 180, 80);
            o.cara([[-30, -12, 0], [30, -12, 0]], { styl: 'zvyr' }).cara([[-30, 14, 0], [30, 14, 0]], { styl: 'zvyr' });
            for (let i = 0; i < 5; i++) o.kvadr(-31.5 + 15 * i, -13.5, 0, 3, 3, 5);
            for (let i = 0; i < 6; i++) o.kvadr(-31.5 + 11 * i, 12.5, 0, 3, 3, 5);
            return o.stitek([-30, -12, 0], 'Počet 5', { dx: 8, dy: -44 }).stitek([-30, 14, 0], 'Rozteč 11 mm', { dx: -98, dy: 4 }).svg('Počet versus rozteč');
          } },
      ],
    },
    {
      id: 'hrany', ikona: '◜', nazev: 'Zaoblení a sražení hran', prikaz: 'zaoblitHrany',
      uvod: 'Ostré hrany řezají do ruky a lámou se. Zaoblení (rádius) nebo sražení (fazeta) se počítá přesně.',
      kroky: [
        { nadpis: 'Vyber těleso a nástroj', text: 'Vyber těleso a dej Úpravy → Zaoblit hrany (nebo Srazit hrany). Nastav velikost v mm.',
          obr: () => obr(3.4, 175, 95).deska(-30, -25, 30, 25).kvadr(-20, -15, 0, 40, 30, 14).ramec([12, 12, 190, 196]).okno(206, 80, 142, '◜ Zaoblit hrany', [['Poloměr', '3 mm', true]]).svg('Těleso a okno zaoblení') },
        { nadpis: 'Klikej na hrany', text: 'Klikni na hranu – hned se zaoblí. Další klik přidá další, klik znovu ji vrátí. Svislé / Horní / Dolní přidají celou skupinu hran.',
          obr: () => obr(3.4, 175, 95).deska(-30, -25, 30, 25).kvadr(-20, -15, 0, 40, 30, 14).cara([[20, -15, 14], [20, 15, 14]], { styl: 'zvyr silna' }).kurzor([20, 2, 14]).svg('Klik na hranu') },
        { nadpis: 'Zaoblení, nebo sražení', text: 'Zaoblení je oblouk o poloměru r, sražení rovná fazeta. Sražení se lépe tiskne (bez převisu) – hodí se na spodní hrany.',
          obr: () => obr(2.6, 180, 85).kvadrHrana(-34, -12, 0, 26, 24, 14, 5).kvadrHrana(8, -12, 0, 26, 24, 14, 5, { srazeni: true })
            .stitek([-21, 12, 0], 'zaoblení r 5', { dx: -40, dy: 26 }).stitek([21, 12, 0], 'sražení 5', { dx: -34, dy: 26 }).svg('Zaoblení a sražení') },
        { nadpis: 'Rady pro čisté rohy', text: 'Kombinuješ-li obojí, uprav nejdřív svislé hrany, pak horní. Zaoblení nesmí být větší než polovina stěny – tenká stěna 4 mm unese nejvýš r 2.',
          obr: () => obr(3, 175, 100).kvadr(-25, -15, 0, 50, 30, 14).kapsa(-21, -11, 21, 11, 14, 10).cara([[25, -15, 14], [25, 15, 14]], { styl: 'zvyr silna' }).cara([[25, 15, 0], [25, 15, 14]], { styl: 'zvyr silna' })
            .stitek([25, 15, 7], '1. svislé', { dx: 8, dy: 8 }).stitek([25, 0, 14], '2. horní', { dx: 10, dy: -14 }).stitek([0, -11, 14], 'stěna 4 mm → r ≤ 2', { dx: -60, dy: -28 }).svg('Pořadí hran a stěna') },
      ],
    },
    {
      id: 'skorepina', ikona: '📦', nazev: 'Skořepina – krabička z kvádru', prikaz: 'skorepina',
      uvod: 'Z plného tělesa uděláš duté s danou tloušťkou stěny. Plocha, na kterou klikneš, zůstane otevřená.',
      kroky: [
        { nadpis: 'Plné těleso', text: 'Připrav vnější tvar krabičky – kvádr, klidně se zaoblenými svislými hranami.',
          obr: () => obr(3.2, 175, 95).deska(-30, -25, 30, 25).kvadr(-22, -16, 0, 44, 32, 18).svg('Plný kvádr') },
        { nadpis: 'Úpravy → Skořepina, klik na plochu', text: 'Nastav stěnu (2 mm) a klikni na značku horní plochy – ta bude otevřená. Bez kliknutí vznikne uzavřená dutina.',
          obr: () => obr(3.2, 175, 95).deska(-30, -25, 30, 25).kvadr(-22, -16, 0, 44, 32, 18).raw('').kvadr(-22, -16, 18, 44, 32, 0.01, { styl: 'zvyr' }).kurzor([0, 0, 18]).ramec([12, 12, 196, 196]).okno(214, 80, 134, '📦 Skořepina', [['Stěna', '2 mm', true]]).svg('Klik na horní plochu') },
        { nadpis: 'Krabička je hotová', text: 'Vznikla krabička se stěnou 2 mm. Víko: Tvary → Další → Krabička s víkem, nebo stejný kvádr nižší a skořepina s otevřenou spodní plochou.',
          obr: () => obr(3.2, 175, 95).deska(-30, -25, 30, 25).kvadr(-22, -16, 0, 44, 32, 18).kapsa(-20, -14, 20, 14, 18, 16).stitek([22, -16, 18], 'stěna 2 mm', { dx: 6, dy: -4 }).svg('Krabička') },
      ],
    },
    {
      id: 'skica', ikona: '✏️', nazev: 'Vlastní tvar ze skici', prikaz: null, akce: () => M.otevriSkicar && M.otevriSkicar(),
      uvod: 'Co není v Tvarech, nakreslíš ve 2D a vytáhneš do výšky – nebo otočíš kolem osy (vázy, knoflíky).',
      kroky: [
        { nadpis: 'Tvary → Skica', text: 'Otevře se kreslicí plocha. Obdélník, kruh, čáry a oblouky (L), text… Body jde táhnout a kóty přepsat číslem.',
          obr: () => obr(3.2, 180, 110).deska(-32, -26, 32, 26).cara([[-20, -14, 0.2], [20, -14, 0.2], [20, -2, 0.2], [0, -2, 0.2], [0, 14, 0.2], [-20, 14, 0.2]], { styl: 'skica silna', uzavrena: true }).svg('Nakreslený profil L') },
        { nadpis: 'Vytažení do výšky', text: 'V panelu skici nastav výšku vytažení a dej Hotovo – z obrysu je těleso, které jde dál upravovat jako každé jiné.',
          obr: () => { const o = obr(3.2, 180, 110).deska(-32, -26, 32, 26); o.kvadr(0, -14, 0, 20, 12, 10).kvadr(-20, -14, 0, 20, 28, 10); return o.sipka([10, -8, 11], [10, -8, 22]).stitek([10, -8, 22], 'výška 10 mm', { dx: 8 }).svg('Vytažený profil'); } },
        { nadpis: 'Nebo otočit kolem osy', text: 'Režim Rotace: nakresli polovinu profilu vedle osy a skica se otočí dokola – váza, kalíšek, knoflík.',
          obr: () => {
            const prof = []; for (let i = 0; i <= 24; i++) { const z = 32 * i / 24; prof.push([10 + 6 * Math.sin(z / 32 * PI * 1.2 + 0.4) + (z < 2 ? -1 : 0), z]); }
            const o = obr(3, 180, 150).deska(-25, -25, 25, 25).rotace(0, 0, prof, { otevrena: true });
            // vedle: nakreslená polovina profilu u osy
            return o.cara([[0, 0, -2], [0, 0, 38]], { styl: 'kota' }).stitek([0, 0, 38], 'osa', { dx: 6 }).svg('Váza z rotace profilu kolem osy');
          } },
      ],
    },
    {
      id: 'kapsa', ikona: '🔲', nazev: 'Kapsa a tvar přímo na stěně', prikaz: 'kapsaNaPlose',
      uvod: 'Výřez, drážka nebo nápis dovnitř stěny – nakreslíš ho rovnou na ploše tělesa.',
      kroky: [
        { nadpis: 'Úpravy → Kapsa ze skici, klik na stěnu', text: 'Klikni na rovnou stěnu tělesa. Otevře se skica přímo na ní – obrys stěny je vidět čárkovaně.',
          obr: () => obr(3.2, 175, 95).deska(-30, -25, 30, 25).kvadr(-22, -16, 0, 44, 32, 14).kvadr(-22, -16, 14, 44, 32, 0.01, { styl: 'zvyr' }).kurzor([5, 2, 14]).svg('Klik na stěnu') },
        { nadpis: 'Nakresli tvar', text: 'Nakresli obrys kapsy (obdélník, kruh, cokoli) a nastav hloubku. Může jít i skrz – vznikne otvor.',
          obr: () => obr(3.2, 175, 95).deska(-30, -25, 30, 25).kvadr(-22, -16, 0, 44, 32, 14).cara(obdelnik(-14, -9, 14, 9, 14), { styl: 'skica silna', uzavrena: true }).ramec([12, 12, 196, 196]).okno(214, 80, 134, 'Kapsa', [['Hloubka', '6 mm', true]]).svg('Obrys kapsy na stěně') },
        { nadpis: 'Hotovo – vyříznuto', text: 'Po Hotovo se kapsa vyřízne a spojí s tělesem. Přidat tvar ven (výstupek) jde stejně přes Skica na ploše.',
          obr: () => obr(3.2, 175, 95).deska(-30, -25, 30, 25).kvadr(-22, -16, 0, 44, 32, 14).kapsa(-14, -9, 14, 9, 14, 6).svg('Vyříznutá kapsa') },
      ],
    },
    {
      id: 'tazeni', ikona: '➰', nazev: 'Tažení profilu po dráze', prikaz: 'tazeni',
      uvod: 'Madlo, trubka, lišta nebo těsnění: průřez (profil) se protáhne po nakreslené dráze.',
      kroky: [
        { nadpis: 'Dvě skici: profil a dráha', text: 'Nakresli malou skicu průřezu (kroužek) a druhou skicu dráhy (čára s oblouky). U obou „Ponechat jako skicu“.',
          obr: () => obr(3.2, 180, 110).deska(-32, -26, 32, 26).cara(esko(), { styl: 'skica silna' }).cara(Array.from({ length: 25 }, (_, i) => [-26 + 4 * Math.cos(i / 24 * 2 * PI), 18 + 4 * Math.sin(i / 24 * 2 * PI), 0.2]), { styl: 'skica silna' })
            .stitek([-26, 18, 0], 'profil', { dx: -54, dy: 8 }).stitek([28, -4, 0], 'dráha', { dx: 6 }).svg('Profil a dráha') },
        { nadpis: 'Vyber obě, Úpravy → Tažení', text: 'Vyber profil i dráhu a dej Úpravy → Tažení profilu po dráze. Která skica je profil, pozná Modelář sám (menší).',
          obr: () => obr(3.2, 180, 110).deska(-32, -26, 32, 26).cara(esko(), { styl: 'zvyr silna' }).raw('').cara(Array.from({ length: 25 }, (_, i) => [-26 + 4 * Math.cos(i / 24 * 2 * PI), 18 + 4 * Math.sin(i / 24 * 2 * PI), 0.2]), { styl: 'zvyr silna' }).svg('Vybrané skici') },
        { nadpis: 'Trubka po křivce', text: 'Vznikne těleso po celé dráze. S „Ponechat jako skicu“ jde v inspektoru měnit zkroucení, zúžení i šroubovice (pružina).',
          obr: () => { const o = obr(3.2, 180, 110).deska(-32, -26, 32, 26); const b = esko(60).map(p => [p[0], p[1], 3]); return o.cara(b, { styl: 'trubka' }).cara(b, { styl: 'trubka-lesk' }).svg('Trubka po dráze'); } },
      ],
    },
    {
      id: 'magnet', ikona: '🧲', nazev: 'Magnet – přiložit plochou', prikaz: 'magnet',
      uvod: 'Přiloží jedno těleso plochou na plochu druhého – i natočené, bez počítání úhlů.',
      kroky: [
        { nadpis: 'Klikni na plochu, kterou přikládáš', text: 'Stiskni G (Magnet) a klikni na plochu prvního tělesa – zvýrazní se oranžově.',
          obr: () => obr(3, 175, 105).deska(-32, -26, 32, 26).kvadr(-28, -10, 0, 18, 18, 10).kvadr(-28, -10, 10, 18, 18, 0.01, { styl: 'zvyr' }).kvadr(8, -12, 0, 22, 24, 22).kurzor([-19, -1, 10]).ramec([12, 12, 336, 168]).klavesa(320, 188, 'G').svg('První plocha') },
        { nadpis: 'Klikni na cílovou plochu', text: 'Teď klikni na plochu, ke které se má přisadit – pod kurzorem svítí zeleně. Místo kliknutí = kam dosedne střed.',
          obr: () => obr(3, 175, 105).deska(-32, -26, 32, 26).kvadr(-28, -10, 0, 18, 18, 10).kvadr(8, -12, 0, 22, 24, 22).kvadr(30, -12, 0, 0.01, 24, 22, { styl: 'zeleny' }).kurzor([30, 0, 12]).svg('Cílová plocha') },
        { nadpis: 'Přisazeno', text: 'První těleso se otočí a dosedne plochou na plochu druhého. Jeden krok Zpět (Ctrl+Z) vše vrátí.',
          obr: () => obr(3, 175, 105).deska(-32, -26, 32, 26).kvadr(8, -12, 0, 22, 24, 22).kvadr(30, -9, 3, 10, 18, 18).svg('Přisazené těleso') },
      ],
    },
    {
      id: 'promenne', ikona: 'ƒx', nazev: 'Proměnné a vzorce', prikaz: 'promenne',
      uvod: 'Rozměry propojené výpočtem: změníš jedno číslo a přepočítá se celý model.',
      kroky: [
        { nadpis: 'Dílna → ƒx Proměnné', text: 'Přidej proměnné, třeba D = 30 (průměr) a vule = 0,2 (vůle pro tisk).',
          obr: () => obr().okno(90, 40, 180, 'ƒx Proměnné projektu', [['D', '30'], ['vule', '0,2']]).svg('Tabulka proměnných') },
        { nadpis: 'Do pole napiš vzorec', text: 'Do kteréhokoli pole inspektoru napiš výraz: D/2 + vule. Pole se vzorcem je modré.',
          obr: () => obr(2.6, 110, 150).kvadr(-14, -14, 0, 28, 28, 10).ramec([12, 12, 176, 196]).okno(196, 70, 152, 'Inspektor', [['Šířka', 'D/2 + vule', true], ['Výška', '10']]).svg('Vzorec v poli') },
        { nadpis: 'Změna se přepočítá', text: 'Změníš D na 40 a všechna pole se vzorcem se přepočítají – jeden krok Zpět.',
          obr: () => obr(2.4, 180, 140).kvadr(-40, -8, 0, 15, 15, 10).sipka([-18, 0, 5], [2, 0, 5]).kvadr(8, -10, 0, 20, 20, 10).stitek([-40, -8, 10], 'D = 30', { dy: -26 }).stitek([8, -10, 10], 'D = 40', { dy: -26 }).svg('Přepočet po změně') },
      ],
    },
    {
      id: 'sestava', ikona: '⚙️', nazev: 'Pohyblivá sestava a srážky', prikaz: 'sestava',
      uvod: 'Vyzkoušej, jestli se víko otevře a nic do sebe nenarazí – ještě před tiskem.',
      kroky: [
        { nadpis: 'Vytvoř kloub', text: 'Dílna → Pohyblivá sestava. Vyber díl, který se hýbe (víko), a zvol kloub: otáčení kolem osy nebo posuv.',
          obr: () => obr(3, 175, 105).deska(-32, -26, 32, 26).kvadr(-20, -15, 0, 40, 30, 14).kvadr(-20, -15, 14, 40, 30, 3, { styl: 'modry' }).cara([[-24, 15, 17], [24, 15, 17]], { styl: 'kota' }).stitek([24, 15, 17], 'osa kloubu', { dx: 4 }).svg('Víko s osou kloubu') },
        { nadpis: 'Pohni posuvníkem', text: 'Posuvník otevře víko. Zapni „Hlídat srážky“ – místa, kde díly do sebe narážejí, zčervenají.',
          obr: () => {
            const o = obr(3, 175, 105).deska(-32, -26, 32, 26).kvadr(-20, -15, 0, 40, 30, 14);
            const a = 1.0, y0 = -15, z0 = 14, rot = ([x, y, z]) => { const dy = y - y0, dz = z - z0; return [x, y0 + dy * Math.cos(a) - dz * Math.sin(a), z0 + dy * Math.sin(a) + dz * Math.cos(a)]; };
            const q = arr => arr.map(v => o.P(...rot(v))).map(t => f(t[0]) + ',' + f(t[1])).join(' ');
            // víko otevřené dozadu: vidět je jeho spodní strana, přední hrana a bok
            o.raw(`<g class="n-modry"><polygon class="fz" points="${q([[-20, -15, 14], [20, -15, 14], [20, 15, 14], [-20, 15, 14]])}"/><polygon class="fy" points="${q([[-20, 15, 14], [20, 15, 14], [20, 15, 17], [-20, 15, 17]])}"/><polygon class="fx" points="${q([[20, -15, 14], [20, 15, 14], [20, 15, 17], [20, -15, 17]])}"/></g>`);
            return o.cara([[-24, -15, 14], [24, -15, 14]], { styl: 'kota' }).ramec([12, 12, 186, 196]).okno(198, 80, 150, 'Kloub', [['Úhel', '60°', true]]).svg('Otevřené víko');
          } },
        { nadpis: '🔍 Projet celý rozsah', text: 'Tlačítko 🔍 projede celý pohyb a najde všechny srážky, ▶ pohyb přehraje. Nic se přitom nemění – je to jen zkouška.',
          obr: () => obr(3, 175, 105).deska(-32, -26, 32, 26).kvadr(-20, -15, 0, 40, 30, 14).kvadr(-20, -15, 14, 40, 30, 3, { styl: 'modry' }).kvadr(-8, -6, 12, 16, 12, 5, { styl: 'srazka' }).stitek([8, -6, 17], 'srážka', { dx: 6, dy: -8, styl: 'cerveny' }).svg('Srážka zvýrazněná červeně') },
      ],
    },
    {
      id: 'text', ikona: '🔤', nazev: 'Text na zakřivenou plochu', prikaz: 'textObvod',
      uvod: 'Jmenovka na hrnek, popisek na kulatou krabičku – text se nalepí jako samolepka, i na zaoblení.',
      kroky: [
        { nadpis: 'Úpravy → Text na plochu', text: 'Napiš text, vyber písmo a výšku. Zvol vystouplý (přidá se) nebo vyrytý (odečte se).',
          obr: () => obr(2.6, 180, 130).valec(0, 0, 0, 22, 30).ramec([12, 12, 200, 196]).okno(218, 70, 130, '🔤 Text', [['Text', 'MODELÁŘ'], ['Výška', '6 mm']]).svg('Válec a okno textu') },
        { nadpis: 'Umístit kliknutím', text: 'Klikni na těleso tam, kde má být střed textu. Čte se z pohledu, ze kterého klikáš.',
          obr: () => obr(2.6, 180, 130).valec(0, 0, 0, 22, 30).kurzor([16, 16, 16]).svg('Klik na válec') },
        { nadpis: 'Text sedí na ploše', text: 'Text obtéká zaoblení bez natažení písmen. Funguje na rovné stěně, válci, kouli i na skupině s dírami.',
          obr: () => { const o = obr(2.6, 180, 130).valec(0, 0, 0, 22, 30); const pth = []; for (let i = 0; i <= 20; i++) { const t = 3 * PI / 4 - 0.35 - (PI - 0.7) * i / 20; pth.push(o.P(22.3 * Math.cos(t), 22.3 * Math.sin(t), 13)); }
            return o.raw(`<path id="nTextDraha" d="M${pth.map(q => f(q[0]) + ' ' + f(q[1])).join(' L')}" fill="none"/><text class="n-napis"><textPath href="#nTextDraha" startOffset="50%" text-anchor="middle">MODELÁŘ</textPath></text>`).svg('Text na válci'); } },
      ],
    },
  ];

  // ------------------------------------------------------------ okno
  M.vytvorNavody = function () {
    const okno = document.createElement('dialog');
    okno.id = 'oknoNavodu';
    okno.className = 'okno siroke-okno okno-navodu';
    okno.setAttribute('aria-labelledby', 'navNadpis');
    okno.innerHTML = `<h2 id="navNadpis">📘 Názorné návody</h2>
      <div class="nav-telo">
        <nav class="nav-seznam" aria-label="Návody">${M.NAVODY.map(n => `<button type="button" class="nav-polozka" data-id="${n.id}"><span class="nav-ik" aria-hidden="true">${esc(n.ikona)}</span><span>${esc(n.nazev)}</span></button>`).join('')}</nav>
        <section class="nav-detail" aria-live="polite">
          <h3 id="navTitul"></h3>
          <p class="nav-uvod" id="navUvod"></p>
          <div class="nav-obr" id="navObr"></div>
          <div class="nav-krok"><span class="nav-cislo" id="navCislo"></span> <b id="navKrokNadpis"></b></div>
          <p class="nav-text" id="navText"></p>
          <div class="nav-tecky" id="navTecky" role="tablist" aria-label="Kroky"></div>
          <div class="tlacitka nav-ovladani">
            <button type="button" class="tl" id="navZpet">← Zpět</button>
            <button type="button" class="tl hlavni-tl" id="navDalsi">Další →</button>
            <button type="button" class="tl" id="navZkusit" title="Zavřít návod a spustit nástroj">▶ Vyzkoušet</button>
            <button type="button" class="tl" id="navZavrit">Zavřít</button>
          </div>
        </section>
      </div>`;
    document.body.appendChild(okno);
    const $ = id => okno.querySelector('#' + id);
    let akt = M.NAVODY[0], krok = 0;
    function ukaz() {
      const k = akt.kroky[krok];
      okno.querySelectorAll('.nav-polozka').forEach(b => { b.classList.toggle('aktivni', b.dataset.id === akt.id); b.setAttribute('aria-current', b.dataset.id === akt.id ? 'true' : 'false'); });
      $('navTitul').textContent = akt.ikona + ' ' + akt.nazev;
      $('navUvod').textContent = akt.uvod;
      let svg = '';
      try { svg = k.obr(); } catch (e) { console.warn('Návod: obrázek', e); }
      $('navObr').innerHTML = svg;
      $('navCislo').textContent = `Krok ${krok + 1}/${akt.kroky.length}`;
      $('navKrokNadpis').textContent = k.nadpis;
      $('navText').textContent = k.text;
      $('navTecky').innerHTML = akt.kroky.map((x, i) => `<button type="button" role="tab" class="nav-tecka${i === krok ? ' aktivni' : ''}" data-krok="${i}" aria-selected="${i === krok}" aria-label="Krok ${i + 1}: ${esc(x.nadpis)}"></button>`).join('');
      $('navZpet').disabled = krok === 0;
      $('navDalsi').textContent = krok === akt.kroky.length - 1 ? 'Další návod →' : 'Další →';
      const p = akt.prikaz && M.PRIKAZY && M.PRIKAZY.find(x => x.id === akt.prikaz);
      $('navZkusit').hidden = !(p || akt.akce);
    }
    M.otevriNavod = function (id) {
      akt = M.NAVODY.find(n => n.id === id) || akt;
      krok = 0;
      ukaz();
      // i nad jiným otevřeným dialogem (Pole…) – modální okna se vrství
      if (!okno.open) okno.showModal();
      $('navDalsi').focus();
    };
    okno.querySelector('.nav-seznam').addEventListener('click', e => {
      const b = e.target.closest('.nav-polozka');
      if (b) { akt = M.NAVODY.find(n => n.id === b.dataset.id); krok = 0; ukaz(); }
    });
    $('navTecky').addEventListener('click', e => { const b = e.target.closest('[data-krok]'); if (b) { krok = +b.dataset.krok; ukaz(); } });
    $('navZpet').onclick = () => { if (krok > 0) { krok--; ukaz(); } };
    $('navDalsi').onclick = () => {
      if (krok < akt.kroky.length - 1) krok++;
      else { akt = M.NAVODY[(M.NAVODY.indexOf(akt) + 1) % M.NAVODY.length]; krok = 0; }
      ukaz();
    };
    $('navZavrit').onclick = () => okno.close();
    $('navZkusit').onclick = () => {
      okno.close();
      // dialog, ze kterého se návod otevřel, zůstal otevřený: nástroj nespouštět přes něj
      if (M.modalniOkno && M.modalniOkno()) return;
      if (akt.akce) { akt.akce(); return; }
      if (!M.spustPrikaz(akt.prikaz)) Dialog.info('Nejdřív vyber těleso, se kterým chceš pracovat – pak nástroj spustíš (' + akt.nazev + ').');
    };
    okno.addEventListener('keydown', e => {
      if (e.target.closest('input, select, textarea')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); $('navDalsi').click(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); $('navZpet').click(); }
    });
    // tlačítka „❔ Návod“ kdekoli v aplikaci (i v později postavených panelech)
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-navod]');
      if (!b) return;
      e.preventDefault();
      M.otevriNavod(b.dataset.navod);
    });
  };
})(MDL);
