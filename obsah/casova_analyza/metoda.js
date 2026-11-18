/* Časová analýza – obsah panelu „📐 Metoda, literatura, meze“ (vysetrovani/metoda.js) */
MetodaPanel.nastav({
  nastroj: 'casova_analyza',
  princip: [
    'Záznamy všech zdrojů (GPS, Takeout, výpisy operátora, EXIF fotek, ruční události) se převedou na jednu časovou osu v UTC. Časy bez pásma se převádějí podle pásma zdroje včetně letního času, ke každému zdroji se přičte jeho posun hodin.',
    'Vzdálenost dvou bodů je ortodroma na kouli (haversinův vzorec, poloměr Země 6 371 km). Poloha v libovolném okamžiku se dopočítá lineární interpolací mezi sousedními body téže osoby – nejvýše 30 minut od nejbližšího záznamu, jinak „nelze“.',
    'Pobyty (stay points): od každého bodu se hledají následující body v okruhu R; pokud skupina trvá aspoň T, vznikne pobyt se středem v průměru bodů. Mezi pobyty jsou přesuny s délkou trasy a průměrnou rychlostí.',
    'Kontroly integrity dat: mezery delší než práh, nemožné rychlosti mezi sousedními body (po odečtení přesnosti obou bodů) a konzistence zdrojů – poloha z výpisu, fotky nebo zápisu se porovná s GPS téže osoby ve stejném okamžiku; u buňky s azimutem se ověří, zda poloha leží ve výseči antény.',
    'Ověření alibi a souběh: v okně ±Δt kolem času T se posoudí všechny polohy s jejich přesností. Souběh dvou osob = dvojice bodů s rozdílem času ≤ Δt a vzdáleností ≤ R, sloučené do intervalů.',
    'Odhad posunu hodin zdroje: posun s, při kterém je medián vzdáleností bodů zdroje od referenční trasy (ostatní zařízení) nejmenší; hrubě po 60 s, jemně po 5 s. Posun blízko celých hodin se zaokrouhlí a označí jako jiné časové pásmo.'
  ],
  vzorce: [
    'd = 2·R·asin √( sin²(Δφ/2) + cos φ₁·cos φ₂·sin²(Δλ/2) )\nR = 6 371 008,8 m',
    'poloha(t) = A + (B − A)·(t − t_A)/(t_B − t_A)\njen když t − t_A ≤ 30 min nebo t_B − t ≤ 30 min',
    'pobyt: body i…j−1 s d(bod_i, bod_k) ≤ R  a  t_{j−1} − t_i ≥ T\n(výchozí R = 150 m, T = 10 min)',
    'nemožná rychlost: v = max(0, d − acc_A − acc_B − 20 m) / Δt > limit\n(výchozí limit 250 km/h)',
    'alibi v čase T ± okno:\n  všechny body d + acc ≤ R → „v okruhu“\n  všechny body d − acc > R → „mimo“\n  jinak „nejednoznačné“;  žádný bod → „nelze“',
    'souběh:  |t_A − t_B| ≤ Δt  a  d(A, B) ≤ R\n„jistý“, když d + acc_A + acc_B ≤ R',
    'posun hodin:  s* = argmin_s  medián_i d( bod_i, trasa(t_i + s) )'
  ],
  predpoklady: [
    'Časy zdrojů jsou správně přiřazené k pásmu; u výpisů operátora a EXIF bez pásma zadal uživatel pásmo zdroje.',
    'Přesnost (acc) bodu odpovídá skutečné chybě polohy; bez údaje se bere 0 m (výsledek je pak přísnější, než data dovolují).',
    'Telefon nesla osoba, které je zdroj přiřazen, a mezi dvěma záznamy se pohybovala zhruba přímo.',
    'Reference pro odhad posunu hodin (GPS jiného zařízení) má sama správný čas.'
  ],
  meze: [
    'Telefon ≠ osoba: zařízení mohlo být zapůjčené, odložené nebo v jiném autě. Souběh dvou telefonů neznamená setkání lidí a poloha telefonu sama nedokazuje, kdo s ním byl.',
    'Přesnost polohy: GPS pod širým nebem jednotky metrů, ve městě a u budov desítky metrů; Wi-Fi poloha desítky metrů; poloha z buňky (BTS) stovky metrů až kilometry – je to poloha antény a sektor, ne telefonu. Proto se BTS nepoužívá v pobytech, souběhu ani alibi, jen v kontrole konzistence.',
    'Mezery v datech: vypnutý telefon, režim letadlo, úspora baterie nebo filtrování Googlem. Interpolace přes mezeru nic nedokazuje – nástroj ji odmítne po 30 minutách, ale i kratší interpolace je jen odhad.',
    'Google Takeout „návštěvy“ a „přesuny“ jsou odvozené Googlem (algoritmus není veřejný); surové body (Records.json, rawSignals) jsou spolehlivější. Nové exporty z telefonu mívají řidší vzorkování.',
    'Časová pásma: hodina po přechodu na zimní čas je dvojznačná (02:00–03:00 nastane dvakrát); výpisy operátorů bývají v místním čase bez označení pásma; hodiny fotoaparátů a kamer bývají posunuté o minuty i hodiny.',
    'Podvržená poloha (spoofing) je vidět jen jako nesoulad s jiným zdrojem (BTS, kamera, platba) nebo jako nemožný skok – samotná GPS stopa podvrh neprozradí.',
    'Odhad posunu hodin potřebuje polohy zdroje během pohybu; při stání na místě je posun neurčitelný. Výsledek je s krokem 5 s.',
    'Ověření v tabulce níže je na syntetických ukázkách s pravidelným vzorkováním a známým šumem; skutečné exporty jsou nepravidelné a nástroj nebyl ověřen na datech operátorů ani forenzních extrakcích telefonů.'
  ],
  literatura: [
    'Q. Li, Y. Zheng, X. Xie, Y. Chen, W. Liu, W.-Y. Ma: Mining user similarity based on location history. ACM SIGSPATIAL GIS 2008 – algoritmus detekce pobytů (stay points) s prahem vzdálenosti a času.',
    'Y. Zheng, L. Zhang, X. Xie, W.-Y. Ma: Mining interesting locations and travel sequences from GPS trajectories. WWW 2009 – pobyty a shlukování opakovaných míst.',
    'M. C. González, C. A. Hidalgo, A.-L. Barabási: Understanding individual human mobility patterns. Nature 453, 2008 – pravidelnost pohybu (domov, práce), z níž vychází analýza vzorců.',
    'P. A. Zandbergen: Accuracy of iPhone locations: A comparison of assisted GPS, WiFi and cellular positioning. Transactions in GIS 13, 2009 – přesnost GPS, Wi-Fi a buňkové polohy telefonu.',
    'R. W. Sinnott: Virtues of the Haversine. Sky and Telescope 68, 1984 – haversinův vzorec.',
    'IANA Time Zone Database (tz) – pravidla časových pásem a letního času, z nichž vychází převod v prohlížeči (Intl).'
  ]
});
