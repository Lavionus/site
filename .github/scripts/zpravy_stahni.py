#!/usr/bin/env python3
"""Mozaika zpráv – stažení RSS/Atom kanálů z katalogu do jednoho JSON.

Běží v GitHub Actions (.github/workflows/zpravy.yml) každých ~20 minut a výsledek
ukládá do větve `zpravy-data`; stránka obsah/zpravy.html ho čte z raw.githubusercontent.com
(většina zpravodajských RSS nemá CORS, takže je prohlížeč přímo nepřečte).

Jen standardní knihovna. Lokálně:
    python3 .github/scripts/zpravy_stahni.py --vystup obsah/zpravy/data.json
    python3 .github/scripts/zpravy_stahni.py --test            # přehled kanálů bez zápisu

Položka ve výstupu (krátké klíče kvůli velikosti):
    i  id (hash odkazu)      z  id zdroje        r  rubrika     kr kraj (jen regionální zprávy)
    t  titulek               p  perex (≤ 300 zn.) u  odkaz
    o  obrázek (nebo chybí)  d  čas vydání (unix s)  n  čas, kdy jsme položku poprvé viděli
"""
import argparse, concurrent.futures as cf, email.utils, gzip, html, json, os, re, sys, time, zlib
import urllib.request, urllib.error, urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

KOREN = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KATALOG = os.path.join(KOREN, 'obsah', 'zpravy', 'zdroje.json')
UA = 'Mozilla/5.0 (compatible; MozaikaZprav/1.0; +https://lavionus.github.io/site/)'
ORIGIN = 'https://lavionus.github.io'   # kvůli zjištění CORS: kanály s ním stránka umí načíst živě (tlačítko ⟳)
DRZET_HODIN = 48          # jak staré položky ve výstupu držet
DRZET_MIN = 6             # …ale od každého zdroje aspoň tolik nejnovějších (pomalé weby), nejvýš
DRZET_MIN_DNU = 14        # …tak staré
MAX_NA_KANAL = 40         # nejvýš položek z jednoho kanálu za běh
MAX_PEREX = 300
MAX_OG = 150              # nejvýš dohledaných og:image za běh (zdvořilost)
NOVE_HODIN = 6            # <vystup>-nove.json = jen posledních 6 h (stránka ho stahuje při každé obnově, ~5× menší)
HISTORIE_BEHU = 72        # stav webů za posledních 72 běhů (~24 h): '1' vše ok, 'c' část kanálů selhala, '0' nic
NS = {
    'atom': 'http://www.w3.org/2005/Atom',
    'media': 'http://search.yahoo.com/mrss/',
    'content': 'http://purl.org/rss/1.0/modules/content/',
    'dc': 'http://purl.org/dc/elements/1.1/',
    'rss1': 'http://purl.org/rss/1.0/',
    'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
}


