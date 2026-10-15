#!/usr/bin/env python3
"""Z manifold.js (ES modul z balíčku manifold-3d) vyrobí:
   manifold.klasicky.js – stejný kód jako obyčejný skript: `export default Module`
     → globalThis.ManifoldModule, `import.meta.url` → globalThis.MANIFOLD_URL
     (načte se přes <script> i importScripts, tedy i z file:// a v klasickém workeru),
   manifold.wasm.js – manifold.wasm jako base64 (globalThis.MANIFOLD_WASM_B64)
     pro file://, kde prohlížeč nedovolí soubor .wasm stáhnout.
Spuštění po aktualizaci knihovny: python3 prevod_klasicky.py (ve složce obsah/lib/manifold)."""
import base64, os
tu = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(tu, 'manifold.js'), encoding='utf-8').read()
assert src.count('export default Module;') == 1, 'nečekaný tvar manifold.js'
out = src.replace('export default Module;', 'globalThis.ManifoldModule=Module;')
out = out.replace('import.meta.url', '(globalThis.MANIFOLD_URL||"")')
assert 'import.meta' not in out and 'export ' not in out.replace('exports', '')
hlavicka = ('/* manifold-3d (Apache-2.0, viz LICENSE.txt) převedený na klasický skript '
            'skriptem prevod_klasicky.py: změněno jen `export default` a `import.meta.url`. */\n')
open(os.path.join(tu, 'manifold.klasicky.js'), 'w', encoding='utf-8').write(hlavicka + out)
b64 = base64.b64encode(open(os.path.join(tu, 'manifold.wasm'), 'rb').read()).decode()
open(os.path.join(tu, 'manifold.wasm.js'), 'w').write(
    '/* manifold.wasm (manifold-3d, Apache-2.0) jako base64 pro otevření stránky z file:// */\n'
    'globalThis.MANIFOLD_WASM_B64="' + b64 + '";\n')
print('hotovo:', len(out), 'B JS,', len(b64), 'B base64')
