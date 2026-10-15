/* ============================================================
   prompty/interpunkce.js – doplnění české interpunkce podle pravidel
   (bez sítě, bez slovníku). Nepíše za autora: přidává jen to, co se
   dá z textu poznat s rozumnou jistotou.

     • čárka před podřadicí spojkou a vztažným zájmenem
       (že, aby, když, protože, který, co, kde, jak, …),
       u zájmena s předložkou před předložkou („o kterém“),
       u dvojic „i když“, „až když“, „jen aby“ před první částí;
     • čárka před odporovacími spojkami (ale, avšak, jenže, nýbrž,
       takže, neboť) a před „a proto / a tak / a tedy / a přesto“;
     • čárka na konci vedlejší věty před rozkazem
       („Pokud nevíš odpověď, napiš…“) – typická stavba promptu;
     • velké písmeno po tečce/otazníku/vykřičníku (mimo zkratky),
       mezery kolem znamének, české uvozovky „…“, pomlčka – a výpustka ….

   Nedotýká se bloků kódu ```…```, `kódu`, proměnných {{…}}, odkazů
   a e-mailů. Uzavírací čárku za vložená vedlejší věta („Muž, který
   přišel, je…“) bez rozboru věty doplnit nejde – to zůstává na autorovi.
   ============================================================ */
