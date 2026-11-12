/* Leonardův zápisník – režim Kodex o letu ptáků (Turín): strany, lupa a zrcadlo, originál a překlad.
 * Data window.LEO_VOLO (leonardo/data/volo_data.js, generuje _test/leonardo_sestav.py). */
(function () {
  'use strict';
  const L = window.Leonardo, V = window.LEO_VOLO;
  const { stav, esc, T, rezimy, $ } = L;
  const nav = document.querySelector('#rezimy [data-rezim="volo"]');
  if (!V || !V.strany || !V.strany.length) { if (nav) nav.remove(); return; }
  const S = V.strany;
  const url = (s, nahled) => 'leonardo/volo/' + (nahled ? 'nahledy/' : '') + s.id + '.webp';
  let plocha = null;
  if (!(stav.volo >= 0 && stav.volo < S.length)) stav.volo = Math.min(1, S.length - 1);

  function postav() {
    const el = $('#m-volo');
    el.innerHTML = `
      <div class="levy"><div class="nahledy" id="voloNahledy">${S.map((s, k) =>
        `<button class="nahled" data-k="${k}" title="${esc(s.shrnuti || s.id)}"><img loading="lazy" src="${url(s, true)}" alt=""><span>${esc(s.id)}</span>${s.it.length ? '<b class="znacky"><i>📜</i></b>' : ''}</button>`).join('')}</div></div>
      <div class="stred">
        <div class="nastroje">
          <button class="btn ikona" data-v="-1" title="Předchozí strana" aria-label="Předchozí">◀</button>
          <span class="tlumeny male" id="voloPoradi"></span>
          <button class="btn ikona" data-v="1" title="Další strana" aria-label="Další">▶</button>
          <span class="oddel"></span>
          <button class="btn ikona" data-z="0.71" title="Oddálit" aria-label="Oddálit">−</button>
          <button class="btn ikona" data-z="1.4" title="Přiblížit" aria-label="Přiblížit">+</button>
          <button class="btn" data-cele>Celá</button>
          <button class="btn" id="voloZrcadlo" title="Zrcadlo – Leonardo psal zprava doleva">🪞 Zrcadlo</button>
        </div>
        <div class="plochy-obal"><div class="plochy"><div class="plocha" id="voloPlocha"></div></div></div>
      </div>
      <aside class="panel"><div class="panel-obsah" id="voloText"></div></aside>`;
    plocha = new window.VoynichPlocha($('#voloPlocha'));
    el.addEventListener('click', e => {
      const n = e.target.closest('.nahled');
      if (n) return ukaz(+n.dataset.k);
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.v) ukaz(stav.volo + +b.dataset.v);
      else if (b.dataset.z) plocha.zoomKolem(+b.dataset.z);
      else if (b.hasAttribute('data-cele')) plocha.prizpusob('cele');
      else if (b.id === 'voloZrcadlo') { stav.voloZrcadlo = !stav.voloZrcadlo; zrcadlo(); L.ulozStav(); }
    });
  }
  function zrcadlo() {
    plocha.zrcadli(!!stav.voloZrcadlo);
    $('#voloZrcadlo').classList.toggle('zap', !!stav.voloZrcadlo);
  }
  function ukaz(k) {
    k = Math.max(0, Math.min(S.length - 1, k));
    stav.volo = k;
    const s = S[k];
    plocha.nastav({ url: url(s), nahled: url(s, true), w: s.w, h: s.h, popis: T('Kodex o letu ptáků') + ' · ' + s.id });
    $('#voloPoradi').textContent = (k + 1) + ' / ' + S.length;
    document.querySelectorAll('#voloNahledy .nahled').forEach(b => b.classList.toggle('zap', +b.dataset.k === k));
    const b = document.querySelector(`#voloNahledy .nahled[data-k="${k}"]`);
    if (b) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const jaz = stav.jazyk, en = (document.documentElement.lang || '').startsWith('en');
    const shr = en && s.en_shrnuti ? s.en_shrnuti : s.shrnuti;
    let telo = '';
    if (!s.it.length) telo = `<p class="tlumeny">${esc(T('Na této straně není text (desky, prázdná strana nebo jen kresba).'))}</p>`;
    else if (jaz === 'obe' && s.cs.length) telo = s.it.map((p, i) => `<div class="dvojice"><p class="odst it" lang="it">${esc(p)}</p><p class="odst">${esc(s.cs[i] || '')}</p></div>`).join('');
    else if (jaz === 'cs' && s.cs.length) telo = s.cs.map(p => `<p class="odst">${esc(p)}</p>`).join('');
    else telo = s.it.map(p => `<p class="odst it" lang="it">${esc(p)}</p>`).join('');
    $('#voloText').innerHTML = `<div class="uryvek" data-i18n="ne"><div class="uryvek-hlava"><b>f. ${esc(s.id)}</b></div>
      ${shr ? `<p class="upozorneni">${esc(shr)}</p>` : ''}${telo}</div>
      <p class="male tlumeny">${esc(T('Zdroj textu'))}: ${esc(V.zdroj_text || '')}<br>${esc(T('Snímky'))}: ${esc(V.zdroj_snimky || 'Wikimedia Commons')}</p>`;
    L.ulozStav();
  }
  rezimy.volo = function () {
    if (!plocha) { postav(); zrcadlo(); }
    ukaz(stav.volo);
    if (plocha.prizpusobeno) plocha.prizpusob(plocha.prizpusobeno);
  };
  if (stav.rezim === 'volo') rezimy.volo();
})();
