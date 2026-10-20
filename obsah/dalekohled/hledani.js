/* dalekohled/hledani.js – paleta hledání (Ctrl+K, /): planety, hvězdy, dvojhvězdy, Messier, NGC/IC…, souřadnice */
(function () {
  'use strict';
  const APP = window.DALEK_APP, K = window.DALEK_KAT, D = window.DALEK;
  const $ = id => document.getElementById(id);
  const paleta = $('paleta'), vstup = $('paletaVstup'), vysl = $('paletaVysledky');
  let polozky = [], akt = 0;

  function otevri() {
    paleta.hidden = false;
    vstup.value = '';
    vykresli();
    setTimeout(() => vstup.focus(), 0);
  }
  function zavri() { paleta.hidden = true; }
  function vykresli() {
    const q = vstup.value.trim();
    polozky = q ? K.hledej(q, 40) : K.hledej('', 0).concat(navrhy());
    akt = 0;
    const jd = APP.jdTed(), m = APP.misto();
    vysl.innerHTML = '';
    if (!polozky.length) { vysl.innerHTML = '<div class="vysl"><span style="margin:0">Nic nenalezeno. Zkuste např. „M 13“, „NGC 891“, „Mizar“, „β Cyg“, „HD 172167“ nebo „19h30m +27°58′“.</span></div>'; return; }
    polozky.forEach((p, i) => {
      const d = document.createElement('div');
      d.className = 'vysl' + (i === akt ? ' akt' : '');
      let alt = '';
      try { const v = K.smer(p.id, jd, m); if (v) { const a = D.naObzor(v, jd, m).alt; alt = a > 0 ? ` · výška ${Math.round(a)}°` : ' · pod obzorem'; } } catch (e) { /* nic */ }
      d.innerHTML = `<b></b><span></span>`;
      d.firstChild.textContent = p.nazev;
      d.lastChild.textContent = (p.popis || '') + alt;
      d.addEventListener('click', () => potvrd(i));
      d.addEventListener('mousemove', () => { if (akt !== i) { akt = i; zvyrazni(); } });
      vysl.appendChild(d);
    });
  }
  // bez dotazu: planety a pár oblíbených cílů nad obzorem
  function navrhy() {
    const jd = APP.jdTed(), m = APP.misto();
    const ids = ['p:mesic', 'p:jupiter', 'p:saturn', 'p:mars', 'p:venuse', 'd:M42', 'd:M31', 'd:M13', 'd:M57', 'd:M45', 'd:NGC 869', 'd:M27', 'd:M81', 'd:M51', 'd:M44'];
    const out = [];
    for (const id of ids) {
      const o = K.objekt(id), v = K.smer(id, jd, m);
      if (o && v && D.naObzor(v, jd, m).alt > 10) out.push({ id, nazev: o.nazev, popis: 'tip na dnešek' });
    }
    return out.slice(0, 10);
  }
  function zvyrazni() { [...vysl.children].forEach((c, i) => c.classList.toggle('akt', i === akt)); const el = vysl.children[akt]; if (el) el.scrollIntoView({ block: 'nearest' }); }
  function potvrd(i) {
    const p = polozky[i]; if (!p) return;
    zavri();
    APP.vyber(p.id, true);
  }
  vstup.addEventListener('input', vykresli);
  vstup.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { akt = Math.min(polozky.length - 1, akt + 1); zvyrazni(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { akt = Math.max(0, akt - 1); zvyrazni(); e.preventDefault(); }
    else if (e.key === 'Enter') { potvrd(akt); e.preventDefault(); }
    else if (e.key === 'Escape') { zavri(); e.preventDefault(); }
  });
  paleta.addEventListener('click', e => { if (e.target === paleta) zavri(); });
  $('btnHledat').addEventListener('click', otevri);
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyK') { e.preventDefault(); otevri(); }
    else if (e.key === '/' && !e.target.matches('input, select, textarea') && paleta.hidden) { e.preventDefault(); otevri(); }
  });
  window.DALEK_HLEDANI = { otevri, zavri };
})();
