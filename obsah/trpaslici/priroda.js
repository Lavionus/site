/* ============================================================
   Srdce hory – priroda.js: stabilita stropu, voda, magma, prameny.

   Stabilita: chodba a místnost vysoká 1–2 pole je vždy bezpečná (v řezu
   je „úzká"). Síň vysoká aspoň 3 pole potřebuje strop podepřený každých
   N polí, kde N = rozpětí horniny stropu (hlína 3, vápenec 5, žula 9…).
   Počítají se jen vykopaná pole – přírodní jeskyně drží odjakživa.
   Nestabilní strop nejdřív praská (varování), po 60 s se zřítí:
   hornina spadne na podlahu jako suť, co stálo pod ní, je zasypané.

   Kapaliny: jednoduchý buněčný automat – jednotka vody padá dolů,
   jinak teče po řádku k nejbližšímu místu, kde může spadnout (do 8
   polí); hladiny spojených nádob se vyrovnávají po jedné jednotce. Dveře kapalinu nepustí, voda venku odteče údolím. Magma
   teče pomaleji, pálí věci i stavby; s vodou ztuhne na obsidián.
   Když se nic nehýbe, automat spí (hra.vodaKlid) do další změny.
   Čistá logika bez DOM.
   ============================================================ */
var TRP = globalThis.TRP = globalThis.TRP || {};

