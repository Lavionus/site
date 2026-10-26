// Definice tiskopisů: každá stránka = vysvětlení (`info`) + vestavěné vzory šablon (`vzory`),
// případně funkce `hodnoty(stav, J, sablona)`, která dopočítá údaje označené `vypocet` (fond, částka slovy…).
// Šablona je čistě datová – uživatel ji v editoru mění a ukládá; tvar viz TISK_JADRO.normalizujSablonu.
(function (koren) {
  'use strict';

  const S = (id, nazev, sirka, x) => Object.assign({ id, nazev, sirka }, x);          // sloupec
  const U = (id, popisek, sirka = 0, x) => Object.assign({ id, popisek, sirka }, x);  // údaj v záhlaví
  const N = (id, popisek) => ({ id, popisek, typ: 'nadpis' });                         // mezititulek
  const ZLOM = id => ({ id, popisek: '', typ: 'zlom' });                               // nový list
  const CISLO = S('c', 'Poř. č.', 7, { cislo: true });
  const ZAMESTNANCI = popisek => ({ popisek: popisek || 'Zaměstnanci – jeden na řádek (každý dostane svůj list)', naOsobu: 'zamestnanec' });

  const DEF = {

    // ======================================================================= BOZP
    kniha_urazu: {
      info: `
        <p><b>Co kniha musí obsahovat:</b> jméno postiženého, datum a čas, místo, činnost, celkový počet zraněných, druh zranění
        a zraněnou část těla, popis úrazového děje, druh úrazu podle § 2, zdroje a příčiny, jména svědků a kdo údaje zapsal
        (NV 322/2025 Sb., § 3 odst. 1 a–l). Starší nařízení č. 201/2010 Sb. bylo k 1. 1. 2026 zrušeno – odpadl
        údaj o počtu odpracovaných hodin před úrazem.</p>
        <p><b>Jak tisknout:</b> A4 na šířku, nejlépe jednostranně a svázat; titulní list uvádí počet očíslovaných stran,
        aby se nedaly listy nepozorovaně vyměnit. Nepovinné sloupce zapnete v Rozvržení.</p>`,
      vzory: {
        kniha: {
          nazev: 'Kniha úrazů', orientace: 'na_sirku', vyskaRadku: 17, stran: 10, titulni: true, pouceni: true, cislovat: true,
          predpis: 'nařízení vlády č. 322/2025 Sb., § 3 odst. 1 (platí od 1. 1. 2026)',
          titulniRadky: ['Kniha založena dne', 'Kniha uzavřena dne', 'Odpovědná osoba (jméno, funkce)', 'Uložení knihy (místo)'],
          sloupce: [
            CISLO,
            S('jmeno', 'Jméno a příjmení postiženého zaměstnance', 22, { znak: 'a' }),
            S('kdy', 'Datum a čas úrazu', 14, { znak: 'b' }),
            S('misto', 'Místo, kde k úrazu došlo', 19, { znak: 'c' }),
            S('cinnost', 'Činnost, při které k úrazu došlo', 20, { znak: 'd' }),
            S('pocet', 'Počet zraněných osob', 10, { znak: 'e' }),
            S('zraneni', 'Druh zranění a zraněná část těla', 20, { znak: 'f' }),
            S('popis', 'Popis úrazového děje', 37, { znak: 'g' }),
            S('druh', 'Druh úrazu (§ 2 a–d)', 10, { znak: 'h' }),
            S('zdroj', 'Zdroje úrazu', 16, { znak: 'i' }),
            S('priciny', 'Příčiny úrazu', 16, { znak: 'j' }),
            S('svedci', 'Jména svědků', 18, { znak: 'k' }),
            S('zapsal', 'Zapsal – jméno a pracovní zařazení', 19, { znak: 'l' }),
            S('datumZapisu', 'Datum zápisu', 11, { skryty: true }),
            S('zaznam', 'Záznam o úrazu odeslán (datum)', 13, { skryty: true }),
          ],
          pouceniText: `# Pokyny k vedení knihy úrazů
Zaměstnavatel vede evidenci o **všech** úrazech v knize úrazů, i když jimi nebyla způsobena pracovní neschopnost (§ 105 zákoníku práce, nařízení vlády č. 322/2025 Sb.). Písmena v záhlaví sloupců odpovídají § 3 odst. 1 písm. a)–l).

## Druh úrazu podle § 2 (sloupec h)
a | smrtelný pracovní úraz – zaměstnanec zemřel nejpozději do 1 roku od úrazu
b | závažný pracovní úraz – hospitalizace delší než 5 po sobě jdoucích kalendářních dnů (nebo se předpokládá)
c | úraz s dočasnou pracovní neschopností delší než 3 kalendářní dny (není-li a ani b)
d | úraz bez pracovní neschopnosti nebo s pracovní neschopností nejvýše 3 kalendářní dny

## Další povinnosti
- Druh zranění a zraněná část těla se uvádí podle přílohy č. 1 nařízení (klasifikace ESAW), je-li známa.
- U úrazů kategorie a), b) a c) se navíc sepisuje **záznam o úrazu**; od roku 2026 se podává elektronicky.
- Byl-li zaměstnanec vyslán nebo dočasně přidělen k jinému zaměstnavateli, zapisují úraz do knihy úrazů oba zaměstnavatelé (§ 3 odst. 2).
- Na žádost vydá zaměstnavatel zaměstnanci potvrzenou kopii nebo výpis údajů o jeho úrazu (§ 3 odst. 3).
- Zápisy nepřepisujte ani nevytrhávejte listy – chybu přeškrtněte tak, aby zůstala čitelná, a připojte opravu s datem a podpisem.`,
        },
      },
    },

    zaznam_urazu: {
      info: `
        <p><b>K čemu je:</b> záznam o pracovním úrazu se od roku 2026 podává <b>elektronicky</b> přes portál Státního úřadu
        inspekce práce. Tento formulář je pracovní koncept pro sběr údajů na místě – osnova odpovídá náležitostem
        z přílohy č. 3 nařízení vlády č. 322/2025 Sb. (části I–XV). Údaje pak přepíšete do elektronického formuláře.</p>
        <p>Záznam se sepisuje u úrazu s pracovní neschopností delší než 3 kalendářní dny a u závažného a smrtelného úrazu.
        Kódy druhu zranění a zraněné části těla jsou v příloze č. 1 (ESAW).</p>`,
      vzory: {
        koncept: {
          nazev: 'Záznam o pracovním úrazu – koncept', rezim: 'doklad',
          predpis: 'osnova podle přílohy č. 3 NV č. 322/2025 Sb. – záznam se podává elektronicky',
          udaje: [
            N('n1', 'I. Zaměstnavatel zraněného'),
            U('zamJmeno', 'Název / jméno', 67), U('zamIco', 'IČO (dat. nar.)', 33),
            U('zamAdresa', 'Adresa sídla / odštěpného závodu', 67), U('zamNace', 'Ekonomická činnost (CZ-NACE)', 33),
            N('n2', 'II. Subjekt, na jehož pracovišti úraz nastal (jde-li o jiný subjekt)'),
            U('subJmeno', 'Název / jméno', 67), U('subIco', 'IČO', 33),
            U('subAdresa', 'Adresa', 67), U('subNace', 'CZ-NACE', 33),
            N('n3', 'III. Zraněný zaměstnanec'),
            U('zrJmeno', 'Jméno a příjmení', 50), U('zrNar', 'Datum narození', 25), U('zrPohlavi', 'Pohlaví', 25),
            U('zrObcanstvi', 'Státní občanství', 33), U('zrAdresa', 'Adresa pobytu / doručovací', 67),
            U('zrVztah', 'Vztah k zaměstnavateli', 33), U('zrOd', 'Den vzniku právního vztahu', 33), U('zrIsco', 'Druh práce (CZ-ISCO)', 33),
            U('zrDpn', 'Doba dočasné pracovní neschopnosti', 100),
            N('n4', 'IV.–VI. Činnost a místo úrazu'),
            U('cinnost', 'IV. Činnost, při které úraz nastal', 100, { radku: 2 }),
            U('mistoAdresa', 'V. Adresa pracoviště / místa úrazu', 100),
            U('mistoChar', 'VI. Charakteristika pracoviště / místa úrazu', 100),
            N('n5', 'VII. Údaje o úrazu'),
            U('druh', 'Druh úrazu (§ 2 a–d)', 33), U('kdy', 'Datum a čas úrazu', 33), U('umrti', 'Datum úmrtí', 33),
            U('zraneni', 'Druh zranění', 50), U('cast', 'Zraněná část těla', 50),
            U('pocet', 'Celkový počet zraněných', 50), U('hromadny', 'Hromadný úraz (ano / ne)', 50),
            U('zdroj', 'Zdroj úrazu', 50), U('pricina', 'Příčina úrazu', 50),
            ZLOM('z1'),
            N('n6', 'VIII. Popis úrazového děje, místa, příčin a okolností'),
            U('popis', '', 100, { radku: 8 }),
            N('n7', 'IX.–XI. Kontroly a porušené předpisy'),
            U('alkohol', 'IX. Kontrola alkoholu a výsledek', 50), U('latky', 'X. Jiné návykové látky a výsledek', 50),
            U('porusene', 'XI. Porušené předpisy a kdo je porušil', 100, { radku: 2 }),
            N('n8', 'XII. Opatření k zabránění opakování úrazu'),
            U('opatreni', '', 100, { radku: 3 }),
            N('n9', 'XIII. Vyjádření'),
            U('vyjZraneny', 'Zraněného', 100, { radku: 3 }),
            U('vyjSvedci', 'Svědků', 100, { radku: 3 }),
            U('vyjZastupce', 'Zástupce zaměstnanců pro BOZP / odborové organizace', 100, { radku: 2 }),
            N('n10', 'XIV. Osoba oznamující úraz za zaměstnavatele'),
            U('oznJmeno', 'Jméno', 50), U('oznKontakt', 'Telefon, e-mail', 50), U('oznZarazeni', 'Pracovní zařazení', 100),
            N('n11', 'XV. Vyhotovení'),
            U('vyhotoveno', 'Datum vyhotovení', 50),
          ],
          podpisy: ['Zraněný', 'Zástupce pro BOZP / odborů', 'Za zaměstnavatele'],
        },
      },
    },

    prezencni_listina: {
      info: `
        <p><b>K čemu slouží:</b> zaměstnavatel musí zajistit školení o BOZP a prokázat jeho obsah a účast
        (§ 103 odst. 2 a 3 ZP). Prezenční listina s osnovou a podpisy účastníků i školitele je běžný doklad pro kontrolu inspekce práce.</p>
        <p><b>Tip:</b> do pole <i>Účastníci</i> (📝 Údaje) vložte seznam jmen – jedno na řádek, třeba z Excelu – a předvyplní se.</p>`,
      vzory: {
        skoleni: {
          nazev: 'Prezenční listina ze školení', vyskaRadku: 10, cislovat: true, minRadku: 20,
          predpis: '§ 103 odst. 2 a 3 zákoníku práce; školení PO dle vyhlášky č. 246/2001 Sb.',
          seznam: { popisek: 'Účastníci – jeden na řádek (nepovinné)', doSloupce: 'jmeno' },
          udaje: [U('druh', 'Druh školení', 50, { vychozi: 'Školení BOZP a PO – periodické' }), U('datum', 'Datum', 25, { typ: 'date' }), U('cas', 'Čas a rozsah', 25),
            U('misto', 'Místo', 50), U('skolitel', 'Školitel (jméno, odborná způsobilost)', 50), U('tema', 'Obsah školení', 100, { radku: 2 })],
          sloupce: [S('c', 'Č.', 6, { cislo: true }), S('jmeno', 'Příjmení a jméno', 40), S('zarazeni', 'Pracovní zařazení / pracoviště', 34),
            S('oscislo', 'Osobní číslo', 14, { skryty: true }), S('test', 'Test / ověření znalostí', 14, { skryty: true }), S('podpis', 'Podpis', 30)],
          zaver: 'Svým podpisem potvrzuji, že jsem se školení zúčastnil(a), jeho obsahu jsem porozuměl(a) a budu se jím řídit.',
          podpisy: ['Podpis školitele'],
        },
      },
    },

    karta_oopp: {
      info: `
        <p><b>K čemu slouží:</b> zaměstnavatel poskytuje osobní ochranné pracovní prostředky podle vyhodnocení rizik
        (§ 104 ZP, NV 390/2021 Sb.) a zaměstnanec je povinen je používat. Karta s podpisy dokládá, co a kdy převzal
        a že byl poučen o používání.</p>
        <p>Do pole <i>Zaměstnanci</i> vložte seznam jmen – pro každého vznikne vlastní karta.</p>`,
      vzory: {
        karta: {
          nazev: 'Osobní karta výdeje OOPP', vyskaRadku: 9,
          predpis: '§ 104 zákoníku práce, nařízení vlády č. 390/2021 Sb.',
          seznam: ZAMESTNANCI('Zaměstnanci – jeden na řádek (každý dostane svou kartu)'),
          udaje: [U('zamestnanec', 'Zaměstnanec', 0, { vypocet: true }), U('oscislo', 'Osobní číslo'), U('pracoviste', 'Pracoviště / profese'), U('velikosti', 'Velikosti (oděv / obuv / rukavice)', 100)],
          sloupce: [S('datum', 'Datum výdeje', 13), S('oopp', 'Druh OOPP (název, typ, norma)', 40), S('velikost', 'Velikost', 10), S('ks', 'Počet ks', 8),
            S('doba', 'Doba použití / výměna', 14), S('vraceno', 'Datum vrácení', 13), S('podpis', 'Podpis zaměstnance', 18), S('vydal', 'Vydal', 14)],
          zaver: 'Podpisem potvrzuji převzetí uvedených OOPP a poučení o jejich používání, údržbě a kontrole. Beru na vědomí povinnost je při práci používat.',
        },
      },
    },

    kontrolni_list: {
      info: `
        <p><b>Kontrolní list</b> = seznam bodů s kolonkami vyhovuje / nevyhovuje, zjištění a opatření. Body upravíte
        v ✏️ Upravit šablonu → <i>Předtištěné řádky</i>: jeden řádek = jeden bod, <b># Nadpis</b> vloží oddíl.
        Svůj seznam si uložte jako vlastní šablonu, ať ho příště nemusíte psát znovu.</p>
        <p>Vzorové body jsou obecné – doplňte je podle vyhodnocení rizik a vlastních předpisů.</p>`,
      vzory: {
        bozp: {
          nazev: 'Kontrolní list BOZP a PO', vyskaRadku: 8, cislovat: true,
          predpis: 'prověrka BOZP (§ 108 odst. 5 zákoníku práce) – vzorový seznam bodů',
          udaje: [U('pracoviste', 'Pracoviště', 50), U('datum', 'Datum', 25, { typ: 'date' }), U('kontroloval', 'Kontroloval', 25)],
          sloupce: [CISLO, S('bod', 'Kontrolovaný bod', 48), S('ano', 'Vyho­vuje', 9), S('ne', 'Nevy­hovuje', 9), S('zjisteni', 'Zjištění', 30), S('opatreni', 'Opatření, termín, odpovídá', 30)],
          predvyplnene: `# Pracoviště a komunikace
Únikové cesty a východy volné, nepoškozené a označené
Podlahy bez nerovností, kluzkých míst a překážek
Dostatečné osvětlení pracovišť a komunikací
Bezpečnostní značky a označení nebezpečných míst
# Stroje, nářadí, elektro
Ochranné kryty a bezpečnostní prvky strojů na místě a funkční
Nářadí a elektrické spotřebiče bez viditelného poškození
Platné revize elektrické instalace a spotřebičů
# OOPP, hygiena, první pomoc
Zaměstnanci používají přidělené OOPP
Lékárnička vybavená a přístupná
Čisté sociální zařízení, zajištěná pitná voda
# Požární ochrana
Hasicí přístroje přístupné a s platnou kontrolou
Požární poplachové směrnice a evakuační plán vyvěšeny
# Dokumentace
Školení BOZP a PO zaměstnanců v platnosti
Kniha úrazů vedena a přístupná
Návody k obsluze a pracovní postupy na pracovišti`,
          podpisy: ['Kontroloval', 'Převzal (vedoucí pracoviště)'],
        },
        vozidlo: {
          nazev: 'Kontrola vozidla před jízdou', vyskaRadku: 8, cislovat: true,
          predpis: 'kontrola technického stavu vozidla řidičem – vzorový seznam bodů',
          udaje: [U('vozidlo', 'Vozidlo, RZ', 50), U('ridic', 'Řidič', 25), U('datum', 'Datum', 25, { typ: 'date' }), U('tacho', 'Stav tachometru', 50)],
          sloupce: [CISLO, S('bod', 'Kontrolovaný bod', 48), S('ano', 'V pořádku', 10), S('ne', 'Závada', 10), S('zjisteni', 'Popis závady', 30), S('opatreni', 'Opatření / nahlášeno komu', 28)],
          predvyplnene: `Doklady (osvědčení o registraci, doklad o pojištění, řidičský průkaz)
Pneumatiky – hloubka dezénu, tlak, poškození
Osvětlení, směrovky, brzdová světla
Brzdy – provozní a parkovací
Stěrače a ostřikovače
Hladiny kapalin (olej, chladicí, brzdová, ostřikovače)
Povinná výbava (lékárnička, výstražná vesta a trojúhelník, rezerva)
Zrcátka a skla bez poškození
Karoserie – nová poškození
Upevnění nákladu
Kontrolky po nastartování`,
          podpisy: ['Řidič'],
        },
        prazdny: {
          nazev: 'Kontrolní list', vyskaRadku: 8, cislovat: true,
          udaje: [U('predmet', 'Předmět kontroly', 100), U('datum', 'Datum', 50, { typ: 'date' }), U('kontroloval', 'Kontroloval', 50)],
          sloupce: [CISLO, S('bod', 'Kontrolovaný bod', 48), S('ano', 'Ano', 8), S('ne', 'Ne', 8), S('zjisteni', 'Zjištění', 32), S('opatreni', 'Opatření', 30)],
          podpisy: ['Kontroloval'],
        },
      },
    },

    // ======================================================================= Požární ochrana a provoz
    pozarni_kniha: {
      info: `
        <p><b>Požární kniha</b> (§ 37 vyhlášky č. 246/2001 Sb.) slouží k záznamům o důležitých skutečnostech v PO:
        preventivní požární prohlídky, školení zaměstnanců, odborná příprava preventivních požárních hlídek a preventistů,
        vzniklé požáry, cvičné požární poplachy, kontroly dokumentace PO. Lze do ní zapisovat i kontroly, údržbu a opravy
        požárně bezpečnostních zařízení.</p>
        <p><b>Hasicí přístroje</b> se kontrolují nejméně jednou za rok, po každém použití a při pochybnosti o provozuschopnosti
        (§ 9 odst. 2 vyhlášky). Doklad o kontrole vystavuje osoba, která kontrolu provedla.</p>`,
      vzory: {
        kniha: {
          nazev: 'Požární kniha', orientace: 'na_sirku', vyskaRadku: 14, stran: 10, titulni: true, pouceni: true, cislovat: true,
          predpis: '§ 37 vyhlášky č. 246/2001 Sb., o požární prevenci',
          titulniRadky: ['Objekt / pracoviště', 'Kniha založena dne', 'Osoba odpovědná za vedení'],
          sloupce: [CISLO, S('datum', 'Datum', 12), S('druh', 'Druh záznamu (prohlídka, školení, požár, poplach, kontrola…)', 30),
            S('obsah', 'Obsah záznamu, zjištěné nedostatky', 60), S('opatreni', 'Opatření a termín', 34), S('odstraneno', 'Odstraněno dne', 14), S('zapsal', 'Zapsal (jméno, podpis)', 26)],
          pouceniText: `# Co se do požární knihy zapisuje
Podle § 37 vyhlášky č. 246/2001 Sb. se do požární knihy zaznamenávají důležité skutečnosti týkající se požární ochrany, zejména:
- provedené preventivní požární prohlídky a zjištěné nedostatky,
- školení zaměstnanců a osob podle § 23 odst. 4 a 5,
- odborná příprava preventivních požárních hlídek a preventistů požární ochrany,
- vzniklé požáry,
- cvičné požární poplachy,
- kontroly dokumentace požární ochrany.

Zapisovat lze i kontroly, údržbu a opravy požárně bezpečnostních zařízení – záznam pak slouží jako doklad, pokud předpis nebo výrobce nestanoví jinak.`,
        },
        php: {
          nazev: 'Evidence kontrol hasicích přístrojů', orientace: 'na_sirku', vyskaRadku: 9, cislovat: true,
          predpis: '§ 9 vyhlášky č. 246/2001 Sb. – kontrola nejméně 1× za rok',
          udaje: [U('objekt', 'Objekt / adresa', 67), U('rok', 'Rok', 33)],
          sloupce: [CISLO, S('umisteni', 'Umístění', 30), S('druh', 'Druh (CO₂, práškový, pěnový…)', 22), S('typ', 'Výrobce a typové označení', 26),
            S('vyrc', 'Výrobní číslo nádoby', 18), S('datum', 'Datum kontroly', 14), S('vysledek', 'Výsledek / provozuschopný', 20),
            S('pristi', 'Příští kontrola', 14), S('provedl', 'Kontrolu provedl (jméno, podpis)', 30)],
        },
      },
    },

    provozni_denik: {
      info: `
        <p><b>Provozní deníky a evidence kontrol</b> dokládají, že zařízení je pravidelně kontrolováno a závady se řeší.
        Rozsah a četnost kontrol určuje hlavně návod výrobce, provozní řád a předpisy pro dané zařízení.
        Vyhrazená technická zařízení (elektrická, plynová, tlaková, zdvihací) řeší zákon č. 250/2021 Sb. a jeho prováděcí nařízení vlády.</p>
        <p>Body denní kontroly vozíku i položky přehledu revizí jsou vzorové – upravte je v ✏️ Upravit šablonu.</p>`,
      vzory: {
        kotelna: {
          nazev: 'Provozní deník kotelny', orientace: 'na_sirku', vyskaRadku: 8, stran: 4,
          predpis: 'provozní deník podle návodu výrobce a provozního řádu kotelny',
          udaje: [U('kotelna', 'Kotelna / objekt', 50), U('kotel', 'Kotel (typ, výr. č.)', 50), U('obsluha', 'Obsluha (jména)', 100)],
          sloupce: [S('datum', 'Datum', 11), S('cas', 'Čas', 8), S('tVystup', 'Teplota výstupu °C', 11), S('tVratka', 'Teplota zpátečky °C', 11),
            S('tlak', 'Tlak v systému bar', 10), S('palivo', 'Palivo / doplnění', 14), S('kontrola', 'Kontrola (spalinová cesta, větrání, úniky)', 34),
            S('zavady', 'Závady a opatření', 40), S('podpis', 'Podpis obsluhy', 16)],
        },
        vzv: {
          nazev: 'Denní kontrola vysokozdvižného vozíku', orientace: 'na_sirku', vyskaRadku: 7.5, bezDoplneni: true,
          predpis: 'kontrola před začátkem směny podle návodu výrobce; NV č. 378/2001 Sb.',
          mesic: { sloupce: true, sirkaDne: 5 },
          udaje: [U('vozik', 'Vozík (typ, ev. č.)', 50), U('mesic', 'Měsíc', 25, { vypocet: true }), U('ridic', 'Řidič(i)', 25)],
          sloupce: [S('bod', 'Kontrolovaný bod', 62)],
          predvyplnene: `Provozní a parkovací brzda
Řízení – vůle, lehkost chodu
Zvedací zařízení, řetězy, vidlice
Hydraulika – úniky oleje
Pneumatiky a kola
Osvětlení, houkačka, výstražný maják
Ochranná stříška, zádržný systém (pás)
Baterie / palivo – stav, úniky
Zpětná zrcátka
Štítek nosnosti čitelný
Podpis řidiče`,
          zaver: 'Legenda: ✓ v pořádku · ✗ závada – zapsat a nahlásit; vozík se závadou ohrožující bezpečnost se nesmí použít.',
          podpisy: ['Kontroloval vedoucí'],
        },
        zebriky: {
          nazev: 'Evidence kontrol žebříků a regálů', orientace: 'na_sirku', vyskaRadku: 9,
          predpis: 'kontroly podle návodu výrobce; žebříky ČSN EN 131, regály ČSN EN 15635',
          udaje: [U('objekt', 'Objekt / sklad', 67), U('rok', 'Rok', 33)],
          sloupce: [S('oznaceni', 'Ev. č. / označení', 14), S('druh', 'Druh (žebřík, schůdky, regál)', 20), S('umisteni', 'Umístění', 24),
            S('datum', 'Datum kontroly', 13), S('zjisteni', 'Zjištěné závady', 40), S('opatreni', 'Opatření', 30), S('pristi', 'Příští kontrola', 13), S('kontroloval', 'Kontroloval (podpis)', 22)],
        },
        revize: {
          nazev: 'Přehled revizí a pravidelných kontrol', orientace: 'na_sirku', vyskaRadku: 9,
          predpis: 'lhůty podle příslušných předpisů, norem a návodů výrobců',
          udaje: [U('objekt', 'Objekt / provozovna', 67), U('aktualizace', 'Aktualizováno dne', 33)],
          sloupce: [S('zarizeni', 'Zařízení / objekt', 30), S('druh', 'Druh revize nebo kontroly', 26), S('predpis', 'Předpis / norma', 24),
            S('lhuta', 'Lhůta', 12), S('posledni', 'Poslední provedena', 14), S('pristi', 'Příští termín', 14),
            S('provedl', 'Revizní technik / firma', 26), S('zprava', 'Č. zprávy', 14), S('pozn', 'Poznámka', 20)],
          predvyplnene: `# Elektro
Elektrická instalace | revize | ČSN 33 1500
Hromosvod | revize | ČSN EN 62305
Elektrické spotřebiče a nářadí | revize a kontroly | ČSN 33 1600 ed. 2
# Plyn, tlak, zdvih
Plynové zařízení | revize a kontroly
Tlakové nádoby
Zdvihací zařízení
# Požární ochrana
Hasicí přístroje | kontrola provozuschopnosti | vyhl. č. 246/2001 Sb. | 1× ročně
Požární hydranty a vodovod
Požární dveře a uzávěry
Nouzové osvětlení
# Ostatní
Komín a spalinová cesta
Regály
Vozíky a manipulační technika`,
        },
      },
    },

    // ======================================================================= Firma a provoz
    kniha_jizd: {
      info: `
        <p><b>Co má evidence obsahovat:</b> zákon pevný vzor nepředepisuje, prokazovat se ale musí služební účel
        každé jízdy. Obvykle se uvádí datum, trasa, účel jízdy, stav tachometru a ujeté kilometry; při paušálních výdajích
        na dopravu (§ 24 odst. 2 písm. zt) ZDP) se kniha jízd nevede.</p>
        <p>Součtový řádek na každé straně usnadní převod kilometrů a nákladů na PHM do měsíčního vyúčtování.</p>`,
      vzory: {
        kniha: {
          nazev: 'Kniha jízd', orientace: 'na_sirku', vyskaRadku: 8, stran: 6, titulni: true, soucet: 'Součet strany',
          predpis: 'evidence jízd pro uplatnění výdajů na vozidlo (§ 24 zákona č. 586/1992 Sb. o daních z příjmů)',
          titulniRadky: ['Vozidlo a RZ', 'Kniha vedena od', 'Kniha vedena do', 'Stav tachometru na začátku', 'Stav tachometru na konci'],
          udaje: [U('vozidlo', 'Vozidlo'), U('rz', 'RZ'), U('obdobi', 'Období'), U('ridici', 'Řidič(i)')],
          sloupce: [S('datum', 'Datum', 11), S('cas', 'Čas odjezdu – příjezdu', 13, { skryty: true }), S('trasa', 'Trasa (odkud – přes – kam)', 43),
            S('ucel', 'Účel jízdy, navštívená firma / místo', 38), S('tachoZ', 'Tachometr začátek', 13), S('tachoK', 'Tachometr konec', 13),
            S('kmS', 'Ujeto km služebně', 11), S('kmP', 'Ujeto km soukromě', 11), S('ridic', 'Řidič', 17), S('phmL', 'Natanko­váno litrů', 11),
            S('phmKc', 'Cena PHM Kč', 11), S('parkovne', 'Parkovné, mýto Kč', 11, { skryty: true }), S('podpis', 'Podpis', 13)],
        },
      },
    },

    cestovni_prikaz: {
      info: `
        <p><b>Cestovní příkaz</b> slouží k vyslání zaměstnance na pracovní cestu a k vyúčtování cestovních náhrad
        (§ 151 a násl. zákoníku práce): jízdní výdaje, stravné, ubytování a nutné vedlejší výdaje. Sazby stravného a náhrady
        za použití vlastního vozidla se mění vyhláškou každý rok – v tiskopisu proto nejsou předvyplněné.</p>`,
      vzory: {
        prikaz: {
          nazev: 'Cestovní příkaz', rezim: 'doklad', vyskaRadku: 8,
          predpis: '§ 151 a násl. zákoníku práce – cestovní náhrady',
          udaje: [
            U('jmeno', 'Příjmení, jméno, titul', 67), U('oscislo', 'Osobní číslo', 33),
            U('bydliste', 'Bydliště', 67), U('utvar', 'Útvar', 33),
            U('pocatek', 'Počátek cesty (místo, datum, hodina)', 50), U('konec', 'Konec cesty (místo, datum)', 50),
            U('mistoJednani', 'Místo jednání', 50), U('prostredek', 'Určený dopravní prostředek', 50),
            U('ucel', 'Účel cesty', 100), U('spolucestujici', 'Spolucestující', 67), U('zaloha', 'Záloha Kč', 33),
            U('povolil', 'Cestu povolil (podpis, datum)', 100),
            N('nv', 'Vyúčtování pracovní cesty'),
          ],
          sloupce: [S('datum', 'Datum', 10), S('odjezd', 'Odjezd – místo, čas', 22), S('prijezd', 'Příjezd – místo, čas', 22), S('prostr', 'Prostře­dek', 9),
            S('km', 'km', 7), S('jizdne', 'Jízdné Kč', 10), S('stravne', 'Stravné Kč', 10), S('nocne', 'Ubyto­vání Kč', 10), S('vedlejsi', 'Vedlejší výdaje Kč', 11), S('celkem', 'Celkem Kč', 11)],
          soucet: 'Celkem',
          zaver: 'Prohlašuji, že jsem všechny údaje uvedl(a) úplně a správně. Celkem náhrady ……………… Kč, záloha ……………… Kč, doplatek / přeplatek ……………… Kč.',
          podpisy: ['Podpis pracovníka', 'Schválil (vedoucí)', 'Účtárna'],
        },
      },
    },

    pokladna: {
      info: `
        <p><b>Pokladní doklad</b> je účetní doklad: musí obsahovat označení dokladu, obsah účetního případu a jeho účastníky,
        peněžní částku, okamžik vyhotovení (a uskutečnění, liší-li se) a podpisový záznam osoby odpovědné za účetní případ
        i za jeho zaúčtování (§ 11 zákona č. 563/1991 Sb.). Je-li doklad zároveň daňovým dokladem, doplňte údaje podle zákona o DPH.</p>
        <p><b>Částka slovy</b> se doplní sama, když v Údajích vyplníte částku. Na A4 se vejdou dva doklady pod sebou (Rozvržení → Kopií na list).</p>`,
      hodnoty: (stav, J) => ({ slovy: J.castkaSlovy(stav.hodnoty.castka) }),
      vzory: {
        prijmovy: {
          nazev: 'Příjmový pokladní doklad', rezim: 'doklad', kopii: 2,
          predpis: 'účetní doklad – § 11 zákona č. 563/1991 Sb., o účetnictví',
          udaje: [U('cislo', 'Číslo dokladu', 33), U('datum', 'Ze dne', 33, { typ: 'date' }), U('pokladna', 'Pokladna', 33),
            U('osoba', 'Přijato od (jméno, adresa, IČO)', 100), U('ucel', 'Účel platby', 100),
            U('castka', 'Částka Kč', 33), U('slovy', 'Slovy', 67, { vypocet: true }),
            U('zaklad', 'Základ DPH', 25), U('sazba', 'Sazba DPH %', 25), U('dph', 'DPH Kč', 25), U('predkontace', 'Účtováno MD / D', 25)],
          podpisy: ['Vystavil', 'Schválil', 'Přijal (pokladník)', 'Zaplatil'],
        },
        vydajovy: {
          nazev: 'Výdajový pokladní doklad', rezim: 'doklad', kopii: 2,
          predpis: 'účetní doklad – § 11 zákona č. 563/1991 Sb., o účetnictví',
          udaje: [U('cislo', 'Číslo dokladu', 33), U('datum', 'Ze dne', 33, { typ: 'date' }), U('pokladna', 'Pokladna', 33),
            U('osoba', 'Vyplaceno komu (jméno, adresa, IČO)', 100), U('ucel', 'Účel výplaty', 100),
            U('castka', 'Částka Kč', 33), U('slovy', 'Slovy', 67, { vypocet: true }),
            U('zaklad', 'Základ DPH', 25), U('sazba', 'Sazba DPH %', 25), U('dph', 'DPH Kč', 25), U('predkontace', 'Účtováno MD / D', 25)],
          podpisy: ['Vystavil', 'Schválil', 'Vyplatil (pokladník)', 'Přijal'],
        },
        kniha: {
          nazev: 'Pokladní kniha', vyskaRadku: 7, stran: 2, soucet: 'Součet strany / převod',
          predpis: 'evidence pokladních operací – zákon č. 563/1991 Sb., o účetnictví',
          udaje: [U('pokladna', 'Pokladna'), U('obdobi', 'Období'), U('pocatecni', 'Počáteční zůstatek Kč')],
          sloupce: [S('datum', 'Datum', 11), S('doklad', 'Č. dokladu', 12), S('text', 'Obsah zápisu (účel, komu / od koho)', 48),
            S('prijem', 'Příjem Kč', 14), S('vydej', 'Výdej Kč', 14), S('zustatek', 'Zůstatek Kč', 14), S('pozn', 'Pozn.', 10)],
        },
      },
    },

    predavaci_protokol: {
      info: `
        <p><b>Předávací protokol</b> zachycuje stav věci v okamžiku předání a předchází sporům. Položky (měřidla, klíče,
        místnosti, výbava) jsou vzorové – upravíte je v ✏️ Upravit šablonu → <i>Předtištěné řádky</i>.
        Doporučení: ke každé závadě pořiďte fotografii a uveďte ji do poznámky.</p>`,
      vzory: {
        byt: {
          nazev: 'Předávací protokol k bytu', vyskaRadku: 7.5,
          predpis: 'předání bytu při vzniku / skončení nájmu',
          udaje: [U('predavajici', 'Předávající (pronajímatel)', 50), U('prebirajici', 'Přebírající (nájemce)', 50),
            U('adresa', 'Adresa a číslo bytu', 67), U('datum', 'Datum a čas předání', 33), U('smlouva', 'Nájemní smlouva ze dne', 50), U('pricina', 'Důvod (nástup / skončení nájmu)', 50)],
          sloupce: [S('polozka', 'Položka', 34), S('popis', 'Číslo / popis', 24), S('stav', 'Stav / množství', 20), S('pozn', 'Poznámka, závady', 32)],
          predvyplnene: `# Měřidla
Elektroměr | č.
Plynoměr | č.
Vodoměr – studená voda | č.
Vodoměr – teplá voda | č.
Měřiče / indikátory tepla
# Klíče a čipy
Klíče od bytu
Klíče od domu
Klíče od schránky
Klíče od sklepa / komory
Čipy, ovladače
# Místnosti a vybavení
Předsíň
Kuchyň a kuchyňská linka
Sporák, trouba, digestoř
Chladnička
Obývací pokoj
Ložnice
Koupelna
WC
Balkon, sklep`,
          zaver: 'Předávající a přebírající potvrzují, že byt byl předán ve stavu popsaném v tomto protokolu a že stavy měřidel odpovídají skutečnosti.',
          podpisy: ['Předávající', 'Přebírající'],
        },
        vozidlo: {
          nazev: 'Předávací protokol k vozidlu', vyskaRadku: 8,
          predpis: 'předání vozidla (prodej, výpůjčka, služební vůz)',
          udaje: [U('predavajici', 'Předávající', 50), U('prebirajici', 'Přebírající', 50), U('vozidlo', 'Vozidlo (značka, typ)', 50), U('rz', 'RZ', 25), U('vin', 'VIN', 25),
            U('datum', 'Datum a čas předání', 50), U('misto', 'Místo předání', 50)],
          sloupce: [S('polozka', 'Položka', 36), S('stav', 'Stav / hodnota', 30), S('pozn', 'Poznámka, závady', 44)],
          predvyplnene: `Stav tachometru (km)
Stav paliva / nabití
Klíče (počet)
Osvědčení o registraci (malý TP)
Doklad o pojištění (zelená karta)
Servisní knížka
Povinná výbava (lékárnička, vesta, trojúhelník, rezerva)
Pneumatiky (letní / zimní, stav)
Karoserie – poškození
Skla a světla
Interiér – stav, čistota
Kontrolky na palubní desce`,
          zaver: 'Zjištěná poškození jsou uvedena výše, případně zakreslena nebo doložena fotografiemi.',
          podpisy: ['Předávající', 'Přebírající'],
        },
        majetek: {
          nazev: 'Protokol o předání svěřených věcí', vyskaRadku: 8, cislovat: true,
          predpis: '§ 255 zákoníku práce – věci svěřené zaměstnanci na písemné potvrzení',
          udaje: [U('predava', 'Předává (za zaměstnavatele)', 50), U('prebira', 'Přebírá (zaměstnanec)', 50), U('utvar', 'Útvar / pracoviště', 50), U('datum', 'Datum', 50, { typ: 'date' })],
          sloupce: [CISLO, S('predmet', 'Předmět (název, typ)', 40), S('invc', 'Inventární / výrobní č.', 22), S('ks', 'Ks', 7), S('stav', 'Stav', 16), S('vraceno', 'Vráceno dne', 14), S('podpis', 'Podpis při vrácení', 18)],
          zaver: 'Přebírající potvrzuje převzetí uvedených věcí a bere na vědomí povinnost je řádně užívat, chránit před poškozením a ztrátou a na požádání je vrátit.',
          podpisy: ['Předávající', 'Přebírající'],
        },
        dilo: {
          nazev: 'Protokol o předání a převzetí díla', vyskaRadku: 9, cislovat: true,
          predpis: 'předání díla – § 2604 a násl. zákona č. 89/2012 Sb., občanského zákoníku',
          udaje: [U('zhotovitel', 'Zhotovitel', 50), U('objednatel', 'Objednatel', 50), U('dilo', 'Předmět díla', 100), U('smlouva', 'Smlouva / objednávka č.', 50),
            U('datum', 'Datum předání', 25, { typ: 'date' }), U('misto', 'Místo', 25)],
          sloupce: [CISLO, S('vada', 'Zjištěné vady a nedodělky', 60), S('termin', 'Termín odstranění', 18), S('odstraneno', 'Odstraněno dne / podpis', 24)],
          zaver: 'Objednatel dílo přebírá:  ☐ bez výhrad   ☐ s výhradami uvedenými výše   ☐ nepřebírá (důvod uveden výše).',
          podpisy: ['Zhotovitel', 'Objednatel'],
        },
      },
    },

    // ======================================================================= Zaměstnanci
    dochazka: {
      info: `
        <p><b>Co se eviduje:</b> zaměstnavatel vede u každého zaměstnance evidenci odpracované doby se začátkem a koncem
        směny, práce přesčas, noční práce a pracovní pohotovosti (§ 96 ZP). Víkendy a státní svátky jsou podbarvené
        a svátky popsané, fond pracovní doby je spočítaný z pracovních dnů měsíce.</p>
        <p><b>Zkratky nepřítomnosti</b> jsou jen doporučené: D dovolená, N nemoc, OČR ošetřování člena rodiny,
        P překážka v práci, S svátek, NV neplacené volno.</p>`,
      hodnoty(stav, J) {
        const tydne = parseFloat(String(stav.hodnoty.uvazek ?? '').replace(',', '.'));
        const dni = J.pracovniDny(stav.mesic);
        return { fond: dni && tydne > 0 ? `${dni} dní · ${String(Math.round(dni * tydne / 5 * 100) / 100).replace(".", ",")} h` : "" };
      },
      vzory: {
        mesic: {
          nazev: 'Evidence pracovní doby', vyskaRadku: 6.2, bezDoplneni: true, soucet: 'Celkem',
          predpis: '§ 96 zákoníku práce – evidence pracovní doby',
          mesic: { radky: 'den', svatekDo: 'nepritomnost' },
          seznam: ZAMESTNANCI(),
          udaje: [U('zamestnanec', 'Zaměstnanec', 0, { vypocet: true }), U('mesic', 'Měsíc', 0, { vypocet: true }), U('pracoviste', 'Pracoviště'),
            U('uvazek', 'Týdenní pracovní doba (h)', 0, { vychozi: '40' }), U('fond', 'Fond pracovní doby', 0, { vypocet: true })],
          sloupce: [S('den', 'Den', 10), S('zacatek', 'Začátek směny', 11), S('prestavka', 'Přestávka (od – do)', 15), S('konec', 'Konec směny', 11),
            S('odprac', 'Odpra­cováno h', 12), S('prescas', 'Přesčas h', 9), S('nocni', 'Noční práce h', 9), S('pohotovost', 'Pracovní pohotovost h', 11),
            S('nepritomnost', 'Nepřítomnost (D, N, OČR, P, S…)', 20), S('poznamka', 'Poznámka', 18)],
          podpisy: ['Podpis zaměstnance', 'Podpis vedoucího'],
        },
      },
    },

    smenny_rozpis: {
      info: `
        <p><b>Rozvrh pracovní doby</b> musí zaměstnavatel vypracovat písemně a seznámit s ním zaměstnance nejpozději
        2 týdny před začátkem období, na které je pracovní doba rozvržena (§ 84 zákoníku práce), pokud se nedohodnou jinak.</p>
        <p>Jména vložte do pole <i>Zaměstnanci</i>, měsíc zvolte v 📝 Údaje. Zkratky směn v legendě upravíte v editoru (Závěr).</p>`,
      vzory: {
        mesic: {
          nazev: 'Směnný rozpis', orientace: 'na_sirku', vyskaRadku: 8, minRadku: 12,
          predpis: '§ 84 zákoníku práce – písemný rozvrh pracovní doby',
          mesic: { sloupce: true, sirkaDne: 5 },
          seznam: { popisek: 'Zaměstnanci – jeden na řádek', doSloupce: 'jmeno' },
          udaje: [U('pracoviste', 'Pracoviště / útvar', 50), U('mesic', 'Měsíc', 25, { vypocet: true }), U('zpracoval', 'Zpracoval', 25)],
          sloupce: [S('jmeno', 'Zaměstnanec', 34), S('hodin', 'Hodin', 8)],
          zaver: 'Legenda: R ranní · O odpolední · N noční · D dovolená · V volno · S svátek',
          podpisy: ['Zpracoval', 'Schválil'],
        },
      },
    },

    plan_dovolenych: {
      info: `
        <p><b>Rozvrh čerpání dovolené</b> určuje zaměstnavatel s ohledem na provoz a oprávněné zájmy zaměstnance
        (§ 217 zákoníku práce); čerpání se zaměstnanci oznamuje písemně předem. Tiskopis slouží jako podklad pro plánování na celý rok.</p>`,
      vzory: {
        terminy: {
          nazev: 'Plán dovolených', orientace: 'na_sirku', vyskaRadku: 9, cislovat: true, minRadku: 15,
          predpis: '§ 217 zákoníku práce – rozvrh čerpání dovolené',
          seznam: { popisek: 'Zaměstnanci – jeden na řádek', doSloupce: 'jmeno' },
          udaje: [U('utvar', 'Útvar', 67), U('rok', 'Rok', 33)],
          sloupce: [CISLO, S('jmeno', 'Zaměstnanec', 34), S('narok', 'Nárok dní', 10), S('prevod', 'Převod z min. roku', 11),
            S('t1', 'Termín 1 (od – do)', 22), S('t2', 'Termín 2 (od – do)', 22), S('t3', 'Termín 3 (od – do)', 22), S('celkem', 'Celkem dní', 10), S('schvalil', 'Schválil', 16)],
          podpisy: ['Zpracoval', 'Schválil'],
        },
        rocni: {
          nazev: 'Roční přehled dovolených', orientace: 'na_sirku', vyskaRadku: 9, minRadku: 15,
          predpis: '§ 217 zákoníku práce – rozvrh čerpání dovolené',
          seznam: { popisek: 'Zaměstnanci – jeden na řádek', doSloupce: 'jmeno' },
          udaje: [U('utvar', 'Útvar', 67), U('rok', 'Rok', 33)],
          sloupce: [S('jmeno', 'Zaměstnanec', 30), S('narok', 'Nárok', 8),
            ...['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'].map((m, i) => S('m' + (i + 1), m, 12)), S('zbyva', 'Zbývá', 8)],
        },
      },
    },

    // ======================================================================= Potraviny a odpady
    haccp: {
      info: `
        <p><b>Záznamy HACCP</b> dokládají, že provozovatel potravinářského podniku dodržuje postupy založené na zásadách HACCP
        (nařízení (ES) č. 852/2004): sledování kritických bodů (teploty), sanitace a kontrola příjmu surovin.
        Kritické meze a četnost záznamů určuje váš HACCP plán – doplňte je do záhlaví.</p>`,
      vzory: {
        teploty: {
          nazev: 'Záznam teplot chladicích zařízení', vyskaRadku: 6.4, bezDoplneni: true,
          predpis: 'nařízení (ES) č. 852/2004 – postupy založené na zásadách HACCP',
          mesic: { radky: 'den' },
          udaje: [U('provozovna', 'Provozovna', 67), U('mesic', 'Měsíc', 33, { vypocet: true }), U('meze', 'Kritické meze (podle HACCP plánu)', 100)],
          sloupce: [S('den', 'Den', 10), S('cas', 'Čas', 9), S('z1', 'Chladnička 1 °C', 12), S('z2', 'Chladnička 2 °C', 12), S('z3', 'Mraznička °C', 12),
            S('z4', 'Jiné °C', 10, { skryty: true }), S('opatreni', 'Odchylka – nápravné opatření', 34), S('podpis', 'Podpis', 15)],
          podpisy: ['Kontroloval (vedoucí)'],
        },
        sanitace: {
          nazev: 'Sanitační plán', vyskaRadku: 10,
          predpis: 'nařízení (ES) č. 852/2004 – čištění a dezinfekce',
          udaje: [U('provozovna', 'Provozovna', 67), U('platnost', 'Platí od', 33)],
          sloupce: [S('co', 'Plocha / zařízení', 26), S('cetnost', 'Četnost', 16), S('postup', 'Postup', 34), S('prostredek', 'Prostředek a koncentrace', 22), S('odpovida', 'Odpovídá', 16)],
          predvyplnene: `Pracovní plochy a prkénka | po každém použití | mechanická očista, mytí, dezinfekce, oplach
Nože a náčiní | po každém použití | mytí, dezinfekce
Podlahy | denně | zamést, umýt, dezinfikovat
Chladničky a mrazničky | týdně | vyklidit, umýt, dezinfikovat
Myčka nádobí | denně | vyčistit filtry a sítka
Digestoř a filtry | měsíčně | odmaštění filtrů
Nádoby na odpad | denně | vyprázdnit, umýt, dezinfikovat
Umyvadla a sanitární zařízení | denně | mytí, dezinfekce`,
          podpisy: ['Schválil'],
        },
        uklid: {
          nazev: 'Záznam o provedení sanitace', orientace: 'na_sirku', vyskaRadku: 7.5, bezDoplneni: true,
          predpis: 'nařízení (ES) č. 852/2004 – čištění a dezinfekce',
          mesic: { sloupce: true, sirkaDne: 5 },
          udaje: [U('provozovna', 'Provozovna', 67), U('mesic', 'Měsíc', 33, { vypocet: true })],
          sloupce: [S('co', 'Plocha / zařízení', 52)],
          predvyplnene: `Pracovní plochy
Podlahy
Chladničky a mrazničky
Myčka nádobí
Nádoby na odpad
Sanitární zařízení
Podpis`,
          zaver: 'Do políčka dne zapište iniciály osoby, která sanitaci provedla.',
        },
        prijem: {
          nazev: 'Kontrola příjmu zboží', orientace: 'na_sirku', vyskaRadku: 8,
          predpis: 'nařízení (ES) č. 852/2004 – kontrola surovin při příjmu',
          udaje: [U('provozovna', 'Provozovna', 67), U('obdobi', 'Období', 33)],
          sloupce: [S('datum', 'Datum', 11), S('dodavatel', 'Dodavatel', 26), S('zbozi', 'Zboží', 32), S('mnozstvi', 'Množství', 12),
            S('teplota', 'Teplota při příjmu °C', 12), S('trvanlivost', 'Datum použitelnosti / min. trvanlivosti', 16), S('sarze', 'Šarže', 13),
            S('obal', 'Obal, smyslové posouzení', 22), S('prijal', 'Přijal / vrátil', 16)],
        },
      },
    },

    evidence_odpadu: {
      info: `
        <p><b>Průběžná evidence odpadů</b> se vede pro každý druh a kategorii odpadu zvlášť v rozsahu přílohy č. 13 vyhlášky
        č. 273/2021 Sb. (zákon č. 541/2020 Sb., o odpadech). Kromě druhu, kategorie a množství obsahuje i údaje o provozovně a osobě
        odpovědné za vedení evidence; písemná evidence se doplňuje datem záznamu a jménem toho, kdo ho provedl.
        Podle evidence se podává roční hlášení do ISPOP.</p>
        <p>Sloupce jsou běžný rozsah – před použitím je porovnejte s aktuálním zněním přílohy č. 13 (vyhláška byla v roce 2025 novelizována).</p>`,
      vzory: {
        prubezna: {
          nazev: 'Průběžná evidence odpadů', orientace: 'na_sirku', vyskaRadku: 8, stran: 2, soucet: 'Součet strany',
          predpis: 'zákon č. 541/2020 Sb.; průběžná evidence v rozsahu přílohy č. 13 vyhlášky č. 273/2021 Sb.',
          udaje: [U('provozovna', 'Provozovna / místo vzniku (adresa, IČP)', 67), U('rok', 'Rok', 33),
            U('kod', 'Katalogové číslo a název odpadu', 50), U('kategorie', 'Kategorie (O / N)', 17), U('odpovedna', 'Odpovědná osoba (jméno, kontakt)', 33)],
          sloupce: [S('datum', 'Datum', 11), S('vznik', 'Vzniklo (t)', 11), S('prevzato', 'Převzato (t)', 11), S('predano', 'Předáno (t)', 11),
            S('nakladani', 'Způsob nakládání (kód)', 14), S('komu', 'Předáno komu / převzato od (název, IČO, IČZ/IČP)', 50),
            S('doklad', 'Č. dokladu (ZL, potvrzení)', 18), S('zustatek', 'Stav na skladě (t)', 12), S('zapsal', 'Datum zápisu, zapsal', 20)],
        },
      },
    },

    // ======================================================================= Vlastní
    vlastni_tiskopis: {
      info: `
        <p><b>Vlastní tiskopis</b> si sestavíte od nuly v ✏️ Upravit šablonu: název, údaje v záhlaví, sloupce, předtištěné řádky,
        prohlášení a podpisová pole. <i>Tabulka</i> stránkuje řádky přes víc listů, <i>formulář</i> tiskne údaje v jedné
        nebo více kopiích na list. Hotovou šablonu uložte (💾) nebo exportujte do JSON a pošlete kolegům.</p>`,
      vzory: {
        tabulka: {
          nazev: 'Evidence', vyskaRadku: 8, cislovat: true,
          udaje: [U('udaj1', 'Pracoviště', 50), U('udaj2', 'Období', 50)],
          sloupce: [CISLO, S('datum', 'Datum', 12), S('popis', 'Popis', 50), S('pozn', 'Poznámka', 25), S('podpis', 'Podpis', 15)],
        },
        doklad: {
          nazev: 'Formulář', rezim: 'doklad', kopii: 2,
          udaje: [U('udaj1', 'Číslo', 33), U('udaj2', 'Datum', 33), U('udaj3', 'Vyřizuje', 33), U('udaj4', 'Text', 100, { radku: 4 })],
          podpisy: ['Podpis'],
        },
      },
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DEF;
  else koren.TISKOPISY = DEF;
})(typeof self !== 'undefined' ? self : this);
