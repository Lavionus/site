#!/usr/bin/env node
/* Samostatné stránky – jednosouborové kopie vybraných stránek webu,
   které jdou poslat jako příloha a fungují bez webu (i z disku, file://).

   Zdrojem je pořád stránka webu; tady se do jednoho HTML vloží všechno,
   co načítá (skripty a styly), a odstraní se cokoli, co na web odkazuje:
     podpis.js – pruh s podpisem a stavem stránky (místo něj patička vpravo dole: verze · copyright),
     theme.js  – téma podle rozcestníku a překlady; nahradí ho téma podle systému,
     komentáře ve skriptech, stylech i HTML (esbuild bez minifikace; licenční
       komentáře knihoven zůstanou),
     zmínky ve viditelných textech – náhrady per stránka v STRANKY[].nahrady.
   Nakonec kontrola ZAKAZANE: zbyde-li cokoli, sestavení selže.
   Stránka pozná samostatnou verzi podle window.SAMOSTATNA_STRANKA.

   Spuštění:  node tools/samostatne.mjs        → ../Samostatne_stranky/*.html
   Nová stránka = nový záznam v STRANKY (smí načítat jen místní soubory). */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const KOREN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CIL = path.resolve(KOREN, '..', 'Samostatne_stranky');
const PATA = '© 2026 hdm@seznam.cz';

/* Verze stránky stejně jako tools/verze.mjs: počet commitů, které změnily obsah/x.html
   nebo složku obsah/x/, +1 je-li změna ještě necommitovaná. */
function verzeStranky(zdroj) {
  const cesty = [zdroj, zdroj.replace(/\.html$/, '/')].filter(c => fs.existsSync(path.join(KOREN, c)));
  const git = (...a) => execFileSync('git', a, { cwd: KOREN, encoding: 'utf8' });
  const commity = git('log', '--format=%h', '--', ...cesty).split('\n').filter(Boolean).length;
  const zmeneno = git('status', '--porcelain', '--untracked-files=all', '--', ...cesty).trim() !== '';
  return 'v' + (commity + (zmeneno ? 1 : 0));
}

const STRANKY = [
  { zdroj: 'obsah/md_dokument.html', cil: 'md_dokument.html', nahrady: [
    ['[odkazů](https://lavionus.github.io/site/)', '[odkazů](https://example.com/)'],
    ['>Podle rozcestníku<', '>Podle systému<'],
    ['(.md ve formátu čtečky Kronik)', '(.md, formát kroniky-poznamky)'],
    ['(.md / .json z této stránky nebo ze čtečky Kronik)', '(.md / .json, formát kroniky-poznamky)'],
    ['soubor poznámek má stejný formát jako čtečka Kronik – obě stránky si ho navzájem přečtou.', 'soubor poznámek má formát kroniky-poznamky.'],
    ['(formát čtečky Kronik)', '(formát kroniky-poznamky)'],
    [':root:fullscreen{--podpis-vyska:0px}\n:root:fullscreen #autor-podpis{display:none !important}\n', ''],
  ] },
];

// odkazy na web a jeho části; „kroniky-poznamky“/„kroniky-zaloha“ jsou názvy datového formátu
const ZAKAZANE = /lavionus|github\.io|rozcestn|\b_test\/|\bobsah\/|theme\.js|podpis|common\.css|dialog\.js|i18n|webapp_theme|kronik(?!y-poznamky|y-zaloha)/i;

const TEMA = "(function(){try{if(matchMedia('(prefers-color-scheme: light)').matches)document.documentElement.dataset.theme='light';}catch(e){}})();";
const PATA_CSS = '.samostatne-pata{flex:none;text-align:right;font-size:.72rem;color:var(--text-faint,#888);padding:3px 8px;border-top:1px solid var(--border,#444);background:var(--bg-elevated,transparent)}@media print{.samostatne-pata{display:none}}';

function nactiEsbuild() {
  const kde = [import.meta.url, path.resolve(KOREN, '..', 'Dwarf-Colony', 'package.json')];
  for (const k of kde) { try { return createRequire(k)('esbuild'); } catch { /* další */ } }
  throw new Error('Chybí esbuild (npm i -g esbuild) – bez něj nejdou odstranit komentáře.');
}
const esbuild = nactiEsbuild();
const bezKomentaru = (kod, loader) =>
  esbuild.transformSync(kod, { loader, charset: 'utf8', legalComments: 'inline' }).code;

