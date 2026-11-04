#!/usr/bin/env node
/* Samostatné stránky – jednosouborové kopie vybraných stránek webu,
   které jdou poslat jako příloha a fungují bez webu (i z disku, file://).

   Zdrojem je pořád stránka webu; tady se jen vloží do jednoho HTML
   všechno, co načítá (skripty a styly), a vynechá se, co patří k webu:
     podpis.js – pruh s podpisem a stavem stránky,
     theme.js  – téma podle rozcestníku a překlady; nahradí ho téma podle systému.
   Stránka pozná samostatnou verzi podle window.SAMOSTATNA_STRANKA.

   Spuštění:  node tools/samostatne.mjs        → ../Samostatne_stranky/*.html
   Nová stránka = nový řádek v STRANKY (smí načítat jen místní soubory). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOREN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CIL = path.resolve(KOREN, '..', 'Samostatne_stranky');

const STRANKY = [
  { zdroj: 'obsah/md_dokument.html', cil: 'md_dokument.html' },
];

const TEMA = "(function(){try{if(matchMedia('(prefers-color-scheme: light)').matches)document.documentElement.dataset.theme='light';}catch(e){}})();";

const precti = p => fs.readFileSync(p, 'utf8');
const mistni = odkaz => !/^([a-z]+:|\/\/)/i.test(odkaz);

function sestav({ zdroj }) {
  const soubor = path.join(KOREN, zdroj), slozka = path.dirname(soubor);
  let html = precti(soubor);
  // co by se nevložilo a samostatně chybělo (vlastní skripty stránky se nekontrolují)
  const zbytek = html.replace(/<script>[\s\S]*?<\/script>/g, '')
    .match(/<(img|iframe|source|audio|video|object)\b[^>]*\b(src|href|data)="(?!data:|#)[^"]*"|<link\b(?![^>]*rel="stylesheet")[^>]*href="[^"]*"/i);
  if (zbytek) throw new Error(`${zdroj}: nevložený odkaz ${zbytek[0]}`);
  const cesta = odkaz => {
    if (!mistni(odkaz)) throw new Error(`${zdroj}: vnější zdroj ${odkaz} – samostatná stránka smí mít jen místní soubory`);
    return path.resolve(slozka, odkaz);
  };
  html = html.replace(/<script src="([^"]+)"(?: defer)?><\/script>\n?/g, (_, src) => {
    const p = cesta(src), jmeno = path.basename(p);
    if (jmeno === 'podpis.js') return '';
    if (jmeno === 'theme.js') return `<script>${TEMA}</script>\n`;
    return `<script>/* ${path.relative(KOREN, p)} */\n${precti(p).replace(/<\/script/gi, '<\\/script')}\n</script>\n`;
  });
  html = html.replace(/<link rel="stylesheet" href="([^"]+)">\n?/g, (_, href) => {
    const p = cesta(href);
    return `<style>/* ${path.relative(KOREN, p)} */\n${precti(p).replace(/<\/style/gi, '<\\/style')}\n</style>\n`;
  });
  const dnes = new Date().toISOString().slice(0, 10);
  return html
    .replace(/^<!DOCTYPE html>\n?/i, `<!DOCTYPE html>\n<!-- Samostatná verze stránky ${zdroj} (web lavionus.github.io/site), vygenerováno ${dnes}\n     příkazem node tools/samostatne.mjs. Neupravovat ručně – změny dělat ve zdroji. -->\n`)
    .replace(/<head>\n?/i, '<head>\n<script>window.SAMOSTATNA_STRANKA = true;</script>\n');
}

fs.mkdirSync(CIL, { recursive: true });
for (const s of STRANKY) {
  const vystup = sestav(s);
  fs.writeFileSync(path.join(CIL, s.cil), vystup);
  console.log(`${s.zdroj} → ${path.relative(path.resolve(KOREN, '..'), path.join(CIL, s.cil))} (${Math.round(vystup.length / 1024)} kB)`);
}
