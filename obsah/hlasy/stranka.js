/* Dílna hlasů – rozhraní. Hlasy Piper sdílí s Předčítačem (Cache Storage „piper-hlasy“, worker
   predcitac/worker.js); úpravy hlasu efekty.js, umělý hlas formant.js.
   Uložené úpravy (webapp_hlasy_upravy) a vlastní hlasy (webapp_hlasy_vlastni) čte i Předčítač. */
(function () {
  'use strict';
  const J = window.PREDC_JADRO, E = window.HLASY_EFEKTY, F = window.HLASY_FORMANT;
  const $ = id => document.getElementById(id);
  const HF = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/';
  const CACHE_HLASU = 'piper-hlasy';
  const VLASTNI_URL = 'https://vlastni-hlas.local/';      // jen klíč v Cache Storage, nic se nestahuje
  const KLIC = 'webapp_hlasy', KLIC_UPRAVY = 'webapp_hlasy_upravy', KLIC_VLASTNI = 'webapp_hlasy_vlastni';
  const SR_UMELY = 22050;

  const nacti = (k, z) => { try { return JSON.parse(localStorage.getItem(k)) ?? z; } catch (e) { return z; } };
  const uloz = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { Dialog.chyba('Nepodařilo se uložit: ' + e.message); } };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const UKAZKA = 'Dobrý den. Tohle je ukázka hlasu z Dílny hlasů. Umí mluvit vysoko i hluboko, šeptat, nebo znít jako starý robot. Líbí se vám to?';
  const nast = Object.assign({ rezim: 'uprava', hlas: '', text: UKAZKA, uprava: E.uplne({}), umely: Object.assign({}, F.ZAKLAD, { efekt: 'zadny', mira: 0.4 }) }, nacti(KLIC, {}));
  nast.uprava = E.uplne(nast.uprava);
  nast.umely = Object.assign({}, F.ZAKLAD, { efekt: 'zadny', mira: 0.4 }, nast.umely);
  const ulozNast = () => uloz(KLIC, nast);

  const stav = t => { $('stav').textContent = t; };

  /* ---------- přehrávání a WAV ---------- */
  let posledni = null;   // {pcm, sr, nazev}
  function pust(pcm, sr, nazev) {
    const blob = new Blob([J.wavHlavicka(pcm.length, sr), J.naInt16(pcm)], { type: 'audio/wav' });
    const z = $('zvuk');
    if (z.src) URL.revokeObjectURL(z.src);
    z.src = URL.createObjectURL(blob);
    z.play().catch(() => {});
    posledni = { blob, nazev };
    $('tlWav').disabled = false;
  }
  $('tlWav').onclick = () => {
    if (!posledni) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(posledni.blob);
    a.download = posledni.nazev.replace(/[^\p{L}\p{N}_-]+/gu, '_') + '.wav';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  /* ---------- hlasy Piper v mezipaměti ---------- */
  const KE_STAZENI = [
    { nazev: 'jirka (oficiální, 63 MB)', onnx: HF + 'cs/cs_CZ/jirka/medium/cs_CZ-jirka-medium.onnx' },
    { nazev: 'Honza (komunitní, 64 MB)', onnx: 'https://huggingface.co/Thomcles/Piper-TTS-Czech/resolve/main/medium/model.onnx' },
  ];
  let hlasy = [];   // {klic (= URL onnx), nazev, json}
  function nazevHlasu(url) {
    if (url.startsWith(VLASTNI_URL)) {
      const id = url.slice(VLASTNI_URL.length).split('/')[0];
      return '⭐ ' + ((nacti(KLIC_VLASTNI, []).find(v => v.id === id) || {}).nazev || id);
    }
    const m = url.match(/Thomcles\/Piper-TTS-Czech\/resolve\/main\/(\w+)\//);
    if (m) return 'cs_CZ-honza-' + m[1];
    return decodeURIComponent(url.split('/').pop().replace(/\.onnx$/, ''));
  }
  async function nactiHlasy() {
    const cache = await caches.open(CACHE_HLASU);
    const klice = (await cache.keys()).map(r => r.url).filter(u => u.endsWith('.onnx'));
    hlasy = klice.map(u => ({ klic: u, nazev: nazevHlasu(u), json: u + '.json' }))
      .sort((a, b) => (a.nazev.startsWith('cs') || a.nazev.startsWith('⭐') ? 0 : 1) - (b.nazev.startsWith('cs') || b.nazev.startsWith('⭐') ? 0 : 1) || a.nazev.localeCompare(b.nazev));
    const sel = $('hlasVyber');
    sel.innerHTML = hlasy.length ? hlasy.map(h => `<option value="${esc(h.klic)}">${esc(h.nazev)}</option>`).join('') : '<option value="">– žádný stažený hlas –</option>';
    if (!hlasy.find(h => h.klic === nast.hlas)) nast.hlas = (hlasy.find(h => /jirka|honza/.test(h.nazev)) || hlasy[0] || {}).klic || '';
    sel.value = nast.hlas;
    const chybi = KE_STAZENI.filter(s => !klice.includes(s.onnx));
    $('hlasyStahnout').hidden = !chybi.length;
    $('hlasyStahnout').innerHTML = (hlasy.length ? '<span class="info">Další české hlasy:</span>' : '<span class="info">Žádný hlas není stažený. Český hlas se stáhne jednou a pak funguje i offline:</span>') +
      chybi.map(s => `<button class="tl" data-stahni="${esc(s.onnx)}">⬇️ ${esc(s.nazev)}</button>`).join('');
    $('hlasyStahnout').querySelectorAll('[data-stahni]').forEach(b => { b.onclick = () => stahni(b.dataset.stahni, b); });
    $('hlasInfo').textContent = hlasy.length ? 'Hlasy sdílí s Předčítačem.' : '';
  }

  async function stahni(onnx, tlacitko) {
    tlacitko.disabled = true;
    const p = $('prubeh');
    p.hidden = false; p.value = 0;
    try {
      const cache = await caches.open(CACHE_HLASU);
      const konfig = await fetch(onnx + '.json').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); });
      const r = await fetch(onnx);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const celkem = +r.headers.get('content-length') || 64e6, ctecka = r.body.getReader(), casti = [];
      let n = 0;
      for (;;) {
        const { done, value } = await ctecka.read();
        if (done) break;
        casti.push(value); n += value.length;
        p.value = n / celkem; stav('Stahuji hlas… ' + Math.round(n / 1e6) + ' MB');
      }
      await cache.put(onnx + '.json', new Response(konfig, { headers: { 'Content-Type': 'application/json' } }));
      await cache.put(onnx, new Response(new Blob(casti), { headers: { 'Content-Type': 'application/octet-stream' } }));
      navigator.storage?.persist?.();
      nast.hlas = onnx; ulozNast();
      stav('Hlas stažen.');
      await nactiHlasy();
    } catch (e) {
      Dialog.chyba('Stažení selhalo: ' + e.message);
      tlacitko.disabled = false;
    } finally { p.hidden = true; }
  }
  $('hlasVyber').onchange = e => { nast.hlas = e.target.value; ulozNast(); zaklad = null; };

  /* ---------- worker Piper (stejný jako Předčítač) ---------- */
  let worker = null, idZpravy = 0, nactenyHlas = null, konfigHlasu = null;
  const cekajici = new Map();
  function zadej(zprava, prenos = []) {
    if (!worker) {
      worker = new Worker('predcitac/worker.js');
      worker.onmessage = ({ data }) => {
        const p = cekajici.get(data.id); if (!p) return;
        cekajici.delete(data.id);
        data.typ === 'chyba' ? p.chyba(new Error(data.zprava)) : p.ok(data);
      };
      worker.onerror = e => { for (const p of cekajici.values()) p.chyba(new Error(e.message || 'chyba workeru')); cekajici.clear(); };
    }
    return new Promise((ok, chyba) => { const id = ++idZpravy; cekajici.set(id, { ok, chyba }); worker.postMessage(Object.assign({ id }, zprava), prenos); });
  }
  async function pripravHlas() {
    if (nactenyHlas === nast.hlas) return;
    stav('Načítám hlas…');
    const cache = await caches.open(CACHE_HLASU);
    const rk = await cache.match(nast.hlas + '.json'), rm = await cache.match(nast.hlas);
    if (!rk || !rm) throw new Error('hlas není v prohlížeči uložený');
    const konfig = await rk.json(), model = await rm.arrayBuffer();
    await zadej({ typ: 'hlas', model, konfig }, [model]);
    nactenyHlas = nast.hlas; konfigHlasu = konfig;
  }

  // základní (neupravený) zvuk textu – drží se, aby změna posuvníku jen přepočítala úpravy
  let zaklad = null;   // {klic, pcm, sr}
  async function zakladniZvuk() {
    const text = $('text').value.trim(), tempo = nast.uprava.tempo;
    const klic = nast.hlas + '|' + tempo + '|' + text;
    if (zaklad && zaklad.klic === klic) return zaklad;
    if (!nast.hlas) throw new Error('Nejdřív stáhněte nebo vyberte hlas.');
    await pripravHlas();
    const vety = J.rozeber(text), sr = konfigHlasu.audio.sample_rate, casti = [];
    let n = 0;
    const p = $('prubeh'); p.hidden = vety.length < 3;
    for (let i = 0; i < vety.length; i++) {
      stav(`Namlouvám větu ${i + 1} / ${vety.length}…`);
      p.value = i / vety.length;
      const { pcm } = await zadej({ typ: 'veta', text: vety[i].text, rychlost: tempo, mluvci: 0 });
      const ticho = new Float32Array(Math.round(J.pauza(vety[i]) * sr));
      casti.push(pcm, ticho); n += pcm.length + ticho.length;
    }
    p.hidden = true;
    const pcm = new Float32Array(n);
    let o = 0;
    for (const c of casti) { pcm.set(c, o); o += c.length; }
    zaklad = { klic, pcm, sr };
    return zaklad;
  }

  let bezi = false, znovu = false;
  async function mluv(puvodni = false) {
    if (!$('text').value.trim()) { stav('Napište nejdřív text.'); return; }
    if (bezi) { znovu = true; return; }
    bezi = true;
    try {
      do {
        znovu = false;
        if (nast.rezim === 'umely') {
          const t0 = performance.now();
          const p = nast.umely;
          let pcm = F.syntetizuj($('text').value, p, SR_UMELY);
          if (!puvodni && p.efekt !== 'zadny') pcm = E.uprav(pcm, SR_UMELY, { efekt: p.efekt, mira: p.mira });
          stav(`Hotovo (${String((pcm.length / SR_UMELY).toFixed(1)).replace('.', ',')} s zvuku za ${Math.round(performance.now() - t0)} ms)`);
          pust(pcm, SR_UMELY, 'umely_hlas');
        } else {
          const z = await zakladniZvuk();
          if (znovu) continue;
          stav('Upravuji…');
          await new Promise(r => setTimeout(r, 0));
          const t0 = performance.now();
          const pcm = puvodni ? z.pcm : E.uprav(z.pcm, z.sr, nast.uprava);
          stav(puvodni ? 'Původní hlas (bez úprav)' : `Hotovo (úprava ${Math.round(performance.now() - t0)} ms)`);
          pust(pcm, z.sr, puvodni ? 'puvodni_hlas' : 'upraveny_hlas');
        }
      } while (znovu);
    } catch (e) {
      stav('');
      Dialog.chyba(e.message);
    } finally { bezi = false; }
  }
  $('tlMluv').onclick = () => mluv(false);
  $('tlPuvodni').onclick = () => mluv(true);
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); mluv(false); }
    if (e.key === 'Escape') document.querySelectorAll('.zavoj, .nabidka').forEach(z => { z.hidden = true; });
  });

  /* ---------- posuvníky ---------- */
  const pt = v => (v > 0 ? '+' : '') + String(Math.round(v * 10) / 10).replace('.', ',') + ' pt';
  const nas = v => String(Math.round(v * 100) / 100).replace('.', ',') + '×';
  const proc = v => Math.round(v * 100) + ' %';
  const POS_UPRAVA = [
    { k: 'vyska', nazev: 'Výška hlasu', min: -12, max: 12, krok: 0.5, f: pt },
    { k: 'formant', nazev: 'Barva (hlasové ústrojí)', min: 0.7, max: 1.5, krok: 0.01, f: v => v < 0.97 ? nas(v) + ' delší' : v > 1.03 ? nas(v) + ' kratší' : nas(v) },
    { k: 'intonace', nazev: 'Intonace (melodie)', min: 0, max: 2, krok: 0.05, f: v => v === 0 ? 'monotónní' : nas(v) },
    { k: 'tempo', nazev: 'Tempo řeči', min: 0.6, max: 1.6, krok: 0.05, f: nas },
    { k: 'vibrato', nazev: 'Vibrato', min: 0, max: 1.5, krok: 0.05, f: pt },
    { k: 'vibratoHz', nazev: 'Rychlost vibrata', min: 2, max: 9, krok: 0.5, f: v => String(v).replace('.', ',') + ' Hz' },
    { k: 'chveni', nazev: 'Chvění (stáří, nejistota)', min: 0, max: 1, krok: 0.05, f: proc },
    { k: 'dech', nazev: 'Dech → šepot', min: 0, max: 1, krok: 0.05, f: proc },
    { k: 'efekt', nazev: 'Efekt', moznosti: E.EFEKTY },
    { k: 'mira', nazev: 'Síla efektu', min: 0, max: 1, krok: 0.05, f: proc },
  ];
  const POS_UMELY = [
    { k: 'f0', nazev: 'Výška hlasu', min: 50, max: 420, krok: 5, f: v => v + ' Hz' },
    { k: 'formant', nazev: 'Barva (hlasové ústrojí)', min: 0.7, max: 1.5, krok: 0.01, f: nas },
    { k: 'rychlost', nazev: 'Tempo řeči', min: 0.5, max: 1.8, krok: 0.05, f: nas },
    { k: 'intonace', nazev: 'Intonace (melodie)', min: 0, max: 2.5, krok: 0.05, f: v => v === 0 ? 'monotónní' : nas(v) },
    { k: 'otevreni', nazev: 'Hlasivky: měkké ↔ tvrdé', min: 0.35, max: 0.8, krok: 0.01, f: v => v < 0.5 ? 'tvrdé' : v > 0.62 ? 'měkké' : 'střední' },
    { k: 'dech', nazev: 'Dech', min: 0, max: 1, krok: 0.05, f: proc },
    { k: 'vibrato', nazev: 'Vibrato', min: 0, max: 1.5, krok: 0.05, f: pt },
    { k: 'chveni', nazev: 'Chvění', min: 0, max: 1, krok: 0.05, f: proc },
    { k: 'zdroj', nazev: 'Zdroj zvuku', moznosti: [['hlasivky', 'hlasivky (puls)'], ['pila', 'pila (robot)'], ['obdelnik', 'obdélník (8 bitů)'], ['sum', 'šum (šepot)']] },
    { k: 'efekt', nazev: 'Efekt', moznosti: E.EFEKTY },
    { k: 'mira', nazev: 'Síla efektu', min: 0, max: 1, krok: 0.05, f: proc },
  ];

  function posuvniky(kontejner, defs, param, poZmene) {
    kontejner.innerHTML = '';
    const ovl = {};
    for (const d of defs) {
      const lab = document.createElement('label');
      lab.className = 'posuvnik';
      if (d.moznosti) {
        lab.innerHTML = `<span>${esc(d.nazev)}</span><span></span><select class="tl">${d.moznosti.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join('')}</select>`;
        const s = lab.querySelector('select');
        s.onchange = () => { param[d.k] = s.value; poZmene(); };
        ovl[d.k] = () => { s.value = param[d.k]; };
      } else {
        lab.innerHTML = `<span>${esc(d.nazev)}</span><output></output><input type="range" min="${d.min}" max="${d.max}" step="${d.krok}">`;
        const inp = lab.querySelector('input'), out = lab.querySelector('output');
        inp.oninput = () => { param[d.k] = +inp.value; out.textContent = d.f(+inp.value); };
        inp.onchange = poZmene;
        ovl[d.k] = () => { inp.value = param[d.k]; out.textContent = d.f(+param[d.k]); };
      }
      kontejner.appendChild(lab);
    }
    const obnov = () => Object.values(ovl).forEach(f => f());
    obnov();
    return obnov;
  }

  const poZmeneUpravy = () => { ulozNast(); oznacPreset(); if (posledni) mluv(false); };
  const obnovUpravu = posuvniky($('posUprava'), POS_UPRAVA, nast.uprava, poZmeneUpravy);
  const poZmeneUmely = () => { ulozNast(); oznacPreset(); if (posledni) mluv(false); };
  const obnovUmely = posuvniky($('posUmely'), POS_UMELY, nast.umely, poZmeneUmely);

  /* ---------- předvolby ---------- */
  function cipy(kontejner, presety, nastav) {
    kontejner.innerHTML = presety.map(p => `<button class="tl" data-p="${p.id}" aria-pressed="false">${esc(p.nazev)}</button>`).join('');
    kontejner.querySelectorAll('[data-p]').forEach(b => { b.onclick = () => nastav(presety.find(p => p.id === b.dataset.p)); });
  }
  cipy($('presetyUprava'), E.PRESETY, p => {
    Object.assign(nast.uprava, E.uplne(p.param));
    obnovUpravu(); poZmeneUpravy();
  });
  cipy($('presetyUmely'), F.PRESETY, p => {
    Object.assign(nast.umely, F.ZAKLAD, { efekt: 'zadny', mira: 0.4 }, p.param);
    obnovUmely(); poZmeneUmely();
  });
  const stejne = (a, b) => Object.keys(a).every(k => a[k] === b[k]);
  function oznacPreset() {
    $('presetyUprava').querySelectorAll('[data-p]').forEach(b => {
      b.setAttribute('aria-pressed', stejne(E.uplne(E.PRESETY.find(p => p.id === b.dataset.p).param), nast.uprava));
    });
    $('presetyUmely').querySelectorAll('[data-p]').forEach(b => {
      const p = F.PRESETY.find(x => x.id === b.dataset.p);
      b.setAttribute('aria-pressed', stejne(Object.assign({}, F.ZAKLAD, { efekt: 'zadny', mira: 0.4 }, p.param), nast.umely));
    });
  }
  $('tlResetUprava').onclick = () => { Object.assign(nast.uprava, E.uplne({})); obnovUpravu(); poZmeneUpravy(); };

  /* ---------- moje upravené hlasy ---------- */
  function vykresliUpravy() {
    const u = nacti(KLIC_UPRAVY, []);
    $('seznamUprav').innerHTML = u.length ? u.map(x => `<div class="polozka"><div><div class="jm">${esc(x.nazev)}</div><div class="info">${esc(popisUpravy(x.param))}${x.zaklad ? ' · ' + esc(nazevHlasu(x.zaklad)) : ''}</div></div>
      <div class="akce"><button class="tl" data-pouzij="${x.id}">▶ Použít</button><button class="tl" data-smaz="${x.id}" title="Smazat">🗑️</button></div></div>`).join('')
      : '<div class="prazdno">Zatím žádný. Nastavte posuvníky a dejte „Uložit jako můj hlas“.</div>';
    $('seznamUprav').querySelectorAll('[data-pouzij]').forEach(b => { b.onclick = () => {
      const x = nacti(KLIC_UPRAVY, []).find(v => v.id === b.dataset.pouzij);
      Object.assign(nast.uprava, E.uplne(x.param));
      if (x.zaklad && hlasy.find(h => h.klic === x.zaklad)) { nast.hlas = x.zaklad; $('hlasVyber').value = x.zaklad; }
      obnovUpravu(); ulozNast(); oznacPreset(); mluv(false);
    }; });
    $('seznamUprav').querySelectorAll('[data-smaz]').forEach(b => { b.onclick = async () => {
      if (!await Dialog.potvrd('Smazat tento hlas?')) return;
      uloz(KLIC_UPRAVY, nacti(KLIC_UPRAVY, []).filter(v => v.id !== b.dataset.smaz)); vykresliUpravy();
    }; });
  }
  function popisUpravy(p) {
    p = E.uplne(p);
    const c = [];
    if (p.vyska) c.push('výška ' + pt(p.vyska));
    if (p.formant !== 1) c.push('barva ' + nas(p.formant));
    if (p.intonace !== 1) c.push('intonace ' + nas(p.intonace));
    if (p.tempo !== 1) c.push('tempo ' + nas(p.tempo));
    if (p.vibrato) c.push('vibrato');
    if (p.chveni) c.push('chvění');
    if (p.dech) c.push(p.dech >= 1 ? 'šepot' : 'dech');
    if (p.efekt !== 'zadny') c.push((E.EFEKTY.find(e => e[0] === p.efekt) || [, p.efekt])[1]);
    return c.join(', ') || 'beze změny';
  }
  $('tlUlozUpravu').onclick = async () => {
    const nazev = await Dialog.zeptej('Název hlasu (např. Babička Marie):', '');
    if (!nazev || !nazev.trim()) return;
    const u = nacti(KLIC_UPRAVY, []);
    u.push({ id: 'u' + Date.now().toString(36), nazev: nazev.trim().slice(0, 60), zaklad: nast.hlas, param: Object.assign({}, nast.uprava) });
    uloz(KLIC_UPRAVY, u); vykresliUpravy();
  };

  /* ---------- vlastní hlasy (import .onnx + .json) ---------- */
  $('tlImport').onclick = () => $('importVstup').click();
  $('importVstup').onchange = async e => {
    const soubory = [...e.target.files];
    e.target.value = '';
    const onnx = soubory.find(f => /\.onnx$/i.test(f.name)), json = soubory.find(f => /\.json$/i.test(f.name));
    if (!onnx || !json) { Dialog.chyba('Vyberte najednou oba soubory: model .onnx i konfiguraci .onnx.json.'); return; }
    let konfig;
    try { konfig = JSON.parse(await json.text()); } catch (er) { Dialog.chyba('Konfigurace není platný JSON.'); return; }
    if (!konfig.audio || !konfig.audio.sample_rate || !konfig.phoneme_id_map || !konfig.espeak || !konfig.espeak.voice) { Dialog.chyba('Tohle není konfigurace hlasu Piper (chybí audio.sample_rate, espeak.voice nebo phoneme_id_map).'); return; }
    if (onnx.size < 1e6) { Dialog.chyba('Soubor modelu je podezřele malý.'); return; }
    const nazev = await Dialog.zeptej('Název hlasu:', onnx.name.replace(/\.onnx$/i, '').replace(/^model$/, 'Můj hlas'));
    if (!nazev || !nazev.trim()) return;
    const id = 'v' + Date.now().toString(36), zakl = VLASTNI_URL + id + '/model.onnx';
    try {
      const cache = await caches.open(CACHE_HLASU);
      await cache.put(zakl + '.json', new Response(JSON.stringify(konfig), { headers: { 'Content-Type': 'application/json' } }));
      await cache.put(zakl, new Response(onnx, { headers: { 'Content-Type': 'application/octet-stream' } }));
      navigator.storage?.persist?.();
    } catch (er) { Dialog.chyba('Uložení do prohlížeče selhalo: ' + er.message); return; }
    const jazyk = konfig.language || { code: konfig.espeak.voice, family: konfig.espeak.voice.split(/[-_]/)[0], name_native: konfig.espeak.voice };
    const v = nacti(KLIC_VLASTNI, []);
    v.push({ id, nazev: nazev.trim().slice(0, 60), jazyk, velikost: onnx.size + json.size, mluvcich: konfig.num_speakers || 1 });
    uloz(KLIC_VLASTNI, v);
    await nactiHlasy(); vykresliVlastni();
    stav('Hlas „' + nazev.trim() + '“ uložen.');
  };
  function vykresliVlastni() {
    const v = nacti(KLIC_VLASTNI, []);
    $('seznamVlastnich').innerHTML = v.length ? v.map(x => `<div class="polozka"><div><div class="jm">⭐ ${esc(x.nazev)}</div><div class="info">${esc(x.jazyk.name_native || x.jazyk.code)} · ${Math.round(x.velikost / 1e6)} MB</div></div>
      <div class="akce"><button class="tl" data-zkus="${x.id}">🎚️ Vyzkoušet</button><button class="tl" data-smaz="${x.id}" title="Smazat">🗑️</button></div></div>`).join('')
      : '<div class="prazdno">Zatím žádný vlastní hlas.</div>';
    $('seznamVlastnich').querySelectorAll('[data-zkus]').forEach(b => { b.onclick = () => {
      nast.hlas = VLASTNI_URL + b.dataset.zkus + '/model.onnx'; zaklad = null; ulozNast();
      $('hlasVyber').value = nast.hlas; prepniRezim('uprava'); mluv(false);
    }; });
    $('seznamVlastnich').querySelectorAll('[data-smaz]').forEach(b => { b.onclick = async () => {
      if (!await Dialog.potvrd('Smazat hlas z prohlížeče?')) return;
      const cache = await caches.open(CACHE_HLASU), u = VLASTNI_URL + b.dataset.smaz + '/model.onnx';
      await cache.delete(u); await cache.delete(u + '.json');
      uloz(KLIC_VLASTNI, nacti(KLIC_VLASTNI, []).filter(x => x.id !== b.dataset.smaz));
      if (nast.hlas === u) { nast.hlas = ''; nactenyHlas = null; }
      zaklad = null; await nactiHlasy(); vykresliVlastni();
    }; });
  }

  /* ---------- režimy, text, nabídky ---------- */
  function prepniRezim(r) {
    nast.rezim = r; ulozNast();
    document.querySelectorAll('[data-rezim]').forEach(b => b.setAttribute('aria-pressed', b.dataset.rezim === r));
    $('rezimUprava').hidden = r !== 'uprava'; $('rezimUmely').hidden = r !== 'umely'; $('rezimNove').hidden = r !== 'nove';
    $('kartaText').hidden = r === 'nove';
    $('tlMluv').disabled = $('tlPuvodni').disabled = r === 'nove';
    posledni = null;
    if (r === 'umely') ukazPrepis();
  }
  document.querySelectorAll('[data-rezim]').forEach(b => { b.onclick = () => prepniRezim(b.dataset.rezim); });

  let casPrepisu = 0;
  function ukazPrepis() { $('prepis').textContent = 'Výslovnost: ' + F.prepis($('text').value.slice(0, 2000)); }
  $('text').value = nast.text;
  $('text').oninput = () => {
    nast.text = $('text').value; ulozNast();
    clearTimeout(casPrepisu);
    if (nast.rezim === 'umely') casPrepisu = setTimeout(ukazPrepis, 250);
  };
  $('tlUkazka').onclick = () => { $('text').value = UKAZKA; $('text').oninput(); };
  $('tlPredcitac').onclick = () => { location.href = 'predcitac.html'; };
  $('tlNapoveda').onclick = () => { $('panelNapoveda').hidden = false; };

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
  document.querySelectorAll('.zavoj').forEach(z => z.addEventListener('click', e => { if (e.target === z || e.target.closest('[data-zavri]')) z.hidden = true; }));

  // pro testy
  window.HLASY_APP = { nast, mluv, prepniRezim, nactiHlasy, posledni: () => posledni, stav: () => $('stav').textContent };

  prepniRezim(nast.rezim);
  oznacPreset();
  vykresliUpravy();
  vykresliVlastni();
  nactiHlasy().catch(e => stav('Hlasy nelze načíst: ' + e.message));
})();
