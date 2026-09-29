#!/usr/bin/env python3
"""Zabalí každý font z katalogu do skriptu fonty/js/<soubor>.js.

Proč: stránka otevřená přímo z disku (file://) nesmí fontový soubor
načíst přes fetch(), ale <script> ano. fonty.js proto při nezdaru
fetch() sáhne po tomhle skriptu. Pouštět po přidání nebo změně fontu:
    python3 obsah/fonty/sestav_js.py
"""
import base64, json, os, re

TADY = os.path.dirname(os.path.abspath(__file__))
katalog = open(os.path.join(TADY, 'fonty.js'), encoding='utf-8').read()
soubory = re.findall(r"soubor:\s*'([^']+)'", katalog)
os.makedirs(os.path.join(TADY, 'js'), exist_ok=True)
platne = set()
for s in soubory:
    data = open(os.path.join(TADY, s), 'rb').read()
    b64 = base64.b64encode(data).decode('ascii')
    jm = s + '.js'
    platne.add(jm)
    with open(os.path.join(TADY, 'js', jm), 'w', encoding='ascii') as f:
        f.write(f'(window.FONTY_JS=window.FONTY_JS||{{}})[{json.dumps(s)}]="{b64}";\n')
# skripty fontů, které už v katalogu nejsou
for jm in os.listdir(os.path.join(TADY, 'js')):
    if jm not in platne:
        os.remove(os.path.join(TADY, 'js', jm))
print(len(platne), 'skriptů v', os.path.join(TADY, 'js'))
