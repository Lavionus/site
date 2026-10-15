/* Modelář 3D – otáčení kolem zvoleného bodu (pivotu).
   Bod otáčení (klávesa P nebo Úpravy → Bod otáčení): ve scéně se ukážou puntíky
   v rozích, středech hran a stěn a ve středu vybraných těles; klik na puntík,
   na stěnu tělesa nebo na desku bod nastaví. Šipky otáčení u těles pak otáčejí
   kolem něj (značka ⊕ ve scéně). Bod se zruší se změnou výběru nebo příkazem.
   Panel Otočit kolem bodu: přesný úhel, osa a souřadnice bodu, i otočení kopie
   (opakovaně = kruhová řada kolem bodu). */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const $ = id => document.getElementById(id);
  const zaokr = x => Math.round(x * 1000) / 1000;

  M.vytvorPivot = function (S) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'pivot-vrstva');
    svg.setAttribute('aria-hidden', 'true');
    $('plocha').appendChild(svg);
    const hruby = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    let vyberPivotu = '';                 // výběr, ke kterému bod patří
    let body = [];                        // [{bod: [x,y,z], q: [px,py]}] puntíky v režimu

    const aktivni = () => M.app.rezim === 'pivot';

    // bod je přivázaný k prvnímu vybranému tělesu (v jeho rámci): posun šipkami nebo tažením ho vezme
    // s sebou, otočení kolem něj ho nechá na místě
    let vazba = null;
    M.nastavPivot = function (bod) {
      M.app.pivot = bod ? bod.map(zaokr) : null;
      vyberPivotu = [...M.app.vyber].sort().join(',');
      const u = bod && M.vybraneVolne()[0];
      vazba = u ? { id: u.id, lokal: new THREE.Vector3(...bod).applyMatrix4(M.tuhaMaticeUzlu(u).invert()) } : null;
      M.vysli('pivot', M.app.pivot);
      obnovPanel();
      M.prekresli();
    };

    M.prepniPivot = function () {
      if (aktivni()) { M.nastavRezim(null); return; }
      if (!M.vybraneVolne().length) { Dialog.info('Vyber těleso, které se má otáčet kolem bodu.'); return; }
      M.nastavRezim('pivot');
    };

    /** Charakteristické body: rohy, středy hran a stěn a střed (u jednoho tělesa v jeho natočení). */
    function charakteristicke() {
      const uzly = M.vybraneVolne(), o = [];
      if (uzly.length === 1) {
        const u = uzly[0], m = M.tuhaMaticeUzlu(u), h = u.rozmer.map(x => x / 2);
        for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) for (const c of [-1, 0, 1])
          o.push(new THREE.Vector3(a * h[0], b * h[1], c * h[2]).applyMatrix4(m).toArray());
      } else {
        const ob = M.obalkaVice(uzly);
        for (const a of [0, 1, 2]) for (const b of [0, 1, 2]) for (const c of [0, 1, 2])
          o.push([[ob.min[0], ob.stred[0], ob.max[0]][a], [ob.min[1], ob.stred[1], ob.max[1]][b], [ob.min[2], ob.stred[2], ob.max[2]][c]]);
      }
      return o;
    }

    function kresli() {
      svg.innerHTML = '';
      body = [];
      if (!aktivni()) return;
      const r = hruby ? 9 : 5.5;
      for (const b of charakteristicke()) {
        const q = S.naObrazovku(new THREE.Vector3(...b));
        if (!q) continue;
        body.push({ bod: b, q });
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', q[0]); c.setAttribute('cy', q[1]); c.setAttribute('r', r);
        c.setAttribute('class', 'bod-pivotu');
        c.dataset.i = body.length - 1;
        svg.appendChild(c);
      }
    }

    svg.addEventListener('pointerdown', e => {
      const c = e.target.closest && e.target.closest('.bod-pivotu');
      if (!c || e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      if (document.activeElement && document.activeElement.matches('#inspektor input')) document.activeElement.blur();
      M.nastavPivot(body[+c.dataset.i].bod);
      M.nastavRezim(null);
    });
    svg.addEventListener('wheel', e => { S.renderer.domElement.dispatchEvent(new WheelEvent('wheel', e)); e.preventDefault(); }, { passive: false });

    /** Klik do scény v režimu bodu otáčení (vyber.js): stěna tělesa nebo deska. */
    M.klikPivot = function (zasah, px, py) {
      let bod = null;
      if (zasah) bod = zasah.bod.toArray();
      else {
        const p = S.kamera.bodNaRovine(px, py, 0);
        if (p) { const k = Math.max(S.deska.krok, 0.1); bod = [Math.round(p.x / k) * k, Math.round(p.y / k) * k, 0]; }
      }
      if (bod) M.nastavPivot(bod);
      M.nastavRezim(null);
    };

    M.na('rezim', kresli);
    M.na('kamera', () => { if (aktivni()) kresli(); });
    M.na('dokument', () => {
      if (M.app.pivot && vazba) {
        const u = M.najdiUzel(M.app.dok, vazba.id);
        if (!u) { M.app.pivot = null; vazba = null; M.vysli('pivot', null); }
        else M.app.pivot = vazba.lokal.clone().applyMatrix4(M.tuhaMaticeUzlu(u)).toArray().map(zaokr);
        obnovPanel();
      }
      if (aktivni()) kresli();
    });
    // jiný výběr = bod otáčení patřil k jiným tělesům
    M.na('vyber', () => {
      if (M.app.pivot && [...M.app.vyber].sort().join(',') !== vyberPivotu) M.nastavPivot(null);
      if (aktivni() && !M.vybraneVolne().length) M.nastavRezim(null);
      else if (aktivni()) kresli();
      obnovPanel();
    });

    // ------------------------------------------------------------ panel Otočit kolem bodu
    const okno = $('oknoPivot');
    const pole = ['pivX', 'pivY', 'pivZ'].map($);
    function obnovPanel() {
      if (!okno || !okno.open) return;
      const uzly = M.vybraneVolne();
      const b = M.app.pivot || (uzly.length ? M.obalkaVice(uzly).stred : [0, 0, 0]);
      pole.forEach((p, i) => { if (document.activeElement !== p) p.value = M.mm(b[i], 3); });
      $('pivInfo').textContent = !uzly.length ? 'Vyber tělesa, která se mají otočit.'
        : M.app.pivot ? 'Bod otáčení je zvolený (značka ⊕ ve scéně) – otáčí kolem něj i šipky u těles.' : 'Bod = střed výběru. Jiný zvolíš tlačítkem Vybrat ve scéně.';
      $('pivOk').disabled = $('pivKopie').disabled = !uzly.length;
    }
    M.otevriOtoceniKolemBodu = function () {
      M.otevriPanel(okno);
      obnovPanel();
      $('pivUhel').focus(); $('pivUhel').select();
    };
    const precti = () => pole.map(p => M.prectiCislo(p.value));
    pole.forEach(p => p.addEventListener('change', () => {
      const b = precti();
      if (b.every(isFinite)) M.nastavPivot(b); else obnovPanel();
    }));
    $('pivStred').onclick = () => M.nastavPivot(null);
    $('pivVybrat').onclick = () => M.prepniPivot();
    $('pivZavrit').onclick = () => okno.close();
    okno.addEventListener('cancel', e => { e.preventDefault(); okno.close(); });
    function otoc(kopie) {
      const uzly = M.vybraneVolne(), uhel = M.prectiCislo($('pivUhel').value), b = precti();
      if (!uzly.length || !isFinite(uhel) || !b.every(isFinite)) { $('pivInfo').textContent = '⚠ Zadej úhel a souřadnice bodu číslem.'; return; }
      const osa = [0, 0, 0]; osa[+okno.querySelector('input[name="pivOsa"]:checked').value] = 1;
      let dok = M.app.dok, ids = uzly.map(u => u.id);
      if (kopie) { const r = M.duplikujUzly(dok, ids); dok = r.dok; ids = r.kopie; }
      M.zmenDokument(M.otocUzly(dok, ids, osa, uhel, b), kopie ? 'Otočit kopii kolem bodu' : 'Otočit kolem bodu');
      if (!M.app.pivot) M.nastavPivot(b);
      if (kopie) { M.nastavVyber(ids); M.nastavPivot(b); }
    }
    $('pivOk').onclick = () => otoc(false);
    $('pivKopie').onclick = () => otoc(true);
    M.na('dokument', obnovPanel);
  };
})(MDL);
