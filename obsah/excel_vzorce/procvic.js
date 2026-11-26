/* Generátor procvičovacích úloh (window.XLV_PROCVIC). Každá úloha má náhodná data a referenční řešení
   v anglickém zápisu; kontroluje ji XLV.zkontroluj stejně jako úlohy lekcí. Bez DOM – test _test/excel_vzorce_procvic_test.js. */
(function (koren) {
'use strict';
const TEMATA = {
  zaklady: '✏️ Vzorce a operátory', odkazy: '📌 Kopírování a $', funkce: '∑ Základní funkce', zaokrouhleni: '🎯 Zaokrouhlování',
  kdyz: '🔀 KDYŽ', logika: '🧩 A, NEBO, vnořené KDYŽ', podminene: '🔢 COUNTIF a SUMIF', hledani: '🔎 Vyhledávání',
  text: '🔤 Text', datum: '📅 Datum', chyby: '🐞 Ošetření chyb', oprava: '🔧 Oprav vzorec',
};
const JMENA = ['Adam', 'Bára', 'Cyril', 'Dana', 'Emil', 'Fanny', 'Gustav', 'Hana', 'Igor', 'Jana', 'Karel', 'Lenka'];
const PRIJMENI = ['Novák', 'Svoboda', 'Dvořák', 'Černá', 'Procházka', 'Kučerová', 'Veselý', 'Horák', 'Němcová', 'Marek'];
/* celé jméno se shodou rodu: Hana Nováková, Emil Černý */
const ZENSKE = { Novák: 'Nováková', Svoboda: 'Svobodová', Dvořák: 'Dvořáková', Procházka: 'Procházková', Veselý: 'Veselá', Horák: 'Horáková', Marek: 'Marková' };
const MUZSKE = { Černá: 'Černý', Kučerová: 'Kučera', Němcová: 'Němec' };
const ZENY = new Set(['Bára', 'Dana', 'Fanny', 'Hana', 'Jana', 'Lenka']);
const celeJmeno = (j, p) => j + ' ' + (ZENY.has(j) ? ZENSKE[p] || p : MUZSKE[p] || p);
const MESTA = ['Praha', 'Brno', 'Ostrava', 'Plzeň', 'Olomouc'];
const ZBOZI = ['Pero', 'Sešit', 'Guma', 'Lepidlo', 'Pravítko', 'Fixa', 'Blok', 'Nůžky', 'Kružítko', 'Barvy'];

function nahoda(seme) {
  let s = (seme >>> 0) || (Math.random() * 2147483646 + 1) | 0;
  const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  r(); r(); r();   /* malá semínka dávají první čísla těsně nad nulou */
  return {
    r, cele: (a, b) => a + Math.floor(r() * (b - a + 1)), vyber: p => p[Math.floor(r() * p.length)],
    zamichej: p => { const q = [...p]; for (let i = q.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [q[i], q[j]] = [q[j], q[i]]; } return q; },
  };
}
const des = (x, jen = 2) => String(Number(x.toFixed(jen)));   /* anglický zápis čísla do dat */

/* šablony: (n) => úloha; úroveň 1 = lehká, 2 = střední, 3 = těžká */
const SABLONY = [
  { tema: 'zaklady', uroven: 1, gen(n) {
    const k = n.cele(4, 6), b = { A1: 'Zboží', B1: 'Cena', C1: 'Kusů', D1: 'Celkem' };
    n.zamichej(ZBOZI).slice(0, k).forEach((z, i) => { b['A' + (i + 2)] = z; b['B' + (i + 2)] = String(n.cele(5, 90)); b['C' + (i + 2)] = String(n.cele(1, 12)); });
    return { bunky: b, cil: 'D2', kopirovat: `D2:D${k + 1}`, reseni: '=B2*C2', zadani: `Do [[@D2]] spočítejte cenu za všechny kusy a vzorec zkopírujte až do D${k + 1}.`, napovedy: ['Cena × počet kusů.'] };
  } },
  { tema: 'zaklady', uroven: 2, gen(n) {
    const k = n.cele(4, 6), pr = n.cele(1, 4) * 5, b = { A1: 'Zboží', B1: 'Cena', C1: 'Po slevě', E1: 'Sleva', F1: pr + '%' };
    n.zamichej(ZBOZI).slice(0, k).forEach((z, i) => { b['A' + (i + 2)] = z; b['B' + (i + 2)] = String(n.cele(50, 900)); });
    return { bunky: b, cil: 'C2', kopirovat: `C2:C${k + 1}`, absolutni: true, reseni: '=B2*(1-$F$1)', zadani: `Sleva je v [[@F1]]. Do [[@C2]] spočítejte cenu po slevě tak, aby šel vzorec zkopírovat do C${k + 1}.`, napovedy: ['Cena po slevě = cena × (1 − sleva).', 'Sleva se při kopírování nesmí posouvat → $F$1.'] };
  } },
  { tema: 'zaklady', uroven: 3, gen(n) {
    const a = n.cele(2, 9), c = n.cele(2, 9), d = n.cele(2, 5);
    return { bunky: { A1: 'a', B1: String(a), A2: 'b', B2: String(c), A3: 'c', B3: String(d), A5: 'Výsledek' }, cil: 'B5', reseni: '=(B1+B2)^2/B3',
      zadani: 'Do [[@B5]] spočítejte (a + b)² ÷ c. Pozor na pořadí operací.', napovedy: ['Mocnina se píše ^.', 'Sčítání musí být v závorce: (B1+B2)^2/B3.'] };
  } },
  { tema: 'odkazy', uroven: 2, gen(n) {
    const kurz = des(n.cele(230, 270) / 10, 1), mena = n.vyber(['€', '$']), k = n.cele(3, 5), b = { A1: `Kurz ${mena}`, B1: kurz, A3: 'Položka', B3: `Cena ${mena}`, C3: 'Cena Kč' };
    n.zamichej(ZBOZI).slice(0, k).forEach((z, i) => { b['A' + (i + 4)] = z; b['B' + (i + 4)] = String(n.cele(3, 80)); });
    return { bunky: b, cil: 'C4', kopirovat: `C4:C${k + 3}`, absolutni: true, chranit: ['B1'], reseni: '=B4*$B$1', zadani: `Do [[@C4]] přepočtěte cenu na koruny (kurz v [[@B1]]) a zkopírujte do C${k + 3}.`, napovedy: ['Kurz je jen v B1 → $B$1 (F4).'] };
  } },
  { tema: 'odkazy', uroven: 3, gen(n) {
    const k = n.cele(4, 5), b = { A1: 'Prodejce', B1: 'Tržba', C1: 'Podíl' };
    n.zamichej(JMENA).slice(0, k).forEach((j, i) => { b['A' + (i + 2)] = j; b['B' + (i + 2)] = String(n.cele(10, 99) * 100); });
    b['A' + (k + 2)] = 'Celkem'; b['B' + (k + 2)] = `=SUM(B2:B${k + 1})`;
    return { bunky: b, cil: 'C2', kopirovat: `C2:C${k + 1}`, absolutni: true, reseni: `=B2/$B$${k + 2}`, zadani: `Do [[@C2]] spočítejte, jakou část celkové tržby (B${k + 2}) udělal prodejce. Vzorec zkopírujte do C${k + 1}.`, napovedy: ['Podíl = tržba ÷ celkem.', `Celkem je jen v B${k + 2} → ukotvit řádek: B$${k + 2} nebo $B$${k + 2}.`] };
  } },
  { tema: 'funkce', uroven: 1, gen(n) {
    const f = n.vyber([['SUM', 'součet', 'Součet'], ['AVERAGE', 'průměr', 'Průměr'], ['MAX', 'nejvyšší hodnotu', 'Nejvyšší'], ['MIN', 'nejnižší hodnotu', 'Nejnižší']]), k = n.cele(5, 8), b = { A1: 'Den', B1: 'Teplota' };
    for (let i = 0; i < k; i++) { b['A' + (i + 2)] = String(i + 1) + '.'; b['B' + (i + 2)] = String(n.cele(-5, 30)); }
    b.D1 = f[2] + ':';
    return { bunky: b, cil: 'E1', vyzaduje: [f[0]], reseni: `=${f[0]}(B2:B${k + 1})`, zadani: `Do [[@E1]] spočítejte ${f[1]} teplot z B2:B${k + 1}.`, napovedy: [`Funkce {${f[0]}}(oblast).`] };
  } },
  { tema: 'funkce', uroven: 2, gen(n) {
    const k = n.cele(6, 8), b = { A1: 'Žák', B1: 'Body' };
    n.zamichej(JMENA).slice(0, k).forEach((j, i) => { b['A' + (i + 2)] = j; b['B' + (i + 2)] = n.r() < 0.25 ? 'chyběl' : String(n.cele(10, 50)); });
    b.D1 = 'Psalo test:';
    return { bunky: b, cil: 'E1', reseni: `=COUNT(B2:B${k + 1})`,
      varianty: [{ B2: b.B2 === 'chyběl' ? '25' : 'chyběl' }, { B3: b.B3 === 'chyběl' ? '40' : 'chyběl', B4: b.B4 === 'chyběl' ? '18' : 'chyběl' }],   /* jiný počet chybějících – opsané číslo neprojde */ zadani: `Někteří žáci chyběli (místo bodů mají text). Do [[@E1]] spočítejte, kolik žáků test psalo.`, napovedy: ['Počítají se jen buňky s číslem.', '{COUNT}, ne {COUNTA}.'] };
  } },
  { tema: 'zaokrouhleni', uroven: 1, gen(n) {
    const d = n.vyber([0, 1, 2]);
    return { bunky: { A1: 'Cena bez DPH', B1: des(n.cele(1000, 99999) / 100), A2: 'DPH', B2: '21%', A3: 'Cena s DPH' }, cil: 'B3', vyzaduje: ['ROUND'], reseni: `=ROUND(B1*(1+B2),${d})`,
      zadani: `Do [[@B3]] spočítejte cenu s DPH zaokrouhlenou na ${d === 0 ? 'celé koruny' : d === 1 ? '1 desetinné místo' : 'haléře (2 desetinná místa)'}.`, napovedy: ['Cena s DPH: B1*(1+B2).', `Obalte {ROUND}(…{;}${d}).`] };
  } },
  { tema: 'zaokrouhleni', uroven: 2, gen(n) {
    const lidi = n.cele(23, 140), mist = n.vyber([8, 12, 45, 50]), co = mist > 20 ? 'autobusů' : 'aut';
    return { bunky: { A1: 'Účastníků', B1: String(lidi), A2: 'Míst ve vozidle', B2: String(mist), A3: `Potřeba ${co}` }, cil: 'B3', vyzaduje: ['ROUNDUP'], reseni: '=ROUNDUP(B1/B2,0)',
      zadani: `Do [[@B3]] spočítejte, kolik ${co} je potřeba (nikdo nesmí zůstat doma).`, napovedy: ['Vydělte a zaokrouhlete vždy NAHORU.', '{ROUNDUP}(B1/B2{;}0)'] };
  } },
  { tema: 'kdyz', uroven: 1, gen(n) {
    const k = n.cele(5, 7), hr = n.cele(4, 7) * 10, b = { A1: 'Žák', B1: 'Body', C1: 'Výsledek', E1: 'Hranice', F1: String(hr) };
    n.zamichej(JMENA).slice(0, k).forEach((j, i) => { b['A' + (i + 2)] = j; b['B' + (i + 2)] = String(n.cele(20, 100)); });
    const [ano, ne] = n.vyber([['prospěl', 'neprospěl'], ['ano', 'ne'], ['OK', 'opravit']]);
    return { bunky: b, cil: 'C2', kopirovat: `C2:C${k + 1}`, absolutni: true, vyzaduje: ['IF'], reseni: `=IF(B2>=$F$1,"${ano}","${ne}")`,
      zadani: `Do [[@C2]] vypište „${ano}“, když má žák aspoň tolik bodů jako hranice v F1, jinak „${ne}“. Zkopírujte do C${k + 1}.`, napovedy: ['{IF}(podmínka{;} ano{;} ne)', 'Hranici ukotvěte $F$1, texty dejte do uvozovek.'] };
  } },
  { tema: 'kdyz', uroven: 2, gen(n) {
    const k = n.cele(5, 7), hr = n.cele(2, 5) * 1000, pr = n.cele(1, 3) * 5, b = { A1: 'Objednávka', B1: 'Částka', C1: 'Sleva', E1: 'Sleva od', F1: String(hr), E2: 'Sleva %', F2: pr + '%' };
    for (let i = 0; i < k; i++) { b['A' + (i + 2)] = 'OBJ-' + (100 + i); b['B' + (i + 2)] = String(n.cele(5, 80) * 100); }
    return { bunky: b, cil: 'C2', kopirovat: `C2:C${k + 1}`, absolutni: true, vyzaduje: ['IF'], reseni: '=IF(B2>=$F$1,B2*$F$2,0)',
      zadani: `Do [[@C2]] spočítejte slevu: od částky v F1 je sleva F2 z částky, jinak 0. Zkopírujte do C${k + 1}.`, napovedy: ['Větev „ano“ je výpočet B2*$F$2.'] };
  } },
  { tema: 'logika', uroven: 2, gen(n) {
    const k = n.cele(5, 7), b = { A1: 'Uchazeč', B1: 'Test', C1: 'Praxe (roky)', D1: 'Pozvat' };
    n.zamichej(JMENA).slice(0, k).forEach((j, i) => { b['A' + (i + 2)] = j; b['B' + (i + 2)] = String(n.cele(30, 100)); b['C' + (i + 2)] = String(n.cele(0, 8)); });
    const t = n.cele(6, 8) * 10, p = n.cele(2, 4), nebo = n.r() < 0.4;
    return { bunky: b, cil: 'D2', kopirovat: `D2:D${k + 1}`, vyzaduje: [nebo ? 'OR' : 'AND'], reseni: `=IF(${nebo ? 'OR' : 'AND'}(B2>=${t},C2>=${p}),"ano","ne")`,
      zadani: `Do [[@D2]] napište „ano“, když má uchazeč ${nebo ? '<b>aspoň jedno</b>' : '<b>obojí</b>'}: test aspoň ${t} bodů ${nebo ? 'NEBO' : 'A ZÁROVEŇ'} praxi aspoň ${p} roky; jinak „ne“. Zkopírujte do D${k + 1}.`,
      napovedy: [`Spojte podmínky funkcí {${nebo ? 'OR' : 'AND'}} a vložte ji do {IF}.`] };
  } },
  { tema: 'logika', uroven: 3, gen(n) {
    const k = n.cele(5, 7), b = { A1: 'Zákazník', B1: 'Nákupy Kč', C1: 'Úroveň' };
    n.zamichej(PRIJMENI).slice(0, k).forEach((j, i) => { b['A' + (i + 2)] = j; b['B' + (i + 2)] = String(n.cele(1, 60) * 1000); });
    const h1 = n.cele(30, 40) * 1000, h2 = n.cele(10, 20) * 1000;
    return { bunky: b, cil: 'C2', kopirovat: `C2:C${k + 1}`, reseni: `=IF(B2>=${h1},"zlatý",IF(B2>=${h2},"stříbrný","běžný"))`,
      zadani: `Do [[@C2]] určete úroveň zákazníka: od ${h1} Kč „zlatý“, od ${h2} Kč „stříbrný“, jinak „běžný“. Zkopírujte do C${k + 1}.`, napovedy: ['Začněte nejvyšší hranicí.', 'Vnořené {IF} nebo {IFS}.'] };
  } },
  { tema: 'podminene', uroven: 1, gen(n) {
    const k = n.cele(7, 9), b = { A1: 'Prodejce', B1: 'Město', C1: 'Částka' }, m = n.vyber(MESTA);
    for (let i = 0; i < k; i++) { b['A' + (i + 2)] = n.vyber(PRIJMENI); b['B' + (i + 2)] = i === 0 ? m : n.vyber(MESTA.slice(0, 3).concat(m)); b['C' + (i + 2)] = String(n.cele(5, 90) * 100); }
    const sum = n.r() < 0.5;
    return { bunky: b, cil: 'F1', vyzaduje: [sum ? 'SUMIF' : 'COUNTIF'], reseni: sum ? `=SUMIF(B2:B${k + 1},"${m}",C2:C${k + 1})` : `=COUNTIF(B2:B${k + 1},"${m}")`,
      zadani: `Do [[@F1]] ${sum ? 'sečtěte částky obchodů' : 'spočítejte obchody'} z města ${m}.`, napovedy: [sum ? '{SUMIF}(oblast_měst{;}"město"{;}oblast_částek)' : '{COUNTIF}(oblast_měst{;}"město")'] };
  } },
  { tema: 'podminene', uroven: 2, gen(n) {
    const k = n.cele(7, 9), b = { A1: 'Položka', B1: 'Cena', E1: 'Dražší než', F1: String(n.cele(3, 7) * 100), E2: 'Počet' };
    n.zamichej(ZBOZI).slice(0, k).forEach((z, i) => { b['A' + (i + 2)] = z; b['B' + (i + 2)] = String(n.cele(50, 990)); });
    return { bunky: b, cil: 'F2', vyzaduje: ['COUNTIF'], varianty: [{ F1: '200' }, { F1: '800' }], reseni: `=COUNTIF(B2:B${k + 1},">"&F1)`,
      zadani: 'Do [[@F2]] spočítejte položky dražší než hodnota v [[@F1]]. Vzorec musí reagovat na změnu F1.', napovedy: ['Kritérium složte: ">"&F1.'] };
  } },
  { tema: 'hledani', uroven: 2, gen(n) {
    const k = n.cele(5, 7), b = { A1: 'Kód', B1: 'Zboží', C1: 'Cena' }, z = n.zamichej(ZBOZI).slice(0, k);
    z.forEach((x, i) => { b['A' + (i + 2)] = x.slice(0, 2).toUpperCase() + (10 + i); b['B' + (i + 2)] = x; b['C' + (i + 2)] = String(n.cele(5, 150)); });
    const ci = n.cele(2, k + 1), chceCenu = n.r() < 0.6;
    b.E1 = 'Kód:'; b.F1 = b['A' + ci]; b.E2 = chceCenu ? 'Cena:' : 'Zboží:';
    return { bunky: b, cil: 'F2', varianty: [{ F1: b.A2 }, { F1: b['A' + (k + 1)] }], reseni: `=VLOOKUP(F1,A2:C${k + 1},${chceCenu ? 3 : 2},FALSE)`,
      zadani: `Do [[@F2]] vyhledejte ${chceCenu ? 'cenu' : 'název zboží'} podle kódu v [[@F1]].`, napovedy: ['{VLOOKUP}(F1{;}tabulka{;}číslo_sloupce{;}NEPRAVDA)', 'Kódy chtějí přesnou shodu.'] };
  } },
  { tema: 'hledani', uroven: 3, gen(n) {
    const k = n.cele(5, 6), b = { A1: 'Jméno', B1: 'Osobní číslo' }, j = n.zamichej(JMENA).slice(0, k);
    j.forEach((x, i) => { b['A' + (i + 2)] = x; b['B' + (i + 2)] = String(n.cele(1000, 9999)); });
    b.D1 = 'Číslo:'; b.E1 = b['B' + n.cele(2, k + 1)]; b.D2 = 'Jméno:';
    return { bunky: b, cil: 'E2', varianty: [{ E1: b.B2 }, { E1: b['B' + (k + 1)] }], chranit: Object.keys(b).filter(a => a[0] === 'B' || a === 'E1'), reseni: `=INDEX(A2:A${k + 1},MATCH(E1,B2:B${k + 1},0))`,
      zadani: 'Do [[@E2]] najděte jméno podle osobního čísla v [[@E1]]. Jméno je <b>vlevo</b> od čísla.', napovedy: ['{VLOOKUP} doleva neumí.', '{INDEX}(jména{;} {MATCH}(E1{;} čísla{;} 0)) nebo {XLOOKUP}.'] };
  } },
  { tema: 'text', uroven: 2, gen(n) {
    const k = n.cele(4, 5), b = { A1: 'Celé jméno', B1: n.r() < 0.5 ? 'Jméno' : 'Příjmení' };
    for (let i = 0; i < k; i++) b['A' + (i + 2)] = celeJmeno(n.vyber(JMENA), n.vyber(PRIJMENI));
    const jm = b.B1 === 'Jméno';
    return { bunky: b, cil: 'B2', kopirovat: `B2:B${k + 1}`, varianty: false, reseni: jm ? '=LEFT(A2,FIND(" ",A2)-1)' : '=MID(A2,FIND(" ",A2)+1,100)',
      zadani: `Do [[@B2]] vytáhněte z celého jména ${jm ? 'křestní jméno (před mezerou)' : 'příjmení (za mezerou)'}. Zkopírujte do B${k + 1}.`, napovedy: ['Pozici mezery najde {FIND}(" "{;}A2).', jm ? '{LEFT}(A2{;} pozice−1)' : '{MID}(A2{;} pozice+1{;} 100) nebo {TEXTAFTER}.'] };
  } },
  { tema: 'text', uroven: 1, gen(n) {
    const k = n.cele(4, 5), b = { A1: 'Jméno', B1: 'Příjmení', C1: 'Celé' };
    for (let i = 0; i < k; i++) { b['A' + (i + 2)] = n.vyber(JMENA); b['B' + (i + 2)] = n.vyber(PRIJMENI); }
    const obrat = n.r() < 0.5;
    return { bunky: b, cil: 'C2', kopirovat: `C2:C${k + 1}`, varianty: false, reseni: obrat ? '=B2&", "&A2' : '=A2&" "&B2',
      zadani: obrat ? `Do [[@C2]] složte „Příjmení, Jméno“ (s čárkou a mezerou). Zkopírujte do C${k + 1}.` : `Do [[@C2]] složte celé jméno „Jméno Příjmení“. Zkopírujte do C${k + 1}.`, napovedy: ['Texty spojuje &, mezera je text " ".'] };
  } },
  { tema: 'datum', uroven: 1, gen(n) {
    const d1 = `${n.cele(1, 28)}. ${n.cele(1, 6)}. 2026`, d2 = `${n.cele(1, 28)}. ${n.cele(7, 12)}. 2026`;
    return { bunky: { A1: 'Od', B1: d1, A2: 'Do', B2: d2, A3: 'Dní' }, cil: 'B3', varianty: [{ B1: '1. 2. 2026', B2: '1. 3. 2026' }], reseni: '=B2-B1', zadani: 'Do [[@B3]] spočítejte, kolik dní je mezi daty.', napovedy: ['Datum je číslo – stačí odečíst.'] };
  } },
  { tema: 'datum', uroven: 2, gen(n) {
    const k = n.cele(4, 6), b = { A1: 'Jméno', B1: 'Narozen', C1: n.r() < 0.5 ? 'Rok' : 'Měsíc' }, rok = b.C1 === 'Rok';
    n.zamichej(JMENA).slice(0, k).forEach((j, i) => { b['A' + (i + 2)] = j; b['B' + (i + 2)] = `${n.cele(1, 28)}. ${n.cele(1, 12)}. ${n.cele(1960, 2015)}`; });
    return { bunky: b, cil: 'C2', kopirovat: `C2:C${k + 1}`, vyzaduje: [rok ? 'YEAR' : 'MONTH'], varianty: false, reseni: rok ? '=YEAR(B2)' : '=MONTH(B2)',
      zadani: `Do [[@C2]] vytáhněte z data narození ${rok ? 'rok' : 'měsíc'}. Zkopírujte do C${k + 1}.`, napovedy: [rok ? '{YEAR}(datum)' : '{MONTH}(datum)'] };
  } },
  { tema: 'chyby', uroven: 2, gen(n) {
    const k = n.cele(4, 6), b = { A1: 'Obchod', B1: 'Tržba', C1: 'Zákazníků', D1: 'Na zákazníka' };
    for (let i = 0; i < k; i++) { b['A' + (i + 2)] = n.vyber(MESTA); b['B' + (i + 2)] = String(n.cele(5, 90) * 100); if (i !== 1) b['C' + (i + 2)] = String(n.cele(5, 60)); }
    return { bunky: b, cil: 'D2', kopirovat: `D2:D${k + 1}`, varianty: false, reseni: '=IFERROR(B2/C2,0)',
      zadani: `Do [[@D2]] spočítejte tržbu na zákazníka. Kde počet zákazníků chybí, ukažte 0 místo chyby. Zkopírujte do D${k + 1}.`, napovedy: ['B2/C2 dá u prázdné buňky chybu dělení nulou.', '{IFERROR}(B2/C2{;}0)'] };
  } },
];


/* ---------- „Oprav vzorec“: vezme úlohu jiné šablony a její řešení rozbije typickou chybou ----------
   Rozbitý vzorec je v cílové buňce (i zkopírovaný), žák ho má opravit. Rozbití se ověří: s ním úloha nesmí projít. */
const ROZBITI = [
  { druh: 'dolar', rada: 'Zkuste vzorec zkopírovat a podívejte se, kam se posunuly odkazy. Něco by mělo zůstat na místě.',
    f: (v, u) => (u.absolutni && v.includes('$') ? v.replace(/\$/g, '') : null) },
  { druh: 'zavorky', rada: 'Projděte si pořadí operací: násobení a dělení mají přednost před sčítáním a odčítáním.',
    f: v => {
      for (let i = 1; i < v.length; i++) {
        if (v[i] !== '(' || /[A-Za-z0-9_.]/.test(v[i - 1])) continue;   /* jen závorky výrazu, ne volání funkce */
        let h = 0, j = i;
        for (; j < v.length; j++) { if (v[j] === '(') h++; else if (v[j] === ')' && --h === 0) break; }
        if (j < v.length && /[+\-&]/.test(v.slice(i + 1, j))) return v.slice(0, i) + v.slice(i + 1, j) + v.slice(j + 1);
      }
      return null;
    } },
  { druh: 'porovnani', rada: 'Podívejte se pozorně na porovnání – platí podmínka i pro hraniční hodnotu?',
    f: v => { const m = /(>=|<=|<>|>|<)/.exec(v.replace(/"[^"]*"/g, x => '_'.repeat(x.length))); if (!m) return null;
      const nove = { '>=': '>', '<=': '<', '>': '>=', '<': '<=', '<>': '=' }[m[1]]; return v.slice(0, m.index) + nove + v.slice(m.index + m[1].length); } },
  { druh: 'presne', rada: 'Hledá funkce přesnou shodu? Bez posledního argumentu hledá přibližně.',
    f: v => (/,FALSE\)/.test(v) ? v.replace(/,FALSE\)/, ')') : /MATCH\(([^()]*),0\)/.test(v) ? v.replace(/(MATCH\([^()]*),0\)/, '$1)') : null) },
  { druh: 'uvozovky', rada: 'Text ve vzorci musí být v uvozovkách, jinak ho Excel bere jako název.',
    f: v => { const m = /"([A-Za-zÁ-ž][A-Za-zÁ-ž]*)"/.exec(v); return m ? v.slice(0, m.index) + m[1] + v.slice(m.index + m[0].length) : null; } },
  { druh: 'oblast', rada: 'Zkontrolujte, jestli oblast ve vzorci zahrnuje všechna data.',
    f: v => { const m = /([A-Z]+)(\$?)(\d+):(\$?)([A-Z]+)(\$?)(\d+)/.exec(v); if (!m || +m[7] - +m[3] < 2) return null;
      return v.slice(0, m.index) + `${m[1]}${m[2]}${m[3]}:${m[4]}${m[5]}${m[6]}${+m[7] - 1}` + v.slice(m.index + m[0].length); } },
  { druh: 'funkce', rada: 'Dělá použitá funkce opravdu to, co úloha chce?',
    f: v => { const z = [['SUM(', 'AVERAGE('], ['AVERAGE(', 'SUM('], ['MAX(', 'MIN('], ['MIN(', 'MAX('], ['COUNT(', 'COUNTA('], ['ROUND(', 'ROUNDDOWN('], ['SUMIF(', 'COUNTIF(']];
      for (const [a, b] of z) { const i = v.search(new RegExp('(^|[^A-Z.])' + a.replace('(', '\\('))); if (i >= 0) { const k = v.indexOf(a, i); return v.slice(0, k) + b + v.slice(k + a.length); } }
      return null; } },
  { druh: 'odkaz', rada: 'Ukazují všechny odkazy na správné buňky? Klikněte na vzorec – barevné rámečky v listu ukážou, kam sahá.',
    f: v => { const m = /(^|[^A-Z$:!])([A-H])(\d+)(?![\d(:])/.exec(v.replace(/"[^"]*"/g, x => '_'.repeat(x.length))); if (!m) return null;
      const k = m.index + m[1].length; return v.slice(0, k) + String.fromCharCode(m[2].charCodeAt(0) + 1) + m[3] + v.slice(k + m[2].length + m[3].length); } },
];
function rozbij(u, n) {
  const X = koren.XLV; if (!X) return null;
  const l = new X.List(u.bunky, { jazyk: 'en' });
  for (const r of n.zamichej(ROZBITI)) {
    const v = r.f(u.reseni, u);
    if (!v || v === u.reseni) continue;
    let st; try { st = X.rozeber(v, 'en'); } catch (e) { continue; }
    const pc = X.rozeberAdresu(u.cil);   /* odkaz na vlastní buňku = cyklus, to není „typická chyba“ */
    if (X.odkazyStromu(st).some(o => pc.r >= o.r1 && pc.r <= o.r2 && pc.c >= o.c1 && pc.c <= o.c2)) continue;
    if (X.zkontroluj(l, u, v).ok) continue;   /* „chyba“, se kterou úloha projde, není chyba */
    return { vzorec: v, druh: r.druh, rada: r.rada };
  }
  return null;
}
function gen_oprava(n, obtiznost) {
  const zaklad = SABLONY.filter(s => s.tema !== 'oprava' && (obtiznost === 1 ? s.uroven <= 2 : true));
  for (let pokus = 0; pokus < 12; pokus++) {
    const s = n.vyber(zaklad), u = s.gen(n), r = rozbij(u, n);
    if (!r) continue;
    const X = koren.XLV, bunky = { ...u.bunky };
    const cile = u.kopirovat ? (() => { const [a, b] = u.kopirovat.split(':'), p = X.rozeberAdresu(a), q = X.rozeberAdresu(b), o = []; for (let rr = p.r; rr <= q.r; rr++) for (let c = p.c; c <= q.c; c++) o.push(X.adresa(rr, c)); return o; })() : [u.cil];
    const pc = X.rozeberAdresu(u.cil);
    cile.forEach(a => { const q = X.rozeberAdresu(a); bunky[a] = X.posunVzorec(r.vzorec, q.r - pc.r, q.c - pc.c, 'en'); });
    return { ...u, bunky, rozbity: r.vzorec, druhChyby: r.druh, zakladTema: s.tema,
      zadani: `<b>Úloha:</b> ${u.zadani}<br>🔧 V [[@${u.cil}]] už vzorec je, ale má v sobě chybu. Najděte ji a vzorec opravte.`,
      napovedy: [r.rada, ...(u.napovedy || [])] };
  }
  return null;
}

/* vážený výběr: volby.vahy {tema: váha} (víc úloh ze slabých témat), obtiznost 0 = automaticky podle volby.urovne {tema: 1–3} */
function vygeneruj(temata, obtiznost = 2, seme, volby = {}) {
  const n = nahoda(seme);
  if (volby.vahy || obtiznost === 0) {
    const povolena = Object.keys(TEMATA).filter(t => !temata || !temata.length || temata.includes(t));
    const vaha = t => Math.max(0.05, volby.vahy?.[t] ?? 1);
    let x = n.r() * povolena.reduce((a, t) => a + vaha(t), 0), tema = povolena[povolena.length - 1];
    for (const t of povolena) { x -= vaha(t); if (x < 0) { tema = t; break; } }
    const ob = obtiznost === 0 ? (volby.urovne?.[tema] || 2) : obtiznost;
    if (tema === 'oprava') { const o = gen_oprava(n, ob); if (o) return { ...o, tema: 'oprava', uroven: ob === 3 ? 3 : 2, id: 'oprava-' + o.druhChyby }; }
    let kand = SABLONY.filter(s => s.tema === tema);
    if (!kand.length) kand = SABLONY;
    const dle = kand.filter(s => (ob === 1 ? s.uroven === 1 : ob === 2 ? s.uroven <= 2 : s.uroven >= 2));
    const sab = n.vyber(dle.length ? dle : kand), u = sab.gen(n);
    return { ...u, tema: sab.tema, uroven: sab.uroven, id: sab.tema + '-' + SABLONY.indexOf(sab) };
  }
  let kand = SABLONY.filter(s => (!temata || !temata.length || temata.includes(s.tema)));
  const dle = kand.filter(s => (obtiznost === 1 ? s.uroven === 1 : obtiznost === 2 ? s.uroven <= 2 : s.uroven >= 2));
  if (dle.length) kand = dle;
  /* oprava se losuje jako jedno z témat; když se rozbití nepovede, vezme se obyčejná úloha */
  const vse = [...new Set(kand.map(s => s.tema))];
  const chceOpravu = (!temata || !temata.length || temata.includes('oprava')) && n.r() < (temata && temata.length === 1 ? 1 : 1 / (vse.length + 1));
  if (chceOpravu) { const o = gen_oprava(n, obtiznost); if (o) return { ...o, tema: 'oprava', uroven: 2, id: 'oprava-' + o.druhChyby }; }
  const bezOpravy = kand.length ? kand : SABLONY;
  const s = n.vyber(bezOpravy), u = s.gen(n);
  return { ...u, tema: s.tema, uroven: s.uroven, id: s.tema + '-' + SABLONY.indexOf(s) };
}
koren.XLV_PROCVIC = { TEMATA, SABLONY, vygeneruj, nahoda, rozbij, ROZBITI };
})(typeof window !== 'undefined' ? window : globalThis);
