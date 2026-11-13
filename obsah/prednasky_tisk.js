// Tisk podkladů k přednáškám: 6 slidů na stránku A4 pro posluchače.
// Přidá do .toolbar tlačítko 🖨️ (klávesa P) a 🏠 zpět na prednasky.html.
// Adresa s ?podklady sestaví podklady hned (test), ?tisk je rovnou vytiskne (odkaz z rozcestníku).
(function () {
    'use strict';
    const lista = document.querySelector('.toolbar');
    if (!lista) return;

    const styl = document.createElement('style');
    styl.textContent = `
        #podklady { display: none; }
        @media print {
            @page { size: A4; margin: 10mm; }
            html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
            body { display: block !important; }
            body::before, body::after { display: none !important; }
            body > *:not(#podklady) { display: none !important; }
            #podklady { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; color: #000; font-family: inherit; }
            #podklady * { color: #000 !important; text-shadow: none !important; animation: none !important; }
            #podklady .pk-hlava { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: baseline;
                border-bottom: 0.4mm solid #999; padding-bottom: 2mm; }
            #podklady .pk-hlava b { font-size: 14pt; }
            #podklady .pk-hlava span { font-size: 8pt; }
            #podklady .pk-slide { border: 0.3mm solid #aaa; border-radius: 2.5mm; padding: 3mm; height: 80mm; overflow: hidden;
                break-inside: avoid; position: relative; font-size: 7.2pt; line-height: 1.3; background: #fff; }
            #podklady .pk-cislo { position: absolute; right: 3mm; bottom: 2mm; font-size: 6.5pt; color: #666 !important; }
            #podklady .slide-content { display: flex !important; flex-direction: row !important; align-items: flex-start !important; gap: 2.5mm !important; height: auto !important; overflow: visible !important; }
            #podklady .text-content { flex: 1 1 auto !important; min-width: 0; overflow: visible !important; max-height: none !important;
                padding: 0 !important; text-align: left !important; }
            #podklady .image-content { flex: 0 0 26mm !important; width: 26mm; display: block !important; margin: 0 !important; }
            #podklady .image-content img { max-width: 100%; max-height: 24mm; opacity: 1 !important; box-shadow: none !important;
                border-radius: 1.5mm; display: block; }
            #podklady h1, #podklady h2 { font-size: 10pt !important; margin: 0 0 1.5mm !important; display: block !important;
                border: 0 !important; background: none !important; -webkit-text-fill-color: #000 !important; }
            #podklady h2::after, #podklady h1::after { display: none !important; }
            #podklady h3 { font-size: 7.5pt !important; margin: 0 0 0.8mm !important; }
            #podklady p, #podklady li, #podklady summary, #podklady .highlight-box, #podklady div {
                font-size: 7.2pt !important; line-height: 1.3 !important; }
            #podklady p { margin: 1mm 0 !important; }
            #podklady ul { margin: 0 0 1mm !important; padding-left: 3.5mm !important; display: block !important; }
            #podklady li { margin: 0 0 0.6mm !important; padding: 0 !important; list-style: disc; }
            #podklady li::before { display: none !important; }
            #podklady .highlight-box { background: #f1f1f1 !important; border: 0 !important; border-left: 0.8mm solid #888 !important;
                padding: 1.2mm 2mm !important; margin: 1.5mm 0 0 !important; border-radius: 1mm !important; display: block !important; }
            #podklady .tools-grid { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 1.5mm !important; margin: 1mm 0 !important; }
            #podklady .tool-category { padding: 1mm 1.5mm !important; border: 0.2mm solid #ccc !important; background: none !important; }
            #podklady details { margin: 0.8mm 0 !important; padding: 0.8mm 1.5mm !important; border: 0.2mm solid #ccc !important; background: none !important; }
            #podklady .odkazy, #podklady .toolbar { display: none !important; }
        }`;
    document.head.appendChild(styl);

    const tl = document.createElement('button');
    tl.className = 'toolbar-btn';
    tl.id = 'btn-tisk';
    tl.title = 'Tisk podkladů – 6 slidů na stránku (P)';
    tl.textContent = '🖨️';
    lista.prepend(tl);

    // Zpět na rozcestník přednášek (obsah/prednasky.html).
    const domu = document.createElement('a');
    domu.className = 'toolbar-btn';
    domu.href = 'prednasky.html';
    domu.title = 'Všechny přednášky';
    domu.textContent = '🏠';
    domu.style.textDecoration = 'none';
    lista.prepend(domu);

    function sestav() {
        document.getElementById('podklady')?.remove();
        const slidy = document.querySelectorAll('.slide');
        const p = document.createElement('div');
        p.id = 'podklady';
        const hlava = document.createElement('div');
        hlava.className = 'pk-hlava';
        const nazev = document.createElement('b');
        nazev.textContent = (slidy[0]?.querySelector('h1,h2')?.textContent || document.title).trim();
        const kde = document.createElement('span');
        kde.textContent = location.host + location.pathname.replace(/^.*\//, '/');
        hlava.append(nazev, kde);
        p.append(hlava);
        slidy.forEach((s, i) => {
            const k = document.createElement('div');
            k.className = 'pk-slide';
            const obsah = s.querySelector('.slide-content').cloneNode(true);
            obsah.querySelectorAll('img').forEach(im => { im.loading = 'eager'; im.removeAttribute('class'); });
            obsah.querySelectorAll('details').forEach(d => { d.open = true; });
            const c = document.createElement('div');
            c.className = 'pk-cislo';
            c.textContent = (i + 1) + ' / ' + slidy.length;
            k.append(obsah, c);
            p.append(k);
        });
        document.body.append(p);
        return Promise.all([...p.querySelectorAll('img')].map(im =>
            im.complete ? null : new Promise(r => { im.onload = im.onerror = r; })));
    }

    function tiskni() { sestav().then(() => window.print()); }

    tl.onclick = tiskni;
    document.addEventListener('keydown', e => {
        if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey && !e.altKey && e.target.tagName !== 'INPUT') tiskni();
    });
    if (/[?&]podklady\b/.test(location.search)) sestav();
    else if (/[?&]tisk\b/.test(location.search)) addEventListener('load', () => setTimeout(tiskni, 300));
    window.PrednaskyTisk = { sestav };
})();
