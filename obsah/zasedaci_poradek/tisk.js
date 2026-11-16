/* Zasedací pořádek – kreslení plánku (SVG) a tiskových listů (HTML v milimetrech).
   Potřebuje ZasedaciJadro. Písmo se měří na plátně až po načtení (document.fonts.load),
   takže jména na jmenovkách nepřetečou. Písma jsou z obsah/fonty (SIL OFL 1.1 / Apache 2.0). */
(function () {
  'use strict';
  const J = window.ZasedaciJadro;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const mm = v => (Math.round(v * 100) / 100) + 'mm';
  const r2 = v => Math.round(v * 1000) / 1000;

  /* ---------- písma ---------- */
  const PISMA = [
    { id: 'sans', nazev: 'Bezpatkové (systémové)', css: 'system-ui, "Segoe UI", sans-serif' },
    { id: 'serif', nazev: 'Liberation Serif', soubor: 'LiberationSerif-Regular.ttf' },
    { id: 'serifi', nazev: 'Liberation Serif kurzíva', soubor: 'LiberationSerif-Italic.ttf' },
    { id: 'greatvibes', nazev: 'Great Vibes (psací)', soubor: 'GreatVibes-Regular.ttf' },
    { id: 'allura', nazev: 'Allura (psací)', soubor: 'Allura-Regular.ttf' },
    { id: 'parisienne', nazev: 'Parisienne (psací)', soubor: 'Parisienne-Regular.ttf' },
    { id: 'pinyon', nazev: 'Pinyon Script (psací)', soubor: 'PinyonScript-Regular.ttf' },
    { id: 'italianno', nazev: 'Italianno (psací)', soubor: 'Italianno-Regular.ttf' },
    { id: 'marck', nazev: 'Marck Script (ručně psané)', soubor: 'MarckScript-Regular.ttf' },
    { id: 'courgette', nazev: 'Courgette', soubor: 'Courgette-Regular.ttf' },
    { id: 'kaushan', nazev: 'Kaushan Script', soubor: 'KaushanScript-Regular.ttf' },
    { id: 'pacifico', nazev: 'Pacifico', soubor: 'Pacifico-Regular.ttf' },
    { id: 'lobster', nazev: 'Lobster', soubor: 'Lobster-Regular.ttf' },
    { id: 'marcellus', nazev: 'Marcellus (antikva)', soubor: 'Marcellus-Regular.ttf' },
    { id: 'playfair', nazev: 'Playfair Display SC', soubor: 'PlayfairDisplaySC-Black.ttf' },
    { id: 'cinzel', nazev: 'Cinzel Decorative', soubor: 'CinzelDecorative-Bold.ttf' },
    { id: 'imfell', nazev: 'IM Fell English (historické)', soubor: 'IMFellEnglish-Regular.ttf' },
    { id: 'fondamento', nazev: 'Fondamento', soubor: 'Fondamento-Regular.ttf' },
    { id: 'uncial', nazev: 'Uncial Antiqua', soubor: 'UncialAntiqua-Regular.ttf' },
    { id: 'patrick', nazev: 'Patrick Hand (dětské)', soubor: 'PatrickHand-Regular.ttf' },
    { id: 'amatic', nazev: 'Amatic SC', soubor: 'AmaticSC-Bold.ttf' }
  ];
  const PISMA_M = Object.fromEntries(PISMA.map(p => [p.id, p]));
  (function () {   // @font-face pro všechna písma (stahují se, až když jsou potřeba)
    const st = document.createElement('style');
    st.textContent = PISMA.filter(p => p.soubor).map(p => `@font-face{font-family:"ZP_${p.id}";src:url("fonty/${p.soubor}") format("truetype");font-display:block}`).join('\n');
    document.head.appendChild(st);
  })();
  const rodina = id => { const p = PISMA_M[id] || PISMA[0]; return p.css || `"ZP_${p.id}", serif`; };
  async function nactiPisma(ids) {
    await Promise.all(ids.map(id => PISMA_M[id] && PISMA_M[id].soubor ? document.fonts.load(`40px "ZP_${id}"`, 'ŘžůÁ').catch(() => null) : null));
  }
  const platno = document.createElement('canvas').getContext('2d');
  const mira = new Map();
  function pomer(text, id) {   // šířka textu / velikost písma
    const k = id + '|' + text;
    if (!mira.has(k)) { platno.font = `100px ${rodina(id)}`; mira.set(k, platno.measureText(text).width / 100); }
    return mira.get(k);
  }
  function vymazMiru() { mira.clear(); }
  /* jméno na 1 nebo 2 řádky – co dá větší písmo */
  function usporadej(text, id, W, H) {
    const s1 = J.velikostPisma(text, t => pomer(t, id), W, H);
    const d = J.dvaRadky(text);
    if (d.length < 2 || s1 > H * 0.6) return { radky: [text], s: s1 };
    const s2 = Math.min(H / 2.15, J.velikostPisma(d[0], t => pomer(t, id), W, H), J.velikostPisma(d[1], t => pomer(t, id), W, H));
    return s2 > s1 * 1.25 ? { radky: d, s: s2 } : { radky: [text], s: s1 };
  }

  /* ---------- plánek sálu (SVG, souřadnice v metrech) ---------- */
  function kratkeJmeno(jm) {
    const c = J.castiJmena(jm);
    const t = c.length > 1 ? c[0] + ' ' + c[c.length - 1].charAt(0) + '.' : (c[0] || jm);
    return t.length > 16 ? t.slice(0, 15) + '…' : t;
  }
  function inicialy(jm) { const c = J.castiJmena(jm); return ((c[0] || '?').charAt(0) + (c.length > 1 ? c[c.length - 1].charAt(0) : '')).toUpperCase(); }
  function barvySkupin(p) {
    const sk = [...new Set(p.hoste.map(h => h.skupina).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'cs'));
    return Object.fromEntries(sk.map((s, i) => [s, J.BARVY[i % J.BARVY.length]]));
  }
  /* o: {jmena, vybranyStul, vybranyHost, zvyrazni: Set(hostId), tisk} */
  function planekSVG(p, o) {
    o = o || {};
    const hm = Object.fromEntries(p.hoste.map(h => [h.id, h])), kdo = J.kdoSedi(p), barvy = barvySkupin(p);
    const zv = o.zvyrazni || new Set();
    let h = `<svg class="zp-plan${o.tisk ? ' tiskova' : ''}" viewBox="-0.6 -0.6 ${r2(p.sal.sirka + 1.2)} ${r2(p.sal.hloubka + 1.2)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Plánek sálu">`;
    h += `<rect class="sal" x="0" y="0" width="${p.sal.sirka}" height="${p.sal.hloubka}" rx="0.1"/>`;
    let mriz = '';
    for (let x = 1; x < p.sal.sirka; x++) mriz += `M${x} 0V${p.sal.hloubka}`;
    for (let y = 1; y < p.sal.hloubka; y++) mriz += `M0 ${y}H${p.sal.sirka}`;
    if (!o.tisk) h += `<path class="mriz" d="${mriz}"/>`;
    // prvky dospod, stoly navrch
    const stoly = p.stoly.slice().sort((a, b) => (a.tvar === 'prvek' ? 0 : 1) - (b.tvar === 'prvek' ? 0 : 1));
    for (const s of stoly) {
      const r = J.rozmery(s), vyb = o.vybranyStul === s.id;
      h += `<g class="stul${vyb ? ' vybrany' : ''}${s.hlavni ? ' hlavni' : ''}" data-stul="${esc(s.id)}" transform="translate(${r2(s.x)} ${r2(s.y)}) rotate(${s.uhel})">`;
      if (s.tvar === 'prvek') {
        h += `<rect class="prvek" x="${r2(-r.w / 2)}" y="${r2(-r.h / 2)}" width="${r2(r.w)}" height="${r2(r.h)}" rx="0.08"/>`;
        h += `<text class="popis-prvku" transform="rotate(${-s.uhel})" font-size="${r2(Math.min(0.45, Math.max(0.2, Math.min(r.w, r.h) / 4)))}" data-i18n="ne">${esc(s.nazev || 'Prvek')}</text></g>`;
        continue;
      }
      if (s.tvar === 'kulaty') h += `<circle class="deska" r="${r2(r.r)}"/>`;
      else h += `<rect class="deska" x="${r2(-r.w / 2)}" y="${r2(-r.h / 2)}" width="${r2(r.w)}" height="${r2(r.h)}" rx="0.05"/>`;
      const popis = s.hlavni && !s.nazev ? '★' : s.nazev ? s.nazev : String(s.cislo || '?');
      const fs = popis.length <= 3 ? Math.min(0.42, (r.h || 1) * 0.5) : Math.min(0.26, (r.w * 0.9) / (popis.length * 0.55));
      h += `<text class="cislo-stolu" transform="rotate(${-s.uhel})" font-size="${r2(fs)}" data-i18n="ne">${esc(popis)}</text>`;
      J.mista(s).forEach((m, i) => {
        const hid = kdo[s.id][i], g = hid && hm[hid];
        const smer = s.tvar === 'kulaty' ? Math.atan2(m.y, m.x) * 180 / Math.PI : [0, -90, 0, 90, 180][m.strana];
        const abs = ((smer + s.uhel) % 360 + 360) % 360, otoc = abs > 90 && abs < 270;
        const tr = `translate(${r2(m.x)} ${r2(m.y)})`;
        const tridy = ['misto', g ? 'obsazene' : 'volne', g && g.dite ? 'dite' : '', g && zv.has(g.id) ? 'chyba' : '', g && o.vybranyHost === g.id ? 'vybrane' : '', g && g.zamceny ? 'zamcene' : ''].filter(Boolean).join(' ');
        h += `<g class="${tridy}" data-stul="${esc(s.id)}" data-misto="${i}"${g ? ` data-host="${esc(g.id)}"` : ''} transform="${tr}">`;
        h += `<circle r="0.21"${g && g.skupina && barvy[g.skupina] ? ` style="fill:${barvy[g.skupina]}"` : ''}/>`;
        h += `<text class="ini" transform="rotate(${-s.uhel})">${g ? esc(inicialy(g.jmeno)) : i + 1}</text>`;
        if (g) h += `<title>${esc(g.jmeno)}${g.skupina ? ' · ' + esc(g.skupina) : ''}${g.dieta ? ' · ' + esc(g.dieta) : ''}</title>`;
        h += '</g>';
        if (g && o.jmena !== false) {
          const dx = Math.cos(smer * Math.PI / 180) * 0.29, dy = Math.sin(smer * Math.PI / 180) * 0.29;
          h += `<text class="jmeno-mista" transform="translate(${r2(m.x + dx)} ${r2(m.y + dy)}) rotate(${r2(smer + (otoc ? 180 : 0))})" style="text-anchor:${otoc ? 'end' : 'start'}" data-i18n="ne">${esc(kratkeJmeno(g.jmeno))}</text>`;
        }
      });
      h += '</g>';
    }
    return h + '</svg>';
  }

  /* ---------- tiskové listy ---------- */
  const VELIKOSTI_JM = { mala: { w: 90, h: 45, n: 'Malá 90 × 45 mm' }, stredni: { w: 100, h: 60, n: 'Střední 100 × 60 mm' }, velka: { w: 140, h: 70, n: 'Velká 140 × 70 mm' } };
  const VELIKOSTI_CISLA = { mala: { w: 95, h: 65, n: 'Malá 95 × 65 mm' }, a5: { w: 140, h: 95, n: 'Střední 140 × 95 mm' }, a4: { w: 200, h: 140, n: 'Velká 200 × 140 mm (1 na A4)' } };
  const FORMATY_MENU = { dl: { w: 99, h: 210, n: 'DL 99 × 210 mm' }, a6: { w: 105, h: 148.5, n: 'A6 105 × 148 mm' }, a5: { w: 148.5, h: 210, n: 'A5 148 × 210 mm' } };
  const OKRAJ = 5;

  /* lepší orientace papíru = víc kusů na list */
  function nejlepsi(papir, w, h, stan, okraj, mezera) {
    const a = J.rozlozeni({ papir, w, h, stan, okraj, mezera }), b = J.rozlozeni({ papir, w, h, stan, okraj, mezera, naSirku: true });
    return b.naList > a.naList ? b : a;
  }
  function list(L, obsah, trida) { return `<div class="zp-list ${trida || ''}" style="width:${mm(L.W)};height:${mm(L.H - 0.3)}">${obsah}</div>`; }
  function poListech(L, kusy, kresli) {
    let out = '';
    for (let i = 0; i < kusy.length; i += L.naList) {
      let o = '';
      kusy.slice(i, i + L.naList).forEach((k, j) => { const q = L.pozice[j]; o += `<div class="zp-kus" style="left:${mm(q.x)};top:${mm(q.y)};width:${mm(L.kw)};height:${mm(L.kh)}">${kresli(k)}</div>`; });
      out += list(L, o);
    }
    return out;
  }
  function stan(L, h, polovina, n) {   // stanová karta: horní polovina vzhůru nohama, přehyb uprostřed
    return `<div class="zp-stan${n.ramecek ? ' ram' : ''}">
      <div class="zp-pul hore" style="height:${mm(h)}">${polovina}</div>
      <div class="zp-pul" style="top:${mm(h)};height:${mm(h)}">${polovina}</div>
      ${n.ohyb ? `<div class="zp-ohyb" style="top:${mm(h)}"></div>` : ''}</div>`;
  }
  const ozdoba = (n, w, h) => n.ozdoba ? `<div class="zp-ozdoba" style="inset:${mm(Math.min(w, h) * 0.06)};border-color:${esc(n.barva)}"></div>` : '';

  function jmenovky(p, n) {
    const v = n.jmVelikost === 'vlastni' ? { w: n.jmW, h: n.jmH } : VELIKOSTI_JM[n.jmVelikost] || VELIKOSTI_JM.stredni;
    const L = nejlepsi(n.papir, v.w, v.h, true, OKRAJ, 0);
    let hoste = vyberHostu(p, n);
    const st = Object.fromEntries(p.stoly.map(s => [s.id, s]));
    const W = v.w * 0.84, radek2 = n.jmRadek2 !== 'nic', H = v.h * (radek2 ? 0.5 : 0.62);
    const html = poListech(L, hoste, g => {
      const t = J.textJmenovky(g, n.jmFormat), u = usporadej(t, n.pismo, W, H);
      const u2 = p.usazeni[g.id];
      const druhy = n.jmRadek2 === 'stul' ? (u2 && st[u2.stul] ? J.popisStolu(st[u2.stul]) : '') : n.jmRadek2 === 'vlastni' ? n.jmText2 : '';
      const s2 = Math.min(v.h * 0.12, J.velikostPisma(druhy || ' ', x => pomer(x, n.pismo2), v.w * 0.8, v.h * 0.12));
      const pol = `${ozdoba(n, v.w, v.h)}<div class="zp-stred">
        <div class="zp-jm" style="font-family:${esc(rodina(n.pismo))};font-size:${mm(u.s)};color:${esc(n.barvaTextu)}">${u.radky.map(esc).join('<br>')}</div>
        ${druhy ? `<div class="zp-r2" style="font-family:${esc(rodina(n.pismo2))};font-size:${mm(s2)};color:${esc(n.barva)}">${esc(druhy)}</div>` : ''}</div>
        ${n.jmDieta && (g.dieta || g.alergie) ? `<div class="zp-dieta">${esc([g.dieta, g.alergie && 'alergie: ' + g.alergie].filter(Boolean).join(' · '))}</div>` : ''}`;
      return stan(L, v.h, pol, n);
    });
    return { html, L, kusu: hoste.length, popis: 'jmenovek' };
  }
  function vyberHostu(p, n) {
    let h = p.hoste.slice();
    if (n.vyber === 'rozsazeni') h = h.filter(g => p.usazeni[g.id]);
    else if (n.vyber && n.vyber.startsWith('sk:')) h = h.filter(g => g.skupina === n.vyber.slice(3));
    if (n.poradi === 'stoly') {
      const st = Object.fromEntries(p.stoly.map(s => [s.id, s]));
      const kl = g => { const u = p.usazeni[g.id], s = u && st[u.stul]; return s ? (s.hlavni ? 0 : 1 + s.cislo) * 1000 + u.misto : 1e9; };
      h.sort((a, b) => kl(a) - kl(b));
    } else {
      const ab = J.abecedne(p), por = Object.fromEntries(ab.map((x, i) => [x.id, i]));
      h.sort((a, b) => por[a.id] - por[b.id]);
    }
    return h;
  }

  function cislaStolu(p, n) {
    const v = VELIKOSTI_CISLA[n.cVelikost] || VELIKOSTI_CISLA.a5;
    const L = nejlepsi(n.papir, v.w, v.h, true, OKRAJ, 0);
    const ps = J.poStolech(p);
    const html = poListech(L, ps, x => {
      const s = x.stul, velke = s.nazev || (s.hlavni ? 'Hlavní stůl' : String(s.cislo || '?'));
      const jeCislo = /^\d+$/.test(velke);
      const jm = n.cJmena ? x.hoste.map(g => J.textJmenovky(g, 'bezTitulu')) : [];
      const Hv = v.h * (jm.length ? 0.42 : 0.6) * (n.cNadpis && jeCislo ? 0.85 : 1);
      const sv = J.velikostPisma(velke, t => pomer(t, n.pismo), v.w * 0.8, Hv);
      const sj = jm.length ? Math.min(v.h * 0.06, (v.h * 0.3) / Math.ceil(jm.length / 2) / 1.25) : 0;
      const pol = `${ozdoba(n, v.w, v.h)}<div class="zp-stred">
        ${n.cNadpis && jeCislo ? `<div class="zp-r2" style="font-family:${esc(rodina(n.pismo2))};font-size:${mm(v.h * 0.1)};color:${esc(n.barva)}">${esc(n.cNadpis)}</div>` : ''}
        <div class="zp-jm" style="font-family:${esc(rodina(n.pismo))};font-size:${mm(sv)};color:${esc(n.barvaTextu)}">${esc(velke)}</div>
        ${jm.length ? `<div class="zp-hoste" style="font-family:${esc(rodina(n.pismo2))};font-size:${mm(sj)}">${jm.map(esc).join(' · ')}</div>` : ''}</div>`;
      return stan(L, v.h, pol, n);
    });
    return { html, L, kusu: ps.length, popis: 'čísel stolů' };
  }

  function menuKarty(p, n) {
    const v = FORMATY_MENU[n.mFormat] || FORMATY_MENU.dl;
    const L = nejlepsi(n.papir, v.w, v.h, false, 0, 0);
    const osobni = n.mOsobni;
    const kusy = osobni ? vyberHostu(p, n) : new Array(Math.max(1, Math.min(500, n.mPocet | 0))).fill(null);
    const radky = String(p.menu.text || '').split(/\r?\n/);
    const plnych = radky.length || 1;
    const sirka = v.w * 0.8;
    const nejdelsi = radky.reduce((a, r) => pomer(r, n.pismo2) > pomer(a, n.pismo2) ? r : a, ' ');
    const sMenu = Math.min(5, (v.h * 0.55) / (plnych * 1.45), J.velikostPisma(nejdelsi, t => pomer(t, n.pismo2), sirka, 5));
    const nadpis = p.menu.nadpis || 'Menu';
    const sNad = J.velikostPisma(nadpis, t => pomer(t, n.pismo), sirka, v.h * 0.09);
    const podtitul = [p.nazev, p.datum ? new Date(p.datum + 'T12:00').toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }) : ''].filter(Boolean).join(' · ');
    const html = poListech(L, kusy, g => `<div class="zp-menu${n.ramecek ? ' ram' : ''}">${ozdoba(n, v.w, v.h)}
      ${g ? `<div class="zp-jm" style="font-family:${esc(rodina(n.pismo))};font-size:${mm(Math.min(v.h * 0.06, J.velikostPisma(J.textJmenovky(g, n.jmFormat), t => pomer(t, n.pismo), sirka, v.h * 0.06)))};color:${esc(n.barvaTextu)}">${esc(J.textJmenovky(g, n.jmFormat))}</div>` : ''}
      <div class="zp-nad" style="font-family:${esc(rodina(n.pismo))};font-size:${mm(sNad)};color:${esc(n.barva)}">${esc(nadpis)}</div>
      ${podtitul ? `<div class="zp-pod" style="font-family:${esc(rodina(n.pismo2))};font-size:${mm(Math.min(4, sMenu * 0.85))}">${esc(podtitul)}</div>` : ''}
      <div class="zp-cara" style="background:${esc(n.barva)}"></div>
      <div class="zp-text" style="font-family:${esc(rodina(n.pismo2))};font-size:${mm(sMenu)}">${radky.map(r => r.trim() ? esc(r) : '<span class="zp-mezera"></span>').join('<br>')}</div>
      ${g && (g.dieta || g.alergie) ? `<div class="zp-dieta-menu" style="font-family:${esc(rodina(n.pismo2))}">${esc([g.dieta, g.alergie && 'alergie: ' + g.alergie].filter(Boolean).join(' · '))}</div>` : ''}
    </div>`);
    return { html, L, kusu: kusy.length, popis: 'menu karet' };
  }

  /* textové seznamy: stránkování po řádcích do sloupců */
  function sloupcove(papir, polozky, n, nadpis, podnadpis) {
    const pap = J.PAPIRY[papir] || J.PAPIRY.a4, W = pap.w, H = pap.h, okraj = 14;
    const lh = n.sPismo * 0.3528 * 1.5;          // pt → mm, řádkování 1,5
    const hlav = 24, vyska = H - 2 * okraj - hlav - 6;
    const naSloupec = Math.max(5, Math.floor(vyska / lh)), sl = Math.max(1, Math.min(4, n.sSloupcu | 0));
    const sloupce = [];
    let akt = [], vys = 0;
    for (const b of polozky) {      // b = {radku, html, cely}
      if (vys + b.radku > naSloupec && akt.length) { sloupce.push(akt); akt = []; vys = 0; }
      akt.push(b.html); vys += b.radku;
    }
    if (akt.length) sloupce.push(akt);
    let out = '';
    const sirkaSl = (W - 2 * okraj - (sl - 1) * 8) / sl;
    for (let i = 0; i < Math.max(1, sloupce.length); i += sl) {
      let o = `<div class="zp-seznam" style="padding:${mm(okraj)};font-size:${n.sPismo}pt;line-height:${mm(lh)}">`;
      o += `<div class="zp-sez-hlava" style="height:${mm(hlav)}"><div style="font-family:${esc(rodina(n.pismo))};font-size:11mm;color:${esc(n.barva)};line-height:1.1">${esc(nadpis)}</div>${podnadpis ? `<div class="zp-sez-pod">${esc(podnadpis)}</div>` : ''}</div>`;
      o += `<div class="zp-sloupce" style="gap:8mm">` + sloupce.slice(i, i + sl).map(s => `<div style="width:${mm(sirkaSl)}">${s.join('')}</div>`).join('') + '</div></div>';
      out += list({ W, H }, o);
    }
    return { html: out, L: { W, H }, listu: Math.max(1, Math.ceil(sloupce.length / sl)) };
  }
  function abecedniSeznam(p, n) {
    const ab = J.abecedne(p).filter(x => n.vyber !== 'rozsazeni' || x.stul);
    const hm = Object.fromEntries(p.hoste.map(h => [h.id, h]));
    const pol = []; let pis = '';
    for (const x of ab) {
      const pr = J.prijmeni(x.jmeno), c = J.castiJmena(x.jmeno);
      const zbytek = c.length > 1 ? c.slice(0, -1).join(' ') : '';
      const ps = J.pismeno(pr);
      if (ps !== pis) { pis = ps; pol.push({ radku: 1.6, html: `<div class="zp-pismeno" style="color:${esc(n.barva)};font-family:${esc(rodina(n.pismo))}">${esc(ps)}</div>` }); }
      const dite = hm[x.id] && hm[x.id].dite ? ' <span class="zp-mala">(dítě)</span>' : '';
      pol.push({ radku: 1, html: `<div class="zp-radek"><span class="zp-kdo"><b>${esc(pr)}</b> ${esc(zbytek)}${dite}</span><span class="zp-tecky"></span><span class="zp-kde">${esc(x.stul || '—')}</span></div>` });
    }
    return Object.assign(sloupcove(n.papir, pol, n, n.sNadpis || 'Zasedací pořádek', p.nazev), { kusu: ab.length, popis: 'hostů abecedně' });
  }
  function seznamPoStolech(p, n) {
    const pol = [];
    for (const x of J.poStolech(p)) {
      const d = Object.entries(x.diety).map(([k, v]) => `${v}× ${k}`).join(', ');
      pol.push({ radku: 1.7 + (d || x.deti ? 1 : 0), html: `<div class="zp-stul-hl" style="color:${esc(n.barva)}"><b>${esc(x.nazev)}</b> <span class="zp-mala">(${x.hoste.length}/${x.stul.mist})</span></div>${d || x.deti ? `<div class="zp-mala">${esc([x.deti ? x.deti + '× dítě' : '', d].filter(Boolean).join(' · '))}</div>` : ''}` });
      x.hoste.forEach(g => pol.push({ radku: 1, html: `<div class="zp-radek"><span class="zp-kdo">${esc(g.jmeno)}${g.dite ? ' 👶' : ''}</span><span class="zp-tecky"></span><span class="zp-kde zp-mala">${esc([g.dieta, g.alergie && '⚠ ' + g.alergie].filter(Boolean).join(' · '))}</span></div>` }));
    }
    const s = J.souhrnDiet(p);
    const sum = Object.entries(s.diety).map(([k, v]) => `${v}× ${k}`).concat(s.deti ? [s.deti + '× dítě'] : []).join(', ');
    return Object.assign(sloupcove(n.papir, pol, n, 'Rozsazení po stolech', [p.nazev, sum ? 'Celkem: ' + sum : ''].filter(Boolean).join(' — ')), { kusu: p.hoste.length, popis: 'hostů po stolech' });
  }
  function planekList(p, n) {
    const pap = J.PAPIRY[n.papir] || J.PAPIRY.a4, W = pap.h, H = pap.w;   // na šířku
    const barvy = barvySkupin(p);
    const leg = Object.entries(barvy).map(([s, b]) => `<span class="zp-leg"><i style="background:${b}"></i>${esc(s)}</span>`).join('');
    const o = `<div class="zp-planek-list" style="padding:${mm(10)}"><div class="zp-pl-hlava"><b style="font-family:${esc(rodina(n.pismo))};color:${esc(n.barva)}">${esc(p.nazev)}</b>${leg ? `<span class="zp-legenda">${leg}</span>` : ''}</div>
      <div class="zp-pl-svg">${planekSVG(p, { tisk: true, jmena: n.pJmena })}</div></div>`;
    return { html: list({ W, H }, o), L: { W, H }, kusu: 1, popis: 'plánek' };
  }

  const DRUHY = { jmenovky: '🏷️ Jmenovky na stůl', cisla: '🔢 Čísla stolů', menu: '🍽️ Menu karty', abecedne: '🔤 Kdo sedí kde (abecedně)', postolech: '🪑 Po stolech (pro obsluhu)', planek: '🗺️ Plánek sálu' };
  function listy(p, n) {
    const f = { jmenovky, cisla: cislaStolu, menu: menuKarty, abecedne: abecedniSeznam, postolech: seznamPoStolech, planek: planekList }[n.druh] || jmenovky;
    const r = f(p, n);
    const listu = (r.html.match(/class="zp-list /g) || []).length;
    return Object.assign(r, { listu });
  }

  window.ZasedaciTisk = { PISMA, rodina, nactiPisma, vymazMiru, planekSVG, barvySkupin, listy, DRUHY, VELIKOSTI_JM, VELIKOSTI_CISLA, FORMATY_MENU, kratkeJmeno };
})();
