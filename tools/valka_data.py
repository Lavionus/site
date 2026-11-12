#!/usr/bin/env python3
"""Data pro obsah/valka_ukrajina.html, která prohlížeč živě stáhnout nemůže (zdroje bez CORS).
Spouštět ručně před uploadem:  python3 tools/valka_data.py
Výstup: obsah/valka_ukrajina_data.json

- NASA FIRMS (VIIRS NOAA-20, veřejný soubor za 7 dní, bez klíče): ohniska požárů na Ukrajině.
  Soubor pokrývá jen 7 dní → body se slučují s minulým během a drží se 30 dní.
- ACLED přes HDX (agregace po měsících a rajonech, bez klíče): počty ozbrojených střetů a útoků
  a obětí. Podle podmínek ACLED se zobrazují jen souhrny s uvedením zdroje, ne surová tabulka.
"""
import csv, io, json, os, re, sys, urllib.request, zipfile, datetime as dt
import xml.etree.ElementTree as ET

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VYSTUP = os.path.join(KOREN, 'obsah', 'valka_ukrajina_data.json')
UA = (44.0, 52.5, 22.0, 40.3)   # šířka min/max, délka min/max (s rezervou kolem fronty)
FIRMS = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Europe_7d.csv'
HDX = 'https://data.humdata.org/api/3/action/package_show?id=ukraine-acled-conflict-data'
UA_HLAVICKA = {'User-Agent': 'valka-ukrajina-data/1.0 (staticky web, rucni beh)'}
MESICE = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']


def stahni(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA_HLAVICKA), timeout=120) as r:
        return r.read()


def firms(minule):
    text = stahni(FIRMS).decode()
    body = {}
    for b in minule.get('body', []):   # [šířka, délka, datum, čas, frp]
        body[(b[0], b[1], b[2], b[3])] = b
    for r in csv.DictReader(io.StringIO(text)):
        la, lo = float(r['latitude']), float(r['longitude'])
        if not (UA[0] <= la <= UA[1] and UA[2] <= lo <= UA[3]) or r['confidence'] == 'low':
            continue
        b = [round(la, 3), round(lo, 3), r['acq_date'], r['acq_time'], round(float(r['frp']), 1)]
        body[tuple(b[:4])] = b
    datumy = [b[2] for b in body.values()]
    if not datumy:
        raise SystemExit('FIRMS: žádné body – soubor je prázdný?')
    posledni = max(datumy)
    od = (dt.date.fromisoformat(posledni) - dt.timedelta(days=29)).isoformat()
    vse = sorted((b for b in body.values() if b[2] >= od), key=lambda b: (b[2], b[3]))
    return {'od': min(b[2] for b in vse), 'do': posledni, 'zdroj': FIRMS, 'body': vse}


def xlsx_radky(data, list_):
    """Minimální čtečka XLSX (zip + XML), aby skript nepotřeboval openpyxl."""
    z = zipfile.ZipFile(io.BytesIO(data))
    ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
          'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
    sdilene = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', ns):
            sdilene.append(''.join(t.text or '' for t in si.iter('{%s}t' % ns['m'])))
    kniha = ET.fromstring(z.read('xl/workbook.xml'))
    rid = next(s.get('{%s}id' % ns['r']) for s in kniha.find('m:sheets', ns) if s.get('name') == list_)
    vazby = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    cil = next(v.get('Target') for v in vazby if v.get('Id') == rid).lstrip('/')
    cil = cil if cil.startswith('xl/') else 'xl/' + cil
    for row in ET.fromstring(z.read(cil)).iter('{%s}row' % ns['m']):
        radek = {}
        for c in row.findall('m:c', ns):
            sl = re.match(r'[A-Z]+', c.get('r')).group()
            v = c.find('m:v', ns)
            if c.get('t') == 'inlineStr':
                hod = ''.join(t.text or '' for t in c.iter('{%s}t' % ns['m']))
            elif v is None:
                hod = None
            elif c.get('t') == 's':
                hod = sdilene[int(v.text)]
            else:
                hod = v.text
            radek[sl] = hod
        yield radek


def acled():
    balik = json.loads(stahni(HDX))['result']
    zdroj = next(r for r in balik['resources'] if 'political_violence' in r['name'])
    radky = list(xlsx_radky(stahni(zdroj['url']), 'Data'))
    hl = {v: k for k, v in radky[0].items()}
    mesice, oblasti = {}, {}
    for r in radky[1:]:
        try:
            m = f"{int(float(r[hl['Year']]))}-{MESICE.index(r[hl['Month']]) + 1:02d}"
        except (KeyError, ValueError, TypeError):
            continue
        u, o = int(float(r.get(hl['Events']) or 0)), int(float(r.get(hl['Fatalities']) or 0))
        x = mesice.setdefault(m, [0, 0]); x[0] += u; x[1] += o
        x = oblasti.setdefault(m, {}).setdefault(r[hl['Admin1']], [0, 0]); x[0] += u; x[1] += o
    poradi = sorted(mesice)
    od = poradi[-25] if len(poradi) > 25 else poradi[0]
    return {
        'aktualizace': balik.get('last_modified', '')[:10],
        'stranka': 'https://data.humdata.org/dataset/ukraine-acled-conflict-data',
        'soubor': zdroj['name'],
        'mesice': [[m, *mesice[m]] for m in poradi if m >= od],
        # oblasti za poslední 3 měsíce (běžící měsíc je neúplný, proto souhrn přes delší okno)
        'oblasti_od': poradi[-3], 'oblasti_do': poradi[-1],
        'oblasti': sorted(([o, sum(oblasti[m].get(o, [0, 0])[0] for m in poradi[-3:]), sum(oblasti[m].get(o, [0, 0])[1] for m in poradi[-3:])]
                           for o in {o for m in poradi[-3:] for o in oblasti[m]}), key=lambda x: -x[1])[:10],
    }


def main():
    minule = {}
    if os.path.exists(VYSTUP):
        with open(VYSTUP) as f:
            minule = json.load(f)
    data = {'stazeno': dt.date.today().isoformat()}
    for klic, fn in (('firms', lambda: firms(minule.get('firms', {}))), ('acled', acled)):
        try:
            data[klic] = fn()
        except Exception as e:   # jeden zdroj nesmí shodit druhý; ponechat minulá data
            print(f'⚠ {klic}: {e}', file=sys.stderr)
            if klic in minule:
                data[klic] = minule[klic]
    with open(VYSTUP, 'w') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    f_ = data.get('firms', {}); a = data.get('acled', {})
    print(f"FIRMS: {len(f_.get('body', []))} bodů {f_.get('od')}–{f_.get('do')}")
    print(f"ACLED: {len(a.get('mesice', []))} měsíců, poslední {a.get('mesice', [[None]])[-1]}, oblasti {a.get('oblasti', [])[:3]}")
    print('zapsáno', VYSTUP, os.path.getsize(VYSTUP), 'B')


if __name__ == '__main__':
    main()
