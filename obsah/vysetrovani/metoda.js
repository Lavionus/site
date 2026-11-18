/* Panel „Metoda, literatura, meze“ – společný pro analytické nástroje sekce Vyšetřování.
   Použití ve stránce:
     <script src="vysetrovani/metoda.js"></script>
     MetodaPanel.nastav({ nastroj: 'vyska_z_fotky', princip: [...], vzorce: [...], literatura: [...], meze: [...] });
     tlačítko: <button data-metoda>📐 Metoda a meze</button>  (nebo MetodaPanel.otevri())
   Tabulka přesnosti se bere z vysetrovani/validace.js (generuje tools/vysetrovani_validace.mjs,
   ručně neupravovat) – načte se až při otevření panelu. */
(function () {
  'use strict';
  let cfg = null, dlg = null;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cislo = (v, d) => typeof v === 'number' && isFinite(v) ? v.toLocaleString(document.documentElement.lang || 'cs', { maximumFractionDigits: d == null ? 1 : d }) : esc(v == null ? '–' : v);

  // cesta k validace.js vedle tohoto skriptu (stránka může být v obsah/ i jinde)
  const zde = (document.currentScript && document.currentScript.src) || '';
  const cestaValidace = zde ? zde.replace(/metoda\.js(\?.*)?$/, 'validace.js') : 'vysetrovani/validace.js';

  function nactiValidaci() {
    if (window.VALIDACE) return Promise.resolve(window.VALIDACE);
    return new Promise(ok => {
      const s = document.createElement('script');
      s.src = cestaValidace;
      s.onload = () => ok(window.VALIDACE || null);
      s.onerror = () => ok(null);
      document.head.appendChild(s);
    });
  }

  function css() {
    const st = document.createElement('style');
    st.textContent = `
      .mtd-dlg{max-width:860px;width:calc(100% - 24px);max-height:88vh;padding:0;border:1px solid var(--border);border-radius:var(--radius,8px);
        background:var(--bg-elevated);color:var(--text);box-shadow:var(--shadow)}
      .mtd-dlg::backdrop{background:rgba(0,0,0,.55)}
      .mtd-hlava{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--bg-elevated)}
      .mtd-hlava h2{margin:0;font-size:1.1rem;flex:1}
      .mtd-hlava button{background:var(--bg-control);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font:inherit}
      .mtd-telo{padding:4px 18px 18px;font-size:.92rem;line-height:1.5}
      .mtd-telo h3{font-size:1rem;margin:16px 0 6px;color:var(--accent)}
      .mtd-telo p{margin:0 0 8px}
      .mtd-telo ul,.mtd-telo ol{margin:0 0 8px;padding-left:20px}
      .mtd-telo li{margin:2px 0}
      .mtd-vzorec{font-family:ui-monospace,monospace;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;padding:6px 10px;margin:4px 0;overflow-x:auto;white-space:pre}
      .mtd-tab{overflow-x:auto}
      .mtd-tab table{border-collapse:collapse;width:100%;font-size:.85rem}
      .mtd-tab th,.mtd-tab td{border-bottom:1px solid var(--border);padding:5px 8px;text-align:left;vertical-align:top}
      .mtd-tab th{color:var(--text-faint);font-weight:600}
      .mtd-tab td.c{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
      .mtd-ok{color:var(--ok)} .mtd-ne{color:var(--danger)}
      .mtd-souhrn{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 8px}
      .mtd-souhrn span{background:var(--bg-panel);border:1px solid var(--border);border-radius:999px;padding:2px 10px;font-size:.82rem}
      .mtd-pozn{color:var(--text-faint);font-size:.82rem}
      .mtd-varovani{border-left:3px solid var(--warn);padding:6px 10px;background:var(--bg-panel);border-radius:4px;margin:10px 0 0}`;
    document.head.appendChild(st);
  }

  function tabulka(v) {
    if (!v) return '<p class="mtd-pozn">Tabulka ověření zatím není k dispozici.</p>';
    const s = v.souhrn || {}, kat = v.druh === 'kategorie';
    const cipy = [
      `${s.n} ukázek`,
      kat ? `správně ${s.spravne}/${s.n}` : s.sirka == null ? '' : `pravda v intervalu ${s.pokryto}/${s.n}`,
      !kat && s.mae != null ? `průměrná abs. chyba ${cislo(s.mae, 2)} ${esc(v.jednotka || '')}` : '',
      !kat && s.sirka != null ? `průměrná šířka intervalu ${cislo(s.sirka, 1)} ${esc(v.jednotka || '')}` : ''
    ].filter(Boolean).map(t => `<span>${t}</span>`).join('');
    const hlava = kat ? '<tr><th>Ukázka</th><th>Pravda</th><th>Výsledek nástroje</th><th></th></tr>'
      : `<tr><th>Ukázka</th><th>Pravda</th><th>Odhad</th><th>Interval</th><th>Chyba</th><th></th></tr>`;
    const radky = (v.radky || []).map(r => kat
      ? `<tr><td>${esc(r.ukazka)}</td><td>${esc(r.pravda)}</td><td>${esc(r.odhad)}</td><td class="${r.ok ? 'mtd-ok' : 'mtd-ne'}">${r.ok ? '✓' : '✗'}</td></tr>`
      : `<tr><td>${esc(r.ukazka)}</td><td class="c">${cislo(r.pravda, 2)}</td><td class="c">${cislo(r.odhad, 2)}</td>
           <td class="c">${r.od == null ? '–' : cislo(r.od, 1) + ' – ' + cislo(r.do, 1)}</td><td class="c">${cislo(r.chyba, 2)}</td>
           ${r.ok == null ? '<td></td>' : `<td class="${r.ok ? 'mtd-ok' : 'mtd-ne'}" title="${r.ok ? 'pravda leží v intervalu' : 'pravda mimo interval'}">${r.ok ? '✓' : '✗'}</td>`}</tr>`).join('');
    return `<div class="mtd-souhrn">${cipy}</div>
      ${v.velicina ? `<p class="mtd-pozn">Veličina: ${esc(v.velicina)}${v.jednotka ? ' [' + esc(v.jednotka) + ']' : ''}. ${esc(v.interval || '')}</p>` : ''}
      <div class="mtd-tab"><table><thead>${hlava}</thead><tbody>${radky}</tbody></table></div>
      ${v.poznamka ? `<p class="mtd-pozn">${esc(v.poznamka)}</p>` : ''}`;
  }

  function vykresli(val) {
    const v = val && val.nastroje ? val.nastroje[cfg.nastroj] : null;
    const lit = (cfg.literatura || []).map(l => `<li>${esc(l)}</li>`).join('');
    dlg.querySelector('.mtd-telo').innerHTML = `
      <h3>Princip</h3>${(cfg.princip || []).map(p => `<p>${esc(p)}</p>`).join('')}
      ${(cfg.vzorce || []).length ? '<h3>Vzorce a postup</h3>' + cfg.vzorce.map(z => `<div class="mtd-vzorec">${esc(z)}</div>`).join('') : ''}
      ${(cfg.predpoklady || []).length ? '<h3>Předpoklady</h3><ul>' + cfg.predpoklady.map(m => `<li>${esc(m)}</li>`).join('') + '</ul>' : ''}
      <h3>Meze a zdroje chyb</h3><ul>${(cfg.meze || []).map(m => `<li>${esc(m)}</li>`).join('')}</ul>
      <h3>Ověření na ukázkách se známou pravdou</h3>
      ${tabulka(v)}
      <p class="mtd-varovani">Ukázky jsou syntetické – vznikly se známým výsledkem, některé záměrně mimo předpoklady modelu. Ověřují výpočet a chování intervalu (co interval vyjadřuje, uvádí popis nad tabulkou), ne přesnost samotného modelu na skutečných datech.${val && val.datum ? ' Tabulka vygenerována ' + esc(val.datum) + '.' : ''}</p>
      ${lit ? `<h3>Literatura</h3><ol>${lit}</ol>` : ''}
      <p class="mtd-pozn">Nejde o certifikovaný znalecký nástroj. Výsledky slouží k výuce, přípravě a kontrole úvah.</p>`;
  }

  async function otevri() {
    if (!cfg) return;
    if (!dlg) {
      css();
      dlg = document.createElement('dialog');
      dlg.className = 'mtd-dlg';
      dlg.innerHTML = `<div class="mtd-hlava"><h2>📐 Metoda, literatura, meze</h2><button type="button" data-mtd-zavri aria-label="Zavřít">✕</button></div><div class="mtd-telo"></div>`;
      dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('[data-mtd-zavri]')) dlg.close(); });
      document.body.appendChild(dlg);
    }
    if (dlg.open) return;   // druhé otevření (dvojklik, tlačítko i zkratka) jen ponechá otevřený panel
    vykresli(null);
    dlg.showModal();
    vykresli(await nactiValidaci());
  }

  document.addEventListener('click', e => { if (e.target.closest('[data-metoda]')) { e.preventDefault(); otevri(); } });

  window.MetodaPanel = { nastav: c => { cfg = c; }, otevri, nactiValidaci, tabulka };
})();
