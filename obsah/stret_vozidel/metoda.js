/* Rekonstrukce střetu vozidel – obsah panelu „📐 Metoda, literatura, meze“ (vysetrovani/metoda.js) */
MetodaPanel.nastav({
  nastroj: 'stret_vozidel',
  princip: [
    'Během krátkého střetu působí mezi vozidly velké vnitřní síly, vnější síly (tření pneumatik) jsou proti nim malé. Celková hybnost obou vozidel ve vodorovné rovině je proto bezprostředně před střetem a po něm stejná. Je to vektorová rovnost – platí zvlášť ve směru x a ve směru y, takže ze dvou rovnic lze určit dvě neznámé: rychlosti obou vozidel před střetem, pokud jsou známé jejich směry.',
    'Rychlosti po střetu se zjistí z dojezdu: vozidlo urazí od bodu střetu ke konečné poloze dráhu d a přitom zpomaluje třením (blokovaná nebo poškozená kola, smyk bokem) nebo jen valivým odporem. Ze stálého zpomalení a plyne u = √(2·a·d), stejně jako u brzdné stopy.',
    'Pokud vozidlo před střetem brzdilo a zanechalo stopu, dopočte se z rychlosti při střetu i rychlost na začátku stopy – stejným vzorcem jako ve stránce Rychlost z brzdné stopy (rychlost na konci stopy = rychlost při střetu).',
    'Když jsou směry příjezdu téměř rovnoběžné (najetí zezadu, čelní srážka v ose), rovnice se stanou závislými a rychlosti z nich určit nejdou. Pak je nutná známá rychlost jednoho vozidla z jiného zdroje (záznam, tachograf, svědek) a druhá se určí z průmětu hybnosti do jeho směru.',
    'Nejistota: každý vstup má meze (± hodnoty, rozsah f a μ). Monte Carlo je rovnoměrně vzorkuje (pevné semínko → opakovatelné), z platných výsledků se berou 2,5 % a 97,5 % kvantily. Citlivost posouvá každý vstup zvlášť na jeho meze a ukazuje, co je třeba měřit nejpečlivěji.',
    'Kontrola plausibility: ztráta kinetické energie při střetu musí být kladná, síla na vozidlo musí mířit proti jejich vzájemnému přibližování, restituce podél síly nesmí být záporná a směr síly (hodinový údaj) má odpovídat místu poškození.'
  ],
  vzorce: [
    'x: m_A·v_A·cos θ_A + m_B·v_B·cos θ_B = m_A·u_A·cos φ_A + m_B·u_B·cos φ_B\ny: m_A·v_A·sin θ_A + m_B·v_B·sin θ_B = m_A·u_A·sin φ_A + m_B·u_B·sin φ_B',
    'řešení (Cramerovo pravidlo), P = Σ m·u (hybnost po střetu):\nm_A·v_A = (P_x·sin θ_B − P_y·cos θ_B) / sin(θ_B − θ_A)\nm_B·v_B = (P_y·cos θ_A − P_x·sin θ_A) / sin(θ_B − θ_A)',
    'dojezd: u = √(2·a·d),  a = g·(f·cos α + sin α·cos(φ − ψ))\nbez sklonu: u = √(2·μ·g·d);  g = 9,81 m/s², α = arctg(sklon/100), ψ = směr stoupání',
    'f: blokovaná kola / smyk = μ povrchu; částečně brzděné = podíl × μ; volně se otáčející kola = 0,01–0,03',
    'začátek brzdné stopy před střetem: v₀ = √(v² + 2·a·s) + a·tₙ/2',
    'Δv = |u − v| (vektorově);  E_ztráta = ½·Σ m·v² − ½·Σ m·u²  (musí být > 0)',
    'restituce podél síly n: e = −(u_A − u_B)·n / (v_A − v_B)·n   (0 ≤ e, u silničních střetů většinou do 0,3)'
  ],
  predpoklady: [
    'Vozidla jsou bodové hmoty v těžištích, střet je okamžitý a obě vozidla se v něm potkají v jednom bodě (bod střetu).',
    'Úhly příjezdu jsou směry pohybu těžišť těsně před střetem (bez smyku do strany), úhly dojezdu směry od bodu střetu ke konečným polohám těžišť.',
    'Dojezd je přímočarý se stálým zpomalením po celé dráze; skutečný součinitel f leží v zadaném rozsahu.',
    'Vnější síly během samotného střetu se zanedbávají; hmotnosti zahrnují posádku a náklad.'
  ],
  meze: [
    'Deformační energie se tu nepočítá: nástroj nemá energetické ekvivalentní rychlosti (EES) ani tuhosti z crash testů. Ztráta kinetické energie slouží jen ke kontrole, že řešení je fyzikálně možné.',
    'Rotace vozidel po střetu a dráhy po oblouku model nepopisuje – část energie se spotřebuje na rotaci a vozidlo se nezastaví na přímce; dojezd se pak podceňuje nebo nadhodnocuje podle situace.',
    'Sekundární nárazy (sloup, svodidla, třetí vozidlo, příkop) během dojezdu výsledek zkreslí – vozidlo se zastaví dřív, než by dovolilo tření. Viz ukázka „MIMO MODEL“ v tabulce: interval pravdu mine.',
    'Součinitel f při dojezdu je nejistý: poškozená a natočená kola, smyk bokem, změna povrchu (krajnice, tráva) – volba stavu kol je úsudek. Rozsahy μ pocházejí z tabulky stránky Rychlost z brzdné stopy (typická rozmezí z literatury, ne naměřené hodnoty).',
    'Přesnost bodu střetu a konečných poloh: chyba 0,5 m v krátkém dojezdu nebo několik stupňů v úhlu může rychlost změnit o desítky procent. U téměř rovnoběžných směrů příjezdu a u velmi rozdílných hmotností (lehké vozidlo proti těžkému) je úloha špatně podmíněná – rychlost lehčího vozidla vychází s velkou nejistotou.',
    'Hmotnosti: pohotovostní hmotnost z technického průkazu + skutečná posádka a náklad (u „hmotnosti v provozním stavu“ v novějších průkazech je řidič 75 kg už započten); neznámý náklad nákladních vozidel je velký zdroj chyby.',
    'Interval Monte Carlo vyjadřuje jen zadané meze vstupů s rovnoměrným rozdělením, ne chybu modelu ani chybné zadání. Výsledky jsou orientační; znalecký posudek z oboru dopravy (měření na místě, deformace, záznamy, simulace) je jiná úroveň práce.'
  ],
  literatura: [
    'R. M. Brach, R. M. Brach: Vehicle Accident Analysis and Reconstruction Methods. SAE International.',
    'L. B. Fricke: Traffic Accident Reconstruction. Northwestern University Traffic Institute, Evanston 1990.',
    'D. Halliday, R. Resnick, J. Walker: Fundamentals of Physics (kapitoly o hybnosti a srážkách) – česky Fyzika, VUTIUM a Prometheus.'
  ]
});
