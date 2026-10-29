/* Vstupenky, kupóny a poukazy – jádro bez DOM.
   Číslování (řada i náhodné unikátní kódy), kontrolní znaky (Luhn mod N, Damm),
   sedadla řada × místo, proměnné v textech, rozložení na arch s ořezovými značkami,
   Code 128, CSV vydaných kódů a vyhodnocení kontroly na vstupu.
   V prohlížeči window.VSTUPENKY, v node module.exports. */
(function (koren) {
  'use strict';

  // ---------- abecedy ----------
  const ABECEDY = {
    bezpecna: { nazev: 'Písmena + číslice bez záměnných (bez 0 O 1 I)', znaky: '23456789ABCDEFGHJKLMNPQRSTUVWXYZ' },
    cisla: { nazev: 'Jen číslice 0–9', znaky: '0123456789' },
    pismena: { nazev: 'Jen písmena bez I a O', znaky: 'ABCDEFGHJKLMNPQRSTUVWXYZ' },
    hex: { nazev: 'Šestnáctková 0–9 A–F', znaky: '0123456789ABCDEF' },
  };

  // ---------- kontrolní znaky ----------
  // Luhn mod N: obecná varianta Luhnova algoritmu nad libovolnou abecedou (pro číslice = klasický Luhn)
  function luhnModN(telo, abeceda) {
    const n = abeceda.length;
    let faktor = 2, soucet = 0;
    for (let i = telo.length - 1; i >= 0; i--) {
      const k = abeceda.indexOf(telo[i]);
      if (k < 0) return null;
      let a = faktor * k;
      faktor = faktor === 2 ? 1 : 2;
      soucet += Math.floor(a / n) + (a % n);
    }
    return abeceda[(n - (soucet % n)) % n];
  }
  function luhnModNPlatny(kod, abeceda) {
    const n = abeceda.length;
    let faktor = 1, soucet = 0;
    for (let i = kod.length - 1; i >= 0; i--) {
      const k = abeceda.indexOf(kod[i]);
      if (k < 0) return false;
      let a = faktor * k;
      faktor = faktor === 2 ? 1 : 2;
      soucet += Math.floor(a / n) + (a % n);
    }
    return soucet % n === 0;
  }

  // Damm (jen číslice) – zachytí všechny jednoznakové chyby i záměny sousedních číslic
  const DAMM = [
    [0, 3, 1, 7, 5, 9, 8, 6, 4, 2], [7, 0, 9, 2, 1, 5, 4, 8, 6, 3], [4, 2, 0, 6, 8, 7, 1, 3, 5, 9],
    [1, 7, 5, 0, 9, 8, 3, 4, 2, 6], [6, 1, 2, 3, 0, 4, 5, 9, 7, 8], [3, 6, 7, 4, 2, 0, 9, 5, 8, 1],
    [5, 8, 6, 9, 7, 2, 0, 1, 3, 4], [8, 9, 4, 5, 3, 6, 2, 0, 1, 7], [9, 4, 3, 8, 6, 1, 7, 2, 0, 5],
    [2, 5, 8, 1, 4, 3, 6, 7, 9, 0]];
  function damm(telo) {
    let s = 0;
    for (const ch of telo) {
      if (ch < '0' || ch > '9') return null;
      s = DAMM[s][+ch];
    }
    return String(s);
  }
  const dammPlatny = kod => damm(kod) === '0';

  const KONTROLNI = {
    zadny: 'Bez kontrolního znaku',
    luhn: 'Luhn mod N (nad zvolenou abecedou)',
    damm: 'Damm (jen číslice)',
  };

  function kontrolniZnak(telo, druh, abeceda) {
    if (!druh || druh === 'zadny') return '';
    if (druh === 'damm') return damm(telo);
    if (druh === 'luhn') return luhnModN(telo, abeceda);
    throw new Error('Neznámý kontrolní znak: ' + druh);
  }
  function kontrolniPlatny(teloSeZnakem, druh, abeceda) {
    if (!druh || druh === 'zadny') return true;
    if (druh === 'damm') return dammPlatny(teloSeZnakem);
    return luhnModNPlatny(teloSeZnakem, abeceda);
  }

  // ---------- náhoda ----------
  // deterministický generátor (stejné semínko = stejné kódy, náhled se nemění při každém překreslení)
  function hashText(t) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }
  function prng(seminko) {
    // xoshiro128** se 4 slovy odvozenými z textu – dost dlouhá perioda i pro miliony kódů
    let a = hashText('a' + seminko), b = hashText('b' + seminko), c = hashText('c' + seminko), d = hashText('d' + seminko);
    if (!(a | b | c | d)) a = 1;
    return function () {
      const t = b << 9; let r = Math.imul(b, 5); r = Math.imul((r << 7) | (r >>> 25), 9);
      c ^= a; d ^= b; b ^= c; a ^= d; c ^= t; d = (d << 11) | (d >>> 21);
      return (r >>> 0) / 4294967296;
    };
  }

  // ---------- normalizace a formát kódu ----------
  const normalizuj = s => String(s == null ? '' : s).toUpperCase().replace(/[\s\-_.]/g, '');
  function seskup(telo, po) {
    if (!(po > 0) || telo.length <= po) return telo;
    const casti = [];
    for (let i = 0; i < telo.length; i += po) casti.push(telo.slice(i, i + po));
    return casti.join('-');
  }

  // ---------- číslování ----------
  const MAX_KUSU = 100000;

  function cele(v, vychozi) { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : vychozi; }

  /* nast: { rezim:'rada'|'nahodne', od, do, krok, nuly, predpona, pripona,
             delka, abeceda (klíč ABECEDY nebo vlastní řetězec), kontrolni, skupiny, seminko,
             pocet (jen náhodné), vynechat: [kódy] }
     pevnyPocet: když je dán (sedadla), řada jde od `od` po krocích a `do` se nebere v úvahu.
     Vrací { polozky:[{poradi, cislo, kod}], varovani:[] } nebo vyhodí Error s českou zprávou. */
  function generujSerii(nast, pevnyPocet) {
    const n = Object.assign({ rezim: 'rada', od: 1, do: 100, krok: 1, nuly: 0, predpona: '', pripona: '',
      delka: 8, abeceda: 'bezpecna', kontrolni: 'zadny', skupiny: 0, seminko: '1', pocet: 100, vynechat: [] }, nast || {});
    const varovani = [];
    const predpona = String(n.predpona || ''), pripona = String(n.pripona || '');
    const vynechat = new Set((n.vynechat || []).map(normalizuj));
    const polozky = [];

    if (n.rezim === 'rada') {
      const od = cele(n.od, 1), krok = cele(n.krok, 1), nuly = Math.max(0, Math.min(20, cele(n.nuly, 0)));
      if (krok === 0) throw new Error('Krok číslování nesmí být nula.');
      let pocet;
      if (pevnyPocet != null) pocet = pevnyPocet;
      else {
        const doo = cele(n.do, od);
        if ((doo - od) * krok < 0) throw new Error('Číslo „do“ leží na opačné straně než krok – zkontroluj od, do a krok.');
        pocet = Math.floor((doo - od) / krok) + 1;
      }
      if (pocet > MAX_KUSU) throw new Error('Najednou lze vydat nejvýš ' + MAX_KUSU.toLocaleString('cs') + ' kusů.');
      if (n.kontrolni === 'luhn' || n.kontrolni === 'damm') { /* číslice – obě metody fungují */ }
      const mez = pevnyPocet != null ? pocet + vynechat.size : pocet;   // u sedadel se vynechaný kód nahradí dalším
      for (let i = 0, c = od; polozky.length < pocet && i < mez; i++, c += krok) {
        const cislo = (c < 0 ? '-' : '') + String(Math.abs(c)).padStart(nuly, '0');
        const kz = c < 0 ? '' : kontrolniZnak(cislo, n.kontrolni, ABECEDY.cisla.znaky);
        const kod = predpona + cislo + kz + pripona;
        if (vynechat.has(normalizuj(kod))) continue;
        polozky.push({ poradi: polozky.length + 1, cislo: cislo, kod: kod });
      }
      if (od < 0 && n.kontrolni !== 'zadny') varovani.push('Záporná čísla nemají kontrolní znak.');
      return { polozky, varovani };
    }

    if (n.rezim !== 'nahodne') throw new Error('Neznámý režim číslování: ' + n.rezim);
    const abeceda = ABECEDY[n.abeceda] ? ABECEDY[n.abeceda].znaky : String(n.abeceda || '');
    if (new Set(abeceda).size !== abeceda.length || abeceda.length < 2)
      throw new Error('Abeceda musí mít aspoň 2 různé znaky bez opakování.');
    if (n.kontrolni === 'damm' && /[^0-9]/.test(abeceda))
      throw new Error('Damm funguje jen nad číslicemi – zvol abecedu „Jen číslice“, nebo Luhn mod N.');
    const delka = Math.max(1, Math.min(40, cele(n.delka, 8)));
    const pocet = pevnyPocet != null ? pevnyPocet : Math.max(0, cele(n.pocet, 0));
    if (pocet > MAX_KUSU) throw new Error('Najednou lze vydat nejvýš ' + MAX_KUSU.toLocaleString('cs') + ' kusů.');
    const kombinaci = Math.pow(abeceda.length, delka);
    if (kombinaci < (pocet + vynechat.size) * 2)
      throw new Error('Málo kombinací: ' + abeceda.length + '^' + delka + ' = ' + kombinaci.toLocaleString('cs') +
        ' na ' + pocet + ' kódů. Prodluž kód nebo zvol větší abecedu.');
    const hustota = pocet / kombinaci;
    if (hustota > 1e-4) varovani.push('Kódy jdou snadno uhodnout: platný je zhruba každý ' +
      Math.round(1 / hustota).toLocaleString('cs') + '. kód. Pro vstupenky volte délku, kde je to aspoň 1 : 10 000.');
    const nahoda = prng(String(n.seminko));
    const vydane = new Set();
    const skup = cele(n.skupiny, 0);
    let pokusy = 0;
    while (polozky.length < pocet) {
      if (++pokusy > pocet * 50 + 1000) throw new Error('Nepodařilo se vygenerovat dost unikátních kódů.');
      let telo = '';
      for (let i = 0; i < delka; i++) telo += abeceda[Math.floor(nahoda() * abeceda.length)];
      const plne = telo + kontrolniZnak(telo, n.kontrolni, abeceda);
      const kod = predpona + seskup(plne, skup) + pripona;
      const klic = normalizuj(kod);
      if (vydane.has(klic) || vynechat.has(klic)) continue;
      vydane.add(klic);
      polozky.push({ poradi: polozky.length + 1, cislo: String(polozky.length + 1), kod: kod });
    }
    return { polozky, varovani };
  }

  /* ověření kontrolního znaku zadaného kódu podle nastavení série (pro kontrolu na vstupu) */
  function overKontrolni(kod, nast) {
    const n = nast || {};
    if (!n.kontrolni || n.kontrolni === 'zadny') return null;
    let s = normalizuj(kod);
    const pp = normalizuj(n.predpona), ps = normalizuj(n.pripona);
    if (pp && s.startsWith(pp)) s = s.slice(pp.length);
    if (ps && s.endsWith(ps)) s = s.slice(0, s.length - ps.length);
    const abeceda = n.rezim === 'rada' ? ABECEDY.cisla.znaky : (ABECEDY[n.abeceda] ? ABECEDY[n.abeceda].znaky : String(n.abeceda || ''));
    return kontrolniPlatny(s, n.kontrolni, abeceda);
  }

  // ---------- sedadla ----------
  /* Zápis po řádcích:
       A-F: 1-20            řady A až F, místa 1–20
       G, H: 1-24 liché     jen lichá (sudé = jen sudá)
       Balkon | 1-3: 1-12   sektor „Balkon“, řady 1–3
       vynechat: A5 A6 B/12  vynechaná místa (řada+místo nebo řada/místo)
     Vrací [{sektor, rada, misto}] v pořadí zápisu. */
  function rozsahRad(t) {
    const vysl = [];
    for (const kus of t.split(',').map(s => s.trim()).filter(Boolean)) {
      const m = kus.match(/^(\S+?)\s*-\s*(\S+)$/);
      if (!m) { vysl.push(kus); continue; }
      const [a, b] = [m[1], m[2]];
      if (/^\d+$/.test(a) && /^\d+$/.test(b)) {
        const x = +a, y = +b, k = x <= y ? 1 : -1;
        if (Math.abs(y - x) > 500) throw new Error('Příliš mnoho řad: ' + kus);
        for (let i = x; k > 0 ? i <= y : i >= y; i += k) vysl.push(String(i));
      } else if (/^[A-Za-z]$/.test(a) && /^[A-Za-z]$/.test(b)) {
        const x = a.toUpperCase().charCodeAt(0), y = b.toUpperCase().charCodeAt(0), k = x <= y ? 1 : -1;
        for (let i = x; k > 0 ? i <= y : i >= y; i += k) vysl.push(String.fromCharCode(i));
      } else throw new Error('Nerozumím rozsahu řad „' + kus + '“ (použij např. A-F nebo 1-12).');
    }
    return vysl;
  }
  function rozsahMist(t) {
    const vysl = [];
    let jen = null;
    let s = t.replace(/(lich[éáa]|sud[éáa])/gi, m => { jen = /^l/i.test(m) ? 1 : 0; return ''; });
    for (const kus of s.split(',').map(x => x.trim()).filter(Boolean)) {
      const m = kus.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
      if (!m) throw new Error('Nerozumím rozsahu míst „' + kus + '“ (použij např. 1-20).');
      const x = +m[1], y = m[2] != null ? +m[2] : x, k = x <= y ? 1 : -1;
      if (Math.abs(y - x) > 2000) throw new Error('Příliš mnoho míst: ' + kus);
      for (let i = x; k > 0 ? i <= y : i >= y; i += k) if (jen == null || i % 2 === jen) vysl.push(i);
    }
    return vysl;
  }
  function sedadla(text) {
    const vysl = [], vynech = new Set();
    const radky = String(text || '').split(/\r?\n/).map(r => r.trim()).filter(r => r && !r.startsWith('#'));
    for (const r of radky) {
      const v = r.match(/^vynech(?:at)?\s*:\s*(.*)$/i);
      if (v) {
        for (const t of v[1].split(/[\s,;]+/).filter(Boolean)) {
          const m = t.match(/^(.+?)\/(\d+)$/) || t.match(/^([A-Za-z]+)(\d+)$/);
          if (!m) throw new Error('Vynechané místo „' + t + '“ zapiš jako A5 nebo 12/5.');
          vynech.add(m[1].toUpperCase() + '/' + (+m[2]));
        }
        continue;
      }
      let sektor = '', zbytek = r;
      const ps = r.split('|');
      if (ps.length === 2) { sektor = ps[0].trim(); zbytek = ps[1]; }
      const d = zbytek.indexOf(':');
      if (d < 0) throw new Error('Řádek „' + r + '“ potřebuje dvojtečku: řady: místa (např. A-F: 1-20).');
      const rady = rozsahRad(zbytek.slice(0, d).trim()), mista = rozsahMist(zbytek.slice(d + 1));
      for (const rada of rady) for (const misto of mista) vysl.push({ sektor, rada: rada.toUpperCase(), misto });
      if (vysl.length > MAX_KUSU) throw new Error('Příliš mnoho sedadel.');
    }
    const klice = new Set();
    return vysl.filter(s => {
      const k = s.sektor + '|' + s.rada + '/' + s.misto;
      if (klice.has(k)) return false;   // stejné místo zapsané dvakrát
      klice.add(k);
      return !vynech.has(s.rada + '/' + s.misto);
    });
  }

  // ---------- proměnné v textech ----------
  // {nazev} → hodnota; neznámé proměnné zůstávají viditelné, ať je uživatel opraví
  function doplnText(sablona, promenne) {
    return String(sablona == null ? '' : sablona).replace(/\{([a-zA-Z0-9_áčďéěíňóřšťúůýž]+)\}/g,
      (cele, k) => Object.prototype.hasOwnProperty.call(promenne, k) && promenne[k] != null ? String(promenne[k]) : cele);
  }

  /* proměnné pro jeden kus: texty projektu + kód, číslo, pořadí, sedadlo, url */
  function promenneKusu(projekt, polozka, sedadlo, celkem) {
    const p = Object.assign({}, projekt.texty || {});
    p.kod = polozka.kod;
    p.cislo = polozka.cislo;
    p.poradi = polozka.poradi;
    p.celkem = celkem;
    p.rada = sedadlo ? sedadlo.rada : '';
    p.misto = sedadlo ? sedadlo.misto : '';
    p.sektor = sedadlo ? sedadlo.sektor : '';
    p.url = projekt.qr && projekt.qr.url ? doplnText(projekt.qr.url, { kod: encodeURIComponent(polozka.kod), cislo: polozka.cislo }) : '';
    return p;
  }

  /* celá série kusů z projektu: kódy + sedadla */
  function kusy(projekt) {
    const sed = projekt.sedadla && projekt.sedadla.zapnuto ? sedadla(projekt.sedadla.text) : null;
    if (sed && !sed.length) throw new Error('Plánek sedadel je prázdný.');
    const c = projekt.cislovani || {};
    const vynechat = (c.vynechat || []).concat(String(c.vynechatText || '').split(/[\s,;]+/).filter(Boolean));
    const s = generujSerii(Object.assign({}, c, { vynechat }), sed ? sed.length : null);
    const celkem = s.polozky.length;
    return {
      varovani: s.varovani,
      kusy: s.polozky.map((pol, i) => {
        const sd = sed ? sed[i] : null;
        return { kod: pol.kod, cislo: pol.cislo, poradi: pol.poradi, sedadlo: sd, promenne: promenneKusu(projekt, pol, sd, celkem) };
      }),
    };
  }

  // ---------- rozložení na arch ----------
  const ARCHY = { A4: [210, 297], A3: [297, 420], A5: [148, 210], SRA3: [320, 450], Letter: [215.9, 279.4] };

  function mrizka(aw, ah, kw, kh, okraj, mezera) {
    const sloupcu = Math.max(0, Math.floor((aw - 2 * okraj + mezera + 1e-9) / (kw + mezera)));
    const radku = Math.max(0, Math.floor((ah - 2 * okraj + mezera + 1e-9) / (kh + mezera)));
    return { sloupcu, radku };
  }

  /* arch {w,h} mm, kus {w,h} mm, okraj (nepotiskovatelný okraj), mezera mezi kusy,
     otoceni 'auto' | 'ano' | 'ne' (otočit kus o 90°). Mřížka se vystředí. */
  function rozlozeni(o) {
    const aw = +o.arch.w, ah = +o.arch.h, okraj = Math.max(0, +o.okraj || 0), mezera = Math.max(0, +o.mezera || 0);
    const kw = +o.kus.w, kh = +o.kus.h;
    if (!(aw > 0 && ah > 0 && kw > 0 && kh > 0)) throw new Error('Rozměry archu i kusu musí být kladné.');
    const rovne = mrizka(aw, ah, kw, kh, okraj, mezera), otocene = mrizka(aw, ah, kh, kw, okraj, mezera);
    let otocit = o.otoceni === 'ano';
    if (o.otoceni === 'auto') otocit = otocene.sloupcu * otocene.radku > rovne.sloupcu * rovne.radku;
    const g = otocit ? otocene : rovne;
    const w = otocit ? kh : kw, h = otocit ? kw : kh;
    const sirka = g.sloupcu * w + Math.max(0, g.sloupcu - 1) * mezera;
    const vyska = g.radku * h + Math.max(0, g.radku - 1) * mezera;
    const x0 = (aw - sirka) / 2, y0 = (ah - vyska) / 2;
    const pozice = [];
    for (let r = 0; r < g.radku; r++) for (let s = 0; s < g.sloupcu; s++)
      pozice.push({ x: x0 + s * (w + mezera), y: y0 + r * (h + mezera) });
    return { sloupcu: g.sloupcu, radku: g.radku, naArch: g.sloupcu * g.radku, otocit, w, h, x0, y0, sirka, vyska, pozice, archW: aw, archH: ah, mezera };
  }

  /* ořezové značky vně mřížky: pro každou svislou hranu nahoře a dole, pro vodorovnou vlevo a vpravo.
     Vrací úsečky [{x1,y1,x2,y2}] v mm. Krátí se, aby nevyšly mimo arch. */
  function orezoveZnacky(roz, volby) {
    const delka = (volby && volby.delka) || 5, odstup = (volby && volby.odstup != null) ? volby.odstup : 1.5;
    const xs = new Set(), ys = new Set(), car = [];
    const zaokr = v => Math.round(v * 1000) / 1000;
    for (let s = 0; s < roz.sloupcu; s++) { const x = roz.x0 + s * (roz.w + roz.mezera); xs.add(zaokr(x)); xs.add(zaokr(x + roz.w)); }
    for (let r = 0; r < roz.radku; r++) { const y = roz.y0 + r * (roz.h + roz.mezera); ys.add(zaokr(y)); ys.add(zaokr(y + roz.h)); }
    const nahoru = Math.min(delka, roz.y0 - odstup), dolu = Math.min(delka, roz.archH - (roz.y0 + roz.vyska) - odstup);
    const vlevo = Math.min(delka, roz.x0 - odstup), vpravo = Math.min(delka, roz.archW - (roz.x0 + roz.sirka) - odstup);
    for (const x of xs) {
      if (nahoru >= 1) car.push({ x1: x, y1: roz.y0 - odstup - nahoru, x2: x, y2: roz.y0 - odstup });
      if (dolu >= 1) { const y = roz.y0 + roz.vyska + odstup; car.push({ x1: x, y1: y, x2: x, y2: y + dolu }); }
    }
    for (const y of ys) {
      if (vlevo >= 1) car.push({ x1: roz.x0 - odstup - vlevo, y1: y, x2: roz.x0 - odstup, y2: y });
      if (vpravo >= 1) { const x = roz.x0 + roz.sirka + odstup; car.push({ x1: x, y1: y, x2: x + vpravo, y2: y }); }
    }
    return car;
  }

  // ---------- oblasti kusu (hlavní část × ústřižek) ----------
  /* projekt.rozmer {w,h}, projekt.ustrizek {strana:'zadny'|'vpravo'|'vlevo'|'dole', sirka}
     Vrací { hlavni:{x,y,w,h}, ustrizek:{…}|null, perforace:{x1,y1,x2,y2}|null } v mm. */
  function oblasti(projekt) {
    const W = +projekt.rozmer.w, H = +projekt.rozmer.h;
    const u = projekt.ustrizek || {};
    const s = Math.max(0, +u.sirka || 0);
    if (!u.strana || u.strana === 'zadny' || !s) return { hlavni: { x: 0, y: 0, w: W, h: H }, ustrizek: null, perforace: null };
    if (u.strana === 'dole') {
      const sd = Math.min(s, H * 0.8);
      return { hlavni: { x: 0, y: 0, w: W, h: H - sd }, ustrizek: { x: 0, y: H - sd, w: W, h: sd }, perforace: { x1: 0, y1: H - sd, x2: W, y2: H - sd } };
    }
    const sw = Math.min(s, W * 0.8);
    if (u.strana === 'vlevo') return { hlavni: { x: sw, y: 0, w: W - sw, h: H }, ustrizek: { x: 0, y: 0, w: sw, h: H }, perforace: { x1: sw, y1: 0, x2: sw, y2: H } };
    return { hlavni: { x: 0, y: 0, w: W - sw, h: H }, ustrizek: { x: W - sw, y: 0, w: sw, h: H }, perforace: { x1: W - sw, y1: 0, x2: W - sw, y2: H } };
  }

  // ---------- Code 128 (sady B a C) ----------
  const C128 = ('212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 ' +
    '221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 ' +
    '221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 ' +
    '212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 ' +
    '231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 ' +
    '231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 ' +
    '314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 ' +
    '112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 ' +
    '111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 ' +
    '214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 ' +
    '114131 311141 411131 211412 211214 211232 2331112').split(' ');
  function cislic(s, i) { let n = 0; while (i + n < s.length && s[i + n] >= '0' && s[i + n] <= '9') n++; return n; }
  /* vrací řetězec modulů '1' = čára, '0' = mezera (bez klidových zón) */
  function code128(text) {
    const s = String(text);
    if (!s.length) throw new Error('Prázdný text čárového kódu.');
    if (/[^\x20-\x7e]/.test(s)) throw new Error('Code 128 umí jen znaky ASCII bez diakritiky.');
    const h = [];
    let sada = (cislic(s, 0) >= 4 || (cislic(s, 0) === s.length && s.length % 2 === 0)) ? 'C' : 'B';
    h.push(sada === 'C' ? 105 : 104);
    let i = 0;
    while (i < s.length) {
      if (sada === 'C') {
        if (cislic(s, i) >= 2) { h.push(+s.substr(i, 2)); i += 2; continue; }
        sada = 'B'; h.push(100); continue;
      }
      const n = cislic(s, i);
      if (n >= 6 || (n >= 4 && i + n === s.length)) {
        if (n % 2) { h.push(s.charCodeAt(i) - 32); i++; }
        sada = 'C'; h.push(99); continue;
      }
      h.push(s.charCodeAt(i) - 32); i++;
    }
    let soucet = h[0];
    for (let j = 1; j < h.length; j++) soucet += h[j] * j;
    h.push(soucet % 103, 106);
    let m = '';
    for (const v of h) { const w = C128[v]; for (let j = 0; j < w.length; j++) m += (j % 2 ? '0' : '1').repeat(+w[j]); }
    return m;
  }

  // ---------- CSV ----------
  function csvPole(v) { const s = String(v == null ? '' : v); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function csvVydanych(kusyS) {
    const hl = ['poradi', 'kod', 'cislo', 'sektor', 'rada', 'misto', 'url'];
    const r = [hl.join(';')];
    for (const k of kusyS) r.push([k.poradi, k.kod, k.cislo, k.sedadlo ? k.sedadlo.sektor : '', k.sedadlo ? k.sedadlo.rada : '',
      k.sedadlo ? k.sedadlo.misto : '', k.promenne.url || ''].map(csvPole).join(';'));
    return r.join('\r\n') + '\r\n';
  }
  function parseCsv(text) {
    const t = String(text).replace(/^﻿/, '');
    const prvni = t.split(/\r?\n/)[0] || '';
    const odd = [';', ',', '\t'].map(o => [o, prvni.split(o).length]).sort((a, b) => b[1] - a[1])[0][0];
    const radky = []; let pole = [], s = '', uv = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (uv) {
        if (c === '"') { if (t[i + 1] === '"') { s += '"'; i++; } else uv = false; } else s += c;
      } else if (c === '"') uv = true;
      else if (c === odd) { pole.push(s); s = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; pole.push(s); radky.push(pole); pole = []; s = ''; }
      else s += c;
    }
    if (s || pole.length) { pole.push(s); radky.push(pole); }
    return radky.filter(r => r.some(x => x.trim() !== ''));
  }
  /* ze CSV vybere sloupec s kódy: podle hlavičky (kod/kód/code), jinak první sloupec.
     Vrací { kody:[…], info:{…} } – info = zbytek řádku pro zobrazení (např. sedadlo). */
  function kodyZCsv(text) {
    const r = parseCsv(text);
    if (!r.length) return { kody: [], info: {} };
    const hl = r[0].map(x => x.trim().toLowerCase());
    let sl = hl.findIndex(x => x === 'kod' || x === 'kód' || x === 'code' || x === 'kody' || x === 'kódy');
    let data = r;
    if (sl >= 0) data = r.slice(1); else sl = 0;
    const sR = hl.indexOf('rada'), sM = hl.indexOf('misto'), sS = hl.indexOf('sektor');
    const kody = [], info = {}, videne = new Set();
    for (const radek of data) {
      const k = (radek[sl] || '').trim();
      if (!k || videne.has(normalizuj(k))) continue;
      videne.add(normalizuj(k));
      kody.push(k);
      if (sR >= 0 && (radek[sR] || radek[sM])) info[normalizuj(k)] = [radek[sS], radek[sR] && 'řada ' + radek[sR], radek[sM] && 'místo ' + radek[sM]].filter(Boolean).join(', ');
    }
    return { kody, info };
  }

  // ---------- kontrola na vstupu ----------
  /* Z naskenovaného textu vytáhne kód: přímá shoda, parametr ?kod= / ?k= / ?code= v URL,
     poslední úsek cesty URL, nebo token z textu, který je v seznamu. */
  function extrahujKod(text, mapa) {
    const t = String(text || '').trim();
    if (!t) return '';
    if (mapa.has(normalizuj(t))) return t;
    try {
      const u = new URL(t);
      for (const p of ['kod', 'k', 'code', 'c', 'id', 'ticket']) { const v = u.searchParams.get(p); if (v && mapa.has(normalizuj(v))) return v; }
      const cesta = u.pathname.split('/').filter(Boolean).map(decodeURIComponent);
      for (let i = cesta.length - 1; i >= 0; i--) if (mapa.has(normalizuj(cesta[i]))) return cesta[i];
      if (u.hash && mapa.has(normalizuj(u.hash.slice(1)))) return u.hash.slice(1);
    } catch (_) { /* není URL */ }
    for (const tok of t.split(/[\s/?&=#:;,]+/)) if (tok && mapa.has(normalizuj(tok))) return tok;
    return t;
  }

  /* seznam: { kody:[…], pouzite:{ normKod: casISO }, nastaveni?: cislovani série }
     Vrací { stav:'platny'|'pouzity'|'neznamy'|'chyba_kontrolni'|'prazdny', kod, kdy? }.
     Platný kód se rovnou označí jako použitý (vrací i novy seznam.pouzite). */
  function zkontroluj(seznam, vstup, cas) {
    const mapa = new Map(seznam.kody.map(k => [normalizuj(k), k]));
    const kod = extrahujKod(vstup, mapa);
    const n = normalizuj(kod);
    if (!n) return { stav: 'prazdny', kod: '' };
    if (!mapa.has(n)) {
      const k = seznam.nastaveni ? overKontrolni(kod, seznam.nastaveni) : null;
      return { stav: k === false ? 'chyba_kontrolni' : 'neznamy', kod };
    }
    const puv = mapa.get(n);
    if (seznam.pouzite[n]) return { stav: 'pouzity', kod: puv, kdy: seznam.pouzite[n] };
    seznam.pouzite[n] = cas || new Date().toISOString();
    return { stav: 'platny', kod: puv, kdy: seznam.pouzite[n] };
  }

  function csvStavu(seznam) {
    const r = ['kod;stav;cas;info'];
    for (const k of seznam.kody) {
      const n = normalizuj(k), kdy = seznam.pouzite[n];
      r.push([k, kdy ? 'použitý' : 'nepoužitý', kdy || '', (seznam.info && seznam.info[n]) || ''].map(csvPole).join(';'));
    }
    return r.join('\r\n') + '\r\n';
  }

  // ---------- předlohy ----------
  /* Prvky: text s proměnnými, pozice v % oblasti (x,y = kotva), velikost písma v pt, oblast hlavni|ustrizek.
     zarovnani l|c|r, tucne, barva ('' = barva textu projektu), otoc (jen ústřižek: 90 = svisle). */
  const P = (text, x, y, pt, o) => Object.assign({ text, x, y, pt, oblast: 'hlavni', zarovnani: 'l', tucne: false, barva: '', otoc: 0 }, o || {});
  const PREDLOHY = {
    vstupenka: {
      nazev: '🎟️ Vstupenka s ústřižkem', rozmer: { w: 180, h: 65 }, ustrizek: { strana: 'vpravo', sirka: 45 },
      texty: { akce: 'Podzimní koncert', podtitul: 'Komorní orchestr města', datum: 'so 21. 11. 2026, 19:00', misto_konani: 'Městské divadlo', cena: '250 Kč', poznamka: 'Vstupenku si uschovejte do konce akce.' },
      pozadi: { druh: 'prechod', barva1: '#1d2b53', barva2: '#7e2553', uhel: 120 }, barvaTextu: '#ffffff',
      prvky: [P('{akce}', 6, 14, 20, { tucne: true }), P('{podtitul}', 6, 32, 10), P('{datum} · {misto_konani}', 6, 50, 11, { tucne: true }),
        P('Řada {rada}  Místo {misto}', 6, 66, 12, { tucne: true }), P('Cena {cena}', 6, 82, 10), P('{poznamka}', 6, 93, 6.5),
        P('Č. {kod}', 50, 10, 8, { oblast: 'ustrizek', zarovnani: 'c', tucne: true }), P('{akce}', 50, 22, 7, { oblast: 'ustrizek', zarovnani: 'c' }),
        P('ř. {rada} / m. {misto}', 50, 92, 8, { oblast: 'ustrizek', zarovnani: 'c', tucne: true })],
      qr: { zapnuto: true, obsah: '{kod}', url: '', oblast: 'ustrizek', x: 50, y: 56, mm: 26 },
      carovy: { zapnuto: false, obsah: '{kod}', oblast: 'hlavni', x: 78, y: 80, w: 40, h: 10 },
      cislovani: { rezim: 'nahodne', delka: 8, abeceda: 'bezpecna', kontrolni: 'luhn', skupiny: 4, predpona: '', pripona: '', pocet: 120 },
      sedadla: { zapnuto: true, text: 'A-F: 1-20\nvynechat: A1 A20' },
    },
    poukaz: {
      nazev: '🎁 Dárkový poukaz (DL)', rozmer: { w: 210, h: 99 }, ustrizek: { strana: 'zadny', sirka: 0 },
      texty: { akce: 'Dárkový poukaz', podtitul: 'Kavárna U Mlýna', cena: '500 Kč', datum: 'Platnost do 31. 12. 2027', misto_konani: 'Mlýnská 12, Brno', poznamka: 'Poukaz nelze směnit za hotovost.' },
      pozadi: { druh: 'prechod', barva1: '#fff4e0', barva2: '#f6c89f', uhel: 135 }, barvaTextu: '#3b2314',
      prvky: [P('{akce}', 8, 18, 26, { tucne: true }), P('{podtitul}', 8, 34, 13), P('v hodnotě', 8, 52, 10), P('{cena}', 8, 66, 24, { tucne: true }),
        P('{datum}', 8, 82, 9), P('{misto_konani} · {poznamka}', 8, 92, 7), P('Kód: {kod}', 92, 92, 9, { zarovnani: 'r', tucne: true })],
      qr: { zapnuto: true, obsah: '{kod}', url: '', oblast: 'hlavni', x: 85, y: 42, mm: 30 },
      carovy: { zapnuto: false, obsah: '{kod}', oblast: 'hlavni', x: 70, y: 80, w: 50, h: 10 },
      cislovani: { rezim: 'nahodne', delka: 10, abeceda: 'bezpecna', kontrolni: 'luhn', skupiny: 5, predpona: 'GV-', pripona: '', pocet: 30 },
      sedadla: { zapnuto: false, text: '' },
    },
    kupon: {
      nazev: '🏷️ Slevový kupón', rozmer: { w: 99, h: 55 }, ustrizek: { strana: 'zadny', sirka: 0 },
      texty: { akce: 'SLEVA 20 %', podtitul: 'na celý nákup', datum: 'Platí do 30. 11. 2026', misto_konani: 'www.obchod.cz', cena: '', poznamka: 'Jeden kupón na nákup.' },
      pozadi: { druh: 'barva', barva1: '#ffe14d', barva2: '#ffb000', uhel: 90 }, barvaTextu: '#1a1a1a',
      prvky: [P('{akce}', 6, 22, 22, { tucne: true }), P('{podtitul}', 6, 40, 10), P('{datum}', 6, 58, 8), P('{misto_konani}', 6, 70, 8),
        P('{kod}', 6, 88, 11, { tucne: true }), P('{poznamka}', 94, 94, 6, { zarovnani: 'r' })],
      qr: { zapnuto: true, obsah: 'url', url: 'https://www.obchod.cz/kupon?kod={kod}', oblast: 'hlavni', x: 80, y: 42, mm: 24 },
      carovy: { zapnuto: false, obsah: '{kod}', oblast: 'hlavni', x: 70, y: 80, w: 40, h: 8 },
      cislovani: { rezim: 'nahodne', delka: 6, abeceda: 'bezpecna', kontrolni: 'luhn', skupiny: 0, predpona: 'SL', pripona: '', pocet: 50 },
      sedadla: { zapnuto: false, text: '' },
    },
    tombola: {
      nazev: '🎰 Tombola – los + kontrolní ústřižek', rozmer: { w: 70, h: 30 }, ustrizek: { strana: 'vlevo', sirka: 22 },
      texty: { akce: 'Tombola', podtitul: 'Hasičský ples 2026', cena: '20 Kč', datum: '14. 2. 2026', misto_konani: '', poznamka: '' },
      pozadi: { druh: 'barva', barva1: '#e8f6ea', barva2: '#bfe6c6', uhel: 90 }, barvaTextu: '#123a1c',
      prvky: [P('{akce}', 6, 18, 9, { tucne: true }), P('{podtitul}', 6, 38, 6.5), P('{cislo}', 50, 72, 20, { tucne: true, zarovnani: 'c' }),
        P('{cena}', 94, 18, 7, { zarovnani: 'r' }),
        P('{cislo}', 50, 50, 13, { oblast: 'ustrizek', zarovnani: 'c', tucne: true }), P('kontrolní', 50, 85, 5.5, { oblast: 'ustrizek', zarovnani: 'c' })],
      qr: { zapnuto: false, obsah: '{kod}', url: '', oblast: 'hlavni', x: 85, y: 60, mm: 12 },
      carovy: { zapnuto: false, obsah: '{kod}', oblast: 'hlavni', x: 50, y: 85, w: 30, h: 5 },
      cislovani: { rezim: 'rada', od: 1, do: 300, krok: 1, nuly: 3, predpona: '', pripona: '', kontrolni: 'zadny' },
      sedadla: { zapnuto: false, text: '' },
    },
    satna: {
      nazev: '🧥 Šatnový lístek (dvojice)', rozmer: { w: 40, h: 60 }, ustrizek: { strana: 'dole', sirka: 26 },
      texty: { akce: 'ŠATNA', podtitul: 'Kulturní dům', cena: '', datum: '', misto_konani: '', poznamka: '' },
      pozadi: { druh: 'barva', barva1: '#ffffff', barva2: '#dddddd', uhel: 90 }, barvaTextu: '#111111',
      prvky: [P('{akce}', 50, 16, 8, { zarovnani: 'c', tucne: true }), P('{cislo}', 50, 58, 24, { zarovnani: 'c', tucne: true }), P('{podtitul}', 50, 90, 5.5, { zarovnani: 'c' }),
        P('{cislo}', 50, 45, 20, { oblast: 'ustrizek', zarovnani: 'c', tucne: true }), P('na věšák', 50, 85, 5.5, { oblast: 'ustrizek', zarovnani: 'c' })],
      qr: { zapnuto: false, obsah: '{kod}', url: '', oblast: 'hlavni', x: 50, y: 50, mm: 12 },
      carovy: { zapnuto: false, obsah: '{kod}', oblast: 'hlavni', x: 50, y: 80, w: 30, h: 5 },
      cislovani: { rezim: 'rada', od: 1, do: 200, krok: 1, nuly: 0, predpona: '', pripona: '', kontrolni: 'zadny' },
      sedadla: { zapnuto: false, text: '' },
    },
    stravenka: {
      nazev: '🍽️ Stravenka / jídelní lístek', rozmer: { w: 70, h: 40 }, ustrizek: { strana: 'zadny', sirka: 0 },
      texty: { akce: 'Oběd', podtitul: 'Letní tábor Bystřička', cena: 'Hlavní jídlo + polévka', datum: 'út 14. 7. 2026', misto_konani: 'Jídelna', poznamka: '' },
      pozadi: { druh: 'barva', barva1: '#eef4ff', barva2: '#cfdcff', uhel: 90 }, barvaTextu: '#0f234d',
      prvky: [P('🍽 {akce}', 6, 20, 13, { tucne: true }), P('{podtitul}', 6, 40, 7), P('{datum} · {misto_konani}', 6, 56, 7), P('{cena}', 6, 70, 7),
        P('č. {kod}', 6, 88, 7, { tucne: true })],
      qr: { zapnuto: true, obsah: '{kod}', url: '', oblast: 'hlavni', x: 82, y: 50, mm: 18 },
      carovy: { zapnuto: false, obsah: '{kod}', oblast: 'hlavni', x: 70, y: 85, w: 30, h: 6 },
      cislovani: { rezim: 'rada', od: 1, do: 80, krok: 1, nuly: 4, predpona: 'OB', pripona: '', kontrolni: 'damm' },
      sedadla: { zapnuto: false, text: '' },
    },
    parkovani: {
      nazev: '🅿️ Parkovací lístek', rozmer: { w: 80, h: 110 }, ustrizek: { strana: 'dole', sirka: 30 },
      texty: { akce: 'PARKOVÁNÍ', podtitul: 'Festival Na Louce', cena: 'Zaplaceno 100 Kč', datum: '8.–10. 8. 2026', misto_konani: 'Parkoviště P2', poznamka: 'Umístěte viditelně za čelní sklo.' },
      pozadi: { druh: 'barva', barva1: '#0b5cad', barva2: '#063a6e', uhel: 90 }, barvaTextu: '#ffffff',
      prvky: [P('P', 50, 20, 60, { zarovnani: 'c', tucne: true }), P('{akce}', 50, 46, 16, { zarovnani: 'c', tucne: true }), P('{podtitul}', 50, 58, 9, { zarovnani: 'c' }),
        P('{misto_konani} · {datum}', 50, 70, 8, { zarovnani: 'c' }), P('{cena}', 50, 80, 8, { zarovnani: 'c' }), P('č. {kod}', 50, 92, 11, { zarovnani: 'c', tucne: true }),
        P('{poznamka}', 6, 20, 6, { oblast: 'ustrizek' }), P('Kontrolní ústřižek č. {kod}', 6, 45, 8, { oblast: 'ustrizek', tucne: true })],
      qr: { zapnuto: true, obsah: '{kod}', url: '', oblast: 'ustrizek', x: 80, y: 50, mm: 20 },
      carovy: { zapnuto: true, obsah: '{kod}', oblast: 'ustrizek', x: 35, y: 78, w: 50, h: 7 },
      cislovani: { rezim: 'rada', od: 1, do: 150, krok: 1, nuly: 4, predpona: 'P2-', pripona: '', kontrolni: 'zadny' },
      sedadla: { zapnuto: false, text: '' },
    },
  };

  /* nový projekt z předlohy (hluboká kopie + výchozí tisk) */
  function novyProjekt(typ) {
    const p = PREDLOHY[typ] || PREDLOHY.vstupenka;
    const kopie = JSON.parse(JSON.stringify(p));
    delete kopie.nazev;
    return Object.assign({
      verze: 1, typ: PREDLOHY[typ] ? typ : 'vstupenka', nazev: p.nazev.replace(/^\S+\s/, ''),
      pismo: 'sans', logo: null, logoPozice: { oblast: 'hlavni', x: 88, y: 18, mm: 16 },
      ramecek: true, perforace: true,
      arch: { format: 'A4', w: 210, h: 297, okraj: 6, mezera: 0, otoceni: 'auto', znacky: true, obrys: false, tiskOd: '', tiskDo: '', dpi: '300' },
    }, kopie, {
      cislovani: Object.assign({ rezim: 'rada', od: 1, do: 100, krok: 1, nuly: 0, predpona: '', pripona: '', delka: 8,
        abeceda: 'bezpecna', kontrolni: 'zadny', skupiny: 0, seminko: nahodneSeminko(), pocet: 100, vynechatText: '' }, kopie.cislovani),
      pozadi: Object.assign({ druh: 'barva', barva1: '#ffffff', barva2: '#dddddd', uhel: 90, obrazek: null, zakryti: 0 }, kopie.pozadi),
    });
  }
  /* semínko z kryptografického generátoru – kódy pak nejde odvodit z jiných vstupenek */
  function nahodneSeminko() {
    const c = typeof globalThis !== 'undefined' && globalThis.crypto;
    if (c && c.getRandomValues) return Array.from(c.getRandomValues(new Uint32Array(4)), x => x.toString(36)).join('');
    return String(Math.random()).slice(2) + Date.now().toString(36);
  }

  const ROZMERY = {
    vlastni: { nazev: 'Vlastní' },
    dl: { nazev: 'DL / 1/3 A4 (210 × 99)', w: 210, h: 99 },
    vstupenka: { nazev: 'Vstupenka (180 × 65)', w: 180, h: 65 },
    vstupenka2: { nazev: 'Úzká vstupenka (150 × 55)', w: 150, h: 55 },
    a6: { nazev: 'A6 (148 × 105)', w: 148, h: 105 },
    a7: { nazev: 'A7 (105 × 74)', w: 105, h: 74 },
    vizitka: { nazev: 'Vizitka (85 × 55)', w: 85, h: 55 },
    kupon: { nazev: 'Kupón (99 × 55)', w: 99, h: 55 },
    los: { nazev: 'Los (70 × 30)', w: 70, h: 30 },
    satna: { nazev: 'Šatnový lístek (40 × 60)', w: 40, h: 60 },
  };

  const API = {
    ABECEDY, KONTROLNI, PREDLOHY, ROZMERY, ARCHY, MAX_KUSU,
    luhnModN, luhnModNPlatny, damm, dammPlatny, kontrolniZnak, kontrolniPlatny, overKontrolni,
    prng, nahodneSeminko, normalizuj, seskup, generujSerii, sedadla, doplnText, promenneKusu, kusy,
    rozlozeni, orezoveZnacky, oblasti, code128, csvVydanych, parseCsv, kodyZCsv, extrahujKod, zkontroluj, csvStavu, novyProjekt,
  };
  if (typeof module === 'object' && module.exports) module.exports = API;
  koren.VSTUPENKY = API;
})(typeof window !== 'undefined' ? window : globalThis);
