/* ============================================================
   cvGen/jadro.js – jádro stránky Životopis (bez DOM, testuje se v node).

   Model (stav) = tvar, který stránka dřív ukládala pod klíčem
   cvBuilderData, rozšířený o nové sekce. Fotky v něm nejsou, ty
   drží stránka zvlášť (IndexedDB) a do vykreslení se předávají.

     CVJ.vychozi()            → ukázkový životopis
     CVJ.normalizuj(d)        → doplní chybějící pole, opraví rozložení
     CVJ.doJSON(stav, fotky)  → objekt pro export (pole verze 4 + celý stav)
     CVJ.zJSON(obj)           → { stav, fotky } z exportu v4/v5 i starého úložiště
     CVJ.vykresli(stav, foto) → HTML listu A4 (třídy z CVJ.CSS)
     CVJ.md(text)             → bezpečný markdown (** tučně, * kurzíva, odrážky)
   ============================================================ */
(function (g) {
  'use strict';

  const SEKCE = {
    contact: 'Kontakt',
    links: 'Odkazy',
    skills: 'Dovednosti',
    languages: 'Jazyky',
    interests: 'Zájmy',
    profile: 'Profil',
    experience: 'Pracovní zkušenosti',
    education: 'Vzdělání',
    certificates: 'Certifikáty a kurzy',
    projects: 'Projekty',
    references: 'Reference',
    custom: 'Vlastní sekce'
  };
  const ROZLOZENI = {
    sidebar: ['contact', 'links', 'skills', 'languages', 'interests'],
    main: ['profile', 'experience', 'education', 'certificates', 'projects', 'references', 'custom'],
    hidden: []
  };
  const GDPR_TEXT = 'Souhlasím se zpracováním osobních údajů uvedených v tomto životopisu pro účely výběrového řízení.';
  // texty listu podle jazyka životopisu (editor zůstává česky)
  const JAZYKY = {
    cs: { nazev: 'Čeština', sekce: SEKCE, tel: 'Tel.', email: 'E-mail', adresa: 'Adresa', narozeni: 'Rok narození', ridicak: 'Řidičský průkaz',
      z: 'z', pozdrav: 'S pozdravem', kontakt: 'Kontakt', vec: 'Ve věci: ', gdpr: GDPR_TEXT, misto: (m, d) => [m && 'V ' + m, d && 'dne ' + d].filter(Boolean).join(' ') },
    en: { nazev: 'English', sekce: { contact: 'Contact', links: 'Links', skills: 'Skills', languages: 'Languages', interests: 'Interests',
      profile: 'Profile', experience: 'Work experience', education: 'Education', certificates: 'Certificates & courses', projects: 'Projects',
      references: 'References', custom: 'Other' }, tel: 'Phone', email: 'Email', adresa: 'Address', narozeni: 'Year of birth',
      ridicak: 'Driving licence', z: 'of', pozdrav: 'Kind regards', kontakt: 'Contact', vec: 'Re: ',
      gdpr: 'I hereby consent to the processing of the personal data contained in this CV for the purposes of the recruitment process.',
      misto: (m, d) => [m, d].filter(Boolean).join(', ') },
    sk: { nazev: 'Slovenčina', sekce: { contact: 'Kontakt', links: 'Odkazy', skills: 'Zručnosti', languages: 'Jazyky', interests: 'Záujmy',
      profile: 'Profil', experience: 'Pracovné skúsenosti', education: 'Vzdelanie', certificates: 'Certifikáty a kurzy', projects: 'Projekty',
      references: 'Referencie', custom: 'Ďalšie' }, tel: 'Tel.', email: 'E-mail', adresa: 'Adresa', narozeni: 'Rok narodenia',
      ridicak: 'Vodičský preukaz', z: 'z', pozdrav: 'S pozdravom', kontakt: 'Kontakt', vec: 'Vo veci: ',
      gdpr: 'Súhlasím so spracovaním osobných údajov uvedených v tomto životopise na účely výberového konania.',
      misto: (m, d) => [m && 'V ' + m, d && 'dňa ' + d].filter(Boolean).join(' ') },
    de: { nazev: 'Deutsch', sekce: { contact: 'Kontakt', links: 'Links', skills: 'Kenntnisse', languages: 'Sprachen', interests: 'Interessen',
      profile: 'Profil', experience: 'Berufserfahrung', education: 'Ausbildung', certificates: 'Zertifikate & Kurse', projects: 'Projekte',
      references: 'Referenzen', custom: 'Sonstiges' }, tel: 'Tel.', email: 'E-Mail', adresa: 'Adresse', narozeni: 'Geburtsjahr',
      ridicak: 'Führerschein', z: 'von', pozdrav: 'Mit freundlichen Grüßen', kontakt: 'Kontakt', vec: 'Betreff: ',
      gdpr: 'Ich willige in die Verarbeitung meiner in diesem Lebenslauf enthaltenen personenbezogenen Daten für Zwecke des Bewerbungsverfahrens ein.',
      misto: (m, d) => [m, d].filter(Boolean).join(', ') }
  };
  // kostra průvodního dopisu; „…“ = doplní uživatel, ostatní se vezme z životopisu
  const KOSTRY = {
    cs: d => `Vážená paní / Vážený pane,\n\nna … jsem objevil(a) vaši nabídku na pozici ${d.pozice}. Rád(a) bych se k vám přidal(a), protože … (co vás na firmě láká).\n\n` +
      `${d.posledni ? `V současnosti pracuji jako ${d.posledni}. ` : ''}${d.dovednosti ? `Mezi mé silné stránky patří ${d.dovednosti}. ` : ''}Na svém posledním místě se mi podařilo … (konkrétní výsledek, ideálně s číslem).\n\n` +
      `Ve vaší firmě bych mohl(a) přispět … (čím konkrétně pomůžete).\n\nRád(a) se s vámi setkám osobně. Děkuji za váš čas.`,
    sk: d => `Vážená pani / Vážený pán,\n\nna … som objavil(a) vašu ponuku na pozíciu ${d.pozice}. Rád(a) by som sa k vám pridal(a), pretože … (čo vás na firme láka).\n\n` +
      `${d.posledni ? `V súčasnosti pracujem ako ${d.posledni}. ` : ''}${d.dovednosti ? `Medzi moje silné stránky patrí ${d.dovednosti}. ` : ''}Na poslednom mieste sa mi podarilo … (konkrétny výsledok, ideálne s číslom).\n\n` +
      `Vo vašej firme by som mohol(a) prispieť … (čím konkrétne pomôžete).\n\nRád(a) sa s vami stretnem osobne. Ďakujem za váš čas.`,
    en: d => `Dear Hiring Manager,\n\nI am writing to apply for the ${d.pozice} position advertised on … . I would love to join your team because … (what attracts you to the company).\n\n` +
      `${d.posledni ? `I currently work as ${d.posledni}. ` : ''}${d.dovednosti ? `My key strengths include ${d.dovednosti}. ` : ''}In my current role I … (a concrete result, ideally with a number).\n\n` +
      `At your company I could contribute … (how exactly you would help).\n\nI would welcome the opportunity to discuss my application in person. Thank you for your time.`,
    de: d => `Sehr geehrte Damen und Herren,\n\nmit großem Interesse habe ich Ihre Stellenanzeige für die Position ${d.pozice} auf … gelesen. Ich möchte Ihr Team verstärken, weil … (was Sie an der Firma reizt).\n\n` +
      `${d.posledni ? `Derzeit arbeite ich als ${d.posledni}. ` : ''}${d.dovednosti ? `Zu meinen Stärken gehören ${d.dovednosti}. ` : ''}In meiner jetzigen Position ist es mir gelungen, … (ein konkretes Ergebnis, idealerweise mit Zahl).\n\n` +
      `In Ihrem Unternehmen könnte ich … beitragen.\n\nÜber eine Einladung zu einem persönlichen Gespräch freue ich mich. Vielen Dank für Ihre Zeit.`
  };
  function kostraDopisu(s) {
    const e = s.experience.find(x => x.role.trim()), spoj = { cs: ' ve firmě ', sk: ' vo firme ', en: ' at ', de: ' bei ' }[s.settings.lang];
    const a = { cs: ' a ', sk: ' a ', en: ' and ', de: ' und ' }[s.settings.lang];
    const dov = s.skills.map(x => x.name.trim()).filter(Boolean).slice(0, 3);
    return KOSTRY[s.settings.lang]({
      pozice: s.title.trim() || '…',
      posledni: e ? e.role.trim() + (e.company.trim() ? spoj + e.company.trim() : '') : '',
      dovednosti: dov.length > 1 ? dov.slice(0, -1).join(', ') + a + dov[dov.length - 1] : dov[0] || ''
    });
  }
  const NASTAVENI = {
    template: 'panel', theme: 'pulnoc', primary: '#0f172a', accent: '#ea580c',
    text: '#334155', muted: '#64748b', line: '#e2e8f0', paper: 'bila', font: 'sans',
    sidebarW: 75, fontSize: 13, nameFontSize: 42, titleFontSize: 16, expFontSize: 11,
    skillStyle: 'tecky', icons: true, linkUrl: false, lang: 'cs', photoShape: 'kruh', qr: 'ne', qrLink: 0,
    qrText: '', qrLabel: '', qrPlace: 'auto', qrSize: 'M', qrLinks: false, qrLetter: true
  };
  const QR_TYPY = { ne: 'Žádný', odkaz: 'Odkaz (LinkedIn, portfolio…)', vcard: 'Kontakt do telefonu (vCard)', email: 'Napsat e-mail',
    telefon: 'Zavolat', whatsapp: 'Napsat na WhatsApp', vlastni: 'Vlastní text nebo adresa' };
  const QR_MISTA = { auto: 'Automaticky', zahlavi: 'V záhlaví', bok: 'V bočním sloupci', pata: 'Dole na listu' };
  const QR_VELIKOSTI = { S: 17, M: 22, L: 30 };   // mm včetně rámečku 2 × 1 mm
  // vizitka: co na ní je (výchozí bez odkazu – ten si uživatel vybere), web = index odkazu, −1 = žádný
  const VIZITKA = { title: true, phone: true, email: true, web: -1, address: false, photo: false, extra: '',
    qr: 'vcard', qrLink: 0, qrText: '', layout: 'qr', back: 'ne', marks: true };
  const VIZITKA_ROZVRZENI = { qr: 'QR vpravo', pas: 'Pruh nahoře', tmava: 'Tmavá', stred: 'Na střed' };
  const QR_MALY = 15, QR_MIN_MODUL = 0.38;          // řada u odkazů: 15 mm s rámečkem 2 × 0,6 mm
  const TVARY_FOTKY = { kruh: 'Kruh', zaobleny: 'Zaoblený čtverec', ctverec: 'Čtverec', skryt: 'Nezobrazovat' };
  const BARVY = ['primary', 'accent', 'text', 'muted', 'line'];
  const ROZSAHY = { qrLink: [0, 99], sidebarW: [55, 100], fontSize: [10, 16], nameFontSize: [24, 60], titleFontSize: [10, 28], expFontSize: [8, 14] };
  // barevná témata: hlavní, akcent (≥ 3:1 na bílé), text, popisky, linky
  const TEMATA = [
    ['pulnoc', 'Půlnoc a oranž', '#0f172a', '#ea580c', '#334155', '#64748b', '#e2e8f0'],
    ['namorni', 'Námořní', '#1e3a5f', '#0284c7', '#1e293b', '#5b6b7f', '#dbe4ee'],
    ['les', 'Les', '#1c3d2e', '#4d7c0f', '#1f2a24', '#5f6b62', '#e1e7e2'],
    ['petrolej', 'Petrolej', '#134e4a', '#0d9488', '#1f2f2e', '#5b6e6c', '#d9e6e4'],
    ['mentol', 'Mentol', '#064e3b', '#059669', '#1f2d29', '#5d6f68', '#dcebe5'],
    ['svestka', 'Švestka', '#3b0764', '#c026d3', '#2e1f3a', '#6b5b78', '#ebe1f0'],
    ['levandule', 'Levandule', '#4c1d95', '#7c3aed', '#2b2340', '#686080', '#e6e1f3'],
    ['bordo', 'Bordó a zlato', '#5f1a26', '#b7791f', '#3a2a2c', '#7a6366', '#efe3e0'],
    ['koral', 'Grafit a korál', '#1f2937', '#e11d48', '#2d3440', '#6b7280', '#e5e7eb'],
    ['grafit', 'Grafit a zlato', '#27272a', '#a16207', '#303033', '#6e6e73', '#e7e5e4'],
    ['piskovec', 'Pískovec', '#44403c', '#c2410c', '#3a3532', '#78716c', '#e9e4df'],
    ['kava', 'Káva', '#3f2a1d', '#a16207', '#3b2f28', '#7a6a5e', '#ece4dc'],
    ['ocel', 'Ocel a indigo', '#1e293b', '#4f46e5', '#273244', '#64748b', '#e2e8f0'],
    ['mono', 'Černobílá', '#111111', '#4b5563', '#222222', '#6b7280', '#e5e7eb'],
    ['vino', 'Víno a růže', '#4a0e1f', '#be185d', '#3a2a30', '#7a6068', '#f0e1e6'],
    ['olivy', 'Olivy', '#3f4a1f', '#6b7a12', '#2f3322', '#6b7055', '#e8eadb'],
    ['ocean', 'Oceán', '#0c4a6e', '#0e7490', '#1e3340', '#5a7383', '#d8e7ee'],
    ['kralovska', 'Královská modř a zlato', '#1e3a8a', '#b45309', '#1f2a44', '#5f6b85', '#e0e6f2'],
    ['terakota', 'Terakota a tyrkys', '#7c2d12', '#0f766e', '#3b2a22', '#7a655a', '#f0e2da'],
    ['salvej', 'Šalvěj', '#3f5a4c', '#4f7a5a', '#2c3a33', '#6b7a72', '#e3ebe5'],
    ['pudr', 'Pudrová', '#5b3a4a', '#b8476f', '#3d2c35', '#7d6570', '#f2e4ea'],
    ['nocni', 'Noční modř a tyrkys', '#0b1d3a', '#0d8a8a', '#1f2b3d', '#5d6b80', '#dde4ee'],
    ['cihla', 'Cihla', '#7f1d1d', '#b45309', '#3b2424', '#7a5f5f', '#f0e0dc'],
    ['jantar', 'Jantar', '#422006', '#b45309', '#3a2c1c', '#7c6a55', '#f1e7d8'],
    ['tyrkys', 'Tyrkys a grafit', '#283039', '#0f8a7a', '#2a3138', '#687480', '#e3e8ec'],
    ['purpur', 'Purpur a zlato', '#3b0d4f', '#b7791f', '#30203a', '#715f7a', '#ece2f0'],
    ['lahev', 'Lahvová zeleň a měď', '#0f3d2e', '#b45309', '#20302a', '#5e6f68', '#dde8e2'],
    ['ruze', 'Prachová růže', '#4a3b40', '#b05468', '#3a3034', '#776a6e', '#efe5e8']
  ].map(([id, nazev, primary, accent, text, muted, line]) => ({ id, nazev, primary, accent, text, muted, line }));
  // typ: panel = barevný sloupec přes celou výšku, jeden = sekce pod sebou, dva = záhlaví + dva sloupce
  const SABLONY = {
    panel: { nazev: 'Panel vlevo', typ: 'panel' },
    vpravo: { nazev: 'Panel vpravo', typ: 'panel' },
    klasik: { nazev: 'Klasická', typ: 'jeden' },
    minimal: { nazev: 'Minimalistická', typ: 'jeden' },
    kompakt: { nazev: 'Kompaktní', typ: 'dva' },
    moderni: { nazev: 'Moderní', typ: 'dva' },
    osa: { nazev: 'Časová osa', typ: 'jeden' },
    pruh: { nazev: 'Barevný pruh', typ: 'jeden' },
    elegant: { nazev: 'Elegantní', typ: 'jeden' },
    karty: { nazev: 'Karty', typ: 'dva' },
    zahlavi: { nazev: 'Záhlaví a panel', typ: 'dva' }
  };
  const TMAVY_BOK = ['panel', 'vpravo', 'zahlavi'];
  const PAPIRY = { bila: 'Bílý', kremova: 'Krémový', seda: 'Šedavý', odstin: 'Nádech barvy',
    tecky: 'Tečky', linky: 'Linky', mrizka: 'Mřížka', prechod: 'Jemný přechod' };
  const FONTY = {
    sans: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif"
  };
  // pole položek seznamů: co se normalizuje a ukládá
  const POLOZKY = {
    links: ['platform', 'url'],
    skills: ['name', 'level'],
    languages: ['name', 'level'],
    experience: ['date', 'role', 'company', 'desc'],
    education: ['date', 'degree', 'school', 'desc'],
    certificates: ['date', 'name', 'issuer'],
    projects: ['name', 'url', 'desc'],
    references: ['name', 'relation', 'contact']
  };
  const TEXTY = ['name', 'titlePrefix', 'title', 'email', 'phone', 'address', 'birthDate', 'license', 'interests', 'bio'];

  function vychozi() {
    return normalizuj({
      name: 'Jan Novák', title: 'Senior Project Manager',
      phone: '+420 777 666 555', email: 'jan.novak@example.cz',
      bio: 'Motivovaný **profesionál** s prokazatelnou historií v řízení komplexních projektů.',
      links: [{ platform: 'LinkedIn', url: 'linkedin.com/in/jnovak' }, { platform: 'GitHub', url: 'github.com/jnovak' }],
      skills: [{ name: 'Strategické plánování', level: 90 }, { name: 'Krizový management', level: 80 }],
      languages: [{ name: 'Čeština', level: 'rodilý mluvčí' }, { name: 'Angličtina', level: 'B2' }],
      experience: [{ date: '2020 — dnes', role: 'Global Manager', company: 'Super Tech s.r.o.',
        desc: 'Vedení týmů v **5 zemích**.\n\n* Zvýšení obratu o **20 %**\n* Zavedení agilního řízení' }],
      education: [{ date: '2015 — 2017', degree: 'Ing. Management', school: 'Vysoká škola ekonomická', desc: '' }]
    });
  }

  const txt = v => (v === undefined || v === null) ? '' : String(v);

  function normalizujRozlozeni(l) {
    const vysl = { sidebar: [], main: [], hidden: [] }, videno = new Set();
    if (l && typeof l === 'object') {
      for (const k of ['sidebar', 'main', 'hidden']) {
        for (const id of Array.isArray(l[k]) ? l[k] : []) {
          if (SEKCE[id] && !videno.has(id)) { videno.add(id); vysl[k].push(id); }
        }
      }
    }
    // chybějící sekce (nové, nebo poškozené rozložení) na výchozí místo
    for (const k of ['sidebar', 'main']) {
      for (const id of ROZLOZENI[k]) if (!videno.has(id)) { videno.add(id); vysl[k].push(id); }
    }
    return vysl;
  }

  function normalizuj(d) {
    d = d && typeof d === 'object' ? d : {};
    const s = {};
    for (const k of TEXTY) s[k] = txt(d[k]);
    for (const [k, pole] of Object.entries(POLOZKY)) {
      s[k] = (Array.isArray(d[k]) ? d[k] : []).filter(x => x && typeof x === 'object').map(x => {
        const o = {};
        for (const p of pole) o[p] = txt(x[p]);
        return o;
      });
    }
    for (const x of s.skills) {
      const n = parseInt(x.level, 10);
      x.level = isNaN(n) ? 50 : Math.max(0, Math.min(100, n));
    }
    const c = d.custom || {}, gd = d.gdpr || {};
    s.custom = { heading: txt(c.heading), text: txt(c.text) };
    s.gdpr = { show: !!gd.show, text: gd.text === undefined ? GDPR_TEXT : txt(gd.text), place: txt(gd.place), date: txt(gd.date) };
    s.sectionLayout = normalizujRozlozeni(d.sectionLayout);
    s.headings = {};
    for (const id of Object.keys(SEKCE)) if (d.headings && txt(d.headings[id]).trim()) s.headings[id] = txt(d.headings[id]).trim();
    const st = d.settings || {};
    s.settings = {};
    for (const [k, v] of Object.entries(NASTAVENI)) {
      const x = st[k];
      if (typeof v === 'number') { const n = parseFloat(x); s.settings[k] = isNaN(n) ? v : Math.max(ROZSAHY[k][0], Math.min(ROZSAHY[k][1], n)); }
      else if (typeof v === 'boolean') s.settings[k] = x === undefined ? v : !!x;
      else s.settings[k] = x ? String(x) : v;
    }
    for (const b of BARVY) if (!/^#[0-9a-f]{6}$/i.test(s.settings[b])) s.settings[b] = NASTAVENI[b];
    // starší data bez tématu: téma podle barev, jinak vlastní
    if (!st.theme) {
      const t = TEMATA.find(x => x.primary === s.settings.primary && x.accent === s.settings.accent);
      s.settings.theme = t ? t.id : 'vlastni';
    }
    if (!SABLONY[s.settings.template]) s.settings.template = 'panel';
    if (!PAPIRY[s.settings.paper]) s.settings.paper = 'bila';
    if (!['tecky', 'pruh', 'procenta', 'text'].includes(s.settings.skillStyle)) s.settings.skillStyle = 'tecky';
    if (!FONTY[s.settings.font]) s.settings.font = 'sans';
    if (!JAZYKY[s.settings.lang]) s.settings.lang = 'cs';
    if (!TVARY_FOTKY[s.settings.photoShape]) s.settings.photoShape = 'kruh';
    if (!QR_TYPY[s.settings.qr]) s.settings.qr = 'ne';
    if (!QR_MISTA[s.settings.qrPlace]) s.settings.qrPlace = 'auto';
    if (!QR_VELIKOSTI[s.settings.qrSize]) s.settings.qrSize = 'M';
    s.settings.qrText = s.settings.qrText.slice(0, 600);
    s.settings.qrLabel = s.settings.qrLabel.slice(0, 60);
    s.settings.qrLink = Math.round(s.settings.qrLink);
    const dp = d.letter || {};
    s.letter = {};
    for (const k of ['recipient', 'place', 'date', 'subject', 'body', 'closing']) s.letter[k] = txt(dp[k]);
    const dv = d.card || {};
    s.card = {};
    for (const [k, v] of Object.entries(VIZITKA)) {
      const x = dv[k];
      s.card[k] = typeof v === 'boolean' ? (x === undefined ? v : !!x) : typeof v === 'number' ? (Number.isFinite(+x) && x !== '' && x !== null ? Math.round(+x) : v) : txt(x === undefined ? v : x);
    }
    if (!QR_TYPY[s.card.qr]) s.card.qr = 'vcard';
    if (!VIZITKA_ROZVRZENI[s.card.layout]) s.card.layout = 'qr';
    if (!['ne', 'barva', 'qr'].includes(s.card.back)) s.card.back = 'ne';
    s.card.web = Math.max(-1, Math.min(99, s.card.web)); s.card.qrLink = Math.max(0, Math.min(99, s.card.qrLink));
    s.card.extra = s.card.extra.slice(0, 80); s.card.qrText = s.card.qrText.slice(0, 600);
    return s;
  }

  // ---------- export / import ----------

  function doJSON(s, fotky) {
    const casti = s.name.trim().split(/\s+/);
    const linky = s.links.filter(l => l.url.trim()).map(l => l.platform.toLowerCase() === 'linkedin' ? '|' + l.url + '|' : l.url);
    return {
      version: 5,
      // pole formátu verze 4 – čtou je starší nástroje
      firstName: casti[0] || '', lastName: casti.slice(1).join(' '),
      title: s.titlePrefix, jobTitle: s.title, email: s.email, phone: s.phone,
      addressLinkedinWeb: [s.address, ...linky].filter(Boolean).join('\n'),
      summary: s.bio,
      experiences: s.experience.map(e => ({ company: e.company, role: e.role, period: e.date, desc: e.desc })),
      education: s.education.map(e => ({ school: e.school, degree: e.degree, period: e.date, desc: e.desc })),
      skills: s.skills, languages: s.languages, links: s.links,
      birthDate: s.birthDate, interests: s.interests,
      profilePhoto: (fotky && fotky.foto) || null,
      originalPhoto: (fotky && fotky.original) || null,
      // úplný stav – při importu má přednost
      cv: s
    };
  }

  function zAdresy(text) {
    let adresa = '';
    const links = [];
    for (let r of txt(text).split('\n')) {
      r = r.trim();
      if (!r) continue;
      if (r.startsWith('|') && r.endsWith('|')) links.push({ platform: 'LinkedIn', url: r.slice(1, -1) });
      else if (r.includes('linkedin.com')) links.push({ platform: 'LinkedIn', url: r.replace(/^\||\|$/g, '') });
      else if (/github\.(com|io)/.test(r)) links.push({ platform: 'GitHub', url: r });
      else if (/^https?:\/\//.test(r) || /\.[a-z]{2,}(\/|$)/i.test(r)) links.push({ platform: 'Web', url: r });
      else if (!adresa) adresa = r;
    }
    return { adresa, links };
  }

  function zJSON(d) {
    if (!d || typeof d !== 'object') throw new Error('Soubor neobsahuje životopis.');
    // fotka jen jako vložený obrázek – cizí adresa by se při každém otevření stahovala (a ořez by spadl)
    const obr = x => typeof x === 'string' && /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(x) ? x : null;
    const fotky = { foto: obr(d.profilePhoto), original: obr(d.originalPhoto) };
    if (d.cv) return { stav: normalizuj(d.cv), fotky };
    // starý obsah localStorage (cvBuilderData) – stejné názvy polí jako stav
    if (d.experience || d.titlePrefix !== undefined || d.sectionLayout && !d.firstName && !d.experiences) {
      const s = normalizuj(Object.assign({}, d, { settings: Object.assign({ skillStyle: 'procenta' }, d.settings) }));
      return { stav: s, fotky };
    }
    // export verze 4
    const a = zAdresy(d.addressLinkedinWeb);
    const s = {
      name: [d.firstName, d.lastName].filter(Boolean).join(' '),
      titlePrefix: d.title, email: d.email, phone: d.phone,
      birthDate: d.birthDate || d.extraInfo, interests: d.interests,
      address: a.adresa, bio: d.summary,
      title: d.jobTitle || (d.experiences && d.experiences[0] && d.experiences[0].role) || '',
      links: Array.isArray(d.links) && d.links.length ? d.links : a.links,
      experience: (d.experiences || []).map(e => ({ date: e.period, role: e.role, company: e.company, desc: e.desc })),
      education: (d.education || []).map(e => ({ date: e.period, degree: e.degree, school: e.school, desc: e.desc })),
      skills: d.skills, languages: d.languages,
      sectionLayout: d.sectionLayout,
      settings: Object.assign({ skillStyle: 'procenta' }, d.settings)
    };
    return { stav: normalizuj(s), fotky };
  }

  // ---------- text ----------

  function esc(s) {
    return txt(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function radek(t) {
    return esc(t)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/\*([^*\s<](?:[^*<]*[^*\s<])?)\*/g, '<em>$1</em>')
      // _kurzíva_ jen jako celé slovo – jan_novak_cz zůstane, jak je
      .replace(/(^|[^\p{L}\p{N}_])_([^_\s<](?:[^_<]*[^_\s<])?)_(?![\p{L}\p{N}_])/gu, '$1<em>$2</em>');
  }

  function md(text) {
    const ven = [];
    let seznam = false;
    for (const r of txt(text).split('\n')) {
      const t = r.trim(), m = /^[-*•]\s+(.*)$/.exec(t);
      if (m) {
        if (!seznam) { ven.push('<ul>'); seznam = true; }
        // odrážka bez tučného začátku nebo odsazená v textu = podbod
        const pod = /^\s{2,}/.test(r) || !/^(\*\*|__)/.test(m[1]);
        ven.push('<li' + (pod ? ' class="odsaz"' : '') + '>' + radek(m[1]) + '</li>');
        continue;
      }
      if (seznam) { ven.push('</ul>'); seznam = false; }
      ven.push(t ? '<p>' + radek(t) + '</p>' : '<div class="mez"></div>');
    }
    if (seznam) ven.push('</ul>');
    return ven.join('');
  }

  // http(s) a mailto projdou, holá adresa dostane https://, jiné schéma (javascript:) nic
  function odkaz(url) {
    url = txt(url).trim();
    if (!url) return '';
    if (/^(https?:|mailto:)/i.test(url)) return url;
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return '';
    return 'https://' + url;
  }
  const bezSchematu = url => txt(url).trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');

  const IKONY = [
    [/linkedin/, '🔗'], [/github|gitlab/, '💻'], [/\b(x|twitter)\b/, '🐦'], [/\b(facebook|fb)\b/, '📘'],
    [/\b(instagram|ig)\b/, '📷'], [/youtube/, '▶️'], [/behance/, '🎨'], [/dribbble/, '🏀'],
    [/telegram/, '✈️'], [/\b(web|www|portfolio|blog)\b/, '🌐']
  ];
  function ikonaOdkazu(platforma) {
    const p = txt(platforma).toLowerCase();
    for (const [re, ik] of IKONY) if (re.test(p)) return ik;
    return '🔗';
  }

  function jmenoSouboru(s) {
    const j = (s.name || 'zivotopis').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return 'CV_' + (j || 'zivotopis');
  }

  // ---------- QR kód ----------

  function vcard(s) {
    const e = x => txt(x).trim().replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
    const casti = s.name.trim().split(/\s+/), r = ['BEGIN:VCARD', 'VERSION:3.0',
      `N:${e(casti.slice(1).join(' '))};${e(casti[0] || '')};;${e(s.titlePrefix)};`, `FN:${e([s.titlePrefix, s.name].filter(x => x.trim()).join(' '))}`];
    if (s.title.trim()) r.push('TITLE:' + e(s.title));
    if (s.phone.trim()) r.push('TEL;TYPE=CELL:' + s.phone.replace(/[^\d+]/g, ''));
    if (s.email.trim()) r.push('EMAIL:' + e(s.email));
    if (s.address.trim()) r.push('ADR;TYPE=HOME:;;' + e(s.address) + ';;;;');
    const web = s.links.find(l => odkaz(l.url));
    if (web) r.push('URL:' + odkaz(web.url).replace(/[\r\n]/g, ''));   // URI se neescapuje jako text
    r.push('END:VCARD');
    return r.join('\r\n');
  }
  const cisla = t => txt(t).replace(/[^\d+]/g, '');
  // mezinárodní tvar (+420…); 9 číslic bez předvolby = české číslo; jinak bez předvolby nelze → null
  function mezinarodni(tel) {
    const c = cisla(tel).replace(/^00/, '+');
    if (/^\+\d{8,15}$/.test(c)) return c;
    if (/^[1-9]\d{8}$/.test(c)) return '+420' + c;
    return null;
  }
  // co QR kód obsahuje a jak se pod ním popíše; null = nic k zobrazení
  function qrObsah(s) {
    const st = s.settings, J = JAZYKY[st.lang];
    let q = null;
    if (st.qr === 'vcard') q = { text: vcard(s), popis: J.kontakt };
    else if (st.qr === 'odkaz') {
      const l = (odkaz((s.links[st.qrLink] || {}).url) && s.links[st.qrLink]) || s.links.find(x => odkaz(x.url));
      if (l) q = { text: odkaz(l.url), popis: l.platform.trim() || bezSchematu(l.url) };
    } else if (st.qr === 'email' && s.email.trim()) {
      const predmet = s.title.trim() ? J.vec + s.title.trim() : '';
      q = { text: 'mailto:' + s.email.trim() + (predmet ? '?subject=' + encodeURIComponent(predmet) : ''), popis: J.email };
    } else if (st.qr === 'telefon' && cisla(s.phone).length >= 9) q = { text: 'tel:' + cisla(s.phone), popis: J.tel };
    else if (st.qr === 'whatsapp' && mezinarodni(s.phone)) q = { text: 'https://wa.me/' + mezinarodni(s.phone).slice(1), popis: 'WhatsApp' };
    else if (st.qr === 'vlastni' && st.qrText.trim()) q = { text: st.qrText.trim(), popis: bezSchematu(st.qrText).slice(0, 32) };
    if (q && st.qrLabel.trim()) q.popis = st.qrLabel.trim();
    return q;
  }
  // matice = text => { n, dark(y, x) } (knihovna qrcode-generator, předává stránka); okraj v modulech
  function qrCesta(m, okraj) {
    let d = '';
    for (let y = 0; y < m.n; y++) for (let x = 0; x < m.n; x++) if (m.dark(y, x)) d += `M${x + okraj} ${y + okraj}h1v1h-1z`;
    return d;
  }
  function qrDlazdice(m, popis) {
    return `<div class="cv-qr"><div class="cv-qr-obr"><svg viewBox="0 0 ${m.n + 2} ${m.n + 2}" shape-rendering="crispEdges" role="img" aria-label="QR: ${esc(popis)}">` +
      `<path d="${qrCesta(m, 1)}" fill="currentColor"/></svg></div><span>${esc(popis)}</span></div>`;
  }
  function qrHtml(s, matice) {
    const q = qrObsah(s), m = q && matice && matice(q.text);
    return m ? qrDlazdice(m, q.popis) : '';
  }
  // samostatný soubor SVG: černé moduly na bílé s tichou zónou 4 moduly (pro tisk vizitek apod.)
  function qrSvgSoubor(m) {
    const v = m.n + 8;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${v} ${v}" width="${v * 10}" height="${v * 10}" shape-rendering="crispEdges">` +
      `<rect width="${v}" height="${v}" fill="#fff"/><path d="${qrCesta(m, 4)}" fill="#000"/></svg>`;
  }
  // malé QR kódy ke všem odkazům – řada dole na listu
  function qrOdkazu(s, matice) {
    if (!s.settings.qrLinks || !matice) return '';
    const d = s.links.filter(l => odkaz(l.url)).map(l => { const m = matice(odkaz(l.url)); return m ? qrDlazdice(m, l.platform.trim() || bezSchematu(l.url)) : ''; }).join('');
    return d ? `<div class="cv-qr-rada">${d}</div>` : '';
  }
  // kam QR kód patří podle volby a typu šablony
  function qrMisto(st) {
    const typ = SABLONY[st.template].typ;
    let m = st.qrPlace === 'auto' ? (typ === 'panel' ? 'bok' : 'zahlavi') : st.qrPlace;
    if (m === 'bok' && typ === 'jeden') m = 'pata';
    return m;
  }

  // ---------- prostý text ----------

  const bezMd = t => txt(t).replace(/\*\*(.+?)\*\*|__(.+?)__/g, '$1$2').replace(/(^|[^\p{L}\p{N}_*])[*_]([^*_\s](?:[^*_]*[^*_\s])?)[*_](?![\p{L}\p{N}_*])/gu, '$1$2');
  function mdText(t) {
    return txt(t).split('\n').map(r => { const m = /^\s*[-*•]\s+(.*)$/.exec(r); return m ? '  • ' + bezMd(m[1]) : bezMd(r.trim()); })
      .join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  // životopis jako prostý text (do formulářů pracovních portálů, e-mailu); pořadí sekcí jako na listu
  function text(s) {
    const J = JAZYKY[s.settings.lang], L = s.sectionLayout, ven = [];
    const jmeno = [s.titlePrefix.trim(), s.name.trim()].filter(Boolean).join(' ');
    ven.push(jmeno.toUpperCase() + (s.title.trim() ? '\n' + s.title.trim() : ''));
    const blok = (id, telo) => { if (telo.trim()) ven.push(nadpisSekce(id, s).toUpperCase() + '\n' + telo.trim()); };
    const pol = (datum, co, kde, popis) => [[datum, co].filter(x => x && x.trim()).join(' – '), kde && kde.trim(), popis && popis.trim() ? mdText(popis) : '']
      .filter(Boolean).join('\n');
    const plne = a => a.filter(x => Object.values(x).some(v => typeof v === 'string' && v.trim()));
    const bez = ids => ids.filter(id => id !== 'contact' && id !== 'links');
    const poradi = SABLONY[s.settings.template].typ === 'panel' ? L.sidebar.concat(L.main) : ['contact', 'links'].concat(bez(L.main), bez(L.sidebar));
    for (const id of poradi) {
      if (L.hidden.includes(id)) continue;
      switch (id) {
        case 'contact': blok(id, kontaktRadky(s).map(r => r[1] + ': ' + r[2].trim()).join('\n')); break;
        case 'links': blok(id, s.links.filter(l => l.url.trim()).map(l => (l.platform.trim() || 'Web') + ': ' + bezSchematu(l.url)).join('\n')); break;
        case 'skills': blok(id, s.skills.filter(x => x.name.trim()).map(x => '• ' + x.name.trim()).join('\n')); break;
        case 'languages': blok(id, plne(s.languages).map(l => '• ' + [l.name.trim(), l.level.trim()].filter(Boolean).join(' – ')).join('\n')); break;
        case 'interests': blok(id, s.interests); break;
        case 'profile': blok(id, mdText(s.bio)); break;
        case 'experience': blok(id, plne(s.experience).map(e => pol(e.date, e.role, e.company, e.desc)).join('\n\n')); break;
        case 'education': blok(id, plne(s.education).map(e => pol(e.date, e.degree, e.school, e.desc)).join('\n\n')); break;
        case 'certificates': blok(id, plne(s.certificates).map(e => pol(e.date, e.name, e.issuer, '')).join('\n')); break;
        case 'projects': blok(id, plne(s.projects).map(p => pol('', p.name, p.url && bezSchematu(p.url), p.desc)).join('\n\n')); break;
        case 'references': blok(id, plne(s.references).map(r => pol('', r.name, r.relation, r.contact)).join('\n\n')); break;
        case 'custom': blok(id, mdText(s.custom.text)); break;
      }
    }
    if (s.gdpr.show) ven.push([s.gdpr.text.trim(), J.misto(s.gdpr.place.trim(), s.gdpr.date.trim())].filter(Boolean).join('\n'));
    return ven.join('\n\n') + '\n';
  }
  function textDopisu(s) {
    const D = s.letter, J = JAZYKY[s.settings.lang], jmeno = [s.titlePrefix.trim(), s.name.trim()].filter(Boolean).join(' ');
    return [D.subject.trim(), mdText(D.body), (D.closing.trim() || J.pozdrav) + '\n' + jmeno,
      kontaktRadky(s).filter(r => r[3]).map(r => r[2].trim()).join(' · ')].filter(Boolean).join('\n\n') + '\n';
  }

  // ---------- kontrola ----------

  // tipy k životopisu: { uroven: 'chyba' | 'tip', text, cast } – cast = část editoru, kde se to opraví
  function kontrola(s, strany, matice) {
    const v = [], chyba = (text, cast) => v.push({ uroven: 'chyba', text, cast }), tip = (text, cast) => v.push({ uroven: 'tip', text, cast });
    const plna = a => a.filter(x => Object.values(x).some(h => typeof h === 'string' && h.trim()));
    if (!s.name.trim()) chyba('Chybí jméno.', 'osobni');
    if (!s.email.trim() && !s.phone.trim()) chyba('Chybí kontakt – e-mail nebo telefon.', 'osobni');
    if (s.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.email.trim())) chyba('E-mail nevypadá správně.', 'osobni');
    if (s.phone.trim() && s.phone.replace(/\D/g, '').length < 9) chyba('Telefon má méně než 9 číslic.', 'osobni');
    if (!s.title.trim()) tip('Pod jméno patří pozice nebo profese, o kterou se ucházíte.', 'osobni');
    // čísla položek jako v editoru (počítají se i prázdné)
    const vyplnena = x => Object.values(x).some(h => typeof h === 'string' && h.trim());
    s.links.forEach((l, i) => { if (vyplnena(l) && (/\s/.test(l.url.trim()) || !odkaz(l.url))) chyba(`Odkaz č. ${i + 1} nemá platnou adresu.`, 'osobni'); });
    const bio = s.bio.trim();
    if (!bio) tip('Krátký profil (2–4 věty) pomůže personalistovi rychle pochopit, kdo jste.', 'profil');
    else if (bio.length > 700) tip(`Profil má ${bio.length} znaků – zkuste ho zkrátit pod 600.`, 'profil');
    const zk = plna(s.experience);
    if (!zk.length) tip('Chybí pracovní zkušenosti – počítají se i brigády, praxe a dobrovolnictví.', 'zkusenosti');
    s.experience.forEach((e, i) => {
      if (!vyplnena(e)) return;
      if (!e.role.trim()) chyba(`Zkušenost č. ${i + 1} nemá pozici.`, 'zkusenosti');
      if (!e.date.trim()) tip(`Zkušenost č. ${i + 1} nemá období.`, 'zkusenosti');
    });
    if (zk.length && !zk.some(e => /\d/.test(e.desc))) tip('Do náplně práce přidejte měřitelné výsledky – čísla, procenta, počty.', 'zkusenosti');
    if (!plna(s.education).length) tip('Chybí vzdělání.', 'vzdelani');
    const dov = s.skills.filter(x => x.name.trim()).length;
    if (dov > 15) tip(`Dovedností je ${dov} – vyberte ty podstatné pro pozici.`, 'dovednosti');
    if (!plna(s.languages).length) tip('Uveďte jazyky, aspoň mateřský.', 'dovednosti');
    if (s.gdpr.show && !s.gdpr.date.trim()) tip('U souhlasu se zpracováním údajů chybí datum.', 'souhlas');
    const q = s.settings.qr !== 'ne' && qrObsah(s);
    if (s.settings.qr !== 'ne' && !q) chyba(`QR kód „${QR_TYPY[s.settings.qr]}“ nemá co zobrazit – doplňte údaj nebo ho vypněte.`, 'vzhled');
    if (q && matice) {
      const m = matice(q.text), modul = m && (QR_VELIKOSTI[s.settings.qrSize] - 2) / (m.n + 2);
      if (!m) chyba('Obsah QR kódu je příliš dlouhý.', 'vzhled');
      else if (modul < QR_MIN_MODUL) tip(`QR kód je hustý (modul ${modul.toFixed(2).replace('.', ',')} mm) – z papíru se špatně čte. Zvolte větší velikost nebo kratší obsah.`, 'vzhled');
    }
    if (s.settings.qrLinks && matice) {
      const huste = s.links.filter(l => odkaz(l.url)).filter(l => { const m = matice(odkaz(l.url)); return !m || (QR_MALY - 1.2) / (m.n + 2) < QR_MIN_MODUL; });
      if (huste.length) tip(`Malé QR u odkazů jsou husté (${huste.map(l => l.platform.trim() || bezSchematu(l.url)).join(', ')}) – zkraťte adresu nebo je vypněte.`, 'vzhled');
    }
    if (s.settings.qr === 'whatsapp' && cisla(s.phone).length && !mezinarodni(s.phone)) chyba('Pro QR na WhatsApp uveďte telefon s předvolbou (+420 …).', 'osobni');
    if (strany > 2) tip(`Životopis má ${strany} ${strany < 5 ? 'strany' : 'stran'} – obvykle stačí 1–2.`, 'osobni');
    return v;
  }

  const OSLOVENI = /^(vážen|dobrý den|milá|milý|dear|hello|hi\b|good (morning|afternoon))/i;
  function kontrolaDopisu(s, strany) {
    const v = [], chyba = text => v.push({ uroven: 'chyba', text, cast: 'dopis' }), tip = text => v.push({ uroven: 'tip', text, cast: 'dopis' });
    const D = s.letter, telo = D.body.trim();
    if (!s.email.trim() && !s.phone.trim()) v.push({ uroven: 'chyba', text: 'Chybí kontakt – e-mail nebo telefon.', cast: 'osobni' });
    if (!telo) chyba('Dopis nemá text.');
    else {
      if (!OSLOVENI.test(telo)) tip('Začněte oslovením – „Vážená paní…“, „Dobrý den,“.');
      if (telo.length < 400) tip('Dopis je krátký – stačí 3–4 odstavce: proč tato firma, co nabízíte, čím přispějete.');
      if (telo.length > 2600) tip('Dopis je dlouhý – personalista ho čte do minuty, zkuste ho zkrátit.');
    }
    if (!D.recipient.trim()) tip('Doplňte adresáta – firmu, případně jméno personalisty.');
    if (!D.subject.trim()) tip('Doplňte předmět – pozici, případně číslo inzerátu.');
    if (!D.date.trim()) tip('Doplňte datum.');
    if (strany > 1) tip('Dopis má víc než 1 stranu.');
    return v;
  }

  // ---------- vykreslení ----------

  function kontaktRadky(s) {
    const tel = s.phone.replace(/[^\d+]/g, ''), J = JAZYKY[s.settings.lang];
    return [
      ['📞', J.tel, s.phone, tel ? 'tel:' + tel : ''],
      ['✉️', J.email, s.email, s.email ? 'mailto:' + s.email.trim() : ''],
      ['📍', J.adresa, s.address, ''],
      ['🎂', J.narozeni, s.birthDate, ''],
      ['🚗', J.ridicak, s.license, '']
    ].filter(r => r[1] && r[2].trim());
  }
  // odkaz ukazuje druh (LinkedIn…) a vede na adresu; adresa se vypíše jen při linkUrl
  function odkazRadky(s) {
    return s.links.filter(l => l.url.trim()).map(l => {
      const druh = l.platform.trim(), adr = bezSchematu(l.url);
      const text = !druh ? adr : s.settings.linkUrl ? druh + ': ' + adr : druh;
      return [ikonaOdkazu(druh), '', text, odkaz(l.url)];
    });
  }
  function radkyKontaktu(radky, ikony) {
    return radky.map(([ik, lb, hodn, href]) => {
      const pred = ikony ? `<span class="ik" aria-hidden="true">${ik}</span>` : lb ? `<span class="lb">${esc(lb)}:</span>` : '';
      const h = esc(hodn);
      return `<div class="cv-k">${pred}<span>${href ? `<a href="${esc(href)}">${h}</a>` : h}</span></div>`;
    }).join('');
  }

  function dovednost(x, styl, z) {
    const n = esc(x.name);
    if (styl === 'tecky') {
      const t = Math.round(x.level / 20);
      return `<div class="cv-dov"><div class="cv-dov-hl"><span>${n}</span><span class="cv-tecky" role="img" aria-label="${t} ${z} 5">${'●'.repeat(t)}${'○'.repeat(5 - t)}</span></div></div>`;
    }
    const pr = styl === 'procenta' ? `<span>${x.level} %</span>` : '';
    return `<div class="cv-dov"><div class="cv-dov-hl"><span>${n}</span>${pr}</div><div class="cv-pruh"><i style="width:${x.level}%"></i></div></div>`;
  }

  // co a kde jsou už HTML (escapované volajícím)
  function polozka(datum, co, kde, popis) {
    return `<div class="cv-pol">${datum ? `<div class="cv-datum">${esc(datum)}</div>` : ''}` +
      `${co ? `<div class="cv-co">${co}</div>` : ''}${kde ? `<div class="cv-kde">${kde}</div>` : ''}` +
      `${popis && popis.trim() ? `<div class="cv-md">${md(popis)}</div>` : ''}</div>`;
  }

  function obsahSekce(id, s) {
    const st = s.settings, prazdne = a => !a.some(x => Object.values(x).some(v => txt(v).trim()));
    switch (id) {
      case 'contact': { const r = kontaktRadky(s); return r.length ? `<div class="cv-kontakty">${radkyKontaktu(r, st.icons)}</div>` : ''; }
      case 'links': { const r = odkazRadky(s); return r.length ? `<div class="cv-kontakty">${radkyKontaktu(r, st.icons)}</div>` : ''; }
      case 'skills':
        if (!s.skills.some(x => x.name.trim())) return '';
        if (st.skillStyle === 'text') return `<div class="cv-stitky">${s.skills.filter(x => x.name.trim()).map(x => `<span>${esc(x.name)}</span>`).join('')}</div>`;
        return s.skills.filter(x => x.name.trim()).map(x => dovednost(x, st.skillStyle, JAZYKY[st.lang].z)).join('');
      case 'languages':
        return prazdne(s.languages) ? '' : s.languages.map(l => `<div class="cv-jaz"><span>${esc(l.name)}</span><b>${esc(l.level)}</b></div>`).join('');
      case 'interests': return s.interests.trim() ? `<div class="cv-text">${esc(s.interests)}</div>` : '';
      case 'profile': return s.bio.trim() ? `<div class="cv-md cv-profil">${md(s.bio)}</div>` : '';
      case 'experience':
        return prazdne(s.experience) ? '' : s.experience.map(e => polozka(e.date, esc(e.role), esc(e.company), e.desc)).join('');
      case 'education':
        return prazdne(s.education) ? '' : s.education.map(e => polozka(e.date, esc(e.degree), esc(e.school), e.desc)).join('');
      case 'certificates':
        return prazdne(s.certificates) ? '' : s.certificates.map(e => polozka(e.date, esc(e.name), esc(e.issuer), '')).join('');
      case 'projects':
        return prazdne(s.projects) ? '' : s.projects.map(p => {
          const h = odkaz(p.url);
          return polozka('', esc(p.name), h ? `<a href="${esc(h)}">${esc(bezSchematu(p.url))}</a>` : '', p.desc);
        }).join('');
      case 'references':
        return prazdne(s.references) ? '' : s.references.map(r => polozka('', esc(r.name), esc(r.relation), r.contact)).join('');
      case 'custom': return s.custom.text.trim() ? `<div class="cv-md">${md(s.custom.text)}</div>` : '';
    }
    return '';
  }

  // vlastní nadpis > nadpis vlastní sekce > výchozí podle jazyka
  function nadpisSekce(id, s) {
    return s.headings[id] || (id === 'custom' && s.custom.heading.trim()) || JAZYKY[s.settings.lang].sekce[id];
  }

  function sekce(id, s) {
    const o = obsahSekce(id, s);
    return o ? `<section class="cv-sekce s-${id}"><h2>${esc(nadpisSekce(id, s))}</h2>${o}</section>` : '';
  }

  function gdpr(s) {
    const g = s.gdpr;
    if (!g.show || !(g.text.trim() || g.place.trim() || g.date.trim())) return '';
    const kde = JAZYKY[s.settings.lang].misto(g.place.trim(), g.date.trim());
    return `<div class="cv-gdpr">${g.text.trim() ? `<p>${esc(g.text)}</p>` : ''}${kde ? `<p class="cv-misto">${esc(kde)}</p>` : ''}</div>`;
  }

  // míchání barev #rrggbb: t = podíl druhé barvy
  function smes(a, b, t) {
    const h = x => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16));
    const A = h(a), B = h(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  // kontrast podle WCAG
  function kontrast(a, b) {
    const L = h => {
      const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const x = L(a), y = L(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  function hsl(h, s, l) {
    s /= 100; l /= 100;
    const f = n => { const k = (n + h / 30) % 12; return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return '#' + [0, 8, 4].map(n => Math.round(f(n) * 255).toString(16).padStart(2, '0')).join('');
  }
  // náhodné ladicí barvy: akcent podle schématu barevného kruhu, ostatní v odstínu hlavní barvy;
  // tmavne, dokud nemá potřebný kontrast vůči bílé (stejné meze jako hotová témata)
  const SCHEMATA = [['doplňkové', [180]], ['analogické', [30, -30]], ['trojice', [120, -120]], ['rozdělené doplňkové', [150, 210]]];
  function nahodneTema(rnd = Math.random) {
    const R = (a, b) => a + rnd() * (b - a), vyber = a => a[Math.floor(rnd() * a.length)];
    const h = R(0, 360), [schema, posuny] = vyber(SCHEMATA), ha = (h + vyber(posuny) + 360) % 360;
    const tmavsi = (odst, syt, sv, min) => { let x = hsl(odst, syt, sv); while (kontrast(x, '#ffffff') < min && sv > 2) x = hsl(odst, syt, --sv); return x; };
    const accent = tmavsi(ha, R(60, 85), 65, 3), ps = R(35, 70);   // nejsvětlejší akcent, který ještě obstojí na bílé
    // akcent slouží i jako nadpis na tmavém panelu → aspoň 2:1 proti hlavní barvě
    let pl = R(14, 26), primary = tmavsi(h, ps, pl, 7);
    while (kontrast(accent, primary) < 2 && pl > 3) primary = hsl(h, ps, --pl);
    return {
      schema, primary, accent,
      text: tmavsi(h, R(12, 22), 24, 7),
      muted: tmavsi(h, R(8, 16), 46, 4.5),
      line: hsl(h, R(18, 30), R(89, 93))
    };
  }
  // barva textu v odstínu akcentu: ztmaví (na světlém) nebo zesvětlí (na tmavém), až má kontrast min
  function citelna(barva, pozadi, min) {
    const cil = kontrast(pozadi, '#000000') > kontrast(pozadi, '#ffffff') ? '#000000' : '#ffffff';
    for (let t = 0; t <= 1; t += 0.05) {
      const x = smes(barva, cil, t);
      if (kontrast(x, pozadi) >= min) return x;
    }
    return cil;
  }
  const pruhledna = (hex, a) => 'rgba(' + [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',') + ',' + a + ')';

  // pozadí papíru jako vrstvy CSS (poslední je barva) + základní barva pro obrysy
  function papir(st) {
    const B = '#ffffff', z = { kremova: '#fdfaf2', seda: '#f6f7f9', odstin: smes(st.primary, B, 0.95) }[st.paper] || B;
    switch (st.paper) {
      case 'tecky': return { css: `radial-gradient(circle,${smes(st.muted, B, 0.55)} 0.3mm,transparent 0.36mm) 0 0/5mm 5mm,${z}`, zaklad: z };
      case 'linky': return { css: `repeating-linear-gradient(180deg,transparent 0 7.7mm,${st.line} 7.7mm 8mm),${z}`, zaklad: z };
      case 'mrizka': {
        const c = smes(st.line, B, 0.3);
        return { css: `linear-gradient(${c} 0.25mm,transparent 0.25mm) 0 0/5mm 5mm,linear-gradient(90deg,${c} 0.25mm,transparent 0.25mm) 0 0/5mm 5mm,${z}`, zaklad: z };
      }
      case 'prechod': return { css: `radial-gradient(circle at 100% 0,${smes(st.accent, B, 0.88)},transparent 55%),radial-gradient(circle at 0 100%,${smes(st.primary, B, 0.92)},transparent 50%),${z}`, zaklad: z };
    }
    return { css: z, zaklad: z };
  }

  function stylListu(st) {
    const pap = papir(st);
    // --at = akcent jako drobný text na papíře, --an = na tmavé ploše (panel, barevné záhlaví), --qr = tmavé moduly QR
    const tmava = st.template === 'zahlavi' ? smes(st.primary, '#000000', 0.2) : st.primary;
    return `--p:${st.primary};--a:${st.accent};--t:${st.text};--m:${st.muted};--l:${st.line};--pz:${pap.zaklad};` +
      `--at:${citelna(st.accent, pap.zaklad, 4.5)};--an:${citelna(st.accent, tmava, 4.5)};--qr:${citelna(st.primary, '#ffffff', 7)};--qs:${QR_VELIKOSTI[st.qrSize]}mm;` +
      `--bw:${st.sidebarW}mm;--fs:${st.fontSize}px;--fj:${st.nameFontSize}px;--ft:${st.titleFontSize}px;--fz:${st.expFontSize}px;` +
      `--ff:${FONTY[st.font]};background:${pap.css}`;
  }

  function vykresli(s, foto, matice) {
    const st = s.settings, L = s.sectionLayout, typ = SABLONY[st.template].typ, styl = stylListu(st), kod = qrHtml(s, matice), misto = qrMisto(st);
    const qr = m => misto === m ? kod : '';
    const pata = (kod && misto === 'pata' ? `<div class="cv-qr-pata">${kod}</div>` : '') + qrOdkazu(s, matice);
    const trida = `cv t-${st.template}${TMAVY_BOK.includes(st.template) ? ' tmavy-bok' : ''}`;
    const jmeno = esc([s.titlePrefix.trim(), s.name.trim()].filter(Boolean).join(' '));
    const fotoHtml = foto && st.photoShape !== 'skryt' ? `<img class="cv-foto f-${st.photoShape}" src="${esc(foto)}" alt="">` : '';
    const hlavicka = `<h1 class="cv-jmeno">${jmeno}</h1><div class="cv-cara"></div>${s.title.trim() ? `<p class="cv-pozice">${esc(s.title)}</p>` : ''}`;
    const tvorba = ids => ids.map(id => sekce(id, s)).join('');

    if (typ === 'panel') {
      const uvod = qr('zahlavi') ? `<div class="cv-uvod"><div>${hlavicka}</div>${kod}</div>` : hlavicka;
      return `<div class="${trida}" style="${styl}"><aside class="cv-bok">${fotoHtml}${tvorba(L.sidebar)}${qr('bok')}</aside>` +
        `<main class="cv-hlavni">${uvod}${tvorba(L.main)}${pata}${gdpr(s)}</main></div>`;
    }
    // šablony se záhlavím: kontakt a odkazy v záhlaví (pokud nejsou skryté)
    const vZahlavi = ['contact', 'links'].filter(id => !L.hidden.includes(id));
    const radky = [].concat(vZahlavi.includes('contact') ? kontaktRadky(s) : [], vZahlavi.includes('links') ? odkazRadky(s) : []);
    const zahlavi = `<header class="cv-hlava">${fotoHtml}<div class="cv-hlava-text">${hlavicka}` +
      `${radky.length ? `<div class="cv-kontakty">${radkyKontaktu(radky, st.icons)}</div>` : ''}</div>${qr('zahlavi')}</header>`;
    const bez = ids => ids.filter(id => id !== 'contact' && id !== 'links');
    if (typ === 'jeden') {
      return `<div class="${trida}" style="${styl}">${zahlavi}<main class="cv-hlavni">${tvorba(bez(L.main.concat(L.sidebar)))}${pata}${gdpr(s)}</main></div>`;
    }
    return `<div class="${trida}" style="${styl}">${zahlavi}<div class="cv-telo"><aside class="cv-bok">${tvorba(bez(L.sidebar))}${qr('bok')}</aside>` +
      `<main class="cv-hlavni">${tvorba(bez(L.main))}${pata}${gdpr(s)}</main></div></div>`;
  }

  // průvodní dopis ve stejném vzhledu (barvy, písmo, papír), záhlaví s kontakty jako u šablon se záhlavím
  function vykresliDopis(s, foto, matice) {
    const st = s.settings, D = s.letter, J = JAZYKY[st.lang];
    const jmeno = esc([s.titlePrefix.trim(), s.name.trim()].filter(Boolean).join(' '));
    const radky = kontaktRadky(s).concat(odkazRadky(s));
    const kdy = J.misto(D.place.trim(), D.date.trim());
    return `<div class="cv cv-dopis" style="${stylListu(st)}"><header class="cv-hlava"><div class="cv-hlava-text">` +
      `<h1 class="cv-jmeno">${jmeno}</h1><div class="cv-cara"></div>${s.title.trim() ? `<p class="cv-pozice">${esc(s.title)}</p>` : ''}` +
      `${radky.length ? `<div class="cv-kontakty">${radkyKontaktu(radky, st.icons)}</div>` : ''}</div>${st.qrLetter ? qrHtml(s, matice) : ''}</header>` +
      `<main class="d-telo">${D.recipient.trim() ? `<div class="d-adresat">${esc(D.recipient.trim())}</div>` : ''}` +
      `${kdy ? `<p class="d-misto">${esc(kdy)}</p>` : ''}${D.subject.trim() ? `<p class="d-predmet">${esc(D.subject)}</p>` : ''}` +
      `<div class="cv-md d-text">${md(D.body)}</div><p class="d-pozdrav">${esc(D.closing.trim() || J.pozdrav)}</p>` +
      `<p class="d-podpis">${jmeno}</p></main></div>`;
  }

  // QR vizitky: vlastní volba, jinak stejná logika jako na životopisu
  function qrVizitky(s) {
    const C = s.card;
    return qrObsah(Object.assign({}, s, { settings: Object.assign({}, s.settings, { qr: C.qr, qrLink: C.qrLink, qrText: C.qrText, qrLabel: '' }) }));
  }
  const VZ_QR = { qr: 24, pas: 22, tmava: 24, stred: 13 };   // mm
  function radkyVizitky(s) {
    const C = s.card, l = s.links[C.web];
    return [C.phone && s.phone.trim(), C.email && s.email.trim(), l && odkaz(l.url) && bezSchematu(l.url), C.address && s.address.trim(), C.extra.trim()].filter(Boolean);
  }
  // arch A4 s 10 vizitkami 85 × 55 mm, volitelně druhý arch se zadními stranami (oboustranný tisk)
  function vykresliVizitky(s, foto, matice) {
    const st = s.settings, C = s.card, q = qrVizitky(s), m = q && matice && matice(q.text);
    const jmeno = esc([s.titlePrefix.trim(), s.name.trim()].filter(Boolean).join(' '));
    const svg = m && `<svg viewBox="0 0 ${m.n + 2} ${m.n + 2}" shape-rendering="crispEdges" role="img" aria-label="QR: ${esc(q.popis)}"><path d="${qrCesta(m, 1)}" fill="currentColor"/></svg>`;
    const zn = C.marks ? ' vz-znacky' : '';
    const predni = `<div class="vz-karta vz-r-${C.layout}${zn}">${C.photo && foto ? `<img class="vz-foto" src="${esc(foto)}" alt="">` : ''}` +
      `<div class="vz-text"><div class="vz-jmeno">${jmeno}</div>${C.title && s.title.trim() ? `<div class="vz-pozice">${esc(s.title)}</div>` : ''}` +
      `<div class="vz-kontakty">${radkyVizitky(s).map(r => `<div class="vz-k">${esc(r)}</div>`).join('')}</div></div>` +
      `${svg ? `<div class="vz-qr">${svg}</div>` : ''}</div>`;
    const arch = karta => `<div class="cv cv-vizitky" style="${stylListu(st)}">${karta.repeat(10)}</div>`;
    if (C.back === 'ne') return arch(predni);
    const zadni = C.back === 'qr' && svg
      ? `<div class="vz-karta vz-rub-qr${zn}"><div class="vz-qr">${svg}</div><span>${esc(q.popis)}</span></div>`
      : `<div class="vz-karta vz-rub-barva${zn}"><div class="vz-jmeno">${jmeno}</div>${C.title && s.title.trim() ? `<div class="vz-pozice">${esc(s.title)}</div>` : ''}</div>`;
    return `<div class="cv-vizitky-obal">${arch(predni)}${arch(zadni)}</div>`;
  }
  function kontrolaVizitek(s, matice) {
    const v = [], C = s.card, tip = text => v.push({ uroven: 'tip', text, cast: 'vizitky' });
    if (!s.name.trim()) v.push({ uroven: 'chyba', text: 'Chybí jméno.', cast: 'osobni' });
    const radky = radkyVizitky(s);
    if (!radky.length && C.qr === 'ne') v.push({ uroven: 'chyba', text: 'Na vizitce není žádný kontakt ani QR kód.', cast: 'vizitky' });
    if (radky.length > 4) tip(`Na vizitce je ${radky.length} řádků – vejde se nejvýš 4–5, zvažte méně.`);
    if (C.web >= 0 && !(s.links[C.web] && odkaz(s.links[C.web].url))) tip('Vybraný odkaz pro vizitku už neexistuje.');
    if (C.photo && C.layout === 'stred') tip('V rozvržení Na střed se fotka nezobrazuje.');
    const q = qrVizitky(s);
    if (C.qr !== 'ne' && !q) v.push({ uroven: 'chyba', text: `QR kód vizitky „${QR_TYPY[C.qr]}“ nemá co zobrazit.`, cast: 'vizitky' });
    if (q && matice) {
      const m = matice(q.text), modul = m && (VZ_QR[C.layout] - 1) / (m.n + 2);
      if (!m) v.push({ uroven: 'chyba', text: 'Obsah QR kódu vizitky je příliš dlouhý.', cast: 'vizitky' });
      else if (modul < QR_MIN_MODUL) tip(`QR kód vizitky je hustý (modul ${modul.toFixed(2).replace('.', ',')} mm) – zvolte kratší obsah (např. odkaz místo vCard) nebo jiné rozvržení.`);
    }
    return v;
  }

  // pozadí celé tiskové stránky: papír a barva panelu pokračují i na dalších stranách
  // (list končí s obsahem, pozadí kořene se kreslí na každou stranu; list sám se tiskne bez pozadí)
  function pozadiTisku(s, dokument) {
    const st = s.settings, w = st.sidebarW + 'mm', pap = papir(st).css;
    if (dokument === 'vizitky') return '#fff';
    if (dokument === 'dopis' || dokument === true) return pap;
    if (st.template === 'panel') return `linear-gradient(90deg,${st.primary} ${w},transparent ${w}),${pap}`;
    if (st.template === 'vpravo') return `linear-gradient(270deg,${st.primary} ${w},transparent ${w}),${pap}`;
    if (st.template === 'zahlavi') return `linear-gradient(90deg,${smes(st.primary, '#000000', 0.2)} ${w},transparent ${w}),${pap}`;
    if (st.template === 'pruh') return `linear-gradient(90deg,${st.primary} 14mm,${st.accent} 14mm,${st.accent} calc(14mm + 3px),transparent calc(14mm + 3px)),${pap}`;
    if (st.template === 'kompakt') {
      return `linear-gradient(90deg,${pruhledna(st.primary, 0.05)} ${w},${st.line} ${w},${st.line} calc(${w} + 1px),transparent calc(${w} + 1px)),${pap}`;
    }
    return pap;
  }
  const CSS_TISK = '@media print{@page{size:A4;margin:0}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.cv,.t-kompakt .cv-bok{background:none !important}.cv{min-height:calc(297mm - 1px)}.cv.cv-vizitky{height:calc(297mm - 1px)}}';

  const CSS = `
.cv,.cv *{margin:0;padding:0;box-sizing:border-box}
.cv{width:210mm;min-height:297mm;background:#fff;color:var(--t);font-family:var(--ff);font-size:var(--fs);line-height:1.5;
  display:flex;text-align:left;-webkit-print-color-adjust:exact;print-color-adjust:exact;
  -webkit-box-decoration-break:clone;box-decoration-break:clone}
.cv a{color:inherit;text-decoration:none}
.cv-sekce,.cv-hlava-text{overflow-wrap:anywhere}
.cv-dov-hl > span:first-child,.cv-jaz > span{min-width:0}
.cv-bok,.cv-hlavni{-webkit-box-decoration-break:clone;box-decoration-break:clone}
.cv-bok{width:var(--bw);flex-shrink:0;padding:40px 24px}
.cv-hlavni{flex:1;min-width:0;padding:46px 42px;display:flex;flex-direction:column}
.cv-sekce{margin-bottom:22px}
.cv h2{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--p);border-bottom:2px solid var(--l);
  padding-bottom:4px;margin-bottom:10px;break-after:avoid}
.cv-pol{margin-bottom:11px;break-inside:avoid}
.cv-datum{font-size:.72em;font-weight:800;color:var(--at);text-transform:uppercase;letter-spacing:1px}
.cv-co{font-size:1.05em;font-weight:800;color:var(--p);line-height:1.3}
.cv-kde{font-size:.85em;font-weight:600;color:var(--m);font-style:italic;overflow-wrap:anywhere}
.cv-md{font-size:var(--fz);color:var(--t);line-height:1.45;margin-top:3px}
.cv-profil{font-size:1em;line-height:1.65;text-align:justify}
.cv-md ul{list-style:disc;margin:2px 0 2px 1.1rem}
.cv-md li.odsaz{margin-left:1rem}
.cv-md strong{font-weight:700}
.cv-md p{margin-bottom:2px}
.cv-md .mez{height:.5em}
.cv-hlavni .s-experience .cv-pol{border-left:2px solid var(--l);padding-left:16px;position:relative}
.cv-hlavni .s-experience .cv-pol::before{content:'';position:absolute;left:-5px;top:4px;width:8px;height:8px;border-radius:50%;
  background:var(--a);box-shadow:0 0 0 3px var(--pz)}
.cv-jmeno{font-size:var(--fj);font-weight:900;color:var(--p);line-height:1.05;letter-spacing:-.5px}
.cv-cara{height:4px;width:50px;background:var(--a);margin:14px 0}
.cv-pozice{font-size:var(--ft);color:var(--at);font-weight:300;letter-spacing:3px;margin-bottom:26px}
.cv-foto{width:130px;height:130px;border-radius:50%;object-fit:cover;display:block;border:4px solid var(--a);flex-shrink:0}
.cv-bok .cv-foto{margin:0 auto 30px}
.cv .cv-foto.f-zaobleny{border-radius:16%}
.cv .cv-foto.f-ctverec{border-radius:0}
.cv-k{display:flex;gap:6px;align-items:baseline;margin-bottom:3px;overflow-wrap:anywhere;font-size:.9em}
.cv-k .ik{width:1.2em;flex-shrink:0;text-align:center}
.cv-k .lb{font-weight:700;flex-shrink:0}
.cv-hlavni .cv-kontakty,.cv-hlava .cv-kontakty{display:flex;flex-wrap:wrap;column-gap:16px}
.cv-dov{margin-bottom:7px;break-inside:avoid}
.cv-dov-hl{display:flex;justify-content:space-between;gap:6px;font-size:.82em;font-weight:700}
.cv-pruh{height:5px;background:var(--l);border-radius:3px;overflow:hidden;margin-top:2px}
.cv-pruh i{display:block;height:100%;background:var(--a)}
.cv-tecky{color:var(--at);letter-spacing:2px;white-space:nowrap}
.cv-stitky{display:flex;flex-wrap:wrap;gap:5px}
.cv-stitky span{border:1px solid var(--a);border-radius:10px;padding:1px 8px;font-size:.85em}
.cv-jaz{display:flex;justify-content:space-between;gap:8px;margin-bottom:4px;font-size:.9em}
.cv-jaz b{color:var(--at)}
.cv-text{font-size:.9em;line-height:1.6}
.cv-gdpr{margin-top:auto;padding-top:18px;font-size:8.5px;color:var(--m);line-height:1.4;break-inside:avoid}
.cv-misto{margin-top:4px}
.tmavy-bok .cv-bok{background:var(--p);color:#fff}
.tmavy-bok .cv-bok,.t-kompakt .cv-hlava,.t-moderni .cv-hlava,.t-zahlavi .cv-hlava{--at:var(--an)}
.tmavy-bok .cv-bok h2{color:var(--at);border-bottom:1px solid rgba(255,255,255,.15);font-size:10px;letter-spacing:2px}
.tmavy-bok .cv-bok .cv-co{color:#fff;font-size:.95em}
.tmavy-bok .cv-bok .cv-kde,.tmavy-bok .cv-bok .cv-md,.tmavy-bok .cv-bok .cv-text{color:rgba(255,255,255,.78)}
.tmavy-bok .cv-bok .cv-pruh{background:rgba(255,255,255,.15)}
.tmavy-bok .cv-bok .cv-gdpr{color:rgba(255,255,255,.6)}
.t-klasik{display:block;padding:40px 50px}
.t-klasik .cv-hlava{display:flex;gap:24px;align-items:center;border-bottom:3px solid var(--a);padding-bottom:16px;margin-bottom:22px}
.t-klasik .cv-hlava-text{flex:1;min-width:0}
.t-klasik .cv-hlavni{padding:0;display:block}
.t-klasik .cv-pozice,.t-kompakt .cv-pozice{margin-bottom:8px}
.t-klasik .cv-cara,.t-kompakt .cv-cara{margin:8px 0}
.t-klasik .cv-foto,.t-kompakt .cv-foto{width:105px;height:105px}
.t-klasik .cv-gdpr{margin-top:24px}
.t-kompakt{flex-direction:column}
.t-kompakt .cv-hlava{background:var(--p);color:#fff;display:flex;gap:22px;align-items:center;padding:26px 34px}
.t-kompakt .cv-hlava-text{flex:1;min-width:0}
.t-kompakt .cv-jmeno{color:#fff}
.t-kompakt .cv-foto{border-color:#fff}
.t-kompakt .cv-telo{display:flex;flex:1}
.t-kompakt .cv-bok{border-right:1px solid var(--l);padding:24px 20px;background:color-mix(in srgb,var(--p) 5%,transparent)}
.t-kompakt .cv-hlavni{padding:24px 30px}
.t-kompakt .cv-sekce{margin-bottom:16px}
.t-vpravo{flex-direction:row-reverse}
.t-minimal{display:block;padding:44px 52px}
.t-minimal .cv-hlava{display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;margin-bottom:24px;padding-bottom:18px;border-bottom:1px solid var(--l)}
.t-minimal .cv-hlava-text{display:flex;flex-direction:column;align-items:center}
.t-minimal .cv-jmeno{font-weight:300;letter-spacing:2px}
.t-minimal .cv-cara{width:30px;height:2px;margin:10px auto}
.t-minimal .cv-pozice{margin-bottom:8px;letter-spacing:4px;text-transform:uppercase;font-size:calc(var(--ft) * .8)}
.t-minimal .cv-hlava .cv-kontakty{justify-content:center}
.t-minimal .cv-foto{width:96px;height:96px;border-width:2px}
.t-minimal .cv-hlavni{padding:0;display:block}
.t-minimal .cv-sekce{display:grid;grid-template-columns:34mm 1fr;column-gap:7mm;margin-bottom:18px}
.t-minimal .cv-sekce > h2{grid-row:1/span 60;border:0;padding:0;margin:2px 0 0;font-size:10.5px;letter-spacing:2px;color:var(--at)}
.t-minimal .cv-sekce > :not(h2){grid-column:2}
.t-minimal .cv-hlavni .s-experience .cv-pol{border:0;padding-left:0}
.t-minimal .cv-hlavni .s-experience .cv-pol::before{display:none}
.t-minimal .cv-gdpr{margin-top:24px}
.t-moderni{flex-direction:column}
.t-moderni .cv-hlava{background:var(--p);color:#fff;display:flex;gap:24px;align-items:center;padding:30px 36px;border-bottom:6px solid var(--a)}
.t-moderni .cv-hlava-text{flex:1;min-width:0}
.t-moderni .cv-jmeno{color:#fff}
.t-moderni .cv-foto{border-color:#fff;width:110px;height:110px}
.t-moderni .cv-pozice{margin-bottom:8px}
.t-moderni .cv-cara{margin:8px 0}
.t-moderni .cv-telo{display:flex;flex-direction:row-reverse;align-items:flex-start;gap:22px;padding:26px 30px}
.t-moderni .cv-bok{width:var(--bw);padding:18px 16px;border-radius:10px;background:color-mix(in srgb,var(--p) 6%,transparent)}
.t-moderni .cv-hlavni{padding:0}
.t-moderni h2{border:0;border-left:4px solid var(--a);padding:1px 0 1px 9px}
.t-moderni .cv-bok h2{font-size:11px}
.t-osa,.t-pruh,.t-elegant{display:block;padding:42px 48px}
.t-osa .cv-hlavni,.t-pruh .cv-hlavni,.t-elegant .cv-hlavni{padding:0;display:block}
.t-osa .cv-hlava,.t-pruh .cv-hlava{display:flex;gap:22px;align-items:center;padding-bottom:16px;margin-bottom:22px}
.t-osa .cv-hlava-text,.t-pruh .cv-hlava-text,.t-karty .cv-hlava-text,.t-zahlavi .cv-hlava-text{flex:1;min-width:0}
.t-osa .cv-cara,.t-pruh .cv-cara,.t-karty .cv-cara,.t-zahlavi .cv-cara{margin:8px 0}
.t-osa .cv-pozice,.t-pruh .cv-pozice,.t-karty .cv-pozice,.t-zahlavi .cv-pozice{margin-bottom:8px}
.t-osa .cv-foto,.t-pruh .cv-foto,.t-karty .cv-foto,.t-zahlavi .cv-foto{width:100px;height:100px}
.t-osa .cv-gdpr,.t-pruh .cv-gdpr{margin-top:24px}
.t-osa .cv-hlava{border-bottom:1px solid var(--l)}
.t-osa h2{border:0;color:var(--at);letter-spacing:2px}
.t-osa .cv-sekce > :not(h2):not(.cv-pol){margin-left:35mm}
.t-osa .cv-pol{display:grid;grid-template-columns:28mm 1fr;position:relative;margin-bottom:0;padding-bottom:12px}
.t-osa .cv-hlavni .s-experience .cv-pol{border:0;padding-left:0}
.t-osa .cv-pol > :not(.cv-datum){grid-column:2;padding-left:7mm}
.t-osa .cv-datum{grid-row:1/span 9;padding:2px 5mm 0 0;text-align:right;font-size:.75em}
.t-osa .cv-hlavni .cv-pol::before{content:'';position:absolute;left:28mm;top:0;bottom:0;width:2px;height:auto;border-radius:0;background:var(--l);box-shadow:none}
.t-osa .cv-pol::after{content:'';position:absolute;left:calc(28mm - 4px);top:4px;width:10px;height:10px;border-radius:50%;background:var(--a);box-shadow:0 0 0 3px var(--pz)}
.t-pruh{position:relative;padding-left:calc(14mm + 36px)}
.t-pruh::before{content:'';position:absolute;left:0;top:0;bottom:0;width:14mm;background:var(--p);box-shadow:3px 0 0 var(--a)}
.t-elegant{padding:46px 56px}
.t-elegant .cv-hlava{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;padding:14px 0 16px;margin-bottom:22px;border-top:3px double var(--p);border-bottom:3px double var(--p)}
.t-elegant .cv-hlava-text{display:flex;flex-direction:column;align-items:center}
.t-elegant .cv-jmeno{font-weight:400;letter-spacing:3px;text-transform:uppercase;font-size:calc(var(--fj) * .8)}
.t-elegant .cv-cara{display:none}
.t-elegant .cv-pozice{margin:6px 0 8px;font-style:italic;letter-spacing:1px}
.t-elegant .cv-hlava .cv-kontakty{justify-content:center}
.t-elegant .cv-foto{width:92px;height:92px;border-width:1px;border-color:var(--p)}
.t-elegant h2{display:flex;align-items:center;justify-content:center;gap:10px;border:0;padding:0;letter-spacing:3px;font-weight:600}
.t-elegant h2::before,.t-elegant h2::after{content:'';flex:1;height:1px;background:var(--l)}
.t-elegant .cv-hlavni .s-experience .cv-pol{border:0;padding-left:0}
.t-elegant .cv-hlavni .s-experience .cv-pol::before{display:none}
.t-elegant .cv-gdpr{margin-top:24px;text-align:center}
.t-karty{flex-direction:column;padding:26px}
.t-karty .cv-hlava{display:flex;gap:22px;align-items:center;padding:22px 26px;border-radius:14px;background:color-mix(in srgb,var(--p) 8%,transparent);margin-bottom:16px}
.t-karty .cv-telo{display:flex;gap:16px;align-items:flex-start;flex:1}
.t-karty .cv-bok{width:var(--bw);padding:0}
.t-karty .cv-hlavni{padding:0}
.t-karty .cv-sekce{background:color-mix(in srgb,var(--pz) 60%,#fff);border:1px solid var(--l);border-radius:12px;padding:14px 16px;margin-bottom:14px;
  -webkit-box-decoration-break:clone;box-decoration-break:clone}
.t-karty h2{border:0;padding:0;color:var(--at)}
.t-zahlavi{flex-direction:column}
.t-zahlavi .cv-hlava{background:var(--p);color:#fff;display:flex;gap:24px;align-items:center;padding:28px 34px}
.t-zahlavi .cv-jmeno{color:#fff}
.t-zahlavi .cv-foto{border-color:#fff}
.t-zahlavi .cv-telo{display:flex;flex:1}
.t-zahlavi .cv-bok{background:color-mix(in srgb,var(--p) 80%,#000);padding:26px 22px}
.t-zahlavi .cv-hlavni{padding:26px 32px}
.cv-qr{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:8px;color:var(--m);break-inside:avoid;flex-shrink:0}
.cv-qr-obr{width:var(--qs);height:var(--qs);background:#fff;padding:1mm;border-radius:2mm;color:var(--qr)}
.cv-qr-obr svg{width:100%;height:100%;display:block}
.cv-bok .cv-qr{margin-top:18px}
.cv-uvod{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.cv-uvod > div{min-width:0}
.cv-qr-pata{display:flex;margin-top:6px;break-inside:avoid}
.cv-qr-rada{display:flex;flex-wrap:wrap;gap:12px;margin-top:10px;break-inside:avoid}
.cv-qr-rada .cv-qr-obr{width:${QR_MALY}mm;height:${QR_MALY}mm;padding:.6mm}
.tmavy-bok .cv-bok .cv-qr,.t-kompakt .cv-hlava .cv-qr,.t-moderni .cv-hlava .cv-qr,.t-zahlavi .cv-hlava .cv-qr{color:rgba(255,255,255,.75)}
.cv-dopis{display:block;padding:42px 58px}
.cv-dopis .cv-hlava{display:flex;gap:20px;align-items:center;border-bottom:3px solid var(--a);padding-bottom:14px;margin-bottom:30px}
.cv-dopis .cv-hlava-text{flex:1;min-width:0}
.cv-dopis .cv-cara{margin:8px 0}
.cv-dopis .cv-pozice{margin-bottom:8px}
.d-telo{overflow-wrap:anywhere}
.d-adresat{white-space:pre-line;margin-bottom:24px;line-height:1.5}
.d-misto{text-align:right;margin-bottom:20px;color:var(--m)}
.d-predmet{font-weight:700;color:var(--p);margin-bottom:16px;font-size:1.08em}
.cv-dopis .d-text{font-size:1.08em;line-height:1.65;text-align:justify;color:var(--t)}
.cv-dopis .d-text p{margin-bottom:.75em}
.d-pozdrav{margin-top:24px}
.d-podpis{margin-top:30px;font-weight:700;color:var(--p)}
.cv-vizitky-obal{width:210mm}
.cv.cv-vizitky{display:grid;grid-template-columns:repeat(2,85mm);grid-auto-rows:55mm;justify-content:center;align-content:center;
  height:297mm;min-height:0;background:#fff !important}
.cv-vizitky + .cv-vizitky{break-before:page}
.vz-karta{position:relative;display:flex;gap:4mm;align-items:center;padding:5mm 5mm 5mm 6mm;overflow:hidden;background:#fff;break-inside:avoid}
.vz-znacky{outline:.15mm dashed #cbd5e1}
.vz-text{flex:1;min-width:0;overflow-wrap:anywhere}
.vz-jmeno{font-size:15pt;font-weight:800;color:var(--p);line-height:1.1}
.vz-pozice{font-size:7.5pt;color:var(--at);letter-spacing:1px;text-transform:uppercase;margin:1.5mm 0 3mm}
.vz-k{font-size:7.5pt;color:var(--t);line-height:1.5}
.vz-qr{width:24mm;height:24mm;flex-shrink:0;color:var(--qr)}
.vz-qr svg{width:100%;height:100%;display:block}
.vz-foto{width:16mm;height:16mm;border-radius:50%;object-fit:cover;flex-shrink:0;border:.6mm solid var(--a)}
.vz-r-qr{border-left:2.5mm solid var(--p)}
.vz-r-pas{padding-top:17mm;align-items:flex-start}
.vz-r-pas .vz-jmeno{position:absolute;left:0;right:0;top:0;height:13mm;display:flex;align-items:center;padding:0 6mm;background:var(--p);color:#fff;font-size:13pt}
.vz-r-pas .vz-pozice{margin-top:0}
.vz-r-pas .vz-qr{width:22mm;height:22mm;align-self:center}
.vz-r-pas .vz-foto{align-self:center}
.vz-r-tmava{background:var(--p);--at:var(--an)}
.vz-r-tmava .vz-jmeno{color:#fff}
.vz-r-tmava .vz-k{color:rgba(255,255,255,.85)}
.vz-r-tmava .vz-qr{background:#fff;padding:1mm;border-radius:1.5mm}
.vz-r-tmava .vz-foto{border-color:#fff}
.vz-r-stred{flex-direction:column;justify-content:center;text-align:center;gap:1.5mm;padding:4mm 6mm}
.vz-r-stred .vz-text{flex:none}
.vz-r-stred .vz-jmeno{font-size:14pt}
.vz-r-stred .vz-pozice{margin:1mm 0 1.5mm}
.vz-r-stred .vz-qr{width:13mm;height:13mm}
.vz-r-stred .vz-foto{display:none}
.vz-r-stred::before{content:'';position:absolute;left:50%;top:0;width:24mm;height:1.2mm;margin-left:-12mm;background:var(--a)}
.vz-rub-barva{background:var(--p);flex-direction:column;justify-content:center;text-align:center;gap:0;--at:var(--an)}
.vz-rub-barva .vz-jmeno{color:#fff;font-size:17pt}
.vz-rub-barva .vz-pozice{margin:2mm 0 0}
.vz-rub-qr{flex-direction:column;justify-content:center;gap:1.5mm;font-size:7pt;color:var(--m)}
.vz-rub-qr .vz-qr{width:32mm;height:32mm}
`;

  const CVJ = { SEKCE, ROZLOZENI, GDPR_TEXT, NASTAVENI, POLOZKY, TEMATA, SABLONY, PAPIRY, papir, CSS_TISK, kontrast, citelna, nahodneTema, kontrola, JAZYKY, nadpisSekce, text, TVARY_FOTKY, vcard, qrObsah, qrMisto, kontrolaDopisu, mezinarodni, kostraDopisu, vykresliVizitky, kontrolaVizitek, qrVizitky, VIZITKA_ROZVRZENI, qrSvgSoubor, QR_TYPY, QR_MISTA, vykresliDopis, textDopisu, vychozi, normalizuj, normalizujRozlozeni,
    doJSON, zJSON, esc, md, pozadiTisku, odkaz, ikonaOdkazu, jmenoSouboru, vykresli, CSS };
  g.CVJ = CVJ;
  if (typeof module !== 'undefined' && module.exports) module.exports = CVJ;
})(typeof window !== 'undefined' ? window : globalThis);
