#!/usr/bin/env python3
"""Moje knihy na webu pro Čtečku knih (obsah/ctecka_knih.html → ➕ Přidat → 🌐 Moje knihy z webu).

  python3 tools/vlastni_knihy.py                 jen znovu vygeneruje obsah/knihy/vlastni/seznam.json
  python3 tools/vlastni_knihy.py ZDROJ [ZDROJ…]   zkopíruje rukopisy do obsah/knihy/vlastni/ a vygeneruje seznam
  python3 tools/vlastni_knihy.py --smazat ID      odebere knihu z webu

Kniha je buď jeden soubor .md, nebo složka s kapitolami *.md (pořadí podle jména: 01_…, 02_…)
a obrázky (obrazky/…). Obálka = obalka.* nebo cover.* ve složce knihy.
Údaje o knize z YAML hlavičky prvního souboru (nepovinné):
  ---
  title: Název knihy
  author: Jméno Autora
  description: Krátký popis
  series: Název série
  series_index: 2
  ---
Bez hlavičky: název = jediný nadpis „# …“ souboru, jinak jméno souboru/složky.
Otisk obsahu (otisk) mění čtečka na „nová verze“ – napojené knihy se u čtenáře samy aktualizují.
Po změně zvednout verzi v sw.js (knihy/*.md a *.json jdou přes síť napřed, ale obrázky ne).
"""
import hashlib, json, os, re, shutil, sys, datetime

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CIL = os.environ.get('VLASTNI_KNIHY_CIL') or os.path.join(KOREN, 'obsah', 'knihy', 'vlastni')   # proměnná jen pro testy
OBRAZKY = ('.webp', '.jpg', '.jpeg', '.png', '.gif', '.svg')
VYNECHAT = {'seznam.json', 'README.md'}


def yaml_hlavicka(text):
    m = re.match(r'^﻿?---\n(.*?)\n---\n', text.replace('\r\n', '\n'), re.S)
    if not m:
        return {}
    data = {}
    for radek in m.group(1).split('\n'):
        k = re.match(r'^(\w+):\s*["\']?(.*?)["\']?\s*$', radek)
        if k:
            data[k.group(1).lower()] = k.group(2)
    return data


def slov(text):
    text = re.sub(r'^---\n.*?\n---\n', '', text, flags=re.S)
    text = re.sub(r'!\[[^\]]*\]\([^)]*\)|<!--.*?-->|[#*_>`]', ' ', text, flags=re.S)
    return len(text.split())


def hezke_jmeno(jmeno):
    return re.sub(r'[_-]+', ' ', re.sub(r'\.md$', '', jmeno, flags=re.I)).strip()


def popis_knihy(cesta):
    """Položka seznam.json pro soubor nebo složku v obsah/knihy/vlastni/."""
    jm = os.path.basename(cesta)
    if os.path.isdir(cesta):
        soubory = sorted(f for f in os.listdir(cesta) if f.lower().endswith('.md') and f not in VYNECHAT)
        obrazky, obalka = [], None
        for dp, _, fn in os.walk(cesta):
            for f in sorted(fn):
                if f.lower().endswith(OBRAZKY):
                    rel = os.path.relpath(os.path.join(dp, f), CIL).replace(os.sep, '/')
                    if re.match(r'^(obalka|cover)\.', f, re.I) and dp == cesta:
                        obalka = rel
                    else:
                        obrazky.append(rel)
        soubory = [f'{jm}/{f}' for f in soubory]
    else:
        soubory, obrazky, obalka = [jm], [], None
    if not soubory:
        return None
    texty = [open(os.path.join(CIL, f), encoding='utf-8', errors='replace').read() for f in soubory]
    y = yaml_hlavicka(texty[0])
    nazev = y.get('title')
    if not nazev and len(soubory) == 1:
        h1 = re.findall(r'^#\s+(.+?)\s*#*\s*$', texty[0], re.M)
        if len(h1) == 1:
            nazev = h1[0].replace('*', '')
    otisk = hashlib.sha1()
    for f in soubory + obrazky + ([obalka] if obalka else []):
        otisk.update(f.encode())
        otisk.update(open(os.path.join(CIL, f), 'rb').read())
    zmeneno = max(os.path.getmtime(os.path.join(CIL, f)) for f in soubory)
    pol = {
        'id': re.sub(r'\.md$', '', jm, flags=re.I),
        'nazev': nazev or hezke_jmeno(jm),
        'autor': y.get('author', ''),
        'popis': y.get('description', ''),
        'serie': y.get('series', ''),
        'dil': float(y['series_index']) if re.match(r'^\d+(\.\d+)?$', y.get('series_index', '')) else None,
        'soubory': soubory, 'obrazky': obrazky, 'obalka': obalka,
        'slov': sum(slov(t) for t in texty),
        'otisk': otisk.hexdigest()[:12],
        'zmeneno': datetime.datetime.fromtimestamp(zmeneno).strftime('%Y-%m-%d'),
    }
    return {k: v for k, v in pol.items() if v not in (None, '', [])} | {'soubory': soubory}


def zkopiruj(zdroj):
    zdroj = os.path.abspath(zdroj)
    cil = os.path.join(CIL, os.path.basename(zdroj.rstrip('/')))
    if os.path.isdir(zdroj):
        if os.path.exists(cil):
            shutil.rmtree(cil)
        shutil.copytree(zdroj, cil, ignore=shutil.ignore_patterns('.*', '*~', '*.bak', 'zaloha*', 'navrhy'))
    elif zdroj.lower().endswith('.md'):
        shutil.copy2(zdroj, cil)
    else:
        sys.exit(f'{zdroj}: čekám soubor .md nebo složku s kapitolami .md')
    print('zkopírováno:', os.path.relpath(cil, KOREN))


def main():
    os.makedirs(CIL, exist_ok=True)
    arg = sys.argv[1:]
    if arg[:1] == ['--smazat']:
        for i in arg[1:]:
            for c in (os.path.join(CIL, i), os.path.join(CIL, i + '.md')):
                if os.path.isdir(c): shutil.rmtree(c); print('smazáno:', c)
                elif os.path.isfile(c): os.remove(c); print('smazáno:', c)
    else:
        for z in arg:
            zkopiruj(z)
    knihy = []
    for jm in sorted(os.listdir(CIL)):
        c = os.path.join(CIL, jm)
        if jm in VYNECHAT or jm.startswith('.') or not (os.path.isdir(c) or jm.lower().endswith('.md')):
            continue
        pol = popis_knihy(c)
        if pol:
            knihy.append(pol)
    with open(os.path.join(CIL, 'seznam.json'), 'w', encoding='utf-8') as f:
        json.dump({'knihy': knihy}, f, ensure_ascii=False, indent=1)
    for k in knihy:
        print(f"  {k['id']}: {k['nazev']} – {len(k['soubory'])} soubor(ů), {k['slov']} slov, otisk {k['otisk']}")
    print(f'seznam.json: {len(knihy)} knih')


if __name__ == '__main__':
    main()