const precti = p => fs.readFileSync(p, 'utf8');
const mistni = odkaz => !/^([a-z]+:|\/\/)/i.test(odkaz);
const ochranSkript = s => s.replace(/<\/script/gi, '<\\/script');

function sestav({ zdroj, nahrady = [] }) {
  const soubor = path.join(KOREN, zdroj), slozka = path.dirname(soubor);
  let html = precti(soubor);
  // náhrady na zdroji stránky (před úpravou esbuildem, ať mají známý tvar)
  for (const [co, cim] of nahrady) {
    const pred = html;
    html = html.replace(co, cim);
    if (html === pred) throw new Error(`${zdroj}: náhrada nic nenašla – ${co}`);
  }
  // co by se nevložilo a samostatně chybělo (vlastní skripty stránky se nekontrolují)
  const zbytek = html.replace(/<script>[\s\S]*?<\/script>/g, '')
    .match(/<(img|iframe|source|audio|video|object)\b[^>]*\b(src|href|data)="(?!data:|#)[^"]*"|<link\b(?![^>]*rel="stylesheet")[^>]*href="[^"]*"/i);
  if (zbytek) throw new Error(`${zdroj}: nevložený odkaz ${zbytek[0]}`);
  const cesta = odkaz => {
    if (!mistni(odkaz)) throw new Error(`${zdroj}: vnější zdroj ${odkaz} – samostatná stránka smí mít jen místní soubory`);
    return path.resolve(slozka, odkaz);
  };

  // HTML komentáře pryč (ve skriptech a stylech zůstávají – tam můžou být v řetězcích)
  html = html.replace(/(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>)|<!--[\s\S]*?-->\n?/g, (m, blok) => blok || '');
  // vlastní skripty a styly stránky bez komentářů
  // (jeden průchod: skript pohltí celý obsah, takže <style> v řetězci skriptu zůstane netknutý)
  html = html.replace(/<script>([\s\S]*?)<\/script>|<style>([\s\S]*?)<\/style>/g, (_, js, css) => js !== undefined
    ? `<script>\n${ochranSkript(bezKomentaru(js, 'js'))}</script>`
    : `<style>\n${bezKomentaru(css, 'css')}</style>`);
  // načítané soubory dovnitř
  html = html.replace(/<script src="([^"]+)"(?: defer)?><\/script>\n?/g, (_, src) => {
    const p = cesta(src), jmeno = path.basename(p);
    if (jmeno === 'podpis.js') return '';
    if (jmeno === 'theme.js') return `<script>${TEMA}</script>\n`;
    return `<script>\n${ochranSkript(bezKomentaru(precti(p), 'js'))}</script>\n`;
  });
  html = html.replace(/<link rel="stylesheet" href="([^"]+)">\n?/g, (_, href) =>
    `<style>\n${bezKomentaru(precti(cesta(href)), 'css')}</style>\n`);

  html = html.replace(/<head>\n?/i, `<head>\n<script>window.SAMOSTATNA_STRANKA = true;</script>\n<style>${PATA_CSS}</style>\n`);
  const konec = html.lastIndexOf('</body>');   // poslední – dřívější můžou být v řetězcích skriptů
  html = html.slice(0, konec) + `<footer class="samostatne-pata">${verzeStranky(zdroj)} · ${PATA}</footer>\n` + html.slice(konec);

  const radky = html.split('\n').map((r, i) => [i + 1, r]).filter(([, r]) => ZAKAZANE.test(r));
  if (radky.length) {
    throw new Error(`${zdroj}: zůstaly odkazy na web:\n` + radky.slice(0, 15).map(([i, r]) => {
      const m = r.match(ZAKAZANE);
      return `  ř. ${i}: …${r.slice(Math.max(0, m.index - 50), m.index + 60)}…`;
    }).join('\n'));
  }
  return html;
}

fs.mkdirSync(CIL, { recursive: true });
for (const s of STRANKY) {
  const vystup = sestav(s);
  fs.writeFileSync(path.join(CIL, s.cil), vystup);
  console.log(`${s.zdroj} → ${path.relative(path.resolve(KOREN, '..'), path.join(CIL, s.cil))} (${Math.round(vystup.length / 1024)} kB)`);
}
