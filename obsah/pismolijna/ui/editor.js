/* ============================================================
   Písmolijna – ui/editor.js
   Editor glyfu na plátně: zobrazení (lupa, posun, metriky,
   kontext, pozadí), výběr a tažení bodů, úchytů, segmentů,
   komponent, kotev a šířky; nástroje pero, obdélník, elipsa,
   nůž, měřítko, kotva, tužka a štětec.
   Souřadnice: jednotky em, y nahoru. Výběr bodu = „o,i“.
   ============================================================ */
(function () {
  'use strict';
  const P = window.PSL, A = window.PSLAPP;
  const E = A.editor = {
    nastroj: 'vyber',
    vyber: new Set(),          // 'o,i' body, 'k,i' komponenty, 'a,i' kotvy
    plnaVypln: false,
    magnet: A.nastaveni.magnet !== false,
    mrizka: A.nastaveni.mrizka !== false,
    stetec: A.nastaveni.stetec || 60
  };

  const cv = document.getElementById('platno');
  const ctx = cv.getContext('2d');
  const elSour = document.getElementById('edSouradnice');
  const elNazev = document.getElementById('edNazev');
  const elNapoveda = document.getElementById('napovedaNastroje');
  const elKL = document.getElementById('edKontextL'), elKP = document.getElementById('edKontextP');

  let k = 0.5, ox = 100, oy = 500;   // měřítko px/jednotku, poloha počátku na plátně (CSS px)
  let W = 0, H = 0, dpr = 1;
  let tah = null;                    // probíhající tažení
  let pero = null;                   // {o: index obrysu, ven: {x,y}|null, vstup: {x,y}|null}
  let mys = null;                    // poslední poloha myši v jednotkách
  let mezernik = false;
  let citacTahu = 0;
  const obrazky = new Map();         // dataURL → Image (pozadí)

  const g = () => A.font && A.aktualni ? A.font.glyfy[A.aktualni] : null;
  const naObr = (x, y) => ({ x: ox + x * k, y: oy - y * k });
  const zObr = (sx, sy) => ({ x: (sx - ox) / k, y: (oy - sy) / k });

  /* ---------- nástroje ---------- */
  const IKONY = {
    vyber: '<svg viewBox="0 0 24 24"><path d="M5 3l14 9-6 1.5L10 20z"/></svg>',
    pero: '<svg viewBox="0 0 24 24"><path d="M12 3l5 9-5 9-5-9z"/><circle cx="12" cy="12" r="1.6"/><path d="M12 3v7"/></svg>',
    obdelnik: '<svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" rx="1"/></svg>',
    elipsa: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="8.5" ry="6.5"/></svg>',
    tuzka: '<svg viewBox="0 0 24 24"><path d="M4 20c3-1 4-5 7-7s6 0 9-6"/></svg>',
    stetec: '<svg viewBox="0 0 24 24"><path d="M3 19c4 1 6-2 6-4s2-3 3-3l8-8"/><path d="M9 15c2 0 3 1 3 3" /></svg>',
    nuz: '<svg viewBox="0 0 24 24"><path d="M4 20L20 4"/><path d="M14 4l6 0 0 6"/></svg>',
    meritko: '<svg viewBox="0 0 24 24"><path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/></svg>',
    kotva: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><path d="M12 7v13M5 13c0 4 3 7 7 7s7-3 7-7M9 10h6"/></svg>',
    ruka: '<svg viewBox="0 0 24 24"><path d="M8 12V6a1.5 1.5 0 013 0v5V4.5a1.5 1.5 0 013 0V11V6a1.5 1.5 0 013 0v8c0 4-3 7-6.5 7S6 19 5 17l-2-4a1.5 1.5 0 012.5-1.5L8 14"/></svg>'
  };
  const NASTROJE = [
    ['vyber', 'Výběr a posun bodů (V)', 'v'],
    ['pero', 'Pero – klik = roh, tažení = hladký bod; klik na první bod uzavře (P)', 'p'],
    ['obdelnik', 'Obdélník – Shift čtverec, Alt od středu (R)', 'r'],
    ['elipsa', 'Elipsa – Shift kruh, Alt od středu (E)', 'e'],
    ['tuzka', 'Tužka – kreslení od ruky, proloží se křivkami (N)', 'n'],
    ['stetec', 'Štětec – tah zadané šířky (B)', 'b'],
    '-',
    ['nuz', 'Nůž – rozřízne obrysy podél čáry (K)', 'k'],
    ['meritko', 'Měřítko – vzdálenost, úhel a tloušťky tahů (M)', 'm'],
    ['kotva', 'Kotva pro diakritiku (A)', 'a'],
    ['ruka', 'Posun pohledu (H, nebo mezerník + tažení)', 'h']
  ];
  const NAPOVEDY = {
    vyber: 'Klik = bod · Shift = přidat · tažení prázdnem = výběr obdélníkem · tažení křivky = tvarování · dvojklik = celý obrys · Alt při tažení úchytu = zlomit hladký bod · šipky posun (Shift ×10)',
    pero: 'Klik = rohový bod · tažení = hladký bod s úchyty · klik na první bod = uzavřít · klik na křivku = vložit bod · Esc/Enter = ukončit',
    obdelnik: 'Táhněte · Shift = čtverec · Alt = od středu',
    elipsa: 'Táhněte · Shift = kruh · Alt = od středu',
    tuzka: 'Kreslete od ruky – po puštění se tah proloží křivkami; konec u začátku obrys uzavře',
    stetec: 'Kreslete tah – vznikne plocha zadané šířky (nastavení v panelu vpravo)',
    nuz: 'Táhněte čáru přes obrysy – rozříznou se; obrys proťatý dvakrát se uzavře na dva kusy',
    meritko: 'Táhněte – ukáže délku, úhel a vzdálenosti mezi průsečíky s obrysy (tloušťky tahů)',
    kotva: 'Klikněte – vloží kotvu (top, bottom, _top…) pro skládání diakritiky; tažením ji posunete nástrojem Výběr',
    ruka: 'Táhněte pro posun · kolečko = lupa'
  };
  const elNastroje = document.getElementById('nastroje');
  for (const n of NASTROJE) {
    if (n === '-') { elNastroje.append(document.createElement('hr')); continue; }
    const b = A.el('button', { type: 'button', class: ['nuz', 'meritko', 'kotva'].includes(n[0]) ? 'pokrocile' : null, title: n[1], 'aria-label': n[1], 'data-nastroj': n[0], 'aria-pressed': String(n[0] === E.nastroj), onclick: () => E.zvolNastroj(n[0]) });
    b.innerHTML = IKONY[n[0]];
    elNastroje.append(b);
  }
  E.zvolNastroj = function (n) {
    if (pero && n !== 'pero') ukonciPero();
    E.nastroj = n;
    for (const b of elNastroje.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.nastroj === n));
    elNapoveda.textContent = NAPOVEDY[n] || '';
    kurzor();
    E.prekresli();
  };

  /* ---------- otevření glyfu ---------- */
  A.otevriGlyf = function (nazev) {
    if (!A.font.glyfy[nazev]) return;
    if (pero) ukonciPero();
    const zmenaGlyfu = A.aktualni !== nazev;
    A.aktualni = nazev;
    if (zmenaGlyfu) E.vyber.clear();
    A.prepniPohled('glyf');
    velikost();
    if (zmenaGlyfu || !E._zobrazeno) E.zobrazVse();
    E._zobrazeno = true;
    A.vyhlas('glyfOtevren', nazev);
    E.prekresli();
    cv.focus({ preventScroll: true });
  };
  E.dalsiGlyf = function (smer) {
    const f = A.font, i = f.poradi.indexOf(A.aktualni);
    const n = f.poradi[(i + smer + f.poradi.length) % f.poradi.length];
    if (n) A.otevriGlyf(n);
  };
  document.getElementById('tlPredGlyf').onclick = () => E.dalsiGlyf(-1);
  document.getElementById('tlDalsiGlyf').onclick = () => E.dalsiGlyf(1);
  document.getElementById('tlZoomVse').onclick = () => { E.zobrazVse(); E.prekresli(); };

  /* ---------- zobrazení ---------- */
  function velikost() {
    const r = cv.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    W = r.width; H = r.height;
    const w = Math.max(1, Math.round(W * dpr)), h = Math.max(1, Math.round(H * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  }
  E.zobrazVse = function () {
    velikost();
    const f = A.font, gl = g();
    if (!gl || !W || !H) return;
    const ob = P.obalkaGlyfu(f, gl);
    const y0 = Math.min(f.info.descender, ob ? ob.y0 : 0), y1 = Math.max(f.info.ascender, f.info.vyskaVerzalek, ob ? ob.y1 : 0);
    const x0 = Math.min(0, ob ? ob.x0 : 0), x1 = Math.max(gl.sirka, ob ? ob.x1 : 0, f.info.upm * 0.3);
    k = Math.min((H - 60) / (y1 - y0), (W - 80) / (x1 - x0));
    if (!(k > 0)) k = 0.5;
    ox = (W - (x1 - x0) * k) / 2 - x0 * k;
    oy = 30 + y1 * k;
  };
  function lupa(fak, sx, sy) {
    const nk = Math.max(0.01, Math.min(60, k * fak));
    const u = zObr(sx, sy);
    k = nk; ox = sx - u.x * k; oy = sy + u.y * k;
    E.prekresli();
  }
  E.lupa = f => lupa(f, W / 2, H / 2);

  let naplanovano = false;
  E.prekresli = function () {
    if (naplanovano) return;
    naplanovano = true;
    requestAnimationFrame(() => { naplanovano = false; kresli(); });
  };

  function kresli() {
    if (A.pohled !== 'glyf') return;
    velikost();
    const B = A.barvy();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = B.pozadi; ctx.fillRect(0, 0, W, H);
    const gl = g(), f = A.font;
    if (!gl) {
      ctx.fillStyle = B.muted; ctx.font = '15px ' + getComputedStyle(document.body).fontFamily; ctx.textAlign = 'center';
      ctx.fillText('Vyberte glyf v mřížce znaků (dvojklik) nebo stiskněte Page Down.', W / 2, H / 2);
      elNazev.textContent = '';
      return;
    }
    elNazev.textContent = gl.nazev + ((gl.uni || []).length ? '  ' + gl.uni.map(u => 'U+' + u.toString(16).toUpperCase().padStart(4, '0')).join(' ') : '');
    const T = [k, 0, 0, -k, ox, oy];
    if (E.mrizka) kresliMrizku(B);
    kresliMetriky(B, gl, f);
    kresliKontext(B, gl, f, T);
    kresliPozadi(B, gl, f, T);
    // komponenty
    (gl.komponenty || []).forEach((kp, i) => {
      const z = f.glyfy[kp.glyf]; if (!z) return;
      ctx.beginPath();
      P.kresliObrysy(ctx, P.plneObrysy(f, z, kp.m), T);
      ctx.fillStyle = E.vyber.has('k,' + i) ? B.akcent : B.komponenta;
      ctx.globalAlpha = E.plnaVypln ? 1 : 0.55; ctx.fill('nonzero'); ctx.globalAlpha = 1;
      const ob = P.obalkaObrysu(P.plneObrysy(f, z, kp.m));
      if (ob && !E.plnaVypln) {
        const a = naObr(ob.x0, ob.y1);
        ctx.fillStyle = B.komponenta; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText('⧉ ' + kp.glyf, a.x, a.y - 4);
      }
    });
    // obrysy (se zrcadlenými kopiemi živé symetrie)
    const sZrcadlem = P.obrysySeZrcadlem(f, gl);
    ctx.beginPath(); P.kresliObrysy(ctx, sZrcadlem.filter(o => !o.otevreny), T);
    ctx.fillStyle = E.plnaVypln ? B.plna : B.vypln; ctx.fill('nonzero');
    if (!E.plnaVypln) {
      if (sZrcadlem !== gl.obrysy) kresliZrcadlo(B, gl, f, sZrcadlem.slice(gl.obrysy.length), T);
      ctx.beginPath(); P.kresliObrysy(ctx, gl.obrysy, T);
      ctx.strokeStyle = B.obrys; ctx.lineWidth = 1.2; ctx.stroke();
      kresliBody(B, gl);
    }
    kresliKotvy(B, gl);
    kresliPrekryv(B, gl, f);
  }

  /* Kopie živé symetrie čárkovaně a osy zrcadlení. */
  function kresliZrcadlo(B, gl, f, kopie, T) {
    ctx.beginPath(); P.kresliObrysy(ctx, kopie, T);
    ctx.strokeStyle = B.obrys; ctx.lineWidth = 1; ctx.setLineDash([5, 4]); ctx.stroke();
    const z = gl.zrcadlo;
    ctx.strokeStyle = B.varovani; ctx.lineWidth = 1.2; ctx.setLineDash([10, 4, 2, 4]);
    ctx.beginPath();
    if (z.svisle) { const s = Math.round(ox + (z.x != null ? z.x : gl.sirka / 2) * k) + .5; ctx.moveTo(s, 0); ctx.lineTo(s, H); }
    if (z.vodorovne) { const s = Math.round(oy - (z.y != null ? z.y : f.info.vyskaVerzalek / 2) * k) + .5; ctx.moveTo(0, s); ctx.lineTo(W, s); }
    ctx.stroke(); ctx.setLineDash([]);
  }

  function kresliMrizku(B) {
    let krok = 10;
    while (krok * k < 12) krok *= krok % 10 === 0 && String(krok)[0] === '1' ? 5 : 2;
    if (krok * k < 6) return;
    const a = zObr(0, H), b = zObr(W, 0);
    ctx.lineWidth = 1; ctx.strokeStyle = B.okraj; ctx.globalAlpha = 0.35;
    ctx.beginPath();
    for (let x = Math.ceil(a.x / krok) * krok; x <= b.x; x += krok) { const s = Math.round(ox + x * k) + .5; ctx.moveTo(s, 0); ctx.lineTo(s, H); }
    for (let y = Math.ceil(a.y / krok) * krok; y <= b.y; y += krok) { const s = Math.round(oy - y * k) + .5; ctx.moveTo(0, s); ctx.lineTo(W, s); }
    ctx.stroke(); ctx.globalAlpha = 1;
  }

  function kresliMetriky(B, gl, f) {
    const i = f.info;
    const cary = [
      [0, 'účaří'], [i.xVyska, 'x-výška ' + i.xVyska], [i.vyskaVerzalek, 'verzálky ' + i.vyskaVerzalek],
      [i.ascender, 'ascender ' + i.ascender], [i.descender, 'descender ' + i.descender]
    ];
    ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
    for (const [y, popis] of cary) {
      const s = Math.round(oy - y * k) + .5;
      ctx.strokeStyle = B.metrika; ctx.lineWidth = y === 0 ? 1.5 : 1;
      ctx.setLineDash(y === 0 ? [] : [5, 4]);
      ctx.beginPath(); ctx.moveTo(0, s); ctx.lineTo(W, s); ctx.stroke();
      ctx.fillStyle = B.muted; ctx.fillText(popis, 6, s - 3);
    }
    ctx.setLineDash([]);
    // vodítka fontu
    for (const v of f.vodidla || []) {
      ctx.strokeStyle = B.ok; ctx.lineWidth = 1; ctx.beginPath();
      if (v.osa === 'y') { const s = Math.round(oy - v.poz * k) + .5; ctx.moveTo(0, s); ctx.lineTo(W, s); }
      else { const s = Math.round(ox + v.poz * k) + .5; ctx.moveTo(s, 0); ctx.lineTo(s, H); }
      ctx.stroke();
      if (v.nazev) { ctx.fillStyle = B.ok; ctx.fillText(v.nazev, v.osa === 'y' ? W - 80 : ox + v.poz * k + 3, v.osa === 'y' ? oy - v.poz * k - 3 : 14); }
    }
    // svislice: počátek a šířka (se sklonem kurzívy)
    const sk = -Math.tan((i.sklon || 0) * Math.PI / 180);   // sklon jako post.italicAngle: záporný = doprava
    for (const [x, tah] of [[0, false], [gl.sirka, true]]) {
      ctx.strokeStyle = tah ? B.akcent : B.metrika; ctx.lineWidth = tah ? 1.5 : 1;
      const a = naObr(x + sk * (i.descender - 200), i.descender - 200), b = naObr(x + sk * (i.ascender + 200), i.ascender + 200);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.fillStyle = B.akcent; ctx.textAlign = 'center';
    const p = naObr(gl.sirka, i.descender);
    ctx.fillText('↔ ' + gl.sirka, p.x, p.y + 16);
    // postranní mezery
    const ob = P.obalkaGlyfu(f, gl);
    if (ob) {
      ctx.fillStyle = B.muted;
      const zy = oy + 16;
      ctx.fillText(Math.round(ob.x0), ox + ob.x0 * k / 2, zy);
      ctx.fillText(Math.round(gl.sirka - ob.x1), ox + (ob.x1 + gl.sirka) * k / 2, zy);
    }
  }

  function kontextGlyfy(text) {
    if (!text) return [];
    return P.textNaGlyfy(A.font, text, false).filter(n => n !== '\n' && A.font.glyfy[n]);
  }
  function kresliKontext(B, gl, f, T) {
    const L = kontextGlyfy(elKL.value), R = kontextGlyfy(elKP.value);
    if (!L.length && !R.length) return;
    ctx.fillStyle = B.plna; ctx.globalAlpha = 0.28;
    let x = 0;
    for (let i = L.length - 1; i >= 0; i--) {
      const z = f.glyfy[L[i]];
      x -= z.sirka + P.kernPar(f, L[i], i === L.length - 1 ? gl.nazev : L[i + 1]);
      ctx.beginPath(); P.kresliObrysy(ctx, P.plneObrysy(f, z, [1, 0, 0, 1, x, 0]).filter(o => !o.otevreny), T); ctx.fill('nonzero');
    }
    x = gl.sirka;
    for (let i = 0; i < R.length; i++) {
      x += P.kernPar(f, i === 0 ? gl.nazev : R[i - 1], R[i]);
      const z = f.glyfy[R[i]];
      ctx.beginPath(); P.kresliObrysy(ctx, P.plneObrysy(f, z, [1, 0, 0, 1, x, 0]).filter(o => !o.otevreny), T); ctx.fill('nonzero');
      x += z.sirka;
    }
    ctx.globalAlpha = 1;
  }

  function kresliPozadi(B, gl, f, T) {
    const pz = gl.pozadi;
    if (!pz) return;
    if (pz.obrazek && pz.obrazek.data && pz.obrazek.viditelny !== false) {
      let img = obrazky.get(pz.obrazek.data);
      if (!img) { img = new Image(); img.onload = () => E.prekresli(); img.src = pz.obrazek.data; obrazky.set(pz.obrazek.data, img); }
      if (img.complete && img.naturalWidth) {
        const o = pz.obrazek, s = naObr(o.x, o.y + img.naturalHeight * o.meritko);
        ctx.globalAlpha = o.pruhlednost == null ? 0.4 : o.pruhlednost;
        ctx.drawImage(img, s.x, s.y, img.naturalWidth * o.meritko * k, img.naturalHeight * o.meritko * k);
        ctx.globalAlpha = 1;
      }
    }
    if (pz.obrysy && pz.obrysy.length) {
      ctx.beginPath(); P.kresliObrysy(ctx, pz.obrysy, T);
      ctx.fillStyle = B.ok; ctx.globalAlpha = 0.12; ctx.fill('nonzero'); ctx.globalAlpha = 0.7;
      ctx.strokeStyle = B.ok; ctx.lineWidth = 1; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
  }

  function kresliBody(B, gl) {
    const vel = 3.6;
    gl.obrysy.forEach((o, oi) => {
      const b = o.body, n = b.length;
      // úchyty
      ctx.strokeStyle = B.muted; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        if (b[i].t !== 'o') continue;
        const s = sousedNaKrivce(o, i);
        if (s < 0) continue;
        const a = naObr(b[i].x, b[i].y), c = naObr(b[s].x, b[s].y);
        ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y);
      }
      ctx.stroke();
      for (let i = 0; i < n; i++) {
        const p = b[i], s = naObr(p.x, p.y), vyb = E.vyber.has(oi + ',' + i);
        ctx.beginPath();
        if (p.t === 'o') { ctx.arc(s.x, s.y, vel * 0.8, 0, Math.PI * 2); }
        else if (p.s) { ctx.arc(s.x, s.y, vel + 0.6, 0, Math.PI * 2); }
        else { ctx.rect(s.x - vel, s.y - vel, vel * 2, vel * 2); }
        ctx.fillStyle = vyb ? B.akcent : (p.t === 'o' ? B.pozadi : (i === 0 || (o.otevreny && i === n - 1) ? B.ok : B.obrys));
        ctx.fill();
        ctx.strokeStyle = vyb ? B.akcent : B.obrys; ctx.lineWidth = 1.2; ctx.stroke();
      }
      // šipka směru u prvního bodu
      const seg = P.segmenty(o)[0];
      if (seg) {
        const a = naObr(seg.p0.x, seg.p0.y);
        const q = seg.typ === 'c' ? P.derivaceKubiky(seg.p0, seg.p1, seg.p2, seg.p3, 0.02) : { x: seg.p3.x - seg.p0.x, y: seg.p3.y - seg.p0.y };
        const L = Math.hypot(q.x, q.y);
        if (L > 0) {
          const ux = q.x / L, uy = -q.y / L;
          ctx.strokeStyle = B.ok; ctx.lineWidth = 1.5; ctx.beginPath();
          const bx = a.x + ux * 16, by = a.y + uy * 16;
          ctx.moveTo(a.x + ux * 6, a.y + uy * 6); ctx.lineTo(bx, by);
          ctx.lineTo(bx - ux * 5 - uy * 4, by - uy * 5 + ux * 4);
          ctx.moveTo(bx, by); ctx.lineTo(bx - ux * 5 + uy * 4, by - uy * 5 - ux * 4);
          ctx.stroke();
        }
      }
    });
  }

  function kresliKotvy(B, gl) {
    ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
    (gl.kotvy || []).forEach((a, i) => {
      const s = naObr(a.x, a.y), vyb = E.vyber.has('a,' + i);
      ctx.beginPath(); ctx.moveTo(s.x, s.y - 6); ctx.lineTo(s.x + 6, s.y); ctx.lineTo(s.x, s.y + 6); ctx.lineTo(s.x - 6, s.y); ctx.closePath();
      ctx.fillStyle = vyb ? B.akcent : B.kotva; ctx.fill();
      ctx.fillStyle = B.kotva; ctx.fillText(a.nazev, s.x + 8, s.y - 6);
    });
  }

  function kresliPrekryv(B, gl, f) {
    if (!tah) {
      if (pero && mys) {   // náhled další úsečky pera
        const o = gl.obrysy[pero.o];
        if (o) {
          const z = o.body[o.body.length - 1], a = naObr(z.x, z.y), b = naObr(mys.x, mys.y);
          ctx.strokeStyle = B.akcent; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(a.x, a.y);
          if (pero.ven) { const c = naObr(pero.ven.x, pero.ven.y); ctx.quadraticCurveTo(c.x, c.y, b.x, b.y); } else ctx.lineTo(b.x, b.y);
          ctx.stroke(); ctx.setLineDash([]);
        }
      }
      return;
    }
    ctx.strokeStyle = B.akcent; ctx.lineWidth = 1;
    if (tah.druh === 'ramecek') {
      const a = naObr(tah.start.x, tah.start.y), b = naObr(tah.ted.x, tah.ted.y);
      ctx.setLineDash([4, 3]); ctx.fillStyle = 'rgba(106,166,253,.08)';
      ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      ctx.strokeRect(Math.min(a.x, b.x) + .5, Math.min(a.y, b.y) + .5, Math.abs(b.x - a.x), Math.abs(b.y - a.y)); ctx.setLineDash([]);
    } else if (tah.druh === 'tvar' && tah.nahled) {
      ctx.beginPath(); P.kresliObrysy(ctx, [tah.nahled], [k, 0, 0, -k, ox, oy]); ctx.stroke();
    } else if (tah.druh === 'kresba') {
      ctx.beginPath();
      tah.body.forEach((p, i) => { const s = naObr(p.x, p.y); if (i) ctx.lineTo(s.x, s.y); else ctx.moveTo(s.x, s.y); });
      if (E.nastroj === 'stetec') { ctx.lineWidth = Math.max(1, E.stetec * k); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = 0.4; }
      ctx.stroke(); ctx.globalAlpha = 1; ctx.lineWidth = 1;
    } else if (tah.druh === 'nuz' || tah.druh === 'meritko') {
      const a = naObr(tah.start.x, tah.start.y), b = naObr(tah.ted.x, tah.ted.y);
      ctx.strokeStyle = tah.druh === 'nuz' ? B.nebezpeci : B.akcent; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      if (tah.druh === 'meritko') kresliMereni(B, gl, f, a, b);
    }
  }

  function kresliMereni(B, gl, f, a, b) {
    const s = tah.start, t = tah.ted;
    const dx = t.x - s.x, dy = t.y - s.y, d = Math.hypot(dx, dy);
    const uhel = Math.atan2(dy, dx) * 180 / Math.PI;
    const pr = pruseciky(P.plneObrysy(f, gl), s, t);
    ctx.font = '12px sans-serif'; ctx.textAlign = 'left';
    ctx.fillStyle = B.akcent;
    for (const p of pr) { const q = naObr(p.x, p.y); ctx.beginPath(); ctx.arc(q.x, q.y, 3.5, 0, Math.PI * 2); ctx.fill(); }
    for (let i = 0; i + 1 < pr.length; i++) {
      const m = naObr((pr[i].x + pr[i + 1].x) / 2, (pr[i].y + pr[i + 1].y) / 2);
      const txt = String(Math.round(Math.hypot(pr[i + 1].x - pr[i].x, pr[i + 1].y - pr[i].y) * 10) / 10);
      stitek(B, txt, m.x + 6, m.y - 6);
    }
    stitek(B, Math.round(d * 10) / 10 + ' · ' + Math.round(uhel * 10) / 10 + '° · Δx ' + Math.round(dx) + ' Δy ' + Math.round(dy), b.x + 10, b.y + 18);
  }
  function stitek(B, txt, x, y) {
    const w = ctx.measureText(txt).width + 8;
    ctx.fillStyle = B.panel; ctx.globalAlpha = 0.9; ctx.fillRect(x - 4, y - 13, w, 18); ctx.globalAlpha = 1;
    ctx.fillStyle = B.text; ctx.fillText(txt, x, y);
  }

  /* Průsečíky úsečky s obrysy, seřazené podél úsečky: [{x,y,u, o, iSeg, t}] */
  function pruseciky(obrysy, s, e) {
    const out = [];
    obrysy.forEach((o, oi) => {
      P.segmenty(o).forEach((sg, si) => {
        const N = sg.typ === 'c' ? 48 : 1;
        let prev = sg.p0, tp = 0;
        for (let j = 1; j <= N; j++) {
          const tt = j / N, cur = sg.typ === 'c' ? P.kubika(sg.p0, sg.p1, sg.p2, sg.p3, tt) : sg.p3;
          const r = prusecikUsecek(s, e, prev, cur);
          if (r) {
            let tSeg = tp + (tt - tp) * r.v;
            if (sg.typ === 'c') tSeg = zpresni(sg, s, e, tp, tt, tSeg);
            const p = sg.typ === 'c' ? P.kubika(sg.p0, sg.p1, sg.p2, sg.p3, tSeg) : { x: sg.p0.x + (sg.p3.x - sg.p0.x) * tSeg, y: sg.p0.y + (sg.p3.y - sg.p0.y) * tSeg };
            out.push({ x: p.x, y: p.y, u: r.u, o: oi, iSeg: si, t: tSeg });
          }
          prev = cur; tp = tt;
        }
      });
    });
    out.sort((a, b) => a.u - b.u);
    // dvojice na styku segmentů (t=1 a t=0) sloučit
    return out.filter((p, i) => i === 0 || Math.hypot(p.x - out[i - 1].x, p.y - out[i - 1].y) > 1e-3);
  }
  function prusecikUsecek(a, b, c, d) {
    const r = { x: b.x - a.x, y: b.y - a.y }, s = { x: d.x - c.x, y: d.y - c.y };
    const den = r.x * s.y - r.y * s.x;
    if (Math.abs(den) < 1e-12) return null;
    const u = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den, v = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
    if (u < 0 || u > 1 || v < 0 || v >= 1) return null;
    return { u, v };
  }
  function zpresni(sg, s, e, t0, t1, t) {
    // půlení: znaménko vzdálenosti od přímky nože
    const nx = -(e.y - s.y), ny = e.x - s.x;
    const f = tt => { const p = P.kubika(sg.p0, sg.p1, sg.p2, sg.p3, tt); return (p.x - s.x) * nx + (p.y - s.y) * ny; };
    let a = t0, b = t1, fa = f(a);
    if (fa * f(b) > 0) return t;
    for (let i = 0; i < 40; i++) { const m = (a + b) / 2, fm = f(m); if (fa * fm <= 0) b = m; else { a = m; fa = fm; } }
    return (a + b) / 2;
  }
  E.pruseciky = pruseciky;

  /* ---------- pomocníci pro body ---------- */
  function sousedNaKrivce(o, i) {   // pro řídicí bod: bod na křivce, ke kterému patří
    const b = o.body, n = b.length;
    const pi = i - 1 < 0 ? (o.otevreny ? -1 : n - 1) : i - 1;
    const ni = i + 1 >= n ? (o.otevreny ? -1 : 0) : i + 1;
    if (pi >= 0 && b[pi].t !== 'o') return pi;
    if (ni >= 0 && b[ni].t !== 'o') return ni;
    return -1;
  }
  function index(o, i) {   // cyklický index (nebo -1 mimo otevřený obrys)
    const n = o.body.length;
    if (o.otevreny) return i >= 0 && i < n ? i : -1;
    return ((i % n) + n) % n;
  }
  /* Úchyty bodu na křivce: [předchozí řídicí, následující řídicí] (indexy nebo -1). */
  function uchyty(o, i) {
    const p = index(o, i - 1), n = index(o, i + 1);
    return [p >= 0 && o.body[p].t === 'o' ? p : -1, n >= 0 && o.body[n].t === 'o' ? n : -1];
  }
  /* Udrží hladký bod hladkým: po pohybu úchytu h otočí protější úchyt. */
  function drzHladkost(o, h) {
    const s = sousedNaKrivce(o, h);
    if (s < 0 || !o.body[s].s) return;
    const [a, b] = uchyty(o, s);
    const protejsi = a === h ? b : a;
    const p = o.body[s], q = o.body[h];
    const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy);
    if (L < 1e-9) return;
    if (protejsi >= 0) {
      const r = o.body[protejsi], l2 = Math.hypot(r.x - p.x, r.y - p.y);
      r.x = p.x - dx / L * l2; r.y = p.y - dy / L * l2;
    }
  }

  /* ---------- hledání pod kurzorem ---------- */
  const DOSAH = 7;
  function najdi(sx, sy) {
    const gl = g(); if (!gl) return null;
    // kotvy
    for (let i = (gl.kotvy || []).length - 1; i >= 0; i--) {
      const s = naObr(gl.kotvy[i].x, gl.kotvy[i].y);
      if (Math.abs(s.x - sx) <= DOSAH && Math.abs(s.y - sy) <= DOSAH) return { druh: 'kotva', i };
    }
    // body (vybrané a řídicí mají přednost)
    let best = null, bd = DOSAH + 1;
    gl.obrysy.forEach((o, oi) => o.body.forEach((p, i) => {
      const s = naObr(p.x, p.y), d = Math.max(Math.abs(s.x - sx), Math.abs(s.y - sy)) - (p.t === 'o' ? 0.5 : 0);
      if (d < bd) { bd = d; best = { druh: 'bod', o: oi, i }; }
    }));
    if (best) return best;
    // segmenty
    const u = zObr(sx, sy);
    let bs = null, bsd = DOSAH / k;
    gl.obrysy.forEach((o, oi) => P.segmenty(o).forEach((sg, si) => {
      const r = P.nejblizsiNaSegmentu(sg, u.x, u.y);
      if (r.d < bsd) { bsd = r.d; bs = { druh: 'segment', o: oi, iSeg: si, t: r.t, seg: sg }; }
    }));
    if (bs) return bs;
    // šířka
    const sw = naObr(gl.sirka, 0);
    if (Math.abs(sw.x - sx) < 5) return { druh: 'sirka' };
    // komponenty
    for (let i = (gl.komponenty || []).length - 1; i >= 0; i--) {
      const kp = gl.komponenty[i], z = A.font.glyfy[kp.glyf];
      if (!z) continue;
      const ob = P.plneObrysy(A.font, z, kp.m);
      if (ob.some(o => P.bodVMnohouhelniku(P.zplostni(o, 2), u.x, u.y))) return { druh: 'komponenta', i };
    }
    // vnitřek obrysu
    for (let oi = gl.obrysy.length - 1; oi >= 0; oi--) {
      const o = gl.obrysy[oi];
      if (!o.otevreny && P.bodVMnohouhelniku(P.zplostni(o, 2), u.x, u.y)) return { druh: 'plocha', o: oi };
    }
    return null;
  }

  /* ---------- přichycení ---------- */
  function prichyt(u, vynechat) {
    if (!E.magnet) return { x: Math.round(u.x), y: Math.round(u.y) };
    const gl = g(), f = A.font, tol = 6 / k;
    let x = u.x, y = u.y, bx = tol, by = tol, cx = null, cy = null;
    const ys = [0, f.info.xVyska, f.info.vyskaVerzalek, f.info.ascender, f.info.descender].concat((f.vodidla || []).filter(v => v.osa === 'y').map(v => v.poz));
    const xs = [0, gl.sirka].concat((f.vodidla || []).filter(v => v.osa === 'x').map(v => v.poz));
    for (const v of ys) if (Math.abs(v - y) < by) { by = Math.abs(v - y); cy = v; }
    for (const v of xs) if (Math.abs(v - x) < bx) { bx = Math.abs(v - x); cx = v; }
    gl.obrysy.forEach((o, oi) => o.body.forEach((p, i) => {
      if (p.t === 'o' || (vynechat && vynechat.has(oi + ',' + i))) return;
      if (Math.abs(p.x - x) < bx) { bx = Math.abs(p.x - x); cx = p.x; }
      if (Math.abs(p.y - y) < by) { by = Math.abs(p.y - y); cy = p.y; }
    }));
    return { x: Math.round(cx != null ? cx : x), y: Math.round(cy != null ? cy : y) };
  }

  /* ---------- změny ---------- */
  function zmen(popis, fn, klic) {
    A.zmen(popis, { glyfy: [A.aktualni] }, fn, klic);
  }
  E.zmen = zmen;
  function vycistiVyber() {
    const gl = g(); if (!gl) { E.vyber.clear(); return; }
    for (const key of Array.from(E.vyber)) {
      const [d, a] = key.split(',');
      let ok = false;
      if (d === 'k') ok = !!(gl.komponenty || [])[+a];
      else if (d === 'a') ok = !!(gl.kotvy || [])[+a];
      else ok = !!gl.obrysy[+d] && +a < gl.obrysy[+d].body.length;   // bod „obrys,index“
      if (!ok) E.vyber.delete(key);
    }
  }
  E.vycistiVyber = vycistiVyber;
  function klicBodu(o, i) { return o + ',' + i; }
  function bodyVyberu() {
    const out = [];
    for (const key of E.vyber) { const p = key.split(','); if (p.length === 2 && p[0] !== 'k' && p[0] !== 'a') out.push([+p[0], +p[1]]); }
    return out;
  }
  E.bodyVyberu = bodyVyberu;
  E.obrysyVyberu = function () {
    const s = new Set(bodyVyberu().map(b => b[0]));
    return Array.from(s).sort((a, b) => a - b);
  };
  function oznamVyber() { A.vyhlas('vyberBodu'); E.prekresli(); }
  E.oznamVyber = oznamVyber;

  /* Posun vybraného (body, komponenty, kotvy) o dx, dy – body na křivce berou úchyty s sebou. */
  function posunVyber(gl, dx, dy, puvodni) {
    const pohnute = new Set();
    for (const [oi, i] of bodyVyberu()) {
      const o = gl.obrysy[oi]; if (!o) continue;
      pohnute.add(oi + ',' + i);
      if (o.body[i].t !== 'o') for (const h of uchyty(o, i)) if (h >= 0) pohnute.add(oi + ',' + h);
    }
    for (const key of pohnute) {
      const [oi, i] = key.split(',').map(Number);
      const p = gl.obrysy[oi].body[i], z = puvodni ? puvodni.obrysy[oi].body[i] : p;
      p.x = z.x + dx; p.y = z.y + dy;
    }
    // úchyty u hladkých bodů, jejichž protějšek se nehýbe
    for (const [oi, i] of bodyVyberu()) {
      const o = gl.obrysy[oi]; if (!o || o.body[i].t !== 'o') continue;
      const s = sousedNaKrivce(o, i);
      if (s >= 0 && !pohnute.has(oi + ',' + s) && !E._alt) drzHladkost(o, i);
    }
    for (const key of E.vyber) {
      const [d, a] = key.split(',');
      if (d === 'k' && gl.komponenty[+a]) { const z = puvodni ? puvodni.komponenty[+a].m : gl.komponenty[+a].m; gl.komponenty[+a].m[4] = z[4] + dx; gl.komponenty[+a].m[5] = z[5] + dy; }
      if (d === 'a' && gl.kotvy[+a]) { const z = puvodni ? puvodni.kotvy[+a] : gl.kotvy[+a]; gl.kotvy[+a].x = z.x + dx; gl.kotvy[+a].y = z.y + dy; }
    }
  }
  E.posunVyber = function (dx, dy) {
    if (!E.vyber.size) return;
    zmen('Posun', () => posunVyber(g(), dx, dy), 'sipky');
  };

  /* ---------- myš ---------- */
  const ukazatele = new Map();
  let stipnuti = null;
  function souradnice(e) { const r = cv.getBoundingClientRect(); return { sx: e.clientX - r.left, sy: e.clientY - r.top }; }

  cv.addEventListener('pointerdown', e => {
    if (!g()) return;
    cv.focus({ preventScroll: true });
    try { cv.setPointerCapture(e.pointerId); } catch (er) { /* syntetická událost */ }
    const { sx, sy } = souradnice(e);
    ukazatele.set(e.pointerId, { sx, sy });
    if (ukazatele.size === 2) {   // dva prsty: lupa a posun
      const [a, b] = Array.from(ukazatele.values());
      stipnuti = { d: Math.hypot(a.sx - b.sx, a.sy - b.sy), cx: (a.sx + b.sx) / 2, cy: (a.sy + b.sy) / 2 };
      tah = null; return;
    }
    const u = zObr(sx, sy);
    E._alt = e.altKey;
    if (e.button === 1 || E.nastroj === 'ruka' || mezernik) { tah = { druh: 'posun', sx, sy, ox, oy }; kurzor('grabbing'); return; }
    if (e.button !== 0) return;
    const n = E.nastroj;
    if (n === 'vyber') return dolVyber(e, sx, sy, u);
    if (n === 'pero') return dolPero(e, u);
    if (n === 'obdelnik' || n === 'elipsa') { tah = { druh: 'tvar', start: prichyt(u), ted: prichyt(u) }; return; }
    if (n === 'tuzka' || n === 'stetec') { tah = { druh: 'kresba', body: [u] }; return; }
    if (n === 'nuz' || n === 'meritko') { tah = { druh: n, start: E.magnet ? prichyt(u) : u, ted: u }; return; }
    if (n === 'kotva') return pridejKotvu(u);
  });

  cv.addEventListener('pointermove', e => {
    const { sx, sy } = souradnice(e);
    if (ukazatele.has(e.pointerId)) ukazatele.set(e.pointerId, { sx, sy });
    if (stipnuti && ukazatele.size === 2) {
      const [a, b] = Array.from(ukazatele.values());
      const d = Math.hypot(a.sx - b.sx, a.sy - b.sy), cx = (a.sx + b.sx) / 2, cy = (a.sy + b.sy) / 2;
      ox += cx - stipnuti.cx; oy += cy - stipnuti.cy;
      if (stipnuti.d > 10) lupa(d / stipnuti.d, cx, cy);
      stipnuti = { d, cx, cy }; E.prekresli(); return;
    }
    const u = zObr(sx, sy);
    mys = u;
    elSour.textContent = Math.round(u.x) + ', ' + Math.round(u.y);
    if (!tah) {
      if (pero) E.prekresli();
      if (E.nastroj === 'vyber' && !mezernik) {
        const h = najdi(sx, sy);
        cv.style.cursor = !h ? 'default' : h.druh === 'sirka' ? 'ew-resize' : h.druh === 'plocha' ? 'default' : 'move';
      }
      return;
    }
    E._alt = e.altKey;
    tahni(e, sx, sy, u);
  });

  function konecUkazatele(e) {
    ukazatele.delete(e.pointerId);
    if (ukazatele.size < 2) stipnuti = null;
    if (!tah) return;
    const { sx, sy } = souradnice(e);
    const u = zObr(sx, sy);
    const t = tah; tah = null;
    pust(e, t, sx, sy, u);
    kurzor();
    E.prekresli();
  }
  cv.addEventListener('pointerup', konecUkazatele);
  cv.addEventListener('pointercancel', e => { ukazatele.delete(e.pointerId); stipnuti = null; tah = null; E.prekresli(); });

  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const { sx, sy } = souradnice(e);
    // kolečko myši (řádky, nebo velký krok bez vodorovné složky) = lupa; touchpad = posun; Ctrl = lupa vždy
    const kolecko = e.deltaMode !== 0 || (Math.abs(e.deltaY) >= 50 && Math.abs(e.deltaX) < 1);
    if (e.ctrlKey || (kolecko && !e.shiftKey)) lupa(Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0018)), sx, sy);
    else if (e.shiftKey && !e.deltaX) { ox -= e.deltaY; E.prekresli(); }
    else { ox -= e.deltaX; oy -= e.deltaY; E.prekresli(); }
  }, { passive: false });

  cv.addEventListener('dblclick', e => {
    if (E.nastroj !== 'vyber') return;
    const { sx, sy } = souradnice(e);
    const h = najdi(sx, sy);
    if (!h) return;
    if (h.druh === 'komponenta') { A.otevriGlyf(g().komponenty[h.i].glyf); return; }
    if (h.o != null) {
      if (!e.shiftKey) E.vyber.clear();
      g().obrysy[h.o].body.forEach((p, i) => E.vyber.add(klicBodu(h.o, i)));
      oznamVyber();
    }
  });

  function kurzor(c) {
    if (c) { cv.style.cursor = c; return; }
    cv.style.cursor = ({ ruka: 'grab', pero: 'crosshair', obdelnik: 'crosshair', elipsa: 'crosshair', nuz: 'crosshair', meritko: 'crosshair', kotva: 'copy', tuzka: 'crosshair', stetec: 'crosshair' })[E.nastroj] || 'default';
    if (mezernik) cv.style.cursor = 'grab';
  }

  /* ---------- nástroj Výběr ---------- */
  function dolVyber(e, sx, sy, u) {
    const gl = g();
    const h = najdi(sx, sy);
    const pridat = e.shiftKey || e.ctrlKey || e.metaKey;
    if (!h || h.druh === 'plocha') {
      if (h && h.druh === 'plocha' && !pridat) {   // klik do plochy obrysu: vybrat celý obrys a táhnout
        E.vyber.clear();
        gl.obrysy[h.o].body.forEach((p, i) => E.vyber.add(klicBodu(h.o, i)));
        oznamVyber();
        zacniPosun(u);
        return;
      }
      if (!pridat) E.vyber.clear();
      tah = { druh: 'ramecek', start: u, ted: u, puvodni: new Set(E.vyber) };
      oznamVyber(); return;
    }
    if (h.druh === 'sirka') { tah = { druh: 'sirka', start: u, sirka: gl.sirka, klic: 'tah' + (++citacTahu) }; return; }
    let key = h.druh === 'bod' ? klicBodu(h.o, h.i) : h.druh === 'komponenta' ? 'k,' + h.i : h.druh === 'kotva' ? 'a,' + h.i : null;
    if (h.druh === 'segment') {
      // tvarování křivky / posun úsečky
      if (!pridat) E.vyber.clear();
      const o = gl.obrysy[h.o];
      E.vyber.add(klicBodu(h.o, h.seg.i0)); E.vyber.add(klicBodu(h.o, h.seg.i3));
      oznamVyber();
      void o;
      if (h.seg.typ === 'l') { zacniPosun(u); return; }   // úsečka se posouvá celá
      tah = { druh: 'segment', o: h.o, iSeg: h.iSeg, t: Math.max(0.1, Math.min(0.9, h.t)), start: u, puvodni: P.klonuj(gl), klic: 'tah' + (++citacTahu) };
      return;
    }
    if (pridat) { if (E.vyber.has(key)) E.vyber.delete(key); else E.vyber.add(key); oznamVyber(); if (!E.vyber.has(key)) return; }
    else if (!E.vyber.has(key)) { E.vyber.clear(); E.vyber.add(key); oznamVyber(); }
    zacniPosun(u, h.druh === 'bod' ? gl.obrysy[h.o].body[h.i] : null);
  }
  function zacniPosun(u, kotevniBod) {
    tah = { druh: 'presun', start: u, puvodni: P.klonuj(g()), klic: 'tah' + (++citacTahu), kotevni: kotevniBod ? { x: kotevniBod.x, y: kotevniBod.y } : null };
  }

  function tahni(e, sx, sy, u) {
    const gl = g();
    if (tah.druh === 'posun') { ox = tah.ox + sx - tah.sx; oy = tah.oy + sy - tah.sy; E.prekresli(); return; }
    if (tah.druh === 'ramecek') {
      tah.ted = u;
      const x0 = Math.min(tah.start.x, u.x), x1 = Math.max(tah.start.x, u.x), y0 = Math.min(tah.start.y, u.y), y1 = Math.max(tah.start.y, u.y);
      E.vyber = new Set(tah.puvodni);
      gl.obrysy.forEach((o, oi) => o.body.forEach((p, i) => { if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) E.vyber.add(klicBodu(oi, i)); }));
      (gl.kotvy || []).forEach((a, i) => { if (a.x >= x0 && a.x <= x1 && a.y >= y0 && a.y <= y1) E.vyber.add('a,' + i); });
      oznamVyber(); return;
    }
    if (tah.druh === 'sirka') {
      const s = Math.max(0, Math.round(tah.sirka + u.x - tah.start.x));
      zmen('Šířka glyfu', () => { g().sirka = s; }, tah.klic);
      return;
    }
    if (tah.druh === 'presun') {
      let dx = u.x - tah.start.x, dy = u.y - tah.start.y;
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      if (tah.kotevni) {   // přichytit tažený bod
        const vyn = new Set(E.vyber);
        const c = prichyt({ x: tah.kotevni.x + dx, y: tah.kotevni.y + dy }, vyn);
        if (!e.shiftKey || dx) dx = c.x - tah.kotevni.x;
        if (!e.shiftKey || dy) dy = c.y - tah.kotevni.y;
      } else { dx = Math.round(dx); dy = Math.round(dy); }
      const pu = tah.puvodni;
      zmen('Posun', () => posunVyber(g(), dx, dy, pu), tah.klic);
      return;
    }
    if (tah.druh === 'segment') {
      const pu = tah.puvodni, t = tah.t;
      const dx = u.x - tah.start.x, dy = u.y - tah.start.y;
      zmen('Tvarování křivky', () => {
        const o = g().obrysy[tah.o], z = pu.obrysy[tah.o];
        const sg = P.segmenty(z)[tah.iSeg];
        const n = o.body.length, i1 = (sg.i0 + 1) % n, i2 = (sg.i0 + 2) % n;
        const c = 1 / (3 * t * Math.pow(1 - t, 3) + 3 * Math.pow(t, 3) * (1 - t));
        o.body[i1].x = Math.round(z.body[i1].x + dx * c * (1 - t)); o.body[i1].y = Math.round(z.body[i1].y + dy * c * (1 - t));
        o.body[i2].x = Math.round(z.body[i2].x + dx * c * t); o.body[i2].y = Math.round(z.body[i2].y + dy * c * t);
        drzHladkost(o, i1); drzHladkost(o, i2);
      }, tah.klic);
      return;
    }
    if (tah.druh === 'tvar') {
      let a = tah.start, b = prichyt(u);
      let w = b.x - a.x, h = b.y - a.y;
      if (e.shiftKey) { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
      let x0 = a.x, y0 = a.y, x1 = a.x + w, y1 = a.y + h;
      if (e.altKey) { x0 = a.x - w; y0 = a.y - h; }
      tah.ted = b;
      tah.r = [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];
      const [X0, Y0, X1, Y1] = tah.r;
      tah.nahled = E.nastroj === 'obdelnik' ? P.obdelnik(X0, Y0, X1, Y1, true) : P.elipsa((X0 + X1) / 2, (Y0 + Y1) / 2, (X1 - X0) / 2, (Y1 - Y0) / 2);
      E.prekresli(); return;
    }
    if (tah.druh === 'kresba') {
      const z = tah.body[tah.body.length - 1];
      if (Math.hypot(u.x - z.x, u.y - z.y) * k > 2) tah.body.push(u);
      E.prekresli(); return;
    }
    if (tah.druh === 'nuz' || tah.druh === 'meritko') {
      let v = E.magnet ? prichyt(u) : u;
      if (e.shiftKey) {   // po 15°
        const dx = v.x - tah.start.x, dy = v.y - tah.start.y, L = Math.hypot(dx, dy);
        const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * Math.PI / 12;
        v = { x: tah.start.x + Math.cos(a) * L, y: tah.start.y + Math.sin(a) * L };
      }
      tah.ted = v; E.prekresli(); return;
    }
    if (tah.druh === 'pero') return tahniPero(u, e);
  }

  function pust(e, t, sx, sy, u) {
    if (t.druh === 'presun' && t.puvodni) {
      // zaokrouhlení po tažení (souřadnice zůstávají celočíselné)
      return;
    }
    if (t.druh === 'tvar' && t.r) {
      const [X0, Y0, X1, Y1] = t.r;
      if ((X1 - X0) * k < 3 || (Y1 - Y0) * k < 3) return;
      zmen(E.nastroj === 'obdelnik' ? 'Obdélník' : 'Elipsa', () => {
        const gl = g();
        const o = E.nastroj === 'obdelnik' ? P.obdelnik(X0, Y0, X1, Y1, true) : P.elipsa((X0 + X1) / 2, (Y0 + Y1) / 2, (X1 - X0) / 2, (Y1 - Y0) / 2);
        P.zaokrouhli(o);
        gl.obrysy.push(o);
        nastavSmerNoveho(gl, gl.obrysy.length - 1);
        E.vyber.clear();
        o.body.forEach((p, i) => E.vyber.add(klicBodu(gl.obrysy.length - 1, i)));
      });
      oznamVyber(); return;
    }
    if (t.druh === 'kresba') return dokonciKresbu(t.body);
    if (t.druh === 'nuz') return rizni(t.start, t.ted);
    if (t.druh === 'pero') return pustPero();
  }

  /* Nový obrys: orientace podle vnoření (uvnitř jiného = díra). */
  function nastavSmerNoveho(gl, i) {
    const o = gl.obrysy[i];
    if (o.otevreny) return;
    const pol = P.zplostni(o, 1);
    if (pol.length < 3) return;
    const vz = P.vnitrniBod(pol);
    let hl = 0;
    gl.obrysy.forEach((p, j) => { if (j !== i && !p.otevreny && P.bodVMnohouhelniku(P.zplostni(p, 1), vz.x, vz.y)) hl++; });
    const chciPoSmeru = hl % 2 === 0;
    if (P.plochaMnohouhelniku(pol) < 0 !== chciPoSmeru) P.obratObrys(o);
  }
  E.nastavSmerNoveho = nastavSmerNoveho;

  /* ---------- pero ---------- */
  function dolPero(e, u) {
    const gl = g();
    const sx = ox + u.x * k, sy = oy - u.y * k;
    const h = najdi(sx, sy);
    const q = prichyt(u);
    if (pero) {
      const o = gl.obrysy[pero.o];
      if (h && h.druh === 'bod' && h.o === pero.o && h.i === 0 && o.body.length > 1) {   // uzavřít
        tah = { druh: 'pero', rezim: 'uzavrit', klic: 'tah' + (++citacTahu), bod: { x: o.body[0].x, y: o.body[0].y } };
        zmen('Uzavřít obrys', () => uzavriPero(g(), null));
        return;
      }
      tah = { druh: 'pero', rezim: 'novy', klic: 'tah' + (++citacTahu), bod: q };
      zmen('Bod perem', () => {
        const o2 = g().obrysy[pero.o];
        if (pero.ven) {
          o2.body.push({ x: pero.ven.x, y: pero.ven.y, t: 'o', s: false }, { x: q.x, y: q.y, t: 'o', s: false }, { x: q.x, y: q.y, t: 'c', s: false });
        } else o2.body.push({ x: q.x, y: q.y, t: 'l', s: false });
        pero.ven = null;
      }, tah.klic);
      E.vyber.clear(); E.vyber.add(klicBodu(pero.o, gl.obrysy[pero.o].body.length - 1)); oznamVyber();
      return;
    }
    // bez rozpracovaného obrysu
    if (h && h.druh === 'bod') {
      const o = gl.obrysy[h.o];
      if (o.otevreny && (h.i === o.body.length - 1 || h.i === 0)) {   // pokračovat v otevřeném obrysu
        if (h.i === 0 && o.body.length > 1) zmen('Obrátit obrys', () => { P.obratObrys(g().obrysy[h.o]); });
        pero = { o: h.o, ven: null, vstup: null };
        A.zprava('Pokračujete v otevřeném obrysu.');
        return;
      }
    }
    if (h && h.druh === 'segment') {   // vložit bod na křivku
      zmen('Vložit bod', () => {
        const ni = P.vlozBod(g().obrysy[h.o], h.iSeg, h.t);
        const p = g().obrysy[h.o].body[ni]; p.x = Math.round(p.x); p.y = Math.round(p.y);
        E.vyber.clear(); E.vyber.add(klicBodu(h.o, ni));
      });
      oznamVyber(); return;
    }
    tah = { druh: 'pero', rezim: 'zacatek', klic: 'tah' + (++citacTahu), bod: q };
    zmen('Nový obrys perem', () => {
      const gl2 = g();
      gl2.obrysy.push({ body: [{ x: q.x, y: q.y, t: 'l', s: false }], otevreny: true });
      pero = { o: gl2.obrysy.length - 1, ven: null, vstup: null };
    }, tah.klic);
    E.vyber.clear(); E.vyber.add(klicBodu(pero.o, 0)); oznamVyber();
  }

  function tahniPero(u, e) {
    if (!pero) return;
    const q = E.magnet ? prichyt(u) : { x: Math.round(u.x), y: Math.round(u.y) };
    const b = tah.bod;
    if (Math.hypot(q.x - b.x, q.y - b.y) * k < 3) return;
    const zrcadlo = { x: 2 * b.x - q.x, y: 2 * b.y - q.y };
    if (tah.rezim === 'zacatek') { pero.ven = q; pero.vstup = zrcadlo; E.prekresli(); return; }
    if (tah.rezim === 'uzavrit') {
      zmen('Uzavřít obrys', () => {
        const o = g().obrysy[pero ? pero.o : -1];
        void o;
      }, tah.klic);
      tah.ven = q; tah.vstup = zrcadlo;
      return;
    }
    // nový bod: tažení dělá z bodu hladký s úchyty
    zmen('Bod perem', () => {
      const o = g().obrysy[pero.o], n = o.body.length;
      const p = o.body[n - 1];
      if (p.t === 'l') {   // úsečka → kubika
        const pred = o.body[n - 2];
        o.body.splice(n - 1, 0, { x: pred.x, y: pred.y, t: 'o', s: false }, { x: zrcadlo.x, y: zrcadlo.y, t: 'o', s: false });
        p.t = 'c';
      } else o.body[n - 2].x = zrcadlo.x, o.body[n - 2].y = zrcadlo.y;
      p.s = true;
    }, tah.klic);
    pero.ven = q;
    E.prekresli();
  }

  function pustPero() { E.prekresli(); }

  /* Uzavře rozpracovaný obrys: poslední segment k prvnímu bodu. */
  function uzavriPero(gl) {
    const o = gl.obrysy[pero.o];
    const prvni = o.body[0];
    if (pero.ven || pero.vstup) {
      o.body.push({ x: (pero.ven || o.body[o.body.length - 1]).x, y: (pero.ven || o.body[o.body.length - 1]).y, t: 'o', s: false },
        { x: (pero.vstup || prvni).x, y: (pero.vstup || prvni).y, t: 'o', s: false });
      prvni.t = 'c';
      if (pero.vstup) prvni.s = true;
    } else prvni.t = 'l';
    delete o.otevreny;
    const i = pero.o;
    pero = null;
    nastavSmerNoveho(gl, i);
  }
  function ukonciPero() {
    if (!pero) return;
    const gl = g(), i = pero.o;
    pero = null;
    if (gl && gl.obrysy[i] && gl.obrysy[i].body.length < 2) zmen('Zrušit bod', () => { g().obrysy.splice(i, 1); E.vyber.clear(); });
    E.prekresli();
  }
  E.ukonciPero = ukonciPero;

  /* ---------- kotva ---------- */
  async function pridejKotvu(u) {
    const gl = g();
    const ma = new Set((gl.kotvy || []).map(a => a.nazev));
    const navrh = ['top', 'bottom', '_top', '_bottom', 'top_right', 'ogonek'].find(n => !ma.has(n)) || 'kotva';
    const nazev = await Dialog.zeptej('Název kotvy (top, bottom; u akcentu _top, _bottom):', navrh);
    if (!nazev) return;
    const q = prichyt(u);
    zmen('Kotva', () => { const g2 = g(); g2.kotvy = g2.kotvy || []; g2.kotvy.push({ nazev: nazev.trim(), x: q.x, y: q.y }); });
  }

  /* ---------- tužka a štětec ---------- */
  function dokonciKresbu(body) {
    if (body.length < 3) return;
    const chyba = Math.max(1.5, 2.5 / k);
    const zav = Math.hypot(body[0].x - body[body.length - 1].x, body[0].y - body[body.length - 1].y) * k < 12 && body.length > 8;
    let o;
    if (E.nastroj === 'tuzka' && zav) {
      o = P.mnohouhelnikNaObrys(body, { chyba, roh: 70 });
    } else {
      const seg = P.prolozKrivkami(body, chyba);
      o = P.zeSegmentu(seg, true);
    }
    if (!o) return;
    P.zaokrouhli(o);
    if (E.nastroj === 'stetec') {
      if (typeof P.obtahni !== 'function') { A.zprava('Štětec potřebuje modul operací (operace.js).', true); return; }
      zmen('Štětec', () => {
        const pom = P.novyGlyf('_tmp', null, 0);
        pom.obrysy.push(o);
        P.obtahni(pom, E.stetec, { konce: 'kulate', spoje: 'kulate' });
        const gl = g();
        for (const n of pom.obrysy) { P.zaokrouhli(n); gl.obrysy.push(n); }
      });
      return;
    }
    zmen('Tužka', () => {
      const gl = g();
      gl.obrysy.push(o);
      nastavSmerNoveho(gl, gl.obrysy.length - 1);
      E.vyber.clear();
    });
  }

  /* ---------- nůž ---------- */
  function rizni(s, e) {
    const gl = g();
    if (Math.hypot(e.x - s.x, e.y - s.y) * k < 4) return;
    const pr = pruseciky(gl.obrysy, s, e);
    if (!pr.length) { A.zprava('Nůž nic neprotnul.'); return; }
    zmen('Nůž', () => {
      const g2 = g();
      const podleObrysu = new Map();
      for (const p of pr) { if (!podleObrysu.has(p.o)) podleObrysu.set(p.o, []); podleObrysu.get(p.o).push(p); }
      const nove = [], smazat = new Set();
      for (const [oi, body] of podleObrysu) {
        const o = g2.obrysy[oi];
        // vložit body od konce, ať indexy segmentů platí
        body.sort((a, b) => b.iSeg - a.iSeg || b.t - a.t);
        const rezy = [];
        let posl = null;
        for (const p of body) {
          let t = p.t;
          if (posl && posl.iSeg === p.iSeg) t = p.t / posl.t;   // segment už je zkrácený na [0, posl.t]
          if (t < 1e-4 || t > 1 - 1e-4) { posl = p; continue; }
          P.vlozBod(o, p.iSeg, t);
          posl = p;
        }
        // body řezu = body na křivce nejblíž průsečíkům
        for (const p of body) {
          let bi = -1, bd = Infinity;
          o.body.forEach((q, i) => { if (q.t !== 'o') { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; bi = i; } } });
          if (bi >= 0 && rezy.indexOf(bi) < 0) rezy.push(bi);
        }
        rezy.sort((a, b) => a - b);
        const kusy = rozdelObrys(o, rezy);
        if (!o.otevreny && rezy.length === 2 && kusy.length === 2) {
          for (const kus of kusy) { delete kus.otevreny; kus.body[0].t = 'l'; kus.body[0].s = false; kus.body[kus.body.length - 1].s = false; nove.push(kus); }
        } else for (const kus of kusy) nove.push(kus);
        smazat.add(oi);
      }
      g2.obrysy = g2.obrysy.filter((o, i) => !smazat.has(i)).concat(nove.filter(o => o.body.length > 1));
      for (const o of g2.obrysy) for (const b of o.body) { b.x = Math.round(b.x); b.y = Math.round(b.y); }
      E.vyber.clear();
    });
    oznamVyber();
  }
  /* Rozdělí obrys v bodech (indexy bodů na křivce) na otevřené kusy. */
  function rozdelObrys(o, rezy) {
    const b = o.body, n = b.length, kusy = [];
    if (!rezy.length) return [o];
    if (o.otevreny) {
      let start = 0;
      for (const r of rezy.concat([n - 1])) {
        if (r <= start) continue;
        kusy.push(kus(b.slice(start, r + 1)));
        start = r;
      }
      return kusy;
    }
    for (let j = 0; j < rezy.length; j++) {
      const a = rezy[j], z = rezy[(j + 1) % rezy.length];
      const pole = [];
      let i = a;
      do { pole.push(b[i]); i = (i + 1) % n; } while (i !== z);
      pole.push(b[z]);
      kusy.push(kus(pole));
    }
    return kusy;
    function kus(pole) {
      const c = pole.map(p => Object.assign({}, p));
      c[0].t = 'l';
      return { body: c, otevreny: true };
    }
  }

  /* ---------- klávesnice ---------- */
  document.addEventListener('keydown', e => {
    if (A.pohled !== 'glyf' || !A.font) return;
    const cil = e.target;
    if (cil && (cil.tagName === 'INPUT' || cil.tagName === 'TEXTAREA' || cil.tagName === 'SELECT' || cil.isContentEditable)) return;
    if (document.querySelector('dialog[open]')) return;
    const kl = (e.key || '').toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.key === ' ' && !mezernik) { mezernik = true; kurzor(); e.preventDefault(); return; }
    if (e.key === 'PageUp') { e.preventDefault(); E.dalsiGlyf(-1); return; }
    if (e.key === 'PageDown') { e.preventDefault(); E.dalsiGlyf(1); return; }
    if (!g()) return;
    if (ctrl) {
      if (e.code === 'Digit0' || e.code === 'Numpad0') { e.preventDefault(); E.zobrazVse(); E.prekresli(); return; }
      if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') { e.preventDefault(); E.lupa(1.25); return; }
      if (e.key === '-' || e.code === 'NumpadSubtract') { e.preventDefault(); E.lupa(0.8); return; }
      if (kl === 'a' && !e.shiftKey) { e.preventDefault(); E.vyberVse(); return; }
      if (kl === 'c' && !e.shiftKey) { e.preventDefault(); E.kopiruj(); return; }
      if (kl === 'x' && !e.shiftKey) { e.preventDefault(); E.kopiruj(); E.smazVyber(); return; }
      if (kl === 'v' && !e.shiftKey) { e.preventDefault(); E.vloz(); return; }
      if (kl === 'd' && !e.shiftKey) { e.preventDefault(); E.duplikuj(); return; }
      return;
    }
    if (e.altKey) return;
    const sip = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (sip) { e.preventDefault(); const m = e.shiftKey ? 10 : 1; E.posunVyber(sip[0] * m, sip[1] * m); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); E.smazVyber(); return; }
    if (e.key === 'Escape') {
      if (pero) { ukonciPero(); return; }
      if (tah) { tah = null; E.prekresli(); return; }
      E.vyber.clear(); oznamVyber(); return;
    }
    if (e.key === 'Enter' && pero) { ukonciPero(); return; }
    if (e.key === 'Tab') { e.preventDefault(); E.dalsiBod(e.shiftKey ? -1 : 1); return; }
    const n = NASTROJE.find(x => x !== '-' && x[2] === kl && !(A.rezim === 'jednoduchy' && ['nuz', 'meritko', 'kotva'].includes(x[0])));
    if (n) { e.preventDefault(); E.zvolNastroj(n[0]); return; }
    if (kl === 'f') { E.plnaVypln = !E.plnaVypln; E.prekresli(); return; }
    if (kl === 'g') { E.mrizka = !E.mrizka; A.nastaveni.mrizka = E.mrizka; A.ulozNastaveni(); E.prekresli(); return; }
  });
  document.addEventListener('keyup', e => { if (e.key === ' ') { mezernik = false; kurzor(); } });

  /* ---------- operace s výběrem ---------- */
  E.vyberVse = function () {
    const gl = g(); E.vyber.clear();
    gl.obrysy.forEach((o, oi) => o.body.forEach((p, i) => E.vyber.add(klicBodu(oi, i))));
    (gl.komponenty || []).forEach((x, i) => E.vyber.add('k,' + i));
    (gl.kotvy || []).forEach((x, i) => E.vyber.add('a,' + i));
    oznamVyber();
  };
  E.dalsiBod = function (smer) {
    const gl = g(), body = bodyVyberu();
    if (!gl.obrysy.length) return;
    let [oi, i] = body.length ? body[0] : [0, -1];
    const o = gl.obrysy[oi];
    i = (i + smer + o.body.length) % o.body.length;
    E.vyber.clear(); E.vyber.add(klicBodu(oi, i)); oznamVyber();
  };

  /* Smazání vybraných bodů se zachováním tvaru (body na křivce mezi kubikami
     se nahradí jednou proloženou kubikou), komponent a kotev. */
  E.smazVyber = function () {
    if (!E.vyber.size) return;
    zmen('Smazat', () => {
      const gl = g();
      const komp = new Set(), kotvy = new Set(), podle = new Map();
      for (const key of E.vyber) {
        const p = key.split(',');
        if (p[0] === 'k') komp.add(+p[1]); else if (p[0] === 'a') kotvy.add(+p[1]);
        else { if (!podle.has(+p[0])) podle.set(+p[0], new Set()); podle.get(+p[0]).add(+p[1]); }
      }
      gl.komponenty = (gl.komponenty || []).filter((x, i) => !komp.has(i));
      gl.kotvy = (gl.kotvy || []).filter((x, i) => !kotvy.has(i));
      const odstranit = new Set();
      for (const [oi, mn] of podle) {
        const o = gl.obrysy[oi];
        const naKrivce = o.body.filter(b => b.t !== 'o').length;
        const mazanych = Array.from(mn).filter(i => o.body[i].t !== 'o').length;
        if (naKrivce - mazanych < (o.otevreny ? 2 : 2)) { odstranit.add(oi); continue; }
        smazBodyObrysu(o, mn);
        if (o.body.filter(b => b.t !== 'o').length < 2) odstranit.add(oi);
      }
      gl.obrysy = gl.obrysy.filter((o, i) => !odstranit.has(i));
      E.vyber.clear();
    });
    oznamVyber();
  };
  function smazBodyObrysu(o, mn) {
    // 1) řídicí body: segment se změní na úsečku
    const rid = Array.from(mn).filter(i => o.body[i].t === 'o');
    if (rid.length) {
      const seg = P.segmenty(o);
      const pryc = new Set();
      for (const s of seg) {
        if (s.typ !== 'c') continue;
        const n = o.body.length, i1 = (s.i0 + 1) % n, i2 = (s.i0 + 2) % n;
        if (mn.has(i1) || mn.has(i2)) { pryc.add(i1); pryc.add(i2); o.body[s.i3].t = 'l'; }
      }
      const zbyle = new Set();
      o.body.forEach((b, i) => { if (mn.has(i) && b.t !== 'o' && !pryc.has(i)) zbyle.add(o.body[i]); });
      o.body = o.body.filter((b, i) => !pryc.has(i));
      mn = new Set(o.body.map((b, i) => zbyle.has(b) ? i : -1).filter(i => i >= 0));
    }
    // 2) body na křivce: sousední segmenty se spojí
    let mazat = Array.from(mn).filter(i => o.body[i] && o.body[i].t !== 'o').map(i => o.body[i]);
    for (const bod of mazat) {
      const i = o.body.indexOf(bod);
      if (i < 0) continue;
      const seg = P.segmenty(o);
      const pred = seg.find(s => s.i3 === i), za = seg.find(s => s.i0 === i);
      if (!pred || !za) {   // konec otevřeného obrysu
        const n = o.body.length;
        if (o.otevreny && i === 0) { let j = 1; while (j < n && o.body[j].t === 'o') j++; o.body.splice(0, j); if (o.body[0]) o.body[0].t = 'l'; }
        else if (o.otevreny) { let j = i - 1; while (j > 0 && o.body[j].t === 'o') j--; o.body.splice(j + 1); }
        continue;
      }
      if (pred.typ === 'l' && za.typ === 'l') { o.body.splice(i, 1); continue; }
      // proložit jednu kubiku přes oba segmenty
      const vzorky = [];
      for (const s of [pred, za]) for (let j = 0; j <= 16; j++) {
        const t = j / 16;
        vzorky.push(s.typ === 'c' ? P.kubika(s.p0, s.p1, s.p2, s.p3, t) : { x: s.p0.x + (s.p3.x - s.p0.x) * t, y: s.p0.y + (s.p3.y - s.p0.y) * t });
      }
      const t1 = tecnaZ(pred, 0), t2 = tecnaZ(za, 1);
      const L = Math.hypot(za.p3.x - pred.p0.x, za.p3.y - pred.p0.y) / 3;
      const nova = prolozJednou(vzorky, pred.p0, za.p3, t1, t2, L);
      // nahradit body mezi pred.p0 a za.p3 (cyklicky) dvěma řídicími
      const n = o.body.length, odstr = [];
      let j = (pred.i0 + 1) % n;
      while (j !== za.i3) { odstr.push(o.body[j]); j = (j + 1) % n; }
      o.body = o.body.filter(b => odstr.indexOf(b) < 0);
      const vloz = [{ x: Math.round(nova.p1.x), y: Math.round(nova.p1.y), t: 'o', s: false }, { x: Math.round(nova.p2.x), y: Math.round(nova.p2.y), t: 'o', s: false }];
      o.body.splice(o.body.indexOf(pred.p0) + 1, 0, ...vloz);
      za.p3.t = 'c';
    }
  }
  function tecnaZ(s, kde) {   // jednotková tečna na začátku (kde=0, směr ven z p0) nebo na konci (kde=1, směr zpět od p3)
    let d;
    if (s.typ === 'l') d = kde === 0 ? { x: s.p3.x - s.p0.x, y: s.p3.y - s.p0.y } : { x: s.p0.x - s.p3.x, y: s.p0.y - s.p3.y };
    else if (kde === 0) d = Math.hypot(s.p1.x - s.p0.x, s.p1.y - s.p0.y) > 1e-6 ? { x: s.p1.x - s.p0.x, y: s.p1.y - s.p0.y } : { x: s.p2.x - s.p0.x, y: s.p2.y - s.p0.y };
    else d = Math.hypot(s.p2.x - s.p3.x, s.p2.y - s.p3.y) > 1e-6 ? { x: s.p2.x - s.p3.x, y: s.p2.y - s.p3.y } : { x: s.p1.x - s.p3.x, y: s.p1.y - s.p3.y };
    const L = Math.hypot(d.x, d.y) || 1;
    return { x: d.x / L, y: d.y / L };
  }
  /* Nejlepší délky úchytů při pevných tečnách (nejmenší čtverce). */
  function prolozJednou(v, p0, p3, t1, t2, L0) {
    let best = null, be = Infinity;
    for (let a = 0.2; a <= 2.6; a += 0.1) for (let b = 0.2; b <= 2.6; b += 0.1) {
      const c = { p0, p1: { x: p0.x + t1.x * L0 * a, y: p0.y + t1.y * L0 * a }, p2: { x: p3.x + t2.x * L0 * b, y: p3.y + t2.y * L0 * b }, p3 };
      let e = 0;
      for (const q of v) e += P.nejblizsiNaSegmentu(Object.assign({ typ: 'c' }, c), q.x, q.y).d ** 2;
      if (e < be) { be = e; best = c; }
    }
    return best;
  }

  E.kopiruj = function () {
    const gl = g(); if (!gl) return;
    const obr = E.obrysyVyberu();
    const komp = Array.from(E.vyber).filter(x => x.startsWith('k,')).map(x => gl.komponenty[+x.split(',')[1]]).filter(Boolean);
    const vse = !obr.length && !komp.length;
    A.schranka = {
      druh: 'obrysy',
      obrysy: P.klonuj((vse ? gl.obrysy : obr.map(i => gl.obrysy[i]))),
      komponenty: P.klonuj(vse ? (gl.komponenty || []) : komp),
      sirka: gl.sirka
    };
    A.zprava(vse ? 'Zkopírován celý glyf.' : 'Zkopírováno: ' + obr.length + ' obrysů' + (komp.length ? ', ' + komp.length + ' komponent' : '') + '.');
  };
  E.vloz = function () {
    const s = A.schranka;
    if (!s || s.druh !== 'obrysy') { A.zprava('Schránka je prázdná (Ctrl+C v editoru).'); return; }
    zmen('Vložit', () => {
      const gl = g(), zac = gl.obrysy.length;
      for (const o of P.klonuj(s.obrysy)) gl.obrysy.push(o);
      gl.komponenty = (gl.komponenty || []).concat(P.klonuj(s.komponenty || []).filter(kp => kp.glyf !== gl.nazev && A.font.glyfy[kp.glyf]));
      E.vyber.clear();
      for (let oi = zac; oi < gl.obrysy.length; oi++) gl.obrysy[oi].body.forEach((p, i) => E.vyber.add(klicBodu(oi, i)));
    });
    oznamVyber();
  };
  E.duplikuj = function () {
    const obr = E.obrysyVyberu(); if (!obr.length) return;
    zmen('Duplikovat', () => {
      const gl = g(), zac = gl.obrysy.length;
      for (const i of obr) { const c = P.klonuj(gl.obrysy[i]); for (const b of c.body) { b.x += 20; b.y -= 20; } gl.obrysy.push(c); }
      E.vyber.clear();
      for (let oi = zac; oi < gl.obrysy.length; oi++) gl.obrysy[oi].body.forEach((p, i) => E.vyber.add(klicBodu(oi, i)));
    });
    oznamVyber();
  };

  /* Přepnutí vybraných bodů hladký/rohový. */
  E.prepniHladkost = function (hladky) {
    const body = bodyVyberu().filter(([oi, i]) => g().obrysy[oi].body[i].t !== 'o');
    if (!body.length) return;
    zmen(hladky ? 'Hladký bod' : 'Rohový bod', () => {
      const gl = g();
      for (const [oi, i] of body) {
        const o = gl.obrysy[oi], p = o.body[i];
        p.s = hladky;
        if (!hladky) continue;
        const [a, b] = uchyty(o, i);
        if (a >= 0 && b >= 0) {   // zarovnat oba úchyty na společnou tečnu
          const A_ = o.body[a], B_ = o.body[b];
          const dx = B_.x - A_.x, dy = B_.y - A_.y, L = Math.hypot(dx, dy) || 1;
          const la = Math.hypot(A_.x - p.x, A_.y - p.y), lb = Math.hypot(B_.x - p.x, B_.y - p.y);
          A_.x = Math.round(p.x - dx / L * la); A_.y = Math.round(p.y - dy / L * la);
          B_.x = Math.round(p.x + dx / L * lb); B_.y = Math.round(p.y + dy / L * lb);
        } else if (a >= 0 || b >= 0) {   // jen jeden úchyt: srovnat s protější úsečkou
          const h = a >= 0 ? a : b, druhy = index(o, a >= 0 ? i + 1 : i - 1);
          if (druhy >= 0) {
            const q = o.body[druhy], H_ = o.body[h];
            const dx = p.x - q.x, dy = p.y - q.y, L = Math.hypot(dx, dy) || 1, lh = Math.hypot(H_.x - p.x, H_.y - p.y);
            H_.x = Math.round(p.x + dx / L * lh); H_.y = Math.round(p.y + dy / L * lh);
          }
        }
      }
    });
  };
  /* Vybrané segmenty (oba koncové body vybrané): úsečka ↔ křivka. */
  E.prevedSegmenty = function (naKrivku) {
    const gl = g(); if (!gl) return;
    const vyb = new Set(E.vyber);
    zmen(naKrivku ? 'Na křivku' : 'Na úsečku', () => {
      const g2 = g();
      g2.obrysy.forEach((o, oi) => {
        // segmenty se hledají znovu podle koncových bodů (indexy se úpravami posouvají)
        const cile = P.segmenty(o).filter(s => vyb.has(oi + ',' + s.i0) && vyb.has(oi + ',' + s.i3)).map(s => [s.p0, s.p3]);
        for (const [a0, a3] of cile) {
          const s = P.segmenty(o).find(x => x.p0 === a0 && x.p3 === a3);
          if (!s) continue;
          const n = o.body.length;
          if (naKrivku && s.typ === 'l') {
            const a = s.p0, b = s.p3;
            const nove = [{ x: Math.round(a.x + (b.x - a.x) / 3), y: Math.round(a.y + (b.y - a.y) / 3), t: 'o', s: false },
              { x: Math.round(a.x + 2 * (b.x - a.x) / 3), y: Math.round(a.y + 2 * (b.y - a.y) / 3), t: 'o', s: false }];
            o.body[s.i3].t = 'c';
            const kam = s.i3 === 0 && !o.otevreny ? n : s.i3;
            o.body.splice(kam, 0, ...nove);
          } else if (!naKrivku && s.typ === 'c') {
            const i1 = (s.i0 + 1) % n, i2 = (s.i0 + 2) % n;
            o.body[s.i3].t = 'l'; o.body[s.i3].s = false;
            o.body = o.body.filter((b, i) => i !== i1 && i !== i2);
          }
        }
      });
      E.vyber.clear();
    });
    oznamVyber();
  };

  /* ---------- reakce na změny ---------- */
  A.na('zmena', co => {
    if (A.pohled !== 'glyf') return;
    vycistiVyber();
    if (pero && (!g() || !g().obrysy[pero.o] || !g().obrysy[pero.o].otevreny)) pero = null;
    E.prekresli();
  });
  A.na('pohled', p => { if (p === 'glyf') { velikost(); if (!E._zobrazeno && g()) { E.zobrazVse(); E._zobrazeno = true; } E.prekresli(); } });
  A.na('font', () => { E._zobrazeno = false; E.vyber.clear(); pero = null; });
  A.na('tema', () => E.prekresli());
  for (const el of [elKL, elKP]) el.addEventListener('input', () => { A.nastaveni.kontext = [elKL.value, elKP.value]; A.ulozNastaveni(); E.prekresli(); });
  if (Array.isArray(A.nastaveni.kontext)) { elKL.value = A.nastaveni.kontext[0]; elKP.value = A.nastaveni.kontext[1]; }
  new ResizeObserver(() => { if (A.pohled === 'glyf') E.prekresli(); }).observe(cv);
  elNapoveda.textContent = NAPOVEDY[E.nastroj];

  /* Pro testy: přepočet obrazovka ↔ jednotky. */
  E._pohled = () => ({ k, ox, oy, W, H });
  E._naObr = naObr;
  E._najdi = najdi;
})();
