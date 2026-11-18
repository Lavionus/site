/* Časová osa případu – jádro bez DOM (test: _test/case_timeline_test.js).
   Záznam: čas (bod nebo rozsah od–do, nejistota ± min), typ, osoby, místo, zdroj (druh, popis,
   číslo stopy z evidenčního deníku) a míra jistoty. Řazení, rozpory (dvě místa téže osoby ve
   stejném čase, tvrzení proti ověřenému záznamu), rozvržení plaveckých drah, převody formátů
   (JSON starý i nový, CSV, Evidenční deník, Časová analýza, modelový případ 17/2026).
   Časy jsou „místní bez pásma“ jako v <input type="datetime-local"> (YYYY-MM-DDTHH:MM[:SS]);
   pro výpočty se berou jako UTC, takže rozdíly sedí (kromě noci přechodu letního času). */
(function () {
  'use strict';

  const TYPY = {
    udalost: { nazev: 'Událost', ikona: '📌' },
    dukaz: { nazev: 'Důkaz', ikona: '🔎' },
    svedek: { nazev: 'Výpověď / svědek', ikona: '🗣️' },
    poloha: { nazev: 'Poloha / pobyt', ikona: '📍' },
    komunikace: { nazev: 'Komunikace', ikona: '📞' }
  };
  const JISTOTY = {
    overeno: { nazev: 'Ověřeno', ikona: '✔', popis: 'potvrzeno objektivním zdrojem (záznam, výpis, stopa)' },
    pravdepodobne: { nazev: 'Pravděpodobné', ikona: '◐', popis: 'odvozeno nebo doloženo nepřímo, čeká na ověření' },
    tvrzeni: { nazev: 'Tvrzení – nepotvrzeno', ikona: '?', popis: 'jen výpověď nebo oznámení, bez nezávislého potvrzení' }
  };
  const ZDROJE = {
    '': '—', kamera: 'Kamera / videozáznam', vypis: 'Výpis provozních údajů', vypoved: 'Výpověď / oznámení',
    poloha: 'Polohová historie', stopa: 'Stopa z evidenčního deníku', cidlo: 'Čidlo / technický systém',
    ohledani: 'Ohledání / úřední záznam', listina: 'Listina / dokument', jiny: 'Jiný zdroj'
  };
  // výchozí jistota podle typu (starší data bez jistoty, modelový případ)
  const jistotaZTypu = typ => typ === 'svedek' ? 'tvrzeni' : typ === 'dukaz' || typ === 'komunikace' ? 'overeno' : 'pravdepodobne';

  const str = (s, n) => String(s == null ? '' : s).trim().slice(0, n);
  let citac = 0;
  const novyId = () => Date.now().toString(36) + (citac++).toString(36) + Math.random().toString(36).slice(2, 6);
  function cas(s) {
    s = String(s || '').trim().replace(' ', 'T');
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += 'T00:00';
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s) && isFinite(Date.parse(s + 'Z')) ? s : '';
  }
  const ms = s => s ? Date.parse(s + 'Z') : NaN;
  const dvoj = n => String(n).padStart(2, '0');
  const naCas = t => { const d = new Date(t); return d.getUTCFullYear() + '-' + dvoj(d.getUTCMonth() + 1) + '-' + dvoj(d.getUTCDate()) + 'T' + dvoj(d.getUTCHours()) + ':' + dvoj(d.getUTCMinutes()); };

  function normalizuj(o) {
    o = o && typeof o === 'object' ? o : {};
    const type = TYPY[o.type] ? o.type : 'udalost';
    let osoby = Array.isArray(o.osoby) ? o.osoby : typeof o.osoby === 'string' ? o.osoby.split(/[,;]/) : [];
    osoby = [...new Set(osoby.map(x => str(x, 80)).filter(Boolean))].slice(0, 20);
    const time = cas(o.time), end = cas(o.end);
    const z = {
      id: str(o.id, 120) || novyId(), time, end: time && end && ms(end) > ms(time) ? end : '',
      tol: Math.min(10080, Math.max(0, Math.round(+o.tol || 0))), type, osoby,
      misto: str(o.misto, 200), zdroj: Object.prototype.hasOwnProperty.call(ZDROJE, o.zdroj) ? o.zdroj : '',
      zdrojText: str(o.zdrojText, 300), stopa: str(o.stopa, 40),
      jistota: JISTOTY[o.jistota] ? o.jistota : jistotaZTypu(type), desc: String(o.desc == null ? '' : o.desc).slice(0, 4000)
    };
    if (isFinite(+o.lat) && isFinite(+o.lon) && o.lat !== null && o.lat !== '' && o.lon !== null && o.lon !== '') { z.lat = +o.lat; z.lon = +o.lon; }
    return z;
  }

  // localStorage (pole) i export {case, items} – starý (bez formátu) i nový
  function nacti(data) {
    const pole = Array.isArray(data) ? data : data && Array.isArray(data.items) ? data.items : null;
    if (!pole) throw new Error('Soubor neobsahuje záznamy časové osy (čekám {case, items}).');
    return { case: data && typeof data.case === 'string' ? data.case : '', items: pole.filter(x => x && typeof x === 'object').map(normalizuj) };
  }
  const exportJson = (nazev, items) => JSON.stringify({ format: 'case_timeline', verze: 2, case: nazev || '', items }, null, 2);

  // sloučení podle id – opakovaný import záznam nahradí, nezdvojí
  function slouc(items, nove) {
    const out = items.slice(), idx = new Map(out.map((x, i) => [x.id, i]));
    let pridano = 0, nahrazeno = 0;
    for (const n of nove) {
      if (idx.has(n.id)) { out[idx.get(n.id)] = n; nahrazeno++; } else { idx.set(n.id, out.length); out.push(n); pridano++; }
    }
    return { items: out, pridano, nahrazeno };
  }

  // stejná skutečnost už na ose z jiného zdroje (typ, čas na minutu, aspoň jedna společná osoba) – import ji přeskočí
  function bezDuplicit(items, nove) {
    const ids = new Set(items.map(x => x.id));
    const out = nove.filter(n => ids.has(n.id) || !n.time || !items.some(x => x.type === n.type && x.time.slice(0, 16) === n.time.slice(0, 16)
      && (x.osoby.length || n.osoby.length ? x.osoby.some(o => n.osoby.includes(o)) : true)));
    return { nove: out, preskoceno: nove.length - out.length };
  }

  function interval(it) {
    if (!it.time) return null;
    const t = ms(it.time), k = it.end ? ms(it.end) : t, d = (it.tol || 0) * 60000;
    return { od: t - d, do: k + d };
  }
  // chronologicky; záznamy bez času na konec, při shodě rozsah před bodem a pak podle vložení
  function serad(items) {
    return items.map((x, i) => [x, i]).sort((a, b) => {
      const ta = a[0].time ? ms(a[0].time) : Infinity, tb = b[0].time ? ms(b[0].time) : Infinity;
      return ta - tb || (b[0].end ? 1 : 0) - (a[0].end ? 1 : 0) || a[1] - b[1];
    }).map(x => x[0]);
  }

  /* ---------- rozpory ---------- */
  function vzdalenost(a, b) {
    const R = 6371008.8, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  }
  const normText = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  // stejné místo: souřadnice do 300 m, jinak text (bez diakritiky; jeden obsahuje druhý)
  function stejneMisto(a, b, prah) {
    if (a.lat != null && b.lat != null) return vzdalenost(a, b) <= (prah || 300);
    const x = normText(a.misto), y = normText(b.misto);
    if (!x || !y) return true;   // bez místa nelze rozhodnout – nehlásit
    return x === y || (Math.min(x.length, y.length) >= 3 && (x.includes(y) || y.includes(x)));
  }
  // dvojice záznamů téže osoby, které se časově překrývají (vč. nejistoty) a mají různé místo
  function rozpory(items) {
    const s = items.filter(it => it.time && it.osoby.length && (it.misto || it.lat != null)).map(it => ({ it, I: interval(it) }));
    const out = [];
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) {
      const a = s[i], b = s[j];
      const osoby = a.it.osoby.filter(o => b.it.osoby.includes(o));
      if (!osoby.length || a.I.od > b.I.do || b.I.od > a.I.do || stejneMisto(a.it, b.it)) continue;
      const tvA = a.it.jistota === 'tvrzeni', tvB = b.it.jistota === 'tvrzeni';
      const druh = tvA !== tvB ? 'tvrzeni' : 'poloha';
      const [p, q] = tvB && !tvA ? [b.it, a.it] : [a.it, b.it];   // u „tvrzení“ jde tvrzení první
      const text = druh === 'tvrzeni'
        ? `${osoby.join(', ')}: tvrzení „${p.misto}“ odporuje záznamu „${q.misto}“ (${JISTOTY[q.jistota].nazev.toLowerCase()})`
        : `${osoby.join(', ')}: ve stejném čase na dvou místech – „${p.misto}“ × „${q.misto}“` + (tvA && tvB ? ' (dvě tvrzení)' : ' – prověřit zdroje (posun hodin, cizí zařízení, chyba zápisu)');
      out.push({ a: p.id, b: q.id, druh, osoby, od: Math.max(a.I.od, b.I.od), do: Math.min(a.I.do, b.I.do), text });
    }
    return out.sort((x, y) => x.od - y.od);
  }
  const idsRozporu = r => new Set(r.flatMap(x => [x.a, x.b]));

  /* ---------- plavecké dráhy ---------- */
  // dráha na osobu (v pořadí prvního výskytu), záznamy bez osoby ve společné dráze (osoba '')
  function drahy(items) {
    const ser = serad(items).filter(it => it.time), os = [];
    for (const it of ser) for (const o of it.osoby) if (!os.includes(o)) os.push(o);
    const d = os.map(o => ({ osoba: o, polozky: ser.filter(it => it.osoby.includes(o)) }));
    const bez = ser.filter(it => !it.osoby.length);
    if (bez.length || !d.length) d.push({ osoba: '', polozky: bez });
    return d;
  }
  // celý rozsah s okrajem 4 % (aspoň 10 min); jediný bod → ±1 h
  function rozsah(items) {
    let od = Infinity, dO = -Infinity;
    for (const it of items) { const I = interval(it); if (!I) continue; od = Math.min(od, I.od); dO = Math.max(dO, I.do); }
    if (!isFinite(od)) return null;
    if (dO - od < 60000) return { od: od - 3600000, do: dO + 3600000 };
    const okraj = Math.max(600000, (dO - od) * 0.04);
    return { od: od - okraj, do: dO + okraj };
  }
  // vodorovné pozice v px a řádky v dráze bez překryvu (hladově); minSirka = místo pro značku a popisek
  function rozvrhni(polozky, pohled, sirka, minSirka) {
    const k = sirka / (pohled.do - pohled.od), konce = [], out = [];
    const s = polozky.map(it => ({ it, I: interval(it) })).filter(x => x.I).sort((a, b) => a.I.od - b.I.od);
    for (const { it, I } of s) {
      const x = (I.od - pohled.od) * k, w = (I.do - I.od) * k;
      if (x + Math.max(w, 8) < 0 || x > sirka) continue;   // mimo výřez
      const obs = Math.max(w, minSirka || 0);
      let r = konce.findIndex(e => e <= x);
      if (r < 0) { r = konce.length; konce.push(0); }
      konce[r] = x + obs + 4;
      out.push({ id: it.id, x, w, radek: r });
    }
    return { polozky: out, radku: Math.max(1, konce.length) };
  }
  // značky osy: krok z „hezké“ řady, aby jich bylo nejvýš `cil`
  const KROKY = [1, 2, 5, 10, 15, 30, 60, 120, 180, 360, 720, 1440, 2880, 10080, 20160, 43200].map(m => m * 60000);
  function znacky(od, dO, cil) {
    const krok = KROKY.find(k => (dO - od) / k <= (cil || 8)) || KROKY[KROKY.length - 1];
    const out = [];
    let predDen = '';
    for (let t = Math.ceil(od / krok) * krok; t <= dO; t += krok) {
      const c = naCas(t), den = c.slice(0, 10), hm = c.slice(11, 16);
      const d = new Date(t), datum = d.getUTCDate() + '. ' + (d.getUTCMonth() + 1) + '.';
      out.push({ t, popis: krok >= 86400000 ? datum : den !== predDen ? datum + ' ' + hm : hm });
      predDen = den;
    }
    return out;
  }
  // zoom kolem bodu `stred` (faktor < 1 přiblíží), nejmenší výřez 5 minut
  function zoom(p, faktor, stred) {
    const s = stred == null ? (p.od + p.do) / 2 : stred, sir = Math.max(300000, (p.do - p.od) * faktor);
    const pod = (s - p.od) / (p.do - p.od);
    return { od: s - sir * pod, do: s + sir * (1 - pod) };
  }

  /* ---------- formátování ---------- */
  function formatCas(s, jenCas) {
    if (!s) return '(bez času)';
    const d = new Date(ms(s)), hm = dvoj(d.getUTCHours()) + ':' + dvoj(d.getUTCMinutes()) + (s.length > 16 ? ':' + dvoj(d.getUTCSeconds()) : '');
    return jenCas ? hm : d.getUTCDate() + '. ' + (d.getUTCMonth() + 1) + '. ' + d.getUTCFullYear() + ' ' + hm;
  }
  function formatKdy(it) {
    let t = formatCas(it.time);
    if (it.time && it.end) t += ' – ' + formatCas(it.end, it.end.slice(0, 10) === it.time.slice(0, 10));
    if (it.time && it.tol) t += ' (±' + (it.tol >= 120 && it.tol % 60 === 0 ? it.tol / 60 + ' h' : it.tol + ' min') + ')';
    return t;
  }
  const popisZdroje = it => [it.zdroj ? ZDROJE[it.zdroj] : '', it.stopa ? 'stopa ' + it.stopa : '', it.zdrojText].filter(Boolean).join(' · ');

  // CSV injection (OWASP): buňku začínající = + - @ tab CR (i za apostrofy) prefixovat apostrofem, čísla ne
  const bezVzorce = s => (/^'*[=+\-@\t\r]/.test(s) && !/^[+-]?\d+([.,]\d+)?$/.test(s) ? "'" + s : s);
  function exportCsv(items) {
    const q = v => '"' + bezVzorce(String(v == null ? '' : v)).replace(/"/g, '""') + '"';
    const hl = ['id', 'začátek', 'konec', 'nejistota ± min', 'typ', 'osoby', 'místo', 'zdroj', 'popis zdroje', 'číslo stopy', 'jistota', 'popis', 'v rozporu'];
    const roz = idsRozporu(rozpory(items));
    const radky = serad(items).map(it => [it.id, it.time, it.end, it.tol || '', TYPY[it.type].nazev, it.osoby.join(', '), it.misto,
      it.zdroj ? ZDROJE[it.zdroj] : '', it.zdrojText, it.stopa, JISTOTY[it.jistota].nazev, it.desc, roz.has(it.id) ? 'ano' : ''].map(q).join(';'));
    return [hl.map(q).join(';')].concat(radky).join('\r\n');
  }

  /* ---------- importy z jiných nástrojů ---------- */
  // Evidenční deník (localStorage 'vysetrovani_evidence'): čte jen time, num, desc, place
  function zEvidence(pole) {
    return (Array.isArray(pole) ? pole : []).filter(e => e && typeof e === 'object' && (e.desc || e.num)).map(e => normalizuj({
      id: 'ev:' + str(e.num || e.id || e.desc, 60), time: e.time, type: 'dukaz', jistota: 'overeno', zdroj: 'stopa', stopa: str(e.num, 40),
      misto: str(e.place, 200), desc: 'Zajištění stopy' + (e.num ? ' ' + e.num : '') + ': ' + str(e.desc, 3000)
    }));
  }

  // Časová analýza (IndexedDB Časové analýzy): pobyty osob, komunikace, ručně zapsané a ⭐ záznamy
  function zCasoveAnalyzy(p, CA, tz, volby) {
    volby = Object.assign({ pobyty: true, komunikace: true, dulezite: true, vzd: 150, min: 10 }, volby);
    tz = tz || CA.TZ_VYCHOZI;
    const loc = t => CA.isoCas(t, tz).slice(0, 16), pref = 'ca:' + p.id + ':', osoby = CA.osoby(p);
    const zdroje = Object.fromEntries(p.zdroje.map(z => [z.id, z])), out = [];
    const nazevMista = (lat, lon) => {
      let best = null, bd = Infinity;
      for (const m of p.mista || []) { const d = CA.vzdalenost({ lat, lon }, m); if (d <= m.R && d < bd) { bd = d; best = m; } }
      return best ? best.nazev : lat.toFixed(5) + ', ' + lon.toFixed(5);
    };
    if (volby.pobyty) for (const os of osoby) {
      for (const s of CA.pobyty(CA.bodyOsoby(p, os, true), { vzd: volby.vzd, min: volby.min })) {
        const misto = nazevMista(s.lat, s.lon);
        out.push(normalizuj({
          id: pref + 'pobyt:' + os + ':' + s.od, time: loc(s.od), end: loc(s.do), type: 'poloha', osoby: [os], misto, lat: s.lat, lon: s.lon,
          zdroj: 'poloha', jistota: 'pravdepodobne', desc: 'Pobyt: ' + misto + ' (' + s.n + ' polohových bodů' + (s.mezera ? ', s mezerou v datech' : '') + ')',
          zdrojText: 'Časová analýza „' + p.nazev + '“ – pobyt ≥ ' + volby.min + ' min v okruhu ' + volby.vzd + ' m'
        }));
      }
    }
    for (const r of p.zaznamy) {
      const z = zdroje[r.zdroj] || {}, zt = 'Časová analýza „' + p.nazev + '“ – ' + (z.nazev || 'zdroj');
      if (z.skryty) continue;
      if (CA.KOMUNIKACE[r.typ]) {
        if (!volby.komunikace) continue;
        const druh = r.typ === 'hovor' ? 'Hovor' : r.typ === 'sms' ? 'SMS' : 'Datové spojení';
        const protistrana = r.popis || r.protistrana;
        const os = [z.osoba].concat(osoby.includes(r.popis) && r.popis !== z.osoba ? [r.popis] : []);
        out.push(normalizuj({
          id: pref + r.id, time: loc(r.t), type: 'komunikace', osoby: os, zdroj: 'vypis', jistota: 'overeno', zdrojText: zt,
          desc: druh + (r.smer === 'out' ? ' ' + z.osoba + ' → ' : r.smer === 'in' ? ' ' + z.osoba + ' ← ' : ' – ') + (protistrana || '?') + (r.trvani ? ' (' + r.trvani + ' s)' : '')
        }));
      } else if (volby.dulezite && (r.dulezite || z.format === 'ruční')) {
        const vyp = /výpověď|vypověděl|tvrdí/i.test(r.popis);
        out.push(normalizuj({
          id: pref + r.id, time: loc(r.t), end: r.k != null ? loc(r.k) : '', type: vyp ? 'svedek' : 'udalost', osoby: z.osoba ? [z.osoba] : [],
          misto: r.lat != null ? nazevMista(r.lat, r.lon) : '', lat: r.lat, lon: r.lon,
          zdroj: vyp ? 'vypoved' : 'jiny', jistota: vyp ? 'tvrzeni' : 'pravdepodobne', zdrojText: zt, desc: r.popis || TYPY.udalost.nazev
        }));
      }
    }
    return out;
  }

  // modelový případ 17/2026: osoby podle příjmení v textu, zdroj a jistota z textu a typu
  // (volitelná pole události osoby/do/misto/zdroj/jistota/nejistota v pripad.js mají přednost)
  function zModelovehoPripadu(P) {
    const kmeny = (P.osoby || []).map(o => { const pr = o.jmeno.split(' ').pop(); return [o.jmeno, pr.slice(0, Math.max(4, pr.length - 2))]; });
    return (P.udalosti || []).map((u, i) => {
      const t = u.text || '';
      const osoby = Array.isArray(u.osoby) ? u.osoby.map(id => ((P.osoby || []).find(o => o.id === id) || { jmeno: id }).jmeno)
        : kmeny.filter(([, k]) => t.includes(k)).map(([j]) => j);
      const st = /stopa č\. (\d+)/.exec(t);
      const zdroj = u.zdroj || (/kamera/i.test(t) ? 'kamera' : /polohov/i.test(t) ? 'poloha' : /hovor|výpis/i.test(t) ? 'vypis' : /čidlo/i.test(t) ? 'cidlo'
        : /ohledání|zajištěny/i.test(t) ? 'ohledani' : u.typ === 'svedek' ? 'vypoved' : '');
      const typ = u.typ === 'udalost' && /^Hovor/.test(t) ? 'komunikace' : u.typ;
      return normalizuj({
        id: 'mp' + i, time: u.kdy, end: u.do, tol: u.nejistota, type: typ, osoby, misto: u.misto, zdroj, stopa: st ? 'D-0' + st[1] : '',
        jistota: u.jistota || (u.typ === 'svedek' ? 'tvrzeni' : zdroj ? 'overeno' : 'pravdepodobne'), desc: t
      });
    });
  }

  /* ---------- jednotný spis (S2): záznam osy ↔ entita `udalost` ----------
     time↔kdy (ve spisu povinné), end↔do, tol↔nejistota, type↔druh (poloha/komunikace = druh udalost + typOsy),
     jistota, osoby (jména)↔osoby (id entit `osoba`), misto (název)↔misto (id entity `misto`), desc↔popis (název = zkrácený
     popis), zdroj+zdrojText+stopa → zdrojDruh/zdrojText/stopa a čitelný text zdroj. Neznámá pole spisu se zachovají. */
  const DRUHY_SPISU = ['udalost', 'dukaz', 'svedek'];
  const zkrat = t => { t = String(t || '').trim(); return t.length > 90 ? t.slice(0, 88).replace(/\s+\S*$/, '') + '…' : t; };
  // jmeno(id) → název entity nebo ''
  function zeSpisu(e, jmeno) {
    const d = (e && e.data) || {}, jm = jmeno || (() => '');
    let zdroj = '', zdrojText = '';
    if ('zdrojDruh' in d || 'zdrojText' in d) { zdroj = d.zdrojDruh || ''; zdrojText = d.zdrojText || ''; }
    else if (d.zdroj && Object.prototype.hasOwnProperty.call(ZDROJE, d.zdroj)) zdroj = d.zdroj;
    else zdrojText = d.zdroj || '';
    return normalizuj({
      id: e.id, time: d.kdy, end: d.do, tol: d.nejistota, type: TYPY[d.typOsy] ? d.typOsy : d.druh,
      osoby: (Array.isArray(d.osoby) ? d.osoby : []).map(jm).filter(Boolean), misto: d.misto ? jm(d.misto) : '',
      lat: d.lat, lon: d.lon, zdroj, zdrojText, stopa: d.stopa, jistota: d.jistota, desc: d.popis || e.nazev
    });
  }
  // stopa spisu na ose jako důkaz v čase zajištění (jen ke čtení – upravuje se ve spisu / deníku)
  function zeStopy(e) {
    const d = (e && e.data) || {};
    return Object.assign(normalizuj({
      id: e.id, time: d.kdy, type: 'dukaz', jistota: 'overeno', zdroj: 'stopa', stopa: d.cislo, misto: d.misto,
      desc: 'Zajištění stopy' + (d.cislo ? ' ' + d.cislo : '') + ': ' + e.nazev
    }), { zeStopy: true });
  }
  // idOsoby(jméno) / idMista(název) → id entity (nástroj chybějící předem založí)
  function doSpisu(it, puvodni, idOsoby, idMista) {
    if (!it.time) throw new Error('Záznam „' + zkrat(it.desc) + '“ nemá čas – ve spisu je čas události povinný.');
    const pd = (puvodni && puvodni.data) || {};
    const druh = DRUHY_SPISU.includes(it.type) ? it.type : 'udalost';
    const zdrojCitelny = [it.zdroj ? ZDROJE[it.zdroj] : '', it.zdrojText].filter(Boolean).join(' – ');
    const data = Object.assign({}, pd, {
      kdy: it.time, do: it.end || undefined, nejistota: it.tol || undefined, druh, typOsy: druh === it.type ? undefined : it.type,
      jistota: it.jistota, osoby: it.osoby.map(idOsoby).filter(Boolean), misto: it.misto ? idMista(it.misto) || undefined : undefined,
      lat: it.lat, lon: it.lon, zdroj: zdrojCitelny || undefined, zdrojDruh: it.zdroj || undefined, zdrojText: it.zdrojText || undefined,
      stopa: it.stopa || undefined, popis: it.desc || undefined
    });
    if (it.lat == null) { delete data.lat; delete data.lon; }
    const ponechNazev = puvodni && (pd.popis ? pd.popis === it.desc : puvodni.nazev === it.desc);
    return { id: it.id, typ: 'udalost', nazev: ponechNazev ? puvodni.nazev : (zkrat(it.desc) || 'Událost'), data };
  }
  const klicZaznamu = it => JSON.stringify(it);

  const api = {
    TYPY, JISTOTY, ZDROJE, jistotaZTypu, novyId, cas, ms, naCas, normalizuj, nacti, exportJson, slouc, bezDuplicit, interval, serad,
    normText, stejneMisto, rozpory, idsRozporu, drahy, rozsah, rozvrhni, znacky, zoom, formatCas, formatKdy, popisZdroje,
    exportCsv, zEvidence, zCasoveAnalyzy, zModelovehoPripadu, zeSpisu, zeStopy, doSpisu, klicZaznamu
  };
  if (typeof module !== 'undefined') module.exports = api;
  else window.CaseTimelineJadro = api;
})();
