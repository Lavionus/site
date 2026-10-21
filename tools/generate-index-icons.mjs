#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const CATALOG = path.join(ROOT, 'apps.js');
const OUT = path.join(ROOT, 'assets', 'index-icons');
const SIZE = 256;
const COLS = 10;

const source = fs.readFileSync(CATALOG, 'utf8')
  + '\n;globalThis.__catalog={groups:KATALOG_SKUPINY,sections:KATALOG_SEKCE};';
const context = {};
vm.createContext(context);
vm.runInContext(source, context, { filename: CATALOG });
const { groups, sections } = context.__catalog;

const palette = {
  produktivita: ['#2563eb', '#0f172a'], zdravi: ['#e11d48', '#3f0a1d'],
  priroda: ['#16a34a', '#052e16'], tvorba: ['#9333ea', '#2e1065'],
  technika: ['#ea580c', '#431407'], '3d': ['#0891b2', '#083344'],
  vyvoj: ['#4f46e5', '#1e1b4b'], hry: ['#db2777', '#500724'],
  vysetrovani: ['#ca8a04', '#422006'], vareni: ['#dc2626', '#450a0a'],
  dokumenty: ['#a16207', '#422006'], duchovno: ['#7c3aed', '#2e1065'],
  ostatni: ['#475569', '#0f172a'],
};

function splitLabel(label, fallback = '◆') {
  const chars = [...label];
  let end = 0;
  while (end < chars.length && !/\s/u.test(chars[end])) end++;
  const head = chars.slice(0, end).join('');
  if (/[^\p{L}\p{N}]/u.test(head)) return [head, chars.slice(end).join('').trim()];
  return [fallback, label.trim()];
}

function slug(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function initials(label) {
  const words = label.replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || 'IK').slice(0, 2)).toUpperCase();
}

function esc(s) {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
}

const icons = [];
for (const group of groups) {
  const [symbol, label] = splitLabel(group.label, '◆');
  icons.push({ kind: 'category', id: group.id, file: `categories/category-${group.id}`, label, symbol, group: group.id });
}
for (const [index, section] of sections.entries()) {
  const [symbol, label] = splitLabel(section.nazev, '◆');
  icons.push({ kind: 'section', id: `section-${String(index + 1).padStart(2, '0')}-${slug(label)}`, file: `sections/section-${String(index + 1).padStart(2, '0')}-${slug(label)}`, label, symbol, group: section.skupina });
  for (const page of section.polozky) {
    const [pageSymbol, pageLabel] = splitLabel(page.nazev, '◈');
    const pageId = page.soubor.replace(/^obsah\//, '').replace(/\.html$/, '').replaceAll('/', '--');
    icons.push({ kind: 'page', id: pageId, file: `pages/page-${pageId}`, label: pageLabel, symbol: pageSymbol, group: section.skupina, page: page.soubor, section: label });
  }
}

for (const dir of ['svg/categories', 'svg/sections', 'svg/pages', 'png/categories', 'png/sections', 'png/pages', 'webp/categories', 'webp/sections', 'webp/pages']) {
  fs.mkdirSync(path.join(OUT, dir), { recursive: true });
}

const cards = [];
for (const [index, icon] of icons.entries()) {
  const [accent, dark] = palette[icon.group] || palette.ostatni;
  const code = crypto.createHash('sha1').update(icon.id).digest('hex').slice(0, 3).toUpperCase();
  const monogram = initials(icon.label);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${accent}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs>
  <rect x="8" y="8" width="240" height="240" rx="52" fill="url(#g)"/>
  <circle cx="128" cy="108" r="72" fill="#fff" fill-opacity=".13"/>
  <text x="128" y="139" text-anchor="middle" font-family="Noto Color Emoji, Apple Color Emoji, Segoe UI Emoji, sans-serif" font-size="92">${esc(icon.symbol)}</text>
  <rect x="25" y="190" width="87" height="42" rx="15" fill="#fff" fill-opacity=".94"/>
  <text x="68.5" y="219" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="22" font-weight="800" fill="${dark}">${esc(monogram)}</text>
  <text x="225" y="224" text-anchor="end" font-family="DejaVu Sans Mono, monospace" font-size="15" font-weight="700" fill="#fff" fill-opacity=".72">${code}</text>
</svg>\n`;
  const rel = `svg/${icon.file}.svg`;
  fs.writeFileSync(path.join(OUT, rel), svg);
  cards.push(`<img src="${rel}" alt="" style="width:${SIZE}px;height:${SIZE}px">`);
  icon.svg = rel;
  icon.png = `png/${icon.file}.png`;
  icon.webp = `webp/${icon.file}.webp`;
  icon.code = code;
  icon.index = index;
}

const rows = Math.ceil(icons.length / COLS);
const chroma = '#00ff01';
const renderHeight = rows * SIZE + SIZE;
const sheet = `<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;background:${chroma}}body{width:${COLS * SIZE}px;height:${renderHeight}px;display:grid;align-content:start;grid-template-columns:repeat(${COLS},${SIZE}px);grid-auto-rows:${SIZE}px}img{display:block}</style>${cards.join('')}`;
const staging = path.join(OUT, '.render-sheet.html');
const shot = path.join(OUT, '.render-sheet.png');
fs.writeFileSync(staging, sheet);

execFileSync('chromium', ['--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', `--window-size=${COLS * SIZE},${renderHeight}`, `--screenshot=${shot}`, `file://${staging}`], { stdio: 'inherit' });
for (const icon of icons) {
  const x = (icon.index % COLS) * SIZE;
  const y = Math.floor(icon.index / COLS) * SIZE;
  execFileSync('magick', [shot, '-crop', `${SIZE}x${SIZE}+${x}+${y}`, '+repage', '-transparent', chroma, path.join(OUT, icon.png)]);
  execFileSync('cwebp', ['-quiet', '-q', '90', '-alpha_q', '100', path.join(OUT, icon.png), '-o', path.join(OUT, icon.webp)]);
}
fs.rmSync(staging);
fs.rmSync(shot);

const manifest = {
  generatedAt: new Date().toISOString(), source: 'apps.js', size: `${SIZE}x${SIZE}`,
  counts: { categories: groups.length, sections: sections.length, pages: sections.reduce((n, s) => n + s.polozky.length, 0), total: icons.length },
  naming: 'category-<group>, section-<order>-<slug>, page-<catalog-path-without-extension>',
  icons: icons.map(({ index, ...icon }) => icon),
};
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Generated ${icons.length} icons in ${OUT}`);

// webové odvozeniny pro rozcestník (kompaktní web-128/, ikony.js)
execFileSync(process.execPath, [path.join(import.meta.dirname, 'index-icons-web.mjs')], { stdio: 'inherit' });
