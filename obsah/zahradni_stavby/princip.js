/* ============================================================
   Zahradní stavby – „Jak to funguje“, ochrana dřeva, postup a bezpečnost (texty + schémata, bez DOM)
   ============================================================ */
(function (koren) {
  'use strict';
  const C = 'currentColor', A = '#d9a66a', B = '#a9733f', Z = '#6b4a2b', OK = '#2e8b57', NE = '#c0392b', SL = '#d9480f';
  const obal = (w, h, obsah) => `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif" role="img">${obsah}</svg>`;
  const sipka = (x1, y1, x2, y2, barva) => {
    const u = Math.atan2(y2 - y1, x2 - x1), s = 6;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${barva}" stroke-width="1.6"/><path d="M${x2} ${y2}L${x2 + s * Math.cos(u + 2.7)} ${y2 + s * Math.sin(u + 2.7)}L${x2 + s * Math.cos(u - 2.7)} ${y2 + s * Math.sin(u - 2.7)}Z" fill="${barva}"/>`;
  };
  const SCHEMA = {
    tlak: () => obal(340, 170,
      `<rect x="40" y="15" width="14" height="140" fill="${A}" stroke="${C}"/><rect x="54" y="25" width="120" height="130" fill="${Z}" opacity="0.55"/>` +
      `<path d="M40 25 L40 155 L-0 155" fill="none"/><path d="M200 25 L200 155 L265 155 Z" fill="${NE}" opacity="0.18" stroke="${NE}"/>` +
      [0.25, 0.5, 0.75, 1].map((k) => sipka(200 + 65 * k, 25 + 130 * k, 202, 25 + 130 * k, NE)).join('') +
      `<text x="270" y="160" font-size="11" fill="${NE}">p = K0·γ·h</text><text x="205" y="20" font-size="11" fill="${C}">p(z) = K0·γ·z</text>` +
      `<text x="100" y="95" font-size="11" fill="#fff" text-anchor="middle">zemina γ</text><text x="47" y="168" font-size="10" fill="${C}" text-anchor="middle">stěna</text>` +
      sipka(232, 112, 232, 140, C) + `<text x="238" y="132" font-size="10" fill="${C}">E = K0·γ·h²/2 v h/3</text>`),
    pruhyb: () => obal(340, 130,
      `<rect x="20" y="30" width="22" height="80" fill="${B}" stroke="${C}"/><rect x="298" y="30" width="22" height="80" fill="${B}" stroke="${C}"/>` +
      `<path d="M42 55 Q170 92 298 55" fill="none" stroke="${A}" stroke-width="12"/><path d="M42 55 L298 55" stroke="${C}" stroke-dasharray="4 3" fill="none"/>` +
      [80, 130, 170, 210, 260].map((x) => sipka(x, 20, x, 40, NE)).join('') +
      `<text x="170" y="14" font-size="11" fill="${NE}" text-anchor="middle">q = tlak zeminy na výšku prkna</text>` +
      `<text x="170" y="118" font-size="11" fill="${C}" text-anchor="middle">w = 5·q·L⁴ / (384·E·I) · (1 + kdef),  I = b·t³/12</text>` +
      `<text x="170" y="96" font-size="10" fill="${C}" text-anchor="middle">L = rozteč sloupků</text>`),
    lamely: () => obal(340, 170,
      [0, 1, 2, 3].map((i) => `<rect x="${60 + i * 60}" y="70" width="48" height="10" fill="${A}" stroke="${C}" transform="rotate(-55 ${84 + i * 60} 75)"/>`).join('') +
      `<line x1="20" y1="150" x2="320" y2="150" stroke="${C}"/>` +
      [0, 1, 2, 3, 4].map((i) => `<line x1="${110 + i * 60}" y1="10" x2="${50 + i * 60}" y2="150" stroke="${SL}" stroke-width="1.2" stroke-dasharray="${i % 2 ? '0' : '5 3'}"/>`).join('') +
      `<path d="M60 150 h40" stroke="#555" stroke-width="5" opacity="0.5"/><text x="80" y="165" font-size="10" fill="${C}" text-anchor="middle">stín ℓ</text>` +
      `<text x="250" y="22" font-size="11" fill="${SL}">paprsky v rovině profilu</text><text x="20" y="40" font-size="11" fill="${C}">β = sklon lamely</text>` +
      `<text x="170" y="120" font-size="11" fill="${C}">zastínění = min(1, ℓ / s)</text>`),
    komora: () => obal(340, 160,
      `<rect x="30" y="20" width="16" height="125" fill="${B}" stroke="${C}"/><rect x="294" y="20" width="16" height="125" fill="${B}" stroke="${C}"/>` +
      [0, 1, 2, 3, 4, 5].map((i) => `<rect x="46" y="${25 + i * 20}" width="248" height="14" fill="${A}" stroke="${C}"/>`).join('') +
      [0, 1, 2, 3, 4].map((i) => sipka(170, 52 + i * 20, 200, 44 + i * 20, OK)).join('') +
      `<text x="170" y="157" font-size="11" fill="${OK}" text-anchor="middle">mezery 10–25 mm = přívod vzduchu (aerobní rozklad)</text>`),
  };
  const TEXTY = {
    zahon: [
      { nadpis: 'Zemní tlak v klidu', schema: 'tlak', text: 'Zemina ve vyvýšeném záhonu tlačí na stěny vodorovně. Protože se stěna (skoro) nepohne, počítá se tlak <b>v klidu</b>: p(z) = K0·γ·z, kde K0 = 1 − sin φ (Jákyho vztah), γ je objemová tíha zeminy a z hloubka pod povrchem náplně. Tlak roste lineárně s hloubkou – nejvíc je zatížené spodní prkno. Výslednice na 1 m stěny je E = K0·γ·h²/2 a působí ve třetině výšky. Mokrá zemina po dešti je těžší (γ ≈ 20 kN/m³) a má menší úhel vnitřního tření – volte ji jako bezpečnou variantu.' },
      { nadpis: 'Prkno mezi sloupky = nosník', schema: 'pruhyb', text: 'Každé prkno je nosník mezi sloupky zatížený tlakem zeminy na svou výšku: q = K0·γ·(z₂² − z₁²)/2. Ohyb probíhá kolem slabé osy (I = b·t³/12), proto tloušťka prkna rozhoduje se třetí mocninou – 40 mm prkno je 2,3× tužší než 30 mm. Vlhké dřevo v zemi se dlouhodobě dotvaruje, konečný průhyb je proto (1 + kdef) = 3× okamžitý (třída provozu 3). Stránka hledá největší rozteč sloupků, která vyhoví na ohyb (fm,d = kmod·fm,k/γM) i na průhyb L/N, a podle ní přidá středové sloupky.' },
      { nadpis: 'Středové sloupky, nebo táhla?', text: 'Středový sloupek přenáší tlak ze všech prken svého pole. Buď ho vetkneme hluboko do země (konzola – moment u terénu F·h/3, zapuštění aspoň polovinu výšky), nebo – spolehlivěji – protilehlé sloupky spojíme <b>táhlem</b> (závitová tyč M8 s velkou podložkou těsně pod horní hranou). Pak je sloupek prostý nosník mezi táhlem a zeminou u dna, moment klesne asi na třetinu a síla v táhle je jen F/3. Rohy se drží navzájem samy.' },
      { nadpis: 'Vrstvy náplně', text: 'Klasický „vrstvený“ záhon: dole hrubé větve (drenáž, vzduch, pomalý rozklad), pak jemné větve a štěpka, obrácené drny a listí, polozralý kompost a navrchu zralý kompost se zeminou (osevní vrstva aspoň 20–25 cm). Rozkladem organické hmoty se záhon zahřívá a uvolňuje živiny, ale také <b>sesedá</b> – první rok o 10–20 % výšky. Stránka odhadne pokles a objem na dosypání. Nižší záhony (do 35 cm) plňte jen kompostem a zeminou.' },
      { nadpis: 'Fólie, pletivo a ergonomie', text: 'Nopová fólie (nopy ke dřevu) odděluje vlhkou zeminu od dřeva a nechává za sebou vzduchovou mezeru – prodlužuje životnost stěn. Dno nechte otevřené, voda musí odtékat. Pozinkované pletivo s okem ≤ 13 mm na dně zastaví hraboše a krtky. Výška: stojící 80–95 cm, sedící 45–65 cm (s širokou lištou na sezení), vozíčkář 65–80 cm. Šířka podle dosahu: z obou stran asi 2× dosah ruky (stojící 130 cm, z vozíku 100 cm).' },
    ],
    komposter: [
      { nadpis: 'Proč mezery a komory', schema: 'komora', text: 'Kompostování je aerobní rozklad – mikroorganismy potřebují vzduch, vlhkost a dostatek hmoty, aby se kompost zahřál (50–65 °C hygienizuje semena plevelů). Mezery 10–25 mm mezi lamelami přivádějí vzduch, ale nenechají materiál vypadávat. Ve více komorách se materiál přehazuje: 1. komora se plní, 2. dozrává, 3. je zralý kompost k odběru.' },
      { nadpis: 'Vyjímatelná čela v drážkách', text: 'Čelo komory tvoří prkna zasunutá shora do drážky ze dvou lišt na každém sloupku. Šířka drážky = tloušťka prkna + vůle (2–4 mm na bobtnání mokrého dřeva). Při plnění se prkna přidávají, při vybírání a obracení se vyjmou – není třeba kompost přehazovat přes stěnu. Spodní čelo nese největší tlak kompostu; stránka ho kontroluje jako nosník (tlak v klidu s γ ≈ 8 kN/m³).' },
      { nadpis: 'Objem a umístění', text: 'Komora menší než ~0,5 m³ se špatně zahřívá, větší než ~1,5 m³ se těžko obrací. Kompostér stavte na rostlou zeminu (žížaly, odtok), do polostínu, mimo hranici pozemku. Pletivo na dno chrání před hlodavci. Sloupky odizolujte od země – zemní vrut, kámen pod sloupek, nebo zapuštění do štěrku (ne do betonu).' },
    ],
    pergola: [
      { nadpis: 'Zatížení a kombinace', text: 'Vlastní tíha (lamely, krokve, vaznice) je stálé zatížení G, sníh na konstrukci s = μ1·sk = 0,8·sk podle sněhové oblasti (I = 0,7 … VII = 4,0 kN/m²) je proměnné Q. Únosnost se ověřuje pro 1,35·G + 1,5·S s pevností fm,d = kmod·fm,k/γM (kmod = 0,7 pro krátkodobý sníh ve třídě provozu 3, γM = 1,3) a zvlášť pro samotné G s kmod = 0,5. Průhyb: w = wG·(1 + kdef) + wS, limit L/200 (editovatelné). Vítr, náraz, zavěšená houpačka ani rostliny s plachtou se nepočítají.' },
      { nadpis: 'Krokve, vaznice, sloupy', text: 'Krokev je prostý nosník mezi vaznicemi; vaznice nese reakce krokví ze zatěžovací šířky (půl rozpětí + přesah) mezi sloupy. Počet polí se při volbě „auto“ zvětšuje, dokud vaznice nevyhoví. Sloup se ověřuje na vzpěr (EN 1995-1-1, 6.3.2): s pásky je vzpěrná délka ≈ výška, bez pásků se sloup chová jako konzola (2× výška) a běžná patka vetknutí nezajistí. Osedlání krokve (zářez) má být nejvýš 1/4 výšky krokve.' },
      { nadpis: 'Ztužení a kotvení', text: 'Pergola musí odolat vodorovným silám (vítr, opření). Pásky 45° mezi sloupem a vaznicí (podélně) a sloupem a krokví (příčně) vytvoří rámy. Patky: betonová patka do nezámrzné hloubky 80 cm s ocelovou patkou typu U drží sloup 5–10 cm nad terénem (nestojí ve vodě); zemní vruty jsou rychlé, ale vyžadují soudržnou zeminu; na dlažbu jen patky s deskou a kotvami do betonové desky.' },
      { nadpis: 'Stínění lamelami', schema: 'lamely', text: 'Lamely jsou nekonečná řada stejných pruhů. V rovině kolmé k ose lamel (rovina profilu) dopadá světlo pod <b>úhlem profilu</b> Ω, daným výškou a azimutem Slunce vůči orientaci pergoly. Stín jedné lamely na zemi má délku ℓ = rozsah průmětů jejích čtyř rohů podél paprsku; podíl zastínění je min(1, ℓ/s), kde s je osová rozteč. Krokve stíní ve druhém směru stejným způsobem; celkový průchod ≈ (1 − zlamely)·(1 − zkrokve). Poloha Slunce se počítá knihovnou SunCalc (stejné vztahy má jádro i bez ní), místní čas SEČ/SELČ. Sklon lamel otočený k jihu propouští nízké zimní slunce, k severu ho blokuje – porovnejte tabulku sklonů.' },
      { nadpis: 'Tesařské spoje', text: 'Styk vaznice dávejte vždy nad sloup – přeplátováním (polovina výšky každého dílu, délka plátu ≥ 2× výška, 2 svorníky). Krokve osedlejte na vaznice zářezem, sloup do vaznice čepem nebo úhelníky. Šablony spojů 1:1 vytvoříte na stránce <a href="truhlarske_spoje.html">Šablony truhlářských spojů</a> (přeplátování rohové / křížové / T, čep a dlab).' },
    ],
  };
  const OCHRANA = [
    { nadpis: 'Konstrukční ochrana je první', text: 'Dřevo hnije, když je dlouho mokré. Nejlevnější ochrana je konstrukční: <b>odizolovat od země</b> (patky, kámen, zemní vrut, štěrkové lože, sloup 5–10 cm nad terénem), nechat vodu odtékat (zkosené hlavy sloupů a horní hrany lišt, okapnička, lamely se spádem), čela chránit (čelo nasaje vodu 10× rychleji než bok) a nechat dřevo větrat (mezery, žádné spáry, kde stojí voda).' },
    { nadpis: 'Třídy použití a trvanlivost', text: 'EN 335: venku bez styku se zemí = třída použití 3, ve styku se zemí (záhon, sloupky v zemi) = třída 4. Přirozená trvanlivost jádra (EN 350): akát 1–2, dub 2, modřín a douglaska 3–4, smrk a borovice 4–5. Smrk ve třídě 4 potřebuje tlakovou impregnaci (KDI); nátěr štětcem chrání jen povrch – opakujte každé 2–3 roky. Bělové dřevo je netrvanlivé u všech dřevin.' },
    { nadpis: 'Záhon s jedlými rostlinami', text: 'Na vnitřní stranu záhonu nedávejte přípravky s biocidy – oddělte zeminu fólií. Nepoužívejte staré železniční pražce (kreosot) ani olejové odpady. Piliny a odřezky z KDI řeziva nepalte a nekompostujte – patří do sběru.' },
  ];
  const BEZPECNOST = [
    'Kotoučová pila: ochranné brýle a sluchátka, rozvírací klín a kryt vždy namontované, úzké díly posouvejte posuvnou holí – ruce nikdy v ose kotouče. Řezivo podepřete po celé délce, ať se řez nesevře.',
    'Vrtání a šroubování: dlouhé vruty předvrtejte (praskání), aku šroubovák s omezením momentu; při vrtání do betonu brýle a respirátor.',
    'Výkopy: před kopáním zjistěte vedení sítí (elektro, plyn, voda). Beton je zásaditý – rukavice a brýle.',
    'Pergola: vaznice a krokve zvedejte ve dvou, ze stabilního lešení nebo žebříku; sloupy dočasně zavětrujte ve dvou směrech, dokud nejsou osazené pásky.',
    'Impregnace: rukavice, při stříkání respirátor, větrat. Nenatírat za přímého slunce.',
  ];
  const NARADI = {
    zahon: 'Metr, provázek a kolíky, vodováha, rýč, hrábě, pěch; pila (kotoučová / pokosová), aku šroubovák, vrták 4 mm (předvrtání) a 10 mm (táhla), sponkovačka, nůžky na plech/pletivo.',
    komposter: 'Metr, vodováha, pila, aku šroubovák, vrták 4 mm, rozpěrka (lať tloušťky mezery), palice na zemní vruty a montážní tyč, nůžky na pletivo.',
    pergola: 'Metr a laserová / hadicová vodováha, provázek, rýč nebo vrták do země, míchačka nebo kolečko na beton, kotoučová pila, dláto a palice (přeplátování, osedlání), vrták 13 mm (svorníky M12), aku šroubovák, ráčna, 2 žebříky / lešení, pomocník.',
  };

  const API = { SCHEMA, TEXTY, OCHRANA, BEZPECNOST, NARADI };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.ZSP = API;
})(typeof window !== 'undefined' ? window : globalThis);
