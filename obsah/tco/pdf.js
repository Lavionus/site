/* ============================================================
   tco/pdf.js – export protokolu TCO do PDF (jsPDF, načítá se až při exportu).
   Písmo s českou diakritikou: fonty/LiberationSans-Bold.ttf (SIL OFL);
   když se nenačte, text se vysází bez diakritiky.
   ============================================================ */
(function () {
  'use strict';
  let pismoB64 = null;

  function nactiSkript(src) {
    return new Promise((ok, chyba) => {
      if (window.jspdf) return ok();
      const s = document.createElement('script');
      s.src = src; s.onload = () => ok(); s.onerror = () => chyba(new Error('Knihovnu jsPDF se nepodařilo načíst.'));
      document.head.appendChild(s);
    });
  }
  async function nactiPismo() {
    if (pismoB64) return pismoB64;
    try {
      const r = await fetch('fonty/LiberationSans-Bold.ttf');
      if (!r.ok) return null;
      const b = new Uint8Array(await r.arrayBuffer());
      let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
      pismoB64 = btoa(s);
      return pismoB64;
    } catch (e) { return null; }
  }
  const bezDiakritiky = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');

  const nf = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 3 });

  async function vytvor({ sc, R, tabulka, zvrat, rezim, horizont, fisher, obrazky, nazevSouboru, demo }) {
    await nactiSkript('lib/jspdf.umd.min.js');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    const pismo = await nactiPismo();
    if (pismo) { doc.addFileToVFS('LiberationSans-Bold.ttf', pismo); doc.addFont('LiberationSans-Bold.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); }
    else doc.setFont('helvetica', 'normal');
    const txt = s => (pismo ? String(s) : bezDiakritiky(s)).replace(/−/g, '-').replace(/[  ]/g, ' ');
    const W = 210, M = 12, SIR = W - 2 * M, SPOD = 285;
    let y = M;
    const novaStrana = () => { doc.addPage(); y = M; };
    const misto = h => { if (y + h > SPOD) novaStrana(); };
    const odstavec = (s, vel = 8.5, barva = 40) => {
      doc.setFontSize(vel); doc.setTextColor(barva);
      const r = doc.splitTextToSize(txt(s), SIR);
      const lh = vel * 0.42;
      for (const l of r) { misto(lh); doc.text(l, M, y + lh * 0.8); y += lh; }
      y += 1.5;
    };
    const nadpis = (s, vel = 11) => { misto(10); y += 2; doc.setFontSize(vel); doc.setTextColor(0); doc.text(txt(s), M, y + vel * 0.35); y += vel * 0.5 + 2; };

    doc.setFontSize(16); doc.setTextColor(0);
    doc.text(txt('Celkové náklady vlastnictví (TCO)'), M, y + 6); y += 10;
    doc.setFontSize(12); doc.text(txt(sc.nazev), M, y + 4); y += 7;
    odstavec('Vytvořeno ' + new Date().toLocaleString('cs-CZ') + ' kalkulátorem TCO. Orientační model – daně, odpisy a odpočet DPH se nemodelují.', 8, 90);
    if (demo) odstavec('Ukázkový scénář – ceny orientační, stav k ' + demo.datumCen + '. Zdroj: ' + demo.zdroj, 7.5, 90);
    if (sc.poznamka) odstavec('Poznámka: ' + sc.poznamka, 8, 60);

    nadpis('Předpoklady');
    const g = sc.glob;
    odstavec(`Diskontní sazba ${nf.format(g.diskont)} % p.a. (${g.diskontTyp === 'realna' ? 'reálná' : 'nominální'}); obecná inflace ${nf.format(g.inflace)} % p.a.; růst ceny energie ${nf.format(g.rustEnergie)} % p.a. ${fisher}`);
    odstavec(rezim);

    nadpis('Výsledky');
    // tabulka
    const sloupcu = tabulka[0].length;
    const prvni = Math.min(62, SIR * 0.36), ostatni = (SIR - prvni) / Math.max(1, sloupcu - 1);
    doc.setFontSize(7.5);
    for (let ri = 0; ri < tabulka.length; ri++) {
      const radek = tabulka[ri];
      const bunky = radek.map((c, ci) => doc.splitTextToSize(txt(c.replace(' ✓', ' (nej)')), (ci ? ostatni : prvni) - 2));
      const h = Math.max(...bunky.map(b => b.length)) * 3.3 + 1.6;
      misto(h);
      if (ri === 0) { doc.setFillColor(236, 239, 243); doc.rect(M, y, SIR, h, 'F'); }
      doc.setTextColor(ri === 0 ? 60 : 20);
      bunky.forEach((b, ci) => {
        const x = ci ? M + prvni + (ci - 1) * ostatni + ostatni - 1 : M + 1;
        b.forEach((l, li) => doc.text(l, x, y + 3.2 + li * 3.3, { align: ci ? 'right' : 'left' }));
      });
      y += h;
      doc.setDrawColor(210); doc.line(M, y, M + SIR, y);
    }
    y += 2;
    odstavec(horizont, 7.5, 70);
    if (zvrat.length) { nadpis('Body zvratu', 10); zvrat.forEach(z => odstavec('• ' + z, 8)); }

    for (const o of obrazky) {
      const h = SIR * o.pomer;
      misto(h + 8);
      nadpis(o.titul, 10);
      doc.addImage(o.url, 'PNG', M, y, SIR, h); y += h + 3;
    }

    // vstupy
    novaStrana();
    nadpis('Vstupní údaje variant');
    const VN = R.varianty;
    const radky = [
      ['Pořizovací cena (Kč)', v => v.cena], ['Životnost (let)', v => v.zivotnost], ['Zůstatková hodnota (Kč)', v => v.zustatek],
      ['Četnost používání za rok', v => v.pouzitiRocne + ' ' + v.jednotkaPouziti], ['Spotřeba na 1 použití', v => v.energieNaPouziti + ' ' + v.jednotkaEnergie],
      ['Pevná spotřeba za rok', v => v.energieRocne + ' ' + v.jednotkaEnergie], ['Cena energie (Kč/jedn.)', v => v.cenaEnergie],
      ['Servis (Kč/rok)', v => v.servisRocne], ['Velký servis (Kč / let)', v => v.servisPeriodicky + ' / ' + v.servisPeriodaLet],
      ['Materiál na 1 použití (Kč)', v => v.materialNaPouziti], ['Ostatní pevné (Kč/rok)', v => v.ostatniRocne],
      ['Úvěr', v => v.financovani.zapnuto ? `akontace ${v.financovani.akontace} ${v.financovani.akontaceTyp === 'procenta' ? '%' : 'Kč'}, ${v.financovani.sazba} % ${v.financovani.sazbaTyp === 'rpsn' ? 'RPSN' : 'úrok'}, ${v.financovani.mesicu} splátek, poplatek ${v.financovani.poplatek} Kč` : 'ne']
    ];
    const t2 = [['Parametr'].concat(VN.map(v => v.nazev))].concat(radky.map(([n, f]) => [n].concat(VN.map(v => {
      const x = f(v); return typeof x === 'number' ? nf.format(x) : String(x).replace(/(\d)\.(\d)/g, '$1,$2');
    }))));
    doc.setFontSize(7.5);
    for (let ri = 0; ri < t2.length; ri++) {
      const bunky = t2[ri].map((c, ci) => doc.splitTextToSize(txt(c), (ci ? ostatni : prvni) - 2));
      const h = Math.max(...bunky.map(b => b.length)) * 3.3 + 1.6;
      misto(h);
      if (ri === 0) { doc.setFillColor(236, 239, 243); doc.rect(M, y, SIR, h, 'F'); }
      doc.setTextColor(20);
      bunky.forEach((b, ci) => { const x = ci ? M + prvni + (ci - 1) * ostatni + ostatni - 1 : M + 1; b.forEach((l, li) => doc.text(l, x, y + 3.2 + li * 3.3, { align: ci ? 'right' : 'left' })); });
      y += h; doc.setDrawColor(210); doc.line(M, y, M + SIR, y);
    }
    y += 4;
    nadpis('Metodika (zkráceně)', 10);
    odstavec('Měsíční časová osa, měsíc 0 = pořízení. Ceny zadané v dnešních cenách, inflace se uplatňuje skokem k výročí. Nominálně = prostý součet; diskontovaně = současná hodnota nominální sazbou, EAC a nivelizovaný náklad reálnou sazbou (Fisherova rovnice). ' +
      'Na společném horizontu se varianty nahrazují, rozpracovaný cyklus se oceňuje lineárně odepsanou hodnotou. Úvěr anuitní, RPSN dopočtena z toků. Bod zvratu = průsečík kumulativních nákladů s lineární interpolací v měsíci.', 7.5, 70);

    const stran = doc.getNumberOfPages();
    for (let i = 1; i <= stran; i++) { doc.setPage(i); doc.setFontSize(7); doc.setTextColor(120); doc.text(txt(`Kalkulátor TCO · ${sc.nazev} · strana ${i}/${stran}`), M, 292); }
    doc.save(nazevSouboru);
    return doc;
  }

  window.TCO_PDF = { vytvor };
})();
