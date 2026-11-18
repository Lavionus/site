// Jádro přednášky „Bezpečná domácí síť a router“: kontrolní seznam (data + stav).
// Bez DOM, test: node _test/prednaska_sit_test.js
(function (koren) {
    'use strict';

    const SEZNAM = [
        { skupina: '📡 Router', polozky: [
            ['heslo-spravce', 'Výchozí heslo správce routeru je změněné na dlouhé a jedinečné.'],
            ['firmware', 'Firmware je aktuální, automatické aktualizace jsou zapnuté.'],
            ['podpora', 'Výrobce model stále podporuje (ověřeno na jeho webu), jinak plánuji výměnu.'],
            ['vzdalena-sprava', 'Vzdálená správa z internetu je vypnutá.'],
            ['wps', 'WPS (tlačítko i PIN) je vypnuté.'],
            ['upnp', 'UPnP je vypnuté a přesměrování portů obsahuje jen to, co znám.'],
            ['dns', 'DNS je „automaticky od poskytovatele“ nebo filtr, který jsem zvolil(a) já.']
        ] },
        { skupina: '🛜 Wi-Fi', polozky: [
            ['sifrovani', 'Šifrování WPA3 nebo WPA2 (AES), žádné WEP, WPA ani TKIP.'],
            ['heslo-wifi', 'Heslo k Wi-Fi má aspoň 12 znaků, název sítě neprozrazuje jméno ani adresu.'],
            ['hoste', 'Síť pro hosty je zapnutá a nemá přístup do domácí sítě.'],
            ['iot', 'Chytrá zařízení (televize, kamery, vysavač…) jsou v oddělené síti.']
        ] },
        { skupina: '📱 Zařízení', polozky: [
            ['seznam-zarizeni', 'Prošel/prošla jsem seznam připojených zařízení a pojmenoval(a) je.'],
            ['kamery', 'Kamery a chytré věci mají změněná hesla, aktualizace a dvoufázové ověření účtu.'],
            ['ulozena-hesla', 'Heslo správce i heslo k Wi-Fi mám ve správci hesel nebo na papíře doma.'],
            ['ctvrtleti', 'Jednou za čtvrt roku kontroluji aktualizace a připojená zařízení.']
        ] },
        { skupina: '☕ Na cestách', polozky: [
            ['auto-pripojeni', 'Telefon se sám nepřipojuje k otevřeným sítím, staré sítě jsem zapomněl(a).'],
            ['bankovnictvi', 'Na veřejné Wi-Fi neplatím a nebankuji – používám mobilní data nebo důvěryhodnou VPN.']
        ] }
    ];

    const VSECHNA_ID = SEZNAM.flatMap(s => s.polozky.map(p => p[0]));

    // Uložený stav (JSON pole id) → Set platných id; poškozená data = prázdný stav.
    function nactiStav(text) {
        let pole;
        try { pole = JSON.parse(text || '[]'); } catch (e) { return new Set(); }
        if (!Array.isArray(pole)) return new Set();
        return new Set(pole.filter(id => VSECHNA_ID.includes(id)));
    }

    function ulozStav(stav) {
        return JSON.stringify(VSECHNA_ID.filter(id => stav.has(id)));
    }

    function prepni(stav, id, zapnout) {
        const novy = new Set(stav);
        if (!VSECHNA_ID.includes(id)) return novy;
        if (zapnout) novy.add(id); else novy.delete(id);
        return novy;
    }

    function pokrok(stav) {
        const celkem = VSECHNA_ID.length;
        const hotovo = VSECHNA_ID.filter(id => stav.has(id)).length;
        return { hotovo, celkem, procent: Math.round(hotovo / celkem * 100) };
    }

    const API = { SEZNAM, VSECHNA_ID, nactiStav, ulozStav, prepni, pokrok };
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
    else koren.PREDSIT = API;
})(this);
