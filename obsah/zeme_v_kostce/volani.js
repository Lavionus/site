/* Země v kostce – mezinárodní výstupní prefixy (stav 11/2026). Zdroj: Wikipedie „List of international call prefixes“ (ITU-T E.164/E.123). */
window.ZVK_VOLANI = {
  stav: '2026-11',
  vychozi: '00',
  zeme: {
    /* NANP (+1) a státy volně přidružené k USA */
    AG: '011', BB: '011', BS: '011', CA: '011', DM: '011', DO: '011', GD: '011', JM: '011',
    KN: '011', LC: '011', TT: '011', US: '011', VC: '011', FM: '011', PW: '011', MH: '011',
    /* ostatní výjimky */
    AU: '0011', JP: '010', SG: '000', KE: '000', TZ: '000', UG: '000', NG: '009', GY: '001',
    WS: '0', KP: '00',
    BR: '0021', CO: '009', ID: '001', KH: '001', KR: '001', TW: '002', TH: '001', MN: '001',
    RU: '8~10', BY: '8~10', KZ: '8~10', TJ: '8~10', TM: '8~10'
  },
  pozn: {
    AU: '0011 výchozí operátor; 0014/0018/0019 volba operátora',
    BR: '00 + dvoumístný kód operátora (např. 0021, 0041, 0015)',
    CO: '00 + kód operátora: 005, 007 nebo 009',
    ID: '00 + kód operátora: 001, 007 nebo 008',
    KH: '001 Telecom Cambodia, 007 Royal Telecom',
    KR: '00 + kód operátora (001, 002, 00700…)',
    TW: '00 + kód operátora (002, 005, 006…)',
    TH: '00 + kód operátora (001, 007, 009…)',
    MN: '00 + kód operátora: 001, 002, 003, 008, 009',
    KE: 'do Ugandy 006, do Tanzanie 007 (zkrácené volání)',
    TZ: 'do Keni 005, do Ugandy 006 (zkrácené volání)',
    UG: 'do Keni 005, do Tanzanie 007 (zkrácené volání)',
    SG: '000 výchozí; 001 SingTel, 002 M1, 008 StarHub',
    IL: '00 výchozí; 012–019 volba operátora',
    FI: '00 výchozí; 99x volba operátora',
    RU: '8, počkat na tón, 10 (8~10)',
    BY: '8, počkat na tón, 10 (8~10)',
    KZ: '8, počkat na tón, 10 (8~10)',
    TJ: '8, počkat na tón, 10 (8~10)',
    TM: '8, počkat na tón, 10 (8~10)',
    WS: 'Samoa používá jen 0',
    KP: 'podle číslovacího plánu 00, některé přehledy uvádějí 99; běžní uživatelé do zahraničí volat nemohou'
  },
  nejiste: ['MH', 'BY', 'KZ', 'TJ', 'TM', 'KP']
};
