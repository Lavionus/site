/* ============================================================
   plc/ui.js – editor Ladder diagramu (MAIN + funkční bloky), ovládání simulace,
   ladění (zarážky, krok po příčkách, vynucení, sledování, analyzátor), dokumentace.
   ============================================================ */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const LS = 'webapp_plc_';
  const ulozLS = (k, v) => { try { localStorage.setItem(LS + k, v); return true; } catch (e) { return false; } };
  const ctiLS = k => { try { return localStorage.getItem(LS + k); } catch (e) { return null; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cislo = (x, des) => (+x).toLocaleString('cs-CZ', { maximumFractionDigits: des === undefined ? 3 : des, minimumFractionDigits: 0 });
  const fmtS = ms => cislo(ms / 1000, 3) + ' s';
  const zkrat = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  const PRIKLADY = window.PLC_PRIKLADY, KRESBA = window.PLC_KRESBA, INSTR = PLC.INSTR;

  /* ---------- stav aplikace ---------- */
  let projekt = null, sim = null;
  let aktivniPou = null;           // null = MAIN, jinak id FB
  let vyber = [], vybranaPricka = null, nastroj = 'NO', presouvani = null, diag = [];
  const zpet = [], znovu = [];
  const posledni = { kontakt: 'I0.0', civka: 'Q0.0' };
  const instanceZobrazeni = {};    // FB → název instance pro živé hodnoty
  let rychlost = 1, zobrazitVse = false, meritko = 1, zive = null, hledani = '', zmrazeno = false, chybaZobrazena = null;

  /* ---------- geometrie ---------- */
  const CW = 78, CWC = 112, CH = 64, PAD = 14, OUTW = 188, RAIL = 40, HLAVA = 24, RADEK = 13;

  /* ---------- paleta a ikony ---------- */
  const IKONY = {
    NO: '<line class="tvar" x1="0" y1="9" x2="10" y2="9"/><line class="tvar" x1="10" y1="2" x2="10" y2="16"/><line class="tvar" x1="20" y1="2" x2="20" y2="16"/><line class="tvar" x1="20" y1="9" x2="30" y2="9"/>',
    NC: '<line class="tvar" x1="0" y1="9" x2="10" y2="9"/><line class="tvar" x1="10" y1="2" x2="10" y2="16"/><line class="tvar" x1="20" y1="2" x2="20" y2="16"/><line class="tvar" x1="20" y1="9" x2="30" y2="9"/><line class="tvar" x1="8" y1="16" x2="22" y2="2"/>',
    P: '<line class="tvar" x1="0" y1="9" x2="10" y2="9"/><line class="tvar" x1="10" y1="2" x2="10" y2="16"/><line class="tvar" x1="20" y1="2" x2="20" y2="16"/><line class="tvar" x1="20" y1="9" x2="30" y2="9"/><text class="pis" x="15" y="9.5">P</text>',
    N: '<line class="tvar" x1="0" y1="9" x2="10" y2="9"/><line class="tvar" x1="10" y1="2" x2="10" y2="16"/><line class="tvar" x1="20" y1="2" x2="20" y2="16"/><line class="tvar" x1="20" y1="9" x2="30" y2="9"/><text class="pis" x="15" y="9.5">N</text>',
    CIVKA: '<line class="tvar" x1="0" y1="9" x2="8" y2="9"/><path class="tvar" d="M12 2 Q7 9 12 16 M18 2 Q23 9 18 16"/><line class="tvar" x1="22" y1="9" x2="30" y2="9"/>',
    NCIVKA: '<line class="tvar" x1="0" y1="9" x2="8" y2="9"/><path class="tvar" d="M12 2 Q7 9 12 16 M18 2 Q23 9 18 16 M11 15 L19 3"/><line class="tvar" x1="22" y1="9" x2="30" y2="9"/>',
    SET: '<line class="tvar" x1="0" y1="9" x2="8" y2="9"/><path class="tvar" d="M12 2 Q7 9 12 16 M18 2 Q23 9 18 16"/><text class="pis" x="15" y="9.5">S</text><line class="tvar" x1="22" y1="9" x2="30" y2="9"/>',
    RESET: '<line class="tvar" x1="0" y1="9" x2="8" y2="9"/><path class="tvar" d="M12 2 Q7 9 12 16 M18 2 Q23 9 18 16"/><text class="pis" x="15" y="9.5">R</text><line class="tvar" x1="22" y1="9" x2="30" y2="9"/>'
  };
  const PALETA = [
    ['Kontakty', ['NO', 'NC', 'P', 'N', 'CMP']],
    ['Cívky', ['CIVKA', 'NCIVKA', 'SET', 'RESET']],
    ['Paměti', ['SR', 'RS', 'R_TRIG', 'F_TRIG']],
    ['Časovače', ['TON', 'TOF', 'TP', 'RTO']],
    ['Čítače', ['CTU', 'CTD', 'CTUD', 'RES']],
    ['Čísla', ['MOVE', 'ADD', 'SUB', 'MUL', 'DIV', 'MOD', 'SCALE', 'LIMIT']],
    ['Regulace, FB', ['PID', 'CALL']]
  ];
  const KRATKE = { NO: 'NO', NC: 'NC', P: 'P', N: 'N', CMP: 'CMP', CIVKA: '( )', NCIVKA: '(/)', SET: '(S)', RESET: '(R)' };
  const jeKontakt = t => PLC.KONTAKTY.includes(t);
  const jeCivkaTvar = t => PLC.CIVKY.includes(t) || t === 'RES';

  /* ---------- POU ---------- */
  function pou() { return (aktivniPou && (projekt.fb || []).find(f => f.id === aktivniPou)) || projekt; }
  function pouNazev() { const p = pou(); return p === projekt ? 'MAIN' : p.nazev; }
  function jeFb() { return pou() !== projekt; }
  function lokalKontext() {
    if (!jeFb()) return { lokal: null, typy: null, stopa: sim.plc.stopa };
    const f = pou(), inst = instanceZobrazeni[f.nazev];
    const i = inst && sim.plc.inst[inst];
    const typy = Object.fromEntries(f.rozhrani.map(r => [r.nazev, r.typ]));
    return { lokal: i && i.fb === f.nazev ? i : null, typy, stopa: i && i.fb === f.nazev ? i.stopa : {} };
  }
  function instanceFb(nazev) {
    return [...new Set(PLC.vsechnyPrvky(projekt).filter(x => x.prvek.typ === 'CALL' && x.prvek.fb === nazev && x.prvek.inst).map(x => x.prvek.inst))];
  }

  /* ---------- symboly a vstupy ---------- */
  const symbol = a => (projekt.symboly && projekt.symboly[a]) || '';
  function signalNaAdrese(a) {
    if (!sim) return null;
    const m = Procesy.mapa(sim);
    for (const [k, adr] of Object.entries(m)) if (adr === a) return Object.assign({ klic: k }, sim.model.signaly[k]);
    return null;
  }
  function druhVstupu(a) {
    const s = signalNaAdrese(a);
    if (s && s.smer === 'vstup') return (s.druh === 'cidlo' || s.druh === 'analog') ? 'cidlo' : s.druh;
    return projekt.vstupy[a] === 'prepinac' ? 'prepinac' : 'tlacitko';
  }
  const nazevAdresy = a => symbol(a) || (signalNaAdrese(a) || {}).nazev || '';
  function volnaAdresa(oblast, typy) {
    const pouz = new Set(PLC.vsechnyPrvky(projekt).filter(x => typy.includes(x.prvek.typ)).map(x => x.prvek.adr));
    if (jeFb()) { for (let i = 1; i < 100; i++) if (!pouz.has(`#${oblast}${i}`)) return `#${oblast}${i}`; }
    for (let i = 0; i < PLC.LIMITY[oblast]; i++) if (!pouz.has(oblast + i)) return oblast + i;
    return oblast + '0';
  }
  function vychoziAdresa(typ) {
    if (jeKontakt(typ)) return posledni.kontakt;
    if (PLC.CIVKY.includes(typ) || ['SR', 'RS', 'R_TRIG', 'F_TRIG'].includes(typ)) return posledni.civka;
    if (PLC.CASOVACE.includes(typ)) return volnaAdresa('T', PLC.CASOVACE);
    if (PLC.CITACE.includes(typ)) return volnaAdresa('C', PLC.CITACE);
    const c = PLC.vsechnyPrvky(projekt).find(x => PLC.CITACE.includes(x.prvek.typ) || PLC.CASOVACE.includes(x.prvek.typ));
    return c ? c.prvek.adr : 'C0';
  }
  function novyPrvekUI(typ) {
    const p = PLC.novyPrvek(typ, vychoziAdresa(typ));
    if (typ === 'CALL') { const f = (projekt.fb || []).find(x => x !== pou()); if (f) { p.fb = f.nazev; p.inst = navrhInstance(f.nazev); } }
    return p;
  }
  function navrhInstance(fb) {
    const pouz = new Set(PLC.vsechnyPrvky(projekt).filter(x => x.prvek.typ === 'CALL').map(x => x.prvek.inst));
    const zaklad = fb.charAt(0).toUpperCase() + fb.slice(1).toLowerCase();
    for (let i = 1; i < 999; i++) if (!pouz.has(zaklad + i)) return zaklad + i;
    return zaklad + '_x';
  }

  /* ---------- změny projektu, zpět/znovu ---------- */
  const snimek = () => JSON.stringify(projekt);
  function zmena(fn, bezHistorie) {
    const pred = snimek();
    try { fn(); }
    catch (e) {
      projekt = JSON.parse(pred);
      if (e && e.plc) Dialog.chyba(e.message); else { Dialog.chyba('Úprava selhala: ' + (e && e.message)); console.error(e); }
      poZmene(); return false;
    }
    if (!bezHistorie && snimek() !== pred) { zpet.push(pred); if (zpet.length > 150) zpet.shift(); znovu.length = 0; }
    poZmene();
    return true;
  }
  function vratit(z, cil) {
    if (!z.length) return;
    cil.push(snimek());
    projekt = JSON.parse(z.pop());
    presouvani = null;
    poZmene();
  }
  let casovacUlozeni = 0;
  function poZmene() {
    PLC.normalizuj(projekt);
    if (aktivniPou && !(projekt.fb || []).some(f => f.id === aktivniPou)) aktivniPou = null;
    vyber = vyber.filter(id => PLC.najdi(projekt, id));
    if (vybranaPricka && !PLC.najdiPricku(projekt, vybranaPricka)) vybranaPricka = null;
    diag = PLC.diagnostika(projekt);
    if (sim) {
      if (sim.model.id !== (Procesy.PROCESY[projekt.proces] ? projekt.proces : 'zadny')) novaSimulace();
      else { Procesy.zmenProjekt(sim, projekt); nastavSledovani(); }
    }
    $('#nazevProjektu').value = projekt.nazev;
    $('#perioda').value = projekt.perioda;
    $('#proces').value = Procesy.PROCESY[projekt.proces] ? projekt.proces : 'zadny';
    $('#popisProjektu').textContent = jeFb() ? '' : (projekt.popis || '');
    $('#popisProjektu').hidden = jeFb() || !projekt.popis;
    $('#btnZpet').disabled = !zpet.length; $('#btnZnovu').disabled = !znovu.length;
    vykresliPouListu(); vykresliFbPanel(); vykresliLadder(); vykresliVlastnosti(); vykresliDiag(); vykresliIO(); vykresliWatch();
    vykresliSymboly(); vykresliXref(); vykresliSignaly(); vykresliNastaveni(); vykresliSystem();
    clearTimeout(casovacUlozeni);
    casovacUlozeni = setTimeout(() => ulozLS('aktualni', JSON.stringify(projekt)), 400);
  }
  function nactiDoEditoru(p, zachovatHistorii) {
    projekt = p; vyber = []; vybranaPricka = null; presouvani = null; aktivniPou = null;
    if (!zachovatHistorii) { zpet.length = 0; znovu.length = 0; }
    novaSimulace();
    poZmene();
  }

  /* ---------- simulace ---------- */
  function novaSimulace() {
    if (!Procesy.PROCESY[projekt.proces]) projekt.proces = 'zadny';
    const stara = sim;
    sim = Procesy.vytvorSimulaci(projekt, 7);
    if (stara && stara.model.id === sim.model.id) { sim.force = stara.force; }
    nastavSledovani();
    vykresliProcesOvl();
    aktualizujRezim();
  }
  function signalyAnalyzatoru() {
    const w = (projekt.watch || []).filter(x => x.trend).map(x => x.adr);
    if (w.length) return w.slice(0, 24);
    const pouz = PLC.pouziteAdresy(projekt);
    const bity = pouz.filter(a => { const r = PLC.rozeberAdresu(a); return r && (r.typ === 'BOOL' || r.oblast === 'T' || r.oblast === 'C') && r.oblast !== 'S'; });
    for (const [k, s] of Object.entries(sim.model.signaly)) { const a = Procesy.mapa(sim)[k]; if (!Procesy.analogovy(s) && !bity.includes(a)) bity.push(a); }
    const slova = pouz.filter(a => { const r = PLC.rozeberAdresu(a); return r && r.slovo && r.oblast !== 'SW'; });
    const r = bity.sort((a, b) => PLC.poradiAdresy(a) - PLC.poradiAdresy(b)).slice(0, 18).concat(slova.slice(0, 4));
    return r;
  }
  function nastavSledovani() {
    const nove = signalyAnalyzatoru();
    if (nove.join() !== sim.sledovat.join()) { sim.sledovat = nove; sim.historie = []; }
  }
  function aktualizujRezim() {
    const r = sim.rezim, s = $('#stavPLC');
    let t = r;
    if (r === 'PAUZA' && sim.zastavenoNa !== null && sim.zastavenoNa !== undefined) t = `PAUZA – příčka ${sim.zastavenoNa + 1}`;
    if (sim.chybaCPU && r === 'STOP') t = 'STOP – CHYBA';
    s.textContent = t; s.dataset.r = t;
    s.className = 'stav-plc ' + (sim.chybaCPU && r === 'STOP' ? 'chyba' : r.toLowerCase());
    $('#btnRun').disabled = r === 'RUN';
    $('#btnPauza').disabled = r !== 'RUN';
    $('#btnStop').disabled = r === 'STOP';
    $('#frce').hidden = !Object.keys(sim.force).length;
    const ch = $('#chybaCpu');
    if (sim.chybaCPU && chybaZobrazena !== sim.chybaCPU) { $('#chybaCpuText').textContent = sim.chybaCPU; ch.hidden = false; chybaZobrazena = sim.chybaCPU; }
  }
  function kontrolaPredBehem() {
    if (PLC.maChyby(diag)) { prepniZalozku('diag'); Dialog.chyba('Program obsahuje chyby (viz Diagnostika). Opravte je, pak spusťte RUN.'); return false; }
    const m = Procesy.kontrolaMapovani(sim.model, projekt.mapovani);
    if (m.length) { $('#detailSignaly').open = true; Dialog.chyba('Chybné přiřazení signálů procesu: ' + m.join(' ')); return false; }
    return true;
  }
  function spust() { if (sim.rezim === 'STOP' && !kontrolaPredBehem()) return; Procesy.start(sim); aktualizujRezim(); }
  function krok() { if (sim.rezim === 'STOP' && !kontrolaPredBehem()) return; if (sim.rezim === 'RUN') Procesy.pauza(sim); Procesy.krok(sim); poKroku(); }
  function krokPricky() { if (sim.rezim === 'STOP' && !kontrolaPredBehem()) return; if (sim.rezim === 'RUN') Procesy.pauza(sim); Procesy.krokPricky(sim); poKroku(); }
  function poKroku() { aktualizujRezim(); if (jeFb()) { aktivniPou = null; vykresliPouListu(); vykresliFbPanel(); } vykresliLadder(); aktualizujIO(); }

  /* ---------- Ladder: velikosti ---------- */
  let velikosti = new Map();
  function vel(u) {
    if (velikosti.has(u.id)) return velikosti.get(u.id);
    let r;
    if (u.typ === 'SERIE') {
      if (!u.prvky.length) r = { w: 46, h: 1 };
      else { r = { w: 0, h: 1 }; for (const x of u.prvky) { const v = vel(x); r.w += v.w; r.h = Math.max(r.h, v.h); } }
    } else if (u.typ === 'PAR') {
      r = { w: 0, h: 0 };
      for (const v of u.vetve) { const s = vel(v); r.w = Math.max(r.w, s.w); r.h += s.h; }
      r.w += 2 * PAD;
    } else r = { w: u.typ === 'CMP' ? CWC : CW, h: 1 };
    velikosti.set(u.id, r);
    return r;
  }
  function radkyBloku(v) {
    const r = [], op = (k, jm) => r.push({ jm, text: v[k] || '—', op: v[k] || null });
    switch (v.typ) {
      case 'TON': case 'TOF': case 'TP': case 'RTO': r.push({ jm: 'PT', text: fmtS(+v.pt || 0) }); break;
      case 'CTU': case 'CTD': r.push({ jm: 'PV', text: String(v.pv) }); break;
      case 'CTUD': r.push({ jm: 'PV', text: String(v.pv) }); op('cd', 'CD'); break;
      case 'SR': case 'RS': op('r', 'R1'); break;
      case 'MOVE': op('in', 'IN'); op('out', 'OUT'); break;
      case 'ADD': case 'SUB': case 'MUL': case 'DIV': case 'MOD': op('in1', 'IN1'); op('in2', 'IN2'); op('out', 'OUT'); break;
      case 'SCALE': op('in', 'IN'); r.push({ jm: 'IN', text: `${v.inmin} … ${v.inmax}` }); r.push({ jm: 'OUT', text: `${v.outmin} … ${v.outmax}` }); op('out', '→'); break;
      case 'LIMIT': op('mn', 'MN'); op('in', 'IN'); op('mx', 'MX'); op('out', 'OUT'); break;
      case 'PID': op('pv', 'PV'); op('sp', 'SP'); op('out', 'OUT'); r.push({ jm: 'Kp', text: `${cislo(v.kp)} Ti ${cislo(v.ti)} s Td ${cislo(v.td)} s` });
        if (v.man) op('man', 'MAN'); if (+v.ts) r.push({ jm: 'Ts', text: fmtS(+v.ts) }); break;
      case 'CALL': {
        const f = PLC.najdiFb(projekt, v.fb);
        if (f) for (const x of f.rozhrani) if (x.smer !== 'STAT') r.push({ jm: (x.smer === 'IN' ? '→ ' : '← ') + x.nazev, text: (v.prm || {})[x.nazev] || '—', op: (v.prm || {})[x.nazev] || null });
        break;
      }
    }
    return r;
  }
  const maStav = t => PLC.CASOVACE.includes(t) || PLC.CITACE.includes(t) || t === 'PID';
  function radkuVystupu(v) {
    if (jeCivkaTvar(v.typ)) return 1;
    const n = radkyBloku(v).length + (maStav(v.typ) ? 1 : 0);
    const h = 22 + RADEK * n + 6;
    return Math.max(1, Math.ceil((h + 14) / CH));
  }

  /* ---------- Ladder: sestavení SVG (editor i tisk) ---------- */
  function sestavLadder(p, volby) {
    const tisk = !!(volby && volby.tisk);
    velikosti = new Map();
    const chybyPrvku = {};
    if (!tisk) for (const d of diag) if (d.prvek && (d.uroven === 'chyba' || d.uroven === 'varovani')) chybyPrvku[d.prvek] = chybyPrvku[d.prvek] === 'chyba' ? 'chyba' : d.uroven;
    const poradi = !tisk && $('#chkPoradi').checked ? PLC.poradiVyhodnoceni(p) : null;
    const symb = tisk || $('#chkSymboly').checked;
    const hodnoty = !tisk && $('#chkHodnoty').checked;
    const hledej = !tisk && $('#chkZvyraznit') && $('#chkZvyraznit').checked ? hledani.trim().toLowerCase() : '';
    const jeMain = p === projekt;
    let maxW = 2 * CW;
    for (const r of p.pricky) maxW = Math.max(maxW, vel(r.podminka).w);
    const XOUT = RAIL + maxW + 18, XR = XOUT + OUTW + 14, SIRKA = XR + 12;
    const html = [];
    const vynuceno = a => !tisk && sim && Object.prototype.hasOwnProperty.call(sim.force, a);
    const shoda = v => {
      if (!hledej) return false;
      return PLC.operandyPrvku(v).some(([, t]) => t && (String(t).toLowerCase().includes(hledej) || symbol(t).toLowerCase().includes(hledej))) || (v.fb && v.fb.toLowerCase().includes(hledej)) || (v.inst && v.inst.toLowerCase().includes(hledej));
    };
    p.pricky.forEach((r, pi) => {
      const sv = vel(r.podminka);
      const vys = r.vystupy.map(radkuVystupu);
      const radkyVyst = vys.reduce((a, b) => a + b, 0);
      const radku = Math.max(sv.h, radkyVyst + (tisk ? 0 : 1), 1);
      const V = HLAVA + radku * CH + 4;
      const yr = row => HLAVA + row * CH + CH / 2 + 4;
      const o = [];
      const drat = (x1, y1, x2, y2, id, pole) => o.push(`<line class="drat" ${id ? `data-n="${id}|${pole}"` : ''} x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
      const bod = (serie, index, x, row) => { if (!tisk) o.push(`<g class="vloz" data-vloz="1" data-pricka="${r.id}" data-serie="${serie || ''}" data-index="${index}"><circle cx="${x}" cy="${yr(row)}" r="7"/><text x="${x}" y="${yr(row)}">+</text></g>`); };
      const znacka = (id, x, y) => { if (poradi && poradi[id]) o.push(`<g class="poradi"><circle cx="${x}" cy="${y}" r="8"/><text x="${x}" y="${y + 0.5}">${poradi[id]}</text></g>`); };
      const tridy = u => tisk ? '' : (vyber.includes(u.id) ? ' vybran' : '') + (chybyPrvku[u.id] ? ' ' + (chybyPrvku[u.id] === 'chyba' ? 'chyba' : 'varov') : '') + (presouvani === u.id ? ' presouvany' : '') + (shoda(u) ? ' nalez' : '');
      const fZnak = (a, x, y) => { if (vynuceno(a)) o.push(`<rect class="fbadge" x="${x - 7}" y="${y - 7}" width="14" height="13" rx="3"/><text class="fbadge-t" x="${x}" y="${y}">F</text>`); };
      const opText = (v, k, x, y, trida, kotva) => o.push(`<text class="${trida}" x="${x}" y="${y}" ${kotva ? `style="text-anchor:${kotva}"` : ''}>${esc(v)}</text>`);

      const kontakt = (k, x, row) => {
        const y = yr(row);
        if (k.typ === 'CMP') {
          const cx = x + CWC / 2;
          o.push(`<g class="prvek kontakt${tridy(k)}" data-id="${k.id}" tabindex="-1">`);
          o.push(`<rect class="ramec" x="${x + 3}" y="${y - 31}" width="${CWC - 6}" height="62"/>`);
          o.push(`<line class="drat" data-n="${k.id}|vstup" x1="${x}" y1="${y}" x2="${x + 14}" y2="${y}"/>`);
          o.push(`<line class="drat" data-n="${k.id}|vystup" x1="${x + CWC - 14}" y1="${y}" x2="${x + CWC}" y2="${y}"/>`);
          o.push(`<rect class="cmpbox" x="${x + 14}" y="${y - 24}" width="${CWC - 28}" height="48" rx="4"/>`);
          o.push(`<text class="op" x="${cx}" y="${y - 10}" style="text-anchor:middle">${esc(zkrat(String(k.in1), 13))}</text>`);
          o.push(`<text class="pis" x="${cx}" y="${y + 2}" style="font-size:12px">${esc(k.op)}</text>`);
          o.push(`<text class="op" x="${cx}" y="${y + 18}" style="text-anchor:middle">${esc(zkrat(String(k.in2), 13))}</text>`);
          if (hodnoty) o.push(`<text class="opv" data-cmp="${k.id}" x="${x + CWC - 6}" y="${y - 27}"></text>`);
          o.push('</g>');
          znacka(k.id, x + 8, y - 22);
          return x + CWC;
        }
        const cx = x + CW / 2;
        o.push(`<g class="prvek kontakt${tridy(k)}" data-id="${k.id}" tabindex="-1">`);
        o.push(`<rect class="ramec" x="${x + 3}" y="${y - 31}" width="${CW - 6}" height="62"/>`);
        o.push(`<rect class="vypln" x="${cx - 9}" y="${y - 12}" width="18" height="24"/>`);
        o.push(`<line class="drat" data-n="${k.id}|vstup" x1="${x}" y1="${y}" x2="${cx - 9}" y2="${y}"/>`);
        o.push(`<line class="drat" data-n="${k.id}|vystup" x1="${cx + 9}" y1="${y}" x2="${x + CW}" y2="${y}"/>`);
        o.push(`<line class="tvar" x1="${cx - 9}" y1="${y - 12}" x2="${cx - 9}" y2="${y + 12}"/><line class="tvar" x1="${cx + 9}" y1="${y - 12}" x2="${cx + 9}" y2="${y + 12}"/>`);
        if (k.typ === 'NC') o.push(`<line class="tvar" x1="${cx - 12}" y1="${y + 12}" x2="${cx + 12}" y2="${y - 12}"/>`);
        if (k.typ === 'P' || k.typ === 'N') o.push(`<text class="pis" x="${cx}" y="${y}">${k.typ}</text>`);
        o.push(`<text class="adr" x="${cx}" y="${y - 18}">${esc(zkrat(k.adr || '???', 11))}</text>`);
        if (symb && symbol(k.adr)) o.push(`<text class="sym" x="${cx}" y="${y + 26}">${esc(zkrat(symbol(k.adr), 12))}</text>`);
        fZnak(k.adr, x + CW - 10, y - 22);
        o.push('</g>');
        znacka(k.id, x + 8, y - 22);
        return x + CW;
      };
      const serie = (s, x, row) => {
        bod(s.id, 0, x, row);
        if (!s.prvky.length) { drat(x, yr(row), x + vel(s).w, yr(row), s.id, 'vystup'); return x + vel(s).w; }
        let cx = x;
        s.prvky.forEach((u, i) => { cx = uzel(u, cx, row); bod(s.id, i + 1, cx, row); });
        return cx;
      };
      const uzel = (u, x, row) => {
        if (u.typ !== 'PAR') return kontakt(u, x, row);
        const sz = vel(u);
        let rr = row; const radky = [];
        for (const v of u.vetve) { radky.push(rr); rr += vel(v).h; }
        const posl = radky[radky.length - 1];
        if (!tisk) o.push(`<rect class="par-ram${vyber.includes(u.id) ? ' vybran' : ''}" data-par="${u.id}" x="${x + 2}" y="${yr(row) - 30}" width="${sz.w - 4}" height="${(posl - row) * CH + 60}" rx="6"/>`);
        drat(x, yr(row), x + PAD, yr(row), u.id, 'vstup');
        drat(x + PAD, yr(row), x + PAD, yr(posl), u.id, 'vstup');
        u.vetve.forEach((v, j) => {
          const konec = serie(v, x + PAD, radky[j]);
          if (konec < x + sz.w - PAD) drat(konec, yr(radky[j]), x + sz.w - PAD, yr(radky[j]), v.id, 'vystup');
        });
        drat(x + sz.w - PAD, yr(row), x + sz.w - PAD, yr(posl), u.id, 'vystup');
        drat(x + sz.w - PAD, yr(row), x + sz.w, yr(row), u.id, 'vystup');
        return x + sz.w;
      };
      const vystup = (v, row) => {
        const y = yr(row), x = XOUT, cx = x + OUTW / 2;
        const blok = !jeCivkaTvar(v.typ);
        o.push(`<g class="prvek vystup${blok ? ' blok' : ''}${tridy(v)}" data-id="${v.id}" tabindex="-1">`);
        if (blok) {
          const radky = radkyBloku(v), stav = maStav(v.typ);
          const bh = 22 + RADEK * (radky.length + (stav ? 1 : 0)) + 6, y0 = y - 22;
          o.push(`<rect class="ramec" x="${x + 6}" y="${y0 - 6}" width="${OUTW - 8}" height="${bh + 12}"/>`);
          o.push(`<line class="drat" data-n="${v.id}|vstup" x1="${x}" y1="${y}" x2="${x + 16}" y2="${y}"/>`);
          o.push(`<rect class="box" x="${x + 16}" y="${y0}" width="${OUTW - 30}" height="${bh}" rx="4"/>`);
          const titul = v.typ === 'CALL' ? 'CALL ' + (v.fb || '?') : v.typ;
          o.push(`<text class="titul" x="${x + 23}" y="${y0 + 14}">${esc(zkrat(titul, 17))}</text>`);
          const vpravo = v.typ === 'CALL' ? v.inst : v.adr;
          if (vpravo !== undefined) o.push(`<text class="adr" x="${x + OUTW - 20}" y="${y0 + 14}" style="text-anchor:end">${esc(zkrat(vpravo || '???', 12))}</text>`);
          if (v.adr !== undefined) fZnak(v.adr, x + OUTW - 8, y0 - 2);
          radky.forEach((rd, i) => {
            const yy = y0 + 14 + RADEK * (i + 1) + 1;
            opText(rd.jm, 0, x + 23, yy, 'opk');
            o.push(`<text class="op" x="${x + 58}" y="${yy}">${esc(zkrat(String(rd.text), 15))}</text>`);
            if (rd.op && hodnoty) o.push(`<text class="opv" data-op="${v.id}|${esc(rd.op)}" x="${x + OUTW - 20}" y="${yy}"></text>`);
            if (rd.op) fZnak(rd.op, x + OUTW - 8, yy - 4);
          });
          if (stav) o.push(`<text class="hod" data-h="${v.id}" x="${x + 23}" y="${y0 + 14 + RADEK * (radky.length + 1) + 1}"></text>`);
          if (symb && v.adr && symbol(v.adr)) o.push(`<text class="sym" x="${x + OUTW - 20}" y="${y0 - 3}" style="text-anchor:end;font-size:9.5px">${esc(zkrat(symbol(v.adr), 16))}</text>`);
          o.push(`<line class="drat" x1="${x + OUTW - 14}" y1="${y}" x2="${XR}" y2="${y}"/>`);
        } else {
          o.push(`<rect class="ramec" x="${x + 6}" y="${y - 31}" width="${OUTW - 8}" height="62"/>`);
          o.push(`<line class="drat" data-n="${v.id}|vstup" x1="${x}" y1="${y}" x2="${cx - 13}" y2="${y}"/>`);
          o.push(`<circle class="vypln" cx="${cx}" cy="${y}" r="11"/>`);
          o.push(`<path class="tvar" d="M${cx - 6} ${y - 12} Q${cx - 15} ${y} ${cx - 6} ${y + 12} M${cx + 6} ${y - 12} Q${cx + 15} ${y} ${cx + 6} ${y + 12}"/>`);
          if (v.typ === 'NCIVKA') o.push(`<line class="tvar" x1="${cx - 6}" y1="${y + 10}" x2="${cx + 6}" y2="${y - 10}"/>`);
          const pis = { SET: 'S', RESET: 'R', RES: 'RES' }[v.typ];
          if (pis) o.push(`<text class="pis" x="${cx}" y="${y}" ${pis.length > 1 ? 'style="font-size:7.5px"' : ''}>${pis}</text>`);
          o.push(`<line class="drat" x1="${cx + 13}" y1="${y}" x2="${XR}" y2="${y}"/>`);
          o.push(`<text class="adr" x="${cx}" y="${y - 18}">${esc(zkrat(v.adr || '???', 14))}</text>`);
          if (symb && symbol(v.adr)) o.push(`<text class="sym" x="${cx}" y="${y + 26}">${esc(zkrat(symbol(v.adr), 18))}</text>`);
          fZnak(v.adr, cx + 26, y - 18);
        }
        o.push('</g>');
        znacka(v.id, x + 14, y - 22);
      };

      const aktualni = !tisk && jeMain && sim && sim.zastavenoNa === pi && sim.rezim === 'PAUZA';
      o.push(`<rect class="pricka-pozadi${vybranaPricka === r.id && !tisk ? ' vybran' : ''}${aktualni ? ' aktualni' : ''}" x="0" y="0" width="${SIRKA}" height="${V}"/>`);
      const bp = jeMain && !tisk ? `<g class="zarazka${sim && sim.breakpointy.has(r.id) ? ' on' : ''}" data-zarazka="${r.id}"><title>Zarážka (F9)</title><circle cx="9" cy="12" r="5.5"/></g>` : '';
      o.push(`<g class="hlava${vybranaPricka === r.id && !tisk ? ' vybran' : ''}" data-pricka-hlava="${r.id}"><rect x="18" y="0" width="${SIRKA - 18}" height="${HLAVA}" fill="transparent"/>`
        + `<text class="cislo" x="20" y="15">${pi + 1}</text><text class="kom" x="${RAIL + 8}" y="15">${esc(zkrat(r.komentar || '', Math.floor(SIRKA / 6.4)))}</text></g>${bp}`);
      if (aktualni) o.push(`<path class="sipka-akt" d="M2 ${yr(0) - 8} L12 ${yr(0)} L2 ${yr(0) + 8}Z"/>`);
      o.push(`<line class="lista-l" data-lista="1" x1="${RAIL}" y1="${HLAVA - 2}" x2="${RAIL}" y2="${V}"/>`);
      o.push(`<line class="lista-p" x1="${XR}" y1="${HLAVA - 2}" x2="${XR}" y2="${V}"/>`);
      const konec = serie(r.podminka, RAIL, 0);
      drat(konec, yr(0), XOUT, yr(0), r.podminka.id, 'vystup');
      let row = 0;
      const radkyVys = [];
      r.vystupy.forEach((v, i) => { radkyVys.push(row); row += vys[i]; });
      if (r.vystupy.length > 1) drat(XOUT, yr(0), XOUT, yr(radkyVys[radkyVys.length - 1]), r.podminka.id, 'vystup');
      r.vystupy.forEach((v, i) => vystup(v, radkyVys[i]));
      if (!tisk) {
        const ry = yr(row);
        o.push(`<rect class="vystup-misto" x="${XOUT + 10}" y="${ry - 20}" width="${OUTW - 20}" height="40" rx="6"/>`);
        bod(null, r.vystupy.length, XOUT + OUTW / 2, row);
      }
      const m = tisk ? 1 : meritko;
      html.push(`<svg class="pricka-svg" data-pricka="${r.id}" width="${Math.round(SIRKA * m)}" height="${Math.round(V * m)}" viewBox="0 0 ${SIRKA} ${V}" role="group" aria-label="Příčka ${pi + 1}">${o.join('')}</svg>`);
    });
    return html.join('');
  }

  function vykresliLadder() {
    const l = $('#ladder');
    l.innerHTML = sestavLadder(pou());
    l.classList.toggle('skryt-vloz', !$('#chkVloz').checked && !presouvani);
    zive = { drat: [], prvky: [], hod: [], ops: [], cmp: [], listy: $$('#ladder [data-lista]') };
    for (const e of l.querySelectorAll('[data-n]')) { const [id, pole] = e.dataset.n.split('|'); zive.drat.push({ e, id, pole, st: null }); }
    for (const e of l.querySelectorAll('g.prvek')) { const n = PLC.najdi(projekt, e.dataset.id); zive.prvky.push({ e, id: e.dataset.id, typ: n ? n.uzel.typ : '', st: null }); }
    for (const e of l.querySelectorAll('[data-h]')) zive.hod.push({ e, id: e.dataset.h, st: null });
    for (const e of l.querySelectorAll('[data-op]')) { const i = e.dataset.op.indexOf('|'); zive.ops.push({ e, op: e.dataset.op.slice(i + 1), st: null }); }
    for (const e of l.querySelectorAll('[data-cmp]')) zive.cmp.push({ e, id: e.dataset.cmp, st: null });
    aktualizujZive(true);
    vykresliNapovedu();
  }
  function fmtCislo(h, real) {
    if (h === null || h === undefined) return '';
    if (typeof h === 'boolean') return h ? '1' : '0';
    if (!Number.isFinite(h)) return String(h);
    return Number.isInteger(h) && !real ? String(h) : cislo(h, 3);
  }
  function jeRealAdr(t, typy) { const o = PLC.rozeberOperand(t); if (!o) return false; if (o.druh === 'konst') return o.typ === 'REAL'; return o.a.oblast === 'MD' || (o.a.oblast === '#' && typy && typy[o.a.nazev] === 'REAL'); }
  let posledniScan = -1;
  function aktualizujZive(vynutit) {
    if (!zive) return;
    const bezi = sim.rezim !== 'STOP';
    if (!vynutit && sim.scanu === posledniScan && sim.rezim !== 'PAUZA') return;
    posledniScan = sim.scanu;
    const k = lokalKontext();
    const st = bezi ? (k.stopa || {}) : {};
    for (const l of zive.listy) l.classList.toggle('nap', bezi && (!jeFb() || !!k.lokal));
    for (const d of zive.drat) { const z = st[d.id]; const on = !!(z && z[d.pole]); if (on !== d.st) { d.e.classList.toggle('nap', on); d.st = on; } }
    for (const p of zive.prvky) {
      const z = st[p.id]; let on = false;
      if (z) {
        if (jeKontakt(p.typ)) on = !!z.sepnuto;
        else if (maStav(p.typ) && p.typ !== 'PID') on = !!z.Q;
        else if (p.typ === 'CIVKA' || p.typ === 'NCIVKA' || p.typ === 'R_TRIG' || p.typ === 'F_TRIG') on = !!z.hodnota;
        else if (p.typ === 'SR' || p.typ === 'RS') on = !!z.Q;
        else on = !!z.vstup;
      }
      if (on !== p.st) { p.e.classList.toggle(jeKontakt(p.typ) ? 'sep' : 'akt', on); p.st = on; }
    }
    for (const h of zive.hod) {
      const z = st[h.id]; let t = '';
      if (z && z.ET !== undefined) t = 'ET ' + fmtS(z.ET) + (z.Q ? '   Q=1' : '');
      else if (z && z.CV !== undefined) t = 'CV ' + z.CV + (z.Q ? '   Q=1' : '');
      else if (z && z.out !== undefined && z.P !== undefined) t = `${z.man ? 'RUČNĚ ' : ''}P ${cislo(z.P, 1)} I ${cislo(z.I, 1)} D ${cislo(z.D, 1)}`;
      if (t !== h.st) { h.e.textContent = t; h.st = t; }
    }
    for (const o of zive.ops) {
      const h = bezi && (!jeFb() || k.lokal) ? PLC.hodnota(sim.plc, o.op, k.lokal, k.typy) : null;
      const t = h === null ? '' : '= ' + fmtCislo(h, jeRealAdr(o.op, k.typy));
      if (t !== o.st) { o.e.textContent = t; o.st = t; }
    }
    for (const c of zive.cmp) {
      const z = st[c.id]; const t = z && z.a !== undefined ? `${fmtCislo(z.a)} ${z.sepnuto ? '✓' : '✗'} ${fmtCislo(z.b)}` : '';
      if (t !== c.st) { c.e.textContent = t; c.st = t; }
    }
  }

  /* ---------- POU lišta a panel FB ---------- */
  function vykresliPouListu() {
    const b = [`<button role="tab" data-pou="" aria-selected="${!aktivniPou}">MAIN<span class="typ">program</span></button>`];
    for (const f of projekt.fb || []) b.push(`<button role="tab" data-pou="${f.id}" aria-selected="${aktivniPou === f.id}">${esc(f.nazev)}<span class="typ">FB</span></button>`);
    b.push('<button data-pou-novy="1" title="Nový funkční blok">+ Funkční blok</button>');
    $('#pouLista').innerHTML = b.join('');
  }
  function vykresliFbPanel() {
    const el = $('#fbPanel');
    if (!jeFb()) { el.hidden = true; el.innerHTML = ''; return; }
    const f = pou();
    const inst = instanceFb(f.nazev);
    if (!inst.includes(instanceZobrazeni[f.nazev])) instanceZobrazeni[f.nazev] = inst[0];
    el.hidden = false;
    el.innerHTML = `<div class="fb-hlava"><b>Funkční blok ${esc(f.nazev)}</b>
      <button class="male" data-fb="prejmenovat">Přejmenovat</button><button class="male nebezpecne" data-fb="smazat">Smazat FB</button>
      <label>Živé hodnoty instance <select id="fbInstance">${inst.length ? inst.map(i => `<option ${i === instanceZobrazeni[f.nazev] ? 'selected' : ''}>${esc(i)}</option>`).join('') : '<option value="">(blok se nevolá)</option>'}</select></label></div>
      <input type="text" id="fbKomentar" value="${esc(f.komentar || '')}" placeholder="popis bloku" style="width:100%;margin-bottom:6px" maxlength="300" aria-label="Popis bloku">
      <div class="tabulka-obal" style="overflow-x:auto"><table><tr><th>Proměnná</th><th>Směr</th><th>Typ</th><th>Komentář</th><th></th></tr>
      ${f.rozhrani.map((r, i) => `<tr><td><input type="text" data-roz="${i}" data-k="nazev" value="${esc(r.nazev)}" maxlength="24" aria-label="Název proměnné"></td>
        <td><select data-roz="${i}" data-k="smer">${['IN', 'OUT', 'STAT'].map(s => `<option ${s === r.smer ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
        <td><select data-roz="${i}" data-k="typ">${PLC.TYPY.map(s => `<option ${s === r.typ ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
        <td><input type="text" data-roz="${i}" data-k="komentar" value="${esc(r.komentar || '')}" maxlength="200" aria-label="Komentář"></td>
        <td><button class="male nebezpecne" data-roz-smaz="${i}" aria-label="Smazat proměnnou">×</button></td></tr>`).join('')}</table></div>
      <div class="tlacitka" style="margin-top:4px"><button class="male" data-fb="pridat">+ Proměnná</button>
      <span class="nic">V těle bloku se proměnné používají jako <code>#jméno</code>; lokální časovače a čítače (např. <code>#Cas</code>) má každá instance vlastní.</span></div>`;
  }
  function nastavFbUdalosti() {
    $('#pouLista').addEventListener('click', async e => {
      const n = e.target.closest('[data-pou-novy]');
      if (n) {
        const jm = await Dialog.zeptej('Název nového funkčního bloku (bez diakritiky, např. VENTIL)', 'BLOK' + ((projekt.fb || []).length + 1));
        if (jm === null) return;
        let f; if (zmena(() => { f = PLC.novyFb(projekt, jm.trim()); })) { aktivniPou = f.id; vyber = []; vybranaPricka = null; poZmene(); }
        return;
      }
      const b = e.target.closest('[data-pou]'); if (!b) return;
      aktivniPou = b.dataset.pou || null; vyber = []; vybranaPricka = null; presouvani = null; poZmene();
    });
    const el = $('#fbPanel');
    el.addEventListener('click', async e => {
      const b = e.target.closest('[data-fb]'), s = e.target.closest('[data-roz-smaz]');
      const f = pou();
      if (s) { zmena(() => { f.rozhrani.splice(+s.dataset.rozSmaz, 1); }); return; }
      if (!b) return;
      if (b.dataset.fb === 'pridat') zmena(() => { let i = f.rozhrani.length + 1; while (f.rozhrani.some(r => r.nazev === 'Prom' + i)) i++; f.rozhrani.push({ nazev: 'Prom' + i, smer: 'STAT', typ: 'BOOL', komentar: '' }); });
      if (b.dataset.fb === 'prejmenovat') { const jm = await Dialog.zeptej('Nový název bloku', f.nazev); if (jm !== null) zmena(() => PLC.prejmenujFb(projekt, f.nazev, jm.trim())); }
      if (b.dataset.fb === 'smazat') {
        const vol = PLC.vsechnyPrvky(projekt).filter(x => x.prvek.typ === 'CALL' && x.prvek.fb === f.nazev).length;
        if (await Dialog.potvrd(`Smazat funkční blok ${f.nazev}?` + (vol ? ` Volá se na ${vol} místech – volání zůstanou a diagnostika je označí.` : ''))) {
          zmena(() => { projekt.fb = projekt.fb.filter(x => x !== f); }); aktivniPou = null; poZmene();
        }
      }
    });
    el.addEventListener('change', e => {
      const f = pou();
      if (e.target.id === 'fbInstance') { instanceZobrazeni[f.nazev] = e.target.value; aktualizujZive(true); return; }
      if (e.target.id === 'fbKomentar') { zmena(() => { f.komentar = e.target.value.slice(0, 300); }); return; }
      const i = e.target.dataset.roz; if (i === undefined) return;
      const k = e.target.dataset.k, r = f.rozhrani[+i], v = e.target.value.trim();
      if (k === 'nazev') {
        if (!/^[A-Za-z_][A-Za-z0-9_]{0,23}$/.test(v)) { Dialog.chyba('Název proměnné: písmena bez diakritiky, číslice a _, nezačíná číslicí.'); e.target.value = r.nazev; return; }
        if (f.rozhrani.some(x => x !== r && x.nazev === v)) { Dialog.chyba('Proměnná tohoto jména už existuje.'); e.target.value = r.nazev; return; }
        zmena(() => prejmenujPromennou(f, r.nazev, v));
      } else zmena(() => { r[k] = k === 'komentar' ? v.slice(0, 200) : v; });
    });
  }
  /* přejmenování proměnné rozhraní: #stare → #nove v těle FB a klíče parametrů ve voláních */
  function prejmenujPromennou(f, stare, nove) {
    const r = f.rozhrani.find(x => x.nazev === stare); r.nazev = nove;
    const zamen = o => { for (const k of Object.keys(o)) if (typeof o[k] === 'string' && o[k] === '#' + stare) o[k] = '#' + nove; else if (o[k] && typeof o[k] === 'object') zamen(o[k]); };
    f.pricky.forEach(zamen);
    for (const { prvek } of PLC.vsechnyPrvky(projekt)) if (prvek.typ === 'CALL' && prvek.fb === f.nazev && prvek.prm && stare in prvek.prm) { prvek.prm[nove] = prvek.prm[stare]; delete prvek.prm[stare]; }
  }

  /* ---------- paleta ---------- */
  function vykresliPaletu() {
    $('#paleta').innerHTML = PALETA.map(([sk, pol]) => `<div class="skupina"><span>${sk}</span>` +
      pol.map(t => IKONY[t]
        ? `<button data-nastroj="${t}" title="${esc(PLC.NAZVY[t])}" aria-label="${esc(PLC.NAZVY[t])}" aria-pressed="${nastroj === t}"><svg viewBox="0 0 30 18" aria-hidden="true">${IKONY[t]}</svg></button>`
        : `<button class="txt" data-nastroj="${t}" title="${esc(PLC.NAZVY[t])}" aria-pressed="${nastroj === t}">${t === 'R_TRIG' ? 'R_TRIG' : t === 'F_TRIG' ? 'F_TRIG' : t}</button>`).join('') + '</div>').join('');
  }
  function vykresliNapovedu() {
    const n = $('#napovedaEdit');
    if (presouvani) { n.className = 'napoveda-edit presun'; n.innerHTML = 'Přesun: klikněte na cílové místo <b>+</b> (Esc = zrušit).'; return; }
    n.className = 'napoveda-edit';
    n.innerHTML = `Nástroj <b>${esc(PLC.NAZVY[nastroj])}</b> – klikněte na <b>+</b> v příčce (${jeKontakt(nastroj) ? 'kontakty patří vlevo do podmínky' : 'cívky a bloky patří vpravo'}). Prvek vyberte klikem, Shift+klik vybere úsek, myší ho lze přetáhnout.${jeFb() ? ' Editujete funkční blok – operandy #jméno odkazují na jeho rozhraní.' : ' Kroužek vlevo od čísla příčky = zarážka.'}`;
  }

  /* ---------- výběr a interakce ---------- */
  function vyberPrvek(id, pridat) {
    vybranaPricka = null;
    const n = PLC.najdi(projekt, id);
    if (n && n.pou !== pou()) { aktivniPou = n.pou === projekt ? null : n.pou.id; vykresliPouListu(); vykresliFbPanel(); }
    if (pridat && vyber.length) {
      const a = PLC.najdi(projekt, vyber[0]), b = n;
      if (a && b && a.kde === 'podminka' && b.kde === 'podminka' && a.serie === b.serie) {
        const i0 = Math.min(a.index, b.index), i1 = Math.max(a.index, b.index);
        vyber = a.serie.prvky.slice(i0, i1 + 1).map(x => x.id);
      } else vyber = [id];
    } else vyber = [id];
    if (n && n.uzel.adr) { if (jeKontakt(n.uzel.typ)) posledni.kontakt = n.uzel.adr; else if (PLC.CIVKY.includes(n.uzel.typ)) posledni.civka = n.uzel.adr; }
    vykresliLadder(); vykresliVlastnosti();
  }
  const cilZBodu = g => ({ pricka: g.dataset.pricka, serie: g.dataset.serie || null, index: +g.dataset.index });
  function vlozNaBod(g) {
    const cil = cilZBodu(g);
    if (presouvani) { const id = presouvani; presouvani = null; zmena(() => PLC.presun(projekt, id, cil)); return; }
    const typ = nastroj;
    if ((cil.serie === null) === jeKontakt(typ)) {
      Dialog.chyba(jeKontakt(typ) ? 'Kontakty se vkládají do podmínky (levá část příčky). Pro výstup zvolte v paletě cívku nebo blok.' : 'Cívky a bloky patří na pravý konec příčky (pole „+“ pod výstupy). Pro podmínku zvolte kontakt.');
      return;
    }
    let novy = null;
    if (zmena(() => { novy = PLC.vloz(projekt, cil, novyPrvekUI(typ)); })) {
      vyber = [novy.id]; vybranaPricka = null;
      vykresliLadder(); vykresliVlastnosti();
      const a = $('#vlastnosti [data-p]'); if (a && window.matchMedia('(pointer: fine)').matches) { a.focus(); if (a.select) a.select(); }
    }
  }
  let tahani = null;
  function nastavLadderUdalosti() {
    const l = $('#ladder');
    l.addEventListener('click', e => {
      if (tahani && tahani.aktivni) return;
      const z = e.target.closest('[data-zarazka]');
      if (z) { prepniZarazku(z.dataset.zarazka); return; }
      const bodE = e.target.closest('[data-vloz]');
      if (bodE) { vlozNaBod(bodE); return; }
      const pr = e.target.closest('g.prvek');
      if (pr) { vyberPrvek(pr.dataset.id, e.shiftKey); return; }
      const par = e.target.closest('[data-par]');
      if (par) { vyber = [par.dataset.par]; vybranaPricka = null; vykresliLadder(); vykresliVlastnosti(); return; }
      const h = e.target.closest('[data-pricka-hlava]') || e.target.closest('svg.pricka-svg');
      if (h) { vyber = []; vybranaPricka = h.dataset.prickaHlava || h.dataset.pricka; vykresliLadder(); vykresliVlastnosti(); return; }
      if (vyber.length || vybranaPricka) { vyber = []; vybranaPricka = null; vykresliLadder(); vykresliVlastnosti(); }
    });
    l.addEventListener('dblclick', e => {
      if (e.target.closest('g.prvek')) { const a = $('#vlastnosti [data-p]'); if (a) { a.focus(); if (a.select) a.select(); } }
      if (e.target.closest('[data-pricka-hlava]')) { const k = $('#vlKomentar'); if (k) k.focus(); }
    });
    l.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch' || e.button !== 0) return;
      const pr = e.target.closest('g.prvek') || e.target.closest('[data-par]');
      if (!pr) return;
      tahani = { id: pr.dataset.id || pr.dataset.par, x: e.clientX, y: e.clientY, aktivni: false, duch: null, cil: null };
    });
    window.addEventListener('pointermove', e => {
      if (!tahani) return;
      if (!tahani.aktivni) {
        if (Math.hypot(e.clientX - tahani.x, e.clientY - tahani.y) < 7) return;
        tahani.aktivni = true;
        const n = PLC.najdi(projekt, tahani.id);
        tahani.duch = document.createElement('div'); tahani.duch.className = 'duch';
        tahani.duch.textContent = !n ? '' : n.uzel.typ === 'PAR' ? 'paralelní blok' : ((KRATKE[n.uzel.typ] || n.uzel.typ) + ' ' + (n.uzel.adr || n.uzel.inst || ''));
        document.body.appendChild(tahani.duch);
        $('#ladder').classList.remove('skryt-vloz');
      }
      tahani.duch.style.left = (e.clientX + 12) + 'px'; tahani.duch.style.top = (e.clientY + 10) + 'px';
      const pod = document.elementFromPoint(e.clientX, e.clientY);
      const cil = pod && pod.closest('[data-vloz]');
      if (tahani.cil && tahani.cil !== cil) tahani.cil.classList.remove('cil');
      tahani.cil = cil; if (cil) cil.classList.add('cil');
    });
    window.addEventListener('pointerup', () => {
      if (!tahani) return;
      const t = tahani;
      if (t.aktivni) {
        if (t.duch) t.duch.remove();
        if (t.cil) zmena(() => PLC.presun(projekt, t.id, cilZBodu(t.cil))); else vykresliLadder();
        setTimeout(() => { tahani = null; }, 0);
      } else tahani = null;
    });
  }
  function prepniZarazku(id) {
    if (!projekt.pricky.some(p => p.id === id)) { Dialog.info('Zarážky lze nastavit jen v příčkách MAIN.'); return; }
    if (sim.breakpointy.has(id)) sim.breakpointy.delete(id); else sim.breakpointy.add(id);
    vykresliLadder();
  }

  /* ---------- panel vlastností ---------- */
  const DRUH_POPIS = { bit: 'bit (I, Q, M, S, T, C, #)', bitW: 'bit k zápisu (Q, M, #)', cislo: 'číslo nebo adresa (IW, QW, MW, MD, SW, T, C, #)', cisloW: 'slovo k zápisu (MW, MD, QW, #)',
    timer: 'časovač (T0–T31, v FB #jméno)', counter: 'čítač (C0–C31, v FB #jméno)', tc: 'časovač nebo čítač', bitOpt: 'bit (nepovinný)', cisloOpt: 'číslo nebo adresa (nepovinné)' };
  function nabidkaOperandu(druh) {
    const o = [];
    const lok = jeFb() ? pou().rozhrani : [];
    const pridej = obl => PLC.vsechnyAdresy(obl).forEach(a => o.push(a));
    if (druh === 'bit' || druh === 'bitOpt') { ['I', 'Q', 'M', 'S'].forEach(pridej); lok.filter(r => r.typ === 'BOOL').forEach(r => o.push('#' + r.nazev)); }
    else if (druh === 'bitW') { ['Q', 'M'].forEach(pridej); lok.filter(r => r.typ === 'BOOL').forEach(r => o.push('#' + r.nazev)); }
    else if (druh === 'cislo' || druh === 'cisloOpt') { ['IW', 'QW', 'MW', 'MD', 'SW', 'T', 'C'].forEach(pridej); lok.filter(r => r.typ !== 'BOOL').forEach(r => o.push('#' + r.nazev)); }
    else if (druh === 'cisloW') { ['MW', 'MD', 'QW'].forEach(pridej); lok.filter(r => r.typ !== 'BOOL').forEach(r => o.push('#' + r.nazev)); }
    else if (druh === 'timer') pridej('T'); else if (druh === 'counter') pridej('C'); else if (druh === 'tc') { pridej('T'); pridej('C'); }
    return o.map(a => `<option value="${a}">${esc(symbol(a))}</option>`).join('');
  }
  function kontrolaOperanduUI(text, druh) {
    if (!text && (druh === 'bitOpt' || druh === 'cisloOpt')) return '';
    const o = PLC.rozeberOperand(text);
    if (!o) return 'Neplatný operand.';
    if ((druh === 'bitW' || druh === 'cisloW') && o.druh === 'konst') return 'Sem nelze zapsat konstantu.';
    if (o.druh === 'adr') {
      const a = o.a;
      if (druh === 'bitW' && !['Q', 'M', '#'].includes(a.oblast)) return 'Zapisovat lze jen do Q, M nebo #proměnné.';
      if (druh === 'cisloW' && !['MW', 'MD', 'QW', '#', 'Q', 'M'].includes(a.oblast)) return 'Zapisovat lze jen do MW, MD, QW nebo #proměnné.';
      if ((druh === 'bit' || druh === 'bitOpt') && a.slovo) return 'Potřebný je bit, ne slovo.';
      if (druh === 'timer' && !['T', '#'].includes(a.oblast)) return 'Časovač: T0–T31.';
      if (druh === 'counter' && !['C', '#'].includes(a.oblast)) return 'Čítač: C0–C31.';
      if (a.oblast === '#' && !jeFb()) return '#proměnné existují jen ve funkčním bloku.';
      return symbol(a.klic) ? 'Symbol: ' + symbol(a.klic) : '';
    }
    return o.typ === 'REAL' ? 'konstanta REAL' : 'konstanta INT';
  }
  function poleParametru(u, k, jm, druh, idx) {
    const id = `vlp_${idx}`;
    if (druh === 'op') return `<div class="radek"><span>${esc(jm)}</span><select data-p="${k}" data-druh="op" id="${id}">${PLC.OPERACE.map(o => `<option ${o === u[k] ? 'selected' : ''}>${o}</option>`).join('')}</select></div>`;
    if (druh === 'ms') return `<div class="radek"><span>${esc(jm)}</span><input type="text" data-p="${k}" data-druh="ms" id="${id}" value="${cislo((+u[k] || 0) / 1000)}" inputmode="decimal"></div><div class="pole-stav">sekundy (např. 2,5)</div>`;
    if (druh === 'int' || druh === 'real') return `<div class="radek"><span>${esc(jm)}</span><input type="text" data-p="${k}" data-druh="${druh}" id="${id}" value="${druh === 'real' ? cislo(u[k]) : u[k]}" inputmode="decimal"></div>`;
    if (druh === 'fb') {
      const fbs = (projekt.fb || []).filter(f => f !== pou());
      return `<div class="radek"><span>${esc(jm)}</span><select data-p="fb" data-druh="fb" id="${id}"><option value="">(zvolte)</option>${fbs.map(f => `<option ${f.nazev === u.fb ? 'selected' : ''}>${esc(f.nazev)}</option>`).join('')}</select></div>`
        + (fbs.length ? '' : '<div class="pole-stav chyba">Projekt nemá jiný funkční blok – vytvořte ho tlačítkem „+ Funkční blok“.</div>');
    }
    if (druh === 'inst') return `<div class="radek"><span>${esc(jm)}</span><input type="text" data-p="inst" data-druh="inst" id="${id}" value="${esc(u.inst || '')}" maxlength="24" spellcheck="false"></div><div class="pole-stav">každá instance má vlastní paměť</div>`;
    const t = u[k] === undefined ? '' : String(u[k]);
    const chyba = kontrolaOperanduUI(t, druh);
    const spatne = !!(t || !(druh === 'bitOpt' || druh === 'cisloOpt')) && !PLC.rozeberOperand(t);
    return `<div class="radek"><span>${esc(jm)}</span><input type="text" data-p="${k}" data-druh="${druh}" id="${id}" value="${esc(t)}" list="dl_${idx}" autocomplete="off" spellcheck="false" ${spatne ? 'class="chyba"' : ''} title="${esc(DRUH_POPIS[druh] || '')}">
      <datalist id="dl_${idx}">${nabidkaOperandu(druh)}</datalist></div><div class="pole-stav${spatne ? ' chyba' : ''}" data-stav="${k}">${esc(chyba)}</div>`;
  }
  function vykresliVlastnosti() {
    const el = $('#vlastnosti');
    if (vybranaPricka) {
      const n = PLC.najdiPricku(projekt, vybranaPricka); if (!n) { el.innerHTML = ''; return; }
      const p = n.pricka;
      const bpAno = n.pou === projekt;
      el.innerHTML = `<h2>Příčka ${n.index + 1}${n.pou !== projekt ? ' – ' + esc(n.pou.nazev) : ''}</h2>
        <div class="radek"><span>Komentář</span><textarea id="vlKomentar" maxlength="300" rows="2">${esc(p.komentar)}</textarea></div>
        <div class="zive-hodnoty">Podmínka: ${esc(PLC.textPodminky(p.podminka))}</div>
        <div class="tlacitka">
          <button data-a="pricka-nahoru">▲ Nahoru</button><button data-a="pricka-dolu">▼ Dolů</button>
          <button data-a="pricka-pod">+ Příčka pod</button><button data-a="pricka-kopie">Duplikovat</button>
          ${bpAno ? `<button data-a="zarazka">${sim.breakpointy.has(p.id) ? 'Zrušit zarážku' : 'Zarážka (F9)'}</button>` : ''}
          <button data-a="pricka-smaz" class="nebezpecne">Smazat příčku</button></div>`;
      $('#vlKomentar').addEventListener('change', e => zmena(() => { p.komentar = e.target.value.slice(0, 300); }));
      return;
    }
    if (!vyber.length) {
      el.innerHTML = `<h2>Vlastnosti</h2><p class="nic">Vyberte prvek (klik), úsek kontaktů (Shift+klik) nebo příčku (klik na její číslo).
        <br>Klávesy: <span class="klavesa">Del</span> smazat, <span class="klavesa">←</span><span class="klavesa">→</span> posun, <span class="klavesa">Ctrl+Z</span> zpět,
        <span class="klavesa">F5</span> RUN, <span class="klavesa">mezerník</span> cyklus, <span class="klavesa">F10</span> příčka, <span class="klavesa">F9</span> zarážka, <span class="klavesa">Esc</span> zrušit.</p>`;
      return;
    }
    if (vyber.length > 1) {
      el.innerHTML = `<h2>Výběr: ${vyber.length} prvků</h2><p class="nic">Úsek ${esc(vyber.map(id => { const u = PLC.najdi(projekt, id).uzel; return u.adr || u.in1 || '?'; }).join(' · '))}</p>
        <div class="tlacitka"><button data-a="paralelne">Paralelní větev kolem výběru</button><button data-a="smaz" class="nebezpecne">Smazat výběr</button></div>`;
      return;
    }
    const n = PLC.najdi(projekt, vyber[0]);
    if (!n) { el.innerHTML = ''; return; }
    const u = n.uzel;
    if (u.typ === 'PAR') {
      el.innerHTML = `<h2>Paralelní blok (${u.vetve.length} větve)</h2><div class="zive-hodnoty">${esc(PLC.textPodminky({ prvky: [u] }))}</div>
        <div class="tlacitka"><button data-a="vetev">+ Větev</button><button data-a="paralelne">Paralelní větev kolem bloku</button>
        <button data-a="vlevo">◀</button><button data-a="vpravo">▶</button><button data-a="presun">Přesunout…</button><button data-a="smaz" class="nebezpecne">Smazat blok</button></div>`;
      return;
    }
    const def = INSTR[u.typ];
    const kontakt = jeKontakt(u.typ);
    const skupina = kontakt ? PLC.KONTAKTY.filter(t => t !== 'CMP' || u.typ === 'CMP').filter(t => u.typ === 'CMP' ? t === 'CMP' : t !== 'CMP')
      : PLC.CIVKY.includes(u.typ) ? PLC.CIVKY : PLC.CASOVACE.includes(u.typ) ? PLC.CASOVACE : ['CTU', 'CTD'].includes(u.typ) ? ['CTU', 'CTD']
      : ['ADD', 'SUB', 'MUL', 'DIV', 'MOD'].includes(u.typ) ? ['ADD', 'SUB', 'MUL', 'DIV', 'MOD'] : ['SR', 'RS'].includes(u.typ) ? ['SR', 'RS'] : ['R_TRIG', 'F_TRIG'].includes(u.typ) ? ['R_TRIG', 'F_TRIG'] : [u.typ];
    let html = `<h2>${esc(def.nazev)}</h2>`;
    if (skupina.length > 1) html += `<div class="radek"><span>Typ</span><select id="vlTyp">${skupina.map(t => `<option value="${t}" ${t === u.typ ? 'selected' : ''}>${esc(PLC.NAZVY[t])}</option>`).join('')}</select></div>`;
    def.param.forEach(([k, jm, druh], i) => { html += poleParametru(u, k, jm, druh, i); });
    if (u.typ === 'CALL') {
      const f = PLC.najdiFb(projekt, u.fb);
      if (f) {
        html += '<h3>Parametry</h3>';
        f.rozhrani.filter(r => r.smer !== 'STAT').forEach((r, i) => {
          const druh = r.smer === 'IN' ? (r.typ === 'BOOL' ? 'bitOpt' : 'cisloOpt') : (r.typ === 'BOOL' ? 'bitW' : 'cisloW');
          const t = (u.prm || {})[r.nazev] || '';
          html += `<div class="radek"><span title="${esc(r.komentar || '')}">${r.smer === 'IN' ? '→' : '←'} ${esc(r.nazev)} <small>${r.typ}</small></span><input type="text" data-prm="${esc(r.nazev)}" value="${esc(t)}" list="dlp_${i}" autocomplete="off" spellcheck="false" placeholder="${r.smer === 'IN' ? 'nepřipojeno' : 'nezapisovat'}"><datalist id="dlp_${i}">${nabidkaOperandu(druh === 'bitW' ? 'bitW' : druh)}</datalist></div>`;
        });
        html += `<div class="tlacitka"><button class="male" data-a="otevritFb">Otevřít blok ${esc(f.nazev)}</button></div>`;
      }
    }
    const a = PLC.rozeberAdresu(u.adr || '');
    if (a && a.oblast !== '#') html += `<div class="radek"><span>Symbol ${esc(a.klic)}</span><input type="text" id="vlSym" value="${esc(symbol(a.klic))}" maxlength="40" placeholder="jméno adresy"></div>`;
    html += `<div class="zive-hodnoty" id="vlZive"></div>`;
    const vPar = n.rodicPar;
    html += `<div class="tlacitka">` + (kontakt
      ? `<button data-a="vlevo" title="Posunout vlevo">◀</button><button data-a="vpravo" title="Posunout vpravo">▶</button>
         <button data-a="paralelne" title="Obalí prvek paralelní větví s kontaktem z palety">Paralelní větev</button>
         ${vPar ? '<button data-a="vetev">+ Větev bloku</button><button data-a="nadrazeny">Vybrat blok</button>' : ''}`
      : `<button data-a="vlevo" title="Posunout nahoru">▲</button><button data-a="vpravo" title="Posunout dolů">▼</button>`)
      + `<button data-a="presun">Přesunout…</button><button data-a="kopie">Duplikovat</button>${u.adr && a && a.oblast !== '#' ? '<button data-a="sledovat">Sledovat</button>' : ''}<button data-a="smaz" class="nebezpecne">Smazat</button></div>`;
    el.innerHTML = html;
    const typ = $('#vlTyp');
    if (typ) typ.addEventListener('change', e => zmena(() => { const t = e.target.value; const vych = PLC.novyPrvek(t, u.adr); for (const [k] of INSTR[t].param) if (u[k] === undefined) u[k] = vych[k]; u.typ = t; }));
    el.querySelectorAll('[data-p]').forEach(inp => {
      const k = inp.dataset.p, druh = inp.dataset.druh;
      if (!['op', 'ms', 'int', 'real', 'fb', 'inst'].includes(druh)) inp.addEventListener('input', () => {
        const ch = kontrolaOperanduUI(inp.value.trim(), druh); const spatne = !!inp.value.trim() && !PLC.rozeberOperand(inp.value.trim());
        inp.classList.toggle('chyba', spatne); const s = el.querySelector(`[data-stav="${k}"]`); if (s) { s.textContent = ch; s.classList.toggle('chyba', spatne || /lze|jen|Potřebný|existují/.test(ch)); }
      });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
      inp.addEventListener('change', () => {
        const v = inp.value.trim();
        if (druh === 'ms') { const s = +v.replace(',', '.').replace(/\s/g, ''); if (!Number.isFinite(s) || s < 0 || s > PLC.PT_MAX / 1000) { inp.classList.add('chyba'); Dialog.chyba(`Hodnota musí být 0–${PLC.PT_MAX / 1000} s.`); return; } zmena(() => { u[k] = Math.round(s * 1000); }); return; }
        if (druh === 'int') { const s = +v; if (!Number.isInteger(s) || s < 0 || s > PLC.PV_MAX) { inp.classList.add('chyba'); Dialog.chyba(`Celé číslo 0–${PLC.PV_MAX}.`); return; } zmena(() => { u[k] = s; }); return; }
        if (druh === 'real') { const s = +v.replace(',', '.'); if (!Number.isFinite(s)) { inp.classList.add('chyba'); Dialog.chyba('Zadejte číslo.'); return; } zmena(() => { u[k] = s; }); return; }
        if (druh === 'fb') { zmena(() => { u.fb = v; if (!u.inst && v) u.inst = navrhInstance(v); }); return; }
        if (druh === 'inst') { zmena(() => { u.inst = v.slice(0, 24); }); return; }
        if (druh === 'op') { zmena(() => { u[k] = v; }); return; }
        const r = PLC.rozeberAdresu(v);
        zmena(() => {
          u[k] = r ? r.klic : v.slice(0, 30);
          if (r && k === 'adr') { if (jeKontakt(u.typ)) posledni.kontakt = r.klic; else if (PLC.CIVKY.includes(u.typ)) posledni.civka = r.klic; }
        });
      });
    });
    el.querySelectorAll('[data-prm]').forEach(inp => inp.addEventListener('change', () => {
      const v = inp.value.trim(), r = PLC.rozeberAdresu(v);
      zmena(() => { u.prm = u.prm || {}; if (v) u.prm[inp.dataset.prm] = r ? r.klic : v.slice(0, 30); else delete u.prm[inp.dataset.prm]; });
    }));
    const sym = $('#vlSym');
    if (sym) sym.addEventListener('change', () => zmena(() => { const k = PLC.rozeberAdresu(u.adr); if (!k) return; const v = sym.value.trim().slice(0, 40); if (v) projekt.symboly[k.klic] = v; else delete projekt.symboly[k.klic]; }));
    aktualizujVlastnostiZive();
  }
  function aktualizujVlastnostiZive() {
    const z = $('#vlZive'); if (!z || vyber.length !== 1) return;
    const n = PLC.najdi(projekt, vyber[0]); if (!n) return;
    const u = n.uzel, k = lokalKontext(), bezi = sim.rezim !== 'STOP';
    const casti = [];
    for (const [, t] of PLC.operandyPrvku(u)) {
      if (!t) continue;
      const o = PLC.rozeberOperand(t); if (!o || o.druh !== 'adr') continue;
      const h = bezi ? PLC.hodnota(sim.plc, t, k.lokal, k.typy) : null;
      casti.push(`${t} = ${h === null ? '–' : fmtCislo(h, jeRealAdr(t, k.typy))}`);
    }
    const s = bezi && k.stopa && k.stopa[u.id];
    if (s) {
      casti.push(`napájení ${s.vstup ? 1 : 0}`);
      if (s.ET !== undefined) casti.push(`ET ${fmtS(s.ET)}`);
      if (s.CV !== undefined) casti.push(`CV ${s.CV}`);
      if (s.P !== undefined) casti.push(`e ${cislo(s.e, 2)}  P ${cislo(s.P, 2)}  I ${cislo(s.I, 2)}  D ${cislo(s.D, 2)}`);
    }
    const t = casti.join('   ') || '—';
    if (z.textContent !== t) z.textContent = t;
  }
  async function akce(a) {
    const id = vyber[0];
    switch (a) {
      case 'smaz': { const ids = vyber.slice(); zmena(() => { for (const i of ids) if (PLC.najdi(projekt, i)) PLC.smaz(projekt, i); }); vyber = []; vykresliLadder(); vykresliVlastnosti(); break; }
      case 'vlevo': zmena(() => PLC.posun(projekt, id, -1)); break;
      case 'vpravo': zmena(() => PLC.posun(projekt, id, 1)); break;
      case 'paralelne': {
        const typ = jeKontakt(nastroj) ? nastroj : 'NO'; let novy;
        if (zmena(() => { novy = novyPrvekUI(typ); PLC.paralelne(projekt, vyber, novy); })) { vyber = [novy.id]; vykresliLadder(); vykresliVlastnosti(); }
        break;
      }
      case 'vetev': {
        const n = PLC.najdi(projekt, id); const par = n.uzel.typ === 'PAR' ? n.uzel : n.rodicPar;
        const typ = jeKontakt(nastroj) ? nastroj : 'NO'; let novy;
        if (par && zmena(() => { novy = PLC.pridejVetev(projekt, par.id, novyPrvekUI(typ)); })) { vyber = [novy.id]; vykresliLadder(); vykresliVlastnosti(); }
        break;
      }
      case 'nadrazeny': { const n = PLC.najdi(projekt, id); if (n && n.rodicPar) { vyber = [n.rodicPar.id]; vykresliLadder(); vykresliVlastnosti(); } break; }
      case 'presun': presouvani = id; vykresliLadder(); break;
      case 'kopie': { const n = PLC.najdi(projekt, id); let k; if (n && n.pole && zmena(() => { k = PLC.premapujId(n.uzel); n.pole.splice(n.index + 1, 0, k); })) { vyber = [k.id]; vykresliLadder(); vykresliVlastnosti(); } break; }
      case 'sledovat': { const n = PLC.najdi(projekt, id); pridejWatch(n.uzel.adr); prepniZalozku('watch'); break; }
      case 'otevritFb': { const n = PLC.najdi(projekt, id); const f = PLC.najdiFb(projekt, n.uzel.fb); if (f) { instanceZobrazeni[f.nazev] = n.uzel.inst; aktivniPou = f.id; vyber = []; poZmene(); } break; }
      case 'pricka-nahoru': zmena(() => PLC.posunPricku(projekt, vybranaPricka, -1)); break;
      case 'pricka-dolu': zmena(() => PLC.posunPricku(projekt, vybranaPricka, 1)); break;
      case 'pricka-pod': { const n = PLC.najdiPricku(projekt, vybranaPricka); let p; zmena(() => { p = PLC.novaPricka(projekt, n.index + 1, n.pou); }); vybranaPricka = p.id; vykresliLadder(); vykresliVlastnosti(); break; }
      case 'pricka-kopie': { const n = PLC.najdiPricku(projekt, vybranaPricka); let k; zmena(() => { k = PLC.premapujId(n.pricka); n.pou.pricky.splice(n.index + 1, 0, k); }); vybranaPricka = k.id; vykresliLadder(); vykresliVlastnosti(); break; }
      case 'zarazka': prepniZarazku(vybranaPricka); vykresliVlastnosti(); break;
      case 'pricka-smaz': {
        const n = PLC.najdiPricku(projekt, vybranaPricka); if (!n) break;
        if ((n.pricka.podminka.prvky.length || n.pricka.vystupy.length) && !(await Dialog.potvrd('Smazat celou příčku včetně prvků?'))) break;
        zmena(() => PLC.smazPricku(projekt, vybranaPricka)); vybranaPricka = null; vykresliVlastnosti(); vykresliLadder();
        break;
      }
    }
  }

  /* ---------- diagnostika ---------- */
  function vykresliDiag() {
    const ch = diag.filter(d => d.uroven === 'chyba').length, va = diag.filter(d => d.uroven === 'varovani').length;
    const o = $('#odznakDiag');
    o.textContent = ch || va || diag.length;
    o.className = 'odznak' + (ch ? ' chyby' : va ? ' varovani' : '');
    o.title = `${ch} chyb, ${va} varování, ${diag.length - ch - va} upozornění`;
    const ik = { chyba: '✕', varovani: '!', info: 'i' }, naz = { chyba: 'Chyba', varovani: 'Varování', info: 'Upozornění' };
    $('#diagSeznam').innerHTML = diag.length ? diag.map((d, i) => `<li class="${d.uroven}" data-i="${i}" tabindex="0"><span class="ik" aria-label="${naz[d.uroven]}">${ik[d.uroven]}</span>
      <span><small>${esc(d.pou || 'MAIN')}${d.pricka >= 0 ? `, příčka ${d.pricka + 1}` : ''}: </small>${esc(d.zprava)}</span></li>`).join('')
      : '<li class="info"><span class="ik">✓</span><span>Program je bez chyb a varování.</span></li>';
  }
  function skocNa(prvekId, pouN, prickaIdx) {
    const cilPou = pouN && pouN !== 'MAIN' ? PLC.najdiFb(projekt, pouN) : projekt;
    if (cilPou) aktivniPou = cilPou === projekt ? null : cilPou.id;
    if (prvekId && PLC.najdi(projekt, prvekId)) { vyber = [prvekId]; vybranaPricka = null; }
    else if (prickaIdx >= 0 && cilPou && cilPou.pricky[prickaIdx]) { vyber = []; vybranaPricka = cilPou.pricky[prickaIdx].id; }
    vykresliPouListu(); vykresliFbPanel(); vykresliLadder(); vykresliVlastnosti();
    const cil = prvekId ? $(`#ladder [data-id="${prvekId}"]`) : prickaIdx >= 0 ? $$('#ladder svg.pricka-svg')[prickaIdx] : null;
    if (cil) cil.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
  }

  /* ---------- vstupy a výstupy ---------- */
  let ledky = [], analogy = [];
  function adresyIO(oblast) {
    const s = new Set(PLC.pouziteAdresy(projekt).filter(a => (PLC.rozeberAdresu(a) || {}).oblast === oblast));
    const m = Procesy.mapa(sim);
    for (const [k, def] of Object.entries(sim.model.signaly)) { const a = PLC.rozeberAdresu(m[k]); if (a && a.oblast === oblast) s.add(a.klic); }
    for (const w of projekt.watch || []) { const a = PLC.rozeberAdresu(w.adr); if (a && a.oblast === oblast) s.add(a.klic); }
    if (zobrazitVse) PLC.vsechnyAdresy(oblast).forEach(a => s.add(a));
    return [...s].sort((a, b) => PLC.poradiAdresy(a) - PLC.poradiAdresy(b));
  }
  const fZnakHtml = a => Object.prototype.hasOwnProperty.call(sim.force, a) ? '<span class="f-znak" title="vynuceno">F</span>' : '';
  function vykresliIO() {
    const kl = a => { const r = PLC.rozeberAdresu(a); return r && r.bajt === 0 ? `<span class="klavesa" title="klávesa">${r.bit + 1}</span>` : ''; };
    $('#ioVstupy').innerHTML = adresyIO('I').map(a => {
      const d = druhVstupu(a), sig = signalNaAdrese(a);
      let ovl;
      if (d === 'cidlo') ovl = '<span class="cidlo">čidlo procesu</span>';
      else {
        const vol = sig ? '' : `<select data-druh="${a}" aria-label="Druh vstupu ${a}"><option value="tlacitko" ${d === 'tlacitko' ? 'selected' : ''}>tlačítko</option><option value="prepinac" ${d === 'prepinac' ? 'selected' : ''}>spínač</option></select>`;
        ovl = vol + (d === 'tlacitko' ? `<button data-tl="${a}" aria-label="Stisknout ${a}">Stisk</button>` : `<button data-pr="${a}" aria-pressed="${!!sim.uziv[a]}" aria-label="Přepnout ${a}">${sim.uziv[a] ? 'Zap' : 'Vyp'}</button>`) + kl(a);
      }
      return `<div class="io-radek"><span class="led" data-led="${a}"></span><code>${a}${fZnakHtml(a)}</code><span class="jm" title="${esc(nazevAdresy(a))}">${esc(nazevAdresy(a))}</span><span class="ovl">${ovl}</span></div>`;
    }).join('') || '<p class="nic">Program nepoužívá žádné digitální vstupy.</p>';
    $('#ioAnalogVstupy').innerHTML = adresyIO('IW').map(a => {
      const sig = signalNaAdrese(a);
      const ovl = sig && sig.druh === 'analog' ? '<span class="cidlo">čidlo procesu</span>' : `<input type="range" min="0" max="32000" step="100" data-aw="${a}" value="${+sim.uziv[a] || 0}" aria-label="Analogový vstup ${a}">`;
      return `<div class="io-analog"><span></span><code>${a}${fZnakHtml(a)}</code>${ovl}<span class="hodn" data-awh="${a}"></span></div>
        <div class="io-radek" style="margin-top:-4px"><span></span><span></span><span class="jm">${esc(nazevAdresy(a))}</span><span></span></div>`;
    }).join('');
    $('#ioVystupy').innerHTML = adresyIO('Q').map(a => `<div class="io-radek"><span class="led vystup" data-led="${a}"></span><code>${a}${fZnakHtml(a)}</code><span class="jm" title="${esc(nazevAdresy(a))}">${esc(nazevAdresy(a))}</span><span></span></div>`).join('')
      || '<p class="nic">Program nepoužívá žádné digitální výstupy.</p>';
    $('#ioAnalogVystupy').innerHTML = adresyIO('QW').map(a => `<div class="io-analog"><span></span><code>${a}${fZnakHtml(a)}</code><div class="bar"><span data-qwb="${a}"></span></div><span class="hodn" data-awh="${a}"></span></div>
      <div class="io-radek" style="margin-top:-4px"><span></span><span></span><span class="jm">${esc(nazevAdresy(a))}</span><span></span></div>`).join('');
    ledky = $$('[data-led]').map(e => ({ e, a: e.dataset.led, st: null }));
    analogy = $$('[data-awh]').map(e => ({ e, a: e.dataset.awh, bar: $(`[data-qwb="${e.dataset.awh}"]`), st: null }));
    aktualizujIO();
  }
  function inzenyrsky(a, raw) {
    const s = signalNaAdrese(a);
    if (!s || !s.rozsah) return '';
    if (raw < 0) return ' · pod rozsahem';
    return ` · ${cislo(s.rozsah[0] + (s.rozsah[1] - s.rozsah[0]) * raw / Procesy.AMAX, 1)} ${s.jednotka || ''}`;
  }
  function aktualizujIO() {
    const I = Procesy.vstupy(sim), Q = Procesy.vystupy(sim);
    for (const l of ledky) { const on = !!(l.a[0] === 'I' ? (sim.force[l.a] !== undefined ? sim.force[l.a] : I[l.a]) : Q[l.a]); if (on !== l.st) { l.e.classList.toggle('zap', on); l.st = on; } }
    for (const x of analogy) {
      const vst = x.a.startsWith('IW');
      const raw = vst ? (sim.force[x.a] !== undefined ? +sim.force[x.a] : I[x.a]) : (+Q[x.a] || 0);
      const t = `${raw}${inzenyrsky(x.a, raw)}`;
      if (t !== x.st) { x.e.textContent = t; x.st = t; if (x.bar) x.bar.style.width = Math.max(0, Math.min(100, raw / Procesy.AMAX * 100)) + '%'; }
    }
  }
  function nastavVstup(a, h) {
    sim.uziv[a] = h;
    const b = $(`[data-pr="${a}"]`); if (b) { b.setAttribute('aria-pressed', String(!!h)); b.textContent = h ? 'Zap' : 'Vyp'; }
    const t = $(`[data-tl="${a}"]`); if (t) t.setAttribute('aria-pressed', String(!!h));
    aktualizujIO();
  }
  function nastavIOUdalosti() {
    const v = $('#ioVstupy');
    v.addEventListener('pointerdown', e => { const b = e.target.closest('[data-tl]'); if (!b) return; e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (x) { /* nic */ } nastavVstup(b.dataset.tl, true); });
    const pust = e => { const b = e.target.closest('[data-tl]'); if (b && sim.uziv[b.dataset.tl]) nastavVstup(b.dataset.tl, false); };
    v.addEventListener('pointerup', pust); v.addEventListener('pointercancel', pust); v.addEventListener('lostpointercapture', pust);
    v.addEventListener('keydown', e => { const b = e.target.closest('[data-tl]'); if (b && (e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); nastavVstup(b.dataset.tl, true); } });
    v.addEventListener('keyup', e => { const b = e.target.closest('[data-tl]'); if (b && (e.key === ' ' || e.key === 'Enter')) nastavVstup(b.dataset.tl, false); });
    v.addEventListener('click', e => { const b = e.target.closest('[data-pr]'); if (b) nastavVstup(b.dataset.pr, !sim.uziv[b.dataset.pr]); });
    v.addEventListener('change', e => {
      const s = e.target.closest('[data-druh]'); if (!s) return;
      const a = s.dataset.druh;
      zmena(() => { if (s.value === 'prepinac') projekt.vstupy[a] = 'prepinac'; else delete projekt.vstupy[a]; });
      sim.uziv[a] = false;
    });
    $('#ioAnalogVstupy').addEventListener('input', e => { const r = e.target.closest('[data-aw]'); if (r) { sim.uziv[r.dataset.aw] = +r.value; aktualizujIO(); } });
  }

  /* ---------- proces: ovládání, signály, poruchy ---------- */
  function vykresliProcesOvl() {
    const m = sim.model;
    $('#nadpisProces').textContent = m.nazev;
    $('#procesPopis').textContent = m.popis;
    const o = [];
    for (const n of m.nastaveni || []) o.push(`<label>${esc(n.nazev)} <input type="range" data-nast="${n.klic}" min="${n.min}" max="${n.max}" step="${n.krok}" value="${n.vychozi}"> <span data-nast-h="${n.klic}">${n.popisky ? n.popisky[n.vychozi] : n.vychozi + ' ' + (n.jednotka || '')}</span></label>`);
    for (const a of m.akceSeznam || []) o.push(`<button class="male" data-akce="${a.klic}">${esc(a.nazev)}</button>`);
    o.push('<button class="male" data-akce="__reset" title="Vrátí proces do výchozího stavu">Výchozí stav procesu</button>');
    $('#procesOvl').innerHTML = o.join('');
    vykresliSignaly();
  }
  function vykresliSignaly() {
    if (!sim) return;
    const m = Procesy.mapa(sim), sig = Object.entries(sim.model.signaly);
    $('#detailSignaly').hidden = !sig.length;
    const druhy = { tlacitko: 'tlačítko', prepinac: 'spínač', cidlo: 'čidlo', analog: 'analog. čidlo', aktor: 'akční člen', aktorA: 'analog. výstup' };
    $('#tabSignaly').innerHTML = '<tr><th>Signál</th><th>Druh</th><th>Adresa</th><th>Porucha</th><th>Stav</th></tr>' + sig.map(([k, s]) =>
      `<tr class="${sim.poruchy[k] ? 'porucha' : ''}"><td>${esc(s.nazev)}</td><td>${s.smer === 'vstup' ? '→ PLC' : 'PLC →'} ${druhy[s.druh] || s.druh}</td>
       <td><input type="text" data-map="${k}" value="${esc(m[k])}" aria-label="Adresa signálu ${esc(s.nazev)}" spellcheck="false"></td>
       <td><select data-por="${k}" aria-label="Porucha signálu ${esc(s.nazev)}"><option value="">—</option>${Object.entries(Procesy.PORUCHY).map(([pk, pn]) => `<option value="${pk}" ${sim.poruchy[k] === pk ? 'selected' : ''}>${pn}</option>`).join('')}</select></td>
       <td data-sv="${k}"></td></tr>`).join('');
    const ch = Procesy.kontrolaMapovani(sim.model, projekt.mapovani);
    $('#signalyChyby').textContent = ch.join(' ');
    signalBunky = $$('[data-sv]').map(e => ({ e, k: e.dataset.sv, st: null }));
  }
  let signalBunky = [];
  function aktualizujSignaly() {
    if (!signalBunky.length || !$('#detailSignaly').open) return;
    const s = Procesy.signaly(sim), c = Procesy.cidla(sim), I = Procesy.vstupy(sim), m = Procesy.mapa(sim);
    for (const b of signalBunky) {
      const def = sim.model.signaly[b.k];
      let h = def.smer === 'vystup' ? s[b.k] : (def.druh === 'cidlo' || def.druh === 'analog' ? c[b.k] : s[b.k]);
      const plc = def.smer === 'vstup' ? I[m[b.k]] : undefined;
      let t = typeof h === 'boolean' ? (h ? '1' : '0') : String(h === undefined ? '–' : Math.round(h));
      if (plc !== undefined && String(typeof plc === 'boolean' ? (plc ? '1' : '0') : plc) !== t) t += ` (PLC čte ${typeof plc === 'boolean' ? (plc ? 1 : 0) : plc})`;
      if (t !== b.st) { b.e.textContent = t; b.st = t; }
    }
  }
  function nastavProcesUdalosti() {
    const o = $('#procesOvl');
    o.addEventListener('input', e => {
      const r = e.target.closest('[data-nast]'); if (!r) return;
      const n = sim.model.nastaveni.find(x => x.klic === r.dataset.nast);
      sim.model.nastav(sim.ps, n.klic, +r.value);
      $(`[data-nast-h="${n.klic}"]`).textContent = n.popisky ? n.popisky[+r.value] : r.value + ' ' + (n.jednotka || '');
    });
    o.addEventListener('click', e => {
      const b = e.target.closest('[data-akce]'); if (!b) return;
      if (b.dataset.akce === '__reset') { sim.ps = sim.model.vytvor(7); $$('#procesOvl [data-nast]').forEach(r => sim.model.nastav(sim.ps, r.dataset.nast, +r.value)); }
      else sim.model.proved(sim.ps, b.dataset.akce);
    });
    $('#tabSignaly').addEventListener('change', e => {
      const m = e.target.closest('[data-map]'), p = e.target.closest('[data-por]');
      if (p) { if (p.value) sim.poruchy[p.dataset.por] = p.value; else delete sim.poruchy[p.dataset.por]; vykresliSignaly(); return; }
      if (m) {
        const k = m.dataset.map, def = sim.model.signaly[k], a = PLC.rozeberAdresu(m.value);
        const nove = Object.assign({}, projekt.mapovani); if (a && a.klic !== def.adr) nove[k] = a.klic; else delete nove[k];
        const ch = Procesy.kontrolaMapovani(sim.model, nove);
        const vlastni = ch.filter(x => x.startsWith(def.nazev + ':'));
        if (!a || vlastni.length) { Dialog.chyba(vlastni.join(' ') || 'Neplatná adresa.'); m.value = Procesy.mapa(sim)[k]; return; }
        zmena(() => { projekt.mapovani = nove; });
        if (ch.length) Dialog.info('Pozor: ' + ch.join(' '));
      }
    });
  }
  let barvy = null;
  function nactiBarvy() {
    const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
    const svetle = document.documentElement.getAttribute('data-theme') === 'light';
    barvy = { text: v('--text'), slaby: v('--text-muted'), obrys: v('--border-strong'), panel: v('--bg-panel'), akcent: v('--accent'),
      ok: v('--drat-nap'), okSoft: v('--sep-fill'), chyba: v('--danger'), chybaSoft: svetle ? '#fde3e0' : '#4a1f1f',
      zhasnuto: svetle ? '#cfd5db' : '#3a3f45', pas: svetle ? '#9aa3ab' : '#4b5259', trubka: svetle ? '#90a4ae' : '#55626b',
      vozovka: svetle ? '#7d858c' : '#3d4247', chodnik: svetle ? '#c9c3b8' : '#5a544b' };
  }
  const platno = $('#platno');
  function kresliProces(cas) {
    const r = platno.getBoundingClientRect(); if (!r.width) return;
    const dpr = window.devicePixelRatio || 1;
    const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (platno.width !== W || platno.height !== H) { platno.width = W; platno.height = H; }
    const ctx = platno.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    KRESBA.kresli(ctx, r.width, r.height, { model: sim.model, ps: sim.ps, s: Procesy.signaly(sim), c: Procesy.cidla(sim), m: Procesy.mapa(sim), plcStav: sim.plc }, barvy, cas);
  }
  let souhrnText = '';
  function aktualizujSouhrn() {
    const radky = sim.model.souhrn(sim.ps).concat(Object.keys(sim.poruchy).length ? [`⚠ Aktivní poruchy: ${Object.keys(sim.poruchy).length}`] : []);
    const t = radky.join('|'); if (t === souhrnText) return; souhrnText = t;
    $('#souhrn').innerHTML = radky.map(x => `<span class="${x.startsWith('⚠') ? 'vyst' : ''}">${esc(x)}</span>`).join('');
  }

  /* ---------- sledování (watch) a vynucení ---------- */
  const lzeVynutit = a => ['I', 'IW', 'Q', 'QW'].includes(a.oblast);
  const lzeZapsat = a => ['M', 'MW', 'MD', 'Q', 'QW', 'C'].includes(a.oblast);
  function pridejWatch(adr) {
    const a = PLC.rozeberAdresu(adr || '');
    if (!a || a.oblast === '#') { Dialog.chyba('Neplatná adresa (sledovat lze globální adresy).'); return false; }
    if ((projekt.watch || []).some(w => w.adr === a.klic)) return false;
    zmena(() => { projekt.watch = (projekt.watch || []).concat([{ adr: a.klic, format: a.oblast === 'MD' ? 'DEC' : 'DEC', trend: false }]); });
    return true;
  }
  function fmtWatch(a, h, format) {
    if (h === null || h === undefined) return '–';
    const r = PLC.rozeberAdresu(a);
    if (r.typ === 'BOOL' || format === 'BOOL') return h ? 'TRUE' : 'FALSE';
    if (r.oblast === 'MD') return cislo(h, 4);
    const v = Math.round(h) & 0xFFFF;
    if (format === 'HEX') return '16#' + v.toString(16).toUpperCase().padStart(4, '0');
    if (format === 'BIN') return '2#' + v.toString(2).padStart(16, '0').replace(/(\d{4})(?=\d)/g, '$1_');
    return String(Math.round(h));
  }
  let watchBunky = [];
  function vykresliWatch() {
    const w = projekt.watch || [];
    const t = $('#tabWatch');
    if (!w.length) { t.innerHTML = '<tr><td class="nic">Tabulka je prázdná – přidejte adresu nebo „všechny použité“.</td></tr>'; watchBunky = []; return; }
    t.innerHTML = '<tr><th>Adresa</th><th>Symbol</th><th>Hodnota</th><th>Formát</th><th>Zapsat</th><th>Vynutit</th><th>Analyzátor</th><th></th></tr>' + w.map((x, i) => {
      const a = PLC.rozeberAdresu(x.adr);
      const vyn = Object.prototype.hasOwnProperty.call(sim.force, x.adr);
      return `<tr class="${vyn ? 'vynuceno' : ''}"><td><code>${x.adr}</code></td><td>${esc(nazevAdresy(x.adr))}</td><td class="hod" data-wh="${i}"></td>
        <td>${a.typ === 'BOOL' || a.oblast === 'MD' ? '' : `<select data-wf="${i}" aria-label="Formát">${['DEC', 'HEX', 'BIN'].map(f => `<option ${f === x.format ? 'selected' : ''}>${f}</option>`).join('')}</select>`}</td>
        <td>${lzeZapsat(a) ? `<input type="text" data-wz="${i}" placeholder="${a.typ === 'BOOL' ? '0/1' : 'hodnota'}" aria-label="Zapsat do ${x.adr}"><button class="male" data-wzb="${i}">Zapsat</button>` : '<span class="nic">jen čtení</span>'}</td>
        <td>${lzeVynutit(a) ? `<input type="text" data-wv="${i}" placeholder="${a.typ === 'BOOL' ? '0/1' : 'hodnota'}" value="${vyn ? sim.force[x.adr] === true ? 1 : sim.force[x.adr] === false ? 0 : sim.force[x.adr] : ''}" aria-label="Vynutit ${x.adr}"><button class="male" data-wvb="${i}">${vyn ? 'Změnit' : 'Vynutit'}</button>${vyn ? `<button class="male" data-wvz="${i}">Zrušit</button>` : ''}` : '<span class="nic">—</span>'}</td>
        <td><input type="checkbox" data-wt="${i}" ${x.trend ? 'checked' : ''} aria-label="Do analyzátoru"></td>
        <td><button class="male nebezpecne" data-wx="${i}" aria-label="Odebrat">×</button></td></tr>`;
    }).join('');
    watchBunky = w.map((x, i) => ({ x, e: t.querySelector(`[data-wh="${i}"]`), st: null }));
    aktualizujWatch();
  }
  function aktualizujWatch() {
    const bezi = sim.rezim !== 'STOP', I = Procesy.vstupy(sim);
    for (const b of watchBunky) {
      const a = PLC.rozeberAdresu(b.x.adr);
      let h = bezi ? PLC.hodnota(sim.plc, b.x.adr, null) : (a.oblast === 'I' || a.oblast === 'IW' ? (a.oblast === 'I' ? (I[a.klic] ? 1 : 0) : I[a.klic]) : null);
      if ((a.oblast === 'T' || a.oblast === 'C') && bezi) h = PLC.hodnota(sim.plc, b.x.adr, null);
      let t = fmtWatch(b.x.adr, h, b.x.format);
      if (bezi && a.oblast === 'T' && sim.plc.T[a.klic]) t = `ET ${fmtS(sim.plc.T[a.klic].ET)} Q=${sim.plc.T[a.klic].Q ? 1 : 0}`;
      if (bezi && a.oblast === 'C' && sim.plc.C[a.klic]) t = `CV ${sim.plc.C[a.klic].CV} Q=${sim.plc.C[a.klic].Q ? 1 : 0}`;
      if (bezi && (a.oblast === 'Q' || a.oblast === 'QW') && Object.prototype.hasOwnProperty.call(sim.force, a.klic)) t += ` (výstup ${fmtWatch(a.klic, sim.plc.vystupy[a.klic], b.x.format)})`;
      if (t !== b.st) { b.e.textContent = t; b.st = t; }
    }
  }
  function nactiHodnotuZPole(a, text) {
    const t = text.trim().replace(',', '.');
    if (a.typ === 'BOOL') { if (/^(1|true|zap)$/i.test(t)) return 1; if (/^(0|false|vyp)$/i.test(t)) return 0; return null; }
    const o = PLC.rozeberOperand(text.trim());
    if (o && o.druh === 'konst') return o.hodnota;
    const v = +t; return Number.isFinite(v) ? v : null;
  }
  function nastavWatchUdalosti() {
    const t = $('#tabWatch');
    t.addEventListener('click', e => {
      const w = projekt.watch || [];
      const z = e.target.closest('[data-wzb]'), v = e.target.closest('[data-wvb]'), vz = e.target.closest('[data-wvz]'), x = e.target.closest('[data-wx]');
      if (z) {
        const i = +z.dataset.wzb, a = PLC.rozeberAdresu(w[i].adr), h = nactiHodnotuZPole(a, t.querySelector(`[data-wz="${i}"]`).value);
        if (h === null) { Dialog.chyba('Zadejte číslo (u bitu 0 nebo 1).'); return; }
        if (sim.rezim === 'STOP') { Dialog.chyba('Zápis hodnoty jde jen při běhu nebo pauze PLC.'); return; }
        try { PLC.zapisHodnotu(sim.plc, a.klic, h); Dialog.info(`${a.klic} ← ${h}`); } catch (er) { Dialog.chyba(er.message); }
        aktualizujWatch(); aktualizujZive(true);
      }
      if (v) {
        const i = +v.dataset.wvb, a = PLC.rozeberAdresu(w[i].adr), h = nactiHodnotuZPole(a, t.querySelector(`[data-wv="${i}"]`).value);
        if (h === null) { Dialog.chyba('Zadejte číslo (u bitu 0 nebo 1).'); return; }
        sim.force[a.klic] = a.typ === 'BOOL' ? !!h : Math.round(h);
        poVynuceni();
      }
      if (vz) { delete sim.force[w[+vz.dataset.wvz].adr]; poVynuceni(); }
      if (x) zmena(() => { projekt.watch.splice(+x.dataset.wx, 1); });
    });
    t.addEventListener('change', e => {
      const f = e.target.closest('[data-wf]'), tr = e.target.closest('[data-wt]');
      if (f) zmena(() => { projekt.watch[+f.dataset.wf].format = f.value; });
      if (tr) zmena(() => { projekt.watch[+tr.dataset.wt].trend = tr.checked; });
    });
    t.addEventListener('keydown', e => { if (e.key === 'Enter') { const b = e.target.closest('td') && e.target.closest('td').querySelector('button'); if (b) b.click(); } });
    $('#btnWatchPridat').addEventListener('click', () => { if (pridejWatch($('#watchAdr').value)) $('#watchAdr').value = ''; });
    $('#watchAdr').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnWatchPridat').click(); });
    $('#btnWatchPouzite').addEventListener('click', () => {
      const ex = new Set((projekt.watch || []).map(w => w.adr));
      const nove = PLC.pouziteAdresy(projekt).filter(a => !ex.has(a) && (PLC.rozeberAdresu(a) || {}).oblast !== 'S').map(a => ({ adr: a, format: 'DEC', trend: false }));
      if (!nove.length) { Dialog.info('Všechny použité adresy už jsou v tabulce.'); return; }
      zmena(() => { projekt.watch = (projekt.watch || []).concat(nove).slice(0, 100); });
    });
    $('#btnWatchVymaz').addEventListener('click', async () => { if ((projekt.watch || []).length && await Dialog.potvrd('Vyprázdnit tabulku sledování?')) zmena(() => { projekt.watch = []; }); });
    $('#btnForceZrus').addEventListener('click', () => { sim.force = {}; poVynuceni(); });
  }
  function poVynuceni() { vykresliWatch(); vykresliIO(); vykresliLadder(); aktualizujRezim(); vykresliSystem(); }

  /* ---------- logický analyzátor ---------- */
  const prubeh = $('#prubeh');
  let kurzorX = null;
  function rozlozeniAnalyzatoru() {
    const sig = sim.sledovat, radky = []; let y = 6;
    for (const a of sig) { const r = PLC.rozeberAdresu(a); const analog = r && r.slovo; const h = analog ? 64 : 22; radky.push({ a, y, h, analog }); y += h + 2; }
    return { radky, vyska: Math.max(60, y + 20) };
  }
  function kresliPrubeh() {
    const r = prubeh.getBoundingClientRect(); if (!r.width) return;
    const { radky, vyska } = rozlozeniAnalyzatoru(), LEVA = 104;
    if (Math.abs(parseFloat(prubeh.style.height || 0) - vyska) > 0.5) prubeh.style.height = vyska + 'px';
    const dpr = window.devicePixelRatio || 1, W = Math.round(r.width * dpr), H = Math.round(vyska * dpr);
    if (prubeh.width !== W || prubeh.height !== H) { prubeh.width = W; prubeh.height = H; }
    const ctx = prubeh.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, r.width, vyska);
    const hist = sim.historie, okno = +$('#prubehOkno').value;
    const t1 = zmrazeno && hist.length ? hist[hist.length - 1].t : Math.max(okno, sim.plc.cas), t0 = t1 - okno, sir = r.width - LEVA - 8;
    const x = t => LEVA + (t - t0) / okno * sir;
    ctx.font = '11px ui-monospace, monospace'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = barvy.obrys; ctx.lineWidth = 1; ctx.fillStyle = barvy.slaby;
    const krok = okno <= 10000 ? 1000 : okno <= 30000 ? 5000 : 10000;
    for (let t = Math.ceil(t0 / krok) * krok; t <= t1; t += krok) {
      if (t < 0) continue;
      ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.moveTo(x(t), 4); ctx.lineTo(x(t), vyska - 18); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.textAlign = 'center'; ctx.fillText(cislo(t / 1000, 0) + ' s', x(t), vyska - 9);
    }
    const vidim = hist.filter(z => z.t >= t0 - 2000 && z.t <= t1);
    radky.forEach((rd, i) => {
      ctx.textAlign = 'left'; ctx.fillStyle = barvy.text; ctx.fillText(rd.a, 6, rd.y + 9);
      ctx.fillStyle = barvy.slaby; ctx.fillText(zkrat(nazevAdresy(rd.a), 8), 46, rd.y + 9);
      const barva = rd.a[0] === 'I' ? barvy.akcent : rd.analog ? '#ef6c00' : barvy.ok;
      if (!vidim.length) return;
      if (rd.analog) {
        let mn = Infinity, mx = -Infinity; for (const z of vidim) { mn = Math.min(mn, z.b[i]); mx = Math.max(mx, z.b[i]); }
        if (mx - mn < 1e-9) { mx += 1; mn -= 1; }
        const yv = v => rd.y + rd.h - 3 - (v - mn) / (mx - mn) * (rd.h - 8);
        ctx.fillStyle = barvy.slaby; ctx.font = '9px ui-monospace, monospace';
        ctx.fillText(cislo(mx, 2), 6, rd.y + 22); ctx.fillText(cislo(mn, 2), 6, rd.y + rd.h - 6); ctx.font = '11px ui-monospace, monospace';
        ctx.strokeStyle = barva; ctx.lineWidth = 1.6; ctx.beginPath();
        vidim.forEach((z, j) => { const xx = Math.max(LEVA, x(z.t)); if (!j) ctx.moveTo(xx, yv(z.b[i])); else { ctx.lineTo(xx, yv(vidim[j - 1].b[i])); ctx.lineTo(xx, yv(z.b[i])); } });
        ctx.lineTo(x(t1), yv(vidim[vidim.length - 1].b[i])); ctx.stroke();
      } else {
        const yH = rd.y + 3, yL = rd.y + rd.h - 3;
        ctx.fillStyle = barva; ctx.globalAlpha = 0.22;
        vidim.forEach((z, j) => { if (!z.b[i]) return; const xa = Math.max(LEVA, x(z.t)), xb = j + 1 < vidim.length ? x(vidim[j + 1].t) : x(t1); if (xb > xa) ctx.fillRect(xa, yH, xb - xa, yL - yH); });
        ctx.globalAlpha = 1; ctx.strokeStyle = barva; ctx.lineWidth = 1.8; ctx.beginPath();
        vidim.forEach((z, j) => { const xx = Math.max(LEVA, x(z.t)), yy = z.b[i] ? yH : yL; if (!j) ctx.moveTo(xx, yy); else { ctx.lineTo(xx, vidim[j - 1].b[i] ? yH : yL); ctx.lineTo(xx, yy); } });
        ctx.lineTo(x(t1), vidim[vidim.length - 1].b[i] ? yH : yL); ctx.stroke();
      }
    });
    if (!vidim.length) { ctx.fillStyle = barvy.slaby; ctx.textAlign = 'center'; ctx.fillText('Spusťte RUN – průběh se zaznamenává v každém cyklu.', LEVA + sir / 2, vyska / 2); }
    const info = $('#kurzorInfo');
    if (kurzorX !== null && kurzorX > LEVA && vidim.length) {
      const t = t0 + (kurzorX - LEVA) / sir * okno;
      let z = null; for (const q of vidim) { if (q.t <= t) z = q; else break; }
      ctx.strokeStyle = barvy.text; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(kurzorX, 2); ctx.lineTo(kurzorX, vyska - 18); ctx.stroke(); ctx.setLineDash([]);
      if (z) { info.hidden = false; info.textContent = `t = ${cislo(z.t / 1000, 2)} s\n` + radky.map((rd, i) => `${rd.a.padEnd(5)} ${rd.analog ? fmtCislo(z.b[i], rd.a.startsWith('MD')) : z.b[i]}`).join('\n'); }
    } else info.hidden = true;
  }

  /* ---------- křížové odkazy a hledání ---------- */
  function vykresliXref() {
    const q = hledani.trim().toLowerCase();
    const x = PLC.krizoveOdkazy(projekt).filter(r => !q || r.adr.toLowerCase().includes(q) || symbol(r.adr).toLowerCase().includes(q) || ((projekt.komentare || {})[r.adr] || '').toLowerCase().includes(q) || r.popis.toLowerCase().includes(q));
    $('#hledatPocet').textContent = q ? `${x.length} výskytů` : `${x.length} odkazů`;
    $('#tabXref').innerHTML = '<tr><th>Adresa</th><th>Symbol</th><th>POU</th><th>Příčka</th><th>Instrukce</th><th>Přístup</th></tr>' + x.slice(0, 600).map(r =>
      `<tr class="klik" data-xp="${r.prvek}" data-xpou="${esc(r.pou)}" tabindex="0"><td><code>${esc(r.adr)}</code></td><td>${esc(symbol(r.adr))}</td><td>${esc(r.pou)}</td><td>${r.pricka + 1}</td><td>${esc(r.popis)}</td><td>${r.pristup}</td></tr>`).join('');
  }

  /* ---------- symboly ---------- */
  function vykresliSymboly() {
    const adr = new Set(Object.keys(projekt.symboly).concat(Object.keys(projekt.komentare || {})));
    PLC.pouziteAdresy(projekt).forEach(a => adr.add(a));
    const s = [...adr].filter(a => PLC.rozeberAdresu(a)).sort((a, b) => PLC.poradiAdresy(a) - PLC.poradiAdresy(b));
    $('#tabSymboly').innerHTML = '<tr><th>Adresa</th><th>Typ</th><th>Symbol</th><th>Komentář</th><th>Signál procesu</th></tr>' + s.map(a => {
      const r = PLC.rozeberAdresu(a);
      return `<tr><td><code>${a}</code></td><td>${r.typ}</td><td><input type="text" data-sym="${a}" value="${esc(symbol(a))}" maxlength="40" aria-label="Symbol ${a}"></td>
        <td><input type="text" data-kom="${a}" value="${esc((projekt.komentare || {})[a] || '')}" maxlength="200" style="min-width:200px" aria-label="Komentář ${a}"></td><td class="nic">${esc((signalNaAdrese(a) || {}).nazev || PLC.SYSTEMOVE[a] || '')}</td></tr>`;
    }).join('');
  }

  /* ---------- CPU ---------- */
  function vykresliSystem() {
    $('#tabSystem').innerHTML = '<tr><th>Adresa</th><th>Význam</th><th>Hodnota</th></tr>' + Object.entries(PLC.SYSTEMOVE).map(([a, t]) => `<tr><td><code>${a}</code></td><td>${esc(t)}</td><td data-sys="${a}"></td></tr>`).join('');
  }
  function aktualizujCpu() {
    const p = sim.plc, d = p.doba, j = sim.dobaJs;
    const dl = [
      ['Režim', $('#stavPLC').textContent], ['Cyklů od startu', String(p.cyklus)], ['Perioda', projekt.perioda + ' ms'],
      ['Model doby cyklu (poslední)', d.n ? cislo(d.posl, 1) + ' µs' : '–'], ['min / průměr / max', d.n ? `${cislo(d.min, 1)} / ${cislo(d.soucet / d.n, 1)} / ${cislo(d.max, 1)} µs` : '–'],
      ['Instrukcí v cyklu', p.instrukci !== undefined ? String(p.instrukci) : '–'], ['Watchdog', projekt.watchdog + ' ms'],
      ['Skutečný výpočet v prohlížeči', j.n ? `${cislo(j.posl, 3)} ms (max ${cislo(j.max, 3)})` : '–'], ['Vynucených proměnných', String(Object.keys(sim.force).length)],
      ['Chyb výpočtu celkem', String(p.pocetChyb || 0)]
    ];
    const html = dl.map(([k, v]) => `<div class="dlazdice"><small>${k}</small><b>${esc(v)}</b></div>`).join('');
    if ($('#cpuDlazdice').innerHTML !== html) $('#cpuDlazdice').innerHTML = html;
    const ch = Object.values(p.chybyBehu || {});
    const t = ch.length ? '<tr><th>POU</th><th>Zpráva</th><th>Počet</th><th>Naposledy v cyklu</th></tr>' + ch.map(c => `<tr class="klik" data-chp="${c.prvek || ''}" data-chpou="${esc(c.pou)}"><td>${esc(c.pou)}</td><td>${esc(c.zprava)}</td><td>${c.pocet}</td><td>${c.cyklus}</td></tr>`).join('')
      : '<tr><td class="nic">Žádné chyby běhu.' + (sim.chybaCPU ? ' Poslední zastavení CPU: ' + esc(sim.chybaCPU) : '') + '</td></tr>';
    if ($('#tabChybyBehu').innerHTML !== t) $('#tabChybyBehu').innerHTML = t;
    const od = $('#odznakCpu'); od.hidden = !ch.length && !sim.chybaCPU; od.textContent = ch.length || '!'; od.className = 'odznak chyby';
    for (const e of $$('[data-sys]')) { const h = sim.rezim === 'STOP' ? '–' : String(PLC.hodnota(p, e.dataset.sys, null)); if (e.textContent !== h) e.textContent = h; }
  }

  /* ---------- nastavení projektu ---------- */
  function vykresliNastaveni() {
    const r = projekt.remanence || {};
    $('#nastaveni').innerHTML = `
      <label>Název projektu<input type="text" data-n="nazev" value="${esc(projekt.nazev)}" maxlength="120"></label>
      <label>Perioda cyklu [ms]<input type="number" data-n="perioda" value="${projekt.perioda}" min="5" max="5000" step="5"></label>
      <label>Hlídací čas – watchdog [ms]<input type="number" data-n="watchdog" value="${projekt.watchdog}" min="10" max="10000" step="10"></label>
      <label style="grid-column: 1 / -1">Popis projektu<textarea data-n="popis" rows="3" maxlength="4000">${esc(projekt.popis || '')}</textarea></label>
      <label>Remanentní M od bajtu (8 = žádné)<input type="number" data-n="rM" value="${r.M}" min="0" max="8"></label>
      <label>Remanentní MW od čísla (64 = žádné)<input type="number" data-n="rMW" value="${r.MW}" min="0" max="64"></label>
      <label>Remanentní MD od čísla (32 = žádné)<input type="number" data-n="rMD" value="${r.MD}" min="0" max="32"></label>
      <label class="zaskrt"><input type="checkbox" data-n="rC" ${r.C ? 'checked' : ''}> Čítače C remanentní</label>
      <label class="zaskrt"><input type="checkbox" data-n="rRTO" ${r.RTO ? 'checked' : ''}> Časovače RTO remanentní</label>
      <label class="zaskrt"><input type="checkbox" data-n="rFB" ${r.FB ? 'checked' : ''}> Instance funkčních bloků remanentní</label>
      <p class="nic" style="grid-column: 1 / -1">Remanentní data přežijí STOP → RUN a simulovaný výpadek napájení (teplý start). Studený start (záložka CPU) vynuluje vše.
        Watchdog zastaví CPU, pokud model doby cyklu překročí limit nebo se v jednom cyklu provede přes 200 000 instrukcí (např. rekurze FB).</p>`;
  }
  function nastavNastaveniUdalosti() {
    $('#nastaveni').addEventListener('change', e => {
      const k = e.target.dataset.n; if (!k) return;
      const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      const cislo_ = (min, max) => { const x = Math.round(+v); if (!(x >= min && x <= max)) { Dialog.chyba(`Hodnota musí být ${min}–${max}.`); vykresliNastaveni(); return null; } return x; };
      zmena(() => {
        projekt.remanence = projekt.remanence || {};
        if (k === 'nazev') projekt.nazev = String(v).trim().slice(0, 120) || 'Bez názvu';
        if (k === 'popis') projekt.popis = String(v).slice(0, 4000);
        if (k === 'perioda') { const x = cislo_(5, 5000); if (x !== null) projekt.perioda = x; }
        if (k === 'watchdog') { const x = cislo_(10, 10000); if (x !== null) projekt.watchdog = x; }
        if (k === 'rM') { const x = cislo_(0, 8); if (x !== null) projekt.remanence.M = x; }
        if (k === 'rMW') { const x = cislo_(0, 64); if (x !== null) projekt.remanence.MW = x; }
        if (k === 'rMD') { const x = cislo_(0, 32); if (x !== null) projekt.remanence.MD = x; }
        if (k === 'rC') projekt.remanence.C = v; if (k === 'rRTO') projekt.remanence.RTO = v; if (k === 'rFB') projekt.remanence.FB = v;
      });
    });
  }

  /* ---------- vysvětlení časovačů ---------- */
  const IN_VZOR = [[300, 2100], [2700, 3300], [3900, 7000]];
  function vykresliCasovace() {
    $('#textCasovace').innerHTML = `
      <p>Časovač v PLC neměří čas spojitě. Jeho instrukce se provede jednou za cyklus a porovná <b>čas tohoto cyklu</b> s okamžikem,
      kdy zachytila změnu vstupu IN. Vstup navíc „vidí“ jen v okamžicích čtení vstupů na začátku cyklu.</p>
      <ul>
        <li><b>TON</b> (zpožděné zapnutí): když IN trvá, roste ET; Q = 1, jakmile ET ≥ PT. Pokles IN vynuluje ET i Q – krátký impulz se „ztratí“.</li>
        <li><b>TOF</b> (zpožděné vypnutí): Q = 1 hned s IN. Po poklesu IN roste ET a Q drží ještě PT; nový impulz během doběhu ET vynuluje.</li>
        <li><b>TP</b> (impulz): náběžná hrana IN spustí impulz délky PT, který nelze přerušit ani prodloužit.</li>
        <li><b>RTO</b> (remanentní TON): ET se při poklesu IN nenuluje, sčítá se přes přerušení; nuluje ho jen RES.</li>
        <li><b>CTU / CTD / CTUD</b> počítají náběžné hrany (0 → 1 mezi dvěma cykly). Impulz kratší než perioda může propadnout – zkuste u dopravníku periodu 1 500 ms.</li>
      </ul>
      <p>Skutečné zpoždění je zaokrouhleno nahoru na násobek periody T:</p>
      <div class="vzorec">zpoždění = ⌈PT / T⌉ · T &nbsp;&nbsp; (od cyklu, který zachytil hranu IN)</div>
      <p>Vůči skutečné změně signálu se přičte ještě 0 až T čekání na nejbližší čtení vstupů. Čárkovaně je tentýž časovač vyhodnocovaný každou milisekundu (prakticky spojitě).</p>`;
    kresliDiagramCasovace();
  }
  function kresliDiagramCasovace() {
    const typ = $('#dgTyp').value;
    let PT = Math.round(+$('#dgPT').value), T = Math.round(+$('#dgT').value);
    if (!(PT >= 0 && PT <= 10000)) PT = 1000;
    if (!(T >= 5 && T <= 5000)) T = 300;
    const KONEC = 9000, L = 70, W = 740, sx = t => L + t / KONEC * W;
    const inIdeal = t => IN_VZOR.some(([a, b]) => t >= a && t < b);
    const fn = { TON: PLC.ton, TOF: PLC.tof, TP: PLC.tp, RTO: PLC.rto }[typ];
    const simuluj = krok => { const tm = PLC.novyCasovac(typ), r = []; for (let k = 0; k * krok <= KONEC; k++) { const t = k * krok, IN = inIdeal(t); fn(tm, IN, t, PT); r.push({ t, IN, Q: tm.Q, ET: tm.ET }); } return r; };
    const vzorky = simuluj(T), ideal = simuluj(1).filter((z, i) => i % 5 === 0).map(z => [z.t, z.Q]);
    const o = [];
    const stopy = (body, y, h, trida) => { let d = '', pred = null; body.forEach(([t, v], i) => { const yy = v ? y : y + h; if (!i) d += `M${sx(t)} ${yy}`; else d += `L${sx(t)} ${pred}L${sx(t)} ${yy}`; pred = yy; }); d += `L${sx(KONEC)} ${pred}`; o.push(`<path class="${trida}" d="${d}"/>`); };
    const R = { IN: 20, CT: 70, ET: 112, Q: 182 };
    o.push(`<text class="dg-txt b" x="4" y="${R.IN + 12}">IN</text><text class="dg-txt b" x="4" y="${R.CT + 10}">čte PLC</text><text class="dg-txt b" x="4" y="${R.ET + 22}">ET</text><text class="dg-txt b" x="4" y="${R.Q + 12}">Q</text>`);
    for (let t = 0; t <= KONEC; t += 1000) o.push(`<line class="dg-osa" x1="${sx(t)}" y1="12" x2="${sx(t)}" y2="230"/><text class="dg-txt" x="${sx(t)}" y="244" text-anchor="middle">${t / 1000} s</text>`);
    if (KONEC / T <= 400) for (const z of vzorky) o.push(`<line class="dg-scan" x1="${sx(z.t)}" y1="${R.CT + 22}" x2="${sx(z.t)}" y2="${R.CT + 28}"/>`);
    const inBody = [[0, false]]; IN_VZOR.forEach(([a, b]) => { inBody.push([a, true], [b, false]); });
    stopy(inBody, R.IN, 22, 'dg-sig');
    stopy(vzorky.map(z => [z.t, z.IN]), R.CT, 20, 'dg-sig');
    const etMax = Math.max(PT, 1), etH = 50;
    let d = `M${sx(0)} ${R.ET + etH}`;
    vzorky.forEach((z, i) => { const y = R.ET + etH - z.ET / etMax * etH; d += `L${sx(z.t)} ${i ? (R.ET + etH - vzorky[i - 1].ET / etMax * etH) : R.ET + etH}L${sx(z.t)} ${y}`; });
    d += `L${sx(KONEC)} ${R.ET + etH - vzorky[vzorky.length - 1].ET / etMax * etH}L${sx(KONEC)} ${R.ET + etH}Z`;
    o.push(`<path class="dg-et" d="${d}"/><line class="dg-pt" x1="${L}" y1="${R.ET}" x2="${L + W}" y2="${R.ET}"/><text class="dg-txt" x="${L + W - 2}" y="${R.ET - 4}" text-anchor="end">PT = ${cislo(PT / 1000)} s</text>`);
    stopy(ideal, R.Q, 22, 'dg-ideal');
    stopy(vzorky.map(z => [z.t, z.Q]), R.Q, 22, 'dg-q');
    $('#dgSvg').innerHTML = o.join('');
    const zp = PT === 0 ? 0 : Math.ceil(PT / T) * T;
    $('#dgShrnuti').innerHTML = `Při PT = ${cislo(PT)} ms a periodě ${cislo(T)} ms je zpoždění od cyklu, který zachytil hranu, <b>${cislo(zp)} ms</b> (${PT === 0 ? 0 : Math.ceil(PT / T)} cyklů)` +
      (zp !== PT ? `, tedy o ${cislo(zp - PT)} ms delší než PT.` : ', přesně PT.');
  }

  /* ---------- nápověda ---------- */
  function vykresliNapovedaText() {
    const tr = (t, n, p) => `<tr><td><b>${esc(t)}</b></td><td>${esc(n)}</td><td>${p}</td></tr>`;
    $('#textNapoveda').innerHTML = `
      <h3>Cyklus PLC (scan)</h3>
      <svg class="cyklus-svg" viewBox="0 0 640 110" width="100%" style="max-width:640px" role="img" aria-label="Schéma cyklu: čtení vstupů, vyhodnocení programu, zápis výstupů">
        <defs><marker id="sip" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>
        <rect x="10" y="20" width="170" height="50" rx="8"/><text x="95" y="38">1. čtení vstupů</text><text x="95" y="56" style="font-size:10.5px">I, IW ← proces (+ vynucení)</text>
        <rect x="235" y="20" width="170" height="50" rx="8"/><text x="320" y="38">2. program MAIN</text><text x="320" y="56" style="font-size:10.5px">příčky shora dolů, CALL → FB</text>
        <rect x="460" y="20" width="170" height="50" rx="8"/><text x="545" y="38">3. zápis výstupů</text><text x="545" y="56" style="font-size:10.5px">Q, QW → proces (+ vynucení)</text>
        <path d="M180 45H232" marker-end="url(#sip)" style="color:var(--text-muted)"/><path d="M405 45H457" marker-end="url(#sip)" style="color:var(--text-muted)"/>
        <path d="M545 70V95H95V73" marker-end="url(#sip)" style="color:var(--text-muted)"/><text x="320" y="103" style="font-size:10.5px;fill:var(--text-muted)">opakuje se s periodou T</text>
      </svg>
      <ol>
        <li><b>Čtení vstupů:</b> digitální (I) i analogové (IW) vstupy se zkopírují do obrazu; vynucené hodnoty je přepíší. Změna během cyklu se projeví až příště.</li>
        <li><b>Program:</b> příčky MAIN shora dolů, podmínka zleva doprava (série = AND, paralelní větve shora dolů = OR), pak výstupní instrukce shora dolů.
          Zápis do Q, M, MW… je hned vidět v příčkách níže. <b>CALL</b> zkopíruje vstupní parametry do instance, provede tělo FB a výstupy zapíše zpět.</li>
        <li><b>Zápis výstupů:</b> obraz Q a QW jde do procesu; vynucené výstupy mají přednost. Pak se spočte model doby cyklu a čas se posune o periodu.</li>
      </ol>
      <p>Simulace drží jediný simulovaný čas: cyklus proběhne v čase k·T, proces mezi cykly běží s výstupy posledního cyklu (krok fyziky ≤ 10 ms).
        <b>Pauza</b> zmrazí PLC i proces (skutečný stroj to neumí). <b>Cyklus</b> provede jeden celý cyklus, <b>Příčka</b> jen jednu příčku MAIN (výstupy se zapíší po poslední).
        Zarážka (kroužek u čísla příčky) zastaví běh před provedením příčky. <b>STOP</b> vypne výstupy, další RUN je teplý start (remanentní data zůstanou).</p>
      <h3>Paměť a datové typy</h3>
      <div class="tabulka-obal" style="overflow-x:auto"><table class="tab-ref">
        ${tr('I0.0–I1.7', 'BOOL', 'digitální vstupy (obraz procesu)')}${tr('Q0.0–Q1.7', 'BOOL', 'digitální výstupy')}${tr('M0.0–M7.7', 'BOOL', 'paměťové bity (remanentní od nastaveného bajtu)')}
        ${tr('IW0–IW7', 'INT', 'analogové vstupy: 0–32000 = 4–20 mA, pod 0 = pod rozsahem (−8000 = přerušená smyčka)')}${tr('QW0–QW7', 'INT', 'analogové výstupy 0–32000')}
        ${tr('MW0–MW63', 'INT', '16bitová celá čísla −32768 až 32767, přetečení se omezí a nahlásí')}${tr('MD0–MD31', 'REAL', 'reálná čísla (v simulaci s dvojitou přesností)')}
        ${tr('S0.0–S0.7, SW0–SW3', 'BOOL / INT', 'systémové bity a slova (vždy 1, první cyklus, takty 0,1/1/2 s, chyby, přetížení, doba cyklu…)')}
        ${tr('T0–T31, C0–C31', 'časovač / čítač', 'kontakt čte Q, číselný operand čte ET [ms] nebo CV')}${tr('#jméno', 'dle rozhraní', 'proměnné funkčního bloku a lokální časovače/čítače instance')}
        ${tr('12, -3, 2.5, T#1s500ms', 'konstanta', 'INT, REAL, čas v ms; TRUE/FALSE')}
      </table></div>
      <h3>Instrukce</h3>
      <p>Kontakty NO/NC/P/N a porovnání CMP (==, &lt;&gt;, &lt;, &lt;=, &gt;, &gt;=) tvoří podmínku příčky. Na pravém konci jsou cívky (( ), (/), S, R), klopné obvody SR/RS,
        R_TRIG/F_TRIG, časovače TON/TOF/TP/RTO, čítače CTU/CTD/CTUD, RES, přesuny a aritmetika MOVE/ADD/SUB/MUL/DIV/MOD (celočíselně, pokud žádný operand není REAL),
        SCALE (lineární přepočet s omezením), LIMIT, regulátor PID a volání funkčního bloku CALL. Číselné instrukce se provedou jen při napájené příčce.</p>
      <p><b>PID</b> (polohový tvar): u = Kp·e + Kp/Ti·∫e dt − Kp·Td·d(PV)/dt; derivace z měřené veličiny s filtrem N = 10, výstup omezen na OUT min–max,
        anti-windup podmíněnou integrací, v ručním režimu (MAN = 1) výstup = ruční hodnota a integrál ji sleduje (bezrázové přepnutí). Ti = 0 vypne integraci.
        Perioda vzorkování = perioda cyklu, nebo Ts.</p>
      <h3>Funkční bloky</h3>
      <p>Tlačítkem „+ Funkční blok“ vytvoříte POU s rozhraním (IN, OUT, STAT; BOOL/INT/REAL). V těle se proměnné píší <code>#jméno</code>, časovače a čítače
        s adresou <code>#jméno</code> jsou lokální pro každou instanci. V MAIN (nebo v jiném FB) blok voláte instrukcí CALL s názvem instance a připojením parametrů.
        Rekurze se hlásí jako chyba, za běhu ji zastaví watchdog. U FB lze vybrat instanci, jejíž hodnoty se zobrazují živě.</p>
      <h3>Ladění</h3>
      <ul>
        <li><b>Sledování:</b> tabulka adres s hodnotou (DEC/HEX/BIN), jednorázovým zápisem a vynucením. Vynucení vstupu přepíše hodnotu z procesu, vynucení výstupu přepíše
          fyzický výstup, obraz v programu zůstává. Aktivní vynucení hlásí kontrolka FORCE a bit S0.7.</li>
        <li><b>Logický analyzátor:</b> průběhy bitů a slov po cyklech, kurzor myší, zmrazení.</li>
        <li><b>Křížové odkazy:</b> kde se adresa čte a kde zapisuje; hledání zvýrazní prvky v programu.</li>
        <li><b>CPU:</b> model doby cyklu (min/průměr/max), watchdog, chyby výpočtu (přetečení, dělení nulou), studený start, simulace výpadku napájení.</li>
      </ul>
      <h3>Technologie, mapování a poruchy</h3>
      <p>Každý proces má pojmenované signály s výchozí adresou. V „Signály procesu“ lze adresu přemapovat a do kteréhokoli signálu vložit poruchu:
        zaseknutí na 0 nebo 1, přerušený vodič (digitálně 0, analogově −8000). Program by měl poruchy rozpoznat a reagovat bezpečně –
        např. světelná závora vrat je zapojená rozpínacím kontaktem, takže přerušený vodič znamená „překážka“.</p>
      <h3>Omezení</h3>
      <ul>
        <li>Jen Ladder: bez ST, FBD a SFC (sekvence se dělají bity kroků v Ladderu), bez skoků, smyček, polí, struktur a řetězců.</li>
        <li>Bloky leží vždy na pravém konci příčky (bez řetězení přes ENO). Doba cyklu je modelová (cena instrukcí), ne změřená na hardwaru.</li>
        <li>Modely procesů jsou zjednodušené a zmenšené, slouží k ověření logiky a výuce, ne k dimenzování skutečných zařízení.</li>
      </ul>`;
  }

  /* ---------- záložky ---------- */
  function prepniZalozku(z) {
    $$('.zalozky-lista [data-z]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.z === z)));
    $$('.zalozka').forEach(p => { p.hidden = p.dataset.z !== z; });
    ulozLS('zalozka', z);
    if (z === 'casovace') kresliDiagramCasovace();
    if (z === 'projekty') vykresliProjekty();
    if (z === 'cpu') aktualizujCpu();
  }

  /* ---------- ukládání, import, export ---------- */
  function seznamProjektu() { try { const s = JSON.parse(ctiLS('projekty') || '[]'); return Array.isArray(s) ? s : []; } catch (e) { return []; } }
  function vykresliProjekty() {
    const s = seznamProjektu();
    $('#projektySeznam').innerHTML = s.length ? s.map((p, i) => `<div class="pr"><b>${esc(p.nazev)}</b><small>${esc(new Date(p.cas).toLocaleString('cs-CZ'))}</small>
      <button class="male" data-otevrit="${i}">Otevřít</button><button class="male" data-stahnout="${i}">Export</button><button class="male nebezpecne" data-smazat="${i}">Smazat</button></div>`).join('')
      : '<p class="nic">Zatím žádné uložené projekty.</p>';
  }
  function uloz(jakoNovy) {
    const s = seznamProjektu();
    const i = jakoNovy ? -1 : s.findIndex(p => p.nazev === projekt.nazev);
    const z = { nazev: projekt.nazev, cas: Date.now(), data: PLC.exportuj(projekt) };
    if (i >= 0) s[i] = z; else s.unshift(z);
    if (ulozLS('projekty', JSON.stringify(s.slice(0, 100)))) Dialog.info(`Projekt „${projekt.nazev}“ uložen v prohlížeči.`);
    else Dialog.chyba('Uložení se nezdařilo (úložiště prohlížeče je plné nebo zakázané). Použijte Export.');
    vykresliProjekty();
  }
  function stahni(nazev, text, pripona, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: typ || 'application/json' }));
    a.download = (nazev || 'projekt').replace(/[^\w\-áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ ]+/g, '_').trim().replace(/\s+/g, '_') + (pripona || '.plc.json');
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function otevriText(text, zdroj) {
    const r = PLC.nactiProjekt(text);
    if (!r.ok) { Dialog.chyba(`${zdroj} nelze načíst: ${r.chyby.join(' ')}`); return false; }
    Procesy.stop(sim);
    nactiDoEditoru(r.projekt);
    let zprava = `Načten projekt „${projekt.nazev}“.`;
    if (r.chyby.length) zprava += ' ' + r.chyby.join(' ');
    if (PLC.maChyby(diag)) { zprava += ' Program obsahuje chyby – viz Diagnostika.'; prepniZalozku('diag'); }
    Dialog.info(zprava);
    return true;
  }

  /* ---------- dokumentace (tisk / PDF) ---------- */
  function sestavTisk() {
    const datum = new Date().toLocaleString('cs-CZ');
    const o = [`<h1>${esc(projekt.nazev)}</h1><p>Dokumentace programu · ${esc(datum)} · perioda cyklu ${projekt.perioda} ms · watchdog ${projekt.watchdog} ms · technologie: ${esc(sim.model.nazev)}</p>`];
    if (projekt.popis) o.push(`<p>${esc(projekt.popis)}</p>`);
    const d = diag.filter(x => x.uroven !== 'info');
    o.push(`<p>Diagnostika: ${d.length ? d.length + ' chyb/varování' : 'bez chyb a varování'}. Simulováno ve výukovém simulátoru – není vázáno na konkrétního výrobce PLC.</p>`);
    for (const { nazev, pou: p, fb } of PLC.vsechnyPou(projekt)) {
      o.push(`<h2>${fb ? 'Funkční blok' : 'Program'} ${esc(nazev)}</h2>`);
      if (fb) {
        if (fb.komentar) o.push(`<p>${esc(fb.komentar)}</p>`);
        o.push('<table><tr><th>Proměnná</th><th>Směr</th><th>Typ</th><th>Komentář</th></tr>' + fb.rozhrani.map(r => `<tr><td>#${esc(r.nazev)}</td><td>${r.smer}</td><td>${r.typ}</td><td>${esc(r.komentar || '')}</td></tr>`).join('') + '</table>');
      }
      p.pricky.forEach((r, i) => { if (r.komentar) { /* komentář je přímo v obrázku příčky */ } void i; });
      o.push(sestavLadder(p, { tisk: true }));
    }
    const adr = new Set(Object.keys(projekt.symboly)); PLC.pouziteAdresy(projekt).forEach(a => adr.add(a));
    o.push('<h2>Tabulka symbolů</h2><table><tr><th>Adresa</th><th>Typ</th><th>Symbol</th><th>Komentář</th></tr>' +
      [...adr].filter(a => PLC.rozeberAdresu(a)).sort((a, b) => PLC.poradiAdresy(a) - PLC.poradiAdresy(b)).map(a => `<tr><td>${a}</td><td>${PLC.rozeberAdresu(a).typ}</td><td>${esc(symbol(a))}</td><td>${esc((projekt.komentare || {})[a] || '')}</td></tr>`).join('') + '</table>');
    const sig = Object.entries(sim.model.signaly);
    if (sig.length) o.push('<h2>Přiřazení I/O k technologii</h2><table><tr><th>Signál</th><th>Směr</th><th>Adresa</th></tr>' + sig.map(([k, s]) => `<tr><td>${esc(s.nazev)}</td><td>${s.smer === 'vstup' ? 'vstup' : 'výstup'}</td><td>${Procesy.mapa(sim)[k]}</td></tr>`).join('') + '</table>');
    o.push('<h2>Křížové odkazy</h2><table><tr><th>Adresa</th><th>POU</th><th>Příčka</th><th>Instrukce</th><th>Přístup</th></tr>' +
      PLC.krizoveOdkazy(projekt).map(r => `<tr><td>${esc(r.adr)}</td><td>${esc(r.pou)}</td><td>${r.pricka + 1}</td><td>${esc(r.popis)}</td><td>${r.pristup}</td></tr>`).join('') + '</table>');
    const r = projekt.remanence || {};
    o.push(`<h2>Nastavení</h2><p>Remanence: M od bajtu ${r.M}, MW od ${r.MW}, MD od ${r.MD}, čítače ${r.C ? 'ano' : 'ne'}, RTO ${r.RTO ? 'ano' : 'ne'}, instance FB ${r.FB ? 'ano' : 'ne'}.</p>`);
    $('#tisk').innerHTML = o.join('');
  }
  function tiskni() { sestavTisk(); setTimeout(() => window.print(), 50); }

  /* ---------- klávesnice ---------- */
  const vPoli = e => { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); };
  const drzene = new Set();
  function nastavKlavesy() {
    document.addEventListener('keydown', e => {
      if (document.querySelector('dialog[open]')) return;
      if ((e.ctrlKey || e.metaKey) && !vPoli(e)) {
        if (e.code === 'KeyZ' && !e.shiftKey) { e.preventDefault(); vratit(zpet, znovu); return; }
        if (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey)) { e.preventDefault(); vratit(znovu, zpet); return; }
      }
      if (e.key === 'F5' && !e.ctrlKey) { e.preventDefault(); spust(); return; }
      if (e.key === 'F10') { e.preventDefault(); krokPricky(); return; }
      if (e.key === 'F9') { e.preventDefault(); const id = vybranaPricka || (vyber.length && PLC.najdi(projekt, vyber[0]) ? PLC.najdi(projekt, vyber[0]).pricka.id : null); if (id) prepniZarazku(id); return; }
      if (vPoli(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      const m = /^Digit([1-8])$/.exec(e.code) || /^Numpad([1-8])$/.exec(e.code);
      if (m) {
        const a = 'I0.' + (+m[1] - 1), d = druhVstupu(a);
        if (d === 'cidlo') return;
        e.preventDefault(); if (e.repeat) return;
        if (d === 'tlacitko') { drzene.add(e.code); nastavVstup(a, true); } else nastavVstup(a, !sim.uziv[a]);
        return;
      }
      if (e.key === 'Escape') { if (presouvani) { presouvani = null; vykresliLadder(); } else if (vyber.length || vybranaPricka) { vyber = []; vybranaPricka = null; vykresliLadder(); vykresliVlastnosti(); } return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && (vyber.length || vybranaPricka)) { e.preventDefault(); akce(vyber.length ? 'smaz' : 'pricka-smaz'); return; }
      if (e.key === 'ArrowLeft' && vyber.length === 1) { e.preventDefault(); akce('vlevo'); return; }
      if (e.key === 'ArrowRight' && vyber.length === 1) { e.preventDefault(); akce('vpravo'); return; }
      if (e.code === 'Space' && !e.target.closest('button')) { e.preventDefault(); krok(); }
    });
    document.addEventListener('keyup', e => { if (!drzene.has(e.code)) return; drzene.delete(e.code); const m = /([1-8])$/.exec(e.code); nastavVstup('I0.' + (+m[1] - 1), false); });
    window.addEventListener('blur', () => { for (const c of drzene) { const m = /([1-8])$/.exec(c); nastavVstup('I0.' + (+m[1] - 1), false); } drzene.clear(); });
  }

  /* ---------- hlavní smyčka ---------- */
  let posledniCas = 0, posledniPanely = 0, posledniRezim = '';
  function smycka(t) {
    requestAnimationFrame(smycka);
    if (document.hidden) { posledniCas = t; return; }
    const dt = posledniCas ? Math.min(250, t - posledniCas) : 16;
    posledniCas = t;
    const predRezim = sim.rezim, predZast = sim.zastavenoNa;
    Procesy.posun(sim, dt * rychlost);
    if (sim.rezim !== predRezim || sim.zastavenoNa !== predZast) { aktualizujRezim(); vykresliLadder(); }
    kresliProces(t / 1000);
    aktualizujZive(false);
    aktualizujIO();
    if (t - posledniPanely > 100) {
      posledniPanely = t;
      aktualizujSouhrn(); aktualizujVlastnostiZive(); aktualizujSignaly();
      if (!$('.zalozka[data-z="watch"]').hidden) aktualizujWatch();
      if (!$('.zalozka[data-z="prubeh"]').hidden && !zmrazeno) kresliPrubeh();
      if (!$('.zalozka[data-z="cpu"]').hidden) aktualizujCpu();
      $('#infoCas').textContent = `cyklus ${sim.plc.cyklus} · t = ${cislo(sim.cas / 1000, 1)} s`;
      const r = $('#stavPLC').dataset.r; if (r !== posledniRezim) posledniRezim = r;
      aktualizujRezim();
    }
  }

  /* ---------- inicializace ---------- */
  function init() {
    nactiBarvy();
    $('#priklad').innerHTML = '<option value="">Vzorové projekty…</option>' + PRIKLADY.map(p => `<option value="${p.id}">${esc(p.nazev)}</option>`).join('');
    $('#proces').innerHTML = Object.values(Procesy.PROCESY).map(p => `<option value="${p.id}">${esc(p.nazev)}</option>`).join('');
    const m = +ctiLS('meritko');
    meritko = [0.6, 0.75, 0.9, 1, 1.2].includes(m) ? m : (window.innerWidth < 620 ? 0.75 : 1);
    $('#meritko').value = String(meritko);
    vykresliPaletu(); vykresliCasovace(); vykresliNapovedaText();
    let p = null;
    const ulozeny = ctiLS('aktualni');
    if (ulozeny) { const r = PLC.nactiProjekt(ulozeny); if (r.ok) p = r.projekt; }
    if (!p) p = PRIKLADY.find(x => x.id === 'dopravnik').vytvor();
    nactiDoEditoru(p);
    const z = ctiLS('zalozka'); prepniZalozku(z && $(`.zalozka[data-z="${z}"]`) ? z : 'diag');

    $('#paleta').addEventListener('click', e => { const b = e.target.closest('[data-nastroj]'); if (!b) return; nastroj = b.dataset.nastroj; vykresliPaletu(); vykresliNapovedu(); });
    $('#vlastnosti').addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) akce(b.dataset.a); });
    nastavLadderUdalosti(); nastavIOUdalosti(); nastavProcesUdalosti(); nastavKlavesy(); nastavFbUdalosti(); nastavWatchUdalosti(); nastavNastaveniUdalosti();
    $('#btnPricka').addEventListener('click', () => { let p; zmena(() => { p = PLC.novaPricka(projekt, undefined, pou()); }); vybranaPricka = p.id; vyber = []; vykresliLadder(); vykresliVlastnosti(); $('#ladderObal').scrollTop = 1e6; });
    ['#chkPoradi', '#chkSymboly', '#chkVloz', '#chkHodnoty'].forEach(s => $(s).addEventListener('change', vykresliLadder));
    $('#meritko').addEventListener('change', e => { meritko = +e.target.value; ulozLS('meritko', String(meritko)); vykresliLadder(); });
    $('#chkVsechnyIO').addEventListener('change', e => { zobrazitVse = e.target.checked; vykresliIO(); });
    $('#btnRun').addEventListener('click', spust);
    $('#btnPauza').addEventListener('click', () => { Procesy.pauza(sim); aktualizujRezim(); });
    $('#btnKrok').addEventListener('click', krok);
    $('#btnKrokPricky').addEventListener('click', krokPricky);
    $('#btnStop').addEventListener('click', () => { Procesy.stop(sim); aktualizujRezim(); vykresliLadder(); aktualizujIO(); });
    $('#btnStudeny').addEventListener('click', async () => { if (await Dialog.potvrd('Studený start vynuluje všechny proměnné včetně remanentních. Pokračovat?')) { if (!kontrolaPredBehem()) return; Procesy.studenyStart(sim); aktualizujRezim(); Dialog.info('Studený start proveden.'); } });
    $('#btnVypadek').addEventListener('click', () => { if (!kontrolaPredBehem()) return; Procesy.vypadekNapajeni(sim); aktualizujRezim(); Dialog.info('Výpadek napájení: PLC znovu naběhlo teplým startem – remanentní data zůstala.'); });
    $('#btnChybyVymaz').addEventListener('click', () => { sim.plc.chybyBehu = {}; sim.plc.pocetChyb = 0; sim.chybaCPU = null; aktualizujCpu(); });
    $('#btnChybaZavrit').addEventListener('click', () => { $('#chybaCpu').hidden = true; prepniZalozku('cpu'); });
    $('#perioda').addEventListener('change', e => {
      const v = Math.round(+e.target.value);
      if (!(v >= PLC.PERIODA_MIN && v <= PLC.PERIODA_MAX)) { Dialog.chyba(`Perioda musí být ${PLC.PERIODA_MIN}–${PLC.PERIODA_MAX} ms.`); e.target.value = projekt.perioda; return; }
      zmena(() => { projekt.perioda = v; });
    });
    $('#rychlost').addEventListener('change', e => { rychlost = +e.target.value; });
    $('#proces').addEventListener('change', e => { zmena(() => { projekt.proces = e.target.value; }); });
    $('#nazevProjektu').addEventListener('change', e => zmena(() => { projekt.nazev = e.target.value.trim().slice(0, 120) || 'Bez názvu'; }));
    $('#priklad').addEventListener('change', async e => {
      const pr = PRIKLADY.find(x => x.id === e.target.value); e.target.value = '';
      if (!pr) return;
      if (!(await Dialog.potvrd(`Otevřít vzorový projekt „${pr.nazev}“? Rozpracovaný projekt bude nahrazen (uložené projekty zůstanou, Zpět ho vrátí).`))) return;
      Procesy.stop(sim); const st = snimek(); nactiDoEditoru(pr.vytvor()); zpet.push(st); $('#btnZpet').disabled = false;
    });
    $('#btnUlozit').addEventListener('click', () => uloz(false));
    $('#btnUlozitJako').addEventListener('click', async () => { const n = await Dialog.zeptej('Název projektu', projekt.nazev); if (n === null) return; projekt.nazev = n.trim().slice(0, 120) || 'Bez názvu'; $('#nazevProjektu').value = projekt.nazev; uloz(true); });
    $('#btnNovy').addEventListener('click', async () => { if (!(await Dialog.potvrd('Založit nový prázdný projekt? Rozpracovaný projekt bude nahrazen.'))) return; Procesy.stop(sim); const st = snimek(); nactiDoEditoru(PLC.novyProjekt('Můj projekt')); zpet.push(st); $('#btnZpet').disabled = false; });
    $('#btnExport').addEventListener('click', () => stahni(projekt.nazev, PLC.exportuj(projekt)));
    $('#btnTisk').addEventListener('click', tiskni);
    $('#btnImport').addEventListener('click', () => $('#soubor').click());
    $('#soubor').addEventListener('change', e => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      if (f.size > 2e6) { Dialog.chyba('Soubor je příliš velký (max. 2 MB).'); return; }
      const r = new FileReader();
      r.onload = () => { const st = snimek(); if (otevriText(String(r.result), `Soubor „${f.name}“`)) { zpet.push(st); $('#btnZpet').disabled = false; } };
      r.onerror = () => Dialog.chyba('Soubor se nepodařilo přečíst.');
      r.readAsText(f);
    });
    $('#projektySeznam').addEventListener('click', async e => {
      const s = seznamProjektu();
      const o = e.target.closest('[data-otevrit]'), d = e.target.closest('[data-stahnout]'), x = e.target.closest('[data-smazat]');
      if (o) { const st = snimek(); if (otevriText(s[+o.dataset.otevrit].data, 'Uložený projekt')) { zpet.push(st); $('#btnZpet').disabled = false; } }
      if (d) { const p = s[+d.dataset.stahnout]; stahni(p.nazev, p.data); }
      if (x) { const p = s[+x.dataset.smazat]; if (await Dialog.potvrd(`Smazat uložený projekt „${p.nazev}“?`)) { s.splice(+x.dataset.smazat, 1); ulozLS('projekty', JSON.stringify(s)); vykresliProjekty(); } }
    });
    $('#btnZpet').addEventListener('click', () => vratit(zpet, znovu));
    $('#btnZnovu').addEventListener('click', () => vratit(znovu, zpet));
    $$('.zalozky-lista [data-z]').forEach(b => b.addEventListener('click', () => prepniZalozku(b.dataset.z)));
    const naDiag = i => { const d = diag[i]; if (d) skocNa(d.prvek, d.pou, d.pricka); };
    $('#diagSeznam').addEventListener('click', e => { const li = e.target.closest('[data-i]'); if (li) naDiag(+li.dataset.i); });
    $('#diagSeznam').addEventListener('keydown', e => { const li = e.target.closest('[data-i]'); if (li && e.key === 'Enter') naDiag(+li.dataset.i); });
    $('#tabXref').addEventListener('click', e => { const tr = e.target.closest('[data-xp]'); if (tr) skocNa(tr.dataset.xp, tr.dataset.xpou, -1); });
    $('#tabXref').addEventListener('keydown', e => { const tr = e.target.closest('[data-xp]'); if (tr && e.key === 'Enter') skocNa(tr.dataset.xp, tr.dataset.xpou, -1); });
    $('#tabChybyBehu').addEventListener('click', e => { const tr = e.target.closest('[data-chp]'); if (tr && tr.dataset.chp) skocNa(tr.dataset.chp, tr.dataset.chpou, -1); });
    $('#hledat').addEventListener('input', e => { hledani = e.target.value; vykresliXref(); vykresliLadder(); });
    $('#chkZvyraznit').addEventListener('change', vykresliLadder);
    $('#tabSymboly').addEventListener('change', e => {
      const s = e.target.closest('[data-sym]'), k = e.target.closest('[data-kom]');
      if (s) zmena(() => { const v = s.value.trim().slice(0, 40); if (v) projekt.symboly[s.dataset.sym] = v; else delete projekt.symboly[s.dataset.sym]; });
      if (k) zmena(() => { projekt.komentare = projekt.komentare || {}; const v = k.value.trim().slice(0, 200); if (v) projekt.komentare[k.dataset.kom] = v; else delete projekt.komentare[k.dataset.kom]; });
    });
    $('#btnPridatSym').addEventListener('click', () => {
      const r = PLC.rozeberAdresu($('#novaAdr').value), n = $('#novySym').value.trim();
      if (!r || r.oblast === '#') { Dialog.chyba('Neplatná adresa.'); return; }
      if (!n) { Dialog.chyba('Zadejte jméno.'); return; }
      zmena(() => { projekt.symboly[r.klic] = n.slice(0, 40); }); $('#novaAdr').value = ''; $('#novySym').value = '';
    });
    ['#dgTyp', '#dgPT', '#dgT'].forEach(s => $(s).addEventListener('input', kresliDiagramCasovace));
    $('#btnZmrazit').addEventListener('click', e => { zmrazeno = !zmrazeno; e.target.setAttribute('aria-pressed', String(zmrazeno)); e.target.textContent = zmrazeno ? 'Pokračovat' : 'Zmrazit'; kresliPrubeh(); });
    $('#prubehOkno').addEventListener('change', kresliPrubeh);
    prubeh.addEventListener('pointermove', e => { const r = prubeh.getBoundingClientRect(); kurzorX = e.clientX - r.left; kresliPrubeh(); });
    prubeh.addEventListener('pointerleave', () => { kurzorX = null; kresliPrubeh(); });
    $('#detailSignaly').addEventListener('toggle', aktualizujSignaly);
    new MutationObserver(() => { nactiBarvy(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    requestAnimationFrame(smycka);
    // pro automatické testy v prohlížeči
    window.__plc = { get projekt() { return projekt; }, get sim() { return sim; }, spust, krok, krokPricky, nastavVstup, prepniZalozku, vyberPrvek, akce, otevriText, pridejWatch,
      priklad: id => { Procesy.stop(sim); nactiDoEditoru(PRIKLADY.find(x => x.id === id).vytvor()); },
      posun: ms => Procesy.posun(sim, ms), otevriPou: n => { const f = PLC.najdiFb(projekt, n); aktivniPou = f ? f.id : null; poZmene(); },
      nahledTisku: () => { sestavTisk(); $('#tisk').classList.add('nahled'); $('#tisk').scrollIntoView(); }, vykresli: () => { vykresliLadder(); kresliPrubeh(); } };
  }
  init();
})();
