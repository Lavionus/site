#!/usr/bin/env python3
"""Volná místa – stálé podklady pro obsah/prace.html (obsah/prace/data/):

    obce.json      [kod, nazev, okres, lat, lon] – všechny obce se středem (RÚIAN)
    podklady.json  zhuštěné číselníky MPSV + souřadnice adresních míst používaných v inzerátech

Samotné inzeráty si stahuje prohlížeč návštěvníka přímo z MPSV (obsah/prace/stahovani.js),
v gitu nejsou. Tenhle skript stačí spustit občas (číselníky, nové adresy – třeba 1× za měsíc).

    python3 tools/prace_data.py            # stáhne čerstvá data (cache ~/.cache/prace_data)
    python3 tools/prace_data.py --offline  # jen přepočítá z cache
"""
import csv, datetime as dt, io, json, os, sys, urllib.request, zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from prace_krovak import jtsk_na_wgs

KOREN = Path(__file__).resolve().parent.parent
VYSTUP = KOREN / 'obsah' / 'prace' / 'data'
CACHE = Path(os.environ.get('PRACE_CACHE', Path.home() / '.cache' / 'prace_data'))
MPSV = 'https://data.mpsv.cz/od/soubory/'
CISELNIKY = ['okresy', 'obce', 'kraje', 'cz-isco', 'smennosti', 'vzdelani-detailni-kategorie',
             'pracovnepravni-vztahy', 'vhodnosti-pro-typ-zamestnance', 'vyhody-volneho-mista',
             'dovednosti', 'jazyky', 'urovne-znalosti-jazyka', 'kontaktni-pracoviste',
             'obory-cinnosti-pro-vm', 'vzdelani-kkov']
MINIMALNI_MZDA = 22400   # Kč/měsíc od 1. 1. 2026 – ručně stárnoucí, zkontrolovat každý leden
OFFLINE = '--offline' in sys.argv


def stahni(url, soubor, povinny=True):
    cil = CACHE / soubor
    if OFFLINE and cil.exists():
        return cil
    cil.parent.mkdir(parents=True, exist_ok=True)
    print('stahuji', url, file=sys.stderr)
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'prace_data.py (lavionus.github.io/site)'})
        with urllib.request.urlopen(req, timeout=600) as r, open(str(cil) + '.cast', 'wb') as f:
            while blok := r.read(1 << 20):
                f.write(blok)
        os.replace(str(cil) + '.cast', cil)
    except Exception as e:
        if povinny and not cil.exists():
            raise
        print('  nelze stáhnout (%s)%s' % (e, ', beru starou kopii' if cil.exists() else ''), file=sys.stderr)
        if not cil.exists():
            return None
    return cil


def nacti_ciselniky():
    c = {}
    for n in CISELNIKY:
        s = stahni(MPSV + 'ciselniky/%s.json' % n, 'ciselniky/%s.json' % n, povinny=n in ('okresy', 'obce', 'kraje', 'cz-isco'))
        c[n] = json.load(open(s))['polozky'] if s else []
    return c


def soubor_ruian():
    """CSV adresních míst ČÚZK – k poslednímu dni minulého měsíce (zkusí i měsíc předtím)."""
    den = dt.date.today().replace(day=1) - dt.timedelta(days=1)
    for _ in range(3):
        jmeno = '%s_OB_ADR_csv.zip' % den.strftime('%Y%m%d')
        if (CACHE / jmeno).exists():
            return CACHE / jmeno, den
        if not OFFLINE:
            s = stahni('https://vdp.cuzk.gov.cz/vymenny_format/csv/' + jmeno, jmeno, povinny=False)
            if s:
                return s, den
        den = den.replace(day=1) - dt.timedelta(days=1)
    raise SystemExit('Nenašel jsem CSV adresních míst RÚIAN')


