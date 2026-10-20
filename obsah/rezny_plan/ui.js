/* ============================================================
   Řezný plán – uživatelské rozhraní
   ============================================================ */
(function () {
  'use strict';
  const RP = window.RP, RPV = window.RPV, RPP = window.RPP;
  const $ = (id) => document.getElementById(id);
  const KLIC = 'webapp_rezny_plan', KLIC_PROJEKTY = 'webapp_rezny_plan_projekty', KLIC_ZBYTKY = 'webapp_rezny_plan_zbytky', KLIC_VSTUP = 'webapp_rezny_plan_vstup', KLIC_UI = 'webapp_rezny_plan_ui';
  const fmt = RP.fmt;
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const toast = (t, ch) => (window.Dialog ? (ch ? Dialog.chyba(t) : Dialog.info(t)) : console.log(t));
  const novyId = (p) => p + Math.random().toString(36).slice(2, 7);
  const USILI = { rychle: 500, normalni: 2000, dukladne: 8000 };

  /* ---------- stav ---------- */
  function normalizuj(p) {
    const z = RP.predvolba('kuchyn');
    const P = {
      verze: 1, nazev: String(p.nazev || ''), rezim2d: p.rezim2d === 'volne' ? 'volne' : 'gilotina',
      nast: Object.assign(RP.vychoziNastaveni(), p.nast || {}),
      desky: Array.isArray(p.desky) ? p.desky : z.desky, hrany: Array.isArray(p.hrany) ? p.hrany : [],
      dilce: Array.isArray(p.dilce) ? p.dilce : [], polotovary1D: Array.isArray(p.polotovary1D) ? p.polotovary1D : [], kusy1D: Array.isArray(p.kusy1D) ? p.kusy1D : [],
    };
    for (const d of P.desky) { if (!d.id) d.id = novyId('D'); if (d.ks === '') d.ks = null; }
    for (const d of P.dilce) { if (!d.id) d.id = novyId('P'); d.hrany = Object.assign({ d1: '', d2: '', s1: '', s2: '' }, d.hrany || {}); }
    for (const h of P.hrany) if (!h.id) h.id = novyId('H');
    for (const t of P.polotovary1D) if (!t.id) t.id = novyId('T');
    for (const q of P.kusy1D) if (!q.id) q.id = novyId('K');
    return P;
  }
  function nacti(klic, vych) { try { const v = JSON.parse(localStorage.getItem(klic) || 'null'); return v == null ? vych : v; } catch (e) { return vych; } }
  function zapis(klic, v) { try { localStorage.setItem(klic, JSON.stringify(v)); return true; } catch (e) { toast('Úložiště prohlížeče je plné.', true); return false; } }
  let P = normalizuj(nacti(KLIC, null) || RP.vychoziProjekt());
  let Z = nacti(KLIC_ZBYTKY, []);
  if (!Array.isArray(Z)) Z = [];
  const UI = Object.assign({ deska: 0, rezy: true, koty: true, zbytky: true, hrany: true, stitky: 'a4_3x8', qr: true, ramecky: false, zakl: 'princip', rozlozit: 0.6 }, nacti(KLIC_UI, {}) || {});
  let V = null, vybranyDil = null, ulozT = 0;
  const uloz = () => { clearTimeout(ulozT); ulozT = setTimeout(() => { zapis(KLIC, P); zapis(KLIC_UI, UI); }, 250); };

  /* ---------- obecná editovatelná tabulka ---------- */
  /** sloupce: {k, n, t:'text'|'num'|'chk'|'sel'|'hrana', cls, list, opts, title, prazdneNull, naZmenu} */
  function tabulka(el, sloupce, radky, o) {
    o = o || {};
    let h = '<thead><tr>' + (o.cisla ? '<th class="r">#</th>' : '') + sloupce.map((s) => `<th class="${s.t === 'chk' ? 'c' : ''}" title="${esc(s.title || '')}">${esc(s.n)}</th>`).join('') + '<th></th></tr></thead><tbody>';
    radky.forEach((r, i) => {
      h += `<tr data-i="${i}"${o.vybrany && o.vybrany(i) ? ' class="vybrany"' : ''}>` + (o.cisla ? `<td class="r">${i + 1}</td>` : '');
      for (const s of sloupce) {
        const v = s.get ? s.get(r) : r[s.k];
        const at = `data-k="${s.k}" aria-label="${esc(s.n)} ${i + 1}"`;
        if (s.t === 'chk') h += `<td class="c"><input type="checkbox" ${at}${v ? ' checked' : ''}></td>`;
        else if (s.t === 'sel' || s.t === 'hrana') {
          const opts = s.opts();
          h += `<td><select ${at}>${opts.map(([a, b]) => `<option value="${esc(a)}"${String(v == null ? '' : v) === String(a) ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select></td>`;
        } else if (s.t === 'num') h += `<td><input type="number" inputmode="decimal" step="${s.krok || 'any'}" min="0" class="${s.cls || ''}" ${at} value="${v == null ? '' : esc(v)}"${s.ph ? ` placeholder="${esc(s.ph)}"` : ''}></td>`;
        else if (s.t === 'ro') h += `<td class="${s.cls || ''}">${esc(v)}</td>`;
        else h += `<td><input type="text" class="${s.cls || ''}" ${at} value="${esc(v)}"${s.list ? ` list="${s.list}"` : ''}></td>`;
      }
      h += `<td><button type="button" class="smaz" data-smaz="${i}" title="Smazat řádek" aria-label="Smazat řádek ${i + 1}">✕</button></td></tr>`;
    });
    if (!radky.length) h += `<tr><td colspan="${sloupce.length + 2}" class="info" style="padding:8px">${esc(o.prazdne || 'Žádné řádky.')}</td></tr>`;
    el.innerHTML = h + '</tbody>';
    const zmena = (e, typ) => {
      const inp = e.target, k = inp.dataset.k; if (!k) return;
      const tr = inp.closest('tr'), i = +tr.dataset.i, r = radky[i], s = sloupce.find((x) => x.k === k);
      if (!r || !s) return;
      if (s.naZmenu && typ !== 'change') return;
      const stara = s.get ? s.get(r) : r[k];
      let v;
      if (s.t === 'chk') v = inp.checked;
      else if (s.t === 'num') v = inp.value === '' ? (s.prazdneNull ? null : 0) : RP.cislo(inp.value, 0);
      else v = inp.value;
      if (s.set) s.set(r, v); else r[k] = v;
      if (s.naZmenu) s.naZmenu(r, stara, v);
      uloz(); if (o.zmena) o.zmena(r, k, typ);
    };
    el.oninput = (e) => zmena(e, 'input');
    el.onchange = (e) => zmena(e, 'change');
    el.onclick = (e) => {
      const b = e.target.closest('[data-smaz]');
      if (b) { radky.splice(+b.dataset.smaz, 1); uloz(); if (o.smazano) o.smazano(); return; }
      const tr = e.target.closest('tr[data-i]');
      if (tr && o.klik) o.klik(+tr.dataset.i, e);
    };
  }

  /* ---------- tabulky zadání ---------- */
  const moznostiHran = () => [['', '–']].concat(P.hrany.map((h) => [h.id, h.id]));
  function datalisty() {
    const m = new Set(P.desky.map((d) => d.material).concat(P.dilce.map((d) => d.material)).filter(Boolean));
    $('dlMaterialy').innerHTML = [...m].map((x) => `<option value="${esc(x)}">`).join('');
    const pr = new Set(P.polotovary1D.map((d) => d.profil).concat(P.kusy1D.map((d) => d.profil)).concat(RP.PROFILY).filter(Boolean));
    $('dlProfily').innerHTML = [...pr].map((x) => `<option value="${esc(x)}">`).join('');
  }
  function kresliDilce() {
    const hrSl = (s, n) => ({ k: s, n, t: 'hrana', opts: moznostiHran, get: (r) => r.hrany[s], set: (r, v) => { r.hrany[s] = v; }, title: s.startsWith('d') ? 'podélná strana (podél délky)' : 'příčná strana' });
    tabulka($('tabDilce'), [
      { k: 'nazev', n: 'Název', cls: 'nazev' }, { k: 'w', n: 'Délka', t: 'num', krok: 0.5 }, { k: 'h', n: 'Šířka', t: 'num', krok: 0.5 }, { k: 'ks', n: 'Ks', t: 'num', cls: 'uzke', krok: 1 },
      { k: 'material', n: 'Materiál', cls: 'mat', list: 'dlMaterialy' }, { k: 'vlakna', n: '↕', t: 'chk', title: 'zachovat směr vláken / dekoru (neotáčet)' },
      hrSl('d1', 'D1'), hrSl('d2', 'D2'), hrSl('s1', 'Š1'), hrSl('s2', 'Š2'), { k: 'pozn', n: 'Poznámka', cls: 'nazev' },
    ], P.dilce, { cisla: true, prazdne: 'Žádné dílce – přidejte řádek nebo vložte tabulku.', zmena: (r, k, typ) => { if (k === 'material' && typ === 'change') datalisty(); planuj(); }, smazano: () => { kresliDilce(); planuj(); }, vybrany: (i) => vybranyDil && vybranyDil.di === i });
    let n = 0; for (const d of P.dilce) n += Math.max(0, Math.round(RP.cislo(d.ks, 0)));
    $('pocetDilcu').textContent = `${P.dilce.length} řádků, ${n} ks`;
  }
  function kresliDesky() {
    tabulka($('tabDesky'), [
      { k: 'material', n: 'Materiál', cls: 'mat', list: 'dlMaterialy' }, { k: 'w', n: 'Délka', t: 'num' }, { k: 'h', n: 'Šířka', t: 'num' }, { k: 'tl', n: 'Tl.', t: 'num', cls: 'uzke', krok: 0.5 },
      { k: 'cena', n: 'Kč/ks', t: 'num', krok: 1 }, { k: 'ks', n: 'Ks', t: 'num', cls: 'uzke', prazdneNull: true, ph: '∞', krok: 1 }, { k: 'vlakna', n: 'Vlákna', t: 'chk', title: 'deska má dekor / směr vláken podél délky' },
    ], P.desky, { prazdne: 'Žádné desky.', zmena: (r, k, typ) => { if (typ === 'change') datalisty(); planuj(); }, smazano: () => { kresliDesky(); planuj(); } });
  }
  function kresliHrany() {
    tabulka($('tabHrany'), [
      { k: 'id', n: 'Kód', cls: 'uzke', naZmenu: (r, stara, nova) => { for (const d of P.dilce) for (const s of ['d1', 'd2', 's1', 's2']) if (d.hrany[s] === stara) d.hrany[s] = nova; kresliDilce(); } },
      { k: 'nazev', n: 'Název', cls: 'nazev' }, { k: 'tl', n: 'Tl.', t: 'num', cls: 'uzke', krok: 0.1 }, { k: 'sirka', n: 'Šířka', t: 'num', cls: 'uzke' }, { k: 'cena', n: 'Kč/m', t: 'num', cls: 'uzke', krok: 0.5 },
    ], P.hrany, { prazdne: 'Bez hran.', zmena: () => planuj(), smazano: () => { kresliHrany(); kresliDilce(); planuj(); } });
  }
  function kresliPolotovary() {
    tabulka($('tabPolotovary'), [
      { k: 'nazev', n: 'Název', cls: 'nazev' }, { k: 'profil', n: 'Profil', cls: 'mat', list: 'dlProfily' }, { k: 'L', n: 'Délka', t: 'num' },
      { k: 'cena', n: 'Kč/ks', t: 'num', cls: 'uzke' }, { k: 'ks', n: 'Ks', t: 'num', cls: 'uzke', prazdneNull: true, ph: '∞', krok: 1 },
    ], P.polotovary1D, { prazdne: 'Žádné polotovary.', zmena: (r, k, typ) => { if (typ === 'change') datalisty(); planuj(); }, smazano: () => { kresliPolotovary(); planuj(); } });
  }
  function kresliKusy() {
    tabulka($('tabKusy'), [
      { k: 'nazev', n: 'Název', cls: 'nazev' }, { k: 'L', n: 'Délka', t: 'num', krok: 0.5 }, { k: 'ks', n: 'Ks', t: 'num', cls: 'uzke', krok: 1 }, { k: 'profil', n: 'Profil', cls: 'mat', list: 'dlProfily' },
    ], P.kusy1D, { cisla: true, prazdne: 'Žádné 1D kusy.', zmena: (r, k, typ) => { if (typ === 'change') datalisty(); planuj(); }, smazano: () => { kresliKusy(); planuj(); } });
    let n = 0; for (const q of P.kusy1D) n += Math.max(0, Math.round(RP.cislo(q.ks, 0)));
    $('pocetKusu').textContent = `${P.kusy1D.length} řádků, ${n} ks`;
  }
  function kresliZbytky() {
    const radky = Z;
    tabulka($('tabZbytky'), [
      { k: 'typ', n: 'Typ', t: 'ro', get: (r) => (r.jedno ? '1D' : '2D') },
      { k: 'material', n: 'Materiál / profil', cls: 'mat', get: (r) => (r.jedno ? r.profil : r.material), set: (r, v) => { if (r.jedno) r.profil = v; else r.material = v; } },
      { k: 'w', n: 'Délka', t: 'num', get: (r) => (r.jedno ? r.L : r.w), set: (r, v) => { if (r.jedno) r.L = v; else r.w = v; } },
      { k: 'h', n: 'Šířka', t: 'num', get: (r) => (r.jedno ? '' : r.h), set: (r, v) => { if (!r.jedno) r.h = v; } },
      { k: 'datum', n: 'Datum', t: 'ro' },
    ], radky, { prazdne: 'Sklad zbytků je prázdný.', zmena: () => { zapis(KLIC_ZBYTKY, Z); planuj(); }, smazano: () => { zapis(KLIC_ZBYTKY, Z); kresliZbytky(); planuj(); } });
    $('pocetZbytku').textContent = Z.length ? `${Z.length} ks` : '';
  }
  function kresliNastaveni() {
    const n = P.nast;
    for (const k of ['rez', 'okraj', 'prvniRez', 'premill', 'pridavekHrany', 'rezervaHran', 'minZbytekStrana', 'minZbytekPlocha', 'usili', 'rez1D', 'okraj1D', 'minZbytek1D']) { const e = $('n_' + k); if (e) e.value = n[k]; }
    $('n_odecistHranu').checked = !!n.odecistHranu; $('n_zbytkyZeSkladu').checked = n.zbytkyZeSkladu !== false;
    for (const b of $('rezimy').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.rezim === P.rezim2d));
    $('n_prvniRez').disabled = P.rezim2d === 'volne';
    $('nazevProjektu').value = P.nazev || '';
  }
  function kresliVse() { datalisty(); kresliNastaveni(); kresliDesky(); kresliHrany(); kresliDilce(); kresliPolotovary(); kresliKusy(); kresliZbytky(); }

  // nastavení
  for (const k of ['rez', 'okraj', 'prvniRez', 'premill', 'pridavekHrany', 'rezervaHran', 'minZbytekStrana', 'minZbytekPlocha', 'usili', 'rez1D', 'okraj1D', 'minZbytek1D']) {
    const e = $('n_' + k);
    e.addEventListener(e.tagName === 'SELECT' ? 'change' : 'input', () => { P.nast[k] = e.tagName === 'SELECT' ? e.value : RP.cislo(e.value, 0); uloz(); planuj(); });
  }
  $('n_odecistHranu').addEventListener('change', (e) => { P.nast.odecistHranu = e.target.checked; uloz(); planuj(); });
  $('n_zbytkyZeSkladu').addEventListener('change', (e) => { P.nast.zbytkyZeSkladu = e.target.checked; uloz(); planuj(); });
  $('rezimy').addEventListener('click', (e) => { const b = e.target.closest('button[data-rezim]'); if (!b) return; P.rezim2d = b.dataset.rezim; kresliNastaveni(); uloz(); planuj(); });
  $('nazevProjektu').addEventListener('input', (e) => { P.nazev = e.target.value; uloz(); });

  // přidávání řádků
  $('pridatFormat').innerHTML = RP.FORMATY.map((f, i) => `<option value="${i}">${esc(f.nazev)}</option>`).join('');
  $('btnPridatDesku').onclick = () => {
    const f = RP.FORMATY[+$('pridatFormat').value] || RP.FORMATY[0];
    const mat = (P.dilce.find((d) => !P.desky.some((t) => RP.normMat(t.material) === RP.normMat(d.material))) || {}).material || f.nazev.split(' ')[0] + ' 18';
    P.desky.push({ id: novyId('D'), material: mat, w: f.w, h: f.h, tl: RP.cislo((mat.match(/(\d+(?:[.,]\d+)?)\s*$/) || [])[1], 18), cena: 0, ks: null, vlakna: false, zbytek: false });
    uloz(); datalisty(); kresliDesky(); planuj();
  };
  $('btnPridatHranu').onclick = () => { let i = P.hrany.length + 1; while (P.hrany.some((h) => h.id === 'H' + i)) i++; P.hrany.push({ id: 'H' + i, nazev: 'ABS 2 mm', tl: 2, sirka: 22, cena: 15 }); uloz(); kresliHrany(); kresliDilce(); };
  $('btnPridatDilec').onclick = () => {
    const posl = P.dilce[P.dilce.length - 1];
    P.dilce.push({ id: novyId('P'), nazev: 'Dílec ' + (P.dilce.length + 1), w: 600, h: 400, ks: 1, material: posl ? posl.material : (P.desky[0] || {}).material || 'DTD 18', vlakna: posl ? posl.vlakna : false, hrany: { d1: '', d2: '', s1: '', s2: '' }, pozn: '' });
    uloz(); kresliDilce(); planuj();
    const inp = $('tabDilce').querySelector(`tr[data-i="${P.dilce.length - 1}"] input`); if (inp) inp.focus();
  };
  $('btnSmazatDilce').onclick = async () => { if (!P.dilce.length || !(await Dialog.potvrd('Smazat všechny dílce?', { ok: 'Smazat' }))) return; P.dilce = []; uloz(); kresliDilce(); planuj(); };
  $('btnPridatPolotovar').onclick = () => { const posl = P.polotovary1D[P.polotovary1D.length - 1]; P.polotovary1D.push({ id: novyId('T'), nazev: 'Polotovar 6 m', profil: posl ? posl.profil : (P.kusy1D[0] || {}).profil || 'hranol 40×60', L: 6000, cena: 0, ks: null }); uloz(); datalisty(); kresliPolotovary(); planuj(); };
  $('btnPridatKus').onclick = () => { const posl = P.kusy1D[P.kusy1D.length - 1]; P.kusy1D.push({ id: novyId('K'), nazev: 'Kus ' + (P.kusy1D.length + 1), L: 1000, ks: 1, profil: posl ? posl.profil : (P.polotovary1D[0] || {}).profil || 'hranol 40×60' }); uloz(); kresliKusy(); planuj(); };
  $('btnSmazatKusy').onclick = async () => { if (!P.kusy1D.length || !(await Dialog.potvrd('Smazat všechny 1D kusy?', { ok: 'Smazat' }))) return; P.kusy1D = []; uloz(); kresliKusy(); planuj(); };

  /* ---------- předvolby a projekty ---------- */
  $('predvolba').innerHTML = '<option value="">— vyberte —</option>' + Object.entries(RP.PREDVOLBY).map(([k, v]) => `<option value="${k}">${esc(v.nazev)}</option>`).join('');
  $('predvolba').onchange = async (e) => {
    const k = e.target.value; if (!k) return;
    if (P.dilce.length || P.kusy1D.length) { if (!(await Dialog.potvrd('Předvolba nahradí současné zadání (desky, dílce, tyče). Pokračovat?', { ok: 'Nahradit' }))) { e.target.value = ''; return; } }
    P = normalizuj(RP.predvolba(k)); e.target.value = ''; UI.deska = 0; vybranyDil = null; uloz(); kresliVse(); planuj(0);
  };
  const projekty = () => { const o = nacti(KLIC_PROJEKTY, {}); return o && typeof o === 'object' ? o : {}; };
  function kresliProjekty() {
    const o = projekty(), k = Object.keys(o).sort((a, b) => a.localeCompare(b, 'cs'));
    $('seznamProjektu').innerHTML = k.length ? k.map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join('') : '<option value="">(žádné)</option>';
  }
  $('btnUlozit').onclick = async () => {
    const n = await Dialog.zeptej('Název projektu:', P.nazev || 'Projekt ' + new Date().toLocaleDateString('cs-CZ'));
    if (!n) return;
    const o = projekty(); o[n] = Object.assign(RP.kopie(P), { nazev: n }); P.nazev = n; $('nazevProjektu').value = n;
    if (zapis(KLIC_PROJEKTY, o)) { kresliProjekty(); $('seznamProjektu').value = n; uloz(); toast('Projekt uložen.'); }
  };
  $('btnNacist').onclick = () => { const n = $('seznamProjektu').value, o = projekty(); if (!o[n]) return; P = normalizuj(RP.kopie(o[n])); UI.deska = 0; vybranyDil = null; uloz(); kresliVse(); planuj(0); };
  $('btnSmazatProjekt').onclick = async () => { const n = $('seznamProjektu').value, o = projekty(); if (!o[n] || !(await Dialog.potvrd(`Smazat projekt „${n}“?`, { ok: 'Smazat' }))) return; delete o[n]; zapis(KLIC_PROJEKTY, o); kresliProjekty(); };

  /* ---------- import / export ---------- */
  function stahni(obsah, nazev, typ) {
    const blob = obsah instanceof Blob ? obsah : new Blob([obsah], { type: typ || 'application/octet-stream' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const zaklad = () => String(P.nazev || 'rezny_plan').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'rezny_plan';
  $('btnExportProjekt').onclick = () => stahni(JSON.stringify(P, null, 1), zaklad() + '_projekt.json', 'application/json');
  $('btnExportKusovnik').onclick = () => stahni(JSON.stringify(RP.exportKusovniku(P), null, 1), zaklad() + '_kusovnik.json', 'application/json');
  $('btnImport').onclick = () => $('soubor').click();
  $('soubor').onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const text = await f.text();
    if (/\.json$/i.test(f.name) || /^\s*[[{]/.test(text)) await importJson(text); else await importText(text, null);
  };
  async function pridatNeboNahradit(co) {
    if (!P.dilce.length && !P.kusy1D.length) return true;
    return Dialog.potvrd(`Načteno ${co}. Nahradit současné dílce a kusy (OK), nebo je přidat (Zrušit = přidat)?`, { ok: 'Nahradit', zrus: 'Přidat' });
  }
  function poImportu(r) {
    const pridano = RP.doplnSklad(P);
    normalizuj(P);
    uloz(); kresliVse(); planuj(0);
    const v = (r.varovani || []).slice(0, 5);
    toast(`Načteno: ${r.dilce.length} dílců, ${r.kusy1D.length} kusů 1D.` + (pridano.length ? ` Doplněno do skladu (typický formát, cena 0 – upravte): ${pridano.join(', ')}.` : '') + (v.length ? ' Varování: ' + v.join('; ') : ''));
  }
  async function importJson(text) {
    let obj; try { obj = JSON.parse(text); } catch (e) { toast('Neplatný JSON: ' + e.message, true); return; }
    const r = RP.importKusovniku(obj);
    if (r.projektCely) { P = normalizuj(r.projektCely); UI.deska = 0; uloz(); kresliVse(); planuj(0); toast('Projekt načten.'); return; }
    if (!r.dilce.length && !r.kusy1D.length) { toast('V souboru nejsou žádné dílce ani tyče.', true); return; }
    const nahradit = await pridatNeboNahradit(`${r.dilce.length} dílců a ${r.kusy1D.length} tyčí`);
    if (nahradit) { P.dilce = []; P.kusy1D = []; }
    if (r.projekt && !P.nazev) P.nazev = r.projekt;
    for (const h of r.hrany) if (!P.hrany.some((x) => x.id === h.id)) P.hrany.push(h);
    for (const d of r.desky) if (!P.desky.some((x) => RP.normMat(x.material) === RP.normMat(d.material) && x.w === d.w && x.h === d.h)) P.desky.push(Object.assign({ id: novyId('D') }, d));
    for (const t of r.polotovary1D) if (!P.polotovary1D.some((x) => RP.normMat(x.profil) === RP.normMat(t.profil) && x.L === t.L)) P.polotovary1D.push(Object.assign({ id: novyId('T') }, t));
    P.dilce.push(...r.dilce); P.kusy1D.push(...r.kusy1D);
    poImportu(r);
  }
  async function importText(text, nahradit) {
    const r = RP.importTabulky(text, P);
    if (!r.dilce.length && !r.kusy1D.length) { toast('V tabulce se nenašly žádné řádky s rozměry.', true); return false; }
    if (nahradit == null) nahradit = await pridatNeboNahradit(`${r.dilce.length} dílců a ${r.kusy1D.length} kusů 1D`);
    if (nahradit) { P.dilce = []; P.kusy1D = []; }
    P.dilce.push(...r.dilce); P.kusy1D.push(...r.kusy1D);
    poImportu(r);
    return true;
  }
  $('btnVlozitNahradit').onclick = async () => { if (await importText($('vlozText').value, true)) $('vlozText').value = ''; };
  $('btnVlozitPridat').onclick = async () => { if (await importText($('vlozText').value, false)) $('vlozText').value = ''; };

  /* ---------- výpočet (Web Worker, záloha v hlavním vlákně) ---------- */
  let worker = null, uloha = 0, planT = 0, bezi = false;
  function vstupVypoctu() {
    const pr = RP.kopie(P);
    const pouzit = P.nast.zbytkyZeSkladu !== false;
    const z2 = pouzit ? Z.filter((z) => !z.jedno).map((z) => Object.assign({}, z, { zbytek: true, ks: 1, cena: RP.cislo(z.cena, 0) })) : [];
    if (pouzit) for (const z of Z.filter((q) => q.jedno)) pr.polotovary1D.push({ id: z.id, nazev: z.nazev || `Zbytek ${z.L} mm`, profil: z.profil, L: z.L, cena: 0, ks: 1, zbytek: true });
    return { pr, o: { casMs: USILI[P.nast.usili] || 2000, seed: 20261020, zbytky: z2 } };
  }
  function planuj(ms) { clearTimeout(planT); $('stav').textContent = 'Zadání změněno…'; planT = setTimeout(spocitej, ms == null ? 700 : ms); }
  function spocitej() {
    clearTimeout(planT);
    const { pr, o } = vstupVypoctu(), id = ++uloha;
    if (worker && bezi) { worker.terminate(); worker = null; }
    bezi = true; $('btnZrusit').classList.remove('skryte'); $('stav').textContent = 'Optimalizuji…'; $('prubeh').style.width = '3%';
    const t0 = Date.now();
    const hotovo = (v, chyba) => {
      if (id !== uloha) return;
      bezi = false; $('btnZrusit').classList.add('skryte'); $('prubeh').style.width = chyba ? '0' : '100%';
      if (chyba) { $('stav').textContent = 'Chyba výpočtu: ' + chyba; return; }
      V = v; V.pr = pr;
      $('stav').textContent = `Hotovo za ${fmt((Date.now() - t0) / 1000, 1)} s`;
      kresliVysledek();
    };
    try {
      if (!worker) {
        worker = new Worker('rezny_plan/worker.js');
        worker.onerror = (e) => { e.preventDefault(); worker = null; synchronne(); };
      }
      const w = worker;
      w.onmessage = (e) => {
        const d = e.data; if (d.id !== uloha) return;
        if (d.prubeh != null) { $('prubeh').style.width = Math.max(3, Math.round(d.prubeh * 100)) + '%'; return; }
        hotovo(d.v, d.chyba);
      };
      w.postMessage({ id, pr, o });
    } catch (e) { worker = null; synchronne(); }
    function synchronne() {
      setTimeout(() => { try { hotovo(RP.vypocet(pr, Object.assign({}, o, { casMs: Math.min(o.casMs, 1200) }))); } catch (err) { hotovo(null, err.message); } }, 20);
    }
  }
  $('btnSpocitat').onclick = () => spocitej();
  $('btnZrusit').onclick = () => { if (worker) { worker.terminate(); worker = null; } uloha++; bezi = false; $('btnZrusit').classList.add('skryte'); $('stav').textContent = 'Zastaveno.'; $('prubeh').style.width = '0'; };

  /* ---------- výsledek ---------- */
  function vsechnyDesky() { const out = []; if (!V) return out; for (const sk of V.d2.skupiny) for (const d of sk.desky) out.push({ sk, d }); return out; }
  const desek = (n) => `${n} ${n === 1 ? 'deska' : n >= 2 && n <= 4 ? 'desky' : 'desek'}`;
  const tyci = (n) => `${n} ${n === 1 ? 'tyč' : n >= 2 && n <= 4 ? 'tyče' : 'tyčí'}`;
  function kresliVysledek() {
    if (!V) return;
    const S = RP.souhrn(V.pr, V);
    let hranM = 0; for (const h of V.d2.hrany) hranM += h.metruSRezervou;
    const k = [
      [S.desek, desek(S.desek).replace(/^\d+ /, '')], [fmt(S.vyuziti * 100, 1) + ' %', 'využití desek'], [fmt(S.cenaCelkem, 0) + ' Kč', 'materiál celkem'],
      [fmt(S.cenaDesek, 0) + ' Kč', 'desky'], [fmt(hranM, 1) + ' m', 'hrany s rezervou'], [fmt(S.cenaHran, 0) + ' Kč', 'hrany'],
      [S.rezu, `řezů (${fmt(S.delkaRezu / 1000, 1)} m)`], [S.tyci, tyci(S.tyci).replace(/^\d+ /, '') + ' 1D'], [fmt(S.cenaTyci, 0) + ' Kč', 'tyče'],
    ];
    $('kpi').innerHTML = k.map(([a, b]) => `<div><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join('');
    const w = [];
    for (const sk of V.d2.skupiny) {
      const pocty = {};
      for (const q of sk.nezarazeno) { const kl = q.di + '|' + q.duvod; pocty[kl] = (pocty[kl] || 0) + 1; }
      for (const [kl, n] of Object.entries(pocty)) { const [di, duvod] = kl.split('|'); w.push(`${esc(V.pr.dilce[di].nazev)} (${+di + 1}) – ${n} ks nezařazeno: ${esc(duvod)}`); }
      if (sk.desky.length) w.push(`<span class="info">${esc(sk.material)}: ${desek(sk.desky.length)}, využití ${fmt(sk.vyuziti * 100, 1)} %, ${esc(sk.metoda)} (${sk.vyhodnoceni} vyhodnocení)</span>`);
    }
    for (const c of V.d2.chyby) w.push(esc(c));
    for (const sk of V.d1.skupiny) {
      for (const q of sk.nezarazeno) w.push(`${esc(V.pr.kusy1D[q.qi].nazev)} – nezařazeno: ${esc(q.duvod)}`);
      if (sk.tyce.length) w.push(`<span class="info">${esc(sk.profil)}: ${tyci(sk.tyce.length)}, využití ${fmt(sk.vyuziti * 100, 1)} %, ${esc(sk.metoda)}</span>`);
    }
    $('varovani').innerHTML = w.map((x) => `<li>${x}</li>`).join('');
    const vs = vsechnyDesky();
    if (UI.deska >= vs.length) UI.deska = 0;
    kresliNahledy(); kresliDesku(); kresli1D(); aktualizuj3D();
  }
  function kresliNahledy() {
    const vs = vsechnyDesky();
    let h = '', posl = null;
    vs.forEach(({ sk, d }, i) => {
      if (sk !== posl) { h += `<span class="skup">${esc(sk.material)}</span>`; posl = sk; }
      const svg = RPV.svgDesky(V.pr, d, { cisla: false, rezy: false, koty: false, hrany: false, zbytky: true, sirkaPapiru: 60 });
      h += `<button type="button" role="tab" data-i="${i}" aria-selected="${i === UI.deska}" title="${esc(sk.material)} – deska ${d.cislo}"><div class="mini">${svg}</div>${i < 9 ? `<kbd>${i + 1}</kbd> ` : ''}${d.cislo}/${sk.desky.length} · ${fmt(d.vyuziti * 100, 0)} %${d.typ.zbytek ? ' ♻' : ''}</button>`;
    });
    $('deskyNahledy').innerHTML = h || '<p class="info">Žádné desky.</p>';
  }
  $('deskyNahledy').addEventListener('click', (e) => { const b = e.target.closest('button[data-i]'); if (b) vyberDesku(+b.dataset.i); });
  function vyberDesku(i) {
    const vs = vsechnyDesky(); if (!vs.length) return;
    UI.deska = (i + vs.length) % vs.length; uloz();
    for (const b of $('deskyNahledy').querySelectorAll('button[data-i]')) b.setAttribute('aria-selected', String(+b.dataset.i === UI.deska));
    const b = $('deskyNahledy').querySelector(`button[data-i="${UI.deska}"]`); if (b && b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    kresliDesku(); aktualizuj3D();
  }
  function kresliDesku() {
    const vs = vsechnyDesky(), x = vs[UI.deska];
    if (!x) { $('nahled').innerHTML = '<p class="info" style="padding:20px">Žádná deska – zadejte dílce a desku se stejným materiálem.</p>'; $('tabRezy').innerHTML = ''; $('detailDilce').textContent = ''; return; }
    const { sk, d } = x;
    $('nahled').innerHTML = RPV.svgDesky(V.pr, d, { cisla: true, rezy: UI.rezy, koty: UI.koty, zbytky: UI.zbytky, hrany: UI.hrany, vybrany: vybranyDil, sirkaPapiru: 210 });
    const pocetRezu = (d.rezy || []).length;
    $('detailDilce').innerHTML = `<b>${esc(sk.material)}</b> – deska ${d.cislo}/${sk.desky.length}, ${fmt(d.W, 0)} × ${fmt(d.H, 0)} mm${d.typ.zbytek ? ' (zbytek ze skladu)' : ''}, ${d.dily.length} dílců, využití ${fmt(d.vyuziti * 100, 1)} %` +
      (V.pr.rezim2d === 'volne' ? '' : `, ${pocetRezu} řezů (${d.stupnu} stupně)`) + (vybranyDil ? '' : '. Klepnutím na dílec zobrazíte podrobnosti.');
    if (vybranyDil) ukazDilec(vybranyDil);
    const r = (d.rezy || []).map((q) => RPV.popisRezu(q, d));
    $('tabRezy').innerHTML = r.length ? '<thead><tr><th class="r">Řez</th><th>Směr</th><th>Typ</th><th class="r">Pravítko</th><th class="r">Délka řezu</th><th>Dělený kus</th></tr></thead><tbody>' +
      r.map((p) => `<tr><td class="r"><b>${p.n}</b></td><td>${p.smer}</td><td>${p.typ}</td><td class="r">${fmt(p.odmer, 1)}</td><td class="r">${fmt(p.delka, 0)}</td><td>${p.kus}</td></tr>`).join('') + '</tbody>'
      : '<tr><td class="info">Volné uložení (CNC) – bez posloupnosti řezů.</td></tr>';
  }
  function ukazDilec(v) {
    const vs = vsechnyDesky(), x = vs[UI.deska]; if (!x) return;
    const q = x.d.dily.find((p) => p.di === v.di && p.c === v.c);
    const D = V.pr.dilce[v.di]; if (!D) return;
    const hm = RP.mapaHran(V.pr), rr = RP.rozmerRezu(D, hm, V.pr.nast);
    const hr = ['d1', 'd2', 's1', 's2'].filter((s) => D.hrany[s] && hm[D.hrany[s]]).map((s) => `${s.toUpperCase().replace('S', 'Š')} ${esc(hm[D.hrany[s]].nazev)}`);
    $('detailDilce').innerHTML = `<b>${RPV.oznaceni(v.di, v.c)} ${esc(D.nazev)}</b> – hotový ${fmt(D.w, 1)} × ${fmt(D.h, 1)} mm, řezný ${fmt(rr.w, 1)} × ${fmt(rr.h, 1)} mm` +
      (q ? `, poloha x ${fmt(q.x, 1)} / y ${fmt(q.y, 1)}${q.rot ? ', <b>otočený</b>' : ''}` : '') + (D.vlakna ? ', zachovat směr vláken' : '') + (hr.length ? '. Hrany: ' + hr.join(', ') : '. Bez hran') + (D.pozn ? '. ' + esc(D.pozn) : '');
  }
  $('nahled').addEventListener('click', (e) => {
    const r = e.target.closest('.dil');
    if (!r) { if (vybranyDil) { vybranyDil = null; kresliDesku(); kresliDilce(); } return; }
    vybranyDil = { di: +r.dataset.di, c: +r.dataset.c };
    kresliDesku(); kresliDilce();
    const tr = $('tabDilce').querySelector(`tr[data-i="${vybranyDil.di}"]`); if (tr && tr.scrollIntoView) tr.scrollIntoView({ block: 'nearest' });
  });
  for (const k of ['rezy', 'koty', 'zbytky', 'hrany']) { const e = $('o_' + k); e.checked = UI[k] !== false; e.addEventListener('change', () => { UI[k] = e.checked; uloz(); kresliDesku(); }); }
  function kresli1D() {
    if (!V.d1.skupiny.length) { $('nahled1D').innerHTML = '<p class="info">Žádné 1D kusy.</p>'; return; }
    $('nahled1D').innerHTML = V.d1.skupiny.map((sk) => `<div class="nahl1d"><h3>${esc(sk.profil)} – ${tyci(sk.tyce.length)}, ${fmt(sk.delka / 1000, 2)} m, využití ${fmt(sk.vyuziti * 100, 1)} %, ${fmt(sk.cena, 0)} Kč${sk.optimalni ? ' · optimální' : ''}</h3>${RPV.svg1D(V.pr, sk)}</div>`).join('');
  }

  /* ---------- sklad zbytků ---------- */
  $('btnNarezano').onclick = async () => {
    if (!V) { toast('Nejdřív spočítejte plán.', true); return; }
    const pouz = RP.pouziteZbytky(V), nove = RP.noveZbytky(V);
    if (!pouz.length && !nove.length) { toast('Výsledek nepoužil žádný zbytek ze skladu a nevznikly použitelné zbytky.'); return; }
    if (!(await Dialog.potvrd(`Odepsat ${pouz.length} použitých zbytků ze skladu a zapsat ${nove.length} nových použitelných zbytků?`, { ok: 'Aktualizovat sklad' }))) return;
    Z = Z.filter((z) => !pouz.includes(z.id)).concat(nove);
    zapis(KLIC_ZBYTKY, Z); kresliZbytky(); planuj();
    toast('Sklad zbytků aktualizován.');
  };
  $('btnZbytekRucne').onclick = async () => {
    const t = await Dialog.zeptej('Zbytek desky „délka × šířka materiál“ (např. 900 × 450 DTD 18 bílá), nebo tyče „délka profil“ (např. 1800 hranol 40×60):', '');
    if (!t) return;
    const m2 = t.match(/^\s*(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s+(.+)$/), m1 = t.match(/^\s*(\d+(?:[.,]\d+)?)\s+(.+)$/);
    const dnes = new Date().toISOString().slice(0, 10);
    if (m2) { const mat = m2[3].trim(), t0 = P.desky.find((d) => RP.normMat(d.material) === RP.normMat(mat)); Z.push({ id: novyId('Z'), material: mat, w: RP.cislo(m2[1], 0), h: RP.cislo(m2[2], 0), tl: t0 ? t0.tl : 18, cena: 0, ks: 1, vlakna: t0 ? !!t0.vlakna : false, zbytek: true, datum: dnes, puvod: 'ručně' }); }
    else if (m1) Z.push({ id: novyId('Z'), nazev: `Zbytek ${m1[1]} mm`, profil: m1[2].trim(), L: RP.cislo(m1[1], 0), cena: 0, ks: 1, zbytek: true, jedno: true, datum: dnes, puvod: 'ručně' });
    else { toast('Nerozumím zápisu zbytku.', true); return; }
    zapis(KLIC_ZBYTKY, Z); kresliZbytky(); planuj();
  };

  /* ---------- výstupy ---------- */
  let pismoSlib = null;
  function nactiPismo() {
    if (window.FONTY_JS && window.FONTY_JS['LiberationSans-Regular.ttf']) return Promise.resolve(window.FONTY_JS['LiberationSans-Regular.ttf']);
    if (pismoSlib) return pismoSlib;
    pismoSlib = new Promise((ok) => {
      const s = document.createElement('script'); s.src = 'stitky_panely/fonty/LiberationSans-Regular.ttf.js';
      s.onload = () => ok((window.FONTY_JS || {})['LiberationSans-Regular.ttf'] || null);
      s.onerror = () => { pismoSlib = null; ok(null); };
      document.head.appendChild(s);
    });
    return pismoSlib;
  }
  async function pdf(tl, fn) {
    if (!V) { toast('Nejdřív spočítejte plán.', true); return; }
    const b = $(tl), puv = b.textContent; b.disabled = true; b.textContent = 'Připravuji PDF…';
    try {
      if (!window.jspdf) throw new Error('Knihovna jsPDF se nenačetla.');
      const pismo = await nactiPismo();
      if (!pismo) toast('Písmo se nepodařilo načíst – PDF bude bez diakritiky.');
      await fn(window.jspdf.jsPDF, pismo);
    } catch (e) { console.error(e); toast('Chyba PDF: ' + e.message, true); }
    finally { b.disabled = false; b.textContent = puv; }
  }
  $('btnPdf').onclick = () => pdf('btnPdf', (J, pismo) => stahni(RPV.pdfPlan(J, V.pr, V, { pismo }).output('blob'), zaklad() + '_rezny_plan.pdf'));
  $('btnStitky').onclick = () => pdf('btnStitky', (J, pismo) => {
    const n = RPV.stitky(V.pr, V).length; if (!n) throw new Error('Žádné umístěné dílce.');
    stahni(RPV.pdfStitky(J, V.pr, V, { pismo, format: UI.stitky, qr: UI.qr ? window.qrcode : null, ramecky: UI.ramecky, zacatek: RP.cislo($('o_zacatek').value, 1) }).output('blob'), zaklad() + '_stitky.pdf');
  });
  $('o_stitky').innerHTML = Object.entries(RPV.FORMATY_STITKU).map(([k, f]) => `<option value="${k}">${esc(f.nazev)}</option>`).join('');
  $('o_stitky').value = UI.stitky; $('o_qr').checked = !!UI.qr; $('o_ramecky').checked = !!UI.ramecky;
  $('o_stitky').onchange = (e) => { UI.stitky = e.target.value; uloz(); };
  $('o_qr').onchange = (e) => { UI.qr = e.target.checked; uloz(); };
  $('o_ramecky').onchange = (e) => { UI.ramecky = e.target.checked; uloz(); };
  const potrebaV = (fn) => () => { if (!V) { toast('Nejdřív spočítejte plán.', true); return; } fn(); };
  $('btnCsv').onclick = potrebaV(() => stahni(RPV.csvDilce(V.pr, V), zaklad() + '_dilce.csv', 'text/csv;charset=utf-8'));
  $('btnCsvRezy').onclick = potrebaV(() => stahni(RPV.csvRezy(V.pr, V), zaklad() + '_rezy.csv', 'text/csv;charset=utf-8'));
  $('btnCsv1D').onclick = potrebaV(() => stahni(RPV.csv1D(V.pr, V), zaklad() + '_tyce.csv', 'text/csv;charset=utf-8'));
  $('btnDxf').onclick = potrebaV(() => stahni(RPV.dxf(V.pr, V), zaklad() + '.dxf', 'application/dxf'));
  $('btnSvg').onclick = potrebaV(() => {
    const x = vsechnyDesky()[UI.deska]; if (!x) return;
    stahni(RPV.svgDesky(V.pr, x.d, { cisla: true, rezy: UI.rezy, koty: UI.koty, zbytky: UI.zbytky, hrany: UI.hrany, mm: true, sirkaPapiru: 270 }), `${zaklad()}_deska_${UI.deska + 1}.svg`, 'image/svg+xml');
  });

  /* ---------- 3D ---------- */
  let s3d = null, nacitam3d = false;
  function aktualizuj3D() {
    if (!s3d || !V) return;
    const x = vsechnyDesky()[UI.deska];
    if (!x) { s3d.aktualizuj(null); return; }
    const desky = x.sk.desky.slice(0, 15).map((d) => ({ W: d.W, H: d.H, tl: RP.cislo(d.typ.tl, 18), dily: d.dily, zbytky: d.zbytky }));
    s3d.aktualizuj({ desky, paleta: RPV.PALETA });
    $('stav3d').textContent = `${x.sk.material}: ${desek(desky.length)}${x.sk.desky.length > 15 ? ' (prvních 15)' : ''}`;
  }
  function nacti3D() {
    if (nacitam3d) return; nacitam3d = true;
    const hotovo = () => {
      try { s3d = window.RP3D.vytvor($('obal3d')); s3d.rozloz(UI.rozlozit); aktualizuj3D(); }
      catch (e) { $('stav3d').textContent = '3D není k dispozici (WebGL): ' + e.message; }
    };
    if (window.THREE) { hotovo(); return; }
    const s = document.createElement('script'); s.src = 'lib/three.0.160.0.min.js'; s.onload = hotovo; s.onerror = () => { $('stav3d').textContent = 'Knihovnu three.js se nepodařilo načíst.'; };
    document.head.appendChild(s);
  }
  if ('IntersectionObserver' in window) { const io = new IntersectionObserver((z) => { if (z.some((x) => x.isIntersecting)) { io.disconnect(); nacti3D(); } }, { rootMargin: '200px' }); io.observe($('obal3d')); } else nacti3D();
  $('rozlozit').value = UI.rozlozit;
  $('rozlozit').addEventListener('input', (e) => { UI.rozlozit = +e.target.value; uloz(); if (s3d) s3d.rozloz(UI.rozlozit); });
  $('b3dVychozi').onclick = () => s3d && s3d.pohled(-35, 32);
  $('b3dShora').onclick = () => s3d && s3d.pohled(0, 89);

  /* ---------- záložky s návodem ---------- */
  $('princip').innerHTML = RPP.princip; $('postup').innerHTML = RPP.postup; $('tipy').innerHTML = RPP.tipy; $('formaty').innerHTML = RPP.formaty;
  function zalozka(z) {
    UI.zakl = z; uloz();
    for (const b of $('zalozky').querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.z === z));
    for (const p of document.querySelectorAll('.panel[data-p]')) p.hidden = p.dataset.p !== z;
  }
  $('zalozky').addEventListener('click', (e) => { const b = e.target.closest('button[data-z]'); if (b) zalozka(b.dataset.z); });

  /* ---------- klávesnice ---------- */
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); spocitej(); return; }
    const t = e.target, vPoli = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if (vPoli || e.ctrlKey || e.metaKey || e.altKey) return;
    const m = /^(Digit|Numpad)([1-9])$/.exec(e.code);
    if (m) { const i = +m[2] - 1; if (i < vsechnyDesky().length) { e.preventDefault(); vyberDesku(i); } return; }
    if (e.code === 'ArrowRight' && V) { e.preventDefault(); vyberDesku(UI.deska + 1); }
    if (e.code === 'ArrowLeft' && V) { e.preventDefault(); vyberDesku(UI.deska - 1); }
  });

  /* ---------- start ---------- */
  kresliVse(); kresliProjekty(); zalozka(['princip', 'postup', 'tipy', 'formaty'].includes(UI.zakl) ? UI.zakl : 'princip');
  // kusovník předaný jinou stránkou
  const vstup = nacti(KLIC_VSTUP, null);
  if (vstup) {
    try { localStorage.removeItem(KLIC_VSTUP); } catch (e) { /* nic */ }
    setTimeout(async () => { if (await Dialog.potvrd(`Jiná stránka předala kusovník${vstup.zdroj ? ' („' + vstup.zdroj + '“)' : ''}. Načíst ho?`, { ok: 'Načíst' })) importJson(JSON.stringify(vstup)); }, 300);
  }
  spocitej();
  window.RPUI = { get P() { return P; }, get V() { return V; }, spocitej, vyberDesku, importText, importJson, get Z() { return Z; } };
})();
