/* ============================================================
   dialog.js – náhrada nativních alert / confirm / prompt.

   Stránky běží v <iframe> rozcestníku, kde nativní dialog zmrazí celý
   web, vypadá jako chyba prohlížeče a na mobilu navíc ukáže doménu.
   Tenhle modul dělá totéž vlastními prostředky a v barvách webu.

     Dialog.info('Uloženo')            – toast v rohu, nic neblokuje
     Dialog.chyba('Soubor je poškozený')
     await Dialog.potvrd('Smazat záznam?')        → true / false
     await Dialog.zeptej('Název sady', 'Nová')    → text / null (zrušeno)

   `potvrd` a `zeptej` vracejí Promise, volající funkce tedy musí být
   `async`. Vrácená hodnota má stejný význam jako u confirm/prompt,
   takže `if (await Dialog.potvrd(...))` se chová jako dřív.
   ============================================================ */
const Dialog = (function () {

  function vlozStyl() {
    if (document.getElementById('dialog-styl')) return;
    const st = document.createElement('style');
    st.id = 'dialog-styl';
    st.textContent = `
.dlg-toasty{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483000;
  display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;
  max-width:min(92vw,420px)}
.dlg-toast{pointer-events:auto;background:var(--bg-elevated,#2d2d2d);color:var(--text,#e0e0e0);
  border:1px solid var(--border,#404040);border-left:3px solid var(--accent,#6aa6fd);
  border-radius:8px;padding:10px 14px;font-size:.9rem;line-height:1.45;
  box-shadow:0 4px 18px rgba(0,0,0,.35);animation:dlg-in .18s ease-out;word-break:break-word}
.dlg-toast.je-chyba{border-left-color:var(--danger,#e05d5d)}
.dlg-toast.odchazi{animation:dlg-out .2s ease-in forwards}
@keyframes dlg-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
@keyframes dlg-out{to{opacity:0;transform:translateY(-8px)}}
.dlg-okno{border:1px solid var(--border,#404040);border-radius:10px;padding:0;
  background:var(--bg-elevated,#2d2d2d);color:var(--text,#e0e0e0);
  max-width:min(92vw,440px);box-shadow:0 10px 40px rgba(0,0,0,.5)}
.dlg-okno::backdrop{background:rgba(0,0,0,.5)}
.dlg-telo{padding:20px 20px 16px;font-size:.95rem;line-height:1.5;white-space:pre-wrap;word-break:break-word}
.dlg-okno input{width:100%;margin-top:12px;padding:9px 10px;border-radius:6px;
  border:1px solid var(--border-strong,#4a4a4a);background:var(--bg-input,#1e1e1e);
  color:var(--text,#e0e0e0);font-size:.95rem;font-family:inherit}
.dlg-tlacitka{display:flex;gap:8px;justify-content:flex-end;padding:0 20px 18px}
.dlg-tlacitka button{padding:8px 16px;border-radius:6px;cursor:pointer;font-size:.9rem;
  font-family:inherit;border:1px solid var(--border-strong,#4a4a4a);
  background:var(--bg-control,#383838);color:var(--text,#e0e0e0)}
.dlg-tlacitka button.hlavni{background:var(--accent,#6aa6fd);border-color:var(--accent,#6aa6fd);color:#fff;font-weight:600}
.dlg-tlacitka button:hover{filter:brightness(1.12)}
@media (prefers-reduced-motion: reduce){.dlg-toast,.dlg-toast.odchazi{animation:none}}`;
    (document.head || document.documentElement).appendChild(st);
  }

  let stoh = null;
  function toasty() {
    if (stoh && stoh.isConnected) return stoh;
    stoh = document.createElement('div');
    stoh.className = 'dlg-toasty';
    document.body.appendChild(stoh);
    return stoh;
  }

  function toast(text, chyba) {
    vlozStyl();
    const t = document.createElement('div');
    t.className = 'dlg-toast' + (chyba ? ' je-chyba' : '');
    t.setAttribute('role', chyba ? 'alert' : 'status');
    t.textContent = String(text);
    toasty().appendChild(t);
    const pryc = () => {
      t.classList.add('odchazi');
      setTimeout(() => t.remove(), 220);
    };
    // delší text potřebuje delší čas na přečtení
    setTimeout(pryc, Math.min(9000, 2600 + String(text).length * 45));
    t.addEventListener('click', pryc);
    return t;
  }

  /* Společná kostra pro potvrzení i dotaz. Vrací Promise. */
  function okno({ text, vstup, vychozi, ok, zrus }) {
    vlozStyl();
    return new Promise(resolve => {
      const d = document.createElement('dialog');
      d.className = 'dlg-okno';

      const telo = document.createElement('div');
      telo.className = 'dlg-telo';
      telo.textContent = String(text);

      let pole = null;
      if (vstup) {
        pole = document.createElement('input');
        pole.type = 'text';
        pole.value = vychozi == null ? '' : String(vychozi);
        telo.appendChild(pole);
      }

      const rada = document.createElement('div');
      rada.className = 'dlg-tlacitka';
      const bZrus = document.createElement('button');
      bZrus.type = 'button';
      bZrus.textContent = zrus || 'Zrušit';
      const bOk = document.createElement('button');
      bOk.type = 'button';
      bOk.className = 'hlavni';
      bOk.textContent = ok || 'OK';
      rada.append(bZrus, bOk);

      d.append(telo, rada);
      document.body.appendChild(d);

      let hotovo = false;
      function konec(hodnota) {
        if (hotovo) return;
        hotovo = true;
        d.close();
        d.remove();
        resolve(hodnota);
      }

      bOk.addEventListener('click', () => konec(vstup ? pole.value : true));
      bZrus.addEventListener('click', () => konec(vstup ? null : false));
      // Esc i klik mimo okno = zrušeno, stejně jako u nativního dialogu
      d.addEventListener('cancel', e => { e.preventDefault(); konec(vstup ? null : false); });
      d.addEventListener('click', e => { if (e.target === d) konec(vstup ? null : false); });
      if (pole) pole.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); konec(pole.value); }
      });

      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');   // velmi staré prohlížeče: aspoň se ukáže
      (pole || bOk).focus();
      if (pole) pole.select();
    });
  }

  return {
    info: text => toast(text, false),
    chyba: text => toast(text, true),
    potvrd: (text, volby) => okno(Object.assign({ text }, volby)),
    zeptej: (text, vychozi, volby) => okno(Object.assign({ text, vstup: true, vychozi }, volby)),
  };
})();
