/* dalekohled/denik.js – deník pozorování: záznamy s automaticky vyplněnou výbavou a podmínkami,
   úpravy, filtr, statistika, export CSV/JSON a import JSON. Úložiště: localStorage webapp_dalekohled_denik. */
(function () {
  'use strict';
  const APP = window.DALEK_APP, D = window.DALEK, K = window.DALEK_KAT, A = window.ASTRO, V = window.DALEK_VYBAVA;
  const $ = id => document.getElementById(id);
  const KLIC = 'webapp_dalekohled_denik';
  let zaznamy = [];
  try { zaznamy = JSON.parse(localStorage.getItem(KLIC) || '[]'); if (!Array.isArray(zaznamy)) zaznamy = []; } catch (e) { zaznamy = []; }
  const uloz = () => { try { localStorage.setItem(KLIC, JSON.stringify(zaznamy)); } catch (e) { APP.zprava('Deník se nepodařilo uložit (plné úložiště?).'); } };
  const ANTONIADI = ['', 'I – dokonalý', 'II – drobné záchvěvy', 'III – průměrný', 'IV – špatný', 'V – velmi špatný'];

  const panel = $('panel-denik');
  panel.innerHTML = `
    <div class="panel-mrizka">
      <div class="card">
        <h2 id="dnNadpis">Nový záznam</h2>
        <label for="dnObjekt" style="margin-top:0">Objekt</label>
        <input id="dnObjekt" placeholder="vyberte objekt nebo napište">
        <div class="r2">
          <div><label for="dnCas">Čas</label><input id="dnCas" type="datetime-local"></div>
          <div><label for="dnHodn">Viditelnost</label><select id="dnHodn"><option value="5">5 – výborně</option><option value="4">4 – dobře</option><option value="3" selected>3 – zřetelně</option><option value="2">2 – obtížně</option><option value="1">1 – na mezi / bočním pohledem</option><option value="0">0 – nenalezeno</option></select></div>
        </div>
        <label for="dnVybava">Vybavení</label><input id="dnVybava">
        <div class="r2">
          <div><label for="dnSeeing">Seeing (Antoniadi)</label><select id="dnSeeing">${ANTONIADI.slice(1).map((t, i) => `<option value="${i + 1}">${t}</option>`).join('')}</select></div>
          <div><label for="dnSqm">Jas oblohy SQM</label><input id="dnSqm" type="number" step="0.01"></div>
        </div>
        <label for="dnMisto">Místo</label><input id="dnMisto">
        <label for="dnPozn">Poznámky (co jste viděli, kresba slovy, barvy, detaily)</label>
        <textarea id="dnPozn" rows="5"></textarea>
        <div class="tlacitka">
          <button class="btn" id="dnUlozit">💾 Uložit záznam</button>
          <button class="btn btn-sec" id="dnPredvyplnit" title="Vyplnit podle aktuálního stavu simulace">↻ Podle simulace</button>
          <button class="btn btn-sec" id="dnZrusit" hidden>Zrušit úpravu</button>
        </div>
      </div>
      <div class="card">
        <h2>Záznamy <small id="dnStat"></small></h2>
        <div class="r2">
          <div><input id="dnFiltr" type="search" placeholder="filtr: objekt, poznámka, datum…"></div>
          <div class="tlacitka" style="margin-top:0">
            <button class="btn btn-sec btn-mini" id="dnCsv">⬇ CSV</button>
            <button class="btn btn-sec btn-mini" id="dnJson">⬇ JSON</button>
            <label class="btn btn-sec btn-mini" style="display:inline-flex;align-items:center;margin:0;color:var(--text)">⬆ Import<input type="file" id="dnImport" accept=".json,application/json" hidden></label>
          </div>
        </div>
        <div id="dnSeznam" style="margin-top:8px;max-height:620px;overflow:auto"></div>
      </div>
    </div>`;

  let upravuji = null, objektId = null;
  const lokal = d => { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
  function popisVybavy() {
    const S = APP.S, dal = APP.dalekohled();
    if (APP.fotoRezim()) return `${dal.nazev} + ${V.kamera(S.kamera).n}, ${S.expozice} s`;
    const r = APP.ramec();
    const f = V.filtr(S.filtr);
    return `${dal.nazev}, ${dal.pevneZvetseni ? '' : APP.okular().f + ' mm, '}${r ? Math.round(r.o.M) + '×' : ''}${f.id !== 'zadny' ? ', filtr ' + f.n : ''}`;
  }
  function predvyplnit(id) {
    const S = APP.S;
    objektId = id || S.cil || (APP.posledni() && APP.posledni().nejblizsi && APP.posledni().nejblizsi.id) || null;
    const ob = objektId && K.objekt(objektId);
    $('dnObjekt').value = ob ? ob.nazev : '';
    $('dnCas').value = lokal(A.dataZJd(APP.jdTed()));
    $('dnVybava').value = popisVybavy();
    $('dnSeeing').value = S.seeing < 1 ? 1 : S.seeing < 1.8 ? 2 : S.seeing < 3 ? 3 : S.seeing < 4.5 ? 4 : 5;
    const r = APP.ramec();
    $('dnSqm').value = r ? (r.sb - (r.filtr ? r.filtr.pozadi : 0)).toFixed(2) : D.BORTLE[S.bortle];
    $('dnMisto').value = `${(APP.MISTA[S.misto] || [''])[0] === 'Vlastní' ? '' : (APP.MISTA[S.misto] || [''])[0] + ' '}(${S.lat.toFixed(3)}°, ${S.lon.toFixed(3)}°)`;
  }
  function ulozit() {
    const nazev = $('dnObjekt').value.trim();
    if (!nazev) return APP.zprava('Vyplňte objekt.');
    const ob = objektId && K.objekt(objektId);
    const z = {
      id: upravuji || 'z' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      objekt: (ob && ob.nazev === nazev) ? objektId : null, nazev,
      cas: new Date($('dnCas').value).toISOString(), hodnoceni: +$('dnHodn').value, vybava: $('dnVybava').value.trim(),
      seeing: +$('dnSeeing').value, sqm: +$('dnSqm').value || null, misto: $('dnMisto').value.trim(), poznamka: $('dnPozn').value.trim(),
    };
    if (upravuji) zaznamy = zaznamy.map(x => x.id === upravuji ? z : x); else zaznamy.push(z);
    zaznamy.sort((a, b) => b.cas.localeCompare(a.cas));
    uloz();
    upravuji = null; $('dnNadpis').textContent = 'Nový záznam'; $('dnZrusit').hidden = true; $('dnPozn').value = '';
    vykresli();
    APP.zprava('Záznam uložen do deníku.');
    APP.prepocet();
  }
  function uprav(z) {
    upravuji = z.id; objektId = z.objekt;
    $('dnNadpis').textContent = 'Úprava záznamu'; $('dnZrusit').hidden = false;
    $('dnObjekt').value = z.nazev; $('dnCas').value = lokal(new Date(z.cas)); $('dnHodn').value = z.hodnoceni;
    $('dnVybava').value = z.vybava || ''; $('dnSeeing').value = z.seeing || 3; $('dnSqm').value = z.sqm || ''; $('dnMisto').value = z.misto || ''; $('dnPozn').value = z.poznamka || '';
    panel.scrollIntoView({ behavior: 'smooth' });
  }
  function vykresli() {
    const q = K.normal($('dnFiltr').value || '');
    const box = $('dnSeznam'); box.innerHTML = '';
    const vybrane = zaznamy.filter(z => !q || K.normal([z.nazev, z.poznamka, z.vybava, z.misto, new Date(z.cas).toLocaleDateString('cs-CZ')].join(' ')).includes(q));
    const objekty = new Set(zaznamy.map(z => z.objekt || z.nazev));
    const noci = new Set(zaznamy.map(z => { const d = new Date(new Date(z.cas).getTime() - 12 * 3600e3); return d.toDateString(); }));
    const mes = new Set(zaznamy.filter(z => z.objekt && z.objekt.startsWith('d:M') && /^d:M\d+$/.test(z.objekt)).map(z => z.objekt));
    $('dnStat').textContent = `${zaznamy.length} záznamů · ${objekty.size} objektů · ${noci.size} nocí · Messier ${mes.size}/110`;
    if (!vybrane.length) { box.innerHTML = '<div class="info">Zatím žádné záznamy. Zapisovat můžete i tlačítkem „📓 Zapsat“ v kartě objektu.</div>'; return; }
    for (const z of vybrane) {
      const d = document.createElement('div'); d.className = 'denik-polozka';
      const hl = document.createElement('div'); hl.className = 'hl';
      const b = document.createElement('b'); b.textContent = z.nazev; if (z.objekt) { b.style.cursor = 'pointer'; b.title = 'Namířit'; b.addEventListener('click', () => APP.vyber(z.objekt, true)); }
      const s = document.createElement('span'); s.textContent = '★'.repeat(z.hodnoceni) + '☆'.repeat(5 - z.hodnoceni);
      s.style.color = '#e0a63f';
      hl.append(b, s);
      const meta = document.createElement('div'); meta.className = 'meta';
      meta.textContent = `${new Date(z.cas).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${z.vybava || ''} · seeing ${ANTONIADI[z.seeing] || '–'}${z.sqm ? ' · SQM ' + String(z.sqm).replace('.', ',') : ''}${z.misto ? ' · ' + z.misto : ''}`;
      const p = document.createElement('div'); p.textContent = z.poznamka || ''; p.style.whiteSpace = 'pre-wrap'; p.style.marginTop = '4px';
      const t = document.createElement('div'); t.className = 'tlacitka';
      const bu = document.createElement('button'); bu.className = 'btn btn-sec btn-mini'; bu.textContent = '✎ Upravit'; bu.addEventListener('click', () => uprav(z));
      const bs = document.createElement('button'); bs.className = 'btn btn-sec btn-mini'; bs.textContent = '🗑 Smazat';
      bs.addEventListener('click', async () => {
        const ok = window.Dialog ? await window.Dialog.potvrd('Smazat záznam „' + z.nazev + '“?') : confirm('Smazat záznam?');
        if (!ok) return; zaznamy = zaznamy.filter(x => x.id !== z.id); uloz(); vykresli(); APP.prepocet();
      });
      t.append(bu, bs);
      d.append(hl, meta, p, t);
      box.appendChild(d);
    }
  }
  $('dnUlozit').addEventListener('click', ulozit);
  $('dnPredvyplnit').addEventListener('click', () => predvyplnit());
  $('dnZrusit').addEventListener('click', () => { upravuji = null; $('dnNadpis').textContent = 'Nový záznam'; $('dnZrusit').hidden = true; predvyplnit(); });
  $('dnFiltr').addEventListener('input', vykresli);
  $('dnObjekt').addEventListener('change', () => {
    const r = K.hledej($('dnObjekt').value, 1)[0];
    if (r && r.skore > 60) { objektId = r.id; $('dnObjekt').value = r.nazev; }
  });
  $('dnCsv').addEventListener('click', () => {
    const esc = x => '"' + String(x ?? '').replace(/"/g, '""') + '"';
    const r = [['cas', 'objekt', 'id', 'hodnoceni', 'vybaveni', 'seeing_antoniadi', 'sqm', 'misto', 'poznamka'].join(';')];
    for (const z of zaznamy) r.push([new Date(z.cas).toLocaleString('cs-CZ'), esc(z.nazev), z.objekt || '', z.hodnoceni, esc(z.vybava), z.seeing, z.sqm || '', esc(z.misto), esc(z.poznamka)].join(';'));
    const b = new Blob(['﻿' + r.join('\r\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'denik-pozorovani.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $('dnJson').addEventListener('click', () => {
    const b = new Blob([JSON.stringify({ format: 'dalekohled-denik-1', zaznamy }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'denik-pozorovani.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $('dnImport').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (d.format !== 'dalekohled-denik-1' || !Array.isArray(d.zaznamy)) throw new Error('neznámý formát');
      const ids = new Set(zaznamy.map(z => z.id));
      let n = 0;
      for (const z of d.zaznamy) if (z && z.id && z.nazev && z.cas && !ids.has(z.id)) { zaznamy.push(z); n++; }
      zaznamy.sort((a, b) => b.cas.localeCompare(a.cas)); uloz(); vykresli(); APP.zprava(`Importováno ${n} záznamů.`);
    } catch (er) { APP.zprava('Import se nezdařil: ' + er.message); }
    e.target.value = '';
  });
  $('btnDoDeniku').addEventListener('click', () => {
    APP.otevriZalozku('denik');
    upravuji = null; $('dnNadpis').textContent = 'Nový záznam'; $('dnZrusit').hidden = true; $('dnPozn').value = '';
    predvyplnit();
    panel.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => $('dnPozn').focus(), 400);
  });
  APP.naZalozku(p => { if (p === 'denik') { if (!$('dnObjekt').value) predvyplnit(); vykresli(); } });
  predvyplnit(); vykresli();
  window.DALEK_DENIK = { pozorovane: () => new Set(zaznamy.filter(z => z.objekt && z.hodnoceni > 0).map(z => z.objekt)), zaznamy: () => zaznamy };
})();
