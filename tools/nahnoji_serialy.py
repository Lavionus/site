#!/usr/bin/env python3
"""Posbírá z fanouškovských webů (všechny běží na stejném systému: řady
?stranka=serie&cislo=N → díly ?video=N → iframe nahnoji.cz/embed?id=…)
seznam dílů seriálů a zapíše obsah/nahnoji_serialy.js pro videotéku.

Spuštění:  python3 tools/nahnoji_serialy.py   (stažené stránky se drží
v mezipaměti /tmp/nahnoji_serialy_cache, opakovaný běh je rychlý).
Potom ověřit dostupnost:  python3 tools/nahnoji_stav.py"""
import urllib.request, re, os, json, hashlib, time, html, sys, threading, zlib
from concurrent.futures import ThreadPoolExecutor
KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VYSTUP = os.path.join(KOREN, 'obsah', 'nahnoji_serialy.js')
CACHE = os.environ.get('NAHNOJI_CACHE', '/tmp/nahnoji_serialy_cache')
os.makedirs(CACHE, exist_ok=True)
WEBY = [
  ('M*A*S*H', 'http://mash.alyss.cz/'),
  ('Futurama', 'http://futurama.nikee.net/'),
  ('Krajní meze', 'http://krajnimeze.sifee.biz/'),
  ('Rozčarování', 'http://rozcarovani.sifee.biz/'),
]
# Seriály, které mají na nahnoji.cz jen pár dílů (zbytek je na hqq.tv) – na
# stránce jen odkaz na jejich web, díly se nepřebírají.
ODKAZY = [
  ('Jak jsem poznal vaši matku', 'http://himym.alyss.cz/'),
  ('Hvězdná brána: Atlantida', 'http://sga.alyss.cz/'),
  ('Hra o trůny', 'http://hraotruny.sifee.biz/'),
  ('Star Trek: Nová generace', 'http://startrek.enkii.cz/'),
]
zamek = threading.Lock(); posledni = {}
def stahni(url):
    f = os.path.join(CACHE, hashlib.md5(url.encode()).hexdigest())
    if os.path.exists(f): return open(f, 'rb').read()
    host = url.split('/')[2]
    for pokus in range(4):
        with zamek:
            cekej = posledni.get(host, 0) + 0.35 - time.time()
            posledni[host] = time.time() + max(cekej, 0)
        if cekej > 0: time.sleep(cekej)
        try:
            b = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (videoteka)'}), timeout=40).read()
            open(f, 'wb').write(b); return b
        except Exception as e:
            print('  chyba', url, e, file=sys.stderr); time.sleep(3 * (pokus + 1))
    return b''
def text(b):
    try: s = b.decode('utf-8')
    except UnicodeDecodeError: s = b.decode('cp1250', 'replace')
    return s
def oprav(s):
    s = html.unescape(re.sub(r'<[^>]+>', '', s)).strip()
    if re.search('[ĂĹÄ]', s):
        try: s = s.encode('cp1250').decode('utf-8')
        except Exception: pass
    return re.sub(r'\s+', ' ', s)

def serial(nazev, web):
    uvod = text(stahni(web + 'index.php'))
    rady = sorted({int(c) for c in re.findall(r'stranka=serie&(?:amp;)?cislo=(\d+)', uvod, re.I)})
    vysl = []
    for r in rady:
        s = text(stahni(f'{web}index.php?stranka=serie&cislo={r}'))
        # jen hlavní obsah – postranní panel má „náhodné" odkazy na díly
        dily, videne = [], set()
        for m in re.finditer(r'href=["\']?index\.php\?video=(\d+)["\']?\s*>(.*?)</a>', s, re.I | re.S):
            vid, t = int(m[1]), oprav(m[2])
            if not t or vid in videne: continue
            videne.add(vid); dily.append((vid, t))
        vysl.append({'rada': r, 'dily': dily})
    return vysl

