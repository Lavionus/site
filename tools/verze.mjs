#!/usr/bin/env node
/* Vygeneruje verze.js: verzi webu (číslo cache ze sw.js) a verzi každé stránky z katalogu
   = počet commitů, které změnily obsah/<x>.html nebo složku obsah/<x>/ (+1, je-li změna
   ještě necommitovaná). Spouští ho upload.sh před commitem, ručně: node tools/verze.mjs */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const KOREN = fileURLToPath(new URL('..', import.meta.url));
const git = (...a) => execFileSync('git', a, { cwd: KOREN, encoding: 'utf8', maxBuffer: 256 << 20 });

const web = (readFileSync(KOREN + 'sw.js', 'utf8').match(/const CACHE = PREFIX \+ '(v\d+)'/) || [])[1];
if (!web) throw new Error('v sw.js chybí CACHE = PREFIX + \'vN\'');

const ctx = {};
vm.runInNewContext(readFileSync(KOREN + 'apps.js', 'utf8') + ';this.S=KATALOG_SEKCE', ctx);
const stranky = [...new Set(ctx.S.flatMap(s => s.polozky.map(p => p.soubor)))];

// soubor (obsah/x.html) i soubory ve složce obsah/x/ patří stránce obsah/x.html;
// stránka přímo ve složce (obsah/cviceni/index.html) dostane celou svou složku
const veSlozce = new Map(stranky.filter(s => s.split('/').length > 2).map(s => [s.split('/')[1], s]));
const stranka = f => {
  if (/^obsah\/[^/]+\.html$/.test(f)) return f;
  const slozka = (f.match(/^obsah\/([^/]+)\//) || [])[1];
  return slozka && (veSlozce.get(slozka) || `obsah/${slozka}.html`);
};

const pocet = {}, datum = {};
// %x01 odděluje commity; --no-renames: přejmenování = smazání + přidání
for (const c of git('log', '--no-renames', '--name-only', '--format=%x01%ad', '--date=short', '--', 'obsah').split('\x01').slice(1)) {
  const [d, ...soubory] = c.trim().split('\n');
  for (const s of new Set(soubory.map(stranka).filter(Boolean))) {
    pocet[s] = (pocet[s] || 0) + 1;
    if (!datum[s]) datum[s] = d;   // log jde od nejnovějšího
  }
}
const dnes = new Date().toISOString().slice(0, 10);
const zmenene = new Set(git('status', '--porcelain', '-z', '--untracked-files=all', '--', 'obsah').split('\0')
  .filter(Boolean).map(r => stranka(r.slice(3))).filter(Boolean));
for (const s of zmenene) { pocet[s] = (pocet[s] || 0) + 1; datum[s] = dnes; }

const vystup = {};
for (const s of stranky.sort()) if (pocet[s]) vystup[s] = [pocet[s], datum[s]];
writeFileSync(KOREN + 'verze.js',
  '/* Vygenerováno: node tools/verze.mjs – neupravovat ručně. Stránka: [verze, datum poslední změny] */\n' +
  `var VERZE_WEBU = '${web}';\nvar VERZE_STRANEK = ${JSON.stringify(vystup, null, 0).replace(/\],"/g, '],\n"')};\n`);
console.log(`verze.js: web ${web}, ${Object.keys(vystup).length} stránek`);
