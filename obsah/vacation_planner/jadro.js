/* Planovac dovolene - cista logika bez DOM (testy: _test/vacation_planner_jadro.js).
   Plan: { id, name, icon, startDate, endDate (ISO), days: {'day-i', 'day-move-i'}, nights: {'night-<pole>-i'},
           mergedNights: {start: pocet}, geo: {dotaz: [lat, lon, popis?] | null}, costs: [{name, amount, paid}],
           packing: [{t, done}], persons } */
(function (root) {
  const pad = n => String(n).padStart(2, '0');

  // Datum vzdy v mistnim case - new Date('2027-07-01') by bylo UTC a jinde ve svete posunulo den
  function parseISO(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function toISO(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function addDays(iso, n) {
    const d = parseISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  }

  // Pocet dni z a do b (round kvuli zmene letniho casu)
  function dayDiff(a, b) {
    return Math.round((parseISO(b) - parseISO(a)) / 864e5);
  }

  // Novy rozsah dovolene - texty zustanou u svych datumu, co vypadne z rozsahu, vrati se v lost (ISO datumy)
  function remapPlan(plan, start, end) {
    const shift = dayDiff(start, plan.startDate);
    const nDays = dayDiff(start, end) + 1;
    const nNights = nDays - 1;
    const lost = new Set();
    const move = (obj, re, max) => {
      const out = {};
      Object.entries(obj || {}).forEach(([k, v]) => {
        const m = k.match(re);
        if (!m) return;
        const i = +m[2] + shift;
        if (i >= 0 && i < max) out[m[1] + i] = v;
        else if (v) lost.add(addDays(plan.startDate, +m[2]));
      });
      return out;
    };
    const merged = {};
    Object.entries(plan.mergedNights || {}).forEach(([k, size]) => {
      const s = Math.max(+k + shift, 0);
      const e = Math.min(+k + shift + size, nNights);
      if (e - s > 1) merged[s] = e - s;
    });
    return {
      days: move(plan.days, /^(day-(?:move-)?)(\d+)$/, nDays),
      nights: move(plan.nights, /^(night-[a-z]+-)(\d+)$/, nNights),
      mergedNights: merged,
      lost: [...lost].sort()
    };
  }

  // Skupiny noci (slouceni) jako [{start, size}]
  function nightGroups(plan) {
    const n = dayDiff(plan.startDate, plan.endDate);
    const out = [];
    for (let i = 0; i < n; i += (plan.mergedNights || {})[i] || 1) {
      out.push({ start: i, size: Math.min((plan.mergedNights || {})[i] || 1, n - i) });
    }
    return out;
  }

  // ---- Mista na mape ----
  function distanceKm([lat1, lon1], [lat2, lon2]) {
    const rad = Math.PI / 180;
    const a = Math.sin((lat2 - lat1) * rad / 2) ** 2 +
              Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lon2 - lon1) * rad / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(a));
  }

  // Ze shod vybrat tu, ktera dava smysl: prvni (nejvyznamnejsi), pokud lezi do PLAUSIBLE_KM od sousednich
  // zastavek; jinak nejblizsi (vice obci stejneho jmena - Lhota..., nebo ulice nalezena v jinem meste).
  const PLAUSIBLE_KM = 50;

  function nearestKm(c, near) {
    return Math.min(...near.map(n => distanceKm([c.lat, c.lon], n)));
  }

  function pickCandidate(cands, near) {
    if (!cands || !cands.length) return null;
    if (!near || !near.length || nearestKm(cands[0], near) <= PLAUSIBLE_KM) return cands[0];
    return cands.reduce((best, c) => (nearestKm(c, near) < nearestKm(best, near) ? c : best), cands[0]);
  }

  const normName = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  // Kolik ruznych mist (vic nez 15 km od sebe) se jmenuje stejne jako prvni shoda - 0 = jednoznacne
  function sameNameCount(cands) {
    if (!cands || cands.length < 2 || !cands[0].name) return 0;
    const same = cands.filter(c => normName(c.name) === normName(cands[0].name));
    const distinct = [];
    same.forEach(c => { if (!distinct.some(d => distanceKm([d.lat, d.lon], [c.lat, c.lon]) < 15)) distinct.push(c); });
    return distinct.length > 1 ? distinct.length : 0;
  }

  // Umisteni zastavek: nejdriv jednoznacna mista, pak vicekrat existujici nazvy (Pavlov, Lhota...)
  // podle nejblizsich sousedu na trase. queries = dotazy v poradi trasy, cands = {dotaz: shody},
  // known = {dotaz: [lat, lon]} uz umistena. Vraci {dotaz: {c: shoda, unsure, count} | null}.
  function resolvePlaces(queries, cands, known = {}) {
    const pos = { ...known };
    const out = {};
    const nearOf = q => {
      const near = [];
      queries.forEach((x, i) => {
        if (x !== q) return;
        for (let j = i - 1; j >= 0; j--) if (queries[j] !== q && pos[queries[j]]) { near.push(pos[queries[j]]); break; }
        for (let j = i + 1; j < queries.length; j++) if (queries[j] !== q && pos[queries[j]]) { near.push(pos[queries[j]]); break; }
      });
      return near;
    };
    const set = (q, c, unsure, count) => {
      out[q] = c ? { c, unsure, count } : null;
      if (c) pos[q] = [c.lat, c.lon];
    };
    const todo = [...new Set(queries)].filter(q => q in cands);
    todo.filter(q => !sameNameCount(cands[q])).forEach(q => set(q, pickCandidate(cands[q], nearOf(q)), false, 0));
    let rest = todo.filter(q => !(q in out));
    while (rest.length) {
      // Nejdriv ta, ktera uz maji souseda
      const withNear = rest.filter(q => nearOf(q).length);
      if (!withNear.length) {
        // Zadna opora: vybrat shodu, ktera je nejblize ostatnim zastavkam (Pavlov + Mikulov + Lednice lezi u sebe)
        const others = rest.length > 1 ? rest : [];
        let best = null;
        rest.forEach(q => cands[q].forEach(c => {
          const score = others.filter(r => r !== q)
            .reduce((sum, r) => sum + Math.min(...cands[r].map(o => distanceKm([c.lat, c.lon], [o.lat, o.lon]))), 0);
          if (!best || score < best.score) best = { q, c, score };
        }));
        const alone = others.length === 0;
        set(best.q, alone ? cands[best.q][0] : best.c,
            alone || best.score / (others.length - 1) > PLAUSIBLE_KM, sameNameCount(cands[best.q]));
        rest = rest.filter(q => !(q in out));
        continue;
      }
      withNear.forEach(q => {
        const near = nearOf(q);
        const count = sameNameCount(cands[q]);
        const sorted = [...cands[q]].sort((a, b) => nearestKm(a, near) - nearestKm(b, near));
        // Jiste jen, kdyz je nejblizsi shoda blizko trasy a dalsi stejne jmeno je vyrazne dal
        const d1 = nearestKm(sorted[0], near);
        const other = sorted.find(c => normName(c.name) === normName(sorted[0].name) && distanceKm([c.lat, c.lon], [sorted[0].lat, sorted[0].lon]) >= 15);
        const unsure = d1 > PLAUSIBLE_KM || (other && nearestKm(other, near) < 2 * d1 + 20);
        set(q, sorted[0], unsure, count);
      });
      rest = rest.filter(q => !(q in out));
    }
    return out;
  }

  // ---- Nazvy obci v textu (i sklonovane: "v Mikulove", "do Krumlova", "z Pisku") ----
  // Kmeny slova nazvu: cele slovo, bez koncove samohlasky (Brno -> brn), bez vkladneho e (Pisek -> pisk, Hradec -> hradc)
  function wordStems(word) {
    const w = normName(word);
    const out = [w];
    if (w.length > 3 && /[aeiouy]$/.test(w)) out.push(w.slice(0, -1));
    if (w.length > 4 && /e[kc]$/.test(w)) out.push(w.slice(0, -2) + w.slice(-1));
    // Strida souhlasek pred -e/-i: Lhotka -> Lhotce, Praha -> Praze, Polička -> Poličce
    const alt = { k: 'c', h: 'z', g: 'z' };
    out.slice(1).forEach(st => { if (alt[st.slice(-1)]) out.push(st.slice(0, -1) + alt[st.slice(-1)]); });
    return out;
  }

  // Slovo textu odpovida slovu nazvu, kdyz zacina kmenem a zbytek je kratka padova koncovka
  function stemMatch(textWord, stems) {
    let best = 0;
    stems.forEach(st => {
      const rest = textWord.length - st.length;
      if (textWord.startsWith(st) && rest <= (st.length < 5 ? 2 : 3) && st.length > best) best = st.length;
    });
    return best;
  }

  // Rejstrik obci [{name, lat, lon}] podle prvnich dvou pismen
  function indexPlaces(places) {
    const index = new Map();
    places.forEach(p => {
      const words = String(p.name || '').split(/\s+/).filter(Boolean);
      if (!words.length || normName(p.name).replace(/[^a-z]/g, '').length < 3) return;
      const entry = { name: p.name, words: words.map(wordStems), place: p };
      const key = normName(words[0]).slice(0, 2);
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(entry);
    });
    return index;
  }

  // Najde nazvy obci v textu. Nazev musi v textu zacinat velkym pismenem; delsi nazev ma prednost
  // ("Nove Mesto na Morave" pred "Nove Mesto"). Vraci [{name, text, places: [vsechny obce toho jmena]}].
  function findPlaceNames(text, index) {
    const words = [...String(text || '').matchAll(/\p{L}+/gu)].map(m => ({ raw: m[0], n: normName(m[0]) }));
    const found = [];
    for (let i = 0; i < words.length;) {
      const list = /^\p{Lu}/u.test(words[i].raw) ? index.get(words[i].n.slice(0, 2)) || [] : [];
      let best = null;
      list.forEach(e => {
        const k = e.words.length;
        if (i + k > words.length) return;
        let score = 0;
        for (let j = 0; j < k; j++) {
          const m = stemMatch(words[i + j].n, e.words[j]);
          if (!m) return;
          score += m;
        }
        if (!best || k > best.k || (k === best.k && score > best.score)) best = { k, score, e };
      });
      if (!best) { i++; continue; }
      const same = list.filter(e => normName(e.name) === normName(best.e.name)).map(e => e.place);
      found.push({ name: best.e.name, text: words.slice(i, i + best.k).map(w => w.raw).join(' '), places: same });
      i += best.k;
    }
    return found;
  }

  // Casta slova na zacatku vety - obcemi nebyvaji, nehledaji se (setri dotazy)
  const COMMON_WORDS = new Set(('rano dopoledne odpoledne vecer noc obed snidane vecere odjezd prijezd navrat cesta cestou ' +
    'pak potom dale take jeste odtud tam zpet den dnes zitra vylet prohlidka zamek hrad muzeum koupani nakup ' +
    'pondeli utery streda ctvrtek patek sobota nedele mozna kdyz pokud jedeme jdeme uvidime pozor sraz').split(' '));

  function isCommonWord(word) {
    return COMMON_WORDS.has(normName(word));
  }

  // Zacatek slova bez padove koncovky - pro hledani podle zacatku nazvu: "Brna" -> "Brn", "Valtic" -> "Valt"
  function wordPrefix(w) {
    return w.slice(0, Math.max(3, w.length <= 5 ? w.length - 1 : Math.min(w.length - 2, 6)));
  }

  // Muze slovo z textu byt zacatkem nazvu obce? (prvni slovo nazvu, i sklonovane)
  function wordFitsName(word, name) {
    return stemMatch(normName(word), wordStems(String(name).split(/\s+/)[0])) > 0;
  }

  // Regularni vyraz (Overpass) na nazvy zacinajici danymi zacatky - bez ohledu na velikost pismen a diakritiku
  const LETTER_VARIANTS = { a: 'aáä', c: 'cč', d: 'dď', e: 'eéě', i: 'ií', l: 'lľĺ', n: 'nň', o: 'oóö', r: 'rř',
                            s: 'sš', t: 'tť', u: 'uúůü', y: 'yý', z: 'zž' };
  function prefixRegex(prefixes) {
    return [...new Set(prefixes.map(normName))].map(p => [...p].map(ch => {
      if (!/[a-z]/.test(ch)) return '.';
      const v = LETTER_VARIANTS[ch] || ch;
      return '[' + v + v.toUpperCase() + ']';
    }).join('')).join('|');
  }

  // ---- Penize ----
  // "1 200 Kc", "1.800,50", "85,50 EUR" -> cislo; posledni oddelovac je desetinny, pokud za nim nejsou presne 3 cislice
  function parsePrice(text) {
    const num = String(text || '').replace(/[^\d.,-]/g, '');
    if (!/\d/.test(num)) return NaN;
    const sep = Math.max(num.lastIndexOf('.'), num.lastIndexOf(','));
    if (sep < 0 || num.length - sep - 1 === 3) return parseFloat(num.replace(/[.,]/g, ''));
    return parseFloat(num.slice(0, sep).replace(/[.,]/g, '') + '.' + num.slice(sep + 1));
  }

  function priceUnit(text) {
    return String(text || '').replace(/[\d\s.,-]/g, '');
  }

  function budget(plan) {
    const units = new Set();
    const sum = { total: 0, paid: 0, count: 0 };
    const acc = { total: 0, paid: 0, count: 0 };
    const other = { total: 0, paid: 0, count: 0 };
    const add = (target, text, paid) => {
      const v = parsePrice(text);
      if (!Number.isFinite(v)) return;
      [target, sum].forEach(t => { t.total += v; t.count++; if (paid) t.paid += v; });
      const u = priceUnit(text);
      if (u) units.add(u);
    };
    Object.entries(plan.nights || {}).forEach(([k, v]) => {
      const m = k.match(/^night-price-(\d+)$/);
      if (m) add(acc, v, !!(plan.nights[`night-paid-${m[1]}`]));
    });
    (plan.costs || []).forEach(c => add(other, c.amount, c.paid));
    const persons = Math.max(1, Math.floor(plan.persons) || 1);
    return {
      accommodation: acc, other, total: sum.total, paid: sum.paid, remaining: sum.total - sum.paid,
      count: sum.count, persons, perPerson: sum.total / persons,
      unit: units.size === 1 ? [...units][0] : units.size ? null : 'Kc',
      mixed: units.size > 1
    };
  }

  // ---- Ikony ----
  const ICON_RULES = [
    ['🏖️', /\b(mor[eiu]|plaz|pobrez|chorvat|ital|reck|spanel|egypt|bulhar|turec|ostrov|beach)/g],
    ['⛷️', /\b(lyz|sjezd|snowboard|ski)/g],
    ['🏔️', /\b(hor[ayu]?\b|alp|tatr|krkonos|sumav|dolomit|beskyd|jesenik)/g],
    ['🏕️', /\b(kemp|stan[uy]?\b|camp)/g],
    ['🥾', /\b(tur[auy]\b|turistik|trek|pesk|hike)/g],
    ['🚴', /\b(kol[aeou]\b|cykl|bike)/g],
    ['🛶', /\b(vodak|kanoe|kanoi|raft|splav|kajak)/g],
    ['🚢', /\b(plavb|trajekt|lod|cruise)/g],
    ['🏙️', /\b(mest|praha|praz|pariz|londyn|rim\b|rima|viden|vidni|berlin|barcelon|amsterd|city)/g],
    ['🏰', /\b(hrad|zam[e]?k|castle)/g],
    ['🚗', /\b(auto|road.?trip|obytn|karavan)/g],
    ['✈️', /\b(letadl|letist|odlet|prilet|flight)/g],
    ['🌴', /\b(tropi|exot|thaj|bali|karib|dominik|maledi)/g],
    ['🏞️', /\b(jezer|prirod|narodni park|lake)/g],
    ['🧖', /\b(wellnes|lazn|spa\b|termal)/g],
    ['🎢', /\b(zabavni|aquapark|disney)/g],
    ['👨‍👩‍👧', /\b(rodin|deti|babi)/g]
  ];
  const SEASON_ICONS = ['❄️', '🌷', '☀️', '🍂'];  // zima, jaro, leto, podzim
  const ICON_CHOICES = [...new Set([...ICON_RULES.map(r => r[0]), ...SEASON_ICONS,
    '🧳', '🎒', '🏝️', '🗺️', '🍷', '🎭', '⚽', '🐚', '❤️', '⭐'])];

  function autoIcon(plan) {
    const text = [plan.name, ...Object.values(plan.days || {}), ...Object.values(plan.nights || {})].join(' ')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    let best = '', bestCount = 0;
    ICON_RULES.forEach(([icon, re]) => {
      const count = (text.match(re) || []).length;
      if (count > bestCount) { best = icon; bestCount = count; }
    });
    if (best) return best;
    const month = (plan.startDate ? parseISO(plan.startDate) : new Date()).getMonth();
    return SEASON_ICONS[Math.floor(((month + 1) % 12) / 3)];
  }

  // ---- Seznam veci ----
  const PACKING_BASE = ['Obcansky prukaz / pas', 'Ridicak a doklady od auta', 'Karticka pojistence', 'Cestovni pojisteni',
    'Penize a platebni karta', 'Rezervace ubytovani', 'Telefon a nabijecka', 'Powerbanka', 'Leky a lekarnicka',
    'Bryle / slunecni bryle', 'Obleceni na kazdy den', 'Spodni pradlo a ponozky', 'Bunda do deste',
    'Pohodlne boty', 'Plavky a rucnik', 'Hygiena (kartacek, pasta, sampon)', 'Opalovaci krem', 'Repelent',
    'Lahev na vodu', 'Svacina na cestu', 'Mapa / offline mapy v telefonu', 'Klice od domu'];

  // ---- Data z ciziho odkazu nebo souboru - nechat jen ocekavane hodnoty spravneho typu ----
  function cleanPlan(raw) {
    const isoDate = /^\d{4}-\d{2}-\d{2}$/;
    if (!raw || !isoDate.test(raw.startDate) || !isoDate.test(raw.endDate)) throw new Error('chybi datumy');
    if (dayDiff(raw.startDate, raw.endDate) < 0 || dayDiff(raw.startDate, raw.endDate) > 366) throw new Error('spatny rozsah');
    const str = (v, max) => typeof v === 'string' ? v.slice(0, max) : '';
    const texts = (obj, re) => {
      const out = {};
      Object.entries(obj || {}).forEach(([k, v]) => { if (re.test(k) && typeof v === 'string') out[k] = v; });
      return out;
    };
    const merged = {};
    Object.entries(raw.mergedNights || {}).forEach(([k, v]) => {
      if (/^\d+$/.test(k) && Number.isInteger(v) && v > 1) merged[k] = v;
    });
    const geo = {};
    Object.entries(raw.geo || {}).forEach(([k, v]) => {
      if (v === null) geo[k.slice(0, 300)] = null;
      else if (Array.isArray(v) && (v.length === 2 || v.length === 3) && Number.isFinite(v[0]) && Number.isFinite(v[1])) {
        geo[k.slice(0, 300)] = typeof v[2] === 'string' ? [v[0], v[1], v[2].slice(0, 200)] : [v[0], v[1]];
      }
    });
    const list = (arr, max, fn) => (Array.isArray(arr) ? arr : []).filter(x => x && typeof x === 'object').slice(0, max).map(fn);
    return {
      id: /^p[a-z0-9]{4,20}$/.test(raw.id) ? raw.id : '',
      name: str(raw.name, 200),
      icon: ICON_CHOICES.includes(raw.icon) ? raw.icon : '',
      startDate: raw.startDate,
      endDate: raw.endDate,
      days: texts(raw.days, /^day-(move-)?\d+$/),
      nights: texts(raw.nights, /^night-(name|street|city|price|paid|notes)-\d+$/),
      mergedNights: merged,
      geo,
      costs: list(raw.costs, 200, c => ({ name: str(c.name, 200), amount: str(c.amount, 50), paid: !!c.paid })),
      packing: list(raw.packing, 500, p => ({ t: str(p.t, 200), done: !!p.done })),
      hiddenPlaces: (Array.isArray(raw.hiddenPlaces) ? raw.hiddenPlaces : []).filter(x => typeof x === 'string').slice(0, 500).map(x => x.slice(0, 100)),
      persons: Number.isInteger(raw.persons) && raw.persons > 0 && raw.persons < 100 ? raw.persons : 1,
      axisOffset: Number.isFinite(raw.axisOffset) ? raw.axisOffset : undefined
    };
  }

  // ---- Export do kalendare (iCalendar, RFC 5545) ----
  function icsText(s) {
    return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  }

  // Radky delsi nez 75 bajtu se zalamuji (pokracovani zacina mezerou), nikdy uprostred znaku
  function icsFold(line) {
    const enc = new TextEncoder();
    const out = [];
    let cur = '', bytes = 0;
    for (const ch of line) {
      const b = enc.encode(ch).length;
      if (bytes + b > (out.length ? 74 : 75)) {
        out.push(cur);
        cur = '';
        bytes = 0;
      }
      cur += ch;
      bytes += b;
    }
    out.push(cur);
    return out.join('\r\n ');
  }

  function buildIcs(plan, now = new Date()) {
    const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const day = iso => iso.replace(/-/g, '');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//lavionus//Planovac dovolene//CS', 'CALSCALE:GREGORIAN'];
    let n = 0;
    const event = (from, toExcl, summary, location, desc) => {
      lines.push('BEGIN:VEVENT', `UID:${plan.id || 'plan'}-${n++}@planovac-dovolene`, `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${day(from)}`, `DTEND;VALUE=DATE:${day(toExcl)}`, `SUMMARY:${icsText(summary)}`);
      if (location) lines.push(`LOCATION:${icsText(location)}`);
      if (desc) lines.push(`DESCRIPTION:${icsText(desc)}`);
      lines.push('TRANSP:TRANSPARENT', 'END:VEVENT');
    };
    const N = plan.nights || {}, D = plan.days || {};
    event(plan.startDate, addDays(plan.endDate, 1), `${plan.icon || autoIcon(plan)} ${plan.name || 'Dovolena'}`);
    nightGroups(plan).forEach(({ start, size }) => {
      const f = k => (N[`night-${k}-${start}`] || '').trim();
      if (!f('name') && !f('street') && !f('city')) return;
      const desc = [f('price') && `Cena: ${f('price')}${f('paid') ? ' (zaplaceno)' : ''}`, f('notes')].filter(Boolean).join('\n');
      event(addDays(plan.startDate, start), addDays(plan.startDate, start + size),
        `🌙 ${f('name') || f('city')}`, [f('street'), f('city')].filter(Boolean).join(', '), desc);
    });
    const nDays = dayDiff(plan.startDate, plan.endDate) + 1;
    for (let d = 0; d < nDays; d++) {
      const notes = (D[`day-${d}`] || '').trim(), move = (D[`day-move-${d}`] || '').trim();
      if (!notes && !move) continue;
      const iso = addDays(plan.startDate, d);
      event(iso, addDays(iso, 1), move ? `🚗 Presun: ${move}` : `📝 ${notes.split('\n')[0].slice(0, 60)}`, move, notes);
    }
    lines.push('END:VCALENDAR');
    return lines.map(icsFold).join('\r\n') + '\r\n';
  }

  const api = { isCommonWord, wordFitsName, wordPrefix, prefixRegex, indexPlaces, findPlaceNames, normName, sameNameCount, resolvePlaces, distanceKm, nearestKm, PLAUSIBLE_KM, pickCandidate, parseISO, toISO, addDays, dayDiff, remapPlan, nightGroups, parsePrice, priceUnit, budget,
                ICON_RULES, SEASON_ICONS, ICON_CHOICES, autoIcon, PACKING_BASE, cleanPlan, buildIcs, icsFold };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VP = api;
})(this);
