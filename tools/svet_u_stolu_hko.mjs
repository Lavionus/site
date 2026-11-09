// Čínský lunární kalendář pro obsah/svet_u_stolu.html z tabulek Hongkongské observatoře.
// ICU (Intl 'chinese') se u novoluní těsně u půlnoci plete o den (např. Nový rok 2027, 2030).
// Tabulky: https://www.hko.gov.hk/en/gts/time/calendar/text/files/T<rok>e.txt
// Spuštění: node tools/svet_u_stolu_hko.mjs <složka s T2023e.txt…>  → obsah/svet_u_stolu/lunarni.js
import fs from 'node:fs';
import path from 'node:path';

const slozka = process.argv[2];
if (!slozka) { console.error('Použití: node tools/svet_u_stolu_hko.mjs <složka>'); process.exit(1); }
const CLENY = ['Spring Equinox', 'Clear and Bright', 'Summer Solstice', 'Autumnal Equinox', 'Winter Solstice', 'Beginning of Spring'];
const soubory = fs.readdirSync(slozka).filter(f => /^T\d{4}e\.txt$/.test(f)).sort();
const mesice = [], cleny = {};
let posledni = null;
const iso = s => { const [r, m, d] = s.split('/'); return r + '-' + m.padStart(2, '0') + '-' + d.padStart(2, '0'); };
for (const f of soubory) {
  for (const radek of fs.readFileSync(path.join(slozka, f), 'utf8').split(/\r?\n/)) {
    const m = radek.match(/^(\d{4}\/\d+\/\d+)\s+(\d+)(?:st|nd|rd|th) Lunar Month/);
    if (m) {
      const c = +m[2];
      mesice.push([iso(m[1]), c === posledni ? -c : c]);   // záporné = přestupný měsíc
      posledni = c;
    }
    const d = radek.match(/^(\d{4}\/\d+\/\d+)/);
    if (d) for (const c of CLENY) if (radek.includes(c)) (cleny[c] = cleny[c] || []).push(iso(d[1]));
  }
}
const prvni = soubory[0].slice(1, 5), posl = soubory.at(-1).slice(1, 5);
const txt = '/* Generováno tools/svet_u_stolu_hko.mjs z tabulek Hongkongské observatoře (' + prvni + '–' + posl + ').\n'
  + '   mesice: [první den lunárního měsíce, číslo měsíce (záporné = přestupný)], cleny: sluneční členy (pekingský čas). */\n'
  + 'window.SUS_CINSKY = ' + JSON.stringify({ od: +prvni, do: +posl, mesice, cleny }) + ';\n';
fs.writeFileSync('obsah/svet_u_stolu/lunarni.js', txt);
console.log('měsíců', mesice.length, 'přestupných', mesice.filter(x => x[1] < 0).map(x => x[0]).join(' '), 'kB', (txt.length / 1024).toFixed(1));
