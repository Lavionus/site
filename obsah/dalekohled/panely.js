/* dalekohled/panely.js – panely Vybavení, Astrofoto a Kalkulačky + tisk vyhledávací mapky do PDF */
(function () {
  'use strict';
  const APP = window.DALEK_APP, D = window.DALEK, K = window.DALEK_KAT, V = window.DALEK_VYBAVA, A = window.ASTRO, OB = window.DALEK_OBLOHA;
  const $ = id => document.getElementById(id);
  const c1 = APP.c1;
  const el = (tag, attrs = {}, text) => { const e = document.createElement(tag); Object.assign(e, attrs); if (text !== undefined) e.textContent = text; return e; };
  const stahni = (text, nazev, typ) => { const b = new Blob([text], { type: typ }); const a = el('a', { href: URL.createObjectURL(b), download: nazev }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  const TYPY_DAL = { refraktor: 'refraktor', newton: 'Newton', sct: 'katadioptrický (SCT/RC)', mak: 'Maksutov', triedr: 'triedr', galileo: 'Galileův' };

  /* =============== VYBAVENÍ =============== */
  const pV = $('panel-vybava');
  pV.innerHTML = `
    <div class="kalk">
      <div class="card" style="grid-column:1 / -1">
        <h2>Dalekohledy <small>klik = použít</small></h2>
        <div class="tab-obal" style="max-height:330px"><table class="tab" id="vbDal"></table></div>
        <details style="margin-top:8px"><summary style="cursor:pointer;font-weight:600;font-size:.88rem">+ Přidat vlastní dalekohled</summary>
          <div class="r4">
            <div><label>Název</label><input id="vdNazev" placeholder="Můj Dobson"></div>
            <div><label>Průměr D (mm)</label><input id="vdD" type="number" min="10" max="2000" value="200"></div>
            <div><label>Ohnisko F (mm)</label><input id="vdF" type="number" min="50" max="20000" value="1200"></div>
            <div><label>Konstrukce</label><select id="vdTyp"><option value="newton">Newton</option><option value="refraktor">refraktor</option><option value="sct">Schmidt-Cassegrain / RC</option><option value="mak">Maksutov</option></select></div>
            <div><label>Barevná korekce</label><select id="vdVada"><option value="zadna">zrcadlo</option><option value="achromat">achromát</option><option value="apo">apochromát</option></select></div>
            <div><label>Stínění sekundárem (%)</label><input id="vdObstr" type="number" min="0" max="60" value="22"></div>
            <div><label>Montáž</label><select id="vdMontaz"><option value="az">azimutální</option><option value="eq">paralaktická</option></select></div>
            <div><label>&nbsp;</label><label class="chk" style="margin:0"><input type="checkbox" id="vdSled"> sledování</label></div>
          </div>
          <div class="tlacitka"><button class="btn" id="vdPridat">Přidat dalekohled</button></div>
        </details>
      </div>
      <div class="card">
        <h2>Okuláry <small>zaškrtněte, které máte</small></h2>
        <div class="tab-obal" style="max-height:380px"><table class="tab" id="vbOk"></table></div>
        <details style="margin-top:8px"><summary style="cursor:pointer;font-weight:600;font-size:.88rem">+ Přidat vlastní okulár</summary>
          <div class="r4">
            <div><label>Ohnisko (mm)</label><input id="voF" type="number" min="1" max="60" step="0.1" value="9"></div>
            <div><label>Zdánlivé pole (°)</label><input id="voAfov" type="number" min="20" max="120" value="82"></div>
            <div><label>Clona pole (mm)</label><input id="voClona" type="number" min="0" max="50" step="0.1" placeholder="nepovinné"></div>
            <div><label>Název</label><input id="voNazev" placeholder="např. Nagler"></div>
          </div>
          <div class="tlacitka"><button class="btn" id="voPridat">Přidat okulár</button></div>
        </details>
      </div>
      <div class="card">
        <h2>Kamery</h2>
        <div class="tab-obal" style="max-height:330px"><table class="tab" id="vbKam"></table></div>
        <details style="margin-top:8px"><summary style="cursor:pointer;font-weight:600;font-size:.88rem">+ Přidat vlastní kameru</summary>
          <div class="r4">
            <div><label>Název</label><input id="vkNazev" placeholder="moje kamera"></div>
            <div><label>Čip šířka (mm)</label><input id="vkW" type="number" step="0.1" value="23.5"></div>
            <div><label>Čip výška (mm)</label><input id="vkH" type="number" step="0.1" value="15.7"></div>
            <div><label>Pixel (µm)</label><input id="vkPx" type="number" step="0.01" value="3.76"></div>
          </div>
          <label class="chk"><input type="checkbox" id="vkBar" checked> barevná</label>
          <div class="tlacitka"><button class="btn" id="vkPridat">Přidat kameru</button></div>
        </details>
        <h2 style="margin-top:14px">Záloha vybavení</h2>
        <div class="tlacitka">
          <button class="btn btn-sec" id="vbExport">⬇ Export JSON</button>
          <label class="btn btn-sec" style="display:inline-flex;align-items:center;justify-content:center;margin:0;color:var(--text)">⬆ Import JSON<input type="file" id="vbImport" accept=".json,application/json" hidden></label>
        </div>
      </div>
    </div>`;
  function tabulka(id, hlavicka, radky) {
    const t = $(id); t.innerHTML = '';
    const th = t.createTHead().insertRow();
    for (const h of hlavicka) th.appendChild(el('th', {}, h));
    const tb = t.createTBody();
    for (const r of radky) {
      const tr = tb.insertRow();
      for (const x of r.bunky) { const c = tr.insertCell(); if (x instanceof Node) c.appendChild(x); else c.textContent = x; }
      if (r.klik) tr.addEventListener('click', r.klik);
      if (r.vybrany) tr.className = 'vybrany';
    }
  }
  const tlacitkoSmazat = (fn) => { const b = el('button', { className: 'hvezdicka', title: 'Smazat' }, '🗑'); b.addEventListener('click', e => { e.stopPropagation(); fn(); }); return b; };
  function vybava() {
    const S = APP.S;
    tabulka('vbDal', ['Dalekohled', 'D', 'F', 'f/', 'Typ', 'Dawes', 'Mez', 'Max. zvětšení', 'Sběr světla', ''],
      V.dalekohledy().map(d => {
        const o = D.optika(d, { f: 25, afov: 52 }, 1);
        return {
          bunky: [d.nazev, d.D + ' mm', d.F + ' mm', c1(d.F / d.D), TYPY_DAL[d.typ] || d.typ, c1(116 / d.D, 2) + '″', c1(D.mezniVelikost(o, d, 21.5, 60)) + ' mag',
            d.pevneZvetseni ? d.pevneZvetseni + '×' : Math.round(2 * d.D) + '×', Math.round((d.D / 7) ** 2 * (1 - (d.obstrukce || 0) ** 2)) + '×',
            d.vlastni ? tlacitkoSmazat(() => { V.odeber('dalekohledy', d.id); if (S.dal === d.id) S.dal = 'd200'; APP.naplnVybavu(); vybava(); }) : ''],
          klik: () => { S.dal = d.id; APP.zmenaDalekohledu(); vybava(); }, vybrany: d.id === S.dal,
        };
      }));
    const dal = APP.dalekohled();
    tabulka('vbOk', ['Mám', 'Okulár', 'Pole', 'Zvětšení', 'Pupila', 'Skutečné pole', ''],
      V.okularyVse().map(o => {
        const ch = el('input', { type: 'checkbox', checked: V.jeVybaven(o.id) });
        ch.addEventListener('click', e => e.stopPropagation());
        ch.addEventListener('change', () => { V.nastavVybaveni(o.id, ch.checked); APP.naplnVybavu(); });
        const op = D.optika(dal, o, 1);
        return {
          bunky: [ch, `${String(o.f).replace('.', ',')} mm ${o.n}`, o.afov + '°' + (o.clona ? ` (clona ${c1(o.clona)} mm)` : ''), Math.round(op.M) + '×', c1(op.pupila, 2) + ' mm', K.fmtUhel(op.pole * 3600),
            o.vlastni ? tlacitkoSmazat(() => { V.odeber('okulary', o.id); APP.naplnVybavu(); vybava(); }) : ''],
          klik: () => { if (!V.jeVybaven(o.id)) { V.nastavVybaveni(o.id, true); } S.okular = o.id; S.rezim = 'okular'; APP.doFormulare(); APP.uloz(); vybava(); APP.prepocet(); },
          vybrany: o.id === S.okular,
        };
      }));
    tabulka('vbKam', ['Kamera', 'Čip', 'Pixel', 'Měřítko', 'Pole', ''],
      V.kamery().map(k => {
        const af = D.astrofoto(k, dal.F, dal.D, S.seeing, 30, true);
        return {
          bunky: [k.n, `${c1(k.sirka)} × ${c1(k.vyska)} mm`, c1(k.pixel, 2) + ' µm', c1(af.meritko, 2) + '″/px', `${K.fmtUhel(af.poleW * 3600)} × ${K.fmtUhel(af.poleH * 3600)}`,
            k.vlastni ? tlacitkoSmazat(() => { V.odeber('kamery', k.id); APP.naplnVybavu(); vybava(); }) : ''],
          klik: () => { S.kamera = k.id; S.rezim = 'kamera'; APP.doFormulare(); APP.uloz(); vybava(); APP.prepocet(); }, vybrany: k.id === S.kamera,
        };
      }));
  }
  $('vdTyp').addEventListener('change', e => { const t = e.target.value; $('vdVada').value = t === 'refraktor' ? 'achromat' : 'zadna'; $('vdObstr').value = t === 'refraktor' ? 0 : t === 'newton' ? 22 : 33; });
  $('vdPridat').addEventListener('click', () => {
    const Dm = +$('vdD').value, F = +$('vdF').value;
    if (!(Dm >= 10 && F >= 50)) return APP.zprava('Zadejte průměr a ohnisko.');
    const typ = $('vdTyp').value;
    const id = V.pridej('dalekohledy', { nazev: $('vdNazev').value.trim() || `Vlastní ${Dm}/${F}`, D: Dm, F, typ, vada: $('vdVada').value, obstrukce: Math.min(0.6, Math.max(0, +$('vdObstr').value / 100)), montaz: $('vdMontaz').value, diag: typ === 'newton' ? 0 : 1, sledovani: $('vdSled').checked });
    APP.S.dal = id; APP.zmenaDalekohledu(); vybava();
    APP.zprava('Dalekohled přidán a vybrán.');
  });
  $('voPridat').addEventListener('click', () => {
    const f = +$('voF').value, af = +$('voAfov').value, cl = +$('voClona').value;
    if (!(f > 0 && af >= 20)) return APP.zprava('Zadejte ohnisko a zdánlivé pole okuláru.');
    const id = V.pridej('okulary', { f, afov: af, clona: cl > 0 ? cl : undefined, n: $('voNazev').value.trim() || 'vlastní' });
    APP.S.okular = id; APP.naplnVybavu(); APP.doFormulare(); APP.uloz(); vybava();
  });
  $('vkPridat').addEventListener('click', () => {
    const w = +$('vkW').value, h = +$('vkH').value, p = +$('vkPx').value;
    if (!(w > 0 && h > 0 && p > 0)) return APP.zprava('Zadejte rozměry čipu a velikost pixelu.');
    const id = V.pridej('kamery', { n: $('vkNazev').value.trim() || 'vlastní kamera', sirka: w, vyska: h, pixel: p, barevna: $('vkBar').checked });
    APP.S.kamera = id; APP.naplnVybavu(); APP.doFormulare(); APP.uloz(); vybava();
  });
  $('vbExport').addEventListener('click', () => stahni(V.export(), 'dalekohled-vybaveni.json', 'application/json'));
  $('vbImport').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { V.import(await f.text()); APP.naplnVybavu(); vybava(); APP.zprava('Vybavení naimportováno.'); }
    catch (er) { APP.zprava('Import se nezdařil: ' + er.message); }
    e.target.value = '';
  });

  /* =============== ASTROFOTO =============== */
  const pF = $('panel-foto');
  pF.innerHTML = `
    <div class="kalk">
      <div class="card">
        <h2>Sestava pro fotografii</h2>
        <div class="udaje" id="afSestava"></div>
        <div class="info" id="afDoporuceni"></div>
        <div class="tlacitka"><button class="btn" id="afZapnout">📷 Zobrazit pohled kamery</button></div>
      </div>
      <div class="card">
        <h2>Rámování vybraného objektu</h2>
        <div id="afRam" class="info" style="margin-top:0"></div>
      </div>
      <div class="card" style="grid-column:1 / -1">
        <h2>Všechny kamery s tímto dalekohledem <small>a aktuální Barlow/reduktor</small></h2>
        <div class="tab-obal" style="max-height:320px"><table class="tab" id="afKamery"></table></div>
        <div class="info">Vzorkování: kolik pixelů připadá na FWHM hvězdy (seeing). Ideální je asi 2–3 px (Nyquist). Planetární snímání („lucky imaging“) míří na světelnost f ≈ 5 × velikost pixelu v µm.</div>
      </div>
    </div>`;
  function astrofoto() {
    const S = APP.S, dal = APP.dalekohled(), kam = V.kamera(S.kamera), kB = V.prislusenstvi(S.barlowK).k;
    const F = dal.F * kB;
    const r = APP.ramec();
    const dec = r ? D.raDec(r.c).dec : 30;
    const seeing = r ? r.seeingEf : S.seeing;
    const af = D.astrofoto(kam, F, dal.D, seeing, dec, S.sledovani);
    const rd = APP.radek;
    $('afSestava').innerHTML = [
      rd('Dalekohled', dal.nazev), rd('Kamera', kam.n), rd('Barlow / reduktor', V.prislusenstvi(S.barlowK).n),
      rd('Ohnisko / světelnost', `${Math.round(F)} mm · f/${c1(F / dal.D)}`), rd('Měřítko', c1(af.meritko, 2) + '″/px'),
      rd('Zorné pole', `${K.fmtUhel(af.poleW * 3600)} × ${K.fmtUhel(af.poleH * 3600)}`), rd('Seeing v cíli', c1(seeing) + '″ → ' + c1(af.vzorkovani) + ' px/FWHM'),
      rd('Difrakční mez', c1(138 / dal.D, 2) + '″ (' + c1(138 / dal.D / af.meritko, 1) + ' px)'),
      rd('Max. expozice bez pointace', `${af.tMax < 1 ? c1(af.tMax, 2) : c1(af.tMax, 1)} s (posun 1 px při δ ${Math.round(dec)}°)`),
      rd('Pravidlo NPF (krajinářské)', c1(af.tNpf, 2) + ' s'),
      rd('Ideální f/ pro planety', `f/${c1(5 * kam.pixel)} → Barlow ${c1(5 * kam.pixel / (dal.F / dal.D), 1)}×`),
    ].join('');
    const p = [af.doporuceni];
    if (!dal.sledovani && dal.montaz === 'az' && !S.sledovani) p.push('Bez pointace jsou možné jen krátké expozice – Měsíc, planety (video), jasné hvězdy.');
    if (S.montaz === 'az' && S.sledovani) p.push('Na azimutální montáži se pole během expozice otáčí; delší expozice vyžadují derotátor nebo paralaktickou montáž.');
    $('afDoporuceni').innerHTML = p.join('<br>');
    // rámování
    const id = S.cil, ob = id && K.objekt(id);
    if (!ob) $('afRam').textContent = 'Vyberte objekt (vpravo nahoře nebo hledáním).';
    else {
      let a, b;
      if (ob.druh === 'd') { a = ob.o[5] * 60; b = ob.o[6] * 60; }
      else if (ob.druh === 'p') { const t = D.teleso(ob.klic, APP.jdTed(), APP.misto()); a = b = 2 * t.rUhel * (ob.klic === 'saturn' ? 2.25 : 1); }
      else { a = b = 0; }
      const W = af.poleW * 3600, H = af.poleH * 3600;
      const zab = a ? Math.max(a / W, b / H, b / W, a / H) : 0;
      $('afRam').innerHTML = `<b>${ob.nazev}</b>: ${a ? `rozměr ${K.fmtUhel(a)} × ${K.fmtUhel(b)}, na čipu ${Math.round(a / af.meritko)} × ${Math.round(b / af.meritko)} px. ` : ''}
        ${!a ? 'Bodový objekt.' : zab > 1 ? `<span class="varovani">Nevejde se – zabírá ${Math.round(zab * 100)} % pole. Kratší ohnisko, reduktor nebo mozaika (${Math.ceil(zab)}×${Math.ceil(zab)} polí).</span>` : zab < 0.1 ? `<span class="varovani">Zabírá jen ${Math.round(zab * 100)} % pole – zvažte delší ohnisko nebo menší čip.</span>` : `<span class="ok">Zabírá ${Math.round(zab * 100)} % delší strany – dobré rámování.</span>`}`;
    }
    tabulka('afKamery', ['Kamera', 'Měřítko', 'Pole', 'Vzorkování', 'Bez pointace', 'Hodnocení'],
      V.kamery().map(k => {
        const x = D.astrofoto(k, F, dal.D, seeing, dec, S.sledovani);
        return {
          bunky: [k.n, c1(x.meritko, 2) + '″/px', `${K.fmtUhel(x.poleW * 3600)} × ${K.fmtUhel(x.poleH * 3600)}`, c1(x.vzorkovani) + ' px', c1(x.tMax, 2) + ' s', x.doporuceni],
          klik: () => { S.kamera = k.id; S.rezim = 'kamera'; APP.doFormulare(); APP.uloz(); APP.prepocet(); astrofoto(); }, vybrany: k.id === S.kamera,
        };
      }));
  }
  $('afZapnout').addEventListener('click', () => { APP.S.rezim = 'kamera'; APP.doFormulare(); APP.uloz(); APP.prepocet(); window.scrollTo({ top: 0, behavior: 'smooth' }); });

  /* =============== KALKULAČKY =============== */
  const pK = $('panel-kalk');
  pK.innerHTML = `
    <div class="kalk">
      <div class="card">
        <h2>Zorné pole metodou driftu</h2>
        <p class="info" style="margin-top:0">Vypněte sledování, nechte hvězdu u rovníku (nebo jakékoli deklinace) projít středem pole od okraje k okraji a změřte čas.</p>
        <div class="r2"><div><label>Čas průchodu (s)</label><input id="kdT" type="number" value="120" min="1"></div><div><label>Deklinace hvězdy (°)</label><input id="kdDec" type="number" value="0" min="-89" max="89"></div></div>
        <div class="r2"><div><label>Zvětšení (pro zdánlivé pole)</label><input id="kdM" type="number" value="48" min="1"></div><div><label>Ohnisko dalekohledu F (mm)</label><input id="kdF" type="number" value="1200"></div></div>
        <div class="vysledek" id="kdV"></div>
      </div>
      <div class="card">
        <h2>Optika dalekohledu</h2>
        <div class="r3"><div><label>D (mm)</label><input id="koD" type="number" value="200"></div><div><label>F (mm)</label><input id="koF" type="number" value="1200"></div><div><label>okulár f (mm)</label><input id="koOk" type="number" value="10"></div></div>
        <div class="r3"><div><label>Zdánlivé pole (°)</label><input id="koAf" type="number" value="52"></div><div><label>Barlow</label><input id="koB" type="number" value="1" step="0.1"></div><div><label>SQM oblohy</label><input id="koSqm" type="number" value="21.3" step="0.1"></div></div>
        <div class="vysledek" id="koV"></div>
      </div>
      <div class="card">
        <h2>Převod souřadnic</h2>
        <label>Rektascenze a deklinace (J2000) – např. 18h36m56s +38°47′01″ nebo 279.23 38.78</label>
        <input id="ksVstup" value="18h36m56s +38 47 01">
        <div class="tlacitka"><button class="btn btn-sec btn-mini" id="ksZCile">z vybraného cíle</button><button class="btn btn-sec btn-mini" id="ksNamir">◎ namířit</button></div>
        <div class="vysledek" id="ksV"></div>
      </div>
      <div class="card">
        <h2>Úhlová vzdálenost a poziční úhel</h2>
        <label>Bod 1 (α δ)</label><input id="kuA" value="19h30m43s +27 57 35">
        <label>Bod 2 (α δ)</label><input id="kuB" value="19h30m45s +27 57 55">
        <div class="vysledek" id="kuV"></div>
      </div>
      <div class="card">
        <h2>Jas oblohy</h2>
        <label>SQM (mag/″²)</label><input id="kjSqm" type="number" value="21.3" step="0.05">
        <div class="vysledek" id="kjV"></div>
      </div>
      <div class="card">
        <h2>Povrchový jas objektu</h2>
        <div class="r3"><div><label>Jasnost (mag)</label><input id="kpM" type="number" value="8.4" step="0.1"></div><div><label>a (′)</label><input id="kpA" type="number" value="6" step="0.1"></div><div><label>b (′)</label><input id="kpB" type="number" value="4" step="0.1"></div></div>
        <div class="vysledek" id="kpV"></div>
      </div>
    </div>`;
  const cislo = id => +$(id).value;
  function kalkulacky() {
    // drift
    {
      const t = cislo('kdT'), dec = cislo('kdDec'), M = cislo('kdM'), F = cislo('kdF');
      const pole = t * 15.041 * Math.cos(dec * Math.PI / 180) / 3600;
      $('kdV').innerHTML = t > 0 ? `Skutečné pole <b>${K.fmtUhel(pole * 3600)}</b> (${c1(pole, 3)}°)<br>Zdánlivé pole okuláru ≈ <b>${c1(pole * M, 0)}°</b><br>Clona pole okuláru ≈ <b>${c1(pole * Math.PI / 180 * F, 1)} mm</b>` : '';
    }
    {
      const Dm = cislo('koD'), F = cislo('koF') * cislo('koB'), f = cislo('koOk'), af = cislo('koAf'), sqm = cislo('koSqm');
      if (Dm > 0 && F > 0 && f > 0) {
        const o = D.optika({ D: Dm, F }, { f, afov: af }, 1);
        const lm = D.mezniVelikost(o, { D: Dm, typ: 'newton', obstrukce: 0.2 }, sqm, 60);
        $('koV').innerHTML = `Zvětšení <b>${c1(o.M, 0)}×</b> · pupila <b>${c1(o.pupila, 2)} mm</b> · pole <b>${K.fmtUhel(o.pole * 3600)}</b><br>
          Světelnost f/${c1(F / Dm)} · Dawes ${c1(116 / Dm, 2)}″ · Rayleigh ${c1(138 / Dm, 2)}″ · Sparrow ${c1(107 / Dm, 2)}″<br>
          Mezní velikost ≈ <b>${c1(lm)} mag</b> · rozumné zvětšení ${Math.round(Dm / 7)}–${Math.round(2 * Dm)}× · sběr světla ${Math.round((Dm / 7) ** 2)}× oka<br>
          Nejmenší rozlišitelný detail na Měsíci ≈ ${c1(116 / Dm / 206265 * 384400, 1)} km`;
      }
    }
    {
      const s = K.souradnice($('ksVstup').value);
      if (!s) $('ksV').textContent = 'Nerozpoznané souřadnice.';
      else {
        const v = D.v3(s.ra, s.dec), jd = APP.jdTed(), m = APP.misto(), prec = D.precese(A.utNaJde(jd));
        const rd = D.raDec(D.mxv(prec, v)), o = D.naObzor(v, jd, m, prec), g = D.galakticke(v);
        const ekl = (() => { const e = 23.4392911 * Math.PI / 180; const x = v[0], y = Math.cos(e) * v[1] + Math.sin(e) * v[2], z = -Math.sin(e) * v[1] + Math.cos(e) * v[2]; return { l: (Math.atan2(y, x) * 180 / Math.PI + 360) % 360, b: Math.asin(z) * 180 / Math.PI }; })();
        $('ksV').innerHTML = `J2000: <b>${K.fmtRa(s.ra)} ${K.fmtDec(s.dec)}</b> (${c1(s.ra, 4)}°, ${c1(s.dec, 4)}°)<br>
          Rovnodennost data: ${K.fmtRa(rd.ra)} ${K.fmtDec(rd.dec)}<br>
          Výška ${c1(o.alt)}°, azimut ${c1(o.az)}° (${APP.fmtDatumCas(jd)}, ${c1(m.lat, 3)}° ${c1(m.lon, 3)}°)<br>
          Ekliptikální λ ${c1(ekl.l, 3)}°, β ${c1(ekl.b, 3)}° · galaktické l ${c1(g.l, 3)}°, b ${c1(g.b, 3)}°<br>
          Souhvězdí: <b>${K.souhvezdiJmeno(D.souhvezdi(v))}</b>`;
      }
    }
    {
      const a = K.souradnice($('kuA').value), b = K.souradnice($('kuB').value);
      if (a && b) {
        const va = D.v3(a.ra, a.dec), vb = D.v3(b.ra, b.dec);
        $('kuV').innerHTML = `Vzdálenost <b>${K.fmtUhel(D.uhel(va, vb) * 3600)}</b> · poziční úhel bodu 2 vůči bodu 1 <b>${c1(D.pozicniUhel(va, vb))}°</b>`;
      } else $('kuV').textContent = 'Zadejte oba body.';
    }
    {
      const sqm = cislo('kjSqm');
      const bortle = sqm >= 21.9 ? 1 : sqm >= 21.7 ? 2 : sqm >= 21.3 ? 3 : sqm >= 20.8 ? 4 : sqm >= 20.3 ? 5 : sqm >= 19.25 ? 6 : sqm >= 18.5 ? 7 : sqm >= 18 ? 8 : 9;
      const cd = 10.8e4 * 10 ** (-0.4 * sqm);
      $('kjV').innerHTML = `Bortle ≈ <b>${bortle}</b> · mezní velikost okem ≈ <b>${c1(D.nelm(sqm))} mag</b><br>Jas ${(cd * 1000).toFixed(3).replace('.', ',')} mcd/m² · ${c1(cd / 1.71e-4 * 1, 2)}× jas přirozeně tmavé oblohy`;
    }
    {
      const m = cislo('kpM'), a = cislo('kpA'), b = cislo('kpB') || a;
      if (a > 0) {
        const sb = m + 2.5 * Math.log10(Math.PI / 4 * a * b * 3600);
        $('kpV').innerHTML = `Průměrný povrchový jas <b>${c1(sb, 2)} mag/″²</b> (${c1(sb - 8.89, 2)} mag/′²)<br>${sb < 21 ? 'Jasnější než tmavá obloha – dobře viditelný.' : sb < 22.5 ? 'Srovnatelný s tmavou oblohou – vyžaduje tmavé místo.' : 'Slabší než obloha – obtížný objekt, potřebuje velký průměr a tmu.'}`;
      }
    }
  }
  for (const id of ['kdT', 'kdDec', 'kdM', 'kdF', 'koD', 'koF', 'koOk', 'koAf', 'koB', 'koSqm', 'ksVstup', 'kuA', 'kuB', 'kjSqm', 'kpM', 'kpA', 'kpB']) $(id).addEventListener('input', kalkulacky);
  $('ksZCile').addEventListener('click', () => {
    const id = APP.S.cil; if (!id) return;
    const v = K.smer(id, APP.jdTed(), APP.misto()), rd = D.raDec(v);
    $('ksVstup').value = K.fmtRa(rd.ra).replace(/,/g, '.').replace(/ /g, '') + ' ' + K.fmtDec(rd.dec).replace('−', '-').replace(/[°′″]/g, ' ').trim();
    kalkulacky();
  });
  $('ksNamir').addEventListener('click', () => { const s = K.souradnice($('ksVstup').value); if (s) APP.vyber(`x:${s.ra.toFixed(5)},${s.dec.toFixed(5)}`, true); });
  function predvyplnKalk() {
    const dal = APP.dalekohled(), ok = APP.okular();
    $('koD').value = dal.D; $('koF').value = dal.F; $('koOk').value = ok.f; $('koAf').value = ok.afov; $('koB').value = APP.barlowK();
    $('koSqm').value = window.DALEK.BORTLE[APP.S.bortle]; $('kjSqm').value = window.DALEK.BORTLE[APP.S.bortle];
    $('kdF').value = dal.F * APP.barlowK(); const r = APP.ramec(); if (r) $('kdM').value = Math.round(r.o.M);
    kalkulacky();
  }

  /* =============== PDF vyhledávací mapky =============== */
  $('mPdf').addEventListener('click', async () => {
    const jspdf = window.jspdf;
    if (!jspdf) return APP.zprava('Knihovna pro PDF se ještě načítá, zkuste to za chvíli.');
    const S = APP.S, jd = APP.jdTed(), m = APP.misto(), prec = D.precese(A.utNaJde(jd));
    const id = S.cil || (APP.posledni() && APP.posledni().nejblizsi && APP.posledni().nejblizsi.id);
    const v = id ? K.smer(id, jd, m) : APP.aktualniC(jd, prec);
    const ob = id ? K.objekt(id) : null;
    const h = D.naObzor(v, jd, m, prec, false);
    const telesa = ['slunce', ...D.KLICE_TELES].map(k => D.teleso(k, jd, m, prec));
    const r = APP.ramec();
    const doc = new jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    const pole = [[60, 5.5], [15, 8], [3, 11]];
    const cv = document.createElement('canvas'); cv.width = cv.height = 1100;
    const mp = OB.vytvor(cv);
    doc.setFontSize(14);
    const nazev = ob ? ob.nazev : 'Vyhledávací mapka';
    // jsPDF bez vlastního písma neumí diakritiku – nadpis a údaje převést na ASCII
    const ascii = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[″]/g, '"').replace(/[′]/g, "'").replace(/[−–]/g, '-').replace(/[αδ]/g, c => c === 'α' ? 'RA' : 'Dec').replace(/[^\x20-\x7e]/g, '');
    doc.text(ascii(nazev), 12, 14);
    doc.setFontSize(9);
    const rd = D.raDec(v);
    doc.text(ascii(`${K.fmtRa(rd.ra)}  ${K.fmtDec(rd.dec)} (J2000) · ${K.souhvezdiJmeno(D.souhvezdi(v))} · ${A.dataZJd(jd).toLocaleString('cs-CZ')} · vyska ${c1(h.alt)} st., azimut ${c1(h.az)} st.`), 12, 20);
    doc.text(ascii(`${APP.dalekohled().nazev} · zorne pole ${r ? K.fmtUhel(r.o.pole * 3600) : ''} · cervene: zorne pole, hledacek 6 st., Telrad 0,5/2/4 st. · zenit nahore`), 12, 25);
    const poz = [[12, 30, 186], [12, 148, 90], [108, 148, 90]];
    pole.forEach(([fov, mez], i) => {
      mp.st.fov = fov;
      mp.kresli({ jd, misto: m, prec, stred: h, smerDal: h, telesa, hSlunce: -30, poleOk: r ? r.o.pole : 1, poleHledacku: 6, mez, dpr: 1100 / 500,
        rovnik: i > 0, ekliptika: i === 0, telrad: i === 0, dso: true, cilV: v, polaOkularu: i === 2 && r ? [r.o.pole] : null, tisk: true });
      const [x, y, w] = poz[i];
      doc.addImage(cv.toDataURL('image/jpeg', 0.9), 'JPEG', x, y, w, w);
      doc.setDrawColor(120); doc.rect(x, y, w, w);
      doc.setFontSize(8); doc.text(`pole ${fov} st., hvezdy do ${mez} mag`, x, y + w + 4);
    });
    doc.save('mapka-' + ascii(nazev).replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.pdf');
  });

  APP.naZalozku(p => { if (p === 'vybava') vybava(); else if (p === 'foto') astrofoto(); else if (p === 'kalk') predvyplnKalk(); });
  APP.naZmenu(() => { if (!pV.hidden) vybava(); if (!pF.hidden) astrofoto(); });
  APP.naCil(() => { if (!pF.hidden) astrofoto(); });
  if (!pV.hidden) vybava(); if (!pF.hidden) astrofoto(); if (!pK.hidden) predvyplnKalk();
})();
