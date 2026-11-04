/* Předčítač – rozhraní: hlasy Piper (stažení do Cache Storage), text, přehrávání přes <audio>.
   Zvuk se vyrábí ve workeru (worker.js) po větách a skládá do kusů WAV; <audio> + Media Session
   hraje i při zamčené obrazovce (na rozdíl od speechSynthesis). */
(function () {
  'use strict';
  const J = window.PREDC_JADRO;
  const $ = id => document.getElementById(id);
  const HF = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/';
  const CACHE_HLASU = 'piper-hlasy';          // pozor: ne „webapp-…“ – ty maže sw.js při nové verzi
  const KLIC = 'webapp_predcitac', KLIC_TEXT = 'webapp_predcitac_text';
  const MAX_ULOZ_TEXT = 300000;               // znaků; delší text se neukládá (localStorage je sdílený)
  const ZASOBA_S = 150;                       // průběžně: kolik sekund zvuku držet připravené dopředu

  const nast = Object.assign({ hlas: '', rychlost: 1, rezim: 'prubezne', mluvci: 0, jazyk: '', veta: 0 },
    (() => { try { return JSON.parse(localStorage.getItem(KLIC)) || {}; } catch (e) { return {}; } })());
  const ulozNast = () => { try { localStorage.setItem(KLIC, JSON.stringify(nast)); } catch (e) { /* plné úložiště */ } };

  /* ---------- deník událostí ---------- */
  const denik = [];
  function zapis(text) {
    const d = new Date();
    denik.push(d.toLocaleTimeString('cs-CZ') + '.' + String(d.getMilliseconds()).padStart(3, '0').slice(0, 1) + '  ' + text);
    if (denik.length > 400) denik.shift();
    if (!$('panelDenik').hidden) $('denikText').textContent = denik.join('\n');
  }
  zapis('Start: ' + navigator.userAgent);

  /* ---------- text ---------- */
  const UKAZKY = {
    cs: '# Ukázka předčítání\n\nTenhle text čte neuronový hlas přímo ve vašem prohlížeči. Nic se neposílá na server, jen hlas se jednou stáhne.\n\nNa tabletu zkuste spustit čtení a pak zamknout obrazovku. Zvuk by měl hrát dál a dá se ovládat ze zamčené obrazovky. Kdyby se zastavil, podívejte se do deníku událostí, kdy se to stalo.\n\nČísla a zkratky: 1. ledna 2026 v 8:30 přišlo 125 lidí, tj. o 12 % víc než loni. Hlas zvládá i otázky? A zvolání!',
    sk: '# Ukážka čítania\n\nTento text číta neurónový hlas priamo vo vašom prehliadači. Nič sa neposiela na server.\n\nNa tablete skúste spustiť čítanie a potom zamknúť obrazovku. Zvuk by mal hrať ďalej.',
    en: '# Reading sample\n\nThis text is read by a neural voice right in your browser. Nothing is sent to a server; only the voice is downloaded once.\n\nOn a tablet, start reading and then lock the screen. The audio should keep playing and can be controlled from the lock screen.',
    de: '# Leseprobe\n\nDieser Text wird von einer neuronalen Stimme direkt in Ihrem Browser vorgelesen. Es wird nichts an einen Server gesendet.\n\nStarten Sie auf dem Tablet das Vorlesen und sperren Sie dann den Bildschirm.',
  };
  let dokument = { nazev: 'Ukázka', text: '' };
  let vety = [];
  try { const t = JSON.parse(localStorage.getItem(KLIC_TEXT)); if (t && t.text) dokument = t; } catch (e) { /* nic */ }
  if (!dokument.text) dokument.text = UKAZKY.cs;

  function ulozText() {
    try {
      if (dokument.text.length <= MAX_ULOZ_TEXT) localStorage.setItem(KLIC_TEXT, JSON.stringify(dokument));
      else { localStorage.removeItem(KLIC_TEXT); zapis('Text je dlouhý (' + dokument.text.length + ' znaků) – po zavření stránky se neuchová.'); }
    } catch (e) { zapis('Text se nepodařilo uložit: ' + e.message); }
  }

  function vykresliText() {
    vety = J.rozeber(dokument.text);
    const el = $('cteni');
    if (!vety.length) { el.innerHTML = '<p class="prazdno">Žádný text. Vložte ho přes ✏️ nebo načtěte soubor.</p>'; return; }
    const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    let html = '<h2>' + esc(dokument.nazev) + '</h2>', odst = -1;
    vety.forEach((v, i) => {
      if (v.odst !== odst) { if (odst >= 0) html += '</p>'; html += '<p>'; odst = v.odst; }
      html += '<span class="v" data-i="' + i + '">' + esc(v.text) + '</span> ';
    });
    el.innerHTML = html + '</p>';
    if (nast.veta >= vety.length) nast.veta = 0;
    zvyrazni(nast.veta, false);
    aktualizujPruh();
  }

  function nastavText(text, nazev) {
    zastav();
    dokument = { nazev: nazev || 'Text', text };
    nast.veta = 0; ulozNast(); ulozText();
    vykresliText();
    $('plocha').scrollTop = 0;
  }

  /* ---------- hlasy: katalog, stažení, uložení ---------- */
  let katalog = [];               // položky voices.json
  const stazene = new Set();      // klíče stažených hlasů
  const soubory = h => {
    const k = Object.keys(h.files);
    return { onnx: k.find(f => f.endsWith('.onnx')), json: k.find(f => f.endsWith('.onnx.json')), karta: k.find(f => f.endsWith('MODEL_CARD')) };
  };
  const velikostMB = h => Math.round(Object.values(h.files).reduce((s, f) => s + f.size_bytes, 0) / 1e6);
  const popisHlasu = h => `${h.language.name_native} (${h.language.code}) · ${h.name} · ${h.quality}`;

  async function nactiKatalog() {
    const cache = await caches.open(CACHE_HLASU);
    try {
      const r = await fetch(HF + 'voices.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      await cache.put(HF + 'voices.json', r.clone());
      katalog = Object.values(await r.json());
    } catch (e) {
      const ulozeny = await cache.match(HF + 'voices.json');
      if (!ulozeny) throw e;
      katalog = Object.values(await ulozeny.json());
      zapis('Seznam hlasů offline z mezipaměti (' + e.message + ')');
    }
    katalog.sort((a, b) => a.key.localeCompare(b.key));
    for (const h of katalog) if (await cache.match(HF + soubory(h).onnx)) stazene.add(h.key);
  }

  async function stahniHlas(h, prubeh) {
    const cache = await caches.open(CACHE_HLASU);
    const f = soubory(h);
    const celkem = h.files[f.onnx].size_bytes;
    const r = await fetch(HF + f.onnx);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const ctecka = r.body.getReader(), casti = [];
    let n = 0;
    for (;;) {
      const { done, value } = await ctecka.read();
      if (done) break;
      casti.push(value); n += value.length;
      prubeh(n / celkem);
    }
    const konfig = await fetch(HF + f.json).then(x => { if (!x.ok) throw new Error('HTTP ' + x.status); return x.blob(); });
    await cache.put(HF + f.json, new Response(konfig, { headers: { 'Content-Type': 'application/json' } }));
    await cache.put(HF + f.onnx, new Response(new Blob(casti), { headers: { 'Content-Type': 'application/octet-stream' } }));
    stazene.add(h.key);
    navigator.storage?.persist?.().then(ok => zapis('Trvalé úložiště: ' + (ok ? 'ano' : 'ne')));
    zapis('Staženo: ' + h.key + ' (' + velikostMB(h) + ' MB)');
  }

  async function smazHlas(h) {
    const cache = await caches.open(CACHE_HLASU), f = soubory(h);
    await cache.delete(HF + f.onnx); await cache.delete(HF + f.json);
    stazene.delete(h.key);
    if (nast.hlas === h.key) { nast.hlas = ''; ulozNast(); nactenyHlas = null; }
  }

  /* ---------- worker se syntézou ---------- */
  const worker = new Worker('predcitac/worker.js');
  const cekajici = new Map();
  let idZpravy = 0;
  worker.onmessage = ({ data }) => {
    const p = cekajici.get(data.id);
    if (!p) return;
    cekajici.delete(data.id);
    data.typ === 'chyba' ? p.chyba(new Error(data.zprava)) : p.ok(data);
  };
  worker.onerror = e => { zapis('Chyba workeru: ' + (e.message || e)); Dialog.chyba('Syntéza řeči selhala: ' + (e.message || 'neznámá chyba')); };
  const zadej = (zprava, prenos = []) => new Promise((ok, chyba) => {
    const id = ++idZpravy;
    cekajici.set(id, { ok, chyba });
    worker.postMessage(Object.assign({ id }, zprava), prenos);
  });

  let nactenyHlas = null, konfigHlasu = null, nacitani = null;
  function pripravHlas() {
    if (nactenyHlas === nast.hlas) return Promise.resolve();
    if (nacitani && nacitani.klic === nast.hlas) return nacitani.p;
    const klic = nast.hlas, h = katalog.find(x => x.key === klic);
    if (!h || !stazene.has(klic)) return Promise.reject(new Error('Hlas není stažený.'));
    const p = (async () => {
      stav('Načítám hlas…');
      const cache = await caches.open(CACHE_HLASU), f = soubory(h);
      const konfig = await (await cache.match(HF + f.json)).json();
      const model = await (await cache.match(HF + f.onnx)).arrayBuffer();
      const t0 = performance.now();
      await zadej({ typ: 'hlas', model, konfig }, [model]);
      zapis('Hlas načten: ' + klic + ' za ' + Math.round(performance.now() - t0) + ' ms');
      konfigHlasu = konfig; nactenyHlas = klic;
      stav('Připraveno');
    })();
    nacitani = { klic, p };
    p.finally(() => { if (nacitani && nacitani.p === p) nacitani = null; });
    return p;
  }

  /* ---------- přehrávání ---------- */
  const zvuk = $('zvuk');
  const prehr = { gen: 0, hraje: false, kusy: [], aktualni: -1, cekam: false, hotovo: false, veta: nast.veta, zvukS: 0, ms: 0 };

  function dopredu() {   // sekundy připraveného zvuku před přehrávačem
    let s = 0;
    for (let i = Math.max(0, prehr.aktualni); i < prehr.kusy.length; i++) s += prehr.kusy[i].delka;
    if (prehr.aktualni >= 0 && prehr.kusy[prehr.aktualni]) s -= zvuk.currentTime || 0;
    return s;
  }
  const cekej = ms => new Promise(r => setTimeout(r, ms));

  async function generuj(gen, od) {
    const predem = nast.rezim === 'predem';
    const sr = konfigHlasu.audio.sample_rate;
    let kus;
    while (gen === prehr.gen && (kus = J.dalsiKus(vety, od, { celyNajednou: predem }))) {
      while (!predem && gen === prehr.gen && dopredu() > ZASOBA_S) await cekej(1000);
      if (gen !== prehr.gen) return;
      const casti = [], casy = [];
      let vzorku = 0, msKus = 0;
      for (let i = kus.od; i < kus.do; i++) {
        const { pcm, ms } = await zadej({ typ: 'veta', text: vety[i].text, rychlost: nast.rychlost, mluvci: nast.mluvci });
        if (gen !== prehr.gen) return;
        casy.push(vzorku / sr);
        const ticho = new Int16Array(Math.round(J.pauza(vety[i]) * sr));
        casti.push(J.naInt16(pcm), ticho);
        vzorku += pcm.length + ticho.length;
        msKus += ms;
        // přehrávači dochází zásoba → kus uzavřít hned (na začátku tak vznikají krátké kusy po větě)
        if (!predem && i + 1 < kus.do && dopredu() < 10) { kus.do = i + 1; break; }
        if (predem) { $('prubeh').hidden = false; $('prubeh').value = (i + 1 - kus.od) / (kus.do - kus.od); stav(`Připravuji ${i + 1 - kus.od} / ${kus.do - kus.od} vět…`); }
      }
      const delka = vzorku / sr;
      prehr.zvukS += delka; prehr.ms += msKus;
      zapis(`Kus ${prehr.kusy.length + 1}: věty ${kus.od + 1}–${kus.do}, ${delka.toFixed(1)} s zvuku za ${(msKus / 1000).toFixed(1)} s (${(delka * 1000 / msKus).toFixed(1)}× rychleji než čtení)`);
      prehr.kusy.push({ od: kus.od, do: kus.do, casy, delka, blob: new Blob([J.wavHlavicka(vzorku, sr), ...casti], { type: 'audio/wav' }) });
      if (predem) { $('prubeh').hidden = true; $('tlWav').disabled = false; }
      if (prehr.cekam) { prehr.cekam = false; prehrajKus(prehr.kusy.length - 1); }
      od = kus.do;
      aktualizujPruh();
    }
    if (gen === prehr.gen) prehr.hotovo = true;
  }

  function prehrajKus(i) {
    const k = prehr.kusy[i];
    prehr.aktualni = i;
    if (zvuk.src) URL.revokeObjectURL(zvuk.src);
    zvuk.src = URL.createObjectURL(k.blob);
    if (nast.rezim !== 'predem') for (let j = 0; j < i - 1; j++) prehr.kusy[j].blob = null;   // starý zvuk uvolnit
    const p = zvuk.play();
    if (p) p.catch(e => { zapis('play() odmítnuto: ' + e.name + ' ' + e.message); prehr.hraje = false; aktualizujTlacitka(); });
    nastavMediaSession();
  }

  async function spust(odVety) {
    if (!vety.length) return;
    if (!nast.hlas || !stazene.has(nast.hlas)) { await Dialog.info('Nejdřív stáhněte a vyberte hlas.'); otevriHlasy(); return; }
    const gen = ++prehr.gen;
    uvolniKusy();
    Object.assign(prehr, { hraje: true, cekam: true, hotovo: false, veta: odVety });
    zvyrazni(odVety);
    aktualizujTlacitka();
    try { await pripravHlas(); } catch (e) { zapis('Hlas: ' + e.message); Dialog.chyba('Hlas se nepodařilo načíst: ' + e.message); zastav(); return; }
    if (gen !== prehr.gen) return;
    stav(nast.rezim === 'predem' ? 'Připravuji zvuk…' : 'Čtu');
    generuj(gen, odVety).catch(e => { if (gen === prehr.gen) { zapis('Syntéza: ' + e.message); Dialog.chyba('Syntéza selhala: ' + e.message); zastav(); } });
  }

  function uvolniKusy() {
    zvuk.pause();
    if (zvuk.src) { URL.revokeObjectURL(zvuk.src); zvuk.removeAttribute('src'); zvuk.load(); }
    prehr.kusy = []; prehr.aktualni = -1;
    $('tlWav').disabled = true; $('prubeh').hidden = true;
  }

  function zastav() {
    prehr.gen++;
    prehr.hraje = false;
    uvolniKusy();
    stav('Zastaveno');
    aktualizujTlacitka();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
  }

  function hrajPauza() {
    if (!prehr.hraje) return spust(nast.veta);
    if (prehr.aktualni < 0 || prehr.cekam) return;   // zvuk se ještě připravuje
    if (zvuk.paused) zvuk.play().catch(e => zapis('play() odmítnuto: ' + e.message)); else zvuk.pause();
  }

  // skok na větu: uvnitř připraveného kusu jen posun, jinak nová příprava
  function skok(i) {
    i = Math.max(0, Math.min(vety.length - 1, i));
    const k = prehr.kusy[prehr.aktualni];
    if (prehr.hraje && k && i >= k.od && i < k.do) { zvuk.currentTime = k.casy[i - k.od]; zvyrazni(i); return; }
    if (prehr.hraje) spust(i); else { zvyrazni(i); }
  }

  zvuk.addEventListener('timeupdate', () => {
    const k = prehr.kusy[prehr.aktualni];
    if (!k) return;
    const i = k.od + J.vetaVCase(k.casy, zvuk.currentTime);
    if (i !== prehr.veta) zvyrazni(i);
    aktualizujPruh();
  });
  zvuk.addEventListener('ended', () => {
    zapis('ended (kus ' + (prehr.aktualni + 1) + ')');
    if (prehr.kusy[prehr.aktualni + 1]) prehrajKus(prehr.aktualni + 1);
    else if (prehr.hotovo) { zapis('Konec textu'); zastav(); stav('Dočteno'); nast.veta = 0; ulozNast(); }
    else { prehr.cekam = true; stav('Čekám na přípravu zvuku…'); zapis('Zásoba zvuku došla – čekám na syntézu'); }
  });
  ['play', 'pause', 'waiting', 'stalled', 'suspend', 'error'].forEach(t => zvuk.addEventListener(t, () => {
    if (t === 'suspend' && !prehr.hraje) return;
    zapis('audio: ' + t + (t === 'error' && zvuk.error ? ' ' + zvuk.error.code : ''));
    if (t === 'play' || t === 'pause') { aktualizujTlacitka(); stav(t === 'play' ? 'Čtu' : 'Pozastaveno'); }
    if ('mediaSession' in navigator && (t === 'play' || t === 'pause')) navigator.mediaSession.playbackState = t === 'play' ? 'playing' : 'paused';
  }));
  document.addEventListener('visibilitychange', () => zapis('stránka: ' + document.visibilityState + (prehr.hraje ? `, připraveno ${Math.round(dopredu())} s dopředu` : '')));
  addEventListener('pagehide', () => { zapis('pagehide'); ulozNast(); });
  addEventListener('pageshow', e => zapis('pageshow' + (e.persisted ? ' (z bfcache)' : '')));
  document.addEventListener('freeze', () => zapis('freeze'));
  document.addEventListener('resume', () => zapis('resume'));

  function nastavMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const h = katalog.find(x => x.key === nast.hlas);
    navigator.mediaSession.metadata = new MediaMetadata({ title: dokument.nazev, artist: 'Předčítač' + (h ? ' · ' + h.name : ''), album: 'Věta ' + (prehr.veta + 1) + ' / ' + vety.length });
  }
  if ('mediaSession' in navigator) {
    const akce = {
      play: () => { zapis('media: play'); hrajPauza(); },
      pause: () => { zapis('media: pause'); zvuk.pause(); },
      stop: () => { zapis('media: stop'); zastav(); },
      previoustrack: () => { zapis('media: předchozí'); skok(prehr.veta - 1); },
      nexttrack: () => { zapis('media: další'); skok(prehr.veta + 1); },
      seekbackward: () => { zvuk.currentTime = Math.max(0, zvuk.currentTime - 10); },
      seekforward: () => { zvuk.currentTime = Math.min(zvuk.duration || 0, zvuk.currentTime + 10); },
    };
    for (const [k, f] of Object.entries(akce)) { try { navigator.mediaSession.setActionHandler(k, f); } catch (e) { /* nepodporováno */ } }
  }

  /* ---------- zobrazení ---------- */
  let ulozeniVety = 0;
  function zvyrazni(i, posun = true) {
    prehr.veta = i;
    $('cteni').querySelectorAll('.v.cte').forEach(el => el.classList.remove('cte'));
    const el = $('cteni').querySelector('.v[data-i="' + i + '"]');
    if (el) {
      el.classList.add('cte');
      if (posun && document.visibilityState === 'visible') {
        const r = el.getBoundingClientRect(), p = $('plocha').getBoundingClientRect();
        if (r.top < p.top + 10 || r.bottom > p.bottom - 20) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
    nast.veta = i;
    if (Date.now() - ulozeniVety > 3000) { ulozeniVety = Date.now(); ulozNast(); }
    if (prehr.hraje && 'mediaSession' in navigator && navigator.mediaSession.metadata) navigator.mediaSession.metadata.album = 'Věta ' + (i + 1) + ' / ' + vety.length;
    aktualizujPruh();
  }

  const stav = t => { $('stavText').textContent = t; };
  function aktualizujPruh() {
    $('stavVeta').innerHTML = vety.length ? 'Věta <b>' + (prehr.veta + 1) + '</b> / ' + vety.length : '';
    $('stavPriprava').textContent = prehr.hraje && prehr.kusy.length
      ? (prehr.hotovo ? 'připraveno do konce' : 'připraveno ' + J.formatCas(dopredu()) + ' dopředu') + (prehr.ms ? ` · ${(prehr.zvukS * 1000 / prehr.ms).toFixed(1)}× rychleji než čtení` : '')
      : '';
  }
  function aktualizujTlacitka() {
    const hraje = prehr.hraje && !zvuk.paused;
    $('tlHraj').textContent = hraje || (prehr.hraje && prehr.aktualni < 0) ? '⏸' : '▶';
  }

  /* ---------- panel hlasů ---------- */
  function naplnVyberHlasu() {
    const sel = $('hlasVyber');
    const moje = katalog.filter(h => stazene.has(h.key));
    sel.innerHTML = moje.length
      ? moje.map(h => `<option value="${h.key}">${h.language.code} · ${h.name} · ${h.quality}</option>`).join('')
      : '<option value="">– žádný stažený hlas –</option>';
    if (!stazene.has(nast.hlas)) nast.hlas = moje[0] ? moje[0].key : '';
    sel.value = nast.hlas;
  }

  function otevriHlasy() {
    $('panelHlasy').hidden = false;
    vykresliHlasy();
  }

  function vykresliHlasy() {
    const jazyky = [...new Map(katalog.map(h => [h.language.family, h.language])).values()]
      .sort((a, b) => a.name_english.localeCompare(b.name_english));
    const selJ = $('hlasyJazyk');
    if (!selJ.options.length && jazyky.length) {
      selJ.innerHTML = '<option value="*">Všechny jazyky</option>' + jazyky.map(l => `<option value="${l.family}">${l.name_native} – ${l.name_english}</option>`).join('');
      const pref = nast.jazyk || (navigator.language || 'cs').slice(0, 2);
      selJ.value = jazyky.some(l => l.family === pref) ? pref : (jazyky.some(l => l.family === 'cs') ? 'cs' : '*');
    }
    const fam = selJ.value, jen = $('hlasyJenStazene').checked;
    const vyber = katalog.filter(h => (fam === '*' || h.language.family === fam) && (!jen || stazene.has(h.key)));
    const seznam = $('hlasySeznam');
    if (!katalog.length) return;
    seznam.innerHTML = vyber.length ? '' : '<p>Žádný hlas neodpovídá filtru.</p>';
    for (const h of vyber) {
      const f = soubory(h), ma = stazene.has(h.key);
      const r = document.createElement('div');
      r.className = 'hlas' + (nast.hlas === h.key ? ' vybrany' : '');
      r.innerHTML = `<div><div class="jm">${popisHlasu(h)}</div><div class="info">${velikostMB(h)} MB · mluvčích: ${h.num_speakers}${f.karta ? ` · <a href="${HF + f.karta}" target="_blank" rel="noopener">karta</a>` : ''}${ma ? ' · <span class="ok">✓ staženo</span>' : ''}</div></div><div class="akce"></div>`;
      const akce = r.querySelector('.akce');
      const tl = (text, fn, cls) => { const b = document.createElement('button'); b.className = 'tl' + (cls ? ' ' + cls : ''); b.textContent = text; b.onclick = fn; akce.appendChild(b); return b; };
      if (ma) {
        if (nast.hlas !== h.key) tl('Použít', () => { vyberHlas(h.key); vykresliHlasy(); }, 'hlavni');
        tl('🗑️', async () => {
          if (!await Dialog.potvrd('Smazat hlas ' + h.key + ' z prohlížeče?')) return;
          if (nast.hlas === h.key) zastav();
          await smazHlas(h); naplnVyberHlasu(); vykresliHlasy(); ukazMisto();
        });
      } else {
        const b = tl('⬇️ Stáhnout', async () => {
          b.disabled = true;
          const pr = document.createElement('progress'); pr.max = 1; pr.value = 0; r.appendChild(pr);
          try {
            await stahniHlas(h, x => { pr.value = x; b.textContent = Math.round(x * 100) + ' %'; });
            if (!nast.hlas) vyberHlas(h.key);
            naplnVyberHlasu();
          } catch (e) { zapis('Stažení ' + h.key + ': ' + e.message); Dialog.chyba('Stažení selhalo: ' + e.message); }
          vykresliHlasy(); ukazMisto();
        });
      }
      seznam.appendChild(r);
    }
  }

  async function ukazMisto() {
    const o = await navigator.storage?.estimate?.();
    $('hlasyMisto').textContent = o ? `Úložiště: ${Math.round(o.usage / 1e6)} MB z ${Math.round(o.quota / 1e6)} MB` : '';
  }

  function vyberHlas(klic) {
    nast.hlas = klic; nast.mluvci = 0; ulozNast();
    $('hlasVyber').value = klic;
    const h = katalog.find(x => x.key === klic);
    if (h) {
      nast.jazyk = h.language.family; ulozNast();
      if (dokument.nazev === 'Ukázka' && UKAZKY[h.language.family] && dokument.text !== UKAZKY[h.language.family]) nastavText(UKAZKY[h.language.family], 'Ukázka');
    }
    if (prehr.hraje) spust(prehr.veta); else pripravHlas().catch(() => {});
  }

  /* ---------- ovládání ---------- */
  function prepniNabidku(id, tlacitko) {
    document.querySelectorAll('.nabidka').forEach(n => { if (n.id !== id) n.hidden = true; });
    const n = $(id);
    n.hidden = !n.hidden;
    if (!n.hidden) {
      const r = tlacitko.getBoundingClientRect();
      n.style.top = (r.bottom + 4) + 'px';
      n.style.left = Math.max(4, Math.min(r.left, innerWidth - n.offsetWidth - 4)) + 'px';
    }
  }
  document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); prepniNabidku(b.dataset.nabidka, b); }));
  document.addEventListener('click', e => { if (!e.target.closest('.nabidka')) document.querySelectorAll('.nabidka').forEach(n => { n.hidden = true; }); });
  document.querySelectorAll('.nabidka .tl').forEach(b => b.addEventListener('click', () => { b.closest('.nabidka').hidden = true; }));
  document.querySelectorAll('.zavoj').forEach(z => {
    z.addEventListener('click', e => { if (e.target === z || e.target.closest('[data-zavri]')) z.hidden = true; });
  });

  $('tlUkazka').onclick = () => nastavText(UKAZKY[(katalog.find(x => x.key === nast.hlas) || { language: { family: 'cs' } }).language.family] || UKAZKY.en, 'Ukázka');
  $('tlSoubor').onclick = () => $('souborVstup').click();
  $('souborVstup').onchange = e => { const f = e.target.files[0]; if (f) nactiSoubor(f); e.target.value = ''; };
  async function nactiSoubor(f) {
    if (f.size > 20e6) { Dialog.chyba('Soubor je příliš velký (víc než 20 MB).'); return; }
    nastavText(await f.text(), f.name.replace(/\.(md|markdown|txt)$/i, ''));
    zapis('Načten soubor ' + f.name + ': ' + vety.length + ' vět');
  }
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) nactiSoubor(f); });
  $('tlVymazat').onclick = async () => { if (await Dialog.potvrd('Vymazat text?')) { nastavText('', 'Text'); prepniUpravy(true); } };

  function prepniUpravy(zapnout) {
    const ed = $('editor');
    if (zapnout) {
      zastav();
      ed.value = dokument.text; ed.hidden = false; $('cteni').hidden = true; ed.focus();
    } else {
      ed.hidden = true; $('cteni').hidden = false;
      if (ed.value !== dokument.text) nastavText(ed.value, dokument.nazev === 'Ukázka' ? 'Vlastní text' : dokument.nazev);
    }
    $('tlUpravit').setAttribute('aria-pressed', String(!!zapnout));
  }
  $('tlUpravit').onclick = () => prepniUpravy($('editor').hidden);

  $('cteni').addEventListener('click', e => {
    const v = e.target.closest('.v');
    if (!v) return;
    const i = +v.dataset.i;
    if (prehr.hraje) skok(i); else spust(i);
  });
  $('tlHraj').onclick = hrajPauza;
  $('tlStop').onclick = zastav;
  $('tlZpet').onclick = () => skok(prehr.veta - 1);
  $('tlVpred').onclick = () => skok(prehr.veta + 1);
  $('rychlost').value = String(nast.rychlost);
  $('rychlost').onchange = e => { nast.rychlost = +e.target.value; ulozNast(); if (prehr.hraje) spust(prehr.veta); };
  $('hlasVyber').onchange = e => { if (e.target.value) vyberHlas(e.target.value); };
  $('tlHlasy').onclick = otevriHlasy;
  $('hlasyJazyk').onchange = vykresliHlasy;
  $('hlasyJenStazene').onchange = vykresliHlasy;

  function nastavRezim(r) {
    const zmena = nast.rezim !== r;
    nast.rezim = r; ulozNast();
    $('rezPrubezne').setAttribute('aria-pressed', String(r === 'prubezne'));
    $('rezPredem').setAttribute('aria-pressed', String(r === 'predem'));
    if (zmena && prehr.hraje) spust(prehr.veta);
  }
  $('rezPrubezne').onclick = () => nastavRezim('prubezne');
  $('rezPredem').onclick = () => nastavRezim('predem');
  nastavRezim(nast.rezim);

  $('tlWav').onclick = () => {
    const k = prehr.kusy[0];
    if (!k || !k.blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(k.blob);
    a.download = (dokument.nazev || 'predcitani').replace(/[\\/:*?"<>|]+/g, '_') + '.wav';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  };
  $('tlDenik').onclick = () => { $('denikText').textContent = denik.join('\n'); $('panelDenik').hidden = false; };
  $('tlDenikKopie').onclick = () => navigator.clipboard.writeText(denik.join('\n')).then(() => Dialog.info('Deník zkopírován.'), () => Dialog.chyba('Kopírování se nepodařilo – označte text ručně.'));
  $('tlNapoveda').onclick = () => { $('panelNapoveda').hidden = false; };

  document.addEventListener('keydown', e => {
    if (e.target.closest('textarea, input, select') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') { document.querySelectorAll('.zavoj, .nabidka').forEach(z => { z.hidden = true; }); return; }
    if (e.key === ' ') { e.preventDefault(); hrajPauza(); }
    else if (e.key === 'ArrowLeft') skok(prehr.veta - 1);
    else if (e.key === 'ArrowRight') skok(prehr.veta + 1);
  });

  /* ---------- start ---------- */
  vykresliText();
  naplnVyberHlasu();
  nactiKatalog().then(() => {
    naplnVyberHlasu();
    if (!$('panelHlasy').hidden) vykresliHlasy();
    if (!stazene.size) { stav('Stáhněte si hlas (⬇️ Hlasy)'); }
    else pripravHlas().catch(e => zapis('Hlas: ' + e.message));
  }).catch(e => {
    zapis('Seznam hlasů: ' + e.message);
    $('hlasySeznam').innerHTML = '<p class="var">Seznam hlasů se nepodařilo načíst (jste online?).</p>';
    stav('Seznam hlasů nedostupný');
  });
  ukazMisto();

  window.PREDC = { prehr, nast, get vety() { return vety; }, spust, zastav, skok, denik };   // pro testy
})();