def souradnice(potrebne_adm):
    """→ (adm: (lat, lon) jen pro potřebné kódy, obec: (lat, lon) průměr adres obce). Výsledek se cachuje."""
    zipf, den = soubor_ruian()
    obce_cache = CACHE / ('obce_stredy_%s.json' % den.strftime('%Y%m%d'))
    adm_cache = CACHE / 'adm_wgs.json'
    znam = json.load(open(adm_cache)) if adm_cache.exists() else {}
    chybi = {str(k) for k in potrebne_adm} - znam.keys()
    if obce_cache.exists() and not chybi:
        return {int(k): v for k, v in znam.items()}, {int(k): v for k, v in json.load(open(obce_cache)).items()}
    print('procházím RÚIAN (%d adres k převodu)…' % len(chybi), file=sys.stderr)
    soucty = {}
    with zipfile.ZipFile(zipf) as z:
        for jm in z.namelist():
            with z.open(jm) as f:
                for r in csv.reader(io.TextIOWrapper(f, encoding='cp1250'), delimiter=';'):
                    if not r[0].isdigit() or not r[16]:
                        continue
                    y, x = float(r[16]), float(r[17])
                    s = soucty.setdefault(int(r[1]), [0.0, 0.0, 0])
                    s[0] += x; s[1] += y; s[2] += 1
                    if r[0] in chybi:
                        znam[r[0]] = [round(v, 5) for v in jtsk_na_wgs(x, y)]
    for k in chybi - znam.keys():
        znam[k] = None   # adresa v RÚIAN už není (zrušená/nová) – příště ji znovu nehledat
    stredy = {k: [round(v, 4) for v in jtsk_na_wgs(s[0] / s[2], s[1] / s[2])] for k, s in soucty.items()}
    json.dump(znam, open(adm_cache, 'w'))
    json.dump(stredy, open(obce_cache, 'w'))
    return {int(k): v for k, v in znam.items()}, stredy


def kod(o):
    """{'id': 'Smennost/jednoSm'} → 'jednoSm'"""
    return o['id'].split('/', 1)[1] if o and o.get('id') else None


def main():
    c = nacti_ciselniky()
    mista = json.load(open(stahni(MPSV + 'volna-mista/volna-mista.json', 'volna-mista.json')))['polozky']

    def adm_mista(x):
        p = ((x.get('mistoVykonuPrace') or {}).get('pracoviste') or [{}])[0] or {}
        return (p.get('adresa') or {}).get('kodAdresnihoMista')
    pouzite_adm = {a for a in map(adm_mista, mista) if a}
    adm, stredy = souradnice(pouzite_adm)
    del mista

    okres_kraj = {x['kod']: int(x['kraj'].split('/')[1]) for x in c['okresy']}
    obec_okres = {int(x['kod']): int(x['okres'].split('/')[1]) for x in c['obce']}
    nazvy = lambda n: {x['kod']: x['nazev']['cs'] for x in c[n]}
    seznam = lambda n: [[x['kod'], x['nazev']['cs']] for x in c[n]]
    okresy = {}
    for x in c['okresy']:
        body = [stredy[o] for o, ok in obec_okres.items() if ok == int(x['kod']) and o in stredy]
        stred = [round(sum(b[i] for b in body) / len(body), 4) for i in (0, 1)] if body else [None, None]
        okresy[x['kod']] = [x['nazev']['cs'], okres_kraj[x['kod']]] + stred
    podklady = {
        'sestaveno': dt.datetime.now().isoformat(timespec='minutes'),
        'minimalni': MINIMALNI_MZDA,
        'vzdelani': seznam('vzdelani-detailni-kategorie'), 'smennost': seznam('smennosti'),
        'vztahy': seznam('pracovnepravni-vztahy'), 'vhodnost': seznam('vhodnosti-pro-typ-zamestnance'),
        'vyhody': seznam('vyhody-volneho-mista'), 'uroven': seznam('urovne-znalosti-jazyka'),
        'obory': nazvy('obory-cinnosti-pro-vm'), 'dovednosti': nazvy('dovednosti'), 'jazyky': nazvy('jazyky'),
        'kraje': nazvy('kraje'), 'okresy': okresy, 'up': nazvy('kontaktni-pracoviste'), 'kkov': nazvy('vzdelani-kkov'),
        'isco': {x['kod']: [x['nazev']['cs'], [int(kod(o)) for o in x.get('oboryCinnosti') or []]] for x in c['cz-isco']},
        'adresy': {str(k): adm[k] for k in sorted(pouzite_adm) if adm.get(k)},
    }
    obce = [[int(x['kod']), x['nazev']['cs'], obec_okres[int(x['kod'])]] + list(stredy.get(int(x['kod']), [None, None]))
            for x in c['obce']]

    VYSTUP.mkdir(parents=True, exist_ok=True)
    zapis = lambda cesta, data: cesta.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    zapis(VYSTUP / 'podklady.json', podklady)
    zapis(VYSTUP / 'obce.json', obce)
    print('hotovo: podklady.json %.0f kB (%d adres), obce.json %.0f kB'
          % ((VYSTUP / 'podklady.json').stat().st_size / 1e3, len(podklady['adresy']),
             (VYSTUP / 'obce.json').stat().st_size / 1e3), file=sys.stderr)


if __name__ == '__main__':
    main()
