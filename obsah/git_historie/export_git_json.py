#!/usr/bin/env python3
"""export_git_json.py – export historie lokálního Git repozitáře do JSON
pro stránku „Historie Gitu“ (obsah/git_historie.html).

Jen standardní knihovna Pythonu 3.7+, potřebuje příkaz `git` v PATH.
Repozitář jen čte (git log, git for-each-ref, git rev-parse), nic nemění.

Použití:
    python3 export_git_json.py                      # aktuální adresář → git_historie.json
    python3 export_git_json.py -C ~/projekt -o projekt.json
    python3 export_git_json.py --max 2000           # jen 2000 nejnovějších commitů (DAG pak není úplný)
    python3 export_git_json.py --bez-souboru        # bez statistik změn souborů (menší soubor)
    python3 export_git_json.py --emaily hash        # e-maily nahradí krátkým otiskem (soukromí)
    python3 export_git_json.py --rozsah main develop  # jen vybrané větve místo --all

Jak to funguje:
    git log --all --parents --numstat -z --diff-merges=first-parent --format=<ZNAČKA>%H%x00%P%x00…<KONEC>
  Každý commit začíná náhodnou značkou vygenerovanou při každém běhu (uuid4), pole odděluje
  znak NUL, který se ve zprávě commitu vyskytnout nemůže. Obsah zpráv tedy nemůže rozbít
  rozdělování záznamů. Statistiky souborů (--numstat -z) mají cesty bez uvozovek a přejmenování
  jako dvojici (stará, nová cesta). U merge commitů se změny počítají vůči prvnímu rodiči.
  Značky a větve se čtou přes `git for-each-ref`, anotované značky se rozbalí na cílový commit.

Výstup (formát „git-historie-json“, verze 1) – viz popis na stránce. Soubor otevřete
tlačítkem „Načíst JSON“ nebo ho přetáhněte na stránku; data neopouštějí prohlížeč.
"""
import argparse, json, os, re, subprocess, sys, uuid, hashlib, datetime

VERZE_NASTROJE = "1.0"