def nahnoji(web, vid):
    s = text(stahni(f'{web}index.php?video={vid}'))
    ids = re.findall(r'nahnoji\.cz/(?:embed|video)\?id=(\d+)', s, re.I)
    return [int(i) for i in dict.fromkeys(ids)]

INFO = {
  'M*A*S*H': ('🚁', 'Komediální seriál z polní nemocnice za korejské války (1972–1983).'),
  'Futurama': ('🚀', 'Poslíček Fry se po zmrazení probudí v roce 3000 (1999–2013).'),
  'Krajní meze': ('👽', 'Sci-fi antologie The Outer Limits, každý díl samostatný příběh (1995–2002).'),
  'Rozčarování': ('👑', 'Animovaná fantasy o princezně Bean od Matta Groeninga (Disenchantment).'),
}

def zapis_js(data):
    jsr = lambda s: json.dumps(s, ensure_ascii=False)
    radky, chybi, vic = [], [], []
    for nazev, s in data.items():
        for r in s['rady']:
            for d in r['dily']:
                t = re.sub(r'^\d+\s*x\s*\d+\s*-\s*', '', d['nazev']).strip() or f"Díl {d['dil']}"
                if not d['nahnoji']:
                    chybi.append(f"{nazev} {r['rada']}×{d['dil']:02d}"); continue   # díl jen mimo nahnoji.cz
                if len(d['nahnoji']) > 1: vic.append(f"{nazev} {r['rada']}×{d['dil']:02d} {d['nahnoji']}")
                radky.append(f"  {{ id: {d['nahnoji'][0]}, nazev: {jsr(t)}, serial: {jsr(nazev)}, rada: {r['rada']}, dil: {d['dil']} }},")
    info = ',\n'.join(f"  {jsr(n)}: {{ ikona: {jsr(INFO.get(n, ('📺', ''))[0])}, popis: {jsr(INFO.get(n, ('', ''))[1])}, zdroj: {jsr(data[n]['web'])} }}" for n in data)
    with open(VYSTUP, 'w', encoding='utf-8') as f:
        f.write('/* Generuje tools/nahnoji_serialy.py z fanouškovských webů se seriály – neupravovat ručně.\n'
                '   Vlastní videa a ručně psané seriály patří do nahnoji_videa.js. */\n')
        f.write('window.NAHNOJI_SERIALY = Object.assign(window.NAHNOJI_SERIALY || {}, {\n' + info + '\n});\n\n')
        f.write('window.NAHNOJI_ODKAZY = [\n' + ',\n'.join(f'  {{ nazev: {jsr(n)}, url: {jsr(u)} }}' for n, u in ODKAZY) + '\n];\n\n')
        f.write('window.NAHNOJI_VIDEA_SERIALY = [\n' + '\n'.join(radky) + '\n];\n')
    print(f'{len(radky)} dílů → {VYSTUP}')
    if chybi: print('vynecháno (není na nahnoji.cz):', ', '.join(chybi))
    if vic: print('díly s více videi (použito první):', '; '.join(vic))

if __name__ == '__main__':
    vystup = {}
    for nazev, web in WEBY:
        rady = serial(nazev, web)
        print(nazev, [(r['rada'], len(r['dily'])) for r in rady], flush=True)
        ulohy = [(r, i, vid, t) for r in rady for i, (vid, t) in enumerate(r['dily'])]
        with ThreadPoolExecutor(3) as ex:
            ids = list(ex.map(lambda u: nahnoji(web, u[2]), ulohy))
        vystup[nazev] = {'web': web, 'rady': []}
        for r in rady:
            vystup[nazev]['rady'].append({'rada': r['rada'], 'dily': []})
        for (r, i, vid, t), n in zip(ulohy, ids):
            next(x for x in vystup[nazev]['rady'] if x['rada'] == r['rada'])['dily'].append(
                {'dil': i + 1, 'nazev': t, 'video': vid, 'nahnoji': n})
        pass
    zapis_js(vystup)
