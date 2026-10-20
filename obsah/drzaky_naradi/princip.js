/* ============================================================
   Držáky nářadí – texty „Jak to funguje“ a postupy (HTML řetězce, bez DOM)
   ============================================================ */
(function (koren) {
  'use strict';
  const gridfinity = `
<h3>Princip Gridfinity</h3>
<p>Gridfinity je otevřený modulární systém úložných krabiček (autor Zack Freedman, licence MIT). Vše stojí na mřížce <b>42 × 42 mm</b>
a výškové jednotce <b>7 mm</b>. Krabička N × M × U má vnější půdorys <b>42·N − 0,5</b> a <b>42·M − 0,5 mm</b> (mezi sousedními krabičkami tak zůstane
mezera 0,5 mm) a výšku <b>7·U mm</b> včetně podstavy; nahoře je stohovací lem 4,4 mm, do kterého zapadne podstava další krabičky.</p>
<p>Každá buňka krabičky má vlastní podstavu se zkoseným profilem <b>0,8 / 1,8 / 2,15 mm</b> (45°, svisle, 45°), horní obrys 41,5 × 41,5 mm
s rohem R 3,75. Lůžko podložky má profil <b>0,7 / 1,8 / 2,15 mm</b>, horní obrys 42 × 42 s rohem R 4 a pod ním 0,35 mm vůle.
Krabička dosedne na horní zkosení 45° a na svislé části zůstane vůle 0,25 mm – proto „cvakne“ na místo a nehýbe se, i když je podložka
vytištěná s běžnou nepřesností.</p>
<p>Magnety <b>Ø6 × 2 mm</b> sedí v otvorech Ø6,5 × 2,4 mm ve vzdálenosti 13 mm od středu buňky (rozteč 26 mm, 8 mm od hrany mřížky),
otvory pro šroub M3 jsou ve stejných místech. Rozměry na této stránce odpovídají referenční implementaci
<i>gridfinity-rebuilt-openscad</i> (MIT), která vychází ze specifikace na gridfinity.xyz.</p>
<h3>Postup</h3>
<ol>
<li><b>Změřte zásuvku</b> (vnitřní rozměr) a nechte stránku spočítat počet buněk a okrajovou výplň. Vůle 1 mm na každou osu je typická.</li>
<li><b>Podložku rozdělte</b> na díly podle tiskové plochy. Řezy vedou po hranách buněk, takže díly k sobě přesně lícují; krabičky přes spáru drží díly pohromadě.</li>
<li><b>Krabičky</b>: tiskněte dnem dolů bez podpor, výška vrstvy 0,2 mm, 2–3 perimetry, výplň 10–15 %. Štítek má podporu pod 45°, lopatka je zaoblená, nic dalšího podpory nepotřebuje.</li>
<li><b>Vložky s kapsami</b>: kapsy jsou o vůli větší než nástroj (typicky 0,3–0,5 mm na průměru). Před tiskem velké krabičky si vytiskněte
1:1 list kapes z PDF a nástroje na něj položte – ušetříte filament.</li>
<li><b>Magnety</b> vlepte kapkou vteřinového lepidla. Polaritu vyzkoušejte na jednom páru krabička–podložka, ať se přitahují.</li>
</ol>
<h3>Materiál</h3>
<p>Krabičky a podložky: PLA stačí. Do teplé dílny / auta PETG. Výplň podložky s dnem 15–20 %, první vrstva pečlivě – rovinnost dna rozhoduje o tom, zda budou krabičky sedět.</p>`;

  const stena = `
<h3>Princip French cleat</h3>
<p>Nástěnná lišta (French cleat) má horní hranu seříznutou pod úhlem, typicky <b>45°</b>, a úkos klesá směrem ke stěně. Na zadní straně
každého držáku je protikus – hák, který do drážky mezi úkosem a stěnou zapadne. Váha nářadí držák tlačí ke stěně a dolů, takže drží sám
a dá se kdykoli přesunout. Obě lišty vzniknou z jednoho pásu jediným podélným šikmým řezem.</p>
<h3>Řezný plán a výroba lišt</h3>
<ol>
<li>Z desky (překližka 18 mm, MDF nebo truhlářská deska) nařežte podélně <b>pásy</b> šířky podle plánu (2 × výška lišty − pokles úkosu + prořez).</li>
<li>Na okružní pile nakloňte kotouč na zvolený úhel (45°) a každý pás rozřízněte <b>uprostřed</b> – vzniknou dvě shodné lišty.</li>
<li>Lišty zkraťte na délky z řezného seznamu. Delší stěnu skládejte z více dílů; spoj vždy na sloupku / hmoždince.</li>
<li>Lištu přišroubujte úkosem nahoru, ostrou hranou od stěny, do každého sloupku nebo hmoždinky (rozteč podle plánu). Vodováhou!</li>
</ol>
<div class="pozor"><b>Bezpečnost u okružní pily:</b> šikmý podélný řez je nejrizikovější řez vůbec. Používejte <b>rozvírací klín</b> a kryt kotouče,
podélné pravítko, <b>posunovač</b> (push stick) a přítlačný hřeben (featherboard). Pás veďte vždy mezi kotoučem a pravítkem tak, aby odříznutá
lišta nepadala mezi kotouč a pravítko (riziko zpětného vrhu). Ruce nikdy v ose kotouče, úzké pásy nedořezávejte rukou – jen posunovačem.
Ochranné brýle a chrániče sluchu. Kdo nemá stolní pilu s klínem, nechte si pásy rozříznout v prodejně desek.</div>
<h3>Držáky z 3D tisku</h3>
<p>Držáky s policí (dláta, pilníky, šroubováky, pily, svěrky, kladivo) se tisknou <b>horní plochou na podložku</b>: hák, klín pod policí i drážky
jsou pak bez převisů a bez podpor. Stupňovitý stojánek na vrtáky se tiskne <b>na boku</b> – profil leží na podložce a otvory mají tvar kapky
se střechou 45°, takže se tisknou čistě. Popisky jsou vyryté 0,6 mm do horních ploch.</p>
<ul>
<li>Materiál: <b>PETG</b> (PLA pod trvalým zatížením pomalu teče – creep); 4 perimetry, výplň ≥ 30 %, vrstva 0,2–0,28 mm.</li>
<li>Vůle háku (typicky 0,8 mm) zajistí, že držák jde nasadit i na lištu s nerovným řezem. Vůle nástroje 0,6 mm na šířce / průměru.</li>
<li>Široké držáky se dělí mezi otvory na díly, které se na liště jen přiloží k sobě.</li>
</ul>
<h3>Pegboard háčky</h3>
<p>Háček má dva čtvercové kolíky: horní s nožkou, která zapadne za desku, a dolní rovný, který brání pootočení. Rozteč děr (typicky 25,4 mm
u palcového pegboardu, 38 mm u evropských děrovaných panelů) a průměr děr si změřte – zadané hodnoty jsou typické a dají se upravit.
Tiskne se naplocho, profilem na podložce; kolíky leží na podložce a nemají převis.</p>`;

  koren.DNP = { gridfinity, stena };
})(typeof window !== 'undefined' ? window : globalThis);
