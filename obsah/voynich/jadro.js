/* Voynichův rukopis – jádro bez DOM: čtení IVTFF, korpus slov, hledání a statistiky.
 * Formát IVTFF 2.0 podle R. Zandbergena (https://www.voynich.nu/software/ivtt/IVTFF_format.pdf).
 * V prohlížeči window.VoynichJadro, v node module.exports (testy _test/voynich_test.js). */
(function (koren) {
  'use strict';

  // ---------- popisy kódů IVTFF ----------
  const ILUSTRACE = {
    A: 'astronomická', B: 'biologická', C: 'kosmologická', H: 'bylinná',
    P: 'farmaceutická', S: 'hvězdičky na okraji', T: 'jen text', Z: 'zvěrokruh'
  };
  const ILUSTRACE_POPIS = {
    A: 'Astronomické kresby: Slunce, Měsíc, hvězdy (bez zvěrokruhu)',
    B: 'Biologická (balneologická) sekce: nymfy v nádržích a trubicích',
    C: 'Kosmologické kruhové diagramy',
    H: 'Bylinná sekce: kresby rostlin',
    P: 'Farmaceutická sekce: nádoby a části rostlin',
    S: 'Odstavce označené hvězdičkami na okraji (tzv. recepty)',
    T: 'Stránka jen s textem',
    Z: 'Zvěrokruh: kruhy s nymfami a znamením uprostřed'
  };
  const PORADI_ILUSTRACI = ['H', 'A', 'Z', 'C', 'B', 'P', 'S', 'T'];
  const MALBA = { X: { C: 'poznámka o barvě', M: 'název měsíce', O: 'jiné', S: 'řada znaků nebo čísel', V: 'různé' } };
  const LOKATOR = {
    '@': 'samostatně (první položka stránky nebo bez vazby)',
    '+': 'pod předchozí položkou',
    '*': 'na začátku dalšího řádku u levého okraje',
    '=': 'na stejném řádku za mezerou',
    '&': 'na stejném kruhu za mezerou',
    '~': 'na stejném řádku, nepřesně zarovnáno',
    '/': 'vpravo nad předchozí položkou',
    '!': 'text, který v rukopisu ve skutečnosti není'
  };
  const TYP_LOKUSU = {
    P0: 'odstavec – běžný řádek', P1: 'odstavec odsazený (kvůli kresbě)', Pb: 'volně umístěné řádky',
    Pc: 'vystředěný řádek', Pr: 'řádek zarovnaný doprava', Pt: '„titulek“ vpravo na řádku',
    L0: 'popisek bez vazby na kresbu', La: 'popisek astronomické/kosmologické kresby', Lc: 'popisek nádoby',
    Lf: 'popisek části rostliny', Ln: 'popisek nymfy', Lp: 'popisek rostliny', Ls: 'popisek hvězdy',
    Lt: 'popisek trubice nebo nádrže', Lx: 'cizí písmo (např. na okraji)', Lz: 'popisek ve zvěrokruhu',
    Ca: 'text po kružnici proti směru hodin', Cc: 'text po kružnici po směru hodin',
    Ri: 'text po poloměru dovnitř', Ro: 'text po poloměru ven'
  };
  const DRUH_LOKUSU = { P: 'odstavce', L: 'popisky', C: 'po kružnici', R: 'po poloměru' };

  // Řazení stránek: f1r < f1v < f2r …, rozkládací části podle pořadí v souboru.
  function popisStranky(id) {
    if (id === 'fRos') return 'Rozety (f85v–f86r)';
    return id;
  }

  // ---------- čtení IVTFF ----------
  function ctiIVTFF(text) {
    const radky = text.replace(/\r/g, '').split('\n');
    const vysledek = { hlavicka: radky[0] || '', abeceda: '', stranky: [], podleId: {} };
    const m = /^#=IVTFF\s+(\S+)/.exec(vysledek.hlavicka);
    if (m) vysledek.abeceda = m[1];
    let str = null, tagy = {}, posledniLokus = null;
    let komentareKeStrance = [];
    for (let i = 1; i < radky.length; i++) {
      let r = radky[i];
      if (!r) continue;
      if (r[0] === '#') {
        const k = r.replace(/^#\s?/, '');
        if (str && k.trim() && !/^=/.test(k)) str.komentare.push(k);
        else if (!str && k.trim()) komentareKeStrance.push(k);
        continue;
      }
      if (r[0] === '/') {
        // pokračování dlouhého lokusu
        if (posledniLokus) posledniLokus.surovy = posledniLokus.surovy.replace(/\s*\/$/, '') + r.replace(/^\/\s*/, '');
        continue;
      }
      if (r[0] !== '<') continue;
      const mp = /^<(f[0-9a-zA-Z]+)>\s*(?:<!\s*([^>]*)>)?/.exec(r);
      if (mp) {
        str = { id: mp[1], vars: {}, komentare: [], lokusy: [], index: vysledek.stranky.length };
        (mp[2] || '').replace(/\$([A-Z])=(\S)/g, (_, k, v) => { str.vars[k] = v; return ''; });
        vysledek.stranky.push(str);
        vysledek.podleId[str.id] = str;
        tagy = {};
        posledniLokus = null;
        continue;
      }
      const ml = /^<(f[0-9a-zA-Z]+)\.(\d+),([@+*=&~/!])([A-Z][0-9a-z])(?:;(\w))?>\s*(.*)$/.exec(r);
      if (!ml || !str) continue;
      const lok = {
        id: ml[1] + '.' + ml[2], stranka: ml[1], cislo: +ml[2], lokator: ml[3], typ: ml[4], druh: ml[4][0],
        prepisovatel: ml[5] || '', surovy: ml[6].replace(/\s+$/, '')
      };
      posledniLokus = lok;
      str.lokusy.push(lok);
    }
    // druhý průchod: tagy, odstavce a čistý text
    for (const s of vysledek.stranky) {
      let tg = {};
      let vOdstavci = false, cisloOdstavce = 0, radekVOdstavci = 0;
      for (const l of s.lokusy) {
        l.surovy = l.surovy.replace(/\s*\/$/, '');
        l.surovy.replace(/<@([A-Z])=(\S)>/g, (_, k, v) => { tg[k] = v; return ''; });
        l.tagy = Object.assign({}, tg);
        l.zacatekOdstavce = l.surovy.indexOf('<%>') >= 0;
        l.konecOdstavce = l.surovy.indexOf('<$>') >= 0;
        if (l.druh === 'P') {
          if (l.zacatekOdstavce || !vOdstavci) { cisloOdstavce++; radekVOdstavci = 0; vOdstavci = true; }
          l.odstavec = cisloOdstavce;
          l.radekVOdstavci = ++radekVOdstavci;
          if (l.konecOdstavce) vOdstavci = false;
        }
        const pozn = [];
        l.surovy.replace(/<!([^>]*)>/g, (_, t) => { pozn.push(t.trim()); return ''; });
        l.poznamky = pozn.filter(Boolean);
      }
    }
    vysledek.komentareSouboru = komentareKeStrance;
    return vysledek;
  }

  // Hodnota proměnné (stránka + text tag lokusu).
  function promenna(stranka, lokus, k) {
    const v = lokus && lokus.tagy && lokus.tagy[k] !== undefined ? lokus.tagy[k] : stranka.vars[k];
    return v === '@' ? '' : (v || '');
  }

  // ---------- normalizace textu lokusu ----------
  // volby.nejisteMezery: true = „,“ je mezera slov (výchozí), false = slova spojit
  // volby.alternativy: 'prvni' (výchozí) | 'druha' – který výklad z [a:b] brát
  function vyklad(surovy, volby) {
    volby = volby || {};
    const nejiste = volby.nejisteMezery !== false;
    const druha = volby.alternativy === 'druha';
    let t = surovy;
    t = t.replace(/<![^>]*>/g, '');
    t = t.replace(/<@[A-Z]=\S>/g, '');
    t = t.replace(/<[%$]>/g, '');
    t = t.replace(/<[-~]>/g, '.');
    t = t.replace(/<[^>]*>/g, '');
    t = t.replace(/\[([^\]]*)\]/g, (_, obsah) => {
      const moznosti = obsah.split(':');
      return (druha && moznosti.length > 1 ? moznosti[1] : moznosti[0]) || '';
    });
    t = t.replace(/[{}]/g, '');
    t = t.replace(/@(\d{3});/g, (_, n) => String.fromCharCode(+n));
    t = t.replace(/\s+/g, '');
    t = nejiste ? t.replace(/,/g, '.') : t.replace(/,/g, '');
    t = t.replace(/\.{2,}/g, '.').replace(/^\.|\.$/g, '');
    return t;
  }

  function slovaZ(text) {
    return text ? text.split('.').filter(Boolean) : [];
  }

  // Rozdělení slova na glyfy. rezim 'znaky' = písmena EVA, 'glyfy' = běžné složené glyfy
  // (lavicové šibenice cth ckh cph cfh, lavice ch sh) jako jeden znak.
  const SLOZENE = ['cth', 'ckh', 'cph', 'cfh', 'ch', 'sh'];
  function glyfy(slovo, rezim) {
    if (rezim !== 'glyfy') return Array.from(slovo);
    const out = [];
    for (let i = 0; i < slovo.length;) {
      let hit = null;
      for (const s of SLOZENE) if (slovo.startsWith(s, i)) { hit = s; break; }
      if (hit) { out.push(hit); i += hit.length; } else { out.push(slovo[i]); i++; }
    }
    return out;
  }

  // ---------- korpus ----------
  // Z přečteného souboru udělá plochý seznam řádků (lokusů) a slov s metadaty.
  function korpus(soubor, volby) {
    volby = volby || {};
    const lokusy = [], slova = [];
    for (const s of soubor.stranky) {
      for (const l of s.lokusy) {
        const text = vyklad(l.surovy, volby);
        const sl = slovaZ(text);
        const zaznam = {
          lokus: l, stranka: s, text, slova: sl,
          I: promenna(s, l, 'I'), L: promenna(s, l, 'L'), H: promenna(s, l, 'H'),
          C: promenna(s, l, 'C'), Q: promenna(s, l, 'Q'), X: promenna(s, l, 'X')
        };
        zaznam.prvniSlovo = lokusy.length;
        lokusy.push(zaznam);
        sl.forEach((w, i) => {
          slova.push({
            w, r: zaznam, i, prvni: i === 0, posledni: i === sl.length - 1,
            nejiste: w.indexOf('?') >= 0
          });
        });
      }
    }
    return { soubor, lokusy, slova, volby };
  }

  // filtr: { I:[…], L:[…], H:[…], C:[…], Q:[…], druh:[…], stranky:[…], bezNejistych:bool, jenZakladni:bool }
  // (jenZakladni = jen slova z písmen a–z, bez vzácných glyfů @NNN; a apostrofu)
  function prazdny(a) { return !a || !a.length; }
  function vyhovuje(r, f) {
    if (!f) return true;
    if (!prazdny(f.I) && f.I.indexOf(r.I) < 0) return false;
    if (!prazdny(f.L) && f.L.indexOf(r.L || '?') < 0) return false;
    if (!prazdny(f.H) && f.H.indexOf(r.H || '?') < 0) return false;
    if (!prazdny(f.C) && f.C.indexOf(r.C || '?') < 0) return false;
    if (!prazdny(f.Q) && f.Q.indexOf(r.Q) < 0) return false;
    if (!prazdny(f.druh) && f.druh.indexOf(r.lokus.druh) < 0) return false;
    if (!prazdny(f.stranky) && f.stranky.indexOf(r.stranka.id) < 0) return false;
    return true;
  }
  function filtruj(k, f) {
    const lok = k.lokusy.filter(r => vyhovuje(r, f));
    const mn = new Set(lok);
    let sl = k.slova.filter(s => mn.has(s.r));
    if (f && f.bezNejistych) sl = sl.filter(s => !s.nejiste);
    if (f && f.jenZakladni) sl = sl.filter(s => /^[a-z]+$/.test(s.w));
    return { soubor: k.soubor, lokusy: lok, slova: sl, volby: k.volby };
  }

  // ---------- statistiky ----------
  function cetnosti(pole) {
    const m = new Map();
    for (const x of pole) m.set(x, (m.get(x) || 0) + 1);
    return m;
  }
  function serad(m) {
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  }
  function log2(x) { return Math.log(x) / Math.LN2; }
  function entropie(m) {
    let n = 0; for (const v of m.values()) n += v;
    let h = 0; for (const v of m.values()) { const p = v / n; h -= p * log2(p); }
    return h;
  }

  // Souhrn: tokeny, typy, hapax, TTR, průměrná délka, entropie znaků h0/h1/h2.
  // Entropie se počítá nad textem řádků se slovy oddělenými mezerou (jako u Bennetta / Stallingse).
  function souhrn(k, rezim) {
    const slova = k.slova.map(s => s.w);
    const f = cetnosti(slova);
    let hapax = 0; for (const v of f.values()) if (v === 1) hapax++;
    // řádky skládat z (případně vyfiltrovaných) slov, ne z celého řádku
    const znakyRadku = [];
    let g = null, posl = null;
    for (const s of k.slova) {
      if (s.r !== posl) { if (g) znakyRadku.push(g); g = []; posl = s.r; } else g.push(' ');
      for (const x of glyfy(s.w, rezim)) g.push(x);
    }
    if (g) znakyRadku.push(g);
    const uni = new Map(), bi = new Map(), prvni = new Map();
    let n = 0;
    for (const g of znakyRadku) {
      for (let i = 0; i < g.length; i++) {
        uni.set(g[i], (uni.get(g[i]) || 0) + 1); n++;
        if (i + 1 < g.length) { const k2 = g[i] + '\u0001' + g[i + 1]; bi.set(k2, (bi.get(k2) || 0) + 1); prvni.set(g[i], (prvni.get(g[i]) || 0) + 1); }
      }
    }
    const h1 = entropie(uni);
    // podmíněná entropie h2 = H(X2|X1) = H(X1,X2) − H(X1) nad páry
    const h12 = entropie(bi), hp = entropie(prvni);
    const delky = slova.map(w => glyfy(w, rezim).length);
    const prumer = delky.length ? delky.reduce((a, b) => a + b, 0) / delky.length : 0;
    return {
      tokenu: slova.length, typu: f.size, hapax, ttr: slova.length ? f.size / slova.length : 0,
      radku: k.lokusy.filter(r => r.slova.length).length,
      stranek: new Set(k.lokusy.map(r => r.stranka.id)).size,
      znaku: n, abeceda: uni.size, h0: uni.size ? log2(uni.size) : 0, h1, h2: bi.size ? h12 - hp : 0,
      prumernaDelka: prumer
    };
  }

  function frekvenceSlov(k) {
    const f = cetnosti(k.slova.map(s => s.w));
    const n = k.slova.length || 1;
    return serad(f).map(([w, c], i) => ({ w, n: c, podil: c / n, poradi: i + 1 }));
  }

  // Četnost znaků a jejich poloha ve slově (začátek / uvnitř / konec / samostatně).
  function znaky(k, rezim) {
    const m = new Map();
    let celkem = 0;
    for (const s of k.slova) {
      const g = glyfy(s.w, rezim);
      g.forEach((x, i) => {
        let z = m.get(x);
        if (!z) { z = { g: x, n: 0, zacatek: 0, uvnitr: 0, konec: 0, samo: 0 }; m.set(x, z); }
        z.n++; celkem++;
        if (g.length === 1) z.samo++;
        else if (i === 0) z.zacatek++;
        else if (i === g.length - 1) z.konec++;
        else z.uvnitr++;
      });
    }
    const out = Array.from(m.values()).sort((a, b) => b.n - a.n || (a.g < b.g ? -1 : 1));
    out.forEach(z => { z.podil = z.n / (celkem || 1); });
    return out;
  }

  // Matice přechodů znak → další znak uvnitř slov (vč. začátku „^“ a konce „$“).
  function bigramy(k, rezim, sHranicemi) {
    const m = new Map(), radky = new Map(), sloupce = new Map();
    for (const s of k.slova) {
      let g = glyfy(s.w, rezim);
      if (sHranicemi) g = ['^'].concat(g, ['$']);
      for (let i = 0; i + 1 < g.length; i++) {
        const a = g[i], b = g[i + 1];
        const key = a + '\u0001' + b;
        m.set(key, (m.get(key) || 0) + 1);
        radky.set(a, (radky.get(a) || 0) + 1);
        sloupce.set(b, (sloupce.get(b) || 0) + 1);
      }
    }
    return {
      pocet: (a, b) => m.get(a + '\u0001' + b) || 0,
      radky: serad(radky).map(x => x[0]), sloupce: serad(sloupce).map(x => x[0]),
      soucetRadku: a => radky.get(a) || 0, soucetSloupce: b => sloupce.get(b) || 0,
      celkem: Array.from(m.values()).reduce((x, y) => x + y, 0)
    };
  }

  function delkySlov(k, rezim) {
    const m = new Map();
    for (const s of k.slova) { const d = glyfy(s.w, rezim).length; m.set(d, (m.get(d) || 0) + 1); }
    const max = Math.max(0, ...m.keys());
    const out = [];
    for (let d = 1; d <= max; d++) out.push({ d, n: m.get(d) || 0 });
    return out;
  }

  // Slova podle polohy na řádku a v odstavci.
  function polohy(k) {
    const prvniNaRadku = [], posledniNaRadku = [], prvniVOdstavci = [], prvniZnakOdstavce = [], prvniZnakRadku = [];
    for (const r of k.lokusy) {
      if (!r.slova.length || r.lokus.druh !== 'P') continue;
      prvniNaRadku.push(r.slova[0]);
      posledniNaRadku.push(r.slova[r.slova.length - 1]);
      prvniZnakRadku.push(r.slova[0][0]);
      if (r.lokus.radekVOdstavci === 1) { prvniVOdstavci.push(r.slova[0]); prvniZnakOdstavce.push(r.slova[0][0]); }
    }
    const t = a => serad(cetnosti(a)).map(([w, n]) => ({ w, n, podil: n / (a.length || 1) }));
    return {
      prvniNaRadku: t(prvniNaRadku), posledniNaRadku: t(posledniNaRadku), prvniVOdstavci: t(prvniVOdstavci),
      prvniZnakOdstavce: t(prvniZnakOdstavce), prvniZnakRadku: t(prvniZnakRadku),
      radku: prvniNaRadku.length, odstavcu: prvniVOdstavci.length
    };
  }

  // Nejčastější začátky a konce slov dané délky (prefixy / sufixy).
  function afixy(k, delka, konec) {
    const m = new Map();
    for (const s of k.slova) {
      if (s.w.length <= delka) continue;
      const a = konec ? s.w.slice(-delka) : s.w.slice(0, delka);
      m.set(a, (m.get(a) || 0) + 1);
    }
    return serad(m).map(([w, n]) => ({ w, n }));
  }

  // ---------- hledání ----------
  function escRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  // rezim: 'slovo' | 'obsahuje' | 'zacina' | 'konci' | 'vzor' (* a ? jako zástupné) | 'regex' (nad textem řádku)
  function sestavDotaz(dotaz, rezim) {
    dotaz = (dotaz || '').trim();
    if (!dotaz) return null;
    if (rezim === 'regex') return { radek: true, re: new RegExp(dotaz, 'g') };
    if (rezim === 'vzor') {
      const re = '^' + dotaz.split('').map(c => c === '*' ? '[^.]*' : c === '?' ? '[^.]' : escRegex(c)).join('') + '$';
      return { radek: false, re: new RegExp(re) };
    }
    const e = escRegex(dotaz);
    const re = rezim === 'obsahuje' ? e : rezim === 'zacina' ? '^' + e : rezim === 'konci' ? e + '$' : '^' + e + '$';
    return { radek: false, re: new RegExp(re) };
  }

  // Vrací nálezy { r (řádek), od, do (indexy slov), slova } – pro regex nad řádkem
  // se rozsah přepočte na slova, kterých se shoda dotkne.
  function hledej(k, dotaz, rezim) {
    const q = sestavDotaz(dotaz, rezim);
    if (!q) return [];
    const out = [];
    if (!q.radek) {
      for (const s of k.slova) if (q.re.test(s.w)) out.push({ r: s.r, od: s.i, do: s.i, slovo: s.w });
      return out;
    }
    // index slova, do kterého patří znak na pozici p (tečka patří k následujícímu slovu)
    const slovoNa = (t, p) => { let n = 0; for (let i = 0; i < p; i++) if (t[i] === '.') n++; return n; };
    for (const r of k.lokusy) {
      if (!r.text) continue;
      q.re.lastIndex = 0;
      let m, ochrana = 0;
      while ((m = q.re.exec(r.text)) && ochrana++ < 500) {
        if (m[0] === '') { q.re.lastIndex++; continue; }
        const zac = m.index, kon = m.index + m[0].length - 1;
        const od = slovoNa(r.text, r.text[zac] === '.' ? zac + 1 : zac);
        const doI = slovoNa(r.text, kon);
        out.push({ r, od, do: Math.max(od, Math.min(doI, r.slova.length - 1)), slovo: m[0] });
      }
    }
    return out;
  }

  // Kontext nálezu přes hranice řádků (KWIC): n slov vlevo a vpravo v rámci stránky.
  function kontext(k, nalez, n) {
    n = n || 4;
    const r = nalez.r, idx = k.lokusy.indexOf(r);
    const vlevo = [], vpravo = [];
    let j = idx, i = nalez.od - 1;
    while (vlevo.length < n && j >= 0) {
      const rr = k.lokusy[j];
      if (rr.stranka !== r.stranka) break;
      if (i < 0) { j--; if (j >= 0) i = k.lokusy[j].slova.length - 1; continue; }
      vlevo.unshift(rr.slova[i]); i--;
    }
    j = idx; i = nalez.do + 1;
    while (vpravo.length < n && j < k.lokusy.length) {
      const rr = k.lokusy[j];
      if (rr.stranka !== r.stranka) break;
      if (i >= rr.slova.length) { j++; i = 0; continue; }
      vpravo.push(rr.slova[i]); i++;
    }
    return { vlevo, shoda: r.slova.slice(nalez.od, nalez.do + 1), vpravo };
  }

  // ---------- srovnání ----------
  // Log-likelihood G² (Dunning 1993) pro každé slovo: co je typické pro A proti B.
  function klicovaSlova(kA, kB, minimum) {
    minimum = minimum || 5;
    const fa = cetnosti(kA.slova.map(s => s.w)), fb = cetnosti(kB.slova.map(s => s.w));
    const na = kA.slova.length, nb = kB.slova.length;
    const vse = new Set([...fa.keys(), ...fb.keys()]);
    const out = [];
    for (const w of vse) {
      const a = fa.get(w) || 0, b = fb.get(w) || 0;
      if (a + b < minimum) continue;
      const ea = na * (a + b) / (na + nb), eb = nb * (a + b) / (na + nb);
      let g = 0;
      if (a) g += a * Math.log(a / ea);
      if (b) g += b * Math.log(b / eb);
      g *= 2;
      const pa = a / (na || 1), pb = b / (nb || 1);
      out.push({ w, a, b, pa, pb, g2: pa >= pb ? g : -g, logPomer: Math.log2((pa + 0.5 / na) / (pb + 0.5 / nb)) });
    }
    return out.sort((x, y) => Math.abs(y.g2) - Math.abs(x.g2));
  }

  // ---------- slova ----------
  function levenshtein(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let pred = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let minR = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(pred[j] + 1, cur[j - 1] + 1, pred[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < minR) minR = cur[j];
      }
      if (minR > max) return max + 1;
      pred = cur;
    }
    return pred[b.length];
  }
  function podobnaSlova(slovo, frek, max) {
    max = max || 1;
    const out = [];
    for (const z of frek) {
      if (z.w === slovo) continue;
      const d = levenshtein(slovo, z.w, max);
      if (d <= max) out.push({ w: z.w, n: z.n, d });
    }
    return out.sort((a, b) => a.d - b.d || b.n - a.n);
  }

  // Rozložení slova podle zvolené vlastnosti řádku (I, L, H, Q…) – počet a podíl v rámci skupiny.
  function rozlozeni(k, slovo, vlastnost) {
    const celk = new Map(), hit = new Map();
    for (const s of k.slova) {
      const v = vlastnost === 'stranka' ? s.r.stranka.id : (s.r[vlastnost] || '?');
      celk.set(v, (celk.get(v) || 0) + 1);
      if (s.w === slovo) hit.set(v, (hit.get(v) || 0) + 1);
    }
    return Array.from(celk.keys()).map(v => ({ v, n: hit.get(v) || 0, celkem: celk.get(v), podil: (hit.get(v) || 0) / celk.get(v) }));
  }

  // Zarovnání dvou řad slov (LCS) – pro rozdíly mezi přepisy.
  function rozdilSlov(a, b) {
    const n = a.length, m = b.length;
    const T = Array.from({ length: n + 1 }, () => new Int16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
      T[i][j] = a[i] === b[j] ? T[i + 1][j + 1] + 1 : Math.max(T[i + 1][j], T[i][j + 1]);
    const hruby = [];
    let i = 0, j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && a[i] === b[j]) { hruby.push({ t: '=', a: a[i], b: b[j] }); i++; j++; }
      else if (j < m && (i >= n || T[i][j + 1] > T[i + 1][j])) { hruby.push({ t: '+', b: b[j] }); j++; }
      else { hruby.push({ t: '-', a: a[i] }); i++; }
    }
    // úseky „ubráno + přidáno“ mezi shodami spárovat na záměny (~), zbytek nechat
    const out = [];
    for (let x = 0; x < hruby.length;) {
      if (hruby[x].t === '=') { out.push(hruby[x++]); continue; }
      const minus = [], plus = [];
      while (x < hruby.length && hruby[x].t !== '=') { (hruby[x].t === '-' ? minus : plus).push(hruby[x]); x++; }
      const p = Math.min(minus.length, plus.length);
      for (let y = 0; y < p; y++) out.push({ t: '~', a: minus[y].a, b: plus[y].b });
      for (let y = p; y < minus.length; y++) out.push(minus[y]);
      for (let y = p; y < plus.length; y++) out.push(plus[y]);
    }
    return out;
  }

  // Shoda dvou přepisů po stránkách: podíl shodných slov v řádcích se stejným ID lokusu.
  function shodaPrepisu(kA, kB) {
    const mapB = new Map(kB.lokusy.map(r => [r.lokus.id, r]));
    const poStrankach = new Map();
    for (const r of kA.lokusy) {
      const rb = mapB.get(r.lokus.id);
      let z = poStrankach.get(r.stranka.id);
      if (!z) { z = { stranka: r.stranka.id, shoda: 0, celkem: 0, radkuBezProtejsku: 0 }; poStrankach.set(r.stranka.id, z); }
      if (!rb) { z.radkuBezProtejsku++; z.celkem += r.slova.length; continue; }
      const d = rozdilSlov(r.slova, rb.slova);
      z.shoda += d.filter(x => x.t === '=').length;
      z.celkem += Math.max(r.slova.length, rb.slova.length);
    }
    return Array.from(poStrankach.values()).map(z => Object.assign(z, { podil: z.celkem ? z.shoda / z.celkem : 1 }));
  }

  // ---------- export ----------
  function csv(radky) {
    return radky.map(r => r.map(x => {
      const s = String(x == null ? '' : x);
      return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(';')).join('\n');
  }

  const API = {
    ILUSTRACE, ILUSTRACE_POPIS, PORADI_ILUSTRACI, MALBA, LOKATOR, TYP_LOKUSU, DRUH_LOKUSU,
    popisStranky, ctiIVTFF, promenna, vyklad, slovaZ, glyfy, korpus, filtruj, vyhovuje,
    cetnosti, serad, entropie, souhrn, frekvenceSlov, znaky, bigramy, delkySlov, polohy, afixy,
    sestavDotaz, hledej, kontext, klicovaSlova, levenshtein, podobnaSlova, rozlozeni, rozdilSlov,
    shodaPrepisu, csv
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else koren.VoynichJadro = API;
})(typeof window !== 'undefined' ? window : globalThis);
