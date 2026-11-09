#!/usr/bin/env python3
"""Moje knihy na webu pro Čtečku knih (obsah/ctecka_knih.html → ➕ Přidat → 🌐 Moje knihy z webu).

Knihy leží ve složce moje_knihy/ v kořeni webu – stačí do ní soubor nakopírovat a nahrát web:
upload.sh (i test_local.sh) tento skript spustí sám a ten vygeneruje moje_knihy/seznam.json.

  python3 tools/vlastni_knihy.py                 jen znovu vygeneruje moje_knihy/seznam.json
  python3 tools/vlastni_knihy.py ZDROJ [ZDROJ…]   zkopíruje knihy do moje_knihy/ a vygeneruje seznam
  python3 tools/vlastni_knihy.py --smazat ID      odebere knihu z webu

Kniha je:
  • jeden soubor .md, .txt, .epub, .mobi (.prc, .azw, .azw3),
  • nebo složka s kapitolami *.md (pořadí podle jména: 01_…, 02_…), obrázky (obrazky/…)
    a obálkou obalka.* / cover.*.
Údaje o knize u Markdownu z YAML hlavičky prvního souboru (nepovinné):
  ---
  title: Název knihy
  author: Jméno Autora
  description: Krátký popis
  series: Název série
  series_index: 2
  ---
Bez hlavičky: název = jediný nadpis „# …“ souboru, jinak jméno souboru/složky. U EPUB z metadat knihy.
Vynechá se README.md, seznam.json a soubory začínající tečkou nebo podtržítkem.
Otisk obsahu (otisk) mění čtečka na „nová verze“ – napojené knihy se u čtenáře samy aktualizují.
"""
import datetime, hashlib, json, os, re, shutil, sys, zipfile
import xml.etree.ElementTree as ET

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CIL = os.environ.get('VLASTNI_KNIHY_CIL') or os.path.join(KOREN, 'moje_knihy')   # proměnná jen pro testy
OBRAZKY = ('.webp', '.jpg', '.jpeg', '.png', '.gif', '.svg')
KNIHY = ('.md', '.markdown', '.txt', '.epub', '.mobi', '.prc', '.azw', '.azw3')
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


def bez_pripony(jmeno):
    return re.sub(r'\.(md|markdown|txt|epub|mobi|prc|azw3?)$', '', jmeno, flags=re.I)


def hezke_jmeno(jmeno):
    return re.sub(r'[_-]+', ' ', bez_pripony(jmeno)).strip()


def cti_text(cesta):
    data = open(cesta, 'rb').read()
    if data[:2] in (b'\xff\xfe', b'\xfe\xff'):
        return data.decode('utf-16')   # Poznámkový blok „Unicode“
    try:
        return data.decode('utf-8-sig')
    except UnicodeDecodeError:
        return data.decode('cp1250', errors='replace')   # starší české TXT


def meta_epubu(cesta):
    """(název, autor) z OPF; když EPUB nejde přečíst, prázdné."""
    try:
        with zipfile.ZipFile(cesta) as z:
            kont = ET.fromstring(z.read('META-INF/container.xml'))
            opf_cesta = next(e.get('full-path') for e in kont.iter() if e.tag.endswith('rootfile'))
            opf = ET.fromstring(z.read(opf_cesta))
            hledej = lambda jm: next((e.text.strip() for e in opf.iter() if e.tag.endswith('}' + jm) and e.text and e.text.strip()), '')
            return hledej('title'), hledej('creator')
    except Exception:
        return '', ''


