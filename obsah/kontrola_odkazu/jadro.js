/* Kontrola odkazu – offline rozbor adresy z SMS/e-mailu. Nic neodesílá, nic neotevírá.
   window.KONTROLA_ODKAZU / module.exports: rozeber(text) → { chyba } | { url, casti, nalezy, semafor }
   Váhy nálezů: vysoka → červená; stredni nebo ≥ 2× nizka → oranžová; jinak zelená. */
(function (koren) {
  'use strict';

  // Víceúrovňové veřejné přípony (výběr z Public Suffix List – běžné případy).
  const PRIPONY = new Set(('co.uk org.uk ac.uk gov.uk me.uk ltd.uk plc.uk net.uk sch.uk nhs.uk ' +
    'com.au net.au org.au edu.au gov.au id.au co.nz org.nz net.nz govt.nz co.jp ne.jp or.jp ac.jp go.jp ' +
    'co.kr or.kr com.br net.br org.br gov.br com.cn net.cn org.cn gov.cn com.tw com.hk co.in net.in org.in ' +
    'gov.in co.za org.za com.mx com.ar com.tr gov.tr com.ua org.ua com.pl net.pl org.pl co.il com.sg ' +
    'com.my co.id com.ph com.vn co.th in.th com.eg com.sa com.ng co.ke com.pk com.co com.pe ' +
    'eu.com uk.com us.com').split(' '));
  // Hostingy, kde si stránku pod vlastní subdoménou založí kdokoli (také v Public Suffix List).
  const HOSTINGY = new Set(('github.io gitlab.io netlify.app vercel.app pages.dev workers.dev web.app ' +
    'firebaseapp.com herokuapp.com azurewebsites.net blogspot.com wixsite.com weebly.com glitch.me ' +
    'ngrok.io ngrok-free.app r2.dev webflow.io 000webhostapp.com appspot.com onrender.com repl.co ' +
    'surge.sh square.site carrd.co godaddysites.com mystrikingly.com').split(' '));
  const ZKRACOVACE = new Set(('bit.ly tinyurl.com t.co goo.gl ow.ly is.gd buff.ly cutt.ly rebrand.ly rb.gy ' +
    'shorturl.at t.ly tiny.cc s.id v.gd bit.do lnkd.in qrco.de amzn.to x.co shorte.st adf.ly tr.im ' +
    'clck.ru u.to soo.gd short.gy').split(' '));
  const DIVNE_KONCOVKY = new Set(('top xyz icu shop club online site live buzz cyou rest sbs cfd click ' +
    'link monster quest bond lat mom store vip win loan work support fun space website pw tk ml ga cf gq').split(' '));
  // Slova, která podvodníci dávají do adres (bez diakritiky). Krátká se hledají jen jako celé slovo.
  const SLOVA = ('login signin logon verify verification overeni overit overte potvrzeni potvrdit confirm ' +
    'platba platby zaplatit doplatek doplatit payment secure security bezpecnost update aktualizace ' +
    'aktualizovat account unlock odblokovat odblokovani blokace wallet banking prihlaseni prihlasit ' +
    'heslo password refund vraceni celni doruceni').split(' ');
  const SLOVA_KRATKA = new Set('pay clo ucet uctu card karta auth'.split(' '));
  const NEBEZPECNE_SOUBORY = /\.(apk|exe|scr|msi|bat|cmd|vbs|jar|ps1|dmg|pkg)$/i;

  // Známé značky s pravými doménami. k = hledat jako podřetězec (≥ 5 znaků), t = jen jako celé slovo.
  const ZNACKY = [
    { n: 'Česká pošta', d: ['ceskaposta.cz'], k: ['ceskaposta'], t: ['posta'] },
    { n: 'Zásilkovna (Packeta)', d: ['zasilkovna.cz', 'packeta.com'], k: ['zasilkovna', 'packeta'] },
    { n: 'PPL', d: ['ppl.cz'], t: ['ppl'] },
    { n: 'DPD', d: ['dpd.cz', 'dpd.com'], t: ['dpd'] },
    { n: 'GLS', d: ['gls-group.eu', 'gls-group.com'], t: ['gls'] },
    { n: 'DHL', d: ['dhl.com', 'dhl.de'], t: ['dhl'] },
    { n: 'ČSOB', d: ['csob.cz'], t: ['csob'] },
    { n: 'Komerční banka', d: ['kb.cz'], k: ['komercnibanka'], t: ['kb'] },
    { n: 'Česká spořitelna', d: ['csas.cz'], k: ['ceskasporitelna'], t: ['csas', 'sporitelna', 'george'] },
    { n: 'Raiffeisenbank', d: ['rb.cz'], k: ['raiffeisen'], t: ['rb'] },
    { n: 'MONETA Money Bank', d: ['moneta.cz'], t: ['moneta'] },
    { n: 'Fio banka', d: ['fio.cz'], t: ['fio'] },
    { n: 'Air Bank', d: ['airbank.cz'], k: ['airbank'] },
    { n: 'mBank', d: ['mbank.cz'], k: ['mbank'] },
    { n: 'UniCredit Bank', d: ['unicreditbank.cz'], k: ['unicredit'] },
    { n: 'Portál veřejné správy', d: ['gov.cz'], t: ['gov'] },
    { n: 'Datová schránka', d: ['mojedatovaschranka.cz'], k: ['datovaschranka'] },
    { n: 'Identita občana', d: ['identitaobcana.cz'], k: ['identitaobcana'] },
    { n: 'Finanční správa', d: ['financnisprava.cz'], k: ['financnisprava'] },
    { n: 'ČSSZ', d: ['cssz.cz'], t: ['cssz'] },
    { n: 'Seznam.cz', d: ['seznam.cz', 'email.cz'], t: ['seznam'] },
    { n: 'Google', d: ['google.com', 'google.cz', 'gmail.com', 'youtube.com', 'forms.gle'], k: ['google', 'gmail'] },
    { n: 'Microsoft', d: ['microsoft.com', 'live.com', 'outlook.com', 'office.com', 'hotmail.com', 'microsoftonline.com'], k: ['microsoft', 'outlook', 'office365', 'hotmail'] },
    { n: 'Apple', d: ['apple.com', 'icloud.com'], k: ['apple', 'icloud'] },
    { n: 'PayPal', d: ['paypal.com', 'paypal.me'], k: ['paypal'] },
    { n: 'Meta (Facebook, Instagram, WhatsApp)', d: ['facebook.com', 'fb.com', 'meta.com', 'instagram.com', 'whatsapp.com'], k: ['facebook', 'instagram', 'whatsapp'] },
    { n: 'Netflix', d: ['netflix.com'], k: ['netflix'] },
    { n: 'Revolut', d: ['revolut.com'], k: ['revolut'] },
    { n: 'Amazon', d: ['amazon.com', 'amazon.de', 'amazon.co.uk', 'amzn.to'], k: ['amazon'] },
    { n: 'Vinted', d: ['vinted.cz', 'vinted.com'], k: ['vinted'] },
    { n: 'Bazoš', d: ['bazos.cz', 'bazos.sk'], k: ['bazos'] },
    { n: 'Sbazar', d: ['sbazar.cz'], k: ['sbazar'] },
    { n: 'Aukro', d: ['aukro.cz'], k: ['aukro'] },
    { n: 'Alza', d: ['alza.cz', 'alza.sk'], t: ['alza'] },
    { n: 'O2', d: ['o2.cz'], t: ['o2'] },
    { n: 'T-Mobile', d: ['t-mobile.cz'], k: ['tmobile'] },
    { n: 'Vodafone', d: ['vodafone.cz'], k: ['vodafone'] },
    { n: 'ČEZ', d: ['cez.cz'], t: ['cez'] },
  ];

  // Znaky, které vypadají jako latinka (cyrilice, řečtina, zvláštní latinka) → latinka.
  const PODOBNE = {
    'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'і': 'i', 'ј': 'j', 'ѕ': 's',
    'ԁ': 'd', 'һ': 'h', 'ӏ': 'l', 'ԛ': 'q', 'ԝ': 'w', 'к': 'k', 'ѵ': 'v', 'ү': 'y', 'ɡ': 'g', 'ɩ': 'i',
    'ο': 'o', 'α': 'a', 'ρ': 'p', 'ε': 'e', 'ι': 'i', 'κ': 'k', 'ν': 'v', 'τ': 't', 'υ': 'u', 'χ': 'x',
    'ı': 'i', 'ɑ': 'a', 'ł': 'l', 'ß': 'ss',
  };
  const PISMO = ch => {
    const c = ch.codePointAt(0);
    if (/[a-z]/.test(ch) || (c >= 0xC0 && c <= 0x24F) || (c >= 0x1E00 && c <= 0x1EFF) || ch === 'ɡ' || ch === 'ɩ' || ch === 'ɑ') return 'latinka';
    if (c >= 0x400 && c <= 0x52F) return 'cyrilice';
    if (c >= 0x370 && c <= 0x3FF) return 'řečtina';
    if (/[0-9-]/.test(ch)) return null;
    return 'jiné písmo';
  };

  const bezDiakritiky = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  // „Kostra“ jména: co vypadá stejně, má stejnou kostru (0→o, 1/i→l, rn→m, vv→w, cl→d, homoglyfy).
  function kostra(s) {
    s = [...s.toLowerCase()].map(ch => PODOBNE[ch] || ch).join('');
    return bezDiakritiky(s).replace(/0/g, 'o').replace(/[1i|!]/g, 'l').replace(/3/g, 'e').replace(/5/g, 's')
      .replace(/rn/g, 'm').replace(/vv/g, 'w').replace(/cl/g, 'd');
  }

  // Damerau-Levenshtein (OSA) – překlepy a prohozená písmena.
  function vzdalenost(a, b) {
    const d = [];
    for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (let j = 0; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[a.length][b.length];
  }

  // Punycode (RFC 3492) – dekódování štítku xn--…
  function punyDekoduj(vstup) {
    const base = 36, tMin = 1, tMax = 26, skew = 38, damp = 700;
    const adapt = (delta, pocet, prvni) => {
      delta = prvni ? Math.floor(delta / damp) : delta >> 1;
      delta += Math.floor(delta / pocet);
      let k = 0;
      while (delta > ((base - tMin) * tMax) >> 1) { delta = Math.floor(delta / (base - tMin)); k += base; }
      return k + Math.floor((base - tMin + 1) * delta / (delta + skew));
    };
    let n = 128, i = 0, bias = 72;
    const out = [];
    const b = Math.max(vstup.lastIndexOf('-'), 0);
    for (let j = 0; j < b; j++) out.push(vstup.charCodeAt(j));
    for (let idx = b > 0 ? b + 1 : 0; idx < vstup.length;) {
      const stare = i;
      for (let w = 1, k = base; ; k += base) {
        if (idx >= vstup.length) throw new Error('punycode');
        const c = vstup.charCodeAt(idx++);
        const cif = c - 48 < 10 ? c - 22 : c - 65 < 26 ? c - 65 : c - 97 < 26 ? c - 97 : base;
        if (cif >= base) throw new Error('punycode');
        i += cif * w;
        const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
        if (cif < t) break;
        w *= base - t;
      }
      bias = adapt(i - stare, out.length + 1, stare === 0);
      n += Math.floor(i / (out.length + 1));
      i %= out.length + 1;
      out.splice(i++, 0, n);
    }
    return String.fromCodePoint(...out);
  }
  const naUnicode = host => host.split('.').map(l => {
    if (!l.startsWith('xn--')) return l;
    try { return punyDekoduj(l.slice(4)); } catch (e) { return l; }
  }).join('.');

  // Najde v textu (třeba celé SMS) odkazy; vrací pole řetězců.
  function najdiOdkazy(text) {
    const s = String(text || '');
    let m = s.match(/\b(?:[a-z][a-z0-9+.-]*:\/\/|www\.)[^\s<>"'„“]+/gi);
    if (!m) m = s.match(/(?:^|[\s(])((?:javascript|data):[^\s]+)/gi);
    if (!m) m = s.match(/[^\s<>"'„“@(]*@?[^\s<>"'„“()]+\.[a-z\u00a1-\uffff]{2,}(?::\d+)?(?:[/?#][^\s<>"'„“]*)?/gi);
    return (m || []).map(x => x.trim().replace(/^\(/, '').replace(/[.,;:!?)\]}"'“]+$/, ''));
  }

  function rozdelHost(host) {
    const st = host.split('.');
    let delka = 1;
    if (st.length >= 3 && (PRIPONY.has(st.slice(-2).join('.')) || HOSTINGY.has(st.slice(-2).join('.')))) delka = 2;
    if (st.length >= 4 && HOSTINGY.has(st.slice(-3).join('.'))) delka = 3;
    const pripona = st.slice(-delka).join('.');
    if (st.length <= delka) return { pripona, registrovana: host, jmeno: '', subdomena: '' };
    return {
      pripona,
      jmeno: st[st.length - delka - 1],
      registrovana: st.slice(-delka - 1).join('.'),
      subdomena: st.slice(0, -delka - 1).join('.'),
    };
  }

  const tokeny = s => s.split(/[^a-z0-9]+/).filter(Boolean);
  const maToken = (toks, klic) => toks.some(t => t === klic || t === klic + 'cz' || new RegExp('^' + klic + '\\d+$').test(t));

  function rozeber(text) {
    const odkazy = najdiOdkazy(text);
    if (!odkazy.length) return { chyba: 'V textu jsem nenašel žádný odkaz. Vložte adresu, třeba z SMS nebo e-mailu.' };
    const syrovy = odkazy[0];
    const nalezy = [];
    const pridej = (vaha, titulek, text) => nalezy.push({ vaha, titulek, text });
    if (odkazy.length > 1) pridej('info', 'V textu je víc odkazů', `Rozebírám první z nich (celkem ${odkazy.length}). Ostatní vložte zvlášť.`);

    // Nebezpečná schémata
    const schema = (syrovy.match(/^([a-z][a-z0-9+.-]*):/i) || [])[1];
    if (schema && /^(javascript|data|vbscript)$/i.test(schema)) {
      pridej('vysoka', 'Nejde o webovou adresu, ale o kód', 'Odkaz začínající „' + schema.toLowerCase() + ':“ spustí kód nebo otevře obsah přímo v prohlížeči. Normální zprávy takové odkazy neposílají.');
      return vysledek(syrovy, null, nalezy);
    }
    const sProtokolem = /^[a-z][a-z0-9+.-]*:\/\//i.test(syrovy);
    let url;
    try { url = new URL(sProtokolem ? syrovy : 'http://' + syrovy); }
    catch (e) { return { chyba: 'Tohle se jako webová adresa rozebrat nedá. Zkontrolujte, že jste zkopírovali celý odkaz.' }; }

    const protokol = sProtokolem ? url.protocol.replace(':', '') : '';
    const host = url.hostname.replace(/\.$/, '').toLowerCase();
    const hostU = naUnicode(host);
    const casti = { protokol, host, hostUnicode: hostU, port: url.port, uzivatel: decodeURIComponent(url.username + (url.password ? ':' + url.password : '')),
      cesta: url.pathname, dotaz: url.search + url.hash, ip: false };

    // Protokol
    if (!protokol) pridej('info', 'Odkaz nemá uvedený protokol', 'Prohlížeč si doplní http:// nebo https://. Na rozbor domény to vliv nemá.');
    else if (protokol === 'http') pridej('nizka', 'Nezabezpečené spojení (http)', 'Data mezi vámi a stránkou nejsou šifrovaná. Banky, úřady ani dopravci dnes přihlašování ani platby přes http nedělají.');
    else if (protokol === 'https') pridej('info', 'Šifrované spojení (https) – to ale neznamená bezpečí', 'Zámeček jen říká, že spojení nikdo cestou nepřečte. Certifikát si zdarma pořídí i podvodník, takže https nic neříká o tom, kdo stránku provozuje.');
    else pridej('stredni', 'Neobvyklý protokol', `Odkaz používá „${protokol}:“ místo běžného https. U zpráv od firem je to nezvyklé.`);

    // Uživatelská část před @
    if (casti.uzivatel) pridej('vysoka', 'Zavináč v adrese – začátek je jen kamufláž', `Vše před znakem @ („${casti.uzivatel}“) prohlížeč bere jen jako přihlašovací jméno. Skutečná adresa je až za zavináčem: ${hostU}.`);

    // IP adresa místo domény
    const surovyHost = (syrovy.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split(/[/?#]/)[0].split('@').pop().replace(/:\d+$/, '')).toLowerCase();
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[')) {
      casti.ip = true;
      pridej('vysoka', 'Místo jména je číselná IP adresa', 'Firmy a úřady posílají odkazy se svým jménem (doménou). Holá IP adresa skrývá, komu server patří.');
      if (surovyHost !== host && !host.startsWith('[')) pridej('vysoka', 'IP adresa je zapsaná zakódovaně', `V odkazu je „${surovyHost}“, prohlížeč z toho udělá ${host}. Takové maskování používají skoro jen podvodníci.`);
    }

    // Port
    if (url.port) pridej('stredni', 'Neobvyklý port', `Za doménou je „:${url.port}“. Běžné stránky port v adrese nemají; u zprávy od banky nebo dopravce je to podezřelé.`);

    let r = { pripona: '', registrovana: host, jmeno: '', subdomena: '' };
    let znamaZnacka = null;
    if (!casti.ip && host) {
      r = rozdelHost(host);
      const rU = rozdelHost(hostU);
      Object.assign(casti, { registrovana: r.registrovana, registrovanaUnicode: rU.registrovana, subdomena: rU.subdomena, pripona: r.pripona });

      // Punycode a písma
      if (host.split('.').some(l => l.startsWith('xn--'))) {
        pridej('stredni', 'Doména obsahuje mezinárodní znaky (punycode)', `V adrese je zakódovaný tvar „${host}“, který se zobrazí jako „${hostU}“. Často jde jen o háčky a čárky, ale stejným trikem se dají napodobit cizí písmena, která vypadají jako latinka.`);
      }
      for (const stitek of hostU.split('.')) {
        const pisma = new Set([...stitek].map(PISMO).filter(Boolean));
        const podobne = [...stitek].filter(ch => PODOBNE[ch]);
        if (pisma.size > 1) {
          pridej('vysoka', 'Smíchaná písma v doméně', `Část „${stitek}“ kombinuje ${[...pisma].join(' a ')}. Písmena z cyrilice nebo řečtiny vypadají stejně jako latinka, ale jde o úplně jinou adresu (homoglyfy).`);
        } else if (pisma.size === 1 && !pisma.has('latinka') && podobne.length === [...stitek].length) {
          pridej('vysoka', 'Doména je celá z písmen, která jen vypadají jako latinka', `Část „${stitek}“ vypadá jako „${kostra(stitek)}“, ale je napsaná cizím písmem. Jde o úplně jinou adresu.`);
        }
      }

      // Známé značky
      const kostraJmena = kostra(rU.jmeno || rU.registrovana);
      const jmenoBez = bezDiakritiky(rU.jmeno.toLowerCase());
      const subdom = bezDiakritiky(rU.subdomena.toLowerCase());
      const tokJmeno = tokeny(jmenoBez), tokSub = tokeny(subdom);
      const kostraJmenaBezPomlcek = kostraJmena.replace(/-/g, '');
      const cesta = bezDiakritiky(safeDecode(url.pathname + url.search).toLowerCase());
      const tokCesta = tokeny(cesta);
      const varovane = new Set();
      znamaZnacka = ZNACKY.find(z => z.d.includes(r.registrovana)) || null;
      if (znamaZnacka) {
        pridej('ok', `Doména patří: ${znamaZnacka.n}`, `${r.registrovana} je pravá adresa (podle našeho malého seznamu). I tak platí: do banky a na úřady choďte přes vlastní aplikaci nebo ručně zadanou adresu, ne přes odkaz ze zprávy.`);
      }
      for (const z of ZNACKY) {
        if (z === znamaZnacka) continue;
        const varuj = (vaha, titulek, text) => { if (!varovane.has(z)) { varovane.add(z); pridej(vaha, titulek, text); } };
        const prave = z.d.join(', ');
        // 1) Pravá doména značky v subdoméně cizí domény: ceskaposta.cz.neco.example
        const plna = z.d.find(d => new RegExp('(^|[.-])' + d.replace(/[.-]/g, '[.-]') + '($|[.-])').test(subdom));
        if (plna) { varuj('vysoka', `Adresa se tváří jako ${plna}, ale patří jinam`, `Začátek adresy „${rU.subdomena}.“ je jen ozdoba – kdokoli si ho k vlastní doméně dopíše. Rozhoduje konec: skutečná doména je ${rU.registrovana}. Pravá adresa (${z.n}) je ${prave}.`); continue; }
        for (const d of z.d) {
          const rz = rozdelHost(d);
          const L = rz.jmeno, kL = kostra(L);
          if (!L || !rU.jmeno) continue;
          if (jmenoBez === L && r.pripona !== rz.pripona) {
            if (HOSTINGY.has(r.pripona)) varuj('vysoka', `Napodobenina značky ${z.n} na bezplatném hostingu`, `Stránku ${rU.registrovana} si může založit kdokoli. Pravá adresa je ${prave}.`);
            else varuj('stredni', `Stejné jméno jako ${z.n}, ale jiná koncovka`, `Tady je ${rU.registrovana}, pravá adresa je ${prave}. Může jít o jinou firmu, ale podvodníci rádi zabírají stejné jméno s jinou koncovkou.`);
          } else if (jmenoBez !== L && (kostraJmena === kL || kostraJmenaBezPomlcek === kL)) {
            varuj('vysoka', `Napodobenina adresy ${d}`, `Jméno „${rU.jmeno}“ na první pohled vypadá jako „${L}“, ale liší se zaměněnými znaky (třeba 0 místo o, rn místo m, l místo i, pomlčka navíc nebo písmeno z cizí abecedy).`);
          } else if (L.length >= 5 && jmenoBez !== L && vzdalenost(jmenoBez, L) === 1) {
            varuj(L.length >= 6 ? 'vysoka' : 'stredni', `Doména se jedním písmenem liší od ${d}`, `Jméno „${rU.jmeno}“ se od pravého „${L}“ liší o jediné písmeno (překlep, prohozená nebo přidaná písmena). Na to se snadno skočí.`);
          }
        }
        if (varovane.has(z)) continue;
        // 2) Značka jako součást cizí domény nebo subdomény: zasilkovna-doplatek.example, csob-overeni.example
        const vJmene = (z.k || []).some(k => kostraJmenaBezPomlcek.includes(kostra(k))) || (z.t || []).some(t => maToken(tokJmeno, t));
        const vSub = (z.k || []).some(k => kostra(subdom).replace(/-/g, '').includes(kostra(k))) || (z.t || []).some(t => maToken(tokSub, t));
        if (vJmene || vSub) { varuj('vysoka', `Cizí doména používá jméno ${z.n}`, `Adresa obsahuje jméno značky, ale skutečná doména je ${rU.registrovana}. Pravá adresa (${z.n}) je ${prave}. Vložit jméno značky do své domény může kdokoli.`); continue; }
        // 3) Jen zmínka v cestě
        const vCeste = (z.k || []).some(k => cesta.includes(k)) || (z.t || []).some(t => maToken(tokCesta, t));
        if (vCeste) varuj('stredni', `Odkaz zmiňuje ${z.n}, ale vede jinam`, `Jméno značky je až v cestě za doménou, ta ale patří ${rU.registrovana}. Pravá adresa (${z.n}) je ${prave}.`);
      }
      if (!znamaZnacka && !nalezy.some(n => n.vaha === 'vysoka')) {
        pridej('info', 'Doménu neznáme', `${rU.registrovana} není v našem malém seznamu známých firem a úřadů. To samo o sobě nevadí – jen si ověřte, že od této stránky zprávu opravdu čekáte.`);
      }

      // Zkracovače, hostingy, formuláře
      if (ZKRACOVACE.has(r.registrovana)) pridej('stredni', 'Zkrácený odkaz', `${r.registrovana} je zkracovač adres – skutečný cíl neuvidíte, dokud odkaz neotevřete. Banky a úřady zkracovače v SMS nepoužívají.`);
      if (HOSTINGY.has(r.pripona)) pridej('nizka', 'Stránka na bezplatném hostingu', `Na ${r.pripona} si stránku založí kdokoli za pár minut. Seriózní firmy mají vlastní doménu.`);
      if (r.registrovana === 'forms.gle' || (r.registrovana === 'google.com' && /^(docs|sites)$/.test(r.subdomena) && /^\/(forms|view)\b|^\/a\//.test(url.pathname)))
        pridej('stredni', 'Formulář nebo stránka, kterou může vytvořit kdokoli', 'Formuláře a stránky na Googlu si založí každý. Nikdy do nich nezadávejte heslo, PIN ani číslo karty.');

      // Koncovka, pomlčky, subdomény, náhodnost
      const tld = r.pripona.split('.').pop();
      if (DIVNE_KONCOVKY.has(tld)) pridej('nizka', 'Koncovka často zneužívaná k podvodům', `Koncovka .${tld} je levná a podvodníci ji používají často. Mnoho poctivých stránek ji má také – jde jen o mírný signál.`);
      const pomlcek = (rU.jmeno.match(/-/g) || []).length;
      if (pomlcek >= 2) pridej('nizka', 'Hodně pomlček v doméně', `Jméno „${rU.jmeno}“ má ${pomlcek} pomlčky. Podvodné adresy často skládají slova jako „banka-overeni-uctu“.`);
      if (host.split('.').length >= 5) pridej('nizka', 'Nezvykle dlouhá adresa s mnoha tečkami', 'Dlouhý řetěz subdomén často schovává skutečnou doménu, která je až na konci.');
      if (nahodne(rU.jmeno) || rU.subdomena.split('.').some(nahodne)) pridej('nizka', 'Náhodně vypadající jméno', 'Část adresy vypadá jako náhodná změť znaků. Takové domény se zakládají hromadně na jedno použití.');
    }

    // Cesta a dotaz
    if (!znamaZnacka) {
      const cesta = bezDiakritiky(safeDecode(url.pathname + url.search + ' ' + (r.subdomena || '') + ' ' + (r.jmeno || '')).toLowerCase());
      const tok = tokeny(cesta);
      const slova = [...new Set([...SLOVA.filter(s => cesta.includes(s)), ...tok.filter(t => SLOVA_KRATKA.has(t))])];
      if (slova.length) pridej('nizka', 'Slova, kterými podvodníci lákají', `V adrese je: ${slova.slice(0, 5).join(', ')}. Výzvy k přihlášení, ověření nebo doplatku jsou typickým znakem podvodných zpráv.`);
      if ((url.pathname + url.search).split(/[/?&=#._-]/).some(s => s.length >= 24 && /\d/.test(s) && /[a-z]/i.test(s)))
        pridej('nizka', 'Dlouhý náhodný řetězec v adrese', 'Takové kódy slouží ke sledování, kdo na odkaz klikl. Jsou běžné i u poctivých odkazů, ale u neznámé domény jsou dalším signálem.');
    }
    if (NEBEZPECNE_SOUBORY.test(url.pathname)) {
      const pripona = url.pathname.match(NEBEZPECNE_SOUBORY)[1].toLowerCase();
      pridej('vysoka', 'Odkaz stahuje program', `Adresa končí „.${pripona}“ – po otevření se stáhne aplikace nebo program. Tímto způsobem se do telefonů a počítačů dostávají viry, které kradou přístupy do banky.`);
    }
    const presmer = safeDecode(url.search).match(/(?:https?:\/\/|www\.)([^/?&#\s]+)/i);
    if (presmer) pridej('stredni', 'Odkaz v sobě skrývá další adresu', `V parametrech je přesměrování na ${presmer[1].toLowerCase()}. I odkaz na známou stránku tak může nakonec vést úplně jinam.`);

    return vysledek(syrovy, casti, nalezy);
  }

  function safeDecode(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }
  function nahodne(s) {
    if (!s || s.length < 12) return false;
    const cif = (s.match(/\d/g) || []).length;
    return (cif >= 3 && /[a-z]/.test(s) && !/^\d+$/.test(s)) || /[bcdfghjklmnpqrstvwxz]{6,}/.test(s);
  }

  const PORADI = { vysoka: 0, stredni: 1, nizka: 2, info: 3, ok: 4 };
  function vysledek(url, casti, nalezy) {
    nalezy.sort((a, b) => PORADI[a.vaha] - PORADI[b.vaha]);
    const pocet = v => nalezy.filter(n => n.vaha === v).length;
    const semafor = pocet('vysoka') ? 'cervena' : (pocet('stredni') || pocet('nizka') >= 2) ? 'oranzova' : 'zelena';
    return { url, casti, nalezy, semafor };
  }

  const API = { rozeber, najdiOdkazy, rozdelHost, punyDekoduj, naUnicode, kostra, vzdalenost, ZNACKY };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else koren.KONTROLA_ODKAZU = API;
})(typeof window !== 'undefined' ? window : this);
