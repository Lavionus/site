/* ============================================================
   Planetárium – oddíl „Jak to funguje“ (HTML + malá SVG schémata počítaná z modelu)
   PLANPrincip.html(mech) → řetězec HTML
   ============================================================ */
(function (koren) {
  'use strict';
  const P = koren.PLAN;
  const RAD = Math.PI / 180, fmt = P.fmt;
  const n = (x) => (Math.round(x * 100) / 100).toString();
  const svg = (w, h, obsah, popis) => `<figure class="schema"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${popis}" style="max-width:${w * 1.5}px">${obsah}</svg><figcaption>${popis}</figcaption></figure>`;
  const t = (x, y, s, a, v, c) => `<text x="${n(x)}" y="${n(y)}" font-size="${v || 9}" text-anchor="${a || 'middle'}" fill="${c || 'currentColor'}">${s}</text>`;
  const l = (x1, y1, x2, y2, c, w, d) => `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${c || 'currentColor'}" stroke-width="${w || 1}"${d ? ' stroke-dasharray="3 2"' : ''}/>`;
  const slunce = (x, y, r) => `<circle cx="${n(x)}" cy="${n(y)}" r="${r}" fill="#ffcf3a" stroke="#d99a00"/>`;
  /** koule osvětlená zleva/odkud: půlka ke Slunci světlá */
  function koule(x, y, r, smerKeSlunci, barva) {
    const a = smerKeSlunci, ux = Math.cos(a), uy = Math.sin(a), px = -uy, py = ux;
    const A = [x + px * r, y + py * r], B = [x - px * r, y - py * r];
    return `<circle cx="${n(x)}" cy="${n(y)}" r="${r}" fill="#3a3f48"/><path d="M${n(A[0])} ${n(A[1])}A${r} ${r} 0 0 0 ${n(B[0])} ${n(B[1])}Z" fill="${barva || '#9cc3f0'}"/>`;
  }

  function schemaOsa() {
    const cx = 150, cy = 80, R = 58, e = 23.44 * RAD;
    let s = slunce(cx, cy, 11);
    s += `<ellipse cx="${cx}" cy="${cy}" rx="${R + 60}" ry="${R * 0.55}" fill="none" stroke="currentColor" stroke-width="0.6" stroke-dasharray="3 2"/>`;
    const pol = [[0, 'jaro'], [90, 'léto'], [180, 'podzim'], [270, 'zima']];
    for (const [uh, nazev] of pol) {
      const a = (uh + 90) * RAD, x = cx + (R + 60) * Math.cos(a), y = cy + R * 0.55 * Math.sin(a);
      s += koule(x, y, 9, Math.atan2(cy - y, cx - x));
      s += l(x - 15 * Math.sin(e), y + 15 * Math.cos(e), x + 15 * Math.sin(e), y - 15 * Math.cos(e), '#b3261e', 1.4);
      s += t(x, y + (y > cy ? 22 : -16), nazev + ' (sev.)', 'middle', 8);
    }
    return svg(300, 165, s, 'Osa Země míří stále stejným směrem (k Polárce). V červnu je severní pól přikloněn ke Slunci (léto), v prosinci odkloněn (zima) – mechanismus proto osu natáčet nesmí.');
  }
  function schemaMezikolo(mech) {
    const zc = mech.p.zC, g = mech.kola.find((k) => k.vlak === 'zeme' && k.role === 'mezikolo');
    const zi = g ? g.z : 30;
    let s = '';
    const kr = (x, y, r, c, txt2) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c}" stroke-width="1.4"/>` + t(x, y + 3, txt2, 'middle', 9, c);
    const r1 = 24, ri = 24 * zi / zc, W0 = 2 * 24 * 2 + 2 * ri + 20, x1 = Math.max(10, (270 - W0) / 2 + 10) + r1, x2 = x1 + r1 + ri, x3 = x2 + ri + r1, W = Math.max(270, x3 + r1 + 10);
    s += kr(x1, 60, r1, '#2463b0', 'z' + zc) + t(x1, 103, 'pevné (Slunce)', 'middle', 8);
    s += kr(x2, 60, ri, '#888', 'z' + zi) + t(x2, 103, 'mezikolo', 'middle', 8);
    s += kr(x3, 60, r1, '#2463b0', 'z' + zc) + t(x3, 103, 'nosič osy Země', 'middle', 8);
    s += l(x1, 60, x3, 60, 'currentColor', 0.5, true);
    s += t(W / 2, 14, 'ω_Z = ω_r · (1 − z_C / z_Z) = ω_r · (1 − ' + zc + '/' + zc + ') = 0', 'middle', 9);
    return svg(W, 112, s, 'Pevné centrální kolo a kolo Země mají stejný počet zubů; mezikolo jen obrací smysl. Kolo Země se proto vůči podstavci neotočí – osa zůstává rovnoběžná.');
  }
  function schemaSynodicky() {
    const cx = 30, cy = 120, R = 150;
    let s = slunce(cx, cy, 10);
    const a1 = -32 * RAD, a2 = -5 * RAD;
    const E1 = [cx + R * Math.cos(a1), cy + R * Math.sin(a1)], E2 = [cx + R * Math.cos(a2), cy + R * Math.sin(a2)];
    s += `<path d="M${n(cx + R * Math.cos(-40 * RAD))} ${n(cy + R * Math.sin(-40 * RAD))}A${R} ${R} 0 0 1 ${n(cx + R * Math.cos(4 * RAD))} ${n(cy + R * Math.sin(4 * RAD))}" fill="none" stroke="currentColor" stroke-width="0.6" stroke-dasharray="3 2"/>`;
    for (const [E, nazev] of [[E1, 'novoluní'], [E2, 'o 27,3 d později']]) {
      s += `<circle cx="${n(E[0])}" cy="${n(E[1])}" r="7" fill="#4a86d0"/><circle cx="${n(E[0])}" cy="${n(E[1])}" r="26" fill="none" stroke="currentColor" stroke-width="0.4"/>`;
      s += t(E[0], E[1] + 40, nazev, 'middle', 8);
    }
    // Měsíc u E1 směrem ke Slunci, u E2 ve stejném směru v prostoru (siderický oběh), k novoluní chybí úhel
    const smer1 = Math.atan2(cy - E1[1], cx - E1[0]);
    const M1 = [E1[0] + 26 * Math.cos(smer1), E1[1] + 26 * Math.sin(smer1)];
    const M2 = [E2[0] + 26 * Math.cos(smer1), E2[1] + 26 * Math.sin(smer1)];
    const smer2 = Math.atan2(cy - E2[1], cx - E2[0]);
    const M3 = [E2[0] + 26 * Math.cos(smer2), E2[1] + 26 * Math.sin(smer2)];
    s += `<circle cx="${n(M1[0])}" cy="${n(M1[1])}" r="3.5" fill="#bbb"/><circle cx="${n(M2[0])}" cy="${n(M2[1])}" r="3.5" fill="#bbb"/><circle cx="${n(M3[0])}" cy="${n(M3[1])}" r="3.5" fill="none" stroke="#bbb"/>`;
    s += l(E1[0], E1[1], cx, cy, '#d99a00', 0.5, true) + l(E2[0], E2[1], cx, cy, '#d99a00', 0.5, true);
    s += t(M3[0] - 6, M3[1] - 7, '+2,2 d', 'end', 8);
    return svg(230, 175, s, 'Siderický měsíc (27,32 d) = oběh vůči hvězdám. Země se mezitím posune po dráze, a aby Měsíc byl znovu mezi Zemí a Sluncem (novoluní), musí oběhnout ještě kus navíc – synodický měsíc trvá 29,53 d. Za rok: 13,37 siderických = 12,37 synodických + 1.');
  }
  function schemaFaze() {
    const cx = 120, cy = 78, r = 44;
    let s = slunce(14, cy, 9) + t(14, cy + 22, 'Slunce', 'middle', 8);
    for (let k = 0; k < 4; k++) s += l(26, cy - 30 + k * 20, 60, cy - 30 + k * 20, '#d99a00', 0.6);
    s += `<circle cx="${cx}" cy="${cy}" r="9" fill="#4a86d0"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="currentColor" stroke-width="0.4" stroke-dasharray="3 2"/>`;
    const jm = ['nov', 'první čtvrť', 'úplněk', 'poslední čtvrť'];
    for (let k = 0; k < 8; k++) {
      const a = Math.PI + k * 45 * RAD, x = cx + r * Math.cos(a), y = cy - r * Math.sin(a);
      s += koule(x, y, 6, Math.PI, '#eee');
      if (k % 2 === 0) s += t(x + (k === 4 ? 26 : k === 0 ? -6 : 0), y + (k === 2 ? -11 : k === 6 ? 17 : 3), jm[k / 2], k === 0 ? 'end' : k === 4 ? 'start' : 'middle', 8);
    }
    return svg(240, 160, s, 'Slunce vždy osvětluje polovinu Měsíce (světlá polokoule míří k lampě). Ze Země vidíme podle polohy Měsíce na dráze víc nebo méně z osvětlené poloviny – to jsou fáze.');
  }

  function html(mech) {
    const v = mech.vystupy, p = mech.p, Kc = P.K;
    const vm = v.mesic, sid = (P.CILE.mesicAbs).toFixed(5), syn = (P.CILE.mesicSyn).toFixed(5);
    const rz = P.retezovyZlomek(P.CILE.mesicSyn, 8);
    let h = '';
    h += '<h3>Co model ukazuje</h3><p>Tellurium (z lat. <i>tellus</i> = Země) je mechanický model soustavy Slunce–Země–Měsíc. Lampa uprostřed hraje Slunce, rameno nese Zemi kolem dokola a jedna otáčka ramene je jeden <b>tropický rok</b> (365,2422 dne). Na ose Země sedí glóbus se skloněnou osou a nosič Měsíce. Na glóbu je pak vidět střídání ročních období, den a noc, na Měsíci fáze a při náklonu dráhy Měsíce i to, proč zatmění nenastává každý měsíc.</p>';
    h += '<h3>Proč se osa Země s ramenem nenatáčí</h3>' + schemaOsa();
    h += `<p>Kdyby byl glóbus pevně přišroubovaný k ramenu, otočil by se s ním za rok jednou kolem dokola a jeho osa by mířila pořád „ven od Slunce“. Pak by roční období nevznikla. Skutečná osa míří stále ke stejnému místu na obloze, poblíž Polárky. Mechanismus proto musí natočení ramene přesně vyrušit. Na centrálním sloupu sedí <b>nehybné kolo</b> z<sub>C</sub>. S ním zabírá mezikolo na rameni a mezikolo zabírá s kolem na ose Země, které má stejný počet zubů jako to nehybné. Totéž umí řetěz nebo řemínek 1 : 1 mezi dvěma stejnými kolečky.</p>` + schemaMezikolo(mech);
    h += '<h3>Planetový převod a Willisova rovnice</h3>';
    h += `<p>Kola na rameni obíhají spolu s ním, takže jejich otáčky nejde počítat jako u obyčejné převodovky. Pomůže trik: díváme se na mechanismus <b>z ramene</b>. Odtud se pevné centrální kolo točí pozpátku (−1 otáčka za rok) a soukolí na rameni je obyčejná převodovka s poměrem i<sub>0</sub> (každý vnější záběr mění znaménko). Pro výstupní kolo platí <b>Willisova rovnice</b>:</p>`;
    h += '<p style="text-align:center;font-size:1.05em">(ω<sub>výst</sub> − ω<sub>r</sub>) / (ω<sub>C</sub> − ω<sub>r</sub>) = i<sub>0</sub> &nbsp;⇒&nbsp; ω<sub>výst</sub> = ω<sub>r</sub>·(1 − i<sub>0</sub>) &nbsp; (ω<sub>C</sub> = 0)</p>';
    if (vm) {
      const st = mech.vlaky.find((x) => x.id === 'mesic');
      const zl = st.stupne.map(([a, b]) => `${a}/${b}`).join(' · ');
      h += `<p>V tomto návrhu má soukolí Měsíce stupně ${zl}${st.rozvrh.mezi.length ? ' a ' + st.rozvrh.mezi.length + ' mezikolo (obrací smysl)' : ''}, tedy i<sub>0</sub> = ${fmt(vm.i0, 6)}. Nosič Měsíce se proto otočí ${fmt(vm.abs, 6)}× za rok vůči hvězdám a ${fmt(-vm.i0, 6)}× vůči rameni, tedy vůči směru ke Slunci. Tohle druhé číslo udává počet novoluní za rok. Ideál je ${syn}, takže fáze modelu se od skutečnosti rozejde o 1 den za <b>${fmt(vm.denZaRoku, 0)} let</b>.</p>`;
    }
    h += '<h3>Synodický a siderický měsíc</h3>' + schemaSynodicky();
    h += `<p>Proto mechanismus potřebuje poměr ${sid} (oběhy vůči jarnímu bodu = otáčky nosiče Měsíce vůči podstavci), a ne „12 a kousek“. Rozdíl přesně o 1 dodá samo rameno. Pro úplnost: siderický měsíc (vůči hvězdám, ${fmt(Kc.SID, 4)} d) a tropický (vůči jarnímu bodu, ${fmt(Kc.TROP, 4)} d) se liší jen o 7 s kvůli precesi, v modelu je to zanedbatelné.</p>`;
    h += '<h3>Fáze Měsíce a roční období</h3>' + schemaFaze();
    h += `<p>Roční období způsobuje sklon osy ${fmt(p.sklon, 2)}° vůči kolmici k rovině oběhu, ne vzdálenost od Slunce: Země je Slunci nejblíž právě začátkem ledna. V létě dopadají paprsky na severní polokouli strměji a den je delší. Na glóbu je dobře vidět, že v červnu je kolem severního pólu světlo celý den a v prosinci je tam polární noc.</p>`;
    h += '<h3>Proč není zatmění každý měsíc</h3>';
    h += `<p>Dráha Měsíce je k ekliptice skloněná o ${fmt(p.sklonMesice, 2)}°. Při většině novoluní projde Měsíc nad Sluncem nebo pod ním. Zatmění nastane jen tehdy, když je novoluní nebo úplněk poblíž jednoho z <b>uzlů</b>, tedy průsečíků obou drah. To se stává zhruba dvakrát do roka v „sezónách zatmění“. Uzly navíc ustupují proti směru oběhu a jednou je oběhnou za 18,6 roku, takže se sezóny posouvají asi o 19 dní ročně. V modelu sklon obstarává šikmý kotouč, po kterém jezdí tyčka Měsíce, a precesi uzlů vlastní soukolí, které kotouč pomalu otáčí pozpátku (${fmt(P.CILE.uzly, 5)} ot./rok).</p>`;
    h += '<h3>Jak se hledají převody</h3>';
    h += `<p>Poměr ${syn} nejde přesně vyjádřit malými celými čísly. <b>Řetězový zlomek</b> dává jeho nejlepší racionální aproximace: [${rz.cleny.join('; ')}] → ${rz.sblizene.slice(1, 6).map((x) => x.p + '/' + x.q).join(', ')}… Každý sblížený zlomek je nejpřesnější ze všech zlomků s menším jmenovatelem. Čitatel a jmenovatel je pak potřeba rozložit na součin počtů zubů v rozsahu, který se dá vyrobit. Druhá metoda, kterou stránka používá, prochází všechny součiny dvojic zubů: seřadí poměry jedné dvojice a ke každé hledá binárně nejlepší doplněk. U tří stupňů prohledá miliony kombinací, ale díky uspořádání a ořezávání to trvá zlomek sekundy. Chyba se dá přepočítat na čas: relativní chyba × uplynulý čas = o kolik se model rozejde.</p>`;
    h += '<h3>Historie</h3><ul>';
    h += '<li><b>Mechanismus z Antikythéry</b> (asi 2.–1. stol. př. n. l.): bronzová ozubená kola počítala fáze Měsíce, Metonův cyklus (235 lunací = 19 let) a předpovídala zatmění podle cyklu Saros (223 lunací).</li>';
    h += '<li><b>Christiaan Huygens</b> (1682) navrhl pro pařížskou akademii planetárium a převody počítal právě pomocí řetězových zlomků. Je to první známé použití této metody v technice.</li>';
    h += '<li><b>George Graham a Thomas Tompion</b> postavili kolem roku 1704 první model Slunce–Země–Měsíc. <b>John Rowley</b> jej kolem roku 1713 zopakoval pro Charlese Boyla, 4. hraběte z <b>Orrery</b>. Od té doby se pohyblivým modelům planet říká <i>orrery</i>.</li>';
    h += '<li><b>Eise Eisinga</b> postavil v letech 1774–1781 ve Franekeru planetárium ve stropě vlastního obývacího pokoje. Funguje dodnes a je nejstarším stále fungujícím planetáriem na světě.</li>';
    h += '<li>V 19. století se <b>tellurium</b> s lampou a klikou stalo běžnou školní pomůckou. Svítící lampa ukázala dětem den a noc, roční období i fáze Měsíce lépe než jakýkoli obrázek.</li>';
    h += '</ul>';
    h += '<p class="info">Model je didaktický: vzdálenosti a velikosti nejsou v měřítku (ve skutečnosti by Země při Slunci velkém jako lampa Ø' + fmt(p.lampa, 0) + ' mm byla ' + fmt(p.lampa / 109, 2) + ' mm kulička ve vzdálenosti ' + fmt(p.lampa / 2 * 215 / 1000, 1) + ' m). Dráhy jsou kruhové a pohyby rovnoměrné, takže skutečné fáze se od modelu liší až o ±14 h kvůli eliptické dráze Měsíce. Porovnání najdete v simulaci.</p>';
    return h;
  }

  koren.PLANPrincip = { html };
})(typeof window !== 'undefined' ? window : globalThis);