def popis_knihy(cesta):
    """Položka seznam.json pro soubor nebo složku v moje_knihy/."""
    jm = os.path.basename(cesta)
    pripona = os.path.splitext(jm)[1].lower()
    format_ = 'md'
    if os.path.isdir(cesta):
        soubory = sorted(f for f in os.listdir(cesta) if f.lower().endswith(('.md', '.markdown')) and f not in VYNECHAT)
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
        format_ = {'.markdown': 'md', '.azw3': 'mobi', '.azw': 'mobi', '.prc': 'mobi'}.get(pripona, pripona[1:])
    if not soubory:
        return None
    nazev = autor = popis = serie = ''
    dil, pocet_slov = None, 0
    if format_ in ('md', 'txt'):
        texty = [cti_text(os.path.join(CIL, f)) for f in soubory]
        pocet_slov = sum(slov(t) for t in texty)
        if format_ == 'md':
            y = yaml_hlavicka(texty[0])
            nazev, autor, popis, serie = y.get('title', ''), y.get('author', ''), y.get('description', ''), y.get('series', '')
            dil = float(y['series_index']) if re.match(r'^\d+(\.\d+)?$', y.get('series_index', '')) else None
            if not nazev and len(soubory) == 1:
                h1 = re.findall(r'^#\s+(.+?)\s*#*\s*$', texty[0], re.M)
                if len(h1) == 1:
                    nazev = h1[0].replace('*', '')
    elif format_ == 'epub':
        nazev, autor = meta_epubu(cesta)
    otisk = hashlib.sha1()
    for f in soubory + obrazky + ([obalka] if obalka else []):
        otisk.update(f.encode())
        otisk.update(open(os.path.join(CIL, f), 'rb').read())
    zmeneno = max(os.path.getmtime(os.path.join(CIL, f)) for f in soubory)
    pol = {
        'id': bez_pripony(jm),
        'nazev': nazev or hezke_jmeno(jm),
        'autor': autor, 'popis': popis, 'serie': serie, 'dil': dil,
        'format': format_ if format_ != 'md' else None,
        'soubory': soubory, 'obrazky': obrazky, 'obalka': obalka,
        'slov': pocet_slov or None,
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
    elif zdroj.lower().endswith(KNIHY):
        shutil.copy2(zdroj, cil)
    else:
        sys.exit(f'{zdroj}: čekám knihu ({", ".join(KNIHY)}) nebo složku s kapitolami .md')
    print('zkopírováno:', os.path.relpath(cil, KOREN))


def main():
    os.makedirs(CIL, exist_ok=True)
    arg = sys.argv[1:]
    if arg[:1] == ['--smazat']:
        for i in arg[1:]:
            for c in [os.path.join(CIL, i)] + [os.path.join(CIL, i + p) for p in KNIHY]:
                if os.path.isdir(c): shutil.rmtree(c); print('smazáno:', c)
                elif os.path.isfile(c): os.remove(c); print('smazáno:', c)
    else:
        for z in arg:
            zkopiruj(z)
    knihy, ids = [], set()
    for jm in sorted(os.listdir(CIL)):
        c = os.path.join(CIL, jm)
        if jm in VYNECHAT or jm[0] in '._' or not (os.path.isdir(c) or jm.lower().endswith(KNIHY)):
            continue
        pol = popis_knihy(c)
        if not pol:
            continue
        if pol['id'] in ids:   # „kniha.md“ i „kniha.epub“ vedle sebe
            pol['id'] += '-' + pol.get('format', 'md')
        ids.add(pol['id'])
        knihy.append(pol)
    obsah = json.dumps({'knihy': knihy}, ensure_ascii=False, indent=1)
    seznam = os.path.join(CIL, 'seznam.json')
    stary = open(seznam, encoding='utf-8').read() if os.path.exists(seznam) else ''
    if obsah != stary:   # beze změny nepřepisovat (git by hlásil změnu při každém nahrání)
        with open(seznam, 'w', encoding='utf-8') as f:
            f.write(obsah)
    for k in knihy:
        print(f"  {k['id']}: {k['nazev']} – {k.get('format', 'md')}, {len(k['soubory'])} soubor(ů), {k.get('slov', '?')} slov, otisk {k['otisk']}")
    print(f'moje_knihy/seznam.json: {len(knihy)} knih' + ('' if obsah != stary else ' (beze změny)'))


if __name__ == '__main__':
    main()
