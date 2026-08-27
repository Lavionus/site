/* ============================================================
   rec.js – sdílené čtení nahlas.

   Dvě cesty, v tomto pořadí:
   1) systémový hlas prohlížeče (Web Speech API) – zní nejlépe,
   2) vestavěný hlas ve složce `hlas/` (meSpeak = eSpeak přeložený do
      JavaScriptu) – funguje i tam, kde systém žádný hlas nemá.

   Proč vůbec záloha: `'speechSynthesis' in window` je pravda i v prohlížeči
   bez jediného nainstalovaného hlasu a řeč se pak „přehraje“ do ticha.
   Na Linuxu je to běžné – hlasy dodává speech-dispatcher a bez syntetizéru
   hlásí jen modul `dummy`.

   Vestavěný hlas se stahuje až při prvním použití (~0,5 MB gzip) a service
   worker si ho pak drží v cache, takže podruhé funguje i offline.

   Použití:
     <script src="../rec.js"></script>
     Rec.mluv('máma', { rychlost: 0.8 });
     Rec.hlidejTlacitko(document.getElementById('btnCist'));
     Rec.poznamkaOHlasu(rodicovskyPrvek);
   ============================================================ */
const Rec = (function () {
  /* Hlavní vypínač čtení nahlas.
     Vestavěný hlas (eSpeak) čte česky, ale hrubě – na výuku čtení v 1. ročníku
     to není použitelné. Než web dostane kvalitní český hlas, je čtení vypnuté:
     tlačítka se skryjí a `mluv()` nic nedělá. Zapnutí = přepnout na true. */
  const CTENI_ZAPNUTO = false;

  /* Základna pro dohledání složky `hlas/` – počítá se z adresy tohoto
     skriptu, ne ze stránky, která ho vkládá (ta je o adresář níž). */
  const ZAKLADNA = (function () {
    const s = document.currentScript && document.currentScript.src;
    return s ? s.replace(/[^/]+$/, '') : '';
  })();

  /* Vestavěné hlasy: jazyk -> { soubor v hlas/voices/, id hlasu v meSpeaku }.
     Angličtina má v meSpeaku id i cestu 'en/en', ostatní jsou ploché. */
  const ZALOHA_JAZYKY = {
    cs: { soubor: 'cs', id: 'cs' },
    en: { soubor: 'en/en', id: 'en/en' },
    de: { soubor: 'de', id: 'de' },
    fr: { soubor: 'fr', id: 'fr' },
  };

  let hlasy = [];
  let zalohaStav = 'nenacteno';   // nenacteno | nacita | pripraveno | chyba
  const zalohaHlasy = {};         // jazyk -> true, když je hlas nahraný
  const posluchaci = [];

  function oznam() { posluchaci.forEach(fn => fn()); }

  /* ---- systémové hlasy ---------------------------------------------------- */
  function synth() {
    try { return window.speechSynthesis || null; }
    catch { return null; }
  }

  function nactiHlasy() {
    const s = synth();
    if (!s) return;
    try { hlasy = s.getVoices() || []; } catch { hlasy = []; }
    oznam();
  }

  if (synth()) {
    nactiHlasy();
    try { synth().addEventListener('voiceschanged', nactiHlasy); } catch { /* starší prohlížeč */ }
    // Chrome plní seznam se zpožděním i bez události – zkusíme ještě jednou.
    setTimeout(nactiHlasy, 900);
  }

  /* Nejlepší systémový hlas: přesná shoda (cs-CZ), pak shoda předpony (cs). */
  function najdiHlas(lang) {
    if (!lang) return null;
    const cil = lang.toLowerCase();
    const predpona = cil.split('-')[0];
    return hlasy.find(h => (h.lang || '').toLowerCase() === cil)
      || hlasy.find(h => (h.lang || '').toLowerCase().split('-')[0] === predpona)
      || null;
  }

  /* ---- vestavěný hlas (meSpeak) ------------------------------------------- */
  function zalohaJazyk(lang) {
    return ZALOHA_JAZYKY[(lang || 'cs').toLowerCase().split('-')[0]] || null;
  }

  function nactiSkript(url) {
    return new Promise((splneno, chyba) => {
      const s = document.createElement('script');
      s.src = url;
      s.onload = () => splneno();
      s.onerror = () => chyba(new Error('nelze načíst ' + url));
      document.head.appendChild(s);
    });
  }

  let zalohaSlib = null;
  function pripravZalohu() {
    if (zalohaSlib) return zalohaSlib;
    zalohaStav = 'nacita';
    oznam();
    zalohaSlib = nactiSkript(ZAKLADNA + 'hlas/mespeak.js')
      .then(() => {
        if (!window.meSpeak) throw new Error('meSpeak se nenačetl');
        zalohaStav = 'pripraveno';
        oznam();
      })
      .catch(e => {
        zalohaStav = 'chyba';
        oznam();
        throw e;
      });
    return zalohaSlib;
  }

  function nactiZalozniHlas(hlas) {
    if (zalohaHlasy[hlas.id]) return Promise.resolve();
    return new Promise((splneno, chyba) => {
      window.meSpeak.loadVoice(ZAKLADNA + 'hlas/voices/' + hlas.soubor + '.json', (uspech, zprava) => {
        if (uspech) { zalohaHlasy[hlas.id] = true; splneno(); }
        else chyba(new Error(zprava || 'hlas se nenačetl'));
      });
    });
  }

  function zalohaMluv(text, lang, rychlost) {
    const hlas = zalohaJazyk(lang);
    if (!hlas || zalohaStav === 'chyba') return false;
    pripravZalohu()
      .then(() => nactiZalozniHlas(hlas))
      .then(() => {
        window.meSpeak.stop();
        window.meSpeak.speak(String(text), {
          voice: hlas.id,
          // meSpeak měří rychlost ve slovech za minutu, výchozí je 175
          speed: Math.round(175 * (rychlost || 0.85)),
        });
        oznam();
      })
      .catch(() => { zalohaStav = 'chyba'; oznam(); });
    return true;
  }

  /* ---- stav --------------------------------------------------------------
     'ok'            – systémový hlas pro daný jazyk
     'zaloha'        – použije se vestavěný hlas ze složky hlas/
     'nacita'        – vestavěný hlas se právě stahuje
     'nepodporovano' – ani jedno (neznámý jazyk a žádný systémový hlas) */
  function stav(lang) {
    if (!CTENI_ZAPNUTO) return 'vypnuto';
    if (najdiHlas(lang)) return 'ok';
    if (zalohaJazyk(lang) && zalohaStav !== 'chyba') {
      return zalohaStav === 'nacita' ? 'nacita' : 'zaloha';
    }
    if (hlasy.length) return 'ok';   // jiný jazyk, ale mluvit umí
    return 'nepodporovano';
  }

  const HLASKY = {
    ok: '',
    vypnuto: '',
    zaloha: 'Systém nemá nainstalovaný hlas, použije se vestavěný hlas webu. '
      + 'Při prvním přehrání se stáhne (asi půl megabajtu) a pak funguje i offline. '
      + 'Zní strojově – hezčí hlas získáte doinstalováním systémového (na Linuxu například espeak-ng nebo piper).',
    nacita: 'Vestavěný hlas se stahuje…',
    nepodporovano: 'Tento prohlížeč neumí čtení nahlas. Zkuste Chrome, Edge nebo Firefox.',
  };

  /* ---- veřejné rozhraní ---------------------------------------------------- */
  /* Přečte text. Vrací true, když se čtení podařilo spustit. */
  function mluv(text, volby = {}) {
    if (!CTENI_ZAPNUTO || !text) return false;
    const lang = volby.lang || 'cs-CZ';
    const rychlost = volby.rychlost || 0.85;

    const hlas = najdiHlas(lang);
    if (hlas) {
      const s = synth();
      try {
        const u = new SpeechSynthesisUtterance(String(text));
        u.lang = lang;
        u.rate = rychlost;
        u.voice = hlas;
        s.cancel();
        // cancel() a speak() těsně po sobě si v Chrome občas přebíjejí frontu
        setTimeout(() => { try { s.speak(u); } catch { /* nic */ } }, 0);
        return true;
      } catch { /* propadneme na vestavěný hlas */ }
    }
    return zalohaMluv(text, lang, rychlost);
  }

  function ticho() {
    const s = synth();
    if (s) { try { s.cancel(); } catch { /* nic */ } }
    if (window.meSpeak) { try { window.meSpeak.stop(); } catch { /* nic */ } }
  }

  /* Tlačítko pro čtení: vypne se jen tehdy, když nemluví vůbec nic. */
  function hlidejTlacitko(tlacitko, volby = {}) {
    if (!tlacitko) return;
    const lang = volby.lang || 'cs-CZ';
    const puvodniText = tlacitko.textContent;
    const puvodniTitulek = tlacitko.title;
    function obnov() {
      const st = stav(lang);
      if (st === 'vypnuto') { tlacitko.style.display = 'none'; return; }
      tlacitko.style.display = '';
      tlacitko.disabled = st === 'nepodporovano';
      tlacitko.title = HLASKY[st] || puvodniTitulek;
      tlacitko.textContent = st === 'nepodporovano' ? '🔇 Čtení nedostupné'
        : st === 'nacita' ? '⏳ Načítám hlas…'
        : puvodniText;
    }
    posluchaci.push(obnov);
    obnov();
  }

  /* Vysvětlivka pod stránkou – ukáže se jen, když je co vysvětlovat. */
  function poznamkaOHlasu(rodic, volby = {}) {
    if (!rodic || !CTENI_ZAPNUTO) return null;
    const el = document.createElement('div');
    el.className = 'rec-poznamka';
    el.style.cssText = 'color:var(--text-faint);font-size:0.78rem;line-height:1.45;margin-top:8px;display:none';
    rodic.appendChild(el);
    function obnov() {
      const st = stav(volby.lang || 'cs-CZ');
      el.textContent = HLASKY[st] || '';
      el.style.display = HLASKY[st] ? '' : 'none';
    }
    posluchaci.push(obnov);
    obnov();
    return el;
  }

  /* Skryje ovládací prvky čtení, které nejdou přes hlidejTlacitko
     (starší stránky s vlastním přepínačem zvuku). */
  function skryjOvladani() {
    if (CTENI_ZAPNUTO) return;
    for (const sel of arguments) {
      document.querySelectorAll(sel).forEach(el => { el.style.display = 'none'; });
    }
  }

  return {
    mluv, ticho, stav, hlidejTlacitko, poznamkaOHlasu, pripravZalohu, skryjOvladani,
    zapnuto: () => CTENI_ZAPNUTO,
    hlasy: () => hlasy,
    zalohaStav: () => zalohaStav,
  };
})();