(function (T) {
  'use strict';
  const { W, H, M, MATERIAL, pevne } = T.hora;
  const P = T.prace, S = T.stavby;
  const N = W * H;
  const DOBA_PRASKANI = 600, MIN_VYSKA = 3, KROK_VODY = 4, KROK_MAGMATU = 12, DOSAH_TOKU = 8;

  // --- stabilita --------------------------------------------------------------------------
  const otevrene = (hra, i) => !pevne(hra.hora.teren[i]);
  function nestabilniStropy(hra) {
    const t = hra.hora.teren, v = hra.vykopane, out = [];
    for (let y = 1; y < H - 1; y++) {
      let x = 0;
      while (x < W) {
        const kvalif = xx => {
          const i = y * W + xx;
          if (!v[i] || !otevrene(hra, i) || !pevne(t[i - W]) || hra.hora.pozadi[i] === M.VZDUCH) return false;
          let vys = 0, podepreno = false;
          for (let j = i; j < N && otevrene(hra, j); j += W) { vys++; if (hra.stavba[j] === S.K.PODPERA) podepreno = true; }
          return vys >= MIN_VYSKA && !podepreno;
        };
        if (!kvalif(x)) { x++; continue; }
        let x1 = x, rozpeti = Infinity;
        while (x1 < W && kvalif(x1)) { rozpeti = Math.min(rozpeti, P.rozpetiNa(hra, (y - 1) * W + x1)); x1++; }   // otesaný strop drží aspoň jako původní hornina
        if (x1 - x > rozpeti) out.push({ klic: `${y}:${x}:${x1 - 1}`, y, x0: x, x1: x1 - 1, rozpeti });
        x = x1;
      }
    }
    return out;
  }
  function prepocitejStropy(hra, zprava) {
    const stare = new Map(hra.praskani.map(p => [p.klic, p]));
    hra.praskani = nestabilniStropy(hra).map(s => {
      const p = stare.get(s.klic);
      if (p) return p;
      // úsek se jen rozrostl nebo zmenšil → zdědí odpočet a nehlásí se znovu
      const prekryv = hra.praskani.filter(q => q.y === s.y && q.x0 <= s.x1 && s.x0 <= q.x1);
      if (prekryv.length) return Object.assign(s, { tik: Math.min(...prekryv.map(q => q.tik)) });
      if (hra.tik - (hra.varovaniStrop || -9999) >= 600) zprava('zraneni', `Strop síně praská (${s.x1 - s.x0 + 1} polí bez podpěry, ${MATERIAL[hra.hora.teren[(s.y - 1) * W + s.x0]].nazev} unese ${s.rozpeti})! Postav podpěry, než se zřítí.`, (s.y - 1) * W + s.x0);
      hra.varovaniStrop = hra.tik;
      T.hra.zvuk(hra, 'praskani', (s.y - 1) * W + s.x0);
      return Object.assign(s, { tik: hra.tik + DOBA_PRASKANI });
    });
    hra.stabilitaKlid = hra.stabilitaZmena;
  }
  // zával: strop nad úsekem spadne na podlahu jako suť
  function zaval(hra, s, zprava) {
    const t = hra.hora.teren, zraneni = [];
    for (let x = s.x0; x <= s.x1; x++) {
      const c = (s.y - 1) * W + x;
      if (!pevne(t[c])) continue;
      const r = hra.hora.ruda[c];
      t[c] = M.VZDUCH; hra.hora.ruda[c] = 0; hra.vykopane[c] = 1; hra.oznac[c] = 0; hra.prio[c] = 0;
      let f = c + W;
      while (f + W < N && otevrene(hra, f + W) && t[f + W] !== M.VODA && t[f + W] !== M.MAGMA) f += W;
      // co je v cestě padající hornině
      for (const u of hra.trpaslici.slice()) {
        const ux = u.i % W, uy = u.i / W | 0;
        if (ux !== x || uy < s.y - 1 || uy > (f / W | 0)) continue;
        T.hra.pustPraci(hra, u);
        u.zdravi -= 35;
        if (u.i === f) { u.i = u.o = f - W; u.t = u.dur = 0; }
        zraneni.push(u);
      }
      if (hra.stavba[f]) S.zbourej(hra, f, (druh, i, mat) => P.novaVec(hra, druh, f - W, mat));
      if (hra.planNa.has(f)) T.hra.zrusPlany(hra, x, f / W | 0, x, f / W | 0);   // vrácený materiál padne do f…
      for (const v of hra.veci) if (!v.nese && v.i === f) v.i = f - W;              // …a posune se nad suť
      hra.lez[f] = 0; hra.zona[f] = 0; hra.uroda[f] = 0; hra.oznac[f] = 0;
      t[f] = M.SUT;
      if (r) P.novaVec(hra, T.prace.DRUH_RUDY[r], f - W, 0);
      T.hora.odhal(hra.hora, hra.znamo, [c]);
    }
    S.uklidZony(hra);
    vytlac(hra);
    P.usadVeci(hra);
    hra.stabilitaZmena++; hra.svetloZmena++; hra.vodaKlid = false;
    T.hra.zvuk(hra, 'zaval', (s.y - 1) * W + ((s.x0 + s.x1) >> 1), s.x1 - s.x0 + 1);
    const mrtvi = zraneni.filter(u => u.zdravi <= 0);
    zprava('smrt', 'ZÁVAL! Strop síně se zřítil.' + (zraneni.length ? ' Zasypalo: ' + zraneni.map(u => u.jmeno).join(', ') + '.' : ''), (s.y - 1) * W + ((s.x0 + s.x1) >> 1));
    for (const u of mrtvi) T.hra.umri(hra, u, `${u.jmeno} zahynul pod závalem.`, 'zaval');
  }

  // pojistka: co skončilo uvnitř skály, se vytlačí na nejbližší volné pole nad ní
  function vytlac(hra) {
    const t = hra.hora.teren, ven = i => { while (i >= W && pevne(t[i])) i -= W; return i; };
    for (const v of hra.veci) if (!v.nese && pevne(t[v.i])) v.i = ven(v.i);
    for (const u of hra.trpaslici) if (pevne(t[u.i])) { u.i = u.o = ven(u.i); u.t = u.dur = 0; }
    for (const u of hra.tvorove || []) if (pevne(t[u.i])) { u.i = u.o = ven(u.i); u.t = u.dur = 0; u.cesta = []; }
  }

  // --- kapaliny -----------------------------------------------------------------------------
  const pusti = (hra, j) => hra.hora.teren[j] === M.VZDUCH && hra.stavba[j] !== S.K.DVERE;
  function vtec(hra, i, j, typ, zprava) {
    const t = hra.hora.teren;
    t[i] = M.VZDUCH;
    if (hra.hora.pozadi[j] === M.VZDUCH && typ === M.VODA) { hra.odteklo++; return; }   // venku voda odteče údolím
    t[j] = typ;
    hra.uroda[j] = 0;
    if (typ === M.VODA) hra.posledniVoda = j;
    if (typ === M.MAGMA) {
      hra.veci = hra.veci.filter(v => v.nese || v.i !== j);
      if (hra.stavba[j] || hra.lez[j]) { S.zbourej(hra, j, () => {}); hra.lez[j] = 0; hra.svetloZmena++; }
      if (hra.planNa.has(j)) T.hra.zrusPlany(hra, j % W, j / W | 0, j % W, j / W | 0);
      for (const u of hra.trpaslici.slice()) if (u.i === j || u.o === j) T.hra.umri(hra, u, `${u.jmeno} shořel v magmatu.`, 'magma');
    } else if (hra.stavba[j] === S.K.LOUC) { S.zbourej(hra, j, () => {}); zprava('uvizl', 'Voda uhasila louč.', j); }
  }
  // jednotka kapaliny na i: dolů, nebo o krok k nejbližšímu spádu v řádku
  function tekuti(hra, i, typ, pohnuto, zprava) {
    const t = hra.hora.teren, x = i % W, d = i + W;
    if (d < N && pusti(hra, d)) { vtec(hra, i, d, typ, zprava); pohnuto[d] = 1; return true; }
    if (d < N && t[d] === M.VZDUCH) return false;              // pod ní jsou dveře
    let nej = 0;
    for (const smer of (hra.tik & 1 ? [1, -1] : [-1, 1])) {
      for (let k = 1; k <= DOSAH_TOKU; k++) {
        const xx = x + smer * k; if (xx < 0 || xx >= W) break;
        const j = i + smer * k;
        if (!pusti(hra, j)) break;
        if (j + W < N && pusti(hra, j + W)) { if (!nej || k < Math.abs(nej)) nej = smer * k; break; }
      }
    }
    if (!nej) return false;
    const j = i + Math.sign(nej);
    vtec(hra, i, j, typ, zprava); pohnuto[j] = 1;
    return true;
  }
  function krokKapaliny(hra, typ, zprava) {
    const t = hra.hora.teren, pohnuto = new Uint8Array(N);
    let pohyb = 0;
    for (let y = H - 2; y >= 0; y--) {
      const zleva = (hra.tik >> 2) & 1;
      for (let k = 0; k < W; k++) {
        const x = zleva ? k : W - 1 - k, i = y * W + x;
        if (t[i] !== typ || pohnuto[i] || hra.stavba[i] === S.K.STUDNA) continue;      // studna vodu zadrží
        if (tekuti(hra, i, typ, pohnuto, zprava)) pohyb++;
      }
    }
    return pohyb + vyrovnej(hra, typ, zprava);
  }
  // spojené nádoby: z nejvyššího řádku tělesa kapaliny se jedna jednotka přesune na nejnižší
  // volné podepřené pole vedle tělesa – jen když je níž (hladina tak vždy klesá a automat se zastaví)
  function vyrovnej(hra, typ, zprava) {
    const t = hra.hora.teren, videno = new Uint8Array(N);
    let pohyb = 0;
    for (let s0 = 0; s0 < N; s0++) {
      if (t[s0] !== typ || videno[s0]) continue;
      const teleso = [s0]; videno[s0] = 1;
      let ytop = H, vrch = -1, cil = -1, ycil = -1;
      for (let h = 0; h < teleso.length; h++) {
        const i = teleso[h], y = i / W | 0, x = i % W;
        if (y < ytop && hra.stavba[i] !== S.K.STUDNA) { ytop = y; vrch = i; }        // ze studny se nevyrovnává
        for (const j of [i - W, i + W, x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1]) {
          if (j < 0 || j >= N || videno[j]) continue;
          if (t[j] === typ) { videno[j] = 1; teleso.push(j); continue; }
          if (!pusti(hra, j)) continue;
          const pod = j + W, yj = j / W | 0;
          const podeprene = pod >= N || pevne(t[pod]) || t[pod] === typ || hra.stavba[pod] === S.K.DVERE;
          if (podeprene && (yj > ycil || (yj === ycil && j < cil))) { ycil = yj; cil = j; }
        }
      }
      if (cil >= 0 && ycil > ytop) { vtec(hra, vrch, cil, typ, zprava); pohyb++; }
    }
    return pohyb;
  }
  // magma + voda → obsidián (a pára)
  function ztuhni(hra, zprava) {
    const t = hra.hora.teren;
    let n = 0;
    for (let i = W; i < N - W; i++) {
      if (t[i] !== M.MAGMA) continue;
      for (const j of [i - 1, i + 1, i - W, i + W]) if (t[j] === M.VODA) {
        t[i] = M.OBSIDIAN; t[j] = M.VZDUCH; n++;
        // studna bez vody zmizí celá (obě pole), materiál vypadne na suché místo
        if (hra.stavba[j] === S.K.STUDNA) { S.zbourej(hra, j, (druh, k, mat) => P.novaVec(hra, druh, k, mat !== undefined ? mat : druh === 'drevo' ? 'drevo' : 0)); P.usadVeci(hra); zprava('uvizl', 'Magma vypařilo vodu ze studny – studna je pryč.', j); }
        break;
      }
    }
    if (n) { zprava('objev', `Syčí pára – magma se setkalo s vodou a ztuhlo na obsidián (${n} polí).`); hra.stabilitaZmena++; hra.svetloZmena++; }
    return n;
  }
  // voda do pole, kde je trpaslík: topí se a plave vzhůru
  function topeni(hra) {
    for (const u of hra.trpaslici.slice()) {
      if (hra.hora.teren[u.i] !== M.VODA) continue;
      u.zdravi -= 0.4;
      if (u.zdravi <= 0) { T.hra.umri(hra, u, `${u.jmeno} se utopil.`, 'utonuti'); continue; }
      const nad = u.i - W;
      if (u.t >= u.dur && nad >= 0 && !pevne(hra.hora.teren[nad]) && hra.hora.teren[nad] !== M.MAGMA) {
        T.hra.pustPraci(hra, u); u.o = u.i; u.i = nad; u.t = 0; u.dur = 3; u.stav = 'plave';
      }
    }
  }

  // --- prameny a pumpy -------------------------------------------------------------------
  function mozna_pramen(hra, c, zprava) {
    const hl = (c / W | 0) - hra.hora.UDOLI;
    if (hra.bezPramenu || hra.hora.pozadi[c] !== M.VAPENEC || hl < 18 || hl > 55) return;
    if (P.nahoda(hra) >= 0.015) return;
    hra.prameny.push({ i: c, zbyva: 16, dalsi: hra.tik });
    zprava('uvizl', 'Z pukliny ve vápenci vytryskl pramen! Voda poteče, dokud se zdroj nevyčerpá.', c);
  }
  // nejvyšší jednotka vody do 3 polí od pumpy (odčerpá se jako první)
  function vodaUPumpy(hra, i) {
    const x0 = i % W, y0 = i / W | 0;
    let nej = -1;
    for (let y = y0 - 3; y <= y0 + 3; y++) for (let x = x0 - 3; x <= x0 + 3; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const j = y * W + x;
      if (hra.hora.teren[j] === M.VODA && hra.znamo[j] && hra.stavba[j] !== S.K.STUDNA && (nej < 0 || j < nej)) nej = j;   // studnu pumpa nečerpá
    }
    return nej;
  }
  function odcerpej(hra, i) {
    const j = vodaUPumpy(hra, i);
    if (j < 0) return false;
    hra.hora.teren[j] = M.VZDUCH; hra.odcerpano++; hra.vodaKlid = false;
    return true;
  }

  function tik(hra, zprava) {
    if (hra.stabilitaKlid !== hra.stabilitaZmena) prepocitejStropy(hra, zprava);
    for (const s of hra.praskani) if (hra.tik % 40 === 0) T.hra.zvuk(hra, 'praskani', (s.y - 1) * W + s.x0 + ((hra.tik >> 3) % (s.x1 - s.x0 + 1)));
    for (const s of hra.praskani.slice()) if (hra.tik >= s.tik) { hra.praskani.splice(hra.praskani.indexOf(s), 1); T.priroda.zaval(hra, s, zprava); }
    for (const p of hra.prameny) {
      if (p.zbyva <= 0 || hra.tik < p.dalsi) continue;
      p.dalsi = hra.tik + 150;
      if (hra.hora.teren[p.i] === M.VZDUCH) { hra.hora.teren[p.i] = M.VODA; p.zbyva--; hra.vodaKlid = false; }
    }
    hra.prameny = hra.prameny.filter(p => p.zbyva > 0);
    // kapaliny: voda každé 4 tahy, magma každých 12; po dvou celých cyklech bez pohybu automat usne
    if (hra.vodaKlid) { hra.klidKroku = 0; hra.cyklus = 0; }
    else {
      if (hra.tik % KROK_VODY === 0) {
        const n = krokKapaliny(hra, M.VODA, zprava);
        hra.cyklus = (hra.cyklus || 0) + n + ztuhni(hra, zprava);
        if (n && hra.tik % 24 === 0) T.hra.zvuk(hra, 'voda', hra.posledniVoda || -1);
      }
      if (hra.tik % KROK_MAGMATU === 0) {
        hra.cyklus += krokKapaliny(hra, M.MAGMA, zprava);
        hra.klidKroku = hra.cyklus ? 0 : (hra.klidKroku || 0) + 1;
        hra.cyklus = 0;
        if (hra.klidKroku >= 2 && !hra.prameny.length) hra.vodaKlid = true;
      }
    }
    if (hra.tik % 2 === 0) topeni(hra);
  }

  T.priroda = { DOBA_PRASKANI, nestabilniStropy, prepocitejStropy, zaval, krokKapaliny, ztuhni, mozna_pramen,
                vodaUPumpy, odcerpej, tik };
})(TRP);

if (typeof module !== 'undefined') module.exports = TRP;
