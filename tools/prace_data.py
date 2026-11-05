#!/usr/bin/env python3
"""Volná místa – stáhne otevřená data MPSV (volná místa + číselníky) a souřadnice RÚIAN,
zapíše kompaktní data pro obsah/prace.html do obsah/prace/data/.

    python3 tools/prace_data.py            # stáhne čerstvá data (cache ~/.cache/prace_data)
    python3 tools/prace_data.py --offline  # jen přepočítá z cache

Formát výstupu popisuje Prace_PLAN.md, pole řádku viz POLE níže (jádro obsah/prace/jadro.js).
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
DAVKY = 64          # detail/NN.json podle portalId % DAVKY
OFFLINE = '--offline' in sys.argv

# Pořadí sloupců řádku v mista.json (jádro je čte podle jména z meta → pole)
POLE = ['id', 'nazev', 'firma', 'ico', 'isco', 'obec', 'lat', 'lon', 'okresy', 'presnost',
        'mzdaOd', 'mzdaDo', 'hodinova', 'hodin', 'pocet', 'vzdelani', 'smennost', 'vztahy',
        'vhodnost', 'vyhody', 'obory', 'dovednosti', 'jazyky', 'priznaky', 'vlozeno', 'zmena',
        'nastup', 'konec', 'expirace']
PRIZNAKY = ['cizinecMimoEu', 'azylant', 'zamestnaneckaKarta', 'modraKarta', 'statniSpravaSamosprava',
            'agentura', 'anonymni', 'eures', 'url']


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


def dny(datum):
    """ISO datum → dny od 1970 (0 = nezadáno)."""
    if not datum:
        return 0
    return (dt.date.fromisoformat(datum[:10]) - dt.date(1970, 1, 1)).days


def text(o):
    return ((o or {}).get('cs') or '').replace('\r\n', '\n').strip()


def adresa_text(a):
    if not a:
        return ''
    ulice = (a.get('ulice') or {}).get('nazev') or ''
    cislo = '/'.join(str(x) for x in (a.get('cisloDomovni'), a.get('cisloOrientacni')) if x)
    return ' '.join(x for x in (ulice, cislo) if x) or (a.get('dodatekAdresy') or '')


def kontakt(k):
    if not k:
        return None
    ven = {}
    kdo = k.get('komuSeHlasit') or {}
    jmeno = ' '.join(x for x in (kdo.get('titulPredJmenem'), kdo.get('jmeno'), kdo.get('prijmeni'), kdo.get('titulZaJmenem')) if x)
    for klic, hodn in (('jmeno', jmeno), ('pozice', kdo.get('poziceVeSpolecnosti')), ('tel', kdo.get('telefon')),
                       ('email', kdo.get('email'))):
        if hodn:
            ven[klic] = hodn
    kde = k.get('kdeSeHlasit') or {}
    for klic, hodn in (('misto', kde.get('mistoKontaktu')), ('tel2', kde.get('telefon')), ('email2', kde.get('email')),
                       ('adresa', adresa_text(kde.get('adresa'))), ('obec', kod((kde.get('adresa') or {}).get('obec')))):
        if hodn:
            ven[klic] = hodn
    return ven or None


def main():
    c = nacti_ciselniky()
    mista = json.load(open(stahni(MPSV + 'volna-mista/volna-mista.json', 'volna-mista.json')))['polozky']
    datum_dat = max(x['datumZmeny'] for x in mista)[:10]

    def poradi(n):
        return {x['kod']: i for i, x in enumerate(c[n])}
    vzd, smen, vztahy, vhod, vyh, uro = (poradi(n) for n in (
        'vzdelani-detailni-kategorie', 'smennosti', 'pracovnepravni-vztahy', 'vhodnosti-pro-typ-zamestnance',
        'vyhody-volneho-mista', 'urovne-znalosti-jazyka'))
    obory_isco = {x['kod']: [int(kod(o)) for o in x.get('oboryCinnosti') or []] for x in c['cz-isco']}
    okres_kraj = {x['kod']: int(x['kraj'].split('/')[1]) for x in c['okresy']}
    obec_okres = {int(x['kod']): int(x['okres'].split('/')[1]) for x in c['obce']}
    dovednosti, jazyky = {}, {}   # kód → pořadí (jen použité)

    def adm_mista(x):
        p = ((x.get('mistoVykonuPrace') or {}).get('pracoviste') or [{}])[0] or {}
        return (p.get('adresa') or {}).get('kodAdresnihoMista')
    adm, stredy = souradnice({a for a in map(adm_mista, mista) if a})

    radky, detaily = [], [dict() for _ in range(DAVKY)]
    pouzite_isco = set()
    for x in mista:
        m = x.get('mistoVykonuPrace') or {}
        prac = (m.get('pracoviste') or [{}])[0] or {}
        a = prac.get('adresa') or {}
        obec = int(kod(a.get('obec')) or kod(m.get('obec')) or 0)
        okresy = sorted({int(kod(o)) for o in m.get('okresy') or []} | ({obec_okres[obec]} if obec in obec_okres else set()))
        if kod(m.get('typMistaVykonuPrace')) in ('celaCR', 'neurceno') and not obec or len(okresy) >= 70:
            okresy = []   # celá ČR (výčet všech okresů nemá smysl nosit)
        ka = a.get('kodAdresnihoMista')
        if ka and adm.get(ka):
            ll, presnost = adm[ka], 'a'
        elif obec in stredy:
            ll, presnost = stredy[obec], 'o'
        else:
            ll, presnost = (None, None), ('k' if okresy else 'c')
        isco = kod(x.get('profeseCzIsco')) or ''
        pouzite_isco.add(isco)
        povolani = [kod(v) for v in x.get('pozadovanePovolani') or []]   # praxe v oboru = kódy CZ-ISCO
        pouzite_isco.update(povolani)
        maska = lambda seznam, por: sum(1 << por[kod(v)] for v in seznam or [] if kod(v) in por)
        dov = [dovednosti.setdefault(kod(d['dovednost']), len(dovednosti)) for d in x.get('pozadovanaDovednost') or [] if d.get('dovednost')]
        jaz = [[jazyky.setdefault(kod(j['jazyk']), len(jazyky)), uro.get(kod(j.get('urovenZnalosti')), 1)]
               for j in x.get('pozadovanaJazykovaZnalost') or [] if j.get('jazyk')]
        zverejn = kod(x['zverejnovat'])
        prizn = {
            'cizinecMimoEu': x['cizinecMimoEu'], 'azylant': x['azylant'], 'zamestnaneckaKarta': x['zamestnaneckaKarta'],
            'modraKarta': x['modraKarta'], 'statniSpravaSamosprava': x['statniSpravaSamosprava'],
            'agentura': x['souhlasAgenturyUzivatel'], 'anonymni': zverejn == 'anosp', 'eures': zverejn == 'anoeu',
            'url': bool(x.get('urlAdresa')),
        }
        zam = x.get('zamestnavatel') or {}
        radky.append([
            x['portalId'], text(x.get('pozadovanaProfese')), zam.get('nazev') or '', zam.get('ico') or '', isco,
            obec, ll[0], ll[1], okresy, presnost,
            x.get('mesicniMzdaOd') or 0, x.get('mesicniMzdaDo') or 0, 1 if kod(x['typMzdy']) == 'hod' else 0,
            x.get('pocetHodinTydne') or 0, x.get('pocetMist') or 1,
            vzd.get(kod(x.get('minPozadovaneVzdelani')), 0), smen.get(kod(x.get('smennost')), len(smen) - 1),
            maska(x.get('pracovnePravniVztahy'), vztahy), maska(x.get('vhodnostiPracovnihoMista'), vhod),
            maska([v['vyhoda'] for v in x.get('vyhodyVolnehoMista') or [] if v.get('vyhoda')], vyh),
            sum(1 << o for o in obory_isco.get(isco, [])),
            dov, jaz, sum(1 << i for i, k in enumerate(PRIZNAKY) if prizn[k]),
            dny(x.get('datumVlozeni')), dny(x.get('datumZmeny')), dny(x.get('terminZahajeniPracovnihoPomeru')),
            dny(x.get('terminUkonceniPracovnihoPomeru')), dny(x.get('expirace')),
        ])
        det = {
            'ref': x.get('referencniCislo'), 'text': text(x.get('upresnujiciInformace')), 'url': x.get('urlAdresa'),
            'pracoviste': prac.get('nazev'), 'adresa': adresa_text(a) or m.get('adresaText'), 'psc': a.get('psc'),
            'kontakt': kontakt(x.get('prvniKontaktSeZamestnavatelem')),
            'prac_tel': prac.get('telefon'), 'prac_email': prac.get('email'),
            'up': kod(x.get('kontaktniPracoviste')),
            'vyhody': [[kod(v['vyhoda']), v.get('popis')] for v in x.get('vyhodyVolnehoMista') or [] if v.get('vyhoda') and v.get('popis')],
            'dovednosti': [[kod(d['dovednost']), d.get('popis')] for d in x.get('pozadovanaDovednost') or [] if d.get('dovednost') and d.get('popis')],
            'jazyky': [[kod(j['jazyk']), j.get('popis')] for j in x.get('pozadovanaJazykovaZnalost') or [] if j.get('jazyk') and j.get('popis')],
            'kkov': [kod(v) for v in x.get('pozadovaneVzdelani') or []] if isinstance(x.get('pozadovaneVzdelani'), list) else
                    ([kod(x['pozadovaneVzdelani'])] if x.get('pozadovaneVzdelani') else []),
            'praxe': povolani,
        }
        detaily[x['portalId'] % DAVKY][str(x['portalId'])] = {k: v for k, v in det.items() if v}

    # CZ-ISCO: použité kódy + všichni předci (1–4 místa) kvůli stromu oborů
    isco_vse = {x['kod']: x['nazev']['cs'] for x in c['cz-isco']}
    pouzite = {k[:i] for k in pouzite_isco if k for i in range(1, len(k) + 1)}
    nazvy = lambda n, kody=None: {x['kod']: x['nazev']['cs'] for x in c[n] if kody is None or x['kod'] in kody}
    dov_nazvy = nazvy('dovednosti')
    jaz_nazvy = nazvy('jazyky')
    meta = {
        'datum': datum_dat, 'sestaveno': dt.datetime.now().isoformat(timespec='minutes'),
        'pocet': len(radky), 'mist': sum(r[14] for r in radky), 'davky': DAVKY,
        'zdroj': 'MPSV / Úřad práce ČR – otevřená data „Volná místa za celou ČR“ (data.mpsv.cz); souřadnice RÚIAN © ČÚZK',
        'minimalni': MINIMALNI_MZDA,
        'pole': POLE, 'priznaky': PRIZNAKY,
        'vzdelani': [x['nazev']['cs'] for x in c['vzdelani-detailni-kategorie']],
        'smennost': [x['nazev']['cs'] for x in c['smennosti']],
        'vztahy': [x['nazev']['cs'] for x in c['pracovnepravni-vztahy']],
        'vhodnost': [x['nazev']['cs'] for x in c['vhodnosti-pro-typ-zamestnance']],
        'vyhody': [x['nazev']['cs'] for x in c['vyhody-volneho-mista']],
        'vyhodyKod': [x['kod'] for x in c['vyhody-volneho-mista']],
        'uroven': [x['nazev']['cs'] for x in c['urovne-znalosti-jazyka']],
        'obory': {x['kod']: x['nazev']['cs'] for x in c['obory-cinnosti-pro-vm']},
        'dovednosti': [dov_nazvy.get(k, k) for k in dovednosti],
        'dovednostiKod': list(dovednosti),
        'jazyky': [jaz_nazvy.get(k, k) for k in jazyky],
        'jazykyKod': list(jazyky),
        'isco': {k: isco_vse[k] for k in sorted(pouzite) if k in isco_vse},
        'kraje': {x['kod']: x['nazev']['cs'] for x in c['kraje']},
        'okresy': {x['kod']: [x['nazev']['cs'], okres_kraj[x['kod']]] for x in c['okresy']},
        'up': nazvy('kontaktni-pracoviste'),
        'kkov': nazvy('vzdelani-kkov', {k for d in detaily for v in d.values() for k in v.get('kkov', [])}),
    }
    # okres → střed (průměr středů jeho obcí) pro inzeráty jen s okresem
    for k, v in meta['okresy'].items():
        body = [stredy[o] for o, ok in obec_okres.items() if ok == int(k) and o in stredy]
        v += [round(sum(b[0] for b in body) / len(body), 4), round(sum(b[1] for b in body) / len(body), 4)] if body else [None, None]
    obce = [[int(x['kod']), x['nazev']['cs'], obec_okres[int(x['kod'])]] + list(stredy.get(int(x['kod']), [None, None]))
            for x in c['obce']]

    VYSTUP.mkdir(parents=True, exist_ok=True)
    (VYSTUP / 'detail').mkdir(exist_ok=True)
    zapis = lambda cesta, data: cesta.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    zapis(VYSTUP / 'meta.json', meta)
    zapis(VYSTUP / 'obce.json', obce)
    zapis(VYSTUP / 'mista.json', radky)
    for i, d in enumerate(detaily):
        zapis(VYSTUP / 'detail' / ('%02d.json' % i), d)
    velikost = lambda p: sum(f.stat().st_size for f in p.rglob('*.json')) / 1e6
    print('hotovo: %d inzerátů, %d míst, data k %s; mista.json %.1f MB, detail %.1f MB, celkem %.1f MB'
          % (len(radky), meta['mist'], datum_dat, (VYSTUP / 'mista.json').stat().st_size / 1e6,
             velikost(VYSTUP / 'detail'), velikost(VYSTUP)), file=sys.stderr)
    print('přesnost polohy:', {p: sum(1 for r in radky if r[9] == p) for p in 'aokc'}, file=sys.stderr)


if __name__ == '__main__':
    main()