def git(args, cwd, binarne=False):
    p = subprocess.run(["git"] + args, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode != 0:
        raise RuntimeError("git %s selhal: %s" % (" ".join(args[:3]), p.stderr.decode("utf-8", "replace").strip()))
    return p.stdout if binarne else p.stdout.decode("utf-8", "replace")


def git_verze(cwd):
    t = git(["--version"], cwd).strip()
    m = re.search(r"(\d+)\.(\d+)", t)
    return t, (int(m.group(1)), int(m.group(2))) if m else (0, 0)


def email_vystup(email, rezim):
    if rezim == "plne":
        return email
    if rezim == "zadne" or not email:
        return None
    return "hash:" + hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()[:12]


def typ_refu(nazev):
    if nazev.startswith("refs/heads/"):
        return "vetev"
    if nazev.startswith("refs/remotes/"):
        return "vzdalena"
    if nazev.startswith("refs/tags/"):
        return "znacka"
    return "jina"


def nacti_refs(cwd):
    fmt = "%(refname)%00%(objecttype)%00%(objectname)%00%(*objectname)%00%(*objecttype)%00%(contents:subject)"
    vystup = git(["for-each-ref", "--format=" + fmt], cwd)
    refs = []
    for radek in vystup.split("\n"):
        if not radek:
            continue
        pole = radek.split("\0")
        if len(pole) < 6:
            continue
        nazev, typ_obj, cil, rozbaleny, typ_rozb, predmet = pole[:6]
        if nazev == "refs/stash" or nazev.endswith("/HEAD") and typ_refu(nazev) == "vzdalena":
            # refs/remotes/origin/HEAD je jen ukazatel na výchozí větev, stash nepatří do historie
            continue
        ref = {"nazev": nazev, "typ": typ_refu(nazev), "objekt": typ_obj}
        if typ_obj == "tag":
            ref["anotovana"] = True
            ref["zprava"] = predmet
            # anotovaná značka může ukazovat i na strom nebo jinou značku; bereme jen commity
            if typ_rozb != "commit":
                continue
            ref["cil"] = rozbaleny
        elif typ_obj == "commit":
            ref["cil"] = cil
        else:
            continue
        refs.append(ref)
    return refs


def rozparsuj_log(data, znacka_s, znacka_e, soubory, emaily):
    commity = []
    casti = data.split(znacka_s)
    for cast in casti[1:]:
        konec = cast.find(znacka_e)
        if konec < 0:
            raise RuntimeError("poškozený výstup git log (chybí koncová značka)")
        hlavicka = cast[:konec].split("\0")
        if len(hlavicka) < 10:
            raise RuntimeError("poškozený výstup git log (málo polí)")
        sha, rodice, an, ae, ad, cn, ce, cd, predmet = hlavicka[:9]
        telo = "\0".join(hlavicka[9:])
        c = {
            "sha": sha,
            "rodice": rodice.split() if rodice.strip() else [],
            "autor": an,
            "email": email_vystup(ae, emaily),
            "datum": ad,
            "commiter": cn,
            "commiter_email": email_vystup(ce, emaily),
            "datum_commit": cd,
            "predmet": predmet,
            "telo": telo.strip("\n"),
        }
        if soubory:
            zbytek = cast[konec + len(znacka_e):]
            tokeny = zbytek.split("\0")
            seznam = []
            i = 0
            while i < len(tokeny):
                t = tokeny[i].lstrip("\n")
                i += 1
                if not t:
                    continue
                pole = t.split("\t", 2)
                if len(pole) < 3:
                    continue
                pridano = None if pole[0] == "-" else int(pole[0])
                odebrano = None if pole[1] == "-" else int(pole[1])
                if pole[2] == "":
                    # přejmenování / kopie: další dva tokeny = stará a nová cesta
                    if i + 1 >= len(tokeny):
                        break
                    stara, nova = tokeny[i], tokeny[i + 1]
                    i += 2
                    seznam.append([nova, pridano, odebrano, stara])
                else:
                    seznam.append([pole[2], pridano, odebrano])
            c["soubory"] = seznam
        commity.append(c)
    return commity


def main():
    ap = argparse.ArgumentParser(description="Export historie Git repozitáře do JSON pro stránku Historie Gitu.")
    ap.add_argument("-C", dest="repo", default=".", help="cesta k repozitáři (výchozí: aktuální adresář)")
    ap.add_argument("-o", dest="vystup", default="git_historie.json", help="výstupní soubor, '-' = standardní výstup")
    ap.add_argument("--max", type=int, default=None, help="nejvýše N nejnovějších commitů")
    ap.add_argument("--od", default=None, help="jen commity od data (např. 2024-01-01); DAG pak není úplný")
    ap.add_argument("--rozsah", nargs="+", default=None, help="revize místo --all (např. main develop)")
    ap.add_argument("--bez-souboru", action="store_true", help="nevkládat statistiky změn souborů")
    ap.add_argument("--emaily", choices=["plne", "hash", "zadne"], default="plne", help="jak uložit e-maily")
    ap.add_argument("--odsazeni", action="store_true", help="čitelný (odsazený) JSON")
    a = ap.parse_args()

    cwd = os.path.abspath(a.repo)
    try:
        koren = git(["rev-parse", "--show-toplevel"], cwd).strip()
    except RuntimeError as e:
        sys.exit("Není to Git repozitář: %s" % e)
    verze_text, verze = git_verze(cwd)

    znacka = uuid.uuid4().hex
    znacka_s, znacka_e = "\x1e@S" + znacka + "@", "@E" + znacka + "@"
    fmt = znacka_s + "%H%x00%P%x00%an%x00%ae%x00%aI%x00%cn%x00%ce%x00%cI%x00%s%x00%b" + znacka_e
    args = ["-c", "core.quotepath=off", "log", "--parents", "-z", "--date-order", "--no-color", "--format=" + fmt]
    if a.rozsah:
        args += a.rozsah
    else:
        args += ["--exclude=refs/stash", "--all"]
    numstat_merge = "zadne"
    if not a.bez_souboru:
        args += ["--numstat", "-M"]
        if verze >= (2, 31):
            args += ["--diff-merges=first-parent"]
            numstat_merge = "first-parent"
    if a.max:
        args += ["--max-count=%d" % a.max]
    if a.od:
        args += ["--since=" + a.od]
    args += ["--"]

    try:
        surova = git(args, cwd, binarne=True)
    except RuntimeError as e:
        if "does not have any commits" in str(e) or "bad default revision" in str(e):
            surova = b""
        else:
            sys.exit(str(e))
    data = surova.decode("utf-8", "replace")
    commity = rozparsuj_log(data, znacka_s, znacka_e, not a.bez_souboru, a.emaily)

    refs = nacti_refs(cwd)
    try:
        head = git(["rev-parse", "-q", "--verify", "HEAD^{commit}"], cwd).strip() or None
    except RuntimeError:
        head = None
    try:
        head_ref = git(["symbolic-ref", "-q", "HEAD"], cwd).strip() or None
    except RuntimeError:
        head_ref = None  # odpojená HEAD
    try:
        melky = git(["rev-parse", "--is-shallow-repository"], cwd).strip() == "true"
    except RuntimeError:
        melky = False

    vysledek = {
        "format": "git-historie-json",
        "verze": 1,
        "zdroj": "lokalni-git",
        "nastroj": "export_git_json.py " + VERZE_NASTROJE,
        "git_verze": verze_text,
        "vytvoreno": datetime.datetime.now(datetime.timezone.utc).astimezone().isoformat(timespec="seconds"),
        "repo": {"nazev": os.path.basename(koren), "head": head, "head_ref": head_ref, "melky": melky},
        "parametry": {
            "rozsah": a.rozsah or ["--all"],
            "max_pocet": a.max,
            "od": a.od,
            "soubory": not a.bez_souboru,
            "emaily": a.emaily,
            "numstat_merge": numstat_merge if not a.bez_souboru else None,
        },
        "refs": refs,
        "commity": commity,
    }
    text = json.dumps(vysledek, ensure_ascii=False, indent=1 if a.odsazeni else None,
                      separators=None if a.odsazeni else (",", ":"))
    if a.vystup == "-":
        sys.stdout.write(text + "\n")
    else:
        with open(a.vystup, "w", encoding="utf-8") as f:
            f.write(text + "\n")
        print("Uloženo %d commitů a %d odkazů do %s" % (len(commity), len(refs), a.vystup), file=sys.stderr)
    if melky:
        print("Pozor: mělký klon – nejstarší commity mají rodiče mimo export.", file=sys.stderr)


if __name__ == "__main__":
    main()
