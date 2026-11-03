/* Kroniky vyhnanství – sazba knihy pro tisk (bez DOM).
   Z kapitol (JADRO.rozeber) a nastavení skládá HTML a CSS Paged Media, které stránkuje Paged.js.
   V prohlížeči window.KRONIKY_SAZBA, v node require(). */
(function (koren) {
  'use strict';

  const PISMA = {
    garamond: { nazev: 'EB Garamond (klasická kniha)', rodina: '"EB Garamond", Georgia, serif' },
    literata: { nazev: 'Literata (čitelná, moderní)', rodina: 'Literata, Georgia, serif' },
    georgia: { nazev: 'Georgia (systémové)', rodina: 'Georgia, "Times New Roman", serif' }
  };

  // rozměry v mm
  const FORMATY = {
    a5: { nazev: 'A5 – 148 × 210 mm', s: 148, v: 210 },
    b6: { nazev: 'Kapesní – 110 × 178 mm', s: 110, v: 178 },
    royal: { nazev: 'Royal – 156 × 234 mm', s: 156, v: 234 },
    us6x9: { nazev: '6 × 9″ – 152,4 × 228,6 mm (tiskárny, KDP)', s: 152.4, v: 228.6 },
    b5: { nazev: 'B5 – 176 × 250 mm', s: 176, v: 250 },
    a4: { nazev: 'A4 – 210 × 297 mm', s: 210, v: 297 },
    vlastni: { nazev: 'Vlastní rozměr…', s: 0, v: 0 }
  };

  const PREDELY = { hvezdy3: '⁂', hvezdicky: '*  *  *', list: '❦', mezera: '' };

  const VYCHOZI = {
    kniha: 'kniha1', od: 0, do: -1, autor: '',
    format: 'a5', sirka: 148, vyska: 210,
    okrajNahore: 17, okrajDole: 20, okrajVnitrni: 20, okrajVnejsi: 15,
    zrcadlit: true, spadavka: 0, znacky: false,
    pismo: 'garamond', velikost: 11, radkovani: 1.4, doBloku: true, deleni: true, odsazeni: 1.2,
    obalka: true, titul: true, tiraz: true, obsah: true,
    zahlavi: true, cisla: 'dole-vne', nalicho: true, inicialy: true, predlozky: true,
    predel: 'hvezdy3', ilustrace: 'text', popisky: true, cernobile: false,
    nahled: 'dvoustrany', voditka: false
  };

  const PREDVOLBY = {
    a5: { nazev: '📕 Kniha A5 (domácí tisk)', nast: {} },
    pocket: {
      nazev: '📗 Kapesní paperback 110 × 178', nast: {
        format: 'b6', okrajNahore: 13, okrajDole: 16, okrajVnitrni: 16, okrajVnejsi: 11, velikost: 9.5, radkovani: 1.32
      }
    },
    tiskarna: {
      nazev: '🏭 Do tiskárny 6 × 9″ se spadávkou', nast: {
        format: 'us6x9', okrajNahore: 18, okrajDole: 20, okrajVnitrni: 22, okrajVnejsi: 15, velikost: 11, spadavka: 3, znacky: true
      }
    },
    rukopis: {
      nazev: '📝 Rukopis A4 k redakci', nast: {
        format: 'a4', okrajNahore: 25, okrajDole: 25, okrajVnitrni: 30, okrajVnejsi: 30, zrcadlit: false,
        pismo: 'literata', velikost: 12, radkovani: 1.7, doBloku: false, deleni: false,
        obalka: false, tiraz: false, nalicho: false, inicialy: false, cisla: 'dole-stred', ilustrace: 'ne'
      }
    }
  };

  const cislo = (v, min, max, vych) => { const n = +v; return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : vych; };

  // doplní chybějící a ohlídá meze – nastavení přichází z URL/localStorage
  function doplnNastaveni(n) {
    const x = Object.assign({}, VYCHOZI, n || {});
    if (!FORMATY[x.format]) x.format = VYCHOZI.format;
    if (x.format !== 'vlastni') { x.sirka = FORMATY[x.format].s; x.vyska = FORMATY[x.format].v; }
    x.sirka = cislo(x.sirka, 80, 300, 148); x.vyska = cislo(x.vyska, 100, 420, 210);
    for (const k of ['okrajNahore', 'okrajDole', 'okrajVnitrni', 'okrajVnejsi']) x[k] = cislo(x[k], 3, 60, VYCHOZI[k]);
    x.spadavka = cislo(x.spadavka, 0, 5, 0);
    x.velikost = cislo(x.velikost, 7, 16, 11); x.radkovani = cislo(x.radkovani, 1, 2.2, 1.4); x.odsazeni = cislo(x.odsazeni, 0, 4, 1.2);
    x.od = Math.round(cislo(x.od, 0, 999, 0)); x.do = Math.round(cislo(x.do, -1, 999, -1));
    if (!PISMA[x.pismo]) x.pismo = VYCHOZI.pismo;
    if (!(x.predel in PREDELY)) x.predel = VYCHOZI.predel;
    if (!['text', 'strana', 'ne'].includes(x.ilustrace)) x.ilustrace = 'text';
    if (!['dole-vne', 'dole-stred', 'nahore-vne', 'ne'].includes(x.cisla)) x.cisla = 'dole-vne';
    x.autor = String(x.autor || '').slice(0, 120);
    return x;
  }

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const cssText = s => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ') + '"';

  // česká sazba: jednopísmenné předložky a spojky nesmí zůstat na konci řádku
  const NBSP = ' ';
  const predlozky = s => s.replace(/(^|[\s„‚(\[–—])([vszkouaiVSZKOUAI]) (?=\S)/g, `$1$2${NBSP}`)
    .replace(/(^|[\s„‚(\[–—])([vszkouaiVSZKOUAI]) (?=\S)/g, `$1$2${NBSP}`);   // podruhé kvůli „a v lese“

  const inline = (md, nast) => {
    const t = nast.predlozky ? predlozky(md) : md;
    return esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
  };

  // „I. Poslední drak“ → {znak:'I', nazev:'Poslední drak'}; „1. Kost“ → {znak:'1', …}; „Prolog. Archiv“, „Epilog II. Archiv“ → {znak:'Epilog II', …}
  function rozdelNazev(t) {
    const m = String(t).match(/^([0-9]+[a-z]?|[IVXLCDM]+|[A-ZÁ-Ž][a-zá-ž]+(?: [IVX]+)?)\.\s+(.+)$/);
    return m ? { znak: m[1], nazev: m[2] } : { znak: '', nazev: String(t) };
  }
  const popisKapitoly = r => r.znak ? (/^[0-9IVXLCDM]/.test(r.znak) ? `${r.znak}. ${r.nazev}` : `${r.znak} · ${r.nazev}`) : r.nazev;

  /* kniha z knihy.json, kapitoly [{nazev, bloky}], volby {datum} → HTML zdroj pro Paged.js */
  function htmlKnihy(kniha, kapitoly, n, volby = {}) {
    n = doplnNastaveni(n);
    const kn = rozdelNazev(kniha.nazev);
    const casti = [];
    if (n.obalka && kniha.obalka) {
      casti.push(`<section class="obalka uvodni"><img src="${esc(kniha.id + '/' + kniha.obalka)}" alt="Obálka – ${esc(kniha.nazev)}"></section>`);
    }
    if (n.titul) {
      casti.push(`<section class="titul uvodni">
<p class="serie">Kroniky vyhnanství</p>
${kn.znak ? `<p class="dil">Kniha ${esc(kn.znak)}</p>` : ''}
<h1 class="titul-nazev">${esc(kn.nazev)}</h1>
<p class="ozdoba">❦</p>
${kniha.podtitul ? `<p class="podtitul">${esc(kniha.podtitul)}</p>` : ''}
${n.autor ? `<p class="autor">${esc(n.autor)}</p>` : ''}
</section>`);
    }
    if (n.tiraz) {
      const d = volby.datum instanceof Date ? volby.datum : new Date();
      const datum = `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
      casti.push(`<section class="tiraz uvodni"><div>
<p><em>Kroniky vyhnanství</em><br>${esc(kniha.nazev)}${kniha.podtitul ? '<br>' + esc(kniha.podtitul) : ''}</p>
${n.autor ? `<p>© ${d.getFullYear()} ${esc(n.autor)}</p>` : ''}
<p>Vysázeno ${datum} písmem ${esc(PISMA[n.pismo].nazev.replace(/ \(.*\)$/, ''))} ${String(n.velikost).replace('.', ',')}/${String(Math.round(n.velikost * n.radkovani * 10) / 10).replace('.', ',')} b,<br>formát ${String(n.sirka).replace('.', ',')} × ${String(n.vyska).replace('.', ',')} mm.</p>
</div></section>`);
    }
    const rozdelene = kapitoly.map(k => rozdelNazev(k.nazev));
    if (n.obsah && kapitoly.length > 1) {
      casti.push(`<section class="obsah-knihy uvodni"><h2>Obsah</h2><ol>${rozdelene.map((r, i) =>
        `<li><a href="#kap${i + 1}"><span class="t">${esc(popisKapitoly(r))}</span><span class="vypln"></span></a></li>`).join('')}</ol></section>`);
    }
    kapitoly.forEach((k, ki) => {
      const r = rozdelene[ki];
      let html = `<section class="kapitola${ki === 0 ? ' prvni' : ''}" id="kap${ki + 1}">`;
      let prvniH = true, prvniP = true, poZlomu = true;
      for (const b of k.bloky) {
        if (b.typ === 'h') {
          if (prvniH) {
            html += `<h1 class="kap">${r.znak ? `<span class="znak${/^[0-9]/.test(r.znak) ? ' cislo' : ''}">${esc(r.znak)}</span>` : ''}<span class="nazev">${esc(r.nazev)}</span></h1>`;
            prvniH = false;
          } else html += `<h2 class="mezititul">${inline(b.md, n)}</h2>`;
          poZlomu = true;
        } else if (b.typ === 'hr') {
          html += `<p class="predel${n.predel === 'mezera' ? ' mezera' : ''}" aria-hidden="true">${esc(PREDELY[n.predel]) || NBSP}</p>`;
          poZlomu = true;
        } else if (b.typ === 'img') {
          if (n.ilustrace === 'ne') continue;
          html += `<figure class="ilustrace${n.ilustrace === 'strana' ? ' celostrana' : ''}"><img src="${esc(kniha.id + '/' + b.src)}" alt="${esc(b.popis || '')}">` +
            (n.popisky && b.popis ? `<figcaption>${inline(b.popis, n)}</figcaption>` : '') + '</figure>';
          poZlomu = true;
        } else {
          const tridy = [poZlomu ? 'bez-odsazeni' : '', prvniP && n.inicialy ? 'inicial' : ''].filter(Boolean);
          html += `<p${tridy.length ? ` class="${tridy.join(' ')}"` : ''}>${inline(b.md, n)}</p>`;
          prvniP = false; poZlomu = false;
        }
      }
      if (prvniH) html = html.replace('">', `"><h1 class="kap"><span class="nazev">${esc(r.nazev)}</span></h1>`);
      casti.push(html + '</section>');
    });
    return casti.join('\n');
  }

  const mm = x => `${Math.round(x * 100) / 100}mm`;

  /* nastavení (+ název knihy do záhlaví sudých stran) → CSS pro Paged.js (@page, záhlaví, typografie) */
  function cssKnihy(n, nazevKnihy = '') {
    n = doplnNastaveni(n);
    const vnitrni = n.okrajVnitrni, vnejsi = n.okrajVnejsi;
    const vyskaSazby = n.vyska - n.okrajNahore - n.okrajDole;
    const radek = n.velikost * n.radkovani;                     // v bodech
    const zahlavi = n.zahlavi ? 1 : 0;
    const pismoZahlavi = `font-family:${PISMA[n.pismo].rodina};font-size:${Math.max(7, n.velikost * 0.78).toFixed(2)}pt;letter-spacing:.08em;color:#333`;
    const cisloObsah = `content:counter(page);font-family:${PISMA[n.pismo].rodina};font-size:${(n.velikost * 0.9).toFixed(2)}pt;color:#222`;
    const vlevoBox = { 'dole-vne': '@bottom-left', 'dole-stred': '@bottom-center', 'nahore-vne': '@top-left' }[n.cisla];
    const vpravoBox = { 'dole-vne': '@bottom-right', 'dole-stred': '@bottom-center', 'nahore-vne': '@top-right' }[n.cisla];
    const zrc = n.zrcadlit;
    const strana = (levá) => {
      const ml = levá && zrc ? vnejsi : vnitrni, mr = levá && zrc ? vnitrni : vnejsi;
      let s = `margin-left:${mm(ml)};margin-right:${mm(mr)};`;
      if (zahlavi) s += `@top-center{content:${levá ? cssText(rozdelNazev(nazevKnihy).nazev || 'Kroniky vyhnanství') : 'string(kapitola)'};${pismoZahlavi};font-variant:small-caps;vertical-align:bottom;padding-bottom:4mm}`;
      if (n.cisla !== 'ne') s += `${levá ? vlevoBox : vpravoBox}{${cisloObsah};vertical-align:${n.cisla === 'nahore-vne' ? 'bottom;padding-bottom:4mm' : 'top;padding-top:5mm'}}`;
      return s;
    };
    const filtr = n.cernobile ? 'filter:grayscale(1) contrast(1.05);' : '';
    return `
@page{size:${mm(n.sirka)} ${mm(n.vyska)};margin:${mm(n.okrajNahore)} ${mm(vnejsi)} ${mm(n.okrajDole)} ${mm(vnitrni)};${n.spadavka ? `bleed:${mm(n.spadavka)};` : ''}${n.znacky ? 'marks:crop;' : ''}}
@page :left{${strana(true)}}
@page :right{${strana(false)}}
@page obalka{margin:0}
/* úvodní listy, otevření kapitol a vložené prázdné strany bez záhlaví (třídy doplní sazba_kniha.html) */
.pagedjs_page.bez-zahlavi .pagedjs_margin-top .pagedjs_margin-content{visibility:hidden}
.pagedjs_page.bez-cisla .pagedjs_margin-content{visibility:hidden}
${n.cisla === 'nahore-vne' ? '.pagedjs_page.otevreni .pagedjs_margin-content{visibility:hidden}' : ''}

html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
.pagedjs_page_content{font-family:${PISMA[n.pismo].rodina};font-size:${n.velikost}pt;line-height:${radek.toFixed(2)}pt;color:#111;
  font-kerning:normal;font-variant-ligatures:common-ligatures;font-variant-numeric:oldstyle-nums;
  text-align:${n.doBloku ? 'justify' : 'left'};${n.deleni ? 'hyphens:auto;-webkit-hyphens:auto;hyphenate-limit-chars:6 3 3;' : 'hyphens:manual;'}
  orphans:2;widows:2}
p{margin:0;text-indent:${n.odsazeni}em}
p.bez-odsazeni{text-indent:0}
/* Paged.js značí rozdělený prvek „roztáhni poslední řádek“ – u rozdělené kapitoly by se to zdědilo do všech odstavců */
section[data-align-last-split-element] > *{text-align-last:auto}
section > p[data-align-last-split-element='justify']{text-align-last:justify}
em{font-style:italic}

/* obálka přes celou stranu (i se spadávkou) */
section.obalka{page:obalka;break-after:page}
section.obalka img{display:block;width:${mm(n.sirka + 2 * n.spadavka)};height:${mm(n.vyska + 2 * n.spadavka)};object-fit:cover;margin:${n.spadavka ? `-${mm(n.spadavka)}` : '0'}}

section.titul{break-before:${n.nalicho ? 'right' : 'page'};text-align:center;padding-top:${mm(vyskaSazby * 0.18)};hyphens:manual}
.titul p{text-indent:0;text-align:center}
.titul .serie{font-variant:small-caps;letter-spacing:.18em;font-size:1.05em}
.titul .dil{margin-top:${mm(vyskaSazby * 0.08)};font-size:.95em;font-style:italic}
.titul .titul-nazev{font-weight:600;font-size:2.6em;line-height:1.1;margin:.25em 0 .2em;letter-spacing:.02em}
.titul .ozdoba{font-size:1.4em;margin:.4em 0}
.titul .podtitul{font-style:italic}
.titul .autor{margin-top:${mm(vyskaSazby * 0.2)};font-variant:small-caps;letter-spacing:.12em;font-size:1.1em}

section.tiraz{break-before:page;height:${mm(vyskaSazby - 1)};display:flex;align-items:flex-end;font-size:.82em;line-height:1.45;hyphens:manual}
.tiraz p{text-indent:0;text-align:left;margin-top:.8em}

section.obsah-knihy{break-before:${n.nalicho ? 'right' : 'page'};hyphens:manual}
.obsah-knihy h2{font-weight:400;font-variant:small-caps;letter-spacing:.15em;text-align:center;font-size:1.35em;margin:${mm(vyskaSazby * 0.08)} 0 1.4em}
.obsah-knihy ol{list-style:none;margin:0;padding:0}
.obsah-knihy li{margin:0 0 .35em;break-inside:avoid}
.obsah-knihy a{display:flex;align-items:baseline;color:inherit;text-decoration:none;text-align:left}
.obsah-knihy .vypln{flex:1;border-bottom:1px dotted #777;margin:0 .4em;transform:translateY(-.25em)}
.obsah-knihy a::after{content:target-counter(attr(href), page);font-variant-numeric:lining-nums}

section.kapitola{break-before:${n.nalicho ? 'right' : 'page'}}
section.kapitola.prvni{counter-reset:page 1}
h1.kap{margin:${mm(vyskaSazby * 0.14)} 0 ${(radek * 2).toFixed(2)}pt;text-align:center;font-weight:400;hyphens:manual;break-after:avoid}
h1.kap .znak{display:block;font-size:1.05em;font-variant:small-caps;letter-spacing:.2em;color:#444;margin-bottom:.5em}
h1.kap .znak.cislo{font-size:2.1em;font-variant:normal;letter-spacing:0;font-variant-numeric:oldstyle-nums;margin-bottom:.15em}
h1.kap .nazev{display:block;font-size:1.75em;line-height:1.2;font-weight:600;string-set:kapitola content(text)}
h1.kap::after{content:"";display:block;width:12mm;margin:.9em auto 0;border-top:.4pt solid #555}
h2.mezititul{font-size:1.1em;font-weight:600;text-align:center;margin:${radek.toFixed(2)}pt 0;break-after:avoid}
p.inicial::first-letter{float:left;font-size:${(radek * 2.75).toFixed(2)}pt;line-height:${(radek * 2).toFixed(2)}pt;padding:.06em .08em 0 0;margin-top:.04em;font-weight:400;color:#222}
p.inicial{text-indent:0}
p.inicial + p{clear:left}   /* krátký první odstavec: další nezačne vedle iniciály */

p.predel{text-indent:0;text-align:center;margin:${(radek * 0.5).toFixed(2)}pt 0;letter-spacing:.2em;break-after:avoid;hyphens:manual}
p.predel.mezera{margin:0}

figure.ilustrace{margin:${(radek * 0.8).toFixed(2)}pt 0;text-align:center;break-inside:avoid}
figure.ilustrace img{max-width:100%;max-height:${mm(vyskaSazby * 0.62)};width:auto;height:auto;${filtr}}
figure.celostrana{break-before:page;break-after:page;margin:0;height:${mm(vyskaSazby - 2)};display:flex;flex-direction:column;justify-content:center;align-items:center}
figure.celostrana img{max-height:${mm(vyskaSazby * 0.88)}}
figcaption{font-style:italic;font-size:.86em;line-height:1.3;margin-top:.5em;text-align:center;text-indent:0;hyphens:manual}
`;
  }

  const API = { PISMA, FORMATY, PREDELY, PREDVOLBY, VYCHOZI, doplnNastaveni, htmlKnihy, cssKnihy, rozdelNazev, predlozky };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else koren.KRONIKY_SAZBA = API;
})(typeof window !== 'undefined' ? window : globalThis);
