/* Worker Porovnání otisků souborů: počítá otisky jednoho souboru, ať UI nezamrzne.
   Zpráva {id, soubor: File, algoritmy:[…]} → {id, prubeh: 0..1} … {id, otisky:{ALG:hex}, poznamky:[…]}.
   Malé soubory celým bufferem přes crypto.subtle (MD5 vlastní implementací), velké po blocích
   vlastní postupnou SHA-256/SHA-1/MD5; SHA-384/512 crypto.subtle neumí po blocích, proto do MAX_CELY. */
importScripts('jadro.js');
const LIMIT = 256 * 1024 * 1024;      // nad tím se čte po blocích
const BLOK = 16 * 1024 * 1024;
const MAX_CELY = 1024 * 1024 * 1024;  // SHA-384/512 – celý soubor v paměti nejvýš 1 GiB

onmessage = async e => {
  const { id, soubor, algoritmy } = e.data;
  const otisky = {}, poznamky = [];
  try {
    if (soubor.size <= LIMIT) {
      const buf = await soubor.arrayBuffer();
      for (const a of algoritmy) {
        otisky[a] = a === 'MD5' ? HASHJADRO.md5().update(new Uint8Array(buf)).digest()
          : HASHJADRO.hex(new Uint8Array(await crypto.subtle.digest(a, buf)));
      }
    } else {
      const post = algoritmy.filter(a => HASHJADRO.POSTUPNE[a]).map(a => [a, HASHJADRO.POSTUPNE[a]()]);
      for (let o = 0; o < soubor.size; o += BLOK) {
        const d = new Uint8Array(await soubor.slice(o, o + BLOK).arrayBuffer());
        post.forEach(([, h]) => h.update(d));
        postMessage({ id, prubeh: Math.min(1, (o + d.length) / soubor.size) });
      }
      post.forEach(([a, h]) => { otisky[a] = h.digest(); });
      for (const a of algoritmy.filter(a => !HASHJADRO.POSTUPNE[a])) {
        if (soubor.size > MAX_CELY) { poznamky.push(a + ': soubor nad 1 GiB, nespočítáno'); continue; }
        otisky[a] = HASHJADRO.hex(new Uint8Array(await crypto.subtle.digest(a, await soubor.arrayBuffer())));
      }
    }
    postMessage({ id, otisky, poznamky });
  } catch (err) {
    postMessage({ id, otisky, poznamky, chyba: String(err && err.message || err) });
  }
};
