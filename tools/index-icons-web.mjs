#!/usr/bin/env node
// Webové odvozeniny balíku ikon rozcestníku (spouští ho i generate-index-icons.mjs):
//  - web-128/  – kompaktní ikony 128×128 pro menu a dlaždice: barvy a symbol
//                z balíku, ale symbol přes skoro celou dlaždici a bez štítku
//                s monogramem a kontrolního kódu – v menu se ikona kreslí na
//                ~26 px a tam by symbol z plné ikony byl jen drobná tečka,
//  - ikony.js  – KATALOG_IKONY: soubor stránky / název sekce / id skupiny → cesta
//                ikony; co v mapě chybí, zobrazí rozcestník dál jako emoji.
// Mapa se drží podle názvu sekce, ne podle pořadí: ID sekce v balíku obsahuje
// pořadové číslo, které se po přidání nové sekce posune.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'assets', 'index-icons');
const SIZE = 128;
const COLS = 20;
const DIR = `web-${SIZE}`;

const manifest = JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8'));
const mapa = { stranky: {}, sekce: {}, skupiny: {} };
const esc = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');

// barvy přechodu se berou ze zdrojového SVG, aby kompaktní ikona seděla k plné
// id přechodu musí být jedinečné – všechny ikony se kreslí do jednoho archu
const cells = manifest.icons.map((icon, i) => {
  const zdroj = fs.readFileSync(path.join(OUT, icon.svg), 'utf8');
  const [accent, dark] = [...zdroj.matchAll(/stop-color="([^"]+)"/g)].map(m => m[1]);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 128 128">
<defs><linearGradient id="g${i}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${accent}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs>
<rect x="2" y="2" width="124" height="124" rx="28" fill="url(#g${i})"/>
<rect x="2" y="2" width="124" height="62" rx="28" fill="#fff" fill-opacity=".10"/>
<text x="64" y="66" text-anchor="middle" dominant-baseline="central" font-family="Noto Color Emoji, Apple Color Emoji, Segoe UI Emoji, sans-serif" font-size="78">${esc(icon.symbol)}</text>
</svg>`;
});

const rows = Math.ceil(cells.length / COLS);
const sheet = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}body{display:grid;grid-template-columns:repeat(${COLS},${SIZE}px);grid-auto-rows:${SIZE}px}svg{display:block}</style>${cells.join('')}`;
const staging = path.join(OUT, '.render-web.html');
const shot = path.join(OUT, '.render-web.png');
fs.writeFileSync(staging, sheet);
execFileSync('chromium', ['--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--default-background-color=00000000', `--window-size=${COLS * SIZE},${rows * SIZE + SIZE}`,
  `--screenshot=${shot}`, `file://${staging}`], { stdio: 'ignore' });

fs.rmSync(path.join(OUT, DIR), { recursive: true, force: true });
for (const [i, icon] of manifest.icons.entries()) {
  const cil = path.join(OUT, DIR, icon.file + '.webp');
  fs.mkdirSync(path.dirname(cil), { recursive: true });
  const x = (i % COLS) * SIZE, y = Math.floor(i / COLS) * SIZE;
  execFileSync('magick', [shot, '-crop', `${SIZE}x${SIZE}+${x}+${y}`, '+repage',
    '-define', 'webp:alpha-quality=100', '-quality', '86', cil]);
  if (icon.kind === 'page') mapa.stranky[icon.page] = icon.file;
  else if (icon.kind === 'section') mapa.sekce[icon.symbol + ' ' + icon.label] = icon.file;
  else if (icon.kind === 'category') mapa.skupiny[icon.id] = icon.file;
}
fs.rmSync(staging);
fs.rmSync(shot);

const js = `// Vygenerováno: node tools/index-icons-web.mjs (z assets/index-icons/manifest.json).
// Klíče: stránky = soubor z katalogu, sekce = celý název sekce, skupiny = id skupiny.
const KATALOG_IKONY = {
  koren: 'assets/index-icons/${DIR}/',
  ...${JSON.stringify(mapa, null, 1)}
};
`;
fs.writeFileSync(path.join(OUT, 'ikony.js'), js);
console.log(`ikony.js: ${Object.keys(mapa.stranky).length} stránek, ${Object.keys(mapa.sekce).length} sekcí, ${Object.keys(mapa.skupiny).length} skupin; ${DIR}/ hotovo`);
