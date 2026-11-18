/* Ověření pravosti fotografie – obsah panelu „📐 Metoda, literatura, meze“ (vysetrovani/metoda.js) */
MetodaPanel.nastav({
  nastroj: 'pravost_fotky',
  princip: [
    'Soubor se přečte jen v prohlížeči. Z bajtů se spočte otisk SHA-256 a rozebere se struktura: markery JPEG, kvantizační tabulky (DQT), hlavička snímku (SOF, podvzorkování barev), EXIF (IFD0, Exif, GPS, IFD1 s náhledem), XMP a komentáře.',
    'Metadata: hledají se rozpory – software editoru (EXIF Software, XMP CreatorTool a historie, komentář), datum změny jiné než datum pořízení, rozměry v EXIF jiné než skutečné, chybějící pole typická pro fotoaparát, standardní tabulky IJG u souboru, který se hlásí k fotoaparátu. Náhled v EXIF se porovná s obrázkem (po zmenšení) – editor někdy náhled nepřepíše, takže ukazuje stav před úpravou.',
    'Kvantizační tabulky se porovnají s tabulkami IJG pro kvality 1–100. Přesná shoda = soubor uložila knihovna libjpeg (editory, prohlížeče, část aplikací); vlastní tabulky mívají fotoaparáty, telefony a některé programy. Odhad kvality je kvalita IJG s nejbližší tabulkou.',
    'Dvojitá komprese: z dekódovaného obrázku se na mřížce 8×8 spočtou DCT koeficienty jasu a vydělí krokem poslední tabulky. Po jedné kompresi je histogram každé frekvence hladký; po dvou kompresích s hrubším prvním krokem v něm periodicky chybějí hodnoty (propady).',
    'ELA (error level analysis): obrázek se znovu „uloží“ jako JPEG ve zvolené kvalitě (vlastní simulace ztrátové části JPEG se standardními tabulkami) a zobrazí se zesílený rozdíl. Automatické hledání projde kvality 60–95: oblast s jinou historií komprese (např. vložená z jiného souboru) se po přeuložení mění jinak než okolí; chyba se vztahuje k textuře bloku, aby hrany nebyly samy podezřelé.',
    'Šum: reziduál = jas minus medián 3×3 (zbude šum a jemná textura). Odhad šumu v blocích 32×32 podle Immerkæra (maska Laplaceova typu, medián místo průměru). Podezřelé je místo výrazně hladší než jeho okolí – výplň, rozmazání nebo objekt bez šumu senzoru.',
    'Klonování (copy-move): bloky 16×16 s krokem 1 px (obrázek nad 800 px se zmenší); příznak bloku = 16 průměrů podbloků 4×4 bez průměru bloku. Bloky se seřadí lexikograficky, porovnají se sousedé v pořadí a shody se seskupí podle posunu. Klon = mnoho shodných dvojic se stejným posunem tvořících souvislou oblast; ploché bloky a bloky bez struktury podbloků (jednolitá plocha jen se šumem – shodovaly by se náhodně) se vynechají.'
  ],
  vzorce: [
    'tabulka IJG(q):  S = q < 50 ? ⌊5000/q⌋ : 200 − 2q\nT[i] = min(255, max(1, ⌊(Z[i]·S + 50)/100⌋)),  Z = standardní tabulka (ITU-T T.81, příloha K)',
    'ELA(x, y) = (|R − R′| + |G − G′| + |B − B′|) / 3,  ′ = po kompresi JPEG v kvalitě q\nblok b:  r_b = E_b / (textura_b + 1),  r̃ = medián 3×3 bloků\npodezřelé:  r̃_b ≥ 2,8 · medián(r̃)  a  Ẽ_b ≥ 1;  oblast ≥ 2 bloky 16×16;  q ∈ {60, 70, 75, 80, 85, 90, 95}',
    'šum (Immerkær):  N = [1 −2 1; −2 4 −2; 1 −2 1],  σ_b = medián|I * N| / (0,6745 · 6)\npodezřelé:  σ_b < 0,5 · medián(σ v okolí 5×5 bloků);  oblast ≥ 3 bloky 32×32',
    'copy-move:  f = (m_ij − m),  i, j = 1…4  (průměry podbloků 4×4)\nblok se posuzuje, jen když σ bloku ≥ 5 a RMS(f) ≥ 6\nshoda:  max_k |f_k − g_k| ≤ 2,2,  |posun| ≥ 32 px\nklon:  ≥ 300 dvojic se shodným posunem (±2 px) v souvislé oblasti',
    'dvojitá kvantizace:  h_k(n) = #{bloky : round(DCT_k / Q_k) = n},  k = prvních 9 frekvencí AC, Q_k ≥ 2\npropad:  h(n) < 0,5 · min(h(n−1), h(n+1)),  sousedé ≥ 30\nnalezeno:  propadů ≥ 3 a ≥ 20 % posuzovaných přihrádek',
    'náhled EXIF:  oříznutí černých pruhů, obrázek zmenšený na velikost náhledu\nrozpor:  |poměr stran| > 3 %,  průměrná odchylka > 12  nebo  max. odchylka v okně 6×6 > 30 (0–255)'
  ],
  predpoklady: [
    'Zkoumá se originální soubor (nebo jeho přesná kopie se shodným otiskem), ne snímek obrazovky ani překomprimovaná kopie.',
    'Analýzy pixelů běží na obrázku v uložené orientaci; prohlížeč dekóduje JPEG standardně (rozdíl dekodérů je ±1 úroveň a výsledky prakticky nemění).',
    'ELA a dvojitá komprese mají smysl jen u JPEG; u PNG/WebP se počítá jen šum a klonování. HEIC většina prohlížečů (Chrome, Firefox) dekódovat neumí.'
  ],
  meze: [
    'Nenalezení stop úpravy NENÍ důkaz pravosti. Pečlivá úprava (přeuložení s převzorkováním, přidaný šum, úprava ve vysoké kvalitě, přepis metadat) nemusí zanechat nic, co by tyto metody zachytily.',
    'Sociální sítě a messengery (Facebook, Instagram, WhatsApp, Messenger, X…) metadata mažou a fotky zmenšují a překomprimují – stopy úprav i originality se tím ztrácejí. Metadata také jde snadno přepsat (ExifTool), jejich shoda proto pravost nedokazuje.',
    'ELA má hodně falešných poplachů: jasné jsou vždy ostré hrany, jemné textury a sytě barevné plochy; jednolité plochy (obloha, zdi) jsou naopak tmavé, i když byly upravené. V tabulce níže je vidět, že automatické hledání dává falešné oblasti u silně překomprimovaného obrázku (60 → 85), nevidí hladkou výplň (rozmazané místo nemá co „chybovat“) ani kopii z téhož obrázku (má stejnou historii komprese) – na klonování je samostatná analýza.',
    'Šum: textura, rozostření (hloubka ostrosti), pohyb a komprese mění odhad šumu stejně jako úprava. Odhalí se jen hladké místo v zašuměném okolí; velká plocha nebo celkově upravený obrázek ne.',
    'Klonování: opakující se struktury (okna, dlaždice, plot, text) dávají falešné shody; klon otočený, zrcadlený nebo zvětšený tato bloková metoda nenajde, stejně jako klon na ploše bez textury.',
    'Dvojitá komprese se pozná jen při zarovnané mřížce a hrubším prvním kroku (první uložení v nižší kvalitě). Ořez o počet pixelů, který není násobkem 8, zmenšení nebo jemnější první krok stopu smažou. Dvojitá komprese sama znamená jen přeuložení, ne úpravu obsahu.',
    'Obrázky vytvořené umělou inteligencí (generované nebo dokreslené) tyto metody spolehlivě neodhalí – celý generovaný obrázek se uloží najednou, takže v něm není místo s odlišnou historií komprese, a vzhled šumu i textury fotografie generátory napodobí. Nástroj žádný detektor AI neobsahuje.',
    'Nástroj nedělá identifikaci konkrétního fotoaparátu podle šumu senzoru (PRNU) – ta vyžaduje referenční snímky z daného přístroje.',
    'Prahy automatických indicií (ELA, šum, klon, dvojitá komprese) byly nastaveny na syntetických ukázkách; ověření níže je doplněno o jiné scény se stejnými úpravami, ale na skutečných fotografiích a skutečných úpravách nástroj ověřen nebyl.'
  ],
  literatura: [
    'H. Farid: Photo Forensics. MIT Press, 2016 – přehled metod: metadata, náhledy EXIF, kvantizační tabulky, dvojitá komprese, šum, klonování.',
    'A. C. Popescu, H. Farid: Statistical Tools for Digital Forensics. Information Hiding Workshop, 2004 – periodické artefakty v histogramech DCT po dvojité kompresi JPEG.',
    'H. Farid: Exposing Digital Forgeries From JPEG Ghosts. IEEE Transactions on Information Forensics and Security, 2009 – přeuložení ve více kvalitách odhalí oblast s jinou historií komprese (princip automatického hledání v ELA).',
    'J. Fridrich, D. Soukal, J. Lukáš: Detection of Copy-Move Forgery in Digital Images. Digital Forensic Research Workshop (DFRWS), 2003 – blokové příznaky, lexikografické řazení, seskupení podle posunu.',
    'J. Immerkær: Fast Noise Variance Estimation. Computer Vision and Image Understanding, 1996 – odhad rozptylu šumu maskou Laplaceova typu.',
    'ITU-T T.81 | ISO/IEC 10918-1 (JPEG) – markery, DCT, kvantizace, standardní tabulky (příloha K); Independent JPEG Group: libjpeg – škálování tabulek podle kvality.',
    'CIPA DC-008 (Exif) – struktura a význam polí EXIF včetně náhledu v IFD1.'
  ]
});
