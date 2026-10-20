/* ============================================================
   Sluneční hodiny – oddíl „Jak tyto hodiny fungují“ (HTML + malá SVG schémata)
   SHPrincip.html(typ, p) → řetězec HTML; schémata se počítají z modelu (SH)
   ============================================================ */
(function (koren) {
  'use strict';
  const SH = koren.SH;
  const RAD = Math.PI / 180;
  const n = (x) => (Math.round(x * 100) / 100).toString();
  const f1 = (x) => (Math.round(x * 10) / 10).toString().replace('.', ',');
  const svg = (w, h, obsah, popis) => `<figure class="schema"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${popis}" style="max-width:${w * 1.6}px">${obsah}</svg><figcaption>${popis}</figcaption></figure>`;
  const car = (b, s, c, d) => `<path d="${b.map((q, i) => (i ? 'L' : 'M') + n(q[0]) + ' ' + n(q[1])).join('')}" fill="none" stroke="${c || 'currentColor'}" stroke-width="${s || 1}"${d ? ' stroke-dasharray="4 3"' : ''} stroke-linecap="round"/>`;
  const txt = (x, y, t, a, vel, c) => `<text x="${n(x)}" y="${n(y)}" font-size="${vel || 10}" text-anchor="${a || 'middle'}" fill="${c || 'currentColor'}">${t}</text>`;

  /** Země s osou a pozorovatelem na šířce φ: styl je rovnoběžný s osou */
  function schemaOsa(fi) {
    const cx = 90, cy = 85, r = 55, a = fi * RAD;
    const P = [cx + r * Math.cos(a), cy - r * Math.sin(a)];               // pozorovatel (řez poledníkem)
    const tx = -Math.sin(a), ty = -Math.cos(a);                          // tečna = obzor (v SVG y dolů)
    let s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="currentColor" stroke-width="1.2"/>`;
    s += car([[cx, cy + r + 18], [cx, cy - r - 18]], 1, 'currentColor', true) + txt(cx - 4, cy - r - 10, 'osa Země', 'end', 9) + txt(cx - 4, cy - r + 1, '(k Polárce)', 'end', 8);
    s += car([[cx - r, cy], [cx + r, cy]], 0.6, 'currentColor', true) + txt(cx - r - 3, cy + 3, 'rovník', 'end', 9);
    s += car([[P[0] - tx * 40, P[1] - ty * 40], [P[0] + tx * 40, P[1] + ty * 40]], 1.2, 'var(--text-faint)') + txt(P[0] - tx * 40 + 3, P[1] - ty * 40 + 10, 'obzor', 'start', 9);
    s += car([P, [P[0], P[1] - 34]], 2.4, 'var(--accent)') + txt(P[0] + 6, P[1] - 22, 'styl ∥ osa', 'start', 9, 'var(--accent)');
    s += car([[cx, cy], P], 0.6, 'currentColor', true);
    const ra = 16, ob = []; for (let u = 0; u <= fi; u += 2) ob.push([cx + ra * Math.cos(u * RAD), cy - ra * Math.sin(u * RAD)]);
    s += car(ob, 0.8) + txt(cx + ra + 10, cy - 4, 'φ', 'middle', 10);
    s += `<circle cx="${n(P[0])}" cy="${n(P[1])}" r="3" fill="var(--accent)"/>`;
    return svg(250, 180, s, `Styl míří k nebeskému pólu – je rovnoběžný se zemskou osou, proto s vodorovnou rovinou svírá úhel φ = ${f1(fi)}°.`);
  }

  /** vějíře hodinových čar: ekvatoriální (po 15°) a vodorovné (tan H = sin φ tan t) */
  function schemaVejire(fi) {
    const vej = (cx, cy, r, uhel) => {
      let s = `<circle cx="${cx}" cy="${cy}" r="2" fill="currentColor"/>`;
      for (let k = -6; k <= 6; k++) {
        const H = uhel(k * 15) * RAD, x = cx + r * Math.sin(H), y = cy - r * Math.cos(H);
        s += car([[cx, cy], [x, y]], k === 0 ? 1.6 : 0.8, k === 0 ? 'var(--accent)' : 'currentColor');
        if (k % 3 === 0) s += txt(cx + (r + 9) * Math.sin(H), cy - (r + 9) * Math.cos(H) + 3, String(12 + k), 'middle', 9);
      }
      return s;
    };
    const sf = Math.sin(fi * RAD);
    let s = vej(85, 95, 60, (t) => t) + txt(85, 120, 'ekvatoriální: po 15°', 'middle', 9);
    s += vej(245, 95, 60, (t) => (Math.abs(t) >= 90 ? Math.sign(t) * 90 : Math.atan(sf * Math.tan(t * RAD)) / RAD)) + txt(245, 120, 'vodorovné: hustě u poledne', 'middle', 9);
    return svg(330, 128, s, `Stín stylu se otáčí rovnoměrně o 15° za hodinu jen v rovině kolmé na osu (ekvatoriální hodiny). Na vodorovnou desku se tento rovnoměrný vějíř promítá šikmo, takže čáry kolem poledne se zhušťují: tan H = sin φ · tan t.`);
  }

  /** stopy stínu nodu na vodorovné ploše pro slunovraty a rovnodennost */
  function schemaNod(fi) {
    const m = SH.model('vodorovne', fi, 0), out = [];
    let s = '';
    const X = (q) => 115 + q[0] * 13, Y = (q) => 125 - q[1] * 13;
    for (const [d, c, t] of [[23.44, 'var(--accent)', '21. 6.'], [0, 'currentColor', 'rovnodennost'], [-23.44, 'var(--danger)', '21. 12.']]) {
      const b = [];
      for (let tt = -120; tt <= 120; tt += 2) { const P = m.stin(tt, d); if (P && Math.abs(P[0]) < 8 && P[1] < 8.8 && P[1] > -1.5) b.push([X(P), Y(P)]); }
      if (b.length > 1) { s += car(b, 1.4, c); out.push([b[0], t, c]); }
    }
    for (const [b, t, c] of out) s += txt(b[0] + 2, b[1] - 4, t, 'start', 9, c);
    s += `<circle cx="115" cy="125" r="3" fill="currentColor"/>` + txt(115, 139, 'pata nodu', 'middle', 9) + txt(205, 12, '↑ sever', 'middle', 9);
    return svg(240, 148, s, 'Nod (bod na stylu) vrhá stín, který se během dne pohybuje po křivce. Její poloha závisí na deklinaci Slunce: v létě je stín krátký (křivka blízko gnomonu), v zimě dlouhý. Rovnodennostní stopa je přímka.');
  }

  /** analematické: elipsa a posun gnomonu po datové stupnici */
  function schemaAnalema(fi) {
    const sf = Math.sin(fi * RAD), cf = Math.cos(fi * RAD), M = 80, cx = 110, cy = 75;
    const el = []; for (let a = 0; a <= 360; a += 4) el.push([cx + M * Math.sin(a * RAD), cy - M * sf * Math.cos(a * RAD)]);
    let s = car(el, 1);
    for (let k = -6; k <= 6; k++) { const t = k * 15 * RAD, x = cx + M * Math.sin(t), y = cy - M * sf * Math.cos(t); s += `<circle cx="${n(x)}" cy="${n(y)}" r="2.2" fill="currentColor"/>`; if (k % 3 === 0) s += txt(x, y - 6, String(12 + k), 'middle', 9); }
    const yD = (d) => cy - M * cf * Math.tan(d * RAD);
    s += car([[cx, yD(23.44)], [cx, yD(-23.44)]], 3, 'var(--accent)') + txt(cx + 6, yD(23.44) + 3, 'léto', 'start', 9) + txt(cx + 6, yD(-23.44) + 3, 'zima', 'start', 9);
    // stín v 15 h o letním slunovratu
    const v = SH.vektorSlunce(45, 23.44, fi), F = [cx, yD(23.44)], k = 70 / Math.hypot(v[0], v[1]);
    s += car([F, [F[0] - v[0] * k, F[1] + v[1] * k]], 2, 'var(--text-faint)');
    return svg(220, 150, s, 'Hodinové body leží na elipse (sever nahoře). Svislý gnomon se staví na datovou stupnici – v létě severněji, v zimě jižněji – a tím se vyrovnává měnící se deklinace Slunce. Šedě: stín v 15 h o letním slunovratu míří k bodu 15.');
  }

  /** výškové hodiny: vyšší Slunce = delší svislý stín pod kolíkem */
  function schemaVyska() {
    let s = `<rect x="40" y="10" width="14" height="120" fill="none" stroke="currentColor" stroke-width="1.2"/>`;
    s += car([[54, 25], [94, 25]], 2.4);
    for (const [h, c, t] of [[60, 'var(--accent)', 'poledne v létě'], [35, 'currentColor', 'dopoledne'], [15, 'var(--danger)', 'zima']]) {
      const d = 40 * Math.tan(h * RAD);
      s += car([[94 + 70 * Math.cos(h * RAD), 25 - 70 * Math.sin(h * RAD)], [54, 25 + d]], 0.9, c, true);
      s += `<circle cx="54" cy="${n(25 + d)}" r="2.6" fill="${c}"/>` + txt(60, 25 + d + 3, t + ' (' + h + '°)', 'start', 9, c);
    }
    return svg(220, 140, s, 'Kolík délky L trčí vodorovně ze svislé stěny natočené ke Slunci. Stín jeho hrotu padá o d = L · tan h níž – podle výšky Slunce h, ne podle azimutu. Proto je ve sloupci každého měsíce zvláštní stupnice.');
  }

  function html(typ, p) {
    const fi = Math.abs(+p.sirka || 50), k = [];
    const spolecne = `<h3>Pravý sluneční čas a hodinky</h3><p>Sluneční hodiny ukazují <b>pravý sluneční čas</b>: poledne je, když Slunce stojí přesně na jihu. Hodinky jdou podle <b>středního času pásma</b> (SEČ = poledník 15° v. d.). Rozdíl tvoří dvě části: <b>korekce na zeměpisnou délku</b> (4 minuty na každý stupeň od poledníku pásma, v Praze asi −2 min) a <b>rovnice času</b> (−14 až +16 min během roku, protože dráha Země je eliptická a zemská osa skloněná). Hodinky = údaj hodin + korekce z tabulky „Rovnice času“; v létě ještě + 1 h (nebo čtěte červená čísla). Volba „Korigovat na zeměpisnou délku“ posune čáry tak, že zbývá jen rovnice času; analema (osmička) pro poledne zahrne i ji.</p>`;
    if (typ === 'vodorovne' || typ === 'svisle' || typ === 'deklinujici' || typ === 'polarni') {
      k.push(`<h3>Proč je styl rovnoběžný se zemskou osou</h3><p>Slunce se během dne zdánlivě otáčí kolem zemské osy rovnoměrně o 15° za hodinu. Hrana gnomonu (styl) míří k nebeskému pólu, takže Slunce obíhá kolem ní – stín stylu leží vždy v rovině „hodinového úhlu“ a ukazuje stejnou hodinu bez ohledu na roční období. Proto u vodorovných hodin svírá styl s deskou úhel rovný zeměpisné šířce, u svislých jižních 90° − φ.</p>` + schemaOsa(fi));
      k.push(`<h3>Proč hodinové čáry nejsou rovnoměrné</h3><p>Rovnoměrně po 15° se stín otáčí jen v rovině rovníku. ${typ === 'polarni' ? 'U polárních hodin je deska rovnoběžná s osou, čáry jsou rovnoběžné a jejich vzdálenost od podstylu roste jako tan t – v poledne hustě, k ránu a večeru do nekonečna.' : 'Deska ' + (typ === 'vodorovne' ? 'vodorovných' : 'svislých') + ' hodin leží šikmo k rovníku, rovnoměrný vějíř se na ni promítá zkresleně: ' + (typ === 'vodorovne' ? 'tan H = sin φ · tan t' : typ === 'svisle' ? 'tan H = cos φ · tan t' : 'u deklinující stěny je navíc vějíř nesouměrný a střed podstylu je odkloněný od svislice') + '.'}</p>` + schemaVejire(fi));
      k.push(`<h3>Co dělá nod a datové křivky</h3><p>Nod je jeden bod na stylu (u trojúhelníkového gnomonu jeho vrchol). Zatímco stín celého stylu ukazuje čas, stín nodu ukazuje i <b>datum</b>: jeho dráha za den je kuželosečka podle deklinace Slunce. Datové křivky pro slunovraty, rovnodennost nebo začátky měsíců jsou tyto dráhy předem spočítané.</p>` + schemaNod(fi));
    } else if (typ === 'ekvatorialni') {
      k.push(`<h3>Jak fungují ekvatoriální hodiny</h3><p>Deska leží v rovině rovníku a tyč míří k pólu. Slunce se kolem tyče otáčí rovnoměrně, proto jsou čáry přesně po 15°. Od jarní do podzimní rovnodennosti je Slunce nad rovinou rovníku a svítí na horní stranu (A), v zimě na dolní (B). Kolem rovnodenností je stín téměř v rovině desky a hodiny se špatně čtou.</p>` + schemaOsa(fi) + schemaVejire(fi));
      k.push(`<h3>Nod</h3><p>Kulička na tyči ve vzdálenosti h od desky vrhá stín na kružnici o poloměru h · cot δ – menší kruh v létě a v zimě, velký kolem rovnodenností.</p>`);
    } else if (typ === 'analematicke') {
      k.push(`<h3>Jak fungují analematické hodiny</h3><p>Hodinové body leží na elipse, která je průmětem kruhu ekvatoriálních hodin na vodorovnou rovinu (velká poloosa M ve směru východ–západ, malá M · sin φ). Gnomon je <b>svislý</b>, ne rovnoběžný s osou – chybu, kterou by to způsobilo, vyrovná jeho posun po datové stupnici o M · cos φ · tan δ k severu. Stín gnomonu pak protne elipsu v bodě správné hodiny.</p>` + schemaAnalema(fi));
    } else if (typ === 'kapesni') {
      k.push(`<h3>Jak fungují výškové hodiny</h3><p>Výškové (kapesní, pastýřské) hodiny neměří směr Slunce, ale jeho <b>výšku nad obzorem</b>. Visí svisle a natočí se ke Slunci, takže nezáleží na severu ani na kompasu. Výška Slunce v danou hodinu ale závisí na datu, proto má každý měsíc (nebo dvojice měsíců se stejnou deklinací) vlastní sloupec se značkami. Dopoledne a odpoledne jsou souměrné – hodiny nerozliší 9 a 15 h – a kolem poledne se výška mění pomalu, takže tam čtou nejhůř.</p>` + schemaVyska());
    }
    k.push(spolecne);
    return k.join('');
  }

  koren.SHPrincip = { html, schemaOsa, schemaVejire, schemaNod, schemaAnalema, schemaVyska };
})(typeof window !== 'undefined' ? window : globalThis);
