/* Sazba knihy – jádro bez DOM.
   Kniha {nazev, podtitul, serie, dil, autor, jazyk, obalka, obalkaBarva, zadniText, kapitoly:[{nazev, bloky}]}
   + nastavení → HTML a CSS Paged Media, které stránkuje Paged.js (sazba/kniha.html).
   Blok: {typ:'h'|'h2'|'p'|'hr'|'img'|'citace'|'seznam', html, src, popis, cislovany, polozky}
   – html je už bezpečné vnitřní HTML (em/strong/…).
   V prohlížeči window.SAZBA_JADRO, v node require(). */
(function (koren) {
  'use strict';

  const PISMA = {
    garamond: { nazev: 'EB Garamond (klasická kniha)', jmeno: 'EB Garamond', rodina: '"EB Garamond", Georgia, serif' },
    literata: { nazev: 'Literata (čitelná, moderní)', jmeno: 'Literata', rodina: 'Literata, Georgia, serif' },
    georgia: { nazev: 'Georgia (systémové)', jmeno: 'Georgia', rodina: 'Georgia, "Times New Roman", serif' }
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

  // texty, které se tisknou do knihy – v jazyce knihy, ne rozhraní
  const JAZYKY = {
    cs: { nazev: 'čeština', kniha: 'Kniha', obsah: 'Obsah', tiraz: (d, p, f) => `Vysázeno ${d} písmem ${p},<br>formát ${f} mm.` },
    sk: { nazev: 'slovenčina', kniha: 'Kniha', obsah: 'Obsah', tiraz: (d, p, f) => `Vysádzané ${d} písmom ${p},<br>formát ${f} mm.` },
    en: { nazev: 'English', kniha: 'Book', obsah: 'Contents', tiraz: (d, p, f) => `Typeset on ${d} in ${p},<br>trim size ${f} mm.` },
    de: { nazev: 'Deutsch', kniha: 'Band', obsah: 'Inhalt', tiraz: (d, p, f) => `Gesetzt am ${d} in ${p},<br>Format ${f} mm.` }
  };

  const VYCHOZI = {
    od: 0, do: -1,
    format: 'a5', sirka: 148, vyska: 210,
    okrajNahore: 17, okrajDole: 20, okrajVnitrni: 20, okrajVnejsi: 15,
    zrcadlit: true, spadavka: 0, znacky: false,
    pismo: 'garamond', velikost: 11, radkovani: 1.4, doBloku: true, deleni: true, odsazeni: 1.2,
    obalka: true, titul: true, tiraz: true, obsah: true, zadni: true,
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
        obalka: false, tiraz: false, zadni: false, nalicho: false, inicialy: false, cisla: 'dole-stred', ilustrace: 'ne'
      }
    }
  };

  const cislo = (v, min, max, vych) => { const n = +v; return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : vych; };

  // doplní chybějící a ohlídá meze – nastavení přichází z localStorage
  function doplnNastaveni(n) {
    const x = Object.assign({}, VYCHOZI, n || {});
    if (!FORMATY[x.format]) x.format = VYCHOZI.format;
    if (x.format !== 'vlastni') { x.sirka = FORMATY[x.format].s; x.vyska = FORMATY[x.format].v; }
    x.sirka = cislo(x.sirka, 80, 300, 148); x.vyska = cislo(x.vyska, 100, 420, 210);
    for (const k of ['okrajNahore', 'okrajDole', 'okrajVnitrni', 'okrajVnejsi']) x[k] = cislo(x[k], 3, 60, VYCHOZI[k]);
    x.spadavka = cislo(x.spadavka, 0, 5, 0);
    x.velikost = cislo(x.velikost, 7, 16, 11); x.radkovani = cislo(x.radkovani, 1, 2.2, 1.4); x.odsazeni = cislo(x.odsazeni, 0, 4, 1.2);
    x.od = Math.round(cislo(x.od, 0, 9999, 0)); x.do = Math.round(cislo(x.do, -1, 9999, -1));
    if (!PISMA[x.pismo]) x.pismo = VYCHOZI.pismo;
    if (!(x.predel in PREDELY)) x.predel = VYCHOZI.predel;
    if (!['text', 'strana', 'ne'].includes(x.ilustrace)) x.ilustrace = 'text';
    if (!['dole-vne', 'dole-stred', 'nahore-vne', 'ne'].includes(x.cisla)) x.cisla = 'dole-vne';
    return x;
  }

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const cssText = s => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ') + '"';
  const NBSP = '\u00a0';

  // česká a slovenská sazba: jednopísmenné předložky a spojky nesmí zůstat na konci řádku
  // (pracuje na HTML – mezery uvnitř značek nemění, protože za předložkou musí následovat ne-mezera)
  const predlozky = s => s.replace(/(^|[\s„‚(\[–—>])([vszkouaiVSZKOUAI]) (?=[^\s<])/g, `$1$2${NBSP}`)
    .replace(/(^|[\s„‚(\[–—>])([vszkouaiVSZKOUAI]) (?=[^\s<])/g, `$1$2${NBSP}`);   // podruhé kvůli „a v lese“

  // Markdown na řádku → bezpečné HTML (*kurzíva*, **tučně**, _kurzíva_)
  const inlineMd = md => esc(md).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/(^|[\s(])_(\S(?:.*?\S)?)_(?=[\s.,;:!?)]|$)/g, '$1<em>$2</em>');

  /* Markdown → kapitoly. Nadpis „# …“ začíná kapitolu (text před prvním nadpisem je kapitola bez názvu
     nebo s názvem `vychoziNazev`), „##“/„###“ = mezititul, samotné *, ***, ---, * * *, ⁂ = předěl scén,
     ![popis](soubor) = ilustrace, > = citace, - / 1. = seznam. Prostý text bez prázdných řádků → řádek = odstavec. */
  function rozeberMarkdown(md, vychoziNazev = '') {
    let text = String(md).replace(/\r/g, '').replace(/^\ufeff/, '');
    if (!/\n\s*\n/.test(text.trim())) text = text.replace(/\n/g, '\n\n');
    const kapitoly = [];
    let kap = null;
    const nova = nazev => { kap = { nazev, bloky: [] }; kapitoly.push(kap); };
    for (const odst of text.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean)) {
      const h1 = odst.match(/^#\s+(.+)$/s);
      if (h1) { nova(h1[1].replace(/\s*\n\s*/g, ' ').trim()); kap.bloky.push({ typ: 'h', html: inlineMd(kap.nazev) }); continue; }
      if (!kap) nova(vychoziNazev);
      let m;
      if (/^(\*+|(\* ?){3,}|-{3,}|_{3,}|⁂|❦)$/.test(odst)) kap.bloky.push({ typ: 'hr' });
      else if ((m = odst.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/))) kap.bloky.push({ typ: 'img', popis: m[1], src: m[2] });
      else if ((m = odst.match(/^#{2,6}\s+(.+)$/s))) kap.bloky.push({ typ: 'h2', html: inlineMd(m[1].replace(/\s*\n\s*/g, ' ')) });
      else if (/^>/.test(odst)) kap.bloky.push({ typ: 'citace', html: inlineMd(odst.replace(/^>\s?/gm, '').replace(/\s*\n\s*/g, ' ')) });
      else if (odst.split('\n').every(r => /^\s*([-*+]|\d+[.)])\s+/.test(r))) {
        const radky = odst.split('\n');
        kap.bloky.push({ typ: 'seznam', cislovany: /^\s*\d/.test(radky[0]), polozky: radky.map(r => inlineMd(r.replace(/^\s*([-*+]|\d+[.)])\s+/, ''))) });
      } else kap.bloky.push({ typ: 'p', html: inlineMd(odst.replace(/\s*\n\s*/g, ' ')) });
    }
    return kapitoly;
  }

  // „I. Poslední drak“ → {znak:'I', nazev:'Poslední drak'}; „1. Kost“ → {znak:'1', …}; „Prolog. Archiv“, „Epilog II. Archiv“ → {znak:'Epilog II', …}
  function rozdelNazev(t) {
    const m = String(t).match(/^([0-9]+[a-z]?|[IVXLCDM]+|[A-ZÁ-Ž][a-zá-ž]+(?: [IVX]+)?)\.\s+(.+)$/);
    return m ? { znak: m[1], nazev: m[2] } : { znak: '', nazev: String(t) };
  }
  const popisKapitoly = r => r.znak ? (/^[0-9IVXLCDM]/.test(r.znak) ? `${r.znak}. ${r.nazev}` : `${r.znak} · ${r.nazev}`) : r.nazev;
  const jazykKnihy = k => JAZYKY[k && k.jazyk] ? k.jazyk : 'cs';
  const desetinne = (x, jaz) => jaz === 'en' ? String(x) : String(x).replace('.', ',');

  // vybrané kapitoly podle rozsahu od–do (do −1 = do konce)
  function vyberKapitol(kapitoly, n) {
    const od = Math.max(0, Math.min(n.od, kapitoly.length - 1));
    const az = n.do < 0 ? kapitoly.length - 1 : Math.max(od, Math.min(n.do, kapitoly.length - 1));
    return kapitoly.slice(od, az + 1);
  }

  /* kniha + nastavení → HTML zdroj pro Paged.js (src obrázků musí být už použitelné URL) */
  function htmlKnihy(kniha, n, volby = {}) {
    n = doplnNastaveni(n);
    const jaz = jazykKnihy(kniha), L = JAZYKY[jaz];
    const nbsp = n.predlozky && (jaz === 'cs' || jaz === 'sk');
    const txt = h => nbsp ? predlozky(h) : h;
    const kapitoly = vyberKapitol(kniha.kapitoly || [], n);
    const casti = [];
    if (n.obalka) {
      if (kniha.obalka) casti.push(`<section class="obalka uvodni"><img src="${esc(kniha.obalka)}" alt=""></section>`);
      else casti.push(`<section class="obalka textova uvodni"><div class="ramec">
${kniha.serie ? `<p class="serie">${esc(kniha.serie)}</p>` : ''}<h1>${esc(kniha.nazev || '')}</h1>
${kniha.podtitul ? `<p class="podtitul">${esc(kniha.podtitul)}</p>` : ''}${kniha.autor ? `<p class="autor">${esc(kniha.autor)}</p>` : ''}</div></section>`);
    }
    if (n.titul) {
      casti.push(`<section class="titul uvodni">
${kniha.serie ? `<p class="serie">${esc(kniha.serie)}</p>` : ''}
${kniha.dil ? `<p class="dil">${esc(L.kniha)} ${esc(kniha.dil)}</p>` : ''}
<h1 class="titul-nazev">${esc(kniha.nazev || '')}</h1>
<p class="ozdoba">❦</p>
${kniha.podtitul ? `<p class="podtitul">${esc(kniha.podtitul)}</p>` : ''}
${kniha.autor ? `<p class="autor">${esc(kniha.autor)}</p>` : ''}
</section>`);
    }
    if (n.tiraz) {
      const d = volby.datum instanceof Date ? volby.datum : new Date();
      const datum = jaz === 'en' ? d.toISOString().slice(0, 10) : `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
      const pismo = `${PISMA[n.pismo].jmeno} ${desetinne(n.velikost, jaz)}/${desetinne(Math.round(n.velikost * n.radkovani * 10) / 10, jaz)} pt`;
      casti.push(`<section class="tiraz uvodni"><div>
<p>${kniha.serie ? `<em>${esc(kniha.serie)}</em><br>` : ''}${esc(kniha.nazev || '')}${kniha.podtitul ? '<br>' + esc(kniha.podtitul) : ''}</p>
${kniha.autor ? `<p>© ${d.getFullYear()} ${esc(kniha.autor)}</p>` : ''}
<p>${L.tiraz(datum, esc(pismo), `${desetinne(n.sirka, jaz)} × ${desetinne(n.vyska, jaz)}`)}</p>
</div></section>`);
    }
    const rozdelene = kapitoly.map(k => rozdelNazev(k.nazev || ''));
    if (n.obsah && kapitoly.length > 1) {
      casti.push(`<section class="obsah-knihy uvodni"><h2>${esc(L.obsah)}</h2><ol>${rozdelene.map((r, i) =>
        `<li><a href="#kap${i + 1}"><span class="t">${esc(popisKapitoly(r) || '—')}</span><span class="vypln"></span></a></li>`).join('')}</ol></section>`);
    }
    kapitoly.forEach((k, ki) => {
      const r = rozdelene[ki];
      let html = `<section class="kapitola${ki === 0 ? ' prvni' : ''}" id="kap${ki + 1}">`;
      const nadpis = `<h1 class="kap">${r.znak ? `<span class="znak${/^[0-9]/.test(r.znak) ? ' cislo' : ''}">${esc(r.znak)}</span>` : ''}<span class="nazev">${esc(r.nazev)}</span></h1>`;
      if (!k.bloky.some(b => b.typ === 'h')) html += nadpis;
      let prvniP = true, poZlomu = true;
      for (const b of k.bloky) {
        if (b.typ === 'h') { html += nadpis; poZlomu = true; }
        else if (b.typ === 'h2') { html += `<h2 class="mezititul">${txt(b.html)}</h2>`; poZlomu = true; }
        else if (b.typ === 'hr') {
          html += `<p class="predel${n.predel === 'mezera' ? ' mezera' : ''}" aria-hidden="true">${esc(PREDELY[n.predel]) || NBSP}</p>`;
          poZlomu = true;
        } else if (b.typ === 'img') {
          if (n.ilustrace === 'ne' || !b.src) continue;
          html += `<figure class="ilustrace${n.ilustrace === 'strana' ? ' celostrana' : ''}"><img src="${esc(b.src)}" alt="${esc(b.popis || '')}">` +
            (n.popisky && b.popis ? `<figcaption>${txt(esc(b.popis))}</figcaption>` : '') + '</figure>';
          poZlomu = true;
        } else if (b.typ === 'citace') { html += `<blockquote>${txt(b.html)}</blockquote>`; poZlomu = true; }
        else if (b.typ === 'seznam') {
          const t = b.cislovany ? 'ol' : 'ul';
          html += `<${t} class="seznam">${b.polozky.map(p => `<li>${txt(p)}</li>`).join('')}</${t}>`;
          poZlomu = true;
        } else {
          const tridy = [poZlomu ? 'bez-odsazeni' : '', prvniP && n.inicialy ? 'inicial' : ''].filter(Boolean);
          html += `<p${tridy.length ? ` class="${tridy.join(' ')}"` : ''}>${txt(b.html)}</p>`;
          prvniP = false; poZlomu = false;
        }
      }
      casti.push(html + '</section>');
    });
    if (n.zadni && kniha.zadniText) {
      casti.push(`<section class="zadni uvodni"><div class="ramec">${String(kniha.zadniText).split(/\n\s*\n/).map(o => `<p>${txt(esc(o.trim()))}</p>`).join('')}</div></section>`);
    }
    return casti.join('\n');
  }

  const mm = x => `${Math.round(x * 100) / 100}mm`;
  // barva obálky → tmavá/světlá písmena
  const svetla = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return false; const v = parseInt(m[1], 16); return (0.299 * (v >> 16) + 0.587 * (v >> 8 & 255) + 0.114 * (v & 255)) > 150; };

  /* nastavení + kniha (název do záhlaví sudých stran, barva obálky) → CSS pro Paged.js */
  function cssKnihy(n, kniha = {}) {
    n = doplnNastaveni(n);
    const vnitrni = n.okrajVnitrni, vnejsi = n.okrajVnejsi;
    const vyskaSazby = n.vyska - n.okrajNahore - n.okrajDole;
    const radek = n.velikost * n.radkovani;                     // v bodech
    const rodina = PISMA[n.pismo].rodina;
    const pismoZahlavi = `font-family:${rodina};font-size:${Math.max(7, n.velikost * 0.78).toFixed(2)}pt;letter-spacing:.08em;color:#333`;
    const cisloObsah = `content:counter(page);font-family:${rodina};font-size:${(n.velikost * 0.9).toFixed(2)}pt;color:#222`;
    const vlevoBox = { 'dole-vne': '@bottom-left', 'dole-stred': '@bottom-center', 'nahore-vne': '@top-left' }[n.cisla];
    const vpravoBox = { 'dole-vne': '@bottom-right', 'dole-stred': '@bottom-center', 'nahore-vne': '@top-right' }[n.cisla];
    const strana = leva => {
      const ml = leva && n.zrcadlit ? vnejsi : vnitrni, mr = leva && n.zrcadlit ? vnitrni : vnejsi;
      let s = `margin-left:${mm(ml)};margin-right:${mm(mr)};`;
      if (n.zahlavi) s += `@top-center{content:${leva ? cssText(kniha.nazev || '') : 'string(kapitola)'};${pismoZahlavi};font-variant:small-caps;vertical-align:bottom;padding-bottom:4mm}`;
      if (n.cisla !== 'ne') s += `${leva ? vlevoBox : vpravoBox}{${cisloObsah};vertical-align:${n.cisla === 'nahore-vne' ? 'bottom;padding-bottom:4mm' : 'top;padding-top:5mm'}}`;
      return s;
    };
    const filtr = n.cernobile ? 'filter:grayscale(1) contrast(1.05);' : '';
    const barva = /^#[0-9a-f]{6}$/i.test(kniha.obalkaBarva || '') ? kniha.obalkaBarva : '#2c3e50';
    const pismoObalky = svetla(barva) ? '#1a1a1a' : '#f4ecd8';
    const celaStrana = `width:${mm(n.sirka + 2 * n.spadavka)};height:${mm(n.vyska + 2 * n.spadavka)};margin:${n.spadavka ? `-${mm(n.spadavka)}` : '0'}`;
    return `
@page{size:${mm(n.sirka)} ${mm(n.vyska)};margin:${mm(n.okrajNahore)} ${mm(vnejsi)} ${mm(n.okrajDole)} ${mm(vnitrni)};${n.spadavka ? `bleed:${mm(n.spadavka)};` : ''}${n.znacky ? 'marks:crop;' : ''}}
@page :left{${strana(true)}}
@page :right{${strana(false)}}
@page obalka{margin:0}
/* úvodní listy, otevření kapitol a vložené prázdné strany bez záhlaví (třídy doplní sazba/kniha.html) */
.pagedjs_page.bez-zahlavi .pagedjs_margin-top .pagedjs_margin-content{visibility:hidden}
.pagedjs_page.bez-cisla .pagedjs_margin-content{visibility:hidden}
${n.cisla === 'nahore-vne' ? '.pagedjs_page.otevreni .pagedjs_margin-content{visibility:hidden}' : ''}

html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
.pagedjs_page_content{font-family:${rodina};font-size:${n.velikost}pt;line-height:${radek.toFixed(2)}pt;color:#111;
  font-kerning:normal;font-variant-ligatures:common-ligatures;font-variant-numeric:oldstyle-nums;
  text-align:${n.doBloku ? 'justify' : 'left'};${n.deleni ? 'hyphens:auto;-webkit-hyphens:auto;hyphenate-limit-chars:6 3 3;' : 'hyphens:manual;'}
  orphans:2;widows:2}
p{margin:0;text-indent:${n.odsazeni}em}
p.bez-odsazeni{text-indent:0}
/* Paged.js značí rozdělený prvek „roztáhni poslední řádek“ – u rozdělené kapitoly by se to zdědilo do všech odstavců */
section[data-align-last-split-element] > *{text-align-last:auto}
section > p[data-align-last-split-element='justify']{text-align-last:justify}

/* obálka přes celou stranu (i se spadávkou) */
section.obalka{page:obalka;break-after:page}
section.obalka img{display:block;${celaStrana};object-fit:cover}
section.obalka.textova,section.zadni{page:obalka}
section.obalka.textova .ramec,section.zadni .ramec{${celaStrana};background:${barva};color:${pismoObalky};display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:${mm(n.sirka * 0.12)};hyphens:manual}
section.obalka.textova h1{font-size:2.8em;line-height:1.1;font-weight:600;margin:.3em 0}
section.obalka.textova .serie{font-variant:small-caps;letter-spacing:.2em;text-indent:0}
section.obalka.textova .podtitul{font-style:italic;text-indent:0}
section.obalka.textova .autor{margin-top:3em;font-variant:small-caps;letter-spacing:.15em;font-size:1.2em;text-indent:0}
section.zadni{break-before:left}
section.zadni .ramec{text-align:left;align-items:stretch}
section.zadni p{text-indent:0;margin:0 0 .8em}

section.titul{break-before:${n.nalicho ? 'right' : 'page'};text-align:center;padding-top:${mm(vyskaSazby * 0.18)};hyphens:manual}
.titul p{text-indent:0;text-align:center}
.titul .serie{font-variant:small-caps;letter-spacing:.18em;font-size:1.05em}
.titul .dil{margin-top:${mm(vyskaSazby * 0.08)};font-size:.95em;font-style:italic}
.titul .titul-nazev{font-weight:600;font-size:2.6em;line-height:1.1;margin:.25em 0 .2em;letter-spacing:.02em}
.titul .serie + .titul-nazev{margin-top:${mm(vyskaSazby * 0.08)}}
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
h2.mezititul{font-size:1.1em;font-weight:600;text-align:center;margin:${radek.toFixed(2)}pt 0;break-after:avoid;hyphens:manual}
p.inicial::first-letter{float:left;font-size:${(radek * 2.75).toFixed(2)}pt;line-height:${(radek * 2).toFixed(2)}pt;padding:.06em .08em 0 0;margin-top:.04em;font-weight:400;color:#222}
p.inicial{text-indent:0}
p.inicial + p{clear:left}   /* krátký první odstavec: další nezačne vedle iniciály */
blockquote{margin:${(radek * 0.5).toFixed(2)}pt 1.5em;font-style:italic}
ul.seznam,ol.seznam{margin:${(radek * 0.5).toFixed(2)}pt 0;padding-left:1.6em}

p.predel{text-indent:0;text-align:center;margin:${(radek * 0.5).toFixed(2)}pt 0;letter-spacing:.2em;break-after:avoid;hyphens:manual}
p.predel.mezera{margin:0}

figure.ilustrace{margin:${(radek * 0.8).toFixed(2)}pt 0;text-align:center;break-inside:avoid}
figure.ilustrace img{max-width:100%;max-height:${mm(vyskaSazby * 0.62)};width:auto;height:auto;${filtr}}
figure.celostrana{break-before:page;break-after:page;margin:0;height:${mm(vyskaSazby - 2)};display:flex;flex-direction:column;justify-content:center;align-items:center}
figure.celostrana img{max-height:${mm(vyskaSazby * 0.88)}}
figcaption{font-style:italic;font-size:.86em;line-height:1.3;margin-top:.5em;text-align:center;text-indent:0;hyphens:manual}
`;
  }

  const API = { PISMA, FORMATY, PREDELY, PREDVOLBY, JAZYKY, VYCHOZI, doplnNastaveni, rozeberMarkdown, inlineMd, htmlKnihy, cssKnihy, rozdelNazev, predlozky, vyberKapitol, esc };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else koren.SAZBA_JADRO = API;
})(typeof window !== 'undefined' ? window : globalThis);
