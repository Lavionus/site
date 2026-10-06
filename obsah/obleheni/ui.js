/* Ostrov v obležení – rozhraní (prohlížeč): herní smyčka, vstup, HUD, obchod, panely, okna, efekty.
   Logika je v sim.js; tady se jen volá a kreslí. Kosmetické efekty smí brát Math.random. */
(function (OBL) {
  'use strict';
  const S = OBL.sim, G = OBL.grafika, Z = OBL.zvuk, D = OBL.data, Os = OBL.ostrov;
  const TILE = G.TILE, MW = Os.W * TILE, MH = Os.H * TILE;
  const KLIC_ULOZENI = 'webapp_hra_obleheni_save';
  const $ = id => document.getElementById(id);

  const cv = $('mapa'), ctx = cv.getContext('2d');
  const st = {
    hra: null, kampan: null, rychlost: 1, pauza: false, auto: false, autoT: 0,
    stavba: null, vybrana: null, budova: null, hover: null, hoverE: null, arm: null, hlidka: false,
    vrstva: '', zalozka: 'veze', pozadi: null, pozadiKlic: '', k: 1, cssW: 768,
    efekty: [], castice: [], texty: [], otres: 0, casAnim: 0, okno: null,
    poskozeniPevnosti: {}, cekaArtefakt: false, rezimMenu: 'kampan', obtMenu: 'normalni', bannerT: 0,
  };
  window.OBL_UI = st; // pro testy

  /* ================= rekordy ================= */
  const datumKlic = () => { const d = new Date(); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); };
  function rekordRezimu(rezim) {
    if (typeof Rekord === 'undefined') return null;
    if (rezim === 'nekonecna') return Rekord.sleduj('webapp_hra_obleheni_nekonecna', { popisek: 'Nejvíc vln', format: v => v + ' vln' });
    if (rezim === 'den') return Rekord.sleduj('webapp_hra_obleheni_den_' + datumKlic(), { popisek: 'Ostrov dne', format: v => v + ' b.' });
    return Rekord.sleduj('webapp_hra_obleheni_kampan', { popisek: 'Souostroví', format: v => v + ' b.' });
  }

  /* ================= velikost plátna ================= */
  function rozmer() {
    const r = cv.getBoundingClientRect();
    const cssW = Math.max(200, r.width || 768), dpr = window.devicePixelRatio || 1;
    const w = Math.round(cssW * dpr), h = Math.round(cssW * 0.75 * dpr);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    st.cssW = cssW;
    st.k = w / MW;
    G.nastavMeritko(st.k);
  }
  function pozadi() {
    const h = st.hra;
    const klic = h.seed + ':' + h.biom + ':' + h.pocasi.priliv + ':' + cv.width;
    if (st.pozadiKlic !== klic) { st.pozadi = G.vykresliPozadi(h.o, h.pocasi.priliv, st.k); st.pozadiKlic = klic; }
    return st.pozadi;
  }

  /* ================= obchod ================= */
  const KARTY = {
    veze: ['straz', 'delo', 'mozdir', 'balista', 'musket', 'kotel', 'mag', 'salupa'],
    podpora: ['majak', 'prapor', 'sklad', 'plantaz'],
    pasti: ['zatarasy', 'kuly', 'mina', 'retez'],
  };
  const KLAVESY = { straz: '1', delo: '2', mozdir: '3', balista: '4', musket: '5', kotel: '6', mag: '7', salupa: '8', majak: '9', prapor: '0', sklad: '-', plantaz: '=', zatarasy: 'Q', kuly: 'W', mina: 'E', retez: 'R' };
  const domeny = c => (c || '').replace('m', '🌊').replace('v', '🦅').replace('s', '⚔️');
  function defKarty(k) { return D.VEZE[k] || D.PASTI[k]; }
  const jePast = k => !!D.PASTI[k];

  function vykresliObchod() {
    const el = $('obchod'); el.innerHTML = '';
    for (const k of KARTY[st.zalozka]) {
      const d = defKarty(k), b = document.createElement('div');
      b.className = 'karta' + (st.stavba === k ? ' sel' : '');
      b.dataset.k = k;
      b.innerHTML = `<span class="hk">${KLAVESY[k]}</span><div class="ico">${d.ikona}</div><div class="nm">${d.nazev}</div><div class="cena">${d.cena} 💰</div><div class="dom">${d.cile ? domeny(d.cile) : d.podpora ? 'podpora' : 'past'}</div>`;
      b.onclick = () => vyberStavbu(k);
      b.onmouseenter = () => infoKarty(k);
      el.appendChild(b);
    }
    obnovDostupnost();
  }
  function obnovDostupnost() {
    if (!st.hra) return;
    for (const b of $('obchod').children) {
      const d = defKarty(b.dataset.k);
      b.classList.toggle('nelze', st.hra.zlato < d.cena);
      b.classList.toggle('sel', st.stavba === b.dataset.k);
    }
  }
  function infoKarty(k) {
    const d = defKarty(k);
    let t = `<b>${d.ikona} ${d.nazev}</b> · ${d.cena} 💰 · ${d.popis}`;
    if (d.cile) t += ` Útočí na: ${domeny(d.cile)}${d.dosah ? ' · dosah ' + d.dosah.toFixed(1) : ''}.`;
    if (d.aura && d.aura !== 'žádná') t += ` <span class="aura">Aura: ${d.aura}.</span>`;
    if (d.specs && d.specs.length) t += ` Specializace: ${d.specs.map(s => s.n).join(' / ')}.`;
    $('info').innerHTML = t;
  }
  function vyberStavbu(k) {
    if (!st.hra || st.hra.konec) return;
    zavriPanel();
    st.arm = null; st.hlidka = false;
    if (k === 'salupa') {
      // šalupa se staví rovnou v přístavu
      const m = S.lzeStavet(st.hra, 'salupa');
      if (!m.ok) { banner(m.duvod, true); Z.hraj('chyba'); return; }
      const v = S.postav(st.hra, 'salupa');
      if (v) { banner('⛵ Šalupa vyplula z přístavu. Klikni na ni a pak na moře, kde má hlídkovat.'); st.vybrana = v.id; otevriPanelVeze(v); uloz(); }
      return;
    }
    st.stavba = st.stavba === k ? null : k;
    if (st.stavba) infoKarty(k);
    obnovDostupnost(); vykresliSchopnosti();
  }

  /* ================= schopnosti ================= */
  function vykresliSchopnosti() {
    const el = $('schopnosti');
    if (!el.children.length) {
      for (const k of Object.keys(D.SCHOPNOSTI)) {
        const d = D.SCHOPNOSTI[k], b = document.createElement('button');
        b.className = 'abil'; b.dataset.k = k;
        b.innerHTML = `${d.ikona} ${d.nazev} <small></small><i class="nabit"></i>`;
        b.title = d.popis + ' (' + ({ salva: 'A', brander: 'S', zpev: 'D' })[k] + ')';
        b.onclick = () => pouzijSchopnost(k);
        el.appendChild(b);
      }
    }
    if (!st.hra) return;
    for (const b of el.children) {
      const k = b.dataset.k, s = st.hra.schopnosti[k], max = S.nabijeni(st.hra, k);
      const nelze = s.cd > 0 || !st.hra.vlnaBezi || (k === 'brander' && st.hra.pristav.hp <= 0);
      b.disabled = nelze && st.arm !== k;
      b.classList.toggle('arm', st.arm === k);
      b.querySelector('small').textContent = s.cd > 0 ? 'nabíjí se ' + Math.ceil(s.cd) + ' s' : !st.hra.vlnaBezi ? 'jen během vlny' : k === 'salva' ? (st.arm === k ? 'klikni na moře' : 'připraveno') : 'připraveno';
      b.querySelector('.nabit').style.width = (s.cd > 0 ? 100 * (1 - s.cd / max) : 0) + '%';
    }
  }
  function pouzijSchopnost(k) {
    const h = st.hra;
    if (!h || h.konec || !h.vlnaBezi) return;
    if (k === 'salva') { st.arm = st.arm === 'salva' ? null : 'salva'; st.stavba = null; obnovDostupnost(); banner(st.arm ? '💣 Klikni na moře nebo pobřeží, kam má flotila pálit.' : ''); }
    else if (k === 'brander') { if (!S.brander(h)) Z.hraj('chyba'); }
    else if (k === 'zpev') { if (!S.zpev(h)) Z.hraj('chyba'); }
    vykresliSchopnosti();
  }

  /* ================= vstup ================= */
  function poleZUdalosti(ev) {
    const r = cv.getBoundingClientRect();
    const fx = (ev.clientX - r.left) / r.width * Os.W, fy = (ev.clientY - r.top) / r.height * Os.H;
    return { fx, fy, x: Math.floor(fx), y: Math.floor(fy) };
  }
  cv.addEventListener('pointermove', ev => {
    if (!st.hra) return;
    const p = poleZUdalosti(ev);
    st.hover = p;
    // nepřítel pod kurzorem → popisek
    let nej = null, nd = 0.7;
    for (const e of st.hra.nepratele) { if (e.zpozdeni > 0) continue; const d = Math.hypot(e.x - p.fx, e.y - p.fy); if (d < nd + e.def.vel * 0.3) { nd = d; nej = e; } }
    st.hoverE = nej;
    ukazTip(nej, ev);
  });
  cv.addEventListener('pointerleave', () => { st.hover = null; st.hoverE = null; $('tip').classList.remove('show'); });
  cv.addEventListener('pointerdown', ev => {
    Z.init();
    if (!st.hra || st.okno) return;
    const p = poleZUdalosti(ev), h = st.hra;
    st.hover = p;
    if (st.arm === 'salva') {
      if (S.salva(h, p.fx, p.fy)) { st.arm = null; banner(''); } else { banner('Salva jen na moře nebo pobřeží (do 2 polí od vody).', true); Z.hraj('chyba'); }
      vykresliSchopnosti(); return;
    }
    if (st.hlidka) {
      const v = h.veze.find(t => t.id === st.vybrana);
      if (v && S.nastavHlidku(h, v, p.x, p.y)) { st.hlidka = false; banner('⛵ Šalupa pluje hlídkovat.'); otevriPanelVeze(v); uloz(); }
      else { banner('Šalupa potřebuje dost hlubokou vodu (aspoň střední).', true); Z.hraj('chyba'); }
      return;
    }
    if (st.stavba) {
      const k = st.stavba;
      const v = jePast(k) ? S.postavPast(h, k, p.x, p.y) : S.postav(h, k, p.x, p.y);
      if (!v) {
        const m = jePast(k) ? S.lzePast(h, k, p.x, p.y) : S.lzeStavet(h, k, p.x, p.y);
        banner(m.duvod, true); Z.hraj('chyba');
      } else {
        if (!ev.shiftKey || h.zlato < defKarty(k).cena) st.stavba = null;
        if (!jePast(k)) { const q = S.najdiCtverici(h, v); if (q) banner('✨ Čtyři stejné věže ve čtverci – v panelu věže je můžeš sloučit v ' + (q.s >= 2 ? 'pevnůstku' : 'baštu') + '.'); }
        uloz();
      }
      obnovDostupnost(); return;
    }
    // klik na šalupu (stojí na vodě)
    const sal = h.veze.find(v => v.typ === 'salupa' && Math.hypot(v.px - p.fx, v.py - p.fy) < 0.7);
    if (sal) { st.vybrana = sal.id; otevriPanelVeze(sal); return; }
    const i = Os.idx(Math.max(0, Math.min(Os.W - 1, p.x)), Math.max(0, Math.min(Os.H - 1, p.y)));
    const id = h.obsazeno[i];
    if (id) { const v = h.veze.find(t => t.id === id); st.vybrana = id; otevriPanelVeze(v); return; }
    const b = h.o.budova[i];
    if (b >= 0) { otevriPanelBudovy(b === 0 ? 'pevnost' : b === 1 ? 'pristav' : 'vesnice' + (b - 2)); return; }
    const past = h.pastNa[i] ? h.pasti.find(q => q.id === h.pastNa[i]) : null;
    if (past) { otevriPanelPasti(past); return; }
    zavriPanel();
  });
  cv.addEventListener('contextmenu', ev => { ev.preventDefault(); zrus(); });

  function zrus() { st.stavba = null; st.arm = null; st.hlidka = false; zavriPanel(); obnovDostupnost(); vykresliSchopnosti(); banner(''); }

  document.addEventListener('keydown', ev => {
    if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'SELECT' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const k = ev.key.toUpperCase();
    if (k === 'ESCAPE') { zrus(); return; }
    if (st.okno || !st.hra) return;
    if (ev.key === ' ') { ev.preventDefault(); spustVlnu(); return; }
    if (k === 'P') { st.pauza = !st.pauza; obnovRychlost(); return; }
    if (k === 'F') { prepniRychlost(); return; }
    if (k === 'M') { prepniZvuk(); return; }
    if (k === 'A') { pouzijSchopnost('salva'); return; }
    if (k === 'S') { pouzijSchopnost('brander'); return; }
    if (k === 'D') { pouzijSchopnost('zpev'); return; }
    const v = st.vybrana && st.hra.veze.find(t => t.id === st.vybrana);
    if (k === 'U' && v) { if (S.vylepsi(st.hra, v)) { otevriPanelVeze(v); uloz(); } return; }
    if (k === 'X' && v) { S.prodej(st.hra, v); zavriPanel(); uloz(); return; }
    for (const [typ, kl] of Object.entries(KLAVESY)) if (kl === k) {
      const z = Object.keys(KARTY).find(z => KARTY[z].includes(typ));
      if (z !== st.zalozka) { st.zalozka = z; prepniZalozku(z); }
      vyberStavbu(typ); return;
    }
  });

  /* ================= popisek nepřítele ================= */
  function ukazTip(e, ev) {
    const tip = $('tip');
    if (!e) { tip.classList.remove('show'); return; }
    const d = e.def, im = D.IMUNITY[e.imm];
    const res = Object.entries(e.res).map(([k, v]) => D.VEZE[k].ikona + ' −' + Math.round(v * 100) + ' %').join(', ');
    const ukol = { vysadek: 'pluje k pláži s výsadkem', vylez: 'chce vylézt na pláž', ostrel: 'hledá místo k ostřelování', ostrel_stoji: 'ostřeluje budovy', loupez: 'chce vyloupit přístav', hryze: 'útočí na přístav', had: 'hledá pobřežní věž', odjezd: 'odplouvá', pevnost: 'míří k pevnosti', utoci: 'útočí na pevnost', vez: 'útočí na věže', shoz: 'nese výsadek', odlet: 'odlétá' }[e.ukol] || '';
    tip.innerHTML = `<b>${d.ikona} ${d.nazev}</b> ${Math.ceil(e.hp)}/${e.max}<br>${ukol}${d.pancir ? ' · pancíř ' + d.pancir : ''}<br>${im ? im.ikona + ' ' + im.nazev + ' (' + im.popis + ')' : ''}${res ? '<br>odolnost: ' + res : ''}`;
    const r = $('obal').getBoundingClientRect();
    tip.style.left = Math.min(r.width - 235, ev.clientX - r.left + 14) + 'px';
    tip.style.top = (ev.clientY - r.top + 12) + 'px';
    tip.classList.add('show');
  }

  /* ================= panely ================= */
  function umistiPanel(px, py) {
    const p = $('panel'), r = $('obal').getBoundingClientRect();
    const x = px / MW * r.width, y = py / MH * r.height;
    const w = p.offsetWidth || 250, h = p.offsetHeight || 260;
    let l = x + 20, t = y - h / 2;
    if (l + w > r.width - 4) l = x - w - 20;
    if (l < 4) l = Math.max(4, Math.min(r.width - w - 4, x - w / 2));
    t = Math.max(4, Math.min(r.height - h - 4, t));
    p.style.left = l + 'px'; p.style.top = t + 'px';
  }
  function zavriPanel() { $('panel').classList.remove('show'); st.vybrana = null; st.budova = null; st.hlidka = false; }

  function otevriPanelVeze(v) {
    const h = st.hra, d = D.VEZE[v.typ], p = $('panel');
    st.budova = null;
    const s = S.staty(h, v);
    const rk = S.hodnost(v), H = D.HODNOSTI, dalsi = H[rk + 1];
    const maxU = S.maxUroven(v), cenaU = S.cenaVylepseni(v);
    let html = `<button class="zav" title="Zavřít">✕</button><h3>${d.ikona} ${v.super ? 'Pevnůstka: ' : v.mega ? 'Bašta: ' : ''}${d.nazev} · úr. ${v.uroven}</h3>`;
    if (v.typ !== 'salupa') html += `<div class="pozn">${H[rk].znak} ${H[rk].n}${dalsi ? ' · ' + Math.floor(v.xp || 0) + '/' + dalsi.xp + ' XP' : ' · nejvyšší hodnost'} · zabití ${v.zabiti || 0}</div>` + (dalsi ? `<div class="xpbar"><i style="width:${Math.min(100, ((v.xp || 0) - H[rk].xp) / (dalsi.xp - H[rk].xp) * 100)}%"></i></div>` : '');
    if (!d.podpora) {
      html += `<div class="row">Poškození <b>${s.dmg}${s.terce > 1 ? ' ×' + s.terce : ''}${s.retez ? ' (+' + s.retez + ' přeskoků)' : ''}</b></div>`;
      html += `<div class="row">Nabíjení <b>${s.kad.toFixed(2)} s</b></div><div class="row">Dosah <b>${s.dosah.toFixed(1)} pole</b></div>`;
      html += `<div class="row">Útočí na <b>${domeny(s.cile)}</b></div>`;
      if (s.splash) html += `<div class="row">Plocha <b>${s.splash.toFixed(2)}</b></div>`;
      const syn = [s.zhave && 'žhavé koule', s.strzeni && 'sražení letců', s.navadeni && 'navádění'].filter(Boolean);
      if (syn.length) html += `<div class="pozn">✨ Synergie: ${syn.join(', ')}</div>`;
    } else if (v.typ === 'majak') html += `<div class="row">Odhalení <b>${s.dosah.toFixed(1)} pole</b></div>`;
    else if (v.typ === 'plantaz') html += `<div class="row">Výnos po vlně <b>${Math.round(20 * (1 + 0.5 * (v.uroven - 1)) * (v.super ? 9 : v.mega ? 3 : 1))} 💰</b></div>`;
    if (d.aura && d.aura !== 'žádná') html += `<div class="pozn">Aura: ${d.aura}</div>`;
    if (v.vyrazena > 0) html += `<div class="pozn">💤 Věž je vyřazená (${v.vyrazena > 100 ? 'obtočil ji had' : Math.ceil(v.vyrazena) + ' s'}).</div>`;
    if (!d.podpora) html += `<div class="prio">${[['prvni', 'nejblíž cíli'], ['silny', 'nejsilnější'], ['slaby', 'nejslabší'], ['blizko', 'nejbližší']].map(([k, n]) => `<button data-p="${k}" class="${(v.priorita || 'prvni') === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    if (v.uroven >= 3 && v.spec == null && d.specs.length) html += d.specs.map((sp, i) => `<button class="plne btn-spec" data-s="${i}">${sp.n}<br><small>${sp.d}</small></button>`).join('');
    else if (v.spec != null) html += `<div class="pozn">⭐ ${d.specs[v.spec].n}: ${d.specs[v.spec].d}</div>`;
    const q = S.najdiCtverici(h, v);
    if (q) html += `<button class="plne btn-merge${q.s >= 2 ? ' sup' : ''}" data-m="1">✨ Sloučit 4 věže v ${q.s >= 2 ? 'pevnůstku 🏛️' : 'baštu 🏯'}<br><small>${q.s >= 2 ? '9× poškození, +60 % dosah' : '3× poškození, +30 % dosah, silnější aura'}</small></button>`;
    if (v.typ === 'salupa') html += `<button class="plne btn-hl" data-h="1">🧭 Určit místo hlídky<br><small>pak klikni na moře</small></button>`;
    html += `<div class="acts"><button class="btn-up" data-u="1" ${v.uroven >= maxU || h.zlato < cenaU ? 'disabled' : ''}>${v.uroven >= maxU ? 'max. úroveň' : '⬆ ' + cenaU + ' 💰'}</button><button class="btn-sell" data-x="1">Prodat ${S.prodejniCena(v)}</button></div>`;
    p.innerHTML = html;
    p.classList.add('show');
    const c = S.stredVeze(v);
    umistiPanel(c.x * TILE, c.y * TILE);
    p.querySelector('.zav').onclick = zavriPanel;
    p.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { v.priorita = b.dataset.p; otevriPanelVeze(v); uloz(); });
    p.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { S.specializuj(h, v, +b.dataset.s); otevriPanelVeze(v); uloz(); });
    const m = p.querySelector('[data-m]'); if (m) m.onclick = () => { const n = S.slouc(h, S.najdiCtverici(h, v)); st.vybrana = n.id; otevriPanelVeze(n); uloz(); };
    const hl = p.querySelector('[data-h]'); if (hl) hl.onclick = () => { st.hlidka = true; banner('🧭 Klikni na moře, kde má šalupa hlídkovat.'); };
    p.querySelector('[data-u]').onclick = () => { if (S.vylepsi(h, v)) { otevriPanelVeze(v); uloz(); } };
    p.querySelector('[data-x]').onclick = () => { S.prodej(h, v); zavriPanel(); uloz(); };
    p._v = v; p._druh = 'vez';
  }

  function otevriPanelBudovy(kdo) {
    const h = st.hra, p = $('panel');
    st.vybrana = null; st.budova = kdo;
    let b, nazev, popis, x, y;
    if (kdo === 'pevnost') { b = h.pevnost; nazev = '🏰 Pevnost'; popis = 'Hlavní cíl útoku. Když padne, prohráváš. Mezi vlnami se sama opraví o 5. Má vlastní slabé dělo (pěchota a letci do 3 polí).'; x = h.o.pevnost.x + 1; y = h.o.pevnost.y + 1; }
    else if (kdo === 'pristav') { b = h.pristav; nazev = '⚓ Přístav'; popis = 'Po každé vlně +30 💰. Staví se tu šalupy a vyplouvá odsud brander. Lupičské lodě ho chtějí vyloupit.'; x = h.o.pristav.x + 0.5; y = h.o.pristav.y + 0.5; }
    else { const i = +kdo.replace('vesnice', ''); b = h.vesnice[i]; nazev = '🏘️ Vesnice'; popis = 'Po každé vlně +15 💰. Lodě ji mohou ostřelovat.'; x = b.x + 0.5; y = b.y + 0.5; }
    const cena = kdo === 'pevnost' ? 0 : S.cenaObnovy(h, kdo);
    let html = `<button class="zav">✕</button><h3>${nazev}</h3><div class="row">Výdrž <b>${Math.ceil(b.hp)} / ${b.max}</b></div><div class="pozn">${popis}</div>`;
    if (cena) html += `<button class="plne btn-up" data-o="1" ${h.vlnaBezi || h.zlato < cena ? 'disabled' : ''}>${b.hp <= 0 ? '🔨 Obnovit' : '🔨 Opravit'} za ${cena} 💰${h.vlnaBezi ? '<br><small>až po vlně</small>' : ''}</button>`;
    p.innerHTML = html; p.classList.add('show');
    umistiPanel(x * TILE, y * TILE);
    p.querySelector('.zav').onclick = zavriPanel;
    const o = p.querySelector('[data-o]'); if (o) o.onclick = () => { if (S.obnov(h, kdo)) { otevriPanelBudovy(kdo); uloz(); } };
    p._druh = 'budova';
  }

  function otevriPanelPasti(past) {
    const p = $('panel'), d = D.PASTI[past.typ];
    st.vybrana = null; st.budova = null;
    let html = `<button class="zav">✕</button><h3>${d.ikona} ${d.nazev}</h3><div class="pozn">${d.popis}</div>`;
    if (past.typ === 'kuly') html += `<div class="row">Zbývá zásahů <b>${past.uses}</b></div>`;
    if (past.typ === 'retez') html += `<div class="row">Výdrž <b>${Math.ceil(past.hp)}</b></div>`;
    html += `<div class="acts"><button class="btn-sell" data-x="1">Odstranit (vrátí ${Math.floor(d.cena * 0.5)})</button></div>`;
    p.innerHTML = html; p.classList.add('show');
    umistiPanel(past.x * TILE + 12, past.y * TILE + 12);
    p.querySelector('.zav').onclick = zavriPanel;
    p.querySelector('[data-x]').onclick = () => { st.hra.zlato += Math.floor(d.cena * 0.5); S.odeberPast(st.hra, past); zavriPanel(); uloz(); };
    p._druh = 'past';
  }

  /* ================= HUD ================= */
  const posl = {};
  function nastav(id, v) { if (posl[id] !== v) { posl[id] = v; $(id).textContent = v; } }
  function hud() {
    const h = st.hra; if (!h) return;
    nastav('hZlato', Math.floor(h.zlato));
    nastav('hPevnost', Math.ceil(h.pevnost.hp)); nastav('hPevnostMax', '/' + h.pevnost.max);
    nastav('hPristav', h.pristav.hp > 0 ? Math.ceil(h.pristav.hp) : '✖');
    nastav('hVesnice', h.vesnice.filter(v => v.hp > 0).length + '/' + h.vesnice.length);
    nastav('hVlna', h.vlna); nastav('hVlnaMax', h.maxVln === Infinity ? '' : '/' + h.maxVln);
    nastav('hSkore', h.skore);
    const rv = st.rekord && st.rekord.hodnota();
    nastav('hRekord', rv == null ? '–' : rv);
    const P = h.pocasi;
    const ps = `<span title="Vítr ${P.smer}, síla ${P.sila}"><span class="sipka" style="transform:rotate(${(D.SMERY.indexOf(P.smer) * 45)}deg)">⬆</span>${P.sila}</span>` +
      `<span title="${D.PRILIV[P.priliv].nazev}">${P.priliv < 0 ? '🏖️ odliv' : P.priliv > 0 ? '🌊 příliv' : ''}</span>` +
      (P.jev ? `<span title="${D.POCASI[P.jev].popis}">${D.POCASI[P.jev].ikona}</span>` : '') + (P.noc ? '<span title="Noc">🌙</span>' : '');
    if (posl.pocasi !== ps) { posl.pocasi = ps; $('hPocasi').innerHTML = ps; }
    const bv = $('bVlna');
    const lze = !h.vlnaBezi && !h.konec && !h.vyhraOstrova && !!h.dalsi;
    if (bv.disabled === lze) bv.disabled = !lze;
    const at = h.vlnaBezi ? '⚔️ Vlna běží' : '▶️ Vlna ' + (h.vlna + 1);
    nastav('bVlna', at);
    const art = [...h.artefakty].map(a => `<span class="art" title="${D.ARTEFAKTY[a].nazev}: ${D.ARTEFAKTY[a].popis}">${D.ARTEFAKTY[a].ikona}</span>`).join('');
    if (posl.art !== art) { posl.art = art; $('artefakty').innerHTML = art; }
    obnovDostupnost();
  }
  function nahledText() {
    const h = st.hra, n = S.nahled(h);
    if (!n || h.vlnaBezi) { $('nahled').innerHTML = h.vlnaBezi ? '' : ''; return; }
    const P = n.pocasi;
    let t = `🔭 Hlídka hlásí vlnu ${n.n}${n.boss ? ' – <b>BOSS ' + D.NEPRATELE[n.boss].ikona + ' ' + D.NEPRATELE[n.boss].nazev + '</b>' : ''}: ` +
      Object.entries(n.pocty).map(([k, c]) => `<span title="${D.NEPRATELE[k].nazev}">${D.NEPRATELE[k].ikona}×${c}</span>`).join(' ') +
      ` · ${n.presne ? 'ze směru' : 'přibližně od'} <b>${n.smery.join(', ')}</b>`;
    const pc = [];
    if (P.priliv) pc.push(D.PRILIV[P.priliv].ikona + ' ' + D.PRILIV[P.priliv].nazev);
    if (P.jev) pc.push(D.POCASI[P.jev].ikona + ' ' + D.POCASI[P.jev].nazev + ' (' + D.POCASI[P.jev].popis + ')');
    if (P.noc) pc.push('🌙 Noc');
    pc.push('vítr ' + P.smer + ' ' + P.sila);
    t += '<br>' + pc.join(' · ');
    $('nahled').innerHTML = t;
  }
  function banner(text, zly) {
    const b = $('banner');
    b.textContent = text || '';
    b.classList.toggle('zly', !!zly);
    b.classList.remove('pulse'); void b.offsetWidth; if (text) b.classList.add('pulse');
    st.bannerT = text ? 6 : 0;
  }

  /* ================= ovládací tlačítka ================= */
  function spustVlnu() {
    const h = st.hra;
    if (!h || st.okno) return;
    Z.init();
    if (S.spustVlnu(h)) { zavriPanelPokudNeniVez(); nahledText(); }
  }
  function zavriPanelPokudNeniVez() { if ($('panel')._druh === 'budova') zavriPanel(); }
  function prepniRychlost() { st.pauza = false; st.rychlost = st.rychlost >= 3 ? 1 : st.rychlost + 1; obnovRychlost(); }
  function obnovRychlost() { $('bRychlost').textContent = st.pauza ? '⏸ pauza' : '⏩ ' + st.rychlost + '×'; $('bRychlost').classList.toggle('on', st.pauza); }
  function prepniZvuk() { Z.init(); const z = Z.prepni(); $('bZvuk').textContent = z ? '🔇' : '🔊'; try { localStorage.setItem('webapp_hra_obleheni_zvuk', z ? '0' : '1'); } catch { } }
  $('bVlna').onclick = spustVlnu;
  $('bRychlost').onclick = prepniRychlost;
  $('bZvuk').onclick = prepniZvuk;
  $('bAuto').onclick = () => { st.auto = !st.auto; $('bAuto').classList.toggle('on', st.auto); st.autoT = 2; };
  $('bMenu').onclick = () => { zavriPanel(); oknoMenu(); };
  function prepniZalozku(z) {
    st.zalozka = z;
    for (const b of $('zalozky').children) b.classList.toggle('on', b.dataset.z === z);
    vykresliObchod();
  }
  $('zalozky').onclick = ev => { const z = ev.target.dataset && ev.target.dataset.z; if (z) prepniZalozku(z); };
  $('vrstvy').onclick = ev => {
    const v = ev.target.dataset && ev.target.dataset.v; if (v == null) return;
    st.vrstva = v;
    for (const b of $('vrstvy').querySelectorAll('button')) b.classList.toggle('on', b.dataset.v === v);
  };

  /* ================= ukládání ================= */
  function uloz() {
    const h = st.hra;
    if (!h || h.konec || h.vlnaBezi) return;
    try { localStorage.setItem(KLIC_ULOZENI, JSON.stringify({ kampan: st.kampan, hra: S.serializuj(h), cekaArtefakt: st.cekaArtefakt })); } catch { }
  }
  function nactiUlozenou() { try { const z = JSON.parse(localStorage.getItem(KLIC_ULOZENI)); return z && z.hra && z.hra.verze === 1 ? z : null; } catch { return null; } }
  function smazUlozenou() { try { localStorage.removeItem(KLIC_ULOZENI); } catch { } }

  /* ================= zahájení hry ================= */
  function zacni(opt, kampan) {
    st.hra = S.nova(opt);
    st.kampan = kampan || null;
    po_zacatku();
    uloz();
  }
  function po_zacatku() {
    const h = st.hra;
    st.efekty = []; st.castice = []; st.texty = []; st.stavba = null; st.arm = null; st.cekaArtefakt = false;
    st.poskozeniPevnosti = {}; st.pozadiKlic = '';
    st.rekord = rekordRezimu(h.rezim);
    zavriOkno(); zavriPanel();
    const B = D.BIOMY[h.biom];
    banner(`${B.ikona} ${B.nazev} ${OBL.kodSeedu(h.seed)} – postav obranu a spusť vlnu.`);
    nahledText(); hud(); vykresliSchopnosti(); prepniZalozku(st.zalozka);
  }

  /* ================= okna ================= */
  function zavriOkno() { $('okno').classList.remove('show'); $('okno').innerHTML = ''; st.okno = null; }
  function okno(druh, html) { const o = $('okno'); o.innerHTML = html; o.classList.add('show'); st.okno = druh; o.scrollTop = 0; return o; }

  function oknoMenu() {
    const ulozena = nactiUlozenou();
    const R = st.rezimMenu, O = st.obtMenu;
    if (st.menuSeed == null) st.menuSeed = Math.floor(Math.random() * 1073741824);
    const dnes = OBL.seedDne(new Date());
    const seed = R === 'den' ? dnes : st.menuSeed;
    const o = okno('menu', `
      <h2>🏝️ Ostrov v obležení</h2>
      <p>Braň ostrov proti lodím, výsadkům, letcům a mořským příšerám. Ostrov se generuje ze seedu: stejný kód = stejný ostrov.</p>
      <div class="radek" id="mRezim">
        <button class="volba ${R === 'kampan' ? 'on' : ''}" data-r="kampan">🗺️ Souostroví<small>8 ostrovů po 10 vlnách, bossové, artefakty</small></button>
        <button class="volba ${R === 'nekonecna' ? 'on' : ''}" data-r="nekonecna">♾️ Nekonečná obrana<small>jeden ostrov, vlny bez konce</small></button>
        <button class="volba ${R === 'den' ? 'on' : ''}" data-r="den">📅 Ostrov dne<small>15 vln, pro všechny stejný</small></button>
      </div>
      <div class="radek" id="mObt">${Object.entries(D.OBTIZNOSTI).map(([k, d]) => `<button class="volba ${O === k ? 'on' : ''}" data-o="${k}">${d.ikona} ${d.nazev}<small>pevnost ${d.pevnost}, ${d.zlato} 💰</small></button>`).join('')}</div>
      <div class="seedrow">${R === 'den' ? 'Dnešní ostrov' : R === 'kampan' ? 'Kód souostroví' : 'Kód ostrova'}:
        <input id="mSeed" value="${OBL.kodSeedu(seed)}" maxlength="12" ${R === 'den' ? 'disabled' : ''}>
        ${R !== 'den' ? '<button id="mNahodny" title="Jiný ostrov">🎲</button>' : ''}
        ${R === 'nekonecna' ? `<select id="mBiom">${Object.entries(D.BIOMY).map(([k, b]) => `<option value="${k}" ${st.menuBiom === k ? 'selected' : ''}>${b.ikona} ${b.nazev}</option>`).join('')}</select>` : ''}
      </div>
      <canvas id="nahledOstrova" width="384" height="288"></canvas>
      <div class="radek">
        <button class="tl" id="mStart">▶ Začít</button>
        ${ulozena ? `<button class="tl druhe" id="mPokracuj">⏯ Pokračovat (${ulozena.hra.rezim === 'kampan' ? 'souostroví' : ulozena.hra.rezim === 'den' ? 'ostrov dne' : 'nekonečná'}, vlna ${ulozena.hra.vlna})</button>` : ''}
        ${st.hra && !st.hra.konec && !st.hra.ukazka ? '<button class="tl druhe" id="mZpet">↩ Zpět do hry</button>' : ''}
      </div>`);
    const kreslNahled = () => {
      const s = OBL.seedZKodu($('mSeed').value);
      if (s == null) return;
      let biom = 'tropy';
      if (R === 'nekonecna') biom = $('mBiom').value;
      else if (R === 'den') biom = D.KLICE_BIOMU[s % D.KLICE_BIOMU.length];
      else biom = OBL.kampan.nova(s, O).uzly[0].biom;
      const ost = R === 'kampan' ? Os.generuj(OBL.kampan.nova(s, O).uzly[0].seed, biom) : Os.generuj(s, biom);
      const c = $('nahledOstrova'), g = c.getContext('2d');
      g.drawImage(G.vykresliPozadi(ost, 0, c.width / MW), 0, 0);
      g.fillStyle = '#fff'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('🏰', (ost.pevnost.x + 1) * TILE * c.width / MW, (ost.pevnost.y + 1) * TILE * c.width / MW);
    };
    kreslNahled();
    o.querySelector('#mRezim').onclick = ev => { const b = ev.target.closest('[data-r]'); if (b) { st.rezimMenu = b.dataset.r; oknoMenu(); } };
    o.querySelector('#mObt').onclick = ev => { const b = ev.target.closest('[data-o]'); if (b) { st.obtMenu = b.dataset.o; oknoMenu(); } };
    const nah = $('mNahodny'); if (nah) nah.onclick = () => { st.menuSeed = Math.floor(Math.random() * 1073741824); oknoMenu(); };
    $('mSeed').onchange = () => { const s = OBL.seedZKodu($('mSeed').value); if (s != null) { st.menuSeed = s; kreslNahled(); } };
    const bi = $('mBiom'); if (bi) bi.onchange = () => { st.menuBiom = bi.value; kreslNahled(); };
    $('mStart').onclick = () => {
      Z.init();
      const s = OBL.seedZKodu($('mSeed').value) ?? st.menuSeed;
      smazUlozenou();
      if (R === 'kampan') { st.kampan = OBL.kampan.nova(s, O); oknoSouostrovi(); return; }
      if (R === 'den') zacni({ seed: s, biom: D.KLICE_BIOMU[s % D.KLICE_BIOMU.length], obtiznost: 'normalni', rezim: 'den', maxVln: 15, ostrovIndex: 1 });
      else zacni({ seed: s, biom: $('mBiom').value, obtiznost: O, rezim: 'nekonecna' });
    };
    const pk = $('mPokracuj'); if (pk) pk.onclick = () => {
      Z.init();
      st.hra = S.obnovZeZaznamu(ulozena.hra); st.kampan = ulozena.kampan || null;
      po_zacatku();
      if (ulozena.cekaArtefakt) { st.cekaArtefakt = true; oknoArtefakt(); }
      else if (st.hra.vyhraOstrova) poVyhreOstrova();
    };
    const zp = $('mZpet'); if (zp) zp.onclick = zavriOkno;
  }

  function oknoSouostrovi() {
    const k = st.kampan, dost = OBL.kampan.dostupne(k).map(u => u.id);
    const Wv = 560, Hv = 315, pos = u => ({ x: 40 + u.vrstva * (Wv - 80) / 7, y: u.n === 1 ? Hv / 2 : Hv / 2 + (u.i - 0.5) * 140 });
    let svg = `<svg class="mapaSouostrovi" viewBox="0 0 ${Wv} ${Hv}">`;
    svg += `<rect width="${Wv}" height="${Hv}" rx="10" fill="#0d4a73"/>`;
    for (const [a, b] of OBL.kampan.hrany(k)) {
      const A = pos(k.uzly[a]), B = pos(k.uzly[b]);
      const prosla = k.cesta.includes(a) && (k.cesta.includes(b) || k.aktualni === b);
      svg += `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="${prosla ? '#f5cd79' : 'rgba(255,255,255,.25)'}" stroke-width="${prosla ? 3 : 1.5}" stroke-dasharray="${prosla ? '' : '5 4'}"/>`;
    }
    for (const u of k.uzly) {
      const P = pos(u), B = D.BIOMY[u.biom], hotovy = k.cesta.includes(u.id), lze = dost.includes(u.id);
      svg += `<g class="uzel ${lze ? 'dostupny' : ''}" data-u="${u.id}">
        <circle cx="${P.x}" cy="${P.y}" r="${lze ? 24 : 20}" fill="${hotovy ? '#2e7d32' : lze ? '#d4a017' : '#3b5a6e'}" stroke="${lze ? '#fff' : '#9fb7c9'}" stroke-width="${lze ? 3 : 1.5}"/>
        <text x="${P.x}" y="${P.y + 6}" text-anchor="middle" font-size="18">${B.ikona}</text>
        <text x="${P.x}" y="${P.y + 38}" text-anchor="middle" font-size="9.5" fill="#dfe8ef">${B.nazev.split(' ')[0]} · ${D.NEPRATELE[u.boss].ikona}</text></g>`;
    }
    svg += '</svg>';
    const o = okno('souostrovi', `<h2>🗺️ Souostroví</h2>
      <p>Vyber další ostrov (zlatě). Každý má 10 vln a bosse (ikona pod ostrovem). Přenášíš artefakty, skóre a 30 % zlata (nejvýš 300).</p>
      ${svg}
      <p>Artefakty: ${k.artefakty.length ? k.artefakty.map(a => D.ARTEFAKTY[a].ikona + ' ' + D.ARTEFAKTY[a].nazev).join(', ') : 'zatím žádné'} · skóre ${k.skore}</p>
      <div class="radek"><button class="tl druhe" id="sMenu">☰ Nabídka</button></div>`);
    o.querySelectorAll('.uzel.dostupny').forEach(g => g.onclick = () => {
      const u = k.uzly[+g.dataset.u];
      k.aktualni = u.id;
      zacni(OBL.kampan.hraProUzel(k, u), k);
    });
    $('sMenu').onclick = oknoMenu;
  }

  function oknoArtefakt() {
    const h = st.hra;
    const nab = OBL.kampan.nabidkaArtefaktu(st.kampan, OBL.hash(h.seed, h.vlna), [...h.artefakty]);
    if (!nab.length) { st.cekaArtefakt = false; return poArtefaktu(null); }
    const o = okno('artefakt', `<h2>👑 Boss poražen!</h2><p>Vyber si trvalý artefakt:</p>
      <div class="radek">${nab.map(a => `<button class="volba" data-a="${a}">${D.ARTEFAKTY[a].ikona} ${D.ARTEFAKTY[a].nazev}<small>${D.ARTEFAKTY[a].popis}</small></button>`).join('')}</div>`);
    o.querySelectorAll('[data-a]').forEach(b => b.onclick = () => poArtefaktu(b.dataset.a));
  }
  function poArtefaktu(a) {
    const h = st.hra;
    st.cekaArtefakt = false;
    if (a) {
      h.artefakty.add(a);
      if (a === 'kamen') { h.pevnost.max += 20; h.pevnost.hp += 20; }
      banner(D.ARTEFAKTY[a].ikona + ' ' + D.ARTEFAKTY[a].nazev + ': ' + D.ARTEFAKTY[a].popis);
    }
    zavriOkno();
    if (h.vyhraOstrova) poVyhreOstrova(a);
    else uloz();
  }
  function poVyhreOstrova(art) {
    const h = st.hra;
    if (h.rezim === 'kampan' && st.kampan) {
      OBL.kampan.ostrovDobyt(st.kampan, h, art || null);
      if (st.kampan.hotovo) { if (st.rekord) st.rekord.zapis(h.skore); smazUlozenou(); oknoKonec('kampan'); }
      else { try { localStorage.setItem(KLIC_ULOZENI, JSON.stringify({ kampan: st.kampan, hra: S.serializuj(h), cekaArtefakt: false })); } catch { } oknoSouostrovi(); }
    } else { if (st.rekord) st.rekord.zapis(h.skore); smazUlozenou(); oknoKonec('vyhra'); }
  }

  function radyCoDal() {
    const h = st.hra, p = st.poskozeniPevnosti, r = [];
    const podle = {};
    for (const [t, v] of Object.entries(p)) { const d = D.NEPRATELE[t]; if (d) podle[d.druh === 'tvor' ? 'lod' : d.druh] = (podle[d.druh] || 0) + v; }
    const hlavni = Object.entries(podle).sort((a, b) => b[1] - a[1])[0];
    if (hlavni && hlavni[0] === 'vzduch') r.push('🦅 Pevnost padla hlavně kvůli letcům. Postav u pevnosti 🎯 balisty a 🎖️ mušketýry. Věže vedle 🏮 majáku střílí na letce také.');
    if (hlavni && hlavni[0] === 'pesi') r.push('⚔️ Pevnost zničila pěchota. Podél cest postav 🏹 strážní věže a 💣 moždíře a na cesty dej 🪵 zátarasy. Výsadky zastavíš dřív, když 💥 děla u pláží potopí lodě ještě na moři.');
    if (hlavni && hlavni[0] === 'lod') r.push('🐙 Pevnost ostřelovala příšera z moře. Proti krakenovi pomůže 🏮 maják (odhalí ho) a 💥 pobřežní děla.');
    if (h.pristav.hp <= 0) r.push('⚓ Přišel jsi o přístav. Pobřežní děla na útesech u přístavu a ⛓️ řetězová závora ve vjezdu ho ochrání.');
    if (!h.veze.some(v => v.typ === 'majak') && h.vlna >= 8) r.push('🏮 Nemáš maják. Bez něj nevidíš mořské hady, krakena ani přízračné lodě v mlze.');
    if (h.veze.length < 6) r.push('🏗️ Staveb bylo málo. Zlato za plantáže a vesnice se vyplatí utratit hned.');
    if (!r.length) r.push('🔁 Zkus stejný ostrov znovu (stejný kód): už víš, odkud útoky přijdou.');
    return r;
  }

  function oknoKonec(druh) {
    const h = st.hra;
    const nadpis = druh === 'prohra' ? '<h2 class="prohra">💥 Pevnost padla</h2>' : druh === 'kampan' ? '<h2>🏆 Souostroví ubráněno!</h2>' : '<h2>🏝️ Ostrov ubráněn!</h2>';
    const rady = druh === 'prohra' ? `<p><b>Co dál?</b><br>${radyCoDal().join('<br>')}</p>` : '';
    const o = okno('konec', `${nadpis}
      <p>${h.rezim === 'kampan' && st.kampan ? 'Ostrov ' + (h.ostrovIndex + 1) + '/8 · ' : ''}vlna <b>${h.vlna}</b> · skóre <b>${h.skore}</b> · zabito <b>${h.stat.zabito}</b> · ukradeno ${h.stat.ukradeno} 💰</p>
      ${rady}
      <div class="radek">
        ${druh === 'prohra' && h.rezim !== 'kampan' ? '<button class="tl" id="kZnovu">🔄 Stejný ostrov znovu</button>' : ''}
        ${druh === 'prohra' && h.rezim === 'kampan' ? '<button class="tl" id="kZnovuO">🔄 Tento ostrov znovu</button>' : ''}
        <button class="tl druhe" id="kMenu">☰ Nabídka</button>
      </div>`);
    const z = $('kZnovu'); if (z) z.onclick = () => zacni({ seed: h.seed, biom: h.biom, obtiznost: h.obtiznost, rezim: h.rezim, maxVln: h.maxVln, ostrovIndex: h.ostrovIndex });
    const zo = $('kZnovuO'); if (zo) zo.onclick = () => { const u = st.kampan.uzly[st.kampan.aktualni]; zacni(OBL.kampan.hraProUzel(st.kampan, u), st.kampan); };
    $('kMenu').onclick = oknoMenu;
  }

  /* ================= události simulace → efekty, zvuky ================= */
  const px = v => v * TILE;
  function castice(x, y, n, barva, rych, zivot, gravit, vel) {
    if (st.castice.length > 700) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = rych * (0.3 + Math.random() * 0.7);
      st.castice.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: zivot * (0.6 + Math.random() * 0.4), T: zivot, barva, g: gravit || 0, r: vel || 1.5 });
    }
  }
  function text(x, y, t, barva, vel) { if (st.texty.length < 60) st.texty.push({ x, y, t, barva, vel: vel || 9, z: 1.2 }); }
  function efekt(e) { if (st.efekty.length < 200) st.efekty.push(e); }

  function zpracujUdalosti() {
    const h = st.hra; if (!h) return;
    const U = h.udalosti; h.udalosti = [];
    for (const u of U) {
      switch (u.t) {
        case 'vystrel': {
          Z.hraj(u.typ);
          if (u.typ === 'musket' || u.typ === 'pevnost') efekt({ d: 'stopa', x1: px(u.x), y1: px(u.y), x2: px(u.tx || u.x), y2: px(u.ty || u.y), t: 0.08, T: 0.08, barva: '255,240,180' });
          if (u.typ === 'delo' || u.typ === 'salupa' || u.typ === 'mozdir') castice(px(u.x), px(u.y), 4, 'rgba(200,200,200,.7)', 14, 0.5, 0, 2.2);
          break;
        }
        case 'blesk': Z.hraj('blesk'); efekt({ d: 'blesk', body: u.body.map(b => [px(b.x), px(b.y)]), t: 0.18, T: 0.18 }); break;
        case 'vybuch':
          Z.hraj(u.voda && !u.male ? 'splouch' : 'vybuch', u.velky);
          efekt({ d: 'kruh', x: px(u.x), y: px(u.y), r: px(u.r || 0.6), t: 0.35, T: 0.35, barva: u.voda ? '220,240,255' : '255,180,80' });
          castice(px(u.x), px(u.y), u.male ? 5 : 12, u.voda ? 'rgba(220,240,255,.9)' : 'rgba(255,170,60,.9)', u.voda ? 30 : 45, 0.5, u.voda ? 60 : 0, 1.8);
          if (u.velky) st.otres = Math.max(st.otres, 4);
          break;
        case 'smrt': {
          const X = px(u.x), Y = px(u.y);
          if (u.druh === 'lod' || u.druh === 'tvor') { Z.hraj('smrtLod'); efekt({ d: 'potopeni', x: X, y: Y, t: 1.4, T: 1.4 }); castice(X, Y, 10, 'rgba(110,80,50,.9)', 25, 1, 0, 2); }
          else if (u.druh === 'vzduch') { Z.hraj('smrt'); castice(X, Y, 10, 'rgba(160,130,100,.9)', 20, 1.2, 25, 1.4); }
          else { Z.hraj('smrt'); castice(X, Y, 5, 'rgba(180,40,30,.8)', 15, 0.4, 0, 1.2); }
          if (u.zlato) { text(X, Y - 6, '+' + u.zlato, '#f1c40f', 8); Z.hraj('zlato'); }
          if (u.boss) { st.otres = 8; banner('👑 ' + D.NEPRATELE[u.typ].nazev + ' poražen!'); }
          break;
        }
        case 'budova':
          Z.hraj('budova');
          castice(px(u.x) + (Math.random() - 0.5) * 12, px(u.y) + (Math.random() - 0.5) * 12, 5, 'rgba(255,160,60,.9)', 25, 0.4, 0, 1.6);
          if (u.pevnost) { st.otres = Math.max(st.otres, 2.5); if (u.odkud && u.odkud.typ) st.poskozeniPevnosti[u.odkud.typ] = (st.poskozeniPevnosti[u.odkud.typ] || 0) + u.dmg; }
          break;
        case 'ostrel': efekt({ d: 'oblouk', sx: px(u.x), sy: px(u.y), tx: px(u.tx), ty: px(u.ty), t: 0.6, T: 0.6, kraken: u.kraken }); castice(px(u.x), px(u.y), 3, 'rgba(220,220,220,.7)', 10, 0.6, 0, 2.4); break;
        case 'utok': if (u.strela) efekt({ d: 'stopa', x1: px(u.x), y1: px(u.y), x2: px(u.tx), y2: px(u.ty), t: 0.08, T: 0.08, barva: '255,220,160' }); break;
        case 'vysadek': Z.hraj('zvon'); efekt({ d: 'kruh', x: px(u.x), y: px(u.y), r: 14, t: 0.6, T: 0.6, barva: '255,90,60' }); break;
        case 'banner': banner(u.text, u.zly); if (u.znicena) { Z.hraj('vybuch', true); st.otres = 4; } break;
        case 'povyseni': text(px(u.x), px(u.y) - 12, '🎖️ ' + u.h, '#ffe97a', 9); Z.hraj('povyseni'); break;
        case 'loupez': text(px(u.x), px(u.y) - 8, '−' + u.n + ' 💰', '#e74c3c', 10); Z.hraj('loupez'); banner('🏴‍☠️ Lupiči vyloupili přístav: −' + u.n + ' 💰', true); break;
        case 'dech': Z.hraj('dech'); castice(px(u.x), px(u.y), 16, 'rgba(255,120,30,.9)', 40, 0.5, 0, 2.2); break;
        case 'chapadlo': efekt({ d: 'kruh', x: px(u.x), y: px(u.y), r: 16, t: 0.7, T: 0.7, barva: '155,89,182' }); break;
        case 'teleport': efekt({ d: 'kruh', x: px(u.x), y: px(u.y), r: 20, t: 0.6, T: 0.6, barva: '26,188,156' }); break;
        case 'harpyje': Z.hraj('harpyje'); break;
        case 'stit': efekt({ d: 'kruh', x: px(u.x), y: px(u.y), r: px(1.5), t: 0.5, T: 0.5, barva: '120,200,255' }); break;
        case 'stitZasah': castice(px(u.x), px(u.y), 3, 'rgba(120,200,255,.9)', 20, 0.3); break;
        case 'krit': text(px(u.x), px(u.y) - 10, 'KRIT!', '#ff7bff', 8); break;
        case 'saper': text(px(u.x), px(u.y) - 8, '🪓', '#fff', 10); break;
        case 'zapaleni': Z.hraj('kotel'); break;
        case 'stavba': Z.hraj('stavba'); castice(px(u.x), px(u.y), 8, 'rgba(200,180,140,.8)', 20, 0.5); break;
        case 'vylepseni': Z.hraj('vylepseni'); castice(px(u.x), px(u.y), 10, 'rgba(255,230,120,.9)', 25, 0.6); break;
        case 'prodej': Z.hraj('prodej'); text(px(u.x), px(u.y), '+' + u.n, '#f1c40f', 9); break;
        case 'slouceni': Z.hraj('vylepseni'); castice(px(u.x), px(u.y), 30, u.sup ? 'rgba(200,150,255,.9)' : 'rgba(241,196,15,.9)', 60, 0.8); st.otres = 3; break;
        case 'salva': Z.hraj('salva'); for (let j = 0; j < 5; j++) setTimeout(() => { const X = px(u.x) + (Math.random() - 0.5) * 30, Y = px(u.y) + (Math.random() - 0.5) * 30; efekt({ d: 'kruh', x: X, y: Y, r: 16, t: 0.4, T: 0.4, barva: '255,200,120' }); castice(X, Y, 10, 'rgba(255,170,60,.9)', 40, 0.5); }, j * 110); st.otres = 5; break;
        case 'brander': banner('🔥 Brander vyplul z přístavu!'); break;
        case 'zpev': Z.hraj('zpev'); efekt({ d: 'zablesk', t: 0.6, T: 0.6, barva: '150,200,255' }); banner('🌪️ Bouřný zpěv: lodě, tvorové a letci stojí 4 s.'); break;
        case 'vlna': Z.hraj('vlna', u.boss); banner((u.boss ? '⚠️ BOSS! ' : '') + 'Vlna ' + u.n + ' útočí!', u.boss); nahledText(); break;
        case 'boss': st.cekaArtefakt = true; break;
        case 'konecVlny':
          Z.hraj('konecVlny');
          banner('✅ Vlna ' + u.n + ' odražena! Příjem +' + u.prijem + ' 💰' + (u.polozky.length ? ' (' + u.polozky.join(', ') + ')' : ''));
          if (h.rezim === 'nekonecna' && st.rekord) st.rekord.zapis(u.n);
          nahledText();
          st.autoT = 2.5;
          if (st.cekaArtefakt) oknoArtefakt();
          uloz();
          break;
        case 'vyhra':
          Z.hraj('vyhra');
          nahledText();
          if (st.cekaArtefakt) oknoArtefakt(); else poVyhreOstrova(null);
          break;
        case 'prohra':
          Z.hraj('prohra'); st.otres = 10;
          if (st.rekord) st.rekord.zapis(h.rezim === 'nekonecna' ? h.vlna - 1 : h.skore);
          smazUlozenou();
          setTimeout(() => oknoKonec('prohra'), 900);
          break;
      }
    }
  }

  /* ================= kreslení ================= */
  function kresli(dt) {
    const h = st.hra;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!h) { ctx.fillStyle = '#0b3d63'; ctx.fillRect(0, 0, cv.width, cv.height); return; }
    const k = st.k, cas = st.casAnim;
    let ox = 0, oy = 0;
    if (st.otres > 0) { ox = (Math.random() - 0.5) * st.otres; oy = (Math.random() - 0.5) * st.otres; st.otres = Math.max(0, st.otres - dt * 20); }
    ctx.drawImage(pozadi(), ox * k, oy * k);
    ctx.setTransform(k, 0, 0, k, ox * k, oy * k);
    vlnky(h, cas);
    vrstvy(h);
    for (const p of h.pasti) G.kresliPast(ctx, p, cas);
    G.kresliPristav(ctx, h, cas);
    h.vesnice.forEach((v, i) => G.kresliVesnici(ctx, v, cas, i));
    G.kresliPevnost(ctx, h, cas);
    nastupy(h, cas);
    const majaky = S.majakyHry(h);
    const pesi = [], more = [], vzduch = [];
    for (const e of h.nepratele) (e.druh === 'vzduch' ? vzduch : e.druh === 'pesi' ? pesi : more).push(e);
    for (const e of more) G.kresliNepritele(ctx, e, cas, h, S.viditelny(h, e, majaky));
    const veze = h.veze.slice().sort((a, b) => a.y - b.y);
    for (const v of veze) G.kresliVez(ctx, v, cas, v.id === st.vybrana);
    for (const e of pesi) G.kresliNepritele(ctx, e, cas, h, true);
    G.kresliStrely(ctx, h);
    efekty(dt);
    for (const e of vzduch) G.kresliNepritele(ctx, e, cas, h, true);
    // noc a mlha
    if (h.pocasi.noc) {
      ctx.fillStyle = 'rgba(8,14,40,.38)'; ctx.fillRect(0, 0, MW, MH);
      ctx.globalCompositeOperation = 'lighter';
      for (const m of majaky) { const g = ctx.createRadialGradient(px(m.x), px(m.y), 2, px(m.x), px(m.y), px(m.r)); g.addColorStop(0, 'rgba(255,230,150,.22)'); g.addColorStop(1, 'rgba(255,230,150,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px(m.x), px(m.y), px(m.r), 0, 7); ctx.fill(); }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (h.pocasi.jev === 'mlha') {
      for (let j = 0; j < 6; j++) {
        const x = ((cas * 8 + j * 170) % (MW + 300)) - 150, y = (j * 97) % MH;
        const g = ctx.createRadialGradient(x, y, 10, x, y, 160); g.addColorStop(0, 'rgba(225,230,235,.22)'); g.addColorStop(1, 'rgba(225,230,235,0)');
        ctx.fillStyle = g; ctx.fillRect(x - 160, y - 160, 320, 320);
      }
      ctx.fillStyle = 'rgba(210,215,220,.12)'; ctx.fillRect(0, 0, MW, MH);
    }
    if (h.pocasi.jev === 'boure' && h.vlnaBezi) {
      ctx.strokeStyle = 'rgba(180,200,230,.25)'; ctx.lineWidth = 0.8;
      const u = D.SMER_UHEL(h.pocasi.smer);
      for (let j = 0; j < 40; j++) { const x = (j * 61 + cas * 300) % MW, y = (j * 37 + cas * 500) % MH; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(u) * 4 - 2, y + 9); ctx.stroke(); }
    }
    if (h.zmrazeno > 0) { ctx.fillStyle = 'rgba(150,200,255,.12)'; ctx.fillRect(0, 0, MW, MH); }
    nahledStavby(h);
    texty(dt);
  }

  // jemné animované vlnky po moři
  function vlnky(h, cas) {
    const o = h.o;
    ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.lineWidth = 0.8;
    for (let i = 0; i < Os.N; i += 3) {
      if (o.ter[i] !== Os.T.MORE) continue;
      const x = i % Os.W, y = (i / Os.W) | 0;
      const f = (cas * 0.25 + ((x * 7 + y * 13) % 10) / 10) % 1;
      const a = Math.sin(f * Math.PI);
      if (a < 0.2) continue;
      ctx.globalAlpha = a;
      const X = x * TILE + 6 + ((x * 5 + y * 3) % 12), Y = y * TILE + 8 + ((x * 11 + y * 7) % 10);
      ctx.beginPath(); ctx.arc(X, Y + f * 3, 4, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // body nástupu: šedé značky, šipky u těch, odkud přijde další vlna
  function nastupy(h, cas) {
    const n = S.nahled(h), aktivni = new Set(n && n.presne ? n.smery : []);
    for (const s of h.o.nastupy) {
      const X = px(s.x + 0.5), Y = px(s.y + 0.5), u = Math.atan2(Os.H / 2 - s.y, Os.W / 2 - s.x);
      const akt = aktivni.has(s.smer) && !h.vlnaBezi;
      ctx.save(); ctx.translate(X, Y); ctx.rotate(u);
      ctx.fillStyle = akt ? `rgba(231,76,60,${0.65 + Math.sin(cas * 5) * 0.3})` : 'rgba(255,255,255,.25)';
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-4, -7); ctx.lineTo(-1, 0); ctx.lineTo(-4, 7); ctx.fill();
      ctx.restore();
      ctx.fillStyle = akt ? '#fff' : 'rgba(255,255,255,.4)'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(s.smer, X - Math.cos(u) * 2, Y - Math.sin(u) * 2 + (s.y === 0 ? 8 : s.y === Os.H - 1 ? -8 : 0) + 0);
    }
  }

  function vrstvy(h) {
    const o = h.o, v = st.vrstva;
    if (!v) return;
    ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (v === 'hloubka' || v === 'lode') {
      const pr = h.pocasi.priliv;
      for (let i = 0; i < Os.N; i++) {
        if (!Os.jeVodaT(o.ter[i])) continue;
        const x = i % Os.W, y = (i / Os.W) | 0, d = o.hl[i] + pr;
        if (v === 'hloubka') { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillText(Math.max(0, d), x * TILE + 12, y * TILE + 12); }
        else {
          const c = d >= 3 ? 'rgba(46,204,113,.28)' : d >= 2 ? 'rgba(241,196,15,.3)' : d >= 1 ? 'rgba(231,76,60,.3)' : 'rgba(0,0,0,.35)';
          ctx.fillStyle = c; ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        }
      }
      if (v === 'lode') { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(4, MH - 20, 380, 16); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText('🟩 všechny lodě  🟨 brigy a čluny  🟥 jen čluny a tvorové  ⬛ suché', 8, MH - 12); }
    } else if (v === 'dostrel') {
      for (const t of h.veze) {
        const d = D.VEZE[t.typ]; if (d.podpora && t.typ !== 'majak') continue;
        const s = S.staty(h, t), c = S.stredVeze(t);
        ctx.fillStyle = t.typ === 'majak' ? 'rgba(255,230,120,.07)' : 'rgba(106,166,253,.07)'; ctx.strokeStyle = t.typ === 'majak' ? 'rgba(255,230,120,.4)' : 'rgba(106,166,253,.35)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.arc(px(c.x), px(c.y), px(s.dosah), 0, 7); ctx.fill(); ctx.stroke();
      }
    }
  }

  function nahledStavby(h) {
    // dosah vybrané věže
    const v = st.vybrana && h.veze.find(t => t.id === st.vybrana);
    if (v && !D.VEZE[v.typ].podpora || v && v.typ === 'majak') {
      const s = S.staty(h, v), c = S.stredVeze(v);
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.arc(px(c.x), px(c.y), px(s.dosah), 0, 7); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      if (v.typ === 'salupa') { ctx.strokeStyle = 'rgba(46,134,222,.8)'; ctx.beginPath(); ctx.arc(px(v.hlidka.x + 0.5), px(v.hlidka.y + 0.5), px(4.5), 0, 7); ctx.stroke(); ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🧭', px(v.hlidka.x + 0.5), px(v.hlidka.y + 0.5)); }
    }
    const hv = st.hover;
    if (!hv) return;
    if (st.arm === 'salva') { ctx.strokeStyle = 'rgba(255,150,60,.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px(hv.fx), px(hv.fy), px(1.6), 0, 7); ctx.stroke(); return; }
    if (!st.stavba || !Os.uvnitr(hv.x, hv.y)) return;
    const k = st.stavba, m = jePast(k) ? S.lzePast(h, k, hv.x, hv.y) : S.lzeStavet(h, k, hv.x, hv.y);
    // mřížka kolem kurzoru
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 0.5;
    for (let y = hv.y - 3; y <= hv.y + 3; y++) for (let x = hv.x - 3; x <= hv.x + 3; x++) if (Os.uvnitr(x, y)) ctx.strokeRect(x * TILE, y * TILE, TILE, TILE);
    ctx.fillStyle = m.ok ? 'rgba(46,204,113,.35)' : 'rgba(231,76,60,.35)';
    ctx.fillRect(hv.x * TILE, hv.y * TILE, TILE, TILE);
    const d = D.VEZE[k];
    if (d && d.dosah && m.ok) {
      const fake = { typ: k, x: hv.x, y: hv.y, w: 1, uroven: 1, spec: null, xp: 0, id: -1 };
      const s = S.staty(h, fake);
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.arc(px(hv.x + 0.5), px(hv.y + 0.5), px(s.dosah), 0, 7); ctx.stroke(); ctx.setLineDash([]);
    }
    if (d) { ctx.globalAlpha = 0.6; G.kresliVez(ctx, { typ: k, x: hv.x, y: hv.y, w: 1, uroven: 1, spec: null, xp: 0, id: -1, uhel: -1.2, vyrazena: 0 }, st.casAnim, false); ctx.globalAlpha = 1; }
  }

  function efekty(dt) {
    for (const e of st.efekty) e.t -= dt;
    st.efekty = st.efekty.filter(e => e.t > 0);
    for (const e of st.efekty) {
      const f = e.t / e.T;
      switch (e.d) {
        case 'stopa': ctx.strokeStyle = `rgba(${e.barva},${f})`; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke(); break;
        case 'blesk':
          ctx.strokeStyle = `rgba(220,180,255,${f})`; ctx.lineWidth = 1.6; ctx.beginPath();
          e.body.forEach(([x, y], i) => { if (!i) ctx.moveTo(x, y); else { const [a, b] = e.body[i - 1]; ctx.lineTo((a + x) / 2 + (Math.random() - 0.5) * 6, (b + y) / 2 + (Math.random() - 0.5) * 6); ctx.lineTo(x, y); } });
          ctx.stroke(); ctx.strokeStyle = `rgba(255,255,255,${f})`; ctx.lineWidth = 0.6; ctx.stroke();
          break;
        case 'kruh': ctx.strokeStyle = `rgba(${e.barva},${f})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (1.3 - f * 0.6), 0, 7); ctx.stroke(); break;
        case 'oblouk': {
          const q = 1 - f, x = e.sx + (e.tx - e.sx) * q, y = e.sy + (e.ty - e.sy) * q - Math.sin(q * Math.PI) * 18;
          ctx.fillStyle = e.kraken ? '#7f8c8d' : '#111'; ctx.beginPath(); ctx.arc(x, y, e.kraken ? 3 : 1.8, 0, 7); ctx.fill();
          if (f < 0.06) castice(e.tx, e.ty, 6, 'rgba(255,170,60,.9)', 30, 0.4);
          break;
        }
        case 'potopeni': ctx.strokeStyle = `rgba(255,255,255,${f * 0.7})`; ctx.lineWidth = 1; for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.arc(e.x, e.y, 4 + j * 5 + (1 - f) * 10, 0, 7); ctx.stroke(); } ctx.fillStyle = `rgba(90,60,35,${f})`; ctx.fillRect(e.x - 5 * f, e.y - 1.5, 10 * f, 3); break;
        case 'zablesk': ctx.fillStyle = `rgba(${e.barva},${f * 0.25})`; ctx.fillRect(0, 0, MW, MH); break;
      }
    }
    for (const p of st.castice) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.vx *= 0.96; p.vy *= 0.96; }
    st.castice = st.castice.filter(p => p.t > 0);
    for (const p of st.castice) { ctx.globalAlpha = Math.max(0, p.t / p.T); ctx.fillStyle = p.barva; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  function texty(dt) {
    for (const t of st.texty) { t.z -= dt; t.y -= dt * 14; }
    st.texty = st.texty.filter(t => t.z > 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of st.texty) {
      ctx.globalAlpha = Math.min(1, t.z * 1.5); ctx.font = `bold ${t.vel}px sans-serif`;
      ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 2; ctx.strokeText(t.t, t.x, t.y); ctx.fillStyle = t.barva; ctx.fillText(t.t, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  /* ================= smyčka ================= */
  let posledni = performance.now(), akum = 0, hudT = 0;
  function smycka(t) {
    const dt = Math.min(0.1, (t - posledni) / 1000); posledni = t;
    st.casAnim += dt;
    const h = st.hra;
    if (h && !st.okno && !st.pauza && !h.konec) {
      akum += dt * st.rychlost;
      let n = 0;
      while (akum >= S.KROK && n < 12) { S.krok(h); akum -= S.KROK; n++; }
      if (n >= 12) akum = 0;
      if (st.auto && !h.vlnaBezi && !h.vyhraOstrova && h.dalsi) { st.autoT -= dt; if (st.autoT <= 0) { st.autoT = 2.5; spustVlnu(); } }
    }
    zpracujUdalosti();
    if (st.bannerT > 0) { st.bannerT -= dt; if (st.bannerT <= 0) $('banner').textContent = ''; }
    kresli(dt);
    hudT -= dt;
    if (hudT <= 0 && h) {
      hudT = 0.12; hud(); vykresliSchopnosti();
      const p = $('panel');
      if (p.classList.contains('show') && p._druh === 'vez' && p._v && !h.veze.includes(p._v)) zavriPanel();
    }
    requestAnimationFrame(smycka);
  }

  /* ================= start ================= */
  function start() {
    try { if (localStorage.getItem('webapp_hra_obleheni_zvuk') === '0') { Z.nastavZtlumeni(true); $('bZvuk').textContent = '🔇'; } } catch { }
    rozmer();
    let tm = null;
    window.addEventListener('resize', () => { clearTimeout(tm); tm = setTimeout(() => { rozmer(); st.pozadiKlic = ''; }, 150); });
    vykresliSchopnosti();
    prepniZalozku('veze');
    // na pozadí menu běží ukázkový ostrov
    st.hra = S.nova({ seed: OBL.seedDne(new Date()), biom: 'tropy', obtiznost: 'normalni', rezim: 'nekonecna' });
    st.hra.ukazka = true;
    st.rekord = rekordRezimu('kampan');
    oknoMenu();
    requestAnimationFrame(smycka);
  }
  // testovací háčky
  st.api = { zacni, oknoMenu, oknoSouostrovi, spustVlnu, uloz, nactiUlozenou, poVyhreOstrova, oknoKonec, kresli: () => kresli(0), rozmer };
  start();
})(globalThis.OBL = globalThis.OBL || {});
