#!/usr/bin/env python3
"""Z occt-wasm.js (ES modul z balíčku occt-wasm) vyrobí:
   occt.klasicky.js     – stejný kód jako obyčejný skript (`export default createOcctWasm`
                          → globalThis.OcctWasmModule, `import.meta.url` → globalThis.OCCT_URL),
                          načte ho importScripts v klasickém workeru i <script>,
   occt-wasm.wasm.gz.js – occt-wasm.wasm zkomprimovaný gzipem jako base64
                          (globalThis.OCCT_WASM_GZ_B64) pro otevření stránky z file://,
                          kde prohlížeč nedovolí .wasm stáhnout; rozbalí ho DecompressionStream.
Spuštění po aktualizaci knihovny: python3 prevod_klasicky.py (ve složce obsah/lib/occt)."""
import base64, gzip, os
tu = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(tu, 'occt-wasm.js'), encoding='utf-8').read()
assert src.count('export default createOcctWasm') == 1, 'nečekaný tvar occt-wasm.js'
out = src.replace('export default createOcctWasm', 'globalThis.OcctWasmModule=createOcctWasm')
out = out.replace('import.meta.url', '(globalThis.OCCT_URL||"")')
assert 'import.meta' not in out
hlavicka = ('/* occt-wasm (OpenCascade, výstup LGPL-2.1, viz LICENCE.txt) převedený na klasický skript '
            'skriptem prevod_klasicky.py: změněno jen `export default` a `import.meta.url`. */\n')
open(os.path.join(tu, 'occt.klasicky.js'), 'w', encoding='utf-8').write(hlavicka + out)
gz = gzip.compress(open(os.path.join(tu, 'occt-wasm.wasm'), 'rb').read(), 9)
open(os.path.join(tu, 'occt-wasm.wasm.gz.js'), 'w').write(
    '/* occt-wasm.wasm (OpenCascade, LGPL-2.1) – gzip + base64 pro otevření stránky z file:// */\n'
    'globalThis.OCCT_WASM_GZ_B64="' + base64.b64encode(gz).decode() + '";\n')
print('hotovo:', len(out), 'B JS, gzip', len(gz), 'B')
