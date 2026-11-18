/* Úhel dopadu krevních stop – obsah panelu „📐 Metoda, literatura, meze“ (vysetrovani/metoda.js) */
MetodaPanel.nastav({
  nastroj: 'krevni_stopy',
  princip: [
    'Kapka krve dopadající šikmo na hladkou rovnou plochu zanechá eliptickou stopu. Čím plošší dopad, tím je elipsa protáhlejší: z poměru šířky a délky eliptické části (bez ocásku a výběžků) se určí úhel dopadu α. Ocásek a výběžky míří ve směru letu, delší osa elipsy dává směr γ v rovině plochy.',
    'Oblast konvergence (2D): průměty drah všech stop na plochu se protínají v oblasti nad zdrojem (nebo pod ním). Nástroj ji hledá jako bod nejmenších čtverců vzdáleností od přímek; průsečíky dvojic tvoří obal.',
    'Oblast původu (3D): z každé stopy vede zpětná přímka proti směru letu pod úhlem α od plochy. Ve společných souřadnicích místnosti (i přes více ploch) se hledá bod nejblíže všem přímkám – obdoba metody provázků. Tangentová metoda dává pro každou stopu výšku z = D · tan α nad bodem konvergence.',
    'Více zdrojů a odlehlé stopy: postupný RANSAC – kandidát je střed nejkratší spojnice dvou přímek, vyhraje ten, ke kterému má nejvíc přímek blíž než práh. Co nepatří k žádnému zdroji s dost stopami, je odlehlé a do výpočtu nevstupuje.',
    'Gravitace: vodorovné průměty drah se protínají nad zdrojem i u zakřivené dráhy; výška se pak dopočítá po parabole zpět pro zadaný rozsah rychlostí dopadu (bez odporu vzduchu).',
    'Nejistota: Monte Carlo – 300× se rozhodí šířka a délka elipsy (σ rozměru) a směr γ (σ směru), pokaždé se znovu najde zdroj. Z mraku bodů vznikne 90% elipsoid (χ², 3 stupně volnosti) a 90% interval výšky.'
  ],
  vzorce: [
    'α = arcsin(š / d)            š = šířka, d = délka eliptické části',
    'z_i = D_i · tan α_i          D_i = vzdálenost stopy od bodu konvergence',
    'P* = argmin Σ dist(P, přímka_i)²   (bod nejblíže všem zpětným přímkám)',
    'z(τ) = z₀ + v·d_z·τ − ½·g·τ²       (zpětná parabola při rychlosti dopadu v)',
    'Fotka šikmo: homografie H ze 4 rohů obdélníku známých rozměrů (např. A4)'
  ],
  predpoklady: [
    'Plochy jsou rovné, hladké a neporézní; stopy na nich nestekly ani nebyly setřeny.',
    'Vybrané stopy pocházejí z jednoho děje a jsou dobře ohraničené (měří se jen eliptická část).',
    'Měřítko (pravítko, ABFO, list A4) leží ve stejné rovině jako stopy; fotka je kolmo, nebo je opravená homografií.',
    'Kapka letí po přímce (základní výpočet) – korekce gravitace je jen přibližná.'
  ],
  meze: [
    'Přímé zpětné dráhy nadhodnocují výšku: skutečná dráha je zakřivená (gravitace, odpor vzduchu) a přímka zpět je tečnou na konci dráhy. Výsledek je horní odhad – viz ukázka „Gravitace“ v tabulce. Korekce gravitace závisí na neznámé rychlosti dopadu.',
    'Chyba úhlu roste u téměř kolmých stop (α nad ~60–70°): elipsa je skoro kruh, směr i úhel jsou nejisté. U malých a velmi plochých stop má velkou relativní chybu šířka.',
    'Drsný, savý nebo strukturovaný povrch tvar stopy deformuje (výběžky, satelity, vsáknutí) – poměr šířka/délka pak neodpovídá úhlu.',
    'Přesnost měření elipsy: chyba 0,1 mm u stopy široké 5 mm mění α o desetiny až jednotky stupňů; zakreslovat bez ocásku, s dostatkem pixelů (šířka stopy aspoň ~20 px).',
    'Perspektiva a objektiv: homografie opraví šikmý pohled na rovinu, ne soudkovité zkreslení objektivu ani zakřivenou plochu.',
    'Výběr stop je úsudek: automatické vyřazení odlehlých stop nenahrazuje zkušenost, výsledek se mění s tím, které stopy vstoupí do výpočtu.',
    'Interval Monte Carlo zahrnuje jen zadaný šum měření, ne chybu modelu. Výsledek je oblast, ne bod; interpretace patří vyškolenému znalci v kontextu celého místa činu.'
  ],
  literatura: [
    'T. Bevel, R. M. Gardner: Bloodstain Pattern Analysis with an Introduction to Crime Scene Reconstruction. 3. vyd., CRC Press, 2008.',
    'S. H. James, P. E. Kish, T. P. Sutton: Principles of Bloodstain Pattern Analysis: Theory and Practice. CRC Press, 2005.',
    'SWGSTAIN (Scientific Working Group on Bloodstain Pattern Analysis): Recommended Terminology. 2009. Na terminologii a postupy v USA dnes navazují OSAC a standardy AAFS Standards Board (ASB) pro BPA.',
    'C. Varney, F. Gittes: Locating the source of projectile fluid droplets. American Journal of Physics 79, 2011 – vliv zakřivení dráhy na zpětný odhad výšky.'
  ]
});
