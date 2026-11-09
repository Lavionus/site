/* Záložky a ex libris – data, která nejsou rozhraní: vzorové citáty, výchozí texty návrhů a tabulky
   koncovek pro 2. pád jména. Jsou v samostatném souboru *_data.js, aby je extrakce překladů (i18n)
   nebrala jako texty rozhraní. Ve stránce se vypisují s data-i18n="ne". */
(function (koren) {
  'use strict';
  const D = {
    /* vzorové citáty (volná díla, přísloví) */
    CITATY: [
      { text: 'Mám-li zahradu a knihovnu, nechybí mi nic.', autor: 'Marcus Tullius Cicero' },
      { text: 'Kniha je zahrada, kterou nosíš v kapse.', autor: 'arabské přísloví' },
      { text: 'Knihy jsou nástroje moudrosti.', autor: 'Jan Amos Komenský' },
      { text: 'Pokoj bez knih je jako tělo bez duše.', autor: 'Marcus Tullius Cicero' },
      { text: 'Čtení je pro ducha tím, čím je cvičení pro tělo.', autor: 'Joseph Addison' },
      { text: 'Vždycky jsem si představoval ráj jako nějakou knihovnu.', autor: 'Jorge Luis Borges' },
      { text: 'Kdo nečte, nežije o nic víc než ten, kdo neumí číst.', autor: 'Mark Twain' },
      { text: 'Dobrá kniha je nejlepší přítel, dnes i navždy.', autor: 'Martin Farquhar Tupper' },
      { text: 'Tady jsem skončil a zítra budu pokračovat.', autor: '' },
    ],
    /* výchozí obsah nového návrhu */
    VYCHOZI: {
      citat: 'Mám-li zahradu a knihovnu, nechybí mi nic.', autor: 'Marcus Tullius Cicero',
      rub: 'Tady jsem skončil', jmeno: 'Jan Novák',
    },
    /* 2. pád: měkké souhlásky, koncovky [1. pád, 2. pád] v pořadí zkoušení */
    MEKKE: 'šžčřcjďťň',
    ZENA: [['ová', 'ové'], ['ská', 'ské'], ['cká', 'cké'], ['á', 'é'], ['ie', 'ie'], ['ea', 'ey'], ['e', 'e']],
    MUZ: [['ových', 'ových'], ['ých', 'ých'], ['ovi', 'ových'], ['ý', 'ého'], ['í', 'ího'], ['něk', 'ňka'], ['těk', 'ťka'], ['děk', 'ďka'],
      ['švec', 'ševce'], ['ek', 'ka'], ['ec', 'ce'], ['o', 'a'], ['e', 'e']],
    ZENSKE_PRIJMENI: ['ová', 'ská', 'cká', 'á'],
    /* slova, která se neskloňují (spojky, šlechtické předložky, „rodiny“) */
    NESKLONNE: ['a', 'i', 'z', 'ze', 'von', 'van', 'der', 'den', 'de', 'la', 'du', 'rodiny', 'rod', '&'],
    /* -el se mění na -la jen po souhlásce, tyto výjimky ne (Daniel → Daniela) */
    VYJIMKY_EL: ['abel', 'hegel', 'kafel', 'rachel', 'mabel'],
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = D;
  else koren.ZE_DATA = D;
})(typeof globalThis !== 'undefined' ? globalThis : this);
