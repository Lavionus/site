/* Modelář 3D – historie zpět/znovu (bez DOM, jde v node).
   Záznam = stav po akci: { dok, vyber, popis, sloucit, cas }. Záznam 0 je
   výchozí stav. Dokumenty jsou neměnné a nezměněné uzly sdílí, takže
   i stovky záznamů zabírají málo paměti. Akce se stejným klíčem `sloucit`
   do 1,5 s po sobě (třeba opakované šipky) splynou do jednoho záznamu. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';

  M.vytvorHistorii = function (limit = 500, okno = 1500) {
    const H = { zaznamy: [], index: -1 };

    H.zapis = function (stav, sloucit = null, ted = Date.now()) {
      const top = H.zaznamy[H.index];
      H.zaznamy.length = H.index + 1;                 // zahodí větev „znovu“
      if (sloucit && top && top.sloucit === sloucit && ted - top.cas < okno) {
        Object.assign(top, { dok: stav.dok, vyber: stav.vyber, cas: ted });
        return;
      }
      H.zaznamy.push({ dok: stav.dok, vyber: stav.vyber || [], popis: stav.popis || '', sloucit, cas: ted });
      if (H.zaznamy.length > limit) H.zaznamy.splice(0, H.zaznamy.length - limit);
      H.index = H.zaznamy.length - 1;
    };

    /** Dopočet k poslední akci (třeba obrysy písma): nahradí dokument aktuálního záznamu. */
    H.nahradAktualni = function (dok) {
      if (H.zaznamy[H.index]) H.zaznamy[H.index].dok = dok;
    };

    /** Výběr se mění i bez změny dokumentu; pamatuje se u aktuálního záznamu. */
    H.nastavVyber = function (vyber) {
      if (H.zaznamy[H.index]) H.zaznamy[H.index].vyber = vyber;
    };

    H.muzeZpet = () => H.index > 0;
    H.muzeZnovu = () => H.index < H.zaznamy.length - 1;
    /** Popis akce, kterou by Zpět vrátil / Znovu zopakoval. */
    H.popisZpet = () => H.muzeZpet() ? H.zaznamy[H.index].popis : '';
    H.popisZnovu = () => H.muzeZnovu() ? H.zaznamy[H.index + 1].popis : '';

    H.zpet = function () {
      if (!H.muzeZpet()) return null;
      H.index--;
      const z = H.zaznamy[H.index];
      z.sloucit = null;                               // po návratu se už neslučuje
      return z;
    };
    H.znovu = function () {
      if (!H.muzeZnovu()) return null;
      H.index++;
      H.zaznamy[H.index].sloucit = null;
      return H.zaznamy[H.index];
    };
    /** Skok na záznam i (posuvník historie); vrací záznam nebo null. */
    H.skoc = function (i) {
      if (!(i >= 0 && i < H.zaznamy.length) || i === H.index) return null;
      H.index = i;
      H.zaznamy[i].sloucit = null;
      return H.zaznamy[i];
    };
    H.vymaz = function (stav) {
      H.zaznamy = [];
      H.index = -1;
      H.zapis(stav);
    };
    return H;
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);
