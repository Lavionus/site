/* ============================================================
   Volvelle – editor vlastní volvelle (DOM): vrstvy, prstence s dílky, okénka
   VOLV_EDITOR.vykresli(kontejner, model, zmena(model, strukturalni))
   ============================================================ */
(function (koren) {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const otevrene = new Set([1]);
  let posledniKontejner = null;

  const NOVY_PRSTENEC = () => ({ r1: 40, r2: 60, n: 8, texty: 'A;B;C;D;E;F;G;H', orient: 'tecna', vypln: true, cary: true, nadpis: false, posun: 0 });
  const NOVE_OKNO = () => ({ typ: 'vysec', r1: 40, r2: 60, sirka: 30, uhel: 0, opak: 1 });
  const NOVA_VRSTVA = (r) => ({ nazev: 'Nová vrstva', typ: 'kotouc', r: r || 60, otoc: true, dilky: 8, sipka: false, prstence: [NOVY_PRSTENEC()], okna: [] });

  const pole = (cesta, label, hodn, typ, o) => {
    o = o || {};
    if (typ === 'chk') return `<label class="chk"><input type="checkbox" data-cesta="${cesta}" data-typ="bool"${hodn ? ' checked' : ''}> ${label}</label>`;
    if (typ === 'vyber') return `<div><label>${label}</label><select data-cesta="${cesta}" data-typ="text">${o.moznosti.map(([v, t]) => `<option value="${v}"${v === hodn ? ' selected' : ''}>${t}</option>`).join('')}</select></div>`;
    if (typ === 'area') return `<div><label>${label}</label><textarea data-cesta="${cesta}" data-typ="text" rows="2" spellcheck="false">${esc(hodn)}</textarea></div>`;
    return `<div><label>${label}</label><input type="${typ === 'cislo' ? 'number' : 'text'}" data-cesta="${cesta}" data-typ="${typ === 'cislo' ? 'num' : 'text'}" value="${esc(hodn)}"${o.min != null ? ` min="${o.min}"` : ''}${o.max != null ? ` max="${o.max}"` : ''}${o.krok ? ` step="${o.krok}"` : ''}></div>`;
  };

  function html(model) {
    let s = `<p class="info">Vrstvy jsou seřazené odspodu nahoru. Texty dílků oddělte středníkem; ikony zapište jako <code>:slunce:</code> (seznam v „Jak to funguje“).</p>`;
    model.vrstvy.forEach((v, i) => {
      s += `<details class="ed-vrstva" data-i="${i}"${otevrene.has(i) ? ' open' : ''}><summary><span>${i + 1}. ${esc(v.nazev)}</span>
        <button type="button" class="btn btn-sec btn-mini" data-akce="nahoru" data-i="${i}" title="Posunout níž (dřív v pořadí)" aria-label="Posunout vrstvu níž">↓</button>
        <button type="button" class="btn btn-sec btn-mini" data-akce="dolu" data-i="${i}" title="Posunout výš" aria-label="Posunout vrstvu výš">↑</button>
        <button type="button" class="btn btn-sec btn-mini" data-akce="smazatVrstvu" data-i="${i}" aria-label="Smazat vrstvu">✕</button></summary><div class="ed-telo">`;
      s += `<div class="r2">${pole(`${i}.nazev`, 'Název', v.nazev, 'text')}${pole(`${i}.typ`, 'Tvar', v.typ, 'vyber', { moznosti: [['kotouc', 'kotouč'], ['ukazatel', 'ukazatel (rameno)']] })}</div>`;
      s += `<div class="r3">${pole(`${i}.r`, v.typ === 'ukazatel' ? 'Délka (mm)' : 'Poloměr (mm)', v.r, 'cislo', { min: 10, max: 250, krok: 0.5 })}${pole(`${i}.dilky`, 'Dílků (přichycení)', v.dilky, 'cislo', { min: 0, max: 360 })}${v.typ === 'ukazatel' ? pole(`${i}.sirka`, 'Šířka ½ (mm)', v.sirka == null ? 7 : v.sirka, 'cislo', { min: 3, max: 30 }) : '<div></div>'}</div>`;
      s += `<div class="r2">${pole(`${i}.otoc`, 'Otočná vrstva', v.otoc, 'chk')}${v.typ !== 'ukazatel' ? pole(`${i}.sipka`, 'Šipka na okraji', v.sipka, 'chk') : ''}</div>`;
      (v.prstence || []).forEach((p, j) => {
        s += `<div class="ed-polozka"><h4>Prstenec ${j + 1}<button type="button" class="btn btn-sec btn-mini" data-akce="smazatPrstenec" data-i="${i}" data-j="${j}" aria-label="Smazat prstenec">✕</button></h4>`;
        s += `<div class="ed-r4">${pole(`${i}.prstence.${j}.r1`, 'r od', p.r1, 'cislo', { min: 0, max: 250, krok: 0.5 })}${pole(`${i}.prstence.${j}.r2`, 'r do', p.r2, 'cislo', { min: 0, max: 250, krok: 0.5 })}${pole(`${i}.prstence.${j}.n`, 'dílků', p.n, 'cislo', { min: 1, max: 120 })}${pole(`${i}.prstence.${j}.posun`, 'posun °', p.posun || 0, 'cislo', { min: -360, max: 360, krok: 0.5 })}</div>`;
        s += pole(`${i}.prstence.${j}.texty`, 'Texty dílků (;)', p.texty, 'area');
        s += `<div class="r2">${pole(`${i}.prstence.${j}.orient`, 'Směr textu', p.orient, 'vyber', { moznosti: [['tecna', 'podél obvodu'], ['radial', 'paprsčitě']] })}<div>${pole(`${i}.prstence.${j}.vypln`, 'barevné výseče', p.vypln, 'chk')}${pole(`${i}.prstence.${j}.cary`, 'dělicí čáry', p.cary !== false, 'chk')}${pole(`${i}.prstence.${j}.nadpis`, 'písmo nadpisů', p.nadpis, 'chk')}</div></div></div>`;
      });
      (v.okna || []).forEach((o, j) => {
        s += `<div class="ed-polozka"><h4>Okénko ${j + 1}<button type="button" class="btn btn-sec btn-mini" data-akce="smazatOkno" data-i="${i}" data-j="${j}" aria-label="Smazat okénko">✕</button></h4>`;
        s += `<div class="r2">${pole(`${i}.okna.${j}.typ`, 'Tvar', o.typ, 'vyber', { moznosti: [['vysec', 'výseč'], ['kruh', 'kruh']] })}${pole(`${i}.okna.${j}.opak`, 'Opakovat po obvodu ×', o.opak, 'cislo', { min: 1, max: 36 })}</div>`;
        s += `<div class="ed-r4">${pole(`${i}.okna.${j}.r1`, o.typ === 'kruh' ? 'střed r' : 'r od', o.r1, 'cislo', { min: 0, max: 250, krok: 0.5 })}${o.typ === 'kruh' ? '<div></div>' : pole(`${i}.okna.${j}.r2`, 'r do', o.r2, 'cislo', { min: 0, max: 250, krok: 0.5 })}${pole(`${i}.okna.${j}.sirka`, o.typ === 'kruh' ? 'průměr mm' : 'šířka °', o.sirka, 'cislo', { min: 1, max: 360, krok: 0.5 })}${pole(`${i}.okna.${j}.uhel`, 'úhel °', o.uhel, 'cislo', { min: -360, max: 360, krok: 0.5 })}</div></div>`;
      });
      s += `<div class="tlacitka"><button type="button" class="btn btn-sec btn-mini" data-akce="pridatPrstenec" data-i="${i}">+ prstenec</button><button type="button" class="btn btn-sec btn-mini" data-akce="pridatOkno" data-i="${i}">+ okénko</button></div></div></details>`;
    });
    s += `<div class="tlacitka"><button type="button" class="btn btn-sec" data-akce="pridatVrstvu">+ vrstva</button><button type="button" class="btn btn-sec" data-akce="export">Uložit JSON</button><button type="button" class="btn btn-sec" data-akce="import">Načíst JSON</button></div>`;
    return s;
  }

  function vykresli(kont, model, zmena) {
    posledniKontejner = kont;
    kont.innerHTML = html(model);
    kont.onclick = (e) => {
      const b = e.target.closest('[data-akce]');
      if (!b) return;
      e.preventDefault();
      const i = +b.dataset.i, j = +b.dataset.j, a = b.dataset.akce, V = model.vrstvy;
      if (a === 'pridatVrstvu') { const r = V.length ? Math.max(15, (V[V.length - 1].r || 60) * 0.75) : 90; V.push(NOVA_VRSTVA(Math.round(r))); otevrene.add(V.length - 1); }
      else if (a === 'smazatVrstvu') { if (V.length > 1) V.splice(i, 1); }
      else if (a === 'nahoru' && i > 0) [V[i - 1], V[i]] = [V[i], V[i - 1]];
      else if (a === 'dolu' && i < V.length - 1) [V[i + 1], V[i]] = [V[i], V[i + 1]];
      else if (a === 'pridatPrstenec') { (V[i].prstence = V[i].prstence || []).push(NOVY_PRSTENEC()); }
      else if (a === 'smazatPrstenec') V[i].prstence.splice(j, 1);
      else if (a === 'pridatOkno') { (V[i].okna = V[i].okna || []).push(NOVE_OKNO()); }
      else if (a === 'smazatOkno') V[i].okna.splice(j, 1);
      else if (a === 'export') { zmena(model, 'export'); return; }
      else if (a === 'import') { zmena(model, 'import'); return; }
      else return;
      zmena(model, true);
      vykresli(kont, model, zmena);
    };
    const hodnota = (el) => (el.dataset.typ === 'bool' ? el.checked : el.dataset.typ === 'num' ? (el.value === '' ? 0 : +el.value) : el.value);
    const nastav = (el) => {
      const c = el.dataset.cesta.split('.');
      let o = model.vrstvy;
      for (let k = 0; k < c.length - 1; k++) o = o[isNaN(+c[k]) ? c[k] : +c[k]];
      o[c[c.length - 1]] = hodnota(el);
    };
    kont.oninput = (e) => { const el = e.target.closest('[data-cesta]'); if (!el) return; nastav(el); zmena(model, false); if (/\.nazev$/.test(el.dataset.cesta)) { const s = el.closest('details').querySelector('summary span'); s.textContent = (+el.dataset.cesta.split('.')[0] + 1) + '. ' + el.value; } };
    kont.onchange = (e) => {
      const el = e.target.closest('[data-cesta]'); if (!el) return; nastav(el);
      // změna tvaru/typu mění formulář
      if (/\.typ$/.test(el.dataset.cesta)) { zmena(model, true); vykresli(kont, model, zmena); } else zmena(model, false);
    };
    for (const d of kont.querySelectorAll('details.ed-vrstva')) d.addEventListener('toggle', () => { const i = +d.dataset.i; if (d.open) otevrene.add(i); else otevrene.delete(i); });
  }
  koren.VOLV_EDITOR = { vykresli, NOVA_VRSTVA, get kontejner() { return posledniKontejner; } };
})(typeof window !== 'undefined' ? window : globalThis);
