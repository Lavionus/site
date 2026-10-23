/* ============================================================
   Písmolijna – ui/dialogy.js
   Dialogová okna: start, nový font, informace o fontu, projekty,
   import a export, nástroje pro celý font (obtažení, zesílení,
   kurzíva, akcenty, mezery, kerning, kapitálky, interpolace),
   šablona ručního písma a její sken, nápověda.
   ============================================================ */
(function () {
  'use strict';
  const P = window.PSL, A = window.PSLAPP;
  const el = A.el;
  const D = A.dialogy = {};
  const ma = fn => typeof P[fn] === 'function';
  const cislo = v => { const x = parseFloat(String(v).replace(',', '.')); return isFinite(x) ? x : null; };

  /* ---------- obecné okno ----------
     okno({nadpis, telo: [uzly], tlacitka: [{text, hodnota, hlavni}], sirka})
     → Promise<hodnota tlačítka | null (Esc)> */
  D.okno = function (o) {
    return new Promise(ok => {
      const d = el('dialog', { class: 'okno' });
      if (o.sirka) d.style.width = o.sirka;
      const telo = el('div', { class: 'telo' }, o.telo || []);
      const pat = el('div', { class: 'paticka' }, (o.tlacitka || [{ text: 'Zavřít', hodnota: null }]).map(t =>
        el('button', { type: 'button', class: 'tl' + (t.hlavni ? ' hlavni' : ''), text: t.text, onclick: async () => {
          if (t.over && !(await t.over())) return;
          zavri(t.hodnota);
        } })));
      d.append(el('div', { class: 'telo-obal' }, [el('h2', { text: o.nadpis }), telo, pat]));
      let hotovo = false;
      function zavri(h) { if (hotovo) return; hotovo = true; d.close(); d.remove(); ok(h); }
      d.addEventListener('cancel', e => { e.preventDefault(); zavri(null); });
      d.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') {
          const h = (o.tlacitka || []).find(t => t.hlavni);
          if (h) { e.preventDefault(); pat.querySelector('.hlavni').click(); }
        }
      });
      document.body.append(d);
      d.showModal();
      D._zavri = zavri;
      const prvni = telo.querySelector('input, select, textarea');
      if (prvni && !o.bezFokusu) prvni.focus();
    });
  };
  /* Řádek formuláře; vrací {radek, vstup}. */
  function pole(popis, vstup, tip) {
    const id = 'dlg-' + Math.random().toString(36).slice(2, 8);
    vstup.id = id;
    return el('div', { class: 'pole', title: tip || '' }, [el('label', { for: id, text: popis }), vstup]);
  }
  function vstup(typ, hodnota, attr) { const i = el('input', Object.assign({ type: typ }, attr || {})); if (typ === 'checkbox') i.checked = !!hodnota; else i.value = hodnota; return i; }
  function vyber(moznosti, hodnota) {
    return el('select', {}, moznosti.map(([v, t]) => { const o = el('option', { value: v, text: t }); if (String(v) === String(hodnota)) o.selected = true; return o; }));
  }
  D.pole = pole; D.vstup = vstup; D.vyber = vyber;

  /* Výběr souboru → Promise<File|null> */
  D.soubor = function (accept) {
    return new Promise(ok => {
      const i = document.getElementById('soubor');
      i.value = ''; i.accept = accept || '';
      i.onchange = () => ok(i.files[0] || null);
      i.click();
    });
  };
  const nactiText = f => f.text();
  const nactiData = f => f.arrayBuffer();
  const nactiDataUrl = f => new Promise((ok, chyba) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = chyba; r.readAsDataURL(f); });

  /* ---------- start ---------- */
  D.start = async function () {
    const projekty = await A.projekty();
    const seznam = el('div', { class: 'projekty' });
    for (const p of projekty.slice(0, 12)) {
      seznam.append(el('div', { class: 'projekt' }, [
        el('div', { class: 'jm', onclick: () => otevriProjekt(p.id) }, [p.nazev, el('small', { text: new Date(p.zmeneno).toLocaleString('cs-CZ') + (p.glyfu != null ? ' · ' + p.glyfu + ' glyfů' : '') })]),
        el('button', { type: 'button', class: 'tl', text: 'Otevřít', onclick: () => otevriProjekt(p.id) })
      ]));
    }
    const volba = (ikona, nazev, popis, fn) => el('button', { type: 'button', onclick: fn }, [el('b', { text: ikona + ' ' + nazev }), el('span', { text: popis })]);
    const telo = [
      el('p', { class: 'poznamka', style: 'margin-bottom:10px', text: 'Editor písma v prohlížeči: kreslete glyfy Bézierovými křivkami, nastavte mezery a kerning, zkontrolujte chyby a stáhněte TTF, OTF nebo WOFF. Vše zůstává ve vašem počítači.' }),
      el('div', { class: 'start-volby' }, [
        volba('✨', 'Nový font', 'Prázdný font s metrikami podle vás', () => { D._zavri('novy'); }),
        volba('📂', 'Otevřít soubor', 'TTF, OTF, WOFF nebo projekt .pismo.json', () => { D._zavri('soubor'); }),
        volba('📚', 'Z knihovny webu', 'Upravit některé z volných písem (OFL)', () => { D._zavri('knihovna'); }),
        volba('✍️', 'Moje rukopisné písmo', 'Vytisknout šablonu, napsat, naskenovat', () => { D._zavri('rukopis'); }),
        volba('✨', 'Generátor stylů', 'Strašidelné, metalové, Diablo, neon, pixel… jedním klikem', () => { D._zavri('generator'); })
      ])
    ];
    if (projekty.length) telo.push(el('h3', { text: 'Rozpracované projekty', style: 'margin-top:14px;font-size:.9rem' }), seznam);
    const v = await D.okno({ nadpis: '🅰️ Písmolijna', telo, tlacitka: A.font ? [{ text: 'Zavřít', hodnota: null }] : [{ text: 'Začít prázdným fontem', hodnota: 'prazdny' }], sirka: 'min(720px, 96vw)', bezFokusu: true });
    if (v === 'novy') return D.novyFont();
    if (v === 'soubor') return D.otevriSoubor();
    if (v === 'knihovna') return D.zKnihovny();
    if (v === 'rukopis') return D.rukopis();
    if (v === 'generator') { if (!A.font) A.otevriFont(P.novyFont()); A.prepniPohled('generator'); return; }
    if (v === 'prazdny' || (!A.font && v == null)) { A.otevriFont(P.novyFont()); }
  };
  async function otevriProjekt(id) {
    if (D._zavri) D._zavri('projekt');
    const f = await A.nactiProjekt(id);
    if (!f) { A.zprava('Projekt se nepodařilo načíst.', true); return; }
    A.otevriFont(f, id);
    A.zprava('Otevřeno: ' + f.info.rodina + ' ' + f.info.styl);
  }
  D.otevriProjekt = otevriProjekt;

  /* ---------- nový font ---------- */
  D.novyFont = async function () {
    const rod = vstup('text', 'Moje písmo'), sty = vyber([['Regular', 'Regular'], ['Bold', 'Bold'], ['Italic', 'Italic'], ['Bold Italic', 'Bold Italic'], ['Light', 'Light']], 'Regular');
    const upm = vyber([[1000, '1000 (OpenType/CFF)'], [2048, '2048 (TrueType)'], [1024, '1024']], 1000);
    const xv = vstup('number', 500), cap = vstup('number', 700), asc = vstup('number', 800), desc = vstup('number', -200);
    const sada = vyber([['cesky', 'česká abeceda + číslice + interpunkce'], ['zaklad', 'základní latinka (ASCII)'], ['nic', 'nic – jen .notdef a mezera']], 'cesky');
    const pripr = vstup('checkbox', true);
    const v = await D.okno({
      nadpis: '✨ Nový font', telo: [
        pole('Rodina písma', rod), pole('Řez', sty), pole('Jednotek na em', upm),
        pole('x-výška', xv), pole('Výška verzálek', cap), pole('Ascender', asc), pole('Descender', desc, 'Záporné číslo – jak hluboko sahají dotahy pod účaří'),
        pole('Připravit prázdné glyfy', sada, 'V mřížce se ukážou jako buňky k vyplnění'),
        pole('Sestavit akcenty automaticky', pripr, 'Až nakreslíte základní písmena a akcenty, Nástroje → Sestavit akcenty doplní á, č, ř…')
      ], tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Vytvořit', hodnota: true, hlavni: true }]
    });
    if (!v) { if (!A.font) return D.start(); return; }
    const u = +upm.value, k = u / 1000;
    const f = P.novyFont({
      rodina: rod.value.trim() || 'Moje písmo', styl: sty.value, upm: u,
      xVyska: Math.round(cislo(xv.value) * k), vyskaVerzalek: Math.round(cislo(cap.value) * k),
      ascender: Math.round(cislo(asc.value) * k), descender: Math.round(cislo(desc.value) * k), lineGap: Math.round(200 * k),
      vaha: /Bold/.test(sty.value) ? 700 : /Light/.test(sty.value) ? 300 : 400, sklon: /Italic/.test(sty.value) ? -12 : 0
    });
    if (sada.value !== 'nic') {
      const b = P.BLOKY.find(x => x.id === (sada.value === 'cesky' ? 'cesky' : 'zaklad'));
      let znaky = b.znaky.slice();
      if (sada.value === 'cesky') znaky = znaky.concat(P.BLOKY.find(x => x.id === 'zaklad').znaky);
      for (const c of Array.from(new Set(znaky))) if (c !== 0x20) P.glyfProZnak(f, c, true);
      if (sada.value === 'cesky') for (const n of ['acute', 'caron', 'ring']) if (!f.glyfy[n]) P.pridejGlyf(f, P.novyGlyf(n, P.unicodeZNazvu(n), Math.round(300 * k)));
    }
    A.otevriFont(f);
    A.prepniPohled('znaky');
    A.zprava('Nový font je připravený. Dvojklikem na buňku začněte kreslit.');
  };

  /* ---------- otevření souboru ---------- */
  D.otevriSoubor = async function () {
    const s = await D.soubor('.ttf,.otf,.woff,.json,.pismo,font/ttf,font/otf,font/woff,application/json');
    if (!s) { if (!A.font) D.start(); return; }
    try {
      const f = P.nactiFont(await nactiData(s));
      A.otevriFont(f);
      A.prepniPohled('znaky');
      A.zprava('Načteno: ' + f.info.rodina + ' ' + f.info.styl + ' (' + f.poradi.length + ' glyfů).');
    } catch (e) {
      A.zprava('Soubor se nepodařilo načíst: ' + e.message, true);
      if (!A.font) D.start();
    }
  };

  D.zKnihovny = async function () {
    if (typeof FONTY === 'undefined') { A.zprava('Knihovna písem webu není k dispozici.', true); return; }
    let seznam = [];
    try { seznam = (await FONTY.seznam()).filter(f => !f.pismo || f.pismo === 'latinka'); } catch (e) { /* nic */ }
    const mrizka = el('div', { class: 'knihovna-fontu' });
    let vybrano = null;
    for (const f of seznam) {
      const b = el('button', { type: 'button', title: f.nazev + (f.licence ? ' · ' + f.licence : ' · SIL OFL 1.1'), onclick: () => { vybrano = f.id; D._zavri('ok'); } }, [el('span', { class: 'uk', text: 'Aa Čř' }), el('small', { text: f.nazev })]);
      mrizka.append(b);
      FONTY.rodina(f.id).then(r => { b.firstChild.style.fontFamily = "'" + r + "'"; }).catch(() => { /* náhled není nutný */ });
    }
    const v = await D.okno({
      nadpis: '📚 Písmo z knihovny webu', sirka: 'min(820px, 96vw)', bezFokusu: true,
      telo: [el('p', { class: 'poznamka', style: 'margin-bottom:8px', text: 'Písma jsou pod licencí SIL OFL 1.1 – upravená verze se smí šířit, ale pod jiným názvem, pokud má originál „Reserved Font Name“. Proto se rodina po otevření přejmenuje.' }), mrizka],
      tlacitka: [{ text: 'Zrušit', hodnota: null }]
    });
    if (v !== 'ok' || !vybrano) { if (!A.font) D.start(); return; }
    try {
      const f = P.nactiFont(await FONTY.data(vybrano));
      f.info.rodina = f.info.rodina + ' Upraveno';
      A.otevriFont(f);
      A.prepniPohled('znaky');
      A.zprava('Otevřeno: ' + f.info.rodina + ' (' + f.poradi.length + ' glyfů).');
    } catch (e) { A.zprava('Písmo se nepodařilo načíst: ' + e.message, true); }
  };

  /* ---------- projekty ---------- */
  D.projekty = async function () {
    const seznam = await A.projekty();
    const obal = el('div', { class: 'projekty' });
    for (const p of seznam) {
      obal.append(el('div', { class: 'projekt' }, [
        el('div', { class: 'jm', onclick: () => otevriProjekt(p.id) }, [p.nazev + (p.id === A.projektId ? ' (otevřený)' : ''), el('small', { text: new Date(p.zmeneno).toLocaleString('cs-CZ') + (p.glyfu != null ? ' · ' + p.glyfu + ' glyfů' : '') })]),
        el('button', { type: 'button', class: 'tl', text: 'Otevřít', onclick: () => otevriProjekt(p.id) }),
        el('button', { type: 'button', class: 'tl', text: '🗑️', title: 'Smazat projekt z prohlížeče', disabled: p.id === A.projektId, onclick: async () => {
          if (!(await Dialog.potvrd('Smazat projekt „' + p.nazev + '“ z prohlížeče? Nejde to vrátit.'))) return;
          await A.smazProjekt(p.id); D._zavri(null); D.projekty();
        } })
      ]));
    }
    await D.okno({ nadpis: '🗂️ Projekty v prohlížeči', telo: [el('p', { class: 'poznamka', text: 'Projekty se ukládají automaticky do tohoto prohlížeče. Pro zálohu nebo přenos použijte Soubor → Uložit projekt (.pismo.json).' }), obal], bezFokusu: true });
  };

  /* ---------- informace o fontu ---------- */
  D.info = async function () {
    const i = A.font.info;
    const P_ = [
      ['rodina', 'Rodina písma', 'text'], ['styl', 'Řez (styl)', 'text'], ['verzeFontu', 'Verze', 'text'],
      ['designer', 'Autor / návrhář', 'text'], ['copyright', 'Copyright', 'text'], ['url', 'Web autora', 'text'],
      ['licence', 'Licence', 'textarea'], ['licenceUrl', 'Adresa licence', 'text'], ['popis', 'Popis', 'textarea'],
      ['-', 'Metriky'], ['upm', 'Jednotek na em', 'number', 'Změna přeškáluje všechny glyfy'],
      ['ascender', 'Ascender', 'number'], ['descender', 'Descender', 'number'], ['lineGap', 'Mezera řádků (line gap)', 'number'],
      ['xVyska', 'x-výška', 'number'], ['vyskaVerzalek', 'Výška verzálek', 'number'],
      ['sklon', 'Sklon kurzívy °', 'number', 'Jako post.italicAngle: záporná hodnota = sklon doprava (běžná kurzíva -10 až -14)'],
      ['podtrzeniPoz', 'Poloha podtržení', 'number'], ['podtrzeniTl', 'Tloušťka podtržení', 'number'],
      ['vaha', 'Váha (100–900)', 'number', '400 = Regular, 700 = Bold'], ['sirkaTrida', 'Šířka (1–9)', 'number', '5 = normální, 3 = zúžené, 7 = rozšířené']
    ];
    const vstupy = {};
    const telo = [];
    for (const [k, popis, typ, tip] of P_) {
      if (k === '-') { telo.push(el('h3', { text: popis, style: 'font-size:.85rem;color:var(--text-muted);margin:12px 0 6px' })); continue; }
      const v = typ === 'textarea' ? el('textarea', { rows: 2 }) : vstup(typ, i[k]);
      if (typ === 'textarea') v.value = i[k] || '';
      vstupy[k] = v; telo.push(pole(popis, v, tip));
    }
    const v = await D.okno({ nadpis: 'ℹ️ Informace o fontu', telo, tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Uložit', hodnota: true, hlavni: true }] });
    if (!v) return;
    const nove = {};
    for (const [k, , typ] of P_) { if (k === '-') continue; nove[k] = typ === 'number' ? cislo(vstupy[k].value) : vstupy[k].value; if (typ === 'number' && nove[k] == null) nove[k] = i[k]; }
    const stareUpm = i.upm;
    const prepocet = nove.upm !== stareUpm && nove.upm > 16;
    A.zmen('Informace o fontu', prepocet ? { cely: true } : { info: true }, () => {
      Object.assign(A.font.info, nove);
      if (prepocet) {
        const k = nove.upm / stareUpm;
        for (const kl of ['ascender', 'descender', 'lineGap', 'xVyska', 'vyskaVerzalek', 'podtrzeniPoz', 'podtrzeniTl']) A.font.info[kl] = Math.round(nove[kl] * k);
        for (const n of A.font.poradi) {
          const g = A.font.glyfy[n];
          for (const o of g.obrysy) for (const b of o.body) { b.x = Math.round(b.x * k); b.y = Math.round(b.y * k); }
          for (const c of g.komponenty || []) { c.m[4] = Math.round(c.m[4] * k); c.m[5] = Math.round(c.m[5] * k); }
          for (const a of g.kotvy || []) { a.x = Math.round(a.x * k); a.y = Math.round(a.y * k); }
          g.sirka = Math.round(g.sirka * k);
        }
        for (const l in A.font.kerning) for (const r in A.font.kerning[l]) A.font.kerning[l][r] = Math.round(A.font.kerning[l][r] * k);
      }
    });
    A.vyhlas('info');
  };

  /* ---------- export ---------- */
  D.export = async function (format) {
    const f = A.font, jm = A.nazevSouboru();
    try {
      if (format === 'ttf') { const d = P.exportTTF(f, {}); A.stahni(d, jm + '.ttf', 'font/ttf'); hlasVarovani(d); }
      else if (format === 'otf') A.stahni(P.exportOTF(f), jm + '.otf', 'font/otf');
      else if (format === 'woff') A.stahni(await P.exportWOFF(f, {}), jm + '.woff', 'font/woff');
      else if (format === 'svg') A.stahni(P.exportSVGFont(f), jm + '.svg', 'image/svg+xml');
      else if (format === 'projekt') A.stahni(P.ulozProjekt(f), jm + '.pismo.json', 'application/json');
      else if (format === 'css') return D.exportCss();
      else if (format === 'glyfsvg') {
        if (!A.aktualni) { A.zprava('Otevřete glyf v editoru.', true); return; }
        A.stahni(P.exportSVGGlyf(f, A.aktualni), A.aktualni + '.svg', 'image/svg+xml');
      }
      if (format !== 'ttf') A.zprava('Staženo.');
    } catch (e) { console.error(e); A.zprava('Export selhal: ' + e.message, true); }
  };
  function hlasVarovani(d) {
    const v = (d && d.varovani) || [];
    A.zprava(v.length ? 'Staženo s upozorněním: ' + v.join(' ') : 'Staženo.', v.length > 0);
  }
  D.exportCss = async function () {
    const f = A.font, jm = A.nazevSouboru();
    const woff = await P.exportWOFF(f, {});
    let bin = '';
    for (let i = 0; i < woff.length; i += 0x8000) bin += String.fromCharCode.apply(null, woff.subarray(i, i + 0x8000));
    const css = `/* ${f.info.rodina} ${f.info.styl} – vygenerováno Písmolijnou */\n@font-face {\n  font-family: '${f.info.rodina.replace(/'/g, '')}';\n  src: url(data:font/woff;base64,${btoa(bin)}) format('woff');\n  font-weight: ${f.info.vaha};\n  font-style: ${f.info.sklon ? 'italic' : 'normal'};\n  font-display: swap;\n}\n`;
    A.stahni(css, jm + '.css', 'text/css');
    A.zprava('Staženo CSS s vloženým písmem.');
  };
  /* Poslat do sdílených fontů webu (3D text, Převodník písma…) */
  D.doFontuWebu = async function () {
    if (typeof FONTY === 'undefined') { A.zprava('Knihovna fontů webu není načtená.', true); return; }
    try {
      const d = P.exportTTF(A.font, {});
      const soubor = new File([d], A.nazevSouboru() + '.ttf', { type: 'font/ttf' });
      await FONTY.pridej(soubor);
      A.zprava('Font je uložený mezi vlastními písmy webu – najdete ho ve 3D textu, Převodníku písma a dalších stránkách.');
    } catch (e) { A.zprava('Nepodařilo se uložit: ' + e.message, true); }
  };

  /* ---------- import do glyfu ---------- */
  D.svgDoGlyfu = async function () {
    if (!A.aktualni) { A.zprava('Nejdřív otevřete glyf (dvojklik v mřížce).', true); return; }
    const s = await D.soubor('.svg,image/svg+xml');
    if (!s) return;
    const text = await nactiText(s);
    const mer = vyber([['verzalky', 'na výšku verzálek'], ['em', 'viewBox = celý em (ascender až descender)'], ['puvodni', 'původní velikost (1 px = 1 jednotka)']], 'verzalky');
    const prid = vstup('checkbox', false);
    const v = await D.okno({ nadpis: '📥 SVG do glyfu ' + A.aktualni, telo: [pole('Měřítko', mer), pole('Přidat k současným obrysům', prid)], tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Vložit', hodnota: true, hlavni: true }] });
    if (!v) return;
    try {
      let r;
      A.zmen('SVG do glyfu', { glyfy: [A.aktualni] }, () => { r = P.svgDoGlyfu(text, A.font, A.font.glyfy[A.aktualni], { meritko: mer.value, pridat: prid.checked }); });
      if (r) A.zprava('Vloženo obrysů: ' + r.obrysu + '.');
    } catch (e) { A.zprava('SVG se nepodařilo převést: ' + e.message, true); }
  };
  D.obrazekPozadi = async function () {
    if (!A.aktualni) { A.zprava('Nejdřív otevřete glyf.', true); return; }
    const s = await D.soubor('image/*');
    if (!s) return;
    const data = await nactiDataUrl(s);
    const img = new Image();
    await new Promise(ok => { img.onload = ok; img.onerror = ok; img.src = data; });
    if (!img.naturalWidth) { A.zprava('Obrázek nejde načíst.', true); return; }
    const f = A.font;
    // výška obrázku = ascender − descender, levý dolní roh na descenderu
    const meritko = (f.info.ascender - f.info.descender) / img.naturalHeight;
    A.zmen('Obrázek do pozadí', { glyfy: [A.aktualni] }, () => {
      const g = A.font.glyfy[A.aktualni];
      g.pozadi = g.pozadi || {};
      g.pozadi.obrazek = { data, x: 0, y: f.info.descender, meritko: Math.round(meritko * 10000) / 10000, pruhlednost: 0.4 };
    });
    A.zprava('Obrázek je v pozadí. V panelu Pozadí ho posunete, zvětšíte nebo automaticky obtáhnete.');
  };
  D.referencePozadi = async function () {
    if (!A.aktualni) return;
    const v = vstup('text', '', { list: 'pg-glyfy', placeholder: 'název glyfu nebo znak' });
    const r = await D.okno({ nadpis: 'Glyf do pozadí', telo: [pole('Glyf tohoto fontu', v)], tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Z jiného fontu…', hodnota: 'soubor' }, { text: 'Vložit', hodnota: 'font', hlavni: true }] });
    if (!r) return;
    const f = A.font;
    let obrysy = null;
    if (r === 'font') {
      let n = v.value.trim();
      if (n && !f.glyfy[n] && Array.from(n).length === 1) n = P.cmap(f).get(n.codePointAt(0));
      if (!n || !f.glyfy[n]) { A.zprava('Glyf nenalezen.', true); return; }
      obrysy = P.plneObrysy(f, f.glyfy[n]);
    } else {
      const s = await D.soubor('.ttf,.otf,.woff');
      if (!s) return;
      try {
        const cizi = P.nactiFont(await nactiData(s));
        const g = A.font.glyfy[A.aktualni];
        const cp = (g.uni || [])[0];
        const n = cp != null ? P.cmap(cizi).get(cp) : (cizi.glyfy[g.nazev] ? g.nazev : null);
        if (!n) { A.zprava('V cizím fontu tento znak není.', true); return; }
        const k = f.info.upm / cizi.info.upm;
        obrysy = P.plneObrysy(cizi, cizi.glyfy[n], [k, 0, 0, k, 0, 0]);
      } catch (e) { A.zprava('Font nejde načíst: ' + e.message, true); return; }
    }
    A.zmen('Předloha v pozadí', { glyfy: [A.aktualni] }, () => { const g = A.font.glyfy[A.aktualni]; g.pozadi = g.pozadi || {}; g.pozadi.obrysy = obrysy; });
  };
  D.mezeryJako = async function () {
    if (!A.aktualni) return;
    const v = vstup('text', '', { list: 'pg-glyfy', placeholder: 'např. n nebo H' });
    const r = await D.okno({ nadpis: 'Postranní mezery podle jiného glyfu', telo: [pole('Vzor', v)], tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Použít', hodnota: true, hlavni: true }] });
    if (!r) return;
    const f = A.font;
    let n = v.value.trim();
    if (n && !f.glyfy[n] && Array.from(n).length === 1) n = P.cmap(f).get(n.codePointAt(0));
    if (!n || !f.glyfy[n]) { A.zprava('Glyf nenalezen.', true); return; }
    const vz = f.glyfy[n];
    const l = P.lsb(f, vz), rr = P.rsb(f, vz);
    A.zmen('Mezery jako ' + n, { glyfy: [A.aktualni] }, () => { const g = A.font.glyfy[A.aktualni]; P.nastavLsb(A.font, g, l); P.nastavRsb(A.font, g, rr); });
  };

  /* ---------- operace nad vybranými glyfy ---------- */
  /* Cílové glyfy: v editoru aktuální, v mřížce výběr (nic = dotaz na všechny). */
  async function cile(popis) {
    if (A.pohled === 'glyf' && A.aktualni) return [A.aktualni];
    const v = A.vybraneGlyfy();
    if (v.length) return v;
    if (await Dialog.potvrd('Nic není vybráno. Použít „' + popis + '“ na všechny glyfy fontu?')) return A.font.poradi.filter(n => n !== '.notdef');
    return null;
  }
  async function hromadne(popis, fn) {
    const jm = await cile(popis);
    if (!jm) return;
    let n = 0;
    A.zmen(popis, { glyfy: jm }, () => { for (const x of jm) { const g = A.font.glyfy[x]; if (g && fn(g) !== false) n++; } });
    A.zprava(popis + ': ' + n + ' glyfů.');
  }
  D.hromadne = hromadne;

  D.obtahni = async function () {
    const t = vstup('number', A.nastaveni.obtahT || 40), konce = vyber([['kulate', 'kulaté'], ['ploche', 'ploché'], ['ctverec', 'hranaté (přesah)']], A.nastaveni.obtahK || 'kulate'), spoje = vyber([['kulate', 'kulaté'], ['ostre', 'ostré'], ['zkosene', 'zkosené']], A.nastaveni.obtahS || 'kulate');
    const v = await D.okno({ nadpis: '〰️ Obtáhnout tahem', telo: [pole('Tloušťka', t), pole('Konce otevřených tahů', konce), pole('Spoje', spoje), el('p', { class: 'poznamka', text: 'Z čáry (i otevřené) udělá plochu dané tloušťky – tak vznikne monoline písmo z kostry tahů.' })], tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Obtáhnout', hodnota: true, hlavni: true }] });
    if (!v) return;
    A.nastaveni.obtahT = cislo(t.value); A.nastaveni.obtahK = konce.value; A.nastaveni.obtahS = spoje.value; A.ulozNastaveni();
    hromadne('Obtáhnout', g => { if (!g.obrysy.length) return false; P.obtahni(g, cislo(t.value) || 40, { konce: konce.value, spoje: spoje.value }); });
  };
  D.zesil = async function () {
    const o = vstup('number', A.nastaveni.zesilO || 20), vys = vstup('checkbox', A.nastaveni.zesilV !== false);
    const v = await D.okno({ nadpis: '🅱️ Změnit tloušťku tahů', telo: [pole('O kolik jednotek (záporné = zúžit)', o), pole('Zachovat výšku písma', vys, 'Po ztučnění se tvar svisle srovná zpět mezi účaří a původní výšku'), el('p', { class: 'poznamka', text: 'Šířka glyfu se zvětší o dvojnásobek, ať se písmena nedotýkají.' })], tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Použít', hodnota: true, hlavni: true }] });
    if (!v) return;
    A.nastaveni.zesilO = cislo(o.value); A.nastaveni.zesilV = vys.checked; A.ulozNastaveni();
    hromadne('Zesílit', g => { if (!g.obrysy.length) return false; P.zesil(g, cislo(o.value) || 0, { zachovatVysku: vys.checked }); });
  };
  D.kurziva = async function () {
    const u = vstup('number', 12), z = vstup('number', 3);
    const v = await D.okno({ nadpis: '𝘐 Kurzíva (skloněné písmo)', telo: [pole('Sklon ° (doprava)', u), pole('Zúžení %', z), el('p', { class: 'poznamka', text: 'Zkosí tvary kolem účaří. Pravou kurzívu s jinými tvary písmen (a, e, f) je potřeba dokreslit ručně. Sklon se zapíše do Informací o fontu.' })], tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Použít', hodnota: true, hlavni: true }] });
    if (!v) return;
    const uhel = cislo(u.value) || 0, zu = (cislo(z.value) || 0) / 100;
    await hromadne('Kurzíva', g => { P.kurziva(g, uhel, A.font.info, { zuzit: zu }); });
    A.zmen('Sklon kurzívy', { info: true }, () => { A.font.info.sklon = -uhel; });
  };
  D.transformaceFontu = async function () {
    const sx = vstup('number', 100), sy = vstup('number', 100), dx = vstup('number', 0), dy = vstup('number', 0), sk = vstup('number', 0), sir = vstup('checkbox', true);
    const v = await D.okno({ nadpis: '⤡ Transformovat glyfy', telo: [pole('Šířka %', sx), pole('Výška %', sy), pole('Posun x', dx), pole('Posun y', dy), pole('Zkosení °', sk), pole('Upravit šířku glyfu', sir, 'Šířka glyfu se přepočte stejným měřítkem')], tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Použít', hodnota: true, hlavni: true }] });
    if (!v) return;
    const a = (cislo(sx.value) || 100) / 100, d = (cislo(sy.value) || 100) / 100, t = Math.tan((cislo(sk.value) || 0) * Math.PI / 180);
    const m = [a, 0, t * d, d, cislo(dx.value) || 0, cislo(dy.value) || 0];
    hromadne('Transformace', g => {
      if (ma('transformujGlyf')) P.transformujGlyf(g, m, null);
      else for (const o of g.obrysy) for (const b of o.body) { const q = P.transformujBod(m, b.x, b.y); b.x = q.x; b.y = q.y; }
      for (const o of g.obrysy) P.zaokrouhli(o);
      if (sir.checked) g.sirka = Math.round(g.sirka * a);
    });
  };
  D.akcenty = async function () {
    if (!ma('sestavAkcenty')) { A.zprava('Modul operací není načtený.', true); return; }
    const gen = vstup('checkbox', true), prep = vstup('checkbox', false), mez = vstup('number', Math.round(A.font.info.upm * 0.08));
    const v = await D.okno({ nadpis: '🇨🇿 Sestavit písmena s diakritikou', telo: [
      el('p', { class: 'poznamka', style: 'margin-bottom:8px', text: 'Z nakreslených základních písmen a akcentů složí á č ď é ě í ň ó ř š ť ú ů ý ž (a další latinku) jako komponenty – když pak upravíte „a“ nebo čárku, změní se i „á“. Kotvy top/_top zpřesní polohu.' }),
      pole('Chybějící akcenty vygenerovat', gen, 'Jednoduché geometrické tvary čárky, háčku, kroužku… podle tloušťky tahů'),
      pole('Přepsat existující nakreslená písmena', prep, 'Jinak se doplní jen chybějící a prázdné glyfy'),
      pole('Mezera nad písmenem', mez)
    ], tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Sestavit', hodnota: true, hlavni: true }] });
    if (!v) return;
    let vytvoreno = [];
    A.zmen('Sestavit akcenty', { cely: true }, () => {
      if (gen.checked && ma('vychoziAkcenty')) P.vychoziAkcenty(A.font);
      let nazvy = null;
      if (!prep.checked) nazvy = Object.keys(P.SKLADBA || {}).filter(n => { const cp = P.unicodeZNazvu(n); const g = cp != null ? P.glyfProZnak(A.font, cp, false) : A.font.glyfy[n]; return !g || P.glyfJePrazdny(g) || (g.komponenty || []).length; });
      vytvoreno = P.sestavAkcenty(A.font, nazvy, { mezera: cislo(mez.value) }) || [];
    });
    A.zprava('Sestaveno: ' + vytvoreno.length + ' glyfů' + (vytvoreno.length ? ' (' + vytvoreno.slice(0, 12).join(', ') + (vytvoreno.length > 12 ? '…' : '') + ')' : ' – chybí základní písmena?'));
  };
  D.autoMezery = async function () {
    if (!ma('automatickeMezery')) { A.zprava('Modul operací není načtený.', true); return; }
    const jm = await cile('Automatické mezery');
    if (!jm) return;
    let r;
    A.zmen('Automatické mezery', { glyfy: jm }, () => { r = P.automatickeMezery(A.font, jm, {}); });
    A.zprava('Mezery nastaveny' + (typeof r === 'number' ? ' u ' + r + ' glyfů.' : '.'));
  };
  D.autoKerning = async function () {
    if (!ma('automatickyKerning')) { A.zprava('Modul operací není načtený.', true); return; }
    const vychozi = 'AÁBCČDĎEÉĚFGHIÍJKLMNŇOÓPQRŘSŠTŤUÚŮVWXYÝZŽ';
    const l = vstup('text', vychozi + 'aábcčdeéěfghkmnoóprřsštťuúůvwxyýzž.,'), r = vstup('text', vychozi + 'aáceéěoóqsšuúůvwxyýzž.,-'), prah = vstup('number', 10), sila = vstup('number', 100), smaz = vstup('checkbox', false);
    const v = await D.okno({ nadpis: '🤖 Automatický kerning', telo: [
      pole('Levé znaky', l), pole('Pravé znaky', r), pole('Ignorovat menší než', prah), pole('Síla %', sila, '100 % = srovnat optické mezery na úroveň „nn“/„HH“; méně = opatrnější'), pole('Smazat dosavadní kerning', smaz),
      el('p', { class: 'poznamka', text: 'Výpočet porovná obrysy sousedních písmen a dorovná nejmenší vzdálenost. Výsledek vždy zkontrolujte v okně Metriky.' })
    ], tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Spočítat', hodnota: true, hlavni: true }] });
    if (!v) return;
    const f = A.font, mapa = P.cmap(f);
    const naJm = s => Array.from(new Set(Array.from(s).map(c => mapa.get(c.codePointAt(0))).filter(n => n && !P.glyfJePrazdny(f.glyfy[n]))));
    let n = 0;
    A.zmen('Automatický kerning', { kerning: true }, () => {
      if (smaz.checked) A.font.kerning = {};
      n = P.automatickyKerning(A.font, naJm(l.value), naJm(r.value), { prah: cislo(prah.value) || 10, sila: (cislo(sila.value) || 100) / 100 });
    });
    A.zprava('Vytvořeno párů: ' + n + '.');
  };
  D.kapitalky = async function () {
    if (!ma('kapitalky')) { A.zprava('Modul operací není načtený.', true); return; }
    let r;
    A.zmen('Kapitálky', { cely: true }, () => { r = P.kapitalky(A.font, {}); });
    A.zprava('Vytvořeny kapitálky: ' + ((r && r.length) || r || 0) + ' (glyfy *.sc).');
  };
  D.interpolace = async function () {
    if (!ma('interpoluj')) { A.zprava('Modul operací není načtený.', true); return; }
    const s = await D.soubor('.ttf,.otf,.woff,.json');
    if (!s) return;
    let druhy;
    try { druhy = P.nactiFont(await nactiData(s)); } catch (e) { A.zprava('Font nejde načíst: ' + e.message, true); return; }
    const t = vstup('number', 50);
    const v = await D.okno({ nadpis: '🔀 Interpolace řezů', telo: [
      el('p', { class: 'poznamka', style: 'margin-bottom:8px', text: 'Mezistupeň mezi otevřeným fontem (0 %) a „' + druhy.info.rodina + ' ' + druhy.info.styl + '“ (100 %). Interpolovat jde jen glyfy se stejnou stavbou (počet obrysů a bodů) – tedy hlavně řezy jedné rodiny. Hodnoty mimo 0–100 % extrapolují.' }),
      pole('Poloha %', t)
    ], tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Vytvořit nový font', hodnota: true, hlavni: true }] });
    if (!v) return;
    try {
      const r = P.interpoluj(A.font, druhy, (cislo(t.value) || 0) / 100, {});
      const novy = r.font || r;
      A.otevriFont(novy);
      A.zprava('Vznikl nový font' + (r.preskoceno && r.preskoceno.length ? ' – nekompatibilních glyfů přeskočeno: ' + r.preskoceno.length : '') + '.');
    } catch (e) { A.zprava('Interpolace selhala: ' + e.message, true); }
  };

  /* ---------- rukopisné písmo ---------- */
  D.rukopis = async function () {
    if (!ma('sablonaRucnihoPisma')) { A.zprava('Modul obtahování není načtený.', true); return; }
    const znaky = vstup('text', 'AÁBCČDĎEÉĚFGHIÍJKLMNŇOÓPQRŘSŠTŤUÚŮVWXYÝZŽaábcčdďeéěfghiíjklmnňoópqrřsštťuúůvwxyýzž0123456789.,!?-');
    const v = await D.okno({ nadpis: '✍️ Vlastní rukopisné písmo', telo: [
      el('ol', { class: 'napoveda-obsah', style: 'padding-left:20px;margin-bottom:10px' }, [
        el('li', { text: 'Stáhněte a vytiskněte šablonu (A4, bez zmenšení – „skutečná velikost“).' }),
        el('li', { text: 'Do každého políčka napište fixem znak z rohu – na účaří, verzálky po horní linku.' }),
        el('li', { text: 'Naskenujte nebo vyfoťte rovně celou stránku i s černými čtverečky v rozích.' }),
        el('li', { text: 'Načtěte sken – Písmolijna stránku srovná, políčka rozřeže a písmena obtáhne.' })
      ]),
      pole('Znaky v šabloně', znaky)
    ], tlacitka: [{ text: 'Zavřít', hodnota: null }, { text: '⬇️ Stáhnout šablonu (SVG)', hodnota: 'sablona' }, { text: '📷 Načíst sken…', hodnota: 'sken', hlavni: true }] });
    if (v === 'sablona') {
      const r = P.sablonaRucnihoPisma(Array.from(znaky.value), {});
      A.stahni(r.svg, 'sablona-pisma.svg', 'image/svg+xml');
      A.nastaveni.rukopisZnaky = znaky.value; A.ulozNastaveni();
      A.zprava('Šablona stažena – otevřete ji v prohlížeči a vytiskněte ve skutečné velikosti.');
      return D.rukopis();
    }
    if (v === 'sken') return nactiSken(Array.from(znaky.value));
    if (!A.font) D.start();
  };
  async function nactiSken(znaky) {
    const s = await D.soubor('image/*');
    if (!s) return;
    const url = await nactiDataUrl(s);
    const img = new Image();
    await new Promise(ok => { img.onload = ok; img.onerror = ok; img.src = url; });
    if (!img.naturalWidth) { A.zprava('Obrázek nejde načíst.', true); return; }
    const z = Math.min(1, 3000 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * z), h = Math.round(img.naturalHeight * z);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h);
    const data = cx.getImageData(0, 0, w, h).data;
    const sab = P.sablonaRucnihoPisma(znaky, {});
    let bunky;
    try { bunky = P.rozrezSken(data, w, h, sab.rozlozeni, {}); }
    catch (e) { A.zprava('Sken se nepodařilo zpracovat: ' + e.message + ' (jsou vidět všechny 4 černé čtverečky?)', true); return; }
    if (!A.font) A.otevriFont(P.novyFont({ rodina: 'Můj rukopis' }));
    const f = A.font, upm = f.info.upm;
    let hotovo = 0;
    A.zmen('Rukopis ze skenu', { cely: true }, () => {
      for (const b of bunky) {
        const cp = b.znak.codePointAt(0);
        const g = P.glyfProZnak(A.font, cp, true);
        // měřítko: x-výška ve výřezu → x-výška fontu
        const xv = b.xVyska != null && b.ucari != null ? Math.abs(b.ucari - b.xVyska) : b.vyska * 0.3;
        const m = f.info.xVyska / (xv || 1);
        const ucari = b.ucari != null ? b.ucari : b.vyska * 0.7;
        const obrysy = P.obtahniBitmapu(b.data, b.sirka, b.vyska, { matice: [m, 0, 0, -m, 0, ucari * m], chyba: 1.2, minPlocha: 20 });
        if (!obrysy || !obrysy.length) continue;
        g.obrysy = obrysy; for (const o of g.obrysy) P.zaokrouhli(o);
        const ob = P.obalkaObrysu(g.obrysy);
        const mez = Math.round(upm * 0.05);
        P.posunGlyf(g, mez - ob.x0, 0);
        g.sirka = Math.round(ob.x1 - ob.x0 + 2 * mez);
        hotovo++;
      }
    });
    A.prepniPohled('znaky');
    A.zprava('Ze skenu vzniklo ' + hotovo + ' glyfů z ' + bunky.length + ' políček.');
  }

  /* ---------- nápověda ---------- */
  D.napoveda = function () {
    const r = (k, t) => el('tr', {}, [el('td', {}, el('kbd', { text: k })), el('td', { text: t })]);
    D.okno({
      nadpis: '❓ Nápověda', sirka: 'min(760px, 96vw)', bezFokusu: true,
      telo: [el('div', { class: 'napoveda-obsah' }, [
        el('h3', { text: 'Jak na to' }),
        el('ul', {}, [
          el('li', { text: 'Znaky: mřížka všech pozic. Dvojklik (nebo Enter) otevře glyf v editoru, prázdná pozice se tím založí. Napsáním znaku na klávesnici na něj skočíte.' }),
          el('li', { text: 'Glyf: kreslete perem (klik = rohový bod, tažení = hladký s úchyty), obdélníkem, elipsou, tužkou nebo štětcem. Nástrojem Výběr táhněte body, úchyty, celé křivky i šířku (svislá modrá čára).' }),
          el('li', { text: 'Obrysy plní pravidlo nenulového vinutí: vnější obrys jde po směru hodinových ručiček, díra (vnitřek „o“) proti. Tlačítko „Opravit směr“ to srovná za vás; zelená šipka ukazuje směr.' }),
          el('li', { text: 'Metriky a kerning: napište text, klikněte na písmeno a táhněte ho – mění se mezera s levým sousedem. Skupiny kerningu nastaví víc párů naráz.' }),
          el('li', { text: 'Náhled vykresluje skutečně vygenerovaný font prohlížečem – tak, jak ho uvidí ostatní.' }),
          el('li', { text: 'Kontrola najde otevřené obrysy, špatné směry, chybějící extrémy, překryvy, chybějící česká písmena a další problémy; většinu opraví jedním klikem.' }),
          el('li', { text: 'Projekt se průběžně ukládá v prohlížeči. Zálohu stáhnete jako .pismo.json, hotový font jako TTF/OTF/WOFF.' }),
          el('li', { text: 'Symetrie (panel vpravo v editoru): nakreslete jen polovinu písmene – druhá se doplní zrcadlením podle svislé, vodorovné nebo obou os. „Zapéct“ z ní udělá skutečné obrysy.' }),
          el('li', { text: 'Generátor: vyberte styl (strašidelné, metalové, Diablo, neon, pixel…), sílu a variantu – z volného písma vznikne nový font, který jde dál upravovat.' }),
          el('li', { text: 'Režim Jednoduchý ukazuje jen základní nástroje; Pokročilý (přepínač v liště) přidá kerning, kontrolu chyb, komponenty, kotvy, transformace a další formáty.' })
        ]),
        el('h3', { text: 'Klávesové zkratky' }),
        el('table', {}, [
          r('V P R E N B', 'výběr, pero, obdélník, elipsa, tužka, štětec'), r('K M A H', 'nůž, měřítko, kotva, ruka'),
          r('mezerník + tažení', 'posun pohledu'), r('kolečko / Ctrl+kolečko', 'lupa'), r('Ctrl+0', 'celý glyf'),
          r('šipky (Shift)', 'posun výběru o 1 (10)'), r('Delete', 'smazat body (tvar se zachová)'),
          r('Tab', 'další bod'), r('Page Up / Page Down', 'předchozí / další glyf'), r('F', 'plná výplň'), r('G', 'mřížka'),
          r('Ctrl+Z / Ctrl+Y', 'zpět / znovu'), r('Ctrl+C / X / V / D', 'kopírovat / vyjmout / vložit / duplikovat'),
          r('Ctrl+S', 'stáhnout projekt'), r('Ctrl+E', 'stáhnout TTF')
        ]),
        el('h3', { text: 'Licence a soukromí' }),
        el('p', { text: 'Písmolijna je samostatná aplikace inspirovaná funkcemi FontForge (nepřebírá jeho kód). Používá opentype.js (MIT) a Clipper (Boost). Fonty, které vytvoříte, jsou vaše – doporučená licence pro sdílení je SIL Open Font License. Nic se neodesílá na server.' })
      ])]
    });
  };
})();
