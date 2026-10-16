/* Modelář 3D – podpora dílů v hlavním vlákně.
   Štítek se jménem potřebuje obrysy písma: worker fonty nenačítá, proto se
   obrysy spočítají tady (FONTY + opentype) a uloží do param.kontury.
   Po každé změně dokumentu se najdou štítky, jejichž obrysy neodpovídají
   textu, písmu a velikosti (param.konturyPro), dopočítají se a změna
   nahradí poslední krok historie (žádný krok navíc). */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';

  const klicTextu = p => `${p.text}|${p.font}|${p.velikost}`;

  /** Najde štítky (i ve skupinách) se zastaralými obrysy. */
  function zastarale(uzly, out = []) {
    for (const u of uzly) {
      if (u.druh === 'stitek' && u.param.konturyPro !== klicTextu(u.param)) out.push(u);
      if (u.druh === 'skupina') zastarale(u.deti, out);
    }
    return out;
  }

  M.vytvorDily = function () {
    const rozpracovane = new Set(), hlasene = new Set();
    async function dopocitej() {
      for (const u of zastarale(M.app.dok.uzly)) {
        const klic = u.id + '|' + klicTextu(u.param);
        if (rozpracovane.has(klic)) continue;
        // štítek uvnitř skupiny: přepočet by změnil rozměr části a s ním celou skupinu – poradit (jednou)
        if (!M.najdiUzel(M.app.dok, u.id)) {
          if (!hlasene.has(klic)) {
            hlasene.add(klic);
            Dialog.info(`Štítek „${u.param.text}“ je ve skupině a jeho text ještě není spočítaný. Zruš seskupení (Ctrl+Shift+G) – text se doplní – a pak skupinu vytvoř znovu.`);
          }
          continue;
        }
        rozpracovane.add(klic);
        let kontury = [], chyba = false;
        try {
          if (typeof FONTY === 'undefined' || typeof opentype === 'undefined') throw new Error('písma nejsou k dispozici');
          kontury = u.param.text.trim() ? M.konturyTextu(await FONTY.opentype(u.param.font), u.param.text, u.param.velikost) : [];
        } catch (e) {
          console.error('Modelář: písmo štítku nejde načíst', e);
          Dialog.chyba('Písmo štítku nejde načíst: ' + e.message + ' (text se doplní, až písmo půjde načíst – třeba po připojení k síti)');
          chyba = true;
        }
        rozpracovane.delete(klic);
        // nenačtené písmo (offline): nic nezapisovat – prázdné obrysy by text smazaly natrvalo
        if (chyba) continue;
        // mezitím se mohl text změnit nebo štítek zmizet: zapsat jen do odpovídajícího uzlu (nahoře v dokumentu)
        const akt = M.najdiUzel(M.app.dok, u.id);
        if (!akt || akt.druh !== 'stitek' || klicTextu(akt.param) !== klicTextu(u.param)) continue;
        const z = M.upravPrirozeny(akt, { kontury, konturyPro: klicTextu(akt.param) });
        M.zmenDokument(M.upravUzly(M.app.dok, [akt.id], z), 'Text štítku', { nahraditPosledni: true });
      }
    }
    M.na('dokument', e => { if (!e.docasne) dopocitej(); });
    return { dopocitej };
  };
})(MDL);
