/* ============================================================
   Písmolijna – ui/metriky.js
   Okno metrik a kerningu: text vykreslený písmem s kerningem,
   výběr glyfu/páru, tažení = kerning, úprava šířky a mezer,
   seznam párů, skupiny kerningu a ligatury.
   ============================================================ */
(function () {
  'use strict';
  const P = window.PSL, A = window.PSLAPP;
  const el = A.el;
  const M = A.metriky = {};

  const cv = document.getElementById('metPlatno'), ctx = cv.getContext('2d');
  const elText = document.getElementById('metText'), elVel = document.getElementById('metVelikost');
  const elKern = document.getElementById('metKern'), elLig = document.getElementById('metLig'), elSkup = document.getElementById('metSkupiny');
  const elPar = document.getElementById('metPar'), elPary = document.getElementById('metPary'), elPocet = document.getElementById('metPocet');
  const elHledat = document.getElementById('metHledat'), elSkupEd = document.getElementById('metSkupinyEd'), elLigEd = document.getElementById('metLigatury');

  let W = 0, H = 0, dpr = 1, posunX = 0;
  let rozlozeni = [];       // [{nazev, x, sirka, kern}] x = počátek glyfu v jednotkách
  let vyb = -1;             // index vybraného glyfu v textu
  let tah = null;
  if (A.nastaveni.metText) elText.value = A.nastaveni.metText;
  if (A.nastaveni.metVel) elVel.value = A.nastaveni.metVel;

  const cislo = v => { const x = parseFloat(String(v).replace(',', '.')); return isFinite(x) ? x : null; };

  /* Který záznam kerningu dává hodnotu páru (glyf–glyf má přednost). */
  function zdroj(f, l, r) {
    const K = f.kerning;
    if (K[l] && K[l][r] != null) return [l, r];
    const sl = P.skupinyGlyfu(f, l), sr = P.skupinyGlyfu(f, r);
    for (const a of sl) if (K[a] && K[a][r] != null) return [a, r];
    for (const b of sr) if (K[l] && K[l][b] != null) return [l, b];
    for (const a of sl) for (const b of sr) if (K[a] && K[a][b] != null) return [a, b];
    return null;
  }
  /* Kam zapsat změnu kerningu páru. */
  function cilZapisu(f, l, r) {
    const z = zdroj(f, l, r);
    if (elSkup.checked) {
      if (z) return z;
      const sl = P.skupinyGlyfu(f, l), sr = P.skupinyGlyfu(f, r);
      return [sl[0] || l, sr[0] || r];
    }
    return [l, r];
  }
  M.nastavKern = function (l, r, hodnota, klic) {
    const f = A.font;
    const [a, b] = cilZapisu(f, l, r);
    A.zmen('Kerning ' + a + ' ' + b, { kerning: true }, () => {
      const K = A.font.kerning;
      const v = Math.round(hodnota);
      if (!K[a]) K[a] = {};
      if (v === 0 && !(a !== l || b !== r)) { delete K[a][b]; if (!Object.keys(K[a]).length) delete K[a]; }
      else K[a][b] = v;
    }, klic);
  };

  /* ---------- rozložení a vykreslení ---------- */
  function sestav() {
    const f = A.font;
    const jmena = P.textNaGlyfy(f, elText.value, elLig.checked).filter(n => n !== '\n');
    rozlozeni = [];
    let x = 0;
    jmena.forEach((n, i) => {
      const gl = f.glyfy[n] || f.glyfy['.notdef'];
      const kern = i > 0 && elKern.checked ? P.kernPar(f, jmena[i - 1], n) : 0;
      x += kern;
      rozlozeni.push({ nazev: gl.nazev, x, sirka: gl.sirka, kern });
      x += gl.sirka;
    });
    if (vyb >= rozlozeni.length) vyb = rozlozeni.length - 1;
    return x;
  }
  function meritko() { return (+elVel.value) / A.font.info.upm; }
  function velikost() {
    const r = cv.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1; W = r.width; H = r.height;
    const w = Math.max(1, Math.round(W * dpr)), h = Math.max(1, Math.round(H * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  }
  let naplanovano = false;
  M.prekresli = function () {
    if (naplanovano) return;
    naplanovano = true;
    requestAnimationFrame(() => { naplanovano = false; kresli(); });
  };
  function kresli() {
    if (A.pohled !== 'metriky' || !A.font) return;
    velikost();
    const f = A.font, B = A.barvy(), k = meritko();
    const celkem = sestav();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = B.pozadi; ctx.fillRect(0, 0, W, H);
    const asc = Math.max(f.info.ascender, f.info.vyskaVerzalek), desc = f.info.descender;
    const zakl = Math.round(Math.max(20 + asc * k, (H - (asc - desc) * k) / 2 + asc * k));
    const x0 = Math.max(20, (W - celkem * k) / 2) + posunX;
    M._geo = { k, zakl, x0 };
    // metriky
    ctx.strokeStyle = B.metrika; ctx.lineWidth = 1;
    for (const y of [0, f.info.xVyska, f.info.vyskaVerzalek, desc]) {
      ctx.setLineDash(y ? [4, 4] : []);
      ctx.beginPath(); ctx.moveTo(0, Math.round(zakl - y * k) + .5); ctx.lineTo(W, Math.round(zakl - y * k) + .5); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    rozlozeni.forEach((r, i) => {
      const gl = f.glyfy[r.nazev], gx = x0 + r.x * k;
      if (i === vyb) {
        ctx.fillStyle = B.svetle ? 'rgba(40,98,187,.10)' : 'rgba(106,166,253,.12)';
        ctx.fillRect(gx, zakl - asc * k - 10, r.sirka * k, (asc - desc) * k + 20);
      }
      // hranice šířky
      ctx.strokeStyle = B.okraj; ctx.beginPath(); ctx.moveTo(Math.round(gx) + .5, zakl - asc * k - 10); ctx.lineTo(Math.round(gx) + .5, zakl - desc * k + 10); ctx.stroke();
      ctx.fillStyle = B.plna; ctx.beginPath();
      P.kresliObrysy(ctx, P.plneObrysy(f, gl).filter(o => !o.otevreny), [k, 0, 0, -k, gx, zakl]);
      ctx.fill('nonzero');
      // popisky
      const ob = P.obalkaGlyfu(f, gl);
      const py = zakl - desc * k + 26;
      if (r.sirka * k > 34) {
        ctx.fillStyle = B.muted;
        ctx.fillText(r.nazev.length > 10 ? r.nazev.slice(0, 9) + '…' : r.nazev, gx + r.sirka * k / 2, py);
        if (ob) {
          ctx.fillStyle = B.slaby;
          ctx.textAlign = 'left'; ctx.fillText(Math.round(ob.x0), gx + 2, py + 15);
          ctx.textAlign = 'right'; ctx.fillText(Math.round(r.sirka - ob.x1), gx + r.sirka * k - 2, py + 15);
          ctx.textAlign = 'center';
        }
      }
      if (r.kern) {
        ctx.fillStyle = r.kern < 0 ? B.nebezpeci : B.ok;
        ctx.fillText(String(r.kern), gx, zakl - asc * k - 16);
        ctx.fillRect(gx - Math.max(0, -r.kern * k), zakl - asc * k - 12, Math.abs(r.kern * k), 3);
      }
    });
    if (!rozlozeni.length) {
      ctx.fillStyle = B.muted; ctx.font = '14px sans-serif';
      ctx.fillText('Napište text do pole nahoře.', W / 2, H / 2);
    }
  }

  /* ---------- myš ---------- */
  function indexNa(sx) {
    const { k, x0 } = M._geo || {};
    if (!k) return -1;
    for (let i = 0; i < rozlozeni.length; i++) {
      const r = rozlozeni[i], a = x0 + r.x * k, b = a + r.sirka * k;
      if (sx >= a && sx < b) return i;
    }
    return -1;
  }
  cv.addEventListener('pointerdown', e => {
    cv.focus({ preventScroll: true });
    try { cv.setPointerCapture(e.pointerId); } catch (er) { /* syntetická událost */ }
    const r = cv.getBoundingClientRect(), sx = e.clientX - r.left;
    const i = indexNa(sx);
    if (i < 0) { tah = { druh: 'posun', sx, start: posunX }; return; }
    vyb = i; obnovPar(); M.prekresli();
    const { k, x0 } = M._geo;
    const prava = x0 + (rozlozeni[i].x + rozlozeni[i].sirka) * k;
    if (Math.abs(sx - prava) < 6) { tah = { druh: 'sirka', sx, i, sirka: rozlozeni[i].sirka, klic: 'msirka' + Date.now() }; return; }
    if (i > 0) tah = { druh: 'kern', sx, i, kern: P.kernPar(A.font, rozlozeni[i - 1].nazev, rozlozeni[i].nazev), klic: 'mkern' + Date.now() };
  });
  cv.addEventListener('pointermove', e => {
    const r = cv.getBoundingClientRect(), sx = e.clientX - r.left;
    if (!tah) {
      const i = indexNa(sx);
      let c = 'default';
      if (i >= 0) {
        const { k, x0 } = M._geo;
        c = Math.abs(sx - (x0 + (rozlozeni[i].x + rozlozeni[i].sirka) * k)) < 6 ? 'ew-resize' : (i > 0 ? 'grab' : 'pointer');
      }
      cv.style.cursor = c;
      return;
    }
    const k = meritko(), d = (sx - tah.sx) / k;
    if (tah.druh === 'posun') { posunX = tah.start + sx - tah.sx; M.prekresli(); return; }
    if (tah.druh === 'kern') {
      const v = Math.round((tah.kern + d) / (e.shiftKey ? 1 : 5)) * (e.shiftKey ? 1 : 5);
      M.nastavKern(rozlozeni[tah.i - 1].nazev, rozlozeni[tah.i].nazev, v, tah.klic);
      return;
    }
    if (tah.druh === 'sirka') {
      const n = rozlozeni[tah.i].nazev, s = Math.max(0, Math.round(tah.sirka + d));
      A.zmen('Šířka ' + n, { glyfy: [n] }, () => { A.font.glyfy[n].sirka = s; }, tah.klic);
    }
  });
  cv.addEventListener('pointerup', () => { tah = null; });
  cv.addEventListener('pointercancel', () => { tah = null; });
  cv.addEventListener('dblclick', e => {
    const r = cv.getBoundingClientRect(), i = indexNa(e.clientX - r.left);
    if (i >= 0) A.otevriGlyf(rozlozeni[i].nazev);
  });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.ctrlKey) { elVel.value = Math.max(+elVel.min, Math.min(+elVel.max, +elVel.value * Math.exp(-e.deltaY * 0.002))); A.nastaveni.metVel = +elVel.value; M.prekresli(); return; }
    posunX -= (e.deltaX || e.deltaY); M.prekresli();
  }, { passive: false });
  cv.addEventListener('keydown', e => {
    if (vyb < 0) return;
    if ((e.ctrlKey || e.metaKey) && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault(); vyb = Math.max(0, Math.min(rozlozeni.length - 1, vyb + (e.key === 'ArrowLeft' ? -1 : 1))); obnovPar(); M.prekresli(); return;
    }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && vyb > 0) {
      e.preventDefault();
      const krok = e.shiftKey ? 1 : 10, d = e.key === 'ArrowLeft' ? -krok : krok;
      const l = rozlozeni[vyb - 1].nazev, r = rozlozeni[vyb].nazev;
      M.nastavKern(l, r, P.kernPar(A.font, l, r) + d, 'mklav' + l + r);
    }
    if (e.key === 'Enter') A.otevriGlyf(rozlozeni[vyb].nazev);
  });

  /* ---------- panel páru ---------- */
  function obnovPar() {
    elPar.innerHTML = '';
    const f = A.font;
    if (vyb < 0 || !rozlozeni[vyb]) { elPar.append(el('p', { class: 'poznamka', text: 'Klikněte na písmeno v textu. Tažením písmene se mění kerning s levým sousedem, tažením pravé hrany šířka. Šipky ←/→ mění kerning o 10 (Shift o 1), Ctrl+šipky přecházejí mezi písmeny.' })); return; }
    const n = rozlozeni[vyb].nazev, gl = f.glyfy[n], ob = P.obalkaGlyfu(f, gl);
    const pole = (popis, hodnota, fn, tip) => {
      const i = el('input', { type: 'number', value: Math.round(hodnota), 'aria-label': popis });
      i.addEventListener('change', () => { const x = cislo(i.value); if (x != null) fn(x); });
      return el('div', { class: 'radek', title: tip || '' }, [el('label', { text: popis }), i]);
    };
    elPar.append(el('h3', { text: 'Glyf ' + n, style: 'font-size:.9rem;margin-bottom:6px' }));
    elPar.append(pole('Šířka', gl.sirka, x => A.zmen('Šířka', { glyfy: [n] }, () => { A.font.glyfy[n].sirka = Math.max(0, Math.round(x)); })));
    elPar.append(pole('Levá mezera', ob ? ob.x0 : 0, x => A.zmen('LSB', { glyfy: [n] }, () => P.nastavLsb(A.font, A.font.glyfy[n], x))));
    elPar.append(pole('Pravá mezera', ob ? gl.sirka - ob.x1 : gl.sirka, x => A.zmen('RSB', { glyfy: [n] }, () => P.nastavRsb(A.font, A.font.glyfy[n], x))));
    if (vyb > 0) {
      const l = rozlozeni[vyb - 1].nazev;
      const v = P.kernPar(f, l, n), z = zdroj(f, l, n);
      elPar.append(el('h3', { text: 'Pár ' + l + ' | ' + n, style: 'font-size:.9rem;margin:10px 0 6px' }));
      elPar.append(pole('Kerning', v, x => M.nastavKern(l, n, x)));
      elPar.append(el('p', { class: 'poznamka', text: z ? (z[0] === l && z[1] === n ? 'Vlastní pár glyfů.' : 'Hodnota ze skupin: ' + z[0] + ' | ' + z[1] + '.') : 'Pár zatím nemá kerning.' }));
      const tl = (t, fn) => el('button', { type: 'button', class: 'tl', text: t, onclick: fn });
      elPar.append(el('div', { class: 'tlacitka' }, [
        tl('−10', () => M.nastavKern(l, n, v - 10)), tl('−1', () => M.nastavKern(l, n, v - 1)),
        tl('+1', () => M.nastavKern(l, n, v + 1)), tl('+10', () => M.nastavKern(l, n, v + 10)),
        tl('Smazat pár', () => { const zz = zdroj(f, l, n); if (zz) A.zmen('Smazat kerning', { kerning: true }, () => { delete A.font.kerning[zz[0]][zz[1]]; if (!Object.keys(A.font.kerning[zz[0]]).length) delete A.font.kerning[zz[0]]; }); })
      ]));
    }
  }

  /* ---------- tabulka párů ---------- */
  function obnovTabulku() {
    const f = A.font, q = elHledat.value.trim();
    elPary.innerHTML = '';
    const pary = [];
    for (const l in f.kerning) for (const r in f.kerning[l]) pary.push([l, r, f.kerning[l][r]]);
    elPocet.textContent = '(' + pary.length + ')';
    const filtr = q ? pary.filter(([l, r]) => l === q || r === q || (l + ' ' + r).toLowerCase().includes(q.toLowerCase())) : pary;
    const LIMIT = 400;
    for (const [l, r, v] of filtr.slice(0, LIMIT)) {
      const i = el('input', { type: 'number', value: v, 'aria-label': 'hodnota ' + l + ' ' + r });
      i.addEventListener('change', () => { const x = cislo(i.value); if (x != null) A.zmen('Kerning', { kerning: true }, () => { A.font.kerning[l][r] = Math.round(x); }); });
      elPary.append(el('div', { class: 'par' }, [
        el('span', { class: 'jmeno', text: l + ' | ' + r, title: 'Zobrazit v textu', onclick: () => ukazPar(l, r) }), i,
        el('button', { type: 'button', text: '✕', title: 'Smazat pár', onclick: () => A.zmen('Smazat kerning', { kerning: true }, () => { delete A.font.kerning[l][r]; if (!Object.keys(A.font.kerning[l]).length) delete A.font.kerning[l]; }) })
      ]));
    }
    if (filtr.length > LIMIT) elPary.append(el('p', { class: 'poznamka', text: '… a dalších ' + (filtr.length - LIMIT) + ' párů – zužte filtr.' }));
    if (!pary.length) elPary.append(el('p', { class: 'poznamka', text: 'Font zatím nemá kerning. Upravte páry v textu nahoře nebo použijte Metriky → Automatický kerning.' }));
  }
  function ukazPar(l, r) {
    const f = A.font;
    const zn = n => {
      if (n.charAt(0) === '@') n = (f.skupiny[n] || [])[0] || '';
      const u = f.glyfy[n] && (f.glyfy[n].uni || [])[0];
      return u != null ? String.fromCodePoint(u) : '/' + n + ' ';
    };
    elText.value = zn(l) + zn(r) + ' ' + elText.value;
    vyb = 1; posunX = 0; obnovVse();
  }

  /* ---------- skupiny ---------- */
  function obnovSkupiny() {
    const f = A.font;
    elSkupEd.innerHTML = '';
    for (const s of Object.keys(f.skupiny)) {
      const nazev = el('input', { class: 'nazev', type: 'text', value: s, 'aria-label': 'název skupiny' });
      const ta = el('textarea', { 'aria-label': 'glyfy skupiny' }); ta.value = f.skupiny[s].join(' ');
      nazev.addEventListener('change', () => {
        let nn = nazev.value.trim(); if (!nn.startsWith('@')) nn = '@' + nn;
        if (nn === s || f.skupiny[nn]) { nazev.value = s; return; }
        A.zmen('Přejmenovat skupinu', { skupiny: true, kerning: true }, () => {
          const F = A.font; F.skupiny[nn] = F.skupiny[s]; delete F.skupiny[s];
          if (F.kerning[s]) { F.kerning[nn] = F.kerning[s]; delete F.kerning[s]; }
          for (const l in F.kerning) if (s in F.kerning[l]) { F.kerning[l][nn] = F.kerning[l][s]; delete F.kerning[l][s]; }
        });
      });
      ta.addEventListener('change', () => {
        const jm = ta.value.split(/\s+/).filter(Boolean).map(t => f.glyfy[t] ? t : (Array.from(t).length === 1 ? P.cmap(f).get(t.codePointAt(0)) : null)).filter(Boolean);
        A.zmen('Skupina ' + s, { skupiny: true }, () => { A.font.skupiny[s] = Array.from(new Set(jm)); });
      });
      elSkupEd.append(el('div', { class: 'skupina-ed' }, [nazev, ta, el('button', { type: 'button', class: 'tl ik', text: '✕', title: 'Smazat skupinu (i její kerning)', onclick: () => A.zmen('Smazat skupinu', { skupiny: true, kerning: true }, () => {
        const F = A.font; delete F.skupiny[s]; delete F.kerning[s]; for (const l in F.kerning) { delete F.kerning[l][s]; if (!Object.keys(F.kerning[l]).length) delete F.kerning[l]; }
      }) })]));
    }
    elSkupEd.append(el('div', { class: 'tlacitka' }, [
      el('button', { type: 'button', class: 'tl', text: '＋ Nová skupina', onclick: async () => {
        let n = await Dialog.zeptej('Název skupiny (např. @O_vlevo):', '@skupina'); if (!n) return;
        n = n.trim(); if (!n.startsWith('@')) n = '@' + n;
        if (A.font.skupiny[n]) { A.zprava('Skupina už existuje.', true); return; }
        A.zmen('Nová skupina', { skupiny: true }, () => { A.font.skupiny[n] = []; });
      } }),
      el('button', { type: 'button', class: 'tl', text: 'Navrhnout skupiny', title: 'Typické skupiny latinky (O C G Q, H I N…, a s diakritikou)', onclick: navrhniSkupiny })
    ]));
    elSkupEd.append(el('p', { class: 'poznamka', text: 'Glyfy pište oddělené mezerou (názvy nebo znaky). Kerning nastavený skupině platí pro všechny její členy; vlastní pár glyfů má přednost.' }));
  }
  function navrhniSkupiny() {
    const f = A.font, mapa = P.cmap(f);
    const z = s => Array.from(s).map(c => mapa.get(c.codePointAt(0))).filter(Boolean);
    const navrh = {
      '@A': z('AÁÀÂÄÃÅĄ'), '@O': z('OÓÒÔÖÕŐØCĆČÇGQ'), '@H': z('HIÍNŇMBDĎEÉĚFKLĹĽPRŘ'), '@T': z('TŤ'), '@V': z('VW'), '@Y': z('YÝŸ'),
      '@U': z('UÚŮÜŰ'), '@a': z('aáàâäãåą'), '@o': z('oóòôöõőøeéěëęcćčç'), '@n': z('nňmrřhu'), '@i': z('iíìîï'), '@s': z('sśšş'), '@z': z('zźžż'), '@y': z('yýÿvw')
    };
    let pridano = 0;
    A.zmen('Navrhnout skupiny', { skupiny: true }, () => {
      for (const s in navrh) if (navrh[s].length > 1 && !A.font.skupiny[s]) { A.font.skupiny[s] = navrh[s]; pridano++; }
    });
    A.zprava(pridano ? 'Přidáno skupin: ' + pridano + '.' : 'Žádná nová skupina (chybí glyfy nebo už existují).');
  }

  /* ---------- ligatury ---------- */
  function obnovLigatury() {
    const f = A.font;
    elLigEd.innerHTML = '';
    f.ligatury.forEach((l, i) => {
      elLigEd.append(el('div', { class: 'skupina-ed' }, [
        el('span', { text: l.z.join(' + ') + '  →  ' + l.na + (f.glyfy[l.na] ? '' : ' (glyf chybí!)'), style: 'flex:1' }),
        el('button', { type: 'button', class: 'tl ik', text: '✒️', title: 'Otevřít glyf ligatury', onclick: () => { if (f.glyfy[l.na]) A.otevriGlyf(l.na); } }),
        el('button', { type: 'button', class: 'tl ik', text: '✕', title: 'Smazat ligaturu', onclick: () => A.zmen('Smazat ligaturu', { ligatury: true }, () => { A.font.ligatury.splice(i, 1); }) })
      ]));
    });
    const vstup = el('input', { type: 'text', placeholder: 'znaky ligatury, např. fi, ffi, ch', 'aria-label': 'Znaky ligatury' });
    elLigEd.append(el('div', { class: 'skupina-ed' }, [vstup, el('button', { type: 'button', class: 'tl', text: '＋ Ligatura', onclick: () => pridejLigaturu(vstup.value) })]));
    elLigEd.append(el('p', { class: 'poznamka', text: 'Glyf ligatury (např. f_i) se vytvoří složením z komponent, pokud ještě neexistuje – pak ho v editoru upravte (rozložte komponenty a spojte tahy).' }));
  }
  function pridejLigaturu(text) {
    const f = A.font;
    const z = P.textNaGlyfy(f, text.trim(), false).filter(n => n !== '\n');
    if (z.length < 2 || z.includes('.notdef')) { A.zprava('Ligatura potřebuje aspoň dva znaky, které ve fontu jsou.', true); return; }
    const na = z.join('_');
    if (f.ligatury.some(l => l.z.join(' ') === z.join(' '))) { A.zprava('Tahle ligatura už existuje.', true); return; }
    A.zmen('Ligatura ' + na, { ligatury: true, glyfy: [] }, () => {
      const F = A.font;
      if (!F.glyfy[na]) {
        const g = P.novyGlyf(na, null, 0);
        let x = 0;
        z.forEach((n, i) => {
          if (i) x += P.kernPar(F, z[i - 1], n);
          g.komponenty.push({ glyf: n, m: [1, 0, 0, 1, x, 0] });
          x += F.glyfy[n].sirka;
        });
        g.sirka = x;
        P.pridejGlyf(F, g);
      }
      F.ligatury.push({ z, na });
    });
  }

  function obnovVse() {
    A.nastaveni.metText = elText.value; A.nastaveni.metVel = +elVel.value; A.ulozNastaveni();
    M.prekresli(); obnovPar(); obnovTabulku(); obnovSkupiny(); obnovLigatury();
  }
  M.obnov = obnovVse;
  M.zobrazText = function (t) { elText.value = t; vyb = -1; posunX = 0; obnovVse(); };

  elText.addEventListener('input', () => { vyb = -1; posunX = 0; A.nastaveni.metText = elText.value; A.ulozNastaveni(); M.prekresli(); obnovPar(); });
  elVel.addEventListener('input', () => { A.nastaveni.metVel = +elVel.value; A.ulozNastaveni(); M.prekresli(); });
  for (const c of [elKern, elLig]) c.addEventListener('change', () => M.prekresli());
  elHledat.addEventListener('input', obnovTabulku);

  let zastarale = true;
  A.na('zmena', co => {
    if (A.pohled !== 'metriky') { zastarale = true; return; }
    M.prekresli(); obnovPar();
    if (!co || co.vse || (co.rozsah && (co.rozsah.kerning || co.rozsah.skupiny || co.rozsah.ligatury || co.rozsah.cely))) {
      obnovTabulku(); obnovSkupiny(); obnovLigatury();
    }
  });
  A.na('pohled', p => { if (p === 'metriky') { if (zastarale) { zastarale = false; obnovVse(); } else M.prekresli(); } });
  A.na('font', () => { vyb = -1; posunX = 0; zastarale = true; });
  A.na('tema', () => M.prekresli());
  new ResizeObserver(() => { if (A.pohled === 'metriky') M.prekresli(); }).observe(cv);
})();
