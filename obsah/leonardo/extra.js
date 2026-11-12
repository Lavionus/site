/* Leonardův zápisník – doplňkové režimy: slavné listy s prohlídkou, hádanky z proroctví, zrcadlové písmo.
 * Navazuje na window.Leonardo z ui.js. */
(function () {
  'use strict';
  const L = window.Leonardo;
  const { stav, LISTY, URYVKY, DATA, J, esc, T, rezimy, $ } = L;
  const SL = window.LEO_SLAVNE || [];
  const CESTA = 'leonardo/';
  const anglicky = () => (document.documentElement.lang || 'cs').startsWith('en');
  const nazevS = s => (anglicky() && s.nazev_en) || s.nazev;
  const popisS = s => (anglicky() && s.popis_en) || s.popis;
  const nahoda = n => Math.floor(Math.random() * n);

  // ---------- slavné listy ----------
  rezimy.slavne = function () {
    const el = $('#obsahSlavne');
    if (!SL.length) { el.innerHTML = '<p class="tlumeny">Výběr slavných listů se připravuje.</p>'; return; }
    el.innerHTML = `<h2>Slavné listy Codexu Atlanticus</h2>
      <p>Prohlídka ${SL.length} nejzajímavějších stran – létací stroje, válečné stroje, voda, geometrie i Leonardovy osobní poznámky.
      Prohlížeč vás provede list po listu, popis je nahoře nad snímkem.</p>
      <p><button class="btn hl-akce" id="tlSpustitProhlidku" style="background:var(--accent);color:var(--on-accent,#fff)">▶ Spustit prohlídku</button></p>
      <div class="slavne-mrizka" data-i18n="ne">${SL.map((s, k) => {
        const l = LISTY[s.i];
        return `<button class="slavny" data-k="${k}"><img loading="lazy" alt="" src="${esc(J.urlSnimku(DATA, l, CESTA))}">
          <div><span class="cislo">${k + 1}. · f. ${esc(J.popis(l))}${l.rok ? ' · ' + esc(l.rok) : ''}</span><b>${esc(nazevS(s))}</b>${esc(popisS(s))}</div></button>`;
      }).join('')}</div>`;
    $('#tlSpustitProhlidku').onclick = () => spust(0);
    el.querySelector('.slavne-mrizka').addEventListener('click', e => {
      const b = e.target.closest('.slavny');
      if (b) spust(+b.dataset.k);
    });
  };
  function spust(k) {
    stav.prohlidkaSkryta = false;
    L.prepniRezim('prohlizec');
    L.jdiNa(SL[k].i);
  }
  const indexSlavneho = i => SL.findIndex(s => s.i === i);
  function kresliProhlidku(i) {
    const bar = $('#prohlidka');
    const k = indexSlavneho(i);
    if (k < 0 || stav.prohlidkaSkryta) { bar.classList.add('skryto'); return; }
    const s = SL[k];
    bar.classList.remove('skryto');
    bar.innerHTML = `<div class="text"><b>⭐ ${k + 1}/${SL.length} · ${esc(nazevS(s))}</b>${esc(popisS(s))}
        ${s.hledej && !anglicky() ? `<div class="hledej">🔍 ${esc(s.hledej)}</div>` : ''}</div>
      <div class="ovl"><button class="btn ikona" data-krok="-1" ${k ? '' : 'disabled'} title="${esc(T('Předchozí slavný list'))}">◀</button>
        <button class="btn" data-krok="1" ${k < SL.length - 1 ? '' : 'disabled'}>${esc(T('Další slavný'))} ▶</button>
        <button class="btn ikona" data-zavrit title="${esc(T('Skrýt popis prohlídky'))}">✕</button></div>`;
  }
  $('#prohlidka').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-zavrit')) { stav.prohlidkaSkryta = true; L.ulozStav(); kresliProhlidku(stav.list); return; }
    const k = indexSlavneho(stav.list) + (+b.dataset.krok);
    if (SL[k]) L.jdiNa(SL[k].i);
  });
  L.poPrechodu = i => kresliProhlidku(i);

  // ---------- hádej proroctví ----------
  // Leonardova „proroctví“ jsou hádanky: děsivá věštba popisuje obyčejnou věc, řešení je v nadpisu
  const obecne = /^(proroctví|totéž|o totéž|jiné|další|ještě|proroctví o totéž)\b/i;
  const POOL = URYVKY.filter(u => u.o === 'Profezie' && u.cs.length && u.nc && !obecne.test(u.nc.trim()) &&
    u.cs.join(' ').length <= 650 && u.cs.join(' ').length >= 25);
  const reseni = u => u.nc.trim().replace(/^./, c => c.toUpperCase());
  const hra = stav.hra = Object.assign({ spravne: 0, celkem: 0, serie: 0, nejlepsi: 0 }, stav.hra);
  let otazka = null, posledni = [];
  function novaOtazka() {
    let u;
    do { u = POOL[nahoda(POOL.length)]; } while (POOL.length > 20 && posledni.includes(u.id));
    posledni = [u.id, ...posledni].slice(0, 15);
    const spr = reseni(u);
    const moz = new Set([spr]);
    while (moz.size < 4) moz.add(reseni(POOL[nahoda(POOL.length)]));
    otazka = { u, spr, moz: [...moz].sort(() => Math.random() - .5), odpoved: null };
  }
  rezimy.proroctvi = function () {
    if (!otazka) novaOtazka();
    kresliHadanku();
  };
  function kresliHadanku() {
    const { u, spr, moz, odpoved } = otazka;
    const jaz = stav.jazyk;
    const text = jaz === 'it' ? `<blockquote class="it" lang="it">${u.it.map(esc).join('<br>')}</blockquote>`
      : `<blockquote>${u.cs.map(esc).join('<br>')}</blockquote>` + (jaz === 'obe' && odpoved ? `<blockquote class="it" lang="it">${u.it.map(esc).join('<br>')}</blockquote>` : '');
    const procento = hra.celkem ? Math.round(hra.spravne / hra.celkem * 100) : 0;
    $('#obsahProroctvi').innerHTML = `<div class="hadanka">
      <h2>Hádej, o čem Leonardo „prorokuje“</h2>
      <p class="male tlumeny">Leonardo psal hádanky ve formě hrůzostrašných proroctví – za děsivou věštbou se skrývá obyčejná věc. Uhodnete, která?</p>
      <div class="skore"><span>✔ ${hra.spravne} / ${hra.celkem} (${procento} %)</span><span>🔥 ${T('série')} ${hra.serie}</span><span>🏆 ${T('nejlepší série')} ${hra.nejlepsi}</span></div>
      <div data-i18n="ne">${text}
      <div class="moznosti">${moz.map(m => `<button data-m="${esc(m)}" ${odpoved ? 'disabled' : ''} class="${odpoved ? (m === spr ? 'dobre' : m === odpoved ? 'spatne' : '') : ''}">${esc(m)}</button>`).join('')}</div></div>
      ${odpoved ? `<p><b>${odpoved === spr ? '✔ ' + T('Správně!') : '✘ ' + T('Řešení:')}</b> <span data-i18n="ne">${esc(spr)}</span>
        <span class="tlumeny male" data-i18n="ne">· ${esc(u.ref ? u.ref.raw : '')}</span>
        ${u.ca.length ? ` · <a href="#" data-skok="${u.ca[0]}">${T('ukázat list')}</a>` : ''}</p>
        <p><button class="btn" id="tlDalsiHadanka" style="background:var(--accent);color:var(--on-accent,#fff)">${T('Další hádanka')} ▶</button></p>` : ''}
      <p class="male tlumeny">${POOL.length} ${T('hádanek z Leonardových proroctví (výběr Solmi 1900, český překlad).')}</p></div>`;
    const el = $('#obsahProroctvi');
    el.querySelectorAll('.moznosti button').forEach(b => b.onclick = () => odpovez(b.dataset.m));
    const d = $('#tlDalsiHadanka');
    if (d) d.onclick = () => { novaOtazka(); kresliHadanku(); };
  }
  function odpovez(m) {
    if (otazka.odpoved) return;
    otazka.odpoved = m;
    hra.celkem++;
    if (m === otazka.spr) { hra.spravne++; hra.serie++; hra.nejlepsi = Math.max(hra.nejlepsi, hra.serie); }
    else hra.serie = 0;
    L.ulozStav();
    kresliHadanku();
  }

  // ---------- zrcadlové písmo ----------
  const PISMA = [['LeoFondamento', 'Fondamento (kurzíva)'], ['LeoItalianno', 'Italianno (krasopis)'], ['LeoFell', 'IM Fell (tisk 17. stol.)']];
  const pis = stav.pismo = Object.assign({ text: 'Chi non stima la vita, non la merita.', font: 'LeoFondamento', vel: 44, zrcadlo: true, oba: false }, stav.pismo);
  let pismoPostaveno = false;
  rezimy.pismo = function () {
    if (!pismoPostaveno) {
      $('#obsahPismo').innerHTML = `
        <h2>Piš jako Leonardo</h2>
        <p>Leonardo byl levák a psal zprava doleva – každé písmeno zrcadlově obrácené. Napište text a uvidíte ho jeho způsobem. Přečíst ho jde v zrcadle (nebo tlačítkem 🪞 v prohlížeči).</p>
        <textarea class="pismo-vstup" id="pismoText" maxlength="600" aria-label="Text k převedení"></textarea>
        <div class="pismo-ovl">
          <label class="prep">Písmo <select id="pismoFont">${PISMA.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></label>
          <label class="prep">Velikost <input type="range" id="pismoVel" min="24" max="80"></label>
          <label class="prep"><input type="checkbox" id="pismoZrc"> zrcadlově</label>
          <label class="prep"><input type="checkbox" id="pismoOba"> i normálně pro srovnání</label>
          <button class="btn" id="pismoPng">⬇️ Stáhnout PNG</button>
        </div>
        <canvas class="pismo-platno" id="pismoPlatno" data-i18n="ne"></canvas>
        <h2>Jak číst Leonardův rukopis</h2>
        <p>Po převrácení zrcadlem zbývá obyčejná italská kurzíva konce 15. století – s několika zvyklostmi, které čtení ztěžují:</p>
        <table class="tab-zkratky">
          <tr><th>V rukopisu</th><th>Znamená</th><th>Poznámka</th></tr>
          <tr><td>lacqua, ilsole</td><td>l’acqua, il sole</td><td>Slova často píše dohromady, jindy je naopak dělí uprostřed (<i>con seguenza</i>).</td></tr>
          <tr><td>tēpo, cōe</td><td>tempo, come</td><td>Vodorovná čárka nad samohláskou = vynechané <i>n</i> nebo <i>m</i>.</td></tr>
          <tr><td>p̄, ꝑ</td><td>per</td><td>Přeškrtnutá nožička písmene p. Podobně ꝓ = pro.</td></tr>
          <tr><td>ꝯ, 9</td><td>con / com</td><td>Znak podobný devítce na začátku slova.</td></tr>
          <tr><td>&amp;, e</td><td>e (a)</td><td>Spojka, často bez mezery.</td></tr>
          <tr><td>chome, chosa, cholla</td><td>come, cosa, con la</td><td>Leonardo píše <i>ch</i> i tam, kde dnes stojí <i>c</i>; <i>h</i> přidává i jinde (<i>ho</i> = o).</td></tr>
          <tr><td>uolta, auere</td><td>volta, avere</td><td>u a v se nerozlišují; j často místo i.</td></tr>
          <tr><td>sanza, omo, el</td><td>senza, uomo, il</td><td>Dobová toskánská a lombardská slova a tvary.</td></tr>
          <tr><td>. : ;</td><td>–</td><td>Interpunkce skoro chybí, věty se poznají podle smyslu.</td></tr>
          <tr><td>1 2 3…</td><td>číslice</td><td>Arabské číslice, také zrcadlové; zlomky a míry (braccio = loket ≈ 58 cm).</td></tr>
        </table>
        <p class="male tlumeny">Písma: Fondamento, Italianno a IM Fell English (SIL Open Font License) – moderní napodobeniny, ne Leonardova ruka.</p>`;
      const t = $('#pismoText');
      t.value = pis.text;
      $('#pismoFont').value = pis.font;
      $('#pismoVel').value = pis.vel;
      $('#pismoZrc').checked = pis.zrcadlo;
      $('#pismoOba').checked = pis.oba;
      const zmena = () => {
        Object.assign(pis, { text: t.value, font: $('#pismoFont').value, vel: +$('#pismoVel').value, zrcadlo: $('#pismoZrc').checked, oba: $('#pismoOba').checked });
        L.ulozStav();
        kresliPismo();
      };
      ['pismoText', 'pismoFont', 'pismoVel', 'pismoZrc', 'pismoOba'].forEach(id => $('#' + id).addEventListener('input', zmena));
      $('#pismoPng').onclick = () => {
        $('#pismoPlatno').toBlob(b => {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(b);
          a.download = 'leonardo-zrcadlove-pismo.png';
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        });
      };
      // jen při změně šířky – výšku plátna mění kreslení samo (jinak smyčka ResizeObserveru)
      let sirka = 0;
      new ResizeObserver(z => {
        const w = Math.round(z[0].contentRect.width);
        if (w !== sirka) { sirka = w; requestAnimationFrame(kresliPismo); }
      }).observe($('#pismoPlatno'));
      pismoPostaveno = true;
    }
    document.fonts.load(`${pis.vel}px ${pis.font}`).then(kresliPismo, kresliPismo);
  };

  // zalomí text do řádků dané šířky
  function radky(ctx, text, sirka) {
    const vysl = [];
    String(text).split('\n').forEach(odst => {
      let r = '';
      odst.split(/\s+/).forEach(sl => {
        const zk = r ? r + ' ' + sl : sl;
        if (ctx.measureText(zk).width > sirka && r) { vysl.push(r); r = sl; } else r = zk;
      });
      vysl.push(r);
    });
    return vysl;
  }
  function kresliPismo() {
    const c = $('#pismoPlatno');
    if (!c || !c.clientWidth) return;
    const dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth;
    const ctx = c.getContext('2d');
    const vel = pis.vel, okraj = 28, radek = vel * 1.35;
    ctx.font = `${vel}px ${pis.font}, Georgia, serif`;
    const bloky = pis.oba ? [true, false] : [pis.zrcadlo];
    const r = radky(ctx, pis.text || ' ', W - 2 * okraj);
    const vyskaBloku = r.length * radek + vel * .5;
    const H = Math.max(120, okraj * 2 + bloky.length * vyskaBloku + (bloky.length - 1) * 24);
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    c.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // papír: teplý podklad s jemnými skvrnami (stálé semínko, ať se nemění při psaní)
    ctx.fillStyle = '#efe4c8'; ctx.fillRect(0, 0, W, H);
    let sem = 7;
    const rnd = () => (sem = (sem * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 60; k++) {
      const x = rnd() * W, y = rnd() * H, rr = 10 + rnd() * 60;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, 'rgba(150,110,50,.07)'); g.addColorStop(1, 'rgba(150,110,50,0)');
      ctx.fillStyle = g; ctx.fillRect(x - rr, y - rr, 2 * rr, 2 * rr);
    }
    ctx.font = `${vel}px ${pis.font}, Georgia, serif`;
    ctx.fillStyle = '#4a2f14';
    ctx.textBaseline = 'alphabetic';
    let y0 = okraj;
    bloky.forEach(zrc => {
      ctx.save();
      if (zrc) { ctx.translate(W, 0); ctx.scale(-1, 1); }
      r.forEach((t, k) => ctx.fillText(t, okraj, y0 + vel + k * radek));
      ctx.restore();
      y0 += vyskaBloku + 24;
    });
  }

  // režim mohl být otevřený už při startu (hash nebo uložený stav) dřív, než se zaregistroval
  if (['slavne', 'proroctvi', 'pismo'].includes(stav.rezim)) rezimy[stav.rezim]();
  kresliProhlidku(stav.list);
  window.LeonardoExtra = { POOL, reseni, radky };
})();
