#!/usr/bin/env python3
"""Ověří, která videa z videotéky (obsah/nahnoji_videa.js + nahnoji_serialy.js)
jdou na nahnoji.cz skutečně přehrát, a zapíše obsah/nahnoji_stav.js.

Prohlížeč to sám zjistit nemůže – nahnoji.cz neposílá CORS hlavičky.
Postup u každého videa: GET /embed?id=N → podepsaná cesta /data.mp4?… →
Range 0-0 → z Content-Range celková velikost. 0 B = video čeká na konverzi
(přehrávač pak hlásí DEMUXER_ERROR_COULD_NOT_OPEN).

Spouštět občas znovu:  python3 tools/nahnoji_stav.py   (asi 10 minut)
"""
import os, re, sys, json, time, threading, urllib.request, urllib.error, datetime
from concurrent.futures import ThreadPoolExecutor

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OBSAH = os.path.join(KOREN, 'obsah')
ZDROJE = ['nahnoji_videa.js', 'nahnoji_serialy.js']
VYSTUP = os.path.join(OBSAH, 'nahnoji_stav.js')
UA = {'User-Agent': 'Mozilla/5.0 (videoteka-kontrola)'}

class BezPresmerovani(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None
otevri = urllib.request.build_opener(BezPresmerovani).open

zamek = threading.Lock(); posledni = [0.0]
def pockej():
    # ohleduplně: nejvýš ~4 požadavky za sekundu, server je křehký
    with zamek:
        t = max(posledni[0] + 0.25, time.time()); posledni[0] = t
    time.sleep(max(0, t - time.time()))

def stav_videa(vid):
    for pokus in range(3):
        try:
            pockej()
            s = otevri(urllib.request.Request(f'http://nahnoji.cz/embed?id={vid}', headers=UA), timeout=40).read().decode('utf-8', 'replace')
            m = re.search(r'videoPath="([^"]+)"', s)
            if not m: return 'chybi'
            pockej()
            r = otevri(urllib.request.Request('http://nahnoji.cz' + m[1], headers=dict(UA, Range='bytes=0-0')), timeout=40)
            cr = r.headers.get('Content-Range', '')
            r.close()
            celkem = cr.rsplit('/', 1)[-1] if '/' in cr else r.headers.get('Content-Length', '0')
            return 'ok' if celkem.isdigit() and int(celkem) > 0 else 'prazdne'
        except urllib.error.HTTPError as e:
            if e.code in (301, 302, 303, 404): return 'chybi'
            err = e
        except Exception as e:
            err = e
        time.sleep(5 * (pokus + 1))
    print(f'  {vid}: nepodařilo se ověřit ({err})', file=sys.stderr)
    return None   # neznámo – nezapisovat

def main():
    ids = []
    for f in ZDROJE:
        p = os.path.join(OBSAH, f)
        if os.path.exists(p):
            ids += [int(i) for i in re.findall(r'\bid:\s*(\d+)', open(p, encoding='utf-8').read())]
    ids = sorted(set(ids))
    print(f'ověřuji {len(ids)} videí…', flush=True)
    vysledky = {}
    with ThreadPoolExecutor(3) as ex:
        for n, (vid, st) in enumerate(zip(ids, ex.map(stav_videa, ids)), 1):
            vysledky[vid] = st
            if n % 100 == 0: print(f'  {n}/{len(ids)}', flush=True)
    spatne = {v: s for v, s in vysledky.items() if s in ('prazdne', 'chybi')}
    souhrn = {k: sum(1 for s in vysledky.values() if s == k) for k in ('ok', 'prazdne', 'chybi', None)}
    with open(VYSTUP, 'w', encoding='utf-8') as f:
        f.write('/* Generuje tools/nahnoji_stav.py – neupravovat ručně.\n'
                '   Videa, která při kontrole nešla přehrát: prazdne = soubor 0 B (čeká na konverzi),\n'
                '   chybi = video neexistuje / data smazána. */\n')
        f.write(f"window.NAHNOJI_OVERENO = '{datetime.date.today().isoformat()}';\n")
        f.write('window.NAHNOJI_NEDOSTUPNE = ' + json.dumps({str(k): v for k, v in sorted(spatne.items())}) + ';\n')
    print('hotovo:', {('neověřeno' if k is None else k): v for k, v in souhrn.items()}, '→', VYSTUP)

if __name__ == '__main__':
    main()
