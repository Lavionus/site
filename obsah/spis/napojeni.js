/* Napojení stávajícího nástroje na jednotný spis (etapa S2) – společné pro Evidenční deník, Časovou osu,
   Analýzu vazeb a Náčrt místa činu. Potřebuje ../dialog.js, spis/jadro.js a spis/vyber.js.
     const N = SpisNapojeni.pripoj({ nastroj: 'evidence_log', lista: prvek, naZmenu: async (pripadId, jinyPripad) => … });
   - Do lišty vloží „📁 Spis: …“ (SpisVyber). Bez zvoleného spisu je N.pripad null a nástroj pracuje s vlastním úložištěm.
   - naZmenu(id, jinyPripad) se volá po načtení stránky, po přepnutí spisu a po změně dat případu v jiné záložce / jiným
     nástrojem (jinyPripad = true, když se změnil sám případ, ne jen jeho data). Vlastní zápisy (N.zapis) ho nevolají.
   - Modelový případ (?pripad=17): nástroj dál pracuje v odděleném úložišti; jen když je aktivním spisem právě modelový
     případ (`model-17`), pracuje nad spisem – průvodce tak běží nad spisem. Tlačítko „📁 Otevřít jako spis“ ho
     založí (SPIS.zalozModelovy, nic nezdvojí) a otevře.
   - Zápisy i načítání jdou jednou frontou, aby se nepřekrývaly. */
(function () {
  'use strict';
  const S = window.SPIS;
  const RE_ID = /^[\w.:-]{1,160}$/;

  // id přijatelné pro spis (znaky [\w.:-], nejvýš 120 – Časová osa ořezává id na 120); stejné id → stejný výsledek
  function bezpecneId(id, predpona) {
    let s = String(id == null ? '' : id).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.:-]+/g, '_').slice(0, 120);
    if (!s) s = (predpona || 'e') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    return s;
  }
  const platneId = id => typeof id === 'string' && RE_ID.test(id) && id.length <= 120;

  /* Zapíše do spisu jen to, co se od posledního stavu změnilo. snimek = Map(id → klíč položky v podobě nástroje),
     polozky = pole s .id, klic(polozka) → text, uloz(polozka) a smaz(id) = async zápis jednoho záznamu. */
  async function zapisZmeny(snimek, polozky, { klic, uloz, smaz }) {
    const ted = new Map(polozky.map(p => [p.id, [p, klic(p)]]));
    let zapsano = 0;
    for (const [id, [p, k]] of ted) if (snimek.get(id) !== k) { await uloz(p); snimek.set(id, k); zapsano++; }
    for (const id of [...snimek.keys()]) if (!ted.has(id)) { if (smaz) await smaz(id); snimek.delete(id); zapsano++; }
    return zapsano;
  }

  function pripoj(v) {
    const MP = window.ModelovyPripad && window.ModelovyPripad.aktivni ? window.MODELOVY_PRIPAD : null;
    const MODEL_ID = MP ? 'model-' + MP.id : null;
    let pripad = null, nazev = '', zapisuji = 0, casovac = null, fronta = Promise.resolve(), tlModel = null;
    const radit = f => (fronta = fronta.then(f, f).catch(e => console.error(e)));
    const chyba = e => { if (window.Dialog) Dialog.chyba(e && e.message ? e.message : String(e)); else console.error(e); };

    async function zjisti() {
      const id = S.aktivni();
      if (!id || (MP && id !== MODEL_ID)) return null;
      try { const p = await S.pripad(id); return p || null; } catch (e) { chyba(e); return null; }
    }
    function obnov() {
      return radit(async () => {
        const p = await zjisti(), jiny = (p ? p.id : null) !== pripad;
        pripad = p ? p.id : null; nazev = p ? (p.cislo ? p.cislo + ' – ' : '') + p.nazev : '';
        if (tlModel) tlModel.style.display = pripad ? 'none' : '';   // .sv-tl má display, [hidden] by přebil
        try { await v.naZmenu(pripad, jiny); } catch (e) { chyba(e); }
      });
    }
    const planuj = () => { clearTimeout(casovac); casovac = setTimeout(obnov, 120); };

    if (v.lista && window.SpisVyber) SpisVyber.vloz(v.lista, { nastroj: v.nastroj });
    if (MP && v.lista) {
      tlModel = S.el('button', { type: 'button', class: 'sv-tl', style: 'display:none', title: 'Založí modelový případ jako spis (nic nezdvojí ani nepřepíše) a otevře ho – průvodce pak poběží nad spisem a změny uvidí všechny nástroje.',
        onclick: async () => {
          try { await S.zalozModelovy(MP, { nastroj: v.nastroj }); await S.otevri(MODEL_ID); } catch (e) { chyba(e); }
        } }, '📁 Otevřít jako spis');
      v.lista.append(tlModel);
    }
    S.odebirej(u => {
      if (u.druh === 'aktivni' || u.druh === 'pripad') return planuj();
      if (!pripad || u.pripad !== pripad) return;
      if (u.mistni && zapisuji) return;   // vlastní zápis – stav nástroje už ho obsahuje
      planuj();
    });
    addEventListener('storage', e => { if (e.key === S.KLIC_AKTIVNI) planuj(); });
    const hotovo = obnov();

    return {
      get pripad() { return pripad; },
      get nazev() { return nazev; },
      get model() { return MP; },
      MODEL_ID, hotovo, obnov,
      // async fn(SPIS) ve frontě; změny, které vyvolá, se nástroji nevrací jako cizí
      zapis(fn) {
        return radit(async () => {
          if (!pripad) return;
          zapisuji++;
          try { return await fn(S, pripad); } catch (e) { chyba(e); planuj(); } finally { zapisuji--; }
        });
      },
      // jednorázový převod vlastních dat do spisu – jen s potvrzením; originál zůstává beze změny
      async prevod(pocet, co, proved) {
        if (!pripad) return Dialog.info('Nejdřív zvolte spis (📁 Spis: … v horní liště).');
        if (!pocet) return Dialog.info('Ve vlastním úložišti nástroje není nic k převodu.');
        const ok = await Dialog.potvrd(`Převést ${co} do spisu „${nazev}“?\n\nVlastní data nástroje zůstanou beze změny (originál se nemaže). Co už ve spisu z dřívějšího převodu je, se nezdvojí.`, { ok: 'Převést', zrus: 'Zrušit' });
        if (!ok) return;
        const r = await this.zapis(proved);
        await obnov();
        if (r) Dialog.info(r);
      }
    };
  }

  window.SpisNapojeni = { pripoj, zapisZmeny, bezpecneId, platneId };
})();