(function (koren) {
  'use strict';

  const sada = s => new Set(s.split(/\s+/).filter(Boolean));

  // spojky a zájmena uvozující vedlejší větu → čárka před nimi
  const PODRADICI = sada(`že aby abych abys abychom abyste kdyby kdybych kdybys kdybychom kdybyste když protože
    pokud jestli jestliže zda zdali ačkoli ačkoliv přestože třebaže zatímco jelikož poněvadž jakmile dokud
    kdežto kde kam kdy odkud kudy proč kolik kolika kolikrát`);
  // vztažná a tázací zájmena – mohou mít před sebou předložku
  const ZAJMENA = sada(`který která které kterého kterému kterém kterým kterou kteří kterých kterými
    jenž jež jehož jejž jemuž němž němuž nichž nimž nimiž jíž jejíž jejichž
    co čeho čemu čem čím kdo koho komu kom kým
    jaký jaká jaké jakého jakému jakém jakým jakou jací jakých jakými jak
    čí čího čímu čím čí čích čími`);
  const PREDLOZKY = sada(`v ve na o s se z ze k ke do od ode po při pro před přede za nad nade pod pode mezi bez beze u
    kvůli podle díky proti přes skrz vůči kromě místo během pomocí`);
  // před nimi čárka (souřadné poměry, kde se čárka píše)
  const ODPOROVACI = sada('ale avšak jenže nýbrž leč takže neboť tudíž');
  // „a proto“, „a tak“… → čárka před „a“
  const A_DUVOD = sada('proto tak tedy přesto přece dokonce');
  // slova, před kterými se čárka nepíše (souřadně připojené vedlejší věty)
  const SLUCOVACI = sada('a i ani nebo anebo či');
  // částice tvořící se spojkou celek – čárka jde před ně
  const CASTICE = sada('i až jen jenom teprve hlavně zvlášť zejména právě zrovna');
  const CASTICE_SPOJKY = sada('když kdyby aby pokud jestli protože');
  // po nich už čárka stojí před nimi („jako když“, „než aby“)
  const NEZAKLADAJI = sada('jako než');

  // časté rozkazy v promptech (+ zápor ne-, + množné -te)
  const ROZKAZY = (() => {
    const z = `napiš vytvoř shrň uveď vypiš odpověz odpovídej použij oprav přelož vysvětli zkus piš dej udělej zeptej navrhni
      vrať ukaž popiš zkontroluj doplň přepiš vygeneruj analyzuj porovnej najdi seřaď zformuluj zachovej uvažuj
      zvaž zohledni ignoruj označ rozděl spoj zkrať rozšiř přidej odstraň smaž změň uprav pokračuj začni skonči
      ohodnoť vyhodnoť spočítej vypočítej urči zjisti ověř navrhni sestav připrav zeptej řekni pošli vyber zvol
      formátuj strukturuj cituj odkaž zmiň upozorni varuj zastav počkej předpokládej představ zahraj buď
      měj vyhni drž nech přiznej`;
    const s = new Set();
    for (const w of z.split(/\s+/).filter(Boolean)) {
      s.add(w); s.add('ne' + w);
      if (/[ňťďřšžčj]$|[^aeiouyáéíóúůý]$/.test(w)) { s.add(w + 'te'); s.add('ne' + w + 'te'); }
      else if (/i$/.test(w)) { s.add(w.slice(0, -1) + 'ete'); s.add(w.slice(0, -1) + 'ěte'); }
    }
    ['ať', 'buďte', 'mějte', 'vysvětlete', 'navrhněte', 'zohledněte', 'zmiňte', 'odstraňte'].forEach(w => { s.add(w); s.add('ne' + w); });
    return s;
  })();

  const ZKRATKY = sada(`např tzv atd apod tj resp mj cca str č s r min max popř příp tzn aj ad viz srov kap obr tab odst písm sb ing mgr dr mudr judr phdr bc prof doc st ml p pí sl`);

  /* ---------- ochrana úseků, na které se nesahá ---------- */
  const OCHRANA = /```[\s\S]*?(?:```|$)|`[^`\n]*`|\{\{[^{}]*\}\}|"""|(?:https?:\/\/|www\.)[^\s]*[^\s.,;:!?)"'“”]|[\w.+-]+@[\w-]+\.[\w.]+/g;

  function zabal(text) {
    const kusy = [];
    const t = text.replace(OCHRANA, m => {
      kusy.push(m);
      return '' + String.fromCharCode(0xE100 + kusy.length - 1) + '';
    });
    return { t, kusy };
  }
  function rozbal(t, kusy) {
    return t.replace(/([-])/g, (m, c) => kusy[c.charCodeAt(0) - 0xE100]);
  }

  const RE_TOKEN = /[-]|[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*|[ \t]+|\n|./gu;
  const jeSlovo = t => /^[\p{L}\p{N}]/u.test(t) || t[0] === '';
  const male = t => t.toLowerCase();

  /* Hlavní funkce: vrátí { text, pocet } – počet provedených zásahů. */
  function dopln(vstup) {
    const { t, kusy } = zabal(String(vstup || ''));
    const radky = t.split('\n').map(r => {
      const nova = radek(r);
      return nova;
    });
    let vysl = radky.join('\n');

    function radek(r) {
      if (!r.trim()) return r;
      const tok = r.match(RE_TOKEN) || [];

      // --- 1) mezery a typografie na úrovni tokenů ---
      // mezera před , . ; : ! ? pryč (ne u výpustky na začátku)
      for (let i = 1; i < tok.length; i++) {
        if (/^[ \t]+$/.test(tok[i]) && /^[,;:!?.]$/.test(tok[i + 1] || '') && i > 0 && jeSlovo(tok[i - 1])) {
          // „1 . ledna“ ani odrážku nechávej
          tok.splice(i, 1);
        }
      }
      // mezera za čárkou a středníkem, není-li tam (ne mezi číslicemi 3,5)
      for (let i = 0; i < tok.length - 1; i++) {
        if ((tok[i] === ',' || tok[i] === ';') && jeSlovo(tok[i + 1]) &&
            !(tok[i] === ',' && /^\d/.test(tok[i + 1]) && /\d$/.test(tok[i - 1] || ''))) {
          tok.splice(i + 1, 0, ' ');
        }
      }

      // --- 2) čárky ---
      const slova = [];                 // indexy slovních tokenů
      tok.forEach((x, i) => { if (jeSlovo(x)) slova.push(i); });

      // předchozí neprázdný token před indexem i
      const predTok = i => { for (let j = i - 1; j >= 0; j--) if (!/^[ \t]+$/.test(tok[j])) return j; return -1; };
      const zacatekVety = j => j < 0 || /^[.!?:;,(\[„"“–—•*>#-]$|^\.\.\.$|^…$/.test(tok[j]) || /^\d+[.)]$/.test(tok[j]);
      const vlozene = new Set();        // indexy tokenů, za které se vloží čárka
      const carkaPred = i => {
        const j = predTok(i);
        if (zacatekVety(j) || !jeSlovo(tok[j]) && !/^[)"“”'’]$/.test(tok[j])) return false;
        if (vlozene.has(j)) return false;
        vlozene.add(j); return true;
      };

      let vedlejsi = false;

      for (let k = 0; k < slova.length; k++) {
        const i = slova[k];
        const w = male(tok[i]);
        const j = predTok(i);
        const predW = j >= 0 && jeSlovo(tok[j]) ? male(tok[j]) : null;
        const dalsi = k + 1 < slova.length ? male(tok[slova[k + 1]]) : '';

        // hranice věty/úseku: obnov stav
        if (zacatekVety(j)) {
          if (j >= 0 && /^[,;:–—(]$/.test(tok[j])) vedlejsi = false;
          if (j < 0 || /^[.!?:;]$/.test(tok[j])) vedlejsi = PODRADICI.has(w) || w === 'až';
          continue;
        }

        // 2a) rozkaz po vedlejší větě: „Pokud nevíš odpověď napiš…“,
        //     „Když najdeš chyby, tak je oprav“ (čárka před „tak/pak“)
        if (vedlejsi && /^(tak|pak|potom)$/.test(w) && !SLUCOVACI.has(predW)) {
          const blizko = slova.slice(k + 1, k + 4).filter(x => !tok.slice(i, x).some(y => /^[,.;:!?]$/.test(y)));
          if (blizko.some(x => ROZKAZY.has(male(tok[x])))) { carkaPred(i); vedlejsi = false; continue; }
        }
        if (vedlejsi && ROZKAZY.has(w) && !SLUCOVACI.has(predW)) {
          carkaPred(i);
          vedlejsi = false;
        }

        // 2b) „i když“, „až když“, „jen aby“ – čárka před částicí
        if (CASTICE.has(w) && CASTICE_SPOJKY.has(dalsi)) {
          if (!SLUCOVACI.has(predW)) carkaPred(i);
          vedlejsi = true;
          k++;                            // spojku za částicí přeskoč
          continue;
        }

        // 2c) „a proto“ → čárka před „a“
        if (w === 'a' && A_DUVOD.has(dalsi) && !(dalsi === 'tak' && /^(dále|podobně|dál)$/.test(male(tok[slova[k + 2]] || '')))) {
          carkaPred(i);
          continue;
        }

        // 2d) odporovací spojky
        if (ODPOROVACI.has(w)) {
          if (!SLUCOVACI.has(predW)) carkaPred(i);
          vedlejsi = false;
          continue;
        }

        // 2e) podřadicí spojky a vztažná zájmena
        const jeZajmeno = ZAJMENA.has(w);
        if (!PODRADICI.has(w) && !jeZajmeno) continue;
        if (SLUCOVACI.has(predW) || CASTICE.has(predW) || NEZAKLADAJI.has(predW)) { vedlejsi = true; continue; }
        // výjimky
        if (w === 'co' && (/^nej/.test(dalsi) || dalsi === 'možná' || dalsi === 'nejvíc')) continue;
        if (w === 'pokud' && dalsi === 'možno') continue;
        if (w === 'jak' && (dalsi === 'tak' || predW === 'tak' || predW === 'stejně')) continue;
        if (w === 'kolik' && predW === 'tolik') { carkaPred(i); vedlejsi = true; continue; }
        if (jeZajmeno && predW && PREDLOZKY.has(predW)) {
          // „…text o kterém…“ → čárka před předložkou
          const jj = predTok(j);
          const predPred = jj >= 0 && jeSlovo(tok[jj]) ? male(tok[jj]) : null;
          if (!zacatekVety(jj) && !SLUCOVACI.has(predPred) && jeSlovo(tok[jj]) && !vlozene.has(jj)) vlozene.add(jj);
          vedlejsi = true;
          continue;
        }
        if (predW && PREDLOZKY.has(predW)) continue;
        carkaPred(i);
        vedlejsi = true;
      }

      let out = '';
      tok.forEach((x, i) => { out += x; if (vlozene.has(i)) out += ','; });
      return out;
    }

    // --- 3) typografie na celém textu ---
    // velké písmeno po konci věty (mimo zkratky a pořadová čísla)
    vysl = vysl.replace(/([\p{L}\p{N})"“”]+)([.!?])([ \t]+)(\p{Ll})/gu, (m, slovo, zn, mez, pis) => {
      if (zn === '.' && (ZKRATKY.has(male(slovo).replace(/[^\p{L}]/gu, '')) || /^\d+$/.test(slovo) || slovo.length === 1)) return m;
      return slovo + zn + mez + pis.toUpperCase();
    });
    // pomlčka mezi slovy: „a - b“ → „a – b“ (odrážky na začátku řádku nechá)
    vysl = vysl.replace(/(\S)[ \t]+-{1,2}[ \t]+(?=\S)/g, '$1 – ');
    // výpustka
    vysl = vysl.replace(/(^|[^.])\.\.\.(?!\.)/g, '$1…');
    // rovné uvozovky v páru na jednom řádku → „…“
    vysl = vysl.split('\n').map(r => {
      const n = (r.match(/"/g) || []).length;
      if (n < 2 || n % 2 || /[{}\[\]]|":/.test(r)) return r;   // JSON a podobné nech být
      let otevrena = false;
      return r.replace(/"/g, (m, i) => {
        const pred = r[i - 1] || ' ', za = r[i + 1] || ' ';
        if (!otevrena && /[\s(\[–—:\/]|^$/.test(pred) && /\S/.test(za)) { otevrena = true; return '„'; }
        if (otevrena && /\S/.test(pred)) { otevrena = false; return '“'; }
        return m;
      });
    }).join('\n');
    const text = rozbal(vysl, kusy);
    // počet zásahů = počet změněných míst v rozdílu
    let n = 0, predZmena = false;
    for (const d of rozdil(String(vstup || ''), text)) {
      const zm = d.typ !== '=';
      if (zm && !predZmena) n++;
      predZmena = zm;
    }
    return { text, pocet: n };
  }

  /* Rozdíl po slovech (LCS) – pro náhled změn. Vrací [{typ:'='|'+'|'-', t}] */
  function rozdil(a, b) {
    const ta = a.match(/\s+|[\p{L}\p{N}]+|./gsu) || [], tb = b.match(/\s+|[\p{L}\p{N}]+|./gsu) || [];
    // společný začátek a konec zkrátí tabulku
    let z = 0; while (z < ta.length && z < tb.length && ta[z] === tb[z]) z++;
    let k = 0; while (k < ta.length - z && k < tb.length - z && ta[ta.length - 1 - k] === tb[tb.length - 1 - k]) k++;
    const A = ta.slice(z, ta.length - k), B = tb.slice(z, tb.length - k);
    const out = [];
    if (z) out.push({ typ: '=', t: ta.slice(0, z).join('') });
    if (A.length * B.length > 4e6) {             // příliš velké – hrubý náhled
      if (A.length) out.push({ typ: '-', t: A.join('') });
      if (B.length) out.push({ typ: '+', t: B.join('') });
    } else {
      const m = A.length, n = B.length;
      const L = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
      for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--)
        L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
      let i = 0, j = 0;
      const pridej = (typ, t) => { const p = out[out.length - 1]; if (p && p.typ === typ) p.t += t; else out.push({ typ, t }); };
      while (i < m && j < n) {
        if (A[i] === B[j]) { pridej('=', A[i]); i++; j++; }
        else if (L[i + 1][j] >= L[i][j + 1]) { pridej('-', A[i]); i++; }
        else { pridej('+', B[j]); j++; }
      }
      while (i < m) pridej('-', A[i++]);
      while (j < n) pridej('+', B[j++]);
    }
    if (k) { const p = out[out.length - 1]; const t = ta.slice(ta.length - k).join(''); if (p && p.typ === '=') p.t += t; else out.push({ typ: '=', t }); }
    return out;
  }

  /* ============================================================
     Diakritika – háčky a čárky podle slovníku (prompty/diakritika.js).
     Slovo bez diakritiky se nahradí nejčastějším tvarem; nejednoznačná
     (může/muže, dobře/dobré, ze/že…) se vrátí s možnostmi k přepnutí.
     ============================================================ */
  const BEZ = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const MA_DIA = /[áčďéěíňóřšťúůýž]/i;

  function nactiSlovnik(data) {
    const m = new Map();
    let pred = '';
    for (const r of String(data).split('\n')) {
      if (!r) continue;
      pred = pred.slice(0, r.charCodeAt(0) - 48) + r.slice(1);
      const f = pred.split('|');
      const platnyBez = f[f.length - 1] === '~';
      if (platnyBez) f.pop();
      m.set(BEZ(f[0]), { tvary: f, platnyBez: platnyBez || f.includes(BEZ(f[0])) });
    }
    return m;
  }

  // anglické řádky se nechávají být (the → thé, file → filé)
  const ANGL = sada('the and of to is are you your with for in on this that be as it or if not use write should will an by from each only must do don\'t can');
  const NIKDY = sada('the file line');
  // po „ze“ následuje s/z/š/ž – ale „že se“, „že si“… jsou častější
  const ZE_NE = sada('se si sis ses sem snad zase zas zrovna skoro sotva stejně sám sama sami samo spolu zatím zítra stačí stále sice');

  const velikost = (vzor, w) =>
    vzor.length > 1 && vzor === vzor.toUpperCase() ? w.toUpperCase()
      : vzor[0] !== vzor[0].toLowerCase() ? w[0].toUpperCase() + w.slice(1) : w;

  /* Vrací { kusy, pocet, nejiste }: kusy = text rozdělený na řetězce
     (beze změny) a objekty { puv, moznosti, vyber } (měněné slovo). */
  function diakritika(vstup, slovnik) {
    const { t, kusy: chranene } = zabal(String(vstup || ''));
    const slova = t.match(/\p{L}+/gu) || [];
    // text, který diakritiku většinou už má → měnit jen slova, která bez ní neexistují
    const sDia = slova.filter(w => MA_DIA.test(w)).length;
    const smiseny = slova.length > 3 && sDia / slova.length > 0.12;
    const out = [];
    let pocet = 0, nejiste = 0;
    const pridejText = x => { if (!x) return; if (typeof out[out.length - 1] === 'string') out[out.length - 1] += x; else out.push(x); };

    for (const radek of t.split(/(\n)/)) {
      const rs = radek.match(/\p{L}+/gu) || [];
      const angl = rs.filter(w => ANGL.has(w.toLowerCase())).length;
      if (angl >= 2 && angl >= rs.length * 0.2) { pridejText(radek); continue; }
      const tok = radek.match(/\p{L}+|[^\p{L}]+/gu) || [];
      for (let i = 0; i < tok.length; i++) {
        const w = tok[i];
        if (!/^\p{L}/u.test(w) || MA_DIA.test(w) || /\p{Lu}/u.test(w.slice(1)) && w !== w.toUpperCase()) { pridejText(w); continue; }
        // součást identifikátoru (snake_case, slovo.slovo, čísla) nech být
        const pred = tok[i - 1] || '', za = tok[i + 1] || '';
        if (/[_\d\/\\@.]$/.test(pred) && !/\s$/.test(pred) || /^[_\d@]/.test(za) || /^\.\p{L}/u.test(za)) { pridejText(w); continue; }
        const k = w.toLowerCase();
        if (NIKDY.has(k)) { pridejText(w); continue; }
        const z = slovnik.get(k);
        if (!z) { pridejText(w); continue; }
        let moznosti = z.tvary.slice();
        if (k === 'ze') {
          const dalsi = (tok[i + 2] || '').toLowerCase();
          const jeZe = /^(s|z|š|ž|ř|vš|mn|dn|tř|kt|ps|pt|lv)/.test(dalsi) && !ZE_NE.has(BEZ(dalsi)) && !/,\s*$/.test(pred);
          moznosti = jeZe ? ['ze', 'že'] : ['že', 'ze'];
        } else if (smiseny && z.tvary.includes(k)) {
          // autor diakritiku jinak píše a tvar bez ní je běžné slovo („dal“) → nech
          if (!moznosti.includes(k)) moznosti.push(k);
          moznosti = [k].concat(moznosti.filter(x => x !== k));
        }
        if (moznosti.length > 1 && !moznosti.includes(k) && z.platnyBez) moznosti.push(k);
        // na konci věty je spíš příslovce než přídavné jméno: „napiš česky.“, „je to dobře.“
        const konecVety = /\n/.test(za) || /^[^\S\n]*[.,;:!?)]/.test(za) || (/^[^\S\n]*$/.test(za) && (tok[i + 2] === undefined || /^[.,;:!?)\n]/.test(tok[i + 2])));
        if (moznosti.length > 1 && /[ýé]$/.test(moznosti[0]) && konecVety) {
          const pr = moznosti.findIndex((x, j) => j > 0 && x.slice(0, -1) === moznosti[0].slice(0, -1) && /[yeě]$/.test(x));
          if (pr > 0) moznosti = [moznosti[pr]].concat(moznosti.filter((x, j) => j !== pr));
        }
        moznosti = moznosti.map(x => velikost(w, x));
        if (moznosti[0] === w && moznosti.length === 1) { pridejText(w); continue; }
        const nej = moznosti.length > 1;
        if (moznosti[0] !== w) pocet++;
        if (nej) nejiste++;
        out.push({ puv: w, moznosti, vyber: 0, nejiste: nej });
      }
    }
    // vrátit chráněné úseky
    const kusy = out.map(x => typeof x === 'string' ? rozbal(x, chranene) : x);
    return { kusy, pocet, nejiste };
  }

  const slozText = kusy => kusy.map(x => typeof x === 'string' ? x : x.moznosti[x.vyber]).join('');

  const api = { dopln, rozdil, nactiSlovnik, diakritika, slozText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else koren.PROMPTY_INTERPUNKCE = api;
})(typeof window !== 'undefined' ? window : globalThis);
