/* Trénink: podvodný hovor a SMS – scénáře jako data pro engine gamebooků (gamebook/jadro.js).
   Každý scénář má vlastní sekce s předponou `<id>_`; rozcestí je jen kvůli kontrole dosažitelnosti.
   Sekce: text (situace), kdo ('hovor'|'sms'|'chat'|'web'|'dvere'|'banka'), od (kdo píše/volá), rec (co zazní / co stojí ve zprávě).
   Volba: text, cil, hodnoceni ('ok'|'chyba'|''), proc (vysvětlení, ukáže se po volbě a v rozboru na konci).
   Konec: konce[id].typ 'vyhra' | 'castecne' | 'prohra'. */
(function () {
'use strict';

const SCENARE = [
  { id: 'banka', ikona: '🏦', nazev: 'Volá „banka“', popis: 'Bezpečnostní oddělení hlásí napadený účet a spěchá.', start: 'banka_1',
    ponauceni: ['Neznámému číslu neříkejte „ano“ – stačí „Prosím?“ nebo „Co potřebujete?“.',
      'Banka nikdy nechce převod na „bezpečný účet“, PIN, číslo karty ani kód z SMS.',
      'Číslo na displeji se dá podvrhnout. Ověřujte zavěšením a voláním na číslo z karty nebo z aplikace.',
      'Policie ani banka vás nikdy nepošlou k bitcoinomatu ani nebudou chtít hotovost.'] },
  { id: 'balik', ikona: '📦', nazev: 'SMS o balíku', popis: 'Doplatek pár korun za clo, jinak se zásilka vrátí.', start: 'balik_1',
    ponauceni: ['Na odkazy ze SMS neklikejte. Zásilku ověřte v aplikaci dopravce nebo na webu, jehož adresu napíšete sami.',
      'Čtěte celou SMS z banky: částka a obchodník řeknou, co kódem doopravdy potvrzujete.',
      'Kód z SMS nikam neopisujte, pokud jste platbu sami nezačali.',
      'Když už kartu někde vyplníte, hned volejte bance a nechte ji zablokovat.'] },
  { id: 'mami', ikona: '💬', nazev: '„Mami, mám nové číslo“', popis: 'Zpráva od „dítěte“ z neznámého čísla a rychlá platba.', start: 'mami_1',
    ponauceni: ['Na novém čísle nic neplaťte. Zavolejte na staré číslo nebo jinému členovi rodiny.',
      'Výmluvy „nemůžu mluvit, nejde mi mikrofon“ jsou typický znak podvodu.',
      'Zeptejte se na něco, co ví jen váš blízký – nebo na rodinné heslo.',
      'Podvodné číslo zablokujte, nahlaste a varujte rodinu.'] },
  { id: 'vnuk', ikona: '👵', nazev: 'Klonovaný hlas vnuka', popis: 'Vnuk pláče do telefonu, měl nehodu a potřebuje kauci.', start: 'vnuk_1',
    ponauceni: ['Hlas není důkaz. AI ho napodobí z několika vteřin nahrávky – z videa na sítích nebo z nahraných slabik z hovoru.',
      'Domluvte si v rodině heslo, které nikde nepíšete. Kdo ho nezná, není z rodiny.',
      'Zavěste a zavolejte blízkému na jeho známé číslo.',
      'Policie si nikdy nevybírá kauci přes kurýra. Když někdo přijde pro peníze, volejte 158.'] },
  { id: 'omyl', ikona: '💸', nazev: 'Peníze „omylem“', popis: 'Na účet přijdou cizí peníze a odesílatel je chce zpátky.', start: 'omyl_1',
    ponauceni: ['Peníze „omylem“ sami nevracejte – ani na nový účet, ani zpět odesílateli.',
      'Řešte to se svou bankou přes číslo z aplikace nebo z karty. Vrácení zařídí banky mezi sebou.',
      'Peníze do té doby nechte ležet a neutrácejte je.',
      'Výhrůžky policií jsou nátlak. Kdo poslal omylem, má se obrátit na svou banku.'] },
  { id: 'bazar', ikona: '🛒', nazev: 'Bazar s kurýrem', popis: 'Kupec bere bez prohlížení a posílá „bezpečnou platbu“.', start: 'bazar_1',
    ponauceni: ['Prodávající nikdy nezadává číslo karty, CVV ani kód z SMS, aby peníze dostal.',
      'Odkazy na „přijetí platby“ od kupce jsou podvodné stránky dopravců.',
      'Kód z SMS banky vždy čtěte celý – „přidání karty do mobilní peněženky“ znamená předání karty cizímu.',
      'Nenechte se přetáhnout do WhatsAppu; prodávejte osobně nebo s převodem předem.'] },
  { id: 'nahravani', ikona: '🎙️', nazev: '„Hovor nahráváme, souhlasíte?“', popis: 'Nabídka energií a otázky, na které se odpovídá „ano“.', start: 'nahravani_1',
    ponauceni: ['Neznámé číslo zvedněte slovy „Prosím?“ nebo „Co potřebujete?“, ne „Ano?“.',
      'Na otázku „Souhlasíte s nahráváním?“ řekněte NE a zavěste.',
      'Nemáte povinnost poslouchat nabídku. Zavěsit není neslušné.',
      'Z nahraných slabik lze AI dogenerovat váš hlas; „ano“ se dá vystřihnout a vložit za jinou otázku.'] },
  { id: 'podpora', ikona: '🖥️', nazev: 'Falešná technická podpora', popis: 'Houkající okno: „Počítač je napaden, zavolejte nám.“', start: 'podpora_1',
    ponauceni: ['Skutečné firmy nevyhazují okna s telefonním číslem a samy nevolají kvůli virům.',
      'Okno zavřete (Ctrl+W, Alt+F4, nebo restart počítače). Nic se nestane.',
      'Nikomu neinstalujte program pro vzdálený přístup a neříkejte mu jeho kód.',
      'Při vzdáleném přístupu se nikdy nepřihlašujte do bankovnictví. Když se to stane, odpojte internet a volejte bance.'] }
];

const sceny = {
  rozcesti: { text: 'Výběr scénáře.', volby: SCENARE.map(s => ({ text: s.nazev, cil: s.start })) },

  /* ===== 🏦 Volá „banka“ ===== */
  banka_1: { kdo: 'hovor', od: '+420 228 ··· ··· (neznámé číslo)',
    text: 'Je úterý dopoledne. Zvoní telefon, neznámé pražské číslo. Hovor přijmete a chvíli je ticho.',
    rec: 'Dobrý den, tady bezpečnostní oddělení vaší banky. Slyšíte mě dobře?',
    volby: [
      { text: '„Ano, slyším.“', cil: 'banka_2', hodnoceni: 'chyba', proc: 'Otázka „Slyšíte mě?“ je past na slovo „ano“. Nahrávku jde sestříhat a z nahraných slabik lze AI dogenerovat váš hlas. Lepší je „Prosím?“.' },
      { text: '„Prosím? Co potřebujete?“', cil: 'banka_2', hodnoceni: 'ok', proc: 'Správně – neznámému číslu neříkáte „ano“ a necháte volajícího, ať se vysloví.' },
      { text: 'Zavěsit a zavolat do banky na číslo ze zadní strany karty', cil: 'banka_4', hodnoceni: 'ok', proc: 'Výborně. Když volá „banka“, nejjistější je zavěsit a zavolat jí sami na známé číslo.' }
    ] },
  banka_2: { kdo: 'hovor', od: 'Vaše banka (tak se aspoň představuje)',
    text: 'Volající mluví klidně a profesionálně. Zná vaše jméno a ví, u které banky máte účet.',
    rec: 'Z vašeho účtu se právě někdo pokouší odeslat 48 000 Kč na Slovensko. Platbu jsme zastavili. Abych ověřil vaši totožnost, nadiktujte mi prosím kód, který vám teď přijde v SMS.',
    volby: [
      { text: 'Nadiktovat kód ze SMS', cil: 'banka_kod', hodnoceni: 'chyba', proc: 'Kód z SMS potvrzuje platbu nebo přihlášení. Banka ho po telefonu nikdy nechce.' },
      { text: '„Kód nikomu neříkám. Zavolám si do banky sám.“', cil: 'banka_3', hodnoceni: 'ok', proc: 'Správně. Kód z SMS, PIN ani číslo karty se nikomu neříkají.' },
      { text: 'Zeptat se na jméno a číslo zaměstnance', cil: 'banka_3', hodnoceni: '', proc: 'Nic to nezkazí, ale nic to ani neověří – podvodník si jméno i číslo vymyslí na místě. Ověřuje jen zavěšení a hovor na známé číslo.' }
    ] },
  banka_3: { kdo: 'hovor', od: 'Vaše banka (tak se aspoň představuje)',
    text: 'Hlas zrychlí. Je slyšet, že je kolem rušno, jako v kanceláři.',
    rec: 'Tohle nesnese odklad. Než se nám dovoláte, peníze budou pryč. Jediná záchrana je převést zůstatek na bezpečný účet, který jsem vám právě založil. Nebo vás přepojím na policii, kolega vám to potvrdí.',
    volby: [
      { text: 'Převést peníze na „bezpečný účet“', cil: 'banka_prevod', hodnoceni: 'chyba', proc: 'Žádný „bezpečný účet“ neexistuje. Banka nikdy nechce, abyste peníze někam převáděli.' },
      { text: 'Nechat se přepojit na „policii“', cil: 'banka_policie', hodnoceni: 'chyba', proc: 'Přepojení na policii je jen další herec téže skupiny. Skutečná policie se takhle nepřipojuje.' },
      { text: 'Zavěsit', cil: 'banka_4', hodnoceni: 'ok', proc: 'Správně. Spěch a strach jsou hlavní zbraně podvodníka. Zavěšením jim berete obojí.' }
    ] },
  banka_policie: { kdo: 'hovor', od: '„nadporučík Svoboda, Policie ČR“',
    text: 'Ozve se jiný, přísný mužský hlas.',
    rec: 'Vyšetřujeme zaměstnance vaší banky, kteří spolupracují s podvodníky. V bance o tom nikomu nic neříkejte. Peníze vyberte a vložte přes bitcoinový automat, pošlu vám QR kód.',
    volby: [
      { text: 'Vybrat peníze a jít k bitcoinomatu', cil: 'banka_bitcoin', hodnoceni: 'chyba', proc: 'Policie nikdy nechce peníze, hotovost ani kryptoměny. „Nikomu nic neříkejte“ je jasný znak podvodu.' },
      { text: 'Zavěsit a zavolat na 158', cil: 'banka_4', hodnoceni: 'ok', proc: 'Správně. Skutečnou policii si zavoláte sami na 158.' }
    ] },
  banka_4: { kdo: 'situace',
    text: 'Zavěsíte. Srdce vám buší. Než začnete vytáčet, máte v telefonu dvě možnosti: číslo, ze kterého před chvílí volali, a číslo banky ze zadní strany karty.',
    volby: [
      { text: 'Zavolat zpátky na číslo z výpisu hovorů', cil: 'banka_zpet', hodnoceni: 'chyba', proc: 'Číslo, ze kterého volali, patří podvodníkům (nebo je podvržené). Ověřovat se musí na čísle, které znáte odjinud.' },
      { text: 'Vytočit číslo ze zadní strany karty (nebo z aplikace banky)', cil: 'banka_dobre', hodnoceni: 'ok', proc: 'Správně. Známé číslo z karty nebo z aplikace je jediné, kterému můžete věřit.' }
    ] },
  banka_zpet: { kdo: 'hovor', od: '+420 228 ··· ···',
    text: 'Telefon zvedne tentýž hlas jako předtím.',
    rec: 'Bezpečnostní oddělení, dobrý den. Á, to jste vy – výborně, rychle, ať stihneme ten převod.',
    volby: [
      { text: 'Zavěsit a zavolat na číslo ze zadní strany karty', cil: 'banka_dobre', hodnoceni: 'ok', proc: 'Teď už správně – známé číslo z karty.' },
      { text: 'Pokračovat, když to tedy byla opravdu banka', cil: 'banka_3', hodnoceni: 'chyba', proc: 'Zpětné volání na jejich číslo nic neověřuje – vždycky se dovoláte zase k nim.' }
    ] },
  banka_dobre: { konec: 'banka_dobre',
    text: 'Operátorka banky se podívá na účet: žádná podezřelá platba, nikdo z banky vám nevolal. Poděkuje, že jste zavolali, a poradí podezřelé číslo nahlásit. Účet i peníze jsou v pořádku.' },
  banka_kod: { konec: 'banka_kod',
    text: 'Do minuty přijde další SMS: „Platba 47 980 Kč byla provedena.“ Kód, který jste nadiktovali, nebyl k ověření totožnosti – potvrzoval přesně tu platbu, před kterou vás „banka“ varovala. Volající zavěsí a číslo už nikdo nezvedá.' },
  banka_prevod: { konec: 'banka_prevod',
    text: '„Bezpečný účet“ patří podvodníkům. Peníze odešly okamžitou platbou a během minut se rozdělily na další účty. Banka může jen podat žádost o vrácení, šance je malá.' },
  banka_bitcoin: { konec: 'banka_bitcoin',
    text: 'U automatu vložíte bankovky a naskenujete QR kód, který vám „policista“ poslal. Kryptoměna odejde do peněženky podvodníků a nedá se vrátit. „Policista“ se už neozve.' },

  /* ===== 📦 SMS o balíku ===== */
  balik_1: { kdo: 'sms', od: 'DoruceniCZ',
    text: 'Čekáte na nákup z e-shopu. Přijde SMS:',
    rec: 'DoruceniCZ: Vas balik CZ48213 nelze dorucit, chybi doplatek 29 Kc za clo. Uhradte do 24 h, jinak bude vracen: https://doruceni-cz.doplatek-info.com',
    volby: [
      { text: 'Kliknout na odkaz – je to jen 29 Kč', cil: 'balik_web', hodnoceni: 'chyba', proc: 'Malá částka je návnada. Nejde o 29 Kč, ale o údaje z karty.' },
      { text: 'Neklikat. Otevřít aplikaci dopravce nebo e-shopu a podívat se na stav zásilky', cil: 'balik_overeni', hodnoceni: 'ok', proc: 'Správně. Zásilku ověříte tam, kam se dostanete sami, ne přes odkaz ze SMS.' },
      { text: 'Odepsat „STOP, nic jsem neobjednal“', cil: 'balik_odpoved', hodnoceni: 'chyba', proc: 'Odpovědí jen potvrdíte, že číslo je živé a někdo ho čte. Na podvodné SMS se neodpovídá.' }
    ] },
  balik_odpoved: { kdo: 'sms', od: '+44 7··· ······',
    text: 'Za pár minut přijde odpověď z jiného, zahraničního čísla.',
    rec: 'Dekujeme za odpoved. Pro zruseni zasilky prosim vyplnte formular: https://doruceni-cz.doplatek-info.com/zrusit',
    volby: [
      { text: 'Otevřít formulář a zásilku zrušit', cil: 'balik_web', hodnoceni: 'chyba', proc: 'Je to tentýž podvodný web, jen pod jinou záminkou.' },
      { text: 'Nereagovat, ověřit zásilku v aplikaci dopravce', cil: 'balik_overeni', hodnoceni: 'ok', proc: 'Správně – žádné další odpovědi, ověření vlastní cestou.' }
    ] },
  balik_web: { kdo: 'web', od: 'doruceni-cz.doplatek-info.com',
    text: 'Stránka vypadá jako web dopravce: logo, žluté barvy, odpočet „zbývá 23:41:08“. Chce jméno, adresu a údaje z karty – číslo, platnost a CVV.',
    rec: 'Doplatek za clo: 29,00 Kč. Zadejte údaje platební karty.',
    volby: [
      { text: 'Vyplnit kartu a zaplatit', cil: 'balik_kod', hodnoceni: 'chyba', proc: 'Na webu z odkazu v SMS kartu nikdy nevyplňujte. Adresa nepatří dopravci.' },
      { text: 'Stránku zavřít a zásilku ověřit v aplikaci dopravce', cil: 'balik_overeni', hodnoceni: 'ok', proc: 'Dobře, že jste se zarazili. Adresa „doplatek-info.com“ s dopravcem nemá nic společného.' }
    ] },
  balik_kod: { kdo: 'banka', od: 'SMS z vaší banky',
    text: 'Stránka chvíli „zpracovává platbu“. Pak přijde skutečná SMS z vaší banky a web chce opsat kód.',
    rec: 'Kod 482913 pro potvrzeni platby 24 890,00 CZK u obchodnika GLOBAL-PAY LTD. Kod nikomu nesdelujte.',
    volby: [
      { text: 'Opsat kód, ať se balík doručí', cil: 'balik_prohra', hodnoceni: 'chyba', proc: 'V SMS stojí 24 890 Kč, ne 29 Kč. Kód potvrzuje přesně tu platbu, která je v SMS napsaná.' },
      { text: 'Kód nezadat a hned volat bance, ať kartu zablokuje', cil: 'balik_zachrana', hodnoceni: 'ok', proc: 'Správně – přečetli jste celou SMS a včas zastavili platbu. Kartu, jejíž údaje jsou venku, je třeba zablokovat.' }
    ] },
  balik_overeni: { kdo: 'situace',
    text: 'V aplikaci dopravce zásilka „CZ48213“ neexistuje. Váš skutečný balík je na cestě a žádný doplatek nemá.',
    volby: [
      { text: 'SMS smazat a nahlásit jako spam, odesílatele zablokovat', cil: 'balik_dobre', hodnoceni: 'ok', proc: 'Správně. Nahlášení pomůže operátorovi podobné zprávy filtrovat.' },
      { text: 'Pro jistotu přece jen zaplatit, co kdyby…', cil: 'balik_web', hodnoceni: 'chyba', proc: 'Ověření jasně ukázalo, že zásilka neexistuje. Strach „co kdyby“ je přesně to, na co podvodník sází.' }
    ] },
  balik_dobre: { konec: 'balik_dobre',
    text: 'Zpráva je smazaná, číslo zablokované a balík přijde za dva dny – bez doplatku. Karta zůstala v bezpečí.' },
  balik_zachrana: { konec: 'balik_zachrana',
    text: 'Banka kartu zablokuje a platbu zamítne. Peníze jsou v pořádku, jen musíte čekat na novou kartu a přepsat ji v e-shopech. Lepší by bylo na odkaz vůbec neklikat – ale včasné zastavení je velký úspěch.' },
  balik_prohra: { konec: 'balik_prohra',
    text: 'Platba 24 890 Kč odchází. Balík žádný nebyl, stránka zmizí. Bance hned zavolejte a kartu zablokujte – peníze potvrzené vlastním kódem ale banka vracet nemusí.' },

  /* ===== 💬 „Mami, mám nové číslo“ ===== */
  mami_1: { kdo: 'chat', od: '+420 7·· ··· ··· (neznámé číslo)',
    text: 'Večer pípne WhatsApp. Číslo neznáte, profilová fotka chybí.',
    rec: 'Ahoj mami, rozbil se mi mobil, tohle je moje nové číslo. To staré si smaž a ulož si tohle 😘',
    volby: [
      { text: 'Odepsat „Ahoj zlato, uložím si tě!“', cil: 'mami_2', hodnoceni: '', proc: 'Zatím nic ztraceného, ale podvodníkovi jste potvrdili, že na „mami“ slyšíte. Nejdřív se ověřuje.' },
      { text: 'Zavolat na staré číslo syna', cil: 'mami_overeni', hodnoceni: 'ok', proc: 'Správně. Rozbitý telefon? Staré číslo zkusit stojí pár vteřin.' },
      { text: 'Zeptat se: „Jak se jmenoval náš první pes?“', cil: 'mami_otazka', hodnoceni: 'ok', proc: 'Dobrý nápad – otázka, kterou ví jen váš blízký (nebo rodinné heslo).' }
    ] },
  mami_otazka: { kdo: 'chat', od: '+420 7·· ··· ···',
    text: 'Odpověď přijde rychle.',
    rec: 'Mami nedělej si srandu 😅 nemám teď čas na hry, potřebuju s něčím pomoct',
    volby: [
      { text: 'Trvat na otázce, nebo zavolat na staré číslo', cil: 'mami_overeni', hodnoceni: 'ok', proc: 'Správně. Kdo se vyhne jednoduché otázce, není ten, za koho se vydává.' },
      { text: 'Omluvit se a zeptat, s čím potřebuje pomoct', cil: 'mami_2', hodnoceni: 'chyba', proc: 'Podvodník otázku obešel. Nenechte se odbýt – bez ověření dál nepokračujte.' }
    ] },
  mami_2: { kdo: 'chat', od: '+420 7·· ··· ···',
    text: 'Zpráva přijde vzápětí.',
    rec: 'Potřebuju nutně zaplatit fakturu, v novém mobilu mi ještě nejde bankovnictví. Pošleš mi 12 400 Kč? Zítra ti to vrátím. Účet 2847193650/0800, jméno Petr Kovács.',
    volby: [
      { text: 'Poslat peníze – dítěti se pomáhá', cil: 'mami_prohra', hodnoceni: 'chyba', proc: 'Peníze na cizí jméno a nové číslo bez ověření – to je přesný vzorec podvodu.' },
      { text: 'Napsat „Zavolám ti“ a vytočit nové číslo', cil: 'mami_3', hodnoceni: '', proc: 'Chtít slyšet hlas je rozumné, ale hlas jde napodobit. Spolehlivější je staré číslo.' },
      { text: 'Zavolat na staré číslo nebo partnerce syna', cil: 'mami_overeni', hodnoceni: 'ok', proc: 'Správně – ověření přes kanál, který znáte.' }
    ] },
  mami_3: { kdo: 'chat', od: '+420 7·· ··· ···',
    text: 'Hovor nikdo nezvedne. Místo toho přijde zpráva.',
    rec: 'Teď nemůžu mluvit, jsem v práci a mikrofon mi nefunguje 😩 prosím rychle, je to splatné dnes!',
    volby: [
      { text: 'Poslat, ať má klid', cil: 'mami_prohra', hodnoceni: 'chyba', proc: '„Nemůžu mluvit“ a „rychle“ jsou typické výmluvy podvodníků.' },
      { text: 'Zavolat na staré číslo', cil: 'mami_overeni', hodnoceni: 'ok', proc: 'Správně – staré číslo nebo jiný člen rodiny.' }
    ] },
  mami_overeni: { kdo: 'hovor', od: 'Syn (staré číslo)',
    text: 'Na starém čísle to zvedne syn, telefon má v pořádku.',
    rec: 'Mami? Já ti nic nepsal. Mobil mám pořád stejný.',
    volby: [
      { text: 'Podvodné číslo zablokovat, nahlásit a varovat rodinu', cil: 'mami_dobre', hodnoceni: 'ok', proc: 'Správně. Stejné zprávy obvykle dostanou i další členové rodiny.' },
      { text: 'Podvodníkovi pořádně vynadat', cil: 'mami_dobre', hodnoceni: '', proc: 'Uleví se vám, ale nic tím nezískáte – podvodníka to neodradí. Stačí zablokovat a nahlásit.' }
    ] },
  mami_dobre: { konec: 'mami_dobre',
    text: 'Syn je v pořádku, peníze zůstaly na účtu a rodina je varovaná. Příště nikdo nemusí přemýšlet – na novém čísle se nic neplatí, dokud se neověří.' },
  mami_prohra: { konec: 'mami_prohra',
    text: 'Peníze odejdou na účet „Petra Kovácse“. Druhý den se ukáže, že syn nic nepsal. Hned volejte bance a podejte trestní oznámení – peníze ale nejspíš už jsou pryč.' },

  /* ===== 👵 Klonovaný hlas vnuka ===== */
  vnuk_1: { kdo: 'hovor', od: 'Neznámé číslo',
    text: 'Je večer. V telefonu se ozve hlas, který dobře znáte – vnuk Tomáš. Pláče a mluví překotně.',
    rec: 'Babi, to jsem já… měl jsem nehodu, srazil jsem paní na přechodu. Policie mě drží. Prosím, pomoz mi, a neříkej to mámě!',
    volby: [
      { text: '„Tomášku, proboha, co se stalo?“', cil: 'vnuk_2', hodnoceni: '', proc: 'Přirozená reakce, ale jménem jste volajícímu napověděli. Nejdřív ověřujte, potom se ptejte.' },
      { text: '„Řekni mi naše rodinné heslo.“', cil: 'vnuk_heslo', hodnoceni: 'ok', proc: 'Výborně. Rodinné heslo je nejlepší obrana proti klonovanému hlasu.' },
      { text: '„Zavolám ti hned zpátky na tvoje číslo.“', cil: 'vnuk_zavolat', hodnoceni: 'ok', proc: 'Správně – zavěsit a zavolat na známé číslo.' }
    ] },
  vnuk_heslo: { kdo: 'hovor', od: 'Neznámé číslo',
    text: 'Hlas zaváhá. Pak pláče ještě víc.',
    rec: 'Babi, prosím tě, teď na žádná hesla nemám hlavu! Dám ti pana advokáta…',
    volby: [
      { text: 'Zavěsit a zavolat Tomášovi na jeho číslo', cil: 'vnuk_zavolat', hodnoceni: 'ok', proc: 'Správně. Kdo nezná heslo, není z rodiny – ať zní jakkoli věrohodně.' },
      { text: 'Chudák je v šoku, heslo nevadí', cil: 'vnuk_2', hodnoceni: 'chyba', proc: 'Šok je přesně výmluva, se kterou podvodníci počítají. Heslo neumí – to stačí.' }
    ] },
  vnuk_2: { kdo: 'hovor', od: '„JUDr. Kratochvíl, advokát“',
    text: 'Telefon převezme muž s klidným, úředním hlasem.',
    rec: 'Dobrý večer, jsem obhájce vašeho vnuka. Hrozí mu vazba. Když dnes složíte kauci 180 000 Kč v hotovosti, poškozená stáhne oznámení. Pošlu pro peníze kolegu, přijede do hodiny.',
    volby: [
      { text: 'Připravit hotovost a čekat na kolegu', cil: 'vnuk_kuryr', hodnoceni: 'chyba', proc: 'Žádný soud ani policie si nevybírá kauci přes kurýra a v hotovosti.' },
      { text: 'Chtít znovu Tomáše a zeptat se na rodinné heslo', cil: 'vnuk_heslo', hodnoceni: 'ok', proc: 'Dobře – heslo prověří, jestli je to opravdu on.' },
      { text: 'Zavěsit a zavolat Tomášovi nebo jeho rodičům', cil: 'vnuk_zavolat', hodnoceni: 'ok', proc: 'Správně. Na „neříkej to mámě“ se nehraje.' }
    ] },
  vnuk_kuryr: { kdo: 'dvere', od: 'Zvonek u dveří',
    text: 'Za necelou hodinu zazvoní mladík v bundě. Říká, že jde „od pana doktora“ pro obálku.',
    volby: [
      { text: 'Předat obálku s penězi', cil: 'vnuk_prohra', hodnoceni: 'chyba', proc: 'Kurýr je poslední článek podvodu. Obálku nikomu nepředávejte.' },
      { text: 'Neotevírat a zavolat 158', cil: 'vnuk_policie', hodnoceni: 'ok', proc: 'Výborně. Policie se o takových kurýrech chce dozvědět hned.' },
      { text: 'Říct, ať počká, a zavolat Tomášovi', cil: 'vnuk_zavolat', hodnoceni: 'ok', proc: 'Správně – ověřit dřív, než otevřete obálku i dveře.' }
    ] },
  vnuk_zavolat: { kdo: 'hovor', od: 'Tomáš (uložené číslo)',
    text: 'Na svém čísle to Tomáš zvedne po druhém zazvonění. Je doma a nic se mu nestalo.',
    rec: 'Babi? Jaká nehoda? Já jsem celý večer doma. Někdo ti volal mým hlasem?!',
    volby: [
      { text: 'Nahlásit hovor na 158 a domluvit si s rodinou heslo', cil: 'vnuk_dobre', hodnoceni: 'ok', proc: 'Správně. Policie podobné hovory sbírá a rodinné heslo vás ochrání příště.' }
    ] },
  vnuk_dobre: { konec: 'vnuk_dobre',
    text: 'Tomáš je v pořádku a rodina má nové heslo, které nikdo nepíše do zpráv ani na sítě. Hlas „vnuka“ vytvořila umělá inteligence – stačí jí pár vteřin z videa na sítích nebo nahrané slabiky z dřívějšího hovoru.' },
  vnuk_policie: { konec: 'vnuk_policie',
    text: 'Hlídka přijede za pár minut a mladíka zastaví ještě na chodníku. Tomáš je doma v pořádku. Peníze zůstaly v šuplíku a policie má stopu k celé skupině.' },
  vnuk_prohra: { konec: 'vnuk_prohra',
    text: 'Mladík obálku převezme a zmizí. Ráno se ukáže, že Tomáš žádnou nehodu neměl – hlas vytvořila umělá inteligence. Hned volejte 158 a popište kurýra, co nejpřesněji to jde.' },

  /* ===== 💸 Peníze „omylem“ ===== */
  omyl_1: { kdo: 'hovor', od: 'Neznámé číslo',
    text: 'V bankovní aplikaci vidíte příchozí platbu 8 500 Kč od člověka, kterého neznáte. Za hodinu zvoní telefon.',
    rec: 'Dobrý den, omylem jsem vám poslal 8 500 Kč, přehodil jsem číslice. Jsou to peníze na nájem. Pošlete mi je prosím zpátky na účet, který vám napíšu do SMS?',
    volby: [
      { text: 'Vrátit peníze na účet ze SMS', cil: 'omyl_vraceno', hodnoceni: 'chyba', proc: 'Peníze omylem se sami nevracejí – ani na jiný účet, ani zpět. Řeší se to se svou bankou.' },
      { text: 'Vrátit je aspoň zpátky na účet, ze kterého přišly', cil: 'omyl_vlastni', hodnoceni: 'chyba', proc: 'I to je riskantní: peníze můžou pocházet z ukradeného účtu nebo z půjčky na cizí jméno. Vrácení má zařídit banka.' },
      { text: '„Obraťte se na svou banku, já to řeším se svou.“', cil: 'omyl_2', hodnoceni: 'ok', proc: 'Správně. Kdo poslal peníze omylem, požádá o vrácení svou banku.' }
    ] },
  omyl_vlastni: { kdo: 'situace',
    text: 'V aplikaci už máte vyplněnou platbu zpět. Prst nad tlačítkem „Odeslat“ se ale zastaví: co když ten účet patří někomu, komu peníze ukradli? Pak by šlo o praní peněz – a přes váš účet.',
    volby: [
      { text: 'Platbu zrušit a zavolat bance', cil: 'omyl_3', hodnoceni: 'ok', proc: 'Správně. Banka ví, jak platbu bezpečně vrátit.' },
      { text: 'Odeslat, ať je to z krku', cil: 'omyl_vraceno', hodnoceni: 'chyba', proc: 'Banka odesílatele může platbu stáhnout znovu – a vy pak dlužíte dvakrát.' }
    ] },
  omyl_2: { kdo: 'hovor', od: 'Totéž číslo',
    text: 'Za deset minut volá znovu. Tentokrát zvyšuje hlas.',
    rec: 'Jestli mi to do hodiny nevrátíte, podám na vás trestní oznámení za zpronevěru! Mám to nahrané!',
    volby: [
      { text: 'Leknout se a peníze poslat', cil: 'omyl_vraceno', hodnoceni: 'chyba', proc: 'Výhrůžky jsou nátlak. Pokud něco opravdu poslal omylem, jeho banka to vyřeší i bez vás.' },
      { text: 'Klidně zopakovat „Řeší to moje banka“ a zavěsit', cil: 'omyl_3', hodnoceni: 'ok', proc: 'Správně. Nemusíte se obhajovat ani vysvětlovat. Stačí zavěsit.' }
    ] },
  omyl_3: { kdo: 'hovor', od: 'Vaše banka (číslo z aplikace)',
    text: 'Zavoláte do banky na číslo z aplikace. Bankéřka platbu dohledá.',
    rec: 'Peníze prosím nechte ležet a nepoužívejte je. Pokud odesílatel požádá svou banku o vrácení, vyřídíme to mezi bankami. Podezřelé hovory si poznamenáme.',
    volby: [
      { text: 'Peníze nechat ležet a dál nereagovat', cil: 'omyl_dobre', hodnoceni: 'ok', proc: 'Správně. Peníze nejsou vaše, ale vracení je věc bank.' },
      { text: 'Když už tam jsou, utratit je – nějak se to vyřeší', cil: 'omyl_utraceno', hodnoceni: 'chyba', proc: 'Peníze vám nepatří. Až o ně banka odesílatele požádá, budete je muset vrátit.' }
    ] },
  omyl_dobre: { konec: 'omyl_dobre',
    text: 'Po týdnu banka peníze vrátí na původní účet – ukázalo se, že pocházely z napadeného účtu. Vy jste nic nepřevedli, nikomu nic nedlužíte a nestali jste se „bílým koněm“, přes kterého se perou peníze.' },
  omyl_utraceno: { konec: 'omyl_utraceno',
    text: 'Za týden banka oznámí, že odesílatel žádá vrácení. Peníze jsou utracené, takže je musíte doplatit z vlastního. Podvodníkům jste neposlali nic, ale vyhnout se tomu šlo snadno.' },
  omyl_vraceno: { konec: 'omyl_vraceno',
    text: 'Peníze odejdou. Za týden si původní platbu stáhne banka odesílatele – šlo o peníze z napadeného účtu. Na vašem účtu chybí 8 500 Kč podruhé a navíc vás policie vyslechne jako možného „bílého koně“.' },

  /* ===== 🛒 Bazar s kurýrem ===== */
  bazar_1: { kdo: 'chat', od: 'Kupující z bazaru',
    text: 'Na bazaru prodáváte dětský kočárek za 3 500 Kč. Za pět minut po zveřejnění přijde zpráva.',
    rec: 'Dobrý den, beru bez prohlížení! Pošlu kurýra a zaplatím přes bezpečnou platbu dopravce. Pošlu vám odkaz, kde si peníze přijmete.',
    volby: [
      { text: '„Super, pošlete odkaz.“', cil: 'bazar_odkaz', hodnoceni: 'chyba', proc: 'Prodávající peníze nepřijímá přes odkaz od kupce. Taková „bezpečná platba“ je podvodná stránka.' },
      { text: '„Jen osobní předání, nebo převod předem na můj účet.“', cil: 'bazar_2', hodnoceni: 'ok', proc: 'Správně. Vy určujete, jak se platí – a ke zaplacení stačí číslo vašeho účtu.' }
    ] },
  bazar_2: { kdo: 'chat', od: 'Kupující z bazaru',
    text: 'Kupec se nevzdává.',
    rec: 'Osobně nemůžu, jsem pracovně v zahraničí. Napište mi na WhatsApp, kolegyně z podpory dopravce vám to vysvětlí, je to úplně bezpečné 🙂',
    volby: [
      { text: 'Přejít na WhatsApp, ať to vysvětlí', cil: 'bazar_odkaz', hodnoceni: 'chyba', proc: 'Přetažení mimo bazar je klasický tah – ztratíte ochranu bazaru a přijde podvodný odkaz.' },
      { text: 'Odmítnout a inzerát nechat dál', cil: 'bazar_dobre', hodnoceni: 'ok', proc: 'Správně. Skutečný kupec se domluví po vašem.' }
    ] },
  bazar_odkaz: { kdo: 'web', od: 'bezpecna-platba-doprava.top',
    text: 'Odkaz otevře stránku s logem dopravce: „Kupující zaplatil 3 500 Kč. Pro připsání peněz zadejte údaje své karty.“ Chce číslo karty, platnost a CVV.',
    rec: 'Přijmout platbu: 3 500,00 Kč. Zadejte číslo karty, platnost a CVV.',
    volby: [
      { text: 'Vyplnit kartu, ať peníze přijdou', cil: 'bazar_kod', hodnoceni: 'chyba', proc: 'K přijetí peněz se nikdy nezadává karta, natož CVV. Ty slouží k placení.' },
      { text: 'Proč bych k přijetí peněz zadával CVV? Zavřít to', cil: 'bazar_zavreno', hodnoceni: 'ok', proc: 'Přesně tak. CVV slouží k placení, ne k přijímání.' }
    ] },
  bazar_kod: { kdo: 'banka', od: 'SMS z vaší banky',
    text: 'Stránka napíše „Pro dokončení zadejte ověřovací kód“. Přijde SMS z vaší banky.',
    rec: 'Kod 731065 pro pridani karty *4821 do mobilni penezenky. Pokud jste o to nezadali, kod nikomu nesdelujte.',
    volby: [
      { text: 'Opsat kód do stránky', cil: 'bazar_prohra', hodnoceni: 'chyba', proc: 'Kód přidává vaši kartu do cizího mobilu. Podvodník pak platí vaší kartou přiložením telefonu.' },
      { text: 'Kód nezadat a volat bance, ať kartu zablokuje', cil: 'bazar_castecne', hodnoceni: 'ok', proc: 'Správně – SMS jasně říká, k čemu kód je. Kartu s vyzrazenými údaji je nutné zablokovat.' }
    ] },
  bazar_zavreno: { kdo: 'chat', od: 'Kupující z bazaru',
    text: 'Kupec píše dál: „Co se děje? Kolegyně čeká, peníze propadnou!“',
    volby: [
      { text: 'Nereagovat, profil nahlásit bazaru a zablokovat', cil: 'bazar_dobre', hodnoceni: 'ok', proc: 'Správně. Nahlášení ochrání i další prodávající.' },
      { text: 'Zkusit to přece jen znovu', cil: 'bazar_odkaz', hodnoceni: 'chyba', proc: 'Spěch („peníze propadnou“) je nátlak. Nic nepropadne – žádné peníze nikdy nebyly.' }
    ] },
  bazar_dobre: { konec: 'bazar_dobre',
    text: 'Podvodný „kupec“ zmizí. O dva dny později si kočárek osobně vyzvedne maminka z vedlejší vesnice a zaplatí v hotovosti. Karta zůstala v šuplíku.' },
  bazar_castecne: { konec: 'bazar_castecne',
    text: 'Banka kartu zablokuje dřív, než ji podvodník stihne použít. Nic se neztratilo, ale čeká vás nová karta. Příště stačí zavřít stránku, která chce kartu „k přijetí peněz“.' },
  bazar_prohra: { konec: 'bazar_prohra',
    text: 'Za hodinu přijdou upozornění na platby: elektronika, poukázky, výběry. Podvodník má kartu ve svém mobilu. Okamžitě volejte bance a kartu zablokujte; platby potvrzené kódem banka často nevrátí.' },

  /* ===== 🎙️ „Hovor nahráváme, souhlasíte?“ ===== */
  nahravani_1: { kdo: 'hovor', od: '+420 910 ··· ··· (neznámé číslo)',
    text: 'Zvoní telefon, neznámé číslo. Hovor přijmete. Jak se ozvete?',
    volby: [
      { text: '„Ano?“', cil: 'nahravani_2', hodnoceni: 'chyba', proc: 'I obyčejné „Ano?“ na začátku hovoru se dá nahrát a použít. Lepší je „Prosím?“ nebo „Co potřebujete?“.' },
      { text: '„Prosím?“', cil: 'nahravani_2', hodnoceni: 'ok', proc: 'Správně – neutrální pozdrav, ze kterého se souhlas vystřihnout nedá.' },
      { text: 'Nezvedat; kdo něco chce, ozve se znovu nebo napíše', cil: 'nahravani_dobre', hodnoceni: 'ok', proc: 'I to je v pořádku. Neznámé číslo zvedat nemusíte.' }
    ] },
  nahravani_2: { kdo: 'hovor', od: '+420 910 ··· ···',
    text: 'Ozve se příjemný ženský hlas.',
    rec: 'Dobrý den, volám z energetické poradny. Hovor je nahráván pro zkvalitnění služeb. Souhlasíte s nahráváním?',
    volby: [
      { text: '„Ano.“', cil: 'nahravani_ano', hodnoceni: 'chyba', proc: 'Souhlas s nahráváním je přesně to „ano“, které chtějí mít na záznamu.' },
      { text: '„Ne.“ – a zavěsit', cil: 'nahravani_dobre', hodnoceni: 'ok', proc: 'Výborně. Na nahrávání NE a zavěsit.' },
      { text: '„Ne, ale co nabízíte?“', cil: 'nahravani_nabidka', hodnoceni: '', proc: 'NE je správně, ale nemáte povinnost nabídku poslouchat. Každá další minuta je další nahrávka vašeho hlasu.' }
    ] },
  nahravani_ano: { kdo: 'hovor', od: '+420 910 ··· ···',
    text: 'Otázky přicházejí rychle za sebou.',
    rec: 'Děkuji. Jste majitel odběrného místa? Platíte za elektřinu víc než dva tisíce měsíčně? Chtěli byste platit méně?',
    volby: [
      { text: 'Odpovídat „ano, ano, ano“', cil: 'nahravani_smlouva', hodnoceni: 'chyba', proc: 'Otázky jsou poskládané tak, aby padalo „ano“. Na záznamu pak bude znít jako souhlas se smlouvou.' },
      { text: '„Nemám zájem, nashledanou.“ – zavěsit', cil: 'nahravani_castecne', hodnoceni: 'ok', proc: 'Dobře – zavěsit jde kdykoli, i uprostřed věty.' }
    ] },
  nahravani_nabidka: { kdo: 'hovor', od: '+420 910 ··· ···',
    text: 'Operátorka spustí naučenou řeč.',
    rec: 'Můžete ušetřit až třicet procent! Stačí mi potvrdit vaše jméno a nadiktovat číslo odběrného místa z faktury, zbytek zařídíme za vás.',
    volby: [
      { text: 'Vzít fakturu a nadiktovat číslo', cil: 'nahravani_smlouva', hodnoceni: 'chyba', proc: 'S číslem odběrného místa a nahraným hlasem vás můžou převést k jinému dodavateli bez vašeho vědomí.' },
      { text: '„Nemám zájem.“ – a zavěsit', cil: 'nahravani_dobre', hodnoceni: 'ok', proc: 'Správně. Nabídku poslouchat nemusíte a zavěsit není neslušné.' }
    ] },
  nahravani_dobre: { konec: 'nahravani_dobre',
    text: 'Hovor je u konce dřív, než mohl začít. Na nahrávce není žádné „ano“, žádné jméno ani číslo z faktury. Z pár slov nejde poskládat souhlas ani věrohodný hlas.' },
  nahravani_castecne: { konec: 'nahravani_castecne',
    text: 'Zavěsili jste včas, ale jedno „ano“ na nahrávce už je. Dá se vystřihnout a vložit za jinou otázku a z nahraných slabik lze AI dogenerovat hlas. Kdyby přišla nečekaná smlouva, písemně ji odmítněte a ohlaste to.' },
  nahravani_smlouva: { konec: 'nahravani_smlouva',
    text: 'Za dva týdny přijde dopis: „Vítáme vás jako nového zákazníka“ – smlouva s dražším dodavatelem a pokuta za odstoupení. Na nahrávce zní vaše „ano“ jako souhlas. Smlouvu hned písemně odmítněte (od smlouvy po telefonu lze do 14 dnů odstoupit) a obraťte se na ERÚ nebo spotřebitelskou poradnu.' },

  /* ===== 🖥️ Falešná technická podpora ===== */
  podpora_1: { kdo: 'web', od: 'Okno přes celou obrazovku',
    text: 'Při čtení zpráv na internetu se najednou obrazovka zbarví do modra a z reproduktorů houká siréna.',
    rec: '⚠️ VÁŠ POČÍTAČ JE NAPADEN VIREM! Nevypínejte jej, hrozí ztráta dat a hesel do bankovnictví. Okamžitě volejte podporu Windows: +420 2·· ··· ···',
    volby: [
      { text: 'Zavolat na číslo z okna', cil: 'podpora_hovor', hodnoceni: 'chyba', proc: 'Žádná firma nezobrazuje varování s telefonním číslem. Volali byste přímo podvodníkům.' },
      { text: 'Zavřít okno (Ctrl+W, Alt+F4), případně restartovat počítač', cil: 'podpora_zavreno', hodnoceni: 'ok', proc: 'Správně. Je to jen webová stránka, která straší. Zavřením zmizí.' }
    ] },
  podpora_hovor: { kdo: 'hovor', od: '„technik podpory“',
    text: 'Telefon zvedne ochotný hlas s cizím přízvukem.',
    rec: 'Ano, vidím, že váš počítač posílá chybová hlášení. Abych virus odstranil, nainstalujte si program AnyDesk a přečtěte mi číslo, které vám ukáže.',
    volby: [
      { text: 'Nainstalovat program a nadiktovat kód', cil: 'podpora_vzdalene', hodnoceni: 'chyba', proc: 'Tím dáte cizímu člověku plnou vládu nad počítačem.' },
      { text: 'Zavěsit a okno zavřít', cil: 'podpora_zavreno', hodnoceni: 'ok', proc: 'Správně – i zavěšení v půlce hovoru je dobré rozhodnutí.' }
    ] },
  podpora_vzdalene: { kdo: 'hovor', od: '„technik podpory“',
    text: 'Myš se sama pohybuje po obrazovce. „Technik“ otevírá okna s ošklivě vypadajícími hlášeními.',
    rec: 'Vidíte? Samé viry. Teď se přihlaste do internetového bankovnictví, ověříme, že vám nic neukradli.',
    volby: [
      { text: 'Přihlásit se do bankovnictví', cil: 'podpora_prohra', hodnoceni: 'chyba', proc: 'Kdo vidí vaši obrazovku a ovládá myš, uvidí i vaše přihlášení a může zadat platbu.' },
      { text: 'Odpojit internet (Wi-Fi nebo kabel) a zavěsit', cil: 'podpora_odpojit', hodnoceni: 'ok', proc: 'Správně. Bez internetu se k počítači už nedostane.' }
    ] },
  podpora_odpojit: { kdo: 'situace',
    text: 'Počítač je offline, hovor ukončený. Podvodník ale měl chvíli přístup do počítače.',
    volby: [
      { text: 'Zavolat bance, z jiného zařízení změnit hesla a nechat počítač zkontrolovat', cil: 'podpora_castecne', hodnoceni: 'ok', proc: 'Správně – banka zpozorní na podezřelé platby, nová hesla zavřou dveře.' },
      { text: 'Program pro vzdálený přístup odinstalovat a víc neřešit', cil: 'podpora_castecne', hodnoceni: '', proc: 'Odinstalace pomůže, ale podvodník mohl nechat jiný program nebo si opsat hesla. Bance a změně hesel se vyplatí věnovat deset minut.' }
    ] },
  podpora_zavreno: { kdo: 'situace',
    text: 'Okno zmizí a siréna utichne. Počítač normálně běží.',
    volby: [
      { text: 'Pro klid duše spustit antivirovou kontrolu', cil: 'podpora_dobre', hodnoceni: 'ok', proc: 'Rozumné. Kontrola nic nenajde – šlo jen o strašicí reklamu.' },
      { text: 'Nechat to být, nic se nestalo', cil: 'podpora_dobre', hodnoceni: 'ok', proc: 'Taky správně. Stránka nic nenainstalovala, jen strašila.' }
    ] },
  podpora_dobre: { konec: 'podpora_dobre',
    text: 'Počítač je v pořádku a do hovoru s „technikem“ vůbec nedošlo. Takové okno je jen webová stránka – vyskočí třeba z podvodné reklamy a jediné, co umí, je strašit.' },
  podpora_castecne: { konec: 'podpora_castecne',
    text: 'Včasné odpojení zabránilo nejhoršímu. Banka hlídá účet, hesla jsou nová a počítač prošel kontrolou. Příště stačí okno zavřít – a nikomu neinstalovat vzdálený přístup.' },
  podpora_prohra: { konec: 'podpora_prohra',
    text: 'Během „kontroly“ zmizí z účtu 60 000 Kč – „technik“ zadal platbu, zatímco vám ukazoval falešná hlášení. Okamžitě odpojte internet, volejte bance a změňte všechna hesla z jiného zařízení.' }
};

const konce = {
  banka_dobre: { typ: 'vyhra', nazev: 'Ověřeno u banky', popis: 'Zavěsit a volat na známé číslo' },
  banka_kod: { typ: 'prohra', nazev: 'Kód z SMS', popis: 'Nadiktovaný kód potvrdil platbu' },
  banka_prevod: { typ: 'prohra', nazev: 'Bezpečný účet', popis: 'Převod na „bezpečný účet“' },
  banka_bitcoin: { typ: 'prohra', nazev: 'Falešný policista', popis: 'Hotovost do bitcoinomatu' },
  balik_dobre: { typ: 'vyhra', nazev: 'Balík ověřen', popis: 'Ověření v aplikaci dopravce' },
  balik_zachrana: { typ: 'castecne', nazev: 'Karta zablokována', popis: 'Zastavení na poslední chvíli' },
  balik_prohra: { typ: 'prohra', nazev: 'Doplatek za clo', popis: 'Kód potvrdil cizí platbu' },
  mami_dobre: { typ: 'vyhra', nazev: 'Staré číslo', popis: 'Ověření na starém čísle' },
  mami_prohra: { typ: 'prohra', nazev: 'Faktura pro „syna“', popis: 'Platba na nové číslo bez ověření' },
  vnuk_dobre: { typ: 'vyhra', nazev: 'Rodinné heslo', popis: 'Zavolat na známé číslo vnuka' },
  vnuk_policie: { typ: 'vyhra', nazev: 'Kurýr zadržen', popis: 'Volat 158 místo otevírání dveří' },
  vnuk_prohra: { typ: 'prohra', nazev: 'Kauce přes kurýra', popis: 'Obálka předaná kurýrovi' },
  omyl_dobre: { typ: 'vyhra', nazev: 'Řeší banka', popis: 'Nechat to na své bance' },
  omyl_utraceno: { typ: 'castecne', nazev: 'Utracené cizí', popis: 'Cizí peníze je třeba vrátit' },
  omyl_vraceno: { typ: 'prohra', nazev: 'Vráceno podvodníkovi', popis: 'Vlastní vrácení „omylu“' },
  bazar_dobre: { typ: 'vyhra', nazev: 'Prodáno osobně', popis: 'Platba podle prodávajícího' },
  bazar_castecne: { typ: 'castecne', nazev: 'Karta zablokována', popis: 'Kód nezadaný, karta nová' },
  bazar_prohra: { typ: 'prohra', nazev: 'Karta v cizím mobilu', popis: 'Kód přidal kartu podvodníkovi' },
  nahravani_dobre: { typ: 'vyhra', nazev: 'Bez „ano“', popis: 'NE na nahrávání a zavěsit' },
  nahravani_castecne: { typ: 'castecne', nazev: 'Jedno „ano“', popis: 'Zavěšeno, ale po prvním „ano“' },
  nahravani_smlouva: { typ: 'prohra', nazev: 'Smlouva z nahrávky', popis: 'Souhlas poskládaný z nahrávky' },
  podpora_dobre: { typ: 'vyhra', nazev: 'Okno zavřeno', popis: 'Zavřít strašicí okno' },
  podpora_castecne: { typ: 'castecne', nazev: 'Odpojeno včas', popis: 'Odpojit internet a volat bance' },
  podpora_prohra: { typ: 'prohra', nazev: 'Technik v bance', popis: 'Bankovnictví při vzdáleném přístupu' }
};

const P = { nazev: 'Trénink: podvodný hovor a SMS', klic: 'webapp_trenink_podvodu', start: 'rozcesti', smrt: 'rozcesti', tma: 'rozcesti',
  zacatek: {}, predmety: {}, sceny, konce, scenare: SCENARE };
if (typeof module !== 'undefined') module.exports = P; else window.TRENINK_PRIBEH = P;
})();
