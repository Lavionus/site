/* Volná místa – Worker: stáhne volna-mista.json z MPSV proudově, sestaví data (sestav.js)
   a uloží je do IndexedDB (uloziste.js). Zprávy ven: {nacteno, celkem} | {hotovo, meta, radky} | {chyba}. */
importScripts('sestav.js', 'uloziste.js');

const json = u => fetch(u).then(r => { if (!r.ok) throw new Error(u + ': ' + r.status); return r.json(); });

onmessage = async e => {
  const { zdroj, den } = e.data;
  try {
    const [podklady, obce] = await Promise.all([json('data/podklady.json'), json('data/obce.json')]);
    const r = await fetch(zdroj, { cache: 'no-store' });
    if (!r.ok) throw new Error('MPSV odpovědělo ' + r.status);
    const celkem = +r.headers.get('content-length') || 0;
    const verze = r.headers.get('last-modified') + '|' + celkem;
    const S = PRACE_SESTAV, sestava = S.novy(podklady, obce), vloz = S.delic();
    const cteni = r.body.getReader(), dekoder = new TextDecoder();
    let nacteno = 0, hlaseno = 0;
    for (;;) {
      const { done, value } = await cteni.read();
      if (done) break;
      nacteno += value.length;
      for (const o of vloz(dekoder.decode(value, { stream: true }))) sestava.pridej(JSON.parse(o));
      if (nacteno - hlaseno > 1 << 20) { hlaseno = nacteno; postMessage({ nacteno, celkem }); }
    }
    const { meta, radky, detaily } = sestava.hotovo();
    meta.verze = verze;
    if (!radky.length) throw new Error('v datech MPSV nejsou žádné inzeráty');
    const zapis = { meta, mista: radky, stav: { verze, den } };
    detaily.forEach((d, i) => { zapis['detail/' + String(i).padStart(2, '0')] = d; });
    await PRACE_ULOZISTE.zapis(zapis);
    postMessage({ hotovo: true, meta, radky });
  } catch (chyba) {
    postMessage({ chyba: chyba.message || String(chyba) });
  }
};