def stahni(url, timeout=20, limit=6_000_000, hlavicky=None, origin=True):
    """→ (data, charset); do `hlavicky` (dict) se zapíšou hlavičky odpovědi."""
    req = urllib.request.Request(url, headers={**({'Origin': ORIGIN} if origin else {}),
        'User-Agent': UA, 'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5',
        'Accept-Encoding': 'gzip, deflate', 'Accept-Language': 'cs,en;q=0.7'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read(limit + 1)
        if hlavicky is not None:
            hlavicky.update({k.lower(): v for k, v in r.headers.items()})
        enc = (r.headers.get('Content-Encoding') or '').lower()
        if enc == 'gzip':
            data = gzip.decompress(data)
        elif enc == 'deflate':
            data = zlib.decompress(data, -zlib.MAX_WBITS) if data[:1] != b'x' else zlib.decompress(data)
        return data, r.headers.get_content_charset()


# --- text ------------------------------------------------------------------
_TAG = re.compile(r'<[^>]+>')
_MEZERY = re.compile(r'\s+')


def cisty_text(s):
    if not s:
        return ''
    s = re.sub(r'(?is)<(script|style)\b.*?</\1>', ' ', s)
    s = _TAG.sub(' ', s)
    s = html.unescape(html.unescape(s))      # některé kanály escapují dvakrát
    s = s.replace('\xa0', ' ')
    return _MEZERY.sub(' ', s).strip()


def zkrat(s, n=MAX_PEREX):
    if len(s) <= n:
        return s
    s = s[:n]
    k = s.rfind(' ')
    return (s[:k] if k > n * 0.6 else s).rstrip(' ,;:–-') + '…'


def obrazek_z_html(s):
    if not s:
        return None
    m = re.search(r'<img[^>]+?(?:data-src|src)\s*=\s*["\']([^"\']+)["\']', s, re.I)
    if m:
        u = html.unescape(m.group(1))
        if u.startswith('//'):
            u = 'https:' + u
        if u.startswith('http') and not re.search(r'(pixel|spacer|1x1|feedburner|gravatar|emoji)', u, re.I):
            return u
    return None


def cas(s):
    if not s:
        return None
    s = s.strip()
    try:
        d = email.utils.parsedate_to_datetime(s)
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return int(d.timestamp())
    except Exception:
        pass
    try:
        s2 = s.replace('Z', '+00:00')
        s2 = re.sub(r'([+-]\d\d)(\d\d)$', r'\1:\2', s2)
        d = datetime.fromisoformat(s2)
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return int(d.timestamp())
    except Exception:
        return None


def lok(el):
    """Jméno prvku bez jmenného prostoru."""
    return el.tag.rsplit('}', 1)[-1] if isinstance(el.tag, str) else ''


def potomci(el, jmeno):
    return [c for c in el if lok(c) == jmeno]


def text_potomka(el, *jmena):
    for j in jmena:
        for c in el:
            if lok(c) == j and (c.text or len(c)):
                return (c.text or '') + ''.join(ET.tostring(x, encoding='unicode') for x in c)
    return ''


def obrazek_polozky(el, popis_html):
    # media:content / media:thumbnail / media:group
    nejlepsi, sirka = None, -1
    for c in el.iter():
        n = lok(c)
        if n in ('content', 'thumbnail') and c.tag.startswith('{' + NS['media']):
            u = c.get('url')
            typ = c.get('type') or c.get('medium') or ''
            if not u or ('video' in typ or 'audio' in typ):
                continue
            w = int(c.get('width') or 0)
            if w > sirka:
                nejlepsi, sirka = u, w
    if nejlepsi:
        return nejlepsi
    for c in potomci(el, 'enclosure'):
        if (c.get('type') or 'image').startswith('image') and c.get('url'):
            return c.get('url')
    for c in potomci(el, 'image'):
        u = c.get('url') or c.get('href') or (c.text or '').strip()
        if u.startswith('http'):
            return u
        uu = text_potomka(c, 'url')
        if uu.strip().startswith('http'):
            return uu.strip()
    for c in potomci(el, 'link'):
        if c.get('rel') == 'enclosure' and (c.get('type') or '').startswith('image'):
            return c.get('href')
    return obrazek_z_html(text_potomka(el, 'encoded')) or obrazek_z_html(popis_html)


def _dekoduj(data, charset):
    m = re.match(rb'<\?xml[^>]*encoding=["\']([\w.-]+)', data)
    for kod in (m and m.group(1).decode(), charset, 'utf-8'):
        if not kod:
            continue
        try:
            return data.decode(kod)
        except (LookupError, UnicodeDecodeError):
            pass
    return data.decode('utf-8', 'replace')


def _oprav_xml(t):
    """Nejčastější vady kanálů: HTML entity (&nbsp;), holé &, řídicí znaky."""
    from html.entities import name2codepoint
    def ent(m):
        n = m.group(1)
        if n in ('amp', 'lt', 'gt', 'quot', 'apos'):
            return m.group(0)
        return '&#%d;' % name2codepoint[n] if n in name2codepoint else '&amp;' + n + ';'
    t = re.sub(r'&([A-Za-z][A-Za-z0-9]*);', ent, t)
    t = re.sub(r'&(?!#?\w+;)', '&amp;', t)
    t = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', t)
    return re.sub(r'^\s*<\?xml[^>]*\?>', '', t, count=1)


def rozeber(data, charset=None):
    """XML kanálu → [ {t,u,p,o,d,k} ]. Toleruje RSS 2.0, RSS 1.0 (RDF) i Atom."""
    data = data.lstrip(b'\xef\xbb\xbf \t\r\n')
    if re.match(rb'(?i)<!doctype html|<html', data):
        raise ValueError('není to kanál, ale HTML stránka')
    try:
        koren = ET.fromstring(data)
    except ET.ParseError:
        koren = ET.fromstring(_oprav_xml(_dekoduj(data, charset)))
    polozky = [e for e in koren.iter() if lok(e) in ('item', 'entry')]
    vysl = []
    for el in polozky:
        titulek = cisty_text(text_potomka(el, 'title'))
        odkaz = ''
        for c in potomci(el, 'link'):
            h = c.get('href')
            if h and c.get('rel') in (None, 'alternate'):
                odkaz = h
                break
            if not h and c.text and c.text.strip():
                odkaz = c.text.strip()
                break
        if not odkaz:
            g = text_potomka(el, 'guid').strip()
            if g.startswith('http'):
                odkaz = g
        if not odkaz and el.get('{%s}about' % NS['rdf']):
            odkaz = el.get('{%s}about' % NS['rdf'])
        if not titulek or not odkaz.startswith('http'):
            continue
        popis_html = text_potomka(el, 'description', 'summary', 'content', 'encoded')
        perex = zkrat(cisty_text(popis_html))
        if perex.rstrip('…').strip() == titulek.strip():
            perex = ''
        d = cas(text_potomka(el, 'pubDate', 'published', 'updated', 'date', 'issued', 'modified'))
        kat = [cisty_text(c.text or c.get('term') or '') for c in potomci(el, 'category')]
        odkaz = odkaz.strip()
        obr = obrazek_polozky(el, popis_html)
        if obr:
            obr = urllib.parse.urljoin(odkaz, obr.strip())
            if not obr.startswith(('http://', 'https://')):
                obr = None
        vysl.append({'t': titulek, 'u': odkaz, 'p': perex, 'o': obr, 'd': d, 'k': [k for k in kat if k][:5]})
    return vysl


def og_image(url):
    try:
        data, cs = stahni(url, timeout=12, limit=400_000, origin=False)
    except Exception:
        return None
    t = data[:400_000].decode(cs or 'utf-8', 'replace')
    for vzor in (r'<meta[^>]+property=["\']og:image(?::url)?["\'][^>]+content=["\']([^"\']+)',
                 r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image(?::url)?["\']',
                 r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)'):
        m = re.search(vzor, t, re.I)
        if m:
            u = urllib.parse.urljoin(url, html.unescape(m.group(1)).strip())
            return u if u.startswith(('http://', 'https://')) else None
    return None


def klic_odkazu(url):
    """Odkaz bez protokolu, www, sledovacích parametrů a koncového lomítka (stejně klicOdkazu() v jadro.js)."""
    u = re.sub(r'[?#].*$', '', url) if not re.search(r'[?&](id|c|p|article)=', url) else url
    return re.sub(r'^https?://(www\.)?', '', u).rstrip('/')


def _fnv(s, h=2166136261):
    """FNV-1a 32 bitů nad UTF-16 jednotkami – shodně s hash() v jadro.js (charCodeAt)."""
    b = s.encode('utf-16-le')
    for i in range(0, len(b), 2):
        h ^= b[i] | (b[i + 1] << 8)
        h = (h * 16777619) & 0xffffffff
    return h


def id_polozky(url):
    """Id článku – stránka spočítá totéž (idOdkazu) u živě načtených, takže se přečtené/uložené nepletou."""
    k = klic_odkazu(url)
    return '%08x%08x' % (_fnv(k), _fnv(k, 0x9747b28c))


def urci_rubriku(p, zdroj, kanal, kat):
    """Rubrika položky v tomto pořadí: pravidla zdroje nad cestou odkazu → globální pravidla nad celou adresou
    (sport.*, /hokej/…) → kategorie kanálu (je-li „kategorie": true) → klíčová slova v titulku → rubrika kanálu."""
    cesta = re.sub(r'^https?://[^/]+', '', p['u'])
    for vzor, r in zdroj.get('pravidla', []):
        if re.search(vzor, cesta):
            return r
    for vzor, r in kat['_vsude']:
        if vzor.search(p['u']):
            return r
    if kanal.get('kategorie'):
        for k in p['k']:
            kk = k.lower()
            for vzor, r in kat['_mapa']:
                if vzor in kk:
                    return r
    vychozi = kanal.get('rubrika') or zdroj.get('rubrika') or 'cesko'
    titulek = bez_diakritiky(p['t'].lower())
    for r, vzor in kat['_slova']:
        if r != vychozi and vzor.search(titulek):
            return r
    return vychozi


def bez_diakritiky(s):
    import unicodedata
    return ''.join(c for c in unicodedata.normalize('NFD', s) if not unicodedata.combining(c))


def priprav_katalog(kat):
    """Předkompiluje pravidla z katalogu (klíče s _ se do výstupu nedostanou)."""
    kat['_mapa'] = [(k.lower(), v) for k, v in kat.get('mapa_kategorii', [])]
    kat['_vsude'] = [(re.compile(v, re.I), r) for v, r in kat.get('pravidla_vsude', [])]
    def vyraz(slova):   # stejné jako vyrazSlov() v obsah/zpravy/jadro.js: začátek slova; krátká a s tečkou na konci celá
        casti = [re.escape(w.rstrip('.')) + ('(?![a-z0-9])' if w.endswith('.') or len(w) <= 3 else '')
                 for w in (bez_diakritiky(x.lower()).strip() for x in slova) if w.rstrip('.')]
        return re.compile(r'(?<![a-z0-9])(' + '|'.join(casti) + ')')
    kat['_slova'] = [(r, vyraz(slova)) for r, slova in kat.get('klicova_slova', [])]
    return kat


def nacti_katalog():
    with open(KATALOG, encoding='utf-8') as f:
        return priprav_katalog(json.load(f))


def zpracuj_kanal(zdroj, kanal):
    t0 = time.time()
    h = {}
    try:
        data, cs = stahni(kanal['url'], hlavicky=h)
    except urllib.error.HTTPError as e:
        if e.code not in (401, 403):
            raise
        h = {}                                   # některé weby (Independent) hlavičku Origin odmítnou
        data, cs = stahni(kanal['url'], hlavicky=h, origin=False)
    pol = rozeber(data, cs)
    cors = h.get('access-control-allow-origin', '').strip() in ('*', ORIGIN)
    return pol, round(time.time() - t0, 2), cors


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--vystup', default=os.path.join(KOREN, 'obsah', 'zpravy', 'data.json'))
    ap.add_argument('--predchozi', help='předchozí JSON ke sloučení (výchozí = --vystup, pokud existuje)')
    ap.add_argument('--test', action='store_true', help='jen vypsat stav kanálů')
    ap.add_argument('--zdroj', action='append', help='jen tyto zdroje (id)')
    ap.add_argument('--bez-og', action='store_true', help='nedohledávat og:image')
    a = ap.parse_args()

    kat = nacti_katalog()
    ukoly = [(z, k) for z in kat['zdroje'] for k in z['kanaly'] if not a.zdroj or z['id'] in a.zdroj]

    predchozi = {}
    historie = {}
    cesta_pred = a.predchozi or a.vystup
    if not a.test and os.path.exists(cesta_pred):
        try:
            with open(cesta_pred, encoding='utf-8') as f:
                pred_json = json.load(f)
            historie = pred_json.get('historie', {}) if isinstance(pred_json.get('historie'), dict) else {}
            for p in pred_json.get('polozky', []):
                p['i'] = id_polozky(p['u'])      # starší data mohla mít jiné schéma id
                predchozi[p['i']] = p
        except Exception as e:
            print('předchozí data nečitelná:', e, file=sys.stderr)

    ted = int(time.time())
    stav = {}
    nove = {}
    cors = []
    kraje_clanku = {}       # id → kraje, v jejichž regionálních kanálech článek je
    with cf.ThreadPoolExecutor(12) as ex:
        bud = {ex.submit(zpracuj_kanal, z, k): (z, k) for z, k in ukoly}
        for f in cf.as_completed(bud):
            z, k = bud[f]
            s = stav.setdefault(z['id'], {'ok': 0, 'chyby': [], 'pocet': 0})
            try:
                pol, trvani, ma_cors = f.result()
            except Exception as e:
                s['chyby'].append(f"{k['url']}: {type(e).__name__}: {str(e)[:120]}")
                continue
            s['ok'] += 1
            s['pocet'] += len(pol)
            if ma_cors:
                cors.append(k['url'])
            if a.test:
                sobr = sum(1 for p in pol if p['o'])
                sdat = sum(1 for p in pol if p['d'])
                sper = sum(1 for p in pol if p['p'])
                kats = sorted({c for p in pol for c in p['k']})[:8]
                print(f"{z['id']:16} {k.get('rubrika','-'):10} {len(pol):3} pol. obr {sobr:3} dat {sdat:3} perex {sper:3} {trvani:5}s  kat:{kats}")
                continue
            pol.sort(key=lambda p: -(p['d'] or 0))
            kraj = k.get('kraj')
            for p in pol[:MAX_NA_KANAL]:
                i = id_polozky(p['u'])
                if i in nove:
                    stary = nove[i]
                    if kraj and stary.get('kr') and stary['kr'] != kraj:
                        kraje_clanku.setdefault(i, {stary['kr']}).add(kraj)   # tentýž článek ve víc krajích
                    if not (stary.get('kr') and not kraj):
                        continue          # celostátní kanál má přednost před regionálním, jinak první vyhrává
                r = urci_rubriku(p, z, k, kat)
                pred = predchozi.get(i)
                d = p['d'] or (pred and pred.get('d')) or ted
                if d > ted + 600:          # data z budoucnosti (chybné časové pásmo)
                    d = ted
                pol2 = {'i': i, 'z': z['id'], 'r': r, 't': p['t'], 'p': p['p'], 'u': p['u'], 'd': d,
                        'n': pred['n'] if pred else ted}
                o = p['o'] or (pred and pred.get('o'))
                if o:
                    pol2['o'] = o
                elif pred and pred.get('og') is not None:
                    pol2['og'] = 0          # už jsme hledali, nic
                if kraj:
                    pol2['kr'] = kraj
                nove[i] = pol2
    # článek z regionálních kanálů víc krajů (Deník je sdílí) je celostátní: bez kraje, rubrika jako jinde
    for i in kraje_clanku:
        p = nove.get(i)
        if p and p.get('kr'):
            del p['kr']
            if p['r'] == 'kraj':
                p['r'] = 'cesko'
    for z, s in stav.items():
        if s['chyby']:
            print('CHYBA', z, *s['chyby'], sep='\n  ', file=sys.stderr)
    if a.test:
        return

    # sloučit s předchozími (kanály drží jen posledních N článků), zahodit staré
    hranice = ted - DRZET_HODIN * 3600
    vsechny = dict(predchozi)
    vsechny.update(nove)
    znama = {z['id'] for z in kat['zdroje']}
    nejnovejsi = {}
    for p in sorted(vsechny.values(), key=lambda p: -p['d']):
        nejnovejsi.setdefault(p['z'], [])
        if len(nejnovejsi[p['z']]) < DRZET_MIN and p['d'] >= ted - DRZET_MIN_DNU * 86400:
            nejnovejsi[p['z']].append(p['i'])
    drzet = {i for l in nejnovejsi.values() for i in l}
    vsechny = {i: p for i, p in vsechny.items() if p['z'] in znama and (p['d'] >= hranice or i in drzet)}

    # dohledat og:image u zdrojů, které obrázky v kanálu nedávají
    if not a.bez_og:
        og_zdroje = {z['id'] for z in kat['zdroje'] if z.get('og')}
        kandidati = [p for p in vsechny.values() if p['z'] in og_zdroje and not p.get('o') and 'og' not in p]
        kandidati.sort(key=lambda p: -p['d'])
        kandidati = kandidati[:MAX_OG]
        with cf.ThreadPoolExecutor(8) as ex:
            for p, o in zip(kandidati, ex.map(lambda p: og_image(p['u']), kandidati)):
                if o:
                    p['o'] = o
                else:
                    p['og'] = 0

    # historie stavu webů (nejnovější znak vpravo) – stránka z ní ukáže dlouhodobě nefunkční weby
    for z in kat['zdroje']:
        s = stav.get(z['id'])
        znak = '0' if not s or not s['ok'] else ('c' if s['chyby'] else '1')
        historie[z['id']] = (historie.get(z['id'], '') + znak)[-HISTORIE_BEHU:]
    historie = {k: v for k, v in historie.items() if k in znama}

    polozky = sorted(vsechny.values(), key=lambda p: -p['d'])
    hlava = {
        'verze': 2,
        'vygenerovano': ted,
        'zdroje': {zid: {'ok': s['ok'] > 0, 'pocet': s['pocet'], **({'chyba': s['chyby'][0][:200]} if s['chyby'] else {})}
                   for zid, s in stav.items()},
        'cors': sorted(cors),         # kanály, které prohlížeč smí číst přímo (živé načtení na stránce)
        'historie': historie,
    }
    hranice_nove = ted - NOVE_HODIN * 3600
    zaklad = a.vystup[:-5] if a.vystup.endswith('.json') else a.vystup
    vystupy = [
        (a.vystup, dict(hlava, polozky=polozky)),                                              # vše (sloučení příště)
        (zaklad + '-nove.json', dict(hlava, cast='nove', od=hranice_nove, polozky=[p for p in polozky if p['d'] >= hranice_nove])),
        (zaklad + '-starsi.json', {'verze': 2, 'vygenerovano': ted, 'cast': 'starsi', 'do': hranice_nove,
                                   'polozky': [p for p in polozky if p['d'] < hranice_nove]}),
    ]
    os.makedirs(os.path.dirname(os.path.abspath(a.vystup)), exist_ok=True)
    for cesta, obsah in vystupy:
        tmp = cesta + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(obsah, f, ensure_ascii=False, separators=(',', ':'))
        os.replace(tmp, cesta)
    print(f'{len(polozky)} položek, {sum(1 for p in polozky if p.get("o"))} s obrázkem, '
          f'{sum(1 for s in stav.values() if s["ok"])}/{len(stav)} zdrojů ok → '
          + ', '.join(f'{os.path.basename(c)} {os.path.getsize(c)//1024} kB' for c, _ in vystupy))


if __name__ == '__main__':
    main()
